// Colors people can pick for themselves on the calendar.
// Each one is readable as a stripe in both light and dark mode.
export const PERSON_COLORS = [
  '#1E7A46', // grocer green
  '#2F6FDE', // blue
  '#D2552C', // tomato
  '#8B4FD8', // plum
  '#C9862B', // honey
  '#0E8C8C', // teal
  '#D23F7E', // berry
  '#5B6B2F', // olive
];

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
