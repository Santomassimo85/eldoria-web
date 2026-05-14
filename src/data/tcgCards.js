/* ============================================================
   TCG CARDS — Eldoria's D&D-flavored trading card game (v2).
   ------------------------------------------------------------
   6 elements × 4 rarities × 11 mechanics × 6 unique element
   AFFINITIES (a passive each element triggers when you play
   one of its cards) × 2 card TYPES (creature, spell).
   Card art is sourced from the /public/assets/pets folder for
   now (a dedicated /tcgCard folder will replace these later —
   only the `image` path needs to change).
   ============================================================ */

export const TCG_ELEMENTS = ["fire", "water", "earth", "air", "light", "dark"];

export const ELEMENT_LABEL = {
  fire:  "Fuoco",
  water: "Acqua",
  earth: "Terra",
  air:   "Aria",
  light: "Luce",
  dark:  "Tenebra",
};

export const ELEMENT_ICON = {
  fire:  "🔥",
  water: "💧",
  earth: "🌿",
  air:   "🌪",
  light: "✨",
  dark:  "🌑",
};

export const ELEMENT_COLOR = {
  fire:  "#dc2626",
  water: "#1d4ed8",
  earth: "#15803d",
  air:   "#ea580c",
  light: "#fbbf24",
  dark:  "#6b21a8",
};

/* ── ELEMENT AFFINITIES ────────────────────────────────────
   Each element grants a passive that triggers EVERY TIME you
   play a card of that element from your hand (creature OR
   spell). They define each color's identity:
     Fire    — pressure (face damage on play)
     Water   — tempo  (draw on play, 1×/turn)
     Earth   — bulk   (other Earth allies gain +0/+1)
     Air     — chain  (wakes another Air creature)
     Light   — life   (heal champion 2)
     Dark    — value  (raise last fallen creature, 1×/turn)
   The engine implements these in applyAffinity() — change the
   rules text here and the live game will read the new copy.
   ──────────────────────────────────────────────────────────── */
export const TCG_AFFINITIES = {
  fire: {
    key: "fire",
    name: "Ardore",
    icon: "🜂",
    color: "#dc2626",
    rules:
      "Quando giochi una carta di Fuoco, infliggi 1 danno al campione avversario.",
  },
  water: {
    key: "water",
    name: "Marea",
    icon: "🜄",
    color: "#1d4ed8",
    rules:
      "Quando giochi una carta d'Acqua, peschi 1 carta. Una sola volta per turno.",
  },
  earth: {
    key: "earth",
    name: "Radici",
    icon: "🜃",
    color: "#15803d",
    rules:
      "Quando giochi una creatura di Terra, le tue altre creature di Terra ricevono +0/+1 permanente.",
  },
  air: {
    key: "air",
    name: "Brezza",
    icon: "🜁",
    color: "#ea580c",
    rules:
      "Quando giochi una carta d'Aria, una tua altra creatura d'Aria perde il sonno d'evocazione e si stappa.",
  },
  light: {
    key: "light",
    name: "Grazia",
    icon: "✦",
    color: "#fbbf24",
    rules:
      "Quando giochi una carta di Luce, il tuo campione recupera 2 PF (fino al massimo).",
  },
  dark: {
    key: "dark",
    name: "Anima",
    icon: "✶",
    color: "#6b21a8",
    rules:
      "Quando giochi una carta di Tenebra, riporti l'ultima creatura del tuo cimitero nella tua mano. Una sola volta per turno.",
  },
};

/* Element wheel — same rules as PetHub:
   fire > earth > air > water > fire (×1.5 super, ×0.5 weak)
   light ⇄ dark (mutual ×1.5, neutral against the others). */
export const ELEMENT_CYCLE = ["fire", "earth", "air", "water"];
export const LIGHT_DARK = ["light", "dark"];

export function elementMultiplier(attackerEl, defenderEl) {
  if (!attackerEl || !defenderEl) return 1;
  if (attackerEl === defenderEl) return 1;
  // Light/Dark dual
  if (LIGHT_DARK.includes(attackerEl) && LIGHT_DARK.includes(defenderEl)) {
    return 1.5; // mutual super-effective
  }
  if (LIGHT_DARK.includes(attackerEl) || LIGHT_DARK.includes(defenderEl)) {
    return 1; // neutral against the wheel
  }
  // Wheel
  const ai = ELEMENT_CYCLE.indexOf(attackerEl);
  const di = ELEMENT_CYCLE.indexOf(defenderEl);
  if (ai < 0 || di < 0) return 1;
  if ((ai + 1) % 4 === di) return 1.5; // attacker is the predator
  if ((di + 1) % 4 === ai) return 0.5; // defender is the predator
  return 1;
}

/* ── RARITIES ─────────────────────────────────────────────── */
export const TCG_RARITIES = ["common", "rare", "epic", "legendary"];

export const RARITY_LABEL = {
  common:    "Comune",
  rare:      "Raro",
  epic:      "Epico",
  legendary: "Leggendario",
};

export const RARITY_COLOR = {
  common:    "#71717a",
  rare:      "#1d4ed8",
  epic:      "#b91c1c",
  legendary: "#b45309",
};

/* Random starter-deck weights — legendary stays scarce. */
export const RARITY_DECK_WEIGHT = {
  common:    8,
  rare:      4,
  epic:      2,
  legendary: 1,
};

/* ── MECHANICS — 8 unique abilities ───────────────────────── */
export const TCG_MECHANICS = {
  surge: {
    key: "surge",
    name: "Furia",
    icon: "⚡",
    color: "#dc2626",
    rules:
      "Può attaccare nello stesso turno in cui viene evocato.",
  },
  vanguard: {
    key: "vanguard",
    name: "Avanguardia",
    icon: "🗡",
    color: "#1d4ed8",
    rules:
      "Colpisce per primo: assesta il proprio danno prima di subire quello dell'avversario. Se uccide il bersaglio, non riceve la rappresaglia.",
  },
  bulwark: {
    key: "bulwark",
    name: "Baluardo",
    icon: "🛡",
    color: "#15803d",
    rules:
      "Provocazione: il nemico deve attaccare questa creatura prima delle altre o del campione. Riceve +2 PF permanenti quando entra in campo.",
  },
  pierce: {
    key: "pierce",
    name: "Affondo",
    icon: "🩸",
    color: "#b91c1c",
    rules:
      "Quando attacca una creatura nemica, il danno in eccesso colpisce direttamente il campione avversario.",
  },
  soulburn: {
    key: "soulburn",
    name: "Vampirismo",
    icon: "💞",
    color: "#a21caf",
    rules:
      "Il danno inflitto guarisce il campione del suo padrone della stessa quantità.",
  },
  reckon: {
    key: "reckon",
    name: "Letale",
    icon: "☠",
    color: "#1e1b4b",
    rules:
      "Qualsiasi quantità di danno inflitta a una creatura nemica la distrugge sul colpo, indipendentemente dai PF rimasti.",
  },
  veil: {
    key: "veil",
    name: "Rinato",
    icon: "👻",
    color: "#0d9488",
    rules:
      "La prima volta che viene distrutta torna in campo con 1 PF. Una sola volta per partita.",
  },
  cinder: {
    key: "cinder",
    name: "Cenere",
    icon: "💥",
    color: "#ea580c",
    rules:
      "Quando viene distrutta, infligge 2 danni al campione avversario.",
  },
  flying: {
    key: "flying",
    name: "Volo",
    icon: "🪽",
    color: "#7c3aed",
    rules:
      "Sorvola la linea di difesa: le creature a terra non possono fermarla. Può colpire il campione avversario anche se ci sono difensori a terra, ma viene bloccata da altre creature con Volo. È inoltre vulnerabile soltanto a creature con Volo o Cacciatore.",
  },
  cacciatore: {
    key: "cacciatore",
    name: "Cacciatore",
    icon: "🏹",
    color: "#92400e",
    rules:
      "Pur restando a terra, può attaccare creature con Volo come se ne avesse uno. Non riceve l'effetto Volo: continua a poter essere bersagliata normalmente dalle creature a terra.",
  },
  bruciatura: {
    key: "bruciatura",
    name: "Bruciatura",
    icon: "🔥",
    color: "#dc2626",
    hasValue: true,                  // X is read from card.mechanicsValues.bruciatura
    rules:
      "Quando questa creatura infligge danni al campione avversario, applica Bruciatura X: per i suoi prossimi X turni il campione subisce 1 danno all'inizio del turno. Le applicazioni si sommano in durata.",
  },
  linfa: {
    key: "linfa",
    name: "Linfa",
    icon: "🌿",
    color: "#15803d",
    hasValue: true,                  // X is read from card.mechanicsValues.linfa
    rules:
      "All'inizio di ogni tuo turno, questa creatura recupera X PF (fino al massimo).",
  },
};

export const MECHANICS_ORDER = [
  "surge", "vanguard", "bulwark", "pierce",
  "soulburn", "reckon", "veil", "cinder", "flying",
  "cacciatore", "bruciatura", "linfa",
];

/* Renders a mechanic label that includes its X value when present.
   getMechLabel(card, "bruciatura") → "Bruciatura 2" if the card sets
   mechanicsValues.bruciatura = 2, otherwise plain "Bruciatura". */
export function getMechLabel(card, mechKey) {
  const m = TCG_MECHANICS[mechKey];
  if (!m) return "";
  if (m.hasValue) {
    const v = card?.mechanicsValues?.[mechKey];
    return v != null ? `${m.name} ${v}` : m.name;
  }
  return m.name;
}

/* ── CARD TYPES ──────────────────────────────────────────────
   Four kinds of cards share the same pool:
     "creature"    — goes to the board, attacks, blocks, has HP/ATK.
     "spell"       — one-shot magic effect, then to graveyard.
     "enchantment" — temporary keyword grant or persistent champion
                     effect (e.g. champion regen). Goes to graveyard
                     after casting; the effect lives on the target.
     "counter"     — anti-magic response: dispel, extinguish, damage
                     shield, hard-destroy. Also one-shot.
   The engine treats spell/enchantment/counter identically for the
   play flow (mana, target, resolve, graveyard); the type only
   drives UI, codex filters, and Rules grouping. Creatures use the
   creature flow (board).
   When a card lacks `type`, it is treated as a creature for
   backward compatibility with the v1 catalog.
   ──────────────────────────────────────────────────────────── */
export const CARD_TYPES = ["creature", "spell", "enchantment", "counter", "crystal"];
export const TYPE_LABEL = {
  creature:    "Creatura",
  spell:       "Incantesimo",
  enchantment: "Aura",
  counter:     "Contromagia",
  crystal:     "Cristallo",
};
export const TYPE_ICON = {
  creature:    "🐲",
  spell:       "📜",
  enchantment: "🌟",
  counter:     "🛡",
  crystal:     "💎",
};

/* A card is "creature" if marked so or unset; otherwise its
   explicit type. Anything not creature is resolved through the
   spell-flow in the engine. Crystals are MTG-style mana sources
   (one play per turn, permanent on the field). */
export function getCardType(card) {
  const t = card?.type;
  if (t === "spell" || t === "enchantment" || t === "counter" || t === "crystal") return t;
  return "creature";
}
export function isSpellLike(card) {
  return getCardType(card) !== "creature";
}

/* ── SPELL TARGETS ───────────────────────────────────────────
   The engine reads `effect.target` to decide whether the player
   must pick a target before casting:
     "none"            — auto-resolve, no picker
     "enemy_creature"  — pick one enemy creature
     "ally_creature"   — pick one of your creatures
     "any_creature"    — pick any creature on either side
     "enemy_champion"  — auto-target opp champion
   Spells whose effect already enumerates all victims (AoE) use
   "none" — the engine handles the rest.
   ──────────────────────────────────────────────────────────── */
export const SPELL_TARGETS = [
  "none", "enemy_creature", "ally_creature", "any_creature", "enemy_champion",
];

/* ── CARD POOL ─────────────────────────────────────────────
   Each card:
     id         — unique key
     name       — italian display name
     image      — /assets/tgc_card/*.png (placeholder, until /tcgCard exists)
     icon       — emoji fallback
     element    — fire/water/earth/air/light/dark
     rarity     — common/rare/epic/legendary
     cost       — mana cost (1-9)
     atk        — attack power
     hp         — toughness
     mechanics  — array of mechanic keys
     flavor     — short italian flavor line
   Power budget rule of thumb:
     atk + hp ≈ 2*cost + 1 (common), +1 (rare), +2 (epic), +3 (legendary).
     A mechanic counts ~1 stat point each.
   ============================================================ */

