/* ============================================================
   PET MOVES catalog — D&D-flavored attack rolls + damage dice
   ------------------------------------------------------------
   Each move:
     id        — stable key
     name      — italian display
     icon      — single emoji
     type      — "neutral" | "fire" | "water" | "earth" | "air"
     category  — "attack" (basic, unlimited) · "skill" (limited use)
     damageDice — { num, sides } rolled on hit (null for pure-utility)
     toHit     — modifier added to d20 + atkBonus
     maxUses   — per battle (null = unlimited; attacks are always null)
     effect    — optional post-hit effect:
                   { kind: "heal",   value }            (self heal flat)
                   { kind: "shield", value, turns }     (+CA, N turns)
                   { kind: "poison", value, turns }     (DoT N/turn, N turns)
   Combat: attack roll = d20 + attacker.atkBonus + move.toHit vs target.ac
     · nat 20 → crit (double damage dice)
     · nat 1  → fumble (auto-miss)
     · damage = (sum(damageDice) + profBonus) × typeMultiplier
   ============================================================ */

export const PET_TYPES = ["neutral", "fire", "water", "earth", "air"];

export const TYPE_ICON = {
  neutral: "✦",
  fire:    "🔥",
  water:   "💧",
  earth:   "🌿",
  air:     "⚡",
};

export const TYPE_LABEL = {
  neutral: "Neutro",
  fire:    "Fuoco",
  water:   "Acqua",
  earth:   "Terra",
  air:     "Aria",
};

/* Type effectiveness · 1.5x super, 0.5x weak.
   Cycle: 🔥 > 🌿 > ⚡ > 💧 > 🔥 */
const TYPE_CHART = {
  fire:  { earth: 1.5, water: 0.5 },
  earth: { air:   1.5, fire:  0.5 },
  air:   { water: 1.5, earth: 0.5 },
  water: { fire:  1.5, air:   0.5 },
};

export function typeMultiplier(attackType, defenderType) {
  if (!attackType || attackType === "neutral") return 1;
  return TYPE_CHART[attackType]?.[defenderType] ?? 1;
}

/* Helper for displaying damage dice as "1d6", "2d4+2" etc. */
export function diceLabel(dice, mod = 0) {
  if (!dice) return "—";
  const base = `${dice.num}d${dice.sides}`;
  if (!mod) return base;
  return mod > 0 ? `${base}+${mod}` : `${base}${mod}`;
}

