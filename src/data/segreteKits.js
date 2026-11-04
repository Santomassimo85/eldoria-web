/* LE SEGRETE · kit delle classi (fase 3, 2026-11-04)
   Ogni classe ha dado vita, CA, caratteristica principale e azioni che si
   sbloccano col livello di storia. Regole D&D semplificate:
   - competenza 2 + (Lv−1)/4, modificatore della caratteristica 3 / 4 (Lv 4) / 5 (Lv 8)
   - trucchetti: dadi ×2 al Lv 5, ×3 all'11, ×4 al 17 (`scale: true`)
   - incantesimi con usi: +1 dado ogni 4 livelli oltre lo sblocco (`grow: true`)
   - guerrieri e simili: 2 attacchi al Lv 5 (`extra: true`), il Guerriero 3 all'11
   - gli usi si ricaricano a ogni sala (breve riposo).
   Tipi di azione: weapon, spell (tiro per colpire), missile (colpisce sempre),
   save (TS del bersaglio; area = tutti i nemici), heal (alleato), heal_all,
   buff (su di sé o alleato: ac, adv, dmg, resist), debuff (nemico: dis). */

export const MAX_STORY_LEVEL = 20;
export const HERO_HP_MULT = 1.35;
export const profOf = (lv) => 2 + Math.floor((Math.max(1, lv) - 1) / 4);
export const modOf = (lv) => (lv >= 8 ? 5 : lv >= 4 ? 4 : 3);
export const cantripMult = (lv) => 1 + (lv >= 5) + (lv >= 11) + (lv >= 17);

const W = (id, name, icon, dice, dmg, extra = {}) => ({ id, name, icon, kind: "weapon", dice, dmg, unlock: 1, ...extra });

