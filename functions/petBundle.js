// GENERATO da src/data/petOps.js con npm run build:pets: non modificare a mano.
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/data/petOps.js
var petOps_exports = {};
__export(petOps_exports, {
  LOSS_XP: () => LOSS_XP,
  MASCOT_XP_BONUS: () => MASCOT_XP_BONUS,
  OPS: () => OPS,
  PVP_DAILY: () => PVP_DAILY,
  PVP_LOSS_XP: () => PVP_LOSS_XP,
  PVP_POINTS: () => PVP_POINTS,
  PVP_WIN_XP: () => PVP_WIN_XP,
  PVP_XP_FIGHTS: () => PVP_XP_FIGHTS,
  STARTER_GIFT: () => STARTER_GIFT,
  applyGrowthItem: () => applyGrowthItem,
  buyEgg: () => buyEgg,
  buyItem: () => buyItem,
  canResetTower: () => canResetTower,
  chooseStarter: () => chooseStarter,
  claimGifts: () => claimGifts,
  countOf: () => countOf,
  denOf: () => denOf,
  evolvePet: () => evolvePet,
  giveCharm: () => giveCharm,
  giveItems: () => giveItems,
  givePet: () => givePet,
  hatchEgg: () => hatchEgg,
  learnMove: () => learnMove,
  recordPvpResult: () => recordPvpResult,
  releasePet: () => releasePet,
  renamePet: () => renamePet,
  replayTower: () => replayTower,
  resetTower: () => resetTower,
  setMascot: () => setMascot,
  setMoveset: () => setMoveset,
  setTeam: () => setTeam,
  teachScroll: () => teachScroll,
  towerFinish: () => towerFinish,
  towerFresh: () => towerFresh,
  towerSeed: () => towerSeed,
  towerStart: () => towerStart,
  towerTurnSeed: () => towerTurnSeed,
  validAction: () => validAction
});
module.exports = __toCommonJS(petOps_exports);

// src/data/petEvo.js
var EVO_LEVEL = { starter: 15, common: 15, rare: 18, epic: 22, legendary: 26 };
var EVO_HP_DICE = { starter: [3, 8], common: [3, 8], rare: [3, 10], epic: [3, 12], legendary: [4, 12] };
var EVO_MULT = { atk: 1.12, def: 1.12, spd: 1.08 };
var EVO_MOVES = {
  soffiorosso: ["Soffio del Drago Rosso", "fire", 130, 90, "breath", { uses: 1, effect: { burn: 0.5 } }],
  pungiviverna: ["Pungiglione di Viverna", "poison", 110, 90, "sting", { uses: 2, effect: { poison: 0.6 } }],
  inglobare: ["Inglobare", "acid", 95, 90, "bite", { uses: 2, effect: { drain: 0.4, stun: 0.2 } }],
  balzolampo: ["Balzo Intermittente", "radiant", 85, 100, "dash", { uses: 3, prio: 1 }],
  morsoadesivo: ["Morso Adesivo", "acid", 90, 95, "bite", { uses: 2, effect: { stun: 0.3 } }],
  tenaglia: ["Tenaglia d'Acciaio", "water", 100, 95, "claw", { uses: 2, effect: { foe: { def: -1, ac: -1 }, chance: 0.5 } }],
  fulminebehir: ["Fulmine del Behir", "lightning", 125, 90, "bolt", { uses: 1, effect: { stun: 0.25 } }],
  tentacoli: ["Stretta dei Tentacoli", "water", 110, 90, "whip", { uses: 2, effect: { foe: { spd: -1 }, chance: 1, stun: 0.2 } }],
  raggioocchio: ["Raggio dell'Occhio", "psychic", 125, 85, "beam", { uses: 1, effect: { stun: 0.3 } }],
  cornoguaritore: ["Corno Guaritore", "radiant", 0, 100, "heal", { uses: 1, effect: { heal: 0.5, cure: true } }],
  soffioinverno: ["Soffio Invernale", "cold", 110, 90, "breath", { uses: 2, effect: { foe: { spd: -1 }, chance: 1 } }],
  morsoputrido: ["Morso Putrido", "poison", 100, 90, "bite", { uses: 2, effect: { poison: 0.5, foe: { def: -1 }, chance: 0.4 } }],
  lamento: ["Lamento dello Spettro", "necrotic", 95, 95, "wave", { uses: 2, effect: { foe: { atk: -1 }, chance: 0.6 } }],
  balzomortale: ["Balzo Mortale", "earth", 130, 85, "stomp", { uses: 1, effect: { stun: 0.3 } }],
  soffiobianco: ["Soffio del Drago Bianco", "cold", 130, 90, "breath", { uses: 1, effect: { stun: 0.3 } }],
  soffioblu: ["Soffio del Drago Blu", "lightning", 130, 90, "beam", { uses: 1, effect: { foe: { ac: -1 }, chance: 1 } }],
  esplosionementale: ["Esplosione Mentale", "psychic", 110, 90, "wave", { uses: 1, effect: { stun: 0.5 } }],
  // nuovi pet e draghi (2026-11-01)
  polverefatata: ["Polvere Fatata", "psychic", 0, 90, "cloud", { uses: 2, effect: { sleep: 1 } }],
  galoppoceleste: ["Galoppo Celeste", "radiant", 100, 100, "dash", { uses: 2, prio: 1 }],
  soffioverde: ["Soffio del Drago Verde", "poison", 130, 90, "cloud", { uses: 1, effect: { poison: 0.6 } }],
  soffionero: ["Soffio del Drago Nero", "acid", 130, 90, "beam", { uses: 1, effect: { foe: { def: -1 }, chance: 1 } }],
  soffiooro: ["Soffio del Drago d'Oro", "fire", 135, 90, "breath", { uses: 1, effect: { burn: 0.4 } }],
  soffioargento: ["Soffio del Drago d'Argento", "cold", 125, 90, "breath", { uses: 1, effect: { foe: { spd: -1 }, chance: 1, stun: 0.2 } }],
  soffiobronzo: ["Soffio del Drago di Bronzo", "lightning", 125, 90, "beam", { uses: 1, effect: { stun: 0.3 } }],
  soffiorame: ["Soffio del Drago di Rame", "acid", 120, 90, "beam", { uses: 1, effect: { foe: { spd: -1 }, chance: 1 } }],
  soffioottone: ["Soffio Soporifero d'Ottone", "fire", 115, 90, "breath", { uses: 1, effect: { sleep: 0.35 } }],
  soffioametista: ["Soffio d'Ametista", "psychic", 125, 90, "wave", { uses: 1, effect: { foe: { def: -1 }, chance: 0.6 } }],
  soffiocristallo: ["Soffio di Cristallo", "radiant", 125, 90, "burst", { uses: 1, effect: { stun: 0.25 } }],
  soffiosmeraldo: ["Soffio di Smeraldo", "psychic", 120, 90, "wave", { uses: 1, effect: { foe: { atk: -1 }, chance: 0.6 } }],
  soffiozaffiro: ["Soffio di Zaffiro", "lightning", 125, 90, "wave", { uses: 1, effect: { stun: 0.3 } }],
  soffiotopazio: ["Soffio di Topazio", "necrotic", 125, 90, "breath", { uses: 1, effect: { drain: 0.3 } }]
};
var E = (name, icon, desc, look, skill, extra = {}) => ({ name, icon, desc, look, skill, ...extra });
var EVOLUTIONS = {
  brace: E(
    "Dragone Rosso",
    "\u{1F409}",
    "Un giovane drago rosso: superbo, avido, e ogni respiro sa di incendio.",
    "a young red dragon, large powerful crimson-scaled dragon with big swept-back horns, wide leathery wings half open, fierce golden eyes, fiery maw with embers and smoke",
    { move: "soffiorosso" },
    { plus: { atk: 1 } }
  ),
  tartadrago: E(
    "Dragartaruga",
    "\u{1F422}",
    "La tartaruga-drago adulta: un'isola che nuota e affonda le navi per noia.",
    "an adult dragon turtle, massive armored sea dragon turtle with a huge spiked emerald shell, long draconic neck and head with fins, steam rising, stern ancient eyes",
    { passive: "corazza", v: 3 },
    { res: { resist: ["cold"] } }
  ),
  gufurso: E(
    "Gufurso Adulto",
    "\u{1F989}",
    "Un gufurso cresciuto: due metri e mezzo di piume, artigli e cattivo umore.",
    "an adult owlbear, huge hulking bear body with brown feathers and fur, fierce owl face with a sharp hooked beak and glaring eyes, massive clawed paws raised",
    { passive: "furia", v: 0.5 },
    { plus: { atk: 1 } }
  ),
  pseudodrago: E(
    "Viverna",
    "\u{1F409}",
    "Lo pseudodrago \xE8 diventato una viverna: due zampe, due ali e una coda che uccide.",
    "a wyvern, lean dark-red two-legged dragon with large bat-like wings, long whip tail ending in a huge dripping venomous stinger, predatory yellow eyes",
    { move: "pungiviverna" },
    { res: { immune: ["poison"] } }
  ),
  gattombra: E(
    "Belva Distorcente",
    "\u{1F406}",
    "Una belva distorcente adulta: vedi sei zampe e due tentacoli, ma mai dove sono davvero.",
    "an adult displacer beast, sleek large blue-black six-legged panther with two long barbed tentacles on its back, glowing violet eyes, shimmering displaced afterimage",
    { passive: "sfocatura" }
  ),
  mefitino: E(
    "Elementale del Magma",
    "\u{1F30B}",
    "Il mefite \xE8 cresciuto in un ammasso di roccia fusa: toccarlo fa male a chi tocca.",
    "a magma elemental, large hulking humanoid of black cooling rock with glowing orange lava cracks, molten fists dripping lava, burning eyes, heat haze",
    { passive: "spine", v: 0.2 }
  ),
  cubetto: E(
    "Cubo Gelatinoso",
    "\u{1F7E9}",
    "Un cubo gelatinoso vero: riempie un corridoio e dentro ha l'armatura dell'ultimo eroe.",
    "a large gelatinous cube, huge translucent lime-green acidic jelly cube filling the frame, a skeleton, a sword and coins suspended inside, menacing faint glow, acid drips",
    { move: "inglobare" },
    { res: { resist: ["acid"] } }
  ),
  funghetto: E(
    "Sovrano Miconide",
    "\u{1F344}",
    "Il re dei miconidi: un fungo alto come un albero che guarisce chi lo segue.",
    "a myconid sovereign, tall regal mushroom humanoid with a broad spotted purple cap like a crown, long fungal robes, glowing spore clouds, wise solemn face",
    { passive: "rigenera", v: 1 / 12 },
    { res: { resist: ["poison"] } }
  ),
  saltello: E(
    "Cane Intermittente",
    "\u{1F415}",
    "Un cane intermittente adulto: c'\xE8, non c'\xE8, ti morde da dietro.",
    "an adult blink dog, sleek tall golden fey hound with long ears, alert noble face, radiant sparkles and a teleport flash around its body",
    { move: "balzolampo" },
    { plus: { spd: 1 } }
  ),
  diavoletto: E(
    "Diavolo Spinato",
    "\u{1F608}",
    "Il diavoletto \xE8 salito di grado: ora \xE8 un diavolo spinato, e le spine le lancia.",
    "a spined devil, wiry red devil with a body covered in long sharp spines, bat wings, a spiny tail, cruel grin, dark smoke",
    { passive: "spine", v: 0.25 }
  ),
  scrignetto: E(
    "Mimic Antico",
    "\u{1F9F0}",
    "Un mimic vecchio come il dungeon: un forziere enorme che si incolla a chi lo apre.",
    "an ancient mimic, huge iron-bound treasure chest monster with rows of jagged teeth, a long sticky tongue, adhesive goo dripping, beady eyes on the lid",
    { move: "morsoadesivo" }
  ),
  yetino: E(
    "Yeti Abominevole",
    "\u{1F98D}",
    "Lo yeti adulto: quando ruggisce le valanghe si spostano per educazione.",
    "an abominable yeti, towering muscular white-furred yeti with icy blue skin, curved horns, huge clawed hands, roaring mouth with fangs, swirling snow",
    { passive: "intimidire" },
    { res: { resist: ["bludgeoning"] } }
  ),
  brinello: E(
    "Spirito della Bufera",
    "\u2744\uFE0F",
    "Il mefite del ghiaccio si \xE8 fatto tempesta: chi lo sfiora resta di ghiaccio.",
    "a frost storm spirit, tall elegant elemental of jagged blue ice crystals and swirling blizzard winds, cold glowing eyes, icicle crown",
    { passive: "tocco", v: 0.15, st: "stun" }
  ),
  granchietto: E(
    "Granchio Gigante",
    "\u{1F980}",
    "Il granchio gigante, finalmente gigante. Le chele tagliano l'acciaio.",
    "a giant crab, huge armored crimson and steel-blue crab with massive serrated claws, spiked shell, eyes on stalks, sea foam",
    { move: "tenaglia" },
    { plus: { ac: 1 } }
  ),
  ragnetto: E(
    "Ragno Gigante",
    "\u{1F577}\uFE0F",
    "Un ragno gigante adulto: il suo veleno ti lascia sveglio, ma fermo.",
    "an adult giant spider, large hairy black and purple spider with long legs, eight glowing red eyes, huge fangs dripping green venom, webs",
    { passive: "tocco", v: 0.25, st: "poison" }
  ),
  scheletrino: E(
    "Mastino Scheletrico",
    "\u{1F480}",
    "Il cucciolo d'ossa \xE8 un mastino non morto: non sente dolore, n\xE9 veleno.",
    "a skeletal war hound, large undead mastiff made of cracked bones with an armored skull, ghostly green fire in the eye sockets and ribcage, chain collar",
    { passive: "purezza" }
  ),
  behirino: E(
    "Behir",
    "\u{1F40D}",
    "Un behir adulto: venti metri di serpente con dodici zampe e il fulmine in gola.",
    "an adult behir, long massive blue serpentine reptile with many clawed legs, curved horns, armored scales, crackling lightning from its open jaws",
    { move: "fulminebehir" }
  ),
  flumphino: E(
    "Flumph Anziano",
    "\u{1FABC}",
    "Un flumph anziano: galleggia sereno e la sua calma guarisce le ferite.",
    "an elder flumph, large floating jellyfish-like disc creature with long glowing tendrils, two tall eyestalks, calm wise expression, soft pink psychic aura",
    { passive: "rigenera", v: 1 / 14 },
    { res: { resist: ["psychic"] } }
  ),
  salamandrina: E(
    "Salamandra",
    "\u{1F98E}",
    "Una salamandra di fuoco adulta: dove striscia, il terreno resta nero.",
    "an adult fire salamander, long large serpentine lizard of red-orange scales with a crest of flames along its back and a burning tail, fierce face, embers",
    { passive: "tocco", v: 0.3, st: "burn" }
  ),
  krakino: E(
    "Kraken Giovane",
    "\u{1F419}",
    "Il kraken non \xE8 pi\xF9 neonato: i suoi tentacoli stringono navi e pet.",
    "a young kraken, huge dark teal and purple squid monster with many thick tentacles lashing, one enormous glaring eye, sharp beak, crashing waves",
    { move: "tentacoli" }
  ),
  ruggine: E(
    "Mostro della Ruggine",
    "\u{1F41C}",
    "Un mostro della ruggine adulto: le armature gli si sbriciolano addosso.",
    "an adult rust monster, large armored insectoid beast with rusty orange carapace, two long feathery antennae, flaking metal debris, determined face",
    { passive: "tocco", v: 0.3, st: "ac" },
    { res: { resist: ["slashing"] } }
  ),
  turbino: E(
    "Elementale dell'Aria",
    "\u{1F32A}\uFE0F",
    "Il mulinello \xE8 diventato tempesta: un elementale dell'aria che urla fulmini.",
    "an air elemental, towering roaring tornado of pale blue wind with a vague fierce face, crackling lightning inside, debris swirling",
    { passive: "elemento" }
  ),
  occhietto: E(
    "Beholder",
    "\u{1F441}\uFE0F",
    "Lo spettatore \xE8 diventato un beholder: un occhio, dieci raggi, nessuna piet\xE0.",
    "a beholder, large floating spherical aberration with one huge central eye, ten writhing eyestalks, wide mouth full of teeth, purple hide, menacing glare",
    { move: "raggioocchio" }
  ),
  cornina: E(
    "Unicorno",
    "\u{1F984}",
    "Un unicorno adulto: il suo corno chiude le ferite e scaccia i veleni.",
    "an adult unicorn, tall majestic white horse with a long glowing golden spiral horn, flowing silver mane, noble serious eyes, holy light",
    { move: "cornoguaritore" },
    { res: { resist: ["radiant"] } }
  ),
  cerberino: E(
    "Segugio Infernale",
    "\u{1F415}\u200D\u{1F9BA}",
    "Un segugio infernale adulto: fiuta la paura e morde dove fa pi\xF9 male.",
    "an adult hell hound, large black-furred demonic dog with a mane of fire, glowing red eyes, smoking jaws full of fangs, burning paw prints",
    { passive: "critico", v: 18 }
  ),
  lupogelo: E(
    "Lupo Invernale",
    "\u{1F43A}",
    "Il lupo invernale adulto: il suo fiato congela le gambe di chi scappa.",
    "an adult winter wolf, huge snow-white wolf with icy blue eyes, frost covering its thick fur, freezing mist breath, snarling",
    { move: "soffioinverno" }
  ),
  gocciolo: E(
    "Stranezza delle Acque",
    "\u{1F4A7}",
    "La goccia \xE8 diventata una stranezza delle acque: l'acqua la nutre.",
    "a water weird, tall serpentine creature made of living clear blue water rising from a pool, translucent body, cold glowing eyes, splashes",
    { passive: "assorbi", el: "water" }
  ),
  fuocofatuo: E(
    "Fuoco Fatuo Antico",
    "\u{1F506}",
    "Un fuoco fatuo che ha bevuto mille paure: si nutre di chi colpisce.",
    "an ancient will-o'-wisp, large sinister floating orb of pale blue-white electric light with a ghostly skull-like face inside, crackling tendrils",
    { passive: "succhiavita", v: 0.25 }
  ),
  otyughino: E(
    "Otyugh",
    "\u{1F5D1}\uFE0F",
    "Un otyugh adulto: tre zampe, due tentacoli e un morso che porta la febbre.",
    "an adult otyugh, large bloated greenish-brown aberration on three thick legs, two long tentacles with spiked tips, an eye stalk, huge toothy maw, filth",
    { move: "morsoputrido" },
    { res: { immune: ["poison"] } }
  ),
  fantasmino: E(
    "Spettro",
    "\u{1F47B}",
    "Il fantasmino non chiede pi\xF9 scusa: il suo lamento svuota il coraggio.",
    "a wraith-like spectre, tall dark translucent ghost in tattered shroud, hollow glowing eyes, long clawed spectral hands, cold mist",
    { move: "lamento" }
  ),
  squalterra: E(
    "Bulette",
    "\u{1F988}",
    "La bulette adulta: salta fuori dalla terra e ricade addosso a tutto.",
    "an adult bulette (landshark), huge armored blue-grey beast with a shark-like head, a tall dorsal crest, powerful clawed legs, leaping out of cracked earth",
    { move: "balzomortale" },
    { plus: { def: 1 } }
  ),
  piumaserpe: E(
    "Couatl",
    "\u{1FAB6}",
    "Il couatl adulto: serpente piumato e guardiano, la sua volont\xE0 non si piega.",
    "an adult couatl, long majestic golden feathered serpent with wide rainbow feathered wings, wise serious eyes, radiant holy aura",
    { passive: "leggendaria" },
    { res: { resist: ["psychic"] } }
  ),
  nevischio: E(
    "Drago Bianco",
    "\u{1F409}",
    "Un giovane drago bianco: feroce, affamato, e il suo soffio ferma il cuore.",
    "a young white dragon, large icy-white dragon with jagged frost frills, wide wings, cruel pale blue eyes, freezing breath mist, ice crystals",
    { move: "soffiobianco" }
  ),
  saettino: E(
    "Drago Blu",
    "\u{1F409}",
    "Un giovane drago blu: il grande corno sul naso chiama i fulmini del deserto.",
    "a young blue dragon, large sapphire-blue dragon with one big horn on its nose, wide wings, arrogant golden eyes, lightning crackling from its jaws",
    { move: "soffioblu" }
  ),
  girino: E(
    "Mind Flayer",
    "\u{1F991}",
    "Il girino \xE8 diventato un mind flayer: buono non lo dice pi\xF9.",
    "a mind flayer (illithid), tall humanoid with purple skin and an octopus head with four face tentacles, white pupil-less eyes, high-collared dark robes, psychic aura",
    { move: "esplosionementale" }
  ),
  tarrasquino: E(
    "Tarrasque",
    "\u{1F996}",
    "Il Tarrasque. Non pi\xF9 in miniatura. Che gli dei vi aiutino.",
    "the tarrasque, colossal reptilian kaiju with a massive spiked carapace, two huge forward horns, gaping jaws full of teeth, earth shaking, apocalyptic",
    { passive: "corazza", v: 4 }
  ),
  lichetto: E(
    "Lich",
    "\u2620\uFE0F",
    "Un lich vero: finch\xE9 il filatterio esiste, non va mai gi\xF9 davvero.",
    "a lich, tall skeletal undead sorcerer in ornate tattered purple and black robes with a golden crown, glowing green eyes, holding a phylactery, necrotic green flames",
    { passive: "tenacia" }
  ),
  // ── nuovi pet (2026-11-01) ──
  magmino: E(
    "Azer",
    "\u{1F525}",
    "Il mefite \xE8 diventato un azer: un fabbro di bronzo con la barba di fuoco. Toccarlo scotta.",
    "an azer, sturdy dwarf-like humanoid with bronze metallic skin, hair and beard made of living flames, holding a smith hammer, glowing hot body",
    { passive: "tocco", v: 0.25, st: "burn" }
  ),
  ranocchietto: E(
    "Capotrib\xF9 Bullywug",
    "\u{1F438}",
    "Il ranocchio ora comanda la palude: si mimetizza fra le canne e gracida ordini.",
    "a bullywug chieftain, large muscular frog-man with mottled green skin, a crown of reeds, spear in hand, wide mouth, swamp mist and reeds",
    { passive: "sfocatura" }
  ),
  sassolino: E(
    "Galeb Duhr",
    "\u{1FAA8}",
    "Un galeb duhr adulto: una roccia saggia che chiama i massi a rotolare.",
    "an adult galeb duhr, large boulder-shaped earth creature with thick rocky limbs, mossy cracks, deep glowing eyes, small stones floating around it",
    { passive: "corazza", v: 2 }
  ),
  stirgetta: E(
    "Stirge Regina",
    "\u{1F99F}",
    "La regina delle stirge: grossa come un falco, beve finch\xE9 non \xE8 sazia.",
    "a stirge queen, large bat-mosquito monster with leathery wings, long blood-red proboscis, swollen abdomen, four clawed legs, red glowing eyes",
    { passive: "succhiavita", v: 0.3 }
  ),
  folletta: E(
    "Nobile Fatata",
    "\u{1F9DA}",
    "La pixie \xE8 diventata una nobile della corte fatata: una pizzicata di polvere e dormi.",
    "a fey noble, elegant fairy lady with large shimmering butterfly wings, a delicate flower crown, flowing petal gown, swirling glittering fairy dust",
    { move: "polverefatata" }
  ),
  lanternino: E(
    "Deva",
    "\u{1F607}",
    "La lucina \xE8 cresciuta in un deva: un angelo guerriero, puro come la luce.",
    "a deva angel, tall serene celestial warrior with silver skin, feathered white wings, golden armor, radiant halo, holy mace",
    { passive: "purezza" },
    { res: { resist: ["radiant"] } }
  ),
  scossino: E(
    "Scossauro",
    "\u{1F98E}",
    "La lucertola \xE8 diventata un rettile della tempesta: i fulmini la nutrono.",
    "a large storm lizard, big pale blue reptile with a tall crackling frilled crest, lightning arcs running across its spines, fierce eyes",
    { passive: "assorbi", el: "lightning" }
  ),
  gargolino: E(
    "Gargoyle",
    "\u{1F5FF}",
    "Un gargoyle vero: veglia sui tetti per secoli e non si stanca mai.",
    "a gargoyle, menacing grey stone winged demon with horns, clawed hands and feet, cracked stone skin, crouched on a cathedral ledge",
    { passive: "tenacia" }
  ),
  budino: E(
    "Budino Nero",
    "\u{1F36E}",
    "Un budino nero adulto: scioglie armi e armature come burro.",
    "an adult black pudding, huge glossy black amorphous ooze, bubbling corrosive surface dissolving a sword and shield, dripping acid",
    { passive: "tocco", v: 0.35, st: "ac" }
  ),
  pegasino: E(
    "Pegaso",
    "\u{1F434}",
    "Il pegaso adulto: galoppa sulle nuvole pi\xF9 veloce del vento.",
    "a pegasus, majestic white winged horse with large feathered wings spread, flowing silver mane, golden hooves, galloping on clouds, holy light",
    { move: "galoppoceleste" }
  ),
  // ── draghi (2026-11-01) ──
  verdino: E(
    "Drago Verde",
    "\u{1F409}",
    "Un giovane drago verde: manipolatore, crudele, e il suo soffio \xE8 una nube di veleno.",
    "a young green dragon, large emerald-green dragon with a tall leafy crest, wide wings, cunning yellow eyes, thick green poisonous gas from its jaws, forest",
    { move: "soffioverde" }
  ),
  nerolino: E(
    "Drago Nero",
    "\u{1F409}",
    "Un giovane drago nero: il signore della palude, il suo soffio scioglie la carne.",
    "a young black dragon, large glossy black dragon with forward-curving horns and a skeletal face, wide wings, a stream of green acid from its jaws, swamp",
    { move: "soffionero" }
  ),
  dorino: E(
    "Drago d'Oro",
    "\u{1F409}",
    "Un giovane drago d'oro: nobile, saggio, il pi\xF9 potente dei draghi metallici.",
    "a young gold dragon, majestic shining golden dragon with long whiskers and frilled head, large elegant wings, wise noble eyes, golden flames",
    { move: "soffiooro" },
    { plus: { def: 1 } }
  ),
  argentino: E(
    "Drago d'Argento",
    "\u{1F409}",
    "Un giovane drago d'argento: protettore dei deboli, soffia vento gelido che paralizza.",
    "a young silver dragon, elegant shining silver dragon with smooth frilled head, large wings, kind blue eyes, freezing breath, among clouds",
    { move: "soffioargento" }
  ),
  bronzino: E(
    "Drago di Bronzo",
    "\u{1F409}",
    "Un giovane drago di bronzo: guardiano delle coste, chiama i fulmini sulle onde.",
    "a young bronze dragon, large bronze-scaled dragon with ridged horns and webbed claws, wide wings, brave eyes, lightning bolt from its jaws, stormy sea",
    { move: "soffiobronzo" }
  ),
  ramino: E(
    "Drago di Rame",
    "\u{1F409}",
    "Un giovane drago di rame: burlone, ma il suo soffio rallenta chiunque.",
    "a young copper dragon, large shiny copper-red dragon with flat backswept horns, wide wings, mischievous grin, acid breath, rocky hills",
    { move: "soffiorame" }
  ),
  ottonino: E(
    "Drago d'Ottone",
    "\u{1F409}",
    "Un giovane drago d'ottone: parla, parla, parla\u2026 e chi non ascolta si addormenta.",
    "a young brass dragon, large brass-yellow dragon with a huge shield-like head crest, wide wings, talkative face, fire breath, desert sands",
    { move: "soffioottone" }
  ),
  ametistino: E(
    "Drago d'Ametista",
    "\u{1F409}",
    "Un giovane drago d'ametista: la sua mente spinge come un'onda di forza pura.",
    "a young amethyst gem dragon, large dragon with translucent purple crystal scales, faceted gem horns, crystalline wings, violet psychic force wave",
    { move: "soffioametista" }
  ),
  cristallino: E(
    "Drago di Cristallo",
    "\u{1F409}",
    "Un giovane drago di cristallo: risplende come una stella e acceca chi lo sfida.",
    "a young crystal gem dragon, large dragon with clear sparkling crystal scales refracting rainbows, faceted horns, glassy wings, blinding radiant breath",
    { move: "soffiocristallo" }
  ),
  smeraldino: E(
    "Drago di Smeraldo",
    "\u{1F409}",
    "Un giovane drago di smeraldo: paranoico, sfuggente, ti confonde le idee.",
    "a young emerald gem dragon, large dragon with deep green gemstone scales, faceted crest, crystal wings, shimmering illusions and psychic distortion",
    { move: "soffiosmeraldo" }
  ),
  zaffirino: E(
    "Drago di Zaffiro",
    "\u{1F409}",
    "Un giovane drago di zaffiro: un ruggito e il tuono rimbomba nelle caverne.",
    "a young sapphire gem dragon, large dragon with brilliant blue gemstone scales, faceted horns, crystal wings, booming thunder shockwave from its jaws",
    { move: "soffiozaffiro" }
  ),
  topazino: E(
    "Drago di Topazio",
    "\u{1F409}",
    "Un giovane drago di topazio: il suo soffio secca e avvizzisce ogni cosa viva.",
    "a young topaz gem dragon, large dragon with golden-orange gemstone scales, faceted crest, crystal wings, dark withering necrotic breath, lonely shore",
    { move: "soffiotopazio" }
  )
};
var evoLevelOf = (rarity) => EVO_LEVEL[rarity] || 15;
var evoDiceOf = (rarity) => EVO_HP_DICE[rarity] || [3, 8];

