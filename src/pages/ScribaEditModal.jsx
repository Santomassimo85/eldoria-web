// src/pages/ScribaEditModal.jsx
//
// Editor semplice (solo master) per modificare i testi di un numero de Lo Scriba
// già in archivio. Si modificano motto, articolo di apertura e i pezzi di ogni
// sezione; al salvataggio una Cloud Function (scribaEdit) ri-renderizza l'html.
// Le immagini restano invariate.

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const SECTIONS = [
  { key: "dalle_terre", label: "Dalle Terre" },
  { key: "voci_di_taverna", label: "Voci di Taverna" },
  { key: "listini", label: "Listini & Loschi Affari" },
  { key: "arena", label: "L'Arena Vermiglia" },
];

const art = (a) => ({ headline: a?.headline || "", body: a?.body || "" });
const arr = (x) => (Array.isArray(x) ? x.map(art) : []);

export default function ScribaEditModal({ issue, onClose }) {
  const [c, setC] = useState(() => ({
    edition_motto: issue.content?.edition_motto || "",
    lead: art(issue.content?.lead),
    dalle_terre: arr(issue.content?.dalle_terre),
    voci_di_taverna: arr(issue.content?.voci_di_taverna),
    listini: arr(issue.content?.listini),
    arena: arr(issue.content?.arena),
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const setLead = (field, val) => setC((p) => ({ ...p, lead: { ...p.lead, [field]: val } }));
  const setItem = (sec, i, field, val) =>
    setC((p) => ({ ...p, [sec]: p[sec].map((a, j) => (j === i ? { ...a, [field]: val } : a)) }));
  const addItem = (sec) => setC((p) => ({ ...p, [sec]: [...p[sec], { headline: "", body: "" }] }));
  const removeItem = (sec, i) => setC((p) => ({ ...p, [sec]: p[sec].filter((_, j) => j !== i) }));

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const call = httpsCallable(functions, "scribaEdit", { timeout: 120000 });
      await call({ id: issue.id, content: c });
      onClose(true);
    } catch (e) {
      setErr(e?.message || "Salvataggio non riuscito.");
    } finally {
      setBusy(false);
    }
  };

  const lbl = { display: "block", fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8a6212", margin: "0 0 4px" };
  const inp = { width: "100%", padding: "8px 10px", border: "1px solid #cdbfa3", borderRadius: 6, background: "#fffdf7", color: "#1c1813", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" };

  const ArticleEditor = ({ sec, i, a }) => (
    <div style={{ border: "1px solid #e3d8bf", borderRadius: 8, padding: 10, marginBottom: 8, background: "#fbf7ee" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input style={{ ...inp, fontWeight: 700 }} value={a.headline} placeholder="Titolo"
          onChange={(e) => setItem(sec, i, "headline", e.target.value)} />
        <button type="button" onClick={() => removeItem(sec, i)} title="Rimuovi articolo"
          style={{ background: "#f3e0db", color: "#8a261c", border: "1px solid #d9b3ac", borderRadius: 6, padding: "8px 10px", cursor: "pointer", fontWeight: 700 }}>🗑</button>
      </div>
      <textarea style={{ ...inp, marginTop: 6, minHeight: 90, resize: "vertical", lineHeight: 1.5 }} value={a.body}
        placeholder="Testo dell'articolo (paragrafi separati da riga vuota)"
        onChange={(e) => setItem(sec, i, "body", e.target.value)} />
    </div>
  );

  return (
    <div role="dialog" aria-label={`Modifica Numero ${issue.number}`}
      style={{ position: "fixed", inset: 0, background: "rgba(28,24,19,.55)", zIndex: 1200, display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto", padding: "24px 12px" }}>
      <div style={{ background: "#f4efe3", border: "1px solid #cdbfa3", borderRadius: 10, maxWidth: 760, width: "100%", padding: "20px 22px", boxShadow: "0 18px 50px rgba(0,0,0,.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, borderBottom: "2px solid #1c1813", paddingBottom: 10 }}>
          <h2 style={{ margin: 0, fontFamily: "'Cinzel',Georgia,serif", color: "#1c1813" }}>✒️ Modifica — Numero {issue.number}</h2>
          <button type="button" onClick={() => onClose(false)} aria-label="Chiudi"
            style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#8a261c" }}>✕</button>
        </div>

        {err && <p style={{ background: "#f6e0dc", color: "#8a261c", padding: "8px 10px", borderRadius: 6 }}>⚠️ {err}</p>}

        <label style={lbl}>Motto del numero</label>
        <input style={{ ...inp, marginBottom: 16, fontStyle: "italic" }} value={c.edition_motto}
          onChange={(e) => setC((p) => ({ ...p, edition_motto: e.target.value }))} />

        <label style={lbl}>Apertura (lead)</label>
        <div style={{ border: "1px solid #e3d8bf", borderRadius: 8, padding: 10, marginBottom: 18, background: "#fbf7ee" }}>
          <input style={{ ...inp, fontWeight: 700 }} value={c.lead.headline} placeholder="Titolo di apertura"
            onChange={(e) => setLead("headline", e.target.value)} />
          <textarea style={{ ...inp, marginTop: 6, minHeight: 110, resize: "vertical", lineHeight: 1.5 }} value={c.lead.body}
            placeholder="Testo dell'apertura" onChange={(e) => setLead("body", e.target.value)} />
        </div>

        {SECTIONS.map((s) => (
          <div key={s.key} style={{ marginBottom: 16 }}>
            <label style={lbl}>{s.label}</label>
            {c[s.key].map((a, i) => <ArticleEditor key={i} sec={s.key} i={i} a={a} />)}
            <button type="button" onClick={() => addItem(s.key)}
              style={{ background: "#efe4cb", color: "#1c1813", border: "1px dashed #c9a227", borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontWeight: 600 }}>
              + Aggiungi articolo
            </button>
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18, borderTop: "1px solid #e3d8bf", paddingTop: 14 }}>
          <button type="button" onClick={() => onClose(false)} disabled={busy}
            style={{ background: "#e0d6bf", color: "#1c1813", border: "none", borderRadius: 6, padding: "10px 16px", cursor: "pointer", fontWeight: 700 }}>Annulla</button>
          <button type="button" onClick={save} disabled={busy}
            style={{ background: "#c9a227", color: "#1c1813", border: "none", borderRadius: 6, padding: "10px 18px", cursor: busy ? "wait" : "pointer", fontWeight: 700, opacity: busy ? .6 : 1 }}>
            {busy ? "Salvataggio…" : "💾 Salva modifiche"}
          </button>
        </div>
      </div>
    </div>
  );
}
