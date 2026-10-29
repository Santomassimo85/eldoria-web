// src/data/enemyFoundry.js
// Forgia dei Nemici → Foundry (dnd5e 5.3.3, regole 2014).
// Trasforma la scheda del nemico (quella che scrive l'AI e che il Master può
// ritoccare) in un ATTORE "npc" completo: caratteristiche, CA, PF, movimento,
// sensi, resistenze, armi VERE (tipo weapon, base SRD, attività d'attacco),
// armatura indossata, capacità con le loro attività (TS, danni, ricarica,
// azioni leggendarie) e incantesimi. Gli incantesimi partono come copia
// semplice con `flags.world.srdSpell`: la macro "Fetch admin" li sostituisce
// con quelli del compendio dnd5e.spells (attività, scaling, componenti veri).
// Il risultato va in `foundry_inbox` come `kind: "actor"` (status
// "pending_actor": le macro vecchie non lo toccano).

export const CREATURE_TYPES = [
  { key: "humanoid", label: "Umanoide", icon: "🧑" },
  { key: "beast", label: "Bestia", icon: "🐺" },
  { key: "undead", label: "Non morto", icon: "💀" },
  { key: "fiend", label: "Immondo", icon: "😈" },
  { key: "dragon", label: "Drago", icon: "🐉" },
  { key: "aberration", label: "Aberrazione", icon: "🦑" },
  { key: "monstrosity", label: "Mostruosità", icon: "🦂" },
  { key: "construct", label: "Costrutto", icon: "🗿" },
  { key: "elemental", label: "Elementale", icon: "🔥" },
  { key: "fey", label: "Folletto", icon: "🧚" },
  { key: "giant", label: "Gigante", icon: "🗻" },
  { key: "celestial", label: "Celestiale", icon: "👼" },
  { key: "ooze", label: "Melma", icon: "🟢" },
  { key: "plant", label: "Vegetale", icon: "🌿" },
];
export const typeLabel = (k) => CREATURE_TYPES.find((t) => t.key === k)?.label || k || "—";

export const SIZES = { tiny: "Minuscola", sm: "Piccola", med: "Media", lg: "Grande", huge: "Enorme", grg: "Mastodontica" };
const TOKEN_SIZE = { tiny: 0.5, sm: 1, med: 1, lg: 2, huge: 3, grg: 4 };

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
export const ABILITY_IT = { str: "FOR", dex: "DES", con: "COS", int: "INT", wis: "SAG", cha: "CAR" };
export const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
export const DAMAGE_IT = {
  acid: "acido", bludgeoning: "contundente", cold: "freddo", fire: "fuoco", force: "forza", lightning: "fulmine",
  necrotic: "necrotico", piercing: "perforante", poison: "veleno", psychic: "psichico", radiant: "radioso",
  slashing: "tagliente", thunder: "tuono", healing: "cura",
};
export const CONDITIONS = ["blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"];
export const SKILLS = {
  acr: "Acrobazia", ani: "Addestrare animali", arc: "Arcano", ath: "Atletica", dec: "Inganno", his: "Storia",
  ins: "Intuizione", itm: "Intimidire", inv: "Indagare", med: "Medicina", nat: "Natura", prc: "Percezione",
  prf: "Intrattenere", per: "Persuasione", rel: "Religione", slt: "Rapidità di mano", ste: "Furtività", sur: "Sopravvivenza",
};
const SKILL_ABILITY = { acr: "dex", ani: "wis", arc: "int", ath: "str", dec: "cha", his: "int", ins: "wis", itm: "cha", inv: "int", med: "wis", nat: "int", prc: "wis", prf: "cha", per: "cha", rel: "int", slt: "dex", ste: "dex", sur: "wis" };

