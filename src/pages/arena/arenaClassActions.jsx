// Azioni e passive di classe, compagni (pet del ranger, demoni, costrutti) e azioni speciali.
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.
import { SIMPLE_WEAPONS } from "./arenaGear";

// Carica del Guerriero — aggiunto automaticamente (max 3 cariche)
export const CHARGE_ACTION = {
  name: "Carica", hitBonus: 3, damage: "2d6", statKey: "str",
  type: "skill", icon: "⚔", info: "2d6+FOR · 3 cariche", maxUses: 3,
};

// Secondo Respiro (Fighter) — cura 1d12+5, 3 usi
export const SECOND_WIND_ACTION = {
  name: "Secondo Respiro", hitBonus: 0, damage: "1d12", statKey: null,
  type: "skill", icon: "💨", info: "Cura 1d12+5 · 3 usi", special: "second_wind", maxUses: 3,
};

// Scatto d'Azione (Fighter) — Bonus Action: guadagna un'azione extra questo turno, 3 cariche
export const ACTION_SURGE_ACTION = {
  name: "Scatto d'Azione", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "⚡", info: "Bonus Action · azione extra questo turno · 3 cariche", special: "action_surge", maxUses: 3, bonusAction: true,
};

// Disarmare (Fighter) — disarma il nemico: non può attaccare con armi per 3 turni
export const DISARM_ACTION = {
  name: "Disarmare", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🪓", info: "Disarma l'arma equipaggiata del nemico per 3 turni (può cambiare su un'altra arma) · 2 cariche",
  special: "weapon_lock", weaponLockTurns: 3, maxUses: 2,
};

// Presenza Possente (Fighter) — passiva: se tiri 1 al tiro per colpire, ritira il dado
export const PRESENZA_POSSENTE_PASSIVE = {
  name: "Presenza Possente", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "👑", info: "Passiva · se tiri 1 al tiro per colpire, ritira il dado",
};

// Critico Migliorato (Fighter) — passiva: critico anche con 19
export const CRITICO_MIGLIORATO_PASSIVE = {
  name: "Critico Migliorato", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "💥", info: "Passiva · critico con 19 e 20 (non solo 20)",
};

// ── Passive difensive Lv5-7 (effetti in applyDefenderDamageMods / defenderSaveMod) ──
// Schivata Prodigiosa (Ladro Lv5) — −25% ai danni fisici subiti.
export const SCHIVATA_PRODIGIOSA_PASSIVE = {
  name: "Schivata Prodigiosa", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🌀", info: "Passiva · −25% ai danni fisici subiti", reqLevel: 5,
};
// Elusione (Monaco/Ladro Lv7) — −50% ai danni da incantesimo.
export const ELUSIONE_PASSIVE = {
  name: "Elusione", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "💨", info: "Passiva · −50% ai danni da incantesimo", reqLevel: 7,
};
// Aura di Protezione (Paladino Lv6) — +CAR a tutti i tiri salvezza.
export const AURA_PROTEZIONE_PASSIVE = {
  name: "Aura di Protezione", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "✨", info: "Passiva · +CAR a tutti i tuoi tiri salvezza", reqLevel: 6,
};

