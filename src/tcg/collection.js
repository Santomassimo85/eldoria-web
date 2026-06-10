/* ============================================================
   TCG — COLLECTION / ECONOMY  (per-user, Firestore)
   ------------------------------------------------------------
   Stored on characters/{uid}  (doc is openly writable):
     tcgCoins           number
     tcgCollection      { cardId: count }   — owned NON-LAND cards
     tcgDeck            [cardId x60]
     tcgStarterClaimed  boolean   — set ONCE, never re-asked
     tcgStarterElement  element   — the starter the player picked

   Basic lands ("Fonte di …") are FREE & UNLIMITED.
   Starter is chosen once among 4 elements (NOT light/darkness).
   Coins are earned in battle and spent on element packs in the
   shop (light & darkness packs cost more).
   ============================================================ */

import {
  doc, getDoc, onSnapshot, setDoc,
  collection as fsCollection, getDocs, writeBatch, deleteField,
} from "firebase/firestore";
import { db } from "../firebase.js";
import {
  POOL, LANDS, ELEMENTS, getCard, DECK_SIZE, buildDeck, buildClassDeck,
  isLand, cardInColors,
  RARITY_ORDER, RARITY_ODDS, RARITY_ODDS_PREMIUM, FOIL_CHANCE,
} from "./cards.js";
import {
  CLASSES, CLASS_LABEL, CLASS_ICON, classColors,
  CLASS_BUILD_PROFILE, DEFAULT_BUILD_PROFILE,
} from "./classes.js";

/* Single source of truth for end-of-match coin payouts. Both the
   GameTable end-of-match panel and the `awardCoins` call in Tcg.jsx
   read this — so the number the panel shows is exactly what gets
   written to characters/{uid}.tcgCoins.
   (Previously the two were out of sync — panel claimed 30/60, actual
   grant was 5/15 — which is what the user was reporting.) */
export const TCG_COINS = {
  // AI: 10 monete SOLO al vincitore. Nessun premio per sconfitta/pareggio
  // (richiesta 2026-06-10). La resa non eroga nulla a nessuno — gestito
  // separatamente via endReason="forfeit" in awardFor/endCoins.
  ai:  { win: 10, lose: 0,  draw: 0 },
  pvp: { win: 25, lose: 12, draw: 15 },
};

/* Legacy starter element list — will be replaced by class-based
   starters in Fase 3+. Kept here so existing players who never picked
   a starter still see a working screen. */
export const STARTER_ELEMENTS = ["fire", "water", "light", "nature"];
export const STARTER_COINS = 120;
export const PACK_SIZE = 15; // 15 cards per pack (rarity-weighted)
export const MAX_COPIES = 4;
export const MAX_COPIES_LEGENDARY = 2; // legendaries are scarcer in deckbuilding
export const MIN_LANDS = 16;
export const LAND_IDS = LANDS.map((l) => l.id);

/* Per-card deck cap: legendaries are limited to 2 copies, everything
   else uses MAX_COPIES (4). Lands are unlimited (handled elsewhere). */
export function maxCopiesFor(id) {
  const card = getCard(id);
  if (!card) return MAX_COPIES;
  return card.rarity === "legendary" ? MAX_COPIES_LEGENDARY : MAX_COPIES;
}

/* Shop catalogue — one pack per class, drawing from the 2 colours
   that class owns. A pack defines `colors: [el, …]`. openPack() pulls
   from the union. Legacy element packs were removed: every class pack
   already covers two colours, so they were redundant. */
const classPacks = CLASSES.map((k) => {
  const colors = classColors(k);
  return {
    id: "pack_class_" + k,
    kind: "class",
    klass: k,
    colors,
    name: `Pacchetto ${CLASS_LABEL[k]}`,
    icon: CLASS_ICON[k],
    cost: 180,
    size: PACK_SIZE,
    premium: false,
  };
});

export const PACKS = [...classPacks];

