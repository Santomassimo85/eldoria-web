/* LE SEGRETE · eroi di classe (2026-11-04, rifatto: progressione permanente)
   Ogni giocatore ha UN eroe per classe che cresce per sempre (non si azzera):
   characters.storyChars[classe] = { stats: {str..cha}, asi: {str..cha}, picks: [id], xp }.
   - Caratteristiche come nell'Arena: 10 punti da distribuire come modificatori (0..+3).
   - PE fissi per dungeon e tabella XP_TABLE (2026-11-06); il livello si ricava dai PE (heroXp).
   - Ogni 3 livelli (3, 6, 9…) +1 punto caratteristica (tetto +5) e una scelta in più.
   - Scelte (abilità/incantesimi): 1 alla creazione + 1 ogni 3 livelli, dall'elenco
     `pool` della classe (ognuna ha un livello minimo). Le `base` le ha sempre.
   Tipi di azione: weapon, spell (tiro per colpire), missile (colpisce sempre),
   save (TS; area = tutti i nemici), heal, heal_all, buff (ac/adv/dmg/rage, self o
   alleato o allParty), debuff (svantaggio a un nemico o a tutti). */

import { raceBonuses } from "./segreteRaces";

export const MAX_STORY_LEVEL = 20;
export const HERO_HP_MULT = 1.1;
// +10 PF fissi a ogni eroe (richiesta 2026-11-04), fuori dal moltiplicatore e dal budget dei mostri
export const HERO_HP_BASE = 10;
/* PE FISSI PER DUNGEON (2026-11-06, richiesta: "uguali per tutti, chi è più alto ci mette di più").
   Una vittoria vale XP_PER_ROOM a sala (boss compreso) × difficoltà, uguale per ogni livello:
   3 sale + boss = 100 PE, il Tempio (4 sale) 125. Il salto fra un livello e l'altro cresce piano:
   ~3 vittorie per il Lv 2, ~6 al Lv 10, ~9 per l'ultimo (XP_GAP). Prima (D&D) ogni vittoria dava
   una fetta del salto: un eroe alto prendeva molti più PE di uno basso nello stesso dungeon. */
export const XP_PER_ROOM = 25;
export const XP_GAP = (lv) => Math.round((300 + 35 * (lv - 1)) / 10) * 10;
export const XP_TABLE = [0];
for (let lv = 1; lv < 20; lv++) XP_TABLE.push(XP_TABLE[lv - 1] + XP_GAP(lv));
// tabella D&D di prima: serve solo a convertire gli eroi creati prima (hero.xpv !== 2)
const XP_TABLE_OLD = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export const XP_VERSION = 2;
/* PE dell'eroe sulla scala nuova: gli eroi vecchi (senza xpv 2) tengono livello e % del livello.
   Il server alla prossima vittoria riscrive i PE convertiti con xpv 2. */
export function heroXp(hero) {
  const xp = Number(hero?.xp) || 0;
  if (!hero || hero.xpv === XP_VERSION) return xp;
  let lv = 1;
  for (let i = 1; i < XP_TABLE_OLD.length; i++) if (xp >= XP_TABLE_OLD[i]) lv = i + 1;
  if (lv >= 20) return XP_TABLE[19];
  const frac = (xp - XP_TABLE_OLD[lv - 1]) / (XP_TABLE_OLD[lv] - XP_TABLE_OLD[lv - 1]);
  return Math.floor(XP_TABLE[lv - 1] + frac * (XP_TABLE[lv] - XP_TABLE[lv - 1]));
}
export const heroLevel = (hero) => levelOfXp(heroXp(hero));
export const STAT_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
export const STAT_LABEL = { str: "FOR", dex: "DES", con: "COS", int: "INT", wis: "SAG", cha: "CAR" };
export const STAT_BUDGET = 10;
export const STAT_CAP = 3;       // alla creazione
export const STAT_MAX = 5;       // con i punti dei livelli
export const ASI_EVERY = 3;

export const profOf = (lv) => 2 + Math.floor((Math.max(1, lv) - 1) / 4);
export const cantripMult = (lv) => 1 + (lv >= 5) + (lv >= 11) + (lv >= 17);
export function levelOfXp(xp) {
  let lv = 1;
  for (let i = 1; i < XP_TABLE.length; i++) if ((Number(xp) || 0) >= XP_TABLE[i]) lv = i + 1;
  return Math.min(MAX_STORY_LEVEL, lv);
}
export const xpForLevel = (lv) => XP_TABLE[Math.max(0, Math.min(MAX_STORY_LEVEL, lv) - 1)];
export const asiEarned = (lv) => Math.floor(lv / ASI_EVERY);
export const picksAllowed = (lv) => 1 + Math.floor(lv / ASI_EVERY);

/* ARMI (2026-11-04): ogni eroe ha un'arma, scelta alla creazione fra DUE del manuale D&D
   (danni simili, tipo di danno diverso: così contro un nemico immune ha un'altra strada).
   wstat = caratteristica dell'arma: str · dex · fin (accurata/il Monaco: la migliore fra FOR e DES).
   Le abilità con `useWeapon` (Attacco Poderoso, Punizione, Furtivo…) prendono dadi e tipo dall'arma. */
export const WEAPONS = {
  spada_lunga: { name: "Spada Lunga", icon: "⚔", dice: "1d8", dmg: "slashing", wstat: "str" },
  martello: { name: "Martello da Guerra", icon: "🔨", dice: "1d8", dmg: "bludgeoning", wstat: "str" },
  ascia_bip: { name: "Ascia Bipenne", icon: "🪓", dice: "1d12", dmg: "slashing", wstat: "str" },
  maglio: { name: "Maglio", icon: "🔨", dice: "2d6", dmg: "bludgeoning", wstat: "str" },
  mazzafrusto: { name: "Mazzafrusto", icon: "⛓", dice: "1d8", dmg: "bludgeoning", wstat: "str" },
  arco_lungo: { name: "Arco Lungo", icon: "🏹", dice: "1d8", dmg: "piercing", wstat: "dex", ranged: true },
  scimitarra: { name: "Scimitarra", icon: "🗡", dice: "1d6", dmg: "slashing", wstat: "fin" },
  pugnali: { name: "Due Pugnali", icon: "🗡", dice: "1d4", dmg: "piercing", wstat: "fin", attacks: 2 },
  stocco: { name: "Stocco", icon: "🗡", dice: "1d8", dmg: "piercing", wstat: "fin" },
  bastone: { name: "Bastone Ferrato", icon: "🦯", dice: "1d6", dmg: "bludgeoning", wstat: "str" },
  lancia: { name: "Lancia", icon: "🔱", dice: "1d6", dmg: "piercing", wstat: "str" },
  balestra_l: { name: "Balestra Leggera", icon: "🏹", dice: "1d8", dmg: "piercing", wstat: "dex", ranged: true },
  mazza: { name: "Mazza", icon: "🔨", dice: "1d6", dmg: "bludgeoning", wstat: "str" },
  pugni: { name: "Pugni", icon: "👊", dice: "1d6", dmg: "bludgeoning", wstat: "fin", vfx: "punch" },
};
export const WEAPON_CHOICES = {
  fighter: ["spada_lunga", "martello"],
  barbarian: ["ascia_bip", "maglio"],
  paladin: ["spada_lunga", "mazzafrusto"],
  ranger: ["arco_lungo", "scimitarra"],
  monk: ["pugni", "bastone", "lancia"],
  rogue: ["stocco", "pugnali"],
  wizard: ["bastone", "balestra_l"],
  sorcerer: ["bastone", "balestra_l"],
  warlock: ["mazza", "lancia"],
  druid: ["scimitarra", "bastone"],
  cleric: ["mazza", "lancia"],
  bard: ["stocco", "spada_lunga"],
};
export const DMG_SHORT = { slashing: "tagliente", piercing: "perforante", bludgeoning: "contundente" };
export const WSTAT_LABEL = { str: "FOR", dex: "DES", fin: "FOR o DES" };
export const weaponChoices = (cls) => (WEAPON_CHOICES[cls] || WEAPON_CHOICES.fighter).map((k) => ({ key: k, ...WEAPONS[k], wstat: cls === "monk" ? "fin" : WEAPONS[k].wstat }));
// arma dell'eroe: quella scelta, altrimenti la prima della classe (eroi creati prima delle armi)
export function weaponOf(cls, key) {
  const list = weaponChoices(cls);
  return list.find((w) => w.key === (cls === "rogue" && key === "scimitarra" ? "pugnali" : key)) || list[0];
}
// plus = arma magica equipaggiata (+1/+2 a colpire e ai danni, vedi segreteItems.js)
// wItem = oggetto arma equipaggiato (nome proprio ed effetti al colpo `fx`, 2026-11-06)
export const weaponAction = (w, plus = 0, wItem = null) => ({ id: "arma", name: wItem?.name || (plus ? `${w.name} +${plus}` : w.name), icon: wItem?.icon || w.icon, kind: "weapon", dice: w.dice, dmg: w.dmg, wstat: w.wstat, ranged: !!w.ranged, weaponKey: w.key, ...(w.attacks ? { attacks: w.attacks } : {}), plus: plus || 0, ...(w.vfx ? { vfx: w.vfx } : {}), ...(wItem?.fx ? { wfx: wItem.fx } : {}), info: `${w.attacks ? `${w.attacks} attacchi da ` : ""}${w.dice}${plus ? `+${plus}` : ""} ${DMG_SHORT[w.dmg] || ""} · ${WSTAT_LABEL[w.wstat]}${wItem?.fx ? ` · ${fxLine(wItem.fx)}` : ""}` });
// testo breve degli effetti al colpo di un'arma speciale
export function fxLine(fx = {}) {
  const out = [];
  if (fx.extra) out.push(`+${fx.extra[0]} ${DMG_ALL[fx.extra[1]] || ""}`);
  if (fx.burn) out.push(`${fx.burn.chance}% 🔥 ${fx.burn.dice}/turno`);
  if (fx.poison) out.push(`${fx.poison.chance}% ☠ ${fx.poison.dice}/turno`);
  if (fx.slow) out.push(`${fx.slow.chance}% 🐌`);
  if (fx.stun) out.push(`${fx.stun.chance}% 💫`);
  if (fx.drain) out.push(`il danno extra ti cura del ${fx.drain}%`);
  if (fx.crit) out.push(`critico con ${fx.crit}–20`);
  if (fx.multi) out.push(`${fx.multi.double}% un colpo in più, ${fx.multi.none}% nessuno`);
  return out.join(" · ");
}
export const DMG_ALL = { slashing: "tagliente", piercing: "perforante", bludgeoning: "contundente", fire: "fuoco", cold: "freddo", lightning: "fulmine", thunder: "tuono", acid: "acido", poison: "veleno", necrotic: "necrotico", radiant: "radioso", force: "forza", psychic: "psichico" };