// ── Passive Lv4-8 Gruppo A (effetti nei chokepoint condivisi player/IA) ──────
// Difesa del Predatore (Ranger Lv7): mentre hai un bersaglio marchiato, −2 danni
//   subiti — effetto in applyDefenderDamageMods.
export const DIFESA_PREDATORE_PASSIVE = {
  name: "Difesa del Predatore", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🛡", info: "Passiva · mentre il Marchio del Cacciatore è attivo, −2 ai danni subiti", reqLevel: 7,
};
// Tuttofare (Bardo Lv2): +1 a tutti i tiri per colpire e ai tiri salvezza —
//   effetto in defenderSaveMod (TS) e nel bonus al colpire (player + IA).
export const TUTTOFARE_PASSIVE = {
  name: "Tuttofare", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🎲", info: "Passiva · +1 a tutti i tuoi tiri per colpire e ai tiri salvezza", reqLevel: 2,
};
// Colpo Benedetto (Chierico Lv5): cure e danni degli incantesimi con +1 dado —
//   effetto in clericBlessedDice applicato ai tiri di cura/danno degli incantesimi.
export const COLPO_BENEDETTO_PASSIVE = {
  name: "Colpo Benedetto", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🌟", info: "Passiva · le cure e i danni dei tuoi incantesimi tirano +1 dado", reqLevel: 5,
};
// Colpo Divino (Chierico Lv8): +1d8 radiante ai colpi con arma — effetto in divineStrikeBonus.
export const COLPO_DIVINO_PASSIVE = {
  name: "Colpo Divino", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "☀", info: "Passiva · +1d8 danni radianti ai tuoi colpi con arma", reqLevel: 8,
};
// Resistenza Ferina (Barbaro Lv6): in Furia dimezzi i danni fisici. Sotto il Lv6
//   la Furia riduce solo −25% (vedi applyDefenderDamageMods).
export const RESISTENZA_FERINA_PASSIVE = {
  name: "Resistenza Ferina", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🐗", info: "Passiva · in Furia dimezzi i danni fisici subiti (prima del Lv6 la Furia riduce del 25%)", reqLevel: 6,
};

// ── Passive Lv2-8 "Gruppo B" (nuovi hook: CA · iniziativa · svantaggio · danno) ──
// Movimento Senza Armatura (Monaco Lv2): +1 CA senz'armatura — effetto in getEffectiveAc.
export const MOVIMENTO_SENZA_ARMATURA_PASSIVE = {
  name: "Movimento Senza Armatura", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🥋", info: "Passiva · +1 CA quando combatti senz'armatura", reqLevel: 2,
};
// Istinto Selvaggio (Barbaro Lv7): vantaggio all'iniziativa + niente svantaggio
//   agli attacchi mentre sei in Furia — effetto in rollInit/aiRollInitiative e nel calcolo dello svantaggio.
export const ISTINTO_SELVAGGIO_PASSIVE = {
  name: "Istinto Selvaggio", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🐺", info: "Passiva · vantaggio all'iniziativa; in Furia i tuoi attacchi ignorano lo svantaggio", reqLevel: 7,
};
// Furia Bestiale (Barbaro Lv3): in Furia +1 danno per ogni 25% di PF mancanti —
//   effetto in beastRageDamageBonus, sommato ai calcoli danno player/IA.
export const FURIA_BESTIALE_PASSIVE = {
  name: "Furia Bestiale", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🩸", info: "Passiva · in Furia +1 danno per ogni 25% di PF mancanti (fino a +4)", reqLevel: 3,
};
// Attacco Irruento (Barbaro Lv2): +2 al colpire in Furia, −2 CA — effetto in recklessRaging.
export const ATTACCO_IRRUENTO_PASSIVE = {
  name: "Attacco Irruento", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "💢", info: "Passiva · in Furia +2 ai tiri per colpire, ma −2 CA", reqLevel: 2,
};
// Colpi Ki (Monaco Lv6): i colpi in mischia ignorano le riduzioni ai danni fisici — effetto in kiStrikesBypass.
export const COLPI_KI_PASSIVE = {
  name: "Colpi Ki", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🔆", info: "Passiva · i tuoi colpi in mischia ignorano le riduzioni ai danni fisici del nemico", reqLevel: 6,
};
// Risolutezza (Guerriero Lv7): +2 a tutti i tiri salvezza — effetto in defenderSaveMod.
export const RISOLUTEZZA_PASSIVE = {
  name: "Risolutezza", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🪨", info: "Passiva · +2 a tutti i tuoi tiri salvezza", reqLevel: 7,
};
// Infusione (Artefice Lv2): +1 al colpire e +1 al danno con arma — effetto in infusionWeaponBonus.
export const INFUSIONE_PASSIVE = {
  name: "Infusione", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🔧", info: "Passiva · +1 ai tiri per colpire e +1 al danno con le armi", reqLevel: 2,
};

