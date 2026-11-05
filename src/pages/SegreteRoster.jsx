/* LE SEGRETE · i tuoi eroi (2026-11-04)
   La lobby divisa in pezzi chiari: qui ci sono gli EROI già creati (uno per classe),
   ognuno con livello, PE, PF/CA e cosa ha da sistemare (PF da tirare, punti
   caratteristica, nuove abilità), e a parte il picker delle classi ancora da creare.
   Toccare un eroe = sceglierlo per il gruppo e aprirne la scheda. */
import { STORY_CLASSES, heroOf, runsOf, DAILY_RUNS, WEEKLY_RUNS, clsStyle } from "../data/segrete";
import { heroPending, hpPending, heroStats, heroMaxHp, heroAc, xpForLevel, MAX_STORY_LEVEL } from "../data/segreteKits";

/* Cosa ha da sistemare un eroe: [{k, icon, text}] */
export function heroTodo(hero) {
  if (!hero) return [];
  const p = heroPending(hero);
  const hp = hpPending(hero);
  const out = [];
  if (!hero.weapon) out.push({ k: "weapon", icon: "🗡", text: "scegli l'arma" });
  if (hp > 0) out.push({ k: "hp", icon: "❤", text: hp === 1 ? "tira i PF" : `tira i PF (${hp})` });
  if (p.asi > 0) out.push({ k: "asi", icon: "⭐", text: `+${p.asi} caratteristica` });
  if (p.picks > 0) out.push({ k: "pick", icon: "✨", text: p.picks === 1 ? "nuova abilità" : `${p.picks} abilità` });
  return out;
}

export const heroClasses = (charData) => STORY_CLASSES.filter((c) => heroOf(charData, c.key));

function runState(charData, cls) {
  const r = runsOf(charData, cls);
  if (r.weekCount >= WEEKLY_RUNS) return { cls: "is-done", text: "✓ settimana fatta · può aiutare" };
  if (r.dayCount >= DAILY_RUNS) return { cls: "is-done", text: "✓ fatto oggi · può aiutare" };
  return { cls: "is-free", text: `pronto · sett. ${r.weekCount}/${WEEKLY_RUNS}` };
}

export function HeroRoster({ charData, value, onSelect, disabled, playingLabel = "scelto" }) {
  const list = heroClasses(charData);
  if (!list.length) return <p className="sgr-empty">Non hai ancora eroi: scegli una classe qui sotto, in «Crea un eroe».</p>;
  return (
    <div className="sgr-roster" role="radiogroup" aria-label="I tuoi eroi">
      {list.map((c) => {
        const h = heroOf(charData, c.key);
        const lv = heroPending(h).level;
        const st = heroStats(h);
        const xp = Number(h.xp) || 0;
        const from = xpForLevel(lv);
        const to = lv >= MAX_STORY_LEVEL ? from : xpForLevel(lv + 1);
        const pct = lv >= MAX_STORY_LEVEL ? 100 : Math.round((100 * (xp - from)) / Math.max(1, to - from));
        const todo = heroTodo(h);
        const run = runState(charData, c.key);
        const on = value === c.key;
        return (
          <button key={c.key} type="button" role="radio" aria-checked={on} disabled={disabled}
            className={`sgr-hero${on ? " is-on" : ""}${todo.length ? " has-todo" : ""}`} style={clsStyle(c.key)} onClick={() => onSelect(c.key)}>
            {on && <span className="sgr-hero-on">▶ {playingLabel}</span>}
            <span className="sgr-hero-top">
              <span className="sgr-hero-ico" aria-hidden="true">{c.icon}</span>
              <span className="sgr-hero-name"><b>{c.it}</b><small>Livello {lv}</small></span>
            </span>
            <span className="sgr-hero-xp" title={lv >= MAX_STORY_LEVEL ? "livello massimo" : `${xp} / ${to} PE`}><i style={{ width: `${pct}%` }} /></span>
            <span className="sgr-hero-stats">{heroMaxHp(c.key, lv, st, h.hpRolls || [])} PF · CA {heroAc(c.key, st)} · {lv >= MAX_STORY_LEVEL ? "max" : `${pct}% al Lv ${lv + 1}`}</span>
            {todo.length ? (
              <span className="sgr-hero-todo">{todo.map((t) => <em key={t.k}>{t.icon} {t.text}</em>)}</span>
            ) : (
              <span className="sgr-hero-ok">✓ tutto a posto</span>
            )}
            <span className={`sgr-hero-run ${run.cls}`}>{run.text}</span>
          </button>
        );
      })}
    </div>
  );
}

/* Picker delle classi SENZA eroe (per crearne uno nuovo) */
export function NewClassPicker({ charData, value, onSelect, disabled }) {
  const list = STORY_CLASSES.filter((c) => !heroOf(charData, c.key));
  if (!list.length) return <p className="sgr-empty">Hai un eroe per ogni classe!</p>;
  return (
    <div className="sgr-classes" role="radiogroup" aria-label="Classe del nuovo eroe">
      {list.map((c) => (
        <button key={c.key} type="button" role="radio" aria-checked={value === c.key} disabled={disabled}
          className={`sgr-class${value === c.key ? " is-on" : ""}`} style={clsStyle(c.key)} onClick={() => onSelect(c.key)}>
          <span aria-hidden="true">{c.icon}</span>
          <b>{c.it}</b>
          <small>da creare</small>
        </button>
      ))}
    </div>
  );
}

/* Avviso in cima: quali eroi si sono potenziati e hanno qualcosa da scegliere */
export function HeroNews({ charData, onSelect }) {
  const list = heroClasses(charData).map((c) => ({ c, todo: heroTodo(heroOf(charData, c.key)) })).filter((x) => x.todo.length);
  if (!list.length) return null;
  return (
    <div className="sgr-news" role="status">
      <b>⬆ Eroi da sistemare</b>
      {list.map(({ c, todo }) => (
        <button key={c.key} type="button" className="sgr-news-i" style={clsStyle(c.key)} onClick={() => onSelect(c.key)}>
          {c.icon} {c.it} Lv {heroPending(heroOf(charData, c.key)).level}: {todo.map((t) => `${t.icon} ${t.text}`).join(" · ")} →
        </button>
      ))}
    </div>
  );
}
