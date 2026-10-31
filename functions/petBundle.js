// GENERATO da src/data/petOps.js con npm run build:pets: non modificare a mano.
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

// src/data/petOps.js
var petOps_exports = {};
__export(petOps_exports, {
  LOSS_XP: () => LOSS_XP,
  MASCOT_XP_BONUS: () => MASCOT_XP_BONUS,
  OPS: () => OPS,
  PVP_DAILY: () => PVP_DAILY,
  PVP_LOSS_XP: () => PVP_LOSS_XP,
  PVP_POINTS: () => PVP_POINTS,
  PVP_WIN_XP: () => PVP_WIN_XP,
  PVP_XP_FIGHTS: () => PVP_XP_FIGHTS,
  applyGrowthItem: () => applyGrowthItem,
  buyEgg: () => buyEgg,
  buyItem: () => buyItem,
  canResetTower: () => canResetTower,
  chooseStarter: () => chooseStarter,
  claimGifts: () => claimGifts,
  countOf: () => countOf,
  denOf: () => denOf,
  giveCharm: () => giveCharm,
  giveItems: () => giveItems,
  givePet: () => givePet,
  hatchEgg: () => hatchEgg,
  learnMove: () => learnMove,
  recordPvpResult: () => recordPvpResult,
  releasePet: () => releasePet,
  renamePet: () => renamePet,
  replayTower: () => replayTower,
  resetTower: () => resetTower,
  setMascot: () => setMascot,
  setMoveset: () => setMoveset,
  setTeam: () => setTeam,
  teachScroll: () => teachScroll,
  towerFinish: () => towerFinish,
  towerFresh: () => towerFresh,
  towerSeed: () => towerSeed,
  towerStart: () => towerStart,
  towerTurnSeed: () => towerTurnSeed,
  validAction: () => validAction
});
module.exports = __toCommonJS(petOps_exports);

