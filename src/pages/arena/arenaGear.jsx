// Armi, armature, forme selvatiche e CA.
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.
import { DAMAGE_TYPE_MAP } from "../../data/arenaDamageTypes";
import { applyDefenderDamageMods, applyMarketEffects, applyTypedDamage, getSnapLevel, getSubclassEffect, hasMarketFixedArmor, isMonkClass, recklessRaging, subclassDamageDice } from "./arenaRules";

// ── ARMI SEMPLICI ──────────────────────────────────────────────────────
// damageType: "contundente" | "perforante" | "tagliente" (D&D 5e)
export const SIMPLE_WEAPONS = [
  { name: "Daga",             hitBonus: 3, damage: "1d4",  statKey: "dex", type: "weapon", icon: "🗡", twoHanded: false, damageType: "perforante" },
  { name: "Randello",         hitBonus: 3, damage: "1d4",  statKey: "str", type: "weapon", icon: "🏏", twoHanded: false, damageType: "contundente" },
  { name: "Ascetta",          hitBonus: 3, damage: "1d6",  statKey: "str", type: "weapon", icon: "🪓", twoHanded: false, damageType: "tagliente" },
  { name: "Giavellotto",      hitBonus: 3, damage: "1d6",  statKey: "str", type: "weapon", icon: "🎯", twoHanded: false, damageType: "perforante" },
  { name: "Martello Leggero", hitBonus: 3, damage: "1d4",  statKey: "str", type: "weapon", icon: "🔨", twoHanded: false, damageType: "contundente" },
  { name: "Mazza",            hitBonus: 3, damage: "1d6",  statKey: "str", type: "weapon", icon: "🏏", twoHanded: false, damageType: "contundente" },
  { name: "Bastone Ferrato",  hitBonus: 3, damage: "1d8",  statKey: "str", type: "weapon", icon: "🪄", twoHanded: true,  damageType: "contundente" },
  { name: "Falcetto",         hitBonus: 3, damage: "1d4",  statKey: "dex", type: "weapon", icon: "⚔",  twoHanded: false, damageType: "tagliente" },
  { name: "Lancia",           hitBonus: 3, damage: "1d8",  statKey: "str", type: "weapon", icon: "🔱", twoHanded: false, damageType: "perforante" },
  { name: "Arco Corto",       hitBonus: 3, damage: "1d6",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true,  damageType: "perforante" },
  { name: "Balestra Leggera", hitBonus: 3, damage: "1d8",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true,  damageType: "perforante" },
  { name: "Dardo",            hitBonus: 3, damage: "1d4",  statKey: "dex", type: "weapon", icon: "🎯", twoHanded: false, damageType: "perforante" },
  { name: "Fionda",           hitBonus: 3, damage: "1d4",  statKey: "str", type: "weapon", icon: "⭕",  twoHanded: false, damageType: "contundente" },
];

