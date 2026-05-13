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
  air:   "💨",
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
     image      — /assets/pets/*.png (placeholder, until /tcgCard exists)
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
    id: "imp", name: "Diavoletto", image: "/assets/pets/imp.png", icon: "👺",
    element: "fire", rarity: "common", cost: 1, mana: { fire: 1 }, atk: 2, hp: 1,
    mechanics: ["surge"],
    flavor: "Una scintilla con le ali e un cattivo carattere.",
  },
  hellhound: {
    id: "hellhound", name: "Mastino Infernale", image: "/assets/pets/hellhound.png", icon: "🐕‍🔥",
    element: "fire", rarity: "common", cost: 2, mana: { fire: 2 }, atk: 3, hp: 2,
    mechanics: ["surge", "bruciatura"],
    mechanicsValues: { bruciatura: 1 },
    flavor: "Caccia in branco, brucia da solo.",
  },
  spineddevil: {
    id: "spineddevil", name: "Diavolo Spinato", image: "/assets/pets/spineddevil.png", icon: "🦂",
    element: "fire", rarity: "common", cost: 2, mana: { fire: 1, any: 1 }, atk: 2, hp: 3,
    mechanics: ["cinder", "cacciatore"],
    flavor: "Le sue spine volano in alto. Anche i corvi le temono.",
  },
  fireaxedevil: {
    id: "fireaxedevil", name: "Diavolo dell'Ascia", image: "/assets/pets/fireaxedevil.png", icon: "🪓",
    element: "fire", rarity: "rare", cost: 3, mana: { fire: 2, any: 1 }, atk: 4, hp: 3,
    mechanics: ["pierce"],
    flavor: "L'ascia infuocata non si ferma davanti alla carne.",
  },
  hornedevil: {
    id: "hornedevil", name: "Diavolo Cornuto", image: "/assets/pets/hornedevil.png", icon: "😈",
    element: "fire", rarity: "rare", cost: 4, mana: { fire: 3, any: 1 }, atk: 5, hp: 4,
    mechanics: ["vanguard"],
    flavor: "Le sue corna trafiggono prima del grido.",
  },
  hezrou: {
    id: "hezrou", name: "Hezrou", image: "/assets/pets/hezrou.png", icon: "🐸",
    element: "fire", rarity: "epic", cost: 5, mana: { fire: 4, any: 1 }, atk: 5, hp: 7,
    mechanics: ["bulwark", "cinder"],
    flavor: "Il suo fetore brucia i polmoni di chi osa avvicinarsi.",
  },
  balor: {
    id: "balor", name: "Balor", image: "/assets/pets/balor.png", icon: "🔥",
    element: "fire", rarity: "epic", cost: 7, mana: { fire: 6, any: 1 }, atk: 8, hp: 6,
    mechanics: ["surge", "pierce", "bruciatura"],
    mechanicsValues: { bruciatura: 2 },
    flavor: "Frusta di fiamma, spada di fulmine. La fine di un'armata.",
  },
  reddragon: {
    id: "reddragon", name: "Drago Rosso", image: "/assets/pets/reddragon.png", icon: "🐉",
    element: "fire", rarity: "legendary", cost: 8, mana: { fire: 8 }, atk: 9, hp: 9,
    mechanics: ["surge", "pierce", "bruciatura", "flying"],
    mechanicsValues: { bruciatura: 3 },
    flavor: "Avarizia con le ali. Il suo soffio brucia per giorni.",
  },

  /* ── WATER 💧 ─────────────────────────────────── */
  kuotoa: {
    id: "kuotoa", name: "Kuo-Toa", image: "/assets/pets/kuotoa.png", icon: "🐠",
    element: "water", rarity: "common", cost: 1, mana: { water: 1 }, atk: 1, hp: 3,
    mechanics: [],
    flavor: "Adora un dio improbabile. Lo difende lo stesso.",
  },
  sahuagin: {
    id: "sahuagin", name: "Sahuagin", image: "/assets/pets/sahuagin.png", icon: "🦈",
    element: "water", rarity: "common", cost: 2, mana: { water: 1, any: 1 }, atk: 3, hp: 2,
    mechanics: ["surge", "cacciatore"],
    flavor: "Il suo arpione vola dritto verso il cielo.",
  },
  merfolk: {
    id: "merfolk", name: "Tritone", image: "/assets/pets/merfolk.png", icon: "🧜",
    element: "water", rarity: "common", cost: 2, mana: { water: 2 }, atk: 2, hp: 3,
    mechanics: ["soulburn"],
    flavor: "Il suo canto cura il sangue di chi lo ama.",
  },
  watermage: {
    id: "watermage", name: "Mago dell'Acqua", image: "/assets/pets/watermage.png", icon: "🌊",
    element: "water", rarity: "rare", cost: 3, mana: { water: 3 }, atk: 2, hp: 4,
    mechanics: ["soulburn"],
    flavor: "Onda dopo onda, ricuce le ferite del suo padrone.",
  },
  marinebrute: {
    id: "marinebrute", name: "Bruto Marino", image: "/assets/pets/marinebrute.png", icon: "🐙",
    element: "water", rarity: "rare", cost: 4, mana: { water: 3, any: 1 }, atk: 3, hp: 6,
    mechanics: ["bulwark"],
    flavor: "Tentacoli come ancore. Niente passa.",
  },
  marid: {
    id: "marid", name: "Marid", image: "/assets/pets/marid.png", icon: "🌀",
    element: "water", rarity: "epic", cost: 5, mana: { water: 4, any: 1 }, atk: 5, hp: 6,
    mechanics: ["soulburn", "vanguard"],
    flavor: "Genio dell'oceano. La sua collera ribolle prima di colpire.",
  },
  dragonturtle: {
    id: "dragonturtle", name: "Drago Tartaruga", image: "/assets/pets/dragonturtle.png", icon: "🐢",
    element: "water", rarity: "epic", cost: 6, mana: { water: 5, any: 1 }, atk: 5, hp: 9,
    mechanics: ["bulwark", "vanguard"],
    flavor: "Antico abisso vivente. Affonda flotte solo respirando.",
  },
  kraken: {
    id: "kraken", name: "Kraken", image: "/assets/pets/kraken.png", icon: "🦑",
    element: "water", rarity: "legendary", cost: 9, mana: { water: 9 }, atk: 8, hp: 10,
    mechanics: ["pierce", "bulwark", "reckon"],
    flavor: "Le tempeste sono i suoi sospiri. Le navi i suoi giocattoli.",
  },

  /* ── EARTH 🌿 ─────────────────────────────────── */
  myconid: {
    id: "myconid", name: "Myconide", image: "/assets/pets/myconid.png", icon: "🍄",
    element: "earth", rarity: "common", cost: 1, mana: { earth: 1 }, atk: 1, hp: 3,
    mechanics: ["veil", "linfa"],
    mechanicsValues: { linfa: 1 },
    flavor: "Le spore tornano sempre, anche dopo l'inverno.",
  },
  badger: {
    id: "badger", name: "Tasso Furioso", image: "/assets/pets/badger.png", icon: "🦡",
    element: "earth", rarity: "common", cost: 2, mana: { earth: 1, any: 1 }, atk: 3, hp: 2,
    mechanics: ["reckon"],
    flavor: "Piccolo, basso, e mortalmente cocciuto.",
  },
  twigblight: {
    id: "twigblight", name: "Rovo Animato", image: "/assets/pets/twigblight.png", icon: "🌿",
    element: "earth", rarity: "common", cost: 1, mana: { earth: 1 }, atk: 2, hp: 2,
    mechanics: ["linfa"],
    mechanicsValues: { linfa: 1 },
    flavor: "Sembra un cespuglio. Lo è. Ma morde. E ricresce.",
  },
  hookhorror: {
    id: "hookhorror", name: "Orrore Uncinato", image: "/assets/pets/hookhorror.png", icon: "🦀",
    element: "earth", rarity: "rare", cost: 3, mana: { earth: 2, any: 1 }, atk: 3, hp: 4,
    mechanics: ["pierce", "cacciatore"],
    flavor: "Gli uncini agganciano la pietra. E ciò che vola sopra.",
  },
  shamblingmound: {
    id: "shamblingmound", name: "Cumulo Strisciante", image: "/assets/pets/shamblingmound.png", icon: "🌳",
    element: "earth", rarity: "rare", cost: 4, mana: { earth: 3, any: 1 }, atk: 3, hp: 6,
    mechanics: ["bulwark", "linfa"],
    mechanicsValues: { linfa: 1 },
    flavor: "Marcisce. Si rialza. Marcisce di nuovo. Cammina.",
  },
  crystalgolem: {
    id: "crystalgolem", name: "Golem di Cristallo", image: "/assets/pets/crystalgolem.png", icon: "💎",
    element: "earth", rarity: "epic", cost: 5, mana: { earth: 4, any: 1 }, atk: 4, hp: 8,
    mechanics: ["bulwark", "vanguard"],
    flavor: "Riflette ogni colpo prima di restituirlo come una sentenza.",
  },
  irongolem: {
    id: "irongolem", name: "Golem di Ferro", image: "/assets/pets/irongolem.png", icon: "🤖",
    element: "earth", rarity: "epic", cost: 7, mana: { earth: 6, any: 1 }, atk: 7, hp: 8,
    mechanics: ["bulwark", "pierce"],
    flavor: "Una fortezza che cammina, dimenticata da chi l'ha forgiata.",
  },
  ankylosaurus: {
    id: "ankylosaurus", name: "Anchilosauro", image: "/assets/pets/ankylosaurus.png", icon: "🦕",
    element: "earth", rarity: "legendary", cost: 8, mana: { earth: 8 }, atk: 7, hp: 11,
    mechanics: ["bulwark", "reckon", "linfa"],
    mechanicsValues: { linfa: 2 },
    flavor: "La sua coda spacca le montagne. La sua corteccia ricresce ogni alba.",
  },

  /* ── AIR 💨 ───────────────────────────────────── */
  hawk: {
    id: "hawk", name: "Falco", image: "/assets/pets/hawk.png", icon: "🦅",
    element: "air", rarity: "common", cost: 1, mana: { air: 1 }, atk: 2, hp: 1,
    mechanics: ["surge", "flying"],
    flavor: "Vede il topo prima che il topo si veda.",
  },
  wingedkobold: {
    id: "wingedkobold", name: "Kobold Alato", image: "/assets/pets/wingedkobold.png", icon: "🦖",
    element: "air", rarity: "common", cost: 2, mana: { air: 1, any: 1 }, atk: 2, hp: 2,
    mechanics: ["surge", "cinder", "flying"],
    flavor: "Si schianta con stile. Sempre.",
  },
  airelemental: {
    id: "airelemental", name: "Elementale dell'Aria", image: "/assets/pets/airelemental.png", icon: "🌬",
    element: "air", rarity: "rare", cost: 3, mana: { air: 2, any: 1 }, atk: 3, hp: 3,
    mechanics: ["surge", "pierce", "flying"],
    flavor: "Non lo afferri. Lo respiri. E ti taglia dentro.",
  },
  peryton: {
    id: "peryton", name: "Periton", image: "/assets/pets/peryton.png", icon: "🦌",
    element: "air", rarity: "rare", cost: 3, mana: { air: 2, any: 1 }, atk: 4, hp: 2,
    mechanics: ["surge", "pierce", "flying"],
    flavor: "L'ombra di un cervo, gli artigli di un'aquila.",
  },
  manticore: {
    id: "manticore", name: "Manticora", image: "/assets/pets/manticore.png", icon: "🦁",
    element: "air", rarity: "rare", cost: 4, mana: { air: 3, any: 1 }, atk: 4, hp: 4,
    mechanics: ["pierce", "flying"],
    flavor: "Faccia umana, voce di leone, code piene di lance.",
  },
  djinni: {
    id: "djinni", name: "Djinni", image: "/assets/pets/djinni.png", icon: "🧞",
    element: "air", rarity: "epic", cost: 5, mana: { air: 4, any: 1 }, atk: 5, hp: 6,
    mechanics: ["surge", "vanguard", "flying"],
    flavor: "Genio dei cieli. I tuoi tre desideri non basteranno.",
  },
  stormelemental: {
    id: "stormelemental", name: "Elementale di Tempesta", image: "/assets/pets/stormelemental.png", icon: "⛈",
    element: "air", rarity: "epic", cost: 6, mana: { air: 5, any: 1 }, atk: 6, hp: 6,
    mechanics: ["surge", "pierce", "cinder", "flying"],
    flavor: "Tuono che cammina. Pioggia che taglia.",
  },
  tempestdragon: {
    id: "tempestdragon", name: "Drago della Tempesta", image: "/assets/pets/tempestdragon.png", icon: "🌩",
    element: "air", rarity: "legendary", cost: 8, mana: { air: 8 }, atk: 8, hp: 9,
    mechanics: ["surge", "pierce", "vanguard", "flying"],
    flavor: "Vola sopra le nuvole. Scende sotto forma di sentenza.",
  },

  /* ── LIGHT ✨ ─────────────────────────────────── */
  pegasus: {
    id: "pegasus", name: "Pegaso", image: "/assets/pets/pegasus.png", icon: "🦄",
    element: "light", rarity: "common", cost: 2, mana: { light: 2 }, atk: 2, hp: 3,
    mechanics: ["soulburn", "flying"],
    flavor: "Le sue ali profumano di alba.",
  },
  copperdragon: {
    id: "copperdragon", name: "Drago di Rame", image: "/assets/pets/copperdragon.png", icon: "🐲",
    element: "light", rarity: "rare", cost: 4, mana: { light: 3, any: 1 }, atk: 4, hp: 4,
    mechanics: ["soulburn", "vanguard", "flying"],
    flavor: "Burlone delle terre soleggiate. Sa anche essere serio.",
  },
  helmedhorror: {
    id: "helmedhorror", name: "Orrore Elmato", image: "/assets/pets/helmedhorror.png", icon: "⚔",
    element: "light", rarity: "rare", cost: 4, mana: { light: 3, any: 1 }, atk: 3, hp: 5,
    mechanics: ["bulwark", "vanguard", "cacciatore"],
    flavor: "Lancia eretta verso il cielo. Niente vi passa senza pagare.",
  },
  satyr: {
    id: "satyr", name: "Satiro", image: "/assets/pets/satyr.png", icon: "🐐",
    element: "light", rarity: "common", cost: 1, mana: { light: 1 }, atk: 1, hp: 2,
    mechanics: ["veil"],
    flavor: "Suona, balla, ricresce sotto la luna piena.",
  },
  solar: {
    id: "solar", name: "Solare", image: "/assets/pets/solar.png", icon: "🌟",
    element: "light", rarity: "legendary", cost: 9, mana: { light: 9 }, atk: 8, hp: 10,
    mechanics: ["vanguard", "soulburn", "veil"],
    flavor: "Un angelo della guerra. Un angelo della guerra giusta.",
  },

  /* ── DARK 🌑 ──────────────────────────────────── */
  zombie: {
    id: "zombie", name: "Zombi", image: "/assets/pets/zombie.png", icon: "🧟",
    element: "dark", rarity: "common", cost: 1, mana: { dark: 1 }, atk: 1, hp: 3,
    mechanics: ["veil"],
    flavor: "Già morto una volta. Cosa potrà mai andare storto?",
  },
  manes: {
    id: "manes", name: "Manes", image: "/assets/pets/manes.png", icon: "👹",
    element: "dark", rarity: "common", cost: 1, mana: { dark: 1 }, atk: 2, hp: 1,
    mechanics: ["cinder"],
    flavor: "Anima dannata, urla anche dopo la morte.",
  },
  specter: {
    id: "specter", name: "Spettro", image: "/assets/pets/specter.png", icon: "👻",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 2, any: 1 }, atk: 3, hp: 3,
    mechanics: ["pierce", "soulburn", "flying"],
    flavor: "Ti svuota di vita. Si nutre del tuo respiro.",
  },
  wight: {
    id: "wight", name: "Wight", image: "/assets/pets/wight.png", icon: "💀",
    element: "dark", rarity: "rare", cost: 3, mana: { dark: 3 }, atk: 4, hp: 2,
    mechanics: ["soulburn"],
    flavor: "Ogni vittima diventa carne dell'esercito.",
  },
  nightmare: {
    id: "nightmare", name: "Incubo", image: "/assets/pets/nightmare.png", icon: "🐴",
    element: "dark", rarity: "epic", cost: 5, mana: { dark: 4, any: 1 }, atk: 6, hp: 5,
    mechanics: ["surge", "cinder"],
    flavor: "Galoppa nei sogni. Atterra nei tuoi peggiori.",
  },
  mindflayer: {
    id: "mindflayer", name: "Mente Adunca", image: "/assets/pets/mindflayer.png", icon: "🦑",
    element: "dark", rarity: "epic", cost: 6, mana: { dark: 5, any: 1 }, atk: 5, hp: 6,
    mechanics: ["reckon", "soulburn"],
    flavor: "Estrae il cervello. Ne fa un pasto. Lo serve a sé stesso.",
  },
  lich: {
    id: "lich", name: "Lich", image: "/assets/pets/lich.png", icon: "☠",
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

  /* ── AIR 💨 spells ────────────────────────────── */
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

export const PACK_DEFS = {
  fire: {
    key: "fire", element: "fire",
    name: "Forziere del Fuoco", icon: "🔥",
    cost: 80, size: 8,
    description:
      "5 comuni · 2 rare · 1 slot premio · alta probabilità di carte di Fuoco.",
    slots: ["common", "common", "common", "common", "common", "rare", "rare", "premium"],
    premiumOdds: { rare: 79.5, epic: 20, legendary: 0.5 },
    elementBias: 0.75,
  },
  water: {
    key: "water", element: "water",
    name: "Forziere dell'Acqua", icon: "💧",
    cost: 80, size: 8,
    description:
      "5 comuni · 2 rare · 1 slot premio · alta probabilità di carte d'Acqua.",
    slots: ["common", "common", "common", "common", "common", "rare", "rare", "premium"],
    premiumOdds: { rare: 79.5, epic: 20, legendary: 0.5 },
    elementBias: 0.75,
  },
  earth: {
    key: "earth", element: "earth",
    name: "Forziere della Terra", icon: "🌿",
    cost: 80, size: 8,
    description:
      "5 comuni · 2 rare · 1 slot premio · alta probabilità di carte di Terra.",
    slots: ["common", "common", "common", "common", "common", "rare", "rare", "premium"],
    premiumOdds: { rare: 79.5, epic: 20, legendary: 0.5 },
    elementBias: 0.75,
  },
  air: {
    key: "air", element: "air",
    name: "Forziere dell'Aria", icon: "💨",
    cost: 80, size: 8,
    description:
      "5 comuni · 2 rare · 1 slot premio · alta probabilità di carte d'Aria.",
    slots: ["common", "common", "common", "common", "common", "rare", "rare", "premium"],
    premiumOdds: { rare: 79.5, epic: 20, legendary: 0.5 },
    elementBias: 0.75,
  },
  light: {
    key: "light", element: "light",
    name: "Reliquiario di Luce", icon: "✨",
    cost: 200, size: 8,
    description:
      "Esotico e raro. 4 comuni · 3 rare · 1 slot d'élite · 5% di un Leggendario.",
    slots: ["common", "common", "common", "common", "rare", "rare", "rare", "premium-elite"],
    premiumOdds: { rare: 50, epic: 45, legendary: 5 },
    elementBias: 1.0,
  },
  dark: {
    key: "dark", element: "dark",
    name: "Sigillo di Tenebra", icon: "🌑",
    cost: 200, size: 8,
    description:
      "Esotico e raro. 4 comuni · 3 rare · 1 slot d'élite · 5% di un Leggendario.",
    slots: ["common", "common", "common", "common", "rare", "rare", "rare", "premium-elite"],
    premiumOdds: { rare: 50, epic: 45, legendary: 5 },
    elementBias: 1.0,
  },
};

export const PACK_ORDER = ["fire", "water", "earth", "air", "light", "dark"];

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

/* ── Pick a single card honoring rarity + element bias ──── */
function pickCardId(packElement, rarity, elementBias) {
  const ofRarityAndEl = TCG_CARD_LIST.filter(
    c => c.rarity === rarity && c.element === packElement
  );
  const ofRarity = TCG_CARD_LIST.filter(c => c.rarity === rarity);
  const useEl = Math.random() < elementBias && ofRarityAndEl.length > 0;
  const pool = useEl ? ofRarityAndEl : (ofRarity.length > 0 ? ofRarity : TCG_CARD_LIST);
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

/* ── Open a pack: returns [{ cardId, foil }, ...] ────────── */
export function openPack(packKey) {
  const def = PACK_DEFS[packKey];
  if (!def) return [];
  const out = [];
  for (const slot of def.slots) {
    let rarity;
    if (slot === "premium" || slot === "premium-elite") {
      rarity = rollRarity(def.premiumOdds);
    } else {
      rarity = slot;
    }
    out.push({
      cardId: pickCardId(def.element, rarity, def.elementBias),
      foil: rollFoil(),
    });
  }
  return out;
}

/* ── Free starter pack — 20 non-foil cards, picked once per
   player. Distribution: 6 element-crystals + 12 commons + 1 rare
   + 1 epic, all of the chosen element (no splash, no legendary).
   The crystals come bundled so the player can actually pay for
   their cards in their first match without waiting for shop packs.
   Fallback: if an element has no epic or no rare (light has 0
   epics; light/dark have few commons), we substitute a rare or
   common from the same element. Foils don't drop from starter —
   only from purchased packs. */
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

  const out = [];
  // 6 elemental crystals — basic mana sources for the new player's deck.
  for (let i = 0; i < 6; i++) out.push({ cardId: "crystal_" + element, foil: false });
  // 12 commons of the chosen element. Pools as small as 2 cards (light,
  // dark) intentionally roll duplicates so the player ends up with playable
  // multiples for deck-building.
  for (let i = 0; i < 12; i++) out.push({ cardId: pickFrom(commons), foil: false });
  // 1 rare of the element, falling back to a common.
  out.push({ cardId: pickFrom(rares.length ? rares : commons), foil: false });
  // 1 epic of the element. Light has no epics — fall back to a rare,
  // then to a common, preserving the 20-card count.
  out.push({ cardId: pickFrom(
    epics.length  ? epics  :
    rares.length  ? rares  :
    commons
  ), foil: false });
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
