// The main calendar: who's working when. Week view (default) or month view.
// Swipe left/right to change weeks or months.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useData, useShifts } from '../hooks/data';
import ShiftTag from '../components/ShiftTag';
import Segmented from '../components/Segmented';
import Icon from '../components/Icon';
import { ShiftDetails, ShiftEditor, TimeOffDetails, timeOffFor } from './ShiftSheets';
import {
  addDays,
  addMonths,
  fromKey,
  isInRange,
  monthGrid,
  startOfMonth,
  startOfWeek,
  toKey,
  todayKey,
  weekDays,
} from '../lib/dates';
import { bouncy, spring, tap } from '../lib/motion';

const VIEW_KEY = 'georges.scheduleView';
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'month' ? 'month' : 'week';
  } catch {
    return 'week';
  }
}

function groupByDate(shifts) {
  const map = {};
  (shifts ?? []).forEach((s) => (map[s.date] ??= []).push(s));
  return map;
}

export default function Schedule() {
  const { isManager, timeOff } = useData();
  const [view, setViewState] = useState(readView);
  const [selected, setSelected] = useState(todayKey);
  const [direction, setDirection] = useState(0);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [offEntry, setOffEntry] = useState(null);

  const anchor = fromKey(selected);
  const weekStart = startOfWeek(anchor);
  const monthStart = startOfMonth(anchor);
  const grid = useMemo(() => monthGrid(monthStart), [monthStart.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const days = view === 'week' ? weekDays(weekStart) : grid;
  const rangeStart = toKey(days[0]);
  const rangeEnd = toKey(days[days.length - 1]);
  const shifts = useShifts(rangeStart, rangeEnd);
  const byDate = useMemo(() => groupByDate(shifts), [shifts]);
  const pageKey = view === 'week' ? rangeStart : toKey(monthStart);

  const setView = (v) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Not important if it isn't remembered.
    }
  };

  const step = (n) => {
    setDirection(n);
    setSelected(toKey(view === 'week' ? addDays(anchor, 7 * n) : addMonths(anchor, n)));
  };

  const goToday = () => {
    const t = todayKey();
    setDirection(t > selected ? 1 : t < selected ? -1 : 0);
    setSelected(t);
  };

  // When the schedule first loads, jump down to today if it's further down the week.
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || !shifts || view !== 'week') return;
    jumped.current = true;
    requestAnimationFrame(() => {
      const el = document.getElementById(`day-${todayKey()}`);
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.55) el.scrollIntoView({ block: 'start' });
    });
  }, [shifts, view]);

  // Keep the shift panel showing live data if someone else edits it while it's open.
  const liveViewing = viewing ? (shifts?.find((s) => s.id === viewing.id) ?? viewing) : null;

  const title =
    view === 'week'
      ? weekTitle(weekStart)
      : monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      <header className="screen-head">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1 className="screen-title">{title}</h1>
        </div>
        <Segmented
          small
          label="Calendar view"
          value={view}
          onChange={setView}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
      </header>

      <div className="range-bar">
        <motion.button type="button" className="icon-btn" whileTap={tap} onClick={() => step(-1)} aria-label={`Previous ${view}`}>
          <Icon name="left" />
        </motion.button>
        <motion.button type="button" className="today-btn" whileTap={tap} onClick={goToday}>
          Today
        </motion.button>
        <motion.button type="button" className="icon-btn" whileTap={tap} onClick={() => step(1)} aria-label={`Next ${view}`}>
          <Icon name="right" />
        </motion.button>
      </div>

      <motion.div
        className="swipe-area"
        drag="x"
        dragDirectionLock
        dragSnapToOrigin
        dragElastic={0.18}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -70 || info.velocity.x < -500) step(1);
          else if (info.offset.x > 70 || info.velocity.x > 500) step(-1);
        }}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={`${view}-${pageKey}`}
            custom={direction}
            variants={{
              enter: (d) => ({ opacity: 0, x: d * 60 }),
              center: { opacity: 1, x: 0 },
              exit: (d) => ({ opacity: 0, x: d * -60, transition: { duration: 0.14 } }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            {view === 'week' ? (
              <>
                <WeekStrip
                  days={days}
                  selected={selected}
                  byDate={byDate}
                  onPick={(key) => {
                    setSelected(key);
                    document.getElementById(`day-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                />
                <div className="day-list">
                  {days.map((d) => (
                    <DaySection
                      key={toKey(d)}
                      dateKey={toKey(d)}
                      shifts={byDate[toKey(d)]}
                      loading={!shifts}
                      timeOff={timeOff}
                      isManager={isManager}
                      onShift={setViewing}
                      onAdd={(date) => setEditing({ date })}
                      onTimeOff={setOffEntry}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <MonthGrid grid={grid} monthStart={monthStart} selected={selected} byDate={byDate} onPick={setSelected} />
                <div className="day-list">
                  <DaySection
                    dateKey={selected}
                    shifts={byDate[selected]}
                    loading={!shifts}
                    timeOff={timeOff}
                    isManager={isManager}
                    onShift={setViewing}
                    onAdd={(date) => setEditing({ date })}
                    onTimeOff={setOffEntry}
                  />
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {isManager && (
        <motion.button
          type="button"
          className="fab"
          aria-label="Add shift"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileTap={{ scale: 0.9 }}
          transition={bouncy}
          onClick={() => setEditing({ date: selected })}
        >
          <Icon name="plus" size={28} strokeWidth={2.4} />
        </motion.button>
      )}

      <ShiftDetails
        shift={liveViewing}
        onClose={() => setViewing(null)}
        onEdit={(s) => {
          setViewing(null);
          setEditing({ shift: s });
        }}
      />
      <ShiftEditor open={Boolean(editing)} onClose={() => setEditing(null)} shift={editing?.shift} date={editing?.date} />
      <TimeOffDetails entry={offEntry} onClose={() => setOffEntry(null)} />
    </>
  );
}

function weekTitle(start) {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const a = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const b = end.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${a} – ${b}`;
}

function Dots({ shifts, membersById }) {
  const list = (shifts ?? []).slice(0, 4);
  return (
    <span className="dots" aria-hidden="true">
      {list.map((s) => (
        <span key={s.id} className="dot" style={{ background: s.memberId ? membersById[s.memberId]?.color : 'var(--tag-yellow)' }} />
      ))}
    </span>
  );
}

function WeekStrip({ days, selected, byDate, onPick }) {
  const { membersById } = useData();
  const today = todayKey();
  return (
    <div className="week-strip" role="tablist" aria-label="Days this week">
      {days.map((d, i) => {
        const key = toKey(d);
        const on = key === selected;
        return (
          <motion.button
            key={key}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            className={`strip-day ${on ? 'on' : ''} ${key === today ? 'is-today' : ''}`}
            whileTap={tap}
            onClick={() => onPick(key)}
          >
            {on && <motion.span layoutId="strip-pill" className="strip-pill" transition={spring} />}
            <span className="strip-letter">{DAY_LETTERS[i]}</span>
            <span className="strip-num">{d.getDate()}</span>
            <Dots shifts={byDate[key]} membersById={membersById} />
          </motion.button>
        );
      })}
    </div>
  );
}

function MonthGrid({ grid, monthStart, selected, byDate, onPick }) {
  const { membersById } = useData();
  const today = todayKey();
  return (
    <div className="month">
      <div className="month-head" aria-hidden="true">
        {DAY_LETTERS.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="month-grid">
        {grid.map((d) => {
          const key = toKey(d);
          const on = key === selected;
          const inMonth = d.getMonth() === monthStart.getMonth();
          return (
            <motion.button
              key={key}
              type="button"
              whileTap={tap}
              className={`month-cell ${inMonth ? '' : 'is-outside'} ${on ? 'on' : ''} ${key === today ? 'is-today' : ''}`}
              aria-label={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              aria-pressed={on}
              onClick={() => onPick(key)}
            >
              {on && <motion.span layoutId="month-pill" className="month-pill" transition={spring} />}
              <span className="month-num">{d.getDate()}</span>
              <Dots shifts={byDate[key]} membersById={membersById} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function DaySection({ dateKey, shifts, loading, timeOff, isManager, onShift, onAdd, onTimeOff }) {
  const { membersById, memberId } = useData();
  const today = todayKey();
  const offToday = timeOff.filter((t) => isInRange(dateKey, t.startDate, t.endDate));
  const date = fromKey(dateKey);

  return (
    <section id={`day-${dateKey}`} className={`day ${dateKey < today ? 'is-past' : ''}`}>
      <div className="day-head">
        <h2>
          <span className="day-name">{date.toLocaleDateString('en-US', { weekday: 'long' })}</span>
          <span className="day-date">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          {dateKey === today && <span className="today-chip">Today</span>}
        </h2>
        {isManager && (
          <motion.button type="button" className="add-mini" whileTap={tap} onClick={() => onAdd(dateKey)} aria-label={`Add shift on ${date.toDateString()}`}>
            <Icon name="plus" size={18} strokeWidth={2.2} /> Add
          </motion.button>
        )}
      </div>
      {offToday.length > 0 && (
        <div className="off-row">
          {offToday.map((t) => (
            <motion.button key={t.id} type="button" whileTap={tap} className="off-chip" style={{ '--c': membersById[t.memberId]?.color }} onClick={() => onTimeOff(t)}>
              <Icon name="sun" size={16} /> {t.memberId === memberId ? 'You’re' : `${membersById[t.memberId]?.name ?? 'Someone'} is`} off
            </motion.button>
          ))}
        </div>
      )}
      <div className="tags">
        <AnimatePresence initial={false}>
          {(shifts ?? []).map((s) => (
            <ShiftTag
              key={s.id}
              shift={s}
              member={membersById[s.memberId]}
              isMe={s.memberId === memberId}
              conflict={s.memberId && Boolean(timeOffFor(timeOff, s.memberId, s.date))}
              onClick={() => onShift(s)}
            />
          ))}
        </AnimatePresence>
        {!loading && !shifts?.length && <p className="day-empty">No one scheduled</p>}
      </div>
    </section>
  );
}
