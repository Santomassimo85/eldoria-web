/* ============================================================
   TCG — CLASSES, SUBCLASSES (VIE), XP & LEVELS
   ------------------------------------------------------------
   The 5 classes (D&D-themed). Each class has TWO subclasses
   ("vie"), each tied to ONE element. Each class therefore owns
   a TWO-COLOUR pair; every element is shared by exactly two
   subclasses across two different classes (perfect symmetry).

     Classe       Via A (D&D subclass)              Elemento  | Via B (D&D subclass)              Elemento
     ─────────────────────────────────────────────────────────┼─────────────────────────────────────────────
     Mago         Scuola dell'Evocazione (Conjur.)  Natura  🟢 | Scuola dell'Invocazione (Evoc.)   Fuoco   🔴
     Guerriero    Campione (Champion)               Fuoco   🔴 | Maestro di Battaglia (Battle M.) Luce    ⚪
     Chierico     Dominio della Vita (Life)         Luce    ⚪ | Dominio della Morte (Death)      Ombra   ⚫
     Ladro        Assassino (Assassin)              Ombra   ⚫ | Ladro (Thief)                    Acqua   🔵
     Druido       Circolo della Terra (Land)        Natura  🟢 | Circolo della Luna (Moon)        Acqua   🔵

   Element distribution (each element is hit twice across the table):
     Fuoco   (fire):     Mago-Invocazione  + Guerriero-Campione
     Luce    (light):    Guerriero-Battaglia + Chierico-Vita
     Ombra   (darkness): Chierico-Morte    + Ladro-Assassino
     Acqua   (water):    Ladro-Thief       + Druido-Luna
     Natura  (nature):   Druido-Terra      + Mago-Evocazione

   The class is chosen at DECK BUILD time (and packs are class-themed).
   The SUBCLASS (via) is chosen at MATCH START — it determines the
   level-up reward path, but NOT what cards you may cast: any card in
   your deck (built from your 2 class colours + neutrals + class-tagged
   signatures) is playable regardless of the subclass you picked.

   XP & LEVELS
   ───────────
   You start a match at LEVEL 1. You gain XP from in-match actions and
   level up automatically when you cross a threshold. Reaching higher
   levels unlocks spell-slot tiers and grants subclass-specific perks.

     lv2 →  6 XP
     lv3 → 14 XP   (+ unlocks spell slot tier 2)
     lv4 → 24 XP
     lv5 → 36 XP   (+ unlocks spell slot tier 3; ULTIMATE reward)

   XP sources (tuned for symmetric pacing between aggro and control):
     • +1 XP for each point of damage dealt to the enemy hero
     • +CMC XP for each enemy creature you kill
     • +1 XP for each reaction (instant-speed spell) you cast
     • +1 XP at the start of YOUR turn (survival tick)

   SPELL SLOTS
   ───────────
   Spells AND reactions cost mana AS BEFORE, but also consume a slot of
   the matching TIER (CMC 1–2 → tier 1, CMC 3–4 → tier 2, CMC 5+ →
   tier 3). Creatures do NOT use slots.

   • Tier 1 is available from turn 1; you gain 1 lv-1 slot every
     upkeep, capped by your class:
        Mago (caster pieno) → cap 3
        Chierico / Druido (semi-caster) → cap 3
        Guerriero / Ladro (marziale) → cap 2
   • Tier 2 / Tier 3 unlock at level 3 / level 5 — you gain 1 slot of
     that tier at unlock, and 1 per upkeep afterwards (cap 2).
   • Caster bonus (Mago only): every spell costs −1 generic mana
     (never below 0).
   ============================================================ */

export const CLASSES = ["mago", "guerriero", "chierico", "ladro", "druido"];

export const CLASS_LABEL = {
  mago:      "Mago",
  guerriero: "Guerriero",
  chierico:  "Chierico",
  ladro:     "Ladro",
  druido:    "Druido",
};

export const CLASS_ICON = {
  mago:      "🧙",
  guerriero: "⚔️",
  chierico:  "✨",
  ladro:     "🗡️",
  druido:    "🌿",
};

/* "casterTier" drives the slot cap and the caster mana discount:
     full   → slot cap 3 + (-1 generic on every spell)
     semi   → slot cap 3
     martial → slot cap 2                                          */
export const CLASS_CASTER_TIER = {
  mago:      "full",
  chierico:  "semi",
  druido:    "semi",
  guerriero: "martial",
  ladro:     "martial",
};

