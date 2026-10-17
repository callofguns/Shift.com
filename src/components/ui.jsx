// Small shared pieces: buttons, form fields, empty states.
import { motion } from 'motion/react';
import { tap } from '../lib/motion';

export function Button({ variant = 'primary', busy, children, className = '', ...rest }) {
  return (
    <motion.button
      type="button"
      whileTap={rest.disabled || busy ? undefined : tap}
      className={`btn btn-${variant} ${className}`}
      disabled={rest.disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </motion.button>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Empty({ icon, title, children }) {
  return (
    <div className="empty">
      {icon}
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div className="section-title">
      <h3>{children}</h3>
      {action}
    </div>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p className="form-error" role="alert">
      {children}
    </p>
  );
}

// Firebase error messages can be technical; this turns common ones into plain words.
export function friendlyError(err) {
  const code = err?.code ?? '';
  const map = {
    'auth/invalid-credential': 'That email and password don’t match.',
    'auth/wrong-password': 'That email and password don’t match.',
    'auth/user-not-found': 'No account uses that email yet. Tap “First time here?” to create one.',
    'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
    'auth/weak-password': 'Use at least 6 characters for your password.',
    'auth/invalid-email': 'That email doesn’t look right.',
    'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
    'auth/network-request-failed': 'No internet connection. Check your signal and try again.',
    'permission-denied': 'You don’t have permission to do that.',
    unavailable: 'No internet connection. Check your signal and try again.',
  };
  if (map[code]) return map[code];
  // Remove technical codes like "[403]" from the end of server messages.
  const message = (err?.message ?? '').replace(/\s*\[\d+\]$/, '');
  return message || 'Something went wrong. Try again.';
}
