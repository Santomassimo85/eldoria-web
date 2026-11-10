// GENERATO da src/data/segreteServer.js con npm run build:segrete: non modificare a mano.
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/data/segreteServer.js
var segreteServer_exports = {};
__export(segreteServer_exports, {
  AFK_MS: () => AFK_MS,
  DAILY_RUNS: () => DAILY_RUNS,
  DAILY_TOTAL: () => DAILY_TOTAL,
  DEFAULT_FLOORS: () => DEFAULT_FLOORS,
  GIFT_DAILY: () => GIFT_DAILY,
  GIFT_FEE: () => GIFT_FEE,
  KITS: () => KITS,
  MAX_STORY_LEVEL: () => MAX_STORY_LEVEL,
  RESPEC_COST: () => RESPEC_COST,
  RUN_COUNTS_AFTER: () => RUN_COUNTS_AFTER,
  SHOP_ITEMS: () => SHOP_ITEMS,
  SOLO_XP_MULT: () => SOLO_XP_MULT,
  STAT_KEYS: () => STAT_KEYS,
  STAT_MAX: () => STAT_MAX,
  SUBCLASSES: () => SUBCLASSES,
  SUBCLASS_COST: () => SUBCLASS_COST,
  SUBCLASS_LEVEL: () => SUBCLASS_LEVEL,
  WEEKLY_RUNS: () => WEEKLY_RUNS,
  XP_VERSION: () => XP_VERSION,
  act: () => act,
  armorChoices: () => armorChoices,
  armorProf: () => armorProf,
  bagOf: () => bagOf,
  battleItem: () => battleItem,
  boughtToday: () => boughtToday,
  canWear: () => canWear,
  coinsOf: () => coinsOf,
  currentWeekKey: () => currentWeekKey,
  dailyLimit: () => dailyLimit,
  diffOf: () => diffOf,
  flee: () => flee,
  giftsToday: () => giftsToday,
  heroActions: () => heroActions,
  heroLevel: () => heroLevel,
  heroOf: () => heroOf,
  heroPending: () => heroPending,
  heroStats: () => heroStats,
  heroXp: () => heroXp,
  hpPending: () => hpPending,
  isGear: () => isGear,
  itemOf: () => itemOf,
  levelOfXp: () => levelOfXp,
  mergeDungeons: () => mergeDungeons,
  mergeMonsters: () => mergeMonsters,
  newRun: () => newRun,
  nextDailyPatch: () => nextDailyPatch,
  nextFloor: () => nextFloor,
  nextRunsPatch: () => nextRunsPatch,
  openChest: () => openChest,
  poolFor: () => poolFor,
  registerCustomItems: () => registerCustomItems,
  romeDay: () => romeDay,
  runsOf: () => runsOf,
  storyLevelOf: () => storyLevelOf,
  subclassOf: () => subclassOf,
  timeout: () => timeout,
  useItem: () => useItem,
  validNewHero: () => validNewHero,
  validRespec: () => validRespec,
  weaponChoices: () => weaponChoices,
  withRng: () => withRng,
  wonItemInboxDoc: () => wonItemInboxDoc,
  xpGain: () => xpGain
});
module.exports = __toCommonJS(segreteServer_exports);