export const SLOT_CAP_BY_TIER = {
  full:    { 1: 3, 2: 2, 3: 2 },
  semi:    { 1: 3, 2: 2, 3: 2 },
  martial: { 1: 2, 2: 2, 3: 2 },
};

/* ============================================================
   CLASS BUILD PROFILE
   ------------------------------------------------------------
   Drives BOTH the starter deck (cards.js → buildClassDeck) and
   auto-builds from owned collection (collection.js → autoClassDeck).
   Tuning rules (2026-05-22, after the user reported Guerriero/Ladro
   feeling slow and weak, and some decks feeling too fast):

     • types     — share of creature / spell / artifact in the
                   non-land slice (must sum to 1). NON-CASTERS get
                   VERY FEW spells (Guerriero 12% / Ladro 14%) per
                   the user's instruction; full caster (Mago) sits
                   at 50% spells; semi-casters in between.
     • lands     — Druido gets +2 lands for the ramp game.
     • curve     — relative weight per CMC bucket (0..6). Aggro
                   leans low, control leans medium-high. Used as a
                   tie-breaker / bias when picking cards; not a hard
                   cap. Guerriero/Ladro are still creature-aggro but
                   centred on CMC 2-3 (not turn-1 nat). Mago/Chierico
                   are pushed higher to stop them being "too fast".
   ============================================================ */
export const CLASS_BUILD_PROFILE = {
  // Mago — caster pieno: tante spell, controllo, curva media-alta
  mago: {
    types: { creature: 0.42, spell: 0.50, artifact: 0.08 },
    lands: 22,
    curve: [0, 1, 2, 3, 4, 4, 3],
  },
  // Guerriero — marziale aggro: tantissime creature, pochissime spell
  guerriero: {
    types: { creature: 0.80, spell: 0.12, artifact: 0.08 },
    lands: 22,
    curve: [0, 5, 6, 4, 3, 1, 0],
  },
  // Chierico — semi-caster: creature + cure / drain, curva media
  chierico: {
    types: { creature: 0.60, spell: 0.32, artifact: 0.08 },
    lands: 22,
    curve: [0, 2, 3, 4, 4, 3, 1],
  },
  // Ladro — marziale tempo: creature evasive + qualche reazione
  ladro: {
    types: { creature: 0.78, spell: 0.14, artifact: 0.08 },
    lands: 22,
    curve: [0, 3, 6, 5, 3, 1, 0],
  },
  // Druido — semi-caster ramp: piú terre, creature massicce
  druido: {
    types: { creature: 0.62, spell: 0.28, artifact: 0.10 },
    lands: 24,
    curve: [0, 2, 3, 4, 4, 3, 2],
  },
};
export const DEFAULT_BUILD_PROFILE = {
  types: { creature: 0.60, spell: 0.32, artifact: 0.08 },
  lands: 22,
  curve: [0, 2, 4, 4, 3, 2, 1],
};

export function buildProfileFor(klass) {
  return CLASS_BUILD_PROFILE[klass] || DEFAULT_BUILD_PROFILE;
}

/* The two subclasses of each class, each tied to one element.
   Element keys MUST match cards.js (English: fire/water/light/darkness/
   nature). Italian display names live in cards.js → ELEMENT_LABEL. */
export const CLASS_VIE = {
  mago: {
    evocazione:  { label: "Scuola dell'Evocazione",  dnd: "Conjuration",      element: "nature"   },
    invocazione: { label: "Scuola dell'Invocazione", dnd: "Evocation",        element: "fire"     },
  },
  guerriero: {
    campione:    { label: "Campione",                dnd: "Champion",         element: "fire"     },
    battaglia:   { label: "Maestro di Battaglia",    dnd: "Battle Master",    element: "light"    },
  },
  chierico: {
    vita:        { label: "Dominio della Vita",      dnd: "Life Domain",      element: "light"    },
    morte:       { label: "Dominio della Morte",     dnd: "Death Domain",     element: "darkness" },
  },
  ladro: {
    assassino:   { label: "Assassino",               dnd: "Assassin",         element: "darkness" },
    thief:       { label: "Ladro",                   dnd: "Thief",            element: "water"    },
  },
  druido: {
    terra:       { label: "Circolo della Terra",     dnd: "Circle of the Land", element: "nature" },
    luna:        { label: "Circolo della Luna",      dnd: "Circle of the Moon", element: "water" },
  },
};