// src/data/petDex.js
var MAX_PER_SPECIES = 2;
var MAX_TEAM = 3;
var MAX_EGGS = 24;
var MAX_LEVEL = 50;
var MOVE_UNLOCK = [1, 1, 5, 10];
var PET_TYPES = ["fire", "cold", "water", "lightning", "earth", "acid", "poison", "necrotic", "radiant", "psychic", "neutral"];
var ELEMENTS = PET_TYPES.filter((t) => t !== "neutral");
var TYPE_ICON = {
  fire: "\u{1F525}",
  cold: "\u2744\uFE0F",
  water: "\u{1F4A7}",
  lightning: "\u26A1",
  earth: "\u{1FAA8}",
  acid: "\u{1F9EA}",
  poison: "\u2620\uFE0F",
  necrotic: "\u{1F480}",
  radiant: "\u2728",
  psychic: "\u{1F52E}",
  neutral: "\u2726"
};
var TYPE_LABEL = {
  fire: "Fuoco",
  cold: "Gelo",
  water: "Acqua",
  lightning: "Fulmine",
  earth: "Terra",
  acid: "Acido",
  poison: "Veleno",
  necrotic: "Necrotico",
  radiant: "Radioso",
  psychic: "Psichico",
  neutral: "Fisico"
};
var DMG_ICON = { ...TYPE_ICON, bludgeoning: "\u{1F528}", piercing: "\u{1F9B7}", slashing: "\u{1F5E1}\uFE0F" };
var DMG_LABEL = { ...TYPE_LABEL, bludgeoning: "Contundente", piercing: "Perforante", slashing: "Tagliente" };
var PHYS_OF_FX = { stomp: "bludgeoning", dash: "bludgeoning", bite: "piercing", sting: "piercing", claw: "slashing", whip: "slashing" };
var damageKindOf = (move) => move?.type && move.type !== "neutral" ? move.type : PHYS_OF_FX[move?.fx] || "bludgeoning";
function resistMultiplier(speciesKey, kind) {
  const r = PET_DEX[speciesKey]?.res;
  if (!r) return 1;
  if (r.immune?.includes(kind)) return 0;
  let m = 1;
  if (r.resist?.includes(kind)) m *= 0.5;
  if (r.vuln?.includes(kind)) m *= 2;
  return m;
}
var STRONG = {
  fire: ["cold", "poison"],
  cold: ["water", "lightning"],
  water: ["fire", "acid"],
  lightning: ["water", "psychic"],
  earth: ["lightning", "fire"],
  acid: ["cold", "radiant"],
  poison: ["earth", "water"],
  necrotic: ["earth", "psychic"],
  radiant: ["necrotic", "poison"],
  psychic: ["poison", "acid"]
};
function typeMultiplier(att, def) {
  if (!att || att === "neutral" || !def) return 1;
  if (STRONG[att]?.includes(def)) return 1.5;
  if (STRONG[def]?.includes(att)) return 0.5;
  return 1;
}
var RARITY = {
  starter: { label: "Iniziale", color: "#d9a441", value: 40 },
  common: { label: "Comune", color: "#8a8f99", value: 40 },
  rare: { label: "Raro", color: "#3d8fd1", value: 90 },
  epic: { label: "Epico", color: "#a45ad8", value: 180 },
  legendary: { label: "Leggendario", color: "#e0782b", value: 400 }
};
var HATCH_RARITIES = ["common", "rare", "epic", "legendary"];
var hatchRarityOf = (key) => PET_DEX[key]?.rarity === "starter" ? "common" : PET_DEX[key]?.rarity;
var DICE_BY_POWER = [[35, "1d12"], [40, "2d6"], [45, "3d4"], [55, "2d8"], [65, "2d10"], [70, "2d12"], [75, "3d8"], [80, "4d6"], [90, "3d10"], [95, "5d6"], [100, "4d8"], [115, "6d6"], [999, "4d10"]];
var diceFor = (p) => p ? DICE_BY_POWER.find(([x]) => p <= x)[1] : null;
var M = (name, type, power, acc, pp, fx, extra = {}) => ({ name, type, power, acc, pp, fx, dice: diceFor(power), ...extra });
var PET_DEX_MOVES = {
  // ── fisiche (neutre: chiunque le può imparare) ──
  zampata: M("Zampata", "neutral", 40, 100, 30, "stomp", { lv: 1 }),
  graffio: M("Graffio", "neutral", 45, 100, 25, "claw", { lv: 1 }),
  scattino: M("Scattino", "neutral", 35, 100, 20, "dash", { lv: 1, prio: 1 }),
  morsetto: M("Morsetto", "neutral", 55, 95, 20, "bite", { lv: 2 }),
  colpocoda: M("Colpo di Coda", "neutral", 55, 100, 20, "whip", { lv: 2 }),
  ingoiare: M("Ingoiare", "neutral", 60, 90, 10, "bite", { lv: 3, effect: { drain: 0.5 } }),
  doppiograffio: M("Doppio Graffio", "neutral", 70, 95, 15, "claw", { lv: 3 }),
  testata: M("Testata", "neutral", 80, 85, 10, "dash", { lv: 4, effect: { recoil: 0.25 } }),
  caricafuriosa: M("Carica Furiosa", "neutral", 100, 85, 8, "dash", { lv: 5, effect: { recoil: 0.25 } }),
  schianto: M("Schianto", "neutral", 120, 80, 5, "stomp", { lv: 6 }),
  // neutre di stato: solo innate (non si imparano)
  ruggitino: M("Ruggitino", "neutral", 0, 100, 15, "roar", { effect: { foe: { atk: -1 } } }),
  guscio: M("Rintanarsi", "neutral", 0, 100, 10, "aura", { effect: { self: { ac: 2, def: 1 } } }),
  pisolino: M("Pisolino", "neutral", 0, 100, 5, "sleep", { effect: { heal: 0.5 } }),
  // ── fuoco ──
  scintilla: M("Scintilla", "fire", 40, 100, 25, "orb", { lv: 1, effect: { burn: 0.1 } }),
  artigliardenti: M("Artigli Ardenti", "fire", 40, 100, 25, "claw", { lv: 1, effect: { burn: 0.1 } }),
  sbuffo: M("Sbuffo di Brace", "fire", 65, 95, 15, "breath", { lv: 2, effect: { burn: 0.2 } }),
  fuocherello: M("Fuocherello", "fire", 0, 100, 10, "aura", { lv: 2, effect: { self: { atk: 2 } } }),
  morsofuoco: M("Zanne Ardenti", "fire", 60, 95, 15, "bite", { lv: 2, effect: { burn: 0.2 } }),
  scudofuoco: M("Scudo di Fuoco", "fire", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 1, atk: 1 } } }),
  frustafiamme: M("Frusta di Fiamme", "fire", 70, 95, 15, "whip", { lv: 3, effect: { burn: 0.2 } }),
  sferafuoco: M("Sfera di Fuoco", "fire", 75, 90, 10, "orb", { lv: 3, effect: { burn: 0.2 } }),
  caricarovente: M("Carica Rovente", "fire", 85, 90, 10, "dash", { lv: 4, effect: { burn: 0.2 } }),
  vampata: M("Vampata", "fire", 90, 85, 5, "burst", { lv: 4, effect: { burn: 0.3 } }),
  zoccolomagma: M("Pestone di Magma", "fire", 100, 85, 8, "stomp", { lv: 5, effect: { burn: 0.3 } }),
  murofuoco: M("Muro di Fuoco", "fire", 100, 85, 8, "wave", { lv: 5, effect: { burn: 0.3 } }),
  cometa: M("Cometa Ardente", "fire", 120, 85, 5, "dash", { lv: 6, effect: { burn: 0.3, recoil: 0.3 } }),
  meteore: M("Pioggia di Meteore", "fire", 120, 80, 5, "rain", { lv: 6, effect: { burn: 0.3 } }),
  // ── gelo ──
  brina: M("Scheggia di Brina", "cold", 40, 100, 25, "orb", { lv: 1, effect: { foe: { spd: -1 }, chance: 0.2 } }),
  unghiegelo: M("Unghie di Ghiaccio", "cold", 40, 100, 25, "claw", { lv: 1, effect: { foe: { spd: -1 }, chance: 0.1 } }),
  soffiogelo: M("Soffio Gelido", "cold", 65, 95, 15, "breath", { lv: 2, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  mantobrina: M("Manto di Brina", "cold", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 2 } } }),
  morsogelo: M("Morso Gelido", "cold", 60, 95, 15, "bite", { lv: 2, effect: { stun: 0.1 } }),
  frustagelo: M("Frusta di Ghiaccioli", "cold", 70, 95, 15, "whip", { lv: 3, effect: { stun: 0.1 } }),
  raggiogelo: M("Raggio Gelido", "cold", 75, 90, 10, "beam", { lv: 3, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  pestoneglaciale: M("Pestone Glaciale", "cold", 85, 90, 10, "stomp", { lv: 4, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  grandine: M("Grandinata", "cold", 90, 85, 5, "rain", { lv: 4, effect: { stun: 0.1 } }),
  valanga: M("Carica Valanga", "cold", 100, 85, 8, "dash", { lv: 5, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  lancegelo: M("Lance di Ghiaccio", "cold", 100, 85, 8, "spikes", { lv: 5, effect: { stun: 0.15 } }),
  zannepolari: M("Zanne Polari", "cold", 115, 90, 5, "bite", { lv: 6, effect: { stun: 0.2 } }),
  bufera: M("Bufera", "cold", 120, 80, 5, "breath", { lv: 6, effect: { foe: { spd: -1 }, chance: 0.5, stun: 0.1 } }),
  // ── acqua ──
  spruzzo: M("Getto d'Acqua", "water", 40, 100, 25, "beam", { lv: 1 }),
  pinzetta: M("Pinzetta", "water", 40, 100, 25, "claw", { lv: 1 }),
  bolla: M("Bollicine", "water", 60, 95, 15, "orb", { lv: 2, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  inchiostro: M("Spruzzo d'Inchiostro", "water", 0, 90, 10, "cloud", { lv: 2, effect: { foe: { atk: -1, spd: -1 } } }),
  barriera: M("Barriera d'Acqua", "water", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 2 } } }),
  codaspuma: M("Coda Spumeggiante", "water", 55, 100, 20, "whip", { lv: 2 }),
  pioggia: M("Pioggerella", "water", 0, 100, 5, "heal", { lv: 3, effect: { heal: 0.4 } }),
  morsoabissale: M("Morso Abissale", "water", 70, 95, 15, "bite", { lv: 3, effect: { foe: { def: -1 }, chance: 0.2 } }),
  bollagigante: M("Bolla Gigante", "water", 75, 90, 10, "orb", { lv: 3, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  tuffo: M("Tuffo a Bomba", "water", 85, 90, 10, "stomp", { lv: 4 }),
  ondata: M("Ondata", "water", 90, 85, 5, "wave", { lv: 4 }),
  siluro: M("Siluro", "water", 100, 85, 8, "dash", { lv: 5 }),
  vortice: M("Vortice", "water", 100, 85, 8, "curse", { lv: 5, effect: { stun: 0.2 } }),
  morsakraken: M("Morsa del Kraken", "water", 115, 90, 5, "bite", { lv: 6, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  maremoto: M("Maremoto", "water", 120, 80, 5, "wave", { lv: 6 }),
  // ── fulmine ──
  scarica: M("Scarica", "lightning", 40, 100, 25, "orb", { lv: 1, effect: { stun: 0.1 } }),
  graffioelettrico: M("Graffio Elettrico", "lightning", 40, 100, 25, "claw", { lv: 1, effect: { stun: 0.1 } }),
  scossa: M("Scossetta", "lightning", 60, 95, 15, "bolt", { lv: 2, effect: { stun: 0.2 } }),
  caricastatica: M("Carica Statica", "lightning", 0, 100, 10, "aura", { lv: 2, effect: { self: { spd: 2 } } }),
  saetta: M("Saetta", "lightning", 45, 100, 20, "beam", { lv: 2, prio: 1 }),
  morsovoltaico: M("Morso Voltaico", "lightning", 60, 95, 15, "bite", { lv: 2, effect: { stun: 0.15 } }),
  campostatico: M("Campo Statico", "lightning", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 1, spd: 1 } } }),
  frustaelettrica: M("Frusta Elettrica", "lightning", 70, 95, 15, "whip", { lv: 3, effect: { stun: 0.2 } }),
  sferatonante: M("Sfera Tonante", "lightning", 75, 90, 10, "orb", { lv: 3, effect: { stun: 0.2 } }),
  scattofulmineo: M("Scatto Fulmineo", "lightning", 80, 95, 10, "dash", { lv: 4, prio: 1 }),
  fulmine: M("Fulmine", "lightning", 90, 85, 5, "bolt", { lv: 4, effect: { stun: 0.3 } }),
  pestonetonante: M("Pestone Tonante", "lightning", 100, 85, 8, "stomp", { lv: 5, effect: { stun: 0.2 } }),
  catenafulmini: M("Catena di Fulmini", "lightning", 100, 85, 8, "beam", { lv: 5, effect: { stun: 0.2 } }),
  caricatuono: M("Carica del Tuono", "lightning", 120, 85, 5, "dash", { lv: 6, effect: { stun: 0.3, recoil: 0.3 } }),
  tempesta: M("Tempesta", "lightning", 120, 80, 5, "bolt", { lv: 6, effect: { stun: 0.3 } }),
  // ── terra ──
  rametto: M("Frusta di Rami", "earth", 40, 100, 25, "whip", { lv: 1 }),
  sassi: M("Lancio di Sassi", "earth", 40, 100, 25, "orb", { lv: 1 }),
  spore: M("Spore Sonnifere", "earth", 0, 75, 10, "cloud", { lv: 2, effect: { stun: 1 } }),
  linfa: M("Succhia-linfa", "earth", 55, 100, 15, "drain", { lv: 2, effect: { drain: 0.5 } }),
  zampapietra: M("Zampata di Pietra", "earth", 55, 100, 20, "stomp", { lv: 2 }),
  pellepietra: M("Pelle di Pietra", "earth", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 2, def: 1 } } }),
  frustaspine: M("Frusta di Spine", "earth", 70, 95, 15, "whip", { lv: 3, effect: { foe: { def: -1 }, chance: 0.2 } }),
  frana: M("Franetta", "earth", 75, 90, 10, "rain", { lv: 3, effect: { stun: 0.1 } }),
  cornoroccia: M("Corno di Roccia", "earth", 85, 90, 10, "dash", { lv: 4 }),
  spuntoni: M("Spuntoni di Pietra", "earth", 85, 90, 10, "spikes", { lv: 4 }),
  terremoto: M("Terremotino", "earth", 95, 85, 5, "stomp", { lv: 5 }),
  rovi: M("Rovi Stritolanti", "earth", 100, 85, 8, "spikes", { lv: 5, effect: { foe: { spd: -1 }, chance: 0.5 } }),
  colosso: M("Carica del Colosso", "earth", 120, 85, 5, "dash", { lv: 6, effect: { recoil: 0.3 } }),
  spaccaterra: M("Spaccaterra", "earth", 120, 80, 5, "spikes", { lv: 6, effect: { stun: 0.2 } }),
  // ── acido ──
  sputoacido: M("Sputo Acido", "acid", 40, 100, 25, "orb", { lv: 1, effect: { foe: { ac: -1 }, chance: 0.2 } }),
  artiglicorrosivi: M("Artigli Corrosivi", "acid", 40, 100, 25, "claw", { lv: 1, effect: { foe: { ac: -1 }, chance: 0.1 } }),
  spruzzoacido: M("Spruzzo Corrosivo", "acid", 65, 95, 15, "breath", { lv: 2, effect: { foe: { ac: -1 }, chance: 0.3 } }),
  melma: M("Melma Appiccicosa", "acid", 0, 95, 15, "cloud", { lv: 2, effect: { foe: { spd: -2 } } }),
  morsoacido: M("Morso Acido", "acid", 60, 95, 15, "bite", { lv: 2, effect: { foe: { ac: -1 }, chance: 0.2 } }),
  frustacaustica: M("Frusta Caustica", "acid", 70, 95, 15, "whip", { lv: 3, effect: { foe: { ac: -1 }, chance: 0.2 } }),
  bollacorrosiva: M("Bolla Corrosiva", "acid", 75, 90, 10, "orb", { lv: 3, effect: { foe: { ac: -1 }, chance: 0.3 } }),
  corazzamelma: M("Corazza di Melma", "acid", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 2 } } }),
  tonfo: M("Tonfo Gelatinoso", "acid", 85, 90, 10, "stomp", { lv: 4, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  bagnoacido: M("Bagno d'Acido", "acid", 90, 85, 5, "burst", { lv: 4 }),
  caricamelmosa: M("Carica Melmosa", "acid", 100, 85, 8, "dash", { lv: 5, effect: { foe: { ac: -1 }, chance: 0.3 } }),
  pioggiaacida: M("Pioggia Acida", "acid", 100, 85, 8, "rain", { lv: 5, effect: { foe: { ac: -1 }, chance: 0.3 } }),
  faucidissolventi: M("Fauci Dissolventi", "acid", 115, 90, 5, "bite", { lv: 6, effect: { foe: { ac: -2 }, chance: 0.3 } }),
  geyseracido: M("Geyser d'Acido", "acid", 120, 80, 5, "spikes", { lv: 6, effect: { foe: { ac: -1 }, chance: 0.5 } }),
  // ── veleno ──
  veleno: M("Puntura Velenosa", "poison", 40, 100, 20, "sting", { lv: 1, effect: { poison: 0.3 } }),
  spruzzotossico: M("Spruzzo Tossico", "poison", 40, 100, 25, "orb", { lv: 1, effect: { poison: 0.2 } }),
  zannevelenose: M("Zanne Velenose", "poison", 60, 95, 15, "bite", { lv: 2, effect: { poison: 0.3 } }),
  nubetossica: M("Nube Tossica", "poison", 0, 85, 10, "cloud", { lv: 2, effect: { poison: 1 } }),
  pelleviscida: M("Pelle Viscida", "poison", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 1, def: 1 } } }),
  codapungente: M("Coda Pungente", "poison", 70, 95, 15, "sting", { lv: 3, effect: { poison: 0.3 } }),
  soffiomefitico: M("Soffio Mefitico", "poison", 75, 90, 10, "breath", { lv: 3, effect: { poison: 0.3 } }),
  artigliinfetti: M("Artigli Infetti", "poison", 85, 90, 10, "claw", { lv: 4, effect: { poison: 0.3 } }),
  fiotto: M("Fiotto di Veleno", "poison", 90, 85, 5, "beam", { lv: 4, effect: { poison: 0.3 } }),
  pungiglione: M("Pungiglione Letale", "poison", 100, 85, 8, "sting", { lv: 5, effect: { poison: 0.4 } }),
  palude: M("Palude Venefica", "poison", 100, 85, 8, "cloud", { lv: 5, effect: { poison: 0.4 } }),
  morsoviverna: M("Morso della Viverna", "poison", 120, 85, 5, "bite", { lv: 6, effect: { poison: 0.5 } }),
  miasma: M("Miasma", "poison", 120, 80, 5, "burst", { lv: 6, effect: { poison: 0.5 } }),
  // ── necrotico ──
  luminotetro: M("Lumino Tetro", "necrotic", 40, 100, 25, "orb", { lv: 1, effect: { foe: { atk: -1 }, chance: 0.1 } }),
  graffiospettrale: M("Graffio Spettrale", "necrotic", 45, 100, 25, "claw", { lv: 1 }),
  toccotetro: M("Tocco Tetro", "necrotic", 50, 100, 20, "drain", { lv: 2, effect: { drain: 0.5 } }),
  maledizione: M("Maledizione", "necrotic", 0, 90, 10, "curse", { lv: 2, effect: { foe: { atk: -1, def: -1 } } }),
  colpossa: M("Colpo d'Ossa", "necrotic", 55, 100, 20, "stomp", { lv: 2 }),
  armaturaossa: M("Armatura d'Ossa", "necrotic", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 2 } } }),
  morso: M("Morso Oscuro", "necrotic", 70, 95, 15, "bite", { lv: 3, effect: { foe: { def: -1 }, chance: 0.3 } }),
  raggiosinistro: M("Raggio Sinistro", "necrotic", 65, 95, 15, "beam", { lv: 3 }),
  frustaombra: M("Frusta d'Ombra", "necrotic", 85, 90, 10, "whip", { lv: 4, effect: { foe: { def: -1 }, chance: 0.2 } }),
  mietitura: M("Mietitura", "necrotic", 90, 85, 5, "burst", { lv: 4 }),
  falcespettrale: M("Falce Spettrale", "necrotic", 100, 85, 8, "claw", { lv: 5 }),
  prosciugare: M("Prosciugare Vita", "necrotic", 95, 90, 8, "drain", { lv: 5, effect: { drain: 0.5 } }),
  dannati: M("Carica dei Dannati", "necrotic", 120, 85, 5, "dash", { lv: 6, effect: { recoil: 0.25 } }),
  ditomorte: M("Dito della Morte", "necrotic", 120, 80, 5, "curse", { lv: 6 }),
  // ── radioso ──
  luccichio: M("Luccichio", "radiant", 45, 100, 25, "orb", { lv: 1, effect: { foe: { atk: -1 }, chance: 0.2 } }),
  artigliluce: M("Artiglio di Luce", "radiant", 40, 100, 25, "claw", { lv: 1 }),
  aureola: M("Aureola", "radiant", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 1, atk: 1 } } }),
  scudofede: M("Scudo della Fede", "radiant", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 2 } } }),
  cornosplendente: M("Corno Splendente", "radiant", 55, 100, 20, "dash", { lv: 2 }),
  benedizione: M("Benedizione", "radiant", 0, 100, 5, "heal", { lv: 3, effect: { heal: 0.5 } }),
  frustaluce: M("Frusta di Luce", "radiant", 70, 95, 15, "whip", { lv: 3, effect: { foe: { atk: -1 }, chance: 0.2 } }),
  raggio: M("Raggio Sacro", "radiant", 80, 90, 10, "beam", { lv: 3 }),
  morsosacro: M("Morso Sacro", "radiant", 85, 90, 10, "bite", { lv: 4 }),
  lucesplosione: M("Esplosione di Luce", "radiant", 90, 85, 5, "burst", { lv: 4, effect: { stun: 0.1 } }),
  caricaceleste: M("Carica Celeste", "radiant", 100, 85, 8, "dash", { lv: 5 }),
  colonnaluce: M("Colonna di Luce", "radiant", 100, 85, 8, "bolt", { lv: 5 }),
  giudizio: M("Giudizio", "radiant", 120, 85, 5, "stomp", { lv: 6, effect: { stun: 0.2 } }),
  raggiosolare: M("Raggio Solare", "radiant", 120, 80, 5, "beam", { lv: 6 }),
  // ── psichico ──
  ondamentale: M("Onda Mentale", "psychic", 45, 100, 25, "wave", { lv: 1 }),
  zampapsichica: M("Zampata Psichica", "psychic", 40, 100, 25, "stomp", { lv: 1 }),
  concentrazione: M("Concentrazione", "psychic", 0, 100, 10, "aura", { lv: 2, effect: { self: { atk: 2 } } }),
  scudomentale: M("Scudo Mentale", "psychic", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 2 } } }),
  morsoillusorio: M("Morso Illusorio", "psychic", 55, 100, 20, "bite", { lv: 2 }),
  ipnosi: M("Ipnosi", "psychic", 0, 75, 10, "curse", { lv: 3, effect: { stun: 1 } }),
  urlopsichico: M("Urlo Psichico", "psychic", 65, 95, 15, "wave", { lv: 3, effect: { foe: { atk: -1 }, chance: 0.3 } }),
  artiglifantasma: M("Artigli Fantasma", "psychic", 70, 95, 15, "claw", { lv: 3 }),
  telecinesi: M("Carica Telecinetica", "psychic", 85, 90, 10, "dash", { lv: 4 }),
  sguardo: M("Sguardo Malefico", "psychic", 85, 85, 5, "beam", { lv: 4, effect: { stun: 0.2 } }),
  frustamentale: M("Frusta Mentale", "psychic", 100, 85, 8, "whip", { lv: 5, effect: { stun: 0.2 } }),
  sferapsionica: M("Sfera Psionica", "psychic", 100, 85, 8, "orb", { lv: 5, effect: { foe: { atk: -1 }, chance: 0.3 } }),
  schiantotele: M("Schianto Telecinetico", "psychic", 120, 85, 5, "stomp", { lv: 6 }),
  tempestapsi: M("Tempesta Psichica", "psychic", 120, 80, 5, "curse", { lv: 6, effect: { stun: 0.2 } })
};
var MOVE_GRADES = [1, 4, 8, 14, 22, 32];
var USES_BY_GRADE = [null, null, 6, 4, 3, 2, 1];
function usesOf(moveId) {
  const m = PET_DEX_MOVES[moveId];
  if (!m) return null;
  if (m.uses !== void 0) return m.uses;
  if (m.effect?.heal) return 2;
  if (!m.lv) return 3;
  if (m.lv === 1 && m.power) return null;
  return USES_BY_GRADE[m.lv] ?? 1;
}
var profOf = (level) => 2 + Math.floor((level || 1) / 12);
var accMod = (acc) => Math.round(((acc ?? 90) - 90) / 5);
function dndOf(speciesKey, level = 1) {
  const b = PET_DEX[speciesKey]?.base || { hp: 40, atk: 10, def: 10, spd: 10 };
  const prof = profOf(level);
  const atkMod = Math.round((b.atk - 9) / 2);
  const defMod = Math.round((b.def - 10) / 2);
  const ac = (PET_DEX[speciesKey]?.ac ?? 10 + Math.round((b.def - 8) / 2) + (b.spd >= 14 ? 1 : 0)) + Math.floor((level || 1) / 12);
  return { prof, atkMod, defMod, ac, toHit: prof + atkMod, save: Math.floor(prof / 2) + defMod, dcBase: 12 + prof + atkMod };
}
var MAX_MOVES = 4;
var PHYS_FX = /* @__PURE__ */ new Set(["stomp", "bite", "claw", "whip", "sting", "dash"]);
var moveCat = (m) => PHYS_FX.has(PET_DEX_MOVES[m]?.fx) ? "atk" : "spell";
var gradeOfLevel = (level) => MOVE_GRADES.filter((l) => (level || 1) >= l).length;
function learnPool(speciesKey, grade) {
  const sp = PET_DEX[speciesKey];
  if (!sp) return [];
  return Object.keys(PET_DEX_MOVES).filter((m) => {
    const mv = PET_DEX_MOVES[m];
    if (mv.lv !== grade || sp.moves.includes(m)) return false;
    if (mv.type === sp.type) return true;
    return mv.type === "neutral" && moveCat(m) === "atk";
  });
}
var S = (key, name, icon, type, rarity, desc, look, base, moves, res = null) => ({ key, name, icon, type, rarity, desc, look, base, moves, res });
var R = (resist = [], immune = [], vuln = []) => ({ resist, immune, vuln });
var PET_DEX = {
  // ── ex iniziali, ora più rari (2026-10-31) ──
  brace: S(
    "brace",
    "Brace",
    "\u{1F432}",
    "fire",
    "epic",
    "Cucciolo di drago rosso: sputa scintille quando \xE8 contento.",
    "a baby red dragon wyrmling, tiny chubby body, small stubby wings, big shiny eyes, little horns, smoke puffing from its nostrils",
    { hp: 46, atk: 13, def: 10, spd: 12 },
    ["zampata", "scintilla", "sbuffo", "vampata"],
    R([], ["fire"])
  ),
  tartadrago: S(
    "tartadrago",
    "Tartadrago",
    "\u{1F422}",
    "water",
    "epic",
    "Tartaruga-drago appena uscita dal guscio: lenta, testarda, inaffondabile.",
    "a baby dragon turtle, round spiky blue-green shell, small dragon head with tiny fins, sleepy friendly face",
    { hp: 54, atk: 11, def: 14, spd: 7 },
    ["morsetto", "spruzzo", "guscio", "ondata"],
    R(["fire"])
  ),
  gufurso: S(
    "gufurso",
    "Gufurso",
    "\u{1F989}",
    "earth",
    "rare",
    "Cucciolo di gufo-orso: abbracci fortissimi, piume ovunque.",
    "a baby owlbear cub, fluffy brown fur and feathers, owl face with big round eyes and a small beak, stubby bear paws",
    { hp: 52, atk: 14, def: 11, spd: 8 },
    ["zampata", "rametto", "ruggitino", "terremoto"]
  ),
  pseudodrago: S(
    "pseudodrago",
    "Pseudodrago",
    "\u{1F409}",
    "poison",
    "rare",
    "Draghetto da spalla grande come un gatto: la coda punge e addormenta.",
    "a tiny pseudodragon, cat-sized slender reddish dragon with butterfly-like translucent wings, long curled tail with a stinger dripping a drop of purple venom, mischievous smile",
    { hp: 42, atk: 12, def: 9, spd: 15 },
    ["scattino", "veleno", "nubetossica", "fiotto"]
  ),
  gattombra: S(
    "gattombra",
    "Gattombra",
    "\u{1F408}\u200D\u2B1B",
    "psychic",
    "rare",
    "Gattino distorcente: lo vedi sempre un passo pi\xF9 in l\xE0 di dov'\xE8.",
    "a displacer beast kitten, dark blue-black panther kitten with six little legs and two soft tentacles on its back ending in pads, glowing violet eyes, shimmering illusory afterimage",
    { hp: 44, atk: 13, def: 10, spd: 13 },
    ["graffio", "ondamentale", "ipnosi", "sguardo"]
  ),
  // ── COMUNI ──
  mefitino: S(
    "mefitino",
    "Mefitino",
    "\u{1F608}",
    "fire",
    "starter",
    "Mefite di magma che gocciola lava e ride per niente.",
    "a tiny magma mephit, small impish creature made of cooling lava with glowing cracks, little bat wings, cheeky grin",
    { hp: 40, atk: 12, def: 9, spd: 12 },
    ["scintilla", "graffio", "fuocherello", "sbuffo"],
    R([], ["fire", "poison"])
  ),
  cubetto: S(
    "cubetto",
    "Cubetto",
    "\u{1F9CA}",
    "acid",
    "starter",
    "Cubo gelatinoso grande come un dado: dentro ha sempre una moneta.",
    "a small gelatinous cube, translucent wobbly lime-green acidic jelly cube with a tiny coin and a little bone floating inside, two cute dot eyes, tiny acid bubbles",
    { hp: 58, atk: 10, def: 12, spd: 5 },
    ["sputoacido", "ingoiare", "guscio", "bagnoacido"]
  ),
  funghetto: S(
    "funghetto",
    "Funghetto",
    "\u{1F344}",
    "earth",
    "starter",
    "Miconide bambino: comunica a sbuffi di spore profumate.",
    "a baby myconid, small walking mushroom person with a spotted purple cap, stubby legs and arms, sleepy eyes, puffs of spores",
    { hp: 46, atk: 10, def: 11, spd: 7 },
    ["rametto", "spore", "linfa", "pisolino"]
  ),
  saltello: S(
    "saltello",
    "Saltello",
    "\u{1F415}",
    "radiant",
    "starter",
    "Cucciolo di cane intermittente: sparisce e ricompare per giocare.",
    "a blink dog puppy, golden fey puppy with big ears, sparkles of light around it as it teleports, happy tongue out",
    { hp: 42, atk: 11, def: 9, spd: 15 },
    ["scattino", "luccichio", "aureola", "lucesplosione"]
  ),
  diavoletto: S(
    "diavoletto",
    "Diavoletto",
    "\u{1F47F}",
    "necrotic",
    "common",
    "Imp dispettoso che firma contratti col pennarello.",
    "a tiny imp, small red devil with little horns, bat wings, a pointed tail, holding a tiny scroll, wisps of dark smoke, smug smile",
    { hp: 40, atk: 12, def: 9, spd: 13 },
    ["graffio", "toccotetro", "maledizione", "raggiosinistro"],
    R(["cold"], ["fire", "poison"])
  ),
  scrignetto: S(
    "scrignetto",
    "Scrignetto",
    "\u{1F9F0}",
    "acid",
    "common",
    "Mimic cucciolo: finge di essere un portagioie. Morde le dita.",
    "a baby mimic shaped like a small wooden treasure chest, open lid showing tiny teeth and a long pink sticky tongue dripping green goo, two little eyes on the lid",
    { hp: 52, atk: 12, def: 13, spd: 6 },
    ["morsetto", "sputoacido", "melma", "spruzzoacido"],
    R([], ["acid"])
  ),
  yetino: S(
    "yetino",
    "Yetino",
    "\u{1F43B}\u200D\u2744\uFE0F",
    "cold",
    "starter",
    "Cucciolo di yeti: si rotola nella neve e ne esce pi\xF9 grosso.",
    "a baby yeti, round fluffy white fur ball with small blue face, tiny horns, big feet, snowflakes around",
    { hp: 52, atk: 12, def: 12, spd: 7 },
    ["zampata", "brina", "mantobrina", "grandine"],
    R([], ["cold"])
  ),
  brinello: S(
    "brinello",
    "Brinello",
    "\u2744\uFE0F",
    "cold",
    "common",
    "Mefite del ghiaccio: starnutisce fiocchi di neve.",
    "a tiny ice mephit, small impish creature made of icy blue crystal, frosty wings, icicle horns, sneezing a snowflake",
    { hp: 40, atk: 12, def: 9, spd: 13 },
    ["brina", "scattino", "soffiogelo", "morsogelo"],
    R([], ["cold", "poison"], ["bludgeoning", "fire"])
  ),
  granchietto: S(
    "granchietto",
    "Granchietto",
    "\u{1F980}",
    "water",
    "starter",
    "Granchio gigante, ma non ancora. Pizzica tutto quello che luccica.",
    "a baby giant crab, round shiny red-blue shell, oversized claws, eyes on stalks, bubbles around it",
    { hp: 48, atk: 12, def: 14, spd: 6 },
    ["graffio", "bolla", "guscio", "ondata"]
  ),
  ragnetto: S(
    "ragnetto",
    "Ragnetto",
    "\u{1F577}\uFE0F",
    "poison",
    "starter",
    "Ragno gigante neonato: otto occhi, otto zampe, otto volte coccolone.",
    "a baby giant spider, fuzzy round dark purple body, eight big shiny eyes, stubby legs, tiny fangs dripping green venom",
    { hp: 42, atk: 12, def: 10, spd: 13 },
    ["zannevelenose", "scattino", "melma", "nubetossica"]
  ),
  scheletrino: S(
    "scheletrino",
    "Scheletrino",
    "\u{1F9B4}",
    "necrotic",
    "starter",
    "Cucciolo di scheletro: porta l'osso, ma \xE8 il suo.",
    "a skeleton puppy, small undead dog made of white bones with a big round skull, ghostly green glow in the eye sockets, wagging bony tail",
    { hp: 44, atk: 12, def: 11, spd: 11 },
    ["morsetto", "toccotetro", "ruggitino", "morso"],
    R([], ["poison"], ["bludgeoning"])
  ),
  behirino: S(
    "behirino",
    "Behirino",
    "\u{1F40D}",
    "lightning",
    "starter",
    "Behir neonato: un serpentone con dodici zampette che sputa scintille.",
    "a baby behir, small long blue serpentine lizard with many tiny stubby legs, little curved horns, crackling small lightning sparks from its mouth, big friendly eyes",
    { hp: 44, atk: 12, def: 10, spd: 13 },
    ["morsetto", "scarica", "caricastatica", "scossa"],
    R([], ["lightning"])
  ),
  flumphino: S(
    "flumphino",
    "Flumphino",
    "\u{1FABC}",
    "psychic",
    "starter",
    "Flumph cucciolo: una medusa volante gentile che sente i pensieri. E si offende.",
    "a baby flumph, small floating pale jellyfish-like creature with a round disc body, little tendrils hanging below, two eyestalks on top, soft pink psychic glow, gentle smile",
    { hp: 46, atk: 11, def: 11, spd: 12 },
    ["ondamentale", "scattino", "concentrazione", "urlopsichico"],
    R([], [], ["psychic"])
  ),
  // ── RARI ──
  salamandrina: S(
    "salamandrina",
    "Salamandrina",
    "\u{1F98E}",
    "fire",
    "rare",
    "Salamandra di fuoco: la coda brucia come una candela.",
    "a baby fire salamander, small orange-red serpentine lizard with a flaming tail and fiery spines along its back, bright eyes",
    { hp: 46, atk: 15, def: 10, spd: 13 },
    ["scintilla", "morsofuoco", "sbuffo", "vampata"],
    R([], ["fire"], ["cold"])
  ),
  krakino: S(
    "krakino",
    "Krakino",
    "\u{1F419}",
    "water",
    "rare",
    "Kraken neonato: otto tentacoli, zero buone maniere.",
    "a baby kraken, small round squid-octopus with many curly tentacles, huge curious eyes, deep teal and purple colors",
    { hp: 56, atk: 13, def: 12, spd: 9 },
    ["spruzzo", "inchiostro", "bolla", "ondata"],
    R([], ["lightning"])
  ),
  ruggine: S(
    "ruggine",
    "Ruggine",
    "\u{1F41C}",
    "acid",
    "rare",
    "Mostro della ruggine piccolo: si mangia le forchette di nascosto.",
    "a baby rust monster, insect-like creature with a rusty orange armored body, two long feathery antennae, wagging tail like a puppy, flakes of rust",
    { hp: 50, atk: 14, def: 14, spd: 9 },
    ["morsetto", "sputoacido", "spruzzoacido", "bagnoacido"]
  ),
  turbino: S(
    "turbino",
    "Turbino",
    "\u{1F32A}\uFE0F",
    "lightning",
    "rare",
    "Elementale della tempesta in miniatura: un mulinello che fa scintille.",
    "a tiny storm elemental, a small swirling whirlwind of pale blue air crackling with little lightning sparks, two cute eyes",
    { hp: 42, atk: 14, def: 9, spd: 17 },
    ["saetta", "scarica", "caricastatica", "fulmine"],
    R(["lightning"], ["poison"])
  ),
  occhietto: S(
    "occhietto",
    "Occhietto",
    "\u{1F441}\uFE0F",
    "psychic",
    "rare",
    "Spettatore cucciolo: un occhione, quattro occhietti, tanta curiosit\xE0.",
    "a baby beholder (spectator), round floating purple ball with one big central eye and four small eyestalks, small toothy smile, pink psychic glow",
    { hp: 48, atk: 15, def: 11, spd: 10 },
    ["ondamentale", "ipnosi", "urlopsichico", "sguardo"]
  ),
  cornina: S(
    "cornina",
    "Cornina",
    "\u{1F984}",
    "radiant",
    "rare",
    "Puledra di unicorno: dove galoppa crescono margherite.",
    "a baby unicorn foal, white fluffy coat, small golden spiral horn glowing, pastel rainbow mane, big gentle eyes, little hooves",
    { hp: 50, atk: 12, def: 12, spd: 12 },
    ["scattino", "luccichio", "benedizione", "raggio"]
  ),
  cerberino: S(
    "cerberino",
    "Cerberino",
    "\u{1F415}\u200D\u{1F9BA}",
    "fire",
    "rare",
    "Segugio infernale cucciolo: abbaia scintille, scava buche nella lava.",
    "a hell hound puppy, small black dog with glowing red eyes, fiery orange mane and flaming tail, tiny fangs, ember sparks",
    { hp: 50, atk: 16, def: 11, spd: 13 },
    ["morsofuoco", "ruggitino", "sbuffo", "vampata"],
    R([], ["fire"])
  ),
  lupogelo: S(
    "lupogelo",
    "Lupogelo",
    "\u{1F43A}",
    "cold",
    "rare",
    "Cucciolo di lupo invernale: ulula e la brina si posa sugli alberi.",
    "a winter wolf pup, fluffy snow-white wolf cub with icy blue eyes, frosty breath, little icicles on its fur",
    { hp: 50, atk: 15, def: 11, spd: 14 },
    ["morsogelo", "ruggitino", "soffiogelo", "grandine"],
    R([], ["cold"])
  ),
  gocciolo: S(
    "gocciolo",
    "Gocciolo",
    "\u{1F4A7}",
    "water",
    "rare",
    "Stranezza dell'acqua: una goccia viva che si offende se la bevi.",
    "a tiny water weird, a living droplet of clear blue water shaped like a little serpent with a big drop head, two shiny eyes, small splashes",
    { hp: 50, atk: 13, def: 12, spd: 12 },
    ["spruzzo", "bolla", "pioggia", "ondata"],
    R(["fire"], ["poison"])
  ),
  fuocofatuo: S(
    "fuocofatuo",
    "Fuocofatuo",
    "\u{1F506}",
    "lightning",
    "rare",
    "Fuoco fatuo: una lucina elettrica che ti porta dove non dovresti.",
    "a will-o'-wisp, small floating ball of pale blue-yellow electric light with a cute face, crackling little sparks, faint glowing trail",
    { hp: 40, atk: 15, def: 9, spd: 17 },
    ["scarica", "saetta", "scossa", "fulmine"],
    R(["acid", "cold", "fire", "necrotic"], ["lightning", "poison"])
  ),
  otyughino: S(
    "otyughino",
    "Otyughino",
    "\u{1F5D1}\uFE0F",
    "poison",
    "rare",
    "Otyugh piccolo: vive nei rifiuti e li trova deliziosi.",
    "a baby otyugh, round lumpy greenish-brown blob creature on three stubby legs, two little tentacles, one eye on a stalk, big toothy grin, stink lines",
    { hp: 58, atk: 14, def: 13, spd: 7 },
    ["zannevelenose", "ingoiare", "nubetossica", "fiotto"]
  ),
  fantasmino: S(
    "fantasmino",
    "Fantasmino",
    "\u{1F47B}",
    "necrotic",
    "rare",
    'Fantasma giovane: fa "buh" e poi si scusa.',
    "a little ghost, small translucent pale green spirit with a wispy tail, big sad-cute eyes, ghostly chains as a tiny bracelet",
    { hp: 44, atk: 15, def: 12, spd: 12 },
    ["toccotetro", "maledizione", "raggiosinistro", "mietitura"],
    R(["acid", "fire", "lightning"], ["cold", "necrotic", "poison"])
  ),
  // ── EPICI ──
  squalterra: S(
    "squalterra",
    "Squalterra",
    "\u{1F988}",
    "earth",
    "epic",
    "Bulette cucciolo: nuota nel terreno come uno squalo nel mare.",
    "a baby bulette (landshark), armored blue-grey shell plates, shark-like head with a small fin on its back, stubby clawed legs, bursting out of the ground",
    { hp: 58, atk: 17, def: 15, spd: 9 },
    ["morsetto", "frana", "testata", "terremoto"]
  ),
  piumaserpe: S(
    "piumaserpe",
    "Piumaserpe",
    "\u{1FAB6}",
    "radiant",
    "epic",
    "Couatl neonato: serpente piumato che sa sempre la verit\xE0.",
    "a baby couatl, small feathered serpent with rainbow feathered wings, golden scales, gentle wise eyes, soft holy glow",
    { hp: 50, atk: 15, def: 12, spd: 15 },
    ["luccichio", "benedizione", "raggio", "lucesplosione"],
    R(["radiant"])
  ),
  nevischio: S(
    "nevischio",
    "Nevischio",
    "\u{1F432}",
    "cold",
    "epic",
    "Cucciolo di drago bianco: morde i ghiaccioli come caramelle.",
    "a baby white dragon wyrmling, chubby icy-white dragon with pale blue frills, small frosty wings, big eyes, frost crystals on its horns",
    { hp: 54, atk: 16, def: 13, spd: 13 },
    ["brina", "morsogelo", "soffiogelo", "grandine"],
    R([], ["cold"])
  ),
  saettino: S(
    "saettino",
    "Saettino",
    "\u{1F409}",
    "lightning",
    "epic",
    "Cucciolo di drago blu: ogni starnuto \xE8 un piccolo temporale.",
    "a baby blue dragon wyrmling, chubby sapphire-blue dragon with a single small horn on its nose, tiny wings, little lightning sparks crackling around",
    { hp: 52, atk: 17, def: 12, spd: 14 },
    ["scarica", "morsetto", "scossa", "fulmine"],
    R([], ["lightning"])
  ),
  girino: S(
    "girino",
    "Girino",
    "\u{1F991}",
    "psychic",
    "epic",
    "Girino di mind flayer, ma buono. Dice. Legge i pensieri a voce alta.",
    "a cute baby mind flayer tadpole, small purple-pink wiggly tadpole with four tiny face tentacles, huge glossy white eyes, glowing psychic aura",
    { hp: 48, atk: 17, def: 11, spd: 14 },
    ["ondamentale", "concentrazione", "urlopsichico", "sguardo"]
  ),
  // ── LEGGENDARI ──
  tarrasquino: S(
    "tarrasquino",
    "Tarrasquino",
    "\u{1F996}",
    "earth",
    "legendary",
    "Il Tarrasque, ma in miniatura. Per ora. Mangia di tutto.",
    "a baby tarrasque, small chunky purple-green reptile kaiju with a spiked shell back, two forward horns, tiny claws, big hungry mouth, adorable",
    { hp: 64, atk: 18, def: 16, spd: 10 },
    ["morsetto", "ruggitino", "testata", "terremoto"],
    R(["bludgeoning", "piercing", "slashing"], ["fire", "poison"])
  ),
  lichetto: S(
    "lichetto",
    "Lichetto",
    "\u2620\uFE0F",
    "necrotic",
    "legendary",
    "Un lich piccolissimo col filatterio a forma di ciuccio.",
    "a tiny chibi lich, small skeletal sorcerer in oversized tattered purple robes and a little golden crown, glowing green eyes, holding a tiny phylactery like a pacifier, necrotic green wisps",
    { hp: 56, atk: 19, def: 14, spd: 13 },
    ["raggiosinistro", "maledizione", "toccotetro", "mietitura"],
    R(["cold", "lightning", "necrotic"], ["poison"])
  )
};
var PET_DEX_ORDER = Object.keys(PET_DEX);
var STARTERS = PET_DEX_ORDER.filter((k) => PET_DEX[k].rarity === "starter").sort((a, b) => ELEMENTS.indexOf(PET_DEX[a].type) - ELEMENTS.indexOf(PET_DEX[b].type));
var ELEMENT_ODDS = { common: 70, rare: 25, epic: 4.5, legendary: 0.5 };
var PRISM_ODDS = { common: 40, rare: 45, epic: 13, legendary: 2 };
var EGG_NAME = {
  fire: "Uovo di Brace",
  cold: "Uovo di Brina",
  water: "Uovo delle Maree",
  lightning: "Uovo della Tempesta",
  earth: "Uovo di Pietra",
  acid: "Uovo Corrosivo",
  poison: "Uovo Velenoso",
  necrotic: "Uovo della Cripta",
  radiant: "Uovo Aureo",
  psychic: "Uovo Onirico"
};
var EGGS = {
  ...Object.fromEntries(ELEMENTS.map((el) => [el, {
    key: el,
    name: EGG_NAME[el],
    element: el,
    cost: 60,
    odds: ELEMENT_ODDS,
    desc: `Dentro c'\xE8 una creatura di ${TYPE_LABEL[el].toLowerCase()}.`
  }])),
  prismatic: {
    key: "prismatic",
    name: "Uovo Prismatico",
    element: null,
    cost: 200,
    odds: PRISM_ODDS,
    desc: "Cangiante: pu\xF2 contenere una creatura di qualunque elemento, e le rare escono pi\xF9 spesso."
  }
};
var EGG_ORDER = [...ELEMENTS, "prismatic"];
var eggPool = (eggKey, rarity) => PET_DEX_ORDER.filter((k) => {
  const egg = EGGS[eggKey];
  return (!egg?.element || PET_DEX[k].type === egg.element) && (!rarity || hatchRarityOf(k) === rarity);
});
function rollEgg(eggKey, rnd2 = Math.random) {
  const egg = EGGS[eggKey] || EGGS.prismatic;
  const total = HATCH_RARITIES.reduce((s, r) => s + egg.odds[r], 0);
  let x = rnd2() * total, rarity = "common";
  for (const r of HATCH_RARITIES) {
    if (x < egg.odds[r]) {
      rarity = r;
      break;
    }
    x -= egg.odds[r];
  }
  const idx = HATCH_RARITIES.indexOf(rarity);
  const order = [...HATCH_RARITIES.slice(0, idx + 1).reverse(), ...HATCH_RARITIES.slice(idx + 1)];
  for (const r of order) {
    const pool = eggPool(egg.key, r);
    if (pool.length) return { species: pool[Math.floor(rnd2() * pool.length)], rarity: r };
  }
  return { species: PET_DEX_ORDER[0], rarity: "common" };
}
var valueOf = (key) => RARITY[PET_DEX[key]?.rarity]?.value ?? 40;
var refundOf = (key) => Math.floor(valueOf(key) / 2);

