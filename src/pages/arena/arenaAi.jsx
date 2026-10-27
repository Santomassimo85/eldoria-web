// Avversari IA delle Sfide Libere.
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.

// ── AI OPPONENT (hard mode) ───────────────────────────────────────────────────
// Players can spawn a 1v1 Sfida Libera against an AI bot when no human is
// available. The AI rolls initiative and attacks the player each turn using a
// fixed archetype. Combat logic lives in aiRollInitiative / aiPerformAttack
// inside the Arena component (driven by a useEffect on the match owner's
// client). The AI uses only basic weapon attacks — no spells, items, buffs.
export const AI_BOT_PREFIX = "AI_BOT_";

export const AI_HARD_PRESETS = [
  {
    archetype: "fighter-plate",
    name: "🤖 Veterano d'Acciaio",
    class: "Fighter",
    // STR/CON focus, low DEX. Stessi limiti del giocatore: 10 punti, max +3.
    stats: { str: 3, dex: 1, con: 3, int: 1, wis: 2, cha: 0 },
    armor: { name: "Piastre Intere", baseAc: 17, maxDex: 0, hitPenalty: -2, icon: "🛡", info: "Pesante · senza DES" },
    hasShield: null,
    weapons: [{ name: "Spadone", hitBonus: 3, damage: "2d6", statKey: "str", type: "weapon", icon: "⚔", twoHanded: true }],
    hp: 72,
    items: { pozione_cura: 2 },
  },
  {
    archetype: "barbarian-axe",
    name: "🤖 Vargash il Sanguinario",
    class: "Barbarian",
    stats: { str: 3, dex: 2, con: 3, int: 1, wis: 1, cha: 0 },
    armor: { name: "Senza Armatura", baseAc: 10, maxDex: 99, hitPenalty: 0, icon: "💪", info: "Senza armatura · 10+DES+COS", unarmoredDefense: true },
    hasShield: null,
    weapons: [{ name: "Ascia Bipenne", hitBonus: 3, damage: "1d12", statKey: "str", type: "weapon", icon: "🪓", twoHanded: true }],
    hp: 78,
    items: { pozione_cura: 1, bomba: 1 },
  },
  {
    archetype: "ranger-longbow",
    name: "🤖 Liriel Occhio d'Aquila",
    class: "Ranger",
    stats: { str: 1, dex: 3, con: 2, int: 1, wis: 3, cha: 0 },
    armor: { name: "Cuoio Borchiato", baseAc: 14, maxDex: 2, hitPenalty: 0, icon: "⚙", info: "Borchiata · +DES max 2" },
    hasShield: null,
    weapons: [{ name: "Arco Lungo", hitBonus: 3, damage: "1d8", statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true }],
    hp: 60,
    items: { pozione_cura: 2 },
  },
  {
    archetype: "rogue-twin",
    name: "🤖 Vyra la Cuspide",
    class: "Rogue",
    stats: { str: 1, dex: 3, con: 2, int: 2, wis: 0, cha: 2 },
    armor: { name: "Armatura di cuoio borchiato", baseAc: 12, maxDex: 99, hitPenalty: 0, icon: "👘", info: "Leggera · +DES pieno" },
    hasShield: null,
    // Rogue gets 3 attacks/turn — gets to swing both blades + one more.
    weapons: [
      { name: "Spada Corta", hitBonus: 3, damage: "1d6", statKey: "dex", type: "weapon", icon: "⚔", twoHanded: false },
      { name: "Stocco",      hitBonus: 3, damage: "1d8", statKey: "dex", type: "weapon", icon: "🗡", twoHanded: false },
    ],
    hp: 56,
    items: { pozione_cura: 1, pozione_veleno: 1 },
  },
  {
    archetype: "paladin-sword-shield",
    name: "🤖 Sir Caedric il Giudice",
    class: "Paladin",
    stats: { str: 3, dex: 1, con: 2, int: 0, wis: 1, cha: 3 },
    armor: { name: "Armatura a Placche", baseAc: 16, maxDex: 0, hitPenalty: -1, icon: "🛡", info: "Pesante" },
    hasShield: "metallo", // +2 AC
    weapons: [{ name: "Spada Lunga", hitBonus: 3, damage: "1d10", statKey: "str", type: "weapon", icon: "⚔", twoHanded: false }],
    hp: 68,
    items: { pozione_cura: 2 },
  },
  {
    // Pure arcane caster — opens with a control or save-buff, then leans on
    // damage spells (TS-based). Carries a dagger as a fallback when slots
    // run dry. CD-mod uses INT (=4).
    archetype: "wizard-fire",
    name: "🤖 Arconte Pyrios",
    class: "Wizard",
    stats: { str: 0, dex: 2, con: 2, int: 3, wis: 2, cha: 1 },
    armor: { name: "Senza Armatura", baseAc: 10, maxDex: 99, hitPenalty: 0, icon: "🪶", info: "Senza armatura · 10+DES" },
    hasShield: null,
    weapons: [{ name: "Pugnale", hitBonus: 3, damage: "1d4", statKey: "dex", type: "weapon", icon: "🗡", twoHanded: false }],
    spells: [
      // Trucchetti — usabili a oltranza (4 cariche)
      { name: "Dardo di Fuoco", level: 0, hitBonus: 3, damage: "1d10", statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco", maxUses: 4 },
      { name: "Tocco Gelido",   level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Necrotico", maxUses: 4 },
      // Lv1 — controllo + danno
      { name: "Sonno",          level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "😴", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 4 },
      { name: "Mani Brucianti", level: 1, hitBonus: 3, damage: "3d6",  statKey: null, type: "spell", icon: "🔥", info: "Lv1 · Fuoco", maxUses: 4 },
      { name: "Scudo",          level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 2 },
      // Lv2 — danno grosso
      { name: "Raggio Rovente", level: 2, hitBonus: 3, damage: "6d6",  statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco (3 raggi × 2d6)", maxUses: 2 },
    ],
    hp: 52,
    items: { pozione_cura: 2 },
  },
];

export function makeAiSnapshotAndPlayer(matchSeed) {
  const preset = AI_HARD_PRESETS[Math.floor(Math.random() * AI_HARD_PRESETS.length)];
  const aiUid  = `${AI_BOT_PREFIX}${matchSeed}`;
  const dexMod = preset.stats.dex;
  const conMod = preset.stats.con;
  const shieldAcBonus = preset.hasShield ? 2 : 0;
  const finalAc = preset.armor.unarmoredDefense
    ? 10 + dexMod + conMod + shieldAcBonus
    : preset.armor.baseAc + Math.min(Math.max(dexMod, 0), preset.armor.maxDex) + shieldAcBonus;

  // Item keys (for snapshot.selectedItemKeys) and itemUsesLeft map.
  const itemEntries = Object.entries(preset.items || {}).filter(([, n]) => n > 0);
  const selectedItemKeys = itemEntries.flatMap(([k, n]) => Array(n).fill(k));
  const itemUsesLeft = Object.fromEntries(itemEntries);
  const isPaladin = preset.class.toLowerCase().includes("paladin");

  const snapshot = {
    name:            preset.name,
    image:           null,
    class:           preset.class,
    stats:           { ...preset.stats, maxHp: preset.hp, ac: finalAc },
    selectedActions: [
      ...preset.weapons.map(w => ({ ...w })),
      ...((preset.spells || []).map(s => ({ ...s }))),
    ],
    hasWildShape:    false,
    hasShield:       preset.hasShield,
    selectedArmor:   { ...preset.armor },
    selectedItemKeys,
    arenaBuffs:      {},
    titles:          [],
    selectedPet:     null,
    selectedDemon:   null,
    selectedConstruct: null,
    isAi:            true,
    aiArchetype:    preset.archetype,
  };
  const playerObj = {
    id:    aiUid,
    name:  preset.name,
    class: preset.class.toLowerCase(),
    hp:    preset.hp,
    maxHp: preset.hp,
    init:  0,
    itemUsesLeft,
    // Paladins start with Lay of Hands pool = maxHp / 3, capped at 30.
    layOfHandsPool: isPaladin ? Math.min(30, Math.floor(preset.hp / 3)) : 0,
    equippedWeaponNames: preset.weapons.map(w => w.name),
    // AI-specific tracking
    aiAttacksMade: 0,
    aiSecondWindUsed: false,
    aiSurgeUsed: false,
    isAi: true,
  };
  return { aiUid, snapshot, playerObj, archetype: preset.archetype };
}