// Armi SRD 2014: dado, tipo, proprietà, gittata, peso, prezzo, icona del core.
// Niente "amm"/"lod": un PNG senza frecce nell'inventario non potrebbe tirare.
export const SRD_WEAPONS = {
  club: ["Randello", "simpleM", "1d4", "bludgeoning", ["lgt"], null, 2, 0.1, "icons/weapons/clubs/club-simple-barbed.webp"],
  dagger: ["Pugnale", "simpleM", "1d4", "piercing", ["fin", "lgt", "thr"], [20, 60], 1, 2, "icons/weapons/daggers/dagger-straight-blue.webp"],
  greatclub: ["Clava pesante", "simpleM", "1d8", "bludgeoning", ["two"], null, 10, 0.2, "icons/weapons/clubs/club-heavy-barbed-grey.webp"],
  handaxe: ["Ascia", "simpleM", "1d6", "slashing", ["lgt", "thr"], [20, 60], 2, 5, "icons/weapons/axes/axe-broad-black.webp"],
  javelin: ["Giavellotto", "simpleM", "1d6", "piercing", ["thr"], [30, 120], 2, 0.5, "icons/weapons/polearms/javelin-flared.webp"],
  lighthammer: ["Martello leggero", "simpleM", "1d4", "bludgeoning", ["lgt", "thr"], [20, 60], 2, 2, "icons/weapons/hammers/shorthammer-double-stone-engraved.webp"],
  mace: ["Mazza", "simpleM", "1d6", "bludgeoning", [], null, 4, 5, "icons/weapons/maces/mace-flanged-steel.webp"],
  quarterstaff: ["Bastone ferrato", "simpleM", "1d6", "bludgeoning", ["ver"], null, 4, 0.2, "icons/weapons/staves/staff-simple-spiral-grey.webp", "1d8"],
  sickle: ["Falcetto", "simpleM", "1d4", "slashing", ["lgt"], null, 2, 1, "icons/tools/hand/sickle-curved-steel-grey.webp"],
  spear: ["Lancia", "simpleM", "1d6", "piercing", ["thr", "ver"], [20, 60], 3, 1, "icons/weapons/polearms/spear-flared-green.webp", "1d8"],
  lightcrossbow: ["Balestra leggera", "simpleR", "1d8", "piercing", ["two"], [80, 320], 5, 25, "icons/weapons/crossbows/crossbow-simple-brown.webp"],
  dart: ["Dardo", "simpleR", "1d4", "piercing", ["fin", "thr"], [20, 60], 0.25, 0.05, "icons/weapons/thrown/dart-feathered.webp"],
  shortbow: ["Arco corto", "simpleR", "1d6", "piercing", ["two"], [80, 320], 2, 25, "icons/weapons/bows/shortbow-leather.webp"],
  sling: ["Fionda", "simpleR", "1d4", "bludgeoning", [], [30, 120], 0, 0.1, "icons/weapons/slings/slingshot-wood.webp"],
  battleaxe: ["Ascia da battaglia", "martialM", "1d8", "slashing", ["ver"], null, 4, 10, "icons/weapons/axes/axe-battle-black.webp", "1d10"],
  flail: ["Mazzafrusto", "martialM", "1d8", "bludgeoning", [], null, 2, 10, "icons/weapons/maces/flail-ball-grey.webp"],
  glaive: ["Falcione", "martialM", "1d10", "slashing", ["hvy", "rch", "two"], null, 6, 20, "icons/weapons/polearms/glaive-hooked-steel.webp"],
  greataxe: ["Ascia bipenne", "martialM", "1d12", "slashing", ["hvy", "two"], null, 7, 30, "icons/weapons/axes/axe-double-black.webp"],
  greatsword: ["Spadone", "martialM", "2d6", "slashing", ["hvy", "two"], null, 6, 50, "icons/weapons/swords/greatsword-crossguard-steel.webp"],
  halberd: ["Alabarda", "martialM", "1d10", "slashing", ["hvy", "rch", "two"], null, 6, 20, "icons/weapons/polearms/halberd-engraved-black.webp"],
  lance: ["Lancia da cavaliere", "martialM", "1d12", "piercing", ["rch", "spc"], null, 6, 10, "icons/weapons/polearms/spear-simple-engraved.webp"],
  longsword: ["Spada lunga", "martialM", "1d8", "slashing", ["ver"], null, 3, 15, "icons/weapons/swords/greatsword-guard.webp", "1d10"],
  maul: ["Maglio", "martialM", "2d6", "bludgeoning", ["hvy", "two"], null, 10, 10, "icons/weapons/hammers/hammer-double-stone-worn.webp"],
  morningstar: ["Morning star", "martialM", "1d8", "piercing", [], null, 4, 15, "icons/weapons/maces/mace-spiked-steel-grey.webp"],
  pike: ["Picca", "martialM", "1d10", "piercing", ["hvy", "rch", "two"], null, 18, 5, "icons/weapons/polearms/pike-flared-brown.webp"],
  rapier: ["Stocco", "martialM", "1d8", "piercing", ["fin"], null, 2, 25, "icons/weapons/swords/sword-guard-bronze.webp"],
  scimitar: ["Scimitarra", "martialM", "1d6", "slashing", ["fin", "lgt"], null, 3, 25, "icons/weapons/swords/sword-guard-serrated.webp"],
  shortsword: ["Spada corta", "martialM", "1d6", "piercing", ["fin", "lgt"], null, 2, 10, "icons/weapons/swords/shortsword-guard-brass.webp"],
  trident: ["Tridente", "martialM", "1d6", "piercing", ["thr", "ver"], [20, 60], 4, 5, "icons/weapons/polearms/trident-silver-blue.webp", "1d8"],
  warpick: ["Piccone da guerra", "martialM", "1d8", "piercing", [], null, 2, 5, "icons/weapons/axes/pickaxe-iron-green.webp"],
  warhammer: ["Martello da guerra", "martialM", "1d8", "bludgeoning", ["ver"], null, 2, 15, "icons/weapons/hammers/hammer-drilling-spiked.webp", "1d10"],
  whip: ["Frusta", "martialM", "1d4", "slashing", ["fin", "rch"], null, 3, 2, "icons/sundries/survival/leather-strap-brown.webp"],
  handcrossbow: ["Balestra a mano", "martialR", "1d6", "piercing", ["lgt"], [30, 120], 3, 75, "icons/weapons/crossbows/handcrossbow-black.webp"],
  heavycrossbow: ["Balestra pesante", "martialR", "1d10", "piercing", ["hvy", "two"], [100, 400], 18, 50, "icons/weapons/crossbows/crossbow-loaded-black.webp"],
  longbow: ["Arco lungo", "martialR", "1d8", "piercing", ["hvy", "two"], [150, 600], 2, 50, "icons/weapons/bows/longbow-recurve-leather-brown.webp"],
};