// src/data/petBag.js
var SCROLL_SLOTS = 2;
var BASE = {
  caramella: {
    name: "Caramella Rara",
    icon: "\u{1F36C}",
    kind: "level",
    rarity: "legendary",
    price: null,
    desc: "Il pet sale subito di un livello. Rarissima: esce solo dalla Torre."
  },
  pietra: {
    name: "Pietra dell'Esperienza",
    icon: "\u{1F48E}",
    kind: "xp",
    rarity: "rare",
    price: 70,
    desc: "D\xE0 al pet PE pari a met\xE0 del suo livello attuale (minimo 60)."
  },
  amuleto_scudo: {
    name: "Amuleto dello Scudo",
    icon: "\u{1F6E1}\uFE0F",
    kind: "charm",
    rarity: "common",
    price: 30,
    fights: 3,
    fx: { ac: 2 },
    desc: "+2 alla Classe Armatura."
  },
  zanna: {
    name: "Zanna Affilata",
    icon: "\u{1F9B7}",
    kind: "charm",
    rarity: "common",
    price: 30,
    fights: 3,
    fx: { hit: 2 },
    desc: "+2 ai tiri per colpire e alla CD delle sue mosse."
  },
  ghianda: {
    name: "Ghianda Robusta",
    icon: "\u{1F330}",
    kind: "charm",
    rarity: "common",
    price: 30,
    fights: 3,
    fx: { hp: 0.15 },
    desc: "+15% di Punti Ferita massimi."
  },
  piuma: {
    name: "Piuma del Vento",
    icon: "\u{1FAB6}",
    kind: "charm",
    rarity: "common",
    price: 25,
    fights: 3,
    fx: { spd: 1 },
    desc: "Entra in campo con la Velocit\xE0 gi\xE0 aumentata."
  },
  occhio: {
    name: "Occhio di Gufo",
    icon: "\u{1F989}",
    kind: "charm",
    rarity: "common",
    price: 25,
    fights: 3,
    fx: { save: 3 },
    desc: "+3 ai tiri salvezza contro veleni, sonni e maledizioni."
  },
  bacca: {
    name: "Bacca Curativa",
    icon: "\u{1FAD0}",
    kind: "charm",
    rarity: "common",
    price: 20,
    fights: 2,
    fx: { berry: 0.35 },
    desc: "Sotto met\xE0 dei PF la mangia e recupera il 35% (una volta per lotta)."
  },
  quadrifoglio: {
    name: "Quadrifoglio",
    icon: "\u{1F340}",
    kind: "charm",
    rarity: "rare",
    price: 45,
    fights: 3,
    fx: { crit: 19 },
    desc: "Critico anche col 19 naturale."
  },
  pozione: {
    name: "Pozione",
    icon: "\u{1F9EA}",
    kind: "battle",
    rarity: "common",
    price: 15,
    use: { heal: 0.4 },
    desc: "In lotta: cura il 40% dei PF del pet scelto (consuma il turno)."
  },
  antidoto: {
    name: "Antidoto",
    icon: "\u{1F33F}",
    kind: "battle",
    rarity: "common",
    price: 10,
    use: { cure: true },
    desc: "In lotta: toglie veleno, scottatura e intontimento al pet scelto."
  },
  elisir: {
    name: "Elisir",
    icon: "\u2697\uFE0F",
    kind: "battle",
    rarity: "rare",
    price: 35,
    use: { uses: 2 },
    desc: "In lotta: rid\xE0 fino a 2 usi a ogni mossa che non \xE8 infinita."
  },
  fenice: {
    name: "Piuma della Fenice",
    icon: "\u{1FABD}",
    kind: "battle",
    rarity: "epic",
    price: 80,
    use: { revive: 0.5 },
    desc: "In lotta: rianima un pet a terra con met\xE0 dei PF."
  },
  corona: {
    name: "Coroncina del Campione",
    icon: "\u{1F451}",
    kind: "charm",
    rarity: "epic",
    price: 120,
    fights: 5,
    fx: { ac: 1, hit: 1, hp: 0.1 },
    desc: "+1 CA, +1 per colpire e +10% PF."
  }
};
var TALISMANS = Object.fromEntries(ELEMENTS.map((el) => [`talismano_${el}`, {
  name: `Talismano ${TYPE_LABEL[el] === "Fuoco" ? "del Fuoco" : `di ${TYPE_LABEL[el]}`}`,
  icon: TYPE_ICON[el],
  kind: "charm",
  rarity: "common",
  price: 30,
  fights: 3,
  fx: { resist: el },
  desc: `Resistenza ai danni da ${TYPE_LABEL[el].toLowerCase()} (met\xE0 danni).`
}]));
var SCROLL_PRICE = [0, 40, 60, 90, 130, 180, 240];
var SCROLLS = Object.fromEntries(Object.entries(PET_DEX_MOVES).filter(([, m]) => m.lv).map(([k, m]) => [`pergamena_${k}`, {
  name: `Pergamena: ${m.name}`,
  icon: "\u{1F4DC}",
  kind: "scroll",
  move: k,
  rarity: m.lv >= 5 ? "epic" : m.lv >= 3 ? "rare" : "common",
  price: SCROLL_PRICE[m.lv],
  desc: `Insegna ${m.name} (${TYPE_LABEL[m.type]}, grado ${m.lv}) a qualunque pet, al posto di una mossa che dimentica.`
}]));
var PET_BAG = { ...BASE, ...TALISMANS, ...SCROLLS };
var BAG_ORDER = Object.keys(PET_BAG);
var CHARMS = BAG_ORDER.filter((k) => PET_BAG[k].kind === "charm");
var SCROLL_IDS = BAG_ORDER.filter((k) => PET_BAG[k].kind === "scroll");
var usableInBattle = (id) => ["battle", "charm"].includes(PET_BAG[id]?.kind);
var charmFx = (pet) => pet?.charm && PET_BAG[pet.charm.id]?.fx || null;
function towerDrops(floor, rnd2 = Math.random) {
  const out = [];
  if (floor % 25 === 0 || rnd2() < 0.01) out.push("caramella");
  if (floor % 5 === 0) out.push(CHARMS[Math.floor(rnd2() * CHARMS.length)]);
  if (floor % 10 === 0) {
    const maxLv = Math.min(6, Math.ceil(floor / 10));
    const pool = SCROLL_IDS.filter((k) => PET_DEX_MOVES[PET_BAG[k].move].lv <= maxLv);
    out.push(pool[Math.floor(rnd2() * pool.length)]);
  }
  return out;
}

