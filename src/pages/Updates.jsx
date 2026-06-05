import React from "react";
import changelog from "../data/changelog.json";
import "./Updates.css";

const TYPE_META = {
  feature: { label: "Novità",      icon: "✨", cls: "feature" },
  fix:     { label: "Fix",         icon: "🔧", cls: "fix" },
  balance: { label: "Bilanciamento", icon: "⚖", cls: "balance" },
  chore:   { label: "Tecnico",     icon: "🛠", cls: "chore" },
};

function fmtDate(iso) {
  if (!iso) return "";
  // Evita problemi di fuso: interpreta come data locale "pura".
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const mesi = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  return `${d} ${mesi[m - 1]} ${y}`;
}

export default function Updates() {
  const versions = changelog?.versions || [];
  return (
    <div className="updates-page">
      <header className="updates-header">
        <h1 className="updates-title">📝 Novità &amp; Aggiornamenti</h1>
        <p className="updates-sub">Cosa è cambiato, versione per versione.</p>
      </header>

      {versions.length === 0 && (
        <p className="updates-empty">Nessun aggiornamento registrato.</p>
      )}

      <div className="updates-timeline">
        {versions.map((v, i) => (
          <article key={v.version + i} className={`updates-card ${i === 0 ? "latest" : ""}`}>
            <div className="updates-card-head">
              <span className="updates-version">v{v.version}</span>
              {i === 0 && <span className="updates-latest-badge">ULTIMA</span>}
              <span className="updates-date">{fmtDate(v.date)}</span>
            </div>
            {v.title && <h2 className="updates-card-title">{v.title}</h2>}
            <ul className="updates-changes">
              {(v.changes || []).map((c, j) => {
                const meta = TYPE_META[c.type] || TYPE_META.chore;
                return (
                  <li key={j} className="updates-change">
                    <span className={`updates-tag ${meta.cls}`}>{meta.icon} {meta.label}</span>
                    <span className="updates-change-text">{c.text}</span>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