// ── ARMI MARZIALI ─────────────────────────────────────────────────────
export const MARTIAL_WEAPONS = [
  { name: "Ascia da Battaglia",  hitBonus: 3, damage: "1d10", statKey: "str", type: "weapon", icon: "🪓", twoHanded: false, damageType: "tagliente" },
  { name: "Flagello",            hitBonus: 3, damage: "1d8",  statKey: "str", type: "weapon", icon: "⚔",  twoHanded: false, damageType: "contundente" },
  { name: "Alabarda",            hitBonus: 3, damage: "1d10", statKey: "str", type: "weapon", icon: "⚔",  twoHanded: true,  damageType: "tagliente" },
  { name: "Spadone",             hitBonus: 3, damage: "2d6",  statKey: "str", type: "weapon", icon: "⚔",  twoHanded: true,  damageType: "tagliente" },
  { name: "Maglio",              hitBonus: 3, damage: "2d6",  statKey: "str", type: "weapon", icon: "🔨", twoHanded: true,  damageType: "contundente" },
  { name: "Ascia Bipenne",       hitBonus: 3, damage: "1d12", statKey: "str", type: "weapon", icon: "🪓", twoHanded: true,  damageType: "tagliente" },
  { name: "Lancia da Cavaliere", hitBonus: 3, damage: "1d12", statKey: "str", type: "weapon", icon: "🏇", twoHanded: true,  damageType: "perforante" },
  { name: "Spada Lunga",         hitBonus: 3, damage: "1d10", statKey: "str", type: "weapon", icon: "⚔",  twoHanded: false, damageType: "tagliente" },
  { name: "Martello da Guerra",  hitBonus: 3, damage: "1d10", statKey: "str", type: "weapon", icon: "🔨", twoHanded: false, damageType: "contundente" },
  { name: "Morgenstern",         hitBonus: 3, damage: "1d8",  statKey: "str", type: "weapon", icon: "⚙",  twoHanded: false, damageType: "perforante" },
  { name: "Stocco",              hitBonus: 3, damage: "1d8",  statKey: "dex", type: "weapon", icon: "🗡", twoHanded: false, damageType: "perforante" },
  { name: "Scimitarra",          hitBonus: 3, damage: "1d6",  statKey: "dex", type: "weapon", icon: "⚔",  twoHanded: false, damageType: "tagliente" },
  { name: "Spada Corta",         hitBonus: 3, damage: "1d6",  statKey: "dex", type: "weapon", icon: "⚔",  twoHanded: false, damageType: "perforante" },
  { name: "Tridente",            hitBonus: 3, damage: "1d8",  statKey: "str", type: "weapon", icon: "🔱", twoHanded: false, damageType: "perforante" },
  { name: "Frusta",              hitBonus: 3, damage: "1d4",  statKey: "dex", type: "weapon", icon: "⛓",  twoHanded: false, damageType: "tagliente" },
  { name: "Arco Lungo",          hitBonus: 3, damage: "1d8",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true,  damageType: "perforante" },
  { name: "Balestra Pesante",    hitBonus: 3, damage: "1d10", statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true,  damageType: "perforante" },
  { name: "Balestra a Mano",     hitBonus: 3, damage: "1d6",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: false, damageType: "perforante" },
];

// ── Helper armi: distingue armi a distanza e armi a due mani da mischia ──────────
// Un'arma a due mani da MISCHIA impegna entrambe le mani ed è esclusiva (nient'altro
// impugnabile). Un'arma a due mani a DISTANZA (arco/balestra/fucile) può convivere con
// una sola arma a una mano.
export const WEAPON_IS_RANGED = (w) => !!w && (
  w.ranged === true || // armi della Bottega settimanale (flag esplicito)
  w.icon === "🏹" || w.icon === "🔫" ||
  ["Arco", "Balestra", "Fionda", "Giavellotto", "Dardo"].some(k => (w.name || "").includes(k))
);
export const IS_TWO_HANDED_MELEE = (w) => !!w && w.twoHanded && !WEAPON_IS_RANGED(w);

// ── MECCANICA DISTANZA (ranged vs melee) ─────────────────────────────────────────
// Il duello parte "a distanza" (m.distanceClosed=false). Contro un avversario che
// impugna un'arma a DISTANZA, chi è in mischia ha due scelte:
//   • MELEE sotto tiro (nessuna arma a distanza): può CARICARE — attacca in mischia a
//     SVANTAGGIO e chiude la distanza — oppure AVVICINARSI (chiude senza attaccare).
//   • RANGED in mischia (l'avversario non ha armi a distanza): "TIRO IN ARRETRAMENTO"
//     — il tiro fa danno E riapre la distanza, ma è a SVANTAGGIO (spari indietreggiando)
//     e consuma 1 carica di kiting. Le cariche sono limitate (ARENA_KITE_MAX per match,
//     per-giocatore in p.kiteChargesUsed): esaurite, resti in mischia e spari normale.
// Le armi a distanza e gli incantesimi colpiscono sempre normalmente. La distanza è
// uno stato del MATCH (m.distanceClosed). Vedi _runAttack e aiTakeAction.
export const ARENA_KITE_MAX = 4;
// Un giocatore "minaccia a distanza" se, tra le armi equipaggiate (o tra tutte se non
// ne ha ancora equipaggiate), ne ha almeno una a distanza.
export const PLAYER_HAS_RANGED_WEAPON = (matchPlayer, snap) => {
  const weapons = (snap?.selectedActions || []).filter(a => a.type === "weapon");
  const eq = matchPlayer?.equippedWeaponNames;
  const pool = (eq && eq.length) ? weapons.filter(w => eq.includes(w.name)) : weapons;
  return pool.some(WEAPON_IS_RANGED);
};

