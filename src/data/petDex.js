/* ============================================================
   PET DEX — il sistema pet "alla Pokémon" (2026-10-31).
   35 creature di D&D in versione cucciola: 5 iniziali (si sceglie
   UNA sola volta, al primo accesso) + 30 che escono dalle UOVA
   (Bottega delle uova coi punti pet, Mercato Nero, premi).
   Per ora visibile solo al Master.
   ------------------------------------------------------------
   Tipi = gli elementi di D&D (fuoco, gelo, acqua, fulmine, terra,
   acido, veleno, necrotico, radioso, psichico) + "neutral" per i
   colpi fisici. Ogni uovo elementale contiene i pet del suo tipo.
   Specie:
     key, name, icon (emoji di riserva finché non c'è la pixel art),
     type, rarity (starter|common|rare|epic|legendary),
     desc   — una riga in italiano per i giocatori
     look   — descrizione in INGLESE per Gemini (cosa disegnare)
     base   — { hp, atk, def, spd } al livello 1
     moves  — 4 mosse: le prime 2 subito, la 3ª al Lv 5, la 4ª al Lv 10
   Le evoluzioni arriveranno più avanti.
   ============================================================ */

export const MAX_PER_SPECIES = 2;   // copie della stessa specie in collezione
export const MAX_TEAM = 3;          // pet attivi in squadra
export const MAX_EGGS = 24;         // uova nel nido
export const MAX_LEVEL = 50;
export const MOVE_UNLOCK = [1, 1, 5, 10];

/* ── TIPI ────────────────────────────────────────────────── */
export const PET_TYPES = ["fire", "cold", "water", "lightning", "earth", "acid", "poison", "necrotic", "radiant", "psychic", "neutral"];
export const ELEMENTS = PET_TYPES.filter((t) => t !== "neutral");

export const TYPE_ICON = {
  fire: "🔥", cold: "❄️", water: "💧", lightning: "⚡", earth: "🪨",
  acid: "🧪", poison: "☠️", necrotic: "💀", radiant: "✨", psychic: "🔮", neutral: "✦",
};
export const TYPE_LABEL = {
  fire: "Fuoco", cold: "Gelo", water: "Acqua", lightning: "Fulmine", earth: "Terra",
  acid: "Acido", poison: "Veleno", necrotic: "Necrotico", radiant: "Radioso", psychic: "Psichico", neutral: "Fisico",
};
// Colori per chip, uova ed effetti: chiaro · pieno · scuro.
export const TYPE_COLORS = {
  fire: ["#fff1a8", "#ff7a2b", "#b8230e"],
  cold: ["#f0fdff", "#86d8ff", "#2f7fcf"],
  water: ["#d8f3ff", "#3c9be0", "#1b4f99"],
  lightning: ["#fffbd0", "#ffe14a", "#8d6bff"],
  earth: ["#ecd9a8", "#9a7340", "#4d3720"],
  acid: ["#f0ffb0", "#a3e635", "#4d7c0f"],
  poison: ["#f0d0ff", "#a855f7", "#4c1d95"],
  necrotic: ["#d9f99d", "#4b5e3c", "#14180f"],
  radiant: ["#ffffff", "#ffe9a0", "#e8b21c"],
  psychic: ["#ffd6f6", "#f052c4", "#7e22ce"],
  neutral: ["#ffffff", "#d9cfbb", "#7a6e5c"],
};

/* Efficacia: STRONG[a] = tipi contro cui `a` fa ×1,5. Il contrario
   (difensore forte contro l'attaccante) fa ×0,5. */
const STRONG = {
  fire: ["cold", "poison"],
  cold: ["water", "lightning"],
  water: ["fire", "acid"],
  lightning: ["water", "psychic"],
  earth: ["lightning", "fire"],
  acid: ["cold", "radiant"],
  poison: ["earth", "water"],
  necrotic: ["earth", "psychic"],
  radiant: ["necrotic", "poison"],
  psychic: ["poison", "acid"],
};
export function typeMultiplier(att, def) {
  if (!att || att === "neutral" || !def) return 1;
  if (STRONG[att]?.includes(def)) return 1.5;
  if (STRONG[def]?.includes(att)) return 0.5;
  return 1;
}
export const strongAgainst = (t) => STRONG[t] || [];
export const weakAgainst = (t) => ELEMENTS.filter((a) => STRONG[a]?.includes(t));

