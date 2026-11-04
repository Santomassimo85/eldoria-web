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
  DEFAULT_FLOORS: () => DEFAULT_FLOORS,
  MAX_STORY_LEVEL: () => MAX_STORY_LEVEL,
  WEEKLY_RUNS: () => WEEKLY_RUNS,
  act: () => act,
  currentWeekKey: () => currentWeekKey,
  flee: () => flee,
  mergeDungeons: () => mergeDungeons,
  newRun: () => newRun,
  nextFloor: () => nextFloor,
  nextRunsPatch: () => nextRunsPatch,
  runsOf: () => runsOf,
  storyLevelOf: () => storyLevelOf,
  timeout: () => timeout,
  withRng: () => withRng,
  wonItemInboxDoc: () => wonItemInboxDoc
});
module.exports = __toCommonJS(segreteServer_exports);

// src/data/segreteKits.js
var MAX_STORY_LEVEL = 20;
var HERO_HP_MULT = 1.35;
var profOf = (lv) => 2 + Math.floor((Math.max(1, lv) - 1) / 4);
var modOf = (lv) => lv >= 8 ? 5 : lv >= 4 ? 4 : 3;
var cantripMult = (lv) => 1 + (lv >= 5) + (lv >= 11) + (lv >= 17);
var W = (id, name, icon, dice, dmg, extra = {}) => ({ id, name, icon, kind: "weapon", dice, dmg, unlock: 1, ...extra });
var KITS = {
  fighter: { hitDie: 10, ac: 17, stat: "str", dexInit: false, extraAttacks: true, actions: [
    W("spada", "Spada Lunga", "\u2694", "1d8", "slashing"),
    { id: "poderoso", name: "Attacco Poderoso", icon: "\u{1F4A5}", kind: "weapon", dice: "1d8", dmg: "slashing", bonusDmg: "lv/2", unlock: 1, uses: 2, info: "+met\xE0 livello ai danni" },
    { id: "respiro", name: "Secondo Respiro", icon: "\u2764", kind: "heal", dice: "1d10", plusLevel: true, self: true, unlock: 2, uses: 1 },
    { id: "parata", name: "Muro di Scudi", icon: "\u{1F6E1}", kind: "buff", buff: "ac", value: 3, turns: 2, self: true, unlock: 3, uses: 1 }
  ] },
  barbarian: { hitDie: 12, ac: 15, stat: "str", extraAttacks: true, actions: [
    W("ascia", "Ascia Bipenne", "\u{1FA93}", "1d12", "slashing"),
    { id: "furia", name: "Furia", icon: "\u{1F4A2}", kind: "buff", buff: "rage", value: 2, turns: 3, self: true, unlock: 1, uses: 1, info: "+2 danni, dimezza i danni fisici" },
    { id: "irruento", name: "Attacco Irruento", icon: "\u{1F624}", kind: "weapon", dice: "1d12", dmg: "slashing", adv: true, selfDis: true, unlock: 2, uses: 3, info: "vantaggio, ma \u22122 CA fino al prossimo turno" }
  ] },
  paladin: { hitDie: 10, ac: 18, stat: "str", extraAttacks: true, actions: [
    W("spada", "Spada Lunga", "\u2694", "1d8", "slashing"),
    { id: "punizione", name: "Punizione Divina", icon: "\u26A1", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "2d8", riderDmg: "radiant", unlock: 2, uses: 2, grow: true },
    { id: "mani", name: "Imposizione delle Mani", icon: "\u{1F64C}", kind: "heal", flat: "lv*5", unlock: 1, uses: 1 },
    { id: "aura", name: "Aura di Protezione", icon: "\u{1F31F}", kind: "buff", buff: "ac", value: 2, turns: 3, allParty: true, unlock: 6, uses: 1 }
  ] },
  ranger: { hitDie: 10, ac: 15, stat: "dex", extraAttacks: true, actions: [
    W("arco", "Arco Lungo", "\u{1F3F9}", "1d8", "piercing"),
    { id: "marchio", name: "Marchio del Cacciatore", icon: "\u{1F3AF}", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, unlock: 1, uses: 2 },
    { id: "pioggia", name: "Pioggia di Frecce", icon: "\u{1F327}", kind: "save", dice: "2d8", dmg: "piercing", save: "dex", area: true, half: true, unlock: 3, uses: 1, grow: true },
    { id: "cura_r", name: "Cura Ferite", icon: "\u{1F49A}", kind: "heal", dice: "1d8", plusMod: true, unlock: 2, uses: 1 }
  ] },
  monk: { hitDie: 8, ac: 16, stat: "dex", extraAttacks: true, actions: [
    { id: "raffica", name: "Raffica di Colpi", icon: "\u{1F44A}", kind: "weapon", dice: "1d6", dmg: "bludgeoning", attacks: 2, unlock: 1 },
    { id: "stordente", name: "Pugno Stordente", icon: "\u{1F4AB}", kind: "save", dice: "1d6", dmg: "bludgeoning", save: "con", stun: 1, unlock: 2, uses: 2 },
    { id: "schivata", name: "Schivata Paziente", icon: "\u{1F300}", kind: "buff", buff: "ac", value: 4, turns: 1, self: true, unlock: 1, uses: 2 }
  ] },
  rogue: { hitDie: 8, ac: 15, stat: "dex", actions: [
    W("stocco", "Stocco", "\u{1F5E1}", "1d8", "piercing"),
    { id: "furtivo", name: "Attacco Furtivo", icon: "\u{1F312}", kind: "weapon", dice: "1d8", dmg: "piercing", rider: "sneak", riderDmg: "piercing", unlock: 1, uses: 3, info: "+met\xE0 livello in d6" },
    { id: "nascondersi", name: "Nascondersi", icon: "\u{1FAE5}", kind: "buff", buff: "adv", turns: 2, self: true, unlock: 2, uses: 2 }
  ] },
  wizard: { hitDie: 6, ac: 12, stat: "int", actions: [
    { id: "dardo_fuoco", name: "Dardo di Fuoco", icon: "\u{1F525}", kind: "spell", dice: "1d10", dmg: "fire", scale: true, unlock: 1 },
    { id: "raggio_gelo", name: "Raggio di Gelo", icon: "\u2744", kind: "spell", dice: "1d8", dmg: "cold", scale: true, unlock: 1 },
    { id: "dardo_inc", name: "Dardo Incantato", icon: "\u2728", kind: "missile", dice: "3d4", flat: 3, dmg: "force", unlock: 1, uses: 3, grow: true },
    { id: "scudo", name: "Scudo", icon: "\u{1F6E1}", kind: "buff", buff: "ac", value: 5, turns: 1, self: true, unlock: 1, uses: 2 },
    { id: "palla_fuoco", name: "Palla di Fuoco", icon: "\u2604", kind: "save", dice: "8d6", dmg: "fire", save: "dex", area: true, half: true, unlock: 5, uses: 1, grow: true }
  ] },
  sorcerer: { hitDie: 6, ac: 12, stat: "cha", actions: [
    { id: "fiotto", name: "Fiotto di Fuoco", icon: "\u{1F525}", kind: "spell", dice: "1d10", dmg: "fire", scale: true, unlock: 1 },
    { id: "mani_br", name: "Mani Brucianti", icon: "\u{1F590}", kind: "save", dice: "3d6", dmg: "fire", save: "dex", area: true, half: true, unlock: 1, uses: 2, grow: true },
    { id: "veleno", name: "Spruzzo Velenoso", icon: "\u2620", kind: "save", dice: "1d12", dmg: "poison", save: "con", scale: true, unlock: 1 },
    { id: "fulmine", name: "Fulmine", icon: "\u26A1", kind: "save", dice: "8d6", dmg: "lightning", save: "dex", area: true, half: true, unlock: 5, uses: 1, grow: true }
  ] },
  warlock: { hitDie: 8, ac: 13, stat: "cha", actions: [
    { id: "deflagrazione", name: "Deflagrazione Occulta", icon: "\u{1F441}", kind: "spell", dice: "1d10", dmg: "force", scale: true, unlock: 1 },
    { id: "maleficio", name: "Maleficio", icon: "\u{1FA78}", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, unlock: 1, uses: 2 },
    { id: "hadar", name: "Braccia di Hadar", icon: "\u{1F419}", kind: "save", dice: "2d6", dmg: "necrotic", save: "str", area: true, half: true, unlock: 2, uses: 2, grow: true }
  ] },
  druid: { hitDie: 8, ac: 14, stat: "wis", actions: [
    { id: "rovi", name: "Frusta di Rovi", icon: "\u{1F33F}", kind: "spell", dice: "1d6", dmg: "piercing", scale: true, unlock: 1 },
    { id: "cura_d", name: "Cura Ferite", icon: "\u{1F49A}", kind: "heal", dice: "1d8", plusMod: true, unlock: 1, uses: 3, grow: true },
    { id: "onda", name: "Onda Tonante", icon: "\u{1F30A}", kind: "save", dice: "2d8", dmg: "thunder", save: "con", area: true, half: true, unlock: 1, uses: 2, grow: true },
    { id: "pelle", name: "Pelle di Corteccia", icon: "\u{1F333}", kind: "buff", buff: "ac", value: 3, turns: 3, unlock: 2, uses: 1 }
  ] },
  cleric: { hitDie: 8, ac: 18, stat: "wis", actions: [
    W("mazza", "Mazza", "\u{1F528}", "1d6", "bludgeoning"),
    { id: "fiamma", name: "Fiamma Sacra", icon: "\u{1F56F}", kind: "save", dice: "1d8", dmg: "radiant", save: "dex", scale: true, unlock: 1 },
    { id: "cura_c", name: "Cura Ferite", icon: "\u{1F49A}", kind: "heal", dice: "1d8", plusMod: true, unlock: 1, uses: 3, grow: true },
    { id: "parola", name: "Parola Guaritrice di Massa", icon: "\u{1F64F}", kind: "heal_all", dice: "1d4", plusMod: true, unlock: 3, uses: 2, grow: true },
    { id: "guardiani", name: "Guardiani Spirituali", icon: "\u{1F47C}", kind: "save", dice: "3d8", dmg: "radiant", save: "wis", area: true, half: true, unlock: 5, uses: 1, grow: true }
  ] },
  bard: { hitDie: 8, ac: 14, stat: "cha", actions: [
    W("stocco_b", "Stocco", "\u{1F5E1}", "1d8", "piercing"),
    { id: "beffa", name: "Beffa Crudele", icon: "\u{1F3AD}", kind: "save", dice: "1d4", dmg: "psychic", save: "wis", scale: true, dis: 1, unlock: 1, info: "e svantaggio al bersaglio" },
    { id: "parola_b", name: "Parola Guaritrice", icon: "\u{1F3B5}", kind: "heal", dice: "1d4", plusMod: true, unlock: 1, uses: 3, grow: true },
    { id: "ispirazione", name: "Ispirazione Bardica", icon: "\u{1F3B6}", kind: "buff", buff: "adv", turns: 2, unlock: 1, uses: 2 }
  ] }
};
var DEFEND = { id: "difesa", name: "Difendersi", icon: "\u{1F6E1}", kind: "defend", info: "+4 CA fino al tuo prossimo turno" };
var kitOf = (cls) => KITS[cls] || KITS.fighter;
var heroActions = (cls, lv) => [...kitOf(cls).actions.filter((a) => (a.unlock || 1) <= lv), DEFEND];
function heroMaxHp(cls, lv) {
  const d = kitOf(cls).hitDie;
  return Math.round((d + 2 + (Math.floor(d / 2) + 1 + 2) * (Math.max(1, lv) - 1)) * HERO_HP_MULT);
}
var heroDc = (lv) => 8 + profOf(lv) + modOf(lv);
var heroHit = (lv) => profOf(lv) + modOf(lv);
function attacksOf(cls, lv, action) {
  if (action.attacks) return action.attacks + (lv >= 5 && kitOf(cls).extraAttacks ? 1 : 0);
  if (action.kind !== "weapon") return 1;
  if (!kitOf(cls).extraAttacks) return 1;
  return 1 + (lv >= 5) + (cls === "fighter" && lv >= 11);
}