/* ---- normalisation ---- */
export function profileFromDoc(data) {
  const d = data || {};
  // Migrate legacy element starter → class. Old saves stored
  // tcgStarterElement; new saves store tcgStarterClass. We expose
  // BOTH so UI components don't have to know about the migration.
  const legacyEl = typeof d.tcgStarterElement === "string" ? d.tcgStarterElement : null;
  const klass = typeof d.tcgStarterClass === "string"
    ? d.tcgStarterClass
    : (legacyEl && LEGACY_ELEMENT_TO_CLASS[legacyEl]) || null;
  return {
    coins: typeof d.tcgCoins === "number" ? d.tcgCoins : 0,
    collection:
      d.tcgCollection && typeof d.tcgCollection === "object"
        ? { ...d.tcgCollection }
        : {},
    foils:
      d.tcgFoil && typeof d.tcgFoil === "object" ? { ...d.tcgFoil } : {},
    deck: Array.isArray(d.tcgDeck) ? d.tcgDeck.slice() : null,
    starterClaimed: !!d.tcgStarterClaimed,
    starterElement: legacyEl,                       // legacy, kept for old UI
    starterClass: klass,                             // new — class identity
    cover:
      typeof d.tcgCover === "string"
        ? d.tcgCover
        : legacyEl || "nature",
    loaded: true,
  };
}

export function watchProfile(uid, cb) {
  if (!uid) return () => {};
  return onSnapshot(
    doc(db, "characters", uid),
    (snap) => cb(profileFromDoc(snap.exists() ? snap.data() : {})),
    () => cb(profileFromDoc({}))
  );
}

async function patch(uid, fields) {
  await setDoc(doc(db, "characters", uid), fields, { merge: true });
}

/* the player must pick a starter only if they never claimed one */
export function needsStarter(profile) {
  return !!profile && profile.loaded && !profile.starterClaimed;
}

/* ============================================================
   STARTER DECKS — fixed list, identical for every new player.
   ------------------------------------------------------------
   2026-05-26: starters were previously generated by buildClassDeck()
   with randomness + per-class curve weighting, which produced very
   uneven rarity distributions (Mago had ~5 leggendarie nello starter,
   Guerriero/Ladro zero). The user asked for a fixed, identical deck
   per class — same 60 cards for everyone who picks that class.

   Every deck is 60 cards:
     • 22 lands (11 of each of the class' two colours)
     • 1 legendary    (max 1 per starter — explicit user request)
     • 3 epic
     • 7 rare
     • 12 uncommon
     • 15 common

   Card picks follow the class identity (Mago caster, Guerriero
   aggro, etc.) within those rarity quotas. All IDs reference cards
   defined in cards.js.
   ============================================================ */