/* ── RARITÀ ──────────────────────────────────────────────────
   value = quanto "vale" un pet (un doppione oltre il limite diventa
   metà di questo in punti pet). Gli iniziali, nelle uova, contano
   come rari. */
export const RARITY = {
  starter:   { label: "Iniziale",    color: "#d9a441", value: 150 },
  common:    { label: "Comune",      color: "#8a8f99", value: 40 },
  rare:      { label: "Raro",        color: "#3d8fd1", value: 90 },
  epic:      { label: "Epico",       color: "#a45ad8", value: 180 },
  legendary: { label: "Leggendario", color: "#e0782b", value: 400 },
};
export const HATCH_RARITIES = ["common", "rare", "epic", "legendary"];
export const hatchRarityOf = (key) => (PET_DEX[key]?.rarity === "starter" ? "rare" : PET_DEX[key]?.rarity);

/* ── MOSSE ──────────────────────────────────────────────────
   power = potenza (0 = mossa di stato), acc = precisione %, pp = usi per
   lotta, prio = priorità (1 = agisce prima).
   fx = come si vede in lotta: stomp (pestone, onda d'urto) · bite ·
   claw · orb (proiettile) · beam (raggio) · breath (soffio a cono) ·
   burst (esplosione sul bersaglio) · bolt (fulmine dall'alto) · rain
   (schegge/sassi che cadono) · wave (onde) · cloud (nube) · curse
   (spirale) · aura (potenziamento) · heal · sleep · drain · roar.
   effect:
     { burn|poison: chance }           stato a turni sul bersaglio
     { stun: chance }                  il bersaglio salta il prossimo turno
     { self: {atk|def|spd: +n} }       potenzia chi la usa (stadi -3..+3)
     { foe:  {atk|def|spd: -n}, chance }  indebolisce il bersaglio
     { heal: 0.5 } · { drain: 0.5 } · { recoil: 0.25 } */
