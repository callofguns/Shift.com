// Small helpers for turning stored dates/times into friendly text for notifications.
// Dates are stored as "2026-10-21" and times as "15:00".

export function fmtDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function fmtShortDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function fmtShift(s) {
  return `${fmtDate(s.date)}, ${fmtTime(s.start)}–${fmtTime(s.end)}`;
}

export function fmtRange(startDate, endDate) {
  return startDate === endDate ? fmtDate(startDate) : `${fmtShortDate(startDate)} – ${fmtShortDate(endDate)}`;
}
