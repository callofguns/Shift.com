// Keeps track of who is signed in and whether they're on the team.
import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, call } from '../firebase';
import { forgetDevice } from '../lib/push';

// status: 'loading' | 'signed-out' | 'verify-email' | 'not-invited' | 'bootstrap' | 'ready' | 'error'
export function useSession() {
  const [state, setState] = useState({ status: 'loading' });

  const check = useCallback(async (user) => {
    if (!user) {
      setState({ status: 'signed-out' });
      return;
    }
    try {
      const token = await user.getIdTokenResult();
      if (token.claims.memberId) {
        setState({ status: 'ready', user, memberId: token.claims.memberId });
        return;
      }
      const usesPassword = user.providerData.some((p) => p.providerId === 'password');
      if (usesPassword && !user.emailVerified) {
        setState({ status: 'verify-email', user });
        return;
      }
      const res = await call('linkAccount');
      if (res.status === 'linked') {
        await user.getIdToken(true);
        setState({ status: 'ready', user, memberId: res.memberId });
      } else {
        setState({ status: res.status, user });
      }
    } catch (err) {
      setState({ status: 'error', user, message: err.message });
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, check), [check]);

  const recheck = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      await user.reload();
      // Get a fresh sign-in token so the server sees the email is now verified.
      await user.getIdToken(true);
    }
    await check(auth.currentUser);
  }, [check]);

  const logOut = useCallback(async () => {
    await forgetDevice();
    await signOut(auth);
  }, []);

  return { ...state, recheck, logOut };
}
