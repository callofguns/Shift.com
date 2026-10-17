// The bar along the bottom. The green highlight springs to the tab you tap.
import { AnimatePresence, motion } from 'motion/react';
import { bouncy, spring } from '../lib/motion';
import Icon from './Icon';

export const TABS = [
  { id: 'schedule', label: 'Schedule', icon: 'calendar' },
  { id: 'mine', label: 'My shifts', icon: 'person' },
  { id: 'requests', label: 'Requests', icon: 'inbox' },
  { id: 'changes', label: 'Changes', icon: 'bell' },
  { id: 'more', label: 'More', icon: 'more' },
];

export default function TabBar({ current, onChange, badges }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const active = t.id === current;
        const count = badges[t.id] ?? 0;
        return (
          <button
            key={t.id}
            type="button"
            className={`tab ${active ? 'active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(t.id)}
          >
            {active && <motion.span layoutId="tab-pill" className="tab-pill" transition={spring} />}
            <motion.span className="tab-icon" animate={{ y: active ? -1 : 0, scale: active ? 1.06 : 1 }} transition={bouncy}>
              <Icon name={t.icon} size={23} strokeWidth={active ? 2.1 : 1.8} />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    className="tab-badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={bouncy}
                    aria-label={`${count} new`}
                  >
                    {count > 9 ? '9+' : count}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.span>
            <span className="tab-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