// Armature SRD 2014: CA base, categoria, peso, prezzo, icona.
export const SRD_ARMOR = {
  padded: ["Imbottita", 11, "light", 8, 5, "icons/equipment/chest/breastplate-quilted-brown.webp"],
  leather: ["Cuoio", 11, "light", 10, 10, "icons/equipment/chest/breastplate-scale-leather.webp"],
  studded: ["Cuoio borchiato", 12, "light", 13, 45, "icons/equipment/chest/breastplate-rivited-red.webp"],
  hide: ["Pelle", 12, "medium", 12, 10, "icons/equipment/chest/breastplate-layered-leather-brown.webp"],
  chainshirt: ["Giaco di maglia", 13, "medium", 20, 50, "icons/equipment/chest/breastplate-metal-scaled-grey.webp"],
  scalemail: ["Corazza a scaglie", 14, "medium", 45, 50, "icons/equipment/chest/breastplate-banded-steel.webp"],
  breastplate: ["Corazza di piastre", 14, "medium", 20, 400, "icons/equipment/chest/breastplate-collared-steel-grey.webp"],
  halfplate: ["Mezza armatura", 15, "medium", 40, 750, "icons/equipment/chest/breastplate-layered-steel.webp"],
  ringmail: ["Corazza ad anelli", 14, "heavy", 40, 30, "icons/equipment/chest/breastplate-banded-steel-grey.webp"],
  chainmail: ["Cotta di maglia", 16, "heavy", 55, 75, "icons/equipment/chest/breastplate-metal-scaled-grey.webp"],
  splint: ["Armatura a strisce", 17, "heavy", 60, 200, "icons/equipment/chest/breastplate-layered-steel.webp"],
  plate: ["Armatura completa", 18, "heavy", 65, 1500, "icons/equipment/chest/breastplate-collared-steel.webp"],
};

// Slot di un incantatore completo, per livello d'incantatore (1–20).
const FULL_CASTER_SLOTS = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const clamp = (n, lo, hi, d) => { const v = Number(n); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
export const abilityMod = (score) => Math.floor((clamp(score, 1, 30, 10) - 10) / 2);
export const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);
export const profForCr = (cr) => Math.max(2, Math.floor((Math.max(0, Number(cr) || 0) + 7) / 4));
export const fmtCr = (cr) => ({ 0.125: "1/8", 0.25: "1/4", 0.5: "1/2" }[cr] || String(cr ?? "?"));
const XP_BY_CR = { 0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000 };
export const xpForCr = (cr) => XP_BY_CR[cr] ?? 0;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const para = (s) => (s ? `<p>${esc(s).replace(/\n/g, "<br>")}</p>` : "");
const rid = () => {
  const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 16; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
};

