/* ============================================================
   PET DEX (2026-10-31) — il nuovo sistema pet "alla Pokémon".
   20 creature di D&D in versione cucciola: 5 iniziali (si sceglie
   UNA sola volta, al primo accesso) + 15 da raccogliere (Rifugio coi
   punti pet, Mercato Nero, premi). Per ora visibile solo al Master.
   ------------------------------------------------------------
   Specie:
     key, name, icon (emoji di riserva finché non c'è la pixel art),
     type (fire|water|earth|air|light|dark|neutral, vedi petMoves.js),
     rarity (starter|common|rare|epic|legendary),
     desc   — una riga in italiano per i giocatori
     look   — descrizione in INGLESE per Gemini (cosa disegnare)
     base   — { hp, atk, def, spd } al livello 1
     moves  — 4 mosse: le prime 2 subito, la 3ª al Lv 5, la 4ª al Lv 10
   Le evoluzioni arriveranno più avanti (campo libero `evolvesTo`).
   ============================================================ */

export { TYPE_ICON, TYPE_LABEL, typeMultiplier } from "./petMoves";

export const MAX_PER_SPECIES = 2;   // copie della stessa specie in collezione
export const MAX_TEAM = 3;          // pet attivi in squadra
export const MAX_LEVEL = 50;
export const MOVE_UNLOCK = [1, 1, 5, 10];

export const RARITY = {
  starter:   { label: "Iniziale",    color: "#d9a441", cost: 150 },
  common:    { label: "Comune",      color: "#8a8f99", cost: 40 },
  rare:      { label: "Raro",        color: "#3d8fd1", cost: 90 },
  epic:      { label: "Epico",       color: "#a45ad8", cost: 180 },
  legendary: { label: "Leggendario", color: "#e0782b", cost: 400 },
};

/* ── MOSSE ──────────────────────────────────────────────────
   power = potenza (0 = mossa di stato), acc = precisione %, pp = usi per
   lotta, prio = priorità (1 = agisce prima). effect:
     { burn|poison: chance }           stato a turni sul bersaglio
     { stun: chance }                  il bersaglio salta il prossimo turno
     { self: {atk|def|spd: +n} }       potenzia chi la usa (stadi -3..+3)
     { foe:  {atk|def|spd: -n}, chance }  indebolisce il bersaglio
     { heal: 0.5 }                     cura % dei PF massimi
     { drain: 0.5 }                    cura % del danno inflitto
     { recoil: 0.25 }                  chi la usa perde % del danno inflitto */
