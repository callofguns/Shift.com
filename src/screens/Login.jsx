import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { auth, call } from '../firebase';
import Segmented from '../components/Segmented';
import { Button, ErrorText, Field, friendlyError } from '../components/ui';
import { GoogleMark } from '../components/Icon';
import { useToast } from '../components/Toast';
import { bouncy, spring } from '../lib/motion';

const LAST_NAME_KEY = 'georges.lastName';

export function Brand({ compact }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <motion.img
        src="/logo-mark.svg"
        alt=""
        className="brand-mark"
        initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={bouncy}
      />
      <div>
        <h1 className="brand-name">George’s AG</h1>
        <p className="brand-sub">Super Value · Enfield, NH</p>
      </div>
    </div>
  );
}

export default function Login() {
  const [mode, setMode] = useState('pin');
  return (
    <motion.div
      className="gate"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={spring}
    >
      <Brand />
      <p className="gate-lede">Sign in to see the schedule.</p>
      <Segmented
        label="How to sign in"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'pin', label: 'Register PIN' },
          { value: 'email', label: 'Email or Google' },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={{ opacity: 0, x: mode === 'pin' ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: mode === 'pin' ? 20 : -20, transition: { duration: 0.12 } }}
          transition={spring}
        >
          {mode === 'pin' ? <PinForm /> : <EmailForm />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function readLastName() {
  try {
    return localStorage.getItem(LAST_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function PinForm() {
  const [name, setName] = useState(readLastName);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [boxes, animate] = useAnimate();
  const pinInput = useRef(null);
  const nameInput = useRef(null);

  useEffect(() => {
    (name ? pinInput : nameInput).current?.focus();
    // Only on first show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (fullPin = pin) => {
    if (!name.trim()) {
      setError('Enter your name first.');
      nameInput.current?.focus();
      return;
    }
    if (fullPin.length !== 4) return;
    setBusy(true);
    setError('');
    try {
      const { token } = await call('pinLogin', { name: name.trim(), pin: fullPin });
      try {
        localStorage.setItem(LAST_NAME_KEY, name.trim());
      } catch {
        // Storage blocked; they'll just type their name next time.
      }
      await signInWithCustomToken(auth, token);
    } catch (err) {
      setError(friendlyError(err));
      setPin('');
      setBusy(false);
      animate(boxes.current, { x: [0, -12, 11, -8, 6, -3, 0] }, { duration: 0.42 });
      pinInput.current?.focus();
    }
  };

  const onPinChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError('');
    if (digits.length === 4) submit(digits);
  };

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="Your name">
        <input
          ref={nameInput}
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Name your manager added"
        />
      </Field>
      <div className="field">
        <span className="field-label" id="pin-label">
          Register PIN
        </span>
        <div className="pin-wrap" ref={boxes} onClick={() => pinInput.current?.focus()}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-box ${i === pin.length ? 'is-next' : ''}`}>
              <AnimatePresence>
                {i < pin.length && (
                  <motion.span
                    className="pin-dot"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={bouncy}
                  />
                )}
              </AnimatePresence>
            </span>
          ))}
          <input
            ref={pinInput}
            className="pin-input"
            aria-labelledby="pin-label"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={4}
            value={pin}
            onChange={onPinChange}
            disabled={busy}
          />
        </div>
        <span className="field-hint">The same 4 digits you use on the register.</span>
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" busy={busy} disabled={pin.length !== 4}>
        Sign in
      </Button>
    </form>
  );
}

function EmailForm() {
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    setBusy('email');
    setError('');
    try {
      if (creating) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(cred.user);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(friendlyError(err));
      setBusy('');
    }
  };

  const google = async () => {
    setBusy('google');
    setError('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
        return;
      }
      setError(friendlyError(err));
      setBusy('');
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      setError('Type your email above, then tap “Forgot password?” again.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast({ title: 'Check your email', body: `We sent a password reset link to ${email.trim()}.` });
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  return (
    <div className="stack">
      <Button variant="secondary" onClick={google} busy={busy === 'google'} className="btn-google">
        <GoogleMark /> Continue with Google
      </Button>
      <div className="divider">
        <span>or use email</span>
      </div>
      <form className="stack" onSubmit={submit}>
        <Field label="Email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field label={creating ? 'Make a password' : 'Password'} hint={creating ? 'At least 6 characters.' : null}>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={creating ? 'new-password' : 'current-password'}
            minLength={6}
            required
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" busy={busy === 'email'}>
          {creating ? 'Create account' : 'Sign in'}
        </Button>
      </form>
      <div className="row-between">
        <button type="button" className="link" onClick={() => setCreating((c) => !c)}>
          {creating ? 'I already have a password' : 'First time here?'}
        </button>
        {!creating && (
          <button type="button" className="link" onClick={forgot}>
            Forgot password?
          </button>
        )}
      </div>
    </div>
  );
}