export const PET_MOVES = {
  // ────────────────────────────────────────────────────────────
  // BASIC ATTACKS — unlimited uses, smaller dice
  // ────────────────────────────────────────────────────────────
  tackle: {
    id: "tackle", name: "Caricata", icon: "💢", type: "neutral",
    category: "attack",
    damageDice: { num: 1, sides: 4 }, toHit: 0, maxUses: null,
    desc: "Carica fisica semplice · 1d4 contundente.",
  },
  bite: {
    id: "bite", name: "Morso", icon: "🦷", type: "neutral",
    category: "attack",
    damageDice: { num: 1, sides: 6 }, toHit: 0, maxUses: null,
    desc: "Morso predatorio · 1d6 perforante.",
  },
  claw: {
    id: "claw", name: "Artiglio", icon: "🗡", type: "neutral",
    category: "attack",
    damageDice: { num: 2, sides: 4 }, toHit: -1, maxUses: null,
    desc: "Doppia artigliata · 2d4 ma -1 al colpo (più imprecisa).",
  },
  slam: {
    id: "slam", name: "Schianto", icon: "💥", type: "neutral",
    category: "attack",
    damageDice: { num: 1, sides: 8 }, toHit: -1, maxUses: null,
    desc: "Colpo pesante · 1d8 ma -1 al colpo.",
  },
  pounce: {
    id: "pounce", name: "Balzo", icon: "🐾", type: "neutral",
    category: "attack",
    damageDice: { num: 1, sides: 6 }, toHit: 1, maxUses: null,
    desc: "Balzo agile da predatore · 1d6 (+1 al colpo).",
  },
  crush: {
    id: "crush", name: "Stritolare", icon: "🪨", type: "neutral",
    category: "attack",
    damageDice: { num: 1, sides: 10 }, toHit: -1, maxUses: null,
    desc: "Colpo schiacciante · 1d10 (-1 al colpo).",
  },

  // ────────────────────────────────────────────────────────────
  // UTILITY SKILLS — neutral / cross-type heal, shield, etc.
  // ────────────────────────────────────────────────────────────
  rest: {
    id: "rest", name: "Riposo", icon: "🌙", type: "neutral",
    category: "skill",
    damageDice: null, toHit: 0, maxUses: 2,
    effect: { kind: "heal", value: 10 },
    desc: "Si rifocilla · recupera 10 PF.",
  },
  guard: {
    id: "guard", name: "Difesa", icon: "🛡", type: "neutral",
    category: "skill",
    damageDice: null, toHit: 0, maxUses: 2,
    effect: { kind: "shield", value: 3, turns: 2 },
    desc: "+3 CA per 2 turni (riduce i danni subiti).",
  },
  bloom: {
    id: "bloom", name: "Fioritura", icon: "🌸", type: "earth",
    category: "skill",
    damageDice: null, toHit: 0, maxUses: 2,
    effect: { kind: "heal", value: 12 },
    desc: "Rigenerazione vegetale · +12 PF.",
  },
  mist: {
    id: "mist", name: "Foschia", icon: "🌫", type: "water",
    category: "skill",
    damageDice: null, toHit: 0, maxUses: 2,
    effect: { kind: "shield", value: 4, turns: 2 },
    desc: "Cortina di nebbia · +4 CA per 2 turni.",
  },
  drain: {
    id: "drain", name: "Drenaggio Vitale", icon: "🩸", type: "neutral",
    category: "skill",
    damageDice: { num: 1, sides: 6 }, toHit: 0, maxUses: 3,
    effect: { kind: "heal", value: 4 },
    desc: "Risucchia vitalità · 1d6 + cura 4 PF a chi colpisce.",
  },
  spores: {
    id: "spores", name: "Spore Tossiche", icon: "🍄", type: "earth",
    category: "skill",
    damageDice: { num: 1, sides: 6 }, toHit: 0, maxUses: 3,
    effect: { kind: "poison", value: 2, turns: 2 },
    desc: "Nube di spore · 1d6 + veleno 2 PF/turno per 2t.",
  },

  // ────────────────────────────────────────────────────────────
  // FIRE 🔥
  // ────────────────────────────────────────────────────────────
  ember: {
    id: "ember", name: "Brace", icon: "🔥", type: "fire",
    category: "skill",
    damageDice: { num: 1, sides: 8 }, toHit: 1, maxUses: 5,
    desc: "Lancia una fiamma · 1d8 (+1 al colpo). Super vs 🌿.",
  },
  inferno: {
    id: "inferno", name: "Inferno", icon: "🌋", type: "fire",
    category: "skill",
    damageDice: { num: 2, sides: 6 }, toHit: 0, maxUses: 2,
    effect: { kind: "poison", value: 3, turns: 2 },
    desc: "Esplosione · 2d6 + ustione 3 PF/turno per 2t.",
  },

  // ────────────────────────────────────────────────────────────
  // WATER 💧
  // ────────────────────────────────────────────────────────────
  bubble: {
    id: "bubble", name: "Bolla", icon: "💧", type: "water",
    category: "skill",
    damageDice: { num: 1, sides: 8 }, toHit: 1, maxUses: 5,
    desc: "Spara una bolla d'acqua · 1d8 (+1 al colpo). Super vs 🔥.",
  },
  tidal: {
    id: "tidal", name: "Maremoto", icon: "🌊", type: "water",
    category: "skill",
    damageDice: { num: 2, sides: 6 }, toHit: 0, maxUses: 2,
    desc: "Onda travolgente · 2d6.",
  },

  // ────────────────────────────────────────────────────────────
  // EARTH 🌿
  // ────────────────────────────────────────────────────────────
  vine: {
    id: "vine", name: "Frusta di Liana", icon: "🌿", type: "earth",
    category: "skill",
    damageDice: { num: 1, sides: 8 }, toHit: 1, maxUses: 5,
    desc: "Frustata vegetale · 1d8 (+1 al colpo). Super vs ⚡.",
  },
  quake: {
    id: "quake", name: "Terremoto", icon: "🪨", type: "earth",
    category: "skill",
    damageDice: { num: 2, sides: 6 }, toHit: 0, maxUses: 2,
    desc: "Sussulto sismico · 2d6.",
  },

  // ────────────────────────────────────────────────────────────
  // AIR ⚡
  // ────────────────────────────────────────────────────────────
  spark: {
    id: "spark", name: "Scintilla", icon: "⚡", type: "air",
    category: "skill",
    damageDice: { num: 1, sides: 8 }, toHit: 1, maxUses: 5,
    desc: "Scarica elettrica · 1d8 (+1 al colpo). Super vs 💧.",
  },
  thunder: {
    id: "thunder", name: "Tempesta", icon: "🌩", type: "air",
    category: "skill",
    damageDice: { num: 2, sides: 6 }, toHit: 0, maxUses: 2,
    desc: "Fulmine concentrato · 2d6.",
  },
  gust: {
    id: "gust", name: "Raffica", icon: "💨", type: "air",
    category: "skill",
    damageDice: { num: 1, sides: 6 }, toHit: 1, maxUses: 4,
    effect: { kind: "poison", value: 2, turns: 2 },
    desc: "Vento penetrante · 1d6 + sanguinamento 2 PF/t per 2t.",
  },
};
