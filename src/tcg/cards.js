/* ============================================================
   TCG — CARD DATA  (Italian, D&D themed)  — MAGIC-STYLE MANA
   ------------------------------------------------------------
   Six elements, matching the art in /public/card_cover:
     fire · water · light · darkness · air · nature

   Mana works like Magic:
   • Land cards (one "Fonte" per element) tap for 1 mana of
     that element. You may play at most 1 land per turn; lands
     stay on the battlefield and untap at the start of your turn.
   • Every other card has a COLORED cost, e.g. {nature:1, generic:2}.
     Colored pips must be paid with that element's mana; generic
     pips may be paid with any element's mana.
   • Unspent mana empties at end of turn (lands simply untap next
     turn — there is no stored pool).

   Card shape
   ----------
   {
     id, name,
     type: "creature" | "spell" | "artifact" | "land",
     element,                    // one of the 6 elements
     cost: { generic, fire, water, light, darkness, air, nature },
     cmc,                        // converted cost = sum of all pips
     art, icon,
     power, toughness,           // creatures only
     text, flavor,
     effect:  { kind, amount, target },   // spells
     passive: { kind, p, t, amount },     // artifacts
     produces,                   // lands only — element it taps for
   }
   ============================================================ */

export const ELEMENTS = ["fire", "water", "light", "darkness", "air", "nature"];

export const ELEMENT_LABEL = {
  fire: "Fuoco",
  water: "Acqua",
  light: "Luce",
  darkness: "Tenebra",
  air: "Aria",
  nature: "Natura",
};

export const ELEMENT_ICON = {
  fire: "🔥",
  water: "💧",
  light: "✨",
  darkness: "🌑",
  air: "🌪️",
  nature: "🍃",
};

/* pip / mana-gem colour per element */
export const ELEMENT_PIP = {
  fire: "#e0552f",
  water: "#2b8fe0",
  light: "#e9c75a",
  darkness: "#8a5cff",
  air: "#38c6c6",
  nature: "#5fbf4c",
};

export const TYPE_COLOR = {
  creature: "#7a3d17",
  spell: "#1d5790",
  artifact: "#9a7516",
  land: "#3a3a3a",
};

/* spell-burst colours, keyed by element */
export const ELEMENT_FX = {
  fire:     { glow: "#ff7a2a", spark: "#ffd07a" },
  water:    { glow: "#4fb8ff", spark: "#bfe9ff" },
  light:    { glow: "#ffe9a8", spark: "#ffffff" },
  darkness: { glow: "#9b5cff", spark: "#d9b8ff" },
  air:      { glow: "#48e0d4", spark: "#bff7f2" },
  nature:   { glow: "#5fd16a", spark: "#c8f5cc" },
};

/* ============================================================
   RARITY — 5 tiers, shown as a small coloured dot on the card.
   Pack odds fall off steeply for the higher tiers.
   ============================================================ */
export const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
export const RARITY_LABEL = {
  common: "Comune",
  uncommon: "Non comune",
  rare: "Rara",
  epic: "Epica",
  legendary: "Leggendaria",
};
export const RARITY_COLOR = {
  common: "#b9b9b9",
  uncommon: "#54c45a",
  rare: "#4a9fe6",
  epic: "#b061e0",
  legendary: "#ff5a1f", /* rosso/arancio */
};
/* pack pull weights (higher tier = rarer) — kept for any legacy use */
export const RARITY_WEIGHT = {
  common: 46, uncommon: 27, rare: 16, epic: 8, legendary: 3,
};

/* FIXED pack odds — identical for every element so the displayed
   percentages are exact. Premium packs (light / darkness) have a
   LOWER legendary chance (rolled into epic). Each table sums to 1. */
export const RARITY_ODDS = {
  common: 0.42, uncommon: 0.30, rare: 0.17, epic: 0.08, legendary: 0.03,
};
export const RARITY_ODDS_PREMIUM = {
  common: 0.42, uncommon: 0.30, rare: 0.17, epic: 0.105, legendary: 0.005,
};
/* every drawn card has this tiny independent chance to be FOIL */
export const FOIL_CHANCE = 0.02;

