// src/pages/LoScribaAdmin.jsx
//
// Pannello "Lo Scriba". La gazzetta è AUTOMATICA: l'agent server genera un
// numero ogni 10 giorni, manda l'anteprima al master e — salvo stop/modifica —
// lo invia da solo ai giocatori dopo 24h (modalità A1). Qui il master può:
//  - attivare/disattivare l'automatismo;
//  - vedere/fermare/anticipare la bozza in attesa;
//  - sfogliare i numeri passati;
//  - (facoltativo) generare un'anteprima a mano.

import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, setDoc, deleteDoc,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { functions, db } from "../firebase";
import "./admin.css";

const MASTER_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];

const STATUS_LABEL = {
  preview: { t: "Anteprima", c: "#6b5d44" },
  draft: { t: "In attesa", c: "#b8860b" },
  approved: { t: "Approvato", c: "#b8860b" },
  sent: { t: "Inviato", c: "#2f5d2a" },
  cancelled: { t: "Annullato", c: "#8a261c" },
};

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  return new Date(ts);
}

// Gli "spunti del direttore" vivono come righe puntate dentro un unico campo
// settings/scriba.nextIssueInput: il backend lo inietta come "INDICAZIONE DEL
// DIRETTORE" nel prossimo numero e lo AZZERA da solo dopo l'invio (one-shot).
// Qui sotto li gestiamo come lista, ma sul DB restano quella singola stringa.
const parseNotes = (raw) =>
  String(raw || "").split("\n").map((s) => s.replace(/^[-•✦\s]+/, "").trim()).filter(Boolean);
const joinNotes = (arr) => arr.map((s) => `- ${s}`).join("\n");