// src/data/segreteEngine.js
var LOG_MAX = 80;
var AFK_MS = 10 * 60 * 1e3;
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
  { id: "fb-orco", name: "Orco", icon: "\u{1F479}", role: "elite", level: 3, hp: 30, ac: 13, init: 1, save: 2, actions: [A("Ascia Bipenne", 1, "d12", 5), { type: "buff_adv", name: "Grido di Guerra", durationTurns: 2 }] },
  { id: "fb-cultista", name: "Cultista", icon: "\u{1F9DF}", role: "elite", level: 3, hp: 22, ac: 12, init: 1, save: 2, actions: [A("Dardo Necrotico", 2, "d6", 5, { dmgType: "oscurit\xE0" }), { type: "heal", name: "Patto Oscuro", diceNum: 2, diceType: "d6", bonus: 2 }] },
  { id: "fb-capo", name: "Capoguerra Orco", icon: "\u{1F451}", role: "boss", level: 5, hp: 75, ac: 16, init: 2, save: 4, actions: [A("Ascia Spezzaossa", 2, "d10", 7), A("Turbine d'Acciaio", 2, "d8", 0, { hitMode: "save", aoeShape: "sphere", saveAbility: "dex", saveDC: 14, halfOnSave: true }), { type: "buff_ca", name: "Scudo di Ferro", acBonus: 2, durationTurns: 2 }] }
];
function makeHero(m) {
  const lv = Math.max(1, Math.min(20, m.level || 1));
  const kit = kitOf(m.cls);
  const maxHp = heroMaxHp(m.cls, lv);
  const uses = {};
  heroActions(m.cls, lv).forEach((a) => {
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
    ac: kit.ac,
    init: kit.stat === "dex" ? modOf(lv) : 1,
    save: 1 + Math.floor(profOf(lv) / 2),
    fx: {},
    uses
  };
}
var ADAPT = { hpUp: 0.25, hpDown: 0.16, hpMin: 0.35, dmgPer: 0.6, hitPer: 0.34, bigBase: 0.31, bigPer: 0.32, multUp: 0.05, multDown: 0.12, multMin: 0.5, soloHp: 1.3 };
function makeFoe(src, idx, partySize, suffix, partyLv = 1) {
  const diff = partyLv - (Number(src.level) || 1);
  const lvScale = diff >= 0 ? 1 + ADAPT.hpUp * diff : Math.max(ADAPT.hpMin, 1 + ADAPT.hpDown * diff);
  const scale = (src.role === "minion" ? 1 : ADAPT.bigBase + ADAPT.bigPer * partySize) * lvScale;
  const maxHp = Math.max(1, Math.round((Number(src.hp) || 10) * scale));
  return {
    id: `f${idx}`,
    side: "f",
    name: suffix ? `${src.name} ${suffix}` : src.name,
    src: src.id,
    role: src.role || "minion",
    level: Number(src.level) || 1,
    hp: maxHp,
    maxHp,
    ac: Math.max(8, (Number(src.ac) || 12) + (diff > 0 ? Math.floor(diff / 3) : Math.ceil(diff / 3))),
    init: Number(src.init) || 0,
    save: (Number(src.save) || 0) + Math.round(diff * ADAPT.hitPer),
    img: src.imageUrl || "",
    deadImg: src.deadImageUrl || "",
    icon: src.icon || "",
    facing: src.facing || "left",
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
  const all = bestiary.length ? bestiary : FALLBACK_MONSTERS;
  const fit = (role, max) => {
    const of = all.filter((m) => (m.role || "minion") === role);
    const ok = of.filter((m) => (Number(m.level) || 1) <= max);
    return ok.length ? ok : of.length ? [of.reduce((a, b) => (Number(a.level) || 1) <= (Number(b.level) || 1) ? a : b)] : [];
  };
  const picks = [];
  if (boss) {
    let bosses = fit("boss", partyLevel2 + 3);
    if (!bosses.length) bosses = fit("elite", partyLevel2 + 3);
    if (!bosses.length) bosses = FALLBACK_MONSTERS.filter((m) => m.role === "boss");
    picks.push(pick(bosses));
    const mins = fit("minion", partyLevel2 + 1);
    for (let i = 0; i < Math.floor(partySize / 2) && mins.length; i++) picks.push(pick(mins));
  } else {
    let mins = fit("minion", partyLevel2 + 1);
    const elites = fit("elite", partyLevel2 + 2);
    if (!mins.length) mins = elites.length ? elites : FALLBACK_MONSTERS.filter((m) => m.role === "minion");
    let count = Math.min(6, partySize + (floor >= 2 && partySize >= 2 ? 1 : 0) + (partySize >= 3 ? 1 : 0));
    if (floor >= 2 && elites.length && rnd() < 0.45) {
      picks.push(pick(elites));
      count = Math.max(partySize >= 2 ? 1 : 0, count - 2);
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
var current = (s) => byId(s, s.order[s.turn]);
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
function log(s, txt, extra = {}) {
  s.seq = (s.seq || 0) + 1;
  s.log = [...s.log || [], { i: s.seq, txt, ...extra }].slice(-LOG_MAX);
}
function rollInitiative(s) {
  const all = everyone(s).filter(alive).map((c) => ({ id: c.id, v: d20() + (c.init || 0) + rnd() }));
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
function startFloor(s, bestiary, now) {
  s.boss = s.floor > s.floors;
  s.foes = buildEncounter(bestiary, { floor: s.floor, floors: s.floors, partyLevel: partyLevel(s), partySize: s.heroes.length });
  s.heroes.forEach((h) => {
    h.fx = {};
  });
  s.status = "fight";
  rollInitiative(s);
  log(s, s.boss ? `\u{1F451} Sala del boss! Davanti a voi: ${s.foes.map((f) => f.name).join(", ")}.` : `\u{1F6AA} Sala ${s.floor} di ${s.floors}: ${s.foes.map((f) => f.name).join(", ")}.`, { kind: "room" });
  s.turnAt = now;
  advanceToActor(s, now, true);
}
function applyDamage(s, target, amount, type, notes) {
  let dmg = Math.max(0, Math.round(amount));
  if (target.side === "f") {
    if (target.imm.includes(type)) {
      dmg = 0;
      notes.push("immune");
    } else if (target.res.includes(type)) {
      dmg = Math.floor(dmg / 2);
      notes.push("resiste");
    } else if (target.vul.includes(type)) {
      dmg *= 2;
      notes.push("vulnerabile!");
    }
  } else if (fxOn(s, target.fx.rage) && PHYS.includes(type)) {
    dmg = Math.floor(dmg / 2);
    notes.push("in furia");
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
  return heroActions(h.cls, h.level).map((a) => ({ ...a, left: a.uses ? h.uses?.[a.id] ?? a.uses : null }));
}
function diceFor(a, lv) {
  let [n, sides] = parseDice(a.dice);
  if (a.scale) n *= cantripMult(lv);
  if (a.grow) n += Math.max(0, Math.floor((lv - (a.unlock || 1)) / 4));
  return [n, sides];
}
function targetKind(a) {
  if (a.kind === "weapon" || a.kind === "spell" || a.kind === "missile" || a.kind === "save" && !a.area) return "foe";
  if (a.kind === "heal" && !a.self) return "ally";
  if (a.kind === "buff" && !a.self && !a.allParty) return "ally";
  return null;
}
function heroAct(s, h, a, target) {
  const lv = h.level;
  const hit = heroHit(lv) + (fxOn(s, h.fx.bless) ? 0 : 0);
  const mod = modOf(lv);
  const ev = { actor: h.id, roll: null };
  if (a.kind === "defend") {
    h.fx.dodge = true;
    log(s, `\u{1F6E1} ${h.name} si mette in difesa (+4 CA fino al suo turno).`, { kind: "buff", actor: h.id, targets: [h.id] });
    return ev;
  }
  if (a.kind === "weapon" || a.kind === "spell") {
    const n = attacksOf(h.cls, lv, a);
    if (a.selfDis) h.fx.reckless = s.round + 1;
    for (let k = 0; k < n; k++) {
      if (!alive(target)) {
        const others = s.foes.filter(alive);
        if (!others.length) break;
        target = others[0];
      }
      const r = attackRoll(s, h, target, hit, { adv: !!a.adv });
      if (k === 0) ev.roll = { nat: r.nat, dice: r.dice };
      if (!r.hit) {
        log(s, `${a.icon} ${h.name} \u2192 ${a.name} su ${target.name}: manca (\u{1F3B2}${r.nat}+${hit}=${r.total} vs CA ${r.ac})${advTag(r)}.`, { kind: "miss", actor: h.id, targets: [target.id] });
        continue;
      }
      let [dn, ds] = diceFor(a, lv);
      if (r.crit) dn *= 2;
      let dmg = roll(dn, ds).t + (a.kind === "weapon" ? mod + dmgBonusOf(s, h) : 0);
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
      log(
        s,
        `${a.icon} ${h.name} \u2192 ${a.name} su ${target.name}: ${r.crit ? "CRITICO! " : ""}${total} danni ${DMG_IT[a.dmg] || ""}${extra ? ` (di cui${extra})` : ""} (\u{1F3B2}${r.nat}+${hit}=${r.total})${advTag(r)}${notes.length ? ` \xB7 ${notes.join(", ")}` : ""}.${downTxt(target)}`,
        { kind: r.crit ? "crit" : "hit", actor: h.id, targets: [target.id], dmg: total }
      );
    }
    return ev;
  }
  if (a.kind === "missile") {
    const [dn, ds] = diceFor(a, lv);
    const notes = [];
    const dmg = applyDamage(s, target, roll(dn, ds).t + (a.flat || 0), a.dmg, notes);
    log(s, `${a.icon} ${h.name} \u2192 ${a.name} su ${target.name}: colpisce sempre, ${dmg} danni ${DMG_IT[a.dmg]}${notes.length ? ` \xB7 ${notes.join(", ")}` : ""}.${downTxt(target)}`, { kind: "hit", actor: h.id, targets: [target.id], dmg });
    return ev;
  }
  if (a.kind === "save") {
    const dc = heroDc(lv);
    const targets = a.area ? s.foes.filter(alive) : [target];
    const [dn, ds] = diceFor(a, lv);
    const base = roll(dn, ds).t;
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
      if (a.flat === "lv*5") amt = lv * 5;
      else {
        const [dn, ds] = diceFor(a, lv);
        amt = roll(dn, ds).t + (a.plusMod ? mod : 0) + (a.plusLevel ? lv : 0);
      }
      const before = t.hp;
      t.hp = Math.min(t.maxHp, t.hp + amt);
      return `${t.name} +${t.hp - before}${before <= 0 && t.hp > 0 ? " (rialzato!)" : ""}`;
    });
    log(s, `${a.icon} ${h.name} \u2192 ${a.name}: ${parts.join(" \xB7 ")}.`, { kind: "heal", actor: h.id, targets: tg.map((t) => t.id) });
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
  const turns = Math.max(1, Number(a.durationTurns) || 2);
  if (a.type === "heal") {
    const t = hurt || f;
    const amt = roll(Number(a.diceNum) || 1, parseDice(`1${a.diceType || "d8"}`)[1]).t + (Number(a.bonus) || 0);
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
    const dc = (Number(a.saveDC) || 12) + (f.adapt?.hit || 0);
    const base = Math.max(1, Math.round((roll(n, sides).t + lvlBonus) * (f.adapt?.mult || 1)));
    const parts = tg.map((t) => {
      const sv = d20() + (t.save || 0) - (fxOn(s, t.fx.dis) ? 0 : 0);
      const ok = sv >= dc;
      const dmg2 = ok ? a.halfOnSave !== false ? applyDamage(s, t, Math.floor(base / 2), type, []) : 0 : applyDamage(s, t, base, type, []);
      return `${t.name} ${ok ? "resiste" : "fallisce"} (${sv}) \u2212${dmg2}${t.hp <= 0 ? " \u{1F480}" : ""}`;
    });
    log(s, `\u{1F300} ${f.name} \u2192 ${nm} (TS ${String(a.saveAbility || "dex").toUpperCase()} CD ${dc}): ${parts.join(" \xB7 ")}.`, { kind: "hit", actor: f.id, targets: tg.map((t) => t.id) });
    return;
  }
  const bonus = (Number(a.bonus) || 3) + (f.adapt?.hit || 0);
  const r = attackRoll(s, f, tgt, bonus);
  if (!r.hit) {
    log(s, `\u2694 ${f.name} \u2192 ${nm} su ${tgt.name}: manca (\u{1F3B2}${r.nat}+${bonus}=${r.total} vs CA ${r.ac})${advTag(r)}.`, { kind: "miss", actor: f.id, targets: [tgt.id] });
    return;
  }
  const dmg = applyDamage(s, tgt, Math.max(1, Math.round((roll(r.crit ? n * 2 : n, sides).t + lvlBonus) * (f.adapt?.mult || 1))), type, []);
  log(s, `\u2694 ${f.name} \u2192 ${nm} su ${tgt.name}: ${r.crit ? "CRITICO! " : ""}${dmg} danni ${DMG_IT[type] || ""} (\u{1F3B2}${r.nat}+${bonus}=${r.total})${advTag(r)}.${downTxt(tgt)}`, { kind: r.crit ? "crit" : "hit", actor: f.id, targets: [tgt.id], dmg });
}
function checkEnd(s) {
  if (!s.heroes.some(alive)) {
    s.status = "lost";
    log(s, "\u2620 Il gruppo \xE8 caduto. Le Segrete si richiudono su di voi: tutto \xE8 perduto.", { kind: "end" });
    return true;
  }
  if (!s.foes.some(alive)) {
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
function nextIndex(s) {
  s.turn += 1;
  if (s.turn >= s.order.length) {
    s.turn = 0;
    s.round += 1;
  }
}
function advanceToActor(s, now, fresh = false) {
  let guard = 0;
  if (!fresh) nextIndex(s);
  while (guard++ < 200) {
    if (checkEnd(s)) return;
    const c = current(s);
    if (!alive(c)) {
      nextIndex(s);
      continue;
    }
    c.fx.dodge = false;
    if (c.fx.stun) {
      c.fx.stun = false;
      log(s, `\u{1F4AB} ${c.name} \xE8 stordito e salta il turno.`, { kind: "debuff", actor: c.id });
      nextIndex(s);
      continue;
    }
    if (c.side === "h") {
      s.turnAt = now;
      return;
    }
    foeAct(s, c);
    nextIndex(s);
  }
}
function act(s, uid, { actionId, targetId }, now) {
  if (s.status !== "fight") throw new Error("Non si combatte adesso.");
  const h = current(s);
  if (!h || h.side !== "h" || h.uid !== uid) throw new Error("Non \xE8 il tuo turno.");
  const a = actionId === DEFEND.id ? DEFEND : heroActionList(h).find((x) => x.id === actionId);
  if (!a) throw new Error("Azione non disponibile.");
  if (a.uses && (h.uses?.[a.id] ?? a.uses) <= 0) throw new Error("Hai finito gli usi di questa azione per questa sala.");
  const tk = targetKind(a);
  let target = null;
  if (tk === "foe") {
    target = byId(s, targetId);
    if (!target || target.side !== "f" || !alive(target)) throw new Error("Scegli un nemico in piedi.");
  }
  if (tk === "ally") {
    target = byId(s, targetId);
    const heal = a.kind === "heal";
    if (!target || target.side !== "h" || target.fled || !heal && !alive(target)) throw new Error("Scegli un alleato.");
  }
  if (a.uses) h.uses = { ...h.uses, [a.id]: (h.uses?.[a.id] ?? a.uses) - 1 };
  const ev = heroAct(s, h, a, target);
  if (target && target.side === "f") target.lastHitBy = h.id;
  advanceToActor(s, now);
  return ev;
}
function timeout(s, now) {
  if (s.status !== "fight") throw new Error("Non si combatte adesso.");
  const h = current(s);
  if (!h || h.side !== "h") throw new Error("Tocca ai mostri.");
  if (now - (s.turnAt || 0) < AFK_MS) throw new Error("Il suo tempo non \xE8 ancora finito.");
  log(s, `\u23F0 ${h.name} non risponde da 10 minuti: si difende da solo.`, { kind: "buff", actor: h.id });
  h.fx.dodge = true;
  advanceToActor(s, now);
}
function nextFloor(s, bestiary, now) {
  if (s.status !== "cleared") throw new Error("La sala non \xE8 ancora ripulita.");
  s.heroes.forEach((h) => {
    if (h.fled) return;
    h.hp = h.hp <= 0 ? Math.ceil(h.maxHp * 0.25) : Math.min(h.maxHp, h.hp + Math.ceil(h.maxHp * 0.3));
    const uses = {};
    heroActions(h.cls, h.level).forEach((a) => {
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
  if (s.status === "fight") {
    if (current(s)?.id === h.id) advanceToActor(s, now);
    else checkEnd(s);
  } else if (!s.heroes.some(alive) && s.status === "cleared") {
    s.status = "lost";
    log(s, "\u2620 Non resta nessuno a proseguire: tutto \xE8 perduto.", { kind: "end" });
  }
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
var AFK_DEFEND_MS = 10 * 60 * 1e3;
var ROOM_IDLE_MS = 3 * 60 * 60 * 1e3;
var DEFAULT_DUNGEONS = [
  { key: "segrete", name: "Le Segrete", icon: "\u26D3", desc: "Celle umide, catene e guardie che non dormono mai. Non morti e banditi." },
  { key: "caverna", name: "La Caverna", icon: "\u{1F573}", desc: "Gallerie strette nel buio: bestie, goblin e ragni giganti." },
  { key: "magma", name: "Caverna di Magma", icon: "\u{1F30B}", desc: "Fiumi di lava e aria che brucia: elementali del fuoco e salamandre." }
];
var STORY_CLASSES = ARENA_CLASSES.map(({ key, it, icon }) => ({ key, it, icon }));
function storyLevelOf(charData, classKey, week = currentWeekKey()) {
  const s = charData?.storyWeekly;
  if (!s || s.weekKey !== week) return 1;
  return Math.max(1, Number(s.levels?.[classKey]) || 1);
}
function mergeDungeons(custom = []) {
  const map = new Map(DEFAULT_DUNGEONS.map((d) => [d.key, d]));
  custom.forEach((d) => {
    if (d?.key) map.set(d.key, { ...map.get(d.key) || {}, ...d });
  });
  return [...map.values()].filter((d) => !d.hidden);
}
var DEFAULT_FLOORS = 3;
var DAILY_RUNS = 1;
var WEEKLY_RUNS = 3;
var romeDayKey = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
function runsOf(charData, week = currentWeekKey(), day = romeDayKey()) {
  const r = charData?.storyRuns;
  const weekCount = r && r.weekKey === week ? Number(r.count) || 0 : 0;
  const dayCount = r && r.weekKey === week && r.day === day ? Number(r.dayCount) || 0 : 0;
  return { weekCount, dayCount, canRun: weekCount < WEEKLY_RUNS && dayCount < DAILY_RUNS };
}
function nextRunsPatch(charData, week = currentWeekKey(), day = romeDayKey()) {
  const { weekCount, dayCount } = runsOf(charData, week, day);
  return { weekKey: week, count: weekCount + 1, day, dayCount: dayCount + 1 };
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
  DEFAULT_FLOORS,
  MAX_STORY_LEVEL,
  WEEKLY_RUNS,
  act,
  currentWeekKey,
  flee,
  mergeDungeons,
  newRun,
  nextFloor,
  nextRunsPatch,
  runsOf,
  storyLevelOf,
  timeout,
  withRng,
  wonItemInboxDoc
});