/* ARMATURE (2026-11-06) come in D&D. cat: none (abiti) · mage (Armatura Magica, Mago e
   Stregone) · unarmored (Difesa senz'armatura di Barbaro e Monaco) · light · medium · heavy.
   CA = base + DES (medie: DES massimo +2; pesanti: niente DES). Scudo +2 se la classe lo sa
   usare e l'arma non è a due mani. `start` = si sceglie gratis; le altre (Mezza armatura,
   Stecche, Piastre) sono oggetti da comprare in Bottega o da trovare nei dungeon. */
/* VANTAGGI DELLE ARMATURE PIÙ LEGGERE (2026-11-06): fra quelle che una classe può scegliere
   gratis, chi prende la CA più bassa riceve un piccolo vantaggio (`perk`), così non è mai una
   scelta inutile. hit = +N a tutti i tiri per colpire · dc = +N alla CD dei suoi incantesimi e
   abilità · save = +N ai TS · hp = +N PF massimi. Vale anche per le versioni +1 dello zaino. */
export const ARMORS = {
  abiti: { name: "Abiti da viaggio", icon: "👕", cat: "none", base: 10, dex: 99, start: true, perk: { hit: 1, dc: 1, save: 1, text: "nessun ingombro: +1 a colpire, +1 CD, +1 ai TS" } },
  magica: { name: "Armatura Magica", icon: "✨", cat: "mage", base: 13, dex: 99, start: true },
  senza: { name: "Difesa senz'armatura", icon: "💪", cat: "unarmored", start: true },
  cuoio: { name: "Armatura di Cuoio", icon: "🧥", cat: "light", base: 11, dex: 99, start: true, perk: { hit: 1, text: "morbida e silenziosa: +1 a colpire" } },
  borchiato: { name: "Cuoio Borchiato", icon: "🦺", cat: "light", base: 12, dex: 99, start: true },
  pelle: { name: "Armatura di Pelle", icon: "🐻", cat: "medium", base: 12, dex: 2, start: true, perk: { save: 1, hp: 4, text: "pelliccia spessa: +4 PF e +1 ai TS" } },
  giaco: { name: "Giaco di Maglia", icon: "⛓", cat: "medium", base: 13, dex: 2, start: true, perk: { hit: 1, text: "non intralcia i movimenti: +1 a colpire" } },
  scaglie: { name: "Corazza di Scaglie", icon: "🐉", cat: "medium", base: 14, dex: 2, start: true },
  mezza: { name: "Mezza Armatura", icon: "🛡", cat: "medium", base: 15, dex: 2 },
  anelli: { name: "Cotta ad Anelli", icon: "⛓", cat: "heavy", base: 14, dex: 0, start: true, perk: { save: 1, hp: 4, text: "anelli larghi, si respira: +4 PF e +1 ai TS" } },
  maglia: { name: "Cotta di Maglia", icon: "⛓", cat: "heavy", base: 16, dex: 0, start: true },
  stecche: { name: "Armatura a Stecche", icon: "🛡", cat: "heavy", base: 17, dex: 0 },
  piastre: { start: true, name: "Armatura Completa di Piastre", icon: "🏰", cat: "heavy", base: 18, dex: 0 },
};
export const HEAVY_ARMOR_TEXT = "ingombro per tiro: 50% normale, 25% -1 a colpire, 25% svantaggio";
export const ARMOR_CAT_IT = { none: "abiti", mage: "magia", unarmored: "senz'armatura", light: "leggera", medium: "media", heavy: "pesante" };
// competenze del manuale D&D (2026-11-06, ricontrollate): il Chierico base NON porta le pesanti,
// il Druido non porta armature di metallo (`no`: Giaco di Maglia, Scaglie, Mezza Armatura)
export const ARMOR_PROF = {
  fighter: { cats: ["light", "medium", "heavy"], shield: true, def: "maglia" },
  paladin: { cats: ["light", "medium", "heavy"], shield: true, def: "maglia" },
  cleric: { cats: ["light", "medium"], shield: true, def: "scaglie" },
  barbarian: { cats: ["unarmored", "light", "medium"], shield: true, def: "senza" },
  ranger: { cats: ["light", "medium"], shield: true, def: "borchiato" },
  druid: { cats: ["light", "medium"], shield: true, def: "pelle", no: ["giaco", "scaglie", "mezza"] },
  monk: { cats: ["unarmored"], shield: false, def: "senza" },
  rogue: { cats: ["light"], shield: false, def: "borchiato" },
  bard: { cats: ["light"], shield: false, def: "borchiato" },
  warlock: { cats: ["light"], shield: false, def: "borchiato" },
  wizard: { cats: ["none", "mage"], shield: false, def: "magica" },
  sorcerer: { cats: ["none", "mage"], shield: false, def: "magica" },
};
export const TWO_HANDED = new Set(["ascia_bip", "maglio", "arco_lungo", "balestra_l"]);
export const armorProf = (cls) => ARMOR_PROF[cls] || ARMOR_PROF.fighter;
export const canWear = (cls, key) => !!ARMORS[key] && armorProf(cls).cats.includes(ARMORS[key].cat) && !(armorProf(cls).no || []).includes(key);
// l'eroe ha scelto un'armatura (o ne indossa una dallo zaino)? Se no, usa quella di partenza e va avvisato
export const armorChosen = (cls, hero) => !!hero?.armorItem || (!!hero?.armor && canWear(cls, hero.armor) && !!ARMORS[hero.armor]?.start);
export const armorChoices = (cls) => Object.keys(ARMORS).filter((k) => ARMORS[k].start && canWear(cls, k));
export const shieldOk = (cls, weaponKey) => armorProf(cls).shield && !TWO_HANDED.has(weaponKey);
/* Difesa dell'eroe. g = { armor, shield, weapon, armorItem, shieldItem } con gli OGGETTI già
   risolti (itemOf: qui non si importa segreteItems per non fare un ciclo). */
