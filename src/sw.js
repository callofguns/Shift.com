// The service worker runs in the background, even when the app is closed.
// It (1) keeps a copy of the app on the phone so it opens instantly / offline and
// (2) receives push notifications from Firebase and shows them.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

if (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID && import.meta.env.VITE_USE_EMULATORS !== 'true') {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  // Firebase shows the notification automatically and opens the app when it's tapped.
  getMessaging(app);
}
