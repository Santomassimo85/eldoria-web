// src/pages/Scriba.jsx
//
// Archivio pubblico de "Lo Scriba": tutti i numeri PUBBLICATI (inviati ai
// giocatori), raggruppati per mese, con ricerca e filtro mese. Si riempie da
// solo a ogni nuovo numero. Click su un numero → lo apre (replica esatta della
// gazzetta via iframe).
//
// Finché Firestore non ha numeri "sent", mostriamo numeri D'ESEMPIO bundlati
// (src/data/scribaSample.json) così la pagina è già visibile/recensibile.

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import sampleIssues from "../data/scribaSample.json";
import { exanthiaDateLabel, exanthiaMonthKey } from "../data/exanthiaCalendar";
import ScribaEditModal from "./ScribaEditModal";
import "./Scriba.css";

const MASTER_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];

// Video-intro a tutto schermo: si mostra una volta per sessione del browser.
const SCRIBA_INTRO_SRC = "/assets/scriba-intro.mp4";
const SCRIBA_INTRO_SEEN = "scribaIntroSeen";

// Cadenza reale de Lo Scriba (deve combaciare con SCRIBA_INTERVAL_DAYS lato
// functions): un nuovo numero ~10 giorni dopo l'ultimo inviato.
const SCRIBA_INTERVAL_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

// Le date sono IN-WORLD (calendario di Exanthia), derivate dal NUMERO del
// giornale: il n.1 esce il 10 di Solleone, +2 giorni a numero.
const fmtDate = (it) => exanthiaDateLabel(it?.number);
const monthKey = (it) => exanthiaMonthKey(it?.number);

// millisecondi del campo sentAt (Timestamp Firestore), 0 se assente.
const sentAtMs = (it) =>
  it?.sentAt?.toMillis ? it.sentAt.toMillis()
  : (typeof it?.sentAt?.seconds === "number" ? it.sentAt.seconds * 1000 : 0);

// "6g 4h" / "4h 12m" — attesa al prossimo numero.
const fmtRemaining = (ms) => {
  const totMin = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(totMin / (60 * 24));
  const h = Math.floor((totMin % (60 * 24)) / 60);
  if (d > 0) return `${d}g ${h}h`;
  const m = totMin % 60;
  return `${h}h ${m}m`;
};

