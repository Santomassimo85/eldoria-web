/* Firebase Cloud Messaging — service worker TEMPLATE
   Vite plugin (vite.config.js) substitutes the __FIREBASE_*__ placeholders
   from .env.local at dev/build time and writes the result to
   public/firebase-messaging-sw.js (gitignored).
*/
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "__FIREBASE_AUTH_DOMAIN__",
  projectId: "__FIREBASE_PROJECT_ID__",
  storageBucket: "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__FIREBASE_APP_ID__",
});

const messaging = firebase.messaging();

// Background message handler — fires when app is closed/backgrounded.
// We send data-only messages from Cloud Functions, so all fields come from payload.data.
messaging.onBackgroundMessage((payload) => {
  const title = payload?.data?.title || "Crit Happens";
  const body  = payload?.data?.body  || "";
  const url   = payload?.data?.url   || "/";
  const tag   = payload?.data?.tag   || undefined;

  self.registration.showNotification(title, {
    body,
    icon: "/logo192.png",
    badge: "/logo192.png",
    data: { url },
    tag,
  });
});

// When the user clicks a notification, focus or open the relevant page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      for (const c of all) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
