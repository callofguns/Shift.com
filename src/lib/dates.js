// Dates are stored as "2026-10-21" (a "day key") and times as "15:00".
// Weeks start on Sunday. Times are shown in 12-hour format.

const pad = (n) => String(n).padStart(2, '0');

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

export const addDaysKey = (key, n) => toKey(addDays(fromKey(key), n));
export const todayKey = () => toKey(new Date());
export const startOfWeek = (date) => addDays(date, -date.getDay());
export const weekDays = (start) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

// Six rows of weeks covering the month, starting on a Sunday.
export function monthGrid(monthStart) {
  const first = startOfWeek(monthStart);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function splitTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { num: m === 0 ? String(hour) : `${hour}:${pad(m)}`, mer: h >= 12 ? 'PM' : 'AM' };
}

export function fmtTime(hhmm) {
  const t = splitTime(hhmm);
  return `${t.num} ${t.mer}`;
}

export const fmtShiftTime = (s) => `${fmtTime(s.start)}–${fmtTime(s.end)}`;

export function fmtDay(key, style = 'short') {
  const opts =
    style === 'long'
      ? { weekday: 'long', month: 'long', day: 'numeric' }
      : { weekday: 'short', month: 'short', day: 'numeric' };
  return fromKey(key).toLocaleDateString('en-US', opts);
}

export function fmtShortDate(key) {
  return fromKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtDateRange(a, b) {
  return a === b ? fmtDay(a) : `${fmtShortDate(a)} – ${fmtShortDate(b)}`;
}

// "Today", "Tomorrow", "Yesterday" or "Tue, Oct 21".
export function relativeDay(key) {
  const today = todayKey();
  if (key === today) return 'Today';
  if (key === addDaysKey(today, 1)) return 'Tomorrow';
  if (key === addDaysKey(today, -1)) return 'Yesterday';
  return fmtDay(key);
}

export function shiftHours(s) {
  const [h1, m1] = s.start.split(':').map(Number);
  const [h2, m2] = s.end.split(':').map(Number);
  return (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
}

export function fmtHours(h) {
  return Number.isInteger(h) ? `${h}` : h.toFixed(1);
}

export function timeAgo(date) {
  if (!date) return 'just now';
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const isInRange = (key, start, end) => key >= start && key <= end;
