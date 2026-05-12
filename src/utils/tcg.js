/* ============================================================
   TCG ENGINE — turn-based 1v1 card game.
   ------------------------------------------------------------
   The game state is stored in `tcg_matches/{matchId}.state` on
   Firestore. Both clients render from the same snapshot; only
   the active player can submit actions, while the opponent
   watches in read-only mode until the turn flips.

   State shape:
     state = {
       round: 1,
       activeSide: "challenger" | "challenged",
       phase: "main" | "ended",
       hp:        { challenger, challenged },
       maxMana:   { challenger, challenged },
       mana:      { challenger, challenged },
       deck:      { challenger: [cardId,...], challenged: [...] },
       hand:      { challenger: [cardInst,...], challenged: [...] },
       board:     { challenger: [boardCard,...], challenged: [...] },
       graveyard: { challenger: [cardId,...], challenged: [...] },
       log:       [{ side, text }],
       winner:    null | "challenger" | "challenged",
     }

   boardCard:
     { instId, cardId, hp, atk, sick, tapped, revived, justPlayed }
   ============================================================ */

import {
  TCG_CARDS, TCG_CARD_LIST, RARITY_DECK_WEIGHT,
  elementMultiplier,
} from "../data/tcgCards";

export const STARTING_HP = 25;
export const STARTING_HAND_SIZE = 4;
export const DECK_SIZE = 20;
export const MAX_MANA = 10;
export const MAX_BOARD = 6;
export const MAX_HAND = 7;

/* ── Random utilities ─────────────────────────────────────── */
function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

/* ── Deck building — random weighted by rarity ────────────── */
export function buildRandomDeck(size = DECK_SIZE) {
  const weighted = [];
  for (const c of TCG_CARD_LIST) {
    const w = RARITY_DECK_WEIGHT[c.rarity] || 1;
    for (let i = 0; i < w; i++) weighted.push(c.id);
  }
  const deck = [];
  for (let i = 0; i < size; i++) {
    deck.push(weighted[Math.floor(Math.random() * weighted.length)]);
  }
  return shuffle(deck);
}

/* ── Build initial state ──────────────────────────────────── */
export function initMatchState(challengerDeck, challengedDeck) {
  const cDeck = shuffle(challengerDeck.slice());
  const dDeck = shuffle(challengedDeck.slice());
  const cHand = cDeck.splice(0, STARTING_HAND_SIZE).map(makeHandCard);
  const dHand = dDeck.splice(0, STARTING_HAND_SIZE).map(makeHandCard);

  // Coin flip: randomize who starts
  const activeSide = Math.random() < 0.5 ? "challenger" : "challenged";

  const state = {
    round: 1,
    activeSide,
    phase: "main",
    hp:        { challenger: STARTING_HP, challenged: STARTING_HP },
    maxMana:   { challenger: 0, challenged: 0 },
    mana:      { challenger: 0, challenged: 0 },
    deck:      { challenger: cDeck, challenged: dDeck },
    hand:      { challenger: cHand, challenged: dHand },
    board:     { challenger: [], challenged: [] },
    graveyard: { challenger: [], challenged: [] },
    log: [],
    winner: null,
  };

  // First player gets their first turn upkeep
  return startTurn(state, activeSide);
}

function makeHandCard(cardId) {
  return { instId: rid(), cardId };
}

function makeBoardCard(cardId) {
  const def = TCG_CARDS[cardId];
  if (!def) return null;
  const hasSurge = (def.mechanics || []).includes("surge");
  const hasBulwark = (def.mechanics || []).includes("bulwark");
  const hpBonus = hasBulwark ? 2 : 0; // Bulwark adds permanent +2 HP
  return {
    instId: rid(),
    cardId,
    atk: def.atk,
    hp: def.hp + hpBonus,
    maxHp: def.hp + hpBonus,
    sick: !hasSurge,           // can't attack the turn it's played
    tapped: false,             // already attacked this turn
    revived: false,            // veil consumed?
    justPlayed: true,
  };
}

/* ── Phase transitions ────────────────────────────────────── */
function startTurn(state, side) {
  const next = clone(state);
  // The very first call to startTurn (during init) skips the draw so
  // the starter doesn't get a 5th card on top of the opening hand.
  const isFirstTurnEver = state.log.length === 0;
  next.activeSide = side;
  next.phase = "main";
  if (!isFirstTurnEver) next.round = state.round + 1;
  // Mana grows by 1 each turn (capped), refills to max
  next.maxMana[side] = Math.min(MAX_MANA, next.maxMana[side] + 1);
  next.mana[side] = next.maxMana[side];
  // Untap creatures and clear summoning sickness
  next.board[side] = next.board[side].map(c => ({
    ...c,
    tapped: false,
    sick: false,
    justPlayed: false,
  }));
  if (!isFirstTurnEver) drawCard(next, side);
  next.log = [...next.log, {
    side,
    text: `▶ Turno ${next.round} — tocca a ${sideName(side)}.`,
  }];
  return next;
}

