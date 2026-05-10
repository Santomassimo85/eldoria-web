/* ============================================================
   PET SPECIES catalog — 34 D&D monsters, hatchable companions.
   ------------------------------------------------------------
   Distribution by rarity:
     · 21 common  (~62 %)  — easy to roll, low-mid power
     ·  9 rare    (~26 %)  — solid mid-tier specialists
     ·  4 epic    (~12 %)  — bosses-in-a-bottle, very hard to roll

   Per-species data:
     key       — stable id (used in pet.speciesKey on the character doc)
     name      — italian display name
     icon      — emoji used as fallback sprite
     image     — path under /public for the avatar (png/jpg/webp).
                 If the file is missing, the UI falls back to `icon`.
     type      — element (fire | water | earth | air | neutral)
     rarity    — common | rare | epic
     desc      — short flavor (italian, kept under one line)
     base      — { hp, ac, atk, spd } @ level 1
     attacks   — 1-2 unlimited basic attacks (small dice)
     skills    — 1-2 limited-use specials (bigger dice + effects)

   Move unlock: attacks all start at level 1. skills[0] unlocks at
   level 4, skills[1] at level 10. See SKILL_UNLOCK_LEVELS below.
   ============================================================ */

export const PET_RARITIES = ["common", "rare", "epic"];

export const RARITY_LABEL = {
  common: "Comune",
  rare:   "Raro",
  epic:   "Epico",
};

export const RARITY_COLOR = {
  common: "#8a7a4a",
  rare:   "#2e7aa8",
  epic:   "#7d2929",
};

/* Skill unlock thresholds — index aligns with species.skills */
export const SKILL_UNLOCK_LEVELS = [4, 10];