// Colpo Mortale (Rogue) — aggiunto automaticamente (max 2 usi, solo ≤20% HP)
export const DEATHBLOW_ACTION = {
  name: "Colpo Mortale", hitBonus: 3, damage: "4d6"  , statKey: "dex",
  type: "skill", icon: "💀", info: "Solo ≤20% HP · +DES", special: "deathblow", maxUses: 2,
};

// Attacco Furtivo (Rogue) — arma equipaggiata + 1d6, 3 cariche
export const SNEAK_ATTACK_ACTION = {
  name: "Attacco Furtivo", hitBonus: 0, damage: "1d6", statKey: null,
  type: "skill", icon: "🗡", info: "Arma+1d6+DES · 3 cariche", special: "sneak_attack", maxUses: 3,
};

// Furtività (Rogue) — buff puro: vantaggio ai propri 2 attacchi, 3 cariche
export const STEALTH_ACTION = {
  name: "Furtività", hitBonus: 0, damage: "", statKey: null,
  type: "skill", icon: "🌑", info: "Attiva Furtività · vantaggio ai tuoi prossimi 2 attacchi · 3 cariche", special: "stealth", maxUses: 3,
};

// Triboli (Rogue) — TS DES dell'avversario (CD 8+comp+DES del ladro): fallito →
// svantaggio + sanguinamento (1d6/turno) per 2 turni; riuscito → solo 1 turno.
export const TRIBOLI_ACTION = {
  name: "Triboli", hitBonus: 0, damage: "", statKey: null,
  type: "skill", icon: "🪤",
  info: "Sparge triboli · TS DES avversario (CD 8+comp+DES): fallito → svantaggio + sanguinamento (1d6/turno) 2 turni; riuscito → solo 1 turno · 2 cariche",
  special: "triboli",
  disadvantageTurns: 2,
  bleedTurns: 2,
  bleedDice: "1d6",
  maxUses: 2,
};

// Azione Scaltra (Rogue · Lv4) — Bonus Action: un'azione extra questo turno.
// Riusa il motore di Scatto d'Azione (special action_surge). 2 cariche.
export const CUNNING_ACTION_ACTION = {
  name: "Azione Scaltra", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🏃", info: "Bonus Action · azione extra questo turno · 2 cariche",
  special: "action_surge", maxUses: 2, bonusAction: true, reqLevel: 4,
};

// Ispirazione Bardica — cariche = modificatore CAR (impostate dinamicamente al join)
export const BARDIC_INSPIRATION_ACTION = {
  name: "Ispirazione Bardica", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🎵", info: "Bonus Action · +1d6 al prossimo tiro per colpire · cariche = CAR",
  special: "bardic_inspiration", maxUses: 1, bonusAction: true,
};

// Nota Dolente (Bardo) — potenziamento Bottega: 3d6 fulmine + vantaggio 2 turni, 2 cariche.
// Disponibile solo se il bardo ha acquistato il buff "bardNotaDolente" in Bottega.
export const NOTA_DOLENTE_ACTION = {
  name: "Nota Dolente", hitBonus: 3, damage: "3d6", statKey: "cha",
  type: "skill", icon: "⚡", info: "3d6 danni da fulmine + vantaggio per 2 turni · 2 cariche",
  damageType: "fulmine", grantsAdvTurns: 2, maxUses: 2, requiresBuff: "bardNotaDolente",
};

// Furia (Barbarian) — aggiunto automaticamente (4 cariche, +2 danno armi per 3 turni)
export const RAGE_ACTION = {
  name: "Furia", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🔥", info: "Bonus Action · +2 danno armi per 3 turni · 4 cariche",
  special: "rage", maxUses: 4, bonusAction: true,
};

// Turbine di Lame (Barbarian) — 2 attacchi rapidi, 2d10+FOR+3 totali
export const TURBINE_LAME_ACTION = {
  name: "Turbine di Lame", hitBonus: 3, damage: "2d10"  , statKey: "str",
  type: "skill", icon: "🌪", info: "2 attacchi rapidi · 2d10+FOR+3 · 2 cariche",
  special: "turbine_lame", maxUses: 2,
};

