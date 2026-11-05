/* Chat vocale del gruppo nelle Segrete (2026-11-05): riquadro fisso in basso a sinistra,
   visibile nella stanza e durante la lotta (resta collegato nel passaggio).
   Due modi del microfono: "Tieni premuto" (push-to-talk) o "Sempre aperto" (con muto).
   Preferenza in localStorage `sgr_voice_mode`. Il motore è src/utils/segreteVoice.js. */
import { useEffect, useRef, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { VoiceMesh, peersCol, makeFreshness } from "../utils/segreteVoice";
import { classInfo, clsStyle } from "../data/segrete";
import "./SegreteVoice.css";

const MODE_KEY = "sgr_voice_mode";
const readMode = () => { try { return localStorage.getItem(MODE_KEY) === "open" ? "open" : "ptt"; } catch { return "ptt"; } };
const SPEAK = 0.04;
// Nell'app (WebView di Capacitor) i link del sito restano dentro l'app, che non scarica file:
// un indirizzo di un ALTRO dominio invece Capacitor lo apre nel browser del telefono, che scarica l'APK.
const APK_EXTERNAL_URL = "https://raw.githubusercontent.com/Santomassimo85/eldoria-web/main/public/app/crit-happens.apk";

export default function SegreteVoice({ roomId, uid, name, members }) {
  const [peers, setPeers] = useState([]);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setModeState] = useState(readMode);
  const [micOn, setMicOn] = useState(false);
  const [speakers, setSpeakers] = useState(true);
  const [st, setSt] = useState({ conns: {}, levels: {} });
  const [, tick] = useState(0);
  const mesh = useRef(null);
  const holding = useRef(false);

  useEffect(() => onSnapshot(peersCol(roomId), (s) => setPeers(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => setPeers([])), [roomId]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 10000); return () => clearInterval(t); }, []);
  // uscendo dalla stanza (o dalla pagina) si chiude tutto
  useEffect(() => () => { mesh.current?.leave(); mesh.current = null; }, [roomId]);
  useEffect(() => {
    const bye = () => mesh.current?.leave();
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, []);

  const fresh = useRef(null);
  if (!fresh.current) fresh.current = makeFreshness();
  const live = fresh.current(peers);
  const inVoice = new Set(live.map((p) => p.uid));
  const others = live.filter((p) => p.uid !== uid);

  const applyMic = (on) => { setMicOn(on); mesh.current?.setMicOn(on); mesh.current?.unlockAudio(); };
  const setMode = (m) => {
    setModeState(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* niente */ }
    applyMic(m === "open");
  };

  const join = async () => {
    if (busy || joined) return;
    setBusy(true); setErr("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error("Questo browser non supporta la chat vocale.");
      const m = new VoiceMesh({ roomId, uid, name, onState: setSt });
      await m.join();
      mesh.current = m;
      m.setMicOn(mode === "open");
      setMicOn(mode === "open");
      m.setSpeakersOn(speakers);
      setJoined(true); setOpen(false);
    } catch (e) {
      const inApp = !!window.Capacitor?.isNativePlatform?.();
      setErr(e?.name === "NotAllowedError"
        ? (inApp
          ? "L'app non ha il permesso del microfono. Se non te l'ha chiesto, aggiorna l'app (versione 1.2: scaricala dal link qui sotto) oppure attivalo in Impostazioni → App → Crit Happens → Autorizzazioni → Microfono."
          : "Serve il permesso del microfono: consentilo nelle impostazioni del browser.")
        : e?.message || "Microfono non disponibile.");
    } finally { setBusy(false); }
  };
  const leave = async () => {
    const m = mesh.current; mesh.current = null;
    setJoined(false); setMicOn(false); setSt({ conns: {}, levels: {} });
    await m?.leave();
  };

  // push-to-talk: tieni premuto (dito o mouse)
  const pttDown = (e) => { e.preventDefault(); holding.current = true; applyMic(true); };
  const pttUp = () => { if (!holding.current) return; holding.current = false; applyMic(false); };

  const speaking = (u) => joined && (st.levels[u] || 0) > SPEAK && (u !== uid || micOn);
  const talkingNow = live.filter((p) => !p.muted && speaking(p.uid));
  const roster = (members || []).map((m) => {
    const p = live.find((x) => x.uid === m.uid);
    const conn = m.uid === uid ? (joined ? "connected" : null) : st.conns[m.uid] || null;
    return { ...m, in: inVoice.has(m.uid), muted: p?.muted, conn };
  });

  return (
    <div className={`sgv${open ? " is-open" : ""}${joined ? " is-joined" : ""}`} onPointerDown={() => mesh.current?.unlockAudio()}>
      <div className="sgv-bar">
        <button type="button" className="sgv-pill" aria-expanded={open} title="Chi è in voce · entra nella chat vocale" onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true">🎧</span>
          <b className="sgv-lbl">Voce</b>
          <em>{inVoice.size || 0}</em>
          {!!talkingNow.length && <span className="sgv-wave" aria-label={`Parla: ${talkingNow.map((p) => p.name).join(", ")}`}>{talkingNow.map((p) => p.name).join(", ")}</span>}
        </button>
        {joined && (
          <>
            {mode === "ptt" ? (
              <button type="button" className={`sgv-mic${micOn ? " is-live" : ""}`} aria-label="Tieni premuto per parlare" title="Tieni premuto per parlare"
                onPointerDown={pttDown} onPointerUp={pttUp} onPointerLeave={pttUp} onPointerCancel={pttUp}
                onContextMenu={(e) => e.preventDefault()}>
                {micOn ? <>🔴<span className="sgv-lbl"> Parli</span></> : <>🎙<span className="sgv-lbl"> Tieni premuto</span></>}
              </button>
            ) : (
              <button type="button" className={`sgv-mic${micOn ? " is-live" : ""}`} aria-pressed={micOn} title={micOn ? "Tocca per il muto" : "Tocca per aprire il microfono"} onClick={() => applyMic(!micOn)}>
                {micOn ? <>🎙<span className="sgv-lbl"> Aperto</span></> : <>🔇<span className="sgv-lbl"> Muto</span></>}
              </button>
            )}
            <button type="button" className="sgv-sq" aria-label={mode === "ptt" ? "Passa a microfono sempre aperto" : "Passa a tieni premuto"}
              title={mode === "ptt" ? "Passa a: sempre aperto" : "Passa a: tieni premuto"} onClick={() => setMode(mode === "ptt" ? "open" : "ptt")}>
              {mode === "ptt" ? "✋" : "🔓"}
            </button>
            <button type="button" className="sgv-sq sgv-sq--x" aria-label="Esci dalla chat vocale" title="Esci dalla voce" onClick={leave}>✕</button>
          </>
        )}
      </div>

      {open && (
        <div className="sgv-panel" role="dialog" aria-label="Chat vocale del gruppo">
          <ul className="sgv-list">
            {roster.map((m) => (
              <li key={m.uid} style={clsStyle(m.cls)} className={speaking(m.uid) && !m.muted ? "is-talk" : ""}>
                <span className="sgv-ico" aria-hidden="true">{classInfo(m.cls)?.icon}</span>
                <span className="sgv-name">{m.name}{m.uid === uid ? " (tu)" : ""}</span>
                <small>{!m.in ? "non in voce" : m.muted ? "🔇 muto" : speaking(m.uid) ? "🔊 parla" : m.uid !== uid && joined && m.conn === "relay" ? "in voce · via server" : m.uid !== uid && joined && st.via?.[m.uid] === "ponte" ? "in voce · via ponte" : "in voce"}</small>
              </li>
            ))}
          </ul>

          {!joined ? (
            <>
              <button type="button" className="sgv-btn sgv-btn--go" disabled={busy} onClick={join}>{busy ? "⏳ Accendo il microfono…" : "🎧 Entra nella chat vocale"}</button>
              <p className="sgv-hint">Vi sentite solo fra voi del gruppo. Il browser chiederà il permesso del microfono.</p>
            </>
          ) : (
            <>
              <p className="sgv-hint">Il microfono si comanda dai tasti accanto a 🎧 Voce, senza aprire questo pannello: {mode === "ptt" ? "«🎙 Tieni premuto» per parlare" : "«🎙 Aperto / 🔇 Muto» per accenderlo e spegnerlo"} · il tondo cambia modo (✋ tieni premuto, 🔓 sempre aperto) · ✕ esce dalla voce.</p>
              <button type="button" className="sgv-btn" onClick={() => { const v = !speakers; setSpeakers(v); mesh.current?.setSpeakersOn(v); }}>{speakers ? "🔈 Silenzia gli altri" : "🔊 Riattiva l'audio"}</button>
              {!!others.length && Object.values(st.conns).some((c) => c === "relay") && (
                <p className="sgv-hint">ℹ Con chi è «via server» la voce passa dal server del sito: funziona su qualsiasi rete, con circa 1 secondo di ritardo. Intanto si continua a provare il collegamento diretto, più veloce.</p>
              )}
            </>
          )}
          {joined && (
            <details className="sgv-diag">
              <summary>🔧 Diagnostica (per l'assistenza)</summary>
              <ul>
                {live.map((p) => (
                  <li key={p.uid}><b>{p.name || p.uid.slice(0, 5)}</b>{p.turn ? " · ponte ok" : " · senza ponte"}
                    {Object.entries(p.diag || {}).map(([u, line]) => <div key={u}>→ {live.find((x) => x.uid === u)?.name || u.slice(0, 5)}: <code>{line}</code></div>)}
                    {!Object.keys(p.diag || {}).length && <div>nessun collegamento</div>}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {err && <p className="sgv-err" role="alert">{err}</p>}
          {err && window.Capacitor?.isNativePlatform?.() && <a className="sgv-btn sgv-dl" href={APK_EXTERNAL_URL} target="_blank" rel="noopener noreferrer">⬇ Scarica l'app aggiornata (1.2)</a>}
        </div>
      )}
    </div>
  );
}
