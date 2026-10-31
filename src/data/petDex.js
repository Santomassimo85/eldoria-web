/* ============================================================
   PET DEX — il sistema pet "alla Pokémon" (2026-10-31).
   37 creature di D&D in versione cucciola: 10 iniziali COMUNI, uno per
   elemento (si sceglie UNA sola volta, al primo accesso) + le altre che
   escono dalle UOVA (Bottega delle uova coi punti pet, Mercato Nero).
   Anche gli iniziali escono dalle uova, come comuni.
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
     res    — resistenze/immunità/vulnerabilità prese dalla scheda D&D del
              mostro: { resist: [], immune: [], vuln: [] } con i tipi qui
              sotto o i danni fisici bludgeoning/piercing/slashing.
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
  neutral: ["#fff4d6", "#f2b552", "#8a4b1f"],   // colpi fisici: ambra calda (il bianco non si vedeva)
};

/* Danni fisici: le mosse "neutral" fanno un danno di D&D secondo la forma
   (pestone = contundente, morso = perforante, artigli = tagliente). */
export const PHYS_KINDS = ["bludgeoning", "piercing", "slashing"];
export const DMG_ICON = { ...TYPE_ICON, bludgeoning: "🔨", piercing: "🦷", slashing: "🗡️" };
export const DMG_LABEL = { ...TYPE_LABEL, bludgeoning: "Contundente", piercing: "Perforante", slashing: "Tagliente" };
const PHYS_OF_FX = { stomp: "bludgeoning", dash: "bludgeoning", bite: "piercing", sting: "piercing", claw: "slashing", whip: "slashing" };
export const damageKindOf = (move) => (move?.type && move.type !== "neutral" ? move.type : PHYS_OF_FX[move?.fx] || "bludgeoning");

/* Regole di D&D: resistenza = metà, vulnerabilità = doppio, immunità = zero. */
export function resistMultiplier(speciesKey, kind) {
  const r = PET_DEX[speciesKey]?.res;
  if (!r) return 1;
  if (r.immune?.includes(kind)) return 0;
  let m = 1;
  if (r.resist?.includes(kind)) m *= 0.5;
  if (r.vuln?.includes(kind)) m *= 2;
  return m;
}

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
   metà di questo in punti pet). Gli iniziali sono comuni: nelle uova
   escono come comuni. */
export const RARITY = {
  starter:   { label: "Iniziale",    color: "#d9a441", value: 40 },
  common:    { label: "Comune",      color: "#8a8f99", value: 40 },
  rare:      { label: "Raro",        color: "#3d8fd1", value: 90 },
  epic:      { label: "Epico",       color: "#a45ad8", value: 180 },
  legendary: { label: "Leggendario", color: "#e0782b", value: 400 },
};
export const HATCH_RARITIES = ["common", "rare", "epic", "legendary"];
export const hatchRarityOf = (key) => (PET_DEX[key]?.rarity === "starter" ? "common" : PET_DEX[key]?.rarity);

/* ── MOSSE ──────────────────────────────────────────────────
   power = potenza (0 = mossa di stato), acc = precisione %, pp = usi per
   lotta, prio = priorità (1 = agisce prima).
   fx = come si vede (e si sente) in lotta: stomp (pestone, onda
   d'urto) · bite · claw (tre tagli) · whip (UNA sferzata che schiocca) ·
   sting (pungiglione/ago) · dash (carica di tutto il corpo) · spikes
   (spuntoni che salgono dal terreno) · orb (proiettile) · beam (raggio) · breath (soffio a cono) ·
   burst (esplosione sul bersaglio) · bolt (fulmine dall'alto) · rain
   (schegge/sassi che cadono) · wave (onde) · cloud (nube) · curse
   (spirale) · aura (potenziamento) · heal · sleep · drain · roar.
   effect:
     { burn|poison: chance }           stato a turni sul bersaglio
     { stun: chance }                  il bersaglio salta il prossimo turno
     { self: {atk|def|spd: +n} }       potenzia chi la usa (stadi -3..+3)
     { self: {ac: +n} }                +n alla Classe Armatura (da -4 a +4)
     { foe:  {atk|def|spd|ac: -n}, chance }  indebolisce il bersaglio
     { heal: 0.5 } · { drain: 0.5 } · { recoil: 0.25 } */