// src/data/petEngine.js
var rnd = Math.random;
function withSeed(seed, fn) {
  const prev = rnd;
  rnd = seeded(seed);
  try {
    return fn();
  } finally {
    rnd = prev;
  }
}
var d20 = () => 1 + Math.floor(rnd() * 20);
function diceAt(moveId, level) {
  const m = PET_DEX_MOVES[moveId];
  if (!m?.dice) return null;
  const [n, d] = m.dice.split("d").map(Number);
  return { n: Math.max(1, Math.round(n * (0.9375 + 0.0625 * (level || 1)))), d };
}
var INFINITE = -1;
var pick = (arr) => arr[Math.floor(rnd() * arr.length)];
var clamp = (v, a, b) => Math.max(a, Math.min(b, v));
var xpToNext = (level) => 30 + level * 20;
function addXp(pet, amount) {
  let level = pet.level || 1, xp = (pet.xp || 0) + Math.max(0, amount), ups = 0;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    ups += 1;
  }
  if (level >= MAX_LEVEL) xp = 0;
  return { ...pet, level, xp, ups };
}
function statsAt(speciesKey, level, boost = 1) {
  const b = PET_DEX[speciesKey]?.base || { hp: 40, atk: 10, def: 10, spd: 10 };
  const L = clamp(level || 1, 1, MAX_LEVEL);
  const grow = (v, k) => Math.round(v * (1 + (L - 1) * k) * boost);
  return { hp: Math.round(grow(b.hp, 0.08) * 0.8), atk: grow(b.atk, 0.06), def: grow(b.def, 0.06), spd: grow(b.spd, 0.05) };
}
var movesAt = (speciesKey, level) => (PET_DEX[speciesKey]?.moves || []).filter((_, i) => (level || 1) >= MOVE_UNLOCK[i]);
function learnedMoves(pet) {
  const g = gradeOfLevel(pet?.level);
  return Object.entries(pet?.learned || {}).filter(([grade, m]) => Number(grade) <= g && learnPool(pet.species, Number(grade)).includes(m)).sort((a, b) => a[0] - b[0]).map(([, m]) => m);
}
var knownMoves = (pet) => {
  const forgot = pet?.forgotten || [];
  const tms = (pet?.tms || []).filter((m) => PET_DEX_MOVES[m]);
  return [.../* @__PURE__ */ new Set([...movesAt(pet.species, pet.level).filter((m) => !forgot.includes(m)), ...learnedMoves(pet), ...tms])];
};
function battleMoves(pet) {
  const known = knownMoves(pet);
  const chosen = (Array.isArray(pet?.moveset) ? pet.moveset : []).filter((m, i, a) => known.includes(m) && a.indexOf(m) === i);
  if (chosen.length) return chosen.slice(0, MAX_MOVES);
  if (!known.length) return ["zampata"];
  return known.slice(0, MAX_MOVES).length === known.length ? known : [...known.slice(0, MAX_MOVES - 1), known[known.length - 1]];
}
function enemyMoveset(species, level, r) {
  const learned = {};
  for (let g = 1; g <= gradeOfLevel(level); g++) {
    const pool = learnPool(species, g);
    if (pool.length) learned[g] = pool[Math.floor(r() * pool.length)];
  }
  const known = knownMoves({ species, level, learned });
  if (known.length <= MAX_MOVES) return known;
  const pow = (m) => PET_DEX_MOVES[m].power;
  const status = known.find((m) => !pow(m));
  const hits = known.filter((m) => pow(m)).sort((a, b) => pow(b) - pow(a));
  return status ? [...hits.slice(0, MAX_MOVES - 1), status] : hits.slice(0, MAX_MOVES);
}
function makeFighter(pet, boost = 1) {
  const sp = PET_DEX[pet.species];
  const st = statsAt(pet.species, pet.level, boost);
  const d = dndOf(pet.species, pet.level);
  const cf = charmFx(pet) || {};
  const hp = Math.round(st.hp * (1 + (cf.hp || 0)));
  return {
    id: pet.id,
    species: pet.species,
    name: pet.nick || sp?.name || pet.species,
    type: sp?.type || "neutral",
    level: pet.level || 1,
    maxHp: hp,
    hp,
    atk: st.atk,
    def: st.def,
    spd: st.spd,
    // D&D: CA, bonus per colpire, CD delle mosse di stato, tiro salvezza (+ amuleto)
    atkMod: d.atkMod,
    dmgBoost: boost,
    ac: d.ac + (cf.ac || 0),
    toHit: d.toHit + (cf.hit || 0),
    dcBase: d.dcBase + (cf.hit || 0),
    save: d.save + (cf.save || 0),
    critOn: cf.crit || 20,
    resist: cf.resist || null,
    berry: cf.berry || 0,
    spd0: cf.spd || 0,
    charm: pet.charm?.id || null,
    stages: { atk: 0, def: 0, spd: cf.spd || 0, ac: 0 },
    status: null,
    // { kind: "burn"|"poison", turns }
    stunned: false,
    pp: Object.fromEntries(battleMoves(pet).map((m) => [m, usesOf(m) ?? INFINITE]))
  };
}
var stageMult = (s) => s >= 0 ? 1 + 0.25 * s : 1 / (1 + 0.25 * -s);
var eff = (f, stat) => f[stat] * stageMult(f.stages[stat] || 0);
function newBattle(playerPets, enemyPets, { enemyBoost = 1, aiLevel = 0, pvp = false, names = null } = {}) {
  return {
    pvp,
    names,
    sides: {
      p: { team: playerPets.map((p) => makeFighter(p)), active: 0 },
      e: { team: enemyPets.map((p) => makeFighter(p, enemyBoost)), active: 0 }
    },
    aiLevel,
    turn: 1,
    log: [],
    over: null,
    // "p" | "e" quando finisce
    needSwitch: null
    // "p" se il giocatore deve mandare un nuovo pet
  };
}
var activeOf = (b, side) => b.sides[side].team[b.sides[side].active];
var other = (side) => side === "p" ? "e" : "p";
var alive = (f) => f && f.hp > 0;
var benchAlive = (b, side) => b.sides[side].team.map((f, i) => ({ f, i })).filter(({ f, i }) => alive(f) && i !== b.sides[side].active);
var acOf = (f) => f.ac + (f.stages?.ac || 0);
function resistOf(f, kind) {
  const rm = resistMultiplier(f?.species, kind);
  return f?.resist === kind && rm > 0 ? rm * 0.5 : rm;
}
var snapOf = (b) => Object.fromEntries(["p", "e"].map((side) => {
  const s = b.sides[side];
  return [side, { active: s.active, hp: s.team.map((f) => f.hp), status: s.team.map((f) => f.status?.kind || (f.stunned ? "stun" : null)) }];
}));
function emit(b, out, ev) {
  out.push({ ...ev, snap: snapOf(b) });
}
function previewDamage(att, def, moveId) {
  const m = PET_DEX_MOVES[moveId];
  if (!m || !m.power) return 0;
  const dd = diceAt(moveId, att.level);
  const avg = Math.max(1, dd.n * (dd.d + 1) / 2 + (att.atkMod || 0));
  return avg * damageMult(att, def, m);
}
function damageMult(att, def, m) {
  const tm = typeMultiplier(m.type, def.type) * resistOf(def, damageKindOf(m));
  const stab = m.type === att.type && m.type !== "neutral" ? 1.25 : 1;
  return stageMult(att.stages.atk || 0) / stageMult(def.stages.def || 0) * tm * stab * (att.dmgBoost || 1);
}
function hitChance(att, def, moveId) {
  const m = PET_DEX_MOVES[moveId];
  if (!m || !def) return 1;
  const e = m.effect || {};
  if (m.power > 0) {
    const need = acOf(def) - (att.toHit + accMod(m.acc));
    const p = clamp((21 - need) / 20, 0.05, 0.95);
    return att.status?.kind === "poison" ? p * p : p;
  }
  if (e.foe || e.burn || e.poison || e.stun) return clamp((att.dcBase + accMod(m.acc) - def.save - 1) / 20, 0.05, 0.95);
  return 1;
}
var sign = (n) => n >= 0 ? `+ ${n}` : `\u2212 ${-n}`;
function rollText(r) {
  if (!r) return "";
  if (r.kind === "atk") {
    const dice = r.dis ? `${r.d} (svantaggio: ${r.d} e ${r.d2})` : `${r.d}`;
    return ` \u{1F3B2} ${dice} ${sign(r.mod)} = ${r.total} contro CA ${r.vs}${r.d === 20 ? " \xB7 20 naturale!" : ""}`;
  }
  return ` ${r.who} tira salvezza: \u{1F3B2} ${r.d} ${sign(r.mod)} = ${r.total} contro CD ${r.vs}`;
}
function berryCheck(b, side, out) {
  const f = activeOf(b, side);
  if (!f || !alive(f) || !f.berry || f.berryUsed || f.hp >= f.maxHp / 2) return;
  f.berryUsed = true;
  const h = Math.round(f.maxHp * f.berry);
  f.hp = Math.min(f.maxHp, f.hp + h);
  emit(b, out, { side, kind: "heal", amount: h, text: `${f.name} mangia la Bacca Curativa: +${h} PF!` });
}
function giveItemInBattle(b, side, itemId, idx, out) {
  const it = PET_BAG[itemId];
  const f = b.sides[side].team[idx];
  if (!it || !f) return;
  const who = b.names ? `${b.names[side]} d\xE0` : side === "p" ? "Dai" : "L'avversario d\xE0";
  const pre = `${who} ${it.icon} ${it.name} a ${f.name}`;
  const u = it.use || {};
  if (u.revive) {
    if (f.hp > 0) return;
    f.hp = Math.max(1, Math.round(f.maxHp * u.revive));
    f._fainted = false;
    f.status = null;
    f.stunned = false;
    emit(b, out, { side, kind: "heal", amount: f.hp, item: itemId, text: `${pre}: torna in piedi con ${f.hp} PF!` });
    return;
  }
  if (f.hp <= 0) return;
  if (u.heal) {
    const h = Math.min(f.maxHp - f.hp, Math.round(f.maxHp * u.heal));
    f.hp += h;
    emit(b, out, { side, kind: "heal", amount: h, item: itemId, text: `${pre}: +${h} PF.` });
  } else if (u.cure) {
    f.status = null;
    f.stunned = false;
    emit(b, out, { side, kind: "info", item: itemId, text: `${pre}: niente pi\xF9 veleno, scottature o intontimento.` });
  } else if (u.uses) {
    Object.keys(f.pp).forEach((m) => {
      if (f.pp[m] !== INFINITE) f.pp[m] = Math.min(usesOf(m) || 0, f.pp[m] + u.uses);
    });
    emit(b, out, { side, kind: "info", item: itemId, text: `${pre}: +${u.uses} usi alle sue mosse.` });
  } else if (it.kind === "charm") {
    const cf = it.fx || {};
    if (cf.hp) {
      const add = Math.round(f.maxHp * cf.hp);
      f.maxHp += add;
      f.hp += add;
    }
    f.ac += cf.ac || 0;
    f.toHit += cf.hit || 0;
    f.dcBase += cf.hit || 0;
    f.save += cf.save || 0;
    if (cf.crit) f.critOn = cf.crit;
    if (cf.resist) f.resist = cf.resist;
    if (cf.berry) f.berry = cf.berry;
    if (cf.spd) {
      f.spd0 = cf.spd;
      f.stages.spd = Math.max(f.stages.spd || 0, cf.spd);
    }
    f.charm = itemId;
    emit(b, out, { side, kind: "info", item: itemId, text: `${pre}: ${it.desc}` });
  }
}
function applyMove(b, side, moveId, out) {
  const att = activeOf(b, side), foe = activeOf(b, other(side));
  const m = PET_DEX_MOVES[moveId];
  if (!att || !alive(att) || !m) return;
  if (att.stunned) {
    att.stunned = false;
    emit(b, out, { side, kind: "stun", text: `${att.name} \xE8 intontito e non riesce a muoversi!` });
    return;
  }
  if (att.pp[moveId] > 0) att.pp[moveId] -= 1;
  const e = m.effect || {};
  const targetsFoe = alive(foe) && (m.power > 0 || e.foe || e.burn || e.poison || e.stun);
  let roll = null;
  if (targetsFoe && m.power > 0) {
    const dis = att.status?.kind === "poison";
    const r1 = d20(), r2 = dis ? d20() : r1;
    const d = Math.min(r1, r2);
    const mod = att.toHit + accMod(m.acc);
    const vs = acOf(foe);
    const ok = d === 20 || d !== 1 && d + mod >= vs;
    roll = { kind: "atk", d, d2: dis ? Math.max(r1, r2) : null, dis, mod, total: d + mod, vs, ok, crit: ok && d >= (att.critOn || 20) };
  } else if (targetsFoe) {
    const d = d20();
    const vs = att.dcBase + accMod(m.acc);
    const saved = d === 20 || d !== 1 && d + foe.save >= vs;
    roll = { kind: "save", d, mod: foe.save, total: d + foe.save, vs, ok: !saved, who: foe.name };
  }
  emit(b, out, { side, kind: "move", move: moveId, mtype: m.type, fx: m.fx, roll, att: att.name, mname: m.name, text: `${att.name} usa ${m.name}!${rollText(roll)}` });
  if (roll && !roll.ok) {
    const txt = roll.kind === "save" ? `\u2026${foe.name} resiste all'effetto!` : roll.d === 1 ? "\u20261 naturale: mancato!" : "\u2026ma manca il bersaglio!";
    emit(b, out, { side, kind: "miss", text: txt });
    return;
  }
  let dealt = 0, dmgTxt = "";
  const rm = resistOf(foe, damageKindOf(m));
  if (m.power > 0 && alive(foe) && rm === 0) {
    emit(b, out, { side, kind: "immune", target: other(side), text: `${foe.name} \xE8 immune: nessun danno!` });
  } else if (m.power > 0 && alive(foe)) {
    const crit = !!roll?.crit;
    const dd = diceAt(moveId, att.level);
    const nd = dd.n * (crit ? 2 : 1);
    let sum = 0;
    for (let i = 0; i < nd; i++) sum += 1 + Math.floor(rnd() * dd.d);
    const base = Math.max(1, sum + (att.atkMod || 0));
    const mult = damageMult(att, foe, m);
    dealt = Math.max(1, Math.round(base * mult));
    const multTxt = Math.abs(mult - 1) > 0.01 ? ` \xD7${String(Math.round(mult * 100) / 100).replace(".", ",")}` : "";
    dmgTxt = ` (\u{1F3B2} ${nd}d${dd.d} ${sign(att.atkMod || 0)} = ${base}${multTxt}, ${DMG_LABEL[damageKindOf(m)].toLowerCase()})`;
    foe.hp = Math.max(0, foe.hp - dealt);
    const tm = typeMultiplier(m.type, foe.type);
    const note = [
      tm > 1 ? " \xC8 superefficace!" : tm < 1 ? " Non \xE8 molto efficace\u2026" : "",
      rm > 1 ? ` ${foe.name} \xE8 vulnerabile!` : rm < 1 ? ` ${foe.name} resiste.` : ""
    ].join("");
    emit(b, out, {
      side,
      kind: "hit",
      dmg: dealt,
      crit,
      tm: tm * rm,
      target: other(side),
      text: `${foe.name} perde ${dealt} PF${dmgTxt}.${crit ? " Colpo critico: dadi doppi!" : ""}${note}`
    });
    berryCheck(b, other(side), out);
  }
  const chance = (c) => rnd() < (c ?? 1);
  if (e.drain && dealt) {
    const h = Math.max(1, Math.round(dealt * e.drain));
    att.hp = Math.min(att.maxHp, att.hp + h);
    emit(b, out, { side, kind: "heal", amount: h, text: `${att.name} recupera ${h} PF.` });
  }
  if (e.recoil && dealt) {
    const r = Math.max(1, Math.round(dealt * e.recoil));
    att.hp = Math.max(0, att.hp - r);
    emit(b, out, { side, kind: "recoil", text: `${att.name} si fa male nel colpo (\u2212${r} PF).` });
    berryCheck(b, side, out);
  }
  if (e.heal) {
    const h = Math.round(att.maxHp * e.heal);
    const before = att.hp;
    att.hp = Math.min(att.maxHp, att.hp + h);
    emit(b, out, { side, kind: "heal", amount: att.hp - before, text: att.hp > before ? `${att.name} recupera ${att.hp - before} PF.` : `${att.name} \xE8 gi\xE0 in piena forma.` });
  }
  if (e.self) {
    Object.entries(e.self).forEach(([k, v]) => {
      att.stages[k] = clamp((att.stages[k] || 0) + v, k === "ac" ? -4 : -3, k === "ac" ? 4 : 3);
    });
    emit(b, out, { side, kind: "buff", text: `${att.name} si carica: ${statWords(e.self)}.` });
  }
  if (alive(foe)) {
    if (e.foe && chance(e.chance)) {
      Object.entries(e.foe).forEach(([k, v]) => {
        foe.stages[k] = clamp((foe.stages[k] || 0) + v, k === "ac" ? -4 : -3, k === "ac" ? 4 : 3);
      });
      emit(b, out, { side, kind: "debuff", target: other(side), text: `${foe.name}: ${statWords(e.foe)}.` });
    }
    if ((e.burn || e.poison) && !foe.status) {
      const kind = e.burn ? "burn" : "poison";
      const immuneTo = resistMultiplier(foe.species, kind === "burn" ? "fire" : "poison") === 0;
      if (immuneTo) {
        if (!m.power) emit(b, out, { side, kind: "miss", text: `\u2026ma ${foe.name} \xE8 immune.` });
      } else if (chance(e.burn || e.poison)) {
        foe.status = { kind, turns: kind === "burn" ? 3 : 4 };
        emit(b, out, { side, kind: "status", target: other(side), text: `${foe.name} ${kind === "burn" ? "si scotta" : "\xE8 avvelenato"}!` });
      } else if (!m.power) emit(b, out, { side, kind: "miss", text: "\u2026ma non ha effetto." });
    }
    if (e.stun && !foe.stunned && chance(e.stun)) {
      foe.stunned = true;
      emit(b, out, { side, kind: "status", target: other(side), text: `${foe.name} \xE8 intontito!` });
    }
  }
}
var STAT_IT = { atk: "Attacco", def: "Difesa", spd: "Velocit\xE0" };
var statWords = (o) => Object.entries(o).map(([k, v]) => k === "ac" ? `CA ${v > 0 ? "+" : "\u2212"}${Math.abs(v)}` : `${STAT_IT[k]} ${v > 0 ? "\u2191".repeat(v) : "\u2193".repeat(-v)}`).join(", ");
function endOfTurn(b, out) {
  ["p", "e"].forEach((side) => {
    const f = activeOf(b, side);
    if (!alive(f) || !f.status) return;
    const frac = f.status.kind === "burn" ? 1 / 12 : 1 / 14;
    const d = Math.max(1, Math.round(f.maxHp * frac));
    f.hp = Math.max(0, f.hp - d);
    emit(b, out, { side, kind: "dot", text: `${f.name} ${f.status.kind === "burn" ? "brucia" : "soffre il veleno"} (\u2212${d} PF).` });
    f.status.turns -= 1;
    if (f.status.turns <= 0) {
      f.status = null;
      emit(b, out, { side, kind: "info", text: `${f.name} si riprende.` });
    }
    berryCheck(b, side, out);
  });
}
function doSwitch(b, side, idx, out) {
  const s = b.sides[side];
  const prev = activeOf(b, side);
  if (prev) {
    prev.stages = { atk: 0, def: 0, spd: prev.spd0 || 0, ac: 0 };
    prev.stunned = false;
  }
  s.active = idx;
  const name = activeOf(b, side).name;
  emit(b, out, { side, kind: "switch", text: b.names ? `${b.names[side]} manda in campo ${name}!` : side === "p" ? `Vai, ${name}!` : `L'avversario manda in campo ${name}!` });
}
function checkFaints(b, out) {
  ["e", "p"].forEach((side) => {
    const f = activeOf(b, side);
    if (f && f.hp <= 0 && !f._fainted) {
      f._fainted = true;
      emit(b, out, { side, kind: "faint", text: `${f.name} \xE8 esausto!` });
    }
  });
  const pLeft = b.sides.p.team.some(alive), eLeft = b.sides.e.team.some(alive);
  if (!eLeft) {
    b.over = "p";
    return;
  }
  if (!pLeft) {
    b.over = "e";
    return;
  }
  let need = "";
  if (!alive(activeOf(b, "p"))) need += "p";
  if (!alive(activeOf(b, "e"))) {
    if (b.pvp) need += "e";
    else doSwitch(b, "e", aiPickReplacement(b), out);
  }
  b.needSwitch = need || null;
}
function playTurn(battle, action, actionE = null) {
  const b = structuredClone(battle);
  const out = [];
  if (b.over) return { battle: b, events: out };
  b.log = b.log || [];
  if (b.needSwitch) {
    const pick2 = { p: action, e: actionE };
    const sides = b.needSwitch.split("");
    if (sides.some((sd) => pick2[sd]?.kind !== "switch")) return { battle: b, events: out };
    sides.forEach((sd) => doSwitch(b, sd, pick2[sd].index, out));
    b.needSwitch = null;
    b.log = [...b.log, ...out].slice(-80);
    return { battle: b, events: out };
  }
  const ai = b.pvp ? actionE : aiChoose(b);
  const acts = [{ side: "p", a: action, who: b.sides.p.active }, { side: "e", a: ai, who: b.sides.e.active }];
  const prio = ({ side, a }) => {
    if (a.kind === "switch" || a.kind === "item") return [10, 0];
    const f = activeOf(b, side);
    return [PET_DEX_MOVES[a.move]?.prio || 0, eff(f, "spd") + rnd() * 0.01];
  };
  acts.sort((x, y) => {
    const [px, sx] = prio(x), [py, sy] = prio(y);
    return py - px || sy - sx;
  });
  for (const { side, a, who } of acts) {
    if (b.over) break;
    const me = activeOf(b, side);
    if (a.kind === "switch") {
      doSwitch(b, side, a.index, out);
      continue;
    }
    if (a.kind === "item") {
      giveItemInBattle(b, side, a.item, a.index, out);
      continue;
    }
    if (b.sides[side].active !== who || !alive(me)) continue;
    applyMove(b, side, a.move, out);
    checkFaints(b, out);
    if (b.needSwitch) break;
  }
  if (!b.over) {
    endOfTurn(b, out);
    checkFaints(b, out);
  }
  b.turn += 1;
  b.log = [...b.log, ...out].slice(-80);
  return { battle: b, events: out };
}
function usableMoves(f) {
  const list = Object.keys(f.pp).filter((m) => f.pp[m] !== 0);
  return list.length ? list : ["zampata"];
}
function scoreMove(b, me, foe, m) {
  const mv = PET_DEX_MOVES[m];
  const e = mv.effect || {};
  const hc = hitChance(me, foe, m);
  let s = previewDamage(me, foe, m) * hc;
  const low = me.hp / me.maxHp;
  if (e.heal) s = low < 0.4 ? 40 : low < 0.65 ? 10 : 0;
  if (e.self) s = Math.max(s, (e.self.ac ? (me.stages.ac || 0) < 2 : me.stages.atk < 2) && low > 0.6 ? 12 : 2);
  if (e.foe && !mv.power) s = Math.max(s, foe.hp / foe.maxHp > 0.6 ? 9 * hc : 2);
  if ((e.burn || e.poison) && !mv.power) s = foe.status ? 0 : 16 * hc;
  if (e.stun && !mv.power) s = foe.stunned ? 0 : 15 * hc;
  if (mv.power && previewDamage(me, foe, m) * 0.85 >= foe.hp) s += 50;
  return s;
}
function bestMove(b, side) {
  const me = activeOf(b, side), foe = activeOf(b, other(side));
  const moves = usableMoves(me);
  return moves.map((m) => ({ m, s: scoreMove(b, me, foe, m) })).sort((x, y) => y.s - x.s)[0].m;
}
function matchup(attType, defType) {
  return typeMultiplier(attType, defType) / typeMultiplier(defType, attType);
}
function aiChoose(b) {
  const me = activeOf(b, "e"), foe = activeOf(b, "p");
  const lvl = b.aiLevel;
  if (lvl >= 3 && alive(me) && me.hp / me.maxHp > 0.25) {
    const bad = matchup(me.type, foe.type) < 1;
    if (bad && rnd() < 0.7) {
      const better = benchAlive(b, "e").find(({ f }) => matchup(f.type, foe.type) > 1);
      if (better) return { kind: "switch", index: better.i };
    }
  }
  if (lvl === 0) return { kind: "move", move: pick(usableMoves(me)) };
  if (lvl === 1 && rnd() < 0.45) return { kind: "move", move: pick(usableMoves(me)) };
  return { kind: "move", move: bestMove(b, "e") };
}
function aiPickReplacement(b) {
  const foe = activeOf(b, "p");
  const bench = benchAlive(b, "e");
  if (b.aiLevel >= 2 && foe) {
    bench.sort((x, y) => matchup(y.f.type, foe.type) - matchup(x.f.type, foe.type));
  }
  return bench[0]?.i ?? b.sides.e.active;
}
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = s * 1664525 + 1013904223 >>> 0;
    return s / 4294967296;
  };
}
var RARITY_FLOOR = { starter: 1, common: 1, rare: 8, epic: 18, legendary: 30 };
function rotation(week = "") {
  let h = 424242;
  for (const ch of String(week)) h = Math.imul(h, 31) + ch.charCodeAt(0) >>> 0;
  const r = seeded(h);
  const arr = [...PET_DEX_ORDER];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
var ROTATIONS = {};
var weekHash = (week) => {
  let h = 0;
  for (const ch of String(week || "")) h = Math.imul(h, 31) + ch.charCodeAt(0) >>> 0;
  return h;
};
function towerWeek(now = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date(now + 6e4)).map((x) => [x.type, x.value]));
  const back = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - back));
  return d.toISOString().slice(0, 10);
}
function towerFloor(floor, week = towerWeek()) {
  const n = Math.max(1, floor | 0);
  const size = n <= 3 ? 1 : n <= 9 ? 2 : 3;
  const ROTATION = ROTATIONS[week] ||= rotation(week);
  const wh = weekHash(week);
  const pool = ROTATION.filter((k) => RARITY_FLOOR[PET_DEX[k].rarity] <= n);
  const team = [];
  for (let i = 0; i < size; i++) {
    const k = pool[(n * 3 + i) % pool.length];
    const lead = Math.round(1 + (n - 1) * 0.55);
    const level = clamp(lead + (i === size - 1 && n % 5 === 0 ? 1 : 0) - (size - 1 - i), 1, MAX_LEVEL);
    team.push({ id: `tw${n}_${i}`, species: k, level, moveset: enemyMoveset(k, level, seeded(n * 104729 + i * 31 + wh)) });
  }
  const aiLevel = n < 4 ? 0 : n < 10 ? 1 : n < 20 ? 2 : 3;
  const enemyBoost = n <= 3 ? 0.65 + (n - 1) * 0.05 : 1 + Math.floor((n - 1) / 10) * 0.06;
  const boss = n % 5 === 0;
  return { floor: n, team, aiLevel, enemyBoost, boss };
}
var towerXp = (floor) => 25 + floor * 10;
var LOSS_XP = 5;
var towerLossXp = () => LOSS_XP;
var towerPoints = (floor) => 2 + Math.floor(floor / 5) * 2 + (floor % 5 === 0 ? 5 : 0);

