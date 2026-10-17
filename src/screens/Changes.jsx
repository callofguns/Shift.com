// Recent changes to the schedule, newest first.
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useData } from '../hooks/data';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import Segmented from '../components/Segmented';
import { Empty } from '../components/ui';
import { changeTouches, describeChange } from '../lib/describe';
import { relativeDay, timeAgo, toKey } from '../lib/dates';
import { spring } from '../lib/motion';

const FILTER_KEY = 'georges.changesFilter';

export default function Changes() {
  const { changes, changesLoaded, membersById, memberId, markChangesSeen, seenAt } = useData();
  const [since] = useState(seenAt);
  const [filter, setFilterState] = useState(() => {
    try {
      return localStorage.getItem(FILTER_KEY) === 'mine' ? 'mine' : 'all';
    } catch {
      return 'all';
    }
  });

  // Opening this screen clears the red badge.
  useEffect(() => {
    markChangesSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changes.length]);

  const setFilter = (f) => {
    setFilterState(f);
    try {
      localStorage.setItem(FILTER_KEY, f);
    } catch {
      // Not important if it isn't remembered.
    }
  };

  const shown = filter === 'mine' ? changes.filter((c) => changeTouches(c, memberId)) : changes;

  const groups = useMemo(() => {
    const map = new Map();
    shown.forEach((c) => {
      const key = c.createdAt ? toKey(c.createdAt.toDate()) : toKey(new Date());
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    return [...map.entries()];
  }, [shown]);

  return (
    <>
      <header className="screen-head">
        <div>
          <p className="eyebrow">Changes</p>
          <h1 className="screen-title">What’s new</h1>
        </div>
        <Segmented
          small
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'mine', label: 'Mine' },
          ]}
        />
      </header>

      {changesLoaded && shown.length === 0 && (
        <Empty icon={<Icon name="bell" size={30} />} title={filter === 'mine' ? 'No changes to your shifts' : 'No changes yet'}>
          When someone adds, moves or removes a shift, it shows up here.
        </Empty>
      )}

      {groups.map(([day, list]) => (
        <section key={day} className="block">
          <h3 className="feed-day">{relativeDay(day)}</h3>
          <ol className="feed">
            <AnimatePresence initial={false}>
              {list.map((c) => {
                const d = describeChange(c, membersById, memberId);
                const fresh = (c.createdAt?.toMillis?.() ?? Date.now()) > since && c.actorId !== memberId;
                const touchesMe = changeTouches(c, memberId);
                return (
                  <motion.li
                    key={c.id}
                    layout
                    className={`feed-item ${touchesMe ? 'is-mine' : ''}`}
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={spring}
                  >
                    <Avatar member={membersById[c.actorId]} size={34} />
                    <div className="feed-text">
                      <p>
                        {d.parts.map((p, i) =>
                          typeof p === 'string' ? <span key={i}>{p}</span> : <strong key={i}>{p.text}</strong>,
                        )}
                      </p>
                      <span className="feed-detail">{d.detail}</span>
                    </div>
                    <span className="feed-time">
                      {fresh && <span className="new-dot" aria-label="New" />}
                      {timeAgo(c.createdAt?.toDate?.())}
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        </section>
      ))}
    </>
  );
}
