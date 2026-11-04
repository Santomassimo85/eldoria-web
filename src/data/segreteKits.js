/* LE SEGRETE · eroi di classe (2026-11-04, rifatto: progressione permanente)
   Ogni giocatore ha UN eroe per classe che cresce per sempre (non si azzera):
   characters.storyChars[classe] = { stats: {str..cha}, asi: {str..cha}, picks: [id], xp }.
   - Caratteristiche come nell'Arena: 10 punti da distribuire come modificatori (0..+3).
   - PE come D&D (XP_TABLE); il livello si ricava dai PE.
   - Ogni 3 livelli (3, 6, 9…) +1 punto caratteristica (tetto +5) e una scelta in più.
   - Scelte (abilità/incantesimi): 1 alla creazione + 1 ogni 3 livelli, dall'elenco
     `pool` della classe (ognuna ha un livello minimo). Le `base` le ha sempre.
   Tipi di azione: weapon, spell (tiro per colpire), missile (colpisce sempre),
   save (TS; area = tutti i nemici), heal, heal_all, buff (ac/adv/dmg/rage, self o
   alleato o allParty), debuff (svantaggio a un nemico o a tutti). */

export const MAX_STORY_LEVEL = 20;
export const HERO_HP_MULT = 1.1;
// +10 PF fissi a ogni eroe (richiesta 2026-11-04), fuori dal moltiplicatore e dal budget dei mostri
export const HERO_HP_BASE = 10;
export const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
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
  stocco: { name: "Stocco", icon: "🗡", dice: "1d8", dmg: "piercing", wstat: "fin" },
  bastone: { name: "Bastone Ferrato", icon: "🦯", dice: "1d6", dmg: "bludgeoning", wstat: "str" },
  lancia: { name: "Lancia", icon: "🔱", dice: "1d6", dmg: "piercing", wstat: "str" },
  balestra_l: { name: "Balestra Leggera", icon: "🏹", dice: "1d8", dmg: "piercing", wstat: "dex", ranged: true },
  mazza: { name: "Mazza", icon: "🔨", dice: "1d6", dmg: "bludgeoning", wstat: "str" },
};
export const WEAPON_CHOICES = {
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
  bard: ["stocco", "spada_lunga"],
};
export const DMG_SHORT = { slashing: "tagliente", piercing: "perforante", bludgeoning: "contundente" };
export const WSTAT_LABEL = { str: "FOR", dex: "DES", fin: "FOR o DES" };
export const weaponChoices = (cls) => (WEAPON_CHOICES[cls] || WEAPON_CHOICES.fighter).map((k) => ({ key: k, ...WEAPONS[k], wstat: cls === "monk" ? "fin" : WEAPONS[k].wstat }));
// arma dell'eroe: quella scelta, altrimenti la prima della classe (eroi creati prima delle armi)
export function weaponOf(cls, key) {
  const list = weaponChoices(cls);
  return list.find((w) => w.key === key) || list[0];
}
export const weaponAction = (w) => ({ id: "arma", name: w.name, icon: w.icon, kind: "weapon", dice: w.dice, dmg: w.dmg, wstat: w.wstat, ranged: !!w.ranged, weaponKey: w.key, info: `${w.dice} ${DMG_SHORT[w.dmg] || ""} · ${WSTAT_LABEL[w.wstat]}` });
// modificatore di un'azione d'arma (colpire e danni)
export function weaponMod(cls, st, a) {
  if (!a?.wstat) return mainMod(cls, st);
  if (a.wstat === "fin") return Math.max(st.str || 0, st.dex || 0);
  return st[a.wstat] || 0;
}