export function heroDefense(cls, st, g = {}) {
  const dex = st.dex || 0;
  const ai = g.armorItem && g.armorItem.kind === "armor" && canWear(cls, g.armorItem.base) ? g.armorItem : null;
  let key = ai ? ai.base : g.armor;
  if (!ai && !(canWear(cls, key) && ARMORS[key].start)) key = armorProf(cls).def;
  const ar = ARMORS[key];
  let ac;
  if (ar.cat === "unarmored") ac = 10 + dex + (st[kitOf(cls).unarmored] || 0) + (ai?.plus || 0);
  else ac = ar.base + (ar.dex === 0 ? 0 : Math.min(dex, ar.dex)) + (ai?.plus || 0);
  const si = g.shieldItem && g.shieldItem.kind === "shield" ? g.shieldItem : null;
  const canShield = shieldOk(cls, g.weapon);
  const shield = canShield && (!!si || g.shield !== false);
  if (shield) ac += 2 + (si?.plus || 0);
  const parts = [ai, shield ? si : null].filter(Boolean);
  const perk = ar.perk || {};
  return {
    ac, key, cat: ar.cat, ...(ar.cat === "heavy" ? { attackPenalty: HEAVY_ARMOR_TEXT } : {}), shield, canShield, perk: ar.perk || null,
    hitBonus: perk.hit || 0, dcBonus: perk.dc || 0, hpBonus: perk.hp || 0,
    armorName: ai ? ai.name : ar.name, armorIcon: ai ? ai.icon : ar.icon,
    shieldName: shield ? (si ? si.name : "Scudo") : "",
    res: [...new Set(parts.flatMap((p) => p.res || []))],
    saveBonus: parts.reduce((t, p) => t + (p.saveBonus || 0), 0) + (perk.save || 0),
    thorns: parts.find((p) => p.thorns)?.thorns || null,
  };
}
// modificatore di un'azione d'arma (colpire e danni)
export function weaponMod(cls, st, a) {
  if (!a?.wstat) return mainMod(cls, st);
  if (a.wstat === "fin") return Math.max(st.str || 0, st.dex || 0);
  return st[a.wstat] || 0;
}