export const STARTER_DECKS = {
  // ─── Mago — Natura+Fuoco (caster, burn+ramp+control) ──────
  mago: [
    // 22 lands
    "l_fire","l_fire","l_fire","l_fire","l_fire","l_fire",
    "l_fire","l_fire","l_fire","l_fire","l_fire",
    "l_nature","l_nature","l_nature","l_nature","l_nature","l_nature",
    "l_nature","l_nature","l_nature","l_nature","l_nature",
    // 1 legendary
    "reddragon",
    // 3 epics
    "emberlion", "lava-drake", "owlbear",
    // 7 rares
    "copperdragon", "copperdragon", "stormmage", "stormmage",
    "obsidian-golem", "rune-weaver", "jade-knight",
    // 12 uncommons
    "nightmare", "nightmare", "peryton", "peryton", "troll", "troll",
    "soulcomet", "ember-phoenix", "geomancer",
    "s_meteor", "a_forge", "a_grove",
    // 15 commons
    "s_bolt", "s_bolt", "s_fireball", "s_fireball",
    "s_shockwave", "s_shockwave", "s_thunderclap",
    "s_growth", "s_growth", "s_fog", "s_lifebloom", "s_thornlash",
    "emberspirit", "emberspirit", "a_ring",
  ],

  // ─── Guerriero — Fuoco+Luce (aggro, lots of creatures) ────
  guerriero: [
    "l_fire","l_fire","l_fire","l_fire","l_fire","l_fire",
    "l_fire","l_fire","l_fire","l_fire","l_fire",
    "l_light","l_light","l_light","l_light","l_light","l_light",
    "l_light","l_light","l_light","l_light","l_light",
    "solar",
    "aurumdrake", "emberlion", "lightpaladin",
    "warmonk", "warmonk", "copperdragon", "copperdragon",
    "angelicwarrior", "angelicwarrior", "obsidian-golem",
    "nightmare", "nightmare", "lionheart-blaze", "lionheart-blaze",
    "dwarfpaladin", "dwarfpaladin", "spirit-stag", "spirit-stag",
    "emberbrute", "ember-phoenix", "soulcomet", "a_valor",
    "kobold", "kobold", "imp", "imp",
    "emberspirit", "emberspirit", "emberspirit",
    "flametiefling", "flametiefling",
    "harengonknight", "harengonknight",
    "orc", "orc", "s_bolt", "a_blade",
  ],

  // ─── Chierico — Luce+Ombra (midrange, heal+drain+removal) ─
  chierico: [
    "l_light","l_light","l_light","l_light","l_light","l_light",
    "l_light","l_light","l_light","l_light","l_light",
    "l_darkness","l_darkness","l_darkness","l_darkness","l_darkness","l_darkness",
    "l_darkness","l_darkness","l_darkness","l_darkness","l_darkness",
    "mummylord",
    "crimson-lich", "aurumdrake", "lightpaladin",
    "warmonk", "warmonk", "wraithpriest", "wraithpriest",
    "crystal-guardian", "shadow-horror", "ogrezombie",
    "wight", "wight", "medusa", "medusa",
    "spectral-witch", "lunarwolf",
    "s_raise", "s_smite", "s_necrotouch",
    "succubus", "a_valor", "a_runedarms",
    "s_heal", "s_heal", "s_missile", "s_missile",
    "s_bless", "s_vision", "s_rescue",
    "s_disintegrate", "s_bloodrite", "s_soulrip",
    "zombie", "zombie", "gnoll", "gnoll", "soulbinder",
  ],

  // ─── Ladro — Ombra+Acqua (tempo, evasive+reactions) ──────
  ladro: [
    "l_darkness","l_darkness","l_darkness","l_darkness","l_darkness","l_darkness",
    "l_darkness","l_darkness","l_darkness","l_darkness","l_darkness",
    "l_water","l_water","l_water","l_water","l_water","l_water",
    "l_water","l_water","l_water","l_water","l_water",
    "kraken",
    "crimson-lich", "glacial-wyrm", "yeti",
    "ghostcaller", "ghostcaller", "frostflamewarden",
    "abyssal-terror", "shadow-horror", "runicrevenant",
    "emerald-necromancer",
    "wight", "wight", "tideweaver", "tideweaver",
    "frost-tusk-boar", "frost-tusk-boar",
    "wasp-knight", "iceberserker", "lunarwolf", "voidwraith",
    "s_counter", "a_runedarms",
    "manes", "manes", "kenku", "kenku",
    "direwolf", "direwolf", "water-serpent",
    "zombie", "gnoll", "lanternwraith",
    "s_disintegrate", "s_tidalrush", "s_shadowveil",
    "a_chalice", "a_frostblade",
  ],

  // ─── Druido — Natura+Acqua (ramp, big creatures+control) ──
  druido: [
    "l_nature","l_nature","l_nature","l_nature","l_nature","l_nature",
    "l_nature","l_nature","l_nature","l_nature","l_nature",
    "l_water","l_water","l_water","l_water","l_water","l_water",
    "l_water","l_water","l_water","l_water","l_water",
    "sylvandrake",
    "owlbear", "stonegiant", "frostgiant",
    "autumn-drake", "autumn-drake", "jade-knight", "jade-knight",
    "sylvan-demon", "frostflamewarden", "earth-golem",
    "troll", "troll", "peryton", "peryton",
    "tideweaver", "tideweaver",
    "venom-knight", "thorn-beast", "wildhunter",
    "s_counter", "a_grove", "a_idol",
    "s_growth", "s_growth", "s_fog", "s_fog",
    "s_lifebloom", "s_glacialprison",
    "s_tidalrush", "s_tidalrush", "s_frostburst",
    "lizardfolk", "lizardfolk", "direwolf",
    "tideelemental", "manacrystal", "a_ring",
  ],
};