// src/data/segreteKits.js
var MAX_STORY_LEVEL = 20;
var HERO_HP_MULT = 1.1;
var HERO_HP_BASE = 10;
var XP_PER_ROOM = 25;
var XP_GAP = (lv) => Math.round((300 + 35 * (lv - 1)) / 10) * 10;
var XP_TABLE = [0];
for (let lv = 1; lv < 20; lv++) XP_TABLE.push(XP_TABLE[lv - 1] + XP_GAP(lv));
var XP_TABLE_OLD = [0, 300, 900, 2700, 6500, 14e3, 23e3, 34e3, 48e3, 64e3, 85e3, 1e5, 12e4, 14e4, 165e3, 195e3, 225e3, 265e3, 305e3, 355e3];
var XP_VERSION = 2;
function heroXp(hero) {
  const xp = Number(hero?.xp) || 0;
  if (!hero || hero.xpv === XP_VERSION) return xp;
  let lv = 1;
  for (let i = 1; i < XP_TABLE_OLD.length; i++) if (xp >= XP_TABLE_OLD[i]) lv = i + 1;
  if (lv >= 20) return XP_TABLE[19];
  const frac = (xp - XP_TABLE_OLD[lv - 1]) / (XP_TABLE_OLD[lv] - XP_TABLE_OLD[lv - 1]);
  return Math.floor(XP_TABLE[lv - 1] + frac * (XP_TABLE[lv] - XP_TABLE[lv - 1]));
}
var heroLevel = (hero) => levelOfXp(heroXp(hero));
var STAT_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
var STAT_BUDGET = 10;
var STAT_CAP = 3;
var STAT_MAX = 5;
var ASI_EVERY = 3;
var profOf = (lv) => 2 + Math.floor((Math.max(1, lv) - 1) / 4);
var cantripMult = (lv) => 1 + (lv >= 5) + (lv >= 11) + (lv >= 17);
function levelOfXp(xp) {
  let lv = 1;
  for (let i = 1; i < XP_TABLE.length; i++) if ((Number(xp) || 0) >= XP_TABLE[i]) lv = i + 1;
  return Math.min(MAX_STORY_LEVEL, lv);
}
var asiEarned = (lv) => Math.floor(lv / ASI_EVERY);
var picksAllowed = (lv) => 1 + Math.floor(lv / ASI_EVERY);
var WEAPONS = {
  spada_lunga: { name: "Spada Lunga", icon: "\u2694", dice: "1d8", dmg: "slashing", wstat: "str" },
  martello: { name: "Martello da Guerra", icon: "\u{1F528}", dice: "1d8", dmg: "bludgeoning", wstat: "str" },
  ascia_bip: { name: "Ascia Bipenne", icon: "\u{1FA93}", dice: "1d12", dmg: "slashing", wstat: "str" },
  maglio: { name: "Maglio", icon: "\u{1F528}", dice: "2d6", dmg: "bludgeoning", wstat: "str" },
  mazzafrusto: { name: "Mazzafrusto", icon: "\u26D3", dice: "1d8", dmg: "bludgeoning", wstat: "str" },
  arco_lungo: { name: "Arco Lungo", icon: "\u{1F3F9}", dice: "1d8", dmg: "piercing", wstat: "dex", ranged: true },
  scimitarra: { name: "Scimitarra", icon: "\u{1F5E1}", dice: "1d6", dmg: "slashing", wstat: "fin" },
  pugnali: { name: "Due Pugnali", icon: "\u{1F5E1}", dice: "1d4", dmg: "piercing", wstat: "fin", attacks: 2 },
  stocco: { name: "Stocco", icon: "\u{1F5E1}", dice: "1d8", dmg: "piercing", wstat: "fin" },
  bastone: { name: "Bastone Ferrato", icon: "\u{1F9AF}", dice: "1d6", dmg: "bludgeoning", wstat: "str" },
  lancia: { name: "Lancia", icon: "\u{1F531}", dice: "1d6", dmg: "piercing", wstat: "str" },
  balestra_l: { name: "Balestra Leggera", icon: "\u{1F3F9}", dice: "1d8", dmg: "piercing", wstat: "dex", ranged: true },
  mazza: { name: "Mazza", icon: "\u{1F528}", dice: "1d6", dmg: "bludgeoning", wstat: "str" },
  pugni: { name: "Pugni", icon: "\u{1F44A}", dice: "1d6", dmg: "bludgeoning", wstat: "fin", vfx: "punch" }
};
var WEAPON_CHOICES = {
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
  bard: ["stocco", "spada_lunga"]
};
var DMG_SHORT = { slashing: "tagliente", piercing: "perforante", bludgeoning: "contundente" };
var WSTAT_LABEL = { str: "FOR", dex: "DES", fin: "FOR o DES" };
var weaponChoices = (cls) => (WEAPON_CHOICES[cls] || WEAPON_CHOICES.fighter).map((k) => ({ key: k, ...WEAPONS[k], wstat: cls === "monk" ? "fin" : WEAPONS[k].wstat }));
function weaponOf(cls, key) {
  const list = weaponChoices(cls);
  return list.find((w) => w.key === (cls === "rogue" && key === "scimitarra" ? "pugnali" : key)) || list[0];
}
var weaponAction = (w, plus = 0, wItem = null) => ({ id: "arma", name: wItem?.name || (plus ? `${w.name} +${plus}` : w.name), icon: wItem?.icon || w.icon, kind: "weapon", dice: w.dice, dmg: w.dmg, wstat: w.wstat, ranged: !!w.ranged, weaponKey: w.key, ...w.attacks ? { attacks: w.attacks } : {}, plus: plus || 0, ...w.vfx ? { vfx: w.vfx } : {}, ...wItem?.fx ? { wfx: wItem.fx } : {}, info: `${w.attacks ? `${w.attacks} attacchi da ` : ""}${w.dice}${plus ? `+${plus}` : ""} ${DMG_SHORT[w.dmg] || ""} \xB7 ${WSTAT_LABEL[w.wstat]}${wItem?.fx ? ` \xB7 ${fxLine(wItem.fx)}` : ""}` });
function fxLine(fx = {}) {
  const out = [];
  if (fx.extra) out.push(`+${fx.extra[0]} ${DMG_ALL[fx.extra[1]] || ""}`);
  if (fx.burn) out.push(`${fx.burn.chance}% \u{1F525} ${fx.burn.dice}/turno`);
  if (fx.poison) out.push(`${fx.poison.chance}% \u2620 ${fx.poison.dice}/turno`);
  if (fx.slow) out.push(`${fx.slow.chance}% \u{1F40C}`);
  if (fx.stun) out.push(`${fx.stun.chance}% \u{1F4AB}`);
  if (fx.drain) out.push(`il danno extra ti cura del ${fx.drain}%`);
  if (fx.crit) out.push(`critico con ${fx.crit}\u201320`);
  if (fx.multi) out.push(`${fx.multi.double}% un colpo in pi\xF9, ${fx.multi.none}% nessuno`);
  return out.join(" \xB7 ");
}
var DMG_ALL = { slashing: "tagliente", piercing: "perforante", bludgeoning: "contundente", fire: "fuoco", cold: "freddo", lightning: "fulmine", thunder: "tuono", acid: "acido", poison: "veleno", necrotic: "necrotico", radiant: "radioso", force: "forza", psychic: "psichico" };
var ARMORS = {
  abiti: { name: "Abiti da viaggio", icon: "\u{1F455}", cat: "none", base: 10, dex: 99, start: true, perk: { hit: 1, dc: 1, save: 1, text: "nessun ingombro: +1 a colpire, +1 CD, +1 ai TS" } },
  magica: { name: "Armatura Magica", icon: "\u2728", cat: "mage", base: 13, dex: 99, start: true },
  senza: { name: "Difesa senz'armatura", icon: "\u{1F4AA}", cat: "unarmored", start: true },
  cuoio: { name: "Armatura di Cuoio", icon: "\u{1F9E5}", cat: "light", base: 11, dex: 99, start: true, perk: { hit: 1, text: "morbida e silenziosa: +1 a colpire" } },
  borchiato: { name: "Cuoio Borchiato", icon: "\u{1F9BA}", cat: "light", base: 12, dex: 99, start: true },
  pelle: { name: "Armatura di Pelle", icon: "\u{1F43B}", cat: "medium", base: 12, dex: 2, start: true, perk: { save: 1, hp: 4, text: "pelliccia spessa: +4 PF e +1 ai TS" } },
  giaco: { name: "Giaco di Maglia", icon: "\u26D3", cat: "medium", base: 13, dex: 2, start: true, perk: { hit: 1, text: "non intralcia i movimenti: +1 a colpire" } },
  scaglie: { name: "Corazza di Scaglie", icon: "\u{1F409}", cat: "medium", base: 14, dex: 2, start: true },
  mezza: { name: "Mezza Armatura", icon: "\u{1F6E1}", cat: "medium", base: 15, dex: 2 },
  anelli: { name: "Cotta ad Anelli", icon: "\u26D3", cat: "heavy", base: 14, dex: 0, start: true, perk: { save: 1, hp: 4, text: "anelli larghi, si respira: +4 PF e +1 ai TS" } },
  maglia: { name: "Cotta di Maglia", icon: "\u26D3", cat: "heavy", base: 16, dex: 0, start: true },
  stecche: { name: "Armatura a Stecche", icon: "\u{1F6E1}", cat: "heavy", base: 17, dex: 0 },
  piastre: { start: true, name: "Armatura Completa di Piastre", icon: "\u{1F3F0}", cat: "heavy", base: 18, dex: 0 }
};
var HEAVY_ARMOR_TEXT = "ingombro per tiro: 50% normale, 25% -1 a colpire, 25% svantaggio";
var ARMOR_PROF = {
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
  sorcerer: { cats: ["none", "mage"], shield: false, def: "magica" }
};
var TWO_HANDED = /* @__PURE__ */ new Set(["ascia_bip", "maglio", "arco_lungo", "balestra_l"]);
var armorProf = (cls) => ARMOR_PROF[cls] || ARMOR_PROF.fighter;
var canWear = (cls, key) => !!ARMORS[key] && armorProf(cls).cats.includes(ARMORS[key].cat) && !(armorProf(cls).no || []).includes(key);
var armorChoices = (cls) => Object.keys(ARMORS).filter((k) => ARMORS[k].start && canWear(cls, k));
var shieldOk = (cls, weaponKey) => armorProf(cls).shield && !TWO_HANDED.has(weaponKey);
function heroDefense(cls, st, g = {}) {
  const dex = st.dex || 0;
  const ai = g.armorItem && g.armorItem.kind === "armor" && canWear(cls, g.armorItem.base) ? g.armorItem : null;
  let key = ai ? ai.base : g.armor;
  if (!ai && !(canWear(cls, key) && ARMORS[key].start)) key = armorProf(cls).def;
  const ar = ARMORS[key];
  let ac;
  if (ar.cat === "unarmored") ac = 10 + dex + (st[kitOf(cls).unarmored] || 0);
  else ac = ar.base + (ar.dex === 0 ? 0 : Math.min(dex, ar.dex)) + (ai?.plus || 0);
  const si = g.shieldItem && g.shieldItem.kind === "shield" ? g.shieldItem : null;
  const canShield = shieldOk(cls, g.weapon);
  const shield = canShield && (!!si || g.shield !== false);
  if (shield) ac += 2 + (si?.plus || 0);
  const parts = [ai, shield ? si : null].filter(Boolean);
  const perk = ar.perk || {};
  return {
    ac,
    key,
    cat: ar.cat,
    ...ar.cat === "heavy" ? { attackPenalty: HEAVY_ARMOR_TEXT } : {},
    shield,
    canShield,
    perk: ar.perk || null,
    hitBonus: perk.hit || 0,
    dcBonus: perk.dc || 0,
    hpBonus: perk.hp || 0,
    armorName: ai ? ai.name : ar.name,
    armorIcon: ai ? ai.icon : ar.icon,
    shieldName: shield ? si ? si.name : "Scudo" : "",
    res: [...new Set(parts.flatMap((p) => p.res || []))],
    saveBonus: parts.reduce((t, p) => t + (p.saveBonus || 0), 0) + (perk.save || 0),
    thorns: parts.find((p) => p.thorns)?.thorns || null
  };
}
function weaponMod(cls, st, a) {
  if (!a?.wstat) return mainMod(cls, st);
  if (a.wstat === "fin") return Math.max(st.str || 0, st.dex || 0);
  return st[a.wstat] || 0;
}
var KITS = {
  fighter: {
    hitDie: 10,
    ac: 17,
    armor: "heavy",
    stat: "str",
    rec: ["str", "con"],
    extraAttacks: true,
    base: [{ id: "respiro", name: "Secondo Respiro", icon: "\u2764", kind: "heal", dice: "1d10", plusLevel: true, self: true, uses: 1 }, { id: "taunt", name: "Provocazione", icon: "\u{1F4E3}", kind: "taunt", save: "wis", turns: 2, uses: 2, info: "tutti i nemici: TS SAG (8 + competenza + FOR) o attaccano solo te per 2 turni" }],
    pool: [
      { id: "poderoso", useWeapon: true, name: "Attacco Poderoso", icon: "\u{1F4A5}", kind: "weapon", dice: "1d8", dmg: "slashing", bonusDmg: "lv/2", min: 1, uses: 2, info: "+met\xE0 livello ai danni" },
      { id: "parata", name: "Muro di Scudi", icon: "\u{1F6E1}", kind: "buff", buff: "ac", value: 3, turns: 2, self: true, min: 1, uses: 1 },
      { id: "impeto", useWeapon: true, name: "Impeto d'Azione", icon: "\u26A1", kind: "weapon", dice: "1d8", dmg: "slashing", bonusAttacks: 1, min: 3, uses: 1, info: "un attacco in pi\xF9" },
      { id: "stordire", useWeapon: true, name: "Colpo Stordente", icon: "\u{1F4AB}", kind: "weapon", dice: "1d8", dmg: "bludgeoning", stunSave: "con", min: 6, uses: 2, info: "colpito: TS COS o stordito" },
      { id: "turbine", name: "Turbine d'Acciaio", icon: "\u{1F32A}", kind: "save", dice: "3d8", dmg: "slashing", save: "dex", area: true, half: true, min: 9, uses: 1, grow: true },
      { id: "grido", name: "Grido di Battaglia", icon: "\u{1F4EF}", kind: "buff", buff: "adv", turns: 2, allParty: true, min: 12, uses: 1 }
    ]
  },
  barbarian: {
    hitDie: 12,
    ac: 15,
    armor: "unarmored",
    unarmored: "con",
    stat: "str",
    rec: ["str", "con"],
    extraAttacks: true,
    base: [{ id: "furia", name: "Furia", icon: "\u{1F4A2}", kind: "buff", buff: "rage", value: 2, turns: 3, self: true, uses: 1, info: "+2 danni, dimezza i danni fisici" }],
    pool: [
      { id: "irruento", useWeapon: true, name: "Attacco Irruento", icon: "\u{1F624}", kind: "weapon", dice: "1d12", dmg: "slashing", adv: true, selfDis: true, min: 1, uses: 3, info: "vantaggio per 2 turni, ma \u22122 CA per 2 turni" },
      { id: "lancio", name: "Ascia Lanciata", icon: "\u{1F3AF}", kind: "weapon", dice: "1d10", dmg: "slashing", min: 1 },
      { id: "ruggito", name: "Ruggito Feroce", icon: "\u{1F981}", kind: "debuff", area: true, turns: 1, min: 3, uses: 1, info: "tutti i nemici a svantaggio" },
      { id: "brutale", useWeapon: true, name: "Colpo Brutale", icon: "\u{1F528}", kind: "weapon", dice: "1d12", dmg: "slashing", rider: "1d12", riderDmg: "bludgeoning", min: 6, uses: 2, grow: true },
      { id: "inarrestabile", name: "Furia Inarrestabile", icon: "\u2764", kind: "heal", dice: "2d12", plusMod: true, self: true, min: 9, uses: 1 },
      { id: "terremoto", name: "Pestone Sismico", icon: "\u{1F30B}", kind: "save", dice: "3d8", dmg: "bludgeoning", save: "str", area: true, half: true, min: 12, uses: 1, grow: true }
    ]
  },
  paladin: {
    hitDie: 10,
    ac: 18,
    armor: "heavy",
    stat: "str",
    rec: ["str", "cha"],
    extraAttacks: true,
    healStat: "cha",
    base: [{ id: "mani", name: "Imposizione delle Mani", icon: "\u{1F64C}", kind: "heal", flat: "lv*5", uses: 1 }],
    pool: [
      { id: "punizione", useWeapon: true, name: "Punizione Divina", icon: "\u26A1", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "2d8", riderDmg: "radiant", min: 1, uses: 2, grow: true },
      { id: "benedizione", name: "Benedizione", icon: "\u2728", kind: "buff", buff: "adv", turns: 2, allParty: true, min: 1, uses: 1 },
      { id: "cura_p", name: "Cura Ferite", icon: "\u{1F49A}", kind: "heal", dice: "1d8", plusMod: true, min: 3, uses: 2, grow: true },
      { id: "aura", name: "Aura di Protezione", icon: "\u{1F31F}", kind: "buff", buff: "ac", value: 2, turns: 3, allParty: true, min: 6, uses: 1 },
      { id: "accecante", useWeapon: true, name: "Punizione Accecante", icon: "\u2600", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "3d8", riderDmg: "radiant", riderDis: 2, min: 9, uses: 1, info: "e il nemico a svantaggio" },
      { id: "sacra", name: "Arma Sacra", icon: "\u{1F5E1}", kind: "buff", buff: "dmg", value: 5, turns: 3, self: true, min: 12, uses: 1 }
    ]
  },
  ranger: {
    hitDie: 10,
    ac: 15,
    armor: "light",
    stat: "dex",
    rec: ["dex", "wis"],
    extraAttacks: true,
    healStat: "wis",
    base: [{ id: "marchio", name: "Marchio del Cacciatore", icon: "\u{1F3AF}", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, uses: 2 }],
    pool: [
      { id: "doppio", useWeapon: true, name: "Colpo Doppio", icon: "\u{1F3F9}", kind: "weapon", dice: "1d8", dmg: "piercing", bonusAttacks: 1, min: 1, uses: 2, info: "un attacco in pi\xF9" },
      { id: "cura_r", name: "Cura Ferite", icon: "\u{1F49A}", kind: "heal", dice: "1d8", plusMod: true, min: 1, uses: 1, grow: true },
      { id: "pioggia", name: "Pioggia di Frecce", icon: "\u{1F327}", kind: "save", dice: "2d8", dmg: "piercing", save: "dex", area: true, half: true, min: 3, uses: 1, grow: true },
      { id: "mimetismo", name: "Mimetismo", icon: "\u{1F343}", kind: "buff", buff: "adv", turns: 2, self: true, min: 3, uses: 2 },
      { id: "trappola", name: "Trappola Spinata", icon: "\u{1FAA4}", kind: "save", dice: "2d6", dmg: "piercing", save: "dex", stun: 1, min: 6, uses: 1 },
      { id: "fulminante", name: "Freccia Fulminante", icon: "\u26A1", kind: "save", dice: "4d8", dmg: "lightning", save: "dex", area: true, half: true, min: 9, uses: 1, grow: true }
    ]
  },
  monk: {
    hitDie: 8,
    ac: 16,
    armor: "unarmored",
    unarmored: "wis",
    stat: "dex",
    rec: ["dex", "wis"],
    extraAttacks: true,
    base: [{ id: "raffica", name: "Raffica di Colpi", icon: "\u{1F44A}", kind: "weapon", dice: "1d6", dmg: "bludgeoning", attacks: 2 }, { id: "schivata", name: "Schivata Paziente", icon: "\u{1F300}", kind: "buff", buff: "ac", value: 4, turns: 1, self: true, uses: 2 }],
    pool: [
      { id: "ki", name: "Colpo Ki", icon: "\u2734", kind: "weapon", dice: "1d10", dmg: "force", min: 1, uses: 3 },
      { id: "vento", name: "Passo del Vento", icon: "\u{1F4A8}", kind: "buff", buff: "adv", turns: 2, self: true, min: 1, uses: 2 },
      { id: "stordente", name: "Pugno Stordente", icon: "\u{1F4AB}", kind: "save", dice: "1d6", dmg: "bludgeoning", save: "con", stun: 1, min: 3, uses: 2 },
      { id: "integrita", name: "Integrit\xE0 del Corpo", icon: "\u{1F9D8}", kind: "heal", flat: "lv*3", self: true, min: 6, uses: 1 },
      { id: "ondata", name: "Onda di Ki", icon: "\u{1F30A}", kind: "save", dice: "3d10", dmg: "force", save: "dex", area: true, half: true, min: 9, uses: 1, grow: true },
      { id: "palmo", name: "Palmo Tremante", icon: "\u{1F590}", kind: "save", dice: "6d10", dmg: "necrotic", save: "con", half: true, min: 12, uses: 1 }
    ]
  },
  rogue: {
    hitDie: 8,
    ac: 15,
    armor: "light",
    stat: "dex",
    rec: ["dex", "con"],
    // 2026-11-10: l'Attacco Furtivo scatta da solo (motore: una volta per round sul primo colpo d'arma a segno,
    // con vantaggio o con un altro eroe in piedi nel gruppo). Colpo Mirato dà il vantaggio per farlo scattare.
    base: [{ id: "mirato", name: "Colpo Mirato", icon: "\u{1F3AF}", kind: "buff", buff: "adv", turns: 2, self: true, uses: 3, info: "vantaggio per 2 turni: l'Attacco Furtivo scatta anche da solo" }],
    pool: [
      { id: "nascondersi", name: "Nascondersi", icon: "\u{1FAE5}", kind: "buff", buff: "adv", turns: 2, self: true, min: 1, uses: 2 },
      { id: "veleno_r", name: "Lama Avvelenata", icon: "\u2620", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, min: 1, uses: 2 },
      { id: "basso", useWeapon: true, name: "Colpo Basso", icon: "\u{1F9B5}", kind: "weapon", dice: "1d8", dmg: "piercing", riderDis: 2, min: 3, uses: 2, info: "il nemico a svantaggio" },
      { id: "prodigiosa", name: "Schivata Prodigiosa", icon: "\u{1F938}", kind: "buff", buff: "ac", value: 4, turns: 1, self: true, min: 3, uses: 2 },
      { id: "fumogena", name: "Bomba Fumogena", icon: "\u{1F4A8}", kind: "debuff", area: true, turns: 2, inflict: { key: "blinded" }, min: 6, uses: 1, info: "tutti i nemici accecati (svantaggio, e li colpisci con vantaggio)" },
      { id: "assassinare", useWeapon: true, name: "Assassinare", icon: "\u{1F5E1}", kind: "weapon", dice: "1d8", dmg: "piercing", adv: true, rider: "4d6", riderDmg: "piercing", min: 9, uses: 1, grow: true }
    ]
  },
  wizard: {
    hitDie: 6,
    ac: 12,
    armor: "light",
    stat: "int",
    rec: ["int", "dex"],
    base: [{ id: "dardo_fuoco", name: "Dardo di Fuoco", icon: "\u{1F525}", kind: "spell", dice: "1d10", dmg: "fire", scale: true, inflict: { key: "burn", chance: 15 }, info: "e a volte brucia" }, { id: "dardo_inc", name: "Dardo Incantato", icon: "\u2728", kind: "missile", dice: "3d4", flat: 3, dmg: "force", uses: 3, grow: true }],
    pool: [
      { id: "raggio_gelo", name: "Raggio di Gelo", icon: "\u2744", kind: "spell", dice: "1d8", dmg: "cold", scale: true, min: 1, inflict: { key: "slow", chance: 50, turns: 1 }, info: "e a volte rallenta" },
      { id: "scudo", name: "Scudo", icon: "\u{1F6E1}", kind: "buff", buff: "ac", value: 5, turns: 1, self: true, min: 1, uses: 2 },
      { id: "mani_w", name: "Mani Brucianti", icon: "\u{1F590}", kind: "save", dice: "3d6", dmg: "fire", save: "dex", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "acida", name: "Freccia Acida", icon: "\u{1F9EA}", kind: "spell", dice: "4d4", dmg: "acid", min: 3, uses: 2, grow: true },
      { id: "palla_fuoco", name: "Palla di Fuoco", icon: "\u2604", kind: "save", dice: "8d6", dmg: "fire", save: "dex", area: true, half: true, min: 6, uses: 1, grow: true },
      { id: "ipnosi", name: "Trama Ipnotica", icon: "\u{1F300}", kind: "save", dice: "0d1", dmg: "psychic", save: "wis", area: true, inflict: { key: "paralyzed" }, min: 6, uses: 1, info: "chi fallisce resta paralizzato (TS a ogni turno)" },
      { id: "cono_freddo", name: "Cono di Freddo", icon: "\u{1F9CA}", kind: "save", dice: "8d8", dmg: "cold", save: "con", area: true, half: true, min: 9, uses: 1, grow: true }
    ]
  },
  sorcerer: {
    hitDie: 6,
    ac: 12,
    armor: "light",
    stat: "cha",
    rec: ["cha", "con"],
    base: [{ id: "fiotto", name: "Fiotto di Fuoco", icon: "\u{1F525}", kind: "spell", dice: "1d10", dmg: "fire", scale: true, inflict: { key: "burn", chance: 15 }, info: "e a volte brucia" }, { id: "mani_br", name: "Mani Brucianti", icon: "\u{1F590}", kind: "save", dice: "3d6", dmg: "fire", save: "dex", area: true, half: true, uses: 2, grow: true }],
    pool: [
      { id: "veleno", name: "Spruzzo Velenoso", icon: "\u2620", kind: "save", dice: "1d12", dmg: "poison", save: "con", scale: true, min: 1, inflict: { key: "poison" }, info: "chi fallisce resta avvelenato" },
      { id: "scudo_s", name: "Scudo", icon: "\u{1F6E1}", kind: "buff", buff: "ac", value: 5, turns: 1, self: true, min: 1, uses: 2 },
      { id: "gemello", name: "Dardo Gemello", icon: "\u26A1", kind: "spell", dice: "1d10", dmg: "lightning", attacks: 2, min: 3, uses: 2, info: "due raggi" },
      { id: "fulmine", name: "Fulmine", icon: "\u{1F329}", kind: "save", dice: "8d6", dmg: "lightning", save: "dex", area: true, half: true, min: 6, uses: 1, grow: true },
      { id: "catena", name: "Catena di Fulmini", icon: "\u26D3", kind: "save", dice: "10d8", dmg: "lightning", save: "dex", area: true, half: true, min: 12, uses: 1 }
    ]
  },
  warlock: {
    hitDie: 8,
    ac: 13,
    armor: "light",
    stat: "cha",
    rec: ["cha", "con"],
    base: [{ id: "deflagrazione", name: "Deflagrazione Occulta", icon: "\u{1F441}", kind: "spell", dice: "1d10", dmg: "force", scale: true }, { id: "maleficio", name: "Maleficio", icon: "\u{1FA78}", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, uses: 2 }],
    pool: [
      { id: "agathys", name: "Armatura di Agathys", icon: "\u{1F9CA}", kind: "buff", buff: "ac", value: 3, turns: 3, self: true, min: 1, uses: 1 },
      { id: "hadar", name: "Braccia di Hadar", icon: "\u{1F419}", kind: "save", dice: "2d6", dmg: "necrotic", save: "str", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "vampiro", name: "Tocco Vampirico", icon: "\u{1F987}", kind: "spell", dice: "3d6", dmg: "necrotic", drain: true, min: 3, uses: 2, grow: true, info: "ti cura di met\xE0 del danno" },
      { id: "paura", name: "Paura", icon: "\u{1F631}", kind: "debuff", area: true, turns: 2, inflict: { key: "frightened" }, min: 6, uses: 1, info: "tutti i nemici spaventati (svantaggio)" },
      { id: "fame", name: "Fame di Hadar", icon: "\u{1F311}", kind: "save", dice: "4d6", dmg: "cold", save: "con", area: true, half: true, min: 9, uses: 1, grow: true },
      { id: "dito", name: "Dito della Morte", icon: "\u2620", kind: "save", dice: "7d8", flat: 20, dmg: "necrotic", save: "con", half: true, min: 15, uses: 1 }
    ]
  },
  druid: {
    hitDie: 8,
    ac: 14,
    armor: "light",
    stat: "wis",
    rec: ["wis", "con"],
    base: [{ id: "rovi", name: "Frusta di Rovi", icon: "\u{1F33F}", kind: "spell", dice: "1d6", dmg: "piercing", scale: true }, { id: "cura_d", name: "Cura Ferite di Gruppo", icon: "\u{1F49A}", kind: "heal_all", dice: "1d8", plusMod: true, uses: 3, info: "cura tutti gli alleati: 1d8 + SAG \xB7 3 usi per sala" }],
    pool: [
      { id: "onda", name: "Onda Tonante", icon: "\u{1F30A}", kind: "save", dice: "2d8", dmg: "thunder", save: "con", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "pelle", name: "Pelle di Corteccia", icon: "\u{1F333}", kind: "buff", buff: "ac", value: 3, turns: 3, min: 1, uses: 1 },
      { id: "lama_fiamma", name: "Lama di Fiamma", icon: "\u{1F525}", kind: "spell", dice: "3d6", dmg: "fire", min: 3, uses: 3, grow: true },
      { id: "luna", name: "Raggio di Luna", icon: "\u{1F319}", kind: "save", dice: "2d10", dmg: "radiant", save: "con", half: true, min: 3, uses: 2, grow: true },
      { id: "richiamo", name: "Richiamo del Fulmine", icon: "\u26A1", kind: "save", dice: "3d10", dmg: "lightning", save: "dex", half: true, min: 6, uses: 2, grow: true },
      { id: "tempesta", name: "Tempesta di Ghiaccio", icon: "\u{1F328}", kind: "save", dice: "4d6", dmg: "cold", save: "dex", area: true, half: true, min: 9, uses: 1, grow: true, inflict: { key: "frozen", left: 1 }, info: "chi fallisce resta congelato 1 turno" }
    ]
  },
  cleric: {
    hitDie: 8,
    ac: 18,
    armor: "heavy",
    stat: "wis",
    rec: ["wis", "con"],
    base: [{ id: "cura_c", name: "Cura Ferite di Gruppo", icon: "\u{1F49A}", kind: "heal_all", dice: "1d8", plusMod: true, uses: 3, info: "cura tutti gli alleati: 1d8 + SAG \xB7 3 usi per sala" }],
    pool: [
      { id: "fiamma", name: "Fiamma Sacra", icon: "\u{1F56F}", kind: "save", dice: "1d8", plusMod: true, dmg: "radiant", damageTypes: ["radiant", "fire"], save: "dex", cantrip: true, min: 1, info: "Trucchetto infinito: 1d8 + SAG, met\xE0 radioso e met\xE0 fuoco \xB7 TS DES nega" },
      { id: "benedire_c", name: "Benedizione", icon: "\u2728", kind: "buff", buff: "adv", turns: 2, allParty: true, min: 1, uses: 1 },
      { id: "arma_spir", name: "Arma Spirituale", icon: "\u{1F5E1}", kind: "missile", dice: "1d8", dmg: "force", plusMod: true, min: 3, uses: 3, grow: true },
      { id: "parola", name: "Parola Guaritrice di Massa", icon: "\u{1F64F}", kind: "heal_all", dice: "1d4", plusMod: true, min: 3, uses: 2, grow: true },
      { id: "guardiani", name: "Guardiani Spirituali", icon: "\u{1F47C}", kind: "save", dice: "3d8", dmg: "radiant", save: "wis", area: true, half: true, min: 6, uses: 1, grow: true },
      { id: "guarigione", name: "Guarigione", icon: "\u{1F496}", kind: "heal", flat: "lv*6", min: 12, uses: 1 }
    ]
  },
  bard: {
    hitDie: 8,
    ac: 14,
    armor: "light",
    stat: "cha",
    rec: ["cha", "dex"],
    base: [
      { id: "beffa", name: "Beffa Crudele", icon: "\u{1F3AD}", kind: "save", dice: "1d6", dmg: "psychic", save: "wis", scale: true, dis: 1, info: "e svantaggio al bersaglio" },
      { id: "ispirazione", name: "Ispirazione Bardica", icon: "\u{1F3B6}", kind: "buff", buff: "inspire", value: 3, turns: 2, uses: 3, info: "un alleato: vantaggio e +3 danni per 2 turni" }
    ],
    pool: [
      { id: "parola_b", name: "Parola Guaritrice", icon: "\u{1F3B5}", kind: "heal", dice: "1d4", plusMod: true, min: 1, uses: 3, grow: true },
      { id: "onda_b", name: "Onda Tonante", icon: "\u{1F30A}", kind: "save", dice: "2d8", dmg: "thunder", save: "con", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "sussurri", name: "Sussurri Dissonanti", icon: "\u{1F442}", kind: "save", dice: "3d6", dmg: "psychic", save: "wis", half: true, min: 3, uses: 2, grow: true, inflict: { key: "confused", turns: 1 }, info: "chi fallisce resta confuso" },
      { id: "riposo", name: "Canto di Riposo", icon: "\u{1F3BC}", kind: "heal_all", dice: "1d8", plusMod: true, min: 3, uses: 1, grow: true },
      { id: "risata", name: "Risata Incontenibile", icon: "\u{1F602}", kind: "save", dice: "0d1", dmg: "psychic", save: "wis", stun: 1, min: 6, uses: 1, info: "chi fallisce resta stordito" }
    ]
  }
};
var SUBCLASS_COST = 2e3;
var SUBCLASS_LEVEL = 5;
var SUBCLASSES = {
  fighter: [
    {
      key: "campione",
      name: "Campione",
      icon: "\u{1F3C6}",
      desc: "Forza bruta e resistenza: colpi critici pi\xF9 frequenti.",
      passive: { critAt: 19, hpLv: 1 },
      passiveTxt: "critico con 19\u201320 \xB7 +1 PF per livello",
      actions: [
        { id: "sc_assalto", useWeapon: true, name: "Assalto del Campione", icon: "\u{1F3C6}", kind: "weapon", dice: "1d8", dmg: "slashing", adv: true, bonusDmg: "lv/2", min: 5, uses: 2, info: "a vantaggio, +met\xE0 livello ai danni" },
        { id: "sc_baluardo", name: "Ultimo Baluardo", icon: "\u2764", kind: "heal", dice: "3d10", plusLevel: true, self: true, min: 11, uses: 1 }
      ]
    },
    {
      key: "maestro",
      name: "Maestro di Battaglia",
      icon: "\u2694",
      desc: "Tattico: manovre che sbilanciano e spaventano.",
      passive: { wHit: 1 },
      passiveTxt: "+1 a colpire con le armi",
      actions: [
        { id: "sc_sbilancia", useWeapon: true, name: "Attacco Sbilanciante", icon: "\u{1F300}", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "1d8", riderDis: 2, min: 5, uses: 3, grow: true, info: "+1d8 (dado di superiorit\xE0) e il nemico a svantaggio" },
        { id: "sc_minaccia", useWeapon: true, name: "Colpo Minaccioso", icon: "\u{1F631}", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "2d8", inflict: { key: "frightened", turns: 2 }, min: 11, uses: 2, info: "+2d8 e il nemico spaventato" }
      ]
    }
  ],
  barbarian: [
    {
      key: "berserker",
      name: "Cammino del Berserker",
      icon: "\u{1FA93}",
      desc: "Furia cieca: colpi in pi\xF9 e terrore.",
      passive: { wDmg: 1 },
      passiveTxt: "+1 danni con le armi",
      actions: [
        { id: "sc_frenesia", useWeapon: true, name: "Frenesia", icon: "\u{1FA93}", kind: "weapon", dice: "1d12", dmg: "slashing", bonusAttacks: 1, min: 5, uses: 2, info: "un attacco in pi\xF9" },
        { id: "sc_intimida", name: "Presenza Intimidatoria", icon: "\u{1F631}", kind: "debuff", area: true, turns: 2, inflict: { key: "frightened" }, min: 11, uses: 1, info: "tutti i nemici spaventati" }
      ]
    },
    {
      key: "orso",
      name: "Totem dell'Orso",
      icon: "\u{1F43B}",
      desc: "Lo spirito dell'orso: in furia resisti quasi a tutto.",
      passive: { rageAll: true, hpLv: 1 },
      passiveTxt: "in Furia dimezzi TUTTI i danni (non psichici) \xB7 +1 PF per livello",
      actions: [
        { id: "sc_ruggito_orso", name: "Ruggito dell'Orso", icon: "\u{1F43B}", kind: "taunt", save: "wis", turns: 2, min: 5, uses: 1, info: "tutti i nemici: TS SAG o attaccano solo te per 2 turni" },
        { id: "sc_pelle_orso", name: "Pelle d'Orso", icon: "\u{1F6E1}", kind: "buff", buff: "ac", value: 3, turns: 3, self: true, min: 11, uses: 1 }
      ]
    }
  ],
  paladin: [
    {
      key: "devozione",
      name: "Giuramento di Devozione",
      icon: "\u{1F607}",
      desc: "Il cavaliere luminoso: protegge e scaccia il male.",
      passive: { heal: 2, save: 1 },
      passiveTxt: "+2 a ogni cura \xB7 +1 ai TS",
      actions: [
        { id: "sc_arma_cons", name: "Arma Consacrata", icon: "\u2728", kind: "buff", buff: "adv", turns: 3, self: true, min: 5, uses: 1, info: "vantaggio per 3 turni" },
        { id: "sc_scaccia", name: "Scacciare gli Empi", icon: "\u2600", kind: "save", dice: "3d8", dmg: "radiant", save: "wis", area: true, half: true, inflict: { key: "frightened", turns: 2 }, min: 11, uses: 1, grow: true, info: "tutti i nemici \xB7 chi fallisce \xE8 spaventato" }
      ]
    },
    {
      key: "vendetta",
      name: "Giuramento di Vendetta",
      icon: "\u{1F5E1}",
      desc: "Il castigo: un nemico alla volta, fino in fondo.",
      passive: { wDmg: 1, wHit: 1 },
      passiveTxt: "+1 a colpire e ai danni con le armi",
      actions: [
        { id: "sc_inimicizia", name: "Voto di Inimicizia", icon: "\u{1F3AF}", kind: "buff", buff: "dmg", value: 4, turns: 3, self: true, min: 5, uses: 1 },
        { id: "sc_vendicativa", useWeapon: true, name: "Punizione Vendicativa", icon: "\u26A1", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "4d8", riderDmg: "radiant", inflict: { key: "frightened", turns: 2 }, min: 11, uses: 1, grow: true, info: "+4d8 radiosi e il nemico spaventato" }
      ]
    }
  ],
  ranger: [
    {
      key: "cacciatore",
      name: "Cacciatore",
      icon: "\u{1F3F9}",
      desc: "Specialista dei bersagli grossi e dei gruppi.",
      passive: { wDmg: 2 },
      passiveTxt: "+2 danni con le armi",
      actions: [
        { id: "sc_colosso", useWeapon: true, name: "Uccisore di Colossi", icon: "\u{1F5FF}", kind: "weapon", dice: "1d8", dmg: "piercing", rider: "2d8", min: 5, uses: 2, grow: true, info: "+2d8 al primo colpo" },
        { id: "sc_turbine_c", name: "Turbine del Cacciatore", icon: "\u{1F32A}", kind: "save", dice: "4d8", dmg: "slashing", save: "dex", area: true, half: true, min: 11, uses: 1, grow: true }
      ]
    },
    {
      key: "bestie",
      name: "Signore delle Bestie",
      icon: "\u{1F43A}",
      desc: "Un lupo combatte al tuo fianco.",
      passive: { ac: 1 },
      passiveTxt: "+1 CA (il lupo ti copre)",
      actions: [
        { id: "sc_lupo", name: "Morso del Lupo", icon: "\u{1F43A}", kind: "spell", dice: "2d6", dmg: "piercing", attacks: 2, min: 5, uses: 3, info: "il lupo morde due volte" },
        { id: "sc_branco", name: "Assalto del Branco", icon: "\u{1F43E}", kind: "save", dice: "4d8", dmg: "piercing", save: "dex", area: true, half: true, inflict: { key: "slow", turns: 1 }, min: 11, uses: 1, grow: true, info: "tutti i nemici \xB7 chi fallisce \xE8 rallentato" }
      ]
    }
  ],
  monk: [
    {
      key: "mano_aperta",
      name: "Via della Mano Aperta",
      icon: "\u270B",
      desc: "Maestro dei colpi a mano nuda.",
      passive: { wHit: 1, wDmg: 1 },
      passiveTxt: "+1 a colpire e ai danni coi colpi",
      actions: [
        { id: "sc_mano", useWeapon: true, name: "Tecnica della Mano Aperta", icon: "\u270B", kind: "weapon", dice: "1d6", dmg: "bludgeoning", attacks: 2, riderDis: 1, min: 5, uses: 3, info: "due colpi e il nemico a svantaggio" },
        { id: "sc_quiete", name: "Onda di Quiete", icon: "\u{1F9D8}", kind: "save", dice: "5d10", dmg: "force", save: "con", half: true, stun: 1, min: 11, uses: 1, info: "chi fallisce resta stordito" }
      ]
    },
    {
      key: "ombra",
      name: "Via dell'Ombra",
      icon: "\u{1F311}",
      desc: "Ninja: buio, inganno e colpi alle spalle.",
      passive: { ac: 1 },
      passiveTxt: "+1 CA",
      actions: [
        { id: "sc_passo_ombra", name: "Passo d'Ombra", icon: "\u{1F311}", kind: "buff", buff: "adv", turns: 2, self: true, min: 5, uses: 2 },
        { id: "sc_oscurita", name: "Oscurit\xE0", icon: "\u2B1B", kind: "debuff", area: true, turns: 2, inflict: { key: "blinded" }, min: 11, uses: 1, info: "tutti i nemici accecati" }
      ]
    }
  ],
  rogue: [
    {
      key: "assassino",
      name: "Assassino",
      icon: "\u{1F5E1}",
      desc: "Colpi letali e veleni.",
      passive: { critAt: 19 },
      passiveTxt: "critico con 19\u201320",
      actions: [
        { id: "sc_letale", useWeapon: true, name: "Colpo Letale", icon: "\u{1F5E1}", kind: "weapon", dice: "1d8", dmg: "piercing", attacks: 1, singleAttack: true, adv: true, rider: "sneak", riderDmg: "piercing", bonusDmg: "lv/2", min: 5, uses: 1, info: "a vantaggio: attacco furtivo + met\xE0 livello" },
        { id: "sc_veleno_ass", useWeapon: true, name: "Veleno dell'Assassino", icon: "\u2620", kind: "weapon", dice: "1d8", dmg: "piercing", rider: "3d6", riderDmg: "poison", inflict: { key: "poison" }, min: 11, uses: 2, info: "+3d6 veleno e il nemico avvelenato" }
      ]
    },
    {
      key: "mistificatore",
      name: "Mistificatore Arcano",
      icon: "\u{1F52E}",
      desc: "Ladro e mago: dardi e illusioni.",
      passive: { save: 1, sDmg: 1 },
      passiveTxt: "+1 ai TS \xB7 +1 danni degli incantesimi",
      actions: [
        { id: "sc_dardo_mist", name: "Dardo Incantato", icon: "\u2728", kind: "missile", dice: "3d4", flat: 3, dmg: "force", min: 5, uses: 2, grow: true },
        { id: "sc_trama", name: "Trama Ingannevole", icon: "\u{1F52E}", kind: "save", dice: "4d6", dmg: "psychic", save: "wis", half: true, inflict: { key: "confused", turns: 1 }, min: 11, uses: 1, grow: true, info: "chi fallisce resta confuso" }
      ]
    }
  ],
  wizard: [
    {
      key: "invocazione",
      name: "Scuola di Invocazione",
      icon: "\u{1F525}",
      desc: "Pura potenza distruttiva.",
      passive: { sDmg: "mod" },
      passiveTxt: "+INT ai danni degli incantesimi",
      actions: [
        { id: "sc_sfera", name: "Sfera Instabile", icon: "\u{1F4A5}", kind: "save", dice: "6d6", dmg: "force", save: "dex", area: true, half: true, min: 5, uses: 1, grow: true },
        { id: "sc_sovraccarico", name: "Raggio Sovraccarico", icon: "\u26A1", kind: "spell", dice: "6d10", dmg: "force", min: 11, uses: 1, grow: true }
      ]
    },
    {
      key: "abiurazione",
      name: "Scuola di Abiurazione",
      icon: "\u{1F530}",
      desc: "Barriere e protezioni per tutto il gruppo.",
      passive: { ac: 1, hpLv: 1 },
      passiveTxt: "+1 CA \xB7 +1 PF per livello (guardia arcana)",
      actions: [
        { id: "sc_guardia", name: "Guardia Arcana", icon: "\u{1F530}", kind: "buff", buff: "ac", value: 3, turns: 2, allParty: true, min: 5, uses: 1 },
        { id: "sc_contro", name: "Controincantesimo", icon: "\u{1F6AB}", kind: "debuff", area: true, turns: 2, min: 11, uses: 1, info: "tutti i nemici a svantaggio" }
      ]
    }
  ],
  sorcerer: [
    {
      key: "draconica",
      name: "Stirpe Draconica",
      icon: "\u{1F409}",
      desc: "Sangue di drago: scaglie e soffio.",
      passive: { ac: 1, hpLv: 1, sDmg: 2, res: ["fire"] },
      passiveTxt: "+1 CA \xB7 +1 PF per livello \xB7 +2 danni degli incantesimi \xB7 resiste al fuoco",
      actions: [
        { id: "sc_soffio", name: "Soffio del Drago", icon: "\u{1F409}", kind: "save", dice: "4d6", dmg: "fire", save: "dex", area: true, half: true, min: 5, uses: 1, grow: true },
        { id: "sc_presenza", name: "Presenza Draconica", icon: "\u{1F631}", kind: "debuff", area: true, turns: 2, inflict: { key: "frightened" }, min: 11, uses: 1, info: "tutti i nemici spaventati" }
      ]
    },
    {
      key: "selvaggia",
      name: "Magia Selvaggia",
      icon: "\u{1F300}",
      desc: "Il caos che ribolle nel sangue.",
      passive: { critAt: 19 },
      passiveTxt: "critico con 19\u201320 anche con gli incantesimi",
      actions: [
        { id: "sc_caos", name: "Ondata del Caos", icon: "\u{1F300}", kind: "save", dice: "3d10", dmg: "force", save: "dex", area: true, half: true, inflict: { key: "confused", turns: 1 }, min: 5, uses: 1, grow: true, info: "tutti i nemici \xB7 chi fallisce \xE8 confuso" },
        { id: "sc_fortuna", name: "Fortuna Piegata", icon: "\u{1F340}", kind: "buff", buff: "adv", turns: 2, allParty: true, min: 11, uses: 1 }
      ]
    }
  ],
  warlock: [
    {
      key: "immondo",
      name: "Il Signore Immondo",
      icon: "\u{1F608}",
      desc: "Patto infernale: fuoco e dannazione.",
      passive: { res: ["fire"], hpLv: 1 },
      passiveTxt: "resiste al fuoco \xB7 +1 PF per livello",
      actions: [
        { id: "sc_inferno", name: "Fuoco Infernale", icon: "\u{1F525}", kind: "save", dice: "8d6", dmg: "fire", save: "dex", area: true, half: true, min: 5, uses: 1, grow: true },
        { id: "sc_scagliare", name: "Scagliare all'Inferno", icon: "\u{1F608}", kind: "spell", dice: "10d10", dmg: "psychic", min: 11, uses: 1 }
      ]
    },
    {
      key: "antico",
      name: "Il Grande Antico",
      icon: "\u{1F419}",
      desc: "Patto con l'ignoto: follia e menti spezzate.",
      passive: { save: 1, res: ["psychic"], dc: 1 },
      passiveTxt: "+1 ai TS \xB7 +1 alla CD \xB7 resiste ai danni psichici",
      actions: [
        { id: "sc_follia", name: "Sussurri della Follia", icon: "\u{1F441}", kind: "save", dice: "3d6", dmg: "psychic", save: "wis", area: true, half: true, inflict: { key: "confused", turns: 1 }, min: 5, uses: 1, grow: true, info: "tutti i nemici \xB7 chi fallisce \xE8 confuso" },
        { id: "sc_domina", name: "Mente Dominata", icon: "\u{1F419}", kind: "save", dice: "4d10", dmg: "psychic", save: "wis", half: true, stun: 1, min: 11, uses: 1, info: "chi fallisce resta stordito" }
      ]
    }
  ],
  druid: [
    {
      key: "luna",
      name: "Circolo della Luna",
      icon: "\u{1F315}",
      desc: "Forme selvatiche da combattimento.",
      passive: { ac: 1, hpLv: 2 },
      passiveTxt: "+1 CA \xB7 +2 PF per livello",
      actions: [
        { id: "sc_artigli", name: "Artigli dell'Orso", icon: "\u{1F43B}", kind: "spell", dice: "2d8", dmg: "slashing", attacks: 2, min: 5, uses: 3, info: "due zampate" },
        { id: "sc_elementale", name: "Forma Elementale", icon: "\u{1F30B}", kind: "buff", buff: "dmg", value: 6, turns: 3, self: true, min: 11, uses: 1 }
      ]
    },
    {
      key: "terra",
      name: "Circolo della Terra",
      icon: "\u{1F33F}",
      desc: "La magia del luogo: rovi e ristoro.",
      passive: { sDmg: 2, heal: 2 },
      passiveTxt: "+2 danni degli incantesimi \xB7 +2 a ogni cura",
      actions: [
        { id: "sc_spine", name: "Crescita di Spine", icon: "\u{1F335}", kind: "save", dice: "4d6", dmg: "piercing", save: "dex", area: true, half: true, inflict: { key: "slow", turns: 1 }, min: 5, uses: 2, grow: true, info: "tutti i nemici \xB7 chi fallisce \xE8 rallentato" },
        { id: "sc_ristoro", name: "Ristoro della Terra", icon: "\u{1F33F}", kind: "heal_all", dice: "2d8", plusMod: true, min: 11, uses: 1, grow: true }
      ]
    }
  ],
  cleric: [
    {
      key: "vita",
      name: "Dominio della Vita",
      icon: "\u{1F496}",
      desc: "Il guaritore: ogni cura vale di pi\xF9.",
      passive: { heal: "2+lv/2" },
      passiveTxt: "+2 + met\xE0 livello a ogni cura",
      actions: [
        { id: "sc_preserva", name: "Preservare la Vita", icon: "\u{1F496}", kind: "heal_all", flat: "lv*2", min: 5, uses: 1, info: "cura tutti di 2 \xD7 livello" },
        { id: "sc_benedetto", name: "Guaritore Benedetto", icon: "\u{1F64F}", kind: "heal", flat: "lv*4", min: 11, uses: 1 }
      ]
    },
    {
      key: "tempesta",
      name: "Dominio della Tempesta",
      icon: "\u26C8",
      desc: "Tuono e fulmine al servizio del dio.",
      passive: { thorns: { dice: "2d8", dmg: "lightning", chance: 50 } },
      passiveTxt: "Ira della Tempesta: chi ti colpisce in mischia, 50% di prendere 2d8 da fulmine",
      actions: [
        { id: "sc_fulmine_c", name: "Fulmine Distruttivo", icon: "\u{1F329}", kind: "save", dice: "3d8", dmg: "lightning", save: "dex", area: true, half: true, min: 5, uses: 1, grow: true },
        { id: "sc_tuono", name: "Ira del Tuono", icon: "\u26C8", kind: "save", dice: "4d10", dmg: "thunder", save: "con", half: true, stun: 1, min: 11, uses: 1, info: "chi fallisce resta stordito" }
      ]
    }
  ],
  bard: [
    {
      key: "sapienza",
      name: "Collegio della Sapienza",
      icon: "\u{1F4DC}",
      desc: "Parole che feriscono e segreti rubati.",
      passive: { save: 1, dc: 1 },
      passiveTxt: "+1 ai TS \xB7 +1 alla CD",
      actions: [
        { id: "sc_taglienti", name: "Parole Taglienti", icon: "\u{1F5EF}", kind: "debuff", turns: 2, min: 5, uses: 2, info: "un nemico a svantaggio per 2 turni" },
        { id: "sc_segreti", name: "Segreti Magici", icon: "\u{1F4DC}", kind: "save", dice: "8d6", dmg: "fire", save: "dex", area: true, half: true, min: 11, uses: 1, grow: true, info: "una Palla di Fuoco rubata" }
      ]
    },
    {
      key: "valore",
      name: "Collegio del Valore",
      icon: "\u{1F6E1}",
      desc: "Il bardo guerriero, in prima linea.",
      passive: { ac: 1, wHit: 1, extraAttack: true },
      passiveTxt: "attacco extra con le armi \xB7 +1 CA \xB7 +1 a colpire",
      actions: [
        { id: "sc_ispira_b", name: "Ispirazione in Battaglia", icon: "\u{1F3B6}", kind: "buff", buff: "dmg", value: 4, turns: 2, allParty: true, min: 5, uses: 1, info: "+4 danni a tutto il gruppo" },
        { id: "sc_colpo_b", useWeapon: true, name: "Colpo Incantato", icon: "\u26A1", kind: "weapon", dice: "1d8", dmg: "piercing", rider: "2d8", riderDmg: "thunder", min: 11, uses: 2, grow: true, info: "+2d8 da tuono al primo colpo" }
      ]
    }
  ]
};
var subclassesOf = (cls) => SUBCLASSES[cls] || [];
var subclassOf = (cls, key) => key ? subclassesOf(cls).find((s) => s.key === key) || null : null;
function heroSubclass(cls, hero) {
  const key = hero?.subclass;
  if (!key || !(hero.subclasses || []).includes(key) || heroLevel(hero) < SUBCLASS_LEVEL) return null;
  return subclassOf(cls, key);
}
function subNum(v, lv = 1, mod = 0) {
  if (typeof v === "number") return v;
  return String(v || "0").split("+").reduce((t, p) => {
    p = p.trim();
    if (p === "mod") return t + mod;
    if (p === "lv") return t + lv;
    if (p === "lv/2") return t + Math.floor(lv / 2);
    return t + (Number(p) || 0);
  }, 0);
}
var DEFEND = { id: "difesa", name: "Difendersi", icon: "\u{1F6E1}", kind: "defend", info: "+4 CA fino al tuo prossimo turno" };
var kitOf = (cls) => KITS[cls] || KITS.fighter;
var poolFor = (cls, lv) => kitOf(cls).pool.filter((a) => (a.min || 1) <= lv);
var VERSATILE = { spada_lunga: "1d10", bastone: "1d8" };
var GRIP_CLASSES = /* @__PURE__ */ new Set(["fighter", "barbarian", "paladin", "ranger", "rogue", "monk"]);
var canTwoHand = (cls, weapon) => GRIP_CLASSES.has(cls) && !!VERSATILE[weapon];
var GRIP = { id: "grip", kind: "grip", icon: "\u270A", free: true };
function heroActions(cls, lv, picks = [], weapon = null, plus = 0, wItem = null, twoHand = false, subclass = null) {
  const k = kitOf(cls);
  const w0 = weaponOf(cls, weapon), two = twoHand && canTwoHand(cls, w0.key);
  const w = two ? { ...w0, dice: VERSATILE[w0.key] } : w0;
  const withWeapon = (a) => a.useWeapon ? { ...a, ...a.attacks || w.attacks ? { attacks: a.attacks || w.attacks } : {}, ...a.rider === "sneak" ? { info: `un colpo: ${w.dice} +${sneakDiceOf(lv)}d6` } : {}, dice: w.dice, dmg: w.dmg, wstat: w.wstat, ranged: !!w.ranged, plus: plus || 0, ...wItem?.fx ? { wfx: wItem.fx } : {} } : a;
  const chosen = k.pool.filter((a) => picks.includes(a.id) && (a.min || 1) <= lv);
  const sub = lv >= SUBCLASS_LEVEL ? subclassOf(cls, subclass) : null;
  const subActs = sub ? sub.actions.filter((a) => (a.min || 1) <= lv).map((a) => ({ ...a, sub: sub.key })) : [];
  const grip = canTwoHand(cls, w0.key) ? [{ ...GRIP, name: two ? "Torna a una mano" : "Impugna a due mani", info: two ? `${w0.dice} \xB7 riprendi lo scudo` : `${VERSATILE[w0.key]} \xB7 niente scudo` }] : [];
  const wa = weaponAction(w, plus, wItem);
  if (cls === "rogue") wa.info += ` \xB7 Furtivo +${sneakDiceOf(lv)}d6 (1 per round, con vantaggio o un alleato)`;
  return [wa, ...k.base.map(withWeapon), ...chosen.map(withWeapon), ...subActs.map(withWeapon), ...grip, DEFEND];
}
function heroStats(hero) {
  const out = {};
  STAT_KEYS.forEach((k) => {
    out[k] = Math.min(STAT_MAX, (Number(hero?.stats?.[k]) || 0) + (Number(hero?.asi?.[k]) || 0));
  });
  return out;
}
var mainMod = (cls, st) => st[kitOf(cls).stat] || 0;
var hpPending = (hero) => Math.max(0, heroLevel(hero) - (Array.isArray(hero?.hpRolls) ? hero.hpRolls.length : 0));
function heroMaxHp(cls, lv, st, rolls = []) {
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
var heroDc = (cls, lv, st) => 8 + profOf(lv) + mainMod(cls, st);
var heroHit = (cls, lv, st) => profOf(lv) + mainMod(cls, st);
var sneakDiceOf = (lv) => 1 + Math.floor((Math.max(1, lv) - 1) / 2);
function attacksOf(cls, lv, action) {
  if (action.singleAttack) return 1;
  const extra = lv >= 5 && kitOf(cls).extraAttacks && action.kind === "weapon" ? 1 + (cls === "fighter" && lv >= 11) : 0;
  return (action.attacks || 1) + extra + (action.bonusAttacks || 0);
}
function validNewHero(cls, stats, pick2, weapon, armor = null) {
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
  if (!poolFor(cls, 1).some((a) => a.id === pick2)) return "Scegli un'abilit\xE0 o un incantesimo di partenza.";
  return null;
}
var RESPEC_COST = 500;
function validRespec(cls, hero, stats, picks) {
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
  let excess = Math.max(0, STAT_KEYS.reduce((t, k) => t + base[k], 0) - STAT_BUDGET);
  for (const k of STAT_KEYS) {
    const m = Math.min(base[k], excess);
    base[k] -= m;
    asi[k] += m;
    excess -= m;
  }
  const list = [...new Set(Array.isArray(picks) ? picks.map(String) : [])];
  const pool = poolFor(cls, lv);
  if (!list.length) return { error: "Scegli almeno un'abilit\xE0 o un incantesimo." };
  if (list.length > picksAllowed(lv)) return { error: `Puoi scegliere al massimo ${picksAllowed(lv)} abilit\xE0.` };
  if (!list.every((id) => pool.some((a) => a.id === id))) return { error: "Abilit\xE0 non disponibile al tuo livello." };
  return { stats: base, asi, picks: list };
}
var POOL_IDS = new Set(Object.values(KITS).flatMap((k) => k.pool.map((a) => a.id)));
function heroPending(hero) {
  const lv = heroLevel(hero);
  const asiSpent = STAT_KEYS.reduce((t, k) => t + (Number(hero?.asi?.[k]) || 0), 0);
  return { level: lv, asi: Math.max(0, asiEarned(lv) - asiSpent), picks: Math.max(0, picksAllowed(lv) - (hero?.picks || []).filter((id) => POOL_IDS.has(id)).length) };
}

// src/data/segreteItems.js
var FLOOR_COINS_DIE = 20;
var RARITY = {
  common: { it: "Comune", w: 60, color: "#d8ccb4" },
  uncommon: { it: "Non comune", w: 28, color: "#6fd48a" },
  rare: { it: "Raro", w: 10, color: "#6fb6ff" },
  veryRare: { it: "Molto raro", w: 2, color: "#c48bff" }
};
var BASE_ITEMS = {
  pozione: { name: "Pozione di Guarigione", icon: "\u{1F9EA}", kind: "heal", dice: "2d4", flat: 2, price: 25, daily: 3, rarity: "common", desc: "\u2764 +2d4+2 PF \xB7 te o un alleato in piedi" },
  pozione_magg: { name: "Pozione di Guarigione Maggiore", icon: "\u{1F377}", kind: "heal", dice: "4d4", flat: 4, price: 90, daily: 2, rarity: "uncommon", desc: "\u2764 +4d4+4 PF \xB7 te o un alleato in piedi" },
  pozione_sup: { name: "Pozione di Guarigione Superiore", icon: "\u2697", kind: "heal", dice: "8d4", flat: 8, price: 250, daily: 1, rarity: "rare", desc: "\u2764 +8d4+8 PF \xB7 te o un alleato in piedi" },
  tonico: { name: "Tonico Purificante", icon: "\u{1F33F}", kind: "cleanse", price: 40, daily: 2, rarity: "common", desc: "Te o un alleato: toglie \u{1F525} \u2620 \u{1F9CA} \u26A1 \u{1F631} \u{1F311} \u{1F40C} \u{1F635} \u{1F32B} \u{1F4AB} \u{1F624} \xB7 non \u{1F5FF}" },
  bomba_acqua: { name: "Bomba d'Acqua", icon: "\u{1F4A7}", kind: "cleanse_party", price: 200, daily: 1, rarity: "uncommon", desc: "Tutto il gruppo: toglie \u{1F525} \u{1F40C} \u26A1" },
  panacea: { name: "Panacea", icon: "\u2728", kind: "panacea", price: 150, daily: 1, rarity: "rare", desc: "Te o un alleato: toglie tutti gli stati, anche \u{1F5FF}" },
  pelle_pietra: { name: "Pozione di Pelle di Pietra", icon: "\u{1FAA8}", kind: "buff", buff: "ac", value: 2, turns: 3, price: 90, daily: 1, rarity: "uncommon", desc: "\u{1F6E1} +2 CA \xB7 3 round \xB7 te o un alleato" },
  eroismo: { name: "Pozione dell'Eroismo", icon: "\u{1F9B8}", kind: "buff", buff: "adv", turns: 2, price: 100, daily: 1, rarity: "uncommon", desc: "\u{1F3AF} vantaggio \xB7 2 round \xB7 te o un alleato" },
  fuoco_alch: { name: "Fuoco dell'Alchimista", icon: "\u{1F525}", kind: "throw", dice: "2d6", dmg: "fire", price: 50, daily: 2, rarity: "common", desc: "\u{1F525} 2d6 fuoco \xB7 colpisce sempre" },
  acido: { name: "Fiala d'Acido", icon: "\u{1FAD9}", kind: "throw", dice: "2d6", dmg: "acid", price: 50, daily: 2, rarity: "common", desc: "\u{1F9EA} 2d6 acido \xB7 colpisce sempre" },
  acqua_santa: { name: "Acqua Santa", icon: "\u{1F4A7}", kind: "throw", dice: "2d8", dmg: "radiant", price: 80, daily: 1, rarity: "uncommon", desc: "\u2728 2d8 radiosi \xB7 colpisce sempre" },
  pietra_tuono: { name: "Pietra del Tuono", icon: "\u{1F4A5}", kind: "throw_area", dice: "2d6", dmg: "thunder", save: "con", dc: 13, price: 140, daily: 1, rarity: "uncommon", desc: "\u{1F4A5} 2d6 tuono a tutti i nemici \xB7 TS COS CD 13 per met\xE0" },
  piuma_fenice: { name: "Piuma della Fenice", icon: "\u{1FAB6}", kind: "revive", pct: 50, price: 400, daily: 1, rarity: "rare", desc: "Rialza un alleato a terra con met\xE0 PF" }
};
var WEAPON_ITEMS = {};
Object.entries(WEAPONS).forEach(([k, w]) => {
  WEAPON_ITEMS[`${k}_1`] = { name: `${w.name} +1`, icon: w.icon, kind: "weapon", base: k, plus: 1, price: 1200, daily: 1, rarity: "rare", group: "weapon", desc: `${w.dice} \xB7 +1 a colpire e ai danni` };
  WEAPON_ITEMS[`${k}_2`] = { name: `${w.name} +2`, icon: w.icon, kind: "weapon", base: k, plus: 2, price: 0, rarity: "veryRare", group: "weapon", desc: `${w.dice} \xB7 +2 a colpire e ai danni \xB7 solo nelle Segrete` };
});
var SPECIAL_WEAPONS = {
  lingua_salamandra: {
    name: "Lingua di Salamandra",
    icon: "\u{1F525}",
    base: "spada_lunga",
    plus: 1,
    rarity: "rare",
    dungeons: ["magma"],
    fx: { extra: ["1d4", "fire"], burn: { chance: 20, dice: "1d4", turns: 2 } },
    desc: "Spada lunga +1 ancora calda di lava."
  },
  maglio_fabbro: {
    name: "Maglio del Fabbro Pazzo",
    icon: "\u2692",
    base: "maglio",
    plus: 1,
    rarity: "rare",
    dungeons: ["magma"],
    minDiff: "medio",
    fx: { burn: { chance: 20, dice: "1d6", turns: 2 } },
    desc: "Maglio +1. \xABBasta scaldarlo un altro pochino.\xBB"
  },
  zanna_vyrskaal: {
    name: "Zanna di Vyrskaal",
    icon: "\u2744",
    base: "ascia_bip",
    plus: 1,
    rarity: "veryRare",
    dungeons: ["ghiaccio"],
    minDiff: "leggenda",
    fx: { extra: ["1d6", "cold"], slow: { chance: 25, turns: 1 } },
    desc: "Ascia bipenne +1: un dente della Regina di Brina."
  },
  lancia_pescatore: {
    name: "Fiocina del Pescatore di Annegati",
    icon: "\u{1F531}",
    base: "lancia",
    plus: 1,
    rarity: "rare",
    dungeons: ["palude", "ghiaccio"],
    fx: { slow: { chance: 30, turns: 1 } },
    desc: "Lancia +1 con l'uncino."
  },
  spina_palude: {
    name: "Spina della Palude",
    icon: "\u{1F33F}",
    base: "stocco",
    plus: 0,
    rarity: "uncommon",
    dungeons: ["palude"],
    fx: { poison: { chance: 30, dice: "1d4", turns: 3 } },
    desc: "Stocco fatto da una spina gigante, sempre appiccicoso."
  },
  falce_ragno: {
    name: "Zampa del Ragno Gigante",
    icon: "\u{1F577}",
    base: "scimitarra",
    plus: 0,
    rarity: "uncommon",
    dungeons: ["caverna"],
    fx: { poison: { chance: 25, dice: "1d6", turns: 2 } },
    desc: "Scimitarra: il veleno del ragno c'\xE8 ancora."
  },
  arco_ratto: {
    name: "Arco del Ratto Ubriaco",
    icon: "\u{1F3F9}",
    base: "arco_lungo",
    plus: 0,
    rarity: "uncommon",
    dungeons: ["caverna"],
    fx: { multi: { double: 25, none: 10 } },
    desc: "Arco lungo di un ratto mannaro con un debole per il sidro."
  },
  stiletto_rimorso: {
    name: "Stiletto del Rimorso",
    icon: "\u{1F5E1}",
    base: "stocco",
    plus: 1,
    rarity: "rare",
    dungeons: ["segrete"],
    fx: { crit: 19 },
    desc: "Stocco +1 di un carceriere pentito: sussurra \xABscusa\xBB."
  },
  catene_mazzafrusto: {
    name: "Mazzafrusto delle Catene",
    icon: "\u26D3",
    base: "mazzafrusto",
    plus: 1,
    rarity: "rare",
    dungeons: ["segrete"],
    fx: { slow: { chance: 25, turns: 1 } },
    desc: "Mazzafrusto +1: le catene si attorcigliano da sole."
  },
  mazza_penitenza: {
    name: "Mazza della Penitenza",
    icon: "\u{1FA78}",
    base: "mazza",
    plus: 1,
    rarity: "rare",
    dungeons: ["tempio"],
    fx: { extra: ["1d6", "radiant"], drain: 50 },
    desc: "Mazza +1 di un culto dimenticato."
  },
  balestra_tobia: {
    name: "Balestra a Ripetizione di Zio Tobia",
    icon: "\u{1F3F9}",
    base: "balestra_l",
    plus: 0,
    rarity: "uncommon",
    dungeons: ["tempio"],
    fx: { multi: { double: 30, none: 5 } },
    desc: "Balestra leggera, invenzione di zio Tobia. Spesso funziona."
  },
  martello_brontola: {
    name: "Martello che Brontola",
    icon: "\u{1F528}",
    base: "martello",
    plus: 1,
    rarity: "rare",
    fx: { stun: { chance: 15 } },
    desc: "Martello da guerra +1 che borbotta insulti in nanico."
  },
  mestolo_nonna: {
    name: "Mestolo della Nonna",
    icon: "\u{1F944}",
    base: "bastone",
    plus: 0,
    rarity: "uncommon",
    fx: { extra: ["1d4", "bludgeoning"], stun: { chance: 10 } },
    desc: "Bastone: un mestolo enorme. Tutti ne hanno paura."
  }
};
var ARMOR_ITEMS = {
  arm_mezza: { name: "Mezza Armatura", icon: "\u{1F6E1}", kind: "armor", base: "mezza", plus: 0, price: 500, daily: 1, rarity: "uncommon", group: "armor", desc: "Armatura media: CA 15 + DES (massimo +2)." },
  arm_stecche: { name: "Armatura a Stecche", icon: "\u{1F6E1}", kind: "armor", base: "stecche", plus: 0, price: 700, daily: 1, rarity: "uncommon", group: "armor", desc: "Armatura pesante: CA 17." },
  arm_piastre: { name: "Armatura di Piastre", icon: "\u{1F3F0}", kind: "armor", base: "piastre", plus: 0, price: 1500, daily: 1, rarity: "rare", group: "armor", desc: "La migliore armatura pesante: CA 18." },
  arm_cuoio_1: { name: "Armatura di Cuoio +1", icon: "\u{1F9E5}", kind: "armor", base: "cuoio", plus: 1, price: 0, rarity: "rare", group: "armor", desc: "Leggera: CA 12 + DES." },
  arm_borchiato_1: { name: "Cuoio Borchiato +1", icon: "\u{1F9BA}", kind: "armor", base: "borchiato", plus: 1, price: 0, rarity: "rare", group: "armor", desc: "Leggera: CA 13 + DES." },
  arm_scaglie_1: { name: "Corazza di Scaglie +1", icon: "\u{1F409}", kind: "armor", base: "scaglie", plus: 1, price: 0, rarity: "rare", group: "armor", desc: "Media: CA 15 + DES (massimo +2)." },
  arm_mezza_1: { name: "Mezza Armatura +1", icon: "\u{1F6E1}", kind: "armor", base: "mezza", plus: 1, price: 0, rarity: "veryRare", group: "armor", desc: "Media: CA 16 + DES (massimo +2)." },
  arm_maglia_1: { name: "Cotta di Maglia +1", icon: "\u26D3", kind: "armor", base: "maglia", plus: 1, price: 0, rarity: "rare", group: "armor", desc: "Pesante: CA 17." },
  arm_piastre_1: { name: "Armatura di Piastre +1", icon: "\u{1F3F0}", kind: "armor", base: "piastre", plus: 1, price: 0, rarity: "veryRare", group: "armor", desc: "Pesante: CA 19." },
  // a tema, dei dungeon
  scaglie_salamandra: { name: "Scaglie della Salamandra", icon: "\u{1F98E}", kind: "armor", base: "scaglie", plus: 0, rarity: "rare", dungeons: ["magma"], res: ["fire"], desc: "\u{1F525} resistenza al fuoco \xB7 scaglie di salamandra." },
  pelliccia_lupo: { name: "Pelliccia del Lupo Invernale", icon: "\u{1F43A}", kind: "armor", base: "cuoio", plus: 0, rarity: "uncommon", dungeons: ["ghiaccio"], res: ["cold"], desc: "\u{1F9CA} resistenza al freddo \xB7 profuma di cane bagnato." },
  mezza_ghiaccio: { name: "Mezza Armatura del Ghiaccio Eterno", icon: "\u{1F9CA}", kind: "armor", base: "mezza", plus: 1, rarity: "veryRare", dungeons: ["ghiaccio"], minDiff: "medio", res: ["cold"], desc: "\u{1F9CA} resistenza al freddo \xB7 mezza armatura +1." },
  giaco_muschio: { name: "Giaco di Muschio", icon: "\u{1F344}", kind: "armor", base: "giaco", plus: 0, rarity: "uncommon", dungeons: ["palude"], res: ["poison"], desc: "\u2620 resistenza al veleno \xB7 giaco di muschio." },
  giubba_galline: { name: "Giubba del Ladro di Galline", icon: "\u{1F414}", kind: "armor", base: "borchiato", plus: 1, rarity: "rare", dungeons: ["caverna"], desc: "Cuoio borchiato +1 pieno di piume. Funziona." },
  catene_carceriere: { name: "Catene del Carceriere", icon: "\u26D3", kind: "armor", base: "maglia", plus: 0, rarity: "rare", dungeons: ["segrete"], res: ["necrotic"], desc: "\u{1F480} resistenza al necrotico \xB7 cotta di maglia." },
  piastre_guardiano: { name: "Piastre del Guardiano Sepolto", icon: "\u{1F3DB}", kind: "armor", base: "piastre", plus: 0, rarity: "veryRare", dungeons: ["tempio"], minDiff: "leggenda", saveBonus: 1, res: ["radiant"], desc: "CA 18 \xB7 +1 ai TS \xB7 \u2728 resistenza al radioso." },
  // scudi (Guerriero, Paladino, Chierico, Barbaro, Ranger, Druido con un'arma a una mano)
  scudo_1: { name: "Scudo +1", icon: "\u{1F6E1}", kind: "shield", plus: 1, price: 0, rarity: "rare", group: "armor", desc: "+3 CA invece di +2." },
  scudo_padella: { name: "Scudo-Padella", icon: "\u{1F373}", kind: "shield", plus: 0, rarity: "uncommon", thorns: { chance: 25, dice: "1d4", dmg: "bludgeoning" }, desc: "+2 CA \xB7 25%: chi ti colpisce prende 1d4." },
  scudo_brina: { name: "Scudo di Brina", icon: "\u2744", kind: "shield", plus: 0, rarity: "uncommon", dungeons: ["ghiaccio"], res: ["cold"], desc: "+2 CA \xB7 \u{1F9CA} resistenza al freddo." },
  scudo_magma: { name: "Scudo di Ossidiana", icon: "\u{1F30B}", kind: "shield", plus: 1, rarity: "rare", dungeons: ["magma"], minDiff: "medio", thorns: { chance: 25, dice: "1d6", dmg: "fire" }, desc: "+3 CA \xB7 25%: chi ti colpisce prende \u{1F525} 1d6." }
};
Object.values(SPECIAL_WEAPONS).forEach((w) => {
  w.kind = "weapon";
  w.price = 0;
  w.special = true;
});
Object.values(ARMOR_ITEMS).forEach((a) => {
  if (a.price == null) a.price = 0;
});
var ITEMS = { ...BASE_ITEMS, ...WEAPON_ITEMS, ...SPECIAL_WEAPONS, ...ARMOR_ITEMS };
var itemOf = (id) => {
  const it = ITEMS[id];
  if (!it) return null;
  return { id, ...it, ...it.kind === "armor" && ARMORS[it.base]?.cat === "heavy" ? { desc: `${it.desc || ""} / ${HEAVY_ARMOR_TEXT}.` } : {} };
};
var SHOP_ITEMS = Object.keys(ITEMS).filter((id) => ITEMS[id].price > 0);
var isGear = (it) => !!it && (it.kind === "weapon" || it.kind === "armor" || it.kind === "shield");
var battleItem = (id) => {
  const it = itemOf(id);
  return it && !isGear(it) ? it : null;
};
function gearUsers(it) {
  if (!it) return [];
  if (it.kind === "weapon") return Object.keys(WEAPON_CHOICES).filter((c) => WEAPON_CHOICES[c].includes(it.base));
  if (it.kind === "armor") return Object.keys(ARMOR_PROF).filter((c) => canWear(c, it.base));
  if (it.kind === "shield") return Object.keys(ARMOR_PROF).filter((c) => armorProf(c).shield);
  return [];
}
function itemTarget(it) {
  if (!it) return null;
  if (it.kind === "throw") return "foe";
  if (it.kind === "throw_area") return null;
  if (it.kind === "revive") return "downed";
  if (it.kind === "cleanse_party") return null;
  return "ally";
}
var coinsOf = (charData) => Math.max(0, Number(charData?.storyCoins) || 0);
var bagOf = (charData) => {
  const b = charData?.storyBag || {};
  const out = {};
  Object.entries(b).forEach(([k, n]) => {
    if (ITEMS[k] && Number(n) > 0) out[k] = Number(n);
  });
  return out;
};
var DROP_CHANCE = {
  minion: { coins: 20, coinDice: [1, 6], item: 5 },
  elite: { coins: 40, coinDice: [2, 6], item: 12 },
  boss: { coins: 75, coinDice: [4, 6], item: 30 }
};
var DIFF_RANK = { facile: 0, medio: 1, leggenda: 2 };
function dropPool(ctx = {}) {
  const { dungeon = null, rank = 0, bases = null, classes = null } = ctx;
  return Object.keys(ITEMS).filter((id) => {
    const it = ITEMS[id];
    if (it.dungeons && !it.dungeons.includes(dungeon)) return false;
    if (it.minDiff && (DIFF_RANK[it.minDiff] || 0) > rank) return false;
    if (it.kind === "weapon") return !bases || bases.includes(it.base);
    if (it.kind === "armor" || it.kind === "shield") return !classes || gearUsers(it).some((c) => classes.includes(c));
    return true;
  });
}
function dropWeights(ctx = {}, role = "minion") {
  const pool = dropPool(ctx);
  const boost = { ...role === "boss" ? { rare: 2, veryRare: 2.5 } : role === "elite" ? { rare: 1.4, veryRare: 1.5 } : {} };
  Object.entries(ctx.boost || {}).forEach(([k, v]) => {
    boost[k] = (boost[k] || 1) * v;
  });
  const gw = pool.filter((id) => ITEMS[id].group === "weapon").length || 1;
  const ga = pool.filter((id) => ITEMS[id].group === "armor").length || 1;
  return pool.map((id) => {
    const it = ITEMS[id];
    const w = RARITY[it.rarity].w * (boost[it.rarity] || 1);
    return [id, it.group === "weapon" ? w * 2 / gw : it.group === "armor" ? w * 1.5 / ga : w];
  });
}
function rollDropItem(rnd2, ctx = {}, role = "minion") {
  const ws = dropWeights(ctx, role);
  const tot = ws.reduce((t, [, w]) => t + w, 0);
  let r = rnd2() * tot;
  for (const [id, w] of ws) {
    r -= w;
    if (r <= 0) return id;
  }
  return ws.length ? ws[ws.length - 1][0] : "pozione";
}
var romeDay = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
function boughtToday(charData, id, day = romeDay()) {
  const d = charData?.storyShopDay;
  return d && d.day === day ? Number(d.n?.[id]) || 0 : 0;
}
var dailyLimit = (id) => Number(ITEMS[id]?.daily) || 1;
var GIFT_FEE = 50;
var GIFT_DAILY = 3;
var giftsToday = (charData, day = romeDay()) => charData?.storyGiftDay?.day === day ? Number(charData.storyGiftDay.n) || 0 : 0;
var CUSTOM_PREFIX = "x_";
var DMG_KEYS = ["slashing", "piercing", "bludgeoning", "fire", "cold", "lightning", "thunder", "acid", "poison", "necrotic", "radiant", "force", "psychic"];
var ITEM_KINDS = {
  weapon: { it: "Arma", icon: "\u2694" },
  armor: { it: "Armatura / veste", icon: "\u{1F6E1}" },
  shield: { it: "Scudo", icon: "\u{1F6E1}" },
  heal: { it: "Cura", icon: "\u{1F9EA}" },
  revive: { it: "Rianima", icon: "\u{1FAB6}" },
  cleanse: { it: "Purifica un alleato", icon: "\u{1F33F}" },
  cleanse_party: { it: "Purifica il gruppo", icon: "\u{1F4A7}" },
  panacea: { it: "Panacea (tutti gli stati)", icon: "\u2728" },
  buff: { it: "Potenziamento", icon: "\u{1F9B8}" },
  throw: { it: "Da lancio (un nemico)", icon: "\u{1F525}" },
  throw_area: { it: "Da lancio (tutti i nemici)", icon: "\u{1F4A5}" }
};
var num = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d;
};
var dice = (v, d = "1d6") => {
  const m = /^(\d{1,2})d(4|6|8|10|12|20)$/.exec(String(v || "").trim());
  return m ? `${Math.min(10, +m[1])}d${m[2]}` : d;
};
var dmgK = (v, d = "fire") => DMG_KEYS.includes(v) ? v : d;
var str = (v, n) => String(v || "").trim().slice(0, n);
var dmgList = (v) => [...new Set((Array.isArray(v) ? v : []).filter((k) => DMG_KEYS.includes(k)))];
var thornsOf = (t) => t && Number(t.chance) > 0 ? { chance: num(t.chance, 5, 100, 25), dice: dice(t.dice, "1d4"), dmg: dmgK(t.dmg, "bludgeoning") } : null;
function normalizeCustomItem(d = {}) {
  const kind = ITEM_KINDS[d.kind] ? d.kind : null;
  if (!kind) return null;
  const it = {
    name: str(d.name, 60) || "Oggetto senza nome",
    icon: str(d.icon, 8) || ITEM_KINDS[kind].icon,
    kind,
    custom: true,
    rarity: RARITY[d.rarity] ? d.rarity : "uncommon",
    desc: str(d.desc, 300),
    price: num(d.price, 0, 1e5, 0),
    daily: num(d.daily, 1, 10, 1),
    ...Array.isArray(d.dungeons) && d.dungeons.length ? { dungeons: d.dungeons.map((x) => str(x, 40)).filter(Boolean) } : {},
    ...DIFF_RANK[d.minDiff] ? { minDiff: d.minDiff } : {},
    ...str(d.look, 600) ? { look: str(d.look, 600) } : {}
  };
  if (kind === "weapon") {
    if (!WEAPONS[d.base]) return null;
    it.base = d.base;
    it.plus = num(d.plus, 0, 3, 0);
    it.special = true;
    const f = d.fx || {}, fx = {};
    if (f.extra?.[0]) fx.extra = [dice(f.extra[0], "1d4"), dmgK(f.extra[1])];
    for (const k of ["burn", "poison"]) if (f[k] && Number(f[k].chance) > 0) fx[k] = { chance: num(f[k].chance, 5, 100, 20), dice: dice(f[k].dice, "1d4"), turns: num(f[k].turns, 1, 4, 2) };
    if (f.slow && Number(f.slow.chance) > 0) fx.slow = { chance: num(f.slow.chance, 5, 100, 25), turns: num(f.slow.turns, 1, 3, 1) };
    if (f.stun && Number(f.stun.chance) > 0) fx.stun = { chance: num(f.stun.chance, 5, 50, 10) };
    if (fx.extra && Number(f.drain) > 0) fx.drain = num(f.drain, 10, 100, 50);
    if (Number(f.crit) >= 17 && Number(f.crit) <= 19) fx.crit = num(f.crit, 17, 19, 19);
    if (f.multi && Number(f.multi.double) > 0) fx.multi = { double: num(f.multi.double, 5, 50, 20), none: num(f.multi.none, 0, 30, 0) };
    if (Object.keys(fx).length) it.fx = fx;
  } else if (kind === "armor" || kind === "shield") {
    if (kind === "armor") {
      if (!ARMORS[d.base]) return null;
      it.base = d.base;
    }
    it.plus = num(d.plus, 0, 3, 0);
    const res = dmgList(d.res);
    if (res.length) it.res = res;
    if (Number(d.saveBonus) > 0) it.saveBonus = num(d.saveBonus, 1, 3, 1);
    const th = thornsOf(d.thorns);
    if (th) it.thorns = th;
  } else if (kind === "heal") {
    it.dice = dice(d.dice, "2d4");
    it.flat = num(d.flat, 0, 50, 0);
  } else if (kind === "revive") it.pct = num(d.pct, 10, 100, 50);
  else if (kind === "buff") {
    it.buff = d.buff === "adv" ? "adv" : "ac";
    if (it.buff === "ac") it.value = num(d.value, 1, 5, 2);
    it.turns = num(d.turns, 1, 5, 2);
  } else if (kind === "throw") {
    it.dice = dice(d.dice, "2d6");
    it.dmg = dmgK(d.dmg);
  } else if (kind === "throw_area") {
    it.dice = dice(d.dice, "2d6");
    it.dmg = dmgK(d.dmg);
    it.save = ["str", "dex", "con", "int", "wis", "cha"].includes(d.save) ? d.save : "dex";
    it.dc = num(d.dc, 8, 22, 13);
  }
  return it;
}
var customIds = [];
function registerCustomItems(list = []) {
  customIds.forEach((id) => {
    delete ITEMS[id];
  });
  customIds = [];
  list.forEach((d) => {
    if (!d?.id || !String(d.id).startsWith(CUSTOM_PREFIX) || d.hidden) return;
    const it = normalizeCustomItem(d);
    if (it) {
      ITEMS[d.id] = it;
      customIds.push(d.id);
    }
  });
  SHOP_ITEMS.splice(0, SHOP_ITEMS.length, ...Object.keys(ITEMS).filter((id) => ITEMS[id].price > 0));
  return customIds.length;
}