/* armor: "heavy" = CA fissa · "light" = CA − 3 + DES · "unarmored" = 10 + DES + (COS|SAG) */
export const KITS = {
  fighter: { hitDie: 10, ac: 17, armor: "heavy", stat: "str", rec: ["str", "con"], extraAttacks: true,
    base: [{ id: "respiro", name: "Secondo Respiro", icon: "❤", kind: "heal", dice: "1d10", plusLevel: true, self: true, uses: 1 }],
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
      { id: "irruento", useWeapon: true, name: "Attacco Irruento", icon: "😤", kind: "weapon", dice: "1d12", dmg: "slashing", adv: true, selfDis: true, min: 1, uses: 3, info: "vantaggio, ma −2 CA" },
      { id: "lancio", name: "Ascia Lanciata", icon: "🎯", kind: "weapon", dice: "1d10", dmg: "slashing", min: 1 },
      { id: "ruggito", name: "Ruggito Feroce", icon: "🦁", kind: "debuff", area: true, turns: 1, min: 3, uses: 1, info: "tutti i nemici a svantaggio" },
      { id: "brutale", useWeapon: true, name: "Colpo Brutale", icon: "🔨", kind: "weapon", dice: "1d12", dmg: "slashing", rider: "1d12", riderDmg: "bludgeoning", min: 6, uses: 2, grow: true },
      { id: "inarrestabile", name: "Furia Inarrestabile", icon: "❤", kind: "heal", dice: "2d12", plusMod: true, self: true, min: 9, uses: 1 },
      { id: "terremoto", name: "Pestone Sismico", icon: "🌋", kind: "save", dice: "3d8", dmg: "bludgeoning", save: "str", area: true, half: true, min: 12, uses: 1, grow: true },
    ] },
  paladin: { hitDie: 10, ac: 18, armor: "heavy", stat: "str", rec: ["str", "cha"], extraAttacks: true, healStat: "cha",
    base: [{ id: "mani", name: "Imposizione delle Mani", icon: "🙌", kind: "heal", flat: "lv*5", uses: 1 }],
    pool: [
      { id: "punizione", useWeapon: true, name: "Punizione Divina", icon: "⚡", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "2d8", riderDmg: "radiant", min: 1, uses: 2, grow: true },
      { id: "benedizione", name: "Benedizione", icon: "✨", kind: "buff", buff: "adv", turns: 2, allParty: true, min: 1, uses: 1 },
      { id: "cura_p", name: "Cura Ferite", icon: "💚", kind: "heal", dice: "1d8", plusMod: true, min: 3, uses: 2, grow: true },
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
    base: [{ id: "furtivo", useWeapon: true, name: "Attacco Furtivo", icon: "🌒", kind: "weapon", dice: "1d8", dmg: "piercing", rider: "sneak", riderDmg: "piercing", uses: 3, info: "+metà livello in d6" }],
    pool: [
      { id: "nascondersi", name: "Nascondersi", icon: "🫥", kind: "buff", buff: "adv", turns: 2, self: true, min: 1, uses: 2 },
      { id: "veleno_r", name: "Lama Avvelenata", icon: "☠", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, min: 1, uses: 2 },
      { id: "basso", useWeapon: true, name: "Colpo Basso", icon: "🦵", kind: "weapon", dice: "1d8", dmg: "piercing", riderDis: 2, min: 3, uses: 2, info: "il nemico a svantaggio" },
      { id: "prodigiosa", name: "Schivata Prodigiosa", icon: "🤸", kind: "buff", buff: "ac", value: 4, turns: 1, self: true, min: 3, uses: 2 },
      { id: "fumogena", name: "Bomba Fumogena", icon: "💨", kind: "debuff", area: true, turns: 2, min: 6, uses: 1, info: "tutti i nemici a svantaggio" },
      { id: "assassinare", useWeapon: true, name: "Assassinare", icon: "🗡", kind: "weapon", dice: "1d8", dmg: "piercing", adv: true, rider: "4d6", riderDmg: "piercing", min: 9, uses: 1, grow: true },
    ] },
  wizard: { hitDie: 6, ac: 12, armor: "light", stat: "int", rec: ["int", "dex"],
    base: [{ id: "dardo_fuoco", name: "Dardo di Fuoco", icon: "🔥", kind: "spell", dice: "1d10", dmg: "fire", scale: true }, { id: "dardo_inc", name: "Dardo Incantato", icon: "✨", kind: "missile", dice: "3d4", flat: 3, dmg: "force", uses: 3, grow: true }],
    pool: [
      { id: "raggio_gelo", name: "Raggio di Gelo", icon: "❄", kind: "spell", dice: "1d8", dmg: "cold", scale: true, min: 1 },
      { id: "scudo", name: "Scudo", icon: "🛡", kind: "buff", buff: "ac", value: 5, turns: 1, self: true, min: 1, uses: 2 },
      { id: "mani_w", name: "Mani Brucianti", icon: "🖐", kind: "save", dice: "3d6", dmg: "fire", save: "dex", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "acida", name: "Freccia Acida", icon: "🧪", kind: "spell", dice: "4d4", dmg: "acid", min: 3, uses: 2, grow: true },
      { id: "palla_fuoco", name: "Palla di Fuoco", icon: "☄", kind: "save", dice: "8d6", dmg: "fire", save: "dex", area: true, half: true, min: 6, uses: 1, grow: true },
      { id: "ipnosi", name: "Trama Ipnotica", icon: "🌀", kind: "save", dice: "0d1", dmg: "psychic", save: "wis", area: true, stun: 1, min: 6, uses: 1, info: "chi fallisce resta stordito" },
      { id: "cono_freddo", name: "Cono di Freddo", icon: "🧊", kind: "save", dice: "8d8", dmg: "cold", save: "con", area: true, half: true, min: 9, uses: 1, grow: true },
    ] },
  sorcerer: { hitDie: 6, ac: 12, armor: "light", stat: "cha", rec: ["cha", "con"],
    base: [{ id: "fiotto", name: "Fiotto di Fuoco", icon: "🔥", kind: "spell", dice: "1d10", dmg: "fire", scale: true }, { id: "mani_br", name: "Mani Brucianti", icon: "🖐", kind: "save", dice: "3d6", dmg: "fire", save: "dex", area: true, half: true, uses: 2, grow: true }],
    pool: [
      { id: "veleno", name: "Spruzzo Velenoso", icon: "☠", kind: "save", dice: "1d12", dmg: "poison", save: "con", scale: true, min: 1 },
      { id: "scudo_s", name: "Scudo", icon: "🛡", kind: "buff", buff: "ac", value: 5, turns: 1, self: true, min: 1, uses: 2 },
      { id: "gemello", name: "Dardo Gemello", icon: "⚡", kind: "spell", dice: "1d10", dmg: "lightning", attacks: 2, min: 3, uses: 2, info: "due raggi" },
      { id: "fulmine", name: "Fulmine", icon: "🌩", kind: "save", dice: "8d6", dmg: "lightning", save: "dex", area: true, half: true, min: 6, uses: 1, grow: true },
      { id: "catena", name: "Catena di Fulmini", icon: "⛓", kind: "save", dice: "10d8", dmg: "lightning", save: "dex", area: true, half: true, min: 12, uses: 1 },
    ] },
  warlock: { hitDie: 8, ac: 13, armor: "light", stat: "cha", rec: ["cha", "con"],
    base: [{ id: "deflagrazione", name: "Deflagrazione Occulta", icon: "👁", kind: "spell", dice: "1d10", dmg: "force", scale: true }, { id: "maleficio", name: "Maleficio", icon: "🩸", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, uses: 2 }],
    pool: [
      { id: "agathys", name: "Armatura di Agathys", icon: "🧊", kind: "buff", buff: "ac", value: 3, turns: 3, self: true, min: 1, uses: 1 },
      { id: "hadar", name: "Braccia di Hadar", icon: "🐙", kind: "save", dice: "2d6", dmg: "necrotic", save: "str", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "vampiro", name: "Tocco Vampirico", icon: "🦇", kind: "spell", dice: "3d6", dmg: "necrotic", drain: true, min: 3, uses: 2, grow: true, info: "ti cura di metà del danno" },
      { id: "paura", name: "Paura", icon: "😱", kind: "debuff", area: true, turns: 2, min: 6, uses: 1, info: "tutti i nemici a svantaggio" },
      { id: "fame", name: "Fame di Hadar", icon: "🌑", kind: "save", dice: "4d6", dmg: "cold", save: "con", area: true, half: true, min: 9, uses: 1, grow: true },
      { id: "dito", name: "Dito della Morte", icon: "☠", kind: "save", dice: "7d8", flat: 20, dmg: "necrotic", save: "con", half: true, min: 15, uses: 1 },
    ] },
  druid: { hitDie: 8, ac: 14, armor: "light", stat: "wis", rec: ["wis", "con"],
    base: [{ id: "rovi", name: "Frusta di Rovi", icon: "🌿", kind: "spell", dice: "1d6", dmg: "piercing", scale: true }, { id: "cura_d", name: "Cura Ferite", icon: "💚", kind: "heal", dice: "1d8", plusMod: true, uses: 3, grow: true }],
    pool: [
      { id: "onda", name: "Onda Tonante", icon: "🌊", kind: "save", dice: "2d8", dmg: "thunder", save: "con", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "pelle", name: "Pelle di Corteccia", icon: "🌳", kind: "buff", buff: "ac", value: 3, turns: 3, min: 1, uses: 1 },
      { id: "lama_fiamma", name: "Lama di Fiamma", icon: "🔥", kind: "spell", dice: "3d6", dmg: "fire", min: 3, uses: 3, grow: true },
      { id: "luna", name: "Raggio di Luna", icon: "🌙", kind: "save", dice: "2d10", dmg: "radiant", save: "con", half: true, min: 3, uses: 2, grow: true },
      { id: "richiamo", name: "Richiamo del Fulmine", icon: "⚡", kind: "save", dice: "3d10", dmg: "lightning", save: "dex", half: true, min: 6, uses: 2, grow: true },
      { id: "tempesta", name: "Tempesta di Ghiaccio", icon: "🌨", kind: "save", dice: "4d6", dmg: "cold", save: "dex", area: true, half: true, min: 9, uses: 1, grow: true },
    ] },
  cleric: { hitDie: 8, ac: 18, armor: "heavy", stat: "wis", rec: ["wis", "con"],
    base: [{ id: "cura_c", name: "Cura Ferite", icon: "💚", kind: "heal", dice: "1d8", plusMod: true, uses: 3, grow: true }],
    pool: [
      { id: "fiamma", name: "Fiamma Sacra", icon: "🕯", kind: "save", dice: "1d8", dmg: "radiant", save: "dex", scale: true, min: 1 },
      { id: "benedire_c", name: "Benedizione", icon: "✨", kind: "buff", buff: "adv", turns: 2, allParty: true, min: 1, uses: 1 },
      { id: "arma_spir", name: "Arma Spirituale", icon: "🗡", kind: "missile", dice: "1d8", dmg: "force", plusMod: true, min: 3, uses: 3, grow: true },
      { id: "parola", name: "Parola Guaritrice di Massa", icon: "🙏", kind: "heal_all", dice: "1d4", plusMod: true, min: 3, uses: 2, grow: true },
      { id: "guardiani", name: "Guardiani Spirituali", icon: "👼", kind: "save", dice: "3d8", dmg: "radiant", save: "wis", area: true, half: true, min: 6, uses: 1, grow: true },
      { id: "guarigione", name: "Guarigione", icon: "💖", kind: "heal", flat: "lv*6", min: 12, uses: 1 },
    ] },
  bard: { hitDie: 8, ac: 14, armor: "light", stat: "cha", rec: ["cha", "dex"],
    base: [{ id: "beffa", name: "Beffa Crudele", icon: "🎭", kind: "save", dice: "1d4", dmg: "psychic", save: "wis", scale: true, dis: 1, info: "e svantaggio al bersaglio" }],
    pool: [
      { id: "parola_b", name: "Parola Guaritrice", icon: "🎵", kind: "heal", dice: "1d4", plusMod: true, min: 1, uses: 3, grow: true },
      { id: "ispirazione", name: "Ispirazione Bardica", icon: "🎶", kind: "buff", buff: "adv", turns: 2, min: 1, uses: 2 },
      { id: "onda_b", name: "Onda Tonante", icon: "🌊", kind: "save", dice: "2d8", dmg: "thunder", save: "con", area: true, half: true, min: 1, uses: 2, grow: true },
      { id: "sussurri", name: "Sussurri Dissonanti", icon: "👂", kind: "save", dice: "3d6", dmg: "psychic", save: "wis", half: true, min: 3, uses: 2, grow: true },
      { id: "riposo", name: "Canto di Riposo", icon: "🎼", kind: "heal_all", dice: "1d8", plusMod: true, min: 3, uses: 1, grow: true },
      { id: "risata", name: "Risata Incontenibile", icon: "😂", kind: "save", dice: "0d1", dmg: "psychic", save: "wis", stun: 1, min: 6, uses: 1, info: "chi fallisce resta stordito" },
    ] },
};