/* The two elements ("colours") a class may include in its deck.
   For multiclasses, returns the 3 colours of the combo (see below). */
export function classColors(klass) {
  if (MULTICLASS_DEF[klass]) return MULTICLASS_DEF[klass].elements.slice();
  const vie = CLASS_VIE[klass];
  if (!vie) return [];
  return Object.values(vie).map((v) => v.element);
}

/* ============================================================
   MULTICLASSES  (2026-05-21)
   ------------------------------------------------------------
   The 5 base classes form a colour-pentagram in which every
   neighbouring pair shares ONE colour, producing five natural
   3-colour combos. Each combo is a MULTICLASS with its own
   identity, vie (inherited from both source classes — 4 in
   total) and its own dedicated Ultimate that REPLACES the via
   lv-5 reward when picked.

     Multiclasse    Parti                     Colori
     ────────────────────────────────────────────────────────
     Lamamagica     Mago + Guerriero          Fuoco + Natura + Luce
     Templare       Guerriero + Chierico      Fuoco + Luce + Ombra
     Inquisitore    Chierico + Ladro          Luce + Ombra + Acqua
     Predone        Ladro + Druido            Ombra + Acqua + Natura
     Sciamano       Druido + Mago             Natura + Acqua + Fuoco

   To unlock a multiclasse the deck must contain ALL three of
   its colours; to unlock a base class it's enough to have at
   least ONE of its two colours (deliberately permissive — the
   player can always opt-out by picking a different eligible
   class).
   ============================================================ */

export const MULTICLASSES = [
  "lamamagica", "templare", "inquisitore", "predone", "sciamano",
];

export const MULTICLASS_DEF = {
  lamamagica: {
    label:    "Lamamagica",
    icon:     "🗡️🔥",
    parts:    ["mago", "guerriero"],
    elements: ["fire", "nature", "light"],
    desc:     "Guerriero che incanta la lama con la magia arcana.",
    ultimate: {
      id:   "lama_arcana",
      name: "Lama Arcana",
      icon: "🗡️✨",
      desc: "Le tue creature ottengono +2/+2 e Travolgere fino a fine turno.",
    },
  },
  templare: {
    label:    "Templare",
    icon:     "⚔️✝️",
    parts:    ["guerriero", "chierico"],
    elements: ["fire", "light", "darkness"],
    desc:     "Ordine militante guidato da fede, disciplina e giudizio.",
    ultimate: {
      id:   "giudizio_sacro",
      name: "Giudizio Sacro",
      icon: "⚖️",
      desc: "Infliggi 3 danni a ogni creatura nemica e recuperi 5 PV.",
    },
  },
  inquisitore: {
    label:    "Inquisitore",
    icon:     "✨🗡️",
    parts:    ["chierico", "ladro"],
    elements: ["light", "darkness", "water"],
    desc:     "Giudice tra luce e ombra: nessun colpevole sfugge.",
    ultimate: {
      id:   "sentenza_finale",
      name: "Sentenza Finale",
      icon: "📜",
      desc: "Distruggi la creatura nemica più potente e pesca 2 carte.",
    },
  },
  predone: {
    label:    "Predone",
    icon:     "🗡️🌿",
    parts:    ["ladro", "druido"],
    elements: ["darkness", "water", "nature"],
    desc:     "Fuorilegge della selva: usa le ombre del bosco come arma.",
    ultimate: {
      id:   "imboscata_silvana",
      name: "Imboscata Silvana",
      icon: "🌑🌿",
      desc: "Le tue creature si stappano, perdono fiacca e ottengono +1/+1 fino a fine turno; pesca 2 carte.",
    },
  },
  sciamano: {
    label:    "Sciamano",
    icon:     "🌿💧",
    parts:    ["druido", "mago"],
    elements: ["nature", "water", "fire"],
    desc:     "Natura e magia primordiale convergono nel suo rito.",
    ultimate: {
      id:   "convergenza_elementale",
      name: "Convergenza Elementale",
      icon: "🌪️",
      desc: "Infliggi 4 danni a ogni creatura nemica, 2 all'eroe avversario e recuperi 4 PV.",
    },
  },
};