const M = (name, type, power, acc, pp, fx, extra = {}) => ({ name, type, power, acc, pp, fx, ...extra });
export const PET_DEX_MOVES = {
  // fisiche
  zampata:      M("Zampata", "neutral", 40, 100, 30, "stomp"),
  morsetto:     M("Morsetto", "neutral", 55, 95, 20, "bite"),
  testata:      M("Testata", "neutral", 80, 85, 10, "stomp", { effect: { recoil: 0.25 } }),
  scattino:     M("Scattino", "neutral", 35, 100, 20, "claw", { prio: 1 }),
  graffio:      M("Graffio", "neutral", 45, 100, 25, "claw"),
  ruggitino:    M("Ruggitino", "neutral", 0, 100, 15, "roar", { effect: { foe: { atk: -1 } } }),
  guscio:       M("Rintanarsi", "neutral", 0, 100, 10, "aura", { effect: { self: { def: 2 } } }),
  pisolino:     M("Pisolino", "neutral", 0, 100, 5, "sleep", { effect: { heal: 0.5 } }),
  ingoiare:     M("Ingoiare", "neutral", 60, 90, 10, "bite", { effect: { drain: 0.5 } }),
  // fuoco
  scintilla:    M("Scintilla", "fire", 40, 100, 25, "orb", { effect: { burn: 0.1 } }),
  sbuffo:       M("Sbuffo di Brace", "fire", 65, 95, 15, "breath", { effect: { burn: 0.2 } }),
  vampata:      M("Vampata", "fire", 90, 85, 5, "burst", { effect: { burn: 0.3 } }),
  fuocherello:  M("Fuocherello", "fire", 0, 100, 10, "aura", { effect: { self: { atk: 2 } } }),
  morsofuoco:   M("Zanne Ardenti", "fire", 60, 95, 15, "bite", { effect: { burn: 0.2 } }),
  // gelo
  brina:        M("Scheggia di Brina", "cold", 40, 100, 25, "orb", { effect: { foe: { spd: -1 }, chance: 0.2 } }),
  soffiogelo:   M("Soffio Gelido", "cold", 65, 95, 15, "breath", { effect: { foe: { spd: -1 }, chance: 0.3 } }),
  grandine:     M("Grandinata", "cold", 90, 85, 5, "rain", { effect: { stun: 0.1 } }),
  mantobrina:   M("Manto di Brina", "cold", 0, 100, 10, "aura", { effect: { self: { def: 2 } } }),
  morsogelo:    M("Morso Gelido", "cold", 60, 95, 15, "bite", { effect: { stun: 0.1 } }),
  // acqua
  spruzzo:      M("Getto d'Acqua", "water", 40, 100, 25, "beam"),
  bolla:        M("Bollicine", "water", 60, 95, 15, "orb", { effect: { foe: { spd: -1 }, chance: 0.3 } }),
  ondata:       M("Ondata", "water", 90, 85, 5, "wave"),
  inchiostro:   M("Spruzzo d'Inchiostro", "water", 0, 90, 10, "cloud", { effect: { foe: { atk: -1, spd: -1 } } }),
  pioggia:      M("Pioggerella", "water", 0, 100, 5, "heal", { effect: { heal: 0.4 } }),
  // fulmine
  scarica:      M("Scarica", "lightning", 40, 100, 25, "orb", { effect: { stun: 0.1 } }),
  scossa:       M("Scossetta", "lightning", 60, 95, 15, "bolt", { effect: { stun: 0.2 } }),
  fulmine:      M("Fulmine", "lightning", 90, 85, 5, "bolt", { effect: { stun: 0.3 } }),
  caricastatica:M("Carica Statica", "lightning", 0, 100, 10, "aura", { effect: { self: { spd: 2 } } }),
  saetta:       M("Saetta", "lightning", 45, 100, 20, "beam", { prio: 1 }),
  // terra
  rametto:      M("Frusta di Rami", "earth", 40, 100, 25, "claw"),
  spore:        M("Spore Sonnifere", "earth", 0, 75, 10, "cloud", { effect: { stun: 1 } }),
  frana:        M("Franetta", "earth", 75, 90, 10, "rain", { effect: { stun: 0.1 } }),
  terremoto:    M("Terremotino", "earth", 95, 85, 5, "stomp"),
  linfa:        M("Succhia-linfa", "earth", 55, 100, 15, "drain", { effect: { drain: 0.5 } }),
  // acido
  sputoacido:   M("Sputo Acido", "acid", 40, 100, 25, "orb", { effect: { foe: { def: -1 }, chance: 0.2 } }),
  spruzzoacido: M("Spruzzo Corrosivo", "acid", 65, 95, 15, "breath", { effect: { foe: { def: -1 }, chance: 0.3 } }),
  bagnoacido:   M("Bagno d'Acido", "acid", 90, 85, 5, "burst"),
  melma:        M("Melma Appiccicosa", "acid", 0, 95, 15, "cloud", { effect: { foe: { spd: -2 } } }),
  // veleno
  veleno:       M("Puntura Velenosa", "poison", 40, 100, 20, "orb", { effect: { poison: 0.3 } }),
  zannevelenose:M("Zanne Velenose", "poison", 60, 95, 15, "bite", { effect: { poison: 0.3 } }),
  nubetossica:  M("Nube Tossica", "poison", 0, 85, 10, "cloud", { effect: { poison: 1 } }),
  fiotto:       M("Fiotto di Veleno", "poison", 90, 85, 5, "beam", { effect: { poison: 0.3 } }),
  // necrotico
  toccotetro:   M("Tocco Tetro", "necrotic", 50, 100, 20, "drain", { effect: { drain: 0.5 } }),
  morso:        M("Morso Oscuro", "necrotic", 70, 95, 15, "bite", { effect: { foe: { def: -1 }, chance: 0.3 } }),
  maledizione:  M("Maledizione", "necrotic", 0, 90, 10, "curse", { effect: { foe: { atk: -1, def: -1 } } }),
  mietitura:    M("Mietitura", "necrotic", 90, 85, 5, "burst"),
  raggiosinistro: M("Raggio Sinistro", "necrotic", 65, 95, 15, "beam"),
  // radioso
  luccichio:    M("Luccichio", "radiant", 45, 100, 25, "orb", { effect: { foe: { atk: -1 }, chance: 0.2 } }),
  raggio:       M("Raggio Sacro", "radiant", 80, 90, 10, "beam"),
  benedizione:  M("Benedizione", "radiant", 0, 100, 5, "heal", { effect: { heal: 0.5 } }),
  aureola:      M("Aureola", "radiant", 0, 100, 10, "aura", { effect: { self: { def: 1, atk: 1 } } }),
  lucesplosione:M("Esplosione di Luce", "radiant", 90, 85, 5, "burst", { effect: { stun: 0.1 } }),
  // psichico
  ondamentale:  M("Onda Mentale", "psychic", 45, 100, 25, "wave"),
  ipnosi:       M("Ipnosi", "psychic", 0, 75, 10, "curse", { effect: { stun: 1 } }),
  sguardo:      M("Sguardo Malefico", "psychic", 85, 85, 5, "beam", { effect: { stun: 0.2 } }),
  urlopsichico: M("Urlo Psichico", "psychic", 65, 95, 15, "wave", { effect: { foe: { atk: -1 }, chance: 0.3 } }),
  concentrazione: M("Concentrazione", "psychic", 0, 100, 10, "aura", { effect: { self: { atk: 2 } } }),
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
    { hp: 52, atk: 14, def: 11, spd: 8 }, ["zampata", "rametto", "ruggitino", "terremoto"]),
  pseudodrago: S("pseudodrago", "Pseudodrago", "🐉", "poison", "starter",
    "Draghetto da spalla grande come un gatto: la coda punge e addormenta.",
    "a tiny pseudodragon, cat-sized slender reddish dragon with butterfly-like translucent wings, long curled tail with a stinger dripping a drop of purple venom, mischievous smile",
    { hp: 42, atk: 12, def: 9, spd: 15 }, ["scattino", "veleno", "nubetossica", "fiotto"]),
  gattombra: S("gattombra", "Gattombra", "🐈‍⬛", "psychic", "starter",
    "Gattino distorcente: lo vedi sempre un passo più in là di dov'è.",
    "a displacer beast kitten, dark blue-black panther kitten with six little legs and two soft tentacles on its back ending in pads, glowing violet eyes, shimmering illusory afterimage",
    { hp: 44, atk: 13, def: 10, spd: 13 }, ["graffio", "ondamentale", "ipnosi", "sguardo"]),

  // ── COMUNI ──
  mefitino: S("mefitino", "Mefitino", "😈", "fire", "common",
    "Mefite di magma che gocciola lava e ride per niente.",
    "a tiny magma mephit, small impish creature made of cooling lava with glowing cracks, little bat wings, cheeky grin",
    { hp: 40, atk: 12, def: 9, spd: 12 }, ["scintilla", "graffio", "fuocherello", "sbuffo"]),
  cubetto: S("cubetto", "Cubetto", "🧊", "acid", "common",
    "Cubo gelatinoso grande come un dado: dentro ha sempre una moneta.",
    "a small gelatinous cube, translucent wobbly lime-green acidic jelly cube with a tiny coin and a little bone floating inside, two cute dot eyes, tiny acid bubbles",
    { hp: 58, atk: 10, def: 12, spd: 5 }, ["sputoacido", "ingoiare", "guscio", "bagnoacido"]),
  funghetto: S("funghetto", "Funghetto", "🍄", "earth", "common",
    "Miconide bambino: comunica a sbuffi di spore profumate.",
    "a baby myconid, small walking mushroom person with a spotted purple cap, stubby legs and arms, sleepy eyes, puffs of spores",
    { hp: 46, atk: 10, def: 11, spd: 7 }, ["rametto", "spore", "linfa", "pisolino"]),
  saltello: S("saltello", "Saltello", "🐕", "radiant", "common",
    "Cucciolo di cane intermittente: sparisce e ricompare per giocare.",
    "a blink dog puppy, golden fey puppy with big ears, sparkles of light around it as it teleports, happy tongue out",
    { hp: 42, atk: 11, def: 9, spd: 15 }, ["scattino", "luccichio", "aureola", "lucesplosione"]),
  diavoletto: S("diavoletto", "Diavoletto", "👿", "necrotic", "common",
    "Imp dispettoso che firma contratti col pennarello.",
    "a tiny imp, small red devil with little horns, bat wings, a pointed tail, holding a tiny scroll, wisps of dark smoke, smug smile",
    { hp: 40, atk: 12, def: 9, spd: 13 }, ["graffio", "toccotetro", "maledizione", "raggiosinistro"]),
  scrignetto: S("scrignetto", "Scrignetto", "🧰", "acid", "common",
    "Mimic cucciolo: finge di essere un portagioie. Morde le dita.",
    "a baby mimic shaped like a small wooden treasure chest, open lid showing tiny teeth and a long pink sticky tongue dripping green goo, two little eyes on the lid",
    { hp: 52, atk: 12, def: 13, spd: 6 }, ["morsetto", "sputoacido", "melma", "spruzzoacido"]),
  yetino: S("yetino", "Yetino", "🐻‍❄️", "cold", "common",
    "Cucciolo di yeti: si rotola nella neve e ne esce più grosso.",
    "a baby yeti, round fluffy white fur ball with small blue face, tiny horns, big feet, snowflakes around",
    { hp: 52, atk: 12, def: 12, spd: 7 }, ["zampata", "brina", "mantobrina", "grandine"]),
  brinello: S("brinello", "Brinello", "❄️", "cold", "common",
    "Mefite del ghiaccio: starnutisce fiocchi di neve.",
    "a tiny ice mephit, small impish creature made of icy blue crystal, frosty wings, icicle horns, sneezing a snowflake",
    { hp: 40, atk: 12, def: 9, spd: 13 }, ["brina", "scattino", "soffiogelo", "morsogelo"]),
  granchietto: S("granchietto", "Granchietto", "🦀", "water", "common",
    "Granchio gigante, ma non ancora. Pizzica tutto quello che luccica.",
    "a baby giant crab, round shiny red-blue shell, oversized claws, eyes on stalks, bubbles around it",
    { hp: 48, atk: 12, def: 14, spd: 6 }, ["graffio", "bolla", "guscio", "ondata"]),
  ragnetto: S("ragnetto", "Ragnetto", "🕷️", "poison", "common",
    "Ragno gigante neonato: otto occhi, otto zampe, otto volte coccolone.",
    "a baby giant spider, fuzzy round dark purple body, eight big shiny eyes, stubby legs, tiny fangs dripping green venom",
    { hp: 42, atk: 12, def: 10, spd: 13 }, ["zannevelenose", "scattino", "melma", "nubetossica"]),
  scheletrino: S("scheletrino", "Scheletrino", "🦴", "necrotic", "common",
    "Cucciolo di scheletro: porta l'osso, ma è il suo.",
    "a skeleton puppy, small undead dog made of white bones with a big round skull, ghostly green glow in the eye sockets, wagging bony tail",
    { hp: 44, atk: 12, def: 11, spd: 11 }, ["morsetto", "toccotetro", "ruggitino", "morso"]),

  // ── RARI ──
  salamandrina: S("salamandrina", "Salamandrina", "🦎", "fire", "rare",
    "Salamandra di fuoco: la coda brucia come una candela.",
    "a baby fire salamander, small orange-red serpentine lizard with a flaming tail and fiery spines along its back, bright eyes",
    { hp: 46, atk: 15, def: 10, spd: 13 }, ["scintilla", "morsofuoco", "sbuffo", "vampata"]),
  krakino: S("krakino", "Krakino", "🐙", "water", "rare",
    "Kraken neonato: otto tentacoli, zero buone maniere.",
    "a baby kraken, small round squid-octopus with many curly tentacles, huge curious eyes, deep teal and purple colors",
    { hp: 56, atk: 13, def: 12, spd: 9 }, ["spruzzo", "inchiostro", "bolla", "ondata"]),
  ruggine: S("ruggine", "Ruggine", "🐜", "acid", "rare",
    "Mostro della ruggine piccolo: si mangia le forchette di nascosto.",
    "a baby rust monster, insect-like creature with a rusty orange armored body, two long feathery antennae, wagging tail like a puppy, flakes of rust",
    { hp: 50, atk: 14, def: 14, spd: 9 }, ["morsetto", "sputoacido", "spruzzoacido", "bagnoacido"]),
  turbino: S("turbino", "Turbino", "🌪️", "lightning", "rare",
    "Elementale della tempesta in miniatura: un mulinello che fa scintille.",
    "a tiny storm elemental, a small swirling whirlwind of pale blue air crackling with little lightning sparks, two cute eyes",
    { hp: 42, atk: 14, def: 9, spd: 17 }, ["saetta", "scarica", "caricastatica", "fulmine"]),
  occhietto: S("occhietto", "Occhietto", "👁️", "psychic", "rare",
    "Spettatore cucciolo: un occhione, quattro occhietti, tanta curiosità.",
    "a baby beholder (spectator), round floating purple ball with one big central eye and four small eyestalks, small toothy smile, pink psychic glow",
    { hp: 48, atk: 15, def: 11, spd: 10 }, ["ondamentale", "ipnosi", "urlopsichico", "sguardo"]),
  cornina: S("cornina", "Cornina", "🦄", "radiant", "rare",
    "Puledra di unicorno: dove galoppa crescono margherite.",
    "a baby unicorn foal, white fluffy coat, small golden spiral horn glowing, pastel rainbow mane, big gentle eyes, little hooves",
    { hp: 50, atk: 12, def: 12, spd: 12 }, ["scattino", "luccichio", "benedizione", "raggio"]),
  cerberino: S("cerberino", "Cerberino", "🐕‍🦺", "fire", "rare",
    "Segugio infernale cucciolo: abbaia scintille, scava buche nella lava.",
    "a hell hound puppy, small black dog with glowing red eyes, fiery orange mane and flaming tail, tiny fangs, ember sparks",
    { hp: 50, atk: 16, def: 11, spd: 13 }, ["morsofuoco", "ruggitino", "sbuffo", "vampata"]),
  lupogelo: S("lupogelo", "Lupogelo", "🐺", "cold", "rare",
    "Cucciolo di lupo invernale: ulula e la brina si posa sugli alberi.",
    "a winter wolf pup, fluffy snow-white wolf cub with icy blue eyes, frosty breath, little icicles on its fur",
    { hp: 50, atk: 15, def: 11, spd: 14 }, ["morsogelo", "ruggitino", "soffiogelo", "grandine"]),
  gocciolo: S("gocciolo", "Gocciolo", "💧", "water", "rare",
    "Stranezza dell'acqua: una goccia viva che si offende se la bevi.",
    "a tiny water weird, a living droplet of clear blue water shaped like a little serpent with a big drop head, two shiny eyes, small splashes",
    { hp: 50, atk: 13, def: 12, spd: 12 }, ["spruzzo", "bolla", "pioggia", "ondata"]),
  fuocofatuo: S("fuocofatuo", "Fuocofatuo", "🔆", "lightning", "rare",
    "Fuoco fatuo: una lucina elettrica che ti porta dove non dovresti.",
    "a will-o'-wisp, small floating ball of pale blue-yellow electric light with a cute face, crackling little sparks, faint glowing trail",
    { hp: 40, atk: 15, def: 9, spd: 17 }, ["scarica", "saetta", "scossa", "fulmine"]),
  otyughino: S("otyughino", "Otyughino", "🗑️", "poison", "rare",
    "Otyugh piccolo: vive nei rifiuti e li trova deliziosi.",
    "a baby otyugh, round lumpy greenish-brown blob creature on three stubby legs, two little tentacles, one eye on a stalk, big toothy grin, stink lines",
    { hp: 58, atk: 14, def: 13, spd: 7 }, ["zannevelenose", "ingoiare", "nubetossica", "fiotto"]),
  fantasmino: S("fantasmino", "Fantasmino", "👻", "necrotic", "rare",
    "Fantasma giovane: fa \"buh\" e poi si scusa.",
    "a little ghost, small translucent pale green spirit with a wispy tail, big sad-cute eyes, ghostly chains as a tiny bracelet",
    { hp: 44, atk: 15, def: 12, spd: 12 }, ["toccotetro", "maledizione", "raggiosinistro", "mietitura"]),

  // ── EPICI ──
  squalterra: S("squalterra", "Squalterra", "🦈", "earth", "epic",
    "Bulette cucciolo: nuota nel terreno come uno squalo nel mare.",
    "a baby bulette (landshark), armored blue-grey shell plates, shark-like head with a small fin on its back, stubby clawed legs, bursting out of the ground",
    { hp: 58, atk: 17, def: 15, spd: 9 }, ["morsetto", "frana", "testata", "terremoto"]),
  piumaserpe: S("piumaserpe", "Piumaserpe", "🪶", "radiant", "epic",
    "Couatl neonato: serpente piumato che sa sempre la verità.",
    "a baby couatl, small feathered serpent with rainbow feathered wings, golden scales, gentle wise eyes, soft holy glow",
    { hp: 50, atk: 15, def: 12, spd: 15 }, ["luccichio", "benedizione", "raggio", "lucesplosione"]),
  nevischio: S("nevischio", "Nevischio", "🐲", "cold", "epic",
    "Cucciolo di drago bianco: morde i ghiaccioli come caramelle.",
    "a baby white dragon wyrmling, chubby icy-white dragon with pale blue frills, small frosty wings, big eyes, frost crystals on its horns",
    { hp: 54, atk: 16, def: 13, spd: 13 }, ["brina", "morsogelo", "soffiogelo", "grandine"]),
  saettino: S("saettino", "Saettino", "🐉", "lightning", "epic",
    "Cucciolo di drago blu: ogni starnuto è un piccolo temporale.",
    "a baby blue dragon wyrmling, chubby sapphire-blue dragon with a single small horn on its nose, tiny wings, little lightning sparks crackling around",
    { hp: 52, atk: 17, def: 12, spd: 14 }, ["scarica", "morsetto", "scossa", "fulmine"]),
  girino: S("girino", "Girino", "🦑", "psychic", "epic",
    "Girino di mind flayer, ma buono. Dice. Legge i pensieri a voce alta.",
    "a cute baby mind flayer tadpole, small purple-pink wiggly tadpole with four tiny face tentacles, huge glossy white eyes, glowing psychic aura",
    { hp: 48, atk: 17, def: 11, spd: 14 }, ["ondamentale", "concentrazione", "urlopsichico", "sguardo"]),

  // ── LEGGENDARI ──
  tarrasquino: S("tarrasquino", "Tarrasquino", "🦖", "earth", "legendary",
    "Il Tarrasque, ma in miniatura. Per ora. Mangia di tutto.",
    "a baby tarrasque, small chunky purple-green reptile kaiju with a spiked shell back, two forward horns, tiny claws, big hungry mouth, adorable",
    { hp: 64, atk: 18, def: 16, spd: 10 }, ["morsetto", "ruggitino", "testata", "terremoto"]),
  lichetto: S("lichetto", "Lichetto", "☠️", "necrotic", "legendary",
    "Un lich piccolissimo col filatterio a forma di ciuccio.",
    "a tiny chibi lich, small skeletal sorcerer in oversized tattered purple robes and a little golden crown, glowing green eyes, holding a tiny phylactery like a pacifier, necrotic green wisps",
    { hp: 56, atk: 19, def: 14, spd: 13 }, ["raggiosinistro", "maledizione", "toccotetro", "mietitura"]),
};