export const PET_DEX_MOVES = {
  // neutro
  zampata:     { name: "Zampata",          type: "neutral", power: 40, acc: 100, pp: 30 },
  morsetto:    { name: "Morsetto",         type: "neutral", power: 55, acc: 95,  pp: 20 },
  testata:     { name: "Testata",          type: "neutral", power: 80, acc: 85,  pp: 10, effect: { recoil: 0.25 } },
  scattino:    { name: "Scattino",         type: "neutral", power: 35, acc: 100, pp: 20, prio: 1 },
  ruggitino:   { name: "Ruggitino",        type: "neutral", power: 0,  acc: 100, pp: 15, effect: { foe: { atk: -1 } } },
  guscio:      { name: "Rintanarsi",       type: "neutral", power: 0,  acc: 100, pp: 10, effect: { self: { def: 2 } } },
  pisolino:    { name: "Pisolino",         type: "neutral", power: 0,  acc: 100, pp: 5,  effect: { heal: 0.5 } },
  ingoiare:    { name: "Ingoiare",         type: "neutral", power: 60, acc: 90,  pp: 10, effect: { drain: 0.5 } },
  // fuoco
  scintilla:   { name: "Scintilla",        type: "fire",    power: 40, acc: 100, pp: 25, effect: { burn: 0.1 } },
  sbuffo:      { name: "Sbuffo di Brace",  type: "fire",    power: 65, acc: 95,  pp: 15, effect: { burn: 0.2 } },
  vampata:     { name: "Vampata",          type: "fire",    power: 90, acc: 85,  pp: 5,  effect: { burn: 0.3 } },
  fuocherello: { name: "Fuocherello",      type: "fire",    power: 0,  acc: 100, pp: 10, effect: { self: { atk: 2 } } },
  // acqua
  spruzzo:     { name: "Spruzzo",          type: "water",   power: 40, acc: 100, pp: 25 },
  bolla:       { name: "Bollicine",        type: "water",   power: 60, acc: 95,  pp: 15, effect: { foe: { spd: -1 }, chance: 0.3 } },
  ondata:      { name: "Ondata",           type: "water",   power: 90, acc: 85,  pp: 5 },
  inchiostro:  { name: "Spruzzo d'Inchiostro", type: "water", power: 0, acc: 90, pp: 10, effect: { foe: { atk: -1, spd: -1 } } },
  // terra/natura
  rametto:     { name: "Rametto",          type: "earth",   power: 40, acc: 100, pp: 25 },
  spore:       { name: "Spore Sonnifere",  type: "earth",   power: 0,  acc: 75,  pp: 10, effect: { stun: 1 } },
  frana:       { name: "Franetta",         type: "earth",   power: 75, acc: 90,  pp: 10, effect: { stun: 0.1 } },
  terremoto:   { name: "Terremotino",      type: "earth",   power: 95, acc: 85,  pp: 5 },
  linfa:       { name: "Succhia-linfa",    type: "earth",   power: 55, acc: 100, pp: 15, effect: { drain: 0.5 } },
  // aria/tempesta
  folata:      { name: "Folata",           type: "air",     power: 40, acc: 100, pp: 25, prio: 0 },
  scossa:      { name: "Scossetta",        type: "air",     power: 60, acc: 95,  pp: 15, effect: { stun: 0.2 } },
  tornado:     { name: "Tornadino",        type: "air",     power: 90, acc: 85,  pp: 5 },
  ventolina:   { name: "Ventolina",        type: "air",     power: 0,  acc: 100, pp: 10, effect: { self: { spd: 2 } } },
  balzo:       { name: "Balzo Fatato",     type: "air",     power: 45, acc: 100, pp: 20, prio: 1 },
  // luce
  luccichio:   { name: "Luccichio",        type: "light",   power: 45, acc: 100, pp: 25, effect: { foe: { atk: -1 }, chance: 0.2 } },
  raggio:      { name: "Raggio Sacro",     type: "light",   power: 80, acc: 90,  pp: 10 },
  benedizione: { name: "Benedizione",      type: "light",   power: 0,  acc: 100, pp: 5,  effect: { heal: 0.5 } },
  aureola:     { name: "Aureola",          type: "light",   power: 0,  acc: 100, pp: 10, effect: { self: { def: 1, atk: 1 } } },
  // tenebre
  graffio:     { name: "Graffio d'Ombra",  type: "dark",    power: 45, acc: 100, pp: 25 },
  morso:       { name: "Morso Oscuro",     type: "dark",    power: 70, acc: 95,  pp: 15, effect: { foe: { def: -1 }, chance: 0.3 } },
  incubo:      { name: "Incubetto",        type: "dark",    power: 0,  acc: 85,  pp: 10, effect: { poison: 1 } },
  sguardo:     { name: "Sguardo Malefico", type: "dark",    power: 85, acc: 85,  pp: 5,  effect: { stun: 0.2 } },
  veleno:      { name: "Puntura Velenosa", type: "dark",    power: 40, acc: 100, pp: 20, effect: { poison: 0.3 } },
};

/* ── SPECIE ───────────────────────────────────────────────── */
const S = (key, name, icon, type, rarity, desc, look, base, moves) =>
  ({ key, name, icon, type, rarity, desc, look, base, moves });