/* ---- ownership helpers ---- */
export function ownedCount(collection, id) {
  return collection[id] || 0;
}
export function deckCounts(deck) {
  const m = {};
  for (const id of deck || []) m[id] = (m[id] || 0) + 1;
  return m;
}
export function maxAllowed(collection, id) {
  if (isLand(id)) return Infinity;
  return Math.min(maxCopiesFor(id), ownedCount(collection, id));
}

/* ---- deck validation ---- */
export function validateDeck(deck, collection) {
  const errors = [];
  if (!Array.isArray(deck)) return { ok: false, errors: ["Mazzo assente."] };
  if (deck.length !== DECK_SIZE)
    errors.push(`Il mazzo deve avere ${DECK_SIZE} carte (attuali: ${deck.length}).`);
  const counts = deckCounts(deck);
  let lands = 0;
  for (const id of Object.keys(counts)) {
    const card = getCard(id);
    if (!card) { errors.push(`Carta sconosciuta: ${id}.`); continue; }
    if (card.type === "land") { lands += counts[id]; continue; }
    // Legendary cards have a tighter deck cap (2) than other cards (4).
    const allowed = maxCopiesFor(id);
    if (counts[id] > allowed)
      errors.push(`Troppe copie di ${card.name} (max ${allowed}${card.rarity === "legendary" ? " — leggendaria" : ""}).`);
    if (counts[id] > ownedCount(collection, id))
      errors.push(`Non possiedi abbastanza copie di ${card.name}.`);
  }
  return { ok: errors.length === 0, errors, lands };
}

/* CLASS_BUILD_PROFILE / DEFAULT_BUILD_PROFILE moved to classes.js so the
   same numbers drive both the starter deck (cards.js → buildClassDeck)
   and the in-deckbuilder auto-build (this file → autoClassDeck). Local
   alias kept for the existing references below. */
const DEFAULT_PROFILE = DEFAULT_BUILD_PROFILE;

/* ============================================================
   AUTO-BUILD — CLASS DECK
   ------------------------------------------------------------
   Build a 60-card deck for a target class from what the player
   currently owns, using CLASS_BUILD_PROFILE for the type ratios,
   land count and curve preference. Algorithm:
     1) Filter the pool to the class' two colours.
     2) Score each owned card by rarity × 10 + class-specific
        curve bonus + tiny random.
     3) Pick non-land cards respecting class-tuned type targets
        (e.g. Guerriero ~72% creature, Mago ~46%). Epics/legends
        bypass soft caps so marquee picks always slot in.
     4) Fill lands (class-specific count) split proportionally
        between colours based on the picked cards' coloured-mana
        demand, with a per-colour floor.
     5) Light shuffle.

   Falls back to autoDeck(collection, primaryColor) if the player
   doesn't own enough class-coloured cards yet. */