export const KITS = {
  fighter: { hitDie: 10, ac: 17, stat: "str", dexInit: false, extraAttacks: true, actions: [
    W("spada", "Spada Lunga", "⚔", "1d8", "slashing"),
    { id: "poderoso", name: "Attacco Poderoso", icon: "💥", kind: "weapon", dice: "1d8", dmg: "slashing", bonusDmg: "lv/2", unlock: 1, uses: 2, info: "+metà livello ai danni" },
    { id: "respiro", name: "Secondo Respiro", icon: "❤", kind: "heal", dice: "1d10", plusLevel: true, self: true, unlock: 2, uses: 1 },
    { id: "parata", name: "Muro di Scudi", icon: "🛡", kind: "buff", buff: "ac", value: 3, turns: 2, self: true, unlock: 3, uses: 1 },
  ]},
  barbarian: { hitDie: 12, ac: 15, stat: "str", extraAttacks: true, actions: [
    W("ascia", "Ascia Bipenne", "🪓", "1d12", "slashing"),
    { id: "furia", name: "Furia", icon: "💢", kind: "buff", buff: "rage", value: 2, turns: 3, self: true, unlock: 1, uses: 1, info: "+2 danni, dimezza i danni fisici" },
    { id: "irruento", name: "Attacco Irruento", icon: "😤", kind: "weapon", dice: "1d12", dmg: "slashing", adv: true, selfDis: true, unlock: 2, uses: 3, info: "vantaggio, ma −2 CA fino al prossimo turno" },
  ]},
  paladin: { hitDie: 10, ac: 18, stat: "str", extraAttacks: true, actions: [
    W("spada", "Spada Lunga", "⚔", "1d8", "slashing"),
    { id: "punizione", name: "Punizione Divina", icon: "⚡", kind: "weapon", dice: "1d8", dmg: "slashing", rider: "2d8", riderDmg: "radiant", unlock: 2, uses: 2, grow: true },
    { id: "mani", name: "Imposizione delle Mani", icon: "🙌", kind: "heal", flat: "lv*5", unlock: 1, uses: 1 },
    { id: "aura", name: "Aura di Protezione", icon: "🌟", kind: "buff", buff: "ac", value: 2, turns: 3, allParty: true, unlock: 6, uses: 1 },
  ]},
  ranger: { hitDie: 10, ac: 15, stat: "dex", extraAttacks: true, actions: [
    W("arco", "Arco Lungo", "🏹", "1d8", "piercing"),
    { id: "marchio", name: "Marchio del Cacciatore", icon: "🎯", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, unlock: 1, uses: 2 },
    { id: "pioggia", name: "Pioggia di Frecce", icon: "🌧", kind: "save", dice: "2d8", dmg: "piercing", save: "dex", area: true, half: true, unlock: 3, uses: 1, grow: true },
    { id: "cura_r", name: "Cura Ferite", icon: "💚", kind: "heal", dice: "1d8", plusMod: true, unlock: 2, uses: 1 },
  ]},
  monk: { hitDie: 8, ac: 16, stat: "dex", extraAttacks: true, actions: [
    { id: "raffica", name: "Raffica di Colpi", icon: "👊", kind: "weapon", dice: "1d6", dmg: "bludgeoning", attacks: 2, unlock: 1 },
    { id: "stordente", name: "Pugno Stordente", icon: "💫", kind: "save", dice: "1d6", dmg: "bludgeoning", save: "con", stun: 1, unlock: 2, uses: 2 },
    { id: "schivata", name: "Schivata Paziente", icon: "🌀", kind: "buff", buff: "ac", value: 4, turns: 1, self: true, unlock: 1, uses: 2 },
  ]},
  rogue: { hitDie: 8, ac: 15, stat: "dex", actions: [
    W("stocco", "Stocco", "🗡", "1d8", "piercing"),
    { id: "furtivo", name: "Attacco Furtivo", icon: "🌒", kind: "weapon", dice: "1d8", dmg: "piercing", rider: "sneak", riderDmg: "piercing", unlock: 1, uses: 3, info: "+metà livello in d6" },
    { id: "nascondersi", name: "Nascondersi", icon: "🫥", kind: "buff", buff: "adv", turns: 2, self: true, unlock: 2, uses: 2 },
  ]},
  wizard: { hitDie: 6, ac: 12, stat: "int", actions: [
    { id: "dardo_fuoco", name: "Dardo di Fuoco", icon: "🔥", kind: "spell", dice: "1d10", dmg: "fire", scale: true, unlock: 1 },
    { id: "raggio_gelo", name: "Raggio di Gelo", icon: "❄", kind: "spell", dice: "1d8", dmg: "cold", scale: true, unlock: 1 },
    { id: "dardo_inc", name: "Dardo Incantato", icon: "✨", kind: "missile", dice: "3d4", flat: 3, dmg: "force", unlock: 1, uses: 3, grow: true },
    { id: "scudo", name: "Scudo", icon: "🛡", kind: "buff", buff: "ac", value: 5, turns: 1, self: true, unlock: 1, uses: 2 },
    { id: "palla_fuoco", name: "Palla di Fuoco", icon: "☄", kind: "save", dice: "8d6", dmg: "fire", save: "dex", area: true, half: true, unlock: 5, uses: 1, grow: true },
  ]},
  sorcerer: { hitDie: 6, ac: 12, stat: "cha", actions: [
    { id: "fiotto", name: "Fiotto di Fuoco", icon: "🔥", kind: "spell", dice: "1d10", dmg: "fire", scale: true, unlock: 1 },
    { id: "mani_br", name: "Mani Brucianti", icon: "🖐", kind: "save", dice: "3d6", dmg: "fire", save: "dex", area: true, half: true, unlock: 1, uses: 2, grow: true },
    { id: "veleno", name: "Spruzzo Velenoso", icon: "☠", kind: "save", dice: "1d12", dmg: "poison", save: "con", scale: true, unlock: 1 },
    { id: "fulmine", name: "Fulmine", icon: "⚡", kind: "save", dice: "8d6", dmg: "lightning", save: "dex", area: true, half: true, unlock: 5, uses: 1, grow: true },
  ]},
  warlock: { hitDie: 8, ac: 13, stat: "cha", actions: [
    { id: "deflagrazione", name: "Deflagrazione Occulta", icon: "👁", kind: "spell", dice: "1d10", dmg: "force", scale: true, unlock: 1 },
    { id: "maleficio", name: "Maleficio", icon: "🩸", kind: "buff", buff: "dmg", value: 3, turns: 3, self: true, unlock: 1, uses: 2 },
    { id: "hadar", name: "Braccia di Hadar", icon: "🐙", kind: "save", dice: "2d6", dmg: "necrotic", save: "str", area: true, half: true, unlock: 2, uses: 2, grow: true },
  ]},
  druid: { hitDie: 8, ac: 14, stat: "wis", actions: [
    { id: "rovi", name: "Frusta di Rovi", icon: "🌿", kind: "spell", dice: "1d6", dmg: "piercing", scale: true, unlock: 1 },
    { id: "cura_d", name: "Cura Ferite", icon: "💚", kind: "heal", dice: "1d8", plusMod: true, unlock: 1, uses: 3, grow: true },
    { id: "onda", name: "Onda Tonante", icon: "🌊", kind: "save", dice: "2d8", dmg: "thunder", save: "con", area: true, half: true, unlock: 1, uses: 2, grow: true },
    { id: "pelle", name: "Pelle di Corteccia", icon: "🌳", kind: "buff", buff: "ac", value: 3, turns: 3, unlock: 2, uses: 1 },
  ]},
  cleric: { hitDie: 8, ac: 18, stat: "wis", actions: [
    W("mazza", "Mazza", "🔨", "1d6", "bludgeoning"),
    { id: "fiamma", name: "Fiamma Sacra", icon: "🕯", kind: "save", dice: "1d8", dmg: "radiant", save: "dex", scale: true, unlock: 1 },
    { id: "cura_c", name: "Cura Ferite", icon: "💚", kind: "heal", dice: "1d8", plusMod: true, unlock: 1, uses: 3, grow: true },
    { id: "parola", name: "Parola Guaritrice di Massa", icon: "🙏", kind: "heal_all", dice: "1d4", plusMod: true, unlock: 3, uses: 2, grow: true },
    { id: "guardiani", name: "Guardiani Spirituali", icon: "👼", kind: "save", dice: "3d8", dmg: "radiant", save: "wis", area: true, half: true, unlock: 5, uses: 1, grow: true },
  ]},
  bard: { hitDie: 8, ac: 14, stat: "cha", actions: [
    W("stocco_b", "Stocco", "🗡", "1d8", "piercing"),
    { id: "beffa", name: "Beffa Crudele", icon: "🎭", kind: "save", dice: "1d4", dmg: "psychic", save: "wis", scale: true, dis: 1, unlock: 1, info: "e svantaggio al bersaglio" },
    { id: "parola_b", name: "Parola Guaritrice", icon: "🎵", kind: "heal", dice: "1d4", plusMod: true, unlock: 1, uses: 3, grow: true },
    { id: "ispirazione", name: "Ispirazione Bardica", icon: "🎶", kind: "buff", buff: "adv", turns: 2, unlock: 1, uses: 2 },
  ]},
};