const M = (name, type, power, acc, pp, fx, extra = {}) => ({ name, type, power, acc, pp, fx, ...extra });
export const PET_DEX_MOVES = {
  // ── fisiche (neutre: chiunque le può imparare) ──
  zampata:      M("Zampata", "neutral", 40, 100, 30, "stomp", { lv: 1 }),
  graffio:      M("Graffio", "neutral", 45, 100, 25, "claw", { lv: 1 }),
  scattino:     M("Scattino", "neutral", 35, 100, 20, "dash", { lv: 1, prio: 1 }),
  morsetto:     M("Morsetto", "neutral", 55, 95, 20, "bite", { lv: 2 }),
  colpocoda:    M("Colpo di Coda", "neutral", 55, 100, 20, "whip", { lv: 2 }),
  ingoiare:     M("Ingoiare", "neutral", 60, 90, 10, "bite", { lv: 3, effect: { drain: 0.5 } }),
  doppiograffio:M("Doppio Graffio", "neutral", 70, 95, 15, "claw", { lv: 3 }),
  testata:      M("Testata", "neutral", 80, 85, 10, "dash", { lv: 4, effect: { recoil: 0.25 } }),
  caricafuriosa:M("Carica Furiosa", "neutral", 100, 85, 8, "dash", { lv: 5, effect: { recoil: 0.25 } }),
  schianto:     M("Schianto", "neutral", 120, 80, 5, "stomp", { lv: 6 }),
  // neutre di stato: solo innate (non si imparano)
  ruggitino:    M("Ruggitino", "neutral", 0, 100, 15, "roar", { effect: { foe: { atk: -1 } } }),
  guscio:       M("Rintanarsi", "neutral", 0, 100, 10, "aura", { effect: { self: { ac: 2, def: 1 } } }),
  pisolino:     M("Pisolino", "neutral", 0, 100, 5, "sleep", { effect: { heal: 0.5 } }),

  // ── fuoco ──
  scintilla:    M("Scintilla", "fire", 40, 100, 25, "orb", { lv: 1, effect: { burn: 0.1 } }),
  artigliardenti: M("Artigli Ardenti", "fire", 40, 100, 25, "claw", { lv: 1, effect: { burn: 0.1 } }),
  sbuffo:       M("Sbuffo di Brace", "fire", 65, 95, 15, "breath", { lv: 2, effect: { burn: 0.2 } }),
  fuocherello:  M("Fuocherello", "fire", 0, 100, 10, "aura", { lv: 2, effect: { self: { atk: 2 } } }),
  morsofuoco:   M("Zanne Ardenti", "fire", 60, 95, 15, "bite", { lv: 2, effect: { burn: 0.2 } }),
  scudofuoco:   M("Scudo di Fuoco", "fire", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 1, atk: 1 } } }),
  frustafiamme: M("Frusta di Fiamme", "fire", 70, 95, 15, "whip", { lv: 3, effect: { burn: 0.2 } }),
  sferafuoco:   M("Sfera di Fuoco", "fire", 75, 90, 10, "orb", { lv: 3, effect: { burn: 0.2 } }),
  caricarovente:M("Carica Rovente", "fire", 85, 90, 10, "dash", { lv: 4, effect: { burn: 0.2 } }),
  vampata:      M("Vampata", "fire", 90, 85, 5, "burst", { lv: 4, effect: { burn: 0.3 } }),
  zoccolomagma: M("Pestone di Magma", "fire", 100, 85, 8, "stomp", { lv: 5, effect: { burn: 0.3 } }),
  murofuoco:    M("Muro di Fuoco", "fire", 100, 85, 8, "wave", { lv: 5, effect: { burn: 0.3 } }),
  cometa:       M("Cometa Ardente", "fire", 120, 85, 5, "dash", { lv: 6, effect: { burn: 0.3, recoil: 0.3 } }),
  meteore:      M("Pioggia di Meteore", "fire", 120, 80, 5, "rain", { lv: 6, effect: { burn: 0.3 } }),

  // ── gelo ──
  brina:        M("Scheggia di Brina", "cold", 40, 100, 25, "orb", { lv: 1, effect: { foe: { spd: -1 }, chance: 0.2 } }),
  unghiegelo:   M("Unghie di Ghiaccio", "cold", 40, 100, 25, "claw", { lv: 1, effect: { foe: { spd: -1 }, chance: 0.1 } }),
  soffiogelo:   M("Soffio Gelido", "cold", 65, 95, 15, "breath", { lv: 2, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  mantobrina:   M("Manto di Brina", "cold", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 2 } } }),
  morsogelo:    M("Morso Gelido", "cold", 60, 95, 15, "bite", { lv: 2, effect: { stun: 0.1 } }),
  frustagelo:   M("Frusta di Ghiaccioli", "cold", 70, 95, 15, "whip", { lv: 3, effect: { stun: 0.1 } }),
  raggiogelo:   M("Raggio Gelido", "cold", 75, 90, 10, "beam", { lv: 3, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  pestoneglaciale: M("Pestone Glaciale", "cold", 85, 90, 10, "stomp", { lv: 4, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  grandine:     M("Grandinata", "cold", 90, 85, 5, "rain", { lv: 4, effect: { stun: 0.1 } }),
  valanga:      M("Carica Valanga", "cold", 100, 85, 8, "dash", { lv: 5, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  lancegelo:    M("Lance di Ghiaccio", "cold", 100, 85, 8, "spikes", { lv: 5, effect: { stun: 0.15 } }),
  zannepolari:  M("Zanne Polari", "cold", 115, 90, 5, "bite", { lv: 6, effect: { stun: 0.2 } }),
  bufera:       M("Bufera", "cold", 120, 80, 5, "breath", { lv: 6, effect: { foe: { spd: -1 }, chance: 0.5, stun: 0.1 } }),

  // ── acqua ──
  spruzzo:      M("Getto d'Acqua", "water", 40, 100, 25, "beam", { lv: 1 }),
  pinzetta:     M("Pinzetta", "water", 40, 100, 25, "claw", { lv: 1 }),
  bolla:        M("Bollicine", "water", 60, 95, 15, "orb", { lv: 2, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  inchiostro:   M("Spruzzo d'Inchiostro", "water", 0, 90, 10, "cloud", { lv: 2, effect: { foe: { atk: -1, spd: -1 } } }),
  barriera:     M("Barriera d'Acqua", "water", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 2 } } }),
  codaspuma:    M("Coda Spumeggiante", "water", 55, 100, 20, "whip", { lv: 2 }),
  pioggia:      M("Pioggerella", "water", 0, 100, 5, "heal", { lv: 3, effect: { heal: 0.4 } }),
  morsoabissale:M("Morso Abissale", "water", 70, 95, 15, "bite", { lv: 3, effect: { foe: { def: -1 }, chance: 0.2 } }),
  bollagigante: M("Bolla Gigante", "water", 75, 90, 10, "orb", { lv: 3, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  tuffo:        M("Tuffo a Bomba", "water", 85, 90, 10, "stomp", { lv: 4 }),
  ondata:       M("Ondata", "water", 90, 85, 5, "wave", { lv: 4 }),
  siluro:       M("Siluro", "water", 100, 85, 8, "dash", { lv: 5 }),
  vortice:      M("Vortice", "water", 100, 85, 8, "curse", { lv: 5, effect: { stun: 0.2 } }),
  morsakraken:  M("Morsa del Kraken", "water", 115, 90, 5, "bite", { lv: 6, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  maremoto:     M("Maremoto", "water", 120, 80, 5, "wave", { lv: 6 }),

  // ── fulmine ──
  scarica:      M("Scarica", "lightning", 40, 100, 25, "orb", { lv: 1, effect: { stun: 0.1 } }),
  graffioelettrico: M("Graffio Elettrico", "lightning", 40, 100, 25, "claw", { lv: 1, effect: { stun: 0.1 } }),
  scossa:       M("Scossetta", "lightning", 60, 95, 15, "bolt", { lv: 2, effect: { stun: 0.2 } }),
  caricastatica:M("Carica Statica", "lightning", 0, 100, 10, "aura", { lv: 2, effect: { self: { spd: 2 } } }),
  saetta:       M("Saetta", "lightning", 45, 100, 20, "beam", { lv: 2, prio: 1 }),
  morsovoltaico:M("Morso Voltaico", "lightning", 60, 95, 15, "bite", { lv: 2, effect: { stun: 0.15 } }),
  campostatico: M("Campo Statico", "lightning", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 1, spd: 1 } } }),
  frustaelettrica: M("Frusta Elettrica", "lightning", 70, 95, 15, "whip", { lv: 3, effect: { stun: 0.2 } }),
  sferatonante: M("Sfera Tonante", "lightning", 75, 90, 10, "orb", { lv: 3, effect: { stun: 0.2 } }),
  scattofulmineo: M("Scatto Fulmineo", "lightning", 80, 95, 10, "dash", { lv: 4, prio: 1 }),
  fulmine:      M("Fulmine", "lightning", 90, 85, 5, "bolt", { lv: 4, effect: { stun: 0.3 } }),
  pestonetonante: M("Pestone Tonante", "lightning", 100, 85, 8, "stomp", { lv: 5, effect: { stun: 0.2 } }),
  catenafulmini:M("Catena di Fulmini", "lightning", 100, 85, 8, "beam", { lv: 5, effect: { stun: 0.2 } }),
  caricatuono:  M("Carica del Tuono", "lightning", 120, 85, 5, "dash", { lv: 6, effect: { stun: 0.3, recoil: 0.3 } }),
  tempesta:     M("Tempesta", "lightning", 120, 80, 5, "bolt", { lv: 6, effect: { stun: 0.3 } }),

  // ── terra ──
  rametto:      M("Frusta di Rami", "earth", 40, 100, 25, "whip", { lv: 1 }),
  sassi:        M("Lancio di Sassi", "earth", 40, 100, 25, "orb", { lv: 1 }),
  spore:        M("Spore Sonnifere", "earth", 0, 75, 10, "cloud", { lv: 2, effect: { stun: 1 } }),
  linfa:        M("Succhia-linfa", "earth", 55, 100, 15, "drain", { lv: 2, effect: { drain: 0.5 } }),
  zampapietra:  M("Zampata di Pietra", "earth", 55, 100, 20, "stomp", { lv: 2 }),
  pellepietra:  M("Pelle di Pietra", "earth", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 2, def: 1 } } }),
  frustaspine:  M("Frusta di Spine", "earth", 70, 95, 15, "whip", { lv: 3, effect: { foe: { def: -1 }, chance: 0.2 } }),
  frana:        M("Franetta", "earth", 75, 90, 10, "rain", { lv: 3, effect: { stun: 0.1 } }),
  cornoroccia:  M("Corno di Roccia", "earth", 85, 90, 10, "dash", { lv: 4 }),
  spuntoni:     M("Spuntoni di Pietra", "earth", 85, 90, 10, "spikes", { lv: 4 }),
  terremoto:    M("Terremotino", "earth", 95, 85, 5, "stomp", { lv: 5 }),
  rovi:         M("Rovi Stritolanti", "earth", 100, 85, 8, "spikes", { lv: 5, effect: { foe: { spd: -1 }, chance: 0.5 } }),
  colosso:      M("Carica del Colosso", "earth", 120, 85, 5, "dash", { lv: 6, effect: { recoil: 0.3 } }),
  spaccaterra:  M("Spaccaterra", "earth", 120, 80, 5, "spikes", { lv: 6, effect: { stun: 0.2 } }),

  // ── acido ──
  sputoacido:   M("Sputo Acido", "acid", 40, 100, 25, "orb", { lv: 1, effect: { foe: { ac: -1 }, chance: 0.2 } }),
  artiglicorrosivi: M("Artigli Corrosivi", "acid", 40, 100, 25, "claw", { lv: 1, effect: { foe: { ac: -1 }, chance: 0.1 } }),
  spruzzoacido: M("Spruzzo Corrosivo", "acid", 65, 95, 15, "breath", { lv: 2, effect: { foe: { ac: -1 }, chance: 0.3 } }),
  melma:        M("Melma Appiccicosa", "acid", 0, 95, 15, "cloud", { lv: 2, effect: { foe: { spd: -2 } } }),
  morsoacido:   M("Morso Acido", "acid", 60, 95, 15, "bite", { lv: 2, effect: { foe: { ac: -1 }, chance: 0.2 } }),
  frustacaustica: M("Frusta Caustica", "acid", 70, 95, 15, "whip", { lv: 3, effect: { foe: { ac: -1 }, chance: 0.2 } }),
  bollacorrosiva: M("Bolla Corrosiva", "acid", 75, 90, 10, "orb", { lv: 3, effect: { foe: { ac: -1 }, chance: 0.3 } }),
  corazzamelma: M("Corazza di Melma", "acid", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 2 } } }),
  tonfo:        M("Tonfo Gelatinoso", "acid", 85, 90, 10, "stomp", { lv: 4, effect: { foe: { spd: -1 }, chance: 0.3 } }),
  bagnoacido:   M("Bagno d'Acido", "acid", 90, 85, 5, "burst", { lv: 4 }),
  caricamelmosa:M("Carica Melmosa", "acid", 100, 85, 8, "dash", { lv: 5, effect: { foe: { ac: -1 }, chance: 0.3 } }),
  pioggiaacida: M("Pioggia Acida", "acid", 100, 85, 8, "rain", { lv: 5, effect: { foe: { ac: -1 }, chance: 0.3 } }),
  faucidissolventi: M("Fauci Dissolventi", "acid", 115, 90, 5, "bite", { lv: 6, effect: { foe: { ac: -2 }, chance: 0.3 } }),
  geyseracido:  M("Geyser d'Acido", "acid", 120, 80, 5, "spikes", { lv: 6, effect: { foe: { ac: -1 }, chance: 0.5 } }),

  // ── veleno ──
  veleno:       M("Puntura Velenosa", "poison", 40, 100, 20, "sting", { lv: 1, effect: { poison: 0.3 } }),
  spruzzotossico: M("Spruzzo Tossico", "poison", 40, 100, 25, "orb", { lv: 1, effect: { poison: 0.2 } }),
  zannevelenose:M("Zanne Velenose", "poison", 60, 95, 15, "bite", { lv: 2, effect: { poison: 0.3 } }),
  nubetossica:  M("Nube Tossica", "poison", 0, 85, 10, "cloud", { lv: 2, effect: { poison: 1 } }),
  pelleviscida: M("Pelle Viscida", "poison", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 1, def: 1 } } }),
  codapungente: M("Coda Pungente", "poison", 70, 95, 15, "sting", { lv: 3, effect: { poison: 0.3 } }),
  soffiomefitico: M("Soffio Mefitico", "poison", 75, 90, 10, "breath", { lv: 3, effect: { poison: 0.3 } }),
  artigliinfetti: M("Artigli Infetti", "poison", 85, 90, 10, "claw", { lv: 4, effect: { poison: 0.3 } }),
  fiotto:       M("Fiotto di Veleno", "poison", 90, 85, 5, "beam", { lv: 4, effect: { poison: 0.3 } }),
  pungiglione:  M("Pungiglione Letale", "poison", 100, 85, 8, "sting", { lv: 5, effect: { poison: 0.4 } }),
  palude:       M("Palude Venefica", "poison", 100, 85, 8, "cloud", { lv: 5, effect: { poison: 0.4 } }),
  morsoviverna: M("Morso della Viverna", "poison", 120, 85, 5, "bite", { lv: 6, effect: { poison: 0.5 } }),
  miasma:       M("Miasma", "poison", 120, 80, 5, "burst", { lv: 6, effect: { poison: 0.5 } }),

  // ── necrotico ──
  luminotetro:  M("Lumino Tetro", "necrotic", 40, 100, 25, "orb", { lv: 1, effect: { foe: { atk: -1 }, chance: 0.1 } }),
  graffiospettrale: M("Graffio Spettrale", "necrotic", 45, 100, 25, "claw", { lv: 1 }),
  toccotetro:   M("Tocco Tetro", "necrotic", 50, 100, 20, "drain", { lv: 2, effect: { drain: 0.5 } }),
  maledizione:  M("Maledizione", "necrotic", 0, 90, 10, "curse", { lv: 2, effect: { foe: { atk: -1, def: -1 } } }),
  colpossa:     M("Colpo d'Ossa", "necrotic", 55, 100, 20, "stomp", { lv: 2 }),
  armaturaossa: M("Armatura d'Ossa", "necrotic", 0, 100, 10, "aura", { lv: 3, effect: { self: { ac: 2 } } }),
  morso:        M("Morso Oscuro", "necrotic", 70, 95, 15, "bite", { lv: 3, effect: { foe: { def: -1 }, chance: 0.3 } }),
  raggiosinistro: M("Raggio Sinistro", "necrotic", 65, 95, 15, "beam", { lv: 3 }),
  frustaombra:  M("Frusta d'Ombra", "necrotic", 85, 90, 10, "whip", { lv: 4, effect: { foe: { def: -1 }, chance: 0.2 } }),
  mietitura:    M("Mietitura", "necrotic", 90, 85, 5, "burst", { lv: 4 }),
  falcespettrale: M("Falce Spettrale", "necrotic", 100, 85, 8, "claw", { lv: 5 }),
  prosciugare:  M("Prosciugare Vita", "necrotic", 95, 90, 8, "drain", { lv: 5, effect: { drain: 0.5 } }),
  dannati:      M("Carica dei Dannati", "necrotic", 120, 85, 5, "dash", { lv: 6, effect: { recoil: 0.25 } }),
  ditomorte:    M("Dito della Morte", "necrotic", 120, 80, 5, "curse", { lv: 6 }),

  // ── radioso ──
  luccichio:    M("Luccichio", "radiant", 45, 100, 25, "orb", { lv: 1, effect: { foe: { atk: -1 }, chance: 0.2 } }),
  artigliluce:  M("Artiglio di Luce", "radiant", 40, 100, 25, "claw", { lv: 1 }),
  aureola:      M("Aureola", "radiant", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 1, atk: 1 } } }),
  scudofede:    M("Scudo della Fede", "radiant", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 2 } } }),
  cornosplendente: M("Corno Splendente", "radiant", 55, 100, 20, "dash", { lv: 2 }),
  benedizione:  M("Benedizione", "radiant", 0, 100, 5, "heal", { lv: 3, effect: { heal: 0.5 } }),
  frustaluce:   M("Frusta di Luce", "radiant", 70, 95, 15, "whip", { lv: 3, effect: { foe: { atk: -1 }, chance: 0.2 } }),
  raggio:       M("Raggio Sacro", "radiant", 80, 90, 10, "beam", { lv: 3 }),
  morsosacro:   M("Morso Sacro", "radiant", 85, 90, 10, "bite", { lv: 4 }),
  lucesplosione:M("Esplosione di Luce", "radiant", 90, 85, 5, "burst", { lv: 4, effect: { stun: 0.1 } }),
  caricaceleste:M("Carica Celeste", "radiant", 100, 85, 8, "dash", { lv: 5 }),
  colonnaluce:  M("Colonna di Luce", "radiant", 100, 85, 8, "bolt", { lv: 5 }),
  giudizio:     M("Giudizio", "radiant", 120, 85, 5, "stomp", { lv: 6, effect: { stun: 0.2 } }),
  raggiosolare: M("Raggio Solare", "radiant", 120, 80, 5, "beam", { lv: 6 }),

  // ── psichico ──
  ondamentale:  M("Onda Mentale", "psychic", 45, 100, 25, "wave", { lv: 1 }),
  zampapsichica:M("Zampata Psichica", "psychic", 40, 100, 25, "stomp", { lv: 1 }),
  concentrazione: M("Concentrazione", "psychic", 0, 100, 10, "aura", { lv: 2, effect: { self: { atk: 2 } } }),
  scudomentale: M("Scudo Mentale", "psychic", 0, 100, 10, "aura", { lv: 2, effect: { self: { ac: 2 } } }),
  morsoillusorio: M("Morso Illusorio", "psychic", 55, 100, 20, "bite", { lv: 2 }),
  ipnosi:       M("Ipnosi", "psychic", 0, 75, 10, "curse", { lv: 3, effect: { stun: 1 } }),
  urlopsichico: M("Urlo Psichico", "psychic", 65, 95, 15, "wave", { lv: 3, effect: { foe: { atk: -1 }, chance: 0.3 } }),
  artiglifantasma: M("Artigli Fantasma", "psychic", 70, 95, 15, "claw", { lv: 3 }),
  telecinesi:   M("Carica Telecinetica", "psychic", 85, 90, 10, "dash", { lv: 4 }),
  sguardo:      M("Sguardo Malefico", "psychic", 85, 85, 5, "beam", { lv: 4, effect: { stun: 0.2 } }),
  frustamentale:M("Frusta Mentale", "psychic", 100, 85, 8, "whip", { lv: 5, effect: { stun: 0.2 } }),
  sferapsionica:M("Sfera Psionica", "psychic", 100, 85, 8, "orb", { lv: 5, effect: { foe: { atk: -1 }, chance: 0.3 } }),
  schiantotele: M("Schianto Telecinetico", "psychic", 120, 85, 5, "stomp", { lv: 6 }),
  tempestapsi:  M("Tempesta Psichica", "psychic", 120, 80, 5, "curse", { lv: 6, effect: { stun: 0.2 } }),
};

