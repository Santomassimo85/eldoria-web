/* Chat vocale del gruppo nelle Segrete (2026-11-05): riquadro fisso in basso a sinistra,
   visibile nella stanza e durante la lotta (resta collegato nel passaggio).
   Due modi del microfono: "Tieni premuto" (push-to-talk) o "Sempre aperto" (con muto).
   Preferenza in localStorage `sgr_voice_mode`. Il motore è src/utils/segreteVoice.js. */
import { useEffect, useRef, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { VoiceMesh, peersCol, PEER_STALE_MS } from "../utils/segreteVoice";
import { classInfo, clsStyle } from "../data/segrete";
import "./SegreteVoice.css";

const MODE_KEY = "sgr_voice_mode";
const readMode = () => { try { return localStorage.getItem(MODE_KEY) === "open" ? "open" : "ptt"; } catch { return "ptt"; } };
const SPEAK = 0.04;

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

  const now = Date.now();
  const live = peers.filter((p) => now - (p.at || 0) < PEER_STALE_MS);
  const inVoice = new Set(live.map((p) => p.uid));
  const others = live.filter((p) => p.uid !== uid);

  const applyMic = (on) => { setMicOn(on); mesh.current?.setMicOn(on); };
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
      setJoined(true); setOpen(true);
    } catch (e) {
      setErr(e?.name === "NotAllowedError" ? "Serve il permesso del microfono: consentilo nelle impostazioni del browser." : e?.message || "Microfono non disponibile.");
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
    <div className={`sgv${open ? " is-open" : ""}${joined ? " is-joined" : ""}`}>
      <button type="button" className="sgv-pill" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">{joined ? (micOn ? "🎙" : "🔇") : "🎧"}</span>
        <b>Voce</b>
        <em>{inVoice.size || 0}</em>
        {!!talkingNow.length && <span className="sgv-wave" aria-label={`Parla: ${talkingNow.map((p) => p.name).join(", ")}`}>{talkingNow.map((p) => p.name).join(", ")}</span>}
      </button>

      {open && (
        <div className="sgv-panel" role="dialog" aria-label="Chat vocale del gruppo">
          <ul className="sgv-list">
            {roster.map((m) => (
              <li key={m.uid} style={clsStyle(m.cls)} className={speaking(m.uid) && !m.muted ? "is-talk" : ""}>
                <span className="sgv-ico" aria-hidden="true">{classInfo(m.cls)?.icon}</span>
                <span className="sgv-name">{m.name}{m.uid === uid ? " (tu)" : ""}</span>
                <small>{!m.in ? "non in voce" : m.muted ? "🔇 muto" : speaking(m.uid) ? "🔊 parla" : m.uid !== uid && joined && m.conn !== "connected" ? (m.conn === "failed" ? "⚠ non collegato" : "… collego") : "in voce"}</small>
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
              <div className="sgv-modes" role="group" aria-label="Modo del microfono">
                <button type="button" aria-pressed={mode === "ptt"} className={mode === "ptt" ? "is-on" : ""} onClick={() => setMode("ptt")}>✋ Tieni premuto</button>
                <button type="button" aria-pressed={mode === "open"} className={mode === "open" ? "is-on" : ""} onClick={() => setMode("open")}>🎙 Sempre aperto</button>
              </div>
              {mode === "ptt" ? (
                <button type="button" className={`sgv-ptt${micOn ? " is-live" : ""}`}
                  onPointerDown={pttDown} onPointerUp={pttUp} onPointerLeave={pttUp} onPointerCancel={pttUp}
                  onContextMenu={(e) => e.preventDefault()}>
                  {micOn ? "🔴 Stai parlando…" : "🎙 Tieni premuto per parlare"}
                </button>
              ) : (
                <button type="button" className={`sgv-ptt${micOn ? " is-live" : ""}`} onClick={() => applyMic(!micOn)}>
                  {micOn ? "🎙 Microfono aperto · tocca per il muto" : "🔇 Muto · tocca per parlare"}
                </button>
              )}
              <div className="sgv-row">
                <button type="button" className="sgv-btn" onClick={() => { const v = !speakers; setSpeakers(v); mesh.current?.setSpeakersOn(v); }}>{speakers ? "🔈 Silenzia gli altri" : "🔊 Riattiva l'audio"}</button>
                <button type="button" className="sgv-btn" onClick={leave}>Esci dalla voce</button>
              </div>
              {!!others.length && Object.values(st.conns).some((c) => c === "failed") && (
                <p className="sgv-hint">⚠ Con qualcuno il collegamento non riesce (succede su alcune reti mobili o del lavoro). Provate col Wi-Fi.</p>
              )}
            </>
          )}
          {err && <p className="sgv-err" role="alert">{err}</p>}
        </div>
      )}
    </div>
  );
}
