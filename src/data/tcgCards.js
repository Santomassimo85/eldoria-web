/* ============================================================
   TCG CARDS — Magic-style D&D trading card game.
   ------------------------------------------------------------
   6 elements (fire / water / earth / air / light / dark) + 4
   rarities + 8 unique mechanics. Card art is sourced from the
   /public/assets/pets folder for now (a dedicated /tcgCard
   folder will replace these later — only the `image` path
   needs to change).
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
};

export const MECHANICS_ORDER = [
  "surge", "vanguard", "bulwark", "pierce",
  "soulburn", "reckon", "veil", "cinder",
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
    element: "fire", rarity: "common", cost: 1, atk: 2, hp: 1,
    mechanics: ["surge"],
    flavor: "Una scintilla con le ali e un cattivo carattere.",
  },
  hellhound: {
    id: "hellhound", name: "Mastino Infernale", image: "/assets/pets/hellhound.png", icon: "🐕‍🔥",
    element: "fire", rarity: "common", cost: 2, atk: 3, hp: 2,
    mechanics: ["surge"],
    flavor: "Caccia in branco, brucia da solo.",
  },
  spineddevil: {
    id: "spineddevil", name: "Diavolo Spinato", image: "/assets/pets/spineddevil.png", icon: "🦂",
    element: "fire", rarity: "common", cost: 2, atk: 2, hp: 3,
    mechanics: ["cinder"],
    flavor: "Quando cade, lascia braci ardenti dietro di sé.",
  },
  fireaxedevil: {
    id: "fireaxedevil", name: "Diavolo dell'Ascia", image: "/assets/pets/fireaxedevil.png", icon: "🪓",
    element: "fire", rarity: "rare", cost: 3, atk: 4, hp: 3,
    mechanics: ["pierce"],
    flavor: "L'ascia infuocata non si ferma davanti alla carne.",
  },
  hornedevil: {
    id: "hornedevil", name: "Diavolo Cornuto", image: "/assets/pets/hornedevil.png", icon: "😈",
    element: "fire", rarity: "rare", cost: 4, atk: 5, hp: 4,
    mechanics: ["vanguard"],
    flavor: "Le sue corna trafiggono prima del grido.",
  },
  hezrou: {
    id: "hezrou", name: "Hezrou", image: "/assets/pets/hezrou.png", icon: "🐸",
    element: "fire", rarity: "epic", cost: 5, atk: 5, hp: 7,
    mechanics: ["bulwark", "cinder"],
    flavor: "Il suo fetore brucia i polmoni di chi osa avvicinarsi.",
  },
  balor: {
    id: "balor", name: "Balor", image: "/assets/pets/balor.png", icon: "🔥",
    element: "fire", rarity: "epic", cost: 7, atk: 8, hp: 6,
    mechanics: ["surge", "pierce"],
    flavor: "Frusta di fiamma, spada di fulmine. La fine di un'armata.",
  },
  reddragon: {
    id: "reddragon", name: "Drago Rosso", image: "/assets/pets/reddragon.png", icon: "🐉",
    element: "fire", rarity: "legendary", cost: 8, atk: 9, hp: 9,
    mechanics: ["surge", "pierce", "cinder"],
    flavor: "Avarizia con le ali. Quando muore, l'eco delle fiamme resta.",
  },

  /* ── WATER 💧 ─────────────────────────────────── */
  kuotoa: {
    id: "kuotoa", name: "Kuo-Toa", image: "/assets/pets/kuotoa.png", icon: "🐠",
    element: "water", rarity: "common", cost: 1, atk: 1, hp: 3,
    mechanics: [],
    flavor: "Adora un dio improbabile. Lo difende lo stesso.",
  },
  sahuagin: {
    id: "sahuagin", name: "Sahuagin", image: "/assets/pets/sahuagin.png", icon: "🦈",
    element: "water", rarity: "common", cost: 2, atk: 3, hp: 2,
    mechanics: ["surge"],
    flavor: "L'odore del sangue lo richiama come una corrente.",
  },
  merfolk: {
    id: "merfolk", name: "Tritone", image: "/assets/pets/merfolk.png", icon: "🧜",
    element: "water", rarity: "common", cost: 2, atk: 2, hp: 3,
    mechanics: ["soulburn"],
    flavor: "Il suo canto cura il sangue di chi lo ama.",
  },
  watermage: {
    id: "watermage", name: "Mago dell'Acqua", image: "/assets/pets/watermage.png", icon: "🌊",
    element: "water", rarity: "rare", cost: 3, atk: 2, hp: 4,
    mechanics: ["soulburn"],
    flavor: "Onda dopo onda, ricuce le ferite del suo padrone.",
  },
  marinebrute: {
    id: "marinebrute", name: "Bruto Marino", image: "/assets/pets/marinebrute.png", icon: "🐙",
    element: "water", rarity: "rare", cost: 4, atk: 3, hp: 6,
    mechanics: ["bulwark"],
    flavor: "Tentacoli come ancore. Niente passa.",
  },
  marid: {
    id: "marid", name: "Marid", image: "/assets/pets/marid.png", icon: "🌀",
    element: "water", rarity: "epic", cost: 5, atk: 5, hp: 6,
    mechanics: ["soulburn", "vanguard"],
    flavor: "Genio dell'oceano. La sua collera ribolle prima di colpire.",
  },
  dragonturtle: {
    id: "dragonturtle", name: "Drago Tartaruga", image: "/assets/pets/dragonturtle.png", icon: "🐢",
    element: "water", rarity: "epic", cost: 6, atk: 5, hp: 9,
    mechanics: ["bulwark", "vanguard"],
    flavor: "Antico abisso vivente. Affonda flotte solo respirando.",
  },
  kraken: {
    id: "kraken", name: "Kraken", image: "/assets/pets/kraken.png", icon: "🦑",
    element: "water", rarity: "legendary", cost: 9, atk: 8, hp: 10,
    mechanics: ["pierce", "bulwark", "reckon"],
    flavor: "Le tempeste sono i suoi sospiri. Le navi i suoi giocattoli.",
  },

  /* ── EARTH 🌿 ─────────────────────────────────── */
  myconid: {
    id: "myconid", name: "Myconide", image: "/assets/pets/myconid.png", icon: "🍄",
    element: "earth", rarity: "common", cost: 1, atk: 1, hp: 3,
    mechanics: ["veil"],
    flavor: "Le spore tornano sempre, anche dopo l'inverno.",
  },
  badger: {
    id: "badger", name: "Tasso Furioso", image: "/assets/pets/badger.png", icon: "🦡",
    element: "earth", rarity: "common", cost: 2, atk: 3, hp: 2,
    mechanics: ["reckon"],
    flavor: "Piccolo, basso, e mortalmente cocciuto.",
  },
  twigblight: {
    id: "twigblight", name: "Rovo Animato", image: "/assets/pets/twigblight.png", icon: "🌿",
    element: "earth", rarity: "common", cost: 1, atk: 2, hp: 2,
    mechanics: [],
    flavor: "Sembra un cespuglio. Lo è. Ma morde.",
  },
  hookhorror: {
    id: "hookhorror", name: "Orrore Uncinato", image: "/assets/pets/hookhorror.png", icon: "🦀",
    element: "earth", rarity: "rare", cost: 3, atk: 3, hp: 4,
    mechanics: ["pierce"],
    flavor: "Gli uncini agganciano la pietra, e tutto il resto.",
  },
  shamblingmound: {
    id: "shamblingmound", name: "Cumulo Strisciante", image: "/assets/pets/shamblingmound.png", icon: "🌳",
    element: "earth", rarity: "rare", cost: 4, atk: 3, hp: 6,
    mechanics: ["bulwark", "veil"],
    flavor: "Marcisce. Si rialza. Marcisce di nuovo. Cammina.",
  },
  crystalgolem: {
    id: "crystalgolem", name: "Golem di Cristallo", image: "/assets/pets/crystalgolem.png", icon: "💎",
    element: "earth", rarity: "epic", cost: 5, atk: 4, hp: 8,
    mechanics: ["bulwark", "vanguard"],
    flavor: "Riflette ogni colpo prima di restituirlo come una sentenza.",
  },
  irongolem: {
    id: "irongolem", name: "Golem di Ferro", image: "/assets/pets/irongolem.png", icon: "🤖",
    element: "earth", rarity: "epic", cost: 7, atk: 7, hp: 8,
    mechanics: ["bulwark", "pierce"],
    flavor: "Una fortezza che cammina, dimenticata da chi l'ha forgiata.",
  },
  ankylosaurus: {
    id: "ankylosaurus", name: "Anchilosauro", image: "/assets/pets/ankylosaurus.png", icon: "🦕",
    element: "earth", rarity: "legendary", cost: 8, atk: 7, hp: 11,
    mechanics: ["bulwark", "reckon", "cinder"],
    flavor: "La sua coda spacca le montagne. La sua morte le fa tremare.",
  },

  /* ── AIR 💨 ───────────────────────────────────── */
  hawk: {
    id: "hawk", name: "Falco", image: "/assets/pets/hawk.png", icon: "🦅",
    element: "air", rarity: "common", cost: 1, atk: 2, hp: 1,
    mechanics: ["surge"],
    flavor: "Vede il topo prima che il topo si veda.",
  },
  wingedkobold: {
    id: "wingedkobold", name: "Kobold Alato", image: "/assets/pets/wingedkobold.png", icon: "🦖",
    element: "air", rarity: "common", cost: 2, atk: 2, hp: 2,
    mechanics: ["surge", "cinder"],
    flavor: "Si schianta con stile. Sempre.",
  },
  airelemental: {
    id: "airelemental", name: "Elementale dell'Aria", image: "/assets/pets/airelemental.png", icon: "🌬",
    element: "air", rarity: "rare", cost: 3, atk: 3, hp: 3,
    mechanics: ["surge", "pierce"],
    flavor: "Non lo afferri. Lo respiri. E ti taglia dentro.",
  },
  peryton: {
    id: "peryton", name: "Periton", image: "/assets/pets/peryton.png", icon: "🦌",
    element: "air", rarity: "rare", cost: 3, atk: 4, hp: 2,
    mechanics: ["surge", "pierce"],
    flavor: "L'ombra di un cervo, gli artigli di un'aquila.",
  },
  manticore: {
    id: "manticore", name: "Manticora", image: "/assets/pets/manticore.png", icon: "🦁",
    element: "air", rarity: "rare", cost: 4, atk: 4, hp: 4,
    mechanics: ["pierce"],
    flavor: "Faccia umana, voce di leone, code piene di lance.",
  },
  djinni: {
    id: "djinni", name: "Djinni", image: "/assets/pets/djinni.png", icon: "🧞",
    element: "air", rarity: "epic", cost: 5, atk: 5, hp: 6,
    mechanics: ["surge", "vanguard"],
    flavor: "Genio dei cieli. I tuoi tre desideri non basteranno.",
  },
  stormelemental: {
    id: "stormelemental", name: "Elementale di Tempesta", image: "/assets/pets/stormelemental.png", icon: "⛈",
    element: "air", rarity: "epic", cost: 6, atk: 6, hp: 6,
    mechanics: ["surge", "pierce", "cinder"],
    flavor: "Tuono che cammina. Pioggia che taglia.",
  },
  tempestdragon: {
    id: "tempestdragon", name: "Drago della Tempesta", image: "/assets/pets/tempestdragon.png", icon: "🌩",
    element: "air", rarity: "legendary", cost: 8, atk: 8, hp: 9,
    mechanics: ["surge", "pierce", "vanguard"],
    flavor: "Vola sopra le nuvole. Scende sotto forma di sentenza.",
  },

  /* ── LIGHT ✨ ─────────────────────────────────── */
  pegasus: {
    id: "pegasus", name: "Pegaso", image: "/assets/pets/pegasus.png", icon: "🦄",
    element: "light", rarity: "common", cost: 2, atk: 2, hp: 3,
    mechanics: ["soulburn"],
    flavor: "Le sue ali profumano di alba.",
  },
  copperdragon: {
    id: "copperdragon", name: "Drago di Rame", image: "/assets/pets/copperdragon.png", icon: "🐲",
    element: "light", rarity: "rare", cost: 4, atk: 4, hp: 4,
    mechanics: ["soulburn", "vanguard"],
    flavor: "Burlone delle terre soleggiate. Sa anche essere serio.",
  },
  helmedhorror: {
    id: "helmedhorror", name: "Orrore Elmato", image: "/assets/pets/helmedhorror.png", icon: "⚔",
    element: "light", rarity: "rare", cost: 4, atk: 3, hp: 5,
    mechanics: ["bulwark", "vanguard"],
    flavor: "Armatura senz'anima, giuramento eterno al suo signore.",
  },
  satyr: {
    id: "satyr", name: "Satiro", image: "/assets/pets/satyr.png", icon: "🐐",
    element: "light", rarity: "common", cost: 1, atk: 1, hp: 2,
    mechanics: ["veil"],
    flavor: "Suona, balla, ricresce sotto la luna piena.",
  },
  solar: {
    id: "solar", name: "Solare", image: "/assets/pets/solar.png", icon: "🌟",
    element: "light", rarity: "legendary", cost: 9, atk: 8, hp: 10,
    mechanics: ["vanguard", "soulburn", "veil"],
    flavor: "Un angelo della guerra. Un angelo della guerra giusta.",
  },

  /* ── DARK 🌑 ──────────────────────────────────── */
  zombie: {
    id: "zombie", name: "Zombi", image: "/assets/pets/zombie.png", icon: "🧟",
    element: "dark", rarity: "common", cost: 1, atk: 1, hp: 3,
    mechanics: ["veil"],
    flavor: "Già morto una volta. Cosa potrà mai andare storto?",
  },
  manes: {
    id: "manes", name: "Manes", image: "/assets/pets/manes.png", icon: "👹",
    element: "dark", rarity: "common", cost: 1, atk: 2, hp: 1,
    mechanics: ["cinder"],
    flavor: "Anima dannata, urla anche dopo la morte.",
  },
  specter: {
    id: "specter", name: "Spettro", image: "/assets/pets/specter.png", icon: "👻",
    element: "dark", rarity: "rare", cost: 3, atk: 3, hp: 3,
    mechanics: ["pierce", "soulburn"],
    flavor: "Ti svuota di vita. Si nutre del tuo respiro.",
  },
  wight: {
    id: "wight", name: "Wight", image: "/assets/pets/wight.png", icon: "💀",
    element: "dark", rarity: "rare", cost: 3, atk: 4, hp: 2,
    mechanics: ["soulburn"],
    flavor: "Ogni vittima diventa carne dell'esercito.",
  },
  nightmare: {
    id: "nightmare", name: "Incubo", image: "/assets/pets/nightmare.png", icon: "🐴",
    element: "dark", rarity: "epic", cost: 5, atk: 6, hp: 5,
    mechanics: ["surge", "cinder"],
    flavor: "Galoppa nei sogni. Atterra nei tuoi peggiori.",
  },
  mindflayer: {
    id: "mindflayer", name: "Mente Adunca", image: "/assets/pets/mindflayer.png", icon: "🦑",
    element: "dark", rarity: "epic", cost: 6, atk: 5, hp: 6,
    mechanics: ["reckon", "soulburn"],
    flavor: "Estrae il cervello. Ne fa un pasto. Lo serve a sé stesso.",
  },
  lich: {
    id: "lich", name: "Lich", image: "/assets/pets/lich.png", icon: "☠",
    element: "dark", rarity: "legendary", cost: 8, atk: 7, hp: 9,
    mechanics: ["reckon", "veil", "soulburn"],
    flavor: "Ha sconfitto la morte. Ora la usa come arma.",
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
   foil — independent of rarity. Foils are purely cosmetic
   (a holographic shimmer effect) but very rare and prized.
   Starter packs intentionally never roll foils so the
   wonder is reserved for the shop. */
export const FOIL_RATE = 0.025; // 2.5% per card

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
   player. Distribution: 14 commons, 5 rares, 1 epic — heavily
   biased toward the chosen element. Foils don't drop from
   starter — only from purchased packs. */
export function openStarterPack(element) {
  if (!PACK_DEFS[element]) return [];
  const bias = 0.85;
  const slots = [
    ...Array(14).fill("common"),
    ...Array(5).fill("rare"),
    ...Array(1).fill("epic"),
  ];
  return slots.map(r => ({
    cardId: pickCardId(element, r, bias),
    foil: false,
  }));
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
