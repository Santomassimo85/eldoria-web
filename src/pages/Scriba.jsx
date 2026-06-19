// src/pages/Scriba.jsx
//
// Archivio pubblico de "Lo Scriba": tutti i numeri PUBBLICATI (inviati ai
// giocatori), raggruppati per mese, con ricerca e filtro mese. Si riempie da
// solo a ogni nuovo numero. Click su un numero → lo apre (replica esatta della
// gazzetta via iframe).
//
// Finché Firestore non ha numeri "sent", mostriamo numeri D'ESEMPIO bundlati
// (src/data/scribaSample.json) così la pagina è già visibile/recensibile.

import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import sampleIssues from "../data/scribaSample.json";
import { exanthiaDateLabel, exanthiaMonthKey } from "../data/exanthiaCalendar";
import ScribaEditModal from "./ScribaEditModal";
import "./Scriba.css";

const MASTER_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];

// Le date sono IN-WORLD (calendario di Exanthia), derivate dal NUMERO del
// giornale: il n.1 esce il 10 di Solleone, +2 giorni a numero.
const fmtDate = (it) => exanthiaDateLabel(it?.number);
const monthKey = (it) => exanthiaMonthKey(it?.number);

export default function Scriba() {
  const { currentUser } = useAuth();
  const isMaster = currentUser && MASTER_EMAILS.includes(currentUser.email);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [term, setTerm] = useState("");
  const [mese, setMese] = useState("");

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
      <header className="scriba-mast">
        <span className="scriba-eyebrow">✦ Gazzetta di Exanthia ✦</span>
        <h1 className="scriba-title">Lo Scriba</h1>
        <p className="scriba-sub">
          L'archivio delle cronache del mondo. Ogni numero pubblicato resta qui, a futura memoria.
        </p>
      </header>

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
                <button className="scriba-card" type="button" onClick={() => setOpen(it.id)}>
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
