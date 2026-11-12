import { useState } from "react";
import { RACES, RACE_CHANGE_COST, hasRace } from "../data/segreteRaces";
import { STAT_LABEL } from "../data/segreteKits";

export default function SegreteRace({ cls, hero, coins, busy, send }) {
  const [race, setRace] = useState(RACES[hero.race] ? hero.race : "human");
  const [stats, setStats] = useState(hasRace(hero) ? hero.raceStats : []);
  const current = hasRace(hero), chosen = RACES[race];
  const valid = hasRace({ race, raceStats: stats });
  const same = current && hero.race === race && valid && stats.every((s) => hero.raceStats.includes(s));
  const cost = current ? RACE_CHANGE_COST : 0;
  const form = <div className="sgh-race-form">
    <div className="sgh-races" role="radiogroup" aria-label="Razza dell'eroe">
      {Object.entries(RACES).map(([key, r]) => <button key={key} type="button" role="radio" aria-checked={race === key} disabled={busy} className={`sgh-race${race === key ? " is-on" : ""}`} onClick={() => { setRace(key); setStats([]); }}>
        <b>{r.icon} {r.name}</b><small>{r.desc}</small>
      </button>)}
    </div>
    <p className="sgh-hint">Scegli {chosen.count === 2 ? "due caratteristiche diverse" : "una caratteristica"} per il bonus +1, aggiuntivo ai punti base.</p>
    <div className="sgh-row">
      {chosen.stats.map((stat) => <label key={stat} className="sgh-race-stat"><input type="checkbox" checked={stats.includes(stat)} disabled={busy || (!stats.includes(stat) && stats.length >= chosen.count)} onChange={() => setStats((old) => old.includes(stat) ? old.filter((s) => s !== stat) : [...old, stat])} />+1 {STAT_LABEL[stat]}</label>)}
    </div>
    <button type="button" className="sgr-cta" disabled={busy || !valid || same || coins < cost} onClick={() => send({ op: "heroRace", cls, race, stats })}>{busy ? "Salvo…" : current ? `Cambia razza · ${RACE_CHANGE_COST} monete` : "Conferma razza · gratis"}</button>
    {coins < cost && <p className="sgr-err">Servono {RACE_CHANGE_COST} Monete Antiche.</p>}
  </div>;
  if (!current) return <section className="sgh-pending" role="alert"><p>Scegli la razza prima di giocare. La prima scelta è gratuita.</p>{form}</section>;
  return <details className="sgh-fold"><summary>{RACES[hero.race].icon} Razza · {RACES[hero.race].name}<small> · modifica per {RACE_CHANGE_COST} monete</small></summary><p className="sgh-hint">{RACES[hero.race].desc} Ogni modifica costa {RACE_CHANGE_COST} Monete Antiche.</p>{form}</details>;
}