export const MULTICLASS_LABEL = Object.fromEntries(
  MULTICLASSES.map((k) => [k, MULTICLASS_DEF[k].label])
);
export const MULTICLASS_ICON = Object.fromEntries(
  MULTICLASSES.map((k) => [k, MULTICLASS_DEF[k].icon])
);

/* True when the key refers to one of the 5 multiclassi. */
export function isMulticlass(klass) {
  return !!MULTICLASS_DEF[klass];
}

/* Vie available for a class or multiclass. Multiclasses expose the
   union of the vie of their two parent classes (4 vie). */
export function vieFor(klass) {
  if (MULTICLASS_DEF[klass]) {
    const out = {};
    for (const p of MULTICLASS_DEF[klass].parts) {
      Object.assign(out, CLASS_VIE[p] || {});
    }
    return out;
  }
  return CLASS_VIE[klass] || {};
}

/* Casting tier for a (klass, via) pair. For a multiclasse, the tier
   is inherited from the parent class that owns the chosen via. */
export function casterTierFor(klass, via) {
  // I multiclassi hanno un caster tier FISSO (vedi MULTICLASS_CASTER_TIER):
  // non dipende più dalla via (che per i multiclassi non si sceglie).
  if (MULTICLASS_DEF[klass]) {
    return MULTICLASS_CASTER_TIER[klass] || "semi";
  }
  return CLASS_CASTER_TIER[klass] || "martial";
}

/* Pretty label / icon that works for both classi base e multiclassi. */
export function classLabelOf(klass) {
  return CLASS_LABEL[klass] || MULTICLASS_LABEL[klass] || klass;
}
export function classIconOf(klass) {
  return CLASS_ICON[klass] || MULTICLASS_ICON[klass] || "✦";
}

/* ── DECK COLOR DETECTION ────────────────────────────────────
   Compute the set of colours present in a deck (excluding basic
   lands — only the colours of the cards you'll actually CAST
   count as identity, otherwise a 24-land deck would "qualify"
   as everything). `lookup` is the getCard function from cards.js;
   passing it in keeps this module zero-dep on cards. */
export function computeDeckColors(deck, lookup) {
  const set = new Set();
  if (!Array.isArray(deck) || typeof lookup !== "function") return set;
  for (const id of deck) {
    const c = lookup(id);
    if (!c) continue;
    if (c.type === "land") continue;
    if (c.element) set.add(c.element);
    if (c.cost) {
      for (const el of Object.keys(c.cost)) {
        if (el === "generic") continue;
        if ((c.cost[el] || 0) > 0) set.add(el);
      }
    }
  }
  return set;
}

/* Compute eligibility:
     • base class is eligible if the deck has at least ONE of its colours
     • multiclasse is eligible if the deck has ALL its 3 colours
   Returns { classes, multiclasses, anyEligible }. */
export function computeEligibleClasses(deckColorsLike) {
  const cols = deckColorsLike instanceof Set
    ? deckColorsLike
    : new Set(deckColorsLike || []);
  const classes = [];
  for (const k of CLASSES) {
    const need = classColors(k);
    if (need.some((el) => cols.has(el))) classes.push(k);
  }
  const multi = [];
  for (const k of MULTICLASSES) {
    const need = MULTICLASS_DEF[k].elements;
    if (need.every((el) => cols.has(el))) multi.push(k);
  }
  return {
    classes,
    multiclasses: multi,
    anyEligible: classes.length > 0 || multi.length > 0,
  };
}

/* ── XP CURVE ────────────────────────────────────────────────
   Cumulative XP needed to reach each level. Index 0 unused. */
export const LEVEL_THRESHOLDS = [0, 0, 6, 14, 24, 36];
export const MAX_LEVEL = 5;

/* Compute the level for a given cumulative XP total. */
export function levelForXp(xp) {
  let lvl = 1;
  for (let i = 2; i <= MAX_LEVEL; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) lvl = i;
    else break;
  }
  return lvl;
}

/* Slot tier required to cast a card of a given CMC.
   Creatures call this only conceptually — they ignore slots. */
export function spellSlotTier(cmc) {
  if (cmc <= 2) return 1;
  if (cmc <= 4) return 2;
  return 3;
}

/* Level at which each slot tier first becomes available. */
export const SLOT_TIER_UNLOCK_LEVEL = { 1: 1, 2: 3, 3: 5 };