/* armor: "heavy" = CA fissa · "light" = CA − 3 + DES · "unarmored" = 10 + DES + (COS|SAG) */
export const KITS = {
  fighter: { hitDie: 10, ac: 17, armor: "heavy", stat: "str", rec: ["str", "con"], extraAttacks: true,
    base: [{ id: "respiro", name: "Secondo Respiro", icon: "❤", kind: "heal", dice: "1d10", plusLevel: true, self: true, uses: 1 }, { id: "taunt", name: "Provocazione", icon: "📣", kind: "taunt", save: "wis", turns: 2, uses: 2, info: "Provoca tutti · 2 turni · TS SAG" }],
    pool: [
      { id: "poderoso", useWeapon: true, name: "Attacco Poderoso", icon: "💥", kind: "weapon", dice: "1d8", dmg: "slashing", bonusDmg: "lv/2", min: 1, uses: 2, info: "+metà livello ai danni" },
      { id: "parata", name: "Muro di Scudi", icon: "🛡", kind: "buff", buff: "ac", value: 3, turns: 2, self: true, min: 1, uses: 1 },
      { id: "impeto", useWeapon: true, name: "Impeto d'Azione", icon: "⚡", kind: "weapon", dice: "1d8", dmg: "slashing", bonusAttacks: 1, min: 3, uses: 1, info: "un attacco in più" },
      { id: "stordire", useWeapon: true, name: "Colpo Stordente", icon: "💫", kind: "weapon", dice: "1d8", dmg: "bludgeoning", stunSave: "con", min: 6, uses: 2, info: "colpito: TS COS o stordito" },
      { id: "turbine", name: "Turbine d'Acciaio", icon: "🌪", kind: "save", dice: "3d8", dmg: "slashing", save: "dex", area: true, half: true, min: 9, uses: 1, grow: true },
      { id: "grido", name: "Grido di Battaglia", icon: "📯", kind: "buff", buff: "adv", turns: 2, allParty: true, min: 12, uses: 1 },
    ] },
  barbarian: { hitDie: 12, ac: 15, armor: "unarmored", unarmored: "con", stat: "str", rec: ["str", "con"], extraAttacks: true,
    base: [{ id: "furia", name: "Furia", icon: "💢", kind: "buff", buff: "rage", value: 2, turns: 3, self: true, uses: 1, info: "+2 danni, dimezza i danni fisici" }],
    pool: [
      { id: "irruento", useWeapon: true, name: "Attacco Irruento", icon: "😤", kind: "weapon", dice: "1d12", dmg: "slashing", adv: true, selfDis: true, min: 1, uses: 3, info: "vantaggio per 2 turni, ma −2 CA per 2 turni" },
      { id: "lancio", name: "Ascia Lanciata", icon: "🎯", kind: "weapon", dice: "1d10", dmg: "slashing", min: 1 },
      { id: "ruggito", name: "Ruggito Feroce", icon: "🦁", kind: "debuff", area: true, turns: 1, min: 3, uses: 1, info: "tutti i nemici a svantaggio" },
      { id: "brutale", useWeapon: true, name: "Colpo Brutale", icon: "🔨", kind: "weapon", dice: "1d12", dmg: "slashing", rider: "1d12", riderDmg: "bludgeoning", min: 6, uses: 2, grow: true },
      { id: "inarrestabile", name: "Furia Inarrestabile", icon: "❤", kind: "heal", dice: "2d12", plusMod: true, self: true, min: 9, uses: 1 },
      { id: "terremoto", name: "Pestone Sismico", icon: "🌋", kind: "save", dice: "3d8", dmg: "bludgeoning", save: "str", area: true, half: true, min: 12, uses: 1, grow: true },
    ] },
  paladin: { hitDie: 10, ac: 18, armor: "heavy", stat: "str", rec: ["str", "cha"], extraAttacks: true, healStat: "cha",
    base: [{ id: "mani", name: "Imposizione delle Mani", icon: "🙌", kind: "heal", healPool: true, info: "Cura a scelta · te o un alleato" },
      { id: "benedizione", name: "Benedizione", icon: "✨", kind: "buff", buff: "adv", turns: 2, allParty: true, min: 3, uses: 1, info: "vantaggio a tutto il party per 2 turni" },
      { id: "abiurazione", name: "Abiurazione", icon: "☀", kind: "debuff", area: true, save: "wis", dcStat: "cha", turns: 3, inflict: { key: "frightened" }, min: 3, uses: 1, info: "Paura a tutti · 3 turni · TS SAG" }],
    pool: [
      { id: "punizione", useWeapon: true, name: "Punizione Divina", icon: "⚡", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "2d8", riderDmg: "radiant", min: 1, uses: 2, riderGrow: true, info: "danno normale dell'arma + danno radioso" },
      { id: "benedizione", name: "Benedizione", icon: "✨", kind: "buff", buff: "adv", turns: 2, allParty: true, min: 1, uses: 1 },
      { id: "cura_p", name: "Cura Ferite", icon: "💚", kind: "heal", dice: "1d8", plusMod: 2, min: 3, uses: 2, info: "Cura 1d8 + 2×CAR" },
      { id: "aura", name: "Aura di Protezione", icon: "🌟", kind: "buff", buff: "ac", value: 2, turns: 3, allParty: true, min: 6, uses: 1 },
      { id: "accecante", useWeapon: true, name: "Punizione Accecante", icon: "☀", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "3d8", riderDmg: "radiant", riderDis: 2, min: 9, uses: 1, info: "e il nemico a svantaggio" },
      { id: "sacra", name: "Arma Sacra", icon: "🗡", kind: "buff", buff: "dmg", value: 5, turns: 3, self: true, min: 12, uses: 1 },
    ] },
  ranger: { hitDie: 10, ac: 15, armor: "light", stat: "dex", rec: ["dex", "wis"], extraAttacks: true, healStat: "wis",
    base: [{ id: "marchio", name: "Marchio del Cacciatore", icon: "🎯", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, uses: 2 }],
    pool: [
      { id: "doppio", useWeapon: true, name: "Colpo Doppio", icon: "🏹", kind: "weapon", dice: "1d8", dmg: "piercing", bonusAttacks: 1, min: 1, uses: 2, info: "un attacco in più" },
      { id: "cura_r", name: "Cura Ferite", icon: "💚", kind: "heal", dice: "1d8", plusMod: true, min: 1, uses: 1, grow: true },
      { id: "pioggia", name: "Pioggia di Frecce", icon: "🌧", kind: "save", dice: "2d8", dmg: "piercing", save: "dex", area: true, half: true, min: 3, uses: 1, grow: true },
      { id: "mimetismo", name: "Mimetismo", icon: "🍃", kind: "buff", buff: "adv", turns: 2, self: true, min: 3, uses: 2 },
      { id: "trappola", name: "Trappola Spinata", icon: "🪤", kind: "save", dice: "2d6", dmg: "piercing", save: "dex", stun: 1, min: 6, uses: 1 },
      { id: "fulminante", name: "Freccia Fulminante", icon: "⚡", kind: "save", dice: "4d8", dmg: "lightning", save: "dex", area: true, half: true, min: 9, uses: 1, grow: true },
    ] },
  monk: { hitDie: 8, ac: 16, armor: "unarmored", unarmored: "wis", stat: "dex", rec: ["dex", "wis"], extraAttacks: true,
    base: [{ id: "raffica", name: "Raffica di Colpi", icon: "👊", kind: "weapon", dice: "1d6", dmg: "bludgeoning", attacks: 2 }, { id: "schivata", name: "Schivata Paziente", icon: "🌀", kind: "buff", buff: "ac", value: 4, turns: 1, self: true, uses: 2 }],
    pool: [
      { id: "ki", name: "Colpo Ki", icon: "✴", kind: "weapon", dice: "1d10", dmg: "force", min: 1, uses: 3 },
      { id: "vento", name: "Passo del Vento", icon: "💨", kind: "buff", buff: "adv", turns: 2, self: true, min: 1, uses: 2 },
      { id: "stordente", name: "Pugno Stordente", icon: "💫", kind: "save", dice: "1d6", dmg: "bludgeoning", save: "con", stun: 1, min: 3, uses: 2 },
      { id: "integrita", name: "Integrità del Corpo", icon: "🧘", kind: "heal", flat: "lv*3", self: true, min: 6, uses: 1 },
      { id: "ondata", name: "Onda di Ki", icon: "🌊", kind: "save", dice: "3d10", dmg: "force", save: "dex", area: true, half: true, min: 9, uses: 1, grow: true },
      { id: "palmo", name: "Palmo Tremante", icon: "🖐", kind: "save", dice: "6d10", dmg: "necrotic", save: "con", half: true, min: 12, uses: 1 },
    ] },
  rogue: { hitDie: 8, ac: 15, armor: "light", stat: "dex", rec: ["dex", "con"],
    // 2026-11-10: l'Attacco Furtivo scatta da solo (motore: una volta per round sul primo colpo d'arma a segno,
    // con vantaggio o con un altro eroe in piedi nel gruppo). Colpo Mirato dà il vantaggio per farlo scattare.
    base: [{ id: "mirato", name: "Colpo Mirato", icon: "🎯", kind: "buff", buff: "adv", turns: 2, self: true, uses: 3, info: "vantaggio per 2 turni: l'Attacco Furtivo scatta anche da solo" }],
    pool: [
      { id: "nascondersi", name: "Nascondersi", icon: "🫥", kind: "buff", buff: "adv", turns: 2, self: true, min: 1, uses: 2 },
      { id: "veleno_r", name: "Lama Avvelenata", icon: "☠", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, min: 1, uses: 2 },
      { id: "basso", useWeapon: true, name: "Colpo Basso", icon: "🦵", kind: "weapon", dice: "1d8", dmg: "piercing", riderDis: 2, min: 3, uses: 2, info: "il nemico a svantaggio" },
      { id: "prodigiosa", name: "Schivata Prodigiosa", icon: "🤸", kind: "buff", buff: "ac", value: 4, turns: 1, self: true, min: 3, uses: 2 },
      { id: "fumogena", name: "Bomba Fumogena", icon: "💨", kind: "debuff", area: true, turns: 2, inflict: { key: "blinded" }, min: 6, uses: 1, info: "Acceca tutti · 2 turni" },
      { id: "assassinare", useWeapon: true, name: "Assassinare", icon: "🗡", kind: "weapon", dice: "1d8", dmg: "piercing", adv: true, rider: "4d6", riderDmg: "piercing", min: 9, uses: 1, grow: true },
    ] },
  wizard: { hitDie: 6, ac: 12, armor: "light", stat: "int", rec: ["int", "dex"],
    base: [{ id: "dardo_fuoco", name: "Dardo di Fuoco", icon: "🔥", kind: "spell", dice: "1d10", dmg: "fire", scale: true, cantrip: true, inflict: { key: "burn", chance: 15 }, info: "1d10 fuoco · può bruciare" }, { id: "dardo_inc", name: "Dardo Incantato", icon: "✨", kind: "missile", dice: "3d4", flat: 3, dmg: "force", uses: 3, grow: true }],
    pool: [
      { id: "raggio_gelo", name: "Raggio di Gelo", icon: "❄", kind: "spell", dice: "1d8", dmg: "cold", scale: true, cantrip: true, min: 1, inflict: { key: "slow", chance: 50, turns: 1 }, info: "1d8 freddo · può rallentare" },
      { id: "scudo", name: "Scudo", icon: "🛡", kind: "buff", buff: "ac", value: 5, turns: 1, self: true, min: 1, uses: 2 },
      { id: "mani_w", name: "Mani Brucianti", icon: "🖐", kind: "save", dice: "3d6", dmg: "fire", save: "dex", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "acida", name: "Freccia Acida", icon: "🧪", kind: "spell", dice: "4d4", dmg: "acid", min: 3, uses: 2, grow: true },
      { id: "palla_fuoco", name: "Palla di Fuoco", icon: "☄", kind: "save", dice: "8d6", dmg: "fire", save: "dex", area: true, half: true, min: 6, uses: 1, grow: true },
      { id: "ipnosi", name: "Trama Ipnotica", icon: "🌀", kind: "save", dice: "0d1", dmg: "psychic", save: "wis", area: true, inflict: { key: "paralyzed" }, min: 6, uses: 1, info: "Paralisi · TS SAG" },
      { id: "cono_freddo", name: "Cono di Freddo", icon: "🧊", kind: "save", dice: "8d8", dmg: "cold", save: "con", area: true, half: true, min: 9, uses: 1, grow: true },
    ] },
  sorcerer: { hitDie: 6, ac: 12, armor: "light", stat: "cha", rec: ["cha", "con"],
    base: [{ id: "fiotto", name: "Fiotto di Fuoco", icon: "🔥", kind: "spell", dice: "1d10", dmg: "fire", scale: true, cantrip: true, inflict: { key: "burn", chance: 15 }, info: "1d10 fuoco · può bruciare" }, { id: "mani_br", name: "Mani Brucianti", icon: "🖐", kind: "save", dice: "3d6", dmg: "fire", save: "dex", area: true, half: true, uses: 2, grow: true }],
    pool: [
      { id: "veleno", name: "Spruzzo Velenoso", icon: "☠", kind: "save", dice: "1d12", dmg: "poison", save: "con", scale: true, cantrip: true, min: 1, inflict: { key: "poison" }, info: "1d12 veleno · avvelena · TS COS" },
      { id: "scudo_s", name: "Scudo", icon: "🛡", kind: "buff", buff: "ac", value: 5, turns: 1, self: true, min: 1, uses: 2 },
      { id: "gemello", name: "Dardo Gemello", icon: "⚡", kind: "spell", dice: "1d10", dmg: "lightning", attacks: 2, min: 3, uses: 2, info: "due raggi" },
      { id: "fulmine", name: "Fulmine", icon: "🌩", kind: "save", dice: "8d6", dmg: "lightning", save: "dex", area: true, half: true, min: 6, uses: 1, grow: true },
      { id: "catena", name: "Catena di Fulmini", icon: "⛓", kind: "save", dice: "10d8", dmg: "lightning", save: "dex", area: true, half: true, min: 12, uses: 1 },
    ] },
  warlock: { hitDie: 8, ac: 13, armor: "light", stat: "cha", rec: ["cha", "con"],
    base: [{ id: "deflagrazione", name: "Deflagrazione Occulta", icon: "👁", kind: "spell", dice: "1d10", dmg: "force", scale: true, cantrip: true }, { id: "maleficio", name: "Maleficio", icon: "🩸", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, uses: 2 }],
    pool: [
      { id: "agathys", name: "Armatura di Agathys", icon: "🧊", kind: "buff", buff: "ac", value: 3, turns: 3, self: true, min: 1, uses: 1 },
      { id: "hadar", name: "Braccia di Hadar", icon: "🐙", kind: "save", dice: "2d6", dmg: "necrotic", save: "str", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "vampiro", name: "Tocco Vampirico", icon: "🦇", kind: "spell", dice: "3d6", dmg: "necrotic", drain: true, min: 3, uses: 2, grow: true, info: "ti cura di metà del danno" },
      { id: "paura", name: "Paura", icon: "😱", kind: "debuff", area: true, turns: 2, inflict: { key: "frightened" }, min: 6, uses: 1, info: "Paura a tutti · 2 turni" },
      { id: "fame", name: "Fame di Hadar", icon: "🌑", kind: "save", dice: "4d6", dmg: "cold", save: "con", area: true, half: true, min: 9, uses: 1, grow: true },
      { id: "dito", name: "Dito della Morte", icon: "☠", kind: "save", dice: "7d8", flat: 20, dmg: "necrotic", save: "con", half: true, min: 15, uses: 1 },
    ] },
  druid: { hitDie: 8, ac: 14, armor: "light", stat: "wis", rec: ["wis", "con"],
    base: [{ id: "rovi", name: "Frusta di Rovi", icon: "🌿", kind: "spell", dice: "1d6", dmg: "piercing", scale: true, cantrip: true }, { id: "cura_d", name: "Cura Ferite di Gruppo", icon: "💚", kind: "heal_all", dice: "1d8", plusMod: true, uses: 3, info: "Cura tutti · 1d8 + SAG" }],
    pool: [
      { id: "onda", name: "Onda Tonante", icon: "🌊", kind: "save", dice: "2d8", dmg: "thunder", save: "con", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "pelle", name: "Pelle di Corteccia", icon: "🌳", kind: "buff", buff: "ac", value: 3, turns: 3, min: 1, uses: 1 },
      { id: "lama_fiamma", name: "Lama di Fiamma", icon: "🔥", kind: "spell", dice: "3d6", dmg: "fire", min: 3, uses: 3, grow: true },
      { id: "luna", name: "Raggio di Luna", icon: "🌙", kind: "save", dice: "2d10", dmg: "radiant", save: "con", half: true, min: 3, uses: 2, grow: true },
      { id: "richiamo", name: "Richiamo del Fulmine", icon: "⚡", kind: "save", dice: "3d10", dmg: "lightning", save: "dex", half: true, min: 6, uses: 2, grow: true },
      { id: "tempesta", name: "Tempesta di Ghiaccio", icon: "🌨", kind: "save", dice: "4d6", dmg: "cold", save: "dex", area: true, half: true, min: 9, uses: 1, grow: true, inflict: { key: "frozen", left: 1 }, info: "chi fallisce resta congelato 1 turno" },
    ] },
  cleric: { hitDie: 8, ac: 18, armor: "heavy", stat: "wis", rec: ["wis", "con"],
    base: [{ id: "cura_c", name: "Cura Ferite di Gruppo", icon: "💚", kind: "heal_all", dice: "1d8", plusMod: true, uses: 3, info: "Cura tutti · 1d8 + SAG" },
      { id: "scaccia_non_morti", name: "Scacciare non Morti", icon: "☀", kind: "debuff", area: true, undeadOnly: true, save: "wis", dcStat: "wis", turns: 3, inflict: { key: "frightened" }, min: 1, uses: 1, info: "Paura ai non morti · 3 turni · TS SAG" }],
    pool: [
      { id: "fiamma", name: "Fiamma Sacra", icon: "🕯", kind: "save", dice: "1d8", plusMod: true, dmg: "radiant", damageTypes: ["radiant", "fire"], save: "dex", cantrip: true, min: 1, info: "1d8 + SAG radioso/fuoco · TS DES" },
      { id: "benedire_c", name: "Benedizione", icon: "✨", kind: "buff", buff: "adv", turns: 2, allParty: true, min: 1, uses: 1 },
      { id: "arma_spir", name: "Arma Spirituale", icon: "🗡", kind: "missile", dice: "1d8", dmg: "force", plusMod: true, min: 3, uses: 3, grow: true },
      { id: "parola", name: "Parola Guaritrice di Massa", icon: "🙏", kind: "heal_all", dice: "1d4", plusMod: true, min: 3, uses: 2, grow: true },
      { id: "guardiani", name: "Guardiani Spirituali", icon: "👼", kind: "save", dice: "3d8", dmg: "radiant", save: "wis", area: true, half: true, min: 6, uses: 1, grow: true },
      { id: "guarigione", name: "Guarigione", icon: "💖", kind: "heal", flat: "lv*6", min: 12, uses: 1 },
    ] },
  bard: { hitDie: 8, ac: 14, armor: "light", stat: "cha", rec: ["cha", "dex"],
    base: [{ id: "beffa", name: "Beffa Crudele", icon: "🎭", kind: "save", dice: "1d6", dmg: "psychic", save: "wis", scale: true, cantrip: true, dis: 1, info: "1d6 psichico · svantaggio · TS SAG" },
      { id: "ispirazione", name: "Ispirazione Bardica", icon: "🎶", kind: "buff", buff: "inspire", value: 3, turns: 2, uses: 3, info: "Vantaggio e +3 danni · un alleato · 2 turni" }],
    pool: [
      { id: "parola_b", name: "Parola Guaritrice", icon: "🎵", kind: "heal", dice: "1d4", plusMod: true, min: 1, uses: 3, grow: true },
      { id: "onda_b", name: "Onda Tonante", icon: "🌊", kind: "save", dice: "2d8", dmg: "thunder", save: "con", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "sussurri", name: "Sussurri Dissonanti", icon: "👂", kind: "save", dice: "3d6", dmg: "psychic", save: "wis", half: true, min: 3, uses: 2, grow: true, inflict: { key: "confused", turns: 1 }, info: "chi fallisce resta confuso" },
      { id: "riposo", name: "Canto di Riposo", icon: "🎼", kind: "heal_all", dice: "1d8", plusMod: true, min: 3, uses: 1, grow: true },
      { id: "risata", name: "Risata Incontenibile", icon: "😂", kind: "save", dice: "0d1", dmg: "psychic", save: "wis", stun: 1, min: 6, uses: 1, info: "chi fallisce resta stordito" },
    ] },
};