// src/data/petDex.js
var MAX_PER_SPECIES = 2;
var MAX_TEAM = 3;
var MAX_EGGS = 24;
var MAX_LEVEL = 50;
var MOVE_UNLOCK = [1, 1, 5, 10];
var PET_TYPES = ["fire", "cold", "water", "lightning", "earth", "acid", "poison", "necrotic", "radiant", "psychic", "neutral"];
var ELEMENTS = PET_TYPES.filter((t) => t !== "neutral");
var TYPE_ICON = {
  fire: "\u{1F525}",
  cold: "\u2744\uFE0F",
  water: "\u{1F4A7}",
  lightning: "\u26A1",
  earth: "\u{1FAA8}",
  acid: "\u{1F9EA}",
  poison: "\u2620\uFE0F",
  necrotic: "\u{1F480}",
  radiant: "\u2728",
  psychic: "\u{1F52E}",
  neutral: "\u2726"
};
var TYPE_LABEL = {
  fire: "Fuoco",
  cold: "Gelo",
  water: "Acqua",
  lightning: "Fulmine",
  earth: "Terra",
  acid: "Acido",
  poison: "Veleno",
  necrotic: "Necrotico",
  radiant: "Radioso",
  psychic: "Psichico",
  neutral: "Fisico"
};
var DMG_ICON = { ...TYPE_ICON, bludgeoning: "\u{1F528}", piercing: "\u{1F9B7}", slashing: "\u{1F5E1}\uFE0F" };
var DMG_LABEL = { ...TYPE_LABEL, bludgeoning: "Contundente", piercing: "Perforante", slashing: "Tagliente" };
var PHYS_OF_FX = { stomp: "bludgeoning", dash: "bludgeoning", bite: "piercing", sting: "piercing", claw: "slashing", whip: "slashing" };
var damageKindOf = (move) => move?.type && move.type !== "neutral" ? move.type : PHYS_OF_FX[move?.fx] || "bludgeoning";
function resOf(speciesKey, evo = 0) {
  const r = PET_DEX[speciesKey]?.res || null;
  const x = evo ? EVOLUTIONS[speciesKey]?.res : null;
  if (!x) return r;
  const u = (a = [], b = []) => [.../* @__PURE__ */ new Set([...a, ...b])];
  const immune = u(r?.immune, x.immune);
  return { immune, resist: u(r?.resist, x.resist).filter((k) => !immune.includes(k)), vuln: (r?.vuln || []).filter((k) => !immune.includes(k)) };
}
function resistMultiplier(speciesKey, kind, evo = 0) {
  const r = resOf(speciesKey, evo);
  if (!r) return 1;
  if (r.immune?.includes(kind)) return 0;
  let m = 1;
  if (r.resist?.includes(kind)) m *= 0.5;
  if (r.vuln?.includes(kind)) m *= 2;
  return m;
}
var STRONG = {
  fire: ["cold", "poison"],
  cold: ["water", "lightning"],
  water: ["fire", "acid"],
  lightning: ["water", "psychic"],
  earth: ["lightning", "fire"],
  acid: ["cold", "radiant"],
  poison: ["earth", "water"],
  necrotic: ["earth", "psychic"],
  radiant: ["necrotic", "poison"],
  psychic: ["poison", "acid"]
};
function typeMultiplier(att, def) {
  if (!att || att === "neutral" || !def) return 1;
  if (STRONG[att]?.includes(def)) return 1.5;
  if (STRONG[def]?.includes(att)) return 0.5;
  return 1;
}
var RARITY = {
  starter: { label: "Iniziale", color: "#d9a441", value: 40 },
  common: { label: "Comune", color: "#8a8f99", value: 40 },
  rare: { label: "Raro", color: "#3d8fd1", value: 90 },
  epic: { label: "Epico", color: "#a45ad8", value: 180 },
  legendary: { label: "Leggendario", color: "#e0782b", value: 400 }
};
var HATCH_RARITIES = ["common", "rare", "epic", "legendary"];
var hatchRarityOf = (key) => PET_DEX[key]?.rarity === "starter" ? "common" : PET_DEX[key]?.rarity;
var DICE_BY_POWER = [[35, "1d12"], [40, "2d6"], [45, "3d4"], [55, "2d8"], [65, "2d10"], [70, "2d12"], [75, "3d8"], [80, "4d6"], [90, "3d10"], [95, "5d6"], [100, "4d8"], [115, "6d6"], [999, "4d10"]];
var diceFor = (p) => p ? DICE_BY_POWER.find(([x]) => p <= x)[1] : null;
var M = (name, type, power, acc, pp, fx, extra = {}) => ({ name, type, power, acc, pp, fx, dice: diceFor(power), ...extra });
var PET_DEX_MOVES = {
  // ── fisiche (neutre: chiunque le può imparare) ──
  zampata: M("Zampata", "neutral", 40, 100, 30, "stomp", { lv: 1 }),
  graffio: M("Graffio", "neutral", 45, 100, 25, "claw", { lv: 1 }),
  scattino: M("Scattino", "neutral", 35, 100, 20, "dash", { lv: 1, prio: 1 }),
  morsetto: M("Morsetto", "neutral", 55, 95, 20, "bite", { lv: 2 }),
  colpocoda: M("Colpo di Coda", "neutral", 55, 100, 20, "whip", { lv: 2 }),
  ingoiare: M("Ingoiare", "neutral", 60, 90, 10, "bite", { lv: 3, effect: { drain: 0.5 } }),
  doppiograffio: M("Doppio Graffio", "neutral", 70, 95, 15, "claw", { lv: 3 }),
  testata: M("Testata", "neutral", 80, 85, 10, "dash", { lv: 4, effect: { recoil: 0.25 } }),
  caricafuriosa: M("Carica Furiosa", "neutral", 100, 85, 8, "dash", { lv: 5, effect: { recoil: 0.25 } }),
  schianto: M("Schianto", "neutral", 120, 80, 5, "stomp", { lv: 6 }),
  // neutre di stato: solo innate (non si imparano)
  ruggitino: M("Ruggitino", "neutral", 0, 100, 15, "roar", { effect: { foe: { atk: -1 } } }),
  guscio: M("Rintanarsi", "neutral", 0, 100, 10, "aura", { effect: { self: { ac: 2, def: 1 } } }),
  pisolino: M("Pisolino", "neutral", 0, 100, 5, "sleep", { effect: { heal: 0.5 } }),
  // ── fuoco ──
  scintilla: M("Scintilla", "fire", 40, 100, 25, "orb", { lv: 1, effect: { burn: 0.1 } }),
  artigliardenti: M("Artigli Ardenti", "fire", 40, 100, 25, "claw", { lv: 1, effect: { burn: 0.1 } }),
  sbuffo: M("Sbuffo di Brace", "fire", 65, 95, 15, "breath", { lv: 2, effect: { burn: 0.2 } }),
  fuocherello: M("Fuocherello", "fire", 0, 100, 10, "aura", { lv: 2, effect: { self: { atk: 2 } } }),
  morsofuoco: M("Zanne Ardenti", "fire", 60, 95, 15, "bite", { lv: 2, effect: { burn: 0.2 } }),
  scudofuoco: M("Scudo di Fuoco", "fire", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 1, atk: 1 } } }),
  frustafiamme: M("Frusta di Fiamme", "fire", 70, 95, 15, "whip", { lv: 3, effect: { burn: 0.2 } }),
  sferafuoco: M("Sfera di Fuoco", "fire", 75, 90, 10, "orb", { lv: 3, effect: { burn: 0.2 } }),
  caricarovente: M("Carica Rovente", "fire", 85, 90, 10, "dash", { lv: 4, effect: { burn: 0.2 } }),
  vampata: M("Vampata", "fire", 90, 85, 5, "burst", { lv: 4, effect: { burn: 0.3 } }),
  zoccolomagma: M("Pestone di Magma", "fire", 100, 85, 8, "stomp", { lv: 5, effect: { burn: 0.3 } }),
  murofuoco: M("Muro di Fuoco", "fire", 100, 85, 8, "wave", { lv: 5, effect: { burn: 0.3 } }),
  cometa: M("Cometa Ardente", "fire", 120, 85, 5, "dash", { lv: 6, effect: { burn: 0.3, recoil: 0.3 } }),
  meteore: M("Pioggia di Meteore", "fire", 120, 80, 5, "rain", { lv: 6, effect: { burn: 0.3 } }),
  // ── gelo ──
  brina: M("Scheggia di Brina", "cold", 40, 100, 25, "orb", { lv: 1, effect: { foe: { spd: -1 }, chance: 0.2 } }),
  unghiegelo: M("Unghie di Ghiaccio", "cold", 40, 100, 25, "claw", { lv: 1, effect: { foe: { spd: -1 }, chance: 0.1 } }),
  soffiogelo: M("Soffio Gelido", "cold", 65, 95, 15, "breath", { lv: 2, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  mantobrina: M("Manto di Brina", "cold", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 2 } } }),
  morsogelo: M("Morso Gelido", "cold", 60, 95, 15, "bite", { lv: 2, effect: { stun: 0.1 } }),
  frustagelo: M("Frusta di Ghiaccioli", "cold", 70, 95, 15, "whip", { lv: 3, effect: { stun: 0.1 } }),
  raggiogelo: M("Raggio Gelido", "cold", 75, 90, 10, "beam", { lv: 3, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  pestoneglaciale: M("Pestone Glaciale", "cold", 85, 90, 10, "stomp", { lv: 4, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  grandine: M("Grandinata", "cold", 90, 85, 5, "rain", { lv: 4, effect: { stun: 0.1 } }),
  valanga: M("Carica Valanga", "cold", 100, 85, 8, "dash", { lv: 5, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  lancegelo: M("Lance di Ghiaccio", "cold", 100, 85, 8, "spikes", { lv: 5, effect: { stun: 0.15 } }),
  zannepolari: M("Zanne Polari", "cold", 115, 90, 5, "bite", { lv: 6, effect: { stun: 0.2 } }),
  bufera: M("Bufera", "cold", 120, 80, 5, "breath", { lv: 6, effect: { foe: { spd: -1 }, chance: 0.5, stun: 0.1 } }),
  // ── acqua ──
  spruzzo: M("Getto d'Acqua", "water", 40, 100, 25, "beam", { lv: 1 }),
  pinzetta: M("Pinzetta", "water", 40, 100, 25, "claw", { lv: 1 }),
  bolla: M("Bollicine", "water", 60, 95, 15, "orb", { lv: 2, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  inchiostro: M("Spruzzo d'Inchiostro", "water", 0, 90, 10, "cloud", { lv: 2, effect: { foe: { atk: -1, spd: -1 } } }),
  barriera: M("Barriera d'Acqua", "water", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 2 } } }),
  codaspuma: M("Coda Spumeggiante", "water", 55, 100, 20, "whip", { lv: 2 }),
  pioggia: M("Pioggerella", "water", 0, 100, 5, "heal", { lv: 3, effect: { heal: 0.4 } }),
  morsoabissale: M("Morso Abissale", "water", 70, 95, 15, "bite", { lv: 3, effect: { foe: { def: -1 }, chance: 0.2 } }),
  bollagigante: M("Bolla Gigante", "water", 75, 90, 10, "orb", { lv: 3, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  tuffo: M("Tuffo a Bomba", "water", 85, 90, 10, "stomp", { lv: 4 }),
  ondata: M("Ondata", "water", 90, 85, 5, "wave", { lv: 4 }),
  siluro: M("Siluro", "water", 100, 85, 8, "dash", { lv: 5 }),
  vortice: M("Vortice", "water", 100, 85, 8, "curse", { lv: 5, effect: { stun: 0.2 } }),
  morsakraken: M("Morsa del Kraken", "water", 115, 90, 5, "bite", { lv: 6, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  maremoto: M("Maremoto", "water", 120, 80, 5, "wave", { lv: 6 }),
  // ── fulmine ──
  scarica: M("Scarica", "lightning", 40, 100, 25, "orb", { lv: 1, effect: { stun: 0.1 } }),
  graffioelettrico: M("Graffio Elettrico", "lightning", 40, 100, 25, "claw", { lv: 1, effect: { stun: 0.1 } }),
  scossa: M("Scossetta", "lightning", 60, 95, 15, "bolt", { lv: 2, effect: { stun: 0.2 } }),
  caricastatica: M("Carica Statica", "lightning", 0, 100, 10, "aura", { lv: 2, effect: { self: { spd: 2 } } }),
  saetta: M("Saetta", "lightning", 45, 100, 20, "beam", { lv: 2, prio: 1 }),
  morsovoltaico: M("Morso Voltaico", "lightning", 60, 95, 15, "bite", { lv: 2, effect: { stun: 0.15 } }),
  campostatico: M("Campo Statico", "lightning", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 1, spd: 1 } } }),
  frustaelettrica: M("Frusta Elettrica", "lightning", 70, 95, 15, "whip", { lv: 3, effect: { stun: 0.2 } }),
  sferatonante: M("Sfera Tonante", "lightning", 75, 90, 10, "orb", { lv: 3, effect: { stun: 0.2 } }),
  scattofulmineo: M("Scatto Fulmineo", "lightning", 80, 95, 10, "dash", { lv: 4, prio: 1 }),
  fulmine: M("Fulmine", "lightning", 90, 85, 5, "bolt", { lv: 4, effect: { stun: 0.3 } }),
  pestonetonante: M("Pestone Tonante", "lightning", 100, 85, 8, "stomp", { lv: 5, effect: { stun: 0.2 } }),
  catenafulmini: M("Catena di Fulmini", "lightning", 100, 85, 8, "beam", { lv: 5, effect: { stun: 0.2 } }),
  caricatuono: M("Carica del Tuono", "lightning", 120, 85, 5, "dash", { lv: 6, effect: { stun: 0.3, recoil: 0.3 } }),
  tempesta: M("Tempesta", "lightning", 120, 80, 5, "bolt", { lv: 6, effect: { stun: 0.3 } }),
  // ── terra ──
  rametto: M("Frusta di Rami", "earth", 40, 100, 25, "whip", { lv: 1 }),
  sassi: M("Lancio di Sassi", "earth", 40, 100, 25, "orb", { lv: 1 }),
  spore: M("Spore Sonnifere", "earth", 0, 75, 10, "cloud", { lv: 2, effect: { sleep: 1 } }),
  linfa: M("Succhia-linfa", "earth", 55, 100, 15, "drain", { lv: 2, effect: { drain: 0.5 } }),
  zampapietra: M("Zampata di Pietra", "earth", 55, 100, 20, "stomp", { lv: 2 }),
  pellepietra: M("Pelle di Pietra", "earth", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 2, def: 1 } } }),
  frustaspine: M("Frusta di Spine", "earth", 70, 95, 15, "whip", { lv: 3, effect: { foe: { def: -1 }, chance: 0.2 } }),
  frana: M("Franetta", "earth", 75, 90, 10, "rain", { lv: 3, effect: { stun: 0.1 } }),
  cornoroccia: M("Corno di Roccia", "earth", 85, 90, 10, "dash", { lv: 4 }),
  spuntoni: M("Spuntoni di Pietra", "earth", 85, 90, 10, "spikes", { lv: 4 }),
  terremoto: M("Terremotino", "earth", 95, 85, 5, "stomp", { lv: 5 }),
  rovi: M("Rovi Stritolanti", "earth", 100, 85, 8, "spikes", { lv: 5, effect: { foe: { spd: -1 }, chance: 0.5 } }),
  colosso: M("Carica del Colosso", "earth", 120, 85, 5, "dash", { lv: 6, effect: { recoil: 0.3 } }),
  spaccaterra: M("Spaccaterra", "earth", 120, 80, 5, "spikes", { lv: 6, effect: { stun: 0.2 } }),
  // ── acido ──
  sputoacido: M("Sputo Acido", "acid", 40, 100, 25, "orb", { lv: 1, effect: { foe: { ac: -1 }, chance: 0.2 } }),
  artiglicorrosivi: M("Artigli Corrosivi", "acid", 40, 100, 25, "claw", { lv: 1, effect: { foe: { ac: -1 }, chance: 0.1 } }),
  spruzzoacido: M("Spruzzo Corrosivo", "acid", 65, 95, 15, "breath", { lv: 2, effect: { foe: { ac: -1 }, chance: 0.3 } }),
  melma: M("Melma Appiccicosa", "acid", 0, 95, 15, "cloud", { lv: 2, effect: { foe: { spd: -2 } } }),
  morsoacido: M("Morso Acido", "acid", 60, 95, 15, "bite", { lv: 2, effect: { foe: { ac: -1 }, chance: 0.2 } }),
  frustacaustica: M("Frusta Caustica", "acid", 70, 95, 15, "whip", { lv: 3, effect: { foe: { ac: -1 }, chance: 0.2 } }),
  bollacorrosiva: M("Bolla Corrosiva", "acid", 75, 90, 10, "orb", { lv: 3, effect: { foe: { ac: -1 }, chance: 0.3 } }),
  corazzamelma: M("Corazza di Melma", "acid", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 2 } } }),
  tonfo: M("Tonfo Gelatinoso", "acid", 85, 90, 10, "stomp", { lv: 4, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  bagnoacido: M("Bagno d'Acido", "acid", 90, 85, 5, "burst", { lv: 4 }),
  caricamelmosa: M("Carica Melmosa", "acid", 100, 85, 8, "dash", { lv: 5, effect: { foe: { ac: -1 }, chance: 0.3 } }),
  pioggiaacida: M("Pioggia Acida", "acid", 100, 85, 8, "rain", { lv: 5, effect: { foe: { ac: -1 }, chance: 0.3 } }),
  faucidissolventi: M("Fauci Dissolventi", "acid", 115, 90, 5, "bite", { lv: 6, effect: { foe: { ac: -2 }, chance: 0.3 } }),
  geyseracido: M("Geyser d'Acido", "acid", 120, 80, 5, "spikes", { lv: 6, effect: { foe: { ac: -1 }, chance: 0.5 } }),
  // ── veleno ──
  veleno: M("Puntura Velenosa", "poison", 40, 100, 20, "sting", { lv: 1, effect: { poison: 0.3 } }),
  spruzzotossico: M("Spruzzo Tossico", "poison", 40, 100, 25, "orb", { lv: 1, effect: { poison: 0.2 } }),
  zannevelenose: M("Zanne Velenose", "poison", 60, 95, 15, "bite", { lv: 2, effect: { poison: 0.3 } }),
  nubetossica: M("Nube Tossica", "poison", 0, 85, 10, "cloud", { lv: 2, effect: { poison: 1 } }),
  pelleviscida: M("Pelle Viscida", "poison", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 1, def: 1 } } }),
  codapungente: M("Coda Pungente", "poison", 70, 95, 15, "sting", { lv: 3, effect: { poison: 0.3 } }),
  soffiomefitico: M("Soffio Mefitico", "poison", 75, 90, 10, "breath", { lv: 3, effect: { poison: 0.3 } }),
  artigliinfetti: M("Artigli Infetti", "poison", 85, 90, 10, "claw", { lv: 4, effect: { poison: 0.3 } }),
  fiotto: M("Fiotto di Veleno", "poison", 90, 85, 5, "beam", { lv: 4, effect: { poison: 0.3 } }),
  pungiglione: M("Pungiglione Letale", "poison", 100, 85, 8, "sting", { lv: 5, effect: { poison: 0.4 } }),
  palude: M("Palude Venefica", "poison", 100, 85, 8, "cloud", { lv: 5, effect: { poison: 0.4 } }),
  morsoviverna: M("Morso della Viverna", "poison", 120, 85, 5, "bite", { lv: 6, effect: { poison: 0.5 } }),
  miasma: M("Miasma", "poison", 120, 80, 5, "burst", { lv: 6, effect: { poison: 0.5 } }),
  // ── necrotico ──
  luminotetro: M("Lumino Tetro", "necrotic", 40, 100, 25, "orb", { lv: 1, effect: { foe: { atk: -1 }, chance: 0.1 } }),
  graffiospettrale: M("Graffio Spettrale", "necrotic", 45, 100, 25, "claw", { lv: 1 }),
  toccotetro: M("Tocco Tetro", "necrotic", 50, 100, 20, "drain", { lv: 2, effect: { drain: 0.5 } }),
  maledizione: M("Maledizione", "necrotic", 0, 90, 10, "curse", { lv: 2, effect: { foe: { atk: -1, def: -1 } } }),
  colpossa: M("Colpo d'Ossa", "necrotic", 55, 100, 20, "stomp", { lv: 2 }),
  armaturaossa: M("Armatura d'Ossa", "necrotic", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 2 } } }),
  morso: M("Morso Oscuro", "necrotic", 70, 95, 15, "bite", { lv: 3, effect: { foe: { def: -1 }, chance: 0.3 } }),
  raggiosinistro: M("Raggio Sinistro", "necrotic", 65, 95, 15, "beam", { lv: 3 }),
  frustaombra: M("Frusta d'Ombra", "necrotic", 85, 90, 10, "whip", { lv: 4, effect: { foe: { def: -1 }, chance: 0.2 } }),
  mietitura: M("Mietitura", "necrotic", 90, 85, 5, "burst", { lv: 4 }),
  falcespettrale: M("Falce Spettrale", "necrotic", 100, 85, 8, "claw", { lv: 5 }),
  prosciugare: M("Prosciugare Vita", "necrotic", 95, 90, 8, "drain", { lv: 5, effect: { drain: 0.5 } }),
  dannati: M("Carica dei Dannati", "necrotic", 120, 85, 5, "dash", { lv: 6, effect: { recoil: 0.25 } }),
  ditomorte: M("Dito della Morte", "necrotic", 120, 80, 5, "curse", { lv: 6 }),
  // ── radioso ──
  luccichio: M("Luccichio", "radiant", 45, 100, 25, "orb", { lv: 1, effect: { foe: { atk: -1 }, chance: 0.2 } }),
  artigliluce: M("Artiglio di Luce", "radiant", 40, 100, 25, "claw", { lv: 1 }),
  aureola: M("Aureola", "radiant", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 1, atk: 1 } } }),
  scudofede: M("Scudo della Fede", "radiant", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 2 } } }),
  cornosplendente: M("Corno Splendente", "radiant", 55, 100, 20, "dash", { lv: 2 }),
  benedizione: M("Benedizione", "radiant", 0, 100, 5, "heal", { lv: 3, effect: { heal: 0.5 } }),
  frustaluce: M("Frusta di Luce", "radiant", 70, 95, 15, "whip", { lv: 3, effect: { foe: { atk: -1 }, chance: 0.2 } }),
  raggio: M("Raggio Sacro", "radiant", 80, 90, 10, "beam", { lv: 3 }),
  morsosacro: M("Morso Sacro", "radiant", 85, 90, 10, "bite", { lv: 4 }),
  lucesplosione: M("Esplosione di Luce", "radiant", 90, 85, 5, "burst", { lv: 4, effect: { stun: 0.1 } }),
  caricaceleste: M("Carica Celeste", "radiant", 100, 85, 8, "dash", { lv: 5 }),
  colonnaluce: M("Colonna di Luce", "radiant", 100, 85, 8, "bolt", { lv: 5 }),
  giudizio: M("Giudizio", "radiant", 120, 85, 5, "stomp", { lv: 6, effect: { stun: 0.2 } }),
  raggiosolare: M("Raggio Solare", "radiant", 120, 80, 5, "beam", { lv: 6 }),
  // ── psichico ──
  ondamentale: M("Onda Mentale", "psychic", 45, 100, 25, "wave", { lv: 1 }),
  zampapsichica: M("Zampata Psichica", "psychic", 40, 100, 25, "stomp", { lv: 1 }),
  concentrazione: M("Concentrazione", "psychic", 0, 100, 10, "aura", { lv: 2, effect: { self: { atk: 2 } } }),
  scudomentale: M("Scudo Mentale", "psychic", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 2 } } }),
  morsoillusorio: M("Morso Illusorio", "psychic", 55, 100, 20, "bite", { lv: 2 }),
  ipnosi: M("Ipnosi", "psychic", 0, 75, 10, "curse", { lv: 3, effect: { sleep: 1 } }),
  urlopsichico: M("Urlo Psichico", "psychic", 65, 95, 15, "wave", { lv: 3, effect: { foe: { atk: -1 }, chance: 0.3 } }),
  artiglifantasma: M("Artigli Fantasma", "psychic", 70, 95, 15, "claw", { lv: 3 }),
  telecinesi: M("Carica Telecinetica", "psychic", 85, 90, 10, "dash", { lv: 4 }),
  sguardo: M("Sguardo Malefico", "psychic", 85, 85, 5, "beam", { lv: 4, effect: { stun: 0.2 } }),
  frustamentale: M("Frusta Mentale", "psychic", 100, 85, 8, "whip", { lv: 5, effect: { stun: 0.2 } }),
  sferapsionica: M("Sfera Psionica", "psychic", 100, 85, 8, "orb", { lv: 5, effect: { foe: { atk: -1 }, chance: 0.3 } }),
  schiantotele: M("Schianto Telecinetico", "psychic", 120, 85, 5, "stomp", { lv: 6 }),
  tempestapsi: M("Tempesta Psichica", "psychic", 120, 80, 5, "curse", { lv: 6, effect: { stun: 0.2 } }),
  // mosse speciali delle evoluzioni (petEvo.js): niente grado, non si imparano
  ...Object.fromEntries(Object.entries(EVO_MOVES).map(([k, [name, type, power, acc, fx, extra]]) => [k, M(name, type, power, acc, extra.uses || 1, fx, { ...extra, sig: true })]))
};
var MOVE_GRADES = [1, 4, 8, 14, 22, 32];
var USES_BY_GRADE = [null, null, 6, 4, 3, 2, 1];
function usesOf(moveId) {
  const m = PET_DEX_MOVES[moveId];
  if (!m) return null;
  if (m.uses !== void 0) return m.uses;
  if (m.effect?.heal) return 2;
  if (!m.lv) return 3;
  if (m.lv === 1 && m.power) return null;
  return USES_BY_GRADE[m.lv] ?? 1;
}
var profOf = (level) => 2 + Math.floor((level || 1) / 12);
var accMod = (acc) => Math.round(((acc ?? 90) - 90) / 5);
function baseOf(speciesKey, evo = 0) {
  const b = PET_DEX[speciesKey]?.base || { hp: 40, atk: 10, def: 10, spd: 10 };
  const x = evo ? EVOLUTIONS[speciesKey] : null;
  if (!x) return b;
  const p = x.plus || {};
  return { hp: b.hp, atk: b.atk * EVO_MULT.atk + (p.atk || 0), def: b.def * EVO_MULT.def + (p.def || 0), spd: b.spd * EVO_MULT.spd + (p.spd || 0) };
}
function dndOf(speciesKey, level = 1, evo = 0) {
  const b = baseOf(speciesKey, evo);
  const prof = profOf(level);
  const atkMod = Math.round((b.atk - 9) / 2);
  const defMod = Math.round((b.def - 10) / 2);
  const evoAc = evo && EVOLUTIONS[speciesKey] ? 1 + (EVOLUTIONS[speciesKey].plus?.ac || 0) : 0;
  const ac = (PET_DEX[speciesKey]?.ac ?? 10 + Math.round((b.def - 8) / 2) + (b.spd >= 14 ? 1 : 0)) + Math.floor((level || 1) / 12) + evoAc;
  return { prof, atkMod, defMod, ac, toHit: prof + atkMod, save: Math.floor(prof / 2) + defMod, dcBase: 12 + prof + atkMod };
}
var MAX_MOVES = 4;
var PHYS_FX = /* @__PURE__ */ new Set(["stomp", "bite", "claw", "whip", "sting", "dash"]);
var moveCat = (m) => PHYS_FX.has(PET_DEX_MOVES[m]?.fx) ? "atk" : "spell";
var gradeOfLevel = (level) => MOVE_GRADES.filter((l) => (level || 1) >= l).length;
function learnPool(speciesKey, grade) {
  const sp = PET_DEX[speciesKey];
  if (!sp) return [];
  return Object.keys(PET_DEX_MOVES).filter((m) => {
    const mv = PET_DEX_MOVES[m];
    if (mv.lv !== grade || sp.moves.includes(m)) return false;
    if (mv.type === sp.type) return true;
    return mv.type === "neutral" && moveCat(m) === "atk";
  });
}
var S = (key, name, icon, type, rarity, desc, look, base, moves, res = null) => ({ key, name, icon, type, rarity, desc, look, base, moves, res });
var R = (resist = [], immune = [], vuln = []) => ({ resist, immune, vuln });
var PET_DEX = {
  // ── ex iniziali, ora più rari (2026-10-31) ──
  brace: S(
    "brace",
    "Brace",
    "\u{1F432}",
    "fire",
    "epic",
    "Cucciolo di drago rosso: sputa scintille quando \xE8 contento.",
    "a baby red dragon wyrmling, tiny chubby body, small stubby wings, big shiny eyes, little horns, smoke puffing from its nostrils",
    { hp: 46, atk: 13, def: 10, spd: 12 },
    ["zampata", "scintilla", "sbuffo", "vampata"],
    R([], ["fire"])
  ),
  tartadrago: S(
    "tartadrago",
    "Tartadrago",
    "\u{1F422}",
    "water",
    "epic",
    "Tartaruga-drago appena uscita dal guscio: lenta, testarda, inaffondabile.",
    "a baby dragon turtle, round spiky blue-green shell, small dragon head with tiny fins, sleepy friendly face",
    { hp: 54, atk: 11, def: 14, spd: 7 },
    ["morsetto", "spruzzo", "guscio", "ondata"],
    R(["fire"])
  ),
  gufurso: S(
    "gufurso",
    "Gufurso",
    "\u{1F989}",
    "earth",
    "rare",
    "Cucciolo di gufo-orso: abbracci fortissimi, piume ovunque.",
    "a baby owlbear cub, fluffy brown fur and feathers, owl face with big round eyes and a small beak, stubby bear paws",
    { hp: 52, atk: 14, def: 11, spd: 8 },
    ["zampata", "rametto", "ruggitino", "terremoto"]
  ),
  pseudodrago: S(
    "pseudodrago",
    "Pseudodrago",
    "\u{1F409}",
    "poison",
    "rare",
    "Draghetto da spalla grande come un gatto: la coda punge e addormenta.",
    "a tiny pseudodragon, cat-sized slender reddish dragon with butterfly-like translucent wings, long curled tail with a stinger dripping a drop of purple venom, mischievous smile",
    { hp: 42, atk: 12, def: 9, spd: 15 },
    ["scattino", "veleno", "nubetossica", "fiotto"]
  ),
  gattombra: S(
    "gattombra",
    "Gattombra",
    "\u{1F408}\u200D\u2B1B",
    "psychic",
    "rare",
    "Gattino distorcente: lo vedi sempre un passo pi\xF9 in l\xE0 di dov'\xE8.",
    "a displacer beast kitten, dark blue-black panther kitten with six little legs and two soft tentacles on its back ending in pads, glowing violet eyes, shimmering illusory afterimage",
    { hp: 44, atk: 13, def: 10, spd: 13 },
    ["graffio", "ondamentale", "ipnosi", "sguardo"]
  ),
  // ── COMUNI ──
  mefitino: S(
    "mefitino",
    "Mefitino",
    "\u{1F608}",
    "fire",
    "starter",
    "Mefite di magma che gocciola lava e ride per niente.",
    "a tiny magma mephit, small impish creature made of cooling lava with glowing cracks, little bat wings, cheeky grin",
    { hp: 40, atk: 12, def: 9, spd: 12 },
    ["scintilla", "graffio", "fuocherello", "sbuffo"],
    R([], ["fire", "poison"])
  ),
  cubetto: S(
    "cubetto",
    "Cubetto",
    "\u{1F9CA}",
    "acid",
    "starter",
    "Cubo gelatinoso grande come un dado: dentro ha sempre una moneta.",
    "a small gelatinous cube, translucent wobbly lime-green acidic jelly cube with a tiny coin and a little bone floating inside, two cute dot eyes, tiny acid bubbles",
    { hp: 58, atk: 10, def: 12, spd: 5 },
    ["sputoacido", "ingoiare", "guscio", "bagnoacido"]
  ),
  funghetto: S(
    "funghetto",
    "Funghetto",
    "\u{1F344}",
    "earth",
    "starter",
    "Miconide bambino: comunica a sbuffi di spore profumate.",
    "a baby myconid, small walking mushroom person with a spotted purple cap, stubby legs and arms, sleepy eyes, puffs of spores",
    { hp: 46, atk: 10, def: 11, spd: 7 },
    ["rametto", "spore", "linfa", "pisolino"]
  ),
  saltello: S(
    "saltello",
    "Saltello",
    "\u{1F415}",
    "radiant",
    "starter",
    "Cucciolo di cane intermittente: sparisce e ricompare per giocare.",
    "a blink dog puppy, golden fey puppy with big ears, sparkles of light around it as it teleports, happy tongue out",
    { hp: 42, atk: 11, def: 9, spd: 15 },
    ["scattino", "luccichio", "aureola", "lucesplosione"]
  ),
  diavoletto: S(
    "diavoletto",
    "Diavoletto",
    "\u{1F47F}",
    "necrotic",
    "common",
    "Imp dispettoso che firma contratti col pennarello.",
    "a tiny imp, small red devil with little horns, bat wings, a pointed tail, holding a tiny scroll, wisps of dark smoke, smug smile",
    { hp: 40, atk: 12, def: 9, spd: 13 },
    ["graffio", "toccotetro", "maledizione", "raggiosinistro"],
    R(["cold"], ["fire", "poison"])
  ),
  scrignetto: S(
    "scrignetto",
    "Scrignetto",
    "\u{1F9F0}",
    "acid",
    "common",
    "Mimic cucciolo: finge di essere un portagioie. Morde le dita.",
    "a baby mimic shaped like a small wooden treasure chest, open lid showing tiny teeth and a long pink sticky tongue dripping green goo, two little eyes on the lid",
    { hp: 52, atk: 12, def: 13, spd: 6 },
    ["morsetto", "sputoacido", "melma", "spruzzoacido"],
    R([], ["acid"])
  ),
  yetino: S(
    "yetino",
    "Yetino",
    "\u{1F43B}\u200D\u2744\uFE0F",
    "cold",
    "starter",
    "Cucciolo di yeti: si rotola nella neve e ne esce pi\xF9 grosso.",
    "a baby yeti, round fluffy white fur ball with small blue face, tiny horns, big feet, snowflakes around",
    { hp: 52, atk: 12, def: 12, spd: 7 },
    ["zampata", "brina", "mantobrina", "grandine"],
    R([], ["cold"])
  ),
  brinello: S(
    "brinello",
    "Brinello",
    "\u2744\uFE0F",
    "cold",
    "common",
    "Mefite del ghiaccio: starnutisce fiocchi di neve.",
    "a tiny ice mephit, small impish creature made of icy blue crystal, frosty wings, icicle horns, sneezing a snowflake",
    { hp: 40, atk: 12, def: 9, spd: 13 },
    ["brina", "scattino", "soffiogelo", "morsogelo"],
    R([], ["cold", "poison"], ["bludgeoning", "fire"])
  ),
  granchietto: S(
    "granchietto",
    "Granchietto",
    "\u{1F980}",
    "water",
    "starter",
    "Granchio gigante, ma non ancora. Pizzica tutto quello che luccica.",
    "a baby giant crab, round shiny red-blue shell, oversized claws, eyes on stalks, bubbles around it",
    { hp: 48, atk: 12, def: 14, spd: 6 },
    ["graffio", "bolla", "guscio", "ondata"]
  ),
  ragnetto: S(
    "ragnetto",
    "Ragnetto",
    "\u{1F577}\uFE0F",
    "poison",
    "starter",
    "Ragno gigante neonato: otto occhi, otto zampe, otto volte coccolone.",
    "a baby giant spider, fuzzy round dark purple body, eight big shiny eyes, stubby legs, tiny fangs dripping green venom",
    { hp: 42, atk: 12, def: 10, spd: 13 },
    ["zannevelenose", "scattino", "melma", "nubetossica"]
  ),
  scheletrino: S(
    "scheletrino",
    "Scheletrino",
    "\u{1F9B4}",
    "necrotic",
    "starter",
    "Cucciolo di scheletro: porta l'osso, ma \xE8 il suo.",
    "a skeleton puppy, small undead dog made of white bones with a big round skull, ghostly green glow in the eye sockets, wagging bony tail",
    { hp: 44, atk: 12, def: 11, spd: 11 },
    ["morsetto", "toccotetro", "ruggitino", "morso"],
    R([], ["poison"], ["bludgeoning"])
  ),
  behirino: S(
    "behirino",
    "Behirino",
    "\u{1F40D}",
    "lightning",
    "starter",
    "Behir neonato: un serpentone con dodici zampette che sputa scintille.",
    "a baby behir, small long blue serpentine lizard with many tiny stubby legs, little curved horns, crackling small lightning sparks from its mouth, big friendly eyes",
    { hp: 44, atk: 12, def: 10, spd: 13 },
    ["morsetto", "scarica", "caricastatica", "scossa"],
    R([], ["lightning"])
  ),
  flumphino: S(
    "flumphino",
    "Flumphino",
    "\u{1FABC}",
    "psychic",
    "starter",
    "Flumph cucciolo: una medusa volante gentile che sente i pensieri. E si offende.",
    "a baby flumph, small floating pale jellyfish-like creature with a round disc body, little tendrils hanging below, two eyestalks on top, soft pink psychic glow, gentle smile",
    { hp: 46, atk: 11, def: 11, spd: 12 },
    ["ondamentale", "scattino", "concentrazione", "urlopsichico"],
    R([], [], ["psychic"])
  ),
  // ── RARI ──
  salamandrina: S(
    "salamandrina",
    "Salamandrina",
    "\u{1F98E}",
    "fire",
    "rare",
    "Salamandra di fuoco: la coda brucia come una candela.",
    "a baby fire salamander, small orange-red serpentine lizard with a flaming tail and fiery spines along its back, bright eyes",
    { hp: 46, atk: 15, def: 10, spd: 13 },
    ["scintilla", "morsofuoco", "sbuffo", "vampata"],
    R([], ["fire"], ["cold"])
  ),
  krakino: S(
    "krakino",
    "Krakino",
    "\u{1F419}",
    "water",
    "rare",
    "Kraken neonato: otto tentacoli, zero buone maniere.",
    "a baby kraken, small round squid-octopus with many curly tentacles, huge curious eyes, deep teal and purple colors",
    { hp: 56, atk: 13, def: 12, spd: 9 },
    ["spruzzo", "inchiostro", "bolla", "ondata"],
    R([], ["lightning"])
  ),
  ruggine: S(
    "ruggine",
    "Ruggine",
    "\u{1F41C}",
    "acid",
    "rare",
    "Mostro della ruggine piccolo: si mangia le forchette di nascosto.",
    "a baby rust monster, insect-like creature with a rusty orange armored body, two long feathery antennae, wagging tail like a puppy, flakes of rust",
    { hp: 50, atk: 14, def: 14, spd: 9 },
    ["morsetto", "sputoacido", "spruzzoacido", "bagnoacido"]
  ),
  turbino: S(
    "turbino",
    "Turbino",
    "\u{1F32A}\uFE0F",
    "lightning",
    "rare",
    "Elementale della tempesta in miniatura: un mulinello che fa scintille.",
    "a tiny storm elemental, a small swirling whirlwind of pale blue air crackling with little lightning sparks, two cute eyes",
    { hp: 42, atk: 14, def: 9, spd: 17 },
    ["saetta", "scarica", "caricastatica", "fulmine"],
    R(["lightning"], ["poison"])
  ),
  occhietto: S(
    "occhietto",
    "Occhietto",
    "\u{1F441}\uFE0F",
    "psychic",
    "rare",
    "Spettatore cucciolo: un occhione, quattro occhietti, tanta curiosit\xE0.",
    "a baby beholder (spectator), round floating purple ball with one big central eye and four small eyestalks, small toothy smile, pink psychic glow",
    { hp: 48, atk: 15, def: 11, spd: 10 },
    ["ondamentale", "ipnosi", "urlopsichico", "sguardo"]
  ),
  cornina: S(
    "cornina",
    "Cornina",
    "\u{1F984}",
    "radiant",
    "rare",
    "Puledra di unicorno: dove galoppa crescono margherite.",
    "a baby unicorn foal, white fluffy coat, small golden spiral horn glowing, pastel rainbow mane, big gentle eyes, little hooves",
    { hp: 50, atk: 12, def: 12, spd: 12 },
    ["scattino", "luccichio", "benedizione", "raggio"]
  ),
  cerberino: S(
    "cerberino",
    "Cerberino",
    "\u{1F415}\u200D\u{1F9BA}",
    "fire",
    "rare",
    "Segugio infernale cucciolo: abbaia scintille, scava buche nella lava.",
    "a hell hound puppy, small black dog with glowing red eyes, fiery orange mane and flaming tail, tiny fangs, ember sparks",
    { hp: 50, atk: 16, def: 11, spd: 13 },
    ["morsofuoco", "ruggitino", "sbuffo", "vampata"],
    R([], ["fire"])
  ),
  lupogelo: S(
    "lupogelo",
    "Lupogelo",
    "\u{1F43A}",
    "cold",
    "rare",
    "Cucciolo di lupo invernale: ulula e la brina si posa sugli alberi.",
    "a winter wolf pup, fluffy snow-white wolf cub with icy blue eyes, frosty breath, little icicles on its fur",
    { hp: 50, atk: 15, def: 11, spd: 14 },
    ["morsogelo", "ruggitino", "soffiogelo", "grandine"],
    R([], ["cold"])
  ),
  gocciolo: S(
    "gocciolo",
    "Gocciolo",
    "\u{1F4A7}",
    "water",
    "rare",
    "Stranezza dell'acqua: una goccia viva che si offende se la bevi.",
    "a tiny water weird, a living droplet of clear blue water shaped like a little serpent with a big drop head, two shiny eyes, small splashes",
    { hp: 50, atk: 13, def: 12, spd: 12 },
    ["spruzzo", "bolla", "pioggia", "ondata"],
    R(["fire"], ["poison"])
  ),
  fuocofatuo: S(
    "fuocofatuo",
    "Fuocofatuo",
    "\u{1F506}",
    "lightning",
    "rare",
    "Fuoco fatuo: una lucina elettrica che ti porta dove non dovresti.",
    "a will-o'-wisp, small floating ball of pale blue-yellow electric light with a cute face, crackling little sparks, faint glowing trail",
    { hp: 40, atk: 15, def: 9, spd: 17 },
    ["scarica", "saetta", "scossa", "fulmine"],
    R(["acid", "cold", "fire", "necrotic"], ["lightning", "poison"])
  ),
  otyughino: S(
    "otyughino",
    "Otyughino",
    "\u{1F5D1}\uFE0F",
    "poison",
    "rare",
    "Otyugh piccolo: vive nei rifiuti e li trova deliziosi.",
    "a baby otyugh, round lumpy greenish-brown blob creature on three stubby legs, two little tentacles, one eye on a stalk, big toothy grin, stink lines",
    { hp: 58, atk: 14, def: 13, spd: 7 },
    ["zannevelenose", "ingoiare", "nubetossica", "fiotto"]
  ),
  fantasmino: S(
    "fantasmino",
    "Fantasmino",
    "\u{1F47B}",
    "necrotic",
    "rare",
    'Fantasma giovane: fa "buh" e poi si scusa.',
    "a little ghost, small translucent pale green spirit with a wispy tail, big sad-cute eyes, ghostly chains as a tiny bracelet",
    { hp: 44, atk: 15, def: 12, spd: 12 },
    ["toccotetro", "maledizione", "raggiosinistro", "mietitura"],
    R(["acid", "fire", "lightning"], ["cold", "necrotic", "poison"])
  ),
  // ── EPICI ──
  squalterra: S(
    "squalterra",
    "Squalterra",
    "\u{1F988}",
    "earth",
    "epic",
    "Bulette cucciolo: nuota nel terreno come uno squalo nel mare.",
    "a baby bulette (landshark), armored blue-grey shell plates, shark-like head with a small fin on its back, stubby clawed legs, bursting out of the ground",
    { hp: 58, atk: 17, def: 15, spd: 9 },
    ["morsetto", "frana", "testata", "terremoto"]
  ),
  piumaserpe: S(
    "piumaserpe",
    "Piumaserpe",
    "\u{1FAB6}",
    "radiant",
    "epic",
    "Couatl neonato: serpente piumato che sa sempre la verit\xE0.",
    "a baby couatl, small feathered serpent with rainbow feathered wings, golden scales, gentle wise eyes, soft holy glow",
    { hp: 50, atk: 15, def: 12, spd: 15 },
    ["luccichio", "benedizione", "raggio", "lucesplosione"],
    R(["radiant"])
  ),
  nevischio: S(
    "nevischio",
    "Nevischio",
    "\u{1F432}",
    "cold",
    "epic",
    "Cucciolo di drago bianco: morde i ghiaccioli come caramelle.",
    "a baby white dragon wyrmling, chubby icy-white dragon with pale blue frills, small frosty wings, big eyes, frost crystals on its horns",
    { hp: 54, atk: 16, def: 13, spd: 13 },
    ["brina", "morsogelo", "soffiogelo", "grandine"],
    R([], ["cold"])
  ),
  saettino: S(
    "saettino",
    "Saettino",
    "\u{1F409}",
    "lightning",
    "epic",
    "Cucciolo di drago blu: ogni starnuto \xE8 un piccolo temporale.",
    "a baby blue dragon wyrmling, chubby sapphire-blue dragon with a single small horn on its nose, tiny wings, little lightning sparks crackling around",
    { hp: 52, atk: 17, def: 12, spd: 14 },
    ["scarica", "morsetto", "scossa", "fulmine"],
    R([], ["lightning"])
  ),
  girino: S(
    "girino",
    "Girino",
    "\u{1F991}",
    "psychic",
    "epic",
    "Girino di mind flayer, ma buono. Dice. Legge i pensieri a voce alta.",
    "a cute baby mind flayer tadpole, small purple-pink wiggly tadpole with four tiny face tentacles, huge glossy white eyes, glowing psychic aura",
    { hp: 48, atk: 17, def: 11, spd: 14 },
    ["ondamentale", "concentrazione", "urlopsichico", "sguardo"]
  ),
  // ── LEGGENDARI ──
  tarrasquino: S(
    "tarrasquino",
    "Tarrasquino",
    "\u{1F996}",
    "earth",
    "legendary",
    "Il Tarrasque, ma in miniatura. Per ora. Mangia di tutto.",
    "a baby tarrasque, small chunky purple-green reptile kaiju with a spiked shell back, two forward horns, tiny claws, big hungry mouth, adorable",
    { hp: 64, atk: 18, def: 16, spd: 10 },
    ["morsetto", "ruggitino", "testata", "terremoto"],
    R(["bludgeoning", "piercing", "slashing"], ["fire", "poison"])
  ),
  lichetto: S(
    "lichetto",
    "Lichetto",
    "\u2620\uFE0F",
    "necrotic",
    "legendary",
    "Un lich piccolissimo col filatterio a forma di ciuccio.",
    "a tiny chibi lich, small skeletal sorcerer in oversized tattered purple robes and a little golden crown, glowing green eyes, holding a tiny phylactery like a pacifier, necrotic green wisps",
    { hp: 56, atk: 19, def: 14, spd: 13 },
    ["raggiosinistro", "maledizione", "toccotetro", "mietitura"],
    R(["cold", "lightning", "necrotic"], ["poison"])
  ),
  // ── NUOVI PET (2026-11-01): un comune per gli elementi che non ne avevano, tre rari ──
  magmino: S(
    "magmino",
    "Magmino",
    "\u{1F30B}",
    "fire",
    "common",
    "Mefite del magma: si scioglie quando \xE8 triste e si rapprende quando \xE8 contento.",
    "a tiny magma mephit, small impish creature made of glowing molten rock with dark cooling crust, little lava wings, dripping lava, mischievous grin",
    { hp: 42, atk: 12, def: 10, spd: 11 },
    ["scintilla", "graffio", "sbuffo", "morsofuoco"],
    R([], ["fire", "poison"], ["cold"])
  ),
  ranocchietto: S(
    "ranocchietto",
    "Ranocchietto",
    "\u{1F438}",
    "water",
    "common",
    "Cucciolo di bullywug: gracida canzoni d'amore alle pozzanghere.",
    "a baby bullywug, small chubby green frog-person with a big wide mouth, huge golden eyes, tiny loincloth, sitting on a lily pad, water droplets",
    { hp: 46, atk: 11, def: 10, spd: 12 },
    ["spruzzo", "zampata", "bolla", "codaspuma"]
  ),
  sassolino: S(
    "sassolino",
    "Sassolino",
    "\u{1FAA8}",
    "earth",
    "common",
    "Galeb duhr bambino: un sasso con le gambette che canta per far rotolare le pietre.",
    "a baby galeb duhr, small round boulder creature with stubby rock arms and legs, mossy top, two little glowing eyes and a tiny smile",
    { hp: 52, atk: 11, def: 14, spd: 5 },
    ["sassi", "zampapietra", "pellepietra", "frana"],
    R([], ["poison"])
  ),
  stirgetta: S(
    "stirgetta",
    "Stirgetta",
    "\u{1F99F}",
    "poison",
    "common",
    "Stirge cucciola: vuole solo un abbraccio. E un po' di sangue.",
    "a baby stirge, tiny round furry bat-mosquito creature with leathery wings, a long thin proboscis, big red eyes, four little clawed legs",
    { hp: 38, atk: 12, def: 8, spd: 16 },
    ["spruzzotossico", "scattino", "zannevelenose", "codapungente"]
  ),
  folletta: S(
    "folletta",
    "Folletta",
    "\u{1F9DA}",
    "psychic",
    "common",
    "Pixie dispettosa: ti fa vedere draghi dove ci sono solo galline.",
    "a tiny pixie, small fairy girl with iridescent butterfly wings, pointed ears, flower-petal dress, sparkling pink fairy dust trail, cheeky smile",
    { hp: 38, atk: 12, def: 9, spd: 15 },
    ["zampapsichica", "ondamentale", "scudomentale", "ipnosi"],
    R([], [], ["necrotic"])
  ),
  lanternino: S(
    "lanternino",
    "Lanternino",
    "\u{1F3EE}",
    "radiant",
    "common",
    "Arconte lanterna: una pallina di luce celeste che fa da lumino ai bambini.",
    "a lantern archon, small floating ball of warm golden holy light with a tiny cute face, soft halo glow, little light sparkles around",
    { hp: 40, atk: 12, def: 10, spd: 12 },
    ["luccichio", "artigliluce", "aureola", "cornosplendente"],
    R(["lightning"], ["necrotic"])
  ),
  scossino: S(
    "scossino",
    "Scossino",
    "\u{1F98E}",
    "lightning",
    "common",
    "Lucertola scossa: se l'accarezzi ti si drizzano i capelli.",
    "a baby shocker lizard, small pale blue lizard with a frilled crest, tiny sparks of electricity jumping between its spines, big bright eyes",
    { hp: 42, atk: 12, def: 9, spd: 14 },
    ["graffioelettrico", "scarica", "saetta", "morsovoltaico"],
    R([], ["lightning"])
  ),
  gargolino: S(
    "gargolino",
    "Gargolino",
    "\u{1F5FF}",
    "earth",
    "rare",
    "Gargoyle cucciolo: fa la statua quando lo guardi, ti fa le smorfie quando ti giri.",
    "a baby gargoyle, small grey stone winged imp with little horns, cracked stone skin, crouching like a statue, mischievous glowing eyes",
    { hp: 54, atk: 14, def: 16, spd: 8 },
    ["sassi", "graffio", "pellepietra", "cornoroccia"],
    R(["bludgeoning", "piercing", "slashing"], ["poison"])
  ),
  budino: S(
    "budino",
    "Budino",
    "\u{1F36E}",
    "acid",
    "rare",
    "Budino nero cucciolo: se lo tagli diventano due. Non tagliarlo.",
    "a baby black pudding, small glossy black blob of ooze with two big cute white eyes, bubbling acid surface, little drips",
    { hp: 62, atk: 14, def: 11, spd: 6 },
    ["sputoacido", "morsoacido", "melma", "bollacorrosiva"],
    R([], ["acid", "cold", "lightning"])
  ),
  pegasino: S(
    "pegasino",
    "Pegasino",
    "\u{1F434}",
    "radiant",
    "rare",
    "Puledro di pegaso: prova a volare, inciampa sulle nuvole, riprova.",
    "a pegasus foal, small white horse foal with fluffy feathered wings, golden hooves, big sparkling blue eyes, soft holy glow",
    { hp: 48, atk: 14, def: 11, spd: 16 },
    ["scattino", "artigliluce", "benedizione", "raggio"]
  ),
  // ── DRAGHI CUCCIOLI (2026-11-01): cromatici e metallici che mancavano + draghi gemma ──
  verdino: S(
    "verdino",
    "Verdino",
    "\u{1F432}",
    "poison",
    "epic",
    "Cucciolo di drago verde: dice bugie bellissime e sputa nebbia velenosa.",
    "a baby green dragon wyrmling, chubby emerald-green dragon with a tall leafy crest along its head and back, small wings, sly yellow eyes, puffs of green toxic mist",
    { hp: 52, atk: 16, def: 13, spd: 14 },
    ["veleno", "morsetto", "zannevelenose", "fiotto"],
    R([], ["poison"])
  ),
  nerolino: S(
    "nerolino",
    "Nerolino",
    "\u{1F432}",
    "acid",
    "epic",
    "Cucciolo di drago nero: ama le paludi e sbava acido sulle scarpe.",
    "a baby black dragon wyrmling, chubby glossy black dragon with forward-curving horns and a skull-like face, small wings, acid dripping from its jaws",
    { hp: 54, atk: 16, def: 13, spd: 13 },
    ["sputoacido", "morsetto", "spruzzoacido", "bagnoacido"],
    R([], ["acid"])
  ),
  dorino: S(
    "dorino",
    "Dorino",
    "\u{1F432}",
    "fire",
    "legendary",
    "Cucciolo di drago d'oro: saggio fin dall'uovo, ma ruba ancora i biscotti.",
    "a baby gold dragon wyrmling, chubby shining golden dragon with long whiskers and a frilled head, small elegant wings, wise warm eyes, gentle flames",
    { hp: 62, atk: 18, def: 15, spd: 13 },
    ["scintilla", "morsofuoco", "scudofuoco", "vampata"],
    R([], ["fire"])
  ),
  argentino: S(
    "argentino",
    "Argentino",
    "\u{1F432}",
    "cold",
    "epic",
    "Cucciolo di drago d'argento: gentile con tutti, si trasforma in bambino per giocare.",
    "a baby silver dragon wyrmling, chubby shiny silver dragon with a smooth frilled head, small wings, kind blue eyes, sparkling frost breath",
    { hp: 56, atk: 15, def: 14, spd: 13 },
    ["brina", "morsogelo", "mantobrina", "grandine"],
    R([], ["cold"])
  ),
  bronzino: S(
    "bronzino",
    "Bronzino",
    "\u{1F432}",
    "lightning",
    "epic",
    "Cucciolo di drago di bronzo: adora il mare e i fulmini sulle onde.",
    "a baby bronze dragon wyrmling, chubby bronze-scaled dragon with ridged horns and webbed feet, small wings, brave eyes, little sparks of lightning",
    { hp: 56, atk: 16, def: 14, spd: 12 },
    ["scarica", "morsovoltaico", "scossa", "fulmine"],
    R([], ["lightning"])
  ),
  ramino: S(
    "ramino",
    "Ramino",
    "\u{1F432}",
    "acid",
    "epic",
    "Cucciolo di drago di rame: racconta barzellette e si offende se non ridi.",
    "a baby copper dragon wyrmling, chubby shiny copper-red dragon with flat backswept horns, small wings, playful grin, tiny acid drops",
    { hp: 52, atk: 16, def: 12, spd: 15 },
    ["artiglicorrosivi", "scattino", "morsoacido", "bagnoacido"],
    R([], ["acid"])
  ),
  ottonino: S(
    "ottonino",
    "Ottonino",
    "\u{1F432}",
    "fire",
    "epic",
    "Cucciolo di drago d'ottone: chiacchierone; il suo soffio fa venire sonno.",
    "a baby brass dragon wyrmling, chubby brass-yellow dragon with a large shield-like head crest, small wings, chatty smiling face, warm desert haze",
    { hp: 54, atk: 15, def: 13, spd: 14 },
    ["scintilla", "morsetto", "sbuffo", "vampata"],
    R([], ["fire"])
  ),
  ametistino: S(
    "ametistino",
    "Ametistino",
    "\u{1F49C}",
    "psychic",
    "epic",
    "Cucciolo di drago d'ametista: pensa cos\xEC forte che le cose si spostano.",
    "a baby amethyst gem dragon wyrmling, chubby dragon with translucent purple crystal scales, faceted gem horns, small crystalline wings, soft violet psychic glow",
    { hp: 54, atk: 16, def: 13, spd: 13 },
    ["zampapsichica", "morsoillusorio", "urlopsichico", "telecinesi"],
    R(["psychic"])
  ),
  cristallino: S(
    "cristallino",
    "Cristallino",
    "\u{1F48E}",
    "radiant",
    "epic",
    "Cucciolo di drago di cristallo: brilla al buio e ride quando lo guardi.",
    "a baby crystal gem dragon wyrmling, chubby dragon with clear sparkling crystal scales refracting rainbow light, faceted horns, small glassy wings, bright glow",
    { hp: 52, atk: 15, def: 14, spd: 14 },
    ["luccichio", "morsetto", "scudofede", "lucesplosione"],
    R(["cold", "radiant"])
  ),
  smeraldino: S(
    "smeraldino",
    "Smeraldino",
    "\u{1F49A}",
    "psychic",
    "epic",
    "Cucciolo di drago di smeraldo: timido, si fa invisibile e ti guarda da vicino.",
    "a baby emerald gem dragon wyrmling, chubby dragon with deep green gemstone scales, faceted crest, small crystal wings, shy curious eyes, shimmering illusion haze",
    { hp: 52, atk: 15, def: 12, spd: 16 },
    ["ondamentale", "morsetto", "concentrazione", "sguardo"],
    R(["psychic"])
  ),
  zaffirino: S(
    "zaffirino",
    "Zaffirino",
    "\u{1F499}",
    "lightning",
    "epic",
    "Cucciolo di drago di zaffiro: il suo ruggito \xE8 un tuono in miniatura.",
    "a baby sapphire gem dragon wyrmling, chubby dragon with brilliant blue gemstone scales, faceted horns, small crystal wings, crackling thunder rings around it",
    { hp: 54, atk: 16, def: 13, spd: 13 },
    ["scarica", "morsovoltaico", "caricastatica", "fulmine"],
    R(["psychic", "lightning"])
  ),
  topazino: S(
    "topazino",
    "Topazino",
    "\u{1F9E1}",
    "necrotic",
    "epic",
    "Cucciolo di drago di topazio: brontolone, ama la solitudine e le spiagge deserte.",
    "a baby topaz gem dragon wyrmling, chubby dragon with golden-orange gemstone scales, faceted crest, small crystal wings, grumpy face, dark withering mist",
    { hp: 54, atk: 16, def: 13, spd: 13 },
    ["luminotetro", "morsetto", "toccotetro", "frustaombra"],
    R(["necrotic", "psychic"])
  )
};
var PET_DEX_ORDER = Object.keys(PET_DEX);
var STARTERS = PET_DEX_ORDER.filter((k) => PET_DEX[k].rarity === "starter").sort((a, b) => ELEMENTS.indexOf(PET_DEX[a].type) - ELEMENTS.indexOf(PET_DEX[b].type));
var ELEMENT_ODDS = { common: 70, rare: 25, epic: 4.5, legendary: 0.5 };
var PRISM_ODDS = { common: 40, rare: 45, epic: 13, legendary: 2 };
var EGG_NAME = {
  fire: "Uovo di Brace",
  cold: "Uovo di Brina",
  water: "Uovo delle Maree",
  lightning: "Uovo della Tempesta",
  earth: "Uovo di Pietra",
  acid: "Uovo Corrosivo",
  poison: "Uovo Velenoso",
  necrotic: "Uovo della Cripta",
  radiant: "Uovo Aureo",
  psychic: "Uovo Onirico"
};
var EGGS = {
  ...Object.fromEntries(ELEMENTS.map((el) => [el, {
    key: el,
    name: EGG_NAME[el],
    element: el,
    cost: 60,
    odds: ELEMENT_ODDS,
    desc: `Dentro c'\xE8 una creatura di ${TYPE_LABEL[el].toLowerCase()}.`
  }])),
  prismatic: {
    key: "prismatic",
    name: "Uovo Prismatico",
    element: null,
    cost: 200,
    odds: PRISM_ODDS,
    desc: "Cangiante: pu\xF2 contenere una creatura di qualunque elemento, e le rare escono pi\xF9 spesso."
  }
};
var EGG_ORDER = [...ELEMENTS, "prismatic"];
var eggPool = (eggKey, rarity) => PET_DEX_ORDER.filter((k) => {
  const egg = EGGS[eggKey];
  return (!egg?.element || PET_DEX[k].type === egg.element) && (!rarity || hatchRarityOf(k) === rarity);
});
function rollEgg(eggKey, rnd2 = Math.random) {
  const egg = EGGS[eggKey] || EGGS.prismatic;
  const total = HATCH_RARITIES.reduce((s, r) => s + egg.odds[r], 0);
  let x = rnd2() * total, rarity = "common";
  for (const r of HATCH_RARITIES) {
    if (x < egg.odds[r]) {
      rarity = r;
      break;
    }
    x -= egg.odds[r];
  }
  const idx = HATCH_RARITIES.indexOf(rarity);
  const order = [...HATCH_RARITIES.slice(0, idx + 1).reverse(), ...HATCH_RARITIES.slice(idx + 1)];
  for (const r of order) {
    const pool = eggPool(egg.key, r);
    if (pool.length) return { species: pool[Math.floor(rnd2() * pool.length)], rarity: r };
  }
  return { species: PET_DEX_ORDER[0], rarity: "common" };
}
var valueOf = (key) => RARITY[PET_DEX[key]?.rarity]?.value ?? 40;
var refundOf = (key) => Math.floor(valueOf(key) / 2);

