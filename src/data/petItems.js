/* ============================================================
   PET ITEMS catalog — consumables players buy with petPoints
   and use on their pets to heal/level/buff.
   ------------------------------------------------------------
   Stored on character doc as: petItems: { [itemKey]: count }
   Effects applied via utils/pet.js → applyItemToPet()
   ============================================================ */

export const PET_ITEMS = {
  potion_minor: {
    key: "potion_minor",
    name: "Pozione Minore",
    icon: "🧪",
    desc: "Recupera 15 PF al compagno (anche durante il riposo).",
    cost: 8,
    effect: { kind: "heal", value: 15 },
    requiresAlive: false,
  },
  potion_major: {
    key: "potion_major",
    name: "Pozione Maggiore",
    icon: "⚗",
    desc: "Recupera 30 PF al compagno (anche durante il riposo).",
    cost: 14,
    effect: { kind: "heal", value: 30 },
    requiresAlive: false,
  },
  elixir_full: {
    key: "elixir_full",
    name: "Elisir Completo",
    icon: "💉",
    desc: "Cura completamente il compagno e rimuove il riposo.",
    cost: 22,
    effect: { kind: "heal_full" },
    requiresAlive: false,
  },
  exp_stone: {
    key: "exp_stone",
    name: "Pietra dell'Esperienza",
    icon: "💎",
    desc: "+50 EXP istantanei al compagno.",
    cost: 30,
    effect: { kind: "exp", value: 50 },
    requiresAlive: false,
  },
  rare_candy: {
    key: "rare_candy",
    name: "Caramella Rara",
    icon: "🍬",
    desc: "+1 livello al compagno (capped a Lv 20).",
    cost: 200,
    effect: { kind: "level_up", value: 1 },
    requiresAlive: false,
  },
  wake_tonic: {
    key: "wake_tonic",
    name: "Tonico Risvegliante",
    icon: "☕",
    desc: "Rimuove il riposo: il compagno può combattere subito.",
    cost: 12,
    effect: { kind: "wake" },
    requiresAlive: false,
  },
  power_tonic: {
    key: "power_tonic",
    name: "Tonico di Forza",
    icon: "💪",
    desc: "+1 ATK permanente al compagno.",
    cost: 60,
    effect: { kind: "stat_perm", stat: "atk", value: 1 },
    requiresAlive: false,
  },
  speed_tonic: {
    key: "speed_tonic",
    name: "Tonico Veloce",
    icon: "🏃",
    desc: "+1 SPD permanente al compagno.",
    cost: 60,
    effect: { kind: "stat_perm", stat: "spd", value: 1 },
    requiresAlive: false,
  },
  vigor_tonic: {
    key: "vigor_tonic",
    name: "Tonico Vigoroso",
    icon: "❤️",
    desc: "+5 PF max permanenti al compagno.",
    cost: 60,
    effect: { kind: "stat_perm", stat: "hp", value: 5 },
    requiresAlive: false,
  },
};

export const ITEMS_ORDER = [
  "potion_minor", "potion_major", "elixir_full", "wake_tonic",
  "exp_stone", "rare_candy",
  "power_tonic", "speed_tonic", "vigor_tonic",
];