/* SOTTOCLASSI (2026-11-10): due per classe, come in D&D. Si comprano con le Monete Antiche
   (SUBCLASS_COST) quando l'eroe di quella classe è almeno al SUBCLASS_LEVEL; comprate restano
   (storyChars[cls].subclasses = [chiavi]) e se ne usa UNA alla volta (storyChars[cls].subclass),
   cambiandola gratis fuori dai dungeon. Ogni sottoclasse = un tratto passivo (`passive`, letto dal
   motore: critAt, wHit/wDmg alle armi, sDmg agli incantesimi, heal alle cure, ac, hpLv PF per
   livello, save, dc, res, rageAll, thorns) + due azioni (Lv 5 e Lv 11) fatte SOLO con le meccaniche
   già esistenti del motore. Numeri: numero, "mod" (caratteristica della classe), "lv", "lv/2". */
export const SUBCLASS_COST = 2000;
export const SUBCLASS_LEVEL = 5;
export const SUBCLASSES = {
  fighter: [
    { key: "campione", name: "Campione", icon: "🏆", desc: "Forza bruta e resistenza: colpi critici più frequenti.",
      passive: { critAt: 19, hpLv: 1 }, passiveTxt: "critico con 19–20 · +1 PF per livello",
      actions: [
        { id: "sc_assalto", useWeapon: true, name: "Assalto del Campione", icon: "🏆", kind: "weapon", dice: "1d8", dmg: "slashing", adv: true, bonusDmg: "lv/2", min: 5, uses: 2, info: "a vantaggio, +metà livello ai danni" },
        { id: "sc_baluardo", name: "Ultimo Baluardo", icon: "❤", kind: "heal", dice: "3d10", plusLevel: true, self: true, min: 11, uses: 1 },
      ] },
    { key: "maestro", name: "Maestro di Battaglia", icon: "⚔", desc: "Tattico: manovre che sbilanciano e spaventano.",
      passive: { wHit: 1 }, passiveTxt: "+1 a colpire con le armi",
      actions: [
        { id: "sc_sbilancia", useWeapon: true, name: "Attacco Sbilanciante", icon: "🌀", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "1d8", riderDis: 2, min: 5, uses: 3, grow: true, info: "+1d8 (dado di superiorità) e il nemico a svantaggio" },
        { id: "sc_minaccia", useWeapon: true, name: "Colpo Minaccioso", icon: "😱", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "2d8", inflict: { key: "frightened", turns: 2 }, min: 11, uses: 2, info: "+2d8 e il nemico spaventato" },
      ] },
  ],
  barbarian: [
    { key: "berserker", name: "Cammino del Berserker", icon: "🪓", desc: "Furia cieca: colpi in più e terrore.",
      passive: { wDmg: 1 }, passiveTxt: "+1 danni con le armi",
      actions: [
        { id: "sc_frenesia", useWeapon: true, name: "Frenesia", icon: "🪓", kind: "weapon", dice: "1d12", dmg: "slashing", bonusAttacks: 1, min: 5, uses: 2, info: "un attacco in più" },
        { id: "sc_intimida", name: "Presenza Intimidatoria", icon: "😱", kind: "debuff", area: true, turns: 2, inflict: { key: "frightened" }, min: 11, uses: 1, info: "tutti i nemici spaventati" },
      ] },
    { key: "orso", name: "Totem dell'Orso", icon: "🐻", desc: "Lo spirito dell'orso: in furia resisti quasi a tutto.",
      passive: { rageAll: true, hpLv: 1 }, passiveTxt: "in Furia dimezzi TUTTI i danni (non psichici) · +1 PF per livello",
      actions: [
        { id: "sc_ruggito_orso", name: "Ruggito dell'Orso", icon: "🐻", kind: "taunt", save: "wis", turns: 2, min: 5, uses: 1, info: "tutti i nemici: TS SAG o attaccano solo te per 2 turni" },
        { id: "sc_pelle_orso", name: "Pelle d'Orso", icon: "🛡", kind: "buff", buff: "ac", value: 3, turns: 3, self: true, min: 11, uses: 1 },
      ] },
  ],
  paladin: [
    { key: "devozione", name: "Giuramento di Devozione", icon: "😇", desc: "Il cavaliere luminoso: protegge e scaccia il male.",
      passive: { heal: 2, save: 1 }, passiveTxt: "+2 a ogni cura · +1 ai TS",
      actions: [
        { id: "sc_arma_cons", name: "Arma Consacrata", icon: "✨", kind: "buff", buff: "adv", turns: 3, self: true, min: 5, uses: 1, info: "vantaggio per 3 turni" },
        { id: "sc_scaccia", name: "Scacciare gli Empi", icon: "☀", kind: "save", dice: "3d8", dmg: "radiant", save: "wis", area: true, half: true, inflict: { key: "frightened", turns: 2 }, min: 11, uses: 1, grow: true, info: "tutti i nemici · chi fallisce è spaventato" },
      ] },
    { key: "vendetta", name: "Giuramento di Vendetta", icon: "🗡", desc: "Il castigo: un nemico alla volta, fino in fondo.",
      passive: { wDmg: 1, wHit: 1 }, passiveTxt: "+1 a colpire e ai danni con le armi",
      actions: [
        { id: "sc_inimicizia", name: "Voto di Inimicizia", icon: "🎯", kind: "buff", buff: "dmg", value: 4, turns: 3, self: true, min: 5, uses: 1 },
        { id: "sc_vendicativa", useWeapon: true, name: "Punizione Vendicativa", icon: "⚡", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "4d8", riderDmg: "radiant", inflict: { key: "frightened", turns: 2 }, min: 11, uses: 1, grow: true, info: "+4d8 radiosi e il nemico spaventato" },
      ] },
  ],
  ranger: [
    { key: "cacciatore", name: "Cacciatore", icon: "🏹", desc: "Specialista dei bersagli grossi e dei gruppi.",
      passive: { wDmg: 2 }, passiveTxt: "+2 danni con le armi",
      actions: [
        { id: "sc_colosso", useWeapon: true, name: "Uccisore di Colossi", icon: "🗿", kind: "weapon", dice: "1d8", dmg: "piercing", rider: "2d8", min: 5, uses: 2, grow: true, info: "+2d8 al primo colpo" },
        { id: "sc_turbine_c", name: "Turbine del Cacciatore", icon: "🌪", kind: "save", dice: "4d8", dmg: "slashing", save: "dex", area: true, half: true, min: 11, uses: 1, grow: true },
      ] },
    { key: "bestie", name: "Signore delle Bestie", icon: "🐺", desc: "Un lupo combatte al tuo fianco.",
      passive: { ac: 1 }, passiveTxt: "+1 CA (il lupo ti copre)",
      actions: [
        { id: "sc_lupo", name: "Morso del Lupo", icon: "🐺", kind: "spell", dice: "2d6", dmg: "piercing", attacks: 2, min: 5, uses: 3, info: "il lupo morde due volte" },
        { id: "sc_branco", name: "Assalto del Branco", icon: "🐾", kind: "save", dice: "4d8", dmg: "piercing", save: "dex", area: true, half: true, inflict: { key: "slow", turns: 1 }, min: 11, uses: 1, grow: true, info: "tutti i nemici · chi fallisce è rallentato" },
      ] },
  ],
  monk: [
    { key: "mano_aperta", name: "Via della Mano Aperta", icon: "✋", desc: "Maestro dei colpi a mano nuda.",
      passive: { wHit: 1, wDmg: 1 }, passiveTxt: "+1 a colpire e ai danni coi colpi",
      actions: [
        { id: "sc_mano", useWeapon: true, name: "Tecnica della Mano Aperta", icon: "✋", kind: "weapon", dice: "1d6", dmg: "bludgeoning", attacks: 2, riderDis: 1, min: 5, uses: 3, info: "due colpi e il nemico a svantaggio" },
        { id: "sc_quiete", name: "Onda di Quiete", icon: "🧘", kind: "save", dice: "5d10", dmg: "force", save: "con", half: true, stun: 1, min: 11, uses: 1, info: "chi fallisce resta stordito" },
      ] },
    { key: "ombra", name: "Via dell'Ombra", icon: "🌑", desc: "Ninja: buio, inganno e colpi alle spalle.",
      passive: { ac: 1 }, passiveTxt: "+1 CA",
      actions: [
        { id: "sc_passo_ombra", name: "Passo d'Ombra", icon: "🌑", kind: "buff", buff: "adv", turns: 2, self: true, min: 5, uses: 2 },
        { id: "sc_oscurita", name: "Oscurità", icon: "⬛", kind: "debuff", area: true, turns: 2, inflict: { key: "blinded" }, min: 11, uses: 1, info: "tutti i nemici accecati" },
      ] },
  ],
  rogue: [
    { key: "assassino", name: "Assassino", icon: "🗡", desc: "Colpi letali e veleni.",
      passive: { critAt: 19 }, passiveTxt: "critico con 19–20",
      actions: [
        { id: "sc_letale", useWeapon: true, name: "Colpo Letale", icon: "🗡", kind: "weapon", dice: "1d8", dmg: "piercing", attacks: 1, singleAttack: true, adv: true, rider: "sneak", riderDmg: "piercing", bonusDmg: "lv/2", min: 5, uses: 1, info: "a vantaggio: attacco furtivo + metà livello" },
        { id: "sc_veleno_ass", useWeapon: true, name: "Veleno dell'Assassino", icon: "☠", kind: "weapon", dice: "1d8", dmg: "piercing", rider: "3d6", riderDmg: "poison", inflict: { key: "poison" }, min: 11, uses: 2, info: "+3d6 veleno e il nemico avvelenato" },
      ] },
    { key: "mistificatore", name: "Mistificatore Arcano", icon: "🔮", desc: "Ladro e mago: dardi e illusioni.",
      passive: { save: 1, sDmg: 1 }, passiveTxt: "+1 ai TS · +1 danni degli incantesimi",
      actions: [
        { id: "sc_dardo_mist", name: "Dardo Incantato", icon: "✨", kind: "missile", dice: "3d4", flat: 3, dmg: "force", min: 5, uses: 2, grow: true },
        { id: "sc_trama", name: "Trama Ingannevole", icon: "🔮", kind: "save", dice: "4d6", dmg: "psychic", save: "wis", half: true, inflict: { key: "confused", turns: 1 }, min: 11, uses: 1, grow: true, info: "chi fallisce resta confuso" },
      ] },
  ],
  wizard: [
    { key: "invocazione", name: "Scuola di Invocazione", icon: "🔥", desc: "Pura potenza distruttiva.",
      passive: { sDmg: "mod" }, passiveTxt: "+INT ai danni degli incantesimi",
      actions: [
        { id: "sc_sfera", name: "Sfera Instabile", icon: "💥", kind: "save", dice: "6d6", dmg: "force", save: "dex", area: true, half: true, min: 5, uses: 1, grow: true },
        { id: "sc_sovraccarico", name: "Raggio Sovraccarico", icon: "⚡", kind: "spell", dice: "6d10", dmg: "force", min: 11, uses: 1, grow: true },
      ] },
    { key: "abiurazione", name: "Scuola di Abiurazione", icon: "🔰", desc: "Barriere e protezioni per tutto il gruppo.",
      passive: { ac: 1, hpLv: 1 }, passiveTxt: "+1 CA · +1 PF per livello (guardia arcana)",
      actions: [
        { id: "sc_guardia", name: "Guardia Arcana", icon: "🔰", kind: "buff", buff: "ac", value: 3, turns: 2, allParty: true, min: 5, uses: 1 },
        { id: "sc_contro", name: "Controincantesimo", icon: "🚫", kind: "debuff", area: true, turns: 2, min: 11, uses: 1, info: "tutti i nemici a svantaggio" },
      ] },
  ],
  sorcerer: [
    { key: "draconica", name: "Stirpe Draconica", icon: "🐉", desc: "Sangue di drago: scaglie e soffio.",
      passive: { ac: 1, hpLv: 1, sDmg: 2, res: ["fire"] }, passiveTxt: "+1 CA · +1 PF per livello · +2 danni degli incantesimi · resiste al fuoco",
      actions: [
        { id: "sc_soffio", name: "Soffio del Drago", icon: "🐉", kind: "save", dice: "4d6", dmg: "fire", save: "dex", area: true, half: true, min: 5, uses: 1, grow: true },
        { id: "sc_presenza", name: "Presenza Draconica", icon: "😱", kind: "debuff", area: true, turns: 2, inflict: { key: "frightened" }, min: 11, uses: 1, info: "tutti i nemici spaventati" },
      ] },
    { key: "selvaggia", name: "Magia Selvaggia", icon: "🌀", desc: "Il caos che ribolle nel sangue.",
      passive: { critAt: 19 }, passiveTxt: "critico con 19–20 anche con gli incantesimi",
      actions: [
        { id: "sc_caos", name: "Ondata del Caos", icon: "🌀", kind: "save", dice: "3d10", dmg: "force", save: "dex", area: true, half: true, inflict: { key: "confused", turns: 1 }, min: 5, uses: 1, grow: true, info: "tutti i nemici · chi fallisce è confuso" },
        { id: "sc_fortuna", name: "Fortuna Piegata", icon: "🍀", kind: "buff", buff: "adv", turns: 2, allParty: true, min: 11, uses: 1 },
      ] },
  ],
  warlock: [
    { key: "immondo", name: "Il Signore Immondo", icon: "😈", desc: "Patto infernale: fuoco e dannazione.",
      passive: { res: ["fire"], hpLv: 1 }, passiveTxt: "resiste al fuoco · +1 PF per livello",
      actions: [
        { id: "sc_inferno", name: "Fuoco Infernale", icon: "🔥", kind: "save", dice: "8d6", dmg: "fire", save: "dex", area: true, half: true, min: 5, uses: 1, grow: true },
        { id: "sc_scagliare", name: "Scagliare all'Inferno", icon: "😈", kind: "spell", dice: "10d10", dmg: "psychic", min: 11, uses: 1 },
      ] },
    { key: "antico", name: "Il Grande Antico", icon: "🐙", desc: "Patto con l'ignoto: follia e menti spezzate.",
      passive: { save: 1, res: ["psychic"], dc: 1 }, passiveTxt: "+1 ai TS · +1 alla CD · resiste ai danni psichici",
      actions: [
        { id: "sc_follia", name: "Sussurri della Follia", icon: "👁", kind: "save", dice: "3d6", dmg: "psychic", save: "wis", area: true, half: true, inflict: { key: "confused", turns: 1 }, min: 5, uses: 1, grow: true, info: "tutti i nemici · chi fallisce è confuso" },
        { id: "sc_domina", name: "Mente Dominata", icon: "🐙", kind: "save", dice: "4d10", dmg: "psychic", save: "wis", half: true, stun: 1, min: 11, uses: 1, info: "chi fallisce resta stordito" },
      ] },
  ],
  druid: [
    { key: "luna", name: "Circolo della Luna", icon: "🌕", desc: "Forme selvatiche da combattimento.",
      passive: { ac: 1, hpLv: 2 }, passiveTxt: "+1 CA · +2 PF per livello",
      actions: [
        { id: "sc_artigli", name: "Artigli dell'Orso", icon: "🐻", kind: "spell", dice: "2d8", dmg: "slashing", attacks: 2, min: 5, uses: 3, info: "due zampate" },
        { id: "sc_elementale", name: "Forma Elementale", icon: "🌋", kind: "buff", buff: "dmg", value: 6, turns: 3, self: true, min: 11, uses: 1 },
      ] },
    { key: "terra", name: "Circolo della Terra", icon: "🌿", desc: "La magia del luogo: rovi e ristoro.",
      passive: { sDmg: 2, heal: 2 }, passiveTxt: "+2 danni degli incantesimi · +2 a ogni cura",
      actions: [
        { id: "sc_spine", name: "Crescita di Spine", icon: "🌵", kind: "save", dice: "4d6", dmg: "piercing", save: "dex", area: true, half: true, inflict: { key: "slow", turns: 1 }, min: 5, uses: 2, grow: true, info: "tutti i nemici · chi fallisce è rallentato" },
        { id: "sc_ristoro", name: "Ristoro della Terra", icon: "🌿", kind: "heal_all", dice: "2d8", plusMod: true, min: 11, uses: 1, grow: true },
      ] },
  ],
  cleric: [
    { key: "vita", name: "Dominio della Vita", icon: "💖", desc: "Il guaritore: ogni cura vale di più.",
      passive: { heal: "2+lv/2" }, passiveTxt: "+2 + metà livello a ogni cura",
      actions: [
        { id: "sc_preserva", name: "Preservare la Vita", icon: "💖", kind: "heal_all", flat: "lv*2", min: 5, uses: 1, info: "cura tutti di 2 × livello" },
        { id: "sc_benedetto", name: "Guaritore Benedetto", icon: "🙏", kind: "heal", flat: "lv*4", min: 11, uses: 1 },
      ] },
    { key: "tempesta", name: "Dominio della Tempesta", icon: "⛈", desc: "Tuono e fulmine al servizio del dio.",
      passive: { thorns: { dice: "2d8", dmg: "lightning", chance: 50 } }, passiveTxt: "Ira della Tempesta: chi ti colpisce in mischia, 50% di prendere 2d8 da fulmine",
      actions: [
        { id: "sc_fulmine_c", name: "Fulmine Distruttivo", icon: "🌩", kind: "save", dice: "3d8", dmg: "lightning", save: "dex", area: true, half: true, min: 5, uses: 1, grow: true },
        { id: "sc_tuono", name: "Ira del Tuono", icon: "⛈", kind: "save", dice: "4d10", dmg: "thunder", save: "con", half: true, stun: 1, min: 11, uses: 1, info: "chi fallisce resta stordito" },
      ] },
  ],
  bard: [
    { key: "sapienza", name: "Collegio della Sapienza", icon: "📜", desc: "Parole che feriscono e segreti rubati.",
      passive: { save: 1, dc: 1 }, passiveTxt: "+1 ai TS · +1 alla CD",
      actions: [
        { id: "sc_taglienti", name: "Parole Taglienti", icon: "🗯", kind: "debuff", turns: 2, min: 5, uses: 2, info: "un nemico a svantaggio per 2 turni" },
        { id: "sc_segreti", name: "Segreti Magici", icon: "📜", kind: "save", dice: "8d6", dmg: "fire", save: "dex", area: true, half: true, min: 11, uses: 1, grow: true, info: "una Palla di Fuoco rubata" },
      ] },
    { key: "valore", name: "Collegio del Valore", icon: "🛡", desc: "Il bardo guerriero, in prima linea.",
      passive: { ac: 1, wHit: 1, extraAttack: true }, passiveTxt: "attacco extra con le armi · +1 CA · +1 a colpire",
      actions: [
        { id: "sc_ispira_b", name: "Ispirazione in Battaglia", icon: "🎶", kind: "buff", buff: "dmg", value: 4, turns: 2, allParty: true, min: 5, uses: 1, info: "+4 danni a tutto il gruppo" },
        { id: "sc_colpo_b", useWeapon: true, name: "Colpo Incantato", icon: "⚡", kind: "weapon", dice: "1d8", dmg: "piercing", rider: "2d8", riderDmg: "thunder", min: 11, uses: 2, grow: true, info: "+2d8 da tuono al primo colpo" },
      ] },
  ],
};
export const subclassesOf = (cls) => SUBCLASSES[cls] || [];
export const subclassOf = (cls, key) => (key ? subclassesOf(cls).find((s) => s.key === key) || null : null);
// sottoclasse attiva dell'eroe (solo dal SUBCLASS_LEVEL e se comprata)
export function heroSubclass(cls, hero) {
  const key = hero?.subclass;
  if (!key || !(hero.subclasses || []).includes(key) || heroLevel(hero) < SUBCLASS_LEVEL) return null;
  return subclassOf(cls, key);
}
// numero di un tratto: 2 · "mod" · "lv" · "lv/2" · "2+lv/2"
export function subNum(v, lv = 1, mod = 0) {
  if (typeof v === "number") return v;
  return String(v || "0").split("+").reduce((t, p) => {
    p = p.trim();
    if (p === "mod") return t + mod;
    if (p === "lv") return t + lv;
    if (p === "lv/2") return t + Math.floor(lv / 2);
    return t + (Number(p) || 0);
  }, 0);
}

