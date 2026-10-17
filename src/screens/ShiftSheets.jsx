// Pop-up panels for a single shift: details, editing, and sending requests about it.
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Sheet from '../components/Sheet';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import ShiftTag, { TagTime } from '../components/ShiftTag';
import { Button, ErrorText, Field, friendlyError } from '../components/ui';
import { useToast } from '../components/Toast';
import { useData, useShifts } from '../hooks/data';
import {
  approveRequest,
  cancelRequest,
  removeShift,
  removeTimeOff,
  saveShift,
  sendRequest,
} from '../lib/actions';
import {
  addDaysKey,
  fmtDateRange,
  fmtDay,
  fmtHours,
  fmtShiftTime,
  isInRange,
  shiftHours,
  todayKey,
} from '../lib/dates';
import { STATUS_LABELS } from '../lib/describe';
import { spring, tap } from '../lib/motion';

export function timeOffFor(timeOff, memberId, dateKey) {
  return timeOff.find((t) => t.memberId === memberId && isInRange(dateKey, t.startDate, t.endDate));
}

function snapshot(s) {
  return { date: s.date, start: s.start, end: s.end, position: s.position ?? '' };
}

// Date + preset buttons + start/end time. Used when adding shifts and asking for changes.
function WhenFields({ value, onChange, presets }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <>
      <Field label="Date">
        <input className="input" type="date" value={value.date} onChange={(e) => set({ date: e.target.value })} required />
      </Field>
      {presets.length > 0 && (
        <div className="field">
          <span className="field-label">Quick pick</span>
          <div className="chips">
            {presets.map((p) => {
              const on = p.start === value.start && p.end === value.end;
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  whileTap={tap}
                  className={`chip ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => set({ start: p.start, end: p.end })}
                >
                  {p.label} <span className="chip-sub">{fmtShiftTime(p)}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
      <div className="two-col">
        <Field label="Starts">
          <input className="input" type="time" value={value.start} onChange={(e) => set({ start: e.target.value })} required />
        </Field>
        <Field label="Ends">
          <input className="input" type="time" value={value.end} onChange={(e) => set({ end: e.target.value })} required />
        </Field>
      </div>
    </>
  );
}

function Warning({ children }) {
  return (
    <motion.div className="warning" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
      {children}
    </motion.div>
  );
}

// ---------- add / edit (managers) ----------

export function ShiftEditor({ open, onClose, shift, date }) {
  return (
    <Sheet open={open} onClose={onClose} title={shift ? 'Edit shift' : 'Add shift'}>
      {open && <ShiftEditorForm shift={shift} date={date} onDone={onClose} />}
    </Sheet>
  );
}

function ShiftEditorForm({ shift, date, onDone }) {
  const { members, membersById, settings, timeOff, memberId } = useData();
  const toast = useToast();
  const firstPreset = settings.presets[0];
  const [form, setForm] = useState(() => ({
    memberId: shift?.memberId ?? '',
    date: shift?.date ?? date ?? todayKey(),
    start: shift?.start ?? firstPreset?.start ?? '08:00',
    end: shift?.end ?? firstPreset?.end ?? '15:00',
    position: shift?.position ?? settings.positions[0] ?? '',
    notes: shift?.notes ?? '',
  }));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const sameDay = useShifts(form.date, form.date);

  const off = form.memberId ? timeOffFor(timeOff, form.memberId, form.date) : null;
  const overlap = form.memberId
    ? sameDay?.find(
        (s) => s.id !== shift?.id && s.memberId === form.memberId && s.start < form.end && form.start < s.end,
      )
    : null;
  const person = membersById[form.memberId];

  const save = async (e) => {
    e.preventDefault();
    if (form.end <= form.start) {
      setError('The end time has to be after the start time.');
      return;
    }
    setBusy('save');
    setError('');
    try {
      await saveShift(shift?.id, form, memberId);
      toast(shift ? 'Shift saved' : 'Shift added');
      onDone();
    } catch (err) {
      setError(friendlyError(err));
      setBusy('');
    }
  };

  const remove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setBusy('remove');
    try {
      await removeShift(shift.id, memberId);
      toast('Shift removed');
      onDone();
    } catch (err) {
      setError(friendlyError(err));
      setBusy('');
    }
  };

  return (
    <form className="stack" onSubmit={save}>
      <div className="field">
        <span className="field-label">Who</span>
        <div className="people-picker" role="radiogroup" aria-label="Who works this shift">
          <PersonOption
            on={!form.memberId}
            onClick={() => setForm({ ...form, memberId: '' })}
            label="Open shift"
            swatch="var(--tag-yellow)"
          />
          {members.map((m) => (
            <PersonOption
              key={m.id}
              on={form.memberId === m.id}
              onClick={() => setForm({ ...form, memberId: m.id })}
              label={m.name}
              member={m}
            />
          ))}
        </div>
      </div>
      <WhenFields value={form} onChange={setForm} presets={settings.presets} />
      {settings.positions.length > 0 && (
        <div className="field">
          <span className="field-label">Position</span>
          <div className="chips">
            {settings.positions.map((p) => (
              <motion.button
                key={p}
                type="button"
                whileTap={tap}
                className={`chip ${form.position === p ? 'on' : ''}`}
                aria-pressed={form.position === p}
                onClick={() => setForm({ ...form, position: form.position === p ? '' : p })}
              >
                {p}
              </motion.button>
            ))}
          </div>
        </div>
      )}
      <Field label="Note (optional)">
        <input
          className="input"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          maxLength={80}
          placeholder="e.g. Truck delivery at 10"
        />
      </Field>
      <AnimatePresence>
        {off && (
          <Warning key="off">
            <strong>{person?.name} has time off</strong> {fmtDateRange(off.startDate, off.endDate)}. You can still save
            this shift.
          </Warning>
        )}
        {overlap && (
          <Warning key="overlap">
            <strong>{person?.name} already works</strong> {fmtShiftTime(overlap)} that day.
          </Warning>
        )}
      </AnimatePresence>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" busy={busy === 'save'}>
        {shift ? 'Save changes' : 'Add shift'}
      </Button>
      {shift && (
        <Button variant="danger" onClick={remove} busy={busy === 'remove'}>
          {confirmRemove ? 'Tap again to remove' : 'Remove shift'}
        </Button>
      )}
    </form>
  );
}

function PersonOption({ on, onClick, label, member, swatch }) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={on}
      whileTap={tap}
      className={`person-option ${on ? 'on' : ''}`}
      onClick={onClick}
    >
      {member ? <Avatar member={member} size={30} /> : <span className="avatar avatar-open" style={{ '--c': swatch }} />}
      <span>{label}</span>
    </motion.button>
  );
}

// ---------- details + requests ----------

export function ShiftDetails({ shift, onClose, onEdit }) {
  return (
    <Sheet open={Boolean(shift)} onClose={onClose} title="Shift">
      {shift && <ShiftDetailsBody shift={shift} onClose={onClose} onEdit={onEdit} />}
    </Sheet>
  );
}

function ShiftDetailsBody({ shift, onClose, onEdit }) {
  const { membersById, memberId, isManager, requests, timeOff } = useData();
  const [step, setStep] = useState('view');
  const toast = useToast();
  const member = membersById[shift.memberId];
  const mine = shift.memberId === memberId;
  const open = !shift.memberId;
  const upcoming = shift.date >= todayKey();
  const myRequests = requests.filter(
    (r) => r.shiftId === shift.id && r.memberId === memberId && r.status === 'pending',
  );
  const pickupRequests = requests.filter((r) => r.shiftId === shift.id && r.type === 'pickup' && r.status === 'pending');
  const off = shift.memberId ? timeOffFor(timeOff, shift.memberId, shift.date) : null;

  const done = (message) => {
    toast(message);
    onClose();
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={step}
        className="stack"
        initial={{ opacity: 0, x: step === 'view' ? -24 : 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: step === 'view' ? 24 : -24, transition: { duration: 0.12 } }}
        transition={spring}
      >
        {step === 'view' && (
          <>
            <div className="detail-hero" style={{ '--c': open ? 'var(--tag-yellow)' : member?.color }}>
              <span className="detail-day">{fmtDay(shift.date, 'long')}</span>
              <TagTime start={shift.start} end={shift.end} size="big" />
              <span className="detail-hours">{fmtHours(shiftHours(shift))} hours</span>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Who</dt>
                <dd>
                  {open ? (
                    'Open shift (no one yet)'
                  ) : (
                    <span className="inline-person">
                      <Avatar member={member} size={24} /> {member?.name ?? 'Former team member'}
                      {mine && <span className="you-chip">You</span>}
                    </span>
                  )}
                </dd>
              </div>
              {shift.position && (
                <div>
                  <dt>Position</dt>
                  <dd>{shift.position}</dd>
                </div>
              )}
              {shift.notes && (
                <div>
                  <dt>Note</dt>
                  <dd>{shift.notes}</dd>
                </div>
              )}
            </dl>
            {off && (
              <Warning>
                <strong>{member?.name} has time off</strong> {fmtDateRange(off.startDate, off.endDate)}.
              </Warning>
            )}
            {myRequests.map((r) => (
              <div key={r.id} className="pending-note">
                <Icon name="clock" size={18} />
                <span>
                  You asked to {r.type === 'pickup' ? 'take this shift' : r.type === 'swap' ? 'swap this shift' : r.type === 'drop' ? 'drop this shift' : 'change this shift'}.{' '}
                  {STATUS_LABELS[r.status]}…
                </span>
                <button
                  type="button"
                  className="link"
                  onClick={async () => {
                    await cancelRequest(r.id, memberId);
                    toast('Request cancelled');
                  }}
                >
                  Cancel
                </button>
              </div>
            ))}
            {isManager && open && pickupRequests.length > 0 && (
              <div className="stack-tight">
                <span className="field-label">Want this shift</span>
                {pickupRequests.map((r) => (
                  <div key={r.id} className="pickup-row">
                    <span className="inline-person">
                      <Avatar member={membersById[r.memberId]} size={26} /> {membersById[r.memberId]?.name}
                    </span>
                    <Button
                      variant="secondary"
                      className="btn-small"
                      onClick={async () => {
                        try {
                          await approveRequest(r, memberId, pickupRequests.filter((o) => o.id !== r.id));
                          done(`Gave the shift to ${membersById[r.memberId]?.name}`);
                        } catch (err) {
                          toast({ title: friendlyError(err), tone: 'error' });
                        }
                      }}
                    >
                      Give it to them
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="stack">
              {isManager && (
                <Button onClick={() => onEdit(shift)}>{open ? 'Edit or assign shift' : 'Edit shift'}</Button>
              )}
              {!isManager && mine && upcoming && myRequests.length === 0 && (
                <>
                  <Button variant="secondary" onClick={() => setStep('change')}>
                    Ask to change the time
                  </Button>
                  <Button variant="secondary" onClick={() => setStep('swap')}>
                    Swap with a coworker
                  </Button>
                  <Button variant="secondary" onClick={() => setStep('drop')}>
                    Ask to drop this shift
                  </Button>
                </>
              )}
              {!isManager && open && upcoming && myRequests.length === 0 && (
                <Button
                  onClick={async () => {
                    try {
                      await sendRequest(
                        { type: 'pickup', shiftId: shift.id, shiftDate: shift.date, shift: snapshot(shift) },
                        memberId,
                      );
                      done('Sent! A manager will pick who gets it.');
                    } catch (err) {
                      toast({ title: friendlyError(err), tone: 'error' });
                    }
                  }}
                >
                  I want this shift
                </Button>
              )}
            </div>
          </>
        )}
        {step === 'change' && <ChangeForm shift={shift} onBack={() => setStep('view')} onSent={done} />}
        {step === 'drop' && <DropForm shift={shift} onBack={() => setStep('view')} onSent={done} />}
        {step === 'swap' && <SwapForm shift={shift} onBack={() => setStep('view')} onSent={done} />}
      </motion.div>
    </AnimatePresence>
  );
}

function BackLink({ onClick }) {
  return (
    <button type="button" className="link back-link" onClick={onClick}>
      <Icon name="left" size={18} /> Back
    </button>
  );
}

function ChangeForm({ shift, onBack, onSent }) {
  const { settings, memberId } = useData();
  const [when, setWhen] = useState({ date: shift.date, start: shift.start, end: shift.end });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (e) => {
    e.preventDefault();
    if (when.end <= when.start) return setError('The end time has to be after the start time.');
    if (when.date === shift.date && when.start === shift.start && when.end === shift.end) {
      return setError('Pick a different day or time first.');
    }
    setBusy(true);
    try {
      await sendRequest(
        { type: 'change', shiftId: shift.id, shiftDate: shift.date, shift: snapshot(shift), change: when, note: note.trim() },
        memberId,
      );
      onSent('Request sent to the managers');
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={send}>
      <BackLink onClick={onBack} />
      <p className="lede">
        Now: <strong>{fmtDay(shift.date)} · {fmtShiftTime(shift)}</strong>. Pick the time you’d like instead.
      </p>
      <WhenFields value={when} onChange={setWhen} presets={settings.presets} />
      <Field label="Why? (optional)">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" busy={busy}>
        Send request
      </Button>
    </form>
  );
}

function DropForm({ shift, onBack, onSent }) {
  const { memberId } = useData();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await sendRequest(
        { type: 'drop', shiftId: shift.id, shiftDate: shift.date, shift: snapshot(shift), note: note.trim() },
        memberId,
      );
      onSent('Request sent to the managers');
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={send}>
      <BackLink onClick={onBack} />
      <p className="lede">
        If a manager says yes, <strong>{fmtDay(shift.date)} · {fmtShiftTime(shift)}</strong> becomes an open shift
        someone else can take.
      </p>
      <Field label="Why? (optional)">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" busy={busy}>
        Ask to drop it
      </Button>
    </form>
  );
}

function SwapForm({ shift, onBack, onSent }) {
  const { members, membersById, memberId } = useData();
  const [withId, setWithId] = useState('');
  const [theirShiftId, setTheirShiftId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const today = todayKey();
  const soon = useShifts(today, addDaysKey(today, 42));
  const theirShifts = useMemo(() => (soon ?? []).filter((s) => s.memberId === withId), [soon, withId]);
  useEffect(() => setTheirShiftId(''), [withId]);

  const send = async (e) => {
    e.preventDefault();
    if (!withId) return setError('Pick a coworker first.');
    setBusy(true);
    const theirs = theirShifts.find((s) => s.id === theirShiftId);
    try {
      await sendRequest(
        {
          type: 'swap',
          shiftId: shift.id,
          shiftDate: shift.date,
          shift: snapshot(shift),
          swapWithMemberId: withId,
          swapShiftId: theirs?.id ?? null,
          swapShift: theirs ? snapshot(theirs) : null,
          note: note.trim(),
        },
        memberId,
      );
      onSent(`Sent to ${membersById[withId]?.name}`);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={send}>
      <BackLink onClick={onBack} />
      <p className="lede">
        Your shift: <strong>{fmtDay(shift.date)} · {fmtShiftTime(shift)}</strong>. If they say yes, the schedule
        updates right away and the managers get a heads-up.
      </p>
      <div className="field">
        <span className="field-label">Swap with</span>
        <div className="people-picker" role="radiogroup" aria-label="Coworker">
          {members
            .filter((m) => m.id !== memberId)
            .map((m) => (
              <PersonOption key={m.id} on={withId === m.id} onClick={() => setWithId(m.id)} label={m.name} member={m} />
            ))}
        </div>
      </div>
      <AnimatePresence>
        {withId && (
          <motion.div
            className="field"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring}
          >
            <span className="field-label">What do you give them back?</span>
            <div className="stack-tight">
              <motion.button
                type="button"
                whileTap={tap}
                className={`choice ${theirShiftId === '' ? 'on' : ''}`}
                onClick={() => setTheirShiftId('')}
              >
                Nothing. Just ask them to cover my shift
              </motion.button>
              {theirShifts.map((s) => (
                <motion.button
                  key={s.id}
                  type="button"
                  whileTap={tap}
                  className={`choice ${theirShiftId === s.id ? 'on' : ''}`}
                  onClick={() => setTheirShiftId(s.id)}
                >
                  I’ll take their {fmtDay(s.date)} · {fmtShiftTime(s)}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Field label="Message (optional)">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" busy={busy}>
        Send swap request
      </Button>
    </form>
  );
}

// ---------- time off ----------

export function TimeOffRequest({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Request time off">
      {open && <TimeOffForm onDone={onClose} />}
    </Sheet>
  );
}

function TimeOffForm({ onDone }) {
  const { memberId } = useData();
  const toast = useToast();
  const tomorrow = addDaysKey(todayKey(), 1);
  const [startDate, setStart] = useState(tomorrow);
  const [endDate, setEnd] = useState(tomorrow);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (e) => {
    e.preventDefault();
    if (endDate < startDate) return setError('The last day can’t be before the first day.');
    setBusy(true);
    try {
      await sendRequest({ type: 'timeoff', startDate, endDate, note: note.trim() }, memberId);
      toast('Request sent to the managers');
      onDone();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={send}>
      <div className="two-col">
        <Field label="First day off">
          <input
            className="input"
            type="date"
            value={startDate}
            min={todayKey()}
            onChange={(e) => {
              setStart(e.target.value);
              if (endDate < e.target.value) setEnd(e.target.value);
            }}
            required
          />
        </Field>
        <Field label="Last day off">
          <input className="input" type="date" value={endDate} min={startDate} onChange={(e) => setEnd(e.target.value)} required />
        </Field>
      </div>
      <Field label="Reason (optional)">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" busy={busy}>
        Send request
      </Button>
    </form>
  );
}

export function TimeOffDetails({ entry, onClose }) {
  const { membersById, isManager, memberId } = useData();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const member = entry ? membersById[entry.memberId] : null;
  return (
    <Sheet open={Boolean(entry)} onClose={onClose} title="Time off">
      {entry && (
        <div className="stack">
          <p className="lede">
            <span className="inline-person">
              <Avatar member={member} size={26} /> <strong>{member?.name}</strong>
            </span>{' '}
            is off {fmtDateRange(entry.startDate, entry.endDate)}.
          </p>
          {entry.note && <p className="quote">“{entry.note}”</p>}
          {isManager && (
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm) return setConfirm(true);
                await removeTimeOff(entry.id, memberId);
                toast('Time off removed');
                onClose();
              }}
            >
              {confirm ? 'Tap again to remove' : 'Remove time off'}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

export { ShiftTag };