// Sempre disponibile: Difendersi (+4 CA fino al proprio turno). È anche l'azione automatica di chi sparisce.
export const DEFEND = { id: "difesa", name: "Difendersi", icon: "🛡", kind: "defend", info: "+4 CA fino al tuo prossimo turno" };

export const kitOf = (cls) => KITS[cls] || KITS.fighter;
export const poolFor = (cls, lv) => kitOf(cls).pool.filter((a) => (a.min || 1) <= lv);
export function heroActions(cls, lv, picks = [], weapon = null) {
  const k = kitOf(cls);
  const w = weaponOf(cls, weapon);
  const withWeapon = (a) => (a.useWeapon ? { ...a, dice: w.dice, dmg: w.dmg, wstat: w.wstat, ranged: !!w.ranged } : a);
  const chosen = k.pool.filter((a) => picks.includes(a.id) && (a.min || 1) <= lv);
  return [weaponAction(w), ...k.base.map(withWeapon), ...chosen.map(withWeapon), DEFEND];
}

/* Statistiche dell'eroe dalla scheda (stats + asi) */
export function heroStats(hero) {
  const out = {};
  STAT_KEYS.forEach((k) => { out[k] = Math.min(STAT_MAX, (Number(hero?.stats?.[k]) || 0) + (Number(hero?.asi?.[k]) || 0)); });
  return out;
}
export const mainMod = (cls, st) => st[kitOf(cls).stat] || 0;
/* PF TIRATI (2026-11-04): alla creazione e a ogni livello si tira il dado vita della
   classe (lo tira il server: hero.hpRolls[i] = tiro del livello i+1). Livello 1 = dado
   pieno + il tiro; livelli dopo = il tiro; + COS a ogni livello. Finché un tiro manca
   conta la media. In più HERO_HP_BASE (+10) fissi. */
