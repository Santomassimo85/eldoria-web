/* ============================================================
   TCG — CARD DATA  (Italian, D&D themed)  — MAGIC-STYLE MANA
   ------------------------------------------------------------
   Six elements, matching the art in /public/card_cover:
     fire · water · light · darkness · nature

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
     cost: { generic, fire, water, light, darkness, nature },
     cmc,                        // converted cost = sum of all pips
     art, icon,
     power, toughness,           // creatures only
     text, flavor,
     effect:  { kind, amount, target },   // spells
     passive: { kind, p, t, amount },     // artifacts
     produces,                   // lands only — element it taps for
   }
   ============================================================ */

/* 5 elements (Fuoco / Acqua / Natura / Luce / Ombra). The legacy 6th
   "air" was distributed thematically across the other five in 2026-05-20
   (storm/lightning → Fuoco, arcane/runic → Luce, wind/control → Acqua,
   spirits → Ombra, beasts → Natura). */

// Class build-profile drives buildClassDeck. Defined in classes.js so
// collection.js (autoClassDeck) and cards.js (buildClassDeck = starter)
// share the same numbers.
import { buildProfileFor } from "./classes.js";

export const ELEMENTS = ["fire", "water", "light", "darkness", "nature"];

/* Display names — Italian, matching the class-system elements. */
export const ELEMENT_LABEL = {
  fire:     "Fuoco",
  water:    "Acqua",
  light:    "Luce",
  darkness: "Ombra",
  nature:   "Natura",
};

export const ELEMENT_ICON = {
  fire:     "🔥",
  water:    "💧",
  light:    "✨",
  darkness: "🌑",
  nature:   "🍃",
};