// src/data/petOps.js
var newId = () => `pet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
var denOf = (data) => {
  const d = data?.petDen || {};
  return {
    starter: d.starter || null,
    pets: Array.isArray(d.pets) ? d.pets : [],
    team: Array.isArray(d.team) ? d.team : [],
    tower: { floor: 1, best: 0, wins: 0, ...d.tower || {} },
    eggs: Array.isArray(d.eggs) ? d.eggs : [],
    mascot: d.mascot || null,
    items: d.items && typeof d.items === "object" ? { ...d.items } : {},
    pvp: { wins: 0, losses: 0, day: "", rewarded: 0, claimed: [], ...d.pvp || {} },
    log: Array.isArray(d.log) ? d.log : []
  };
};
var LOG_MAX = 150;
var addLog = (den, entry) => {
  den.log = [{ t: (/* @__PURE__ */ new Date()).toISOString(), ...entry }, ...den.log].slice(0, LOG_MAX);
};
var countOf = (den, species) => den.pets.filter((p) => p.species === species).length;
var makePet = (species, from) => ({ id: newId(), species, level: 1, xp: 0, nick: "", from, at: (/* @__PURE__ */ new Date()).toISOString() });
function chooseStarter(den, data, species) {
  if (den.starter || den.pets.length) throw new Error("Hai gi\xE0 scelto il tuo primo compagno.");
  if (!STARTERS.includes(species)) throw new Error("Non \xE8 un pet iniziale.");
  const p = makePet(species, "starter");
  den.starter = species;
  den.pets.push(p);
  den.team = [p.id];
  addLog(den, { k: "starter", species });
}
function givePet(den, data, species) {
  if (!PET_DEX[species]) throw new Error("Specie sconosciuta.");
  if (countOf(den, species) >= MAX_PER_SPECIES) throw new Error(`Hai gi\xE0 ${MAX_PER_SPECIES} ${PET_DEX[species].name}.`);
  const p = makePet(species, "master");
  den.pets.push(p);
  if (den.team.length < MAX_TEAM) den.team.push(p.id);
  addLog(den, { k: "give", species });
}
var makeEgg = (egg, from) => ({ id: newId().replace("pet_", "egg_"), egg, from, at: (/* @__PURE__ */ new Date()).toISOString() });
function buyEgg(den, data, eggKey, { free = false } = {}) {
  const egg = EGGS[eggKey];
  if (!egg) throw new Error("Uovo sconosciuto.");
  if (den.eggs.length >= MAX_EGGS) throw new Error(`Il nido \xE8 pieno (${MAX_EGGS} uova): schiudine qualcuna.`);
  const cost = free ? 0 : egg.cost;
  const pts = Number(data.petPoints) || 0;
  if (pts < cost) throw new Error(`Ti mancano ${cost - pts} punti pet.`);
  den.eggs.push(makeEgg(eggKey, free ? "master" : "bottega"));
  addLog(den, { k: "egg_buy", egg: eggKey, cost });
  return { patch: cost ? { petPoints: pts - cost } : {} };
}
function hatchEgg(den, data, eggId) {
  if (!den.starter) throw new Error("Prima scegli il tuo pet iniziale.");
  const egg = den.eggs.find((e) => e.id === eggId);
  if (!egg) throw new Error("Quest'uovo non c'\xE8 pi\xF9.");
  den.eggs = den.eggs.filter((e) => e.id !== eggId);
  const { species, rarity } = rollEgg(egg.egg);
  if (countOf(den, species) >= MAX_PER_SPECIES) {
    const pts = refundOf(species);
    addLog(den, { k: "hatch", egg: egg.egg, species, rarity, refunded: pts });
    return { patch: { petPoints: (Number(data.petPoints) || 0) + pts }, out: { species, rarity, refunded: pts } };
  }
  const p = makePet(species, `uovo:${egg.egg}`);
  den.pets.push(p);
  const joined = den.team.length < MAX_TEAM;
  if (joined) den.team.push(p.id);
  addLog(den, { k: "hatch", egg: egg.egg, species, rarity });
  return { out: { species, rarity, petId: p.id, joined } };
}
var MASCOT_XP_BONUS = 0.05;
function setMascot(den, data, petId) {
  if (petId && !den.pets.some((p) => p.id === petId)) throw new Error("Pet non trovato.");
  den.mascot = petId || null;
}
function releasePet(den, data, petId) {
  if (den.pets.length <= 1) throw new Error("Non puoi restare senza pet.");
  if (den.mascot === petId) den.mascot = null;
  den.pets = den.pets.filter((p) => p.id !== petId);
  den.team = den.team.filter((id) => id !== petId);
  if (!den.team.length) den.team = [den.pets[0].id];
}
function setTeam(den, data, team) {
  const ids = [...new Set(team)].filter((id) => den.pets.some((p) => p.id === id)).slice(0, MAX_TEAM);
  if (!ids.length) throw new Error("La squadra deve avere almeno un pet.");
  den.team = ids;
}
function renamePet(den, data, petId, nick) {
  const p = den.pets.find((x) => x.id === petId);
  if (p) p.nick = String(nick || "").trim().slice(0, 18);
}
function learnMove(den, data, petId, grade, moveId) {
  const p = den.pets.find((x) => x.id === petId);
  if (!p) throw new Error("Pet non trovato.");
  if (grade > gradeOfLevel(p.level)) throw new Error("Grado non ancora sbloccato.");
  if (!learnPool(p.species, grade).includes(moveId)) throw new Error("Questo pet non pu\xF2 imparare questa mossa.");
  const before = battleMoves(p);
  const old = (p.learned || {})[grade];
  p.learned = { ...p.learned || {}, [grade]: moveId };
  let set = before.map((m) => m === old ? moveId : m);
  if (!set.includes(moveId) && set.length < MAX_MOVES) set = [...set, moveId];
  p.moveset = set;
}
function setMoveset(den, data, petId, moves) {
  const p = den.pets.find((x) => x.id === petId);
  if (!p) throw new Error("Pet non trovato.");
  const known = knownMoves(p);
  const set = moves.filter((m, i, a) => known.includes(m) && a.indexOf(m) === i).slice(0, MAX_MOVES);
  if (!set.length) throw new Error("Serve almeno una mossa.");
  p.moveset = set;
}
var addItems = (den, ids) => ids.forEach((id) => {
  if (PET_BAG[id]) den.items[id] = (den.items[id] || 0) + 1;
});
var takeItem = (den, id) => {
  if (!(den.items[id] > 0)) throw new Error("Non hai questo oggetto.");
  den.items[id] -= 1;
  if (!den.items[id]) delete den.items[id];
};
var petOf = (den, petId) => {
  const p = den.pets.find((x) => x.id === petId);
  if (!p) throw new Error("Pet non trovato.");
  return p;
};
function buyItem(den, data, id) {
  const it = PET_BAG[id];
  if (!it || !it.price) throw new Error("Questo oggetto non si compra.");
  const pts = Number(data.petPoints) || 0;
  if (pts < it.price) throw new Error(`Servono ${it.price} punti pet.`);
  addItems(den, [id]);
  addLog(den, { k: "item_buy", item: id, cost: it.price });
  const ledger = [{ source: "shop", label: `Bisaccia: ${it.name}`, amount: -it.price, ts: (/* @__PURE__ */ new Date()).toISOString() }, ...(data.petPointsLedger || []).slice(0, 29)];
  return { patch: { petPoints: pts - it.price, petPointsLedger: ledger } };
}
function giveItems(den, data, ids) {
  addItems(den, ids);
  addLog(den, { k: "item_give", items: ids });
}
function applyGrowthItem(den, data, petId, id) {
  const it = PET_BAG[id];
  const p = petOf(den, petId);
  if (it?.kind === "level") {
    if ((p.level || 1) >= MAX_LEVEL) throw new Error("\xC8 gi\xE0 al livello massimo.");
    takeItem(den, id);
    p.level = (p.level || 1) + 1;
    p.xp = 0;
    addLog(den, { k: "item_use", item: id, pet: p.id, species: p.species, level: p.level });
    return { out: { level: p.level } };
  }
  if (it?.kind === "xp") {
    if ((p.level || 1) >= MAX_LEVEL) throw new Error("\xC8 gi\xE0 al livello massimo.");
    takeItem(den, id);
    const n = addXp(p, Math.max(60, Math.round(xpToNext(p.level || 1) / 2)));
    p.level = n.level;
    p.xp = n.xp;
    addLog(den, { k: "item_use", item: id, pet: p.id, species: p.species, level: p.level });
    return { out: { level: p.level, ups: n.ups } };
  }
  throw new Error("Oggetto non adatto.");
}
function giveCharm(den, data, petId, id) {
  const it = PET_BAG[id];
  if (it?.kind !== "charm") throw new Error("Non \xE8 un amuleto.");
  const p = petOf(den, petId);
  takeItem(den, id);
  p.charm = { id, left: it.fights };
}
function teachScroll(den, data, petId, id, forget) {
  const it = PET_BAG[id];
  if (it?.kind !== "scroll") throw new Error("Non \xE8 una pergamena.");
  const p = petOf(den, petId);
  const known = knownMoves(p);
  if (known.includes(it.move)) throw new Error("La conosce gi\xE0.");
  if (!known.includes(forget)) throw new Error("Scegli la mossa da dimenticare.");
  const tms = (p.tms || []).filter((m) => m !== forget);
  if (tms.length >= SCROLL_SLOTS) throw new Error(`Ha gi\xE0 ${SCROLL_SLOTS} mosse da pergamena: dimentica una di quelle.`);
  const before = battleMoves(p);
  if ((p.tms || []).includes(forget)) {
  } else if (learnedMoves(p).includes(forget)) {
    const g = Object.keys(p.learned || {}).find((k) => p.learned[k] === forget);
    const learned = { ...p.learned || {} };
    delete learned[g];
    p.learned = learned;
  } else {
    p.forgotten = [...p.forgotten || [], forget];
  }
  takeItem(den, id);
  addLog(den, { k: "scroll", item: id, pet: p.id, species: p.species, forget });
  p.tms = [...tms, it.move];
  p.moveset = before.includes(forget) ? before.map((m) => m === forget ? it.move : m) : [...before, it.move].slice(0, MAX_MOVES);
}
function wearCharms(den, teamIds) {
  den.pets.forEach((p) => {
    if (!teamIds.includes(p.id) || !p.charm) return;
    const left = (p.charm.left || 1) - 1;
    if (left > 0) p.charm = { ...p.charm, left };
    else delete p.charm;
  });
}
function claimGifts(den, data) {
  const gifts = Array.isArray(data.petGifts) ? data.petGifts : [];
  if (!gifts.length) return { out: null };
  const got = [], refunded = [], eggs = [];
  let pts = Number(data.petPoints) || 0;
  gifts.forEach((g) => {
    if (g.item && PET_BAG[g.item]) {
      addItems(den, [g.item]);
      addLog(den, { k: "gift", item: g.item, from: g.from || "mercato" });
      eggs.push(`item:${g.item}`);
      return;
    }
    if (g.egg && EGGS[g.egg]) {
      den.eggs.push(makeEgg(g.egg, g.from || "mercato"));
      addLog(den, { k: "gift", egg: g.egg, from: g.from || "mercato" });
      eggs.push(g.egg);
      return;
    }
    if (!PET_DEX[g.species]) return;
    if (countOf(den, g.species) >= MAX_PER_SPECIES) {
      pts += refundOf(g.species);
      refunded.push(g.species);
      addLog(den, { k: "gift", species: g.species, from: g.from || "mercato", refunded: refundOf(g.species) });
      return;
    }
    addLog(den, { k: "gift", species: g.species, from: g.from || "mercato" });
    const p = makePet(g.species, g.from || "mercato");
    den.pets.push(p);
    if (den.team.length < MAX_TEAM) den.team.push(p.id);
    got.push(g.species);
  });
  return { patch: { petGifts: [], petPoints: pts }, out: { got, refunded, eggs } };
}
function recordTowerResult(den, data, floor, won, teamIds) {
  if (den.tower.floor !== floor) throw new Error("Questo piano \xE8 gi\xE0 stato registrato.");
  const xp = won ? towerXp(floor) : towerLossXp(floor);
  const ups = [];
  den.pets = den.pets.map((p) => {
    if (!teamIds.includes(p.id)) return p;
    const n = addXp(p, p.id === den.mascot ? Math.round(xp * (1 + MASCOT_XP_BONUS)) : xp);
    if (n.ups) ups.push({ id: p.id, species: p.species, level: n.level });
    const { ups: _u, ...rest } = n;
    return rest;
  });
  wearCharms(den, teamIds);
  const team = teamIds.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean).map((p) => `${p.species}:${p.level}`);
  if (!won) {
    const att = den.tower.att?.floor === floor ? den.tower.att.n || 0 : 0;
    den.tower = { ...den.tower, losses: (den.tower.losses || 0) + 1, att: { floor, n: att + 1 } };
    addLog(den, { k: "tower", f: floor, won: false, xp, team });
    return { out: { won: false, xp, pts: 0, ups, drops: [], att: att + 1 } };
  }
  const first = floor > (den.tower.best || 0);
  const pts = first ? towerPoints(floor) : 0;
  const drops = first ? towerDrops(floor) : [];
  addItems(den, drops);
  den.tower = { ...den.tower, att: null, floor: floor + 1, best: Math.max(den.tower.best || 0, floor), wins: (den.tower.wins || 0) + 1 };
  addLog(den, { k: "tower", f: floor, won: true, xp, pts, drops, team, again: !first });
  return { patch: pts ? { petPoints: (Number(data.petPoints) || 0) + pts } : {}, out: { won: true, xp, pts, ups, drops, again: !first } };
}
var PVP_POINTS = 3;
var PVP_DAILY = 3;
var PVP_WIN_XP = 10;
var PVP_LOSS_XP = 3;
var PVP_XP_FIGHTS = 5;
function recordPvpResult(den, data, match, side) {
  if (den.pvp.claimed.includes(match.id)) return { out: { already: true } };
  den.pvp.claimed = [match.id, ...den.pvp.claimed].slice(0, 40);
  const won = match.winner === side;
  const self = match.a === match.b;
  const teamIds = (match.teams?.[side] || []).map((p) => p.id);
  spendBattleItems(den, match.used?.[side], teamIds, match.teams?.[side]);
  wearCharms(den, teamIds);
  if (self) return { out: { won, self: true, xp: 0, pts: 0, ups: [], drops: [] } };
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (den.pvp.day !== day) {
    den.pvp.day = day;
    den.pvp.rewarded = 0;
    den.pvp.fights = 0;
  }
  const quit = !won && match.forfeit === side;
  const capped = (den.pvp.fights || 0) >= PVP_XP_FIGHTS;
  const xp = capped || quit ? 0 : won ? PVP_WIN_XP : PVP_LOSS_XP;
  if (!capped && !quit) den.pvp.fights = (den.pvp.fights || 0) + 1;
  const ups = [];
  den.pets = den.pets.map((p) => {
    if (!teamIds.includes(p.id) || !xp) return p;
    const n = addXp(p, xp);
    if (n.ups) ups.push({ id: p.id, species: p.species, level: n.level });
    const { ups: _u, ...rest } = n;
    return rest;
  });
  if (won) den.pvp.wins += 1;
  else den.pvp.losses += 1;
  let pts = 0;
  const drops = [];
  if (won && den.pvp.rewarded < PVP_DAILY) {
    den.pvp.rewarded += 1;
    pts = PVP_POINTS;
    if (Math.random() < 0.2) drops.push(CHARMS[Math.floor(Math.random() * CHARMS.length)]);
    addItems(den, drops);
  }
  addLog(den, { k: "pvp", won, xp, pts, drops, quit, capped, vs: side === "p" ? match.bName : match.aName });
  return { patch: pts ? { petPoints: (Number(data.petPoints) || 0) + pts } : {}, out: { won, xp, pts, ups, drops, capped, quit } };
}
function towerFresh(tower, week = towerWeek()) {
  const t = { ...tower || {}, week: tower?.week || "2026-10-26" };
  if (t.week === week) return { floor: 1, best: 0, wins: 0, ...t };
  return {
    week,
    floor: 1,
    best: 0,
    wins: 0,
    losses: 0,
    att: null,
    resets: 0,
    resetDay: t.resetDay || null,
    bestEver: Math.max(t.bestEver || 0, t.best || 0)
  };
}
var romeDay = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
var canResetTower = (tower, now = Date.now()) => (tower.floor || 1) > 1 && tower.resetDay !== romeDay(now);
function towerSeed(uid, den, floor, week = towerWeek()) {
  const t = towerFresh(den.tower, week);
  const att = t.att?.floor === floor ? t.att.n || 0 : 0;
  let h = 2166136261;
  for (const ch of `${uid}|${week}|${t.resets || 0}|${floor}|${att}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function resetTower(den) {
  den.tower = towerFresh(den.tower);
  if ((den.tower.floor || 1) <= 1) throw new Error("Sei gi\xE0 al piano 1.");
  const today = romeDay();
  if (den.tower.resetDay === today) throw new Error("Hai gi\xE0 ricominciato la torre oggi: riprova domani.");
  addLog(den, { k: "tower_reset", from: den.tower.floor });
  den.tower = { ...den.tower, floor: 1, att: null, resets: (den.tower.resets || 0) + 1, resetDay: today };
  return { out: { ok: true } };
}
function spendBattleItems(den, used, teamIds, team) {
  if (!used) return;
  Object.entries(used).forEach(([id, list]) => {
    (Array.isArray(list) ? list : []).forEach((idx) => {
      if (!(den.items[id] > 0) || !usableInBattle(id)) return;
      den.items[id] -= 1;
      if (PET_BAG[id].kind === "charm") {
        const pid = team?.[idx]?.id || teamIds[idx];
        const p = den.pets.find((x) => x.id === pid);
        if (p) p.charm = { id, left: PET_BAG[id].fights };
      }
    });
  });
  addLog(den, { k: "battle_items", items: Object.keys(used) });
}
var towerTurnSeed = (seed, i) => seed + (i + 1) * 7919 >>> 0;
function towerStart(den, floor, teamIds, seed, week = towerWeek()) {
  const pets = teamIds.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  if (!pets.length || pets.length !== teamIds.length || pets.length > MAX_TEAM) throw new Error("Squadra non valida.");
  const plan = towerFloor(floor, week);
  return withSeed(seed, () => newBattle(pets, plan.team, { enemyBoost: plan.enemyBoost, aiLevel: plan.aiLevel }));
}
function validAction(b, a, bag = {}) {
  const side = b.sides.p;
  const f = side.team[side.active];
  if (a?.kind === "item") {
    if (b.needSwitch && b.needSwitch.includes("p")) return false;
    const it = PET_BAG[a.item];
    const t = side.team[a.index];
    if (!it || !usableInBattle(a.item) || !(bag[a.item] > 0) || !Number.isInteger(a.index) || !t) return false;
    if (it.use?.revive) return t.hp <= 0;
    if (t.hp <= 0) return false;
    if (it.kind === "charm") return !t.charm;
    return true;
  }
  if (a?.kind === "switch") {
    const t = side.team[a.index];
    return Number.isInteger(a.index) && !!t && t.hp > 0 && a.index !== side.active;
  }
  if (b.needSwitch && b.needSwitch.includes("p")) return false;
  if (a?.kind !== "move") return false;
  const left = Object.values(f.pp);
  if (a.move === "zampata") return left.every((v) => v === 0);
  return Object.prototype.hasOwnProperty.call(f.pp, a.move) && f.pp[a.move] !== 0;
}
function replayTower(den, uid, floor, teamIds, actions, week = towerWeek()) {
  if (!Array.isArray(actions) || actions.length > 400) throw new Error("Lotta non valida.");
  const seed = towerSeed(uid, den, floor, week);
  let b = towerStart(den, floor, teamIds, seed, week);
  const bag = { ...den.items };
  const used = {};
  actions.forEach((a, i) => {
    if (b.over) throw new Error("Lotta non valida (azioni dopo la fine).");
    if (!validAction(b, a, bag)) throw new Error("Lotta non valida (mossa non permessa).");
    if (a.kind === "item") {
      bag[a.item] -= 1;
      (used[a.item] ||= []).push(a.index);
    }
    b = withSeed(towerTurnSeed(seed, i), () => playTurn(b, a).battle);
  });
  if (!b.over) throw new Error("La lotta non \xE8 finita.");
  return { over: b.over, used };
}
function towerFinish(den, data, floor, teamIds, actions, ctx) {
  const week = towerWeek();
  den.tower = towerFresh(den.tower, week);
  if (den.tower.floor !== floor) throw new Error(floor > 1 && den.tower.floor === 1 ? "La torre \xE8 ricominciata (nuova settimana o reset): riparti dal piano 1." : "Questo piano \xE8 gi\xE0 stato registrato.");
  const { over, used } = replayTower(den, ctx.uid, floor, teamIds, actions, week);
  spendBattleItems(den, used, teamIds, null);
  return recordTowerResult(den, data, floor, over === "p", teamIds);
}
var OPS = {
  chooseStarter: { run: chooseStarter },
  givePet: { run: givePet, master: true },
  buyEgg: { run: buyEgg, master: (args) => !!args[1]?.free },
  hatchEgg: { run: hatchEgg },
  setMascot: { run: setMascot },
  releasePet: { run: releasePet },
  setTeam: { run: setTeam },
  renamePet: { run: renamePet },
  learnMove: { run: learnMove },
  setMoveset: { run: setMoveset },
  buyItem: { run: buyItem },
  giveItems: { run: giveItems, master: true },
  applyGrowthItem: { run: applyGrowthItem },
  giveCharm: { run: giveCharm },
  teachScroll: { run: teachScroll },
  claimGifts: { run: claimGifts },
  towerFinish: { run: towerFinish },
  resetTower: { run: resetTower },
  recordPvpResult: { run: recordPvpResult, match: true }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LOSS_XP,
  MASCOT_XP_BONUS,
  OPS,
  PVP_DAILY,
  PVP_LOSS_XP,
  PVP_POINTS,
  PVP_WIN_XP,
  PVP_XP_FIGHTS,
  applyGrowthItem,
  buyEgg,
  buyItem,
  canResetTower,
  chooseStarter,
  claimGifts,
  countOf,
  denOf,
  giveCharm,
  giveItems,
  givePet,
  hatchEgg,
  learnMove,
  recordPvpResult,
  releasePet,
  renamePet,
  replayTower,
  resetTower,
  setMascot,
  setMoveset,
  setTeam,
  teachScroll,
  towerFinish,
  towerFresh,
  towerSeed,
  towerStart,
  towerTurnSeed,
  validAction
});
