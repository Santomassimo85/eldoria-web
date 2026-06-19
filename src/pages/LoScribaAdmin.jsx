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

  const isMaster = currentUser && MASTER_EMAILS.includes(currentUser.email);

  useEffect(() => {
    if (!isMaster) return;
    const q = query(collection(db, "newsletters"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setEditions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (e) => setMsg({ type: "err", text: "Lettura numeri: " + e.message }));
    const unsubCfg = onSnapshot(doc(db, "settings", "scriba"), (s) => {
      if (s.exists()) setEnabled(s.data().enabled !== false);
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