const LEGENDARY_IDS = new Set([
  "reddragon", "lich", "balor", "kraken", "solar", "mummylord",
]);
const RARITY_BY_SPELL = {
  s_meteor: "epic", s_disintegrate: "rare", s_raise: "rare",
  s_fireball: "rare", s_shockwave: "rare", s_bless: "uncommon",
  s_vision: "uncommon", s_bolt: "common", s_missile: "common",
  s_heal: "common",
  // instants
  s_shock: "common", s_counter: "rare", s_fog: "uncommon",
  s_growth: "uncommon", s_rescue: "common",
};
/* spells that can be cast at INSTANT speed (responses / combat tricks) */
const INSTANT_IDS = new Set([
  "s_bolt", "s_missile", "s_heal",     // existing → now instants
  "s_shock", "s_counter", "s_fog", "s_growth", "s_rescue",
]);
const RARITY_BY_ARTIFACT = {
  a_tome: "rare", a_valor: "rare", a_staff: "uncommon",
  a_blade: "uncommon", a_amulet: "uncommon", a_ring: "uncommon",
};

/* a rough "power level" used only to ORDER cards inside an element so
   the strongest ones land in the higher rarity tiers. */
const RAR_TIER_NUM = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
function strengthScore(card) {
  if (LEGENDARY_IDS.has(card.id)) return 1000;
  if (card.type === "spell")
    return 8 + RAR_TIER_NUM[RARITY_BY_SPELL[card.id] || "common"] * 6 + card.cmc;
  if (card.type === "artifact")
    return 8 + RAR_TIER_NUM[RARITY_BY_ARTIFACT[card.id] || "uncommon"] * 6 + card.cmc;
  // creatures: mana value weighs most, body adds a little
  return card.cmc * 6 + ((card.power || 0) + (card.toughness || 0));
}

/* Assign rarities PER ELEMENT so every colour owns at least one card of
   every tier (common → legendary). Cards are sorted weakest→strongest
   inside their element and split into the five tiers. */
function computeRarities(raw) {
  const out = {};
  const byEl = {};
  for (const c of raw) {
    if (c.type === "land") { out[c.id] = "common"; continue; }
    (byEl[c.element] ||= []).push(c);
  }
  // target share of each tier (must keep ≥1 of each per element)
  const SHARE = { common: 0.34, uncommon: 0.30, rare: 0.20, epic: 0.11, legendary: 0.05 };
  for (const el of Object.keys(byEl)) {
    const list = byEl[el].slice().sort(
      (a, b) => strengthScore(a) - strengthScore(b) || a.cmc - b.cmc
    );
    const n = list.length;
    // base count per tier, at least 1
    const counts = {};
    let used = 0;
    for (const r of RARITY_ORDER) {
      counts[r] = Math.max(1, Math.round(n * SHARE[r]));
      used += counts[r];
    }
    // reconcile rounding so the counts sum to exactly n
    let diff = n - used;
    const adjOrder = ["common", "uncommon", "rare", "epic", "legendary"];
    while (diff !== 0) {
      for (const r of adjOrder) {
        if (diff === 0) break;
        if (diff > 0) { counts[r] += 1; diff -= 1; }
        else if (counts[r] > 1) { counts[r] -= 1; diff += 1; }
      }
    }
    // walk weakest→strongest filling common…legendary
    let i = 0;
    for (const r of RARITY_ORDER)
      for (let k = 0; k < counts[r] && i < n; k++, i++) out[list[i].id] = r;
    // force the canonical legendaries to legendary regardless
    for (const c of list) if (LEGENDARY_IDS.has(c.id)) out[c.id] = "legendary";
  }
  return out;
}

/* ---- cost derivation ----
   Turn a single converted cost + element into a Magic-style cost.
   CMC is preserved so the mana curve / balance is unchanged. */
function deriveCost(cmc, element) {
  const colored = { 0: 0, 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3 }[cmc] ?? Math.min(3, cmc);
  const cost = { generic: Math.max(0, cmc - colored) };
  if (colored > 0) cost[element] = colored;
  return cost;
}

export function cmcOf(cost) {
  let n = 0;
  for (const k in cost) n += cost[k] || 0;
  return n;
}

/* ordered list of colour requirements for display: e.g. [{el:'fire',n:2}] */
export function costPips(cost) {
  const pips = [];
  if (cost.generic) pips.push({ el: "generic", n: cost.generic });
  for (const el of ELEMENTS) if (cost[el]) pips.push({ el, n: cost[el] });
  return pips;
}