export default function Scriba() {
  const { currentUser } = useAuth();
  const isMaster = currentUser && MASTER_EMAILS.includes(currentUser.email);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [term, setTerm] = useState("");
  const [mese, setMese] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // ── Video-intro a tutto schermo (una volta per sessione) ──
  const [intro, setIntro] = useState(() => {
    try { return sessionStorage.getItem(SCRIBA_INTRO_SEEN) !== "1"; }
    catch { return true; }
  });
  const [introMuted, setIntroMuted] = useState(true);
  const introVideoRef = useRef(null);

  const endIntro = () => {
    try { sessionStorage.setItem(SCRIBA_INTRO_SEEN, "1"); } catch {}
    setIntro(false);
  };
  const toggleIntroMute = () => {
    const v = introVideoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setIntroMuted(next);
  };

  // Mentre l'intro è attiva, blocca lo scroll del documento sottostante.
  useEffect(() => {
    if (!intro) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [intro]);

  // "Orologio" del countdown: si aggiorna ogni minuto (basta per un conto in g/h).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // Data attesa del prossimo numero = ultimo invio REALE + cadenza. È una stima
  // (dopo la generazione il numero passa dall'approvazione del direttore), ma
  // basta per dare ai lettori un'attesa scenica.
  const nextIssueMs = useMemo(() => {
    let last = 0;
    for (const it of issues) {
      if (String(it.id).startsWith("sample-")) continue; // gli esempi non contano
      const ms = sentAtMs(it);
      if (ms > last) last = ms;
    }
    return last ? last + SCRIBA_INTERVAL_DAYS * DAY_MS : 0;
  }, [issues]);
  const countdownMs = nextIssueMs ? nextIssueMs - now : 0;

  // Solo il master: rimuove un numero dall'archivio (Firestore). Gli esempi
  // bundlati (id "sample-…") non sono su Firestore, non si eliminano.
  const removeIssue = async (it) => {
    if (!isMaster) return;
    if (String(it.id).startsWith("sample-")) {
      alert("Questo è un numero d'esempio (non è nell'archivio reale).");
      return;
    }
    if (!window.confirm(`Eliminare il Numero ${it.number} dall'archivio? L'azione è definitiva.`)) return;
    try {
      await deleteDoc(doc(db, "newsletters", it.id));
      if (open === it.id) setOpen(null);
    } catch (e) {
      alert("Eliminazione non riuscita: " + (e?.message || e));
    }
  };

  useEffect(() => {
    const q = query(collection(db, "newsletters"), where("status", "==", "sent"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Finché non ci sono numeri reali pubblicati, mostra gli esempi bundlati.
        setIssues(list.length ? list : sampleIssues);
        setLoading(false);
      },
      () => { setIssues(sampleIssues); setLoading(false); },
    );
    return () => unsub();
  }, []);

  // Apre un numero e — se è un numero reale (non un esempio) e il lettore non è
  // il master — conta una lettura su Firestore (campo readCount). Lo stesso
  // pattern dei Riassunti: il conteggio serve al master per sapere in quanti
  // hanno letto le cronache.
  const openIssue = (it) => {
    setOpen(it.id);
    if (isMaster) return;
    if (String(it.id).startsWith("sample-")) return;
    updateDoc(doc(db, "newsletters", it.id), { readCount: increment(1) }).catch(() => {});
    setIssues((prev) =>
      prev.map((x) => (x.id === it.id ? { ...x, readCount: (x.readCount || 0) + 1 } : x)),
    );
  };

  const opened = useMemo(() => issues.find((i) => i.id === open) || null, [issues, open]);

  // Filtri + raggruppamento per mese.
  const groups = useMemo(() => {
    const t = term.trim().toLowerCase();
    const filtered = issues
      .filter((it) => {
        const hay = `${it.content?.edition_motto || ""} ${it.content?.lead?.headline || ""} ${it.number}`.toLowerCase();
        const okText = !t || hay.includes(t);
        const okMese = !mese || monthKey(it).label === mese;
        return okText && okMese;
      })
      .sort((a, b) => (b.number || 0) - (a.number || 0));

    const map = new Map();
    for (const it of filtered) {
      const { key, label } = monthKey(it);
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key).items.push(it);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([, g]) => g);
  }, [issues, term, mese]);

  // Mesi disponibili per la tendina.
  const mesiDisponibili = useMemo(() => {
    const seen = new Map();
    for (const it of issues) {
      const { key, label } = monthKey(it);
      seen.set(key, label);
    }
    return [...seen.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([, label]) => label);
  }, [issues]);

  return (
    <section className="scriba-archive">
      {intro && (
        <div className="scriba-intro" role="dialog" aria-label="Anteprima de Lo Scriba">
          <video
            ref={introVideoRef}
            className="scriba-intro-video"
            src={SCRIBA_INTRO_SRC}
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={endIntro}
            onError={endIntro}
          />
          <button
            type="button"
            className="scriba-intro-mute"
            onClick={toggleIntroMute}
            aria-label={introMuted ? "Attiva audio" : "Disattiva audio"}
            title={introMuted ? "Attiva audio" : "Disattiva audio"}
          >
            {introMuted ? "🔇" : "🔊"}
          </button>
        </div>
      )}

      <header className="scriba-mast">
        <span className="scriba-eyebrow">✦ Gazzetta di Exanthia ✦</span>
        <h1 className="scriba-title">Lo Scriba</h1>
        <p className="scriba-sub">
          L'archivio delle cronache del mondo. Ogni numero pubblicato resta qui, a futura memoria.
        </p>
      </header>

      {nextIssueMs > 0 && (
        <div className="scriba-countdown" role="status" aria-live="polite">
          <span className="scriba-cd-quill" aria-hidden="true">🪶</span>
          {countdownMs > 0 ? (
            <p className="scriba-cd-text">
              Lo Scriba intinge la penna… il prossimo bollettino verrà vergato tra{" "}
              <strong>{fmtRemaining(countdownMs)}</strong>. Pazienza, nobili lettori.
            </p>
          ) : (
            <p className="scriba-cd-text">
              Lo Scriba sta affilando la penna… il nuovo numero è <strong>imminente</strong>!
            </p>
          )}
        </div>
      )}

      {isMaster && !loading && issues.length > 0 && String(issues[0].id).startsWith("sample-") && (
        <p style={{ background: "#fff6e0", border: "1px solid #e3cf9b", color: "#7a5b12", borderRadius: 8, padding: "10px 14px", margin: "0 0 14px", lineHeight: 1.5 }}>
          ℹ️ Questi sono <strong>numeri d'esempio</strong> (spariscono al primo numero reale pubblicato). I pulsanti <strong>✒️ Modifica</strong> e <strong>🗑 Elimina</strong> compaiono solo sui numeri veri inviati.
        </p>
      )}

      {!loading && issues.length > 0 && (
        <div className="scriba-toolbar">
          <input
            type="search"
            className="scriba-search"
            placeholder="Cerca tra le cronache…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <select className="scriba-mesesel" value={mese} onChange={(e) => setMese(e.target.value)}>
            <option value="">Tutti i mesi</option>
            {mesiDisponibili.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="scriba-empty">Sfogliando gli archivi…</p>
      ) : groups.length === 0 ? (
        <p className="scriba-empty">Nessun numero trovato.</p>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="scriba-month">
            <h2 className="scriba-month-title">{g.label}</h2>
            <div className="scriba-grid">
              {g.items.map((it) => (
                <div key={it.id} className="scriba-card-wrap" style={{ position: "relative" }}>
                {isMaster && !String(it.id).startsWith("sample-") && (
                  <>
                  <button
                    type="button"
                    className="scriba-edit"
                    title="Modifica questo numero"
                    aria-label="Modifica questo numero"
                    onClick={(e) => { e.stopPropagation(); setEditing(it); }}
                    style={{ position: "absolute", top: 8, right: 44, zIndex: 2, background: "rgba(201,162,39,.95)", color: "#1c1813", border: "none", borderRadius: 6, width: 30, height: 30, cursor: "pointer", fontSize: 15, lineHeight: 1 }}
                  >✒️</button>
                  <button
                    type="button"
                    className="scriba-del"
                    title="Elimina questo numero"
                    aria-label="Elimina questo numero"
                    onClick={(e) => { e.stopPropagation(); removeIssue(it); }}
                    style={{ position: "absolute", top: 8, right: 8, zIndex: 2, background: "rgba(138,38,28,.92)", color: "#fff", border: "none", borderRadius: 6, width: 30, height: 30, cursor: "pointer", fontSize: 15, lineHeight: 1 }}
                  >🗑</button>
                  </>
                )}
                {isMaster && !String(it.id).startsWith("sample-") && (
                  <span className="scriba-reads" title="Letture totali">👁 {it.readCount || 0}</span>
                )}
                <button className="scriba-card" type="button" onClick={() => openIssue(it)}>
                  {it.images?.[0]?.url ? (
                    <div className="scriba-card-thumb" style={{ backgroundImage: `url(${it.images[0].url})` }} aria-hidden="true" />
                  ) : (
                    <div className="scriba-card-thumb scriba-card-thumb--empty" aria-hidden="true">📜</div>
                  )}
                  <div className="scriba-card-body">
                    <span className="scriba-card-num">Numero {it.number}</span>
                    <span className="scriba-card-date">{fmtDate(it)}</span>
                    {it.content?.edition_motto && (
                      <p className="scriba-card-motto">«{it.content.edition_motto}»</p>
                    )}
                    {it.content?.lead?.headline && (
                      <p className="scriba-card-lead">{it.content.lead.headline}</p>
                    )}
                    <span className="scriba-card-cue">Leggi ›</span>
                  </div>
                </button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {opened && (
        <div className="scriba-reader" role="dialog" aria-label={`Lo Scriba numero ${opened.number}`}>
          <div className="scriba-reader-bar">
            <span>Lo Scriba · Numero {opened.number} · {fmtDate(opened)}</span>
            <button type="button" onClick={() => setOpen(null)} aria-label="Chiudi">✕</button>
          </div>
          {opened.html ? (
            <iframe title={`scriba-${opened.number}`} srcDoc={opened.html} className="scriba-reader-frame" />
          ) : (
            <p className="scriba-empty">Numero non disponibile.</p>
          )}
        </div>
      )}

      {editing && (
        <ScribaEditModal issue={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