// Sempre disponibile: Difendersi (+4 CA fino al proprio turno). È anche l'azione automatica di chi sparisce.
export const DEFEND = { id: "difesa", name: "Difendersi", icon: "🛡", kind: "defend", info: "+4 CA fino al tuo prossimo turno" };

export const kitOf = (cls) => KITS[cls] || KITS.fighter;
export const poolFor = (cls, lv) => kitOf(cls).pool.filter((a) => (a.min || 1) <= lv && !kitOf(cls).base.some((b) => b.id === a.id && (b.min || 1) <= lv));
/* PRESA A DUE MANI (2026-11-07): spada lunga e bastone sono "versatili" come in D&D. Chi non è un
   incantatore può impugnarli a due mani: dado più grosso, ma lo scudo va via (e la sua CA). Cambiare
   presa è un'azione GRATUITA prima di agire nel round (dopo aver agito no: niente scudo rimesso apposta
   per i mostri). Si tiene da una sala all'altra. */
export const VERSATILE = { spada_lunga: "1d10", bastone: "1d8" };
export const GRIP_CLASSES = new Set(["fighter", "barbarian", "paladin", "ranger", "rogue", "monk"]);
export const canTwoHand = (cls, weapon) => GRIP_CLASSES.has(cls) && !!VERSATILE[weapon];
export const GRIP = { id: "grip", kind: "grip", icon: "✊", free: true };
export function heroActions(cls, lv, picks = [], weapon = null, plus = 0, wItem = null, twoHand = false, subclass = null) {
  const k = kitOf(cls);
  const w0 = weaponOf(cls, weapon), two = twoHand && canTwoHand(cls, w0.key);
  const w = two ? { ...w0, dice: VERSATILE[w0.key] } : w0;
  const withWeapon = (a) => (a.useWeapon ? { ...a, ...((a.attacks || w.attacks) ? { attacks: a.attacks || w.attacks } : {}), ...(a.rider === "sneak" ? { info: `un colpo: ${w.dice} +${sneakDiceOf(lv)}d6` } : {}), dice: w.dice, dmg: w.dmg, wstat: w.wstat, ranged: !!w.ranged, plus: plus || 0, ...(wItem?.fx ? { wfx: wItem.fx } : {}) } : a);
  const base = k.base.filter((a) => (a.min || 1) <= lv);
  const chosen = k.pool.filter((a) => picks.includes(a.id) && (a.min || 1) <= lv && !base.some((b) => b.id === a.id));
  const sub = lv >= SUBCLASS_LEVEL ? subclassOf(cls, subclass) : null;
  const subActs = sub ? sub.actions.filter((a) => (a.min || 1) <= lv).map((a) => ({ ...a, sub: sub.key })) : [];
  const grip = canTwoHand(cls, w0.key)
    ? [{ ...GRIP, name: two ? "Torna a una mano" : "Impugna a due mani", info: two ? `${w0.dice} · riprendi lo scudo` : `${VERSATILE[w0.key]} · niente scudo` }] : [];
  const wa = weaponAction(w, plus, wItem);
  if (cls === "rogue") wa.info += ` · Furtivo +${sneakDiceOf(lv)}d6 (1 per round, con vantaggio o un alleato)`;
  return [wa, ...base.map(withWeapon), ...chosen.map(withWeapon), ...subActs.map(withWeapon), ...grip, DEFEND];
}

