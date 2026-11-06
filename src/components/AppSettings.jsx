/* Impostazioni nel menu dell'avatar (2026-11-06): tema (respiro del drago), notifiche, microfono
   e audio. Il tema prima stava nella testata e sul telefono rubava il posto a mascotte e voce. */
import { useEffect, useState } from "react";
import PushToggle from "./PushToggle";
import { spellSound, unlock } from "../utils/petAudio";

export function ThemePicker({ soffi, soffio, onSoffio }) {
  return (
    <div className="ld-temi" role="group" aria-label="Tema del sito">
      {soffi.map((r) => (
        <button key={r.key} type="button" data-soffio={r.key} aria-pressed={soffio === r.key} onClick={() => onSoffio(r.key)} title={r.title}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d={r.d} /></svg><span>{r.label}</span>
        </button>
      ))}
    </div>
  );
}

const MIC_TEXT = {
  granted: "consentito",
  denied: "bloccato: riattivalo dalle impostazioni del browser o del telefono",
  prompt: "non ancora consentito",
  unknown: "da controllare",
};

export default function AppSettings({ soffi, soffio, onSoffio }) {
  const [mic, setMic] = useState("unknown");
  const [micBusy, setMicBusy] = useState(false);
  const [micErr, setMicErr] = useState("");
  const [tested, setTested] = useState(false);

  useEffect(() => {
    let status = null;
    const put = () => setMic(status.state);
    navigator.permissions?.query?.({ name: "microphone" }).then((s) => { status = s; put(); s.addEventListener("change", put); }).catch(() => {});
    return () => status?.removeEventListener("change", put);
  }, []);

  const askMic = async () => {
    setMicBusy(true); setMicErr("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Questo browser non supporta il microfono.");
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setMic("granted");
    } catch (e) {
      if (e?.name === "NotAllowedError") setMic("denied");
      else setMicErr(e?.message || "Microfono non disponibile.");
    } finally { setMicBusy(false); }
  };
  const testAudio = () => { unlock(); spellSound({ kind: "shield" }); setTested(true); };

  return (
    <div className="ld-set">
      <p className="ld-set-h">Tema</p>
      <ThemePicker soffi={soffi} soffio={soffio} onSoffio={onSoffio} />
      {document.body.classList.contains("covo-admin") && <small className="ld-set-msg">Nelle pagine admin il tema resta Arcano.</small>}
      <p className="ld-set-h">Notifiche e audio</p>
      <PushToggle compact />
      <div className="ld-set-row">
        <span>🎙 Microfono<small>{MIC_TEXT[mic]}</small></span>
        {mic !== "granted" && mic !== "denied" && <button type="button" className="ld-set-btn" disabled={micBusy} onClick={askMic}>{micBusy ? "…" : "Consenti"}</button>}
      </div>
      {micErr && <small className="ld-set-msg">{micErr}</small>}
      <div className="ld-set-row">
        <span>🔊 Audio<small>{tested ? "se non hai sentito niente, alza il volume" : "sblocca e prova i suoni del sito"}</small></span>
        <button type="button" className="ld-set-btn" onClick={testAudio}>Prova</button>
      </div>
    </div>
  );
}
