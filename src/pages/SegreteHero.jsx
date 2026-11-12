/* LE SEGRETE · l'eroe di classe (2026-11-04)
   Un eroe per classe, permanente. Senza eroe: si crea (10 punti caratteristica
   come nell'Arena, massimo +3, e una prima abilità/incantesimo). Con l'eroe:
   livello e PE, caratteristiche, azioni, e quando matura (ogni 3 livelli) un
   punto caratteristica e una scelta nuova. Tutto passa dal server (segreteDo). */
import { SgIcon } from "../components/GameIcon";
import { sgTone } from "../data/segreteIcons";
import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { playDiceRoll } from "../components/diceSound";
import SegreteGear from "./SegreteGear";
import SegreteRespec from "./SegreteRespec";
import { classInfo, heroOf } from "../data/segrete";
import SegreteIdentity from "../components/SegreteIdentity";
import SegreteXp from "../components/SegreteXp";
import { actInfo } from "../utils/segreteCombat";
import { itemOf, heroGear, coinsOf } from "../data/segreteItems";
import {
  kitOf, poolFor, heroActions, weaponChoices, DMG_SHORT, WSTAT_LABEL, heroStats, heroPending, hpPending, heroMaxHp, HERO_HP_BASE, heroDefense, armorChoices, armorProf, ARMORS, ARMOR_CAT_IT, HEAVY_ARMOR_TEXT, TWO_HANDED, DMG_ALL, xpForLevel, heroXp, XP_PER_ROOM, STAT_KEYS, STAT_LABEL,
  STAT_BUDGET, STAT_CAP, STAT_MAX, MAX_STORY_LEVEL, ASI_EVERY, RESPEC_COST,
  subclassesOf, heroSubclass, SUBCLASS_COST, SUBCLASS_LEVEL,
} from "../data/segreteKits";

let callable = null;
const segreteDo = (data) => { callable = callable || httpsCallable(functions, "segreteDo"); return callable(data).then((r) => r.data); };
const STAT_HINT = { str: "colpi in mischia", dex: "CA leggera, iniziativa, archi", con: "punti ferita", int: "magia del Mago", wis: "magia di Druido e Chierico", cha: "magia di Stregone, Warlock, Bardo, Paladino" };

const ActChip = ({ a, sub, lv = 1 }) => (
  <span className="sgh-act" title={actInfo(a, lv)}>
    <SgIcon kind="action" of={a} frame size="sm" color={sgTone(a)} /> <b>{a.name}</b>{a.cantrip ? <em> · Trucchetto</em> : a.uses ? <em> · {a.uses}/sala</em> : null}
    <small>{sub || actInfo(a, lv)}</small>
  </span>
);

/* SOTTOCLASSI (2026-11-10): due per classe, si comprano dal Lv SUBCLASS_LEVEL con le Monete Antiche;
   comprate restano, se ne usa una alla volta (cambio gratis fuori dai dungeon). */
