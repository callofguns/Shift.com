// Settings: your profile, notifications, installing the app, and manager tools.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useData } from '../hooks/data';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import Segmented from '../components/Segmented';
import Sheet from '../components/Sheet';
import { Button, ErrorText, Field, SectionTitle, friendlyError } from '../components/ui';
import { useToast } from '../components/Toast';
import { Brand } from './Login';
import { isIOS, isInstalled, pushStatus, turnOffPush, turnOnPush } from '../lib/push';
import { installPrompt, onInstallPromptChange } from '../lib/install';
import { saveMember, saveSettings, setNotifyMode, setPin, unlockPin } from '../lib/actions';
import { fmtShiftTime } from '../lib/dates';
import { PERSON_COLORS } from '../lib/colors';
import { spring, tap } from '../lib/motion';

export default function More({ session }) {
  const { me, isManager, members } = useData();
  const [teamOpen, setTeamOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const signsInWith = session.user?.providerData?.[0]?.providerId;

  return (
    <>
      <header className="screen-head">
        <div>
          <p className="eyebrow">More</p>
          <h1 className="screen-title">Settings</h1>
        </div>
      </header>

      <div className="card profile">
        <Avatar member={me} size={52} />
        <div>
          <strong className="profile-name">{me.name}</strong>
          <span className="profile-sub">
            {isManager ? 'Manager' : 'Team member'} ·{' '}
            {signsInWith === 'google.com' ? 'Google' : signsInWith === 'password' ? session.user.email : 'Register PIN'}
          </span>
        </div>
      </div>

      <section className="block">
        <SectionTitle>Notifications</SectionTitle>
        <div className="card stack">
          <PushControl />
          <div className="field">
            <span className="field-label">Alert me about</span>
            <Segmented
              label="Alert me about"
              value={me.notify ?? 'mine'}
              onChange={(v) => setNotifyMode(me.id, v)}
              options={[
                { value: 'mine', label: 'My shifts' },
                { value: 'all', label: 'All changes' },
              ]}
            />
            <span className="field-hint">
              {me.notify === 'all'
                ? 'You’ll hear about every change to anyone’s shift.'
                : 'You’ll hear when your shifts change and when open shifts are posted.'}
              {isManager && ' Managers always hear about new requests.'}
            </span>
          </div>
        </div>
      </section>

      <InstallCard />

      {isManager && (
        <section className="block">
          <SectionTitle>Manager tools</SectionTitle>
          <div className="card list-card">
            <motion.button type="button" className="list-row" whileTap={tap} onClick={() => setTeamOpen(true)}>
              <Icon name="team" />
              <span>Team</span>
              <span className="list-value">{members.length} people</span>
              <Icon name="right" size={18} />
            </motion.button>
            <motion.button type="button" className="list-row" whileTap={tap} onClick={() => setSetupOpen(true)}>
              <Icon name="tag" />
              <span>Positions & quick picks</span>
              <Icon name="right" size={18} />
            </motion.button>
          </div>
        </section>
      )}

      <section className="block">
        <Button variant="secondary" onClick={session.logOut}>
          <Icon name="logout" size={18} /> Sign out
        </Button>
      </section>

      <footer className="more-foot">
        <Brand compact />
      </footer>

      <TeamSheet open={teamOpen} onClose={() => setTeamOpen(false)} />
      <SetupSheet open={setupOpen} onClose={() => setSetupOpen(false)} />
    </>
  );
}

function PushControl() {
  const { memberId } = useData();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    pushStatus().then(setStatus);
  }, []);

  if (!status) return null;

  const on = async () => {
    setBusy(true);
    setError('');
    try {
      setStatus(await turnOnPush(memberId));
    } catch (err) {
      setError(friendlyError(err));
    }
    setBusy(false);
  };

  const off = async () => {
    setBusy(true);
    await turnOffPush();
    setStatus('off');
    setBusy(false);
  };

  return (
    <div className="push">
      <div className="push-head">
        <Icon name="phone" />
        <div>
          <strong>Phone alerts</strong>
          <span className="field-hint">
            {
              {
                on: 'On for this phone.',
                off: 'Get an alert when the schedule changes, even when the app is closed.',
                blocked: 'Alerts are blocked. Turn on notifications for this app in your phone’s Settings.',
                'needs-install': 'On iPhone, add this app to your Home Screen first (see below), then open it from there.',
                unsupported: 'This browser can’t show alerts. Try Chrome on Android or Safari on iPhone.',
              }[status]
            }
          </span>
        </div>
      </div>
      {status === 'off' && (
        <Button onClick={on} busy={busy}>
          Turn on alerts
        </Button>
      )}
      {status === 'on' && (
        <Button variant="ghost" onClick={off} busy={busy}>
          Turn off for this phone
        </Button>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function InstallCard() {
  const [prompt, setPrompt] = useState(installPrompt);
  useEffect(() => onInstallPromptChange(setPrompt), []);
  if (isInstalled()) return null;

  if (isIOS()) {
    return (
      <section className="block">
        <SectionTitle>Add to Home Screen</SectionTitle>
        <ol className="card steps">
          <li>
            Open this page in <strong>Safari</strong>.
          </li>
          <li>
            Tap the Share button <Icon name="share" size={18} className="inline-icon" />.
          </li>
          <li>
            Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </li>
          <li>Open George’s AG from your Home Screen.</li>
        </ol>
      </section>
    );
  }
  if (!prompt) return null;
  return (
    <section className="block">
      <SectionTitle>Install the app</SectionTitle>
      <div className="card stack">
        <p className="lede">Put George’s AG on your home screen so it opens like a normal app.</p>
        <Button
          onClick={async () => {
            prompt.prompt();
            await prompt.userChoice;
          }}
        >
          Install
        </Button>
      </div>
    </section>
  );
}

// ---------- team ----------

function TeamSheet({ open, onClose }) {
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={editing === 'new' ? 'Add person' : editing ? 'Edit person' : 'Team'}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={editing ?? 'list'}
          initial={{ opacity: 0, x: editing ? 24 : -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: editing ? -24 : 24, transition: { duration: 0.12 } }}
          transition={spring}
        >
          {editing ? (
            <MemberForm id={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
          ) : (
            <TeamList onPick={setEditing} />
          )}
        </motion.div>
      </AnimatePresence>
    </Sheet>
  );
}

function TeamList({ onPick }) {
  const { membersById, memberId } = useData();
  const everyone = Object.values(membersById).sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
  );
  return (
    <div className="stack">
      <Button onClick={() => onPick('new')}>
        <Icon name="plus" size={18} strokeWidth={2.2} /> Add person
      </Button>
      <div className="list-card">
        {everyone.map((m) => (
          <motion.button key={m.id} type="button" whileTap={tap} className={`list-row ${m.active ? '' : 'is-off'}`} onClick={() => onPick(m.id)}>
            <Avatar member={m} size={34} />
            <span className="list-main">
              <strong>
                {m.name}
                {m.id === memberId && <span className="you-chip">You</span>}
              </strong>
              <span className="list-sub">
                {!m.active
                  ? 'Turned off'
                  : [m.role === 'manager' ? 'Manager' : 'Team member', m.hasPin ? 'PIN set' : 'No PIN', m.email].filter(Boolean).join(' · ')}
              </span>
            </span>
            {m.pinLockedUntil > Date.now() && <Icon name="lock" size={18} aria-label="PIN locked" />}
            <Icon name="right" size={18} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function MemberForm({ id, onDone }) {
  const { membersById, memberId } = useData();
  const toast = useToast();
  const existing = id ? membersById[id] : null;
  const isSelf = id === memberId;
  const used = new Set(Object.values(membersById).map((m) => m.color));
  const [form, setForm] = useState(() => ({
    name: existing?.name ?? '',
    email: existing?.email ?? '',
    role: existing?.role ?? 'employee',
    color: existing?.color ?? PERSON_COLORS.find((c) => !used.has(c)) ?? PERSON_COLORS[0],
    active: existing?.active ?? true,
  }));
  const [pin, setPinValue] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const locked = existing?.pinLockedUntil > Date.now();

  const save = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const others = Object.values(membersById).filter((m) => m.id !== id && m.active);
    if (!name) return setError('Enter a name.');
    if (others.some((m) => m.nameKey === name.toLowerCase().replace(/\s+/g, ' '))) {
      return setError('Someone already has that name. Add a last initial so PIN sign-in knows who’s who.');
    }
    if (email && others.some((m) => m.email === email)) return setError('Someone else already uses that email.');
    if (pin && !/^\d{4}$/.test(pin)) return setError('The PIN must be exactly 4 digits.');
    if (!email && !pin && !existing?.hasPin) return setError('Add an email or a register PIN so they can sign in.');
    setBusy('save');
    setError('');
    try {
      const savedId = await saveMember(id, { ...form, name, email });
      if (pin) await setPin(savedId, pin);
      toast(existing ? 'Saved' : `${name} added`);
      onDone();
    } catch (err) {
      setError(friendlyError(err));
      setBusy('');
    }
  };

  return (
    <form className="stack" onSubmit={save}>
      <button type="button" className="link back-link" onClick={onDone}>
        <Icon name="left" size={18} /> Team
      </button>
      <Field label="Name" hint="What they’ll type with their PIN, and what everyone sees on the schedule.">
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} autoCapitalize="words" required />
      </Field>
      <Field label="Email (optional)" hint="Lets them sign in with email or Google.">
        <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoCapitalize="off" />
      </Field>
      <Field
        label="Register PIN"
        hint={existing?.hasPin ? 'A PIN is set. Type a new one to change it, or leave blank to keep it.' : 'The 4 digits they use at the register.'}
      >
        <input
          className="input"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
          autoComplete="off"
          placeholder={existing?.hasPin ? '••••' : ''}
        />
      </Field>
      {locked && (
        <div className="warning">
          <strong>PIN sign-in is locked</strong> after too many wrong tries.{' '}
          <button
            type="button"
            className="link"
            onClick={async () => {
              await unlockPin(id);
              toast('PIN sign-in unlocked');
            }}
          >
            Unlock now
          </button>
        </div>
      )}
      <div className="field">
        <span className="field-label">Role</span>
        <Segmented
          label="Role"
          value={form.role}
          onChange={(role) => !isSelf && setForm({ ...form, role })}
          options={[
            { value: 'employee', label: 'Team member' },
            { value: 'manager', label: 'Manager' },
          ]}
        />
        <span className="field-hint">
          {isSelf ? 'You can’t change your own role.' : 'Managers can edit shifts, approve requests and manage the team.'}
        </span>
      </div>
      <div className="field">
        <span className="field-label">Color on the schedule</span>
        <div className="swatches" role="radiogroup" aria-label="Color">
          {PERSON_COLORS.map((c) => (
            <motion.button
              key={c}
              type="button"
              role="radio"
              aria-checked={form.color === c}
              aria-label={c}
              className={`swatch ${form.color === c ? 'on' : ''}`}
              style={{ '--c': c }}
              whileTap={{ scale: 0.85 }}
              onClick={() => setForm({ ...form, color: c })}
            />
          ))}
        </div>
      </div>
      {existing && !isSelf && (
        <label className="toggle-row">
          <span>
            <strong>Can sign in</strong>
            <span className="field-hint">Turn off when someone leaves. Their past shifts stay in the history.</span>
          </span>
          <input type="checkbox" className="toggle" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        </label>
      )}
      <ErrorText>{error}</ErrorText>
      <Button type="submit" busy={busy === 'save'}>
        {existing ? 'Save' : 'Add to team'}
      </Button>
      {existing?.hasPin && (
        <Button
          variant="ghost"
          busy={busy === 'pin'}
          onClick={async () => {
            setBusy('pin');
            await setPin(id, '');
            toast('PIN removed');
            setBusy('');
          }}
        >
          Remove their PIN
        </Button>
      )}
    </form>
  );
}

// ---------- positions & presets ----------

function SetupSheet({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Positions & quick picks">
      {open && <SetupForm onDone={onClose} />}
    </Sheet>
  );
}

function SetupForm({ onDone }) {
  const { settings } = useData();
  const toast = useToast();
  const [positions, setPositions] = useState(settings.positions);
  const [presets, setPresets] = useState(settings.presets);
  const [newPosition, setNewPosition] = useState('');
  const [preset, setPreset] = useState({ label: '', start: '08:00', end: '15:00' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addPosition = () => {
    const p = newPosition.trim();
    if (!p || positions.includes(p)) return;
    setPositions([...positions, p]);
    setNewPosition('');
  };

  const addPreset = () => {
    if (!preset.label.trim()) return setError('Give the quick pick a name, like “Morning”.');
    if (preset.end <= preset.start) return setError('The end time has to be after the start time.');
    setPresets([...presets, { ...preset, label: preset.label.trim(), id: `p${Date.now()}` }]);
    setPreset({ label: '', start: preset.start, end: preset.end });
    setError('');
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveSettings({ positions, presets });
      toast('Saved');
      onDone();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="field">
        <span className="field-label">Positions</span>
        <div className="chips">
          <AnimatePresence initial={false}>
            {positions.map((p) => (
              <motion.span key={p} className="chip on removable" layout initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={spring}>
                {p}
                <button type="button" aria-label={`Remove ${p}`} onClick={() => setPositions(positions.filter((x) => x !== p))}>
                  <Icon name="close" size={14} strokeWidth={2.4} />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <div className="add-row">
          <input
            className="input"
            placeholder="New position, e.g. Deli"
            value={newPosition}
            onChange={(e) => setNewPosition(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPosition())}
            maxLength={24}
          />
          <Button variant="secondary" onClick={addPosition}>
            Add
          </Button>
        </div>
      </div>

      <div className="field">
        <span className="field-label">Quick picks</span>
        <div className="stack-tight">
          <AnimatePresence initial={false}>
            {presets.map((p) => (
              <motion.div key={p.id} className="preset-row" layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }} transition={spring}>
                <strong>{p.label}</strong>
                <span>{fmtShiftTime(p)}</span>
                <button type="button" className="icon-btn" aria-label={`Remove ${p.label}`} onClick={() => setPresets(presets.filter((x) => x.id !== p.id))}>
                  <Icon name="close" size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="preset-new">
          <input className="input" placeholder="Name, e.g. Mid" value={preset.label} onChange={(e) => setPreset({ ...preset, label: e.target.value })} maxLength={16} />
          <input className="input" type="time" aria-label="Start" value={preset.start} onChange={(e) => setPreset({ ...preset, start: e.target.value })} />
          <input className="input" type="time" aria-label="End" value={preset.end} onChange={(e) => setPreset({ ...preset, end: e.target.value })} />
          <Button variant="secondary" onClick={addPreset}>
            Add
          </Button>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      <Button onClick={save} busy={busy}>
        Save
      </Button>
    </div>
  );
}
