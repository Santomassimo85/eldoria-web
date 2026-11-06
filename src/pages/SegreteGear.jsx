/* LE SEGRETE · equipaggiamento dell'eroe (2026-11-06, rifatto: prima era sepolto in fondo alla
   scheda). Tre slot ben visibili: Arma · Armatura · Scudo. Tocco su uno slot = si aprono sotto
   le scelte, ognuna con la CA (o i danni) che avresti e la differenza rispetto ad adesso.
   Se l'armatura non è ancora scelta (o non è adatta alla classe) c'è un avviso e lo slot è aperto.
   Tutto passa dal server (segreteDo: heroWeapon, heroArmor, heroEquip). */
import { useState } from "react";
import GameIcon from "../components/GameIcon";
import { sgIconName } from "../data/segreteIcons";
import { classInfo } from "../data/segrete";
import { bagOf, itemOf, heroGear, RARITY } from "../data/segreteItems";
import {
  weaponChoices, heroDefense, armorChoices, armorProf, armorChosen, ARMORS, ARMOR_CAT_IT, TWO_HANDED, fxLine, DMG_ALL, DMG_SHORT, WSTAT_LABEL, canWear,
} from "../data/segreteKits";

const sign = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "=");

function Opt({ on, icon, gi, name, sub, tag, delta, onClick, disabled, rarity }) {
  return (
    <button type="button" className={`sgg-opt${on ? " is-on" : ""}`} aria-pressed={on} disabled={disabled || on} onClick={onClick}>
      <GameIcon name={gi} fallback={icon} frame size="md" className={`sgg-opt-ico${rarity ? ` gi-r-${rarity}` : ""}`} />
      <span className="sgg-opt-main">
        <b style={rarity ? { "--rc": RARITY[rarity]?.color } : undefined}>{name}</b>
        <small>{sub}</small>
      </span>
      {tag != null && <span className="sgg-opt-tag">{tag}{delta != null && delta !== 0 ? <em className={delta > 0 ? "up" : "down"}> {sign(delta)}</em> : null}</span>}
      {on && <span className="sgg-opt-on">✓ in uso</span>}
    </button>
  );
}

