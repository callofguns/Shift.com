// A two-or-three-way switch, like "Week | Month". The highlight springs between options.
import { useId } from 'react';
import { motion } from 'motion/react';
import { spring } from '../lib/motion';

export default function Segmented({ options, value, onChange, label, small }) {
  const id = useId();
  return (
    <div className={`segmented ${small ? 'segmented-small' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="segmented-pill" transition={spring} />}
          <span className="segmented-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
