// Phone notifications (push). Each phone that turns them on gets saved in the
// "devices" list so the server knows where to send alerts.
import { getMessaging, isSupported, register, onRegistered, onUnregistered } from 'firebase/messaging';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { app, db, vapidKey, useEmulators } from '../firebase';

const FID_KEY = 'georges.pushDevice';

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

function readFid() {
  try {
    return localStorage.getItem(FID_KEY);
  } catch {
    return null;
  }
}

function writeFid(fid) {
  try {
    if (fid) localStorage.setItem(FID_KEY, fid);
    else localStorage.removeItem(FID_KEY);
  } catch {
    // Private browsing can block storage; notifications still work for this session.
  }
}

// One of: 'on', 'off', 'blocked', 'needs-install' (iPhone not on Home Screen), 'unsupported'.
export async function pushStatus() {
  if (useEmulators || !vapidKey) return 'unsupported';
  const supported = 'Notification' in window && 'serviceWorker' in navigator && (await isSupported());
  if (!supported) return isIOS() && !isInstalled() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission === 'granted' && readFid()) return 'on';
  return 'off';
}

async function registerDevice(memberId) {
  const messaging = getMessaging(app);
  let registeredFid = null;
  onRegistered(messaging, (fid) => {
    registeredFid = fid;
  });
  onUnregistered(messaging, (fid) => {
    deleteDoc(doc(db, 'devices', fid)).catch(() => {});
    writeFid(null);
  });
  const reg = await navigator.serviceWorker.ready;
  await register(messaging, { vapidKey, serviceWorkerRegistration: reg });
  if (!registeredFid) throw new Error('Could not turn on notifications. Try again.');
  await setDoc(doc(db, 'devices', registeredFid), {
    memberId,
    updatedAt: serverTimestamp(),
    device: navigator.userAgent.slice(0, 160),
  });
  writeFid(registeredFid);
}

// Must be called from a button tap (iPhones only allow the permission prompt then).
export async function turnOnPush(memberId) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  await registerDevice(memberId);
  return 'on';
}

// When the app opens, quietly refresh this phone's registration if notifications are on.
export async function refreshPush(memberId) {
  if ((await pushStatus()) !== 'on') return;
  try {
    await registerDevice(memberId);
  } catch {
    // Not fatal: the next app open tries again.
  }
}

// Called on sign-out so the next person using this phone doesn't get your alerts.
export async function forgetDevice() {
  const fid = readFid();
  if (!fid) return;
  writeFid(null);
  await deleteDoc(doc(db, 'devices', fid)).catch(() => {});
}

export async function turnOffPush() {
  await forgetDevice();
}