export const PET_SPECIES = {

  // ──────────────────────────────────────────────────────────
  // COMMONS · 21 species
  // ──────────────────────────────────────────────────────────

  // Fire 🔥
  kobold: {
    key: "kobold", name: "Kobold", icon: "🦖", image: "/assets/pets/kobold.png",
    type: "fire", rarity: "common",
    desc: "Lucertoletta scaltra del clan dei draghi · piccola, veloce, sfacciata.",
    base: { hp: 18, ac: 13, atk: 4, spd: 8 },
    attacks: ["claw"],
    skills: ["ember", "guard"],
  },
  smokemephit: {
    key: "smokemephit", name: "Mefite del Fumo", icon: "💨", image: "/assets/pets/smokemephit.png",
    type: "fire", rarity: "common",
    desc: "Spiritello di brace e cenere · scompare in una nube nera.",
    base: { hp: 20, ac: 13, atk: 4, spd: 7 },
    attacks: ["claw"],
    skills: ["ember", "mist"],
  },
  quasit: {
    key: "quasit", name: "Quasit", icon: "👹", image: "/assets/pets/quasit.png",
    type: "fire", rarity: "common",
    desc: "Demoncino verdolino dell'Abisso · maligno e dispettoso.",
    base: { hp: 19, ac: 13, atk: 5, spd: 7 },
    attacks: ["bite"],
    skills: ["ember", "rest"],
  },

  // Water 💧
  kuotoa: {
    key: "kuotoa", name: "Kuo-Toa", icon: "🐠", image: "/assets/pets/kuotoa.png",
    type: "water", rarity: "common",
    desc: "Uomo-pesce delle profondità · ossessionato da divinità improbabili.",
    base: { hp: 22, ac: 12, atk: 5, spd: 5 },
    attacks: ["tackle"],
    skills: ["bubble", "mist"],
  },
  icemephit: {
    key: "icemephit", name: "Mefite del Ghiaccio", icon: "🧊", image: "/assets/pets/icemephit.png",
    type: "water", rarity: "common",
    desc: "Spiritello di gelo · le sue ali tagliano come schegge cristalline.",
    base: { hp: 20, ac: 13, atk: 5, spd: 6 },
    attacks: ["claw"],
    skills: ["bubble", "guard"],
  },
  lizardfolk: {
    key: "lizardfolk", name: "Lucertoidi", icon: "🦎", image: "/assets/pets/lizardfolk.png",
    type: "water", rarity: "common",
    desc: "Cacciatore palustre · sangue freddo, mascella più fredda.",
    base: { hp: 24, ac: 13, atk: 5, spd: 5 },
    attacks: ["bite"],
    skills: ["bubble", "rest"],
  },

  // Earth 🌿
  myconid: {
    key: "myconid", name: "Myconide", icon: "🍄", image: "/assets/pets/myconid.png",
    type: "earth", rarity: "common",
    desc: "Fungo-uomo silenzioso · comunica con spore allucinogene.",
    base: { hp: 22, ac: 11, atk: 4, spd: 3 },
    attacks: ["tackle"],
    skills: ["spores", "bloom"],
  },
  badger: {
    key: "badger", name: "Tasso Selvatico", icon: "🦡", image: "/assets/pets/badger.png",
    type: "earth", rarity: "common",
    desc: "Piccolo ma feroce · non molla la presa per niente al mondo.",
    base: { hp: 18, ac: 12, atk: 6, spd: 7 },
    attacks: ["bite", "pounce"],
    skills: ["rest"],
  },
  twigblight: {
    key: "twigblight", name: "Spina Striante", icon: "🌿", image: "/assets/pets/twigblight.png",
    type: "earth", rarity: "common",
    desc: "Sterpaglia animata da magia infetta · cammina, graffia, ride.",
    base: { hp: 20, ac: 13, atk: 5, spd: 5 },
    attacks: ["claw"],
    skills: ["vine", "spores"],
  },
  goblin: {
    key: "goblin", name: "Goblin", icon: "👺", image: "/assets/pets/goblin.png",
    type: "earth", rarity: "common",
    desc: "Predone delle caverne · vile, sgusciante, sorprendentemente coriaceo.",
    base: { hp: 20, ac: 13, atk: 4, spd: 7 },
    attacks: ["claw"],
    skills: ["vine", "rest"],
  },
  orc: {
    key: "orc", name: "Orco", icon: "🪓", image: "/assets/pets/orc.png",
    type: "earth", rarity: "common",
    desc: "Guerriero brutale dei monti · vive per la battaglia.",
    base: { hp: 24, ac: 12, atk: 6, spd: 5 },
    attacks: ["slam"],
    skills: ["quake", "rest"],
  },
  rust: {
    key: "rust", name: "Mostro della Ruggine", icon: "🪲", image: "/assets/pets/rust.png",
    type: "earth", rarity: "common",
    desc: "Insettoide affamato di metalli · le antenne corrodono l'acciaio.",
    base: { hp: 22, ac: 14, atk: 5, spd: 4 },
    attacks: ["bite"],
    skills: ["vine", "guard"],
  },
  axebeak: {
    key: "axebeak", name: "Becco-Ascia", icon: "🦃", image: "/assets/pets/axebeak.png",
    type: "earth", rarity: "common",
    desc: "Uccello incapace di volare · becco affilato come un'ascia.",
    base: { hp: 22, ac: 11, atk: 6, spd: 7 },
    attacks: ["bite", "pounce"],
    skills: ["rest"],
  },
  satyr: {
    key: "satyr", name: "Satiro", icon: "🐐", image: "/assets/pets/satyr.png",
    type: "earth", rarity: "common",
    desc: "Folletto silvano · suona il flauto, ruba il cuore, fugge in fretta.",
    base: { hp: 22, ac: 12, atk: 4, spd: 7 },
    attacks: ["claw"],
    skills: ["bloom", "vine"],
  },
  ochrejelly: {
    key: "ochrejelly", name: "Gelatina Ocra", icon: "🟡", image: "/assets/pets/ochrejelly.png",
    type: "earth", rarity: "common",
    desc: "Massa acida giallastra · si divide quando colpita.",
    base: { hp: 28, ac: 10, atk: 4, spd: 2 },
    attacks: ["tackle"],
    skills: ["spores", "rest"],
  },

  // Air ⚡
  hawk: {
    key: "hawk", name: "Falco", icon: "🦅", image: "/assets/pets/hawk.png",
    type: "air", rarity: "common",
    desc: "Predatore alato dei cieli · veloce e implacabile dall'alto.",
    base: { hp: 14, ac: 13, atk: 4, spd: 9 },
    attacks: ["claw"],
    skills: ["spark", "gust"],
  },
  grell: {
    key: "grell", name: "Grell", icon: "🦑", image: "/assets/pets/grell.png",
    type: "air", rarity: "common",
    desc: "Cervello fluttuante con tentacoli · paralizza con un tocco.",
    base: { hp: 20, ac: 12, atk: 5, spd: 5 },
    attacks: ["tackle"],
    skills: ["spark", "drain"],
  },
  specter: {
    key: "specter", name: "Spettro", icon: "👻", image: "/assets/pets/specter.png",
    type: "air", rarity: "common",
    desc: "Anima impigliata tra i mondi · attraversa i muri, drena la vita.",
    base: { hp: 18, ac: 13, atk: 5, spd: 7 },
    attacks: ["claw"],
    skills: ["drain", "thunder"],
  },

  // Neutral ✦
  wight: {
    key: "wight", name: "Wight", icon: "💀", image: "/assets/pets/wight.png",
    type: "neutral", rarity: "common",
    desc: "Guerriero non-morto · brama vita altrui per nutrire la sua maledizione.",
    base: { hp: 24, ac: 13, atk: 5, spd: 5 },
    attacks: ["slam"],
    skills: ["drain", "guard"],
  },
  bugbear: {
    key: "bugbear", name: "Bugbear", icon: "🪓", image: "/assets/pets/bugbear.png",
    type: "neutral", rarity: "common",
    desc: "Goblinoide gigante · si muove silenzioso prima dello schianto.",
    base: { hp: 24, ac: 12, atk: 6, spd: 5 },
    attacks: ["slam", "crush"],
    skills: ["rest"],
  },
  quaggoth: {
    key: "quaggoth", name: "Quaggoth", icon: "🦍", image: "/assets/pets/quaggoth.png",
    type: "neutral", rarity: "common",
    desc: "Bestione delle profondità · pelo bianco macchiato di sangue.",
    base: { hp: 26, ac: 12, atk: 6, spd: 6 },
    attacks: ["claw"],
    skills: ["rest", "guard"],
  },

  // ──────────────────────────────────────────────────────────
  // RARES · 9 species
  // ──────────────────────────────────────────────────────────

  // Fire 🔥
  spineddevil: {
    key: "spineddevil", name: "Diavolo Spinoso", icon: "😈", image: "/assets/pets/spineddevil.png",
    type: "fire", rarity: "rare",
    desc: "Diavolo minore degli inferi · scaglia spine roventi a distanza.",
    base: { hp: 28, ac: 14, atk: 6, spd: 6 },
    attacks: ["claw", "tackle"],
    skills: ["ember", "inferno"],
  },

  // Water 💧
  sahuagin: {
    key: "sahuagin", name: "Sahuagin", icon: "🦈", image: "/assets/pets/sahuagin.png",
    type: "water", rarity: "rare",
    desc: "Predatore squaliforme · scatena frenesia alla vista del sangue.",
    base: { hp: 28, ac: 13, atk: 6, spd: 7 },
    attacks: ["bite", "claw"],
    skills: ["tidal", "rest"],
  },
  greenhag: {
    key: "greenhag", name: "Strega Verde", icon: "🧙", image: "/assets/pets/greenhag.png",
    type: "water", rarity: "rare",
    desc: "Megera delle paludi · maledizioni mormorate sull'acqua stagnante.",
    base: { hp: 30, ac: 13, atk: 5, spd: 5 },
    attacks: ["claw"],
    skills: ["tidal", "drain"],
  },

  // Earth 🌿
  dryad: {
    key: "dryad", name: "Driade", icon: "🌳", image: "/assets/pets/dryad.png",
    type: "earth", rarity: "rare",
    desc: "Spirito del bosco · custode silenziosa delle querce millenarie.",
    base: { hp: 28, ac: 13, atk: 5, spd: 6 },
    attacks: ["claw"],
    skills: ["bloom", "vine"],
  },
  direwolf: {
    key: "direwolf", name: "Lupo Terribile", icon: "🐺", image: "/assets/pets/direwolf.png",
    type: "earth", rarity: "rare",
    desc: "Predatore mastodontico · zanne che spezzano lo scudo, ululato che gela il sangue.",
    base: { hp: 30, ac: 13, atk: 7, spd: 7 },
    attacks: ["bite", "pounce"],
    skills: ["rest", "guard"],
  },
  hookhorror: {
    key: "hookhorror", name: "Orrore Uncinato", icon: "🦞", image: "/assets/pets/hookhorror.png",
    type: "earth", rarity: "rare",
    desc: "Bestiale predatore sotterraneo · uncini che strappano l'armatura.",
    base: { hp: 32, ac: 14, atk: 7, spd: 5 },
    attacks: ["claw", "bite"],
    skills: ["quake", "guard"],
  },

  // Air ⚡
  peryton: {
    key: "peryton", name: "Periton", icon: "🦌", image: "/assets/pets/peryton.png",
    type: "air", rarity: "rare",
    desc: "Cervo alato dall'ombra umana · piomba dal cielo per strappare cuori.",
    base: { hp: 28, ac: 13, atk: 6, spd: 8 },
    attacks: ["bite", "claw"],
    skills: ["thunder", "drain"],
  },
  airelemental: {
    key: "airelemental", name: "Elementale dell'Aria", icon: "🌪", image: "/assets/pets/airelemental.png",
    type: "air", rarity: "rare",
    desc: "Vortice senziente · turbina e travolge senza lasciare il segno.",
    base: { hp: 26, ac: 13, atk: 5, spd: 8 },
    attacks: ["tackle"],
    skills: ["thunder", "gust"],
  },

  // Neutral ✦
  centaur: {
    key: "centaur", name: "Centauro", icon: "🐴", image: "/assets/pets/centaur.png",
    type: "neutral", rarity: "rare",
    desc: "Guerriero metà uomo metà cavallo · galoppo e lancia, equilibrio perfetto.",
    base: { hp: 30, ac: 13, atk: 6, spd: 8 },
    attacks: ["bite", "slam"],
    skills: ["thunder", "rest"],
  },

  // ──────────────────────────────────────────────────────────
  // EPICS · 4 species
  // ──────────────────────────────────────────────────────────

  frostgiant: {
    key: "frostgiant", name: "Gigante del Gelo", icon: "🥶", image: "/assets/pets/frostgiant.png",
    type: "water", rarity: "epic",
    desc: "Titano delle terre artiche · ogni martellata fa tremare il ghiaccio.",
    base: { hp: 38, ac: 15, atk: 8, spd: 4 },
    attacks: ["slam", "crush"],
    skills: ["tidal", "guard"],
  },
  gelatinouscube: {
    key: "gelatinouscube", name: "Cubo Gelatinoso", icon: "🟦", image: "/assets/pets/gelatinouscube.png",
    type: "water", rarity: "epic",
    desc: "Tomba semovente dei sotterranei · digerisce tutto ciò che ingoia.",
    base: { hp: 42, ac: 11, atk: 6, spd: 2 },
    attacks: ["tackle", "crush"],
    skills: ["tidal", "rest"],
  },
  ankylosaurus: {
    key: "ankylosaurus", name: "Anchilosauro", icon: "🦕", image: "/assets/pets/ankylosaurus.png",
    type: "earth", rarity: "epic",
    desc: "Carro armato preistorico · armatura di osso, coda come una mazza.",
    base: { hp: 42, ac: 17, atk: 8, spd: 3 },
    attacks: ["slam", "crush"],
    skills: ["quake", "guard"],
  },
  braineater: {
    key: "braineater", name: "Divoratore di Intelletto", icon: "🧠", image: "/assets/pets/braineater.png",
    type: "neutral", rarity: "epic",
    desc: "Aberrazione mind-flayer · scava nei crani per nutrirsi di pensieri.",
    base: { hp: 30, ac: 13, atk: 7, spd: 7 },
    attacks: ["claw", "bite"],
    skills: ["drain", "thunder"],
  },

};

