/* ============================================================
   EVOLUZIONI DEI PET (2026-11-01) — una per specie (la struttura
   regge anche una seconda: `pet.evo` = quante evoluzioni ha fatto).
   - Si evolve dal livello EVO_LEVEL della rarità, a scelta del
     giocatore (op del server `evolvePet`).
   - Forma adulta: più grande e seria (pixel art a parte, in
     pet_dex/{specie}__evo1, generata dal Bestiario del Master).
   - Statistiche: Attacco/Difesa ×1,12, Velocità ×1,08, CA +1 (+ i
     `plus` della specie) e PF in più tirati coi dadi (EVO_HP_DICE,
     il tiro lo fa il server e resta sul pet: `pet.evoHp`).
   - Resistenze nuove (`res`) e UNA abilità speciale: una mossa
     (`move`, sempre in più alle 4 di lotta, pochi usi) o una passiva
     (`passive`, vedi EVO_PASSIVES; il motore le applica in lotta).
   File senza import: petDex.js ci prende le mosse (EVO_MOVES).
   ============================================================ */

export const EVO_LEVEL = { starter: 15, common: 15, rare: 18, epic: 22, legendary: 26 };
export const EVO_HP_DICE = { starter: [3, 8], common: [3, 8], rare: [3, 10], epic: [3, 12], legendary: [4, 12] };
export const EVO_MULT = { atk: 1.12, def: 1.12, spd: 1.08 };

/* Passive: `v` = quanto (frazione o numero). Testi per le schede. */
export const EVO_PASSIVES = {
  rigenera:   { icon: "🌿", name: "Rigenerazione", text: (v) => `A fine turno recupera ${Math.round(v * 100)}% dei PF.` },
  spine:      { icon: "🌵", name: "Pelle Spinata", text: (v) => `Chi lo colpisce perde ${Math.round(v * 100)}% del danno che fa.` },
  furia:      { icon: "💢", name: "Furia", text: (v) => `Sotto un terzo dei PF fa il ${Math.round(v * 100)}% di danni in più.` },
  tenacia:    { icon: "🪨", name: "Tenacia", text: () => "Una volta per lotta resta in piedi a 1 PF invece di andare a terra." },
  intimidire: { icon: "😠", name: "Presenza Terrificante", text: () => "Quando entra in campo l'avversario perde un grado di Attacco." },
  succhiavita:{ icon: "🩸", name: "Succhiavita", text: (v) => `Recupera ${Math.round(v * 100)}% dei danni che fa.` },
  critico:    { icon: "🎯", name: "Occhio Letale", text: (v) => `Critico con ${v}–20 sul d20.` },
  purezza:    { icon: "✨", name: "Corpo Puro", text: () => "Non può essere scottato, avvelenato né intontito." },
  elemento:   { icon: "🔆", name: "Signore dell'Elemento", text: () => "Le mosse del suo elemento fanno ×1,5 invece di ×1,25." },
  sfocatura:  { icon: "🌫️", name: "Sfocatura", text: () => "Chi lo attacca tira con svantaggio, finché non lo colpisce; torna a fine turno." },
  corazza:    { icon: "🛡️", name: "Corazza", text: (v) => `Ogni colpo gli fa ${v} danni in meno (minimo 1).` },
  tocco:      { icon: "☣️", name: "Tocco", text: (v, st) => `I suoi colpi hanno il ${Math.round(v * 100)}% di ${ST_TXT[st] || "effetto"}.` },
  assorbi:    { icon: "🌀", name: "Assorbimento", text: (v, st, el) => `I colpi di ${EL_TXT[el] || el} non lo feriscono: lo curano del 25%.` },
  leggendaria:{ icon: "👑", name: "Resistenza Leggendaria", text: () => "Il primo tiro salvezza fallito in lotta diventa riuscito." },
};
const ST_TXT = { burn: "scottare", poison: "avvelenare", stun: "intontire", ac: "togliere 1 di CA" };
const EL_TXT = { water: "acqua", fire: "fuoco", cold: "gelo", lightning: "fulmine" };