/* Statistiche dell'eroe dalla scheda (stats + asi) */
export function heroStats(hero, includeRace = true) {
  const out = {};
  const racial = includeRace ? raceBonuses(hero) : {};
  STAT_KEYS.forEach((k) => { out[k] = Math.min(STAT_MAX, (Number(hero?.stats?.[k]) || 0) + (Number(hero?.asi?.[k]) || 0)) + (racial[k] || 0); });
  return out;
}
export const mainMod = (cls, st) => st[kitOf(cls).stat] || 0;
/* PF TIRATI (2026-11-04): alla creazione e a ogni livello si tira il dado vita della
   classe (lo tira il server: hero.hpRolls[i] = tiro del livello i+1). Livello 1 = dado
   pieno + il tiro; livelli dopo = il tiro; + COS a ogni livello. Finché un tiro manca
   conta la media. In più HERO_HP_BASE (+10) fissi. */
export const hpPending = (hero) => Math.max(0, heroLevel(hero) - (Array.isArray(hero?.hpRolls) ? hero.hpRolls.length : 0));
export function heroMaxHp(cls, lv, st, rolls = []) {
  const d = kitOf(cls).hitDie;
  const con = st.con || 0;
  const avg = Math.floor(d / 2) + 1;
  let hp = 0;
  for (let i = 1; i <= Math.max(1, lv); i++) {
    const r = Number(rolls?.[i - 1]);
    hp += (i === 1 ? d : 0) + (Number.isFinite(r) && r > 0 ? r : avg) + con;
  }
  return Math.max(1, Math.round(hp * HERO_HP_MULT)) + HERO_HP_BASE;
}
// CA dell'eroe (dal 2026-11-06 dall'armatura scelta: senza `g` = armatura di partenza della classe)
export const heroAc = (cls, st, g = {}) => heroDefense(cls, st, g).ac;
export const heroDc = (cls, lv, st) => 8 + profOf(lv) + mainMod(cls, st);
export const heroHit = (cls, lv, st) => profOf(lv) + mainMod(cls, st);
export const sneakDiceOf = (lv) => 1 + Math.floor((Math.max(1, lv) - 1) / 2);
export function attacksOf(cls, lv, action) {
  if (action.singleAttack) return 1;
  const extra = lv >= 5 && kitOf(cls).extraAttacks && (action.kind === "weapon") ? 1 + (cls === "fighter" && lv >= 11) : 0;
  return (action.attacks || 1) + extra + (action.bonusAttacks || 0);
}