// Attacco Poderoso (Barbarian) — 2d8+FOR + vantaggio per 3 turni, 2 cariche
export const MIGHTY_STRIKE_ACTION = {
  name: "Attacco Poderoso", hitBonus: 3, damage: "2d8", statKey: "str",
  type: "skill", icon: "💪", info: "2d8+FOR · concede vantaggio per 3 turni · 2 cariche",
  grantsAdvTurns: 3, maxUses: 2,
};

// Carica di Pugni (Monk) — 2 pugni consecutivi, 2d6+DES, 2 usi
export const CARICA_PUGNI_ACTION = {
  name: "Carica di Pugni", hitBonus: 3, damage: "2d6", statKey: "dex",
  type: "skill", icon: "💥", info: "2 colpi a mani nude · 2d6+DES · 2 usi", maxUses: 2, damageType: "contundente",
};

// Concentrazione (Monk) — Bonus Action: +2 danni per 2 turni, 2 cariche
export const CONCENTRAZIONE_ACTION = {
  name: "Concentrazione", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🧘", info: "Bonus Action · +2 danni per 2 turni · 2 cariche",
  special: "concentrate_buff", maxUses: 2, bonusAction: true,
};

// Assorbire Danni (Monk) — Bonus Action: il prossimo danno subito ti cura dell'80%, 1 carica.
// Il nemico NON deve sapere che è attivo: si mostra solo come "posizione difensiva" generica.
export const ASSORBIRE_DANNI_ACTION = {
  name: "Assorbire Danni", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🌀", info: "Bonus Action · il prossimo danno subito ti cura dell'80% · 1 carica",
  special: "absorb_damage", maxUses: 1, bonusAction: true,
};

// Cura Ki (Monk) — Bonus Action: cura 1d8+SAG HP, 2 cariche
export const KI_HEALING_ACTION = {
  name: "Cura Ki", hitBonus: 0, damage: "1d8", statKey: null,
  type: "skill", icon: "🧘", info: "Bonus Action · cura 1d8+SAG HP · 2 cariche",
  special: "ki_healing", maxUses: 2, bonusAction: true,
};

// Colpo Stordente (Monk · Lv5) — TS COS (CD 8+comp+DES) o il nemico salta 1 turno.
// Riusa il meccanismo di controllo (controlLostTurns), TS tirato subito come la Succubus.
export const STUN_STRIKE_ACTION = {
  name: "Colpo Stordente", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "💫", info: "Colpo Stordente · TS COS o il nemico salta 1 turno · 2 cariche",
  special: "stun_strike", saveAbility: "con", maxUses: 2, reqLevel: 5,
};

// Marchio del Cacciatore (Ranger) — +3 ai tiri per colpire per 3 turni, 2 cariche · BONUS ACTION
export const HUNTER_MARK_ACTION = {
  name: "Marchio del Cacciatore", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🎯", info: "Bonus action · +3 ai tiri per colpire per 3 turni · 2 cariche", special: "hunter_mark", bonusAction: true, maxUses: 2,
};

// Sopravvissuto (Ranger) — analizza il nemico e ne intuisce le mosse:
// vantaggio ai propri attacchi per 2 turni, 2 cariche. Riusa il sistema self_advantage.
export const SURVIVOR_ACTION = {
  name: "Sopravvissuto", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🔍", info: "Analizza il nemico · vantaggio ai tuoi attacchi per 2 turni · 2 cariche",
  special: "self_advantage", advantageTurns: 2, maxUses: 2,
};

// Raffica Letale (Ranger) — skill FIRMA: scocca tre frecce in rapida successione,
// 3d8 + DES perforante in un unico tiro per colpire. 2 cariche.
export const RANGER_VOLLEY_ACTION = {
  name: "Raffica Letale", hitBonus: 3, damage: "3d8", statKey: "dex",
  type: "skill", icon: "🏹", info: "3 frecce · ogni freccia tira per colpire e infligge 1d8+DES perforante · 2 cariche",
  damageType: "perforante", multiHit: 3, perHitDamage: "1d8", maxUses: 2,
};