/* ── GRADI DELLE MOSSE (2026-10-31) ─────────────────────────
   Ogni mossa imparabile ha un grado `lv` da 1 a 6 (come i livelli
   degli incantesimi). Il pet sblocca il grado g al livello
   MOVE_GRADES[g-1] e per ogni grado sbloccato impara UNA mossa a
   scelta (si può cambiare quando si vuole, fuori dalla lotta):
   - attacchi (forme fisiche) del SUO elemento o neutri;
   - incantesimi SOLO del suo elemento (un pet di fuoco non impara
     mai un incantesimo di gelo: servirà un oggetto, più avanti).
   In lotta porta MAX_MOVES mosse, scelte fra le innate sbloccate e
   quelle imparate. */
export const MOVE_GRADES = [1, 4, 8, 14, 22, 32];

/* ── TIRI ALLA D&D (2026-10-31) ─────────────────────────────
   Ogni attacco tira il d20: d20 + bonus per colpire contro la CA del
   bersaglio (20 naturale = critico, 1 naturale = mancato). Le mosse di
   stato sul nemico chiedono invece un tiro salvezza contro la CD di
   chi le lancia. Competenza e CA salgono insieme ogni 12 livelli,
   così la probabilità di colpire resta intorno al 70-75%.
   La precisione della mossa diventa un modificatore (100% = +2,
   90% = 0, 75% = −3). */