// Mosse speciali delle evoluzioni: [nome, elemento, potenza, precisione, fx, extra]
export const EVO_MOVES = {
  soffiorosso:   ["Soffio del Drago Rosso", "fire", 130, 90, "breath", { uses: 1, effect: { burn: 0.5 } }],
  pungiviverna:  ["Pungiglione di Viverna", "poison", 110, 90, "sting", { uses: 2, effect: { poison: 0.6 } }],
  inglobare:     ["Inglobare", "acid", 95, 90, "bite", { uses: 2, effect: { drain: 0.4, stun: 0.2 } }],
  balzolampo:    ["Balzo Intermittente", "radiant", 85, 100, "dash", { uses: 3, prio: 1 }],
  morsoadesivo:  ["Morso Adesivo", "acid", 90, 95, "bite", { uses: 2, effect: { stun: 0.3 } }],
  tenaglia:      ["Tenaglia d'Acciaio", "water", 100, 95, "claw", { uses: 2, effect: { foe: { def: -1, ac: -1 }, chance: 0.5 } }],
  fulminebehir:  ["Fulmine del Behir", "lightning", 125, 90, "bolt", { uses: 1, effect: { stun: 0.25 } }],
  tentacoli:     ["Stretta dei Tentacoli", "water", 110, 90, "whip", { uses: 2, effect: { foe: { spd: -1 }, chance: 1, stun: 0.2 } }],
  raggioocchio:  ["Raggio dell'Occhio", "psychic", 125, 85, "beam", { uses: 1, effect: { stun: 0.3 } }],
  cornoguaritore:["Corno Guaritore", "radiant", 0, 100, "heal", { uses: 1, effect: { heal: 0.5, cure: true } }],
  soffioinverno: ["Soffio Invernale", "cold", 110, 90, "breath", { uses: 2, effect: { foe: { spd: -1 }, chance: 1 } }],
  morsoputrido:  ["Morso Putrido", "poison", 100, 90, "bite", { uses: 2, effect: { poison: 0.5, foe: { def: -1 }, chance: 0.4 } }],
  lamento:       ["Lamento dello Spettro", "necrotic", 95, 95, "wave", { uses: 2, effect: { foe: { atk: -1 }, chance: 0.6 } }],
  balzomortale:  ["Balzo Mortale", "earth", 130, 85, "stomp", { uses: 1, effect: { stun: 0.3 } }],
  soffiobianco:  ["Soffio del Drago Bianco", "cold", 130, 90, "breath", { uses: 1, effect: { stun: 0.3 } }],
  soffioblu:     ["Soffio del Drago Blu", "lightning", 130, 90, "beam", { uses: 1, effect: { foe: { ac: -1 }, chance: 1 } }],
  esplosionementale: ["Esplosione Mentale", "psychic", 110, 90, "wave", { uses: 1, effect: { stun: 0.5 } }],
};

const E = (name, icon, desc, look, skill, extra = {}) => ({ name, icon, desc, look, skill, ...extra });