/* ── PROGRESSION REWARDS ─────────────────────────────────────
   For each (klass, via, level >= 2) we describe the reward.
   The engine APPLIES the reward by reading the `apply` field
   (a tiny patch to the player object) — keeping the rule data
   declarative makes it easy to tune & to display in the UI.

   Patch fields are CUMULATIVE across level-ups:
     extraSlot1PerTurn  — slots of tier-1 gained at upkeep (default 1)
     extraSlot2PerTurn  — same for tier 2 (default 1 once unlocked)
     extraSlot3PerTurn  — same for tier 3 (default 1 once unlocked)
     firstCreatureDiscount — first creature played each turn costs -N
     creatureBuffP / creatureBuffT — your creatures get +X/+Y while in play
     onCreaturePlayPing   — each creature you play deals N damage to opp.
     aoeBonus             — +N damage to every aoe_enemy spell you cast
     ultimateActive       — set when the lv5 ult is currently used (1-turn)
     extraDrawPerTurn     — pesca +N a inizio turno
     casterDiscountBonus  — extra -N generic on spells (stacks with class)

   The "ultimate" entry has an ID — the engine knows which lv-5 effect
   to trigger when the player invokes it (single-use per match).      */

/* helper to build a level row */
const lv = (level, name, icon, description, patch) => ({
  level, name, icon, description, patch,
});

