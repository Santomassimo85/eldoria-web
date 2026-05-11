/* ============================================================
   PET SPECIES catalog — 76 D&D monsters, hatchable companions.
   ------------------------------------------------------------
   Distribution by rarity:
     · 30 common      — easy to roll, low-mid power
     · 22 rare        — solid mid-tier specialists
     · 14 epic        — bosses-in-a-bottle, very hard to roll
     · 10 legendary   — apex tier, ultra-rare even on epic eggs

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

export const PET_RARITIES = ["common", "rare", "epic", "legendary"];

export const RARITY_LABEL = {
  common:    "Comune",
  rare:      "Raro",
  epic:      "Epico",
  legendary: "Leggendario",
};

export const RARITY_COLOR = {
  common:    "#8a7a4a",
  rare:      "#2e7aa8",
  epic:      "#7d2929",
  legendary: "#b45309",
};

/* Skill unlock thresholds — index aligns with species.skills.
   With the L10 cap: skill[0] @ L3, skill[1] @ L7, skill[2] @ L10
   (only legendaries currently use a third skill slot). */
export const SKILL_UNLOCK_LEVELS = [3, 7, 10];

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
    skills: ["ember", "firewall"],
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
    type: "light", rarity: "common",
    desc: "Folletto silvano dei boschi luminosi · suona il flauto, ruba il cuore, fugge in fretta.",
    base: { hp: 22, ac: 12, atk: 4, spd: 7 },
    attacks: ["claw"],
    skills: ["lightbeam", "blessing"],
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
    type: "dark", rarity: "common",
    desc: "Anima impigliata tra i mondi · attraversa i muri, drena la vita.",
    base: { hp: 18, ac: 13, atk: 5, spd: 7 },
    attacks: ["claw"],
    skills: ["drain", "voidstrike"],
  },

  // Neutral ✦
  wight: {
    key: "wight", name: "Wight", icon: "💀", image: "/assets/pets/wight.png",
    type: "dark", rarity: "common",
    desc: "Guerriero non-morto · brama vita altrui per nutrire la sua maledizione.",
    base: { hp: 24, ac: 13, atk: 5, spd: 5 },
    attacks: ["slam"],
    skills: ["drain", "shadowbolt"],
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

  // ── New commons ──
  imp: {
    key: "imp", name: "Imp", icon: "😈", image: "/assets/pets/imp.png",
    type: "fire", rarity: "common",
    desc: "Diavoletto rosso alato · scaltro, infido, coda con pungiglione velenoso.",
    base: { hp: 18, ac: 13, atk: 5, spd: 8 },
    attacks: ["claw"],
    skills: ["ember", "rest"],
  },
  merfolk: {
    key: "merfolk", name: "Tritone", icon: "🧜", image: "/assets/pets/merfolk.png",
    type: "water", rarity: "common",
    desc: "Guerriero delle correnti profonde · tridente e canto di sirena.",
    base: { hp: 22, ac: 12, atk: 5, spd: 6 },
    attacks: ["tackle"],
    skills: ["bubble", "mist"],
  },
  mudmephit: {
    key: "mudmephit", name: "Mefite del Fango", icon: "🟫", image: "/assets/pets/mudmephit.png",
    type: "earth", rarity: "common",
    desc: "Spiritello di melma · le ali fangose schizzano nelle fauci nemiche.",
    base: { hp: 20, ac: 12, atk: 4, spd: 5 },
    attacks: ["tackle"],
    skills: ["vine", "spores"],
  },
  kenku: {
    key: "kenku", name: "Kenku", icon: "🐦", image: "/assets/pets/kenku.png",
    type: "air", rarity: "common",
    desc: "Uomo-corvo senza ali · ladruncolo mutico che imita ogni voce.",
    base: { hp: 18, ac: 13, atk: 5, spd: 8 },
    attacks: ["claw", "pounce"],
    skills: ["gust"],
  },
  halforc: {
    key: "halforc", name: "Mezzorco", icon: "🪓", image: "/assets/pets/halforc.png",
    type: "neutral", rarity: "common",
    desc: "Guerriero figlio di due mondi · forza orchesca, astuzia umana.",
    base: { hp: 24, ac: 13, atk: 6, spd: 6 },
    attacks: ["slam"],
    skills: ["guard", "rest"],
  },
  manes: {
    key: "manes", name: "Manes", icon: "🩸", image: "/assets/pets/manes.png",
    type: "dark", rarity: "common",
    desc: "Anima dannata trasformata in demone informe · pulsa di carne marcia.",
    base: { hp: 22, ac: 11, atk: 5, spd: 4 },
    attacks: ["claw", "bite"],
    skills: ["drain", "rest"],
  },
  nothic: {
    key: "nothic", name: "Notico", icon: "👁", image: "/assets/pets/nothic.png",
    type: "dark", rarity: "common",
    desc: "Aberrazione monocola · scruta l'anima e si nutre di segreti.",
    base: { hp: 20, ac: 13, atk: 5, spd: 6 },
    attacks: ["claw"],
    skills: ["drain", "shadowbolt"],
  },
  ogrezombie: {
    key: "ogrezombie", name: "Ogre Zombie", icon: "🧟", image: "/assets/pets/ogrezombie.png",
    type: "dark", rarity: "common",
    desc: "Ogre rianimato · carne marcia, mazza ancora più grossa.",
    base: { hp: 26, ac: 11, atk: 6, spd: 3 },
    attacks: ["slam", "crush"],
    skills: ["rest"],
  },
  deathdog: {
    key: "deathdog", name: "Cane della Morte", icon: "🐕", image: "/assets/pets/deathdog.png",
    type: "dark", rarity: "common",
    desc: "Mastino bicefalo delle terre marce · morsi che corrompono la carne.",
    base: { hp: 22, ac: 12, atk: 6, spd: 7 },
    attacks: ["bite", "pounce"],
    skills: ["drain"],
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
    skills: ["quake", "rockslide"],
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
    skills: ["thunder", "aircutter"],
  },

  // Neutral ✦
  centaur: {
    key: "centaur", name: "Centauro", icon: "🐴", image: "/assets/pets/centaur.png",
    type: "light", rarity: "rare",
    desc: "Guardiano metà uomo metà cavallo · cuore puro, galoppo che brucia l'oscurità.",
    base: { hp: 30, ac: 13, atk: 6, spd: 8 },
    attacks: ["bite", "slam"],
    skills: ["radiance", "solarflare"],
  },

  // ── New rares ──
  hellhound: {
    key: "hellhound", name: "Mastino Infernale", icon: "🐕‍🦺", image: "/assets/pets/hellhound.png",
    type: "fire", rarity: "rare",
    desc: "Cane degli inferi · zanne che bruciano e occhi di carbone ardente.",
    base: { hp: 28, ac: 13, atk: 7, spd: 8 },
    attacks: ["bite", "pounce"],
    skills: ["ember", "firewall"],
  },
  halfdragon: {
    key: "halfdragon", name: "Mezzodrago Veterano", icon: "🐲", image: "/assets/pets/halfdragon.png",
    type: "fire", rarity: "rare",
    desc: "Soldato dalle squame rosse · stirpe draconica nel sangue, soffio di fiamme in gola.",
    base: { hp: 32, ac: 14, atk: 7, spd: 6 },
    attacks: ["slam", "claw"],
    skills: ["ember", "firewall"],
  },
  nightmare: {
    key: "nightmare", name: "Incubo", icon: "🐎", image: "/assets/pets/nightmare.png",
    type: "fire", rarity: "rare",
    desc: "Stallone infernale · zoccoli che bruciano la terra, criniera di fuoco vivo.",
    base: { hp: 30, ac: 13, atk: 7, spd: 9 },
    attacks: ["slam", "pounce"],
    skills: ["ember", "firewall"],
  },
  troll: {
    key: "troll", name: "Troll", icon: "🧌", image: "/assets/pets/troll.png",
    type: "earth", rarity: "rare",
    desc: "Gigante verde rigenerante · solo il fuoco arresta le sue ferite.",
    base: { hp: 34, ac: 13, atk: 7, spd: 5 },
    attacks: ["claw", "bite"],
    skills: ["bloom", "rest"],
  },
  pegasus: {
    key: "pegasus", name: "Pegaso", icon: "🦄", image: "/assets/pets/pegasus.png",
    type: "light", rarity: "rare",
    desc: "Destriero alato dei cieli benedetti · galoppa tra le nubi del mattino.",
    base: { hp: 28, ac: 13, atk: 6, spd: 9 },
    attacks: ["slam", "pounce"],
    skills: ["lightbeam", "blessing"],
  },
  helmedhorror: {
    key: "helmedhorror", name: "Orrore Elmato", icon: "🛡", image: "/assets/pets/helmedhorror.png",
    type: "neutral", rarity: "rare",
    desc: "Armatura animata da magia oscura · scudo torreggiante, spada implacabile.",
    base: { hp: 32, ac: 15, atk: 6, spd: 5 },
    attacks: ["slam", "crush"],
    skills: ["guard", "rest"],
  },
  manticore: {
    key: "manticore", name: "Mantícora", icon: "🦁", image: "/assets/pets/manticore.png",
    type: "neutral", rarity: "rare",
    desc: "Leone alato con coda di spine · scaglia dardi mortali dalla distanza.",
    base: { hp: 30, ac: 13, atk: 7, spd: 8 },
    attacks: ["bite", "claw"],
    skills: ["gust", "rest"],
  },
  owlbear: {
    key: "owlbear", name: "Gufo-Orso", icon: "🦉", image: "/assets/pets/owlbear.png",
    type: "neutral", rarity: "rare",
    desc: "Ibrido feroce tra orso e gufo · becco affilato, abbraccio mortale.",
    base: { hp: 34, ac: 13, atk: 7, spd: 6 },
    attacks: ["bite", "claw"],
    skills: ["rest", "guard"],
  },
  jackalwere: {
    key: "jackalwere", name: "Sciacallo Mannaro", icon: "🐺", image: "/assets/pets/jackalwere.png",
    type: "dark", rarity: "rare",
    desc: "Mutaforma sciacallo · ipnotizza con lo sguardo prima di azzannare.",
    base: { hp: 28, ac: 13, atk: 7, spd: 8 },
    attacks: ["bite", "claw"],
    skills: ["drain", "shadowbolt"],
  },
  lamia: {
    key: "lamia", name: "Lamia", icon: "🐍", image: "/assets/pets/lamia.png",
    type: "dark", rarity: "rare",
    desc: "Maledizione femminile metà belva · seduce, poi divora la mente.",
    base: { hp: 30, ac: 13, atk: 6, spd: 7 },
    attacks: ["claw"],
    skills: ["dread", "voidstrike"],
  },
  nighthag: {
    key: "nighthag", name: "Strega Notturna", icon: "🧙‍♀", image: "/assets/pets/nighthag.png",
    type: "dark", rarity: "rare",
    desc: "Megera dei sogni · ruba anime mentre i mortali dormono.",
    base: { hp: 30, ac: 13, atk: 6, spd: 6 },
    attacks: ["claw"],
    skills: ["dread", "nightveil"],
  },
  minotaurskeleton: {
    key: "minotaurskeleton", name: "Scheletro Minotauro", icon: "🦴", image: "/assets/pets/minotaurskeleton.png",
    type: "dark", rarity: "rare",
    desc: "Minotauro non-morto · carica di ossa e accetta arrugginita.",
    base: { hp: 30, ac: 13, atk: 7, spd: 6 },
    attacks: ["slam", "crush"],
    skills: ["dread", "rest"],
  },
  oni: {
    key: "oni", name: "Oni", icon: "👹", image: "/assets/pets/oni.png",
    type: "dark", rarity: "rare",
    desc: "Orco-demone mutaforma · scivola tra le ombre vestendo pelle umana.",
    base: { hp: 32, ac: 14, atk: 7, spd: 6 },
    attacks: ["slam", "claw"],
    skills: ["dread", "nightveil"],
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
    skills: ["tidal", "frostlance"],
  },
  gelatinouscube: {
    key: "gelatinouscube", name: "Cubo Gelatinoso", icon: "🟦", image: "/assets/pets/gelatinouscube.png",
    type: "water", rarity: "epic",
    desc: "Tomba semovente dei sotterranei · digerisce tutto ciò che ingoia.",
    base: { hp: 42, ac: 11, atk: 6, spd: 2 },
    attacks: ["tackle", "crush"],
    skills: ["tidal", "tidalheal"],
  },
  ankylosaurus: {
    key: "ankylosaurus", name: "Anchilosauro", icon: "🦕", image: "/assets/pets/ankylosaurus.png",
    type: "earth", rarity: "epic",
    desc: "Carro armato preistorico · armatura di osso, coda come una mazza.",
    base: { hp: 42, ac: 17, atk: 8, spd: 3 },
    attacks: ["slam", "crush"],
    skills: ["quake", "stonewall"],
  },
  braineater: {
    key: "braineater", name: "Divoratore di Intelletto", icon: "🧠", image: "/assets/pets/braineater.png",
    type: "dark", rarity: "epic",
    desc: "Aberrazione mind-flayer · scava nei crani per nutrirsi di pensieri.",
    base: { hp: 30, ac: 13, atk: 7, spd: 7 },
    attacks: ["claw", "bite"],
    skills: ["drain", "dread"],
  },

  // ── New epics ──
  goristro: {
    key: "goristro", name: "Goristro", icon: "🐂", image: "/assets/pets/goristro.png",
    type: "fire", rarity: "epic",
    desc: "Demone-toro dell'Abisso · carica devastante che spezza eserciti.",
    base: { hp: 44, ac: 15, atk: 8, spd: 5 },
    attacks: ["slam", "crush"],
    skills: ["inferno", "pyroblast"],
  },
  marid: {
    key: "marid", name: "Marid", icon: "🧞", image: "/assets/pets/marid.png",
    type: "water", rarity: "epic",
    desc: "Genio dei mari · domina maree e raffiche gelide con un sorriso vanitoso.",
    base: { hp: 40, ac: 15, atk: 7, spd: 7 },
    attacks: ["slam", "tackle"],
    skills: ["tidal", "frostlance"],
  },
  fomorian: {
    key: "fomorian", name: "Fomoriano", icon: "👁‍🗨", image: "/assets/pets/fomorian.png",
    type: "earth", rarity: "epic",
    desc: "Gigante deforme del sottosuolo · maledizione nello sguardo unico.",
    base: { hp: 44, ac: 14, atk: 8, spd: 4 },
    attacks: ["slam", "crush"],
    skills: ["quake", "rockslide"],
  },
  stonegiant: {
    key: "stonegiant", name: "Gigante di Pietra", icon: "🗿", image: "/assets/pets/stonegiant.png",
    type: "earth", rarity: "epic",
    desc: "Titano scolpito nella roccia · ogni martellata fa tremare le caverne.",
    base: { hp: 42, ac: 16, atk: 8, spd: 5 },
    attacks: ["slam", "crush"],
    skills: ["quake", "stonewall"],
  },
  medusa: {
    key: "medusa", name: "Medusa", icon: "🐍", image: "/assets/pets/medusa.png",
    type: "earth", rarity: "epic",
    desc: "Sguardo che pietrifica · chiome di serpenti, anima maledetta.",
    base: { hp: 34, ac: 14, atk: 7, spd: 6 },
    attacks: ["claw", "bite"],
    skills: ["stonewall", "dread"],
  },
  djinni: {
    key: "djinni", name: "Djinni", icon: "🌀", image: "/assets/pets/djinni.png",
    type: "air", rarity: "epic",
    desc: "Genio del cielo · cavalca i venti del piano elementale dell'aria.",
    base: { hp: 38, ac: 15, atk: 7, spd: 9 },
    attacks: ["claw", "tackle"],
    skills: ["thunder", "cyclone"],
  },
  irongolem: {
    key: "irongolem", name: "Golem di Ferro", icon: "🤖", image: "/assets/pets/irongolem.png",
    type: "earth", rarity: "epic",
    desc: "Costrutto di ferro forgiato dagli arcimaghi · immune alla magia minore.",
    base: { hp: 48, ac: 17, atk: 8, spd: 3 },
    attacks: ["slam", "crush"],
    skills: ["quake", "stonewall"],
  },
  hezrou: {
    key: "hezrou", name: "Hezrou", icon: "🐸", image: "/assets/pets/hezrou.png",
    type: "dark", rarity: "epic",
    desc: "Demone rospo dell'Abisso · puzza che fa svenire, artigli che dilaniano.",
    base: { hp: 40, ac: 14, atk: 8, spd: 5 },
    attacks: ["claw", "bite"],
    skills: ["drain", "dread"],
  },
  deathslaad: {
    key: "deathslaad", name: "Slaad della Morte", icon: "🦎", image: "/assets/pets/deathslaad.png",
    type: "dark", rarity: "epic",
    desc: "Rana caotica del Limbo · esistenza che corrompe la realtà.",
    base: { hp: 38, ac: 15, atk: 8, spd: 6 },
    attacks: ["bite", "claw"],
    skills: ["drain", "shadowbolt"],
  },
  nalfeshnee: {
    key: "nalfeshnee", name: "Nalfeshnee", icon: "🦅", image: "/assets/pets/nalfeshnee.png",
    type: "dark", rarity: "epic",
    desc: "Cinghiale demoniaco con ali piumate · grugnito che paralizza l'anima.",
    base: { hp: 44, ac: 14, atk: 8, spd: 5 },
    attacks: ["bite", "slam"],
    skills: ["dread", "voidstrike"],
  },

  // ──────────────────────────────────────────────────────────
  // LEGENDARIES · 4 species (≤ 0.04% even on epic eggs)
  // Higher base stats, 2-3 attacks and 2-3 skills. Third skill
  // unlocks at L10 (level cap), so they reach full power only
  // when fully grown.
  // ──────────────────────────────────────────────────────────

  reddragon: {
    key: "reddragon", name: "Drago Rosso", icon: "🐉", image: "/assets/pets/reddragon.png",
    type: "fire", rarity: "legendary",
    desc: "Tiranno alato delle vette vulcaniche · il suo soffio fonde l'acciaio dei regni.",
    base: { hp: 58, ac: 18, atk: 10, spd: 6 },
    attacks: ["bite", "claw", "slam"],
    skills: ["ember", "inferno", "pyroblast"],
  },
  lich: {
    key: "lich", name: "Lich", icon: "☠", image: "/assets/pets/lich.png",
    type: "dark", rarity: "legendary",
    desc: "Mago non-morto · ha sigillato la sua anima in un fiale per sfuggire alla morte.",
    base: { hp: 50, ac: 17, atk: 9, spd: 7 },
    attacks: ["claw", "tackle"],
    skills: ["drain", "shadowbolt", "dread"],
  },
  mindflayer: {
    key: "mindflayer", name: "Mind Flayer", icon: "🐙", image: "/assets/pets/mindflayer.png",
    type: "dark", rarity: "legendary",
    desc: "Illithid puro · domina la mente prima ancora della carne, padrone dell'Underdark.",
    base: { hp: 52, ac: 16, atk: 9, spd: 8 },
    attacks: ["claw", "bite", "tackle"],
    skills: ["drain", "dread", "nightveil"],
  },
  tempestdragon: {
    key: "tempestdragon", name: "Drago della Tempesta", icon: "🐲", image: "/assets/pets/tempestdragon.png",
    type: "air", rarity: "legendary",
    desc: "Drago della stratosfera · cavalca uragani e scaglia fulmini come dardi.",
    base: { hp: 54, ac: 17, atk: 9, spd: 9 },
    attacks: ["bite", "claw", "pounce"],
    skills: ["spark", "thunder", "cyclone"],
  },
  greendragon: {
    key: "greendragon", name: "Drago Verde", icon: "🐍", image: "/assets/pets/greendragon.png",
    type: "earth", rarity: "legendary",
    desc: "Tiranno delle foreste antiche · soffio velenoso che marcisce intere boscaglie.",
    base: { hp: 56, ac: 18, atk: 10, spd: 6 },
    attacks: ["bite", "claw", "slam"],
    skills: ["spores", "vine", "rockslide"],
  },
  dragonturtle: {
    key: "dragonturtle", name: "Drago Tartaruga", icon: "🐢", image: "/assets/pets/dragonturtle.png",
    type: "water", rarity: "legendary",
    desc: "Leviatano corazzato degli abissi · guscio impenetrabile, soffio di vapore bollente.",
    base: { hp: 64, ac: 19, atk: 10, spd: 5 },
    attacks: ["bite", "slam", "crush"],
    skills: ["tidal", "tidalheal", "stonewall"],
  },
  kraken: {
    key: "kraken", name: "Kraken", icon: "🐙", image: "/assets/pets/kraken.png",
    type: "water", rarity: "legendary",
    desc: "Signore degli oceani · tentacoli sterminatori che inghiottono flotte intere.",
    base: { hp: 60, ac: 17, atk: 10, spd: 7 },
    attacks: ["bite", "claw", "crush"],
    skills: ["tidal", "frostlance", "cyclone"],
  },
  balor: {
    key: "balor", name: "Balor", icon: "🔥", image: "/assets/pets/balor.png",
    type: "fire", rarity: "legendary",
    desc: "Generale dell'Abisso · frusta di fiamme in una mano, spada-fulmine nell'altra.",
    base: { hp: 58, ac: 18, atk: 10, spd: 7 },
    attacks: ["bite", "claw", "slam"],
    skills: ["inferno", "pyroblast", "dread"],
  },
  solar: {
    key: "solar", name: "Solar", icon: "🌟", image: "/assets/pets/solar.png",
    type: "light", rarity: "legendary",
    desc: "Arcangelo del piano celeste · lama che canta inni di luce purissima.",
    base: { hp: 56, ac: 19, atk: 10, spd: 8 },
    attacks: ["slam", "claw", "bite"],
    skills: ["lightbeam", "radiance", "solarflare"],
  },
  ultroloth: {
    key: "ultroloth", name: "Ultroloth", icon: "👤", image: "/assets/pets/ultroloth.png",
    type: "dark", rarity: "legendary",
    desc: "Generale degli yugoloth · sguardo dorato che paralizza, mente che mercanteggia anime.",
    base: { hp: 54, ac: 17, atk: 10, spd: 8 },
    attacks: ["claw", "bite", "tackle"],
    skills: ["drain", "dread", "voidstrike"],
  },

};