export const EVOLUTIONS = {
  brace: E("Dragone Rosso", "🐉",
    "Un giovane drago rosso: superbo, avido, e ogni respiro sa di incendio.",
    "a young red dragon, large powerful crimson-scaled dragon with big swept-back horns, wide leathery wings half open, fierce golden eyes, fiery maw with embers and smoke",
    { move: "soffiorosso" }, { plus: { atk: 1 } }),
  tartadrago: E("Dragartaruga", "🐢",
    "La tartaruga-drago adulta: un'isola che nuota e affonda le navi per noia.",
    "an adult dragon turtle, massive armored sea dragon turtle with a huge spiked emerald shell, long draconic neck and head with fins, steam rising, stern ancient eyes",
    { passive: "corazza", v: 3 }, { res: { resist: ["cold"] } }),
  gufurso: E("Gufurso Adulto", "🦉",
    "Un gufurso cresciuto: due metri e mezzo di piume, artigli e cattivo umore.",
    "an adult owlbear, huge hulking bear body with brown feathers and fur, fierce owl face with a sharp hooked beak and glaring eyes, massive clawed paws raised",
    { passive: "furia", v: 0.5 }, { plus: { atk: 1 } }),
  pseudodrago: E("Viverna", "🐉",
    "Lo pseudodrago è diventato una viverna: due zampe, due ali e una coda che uccide.",
    "a wyvern, lean dark-red two-legged dragon with large bat-like wings, long whip tail ending in a huge dripping venomous stinger, predatory yellow eyes",
    { move: "pungiviverna" }, { res: { immune: ["poison"] } }),
  gattombra: E("Belva Distorcente", "🐆",
    "Una belva distorcente adulta: vedi sei zampe e due tentacoli, ma mai dove sono davvero.",
    "an adult displacer beast, sleek large blue-black six-legged panther with two long barbed tentacles on its back, glowing violet eyes, shimmering displaced afterimage",
    { passive: "sfocatura" }),

  mefitino: E("Elementale del Magma", "🌋",
    "Il mefite è cresciuto in un ammasso di roccia fusa: toccarlo fa male a chi tocca.",
    "a magma elemental, large hulking humanoid of black cooling rock with glowing orange lava cracks, molten fists dripping lava, burning eyes, heat haze",
    { passive: "spine", v: 0.2 }),
  cubetto: E("Cubo Gelatinoso", "🟩",
    "Un cubo gelatinoso vero: riempie un corridoio e dentro ha l'armatura dell'ultimo eroe.",
    "a large gelatinous cube, huge translucent lime-green acidic jelly cube filling the frame, a skeleton, a sword and coins suspended inside, menacing faint glow, acid drips",
    { move: "inglobare" }, { res: { resist: ["acid"] } }),
  funghetto: E("Sovrano Miconide", "🍄",
    "Il re dei miconidi: un fungo alto come un albero che guarisce chi lo segue.",
    "a myconid sovereign, tall regal mushroom humanoid with a broad spotted purple cap like a crown, long fungal robes, glowing spore clouds, wise solemn face",
    { passive: "rigenera", v: 1 / 12 }, { res: { resist: ["poison"] } }),
  saltello: E("Cane Intermittente", "🐕",
    "Un cane intermittente adulto: c'è, non c'è, ti morde da dietro.",
    "an adult blink dog, sleek tall golden fey hound with long ears, alert noble face, radiant sparkles and a teleport flash around its body",
    { move: "balzolampo" }, { plus: { spd: 1 } }),
  diavoletto: E("Diavolo Spinato", "😈",
    "Il diavoletto è salito di grado: ora è un diavolo spinato, e le spine le lancia.",
    "a spined devil, wiry red devil with a body covered in long sharp spines, bat wings, a spiny tail, cruel grin, dark smoke",
    { passive: "spine", v: 0.25 }),
  scrignetto: E("Mimic Antico", "🧰",
    "Un mimic vecchio come il dungeon: un forziere enorme che si incolla a chi lo apre.",
    "an ancient mimic, huge iron-bound treasure chest monster with rows of jagged teeth, a long sticky tongue, adhesive goo dripping, beady eyes on the lid",
    { move: "morsoadesivo" }),
  yetino: E("Yeti Abominevole", "🦍",
    "Lo yeti adulto: quando ruggisce le valanghe si spostano per educazione.",
    "an abominable yeti, towering muscular white-furred yeti with icy blue skin, curved horns, huge clawed hands, roaring mouth with fangs, swirling snow",
    { passive: "intimidire" }, { res: { resist: ["bludgeoning"] } }),
  brinello: E("Spirito della Bufera", "❄️",
    "Il mefite del ghiaccio si è fatto tempesta: chi lo sfiora resta di ghiaccio.",
    "a frost storm spirit, tall elegant elemental of jagged blue ice crystals and swirling blizzard winds, cold glowing eyes, icicle crown",
    { passive: "tocco", v: 0.15, st: "stun" }),
  granchietto: E("Granchio Gigante", "🦀",
    "Il granchio gigante, finalmente gigante. Le chele tagliano l'acciaio.",
    "a giant crab, huge armored crimson and steel-blue crab with massive serrated claws, spiked shell, eyes on stalks, sea foam",
    { move: "tenaglia" }, { plus: { ac: 1 } }),
  ragnetto: E("Ragno Gigante", "🕷️",
    "Un ragno gigante adulto: il suo veleno ti lascia sveglio, ma fermo.",
    "an adult giant spider, large hairy black and purple spider with long legs, eight glowing red eyes, huge fangs dripping green venom, webs",
    { passive: "tocco", v: 0.25, st: "poison" }),
  scheletrino: E("Mastino Scheletrico", "💀",
    "Il cucciolo d'ossa è un mastino non morto: non sente dolore, né veleno.",
    "a skeletal war hound, large undead mastiff made of cracked bones with an armored skull, ghostly green fire in the eye sockets and ribcage, chain collar",
    { passive: "purezza" }),
  behirino: E("Behir", "🐍",
    "Un behir adulto: venti metri di serpente con dodici zampe e il fulmine in gola.",
    "an adult behir, long massive blue serpentine reptile with many clawed legs, curved horns, armored scales, crackling lightning from its open jaws",
    { move: "fulminebehir" }),
  flumphino: E("Flumph Anziano", "🪼",
    "Un flumph anziano: galleggia sereno e la sua calma guarisce le ferite.",
    "an elder flumph, large floating jellyfish-like disc creature with long glowing tendrils, two tall eyestalks, calm wise expression, soft pink psychic aura",
    { passive: "rigenera", v: 1 / 14 }, { res: { resist: ["psychic"] } }),

  salamandrina: E("Salamandra", "🦎",
    "Una salamandra di fuoco adulta: dove striscia, il terreno resta nero.",
    "an adult fire salamander, long large serpentine lizard of red-orange scales with a crest of flames along its back and a burning tail, fierce face, embers",
    { passive: "tocco", v: 0.3, st: "burn" }),
  krakino: E("Kraken Giovane", "🐙",
    "Il kraken non è più neonato: i suoi tentacoli stringono navi e pet.",
    "a young kraken, huge dark teal and purple squid monster with many thick tentacles lashing, one enormous glaring eye, sharp beak, crashing waves",
    { move: "tentacoli" }),
  ruggine: E("Mostro della Ruggine", "🐜",
    "Un mostro della ruggine adulto: le armature gli si sbriciolano addosso.",
    "an adult rust monster, large armored insectoid beast with rusty orange carapace, two long feathery antennae, flaking metal debris, determined face",
    { passive: "tocco", v: 0.3, st: "ac" }, { res: { resist: ["slashing"] } }),
  turbino: E("Elementale dell'Aria", "🌪️",
    "Il mulinello è diventato tempesta: un elementale dell'aria che urla fulmini.",
    "an air elemental, towering roaring tornado of pale blue wind with a vague fierce face, crackling lightning inside, debris swirling",
    { passive: "elemento" }),
  occhietto: E("Beholder", "👁️",
    "Lo spettatore è diventato un beholder: un occhio, dieci raggi, nessuna pietà.",
    "a beholder, large floating spherical aberration with one huge central eye, ten writhing eyestalks, wide mouth full of teeth, purple hide, menacing glare",
    { move: "raggioocchio" }),
  cornina: E("Unicorno", "🦄",
    "Un unicorno adulto: il suo corno chiude le ferite e scaccia i veleni.",
    "an adult unicorn, tall majestic white horse with a long glowing golden spiral horn, flowing silver mane, noble serious eyes, holy light",
    { move: "cornoguaritore" }, { res: { resist: ["radiant"] } }),
  cerberino: E("Segugio Infernale", "🐕‍🦺",
    "Un segugio infernale adulto: fiuta la paura e morde dove fa più male.",
    "an adult hell hound, large black-furred demonic dog with a mane of fire, glowing red eyes, smoking jaws full of fangs, burning paw prints",
    { passive: "critico", v: 18 }),
  lupogelo: E("Lupo Invernale", "🐺",
    "Il lupo invernale adulto: il suo fiato congela le gambe di chi scappa.",
    "an adult winter wolf, huge snow-white wolf with icy blue eyes, frost covering its thick fur, freezing mist breath, snarling",
    { move: "soffioinverno" }),
  gocciolo: E("Stranezza delle Acque", "💧",
    "La goccia è diventata una stranezza delle acque: l'acqua la nutre.",
    "a water weird, tall serpentine creature made of living clear blue water rising from a pool, translucent body, cold glowing eyes, splashes",
    { passive: "assorbi", el: "water" }),
  fuocofatuo: E("Fuoco Fatuo Antico", "🔆",
    "Un fuoco fatuo che ha bevuto mille paure: si nutre di chi colpisce.",
    "an ancient will-o'-wisp, large sinister floating orb of pale blue-white electric light with a ghostly skull-like face inside, crackling tendrils",
    { passive: "succhiavita", v: 0.25 }),
  otyughino: E("Otyugh", "🗑️",
    "Un otyugh adulto: tre zampe, due tentacoli e un morso che porta la febbre.",
    "an adult otyugh, large bloated greenish-brown aberration on three thick legs, two long tentacles with spiked tips, an eye stalk, huge toothy maw, filth",
    { move: "morsoputrido" }, { res: { immune: ["poison"] } }),
  fantasmino: E("Spettro", "👻",
    "Il fantasmino non chiede più scusa: il suo lamento svuota il coraggio.",
    "a wraith-like spectre, tall dark translucent ghost in tattered shroud, hollow glowing eyes, long clawed spectral hands, cold mist",
    { move: "lamento" }),

  squalterra: E("Bulette", "🦈",
    "La bulette adulta: salta fuori dalla terra e ricade addosso a tutto.",
    "an adult bulette (landshark), huge armored blue-grey beast with a shark-like head, a tall dorsal crest, powerful clawed legs, leaping out of cracked earth",
    { move: "balzomortale" }, { plus: { def: 1 } }),
  piumaserpe: E("Couatl", "🪶",
    "Il couatl adulto: serpente piumato e guardiano, la sua volontà non si piega.",
    "an adult couatl, long majestic golden feathered serpent with wide rainbow feathered wings, wise serious eyes, radiant holy aura",
    { passive: "leggendaria" }, { res: { resist: ["psychic"] } }),
  nevischio: E("Drago Bianco", "🐉",
    "Un giovane drago bianco: feroce, affamato, e il suo soffio ferma il cuore.",
    "a young white dragon, large icy-white dragon with jagged frost frills, wide wings, cruel pale blue eyes, freezing breath mist, ice crystals",
    { move: "soffiobianco" }),
  saettino: E("Drago Blu", "🐉",
    "Un giovane drago blu: il grande corno sul naso chiama i fulmini del deserto.",
    "a young blue dragon, large sapphire-blue dragon with one big horn on its nose, wide wings, arrogant golden eyes, lightning crackling from its jaws",
    { move: "soffioblu" }),
  girino: E("Mind Flayer", "🦑",
    "Il girino è diventato un mind flayer: buono non lo dice più.",
    "a mind flayer (illithid), tall humanoid with purple skin and an octopus head with four face tentacles, white pupil-less eyes, high-collared dark robes, psychic aura",
    { move: "esplosionementale" }),

  tarrasquino: E("Tarrasque", "🦖",
    "Il Tarrasque. Non più in miniatura. Che gli dei vi aiutino.",
    "the tarrasque, colossal reptilian kaiju with a massive spiked carapace, two huge forward horns, gaping jaws full of teeth, earth shaking, apocalyptic",
    { passive: "corazza", v: 4 }),
  lichetto: E("Lich", "☠️",
    "Un lich vero: finché il filatterio esiste, non va mai giù davvero.",
    "a lich, tall skeletal undead sorcerer in ornate tattered purple and black robes with a golden crown, glowing green eyes, holding a phylactery, necrotic green flames",
    { passive: "tenacia" }),
};

export const evoOf = (species, stage = 1) => (stage === 1 ? EVOLUTIONS[species] || null : null);
export const evoLevelOf = (rarity) => EVO_LEVEL[rarity] || 15;
export const evoDiceOf = (rarity) => EVO_HP_DICE[rarity] || [3, 8];
export const evoSkillText = (evo) => {
  const s = evo?.skill || {};
  if (s.passive) {
    const p = EVO_PASSIVES[s.passive];
    return p ? `${p.icon} ${p.name}: ${p.text(s.v, s.st, s.el)}` : "";
  }
  return "";
};
