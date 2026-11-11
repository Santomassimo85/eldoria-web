import { heroIdentity } from "../utils/segreteIdentity";
/* LE SEGRETE · i tuoi eroi (2026-11-04)
   La lobby divisa in pezzi chiari: qui ci sono gli EROI già creati (uno per classe),
   ognuno con livello, PE, PF/CA e cosa ha da sistemare (PF da tirare, punti
   caratteristica, nuove abilità), e a parte il picker delle classi ancora da creare.
   Toccare un eroe = sceglierlo per il gruppo e aprirne la scheda. */
import { SgIcon } from "../components/GameIcon";
import { STORY_CLASSES, heroOf, runsOf, DAILY_RUNS, clsStyle } from "../data/segrete";
import { heroGear } from "../data/segreteItems";
import { heroPending, hpPending, heroStats, heroMaxHp, heroAc, heroDefense, xpForLevel, heroXp, armorChosen, MAX_STORY_LEVEL } from "../data/segreteKits";

/* Cosa ha da sistemare un eroe: [{k, icon, text}] */
export function heroTodo(hero, cls) {
  if (!hero) return [];
  const p = heroPending(hero);
  const hp = hpPending(hero);
  const out = [];
  if (!hero.weapon) out.push({ k: "weapon", icon: "🗡", text: "scegli l'arma" });
  if (cls && !armorChosen(cls, hero)) out.push({ k: "armor", icon: "🛡", text: hero.armor ? "armatura non adatta: cambiala" : "scegli l'armatura" });
  if (hp > 0) out.push({ k: "hp", icon: "❤", text: hp === 1 ? "tira i PF" : `tira i PF (${hp})` });
  if (p.asi > 0) out.push({ k: "asi", icon: "⭐", text: `+${p.asi} caratteristica` });
  if (p.picks > 0) out.push({ k: "pick", icon: "✨", text: p.picks === 1 ? "nuova abilità" : `${p.picks} abilità` });
  return out;
}

export const heroClasses = (charData) => STORY_CLASSES.filter((c) => heroOf(charData, c.key));

function runState(charData, cls) {
  const r = runsOf(charData, cls);
  if (r.dayCount >= DAILY_RUNS) return { cls: "is-done", text: `oggi ${r.dayCount}/${DAILY_RUNS} · può aiutare` };
  return { cls: "is-free", text: `oggi ${r.dayCount}/${DAILY_RUNS}` };
}

const heroLine = (charData, key) => {
  const h = heroOf(charData, key);
  const lv = heroPending(h).level;
  const xp = heroXp(h);
  const from = xpForLevel(lv);
  const to = lv >= MAX_STORY_LEVEL ? from : xpForLevel(lv + 1);
  const pct = lv >= MAX_STORY_LEVEL ? 100 : Math.round((100 * (xp - from)) / Math.max(1, to - from));
  return { h, lv, pct, st: heroStats(h) };
};

/* Scelta rapida dell'eroe (2026-11-06): una fila di chip, senza aprire la scheda
   Personaggi. Gli eroi con i PF ancora da tirare sono spenti. */
export function HeroQuickPick({ charData, value, onPick, disabled, onManage, label = "Entri con" }) {
  const list = heroClasses(charData);
  return (
    <div className="sgr-qp">
      <p className="sgr-label">{label}</p>
      {!list.length ? (
        <p className="sgr-hint">Non hai ancora un eroe. <button type="button" className="sgr-linkbtn" onClick={onManage}>Crealo in Personaggi →</button></p>
      ) : (
        <div className="sgr-qp-row" role="radiogroup" aria-label={label}>
          {list.map((c) => {
            const { h, lv } = heroLine(charData, c.key);
            const ready = hpPending(h) === 0;
            const run = runState(charData, c.key);
            const on = value === c.key;
            return (
              <button key={c.key} type="button" role="radio" aria-checked={on} disabled={disabled || !ready}
                title={ready ? `${heroIdentity(c.key, h)} Lv ${lv} · ${run.text}` : "Prima tira i PF nella scheda Personaggi"}
                className={`sgr-qp-b${on ? " is-on" : ""}${run.cls === "is-done" ? " is-done" : ""}`} style={clsStyle(c.key)} onClick={() => !on && onPick(c.key)}>
                <SgIcon kind="cls" of={c} frame size="sm" color="var(--cls)" />
                <b>{heroIdentity(c.key, h)}</b>
                <small>Lv {lv} · {ready ? run.text.replace(" · può aiutare", " · aiuto") : "tira i PF"}</small>
              </button>
            );
          })}
        </div>
      )}
      {!!list.length && onManage && <button type="button" className="sgr-linkbtn" onClick={onManage}>gestisci gli eroi →</button>}
    </div>
  );
}

/* Eroi a fisarmonica (2026-11-06): una riga corta per eroe; tocco = apre la sua scheda
   sotto la riga (una alla volta). "Usa questo eroe" lo sceglie per il gruppo. */