// ── Set armi per classe (derivati dagli array base) ───────────────────────────────
export const _sw = (n) => SIMPLE_WEAPONS.find(w => w.name === n);
export const _mw = (n) => MARTIAL_WEAPONS.find(w => w.name === n);
export const CLERIC_WEAPON_OPTIONS  = SIMPLE_WEAPONS;
export const DRUID_WEAPON_OPTIONS   = SIMPLE_WEAPONS;
export const BARD_WEAPON_OPTIONS    = [...SIMPLE_WEAPONS, _mw("Stocco")].filter(Boolean);
// Il Ladro combatte a due armi (mano1 + mano2): niente armi a due mani.
export const ROGUE_WEAPON_OPTIONS   = [...SIMPLE_WEAPONS, _mw("Stocco"), _mw("Scimitarra"), _mw("Spada Corta"), _mw("Frusta"), _mw("Balestra a Mano")].filter(Boolean).filter(w => !w.twoHanded);
export const RANGER_WEAPON_OPTIONS  = [...SIMPLE_WEAPONS, ...MARTIAL_WEAPONS];
// Monaco — combatte solo a mani nude: l'unica "arma" selezionabile è "Mani nude".
// In combattimento il 1° attacco del turno è il Pugno (2d4+DES), il 2° il Calcio (1d4+FOR).
export const MANI_NUDE_WEAPON = {
  name: "Mani nude", hitBonus: 3, damage: "2d4", statKey: "dex",
  type: "weapon", icon: "👊", twoHanded: false, damageType: "contundente",
  info: "1° attacco Pugno (2d4+DES) · 2° attacco Calcio (1d4+FOR)", unarmedMonk: true,
};
export const MONK_WEAPON_OPTIONS    = [MANI_NUDE_WEAPON];

// Risolve l'attacco a mani nude del monaco in base alle azioni già spese nel turno:
// 0 azioni → Pugno (2d4+DES, 2d6 se potenziato in Bottega) · ≥1 → Calcio (1d4+FOR).
export function resolveMonkUnarmed(action, usedSoFar, buffs) {
  if (!action?.unarmedMonk) return action;
  if ((usedSoFar ?? 0) >= 1) {
    return { ...action, name: "Calcio", icon: "🦵", damage: "1d4", statKey: "str", info: "Calcio · 1d4+FOR" };
  }
  const punchUpgraded = (buffs?.monkPunchD8 ?? 0) > 0;
  const dice = punchUpgraded ? "3d4" : "2d4";
  return { ...action, name: "Pugno", icon: "👊", damage: dice, statKey: "dex", info: `Pugno · ${dice}+DES` };
}
export const WIZARD_WEAPON_OPTIONS  = [_sw("Bastone Ferrato"), _sw("Daga")].filter(Boolean);


