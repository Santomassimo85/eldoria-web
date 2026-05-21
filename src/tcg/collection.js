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
  POOL, LANDS, ELEMENTS, ELEMENT_LABEL, getCard, DECK_SIZE, buildDeck, buildClassDeck,
  isLand,
  RARITY_ORDER, RARITY_ODDS, RARITY_ODDS_PREMIUM, FOIL_CHANCE,
} from "./cards.js";
import {
  CLASSES, CLASS_LABEL, CLASS_ICON, classColors,
} from "./classes.js";

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

/* Shop catalogue — two flavours of pack:
     • element packs (legacy): one per element, only that colour's cards
     • class packs (new):       one per class, drawing from the 2 colours
                                that class owns

   A pack defines `colors: [el, …]`. Element packs have a single colour;
   class packs have two. openPack() pulls from the union. */
const elementPacks = ELEMENTS.map((el) => ({
  id: "pack_" + el,
  kind: "element",
  colors: [el],
  name: "Pacchetto " + ELEMENT_LABEL[el],
  cost: el === "light" || el === "darkness" ? 220 : 110,
  size: PACK_SIZE,
  premium: el === "light" || el === "darkness",
}));

const classPacks = CLASSES.map((k) => {
  const colors = classColors(k);
  return {
    id: "pack_class_" + k,
    kind: "class",
    klass: k,
    colors,
    name: `Pacchetto ${CLASS_LABEL[k]}`,
    icon: CLASS_ICON[k],
    cost: 180, // a touch more than a standard element pack (2 colours)
    size: PACK_SIZE,
    premium: false,
  };
});

export const PACKS = [...classPacks, ...elementPacks];

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
  for (const id of POOL) if (cols.has(getCard(id).element)) c[id] = 3;
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
  const deck = buildClassDeck(classColors(klass));
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
  const inEl = POOL.filter((id) => allowed.has(getCard(id).element));
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