// Sempre disponibile: Difendersi (+4 CA fino al proprio turno). È anche l'azione automatica di chi sparisce.
export const DEFEND = { id: "difesa", name: "Difendersi", icon: "🛡", kind: "defend", info: "+4 CA fino al tuo prossimo turno" };

export const kitOf = (cls) => KITS[cls] || KITS.fighter;
export const heroActions = (cls, lv) => [...kitOf(cls).actions.filter((a) => (a.unlock || 1) <= lv), DEFEND];
export function heroMaxHp(cls, lv) {
  const d = kitOf(cls).hitDie;
  // ×HERO_HP_MULT: gli eroi delle Segrete sono più robusti di una scheda D&D (simulato 2026-11-04)
  return Math.round((d + 2 + (Math.floor(d / 2) + 1 + 2) * (Math.max(1, lv) - 1)) * HERO_HP_MULT);
}
export const heroDc = (lv) => 8 + profOf(lv) + modOf(lv);
export const heroHit = (lv) => profOf(lv) + modOf(lv);
export function attacksOf(cls, lv, action) {
  if (action.attacks) return action.attacks + (lv >= 5 && kitOf(cls).extraAttacks ? 1 : 0);
  if (action.kind !== "weapon") return 1;
  if (!kitOf(cls).extraAttacks) return 1;
  return 1 + (lv >= 5) + (cls === "fighter" && lv >= 11);
}