const C = (id, name, cmc, art, icon, element, power, toughness, text, flavor) => ({
  id, name, type: "creature", element,
  cost: deriveCost(cmc, element), cmc,
  art, icon, power, toughness, text, flavor,
});
const S = (id, name, cmc, icon, element, effect, text, flavor) => ({
  id, name, type: "spell", element,
  cost: deriveCost(cmc, element), cmc,
  art: null, icon, effect, text, flavor,
});
const A = (id, name, cmc, icon, element, passive, text, flavor) => ({
  id, name, type: "artifact", element,
  cost: deriveCost(cmc, element), cmc,
  art: null, icon, passive, text, flavor,
});
/* a basic land — taps for 1 mana of its element, free to play */
const L = (element) => ({
  id: "l_" + element,
  name: "Fonte di " + ELEMENT_LABEL[element],
  type: "land",
  element,
  cost: { generic: 0 },
  cmc: 0,
  art: null, // rendered from /card_cover/<element>.png
  icon: ELEMENT_ICON[element],
  produces: element,
  text: "Tocca: aggiungi 1 mana " + ELEMENT_LABEL[element] + ".",
  flavor: "",
});

export const LANDS = ELEMENTS.map(L);

const RAW = [
  /* ---------- LANDS (6) ---------- */
  ...LANDS,

  /* ---------- CREATURES — cmc 1 (8) ---------- */
  C("goblinscout", "Goblin Esploratore", 1, "goblinscout", "🗡️", "nature", 1, 1,
    "Veloce e vigliacco.", "Conosce ogni scorciatoia… e ogni via di fuga."),
  C("kobold", "Coboldo", 1, "kobold", "🦎", "fire", 1, 2,
    "", "In branco, anche un coboldo diventa un problema."),
  C("imp", "Diavoletto", 1, "imp", "👺", "fire", 2, 1,
    "", "Una scintilla con le ali e un pessimo carattere."),
  C("badger", "Tasso Gigante", 1, "badger", "🦡", "nature", 2, 1,
    "", "Piccolo, peloso, furibondo."),
  C("manes", "Mane", 1, "manes", "😈", "darkness", 1, 1,
    "", "Carne dell'Abisso, modellata in forma urlante."),
  C("quasit", "Quasit", 1, "quasit", "🦇", "darkness", 1, 2,
    "", "Un famiglio infernale dalla lingua biforcuta."),
  C("kenku", "Kenku Ladro", 1, "kenku", "🐦‍⬛", "air", 2, 1,
    "", "Ruba la tua voce prima ancora della borsa."),
  C("goblin", "Goblin", 1, "goblin", "👹", "nature", 1, 2,
    "", "Cattivo per natura, codardo per scelta."),

  /* ---------- CREATURES — cmc 2 (10) ---------- */
  C("goblinblade", "Goblin Lama", 2, "goblinblade", "🗡️", "nature", 3, 2,
    "", "Due pugnali, zero scrupoli."),
  C("direwolf", "Lupo Sinistro", 2, "direwolf", "🐺", "water", 3, 2,
    "", "La sua caccia finisce solo col sangue."),
  C("orc", "Orco Predone", 2, "orc", "🪓", "fire", 3, 3,
    "", "Brucia il villaggio, poi chiede perché urlano."),
  C("skeletonmage", "Mago Scheletro", 2, "skeletonmage", "💀", "darkness", 2, 3,
    "", "La morte non ha spento la sua sete di potere."),
  C("satyr", "Satiro", 2, "satyr", "🐐", "nature", 2, 3,
    "", "Suona, ride, e ti pugnala a tempo di musica."),
  C("dwarfpaladin", "Paladino Nano", 2, "dwarfpaladin", "🛡️", "light", 2, 4,
    "", "Fede d'acciaio, barba di ferro."),
  C("frostarcher", "Arciere del Gelo", 2, "frostarcher", "🏹", "water", 3, 2,
    "", "Le sue frecce mordono prima ancora di colpire."),
  C("zombie", "Zombi", 2, "zombie", "🧟", "darkness", 2, 4,
    "", "Lento, paziente, instancabile."),
  C("gnoll", "Gnoll Sanguinario", 2, "gnoll", "🐕", "darkness", 3, 2,
    "", "Ride mentre azzanna."),
  C("lizardfolk", "Uomo Lucertola", 2, "lizardfolk", "🦎", "nature", 2, 4,
    "", "La palude provvede ai suoi figli."),

  /* ---------- CREATURES — cmc 3 (10) ---------- */
  C("owlbear", "Orsogufo", 3, "owlbear", "🦉", "nature", 4, 4,
    "", "L'abbraccio peggiore della foresta."),
  C("centaur", "Centauro", 3, "centaur", "🐎", "nature", 4, 3,
    "", "Galoppa dove l'uomo non oserebbe camminare."),
  C("troll", "Troll", 3, "troll", "🧌", "nature", 3, 5,
    "", "Tagliane un braccio: ne ricresceranno due."),
  C("wight", "Spettro Mortale", 3, "wight", "👻", "darkness", 4, 3,
    "", "Tocca i vivi e li trascina con sé."),
  C("nightmare", "Incubo", 3, "nightmare", "🐴", "fire", 5, 2,
    "", "Cavalca chi non teme di bruciare."),
  C("warmonk", "Monaco Guerriero", 3, "warmonk", "👊", "light", 4, 3,
    "", "Il corpo è la sua unica arma. Basta e avanza."),
  C("manticore", "Manticora", 3, "manticore", "🦁", "fire", 4, 4,
    "", "Coda di spine, fame senza fine."),
  C("hellhound", "Mastino Infernale", 3, "hellhound", "🐕‍🦺", "fire", 4, 2,
    "", "Il suo fiato sa di cenere e dannazione."),
  C("medusa", "Medusa", 3, "medusa", "🐍", "darkness", 3, 5,
    "", "Incrocia il suo sguardo una volta sola."),
  C("peryton", "Peritone", 3, "peryton", "🦌", "air", 4, 3,
    "", "Proietta l'ombra di un uomo, il cuore di una bestia."),

  /* ---------- CREATURES — cmc 4 (10) ---------- */
  C("frostgiant", "Gigante del Gelo", 4, "frostgiant", "🧊", "water", 6, 5,
    "", "Cammina e l'inverno lo segue."),
  C("stonegiant", "Gigante di Pietra", 4, "stonegiant", "🗿", "nature", 4, 7,
    "", "Lancia massi come fossero ciottoli."),
  C("deathknight", "Cavaliere della Morte", 4, "deathknight", "⚔️", "darkness", 5, 5,
    "", "Il suo giuramento è sopravvissuto alla sua anima."),
  C("mindflayer", "Flagello Mentale", 4, "mindflayer", "🐙", "darkness", 4, 5,
    "", "Cena con i pensieri di chi osa pensare."),
  C("succubus", "Succube", 4, "succubus", "💋", "darkness", 4, 4,
    "", "Ti ama fino all'ultimo respiro. Il tuo."),
  C("copperdragon", "Drago di Rame", 4, "copperdragon", "🐉", "fire", 5, 5,
    "", "Scherza, poi incenerisce. In quest'ordine."),
  C("stormmage", "Mago della Tempesta", 4, "stormmage", "🌩️", "air", 5, 4,
    "", "Parla, e i cieli rispondono col fulmine."),
  C("irongolem", "Golem di Ferro", 4, "irongolem", "🤖", "nature", 4, 7,
    "", "Non dorme, non teme, non si arrende."),
  C("wraithpriest", "Sacerdote Spettrale", 4, "wraithpriest", "🕯️", "darkness", 5, 4,
    "", "Officia messe per dèi dimenticati."),
  C("nalfeshnee", "Nalfeshnee", 4, "nalfeshnee", "🐗", "darkness", 6, 4,
    "", "Vanità demoniaca incarnata in tonnellate di furia."),

  /* ---------- CREATURES — cmc 5 (6) ---------- */
  C("reddragon", "Drago Rosso", 5, "reddragon", "🐲", "fire", 7, 7,
    "", "L'avidità con le ali e un mare di fuoco."),
  C("lich", "Lich", 5, "lich", "☠️", "darkness", 6, 7,
    "", "Ha barattato l'anima per un'eternità di rancore."),
  C("balor", "Balor", 5, "balor", "🔥", "fire", 8, 5,
    "", "Frusta di fiamme, signore dell'Abisso."),
  C("kraken", "Kraken", 5, "kraken", "🐙", "water", 7, 8,
    "", "Le profondità hanno un nome, e ha otto braccia."),
  C("solar", "Solàr", 5, "solar", "😇", "light", 7, 7,
    "", "L'ira del Paradiso, vestita di luce."),
  C("mummylord", "Signore Mummia", 5, "mummylord", "🪦", "darkness", 5, 8,
    "", "Maledice chi disturba il suo sonno millenario."),

  /* ---------- SPELLS (10) ---------- */
  S("s_bolt", "Saetta", 1, "⚡", "air",
    { kind: "damage", amount: 3, target: "any" },
    "Infliggi 3 danni a una creatura o all'eroe nemico.",
    "Tre parole, un dito puntato, e il tuono."),
  S("s_missile", "Dardo Incantato", 1, "✨", "air",
    { kind: "damage", amount: 2, target: "any" },
    "Infliggi 2 danni a un bersaglio qualsiasi.",
    "Non manca mai. Mai."),
  S("s_heal", "Parola Curativa", 1, "💚", "light",
    { kind: "heal", amount: 5 },
    "Recuperi 5 Punti Vita.",
    "Una sillaba sussurrata, una ferita che si chiude."),
  S("s_fireball", "Palla di Fuoco", 3, "🔥", "fire",
    { kind: "damage", amount: 4, target: "any" },
    "Infliggi 4 danni a un bersaglio qualsiasi.",
    "La soluzione classica a problemi complicati."),
  S("s_shockwave", "Onda d'Urto", 3, "💥", "air",
    { kind: "aoe_enemy", amount: 3 },
    "Infliggi 3 danni a TUTTE le creature nemiche.",
    "Il terreno trema e l'orizzonte si piega."),
  S("s_disintegrate", "Disintegrazione", 3, "🟣", "darkness",
    { kind: "destroy", target: "creature" },
    "Distruggi una creatura bersaglio.",
    "Un lampo verde, e resta solo polvere."),
  S("s_bless", "Benedizione", 2, "🌟", "light",
    { kind: "buff", p: 2, t: 2, target: "friendly_creature" },
    "Una tua creatura ottiene +2/+2 in modo permanente.",
    "Gli dèi guardano, e per un istante sorridono."),
  S("s_vision", "Visione Arcana", 2, "🔮", "air",
    { kind: "draw", amount: 2 },
    "Peschi 2 carte.",
    "Il velo del futuro si apre, per chi sa leggere."),
  S("s_raise", "Rianima i Morti", 4, "🪬", "darkness",
    { kind: "raise" },
    "Rievoca una creatura a caso dal tuo cimitero.",
    "La morte è solo una pausa fra due battaglie."),
  S("s_meteor", "Meteora", 5, "☄️", "fire",
    { kind: "damage", amount: 6, target: "any" },
    "Infliggi 6 danni a un bersaglio qualsiasi.",
    "Il cielo presenta il conto."),

  /* ---------- INSTANT SPELLS (5) — giocabili a velocità istantanea ---------- */
  S("s_shock", "Scossa", 2, "⚡", "fire",
    { kind: "damage", amount: 3, target: "any" },
    "Istantaneo. Infliggi 3 danni a un bersaglio qualsiasi.",
    "Un crepitio, e l'aria sa di temporale."),
  S("s_counter", "Contromagia", 2, "🌀", "air",
    { kind: "counter" },
    "Istantaneo. Controbatti un incantesimo bersaglio nella pila.",
    "La parola muore prima di nascere."),
  S("s_fog", "Nebbia", 1, "🌫️", "nature",
    { kind: "fog" },
    "Istantaneo. Previeni TUTTI i danni da combattimento di questo turno.",
    "Tra la bruma, le lame non trovano la carne."),
  S("s_growth", "Crescita Improvvisa", 2, "🌱", "nature",
    { kind: "pump", p: 3, t: 3, target: "friendly_creature" },
    "Istantaneo. Una tua creatura ottiene +3/+3 fino a fine turno.",
    "La linfa esplode, e il piccolo diventa colosso."),
  S("s_rescue", "Soccorso Divino", 2, "🛡️", "light",
    { kind: "heal", amount: 6 },
    "Istantaneo. Recuperi 6 Punti Vita.",
    "All'ultimo istante, una mano di luce."),

  /* ---------- ARTIFACTS (6) ---------- */
  A("a_valor", "Stendardo di Valore", 3, "🚩", "light",
    { kind: "anthem", p: 1, t: 1 },
    "Le tue creature hanno +1/+1.",
    "Dove sventola, nessun cuore vacilla."),
  A("a_blade", "Lama Runica", 2, "🗡️", "air",
    { kind: "anthem", p: 1, t: 0 },
    "Le tue creature hanno +1/+0.",
    "Le rune cantano a ogni fendente."),
  A("a_amulet", "Amuleto della Salute", 2, "📿", "light",
    { kind: "startHeal", amount: 2 },
    "All'inizio del tuo turno, recuperi 2 PV.",
    "Pulsa piano, come un secondo cuore."),
  A("a_ring", "Anello di Rigenerazione", 3, "💍", "nature",
    { kind: "startHeal", amount: 3 },
    "All'inizio del tuo turno, recuperi 3 PV.",
    "Le ferite si chiudono come se non fossero mai esistite."),
  A("a_staff", "Bastone del Mago", 2, "🪄", "air",
    { kind: "startDraw", amount: 1 },
    "All'inizio del tuo turno, peschi 1 carta extra.",
    "Concentra il flusso del Weave in un solo punto."),
  A("a_tome", "Tomo Antico", 4, "📖", "air",
    { kind: "startDraw", amount: 1 },
    "All'inizio del tuo turno, peschi 1 carta extra.",
    "Ogni pagina sa qualcosa che tu non sai."),

  /* ---------- ILLUSTRATED CREATURES (from card art) ---------- */
  C("tideweaver", "Tessitrice delle Maree", 3, "tideweaver", "🌊", "water", 3, 3,
    "", "Le correnti danzano al ritmo delle sue dita."),
  C("geomancer", "Geomante", 4, "geomancer", "🪨", "nature", 3, 5,
    "", "La pietra obbedisce a chi sa ascoltarla."),
  C("arcanenova", "Nova Arcana", 4, "arcanenova", "💠", "air", 4, 3,
    "", "Un istante di pura magia, poi il silenzio."),
  C("graspingspirit", "Mano Spettrale", 3, "graspingspirit", "✋", "air", 2, 4,
    "", "Afferra ciò che i vivi non possono trattenere."),
  C("arcanecube", "Cubo Arcano", 2, "arcanecube", "🧊", "air", 1, 4,
    "", "Tutto ciò che tocca, lo conserva per sempre."),
  C("runicrevenant", "Spettro Runico", 4, "runicrevenant", "⚔️", "darkness", 5, 4,
    "", "Le rune lo legano al mondo dei vivi, suo malgrado."),
  C("runefist", "Pugno Runico", 2, "runefist", "👊", "air", 3, 2,
    "", "Colpisce prima che tu finisca di pensarci."),
  C("runebladespirit", "Spirito della Lama", 3, "runebladespirit", "🗡️", "nature", 4, 2,
    "", "La lama ricorda ogni mano che l'ha brandita."),
  C("soulbinder", "Vincolanima", 3, "soulbinder", "🌿", "darkness", 3, 3,
    "", "Raccoglie le ultime parole come fiori recisi."),
  C("ghostcaller", "Evocaspettri", 4, "ghostcaller", "👻", "water", 3, 4,
    "", "I morti rispondono sempre alla sua voce."),
  C("arcaneconclave", "Conclave Arcano", 5, "arcaneconclave", "🔮", "darkness", 5, 5,
    "", "Tre menti, un solo terribile pensiero."),
  C("farseer", "Veggente Abissale", 2, "farseer", "🌀", "water", 2, 3,
    "", "Guarda nell'acqua e vede ciò che sarà."),
  C("infernowarden", "Custode Infernale", 3, "infernowarden", "🔥", "fire", 4, 3,
    "", "Sorveglia la soglia da cui nulla ritorna."),
  C("crystalbeast", "Bestia di Cristallo", 3, "crystalbeast", "💎", "light", 3, 4,
    "", "Nata dove la luce si è fatta solida."),
  C("aurumdrake", "Drago Aureo", 5, "aurumdrake", "🐉", "light", 6, 6,
    "", "Il suo respiro è alba che incenerisce."),
  C("prismheart", "Cuore di Prisma", 4, "prismheart", "🔆", "water", 3, 5,
    "", "Spezzalo e si ricompone in mille schegge."),
  C("wraithserpent", "Serpe Spettrale", 3, "wraithserpent", "🐍", "darkness", 4, 2,
    "", "Striscia tra i sogni e li avvelena."),
  C("voidwraith", "Spettro del Vuoto", 4, "voidwraith", "🌑", "darkness", 4, 4,
    "", "Dove passa, resta solo l'assenza."),
  C("soulcomet", "Cometa d'Anime", 4, "soulcomet", "☄️", "air", 5, 3,
    "", "Cade portando con sé chi non vuole lasciarla."),
  C("emberlion", "Leone di Brace", 4, "emberlion", "🦁", "fire", 5, 4,
    "", "Ruggisce e la savana brucia."),
  C("duskfiend", "Demone del Crepuscolo", 5, "duskfiend", "😈", "darkness", 6, 5,
    "", "Nasce quando l'ultima luce si spegne."),
  C("tideelemental", "Elementale di Marea", 2, "tideelemental", "💧", "water", 2, 3,
    "", "L'oceano gli ha prestato una forma."),
  C("frostflamewarden", "Guardiano Gelofiamma", 4, "frostflamewarden", "❄️", "water", 4, 4,
    "", "Gelo e fuoco si tengono in equilibrio nel suo cuore."),
  C("sylvandrake", "Drago Silvano", 5, "sylvandrake", "🐲", "nature", 6, 6,
    "", "La foresta intera trattiene il respiro al suo passaggio."),
  C("emberspirit", "Spirito di Brace", 2, "emberspirit", "🔥", "fire", 3, 2,
    "", "Una scintilla che ha imparato a volere."),
  C("verdantflame", "Fiamma Verdeggiante", 3, "verdantflame", "🍃", "nature", 3, 4,
    "", "Brucia e fa germogliare nello stesso istante."),
  C("elderwood", "Antico Silvano", 4, "elderwood", "🌳", "nature", 4, 6,
    "", "Ricorda quando la foresta era un seme."),
  C("manacrystal", "Cristallo di Mana", 2, "manacrystal", "🔷", "water", 0, 5,
    "", "Pulsa piano, come un cuore di vetro."),
];