// src/data/arenaClassSprites.js
var ARENA_CLASSES = [
  { key: "fighter", it: "Guerriero", icon: "\u2694", look: "a battle-hardened human fighter in plate armour with a longsword and a heater shield" },
  { key: "barbarian", it: "Barbaro", icon: "\u{1FA93}", look: "a fierce barbarian in furs and leather straps, tribal tattoos, wielding a huge greataxe with both hands" },
  { key: "paladin", it: "Paladino", icon: "\u{1F6E1}", look: "a holy paladin in shining plate armour with a tabard bearing a sun emblem, a longsword raised and a shield" },
  { key: "ranger", it: "Ranger", icon: "\u{1F3F9}", look: "a hooded ranger in a green cloak and leather armour, drawing a longbow aimed toward the LEFT" },
  { key: "monk", it: "Monaco", icon: "\u{1F44A}", look: "a disciplined monk in simple wrapped robes, barefoot, in a martial arts fighting stance with fists raised" },
  { key: "rogue", it: "Ladro", icon: "\u{1F5E1}", look: "a stealthy rogue in a dark hooded leather outfit with a half mask, two daggers drawn" },
  { key: "wizard", it: "Mago", icon: "\u{1F9D9}", look: "a wizard in long blue robes with a pointed hat and a gnarled wooden staff, a spellbook at the belt, casting a spell" },
  { key: "sorcerer", it: "Stregone", icon: "\u{1F525}", look: "a sorcerer in elegant crimson robes with draconic markings on the skin, flames swirling around one hand" },
  { key: "warlock", it: "Warlock", icon: "\u{1F441}", look: "a warlock in a dark tattered coat with eldritch purple glyphs, holding a pact tome, purple eldritch energy in the other hand" },
  { key: "druid", it: "Druido", icon: "\u{1F33F}", look: "a druid in leaf and bark garments with antlers on the hood, holding a wooden staff entwined with vines" },
  { key: "cleric", it: "Chierico", icon: "\u2728", look: "a cleric in chain mail and white vestments with a holy symbol, a mace raised and a glowing hand" },
  { key: "bard", it: "Bardo", icon: "\u{1F3B5}", look: "a dashing bard in a feathered hat and a colourful doublet, holding a rapier and a lute on the back" }
];

