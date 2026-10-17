// Server code for George's AG shifts.
// These run in Google's cloud, not on anyone's phone, so people can't tamper with them.

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fmtDate, fmtShift, fmtRange } from './format.js';

initializeApp();
const db = getFirestore();
const scryptAsync = promisify(scrypt);

const PIN_PATTERN = /^\d{4}$/;
const MAX_PIN_TRIES = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;
const FIRST_COLOR = '#1E7A46';
const DEFAULT_SETTINGS = {
  positions: ['Cashier'],
  presets: [
    { id: 'morning', label: 'Morning', start: '08:00', end: '15:00' },
    { id: 'evening', label: 'Evening', start: '15:00', end: '22:00' },
  ],
};

// ---------- helpers ----------

function nameKey(name) {
  return String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, 32);
  return { hash: hash.toString('base64'), salt: salt.toString('base64') };
}

async function pinMatches(pin, record) {
  const hash = await scryptAsync(pin, Buffer.from(record.salt, 'base64'), 32);
  return timingSafeEqual(hash, Buffer.from(record.hash, 'base64'));
}

function verifiedEmail(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const email = request.auth.token.email?.toLowerCase();
  if (!email) throw new HttpsError('failed-precondition', 'This sign-in has no email address.');
  if (!request.auth.token.email_verified) {
    throw new HttpsError('failed-precondition', 'Verify your email first.', { reason: 'unverified' });
  }
  return email;
}

async function callerMember(request) {
  const memberId = request.auth?.token?.memberId;
  if (!memberId) throw new HttpsError('unauthenticated', 'Sign in again.');
  const snap = await db.doc(`members/${memberId}`).get();
  if (!snap.exists || !snap.data().active) {
    throw new HttpsError('permission-denied', 'Your account is turned off. Ask a manager.');
  }
  return { id: memberId, ...snap.data() };
}

async function requireManager(request) {
  const member = await callerMember(request);
  if (member.role !== 'manager') throw new HttpsError('permission-denied', 'Only managers can do that.');
  return member;
}

async function loadMembers() {
  const snap = await db.collection('members').get();
  const map = {};
  snap.forEach((d) => (map[d.id] = { id: d.id, ...d.data() }));
  return map;
}

function appUrl(hash) {
  const base = process.env.APP_URL || `https://${process.env.GCLOUD_PROJECT}.web.app`;
  return `${base}/#${hash}`;
}

// Sends a push notification to every device belonging to these people.
async function notify(memberIds, title, body, hash) {
  const ids = [...new Set(memberIds)].filter(Boolean);
  if (ids.length === 0) return;
  const fids = [];
  const docsByFid = {};
  // Firestore "in" queries take at most 30 values at a time.
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await db.collection('devices').where('memberId', 'in', ids.slice(i, i + 30)).get();
    snap.forEach((d) => {
      fids.push(d.id);
      docsByFid[d.id] = d.ref;
    });
  }
  if (fids.length === 0) return;
  try {
    const res = await getMessaging().sendEachForMulticast({
      fids,
      notification: { title, body },
      webpush: {
        notification: { icon: '/icons/icon-192.png', badge: '/icons/badge-96.png' },
        fcmOptions: { link: appUrl(hash) },
      },
    });
    // Forget devices that uninstalled the app or turned notifications off.
    await Promise.all(
      res.responses.map((r, i) => {
        const code = r.error?.code ?? '';
        if (code.includes('not-registered') || code.includes('invalid-registration')) {
          return docsByFid[fids[i]].delete();
        }
        return null;
      }),
    );
  } catch (err) {
    logger.warn('Push send failed', err);
  }
}

// ---------- sign in ----------

// Called after someone signs in with email or Google.
// Matches their email to a team member the manager added.
export const linkAccount = onCall(async (request) => {
  const email = verifiedEmail(request);
  const anyone = await db.collection('members').limit(1).get();
  if (anyone.empty) return { status: 'bootstrap' };

  const found = await db.collection('members').where('email', '==', email).get();
  const member = found.docs.find((d) => d.data().active);
  if (!member) return { status: 'not-invited' };

  if (request.auth.token.memberId !== member.id) {
    await getAuth().setCustomUserClaims(request.auth.uid, { memberId: member.id });
  }
  return { status: 'linked', memberId: member.id };
});