// src/data/petBag.js
var SCROLL_SLOTS = 2;
var EVO_STONE = "pietra_evo";
var EVO_STONE_PRICE = 1500;
var TORTA_PRICE = 400;
var BASE = {
  caramella: {
    name: "Caramella Rara",
    icon: "\u{1F36C}",
    kind: "level",
    rarity: "legendary",
    price: null,
    desc: "Il pet sale subito di un livello. Rarissima: esce solo dalla Torre."
  },
  pietra: {
    name: "Pietra dell'Esperienza",
    icon: "\u{1F48E}",
    kind: "xp",
    rarity: "rare",
    price: 70,
    desc: "D\xE0 al pet PE pari a met\xE0 del suo livello attuale (minimo 60), dentro il tetto di PE del giorno."
  },
  torta: {
    name: "Torta della Crescita",
    icon: "\u{1F382}",
    kind: "level",
    rarity: "epic",
    price: TORTA_PRICE,
    desc: "Il pet sale subito di un livello, anche se oggi ha gi\xE0 preso tutti i suoi PE. Costa cara."
  },
  pietra_evo: {
    name: "Pietra dell'Evoluzione",
    icon: "\u{1F31F}",
    kind: "evo",
    rarity: "legendary",
    price: EVO_STONE_PRICE,
    desc: "Fa evolvere subito qualunque pet che ha un'evoluzione, a qualsiasi livello. Rarissima e carissima."
  },
  amuleto_scudo: {
    name: "Amuleto dello Scudo",
    icon: "\u{1F6E1}\uFE0F",
    kind: "charm",
    rarity: "common",
    price: 30,
    fights: 10,
    fx: { ac: 2 },
    desc: "+2 alla Classe Armatura."
  },
  zanna: {
    name: "Zanna Affilata",
    icon: "\u{1F9B7}",
    kind: "charm",
    rarity: "common",
    price: 30,
    fights: 10,
    fx: { hit: 2 },
    desc: "+2 ai tiri per colpire e alla CD delle sue mosse."
  },
  ghianda: {
    name: "Ghianda Robusta",
    icon: "\u{1F330}",
    kind: "charm",
    rarity: "common",
    price: 30,
    fights: 10,
    fx: { hp: 0.15 },
    desc: "+15% di Punti Ferita massimi."
  },
  piuma: {
    name: "Piuma del Vento",
    icon: "\u{1FAB6}",
    kind: "charm",
    rarity: "common",
    price: 25,
    fights: 10,
    fx: { spd: 1 },
    desc: "Entra in campo con la Velocit\xE0 gi\xE0 aumentata."
  },
  occhio: {
    name: "Occhio di Gufo",
    icon: "\u{1F989}",
    kind: "charm",
    rarity: "common",
    price: 25,
    fights: 10,
    fx: { save: 3 },
    desc: "+3 ai tiri salvezza contro veleni, sonni e maledizioni."
  },
  bacca: {
    name: "Bacca Curativa",
    icon: "\u{1FAD0}",
    kind: "charm",
    rarity: "common",
    price: 20,
    fights: 6,
    fx: { berry: 0.35 },
    desc: "Sotto met\xE0 dei PF la mangia e recupera il 35% (una volta per lotta)."
  },
  quadrifoglio: {
    name: "Quadrifoglio",
    icon: "\u{1F340}",
    kind: "charm",
    rarity: "rare",
    price: 45,
    fights: 10,
    fx: { crit: 19 },
    desc: "Critico anche col 19 naturale."
  },
  pozione: {
    name: "Pozione",
    icon: "\u{1F9EA}",
    kind: "battle",
    rarity: "common",
    price: 15,
    use: { heal: 0.4 },
    desc: "In lotta: cura il 40% dei PF del pet scelto (consuma il turno)."
  },
  antidoto: {
    name: "Antidoto",
    icon: "\u{1F33F}",
    kind: "battle",
    rarity: "common",
    price: 10,
    use: { cure: true },
    desc: "In lotta: toglie veleno, scottatura e intontimento al pet scelto."
  },
  elisir: {
    name: "Elisir",
    icon: "\u2697\uFE0F",
    kind: "battle",
    rarity: "rare",
    price: 35,
    use: { uses: 2 },
    desc: "In lotta: rid\xE0 fino a 2 usi a ogni mossa che non \xE8 infinita."
  },
  fenice: {
    name: "Piuma della Fenice",
    icon: "\u{1FABD}",
    kind: "battle",
    rarity: "epic",
    price: 80,
    use: { revive: 0.5 },
    desc: "In lotta: rianima un pet a terra con met\xE0 dei PF."
  },
  corona: {
    name: "Coroncina del Campione",
    icon: "\u{1F451}",
    kind: "charm",
    rarity: "epic",
    price: 120,
    fights: 15,
    fx: { ac: 1, hit: 1, hp: 0.1 },
    desc: "+1 CA, +1 per colpire e +10% PF."
  }
};
var TALISMANS = Object.fromEntries(ELEMENTS.map((el) => [`talismano_${el}`, {
  name: `Talismano ${TYPE_LABEL[el] === "Fuoco" ? "del Fuoco" : `di ${TYPE_LABEL[el]}`}`,
  icon: TYPE_ICON[el],
  kind: "charm",
  rarity: "common",
  price: 30,
  fights: 10,
  fx: { resist: el },
  desc: `Resistenza ai danni da ${TYPE_LABEL[el].toLowerCase()} (met\xE0 danni).`
}]));
var SCROLL_PRICE = [0, 40, 60, 90, 130, 180, 240];
var SCROLLS = Object.fromEntries(Object.entries(PET_DEX_MOVES).filter(([, m]) => m.lv).map(([k, m]) => [`pergamena_${k}`, {
  name: `Pergamena: ${m.name}`,
  icon: "\u{1F4DC}",
  kind: "scroll",
  move: k,
  rarity: m.lv >= 5 ? "epic" : m.lv >= 3 ? "rare" : "common",
  price: SCROLL_PRICE[m.lv],
  desc: `Insegna ${m.name} (${TYPE_LABEL[m.type]}, grado ${m.lv}) a qualunque pet, al posto di una mossa che dimentica.`
}]));
var PET_BAG = { ...BASE, ...TALISMANS, ...SCROLLS };
var BAG_ORDER = Object.keys(PET_BAG);
var CHARMS = BAG_ORDER.filter((k) => PET_BAG[k].kind === "charm");
var SCROLL_IDS = BAG_ORDER.filter((k) => PET_BAG[k].kind === "scroll");
var usableInBattle = (id) => ["battle", "charm"].includes(PET_BAG[id]?.kind);
var charmFx = (pet) => pet?.charm && PET_BAG[pet.charm.id]?.fx || null;
function towerDrops(floor, rnd2 = Math.random) {
  const out = [];
  if (floor % 25 === 0 || rnd2() < 0.01) out.push("caramella");
  if (floor % 5 === 0) out.push(CHARMS[Math.floor(rnd2() * CHARMS.length)]);
  if (floor % 10 === 0) {
    const maxLv = Math.min(6, Math.ceil(floor / 10));
    const pool = SCROLL_IDS.filter((k) => PET_DEX_MOVES[PET_BAG[k].move].lv <= maxLv);
    out.push(pool[Math.floor(rnd2() * pool.length)]);
  }
  return out;
}