export const TCG_CARDS = {

  /* ── FIRE 🔥 ──────────────────────────────────── */
  imp: {
    id: "imp", name: "Diavoletto", image: "/assets/tgc_card/imp.png", icon: "👺",
    element: "fire", rarity: "common", cost: 1, mana: { fire: 1 }, atk: 2, hp: 1,
    mechanics: ["surge"],
    flavor: "Una scintilla con le ali e un cattivo carattere.",
  },
  hellhound: {
    id: "hellhound", name: "Mastino Infernale", image: "/assets/tgc_card/hellhound.png", icon: "🐕‍🔥",
    element: "fire", rarity: "common", cost: 2, mana: { fire: 2 }, atk: 3, hp: 2,
    mechanics: ["surge", "bruciatura"],
    mechanicsValues: { bruciatura: 1 },
    flavor: "Caccia in branco, brucia da solo.",
  },
  spineddevil: {
    id: "spineddevil", name: "Diavolo Spinato", image: "/assets/tgc_card/spineddevil.png", icon: "🦂",
    element: "fire", rarity: "common", cost: 2, mana: { fire: 1, any: 1 }, atk: 2, hp: 3,
    mechanics: ["cinder", "cacciatore"],
    flavor: "Le sue spine volano in alto. Anche i corvi le temono.",
  },
  fireaxedevil: {
    id: "fireaxedevil", name: "Diavolo dell'Ascia", image: "/assets/tgc_card/fireaxedevil.png", icon: "🪓",
    element: "fire", rarity: "rare", cost: 3, mana: { fire: 2, any: 1 }, atk: 4, hp: 3,
    mechanics: ["pierce"],
    flavor: "L'ascia infuocata non si ferma davanti alla carne.",
  },
  hornedevil: {
    id: "hornedevil", name: "Diavolo Cornuto", image: "/assets/tgc_card/hornedevil.png", icon: "😈",
    element: "fire", rarity: "rare", cost: 4, mana: { fire: 3, any: 1 }, atk: 5, hp: 4,
    mechanics: ["vanguard"],
    flavor: "Le sue corna trafiggono prima del grido.",
  },
  hezrou: {
    id: "hezrou", name: "Hezrou", image: "/assets/tgc_card/hezrou.png", icon: "🐸",
    element: "fire", rarity: "epic", cost: 5, mana: { fire: 4, any: 1 }, atk: 5, hp: 7,
    mechanics: ["bulwark", "cinder"],
    flavor: "Il suo fetore brucia i polmoni di chi osa avvicinarsi.",
  },
  balor: {
    id: "balor", name: "Balor", image: "/assets/tgc_card/balor.png", icon: "🔥",
    element: "fire", rarity: "epic", cost: 7, mana: { fire: 6, any: 1 }, atk: 8, hp: 6,
    mechanics: ["surge", "pierce", "bruciatura"],
    mechanicsValues: { bruciatura: 2 },
    flavor: "Frusta di fiamma, spada di fulmine. La fine di un'armata.",
  },
  reddragon: {
    id: "reddragon", name: "Drago Rosso", image: "/assets/tgc_card/reddragon.png", icon: "🐉",
    element: "fire", rarity: "legendary", cost: 8, mana: { fire: 8 }, atk: 9, hp: 9,
    mechanics: ["surge", "pierce", "bruciatura", "flying"],
    mechanicsValues: { bruciatura: 3 },
    flavor: "Avarizia con le ali. Il suo soffio brucia per giorni.",
  },

  /* ── WATER 💧 ─────────────────────────────────── */
  kuotoa: {
    id: "kuotoa", name: "Kuo-Toa", image: "/assets/tgc_card/kuotoa.png", icon: "🐠",
    element: "water", rarity: "common", cost: 1, mana: { water: 1 }, atk: 1, hp: 3,
    mechanics: [],
    flavor: "Adora un dio improbabile. Lo difende lo stesso.",
  },
  sahuagin: {
    id: "sahuagin", name: "Sahuagin", image: "/assets/tgc_card/sahuagin.png", icon: "🦈",
    element: "water", rarity: "common", cost: 2, mana: { water: 1, any: 1 }, atk: 3, hp: 2,
    mechanics: ["surge", "cacciatore"],
    flavor: "Il suo arpione vola dritto verso il cielo.",
  },
  merfolk: {
    id: "merfolk", name: "Tritone", image: "/assets/tgc_card/merfolk.png", icon: "🧜",
    element: "water", rarity: "common", cost: 2, mana: { water: 2 }, atk: 2, hp: 3,
    mechanics: ["soulburn"],
    flavor: "Il suo canto cura il sangue di chi lo ama.",
  },
  watermage: {
    id: "watermage", name: "Mago dell'Acqua", image: "/assets/tgc_card/watermage.png", icon: "🌊",
    element: "water", rarity: "rare", cost: 3, mana: { water: 3 }, atk: 2, hp: 4,
    mechanics: ["soulburn"],
    flavor: "Onda dopo onda, ricuce le ferite del suo padrone.",
  },
  marinebrute: {
    id: "marinebrute", name: "Bruto Marino", image: "/assets/tgc_card/marinebrute.png", icon: "🐙",
    element: "water", rarity: "rare", cost: 4, mana: { water: 3, any: 1 }, atk: 3, hp: 6,
    mechanics: ["bulwark"],
    flavor: "Tentacoli come ancore. Niente passa.",
  },
  marid: {
    id: "marid", name: "Marid", image: "/assets/tgc_card/marid.png", icon: "🌀",
    element: "water", rarity: "epic", cost: 5, mana: { water: 4, any: 1 }, atk: 5, hp: 6,
    mechanics: ["soulburn", "vanguard"],
    flavor: "Genio dell'oceano. La sua collera ribolle prima di colpire.",
  },
  dragonturtle: {
    id: "dragonturtle", name: "Drago Tartaruga", image: "/assets/tgc_card/dragonturtle.png", icon: "🐢",
    element: "water", rarity: "epic", cost: 6, mana: { water: 5, any: 1 }, atk: 5, hp: 9,
    mechanics: ["bulwark", "vanguard"],
    flavor: "Antico abisso vivente. Affonda flotte solo respirando.",
  },
  kraken: {
    id: "kraken", name: "Kraken", image: "/assets/tgc_card/kraken.png", icon: "🦑",
    element: "water", rarity: "legendary", cost: 9, mana: { water: 9 }, atk: 8, hp: 10,
    mechanics: ["pierce", "bulwark", "reckon"],
    flavor: "Le tempeste sono i suoi sospiri. Le navi i suoi giocattoli.",
  },

  /* ── EARTH 🌿 ─────────────────────────────────── */
  myconid: {
    id: "myconid", name: "Myconide", image: "/assets/tgc_card/myconid.png", icon: "🍄",
    element: "earth", rarity: "common", cost: 1, mana: { earth: 1 }, atk: 1, hp: 3,
    mechanics: ["veil", "linfa"],
    mechanicsValues: { linfa: 1 },
    flavor: "Le spore tornano sempre, anche dopo l'inverno.",
  },
  badger: {
    id: "badger", name: "Tasso Furioso", image: "/assets/tgc_card/badger.png", icon: "🦡",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 1, any: 1 }, atk: 3, hp: 2,
    mechanics: ["reckon"],
    flavor: "Piccolo, basso, e mortalmente cocciuto.",
  },
  twigblight: {
    id: "twigblight", name: "Rovo Animato", image: "/assets/tgc_card/twigblight.png", icon: "🌿",
    element: "earth", rarity: "common", cost: 1, mana: { earth: 1 }, atk: 2, hp: 2,
    mechanics: ["linfa"],
    mechanicsValues: { linfa: 1 },
    flavor: "Sembra un cespuglio. Lo è. Ma morde. E ricresce.",
  },
  hookhorror: {
    id: "hookhorror", name: "Orrore Uncinato", image: "/assets/tgc_card/hookhorror.png", icon: "🦀",
    element: "earth", rarity: "rare", cost: 3, mana: { earth: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["pierce", "cacciatore"],
    flavor: "Gli uncini agganciano la pietra. E ciò che vola sopra.",
  },
  shamblingmound: {
    id: "shamblingmound", name: "Cumulo Strisciante", image: "/assets/tgc_card/shamblingmound.png", icon: "🌳",
    element: "earth", rarity: "rare", cost: 4, mana: { earth: 3, any: 1 }, atk: 3, hp: 6,
    mechanics: ["bulwark", "linfa"],
    mechanicsValues: { linfa: 1 },
    flavor: "Marcisce. Si rialza. Marcisce di nuovo. Cammina.",
  },
  crystalgolem: {
    id: "crystalgolem", name: "Golem di Cristallo", image: "/assets/tgc_card/crystalgolem.png", icon: "💎",
    element: "earth", rarity: "epic", cost: 5, mana: { earth: 4, any: 1 }, atk: 4, hp: 8,
    mechanics: ["bulwark", "vanguard"],
    flavor: "Riflette ogni colpo prima di restituirlo come una sentenza.",
  },
  irongolem: {
    id: "irongolem", name: "Golem di Ferro", image: "/assets/tgc_card/irongolem.png", icon: "🤖",
    element: "earth", rarity: "epic", cost: 7, mana: { earth: 6, any: 1 }, atk: 7, hp: 8,
    mechanics: ["bulwark", "pierce"],
    flavor: "Una fortezza che cammina, dimenticata da chi l'ha forgiata.",
  },
  ankylosaurus: {
    id: "ankylosaurus", name: "Anchilosauro", image: "/assets/tgc_card/ankylosaurus.png", icon: "🦕",
    element: "earth", rarity: "legendary", cost: 8, mana: { earth: 8 }, atk: 7, hp: 11,
    mechanics: ["bulwark", "reckon", "linfa"],
    mechanicsValues: { linfa: 2 },
    flavor: "La sua coda spacca le montagne. La sua corteccia ricresce ogni alba.",
  },

  /* ── AIR 🌪 ───────────────────────────────────── */
  hawk: {
    id: "hawk", name: "Falco", image: "/assets/tgc_card/hawk.png", icon: "🦅",
    element: "air", rarity: "common", cost: 1, mana: { air: 1 }, atk: 2, hp: 1,
    mechanics: ["surge", "flying"],
    flavor: "Vede il topo prima che il topo si veda.",
  },
  wingedkobold: {
    id: "wingedkobold", name: "Kobold Alato", image: "/assets/tgc_card/wingedkobold.png", icon: "🦖",
    element: "air", rarity: "common", cost: 2, mana: { air: 1, any: 1 }, atk: 2, hp: 2,
    mechanics: ["surge", "cinder", "flying"],
    flavor: "Si schianta con stile. Sempre.",
  },
  airelemental: {
    id: "airelemental", name: "Elementale dell'Aria", image: "/assets/tgc_card/airelemental.png", icon: "🌬",
    element: "air", rarity: "rare", cost: 3, mana: { air: 2, any: 1 }, atk: 3, hp: 3,
    mechanics: ["surge", "pierce", "flying"],
    flavor: "Non lo afferri. Lo respiri. E ti taglia dentro.",
  },
  peryton: {
    id: "peryton", name: "Periton", image: "/assets/tgc_card/peryton.png", icon: "🦌",
    element: "air", rarity: "rare", cost: 3, mana: { air: 2, any: 1 }, atk: 4, hp: 2,
    mechanics: ["surge", "pierce", "flying"],
    flavor: "L'ombra di un cervo, gli artigli di un'aquila.",
  },
  manticore: {
    id: "manticore", name: "Manticora", image: "/assets/tgc_card/manticore.png", icon: "🦁",
    element: "air", rarity: "rare", cost: 4, mana: { air: 3, any: 1 }, atk: 4, hp: 4,
    mechanics: ["pierce", "flying"],
    flavor: "Faccia umana, voce di leone, code piene di lance.",
  },
  djinni: {
    id: "djinni", name: "Djinni", image: "/assets/tgc_card/djinni.png", icon: "🧞",
    element: "air", rarity: "epic", cost: 5, mana: { air: 4, any: 1 }, atk: 5, hp: 6,
    mechanics: ["surge", "vanguard", "flying"],
    flavor: "Genio dei cieli. I tuoi tre desideri non basteranno.",
  },
  stormelemental: {
    id: "stormelemental", name: "Elementale di Tempesta", image: "/assets/tgc_card/stormelemental.png", icon: "⛈",
    element: "air", rarity: "epic", cost: 6, mana: { air: 5, any: 1 }, atk: 6, hp: 6,
    mechanics: ["surge", "pierce", "cinder", "flying"],
    flavor: "Tuono che cammina. Pioggia che taglia.",
  },
  tempestdragon: {
    id: "tempestdragon", name: "Drago della Tempesta", image: "/assets/tgc_card/tempestdragon.png", icon: "🌩",
    element: "air", rarity: "legendary", cost: 8, mana: { air: 8 }, atk: 8, hp: 9,
    mechanics: ["surge", "pierce", "vanguard", "flying"],
    flavor: "Vola sopra le nuvole. Scende sotto forma di sentenza.",
  },

  /* ── LIGHT ✨ ─────────────────────────────────── */
  pegasus: {
    id: "pegasus", name: "Pegaso", image: "/assets/tgc_card/pegasus.png", icon: "🦄",
    element: "light", rarity: "common", cost: 2, mana: { light: 2 }, atk: 2, hp: 3,
    mechanics: ["soulburn", "flying"],
    flavor: "Le sue ali profumano di alba.",
  },
  copperdragon: {
    id: "copperdragon", name: "Drago di Rame", image: "/assets/tgc_card/copperdragon.png", icon: "🐲",
    element: "light", rarity: "rare", cost: 4, mana: { light: 3, any: 1 }, atk: 4, hp: 4,
    mechanics: ["soulburn", "vanguard", "flying"],
    flavor: "Burlone delle terre soleggiate. Sa anche essere serio.",
  },
  helmedhorror: {
    id: "helmedhorror", name: "Orrore Elmato", image: "/assets/tgc_card/helmedhorror.png", icon: "⚔",
    element: "light", rarity: "rare", cost: 4, mana: { light: 3, any: 1 }, atk: 3, hp: 5,
    mechanics: ["bulwark", "vanguard", "cacciatore"],
    flavor: "Lancia eretta verso il cielo. Niente vi passa senza pagare.",
  },
  satyr: {
    id: "satyr", name: "Satiro", image: "/assets/tgc_card/satyr.png", icon: "🐐",
    element: "light", rarity: "common", cost: 1, mana: { light: 1 }, atk: 1, hp: 2,
    mechanics: ["veil"],
    flavor: "Suona, balla, ricresce sotto la luna piena.",
  },
  solar: {
    id: "solar", name: "Solare", image: "/assets/tgc_card/solar.png", icon: "🌟",
    element: "light", rarity: "legendary", cost: 9, mana: { light: 9 }, atk: 8, hp: 10,
    mechanics: ["vanguard", "soulburn", "veil"],
    flavor: "Un angelo della guerra. Un angelo della guerra giusta.",
  },

  /* ── DARK 🌑 ──────────────────────────────────── */
  zombie: {
    id: "zombie", name: "Zombi", image: "/assets/tgc_card/zombie.png", icon: "🧟",
    element: "dark", rarity: "common", cost: 1, mana: { dark: 1 }, atk: 1, hp: 3,
    mechanics: ["veil"],
    flavor: "Già morto una volta. Cosa potrà mai andare storto?",
  },
  manes: {
    id: "manes", name: "Manes", image: "/assets/tgc_card/manes.png", icon: "👹",
    element: "dark", rarity: "common", cost: 1, mana: { dark: 1 }, atk: 2, hp: 1,
    mechanics: ["cinder"],
    flavor: "Anima dannata, urla anche dopo la morte.",
  },
  specter: {
    id: "specter", name: "Spettro", image: "/assets/tgc_card/specter.png", icon: "👻",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 2, any: 1 }, atk: 3, hp: 3,
    mechanics: ["pierce", "soulburn", "flying"],
    flavor: "Ti svuota di vita. Si nutre del tuo respiro.",
  },
  wight: {
    id: "wight", name: "Wight", image: "/assets/tgc_card/wight.png", icon: "💀",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 3 }, atk: 4, hp: 2,
    mechanics: ["soulburn"],
    flavor: "Ogni vittima diventa carne dell'esercito.",
  },
  nightmare: {
    id: "nightmare", name: "Incubo", image: "/assets/tgc_card/nightmare.png", icon: "🐴",
    element: "dark", rarity: "epic", cost: 5, mana: { dark: 4, any: 1 }, atk: 6, hp: 5,
    mechanics: ["surge", "cinder"],
    flavor: "Galoppa nei sogni. Atterra nei tuoi peggiori.",
  },
  mindflayer: {
    id: "mindflayer", name: "Mente Adunca", image: "/assets/tgc_card/mindflayer.png", icon: "🦑",
    element: "dark", rarity: "epic", cost: 6, mana: { dark: 5, any: 1 }, atk: 5, hp: 6,
    mechanics: ["reckon", "soulburn"],
    flavor: "Estrae il cervello. Ne fa un pasto. Lo serve a sé stesso.",
  },
  lich: {
    id: "lich", name: "Lich", image: "/assets/tgc_card/lich.png", icon: "☠",
    element: "dark", rarity: "legendary", cost: 8, mana: { dark: 8 }, atk: 7, hp: 9,
    mechanics: ["reckon", "veil", "soulburn"],
    flavor: "Ha sconfitto la morte. Ora la usa come arma.",
  },

  /* ════════════════════════════════════════════════════════
     ── SPELL CARDS (📜) ────────────────────────────────────
     One-shot effects, then to the graveyard. No HP/ATK; the
     `effect` object tells the engine what happens, and
     `effect.target` whether the player must pick a victim
     before casting. Pulled into packs by the same rarity
     filter as creatures, so they appear naturally in
     element packs.
     ════════════════════════════════════════════════════════ */

  /* ── FIRE 🔥 spells ───────────────────────────── */
  spell_brand: {
    id: "spell_brand", name: "Marchio Ardente", image: null, icon: "🜂",
    element: "fire", rarity: "common", cost: 2, mana: { fire: 2 }, type: "spell",
    effect: { kind: "burn_champion", x: 3 },
    flavor: "Una runa di fuoco incisa nell'anima del nemico.",
  },
  spell_fireball: {
    id: "spell_fireball", name: "Palla di Fuoco", image: null, icon: "🔥",
    element: "fire", rarity: "rare", cost: 4, mana: { fire: 3, any: 1 }, type: "spell",
    effect: { kind: "damage", amount: 4, target: "any" },
    flavor: "Tre parole. Una pira. Mille rimpianti per chi è troppo vicino.",
  },
  spell_infernalblast: {
    id: "spell_infernalblast", name: "Vampata Infernale", image: null, icon: "🌋",
    element: "fire", rarity: "epic", cost: 6, mana: { fire: 5, any: 1 }, type: "spell",
    effect: { kind: "aoe", amount: 3 },
    flavor: "Il cielo si fa cenere. Le creature nemiche bruciano insieme.",
  },

  /* ── WATER 💧 spells ──────────────────────────── */
  spell_curewounds: {
    id: "spell_curewounds", name: "Cura Ferite", image: null, icon: "💧",
    element: "water", rarity: "common", cost: 1, mana: { water: 1 }, type: "spell",
    effect: { kind: "heal_champion", amount: 5 },
    flavor: "Un'onda gentile chiude la carne strappata.",
  },
  spell_undertow: {
    id: "spell_undertow", name: "Riflusso", image: null, icon: "🌀",
    element: "water", rarity: "common", cost: 2, mana: { water: 2 }, type: "spell",
    effect: { kind: "bounce", target: "enemy_creature" },
    flavor: "L'onda risucchia, e la creatura non era mai stata lì.",
  },
  spell_lifeflow: {
    id: "spell_lifeflow", name: "Soffio Vitale", image: null, icon: "🌊",
    element: "water", rarity: "rare", cost: 4, mana: { water: 4 }, type: "spell",
    effect: { kind: "heal_champion", amount: 8, draw: 1 },
    flavor: "Bevi dal mare interiore. Torna a vedere.",
  },

  /* ── EARTH 🌿 spells ──────────────────────────── */
  spell_stoneskin: {
    id: "spell_stoneskin", name: "Pelle di Pietra", image: null, icon: "🪨",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 2 }, type: "spell",
    effect: { kind: "buff", atk: 0, hp: 3, grants: ["bulwark"], target: "ally_creature" },
    flavor: "Una preghiera alle montagne. La tua carne ascolta.",
  },
  spell_wildgrowth: {
    id: "spell_wildgrowth", name: "Crescita Selvaggia", image: null, icon: "🌱",
    element: "earth", rarity: "rare", cost: 3, mana: { earth: 3 }, type: "spell",
    effect: { kind: "grant_keyword", keyword: "linfa", value: 2, target: "ally_creature" },
    flavor: "Le ferite si chiudono. Le radici tornano a bere.",
  },

  /* ── AIR 🌪 spells ────────────────────────────── */
  spell_bladestorm: {
    id: "spell_bladestorm", name: "Tempesta di Lame", image: null, icon: "🌪",
    element: "air", rarity: "common", cost: 2, mana: { air: 2 }, type: "spell",
    effect: { kind: "aoe_full", amount: 1 },
    flavor: "Il vento taglia tutto ciò che si erge davanti.",
  },
  spell_bolt: {
    id: "spell_bolt", name: "Folgore", image: null, icon: "⚡",
    element: "air", rarity: "rare", cost: 3, mana: { air: 3 }, type: "spell",
    effect: { kind: "damage", amount: 4, target: "any" },
    flavor: "Una colonna di luce bianca. Un odore di metallo bruciato.",
  },

  /* ── LIGHT ✨ spells ──────────────────────────── */
  spell_bless: {
    id: "spell_bless", name: "Benedizione", image: null, icon: "🙏",
    element: "light", rarity: "rare", cost: 3, mana: { light: 3 }, type: "spell",
    effect: { kind: "global_buff", atk: 1, hp: 1 },
    flavor: "Una nota suonata in alto. Ogni alleato la sente nel petto.",
  },
  spell_smite: {
    id: "spell_smite", name: "Smite Sacro", image: null, icon: "✨",
    element: "light", rarity: "rare", cost: 4, mana: { light: 3, any: 1 }, type: "spell",
    effect: { kind: "destroy", target: "enemy_creature", filter: { minAtk: 4 } },
    flavor: "Anche il colosso più alto cade sotto il giudizio di un dio.",
  },

  /* ── DARK 🌑 spells ───────────────────────────── */
  spell_dreadseal: {
    id: "spell_dreadseal", name: "Sigillo di Tenebra", image: null, icon: "🌑",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 3 }, type: "spell",
    effect: { kind: "destroy", target: "enemy_creature", filter: { maxAtk: 3 } },
    flavor: "Un nome scritto al contrario. La creatura si scioglie.",
  },
  spell_raisedead: {
    id: "spell_raisedead", name: "Animare Morti", image: null, icon: "☠",
    element: "dark", rarity: "epic", cost: 4, mana: { dark: 3, any: 1 }, type: "spell",
    effect: { kind: "raise_dead" },
    flavor: "Quel che è caduto nel tuo cimitero può ancora servire.",
  },

  /* ════════════════════════════════════════════════════════
     ── ENCHANTMENTS (🌟) ───────────────────────────────────
     One-shot cards that hand out TEMPORARY keywords or
     persistent champion effects. Differ from buff spells
     (which give permanent +stats) by being keyword-focused
     and often time-bound. Card itself goes to graveyard
     after the effect attaches.
     ════════════════════════════════════════════════════════ */

  ench_brand: {
    id: "ench_brand", name: "Marchio di Furia", image: null, icon: "🔥",
    element: "fire", rarity: "common", cost: 2, mana: { fire: 2 }, type: "enchantment",
    effect: { kind: "wake", target: "ally_creature" },
    flavor: "Un simbolo di brace incandescente. Il guerriero non aspetta più.",
  },
  ench_falconeyes: {
    id: "ench_falconeyes", name: "Sguardo del Falco", image: null, icon: "👁",
    element: "air", rarity: "common", cost: 2, mana: { air: 1, any: 1 }, type: "enchantment",
    effect: { kind: "grant_temp_keyword", keyword: "cacciatore", duration: 2, target: "ally_creature" },
    flavor: "Insegnale a guardare il cielo come fosse una preda.",
  },
  ench_spiritwings: {
    id: "ench_spiritwings", name: "Ali Spirituali", image: null, icon: "🪽",
    element: "light", rarity: "rare", cost: 3, mana: { light: 2, any: 1 }, type: "enchantment",
    effect: { kind: "grant_temp_keyword", keyword: "flying", duration: 2, target: "ally_creature" },
    flavor: "Le spalle si aprono in ali di luce. Per due albe vola.",
  },
  ench_aureole: {
    id: "ench_aureole", name: "Aureola Sacra", image: null, icon: "👑",
    element: "light", rarity: "rare", cost: 4, mana: { light: 3, any: 1 }, type: "enchantment",
    effect: { kind: "champion_regen", amount: 2 },
    flavor: "Un cerchio di luce sopra la testa. Non passa più la stanchezza.",
  },

  /* ════════════════════════════════════════════════════════
     ── COUNTERS (🛡) ───────────────────────────────────────
     Anti-magic TRAPS. Each is cast face-down to your "secrets"
     zone on your turn. It auto-triggers when its condition
     fires during opponent's actions, then resolves and goes
     to the graveyard. The opponent sees only the count of
     your secrets, not their identities.
     ════════════════════════════════════════════════════════ */

  ctr_extinguish: {
    id: "ctr_extinguish", name: "Spegnimento", image: null, icon: "💧",
    element: "water", rarity: "common", cost: 1, mana: { water: 1 }, type: "counter",
    effect: {
      kind: "secret_extinguish",
      trigger: "burn_applied",
    },
    flavor: "Una pioggia improvvisa. La maledizione di fuoco si dissolve.",
  },
  ctr_dispel: {
    id: "ctr_dispel", name: "Dissolvi Magia", image: null, icon: "🌬",
    element: "light", rarity: "rare", cost: 2, mana: { light: 1, any: 1 }, type: "counter",
    effect: {
      kind: "secret_cancel_magic",
      trigger: "enemy_magic_cast",
    },
    flavor: "Una parola antica. La magia altrui si scioglie come ghiaccio.",
  },
  ctr_arcaneward: {
    id: "ctr_arcaneward", name: "Argine Arcano", image: null, icon: "🛡",
    element: "water", rarity: "rare", cost: 3, mana: { water: 2, any: 1 }, type: "counter",
    effect: {
      kind: "secret_arcane_ward",
      trigger: "face_damage",
      amount: 5,
    },
    flavor: "Una barriera invisibile davanti al tuo campione. Cinque colpi non passeranno.",
  },
  ctr_negation: {
    id: "ctr_negation", name: "Negazione", image: null, icon: "❌",
    element: "dark", rarity: "epic", cost: 5, mana: { dark: 4, any: 1 }, type: "counter",
    effect: {
      kind: "secret_negate",
      trigger: "enemy_summon",
    },
    flavor: "Un nome cancellato dal libro del mondo. Anche un dio non basta a riscriverlo.",
  },

  /* ════════════════════════════════════════════════════════
     ── EXPANSION SET — added with the 50-card deck size.
        Each new creature uses an image from /assets/tgc_card/;
        non-creature additions use placeholder images until
        the player supplies final art (see README in repo).
     ════════════════════════════════════════════════════════ */

  /* ── FIRE 🔥 expansion ──────────────────────────────── */
  saurian: {
    id: "saurian", name: "Sauride", image: "/assets/tgc_card/saurian.png", icon: "🦎",
    element: "fire", rarity: "common", cost: 2, mana: { fire: 2 }, atk: 2, hp: 3,
    mechanics: ["surge"],
    flavor: "Caccia in muta, sputa fuoco.",
  },
  bloodwerewolf: {
    id: "bloodwerewolf", name: "Lupo Sanguinario", image: "/assets/tgc_card/bloodwerewolf.png", icon: "🐺",
    element: "fire", rarity: "rare", cost: 3, mana: { fire: 2, any: 1 }, atk: 4, hp: 3,
    mechanics: ["surge", "bruciatura"],
    mechanicsValues: { bruciatura: 1 },
    flavor: "La luna piena lo trasforma in cenere viva.",
  },
  goristro: {
    id: "goristro", name: "Goristro", image: "/assets/tgc_card/goristro.png", icon: "🐂",
    element: "fire", rarity: "epic", cost: 6, mana: { fire: 5, any: 1 }, atk: 7, hp: 5,
    mechanics: ["surge", "pierce"],
    flavor: "Ottanta tonnellate di rabbia con le corna.",
  },
  firelord: {
    id: "firelord", name: "Signore del Fuoco", image: "/assets/tgc_card/firelord.png", icon: "🔥",
    element: "fire", rarity: "epic", cost: 7, mana: { fire: 6, any: 1 }, atk: 6, hp: 8,
    mechanics: ["bulwark", "bruciatura", "cinder"],
    mechanicsValues: { bruciatura: 2 },
    flavor: "Re del cuore della fornace.",
  },
  smokemephit: {
    id: "smokemephit", name: "Mefite di Fumo", image: "/assets/tgc_card/smokemephit.png", icon: "💨",
    element: "fire", rarity: "common", cost: 1, mana: { fire: 1 }, atk: 1, hp: 2,
    mechanics: ["surge", "veil"],
    flavor: "Si dissolve nell'aria. Riappare alle tue spalle.",
  },

  /* ── WATER 💧 expansion ─────────────────────────────── */
  frostarcher: {
    id: "frostarcher", name: "Arcere di Ghiaccio", image: "/assets/tgc_card/frostarcher.png", icon: "🏹",
    element: "water", rarity: "common", cost: 2, mana: { water: 1, any: 1 }, atk: 3, hp: 2,
    mechanics: ["cacciatore"],
    flavor: "Le sue frecce di ghiaccio non si sciolgono mai.",
  },
  whitedragon: {
    id: "whitedragon", name: "Drago Bianco", image: "/assets/tgc_card/whitedragon.png", icon: "🐉",
    element: "water", rarity: "rare", cost: 4, mana: { water: 3, any: 1 }, atk: 4, hp: 4,
    mechanics: ["surge", "flying"],
    flavor: "Drago bianco del nord. Il suo respiro congela il fuoco.",
  },
  frostgiant: {
    id: "frostgiant", name: "Gigante del Gelo", image: "/assets/tgc_card/frostgiant.png", icon: "❄",
    element: "water", rarity: "epic", cost: 5, mana: { water: 4, any: 1 }, atk: 6, hp: 6,
    mechanics: ["bulwark"],
    flavor: "Un'avalanche che cammina.",
  },
  yeti: {
    id: "yeti", name: "Yeti", image: "/assets/tgc_card/yeti.png", icon: "🦍",
    element: "water", rarity: "rare", cost: 3, mana: { water: 2, any: 1 }, atk: 4, hp: 3,
    mechanics: ["surge"],
    flavor: "Aspetta, in silenzio, finché qualcuno non si avvicina.",
  },
  winterwolf: {
    id: "winterwolf", name: "Lupo d'Inverno", image: "/assets/tgc_card/winterwolf.png", icon: "🐺",
    element: "water", rarity: "common", cost: 2, mana: { water: 2 }, atk: 2, hp: 3,
    mechanics: ["surge", "cinder"],
    flavor: "Caccia tra le nevi. Il suo respiro è bianca morte.",
  },

  /* ── EARTH 🌿 expansion ─────────────────────────────── */
  dryad: {
    id: "dryad", name: "Driade", image: "/assets/tgc_card/dryad.png", icon: "🌳",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 2 }, atk: 1, hp: 4,
    mechanics: ["veil", "linfa"],
    mechanicsValues: { linfa: 1 },
    flavor: "Custode delle querce. Sparisce tra le foglie.",
  },
  bugbear: {
    id: "bugbear", name: "Bugbear", image: "/assets/tgc_card/bugbear.png", icon: "👹",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 1, any: 1 }, atk: 3, hp: 2,
    mechanics: ["surge"],
    flavor: "Robusto. Lento. Letale.",
  },
  autumntreant: {
    id: "autumntreant", name: "Treant d'Autunno", image: "/assets/tgc_card/autumntreant.png", icon: "🍂",
    element: "earth", rarity: "rare", cost: 4, mana: { earth: 3, any: 1 }, atk: 3, hp: 6,
    mechanics: ["bulwark", "linfa"],
    mechanicsValues: { linfa: 1 },
    flavor: "Le sue foglie cadono in autunno. Lui non cade mai.",
  },
  greentreant: {
    id: "greentreant", name: "Treant Verde", image: "/assets/tgc_card/greentreant.png", icon: "🌲",
    element: "earth", rarity: "epic", cost: 5, mana: { earth: 4, any: 1 }, atk: 4, hp: 8,
    mechanics: ["bulwark", "linfa"],
    mechanicsValues: { linfa: 2 },
    flavor: "Antico signore del bosco.",
  },
  stonegiant: {
    id: "stonegiant", name: "Gigante di Pietra", image: "/assets/tgc_card/stonegiant.png", icon: "⛰",
    element: "earth", rarity: "epic", cost: 6, mana: { earth: 5, any: 1 }, atk: 6, hp: 7,
    mechanics: ["bulwark", "pierce"],
    flavor: "Una montagna in marcia.",
  },
  owlbear: {
    id: "owlbear", name: "Gufo-Orso", image: "/assets/tgc_card/owlbear.png", icon: "🦉",
    element: "earth", rarity: "rare", cost: 3, mana: { earth: 2, any: 1 }, atk: 4, hp: 3,
    mechanics: ["surge", "pierce"],
    flavor: "Becchio d'aquila, mole d'orso. Cattivo carattere.",
  },
  greendragon: {
    id: "greendragon", name: "Drago Verde", image: "/assets/tgc_card/greendragon.png", icon: "🐲",
    element: "earth", rarity: "epic", cost: 7, mana: { earth: 6, any: 1 }, atk: 7, hp: 8,
    mechanics: ["pierce", "flying", "linfa"],
    mechanicsValues: { linfa: 1 },
    flavor: "Drago del giardino del mondo. Le sue ali sono foglie.",
  },

  /* ── AIR 🌪 expansion ───────────────────────────────── */
  axebeak: {
    id: "axebeak", name: "Becco d'Ascia", image: "/assets/tgc_card/axebeak.png", icon: "🦅",
    element: "air", rarity: "common", cost: 2, mana: { air: 1, any: 1 }, atk: 3, hp: 1,
    mechanics: ["surge", "flying"],
    flavor: "Un becco grande quanto un'ascia. Si vede da lontano.",
  },
  kenku: {
    id: "kenku", name: "Kenku", image: "/assets/tgc_card/kenku.png", icon: "🐦",
    element: "air", rarity: "common", cost: 1, mana: { air: 1 }, atk: 1, hp: 2,
    mechanics: ["flying"],
    flavor: "Imita ogni voce. Mai la propria.",
  },
  windwraith: {
    id: "windwraith", name: "Spettro del Vento", image: "/assets/tgc_card/windwraith.png", icon: "🌫",
    element: "air", rarity: "rare", cost: 3, mana: { air: 2, any: 1 }, atk: 4, hp: 2,
    mechanics: ["surge", "flying", "veil"],
    flavor: "Vento che ha imparato a portare rancore.",
  },
  icemephit: {
    id: "icemephit", name: "Mefite di Ghiaccio", image: "/assets/tgc_card/icemephit.png", icon: "🧊",
    element: "air", rarity: "common", cost: 1, mana: { air: 1 }, atk: 2, hp: 2,
    mechanics: ["surge", "flying"],
    flavor: "Piccolo elementale d'aria gelida. Esplode in cristalli al primo colpo.",
  },

  /* ── LIGHT ✨ expansion ─────────────────────────────── */
  centaur: {
    id: "centaur", name: "Centauro", image: "/assets/tgc_card/centaur.png", icon: "🏃",
    element: "light", rarity: "common", cost: 2, mana: { light: 2 }, atk: 3, hp: 2,
    mechanics: ["surge", "cacciatore"],
    flavor: "Veloce come il vento, dritto come una freccia.",
  },
  naga: {
    id: "naga", name: "Naga", image: "/assets/tgc_card/naga.png", icon: "🐍",
    element: "light", rarity: "rare", cost: 4, mana: { light: 3, any: 1 }, atk: 3, hp: 5,
    mechanics: ["soulburn", "vanguard"],
    flavor: "Saggia regina serpente. La sua aura è giudizio.",
  },
  halfdragon: {
    id: "halfdragon", name: "Mezzo-Drago", image: "/assets/tgc_card/halfdragon.png", icon: "🐲",
    element: "light", rarity: "epic", cost: 5, mana: { light: 4, any: 1 }, atk: 5, hp: 5,
    mechanics: ["soulburn", "vanguard", "flying"],
    flavor: "Mezzo umano, mezzo drago. Tutta gloria.",
  },

  /* ── DARK 🌑 expansion ──────────────────────────────── */
  quasit: {
    id: "quasit", name: "Quasit", image: "/assets/tgc_card/quasit.png", icon: "🦇",
    element: "dark", rarity: "common", cost: 1, mana: { dark: 1 }, atk: 1, hp: 2,
    mechanics: ["surge"],
    flavor: "Demone tascabile. Non ti accorgi mai del primo.",
  },
  goblin: {
    id: "goblin", name: "Goblin", image: "/assets/tgc_card/goblin.png", icon: "👺",
    element: "dark", rarity: "common", cost: 1, mana: { dark: 1 }, atk: 2, hp: 1,
    mechanics: ["surge"],
    flavor: "Piccolo, cattivo, ride troppo.",
  },
  kobold: {
    id: "kobold", name: "Coboldo", image: "/assets/tgc_card/kobold.png", icon: "🦎",
    element: "dark", rarity: "common", cost: 1, mana: { dark: 1 }, atk: 1, hp: 2,
    mechanics: ["cinder"],
    flavor: "Sa esattamente dove non vorresti che si nascondesse.",
  },
  orc: {
    id: "orc", name: "Orco", image: "/assets/tgc_card/orc.png", icon: "👹",
    element: "dark", rarity: "common", cost: 2, mana: { dark: 2 }, atk: 3, hp: 2,
    mechanics: ["surge"],
    flavor: "Carica e basta.",
  },
  succubus: {
    id: "succubus", name: "Succubus", image: "/assets/tgc_card/succubus.png", icon: "👿",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 2, any: 1 }, atk: 2, hp: 4,
    mechanics: ["soulburn", "veil"],
    flavor: "Sussurra promesse. Sussurra fine.",
  },
  wendigo: {
    id: "wendigo", name: "Wendigo", image: "/assets/tgc_card/wendigo.png", icon: "🐺",
    element: "dark", rarity: "rare", cost: 4, mana: { dark: 3, any: 1 }, atk: 4, hp: 3,
    mechanics: ["cinder", "soulburn"],
    flavor: "Cammina nell'inverno per sempre.",
  },
  medusa: {
    id: "medusa", name: "Medusa", image: "/assets/tgc_card/medusa.png", icon: "🐍",
    element: "dark", rarity: "epic", cost: 5, mana: { dark: 4, any: 1 }, atk: 3, hp: 6,
    mechanics: ["reckon", "soulburn"],
    flavor: "Il suo sguardo è una sentenza di pietra.",
  },
  nighthag: {
    id: "nighthag", name: "Strega della Notte", image: "/assets/tgc_card/nighthag.png", icon: "🧙",
    element: "dark", rarity: "epic", cost: 5, mana: { dark: 4, any: 1 }, atk: 4, hp: 5,
    mechanics: ["soulburn", "veil"],
    flavor: "Ti raggiunge nei sogni. Si ferma quando sei morto.",
  },

  /* ════════════════════════════════════════════════════════
     ── EXPANSION SPELLS / AURAS / COUNTERS ─────────────────
     The expansion set widens deck-building options. Their
     `image` fields point to placeholder filenames you'll
     supply later — the cards render with their emoji icon
     until the real image lands at /assets/tgc_card/.
     ════════════════════════════════════════════════════════ */

  spell_thunderstrike: {
    id: "spell_thunderstrike", name: "Folgore Tonante", image: "/assets/tgc_card/placeholder_thunderstrike.png", icon: "⚡",
    element: "air", rarity: "rare", cost: 4, mana: { air: 3, any: 1 }, type: "spell",
    effect: { kind: "damage", amount: 5, target: "any" },
    flavor: "Il cielo non perdona chi vola troppo in alto.",
  },
  spell_earthsplit: {
    id: "spell_earthsplit", name: "Spaccatura Tellurica", image: "/assets/tgc_card/placeholder_earthsplit.png", icon: "🌍",
    element: "earth", rarity: "epic", cost: 5, mana: { earth: 4, any: 1 }, type: "spell",
    effect: { kind: "aoe", amount: 2 },
    flavor: "La terra si apre. Le creature in piedi cadono.",
  },
  spell_blacksun: {
    id: "spell_blacksun", name: "Sole Nero", image: "/assets/tgc_card/placeholder_blacksun.png", icon: "🌑",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 3 }, type: "spell",
    effect: { kind: "destroy", target: "enemy_creature", filter: { maxAtk: 4 } },
    flavor: "Un'eclissi che non finisce. Le creature deboli si dissolvono.",
  },
  spell_holylight: {
    id: "spell_holylight", name: "Luce Sacra", image: "/assets/tgc_card/placeholder_holylight.png", icon: "🌟",
    element: "light", rarity: "rare", cost: 3, mana: { light: 3 }, type: "spell",
    effect: { kind: "heal_champion", amount: 6, draw: 1 },
    flavor: "Un raggio di sole filtrato dal divino. Cura e illumina.",
  },
  ench_shieldofdawn: {
    id: "ench_shieldofdawn", name: "Scudo dell'Alba", image: "/assets/tgc_card/placeholder_shieldofdawn.png", icon: "🛡",
    element: "light", rarity: "epic", cost: 5, mana: { light: 4, any: 1 }, type: "enchantment",
    effect: { kind: "champion_regen", amount: 3 },
    flavor: "Ogni alba ricuce le ferite del giorno prima.",
  },
  ench_bloodfrenzy: {
    id: "ench_bloodfrenzy", name: "Frenesia di Sangue", image: "/assets/tgc_card/placeholder_bloodfrenzy.png", icon: "🩸",
    element: "dark", rarity: "common", cost: 2, mana: { dark: 2 }, type: "enchantment",
    effect: { kind: "wake", target: "ally_creature" },
    flavor: "Il sangue chiama il sangue. La creatura non aspetta.",
  },
  ctr_stoneward: {
    id: "ctr_stoneward", name: "Argine di Roccia", image: "/assets/tgc_card/placeholder_stoneward.png", icon: "🪨",
    element: "earth", rarity: "rare", cost: 3, mana: { earth: 2, any: 1 }, type: "counter",
    effect: {
      kind: "secret_arcane_ward",
      trigger: "face_damage",
      amount: 4,
    },
    flavor: "Una muraglia che cresce sotto il campione.",
  },
  ctr_winterbloom: {
    id: "ctr_winterbloom", name: "Bocciolo d'Inverno", image: "/assets/tgc_card/placeholder_winterbloom.png", icon: "❄",
    element: "water", rarity: "common", cost: 1, mana: { water: 1 }, type: "counter",
    effect: {
      kind: "secret_cancel_magic",
      trigger: "enemy_magic_cast",
    },
    flavor: "Il fiore gela la magia in volo.",
  },

  /* ════════════════════════════════════════════════════════
     ── EXPANSION SET 2 — 95 new creatures from the
        /assets/tgc_card art drop. Element + rarity assigned
        based on visual theme; stats follow the standard
        formula (atk + hp ≈ 2*cost + 1 common, +1 rare,
        +2 epic, +3 legendary).
     ════════════════════════════════════════════════════════ */

  /* ── FIRE 🔥 — expansion 2 ───────────────────────── */
  bloodgoblin: {
    id: "bloodgoblin", name: "Goblin di Sangue", image: "/assets/tgc_card/bloodgoblin.png", icon: "👹",
    element: "fire", rarity: "common", cost: 2, mana: { fire: 1, any: 1 }, atk: 3, hp: 2,
    mechanics: ["surge"],
    flavor: "Ride mentre brucia. Brucia mentre ride.",
  },
  emberdwarf: {
    id: "emberdwarf", name: "Nano di Brace", image: "/assets/tgc_card/emberdwarf.png", icon: "🔥",
    element: "fire", rarity: "rare", cost: 3, mana: { fire: 2, any: 1 }, atk: 3, hp: 5,
    mechanics: ["bulwark"],
    flavor: "Le sue venature di lava reggono dieci colpi prima del primo grido.",
  },
  flametiefling: {
    id: "flametiefling", name: "Tiefling di Fiamma", image: "/assets/tgc_card/flametiefling.png", icon: "😈",
    element: "fire", rarity: "rare", cost: 3, mana: { fire: 2, any: 1 }, atk: 4, hp: 3,
    mechanics: ["surge", "bruciatura"],
    mechanicsValues: { bruciatura: 1 },
    flavor: "Una scintilla in mano è già un giuramento di vendetta.",
  },
  fireforger: {
    id: "fireforger", name: "Forgiatore di Fiamme", image: "/assets/tgc_card/fireforger.png", icon: "🛠",
    element: "fire", rarity: "rare", cost: 3, mana: { fire: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["pierce"],
    flavor: "Tempra le lame nel petto del nemico.",
  },
  goldenfiend: {
    id: "goldenfiend", name: "Demone Aureo", image: "/assets/tgc_card/goldenfiend.png", icon: "👺",
    element: "fire", rarity: "rare", cost: 4, mana: { fire: 3, any: 1 }, atk: 4, hp: 4,
    mechanics: ["cinder", "veil"],
    flavor: "Il suo riso resta nel fumo dopo che lui è andato.",
  },
  lanternwraith: {
    id: "lanternwraith", name: "Spettro delle Lanterne", image: "/assets/tgc_card/lanternwraith.png", icon: "🏮",
    element: "fire", rarity: "rare", cost: 4, mana: { fire: 3, any: 1 }, atk: 3, hp: 5,
    mechanics: ["cinder", "flying"],
    flavor: "Quando una lanterna si spegne, una sua costola si accende.",
  },
  emberbrute: {
    id: "emberbrute", name: "Bruto di Brace", image: "/assets/tgc_card/emberbrute.png", icon: "🌋",
    element: "fire", rarity: "epic", cost: 5, mana: { fire: 4, any: 1 }, atk: 6, hp: 6,
    mechanics: ["surge", "pierce"],
    flavor: "Le sue impronte restano roventi anche dopo la pioggia.",
  },
  infernospirit: {
    id: "infernospirit", name: "Spirito Infernale", image: "/assets/tgc_card/infernospirit.png", icon: "🔥",
    element: "fire", rarity: "epic", cost: 5, mana: { fire: 4, any: 1 }, atk: 5, hp: 7,
    mechanics: ["bruciatura", "cinder"],
    mechanicsValues: { bruciatura: 2 },
    flavor: "Non ha corpo. Solo voglia di bruciare.",
  },
  emberguardian: {
    id: "emberguardian", name: "Guardiano di Brace", image: "/assets/tgc_card/emberguardian.png", icon: "🛡",
    element: "fire", rarity: "epic", cost: 6, mana: { fire: 5, any: 1 }, atk: 5, hp: 9,
    mechanics: ["bulwark", "cinder"],
    flavor: "Armatura di lava. Chi colpisce, brucia con lui.",
  },
  nalfeshnee: {
    id: "nalfeshnee", name: "Nalfeshnee", image: "/assets/tgc_card/nalfeshnee.png", icon: "🐗",
    element: "fire", rarity: "epic", cost: 6, mana: { fire: 5, any: 1 }, atk: 7, hp: 7,
    mechanics: ["flying", "pierce"],
    flavor: "Più cinghiale che demone. Più demone che ragione.",
  },

  /* ── WATER 💧 — expansion 2 ──────────────────────── */
  bluegenasi: {
    id: "bluegenasi", name: "Genasi d'Acqua", image: "/assets/tgc_card/bluegenasi.png", icon: "🌊",
    element: "water", rarity: "common", cost: 2, mana: { water: 2 }, atk: 2, hp: 3,
    mechanics: ["soulburn"],
    flavor: "Le sue lacrime spengono incendi lontani.",
  },
  mudmephit: {
    id: "mudmephit", name: "Mefite di Fango", image: "/assets/tgc_card/mudmephit.png", icon: "💧",
    element: "water", rarity: "common", cost: 1, mana: { water: 1 }, atk: 1, hp: 2,
    mechanics: ["surge"],
    flavor: "Sguscia tra le dita di chi prova ad afferrarlo.",
  },
  frenzymarauder: {
    id: "frenzymarauder", name: "Predone Frenetico", image: "/assets/tgc_card/frenzymarauder.png", icon: "🪓",
    element: "water", rarity: "rare", cost: 3, mana: { water: 2, any: 1 }, atk: 4, hp: 3,
    mechanics: ["surge", "pierce"],
    flavor: "Pelle blu, sete rossa.",
  },
  frostwizard: {
    id: "frostwizard", name: "Mago di Brina", image: "/assets/tgc_card/frostwizard.png", icon: "❄",
    element: "water", rarity: "rare", cost: 3, mana: { water: 3 }, atk: 2, hp: 5,
    mechanics: ["soulburn"],
    flavor: "Il suo respiro congela le frecce a mezz'aria.",
  },
  gelatinouscube: {
    id: "gelatinouscube", name: "Cubo Gelatinoso", image: "/assets/tgc_card/gelatinouscube.png", icon: "🟦",
    element: "water", rarity: "rare", cost: 3, mana: { water: 2, any: 1 }, atk: 3, hp: 5,
    mechanics: ["bulwark"],
    flavor: "Lo trovi quando ne fai parte.",
  },
  icetomb: {
    id: "icetomb", name: "Tomba di Ghiaccio", image: "/assets/tgc_card/icetomb.png", icon: "🧊",
    element: "water", rarity: "rare", cost: 3, mana: { water: 2, any: 1 }, atk: 2, hp: 6,
    mechanics: ["bulwark", "veil"],
    flavor: "Dentro c'è ancora chi cercava di scappare.",
  },
  slimecaster: {
    id: "slimecaster", name: "Evocatore di Limo", image: "/assets/tgc_card/slimecaster.png", icon: "🫧",
    element: "water", rarity: "rare", cost: 3, mana: { water: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["soulburn"],
    flavor: "Plasma il fango come un mago plasma le rune.",
  },
  tidegolem: {
    id: "tidegolem", name: "Golem di Marea", image: "/assets/tgc_card/tidegolem.png", icon: "🌊",
    element: "water", rarity: "rare", cost: 4, mana: { water: 3, any: 1 }, atk: 4, hp: 5,
    mechanics: ["bulwark"],
    flavor: "Le onde si ricompongono dopo ogni colpo.",
  },
  bilebehemoth: {
    id: "bilebehemoth", name: "Behemot di Bile", image: "/assets/tgc_card/bilebehemoth.png", icon: "🐊",
    element: "water", rarity: "epic", cost: 5, mana: { water: 4, any: 1 }, atk: 5, hp: 7,
    mechanics: ["pierce", "soulburn"],
    flavor: "Le sue zanne secernono un veleno che cura solo lui.",
  },
  cryomancer: {
    id: "cryomancer", name: "Criomante", image: "/assets/tgc_card/cryomancer.png", icon: "🐲",
    element: "water", rarity: "epic", cost: 5, mana: { water: 4, any: 1 }, atk: 4, hp: 8,
    mechanics: ["soulburn", "vanguard"],
    flavor: "Un drago di ghiaccio gli risponde solo a sussurri.",
  },
  iceberserker: {
    id: "iceberserker", name: "Berserker di Ghiaccio", image: "/assets/tgc_card/iceberserker.png", icon: "🪓",
    element: "water", rarity: "epic", cost: 5, mana: { water: 4, any: 1 }, atk: 7, hp: 5,
    mechanics: ["surge", "pierce"],
    flavor: "Urla in un vento che lo ascolta.",
  },
  frostchieftain: {
    id: "frostchieftain", name: "Capotribù di Ghiaccio", image: "/assets/tgc_card/frostchieftain.png", icon: "🛡",
    element: "water", rarity: "epic", cost: 6, mana: { water: 5, any: 1 }, atk: 6, hp: 7,
    mechanics: ["bulwark", "vanguard"],
    flavor: "Le rune cantano quando solleva la mazza.",
  },

  /* ── EARTH 🌿 — expansion 2 ──────────────────────── */
  direwolf: {
    id: "direwolf", name: "Lupo Terribile", image: "/assets/tgc_card/direwolf.png", icon: "🐺",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 2 }, atk: 3, hp: 2,
    mechanics: ["surge"],
    flavor: "Caccia in branco. Mangia da solo.",
  },
  fungalhermit: {
    id: "fungalhermit", name: "Eremita Fungino", image: "/assets/tgc_card/fungalhermit.png", icon: "🍄",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 2 }, atk: 1, hp: 4,
    mechanics: ["bulwark"],
    flavor: "Cresce dove la luce muore.",
  },
  gnoll: {
    id: "gnoll", name: "Gnoll", image: "/assets/tgc_card/gnoll.png", icon: "🐕",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 1, any: 1 }, atk: 3, hp: 2,
    mechanics: ["surge"],
    flavor: "Ride mentre divora. Divora mentre ride.",
  },
  goblinblade: {
    id: "goblinblade", name: "Goblin Lama", image: "/assets/tgc_card/goblinblade.png", icon: "🗡",
    element: "earth", rarity: "common", cost: 1, mana: { earth: 1 }, atk: 2, hp: 1,
    mechanics: ["surge"],
    flavor: "Più lame che dita.",
  },
  goblinscout: {
    id: "goblinscout", name: "Goblin Esploratore", image: "/assets/tgc_card/goblinscout.png", icon: "👁",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 1, any: 1 }, atk: 2, hp: 3,
    mechanics: ["cacciatore"],
    flavor: "Vede prima, fugge prima, riferisce prima.",
  },
  halforc: {
    id: "halforc", name: "Mezz'Orco", image: "/assets/tgc_card/halforc.png", icon: "🪓",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 1, any: 1 }, atk: 3, hp: 3,
    mechanics: ["surge"],
    flavor: "Due sangui, una rabbia.",
  },
  lizardfolk: {
    id: "lizardfolk", name: "Uomo Lucertola", image: "/assets/tgc_card/lizardfolk.png", icon: "🦎",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 2 }, atk: 2, hp: 4,
    mechanics: ["bulwark"],
    flavor: "Le sue scaglie si ricompongono come la palude.",
  },
  mossreaver: {
    id: "mossreaver", name: "Predatore di Muschio", image: "/assets/tgc_card/mossreaver.png", icon: "🌱",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 1, any: 1 }, atk: 2, hp: 4,
    mechanics: ["bulwark"],
    flavor: "Il muschio mangia ciò che il bosco abbandona.",
  },
  ochrejelly: {
    id: "ochrejelly", name: "Gelatina Ocra", image: "/assets/tgc_card/ochrejelly.png", icon: "🟡",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 2 }, atk: 1, hp: 5,
    mechanics: ["bulwark"],
    flavor: "Si divide a metà, e poi a metà ancora.",
  },
  quaggoth: {
    id: "quaggoth", name: "Quaggoth", image: "/assets/tgc_card/quaggoth.png", icon: "🦍",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 2 }, atk: 3, hp: 3,
    mechanics: [],
    flavor: "Selvaggio sotto la pietra, paziente nell'agguato.",
  },
  rust: {
    id: "rust", name: "Mostro della Ruggine", image: "/assets/tgc_card/rust.png", icon: "🪲",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 1, any: 1 }, atk: 2, hp: 3,
    mechanics: ["reckon"],
    flavor: "Mangia il metallo come noi il pane.",
  },
  sporekeeper: {
    id: "sporekeeper", name: "Custode delle Spore", image: "/assets/tgc_card/sporekeeper.png", icon: "🍄",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 2 }, atk: 2, hp: 4,
    mechanics: ["linfa"],
    flavor: "Le spore ascoltano. Il bosco ricorda.",
  },
  whiteorc: {
    id: "whiteorc", name: "Orco Pallido", image: "/assets/tgc_card/whiteorc.png", icon: "🪓",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 1, any: 1 }, atk: 3, hp: 2,
    mechanics: ["surge"],
    flavor: "I clan del ghiaccio lo temono. Anche gli orchi.",
  },
  greenhag: {
    id: "greenhag", name: "Megera Verde", image: "/assets/tgc_card/greenhag.png", icon: "🧙",
    element: "earth", rarity: "rare", cost: 3, mana: { earth: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["soulburn"],
    flavor: "Sa il tuo nome. Sa anche come piangerà tua madre.",
  },
  greenwyrmling: {
    id: "greenwyrmling", name: "Cucciolo di Drago Verde", image: "/assets/tgc_card/greenwyrmling.png", icon: "🐲",
    element: "earth", rarity: "rare", cost: 3, mana: { earth: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["flying"],
    flavor: "Già astuto come un drago. Già crudele come un drago.",
  },
  leafmother: {
    id: "leafmother", name: "Madre delle Foglie", image: "/assets/tgc_card/leafmother.png", icon: "🍃",
    element: "earth", rarity: "rare", cost: 4, mana: { earth: 3, any: 1 }, atk: 3, hp: 6,
    mechanics: ["bulwark", "linfa"],
    flavor: "Quando piange, i boschi nascono.",
  },
  leafwarden: {
    id: "leafwarden", name: "Custode delle Foglie", image: "/assets/tgc_card/leafwarden.png", icon: "🍂",
    element: "earth", rarity: "rare", cost: 3, mana: { earth: 2, any: 1 }, atk: 4, hp: 4,
    mechanics: ["vanguard"],
    flavor: "L'armatura sboccia con lui.",
  },
  ogrebrothers: {
    id: "ogrebrothers", name: "Fratelli Orchi", image: "/assets/tgc_card/ogrebrothers.png", icon: "👬",
    element: "earth", rarity: "rare", cost: 4, mana: { earth: 3, any: 1 }, atk: 5, hp: 4,
    mechanics: ["surge"],
    flavor: "Due crani, una clava sola. Funziona.",
  },
  orcbarbarian: {
    id: "orcbarbarian", name: "Orco Barbaro", image: "/assets/tgc_card/orcbarbarian.png", icon: "🪓",
    element: "earth", rarity: "rare", cost: 3, mana: { earth: 2, any: 1 }, atk: 4, hp: 3,
    mechanics: ["surge", "pierce"],
    flavor: "La furia gli arriva prima della parola.",
  },
  palebrute: {
    id: "palebrute", name: "Bruto Pallido", image: "/assets/tgc_card/palebrute.png", icon: "💀",
    element: "earth", rarity: "rare", cost: 4, mana: { earth: 3, any: 1 }, atk: 4, hp: 5,
    mechanics: ["bulwark"],
    flavor: "Il sole gli fa male più della spada.",
  },
  scalewarlord: {
    id: "scalewarlord", name: "Signore di Scaglie", image: "/assets/tgc_card/scalewarlord.png", icon: "🛡",
    element: "earth", rarity: "rare", cost: 4, mana: { earth: 3, any: 1 }, atk: 4, hp: 5,
    mechanics: ["vanguard"],
    flavor: "Le sue scaglie ricordano ogni colpo che hanno deviato.",
  },
  stonebrute: {
    id: "stonebrute", name: "Bruto di Pietra", image: "/assets/tgc_card/stonebrute.png", icon: "🪨",
    element: "earth", rarity: "rare", cost: 4, mana: { earth: 3, any: 1 }, atk: 5, hp: 4,
    mechanics: ["pierce"],
    flavor: "Il martello arriva sempre prima della richiesta di tregua.",
  },
  wargoblin: {
    id: "wargoblin", name: "Goblin di Guerra", image: "/assets/tgc_card/wargoblin.png", icon: "⚔",
    element: "earth", rarity: "rare", cost: 3, mana: { earth: 2, any: 1 }, atk: 4, hp: 3,
    mechanics: ["surge"],
    flavor: "Due bocche, doppia rabbia.",
  },
  warmonk: {
    id: "warmonk", name: "Monaco Guerriero", image: "/assets/tgc_card/warmonk.png", icon: "🥋",
    element: "earth", rarity: "rare", cost: 3, mana: { earth: 2, any: 1 }, atk: 4, hp: 4,
    mechanics: ["vanguard"],
    flavor: "Le sue cicatrici sono mappe di battaglie vinte in silenzio.",
  },
  wildhunter: {
    id: "wildhunter", name: "Cacciatrice Selvaggia", image: "/assets/tgc_card/wildhunter.png", icon: "🏹",
    element: "earth", rarity: "rare", cost: 3, mana: { earth: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["cacciatore"],
    flavor: "La preda non sa di esserlo finché non vola la freccia.",
  },
  wilddruid: {
    id: "wilddruid", name: "Druido Selvaggio", image: "/assets/tgc_card/wilddruid.png", icon: "🌿",
    element: "earth", rarity: "rare", cost: 4, mana: { earth: 3, any: 1 }, atk: 3, hp: 6,
    mechanics: ["linfa", "veil"],
    flavor: "Le radici lo riconoscono. Il vento gli risponde.",
  },
  autumnshade: {
    id: "autumnshade", name: "Ombra d'Autunno", image: "/assets/tgc_card/autumnshade.png", icon: "🍁",
    element: "earth", rarity: "rare", cost: 4, mana: { earth: 3, any: 1 }, atk: 4, hp: 5,
    mechanics: ["bulwark", "linfa"],
    flavor: "Quando le foglie cadono, lui si alza.",
  },
  deadtreant: {
    id: "deadtreant", name: "Treant Morto", image: "/assets/tgc_card/deadtreant.png", icon: "🌳",
    element: "earth", rarity: "epic", cost: 5, mana: { earth: 4, any: 1 }, atk: 5, hp: 7,
    mechanics: ["bulwark", "cinder"],
    flavor: "Anche da morto, il bosco vuole vendetta.",
  },
  fomorian: {
    id: "fomorian", name: "Fomoriano", image: "/assets/tgc_card/fomorian.png", icon: "👹",
    element: "earth", rarity: "epic", cost: 6, mana: { earth: 5, any: 1 }, atk: 7, hp: 6,
    mechanics: ["pierce", "soulburn"],
    flavor: "L'occhio storto vede la morte degli altri.",
  },
  troll: {
    id: "troll", name: "Troll", image: "/assets/tgc_card/troll.png", icon: "🧌",
    element: "earth", rarity: "epic", cost: 5, mana: { earth: 4, any: 1 }, atk: 5, hp: 8,
    mechanics: ["veil", "linfa"],
    flavor: "Tagliagli un braccio. Ricresce, più cattivo.",
  },

  /* ── AIR 🌪 — expansion 2 ────────────────────────── */
  boneranger: {
    id: "boneranger", name: "Ranger d'Ossa", image: "/assets/tgc_card/boneranger.png", icon: "🏹",
    element: "air", rarity: "common", cost: 2, mana: { air: 1, any: 1 }, atk: 2, hp: 3,
    mechanics: ["cacciatore"],
    flavor: "L'arco è sopravvissuto al suo arciere.",
  },
  aarakocra: {
    id: "aarakocra", name: "Aarakocra", image: "/assets/tgc_card/aarakocra.png", icon: "🪶",
    element: "air", rarity: "rare", cost: 3, mana: { air: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["flying", "vanguard"],
    flavor: "Nobile del cielo, nemico di chi cammina.",
  },
  phasespider: {
    id: "phasespider", name: "Ragno Spostatore", image: "/assets/tgc_card/phasespider.png", icon: "🕷",
    element: "air", rarity: "rare", cost: 3, mana: { air: 2, any: 1 }, atk: 3, hp: 3,
    mechanics: ["veil", "reckon"],
    flavor: "Era qui un istante fa. Eppure non era qui.",
  },
  archmage: {
    id: "archmage", name: "Arcimago", image: "/assets/tgc_card/archmage.png", icon: "🧙",
    element: "air", rarity: "epic", cost: 5, mana: { air: 4, any: 1 }, atk: 4, hp: 8,
    mechanics: ["soulburn", "vanguard"],
    flavor: "Conosce mille incantesimi. Ne usa due.",
  },
  ravenknight: {
    id: "ravenknight", name: "Cavaliere Corvo", image: "/assets/tgc_card/ravenknight.png", icon: "🦅",
    element: "air", rarity: "epic", cost: 5, mana: { air: 4, any: 1 }, atk: 6, hp: 6,
    mechanics: ["flying", "pierce"],
    flavor: "Le piume nere segnano il cielo prima della tempesta.",
  },
  stormmage: {
    id: "stormmage", name: "Mago di Tempesta", image: "/assets/tgc_card/stormmage.png", icon: "⚡",
    element: "air", rarity: "epic", cost: 5, mana: { air: 4, any: 1 }, atk: 5, hp: 7,
    mechanics: ["pierce", "vanguard"],
    flavor: "Sotto i suoi occhi i fulmini scelgono dove cadere.",
  },

  /* ── LIGHT ✨ — expansion 2 ──────────────────────── */
  ancientsage: {
    id: "ancientsage", name: "Saggio Antico", image: "/assets/tgc_card/ancientsage.png", icon: "🧓",
    element: "light", rarity: "rare", cost: 3, mana: { light: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["veil"],
    flavor: "Ha vissuto due imperi. Ne ricorda solo i nomi.",
  },
  blindseer: {
    id: "blindseer", name: "Veggente Cieco", image: "/assets/tgc_card/blindseer.png", icon: "🔮",
    element: "light", rarity: "rare", cost: 3, mana: { light: 2, any: 1 }, atk: 2, hp: 5,
    mechanics: ["soulburn"],
    flavor: "Non vede il sole. Vede te dietro il sole.",
  },
  harengonknight: {
    id: "harengonknight", name: "Cavaliere Harengon", image: "/assets/tgc_card/harengonknight.png", icon: "🐰",
    element: "light", rarity: "rare", cost: 3, mana: { light: 2, any: 1 }, atk: 4, hp: 4,
    mechanics: ["surge", "veil"],
    flavor: "Salta dove gli scudi non arrivano.",
  },
  lunarwolf: {
    id: "lunarwolf", name: "Lupo Lunare", image: "/assets/tgc_card/lunarwolf.png", icon: "🌕",
    element: "light", rarity: "rare", cost: 3, mana: { light: 2, any: 1 }, atk: 4, hp: 3,
    mechanics: ["surge"],
    flavor: "Le rune sulla pelliccia brillano alla luna piena.",
  },
  radiantspirit: {
    id: "radiantspirit", name: "Spirito Radiante", image: "/assets/tgc_card/radiantspirit.png", icon: "✨",
    element: "light", rarity: "rare", cost: 4, mana: { light: 3, any: 1 }, atk: 3, hp: 6,
    mechanics: ["soulburn", "veil"],
    flavor: "Tornato dall'aldilà per finire la preghiera che non finì.",
  },
  sunmage: {
    id: "sunmage", name: "Mago del Sole", image: "/assets/tgc_card/sunmage.png", icon: "☀",
    element: "light", rarity: "rare", cost: 3, mana: { light: 3 }, atk: 3, hp: 4,
    mechanics: ["soulburn"],
    flavor: "Ogni raggio è una preghiera trasformata in arma.",
  },
  angelicwarrior: {
    id: "angelicwarrior", name: "Guerriero Angelico", image: "/assets/tgc_card/angelicwarrior.png", icon: "😇",
    element: "light", rarity: "epic", cost: 5, mana: { light: 4, any: 1 }, atk: 5, hp: 7,
    mechanics: ["vanguard", "soulburn"],
    flavor: "L'ala destra è scudo. La sinistra, sentenza.",
  },
  dragonborn: {
    id: "dragonborn", name: "Dragonide", image: "/assets/tgc_card/dragonborn.png", icon: "🐉",
    element: "light", rarity: "epic", cost: 5, mana: { light: 4, any: 1 }, atk: 6, hp: 6,
    mechanics: ["surge", "pierce"],
    flavor: "Le squame bianche ricordano cieli più puri.",
  },
  dwarfpaladin: {
    id: "dwarfpaladin", name: "Paladino Nano", image: "/assets/tgc_card/dwarfpaladin.png", icon: "⚒",
    element: "light", rarity: "epic", cost: 5, mana: { light: 4, any: 1 }, atk: 5, hp: 8,
    mechanics: ["bulwark", "soulburn"],
    flavor: "La sua barba ha visto cadere tre re. Lui no.",
  },
  horneddiviner: {
    id: "horneddiviner", name: "Divinatore Cornuto", image: "/assets/tgc_card/horneddiviner.png", icon: "☀",
    element: "light", rarity: "epic", cost: 6, mana: { light: 5, any: 1 }, atk: 6, hp: 8,
    mechanics: ["soulburn", "vanguard"],
    flavor: "Le corna toccano il sole quando alza il bastone.",
  },
  lightpaladin: {
    id: "lightpaladin", name: "Paladino di Luce", image: "/assets/tgc_card/lightpaladin.png", icon: "⚔",
    element: "light", rarity: "epic", cost: 5, mana: { light: 4, any: 1 }, atk: 5, hp: 8,
    mechanics: ["bulwark", "vanguard"],
    flavor: "L'armatura canta l'inno prima di lui.",
  },
  featheredseraph: {
    id: "featheredseraph", name: "Serafino Piumato", image: "/assets/tgc_card/featheredseraph.png", icon: "🪽",
    element: "light", rarity: "legendary", cost: 8, mana: { light: 7, any: 1 }, atk: 7, hp: 11,
    mechanics: ["flying", "soulburn", "vanguard"],
    flavor: "Le sue piume cadono solo nei sogni dei giusti.",
  },

  /* ── DARK 🌑 — expansion 2 ───────────────────────── */
  deathdog: {
    id: "deathdog", name: "Cane della Morte", image: "/assets/tgc_card/deathdog.png", icon: "🐕",
    element: "dark", rarity: "common", cost: 2, mana: { dark: 1, any: 1 }, atk: 3, hp: 2,
    mechanics: ["surge"],
    flavor: "Due teste, una sola fame.",
  },
  grell: {
    id: "grell", name: "Grell", image: "/assets/tgc_card/grell.png", icon: "🐙",
    element: "dark", rarity: "common", cost: 2, mana: { dark: 1, any: 1 }, atk: 2, hp: 3,
    mechanics: ["flying"],
    flavor: "Un cervello con artigli. Difficile da convincere.",
  },
  nothic: {
    id: "nothic", name: "Nothic", image: "/assets/tgc_card/nothic.png", icon: "👁",
    element: "dark", rarity: "common", cost: 2, mana: { dark: 2 }, atk: 2, hp: 3,
    mechanics: ["reckon"],
    flavor: "Vede dentro di te ciò che tu non vuoi guardare.",
  },
  braineater: {
    id: "braineater", name: "Mangia-Mente", image: "/assets/tgc_card/braineater.png", icon: "🧠",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["soulburn"],
    flavor: "Il banchetto è sempre interiore.",
  },
  boneconjurer: {
    id: "boneconjurer", name: "Evocatore d'Ossa", image: "/assets/tgc_card/boneconjurer.png", icon: "💀",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["veil"],
    flavor: "I morti gli rispondono. Anche quando lui smette di chiedere.",
  },
  jackalwere: {
    id: "jackalwere", name: "Sciacallo-Mannaro", image: "/assets/tgc_card/jackalwere.png", icon: "🐺",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 2, any: 1 }, atk: 4, hp: 3,
    mechanics: ["surge"],
    flavor: "Sorride come uomo. Mangia come bestia.",
  },
  lamia: {
    id: "lamia", name: "Lamia", image: "/assets/tgc_card/lamia.png", icon: "🐍",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["soulburn"],
    flavor: "Una maledizione su due gambe. E quattro.",
  },
  minotaurskeleton: {
    id: "minotaurskeleton", name: "Scheletro Minotauro", image: "/assets/tgc_card/minotaurskeleton.png", icon: "💀",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 2, any: 1 }, atk: 4, hp: 4,
    mechanics: ["pierce"],
    flavor: "Anche da morto, segue il filo del labirinto.",
  },
  ogrezombie: {
    id: "ogrezombie", name: "Zombie Ogre", image: "/assets/tgc_card/ogrezombie.png", icon: "🧟",
    element: "dark", rarity: "rare", cost: 4, mana: { dark: 3, any: 1 }, atk: 5, hp: 4,
    mechanics: ["veil"],
    flavor: "Più carne di quanta morte ne possa contenere.",
  },
  shadowfiend: {
    id: "shadowfiend", name: "Demone d'Ombra", image: "/assets/tgc_card/shadowfiend.png", icon: "👤",
    element: "dark", rarity: "rare", cost: 4, mana: { dark: 3, any: 1 }, atk: 4, hp: 5,
    mechanics: ["soulburn", "veil"],
    flavor: "L'ombra che non torna dietro di te.",
  },
  skeletonmage: {
    id: "skeletonmage", name: "Mago Scheletrico", image: "/assets/tgc_card/skeletonmage.png", icon: "💀",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 3 }, atk: 3, hp: 4,
    mechanics: ["veil"],
    flavor: "L'incantesimo lo regge in piedi più della sua spina dorsale.",
  },
  soulwraith: {
    id: "soulwraith", name: "Spettro d'Anima", image: "/assets/tgc_card/soulwraith.png", icon: "👻",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["flying", "soulburn"],
    flavor: "Risucchia l'ultimo respiro come fosse vino.",
  },
  spectator: {
    id: "spectator", name: "Spettatore", image: "/assets/tgc_card/spectator.png", icon: "👁",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["flying"],
    flavor: "Quattro occhi, un giuramento.",
  },
  wraithpriest: {
    id: "wraithpriest", name: "Sacerdote Spettro", image: "/assets/tgc_card/wraithpriest.png", icon: "🕯",
    element: "dark", rarity: "rare", cost: 4, mana: { dark: 3, any: 1 }, atk: 3, hp: 6,
    mechanics: ["soulburn"],
    flavor: "Le sue preghiere risvegliano ciò che non avrebbe dovuto dormire.",
  },
  yuanti: {
    id: "yuanti", name: "Yuan-Ti", image: "/assets/tgc_card/yuanti.png", icon: "🐍",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["soulburn"],
    flavor: "Mezzo uomo, mezzo serpente, tutto veleno.",
  },
  deathknight: {
    id: "deathknight", name: "Cavaliere della Morte", image: "/assets/tgc_card/deathknight.png", icon: "⚔",
    element: "dark", rarity: "epic", cost: 5, mana: { dark: 4, any: 1 }, atk: 5, hp: 7,
    mechanics: ["pierce", "veil"],
    flavor: "Il giuramento lo regge in piedi più della corazza.",
  },
  deathslaad: {
    id: "deathslaad", name: "Slaad della Morte", image: "/assets/tgc_card/deathslaad.png", icon: "🐸",
    element: "dark", rarity: "epic", cost: 5, mana: { dark: 4, any: 1 }, atk: 6, hp: 6,
    mechanics: ["surge", "reckon"],
    flavor: "Il caos ha trovato un servo. E un coltello.",
  },
  mummylord: {
    id: "mummylord", name: "Mummia Signora", image: "/assets/tgc_card/mummylord.png", icon: "🪦",
    element: "dark", rarity: "epic", cost: 5, mana: { dark: 4, any: 1 }, atk: 5, hp: 7,
    mechanics: ["bruciatura", "veil"],
    mechanicsValues: { bruciatura: 2 },
    flavor: "Le sue bende ardono di una rabbia che la morte non spense.",
  },
  oni: {
    id: "oni", name: "Oni", image: "/assets/tgc_card/oni.png", icon: "👹",
    element: "dark", rarity: "epic", cost: 5, mana: { dark: 4, any: 1 }, atk: 6, hp: 6,
    mechanics: ["surge", "veil"],
    flavor: "Mangia bambini. Sussurra in cinque lingue diverse.",
  },
  ultroloth: {
    id: "ultroloth", name: "Ultroloth", image: "/assets/tgc_card/ultroloth.png", icon: "😈",
    element: "dark", rarity: "epic", cost: 6, mana: { dark: 5, any: 1 }, atk: 6, hp: 7,
    mechanics: ["soulburn", "vanguard"],
    flavor: "Generale di un'armata senza terra. Solo cataste di anime.",
  },
  youngblackdragon: {
    id: "youngblackdragon", name: "Drago Nero Giovane", image: "/assets/tgc_card/youngblackdragon.png", icon: "🐉",
    element: "dark", rarity: "epic", cost: 6, mana: { dark: 5, any: 1 }, atk: 6, hp: 7,
    mechanics: ["flying", "pierce"],
    flavor: "L'acido cola dalle zanne come parole sussurrate.",
  },
  bonelord: {
    id: "bonelord", name: "Signore d'Ossa", image: "/assets/tgc_card/bonelord.png", icon: "💀",
    element: "dark", rarity: "legendary", cost: 7, mana: { dark: 6, any: 1 }, atk: 7, hp: 9,
    mechanics: ["veil", "soulburn", "vanguard"],
    flavor: "Indossa l'oro dei re che ha sopravvissuto.",
  },
  eldritchhorror: {
    id: "eldritchhorror", name: "Orrore Eldritch", image: "/assets/tgc_card/eldritchhorror.png", icon: "🐙",
    element: "dark", rarity: "legendary", cost: 8, mana: { dark: 7, any: 1 }, atk: 8, hp: 10,
    mechanics: ["flying", "soulburn", "reckon"],
    flavor: "Non è un nemico. È una domanda che non vuoi che ti faccia.",
  },
  goblinking: {
    id: "goblinking", name: "Re Goblin", image: "/assets/tgc_card/goblinking.png", icon: "👑",
    element: "dark", rarity: "legendary", cost: 7, mana: { dark: 6, any: 1 }, atk: 8, hp: 8,
    mechanics: ["surge", "pierce", "veil"],
    flavor: "Su un trono d'oro che ha rubato a un re vero.",
  },
  mindflayerancient: {
    id: "mindflayerancient", name: "Mind Flayer Antico", image: "/assets/tgc_card/mindflayerancient.png", icon: "🧠",
    element: "dark", rarity: "legendary", cost: 8, mana: { dark: 7, any: 1 }, atk: 7, hp: 11,
    mechanics: ["soulburn", "reckon", "vanguard"],
    flavor: "Conosceva il tuo nome prima che tu nascessi.",
  },

  /* ── CRYSTALS 💎 ──────────────────────────────────────────────
     MTG-style "lands" — play at most one per turn, no mana cost.
     Stays on the field as a permanent source of one mana of its
     element every turn (refilled at start-of-your-turn). Decks
     auto-include a handful of these so players can actually pay
     for their creatures and spells. */
  crystal_fire: {
    id: "crystal_fire", name: "Cristallo di Fuoco", image: null, icon: "🔥",
    element: "fire", rarity: "common", cost: 0, type: "crystal",
    flavor: "Un frammento di lava cristallizzata, ancora caldo al tatto.",
  },
  crystal_water: {
    id: "crystal_water", name: "Cristallo d'Acqua", image: null, icon: "💧",
    element: "water", rarity: "common", cost: 0, type: "crystal",
    flavor: "Un nodo di marea solidificata. Mormora ancora.",
  },
  crystal_earth: {
    id: "crystal_earth", name: "Cristallo di Terra", image: null, icon: "🌿",
    element: "earth", rarity: "common", cost: 0, type: "crystal",
    flavor: "Pietra viva. Le sue radici scendono dove l'occhio non arriva.",
  },
  crystal_air: {
    id: "crystal_air", name: "Cristallo d'Aria", image: null, icon: "🌪",
    element: "air", rarity: "common", cost: 0, type: "crystal",
    flavor: "Quasi non lo vedi. Eppure ti spinge.",
  },
  crystal_light: {
    id: "crystal_light", name: "Cristallo di Luce", image: null, icon: "✨",
    element: "light", rarity: "common", cost: 0, type: "crystal",
    flavor: "Brilla anche quando tutto intorno è notte.",
  },
  crystal_dark: {
    id: "crystal_dark", name: "Cristallo Oscuro", image: null, icon: "🌑",
    element: "dark", rarity: "common", cost: 0, type: "crystal",
    flavor: "Più lo guardi, più il mondo sembra dimenticarti.",
  },
};

export const TCG_CARD_LIST = Object.values(TCG_CARDS);

/* ── Reward compliments — random line on win.
   Vivid italian flavor, kept short. ──────────────────────── */
export const WIN_COMPLIMENTS = [
  "Mossa magistrale, stratega delle stelle! ⭐",
  "Hai letto il mazzo come un grimorio. Vittoria scolpita! 📜",
  "Re del tavolo da gioco, signore del fato! 👑",
  "Hai trasformato le carte in destino. Glorioso! 🔥",
  "Il tuo mazzo canta, l'avversario piange. Splendido! 🎴",
  "Tattica di un drago, cuore di un eroe. Vittoria epica! 🐉",
  "Hai giocato come il Bardo che canta solo trionfi! 🎶",
  "Le carte ti obbediscono, anche le altrui. Geniale! ✨",
  "Una vittoria degna di una saga. La narreranno per anni! 📖",
  "Hai trasformato il caos in una sinfonia di morte. Bravo! ⚔",
  "Hanno schierato armate. Tu hai schierato un genio. 🧠",
  "Vittoria scolpita nel marmo dei mondi! 🏛",
];

export function randomCompliment() {
  return WIN_COMPLIMENTS[Math.floor(Math.random() * WIN_COMPLIMENTS.length)];
}

/* ============================================================
   SHOP — element packs.
   Each pack contains 8 cards. Standard packs (fire/water/earth/
   air) cost 80 ✦ and have a 0.5% legendary chance on their
   premium slot. Light/Dark packs cost 200 ✦ and have a 5%
   legendary chance — exotic and rare by design.
   ------------------------------------------------------------
   slots: each entry is either a rarity string ("common"/"rare")
   for guaranteed slots, or one of the dynamic slot keys
   ("premium" / "premium-elite") which roll via premiumOdds.
   elementBias: 0-1 chance the card matches the pack's element;
   on a miss the slot rolls from the wider pool (still
   honoring rarity).
   ============================================================ */

/* Standard 15-card layout shared by every single-element pack. */
const STANDARD_PACK_SLOTS = [
  "common", "common", "common", "common", "common", "common", "common",
  "rare", "rare", "rare",
  "rarePlus",
  "crystal", "crystal",
  "foilChance",
  "premium",
];
const STANDARD_PACK_DESC =
  "15 carte · 7 comuni · 3 rare · 1 rara-o-epica · 2 cristalli · 1 con chance brillante · 1 premio (raro→leggendario).";
const ELITE_PACK_SLOTS = [
  "common", "common", "common", "common", "common", "common", "common",
  "rare", "rare", "rare",
  "rarePlus",
  "crystal", "crystal",
  "foilChance",
  "premium-elite",
];
const ELITE_PACK_DESC =
  "15 carte · 7 comuni · 3 rare · 1 rara-o-epica · 2 cristalli · 1 con chance brillante · 1 premio d'élite.";

export const PACK_DEFS = {
  fire: {
    key: "fire", element: "fire",
    name: "Forziere del Fuoco", icon: "🔥",
    cost: 80, size: 15,
    description: STANDARD_PACK_DESC + " Alta probabilità di carte di Fuoco.",
    slots: STANDARD_PACK_SLOTS,
    premiumOdds: { rare: 80, epic: 18, legendary: 2 },
    elementBias: 0.75,
  },
  water: {
    key: "water", element: "water",
    name: "Forziere dell'Acqua", icon: "💧",
    cost: 80, size: 15,
    description: STANDARD_PACK_DESC + " Alta probabilità di carte d'Acqua.",
    slots: STANDARD_PACK_SLOTS,
    premiumOdds: { rare: 80, epic: 18, legendary: 2 },
    elementBias: 0.75,
  },
  earth: {
    key: "earth", element: "earth",
    name: "Forziere della Terra", icon: "🌿",
    cost: 80, size: 15,
    description: STANDARD_PACK_DESC + " Alta probabilità di carte di Terra.",
    slots: STANDARD_PACK_SLOTS,
    premiumOdds: { rare: 80, epic: 18, legendary: 2 },
    elementBias: 0.75,
  },
  air: {
    key: "air", element: "air",
    name: "Forziere dell'Aria", icon: "🌪",
    cost: 80, size: 15,
    description: STANDARD_PACK_DESC + " Alta probabilità di carte d'Aria.",
    slots: STANDARD_PACK_SLOTS,
    premiumOdds: { rare: 80, epic: 18, legendary: 2 },
    elementBias: 0.75,
  },
  mixed: {
    key: "mixed", element: null,
    name: "Forziere Multicolore", icon: "🌈",
    cost: 100, size: 15,
    description:
      "15 carte di tutti i colori. 7 comuni · 3 rare · 1 rara-o-epica · 2 cristalli · 1 con chance brillante · 1 premio.",
    slots: STANDARD_PACK_SLOTS,
    premiumOdds: { rare: 80, epic: 18, legendary: 2 },
    elementBias: 0, // pure random across all elements
  },
  light: {
    key: "light", element: "light",
    name: "Reliquiario di Luce", icon: "✨",
    cost: 200, size: 15,
    description: ELITE_PACK_DESC + " Esotico — 5% di un Leggendario.",
    slots: ELITE_PACK_SLOTS,
    premiumOdds: { rare: 50, epic: 45, legendary: 5 },
    elementBias: 1.0,
  },
  dark: {
    key: "dark", element: "dark",
    name: "Sigillo di Tenebra", icon: "🌑",
    cost: 200, size: 15,
    description: ELITE_PACK_DESC + " Esotico — 5% di un Leggendario.",
    slots: ELITE_PACK_SLOTS,
    premiumOdds: { rare: 50, epic: 45, legendary: 5 },
    elementBias: 1.0,
  },
};

export const PACK_ORDER = ["fire", "water", "earth", "air", "mixed", "light", "dark"];

/* Element pool used by the mixed pack and crystal-slot fallback. */
const PACK_ELEMENTS = ["fire", "water", "earth", "air", "light", "dark"];
function randomElement() {
  return PACK_ELEMENTS[Math.floor(Math.random() * PACK_ELEMENTS.length)];
}

/* ── Rarity weighted roll ─────────────────────────────────── */
function rollRarity(odds) {
  const entries = Object.entries(odds);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let roll = Math.random() * total;
  for (const [r, w] of entries) {
    if (roll < w) return r;
    roll -= w;
  }
  return entries[entries.length - 1][0];
}

/* ── Pick a single card honoring rarity + element bias ────
   Crystals are excluded from regular rarity rolls — they have
   their own dedicated `crystal` slot in the new pack layout, so
   leaving them in the common pool would double-count them. */
function pickCardId(packElement, rarity, elementBias) {
  const notCrystal = (c) => c.type !== "crystal";
  const ofRarityAndEl = TCG_CARD_LIST.filter(
    c => c.rarity === rarity && c.element === packElement && notCrystal(c)
  );
  const ofRarity = TCG_CARD_LIST.filter(c => c.rarity === rarity && notCrystal(c));
  const useEl = packElement && Math.random() < elementBias && ofRarityAndEl.length > 0;
  const pool = useEl ? ofRarityAndEl : (ofRarity.length > 0 ? ofRarity : TCG_CARD_LIST.filter(notCrystal));
  if (pool.length === 0) return TCG_CARD_LIST[0].id;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

/* ── Foil rate — "brilliant" cards (Magic-style foils) ───
   Each card drawn from a pack has this chance of rolling
   foil — independent of rarity. Tuned to be truly rare:
   ~1 foil every ~25 packs (200 cards) at 0.5%. Foils are
   purely cosmetic (a holographic shimmer effect). Starter
   packs intentionally never roll foils so the wonder is
   reserved for the shop. */
export const FOIL_RATE = 0.005; // 0.5% per card

function rollFoil() {
  return Math.random() < FOIL_RATE;
}

/* Boosted foil chance for the dedicated "foilChance" slot — most
   of the time it just drops a common card, but every now and then
   it lands a shimmering brilliant version. Other slots still use
   the baseline FOIL_RATE. */
export const FOIL_RATE_BOOSTED = 0.08; // 8%

/* "rarePlus" slot — almost always a rare, with a slim epic shot. */
const RARE_PLUS_ODDS = { rare: 94, epic: 6 };

/* ── Open a pack: returns [{ cardId, foil }, ...] ──────────
   Slot keys:
     "common" / "rare"  — fixed-rarity card
     "rarePlus"         — mostly rare, slim chance of epic
     "crystal"          — crystal of the pack's element (random
                          element for the mixed pack)
     "foilChance"       — common card with elevated foil odds
     "premium" / "premium-elite"
                        — rolls via def.premiumOdds */
export function openPack(packKey) {
  const def = PACK_DEFS[packKey];
  if (!def) return [];
  const out = [];
  for (const slot of def.slots) {
    // Crystal slot: always drops a crystal of the pack's element.
    // For the mixed pack (def.element == null) it rolls a random
    // element so the player gets varied mana.
    if (slot === "crystal") {
      const el = def.element || randomElement();
      out.push({ cardId: `crystal_${el}`, foil: false });
      continue;
    }

    // Decide rarity for this slot.
    let rarity;
    if (slot === "premium" || slot === "premium-elite") {
      rarity = rollRarity(def.premiumOdds);
    } else if (slot === "rarePlus") {
      rarity = rollRarity(RARE_PLUS_ODDS);
    } else if (slot === "foilChance") {
      rarity = "common";
    } else {
      rarity = slot;
    }

    // Mixed pack ignores element bias entirely — every non-crystal
    // card is rolled across the full element pool.
    const elementForPick = def.element ?? null;
    const bias = def.element ? def.elementBias : 0;

    // Foil chance: the dedicated foilChance slot uses the boosted
    // rate; everything else uses the regular FOIL_RATE.
    const foil = slot === "foilChance"
      ? Math.random() < FOIL_RATE_BOOSTED
      : rollFoil();

    out.push({
      cardId: pickCardId(elementForPick, rarity, bias),
      foil,
    });
  }
  return out;
}

/* ── Free starter pack — 60 non-foil cards, picked once per
   player. Distribution: 17 element-crystals + 36 commons + 5 rares
   + 2 epics, all of the chosen element (no splash, no legendary).
   The crystals come bundled so the player can actually pay for
   their cards in their first match without waiting for shop packs.
   Fallback: if an element has fewer epics/rares than slots needed,
   the extra slots fall back to the next rarity tier down. Foils
   don't drop from starter — only from purchased packs. */
export function openStarterPack(element) {
  if (!PACK_DEFS[element]) return [];
  if (!["fire","water","earth","air","light","dark"].includes(element)) return [];

  const inEl = (r) => TCG_CARD_LIST.filter(
    c => c.element === element && c.rarity === r && c.type !== "crystal"
  );
  const commons = inEl("common");
  const rares   = inEl("rare");
  const epics   = inEl("epic");
  if (commons.length === 0) return []; // Defensive — every element has commons.
  const pickFrom = (list) => list[Math.floor(Math.random() * list.length)].id;
  const pickFromOrFallback = (primary, fallbacks) => {
    for (const list of [primary, ...fallbacks]) {
      if (list && list.length > 0) return pickFrom(list);
    }
    return pickFrom(commons);
  };

  const out = [];
  // 17 elemental crystals — ~28% of the 60-card deck, enough mana
  // cards to hit a 5-cost play by turn 5-6 most games.
  for (let i = 0; i < 17; i++) out.push({ cardId: "crystal_" + element, foil: false });
  // 36 commons of the chosen element. Pools intentionally roll
  // duplicates so the player ends up with playable multiples for
  // deck-building.
  for (let i = 0; i < 36; i++) out.push({ cardId: pickFrom(commons), foil: false });
  // 5 rares of the element (fall back to common).
  for (let i = 0; i < 5; i++) {
    out.push({ cardId: pickFromOrFallback(rares, [commons]), foil: false });
  }
  // 2 epics. Light still has 0 epics — fall back to rare then common
  // so the starter always totals exactly 60 cards.
  for (let i = 0; i < 2; i++) {
    out.push({ cardId: pickFromOrFallback(epics, [rares, commons]), foil: false });
  }
  return out;
}

/* ── Trash refunds — selling unwanted cards back for ✦ ─── */
export const TRASH_REFUND = {
  common:    3,
  rare:      8,
  epic:      20,
  legendary: 50,
};

/* Foils refund roughly 4× normal — they're rare collector items. */
export const FOIL_TRASH_REFUND = {
  common:    12,
  rare:      32,
  epic:      80,
  legendary: 200,
};

export function trashRefundFor(cardId, foil = false) {
  const c = TCG_CARDS[cardId];
  if (!c) return 0;
  const table = foil ? FOIL_TRASH_REFUND : TRASH_REFUND;
  return table[c.rarity] || 0;
}
