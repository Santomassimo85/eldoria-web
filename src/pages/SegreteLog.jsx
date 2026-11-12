import SegreteIdentity from "../components/SegreteIdentity";
/* LE SEGRETE · Storico dei dungeon (2026-11-05)
   `characters.storyLog` = ultime 40 spedizioni finite, scritte dal server (segreteDo):
   {at, day, dungeon, icon, cls, result won|lost|fled, floor, floors, coins, items, kept, xp, lvTo, corone, loot}.
   Si mostra quello di OGGI (giorno di Roma) e, a richiesta, i giorni prima. */
import { useState } from "react";
import { classInfo, clsStyle, romeDayKey } from "../data/segrete";
import { COIN_ICON, COIN_NAME, itemOf } from "../data/segreteItems";

export const storyLogOf = (charData) => (Array.isArray(charData?.storyLog) ? charData.storyLog : []);
// Monete Antiche portate a casa oggi
export const coinsToday = (charData, day = romeDayKey()) =>
  storyLogOf(charData).filter((e) => e.day === day && e.kept).reduce((t, e) => t + (Number(e.coins) || 0), 0);

const RESULT = { won: "🏆 Vinto", lost: "☠ Perso", fled: "🏃 Abbandonato" };
const hhmm = (ms) => new Date(ms).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
const dayLabel = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

function Row({ e }) {
  const c = classInfo(e.cls);
  const items = Object.entries(e.items || {}).filter(([id]) => itemOf(id));
  const isTower = Boolean(e.isTower);
  const reached = isTower
    ? `Piano ${e.floor || 0}/${e.floors || 100} superato`
    : (e.floor > e.floors ? "boss" : `sala ${e.floor}/${e.floors}`);
  return (
    <li className={`sgl-row is-${e.result}`} style={clsStyle(e.cls)}>
      <span className="sgl-time">{hhmm(e.at)}</span>
      <span className="sgl-main">
        <b>{e.icon} {e.dungeon} <span className="sgr-clsname">· {c?.icon} <SegreteIdentity cls={e.cls} hero={e} /></span></b>
        <small>{isTower ? (e.floor > 0 ? "🗼 Scalata registrata" : "☠ Caduto al Piano 1") : (RESULT[e.result] || e.result)}{e.helper ? " · 🤝 aiuto" : ""} · {reached}</small>
        <span className="sgl-gain">
          {e.helper ? (
            <em>🤝 come aiuto: nessun premio</em>
          ) : isTower ? (
            <>
              {!!e.xp && <em>⭐ +{e.xp} PE{e.lvTo ? ` · Lv ${e.lvTo}!` : ""}</em>}
              {e.floor > 0 ? <em>🎁 Piano {e.floor} registrato per i premi unici di domenica alle 23:00</em> : <em className="sgl-lost">nessun piano superato</em>}
            </>
          ) : e.kept ? (
            <>
              <em className="sgl-coins">{COIN_ICON} +{e.coins}</em>
              {items.map(([id, n]) => <em key={id}>{itemOf(id).icon} {itemOf(id).name}{n > 1 ? ` ×${n}` : ""}</em>)}
              {!!e.xp && <em>⭐ +{e.xp} PE{e.lvTo ? ` · Lv ${e.lvTo}!` : ""}</em>}
              {!!e.corone && <em>👑 +{e.corone} Corone</em>}
              {e.loot && <em>🎁 {e.loot}</em>}
            </>
          ) : (
            <em className="sgl-lost">{e.coins || items.length ? `perso il bottino (${COIN_ICON} ${e.coins}${items.length ? ` e ${items.length} oggett${items.length === 1 ? "o" : "i"}` : ""})` : "nessun bottino"}</em>
          )}
        </span>
      </span>
    </li>
  );
}

export default function SegreteLog({ charData }) {
  const [all, setAll] = useState(false);
  const today = romeDayKey();
  const log = storyLogOf(charData).slice().reverse();
  const todayList = log.filter((e) => e.day === today);
  const older = log.filter((e) => e.day !== today);
  const days = [...new Set(older.map((e) => e.day))];
  return (
    <section className="sgr-block sgl">
      <h2 className="sgr-h2">📜 Storico di oggi <span className="sgr-coins">{COIN_ICON} +{coinsToday(charData, today)} oggi</span></h2>
      {todayList.length
        ? <ul className="sgl-list">{todayList.map((e) => <Row key={e.at} e={e} />)}</ul>
        : <p className="sgr-empty">Oggi non hai ancora finito un dungeon. Qui trovi, per ogni spedizione, cosa hai portato a casa: {COIN_NAME}, oggetti e PE.</p>}
      {!!older.length && (
        <button type="button" className="sgr-btn sgr-btn--ghost sgl-more" aria-expanded={all} onClick={() => setAll((a) => !a)}>
          {all ? "Nascondi i giorni prima ▴" : `Giorni prima (${older.length}) ▾`}
        </button>
      )}
      {all && days.map((d) => (
        <div key={d}>
          <p className="sgr-label">{dayLabel(d)}</p>
          <ul className="sgl-list">{older.filter((e) => e.day === d).map((e) => <Row key={e.at} e={e} />)}</ul>
        </div>
      ))}
    </section>
  );
}