// Compagni Animali (Ranger) — uno scelto in fase di loadout
export const RANGER_PETS = {
  wolf: {
    key: "wolf", name: "Lupo", icon: "🐺",
    info: "Bonus action · Il lupo morde per 1d8+3 · TS COS o sanguinamento 1d4/turno per 2 turni · 3 cariche",
    action: {
      name: "Morso del Lupo", hitBonus: 0, damage: "1d8+3", statKey: null,
      type: "skill", icon: "🐺", info: "Bonus Action · 1d8+3 danni · TS COS (CD da SAG) o sanguinamento 1d4/turno per 2 turni · 3 cariche",
      special: "pet_wolf", bleedDice: "1d4", bleedTurns: 2, bleedSaveAbility: "con", maxUses: 3, bonusAction: true,
    },
  },
  spider: {
    key: "spider", name: "Ragno", icon: "🕷",
    info: "Bonus action · morde e intrappola · veleno 1d4/2t + TS FOR (CD 13) · fallisce 2t · supera 1t · 2 cariche",
    action: {
      name: "Morso del Ragno", hitBonus: 0, damage: "—", statKey: null,
      type: "skill", icon: "🕷", info: "Bonus Action · veleno 1d4 per 2 turni + TS FOR (CD 13) · fallisce: salta 2 turni · supera: salta 1 turno · 2 cariche",
      special: "pet_spider", saveAbility: "str", saveDC: 13, maxUses: 2, bonusAction: true,
    },
  },
  eagle: {
    key: "eagle", name: "Aquila", icon: "🦅",
    info: "Bonus action · picchiata · 1d4 danni + accecato + svantaggio per 3 turni · 2 cariche",
    action: {
      name: "Picchiata dell'Aquila", hitBonus: 0, damage: "1d4", statKey: null,
      type: "skill", icon: "🦅", info: "Bonus Action · 1d4 danni + accecato + svantaggio per 3 turni · 2 cariche",
      special: "pet_eagle", maxUses: 2, bonusAction: true,
    },
  },
  drago: {
    key: "drago", name: "Draghetto di Smeraldo", icon: "🐉",
    info: "Unico (Bottega) · bonus action · 2d6 danni auto-hit · 2 cariche",
    requiresBuff: "rangerUniquePet",
    action: {
      name: "Soffio del Draghetto", hitBonus: 0, damage: "2d6", statKey: null,
      type: "skill", icon: "🐉", info: "Bonus Action · 2d6 danni auto-hit · 2 cariche",
      special: "pet_drago", maxUses: 2, bonusAction: true,
    },
  },
};

// Demoni Evocati (Warlock) — uno scelto in fase di loadout
export const WARLOCK_DEMONS = {
  mephit: {
    key: "mephit", name: "Mephit di Fiamma", icon: "🔥",
    info: "Bonus action · brucia il nemico: 1d8+2 fuoco per 3 turni · 3 cariche",
    action: {
      name: "Mephit di Fiamma", hitBonus: 0, damage: "—", statKey: null,
      type: "skill", icon: "🔥", info: "Bonus Action · brucia il nemico: 1d8+2 fuoco a inizio turno per 3 turni · 3 cariche",
      special: "demon_mephit", maxUses: 3, bonusAction: true,
      burnTurns: 3, burnDice: "1d8+2",
    },
  },
  succubus: {
    key: "succubus", name: "Succubus", icon: "💋",
    info: "Bonus action · Ammalia il nemico · TS CAR (CD 13) · fallisce 3t + svantaggio 3t · supera 1t + svantaggio 2t · 2 cariche",
    action: {
      name: "Bacio della Succubus", hitBonus: 0, damage: "—", statKey: null,
      type: "skill", icon: "💋", info: "Bonus Action · TS CAR (CD 13) · fallisce: salta 3t + svantaggio 3t · supera: salta 1t + svantaggio 2t · 2 cariche",
      special: "demon_succubus", saveAbility: "cha", saveDC: 13, maxUses: 2, bonusAction: true,
    },
  },
  demon: {
    key: "demon", name: "Demone Maggiore", icon: "👹",
    info: "Bonus action · Drena 2d12 PF dal bersaglio · cura il warlock per la stessa quantità · 2 cariche",
    action: {
      name: "Drenaggio Demoniaco", hitBonus: 0, damage: "2d12", statKey: null,
      type: "skill", icon: "👹", info: "Bonus Action · 2d12 danni auto-hit · cura il warlock per la stessa quantità · 2 cariche",
      special: "demon_greater", maxUses: 2, bonusAction: true,
    },
  },
};

