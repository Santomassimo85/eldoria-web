/* Chat vocale di tutta l'app (2026-11-06, prima solo nelle Segrete). Montata una volta in App.jsx,
   quindi resta collegata cambiando pagina. Sta DENTRO la testata (slot #header-voice): non copre
   niente. Nei fight la testata sparisce: cuffie e microfono stanno sotto il ☰ (sempre, anche per entrare).
   Canali: Sala comune (tutti i loggati), stanze create dai giocatori (`voice_rooms`, id vr-*) e, se
   sei in un gruppo delle Segrete, il gruppo.
   Microfono: sempre aperto di base, niente da premere; "Tieni premuto" a scelta (localStorage
   `sgr_voice_mode`). Il motore è src/utils/segreteVoice.js. Una ricarica (anche l'aggiornamento
   automatico) ti rimette nel canale: sessionStorage `vc_resume`, solo in quella scheda e solo se il
   permesso del microfono c'è già. Finché non sei in voce e il pannello è chiuso i presenti si leggono
   ogni 45 s (getDocs), non in diretta: il battito di chi parla costerebbe una lettura a ogni pagina. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isAdminEmail } from "../utils/roles";
import { VoiceMesh, peersCol, makeFreshness } from "../utils/segreteVoice";
import { classInfo, clsStyle } from "../data/segrete";
import "./AppVoice.css";

const SALA = "sala-comune";
const ROOM_FRESH_MS = 2 * 24 * 3600 * 1000; // gruppi fermi da più di 2 giorni: la lobby li nasconde
const msOf = (x) => (x?.toMillis ? x.toMillis() : Number(x) || 0);

const MODE_KEY = "sgr_voice_mode";
const readMode = () => { try { return localStorage.getItem(MODE_KEY) === "ptt" ? "ptt" : "open"; } catch { return "open"; } };
const isVr = (id) => !!id && id.startsWith("vr-");
const VR_FRESH_MS = 7 * 24 * 3600 * 1000; // stanze mai usate da una settimana: non si mostrano più
const RESUME_KEY = "vc_resume";
const RESUME_MS = 10 * 60000;
const saveResume = (room) => { try { sessionStorage.setItem(RESUME_KEY, JSON.stringify({ room, at: Date.now() })); } catch { /* niente */ } };
const dropResume = () => { try { sessionStorage.removeItem(RESUME_KEY); } catch { /* niente */ } };
const readResume = () => {
  try {
    const r = JSON.parse(sessionStorage.getItem(RESUME_KEY) || "null");
    return r?.room && Date.now() - r.at < RESUME_MS ? r.room : null;
  } catch { return null; }
};
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
  const [chan, setChan] = useState(null); // il canale in cui sei: resta quello finché non esci tu
  const picked = pick === SALA || isVr(pick) ? pick : room && (pick === room.id || !pick) ? room.id : SALA;
  const roomId = chan || picked;
  const [myRooms, setMyRooms] = useState(null); // tutti i gruppi in cui sei (anche vecchi): null = non letti
  const [peers, setPeers] = useState([]);
  const [rooms, setRooms] = useState(null); // null = non ancora lette
  const [counts, setCounts] = useState({});
  const [newName, setNewName] = useState("");
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
  const want = useRef(null); // canale in cui vuoi stare: dopo un'uscita non tua (app in secondo piano, ricarica) si rientra
  const holding = useRef(false);

  const watch = open || joined;
  useLayoutEffect(() => { setSlot(docked ? document.getElementById("header-voice") : null); }, [docked, uid]);
  useEffect(() => {
    setName("");
    if (uid) getDoc(doc(db, "characters", uid)).then((s) => setName(s.data()?.name || currentUser?.displayName || "")).catch(() => {});
  }, [uid]);
  // il gruppo delle Segrete in cui sei (il più recente)
  useEffect(() => (uid ? onSnapshot(query(collection(db, "dungeon_rooms"), where("memberIds", "array-contains", uid)), (s) => {
    const all = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    setMyRooms(new Set(all.map((r) => r.id)));
    const list = all.filter((r) => Date.now() - msOf(r.updatedAt) < ROOM_FRESH_MS);
    setRoom(list.sort((a, b) => msOf(b.updatedAt) - msOf(a.updatedAt))[0] || null);
  }, () => { setRoom(null); setMyRooms(null); }) : undefined), [uid]);
  useEffect(() => {
    if (!uid) return undefined;
    const put = (s) => setPeers(s.docs.map((d) => ({ uid: d.id, ...d.data() })));
    if (watch) return onSnapshot(peersCol(roomId), put, () => setPeers([]));
    const load = () => { if (!document.hidden) getDocs(peersCol(roomId)).then(put).catch(() => setPeers([])); };
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, [roomId, uid, watch]);
  // le stanze dei giocatori: si leggono solo a pannello aperto o in voce
  useEffect(() => (uid && watch ? onSnapshot(collection(db, "voice_rooms"), (s) => {
    setRooms(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => Date.now() - (Number(r.at) || 0) < VR_FRESH_MS)
      .sort((a, b) => String(a.name).localeCompare(String(b.name))));
  }, () => setRooms([])) : undefined), [uid, watch]);
  // quanti sono negli altri canali: solo a pannello aperto
  const chanIds = [SALA, ...(room ? [room.id] : []), ...(rooms || []).map((r) => r.id)].join("|");
  useEffect(() => {
    if (!uid || !open) return undefined;
    const offs = chanIds.split("|").map((id) => onSnapshot(peersCol(id), (s) => {
      const n = s.docs.filter((d) => Date.now() - (Number(d.data().at) || 0) < 3 * 60000).length;
      setCounts((c) => (c[id] === n ? c : { ...c, [id]: n }));
    }, () => {}));
    return () => offs.forEach((off) => off());
  }, [uid, open, chanIds]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 10000); return () => clearInterval(t); }, []);
  // CONNESSIONE STABILE (2026-11-07): prima si usciva dalla voce appena il canale "calcolato" cambiava
  // (fine di un fight, gruppo che si aggiorna o sparisce per un attimo). Ora il canale in cui sei è
  // fisso (`chan`): si esce solo col logout, col tasto Esci o se hai davvero lasciato il gruppo.
  useEffect(() => { if (!uid && (mesh.current || want.current)) leave(); }, [uid]);
  useEffect(() => {
    const id = mesh.current?.roomId;
    if (id && id !== SALA && !isVr(id) && myRooms && !myRooms.has(id)) leave();
  }, [myRooms]);
  useEffect(() => {
    if (!pick || pick === SALA || pick === room?.id) return;
    if (!isVr(pick) || (rooms && !joined && !rooms.some((r) => r.id === pick))) setPick(null);
  }, [pick, room?.id, rooms, joined]);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!e.target.closest?.(".sgv-panel, .sgv-pill")) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  // nei fight la pagina lascia libero il posto del microfono
  useEffect(() => {
    document.body.classList.toggle("vc-live", !docked);
    document.body.classList.toggle("vc-on", joined);
    return () => document.body.classList.remove("vc-live", "vc-on");
  }, [joined, docked]);
  useEffect(() => {
    const bye = () => { if (mesh.current) { saveResume(mesh.current.roomId); mesh.current.leave(); mesh.current = null; } };
    // pagina ripresa dalla cache del browser (iPhone): il collegamento è chiuso, si ricarica e si rientra
    const back = (e) => { if (e.persisted && mesh.current?.closed) window.location.reload(); };
    window.addEventListener("pagehide", bye);
    window.addEventListener("pageshow", back);
    return () => { window.removeEventListener("pagehide", bye); window.removeEventListener("pageshow", back); };
  }, []);
  // tornando in primo piano: se il collegamento si è chiuso senza che tu uscissi, si rientra da soli
  useEffect(() => {
    const back = () => {
      if (document.visibilityState !== "visible" || !want.current) return;
      if (!mesh.current || mesh.current.closed) { mesh.current = null; join(want.current); }
      else mesh.current.unlockAudio();
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("online", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("online", back); };
  });
  // qualsiasi tocco sulla pagina risveglia l'audio, non solo i tasti della voce
  useEffect(() => {
    if (!joined) return undefined;
    const wakeUp = () => mesh.current?.unlockAudio();
    document.addEventListener("pointerdown", wakeUp);
    return () => document.removeEventListener("pointerdown", wakeUp);
  }, [joined]);
  // dopo una ricarica si rientra da soli nel canale di prima (mai un microfono che si apre senza permesso)
  const resumed = useRef(false);
  useEffect(() => {
    if (!uid || !name || resumed.current) return;
    const id = readResume();
    if (!id) { resumed.current = true; return; }
    if (id !== SALA && !isVr(id) && room?.id !== id) return; // il gruppo si sta ancora leggendo
    resumed.current = true;
    want.current = id;
    // nell'app Android la domanda sul permesso spesso non funziona: si prova lo stesso
    // (il permesso l'app lo ha già dato); nel browser solo se il permesso c'è già
    if (!navigator.permissions?.query) { join(id); return; }
    navigator.permissions.query({ name: "microphone" })
      .then((p) => { if (p.state === "granted" || (p.state !== "denied" && window.Capacitor?.isNativePlatform?.())) join(id); else want.current = null; })
      .catch(() => join(id));
  }, [uid, name, room?.id]);

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
      const m = new VoiceMesh({ roomId: id, uid, name, onState: setSt, onTaken: () => {
        leave({ keep: true });
        want.current = null;
        setErr("Sei entrato in voce da un'altra scheda o da un altro dispositivo: qui ti ho scollegato.");
        setOpen(true);
      } });
      await m.join();
      mesh.current = m;
      want.current = id; setChan(id);
      saveResume(id);
      if (isVr(id)) updateDoc(doc(db, "voice_rooms", id), { at: Date.now() }).catch(() => {});
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
  const leave = async (opts) => {
    const m = mesh.current; mesh.current = null;
    want.current = null; setChan(null);
    dropResume();
    setJoined(false); setMicOn(false); setSt({ conns: {}, levels: {} });
    await m?.leave(opts);
  };

  const choose = async (id) => {
    if (id === roomId) return;
    const was = !!mesh.current;
    setPick(id);
    if (was) { await leave(); join(id); }
  };

  const createRoom = async (e) => {
    e.preventDefault();
    const clean = newName.trim().slice(0, 30);
    if (!clean || busy) return;
    const id = `vr-${Math.random().toString(36).slice(2, 10)}`;
    setErr("");
    try {
      await setDoc(doc(db, "voice_rooms", id), { name: clean, by: uid, byName: name || "", at: Date.now() });
      setNewName("");
      setPick(id);
      if (mesh.current) await leave();
      join(id);
    } catch { setErr("Non sono riuscito a creare la stanza: riprova."); }
  };
  const removeRoom = (id) => {
    if (roomId === id) setPick(null);
    deleteDoc(doc(db, "voice_rooms", id)).catch(() => setErr("Non sono riuscito a togliere la stanza."));
  };

  // push-to-talk: tieni premuto (dito o mouse)
  const pttDown = (e) => { e.preventDefault(); holding.current = true; applyMic(true); };
  const pttUp = () => { if (!holding.current) return; holding.current = false; applyMic(false); };

  const speaking = (u) => joined && (st.levels[u] || 0) > SPEAK && (u !== uid || micOn);
  const talkingNow = live.filter((p) => !p.muted && speaking(p.uid));
  const isSala = roomId === SALA;
  const isOpenChan = isSala || isVr(roomId);
  const chanName = isSala ? "Sala comune" : isVr(roomId) ? rooms?.find((r) => r.id === roomId)?.name || "Stanza" : room?.name || "Il mio gruppo";
  const canRemove = (r) => (r.by === uid || isAdminEmail(currentUser?.email)) && !counts[r.id];
  const channels = [
    { id: SALA, icon: "🍺", name: "Sala comune" },
    ...(room ? [{ id: room.id, icon: "🗝", name: room.name || "Il mio gruppo" }] : []),
    ...(rooms || []).map((r) => ({ id: r.id, icon: "🎙", name: r.name, room: r })),
  ];
  const members = isOpenChan ? live.map((p) => ({ uid: p.uid, name: p.name })) : room?.members || [];
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
    <div className={`sgv${joined ? " is-joined" : inVoice.size ? " has-people" : ""}`} onPointerDown={() => mesh.current?.unlockAudio()}>
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
      {docked ? (slot ? createPortal(bar, slot) : null) : createPortal(<div className="sgv-fight">{bar}</div>, document.body)}
      {open && createPortal(
        <div className={`sgv-panel${docked ? "" : " sgv-panel--fight"}`} role="dialog" aria-label="Chat vocale">
          <ul className="sgv-chans" aria-label="Canali vocali">
            {channels.map((c) => (
              <li key={c.id}>
                <button type="button" className={c.id === roomId ? "is-on" : ""} aria-pressed={c.id === roomId} disabled={busy} onClick={() => choose(c.id)}>
                  <span aria-hidden="true">{c.icon}</span>
                  <span className="sgv-chan-name">{c.name}</span>
                  {!!counts[c.id] && <em>{counts[c.id]}</em>}
                </button>
                {c.room && canRemove(c.room) && <button type="button" className="sgv-chan-x" aria-label={`Togli la stanza ${c.name}`} title="Togli la stanza" onClick={() => removeRoom(c.id)}>✕</button>}
              </li>
            ))}
          </ul>
          <form className="sgv-new" onSubmit={createRoom}>
            <input value={newName} maxLength={30} placeholder="Nome della nuova stanza" aria-label="Nome della nuova stanza" onChange={(e) => setNewName(e.target.value)} />
            <button type="submit" disabled={busy || !newName.trim()}>＋ Crea</button>
          </form>
          <p className="sgv-title">{chanName}</p>
          {isOpenChan && !roster.length && <p className="sgv-hint">Non c'è ancora nessuno in voce.</p>}
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
              <button type="button" className="sgv-btn sgv-btn--go" disabled={busy} onClick={() => join()}>{busy ? "⏳ Accendo il microfono…" : `🎧 Entra in ${chanName}`}</button>
              <p className="sgv-hint">{isOpenChan ? "Ti sente chiunque entri in questo canale." : "Vi sentite solo fra voi del gruppo."} {mode === "open" ? "Entri col microfono aperto: parli e basta, niente da premere." : "Per parlare tieni premuto il tasto del microfono."} Resti collegato su ogni pagina. La prima volta il browser chiede il permesso del microfono.</p>
            </>
          ) : (
            <>
              <p className="sgv-hint">{mode === "ptt" ? "Tieni premuto il tasto 🎙 accanto alle cuffie per parlare." : "Parli e ti sentono, su qualsiasi pagina. Il tasto 🎙 accanto alle cuffie mette il muto."}</p>
              <div className="sgv-modes" role="group" aria-label="Modo del microfono">
                <button type="button" className={mode === "open" ? "is-on" : ""} aria-pressed={mode === "open"} onClick={() => setMode("open")}>🔓 Sempre aperto</button>
                <button type="button" className={mode === "ptt" ? "is-on" : ""} aria-pressed={mode === "ptt"} onClick={() => setMode("ptt")}>✋ Tieni premuto</button>
              </div>
              <button type="button" className="sgv-btn" onClick={() => { const v = !speakers; setSpeakers(v); mesh.current?.setSpeakersOn(v); }}>{speakers ? "🔈 Silenzia gli altri" : "🔊 Riattiva l'audio"}</button>
              {!!others.length && Object.values(st.conns).some((c) => c === "relay") && (
                <p className="sgv-hint">ℹ Con chi è «via server» la voce passa dal server del sito: funziona su qualsiasi rete, con poco più di 1 secondo di ritardo. Intanto si continua a provare il collegamento diretto, più veloce.</p>
              )}
            </>
          )}
          {joined && <button type="button" className="sgv-btn sgv-btn--x" onClick={() => leave()}>✕ Esci dalla chat vocale</button>}
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
        </div>, document.body
      )}
    </>
  );
}
