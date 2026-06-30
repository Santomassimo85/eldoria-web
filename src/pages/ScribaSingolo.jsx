// src/pages/ScribaSingolo.jsx
// Pagina a sé per UN singolo numero de Lo Scriba, raggiungibile via /giornale/:id.
// NON è linkata dal menu: serve a condividere un'edizione specifica coi player
// (stesso schema di /riassunto/:id per le memorie). Mostra la gazzetta esatta
// (campo `html`) in un iframe. I numeri "sent" sono pubblici (firestore.rules);
// le bozze le vede solo il master.

import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { exanthiaDateLabel } from "../data/exanthiaCalendar";
import "./Scriba.css";

const MASTER_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];

export default function ScribaSingolo() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const isMaster = currentUser && MASTER_EMAILS.includes(currentUser.email);

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const counted = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setNotFound(false); setIssue(null); counted.current = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "newsletters", id));
        if (!alive) return;
        if (!snap.exists()) { setNotFound(true); return; }
        const data = { id: snap.id, ...snap.data() };
        setIssue(data);
        // Conta la lettura (come nell'archivio): salta il master e le bozze.
        if (!isMaster && data.status === "sent" && !counted.current) {
          counted.current = true;
          updateDoc(doc(db, "newsletters", id), { readCount: increment(1) }).catch(() => {});
        }
      } catch (_) {
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, isMaster]);

  const copyLink = async () => {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); }
    catch (_) { window.prompt("Copia il link a questo numero:", url); return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (loading) {
    return (
      <section className="scriba-archive">
        <p className="scriba-empty">Sfogliando l'archivio…</p>
      </section>
    );
  }

  if (notFound || !issue) {
    return (
      <section className="scriba-archive">
        <header className="scriba-mast">
          <span className="scriba-eyebrow">✦ Gazzetta di Exanthia ✦</span>
          <h1 className="scriba-title">Numero non trovato</h1>
          <p className="scriba-sub">Questa edizione non esiste più o il link non è corretto.</p>
        </header>
        <p style={{ textAlign: "center" }}>
          <Link to="/scriba" className="scriba-card-cue">← Tutti i numeri</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="scriba-single">
      <div className="scriba-single-bar">
        <Link to="/scriba" className="scriba-single-back">← Tutti i numeri</Link>
        <span className="scriba-single-label">
          Lo Scriba · Numero {issue.number} · {exanthiaDateLabel(issue.number)}
        </span>
        <button
          type="button"
          className={`scriba-single-share${copied ? " is-copied" : ""}`}
          onClick={copyLink}
          title="Copia il link a questo numero"
        >
          {copied ? "✓ Copiato" : "🔗 Copia link"}
        </button>
      </div>

      {issue.html ? (
        <iframe title={`scriba-${issue.number}`} srcDoc={issue.html} className="scriba-single-frame" />
      ) : (
        <p className="scriba-empty">Numero non disponibile.</p>
      )}
    </section>
  );
}