// ── ARMATURE — hitPenalty: malus ai tiri per colpire (più è pesante, più rallenta) ──
export const _ARMOR_LIGHT = [
  // { name: "Vesti Imbottite",            baseAc: 11, maxDex: 99, hitPenalty:  0, icon: "🧥", info: "Leggera · +DES pieno · ±0 attacco" },
  { name: "Armatura di cuoio",          baseAc: 11, maxDex: 99, hitPenalty:  0, icon: "👘", info: "Leggera · +DES pieno · ±0 attacco · 🔥 rischio Bruciatura dalle magie di fuoco" },
  { name: "Armatura di cuoio borchiato",baseAc: 12, maxDex: 99, hitPenalty:  0, icon: "👘", info: "Leggera · +DES pieno · ±0 attacco · 🔥 rischio Bruciatura dalle magie di fuoco" },
];
export const _ARMOR_MEDIUM = [
  { name: "Pelliccia Rinforzata", baseAc: 12, maxDex: 2, hitPenalty:  0, icon: "🦺", info: "Media · +DES max 2 · ±0 attacco" },
  { name: "Cuoio Indurito",       baseAc: 13, maxDex: 2, hitPenalty: -1, icon: "🦺", info: "Media · +DES max 2 · −1 attacco" },
];
export const _ARMOR_MEDIUM_STUDDED = [
  { name: "Cuoio Borchiato", baseAc: 14, maxDex: 2, hitPenalty:  0, icon: "⚙", info: "Borchiata · +DES max 2 · ±0 attacco" },
  // { name: "Maglia di Cuoio", baseAc: 1, maxDex: 2, hitPenalty: -1, icon: "⚙", info: "Borchiata · +DES max 2 · −1 attacco" },
  { name: "Mezza Piastre",   baseAc: 15, maxDex: 2, hitPenalty: -1, icon: "⚙", info: "Borchiata · +DES max 2 · −2 attacco" },
];
export const ARENA_ARMORS = {
  caster:        [{ name: "Tunica", baseAc: 12, maxDex: 99, hitPenalty: 0, icon: "👘", info: "Caster · +DES pieno · ±0 attacco · 🔥 rischio Bruciatura dalle magie di fuoco" }],
  light:         _ARMOR_LIGHT,
  medium:        _ARMOR_MEDIUM,
  mediumStudded: _ARMOR_MEDIUM_STUDDED,
  heavy: [
    { name: "Cotta ad Anelli",    baseAc: 15, maxDex: 0, hitPenalty: -1, icon: "🛡", info: "Pesante · senza DES · −1 attacco · ⚡ debole a fulmine/tuono" },
    // { name: "Cotta di Maglia",    baseAc: 20, maxDex: 0, hitPenalty: -2, icon: "🛡", info: "Pesante · senza DES · −2 attacco" },
    { name: "Armatura a Placche", baseAc: 16, maxDex: 0, hitPenalty: -1, icon: "🛡", info: "Pesante · senza DES · −1 attacco · ⚡ debole a fulmine/tuono" },
    { name: "Piastre Intere",     baseAc: 17, maxDex: 0, hitPenalty: -2, icon: "🛡", info: "Pesante · senza DES · −2 attacco · ⚡ debole a fulmine/tuono" },
  ],
  // Guerriero: addestrato alle pesanti — niente Cotta ad Anelli e
  // Armatura a Placche SENZA malus al colpire. Il paladino resta su "heavy".
  heavyFighter: [
    { name: "Armatura a Placche", baseAc: 16, maxDex: 0, hitPenalty:  0, icon: "🛡", info: "Pesante · senza DES · ±0 attacco · ⚡ debole a fulmine/tuono" },
    { name: "Piastre Intere",     baseAc: 17, maxDex: 0, hitPenalty: -2, icon: "🛡", info: "Pesante · senza DES · −2 attacco · ⚡ debole a fulmine/tuono" },
  ],
  // Druido: leggere + medie, niente metalli
  druid:      [..._ARMOR_LIGHT, ..._ARMOR_MEDIUM],
  // Chierico / Artefice: leggere + medie + borchiate
  lightMedium:[..._ARMOR_LIGHT, ..._ARMOR_MEDIUM, ..._ARMOR_MEDIUM_STUDDED],
  // Ranger: solo cuoio borchiato (leggera) + medie — niente cuoio semplice,
  // cuoio borchiato medio o mezza piastra.
  ranger: [..._ARMOR_LIGHT.slice(1), ..._ARMOR_MEDIUM],
  // Barbarian: SOLO senza armatura (10+DES+COS) — nessuna armatura equipaggiabile.
  barbarian:  [
    { name: "Senza Armatura", baseAc: 10, maxDex: 99, hitPenalty: 0, icon: "💪", info: "Senza armatura · 10+DES+COS · ⚡ +1 iniziativa", unarmoredDefense: true },
  ],
  monk: [
    { name: "Senza Armatura", baseAc: 10, maxDex: 99, hitPenalty: 0, icon: "🥋", info: "Senza armatura · 10+DES+SAG · ⚡ +1 iniziativa", unarmoredDefense: true, unarmoredStat: "wis" },
  ],
  sorcerer: [
    { name: "Senza Armatura", baseAc: 10, maxDex: 99, hitPenalty: 0, icon: "✨", info: "Senza armatura · 10+max(COS,DES) · ⚡ +1 iniziativa", unarmoredDefense: true, unarmoredMaxStat: true },
  ],
};

