import React from "react";
import changelog from "../data/changelog.json";
import "./Updates.css";

// Tipologie di modifica. L'ordine dell'oggetto è anche l'ordine con cui i
// gruppi vengono mostrati dentro ogni versione.
const TYPE_META = {
  feature:   { label: "Novità",        icon: "✨", cls: "feature" },
  graphic:   { label: "Grafica",       icon: "🎨", cls: "graphic" },
  mechanics: { label: "Meccaniche",    icon: "⚙",  cls: "mechanics" },
  balance:   { label: "Bilanciamento", icon: "⚖",  cls: "balance" },
  fix:       { label: "Fix",           icon: "🔧", cls: "fix" },
  chore:     { label: "Tecnico",       icon: "🛠", cls: "chore" },
};
const TYPE_ORDER = Object.keys(TYPE_META);

// Raggruppa le modifiche di una versione per tipologia, nell'ordine canonico.
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
        <h1 className="updates-title">UPDATE</h1>
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
            <div className="updates-groups">
              {groupByType(v.changes).map(g => (
                <section key={g.type} className={`updates-group ${g.meta.cls}`}>
                  <div className="updates-group-head">
                    <span className="updates-group-icon" aria-hidden="true">{g.meta.icon}</span>
                    <span className="updates-group-label">{g.meta.label}</span>
                    <span className="updates-group-count">{g.items.length}</span>
                  </div>
                  <ul className="updates-changes">
                    {g.items.map((c, j) => (
                      <li key={j} className="updates-change">
                        <span className="updates-change-dot" aria-hidden="true" />
                        <span className="updates-change-text">{c.text}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
