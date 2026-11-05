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
  KITS: () => KITS,
  MAX_STORY_LEVEL: () => MAX_STORY_LEVEL,
  RUN_COUNTS_AFTER: () => RUN_COUNTS_AFTER,
  SHOP_ITEMS: () => SHOP_ITEMS,
  STAT_KEYS: () => STAT_KEYS,
  STAT_MAX: () => STAT_MAX,
  WEEKLY_RUNS: () => WEEKLY_RUNS,
  act: () => act,
  bagOf: () => bagOf,
  battleItem: () => battleItem,
  boughtToday: () => boughtToday,
  coinsOf: () => coinsOf,
  currentWeekKey: () => currentWeekKey,
  dailyLimit: () => dailyLimit,
  flee: () => flee,
  heroActions: () => heroActions,
  heroOf: () => heroOf,
  heroPending: () => heroPending,
  heroStats: () => heroStats,
  hpPending: () => hpPending,
  itemOf: () => itemOf,
  levelOfXp: () => levelOfXp,
  mergeDungeons: () => mergeDungeons,
  newRun: () => newRun,
  nextDailyPatch: () => nextDailyPatch,
  nextFloor: () => nextFloor,
  nextRunsPatch: () => nextRunsPatch,
  poolFor: () => poolFor,
  romeDay: () => romeDay,
  runsOf: () => runsOf,
  storyLevelOf: () => storyLevelOf,
  timeout: () => timeout,
  useItem: () => useItem,
  validNewHero: () => validNewHero,
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
var XP_TABLE = [0, 300, 900, 2700, 6500, 14e3, 23e3, 34e3, 48e3, 64e3, 85e3, 1e5, 12e4, 14e4, 165e3, 195e3, 225e3, 265e3, 305e3, 355e3];
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
var xpForLevel = (lv) => XP_TABLE[Math.max(0, Math.min(MAX_STORY_LEVEL, lv) - 1)];
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
  stocco: { name: "Stocco", icon: "\u{1F5E1}", dice: "1d8", dmg: "piercing", wstat: "fin" },
  bastone: { name: "Bastone Ferrato", icon: "\u{1F9AF}", dice: "1d6", dmg: "bludgeoning", wstat: "str" },
  lancia: { name: "Lancia", icon: "\u{1F531}", dice: "1d6", dmg: "piercing", wstat: "str" },
  balestra_l: { name: "Balestra Leggera", icon: "\u{1F3F9}", dice: "1d8", dmg: "piercing", wstat: "dex", ranged: true },
  mazza: { name: "Mazza", icon: "\u{1F528}", dice: "1d6", dmg: "bludgeoning", wstat: "str" }
};
var WEAPON_CHOICES = {
  fighter: ["spada_lunga", "martello"],
  barbarian: ["ascia_bip", "maglio"],
  paladin: ["spada_lunga", "mazzafrusto"],
  ranger: ["arco_lungo", "scimitarra"],
  monk: ["bastone", "lancia"],
  rogue: ["stocco", "scimitarra"],
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
  return list.find((w) => w.key === key) || list[0];
}
var weaponAction = (w, plus = 0) => ({ id: "arma", name: plus ? `${w.name} +${plus}` : w.name, icon: w.icon, kind: "weapon", dice: w.dice, dmg: w.dmg, wstat: w.wstat, ranged: !!w.ranged, weaponKey: w.key, plus: plus || 0, info: `${w.dice}${plus ? `+${plus}` : ""} ${DMG_SHORT[w.dmg] || ""} \xB7 ${WSTAT_LABEL[w.wstat]}` });
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
    base: [{ id: "respiro", name: "Secondo Respiro", icon: "\u2764", kind: "heal", dice: "1d10", plusLevel: true, self: true, uses: 1 }],
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
      { id: "irruento", useWeapon: true, name: "Attacco Irruento", icon: "\u{1F624}", kind: "weapon", dice: "1d12", dmg: "slashing", adv: true, selfDis: true, min: 1, uses: 3, info: "vantaggio, ma \u22122 CA" },
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
    base: [{ id: "furtivo", useWeapon: true, name: "Attacco Furtivo", icon: "\u{1F312}", kind: "weapon", dice: "1d8", dmg: "piercing", rider: "sneak", riderDmg: "piercing", uses: 3, info: "+met\xE0 livello in d6" }],
    pool: [
      { id: "nascondersi", name: "Nascondersi", icon: "\u{1FAE5}", kind: "buff", buff: "adv", turns: 2, self: true, min: 1, uses: 2 },
      { id: "veleno_r", name: "Lama Avvelenata", icon: "\u2620", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, min: 1, uses: 2 },
      { id: "basso", useWeapon: true, name: "Colpo Basso", icon: "\u{1F9B5}", kind: "weapon", dice: "1d8", dmg: "piercing", riderDis: 2, min: 3, uses: 2, info: "il nemico a svantaggio" },
      { id: "prodigiosa", name: "Schivata Prodigiosa", icon: "\u{1F938}", kind: "buff", buff: "ac", value: 4, turns: 1, self: true, min: 3, uses: 2 },
      { id: "fumogena", name: "Bomba Fumogena", icon: "\u{1F4A8}", kind: "debuff", area: true, turns: 2, min: 6, uses: 1, info: "tutti i nemici a svantaggio" },
      { id: "assassinare", useWeapon: true, name: "Assassinare", icon: "\u{1F5E1}", kind: "weapon", dice: "1d8", dmg: "piercing", adv: true, rider: "4d6", riderDmg: "piercing", min: 9, uses: 1, grow: true }
    ]
  },
  wizard: {
    hitDie: 6,
    ac: 12,
    armor: "light",
    stat: "int",
    rec: ["int", "dex"],
    base: [{ id: "dardo_fuoco", name: "Dardo di Fuoco", icon: "\u{1F525}", kind: "spell", dice: "1d10", dmg: "fire", scale: true }, { id: "dardo_inc", name: "Dardo Incantato", icon: "\u2728", kind: "missile", dice: "3d4", flat: 3, dmg: "force", uses: 3, grow: true }],
    pool: [
      { id: "raggio_gelo", name: "Raggio di Gelo", icon: "\u2744", kind: "spell", dice: "1d8", dmg: "cold", scale: true, min: 1 },
      { id: "scudo", name: "Scudo", icon: "\u{1F6E1}", kind: "buff", buff: "ac", value: 5, turns: 1, self: true, min: 1, uses: 2 },
      { id: "mani_w", name: "Mani Brucianti", icon: "\u{1F590}", kind: "save", dice: "3d6", dmg: "fire", save: "dex", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "acida", name: "Freccia Acida", icon: "\u{1F9EA}", kind: "spell", dice: "4d4", dmg: "acid", min: 3, uses: 2, grow: true },
      { id: "palla_fuoco", name: "Palla di Fuoco", icon: "\u2604", kind: "save", dice: "8d6", dmg: "fire", save: "dex", area: true, half: true, min: 6, uses: 1, grow: true },
      { id: "ipnosi", name: "Trama Ipnotica", icon: "\u{1F300}", kind: "save", dice: "0d1", dmg: "psychic", save: "wis", area: true, stun: 1, min: 6, uses: 1, info: "chi fallisce resta stordito" },
      { id: "cono_freddo", name: "Cono di Freddo", icon: "\u{1F9CA}", kind: "save", dice: "8d8", dmg: "cold", save: "con", area: true, half: true, min: 9, uses: 1, grow: true }
    ]
  },
  sorcerer: {
    hitDie: 6,
    ac: 12,
    armor: "light",
    stat: "cha",
    rec: ["cha", "con"],
    base: [{ id: "fiotto", name: "Fiotto di Fuoco", icon: "\u{1F525}", kind: "spell", dice: "1d10", dmg: "fire", scale: true }, { id: "mani_br", name: "Mani Brucianti", icon: "\u{1F590}", kind: "save", dice: "3d6", dmg: "fire", save: "dex", area: true, half: true, uses: 2, grow: true }],
    pool: [
      { id: "veleno", name: "Spruzzo Velenoso", icon: "\u2620", kind: "save", dice: "1d12", dmg: "poison", save: "con", scale: true, min: 1 },
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
      { id: "paura", name: "Paura", icon: "\u{1F631}", kind: "debuff", area: true, turns: 2, min: 6, uses: 1, info: "tutti i nemici a svantaggio" },
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
    base: [{ id: "rovi", name: "Frusta di Rovi", icon: "\u{1F33F}", kind: "spell", dice: "1d6", dmg: "piercing", scale: true }, { id: "cura_d", name: "Cura Ferite", icon: "\u{1F49A}", kind: "heal", dice: "1d8", plusMod: true, uses: 3, grow: true }],
    pool: [
      { id: "onda", name: "Onda Tonante", icon: "\u{1F30A}", kind: "save", dice: "2d8", dmg: "thunder", save: "con", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "pelle", name: "Pelle di Corteccia", icon: "\u{1F333}", kind: "buff", buff: "ac", value: 3, turns: 3, min: 1, uses: 1 },
      { id: "lama_fiamma", name: "Lama di Fiamma", icon: "\u{1F525}", kind: "spell", dice: "3d6", dmg: "fire", min: 3, uses: 3, grow: true },
      { id: "luna", name: "Raggio di Luna", icon: "\u{1F319}", kind: "save", dice: "2d10", dmg: "radiant", save: "con", half: true, min: 3, uses: 2, grow: true },
      { id: "richiamo", name: "Richiamo del Fulmine", icon: "\u26A1", kind: "save", dice: "3d10", dmg: "lightning", save: "dex", half: true, min: 6, uses: 2, grow: true },
      { id: "tempesta", name: "Tempesta di Ghiaccio", icon: "\u{1F328}", kind: "save", dice: "4d6", dmg: "cold", save: "dex", area: true, half: true, min: 9, uses: 1, grow: true }
    ]
  },
  cleric: {
    hitDie: 8,
    ac: 18,
    armor: "heavy",
    stat: "wis",
    rec: ["wis", "con"],
    base: [{ id: "cura_c", name: "Cura Ferite", icon: "\u{1F49A}", kind: "heal", dice: "1d8", plusMod: true, uses: 3, grow: true }],
    pool: [
      { id: "fiamma", name: "Fiamma Sacra", icon: "\u{1F56F}", kind: "save", dice: "1d8", dmg: "radiant", save: "dex", scale: true, min: 1 },
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
    base: [{ id: "beffa", name: "Beffa Crudele", icon: "\u{1F3AD}", kind: "save", dice: "1d4", dmg: "psychic", save: "wis", scale: true, dis: 1, info: "e svantaggio al bersaglio" }],
    pool: [
      { id: "parola_b", name: "Parola Guaritrice", icon: "\u{1F3B5}", kind: "heal", dice: "1d4", plusMod: true, min: 1, uses: 3, grow: true },
      { id: "ispirazione", name: "Ispirazione Bardica", icon: "\u{1F3B6}", kind: "buff", buff: "adv", turns: 2, min: 1, uses: 2 },
      { id: "onda_b", name: "Onda Tonante", icon: "\u{1F30A}", kind: "save", dice: "2d8", dmg: "thunder", save: "con", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "sussurri", name: "Sussurri Dissonanti", icon: "\u{1F442}", kind: "save", dice: "3d6", dmg: "psychic", save: "wis", half: true, min: 3, uses: 2, grow: true },
      { id: "riposo", name: "Canto di Riposo", icon: "\u{1F3BC}", kind: "heal_all", dice: "1d8", plusMod: true, min: 3, uses: 1, grow: true },
      { id: "risata", name: "Risata Incontenibile", icon: "\u{1F602}", kind: "save", dice: "0d1", dmg: "psychic", save: "wis", stun: 1, min: 6, uses: 1, info: "chi fallisce resta stordito" }
    ]
  }
};
var DEFEND = { id: "difesa", name: "Difendersi", icon: "\u{1F6E1}", kind: "defend", info: "+4 CA fino al tuo prossimo turno" };
var kitOf = (cls) => KITS[cls] || KITS.fighter;
var poolFor = (cls, lv) => kitOf(cls).pool.filter((a) => (a.min || 1) <= lv);
function heroActions(cls, lv, picks = [], weapon = null, plus = 0) {
  const k = kitOf(cls);
  const w = weaponOf(cls, weapon);
  const withWeapon = (a) => a.useWeapon ? { ...a, dice: w.dice, dmg: w.dmg, wstat: w.wstat, ranged: !!w.ranged, plus: plus || 0 } : a;
  const chosen = k.pool.filter((a) => picks.includes(a.id) && (a.min || 1) <= lv);
  return [weaponAction(w, plus), ...k.base.map(withWeapon), ...chosen.map(withWeapon), DEFEND];
}
function heroStats(hero) {
  const out = {};
  STAT_KEYS.forEach((k) => {
    out[k] = Math.min(STAT_MAX, (Number(hero?.stats?.[k]) || 0) + (Number(hero?.asi?.[k]) || 0));
  });
  return out;
}
var mainMod = (cls, st) => st[kitOf(cls).stat] || 0;
var hpPending = (hero) => Math.max(0, levelOfXp(hero?.xp) - (Array.isArray(hero?.hpRolls) ? hero.hpRolls.length : 0));
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
function heroAc(cls, st) {
  const k = kitOf(cls);
  if (k.armor === "heavy") return k.ac;
  if (k.armor === "unarmored") return 10 + (st.dex || 0) + (st[k.unarmored] || 0);
  return k.ac - 3 + (st.dex || 0);
}
var heroDc = (cls, lv, st) => 8 + profOf(lv) + mainMod(cls, st);
var heroHit = (cls, lv, st) => profOf(lv) + mainMod(cls, st);
function attacksOf(cls, lv, action) {
  const extra = lv >= 5 && kitOf(cls).extraAttacks && action.kind === "weapon" ? 1 + (cls === "fighter" && lv >= 11) : 0;
  return (action.attacks || 1) + extra + (action.bonusAttacks || 0);
}
function validNewHero(cls, stats, pick2, weapon) {
  if (!KITS[cls]) return "Classe sconosciuta.";
  if (!weaponChoices(cls).some((w) => w.key === weapon)) return "Scegli l'arma.";
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
function heroPending(hero) {
  const lv = levelOfXp(hero?.xp);
  const asiSpent = STAT_KEYS.reduce((t, k) => t + (Number(hero?.asi?.[k]) || 0), 0);
  return { level: lv, asi: Math.max(0, asiEarned(lv) - asiSpent), picks: Math.max(0, picksAllowed(lv) - (hero?.picks || []).length) };
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
  pozione: { name: "Pozione di Guarigione", icon: "\u{1F9EA}", kind: "heal", dice: "2d4", flat: 2, price: 25, daily: 3, rarity: "common", desc: "Cura 2d4+2 PF a te o a un alleato in piedi." },
  pozione_magg: { name: "Pozione di Guarigione Maggiore", icon: "\u{1F377}", kind: "heal", dice: "4d4", flat: 4, price: 90, daily: 2, rarity: "uncommon", desc: "Cura 4d4+4 PF a te o a un alleato in piedi." },
  pozione_sup: { name: "Pozione di Guarigione Superiore", icon: "\u2697", kind: "heal", dice: "8d4", flat: 8, price: 250, daily: 1, rarity: "rare", desc: "Cura 8d4+8 PF a te o a un alleato in piedi." },
  tonico: { name: "Tonico Purificante", icon: "\u{1F33F}", kind: "cleanse", price: 40, daily: 2, rarity: "common", desc: "Toglie svantaggio, stordimento e irruenza a te o a un alleato." },
  pelle_pietra: { name: "Pozione di Pelle di Pietra", icon: "\u{1FAA8}", kind: "buff", buff: "ac", value: 2, turns: 3, price: 90, daily: 1, rarity: "uncommon", desc: "+2 CA per 3 round a te o a un alleato." },
  eroismo: { name: "Pozione dell'Eroismo", icon: "\u{1F9B8}", kind: "buff", buff: "adv", turns: 2, price: 100, daily: 1, rarity: "uncommon", desc: "Vantaggio agli attacchi per 2 round a te o a un alleato." },
  fuoco_alch: { name: "Fuoco dell'Alchimista", icon: "\u{1F525}", kind: "throw", dice: "2d6", dmg: "fire", price: 50, daily: 2, rarity: "common", desc: "Lanci la fiala su un nemico: 2d6 fuoco, colpisce sempre." },
  acido: { name: "Fiala d'Acido", icon: "\u{1FAD9}", kind: "throw", dice: "2d6", dmg: "acid", price: 50, daily: 2, rarity: "common", desc: "Lanci la fiala su un nemico: 2d6 acido, colpisce sempre." },
  acqua_santa: { name: "Acqua Santa", icon: "\u{1F4A7}", kind: "throw", dice: "2d8", dmg: "radiant", price: 80, daily: 1, rarity: "uncommon", desc: "Su un nemico: 2d8 radiosi, colpisce sempre." },
  pietra_tuono: { name: "Pietra del Tuono", icon: "\u{1F4A5}", kind: "throw_area", dice: "2d6", dmg: "thunder", save: "con", dc: 13, price: 140, daily: 1, rarity: "uncommon", desc: "Esplode fra i nemici: 2d6 tuono a tutti, TS COS CD 13 per met\xE0." },
  piuma_fenice: { name: "Piuma della Fenice", icon: "\u{1FAB6}", kind: "revive", pct: 50, price: 400, daily: 1, rarity: "rare", desc: "Rialza un alleato a terra con met\xE0 dei PF." }
};
var WEAPON_ITEMS = {};
Object.entries(WEAPONS).forEach(([k, w]) => {
  WEAPON_ITEMS[`${k}_1`] = { name: `${w.name} +1`, icon: w.icon, kind: "weapon", base: k, plus: 1, price: 1200, daily: 1, rarity: "rare", desc: `${w.dice} +1 a colpire e ai danni. Si equipaggia sull'eroe che usa questo tipo d'arma.` };
  WEAPON_ITEMS[`${k}_2`] = { name: `${w.name} +2`, icon: w.icon, kind: "weapon", base: k, plus: 2, price: 0, rarity: "veryRare", desc: `${w.dice} +2 a colpire e ai danni. Si trova solo nelle Segrete.` };
});
var ITEMS = { ...BASE_ITEMS, ...WEAPON_ITEMS };
var itemOf = (id) => ITEMS[id] ? { id, ...ITEMS[id] } : null;
var SHOP_ITEMS = Object.keys(ITEMS).filter((id) => ITEMS[id].price > 0);
var battleItem = (id) => {
  const it = itemOf(id);
  return it && it.kind !== "weapon" ? it : null;
};
function itemTarget(it) {
  if (!it) return null;
  if (it.kind === "throw") return "foe";
  if (it.kind === "throw_area") return null;
  if (it.kind === "revive") return "downed";
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
function rollDropItem(rnd2, weaponBases = [], role = "minion") {
  const pool = Object.keys(ITEMS).filter((id) => {
    const it = ITEMS[id];
    if (it.kind === "weapon") return weaponBases.includes(it.base);
    return true;
  });
  const boost = role === "boss" ? { rare: 2, veryRare: 2.5 } : role === "elite" ? { rare: 1.4, veryRare: 1.5 } : {};
  const weapons = pool.filter((id) => ITEMS[id].kind === "weapon").length || 1;
  const weight = (id) => {
    const it = ITEMS[id];
    const w = RARITY[it.rarity].w * (boost[it.rarity] || 1);
    return it.kind === "weapon" ? w * 2 / weapons : w;
  };
  const tot = pool.reduce((t, id) => t + weight(id), 0);
  let r = rnd2() * tot;
  for (const id of pool) {
    r -= weight(id);
    if (r <= 0) return id;
  }
  return pool[pool.length - 1];
}
var romeDay = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
function boughtToday(charData, id, day = romeDay()) {
  const d = charData?.storyShopDay;
  return d && d.day === day ? Number(d.n?.[id]) || 0 : 0;
}
var dailyLimit = (id) => Number(ITEMS[id]?.daily) || 1;

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
var AFK_DEFEND_MS = 5 * 60 * 1e3;
var ROOM_IDLE_MS = 3 * 60 * 60 * 1e3;
var DEFAULT_DUNGEONS = [
  { key: "segrete", name: "Le Segrete", icon: "\u26D3", desc: "Celle umide, catene e guardie che non dormono mai. Non morti e banditi." },
  { key: "caverna", name: "La Caverna", icon: "\u{1F573}", desc: "Gallerie strette nel buio: bestie, goblin e ragni giganti." },
  { key: "magma", name: "Caverna di Magma", icon: "\u{1F30B}", desc: "Fiumi di lava e aria che brucia: elementali del fuoco e salamandre." }
];
var STORY_CLASSES = ARENA_CLASSES.map(({ key, it, icon }) => ({ key, it, icon }));
var heroOf = (charData, classKey) => charData?.storyChars?.[classKey] || null;
function storyLevelOf(charData, classKey) {
  const h = heroOf(charData, classKey);
  return h ? levelOfXp(h.xp) : 1;
}
function mergeDungeons(custom = []) {
  const map = new Map(DEFAULT_DUNGEONS.map((d) => [d.key, d]));
  custom.forEach((d) => {
    if (d?.key) map.set(d.key, { ...map.get(d.key) || {}, ...d });
  });
  return [...map.values()].filter((d) => !d.hidden);
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
var DAILY_RUNS = 1;
var DAILY_TOTAL = 3;
var dailyTotalOf = (charData, day = romeDayKey()) => charData?.storyDaily?.day === day ? Number(charData.storyDaily.count) || 0 : 0;
var nextDailyPatch = (charData, day = romeDayKey()) => ({ day, count: dailyTotalOf(charData, day) + 1 });
var WEEKLY_RUNS = 3;
var RUN_COUNTS_AFTER = 2;
var romeDayKey = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
function runsOf(charData, cls, week = currentWeekKey(), day = romeDayKey()) {
  const r = charData?.storyClassRuns?.[cls];
  const weekCount = r && r.weekKey === week ? Number(r.count) || 0 : 0;
  const dayCount = r && r.weekKey === week && r.day === day ? Number(r.dayCount) || 0 : 0;
  const total = dailyTotalOf(charData, day);
  const totalFull = total >= DAILY_TOTAL;
  return { weekCount, dayCount, total, totalFull, canRun: !totalFull && weekCount < WEEKLY_RUNS && dayCount < DAILY_RUNS };
}
function nextRunsPatch(charData, cls, week = currentWeekKey(), day = romeDayKey()) {
  const { weekCount, dayCount } = runsOf(charData, cls, week, day);
  return { weekKey: week, count: weekCount + 1, day, dayCount: dayCount + 1 };
}

// src/data/segreteEngine.js
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
function parseDice(str) {
  const m = /^(\d+)d(\d+)$/.exec(String(str || "").trim());
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
var WB_DMG = { fuoco: "fire", ghiaccio: "cold", fulmine: "lightning", veleno: "poison", "oscurit\xE0": "necrotic", sacro: "radiant", fisico: "slashing", arcano: "force" };
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
  const lv = levelOfXp(hero.xp);
  const st = heroStats(hero);
  const picks = Array.isArray(hero.picks) ? hero.picks : [];
  const maxHp = heroMaxHp(m.cls, lv, st, hero.hpRolls || []);
  const wItem = itemOf(hero.weaponItem);
  const okItem = wItem?.kind === "weapon" && weaponChoices(m.cls).some((w) => w.key === wItem.base);
  const weaponKey = okItem ? wItem.base : hero.weapon || null;
  const weaponPlus = okItem ? wItem.plus || 0 : 0;
  const uses = {};
  heroActions(m.cls, lv, picks, weaponKey, weaponPlus).forEach((a) => {
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
    hp: maxHp,
    maxHp,
    ac: heroAc(m.cls, st),
    init: st.dex || 0,
    save: Math.floor(profOf(lv) / 2),
    st,
    picks,
    weapon: weaponKey,
    weaponPlus,
    fx: {},
    uses
  };
}
function xpGain(level, floors) {
  if (level >= MAX_STORY_LEVEL) return 0;
  return Math.round((xpForLevel(level + 1) - xpForLevel(level)) * (0.08 * (floors || 3) + 0.12));
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
function buildEncounter(bestiary, { floor, floors, partyLevel: partyLevel2, partySize }) {
  const boss = floor > floors;
  const own = bestiary.filter((m) => !m._anyBoss);
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
    for (let i = 0; i < escort; i++) picks.push(elites.length && rnd() < 0.3 ? pick(elites) : pick(mins));
  } else {
    let mins = fit("minion", partyLevel2 + 1);
    const elites = fit("elite", partyLevel2 + 2);
    if (!mins.length) mins = elites.length ? elites : FALLBACK_MONSTERS.filter((m) => m.role === "minion");
    const [lo, hi] = partySize <= 1 ? floor >= 2 ? [2, 3] : [1, 2] : [partySize, Math.min(5, partySize + 1)];
    let count = lo + Math.floor(rnd() * (hi - lo + 1));
    if (floor >= 2 && elites.length && rnd() < 0.4) {
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
  return ac;
}
var curVfx = null;
var curTags = {};
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
  const nextSeen = {};
  all.forEach((f) => {
    nextSeen[f.id] = f.hp;
  });
  s.hpSeen = nextSeen;
  s.log = [...s.log || [], row].slice(-LOG_MAX);
}
var EL_OF = { fire: "fire", cold: "frost", lightning: "lightning", thunder: "lightning", poison: "poison", acid: "poison", necrotic: "darkness", radiant: "radiant", force: "arcane", psychic: "arcane" };
var elOf = (type) => EL_OF[type] || "physical";
var RANGED = /* @__PURE__ */ new Set(["arco", "doppio", "lancio"]);
function heroVfx(a) {
  if (a.kind === "defend") return { fx: "shield", el: "arcane" };
  if (a.kind === "weapon") return { fx: a.ranged || RANGED.has(a.id) ? "arrow" : "slash", el: a.riderDmg && elOf(a.riderDmg) !== "physical" ? elOf(a.riderDmg) : elOf(a.dmg) };
  if (a.kind === "spell" || a.kind === "missile") return { fx: "bolt", el: elOf(a.dmg) };
  if (a.kind === "save") return { fx: a.area ? "aoe" : "bolt", el: elOf(a.dmg) };
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
  if (area) return { fx: "aoe", el };
  if (el === "physical" && a.hitMode !== "save") return { fx: /arco|frecc|balest|giavell|fionda|lancio/i.test(a.name || "") ? "arrow" : "slash", el };
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
    dungeonName: dungeon.name,
    dungeonIcon: dungeon.icon || "\u{1F5DD}",
    bg: (dungeon.backgrounds || []).length ? pick(dungeon.backgrounds) : "",
    floors: dungeon.floors || 3,
    floor: 1,
    status: "fight",
    corone: Number.isFinite(Number(dungeon.corone)) ? Number(dungeon.corone) : 5,
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
  const heroHp = live.reduce((t, h) => t + Math.max(5, (h.maxHp || 10) - HERO_HP_BASE), 0) || 10;
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
  s.foes = balanceFoes(buildEncounter(bestiary, { floor: s.floor, floors: s.floors, partyLevel: partyLevel(s), partySize: s.heroes.filter((h) => !h.fled).length }), s.heroes, s.boss);
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
  } else if (fxOn(s, target.fx.rage) && PHYS.includes(type)) {
    dmg = Math.floor(dmg / 2);
    notes.push("in furia");
    curTags[target.id] = "rage";
  }
  target.hp = Math.max(0, target.hp - dmg);
  return dmg;
}
function attackRoll(s, att, def, bonus, { adv = false } = {}) {
  let a = adv || fxOn(s, att.fx.adv);
  let d = fxOn(s, att.fx.dis);
  if (a && d) {
    a = false;
    d = false;
  }
  const r1 = d20();
  const r2 = a || d ? d20() : null;
  const nat = r2 == null ? r1 : a ? Math.max(r1, r2) : Math.min(r1, r2);
  const total = nat + bonus;
  const ac = acOf(s, def);
  return { nat, dice: r2 == null ? [r1] : [r1, r2], total, ac, hit: nat === 20 || nat !== 1 && total >= ac, crit: nat === 20, adv: a, dis: d };
}
var advTag = (r) => r.adv ? " (vantaggio)" : r.dis ? " (svantaggio)" : "";
var dmgBonusOf = (s, c) => (fxOn(s, c.fx.dmg) ? c.fx.dmg.v : 0) + (fxOn(s, c.fx.rage) ? c.fx.rage.v : 0);
var downTxt = (t) => t.hp <= 0 ? t.side === "f" ? ` \u{1F480} ${t.name} cade!` : ` \u{1F480} ${t.name} \xE8 a terra!` : "";
function heroActionList(h) {
  return heroActions(h.cls, h.level, h.picks || [], h.weapon, h.weaponPlus || 0).map((a) => ({ ...a, left: a.uses ? h.uses?.[a.id] ?? a.uses : null }));
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
  const hit = heroHit(h.cls, lv, st);
  const mod = mainMod(h.cls, st);
  const healMod = st[kitOf(h.cls).healStat] ?? mod;
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
  if (a.kind === "weapon" || a.kind === "spell") {
    const n = attacksOf(h.cls, lv, a);
    const wm = a.kind === "weapon" ? weaponMod(h.cls, st, a) : mod;
    const hitW = a.kind === "weapon" ? profOf(lv) + wm + (a.plus || 0) : hit;
    if (a.selfDis) h.fx.reckless = s.round + 1;
    for (let k = 0; k < n; k++) {
      if (!alive(target)) {
        const others = s.foes.filter(alive);
        if (!others.length) break;
        target = others[0];
      }
      const r = attackRoll(s, h, target, hitW, { adv: !!a.adv });
      if (k === 0) ev.roll = { nat: r.nat, dice: r.dice };
      if (!r.hit) {
        log(s, `${a.icon} ${h.name} \u2192 ${a.name} su ${target.name}: manca (\u{1F3B2}${r.nat}+${hitW}=${r.total} vs CA ${r.ac})${advTag(r)}.`, { kind: "miss", actor: h.id, targets: [target.id] });
        continue;
      }
      let [dn, ds] = diceFor(a, lv);
      if (r.crit) dn *= 2;
      let dmg = roll(dn, ds).t + (a.kind === "weapon" ? wm + (a.plus || 0) + dmgBonusOf(s, h) : 0);
      if (a.bonusDmg === "lv/2") dmg += Math.floor(lv / 2);
      const notes = [];
      let total = applyDamage(s, target, dmg, a.dmg, notes);
      let extra = "";
      if (a.rider && k === 0 && alive(target)) {
        let rn, rs;
        if (a.rider === "sneak") {
          rn = Math.ceil(lv / 2);
          rs = 6;
        } else {
          [rn, rs] = diceFor({ ...a, dice: a.rider }, lv);
        }
        if (r.crit) rn *= 2;
        const rd = applyDamage(s, target, roll(rn, rs).t, a.riderDmg || a.dmg, notes);
        total += rd;
        extra = ` +${rd} ${DMG_IT[a.riderDmg] || ""}`;
      }
      if (a.riderDis && alive(target)) {
        target.fx.dis = s.round + 1 + a.riderDis;
        extra += " \xB7 a svantaggio";
      }
      if (a.stunSave && alive(target)) {
        const sv = d20() + (target.save || 0);
        if (sv < heroDc(h.cls, lv, st)) {
          target.fx.stun = true;
          extra += ` \xB7 \u{1F4AB} stordito (TS ${sv})`;
        } else extra += ` \xB7 resiste allo stordimento (${sv})`;
      }
      if (a.drain && total > 0) {
        const before = h.hp;
        h.hp = Math.min(h.maxHp, h.hp + Math.floor(total / 2));
        extra += ` \xB7 si cura di ${h.hp - before}`;
      }
      log(
        s,
        `${a.icon} ${h.name} \u2192 ${a.name} su ${target.name}: ${r.crit ? "CRITICO! " : ""}${total} danni ${DMG_IT[a.dmg] || ""}${extra ? ` (di cui${extra})` : ""} (\u{1F3B2}${r.nat}+${hitW}=${r.total})${advTag(r)}${notes.length ? ` \xB7 ${notes.join(", ")}` : ""}.${downTxt(target)}`,
        { kind: r.crit ? "crit" : "hit", actor: h.id, targets: [target.id], dmg: total }
      );
    }
    return ev;
  }
  if (a.kind === "missile") {
    const [dn, ds] = diceFor(a, lv);
    const notes = [];
    const dmg = applyDamage(s, target, roll(dn, ds).t + flatOf(a.flat) + (a.plusMod ? mod : 0), a.dmg, notes);
    log(s, `${a.icon} ${h.name} \u2192 ${a.name} su ${target.name}: colpisce sempre, ${dmg} danni ${DMG_IT[a.dmg]}${notes.length ? ` \xB7 ${notes.join(", ")}` : ""}.${downTxt(target)}`, { kind: "hit", actor: h.id, targets: [target.id], dmg });
    return ev;
  }
  if (a.kind === "save") {
    const dc = heroDc(h.cls, lv, st);
    const targets = a.area ? s.foes.filter(alive) : [target];
    const [dn, ds] = diceFor(a, lv);
    const base = roll(dn, ds).t + flatOf(a.flat);
    const parts = [];
    targets.forEach((t) => {
      const sv = d20() + (t.save || 0);
      const ok = sv >= dc;
      const notes = [];
      const dmg = ok ? a.half ? applyDamage(s, t, Math.floor(base / 2), a.dmg, notes) : 0 : applyDamage(s, t, base, a.dmg, notes);
      if (!ok && a.stun && alive(t)) t.fx.stun = true;
      if (!ok && a.dis && alive(t)) t.fx.dis = s.round + 1 + a.dis;
      parts.push(`${t.name} ${ok ? "resiste" : "fallisce"} (${sv}) \u2212${dmg}${notes.length ? ` ${notes.join(",")}` : ""}${!ok && a.stun && alive(t) ? " \u{1F4AB} stordito" : ""}${t.hp <= 0 ? " \u{1F480}" : ""}`);
    });
    log(s, `${a.icon} ${h.name} \u2192 ${a.name} (TS ${a.save.toUpperCase()} CD ${dc}): ${parts.join(" \xB7 ")}.`, { kind: "hit", actor: h.id, targets: targets.map((t) => t.id) });
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
      t.fx.dis = s.round + (a.turns || 1) + 1;
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
    });
    const what = a.buff === "ac" ? `+${a.value} CA` : a.buff === "adv" ? "vantaggio agli attacchi" : a.buff === "rage" ? `+${a.value} danni e danni fisici dimezzati` : `+${a.value} danni`;
    log(s, `${a.icon} ${h.name} \u2192 ${a.name}: ${tg.map((t) => t.name).join(", ")} ${what} per ${a.turns} ${a.turns === 1 ? "turno" : "turni"}.`, { kind: "buff", actor: h.id, targets: tg.map((t) => t.id) });
    return ev;
  }
  return ev;
}
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
  let a;
  if (hurt && heals.length && rnd() < 0.8) a = pick(heals);
  else if (areas.length && heroes.length >= 2 && rnd() < 0.55) a = pick(areas);
  else if (buffs.length && rnd() < 0.25) a = pick(buffs);
  else if (debuffs.length && rnd() < 0.25) a = pick(debuffs);
  else a = singles.length ? pick(singles) : pick(acts);
  const weakest = [...heroes].sort((x, y) => x.hp - y.hp)[0];
  const lastHitter = heroes.find((h) => h.id === f.lastHitBy);
  const tgt = rnd() < 0.45 ? weakest : lastHitter && rnd() < 0.5 ? lastHitter : pick(heroes);
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
    const hmax = (f.cap?.dmg || 99) * 1.2;
    const amt = Math.max(1, Math.round(raw * Math.min(1, hmax / Math.max(1, avgDice(hn, hs) + (Number(a.bonus) || 0)))));
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
    const tg = a.aoeShape && a.aoeShape !== "single" ? heroes : [tgt];
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
    const tg = a.aoeShape && a.aoeShape !== "single" ? heroes : [tgt];
    const dc = f.cap?.dc ?? (Number(a.saveDC) || 12) + (f.adapt?.hit || 0);
    const base = Math.max(1, Math.round((roll(n, sides).t + lvlBonus) * (f.adapt?.mult || 1) * capMult(n, sides, tg.length)));
    const parts = tg.map((t) => {
      const sv = d20() + (t.save || 0) + (t.st?.[a.saveAbility || "dex"] || 0);
      const ok = sv >= dc;
      const dmg2 = ok ? a.halfOnSave !== false ? applyDamage(s, t, Math.floor(base / 2), type, []) : 0 : applyDamage(s, t, base, type, []);
      return `${t.name} ${ok ? "resiste" : "fallisce"} (${sv}) \u2212${dmg2}${t.hp <= 0 ? " \u{1F480}" : ""}`;
    });
    log(s, `\u{1F300} ${f.name} \u2192 ${nm} (TS ${String(a.saveAbility || "dex").toUpperCase()} CD ${dc}): ${parts.join(" \xB7 ")}.`, { kind: "hit", actor: f.id, targets: tg.map((t) => t.id) });
    return;
  }
  const bonus = f.cap?.hit ?? (Number(a.bonus) || 3) + (f.adapt?.hit || 0);
  const r = attackRoll(s, f, tgt, bonus);
  if (!r.hit) {
    log(s, `\u2694 ${f.name} \u2192 ${nm} su ${tgt.name}: manca (\u{1F3B2}${r.nat}+${bonus}=${r.total} vs CA ${r.ac})${advTag(r)}.`, { kind: "miss", actor: f.id, targets: [tgt.id] });
    return;
  }
  const dmg = applyDamage(s, tgt, Math.max(1, Math.round((roll(r.crit ? n * 2 : n, sides).t + lvlBonus) * (f.adapt?.mult || 1) * capMult(n, sides, 1))), type, []);
  log(s, `\u2694 ${f.name} \u2192 ${nm} su ${tgt.name}: ${r.crit ? "CRITICO! " : ""}${dmg} danni ${DMG_IT[type] || ""} (\u{1F3B2}${r.nat}+${bonus}=${r.total})${advTag(r)}.${downTxt(tgt)}`, { kind: r.crit ? "crit" : "hit", actor: f.id, targets: [tgt.id], dmg });
}
function checkEnd(s) {
  if (!s.heroes.some(alive)) {
    s.status = "lost";
    log(s, "\u2620 Il gruppo \xE8 caduto. Le Segrete si richiudono su di voi: tutto \xE8 perduto.", { kind: "end" });
    return true;
  }
  if (!s.foes.some(alive)) {
    floorCoins(s);
    if (s.boss) {
      s.status = "won";
      log(s, `\u{1F3C6} Il boss \xE8 caduto! Avete conquistato ${s.dungeonName}.`, { kind: "end" });
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
}
function monsterPhase(s, now) {
  for (const id of s.order) {
    if (checkEnd(s)) return;
    const f = byId(s, id);
    if (!alive(f) || f.side !== "f") continue;
    if (f.fx.stun) {
      f.fx.stun = false;
      log(s, `\u{1F4AB} ${f.name} \xE8 stordito e salta il turno.`, { kind: "debuff", actor: f.id });
      continue;
    }
    foeAct(s, f);
    curVfx = null;
  }
  if (checkEnd(s)) return;
  s.round += 1;
  startHeroPhase(s, now);
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
  const tk = targetKind(a);
  let target = null;
  if (tk === "foe") target = foeTarget(s, h, targetId);
  if (tk === "ally") {
    target = byId(s, targetId);
    const heal = a.kind === "heal";
    if (!target || target.side !== "h" || target.fled || !heal && !alive(target)) throw new Error("Scegli un alleato.");
  }
  if (a.uses) h.uses = { ...h.uses, [a.id]: (h.uses?.[a.id] ?? a.uses) - 1 };
  curVfx = heroVfx(a) ? { ...heroVfx(a), from: h.id } : null;
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
  const got = s.heroes.filter((h) => !h.fled).map((h) => {
    const c = die(FLOOR_COINS_DIE);
    addSpoil(s, h.uid, { coins: c, src: s.boss ? "boss sconfitto" : `sala ${s.floor} ripulita` });
    return `${h.name} ${c}`;
  });
  if (got.length) log(s, `\u{1FA99} Monete Antiche dalla sala: ${got.join(" \xB7 ")}.`, { kind: "loot" });
}
function lootDead(s) {
  const heroes = s.heroes.filter((h) => !h.fled);
  if (!heroes.length) return;
  const bases = [...new Set(heroes.map((h) => h.weapon).filter(Boolean))];
  s.foes.forEach((f) => {
    if (alive(f) || f.looted) return;
    f.looted = true;
    const ch = DROP_CHANCE[f.role] || DROP_CHANCE.minion;
    const faces = heroes.length * 2;
    const r = die(faces);
    const who = heroes[Math.min(heroes.length - 1, Math.ceil(r / 2) - 1)];
    const parts = [];
    if (die(100) <= ch.coins) {
      const c = roll(ch.coinDice[0], ch.coinDice[1]).t;
      addSpoil(s, who.uid, { coins: c, src: f.name });
      parts.push(`\u{1FA99} ${c} Monete Antiche`);
    }
    if (die(100) <= ch.item) {
      const id = rollDropItem(rnd, bases, f.role);
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
  } else if (it.kind === "cleanse") {
    curVfx = { fx: "buff", el: "radiant", from: h.id };
    target.fx = { ...target.fx, dis: 0, stun: false, reckless: 0 };
    log(s, `${it.icon} ${h.name} usa ${it.name}${on}: via svantaggio e stordimento.`, { kind: "buff", actor: h.id, targets: [target.id] });
  } else if (it.kind === "buff") {
    curVfx = { fx: it.buff === "ac" ? "shield" : "buff", el: "arcane", from: h.id };
    const until = s.round + (it.turns || 1) + 1;
    if (it.buff === "ac") target.fx.ac = [...(target.fx.ac || []).filter((e) => fxOn(s, e)), { v: it.value, until }];
    if (it.buff === "adv") target.fx.adv = until;
    log(s, `${it.icon} ${h.name} usa ${it.name}${on}: ${it.buff === "ac" ? `+${it.value} CA` : "vantaggio agli attacchi"} per ${it.turns} round.`, { kind: "buff", actor: h.id, targets: [target.id] });
  } else if (it.kind === "throw") {
    curVfx = { fx: "bolt", el: elOf(it.dmg), from: h.id };
    const [n, sd] = parseDice(it.dice);
    const notes = [];
    const dmg = applyDamage(s, target, roll(n, sd).t, it.dmg, notes);
    target.lastHitBy = h.id;
    log(s, `${it.icon} ${h.name} lancia ${it.name} su ${target.name}: ${dmg} danni ${DMG_IT[it.dmg] || ""}${notes.length ? ` \xB7 ${notes.join(", ")}` : ""}.${downTxt(target)}`, { kind: "hit", actor: h.id, targets: [target.id], dmg });
  } else if (it.kind === "throw_area") {
    curVfx = { fx: "aoe", el: elOf(it.dmg), from: h.id };
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
function timeout(s, now) {
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
    heroActions(h.cls, h.level, h.picks || [], h.weapon, h.weaponPlus || 0).forEach((a) => {
      if (a.uses) uses[a.id] = a.uses;
    });
    h.uses = uses;
  });
  s.floor += 1;
  log(s, "\u{1F525} Breve riposo: recuperate fiato e incantesimi.", { kind: "room" });
  startFloor(s, bestiary, now);
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
  KITS,
  MAX_STORY_LEVEL,
  RUN_COUNTS_AFTER,
  SHOP_ITEMS,
  STAT_KEYS,
  STAT_MAX,
  WEEKLY_RUNS,
  act,
  bagOf,
  battleItem,
  boughtToday,
  coinsOf,
  currentWeekKey,
  dailyLimit,
  flee,
  heroActions,
  heroOf,
  heroPending,
  heroStats,
  hpPending,
  itemOf,
  levelOfXp,
  mergeDungeons,
  newRun,
  nextDailyPatch,
  nextFloor,
  nextRunsPatch,
  poolFor,
  romeDay,
  runsOf,
  storyLevelOf,
  timeout,
  useItem,
  validNewHero,
  weaponChoices,
  withRng,
  wonItemInboxDoc,
  xpGain
});