/* ============================================================
   EGG HATCH POOLS — weighted random species per rarity tier.
   ============================================================ */

const COMMON_KEYS = [
  // 21 commons
  "kobold", "smokemephit", "quasit",
  "kuotoa", "icemephit", "lizardfolk",
  "myconid", "badger", "twigblight", "goblin", "orc", "rust", "axebeak", "satyr", "ochrejelly",
  "hawk", "grell", "specter",
  "wight", "bugbear", "quaggoth",
];
const RARE_KEYS = [
  // 9 rares
  "spineddevil",
  "sahuagin", "greenhag",
  "dryad", "direwolf", "hookhorror",
  "peryton", "airelemental",
  "centaur",
];
const EPIC_KEYS = [
  // 4 epics
  "frostgiant", "gelatinouscube", "ankylosaurus", "braineater",
];

function buildPool(commonW, rareW, epicW) {
  const out = [];
  const cEach = commonW / COMMON_KEYS.length;
  const rEach = rareW   / RARE_KEYS.length;
  const eEach = epicW   / EPIC_KEYS.length;
  COMMON_KEYS.forEach(key => out.push({ key, weight: cEach }));
  RARE_KEYS.forEach(key   => out.push({ key, weight: rEach }));
  EPIC_KEYS.forEach(key   => out.push({ key, weight: eEach }));
  return out;
}

export const HATCH_POOLS = {
  // 80% common · 18% rare · 2% epic
  common: buildPool(0.80, 0.18, 0.02),
  // 50% common · 42% rare · 8% epic
  rare:   buildPool(0.50, 0.42, 0.08),
  // 25% common · 50% rare · 25% epic
  epic:   buildPool(0.25, 0.50, 0.25),
};

export const EGG_COST = {
  common: 25,
  rare:   75,
  epic:   180,
};

export const EGG_ICON = {
  common: "🥚",
  rare:   "🟦",
  epic:   "🟪",
};