export const profOf = (level) => 2 + Math.floor((level || 1) / 12);
export const accMod = (acc) => Math.round(((acc ?? 90) - 90) / 5);
export function dndOf(speciesKey, level = 1) {
  const b = PET_DEX[speciesKey]?.base || { hp: 40, atk: 10, def: 10, spd: 10 };
  const prof = profOf(level);
  const atkMod = Math.round((b.atk - 9) / 2);
  const defMod = Math.round((b.def - 10) / 2);
  const ac = (PET_DEX[speciesKey]?.ac ?? 10 + Math.round((b.def - 8) / 2) + (b.spd >= 14 ? 1 : 0)) + Math.floor((level || 1) / 12);
  return { prof, atkMod, defMod, ac, toHit: prof + atkMod, save: Math.floor(prof / 2) + defMod, dcBase: 12 + prof + atkMod };
}
export const MAX_MOVES = 4;
export const GRADE_ROMAN = ["I", "II", "III", "IV", "V", "VI"];
const PHYS_FX = new Set(["stomp", "bite", "claw", "whip", "sting", "dash"]);
export const moveCat = (m) => (PHYS_FX.has(PET_DEX_MOVES[m]?.fx) ? "atk" : "spell");
export const gradeOfLevel = (level) => MOVE_GRADES.filter((l) => (level || 1) >= l).length;
// Mosse che la specie può imparare al grado g (le innate escluse).
export function learnPool(speciesKey, grade) {
  const sp = PET_DEX[speciesKey];
  if (!sp) return [];
  return Object.keys(PET_DEX_MOVES).filter((m) => {
    const mv = PET_DEX_MOVES[m];
    if (mv.lv !== grade || sp.moves.includes(m)) return false;
    if (mv.type === sp.type) return true;
    return mv.type === "neutral" && moveCat(m) === "atk";
  });
}