// "2d6 + 3" → {number, denomination, bonus}; null se non è un dado pulito.
export function parseDice(f) {
  const m = /^\s*(\d+)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(String(f || ""));
  if (!m || ![4, 6, 8, 10, 12, 20, 100].includes(Number(m[2]))) return null;
  return { number: Number(m[1]), denomination: Number(m[2]), bonus: m[3] ? `${m[3] === "-" ? "-" : ""}${m[4]}` : "" };
}
const avgDice = (f) => {
  const d = parseDice(f);
  return d ? Math.floor(d.number * (d.denomination + 1) / 2) + (Number(d.bonus) || 0) : 0;
};
// Formula tirabile da Foundry: solo dadi, numeri e + -. Il resto ("metà dei danni") non si tira.
export const rollable = (f) => /^\s*\d+(\s*d\s*\d+)?(\s*[+-]\s*\d+(\s*d\s*\d+)?)*\s*$/i.test(String(f || ""));
function part(formula, type) {
  const d = parseDice(formula);
  const types = type ? [type] : [];
  const scaling = { mode: "", number: null, formula: "" };
  return d
    ? { number: d.number, denomination: d.denomination, bonus: d.bonus, types, custom: { enabled: false, formula: "" }, scaling }
    : { number: null, denomination: null, bonus: "", types, custom: { enabled: true, formula: String(formula || "0") }, scaling };
}
const emptyTemplate = { count: "", contiguous: false, type: "", size: "", width: "", height: "", units: "ft" };
function activity(type, activationType = "action", extra = {}) {
  return {
    _id: rid(), type, name: "", sort: 0,
    activation: { type: activationType, value: 1, condition: "", override: false },
    consumption: { targets: [], scaling: { allowed: false, max: "" }, spellSlot: true },
    ...extra,
  };
}
const byId = (list) => Object.fromEntries(list.map((a) => [a._id, a]));

// Uso limitato di una capacità: ricarica 5–6, N al giorno, a riposo.
function usesOf(u) {
  if (!u || !u.per) return { max: "", recovery: [], spent: 0 };
  if (u.per === "recharge") return { max: "1", spent: 0, recovery: [{ period: "recharge", type: "recoverAll", formula: String(clamp(u.recharge, 2, 6, 5)) }] };
  const max = String(clamp(u.max, 1, 10, 1));
  const period = u.per === "day" ? "day" : u.per === "sr" ? "sr" : "lr";
  return { max, spent: 0, recovery: [{ period, type: "recoverAll", formula: "" }] };
}
const spendUse = { targets: [{ type: "itemUses", target: "", value: "1", scaling: { mode: "", formula: "" } }], scaling: { allowed: false, max: "" }, spellSlot: true };

// Lettura "pulita" della scheda dell'AI (numeri nei limiti, chiavi note).
export function normalizeEnemy(e = {}) {
  const abilities = {};
  for (const k of ABILITIES) abilities[k] = clamp(e.abilities?.[k], 1, 30, 10);
  const cr = clamp(e.cr, 0, 30, 1);
  const hpDie = [4, 6, 8, 10, 12, 20].includes(Number(e.hitDice?.die)) ? Number(e.hitDice.die) : ({ tiny: 4, sm: 6, med: 8, lg: 10, huge: 12, grg: 20 }[e.size] || 8);
  return {
    ...e,
    name: String(e.name || "Nemico senza nome").slice(0, 80),
    creatureType: CREATURE_TYPES.some((t) => t.key === e.creatureType) ? e.creatureType : "humanoid",
    size: SIZES[e.size] ? e.size : "med",
    cr,
    abilities,
    hitDice: { count: clamp(e.hitDice?.count, 1, 40, 4), die: hpDie },
    saves: (e.saves || []).filter((k) => ABILITIES.includes(k)),
    skills: (e.skills || []).filter((s) => SKILLS[s?.key || s]).map((s) => (typeof s === "string" ? { key: s, expertise: false } : s)),
    armor: e.armor && (SRD_ARMOR[e.armor.base] || e.armor.base === "natural") ? e.armor : { base: "natural", ac: 12, shield: false },
    weapons: Array.isArray(e.weapons) ? e.weapons.filter((w) => w && w.name) : [],
    features: Array.isArray(e.features) ? e.features.filter((f) => f && f.name) : [],
    resistances: (e.resistances || []).filter((d) => DAMAGE_TYPES.includes(d)),
    immunities: (e.immunities || []).filter((d) => DAMAGE_TYPES.includes(d)),
    vulnerabilities: (e.vulnerabilities || []).filter((d) => DAMAGE_TYPES.includes(d)),
    conditionImmunities: (e.conditionImmunities || []).filter((c) => CONDITIONS.includes(c)),
    legendaryActions: clamp(e.legendaryActions, 0, 5, 0),
    legendaryResistances: clamp(e.legendaryResistances, 0, 5, 0),
  };
}

