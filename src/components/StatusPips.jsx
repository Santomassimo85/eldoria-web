/* ============================================================
   ICONE DI STATO SULLO SPRITE (2026-11-04) — per tutti i fight
   (Arena, Segrete, World Boss, pet). Ogni icona dice al volo:
     simbolo che saltella · alone verde (bonus) / rosso (malus)
     sotto, l'EFFETTO in breve ("+3 CA", "svant.", "1d6/t")
     nell'angolo, la DURATA ("2" = turni, ∞, 1×)
   Il tocco/hover mostra la spiegazione intera (title).
   items = [{ k, icon, tag, dur, good, tip, spent }]
   ============================================================ */
import "./StatusPips.css";

export default function StatusPips({ items, max = 5, className = "" }) {
  if (!items?.length) return null;
  const shown = items.slice(0, max);
  return (
    <span className={`stp ${className}`} aria-label={items.map((x) => x.tip || x.tag).join(" · ")}>
      {shown.map((x, i) => (
        <span key={x.k ?? i} className={`stp-i ${x.good ? "is-good" : "is-bad"}${x.spent ? " is-spent" : ""}`}
          title={x.tip || x.tag} style={{ "--stp-d": `${(i * 0.31).toFixed(2)}s` }}>
          <i aria-hidden="true">{x.icon}</i>
          {x.dur != null && x.dur !== "" && <small>{x.dur}</small>}
          {x.tag && <em>{x.tag}</em>}
        </span>
      ))}
      {items.length > max && <span className="stp-more" title={items.slice(max).map((x) => x.tip || x.tag).join(" · ")}>+{items.length - max}</span>}
    </span>
  );
}

/* Durata scritta corta: 3 → "3", "3t" → "3", null → "" */
export const durShort = (d) => (d == null ? "" : String(d).replace(/^(\d+)\s*t(urni?)?$/i, "$1"));