/* Validazione della scheda (la usa il server) */
export function validNewHero(cls, stats, pick, weapon, armor = null) {
  if (!KITS[cls]) return "Classe sconosciuta.";
  if (!weaponChoices(cls).some((w) => w.key === weapon)) return "Scegli l'arma.";
  if (armor && !armorChoices(cls).includes(armor)) return "Armatura non adatta a questa classe.";
  let sum = 0;
  for (const k of STAT_KEYS) {
    const v = Number(stats?.[k]) || 0;
    if (!Number.isInteger(v) || v < 0 || v > STAT_CAP) return "Caratteristiche non valide.";
    sum += v;
  }
  if (sum > STAT_BUDGET) return `Hai solo ${STAT_BUDGET} punti caratteristica.`;
  if (!poolFor(cls, 1).some((a) => a.id === pick)) return "Scegli un'abilità o un incantesimo di partenza.";
  return null;
}
/* RESET DELL'EROE (2026-11-06): nuove caratteristiche (valori finali) e abilità, stesso livello.
   Punti = STAT_BUDGET + quelli dei livelli; oltre STAT_CAP servono per forza i punti dei livelli.
   Restituisce { error } oppure { stats, asi, picks } già divisi come li salva l'eroe. La usano
   il pannello del sito e il server. */
export const RESPEC_COST = 500;
export function validRespec(cls, hero, stats, picks) {
  const lv = heroLevel(hero);
  const earned = asiEarned(lv);
  const base = {}, asi = {};
  let sum = 0, over = 0;
  for (const k of STAT_KEYS) {
    const v = Number(stats?.[k]);
    if (!Number.isInteger(v) || v < 0 || v > STAT_MAX) return { error: "Caratteristiche non valide." };
    sum += v;
    asi[k] = Math.max(0, v - STAT_CAP);
    base[k] = v - asi[k];
    over += asi[k];
  }
  if (sum > STAT_BUDGET + earned) return { error: `Hai solo ${STAT_BUDGET + earned} punti caratteristica.` };
  if (over > earned) return { error: `Oltre +${STAT_CAP} servono i punti dei livelli: ne hai ${earned}.` };
  // i punti di base sono al massimo STAT_BUDGET: quelli in più contano come punti dei livelli
  let excess = Math.max(0, STAT_KEYS.reduce((t, k) => t + base[k], 0) - STAT_BUDGET);
  for (const k of STAT_KEYS) {
    const m = Math.min(base[k], excess);
    base[k] -= m; asi[k] += m; excess -= m;
  }
  const list = [...new Set(Array.isArray(picks) ? picks.map(String) : [])];
  const pool = poolFor(cls, lv);
  if (!list.length) return { error: "Scegli almeno un'abilità o un incantesimo." };
  if (list.length > picksAllowed(lv)) return { error: `Puoi scegliere al massimo ${picksAllowed(lv)} abilità.` };
  if (!list.every((id) => pool.some((a) => a.id === id))) return { error: "Abilità non disponibile al tuo livello." };
  return { stats: base, asi, picks: list };
}
// abilità ancora nelle liste da scegliere (2026-11-10: l'Ispirazione del Bardo è passata fra le base
// e non deve più contare come scelta fatta)
const POOL_IDS = new Set(Object.values(KITS).flatMap((k) => k.pool.map((a) => a.id)));
const AUTO_PICK_LEVEL = new Map(Object.values(KITS).flatMap((k) => k.base.map((a) => [a.id, a.min || 1])));
export function heroPending(hero) {
  const lv = heroLevel(hero);
  const asiSpent = STAT_KEYS.reduce((t, k) => t + (Number(hero?.asi?.[k]) || 0), 0);
  return { level: lv, asi: Math.max(0, asiEarned(lv) - asiSpent), picks: Math.max(0, picksAllowed(lv) - (hero?.picks || []).filter((id) => POOL_IDS.has(id) && !(AUTO_PICK_LEVEL.has(id) && AUTO_PICK_LEVEL.get(id) <= lv)).length) };
}
