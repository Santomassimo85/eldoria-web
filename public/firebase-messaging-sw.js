/* Firebase Cloud Messaging — service worker
   Loaded by FCM at /firebase-messaging-sw.js. Runs even when the page is closed.
*/
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// NOTE: these values are public (same as the client config).
firebase.initializeApp({
  apiKey: "AIzaSyBGv3dT_2-ztsAwx0B4s42YtPL-Q1UBMcM",
  authDomain: "eldoria-web.firebaseapp.com",
  projectId: "eldoria-web",
  storageBucket: "eldoria-web.firebasestorage.app",
  messagingSenderId: "500537293803",
  appId: "1:500537293803:web:048a7bbfbeb7adf4d037ae",
});

const messaging = firebase.messaging();

// Background message handler — fires when app is closed/backgrounded.
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || "Eldoria";
  const body  = payload?.notification?.body  || payload?.data?.body  || "";
  const url   = payload?.data?.url || "/";

  self.registration.showNotification(title, {
    body,
    icon: "/logo192.png",
    badge: "/logo192.png",
    data: { url },
    tag: payload?.data?.tag || undefined,
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
