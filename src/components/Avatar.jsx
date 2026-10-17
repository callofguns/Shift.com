import { initials } from '../lib/colors';

export default function Avatar({ member, size = 36 }) {
  return (
    <span
      className="avatar"
      style={{ '--c': member?.color ?? '#8A958D', width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(member?.name)}
    </span>
  );
}
