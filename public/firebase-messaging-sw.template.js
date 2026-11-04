/* Notifiche push — service worker TEMPLATE
   Vite plugin (vite.config.js) sostituisce i segnaposto __FIREBASE_*__ (oggi non
   servono più, restano per compatibilità) e scrive public/firebase-messaging-sw.js.

   GESTORE NOSTRO, SENZA L'SDK DI FIREBASE (2026-11-04): su iPhone (PWA dalla
   schermata Home) Safari esige che OGNI push mostri subito una notifica dentro
   event.waitUntil; se una volta non succede, dopo pochi messaggi iOS revoca
   l'iscrizione in silenzio e non arriva più niente (il server continua a vedere
   "ok"). L'SDK compat di Firebase non lo garantiva. Qui ogni push → notifica.
   Il token FCM lo prende la pagina (getToken con questa registrazione): non serve
   l'SDK nel service worker. Formato del messaggio FCM web:
   { notification: {title, body, icon, tag}, data: {url, ...}, fcmOptions: {link} }.
*/

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function parsePush(event) {
  let j = {};
  try { j = event.data ? event.data.json() : {}; }
  catch { try { j = { notification: { body: event.data.text() } }; } catch { j = {}; } }
  const n = j.notification || {};
  const d = j.data || {};
  const link = (j.fcmOptions && j.fcmOptions.link) || (j.fcm_options && j.fcm_options.link) || n.click_action;
  return {
    title: n.title || d.title || "Crit Happens",
    body: n.body || d.body || "Apri l'app per i dettagli.",
    tag: n.tag || d.tag || undefined,
    url: d.url || link || "/",
  };
}

self.addEventListener("push", (event) => {
  const m = parsePush(event);
  event.waitUntil((async () => {
    // Sito aperto e in primo piano: la pagina mostra già l'avviso (onMessage)?
    // No: senza l'SDK nel SW la pagina non lo riceve, quindi lo mostriamo sempre.
    await self.registration.showNotification(m.title, {
      body: m.body,
      icon: "/logo192.png",
      badge: "/logo192.png",
      data: { url: m.url },
      tag: m.tag,
      renotify: !!m.tag,
    });
  })());
});

// Tocco sulla notifica: porta in primo piano il sito (o lo apre) sulla pagina giusta.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) {
        try { if ("navigate" in c && c.url !== url) await c.navigate(url); } catch { /* altra origine */ }
        return c.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
