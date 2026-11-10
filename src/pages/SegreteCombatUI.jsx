/* Pannelli e informazioni della lotta delle Segrete in prima persona. */
import { statusIcons } from "../utils/segreteCombat";
import { useState } from "react";
import { itemOf, COIN_ICON } from "../data/segreteItems";

/* Bottino (2026-11-05): cosa hai preso finora, sala per sala (run.gains[uid] dal motore). */
const floorLabel = (run, fl) => (fl > run.floors ? "👑 Boss" : `🚪 Sala ${fl}`);
const gainText = (g) => (g.it ? `${itemOf(g.it)?.icon || "🎁"} ${itemOf(g.it)?.name || g.it}` : `${COIN_ICON} ${g.c}`);
export function FloorGains({ run, uid }) {
  const list = ((run.gains || {})[uid] || []).filter((g) => g.fl === run.floor);
  if (!list.length) return <p className="sgb-gain-none">In questa sala non hai raccolto niente.</p>;
  const coins = list.reduce((t, g) => t + (g.c || 0), 0);
  return (
    <p className="sgb-gain-floor">🎒 In questa sala hai preso: <b>{COIN_ICON} {coins}</b>
      {list.filter((g) => g.it).map((g, i) => <span key={i}> · {gainText(g)}</span>)}</p>
  );
}
export function SpoilsBox({ run, uid, spoils, hidden }) {
  const [open, setOpen] = useState(false);
  const gains = (run.gains || {})[uid] || [];
  if ((run.heroes || []).find((h) => h.uid === uid)?.helper) {
    return <div className="sgb-spoils"><p className="sgb-spoils-head">🤝 Partecipi come aiuto: hai già finito i dungeon con questo eroe, quindi niente PE, monete né bottino. Il gruppo ti ringrazia (e conti per la Compagnia)!</p></div>;
  }
  if (!spoils && !gains.length) return null;
  const coins = spoils?.coins || 0;
  const items = Object.entries(spoils?.items || {});
  const byFloor = [];
  gains.forEach((g) => { const last = byFloor[byFloor.length - 1]; if (last && last.fl === g.fl) last.list.push(g); else byFloor.push({ fl: g.fl, list: [g] }); });
  const state = run.status === "won" ? "portato a casa!" : run.status === "lost" ? "perduto." : "lo portate a casa solo se vincete";
  return (
    <div className={`sgb-spoils${hidden ? " is-wait" : ""}`}>
      <button type="button" className="sgb-spoils-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>🎒 Il tuo bottino: <b>{COIN_ICON} {coins} Monete Antiche</b>
          {items.map(([id, n]) => itemOf(id) && <span key={id}> · {itemOf(id).icon} {itemOf(id).name}{n > 1 ? ` ×${n}` : ""}</span>)}
          <small> · {state}</small>
          {(run.party || 0) > 1 && <small className="sgb-company"> · 🤝 Compagnia ×{run.party}</small>}</span>
        {!!gains.length && <em>{open ? "chiudi ▴" : "sala per sala ▾"}</em>}
      </button>
      {open && (
        <ol className="sgb-spoils-list">
          {byFloor.map((b) => (
            <li key={b.fl}>
              <b>{floorLabel(run, b.fl)}</b>
              <span>{b.list.map((g, i) => <span key={i} className="sgb-gain">{gainText(g)} <small>{g.src}</small></span>)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* Scheda del nemico (pressione lunga). I dati veri solo se quel TIPO di mostro è già stato
   sconfitto almeno una volta in una qualunque partita (dungeon_meta/known), sennò ????. */
const DMG_LABEL = { slashing: "🗡 Tagliente", piercing: "🏹 Perforante", bludgeoning: "🔨 Contundente", fire: "🔥 Fuoco", cold: "❄ Freddo", lightning: "⚡ Fulmine", thunder: "🔊 Tuono", acid: "🧪 Acido", poison: "☠ Veleno", necrotic: "🌑 Necrotico", radiant: "✨ Radioso", force: "💫 Forza", psychic: "🧠 Psichico" };
const ROLE_LABEL = { minion: "🐀 Gregario", elite: "💀 Élite", boss: "👑 Boss" };
function foeActionLine(a) {
  const dice = a.diceNum && a.diceType ? `${a.diceNum}${a.diceType}${Number(a.bonus) && a.type === "heal" ? `+${a.bonus}` : ""}` : "";
  if (a.type === "heal") return `💚 cura ${dice}`;
  if (a.type === "buff_ca") return `🛡 +${a.acBonus || 2} CA per ${a.durationTurns || 2} round`;
  if (a.type === "buff_adv") return `🎯 vantaggio per ${a.durationTurns || 2} round`;
  if (a.type === "debuff_dis") return `🌫 svantaggio ${a.aoeShape && a.aoeShape !== "single" ? "a tutti" : "a un eroe"} per ${a.durationTurns || 2} round`;
  const area = a.aoeShape && a.aoeShape !== "single";
  const save = a.hitMode === "save" || area;
  return `${dice}${save ? ` · TS ${String(a.saveAbility || "dex").toUpperCase()} CD ${a.saveDC || 12}${a.halfOnSave !== false ? " (metà se lo superi)" : ""}` : ` · +${a.bonus || 0} al colpire`}${area ? " · tutto il gruppo" : ""}`;
}
export function FoeCard({ f, known, kills, round, onClose }) {
  const q = "????";
  const list = (arr) => (arr || []).map((k) => DMG_LABEL[k] || k).join(", ");
  const icons = f.hp > 0 ? statusIcons(f, round) : [];
  return (
    <div className="sgb-card-back" role="presentation" onClick={onClose}>
      <div className="sgb-card" role="dialog" aria-modal="true" aria-label={`Scheda di ${f.name}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sgb-card-x" onClick={onClose} aria-label="Chiudi">✕</button>
        <div className="sgb-card-head">
          {(f.frontImg || f.img) ? <img src={f.frontImg || f.img} alt="" /> : <span className="sgb-emoji" aria-hidden="true">{f.icon || "👹"}</span>}
          <div>
            <b>{f.name}</b>
            <small>{ROLE_LABEL[f.role] || ""} · Lv {f.level}</small>
            <small className={known ? "is-known" : "is-unknown"}>{known ? `📖 Conosciuto · sconfitto ${kills} ${kills === 1 ? "volta" : "volte"} nelle Segrete` : "❔ Mai sconfitto: nessuno sa ancora com'è fatto"}</small>
          </div>
        </div>
        <dl className="sgb-card-stats">
          <div><dt>PF</dt><dd>{known ? `${f.hp} / ${f.maxHp}` : q}</dd></div>
          <div><dt>CA</dt><dd>{known ? f.ac : q}</dd></div>
        </dl>
        <p className="sgb-card-h">Resistenze</p>
        {known ? (
          <ul className="sgb-card-list">
            <li><span>Resiste (½)</span> {list(f.res) || "—"}</li>
            <li><span>Vulnerabile (×2)</span> {list(f.vul) || "—"}</li>
            <li><span>Immune</span> {list(f.imm) || "—"}</li>
          </ul>
        ) : <p className="sgb-card-q">{q}</p>}
        <p className="sgb-card-h">Attacchi e poteri</p>
        {known ? (
          <ul className="sgb-card-list">
            {(f.actions || []).map((a, i) => <li key={i}><b>{a.name || "Attacco"}</b> {foeActionLine(a)}</li>)}
            {!(f.actions || []).length && <li>—</li>}
          </ul>
        ) : <p className="sgb-card-q">{q}</p>}
        {!!icons.length && (
          <>
            <p className="sgb-card-h">Effetti adesso</p>
            <ul className="sgb-card-list">{icons.map((i) => <li key={i.k}>{i.ico} {i.t}{i.n ? ` · ${i.n} round` : ""}</li>)}</ul>
          </>
        )}
        {!known && <p className="sgb-card-hint">Sconfiggetene uno e la sua scheda si svelerà per tutti.</p>}
      </div>
    </div>
  );
}