// ── WILD SHAPE FORMS ──────────────────────────────────────────────────────────
// HP della forma = tiro vero del dado (vedi handleWildShape), non massimo teorico.
export const WILD_SHAPES = {
  wolf: {
    name: "Lupo", icon: "🐺",
    ac: 14,
    hpDice: { count: 3, sides: 12 },
    // Zanne e artigli laceranti: ogni colpo del Lupo ha il 20% di causare
    // sanguinamento (1d4/turno per 2 turni) — riusa il sistema `onHit`.
    actions: [
      { name: "Artiglio", damage: "1d6"  , statKey: "str", type: "weapon", icon: "🐾", hitBonus: 3, onHit: [{ kind: "malus", malusType: "bleed", malusDice: "1d4", malusTurns: 2, chance: 20 }] },
      { name: "Morso",    damage: "1d6"  , statKey: "str", type: "weapon", icon: "🦷", hitBonus: 3, onHit: [{ kind: "malus", malusType: "bleed", malusDice: "1d4", malusTurns: 2, chance: 20 }] },
    ],
  },
  bear: {
    name: "Orso", icon: "🐻",
    ac: 16,
    hpDice: { count: 5, sides: 12 },
    actions: [
      { name: "Artiglio", damage: "1d6"  , statKey: "str", type: "weapon", icon: "🐾", hitBonus: 3 },
      { name: "Morso",    damage: "1d4"  , statKey: "str", type: "weapon", icon: "🦷", hitBonus: 3 },
    ],
  },
  spider: {
    name: "Ragno", icon: "🕷",
    ac: 12,
    hpDice: { count: 3, sides: 12 },
    actions: [
      { name: "Morso",     level: 0, damage: "1d4"  , statKey: "str", type: "weapon", icon: "🦷", hitBonus: 3 },
      { name: "Veleno",    level: 0, damage: "—",     statKey: null,  type: "spell",  icon: "☠",  hitBonus: 0, special: "save_dot", saveDotAbility: "con", saveDotDamage: "1d8", saveDotTurns: 3, saveDotDC: 12, maxUses: 3 },
      { name: "Ragnatela", level: 0, damage: "—",     statKey: null,  type: "spell",  icon: "🕸", hitBonus: 0, special: "web",    saveAbility: "str", saveDC: 13, maxUses: 3 },
    ],
  },
};