// src/data/arenaWeek.js
var WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
var CLOSE_SHIFT_MS = 60 * 60 * 1e3;
function romeParts(now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    y: +get("year"),
    m: +get("month"),
    d: +get("day"),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0
  };
}
function currentWeekKey(now = /* @__PURE__ */ new Date()) {
  const { y, m, d, weekday } = romeParts(new Date(new Date(now).getTime() + CLOSE_SHIFT_MS));
  const monday = new Date(Date.UTC(y, m - 1, d) - weekday * 864e5);
  return monday.toISOString().slice(0, 10);
}

// src/data/segrete.js
var MAX_PARTY = 4;
var COMPANY = {
  1: { save: 0, hit: 0, hp: 0, coins: 1, xp: 1, chest: 0 },
  2: { save: 1, hit: 0, hp: 0, coins: 1.1, xp: 1.05, chest: 0 },
  3: { save: 1, hit: 1, hp: 0, coins: 1.2, xp: 1.1, chest: 0 },
  4: { save: 1, hit: 1, hp: 0.05, coins: 1.3, xp: 1.15, chest: 0.25 }
};
var companyOf = (n) => COMPANY[Math.max(1, Math.min(MAX_PARTY, Number(n) || 1))];
var pct = (m) => `+${Math.round((m - 1) * 100)}%`;
function companyLines(n) {
  const c = companyOf(n), out = [];
  if (c.save) out.push(`+${c.save} ai tiri salvezza`);
  if (c.hit) out.push(`+${c.hit} a colpire e alla CD`);
  if (c.hp) out.push(`+${Math.round(c.hp * 100)}% PF`);
  if (c.coins > 1) out.push(`${pct(c.coins)} Monete Antiche`);
  if (c.xp > 1) out.push(`${pct(c.xp)} PE`);
  if (c.chest) out.push(`scrigno: ${Math.round(c.chest * 100)}% di un oggetto in pi\xF9`);
  return out;
}
var AFK_DEFEND_MS = 5 * 60 * 1e3;
var ROOM_IDLE_MS = 3 * 60 * 60 * 1e3;
var DEFAULT_DUNGEONS = [
  { key: "segrete", name: "Le Segrete", icon: "\u26D3", desc: "Celle umide, catene e guardie che non dormono mai. Non morti e banditi." },
  { key: "caverna", name: "La Caverna", icon: "\u{1F573}", desc: "Gallerie strette nel buio: bestie, goblin e ragni giganti." },
  { key: "magma", name: "Caverna di Magma", icon: "\u{1F30B}", desc: "Fiumi di lava e aria che brucia: elementali del fuoco e salamandre." },
  // 2026-11-06
  { key: "ghiaccio", name: "Il Ghiacciaio Eterno", icon: "\u{1F9CA}", desc: "Gallerie di ghiaccio azzurro e vento che taglia: lupi dell'inverno, mefiti di brina e la Regina di Brina." },
  { key: "palude", name: "La Palude Marcia", icon: "\u{1F438}", desc: "Acqua nera, nebbia e fango che risucchia: annegati che si rialzano e troll che non muoiono mai del tutto." },
  { key: "tempio", name: "Il Tempio Sepolto", icon: "\u{1F3DB}", desc: "Rovine di un culto dimenticato sotto la sabbia: guardiani di pietra, morti inquieti e trappole antiche." },
  { key: "cripta", name: "La Cripta degli Echi", icon: "\u{1F480}", desc: "Catacombe di ossa e pietra nera, percorse da sussurri. Scheletri, spettri e il Cantore Sepolto.", tiles: { colors: "bone white, black stone, ghostly green", wall: "black stone burial niches filled with bones and skulls", floor: "cracked funeral slabs and scattered bones", ceil: "low vaulted crypt ceiling with carved skulls" } },
  { key: "forgia", name: "La Forgia della Tempesta", icon: "\u26A1", desc: "Una fucina di rame e ferro carica di fulmini. Costrutti, fabbri runici e il Colosso della Tempesta.", tiles: { colors: "dark iron, copper, electric blue", wall: "riveted dark iron panels with copper conduits and blue electrical coils", floor: "iron grates and copper runic circuits", ceil: "heavy iron beams and insulated copper cables" } },
  { key: "abisso", name: "L'Abisso Sommerso", icon: "\u{1F30A}", desc: "Un santuario sprofondato nel mare, fra coralli e riflessi turchesi. Predatori abissali e la Regina delle Maree.", tiles: { colors: "deep navy, turquoise, sea green", wall: "flooded temple stone covered in barnacles and dark coral", floor: "wet mosaic slabs with seaweed and shallow water", ceil: "dark stone arches under shimmering blue water" } }
];
var DIFFICULTIES = [
  { key: "facile", name: "Facile", icon: "\u{1F7E2}", rank: 0, minLevel: 1, hp: 1, dmg: 1, plus: 0, elite: 0.4, coins: 1, xp: 1, item: 1, chest: 1, boost: {}, desc: "Il dungeon di sempre: per tutti i livelli." },
  { key: "medio", name: "Medio", icon: "\u{1F7E1}", rank: 1, minLevel: 8, hp: 1.12, dmg: 1.08, plus: 0, elite: 0.5, coins: 1.5, xp: 1.3, item: 1.5, chest: 1.25, boost: { rare: 1.5, veryRare: 1.5 }, desc: "Mostri pi\xF9 duri e pi\xF9 \xE9lite. Pi\xF9 monete, PE e oggetti rari." },
  { key: "leggenda", name: "Leggenda", icon: "\u{1F534}", rank: 2, minLevel: 12, hp: 1.2, dmg: 1.12, plus: 1, elite: 0.55, coins: 2, xp: 1.6, item: 2, chest: 1.5, boost: { rare: 2, veryRare: 3 }, desc: "Solo per veterani: i mostri picchiano forte. Bottino doppio e oggetti che non escono altrove." }
];
var diffOf = (key) => DIFFICULTIES.find((d) => d.key === key) || DIFFICULTIES[0];
var BA = (name, diceNum, diceType, bonus, extra = {}) => ({ type: "attack", name, diceNum, diceType, bonus, hitMode: "hit", aoeShape: "single", dmgType: "", ...extra });
var MIMIC_MONSTER = {
  id: "mimic",
  name: "Mimic",
  icon: "\u{1F479}",
  role: "elite",
  size: "medium",
  level: 1,
  hp: 40,
  ac: 13,
  init: 0,
  save: 0,
  dungeons: [],
  desc: "Uno scrigno vivente con denti e lingua: appare solo nel tesoro finale (10%).",
  look: "A living wooden treasure chest mimic with iron bands, lid open as a huge mouth lined with sharp ivory teeth, a long purple tongue and sticky acidic pseudopods. Recognizable treasure chest silhouette, sinister dungeon monster, no humanoid body.",
  imageUrl: "",
  deadImageUrl: "",
  frontImageUrl: "",
  facing: "left",
  resistances: [],
  vulnerabilities: [],
  immunities: [],
  actions: [BA("Morso", 2, "d6", 5), BA("Pseudopode acido", 2, "d6", 5, { dmgType: "acido" })]
};
var BASE_MONSTERS = [
  MIMIC_MONSTER,
  {
    id: "base-lupo-invernale",
    name: "Lupo Invernale",
    icon: "\u{1F43A}",
    role: "minion",
    size: "medium",
    level: 2,
    hp: 15,
    ac: 13,
    init: 2,
    save: 1,
    dungeons: ["ghiaccio"],
    desc: "Lupo dal pelo bianco come la neve, caccia in branco e morde alle gambe.",
    resistances: ["cold"],
    vulnerabilities: ["fire"],
    immunities: [],
    actions: [BA("Morso Gelido", 1, "d8", 4, { dmgType: "ghiaccio" }), { type: "buff_adv", name: "Ululato del Branco", durationTurns: 2 }]
  },
  {
    id: "base-mefite-brina",
    name: "Mefite di Brina",
    icon: "\u2744",
    role: "minion",
    size: "small",
    level: 2,
    hp: 12,
    ac: 12,
    init: 2,
    save: 1,
    dungeons: ["ghiaccio"],
    desc: "Piccolo spirito dispettoso di ghiaccio, sputa schegge e soffia nevischio.",
    resistances: [],
    vulnerabilities: ["fire", "bludgeoning"],
    immunities: ["cold", "poison"],
    actions: [BA("Artiglio di Ghiaccio", 1, "d6", 3, { dmgType: "ghiaccio" }), BA("Soffio di Nevischio", 2, "d4", 0, { dmgType: "ghiaccio", hitMode: "save", aoeShape: "cone", saveAbility: "dex", saveDC: 11, halfOnSave: true })]
  },
  {
    id: "base-annegato",
    name: "Annegato",
    icon: "\u{1F9DF}",
    role: "minion",
    size: "medium",
    level: 1,
    hp: 16,
    ac: 10,
    init: 0,
    save: 0,
    dungeons: ["palude", "tempio"],
    desc: "Cadavere gonfio d'acqua che esce dal fango e trascina gi\xF9 chi afferra.",
    resistances: [],
    vulnerabilities: ["radiant"],
    immunities: ["poison"],
    actions: [BA("Pugno Fradicio", 1, "d6", 3, { dmgType: "fisico" }), BA("Morsa del Fango", 1, "d8", 3, { dmgType: "oscurit\xE0", inflict: { key: "slow", chance: 35, save: "str" } })]
  },
  {
    id: "base-basilisco",
    name: "Basilisco del Tempio",
    icon: "\u{1F98E}",
    role: "elite",
    size: "large",
    level: 4,
    hp: 40,
    ac: 15,
    init: 0,
    save: 2,
    dungeons: ["tempio"],
    desc: "Lucertolone a otto zampe che dorme fra le statue del tempio. Le statue, in effetti, sono i visitatori di prima.",
    resistances: [],
    vulnerabilities: [],
    immunities: ["poison"],
    actions: [BA("Morso Velenoso", 2, "d6", 4, { dmgType: "veleno" }), BA("Sguardo Pietrificante", 1, "d6", 0, { dmgType: "arcano", hitMode: "save", aoeShape: "single", saveAbility: "con", saveDC: 12, halfOnSave: true, inflict: { key: "petrified", chance: 40 } })]
  },
  {
    id: "base-troll-ghiacci",
    name: "Troll dei Ghiacci",
    icon: "\u{1F9CC}",
    role: "elite",
    size: "large",
    level: 4,
    hp: 45,
    ac: 14,
    init: 1,
    save: 2,
    dungeons: ["ghiaccio", "palude"],
    desc: "Troll enorme con la pelle coperta di brina: le ferite si richiudono, se non le bruci.",
    resistances: ["cold"],
    vulnerabilities: ["fire", "acid"],
    immunities: [],
    actions: [BA("Artigli", 2, "d6", 5), BA("Clava di Ghiaccio", 1, "d12", 5, { dmgType: "ghiaccio" }), { type: "heal", name: "Rigenerazione", diceNum: 2, diceType: "d6", bonus: 2 }]
  },
  {
    id: "base-regina-brina",
    name: "Vyrskaal, Regina di Brina",
    icon: "\u{1F409}",
    role: "boss",
    size: "huge",
    level: 6,
    hp: 90,
    ac: 16,
    init: 1,
    save: 4,
    dungeons: ["ghiaccio"],
    desc: "Giovane drago bianco che regna sul ghiacciaio: tutto quello che tocca diventa statua di ghiaccio.",
    resistances: [],
    vulnerabilities: ["fire"],
    immunities: ["cold"],
    actions: [
      BA("Morso", 2, "d10", 6),
      BA("Artigli di Brina", 2, "d6", 6, { dmgType: "ghiaccio" }),
      BA("Soffio Gelido", 6, "d8", 0, { dmgType: "ghiaccio", hitMode: "save", aoeShape: "cone", saveAbility: "con", saveDC: 15, halfOnSave: true }),
      { type: "buff_ca", name: "Corazza di Ghiaccio", acBonus: 2, durationTurns: 2 },
      { type: "debuff_dis", name: "Tormenta Accecante", durationTurns: 2 }
    ]
  },
  { id: "base-custode-ossa", name: "Custode d'Ossa", icon: "\u{1F480}", role: "minion", level: 2, hp: 16, ac: 13, init: 1, save: 1, dungeons: ["cripta"], desc: "Scheletro in armatura spezzata armato di una lancia d'osso.", resistances: [], vulnerabilities: ["bludgeoning", "radiant"], immunities: ["poison"], actions: [BA("Lancia d'Osso", 1, "d8", 4)] },
  { id: "base-spettro-eco", name: "Spettro degli Echi", icon: "\u{1F47B}", role: "elite", level: 4, hp: 38, ac: 14, init: 3, save: 3, dungeons: ["cripta"], desc: "Spirito incatenato che assorbe la luce delle torce.", resistances: ["necrotic", "cold"], vulnerabilities: ["radiant"], immunities: ["poison"], actions: [BA("Tocco Sepolcrale", 2, "d6", 5, { dmgType: "oscurit\xE0" }), { type: "debuff_dis", name: "Sussurri dei Morti", durationTurns: 2 }] },
  { id: "base-cantore-sepolto", name: "Il Cantore Sepolto", icon: "\u{1F451}", role: "boss", size: "large", level: 6, hp: 95, ac: 16, init: 2, save: 4, dungeons: ["cripta"], desc: "Re scheletrico con una corona d'ossa e una campana funebre al posto dello scettro.", resistances: ["necrotic"], vulnerabilities: ["radiant"], immunities: ["poison"], actions: [BA("Scettro d'Ossa", 2, "d8", 6), BA("Rintocco Funebre", 4, "d8", 0, { dmgType: "oscurit\xE0", hitMode: "save", aoeShape: "sphere", saveAbility: "wis", saveDC: 14, halfOnSave: true }), { type: "buff_ca", name: "Corteo delle Ossa", acBonus: 2, durationTurns: 2 }] },
  { id: "base-sentinella-rame", name: "Sentinella di Rame", icon: "\u{1F916}", role: "minion", level: 2, hp: 18, ac: 14, init: 0, save: 1, dungeons: ["forgia"], desc: "Automa di rame con una piccola bobina elettrica sul dorso.", resistances: ["lightning"], vulnerabilities: ["acid"], immunities: ["poison"], actions: [BA("Pugno di Rame", 1, "d8", 4), BA("Scintilla", 1, "d6", 4, { dmgType: "fulmine" })] },
  { id: "base-fabbro-runico", name: "Fabbro Runico", icon: "\u{1F528}", role: "elite", level: 4, hp: 44, ac: 15, init: 0, save: 3, dungeons: ["forgia"], desc: "Gigante corazzato con un martello attraversato da scariche blu.", resistances: ["fire"], vulnerabilities: ["cold"], immunities: [], actions: [BA("Martello della Forgia", 2, "d8", 5, { dmgType: "fulmine" }), { type: "buff_ca", name: "Piastre Runiche", acBonus: 2, durationTurns: 2 }] },
  { id: "base-colosso-tempesta", name: "Colosso della Tempesta", icon: "\u26A1", role: "boss", size: "huge", level: 6, hp: 100, ac: 16, init: 1, save: 4, dungeons: ["forgia"], desc: "Colosso di ferro e rame con un nucleo di fulmini imprigionati nel petto.", resistances: ["lightning", "fire"], vulnerabilities: ["acid"], immunities: ["poison"], actions: [BA("Maglio del Tuono", 2, "d10", 6), BA("Onda Elettrica", 4, "d8", 0, { dmgType: "fulmine", hitMode: "save", aoeShape: "sphere", saveAbility: "dex", saveDC: 14, halfOnSave: true }), { type: "buff_adv", name: "Sovraccarico", durationTurns: 2 }] },
  { id: "base-predatore-abissale", name: "Predatore Abissale", icon: "\u{1F41F}", role: "minion", level: 2, hp: 16, ac: 12, init: 3, save: 1, dungeons: ["abisso"], desc: "Pesce anfibio dai denti trasparenti che striscia fra i coralli.", resistances: ["cold"], vulnerabilities: ["lightning"], immunities: [], actions: [BA("Morso Abissale", 1, "d8", 4)] },
  { id: "base-guardiano-corallo", name: "Guardiano di Corallo", icon: "\u{1F980}", role: "elite", level: 4, hp: 46, ac: 16, init: -1, save: 2, dungeons: ["abisso"], desc: "Granchio gigante ricoperto di coralli affilati e conchiglie antiche.", resistances: ["cold", "slashing"], vulnerabilities: ["lightning", "bludgeoning"], immunities: [], actions: [BA("Chela di Corallo", 2, "d8", 5), BA("Getto di Salamoia", 2, "d6", 4, { dmgType: "veleno" })] },
  { id: "base-regina-maree", name: "Regina delle Maree", icon: "\u{1F419}", role: "boss", size: "huge", level: 6, hp: 96, ac: 15, init: 2, save: 4, dungeons: ["abisso"], desc: "Antica creatura tentacolare con una corona di coralli e occhi turchesi luminosi.", resistances: ["cold"], vulnerabilities: ["lightning"], immunities: ["poison"], actions: [BA("Tentacolo Abissale", 2, "d10", 6), BA("Onda delle Profondit\xE0", 4, "d8", 0, { dmgType: "ghiaccio", hitMode: "save", aoeShape: "cone", saveAbility: "str", saveDC: 14, halfOnSave: true }), { type: "debuff_dis", name: "Nube d'Inchiostro", durationTurns: 2 }] }
];
function mergeMonsters(docs = []) {
  const ids = new Set(docs.map((d) => d.id));
  return BASE_MONSTERS.filter((m) => !ids.has(m.id)).map((m) => ({ ...m, base: true })).concat(docs.map((d) => BASE_MONSTERS.some((m) => m.id === d.id) ? { ...BASE_MONSTERS.find((m) => m.id === d.id), ...d, base: true } : d)).filter((m) => !m.hidden);
}
var STORY_CLASSES = ARENA_CLASSES.map(({ key, it, icon }) => ({ key, it, icon }));
var heroOf = (charData, classKey) => charData?.storyChars?.[classKey] || null;
function storyLevelOf(charData, classKey) {
  const h = heroOf(charData, classKey);
  return h ? heroLevel(h) : 1;
}
function mergeDungeons(custom = []) {
  const map = new Map(DEFAULT_DUNGEONS.map((d) => [d.key, d]));
  custom.forEach((d) => {
    if (d?.key) map.set(d.key, { ...map.get(d.key) || {}, ...d });
  });
  return [...map.values()].filter((d) => !d.hidden && d.active !== false);
}
var DEFAULT_FLOORS = 3;
var MONSTER_SIZES = [
  { key: "tiny", label: "Minuscola", scale: 0.7 },
  { key: "small", label: "Piccola", scale: 0.85 },
  { key: "medium", label: "Media", scale: 1 },
  { key: "large", label: "Grande", scale: 1.3 },
  { key: "huge", label: "Enorme", scale: 1.6 },
  { key: "gargantuan", label: "Mastodontica", scale: 1.9 }
];
var defaultSize = (role) => role === "boss" ? "large" : "medium";
var sizeOf = (m) => MONSTER_SIZES.some((z) => z.key === m?.size) ? m.size : defaultSize(m?.role);
var DAILY_RUNS = 3;
var DAILY_TOTAL = Infinity;
var dailyTotalOf = (charData, day = romeDayKey()) => charData?.storyDaily?.day === day ? Number(charData.storyDaily.count) || 0 : 0;
var nextDailyPatch = (charData, day = romeDayKey()) => ({ day, count: dailyTotalOf(charData, day) + 1 });
var WEEKLY_RUNS = Infinity;
var RUN_COUNTS_AFTER = 2;
var romeDayKey = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
function runsOf(charData, cls, week = currentWeekKey(), day = romeDayKey()) {
  const r = charData?.storyClassRuns?.[cls];
  const weekCount = r && r.weekKey === week ? Number(r.count) || 0 : 0;
  const dayCount = r && r.day === day ? Number(r.dayCount) || 0 : 0;
  const total = dailyTotalOf(charData, day);
  const totalFull = total >= DAILY_TOTAL;
  return { weekCount, dayCount, total, totalFull, left: Math.max(0, DAILY_RUNS - dayCount), canRun: !totalFull && weekCount < WEEKLY_RUNS && dayCount < DAILY_RUNS };
}
function nextRunsPatch(charData, cls, week = currentWeekKey(), day = romeDayKey()) {
  const { weekCount, dayCount } = runsOf(charData, cls, week, day);
  return { weekKey: week, count: weekCount + 1, day, dayCount: dayCount + 1 };
}