// First-time setup: the very first person to sign in becomes a manager.
export const bootstrap = onCall(async (request) => {
  const email = verifiedEmail(request);
  const name = String(request.data?.name ?? '').trim();
  const pin = request.data?.pin ? String(request.data.pin) : '';
  if (!name || name.length > 40) throw new HttpsError('invalid-argument', 'Enter your name (40 letters max).');
  if (pin && !PIN_PATTERN.test(pin)) throw new HttpsError('invalid-argument', 'The PIN must be 4 digits.');

  const ref = db.collection('members').doc();
  await db.runTransaction(async (tx) => {
    const anyone = await tx.get(db.collection('members').limit(1));
    if (!anyone.empty) throw new HttpsError('already-exists', 'The store is already set up. Ask a manager to add you.');
    tx.set(ref, {
      name,
      nameKey: nameKey(name),
      email,
      role: 'manager',
      color: FIRST_COLOR,
      active: true,
      notify: 'mine',
      hasPin: Boolean(pin),
      pinLockedUntil: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.doc('settings/app'), DEFAULT_SETTINGS);
  });
  if (pin) await db.doc(`pins/${ref.id}`).set({ ...(await hashPin(pin)), fails: 0, lockedUntil: 0 });
  await getAuth().setCustomUserClaims(request.auth.uid, { memberId: ref.id });
  return { memberId: ref.id };
});

// Sign in with name + register PIN. Locks for 15 minutes after 5 wrong tries.
export const pinLogin = onCall(async (request) => {
  const key = nameKey(request.data?.name);
  const pin = String(request.data?.pin ?? '');
  if (!key || !PIN_PATTERN.test(pin)) {
    throw new HttpsError('invalid-argument', 'Enter your name and 4-digit PIN.');
  }
  const noMatch = "That name and PIN don't match.";
  const snap = await db.collection('members').where('nameKey', '==', key).get();
  const matches = snap.docs.filter((d) => d.data().active);
  if (matches.length !== 1) throw new HttpsError('permission-denied', noMatch);

  const member = matches[0];
  const pinRef = db.doc(`pins/${member.id}`);
  const result = await db.runTransaction(async (tx) => {
    const p = await tx.get(pinRef);
    if (!p.exists) return { ok: false, reason: 'wrong' };
    const record = p.data();
    const now = Date.now();
    if (record.lockedUntil > now) return { ok: false, reason: 'locked', until: record.lockedUntil };
    if (await pinMatches(pin, record)) {
      tx.update(pinRef, { fails: 0, lockedUntil: 0 });
      return { ok: true };
    }
    const fails = (record.fails ?? 0) + 1;
    if (fails >= MAX_PIN_TRIES) {
      tx.update(pinRef, { fails: 0, lockedUntil: now + PIN_LOCK_MS });
      return { ok: false, reason: 'locked', until: now + PIN_LOCK_MS, justLocked: true };
    }
    tx.update(pinRef, { fails });
    return { ok: false, reason: 'wrong', left: MAX_PIN_TRIES - fails };
  });

  if (result.reason === 'locked') {
    if (result.justLocked) await member.ref.update({ pinLockedUntil: result.until });
    const minutes = Math.max(1, Math.ceil((result.until - Date.now()) / 60000));
    throw new HttpsError(
      'resource-exhausted',
      `Too many wrong tries. PIN sign-in is locked for ${minutes} more minute${minutes === 1 ? '' : 's'}. A manager can unlock it sooner.`,
    );
  }
  if (!result.ok) {
    const hint = result.left ? ` ${result.left} ${result.left === 1 ? 'try' : 'tries'} left.` : '';
    throw new HttpsError('permission-denied', noMatch + hint);
  }
  if (member.data().pinLockedUntil) await member.ref.update({ pinLockedUntil: 0 });
  const token = await getAuth().createCustomToken(`pin-${member.id}`, { memberId: member.id });
  return { token };
});

// ---------- manager tools ----------

export const setPin = onCall(async (request) => {
  await requireManager(request);
  const memberId = String(request.data?.memberId ?? '');
  const pin = request.data?.pin ? String(request.data.pin) : '';
  const memberRef = db.doc(`members/${memberId}`);
  if (!(await memberRef.get()).exists) throw new HttpsError('not-found', 'That person no longer exists.');
  if (!pin) {
    await db.doc(`pins/${memberId}`).delete();
    await memberRef.update({ hasPin: false, pinLockedUntil: 0 });
    return { ok: true };
  }
  if (!PIN_PATTERN.test(pin)) throw new HttpsError('invalid-argument', 'The PIN must be 4 digits.');
  await db.doc(`pins/${memberId}`).set({ ...(await hashPin(pin)), fails: 0, lockedUntil: 0 });
  await memberRef.update({ hasPin: true, pinLockedUntil: 0 });
  return { ok: true };
});

export const unlockPin = onCall(async (request) => {
  await requireManager(request);
  const memberId = String(request.data?.memberId ?? '');
  const pinRef = db.doc(`pins/${memberId}`);
  if ((await pinRef.get()).exists) await pinRef.update({ fails: 0, lockedUntil: 0 });
  await db.doc(`members/${memberId}`).update({ pinLockedUntil: 0 });
  return { ok: true };
});

// ---------- swaps ----------

// The coworker answers a swap. Accepting trades the shifts right away.
export const respondSwap = onCall(async (request) => {
  const me = await callerMember(request);
  const requestId = String(request.data?.requestId ?? '');
  const accept = Boolean(request.data?.accept);
  const reqRef = db.doc(`requests/${requestId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(reqRef);
    if (!snap.exists) throw new HttpsError('not-found', 'That request no longer exists.');
    const rq = snap.data();
    if (rq.type !== 'swap' || rq.swapWithMemberId !== me.id) {
      throw new HttpsError('permission-denied', 'This swap was sent to someone else.');
    }
    if (rq.status !== 'pending') throw new HttpsError('failed-precondition', 'This swap was already answered or cancelled.');

    const now = FieldValue.serverTimestamp();
    if (!accept) {
      tx.update(reqRef, { status: 'declined', decidedBy: me.id, decidedAt: now });
      return;
    }

    const changed = 'One of these shifts changed after the swap was sent. Ask them to send a new one.';
    const aRef = db.doc(`shifts/${rq.shiftId}`);
    const a = await tx.get(aRef);
    if (!a.exists || a.data().deleted || a.data().memberId !== rq.memberId) {
      throw new HttpsError('failed-precondition', changed);
    }
    let bRef = null;
    if (rq.swapShiftId) {
      bRef = db.doc(`shifts/${rq.swapShiftId}`);
      const b = await tx.get(bRef);
      if (!b.exists || b.data().deleted || b.data().memberId !== me.id) {
        throw new HttpsError('failed-precondition', changed);
      }
    }
    tx.update(aRef, { memberId: me.id, updatedBy: me.id, updatedAt: now, via: 'swap' });
    if (bRef) tx.update(bRef, { memberId: rq.memberId, updatedBy: me.id, updatedAt: now, via: 'swap' });
    tx.update(reqRef, { status: 'accepted', decidedBy: me.id, decidedAt: now });
  });
  return { ok: true };
});

// ---------- change log + notifications ----------

const SHIFT_FIELDS = ['memberId', 'date', 'start', 'end', 'position', 'notes'];

function pickShift(s) {
  return {
    memberId: s.memberId ?? null,
    date: s.date,
    start: s.start,
    end: s.end,
    position: s.position ?? '',
    notes: s.notes ?? '',
  };
}

function nameOf(members, id) {
  return members[id]?.name ?? 'Someone';
}

// Everyone who chose "all changes" in Settings.
function allChangesFans(members) {
  return Object.values(members)
    .filter((m) => m.active && m.notify === 'all')
    .map((m) => m.id);
}

export const onShiftWritten = onDocumentWritten('shifts/{shiftId}', async (event) => {
  const beforeRaw = event.data.before.exists ? event.data.before.data() : null;
  const afterRaw = event.data.after.exists ? event.data.after.data() : null;
  // The app never truly deletes shifts (it marks them deleted), so a real delete
  // only comes from cleanup in the Firebase console. Don't log or announce those.
  if (!afterRaw) return;
  const before = beforeRaw && !beforeRaw.deleted ? pickShift(beforeRaw) : null;
  const after = afterRaw && !afterRaw.deleted ? pickShift(afterRaw) : null;
  if (!before && !after) return;
  if (before && after && SHIFT_FIELDS.every((f) => before[f] === after[f])) return;

  let action;
  if (!before) action = 'added';
  else if (!after) action = 'removed';
  else if (before.memberId !== after.memberId) action = 'reassigned';
  else if (before.date !== after.date || before.start !== after.start || before.end !== after.end) action = 'moved';
  else action = 'edited';

  const actorId = (afterRaw ?? beforeRaw).updatedBy ?? null;
  const via = afterRaw?.via ?? null;
  const memberIds = [...new Set([before?.memberId, after?.memberId].filter(Boolean))];

  await db.collection('changes').add({
    kind: 'shift',
    shiftId: event.params.shiftId,
    action,
    via,
    actorId,
    memberIds,
    before,
    after,
    createdAt: FieldValue.serverTimestamp(),
  });

  const members = await loadMembers();
  const actor = nameOf(members, actorId);
  const s = after ?? before;
  const whose = (id) => (!id ? 'an open' : id === actorId ? 'their own' : `${nameOf(members, id)}'s`);
  let body;
  if (action === 'added') body = `${actor} added ${whose(s.memberId)} shift: ${fmtShift(s)}`;
  else if (action === 'removed') body = `${actor} removed ${whose(s.memberId)} shift: ${fmtShift(s)}`;
  else if (action === 'reassigned') {
    if (via === 'swap') body = `${nameOf(members, after.memberId)} took ${nameOf(members, before.memberId)}'s shift in a swap: ${fmtShift(s)}`;
    else if (!after.memberId) body = `${nameOf(members, before.memberId)}'s shift is now open: ${fmtShift(s)}`;
    else if (!before.memberId) body = `${nameOf(members, after.memberId)} got the open shift: ${fmtShift(s)}`;
    else body = `${actor} moved ${nameOf(members, before.memberId)}'s shift to ${nameOf(members, after.memberId)}: ${fmtShift(s)}`;
  } else if (action === 'moved') body = `${actor} changed ${whose(s.memberId)} shift: ${fmtShift(before)} → ${fmtShift(after)}`;
  else body = `${actor} updated ${whose(s.memberId)} shift: ${fmtShift(s)}`;

  const recipients = [...memberIds, ...allChangesFans(members)];
  // A new open shift is something everyone might want to pick up.
  const newlyOpen = after && !after.memberId && (!before || before.memberId);
  if (newlyOpen) recipients.push(...Object.values(members).filter((m) => m.active).map((m) => m.id));

  await notify(
    recipients.filter((id) => id !== actorId),
    newlyOpen ? 'Open shift' : 'Schedule change',
    body,
    'changes',
  );
});

export const onTimeOffWritten = onDocumentWritten('timeOff/{id}', async (event) => {
  const beforeRaw = event.data.before.exists ? event.data.before.data() : null;
  const afterRaw = event.data.after.exists ? event.data.after.data() : null;
  if (!afterRaw) return;
  const before = beforeRaw && !beforeRaw.deleted ? beforeRaw : null;
  const after = afterRaw && !afterRaw.deleted ? afterRaw : null;
  if (!before && !after) return;
  if (before && after && before.startDate === after.startDate && before.endDate === after.endDate) return;

  const t = after ?? before;
  const action = !before ? 'added' : !after ? 'removed' : 'moved';
  const actorId = (afterRaw ?? beforeRaw).updatedBy ?? null;
  await db.collection('changes').add({
    kind: 'timeoff',
    timeOffId: event.params.id,
    action,
    actorId,
    memberIds: [t.memberId],
    before: before ? { memberId: before.memberId, startDate: before.startDate, endDate: before.endDate } : null,
    after: after ? { memberId: after.memberId, startDate: after.startDate, endDate: after.endDate } : null,
    createdAt: FieldValue.serverTimestamp(),
  });

  const members = await loadMembers();
  const who = nameOf(members, t.memberId);
  const body =
    action === 'removed'
      ? `${who}'s time off was removed: ${fmtRange(t.startDate, t.endDate)}`
      : `${who} is off ${fmtRange(t.startDate, t.endDate)}`;
  await notify(
    [t.memberId, ...allChangesFans(members)].filter((id) => id !== actorId),
    'Time off',
    body,
    'changes',
  );
});

const REQUEST_LABELS = {
  change: 'time change',
  drop: 'drop',
  timeoff: 'time off',
  pickup: 'open shift',
  swap: 'swap',
};

export const onRequestWritten = onDocumentWritten('requests/{id}', async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after) return;

  const members = await loadMembers();
  const requester = nameOf(members, after.memberId);
  const managers = Object.values(members)
    .filter((m) => m.active && m.role === 'manager')
    .map((m) => m.id);
  const when = after.shiftDate ? fmtDate(after.shiftDate) : '';

  if (!before) {
    if (after.type === 'swap') {
      await notify([after.swapWithMemberId], 'Swap request', `${requester} wants to swap their ${when} shift with you.`, 'requests');
      return;
    }
    const text = {
      change: `${requester} asked to change their ${when} shift.`,
      drop: `${requester} asked to drop their ${when} shift.`,
      timeoff: `${requester} asked for time off ${fmtRange(after.startDate ?? '', after.endDate ?? '')}.`,
      pickup: `${requester} wants the open shift on ${when}.`,
    }[after.type];
    await notify(managers.filter((id) => id !== after.memberId), 'New request', text, 'requests');
    return;
  }

  if (before.status === after.status) return;
  const label = REQUEST_LABELS[after.type];
  if (after.status === 'approved' || after.status === 'denied') {
    if (after.decidedBy !== after.memberId) {
      await notify([after.memberId], `Request ${after.status}`, `Your ${label} request was ${after.status}.`, 'requests');
    }
  } else if (after.status === 'accepted') {
    const coworker = nameOf(members, after.swapWithMemberId);
    await notify([after.memberId], 'Swap accepted', `${coworker} accepted your swap. The schedule is updated.`, 'requests');
    await notify(
      managers.filter((id) => id !== after.memberId && id !== after.swapWithMemberId),
      'Shifts swapped',
      `${requester} and ${coworker} swapped shifts (${when}).`,
      'changes',
    );
  } else if (after.status === 'declined') {
    const coworker = nameOf(members, after.swapWithMemberId);
    await notify([after.memberId], 'Swap declined', `${coworker} said no to your swap.`, 'requests');
  }
});
