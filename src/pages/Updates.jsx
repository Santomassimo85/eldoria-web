import React, { useState, useEffect } from "react";
import changelog from "../data/changelog.json";
import "./Updates.css";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const HIDDEN_DOC   = doc(db, "settings", "changelog_hidden");

const TYPE_META = {
  feature:   { label: "Novità",        icon: "✨", cls: "feature" },
  graphic:   { label: "Grafica",       icon: "🎨", cls: "graphic" },
  mechanics: { label: "Meccaniche",    icon: "⚙",  cls: "mechanics" },
  balance:   { label: "Bilanciamento", icon: "⚖",  cls: "balance" },
  fix:       { label: "Fix",           icon: "🔧", cls: "fix" },
  chore:     { label: "Tecnico",       icon: "🛠", cls: "chore" },
};
const TYPE_ORDER = Object.keys(TYPE_META);

function groupByType(changes = []) {
  const buckets = new Map();
  changes.forEach(c => {
    const type = TYPE_META[c.type] ? c.type : "chore";
    if (!buckets.has(type)) buckets.set(type, []);
    buckets.get(type).push(c);
  });
  return TYPE_ORDER
    .filter(t => buckets.has(t))
    .map(t => ({ type: t, meta: TYPE_META[t], items: buckets.get(t) }));
}

function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const mesi = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  return `${d} ${mesi[m - 1]} ${y}`;
}

export default function Updates() {
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === MASTER_EMAIL;

  const [hidden,      setHidden]      = useState(new Set());
  const [showHidden,  setShowHidden]  = useState(false);
  const [pendingText, setPendingText] = useState(null); // testo in attesa di conferma

  // Carica/ascolta le voci nascoste da Firestore
  useEffect(() => {
    const unsub = onSnapshot(HIDDEN_DOC, snap => {
      const texts = snap.exists() ? (snap.data().texts || []) : [];
      setHidden(new Set(texts));
    });
    return unsub;
  }, []);

  async function hideEntry(text) {
    try {
      await setDoc(HIDDEN_DOC, { texts: arrayUnion(text) }, { merge: true });
    } catch { /* doc potrebbe non esistere ancora */ }
    setPendingText(null);
  }

  async function restoreEntry(text) {
    await updateDoc(HIDDEN_DOC, { texts: arrayRemove(text) });
  }

  const versions = changelog?.versions || [];

  return (
    <div className="updates-page">
      <header className="updates-header">
        <h1 className="updates-title">UPDATE</h1>
        <p className="updates-sub">Cosa è cambiato, versione per versione.</p>
        {isMaster && (
          <button
            className={`upd-toggle-hidden${showHidden ? " active" : ""}`}
            onClick={() => setShowHidden(v => !v)}
          >
            {showHidden ? "👁 Nascondi nascosti" : `👁 Mostra nascosti${hidden.size > 0 ? ` (${hidden.size})` : ""}`}
          </button>
        )}
      </header>

      {/* Popup di conferma eliminazione */}
      {pendingText && (
        <div className="upd-confirm-overlay" onClick={() => setPendingText(null)}>
          <div className="upd-confirm-box" onClick={e => e.stopPropagation()}>
            <p className="upd-confirm-msg">Nascondere questa voce ai player?</p>
            <p className="upd-confirm-text">"{pendingText.slice(0, 90)}{pendingText.length > 90 ? "…" : ""}"</p>
            <div className="upd-confirm-actions">
              <button className="upd-confirm-cancel" onClick={() => setPendingText(null)}>Annulla</button>
              <button className="upd-confirm-ok" onClick={() => hideEntry(pendingText)}>Nascondi</button>
            </div>
          </div>
        </div>
      )}

      {versions.length === 0 && (
        <p className="updates-empty">Nessun aggiornamento registrato.</p>
      )}

      <div className="updates-timeline">
        {versions.map((v, i) => {
          // Filtra le voci per ogni gruppo
          const groups = groupByType(v.changes).map(g => ({
            ...g,
            visible: g.items.filter(c => !hidden.has(c.text)),
            hiddenItems: g.items.filter(c => hidden.has(c.text)),
          }));

          // Per i player: nascondi gruppi vuoti e versioni completamente vuote
          const visibleGroups = isMaster
            ? groups
            : groups.filter(g => g.visible.length > 0);

          if (!isMaster && visibleGroups.length === 0) return null;

          return (
            <article key={v.version + i} className={`updates-card ${i === 0 ? "latest" : ""}`}>
              <div className="updates-card-head">
                <span className="updates-version">v{v.version}</span>
                {i === 0 && <span className="updates-latest-badge">ULTIMA</span>}
                <span className="updates-date">{fmtDate(v.date)}</span>
              </div>
              {v.title && <h2 className="updates-card-title">{v.title}</h2>}

              <div className="updates-groups">
                {visibleGroups.map(g => {
                  const shownItems = isMaster
                    ? (showHidden ? g.items : g.visible)
                    : g.visible;

                  if (shownItems.length === 0 && !showHidden) return null;

                  return (
                    <section key={g.type} className={`updates-group ${g.meta.cls}`}>
                      <div className="updates-group-head">
                        <span className="updates-group-icon" aria-hidden="true">{g.meta.icon}</span>
                        <span className="updates-group-label">{g.meta.label}</span>
                        <span className="updates-group-count">{g.visible.length}</span>
                      </div>
                      <ul className="updates-changes">
                        {shownItems.map((c, j) => {
                          const isHid = hidden.has(c.text);
                          return (
                            <li key={j} className={`updates-change${isHid ? " upd-hidden-entry" : ""}`}>
                              <span className="updates-change-dot" aria-hidden="true" />
                              <span className="updates-change-text">{c.text}</span>
                              {isMaster && !isHid && (
                                <button
                                  className="upd-del-btn"
                                  title="Nascondi ai player"
                                  onClick={() => setPendingText(c.text)}
                                  aria-label="Nascondi voce"
                                >🗑</button>
                              )}
                              {isMaster && isHid && (
                                <button
                                  className="upd-restore-btn"
                                  title="Ripristina"
                                  onClick={() => restoreEntry(c.text)}
                                  aria-label="Ripristina voce"
                                >↩</button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
