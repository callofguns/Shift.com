// A shift drawn like a grocery shelf tag: colored notch for the person,
// a punched hole, and the hours in big tag numbers.
import { motion } from 'motion/react';
import { splitTime } from '../lib/dates';
import { spring, tap } from '../lib/motion';

export function TagTime({ start, end, size }) {
  const a = splitTime(start);
  const b = splitTime(end);
  return (
    <span className={`tag-time ${size === 'big' ? 'tag-time-big' : ''}`}>
      <span className="num">{a.num}</span>
      <span className="mer">{a.mer}</span>
      <span className="dash">–</span>
      <span className="num">{b.num}</span>
      <span className="mer">{b.mer}</span>
    </span>
  );
}

export default function ShiftTag({ shift, member, isMe, onClick, badge, conflict }) {
  const open = !shift.memberId;
  return (
    <motion.button
      type="button"
      layout
      className={`shift-tag ${open ? 'is-open' : ''} ${isMe ? 'is-me' : ''}`}
      style={{ '--c': open ? 'var(--tag-yellow)' : member?.color ?? '#8A958D' }}
      onClick={onClick}
      whileTap={tap}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={spring}
    >
      <span className="tag-notch" aria-hidden="true">
        <span className="tag-hole" />
      </span>
      <TagTime start={shift.start} end={shift.end} />
      <span className="tag-who">
        <span className="tag-name">
          {open ? 'Open shift' : member?.name ?? 'Former team member'}
          {isMe && <span className="you-chip">You</span>}
        </span>
        <span className="tag-meta">
          {[shift.position, shift.notes].filter(Boolean).join(' · ') || ' '}
        </span>
      </span>
      {badge && <span className="tag-badge">{badge}</span>}
      {conflict && <span className="tag-badge tag-badge-warn">Time off</span>}
    </motion.button>
  );
}