export const CLASS_PROGRESSION = {
  mago: {
    /* 🟢 Natura — evocatore: gioca creature elementali a basso costo */
    evocazione: {
      2: lv(2, "Tocco dell'Evocatore", "🌱",
            "La prima creatura giocata ogni turno costa −1 mana generico.",
            { firstCreatureDiscount: 1 }),
      3: lv(3, "Pacto con la Natura", "🌳",
            "Le tue creature ottengono +0/+1.",
            { creatureBuffT: 1 }),
      4: lv(4, "Convocazione Continua", "✨",
            "Quando giochi una creatura, infligge 1 danno all'eroe avversario.",
            { onCreaturePlayPing: 1 }),
      5: lv(5, "Risveglio Ancestrale", "🌟",
            "ULTIMATE — Evoca una copia gratuita della creatura più potente nel tuo cimitero.",
            { ultimate: "risveglio_ancestrale" }),
    },
    /* 🔴 Fuoco — invocatore: brucia con burst e AoE */
    invocazione: {
      2: lv(2, "Scintilla d'Acciaio", "🔥",
            "Ricevi +1 spell slot lv1 in più ad ogni upkeep.",
            { extraSlot1PerTurn: 1 }),
      3: lv(3, "Mente Arcana", "📜",
            "Pesca +1 carta all'inizio del tuo turno.",
            { extraDrawPerTurn: 1 }),
      4: lv(4, "Detonazione", "💥",
            "Tutti i tuoi spell ad area infliggono +1 danno.",
            { aoeBonus: 1 }),
      5: lv(5, "Aether Surge", "🌌",
            "ULTIMATE — Questo turno gli spell ti costano 0 mana (gli slot servono comunque).",
            { ultimate: "aether_surge" }),
    },
  },
  guerriero: {
    /* 🔴 Fuoco — Campione: aggro, danno frontale, crit */
    campione: {
      2: lv(2, "Lama Affilata", "🗡️",
            "La prima creatura giocata ogni turno entra con +1/+0.",
            { firstCreatureBuffP: 1 }),
      3: lv(3, "Furia di Battaglia", "🔥",
            "Tutti i tuoi danni all'eroe avversario sono aumentati di 1.",
            { heroDmgBonus: 1 }),
      4: lv(4, "Carica Eroica", "⚔️",
            "Tutte le tue creature ottengono +1/+0 permanente.",
            { creatureBuffP: 1 }),
      5: lv(5, "Esplosione Vulcanica", "🌋",
            "ULTIMATE — 5 danni a ogni creatura nemica e 3 all'eroe avversario.",
            { ultimate: "esplosione_vulcanica" }),
    },
    /* ⚪ Luce — Maestro di Battaglia: tattica, comando, difesa */
    battaglia: {
      2: lv(2, "Stoccata Tattica", "🛡️",
            "La prima creatura giocata ogni turno costa −1 mana generico.",
            { firstCreatureDiscount: 1 }),
      3: lv(3, "Comando", "📣",
            "Pesca +1 carta a inizio turno.",
            { extraDrawPerTurn: 1 }),
      4: lv(4, "Aura del Guerriero", "⭐",
            "Tutte le tue creature ottengono +0/+2 permanente.",
            { creatureBuffT: 2 }),
      5: lv(5, "Unisono d'Acciaio", "🗡️🛡️",
            "ULTIMATE — Le tue creature si stappano, non hanno sickness e infliggono +2 danni questo turno.",
            { ultimate: "unisono_acciaio" }),
    },
  },
  chierico: {
    /* ⚪ Luce — Dominio della Vita: cure, ward, sostegno */
    vita: {
      2: lv(2, "Benedizione", "✨",
            "Recuperi 2 PV a ogni inizio turno.",
            { extraHealPerTurn: 2 }),
      3: lv(3, "Protezione Sacra", "🛡️",
            "I tuoi spell di cura recuperano +2 PV.",
            { healBonus: 2 }),
      4: lv(4, "Aura della Vita", "💗",
            "Ogni volta che giochi una creatura, recuperi 2 PV.",
            { onCreaturePlayHeal: 2 }),
      5: lv(5, "Resurrezione Divina", "🌟",
            "ULTIMATE — Recuperi 15 PV; l'eccedenza diventa PV temporanei (ward).",
            { ultimate: "resurrezione_divina" }),
    },
    /* ⚫ Ombra — Dominio della Morte: drain, vampirismo */
    morte: {
      2: lv(2, "Tocco Necrotico", "🌑",
            "Quando una creatura nemica muore, recuperi 1 PV.",
            { onKillHeal: 1 }),
      3: lv(3, "Vampirismo", "🩸",
            "Tutte le tue creature ottengono Legame Vitale.",
            { creatureLifelink: 1 }),
      4: lv(4, "Maledizione", "💀",
            "Quando una creatura nemica muore, l'eroe avversario subisce 1 danno.",
            { onEnemyDeathPing: 1 }),
      5: lv(5, "Apocalisse", "☠️",
            "ULTIMATE — Infliggi 4 danni a tutte le creature nemiche e recuperi 2 PV per ciascuna distrutta dall'effetto.",
            { ultimate: "apocalisse" }),
    },
  },
  ladro: {
    /* ⚫ Ombra — Assassino: burst single-target, evasione */
    assassino: {
      2: lv(2, "Affondo Letale", "🗡️",
            "La prima reazione (instant) lanciata ogni turno infligge +1 danno.",
            { firstReactionDmgBonus: 1 }),
      3: lv(3, "Veleno Sottile", "🐍",
            "I tuoi spell di danno a bersaglio singolo infliggono +1 danno.",
            { singleTargetDmgBonus: 1 }),
      4: lv(4, "Colpo nel Buio", "🌑",
            "Le tue creature infliggono +1 danno in combattimento.",
            { creatureCombatBonus: 1 }),
      5: lv(5, "Assassinio", "🗡",
            "ULTIMATE — Distruggi la creatura nemica più potente (ignora scudi).",
            { ultimate: "assassinio" }),
    },
    /* 🔵 Acqua — Thief: tempo, swarm, draw */
    thief: {
      2: lv(2, "Mani Veloci", "🤲",
            "Pesca +1 carta a inizio turno.",
            { extraDrawPerTurn: 1 }),
      3: lv(3, "Eclissi", "🌊",
            "La prima creatura giocata ogni turno entra con Volare.",
            { firstCreatureFlying: 1 }),
      4: lv(4, "Furto", "💎",
            "Ogni volta che lanci una reazione, peschi 1 carta.",
            { onReactionDraw: 1 }),
      5: lv(5, "Furto Perfetto", "🎴",
            "ULTIMATE — Peschi 3 carte all'istante.",
            { ultimate: "furto_perfetto" }),
    },
  },
  druido: {
    /* 🟢 Natura — Circolo della Terra: ramp e creature massicce */
    terra: {
      2: lv(2, "Crescita Naturale", "🌱",
            "Puoi giocare 1 terra extra ogni turno.",
            { extraLandPerTurn: 1 }),
      3: lv(3, "Foresta Antica", "🌳",
            "Le tue creature con CMC ≥ 4 costano −1 mana generico.",
            { bigCreatureDiscount: 1 }),
      4: lv(4, "Spirito della Terra", "🍃",
            "Tutte le tue creature ottengono +1/+1 permanente.",
            { creatureBuffP: 1, creatureBuffT: 1 }),
      5: lv(5, "Risveglio della Foresta", "🌲",
            "ULTIMATE — Tutte le tue creature ottengono +2/+2 e Travolgere fino a fine turno.",
            { ultimate: "risveglio_foresta" }),
    },
    /* 🔵 Acqua — Circolo della Luna: trasformazione e fluidità */
    luna: {
      2: lv(2, "Forma Animale", "🐺",
            "La prima creatura giocata ogni turno entra con +1/+1.",
            { firstCreatureBuffP: 1, firstCreatureBuffT: 1 }),
      3: lv(3, "Marea Crescente", "🌙",
            "Recuperi 1 PV a ogni inizio turno.",
            { extraHealPerTurn: 1 }),
      4: lv(4, "Furia Selvaggia", "🐻",
            "Tutte le tue creature ottengono Travolgere.",
            { creatureTrample: 1 }),
      5: lv(5, "Forma del Predatore", "🐅",
            "ULTIMATE — Tutte le tue creature ottengono +3/+3 e Travolgere fino a fine turno.",
            { ultimate: "forma_predatore" }),
    },
  },
};