/* ============================================================
   KEYWORD / PASSIVE ABILITIES (D&D-inspired) — 14
   ============================================================ */
export const KEYWORDS = {
  defender:    { label: "Difensore",        desc: "Non può attaccare." },
  haste:       { label: "Furia",            desc: "Può attaccare e tappare appena evocata (niente fiacca)." },
  flying:      { label: "Volare",           desc: "Può essere bloccata solo da creature con Volare o Portata." },
  reach:       { label: "Portata",          desc: "Può bloccare creature con Volare." },
  deathtouch:  { label: "Tocco Letale",     desc: "Qualsiasi danno che infligge a una creatura la distrugge." },
  lifelink:    { label: "Legame Vitale",    desc: "I danni che infligge curano il tuo eroe della stessa quantità." },
  trample:     { label: "Travolgere",       desc: "Il danno da combattimento in eccesso colpisce l'eroe avversario." },
  firststrike: { label: "Attacco Improvviso", desc: "Infligge il danno da combattimento per primo." },
  vigilance:   { label: "Vigilanza",        desc: "Non si tappa quando attacca." },
  menace:      { label: "Minaccia",         desc: "Può essere bloccata solo da due o più creature." },
  shield:      { label: "Scudo Divino",     desc: "Previene la prima istanza di danno che subirebbe." },
  regen:       { label: "Rigenerazione",    desc: "La prima volta che morirebbe in un turno, sopravvive (danni azzerati)." },
  unblockable: { label: "Inafferrabile",    desc: "Non può essere bloccata." },
  hexproof:    { label: "Elusione",         desc: "Non può essere bersaglio di incantesimi avversari." },
};
export const KEYWORD_IDS = Object.keys(KEYWORDS);