// Helper: AC of a player accounting for an active wild-shape form.
// When the druid is transformed, the form's AC overrides the character's base AC.
export function getEffectiveAc(matchPlayer, charSnapshot) {
  const baseAc = charSnapshot?.stats?.ac ?? 10;
  if (matchPlayer?.wildShape && WILD_SHAPES[matchPlayer.wildShape]?.ac != null) {
    return WILD_SHAPES[matchPlayer.wildShape].ac;
  }
  // Scudi: ora +1 CA (prima +2). La CA salvata nel personaggio include già +2
  // dello scudo (sia umani che IA), quindi correggiamo di -1 per chi ha scudo.
  // Armatura della Bottega a CA FISSA (niente selectedArmor): lo scudo NON è dentro
  // la CA salvata, quindi si aggiunge +1. Lo scudo dà SEMPRE CA, mai la toglie
  // (scelta dell'utente 2026-10-21: prima Soran con Pelle di gnoll 14 + scudo era 13).
  const shieldAdj = charSnapshot?.hasShield ? (hasMarketFixedArmor(charSnapshot) ? 1 : -1) : 0;
  // Monaco · Movimento Senza Armatura (Lv2): +1 CA se combatte senz'armatura.
  const cls = (charSnapshot?.class || "").toLowerCase();
  const monkAcBonus = (isMonkClass(cls) && getSnapLevel(charSnapshot) >= 2 && charSnapshot?.selectedArmor?.unarmoredDefense) ? 1 : 0;
  // Barbaro · Attacco Irruento (Lv2): −2 CA mentre è in Furia (abbassa la guardia).
  const recklessAcPenalty = recklessRaging(charSnapshot, matchPlayer) ? -2 : 0;
  return baseAc + shieldAdj + monkAcBonus + recklessAcPenalty;
}
// CA che un attacco trova DAVVERO in questo momento (stessa somma dei tiri per
// colpire) + la CA "di riposo" con cui confrontarla, per colorarla nella scheda:
// sopra = bonus attivi (verde), sotto = malus (rosso). parts = cosa la cambia.
// Attacchi speciali che usano l'ARMA equipaggiata (Smite, Attacco Furtivo):
// prima contavano solo il dado base. Qui si aggiungono i bonus di sottoclasse con
// arma, i componenti elementali dell'arma (Bottega) con le resistenze del
// bersaglio, le riduzioni di classe e gli effetti all'impatto dell'arma.
// raw = danno base già ×crit. Ritorna { damage, onHit, tag }.
export function resolveWeaponRider(raw, weaponAction, attackerSnap, attackerMP, defenderSnap, defenderMP, critMult) {
  const eff = getSubclassEffect(attackerSnap);
  const subFlat = (eff.weaponDmg || 0) * (critMult || 1);
  const subDice = subclassDamageDice(attackerSnap, false);
  const typed = applyTypedDamage(raw + subFlat, weaponAction, critMult, defenderSnap, false);
  const damage = applyDefenderDamageMods(typed.total + subDice.bonus, defenderSnap, defenderMP, false);
  const onHit = (damage > 0 && Array.isArray(weaponAction?.onHit) && weaponAction.onHit.length)
    ? applyMarketEffects(weaponAction.onHit, attackerMP, defenderMP, true, damage)
    : { selfPatch: {}, enemyPatch: {}, selfHeal: 0, enemyDmg: 0, logs: [] };
  const bits = [];
  if (subFlat) bits.push(`🎓+${subFlat}`);
  if (subDice.tag) bits.push(`🎓${subDice.tag}`);
  typed.parts.forEach(pt => bits.push(`+${pt.amount} ${DAMAGE_TYPE_MAP[pt.type]?.label || pt.type}${pt.resisted ? "🛡" : ""}`));
  if (onHit.logs.length) bits.push(`impatto: ${onHit.logs.join(" · ")}`);
  return { damage, onHit, tag: bits.length ? ` (${bits.join(" · ")})` : "" };
}

// Chip di stato: queste famiglie sono BONUS (verde), tutte le altre MALUS (rosso).
export const GOOD_STATUS_CLS = new Set(["is-shield", "is-buff", "is-rage", "is-energy", "is-wild"]);
// CA da battere per un attacco, ADESSO: un'unica somma per tutti i tiri per colpire
// (giocatore, IA, Smite, Furtivo, scroll, pet, colpi multipli). Prima ogni punto la
// ricalcolava a mano e alcuni dimenticavano Forgia/scudo inutilizzabile o tutti i buff.
export function targetAcNow(matchPlayer, snap) {
  return getDisplayAc(matchPlayer, snap).ac;
}
export function getDisplayAc(matchPlayer, snap) {
  // "riposo" = CA della classe base, senza il bonus della sottoclasse (che conta come buff)
  const subAc = snap?.subclassAc || 0;
  const base = getEffectiveAc(null, snap) - subAc;
  const parts = subAc ? [`${snap.subclassName || "sottoclasse"} +${subAc}`] : [];
  let ac = getEffectiveAc(matchPlayer, snap);
  if (matchPlayer?.wildShape && WILD_SHAPES[matchPlayer.wildShape]?.ac != null) parts.push(`forma selvatica ${ac}`);
  else if (ac < base + subAc) parts.push(`furia irruenta ${ac - base - subAc}`);
  if (snap?.hasShield && matchPlayer?.shieldSuppressed) { ac -= 1; parts.push("scudo inutilizzabile −1"); }
  const shieldSkill = (matchPlayer?.shieldSkillTurns ?? 0) > 0 ? (matchPlayer?.shieldSkillBonus ?? 3) : 0;
  if (shieldSkill) { ac += shieldSkill; parts.push(`scudo +${shieldSkill} (${matchPlayer.shieldSkillTurns}t)`); }
  const forge = (matchPlayer?.armorForgeTurns ?? 0) > 0 ? 2 : 0;
  if (forge) { ac += forge; parts.push("forgia +2"); }
  const def = matchPlayer?.defensiveBonus ?? 0;
  if (def) { ac += def; parts.push(`difesa ${def > 0 ? "+" : ""}${def}`); }
  return { ac, base, parts };
}
