/* LE SEGRETE · reset dell'eroe (2026-11-06): si ridistribuiscono caratteristiche e abilità pagando
   RESPEC_COST Monete Antiche (o con un reset regalato dal Master: characters.storyRespecFree).
   Livello, PE, PF tirati, armi e zaino restano. Le regole stanno in validRespec, la stessa funzione
   che usa il server (segreteDo, op heroRespec). */
import { useState } from "react";
import { SgIcon } from "../components/GameIcon";
import { sgTone } from "../data/segreteIcons";
import { coinsOf, COIN_NAME } from "../data/segreteItems";
import { poolFor, heroStats, heroLevel, asiEarned, picksAllowed, validRespec, RESPEC_COST, STAT_KEYS, STAT_LABEL, STAT_BUDGET, STAT_CAP, STAT_MAX } from "../data/segreteKits";

export default function SegreteRespec({ cls, hero, charData, busy, send }) {
  const lv = heroLevel(hero);
  const earned = asiEarned(lv);
  const budget = STAT_BUDGET + earned;
  const maxPicks = picksAllowed(lv);
  const pool = poolFor(cls, lv);
  const [stats, setStats] = useState(() => heroStats(hero));
  const [picks, setPicks] = useState(() => (hero.picks || []).filter((p) => pool.some((a) => a.id === p)));
  const [sure, setSure] = useState(false);
  const [done, setDone] = useState("");

  const free = Math.max(0, Number(charData?.storyRespecFree) || 0);
  const coins = coinsOf(charData);
  const canPay = free > 0 || coins >= RESPEC_COST;
  const spent = STAT_KEYS.reduce((t, k) => t + stats[k], 0);
  const check = validRespec(cls, hero, stats, picks);
  const change = (fn) => { setSure(false); setDone(""); fn(); };
  const canAdd = (k) => !validRespec(cls, hero, { ...stats, [k]: stats[k] + 1 }, picks.length ? picks : [pool[0]?.id]).error;
  const togglePick = (id) => change(() => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < maxPicks ? [...p, id] : p)));

  const confirm = async () => {
    const r = await send({ op: "heroRespec", cls, stats, picks });
    setSure(false);
    if (r?.ok) setDone(r.free ? "✓ Eroe rifatto col reset gratuito." : `✓ Eroe rifatto: ${RESPEC_COST} ${COIN_NAME} spese.`);
  };

  return (
    <div className="sgh-respec">
      <p className="sgh-hint">
        Rifai <b>caratteristiche e abilità</b> senza perdere niente: livello, PE, PF tirati, equipaggiamento e zaino restano.{" "}
        {free > 0
          ? <b className="sgh-perk">Hai {free === 1 ? "un reset gratuito" : `${free} reset gratuiti`}: non paghi niente.</b>
          : <>Costa <b>{RESPEC_COST} {COIN_NAME}</b> (ne hai {coins}).</>}
        {" "}Armi e armatura si cambiano gratis dal riquadro Equipaggiamento.
      </p>
      <p className="sgh-sub">Caratteristiche: {spent} / {budget} punti ({STAT_BUDGET} di base{earned ? ` + ${earned} dei livelli` : ""}). Oltre +{STAT_CAP} servono i punti dei livelli, massimo +{STAT_MAX}.</p>
      <div className="sgh-stats">
        {STAT_KEYS.map((k) => (
          <div key={k} className="sgh-stat">
            <b>{STAT_LABEL[k]}</b>
            <div className="sgh-stat-ctl">
              <button type="button" disabled={busy || stats[k] <= 0} onClick={() => change(() => setStats({ ...stats, [k]: stats[k] - 1 }))} aria-label={`Togli a ${STAT_LABEL[k]}`}>−</button>
              <span>+{stats[k]}</span>
              <button type="button" disabled={busy || !canAdd(k)} onClick={() => change(() => setStats({ ...stats, [k]: stats[k] + 1 }))} aria-label={`Aggiungi a ${STAT_LABEL[k]}`}>+</button>
            </div>
          </div>
        ))}
      </div>
      <p className="sgh-sub">Abilità e incantesimi a scelta: {picks.length} / {maxPicks}</p>
      <div className="sgh-picks">
        {pool.map((a) => {
          const on = picks.includes(a.id);
          return (
            <button key={a.id} type="button" aria-pressed={on} disabled={busy || (!on && picks.length >= maxPicks)} className={`sgh-pick${on ? " is-on" : ""}`} onClick={() => togglePick(a.id)}>
              <span className="sgh-act"><SgIcon kind="action" of={a} frame size="sm" color={sgTone(a)} /> <b>{a.name}</b>{a.cantrip && <em> · Trucchetto</em>}</span>
            </button>
          );
        })}
      </div>
      {check.error && <p className="sgh-sub">{check.error}</p>}
      {!canPay && <p className="sgr-err">Ti mancano {RESPEC_COST - coins} {COIN_NAME}.</p>}
      {done && <p className="sgh-hpmsg">{done}</p>}
      {!sure
        ? <button type="button" className="sgr-cta" disabled={busy || !!check.error || !canPay} onClick={() => setSure(true)}>♻ Rifai l'eroe</button>
        : (
          <div className="sgh-row">
            <button type="button" className="sgr-cta" disabled={busy} onClick={confirm}>{busy ? "Rifaccio…" : free > 0 ? "Conferma (gratis)" : `Conferma (${RESPEC_COST} ${COIN_NAME})`}</button>
            <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => setSure(false)}>Annulla</button>
          </div>
        )}
    </div>
  );
}