/* ── SPECIE ───────────────────────────────────────────────── */
const S = (key, name, icon, type, rarity, desc, look, base, moves, res = null) =>
  ({ key, name, icon, type, rarity, desc, look, base, moves, res });
const R = (resist = [], immune = [], vuln = []) => ({ resist, immune, vuln });

export const PET_DEX = {
  // ── ex iniziali, ora più rari (2026-10-31) ──
  brace: S("brace", "Brace", "🐲", "fire", "epic",
    "Cucciolo di drago rosso: sputa scintille quando è contento.",
    "a baby red dragon wyrmling, tiny chubby body, small stubby wings, big shiny eyes, little horns, smoke puffing from its nostrils",
    { hp: 46, atk: 13, def: 10, spd: 12 }, ["zampata", "scintilla", "sbuffo", "vampata"], R([], ["fire"])),
  tartadrago: S("tartadrago", "Tartadrago", "🐢", "water", "epic",
    "Tartaruga-drago appena uscita dal guscio: lenta, testarda, inaffondabile.",
    "a baby dragon turtle, round spiky blue-green shell, small dragon head with tiny fins, sleepy friendly face",
    { hp: 54, atk: 11, def: 14, spd: 7 }, ["morsetto", "spruzzo", "guscio", "ondata"], R(["fire"])),
  gufurso: S("gufurso", "Gufurso", "🦉", "earth", "rare",
    "Cucciolo di gufo-orso: abbracci fortissimi, piume ovunque.",
    "a baby owlbear cub, fluffy brown fur and feathers, owl face with big round eyes and a small beak, stubby bear paws",
    { hp: 52, atk: 14, def: 11, spd: 8 }, ["zampata", "rametto", "ruggitino", "terremoto"]),
  pseudodrago: S("pseudodrago", "Pseudodrago", "🐉", "poison", "rare",
    "Draghetto da spalla grande come un gatto: la coda punge e addormenta.",
    "a tiny pseudodragon, cat-sized slender reddish dragon with butterfly-like translucent wings, long curled tail with a stinger dripping a drop of purple venom, mischievous smile",
    { hp: 42, atk: 12, def: 9, spd: 15 }, ["scattino", "veleno", "nubetossica", "fiotto"]),
  gattombra: S("gattombra", "Gattombra", "🐈‍⬛", "psychic", "rare",
    "Gattino distorcente: lo vedi sempre un passo più in là di dov'è.",
    "a displacer beast kitten, dark blue-black panther kitten with six little legs and two soft tentacles on its back ending in pads, glowing violet eyes, shimmering illusory afterimage",
    { hp: 44, atk: 13, def: 10, spd: 13 }, ["graffio", "ondamentale", "ipnosi", "sguardo"]),

  // ── COMUNI ──
  mefitino: S("mefitino", "Mefitino", "😈", "fire", "starter",
    "Mefite di magma che gocciola lava e ride per niente.",
    "a tiny magma mephit, small impish creature made of cooling lava with glowing cracks, little bat wings, cheeky grin",
    { hp: 40, atk: 12, def: 9, spd: 12 }, ["scintilla", "graffio", "fuocherello", "sbuffo"], R([], ["fire", "poison"])),
  cubetto: S("cubetto", "Cubetto", "🧊", "acid", "starter",
    "Cubo gelatinoso grande come un dado: dentro ha sempre una moneta.",
    "a small gelatinous cube, translucent wobbly lime-green acidic jelly cube with a tiny coin and a little bone floating inside, two cute dot eyes, tiny acid bubbles",
    { hp: 58, atk: 10, def: 12, spd: 5 }, ["sputoacido", "ingoiare", "guscio", "bagnoacido"]),
  funghetto: S("funghetto", "Funghetto", "🍄", "earth", "starter",
    "Miconide bambino: comunica a sbuffi di spore profumate.",
    "a baby myconid, small walking mushroom person with a spotted purple cap, stubby legs and arms, sleepy eyes, puffs of spores",
    { hp: 46, atk: 10, def: 11, spd: 7 }, ["rametto", "spore", "linfa", "pisolino"]),
  saltello: S("saltello", "Saltello", "🐕", "radiant", "starter",
    "Cucciolo di cane intermittente: sparisce e ricompare per giocare.",
    "a blink dog puppy, golden fey puppy with big ears, sparkles of light around it as it teleports, happy tongue out",
    { hp: 42, atk: 11, def: 9, spd: 15 }, ["scattino", "luccichio", "aureola", "lucesplosione"]),
  diavoletto: S("diavoletto", "Diavoletto", "👿", "necrotic", "common",
    "Imp dispettoso che firma contratti col pennarello.",
    "a tiny imp, small red devil with little horns, bat wings, a pointed tail, holding a tiny scroll, wisps of dark smoke, smug smile",
    { hp: 40, atk: 12, def: 9, spd: 13 }, ["graffio", "toccotetro", "maledizione", "raggiosinistro"], R(["cold"], ["fire", "poison"])),
  scrignetto: S("scrignetto", "Scrignetto", "🧰", "acid", "common",
    "Mimic cucciolo: finge di essere un portagioie. Morde le dita.",
    "a baby mimic shaped like a small wooden treasure chest, open lid showing tiny teeth and a long pink sticky tongue dripping green goo, two little eyes on the lid",
    { hp: 52, atk: 12, def: 13, spd: 6 }, ["morsetto", "sputoacido", "melma", "spruzzoacido"], R([], ["acid"])),
  yetino: S("yetino", "Yetino", "🐻‍❄️", "cold", "starter",
    "Cucciolo di yeti: si rotola nella neve e ne esce più grosso.",
    "a baby yeti, round fluffy white fur ball with small blue face, tiny horns, big feet, snowflakes around",
    { hp: 52, atk: 12, def: 12, spd: 7 }, ["zampata", "brina", "mantobrina", "grandine"], R([], ["cold"])),
  brinello: S("brinello", "Brinello", "❄️", "cold", "common",
    "Mefite del ghiaccio: starnutisce fiocchi di neve.",
    "a tiny ice mephit, small impish creature made of icy blue crystal, frosty wings, icicle horns, sneezing a snowflake",
    { hp: 40, atk: 12, def: 9, spd: 13 }, ["brina", "scattino", "soffiogelo", "morsogelo"], R([], ["cold", "poison"], ["bludgeoning", "fire"])),
  granchietto: S("granchietto", "Granchietto", "🦀", "water", "starter",
    "Granchio gigante, ma non ancora. Pizzica tutto quello che luccica.",
    "a baby giant crab, round shiny red-blue shell, oversized claws, eyes on stalks, bubbles around it",
    { hp: 48, atk: 12, def: 14, spd: 6 }, ["graffio", "bolla", "guscio", "ondata"]),
  ragnetto: S("ragnetto", "Ragnetto", "🕷️", "poison", "starter",
    "Ragno gigante neonato: otto occhi, otto zampe, otto volte coccolone.",
    "a baby giant spider, fuzzy round dark purple body, eight big shiny eyes, stubby legs, tiny fangs dripping green venom",
    { hp: 42, atk: 12, def: 10, spd: 13 }, ["zannevelenose", "scattino", "melma", "nubetossica"]),
  scheletrino: S("scheletrino", "Scheletrino", "🦴", "necrotic", "starter",
    "Cucciolo di scheletro: porta l'osso, ma è il suo.",
    "a skeleton puppy, small undead dog made of white bones with a big round skull, ghostly green glow in the eye sockets, wagging bony tail",
    { hp: 44, atk: 12, def: 11, spd: 11 }, ["morsetto", "toccotetro", "ruggitino", "morso"], R([], ["poison"], ["bludgeoning"])),

  behirino: S("behirino", "Behirino", "🐍", "lightning", "starter",
    "Behir neonato: un serpentone con dodici zampette che sputa scintille.",
    "a baby behir, small long blue serpentine lizard with many tiny stubby legs, little curved horns, crackling small lightning sparks from its mouth, big friendly eyes",
    { hp: 44, atk: 12, def: 10, spd: 13 }, ["morsetto", "scarica", "caricastatica", "scossa"], R([], ["lightning"])),
  flumphino: S("flumphino", "Flumphino", "🪼", "psychic", "starter",
    "Flumph cucciolo: una medusa volante gentile che sente i pensieri. E si offende.",
    "a baby flumph, small floating pale jellyfish-like creature with a round disc body, little tendrils hanging below, two eyestalks on top, soft pink psychic glow, gentle smile",
    { hp: 46, atk: 11, def: 11, spd: 12 }, ["ondamentale", "scattino", "concentrazione", "urlopsichico"], R([], [], ["psychic"])),

  // ── RARI ──
  salamandrina: S("salamandrina", "Salamandrina", "🦎", "fire", "rare",
    "Salamandra di fuoco: la coda brucia come una candela.",
    "a baby fire salamander, small orange-red serpentine lizard with a flaming tail and fiery spines along its back, bright eyes",
    { hp: 46, atk: 15, def: 10, spd: 13 }, ["scintilla", "morsofuoco", "sbuffo", "vampata"], R([], ["fire"], ["cold"])),
  krakino: S("krakino", "Krakino", "🐙", "water", "rare",
    "Kraken neonato: otto tentacoli, zero buone maniere.",
    "a baby kraken, small round squid-octopus with many curly tentacles, huge curious eyes, deep teal and purple colors",
    { hp: 56, atk: 13, def: 12, spd: 9 }, ["spruzzo", "inchiostro", "bolla", "ondata"], R([], ["lightning"])),
  ruggine: S("ruggine", "Ruggine", "🐜", "acid", "rare",
    "Mostro della ruggine piccolo: si mangia le forchette di nascosto.",
    "a baby rust monster, insect-like creature with a rusty orange armored body, two long feathery antennae, wagging tail like a puppy, flakes of rust",
    { hp: 50, atk: 14, def: 14, spd: 9 }, ["morsetto", "sputoacido", "spruzzoacido", "bagnoacido"]),
  turbino: S("turbino", "Turbino", "🌪️", "lightning", "rare",
    "Elementale della tempesta in miniatura: un mulinello che fa scintille.",
    "a tiny storm elemental, a small swirling whirlwind of pale blue air crackling with little lightning sparks, two cute eyes",
    { hp: 42, atk: 14, def: 9, spd: 17 }, ["saetta", "scarica", "caricastatica", "fulmine"], R(["lightning"], ["poison"])),
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
    { hp: 50, atk: 16, def: 11, spd: 13 }, ["morsofuoco", "ruggitino", "sbuffo", "vampata"], R([], ["fire"])),
  lupogelo: S("lupogelo", "Lupogelo", "🐺", "cold", "rare",
    "Cucciolo di lupo invernale: ulula e la brina si posa sugli alberi.",
    "a winter wolf pup, fluffy snow-white wolf cub with icy blue eyes, frosty breath, little icicles on its fur",
    { hp: 50, atk: 15, def: 11, spd: 14 }, ["morsogelo", "ruggitino", "soffiogelo", "grandine"], R([], ["cold"])),
  gocciolo: S("gocciolo", "Gocciolo", "💧", "water", "rare",
    "Stranezza dell'acqua: una goccia viva che si offende se la bevi.",
    "a tiny water weird, a living droplet of clear blue water shaped like a little serpent with a big drop head, two shiny eyes, small splashes",
    { hp: 50, atk: 13, def: 12, spd: 12 }, ["spruzzo", "bolla", "pioggia", "ondata"], R(["fire"], ["poison"])),
  fuocofatuo: S("fuocofatuo", "Fuocofatuo", "🔆", "lightning", "rare",
    "Fuoco fatuo: una lucina elettrica che ti porta dove non dovresti.",
    "a will-o'-wisp, small floating ball of pale blue-yellow electric light with a cute face, crackling little sparks, faint glowing trail",
    { hp: 40, atk: 15, def: 9, spd: 17 }, ["scarica", "saetta", "scossa", "fulmine"], R(["acid", "cold", "fire", "necrotic"], ["lightning", "poison"])),
  otyughino: S("otyughino", "Otyughino", "🗑️", "poison", "rare",
    "Otyugh piccolo: vive nei rifiuti e li trova deliziosi.",
    "a baby otyugh, round lumpy greenish-brown blob creature on three stubby legs, two little tentacles, one eye on a stalk, big toothy grin, stink lines",
    { hp: 58, atk: 14, def: 13, spd: 7 }, ["zannevelenose", "ingoiare", "nubetossica", "fiotto"]),
  fantasmino: S("fantasmino", "Fantasmino", "👻", "necrotic", "rare",
    "Fantasma giovane: fa \"buh\" e poi si scusa.",
    "a little ghost, small translucent pale green spirit with a wispy tail, big sad-cute eyes, ghostly chains as a tiny bracelet",
    { hp: 44, atk: 15, def: 12, spd: 12 }, ["toccotetro", "maledizione", "raggiosinistro", "mietitura"], R(["acid", "fire", "lightning"], ["cold", "necrotic", "poison"])),

  // ── EPICI ──
  squalterra: S("squalterra", "Squalterra", "🦈", "earth", "epic",
    "Bulette cucciolo: nuota nel terreno come uno squalo nel mare.",
    "a baby bulette (landshark), armored blue-grey shell plates, shark-like head with a small fin on its back, stubby clawed legs, bursting out of the ground",
    { hp: 58, atk: 17, def: 15, spd: 9 }, ["morsetto", "frana", "testata", "terremoto"]),
  piumaserpe: S("piumaserpe", "Piumaserpe", "🪶", "radiant", "epic",
    "Couatl neonato: serpente piumato che sa sempre la verità.",
    "a baby couatl, small feathered serpent with rainbow feathered wings, golden scales, gentle wise eyes, soft holy glow",
    { hp: 50, atk: 15, def: 12, spd: 15 }, ["luccichio", "benedizione", "raggio", "lucesplosione"], R(["radiant"])),
  nevischio: S("nevischio", "Nevischio", "🐲", "cold", "epic",
    "Cucciolo di drago bianco: morde i ghiaccioli come caramelle.",
    "a baby white dragon wyrmling, chubby icy-white dragon with pale blue frills, small frosty wings, big eyes, frost crystals on its horns",
    { hp: 54, atk: 16, def: 13, spd: 13 }, ["brina", "morsogelo", "soffiogelo", "grandine"], R([], ["cold"])),
  saettino: S("saettino", "Saettino", "🐉", "lightning", "epic",
    "Cucciolo di drago blu: ogni starnuto è un piccolo temporale.",
    "a baby blue dragon wyrmling, chubby sapphire-blue dragon with a single small horn on its nose, tiny wings, little lightning sparks crackling around",
    { hp: 52, atk: 17, def: 12, spd: 14 }, ["scarica", "morsetto", "scossa", "fulmine"], R([], ["lightning"])),
  girino: S("girino", "Girino", "🦑", "psychic", "epic",
    "Girino di mind flayer, ma buono. Dice. Legge i pensieri a voce alta.",
    "a cute baby mind flayer tadpole, small purple-pink wiggly tadpole with four tiny face tentacles, huge glossy white eyes, glowing psychic aura",
    { hp: 48, atk: 17, def: 11, spd: 14 }, ["ondamentale", "concentrazione", "urlopsichico", "sguardo"]),

  // ── LEGGENDARI ──
  tarrasquino: S("tarrasquino", "Tarrasquino", "🦖", "earth", "legendary",
    "Il Tarrasque, ma in miniatura. Per ora. Mangia di tutto.",
    "a baby tarrasque, small chunky purple-green reptile kaiju with a spiked shell back, two forward horns, tiny claws, big hungry mouth, adorable",
    { hp: 64, atk: 18, def: 16, spd: 10 }, ["morsetto", "ruggitino", "testata", "terremoto"], R(["bludgeoning", "piercing", "slashing"], ["fire", "poison"])),
  lichetto: S("lichetto", "Lichetto", "☠️", "necrotic", "legendary",
    "Un lich piccolissimo col filatterio a forma di ciuccio.",
    "a tiny chibi lich, small skeletal sorcerer in oversized tattered purple robes and a little golden crown, glowing green eyes, holding a tiny phylactery like a pacifier, necrotic green wisps",
    { hp: 56, atk: 19, def: 14, spd: 13 }, ["raggiosinistro", "maledizione", "toccotetro", "mietitura"], R(["cold", "lightning", "necrotic"], ["poison"])),
};

export const PET_DEX_ORDER = Object.keys(PET_DEX);
// Ordinati per elemento (un iniziale comune per ogni elemento).
export const STARTERS = PET_DEX_ORDER.filter((k) => PET_DEX[k].rarity === "starter")
  .sort((a, b) => ELEMENTS.indexOf(PET_DEX[a].type) - ELEMENTS.indexOf(PET_DEX[b].type));

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