export function autoClassDeck(collection, klass) {
  if (!klass || !CLASSES.includes(klass)) {
    return autoDeck(collection, null);
  }
  const cols = classColors(klass);
  const allowed = new Set(cols);
  const profile = CLASS_BUILD_PROFILE[klass] || DEFAULT_PROFILE;

  // owned non-land cards in the class colours, respecting copy caps
  const owned = [];
  for (const id of POOL) {
    const c = getCard(id);
    if (!c || c.type === "land") continue;
    if (!cardInColors(c, allowed)) continue;
    const cap = c.rarity === "legendary" ? MAX_COPIES_LEGENDARY : MAX_COPIES;
    const have = Math.min(cap, collection[id] || 0);
    for (let i = 0; i < have; i++) owned.push(id);
  }

  // Too few cards to make a real class deck → fall back so we always
  // return a complete 60-card deck instead of a stub.
  if (owned.length < 20) return autoDeck(collection, cols[0]);

  /* Score: rarity weight × 10 + class-specific curve bonus + jitter.
     The curve bonus comes from profile.curve so e.g. Guerriero leans
     low-cost and Druido leans high-cost without us hard-coding it. */
  const RAR_W = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
  const curveBonusFor = (cmc) => profile.curve[Math.min(cmc, 6)] || 0;
  const score = (id) => {
    const c = getCard(id);
    const rw = RAR_W[c.rarity] || 1;
    return rw * 10 + curveBonusFor(c.cmc || 0) + Math.random() * 1.5;
  };
  owned.sort((a, b) => score(b) - score(a));

  /* Pick non-land cards respecting the class' type ratio. Epics/
     legendaries bypass the cap so marquee cards always slot in. */
  const NONLAND = DECK_SIZE - profile.lands;
  const TARGET = {
    creature: Math.round(NONLAND * profile.types.creature),
    spell:    Math.round(NONLAND * profile.types.spell),
    artifact: Math.round(NONLAND * profile.types.artifact),
  };
  const kindOf = (c) =>
    c.type === "creature" ? "creature" :
    c.type === "artifact" ? "artifact" : "spell";

  const picked = [];
  const pickedCount = {};
  const typeCount = { creature: 0, spell: 0, artifact: 0 };

  for (const id of owned) {
    if (picked.length >= NONLAND) break;
    const c = getCard(id);
    const cap = c.rarity === "legendary" ? MAX_COPIES_LEGENDARY : MAX_COPIES;
    if ((pickedCount[id] || 0) >= cap) continue;
    const k = kindOf(c);
    const bypass = c.rarity === "legendary" || c.rarity === "epic";
    if (!bypass && typeCount[k] >= TARGET[k]) continue;
    picked.push(id);
    pickedCount[id] = (pickedCount[id] || 0) + 1;
    typeCount[k] += 1;
  }
  // 2nd pass: relax the type cap to fill up to NONLAND
  if (picked.length < NONLAND) {
    for (const id of owned) {
      if (picked.length >= NONLAND) break;
      const c = getCard(id);
      const cap = c.rarity === "legendary" ? MAX_COPIES_LEGENDARY : MAX_COPIES;
      if ((pickedCount[id] || 0) >= cap) continue;
      picked.push(id);
      pickedCount[id] = (pickedCount[id] || 0) + 1;
    }
  }

  // ----- land split proportional to coloured-mana demand -----
  const colWeight = {};
  for (const el of cols) colWeight[el] = 0;
  for (const id of picked) {
    const c = getCard(id);
    if (c.element && allowed.has(c.element)) colWeight[c.element] += 1;
    if (c.cost) {
      for (const el of cols) if (c.cost[el]) colWeight[el] += c.cost[el] * 1.5;
    }
  }
  const totalW = cols.reduce((s, el) => s + (colWeight[el] || 0), 0) || cols.length;
  const LAND_N = DECK_SIZE - picked.length;
  const FLOOR  = Math.min(6, Math.floor(LAND_N / cols.length)); // never less than ~6 per colour
  const lands = [];
  let left = LAND_N;
  for (const el of cols) {
    const want = Math.round(((colWeight[el] || 0) / totalW) * LAND_N);
    const n = Math.max(FLOOR, want);
    for (let i = 0; i < n && left > 0; i++) { lands.push("l_" + el); left--; }
  }
  // top up any rounding remainder with the primary colour
  while (left > 0) { lands.push("l_" + cols[0]); left--; }

  // light shuffle (engine re-shuffles at game start anyway)
  const out = [...picked, ...lands];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, DECK_SIZE);
}

/* ============================================================
   AUTO-BUILD — MIX (multiple classes combined)
   ------------------------------------------------------------
   Same scoring/balance as autoClassDeck, but the colour pool is
   the UNION of every selected class' 2 colours. With 3+ colours
   we bump lands to 26 (mana fixing). With 0 or 1 class it falls
   back to the single-class builder.
   ============================================================ */
