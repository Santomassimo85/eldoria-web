// src/pages/Tarocchi.jsx
//
// "Alaric, l'oracolo bendato" — lettura dei Tarocchi (Arcani Maggiori).
//
// RUOLI
//   • Alaric (PG, riconosciuto per nome) = ORACOLO REALE: volta le carte, le sue
//     azioni vengono salvate su Firestore e il cambio dorso è GLOBALE per tutti.
//   • Master + co-master = MODALITÀ PROVA LOCALE: stesso banco ma in sandbox
//     (nessuna scrittura su Firestore); il dorso si cambia solo in preview locale.
//   • Tutti gli altri = RICHIEDENTI.
//
// FLUSSO
//   Un richiedente sceglie LIVE o DIFFERITA.
//     – Differita: invia richiesta → push ad Alaric → Alaric risponde → push al
//       richiedente, che legge il responso in cronologia.
//     – Live: invia richiesta → push ad Alaric → quando Alaric avvia, il
//       richiedente (spettatore) vede in DIRETTA mischiata, pesca e spiegazione
//       di ogni carta, via onSnapshot.
//   Limite: 1 richiesta/giorno per giocatore. Cronologia visibile a richiedente,
//   Alaric e Master.
//
// BANCO: niente selettore quantità. Si mischia, poi si pesca UNA carta alla
// volta dal mazzo (max 3), si scopre, si sceglie se mostrare il significato e/o
// si scrive una nota; infine un messaggio dell'Oracolo. "Concludi" invia tutto.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, doc,
  getDoc, getDocs, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { notifyUser } from "../utils/notify";
import {
  ARCANI, ARCANO_BY_N, STESE, MAX_CARDS,
  CARD_BACKS, DEFAULT_BACK, cardBackSrc, cardFaceSrc,
  ORACLE_MASTER_EMAIL, ORACLE_COMASTER_EMAIL, isAlaricName, ALARIC_PORTRAIT,
} from "../data/tarocchi";
import { FRASI } from "../data/tarocchiFrasi";
import useParallaxScroll from "../hooks/useParallaxScroll";
import AmbientFX from "../components/AmbientFX";
import "../styles/cinematic.css";
import "./Tarocchi.css";

const HERO_IMAGE = "/assets/arcano.png";
const LOCAL_BACK_KEY = "oracleBackPreview";