export const hpOf = (e) => {
  const n = e.hitDice.count, d = e.hitDice.die, con = abilityMod(e.abilities.con);
  return { max: Math.max(1, Math.floor(n * (d + 1) / 2) + n * con), formula: `${n}d${d}${con ? ` ${con > 0 ? "+" : "-"} ${Math.abs(n * con)}` : ""}` };
};

// CA che Foundry calcolerà: armatura indossata (+DES limitata) + scudo, o naturale.
export function acOf(e) {
  const dex = abilityMod(e.abilities.dex);
  const shield = e.armor?.shield ? 2 : 0;
  const a = SRD_ARMOR[e.armor?.base];
  if (!a) return clamp(e.armor?.ac, 5, 25, 10 + dex) + (e.armor?.base === "natural" ? 0 : shield);
  const [, base, cat] = a;
  return base + (cat === "light" ? dex : cat === "medium" ? Math.min(2, dex) : 0) + shield;
}

// Bonus al colpire e danno medio di un'arma, come li calcola dnd5e.
export function weaponStats(e, w) {
  const srd = SRD_WEAPONS[w.base];
  const props = srd ? srd[4] : [];
  const ranged = srd ? /R$/.test(srd[1]) : !!w.ranged;
  const str = abilityMod(e.abilities.str), dex = abilityMod(e.abilities.dex);
  const mod = w.ability === "dex" || w.ability === "str"
    ? abilityMod(e.abilities[w.ability])
    : ranged ? dex : props.includes("fin") ? Math.max(str, dex) : str;
  const magic = clamp(w.magicBonus, 0, 3, 0);
  const toHit = mod + profForCr(e.cr) + magic;
  const dice = srd ? srd[2] : (parseDice(w.damage) ? w.damage : "1d6");
  const dtype = srd ? srd[3] : (DAMAGE_TYPES.includes(w.damageType) ? w.damageType : "bludgeoning");
  return { toHit, dice, dtype, mod: mod + magic, ranged, avg: avgDice(dice) + mod + magic + (w.extra?.formula ? avgDice(w.extra.formula) : 0) };
}

export const featureDc = (e, ability) => 8 + profForCr(e.cr) + abilityMod(e.abilities[ABILITIES.includes(ability) ? ability : "con"]);

function buildWeapon(e, w) {
  const srd = SRD_WEAPONS[w.base];
  const st = weaponStats(e, w);
  const magic = clamp(w.magicBonus, 0, 3, 0);
  const props = srd ? [...srd[4]] : [];
  if (magic) props.push("mgc");
  const base = parseDice(st.dice);
  const reach = Number(w.reach) > 5 || props.includes("rch") ? 10 : 5;
  const rng = srd?.[5] || (st.ranged ? [clamp(w.range, 10, 600, 60), clamp(w.range, 10, 600, 60) * 4] : null);
  const extra = rollable(w.extra?.formula) && DAMAGE_TYPES.includes(w.extra.type) ? [part(w.extra.formula, w.extra.type)] : [];
  const atk = activity("attack", "action", {
    attack: {
      ability: w.ability === "dex" || w.ability === "str" ? w.ability : "",
      bonus: "", critical: { threshold: null }, flat: false,
      type: { value: st.ranged ? "ranged" : "melee", classification: "weapon" },
    },
    damage: { critical: { bonus: "" }, includeBase: true, parts: extra },
  });
  if (w.legendaryCost) atk.activation = { type: "legendary", value: clamp(w.legendaryCost, 1, 3, 1), condition: "", override: false };
  const sys = {
    description: { value: para(w.description), chat: "" },
    quantity: 1, equipped: true, proficient: 1, identified: true,
    type: { value: srd ? srd[1] : "natural", baseItem: srd ? w.base : "" },
    properties: props,
    magicalBonus: magic || null,
    weight: { value: srd ? srd[6] : 0, units: "lb" },
    price: { value: srd ? srd[7] : 0, denomination: "gp" },
    damage: { base: { ...part(`${base.number}d${base.denomination}`, st.dtype), bonus: "" } },
    range: st.ranged || rng ? { value: rng?.[0] ?? null, long: rng?.[1] ?? null, units: "ft", reach: st.ranged ? null : reach } : { value: null, long: null, units: "ft", reach },
    activities: byId([atk]),
  };
  if (srd?.[9]) sys.damage.versatile = { ...part(srd[9], st.dtype), bonus: "" };
  return {
    name: w.name, type: "weapon",
    img: srd ? srd[8] : (w.icon || "icons/creatures/claws/claw-curved-jagged-gray.webp"),
    system: sys,
    flags: { world: { forgedEnemy: true } },
  };
}