function drawCard(state, side) {
  if (state.deck[side].length === 0) {
    // Fatigue: lose 2 hp instead
    state.hp[side] = Math.max(0, state.hp[side] - 2);
    state.log = [...state.log, {
      side,
      text: `🩸 Mazzo esaurito! ${sideName(side)} subisce 2 danni da affaticamento.`,
    }];
    if (state.hp[side] <= 0) endGame(state, opp(side), "fatica");
    return;
  }
  if (state.hand[side].length >= MAX_HAND) {
    const burned = state.deck[side].shift();
    state.log = [...state.log, {
      side,
      text: `🗑 Mano piena: la carta pescata viene scartata.`,
    }];
    state.graveyard[side] = [...state.graveyard[side], burned];
    return;
  }
  const cardId = state.deck[side].shift();
  state.hand[side] = [...state.hand[side], makeHandCard(cardId)];
}

function sideName(side) {
  return side === "challenger" ? "Sfidante" : "Sfidato";
}

function opp(side) {
  return side === "challenger" ? "challenged" : "challenger";
}

function clone(s) {
  // Shallow-deep clone for state mutations — JSON round trip is fine here,
  // state is plain data and not perf-critical (one round per second tops).
  return JSON.parse(JSON.stringify(s));
}

/* ── Action: play a card from hand ───────────────────────── */
export function playCard(state, side, instId) {
  if (state.winner) return state;
  if (state.activeSide !== side) return state;

  const next = clone(state);
  const handIdx = next.hand[side].findIndex(c => c.instId === instId);
  if (handIdx < 0) return state;
  const handCard = next.hand[side][handIdx];
  const def = TCG_CARDS[handCard.cardId];
  if (!def) return state;

  if (next.mana[side] < def.cost) return state;
  if (next.board[side].length >= MAX_BOARD) return state;

  next.mana[side] -= def.cost;
  next.hand[side].splice(handIdx, 1);
  const bc = makeBoardCard(handCard.cardId);
  next.board[side].push(bc);
  next.log = [...next.log, {
    side,
    text: `🎴 ${sideName(side)} evoca ${def.name} (${def.atk}/${bc.hp}, costo ${def.cost}).`,
  }];
  return next;
}

/* ── Action: attack with a creature ───────────────────────
   targetInstId === null means attacking the opponent's face. */
