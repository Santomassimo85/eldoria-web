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
  POOL, LANDS, ELEMENTS, ELEMENT_LABEL, getCard, DECK_SIZE, buildDeck, isLand,
  RARITY_ORDER, RARITY_ODDS, RARITY_ODDS_PREMIUM, FOIL_CHANCE,
} from "./cards.js";

export const STARTER_ELEMENTS = ["fire", "water", "air", "nature"];
export const STARTER_COINS = 120;
export const PACK_SIZE = 15; // 15 cards per pack (rarity-weighted)
export const MAX_COPIES = 4;
export const MIN_LANDS = 16;
export const LAND_IDS = LANDS.map((l) => l.id);

/* shop catalogue — one pack per element, only that element's cards.
   Prices balanced to battle income (AI win 30 / PvP win 60).
   Light & darkness are premium (cost more). */
export const PACKS = ELEMENTS.map((el) => ({
  id: "pack_" + el,
  element: el,
  name: "Pacchetto " + ELEMENT_LABEL[el],
  cost: el === "light" || el === "darkness" ? 220 : 110,
  size: PACK_SIZE,
  premium: el === "light" || el === "darkness",
}));

/* ---- normalisation ---- */
export function profileFromDoc(data) {
  const d = data || {};
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
    starterElement: typeof d.tcgStarterElement === "string" ? d.tcgStarterElement : null,
    cover:
      typeof d.tcgCover === "string"
        ? d.tcgCover
        : typeof d.tcgStarterElement === "string"
        ? d.tcgStarterElement
        : "air",
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
  return Math.min(MAX_COPIES, ownedCount(collection, id));
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
    if (counts[id] > MAX_COPIES)
      errors.push(`Troppe copie di ${card.name} (max ${MAX_COPIES}).`);
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
  if (!used.length) used = focus && ELEMENTS.includes(focus) ? [focus] : ["air"];
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
   ============================================================ */
function starterCollection(el) {
  const c = {};
  // 3 copies of every card of the chosen element …
  for (const id of POOL) if (getCard(id).element === el) c[id] = 3;
  // … plus 2 copies of every "air" utility card (removal / draw /
  //    buffs) so any starter has answers — unless air IS the choice.
  if (el !== "air")
    for (const id of POOL) if (getCard(id).element === "air") c[id] = (c[id] || 0) + 2;
  return c;
}

export async function grantStarter(uid, el) {
  if (!uid || !STARTER_ELEMENTS.includes(el)) return { ok: false };
  // re-read to respect a claim that may already exist (anti double-grant)
  const snap = await getDoc(doc(db, "characters", uid));
  if (snap.exists() && snap.data().tcgStarterClaimed)
    return { ok: false, reason: "claimed" };

  const collection = starterCollection(el);
  const deck = autoDeck(collection, el);
  await patch(uid, {
    tcgCoins: STARTER_COINS,
    tcgCollection: collection,
    tcgDeck: deck,
    tcgStarterClaimed: true,
    tcgStarterElement: el,
    tcgCover: el,
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

  // this element's cards, grouped by rarity
  const inEl = POOL.filter((id) => getCard(id).element === pack.element);
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