function buildArmorItems(e) {
  const out = [];
  const a = SRD_ARMOR[e.armor?.base];
  if (a) {
    out.push({
      name: e.armor.name || a[0], type: "equipment", img: a[5],
      system: {
        description: { value: "", chat: "" }, quantity: 1, equipped: true, proficient: 1, identified: true,
        type: { value: a[2], baseItem: e.armor.base }, armor: { value: a[1], dex: a[2] === "medium" ? 2 : a[2] === "heavy" ? 0 : null },
        weight: { value: a[3], units: "lb" }, price: { value: a[4], denomination: "gp" },
        strength: a[2] === "heavy" && a[1] >= 17 ? 15 : null,
      },
    });
  }
  if (a && e.armor.shield) {
    out.push({
      name: "Scudo", type: "equipment", img: "icons/equipment/shield/heater-steel-worn.webp",
      system: {
        description: { value: "", chat: "" }, quantity: 1, equipped: true, proficient: 1, identified: true,
        type: { value: "shield", baseItem: "shield" }, armor: { value: 2, dex: null },
        weight: { value: 6, units: "lb" }, price: { value: 10, denomination: "gp" },
      },
    });
  }
  return out;
}

const ACTIVATION = { action: "action", bonus: "bonus", reaction: "reaction", legendary: "legendary", passive: "" };

function buildFeature(e, f) {
  const kind = ACTIVATION[f.kind] !== undefined ? f.kind : "passive";
  const act = ACTIVATION[kind];
  const uses = usesOf(f.uses);
  const limited = !!uses.max;
  const acts = [];
  const area = f.area && ["cone", "sphere", "line", "cube", "cylinder"].includes(f.area.type)
    ? { ...emptyTemplate, type: f.area.type, size: String(clamp(f.area.size, 5, 300, 15)), width: f.area.type === "line" ? "5" : "" }
    : null;
  const target = {
    template: area || emptyTemplate,
    affects: { count: area ? "" : "1", type: area ? "" : "creature", choice: false, special: "" },
    prompt: true, override: false,
  };
  const range = { value: area ? "" : String(clamp(f.range, 5, 600, 30)), units: area ? "self" : "ft", special: "", override: false };
  const extra = (o) => ({ ...o, ...(limited ? { consumption: spendUse } : {}) });
  const dmgType = DAMAGE_TYPES.includes(f.damage?.type) ? f.damage.type : "";
  if (f.damage && !rollable(f.damage.formula)) f = { ...f, damage: null };
  if (f.heal && !rollable(f.heal)) f = { ...f, heal: "" };

  if (kind !== "passive") {
    if (f.save?.ability && ABILITIES.includes(f.save.ability)) {
      acts.push(activity("save", act, extra({
        save: { ability: [f.save.ability], dc: { calculation: ABILITIES.includes(f.dcAbility) ? f.dcAbility : "con", formula: "" } },
        damage: { onSave: f.onSave === "none" ? "none" : "half", parts: f.damage?.formula ? [part(f.damage.formula, dmgType)] : [] },
        target, range,
      })));
    } else if (f.attack && f.damage?.formula) {
      acts.push(activity("attack", act, extra({
        attack: { ability: ABILITIES.includes(f.attack.ability) ? f.attack.ability : "", bonus: "", critical: { threshold: null }, flat: false, type: { value: f.attack.ranged ? "ranged" : "melee", classification: "spell" } },
        damage: { critical: { bonus: "" }, includeBase: false, parts: [part(f.damage.formula, dmgType)] },
        target, range,
      })));
    } else if (f.heal) {
      acts.push(activity("heal", act, extra({
        healing: part(f.heal, "healing"),
        target: { ...target, affects: { count: "1", type: "creature", choice: false, special: "" } },
        range: { value: "", units: "self", special: "", override: false },
      })));
    } else if (f.damage?.formula) {
      acts.push(activity("damage", act, extra({ damage: { critical: { allow: false, bonus: "" }, parts: [part(f.damage.formula, dmgType)] }, target, range })));
    } else {
      acts.push(activity("utility", act, extra({ roll: { formula: "", name: "", prompt: false, visible: false } })));
    }
    if (kind === "legendary") acts.forEach((a) => { a.activation.value = clamp(f.legendaryCost, 1, 3, 1); });
  }
  return {
    name: f.name, type: "feat",
    img: f.icon || (kind === "passive" ? "icons/magic/symbols/runes-star-pentagon-blue.webp" : area ? "icons/magic/fire/projectile-wave-yellow.webp" : "icons/skills/melee/strike-slashes-red.webp"),
    system: {
      description: { value: para(f.description), chat: "" },
      type: { value: "monster", subtype: "" },
      uses, properties: [], requirements: "",
      activities: byId(acts),
    },
    flags: { world: { forgedEnemy: true } },
  };
}

