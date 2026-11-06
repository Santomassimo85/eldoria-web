/* Chat vocale di tutta l'app (2026-11-06, prima solo nelle Segrete). Montata una volta in App.jsx,
   quindi resta collegata cambiando pagina. Sta DENTRO la testata (slot #header-voice): non copre
   niente. Nei fight la testata sparisce: resta solo il tasto del microfono sotto il ☰, se sei in voce.
   Canali: Sala comune (tutti i loggati) e, se sei in un gruppo delle Segrete, il gruppo.
   Microfono: "Tieni premuto" o "Sempre aperto" (localStorage `sgr_voice_mode`). Il motore è
   src/utils/segreteVoice.js. Finché non sei in voce e il pannello è chiuso i presenti si leggono ogni
   30 s (getDocs), non in diretta: il battito di chi parla costerebbe una lettura a ogni pagina aperta. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { VoiceMesh, peersCol, makeFreshness } from "../utils/segreteVoice";
import { classInfo, clsStyle } from "../data/segrete";
import "./AppVoice.css";

const SALA = "sala-comune";
const ROOM_FRESH_MS = 2 * 24 * 3600 * 1000; // gruppi fermi da più di 2 giorni: la lobby li nasconde
const msOf = (x) => (x?.toMillis ? x.toMillis() : Number(x) || 0);

const MODE_KEY = "sgr_voice_mode";
const readMode = () => { try { return localStorage.getItem(MODE_KEY) === "open" ? "open" : "ptt"; } catch { return "ptt"; } };
const SPEAK = 0.04;
// Nell'app (WebView di Capacitor) i link del sito restano dentro l'app, che non scarica file:
// un indirizzo di un ALTRO dominio invece Capacitor lo apre nel browser del telefono, che scarica l'APK.
const APK_EXTERNAL_URL = "https://raw.githubusercontent.com/Santomassimo85/eldoria-web/main/public/app/crit-happens.apk";

export default function AppVoice({ docked }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || null;
  const [name, setName] = useState("");
  const [room, setRoom] = useState(null);
  const [pick, setPick] = useState(null);
  const [slot, setSlot] = useState(null);
  const roomId = pick === SALA ? SALA : room && (pick === room.id || !pick) ? room.id : SALA;
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

  const watch = open || joined;
  useLayoutEffect(() => { setSlot(docked ? document.getElementById("header-voice") : null); }, [docked, uid]);
  useEffect(() => {
    setName("");
    if (uid) getDoc(doc(db, "characters", uid)).then((s) => setName(s.data()?.name || currentUser?.displayName || "")).catch(() => {});
  }, [uid]);
  // il gruppo delle Segrete in cui sei (il più recente)
  useEffect(() => (uid ? onSnapshot(query(collection(db, "dungeon_rooms"), where("memberIds", "array-contains", uid)), (s) => {
    const list = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => Date.now() - msOf(r.updatedAt) < ROOM_FRESH_MS);
    setRoom(list.sort((a, b) => msOf(b.updatedAt) - msOf(a.updatedAt))[0] || null);
  }, () => setRoom(null)) : undefined), [uid]);
  useEffect(() => {
    if (!uid) return undefined;
    const put = (s) => setPeers(s.docs.map((d) => ({ uid: d.id, ...d.data() })));
    if (watch) return onSnapshot(peersCol(roomId), put, () => setPeers([]));
    const load = () => { if (!document.hidden) getDocs(peersCol(roomId)).then(put).catch(() => setPeers([])); };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [roomId, uid, watch]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 10000); return () => clearInterval(t); }, []);
  // canale sparito (hai lasciato il gruppo) o logout: si esce dalla voce
  useEffect(() => { if (mesh.current && (!uid || mesh.current.roomId !== roomId)) leave(); }, [roomId, uid]);
  useEffect(() => { if (pick && pick !== SALA && pick !== room?.id) setPick(null); }, [pick, room?.id]);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!e.target.closest?.(".sgv-panel, .sgv-pill")) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  // nei fight la pagina lascia libero il posto del microfono
  useEffect(() => {
    document.body.classList.toggle("vc-live", joined && !docked);
    document.body.classList.toggle("vc-on", joined);
    return () => document.body.classList.remove("vc-live", "vc-on");
  }, [joined, docked]);
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

  const join = async (id = roomId) => {
    if (busy || mesh.current) return;
    setBusy(true); setErr("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error("Questo browser non supporta la chat vocale.");
      setPick(id); // resti su questo canale anche se poi entri in un gruppo
      const m = new VoiceMesh({ roomId: id, uid, name, onState: setSt });
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

  const choose = async (id) => {
    if (id === roomId) return;
    const was = !!mesh.current;
    setPick(id);
    if (was) { await leave(); join(id); }
  };

  // push-to-talk: tieni premuto (dito o mouse)
  const pttDown = (e) => { e.preventDefault(); holding.current = true; applyMic(true); };
  const pttUp = () => { if (!holding.current) return; holding.current = false; applyMic(false); };

  const speaking = (u) => joined && (st.levels[u] || 0) > SPEAK && (u !== uid || micOn);
  const talkingNow = live.filter((p) => !p.muted && speaking(p.uid));
  const isSala = roomId === SALA;
  const members = isSala ? live.map((p) => ({ uid: p.uid, name: p.name })) : room?.members || [];
  const roster = members.map((m) => {
    const p = live.find((x) => x.uid === m.uid);
    const conn = m.uid === uid ? (joined ? "connected" : null) : st.conns[m.uid] || null;
    return { ...m, in: inVoice.has(m.uid), muted: p?.muted, conn };
  });

  if (!uid) return null;
  const micBtn = !joined ? null : mode === "ptt" ? (
    <button type="button" className={`sgv-mic${micOn ? " is-live" : ""}`} aria-label="Tieni premuto per parlare" title="Tieni premuto per parlare"
      onPointerDown={pttDown} onPointerUp={pttUp} onPointerLeave={pttUp} onPointerCancel={pttUp}
      onContextMenu={(e) => e.preventDefault()}>{micOn ? "🔴" : "🎙"}</button>
  ) : (
    <button type="button" className={`sgv-mic${micOn ? " is-live" : ""}`} aria-pressed={micOn} aria-label={micOn ? "Metti il muto" : "Apri il microfono"} title={micOn ? "Tocca per il muto" : "Tocca per aprire il microfono"} onClick={() => applyMic(!micOn)}>{micOn ? "🎙" : "🔇"}</button>
  );
  const wake = joined && st.audio && st.audio !== "running" ? <button type="button" className="sgv-mic sgv-wake" aria-label="Attiva l'audio" title="Attiva l'audio" onClick={() => mesh.current?.unlockAudio()}>🔊</button> : null;
  const bar = (
    <div className={`sgv${joined ? " is-joined" : ""}`} onPointerDown={() => mesh.current?.unlockAudio()}>
      <div className="sgv-bar">
        <button type="button" className={`sgv-pill${talkingNow.length ? " is-talk" : ""}`} aria-expanded={open} aria-label={`Chat vocale: ${inVoice.size} in voce${talkingNow.length ? `, parla ${talkingNow.map((p) => p.name).join(", ")}` : ""}`} title="Chat vocale" onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true">🎧</span>
          {!!inVoice.size && <em>{inVoice.size}</em>}
        </button>
        {wake}
        {micBtn}
      </div>
    </div>
  );
  return (
    <>
      {docked ? (slot ? createPortal(bar, slot) : null) : joined ? <div className="sgv-fight" onPointerDown={() => mesh.current?.unlockAudio()}>{wake}{micBtn}</div> : null}
      {open && docked && (
        <div className="sgv-panel" role="dialog" aria-label="Chat vocale">
          {room && (
            <div className="sgv-modes" role="group" aria-label="Canale">
              <button type="button" className={isSala ? "is-on" : ""} aria-pressed={isSala} disabled={busy} onClick={() => choose(SALA)}>🍺 Sala comune</button>
              <button type="button" className={!isSala ? "is-on" : ""} aria-pressed={!isSala} disabled={busy} onClick={() => choose(room.id)}>🗝 {room.name || "Il mio gruppo"}</button>
            </div>
          )}
          {!room && <p className="sgv-title">🍺 Sala comune</p>}
          {isSala && !roster.length && <p className="sgv-hint">Non c'è ancora nessuno in voce.</p>}
          <ul className="sgv-list">
            {roster.map((m) => (
              <li key={m.uid} style={clsStyle(m.cls)} className={speaking(m.uid) && !m.muted ? "is-talk" : ""}>
                <span className="sgv-ico" aria-hidden="true">{classInfo(m.cls)?.icon || "🎧"}</span>
                <span className="sgv-name">{m.name}{m.uid === uid ? " (tu)" : ""}</span>
                <small>{!m.in ? "non in voce" : m.muted ? "🔇 muto" : speaking(m.uid) ? "🔊 parla" : m.uid !== uid && joined && m.conn === "relay" ? "in voce · via server" : m.uid !== uid && joined && st.via?.[m.uid] === "ponte" ? "in voce · via ponte" : "in voce"}</small>
              </li>
            ))}
          </ul>

          {!joined ? (
            <>
              <button type="button" className="sgv-btn sgv-btn--go" disabled={busy} onClick={() => join()}>{busy ? "⏳ Accendo il microfono…" : "🎧 Entra nella chat vocale"}</button>
              <p className="sgv-hint">{isSala ? "Ti sentono tutti quelli entrati in questa sala." : "Vi sentite solo fra voi del gruppo."} Resti collegato cambiando pagina. Il browser chiederà il permesso del microfono.</p>
            </>
          ) : (
            <>
              <p className="sgv-hint">Il microfono si comanda dal tasto accanto alle cuffie, anche a pannello chiuso: {mode === "ptt" ? "«🎙 Tieni premuto» per parlare" : "«🎙 Aperto / 🔇 Muto» per accenderlo e spegnerlo"} · il tondo cambia modo (✋ tieni premuto, 🔓 sempre aperto) · ✕ esce dalla voce.</p>
              <div className="sgv-modes" role="group" aria-label="Modo del microfono">
                <button type="button" className={mode === "ptt" ? "is-on" : ""} aria-pressed={mode === "ptt"} onClick={() => setMode("ptt")}>✋ Tieni premuto</button>
                <button type="button" className={mode === "open" ? "is-on" : ""} aria-pressed={mode === "open"} onClick={() => setMode("open")}>🔓 Sempre aperto</button>
              </div>
              <button type="button" className="sgv-btn" onClick={() => { const v = !speakers; setSpeakers(v); mesh.current?.setSpeakersOn(v); }}>{speakers ? "🔈 Silenzia gli altri" : "🔊 Riattiva l'audio"}</button>
              {!!others.length && Object.values(st.conns).some((c) => c === "relay") && (
                <p className="sgv-hint">ℹ Con chi è «via server» la voce passa dal server del sito: funziona su qualsiasi rete, con circa 1 secondo di ritardo. Intanto si continua a provare il collegamento diretto, più veloce.</p>
              )}
            </>
          )}
          {joined && <button type="button" className="sgv-btn sgv-btn--x" onClick={leave}>✕ Esci dalla chat vocale</button>}
          {joined && (
            <details className="sgv-diag">
              <summary>🔧 Diagnostica (per l'assistenza)</summary>
              <ul>
                {live.map((p) => (
                  <li key={p.uid}><b>{p.name || p.uid.slice(0, 5)}</b>{p.turn ? " · ponte ok" : " · senza ponte"}
                    {Object.entries(p.diag || {}).map(([u, line]) => <div key={u}>{u === "_audio" ? "🔊" : `→ ${live.find((x) => x.uid === u)?.name || u.slice(0, 5)}:`} <code>{line}</code></div>)}
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
    </>
  );
}
