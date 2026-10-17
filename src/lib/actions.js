// Everything that saves data lives here, so screens stay simple.
import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, call } from '../firebase';

function stamp(me) {
  return { updatedBy: me, updatedAt: serverTimestamp() };
}

// ---------- shifts (managers) ----------

export async function saveShift(id, shift, me) {
  const data = {
    memberId: shift.memberId || null,
    date: shift.date,
    start: shift.start,
    end: shift.end,
    position: shift.position || '',
    notes: (shift.notes || '').trim(),
    deleted: false,
    via: null,
    ...stamp(me),
  };
  if (id) await updateDoc(doc(db, 'shifts', id), data);
  else await addDoc(collection(db, 'shifts'), { ...data, createdAt: serverTimestamp() });
}

// Shifts are marked deleted instead of erased, so the change history stays complete.
export async function removeShift(id, me) {
  await updateDoc(doc(db, 'shifts', id), { deleted: true, via: null, ...stamp(me) });
}

export async function removeTimeOff(id, me) {
  await updateDoc(doc(db, 'timeOff', id), { deleted: true, ...stamp(me) });
}

// ---------- requests ----------

export async function sendRequest(request, me) {
  await addDoc(collection(db, 'requests'), {
    shiftId: null,
    shiftDate: null,
    change: null,
    startDate: null,
    endDate: null,
    swapWithMemberId: null,
    swapShiftId: null,
    note: '',
    ...request,
    memberId: me,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export async function cancelRequest(id, me) {
  await updateDoc(doc(db, 'requests', id), {
    status: 'cancelled',
    decidedBy: me,
    decidedAt: serverTimestamp(),
  });
}

export async function denyRequest(id, me) {
  await updateDoc(doc(db, 'requests', id), {
    status: 'denied',
    decidedBy: me,
    decidedAt: serverTimestamp(),
  });
}

// Approving updates the schedule and the request together, so they can't get out of sync.
export async function approveRequest(rq, me, otherPickups = []) {
  await runTransaction(db, async (tx) => {
    const reqRef = doc(db, 'requests', rq.id);
    const fresh = await tx.get(reqRef);
    if (!fresh.exists() || fresh.data().status !== 'pending') {
      throw new Error('This request was already handled.');
    }
    if (rq.type === 'timeoff') {
      tx.set(doc(collection(db, 'timeOff')), {
        memberId: rq.memberId,
        startDate: rq.startDate,
        endDate: rq.endDate,
        note: rq.note || '',
        deleted: false,
        ...stamp(me),
      });
    } else {
      const shiftRef = doc(db, 'shifts', rq.shiftId);
      const shift = await tx.get(shiftRef);
      if (!shift.exists() || shift.data().deleted) throw new Error('That shift was removed.');
      const s = shift.data();
      const base = { via: null, ...stamp(me) };
      if (rq.type === 'pickup') {
        if (s.memberId) throw new Error('Someone already has that shift.');
        tx.update(shiftRef, { memberId: rq.memberId, ...base });
      } else {
        if (s.memberId !== rq.memberId) throw new Error('That shift belongs to someone else now.');
        if (rq.type === 'drop') tx.update(shiftRef, { memberId: null, ...base });
        if (rq.type === 'change') {
          tx.update(shiftRef, { date: rq.change.date, start: rq.change.start, end: rq.change.end, ...base });
        }
      }
    }
    tx.update(reqRef, { status: 'approved', decidedBy: me, decidedAt: serverTimestamp() });
  });

  // Only one person can get an open shift, so everyone else who asked hears "no".
  if (rq.type === 'pickup' && otherPickups.length > 0) {
    const batch = writeBatch(db);
    otherPickups.forEach((o) =>
      batch.update(doc(db, 'requests', o.id), { status: 'denied', decidedBy: me, decidedAt: serverTimestamp() }),
    );
    await batch.commit();
  }
}

export function respondSwap(requestId, accept) {
  return call('respondSwap', { requestId, accept });
}

// ---------- team (managers) ----------

export async function saveMember(id, member) {
  const data = {
    name: member.name.trim(),
    nameKey: member.name.trim().toLowerCase().replace(/\s+/g, ' '),
    email: (member.email || '').trim().toLowerCase(),
    role: member.role,
    color: member.color,
    active: member.active,
  };
  if (id) {
    await updateDoc(doc(db, 'members', id), data);
    return id;
  }
  const ref = doc(collection(db, 'members'));
  await setDoc(ref, {
    ...data,
    notify: 'mine',
    hasPin: false,
    pinLockedUntil: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export const setPin = (memberId, pin) => call('setPin', { memberId, pin });
export const unlockPin = (memberId) => call('unlockPin', { memberId });

export async function setNotifyMode(me, mode) {
  await updateDoc(doc(db, 'members', me), { notify: mode });
}

export async function saveSettings(settings) {
  await setDoc(doc(db, 'settings', 'app'), settings);
}
