// Turns stored changes and requests into plain sentences.
// "parts" lets screens show names in bold; "You"/"your" is used for the person reading.
import { fmtDateRange, fmtDay, fmtShiftTime } from './dates';

const name = (members, id) => members[id]?.name ?? 'Someone';

function person(members, id, me, capital = true) {
  if (id === me) return { who: id, text: capital ? 'You' : 'you' };
  return { who: id, text: name(members, id) };
}

function whose(members, id, me, actorId) {
  if (!id) return { text: 'an open' };
  if (id === me) return { text: actorId === me ? 'your own' : 'your' };
  if (id === actorId) return { text: 'their own' };
  return { who: id, text: `${name(members, id)}’s` };
}

export function shiftLine(s) {
  return [fmtDay(s.date), fmtShiftTime(s), s.position].filter(Boolean).join(' · ');
}

export function changeTouches(c, me) {
  return (c.memberIds ?? []).includes(me) || (c.kind === 'shift' && c.after && !c.after.memberId);
}

export function describeChange(c, members, me) {
  const actor = person(members, c.actorId, me);
  if (c.kind === 'timeoff') {
    const t = c.after ?? c.before;
    const range = fmtDateRange(t.startDate, t.endDate);
    if (c.action === 'removed') {
      return { parts: [actor, ' removed ', whose(members, t.memberId, me, c.actorId), ' time off'], detail: range };
    }
    const subject = person(members, t.memberId, me);
    return { parts: [subject, subject.text === 'You' ? '’re off' : ' is off'], detail: range };
  }

  const b = c.before;
  const a = c.after;
  const s = a ?? b;
  switch (c.action) {
    case 'added':
      return { parts: [actor, ' added ', whose(members, s.memberId, me, c.actorId), ' shift'], detail: shiftLine(s) };
    case 'removed':
      return { parts: [actor, ' removed ', whose(members, s.memberId, me, c.actorId), ' shift'], detail: shiftLine(s) };
    case 'reassigned':
      if (c.via === 'swap') {
        return {
          parts: [person(members, a.memberId, me), ' took ', whose(members, b.memberId, me), ' shift in a swap'],
          detail: shiftLine(s),
        };
      }
      if (!a.memberId) {
        const w = whose(members, b.memberId, me);
        return { parts: [{ ...w, text: w.text[0].toUpperCase() + w.text.slice(1) }, ' shift is now open'], detail: shiftLine(s) };
      }
      if (!b.memberId) {
        return { parts: [actor, ' gave the open shift to ', person(members, a.memberId, me, false)], detail: shiftLine(s) };
      }
      return {
        parts: [actor, ' moved ', whose(members, b.memberId, me), ' shift to ', person(members, a.memberId, me, false)],
        detail: shiftLine(s),
      };
    case 'moved':
      return {
        parts: [actor, ' changed ', whose(members, s.memberId, me, c.actorId), ' shift'],
        detail: `${fmtDay(b.date)} ${fmtShiftTime(b)} → ${b.date === a.date ? '' : fmtDay(a.date) + ' '}${fmtShiftTime(a)}`,
      };
    default:
      return { parts: [actor, ' updated ', whose(members, s.memberId, me, c.actorId), ' shift'], detail: shiftLine(s) };
  }
}

export function changeSentence(c, members, me) {
  const d = describeChange(c, members, me);
  return `${d.parts.map((p) => (typeof p === 'string' ? p : p.text)).join('')}: ${d.detail}`;
}

export const REQUEST_TITLES = {
  change: 'Time change',
  drop: 'Drop shift',
  timeoff: 'Time off',
  pickup: 'Open shift',
  swap: 'Swap',
};

export const STATUS_LABELS = {
  pending: 'Waiting',
  approved: 'Approved',
  denied: 'Denied',
  cancelled: 'Cancelled',
  accepted: 'Accepted',
  declined: 'Declined',
};

// One line describing what a request is asking for.
export function requestSummary(rq, members, me) {
  const s = rq.shift;
  switch (rq.type) {
    case 'change':
      return `${fmtDay(s.date)} ${fmtShiftTime(s)} → ${rq.change.date === s.date ? '' : fmtDay(rq.change.date) + ' '}${fmtShiftTime(rq.change)}`;
    case 'drop':
      return `Can’t work ${shiftLine(s)}`;
    case 'timeoff':
      return `Off ${fmtDateRange(rq.startDate, rq.endDate)}`;
    case 'pickup':
      return `Wants ${shiftLine(s)}`;
    case 'swap': {
      // Two plain lines: who would work which shift after the swap.
      const fromName = rq.memberId === me ? 'You' : name(members, rq.memberId);
      const toName = rq.swapWithMemberId === me ? 'You' : name(members, rq.swapWithMemberId);
      const lines = [`${toName} would work ${shiftLine(s)}`];
      if (rq.swapShift) lines.push(`${fromName} would work ${shiftLine(rq.swapShift)}`);
      else lines.push(`${fromName} would be off`);
      return lines.join('\n');
    }
    default:
      return '';
  }
}