// src/data/petEngine.js
var rnd = Math.random;
function withSeed(seed, fn) {
  const prev = rnd;
  rnd = seeded(seed);
  try {
    return fn();
  } finally {
    rnd = prev;
  }
}
var d20 = () => 1 + Math.floor(rnd() * 20);
function diceAt(moveId, level) {
  const m = PET_DEX_MOVES[moveId];
  if (!m?.dice) return null;
  const [n, d] = m.dice.split("d").map(Number);
  return { n: Math.max(1, Math.round(n * (0.9375 + 0.0625 * (level || 1)))), d };
}
var INFINITE = -1;
var pick = (arr) => arr[Math.floor(rnd() * arr.length)];
var clamp = (v, a, b) => Math.max(a, Math.min(b, v));
var xpToNext = (level) => 40 + level * 25 + level * level;
var DAILY_XP_CAP = 250;
var romeDayKey = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
var xpTodayOf = (pet, now = Date.now()) => pet?.xpDay?.d === romeDayKey(now) ? pet.xpDay.n || 0 : 0;
var xpDayKey = romeDayKey;
function addXp(pet, amount) {
  let level = pet.level || 1, xp = (pet.xp || 0) + Math.max(0, amount), ups = 0;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    ups += 1;
  }
  if (level >= MAX_LEVEL) xp = 0;
  return { ...pet, level, xp, ups };
}
function statsAt(speciesKey, level, boost = 1, evo = 0) {
  const b = baseOf(speciesKey, evo);
  const L = clamp(level || 1, 1, MAX_LEVEL);
  const grow = (v, k) => Math.round(v * (1 + (L - 1) * k) * boost);
  return { hp: Math.round(grow(b.hp, 0.08) * 0.8), atk: grow(b.atk, 0.06), def: grow(b.def, 0.06), spd: grow(b.spd, 0.05) };
}
var movesAt = (speciesKey, level) => (PET_DEX[speciesKey]?.moves || []).filter((_, i) => (level || 1) >= MOVE_UNLOCK[i]);
function learnedMoves(pet) {
  const g = gradeOfLevel(pet?.level);
  return Object.entries(pet?.learned || {}).filter(([grade, m]) => Number(grade) <= g && learnPool(pet.species, Number(grade)).includes(m)).sort((a, b) => a[0] - b[0]).map(([, m]) => m);
}
var knownMoves = (pet) => {
  const forgot = pet?.forgotten || [];
  const tms = (pet?.tms || []).filter((m) => PET_DEX_MOVES[m]);
  return [.../* @__PURE__ */ new Set([...movesAt(pet.species, pet.level).filter((m) => !forgot.includes(m)), ...learnedMoves(pet), ...tms])];
};
function battleMoves(pet) {
  const known = knownMoves(pet);
  const chosen = (Array.isArray(pet?.moveset) ? pet.moveset : []).filter((m, i, a) => known.includes(m) && a.indexOf(m) === i);
  if (chosen.length) return chosen.slice(0, MAX_MOVES);
  if (!known.length) return ["zampata"];
  return known.slice(0, MAX_MOVES).length === known.length ? known : [...known.slice(0, MAX_MOVES - 1), known[known.length - 1]];
}
function enemyMoveset(species, level, r) {
  const learned = {};
  for (let g = 1; g <= gradeOfLevel(level); g++) {
    const pool = learnPool(species, g);
    if (pool.length) learned[g] = pool[Math.floor(r() * pool.length)];
  }
  const known = knownMoves({ species, level, learned });
  if (known.length <= MAX_MOVES) return known;
  const pow = (m) => PET_DEX_MOVES[m].power;
  const status = known.find((m) => !pow(m));
  const hits = known.filter((m) => pow(m)).sort((a, b) => pow(b) - pow(a));
  return status ? [...hits.slice(0, MAX_MOVES - 1), status] : hits.slice(0, MAX_MOVES);
}
var evoStage = (pet) => (pet?.evo || 0) >= 1 && EVOLUTIONS[pet?.species] ? 1 : 0;
var formName = (pet) => evoStage(pet) ? EVOLUTIONS[pet.species].name : PET_DEX[pet?.species]?.name || pet?.species;
var evoHpOf = (pet) => {
  if (!evoStage(pet)) return 0;
  if (Number.isFinite(pet.evoHp)) return pet.evoHp;
  const [n, d] = evoDiceOf(PET_DEX[pet.species]?.rarity);
  return Math.round(n * (d + 1) / 2);
};
function makeFighter(pet, boost = 1) {
  const evo = evoStage(pet);
  const ev = evo ? EVOLUTIONS[pet.species] : null;
  const sp = PET_DEX[pet.species];
  const st = statsAt(pet.species, pet.level, boost, evo);
  const d = dndOf(pet.species, pet.level, evo);
  const cf = charmFx(pet) || {};
  const hp = Math.round((st.hp + Math.round(evoHpOf(pet) * boost)) * (1 + (cf.hp || 0)));
  const skill = ev?.skill || {};
  const passive = skill.passive ? { id: skill.passive, v: skill.v ?? null, st: skill.st || null, el: skill.el || null } : null;
  const pp = Object.fromEntries(battleMoves(pet).map((m) => [m, usesOf(m) ?? INFINITE]));
  if (skill.move && PET_DEX_MOVES[skill.move]) pp[skill.move] = usesOf(skill.move) ?? 1;
  const critBase = passive?.id === "critico" ? passive.v : 20;
  return {
    id: pet.id,
    species: pet.species,
    name: pet.nick || formName(pet) || sp?.name,
    evo,
    passive,
    sig: skill.move || null,
    blur: passive?.id === "sfocatura",
    type: sp?.type || "neutral",
    level: pet.level || 1,
    maxHp: hp,
    hp,
    atk: st.atk,
    def: st.def,
    spd: st.spd,
    // D&D: CA, bonus per colpire, CD delle mosse di stato, tiro salvezza (+ amuleto)
    atkMod: d.atkMod,
    dmgBoost: boost,
    ac: d.ac + (cf.ac || 0),
    toHit: d.toHit + (cf.hit || 0),
    dcBase: d.dcBase + (cf.hit || 0),
    save: d.save + (cf.save || 0),
    critOn: Math.min(cf.crit || 20, critBase),
    critBase,
    resist: cf.resist || null,
    berry: cf.berry || 0,
    spd0: cf.spd || 0,
    charm: pet.charm?.id || null,
    charmLeft: pet.charm?.left || 0,
    stages: { atk: 0, def: 0, spd: cf.spd || 0, ac: 0 },
    status: null,
    // { kind: "burn"|"poison", turns }
    stunned: false,
    // salta la prossima azione: "daze" | "freeze" | "shock" (solo l'aspetto)
    sleep: 0,
    // azioni che salta ancora dormendo
    wake: 0,
    // appena sveglio: niente sonno per questi turni
    pp
  };
}
var hasP = (f, id) => f?.passive?.id === id;
function fxKey(f) {
  if (!f) return "";
  const out = [];
  Object.entries(f.stages || {}).forEach(([k, v]) => {
    if (v) out.push(`${k}:${v}`);
  });
  if (f.status) out.push(`${f.status.kind}:${f.status.turns}`);
  if (f.stunned) out.push(`stun:${STUN_CODE[f.stunned] || 1}`);
  if (f.sleep) out.push(`sleep:${f.sleep}`);
  if (f.wake) out.push(`wake:${f.wake}`);
  if (hasP(f, "sfocatura") && f.blur) out.push("blur:1");
  if (f.tenUsed) out.push("tenUsed:1");
  if (f.legUsed) out.push("legUsed:1");
  if (f.berryUsed) out.push("berryUsed:1");
  return out.join(",");
}
var STUN_CODE = { daze: 1, freeze: 2, shock: 3 };
var stunOf = (type) => type === "cold" ? "freeze" : type === "lightning" ? "shock" : "daze";
var STUN_TXT = {
  daze: (n) => `\u{1F4AB} ${n} vede le stelline: salta il prossimo turno!`,
  freeze: (n) => `\u{1F9CA} ${n} diventa un ghiacciolo: salta il prossimo turno!`,
  shock: (n) => `\u26A1 ${n} \xE8 tutto folgorato, coi peli dritti: salta il prossimo turno!`
};
var STUN_SKIP = {
  daze: (n) => `\u{1F4AB} ${n} gira su s\xE9 stesso, stordito\u2026 e il turno passa!`,
  freeze: (n) => `\u{1F9CA} ${n} \xE8 ancora un blocco di ghiaccio: non si muove!`,
  shock: (n) => `\u26A1 ${n} sfrigola tutto e non riesce a muoversi!`
};
var SLEEP_TURNS = 2;
var WAKE_GUARD = 2;
var statusKey = (f) => f.status?.kind || (f.sleep ? "sleep" : f.stunned ? f.stunned === true ? "daze" : f.stunned : null);
var stageMult = (s) => s >= 0 ? 1 + 0.25 * s : 1 / (1 + 0.25 * -s);
var eff = (f, stat) => f[stat] * stageMult(f.stages[stat] || 0);
function newBattle(playerPets, enemyPets, { enemyBoost = 1, aiLevel = 0, pvp = false, names = null } = {}) {
  return startEffects({
    pvp,
    names,
    sides: {
      p: { team: playerPets.map((p) => makeFighter(p)), active: 0 },
      e: { team: enemyPets.map((p) => makeFighter(p, enemyBoost)), active: 0 }
    },
    aiLevel,
    turn: 1,
    log: [],
    over: null,
    // "p" | "e" quando finisce
    needSwitch: null
    // "p" se il giocatore deve mandare un nuovo pet
  });
}
function startEffects(b) {
  intimidate(b, "p", null);
  intimidate(b, "e", null);
  return b;
}
var activeOf = (b, side) => b.sides[side].team[b.sides[side].active];
var other = (side) => side === "p" ? "e" : "p";
var alive = (f) => f && f.hp > 0;
var benchAlive = (b, side) => b.sides[side].team.map((f, i) => ({ f, i })).filter(({ f, i }) => alive(f) && i !== b.sides[side].active);
var acOf = (f) => f.ac + (f.stages?.ac || 0);
function resistOf(f, kind) {
  if (hasP(f, "assorbi") && f.passive.el === kind) return 0;
  const rm = resistMultiplier(f?.species, kind, f?.evo || 0);
  return f?.resist === kind && rm > 0 ? rm * 0.5 : rm;
}
var snapOf = (b) => Object.fromEntries(["p", "e"].map((side) => {
  const s = b.sides[side];
  return [side, { active: s.active, hp: s.team.map((f) => f.hp), status: s.team.map(statusKey), fx: s.team.map(fxKey) }];
}));
function emit(b, out, ev) {
  out.push({ ...ev, snap: snapOf(b) });
}
function previewDamage(att, def, moveId) {
  const m = PET_DEX_MOVES[moveId];
  if (!m || !m.power) return 0;
  const dd = diceAt(moveId, att.level);
  const avg = Math.max(1, dd.n * (dd.d + 1) / 2 + (att.atkMod || 0));
  return avg * damageMult(att, def, m);
}
function damageMult(att, def, m) {
  const tm = typeMultiplier(m.type, def.type) * resistOf(def, damageKindOf(m));
  const stab = m.type === att.type && m.type !== "neutral" ? hasP(att, "elemento") ? 1.5 : 1.25 : 1;
  const rage = hasP(att, "furia") && att.hp > 0 && att.hp <= att.maxHp / 3 ? 1 + att.passive.v : 1;
  return stageMult(att.stages.atk || 0) / stageMult(def.stages.def || 0) * tm * stab * rage * (att.dmgBoost || 1);
}
function hitChance(att, def, moveId) {
  const m = PET_DEX_MOVES[moveId];
  if (!m || !def) return 1;
  const e = m.effect || {};
  if (m.power > 0) {
    const need = acOf(def) - (att.toHit + accMod(m.acc));
    const p = clamp((21 - need) / 20, 0.05, 0.95);
    return att.status?.kind === "poison" || hasP(def, "sfocatura") && def.blur ? p * p : p;
  }
  if (e.foe || e.burn || e.poison || e.stun || e.sleep) return clamp((att.dcBase + accMod(m.acc) - def.save - 1) / 20, 0.05, 0.95);
  return 1;
}
var sign = (n) => n >= 0 ? `+ ${n}` : `\u2212 ${-n}`;
function rollText(r) {
  if (!r) return "";
  if (r.kind === "atk") {
    const dice = r.dis ? `${r.d} (svantaggio: ${r.d} e ${r.d2})` : `${r.d}`;
    return ` \u{1F3B2} ${dice} ${sign(r.mod)} = ${r.total} contro CA ${r.vs}${r.d === 20 ? " \xB7 20 naturale!" : ""}`;
  }
  return ` ${r.who} tira salvezza: \u{1F3B2} ${r.d} ${sign(r.mod)} = ${r.total} contro CD ${r.vs}`;
}
function berryCheck(b, side, out) {
  const f = activeOf(b, side);
  if (!f || !alive(f) || !f.berry || f.berryUsed || f.hp >= f.maxHp / 2) return;
  f.berryUsed = true;
  const h = Math.round(f.maxHp * f.berry);
  f.hp = Math.min(f.maxHp, f.hp + h);
  emit(b, out, { side, kind: "heal", amount: h, text: `${f.name} mangia la Bacca Curativa: +${h} PF!` });
}
function giveItemInBattle(b, side, itemId, idx, out) {
  const it = PET_BAG[itemId];
  const f = b.sides[side].team[idx];
  if (!it || !f) return;
  const who = b.names ? `${b.names[side]} d\xE0` : side === "p" ? "Dai" : "L'avversario d\xE0";
  const pre = `${who} ${it.icon} ${it.name} a ${f.name}`;
  const u = it.use || {};
  if (u.revive) {
    if (f.hp > 0) return;
    f.hp = Math.max(1, Math.round(f.maxHp * u.revive));
    f._fainted = false;
    f.status = null;
    f.stunned = false;
    f.sleep = 0;
    emit(b, out, { side, kind: "heal", amount: f.hp, item: itemId, text: `${pre}: torna in piedi con ${f.hp} PF!` });
    return;
  }
  if (f.hp <= 0) return;
  if (u.heal) {
    const h = Math.min(f.maxHp - f.hp, Math.round(f.maxHp * u.heal));
    f.hp += h;
    emit(b, out, { side, kind: "heal", amount: h, item: itemId, text: `${pre}: +${h} PF.` });
  } else if (u.cure) {
    const was = f.sleep;
    f.status = null;
    f.stunned = false;
    f.sleep = 0;
    if (was) f.wake = WAKE_GUARD;
    emit(b, out, { side, kind: "info", item: itemId, text: `${pre}: niente pi\xF9 veleno, scottature, stelline${was ? " e via il sonno: si sveglia di colpo" : ""}!` });
  } else if (u.uses) {
    Object.keys(f.pp).forEach((m) => {
      if (f.pp[m] !== INFINITE) f.pp[m] = Math.min(usesOf(m) || 0, f.pp[m] + u.uses);
    });
    emit(b, out, { side, kind: "info", item: itemId, text: `${pre}: +${u.uses} usi alle sue mosse.` });
  } else if (it.kind === "charm") {
    const old = f.charm && PET_BAG[f.charm];
    const of = old?.fx || {};
    if (old) {
      if (of.hp) {
        const sub = Math.round(f.maxHp / (1 + of.hp) * of.hp);
        f.maxHp -= sub;
        f.hp = Math.min(f.hp, f.maxHp);
      }
      f.ac -= of.ac || 0;
      f.toHit -= of.hit || 0;
      f.dcBase -= of.hit || 0;
      f.save -= of.save || 0;
      if (of.crit) f.critOn = f.critBase || 20;
      if (of.resist) f.resist = null;
      if (of.berry) f.berry = 0;
      if (of.spd) {
        f.stages.spd = Math.max(0, (f.stages.spd || 0) - of.spd);
        f.spd0 = 0;
      }
    }
    const cf = it.fx || {};
    if (cf.hp) {
      const add = Math.round(f.maxHp * cf.hp);
      f.maxHp += add;
      f.hp += add;
    }
    f.ac += cf.ac || 0;
    f.toHit += cf.hit || 0;
    f.dcBase += cf.hit || 0;
    f.save += cf.save || 0;
    if (cf.crit) f.critOn = Math.min(cf.crit, f.critBase || 20);
    if (cf.resist) f.resist = cf.resist;
    if (cf.berry) f.berry = cf.berry;
    if (cf.spd) {
      f.spd0 = cf.spd;
      f.stages.spd = Math.max(f.stages.spd || 0, cf.spd);
    }
    f.charm = itemId;
    f.charmLeft = it.fights || 0;
    emit(b, out, { side, kind: "info", item: itemId, text: `${pre}${old ? ` (al posto di ${old.icon} ${old.name})` : ""}: ${it.desc}` });
  }
}
function applyMove(b, side, moveId, out) {
  const att = activeOf(b, side), foe = activeOf(b, other(side));
  const m = PET_DEX_MOVES[moveId];
  if (!att || !alive(att) || !m) return;
  if (att.sleep > 0) {
    att.sleep -= 1;
    att.stunned = false;
    if (att.sleep > 0) {
      emit(b, out, { side, kind: "sleep", text: `\u{1F4A4} ${att.name} dorme della grossa\u2026 zzz (ancora ${att.sleep} turn${att.sleep === 1 ? "o" : "i"}).` });
    } else {
      att.wake = WAKE_GUARD;
      emit(b, out, { side, kind: "sleep", text: `\u{1F4A4} ${att.name} russa per l'ultima volta\u2026 e si sveglia con uno sbadiglio! \u2600\uFE0F` });
    }
    return;
  }
  if (att.stunned) {
    const k = att.stunned === true ? "daze" : att.stunned;
    att.stunned = false;
    emit(b, out, { side, kind: "stun", text: STUN_SKIP[k](att.name) });
    return;
  }
  if (att.pp[moveId] > 0) att.pp[moveId] -= 1;
  const e = m.effect || {};
  const targetsFoe = alive(foe) && (m.power > 0 || e.foe || e.burn || e.poison || e.stun || e.sleep);
  let roll = null;
  if (targetsFoe && m.power > 0) {
    const dis = att.status?.kind === "poison" || hasP(foe, "sfocatura") && foe.blur;
    const r1 = d20(), r2 = dis ? d20() : r1;
    const d = Math.min(r1, r2);
    const mod = att.toHit + accMod(m.acc);
    const vs = acOf(foe);
    const ok = d === 20 || d !== 1 && d + mod >= vs;
    roll = { kind: "atk", d, d2: dis ? Math.max(r1, r2) : null, dis, mod, total: d + mod, vs, ok, crit: ok && d >= (att.critOn || 20) };
  } else if (targetsFoe) {
    const d = d20();
    const vs = att.dcBase + accMod(m.acc);
    let saved = d === 20 || d !== 1 && d + foe.save >= vs;
    let legendary = false;
    if (!saved && hasP(foe, "leggendaria") && !foe.legUsed) {
      saved = true;
      legendary = true;
      foe.legUsed = true;
    }
    roll = { kind: "save", d, mod: foe.save, total: d + foe.save, vs, ok: !saved, who: foe.name, legendary };
  }
  emit(b, out, { side, kind: "move", move: moveId, mtype: m.type, fx: m.fx, roll, att: att.name, mname: m.name, text: `${att.name} usa ${m.name}!${rollText(roll)}` });
  if (roll && !roll.ok) {
    const txt = roll.legendary ? `\u2026\u{1F451} Resistenza Leggendaria: ${foe.name} supera il tiro lo stesso!` : roll.kind === "save" ? `\u2026${foe.name} resiste all'effetto!` : roll.d === 1 ? "\u20261 naturale: mancato!" : "\u2026ma manca il bersaglio!";
    emit(b, out, { side, kind: "miss", text: txt });
    return;
  }
  let dealt = 0, dmgTxt = "";
  const rm = resistOf(foe, damageKindOf(m));
  if (m.power > 0 && alive(foe) && rm === 0 && hasP(foe, "assorbi") && foe.passive.el === damageKindOf(m)) {
    const h = Math.min(foe.maxHp - foe.hp, Math.round(foe.maxHp * 0.25));
    foe.hp += h;
    emit(b, out, { side: other(side), kind: "heal", amount: h, text: h ? `\u{1F300} ${foe.name} assorbe il colpo: +${h} PF!` : `\u{1F300} ${foe.name} assorbe il colpo: nessun danno.` });
  } else if (m.power > 0 && alive(foe) && rm === 0) {
    emit(b, out, { side, kind: "immune", target: other(side), text: `${foe.name} \xE8 immune: nessun danno!` });
  } else if (m.power > 0 && alive(foe)) {
    const crit = !!roll?.crit;
    const dd = diceAt(moveId, att.level);
    const nd = dd.n * (crit ? 2 : 1);
    let sum = 0;
    for (let i = 0; i < nd; i++) sum += 1 + Math.floor(rnd() * dd.d);
    const base = Math.max(1, sum + (att.atkMod || 0));
    const mult = damageMult(att, foe, m);
    dealt = Math.max(1, Math.round(base * mult));
    const multTxt = Math.abs(mult - 1) > 0.01 ? ` \xD7${String(Math.round(mult * 100) / 100).replace(".", ",")}` : "";
    let armorTxt = "";
    if (hasP(foe, "corazza")) {
      const nd2 = Math.max(1, dealt - foe.passive.v);
      armorTxt = nd2 < dealt ? `, \u{1F6E1}\uFE0F corazza \u2212${dealt - nd2}` : "";
      dealt = nd2;
    }
    dmgTxt = ` (\u{1F3B2} ${nd}d${dd.d} ${sign(att.atkMod || 0)} = ${base}${multTxt}, ${DMG_LABEL[damageKindOf(m)].toLowerCase()}${armorTxt})`;
    let held = false;
    if (hasP(foe, "tenacia") && !foe.tenUsed && foe.hp > 1 && dealt >= foe.hp) {
      dealt = foe.hp - 1;
      foe.tenUsed = true;
      held = true;
    }
    foe.hp = Math.max(0, foe.hp - dealt);
    if (hasP(foe, "sfocatura")) foe.blur = false;
    const tm = typeMultiplier(m.type, foe.type);
    const note = [
      tm > 1 ? " \xC8 superefficace!" : tm < 1 ? " Non \xE8 molto efficace\u2026" : "",
      rm > 1 ? ` ${foe.name} \xE8 vulnerabile!` : rm < 1 ? ` ${foe.name} resiste.` : ""
    ].join("");
    emit(b, out, {
      side,
      kind: "hit",
      dmg: dealt,
      crit,
      tm: tm * rm,
      target: other(side),
      text: `${foe.name} perde ${dealt} PF${dmgTxt}.${crit ? " Colpo critico: dadi doppi!" : ""}${note}`
    });
    if (held) emit(b, out, { side: other(side), kind: "info", text: `\u{1FAA8} ${foe.name} stringe i denti e resta in piedi a 1 PF!` });
    if (hasP(foe, "spine") && alive(att)) {
      const r = Math.max(1, Math.round(dealt * foe.passive.v));
      att.hp = Math.max(0, att.hp - r);
      emit(b, out, { side: other(side), kind: "info", text: `\u{1F335} ${att.name} si fa male su ${foe.name} (\u2212${r} PF).` });
    }
    if (hasP(att, "succhiavita") && alive(att) && att.hp < att.maxHp) {
      const h = Math.min(att.maxHp - att.hp, Math.max(1, Math.round(dealt * att.passive.v)));
      att.hp += h;
      emit(b, out, { side, kind: "heal", amount: h, text: `\u{1FA78} ${att.name} si nutre del colpo: +${h} PF.` });
    }
    if (hasP(att, "tocco") && alive(foe) && rnd() < att.passive.v) touchEffect(b, side, att, foe, out);
    berryCheck(b, other(side), out);
  }
  const chance = (c) => rnd() < (c ?? 1);
  if (e.drain && dealt) {
    const h = Math.max(1, Math.round(dealt * e.drain));
    att.hp = Math.min(att.maxHp, att.hp + h);
    emit(b, out, { side, kind: "heal", amount: h, text: `${att.name} recupera ${h} PF.` });
  }
  if (e.recoil && dealt) {
    const r = Math.max(1, Math.round(dealt * e.recoil));
    att.hp = Math.max(0, att.hp - r);
    emit(b, out, { side, kind: "recoil", text: `${att.name} si fa male nel colpo (\u2212${r} PF).` });
    berryCheck(b, side, out);
  }
  if (e.heal) {
    const h = Math.round(att.maxHp * e.heal);
    const before = att.hp;
    att.hp = Math.min(att.maxHp, att.hp + h);
    emit(b, out, { side, kind: "heal", amount: att.hp - before, text: att.hp > before ? `${att.name} recupera ${att.hp - before} PF.` : `${att.name} \xE8 gi\xE0 in piena forma.` });
  }
  if (e.cure && (att.status || att.stunned)) {
    att.status = null;
    att.stunned = false;
    emit(b, out, { side, kind: "info", text: `\u2728 ${att.name} si scrolla di dosso veleni, scottature e stelline!` });
  }
  if (e.self) {
    Object.entries(e.self).forEach(([k, v]) => {
      att.stages[k] = clamp((att.stages[k] || 0) + v, k === "ac" ? -4 : -3, k === "ac" ? 4 : 3);
    });
    emit(b, out, { side, kind: "buff", text: `${att.name} si carica: ${statWords(e.self)}.` });
  }
  if (alive(foe)) {
    if (e.foe && chance(e.chance)) {
      Object.entries(e.foe).forEach(([k, v]) => {
        foe.stages[k] = clamp((foe.stages[k] || 0) + v, k === "ac" ? -4 : -3, k === "ac" ? 4 : 3);
      });
      emit(b, out, { side, kind: "debuff", target: other(side), text: `${foe.name}: ${statWords(e.foe)}.` });
    }
    if ((e.burn || e.poison) && !foe.status) {
      const kind = e.burn ? "burn" : "poison";
      const immuneTo = statusImmune(foe, kind);
      if (immuneTo) {
        if (!m.power) emit(b, out, { side, kind: "miss", text: `\u2026ma ${foe.name} \xE8 immune.` });
      } else if (chance(e.burn || e.poison)) {
        setStatus(b, side, foe, kind, out);
      } else if (!m.power) emit(b, out, { side, kind: "miss", text: "\u2026ma non ha effetto." });
    }
    if (e.sleep) {
      if (foe.sleep) {
        if (!m.power) emit(b, out, { side, kind: "miss", text: `\u2026ma ${foe.name} dorme gi\xE0 come un sasso.` });
      } else if (foe.wake) {
        if (!m.power) emit(b, out, { side, kind: "miss", text: `\u2026ma ${foe.name} si \xE8 appena svegliato ed \xE8 bello arzillo: niente sonno! \u2615` });
      } else if (hasP(foe, "purezza")) {
        if (!m.power) emit(b, out, { side, kind: "miss", text: `\u2026ma ${foe.name} \xE8 immune.` });
      } else if (chance(e.sleep)) {
        foe.sleep = SLEEP_TURNS;
        foe.stunned = false;
        emit(b, out, { side, kind: "status", st: "sleep", target: other(side), text: `\u{1F4A4} ${foe.name} sbadiglia, si acciambella e si addormenta! Dormir\xE0 per ${SLEEP_TURNS} turni.` });
      }
    }
    if (e.stun && !foe.stunned && !foe.sleep && !hasP(foe, "purezza") && chance(e.stun)) stunFoe(b, side, foe, stunOf(m.type), out);
  }
}
function setStatus(b, side, foe, kind, out) {
  foe.status = { kind, turns: kind === "burn" ? 3 : 4 };
  const text = kind === "burn" ? `\u{1F525} ${foe.name} si scotta! Ahi ahi, brucer\xE0 per 3 turni.` : `\u2620\uFE0F ${foe.name} \xE8 avvelenato: diventa verdino, tira con svantaggio e soffre per 4 turni.`;
  emit(b, out, { side, kind: "status", st: kind, target: other(side), text });
}
function stunFoe(b, side, foe, k, out) {
  foe.stunned = k;
  emit(b, out, { side, kind: "status", st: k, target: other(side), text: STUN_TXT[k](foe.name) });
}
function statusImmune(f, kind) {
  return hasP(f, "purezza") || resistMultiplier(f.species, kind === "burn" ? "fire" : "poison", f.evo || 0) === 0;
}
function touchEffect(b, side, att, foe, out) {
  const st = att.passive.st;
  if (st === "ac") {
    foe.stages.ac = clamp((foe.stages.ac || 0) - 1, -4, 4);
    emit(b, out, { side, kind: "debuff", target: other(side), text: `\u2623\uFE0F ${foe.name}: CA \u22121.` });
  } else if (st === "stun") {
    if (foe.stunned || foe.sleep || hasP(foe, "purezza")) return;
    stunFoe(b, side, foe, stunOf(att.type), out);
  } else if (!foe.status && !statusImmune(foe, st)) {
    setStatus(b, side, foe, st, out);
  }
}
var STAT_IT = { atk: "Attacco", def: "Difesa", spd: "Velocit\xE0" };
var statWords = (o) => Object.entries(o).map(([k, v]) => k === "ac" ? `CA ${v > 0 ? "+" : "\u2212"}${Math.abs(v)}` : `${STAT_IT[k]} ${v > 0 ? "\u2191".repeat(v) : "\u2193".repeat(-v)}`).join(", ");
function endOfTurn(b, out) {
  ["p", "e"].forEach((side) => {
    const f = activeOf(b, side);
    if (!alive(f)) return;
    if (hasP(f, "sfocatura")) f.blur = true;
    if (f.wake) f.wake -= 1;
    if (hasP(f, "rigenera") && f.hp < f.maxHp) {
      const h = Math.min(f.maxHp - f.hp, Math.max(1, Math.round(f.maxHp * f.passive.v)));
      f.hp += h;
      emit(b, out, { side, kind: "heal", amount: h, text: `\u{1F33F} ${f.name} si rigenera: +${h} PF.` });
    }
    if (!f.status) return;
    const frac = f.status.kind === "burn" ? 1 / 12 : 1 / 14;
    const d = Math.max(1, Math.round(f.maxHp * frac));
    f.hp = Math.max(0, f.hp - d);
    f.status.turns -= 1;
    const left = f.status.turns > 0 ? ` \xB7 ancora ${f.status.turns}` : "";
    emit(b, out, { side, kind: "dot", st: f.status.kind, text: f.status.kind === "burn" ? `\u{1F525} ${f.name} saltella sul posto: scotta! (\u2212${d} PF${left})` : `\u2620\uFE0F ${f.name} ha il mal di pancia per il veleno (\u2212${d} PF${left})` });
    if (f.status.turns <= 0) {
      const was = f.status.kind;
      f.status = null;
      emit(b, out, { side, kind: "info", text: was === "burn" ? `\u{1F9EF} Le fiamme si spengono: ${f.name} tira un sospiro di sollievo.` : `\u{1F33F} Il veleno passa: ${f.name} torna del suo colore.` });
    }
    berryCheck(b, side, out);
  });
}
function doSwitch(b, side, idx, out) {
  const s = b.sides[side];
  const prev = activeOf(b, side);
  if (prev) {
    prev.stages = { atk: 0, def: 0, spd: prev.spd0 || 0, ac: 0 };
    prev.stunned = false;
  }
  s.active = idx;
  const name = activeOf(b, side).name;
  emit(b, out, { side, kind: "switch", text: b.names ? `${b.names[side]} manda in campo ${name}!` : side === "p" ? `Vai, ${name}!` : `L'avversario manda in campo ${name}!` });
  intimidate(b, side, out);
}
function intimidate(b, side, out) {
  const f = activeOf(b, side), foe = activeOf(b, other(side));
  if (!hasP(f, "intimidire") || !alive(f) || !alive(foe)) return;
  foe.stages.atk = clamp((foe.stages.atk || 0) - 1, -3, 3);
  if (out) emit(b, out, { side, kind: "debuff", target: other(side), text: `\u{1F620} ${foe.name} si spaventa davanti a ${f.name}: Attacco \u2193.` });
}
function checkFaints(b, out) {
  ["e", "p"].forEach((side) => {
    const f = activeOf(b, side);
    if (f && f.hp <= 0 && !f._fainted) {
      f._fainted = true;
      emit(b, out, { side, kind: "faint", text: `${f.name} \xE8 esausto!` });
    }
  });
  const pLeft = b.sides.p.team.some(alive), eLeft = b.sides.e.team.some(alive);
  if (!eLeft) {
    b.over = "p";
    return;
  }
  if (!pLeft) {
    b.over = "e";
    return;
  }
  let need = "";
  if (!alive(activeOf(b, "p"))) need += "p";
  if (!alive(activeOf(b, "e"))) {
    if (b.pvp) need += "e";
    else doSwitch(b, "e", aiPickReplacement(b), out);
  }
  b.needSwitch = need || null;
}
function playTurn(battle, action, actionE = null) {
  const b = structuredClone(battle);
  const out = [];
  if (b.over) return { battle: b, events: out };
  b.log = b.log || [];
  if (b.needSwitch) {
    const pick2 = { p: action, e: actionE };
    const sides = b.needSwitch.split("");
    if (sides.some((sd) => pick2[sd]?.kind !== "switch")) return { battle: b, events: out };
    sides.forEach((sd) => doSwitch(b, sd, pick2[sd].index, out));
    b.needSwitch = null;
    b.log = [...b.log, ...out].slice(-80);
    return { battle: b, events: out };
  }
  const ai = b.pvp ? actionE : aiChoose(b);
  const acts = [{ side: "p", a: action, who: b.sides.p.active }, { side: "e", a: ai, who: b.sides.e.active }];
  const prio = ({ side, a }) => {
    if (a.kind === "switch" || a.kind === "item") return [10, 0];
    const f = activeOf(b, side);
    return [PET_DEX_MOVES[a.move]?.prio || 0, eff(f, "spd") + rnd() * 0.01];
  };
  acts.sort((x, y) => {
    const [px, sx] = prio(x), [py, sy] = prio(y);
    return py - px || sy - sx;
  });
  for (const { side, a, who } of acts) {
    if (b.over) break;
    const me = activeOf(b, side);
    if (a.kind === "switch") {
      doSwitch(b, side, a.index, out);
      continue;
    }
    if (a.kind === "item") {
      giveItemInBattle(b, side, a.item, a.index, out);
      continue;
    }
    if (b.sides[side].active !== who || !alive(me)) continue;
    applyMove(b, side, a.move, out);
    checkFaints(b, out);
    if (b.needSwitch) break;
  }
  if (!b.over) {
    endOfTurn(b, out);
    checkFaints(b, out);
  }
  b.turn += 1;
  b.log = [...b.log, ...out].slice(-80);
  return { battle: b, events: out };
}
function usableMoves(f) {
  const list = Object.keys(f.pp).filter((m) => f.pp[m] !== 0);
  return list.length ? list : ["zampata"];
}
function scoreMove(b, me, foe, m) {
  const mv = PET_DEX_MOVES[m];
  const e = mv.effect || {};
  const hc = hitChance(me, foe, m);
  let s = previewDamage(me, foe, m) * hc;
  const low = me.hp / me.maxHp;
  if (e.heal) s = low < 0.4 ? 40 : low < 0.65 ? 10 : 0;
  if (e.self) s = Math.max(s, (e.self.ac ? (me.stages.ac || 0) < 2 : me.stages.atk < 2) && low > 0.6 ? 12 : 2);
  if (e.foe && !mv.power) s = Math.max(s, foe.hp / foe.maxHp > 0.6 ? 9 * hc : 2);
  if ((e.burn || e.poison) && !mv.power) s = foe.status ? 0 : 16 * hc;
  if (e.stun && !mv.power) s = foe.stunned ? 0 : 15 * hc;
  if (e.sleep && !mv.power) s = foe.sleep || foe.wake || foe.stunned ? 0 : 24 * hc;
  if (mv.power && previewDamage(me, foe, m) * 0.85 >= foe.hp) s += 50;
  return s;
}
function bestMove(b, side) {
  const me = activeOf(b, side), foe = activeOf(b, other(side));
  const moves = usableMoves(me);
  return moves.map((m) => ({ m, s: scoreMove(b, me, foe, m) })).sort((x, y) => y.s - x.s)[0].m;
}
function matchup(attType, defType) {
  return typeMultiplier(attType, defType) / typeMultiplier(defType, attType);
}
function aiChoose(b) {
  const me = activeOf(b, "e"), foe = activeOf(b, "p");
  const lvl = b.aiLevel;
  if (lvl >= 3 && alive(me) && me.hp / me.maxHp > 0.25) {
    const bad = matchup(me.type, foe.type) < 1;
    if (bad && rnd() < 0.7) {
      const better = benchAlive(b, "e").find(({ f }) => matchup(f.type, foe.type) > 1);
      if (better) return { kind: "switch", index: better.i };
    }
  }
  if (lvl === 0) return { kind: "move", move: pick(usableMoves(me)) };
  if (lvl === 1 && rnd() < 0.45) return { kind: "move", move: pick(usableMoves(me)) };
  return { kind: "move", move: bestMove(b, "e") };
}
function aiPickReplacement(b) {
  const foe = activeOf(b, "p");
  const bench = benchAlive(b, "e");
  if (b.aiLevel >= 2 && foe) {
    bench.sort((x, y) => matchup(y.f.type, foe.type) - matchup(x.f.type, foe.type));
  }
  return bench[0]?.i ?? b.sides.e.active;
}
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = s * 1664525 + 1013904223 >>> 0;
    return s / 4294967296;
  };
}
var RARITY_FLOOR = { starter: 1, common: 1, rare: 8, epic: 18, legendary: 30 };
function rotation(week = "") {
  let h = 424242;
  for (const ch of String(week)) h = Math.imul(h, 31) + ch.charCodeAt(0) >>> 0;
  const r = seeded(h);
  const arr = [...PET_DEX_ORDER];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
var ROTATIONS = {};
var weekHash = (week) => {
  let h = 0;
  for (const ch of String(week || "")) h = Math.imul(h, 31) + ch.charCodeAt(0) >>> 0;
  return h;
};
function towerWeek(now = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date(now + 6e4)).map((x) => [x.type, x.value]));
  const back = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - back));
  return d.toISOString().slice(0, 10);
}
function towerFloor(floor, week = towerWeek()) {
  const n = Math.max(1, floor | 0);
  const size = n <= 3 ? 1 : n <= 9 ? 2 : 3;
  const ROTATION = ROTATIONS[week] ||= rotation(week);
  const wh = weekHash(week);
  const pool = ROTATION.filter((k) => RARITY_FLOOR[PET_DEX[k].rarity] <= n);
  const team = [];
  for (let i = 0; i < size; i++) {
    const k = pool[(n * 3 + i) % pool.length];
    const lead = Math.round(1 + (n - 1) * 0.55);
    const level = clamp(lead + (i === size - 1 && n % 5 === 0 ? 1 : 0) - (size - 1 - i), 1, MAX_LEVEL);
    const evo = EVOLUTIONS[k] && level >= evoLevelOf(PET_DEX[k].rarity) ? 1 : 0;
    team.push({ id: `tw${n}_${i}`, species: k, level, evo, moveset: enemyMoveset(k, level, seeded(n * 104729 + i * 31 + wh)) });
  }
  const aiLevel = n < 4 ? 0 : n < 10 ? 1 : n < 20 ? 2 : 3;
  const enemyBoost = n <= 3 ? 0.65 + (n - 1) * 0.05 : 1 + Math.floor((n - 1) / 10) * 0.06;
  const boss = n % 5 === 0;
  return { floor: n, team, aiLevel, enemyBoost, boss };
}
var towerXp = (floor) => 20 + floor * 5;
var LOSS_XP = 5;
var towerLossXp = () => LOSS_XP;
var towerPoints = (floor) => 4 + (floor % 5 === 0 ? 6 : 0);