function SubclassBox({ cls, hero, lv, charData, busy, send }) {
  const [ask, setAsk] = useState(null);
  const owned = hero.subclasses || [];
  const active = hero.subclass || null;
  const coins = coinsOf(charData);
  const canBuy = lv >= SUBCLASS_LEVEL;
  return (
    <div className="sgh-subs">
      {!canBuy && <p className="sgh-hint">🔒 Le sottoclassi si sbloccano al <b>Lv {SUBCLASS_LEVEL}</b>: ognuna costa {SUBCLASS_COST.toLocaleString("it-IT")} Monete Antiche.</p>}
      {canBuy && <p className="sgh-hint">Ognuna costa <b>{SUBCLASS_COST.toLocaleString("it-IT")}</b> Monete Antiche (ne hai {coins.toLocaleString("it-IT")}). Comprata resta tua: ne usi una alla volta e la cambi gratis fuori dai dungeon.</p>}
      {subclassesOf(cls).map((sc) => {
        const mine = owned.includes(sc.key), on = active === sc.key;
        return (
          <div key={sc.key} className={`sgh-sub-card${on ? " is-on" : ""}`}>
            <p className="sgh-sub-name">{sc.icon} <b style={{ color: "color-mix(in srgb, var(--cls) 65%, #fff 35%)" }}>{sc.name}</b>{on ? <em> · attiva</em> : mine ? <em> · tua</em> : null}</p>
            <small>{sc.desc}</small>
            <p className="sgh-sub-passive">✦ {sc.passiveTxt}</p>
            <div className="sgh-acts">{sc.actions.map((a) => <ActChip key={a.id} a={a} lv={lv} sub={`${actInfo(a, lv)} · dal Lv ${a.min}`} />)}</div>
            <div className="sgh-row">
              {mine && !on && <button type="button" className="sgr-btn" disabled={busy} onClick={() => send({ op: "heroSubclass", cls, key: sc.key })}>Usa questa</button>}
              {on && <button type="button" className="sgr-btn" disabled={busy} onClick={() => send({ op: "heroSubclass", cls, key: "" })}>Torna alla classe base</button>}
              {!mine && ask !== sc.key && <button type="button" className="sgr-btn" disabled={busy || !canBuy || coins < SUBCLASS_COST} onClick={() => setAsk(sc.key)}>🪙 Compra · {SUBCLASS_COST.toLocaleString("it-IT")}</button>}
              {!mine && ask === sc.key && (
                <>
                  <button type="button" className="sgr-cta" disabled={busy} onClick={() => { setAsk(null); send({ op: "heroSubclass", cls, key: sc.key }); }}>Conferma l'acquisto</button>
                  <button type="button" className="sgr-btn" onClick={() => setAsk(null)}>Annulla</button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeaponPicker({ cls, value, onPick, disabled }) {
  return (
    <div className="sgh-picks">
      {weaponChoices(cls).map((w) => (
        <button key={w.key} type="button" aria-pressed={value === w.key} disabled={disabled}
          className={`sgh-pick${value === w.key ? " is-on" : ""}`} onClick={() => onPick(w.key)}>
          <span className="sgh-act">
            <SgIcon kind="weapon" of={w} frame size="sm" /> <b>{w.name}</b>{w.ranged ? <em> · a distanza</em> : null}
            <small>{w.attacks ? `${w.attacks} attacchi da ` : ""}{w.dice} {DMG_SHORT[w.dmg]} · usa {WSTAT_LABEL[w.wstat]}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ARMATURA (2026-11-06): quelle di partenza della classe (gratis) + scudo sì/no. La CA si vede
   subito, calcolata come in lotta. Le armature migliori sono oggetti (Bottega o dungeon). */
function ArmorPicker({ cls, st, weapon, value, shield, onPick, disabled }) {
  const prof = armorProf(cls);
  const twoH = TWO_HANDED.has(weapon);
  return (
    <>
      <div className="sgh-picks">
        {armorChoices(cls).map((k) => {
          const a = ARMORS[k];
          const ac = heroDefense(cls, st, { armor: k, shield, weapon }).ac;
          return (
            <button key={k} type="button" aria-pressed={value === k} disabled={disabled}
              className={`sgh-pick${value === k ? " is-on" : ""}`} onClick={() => onPick(k, shield)}>
              <span className="sgh-act">
                <SgIcon kind="armor" of={k} fallback={a.icon} frame size="sm" /> <b>{a.name}</b> <em>· CA {ac}</em>
                <small>{a.perk ? <b className="sgh-perk">✦ {a.perk.text} · </b> : null}{ARMOR_CAT_IT[a.cat]}{a.cat === "heavy" ? ` / ${HEAVY_ARMOR_TEXT}` : ""}{a.cat === "unarmored" ? ` · 10 + DES + ${cls === "monk" ? "SAG" : "COS"}` : a.base ? ` · ${a.base}${a.dex === 0 ? "" : a.dex < 9 ? ` + DES (max +${a.dex})` : " + DES"}` : ""}</small>
              </span>
            </button>
          );
        })}
      </div>
      {prof.shield && (
        <label className="sgh-shield">
          <input type="checkbox" checked={shield && !twoH} disabled={disabled || twoH} onChange={(e) => onPick(value, e.target.checked)} />
          🛡 Scudo (+2 CA){twoH ? " · non con un'arma a due mani" : ""}
        </label>
      )}
    </>
  );
}

export default function SegreteHero({ cls, charData }) {
  const hero = heroOf(charData, cls);
  const info = classInfo(cls);
  const kit = kitOf(cls);
  const [stats, setStats] = useState({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
  const [pick, setPick] = useState("");
  const [weapon, setWeapon] = useState("");
  const [armor, setArmor] = useState(null);
  const [shield, setShield] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hpMsg, setHpMsg] = useState("");
  const send = async (data) => {
    if (busy) return null;
    setBusy(true); setErr("");
    try { return await segreteDo(data); } catch (e) { setErr(e.message || "Non riuscito."); return null; } finally { setBusy(false); }
  };
  const rollHp = async () => {
    setHpMsg("🎲 Il dado rotola…");
    playDiceRoll(900, 1);
    const r = await send({ op: "heroHp", cls });
    setHpMsg(r?.roll ? `🎲 d${r.die} = ${r.roll}${r.level === 1 ? ` · al livello 1 si aggiunge il dado pieno (${r.die})` : ""} · PF aggiornati!` : "");
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
        <p className="sgh-title"><SgIcon kind="cls" of={cls} fallback={info?.icon} color="var(--cls)" /> Crea il tuo {info?.it}</p>
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
        <p className="sgh-sub">❤ Punti ferita del {info?.it}: <b>{HERO_HP_BASE} di base</b> + dado vita della classe <b>d{kit.hitDie}</b> pieno + un tiro di <b>d{kit.hitDie}</b> (lo fai subito dopo) + COS. A ogni livello un altro tiro di d{kit.hitDie} + COS.</p>
        <p className="sgh-sub">🗡 Scegli la tua arma (serve anche contro chi resiste alla tua magia):</p>
        <WeaponPicker cls={cls} value={weapon} onPick={setWeapon} />
        <p className="sgh-sub">🛡 Scegli l'armatura (quelle che la classe sa portare; le migliori si trovano o si comprano):</p>
        <ArmorPicker cls={cls} st={stats} weapon={weapon || weaponChoices(cls)[0].key} value={armor || armorProf(cls).def} shield={shield}
          onPick={(a, sh) => { setArmor(a); setShield(sh); }} />
        <p className="sgh-sub">Hai già: {kit.base.filter((a) => (a.min || 1) <= 1).map((a, i) => <span key={a.id}>{i ? " · " : ""}<SgIcon kind="action" of={a} color={sgTone(a)} /> {a.name}{a.cantrip && <em> · Trucchetto</em>}</span>)}</p>
        <p className="sgh-sub">Scegli la prima abilità o il primo incantesimo:</p>
        <div className="sgh-picks">
          {starters.map((a) => (
            <button key={a.id} type="button" aria-pressed={pick === a.id} className={`sgh-pick${pick === a.id ? " is-on" : ""}`} onClick={() => setPick(a.id)}>
              <ActChip a={a} lv={1} />
            </button>
          ))}
        </div>
        {err && <p className="sgr-err">{err}</p>}
        <button type="button" className="sgr-cta" disabled={busy || left < 0 || !pick || !weapon}
          onClick={() => send({ op: "heroCreate", cls, stats, pick, weapon, armor: armor || armorProf(cls).def, shield })}>{busy ? "Creo…" : `Crea l'eroe ${info?.it || ""}`}</button>
      </div>
    );
  }

  const pend = heroPending(hero);
  const hpLeft = hpPending(hero);
  const lv = pend.level;
  const st = heroStats(hero);
  const curXp = heroXp(hero);
  const from = xpForLevel(lv);
  const to = lv >= MAX_STORY_LEVEL ? from : xpForLevel(lv + 1);
  const equippedWeapon = itemOf(hero.weaponItem);
  const wItem = equippedWeapon && weaponChoices(cls).some((w) => w.key === equippedWeapon.base) ? equippedWeapon : null;
  const subc = heroSubclass(cls, hero);
  const sp = subc?.passive || {};
  const acts = heroActions(cls, lv, hero.picks || [], wItem?.base || hero.weapon, wItem?.plus || 0, wItem, false, subc?.key).filter((a) => a.kind !== "defend");
  const gear = heroGear(hero, cls);
  const def = heroDefense(cls, st, gear);
  const options = poolFor(cls, lv).filter((a) => !(hero.picks || []).includes(a.id));
  const locked = [...kit.base, ...kit.pool].filter((a) => (a.min || 1) > lv);
  const nextMilestone = Math.min(MAX_STORY_LEVEL, (Math.floor(lv / ASI_EVERY) + 1) * ASI_EVERY);

  return (
    <div className="sgh">
      <div className="sgh-head">
        <SgIcon kind="cls" of={cls} fallback={info?.icon} frame size="lg" color="var(--cls)" className="sgh-ico" />
        <div>
          <p className="sgh-title"><SegreteIdentity cls={cls} hero={hero} /> · Livello {lv}</p>
          <small>{heroMaxHp(cls, lv, st, hero.hpRolls || []) + def.hpBonus + (sp.hpLv || 0) * lv} PF · CA {def.ac + (sp.ac || 0)} · {lv >= MAX_STORY_LEVEL ? "livello massimo" : `${curXp.toLocaleString("it-IT")} / ${to.toLocaleString("it-IT")} PE · ~${Math.max(1, Math.ceil((to - curXp) / (XP_PER_ROOM * 4)))} vittorie al Lv ${lv + 1}`}</small>
        </div>
      </div>
      <SegreteXp hero={hero} />
      <div className="sgh-statline">
        {STAT_KEYS.map((k) => <span key={k} className={kit.rec.includes(k) ? "is-rec" : ""}><b>{STAT_LABEL[k]}</b> {st[k] >= 0 ? "+" : ""}{st[k]}</span>)}
      </div>
      <SegreteGear cls={cls} hero={hero} st={st} charData={charData} busy={busy} send={send} />

      {hpLeft > 0 && (
        <div className="sgh-pending sgh-hp">
          <p>❤ {(hero.hpRolls || []).length ? `Hai ${hpLeft} ${hpLeft === 1 ? "tiro" : "tiri"} dei PF da fare (livelli nuovi)` : "Tira i tuoi punti ferita"}: dado vita del {info?.it} <b>d{kit.hitDie}</b> + COS (più {HERO_HP_BASE} PF di base). Finché non tiri non puoi partire.</p>
          <button type="button" className="sgr-cta" disabled={busy} onClick={rollHp}>🎲 Tira i PF (d{kit.hitDie})</button>
        </div>
      )}
      {hpMsg && <p className="sgh-hpmsg">{hpMsg}</p>}
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
                <ActChip a={a} lv={lv} />
              </button>
            ))}
            {!options.length && <small>Hai già tutto quello che c'è al tuo livello: torna più avanti.</small>}
          </div>
        </div>
      )}
      {err && <p className="sgr-err">{err}</p>}

      <details className="sgh-fold">
        <summary>⚔ Le tue azioni <small>({acts.length})</small></summary>
        <div className="sgh-acts">{acts.map((a) => <ActChip key={a.id} a={a} lv={lv} />)}</div>
      </details>
      <details className="sgh-fold">
        <summary>🎓 Sottoclasse <small>({subc ? subc.name : lv >= SUBCLASS_LEVEL ? "da scegliere" : `dal Lv ${SUBCLASS_LEVEL}`})</small></summary>
        <SubclassBox cls={cls} hero={hero} lv={lv} charData={charData} busy={busy} send={send} />
      </details>
      <details className="sgh-fold" open={Number(charData?.storyRespecFree) > 0 || undefined}>
        <summary>♻ Reset dell'eroe <small>({Number(charData?.storyRespecFree) > 0 ? "gratuito" : `${RESPEC_COST} monete`})</small></summary>
        <SegreteRespec key={`${cls}-${hero.respecs || 0}`} cls={cls} hero={hero} charData={charData} busy={busy} send={send} />
      </details>
      {lv < MAX_STORY_LEVEL && (
        <details className="sgh-fold">
          <summary>🔒 Prossimi livelli <small>(al Lv {nextMilestone}: +1 caratteristica e una scelta)</small></summary>
          {locked.length ? <div className="sgh-acts">{locked.map((a) => <span key={a.id} className="sgh-locked"><SgIcon kind="action" of={a} color={sgTone(a)} /> {a.name} <small>Lv {a.min}</small></span>)}</div> : <p className="sgh-hint">Niente di nuovo da sbloccare: solo scelte fra quelle che già vedi.</p>}
        </details>
      )}
    </div>
  );
}
