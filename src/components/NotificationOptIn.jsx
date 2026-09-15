import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { App as CapApp } from "@capacitor/app";
import { resumePush, isNativeApp } from "../push/pushClient";

/**
 * Al login: rinnova (o chiede la prima volta) le notifiche push di questo
 * dispositivo — web, PWA o app Android — rispettando lo spegnimento fatto
 * dall'utente nell'interruttore in /notifications. Sull'app Android ascolta
 * anche il tocco sulla notifica e porta alla pagina giusta. Non renderizza nulla.
 */
export default function NotificationOptIn() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const triedFor = useRef(null);

  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid || triedFor.current === uid) return;
    triedFor.current = uid;
    resumePush(uid).catch((e) => console.warn("[push] resume:", e));
  }, [currentUser?.uid]);

  // App Android: il tasto Indietro di sistema torna alla pagina precedente
  // invece di chiudere l'app (esce solo quando non c'è più storia).
  useEffect(() => {
    if (!isNativeApp()) return;
    let handle = null;
    CapApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack || window.history.length > 1) window.history.back();
      else CapApp.exitApp();
    }).then((h) => { handle = h; });
    return () => { handle?.remove?.(); };
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    const onOpen = (e) => {
      const url = e.detail?.url || "/notifications";
      try {
        const u = new URL(url, window.location.origin);
        navigate(u.pathname + u.search + u.hash);
      } catch { navigate("/notifications"); }
    };
    window.addEventListener("ch-push-open", onOpen);
    return () => window.removeEventListener("ch-push-open", onOpen);
  }, [navigate]);

  return null;
}