// src/data/petOps.js
var newId = () => `pet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
var denOf = (data) => {
  const d = data?.petDen || {};
  return {
    starter: d.starter || null,
    pets: Array.isArray(d.pets) ? d.pets : [],
    team: Array.isArray(d.team) ? d.team : [],
    tower: { floor: 1, best: 0, wins: 0, ...d.tower || {} },
    eggs: Array.isArray(d.eggs) ? d.eggs : [],
    mascot: d.mascot || null,
    items: d.items && typeof d.items === "object" ? { ...d.items } : {},
    pvp: { wins: 0, losses: 0, day: "", rewarded: 0, claimed: [], ...d.pvp || {} },
    log: Array.isArray(d.log) ? d.log : []
  };
};
var LOG_MAX = 150;
var addLog = (den, entry) => {
  den.log = [{ t: (/* @__PURE__ */ new Date()).toISOString(), ...entry }, ...den.log].slice(0, LOG_MAX);
};
var countOf = (den, species) => den.pets.filter((p) => p.species === species).length;
var makePet = (species, from) => ({ id: newId(), species, level: 1, xp: 0, nick: "", from, at: (/* @__PURE__ */ new Date()).toISOString() });
var STARTER_GIFT = 120;
function chooseStarter(den, data, species) {
  if (den.starter || den.pets.length) throw new Error("Hai gi\xE0 scelto il tuo primo compagno.");
  if (!STARTERS.includes(species)) throw new Error("Non \xE8 un pet iniziale.");
  const p = makePet(species, "starter");
  den.starter = species;
  den.pets.push(p);
  den.team = [p.id];
  addLog(den, { k: "starter", species });
  const ledger = [{ source: "starter_gift", label: "Regalo di benvenuto del Rifugio", amount: STARTER_GIFT, ts: (/* @__PURE__ */ new Date()).toISOString() }, ...(data.petPointsLedger || []).slice(0, 29)];
  return { patch: { petPoints: (Number(data.petPoints) || 0) + STARTER_GIFT, petPointsLedger: ledger }, out: { gift: STARTER_GIFT } };
}
function givePet(den, data, species) {
  if (!PET_DEX[species]) throw new Error("Specie sconosciuta.");
  if (countOf(den, species) >= MAX_PER_SPECIES) throw new Error(`Hai gi\xE0 ${MAX_PER_SPECIES} ${PET_DEX[species].name}.`);
  const p = makePet(species, "master");
  den.pets.push(p);
  if (den.team.length < MAX_TEAM) den.team.push(p.id);
  addLog(den, { k: "give", species });
}
var makeEgg = (egg, from) => ({ id: newId().replace("pet_", "egg_"), egg, from, at: (/* @__PURE__ */ new Date()).toISOString() });
function buyEgg(den, data, eggKey, { free = false } = {}) {
  const egg = EGGS[eggKey];
  if (!egg) throw new Error("Uovo sconosciuto.");
  if (den.eggs.length >= MAX_EGGS) throw new Error(`Il nido \xE8 pieno (${MAX_EGGS} uova): schiudine qualcuna.`);
  const cost = free ? 0 : egg.cost;
  const pts = Number(data.petPoints) || 0;
  if (pts < cost) throw new Error(`Ti mancano ${cost - pts} punti pet.`);
  den.eggs.push(makeEgg(eggKey, free ? "master" : "bottega"));
  addLog(den, { k: "egg_buy", egg: eggKey, cost });
  return { patch: cost ? { petPoints: pts - cost } : {} };
}
function hatchEgg(den, data, eggId) {
  if (!den.starter) throw new Error("Prima scegli il tuo pet iniziale.");
  const egg = den.eggs.find((e) => e.id === eggId);
  if (!egg) throw new Error("Quest'uovo non c'\xE8 pi\xF9.");
  den.eggs = den.eggs.filter((e) => e.id !== eggId);
  const { species, rarity } = rollEgg(egg.egg);
  if (countOf(den, species) >= MAX_PER_SPECIES) {
    const pts = refundOf(species);
    addLog(den, { k: "hatch", egg: egg.egg, species, rarity, refunded: pts });
    return { patch: { petPoints: (Number(data.petPoints) || 0) + pts }, out: { species, rarity, refunded: pts } };
  }
  const p = makePet(species, `uovo:${egg.egg}`);
  den.pets.push(p);
  const joined = den.team.length < MAX_TEAM;
  if (joined) den.team.push(p.id);
  addLog(den, { k: "hatch", egg: egg.egg, species, rarity });
  return { out: { species, rarity, petId: p.id, joined } };
}
var MASCOT_XP_BONUS = 0.05;
function gainXp(p, amount) {
  const today = xpDayKey();
  const done = xpTodayOf(p);
  const gained = Math.max(0, Math.min(amount, DAILY_XP_CAP - done));
  const n = addXp(p, gained);
  const { ups, ...rest } = n;
  return { pet: { ...rest, xpDay: { d: today, n: done + gained } }, ups, gained };
}
function setMascot(den, data, petId) {
  if (petId && !den.pets.some((p) => p.id === petId)) throw new Error("Pet non trovato.");
  den.mascot = petId || null;
}
function releasePet(den, data, petId) {
  if (den.pets.length <= 1) throw new Error("Non puoi restare senza pet.");
  if (den.mascot === petId) den.mascot = null;
  den.pets = den.pets.filter((p) => p.id !== petId);
  den.team = den.team.filter((id) => id !== petId);
  if (!den.team.length) den.team = [den.pets[0].id];
}
function setTeam(den, data, team) {
  const ids = [...new Set(team)].filter((id) => den.pets.some((p) => p.id === id)).slice(0, MAX_TEAM);
  if (!ids.length) throw new Error("La squadra deve avere almeno un pet.");
  den.team = ids;
}
function renamePet(den, data, petId, nick) {
  const p = den.pets.find((x) => x.id === petId);
  if (p) p.nick = String(nick || "").trim().slice(0, 18);
}
function learnMove(den, data, petId, grade, moveId) {
  const p = den.pets.find((x) => x.id === petId);
  if (!p) throw new Error("Pet non trovato.");
  if (grade > gradeOfLevel(p.level)) throw new Error("Grado non ancora sbloccato.");
  if (!learnPool(p.species, grade).includes(moveId)) throw new Error("Questo pet non pu\xF2 imparare questa mossa.");
  const before = battleMoves(p);
  const old = (p.learned || {})[grade];
  p.learned = { ...p.learned || {}, [grade]: moveId };
  let set = before.map((m) => m === old ? moveId : m);
  if (!set.includes(moveId) && set.length < MAX_MOVES) set = [...set, moveId];
  p.moveset = set;
}
function setMoveset(den, data, petId, moves) {
  const p = den.pets.find((x) => x.id === petId);
  if (!p) throw new Error("Pet non trovato.");
  const known = knownMoves(p);
  const set = moves.filter((m, i, a) => known.includes(m) && a.indexOf(m) === i).slice(0, MAX_MOVES);
  if (!set.length) throw new Error("Serve almeno una mossa.");
  p.moveset = set;
}
var addItems = (den, ids) => ids.forEach((id) => {
  if (PET_BAG[id]) den.items[id] = (den.items[id] || 0) + 1;
});
var takeItem = (den, id) => {
  if (!(den.items[id] > 0)) throw new Error("Non hai questo oggetto.");
  den.items[id] -= 1;
  if (!den.items[id]) delete den.items[id];
};
var petOf = (den, petId) => {
  const p = den.pets.find((x) => x.id === petId);
  if (!p) throw new Error("Pet non trovato.");
  return p;
};
function buyItem(den, data, id) {
  const it = PET_BAG[id];
  if (!it || !it.price) throw new Error("Questo oggetto non si compra.");
  const pts = Number(data.petPoints) || 0;
  if (pts < it.price) throw new Error(`Servono ${it.price} punti pet.`);
  addItems(den, [id]);
  addLog(den, { k: "item_buy", item: id, cost: it.price });
  const ledger = [{ source: "shop", label: `Bisaccia: ${it.name}`, amount: -it.price, ts: (/* @__PURE__ */ new Date()).toISOString() }, ...(data.petPointsLedger || []).slice(0, 29)];
  return { patch: { petPoints: pts - it.price, petPointsLedger: ledger } };
}
function giveItems(den, data, ids) {
  addItems(den, ids);
  addLog(den, { k: "item_give", items: ids });
}
function applyGrowthItem(den, data, petId, id) {
  const it = PET_BAG[id];
  const p = petOf(den, petId);
  if (it?.kind === "level") {
    if ((p.level || 1) >= MAX_LEVEL) throw new Error("\xC8 gi\xE0 al livello massimo.");
    takeItem(den, id);
    p.level = (p.level || 1) + 1;
    p.xp = 0;
    addLog(den, { k: "item_use", item: id, pet: p.id, species: p.species, level: p.level });
    return { out: { level: p.level } };
  }
  if (it?.kind === "xp") {
    if ((p.level || 1) >= MAX_LEVEL) throw new Error("\xC8 gi\xE0 al livello massimo.");
    if (xpTodayOf(p) >= DAILY_XP_CAP) throw new Error(`Oggi ha gi\xE0 preso tutti i suoi ${DAILY_XP_CAP} PE: riprova domani.`);
    takeItem(den, id);
    const g = gainXp(p, Math.max(60, Math.round(xpToNext(p.level || 1) / 2)));
    Object.assign(p, g.pet);
    addLog(den, { k: "item_use", item: id, pet: p.id, species: p.species, level: p.level, xp: g.gained });
    return { out: { level: p.level, ups: g.ups, gained: g.gained } };
  }
  throw new Error("Oggetto non adatto.");
}
function evolvePet(den, data, petId, stone = false) {
  const p = petOf(den, petId);
  const ev = EVOLUTIONS[p.species];
  if (!ev) throw new Error("Questo pet non ha ancora un'evoluzione.");
  if ((p.evo || 0) >= 1) throw new Error("\xC8 gi\xE0 evoluto.");
  const rar = PET_DEX[p.species]?.rarity;
  const need = evoLevelOf(rar);
  let usedStone = false;
  if ((p.level || 1) < need) {
    if (stone !== true) throw new Error(`Si evolve al livello ${need}.`);
    takeItem(den, EVO_STONE);
    usedStone = true;
  }
  const [n, d] = evoDiceOf(rar);
  const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * d));
  const hp = rolls.reduce((a, x) => a + x, 0);
  p.evo = 1;
  p.evoHp = hp;
  p.evoRolls = rolls;
  p.evoAt = p.level || 1;
  p.evoTs = Date.now();
  addLog(den, { k: "evolve", pet: p.id, species: p.species, level: p.level, hp, rolls, ...usedStone ? { item: EVO_STONE } : {} });
  return { out: { name: ev.name, rolls, dice: `${n}d${d}`, hp, usedStone } };
}
function giveCharm(den, data, petId, id) {
  const it = PET_BAG[id];
  if (it?.kind !== "charm") throw new Error("Non \xE8 un amuleto.");
  const p = petOf(den, petId);
  takeItem(den, id);
  p.charm = { id, left: it.fights };
}
function teachScroll(den, data, petId, id, forget) {
  const it = PET_BAG[id];
  if (it?.kind !== "scroll") throw new Error("Non \xE8 una pergamena.");
  const p = petOf(den, petId);
  const known = knownMoves(p);
  if (known.includes(it.move)) throw new Error("La conosce gi\xE0.");
  if (!known.includes(forget)) throw new Error("Scegli la mossa da dimenticare.");
  const tms = (p.tms || []).filter((m) => m !== forget);
  if (tms.length >= SCROLL_SLOTS) throw new Error(`Ha gi\xE0 ${SCROLL_SLOTS} mosse da pergamena: dimentica una di quelle.`);
  const before = battleMoves(p);
  if ((p.tms || []).includes(forget)) {
  } else if (learnedMoves(p).includes(forget)) {
    const g = Object.keys(p.learned || {}).find((k) => p.learned[k] === forget);
    const learned = { ...p.learned || {} };
    delete learned[g];
    p.learned = learned;
  } else {
    p.forgotten = [...p.forgotten || [], forget];
  }
  takeItem(den, id);
  addLog(den, { k: "scroll", item: id, pet: p.id, species: p.species, forget });
  p.tms = [...tms, it.move];
  p.moveset = before.includes(forget) ? before.map((m) => m === forget ? it.move : m) : [...before, it.move].slice(0, MAX_MOVES);
}
function wearCharms(den, teamIds) {
  den.pets.forEach((p) => {
    if (!teamIds.includes(p.id) || !p.charm) return;
    const left = (p.charm.left || 1) - 1;
    if (left > 0) p.charm = { ...p.charm, left };
    else delete p.charm;
  });
}
function claimGifts(den, data) {
  const gifts = Array.isArray(data.petGifts) ? data.petGifts : [];
  if (!gifts.length) return { out: null };
  const got = [], refunded = [], eggs = [];
  let pts = Number(data.petPoints) || 0;
  gifts.forEach((g) => {
    if (g.item && PET_BAG[g.item]) {
      addItems(den, [g.item]);
      addLog(den, { k: "gift", item: g.item, from: g.from || "mercato" });
      eggs.push(`item:${g.item}`);
      return;
    }
    if (g.egg && EGGS[g.egg]) {
      den.eggs.push(makeEgg(g.egg, g.from || "mercato"));
      addLog(den, { k: "gift", egg: g.egg, from: g.from || "mercato" });
      eggs.push(g.egg);
      return;
    }
    if (!PET_DEX[g.species]) return;
    if (countOf(den, g.species) >= MAX_PER_SPECIES) {
      pts += refundOf(g.species);
      refunded.push(g.species);
      addLog(den, { k: "gift", species: g.species, from: g.from || "mercato", refunded: refundOf(g.species) });
      return;
    }
    addLog(den, { k: "gift", species: g.species, from: g.from || "mercato" });
    const p = makePet(g.species, g.from || "mercato");
    den.pets.push(p);
    if (den.team.length < MAX_TEAM) den.team.push(p.id);
    got.push(g.species);
  });
  return { patch: { petGifts: [], petPoints: pts }, out: { got, refunded, eggs } };
}
function recordTowerResult(den, data, floor, won, teamIds) {
  if (den.tower.floor !== floor) throw new Error("Questo piano \xE8 gi\xE0 stato registrato.");
  const xp = won ? towerXp(floor) : towerLossXp(floor);
  const ups = [];
  const gained = {};
  den.pets = den.pets.map((p) => {
    if (!teamIds.includes(p.id)) return p;
    const g = gainXp(p, p.id === den.mascot ? Math.round(xp * (1 + MASCOT_XP_BONUS)) : xp);
    gained[p.id] = g.gained;
    if (g.ups) ups.push({ id: p.id, species: p.species, level: g.pet.level });
    return g.pet;
  });
  const capped = Object.values(gained).some((v) => v < xp);
  wearCharms(den, teamIds);
  const team = teamIds.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean).map((p) => `${p.species}:${p.level}`);
  if (!won) {
    const att = den.tower.att?.floor === floor ? den.tower.att.n || 0 : 0;
    den.tower = { ...den.tower, losses: (den.tower.losses || 0) + 1, att: { floor, n: att + 1 } };
    addLog(den, { k: "tower", f: floor, won: false, xp, team, capped });
    return { out: { won: false, xp, pts: 0, ups, drops: [], att: att + 1, gained, capped } };
  }
  const first = floor > (den.tower.best || 0);
  const pts = first ? towerPoints(floor) : 0;
  const drops = first ? towerDrops(floor) : [];
  addItems(den, drops);
  den.tower = { ...den.tower, att: null, floor: floor + 1, best: Math.max(den.tower.best || 0, floor), wins: (den.tower.wins || 0) + 1 };
  addLog(den, { k: "tower", f: floor, won: true, xp, pts, drops, team, again: !first, capped });
  return { patch: pts ? { petPoints: (Number(data.petPoints) || 0) + pts } : {}, out: { won: true, xp, pts, ups, drops, again: !first, gained, capped } };
}
var PVP_POINTS = 3;
var PVP_DAILY = 3;
var PVP_WIN_XP = 10;
var PVP_LOSS_XP = 3;
var PVP_XP_FIGHTS = 5;
function recordPvpResult(den, data, match, side) {
  if (den.pvp.claimed.includes(match.id)) return { out: { already: true } };
  den.pvp.claimed = [match.id, ...den.pvp.claimed].slice(0, 40);
  const won = match.winner === side;
  const self = match.a === match.b;
  const teamIds = (match.teams?.[side] || []).map((p) => p.id);
  spendBattleItems(den, match.used?.[side], teamIds, match.teams?.[side]);
  wearCharms(den, teamIds);
  if (self) return { out: { won, self: true, xp: 0, pts: 0, ups: [], drops: [] } };
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (den.pvp.day !== day) {
    den.pvp.day = day;
    den.pvp.rewarded = 0;
    den.pvp.fights = 0;
  }
  const quit = !won && match.forfeit === side;
  const capped = (den.pvp.fights || 0) >= PVP_XP_FIGHTS;
  const xp = capped || quit ? 0 : won ? PVP_WIN_XP : PVP_LOSS_XP;
  if (!capped && !quit) den.pvp.fights = (den.pvp.fights || 0) + 1;
  const ups = [];
  den.pets = den.pets.map((p) => {
    if (!teamIds.includes(p.id) || !xp) return p;
    const g = gainXp(p, xp);
    if (g.ups) ups.push({ id: p.id, species: p.species, level: g.pet.level });
    return g.pet;
  });
  if (won) den.pvp.wins += 1;
  else den.pvp.losses += 1;
  let pts = 0;
  const drops = [];
  if (won && den.pvp.rewarded < PVP_DAILY) {
    den.pvp.rewarded += 1;
    pts = PVP_POINTS;
    if (Math.random() < 0.2) drops.push(CHARMS[Math.floor(Math.random() * CHARMS.length)]);
    addItems(den, drops);
  }
  addLog(den, { k: "pvp", won, xp, pts, drops, quit, capped, vs: side === "p" ? match.bName : match.aName });
  return { patch: pts ? { petPoints: (Number(data.petPoints) || 0) + pts } : {}, out: { won, xp, pts, ups, drops, capped, quit } };
}
function towerFresh(tower, week = towerWeek()) {
  const t = { ...tower || {}, week: tower?.week || "2026-10-26" };
  if (t.week === week) return { floor: 1, best: 0, wins: 0, ...t };
  return {
    week,
    floor: 1,
    best: 0,
    wins: 0,
    losses: 0,
    att: null,
    resets: 0,
    resetDay: t.resetDay || null,
    bestEver: Math.max(t.bestEver || 0, t.best || 0)
  };
}
var romeDay = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
var canResetTower = (tower, now = Date.now()) => (tower.floor || 1) > 1 && tower.resetDay !== romeDay(now);
function towerSeed(uid, den, floor, week = towerWeek()) {
  const t = towerFresh(den.tower, week);
  const att = t.att?.floor === floor ? t.att.n || 0 : 0;
  let h = 2166136261;
  for (const ch of `${uid}|${week}|${t.resets || 0}|${floor}|${att}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function resetTower(den) {
  den.tower = towerFresh(den.tower);
  if ((den.tower.floor || 1) <= 1) throw new Error("Sei gi\xE0 al piano 1.");
  const today = romeDay();
  if (den.tower.resetDay === today) throw new Error("Hai gi\xE0 ricominciato la torre oggi: riprova domani.");
  addLog(den, { k: "tower_reset", from: den.tower.floor });
  den.tower = { ...den.tower, floor: 1, att: null, resets: (den.tower.resets || 0) + 1, resetDay: today };
  return { out: { ok: true } };
}
function spendBattleItems(den, used, teamIds, team) {
  if (!used) return;
  Object.entries(used).forEach(([id, list]) => {
    (Array.isArray(list) ? list : []).forEach((idx) => {
      if (!(den.items[id] > 0) || !usableInBattle(id)) return;
      den.items[id] -= 1;
      if (PET_BAG[id].kind === "charm") {
        const pid = team?.[idx]?.id || teamIds[idx];
        const p = den.pets.find((x) => x.id === pid);
        if (p) p.charm = { id, left: PET_BAG[id].fights };
      }
    });
  });
  addLog(den, { k: "battle_items", items: Object.keys(used) });
}
var towerTurnSeed = (seed, i) => seed + (i + 1) * 7919 >>> 0;
function towerStart(den, floor, teamIds, seed, week = towerWeek()) {
  const pets = teamIds.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  if (!pets.length || pets.length !== teamIds.length || pets.length > MAX_TEAM) throw new Error("Squadra non valida.");
  const plan = towerFloor(floor, week);
  return withSeed(seed, () => newBattle(pets, plan.team, { enemyBoost: plan.enemyBoost, aiLevel: plan.aiLevel }));
}
function validAction(b, a, bag = {}) {
  const side = b.sides.p;
  const f = side.team[side.active];
  if (a?.kind === "item") {
    if (b.needSwitch && b.needSwitch.includes("p")) return false;
    const it = PET_BAG[a.item];
    const t = side.team[a.index];
    if (!it || !usableInBattle(a.item) || !(bag[a.item] > 0) || !Number.isInteger(a.index) || !t) return false;
    if (it.use?.revive) return t.hp <= 0;
    if (t.hp <= 0) return false;
    if (it.kind === "charm") return true;
    return true;
  }
  if (a?.kind === "switch") {
    const t = side.team[a.index];
    return Number.isInteger(a.index) && !!t && t.hp > 0 && a.index !== side.active;
  }
  if (b.needSwitch && b.needSwitch.includes("p")) return false;
  if (a?.kind !== "move") return false;
  const left = Object.values(f.pp);
  if (a.move === "zampata") return left.every((v) => v === 0);
  return Object.prototype.hasOwnProperty.call(f.pp, a.move) && f.pp[a.move] !== 0;
}
function replayTower(den, uid, floor, teamIds, actions, week = towerWeek()) {
  if (!Array.isArray(actions) || actions.length > 400) throw new Error("Lotta non valida.");
  const seed = towerSeed(uid, den, floor, week);
  let b = towerStart(den, floor, teamIds, seed, week);
  const bag = { ...den.items };
  const used = {};
  actions.forEach((a, i) => {
    if (b.over) throw new Error("Lotta non valida (azioni dopo la fine).");
    if (!validAction(b, a, bag)) throw new Error("Lotta non valida (mossa non permessa).");
    if (a.kind === "item") {
      bag[a.item] -= 1;
      (used[a.item] ||= []).push(a.index);
    }
    b = withSeed(towerTurnSeed(seed, i), () => playTurn(b, a).battle);
  });
  if (!b.over) throw new Error("La lotta non \xE8 finita.");
  return { over: b.over, used };
}
function towerFinish(den, data, floor, teamIds, actions, ctx) {
  const week = towerWeek();
  den.tower = towerFresh(den.tower, week);
  if (den.tower.floor !== floor) throw new Error(floor > 1 && den.tower.floor === 1 ? "La torre \xE8 ricominciata (nuova settimana o reset): riparti dal piano 1." : "Questo piano \xE8 gi\xE0 stato registrato.");
  const { over, used } = replayTower(den, ctx.uid, floor, teamIds, actions, week);
  spendBattleItems(den, used, teamIds, null);
  return recordTowerResult(den, data, floor, over === "p", teamIds);
}
var OPS = {
  chooseStarter: { run: chooseStarter },
  givePet: { run: givePet, master: true },
  buyEgg: { run: buyEgg, master: (args) => !!args[1]?.free },
  hatchEgg: { run: hatchEgg },
  setMascot: { run: setMascot },
  releasePet: { run: releasePet },
  setTeam: { run: setTeam },
  renamePet: { run: renamePet },
  learnMove: { run: learnMove },
  setMoveset: { run: setMoveset },
  buyItem: { run: buyItem },
  giveItems: { run: giveItems, master: true },
  applyGrowthItem: { run: applyGrowthItem },
  evolvePet: { run: evolvePet },
  giveCharm: { run: giveCharm },
  teachScroll: { run: teachScroll },
  claimGifts: { run: claimGifts },
  towerFinish: { run: towerFinish },
  resetTower: { run: resetTower },
  recordPvpResult: { run: recordPvpResult, match: true }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LOSS_XP,
  MASCOT_XP_BONUS,
  OPS,
  PVP_DAILY,
  PVP_LOSS_XP,
  PVP_POINTS,
  PVP_WIN_XP,
  PVP_XP_FIGHTS,
  STARTER_GIFT,
  applyGrowthItem,
  buyEgg,
  buyItem,
  canResetTower,
  chooseStarter,
  claimGifts,
  countOf,
  denOf,
  evolvePet,
  giveCharm,
  giveItems,
  givePet,
  hatchEgg,
  learnMove,
  recordPvpResult,
  releasePet,
  renamePet,
  replayTower,
  resetTower,
  setMascot,
  setMoveset,
  setTeam,
  teachScroll,
  towerFinish,
  towerFresh,
  towerSeed,
  towerStart,
  towerTurnSeed,
  validAction
});
