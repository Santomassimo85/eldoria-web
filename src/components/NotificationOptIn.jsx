import { useEffect, useRef } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, getMessagingIfSupported, VAPID_KEY } from "../firebase";
import { useAuth } from "../AuthContext";

/**
 * Auto-prompts the logged-in user for notification permission and
 * registers their FCM token to characters/{uid}.fcmTokens.
 * Renders nothing.
 */
export default function NotificationOptIn() {
  const { currentUser } = useAuth();
  const triedRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    if (triedRef.current) return;
    triedRef.current = true;

    (async () => {
      if (!("Notification" in window)) return;
      if (!VAPID_KEY) {
        console.warn("[fcm] VITE_FIREBASE_VAPID_KEY missing in env");
        return;
      }

      const messaging = await getMessagingIfSupported();
      if (!messaging) return;

      // Auto-prompt if status is "default" (never asked).
      let perm = Notification.permission;
      if (perm === "default") {
        try { perm = await Notification.requestPermission(); }
        catch { return; }
      }
      if (perm !== "granted") return;

      try {
        const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: reg,
        });
        if (!token) return;

        // Save token on the character doc (array — supports multiple devices).
        await updateDoc(doc(db, "characters", currentUser.uid), {
          fcmTokens: arrayUnion(token),
        }).catch(async () => {
          // Doc might not exist; create minimal stub
          const { setDoc } = await import("firebase/firestore");
          await setDoc(doc(db, "characters", currentUser.uid), { fcmTokens: [token] }, { merge: true });
        });

        // Foreground messages — show a small in-page toast via the SW so
        // the OS notification is consistent whether app is open or not.
        onMessage(messaging, (payload) => {
          const title = payload?.notification?.title || payload?.data?.title || "Eldoria";
          const body  = payload?.notification?.body  || payload?.data?.body  || "";
          const url   = payload?.data?.url || "/";
          if (reg && reg.showNotification) {
            reg.showNotification(title, {
              body,
              icon: "/logo192.png",
              badge: "/logo192.png",
              data: { url },
            });
          }
        });
      } catch (err) {
        console.warn("[fcm] setup failed:", err);
      }
    })();
  }, [currentUser?.uid]);

  return null;
}