// Incantesimo di riserva: la macro lo sostituisce con quello del compendio.
function buildSpell(e, s) {
  const lvl = clamp(s.level, 0, 9, 0);
  const atWill = s.mode === "atwill";
  const perDay = s.mode === "innate";
  return {
    name: s.name, type: "spell", img: "icons/magic/symbols/runes-star-orange.webp",
    system: {
      description: { value: para(s.note || "Incantesimo dal compendio SRD."), chat: "" },
      level: lvl, school: "evo", properties: ["vocal", "somatic"],
      method: atWill ? "atwill" : perDay ? "innate" : "spell", prepared: 1,
      uses: perDay ? { max: String(clamp(s.perDay, 1, 3, 1)), spent: 0, recovery: [{ period: "day", type: "recoverAll", formula: "" }] } : { max: "", spent: 0, recovery: [] },
      activation: { type: "action", value: 1, condition: "" },
      activities: byId([activity("utility", "action", { roll: { formula: "", name: "", prompt: false, visible: false } })]),
    },
    flags: { world: { srdSpell: s.name, spellMode: atWill ? "atwill" : perDay ? "innate" : "spell", perDay: perDay ? clamp(s.perDay, 1, 3, 1) : 0 } },
  };
}

function biographyHtml(e) {
  return [
    e.description && `<p>${esc(e.description)}</p>`,
    e.appearance && `<p><strong>Aspetto.</strong> ${esc(e.appearance)}</p>`,
    e.tactics && `<p><strong>Tattica.</strong> ${esc(e.tactics)}</p>`,
    e.loot && `<p><strong>Bottino.</strong> ${esc(e.loot)}</p>`,
    `<p><em>Forgiato nella Forgia dei Nemici di Eldoria.</em></p>`,
  ].filter(Boolean).join("");
}