// src/data/segreteEngine.js
var subP = (c) => c?.side === "h" && c.subclass ? subclassOf(c.cls, c.subclass)?.passive || {} : {};
var companyLinesTxt = (n) => companyLines(n).join(", ");
var LOG_MAX = 80;
var AFK_MS = 5 * 60 * 1e3;
var rnd = Math.random;
function withRng(fn, body) {
  const prev = rnd;
  rnd = fn;
  try {
    return body();
  } finally {
    rnd = prev;
  }
}
var die = (s) => 1 + Math.floor(rnd() * s);
var d20 = () => die(20);
function parseDice(str2) {
  const m = /^(\d+)d(\d+)$/.exec(String(str2 || "").trim());
  return m ? [Number(m[1]), Number(m[2])] : [1, 6];
}
function roll(n, s) {
  let t = 0;
  const r = [];
  for (let i = 0; i < n; i++) {
    const v = die(s);
    r.push(v);
    t += v;
  }
  return { t, r };
}
var pick = (arr) => arr[Math.floor(rnd() * arr.length)];
var WB_DMG = { acido: "acid", psichico: "psychic", tuono: "thunder", fuoco: "fire", ghiaccio: "cold", fulmine: "lightning", veleno: "poison", "oscurit\xE0": "necrotic", sacro: "radiant", fisico: "slashing", arcano: "force" };
var DMG_IT = { slashing: "taglienti", piercing: "perforanti", bludgeoning: "contundenti", fire: "da fuoco", cold: "da freddo", lightning: "da fulmine", thunder: "da tuono", acid: "da acido", poison: "da veleno", necrotic: "necrotici", radiant: "radiosi", force: "da forza", psychic: "psichici" };
function wbDmgType(a) {
  if (WB_DMG[a.dmgType]) return WB_DMG[a.dmgType];
  const n = String(a.name || "").toLowerCase();
  if (/fuoc|fiamm|brac|lava|incend/.test(n)) return "fire";
  if (/gel|ghiacc|brin/.test(n)) return "cold";
  if (/fulmin|scoss|elettr/.test(n)) return "lightning";
  if (/velen|tossic/.test(n)) return "poison";
  if (/acid/.test(n)) return "acid";
  if (/necro|ombra|oscur|morte/.test(n)) return "necrotic";
  if (/sacr|luce|radios/.test(n)) return "radiant";
  if (/morso|artigl|zann|pugnal|frecc|lancia|dard/.test(n)) return "piercing";
  if (/mazz|pugno|clava|schiacc|martell|coda/.test(n)) return "bludgeoning";
  return "slashing";
}
var PHYS = ["slashing", "piercing", "bludgeoning"];
var A = (name, diceNum, diceType, bonus, extra = {}) => ({ type: "attack", name, diceNum, diceType, bonus, hitMode: "hit", aoeShape: "single", ...extra });
var FALLBACK_MONSTERS = [
  { id: "fb-goblin", name: "Goblin", icon: "\u{1F47A}", role: "minion", level: 1, hp: 9, ac: 13, init: 2, save: 0, actions: [A("Scimitarra", 1, "d6", 4), A("Arco Corto", 1, "d6", 4, { dmgType: "" })] },
  { id: "fb-scheletro", name: "Scheletro", icon: "\u{1F480}", role: "minion", level: 1, hp: 13, ac: 13, init: 2, save: 0, vulnerabilities: ["bludgeoning"], immunities: ["poison"], actions: [A("Spada Corta", 1, "d6", 4)] },
  { id: "fb-ratto", name: "Ratto Gigante", icon: "\u{1F400}", role: "minion", level: 1, hp: 7, ac: 12, init: 2, save: 0, actions: [A("Morso", 1, "d4", 4, { dmgType: "veleno" })] },
  { id: "fb-orco", name: "Orco", icon: "\u{1F479}", role: "elite", size: "large", level: 3, hp: 30, ac: 13, init: 1, save: 2, actions: [A("Ascia Bipenne", 1, "d12", 5), { type: "buff_adv", name: "Grido di Guerra", durationTurns: 2 }] },
  { id: "fb-cultista", name: "Cultista", icon: "\u{1F9DF}", role: "elite", level: 3, hp: 22, ac: 12, init: 1, save: 2, actions: [A("Dardo Necrotico", 2, "d6", 5, { dmgType: "oscurit\xE0" }), { type: "heal", name: "Patto Oscuro", diceNum: 2, diceType: "d6", bonus: 2 }] },
  { id: "fb-capo", name: "Capoguerra Orco", icon: "\u{1F451}", role: "boss", level: 5, hp: 75, ac: 16, init: 2, save: 4, actions: [A("Ascia Spezzaossa", 2, "d10", 7), A("Turbine d'Acciaio", 2, "d8", 0, { hitMode: "save", aoeShape: "sphere", saveAbility: "dex", saveDC: 14, halfOnSave: true }), { type: "buff_ca", name: "Scudo di Ferro", acBonus: 2, durationTurns: 2 }] }
];
function makeHero(m) {
  const hero = m.hero || {};
  const lv = heroLevel(hero);
  const st = heroStats(hero);
  const picks = Array.isArray(hero.picks) ? hero.picks : [];
  const maxHp = heroMaxHp(m.cls, lv, st, hero.hpRolls || []);
  const wItem = itemOf(hero.weaponItem);
  const okItem = wItem?.kind === "weapon" && weaponChoices(m.cls).some((w) => w.key === wItem.base);
  const weaponKey = weaponOf(m.cls, okItem ? wItem.base : hero.weapon).key;
  const weaponPlus = okItem ? wItem.plus || 0 : 0;
  const def = heroDefense(m.cls, st, { armor: hero.armor, shield: hero.shield, weapon: weaponKey || weaponChoices(m.cls)[0]?.key, armorItem: itemOf(hero.armorItem), shieldItem: itemOf(hero.shieldItem) });
  const subc = heroSubclass(m.cls, hero);
  const sp = subc?.passive || {};
  const subHp = (sp.hpLv || 0) * lv;
  const thorns = def.thorns || sp.thorns || null;
  const res = [.../* @__PURE__ */ new Set([...def.res || [], ...sp.res || []])];
  const uses = {};
  heroActions(m.cls, lv, picks, weaponKey, weaponPlus, okItem ? wItem : null, false, subc?.key).forEach((a) => {
    if (a.uses) uses[a.id] = a.uses;
  });
  return {
    id: `h_${m.uid}`,
    side: "h",
    uid: m.uid,
    name: m.name,
    cls: m.cls,
    level: lv,
    img: m.avatar || "",
    ...subc ? { subclass: subc.key, subName: subc.name } : {},
    hp: maxHp + def.hpBonus + subHp,
    maxHp: maxHp + def.hpBonus + subHp,
    ac: def.ac + (sp.ac || 0),
    init: st.dex || 0,
    save: Math.floor(profOf(lv) / 2) + def.saveBonus + (sp.save || 0),
    st,
    ...def.hitBonus ? { armorHit: def.hitBonus } : {},
    ...def.dcBonus ? { armorDc: def.dcBonus } : {},
    picks,
    weapon: weaponKey,
    weaponPlus,
    ...okItem ? { wItem: wItem.id } : {},
    res,
    ...thorns ? { thorns } : {},
    armorCategory: def.cat,
    gear: { armor: def.armorName, shield: def.shieldName },
    // armatura speciale equipaggiata (2026-11-08): in prima persona cambia maniche e guanti
    ...hero.armorItem && itemOf(hero.armorItem)?.kind === "armor" ? { armorItem: hero.armorItem } : {},
    ...def.shield ? { shieldAc: 2 + (itemOf(hero.shieldItem)?.kind === "shield" ? itemOf(hero.shieldItem).plus || 0 : 0) } : {},
    fx: {},
    uses,
    // aiuto (2026-11-05): ha finito i dungeon di oggi/settimana con quella classe (o i 3 del giorno):
    // gioca per aiutare il gruppo ma non prende PE, monete, oggetti
    ...m.helper ? { helper: true } : {}
  };
}
var SOLO_XP_MULT = 0.75;
function xpGain(level, floors, diff = "facile", party = 2) {
  if (level >= MAX_STORY_LEVEL) return 0;
  return Math.round(XP_PER_ROOM * ((floors || 3) + 1) * diffOf(diff).xp * (party <= 1 ? SOLO_XP_MULT : companyOf(party).xp));
}
var ADAPT = { hpUp: 0.22, hpDown: 0.16, hpMin: 0.35, dmgPer: 0.55, hitPer: 0.36, bigBase: 0.3, bigPer: 0.55, multUp: 0.04, multDown: 0.12, multMin: 0.5, soloHp: 1.2, minionPer: 0.22 };
var CAPS = {
  minion: { hit: 3, dc: 11, dmg: 4, hp: 9, ac: 13, save: 1 },
  elite: { hit: 4, dc: 12, dmg: 6.5, hp: 18, ac: 14, save: 2 },
  boss: { hit: 5, dc: 13, dmg: 8, hp: 30, ac: 14, save: 3 },
  perLevel: { dmg: 0.32, hp: 0.42 }
};
function capsFor(role, partyLv, partySize) {
  const c = CAPS[role] || CAPS.minion;
  const L = Math.max(1, partyLv);
  const prof = 2 + Math.floor((L - 1) / 4);
  const big = role === "minion" ? 1 : ADAPT.bigBase + ADAPT.bigPer * partySize;
  return {
    hit: c.hit + prof - 2,
    dc: c.dc + prof - 2,
    dmg: c.dmg * (1 + CAPS.perLevel.dmg * (L - 1)),
    ac: c.ac + Math.floor((L - 1) / 3),
    save: c.save + prof - 2,
    hp: Math.round(c.hp * (1 + CAPS.perLevel.hp * (L - 1)) * big)
  };
}
var avgDice = (n, sides) => n * (sides + 1) / 2;
function makeFoe(src, idx, partySize, suffix, partyLv = 1) {
  const diff = partyLv - (Number(src.level) || 1);
  const lvScale = diff >= 0 ? 1 + ADAPT.hpUp * diff : Math.max(ADAPT.hpMin, 1 + ADAPT.hpDown * diff);
  const scale = (src.role === "minion" ? 1 + ADAPT.minionPer * (partySize - 1) : ADAPT.bigBase + ADAPT.bigPer * partySize) * lvScale;
  const cap = capsFor(src.role || "minion", partyLv, partySize);
  const maxHp = Math.max(1, Math.min(cap.hp, Math.round((Number(src.hp) || 10) * scale)));
  return {
    id: `f${idx}`,
    side: "f",
    name: suffix ? `${src.name} ${suffix}` : src.name,
    src: src.id,
    role: src.role || "minion",
    level: Number(src.level) || 1,
    hp: maxHp,
    maxHp,
    ac: cap.ac,
    init: Number(src.init) || 0,
    save: cap.save,
    img: src.imageUrl || "",
    deadImg: src.deadImageUrl || "",
    icon: src.icon || "",
    facing: src.facing || "left",
    size: sizeOf(src),
    cap: { hit: cap.hit, dc: cap.dc, dmg: cap.dmg },
    adapt: { mult: diff >= 0 ? 1 + ADAPT.multUp * diff : Math.max(ADAPT.multMin, 1 + ADAPT.multDown * diff), dmg: Math.round(diff * ADAPT.dmgPer), hit: Math.round(diff * ADAPT.hitPer), ac: diff > 0 ? Math.floor(diff / 3) : Math.ceil(diff / 3) },
    actions: (src.actions || []).slice(0, 5),
    res: src.resistances || [],
    vul: src.vulnerabilities || [],
    imm: src.immunities || [],
    fx: {},
    uses: {}
  };
}
var CROWD_CHANCE = 0.42;
function buildEncounter(bestiary, { floor, floors, partyLevel: partyLevel2, partySize, eliteChance = 0.4 }) {
  const boss = floor > floors;
  const own = bestiary.filter((m) => !m._anyBoss && m.id !== "mimic");
  const all = own.length ? own : FALLBACK_MONSTERS;
  const fit = (role, max, list = all) => {
    const of = list.filter((m) => (m.role || "minion") === role);
    const ok = of.filter((m) => (Number(m.level) || 1) <= max);
    return ok.length ? ok : of.length ? [of.reduce((a, b) => (Number(a.level) || 1) <= (Number(b.level) || 1) ? a : b)] : [];
  };
  const picks = [];
  if (boss) {
    let bosses = fit("boss", partyLevel2 + 3);
    if (!bosses.length) bosses = fit("boss", partyLevel2 + 3, bestiary.filter((m) => m._anyBoss));
    if (!bosses.length) bosses = FALLBACK_MONSTERS.filter((m) => m.role === "boss");
    picks.push(pick(bosses));
    let mins = fit("minion", partyLevel2 + 1);
    if (!mins.length) mins = FALLBACK_MONSTERS.filter((m) => m.role === "minion");
    const elites = fit("elite", partyLevel2 + 1);
    const escort = partySize <= 1 ? rnd() < 0.5 ? 1 : 0 : partySize === 2 ? 1 : 2;
    for (let i = 0; i < escort; i++) picks.push(elites.length && rnd() < eliteChance * 0.75 ? pick(elites) : pick(mins));
  } else {
    let mins = fit("minion", partyLevel2 + 1);
    const elites = fit("elite", partyLevel2 + 2);
    if (!mins.length) mins = elites.length ? elites : FALLBACK_MONSTERS.filter((m) => m.role === "minion");
    const [lo, hi] = partySize <= 1 ? floor >= 2 ? [2, 3] : [1, 2] : [partySize, Math.min(5, partySize + 1)];
    let count = lo + Math.floor(rnd() * (hi - lo + 1));
    if (rnd() < CROWD_CHANCE) count = Math.min(5, count + 1 + (rnd() < 0.55 ? 1 : 0));
    if (floor >= 2 && elites.length && rnd() < eliteChance) {
      picks.push(pick(elites));
      count = Math.max(0, count - 2);
    }
    for (let i = 0; i < count; i++) picks.push(pick(mins));
  }
  const tot = {};
  picks.forEach((p) => {
    tot[p.name] = (tot[p.name] || 0) + 1;
  });
  const seen = {};
  return picks.map((p, i) => {
    const n = seen[p.name] = (seen[p.name] || 0) + 1;
    return makeFoe(p, i, partySize, tot[p.name] > 1 ? String.fromCharCode(64 + n) : "", partyLevel2);
  });
}
var alive = (c) => c && c.hp > 0;
var everyone = (s) => [...s.heroes, ...s.foes];
var byId = (s, id) => everyone(s).find((c) => c.id === id) || null;
var fxOn = (s, e) => !!e && (typeof e === "number" ? s.round < e : s.round < e.until);
function acOf(s, c) {
  let ac = c.ac;
  (c.fx.ac || []).forEach((e) => {
    if (fxOn(s, e)) ac += e.v;
  });
  if (c.fx.dodge) ac += 4;
  if (fxOn(s, c.fx.reckless)) ac -= 2;
  if (c.fx.frozen) ac -= 2;
  return ac;
}
var curVfx = null;
var curTags = {};
var curDamage = {};
function log(s, txt, extra = {}) {
  s.seq = (s.seq || 0) + 1;
  const row = { i: s.seq, txt, ...curVfx && extra.targets ? curVfx : {}, ...extra };
  if (row.fx && row.targets && row.kind !== "miss") {
    const dead = row.targets.filter((id) => (byId(s, id)?.hp ?? 1) <= 0);
    if (dead.length) row.kill = dead;
  }
  const seen = s.hpSeen || {};
  const all = [...s.heroes || [], ...s.foes || []];
  if (row.targets) {
    const nums = {};
    row.targets.forEach((id) => {
      const f = byId(s, id);
      if (f && seen[id] != null && f.hp !== seen[id]) nums[id] = f.hp - seen[id];
    });
    row.targets.forEach((id) => {
      if (curDamage[id] > 0) nums[id] = -curDamage[id];
    });
    if (Object.keys(nums).length) row.nums = nums;
  }
  if (row.targets) {
    const tags = {};
    row.targets.forEach((id) => {
      if (curTags[id]) tags[id] = curTags[id];
    });
    if (Object.keys(tags).length) row.tags = tags;
  }
  curTags = {};
  curDamage = {};
  const nextSeen = {};
  all.forEach((f) => {
    nextSeen[f.id] = f.hp;
  });
  s.hpSeen = nextSeen;
  s.log = [...s.log || [], row].slice(-LOG_MAX);
}
var EL_OF = { fire: "fire", cold: "frost", lightning: "lightning", thunder: "lightning", poison: "poison", acid: "acid", necrotic: "darkness", radiant: "radiant", force: "arcane", psychic: "psychic" };
var elOf = (type) => EL_OF[type] || "physical";
var RANGED = /* @__PURE__ */ new Set(["arco", "doppio", "lancio"]);
var WEAPON_FX = { slashing: "slash", bludgeoning: "smash", piercing: "thrust" };
var ACTION_FX = {
  turbine: "slash",
  terremoto: "stomp",
  pioggia: "rain",
  trappola: "spikes",
  fulminante: "strike",
  raffica: "punch",
  ki: "punch",
  stordente: "punch",
  ondata: "wave",
  palmo: "burst",
  dardo_inc: "missiles",
  raggio_gelo: "beam",
  mani_w: "breath",
  mani_br: "breath",
  acida: "arrow",
  palla_fuoco: "fireball",
  ipnosi: "curse",
  cono_freddo: "breath",
  fiotto: "beam",
  veleno: "cloud",
  fulmine: "beam",
  catena: "strike",
  deflagrazione: "beam",
  hadar: "spikes",
  vampiro: "drain",
  fame: "cloud",
  dito: "curse",
  rovi: ["vine", "earth"],
  onda: "wave",
  onda_b: "wave",
  lama_fiamma: "slash",
  luna: "strike",
  richiamo: "strike",
  tempesta: "rain",
  fiamma: "strike",
  arma_spir: "slash",
  beffa: "curse",
  sussurri: "curse",
  risata: "sleep"
};
function heroVfx(a) {
  if (a.kind === "taunt") return { fx: "roar", el: "physical" };
  if (a.kind === "defend") return { fx: "shield", el: "arcane" };
  const pick2 = [].concat(ACTION_FX[a.id] || []);
  if (a.kind === "weapon") {
    const el = a.riderDmg && elOf(a.riderDmg) !== "physical" ? elOf(a.riderDmg) : elOf(a.dmg);
    return { fx: pick2[0] || (a.ranged || RANGED.has(a.id) ? "arrow" : a.vfx || WEAPON_FX[a.dmg] || "slash"), el, w: 1 };
  }
  if (a.kind === "spell" || a.kind === "missile") return { fx: pick2[0] || "bolt", el: pick2[1] || elOf(a.dmg) };
  if (a.kind === "save") return { fx: pick2[0] || (a.area ? "aoe" : "bolt"), el: pick2[1] || elOf(a.dmg) };
  if (a.kind === "heal" || a.kind === "heal_all") return { fx: "heal", el: "radiant" };
  if (a.kind === "buff") return { fx: a.buff === "ac" ? "shield" : "buff", el: a.buff === "rage" ? "fire" : "radiant" };
  if (a.kind === "debuff") return { fx: "debuff", el: "darkness" };
  return null;
}
function foeVfx(a, type) {
  if (a.type === "heal") return { fx: "heal", el: "radiant" };
  if (a.type === "buff_ca") return { fx: "shield", el: "arcane" };
  if (a.type === "buff_adv") return { fx: "buff", el: "fire" };
  if (a.type === "debuff_dis") return { fx: "debuff", el: "darkness" };
  const area = a.aoeShape && a.aoeShape !== "single";
  const el = elOf(type);
  const n = a.name || "";
  if (/soffio|breath/i.test(n)) return { fx: "breath", el };
  if (area) return { fx: /pestone|terremoto|stomp|quake/i.test(n) ? "stomp" : "aoe", el };
  if (/arco|frecc|balest|giavell|fionda|lancio|bow|arrow|javelin/i.test(n)) return { fx: "arrow", el };
  if (/morso|fauci|zanne|bite|jaws/i.test(n)) return { fx: "bite", el };
  if (/artigli|graffio|unghi|claw|talon/i.test(n)) return { fx: "claw", el };
  if (/coda|frusta|tentacol|tail|whip/i.test(n)) return { fx: "whip", el };
  if (/pungiglione|aculeo|sting/i.test(n)) return { fx: "sting", el };
  if (/carica|incorn|charge|gore/i.test(n)) return { fx: "dash", el };
  if (/raggio|ray|beam/i.test(n)) return { fx: "beam", el };
  if (/fulmin|lightning/i.test(n)) return { fx: "strike", el };
  if (/nube|nuvola|cloud|miasma/i.test(n)) return { fx: "cloud", el };
  if (el === "physical" && a.hitMode !== "save") return { fx: WEAPON_FX[type] || "slash", el };
  return { fx: "bolt", el };
}
function rollInitiative(s) {
  const all = s.foes.filter(alive).map((c) => ({ id: c.id, v: d20() + (c.init || 0) + rnd() }));
  all.sort((a, b) => b.v - a.v);
  s.order = all.map((x) => x.id);
  s.turn = 0;
  s.round = 1;
}
function newRun({ room, heroes, bestiary, dungeon, now }) {
  const s = {
    roomId: room.id,
    type: room.type,
    week: room.weekKey || "",
    startKey: room.startKey,
    diff: diffOf(room.difficulty).key,
    dungeonName: dungeon.name,
    dungeonIcon: dungeon.icon || "\u{1F5DD}",
    bg: (dungeon.backgrounds || []).length ? pick(dungeon.backgrounds) : "",
    floors: dungeon.floors || 3,
    floor: 1,
    status: "fight",
    lootChance: Number.isFinite(Number(dungeon.lootChance)) ? Number(dungeon.lootChance) : 35,
    round: 1,
    order: [],
    turn: 0,
    turnAt: now,
    heroes: heroes.map(makeHero).map((h, _i, arr) => arr.length === 1 ? { ...h, hp: Math.round(h.maxHp * ADAPT.soloHp), maxHp: Math.round(h.maxHp * ADAPT.soloHp) } : h),
    foes: [],
    log: [],
    seq: 0,
    bestiary: bestiary.map((m) => m.id || m.name)
  };
  s.party = s.heroes.length;
  const C = companyOf(s.party);
  s.heroes.forEach((h) => {
    if (C.save) h.save += C.save;
    if (C.hit) h.compHit = C.hit;
    if (C.hp) {
      const x = Math.round(h.maxHp * C.hp);
      h.maxHp += x;
      h.hp += x;
      h.compHp = x;
    }
  });
  if (s.party > 1) log(s, `\u{1F91D} Compagnia \xD7${s.party}: ${companyLinesTxt(s.party)}.`, { kind: "info" });
  const helpers = s.heroes.filter((h) => h.helper);
  if (helpers.length) log(s, `\u{1F91D} ${helpers.map((h) => h.name).join(", ")} ${helpers.length === 1 ? "partecipa" : "partecipano"} come aiuto: niente PE, monete n\xE9 bottino per ${helpers.length === 1 ? "lui" : "loro"} (limiti gi\xE0 pieni).`, { kind: "info" });
  startFloor(s, bestiary, now);
  return s;
}
function partyLevel(s) {
  return Math.round(s.heroes.reduce((t, h) => t + h.level, 0) / Math.max(1, s.heroes.length));
}
var BUDGET = {
  normal: { hp: 1, dmg: 0.15 },
  elite: { hp: 1.1, dmg: 0.16 },
  boss: { hp: 1.3, dmg: 0.16 },
  weight: { minion: 1, elite: 2.5, boss: 5 },
  // PF dei mostri per ogni eroe = forza d'attacco di un eroe di quel livello
  hpPerHero: 19,
  hpPerLevel: 0.2,
  // ritocco per numero di eroi (tarato con le simulazioni: stessa difficoltà da 1 a 4)
  size: { 1: { hp: 1.17, dmg: 1.17 }, 2: { hp: 1.38, dmg: 1.38 }, 3: { hp: 1.58, dmg: 1.58 }, 4: { hp: 1.75, dmg: 1.75 } },
  // ritocco per livello del gruppo (gli eroi crescono a scatti: Lv 5 attacco extra…)
  level: (lv) => {
    const k = lv <= 1 ? 1.05 : lv === 2 ? 0.92 : lv === 3 ? 0.95 : lv === 4 ? 0.85 : lv <= 8 ? 1 : lv <= 12 ? 0.97 : lv <= 16 ? 0.9 : 0.85;
    return { hp: k, dmg: k };
  }
};
var heroOffense = (lv) => BUDGET.hpPerHero * (1 + BUDGET.hpPerLevel * (Math.max(1, lv) - 1) + (lv >= 5 ? 0.25 : 0));
function balanceFoes(foes, heroes, isBoss) {
  const live = heroes.filter((h) => !h.fled);
  const heroHp = live.reduce((t, h) => t + Math.max(5, (h.maxHp || 10) - HERO_HP_BASE - (h.compHp || 0)), 0) || 10;
  const heroOff = live.reduce((t, h) => t + heroOffense(h.level || 1), 0) || BUDGET.hpPerHero;
  const kind = isBoss ? BUDGET.boss : foes.some((f) => f.role === "elite") ? BUDGET.elite : BUDGET.normal;
  const w = (f) => BUDGET.weight[f.role] || 1;
  const sumW = foes.reduce((t, f) => t + w(f), 0) || 1;
  const sz = BUDGET.size[Math.min(4, Math.max(1, live.length))] || BUDGET.size[4];
  const lvT = BUDGET.level(Math.round(live.reduce((t, h) => t + (h.level || 1), 0) / Math.max(1, live.length)));
  foes.forEach((f) => {
    const share = w(f) / sumW;
    f.maxHp = f.hp = Math.max(3, Math.round(heroOff * kind.hp * sz.hp * lvT.hp * share));
    f.cap = { ...f.cap || {}, dmg: Math.max(1.5, heroHp * kind.dmg * sz.dmg * lvT.dmg * share * (foes.length > 1 ? 1.15 : 1)) };
  });
  return foes;
}
function startFloor(s, bestiary, now) {
  s.boss = s.floor > s.floors;
  const D = diffOf(s.diff);
  s.foes = balanceFoes(buildEncounter(bestiary, { floor: s.floor, floors: s.floors, partyLevel: partyLevel(s), partySize: s.heroes.filter((h) => !h.fled).length, eliteChance: D.elite }), s.heroes, s.boss);
  if (D.rank > 0) s.foes.forEach((f) => {
    f.maxHp = f.hp = Math.max(3, Math.round(f.maxHp * D.hp));
    f.cap = { ...f.cap, dmg: (f.cap?.dmg || 4) * D.dmg, hit: (f.cap?.hit ?? 3) + D.plus, dc: (f.cap?.dc ?? 11) + D.plus };
    f.ac += D.plus;
    f.save += D.plus;
  });
  s.heroes.forEach((h) => {
    h.fx = {};
  });
  s.status = "fight";
  rollInitiative(s);
  log(s, s.boss ? `\u{1F451} Sala del boss! Davanti a voi: ${s.foes.map((f) => f.name).join(", ")}.` : `\u{1F6AA} Sala ${s.floor} di ${s.floors}: ${s.foes.map((f) => f.name).join(", ")}.`, { kind: "room" });
  startHeroPhase(s, now);
}
function applyDamage(s, target, amount, type, notes) {
  let dmg = Math.max(0, Math.round(amount));
  if (target.fx?.petrified && dmg > 0) {
    dmg = Math.floor(dmg / 2);
    notes.push("\xE8 di pietra");
  }
  if (type === "fire" && target.fx?.frozen && amount > 0) {
    delete target.fx.frozen;
    notes.push("\u{1F9CA} il fuoco lo scongela");
  }
  if (target.side === "f") {
    if (target.imm.includes(type)) {
      dmg = 0;
      notes.push("immune");
      curTags[target.id] = "imm";
    } else if (target.res.includes(type)) {
      dmg = Math.floor(dmg / 2);
      notes.push("resiste");
      curTags[target.id] = "res";
    } else if (target.vul.includes(type)) {
      dmg *= 2;
      notes.push("vulnerabile!");
      curTags[target.id] = "vul";
    }
  } else if ((target.res || []).includes(type)) {
    dmg = Math.floor(dmg / 2);
    notes.push("resiste");
    curTags[target.id] = "res";
  } else if (fxOn(s, target.fx.rage) && (PHYS.includes(type) || subP(target).rageAll && type !== "psychic")) {
    dmg = Math.floor(dmg / 2);
    notes.push("in furia");
    curTags[target.id] = "rage";
  }
  target.hp = Math.max(0, target.hp - dmg);
  curDamage[target.id] = (curDamage[target.id] || 0) + dmg;
  return dmg;
}
function attackRoll(s, att, def, bonus, { adv = false, dis = false, critAt = 20 } = {}) {
  let a = adv || fxOn(s, att.fx.adv) || !!def.fx?.paralyzed || !!def.fx?.petrified || fxOn(s, def.fx?.blinded);
  let d = dis || fxOn(s, att.fx.dis) || fxOn(s, att.fx.frightened) || fxOn(s, att.fx.blinded) || fxOn(s, att.fx.slow);
  if (a && d) {
    a = false;
    d = false;
  }
  const r1 = d20();
  const r2 = a || d ? d20() : null;
  const nat = r2 == null ? r1 : a ? Math.max(r1, r2) : Math.min(r1, r2);
  const total = nat + bonus;
  const ac = acOf(s, def);
  return { nat, dice: r2 == null ? [r1] : [r1, r2], total, ac, hit: nat >= critAt || nat !== 1 && total >= ac, crit: nat >= critAt, adv: a, dis: d };
}
var advTag = (r) => r.adv ? " (vantaggio)" : r.dis ? " (svantaggio)" : "";
var dmgBonusOf = (s, c) => (fxOn(s, c.fx.dmg) ? c.fx.dmg.v : 0) + (fxOn(s, c.fx.rage) ? c.fx.rage.v : 0);
var downTxt = (t) => t.hp <= 0 ? t.side === "f" ? ` \u{1F480} ${t.name} cade!` : ` \u{1F480} ${t.name} \xE8 a terra!` : "";
function heroActionList(h) {
  return heroActions(h.cls, h.level, h.picks || [], h.weapon, h.weaponPlus || 0, h.wItem ? itemOf(h.wItem) : null, !!h.twoHand, h.subclass || null).map((a) => ({ ...a, left: a.uses ? h.uses?.[a.id] ?? a.uses : null }));
}
function diceFor(a, lv) {
  let [n, sides] = parseDice(a.dice);
  if (a.scale) n *= cantripMult(lv);
  if (a.grow) n += Math.max(0, Math.floor((lv - (a.min || 1)) / 4));
  return [n, sides];
}
function targetKind(a) {
  if (a.kind === "weapon" || a.kind === "spell" || a.kind === "missile" || a.kind === "save" && !a.area) return "foe";
  if (a.kind === "heal" && !a.self) return "ally";
  if (a.kind === "debuff" && !a.area) return "foe";
  if (a.kind === "buff" && !a.self && !a.allParty) return "ally";
  return null;
}
function heroAct(s, h, a, target) {
  const lv = h.level;
  const st = h.st || {};
  const hit = heroHit(h.cls, lv, st) + (h.armorHit || 0);
  const mod = mainMod(h.cls, st);
  const healMod = st[kitOf(h.cls).healStat] ?? mod;
  const sp = subP(h);
  const sDmg = subNum(sp.sDmg, lv, mod), sHeal = subNum(sp.heal, lv, mod), sDc = (sp.dc || 0) + (h.compHit || 0);
  const flatOf = (f) => {
    const m = /^lv\*(\d+)$/.exec(String(f || ""));
    return m ? lv * Number(m[1]) : Number(f) || 0;
  };
  const ev = { actor: h.id, roll: null };
  h.fx.dodge = false;
  if (a.kind === "defend") {
    h.fx.dodge = true;
    log(s, `\u{1F6E1} ${h.name} si mette in difesa (+4 CA fino al suo turno).`, { kind: "buff", actor: h.id, targets: [h.id] });
    return ev;
  }
  if (a.kind === "taunt") {
    const dc = 8 + profOf(lv) + (st.str || 0);
    const foes = s.foes.filter(alive);
    const parts = foes.map((t) => {
      const sv = d20() + (t.saves?.wis ?? t.save ?? 0);
      if (sv < dc) t.fx.taunt = { by: h.id, until: s.round + a.turns };
      return `${t.name}: ${sv < dc ? `provocato per ${a.turns} turni` : "resiste"} (TS SAG ${sv})`;
    });
    log(s, `${a.icon} ${h.name} usa ${a.name} (CD ${dc}): ${parts.join(" / ")}.`, { kind: "debuff", actor: h.id, targets: foes.map((t) => t.id) });
    return ev;
  }
  if (a.kind === "weapon" || a.kind === "spell") {
    let n = attacksOf(h.cls, lv, a) + (sp.extraAttack && a.kind === "weapon" && !a.singleAttack && !kitOf(h.cls).extraAttacks ? 1 : 0);
    const wfx = a.kind === "weapon" ? a.wfx || null : null;
    if (wfx?.multi && !a.singleAttack) {
      const r = die(100);
      if (r <= (wfx.multi.none || 0)) {
        log(s, `${a.icon} ${h.name} \u2192 ${a.name}: si inceppa, niente colpi questo turno!`, { kind: "miss", actor: h.id, targets: [target.id] });
        return ev;
      }
      if (r <= (wfx.multi.none || 0) + (wfx.multi.double || 0)) {
        n += 1;
        log(s, `${a.icon} ${a.name}: un colpo in pi\xF9!`, { kind: "info", actor: h.id });
      }
    }
    const wm = a.kind === "weapon" ? weaponMod(h.cls, st, a) : mod;
    const hitW = (a.kind === "weapon" ? profOf(lv) + wm + (a.plus || 0) + (h.armorHit || 0) + (sp.wHit || 0) : hit) + (h.compHit || 0);
    if (a.selfDis) {
      h.fx.reckless = s.round + 2;
      h.fx.adv = Math.max(Number(h.fx.adv) || 0, s.round + 2);
    }
    const sneakKey = `${s.floor}:${s.round}`;
    for (let k = 0; k < n; k++) {
      if (!alive(target)) {
        const others = s.foes.filter(alive);
        if (!others.length) break;
        target = others[0];
      }
      const heavy = h.armorCategory === "heavy" || !h.armorCategory && /cotta|stecche|piastre|catene del carceriere/i.test(h.gear?.armor || "");
      const burden = heavy ? die(100) : 0;
      const armorMalus = burden > 50 && burden <= 75 ? 1 : 0;
      const actualHit = hitW - armorMalus;
      const burdenTag = armorMalus ? " - ingombro: -1 a colpire" : burden > 75 ? " - ingombro: svantaggio" : "";
      const r = attackRoll(s, h, target, actualHit, { adv: !!a.adv, dis: burden > 75, critAt: Math.min(wfx?.crit || 20, sp.critAt || 20) });
      const unarmed = h.cls === "monk" && heroVfx(a)?.fx === "punch";
      const hand = unarmed ? k % 2 ? "R" : "L" : h.weapon === "pugnali" ? k % 2 ? "L" : "R" : "R";
      if (curVfx) curVfx = { ...curVfx, hand, ...unarmed ? { unarmed: true } : {} };
      if (k === 0) ev.roll = { nat: r.nat, dice: r.dice };
      if (!r.hit) {
        log(s, `${a.icon} ${h.name} \u2192 ${a.name} su ${target.name}: manca (\u{1F3B2}${r.nat}+${actualHit}=${r.total} vs CA ${r.ac})${advTag(r)}${burdenTag}.`, { kind: "miss", actor: h.id, targets: [target.id], roll: { nat: r.nat, dice: r.dice } });
        continue;
      }
      let [dn, ds] = diceFor(a, lv);
      if (r.crit) dn *= 2;
      const rolled = roll(dn, ds), plusDmg = (a.kind === "weapon" ? wm + (a.plus || 0) + dmgBonusOf(s, h) + (sp.wDmg || 0) : sDmg) + (a.bonusDmg === "lv/2" ? Math.floor(lv / 2) : 0);
      let dmg = rolled.t + plusDmg;
      const notes = [];
      let total = applyDamage(s, target, dmg, a.dmg, notes);
      let extra = "";
      if (a.rider && k === 0 && alive(target)) {
        let rn, rs;
        if (a.rider === "sneak") {
          rn = sneakDiceOf(lv);
          rs = 6;
        } else {
          [rn, rs] = diceFor({ ...a, dice: a.rider }, lv);
        }
        if (r.crit) rn *= 2;
        const rd = applyDamage(s, target, roll(rn, rs).t, a.riderDmg || a.dmg, notes);
        total += rd;
        extra = ` +${rd} ${DMG_IT[a.riderDmg] || ""}`;
        if (a.rider === "sneak") h.sneakAt = sneakKey;
      }
      if (h.cls === "rogue" && a.kind === "weapon" && h.sneakAt !== sneakKey && alive(target) && (r.adv || s.heroes.some((x) => x !== h && alive(x) && !x.fled))) {
        const sn = sneakDiceOf(lv) * (r.crit ? 2 : 1);
        const sd = applyDamage(s, target, roll(sn, 6).t, a.dmg, notes);
        total += sd;
        extra += ` +${sd} furtivo \u{1F312}`;
        h.sneakAt = sneakKey;
      }
      if (a.riderDis && alive(target)) {
        target.fx.dis = s.round + 1 + a.riderDis;
        extra += " \xB7 a svantaggio";
      }
      if (a.stunSave && alive(target)) {
        const sv = d20() + (target.save || 0);
        if (sv < heroDc(h.cls, lv, st) + (h.armorDc || 0) + sDc) {
          target.fx.stun = true;
          extra += ` \xB7 \u{1F4AB} stordito (TS ${sv})`;
        } else extra += ` \xB7 resiste allo stordimento (${sv})`;
      }
      if (a.drain && total > 0) {
        const before = h.hp;
        h.hp = Math.min(h.maxHp, h.hp + Math.floor(total / 2));
        extra += ` \xB7 si cura di ${h.hp - before}`;
      }
      if (wfx && alive(target)) {
        const w = weaponHitFx(s, h, target, wfx, r.crit, notes);
        total += w.dmg;
        extra += w.txt;
      }
      if (a.inflict && k === 0 && alive(target)) extra += tryInflict(s, h, target, a.inflict, heroDc(h.cls, lv, st) + (h.armorDc || 0) + sDc);
      log(
        s,
        `${a.icon} ${h.name} \u2192 ${a.name} su ${target.name}: ${r.crit ? "CRITICO! " : ""}${total} danni ${DMG_IT[a.dmg] || ""}${extra ? ` (di cui${extra})` : ""} (\u{1F3B2}${r.nat}+${actualHit}=${r.total})${advTag(r)}${burdenTag}${notes.length ? ` \xB7 ${notes.join(", ")}` : ""}.${downTxt(target)}`,
        { kind: r.crit ? "crit" : "hit", actor: h.id, targets: [target.id], dmg: total, roll: { nat: r.nat, dice: r.dice }, dr: { n: dn, s: ds, r: rolled.r, p: plusDmg } }
      );
    }
    return ev;
  }
  if (a.kind === "missile") {
    const [dn, ds] = diceFor(a, lv);
    const notes = [];
    const rolled = roll(dn, ds), plusDmg = flatOf(a.flat) + (a.plusMod ? mod : 0) + sDmg;
    const dmg = applyDamage(s, target, rolled.t + plusDmg, a.dmg, notes);
    log(s, `${a.icon} ${h.name} \u2192 ${a.name} su ${target.name}: colpisce sempre, ${dmg} danni ${DMG_IT[a.dmg]}${notes.length ? ` \xB7 ${notes.join(", ")}` : ""}.${downTxt(target)}`, { kind: "hit", actor: h.id, targets: [target.id], dr: { n: dn, s: ds, r: rolled.r, p: plusDmg }, dmg });
    return ev;
  }
  if (a.kind === "save") {
    const dc = heroDc(h.cls, lv, st) + (h.armorDc || 0) + sDc;
    const targets = a.area ? s.foes.filter(alive) : [target];
    const [dn, ds] = diceFor(a, lv);
    const rolled = roll(dn, ds), plusDmg = flatOf(a.flat) + (a.plusMod ? mod : 0) + (Number(a.dice?.split("d")[0]) > 0 ? sDmg : 0), base = rolled.t + plusDmg;
    const parts = [];
    targets.forEach((t) => {
      const sv = d20() + (t.save || 0);
      const ok = sv >= dc;
      const notes = [];
      const amount = ok ? a.half ? Math.floor(base / 2) : 0 : base;
      const types = a.damageTypes || [a.dmg];
      const total = Math.max(0, amount);
      const dmg = types.reduce((sum, type, i) => sum + applyDamage(s, t, Math.floor(total / types.length) + (i < total % types.length ? 1 : 0), type, notes), 0);
      if (!ok && a.stun && alive(t)) t.fx.stun = true;
      const inf = !ok && a.inflict && alive(t) ? applyStatus(s, t, a.inflict.key, { ...a.inflict, dc, stat: a.save, by: h.id }) : "";
      if (!ok && a.dis && alive(t)) t.fx.dis = s.round + 1 + a.dis;
      parts.push(`${t.name} ${ok ? "resiste" : "fallisce"} (${sv}) \u2212${dmg}${notes.length ? ` ${notes.join(",")}` : ""}${!ok && a.stun && alive(t) ? " \u{1F4AB} stordito" : ""}${inf}${t.hp <= 0 ? " \u{1F480}" : ""}`);
    });
    log(s, `${a.icon} ${h.name} \u2192 ${a.name} (TS ${a.save.toUpperCase()} CD ${dc}): ${parts.join(" \xB7 ")}.`, { kind: "hit", actor: h.id, targets: targets.map((t) => t.id), dr: { n: dn, s: ds, r: rolled.r, p: plusDmg } });
    return ev;
  }
  if (a.kind === "heal" || a.kind === "heal_all") {
    const tg = a.kind === "heal_all" ? s.heroes.filter((x) => !x.fled) : [a.self ? h : target];
    const parts = tg.map((t) => {
      let amt;
      if (a.flat) amt = flatOf(a.flat);
      else {
        const [dn, ds] = diceFor(a, lv);
        amt = roll(dn, ds).t + (a.plusMod ? healMod : 0) + (a.plusLevel ? lv : 0);
      }
      amt += sHeal;
      const before = t.hp;
      t.hp = Math.min(t.maxHp, t.hp + amt);
      return `${t.name} +${t.hp - before}${before <= 0 && t.hp > 0 ? " (rialzato!)" : ""}`;
    });
    log(s, `${a.icon} ${h.name} \u2192 ${a.name}: ${parts.join(" \xB7 ")}.`, { kind: "heal", actor: h.id, targets: tg.map((t) => t.id) });
    return ev;
  }
  if (a.kind === "debuff") {
    const tg = a.area ? s.foes.filter(alive) : [target];
    tg.forEach((t) => {
      if (a.inflict) applyStatus(s, t, a.inflict.key, { turns: a.turns, by: h.id });
      else t.fx.dis = s.round + (a.turns || 1) + 1;
    });
    log(s, `${a.icon} ${h.name} \u2192 ${a.name}: ${tg.map((t) => t.name).join(", ")} a svantaggio per ${a.turns} ${a.turns === 1 ? "turno" : "turni"}.`, { kind: "debuff", actor: h.id, targets: tg.map((t) => t.id) });
    return ev;
  }
  if (a.kind === "buff") {
    const tg = a.allParty ? s.heroes.filter(alive) : [a.self ? h : target];
    tg.forEach((t) => {
      const until = s.round + (a.turns || 1) + 1;
      if (a.buff === "ac") t.fx.ac = [...(t.fx.ac || []).filter((e) => fxOn(s, e)), { v: a.value, until }];
      if (a.buff === "adv") t.fx.adv = until;
      if (a.buff === "dmg") t.fx.dmg = { v: a.value, until };
      if (a.buff === "rage") t.fx.rage = { v: a.value, until };
      if (a.buff === "inspire") {
        t.fx.adv = until;
        t.fx.dmg = { v: a.value, until };
      }
    });
    const what = a.buff === "inspire" ? `vantaggio e +${a.value} danni` : a.buff === "ac" ? `+${a.value} CA` : a.buff === "adv" ? "vantaggio agli attacchi" : a.buff === "rage" ? `+${a.value} danni e danni fisici dimezzati` : `+${a.value} danni`;
    log(s, `${a.icon} ${h.name} \u2192 ${a.name}: ${tg.map((t) => t.name).join(", ")} ${what} per ${a.turns} ${a.turns === 1 ? "turno" : "turni"}.`, { kind: "buff", actor: h.id, targets: tg.map((t) => t.id) });
    return ev;
  }
  return ev;
}
var HEAL_COOLDOWN = 3;
var HEAL_MAX = 3;
function foeAct(s, f) {
  const heroes = s.heroes.filter(alive);
  if (!heroes.length) return;
  const acts = f.actions.length ? f.actions : [A("Colpo", 1, "d6", 3)];
  const allies = s.foes.filter(alive);
  const hurt = allies.filter((x) => x.hp / x.maxHp < 0.4).sort((a2, b) => a2.hp / a2.maxHp - b.hp / b.maxHp)[0];
  const heals = acts.filter((a2) => a2.type === "heal");
  const areas = acts.filter((a2) => a2.type === "attack" && a2.aoeShape && a2.aoeShape !== "single");
  const singles = acts.filter((a2) => a2.type === "attack" && (!a2.aoeShape || a2.aoeShape === "single"));
  const buffs = acts.filter((a2) => a2.type === "buff_ca" && !(f.fx.ac || []).some((e) => fxOn(s, e)) || a2.type === "buff_adv" && !fxOn(s, f.fx.adv));
  const debuffs = acts.filter((a2) => a2.type === "debuff_dis");
  const provokedBy = fxOn(s, f.fx.taunt) ? heroes.find((h) => h.id === f.fx.taunt.by) : null;
  if (!provokedBy && f.fx.taunt) delete f.fx.taunt;
  let a;
  const canHeal = (f.heals || 0) < HEAL_MAX && !(f.healRound && s.round - f.healRound < HEAL_COOLDOWN);
  if (provokedBy) a = singles.length ? pick(singles) : areas.length ? pick(areas) : A("Attacco provocato", 1, "d6", 3);
  else if (hurt && heals.length && canHeal && rnd() < 0.5) a = pick(heals);
  else if (areas.length && heroes.length >= 2 && rnd() < 0.55) a = pick(areas);
  else if (buffs.length && rnd() < 0.25) a = pick(buffs);
  else if (debuffs.length && rnd() < 0.25) a = pick(debuffs);
  else a = singles.length ? pick(singles) : pick(acts);
  const weakest = [...heroes].sort((x, y) => x.hp - y.hp)[0];
  const lastHitter = heroes.find((h) => h.id === f.lastHitBy);
  let tgt = provokedBy || (rnd() < 0.45 ? weakest : lastHitter && rnd() < 0.5 ? lastHitter : pick(heroes));
  let confusedTxt = "";
  if (!provokedBy && fxOn(s, f.fx.confused)) {
    const c = confusedPick(s, f);
    if (c && c !== tgt) {
      tgt = c;
      confusedTxt = `\u{1F635} ${f.name} \xE8 confuso e se la prende con ${c.name}! `;
    }
  }
  const nm = a.name || "Attacco";
  const lvlBonus = Math.max(-3, Math.floor((f.level || 1) / 3) + (f.adapt?.dmg || 0));
  const capMult = (n2, sides2, targets = 1) => {
    const avg = (avgDice(n2, sides2) + lvlBonus) * (f.adapt?.mult || 1);
    const max = (f.cap?.dmg || 99) * (targets > 1 ? Math.min(1, 0.8 / targets) : 1);
    return avg > max ? max / avg : 1;
  };
  const turns = Math.max(1, Number(a.durationTurns) || 2);
  curVfx = { ...foeVfx(a, wbDmgType(a)), from: f.id };
  if (a.type === "heal") {
    const t = hurt || f;
    const hn = Number(a.diceNum) || 1, hs = parseDice(`1${a.diceType || "d8"}`)[1];
    const raw = roll(hn, hs).t + (Number(a.bonus) || 0);
    const hmax = (f.cap?.dmg || 99) * 0.6;
    const amt = Math.max(1, Math.round(raw * 0.5 * Math.min(1, hmax / Math.max(1, (avgDice(hn, hs) + (Number(a.bonus) || 0)) * 0.5))));
    f.heals = (f.heals || 0) + 1;
    f.healRound = s.round;
    const before = t.hp;
    t.hp = Math.min(t.maxHp, t.hp + amt);
    log(s, `\u{1F49A} ${f.name} \u2192 ${nm}: ${t.name} +${t.hp - before} PF.`, { kind: "heal", actor: f.id, targets: [t.id] });
    return;
  }
  if (a.type === "buff_ca") {
    f.fx.ac = [...f.fx.ac || [], { v: Number(a.acBonus) || 2, until: s.round + turns + 1 }];
    log(s, `\u{1F6E1} ${f.name} \u2192 ${nm}: +${Number(a.acBonus) || 2} CA per ${turns} turni.`, { kind: "buff", actor: f.id, targets: [f.id] });
    return;
  }
  if (a.type === "buff_adv") {
    f.fx.adv = s.round + turns + 1;
    log(s, `\u2B06 ${f.name} \u2192 ${nm}: vantaggio agli attacchi per ${turns} turni.`, { kind: "buff", actor: f.id, targets: [f.id] });
    return;
  }
  if (a.type === "debuff_dis") {
    const tg = !provokedBy && a.aoeShape && a.aoeShape !== "single" ? heroes : [tgt];
    tg.forEach((t) => {
      t.fx.dis = s.round + turns + 1;
    });
    log(s, `\u2B07 ${f.name} \u2192 ${nm}: ${tg.map((t) => t.name).join(", ")} a svantaggio per ${turns} turni.`, { kind: "debuff", actor: f.id, targets: tg.map((t) => t.id) });
    return;
  }
  const type = wbDmgType(a);
  const n = Math.max(1, Number(a.diceNum) || 1);
  const sides = parseDice(`1${a.diceType || "d6"}`)[1];
  const isSave = a.hitMode === "save" || a.aoeShape && a.aoeShape !== "single";
  if (isSave) {
    const tg = !provokedBy && a.aoeShape && a.aoeShape !== "single" ? heroes : [tgt];
    const dc = f.cap?.dc ?? (Number(a.saveDC) || 12) + (f.adapt?.hit || 0);
    const rolled2 = roll(n, sides), mult2 = (f.adapt?.mult || 1) * capMult(n, sides, tg.length);
    const base = Math.max(1, Math.round((rolled2.t + lvlBonus) * mult2));
    const parts = tg.map((t) => {
      const sv = d20() + (t.save || 0) + (t.st?.[a.saveAbility || "dex"] || 0);
      const ok = sv >= dc;
      const evade = tg.length > 1 && t.cls === "rogue" && t.level >= 7;
      const dmg2 = evade ? ok ? 0 : applyDamage(s, t, Math.floor(base / 2), type, []) : ok ? a.halfOnSave !== false ? applyDamage(s, t, Math.floor(base / 2), type, []) : 0 : applyDamage(s, t, base, type, []);
      const inf = !ok ? foeInflict(a, type) : null;
      const stTxt2 = inf ? tryInflict(s, f, t, { ...inf, chance: Math.min(100, (inf.chance ?? 100) * 1.5), save: null }, dc) : "";
      return `${t.name} ${ok ? "resiste" : "fallisce"} (${sv})${evade ? " \u{1F938} elude" : ""} \u2212${dmg2}${stTxt2}${t.hp <= 0 ? " \u{1F480}" : ""}`;
    });
    log(s, `\u{1F300} ${f.name} \u2192 ${nm} (TS ${String(a.saveAbility || "dex").toUpperCase()} CD ${dc}): ${parts.join(" \xB7 ")}.`, { kind: "hit", actor: f.id, targets: tg.map((t) => t.id), dr: { n, s: sides, r: rolled2.r, p: lvlBonus, x: Math.round(mult2 * 100) / 100 } });
    return;
  }
  const bonus = f.cap?.hit ?? (Number(a.bonus) || 3) + (f.adapt?.hit || 0);
  const r = attackRoll(s, f, tgt, bonus);
  if (!r.hit) {
    log(s, `${confusedTxt}\u2694 ${f.name} \u2192 ${nm} su ${tgt.name}: manca (\u{1F3B2}${r.nat}+${bonus}=${r.total} vs CA ${r.ac})${advTag(r)}.`, { kind: "miss", actor: f.id, targets: [tgt.id], roll: { nat: r.nat, dice: r.dice } });
    return;
  }
  const rolled = roll(r.crit ? n * 2 : n, sides), mult = (f.adapt?.mult || 1) * capMult(n, sides, 1);
  const dmg = applyDamage(s, tgt, Math.max(1, Math.round((rolled.t + lvlBonus) * mult)), type, []);
  const stTxt = tryInflict(s, f, tgt, foeInflict(a, type), f.cap?.dc ?? 12);
  log(s, `${confusedTxt}\u2694 ${f.name} \u2192 ${nm} su ${tgt.name}: ${r.crit ? "CRITICO! " : ""}${dmg} danni ${DMG_IT[type] || ""}${stTxt} (\u{1F3B2}${r.nat}+${bonus}=${r.total})${advTag(r)}.${downTxt(tgt)}`, { kind: r.crit ? "crit" : "hit", actor: f.id, targets: [tgt.id], dmg, roll: { nat: r.nat, dice: r.dice }, dr: { n: r.crit ? n * 2 : n, s: sides, r: rolled.r, p: lvlBonus, x: Math.round(mult * 100) / 100 } });
  if (tgt.thorns && curVfx?.fx === "slash" && alive(f) && die(100) <= (tgt.thorns.chance || 0)) {
    const [tn, ts] = parseDice(tgt.thorns.dice);
    const notes = [];
    curVfx = { fx: "slash", el: elOf(tgt.thorns.dmg), from: tgt.id };
    const td = applyDamage(s, f, roll(tn, ts).t, tgt.thorns.dmg || "bludgeoning", notes);
    f.lastHitBy = tgt.id;
    log(s, `\u{1F373} ${f.name} si fa male sull'equipaggiamento di ${tgt.name}: \u2212${td}${notes.length ? ` \xB7 ${notes.join(", ")}` : ""}.${downTxt(f)}`, { kind: "hit", actor: tgt.id, targets: [f.id], dmg: td });
  }
}
function weaponHitFx(s, h, t, fx, crit, notes) {
  let dmg = 0;
  let txt = "";
  if (fx.extra) {
    let [n, sd] = parseDice(fx.extra[0]);
    if (crit) n *= 2;
    const x = applyDamage(s, t, roll(n, sd).t, fx.extra[1], notes);
    dmg += x;
    txt += ` +${x} ${DMG_IT[fx.extra[1]] || ""}`;
    if (fx.drain && x > 0) {
      const before = h.hp;
      h.hp = Math.min(h.maxHp, h.hp + Math.ceil(x * fx.drain / 100));
      if (h.hp > before) txt += ` \xB7 ti cura di ${h.hp - before}`;
    }
  }
  if (!alive(t)) return { dmg, txt };
  const dot = (key, type) => {
    const o = fx[key];
    if (!o || (t.imm || []).includes(type) || die(100) > o.chance) return;
    txt += applyStatus(s, t, key, { dice: o.dice, turns: o.turns || 2, by: h.id });
  };
  dot("burn", "fire");
  dot("poison", "poison");
  if (fx.slow && die(100) <= fx.slow.chance) txt += applyStatus(s, t, "slow", { turns: fx.slow.turns || 1 });
  if (fx.stun && die(100) <= fx.stun.chance * (t.role === "boss" ? 0.5 : 1)) {
    t.fx.stun = true;
    txt += " \xB7 \u{1F4AB} stordito";
  }
  return { dmg, txt };
}
var STATUS = {
  burn: { ico: "\u{1F525}", name: "bruciato", dice: "1d6", turns: 2, imm: "fire" },
  poison: { ico: "\u2620", name: "avvelenato", dice: "1d4", turns: 3, imm: "poison" },
  frozen: { ico: "\u{1F9CA}", name: "congelato", left: 2, imm: "cold" },
  paralyzed: { ico: "\u26A1", name: "paralizzato", left: 3, stat: "con" },
  petrified: { ico: "\u{1F5FF}", name: "pietrificato", left: 3 },
  frightened: { ico: "\u{1F631}", name: "spaventato", turns: 2 },
  blinded: { ico: "\u{1F311}", name: "accecato", turns: 2 },
  slow: { ico: "\u{1F40C}", name: "rallentato", turns: 1 },
  confused: { ico: "\u{1F635}", name: "confuso", turns: 2 }
};
function applyStatus(s, t, key, o = {}) {
  const st = STATUS[key];
  if (!st || !alive(t)) return "";
  if (st.imm && (t.imm || []).includes(st.imm)) return ` \xB7 immune a ${st.name}`;
  if (t.fx.petrified && key !== "petrified") return "";
  if (st.dice) t.fx[key] = { dice: o.dice || st.dice, until: s.round + (o.turns || st.turns) + 1, type: st.imm, by: o.by || null };
  else if (st.left) t.fx[key] = { left: o.left || st.left, ...key === "paralyzed" ? { dc: o.dc || 12, stat: o.stat || st.stat } : {} };
  else t.fx[key] = { until: s.round + (o.turns || st.turns) + 1 };
  return ` \xB7 ${st.ico} ${st.name}`;
}
function tryInflict(s, src, t, inf, dc) {
  if (!inf || !alive(t)) return "";
  const chance = (inf.chance ?? 100) * (t.role === "boss" ? 0.5 : 1);
  if (die(100) > chance) return "";
  if (inf.save && t.side === "h") {
    const sv = d20() + (t.save || 0) + (t.st?.[inf.save] || 0);
    if (sv >= dc) return ` \xB7 evita ${STATUS[inf.key]?.name || "l'effetto"} (TS ${sv})`;
  }
  return applyStatus(s, t, inf.key, { ...inf, dc, by: src?.id });
}
var STATUS_OF_DMG = {
  // mostri del bestiario: lo stato che porta il loro tipo di danno (se l'azione non ne dice uno suo)
  fire: { key: "burn", chance: 25, save: "dex" },
  cold: { key: "frozen", chance: 12, save: "con" },
  poison: { key: "poison", chance: 30, save: "con" },
  necrotic: { key: "frightened", chance: 20, save: "wis" },
  lightning: { key: "paralyzed", chance: 10, save: "con" },
  psychic: { key: "confused", chance: 25, save: "wis" },
  acid: { key: "blinded", chance: 15, save: "dex" }
};
var foeInflict = (a, type) => a.inflict === "none" ? null : a.inflict || STATUS_OF_DMG[type] || null;
function turnStart(s, c) {
  for (const key of ["burn", "poison"]) {
    const o = c.fx[key];
    if (!o || !alive(c)) continue;
    if (!fxOn(s, o)) {
      delete c.fx[key];
      continue;
    }
    const [n, sd] = parseDice(o.dice);
    const notes = [];
    curVfx = { fx: "debuff", el: elOf(o.type), from: c.id };
    const d = applyDamage(s, c, roll(n, sd).t, o.type, notes);
    if (o.by && c.side === "f") c.lastHitBy = o.by;
    log(s, `${STATUS[key].ico} ${c.name} ${key === "burn" ? "brucia" : "soffre il veleno"}: \u2212${d}${notes.length ? ` \xB7 ${notes.join(", ")}` : ""}.${downTxt(c)}`, { kind: "hit", targets: [c.id], dmg: d });
    curVfx = null;
  }
  if (!alive(c)) return false;
  const fx = c.fx;
  ["frightened", "blinded", "slow", "confused"].forEach((k) => {
    if (fx[k] && !fxOn(s, fx[k])) delete fx[k];
  });
  if (fx.petrified) {
    fx.petrified.left -= 1;
    if (fx.petrified.left <= 0) {
      delete fx.petrified;
      log(s, `\u{1F5FF} ${c.name} torna di carne e ossa (ma per questo turno resta fermo).`, { kind: "buff", targets: [c.id] });
    } else log(s, `\u{1F5FF} ${c.name} \xE8 di pietra: non pu\xF2 agire (ancora ${fx.petrified.left} ${fx.petrified.left === 1 ? "turno" : "turni"}).`, { kind: "debuff", actor: c.id });
    return false;
  }
  if (fx.frozen) {
    fx.frozen.left -= 1;
    const last = fx.frozen.left <= 0;
    if (last) delete fx.frozen;
    log(s, `\u{1F9CA} ${c.name} \xE8 congelato e salta il turno${last ? ": il ghiaccio si scioglie" : ""}.`, { kind: "debuff", actor: c.id });
    return false;
  }
  if (fx.paralyzed) {
    fx.paralyzed.left -= 1;
    const sv = d20() + (c.save || 0) + (c.st?.[fx.paralyzed.stat || "con"] || 0);
    const free = sv >= (fx.paralyzed.dc || 12) || fx.paralyzed.left <= 0;
    log(s, `\u26A1 ${c.name} \xE8 paralizzato e salta il turno \xB7 TS ${sv} vs CD ${fx.paralyzed.dc || 12}: ${free ? "si libera!" : "resta bloccato"}.`, { kind: "debuff", actor: c.id });
    if (free) delete fx.paralyzed;
    return false;
  }
  if (fx.stun) {
    fx.stun = false;
    log(s, `\u{1F4AB} ${c.name} \xE8 stordito e salta il turno.`, { kind: "debuff", actor: c.id });
    return false;
  }
  return true;
}
function confusedPick(s, c) {
  const pool = [...s.heroes, ...s.foes].filter((x) => alive(x) && x.id !== c.id && !x.fled);
  return pool.length ? pick(pool) : null;
}
function checkEnd(s) {
  if (s.mimic && s.mimic.result === "fight") {
    if (!s.heroes.some(alive)) {
      s.mimic.result = "lost";
      s.status = "won";
      log(s, "Il Mimic vi ha sconfitti: perdete solo lo scrigno. Il bottino delle sale e i PE sono salvi.", { kind: "end" });
      return true;
    }
    if (!s.foes.some(alive)) {
      s.mimic.result = "won";
      awardChest(s, s.mimic.byUid, s.turnAt || 0);
      return true;
    }
    return false;
  }
  if (!s.heroes.some(alive)) {
    s.status = "lost";
    log(s, "\u2620 Il gruppo \xE8 caduto. Le Segrete si richiudono su di voi: tutto \xE8 perduto.", { kind: "end" });
    return true;
  }
  if (!s.foes.some(alive)) {
    floorCoins(s);
    if (s.boss) {
      s.status = "treasure";
      s.treasure = true;
      s.floor += 1;
      s.foes = [];
      s.chestAt = s.turnAt || 0;
      log(s, `\u{1F3C6} Il boss \xE8 caduto! In fondo alla sala c'\xE8 uno scrigno: aprite il tesoro di ${s.dungeonName}.`, { kind: "end" });
    } else {
      s.status = "cleared";
      log(s, `\u2705 Sala ${s.floor} ripulita! Riprendete fiato prima della prossima.`, { kind: "end" });
    }
    return true;
  }
  return false;
}
var pendingHeroes = (s) => s.heroes.filter((h) => alive(h) && !(s.acted || {})[h.id]);
function startHeroPhase(s, now) {
  s.acted = {};
  s.phaseAt = now;
  s.turnAt = now;
  s.heroes.forEach((h) => {
    if (!alive(h) || h.fled) return;
    if (!turnStart(s, h)) s.acted = { ...s.acted, [h.id]: true };
  });
}
function monsterPhase(s, now) {
  for (const id of s.order) {
    if (checkEnd(s)) return;
    const f = byId(s, id);
    if (!alive(f) || f.side !== "f") continue;
    if (!turnStart(s, f)) {
      if (!alive(f)) lootDead(s);
      continue;
    }
    foeAct(s, f);
    curVfx = null;
  }
  if (checkEnd(s)) return;
  s.round += 1;
  startHeroPhase(s, now);
  if (checkEnd(s)) return;
  if (!pendingHeroes(s).length && s.heroes.some(alive)) {
    s.chain = (s.chain || 0) + 1;
    if (s.chain <= 12) monsterPhase(s, now);
  } else s.chain = 0;
}
function afterHeroAction(s, now) {
  if (checkEnd(s)) return;
  if (pendingHeroes(s).length) return;
  monsterPhase(s, now);
}
function act(s, uid, { actionId, targetId }, now) {
  if (s.status !== "fight") throw new Error("Non si combatte adesso.");
  s.acted = s.acted || {};
  const h = s.heroes.find((x) => x.uid === uid);
  if (!h) throw new Error("Non sei in questa partita.");
  if (!alive(h)) throw new Error("Sei a terra: aspetta che un alleato ti curi.");
  if (s.acted[h.id]) throw new Error("Hai gi\xE0 agito in questo round: aspetta gli altri e i mostri.");
  const a = actionId === DEFEND.id ? DEFEND : heroActionList(h).find((x) => x.id === actionId);
  if (!a) throw new Error("Azione non disponibile.");
  if (a.uses && (h.uses?.[a.id] ?? a.uses) <= 0) throw new Error("Hai finito gli usi di questa azione per questa sala.");
  if (a.kind === "grip") {
    if (!canTwoHand(h.cls, weaponOf(h.cls, h.weapon).key)) throw new Error("Con quest'arma non si pu\xF2.");
    const two = !h.twoHand, sAc = Number(h.shieldAc) || 0;
    h.twoHand = two;
    if (sAc) h.ac += two ? -sAc : sAc;
    log(s, two ? `\u270A ${h.name} impugna l'arma a due mani${sAc ? ` e mette via lo scudo (\u2212${sAc} CA)` : ""}.` : `\u{1F6E1} ${h.name} torna a impugnare l'arma con una mano${sAc ? ` e riprende lo scudo (+${sAc} CA)` : ""}.`, { kind: "info", actor: h.id });
    return { actor: h.id, roll: null };
  }
  const tk = targetKind(a);
  if (fxOn(s, h.fx.frightened) && (a.kind === "heal_all" || a.kind === "heal" && !a.self || a.kind === "buff" && !a.self)) throw new Error("Sei spaventato: non riesci a curare n\xE9 ad aiutare gli altri. Attacca o difenditi.");
  let target = null;
  if (tk === "foe") target = foeTarget(s, h, targetId);
  if (tk === "ally") {
    target = byId(s, targetId);
    const heal = a.kind === "heal";
    if (!target || target.side !== "h" || target.fled || !heal && !alive(target)) throw new Error("Scegli un alleato.");
  }
  if (a.uses) h.uses = { ...h.uses, [a.id]: (h.uses?.[a.id] ?? a.uses) - 1 };
  if (tk && fxOn(s, h.fx.confused)) {
    const c = confusedPick(s, h);
    if (c && c !== target) {
      log(s, `\u{1F635} ${h.name} \xE8 confuso: ${a.name} finisce su ${c.name}!`, { kind: "info", actor: h.id });
      target = c;
    }
  }
  curVfx = heroVfx(a) ? { ...heroVfx(a), from: h.id } : null;
  if (h.cls === "monk" && curVfx?.fx === "punch") curVfx = { ...curVfx, hand: "L", unarmed: true, w: 1 };
  let ev;
  try {
    ev = heroAct(s, h, a, target);
  } finally {
    curVfx = null;
  }
  if (target && target.side === "f") target.lastHitBy = h.id;
  s.acted = { ...s.acted, [h.id]: true };
  lootDead(s);
  afterHeroAction(s, now);
  return ev;
}
function foeTarget(s, h, targetId) {
  const t = byId(s, targetId);
  if (t && t.side === "f" && alive(t)) return t;
  const live = s.foes.filter(alive);
  if (!live.length) throw new Error("Non ci sono nemici in piedi.");
  const next = live.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  log(s, `\u{1F3AF} ${t && t.side === "f" ? `${t.name} \xE8 gi\xE0 caduto: ` : ""}${h.name} punta ${next.name}.`, { kind: "info", actor: h.id });
  return next;
}
function addSpoil(s, uid, { coins = 0, item = null, src = "" } = {}) {
  const g = { ...s.gains || {} };
  g[uid] = [...g[uid] || [], { fl: s.floor, c: coins || 0, it: item || null, src: String(src || "") }].slice(-60);
  s.gains = g;
  const sp = { ...s.spoils || {} };
  const cur = sp[uid] || { coins: 0, items: {} };
  const items = { ...cur.items || {} };
  if (item) items[item] = (items[item] || 0) + 1;
  sp[uid] = { coins: (cur.coins || 0) + coins, items };
  s.spoils = sp;
}
function floorCoins(s) {
  if (s.coinsFloor === s.floor) return;
  s.coinsFloor = s.floor;
  const cm = diffOf(s.diff).coins * companyOf(s.party || s.heroes.length).coins;
  const got = s.heroes.filter((h) => !h.fled && !h.helper).map((h) => {
    const c = Math.round(die(FLOOR_COINS_DIE) * cm);
    addSpoil(s, h.uid, { coins: c, src: s.boss ? "boss sconfitto" : `sala ${s.floor} ripulita` });
    return `${h.name} ${c}`;
  });
  if (got.length) log(s, `\u{1FA99} Monete Antiche dalla sala: ${got.join(" \xB7 ")}.`, { kind: "loot" });
}
function lootDead(s) {
  if (s.mimic) return;
  const heroes = s.heroes.filter((h) => !h.fled && !h.helper);
  if (!heroes.length) return;
  const D = diffOf(s.diff);
  const ctx = {
    dungeon: s.type,
    rank: DIFF_RANK[D.key] || 0,
    boost: D.boost,
    bases: [...new Set(heroes.map((h) => h.weapon).filter(Boolean))],
    classes: [...new Set(heroes.map((h) => h.cls))]
  };
  s.foes.forEach((f) => {
    if (alive(f) || f.looted) return;
    f.looted = true;
    const ch = DROP_CHANCE[f.role] || DROP_CHANCE.minion;
    const faces = heroes.length * 2;
    const r = die(faces);
    const who = heroes[Math.min(heroes.length - 1, Math.ceil(r / 2) - 1)];
    const parts = [];
    if (die(100) <= ch.coins) {
      const c = Math.round(roll(ch.coinDice[0], ch.coinDice[1]).t * D.coins * companyOf(s.party || s.heroes.length).coins);
      addSpoil(s, who.uid, { coins: c, src: f.name });
      parts.push(`\u{1FA99} ${c} Monete Antiche`);
    }
    if (die(100) <= Math.min(95, ch.item * D.item)) {
      const id = rollDropItem(rnd, ctx, f.role);
      const it = itemOf(id);
      if (it) {
        addSpoil(s, who.uid, { item: id, src: f.name });
        parts.push(`${it.icon} ${it.name}`);
      }
    }
    if (parts.length) log(s, `\u{1F381} ${f.name} lascia cadere ${parts.join(" e ")}: ${heroes.length > 1 ? `\u{1F3B2} d${faces} = ${r} \u2192 ` : ""}va a ${who.name}.`, { kind: "loot", actor: who.id });
  });
}
function useItem(s, uid, { itemId, targetId }, now) {
  if (s.status !== "fight") throw new Error("Non si combatte adesso.");
  s.acted = s.acted || {};
  const h = s.heroes.find((x) => x.uid === uid);
  if (!h) throw new Error("Non sei in questa partita.");
  if (!alive(h)) throw new Error("Sei a terra: aspetta che un alleato ti curi.");
  if (s.acted[h.id]) throw new Error("Hai gi\xE0 agito in questo round: aspetta gli altri e i mostri.");
  const it = battleItem(itemId);
  if (!it) throw new Error("Oggetto non usabile in lotta.");
  const tk = itemTarget(it);
  let target = null;
  if (tk === "foe") target = foeTarget(s, h, targetId);
  if (tk === "ally" || tk === "downed") {
    target = byId(s, targetId) || h;
    if (target.side !== "h" || target.fled) throw new Error("Scegli un alleato.");
    if (tk === "ally" && !alive(target)) throw new Error("\xC8 a terra: per rialzarlo serve la Piuma della Fenice.");
    if (tk === "downed" && alive(target)) throw new Error("La Piuma della Fenice serve per un alleato a terra.");
  }
  const flatN = Number(it.flat) || 0;
  const on = target && target !== h ? ` su ${target.name}` : "";
  if (it.kind === "heal") {
    curVfx = { fx: "heal", el: "radiant", from: h.id };
    const [n, sd] = parseDice(it.dice);
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + roll(n, sd).t + flatN);
    log(s, `${it.icon} ${h.name} usa ${it.name}${on}: +${target.hp - before} PF.`, { kind: "heal", actor: h.id, targets: [target.id] });
  } else if (it.kind === "revive") {
    curVfx = { fx: "heal", el: "radiant", from: h.id };
    target.hp = Math.max(1, Math.ceil(target.maxHp * (it.pct || 50) / 100));
    log(s, `${it.icon} ${h.name} usa ${it.name}: ${target.name} si rialza con ${target.hp} PF!`, { kind: "heal", actor: h.id, targets: [target.id] });
  } else if (it.kind === "cleanse" || it.kind === "panacea") {
    curVfx = { fx: "buff", el: "radiant", from: h.id };
    const was = ["burn", "poison", "frozen", "paralyzed", "frightened", "blinded", "slow", "confused", ...it.kind === "panacea" ? ["petrified"] : []].filter((k) => target.fx[k]);
    const fx = { ...target.fx, dis: 0, stun: false, reckless: 0 };
    was.forEach((k) => {
      delete fx[k];
    });
    target.fx = fx;
    const stone = it.kind === "cleanse" && target.fx.petrified ? " (la pietra resta: serve la Panacea)" : "";
    log(s, `${it.icon} ${h.name} usa ${it.name}${on}: ${was.length ? `via ${was.map((k) => `${STATUS[k].ico} ${STATUS[k].name}`).join(", ")}` : "via svantaggio e stordimento"}${stone}.`, { kind: "buff", actor: h.id, targets: [target.id] });
  } else if (it.kind === "cleanse_party") {
    curVfx = { fx: "aoe", el: "water", from: h.id };
    const tg = s.heroes.filter((x) => alive(x) && !x.fled);
    const parts = tg.map((x) => {
      const was = ["burn", "slow", "paralyzed"].filter((k) => x.fx[k]);
      was.forEach((k) => {
        delete x.fx[k];
      });
      return was.length ? `${x.name} (${was.map((k) => STATUS[k].ico).join("")})` : null;
    }).filter(Boolean);
    log(s, `${it.icon} ${h.name} lancia ${it.name} sul gruppo: ${parts.length ? `liberati ${parts.join(", ")}` : "tutti fradici, ma nessuno aveva bisogno"}.`, { kind: "buff", actor: h.id, targets: tg.map((x) => x.id) });
  } else if (it.kind === "buff") {
    curVfx = { fx: it.buff === "ac" ? "shield" : "buff", el: "arcane", from: h.id };
    const until = s.round + (it.turns || 1) + 1;
    if (it.buff === "ac") target.fx.ac = [...(target.fx.ac || []).filter((e) => fxOn(s, e)), { v: it.value, until }];
    if (it.buff === "adv") target.fx.adv = until;
    log(s, `${it.icon} ${h.name} usa ${it.name}${on}: ${it.buff === "ac" ? `+${it.value} CA` : "vantaggio agli attacchi"} per ${it.turns} round.`, { kind: "buff", actor: h.id, targets: [target.id] });
  } else if (it.kind === "throw") {
    curVfx = { fx: "lob", el: elOf(it.dmg), from: h.id };
    const [n, sd] = parseDice(it.dice);
    const notes = [];
    const dmg = applyDamage(s, target, roll(n, sd).t, it.dmg, notes);
    target.lastHitBy = h.id;
    log(s, `${it.icon} ${h.name} lancia ${it.name} su ${target.name}: ${dmg} danni ${DMG_IT[it.dmg] || ""}${notes.length ? ` \xB7 ${notes.join(", ")}` : ""}.${downTxt(target)}`, { kind: "hit", actor: h.id, targets: [target.id], dmg });
  } else if (it.kind === "throw_area") {
    curVfx = { fx: "fireball", el: elOf(it.dmg), from: h.id };
    const [n, sd] = parseDice(it.dice);
    const base = roll(n, sd).t;
    const tg = s.foes.filter(alive);
    const parts = tg.map((t) => {
      const sv = d20() + (t.save || 0);
      const ok = sv >= (it.dc || 13);
      const notes = [];
      const dmg = applyDamage(s, t, ok ? Math.floor(base / 2) : base, it.dmg, notes);
      t.lastHitBy = h.id;
      return `${t.name} ${ok ? "resiste" : "fallisce"} (${sv}) \u2212${dmg}${notes.length ? ` ${notes.join(",")}` : ""}${t.hp <= 0 ? " \u{1F480}" : ""}`;
    });
    log(s, `${it.icon} ${h.name} lancia ${it.name} (TS ${String(it.save).toUpperCase()} CD ${it.dc}): ${parts.join(" \xB7 ")}.`, { kind: "hit", actor: h.id, targets: tg.map((t) => t.id) });
  }
  curVfx = null;
  s.acted = { ...s.acted, [h.id]: true };
  lootDead(s);
  afterHeroAction(s, now);
  return { actor: h.id, roll: null, item: itemId };
}
function timeout(s, now, mimicSource = MIMIC_MONSTER) {
  if (s.status === "treasure") {
    if (now - (s.chestAt || 0) < CHEST_AUTO_MS) throw new Error("Lo scrigno aspetta ancora qualcuno.");
    const h = s.heroes.find((x) => !x.fled) || s.heroes[0];
    return openChest(s, h.uid, now, mimicSource);
  }
  if (s.status !== "fight") throw new Error("Non si combatte adesso.");
  const late = pendingHeroes(s);
  if (!late.length) throw new Error("Hanno gi\xE0 agito tutti.");
  if (now - (s.phaseAt || s.turnAt || 0) < AFK_MS) throw new Error("I 5 minuti non sono ancora finiti.");
  late.forEach((h) => {
    h.fx.dodge = true;
    s.acted = { ...s.acted || {}, [h.id]: true };
  });
  log(s, `\u23F0 Tempo scaduto: ${late.map((h) => h.name).join(", ")} si ${late.length === 1 ? "difende" : "difendono"} da ${late.length === 1 ? "solo" : "soli"}.`, { kind: "buff", targets: late.map((h) => h.id) });
  afterHeroAction(s, now);
}
function nextFloor(s, bestiary, now) {
  if (s.status !== "cleared") throw new Error("La sala non \xE8 ancora ripulita.");
  s.heroes.forEach((h) => {
    if (h.fled) return;
    h.hp = h.hp <= 0 ? Math.ceil(h.maxHp * 0.25) : Math.min(h.maxHp, h.hp + Math.ceil(h.maxHp * 0.3));
    const uses = {};
    heroActions(h.cls, h.level, h.picks || [], h.weapon, h.weaponPlus || 0, h.wItem ? itemOf(h.wItem) : null, false, h.subclass || null).forEach((a) => {
      if (a.uses) uses[a.id] = a.uses;
    });
    h.uses = uses;
  });
  s.floor += 1;
  log(s, "\u{1F525} Breve riposo: recuperate fiato e incantesimi.", { kind: "room" });
  startFloor(s, bestiary, now);
}
var MIMIC_CHANCE = 0.1;
var CHEST_AUTO_MS = 90 * 1e3;
var CHEST_BASIC = ["pozione", "pozione", "pozione", "pozione_magg", "tonico", "fuoco_alch", "acido", "acqua_santa", "bomba_acqua", "pelle_pietra"];
var CHEST_RARE = ["pozione_sup", "piuma_fenice", "panacea", "eroismo"];
var CHEST_RARE_CHANCE = 0.04;
function openChest(s, uid, now, mimicSource = MIMIC_MONSTER) {
  if (s.status !== "treasure") throw new Error("Qui non c'\xE8 nessuno scrigno da aprire.");
  const opener = s.heroes.find((h) => h.uid === uid);
  if (!opener) throw new Error("Non sei in questo gruppo.");
  if (rnd() < MIMIC_CHANCE) {
    const D = diffOf(s.diff);
    s.mimic = { result: "fight", byUid: uid, eligible: s.heroes.filter((h) => !h.fled && !h.helper).map((h) => h.uid) };
    const lv = partyLevel(s);
    const foe = makeFoe({ ...MIMIC_MONSTER, ...mimicSource, id: "mimic", role: "elite", level: lv }, 0, s.heroes.filter((h) => !h.fled).length, "", lv);
    s.foes = balanceFoes([foe], s.heroes, false);
    foe.maxHp = foe.hp = Math.round(foe.maxHp * D.hp);
    foe.cap.dmg *= D.dmg;
    foe.cap.hit += D.plus;
    foe.cap.dc += D.plus;
    foe.ac += D.plus;
    foe.save += D.plus;
    s.status = "fight";
    s.round = 1;
    rollInitiative(s);
    log(s, "Lo scrigno spalanca le fauci: \xE8 un Mimic! Se cadete perderete solo il tesoro dello scrigno.", { kind: "room" });
    startHeroPhase(s, now);
    return;
  }
  awardChest(s, uid, now);
}
function awardChest(s, uid, now) {
  const opener = s.heroes.find((h) => h.uid === uid);
  const D = diffOf(s.diff), takers = s.heroes.filter((h) => !h.fled && !h.helper);
  const C = companyOf(s.party || s.heroes.length);
  const coins = Math.round((die(10) + die(10) + 6) * (((s.floors || 3) + 1) / 2) * (D.coins || 1) * C.coins);
  takers.forEach((h) => addSpoil(s, h.uid, { coins, src: "scrigno" }));
  const ids = [];
  const n = 1 + (rnd() < 0.6 ? 1 : 0) + (rnd() < 0.25 ? 1 : 0) + Math.max(0, takers.length - 1) * 2;
  const extra = C.chest && rnd() < C.chest ? 1 : 0;
  for (let i = 0; i < n + extra; i++) ids.push(CHEST_BASIC[Math.floor(rnd() * CHEST_BASIC.length)]);
  if (rnd() < CHEST_RARE_CHANCE * (D.chest || 1)) ids.push(CHEST_RARE[Math.floor(rnd() * CHEST_RARE.length)]);
  const items = ids.map((id) => {
    let rolls = takers.map((h) => ({ uid: h.uid, name: h.name, v: die(20) }));
    const all = [rolls];
    for (let k = 0; k < 6 && rolls.length > 1; k++) {
      const top = Math.max(...rolls.map((r) => r.v)), tied = rolls.filter((r) => r.v === top);
      if (tied.length < 2) break;
      rolls = tied.map((r) => ({ ...r, v: die(20) }));
      all.push(rolls);
    }
    const last = all[all.length - 1], best = last.length ? last.reduce((a, b) => b.v > a.v ? b : a) : null;
    if (best) addSpoil(s, best.uid, { item: id, src: "scrigno" });
    return { id, rare: CHEST_RARE.includes(id), rolls: all[0], ...all.length > 1 ? { rerolls: all.slice(1) } : {}, winner: best?.uid || null, winnerName: best?.name || "" };
  });
  s.chest = { by: opener.name, byUid: opener.uid, coins, items, at: now };
  const what = items.map((it) => `${itemOf(it.id)?.icon || "\u{1F381}"} ${itemOf(it.id)?.name || it.id} \u2192 ${it.winnerName || "nessuno"}`).join(", ");
  log(s, `\u{1F4B0} ${opener.name} apre lo scrigno: ${coins} Monete Antiche a testa${what ? ` \xB7 ${what}` : ""}.`, { kind: "loot" });
  s.status = "won";
  log(s, `\u{1F3C6} Avete conquistato ${s.dungeonName}.`, { kind: "end" });
}
function flee(s, uid, now) {
  const h = s.heroes.find((x) => x.uid === uid);
  if (!h) throw new Error("Non sei in questa partita.");
  if (h.hp > 0) {
    h.hp = 0;
    h.fled = true;
    log(s, `\u{1F3C3} ${h.name} fugge dalle Segrete.`, { kind: "down", actor: h.id });
  }
  if (s.status === "fight") afterHeroAction(s, now);
  else if (!s.heroes.some(alive) && s.status === "cleared") {
    s.status = "lost";
    log(s, "\u2620 Non resta nessuno a proseguire: tutto \xE8 perduto.", { kind: "end" });
  }
}