export function autoMixDeck(collection, classes) {
  const klasses = (classes || []).filter((k) => CLASSES.includes(k));
  if (klasses.length === 0) return autoDeck(collection, null);
  if (klasses.length === 1) return autoClassDeck(collection, klasses[0]);

  const colSet = new Set();
  for (const k of klasses) for (const el of classColors(k)) colSet.add(el);
  const cols = [...colSet];

  const owned = [];
  for (const id of POOL) {
    const c = getCard(id);
    if (!c || c.type === "land") continue;
    if (!cardInColors(c, colSet)) continue;
    const cap = c.rarity === "legendary" ? MAX_COPIES_LEGENDARY : MAX_COPIES;
    const have = Math.min(cap, collection[id] || 0);
    for (let i = 0; i < have; i++) owned.push(id);
  }
  if (owned.length < 20) return autoClassDeck(collection, klasses[0]);

  const RAR_W = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
  const score = (id) => {
    const c = getCard(id);
    const rw = RAR_W[c.rarity] || 1;
    const cmc = c.cmc || 0;
    const curveBonus =
      cmc === 2 || cmc === 3 ? 3 :
      cmc === 1 || cmc === 4 ? 2 :
      cmc === 0 || cmc === 5 ? 1 : 0;
    return rw * 10 + curveBonus + Math.random() * 1.5;
  };
  owned.sort((a, b) => score(b) - score(a));

  const LAND_TARGET = cols.length >= 3 ? 26 : 24;
  const NONLAND = DECK_SIZE - LAND_TARGET;
  const TARGET = {
    creature: Math.round(NONLAND * 0.60),
    spell:    Math.round(NONLAND * 0.32),
    artifact: Math.round(NONLAND * 0.08),
  };
  const kindOf = (c) =>
    c.type === "creature" ? "creature" :
    c.type === "artifact" ? "artifact" : "spell";

  const picked = [];
  const pickedCount = {};
  const typeCount = { creature: 0, spell: 0, artifact: 0 };
  for (const id of owned) {
    if (picked.length >= NONLAND) break;
    const c = getCard(id);
    const cap = c.rarity === "legendary" ? MAX_COPIES_LEGENDARY : MAX_COPIES;
    if ((pickedCount[id] || 0) >= cap) continue;
    const k = kindOf(c);
    const bypass = c.rarity === "legendary" || c.rarity === "epic";
    if (!bypass && typeCount[k] >= TARGET[k]) continue;
    picked.push(id);
    pickedCount[id] = (pickedCount[id] || 0) + 1;
    typeCount[k] += 1;
  }
  if (picked.length < NONLAND) {
    for (const id of owned) {
      if (picked.length >= NONLAND) break;
      const c = getCard(id);
      const cap = c.rarity === "legendary" ? MAX_COPIES_LEGENDARY : MAX_COPIES;
      if ((pickedCount[id] || 0) >= cap) continue;
      picked.push(id);
      pickedCount[id] = (pickedCount[id] || 0) + 1;
    }
  }

  const colWeight = {};
  for (const el of cols) colWeight[el] = 0;
  for (const id of picked) {
    const c = getCard(id);
    if (c.element && colSet.has(c.element)) colWeight[c.element] += 1;
    if (c.cost) {
      for (const el of cols) if (c.cost[el]) colWeight[el] += c.cost[el] * 1.5;
    }
  }
  const totalW = cols.reduce((s, el) => s + (colWeight[el] || 0), 0) || cols.length;
  const LAND_N = DECK_SIZE - picked.length;
  const FLOOR = Math.max(3, Math.floor(LAND_N / (cols.length + 1)));
  const lands = [];
  let left = LAND_N;
  for (const el of cols) {
    const want = Math.round(((colWeight[el] || 0) / totalW) * LAND_N);
    const n = Math.max(FLOOR, want);
    for (let i = 0; i < n && left > 0; i++) { lands.push("l_" + el); left--; }
  }
  while (left > 0) { lands.push("l_" + cols[0]); left--; }

  const out = [...picked, ...lands];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, DECK_SIZE);
}

/* ============================================================
   AUTO-BUILD
   ============================================================ */
