// Liste degli incantesimi per classe (le legge anche il Catalogo della Bottega).
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.


// ── WIZARD SPELLS (Mago) — pool: 6 trucchetti · 8 lv1 · 5 lv2 · 3 lv3 (sceglie 3+4+2)
export const WIZARD_SPELLS = [
  // ── Trucchetti ──────────────────────────────────────────────────────────────
  { name: "Dardo di Fuoco",        level: 0, hitBonus: 3, damage: "1d10",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco", maxUses: 4 },
  { name: "Tocco Gelido",          level: 0, hitBonus: 3, damage: "1d8",   statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Necrotico", maxUses: 4 },
  { name: "Spruzzo Velenoso",      level: 0, hitBonus: 3, damage: "1d12",  statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Veleno", maxUses: 4 },
  { name: "Scossa Folgorante",     level: 0, hitBonus: 3, damage: "1d8",   statKey: null, type: "spell", icon: "⚡", info: "Trucchetto · Fulmine", maxUses: 4 },
  { name: "Raggio di Gelo",        level: 0, hitBonus: 3, damage: "1d8",   statKey: null, type: "spell", icon: "🧊", info: "Trucchetto · Freddo", maxUses: 4 },
  { name: "Lama Vorticosa",        level: 0, hitBonus: 3, damage: "1d8",   statKey: null, type: "spell", icon: "🌀", info: "Trucchetto · Tuono · mischia", maxUses: 4 },
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Dardo Incantato",       level: 1, hitBonus: 3,  damage: "3d4",   statKey: null, type: "spell", icon: "✨", info: "Lv1 · Forza · colpisce sempre (no tiro)", maxUses: 4 },
  { name: "Mani Brucianti",        level: 1, hitBonus: 3,  damage: "3d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv1 · Fuoco", maxUses: 4 },
  { name: "Scudo",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 2 },
  { name: "Sonno",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "😴", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 4 },
  { name: "Colpo Cromatico",       level: 1, hitBonus: 3,  damage: "3d8",   statKey: null, type: "spell", icon: "🌈", info: "Lv1 · Magico", maxUses: 4 },
  { name: "Onda Tonante",          level: 1, hitBonus: 3,  damage: "2d8",   statKey: null, type: "spell", icon: "💨", info: "Lv1 · Tuono", maxUses: 4 },
  { name: "Raggio Avvelenato",     level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🤢", info: "Lv1 · TS COS · 2d6 veleno a inizio turno per 2 turni", special: "save_dot", saveDotAbility: "con", saveDotDamage: "2d6", saveDotTurns: 2, maxUses: 4 },
  { name: "Assorbire Elementi",    level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🔰", info: "Lv1 · +3 ai prossimi 3 TS (difesa elementale)", special: "save_buff", tsBonus: 3, tsAttacks: 3, maxUses: 2 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Raggio Rovente",        level: 2, hitBonus: 3, damage: "6d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco (3 raggi × 2d6)", maxUses: 2 },
  { name: "Frantumare",            level: 2, hitBonus: 3, damage: "3d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Invisibilità",          level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "👻", info: "Lv2 · Il nemico non può attaccarti il prossimo turno", special: "invisibility", invisibilityDuration: 1, maxUses: 2 },
  { name: "Cecità/Sordità",        level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🙈", info: "Lv2 · Svantaggio agli attacchi del nemico per 2 turni", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 2 },
  { name: "Tocco Vampirico",       level: 2, hitBonus: 3, damage: "3d6",   statKey: null, type: "spell", icon: "🩸", info: "Lv2 · Necrotico · cura 1d8 in caso di danno", vampiric: true, vampiricHeal: "1d8", maxUses: 2 },
  // ── Livello 3 (tier 3 · sbloccato al Lv5 di classe) ───────────────────────
  { name: "Palla di Fuoco",        level: 3, hitBonus: 3, damage: "8d6",   statKey: null, type: "spell", icon: "💥", info: "Lv3 · Fuoco", reqLevel: 5, maxUses: 1 },
  { name: "Fulmine",               level: 3, hitBonus: 3, damage: "8d6",   statKey: null, type: "spell", icon: "⚡", info: "Lv3 · Fulmine", reqLevel: 5, maxUses: 1 },
  { name: "Contrincantesimo",      level: 3, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🚫", info: "Lv3 · Controllo · TS o perdi 2 turni", special: "control", reqLevel: 5, maxUses: 1 },
  // ── Livello 4 (tier 4 · sbloccato al Lv7 di classe) ───────────────────────
  { name: "Tempesta di Ghiaccio",  level: 4, hitBonus: 3, damage: "6d6",   statKey: null, type: "spell", icon: "🌨", info: "Lv4 · Freddo · TS DES", reqLevel: 7, maxUses: 1 },
  { name: "Porta Dimensionale",    level: 4, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🚪", info: "Lv4 · Ti sottrai: il nemico non può colpirti il prossimo turno", special: "invisibility", invisibilityDuration: 1, reqLevel: 7, maxUses: 1 },
  { name: "Vortice Arcano",        level: 4, hitBonus: 3, damage: "7d6",   statKey: null, type: "spell", icon: "🌀", info: "Lv4 · Forza · TS DES", reqLevel: 7, maxUses: 1 },
  // ── Tier 5 (Lv9) ─ Tier 6 (Lv11) ─ Tier 7 (Lv13) ─ Tier 8 (Lv15) ─ Tier 9 (Lv17)
  { name: "Cono di Freddo",        level: 5, hitBonus: 3, damage: "8d8",   statKey: null, type: "spell", icon: "🧊", info: "Lv5 · Freddo · TS DES", reqLevel: 9, maxUses: 1 },
  { name: "Telecinesi",            level: 5, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🤏", info: "Lv5 · Controllo · TS FOR o perdi 2 turni", special: "control", reqLevel: 9, maxUses: 1 },
  { name: "Disintegrazione",       level: 6, hitBonus: 3, damage: "10d6+40",statKey: null, type: "spell", icon: "☄", info: "Lv6 · Forza · TS DES", reqLevel: 11, maxUses: 1 },
  { name: "Globo di Invulnerabilità",level: 6, hitBonus: 0, damage: "—",   statKey: null, type: "spell", icon: "🔵", info: "Lv6 · +5 CA per 2 turni", special: "shield_buff", shieldBuffBonus: 5, shieldBuffTurns: 2, reqLevel: 11, maxUses: 1 },
  { name: "Dito della Morte",      level: 7, hitBonus: 3, damage: "7d8+30",statKey: null, type: "spell", icon: "💀", info: "Lv7 · Necrotico · TS COS", reqLevel: 13, maxUses: 1 },
  { name: "Inversione della Gravità",level: 7, hitBonus: 0, damage: "—",   statKey: null, type: "spell", icon: "🌀", info: "Lv7 · Controllo · TS DES o perdi 2 turni", special: "control", reqLevel: 13, maxUses: 1 },
  { name: "Incenerire",            level: 8, hitBonus: 3, damage: "12d6",  statKey: null, type: "spell", icon: "🔥", info: "Lv8 · Fuoco · TS DES", reqLevel: 15, maxUses: 1 },
  { name: "Parola del Potere: Stordire",level: 8, hitBonus: 0, damage: "—",statKey: null, type: "spell", icon: "😵", info: "Lv8 · Controllo · TS COS o perdi 2 turni", special: "control", reqLevel: 15, maxUses: 1 },
  { name: "Meteora",               level: 9, hitBonus: 3, damage: "20d6",  statKey: null, type: "spell", icon: "☄", info: "Lv9 · Fuoco devastante · TS DES", reqLevel: 17, maxUses: 1 },
  { name: "Parola del Potere: Morte",level: 9, hitBonus: 0, damage: "—",   statKey: null, type: "spell", icon: "☠", info: "Lv9 · Controllo · TS COS o perdi 2 turni", special: "control", reqLevel: 17, maxUses: 1 },
];

// ── SORCERER SPELLS (Stregone) — pool: 6 trucchetti · 6 lv1 · 5 lv2 (sceglie 4+4+2)
// Slot in stile D&D (solo Stregone): trucchetti ILLIMITATI (niente maxUses),
// le spell Lv1/Lv2 consumano un pool CONDIVISO di 4 slot per livello — vedi
// spendSpellUse/readSpellSlots. Il maxUses=4 sulle spell con livello serve
// solo come denominatore del badge in UI (= SORC_SLOTS_MAX).
export const SORCERER_SPELLS = [
  { name: "Dardo di Fuoco",        level: 0, hitBonus: 3,  damage: "1d10",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco · illimitato" },
  { name: "Scossa Folgorante",     level: 0, hitBonus: 3,  damage: "1d8",   statKey: null, type: "spell", icon: "⚡",  info: "Trucchetto · Fulmine · illimitato" },
  { name: "Gelidito",              level: 0, hitBonus: 3,  damage: "1d8",   statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Freddo · illimitato" },
  { name: "Spruzzo Velenoso",      level: 0, hitBonus: 3,  damage: "1d12",  statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Veleno · illimitato" },
  { name: "Tocco Gelido",          level: 0, hitBonus: 3,  damage: "1d8",   statKey: null, type: "spell", icon: "💀", info: "Trucchetto · Necrotico · illimitato" },
  { name: "Raggio di Gelo",        level: 0, hitBonus: 3,  damage: "1d8",   statKey: null, type: "spell", icon: "🧊", info: "Trucchetto · Freddo · illimitato" },
  { name: "Mani Brucianti",        level: 1, hitBonus: 3,  damage: "3d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv1 · Fuoco", maxUses: 4 },
  { name: "Dardo Incantato",       level: 1, hitBonus: 3,  damage: "3d4",   statKey: null, type: "spell", icon: "✨", info: "Lv1 · Forza · colpisce sempre (no tiro)", maxUses: 4 },
  { name: "Colpo Cromatico",       level: 1, hitBonus: 3,  damage: "3d8",   statKey: null, type: "spell", icon: "🌈", info: "Lv1 · Magico", maxUses: 4 },
  { name: "Scudo",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 4 },
  { name: "Charme su Persone",     level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🫦", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 4 },
  { name: "Sonno",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "😴", info: "Lv1 · Controllo · TS o perdi 2 turni", special: "control", maxUses: 4 },
  { name: "Raggio Rovente",        level: 2, hitBonus: 3,  damage: "6d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco (3 raggi × 2d6)", maxUses: 4 },
  { name: "Frantumare",            level: 2, hitBonus: 3,  damage: "3d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 4 },
  { name: "Suggestione",           level: 2, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🌀", info: "Lv2 · Controllo · TS o perdi 2 turni", special: "control", maxUses: 4 },
  { name: "Nube di Pugnali",       level: 2, hitBonus: 3,  damage: "4d4",   statKey: null, type: "spell", icon: "🗡", info: "Lv2 · Tagliente · colpisce sempre (no tiro)", maxUses: 4 },
  { name: "Cecità/Sordità",        level: 2, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🙈", info: "Lv2 · Svantaggio agli attacchi del nemico per 2 turni", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 4 },
  { name: "Palla di Fuoco",        level: 3, hitBonus: 3,  damage: "8d6",   statKey: null, type: "spell", icon: "💥", info: "Lv3 · Fuoco", reqLevel: 5, maxUses: 1 },
  { name: "Fulmine",               level: 3, hitBonus: 3,  damage: "8d6",   statKey: null, type: "spell", icon: "⚡", info: "Lv3 · Fulmine", reqLevel: 5, maxUses: 1 },
  { name: "Paura",                 level: 3, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "😱", info: "Lv3 · Controllo · TS o perdi 2 turni", special: "control", reqLevel: 5, maxUses: 1 },
  // ── Livello 4 (tier 4 · sbloccato al Lv7 di classe) ───────────────────────
  { name: "Tempesta di Ghiaccio",  level: 4, hitBonus: 3,  damage: "6d6",   statKey: null, type: "spell", icon: "🌨", info: "Lv4 · Freddo · TS DES", reqLevel: 7, maxUses: 1 },
  { name: "Vortice di Fuoco",      level: 4, hitBonus: 3,  damage: "7d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv4 · Fuoco · TS DES", reqLevel: 7, maxUses: 1 },
  { name: "Blocca Mostri",         level: 4, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🧊", info: "Lv4 · Controllo · TS SAG o perdi 2 turni", special: "control", reqLevel: 7, maxUses: 1 },
  // ── Tier 5 (Lv9) → Tier 9 (Lv17) ─────────────────────────────────────────
  { name: "Cono di Freddo",        level: 5, hitBonus: 3,  damage: "8d8",   statKey: null, type: "spell", icon: "🧊", info: "Lv5 · Freddo · TS DES", reqLevel: 9, maxUses: 1 },
  { name: "Nube Mortale",          level: 5, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "☠", info: "Lv5 · TS COS · 3d6 veleno a inizio turno per 3 turni", special: "save_dot", saveDotAbility: "con", saveDotDamage: "3d6", saveDotTurns: 3, reqLevel: 9, maxUses: 1 },
  { name: "Catena di Fulmini",     level: 6, hitBonus: 3,  damage: "10d8",  statKey: null, type: "spell", icon: "⚡", info: "Lv6 · Fulmine · TS DES", reqLevel: 11, maxUses: 1 },
  { name: "Disintegrazione",       level: 7, hitBonus: 3,  damage: "10d6+40",statKey: null, type: "spell", icon: "☄", info: "Lv7 · Forza · TS DES", reqLevel: 13, maxUses: 1 },
  { name: "Tempesta di Fuoco",     level: 8, hitBonus: 3,  damage: "12d6",  statKey: null, type: "spell", icon: "🔥", info: "Lv8 · Fuoco · TS DES", reqLevel: 15, maxUses: 1 },
  { name: "Desiderio Distruttivo", level: 9, hitBonus: 3,  damage: "18d6",  statKey: null, type: "spell", icon: "🌠", info: "Lv9 · Forza devastante · TS DES", reqLevel: 17, maxUses: 1 },
];

// ── WARLOCK SPELLS (Oscuro Cultore) — pool: 4 trucchetti · 5 lv1 · 4 lv2 (sceglie 2 trucchetti + 2 slot lv1/lv2 misti)
export const WARLOCK_SPELLS = [
  // ── Trucchetti ──────────────────────────────────────────────────────────────
  { name: "Deflagrazione Occulta",  level: 0, hitBonus: 3, damage: "1d10", statKey: null, type: "spell", icon: "🟣", info: "Trucchetto · Forza", maxUses: 4 },
  { name: "Rintocco Funebre",       level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "🔔", info: "Trucchetto · Necrotico · 1d8 (1d12 se nemico ferito)", damageWhenHurt: "1d12", maxUses: 4 },
  { name: "Spruzzo Velenoso",       level: 0, hitBonus: 3, damage: "1d12", statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Veleno", maxUses: 4 },
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Braccia di Hadar",       level: 1, hitBonus: 3, damage: "2d6",  statKey: null, type: "spell", icon: "🐙", info: "Lv1 · Necrotico", maxUses: 2 },
  { name: "Malocchio",              level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "👁", info: "Lv1 · Controllo · TS o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Scudo",                  level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 2 },
  { name: "Rappresaglia Infernale", level: 1, hitBonus: 3, damage: "2d10", statKey: null, type: "spell", icon: "🔥", info: "Lv1 · Fuoco · risposta ai danni", maxUses: 2 },
  { name: "Charme su Persone",      level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🫦", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 2 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Frantumare",             level: 2, hitBonus: 3, damage: "3d8",  statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Blocca Persone",         level: 2, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🧊", info: "Lv2 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Corona della Pazzia",    level: 2, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🌀", info: "Lv2 · Controllo · TS SAG o attacca sé stesso", special: "corona_pazzia", maxUses: 2 },
  { name: "Oscurità",               level: 2, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🌑", info: "Lv2 · Svantaggio ai tiri per colpire del nemico per 3 turni", special: "disadvantage_enemy", disadvantageTurns: 3, maxUses: 2 },
  // ── Livello 3 (tier 3 · sbloccato al Lv5 di classe) ───────────────────────
  { name: "Maledizione del Sangue",  level: 3, hitBonus: 3, damage: "8d6",  statKey: null, type: "spell", icon: "🩸", info: "Lv3 · Necrotico · TS DES", reqLevel: 5, maxUses: 1 },
  { name: "Paura",                   level: 3, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "😱", info: "Lv3 · Controllo · TS SAG o perdi 2 turni", special: "control", reqLevel: 5, maxUses: 1 },
  { name: "Fame dell'Abisso",        level: 3, hitBonus: 3, damage: "5d6",  statKey: null, type: "spell", icon: "🕳", info: "Lv3 · Necrotico · cura 2d6 in caso di danno", vampiric: true, vampiricHeal: "2d6", reqLevel: 5, maxUses: 1 },
  // ── Livello 4 (tier 4 · sbloccato al Lv7 di classe) ───────────────────────
  { name: "Bocca dell'Inferno",      level: 4, hitBonus: 3, damage: "8d8",  statKey: null, type: "spell", icon: "🔥", info: "Lv4 · Fuoco · TS DES", reqLevel: 7, maxUses: 1 },
  { name: "Dominare Mente",          level: 4, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🧠", info: "Lv4 · Controllo · TS SAG o perdi 2 turni", special: "control", reqLevel: 7, maxUses: 1 },
  // ── Tier 5 (Lv9) · Mystic Arcanum tier 6-9 (Lv 11/13/15/17), 1 carica ─────
  { name: "Piaga Necrotica",         level: 5, hitBonus: 3, damage: "8d8",  statKey: null, type: "spell", icon: "🕷", info: "Lv5 · Necrotico · TS COS", reqLevel: 9, maxUses: 1 },
  { name: "Cerchio della Morte",     level: 6, hitBonus: 3, damage: "8d6+30",statKey: null, type: "spell", icon: "💀", info: "Arcanum · Necrotico · TS COS", reqLevel: 11, maxUses: 1 },
  { name: "Dito della Morte",        level: 7, hitBonus: 3, damage: "7d8+30",statKey: null, type: "spell", icon: "☠", info: "Arcanum · Necrotico · TS COS", reqLevel: 13, maxUses: 1 },
  { name: "Requiem d'Ombra",         level: 8, hitBonus: 3, damage: "12d6", statKey: null, type: "spell", icon: "🌑", info: "Arcanum · Necrotico · TS COS", reqLevel: 15, maxUses: 1 },
  { name: "Presagio della Fine",     level: 9, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "⌛", info: "Arcanum · Controllo · TS SAG o perdi 2 turni", special: "control", reqLevel: 17, maxUses: 1 },
];

// ── DRUID SPELLS (Druido) — 2 trucchetti · 4 lv1 · 2 lv2
export const DRUID_SPELLS = [
  // ── Trucchetti ──────────────────────────────────────────────────────────────
  { name: "Frusta di Spine",    level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🌿", info: "Trucchetto · Perforante", maxUses: 4 },
  { name: "Produrre Fiamma",    level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco", maxUses: 4 },
  { name: "Spruzzo Velenoso",   level: 0, hitBonus: 3, damage: "1d12", statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Veleno", maxUses: 4 },
  { name: "Infestazione",       level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🐜", info: "Trucchetto · Veleno", maxUses: 4 },
  { name: "Morso di Gelo",      level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Freddo", maxUses: 4 },
  { name: "Schianto di Tuono",  level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "⚡", info: "Trucchetto · Tuono", maxUses: 4 },
  { name: "Guida",              level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "⭐", info: "Trucchetto · +1 ai prossimi 3 attacchi", special: "magic_detect", buffBonus: 1, buffAttacks: 3, maxUses: 4 },
  { name: "Resistenza",         level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🔰", info: "Trucchetto · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 4 },
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Cura Ferite",        level: 1, hitBonus: 0, damage: "1d8",   statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 2 },
  { name: "Parola Guaritrice",  level: 1, hitBonus: 0, damage: "1d4",   statKey: null, type: "spell", icon: "💙", info: "Lv1 · Cura rapida · ripristina HP", special: "heal", maxUses: 2 },
  { name: "Onda Tonante",       level: 1, hitBonus: 3, damage: "2d8",   statKey: null, type: "spell", icon: "💨", info: "Lv1 · Tuono", maxUses: 2 },
  { name: "Intralciare",        level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌱", info: "Lv1 · Controllo · TS FOR o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Luci Fatate",        level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🧚", info: "Lv1 · +2 ai prossimi 2 attacchi", special: "magic_detect", buffBonus: 2, buffAttacks: 2, maxUses: 2 },
  { name: "Coltello di Ghiaccio",level:1, hitBonus: 3, damage: "1d10",  statKey: null, type: "spell", icon: "🧊", info: "Lv1 · Freddo", maxUses: 2 },
  { name: "Charme su Persone",  level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🫦", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Assorbire Elementi", level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 ai prossimi 3 TS (difesa elementale)", special: "save_buff", tsBonus: 3, tsAttacks: 3, maxUses: 2 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Riscaldare Arma",    level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🔩", info: "Lv2 · Arroventa l'arma equipaggiata del nemico per 2 turni (può cambiare su un'altra arma)", special: "weapon_lock", weaponLockTurns: 2, maxUses: 2 },
  { name: "Frantumare",         level: 2, hitBonus: 3, damage: "3d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Blocca Persone",     level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🧲", info: "Lv2 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Raggio di Luna",     level: 2, hitBonus: 3, damage: "2d10",  statKey: null, type: "spell", icon: "🌙", info: "Lv2 · Radiante", maxUses: 2 },
  { name: "Scorza Coriacea",    level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🪵", info: "Lv2 · +3 CA per 3 turni", special: "shield_buff", maxUses: 2 },
  { name: "Lama di Fiamma",     level: 2, hitBonus: 3, damage: "3d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco", maxUses: 2 },
  // ── Livello 3 (tier 3 · sbloccato al Lv5 di classe) ───────────────────────
  { name: "Convocare Fulmine",  level: 3, hitBonus: 3, damage: "8d6",   statKey: null, type: "spell", icon: "⚡", info: "Lv3 · Fulmine · TS DES", reqLevel: 5, maxUses: 1 },
  { name: "Pelle di Pietra",    level: 3, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🪨", info: "Lv3 · +3 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 3, shieldBuffTurns: 3, reqLevel: 5, maxUses: 1 },
  { name: "Flagello d'Insetti", level: 3, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🐝", info: "Lv3 · TS COS · 2d6 veleno a inizio turno per 3 turni", special: "save_dot", saveDotAbility: "con", saveDotDamage: "2d6", saveDotTurns: 3, reqLevel: 5, maxUses: 1 },
  // ── Livello 4 (tier 4 · sbloccato al Lv7 di classe) ───────────────────────
  { name: "Colonna di Ghiaccio", level: 4, hitBonus: 3, damage: "7d8",   statKey: null, type: "spell", icon: "🧊", info: "Lv4 · Freddo · TS DES", reqLevel: 7, maxUses: 1 },
  { name: "Guarigione Naturale", level: 4, hitBonus: 0, damage: "5d8",   statKey: null, type: "spell", icon: "💚", info: "Lv4 · Cura potente · ripristina HP", special: "heal", reqLevel: 7, maxUses: 1 },
  // ── Tier 5 (Lv9) → Tier 9 (Lv17) ─────────────────────────────────────────
  { name: "Muro di Ghiaccio",    level: 5, hitBonus: 3, damage: "8d8",   statKey: null, type: "spell", icon: "🧊", info: "Lv5 · Freddo · TS DES", reqLevel: 9, maxUses: 1 },
  { name: "Muro di Spine",       level: 6, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌵", info: "Lv6 · TS COS · 3d8 perforante a inizio turno per 3 turni", special: "save_dot", saveDotAbility: "con", saveDotDamage: "3d8", saveDotTurns: 3, reqLevel: 11, maxUses: 1 },
  { name: "Tempesta di Fuoco",   level: 7, hitBonus: 3, damage: "7d10",  statKey: null, type: "spell", icon: "🔥", info: "Lv7 · Fuoco · TS DES", reqLevel: 13, maxUses: 1 },
  { name: "Sole Bruciante",      level: 8, hitBonus: 3, damage: "12d6",  statKey: null, type: "spell", icon: "☀", info: "Lv8 · Radiante · TS COS", reqLevel: 15, maxUses: 1 },
  { name: "Tempesta Elementale", level: 9, hitBonus: 3, damage: "15d6",  statKey: null, type: "spell", icon: "🌪", info: "Lv9 · Elementale devastante · TS DES", reqLevel: 17, maxUses: 1 },
];

// ── CLERIC SPELLS (Chierico) — 3 trucchetti · 4 lv1 · 2 lv2
export const CLERIC_SPELLS = [
  // ── Trucchetti ──────────────────────────────────────────────────────────────
  { name: "Fiamma Sacra",       level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "✨", info: "Trucchetto · Radiante", maxUses: 4 },
  { name: "Rintocco dei Morti", level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "💀", info: "Trucchetto · Necrotico", maxUses: 4 },
  { name: "Parola di Splendore",level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🌟", info: "Trucchetto · Radiante", maxUses: 4 },
  { name: "Infestazione",       level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🐜", info: "Trucchetto · Veleno", maxUses: 4 },
  { name: "Guida",              level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "⭐", info: "Trucchetto · +1 ai prossimi 3 attacchi", special: "magic_detect", buffBonus: 1, buffAttacks: 3, maxUses: 4 },
  { name: "Resistenza",         level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🔰", info: "Trucchetto · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 4 },
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Cura Ferite",        level: 1, hitBonus: 0, damage: "1d8",   statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Parola Guaritrice",  level: 1, hitBonus: 0, damage: "1d4",   statKey: null, type: "spell", icon: "💙", info: "Lv1 · Cura rapida · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Dardo Guidato",      level: 1, hitBonus: 3, damage: "2d6",   statKey: null, type: "spell", icon: "🌟", info: "Lv1 · Radiante", maxUses: 3 },
  { name: "Infliggi Ferite",    level: 1, hitBonus: 3, damage: "3d10",  statKey: null, type: "spell", icon: "🩸", info: "Lv1 · Necrotico", maxUses: 3 },
  { name: "Scudo della Fede",   level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +2 a TUTTI i tiri salvezza per 2 turni", special: "save_faith", saveFaithBonus: 2, saveFaithTurns: 2, maxUses: 2 },
  { name: "Comando",            level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "📯", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Disgrazia",          level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌑", info: "Lv1 · Svantaggio agli attacchi del nemico per 2 turni", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 3 },
  { name: "Benedire",           level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "✨", info: "Lv1 · Vantaggio ai tuoi attacchi per 2 turni", special: "self_advantage", advantageTurns: 2, maxUses: 3 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Arma Spirituale",        level: 2, hitBonus: 3, damage: "1d8+4", statKey: null, type: "spell", icon: "⚔",  info: "Lv2 · Forza", maxUses: 2 },
  { name: "Ristorare Inferiore",    level: 2, hitBonus: 0, damage: "1d4+2", statKey: null, type: "spell", icon: "💊", info: "Lv2 · Rimuove veleno/sanguinamento/svantaggio/controllo + cura 1d4+2 HP", special: "heal", cleansesStatuses: true, maxUses: 2 },
  { name: "Blocca Persone",         level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🧊", info: "Lv2 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Aiuto",                  level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🤝", info: "Lv2 · +1 al danno per 2 turni", special: "dmg_buff", aidDmgBonus: 1, aidDmgTurns: 2, maxUses: 2 },
  { name: "Cecità/Sordità",         level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🙈", info: "Lv2 · Svantaggio agli attacchi del nemico per 2 turni", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 2 },
  { name: "Preghiera di Guarigione",level: 2, hitBonus: 0, damage: "2d8",   statKey: null, type: "spell", icon: "🙏", info: "Lv2 · Cura potente · ripristina HP", special: "heal", maxUses: 2 },
  // ── Livello 3 (tier 3 · sbloccato al Lv5 di classe) ───────────────────────
  { name: "Colonna di Fiamma",      level: 3, hitBonus: 3, damage: "8d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv3 · Radiante · TS DES", reqLevel: 5, maxUses: 1 },
  { name: "Rinnovamento",           level: 3, hitBonus: 0, damage: "3d8",   statKey: null, type: "spell", icon: "💚", info: "Lv3 · Cura potente · ripristina HP", special: "heal", reqLevel: 5, maxUses: 1 },
  { name: "Scomunica",              level: 3, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🕊", info: "Lv3 · Controllo · TS SAG o perdi 2 turni", special: "control", reqLevel: 5, maxUses: 1 },
  // ── Livello 4 (tier 4 · sbloccato al Lv7 di classe) ───────────────────────
  { name: "Fiamma Accecante",       level: 4, hitBonus: 3, damage: "8d8",   statKey: null, type: "spell", icon: "☀", info: "Lv4 · Radiante · TS DES", reqLevel: 7, maxUses: 1 },
  { name: "Guarigione",             level: 4, hitBonus: 0, damage: "5d8",   statKey: null, type: "spell", icon: "✨", info: "Lv4 · Cura potentissima · ripristina HP", special: "heal", reqLevel: 7, maxUses: 1 },
  // ── Tier 5 (Lv9) → Tier 9 (Lv17) ─────────────────────────────────────────
  { name: "Fiamma Divina",          level: 5, hitBonus: 3, damage: "8d8",   statKey: null, type: "spell", icon: "🔥", info: "Lv5 · Radiante · TS DES", reqLevel: 9, maxUses: 1 },
  { name: "Lama Spirituale",        level: 6, hitBonus: 3, damage: "9d8",   statKey: null, type: "spell", icon: "⚔", info: "Lv6 · Radiante · TS DES", reqLevel: 11, maxUses: 1 },
  { name: "Rigenerazione",          level: 7, hitBonus: 0, damage: "7d8",   statKey: null, type: "spell", icon: "💗", info: "Lv7 · Cura potentissima · ripristina HP", special: "heal", reqLevel: 13, maxUses: 1 },
  { name: "Fuoco Sacro Maggiore",   level: 8, hitBonus: 3, damage: "12d6",  statKey: null, type: "spell", icon: "☀", info: "Lv8 · Radiante · TS DES", reqLevel: 15, maxUses: 1 },
  { name: "Raffica Solare",         level: 9, hitBonus: 3, damage: "16d6",  statKey: null, type: "spell", icon: "🌟", info: "Lv9 · Radiante devastante · TS DES", reqLevel: 17, maxUses: 1 },
];

// ── BARD SPELLS (Bardo) — niente trucchetti · 4 lv1 · 2 lv2
export const BARD_SPELLS = [
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Parola Guaritrice",          level: 1, hitBonus: 0, damage: "1d4",   statKey: null, type: "spell", icon: "💙", info: "Lv1 · Cura rapida · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Charme su Persone",          level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🫦", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Risata Incontenibile",       level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🤣", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Individuazione del Magico",  level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🔮", info: "Lv1 · +3 al prossimo tiro per colpire", special: "magic_detect", maxUses: 3 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Frastornare",                level: 2, hitBonus: 3, damage: "4d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 3 },
  { name: "Cecità/Sordità",             level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🙈", info: "Lv2 · Svantaggio agli attacchi del nemico per 2 turni", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 2 },
  { name: "Invisibilità",               level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "👻", info: "Lv2 · Il nemico non può attaccarti il prossimo turno", special: "invisibility", invisibilityDuration: 1, maxUses: 2 },
  { name: "Suggestione",                level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌀", info: "Lv2 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Melodia Curativa",           level: 1, hitBonus: 0, damage: "2d8",   statKey: null, type: "spell", icon: "🎶", info: "Lv1 · Cura · 2d8 + CAR HP", special: "heal", healModStat: "cha", maxUses: 2 },
  // ── Livello 3 (tier 3 · sbloccato al Lv5 di classe) ───────────────────────
  { name: "Dissonanza",                 level: 3, hitBonus: 3, damage: "5d8",   statKey: null, type: "spell", icon: "🎵", info: "Lv3 · Psichico · TS DES", reqLevel: 5, maxUses: 1 },
  { name: "Paura Ammaliante",           level: 3, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "😱", info: "Lv3 · Controllo · TS SAG o perdi 2 turni", special: "control", reqLevel: 5, maxUses: 1 },
  { name: "Canto Rigenerante",          level: 3, hitBonus: 0, damage: "3d8",   statKey: null, type: "spell", icon: "💗", info: "Lv3 · Cura potente · 3d8 + CAR HP", special: "heal", healModStat: "cha", reqLevel: 5, maxUses: 1 },
  // ── Livello 4 (tier 4 · sbloccato al Lv7 di classe) ───────────────────────
  { name: "Confusione",                 level: 4, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌀", info: "Lv4 · Controllo · TS SAG o perdi 2 turni", special: "control", reqLevel: 7, maxUses: 1 },
  { name: "Guarigione Melodica",        level: 4, hitBonus: 0, damage: "5d8",   statKey: null, type: "spell", icon: "🎶", info: "Lv4 · Cura potentissima · 5d8 + CAR HP", special: "heal", healModStat: "cha", reqLevel: 7, maxUses: 1 },
  // ── Tier 5 (Lv9) → Tier 9 (Lv17) ─────────────────────────────────────────
  { name: "Dominazione",                level: 5, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🕸", info: "Lv5 · Controllo · TS SAG o perdi 2 turni", special: "control", reqLevel: 9, maxUses: 1 },
  { name: "Eco Dissonante",             level: 6, hitBonus: 3, damage: "9d8",   statKey: null, type: "spell", icon: "🎵", info: "Lv6 · Psichico · TS DES", reqLevel: 11, maxUses: 1 },
  { name: "Rigenerazione Corale",       level: 7, hitBonus: 0, damage: "7d8",   statKey: null, type: "spell", icon: "💗", info: "Lv7 · Cura potentissima · 7d8 + CAR HP", special: "heal", healModStat: "cha", reqLevel: 13, maxUses: 1 },
  { name: "Parola del Potere: Stordire",level: 8, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "😵", info: "Lv8 · Controllo · TS COS o perdi 2 turni", special: "control", reqLevel: 15, maxUses: 1 },
  { name: "Melodia Fatale",             level: 9, hitBonus: 3, damage: "14d6",  statKey: null, type: "spell", icon: "🎼", info: "Lv9 · Psichico devastante · TS SAG", reqLevel: 17, maxUses: 1 },
];

// ── PALADIN SPELLS (Paladino) — pool: 3 lv1 · 3 lv2 (sceglie 2+1)
export const PALADIN_SPELLS = [
  { name: "Cura Ferite",           level: 1, hitBonus: 0, damage: "1d8",   statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Punizione Travolgente", level: 1, hitBonus: 3, damage: "1d6",   statKey: null, type: "spell", icon: "⚡", info: "Lv1 · Radiante bonus", maxUses: 3 },
  { name: "Comando",               level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "📞", info: "Lv1 · Controllo · TS o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Punizione Marchiante",  level: 2, hitBonus: 3, damage: "2d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Radiante", maxUses: 2 },
  { name: "Ristorare Inferiore",   level: 2, hitBonus: 0, damage: "1d4+2", statKey: null, type: "spell", icon: "💊", info: "Lv2 · Rimuove veleno/sanguinamento/svantaggio/controllo + cura 1d4+2 HP", special: "heal", cleansesStatuses: true, maxUses: 2 },
  { name: "Aiuto",                 level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🤝", info: "Lv2 · +1 al danno per 2 turni", special: "dmg_buff", aidDmgBonus: 1, aidDmgTurns: 2, maxUses: 2 },
  // ── Semi-caster: tier 3 (Lv9) · tier 4 (Lv13) · tier 5 (Lv17) ─────────────
  { name: "Corona di Collera",     level: 3, hitBonus: 3, damage: "4d10",  statKey: null, type: "spell", icon: "👑", info: "Lv3 · Radiante · TS DES", reqLevel: 9,  maxUses: 1 },
  { name: "Punizione Accecante",   level: 4, hitBonus: 3, damage: "6d8",   statKey: null, type: "spell", icon: "🌟", info: "Lv4 · Radiante · TS COS", reqLevel: 13, maxUses: 1 },
  { name: "Punizione Devastante",  level: 5, hitBonus: 3, damage: "8d8",   statKey: null, type: "spell", icon: "⚡", info: "Lv5 · Radiante · TS DES", reqLevel: 17, maxUses: 1 },
];

// ── RANGER SPELLS (Ranger) — pool: 6 lv1 (sceglie 3)
export const RANGER_SPELLS = [
  { name: "Cura Ferite",           level: 1, hitBonus: 0, damage: "1d8",   statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Intralciare",           level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌱", info: "Lv1 · Controllo · TS FOR o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Grandine di Spine",     level: 1, hitBonus: 3, damage: "1d10",  statKey: null, type: "spell", icon: "🌵", info: "Lv1 · Perforante · bonus attacco ranged", maxUses: 3 },
  { name: "Colpo Intralciante",    level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🕸", info: "Lv1 · Controllo · TS FOR o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Nebbia",                level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌫", info: "Lv1 · Svantaggio ai tiri per colpire del nemico per 2 turni", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 3 },
  { name: "Passo Spedito",         level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "💨", info: "Lv1 · Bonus action · doppio turno il prossimo turno", special: "extra_turn", bonusAction: true, maxUses: 3 },
  // ── Livello 2 (tier 2 · sbloccato al Lv5 di classe) ───────────────────────
  { name: "Freccia Fulminante",    level: 2, hitBonus: 3, damage: "3d8",   statKey: null, type: "spell", icon: "🏹", info: "Lv2 · Fulmine · TS DES", reqLevel: 5, maxUses: 2 },
  { name: "Corteccia Protettiva",  level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌿", info: "Lv2 · +2 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 2, shieldBuffTurns: 3, reqLevel: 5, maxUses: 2 },
  // ── Semi-caster: tier 3 (Lv9) · tier 4 (Lv13) · tier 5 (Lv17) ─────────────
  { name: "Grandine Fulminante",   level: 3, hitBonus: 3, damage: "5d8",   statKey: null, type: "spell", icon: "🏹", info: "Lv3 · Fulmine · TS DES", reqLevel: 9,  maxUses: 1 },
  { name: "Pelle di Pietra",       level: 4, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🪨", info: "Lv4 · +3 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 3, shieldBuffTurns: 3, reqLevel: 13, maxUses: 1 },
  { name: "Tempesta di Frecce",    level: 5, hitBonus: 3, damage: "8d8",   statKey: null, type: "spell", icon: "🌩", info: "Lv5 · Perforante · TS DES", reqLevel: 17, maxUses: 1 },
];