/* ── MULTICLASS PROGRESSION (2026-06-13) ─────────────────────────
   Ogni multiclasse ha ora un KIT PROPRIO (non più ereditato dalle vie
   delle classi sorgenti): perk dedicati a lv2/3/4 + il suo ultimate a
   lv5. La via non si sceglie più per i multiclassi. */
export const MULTICLASS_CASTER_TIER = {
  lamamagica:  "semi",
  templare:    "semi",
  inquisitore: "semi",
  predone:     "martial",
  sciamano:    "full",
};

export const MULTICLASS_PROGRESSION = {
  lamamagica: {
    2: lv(2, "Lama Incantata", "🗡️",
          "La prima creatura giocata ogni turno costa −1 mana generico.",
          { firstCreatureDiscount: 1 }),
    3: lv(3, "Affondo Arcano", "⚔️",
          "Le tue creature infliggono +1 danno in combattimento.",
          { creatureCombatBonus: 1 }),
    4: lv(4, "Taglio Devastante", "💥",
          "Tutte le tue creature ottengono Travolgere.",
          { creatureTrample: 1 }),
    5: lv(5, "Lama Arcana", "🗡️✨",
          "ULTIMATE — Le tue creature ottengono +2/+2 e Travolgere fino a fine turno.",
          { ultimate: "lama_arcana" }),
  },
  templare: {
    2: lv(2, "Mano Risanatrice", "✚",
          "Recuperi 1 PV ogni volta che evochi una creatura.",
          { onCreaturePlayHeal: 1 }),
    3: lv(3, "Disciplina Sacra", "🛡️",
          "Aura: tutte le tue creature ottengono +0/+1.",
          { creatureBuffT: 1 }),
    4: lv(4, "Voto del Templare", "✝️",
          "Tutte le tue creature ottengono Legame vitale.",
          { creatureLifelink: 1 }),
    5: lv(5, "Giudizio Sacro", "⚖️",
          "ULTIMATE — Infliggi 3 danni a ogni creatura nemica e recuperi 5 PV.",
          { ultimate: "giudizio_sacro" }),
  },
  inquisitore: {
    2: lv(2, "Sguardo Inquisitorio", "👁️",
          "Le tue magie a bersaglio singolo infliggono +1 danno.",
          { singleTargetDmgBonus: 1 }),
    3: lv(3, "Marchio del Reo", "🔥",
          "Quando una creatura nemica muore, infliggi 1 danno all'eroe avversario.",
          { onEnemyDeathPing: 1 }),
    4: lv(4, "Castigo Rapido", "⚡",
          "La prima reazione-danno che lanci ogni turno infligge +1 danno.",
          { firstReactionDmgBonus: 1 }),
    5: lv(5, "Sentenza Finale", "📜",
          "ULTIMATE — Distruggi la creatura nemica più potente e pesca 2 carte.",
          { ultimate: "sentenza_finale" }),
  },
  predone: {
    2: lv(2, "Affilatura", "🗡️",
          "La prima creatura giocata ogni turno entra con +1/+0.",
          { firstCreatureBuffP: 1 }),
    3: lv(3, "Agguato dall'Alto", "🦅",
          "La prima creatura giocata ogni turno entra con Volare.",
          { firstCreatureFlying: 1 }),
    4: lv(4, "Colpo Mirato", "🎯",
          "Tutti i tuoi danni all'eroe avversario sono aumentati di 1.",
          { heroDmgBonus: 1 }),
    5: lv(5, "Imboscata Silvana", "🌑🌿",
          "ULTIMATE — Le tue creature si stappano, perdono fiacca e ottengono +1/+1 fino a fine turno; pesca 2 carte.",
          { ultimate: "imboscata_silvana" }),
  },
  sciamano: {
    2: lv(2, "Comunione con la Terra", "🌍",
          "Puoi giocare +1 terra extra per turno.",
          { extraLandPerTurn: 1 }),
    3: lv(3, "Spiriti Ancestrali", "🗿",
          "Le creature con costo ≥4 costano −1 mana generico.",
          { bigCreatureDiscount: 1 }),
    4: lv(4, "Furia Elementale", "🌪️",
          "Tutte le tue magie ad area infliggono +1 danno.",
          { aoeBonus: 1 }),
    5: lv(5, "Convergenza Elementale", "🌪️",
          "ULTIMATE — Infliggi 4 danni a ogni creatura nemica, 2 all'eroe avversario e recuperi 4 PV.",
          { ultimate: "convergenza_elementale" }),
  },
};