/* thematic keywords for the original creatures */
const KEYWORDS_BY_ID = {
  reddragon: ["flying", "trample"],
  copperdragon: ["flying"],
  balor: ["flying", "trample"],
  solar: ["flying", "lifelink"],
  kraken: ["trample"],
  lich: ["deathtouch"],
  medusa: ["deathtouch"],
  mindflayer: ["hexproof"],
  frostgiant: ["trample"],
  irongolem: ["defender"],
  stonegiant: ["vigilance"],
  troll: ["regen"],
  mummylord: ["deathtouch"],
  nightmare: ["haste"],
  hellhound: ["haste"],
  direwolf: ["haste"],
  frostarcher: ["reach"],
  peryton: ["flying"],
  kenku: ["flying"],
  succubus: ["lifelink"],
  deathknight: ["firststrike"],
  warmonk: ["firststrike"],
  dwarfpaladin: ["vigilance"],
  manticore: ["flying"],
  wight: ["deathtouch"],
  gnoll: ["menace"],
  nalfeshnee: ["menace"],
  // illustrated set
  tideweaver: ["hexproof"],
  geomancer: ["vigilance"],
  arcanenova: ["haste"],
  graspingspirit: ["reach"],
  arcanecube: ["defender"],
  runicrevenant: ["deathtouch"],
  runefist: ["firststrike"],
  runebladespirit: ["firststrike"],
  soulbinder: ["lifelink"],
  ghostcaller: ["flying"],
  arcaneconclave: ["hexproof"],
  farseer: ["hexproof"],
  infernowarden: ["menace"],
  crystalbeast: ["shield"],
  aurumdrake: ["flying"],
  prismheart: ["regen"],
  wraithserpent: ["deathtouch"],
  voidwraith: ["unblockable"],
  soulcomet: ["trample"],
  emberlion: ["haste"],
  duskfiend: ["menace"],
  frostflamewarden: ["firststrike"],
  sylvandrake: ["trample"],
  emberspirit: ["haste"],
  verdantflame: ["regen"],
  elderwood: ["reach"],
  manacrystal: ["defender"],
};