export const PET_DEX_ORDER = Object.keys(PET_DEX);
export const STARTERS = PET_DEX_ORDER.filter((k) => PET_DEX[k].rarity === "starter");

/* ── UOVA ───────────────────────────────────────────────────
   Uovo elementale = un pet del suo elemento; Prismatico = qualunque
   elemento, rarità migliori. Si tira la rarità con le probabilità
   dell'uovo; se l'elemento non ha pet di quella rarità si scende alla
   più vicina sotto (o sopra, se sotto non c'è niente). */
export const ELEMENT_ODDS = { common: 70, rare: 25, epic: 4.5, legendary: 0.5 };
export const PRISM_ODDS = { common: 40, rare: 45, epic: 13, legendary: 2 };

const EGG_NAME = {
  fire: "Uovo di Brace", cold: "Uovo di Brina", water: "Uovo delle Maree", lightning: "Uovo della Tempesta",
  earth: "Uovo di Pietra", acid: "Uovo Corrosivo", poison: "Uovo Velenoso", necrotic: "Uovo della Cripta",
  radiant: "Uovo Aureo", psychic: "Uovo Onirico",
};
export const EGGS = {
  ...Object.fromEntries(ELEMENTS.map((el) => [el, {
    key: el, name: EGG_NAME[el], element: el, cost: 60, odds: ELEMENT_ODDS,
    desc: `Dentro c'è una creatura di ${TYPE_LABEL[el].toLowerCase()}.`,
  }])),
  prismatic: {
    key: "prismatic", name: "Uovo Prismatico", element: null, cost: 200, odds: PRISM_ODDS,
    desc: "Cangiante: può contenere una creatura di qualunque elemento, e le rare escono più spesso.",
  },
};
export const EGG_ORDER = [...ELEMENTS, "prismatic"];

