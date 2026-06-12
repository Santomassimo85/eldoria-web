import React, { useState, useEffect } from "react";
import changelog from "../data/changelog.json";
import "./Updates.css";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import { doc, onSnapshot, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";

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

  // texts: Set di testi di singole voci nascosti
  // versionNums: Set di numeri versione (es. "17.14") nascosti per intero
  const [hiddenTexts,    setHiddenTexts]    = useState(new Set());
  const [hiddenVersions, setHiddenVersions] = useState(new Set());
  const [showHidden,     setShowHidden]     = useState(false);

  // pending: { type: "text"|"version", key: string }
  const [pending, setPending] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(HIDDEN_DOC, snap => {
      const d = snap.exists() ? snap.data() : {};
      setHiddenTexts(new Set(d.texts || []));
      setHiddenVersions(new Set(d.versions || []));
    });
    return unsub;
  }, []);

  async function hide(type, key) {
    const field = type === "version" ? "versions" : "texts";
    await setDoc(HIDDEN_DOC, { [field]: arrayUnion(key) }, { merge: true });
    setPending(null);
  }

  async function restore(type, key) {
    const field = type === "version" ? "versions" : "texts";
    await setDoc(HIDDEN_DOC, { [field]: arrayRemove(key) }, { merge: true });
  }

  const hiddenCount = hiddenTexts.size + hiddenVersions.size;
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
            {showHidden
              ? "👁 Nascondi nascosti"
              : `👁 Mostra nascosti${hiddenCount > 0 ? ` (${hiddenCount})` : ""}`}
          </button>
        )}
      </header>

      {/* Popup di conferma */}
      {pending && (
        <div className="upd-confirm-overlay" onClick={() => setPending(null)}>
          <div className="upd-confirm-box" onClick={e => e.stopPropagation()}>
            <p className="upd-confirm-msg">
              {pending.type === "version"
                ? `Nascondere l'intero pannello v${pending.key} ai player?`
                : "Nascondere questa voce ai player?"}
            </p>
            {pending.type === "text" && (
              <p className="upd-confirm-text">
                "{pending.key.slice(0, 90)}{pending.key.length > 90 ? "…" : ""}"
              </p>
            )}
            <div className="upd-confirm-actions">
              <button className="upd-confirm-cancel" onClick={() => setPending(null)}>Annulla</button>
              <button className="upd-confirm-ok" onClick={() => hide(pending.type, pending.key)}>Nascondi</button>
            </div>
          </div>
        </div>
      )}

      {versions.length === 0 && (
        <p className="updates-empty">Nessun aggiornamento registrato.</p>
      )}

      <div className="updates-timeline">
        {versions.map((v, i) => {
          const versionHidden = hiddenVersions.has(v.version);

          // Versione nascosta: i player non la vedono; il master la vede solo in "mostra nascosti"
          if (versionHidden && !isMaster) return null;
          if (versionHidden && !showHidden) return null;

          const groups = groupByType(v.changes).map(g => ({
            ...g,
            visible: g.items.filter(c => !hiddenTexts.has(c.text)),
            hiddenItems: g.items.filter(c => hiddenTexts.has(c.text)),
          }));

          const visibleGroups = isMaster
            ? groups
            : groups.filter(g => g.visible.length > 0);

          if (!isMaster && visibleGroups.length === 0) return null;

          // La prima versione NON nascosta è "ULTIMA" per i player
          const isLatest = i === 0;

          return (
            <article
              key={v.version + i}
              className={`updates-card ${isLatest ? "latest" : ""}${versionHidden ? " upd-version-hidden" : ""}`}
            >
              <div className="updates-card-head">
                <span className="updates-version">v{v.version}</span>
                {isLatest && !versionHidden && <span className="updates-latest-badge">ULTIMA</span>}
                {versionHidden && isMaster && <span className="upd-hidden-badge">NASCOSTO</span>}
                <span className="updates-date">{fmtDate(v.date)}</span>
                {/* Bottone nasconde/ripristina l'intera versione — solo master */}
                {isMaster && !versionHidden && (
                  <button
                    className="upd-del-btn upd-ver-del-btn"
                    title="Nascondi questo pannello ai player"
                    onClick={() => setPending({ type: "version", key: v.version })}
                    aria-label="Nascondi versione"
                  >🗑</button>
                )}
                {isMaster && versionHidden && (
                  <button
                    className="upd-restore-btn upd-ver-restore-btn"
                    title="Ripristina versione"
                    onClick={() => restore("version", v.version)}
                    aria-label="Ripristina versione"
                  >↩ Ripristina</button>
                )}
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
                          const isHid = hiddenTexts.has(c.text);
                          return (
                            <li key={j} className={`updates-change${isHid ? " upd-hidden-entry" : ""}`}>
                              <span className="updates-change-dot" aria-hidden="true" />
                              <span className="updates-change-text">{c.text}</span>
                              {isMaster && !isHid && (
                                <button
                                  className="upd-del-btn"
                                  title="Nascondi ai player"
                                  onClick={() => setPending({ type: "text", key: c.text })}
                                  aria-label="Nascondi voce"
                                >🗑</button>
                              )}
                              {isMaster && isHid && (
                                <button
                                  className="upd-restore-btn"
                                  title="Ripristina"
                                  onClick={() => restore("text", c.text)}
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