/* Look up a single level's reward. Returns null if no reward exists.
   Multiclassi: kit dedicato (MULTICLASS_PROGRESSION), via ignorata. */
export function rewardAt(klass, via, level) {
  if (MULTICLASS_DEF[klass]) {
    return MULTICLASS_PROGRESSION[klass]?.[level] || null;
  }
  return CLASS_PROGRESSION[klass]?.[via]?.[level] || null;
}

/* Default initial state slice for a freshly created player whose
   class/via has been chosen. Spread into mkPlayer(). */
export function initClassState(klass, via) {
  const tier = casterTierFor(klass, via);
  return {
    klass,
    via,
    xp: 0,
    level: 1,
    slots: { 1: 0, 2: 0, 3: 0 },
    slotsUnlocked: { 1: true, 2: false, 3: false },
    slotCap: SLOT_CAP_BY_TIER[tier],
    casterTier: tier,
    /* progression patches accumulate here as you level up */
    perks: {
      extraSlot1PerTurn: 0,
      extraSlot2PerTurn: 0,
      extraSlot3PerTurn: 0,
      firstCreatureDiscount: 0,
      firstCreatureBuffP: 0,     // first creature/turn enters +N/+0
      firstCreatureBuffT: 0,     // first creature/turn enters +0/+N
      creatureBuffP: 0,          // ALL your creatures +N/+0 (passive aura)
      creatureBuffT: 0,          // ALL your creatures +0/+N (passive aura)
      onCreaturePlayPing: 0,
      onCreaturePlayHeal: 0,     // heal N PV each time you summon a creature
      aoeBonus: 0,
      heroDmgBonus: 0,           // your damage TO enemy hero +N (combat & spells)
      extraHealPerTurn: 0,       // gain N PV at upkeep
      healBonus: 0,              // your heal/wardHeal spells gain +N
      onKillHeal: 0,             // when an enemy creature dies, heal N
      onEnemyDeathPing: 0,       // when an enemy creature dies, ping foe hero
      creatureLifelink: 0,       // your creatures gain Lifelink (treated as ≥1)
      creatureTrample: 0,        // your creatures gain Trample (passive aura)
      creatureCombatBonus: 0,    // your creatures' combat damage +N
      firstReactionDmgBonus: 0,  // first instant damage spell each turn +N
      singleTargetDmgBonus: 0,   // single-target damage spells +N (any speed)
      onReactionDraw: 0,         // draw N when you cast an instant
      firstCreatureFlying: 0,    // first creature each turn enters with Flying
      extraLandPerTurn: 0,       // play +N extra lands per turn
      bigCreatureDiscount: 0,    // creatures with cmc ≥ 4 cost −N generic
      extraDrawPerTurn: 0,
      casterDiscountBonus: 0,
      ultimateId: null,          // set when lv5 reached
      ultimateUsed: false,       // becomes true after the ult fires
      ultimateActive: false,     // true for the turn the ult is in effect
    },
    /* per-turn flags that the engine reads then resets at end of turn */
    turnFlags: {
      firstCreaturePlayed: false,
      firstReactionPlayed: false,
      landsPlayedThisTurn: 0,
    },
  };
}