export function autoDeck(collection, focus = null) {
  let owned = [];
  for (const id of POOL) {
    const n = Math.min(MAX_COPIES, ownedCount(collection, id));
    for (let i = 0; i < n; i++) owned.push(id);
  }
  if (owned.length < 12) return buildDeck();

  const rnd = () => Math.random();
  if (focus && ELEMENTS.includes(focus)) {
    owned.sort((a, b) => {
      const ea = getCard(a).element === focus ? 0 : 1;
      const eb = getCard(b).element === focus ? 0 : 1;
      if (ea !== eb) return ea - eb;
      return getCard(a).cmc - getCard(b).cmc;
    });
  } else if (focus === "random") {
    owned.sort(() => rnd() - 0.5);
  } else {
    owned.sort((a, b) => getCard(a).cmc - getCard(b).cmc || rnd() - 0.5);
  }

  const spells = owned.slice(0, DECK_SIZE - 22);
  const weight = {};
  for (const el of ELEMENTS) weight[el] = 0;
  for (const id of spells) {
    const c = getCard(id);
    for (const el of ELEMENTS) if (c.cost[el]) weight[el] += c.cost[el];
  }
  let used = ELEMENTS.filter((el) => weight[el] > 0);
  if (!used.length) used = focus && ELEMENTS.includes(focus) ? [focus] : ["nature"];
  const totalW = used.reduce((s, el) => s + weight[el], 0) || used.length;

  const lands = [];
  const LAND_N = DECK_SIZE - spells.length;
  let left = LAND_N;
  for (const el of used) {
    const n = Math.max(2, Math.round(((weight[el] || 1) / totalW) * LAND_N));
    for (let i = 0; i < n && left > 0; i++) { lands.push("l_" + el); left--; }
  }
  while (left > 0) { lands.push("l_" + used[left % used.length]); left--; }

  return [...spells, ...lands].sort(() => rnd() - 0.5).slice(0, DECK_SIZE);
}

/* ============================================================
   STARTER  (choose once — never re-asked, survives reload)
   ------------------------------------------------------------
   2026-05-20: starter migrated from element → class. The grantStarter
   call now takes a class key ("mago", "guerriero", …). The legacy
   element argument still works (mapped to the matching class) so any
   in-flight session that picked an element before the swap doesn't
   crash; new players always see the class picker.
   ============================================================ */
const LEGACY_ELEMENT_TO_CLASS = {
  fire:     "guerriero",
  water:    "ladro",
  light:    "chierico",
  darkness: "chierico",
  nature:   "druido",
};

function starterCollection(klass) {
  const c = {};
  const cols = new Set(classColors(klass));
  // 3 copies of every card of the chosen class' 2 colours
  for (const id of POOL) if (cardInColors(getCard(id), cols)) c[id] = 3;
  return c;
}

export async function grantStarter(uid, choice) {
  if (!uid || !choice) return { ok: false };
  // accept either a class key or a legacy element key (back-compat)
  const klass = CLASSES.includes(choice)
    ? choice
    : LEGACY_ELEMENT_TO_CLASS[choice];
  if (!klass) return { ok: false, reason: "unknown" };

  // re-read to respect a claim that may already exist (anti double-grant)
  const snap = await getDoc(doc(db, "characters", uid));
  if (snap.exists() && snap.data().tcgStarterClaimed)
    return { ok: false, reason: "claimed" };

  const collection = starterCollection(klass);
  // Use the FIXED, identical-for-every-player starter deck. Falls
  // back to buildClassDeck only if STARTER_DECKS is somehow missing
  // an entry for this class (should never happen at runtime).
  const deck = STARTER_DECKS[klass]
    ? STARTER_DECKS[klass].slice()
    : buildClassDeck(classColors(klass), klass);
  const coverEl = classColors(klass)[0];
  await patch(uid, {
    tcgCoins: STARTER_COINS,
    tcgCollection: collection,
    tcgDeck: deck,
    tcgStarterClaimed: true,
    tcgStarterClass: klass,
    tcgCover: coverEl,
  });
  return { ok: true };
}

/* the player's chosen card-back cover (used in & out of battle) */
export async function setCover(uid, cover) {
  if (!uid) return { ok: false };
  await patch(uid, { tcgCover: cover });
  return { ok: true };
}

/* ============================================================
   SHOP
   ============================================================ */
export function getPack(packId) {
  return PACKS.find((p) => p.id === packId) || null;
}

/* FIXED pull odds for a pack — identical for every element so the
   shown percentages are exact. Premium packs lower the legendary
   chance. `foil` is the independent per-card foil chance. */
export function packRarityOdds(packId) {
  const pack = getPack(packId);
  if (!pack) return {};
  const base = pack.premium ? RARITY_ODDS_PREMIUM : RARITY_ODDS;
  return { ...base, foil: FOIL_CHANCE };
}