export function HeroAccordion({ charData, value, open, onOpen, onUse, disabled, inRoom, renderDetail }) {
  const list = heroClasses(charData);
  if (!list.length) return <p className="sgr-empty">Non hai ancora eroi: creane uno qui sotto.</p>;
  return (
    <ul className="sgr-acc">
      {list.map((c) => {
        const { h, lv, pct, st } = heroLine(charData, c.key);
        const todo = heroTodo(h, c.key);
        const run = runState(charData, c.key);
        const isOpen = open === c.key;
        const inUse = value === c.key;
        return (
          <li key={c.key} className={`sgr-acc-i${isOpen ? " is-open" : ""}${inUse ? " is-use" : ""}`} style={clsStyle(c.key)}>
            <button type="button" className="sgr-acc-h" aria-expanded={isOpen} onClick={() => onOpen(isOpen ? null : c.key)}>
              <SgIcon kind="cls" of={c} frame size="md" color="var(--cls)" className="sgr-acc-ico" />
              <span className="sgr-acc-main">
                <b>{heroIdentity(c.key, h)} <small>Lv {lv}</small>{inUse && <em className="sgr-acc-use">{inRoom ? "nel gruppo" : "in uso"}</em>}</b>
                <span className="sgr-acc-xp" title={`${pct}% al livello dopo`}><i style={{ width: `${pct}%` }} /></span>
                <small className="sgr-acc-sub">{heroMaxHp(c.key, lv, st, h.hpRolls || []) + heroDefense(c.key, st, heroGear(h, c.key)).hpBonus} PF · CA {heroAc(c.key, st, heroGear(h, c.key))} · <span className={run.cls}>{run.text}</span></small>
              </span>
              {!!todo.length && <span className="sgr-acc-todo" title={todo.map((t) => t.text).join(", ")}>{todo.map((t) => t.icon).join("")}</span>}
              <span className="sgr-acc-chev" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
            </button>
            {isOpen && (
              <div className="sgr-acc-body">
                {!inUse && (
                  <button type="button" className="sgr-btn sgr-acc-usebtn" disabled={disabled || hpPending(h) > 0} onClick={() => onUse(c.key)}>
                    ▶ Usa questo eroe{inRoom ? " nel gruppo" : ""}
                  </button>
                )}
                {renderDetail(c.key)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
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
        const xp = heroXp(h);
        const from = xpForLevel(lv);
        const to = lv >= MAX_STORY_LEVEL ? from : xpForLevel(lv + 1);
        const pct = lv >= MAX_STORY_LEVEL ? 100 : Math.round((100 * (xp - from)) / Math.max(1, to - from));
        const todo = heroTodo(h, c.key);
        const run = runState(charData, c.key);
        const on = value === c.key;
        return (
          <button key={c.key} type="button" role="radio" aria-checked={on} disabled={disabled}
            className={`sgr-hero${on ? " is-on" : ""}${todo.length ? " has-todo" : ""}`} style={clsStyle(c.key)} onClick={() => onSelect(c.key)}>
            {on && <span className="sgr-hero-on">▶ {playingLabel}</span>}
            <span className="sgr-hero-top">
              <SgIcon kind="cls" of={c} frame size="lg" color="var(--cls)" className="sgr-hero-ico" />
              <span className="sgr-hero-name"><b>{heroIdentity(c.key, h)}</b><small>Livello {lv}</small></span>
            </span>
            <span className="sgr-hero-xp" title={lv >= MAX_STORY_LEVEL ? "livello massimo" : `${xp} / ${to} PE`}><i style={{ width: `${pct}%` }} /></span>
            <span className="sgr-hero-stats">{heroMaxHp(c.key, lv, st, h.hpRolls || []) + heroDefense(c.key, st, heroGear(h, c.key)).hpBonus} PF · CA {heroAc(c.key, st, heroGear(h, c.key))} · {lv >= MAX_STORY_LEVEL ? "max" : `${pct}% al Lv ${lv + 1}`}</span>
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
          <SgIcon kind="cls" of={c} frame size="lg" color="var(--cls)" />
          <b>{c.it}</b>
          <small>da creare</small>
        </button>
      ))}
    </div>
  );
}

/* Avviso in cima: quali eroi si sono potenziati e hanno qualcosa da scegliere */
export function HeroNews({ charData, onSelect }) {
  const list = heroClasses(charData).map((c) => ({ c, todo: heroTodo(heroOf(charData, c.key), c.key) })).filter((x) => x.todo.length);
  const free = Number(charData?.storyRespecFree) > 0;
  if (!list.length && !free) return null;
  return (
    <div className="sgr-news" role="status">
      {free && <b>♻ Hai un reset gratuito: apri la scheda di un eroe e rifallo dalla piega «Reset dell'eroe».</b>}
      {!!list.length && <b>⬆ Eroi da sistemare</b>}
      {list.map(({ c, todo }) => (
        <button key={c.key} type="button" className="sgr-news-i" style={clsStyle(c.key)} onClick={() => onSelect(c.key)}>
          {c.icon} {heroIdentity(c.key, heroOf(charData, c.key))} Lv {heroPending(heroOf(charData, c.key)).level}: {todo.map((t) => `${t.icon} ${t.text}`).join(" · ")} →
        </button>
      ))}
    </div>
  );
}