/* pip / mana-gem colour per element */
export const ELEMENT_PIP = {
  fire:     "#e0552f",
  water:    "#2b8fe0",
  light:    "#e9c75a",
  darkness: "#8a5cff",
  nature:   "#5fbf4c",
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

/* Canonical legendaries — one (or more) per element. Forced to the
   "legendary" tier no matter what computeRarities would assign by
   strength. Each one has a PROPER NAME (not just a species), so
   players recognise it as a marquee card the moment it hits the table. */
const LEGENDARY_IDS = new Set([
  "reddragon",   // fire    — Ignaroth il Vorace
  "balor",       // fire    — Korghul, Frusta dell'Abisso
  "kraken",      // water   — Mortheryx delle Profondità
  "solar",       // light   — Astariel, Voce del Sole
  "lich",        // dark    — Vermilach Cuoredicenere
  "mummylord",   // dark    — Khar-Mut il Risvegliato
  "sylvandrake", // nature  — Verdannil, Drago dei Boschi Antichi
]);

/* Epics with proper names — explicit per-element shortlist so the tier
   isn't just "whatever computeRarities promoted by raw strength". Same
   forcing pass as LEGENDARY_IDS but at the epic tier. */
const EPIC_IDS = new Set([
  // fire
  "lava-drake", "infernal-demon", "storm-titan", "emberlion",
  // water
  "frostgiant", "glacial-wyrm", "water-colossus", "tidal-colossus",
  // light
  "aurumdrake", "astral-titan", "arcanenova", "prismatic-rhino",
  // darkness
  "deathknight", "mindflayer", "crimson-lich", "duskfiend", "illithid-warlord",
  // nature
  "totem-giant", "stonegiant", "elderwood", "owlbear", "marsh-brute",
]);
const RARITY_BY_SPELL = {
  s_meteor: "epic", s_disintegrate: "rare", s_raise: "rare",
  s_fireball: "rare", s_shockwave: "rare", s_bless: "uncommon",
  s_vision: "uncommon", s_bolt: "common", s_missile: "common",
  s_heal: "common",
  // instants
  s_shock: "common", s_counter: "rare", s_fog: "uncommon",
  s_growth: "uncommon", s_rescue: "common",
  // 2026-05-19b batch
  s_necrotouch: "rare", s_bloodrite: "uncommon", s_frostburst: "uncommon",
  s_spectralflame: "rare", s_sylvanflame: "uncommon",
  // 2026-05-22 expansion
  s_thunderclap: "rare", s_radiantbeam: "rare", s_smite: "rare",
  s_soulrip: "uncommon", s_shadowveil: "uncommon",
  s_tidewave: "rare", s_glacialprison: "uncommon", s_tidalrush: "common",
  s_lifebloom: "common", s_thornlash: "common",
};
/* spells that can be cast at INSTANT speed (responses / combat tricks) */
const INSTANT_IDS = new Set([
  "s_bolt", "s_missile", "s_heal",     // existing → now instants
  "s_shock", "s_counter", "s_fog", "s_growth", "s_rescue",
  // 2026-05-22 expansion — every new combat-trick spell is instant
  "s_thunderclap", "s_smite", "s_soulrip",
  "s_glacialprison", "s_tidalrush",
  "s_lifebloom", "s_thornlash",
]);
const RARITY_BY_ARTIFACT = {
  a_tome: "rare", a_valor: "rare", a_staff: "uncommon",
  a_blade: "uncommon", a_amulet: "uncommon", a_ring: "uncommon",
  // 2026-05-19b batch
  a_frostaegis: "uncommon", a_frostblade: "uncommon", a_runedarms: "rare",
  // 2026-05-22 expansion
  a_forge: "rare", a_furnace: "uncommon",
  a_chalice: "rare", a_grove: "rare", a_idol: "rare",
};

/* a rough "power level" used only to ORDER cards inside an element so
   the strongest ones land in the higher rarity tiers. */
const RAR_TIER_NUM = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
function strengthScore(card) {
  if (LEGENDARY_IDS.has(card.id)) return 1000;
  if (EPIC_IDS.has(card.id)) return 700;
  if (card.type === "spell")
    return 8 + RAR_TIER_NUM[RARITY_BY_SPELL[card.id] || "common"] * 6 + card.cmc;
  if (card.type === "artifact")
    return 8 + RAR_TIER_NUM[RARITY_BY_ARTIFACT[card.id] || "uncommon"] * 6 + card.cmc;
  // creatures: mana value weighs most, body adds a little
  return card.cmc * 6 + ((card.power || 0) + (card.toughness || 0));
}

/* Assign rarities PER ELEMENT so every colour owns at least one card of
   every tier (common → legendary). Forced cards (LEGENDARY_IDS /
   EPIC_IDS) are pinned to their tier; the rest fill the remaining
   slots weakest→strongest, so the highest tiers still feel scarce
   even with explicit marquee picks. */
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
    const all = byEl[el];
    const n = all.length;
    // pull forced cards out of the auto-assignment
    const forced = {};
    for (const c of all) {
      if (LEGENDARY_IDS.has(c.id)) forced[c.id] = "legendary";
      else if (EPIC_IDS.has(c.id)) forced[c.id] = "epic";
    }
    const free = all
      .filter((c) => !forced[c.id])
      .sort((a, b) => strengthScore(a) - strengthScore(b) || a.cmc - b.cmc);
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
    // subtract the forced cards from the per-tier counts so free cards
    // are distributed only into the remaining slots
    for (const cid of Object.keys(forced)) counts[forced[cid]] -= 1;
    for (const r of RARITY_ORDER) counts[r] = Math.max(0, counts[r]);
    // walk weakest→strongest filling common…legendary with free cards
    let i = 0;
    for (const r of RARITY_ORDER)
      for (let k = 0; k < counts[r] && i < free.length; k++, i++)
        out[free[i].id] = r;
    while (i < free.length) { out[free[i].id] = "common"; i++; }
    // apply forced tiers last so they always stick
    for (const cid of Object.keys(forced)) out[cid] = forced[cid];
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
const S = (id, name, cmc, icon, element, effect, text, flavor, art = null) => ({
  id, name, type: "spell", element,
  cost: deriveCost(cmc, element), cmc,
  art, icon, effect, text, flavor,
});
const A = (id, name, cmc, icon, element, passive, text, flavor, art = null) => ({
  id, name, type: "artifact", element,
  cost: deriveCost(cmc, element), cmc,
  art, icon, passive, text, flavor,
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
  C("kenku", "Kenku Ladro", 1, "kenku", "🐦‍⬛", "water", 2, 1,
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
  C("owlbear", "Sgrintzo, Orsogufo Reale", 3, "owlbear", "🦉", "nature", 4, 4,
    "", "Re indiscusso degli abbracci che fanno crac."),
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
  C("peryton", "Peritone", 3, "peryton", "🦌", "nature", 4, 3,
    "", "Proietta l'ombra di un uomo, il cuore di una bestia."),

  /* ---------- CREATURES — cmc 4 (10) ---------- */
  C("frostgiant", "Jormun il Gigante del Gelo", 4, "frostgiant", "🧊", "water", 6, 5,
    "", "Quando muove un passo, l'inverno gli cammina dietro."),
  C("stonegiant", "Brokmar Pietrabarba", 4, "stonegiant", "🗿", "nature", 4, 7,
    "", "Lancia montagne come fossero ciottoli, e ride."),
  C("deathknight", "Velgarn il Cavaliere della Morte", 4, "deathknight", "⚔️", "darkness", 5, 5,
    "", "Il suo giuramento è sopravvissuto a tutto, perfino alla sua anima."),
  C("mindflayer", "Z'thalik, Flagello Mentale", 4, "mindflayer", "🐙", "darkness", 4, 5,
    "", "Cena con i pensieri di chi osa pensargli vicino."),
  C("succubus", "Succube", 4, "succubus", "💋", "darkness", 4, 4,
    "", "Ti ama fino all'ultimo respiro. Il tuo."),
  C("copperdragon", "Drago di Rame", 4, "copperdragon", "🐉", "fire", 5, 5,
    "", "Scherza, poi incenerisce. In quest'ordine."),
  C("stormmage", "Mago della Tempesta", 4, "stormmage", "🌩️", "fire", 5, 4,
    "", "Parla, e i cieli rispondono col fulmine."),
  C("irongolem", "Golem di Ferro", 4, "irongolem", "🤖", "nature", 4, 7,
    "", "Non dorme, non teme, non si arrende."),
  C("wraithpriest", "Sacerdote Spettrale", 4, "wraithpriest", "🕯️", "darkness", 5, 4,
    "", "Officia messe per dèi dimenticati."),
  C("nalfeshnee", "Nalfeshnee", 4, "nalfeshnee", "🐗", "darkness", 6, 4,
    "", "Vanità demoniaca incarnata in tonnellate di furia."),

  /* ---------- CREATURES — cmc 5 (6) ---------- */
  C("reddragon", "Ignaroth il Vorace", 5, "reddragon", "🐲", "fire", 7, 7,
    "", "Tre regni cenere, e la sua fame appena svegliata."),
  C("lich", "Vermilach Cuoredicenere", 5, "lich", "☠️", "darkness", 6, 7,
    "", "Bruciò il proprio cuore per non morire mai."),
  C("balor", "Korghul, Frusta dell'Abisso", 5, "balor", "🔥", "fire", 8, 5,
    "", "La sua frusta è il primo suono che gli Inferi insegnano."),
  C("kraken", "Mortheryx delle Profondità", 5, "kraken", "🐙", "water", 7, 8,
    "", "Otto braccia, una sentenza. L'abisso ha un nome."),
  C("solar", "Astariel, Voce del Sole", 5, "solar", "😇", "light", 7, 7,
    "", "Quando parla, anche gli dèi minori si inchinano."),
  C("mummylord", "Khar-Mut il Risvegliato", 5, "mummylord", "🪦", "darkness", 5, 8,
    "", "Dormì per mille inverni. Si è svegliato di umore pessimo."),

  /* ---------- SPELLS (10) ---------- */
  S("s_bolt", "Saetta", 1, "⚡", "fire",
    { kind: "damage", amount: 3, target: "any" },
    "Infliggi 3 danni a una creatura o all'eroe nemico.",
    "Tre parole, un dito puntato, e il tuono.", "lightning-avatar"),
  S("s_missile", "Dardo Incantato", 1, "✨", "light",
    { kind: "damage", amount: 2, target: "any" },
    "Infliggi 2 danni a un bersaglio qualsiasi.",
    "Non manca mai. Mai.", "arcane-engine"),
  S("s_heal", "Parola Curativa", 1, "💚", "light",
    { kind: "heal", amount: 5 },
    "Recuperi 5 Punti Vita.",
    "Una sillaba sussurrata, una ferita che si chiude.", "arcane-sigil"),
  S("s_fireball", "Palla di Fuoco", 3, "🔥", "fire",
    { kind: "damage", amount: 4, target: "any" },
    "Infliggi 4 danni a un bersaglio qualsiasi.",
    "La soluzione classica a problemi complicati.", "fire-vortex"),
  S("s_shockwave", "Onda d'Urto", 3, "💥", "fire",
    { kind: "aoe_enemy", amount: 3 },
    "Infliggi 3 danni a TUTTE le creature nemiche.",
    "Il terreno trema e l'orizzonte si piega.", "violet-tempest"),
  S("s_disintegrate", "Disintegrazione", 3, "🟣", "darkness",
    { kind: "destroy", target: "creature" },
    "Distruggi una creatura bersaglio.",
    "Un lampo verde, e resta solo polvere.", "dark-singularity"),
  S("s_bless", "Benedizione", 2, "🌟", "light",
    { kind: "buff", p: 2, t: 2, target: "friendly_creature" },
    "Una tua creatura ottiene +2/+2 in modo permanente.",
    "Gli dèi guardano, e per un istante sorridono.", "gilded-champion"),
  S("s_vision", "Visione Arcana", 2, "🔮", "light",
    { kind: "draw", amount: 2 },
    "Peschi 2 carte.",
    "Il velo del futuro si apre, per chi sa leggere.", "arcane-scroll"),
  S("s_raise", "Rianima i Morti", 4, "🪬", "darkness",
    { kind: "raise" },
    "Rievoca una creatura a caso dal tuo cimitero.",
    "La morte è solo una pausa fra due battaglie.", "skull-curse"),
  S("s_meteor", "Meteora", 5, "☄️", "fire",
    { kind: "damage", amount: 6, target: "any" },
    "Infliggi 6 danni a un bersaglio qualsiasi.",
    "Il cielo presenta il conto.", "ember-vortex"),

  /* ---------- INSTANT SPELLS (5) — giocabili a velocità istantanea ---------- */
  S("s_shock", "Scossa", 2, "⚡", "fire",
    { kind: "damage", amount: 3, target: "any" },
    "Istantaneo. Infliggi 3 danni a un bersaglio qualsiasi.",
    "Un crepitio, e l'aria sa di temporale.", "flame-blades"),
  S("s_counter", "Contromagia", 2, "🌀", "water",
    { kind: "counter" },
    "Istantaneo. Controbatti un incantesimo bersaglio nella pila.",
    "La parola muore prima di nascere.", "psionic-duel"),
  S("s_fog", "Nebbia", 1, "🌫️", "nature",
    { kind: "fog" },
    "Istantaneo. Previeni TUTTI i danni da combattimento di questo turno.",
    "Tra la bruma, le lame non trovano la carne.", "blighted-moor"),
  S("s_growth", "Crescita Improvvisa", 2, "🌱", "nature",
    { kind: "pump", p: 3, t: 3, target: "friendly_creature" },
    "Istantaneo. Una tua creatura ottiene +3/+3 fino a fine turno.",
    "La linfa esplode, e il piccolo diventa colosso.", "venom-circle"),
  S("s_rescue", "Soccorso Divino", 2, "🛡️", "light",
    { kind: "wardHeal", amount: 6 },
    "Istantaneo. Recuperi 6 PV. Ogni PV oltre il massimo diventa PV temporaneo (assorbe danni prima dei PV).",
    "All'ultimo istante, una mano di luce.", "radiant-avatar"),

  /* ---------- ARTIFACTS (6) ---------- */
  A("a_valor", "Stendardo di Valore", 3, "🚩", "light",
    { kind: "anthem", p: 1, t: 1 },
    "Le tue creature hanno +1/+1.",
    "Dove sventola, nessun cuore vacilla.", "flame-mantle"),
  A("a_blade", "Lama Runica", 2, "🗡️", "light",
    { kind: "anthem", p: 1, t: 0 },
    "Le tue creature hanno +1/+0.",
    "Le rune cantano a ogni fendente.", "crimson-sword"),
  A("a_amulet", "Amuleto della Salute", 2, "📿", "light",
    { kind: "startHeal", amount: 2 },
    "All'inizio del tuo turno, recuperi 2 PV.",
    "Pulsa piano, come un secondo cuore.", "healing-herb"),
  A("a_ring", "Anello di Rigenerazione", 3, "💍", "nature",
    { kind: "startHeal", amount: 3 },
    "All'inizio del tuo turno, recuperi 3 PV.",
    "Le ferite si chiudono come se non fossero mai esistite.", "amethyst-ring"),
  A("a_staff", "Bastone del Mago", 2, "🪄", "light",
    { kind: "startDraw", amount: 1 },
    "All'inizio del tuo turno, peschi 1 carta extra.",
    "Concentra il flusso del Weave in un solo punto.", "time-gear"),
  A("a_tome", "Tomo Antico", 4, "📖", "light",
    { kind: "startDraw", amount: 1 },
    "All'inizio del tuo turno, peschi 1 carta extra.",
    "Ogni pagina sa qualcosa che tu non sai.", "ancient-urn"),

  /* ---------- ILLUSTRATED CREATURES (from card art) ---------- */
  C("tideweaver", "Tessitrice delle Maree", 3, "tideweaver", "🌊", "water", 3, 3,
    "", "Le correnti danzano al ritmo delle sue dita."),
  C("geomancer", "Geomante", 4, "geomancer", "🪨", "nature", 3, 5,
    "", "La pietra obbedisce a chi sa ascoltarla."),
  C("arcanenova", "Lumeris, Nova Arcana", 4, "arcanenova", "💠", "light", 4, 3,
    "", "Un istante di pura magia. Poi un silenzio che pesa cento anni."),
  C("graspingspirit", "Mano Spettrale", 3, "graspingspirit", "✋", "darkness", 2, 4,
    "", "Afferra ciò che i vivi non possono trattenere."),
  C("arcanecube", "Cubo Arcano", 2, "arcanecube", "🧊", "light", 1, 4,
    "", "Tutto ciò che tocca, lo conserva per sempre."),
  C("runicrevenant", "Spettro Runico", 4, "runicrevenant", "⚔️", "darkness", 5, 4,
    "", "Le rune lo legano al mondo dei vivi, suo malgrado."),
  C("runefist", "Pugno Runico", 2, "runefist", "👊", "light", 3, 2,
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
  C("aurumdrake", "Auralion, Signore dei Cieli Aurei", 5, "aurumdrake", "🐉", "light", 6, 6,
    "", "Il suo respiro è alba che incenerisce — e che salva."),
  C("prismheart", "Cuore di Prisma", 4, "prismheart", "🔆", "water", 3, 5,
    "", "Spezzalo e si ricompone in mille schegge."),
  C("wraithserpent", "Serpe Spettrale", 3, "wraithserpent", "🐍", "darkness", 4, 2,
    "", "Striscia tra i sogni e li avvelena."),
  C("voidwraith", "Spettro del Vuoto", 4, "voidwraith", "🌑", "darkness", 4, 4,
    "", "Dove passa, resta solo l'assenza."),
  C("soulcomet", "Cometa d'Anime", 4, "soulcomet", "☄️", "fire", 5, 3,
    "", "Cade portando con sé chi non vuole lasciarla."),
  C("emberlion", "Solarus, Leone di Brace", 4, "emberlion", "🦁", "fire", 5, 4,
    "", "Il suo ruggito fa cadere la pioggia di cenere."),
  C("duskfiend", "Nyxar, Demone del Crepuscolo", 5, "duskfiend", "😈", "darkness", 6, 5,
    "", "Nasce ogni sera quando l'ultima luce esita."),
  C("tideelemental", "Elementale di Marea", 2, "tideelemental", "💧", "water", 2, 3,
    "", "L'oceano gli ha prestato una forma."),
  C("frostflamewarden", "Guardiano Gelofiamma", 4, "frostflamewarden", "❄️", "water", 4, 4,
    "", "Gelo e fuoco si tengono in equilibrio nel suo cuore."),
  C("sylvandrake", "Verdannil, Drago dei Boschi Antichi", 5, "sylvandrake", "🐲", "nature", 6, 6,
    "", "Quando spiega le ali, mille foreste ricordano il suo vero nome."),
  C("emberspirit", "Spirito di Brace", 2, "emberspirit", "🔥", "fire", 3, 2,
    "", "Una scintilla che ha imparato a volere."),
  C("verdantflame", "Fiamma Verdeggiante", 3, "verdantflame", "🍃", "nature", 3, 4,
    "", "Brucia e fa germogliare nello stesso istante."),
  C("elderwood", "Quercion l'Antico", 4, "elderwood", "🌳", "nature", 4, 6,
    "", "Ricorda quando la foresta entrava in un solo seme."),
  C("manacrystal", "Cristallo di Mana", 2, "manacrystal", "🔷", "water", 0, 5,
    "", "Pulsa piano, come un cuore di vetro."),

  /* ---------- NEW ILLUSTRATED CREATURES (2026-05-19 art batch) ---------- */
  // — Fire —
  C("lionheart-blaze", "Leonide Infuocato", 3, "lionheart-blaze", "🦁", "fire", 4, 3,
    "", "Ruggisce, e la savana diventa cenere."),
  C("magma-brute", "Bruto di Magma", 4, "magma-brute", "🌋", "fire", 5, 4,
    "", "Cammina dove la roccia ancora cola."),
  C("obsidian-golem", "Golem di Ossidiana", 4, "obsidian-golem", "🪨", "fire", 4, 6,
    "", "Forgiato dal cuore di un vulcano spento."),
  C("ember-phoenix", "Fenice di Brace", 4, "ember-phoenix", "🔥", "fire", 4, 3,
    "", "Muore in cenere, rinasce in fiamma."),
  C("lava-drake", "Pyranth, Draco di Lava", 5, "lava-drake", "🐉", "fire", 6, 5,
    "", "Vola tre volte, e tre città bruciano. Sempre tre."),
  C("infernal-demon", "Vurloth, Demone Infernale", 5, "infernal-demon", "😈", "fire", 7, 5,
    "", "L'Abisso gli concesse ali. La fame se l'è coltivata da solo."),
  // — Water —
  C("water-serpent", "Serpe d'Acqua", 2, "water-serpent", "🐍", "water", 3, 2,
    "", "Scivola dove l'occhio non arriva."),
  C("frost-wolf", "Lupo del Gelo", 2, "frost-wolf", "🐺", "water", 3, 2,
    "", "Caccia in branco, sotto la bufera."),
  C("rime-elemental", "Elementale di Brina", 3, "rime-elemental", "❄️", "water", 3, 4,
    "", "Dove posa lo sguardo, tutto si ghiaccia."),
  C("water-sorceress", "Incantatrice d'Acqua", 3, "water-sorceress", "🌊", "water", 3, 3,
    "", "Le maree obbediscono al suo canto."),
  C("frost-tusk-boar", "Cinghiale Zanna-Gelo", 3, "frost-tusk-boar", "🐗", "water", 4, 3,
    "", "Carica come una valanga affamata."),
  C("tidal-colossus", "Tholazar, Colosso Mareale", 4, "tidal-colossus", "🌀", "water", 4, 5,
    "", "Si erge dove l'onda dimentica di ritirarsi."),
  C("abyssal-terror", "Terrore Abissale", 4, "abyssal-terror", "🦈", "water", 5, 3,
    "", "Le fauci del fondo che nessuno vede."),
  C("glacial-wyrm", "Cryolanth, Viverna Glaciale", 5, "glacial-wyrm", "🐲", "water", 6, 6,
    "", "Dove batte l'ala, gli stagni ricordano di essere ghiaccio."),
  C("water-colossus", "Maredorn, Colosso d'Acqua", 5, "water-colossus", "💧", "water", 5, 7,
    "", "Un oceano che ha scelto la forma di un pugno."),
  // — Air —
  C("storm-beast", "Bestia della Tempesta", 3, "storm-beast", "🌩️", "fire", 4, 3,
    "", "Cavalca i venti come fossero prede."),
  C("wasp-knight", "Cavaliere Vespa", 3, "wasp-knight", "🐝", "water", 3, 2,
    "", "Colpisce una volta sola. Basta."),
  C("gilded-magus", "Magus Aureo", 3, "gilded-magus", "✨", "light", 3, 3,
    "", "Tesse il fulmine come fosse seta."),
  C("storm-titan", "Tharokar, Titano della Tempesta", 5, "storm-titan", "⚡", "fire", 6, 5,
    "", "I suoi passi anticipano i tuoni di una stagione."),
  C("astral-titan", "Caelyon, Titano Astrale", 5, "astral-titan", "🌌", "light", 5, 6,
    "", "Porta il cielo notturno come fosse un mantello."),
  // — Light —
  C("spirit-stag", "Cervo Spettrale", 3, "spirit-stag", "🦌", "light", 3, 3,
    "", "Guida i perduti fuori dal bosco."),
  C("crystal-guardian", "Guardiano di Cristallo", 3, "crystal-guardian", "💎", "light", 2, 5,
    "", "La luce, fatta sentinella."),
  C("prismatic-rhino", "Heliodor, Rinoceronte Prismatico", 4, "prismatic-rhino", "🦏", "light", 4, 5,
    "", "Il suo corno spezza ogni incantesimo… e qualche giuramento."),
  // — Darkness —
  C("vampire-noble", "Nobile Vampiro", 3, "vampire-noble", "🦇", "darkness", 3, 3,
    "", "Brinda al tuo sangue con eleganza."),
  C("spectral-witch", "Strega Spettrale", 3, "spectral-witch", "🔮", "darkness", 3, 3,
    "", "Ruba la vita e la indossa come un velo."),
  C("shadow-horror", "Orrore Tenebroso", 4, "shadow-horror", "🌑", "darkness", 4, 4,
    "", "Ha mille occhi e nessuna pietà."),
  C("void-golem", "Golem del Vuoto", 4, "void-golem", "🪨", "darkness", 4, 5,
    "", "Plasmato dall'assenza di tutto."),
  C("lunar-spirit", "Spirito Lunare", 4, "lunar-spirit", "🌙", "darkness", 3, 4,
    "", "Danza fra le maree della notte."),
  C("illithid-warlord", "Maerz'thul, Signore Illithid", 4, "illithid-warlord", "🐙", "darkness", 5, 4,
    "", "Comanda eserciti senza alzare un tentacolo."),
  C("crimson-lich", "Sanguinor, Lich Cremisi", 5, "crimson-lich", "☠️", "darkness", 5, 6,
    "", "La sua corona è fusa con promesse mai mantenute."),
  // — Nature —
  C("wild-ranger", "Ranger Selvaggio", 2, "wild-ranger", "🏹", "nature", 2, 2,
    "", "Conosce ogni sentiero, e ogni agguato."),
  C("venom-knight", "Cavaliere del Veleno", 3, "venom-knight", "🛡️", "nature", 3, 3,
    "", "La sua lama non perdona neppure un graffio."),
  C("thorn-beast", "Bestia Spinosa", 3, "thorn-beast", "🌵", "nature", 4, 3,
    "", "Abbracciarla è l'ultimo errore."),
  C("frond-elemental", "Elementale di Fronda", 3, "frond-elemental", "🍃", "nature", 3, 4,
    "", "La foresta che ha deciso di muoversi."),
  C("autumn-drake", "Draco Autunnale", 4, "autumn-drake", "🍂", "nature", 4, 4,
    "", "Le sue ali spargono foglie e rovina."),
  C("jade-knight", "Cavaliere di Giada", 4, "jade-knight", "🗡️", "nature", 4, 4,
    "", "Armatura di pietra viva, cuore di quercia."),
  C("sylvan-demon", "Demone Silvano", 4, "sylvan-demon", "🌳", "nature", 5, 3,
    "", "Quando la foresta odia, prende questa forma."),

  /* ---------- _unused ART BATCH → mixed card types (2026-05-19b) ---------- */
  // — Spells —
  S("s_necrotouch", "Tocco Necrotico", 4, "🟣", "darkness",
    { kind: "destroy", target: "creature" },
    "Distruggi una creatura bersaglio.",
    "Un dito sfiora, e la carne ricorda di essere polvere.", "necrotic-touch"),
  S("s_bloodrite", "Rito di Sangue", 3, "🩸", "darkness",
    { kind: "damage", amount: 4, target: "any" },
    "Infliggi 4 danni a un bersaglio qualsiasi.",
    "Ogni patto si firma con la stessa inchiostro.", "blood-rite"),
  S("s_frostburst", "Esplosione Gelida", 3, "❄️", "water",
    { kind: "aoe_enemy", amount: 2 },
    "Infliggi 2 danni a TUTTE le creature nemiche.",
    "L'inverno arriva tutto in una volta.", "frost-burst"),
  S("s_spectralflame", "Fiamma Spettrale", 4, "🔵", "darkness",
    { kind: "damage", amount: 4, target: "any" },
    "Infliggi 4 danni a un bersaglio qualsiasi.",
    "Brucia l'anima, non la carne.", "spectral-flame"),
  S("s_sylvanflame", "Fiamma Silvana", 2, "🌿", "nature",
    { kind: "buff", p: 2, t: 2, target: "friendly_creature" },
    "Una tua creatura ottiene +2/+2 in modo permanente.",
    "La linfa che arde fa crescere più in fretta.", "sylvan-flame"),
  // — Artifacts —
  A("a_frostaegis", "Egida di Gelo", 3, "🛡️", "water",
    { kind: "anthem", p: 0, t: 2 },
    "Le tue creature hanno +0/+2.",
    "Una parete di brina fra te e il colpo.", "frost-aegis"),
  A("a_frostblade", "Lama di Gelo", 3, "🗡️", "water",
    { kind: "anthem", p: 2, t: 0 },
    "Le tue creature hanno +2/+0.",
    "Taglia, e la ferita non scalda mai.", "frost-blade"),
  A("a_runedarms", "Armi Runiche", 4, "⚒️", "darkness",
    { kind: "anthem", p: 1, t: 1 },
    "Le tue creature hanno +1/+1.",
    "Forgiate per mani che non esistono più.", "runed-arms"),
  // — Creatures: Fire —
  C("ember-revenant", "Spettro di Brace", 3, "ember-revenant", "🔥", "fire", 4, 2,
    "", "La rabbia non si spegne con la morte."),
  C("ember-warden", "Guardiano di Brace", 4, "ember-warden", "🔥", "fire", 4, 5,
    "", "Sorveglia ciò che il fuoco non deve toccare."),
  C("amber-elemental", "Elementale d'Ambra", 4, "amber-elemental", "🟠", "fire", 5, 4,
    "", "Sangue di resina, cuore di brace."),
  // — Creatures: Water —
  C("water-genasi", "Genasi d'Acqua", 2, "water-genasi", "💧", "water", 2, 3,
    "", "Il mare gli scorre al posto del sangue."),
  C("water-nymph", "Ninfa delle Acque", 2, "water-nymph", "🌸", "water", 2, 2,
    "", "Dove ride lei, fioriscono le rive."),
  C("frost-shade", "Spettro Gelido", 3, "frost-shade", "🧊", "water", 3, 3,
    "", "Il freddo che cammina da solo."),
  C("frost-spirit", "Spirito del Gelo", 3, "frost-spirit", "❄️", "water", 3, 4,
    "", "Porta corna di ghiaccio e silenzio."),
  C("mist-revenant", "Spettro Nebbioso", 3, "mist-revenant", "🌫️", "water", 4, 2,
    "", "Lo trafiggi, e resta solo bruma."),
  C("grinning-fiend", "Demone Ghignante", 3, "grinning-fiend", "😈", "water", 4, 3,
    "", "Ride sempre. Soprattutto quando perdi."),
  C("glacial-knight", "Cavaliere Glaciale", 4, "glacial-knight", "⚔️", "water", 4, 4,
    "", "Il suo giuramento è freddo come la sua lama."),
  C("maelstrom-fury", "Furia del Maelstrom", 4, "maelstrom-fury", "🌀", "water", 5, 3,
    "", "L'oceano quando smette di avere pazienza."),
  C("fang-shaman", "Sciamano Zanna", 4, "fang-shaman", "🦷", "water", 4, 4,
    "", "Parla con gli spiriti del ghiaccio, e loro ascoltano."),
  C("rune-drake", "Draco Runico", 5, "rune-drake", "🐲", "water", 5, 5,
    "", "Le sue scaglie recitano incantesimi dimenticati."),
  C("rune-golem", "Golem Runico", 4, "rune-golem", "🪨", "water", 3, 6,
    "", "Le rune lo tengono insieme. Per ora."),
  C("tidal-golem", "Golem di Marea", 5, "tidal-golem", "🌊", "water", 5, 6,
    "", "Si dissolve e si ricompone con l'onda."),
  C("conch-warden", "Guardiano Conchiglia", 4, "conch-warden", "🐚", "water", 3, 6,
    "", "Antico come la prima risacca."),
  C("tide-monk", "Monaco delle Maree", 3, "tide-monk", "👊", "water", 3, 3,
    "", "Ogni colpo segue il ritmo del mare."),
  // — Creatures: Air —
  C("wind-shade", "Spettro del Vento", 2, "wind-shade", "🌬️", "water", 2, 2,
    "", "Lo senti passare, non lo vedi mai."),
  C("smoke-shade", "Spettro di Fumo", 3, "smoke-shade", "💨", "water", 3, 2,
    "", "Afferralo: ti resterà solo cenere in mano."),
  C("tempest-beast", "Bestia della Tempesta", 3, "tempest-beast", "⛈️", "fire", 4, 3,
    "", "Corre più veloce del tuono che la annuncia."),
  C("rune-summoner", "Evocatore Runico", 3, "rune-summoner", "🔷", "light", 3, 3,
    "", "Disegna nell'aria porte che non dovrebbero aprirsi."),
  C("azure-magus", "Magus d'Azzurro", 4, "azure-magus", "✨", "water", 4, 4,
    "", "Tiene una tempesta addomesticata nel palmo."),
  C("storm-elemental", "Elementale Tempesta", 5, "storm-elemental", "🌩️", "fire", 5, 5,
    "", "Una nuvola che ha imparato a stringere il pugno."),
  // — Creatures: Light —
  C("blossom-unicorn", "Unicorno Fiorito", 3, "blossom-unicorn", "🦄", "light", 3, 3,
    "", "Dove poggia lo zoccolo, sboccia primavera."),
  C("gilded-spider", "Ragno Aureo", 3, "gilded-spider", "🕷️", "light", 3, 2,
    "", "Tesse trappole che valgono un tesoro."),
  C("rime-seraph", "Serafino di Gelo", 4, "rime-seraph", "👼", "light", 4, 4,
    "", "Ali di cristallo, sguardo d'inverno."),
  // — Creatures: Darkness —
  C("pale-shade", "Volto Pallido", 2, "pale-shade", "👻", "darkness", 2, 2,
    "", "L'ultima faccia che hanno visto i perduti."),
  C("clawed-wraith", "Spettro Artigliato", 3, "clawed-wraith", "🖐️", "darkness", 4, 2,
    "", "Graffia il velo fra i vivi e i morti."),
  C("void-stalker", "Predatore del Vuoto", 3, "void-stalker", "👁️", "darkness", 3, 3,
    "", "Ti guarda con occhi che non dovrebbe avere."),
  C("aberrant-thrall", "Schiavo Aberrante", 2, "aberrant-thrall", "🧠", "darkness", 2, 3,
    "", "La sua mente non gli appartiene più."),
  C("skull-warden", "Custode del Teschio", 3, "skull-warden", "💀", "darkness", 3, 3,
    "", "Custodisce un nome che nessuno deve pronunciare."),
  C("rune-beast", "Bestia Runica", 4, "rune-beast", "🐗", "darkness", 5, 3,
    "", "Le rune incise nella carne urlano a ogni passo."),
  C("emerald-necromancer", "Negromante Smeraldo", 4, "emerald-necromancer", "🪬", "darkness", 3, 5,
    "", "La morte è solo un'altra forma di servitù."),
  // — Creatures: Nature —
  C("crystal-toad", "Rospo di Cristallo", 2, "crystal-toad", "🐸", "nature", 2, 3,
    "", "Gracida, e i cristalli rispondono."),
  C("autumn-sprite", "Spirito Autunnale", 2, "autumn-sprite", "🍁", "nature", 3, 2,
    "", "Ride come foglie che cadono."),
  C("sylvan-stag", "Cervo Silvano", 3, "sylvan-stag", "🦌", "nature", 3, 4,
    "", "Le sue corna sono rami di una quercia antica."),
  C("timber-spirit", "Spirito Arboreo", 3, "timber-spirit", "🌲", "nature", 3, 4,
    "", "Quando il bosco sogna, lui cammina."),
  C("verdant-wraith", "Spettro Verdeggiante", 3, "verdant-wraith", "🌿", "nature", 4, 3,
    "", "La rovina che profuma di muschio."),
  C("rune-weaver", "Tessitore di Rune", 4, "rune-weaver", "🧵", "nature", 3, 5,
    "", "Cuce gli incantesimi come fossero radici."),
  C("bloom-elemental", "Elementale in Fiore", 3, "bloom-elemental", "🌼", "nature", 3, 4,
    "", "Il giardino che ha scelto di combattere."),
  C("blossom-warden", "Guardiano Fiorito", 4, "blossom-warden", "🌸", "nature", 4, 5,
    "", "Sotto i petali, una corteccia che non cede."),
  C("thornspine-horror", "Orrore Spinato", 4, "thornspine-horror", "🌵", "nature", 5, 4,
    "", "Ogni spina conosce il sapore del coraggio."),
  C("sylvan-horror", "Orrore Silvano", 4, "sylvan-horror", "🌳", "nature", 4, 5,
    "", "La foresta che ha smesso di proteggere."),
  C("marsh-brute", "Mokrun della Palude", 4, "marsh-brute", "🪨", "nature", 4, 6,
    "", "La palude provvede ai suoi figli più grossi. Mokrun è il più grosso."),
  C("totem-giant", "Vargmar, Gigante Totem", 5, "totem-giant", "🗿", "nature", 5, 7,
    "", "Porta sulle spalle gli dèi della sua tribù, e qualche debito."),
  C("earth-golem", "Golem di Pietra", 4, "earth-golem", "🪨", "nature", 4, 6,
    "", "Un cuore di smeraldo lo tiene in piedi."),

  /* ---------- EXPANSION BATCH 2026-05-22 — +10 SPELLS / +5 ARTIFACTS ----------
     Spell pool was under-served for water & nature (only 2 and 3 spells
     each). Artifacts had zero fire entries. This batch fills both gaps. */

  // — Spells: Fire —
  S("s_thunderclap", "Schianto del Tuono", 4, "🌩️", "fire",
    { kind: "damage", amount: 5, target: "any" },
    "Istantaneo. Infliggi 5 danni a un bersaglio qualsiasi.",
    "Tre miglia di lampo, un istante di silenzio.", "lava-drake"),

  // — Spells: Light —
  S("s_radiantbeam", "Raggio Radioso", 4, "🌞", "light",
    { kind: "damage", amount: 5, target: "any" },
    "Infliggi 5 danni a un bersaglio qualsiasi.",
    "La luce non chiede il permesso di colpire.", "radiantspirit"),
  S("s_smite", "Punizione Divina", 3, "⚖️", "light",
    { kind: "destroy", target: "creature" },
    "Istantaneo. Distruggi una creatura bersaglio.",
    "Pronunciata la condanna, la sentenza è immediata.", "sunmage"),

  // — Spells: Darkness —
  S("s_soulrip", "Strappo dell'Anima", 3, "👻", "darkness",
    { kind: "weaken", p: 2, t: 2, target: "creature" },
    "Una creatura bersaglio ottiene -2/-2 in modo permanente.",
    "Quel che strappa l'ombra, non ricresce.", "soulwraith"),
  S("s_shadowveil", "Velo d'Ombra", 2, "🕸️", "darkness",
    { kind: "draw", amount: 2 },
    "Peschi 2 carte.",
    "Sotto il velo, tutto si ricorda meglio.", "shadowfiend"),

  // — Spells: Water —
  S("s_tidewave", "Onda di Marea", 4, "🌊", "water",
    { kind: "aoe_enemy", amount: 3 },
    "Infliggi 3 danni a TUTTE le creature nemiche.",
    "Quando il mare alza la voce, ogni costa china il capo.", "tempestdragon"),
  S("s_glacialprison", "Prigione Glaciale", 2, "🧊", "water",
    { kind: "freeze", target: "creature" },
    "Istantaneo. Congela una creatura nemica: tappata e salta il prossimo untap.",
    "Il tempo si ferma a un grado sotto zero.", "icetomb"),
  S("s_tidalrush", "Impeto Mareale", 1, "💦", "water",
    { kind: "damage", amount: 2, target: "creature" },
    "Istantaneo. Infliggi 2 danni a una creatura.",
    "L'acqua ricorda, e travolge chi ha dimenticato.", "marid"),

  // — Spells: Nature —
  S("s_lifebloom", "Fioritura Vitale", 1, "🌷", "nature",
    { kind: "heal", amount: 4 },
    "Istantaneo. Recuperi 4 PV.",
    "Dove cade una goccia di linfa, la ferita scorda di esistere.", "dryad"),
  S("s_thornlash", "Frustata Spinosa", 2, "🌵", "nature",
    { kind: "damage", amount: 3, target: "creature" },
    "Istantaneo. Infliggi 3 danni a una creatura.",
    "Sembra solo un ramo. Lo è, fino al colpo.", "mossreaver"),

  // — Artifacts: Fire —
  A("a_forge", "Forgia di Brace", 4, "🔥", "fire",
    { kind: "anthem", p: 2, t: 0 },
    "Le tue creature hanno +2/+0.",
    "Mai si spegne. Mai si stanca. Mai si sazia.", "fireforger"),
  A("a_furnace", "Fornace Tellurica", 3, "♨️", "fire",
    { kind: "startHeal", amount: 2 },
    "All'inizio del tuo turno, recuperi 2 PV.",
    "La sua brace è memoria di vulcani dimenticati.", "emberguardian"),

  // — Artifacts: Darkness —
  A("a_chalice", "Calice della Notte", 3, "🍷", "darkness",
    { kind: "startDraw", amount: 1 },
    "All'inizio del tuo turno, peschi 1 carta extra.",
    "Beve chi non teme di vedere troppo.", "bonelord"),

  // — Artifacts: Nature —
  A("a_grove", "Bosco Antico", 4, "🌳", "nature",
    { kind: "startHeal", amount: 3 },
    "All'inizio del tuo turno, recuperi 3 PV.",
    "Le sue radici bevono ai pozzi delle origini.", "autumntreant"),

  // — Artifacts: Water —
  A("a_idol", "Idolo del Gelo", 4, "🗿", "water",
    { kind: "anthem", p: 1, t: 1 },
    "Le tue creature hanno +1/+1.",
    "Lo sguardo del Gelo nessuno sa dove guardi.", "frostchieftain"),
];

/* ============================================================
   KEYWORD / PASSIVE ABILITIES (D&D-inspired) — 14
   ============================================================ */
/* keyword abilities — D&D-flavoured names (mechanics unchanged) */
export const KEYWORDS = {
  defender:    { label: "Sentinella",        desc: "Non può attaccare: monta la guardia." },
  haste:       { label: "Fretta",            desc: "Può attaccare e tappare appena evocata (niente fiacca)." },
  flying:      { label: "Volare",            desc: "Può essere bloccata solo da creature con Volare o Portata." },
  reach:       { label: "Portata",           desc: "Può bloccare creature con Volare." },
  deathtouch:  { label: "Tocco Necrotico",   desc: "Qualsiasi danno che infligge a una creatura la distrugge." },
  lifelink:    { label: "Suzione Vitale",    desc: "I danni che infligge curano il tuo eroe della stessa quantità." },
  trample:     { label: "Travolgere",        desc: "Il danno da combattimento in eccesso colpisce l'eroe avversario." },
  firststrike: { label: "Iniziativa",        desc: "Infligge il danno da combattimento per primo." },
  vigilance:   { label: "Vigile",            desc: "Non si tappa quando attacca: resta in guardia." },
  menace:      { label: "Terrore",           desc: "Presenza terrificante: può essere bloccata solo da due o più creature." },
  shield:      { label: "Scudo Arcano",      desc: "Previene la prima istanza di danno che subirebbe." },
  regen:       { label: "Rigenerazione",     desc: "La prima volta che morirebbe in un turno, sopravvive (danni azzerati)." },
  unblockable: { label: "Forma Eterea",      desc: "Eterea: non può essere bloccata." },
  hexproof:    { label: "Resistenza Magica", desc: "Non può essere bersaglio di incantesimi avversari." },
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
  // 2026-05-19 art batch
  "lionheart-blaze": ["haste"],
  "obsidian-golem": ["defender"],
  "ember-phoenix": ["flying", "regen"],
  "lava-drake": ["flying"],
  "infernal-demon": ["flying", "trample"],
  "frost-wolf": ["haste"],
  "rime-elemental": ["shield"],
  "water-sorceress": ["hexproof"],
  "frost-tusk-boar": ["trample"],
  "abyssal-terror": ["menace"],
  "glacial-wyrm": ["flying"],
  "storm-beast": ["flying"],
  "wasp-knight": ["flying", "firststrike"],
  "storm-titan": ["trample"],
  "astral-titan": ["vigilance"],
  "spirit-stag": ["vigilance"],
  "crystal-guardian": ["defender", "shield"],
  "vampire-noble": ["lifelink"],
  "spectral-witch": ["lifelink"],
  "shadow-horror": ["menace"],
  "lunar-spirit": ["flying"],
  "illithid-warlord": ["hexproof"],
  "crimson-lich": ["deathtouch"],
  "wild-ranger": ["reach"],
  "venom-knight": ["deathtouch"],
  "autumn-drake": ["flying"],
  "jade-knight": ["vigilance"],
  "sylvan-demon": ["trample"],
  // 2026-05-19b _unused batch
  "ember-revenant": ["haste"],
  "ember-warden": ["defender"],
  "mist-revenant": ["unblockable"],
  "rime-seraph": ["flying"],
  "rune-drake": ["flying"],
  "tidal-golem": ["regen"],
  "conch-warden": ["defender"],
  "smoke-shade": ["flying"],
  "wind-shade": ["flying"],
  "tempest-beast": ["haste"],
  "gilded-spider": ["reach"],
  "clawed-wraith": ["deathtouch"],
  "void-stalker": ["menace"],
  "pale-shade": ["lifelink"],
  "rune-beast": ["trample"],
  "emerald-necromancer": ["deathtouch"],
  "sylvan-stag": ["vigilance"],
  "thornspine-horror": ["reach"],
  "marsh-brute": ["trample"],
  "totem-giant": ["vigilance"],
  "maelstrom-fury": ["menace"],
  "glacial-knight": ["firststrike"],
  "tide-monk": ["firststrike"],
  "rune-golem": ["defender"],
  "earth-golem": ["defender"],
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
  // legacy collections may still store cover="air" → fall back to nature
  const n = ELEMENTS.includes(name) ? name : "nature";
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

/* ============================================================
   DICE STATS — creature Forza/Costituzione become "base + 1dN",
   rolled ONCE when the creature enters play (very D&D).
   ------------------------------------------------------------
   • Derived from the card's fixed power/toughness: that value is
     kept as the AVERAGE, so the existing balance & rarity tiers
     are preserved and the ~155 cards need no hand-editing.
   • Die size is capped by mana cost (cmc1–2 ≤ d4, 3–4 ≤ d6,
     5+ ≤ d8). Tiny stats (≤2) stay FIXED — small creatures
     must stay small.
   • Flip DICE_STATS to false to instantly restore the classic
     fixed stats (the original numbers live untouched on every
     card, so the old settings are always recoverable).
   ============================================================ */
export const DICE_STATS = true;

/* value V on a creature of mana cost C → { base, die }.
   Final stat = base + 1dN (die = N; die 0 means a fixed value). */
export function statDice(value, cmc) {
  const V = Math.max(0, value | 0);
  if (V <= 2) return { base: V, die: 0 };          // low stays low (fixed)
  const cap = cmc <= 2 ? 4 : cmc <= 4 ? 6 : 8;     // mana-scaled ceiling
  let N = V <= 4 ? 4 : V <= 6 ? 6 : 8;             // bigger body → bigger die
  N = Math.min(N, cap);
  const avgDie = (N + 1) / 2;                       // mean of 1dN
  const base = Math.max(0, Math.round(V - avgDie)); // keep V as the average
  return { base, die: N };
}

/* short label for cards NOT in play (hand/shop/deck/collection) */
export function statDiceLabel(value, cmc) {
  if (!DICE_STATS) return String(value);
  const { base, die } = statDice(value, cmc);
  if (!die) return String(base);
  return base > 0 ? `${base}+1d${die}` : `1d${die}`;
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

/* Build a 60-card deck constrained to a specific element pair (the
   2 colours owned by a class). Used by AI mode + as the starter
   deck when the player picks a class.

   Now class-aware: when `klass` is given the deck respects
   CLASS_BUILD_PROFILE (creature/spell/artifact ratio, land count,
   curve bias) so non-casters (Guerriero/Ladro) get few spells and
   full casters (Mago) get many — fixing the previous "all 5 starter
   decks felt the same" issue. Without `klass` it falls back to a
   neutral profile.

   Falls back to buildDeck() if the colours produce too few options. */
export function buildClassDeck(colors, klass, seed) {
  if (!Array.isArray(colors) || colors.length === 0) return buildDeck(seed);
  const rnd = seed == null ? Math.random : mulberry32(seed ^ 0x12345678);
  const allowed = new Set(colors);
  const pool = POOL.filter((id) => allowed.has(getCard(id).element));
  if (pool.length < 12) return buildDeck(seed);

  const profile = buildProfileFor(klass);
  const LAND_TARGET_CLASS = profile.lands || 22;
  const NON_LAND = DECK_SIZE - LAND_TARGET_CLASS;
  const TYPE_TARGET = {
    creature: Math.round(NON_LAND * profile.types.creature),
    spell:    Math.round(NON_LAND * profile.types.spell),
    artifact: Math.round(NON_LAND * profile.types.artifact),
  };
  const curveBonus = (cmc) => profile.curve[Math.min(cmc, 6)] || 0;

  // Sort candidates by (curve fit, rarity tier, jitter). This biases
  // each class toward its own curve sweet-spot without hard-capping.
  const RAR_W = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
  const score = (id) => {
    const c = getCard(id);
    return curveBonus(c.cmc || 0) * 4 + (RAR_W[c.rarity] || 1) + ((seed ? mulberry32(seed + (c.id.length || 1))() : Math.random()) * 1.2);
  };
  const ordered = [...pool].sort((a, b) => score(b) - score(a));

  const capOf = (id) => (getCard(id)?.rarity === "legendary" ? 2 : 4);
  const kindOf = (c) =>
    c.type === "creature" ? "creature" :
    c.type === "artifact" ? "artifact" : "spell";

  /* Pass 1: walk `ordered` repeatedly, adding ONE copy per loop until
     each type bucket hits its target or copies-per-card cap out. This
     lets a small pool (e.g. 5 unique spells for the Druido) still fill
     a 10-spell target via 2-3 copies each, instead of stopping at 5. */
  const copies = {};
  const spells = [];
  const typeCount = { creature: 0, spell: 0, artifact: 0 };
  const typeFull = () =>
    typeCount.creature >= TYPE_TARGET.creature &&
    typeCount.spell    >= TYPE_TARGET.spell &&
    typeCount.artifact >= TYPE_TARGET.artifact;

  /* No type-bypass here: starter decks must respect the class ratio,
     otherwise epic/legendary creatures swallow every slot before any
     spell gets a second copy (Mago ended up with just 8 spells before
     this was tightened). */
  while (!typeFull() && spells.length < NON_LAND) {
    let progress = false;
    for (const id of ordered) {
      if (spells.length >= NON_LAND) break;
      const c = getCard(id);
      if ((copies[id] || 0) >= capOf(id)) continue;
      const k = kindOf(c);
      if (typeCount[k] >= TYPE_TARGET[k]) continue;
      copies[id] = (copies[id] || 0) + 1;
      spells.push(id);
      typeCount[k] += 1;
      progress = true;
    }
    if (!progress) break;
  }
  /* Pass 2: relax type ratio to fill remaining slots. Creatures first
     so non-casters whose unique-spell pool is tiny still finish at 60. */
  if (spells.length < NON_LAND) {
    const rank = { creature: 0, artifact: 1, spell: 2 };
    const fillOrder = ordered.slice().sort((a, b) => {
      const ka = kindOf(getCard(a));
      const kb = kindOf(getCard(b));
      return rank[ka] - rank[kb];
    });
    while (spells.length < NON_LAND) {
      let progress = false;
      for (const id of fillOrder) {
        if (spells.length >= NON_LAND) break;
        if ((copies[id] || 0) >= capOf(id)) continue;
        copies[id] = (copies[id] || 0) + 1;
        spells.push(id);
        progress = true;
      }
      if (!progress) break;
    }
  }
  // Pad with a generic random pull if the pool is somehow too thin.
  while (spells.length < NON_LAND) {
    const id = pool[Math.floor(rnd() * pool.length)];
    spells.push(id);
  }

  // Lands split between colours, weighted by the picked spells'
  // coloured-pip demand. Each colour gets a floor of 8.
  const demand = {};
  for (const el of colors) demand[el] = 0;
  for (const id of spells) {
    const c = getCard(id);
    for (const el of colors) demand[el] += c.cost[el] || 0;
  }
  const total = Math.max(1, colors.reduce((s, el) => s + demand[el], 0));
  const lands = [];
  let left = LAND_TARGET_CLASS;
  for (const el of colors) {
    const share = colors.length === 1
      ? LAND_TARGET_CLASS
      : Math.max(8, Math.round((demand[el] / total) * LAND_TARGET_CLASS));
    const n = Math.min(left, share);
    for (let i = 0; i < n; i++) lands.push("l_" + el);
    left -= n;
  }
  while (left > 0) { lands.push("l_" + colors[0]); left--; }

  return shuffle([...spells, ...lands], seed);
}
