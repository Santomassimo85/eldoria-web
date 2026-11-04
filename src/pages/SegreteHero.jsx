/* LE SEGRETE · l'eroe di classe (2026-11-04)
   Un eroe per classe, permanente. Senza eroe: si crea (10 punti caratteristica
   come nell'Arena, massimo +3, e una prima abilità/incantesimo). Con l'eroe:
   livello e PE, caratteristiche, azioni, e quando matura (ogni 3 livelli) un
   punto caratteristica e una scelta nuova. Tutto passa dal server (segreteDo). */
import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { classInfo, heroOf } from "../data/segrete";
import {
  kitOf, poolFor, heroActions, heroStats, heroPending, heroMaxHp, heroAc, xpForLevel, STAT_KEYS, STAT_LABEL,
  STAT_BUDGET, STAT_CAP, STAT_MAX, MAX_STORY_LEVEL, ASI_EVERY,
} from "../data/segreteKits";

let callable = null;
const segreteDo = (data) => { callable = callable || httpsCallable(functions, "segreteDo"); return callable(data).then((r) => r.data); };
const STAT_HINT = { str: "colpi in mischia", dex: "CA leggera, iniziativa, archi", con: "punti ferita", int: "magia del Mago", wis: "magia di Druido e Chierico", cha: "magia di Stregone, Warlock, Bardo, Paladino" };

function actionLine(a) {
  if (a.info) return a.info;
  if (a.kind === "heal") return a.flat ? "cura in base al livello" : `cura ${a.dice}`;
  if (a.kind === "heal_all") return `cura tutti ${a.dice}`;
  if (a.kind === "buff") return a.buff === "ac" ? `+${a.value} CA per ${a.turns}t` : a.buff === "adv" ? `vantaggio per ${a.turns}t` : `+${a.value} danni per ${a.turns}t`;
  if (a.kind === "debuff") return `svantaggio per ${a.turns}t`;
  if (a.kind === "save") return `${a.dice} · TS ${a.save.toUpperCase()}${a.area ? " · tutti i nemici" : ""}`;
  return a.dice || "";
}
const ActChip = ({ a, sub }) => (
  <span className="sgh-act" title={actionLine(a)}>
    <span aria-hidden="true">{a.icon}</span> <b>{a.name}</b>{a.uses ? <em> · {a.uses}/sala</em> : null}
    <small>{sub || actionLine(a)}</small>
  </span>
);