export function attackWith(state, side, attackerInstId, targetInstId) {
  if (state.winner) return state;
  if (state.activeSide !== side) return state;

  const next = clone(state);
  const oside = opp(side);
  const attacker = next.board[side].find(c => c.instId === attackerInstId);
  if (!attacker) return state;
  if (attacker.sick) return state;
  if (attacker.tapped) return state;

  const aDef = TCG_CARDS[attacker.cardId];
  const aMech = aDef.mechanics || [];
  const isBulwark = aMech.includes("bulwark");
  if (isBulwark) return state; // bulwark cannot attack

  // Must respect Bulwark on opponent — if any bulwark exists, must target one
  const oppBoard = next.board[oside];
  const oppBulwarks = oppBoard.filter(c => (TCG_CARDS[c.cardId].mechanics || []).includes("bulwark"));
  if (oppBulwarks.length > 0) {
    if (targetInstId === null) return state; // can't go face
    const targetIsBulwark = oppBulwarks.some(c => c.instId === targetInstId);
    if (!targetIsBulwark) return state; // must hit a bulwark first
  }

  attacker.tapped = true;

  if (targetInstId === null) {
    // Direct hit on opponent face — no element mod for face damage in MVP
    const dmg = attacker.atk;
    next.hp[oside] = Math.max(0, next.hp[oside] - dmg);
    next.log = [...next.log, {
      side,
      text: `⚔ ${aDef.name} colpisce direttamente per ${dmg} danni!`,
    }];
    applySoulburn(next, side, dmg, aMech);
    if (next.hp[oside] <= 0) endGame(next, side, "PF azzerati");
    return next;
  }

  const target = oppBoard.find(c => c.instId === targetInstId);
  if (!target) return state;
  const tDef = TCG_CARDS[target.cardId];
  const tMech = tDef.mechanics || [];

  // Element multipliers — applied to each side's strike
  const aMul = elementMultiplier(aDef.element, tDef.element);
  const tMul = elementMultiplier(tDef.element, aDef.element);

  const aDmg = Math.round(attacker.atk * aMul);
  const tDmg = Math.round(target.atk * tMul);
  const targetHpBefore = target.hp;

  const aFirst = aMech.includes("vanguard") && !tMech.includes("vanguard");
  const tFirst = tMech.includes("vanguard") && !aMech.includes("vanguard");
  // Both first strike → simultaneous

  next.log = [...next.log, {
    side,
    text: `⚔ ${aDef.name} attacca ${tDef.name}` +
      (aMul > 1 ? " (super-efficace ×1.5!)" : aMul < 1 ? " (poco efficace ×0.5)" : "") + ".",
  }];

  if (aFirst) {
    dealDamageToCreature(next, side, target, aDmg, attacker, aMech);
    if (target.hp > 0) {
      dealDamageToCreature(next, oside, attacker, tDmg, target, tMech);
    } else {
      next.log = [...next.log, { side, text: `💢 ${tDef.name} non fa in tempo a rispondere!` }];
    }
  } else if (tFirst) {
    dealDamageToCreature(next, oside, attacker, tDmg, target, tMech);
    if (attacker.hp > 0) {
      dealDamageToCreature(next, side, target, aDmg, attacker, aMech);
    } else {
      next.log = [...next.log, { side: oside, text: `💢 ${aDef.name} cade prima di colpire!` }];
    }
  } else {
    dealDamageToCreature(next, side, target, aDmg, attacker, aMech);
    dealDamageToCreature(next, oside, attacker, tDmg, target, tMech);
  }

  // Pierce: excess damage from attacker spills to face
  if (aMech.includes("pierce") && target.hp <= 0) {
    const overkill = Math.max(0, aDmg - targetHpBefore);
    if (overkill > 0) {
      next.hp[oside] = Math.max(0, next.hp[oside] - overkill);
      next.log = [...next.log, {
        side,
        text: `🩸 Affondo! ${overkill} danni passano al campione avversario.`,
      }];
    }
  }

  // Soulburn — owner heals equal to attack damage delivered
  applySoulburn(next, side, aDmg, aMech);

  // Process deaths (cinder + veil + remove)
  resolveDeaths(next);

  if (next.hp[oside] <= 0) endGame(next, side, "PF azzerati");
  if (next.hp[side]  <= 0) endGame(next, oside, "PF azzerati (rappresaglia)");
  return next;
}

function dealDamageToCreature(state, attackerSide, victim, rawDmg, dealer, dealerMech) {
  if (rawDmg <= 0) return;
  const isReckon = (dealerMech || []).includes("reckon");
  if (isReckon) {
    victim.hp = 0;
    state.log = [...state.log, {
      side: attackerSide,
      text: `☠ Letale! ${TCG_CARDS[victim.cardId].name} viene distrutto sul colpo.`,
    }];
  } else {
    victim.hp = Math.max(0, victim.hp - rawDmg);
    state.log = [...state.log, {
      side: attackerSide,
      text: `→ ${TCG_CARDS[victim.cardId].name} subisce ${rawDmg} danni (${victim.hp}/${victim.maxHp} PF).`,
    }];
  }
}

function applySoulburn(state, side, dmg, mech) {
  if (!mech || !mech.includes("soulburn")) return;
  if (dmg <= 0) return;
  const before = state.hp[side];
  state.hp[side] = Math.min(STARTING_HP + 5, state.hp[side] + dmg);
  if (state.hp[side] > before) {
    state.log = [...state.log, {
      side,
      text: `💞 Vampirismo: ${sideName(side)} recupera ${state.hp[side] - before} PF.`,
    }];
  }
}

function resolveDeaths(state) {
  for (const s of ["challenger", "challenged"]) {
    const survivors = [];
    const oside = opp(s);
    for (const bc of state.board[s]) {
      if (bc.hp > 0) {
        survivors.push(bc);
        continue;
      }
      const def = TCG_CARDS[bc.cardId];
      const mech = def.mechanics || [];
      // Veil: revive once with 1 hp
      if (mech.includes("veil") && !bc.revived) {
        bc.hp = 1;
        bc.revived = true;
        bc.tapped = true;
        survivors.push(bc);
        state.log = [...state.log, {
          side: s,
          text: `👻 Rinato! ${def.name} torna in piedi con 1 PF.`,
        }];
        continue;
      }
      // Cinder: 2 dmg to opp face on death
      if (mech.includes("cinder")) {
        state.hp[oside] = Math.max(0, state.hp[oside] - 2);
        state.log = [...state.log, {
          side: s,
          text: `💥 Cenere! ${def.name} esplode infliggendo 2 danni al campione avversario.`,
        }];
      }
      state.graveyard[s] = [...state.graveyard[s], bc.cardId];
      state.log = [...state.log, {
        side: s,
        text: `💀 ${def.name} viene distrutto.`,
      }];
    }
    state.board[s] = survivors;
  }
}