/* ── utility ─────────────────────────────────────────────────────────────── */
function tsToMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime();
}
function sameLocalDay(ts) {
  const ms = tsToMs(ts);
  if (!ms) return false;
  const d = new Date(ms), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function fmtDate(ts) {
  const ms = tsToMs(ts);
  if (!ms) return "";
  return new Date(ms).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function ruoliFor(count) { return (STESE[count] || {}).ruoli || []; }
function titoloFor(count) { return (STESE[count] || STESE[3]).titolo; }

// Pesca un Arcano non ancora uscito, con orientamento casuale.
function pescaUna(esclusi) {
  const pool = ARCANI.filter((a) => !esclusi.includes(a.n));
  const a = pool[Math.floor(Math.random() * pool.length)];
  return { n: a.n, rovesciata: Math.random() < 0.5, revealed: false, showMeaning: true, note: "" };
}

function buildResponso(cards, message) {
  const ruoli = ruoliFor(cards.length);
  const lines = cards.map((c, i) => {
    const a = ARCANO_BY_N[c.n];
    const ruolo = ruoli[i] || `Carta ${i + 1}`;
    const orient = c.rovesciata ? "Rovescio" : "Dritto";
    const senso = c.showMeaning ? (c.rovesciata ? a.rovescio : a.dritto) : "";
    const note = c.note ? ` ✎ ${c.note}` : "";
    return `${ruolo}: ${a.nome} (${orient})${senso ? ` — ${senso}` : ""}${note}`;
  });
  if (message && message.trim()) lines.push(`\n${message.trim()}`);
  return lines.join("\n");
}

/* ── Carta con flip (banco + spettatore) ─────────────────────────────────── */
function FlipCard({ card, ruolo, back, dealIndex = 0, onReveal, children }) {
  const a = ARCANO_BY_N[card.n];
  const [imgFace, setImgFace] = useState(true);
  const [imgBack, setImgBack] = useState(true);
  return (
    <figure className="taro-slot taro-slot--deal" style={{ "--deal-index": dealIndex }}>
      {ruolo && <span className="taro-role">{ruolo}</span>}
      <div
        className={`taro-card${card.revealed ? " is-revealed" : ""}${onReveal && !card.revealed ? " is-clickable" : ""}`}
        onClick={onReveal && !card.revealed ? onReveal : undefined}
        title={onReveal && !card.revealed ? "Scopri" : undefined}
      >
        <div className="taro-card-inner">
          <div className="taro-face taro-face--back">
            {imgBack ? (
              <img src={cardBackSrc(back)} alt="" onError={() => setImgBack(false)} />
            ) : (
              <div className="taro-placeholder taro-placeholder--back" aria-hidden="true"><span className="taro-ph-star">✦</span></div>
            )}
          </div>
          <div className={`taro-face taro-face--front${card.rovesciata ? " is-reversed" : ""}`}>
            {imgFace ? (
              <img src={cardFaceSrc(card.n)} alt={a?.nome} onError={() => setImgFace(false)} />
            ) : (
              <div className="taro-placeholder taro-placeholder--front" aria-hidden="true">
                <span className="taro-ph-glifo">{a?.glifo}</span>
                <span className="taro-ph-simbolo">{a?.simbolo}</span>
                <span className="taro-ph-nome">{a?.nome}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {children}
    </figure>
  );
}

/* ── Vista carta "spiegata" (spettatore / responso live) ─────────────────── */
function CardExplain({ card, ruolo }) {
  const a = ARCANO_BY_N[card.n];
  if (!a || !card.revealed) return null;
  const senso = card.rovesciata ? a.rovescio : a.dritto;
  return (
    <figcaption className="taro-caption">
      <span className="taro-cap-nome">{a.nome}</span>
      <span className={`taro-cap-orient taro-cap-orient--${card.rovesciata ? "rov" : "dir"}`}>{card.rovesciata ? "Rovescio" : "Dritto"}</span>
      {card.showMeaning && <span className="taro-cap-senso">{senso}</span>}
      {card.note ? <span className="taro-cap-note">✎ {card.note}</span> : null}
    </figcaption>
  );
}

/* ── Mini-carta statica (cronologia) ─────────────────────────────────────── */
function MiniArcano({ card, ruolo }) {
  const a = ARCANO_BY_N[card.n];
  const [img, setImg] = useState(true);
  if (!a) return null;
  const senso = card.rovesciata ? a.rovescio : a.dritto;
  return (
    <div className="taro-mini">
      {ruolo && <span className="taro-mini-role">{ruolo}</span>}
      <div className={`taro-mini-fig${card.rovesciata ? " is-reversed" : ""}`}>
        {img ? <img src={cardFaceSrc(card.n)} alt={a.nome} onError={() => setImg(false)} />
             : <div className="taro-mini-ph"><span>{a.glifo}</span><b>{a.simbolo}</b></div>}
      </div>
      <span className="taro-mini-nome">{a.nome}</span>
      <span className={`taro-cap-orient taro-cap-orient--${card.rovesciata ? "rov" : "dir"}`}>{card.rovesciata ? "Rovescio" : "Dritto"}</span>
      {card.showMeaning !== false && <span className="taro-mini-senso">{senso}</span>}
      {card.note ? <span className="taro-mini-note">✎ {card.note}</span> : null}
    </div>
  );
}

/* ── Responso salvato (cronologia) ───────────────────────────────────────── */
function ResponsoSalvato({ reading, showRequester }) {
  const ruoli = ruoliFor((reading.cards || []).length);
  return (
    <article className="taro-hist-card">
      <header className="taro-hist-head">
        <div>
          {showRequester && <span className="taro-hist-who">Per {reading.requesterName || "Anonimo"}</span>}
          <span className="taro-hist-title">{reading.steseTitolo || titoloFor((reading.cards || []).length)}</span>
          {reading.mode === "live" && <span className="taro-badge taro-badge--live">LIVE</span>}
        </div>
        <span className="taro-hist-date">{fmtDate(reading.answeredAt || reading.createdAt)}</span>
      </header>
      {reading.question ? <p className="taro-hist-q">«{reading.question}»</p> : null}
      <div className="taro-mini-row">
        {(reading.cards || []).map((c, i) => (
          <MiniArcano key={`${c.n}-${i}`} card={c} ruolo={ruoli[i] || `Carta ${i + 1}`} />
        ))}
      </div>
      {reading.customMessage ? <p className="taro-hist-msg">“{reading.customMessage}”</p> : null}
      {reading.answeredByName && <footer className="taro-hist-foot">Lettura voltata da <strong>{reading.answeredByName}</strong></footer>}
    </article>
  );
}

/* ── Pila del mazzo (deck) ───────────────────────────────────────────────── */
function DeckPile({ back, shuffling, count = 4 }) {
  return (
    <div className={`taro-deck${shuffling ? " is-shuffling" : ""}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="taro-deck-card" style={{ "--d": i }}>
          <img src={cardBackSrc(back)} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function Tarocchi() {
  useParallaxScroll();
  const { currentUser } = useAuth();

  // Ruoli
  const [myName, setMyName] = useState("");
  const [alaricUid, setAlaricUid] = useState(null);
  const [roleReady, setRoleReady] = useState(false);

  const email = currentUser?.email || "";
  const isMaster = email === ORACLE_MASTER_EMAIL;
  const isComaster = email === ORACLE_COMASTER_EMAIL;
  const isAlaric = isAlaricName(myName);
  const isTester = isMaster || isComaster;            // prova locale
  const privileged = isAlaric || isTester;

  useEffect(() => {
    if (!currentUser) { setRoleReady(true); return; }
    let alive = true;
    (async () => {
      try { const me = await getDoc(doc(db, "characters", currentUser.uid)); if (alive && me.exists()) setMyName(me.data().name || ""); } catch { /* ignora */ }
      try { const all = await getDocs(collection(db, "characters")); const al = all.docs.find((d) => isAlaricName(d.data().name)); if (alive && al) setAlaricUid(al.id); } catch { /* ignora */ }
      if (alive) setRoleReady(true);
    })();
    return () => { alive = false; };
  }, [currentUser]);

  // ── Dorso globale (Firestore) + preview locale (Master) ─────────────────
  const [globalBack, setGlobalBack] = useState(DEFAULT_BACK);
  const [localBack, setLocalBack] = useState(() => { try { return localStorage.getItem(LOCAL_BACK_KEY) || null; } catch { return null; } });
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "oracle"), (snap) => {
      const b = snap.exists() && snap.data().back;
      if (b && CARD_BACKS.includes(b)) setGlobalBack(b);
    }, () => {});
    return () => unsub();
  }, []);
  const effectiveBack = (isTester && localBack) ? localBack : globalBack;

  const cambiaDorso = async (file) => {
    if (isAlaric) {
      try { await setDoc(doc(db, "settings", "oracle"), { back: file, updatedAt: serverTimestamp(), by: myName || "Alaric" }, { merge: true }); } catch (e) { console.warn("[oracolo] dorso:", e); }
    } else if (isTester) {
      try { localStorage.setItem(LOCAL_BACK_KEY, file); } catch { /* ignora */ }
      setLocalBack(file);
    }
  };
  const resetDorsoLocale = () => { try { localStorage.removeItem(LOCAL_BACK_KEY); } catch { /* ignora */ } setLocalBack(null); };

  // ── Cronologia / letture ────────────────────────────────────────────────
  const [readings, setReadings] = useState([]);
  useEffect(() => {
    if (!currentUser || !roleReady) return;
    const q = privileged
      ? query(collection(db, "oracle_readings"))
      : query(collection(db, "oracle_readings"), where("requesterUid", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => tsToMs(b.createdAt) - tsToMs(a.createdAt));
      setReadings(arr);
    }, () => {});
    return () => unsub();
  }, [currentUser, roleReady, privileged]);

  // ── Richiedente ─────────────────────────────────────────────────────────
  const [question, setQuestion] = useState("");
  const myReadings = readings.filter((r) => r.requesterUid === currentUser?.uid);
  const myPending = myReadings.find((r) => r.status === "pending");
  const myLive = myReadings.find((r) => r.status === "live");
  const requestedToday = myReadings.some((r) => sameLocalDay(r.createdAt));
  const canRequest = !myPending && !myLive && !requestedToday;

  const richiediLettura = useCallback(async (mode) => {
    if (!currentUser || !canRequest) return;
    try {
      await addDoc(collection(db, "oracle_readings"), {
        requesterUid: currentUser.uid,
        requesterName: myName || currentUser.email || "Anonimo",
        mode, status: "pending",
        question: question.trim(),
        cards: [], customMessage: "", responso: "", num: 0, steseTitolo: "", shuffled: false,
        createdAt: serverTimestamp(), answeredAt: null, answeredByName: "",
      });
      if (alaricUid) {
        notifyUser(
          alaricUid,
          mode === "live" ? "🔮 Richiesta di lettura LIVE" : "🔮 Nuova richiesta all'Oracolo",
          `${myName || "Un viandante"} chiede una lettura ${mode === "live" ? "in diretta" : "differita"} ad Alaric.`
        );
      }
      setQuestion("");
    } catch (e) { console.warn("[oracolo] richiesta fallita:", e); }
  }, [currentUser, canRequest, myName, question, alaricUid]);

  // ── Banco di lettura (Alaric reale / Master sandbox) ────────────────────
  const [activeReq, setActiveReq] = useState(null);   // richiesta evasa (Alaric)
  const [sandbox, setSandbox] = useState(false);       // prova locale (Master)
  const [shuffling, setShuffling] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [drawn, setDrawn] = useState([]);
  const [oracleMessage, setOracleMessage] = useState("");
  const [inviato, setInviato] = useState(false);
  const [aiFrasi, setAiFrasi] = useState({});     // { [cardIndex]: string[] }
  const [aiLoading, setAiLoading] = useState({}); // { [cardIndex]: bool }
  const shuffleTimer = useRef(null);

  const realSession = isAlaric && !!activeReq && !sandbox;

  const persist = useCallback(async (patch) => {
    if (!realSession) return;
    try { await updateDoc(doc(db, "oracle_readings", activeReq.id), patch); } catch (e) { console.warn("[oracolo] persist:", e); }
  }, [realSession, activeReq]);

  const resetBanco = () => {
    setShuffled(false); setShuffling(false); setDrawn([]); setOracleMessage(""); setInviato(false);
    setAiFrasi({}); setAiLoading({});
    if (shuffleTimer.current) clearTimeout(shuffleTimer.current);
  };

  // Frasi pronte (statiche) per la carta nel suo orientamento.
  const frasiPronte = (card) => (FRASI[card.n]?.[card.rovesciata ? "rovescio" : "dritto"]) || [];

  // Genera al volo 3 frasi con l'IA (Gemini) per la carta scoperta.
  const generaFrasi = async (i, card) => {
    const a = ARCANO_BY_N[card.n];
    setAiLoading((s) => ({ ...s, [i]: true }));
    try {
      const r = await fetch("/api/oracolo-frasi", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          carta: a?.nome, orientamento: card.rovesciata ? "rovescio" : "dritto",
          significato: card.rovesciata ? a?.rovescio : a?.dritto,
          domanda: activeReq?.question || "", richiedente: activeReq?.requesterName || "",
        }),
      });
      const data = await r.json();
      if (Array.isArray(data.frasi)) setAiFrasi((s) => ({ ...s, [i]: [...(s[i] || []), ...data.frasi] }));
    } catch { /* ignora */ }
    setAiLoading((s) => ({ ...s, [i]: false }));
  };

  const usaFrase = (i, frase) => mutateCard(i, { note: frase });

  const apriRichiesta = (req, live) => {
    setSandbox(false); setActiveReq(req); resetBanco();
    document.getElementById("taro-banco")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (isAlaric && live) {
      updateDoc(doc(db, "oracle_readings", req.id), { status: "live", cards: [], shuffled: false, customMessage: "" }).catch(() => {});
      notifyUser(req.requesterUid, "🔮 La lettura sta iniziando", `${myName || "Alaric"} ha avviato la tua lettura in diretta. Apri l'Oracolo per assistere.`);
    }
  };
  const apriSandbox = () => { setActiveReq(null); setSandbox(true); resetBanco(); document.getElementById("taro-banco")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const chiudiBanco = () => { setActiveReq(null); setSandbox(false); resetBanco(); };

  const mischia = () => {
    setShuffling(true); setDrawn([]); setShuffled(false);
    if (shuffleTimer.current) clearTimeout(shuffleTimer.current);
    shuffleTimer.current = setTimeout(() => {
      setShuffling(false); setShuffled(true);
      persist({ shuffled: true, cards: [], status: activeReq?.mode === "live" ? "live" : "pending" });
    }, 750);
  };

  const pesca = () => {
    if (!shuffled || drawn.length >= MAX_CARDS) return;
    const card = pescaUna(drawn.map((c) => c.n));
    const next = [...drawn, card];
    setDrawn(next);
    persist({ cards: next, shuffled: true, status: activeReq?.mode === "live" ? "live" : "pending" });
  };

  const mutateCard = (i, patch) => {
    const next = drawn.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    setDrawn(next);
    persist({ cards: next });
  };
  const scopri = (i) => mutateCard(i, { revealed: true });
  const toggleMeaning = (i) => mutateCard(i, { showMeaning: !drawn[i].showMeaning });
  const setNota = (i, note) => setDrawn((d) => d.map((c, idx) => (idx === i ? { ...c, note } : c)));
  const flushNota = (i) => persist({ cards: drawn });
  const flushMessage = () => persist({ customMessage: oracleMessage });

  const concludi = useCallback(async () => {
    const revealedCards = drawn.filter((c) => c.revealed);
    if (revealedCards.length === 0) return;
    const responso = buildResponso(drawn, oracleMessage);
    if (realSession) {
      try {
        await updateDoc(doc(db, "oracle_readings", activeReq.id), {
          status: "answered", cards: drawn, customMessage: oracleMessage, responso,
          num: drawn.length, steseTitolo: titoloFor(drawn.length),
          answeredAt: serverTimestamp(), answeredByName: myName || "L'Oracolo",
        });
        notifyUser(activeReq.requesterUid, "🔮 Il tuo responso è pronto", `${myName || "Alaric"} ha voltato le carte per te. Apri l'Oracolo per scoprirlo.`);
      } catch (e) { console.warn("[oracolo] concludi:", e); }
    }
    setInviato(true);
    setActiveReq(null);
  }, [drawn, oracleMessage, realSession, activeReq, myName]);

  const pendingReqs = readings.filter((r) => r.status === "pending");
  const liveReqs = readings.filter((r) => r.status === "live");

  /* ── HERO ───────────────────────────────────────────────────────────── */
  const Hero = (
    <section className="taro-hero" aria-label="Alaric, l'oracolo bendato">
      <div className="taro-hero-media" aria-hidden="true">
        <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      </div>
      <div className="taro-hero-wash" aria-hidden="true" />
      <div className="taro-hero-plate">
        <figure className="taro-hero-portrait">
          <img src={ALARIC_PORTRAIT} alt="Alaric Voltasorte" onError={(e) => { e.currentTarget.closest(".taro-hero-portrait").style.display = "none"; }} />
          <span className="taro-hero-blind" aria-hidden="true" />
        </figure>
        <div className="taro-hero-text">
          <span className="taro-hero-seal">✦ Arcani Maggiori</span>
          <h1 className="taro-hero-title">Alaric,<br />l'oracolo bendato</h1>
          <p className="taro-hero-tagline">Gli occhi velati non vedono il mondo, ma leggono il destino. Poni la tua domanda e lascia che le lame parlino.</p>
        </div>
      </div>
    </section>
  );

  if (!currentUser && roleReady) {
    return (
      <section className="cine-page taro-page cine-compact" style={{ "--cine-accent": "#6f44c9", "--cine-accent-2": "#8a63dd" }}>
        <AmbientFX variant="cosmos" />{Hero}
        <section className="taro-section"><div className="taro-empty"><span className="taro-empty-glifo">✦</span><p>Accedi per consultare Alaric, l'oracolo bendato.</p></div></section>
      </section>
    );
  }

  /* ── Selettore dorso (privilegiati) ─────────────────────────────────── */
  const BackPicker = privileged && (
    <section className="taro-section" aria-label="Dorso delle carte">
      <header className="taro-sec-head">
        <span className="taro-sec-eyebrow">Il Mazzo</span>
        <h2 className="taro-sec-title">Dorso delle carte</h2>
        <p className="taro-sec-lead">
          {isAlaric ? "La tua scelta vale per tutti, ovunque." : "Anteprima locale di prova: non cambia il dorso per gli altri."}
        </p>
      </header>
      <div className="taro-backs">
        {CARD_BACKS.map((b) => (
          <button key={b} type="button" className={`taro-back-opt${effectiveBack === b ? " is-active" : ""}`} onClick={() => cambiaDorso(b)} title={b}>
            <img src={cardBackSrc(b)} alt={b} onError={(e) => { e.currentTarget.style.opacity = ".2"; }} />
            {globalBack === b && <span className="taro-back-flag">Globale</span>}
          </button>
        ))}
      </div>
      {isTester && localBack && <button type="button" className="taro-link-btn" onClick={resetDorsoLocale}>Torna al dorso globale</button>}
    </section>
  );

  /* ── BANCO (componente) ─────────────────────────────────────────────── */
  const Banco = (
    <section id="taro-banco" className="taro-section" aria-label="Banco di lettura">
      <header className="taro-sec-head">
        <span className="taro-sec-eyebrow">Il Tavolo {sandbox ? "· prova locale" : activeReq?.mode === "live" ? "· diretta" : ""}</span>
        <h2 className="taro-sec-title">
          {activeReq ? `Lettura per ${activeReq.requesterName}` : sandbox ? "Prova del banco" : "Banco di lettura"}
        </h2>
        <p className="taro-sec-lead">
          {activeReq?.mode === "live"
            ? "Mischia, pesca una carta alla volta e scoprila: il richiedente vede tutto in diretta."
            : activeReq
            ? "Mischia, pesca e scopri le carte; poi concludi per inviare il responso."
            : "Mischia il mazzo e pesca fino a 3 carte. (Modalità di prova: niente invio.)"}
        </p>
      </header>

      {activeReq && (
        <div className="taro-active-banner">
          Stai leggendo per <strong>{activeReq.requesterName}</strong>
          {activeReq.question ? <em> · «{activeReq.question}»</em> : null}
          <button type="button" className="taro-active-x" onClick={chiudiBanco} aria-label="Chiudi">✕</button>
        </div>
      )}

      <div className="taro-table">
        <div className="taro-deck-col">
          <DeckPile back={effectiveBack} shuffling={shuffling} />
          <div className="taro-deck-actions">
            <button type="button" className="taro-draw taro-draw--sm" onClick={mischia}>Mischia</button>
            <button type="button" className="taro-draw taro-draw--sm" onClick={pesca} disabled={!shuffled || drawn.length >= MAX_CARDS}>
              Pesca {drawn.length > 0 ? `(${drawn.length}/${MAX_CARDS})` : ""}
            </button>
          </div>
        </div>

        <div className="taro-board">
          {drawn.length === 0 ? (
            <div className="taro-empty taro-empty--inline"><span className="taro-empty-glifo">✦</span>
              <p>{shuffled ? "Mazzo mischiato. Pesca la prima carta." : "Mischia il mazzo per cominciare."}</p>
            </div>
          ) : (
            <div className={`taro-spread taro-spread--${drawn.length}`}>
              {drawn.map((c, i) => {
                const ruolo = ruoliFor(Math.max(drawn.length, 1))[i] || `Carta ${i + 1}`;
                return (
                  <FlipCard key={`${c.n}-${i}`} card={c} ruolo={ruolo} back={effectiveBack} dealIndex={i} onReveal={() => scopri(i)}>
                    {c.revealed && (
                      <div className="taro-card-tools">
                        <label className="taro-tool-chk">
                          <input type="checkbox" checked={c.showMeaning !== false} onChange={() => toggleMeaning(i)} />
                          Mostra significato
                        </label>

                        <div className="taro-frasi">
                          <span className="taro-frasi-lbl">Frasi pronte</span>
                          {frasiPronte(c).map((f, k) => (
                            <button key={`s${k}`} type="button"
                              className={`taro-chip${c.note === f ? " is-picked" : ""}`}
                              onClick={() => usaFrase(i, f)}>{f}</button>
                          ))}
                          {(aiFrasi[i] || []).map((f, k) => (
                            <button key={`a${k}`} type="button"
                              className={`taro-chip taro-chip--ai${c.note === f ? " is-picked" : ""}`}
                              onClick={() => usaFrase(i, f)}>{f}</button>
                          ))}
                          <button type="button" className="taro-chip-gen" onClick={() => generaFrasi(i, c)} disabled={!!aiLoading[i]}>
                            {aiLoading[i] ? "Genero…" : "Genera con l'IA"}
                          </button>
                        </div>

                        <textarea
                          className="taro-tool-note" placeholder="…oppure scrivi tu la frase" value={c.note || ""}
                          rows={2} maxLength={240}
                          onChange={(e) => setNota(i, e.target.value)} onBlur={() => flushNota(i)}
                        />
                        <CardExplain card={c} />
                      </div>
                    )}
                  </FlipCard>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {drawn.length > 0 && (
        <div className="taro-message-box">
          <label htmlFor="taro-msg">Messaggio dell'Oracolo (facoltativo)</label>
          <textarea id="taro-msg" className="taro-q-input" rows={2} maxLength={400}
            placeholder="Le parole di Alaric al richiedente…"
            value={oracleMessage} onChange={(e) => setOracleMessage(e.target.value)} onBlur={flushMessage} />
          <div className="taro-conclude-row">
            {activeReq ? (
              <button type="button" className="taro-send" onClick={concludi} disabled={!drawn.some((c) => c.revealed)}>
                Concludi e invia a {activeReq.requesterName.split(" ")[0]}
              </button>
            ) : (
              <span className="taro-sandbox-note">Modalità di prova — il responso non viene inviato.</span>
            )}
          </div>
        </div>
      )}
      {inviato && <p className="taro-sent-ok">✓ Responso inviato. Il richiedente è stato avvisato.</p>}
    </section>
  );

  return (
    <section className="cine-page taro-page cine-compact" style={{ "--cine-accent": "#6f44c9", "--cine-accent-2": "#8a63dd" }}>
      <AmbientFX variant="cosmos" />
      {Hero}

      {privileged ? (
        <>
          {/* Richieste (solo Alaric agisce; il Master è in prova locale) */}
          <section className="taro-section" aria-label="Richieste">
            <header className="taro-sec-head">
              <span className="taro-sec-eyebrow">Il velo dell'Oracolo</span>
              <h2 className="taro-sec-title">Richieste {isTester ? "(in sola lettura)" : "in attesa"}</h2>
              <p className="taro-sec-lead">
                {isTester
                  ? "Sei in modalità prova locale: le richieste reali le gestisce Alaric. Qui sotto puoi provare il banco."
                  : (pendingReqs.length + liveReqs.length) === 0
                  ? "Nessun viandante attende un responso, per ora."
                  : "Scegli chi servire: avvia una lettura live o rispondi a una richiesta differita."}
              </p>
            </header>

            {!isTester && (pendingReqs.length + liveReqs.length) > 0 && (
              <ul className="taro-queue">
                {[...liveReqs, ...pendingReqs].map((r) => (
                  <li key={r.id} className={`taro-queue-item${activeReq?.id === r.id ? " is-active" : ""}${r.mode === "live" ? " is-live" : ""}`}>
                    <div className="taro-queue-info">
                      <span className="taro-queue-name">{r.requesterName || "Anonimo"}</span>
                      {r.mode === "live" && <span className="taro-badge taro-badge--live">LIVE</span>}
                      {r.status === "live" && <span className="taro-badge taro-badge--onair">IN CORSO</span>}
                      <span className="taro-queue-date">{fmtDate(r.createdAt)}</span>
                      {r.question ? <p className="taro-queue-q">«{r.question}»</p> : <p className="taro-queue-q taro-queue-q--none">Nessuna domanda scritta.</p>}
                    </div>
                    <button type="button" className="taro-draw taro-draw--sm" onClick={() => apriRichiesta(r, r.mode === "live")}>
                      {r.mode === "live" ? (r.status === "live" ? "Riprendi" : "Avvia live") : "Leggi"} per {(r.requesterName || "lui").split(" ")[0]}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {isTester && <button type="button" className="taro-draw" onClick={apriSandbox}>Prova il banco (locale)</button>}
          </section>

          {BackPicker}
          {(activeReq || sandbox) && Banco}

          {/* Cronologia */}
          <section className="taro-section" aria-label="Cronologia">
            <header className="taro-sec-head"><span className="taro-sec-eyebrow">Archivio</span><h2 className="taro-sec-title">Cronologia delle letture</h2></header>
            {readings.filter((r) => r.status === "answered").length === 0 ? (
              <div className="taro-empty"><p>Ancora nessun responso registrato.</p></div>
            ) : (
              <div className="taro-hist">{readings.filter((r) => r.status === "answered").map((r) => <ResponsoSalvato key={r.id} reading={r} showRequester />)}</div>
            )}
          </section>
        </>
      ) : (
        /* ════════ RICHIEDENTE ════════ */
        <>
          {/* Lettura LIVE in corso → spettatore */}
          {myLive && (
            <section className="taro-section" aria-label="Lettura in diretta">
              <header className="taro-sec-head">
                <span className="taro-sec-eyebrow">In diretta con Alaric</span>
                <h2 className="taro-sec-title">La tua lettura, ora</h2>
                <p className="taro-sec-lead">Alaric sta voltando le carte per te. Osserva.</p>
              </header>
              <div className="taro-table taro-table--spectate">
                <div className="taro-deck-col"><DeckPile back={effectiveBack} shuffling={false} />
                  <p className="taro-spectate-state">{(myLive.cards || []).length === 0 ? (myLive.shuffled ? "Il mazzo è mischiato…" : "Alaric sta mischiando…") : "Le lame parlano…"}</p>
                </div>
                <div className="taro-board">
                  {(myLive.cards || []).length === 0 ? (
                    <div className="taro-empty taro-empty--inline"><span className="taro-empty-glifo">✦</span><p>In attesa della prima carta…</p></div>
                  ) : (
                    <div className={`taro-spread taro-spread--${myLive.cards.length}`}>
                      {myLive.cards.map((c, i) => (
                        <FlipCard key={`${c.n}-${i}`} card={c} ruolo={ruoliFor(myLive.cards.length)[i] || `Carta ${i + 1}`} back={effectiveBack} dealIndex={i}>
                          <CardExplain card={c} />
                        </FlipCard>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {myLive.customMessage ? <p className="taro-hist-msg taro-hist-msg--live">“{myLive.customMessage}”</p> : null}
            </section>
          )}

          {/* Richiesta */}
          <section className="taro-section" aria-label="Richiedi una lettura">
            <header className="taro-sec-head">
              <span className="taro-sec-eyebrow">Il velo dell'Oracolo</span>
              <h2 className="taro-sec-title">Richiedi una lettura</h2>
              <p className="taro-sec-lead">Le carte le volta <strong>Alaric, l'oracolo bendato</strong>. Scegli come riceverla. <em>Una sola richiesta al giorno.</em></p>
            </header>
            <div className="taro-request">
              <textarea className="taro-q-input" rows={3} maxLength={280} placeholder="La tua domanda all'Oracolo (facoltativa)…" value={question} onChange={(e) => setQuestion(e.target.value)} />
              {myLive ? (
                <p className="taro-req-state taro-req-state--wait">🔴 La tua lettura è in diretta qui sopra.</p>
              ) : myPending ? (
                <p className="taro-req-state taro-req-state--wait">⏳ Richiesta inviata{myPending.mode === "live" ? " (live): resta su questa pagina, comparirà qui appena Alaric avvia" : ": attendi il responso di Alaric"}.</p>
              ) : !canRequest ? (
                <p className="taro-req-state taro-req-state--limit">🌙 Hai già interrogato l'Oracolo oggi. Torna domani.</p>
              ) : null}
              <div className="taro-mode-row">
                <button type="button" className="taro-draw taro-draw--live" onClick={() => richiediLettura("live")} disabled={!canRequest}>
                  Lettura in diretta
                </button>
                <button type="button" className="taro-draw" onClick={() => richiediLettura("deferred")} disabled={!canRequest}>
                  Lettura differita
                </button>
              </div>
              <p className="taro-mode-hint">In diretta assisti alla pescata in tempo reale (serve essere online insieme). Differita: ricevi il responso quando è pronto.</p>
            </div>
          </section>

          {/* Le tue letture */}
          <section className="taro-section" aria-label="Le tue letture">
            <header className="taro-sec-head"><span className="taro-sec-eyebrow">Archivio</span><h2 className="taro-sec-title">Le tue letture</h2></header>
            {myReadings.filter((r) => r.status === "answered").length === 0 ? (
              <div className="taro-empty"><span className="taro-empty-glifo">✦</span><p>Non hai ancora ricevuto un responso.</p></div>
            ) : (
              <div className="taro-hist">{myReadings.filter((r) => r.status === "answered").map((r) => <ResponsoSalvato key={r.id} reading={r} showRequester={false} />)}</div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