function hoursLeft(date) {
  if (!date) return null;
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "a momenti";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function LoScribaAdmin() {
  const { currentUser } = useAuth();
  const [editions, setEditions] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(10);
  const [msg, setMsg] = useState(null);     // { type, text }
  const [previewHtml, setPreviewHtml] = useState(null);
  const [notes, setNotes] = useState([]);   // spunti per il prossimo numero
  const [draft, setDraft] = useState("");   // nuovo spunto in scrittura

  const isMaster = currentUser && MASTER_EMAILS.includes(currentUser.email);

  useEffect(() => {
    if (!isMaster) return;
    const q = query(collection(db, "newsletters"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setEditions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (e) => setMsg({ type: "err", text: "Lettura numeri: " + e.message }));
    const unsubCfg = onSnapshot(doc(db, "settings", "scriba"), (s) => {
      if (!s.exists()) { setEnabled(true); setNotes([]); return; }
      setEnabled(s.data().enabled !== false);
      // La lista è guidata da Firestore: così dopo l'invio (campo azzerato dal
      // backend) il pannello torna vuoto da solo, senza spunti fantasma.
      setNotes(parseNotes(s.data().nextIssueInput));
    });
    return () => { unsub(); unsubCfg(); };
  }, [isMaster]);

  if (!isMaster) {
    return (
      <section className="adm" style={{ "--cine-accent": "#8a261c", "--cine-accent-2": "#c0392b" }}>
        <div className="adm-masthead"><div className="adm-mast-main">
          <span className="adm-eyebrow">✦ Accesso riservato ✦</span>
          <h1 className="adm-title">Accesso Negato</h1>
          <p className="adm-sub">Solo il Master può consultare Lo Scriba.</p>
        </div></div>
      </section>
    );
  }

  const pending = editions.find((e) => e.status === "draft" || e.status === "approved");

  const run = async (fn) => { setBusy(true); setMsg(null); try { await fn(); } catch (e) { setMsg({ type: "err", text: e?.message || "Errore." }); } finally { setBusy(false); } };

  const toggleEnabled = () => run(async () => {
    await setDoc(doc(db, "settings", "scriba"), { enabled: !enabled }, { merge: true });
    setMsg({ type: "ok", text: !enabled ? "Automatismo ATTIVO: Lo Scriba uscirà da solo." : "Automatismo in PAUSA." });
  });

  const persistNotes = (arr) =>
    setDoc(doc(db, "settings", "scriba"), { nextIssueInput: joinNotes(arr) }, { merge: true });

  const addNote = () => run(async () => {
    const v = draft.trim();
    if (!v) return;
    const next = [...notes, v];
    setNotes(next); setDraft("");
    await persistNotes(next);
    setMsg({ type: "ok", text: "Spunto aggiunto: entrerà nel prossimo numero, poi si azzera da solo dopo l'invio." });
  });

  const removeNote = (i) => run(async () => {
    const next = notes.filter((_, idx) => idx !== i);
    setNotes(next);
    await persistNotes(next);
    setMsg({ type: "ok", text: "Spunto rimosso." });
  });

  const generaAnteprima = () => run(async () => {
    const call = httpsCallable(functions, "scribaPreview", { timeout: 540000 });
    const res = await call({ days });
    const d = res.data || {};
    setMsg({ type: "ok", text: `Anteprima del N. ${d.edition} generata (${d.images || 0} immagini) e inviata alla tua mail.` });
  });

  const inviaOra = (id) => run(async () => {
    const call = httpsCallable(functions, "scribaSendNow", { timeout: 300000 });
    const res = await call({ id });
    setMsg({ type: "ok", text: `Numero inviato a ${res.data?.sent ?? 0} lettori.` });
  });

  const annulla = (id) => run(async () => {
    await updateDoc(doc(db, "newsletters", id), { status: "cancelled" });
    setMsg({ type: "ok", text: "Bozza annullata: non verrà inviata." });
  });

  const elimina = (e) => run(async () => {
    if (!window.confirm(`Eliminare definitivamente il Numero ${e.number}?`)) return;
    await deleteDoc(doc(db, "newsletters", e.id));
    setMsg({ type: "ok", text: `Numero ${e.number} eliminato.` });
  });

  const btn = (label, onClick, color = "#c9a227", textColor = "#7a1f12") => (
    <button type="button" onClick={onClick} disabled={busy}
      style={{ background: color, color: textColor, border: "none", fontWeight: 700, padding: "9px 14px", borderRadius: 6, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, marginRight: 8 }}>
      {label}
    </button>
  );

  return (
    <section className="adm" style={{ "--cine-accent": "#8a261c", "--cine-accent-2": "#c0392b" }}>
      <div className="adm-masthead">
        <div className="adm-mast-main">
          <span className="adm-eyebrow">✦ Redazione ✦</span>
          <h1 className="adm-title">Lo Scriba</h1>
          <p className="adm-sub">
            La gazzetta viene <strong>scritta e illustrata da sola ogni 10 giorni</strong> e ti arriva via mail come
            <strong> bozza da approvare</strong>: parte ai giocatori <strong>solo</strong> quando clicchi
            «Approva e invia» nella mail (oppure «Invia ora» qui sotto). Nessun invio automatico.
          </p>
        </div>
        <div className="adm-mast-aside">
          <div className="adm-stat"><span>Stato</span><strong style={{ color: enabled ? "#2f5d2a" : "#8a261c" }}>{enabled ? "Attivo" : "In pausa"}</strong></div>
        </div>
      </div>

      {msg && (
        <p style={{ padding: "10px 12px", borderRadius: 6, background: msg.type === "ok" ? "#e7f0e1" : "#f6e0dc", color: msg.type === "ok" ? "#2f5d2a" : "#8a261c", lineHeight: 1.5 }}>
          {msg.type === "ok" ? "✅ " : "⚠️ "}{msg.text}
        </p>
      )}

      {/* Interruttore automatismo */}
      <div style={{ margin: "8px 0 20px" }}>
        {btn(enabled ? "⏸ Metti in pausa l'automatismo" : "▶ Attiva l'automatismo", toggleEnabled, enabled ? "#e0d6bf" : "#c9a227", "#1c1813")}
      </div>

      {/* Bozza in attesa */}
      {pending && (
        <div className="adm-tile" style={{ cursor: "default", marginBottom: 22, borderColor: "#b8860b" }}>
          <span className="adm-tile-icon" aria-hidden="true">📰</span>
          <h3 className="adm-tile-title">Bozza in attesa di approvazione — N. {pending.number}</h3>
          <p className="adm-tile-desc">
            Approva dal bottone nella mail che hai ricevuto, oppure <strong>Invia ora</strong> qui. Non parte da sola.
          </p>
          <div style={{ marginTop: 12 }}>
            {btn("📤 Invia ora", () => inviaOra(pending.id))}
            {btn("👁 Anteprima", () => setPreviewHtml(pending.html), "#e0d6bf", "#1c1813")}
            {btn("✖ Annulla", () => annulla(pending.id), "#e7c9c2", "#8a261c")}
          </div>
        </div>
      )}

      {/* Spunti "una tantum" per il prossimo numero */}
      <div className="adm-tile" style={{ cursor: "default", marginBottom: 18 }}>
        <span className="adm-tile-icon" aria-hidden="true">🗒️</span>
        <h3 className="adm-tile-title">Spunti per il prossimo numero</h3>
        <p className="adm-tile-desc">
          Butta giù una nota <strong>breve</strong> (basta il concetto): ci pensa Lo Scriba a scriverla per esteso e a illustrarla,
          dentro il giornale generato come sempre. Valgono <strong>solo per la prossima uscita</strong> e poi si azzerano da sole.
          Se non scrivi nulla, <strong>libertà totale</strong> come adesso. Per una <em>réclame</em> in fondo, scrivilo
          (es. «réclame per il cartomante Alaric, ora a Yotta»).
        </p>

        {notes.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            {notes.map((n, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: "#fffdf7", border: "1px solid #e3d8bf", borderRadius: 6 }}>
                <span aria-hidden="true" style={{ color: "#b8860b", fontWeight: 700 }}>✦</span>
                <span style={{ flex: 1, color: "#5a4d36", lineHeight: 1.45 }}>{n}</span>
                <button type="button" onClick={() => removeNote(i)} disabled={busy} title="Rimuovi spunto"
                  style={{ background: "none", border: "1px solid #d9b3ac", color: "#8a261c", borderRadius: 5, padding: "2px 8px", cursor: busy ? "wait" : "pointer", fontWeight: 700 }}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "#8a7a5b", fontStyle: "italic", margin: "6px 0 12px" }}>
            Nessuno spunto: il prossimo numero sarà a totale libertà di Lo Scriba.
          </p>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <textarea
            value={draft} disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(); } }}
            rows={2} maxLength={400}
            placeholder="Es.: a Havondé si cerca un locandiere impazzito per un anello maledetto…"
            style={{ flex: 1, boxSizing: "border-box", padding: "10px 12px", fontSize: "0.95rem", fontFamily: "inherit", border: "1px solid #cdbfa3", borderRadius: 6, resize: "vertical" }}
          />
          {btn(busy ? "…" : "➕ Aggiungi", addNote)}
        </div>
        <small style={{ color: "#8a7a5b" }}>Suggerimento: Ctrl/⌘ + Invio per aggiungere in fretta.</small>
      </div>

      {/* Generazione manuale (facoltativa) */}
      <div className="adm-tile" style={{ cursor: "default", marginBottom: 26 }}>
        <span className="adm-tile-icon" aria-hidden="true">✒️</span>
        <h3 className="adm-tile-title">Genera un'anteprima a mano</h3>
        <p className="adm-tile-desc">Solo per te, non viene inviata ai giocatori. Periodo:</p>
        <label style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 14px" }}>
          <input type="number" min={1} max={60} value={days} disabled={busy}
            onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value) || 10)))}
            style={{ width: 72, padding: "6px 8px", fontSize: "1rem" }} />
          <span style={{ color: "#6b5d44" }}>giorni</span>
        </label>
        {btn(busy ? "Lo Scriba sta scrivendo…" : "Genera e mandami l'anteprima", generaAnteprima)}
      </div>

      {/* Archivio numeri */}
      <h2 className="adm-panel-title" style={{ margin: "0 0 12px", fontSize: "0.82rem", letterSpacing: ".16em", textTransform: "uppercase", color: "#8a6212" }}>
        Numeri ({editions.length})
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {editions.map((e) => {
          const st = STATUS_LABEL[e.status] || { t: e.status, c: "#6b5d44" };
          const motto = e.content?.edition_motto || "";
          return (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#fffdf7", border: "1px solid #e3d8bf", borderRadius: 6 }}>
              <strong style={{ minWidth: 42 }}>N. {e.number}</strong>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: st.c, minWidth: 78 }}>{st.t}</span>
              <span style={{ flex: 1, color: "#6b5d44", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{motto}</span>
              {e.recipientCount != null && <span style={{ color: "#2f5d2a", fontSize: "0.85rem" }}>→ {e.recipientCount}</span>}
              <button type="button" onClick={() => setPreviewHtml(e.html)} disabled={!e.html}
                style={{ background: "none", border: "1px solid #c9a227", color: "#7a1f12", borderRadius: 5, padding: "5px 10px", cursor: e.html ? "pointer" : "not-allowed", fontWeight: 600 }}>
                👁 Anteprima
              </button>
              <button type="button" onClick={() => elimina(e)} disabled={busy} title="Elimina numero"
                style={{ background: "none", border: "1px solid #d9b3ac", color: "#8a261c", borderRadius: 5, padding: "5px 9px", cursor: busy ? "wait" : "pointer", fontWeight: 700 }}>
                🗑
              </button>
            </div>
          );
        })}
        {editions.length === 0 && <p style={{ color: "#6b5d44" }}>Ancora nessun numero. Il primo uscirà automaticamente, oppure generane uno a mano qui sopra.</p>}
      </div>

      {/* Visore anteprima */}
      {previewHtml && (
        <div style={{ marginTop: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 className="adm-tile-title" style={{ margin: 0 }}>Anteprima del numero</h3>
            <button type="button" onClick={() => setPreviewHtml(null)} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#8a261c" }}>✕</button>
          </div>
          <iframe title="anteprima-scriba" srcDoc={previewHtml} style={{ width: "100%", height: 640, border: "1px solid #cdbfa3", borderRadius: 6, background: "#fff" }} />
        </div>
      )}
    </section>
  );
}
