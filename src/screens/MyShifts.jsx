// Your own upcoming shifts, open shifts you could pick up, and your time off.
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useData, useShifts } from '../hooks/data';
import ShiftTag, { TagTime } from '../components/ShiftTag';
import { Button, Empty, SectionTitle } from '../components/ui';
import Icon from '../components/Icon';
import { ShiftDetails, ShiftEditor, TimeOffRequest, TimeOffDetails } from './ShiftSheets';
import {
  addDaysKey,
  fmtDateRange,
  fmtHours,
  relativeDay,
  shiftHours,
  startOfWeek,
  toKey,
  todayKey,
} from '../lib/dates';
import { spring, tap } from '../lib/motion';

export default function MyShifts() {
  const { me, memberId, membersById, timeOff, requests } = useData();
  const today = todayKey();
  const weekStartKey = toKey(startOfWeek(new Date()));
  const shifts = useShifts(weekStartKey < today ? weekStartKey : today, addDaysKey(today, 62));
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [askOff, setAskOff] = useState(false);
  const [offEntry, setOffEntry] = useState(null);

  const mine = useMemo(() => (shifts ?? []).filter((s) => s.memberId === memberId), [shifts, memberId]);
  const upcoming = mine.filter((s) => s.date >= today);
  const next = upcoming[0];
  const weekEnd = addDaysKey(weekStartKey, 6);
  const thisWeek = mine.filter((s) => s.date >= weekStartKey && s.date <= weekEnd);
  const weekHours = thisWeek.reduce((sum, s) => sum + shiftHours(s), 0);
  const openShifts = (shifts ?? []).filter((s) => !s.memberId && s.date >= today);
  const myOff = timeOff.filter((t) => t.memberId === memberId && t.endDate >= today);
  const pendingOff = requests.filter((r) => r.type === 'timeoff' && r.memberId === memberId && r.status === 'pending');
  const firstName = me.name.split(' ')[0];

  const groups = useMemo(() => {
    const map = new Map();
    upcoming.slice(1).forEach((s) => {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date).push(s);
    });
    return [...map.entries()];
  }, [upcoming]);

  const liveViewing = viewing ? (shifts?.find((s) => s.id === viewing.id) ?? viewing) : null;

  return (
    <>
      <header className="screen-head">
        <div>
          <p className="eyebrow">My shifts</p>
          <h1 className="screen-title">Hi, {firstName}</h1>
        </div>
      </header>

      {shifts && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
          {next ? (
            <motion.button
              type="button"
              className="next-card"
              style={{ '--c': me.color }}
              whileTap={tap}
              onClick={() => setViewing(next)}
            >
              <span className="next-label">Next shift · {relativeDay(next.date)}</span>
              <TagTime start={next.start} end={next.end} size="big" />
              <span className="next-meta">{[next.position, next.notes].filter(Boolean).join(' · ') || ' '}</span>
              <span className="tag-hole next-hole" aria-hidden="true" />
            </motion.button>
          ) : (
            <Empty icon={<Icon name="calendar" size={30} />} title="No upcoming shifts">
              When a manager schedules you, it shows up here.
            </Empty>
          )}

          <div className="stat-row">
            <div className="stat">
              <span className="stat-num">{fmtHours(weekHours)}</span>
              <span className="stat-label">hours this week</span>
            </div>
            <div className="stat">
              <span className="stat-num">{thisWeek.length}</span>
              <span className="stat-label">{thisWeek.length === 1 ? 'shift' : 'shifts'} this week</span>
            </div>
          </div>
        </motion.div>
      )}

      {groups.length > 0 && (
        <section className="block">
          <SectionTitle>Coming up</SectionTitle>
          {groups.map(([date, list]) => (
            <div key={date} className="mini-day">
              <span className="mini-day-label">{relativeDay(date)}</span>
              <div className="tags">
                {list.map((s) => (
                  <ShiftTag key={s.id} shift={s} member={me} isMe onClick={() => setViewing(s)} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <AnimatePresence>
        {openShifts.length > 0 && (
          <motion.section className="block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SectionTitle>Open shifts</SectionTitle>
            <p className="section-hint">Tap one to ask for it. A manager picks who gets it.</p>
            {openShifts.map((s) => (
              <div key={s.id} className="mini-day">
                <span className="mini-day-label">{relativeDay(s.date)}</span>
                <ShiftTag
                  shift={s}
                  onClick={() => setViewing(s)}
                  badge={requests.some((r) => r.shiftId === s.id && r.memberId === memberId && r.status === 'pending') ? 'Asked' : null}
                />
              </div>
            ))}
          </motion.section>
        )}
      </AnimatePresence>

      <section className="block">
        <SectionTitle
          action={
            <Button variant="ghost" className="btn-small" onClick={() => setAskOff(true)}>
              Request time off
            </Button>
          }
        >
          Time off
        </SectionTitle>
        {myOff.length === 0 && pendingOff.length === 0 && <p className="section-hint">No time off coming up.</p>}
        <div className="stack-tight">
          {myOff.map((t) => (
            <motion.button
              key={t.id}
              type="button"
              whileTap={tap}
              className="off-chip off-chip-wide"
              style={{ '--c': membersById[memberId]?.color }}
              onClick={() => setOffEntry(t)}
            >
              <Icon name="sun" size={16} /> Off {fmtDateRange(t.startDate, t.endDate)}
              <span className="status status-approved">Approved</span>
            </motion.button>
          ))}
          {pendingOff.map((r) => (
            <div key={r.id} className="off-chip off-chip-wide is-pending">
              <Icon name="clock" size={16} /> Off {fmtDateRange(r.startDate, r.endDate)}
              <span className="status status-pending">Waiting</span>
            </div>
          ))}
        </div>
      </section>

      <ShiftDetails
        shift={liveViewing}
        onClose={() => setViewing(null)}
        onEdit={(s) => {
          setViewing(null);
          setEditing(s);
        }}
      />
      <ShiftEditor open={Boolean(editing)} shift={editing} onClose={() => setEditing(null)} />
      <TimeOffRequest open={askOff} onClose={() => setAskOff(false)} />
      <TimeOffDetails entry={offEntry} onClose={() => setOffEntry(null)} />
    </>
  );
}