export const hpPending = (hero) => Math.max(0, levelOfXp(hero?.xp) - (Array.isArray(hero?.hpRolls) ? hero.hpRolls.length : 0));
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
export function heroAc(cls, st) {
  const k = kitOf(cls);
  if (k.armor === "heavy") return k.ac;
  if (k.armor === "unarmored") return 10 + (st.dex || 0) + (st[k.unarmored] || 0);
  return k.ac - 3 + (st.dex || 0);
}
export const heroDc = (cls, lv, st) => 8 + profOf(lv) + mainMod(cls, st);
export const heroHit = (cls, lv, st) => profOf(lv) + mainMod(cls, st);
export function attacksOf(cls, lv, action) {
  const extra = lv >= 5 && kitOf(cls).extraAttacks && (action.kind === "weapon") ? 1 + (cls === "fighter" && lv >= 11) : 0;
  return (action.attacks || 1) + extra + (action.bonusAttacks || 0);
}

/* Validazione della scheda (la usa il server) */
export function validNewHero(cls, stats, pick, weapon) {
  if (!KITS[cls]) return "Classe sconosciuta.";
  if (!weaponChoices(cls).some((w) => w.key === weapon)) return "Scegli l'arma.";
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
export function heroPending(hero) {
  const lv = levelOfXp(hero?.xp);
  const asiSpent = STAT_KEYS.reduce((t, k) => t + (Number(hero?.asi?.[k]) || 0), 0);
  return { level: lv, asi: Math.max(0, asiEarned(lv) - asiSpent), picks: Math.max(0, picksAllowed(lv) - (hero?.picks || []).length) };
}
