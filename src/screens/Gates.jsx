// Screens shown between signing in and seeing the schedule.
import { useState } from 'react';
import { motion } from 'motion/react';
import { sendEmailVerification } from 'firebase/auth';
import { auth, call } from '../firebase';
import { Brand } from './Login';
import { Button, ErrorText, Field, friendlyError } from '../components/ui';
import { useToast } from '../components/Toast';
import { spring } from '../lib/motion';

function GateFrame({ children }) {
  return (
    <motion.div
      className="gate"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={spring}
    >
      <Brand compact />
      {children}
    </motion.div>
  );
}

export function Splash() {
  return (
    <motion.div className="splash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.img
        src="/logo-mark.svg"
        alt="Loading"
        width={84}
        height={84}
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}

export function VerifyEmail({ session }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();

  const checkAgain = async () => {
    setBusy('check');
    setError('');
    await session.recheck();
    if (!auth.currentUser?.emailVerified) setError('Not verified yet. Tap the link in the email first.');
    setBusy('');
  };

  const resend = async () => {
    setBusy('resend');
    try {
      await sendEmailVerification(auth.currentUser);
      toast({ title: 'Email sent', body: `Check ${session.user.email}.` });
    } catch (err) {
      setError(friendlyError(err));
    }
    setBusy('');
  };

  return (
    <GateFrame>
      <h2 className="gate-title">Check your email</h2>
      <p className="gate-lede">
        We sent a link to <strong>{session.user.email}</strong>. Tap it to confirm it’s you, then come back here.
      </p>
      <ErrorText>{error}</ErrorText>
      <div className="stack">
        <Button onClick={checkAgain} busy={busy === 'check'}>
          I tapped the link
        </Button>
        <Button variant="secondary" onClick={resend} busy={busy === 'resend'}>
          Send the link again
        </Button>
        <Button variant="ghost" onClick={session.logOut}>
          Use a different account
        </Button>
      </div>
    </GateFrame>
  );
}

export function NotInvited({ session }) {
  const [busy, setBusy] = useState(false);
  return (
    <GateFrame>
      <h2 className="gate-title">You’re not on the team yet</h2>
      <p className="gate-lede">
        <strong>{session.user.email}</strong> hasn’t been added. Ask a manager to add this email in{' '}
        <strong>More → Team</strong>, then tap Try again.
      </p>
      <div className="stack">
        <Button
          busy={busy}
          onClick={async () => {
            setBusy(true);
            await session.recheck();
            setBusy(false);
          }}
        >
          Try again
        </Button>
        <Button variant="ghost" onClick={session.logOut}>
          Sign out
        </Button>
      </div>
    </GateFrame>
  );
}

export function Disabled({ session }) {
  return (
    <GateFrame>
      <h2 className="gate-title">Your account is turned off</h2>
      <p className="gate-lede">Ask a manager to turn it back on in More → Team.</p>
      <Button variant="secondary" onClick={session.logOut}>
        Sign out
      </Button>
    </GateFrame>
  );
}

export function SessionError({ session }) {
  return (
    <GateFrame>
      <h2 className="gate-title">Couldn’t sign you in</h2>
      <p className="gate-lede">{session.message}</p>
      <div className="stack">
        <Button onClick={session.recheck}>Try again</Button>
        <Button variant="ghost" onClick={session.logOut}>
          Sign out
        </Button>
      </div>
    </GateFrame>
  );
}

// The very first sign-in sets up the store and makes that person a manager.
export function Bootstrap({ session }) {
  const [name, setName] = useState(session.user.displayName ?? '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = async (e) => {
    e.preventDefault();
    if (pin && !/^\d{4}$/.test(pin)) {
      setError('The PIN must be exactly 4 digits, or leave it blank.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await call('bootstrap', { name: name.trim(), pin });
      await session.user.getIdToken(true);
      await session.recheck();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <GateFrame>
      <h2 className="gate-title">Set up the schedule</h2>
      <p className="gate-lede">
        You’re the first one here, so you’ll be a manager. You can add everyone else after this.
      </p>
      <form className="stack" onSubmit={finish}>
        <Field label="Your name" hint="This is the name you’ll type with your PIN.">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
        </Field>
        <Field label="Your register PIN (optional)" hint="Lets you sign in with your name and PIN too.">
          <input
            className="input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            autoComplete="off"
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" busy={busy}>
          Finish setup
        </Button>
      </form>
    </GateFrame>
  );
}