export const eggPool = (eggKey, rarity) => PET_DEX_ORDER.filter((k) => {
  const egg = EGGS[eggKey];
  return (!egg?.element || PET_DEX[k].type === egg.element) && (!rarity || hatchRarityOf(k) === rarity);
});

export function rollEgg(eggKey, rnd = Math.random) {
  const egg = EGGS[eggKey] || EGGS.prismatic;
  const total = HATCH_RARITIES.reduce((s, r) => s + egg.odds[r], 0);
  let x = rnd() * total, rarity = "common";
  for (const r of HATCH_RARITIES) { if (x < egg.odds[r]) { rarity = r; break; } x -= egg.odds[r]; }
  const idx = HATCH_RARITIES.indexOf(rarity);
  const order = [...HATCH_RARITIES.slice(0, idx + 1).reverse(), ...HATCH_RARITIES.slice(idx + 1)];
  for (const r of order) {
    const pool = eggPool(egg.key, r);
    if (pool.length) return { species: pool[Math.floor(rnd() * pool.length)], rarity: r };
  }
  return { species: PET_DEX_ORDER[0], rarity: "common" };
}

// Probabilità VERA di ogni specie in un uovo (con le ricadute sulle rarità mancanti).
export function eggChances(eggKey) {
  const egg = EGGS[eggKey] || EGGS.prismatic;
  const total = HATCH_RARITIES.reduce((s, r) => s + egg.odds[r], 0);
  const out = {};
  HATCH_RARITIES.forEach((rarity, idx) => {
    const order = [...HATCH_RARITIES.slice(0, idx + 1).reverse(), ...HATCH_RARITIES.slice(idx + 1)];
    const r = order.find((x) => eggPool(egg.key, x).length);
    if (!r) return;
    const pool = eggPool(egg.key, r);
    pool.forEach((k) => { out[k] = (out[k] || 0) + (egg.odds[rarity] / total) * 100 / pool.length; });
  });
  return out;
}

/* ── PUNTI PET ──────────────────────────────────────────────
   Il portafoglio è `characters.petPoints` (utils/pet.js: Arena, login,
   World Boss, Torre). Un doppione oltre il limite diventa metà del
   valore della sua rarità. */
export const valueOf = (key) => RARITY[PET_DEX[key]?.rarity]?.value ?? 40;
export const refundOf = (key) => Math.floor(valueOf(key) / 2);
