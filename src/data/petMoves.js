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

export const PET_TYPES = ["neutral", "fire", "water", "earth", "air", "light", "dark"];

export const TYPE_ICON = {
  neutral: "✦",
  fire:    "🔥",
  water:   "💧",
  earth:   "🌿",
  air:     "⚡",
  light:   "✨",
  dark:    "🌑",
};

export const TYPE_LABEL = {
  neutral: "Neutro",
  fire:    "Fuoco",
  water:   "Acqua",
  earth:   "Terra",
  air:     "Aria",
  light:   "Luce",
  dark:    "Tenebre",
};

/* Type effectiveness · 1.5x super, 0.5x weak.
   Main cycle:  🔥 > 🌿 > ⚡ > 💧 > 🔥
   Dualità:     ✨ ⇄ 🌑   (only effective vs each other; neutral vs the elementals) */
const TYPE_CHART = {
  fire:  { earth: 1.5, water: 0.5 },
  earth: { air:   1.5, fire:  0.5 },
  air:   { water: 1.5, earth: 0.5 },
  water: { fire:  1.5, air:   0.5 },
  light: { dark:  1.5 },
  dark:  { light: 1.5 },
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
  firewall: {
    id: "firewall", name: "Muro di Fuoco", icon: "🧱", type: "fire",
    category: "skill",
    damageDice: { num: 1, sides: 6 }, toHit: 1, maxUses: 3,
    effect: { kind: "shield", value: 3, turns: 2 },
    desc: "Lingue di fiamma respingono i nemici · 1d6 + 3 CA per 2t.",
  },
  pyroblast: {
    id: "pyroblast", name: "Pirobomba", icon: "💣", type: "fire",
    category: "skill",
    damageDice: { num: 2, sides: 8 }, toHit: 0, maxUses: 1,
    effect: { kind: "poison", value: 3, turns: 2 },
    desc: "Definitiva esplosione ignea · 2d8 + ustione 3 PF/t per 2t. Uso singolo.",
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
  tidalheal: {
    id: "tidalheal", name: "Onda Curativa", icon: "💦", type: "water",
    category: "skill",
    damageDice: null, toHit: 0, maxUses: 2,
    effect: { kind: "heal", value: 14 },
    desc: "Marea benefica · recupera 14 PF.",
  },
  frostlance: {
    id: "frostlance", name: "Lancia Glaciale", icon: "❄", type: "water",
    category: "skill",
    damageDice: { num: 1, sides: 10 }, toHit: 1, maxUses: 3,
    desc: "Punta di ghiaccio focalizzata · 1d10 (+1 al colpo). Super vs 🔥.",
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
  stonewall: {
    id: "stonewall", name: "Muro di Pietra", icon: "🗿", type: "earth",
    category: "skill",
    damageDice: null, toHit: 0, maxUses: 2,
    effect: { kind: "shield", value: 5, turns: 3 },
    desc: "Cinta di roccia attorno al compagno · +5 CA per 3 turni.",
  },
  rockslide: {
    id: "rockslide", name: "Frana", icon: "⛰", type: "earth",
    category: "skill",
    damageDice: { num: 2, sides: 8 }, toHit: 0, maxUses: 1,
    desc: "Una valanga di rocce travolge il bersaglio · 2d8. Uso singolo.",
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
  aircutter: {
    id: "aircutter", name: "Lama d'Aria", icon: "🌬", type: "air",
    category: "skill",
    damageDice: { num: 1, sides: 8 }, toHit: 2, maxUses: 4,
    desc: "Lama d'aria compressa, micidiale precisione · 1d8 (+2 al colpo).",
  },
  cyclone: {
    id: "cyclone", name: "Ciclone", icon: "🌀", type: "air",
    category: "skill",
    damageDice: { num: 2, sides: 8 }, toHit: 0, maxUses: 1,
    desc: "Vortice devastante che inghiotte tutto · 2d8. Uso singolo.",
  },

  // ────────────────────────────────────────────────────────────
  // LIGHT ✨ — only super-effective vs Dark; neutro contro gli elementali
  // ────────────────────────────────────────────────────────────
  lightbeam: {
    id: "lightbeam", name: "Raggio di Luce", icon: "🌟", type: "light",
    category: "skill",
    damageDice: { num: 1, sides: 8 }, toHit: 1, maxUses: 5,
    desc: "Lancia un raggio sacro · 1d8 (+1 al colpo). Forte vs 🌑 Tenebre.",
  },
  radiance: {
    id: "radiance", name: "Aurora", icon: "✨", type: "light",
    category: "skill",
    damageDice: { num: 2, sides: 6 }, toHit: 0, maxUses: 2,
    desc: "Esplosione di luce abbagliante · 2d6.",
  },
  blessing: {
    id: "blessing", name: "Benedizione", icon: "🕊", type: "light",
    category: "skill",
    damageDice: null, toHit: 0, maxUses: 2,
    effect: { kind: "heal", value: 13 },
    desc: "Aura divina ristoratrice · recupera 13 PF.",
  },
  solarflare: {
    id: "solarflare", name: "Bagliore Solare", icon: "☀", type: "light",
    category: "skill",
    damageDice: { num: 2, sides: 8 }, toHit: 0, maxUses: 1,
    desc: "Lampo accecante di pura luce · 2d8. Uso singolo. Forte vs 🌑.",
  },

  // ────────────────────────────────────────────────────────────
  // DARK 🌑 — only super-effective vs Light; neutro contro gli elementali
  // ────────────────────────────────────────────────────────────
  shadowbolt: {
    id: "shadowbolt", name: "Dardo d'Ombra", icon: "🦇", type: "dark",
    category: "skill",
    damageDice: { num: 1, sides: 8 }, toHit: 1, maxUses: 5,
    desc: "Scaglia un dardo di pura tenebra · 1d8 (+1 al colpo). Forte vs ✨ Luce.",
  },
  dread: {
    id: "dread", name: "Terrore", icon: "💀", type: "dark",
    category: "skill",
    damageDice: { num: 2, sides: 6 }, toHit: 0, maxUses: 2,
    effect: { kind: "poison", value: 2, turns: 2 },
    desc: "Onda di paura primordiale · 2d6 + 2 danni psichici/turno per 2t.",
  },
  nightveil: {
    id: "nightveil", name: "Velo Notturno", icon: "🌑", type: "dark",
    category: "skill",
    damageDice: null, toHit: 0, maxUses: 2,
    effect: { kind: "shield", value: 4, turns: 3 },
    desc: "Coltre d'ombra avvolge il compagno · +4 CA per 3 turni.",
  },
  voidstrike: {
    id: "voidstrike", name: "Colpo del Vuoto", icon: "🕳", type: "dark",
    category: "skill",
    damageDice: { num: 1, sides: 8 }, toHit: 1, maxUses: 3,
    effect: { kind: "heal", value: 4 },
    desc: "Lama abissale che ruba l'essenza · 1d8 + cura 4 PF a chi colpisce.",
  },
};