// Scheda del nemico → { actor, items } per Actor.create + createEmbeddedDocuments.
export function enemyToFoundryActor(raw, { img = "" } = {}) {
  const e = normalizeEnemy(raw);
  const hp = hpOf(e);
  const abilities = Object.fromEntries(ABILITIES.map((k) => [k, { value: e.abilities[k], proficient: e.saves.includes(k) ? 1 : 0 }]));
  const skills = Object.fromEntries(e.skills.map((s) => [s.key, { value: s.expertise ? 2 : 1, ability: SKILL_ABILITY[s.key] }]));
  const mv = e.speed || {};
  const sn = e.senses || {};
  const sc = e.spellcasting && Array.isArray(e.spellcasting.spells) && e.spellcasting.spells.length ? e.spellcasting : null;
  const casterLevel = sc ? clamp(sc.level, 1, 20, 1) : 0;
  const slots = sc ? FULL_CASTER_SLOTS[casterLevel] : [];
  const spells = {};
  for (let i = 1; i <= 9; i++) spells[`spell${i}`] = { value: slots[i - 1] || 0, override: null };

  const system = {
    abilities,
    attributes: {
      ac: SRD_ARMOR[e.armor.base] ? { calc: "default", flat: null, formula: "" } : { calc: "natural", flat: acOf(e), formula: "" },
      hp: { value: hp.max, max: hp.max, temp: 0, tempmax: 0, formula: hp.formula },
      movement: {
        walk: String(clamp(mv.walk, 0, 120, 30)), fly: String(clamp(mv.fly, 0, 150, 0)), swim: String(clamp(mv.swim, 0, 120, 0)),
        climb: String(clamp(mv.climb, 0, 120, 0)), burrow: String(clamp(mv.burrow, 0, 60, 0)), units: "ft", hover: !!mv.hover,
      },
      senses: {
        units: "ft", special: "",
        ranges: { darkvision: clamp(sn.darkvision, 0, 300, 0), blindsight: clamp(sn.blindsight, 0, 300, 0), tremorsense: clamp(sn.tremorsense, 0, 300, 0), truesight: clamp(sn.truesight, 0, 300, 0) },
      },
      spellcasting: sc && ABILITIES.includes(sc.ability) ? sc.ability : "int",
      spell: { level: casterLevel },
    },
    details: {
      biography: { value: biographyHtml(e), public: "" },
      alignment: e.alignment || "",
      type: { value: e.creatureType, subtype: e.subtype || "", swarm: "", custom: "" },
      cr: e.cr,
    },
    traits: {
      size: e.size,
      di: { value: e.immunities, bypasses: [], custom: "" },
      dr: { value: e.resistances, bypasses: [], custom: "" },
      dv: { value: e.vulnerabilities, bypasses: [], custom: "" },
      ci: { value: e.conditionImmunities, custom: "" },
      languages: { value: [], custom: e.languages || "" },
    },
    skills,
    spells,
    resources: {
      legact: { max: e.legendaryActions, spent: 0 },
      legres: { max: e.legendaryResistances, spent: 0 },
    },
  };

  const items = [
    ...buildArmorItems(e),
    ...e.weapons.map((w) => buildWeapon(e, w)),
  ];
  if (e.multiattack) items.unshift(buildFeature(e, { name: "Multiattacco", kind: "action", description: e.multiattack, icon: "icons/skills/melee/blade-tips-triple-steel.webp" }));
  if (e.legendaryResistances) items.push(buildFeature(e, { name: `Resistenza leggendaria (${e.legendaryResistances}/giorno)`, kind: "passive", description: "Se fallisce un tiro salvezza, può scegliere di superarlo." }));
  items.push(...e.features.map((f) => buildFeature(e, f)));
  if (e.legendaryActions) items.push(buildFeature(e, { name: "Azioni leggendarie", kind: "passive", description: `Può compiere ${e.legendaryActions} azioni leggendarie, una alla fine del turno di un'altra creatura. Le recupera all'inizio del suo turno.` }));
  if (sc) {
    items.push(buildFeature(e, {
      name: "Incantesimi", kind: "passive", icon: "icons/sundries/books/book-embossed-jewel-silver-green.webp",
      description: `Incantatore di ${casterLevel}° livello. Caratteristica: ${ABILITY_IT[system.attributes.spellcasting]} (CD ${featureDc(e, system.attributes.spellcasting)}, ${fmtMod(profForCr(e.cr) + abilityMod(e.abilities[system.attributes.spellcasting]))} a colpire).`,
    }));
    items.push(...sc.spells.filter((s) => s && s.name).map((s) => buildSpell(e, s)));
  }

  const size = TOKEN_SIZE[e.size] || 1;
  const actor = {
    name: e.name, type: "npc", img: img || "icons/svg/mystery-man.svg",
    system,
    prototypeToken: {
      name: e.name, actorLink: false, disposition: -1, displayName: 20, displayBars: 20,
      width: Math.max(1, size), height: Math.max(1, size),
      texture: { src: img || "icons/svg/mystery-man.svg", scaleX: size < 1 ? 0.5 : 1, scaleY: size < 1 ? 0.5 : 1 },
      bar1: { attribute: "attributes.hp" },
      bar2: { attribute: e.legendaryActions ? "resources.legact" : null },
      sight: { enabled: false },
    },
    flags: { world: { forgedEnemy: true, forgedAt: new Date().toISOString() } },
  };
  return { actor, items };
}
