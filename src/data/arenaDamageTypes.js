// ═══════════════════════════════════════════════════════════════════════════
// Tipi di danno e resistenze dell'Arena — condiviso tra il motore (Arena.jsx)
// e la creazione oggetti della Bottega (ArenaMarketCatalog.jsx).
// 3 tipi fisici + elementali. Le armi possono avere più componenti tipizzati
// (es. 2d6 tagliente + 1d8 fuoco); armature/oggetti danno resistenze per tipo.
// ═══════════════════════════════════════════════════════════════════════════

export const DAMAGE_TYPES = [
  { key: "tagliente",   label: "Tagliente",   icon: "⚔",  kind: "fisico" },
  { key: "perforante",  label: "Perforante",  icon: "🗡", kind: "fisico" },
  { key: "contundente", label: "Contundente", icon: "🔨", kind: "fisico" },
  { key: "fuoco",       label: "Fuoco",       icon: "🔥", kind: "elementale" },
  { key: "freddo",      label: "Freddo",      icon: "❄",  kind: "elementale" },
  { key: "fulmine",     label: "Fulmine",     icon: "⚡", kind: "elementale" },
  { key: "tuono",       label: "Tuono",       icon: "🔊", kind: "elementale" },
  { key: "acido",       label: "Acido",       icon: "🧪", kind: "elementale" },
  { key: "veleno",      label: "Veleno",      icon: "☠",  kind: "elementale" },
  { key: "radiante",    label: "Radiante",    icon: "✨", kind: "elementale" },
  { key: "necrotico",   label: "Necrotico",   icon: "💀", kind: "elementale" },
  { key: "psichico",    label: "Psichico",    icon: "🌀", kind: "elementale" },
  { key: "forza",       label: "Forza",       icon: "🔮", kind: "elementale" },
];

export const DAMAGE_TYPE_KEYS = DAMAGE_TYPES.map((t) => t.key);
export const DAMAGE_TYPE_MAP = Object.fromEntries(DAMAGE_TYPES.map((t) => [t.key, t]));

export function damageTypeLabel(key) {
  return DAMAGE_TYPE_MAP[key]?.label || key || "";
}
export function damageTypeIcon(key) {
  return DAMAGE_TYPE_MAP[key]?.icon || "";
}

// ── MALUS (Bottega) ─────────────────────────────────────────────────────────
// Oggetti "malus": consumabili che infliggono uno svantaggio al nemico (azione
// gratuita). Ogni tipo dice quali campi servono nel form del Master.
export const MALUS_TYPES = [
  { key: "disadvantage", label: "Svantaggio ai tiri per colpire",    icon: "🌫", needsDice: false, needsTurns: true },
  { key: "bleed",        label: "Sanguinamento",                     icon: "🩸", needsDice: true,  needsTurns: true },
  { key: "poison",       label: "Veleno",                            icon: "☠",  needsDice: true,  needsTurns: true },
  { key: "burn",         label: "Bruciatura (in fiamme)",            icon: "🔥", needsDice: true,  needsTurns: true },
  { key: "freeze",       label: "Congelato (svantaggio 1 attacco)",  icon: "🧊", needsDice: false, needsTurns: false },
];
export const MALUS_TYPE_MAP = Object.fromEntries(MALUS_TYPES.map((m) => [m.key, m]));
export function malusTypeLabel(key) { return MALUS_TYPE_MAP[key]?.label || key || ""; }

// Livelli di resistenza selezionabili dal Master (full control).
export const RESIST_LEVELS = {
  resist: { key: "resist", label: "Resistenza", short: "½",  mult: 0.5, icon: "🛡", priority: 2 },
  immune: { key: "immune", label: "Immunità",   short: "0",  mult: 0,   icon: "🚫", priority: 3 },
  vuln:   { key: "vuln",   label: "Vulnerabilità", short: "×2", mult: 2, icon: "💥", priority: 1 },
};
export const RESIST_LEVEL_ORDER = ["resist", "immune", "vuln"];

// Moltiplicatore di danno per un dato tipo, data la mappa resistenze del bersaglio.
// resistMap: { [damageType]: "resist" | "immune" | "vuln" }
export function damageMultiplier(type, resistMap) {
  const lvl = resistMap && resistMap[type];
  if (lvl && RESIST_LEVELS[lvl]) return RESIST_LEVELS[lvl].mult;
  return 1;
}

// Fonde due mappe resistenze tenendo la voce più protettiva per tipo
// (immunità > resistenza; una vulnerabilità viene sovrascritta da qualsiasi difesa).
export function mergeResistMaps(target, src) {
  if (!src) return target;
  for (const [type, lvl] of Object.entries(src)) {
    if (!RESIST_LEVELS[lvl]) continue;
    const cur = target[type];
    if (!cur || RESIST_LEVELS[lvl].priority > RESIST_LEVELS[cur].priority) {
      target[type] = lvl;
    }
  }
  return target;
}