/* ============================================================
   EGG HATCH POOLS — weighted random species per rarity tier.
   ============================================================ */

const COMMON_KEYS = [
  // 30 commons
  "kobold", "smokemephit", "quasit", "imp",
  "kuotoa", "icemephit", "lizardfolk", "merfolk",
  "myconid", "badger", "twigblight", "goblin", "orc", "rust", "axebeak", "satyr", "ochrejelly", "mudmephit",
  "hawk", "grell", "kenku",
  "specter", "wight", "manes", "nothic", "ogrezombie", "deathdog",
  "bugbear", "quaggoth", "halforc",
];
const RARE_KEYS = [
  // 22 rares
  "spineddevil", "hellhound", "halfdragon", "nightmare",
  "sahuagin", "greenhag",
  "dryad", "direwolf", "hookhorror", "troll",
  "peryton", "airelemental", "pegasus",
  "centaur",
  "helmedhorror", "manticore", "owlbear",
  "jackalwere", "lamia", "nighthag", "minotaurskeleton", "oni",
];
const EPIC_KEYS = [
  // 14 epics
  "frostgiant", "gelatinouscube", "ankylosaurus", "braineater",
  "goristro", "marid", "fomorian", "stonegiant", "medusa",
  "djinni", "irongolem",
  "hezrou", "deathslaad", "nalfeshnee",
];
const LEGENDARY_KEYS = [
  // 10 legendaries — extremely rare even on epic eggs
  "reddragon", "lich", "mindflayer", "tempestdragon",
  "greendragon", "dragonturtle", "kraken", "balor", "solar", "ultroloth",
];

function buildPool(commonW, rareW, epicW, legendaryW = 0) {
  const out = [];
  const cEach = commonW    / COMMON_KEYS.length;
  const rEach = rareW      / RARE_KEYS.length;
  const eEach = epicW      / EPIC_KEYS.length;
  const lEach = legendaryW / LEGENDARY_KEYS.length;
  COMMON_KEYS.forEach(key    => out.push({ key, weight: cEach }));
  RARE_KEYS.forEach(key      => out.push({ key, weight: rEach }));
  EPIC_KEYS.forEach(key      => out.push({ key, weight: eEach }));
  LEGENDARY_KEYS.forEach(key => out.push({ key, weight: lEach }));
  return out;
}

export const HATCH_POOLS = {
  // 80% common · 18% rare · 1.99% epic · 0.01% legendary
  common: buildPool(0.80, 0.18, 0.0199, 0.0001),
  // 50% common · 42% rare · 7.98% epic · 0.02% legendary
  rare:   buildPool(0.50, 0.42, 0.0798, 0.0002),
  // 25% common · 50% rare · 24.96% epic · 0.04% legendary
  epic:   buildPool(0.25, 0.50, 0.2496, 0.0004),
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