export const PET_DEX = {
  // ── 5 INIZIALI ──
  brace: S("brace", "Brace", "🐲", "fire", "starter",
    "Cucciolo di drago rosso: sputa scintille quando è contento.",
    "a baby red dragon wyrmling, tiny chubby body, small stubby wings, big shiny eyes, little horns, smoke puffing from its nostrils",
    { hp: 46, atk: 13, def: 10, spd: 12 }, ["zampata", "scintilla", "sbuffo", "vampata"]),
  tartadrago: S("tartadrago", "Tartadrago", "🐢", "water", "starter",
    "Tartaruga-drago appena uscita dal guscio: lenta, testarda, inaffondabile.",
    "a baby dragon turtle, round spiky blue-green shell, small dragon head with tiny fins, sleepy friendly face",
    { hp: 54, atk: 11, def: 14, spd: 7 }, ["morsetto", "spruzzo", "guscio", "ondata"]),
  gufurso: S("gufurso", "Gufurso", "🦉", "earth", "starter",
    "Cucciolo di gufo-orso: abbracci fortissimi, piume ovunque.",
    "a baby owlbear cub, fluffy brown fur and feathers, owl face with big round eyes and a small beak, stubby bear paws",
    { hp: 52, atk: 14, def: 11, spd: 8 }, ["zampata", "rametto", "ruggitino", "frana"]),
  pseudodrago: S("pseudodrago", "Pseudodrago", "🐉", "air", "starter",
    "Draghetto da spalla grande come un gatto: ronza, sfreccia, punge.",
    "a tiny pseudodragon, cat-sized slender dragon with butterfly-like translucent wings, long curled tail with a stinger, mischievous smile",
    { hp: 42, atk: 12, def: 9, spd: 15 }, ["folata", "balzo", "ventolina", "scossa"]),
  gattombra: S("gattombra", "Gattombra", "🐈‍⬛", "dark", "starter",
    "Gattino distorcente: lo vedi sempre un passo più in là di dov'è.",
    "a displacer beast kitten, dark blue-black panther kitten with six little legs and two soft tentacles on its back ending in pads, glowing yellow eyes, shimmering afterimage",
    { hp: 44, atk: 13, def: 10, spd: 13 }, ["graffio", "scattino", "morso", "sguardo"]),

  // ── COMUNI ──
  mefitino: S("mefitino", "Mefitino", "😈", "fire", "common",
    "Mefite di magma che gocciola lava e ride per niente.",
    "a tiny magma mephit, small impish creature made of cooling lava with glowing cracks, little bat wings, cheeky grin",
    { hp: 40, atk: 12, def: 9, spd: 12 }, ["scintilla", "zampata", "fuocherello", "sbuffo"]),
  cubetto: S("cubetto", "Cubetto", "🧊", "water", "common",
    "Cubo gelatinoso grande come un dado: dentro ha sempre una moneta.",
    "a small gelatinous cube, translucent wobbly green-blue jelly cube with a tiny coin and a little bone floating inside, two cute dot eyes",
    { hp: 58, atk: 10, def: 12, spd: 5 }, ["spruzzo", "ingoiare", "guscio", "bolla"]),
  funghetto: S("funghetto", "Funghetto", "🍄", "earth", "common",
    "Miconide bambino: comunica a sbuffi di spore profumate.",
    "a baby myconid, small walking mushroom person with a spotted purple cap, stubby legs and arms, sleepy eyes, puffs of spores",
    { hp: 46, atk: 10, def: 11, spd: 7 }, ["rametto", "spore", "linfa", "pisolino"]),
  saltello: S("saltello", "Saltello", "🐕", "air", "common",
    "Cucciolo di cane intermittente: sparisce e ricompare per giocare.",
    "a blink dog puppy, yellow-golden fey puppy with big ears, sparkles around it as it teleports, happy tongue out",
    { hp: 42, atk: 11, def: 9, spd: 15 }, ["balzo", "morsetto", "folata", "scossa"]),
  diavoletto: S("diavoletto", "Diavoletto", "👿", "dark", "common",
    "Imp dispettoso che firma contratti col pennarello.",
    "a tiny imp, small red devil with little horns, bat wings, a pointed tail with a stinger, holding a tiny scroll, smug smile",
    { hp: 40, atk: 12, def: 9, spd: 13 }, ["graffio", "veleno", "incubo", "scattino"]),
  scrignetto: S("scrignetto", "Scrignetto", "🧰", "neutral", "common",
    "Mimic cucciolo: finge di essere un portagioie. Morde le dita.",
    "a baby mimic shaped like a small wooden treasure chest, open lid showing tiny teeth and a long pink tongue, two little eyes on the lid",
    { hp: 52, atk: 12, def: 13, spd: 6 }, ["morsetto", "guscio", "ingoiare", "testata"]),

  // ── RARI ──
  salamandrina: S("salamandrina", "Salamandrina", "🦎", "fire", "rare",
    "Salamandra di fuoco: la coda brucia come una candela.",
    "a baby fire salamander, small orange-red serpentine lizard with a flaming tail and fiery spines along its back, bright eyes",
    { hp: 46, atk: 15, def: 10, spd: 13 }, ["scintilla", "morsetto", "sbuffo", "vampata"]),
  krakino: S("krakino", "Krakino", "🐙", "water", "rare",
    "Kraken neonato: otto tentacoli, zero buone maniere.",
    "a baby kraken, small round squid-octopus with many curly tentacles, huge curious eyes, deep teal and purple colors",
    { hp: 56, atk: 13, def: 12, spd: 9 }, ["spruzzo", "inchiostro", "bolla", "ondata"]),
  ruggine: S("ruggine", "Ruggine", "🐜", "earth", "rare",
    "Mostro della ruggine piccolo: si mangia le forchette di nascosto.",
    "a baby rust monster, insect-like creature with a rusty orange armored body, two long feathery antennae, wagging tail like a puppy",
    { hp: 50, atk: 14, def: 14, spd: 9 }, ["morsetto", "frana", "ruggitino", "terremoto"]),
  turbino: S("turbino", "Turbino", "🌪️", "air", "rare",
    "Elementale dell'aria in miniatura: un mulinello con due occhietti.",
    "a tiny air elemental, a small swirling whirlwind of pale blue air with two cute eyes and little cloud puffs",
    { hp: 42, atk: 14, def: 9, spd: 17 }, ["folata", "scossa", "ventolina", "tornado"]),
  occhietto: S("occhietto", "Occhietto", "👁️", "dark", "rare",
    "Spettatore cucciolo: un occhione, quattro occhietti, tanta curiosità.",
    "a baby beholder (spectator), round floating purple ball with one big central eye and four small eyestalks, small toothy smile",
    { hp: 48, atk: 15, def: 11, spd: 10 }, ["graffio", "incubo", "morso", "sguardo"]),
  cornina: S("cornina", "Cornina", "🦄", "light", "rare",
    "Puledra di unicorno: dove galoppa crescono margherite.",
    "a baby unicorn foal, white fluffy coat, small golden spiral horn, pastel rainbow mane, big gentle eyes, little hooves",
    { hp: 50, atk: 12, def: 12, spd: 12 }, ["luccichio", "scattino", "benedizione", "raggio"]),

  // ── EPICI ──
  squalterra: S("squalterra", "Squalterra", "🦈", "earth", "epic",
    "Bulette cucciolo: nuota nel terreno come uno squalo nel mare.",
    "a baby bulette (landshark), armored blue-grey shell plates, shark-like head with a small fin on its back, stubby clawed legs, bursting out of the ground",
    { hp: 58, atk: 17, def: 15, spd: 9 }, ["morsetto", "frana", "testata", "terremoto"]),
  piumaserpe: S("piumaserpe", "Piumaserpe", "🪶", "light", "epic",
    "Couatl neonato: serpente piumato che sa sempre la verità.",
    "a baby couatl, small feathered serpent with rainbow feathered wings, golden scales, gentle wise eyes, soft glow",
    { hp: 50, atk: 15, def: 12, spd: 15 }, ["luccichio", "balzo", "aureola", "raggio"]),

  // ── LEGGENDARIO ──
  tarrasquino: S("tarrasquino", "Tarrasquino", "🦖", "neutral", "legendary",
    "Il Tarrasque, ma in miniatura. Per ora. Mangia di tutto.",
    "a baby tarrasque, small chunky purple-green reptile kaiju with a spiked shell back, two forward horns, tiny claws, big hungry mouth, adorable",
    { hp: 64, atk: 18, def: 16, spd: 10 }, ["morsetto", "ruggitino", "ingoiare", "testata"]),
};

export const PET_DEX_ORDER = Object.keys(PET_DEX);
export const STARTERS = PET_DEX_ORDER.filter((k) => PET_DEX[k].rarity === "starter");

/* ── PUNTI PET ──────────────────────────────────────────────
   Il portafoglio è `characters.petPoints` (lo stesso di prima, vedi
   utils/pet.js: Arena, login, World Boss…). Il Rifugio vende le specie
   al costo della rarità; un doppione oltre il limite (es. dal Mercato)
   si converte in metà del suo costo. */
export const costOf = (key) => RARITY[PET_DEX[key]?.rarity]?.cost ?? 999;
export const refundOf = (key) => Math.floor(costOf(key) / 2);
