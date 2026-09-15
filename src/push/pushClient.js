// Notifiche push, UN solo punto per web e Android.
//   • Web / PWA (Chrome Android, desktop, iPhone da schermata Home): Firebase
//     Cloud Messaging via service worker (/firebase-messaging-sw.js) + VAPID.
//   • App Android (guscio Capacitor che carica il sito): plugin nativo
//     PushNotifications → token FCM di Android. Stesso array `fcmTokens` sul doc
//     characters/{uid}: la Cloud Function `sendPush` manda a tutti i token.
// La scelta dell'utente (on/off) vive in localStorage PER DISPOSITIVO, così ogni
// telefono/PC decide per sé. `resumePush` all'avvio rinnova il token se è "on".
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { getToken, deleteToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion, arrayRemove, setDoc } from "firebase/firestore";
import { db, getMessagingIfSupported, VAPID_KEY } from "../firebase";

const LS_PREF = "ch_push_pref";    // "on" | "off" | "" (mai scelto)
const LS_TOKEN = "ch_push_token";  // ultimo token registrato da QUESTO dispositivo

export const isNativeApp = () => Capacitor.isNativePlatform();
export const isAndroidWeb = () => !isNativeApp() && /android/i.test(navigator.userAgent || "");
export const isIosWeb = () => !isNativeApp() && /iphone|ipad|ipod/i.test(navigator.userAgent || "");
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;

const ls = {
  get: (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* privato / bloccato */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
export const getPushPref = () => ls.get(LS_PREF);

async function saveToken(uid, token) {
  const ref = doc(db, "characters", uid);
  try {
    await updateDoc(ref, { fcmTokens: arrayUnion(token) });
  } catch {
    await setDoc(ref, { fcmTokens: [token] }, { merge: true });   // doc mancante
  }
  ls.set(LS_TOKEN, token);
}
async function forgetToken(uid) {
  const token = ls.get(LS_TOKEN);
  if (token && uid) {
    try { await updateDoc(doc(db, "characters", uid), { fcmTokens: arrayRemove(token) }); } catch { /* ignore */ }
  }
  ls.del(LS_TOKEN);
}

// Cosa può fare questo dispositivo. `reason` è il testo da mostrare se non supportato.
export async function pushSupport() {
  if (isNativeApp()) return { supported: true, platform: "android-app" };
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    if (isIosWeb() && !isStandalone()) return { supported: false, platform: "ios-web", reason: "Su iPhone le notifiche funzionano solo dopo aver aggiunto il sito alla schermata Home (Condividi → Aggiungi alla schermata Home) e averlo aperto da lì." };
    return { supported: false, platform: "web", reason: "Questo browser non supporta le notifiche push." };
  }
  if (!VAPID_KEY) return { supported: false, platform: "web", reason: "Push non configurato su questo sito (manca la chiave VAPID)." };
  const messaging = await getMessagingIfSupported();
  if (!messaging) {
    if (isIosWeb() && !isStandalone()) return { supported: false, platform: "ios-web", reason: "Su iPhone le notifiche funzionano solo dopo aver aggiunto il sito alla schermata Home (Condividi → Aggiungi alla schermata Home) e averlo aperto da lì." };
    return { supported: false, platform: "web", reason: "Questo browser non supporta le notifiche push." };
  }
  return { supported: true, platform: isIosWeb() ? "ios-pwa" : isAndroidWeb() ? "android-web" : "web" };
}

// Stato del permesso di sistema: "granted" | "denied" | "prompt"
export async function pushPermission() {
  if (isNativeApp()) {
    try { const p = await PushNotifications.checkPermissions(); return p.receive === "granted" ? "granted" : p.receive === "denied" ? "denied" : "prompt"; }
    catch { return "prompt"; }
  }
  if (!("Notification" in window)) return "denied";
  return Notification.permission === "default" ? "prompt" : Notification.permission;
}

// ── Android nativo ──────────────────────────────────────────────────────────
let nativeListenersOn = false;
function ensureNativeListeners() {
  if (nativeListenersOn || !isNativeApp()) return;
  nativeListenersOn = true;
  // Tocco sulla notifica → apri la pagina indicata (data.url) dentro l'app.
  PushNotifications.addListener("pushNotificationActionPerformed", (ev) => {
    const url = ev?.notification?.data?.url || "/notifications";
    window.dispatchEvent(new CustomEvent("ch-push-open", { detail: { url } }));
  });
}
async function nativeRegister() {
  ensureNativeListeners();
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") throw new Error("permesso negato");
  return await new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, v) => { if (done) return; done = true; clearTimeout(t); okL.then((h) => h.remove()); koL.then((h) => h.remove()); fn(v); };
    const okL = PushNotifications.addListener("registration", (tok) => finish(resolve, tok.value));
    const koL = PushNotifications.addListener("registrationError", (e) => finish(reject, new Error(e?.error || "registrazione fallita")));
    const t = setTimeout(() => finish(reject, new Error("nessuna risposta da Google Play Services")), 20000);
    PushNotifications.register().catch((e) => finish(reject, e));
  });
}

// ── Web / PWA ───────────────────────────────────────────────────────────────
let webForegroundOn = false;
async function webRegister({ prompt = true } = {}) {
  const messaging = await getMessagingIfSupported();
  if (!messaging) throw new Error("browser non supportato");
  let perm = Notification.permission;
  if (perm === "default" && prompt) perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("permesso negato");
  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) throw new Error("token non ottenuto");
  if (!webForegroundOn) {
    webForegroundOn = true;
    // Sito aperto in primo piano: il SW non mostra nulla, lo facciamo noi.
    onMessage(messaging, (payload) => {
      const title = payload?.notification?.title || payload?.data?.title || "Crit Happens";
      const body = payload?.notification?.body || payload?.data?.body || "";
      const url = payload?.data?.url || "/";
      reg?.showNotification?.(title, { body, icon: "/logo192.png", badge: "/logo192.png", data: { url } });
    });
  }
  return token;
}

// ── API ─────────────────────────────────────────────────────────────────────
// Attiva su questo dispositivo (chiede il permesso se serve) e salva il token.
export async function enablePush(uid, { prompt = true } = {}) {
  if (!uid) return { ok: false, error: "non loggato" };
  try {
    const token = isNativeApp() ? await nativeRegister() : await webRegister({ prompt });
    await saveToken(uid, token);
    ls.set(LS_PREF, "on");
    return { ok: true, token };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// Disattiva su questo dispositivo: via il token dal doc (il server non manderà più nulla qui).
export async function disablePush(uid) {
  await forgetToken(uid);
  ls.set(LS_PREF, "off");
  if (!isNativeApp()) {
    try { const m = await getMessagingIfSupported(); if (m) await deleteToken(m); } catch { /* ignore */ }
  } else {
    try { await PushNotifications.unregister(); } catch { /* ignore */ }
  }
  return { ok: true };
}

// All'avvio: se l'utente ha scelto "on", rinnova il token in silenzio (ruotano).
// Se non ha mai scelto: sull'app Android chiede subito (è il motivo per cui la si
// installa); sul web chiede una volta come prima.
export async function resumePush(uid) {
  if (!uid) return;
  const pref = getPushPref();
  if (pref === "off") { if (isNativeApp()) ensureNativeListeners(); return; }
  const perm = await pushPermission();
  if (perm === "denied") return;
  if (pref === "on") { await enablePush(uid, { prompt: false }); return; }
  const sup = await pushSupport();
  if (!sup.supported) return;
  await enablePush(uid, { prompt: true });
}