export default function SegreteGear({ cls, hero, st, charData, busy, send }) {
  const info = classInfo(cls);
  const bag = bagOf(charData);
  const gear = heroGear(hero, cls);
  const def = heroDefense(cls, st, gear);
  const prof = armorProf(cls);
  const chosen = armorChosen(cls, hero);
  const [open, setOpen] = useState(chosen ? null : "armor");
  const toggle = (k) => setOpen((o) => (o === k ? null : k));

  const wItem = itemOf(hero.weaponItem);
  const aItem = itemOf(hero.armorItem);
  const sItem = itemOf(hero.shieldItem);
  const bases = weaponChoices(cls);
  const w = bases.find((x) => x.key === gear.weapon) || bases[0];
  const twoH = TWO_HANDED.has(gear.weapon);
  const bagW = Object.keys(bag).map(itemOf).filter((it) => it?.kind === "weapon" && bases.some((b) => b.key === it.base) && it.id !== hero.weaponItem);
  const bagA = Object.keys(bag).map(itemOf).filter((it) => it?.kind === "armor" && canWear(cls, it.base) && it.id !== hero.armorItem);
  const bagS = prof.shield ? Object.keys(bag).map(itemOf).filter((it) => it?.kind === "shield" && it.id !== hero.shieldItem) : [];
  const acWith = (g) => heroDefense(cls, st, { ...gear, ...g }).ac;
  const armorKey = aItem ? null : def.key;
  const shieldOn = def.shield;

  const slots = [
    { k: "weapon", label: "Arma", gi: sgIconName("item", wItem) || sgIconName("weapon", w.key), rarity: wItem?.rarity, icon: wItem?.icon || w.icon, name: wItem ? wItem.name : w.name,
      sub: `${w.dice}${wItem?.plus ? ` +${wItem.plus}` : ""} ${DMG_SHORT[w.dmg] || ""}${wItem?.fx ? ` · ${fxLine(wItem.fx)}` : ""}`, n: bagW.length },
    { k: "armor", label: "Armatura", gi: sgIconName("item", aItem) || sgIconName("armor", def.key), rarity: aItem?.rarity, icon: def.armorIcon, name: def.armorName, sub: `CA ${def.ac}${def.res.length ? ` · resiste a ${def.res.map((r) => DMG_ALL[r]).join(", ")}` : ""}${def.saveBonus ? ` · +${def.saveBonus} TS` : ""}${def.perk ? ` · ✦ ${def.perk.text}` : ""}`, n: bagA.length, warn: !chosen },
    ...(prof.shield ? [{ k: "shield", label: "Scudo", gi: shieldOn ? sgIconName("item", sItem) || sgIconName("armor", "scudo") : null, rarity: sItem?.rarity, icon: shieldOn ? sItem?.icon || "🛡" : "—", name: shieldOn ? def.shieldName : twoH ? "arma a due mani" : "nessuno",
      sub: shieldOn ? `+${2 + (sItem?.plus || 0)} CA` : twoH ? "con un'arma a due mani niente scudo" : "+2 CA se lo imbracci", n: bagS.length }] : []),
  ];

  return (
    <section className="sgg" id={`sgh-gear-${cls}`}>
      <p className="sgg-title">🎒 Equipaggiamento <span>CA <b>{def.ac}</b></span></p>
      {!chosen && (
        <p className="sgg-alert" role="alert">
          ⚠ {hero.armor ? `${ARMORS[hero.armor]?.name || "L'armatura scelta"} non è adatta a un ${info?.it}` : `Il tuo ${info?.it} non ha ancora scelto l'armatura`}: per ora usa {def.armorName} (CA {def.ac}). Sceglila qui sotto.
        </p>
      )}
      <div className="sgg-slots">
        {slots.map((s) => (
          <button key={s.k} type="button" className={`sgg-slot${open === s.k ? " is-open" : ""}${s.warn ? " is-warn" : ""}`} aria-expanded={open === s.k} onClick={() => toggle(s.k)}>
            <small>{s.label}{s.n ? <em className="sgg-new">{s.n} nello zaino</em> : null}</small>
            <GameIcon name={s.gi} fallback={s.icon} frame size="lg" className={`sgg-slot-ico${s.rarity ? ` gi-r-${s.rarity}` : ""}`} />
            <b>{s.name}</b>
            <span className="sgg-slot-sub">{s.sub}</span>
            <span className="sgg-slot-cta">{open === s.k ? "▲ chiudi" : "Cambia ▾"}</span>
          </button>
        ))}
      </div>

      {open === "weapon" && (
        <div className="sgg-opts">
          <p className="sgg-h">Armi della classe <small>(gratis, cambi quando vuoi fuori dai dungeon)</small></p>
          {bases.map((b) => (
            <Opt key={b.key} on={!wItem && b.key === gear.weapon} icon={b.icon} gi={sgIconName("weapon", b.key)} name={b.name} disabled={busy}
              sub={`${b.dice} ${DMG_SHORT[b.dmg]} · usa ${WSTAT_LABEL[b.wstat]}${TWO_HANDED.has(b.key) ? " · a due mani (niente scudo)" : ""}${b.ranged ? " · a distanza" : ""}`}
              onClick={() => send({ op: "heroWeapon", cls, weapon: b.key })} />
          ))}
          {(bagW.length > 0 || wItem) && <p className="sgg-h">Dallo zaino</p>}
          {wItem && <Opt on icon={wItem.icon} gi={sgIconName("item", wItem)} name={wItem.name} rarity={wItem.rarity} sub={wItem.fx ? fxLine(wItem.fx) : `+${wItem.plus} a colpire e ai danni`} />}
          {bagW.map((it) => (
            <Opt key={it.id} icon={it.icon} gi={sgIconName("item", it)} name={`${it.name} ×${bag[it.id]}`} rarity={it.rarity} disabled={busy}
              sub={it.fx ? fxLine(it.fx) : `+${it.plus} a colpire e ai danni`} onClick={() => send({ op: "heroEquip", cls, slot: "weapon", itemId: it.id })} />
          ))}
          {wItem && <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => send({ op: "heroEquip", cls, slot: "weapon", itemId: null })}>↩ Rimetti {wItem.name} nello zaino</button>}
        </div>
      )}

      {open === "armor" && (
        <div className="sgg-opts">
          <p className="sgg-h">Armature che un {info?.it} sa portare <small>({prof.cats.map((c) => ARMOR_CAT_IT[c]).join(", ")}{(prof.no || []).length ? ", niente metallo" : ""}; gratis)</small></p>
          {armorChoices(cls).map((k) => {
            const a = ARMORS[k];
            const ac = acWith({ armor: k, armorItem: null });
            return (
              <Opt key={k} on={chosen && armorKey === k} icon={a.icon} gi={sgIconName("armor", k)} name={a.name} tag={`CA ${ac}`} delta={ac - def.ac} disabled={busy}
                sub={`${ARMOR_CAT_IT[a.cat]}${a.cat === "unarmored" ? ` · 10 + DES + ${cls === "monk" ? "SAG" : "COS"}` : a.base ? ` · ${a.base}${a.dex === 0 ? "" : a.dex < 9 ? " + DES (max +2)" : " + DES"}` : ""}${a.perk ? ` · ✦ ${a.perk.text}` : ""}`}
                onClick={() => send({ op: "heroArmor", cls, armor: k, shield: hero.shield !== false })} />
            );
          })}
          {(bagA.length > 0 || aItem) && <p className="sgg-h">Dallo zaino</p>}
          {aItem && <Opt on icon={aItem.icon} gi={sgIconName("item", aItem)} name={aItem.name} rarity={aItem.rarity} tag={`CA ${def.ac}`} sub={aItem.desc} />}
          {bagA.map((it) => {
            const ac = acWith({ armorItem: it });
            return <Opt key={it.id} icon={it.icon} gi={sgIconName("item", it)} name={`${it.name} ×${bag[it.id]}`} rarity={it.rarity} tag={`CA ${ac}`} delta={ac - def.ac} disabled={busy} sub={it.desc}
              onClick={() => send({ op: "heroEquip", cls, slot: "armor", itemId: it.id })} />;
          })}
          {!bagA.length && !aItem && <p className="sgg-note">Mezza Armatura, Stecche e Piastre si comprano in Bottega; quelle magiche si trovano nei dungeon (guarda "📜 Cosa c'è qui").</p>}
          {aItem && <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => send({ op: "heroEquip", cls, slot: "armor", itemId: null })}>↩ Rimetti {aItem.name} nello zaino</button>}
        </div>
      )}

      {open === "shield" && prof.shield && (
        <div className="sgg-opts">
          {twoH && <p className="sgg-note">⚠ Con {w.name} (a due mani) lo scudo non si può usare: cambia arma per imbracciarlo.</p>}
          <Opt on={!sItem && shieldOn} icon="🛡" gi={sgIconName("armor", "scudo")} name="Scudo" tag={`CA ${acWith({ shield: true, shieldItem: null })}`} delta={acWith({ shield: true, shieldItem: null }) - def.ac}
            sub="scudo di legno e ferro, +2 CA" disabled={busy || twoH} onClick={() => send({ op: "heroArmor", cls, shieldOnly: true, shield: true })} />
          <Opt on={!sItem && !shieldOn && !twoH} icon="✋" name="Senza scudo" tag={`CA ${acWith({ shield: false, shieldItem: null })}`} delta={acWith({ shield: false, shieldItem: null }) - def.ac}
            sub="mano libera" disabled={busy || twoH} onClick={() => send({ op: "heroArmor", cls, shieldOnly: true, shield: false })} />
          {sItem && <Opt on icon={sItem.icon} gi={sgIconName("item", sItem)} name={sItem.name} rarity={sItem.rarity} sub={sItem.desc} />}
          {bagS.map((it) => {
            const ac = acWith({ shieldItem: it });
            return <Opt key={it.id} icon={it.icon} gi={sgIconName("item", it)} name={`${it.name} ×${bag[it.id]}`} rarity={it.rarity} tag={`CA ${ac}`} delta={ac - def.ac} disabled={busy || twoH} sub={it.desc}
              onClick={() => send({ op: "heroEquip", cls, slot: "shield", itemId: it.id })} />;
          })}
          {sItem && <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => send({ op: "heroEquip", cls, slot: "shield", itemId: null })}>↩ Rimetti {sItem.name} nello zaino</button>}
        </div>
      )}
    </section>
  );
}