function endGame(state, winnerSide, reason) {
  if (state.winner) return; // first end wins — mutual KO favors the attacker
  state.winner = winnerSide;
  state.phase = "ended";
  state.log = [...state.log, {
    side: winnerSide,
    text: `🏆 Vittoria di ${sideName(winnerSide)} (${reason})!`,
  }];
}

/* ── Action: end turn ─────────────────────────────────────── */
export function endTurn(state, side) {
  if (state.winner) return state;
  if (state.activeSide !== side) return state;
  const next = clone(state);
  next.log = [...next.log, {
    side,
    text: `⏭ ${sideName(side)} passa il turno.`,
  }];
  return startTurn(next, opp(side));
}

/* ── Action: forfeit ──────────────────────────────────────── */
export function forfeit(state, side) {
  if (state.winner) return state;
  const next = clone(state);
  next.log = [...next.log, {
    side,
    text: `🏳 ${sideName(side)} abbandona la sfida.`,
  }];
  endGame(next, opp(side), "abbandono");
  return next;
}

/* ── Helpers exposed to the UI ────────────────────────────── */
export function canPlayCard(state, side, instId) {
  if (state.winner || state.activeSide !== side) return false;
  const card = state.hand[side].find(c => c.instId === instId);
  if (!card) return false;
  const def = TCG_CARDS[card.cardId];
  if (!def) return false;
  if (state.mana[side] < def.cost) return false;
  if (state.board[side].length >= MAX_BOARD) return false;
  return true;
}

export function canAttack(state, side, instId) {
  if (state.winner || state.activeSide !== side) return false;
  const c = state.board[side].find(x => x.instId === instId);
  if (!c) return false;
  if (c.sick || c.tapped) return false;
  const def = TCG_CARDS[c.cardId];
  if ((def.mechanics || []).includes("bulwark")) return false;
  return true;
}

export function legalAttackTargets(state, side, attackerInstId) {
  const oside = opp(side);
  const oppBoard = state.board[oside];
  const bulwarks = oppBoard.filter(c => (TCG_CARDS[c.cardId].mechanics || []).includes("bulwark"));
  if (bulwarks.length > 0) {
    return { creatures: bulwarks.map(c => c.instId), face: false };
  }
  return { creatures: oppBoard.map(c => c.instId), face: true };
}

export { opp as oppSide };

/* ============================================================
   DECK + COLLECTION HELPERS
   ------------------------------------------------------------
   Collection shape on the character doc:
     tcgCollection: { [cardId]: count, ... }
     tcgDeck:       [cardId, cardId, ...] (length 20 when valid)
   ============================================================ */
export const DECK_REQUIRED_SIZE = DECK_SIZE;

/* Returns true when the deck is a 20-card array of known card ids. */
export function isValidDeck(deck) {
  if (!Array.isArray(deck) || deck.length !== DECK_SIZE) return false;
  return deck.every(id => !!TCG_CARDS[id]);
}

/* Returns true when the collection has enough copies of every
   card the deck references (i.e. the deck is legally yours). */
export function ownsDeck(deck, collection) {
  if (!Array.isArray(deck)) return false;
  const needed = {};
  for (const id of deck) needed[id] = (needed[id] || 0) + 1;
  for (const [id, n] of Object.entries(needed)) {
    if ((collection?.[id] || 0) < n) return false;
  }
  return true;
}

/* Returns the number of copies of `cardId` currently used in `deck`. */
export function deckCount(deck, cardId) {
  if (!Array.isArray(deck)) return 0;
  let n = 0;
  for (const id of deck) if (id === cardId) n++;
  return n;
}

/* Builds a 20-card deck from a player's collection. Used as the
   auto-fill button in the deck builder and as a fallback when
   their saved deck is invalid or they own >20 cards but never
   made one. Returns null when the collection has <20 cards. */
export function autoBuildDeckFromCollection(collection) {
  const flat = [];
  for (const [id, n] of Object.entries(collection || {})) {
    if (!TCG_CARDS[id]) continue;
    for (let i = 0; i < n; i++) flat.push(id);
  }
  if (flat.length < DECK_SIZE) return null;
  const shuffled = flat
    .map(id => ({ id, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map(o => o.id);
  return shuffled.slice(0, DECK_SIZE);
}

/* Resolves the deck used in an actual match. Tries the player's
   saved deck first; if invalid or unowned, auto-builds from the
   collection; if collection too small, falls back to a fully
   random pool deck so the game can still start. */
export function resolveDeckForMatch(deck, collection) {
  if (isValidDeck(deck) && ownsDeck(deck, collection)) return deck;
  const built = autoBuildDeckFromCollection(collection);
  if (built) return built;
  return buildRandomDeck();
}


