import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { pushSupport, pushPermission, getPushPref, enablePush, disablePush, isNativeApp, isAndroidWeb, isIosWeb, isStandalone } from "../push/pushClient";

export const ANDROID_APK_URL = "/app/crit-happens.apk";

/**
 * Interruttore "Notifiche push su questo dispositivo" (pagina Notifiche).
 * Stesso componente su web, PWA e app Android: cambia solo il canale sotto.
 */
export default function PushToggle() {
  const { currentUser } = useAuth();
  const [support, setSupport] = useState(null);      // {supported, platform, reason}
  const [perm, setPerm] = useState("prompt");
  const [on, setOn] = useState(getPushPref() === "on");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await pushSupport();
      const p = await pushPermission();
      if (!alive) return;
      setSupport(s); setPerm(p);
      if (p === "denied") setOn(false);
    })();
    return () => { alive = false; };
  }, []);

  const toggle = async () => {
    if (!currentUser?.uid || busy) return;
    setBusy(true); setMsg("");
    if (on) {
      await disablePush(currentUser.uid);
      setOn(false);
      setMsg("Notifiche spente su questo dispositivo.");
    } else {
      const r = await enablePush(currentUser.uid);
      if (r.ok) { setOn(true); setMsg("Notifiche attive: riceverai gli avvisi anche a sito chiuso."); }
      else {
        setOn(false);
        setMsg(/negato/.test(r.error || "")
          ? "Permesso negato dal sistema: riabilitalo dalle impostazioni del browser o del telefono (Notifiche → Crit Happens)."
          : `Attivazione fallita: ${r.error}`);
      }
      setPerm(await pushPermission());
    }
    setBusy(false);
  };

  const where = isNativeApp() ? "app Android" : isIosWeb() ? (isStandalone() ? "iPhone (schermata Home)" : "Safari iPhone") : isAndroidWeb() ? "browser Android" : "questo browser";

  return (
    <div className="nx-pannello push-toggle" role="group" aria-label="Notifiche push">
      <div className="push-toggle-row">
        <div className="push-toggle-text">
          <h3 className="nx-nome push-toggle-title">🔔 Notifiche push · {where}</h3>
          <p className="nx-prosa push-toggle-desc">
            {support === null ? "Controllo il dispositivo…"
              : !support.supported ? support.reason
              : perm === "denied" ? "Permesso negato dal sistema: riabilitalo dalle impostazioni del browser o del telefono, poi torna qui."
              : on ? "Attive su questo dispositivo: avvisi del Master, aste, boss e turni arrivano anche a sito chiuso."
              : "Spente su questo dispositivo. Accendile per ricevere gli avvisi anche a sito chiuso."}
          </p>
          {msg && <p className="nx-prosa push-toggle-msg">{msg}</p>}
        </div>
        <button
          type="button"
          className={`push-switch ${on ? "is-on" : ""}`}
          role="switch" aria-checked={on}
          disabled={busy || !support?.supported || perm === "denied" || !currentUser}
          onClick={toggle}
          title={on ? "Spegni le notifiche su questo dispositivo" : "Accendi le notifiche su questo dispositivo"}
        >
          <span className="push-switch-knob" aria-hidden="true" />
          <span className="push-switch-label">{busy ? "…" : on ? "ON" : "OFF"}</span>
        </button>
      </div>
      {isAndroidWeb() && (
        <p className="nx-prosa push-toggle-apk">
          📲 Su Android c'è anche l'app: <a href={ANDROID_APK_URL} download>scarica Crit Happens (APK)</a>. Stessa cosa del sito, con le notifiche di sistema.
        </p>
      )}
    </div>
  );
}