// src/utils/foundryMap.js
var TYPE_TO_FOUNDRY = {
  "Arma": "weapon",
  "Armatura": "equipment",
  "Accessori": "equipment",
  "Artefatto Magico": "equipment",
  "Pozioni": "consumable",
  "Pergamene": "consumable",
  "Reagenti": "loot",
  "Varie": "loot",
  "Pacchetto Carte": "loot",
  "Carta TCG": "loot"
};
var RARITY_TO_FOUNDRY = {
  "Comune": "common",
  "Non comune": "uncommon",
  "Rara": "rare",
  "Molto rara": "veryRare",
  "Leggendaria": "legendary",
  "Artefatto": "artifact"
};
var resolveFoundryType = (item) => item?.foundry?.foundryType || TYPE_TO_FOUNDRY[item?.type] || "loot";
var resolveFoundryRarity = (item) => RARITY_TO_FOUNDRY[item?.class] || "common";
var marketItemToFoundryPayload = (item, dest = {}) => {
  const f = item?.foundry || {};
  const ftype = resolveFoundryType(item);
  const target = dest.target || "world";
  return {
    name: (item?.name || "").trim(),
    foundryType: ftype,
    rarity: resolveFoundryRarity(item),
    description: item?.description || "",
    img: (item?.img || "").trim(),
    price: Number(item?.startingBid ?? item?.price ?? 0) || 0,
    weight: Number(f.weight) || 0,
    quantity: Number(f.quantity) || 1,
    target,
    targetUid: target === "player" ? dest.targetUid || "" : "",
    targetName: target === "player" ? dest.targetName || "" : "",
    actionType: ftype === "weapon" || ftype === "consumable" ? f.actionType || "" : "",
    damageFormula: (f.damageFormula || "").trim(),
    damageType: f.damageType || "slashing",
    damage2Formula: (f.damage2Formula || "").trim(),
    damage2Type: f.damage2Type || "",
    versatileFormula: (f.versatileFormula || "").trim(),
    attackBonus: f.attackBonus === "" || f.attackBonus == null ? 0 : Number(f.attackBonus) || 0,
    proficient: f.proficient !== false,
    properties: ftype === "weapon" ? Array.isArray(f.properties) ? f.properties : [] : [],
    armorType: ftype === "equipment" ? f.armorType || "" : "",
    armorValue: ftype === "equipment" ? Number(f.armorValue) || 0 : 0,
    saveAbility: f.saveAbility || "",
    saveDC: f.saveDC === "" || f.saveDC == null ? 0 : Number(f.saveDC) || 0
  };
};
var wonItemInboxDoc = (item, winnerUid, winnerName, createdBy = "") => {
  const p = marketItemToFoundryPayload(item, { target: "player", targetUid: winnerUid, targetName: winnerName || "" });
  const set = item?.setPayload;
  if (set?.name) {
    const bonus = (set.bonuses || []).map((b) => `${b.pieces} pezzi: ${b.effect}`).join(" \xB7 ");
    p.description = `${p.description || ""}

Set \xAB${set.name}\xBB (${set.size || "?"} pezzi)${bonus ? ` \u2014 ${bonus}` : ""}`.trim();
  }
  if (item?.finalPrice) p.price = Number(item.finalPrice) || p.price;
  return { status: "pending", ...p, origin: "market", marketItemId: item?.id || "", createdBy };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AFK_MS,
  DAILY_RUNS,
  DAILY_TOTAL,
  DEFAULT_FLOORS,
  GIFT_DAILY,
  GIFT_FEE,
  KITS,
  MAX_STORY_LEVEL,
  RESPEC_COST,
  RUN_COUNTS_AFTER,
  SHOP_ITEMS,
  SOLO_XP_MULT,
  STAT_KEYS,
  STAT_MAX,
  SUBCLASSES,
  SUBCLASS_COST,
  SUBCLASS_LEVEL,
  WEEKLY_RUNS,
  XP_VERSION,
  act,
  armorChoices,
  armorProf,
  bagOf,
  battleItem,
  boughtToday,
  canWear,
  coinsOf,
  currentWeekKey,
  dailyLimit,
  diffOf,
  flee,
  giftsToday,
  heroActions,
  heroLevel,
  heroOf,
  heroPending,
  heroStats,
  heroXp,
  hpPending,
  isGear,
  itemOf,
  levelOfXp,
  mergeDungeons,
  mergeMonsters,
  newRun,
  nextDailyPatch,
  nextFloor,
  nextRunsPatch,
  openChest,
  poolFor,
  registerCustomItems,
  romeDay,
  runsOf,
  storyLevelOf,
  subclassOf,
  timeout,
  useItem,
  validNewHero,
  validRespec,
  weaponChoices,
  withRng,
  wonItemInboxDoc,
  xpGain
});