/* element-aware rarity table (every colour gets all 5 tiers) */
const RARITY_BY_ID = computeRarities(RAW);

/* attach rarity + keywords to every card */
function finalize(card) {
  const c = { ...card };
  c.rarity = card.rarity || RARITY_BY_ID[card.id] || "common";
  if (c.type === "creature")
    c.keywords = card.keywords || KEYWORDS_BY_ID[card.id] || [];
  else c.keywords = [];
  if (c.type === "spell")
    c.speed = INSTANT_IDS.has(card.id) ? "instant" : "sorcery";
  return c;
}

/* card map + ordered non-land pool */
export const CARDS = Object.freeze(
  RAW.reduce((m, c) => { m[c.id] = Object.freeze(finalize(c)); return m; }, {})
);
export const POOL = Object.freeze(
  RAW.filter((c) => c.type !== "land").map((c) => c.id)
);

export const DECK_SIZE = 60;
const LAND_TARGET = 24; // ~40% of a 60-card deck

export function getCard(id) {
  return CARDS[id] || null;
}

export function isLand(id) {
  const c = getCard(id);
  return !!c && c.type === "land";
}

/* the 6 selectable cover images (live in /public/assets/card_cover) */
export const COVERS = ELEMENTS.slice();
export function coverUrl(name) {
  const n = ELEMENTS.includes(name) ? name : "air";
  return `/assets/card_cover/${n}.png`;
}