// ── ARTIFICER (Artefice) — sbloccato dalla Bottega ──────────────────────────
// Armi extra: Rifle e Pistola
export const ARTIFICER_RANGED = [
  { name: "Rifle",   hitBonus: 3, damage: "1d8", statKey: "dex", type: "weapon", icon: "🔫", twoHanded: true,  info: "Arma da fuoco · 1d8+DES" },
  { name: "Pistola", hitBonus: 3, damage: "1d6", statKey: "dex", type: "weapon", icon: "🔫", twoHanded: false, info: "Arma da fuoco · 1d6+DES" },
];
export const ARTIFICER_WEAPON_OPTIONS = [...SIMPLE_WEAPONS, ...ARTIFICER_RANGED];

// Spells: 4 cantrips, 4 lv1 — il giocatore sceglie 2 + 3
export const ARTIFICER_SPELLS = [
  // ── Cantrips ──
  { name: "Acid Splash", level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Acido", maxUses: 4 },
  { name: "Fire Bolt",   level: 0, hitBonus: 3, damage: "1d10", statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco", maxUses: 4 },
  { name: "Frost Bite",  level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "❄️", info: "Trucchetto · Freddo · 1d6 danni", maxUses: 4 },
  { name: "Resistance",  level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🛡", info: "Trucchetto · +2 al prossimo tiro per colpire", special: "magic_detect", maxUses: 4 },
  // ── Livello 1 ──
  { name: "Grease",       level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🛢", info: "Lv1 · Controllo · TS DES o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Cure Wounds",  level: 1, hitBonus: 0, damage: "1d8",  statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · 1d8 + INT PF", special: "heal", healModStat: "int", maxUses: 3 },
  { name: "Faerie Fire",  level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🌟", info: "Lv1 · +2 al prossimo tiro per colpire", special: "magic_detect", maxUses: 3 },
  { name: "False Life",   level: 1, hitBonus: 0, damage: "1d4+4",statKey: null, type: "spell", icon: "🩸", info: "Lv1 · Cura · 1d4+4 PF temporanei", special: "heal", maxUses: 3 },
  // ── Livello 2 (tier 2 · sbloccato al Lv5 di classe) ───────────────────────
  { name: "Scorching Ray", level: 2, hitBonus: 3, damage: "6d6", statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco (3 raggi × 2d6) · TS DES", reqLevel: 5, maxUses: 2 },
  { name: "Force Shield",  level: 2, hitBonus: 0, damage: "—",   statKey: null, type: "spell", icon: "🛡", info: "Lv2 · +2 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 2, shieldBuffTurns: 3, reqLevel: 5, maxUses: 2 },
  // ── Semi-caster: tier 3 (Lv9) · tier 4 (Lv13) · tier 5 (Lv17) ─────────────
  { name: "Fireball Meccanica", level: 3, hitBonus: 3, damage: "6d6",    statKey: null, type: "spell", icon: "💥", info: "Lv3 · Fuoco · TS DES", reqLevel: 9,  maxUses: 1 },
  { name: "Cannone ad Acido",   level: 4, hitBonus: 3, damage: "8d8",    statKey: null, type: "spell", icon: "🧪", info: "Lv4 · Acido · TS DES", reqLevel: 13, maxUses: 1 },
  { name: "Raggio Disintegrante",level: 5, hitBonus: 3, damage: "10d6+20",statKey: null, type: "spell", icon: "🔫", info: "Lv5 · Forza · TS DES", reqLevel: 17, maxUses: 1 },
];

// Costrutti — scelti come pet del ranger ma con effetti meccanici diversi
export const ARTIFICER_CONSTRUCTS = {
  golem: {
    key: "golem", name: "Golem di Ferro", icon: "🤖",
    info: "Attacco 1d8+3 · il prossimo attacco subìto dall'Artefice è dimezzato · 2 cariche",
    action: {
      name: "Golem di Ferro", hitBonus: 0, damage: "1d8+3", statKey: null,
      type: "skill", icon: "🤖", info: "1d8+3 danni · prossimo colpo subìto dimezzato",
      special: "construct_golem", maxUses: 2,
    },
  },
  snake: {
    key: "snake", name: "Serpente di Ferro", icon: "🐍",
    info: "Attacco 1d6+3 · veleno 1d6 per 2 turni · 2 cariche",
    action: {
      name: "Serpente di Ferro", hitBonus: 0, damage: "1d6+3", statKey: null,
      type: "skill", icon: "🐍", info: "1d6+3 danni + 1d6 veleno per 2 turni",
      special: "construct_snake", maxUses: 2,
    },
  },
};

// Forgia Armatura — skill unica dell'Artefice: +2 CA per 2 turni, 2 cariche
export const FORGIA_ARMATURA_ACTION = {
  name: "Forgia Armatura", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🛠", info: "+2 CA per 2 turni · 2 cariche",
  special: "armor_forge", maxUses: 2,
};

// Stregoneria Innata (Sorcerer) — passiva: TS nemico ≤7 sul d20 (spell con TS)
// oppure d20 naturale 17+ del caster (spell con tiro per colpire) → danni +50%.
export const INNATE_SORCERY_PASSIVE = {
  name: "Stregoneria Innata", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🌟", info: "Passiva · TS nemico ≤7 sul d20, o tuo d20 naturale 17+ sugli spell-attack → danni +50%",
};

// Smite del Paladino — aggiunto automaticamente (max 2 usi)
export const SMITE_ACTION = {
  name: "Smite Divino", hitBonus: 0, damage: "2d8", statKey: null,
  type: "skill", icon: "⚡", info: "Attacca con arma +2d8 · 2 cariche", special: "smite", maxUses: 2,
};

// Lay of Hands — aggiunto automaticamente al Paladino (pool = 1/3 HP)
export const LAY_OF_HANDS_ACTION = {
  name: "Lay of Hands", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🙏", info: "Bonus Action · cura dalla pozza (1/3 HP max) · scegli l'importo", special: "lay_of_hands", bonusAction: true,
};

// Recupero Arcano (Wizard) — ripristina 2 slot lv1 e 1 slot lv2, 1 uso
export const RECUPERO_ARCANO_ACTION = {
  name: "Recupero Arcano", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "📖", info: "Ripristina 2 slot lv1 + 1 slot lv2 · 1 uso", special: "recupero_arcano", maxUses: 1,
};

// Astuzia Magica (Warlock) — salta il turno e ripristina 1 carica per slot magia
export const MAGICAL_CUNNING_ACTION = {
  name: "Astuzia Magica", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🌀", info: "Salta il turno · +1 carica a ogni slot magia · 2 cariche", special: "magical_cunning", maxUses: 2,
};

/* Patto Demoniaco (Warlock) — sacrifica 1d4 PF per 3 turni di +1d12 ai
   danni delle spell che colpiscono. La penalità è pagata subito; il buff
   `pattoTurns` decresce a ogni attacco del warlock. */
export const PATTO_DEMONIACO_ACTION = {
  name: "Patto Demoniaco", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🩸",
  info: "Sacrifica 1d4 PF · per 3 turni le tue spell che colpiscono fanno +1d12 danni · 2 cariche",
  special: "patto_demoniaco", maxUses: 2,
};