export default function SegreteHero({ cls, charData }) {
  const hero = heroOf(charData, cls);
  const info = classInfo(cls);
  const kit = kitOf(cls);
  const [stats, setStats] = useState({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async (data) => {
    if (busy) return;
    setBusy(true); setErr("");
    try { await segreteDo(data); } catch (e) { setErr(e.message || "Non riuscito."); } finally { setBusy(false); }
  };

  if (!cls) return null;

  if (!hero) {
    const spent = STAT_KEYS.reduce((t, k) => t + stats[k], 0);
    const left = STAT_BUDGET - spent;
    const starters = poolFor(cls, 1);
    const auto = () => {
      // principale +3, seconda consigliata +3, poi COS/DES/SAG… finché finiscono i punti
      const s = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
      let l = STAT_BUDGET;
      for (const k of [kit.stat, kit.rec[1], "con", "dex", "wis", "str", "int", "cha"]) {
        const add = Math.min(STAT_CAP - s[k], l);
        s[k] += add; l -= add;
      }
      setStats(s);
    };
    return (
      <div className="sgh sgh--new">
        <p className="sgh-title">{info?.icon} Crea il tuo {info?.it}</p>
        <p className="sgh-hint">L'eroe resta tuo per sempre e cresce di livello vincendo i dungeon. Distribuisci <b>{STAT_BUDGET} punti</b> (massimo +{STAT_CAP} per caratteristica). Consigliate: <b>{kit.rec.map((k) => STAT_LABEL[k]).join(", ")}</b>.</p>
        <div className="sgh-stats">
          {STAT_KEYS.map((k) => (
            <div key={k} className={`sgh-stat${kit.rec.includes(k) ? " is-rec" : ""}`}>
              <b>{STAT_LABEL[k]}</b>
              <div className="sgh-stat-ctl">
                <button type="button" disabled={stats[k] <= 0} onClick={() => setStats({ ...stats, [k]: stats[k] - 1 })} aria-label={`Togli a ${STAT_LABEL[k]}`}>−</button>
                <span>+{stats[k]}</span>
                <button type="button" disabled={stats[k] >= STAT_CAP || left <= 0} onClick={() => setStats({ ...stats, [k]: stats[k] + 1 })} aria-label={`Aggiungi a ${STAT_LABEL[k]}`}>+</button>
              </div>
              <small>{STAT_HINT[k]}</small>
            </div>
          ))}
        </div>
        <div className="sgh-row">
          <span className="sgh-left">{left > 0 ? `${left} punti da assegnare` : "✓ Punti assegnati"}</span>
          <button type="button" className="sgr-btn sgr-btn--ghost" onClick={auto}>🎲 Distribuisci per me</button>
        </div>
        <p className="sgh-sub">Hai già: {kit.base.map((a) => `${a.icon} ${a.name}`).join(" · ")}</p>
        <p className="sgh-sub">Scegli la prima abilità o il primo incantesimo:</p>
        <div className="sgh-picks">
          {starters.map((a) => (
            <button key={a.id} type="button" aria-pressed={pick === a.id} className={`sgh-pick${pick === a.id ? " is-on" : ""}`} onClick={() => setPick(a.id)}>
              <ActChip a={a} />
            </button>
          ))}
        </div>
        {err && <p className="sgr-err">{err}</p>}
        <button type="button" className="sgr-cta" disabled={busy || left < 0 || !pick}
          onClick={() => send({ op: "heroCreate", cls, stats, pick })}>{busy ? "Creo…" : `Crea l'eroe ${info?.it || ""}`}</button>
      </div>
    );
  }

  const pend = heroPending(hero);
  const lv = pend.level;
  const st = heroStats(hero);
  const curXp = Number(hero.xp) || 0;
  const from = xpForLevel(lv);
  const to = lv >= MAX_STORY_LEVEL ? from : xpForLevel(lv + 1);
  const pct = lv >= MAX_STORY_LEVEL ? 100 : Math.round((100 * (curXp - from)) / Math.max(1, to - from));
  const acts = heroActions(cls, lv, hero.picks || []).filter((a) => a.kind !== "defend");
  const options = poolFor(cls, lv).filter((a) => !(hero.picks || []).includes(a.id));
  const locked = kit.pool.filter((a) => (a.min || 1) > lv);
  const nextMilestone = Math.min(MAX_STORY_LEVEL, (Math.floor(lv / ASI_EVERY) + 1) * ASI_EVERY);

  return (
    <div className="sgh">
      <div className="sgh-head">
        <span className="sgh-ico" aria-hidden="true">{info?.icon}</span>
        <div>
          <p className="sgh-title">{info?.it} · Livello {lv}</p>
          <small>{heroMaxHp(cls, lv, st)} PF · CA {heroAc(cls, st)} · {lv >= MAX_STORY_LEVEL ? "livello massimo" : `${curXp.toLocaleString("it-IT")} / ${to.toLocaleString("it-IT")} PE`}</small>
        </div>
      </div>
      <div className="sgh-xp"><i style={{ width: `${pct}%` }} /></div>
      <div className="sgh-statline">
        {STAT_KEYS.map((k) => <span key={k} className={kit.rec.includes(k) ? "is-rec" : ""}><b>{STAT_LABEL[k]}</b> {st[k] >= 0 ? "+" : ""}{st[k]}</span>)}
      </div>

      {pend.asi > 0 && (
        <div className="sgh-pending">
          <p>⭐ Hai <b>{pend.asi}</b> {pend.asi === 1 ? "punto caratteristica" : "punti caratteristica"} da spendere (massimo +{STAT_MAX}):</p>
          <div className="sgh-row">
            {STAT_KEYS.map((k) => (
              <button key={k} type="button" className="sgr-btn" disabled={busy || st[k] >= STAT_MAX} onClick={() => send({ op: "heroAsi", cls, stat: k })}>+1 {STAT_LABEL[k]}</button>
            ))}
          </div>
        </div>
      )}
      {pend.picks > 0 && (
        <div className="sgh-pending">
          <p>✨ Puoi imparare <b>{pend.picks}</b> {pend.picks === 1 ? "nuova abilità o incantesimo" : "nuove abilità o incantesimi"}:</p>
          <div className="sgh-picks">
            {options.map((a) => (
              <button key={a.id} type="button" className="sgh-pick" disabled={busy} onClick={() => send({ op: "heroPick", cls, pick: a.id })}>
                <ActChip a={a} />
              </button>
            ))}
            {!options.length && <small>Hai già tutto quello che c'è al tuo livello: torna più avanti.</small>}
          </div>
        </div>
      )}
      {err && <p className="sgr-err">{err}</p>}

      <p className="sgh-sub">Le tue azioni</p>
      <div className="sgh-acts">{acts.map((a) => <ActChip key={a.id} a={a} />)}</div>
      {lv < MAX_STORY_LEVEL && (
        <p className="sgh-hint">Al livello {nextMilestone}: +1 punto caratteristica e una nuova scelta.{locked.length ? ` Da sbloccare: ${locked.map((a) => `${a.icon} ${a.name} (Lv ${a.min})`).join(" · ")}.` : ""}</p>
      )}
    </div>
  );
}