/* art for a card face. Lands show their own element cover. */
export function cardArtUrl(card) {
  if (!card) return null;
  if (card.type === "land") return coverUrl(card.element);
  return card.art ? `/assets/tgc_card/${card.art}.png` : null;
}

/* card back = the OWNER's chosen cover (deck pile + hidden hand) */
export function cardBackUrl(cover) {
  return coverUrl(cover);
}

/* Mulberry32 — small deterministic PRNG (seed optional). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, seed) {
  const a = arr.slice();
  const rnd = seed == null ? Math.random : mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Build a playable 60-card deck: ~36 spells/creatures + ~24 lands,
   with land colours weighted to the chosen cards' colour needs.
   (Phase 2's deck-builder will replace this default.) */
export function buildDeck(seed) {
  const rnd = seed == null ? Math.random : mulberry32(seed ^ 0x9e3779b9);
  const spells = shuffle(POOL, seed).slice(0, DECK_SIZE - LAND_TARGET);

  // colour weight from the chosen cards
  const weight = {};
  for (const el of ELEMENTS) weight[el] = 0;
  for (const id of spells) {
    const c = getCard(id);
    for (const el of ELEMENTS) if (c.cost[el]) weight[el] += c.cost[el];
  }
  const usedEls = ELEMENTS.filter((el) => weight[el] > 0);
  const totalW = usedEls.reduce((s, el) => s + weight[el], 0) || 1;

  // distribute land slots proportionally (min 2 of each used colour)
  const lands = [];
  let remaining = LAND_TARGET;
  for (const el of usedEls) {
    const n = Math.max(2, Math.round((weight[el] / totalW) * LAND_TARGET));
    for (let i = 0; i < n && remaining > 0; i++) { lands.push("l_" + el); remaining--; }
  }
  // top up / fill if rounding left gaps
  while (remaining > 0) {
    const el = usedEls.length
      ? usedEls[Math.floor(rnd() * usedEls.length)]
      : ELEMENTS[Math.floor(rnd() * ELEMENTS.length)];
    lands.push("l_" + el);
    remaining--;
  }

  return shuffle([...spells, ...lands], seed);
}