/* pick a rarity from a {rarity: prob} table */
function rollRarity(odds) {
  const r = Math.random();
  let acc = 0;
  for (const tier of RARITY_ORDER) {
    acc += odds[tier] || 0;
    if (r < acc) return tier;
  }
  return "common";
}

export async function openPack(uid, packId) {
  if (!uid) return { ok: false, reason: "auth" };
  const pack = getPack(packId);
  if (!pack) return { ok: false, reason: "pack" };

  const snap = await getDoc(doc(db, "characters", uid));
  const p = profileFromDoc(snap.exists() ? snap.data() : {});
  if (p.coins < pack.cost) return { ok: false, reason: "coins" };

  // pack's eligible cards (one or more colours), grouped by rarity
  const colors = pack.colors || (pack.element ? [pack.element] : ELEMENTS);
  const allowed = new Set(colors);
  const inEl = POOL.filter((id) => cardInColors(getCard(id), allowed));
  const pool = inEl.length ? inEl : POOL;
  const byRar = {};
  for (const id of pool) (byRar[getCard(id).rarity] ||= []).push(id);
  const odds = pack.premium ? RARITY_ODDS_PREMIUM : RARITY_ODDS;

  const cards = []; // [{ id, foil }]
  for (let i = 0; i < pack.size; i++) {
    // roll a rarity, then a random card of that rarity (fall back to
    // the nearest non-empty tier if this element lacks it)
    let tier = rollRarity(odds);
    if (!byRar[tier] || !byRar[tier].length) {
      const order = RARITY_ORDER.slice().sort(
        (a, b) =>
          Math.abs(RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(tier)) -
          Math.abs(RARITY_ORDER.indexOf(b) - RARITY_ORDER.indexOf(tier))
      );
      tier = order.find((t) => byRar[t] && byRar[t].length) || "common";
    }
    const bucket = byRar[tier] || pool;
    const id = bucket[Math.floor(Math.random() * bucket.length)];
    cards.push({ id, foil: Math.random() < FOIL_CHANCE });
  }

  const collection = { ...p.collection };
  const foils = { ...(p.foils || {}) };
  for (const c of cards) {
    collection[c.id] = (collection[c.id] || 0) + 1;
    if (c.foil) foils[c.id] = (foils[c.id] || 0) + 1;
  }
  const coins = p.coins - pack.cost;

  await patch(uid, {
    tcgCoins: coins,
    tcgCollection: collection,
    tcgFoil: foils,
  });
  return { ok: true, cards, coins };
}

export async function saveDeck(uid, deck, collection) {
  if (!uid) return { ok: false, reason: "auth" };
  const v = validateDeck(deck, collection);
  if (!v.ok) return { ok: false, reason: "invalid", errors: v.errors };
  await patch(uid, { tcgDeck: deck });
  return { ok: true };
}

export async function awardCoins(uid, amount) {
  if (!uid || !amount) return;
  const snap = await getDoc(doc(db, "characters", uid));
  const p = profileFromDoc(snap.exists() ? snap.data() : {});
  await patch(uid, { tcgCoins: Math.max(0, p.coins + amount) });
}

export function playableDeck(profile) {
  if (profile && profile.deck && validateDeck(profile.deck, profile.collection).ok)
    return profile.deck.slice();
  return buildDeck();
}

/* ============================================================
   MASTER — wipe ALL players' TCG data + reset starter choice.
   Deletes only the TCG fields (never whole character docs).
   ============================================================ */
export async function resetAllTcg() {
  // NOTE: tcgCoins is intentionally preserved — reset only removes
  // cards/deck and re-opens the one-time starter choice.
  const fields = {
    tcgCollection: deleteField(),
    tcgFoil: deleteField(),
    tcgDeck: deleteField(),
    tcgStarterClaimed: deleteField(),
    tcgStarterElement: deleteField(),
    tcgCover: deleteField(),
  };
  const snap = await getDocs(fsCollection(db, "characters"));
  const docs = snap.docs;
  let done = 0;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + 400)) batch.update(d.ref, fields);
    await batch.commit();
    done += Math.min(400, docs.length - i);
  }
  return { ok: true, count: done };
}
