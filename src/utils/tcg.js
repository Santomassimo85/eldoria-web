/* ============================================================
   TCG ENGINE — turn-based 1v1 card game (v2).
   ------------------------------------------------------------
   The game state is stored in `tcg_matches/{matchId}.state` on
   Firestore. Both clients render from the same snapshot; only
   the active player can submit actions, while the opponent
   watches in read-only mode until the turn flips.

   State shape (v2 adds burn, affinityUsed, grants):
     state = {
       round, activeSide, phase,
       hp:        { challenger, challenged },
       maxMana:   { challenger, challenged },
       mana:      { challenger, challenged },
       deck:      { side: [cardId,...] },
       hand:      { side: [{instId,cardId},...] },
       board:     { side: [boardCard,...] },
       graveyard: { side: [cardId,...] },
       burn:      { challenger, challenged }, // remaining turns of 1 dmg/turn
       affinityUsed: { side: { water: bool, dark: bool } },
       log, winner, lastAttack?, lastSpell?,
     }
   boardCard:
     { instId, cardId, atk, hp, maxHp,
       sick, tapped, revived, justPlayed,
       grants?: ["bulwark", ...],
       grantedValues?: { linfa: 2, ... } }
   ============================================================ */

import {
  TCG_CARDS, TCG_CARD_LIST, TCG_MECHANICS, RARITY_DECK_WEIGHT,
  elementMultiplier, getCardType,
} from "../data/tcgCards";

export const STARTING_HP       = 25;
export const STARTING_HAND_SIZE = 6;
export const DECK_SIZE         = 60;
export const MAX_MANA          = 10;
export const MAX_BOARD         = 6;
export const MAX_HAND          = 7;
export const MAX_SECRETS       = 5;
export const MAX_CRYSTALS_PER_TURN = 1;
export const ELEMENTS = ["fire", "water", "earth", "air", "light", "dark"];
/* Per-turn wall-clock limit. If the active player hasn't ended the
   turn within this window, the client triggers `autoSkipTurn` to
   pass the turn automatically (with a forced discard down to MAX_HAND
   if the auto-skipped player is sitting on more cards than the cap). */
export const TURN_DURATION_MS = 2 * 60 * 1000;

/* ── ELEMENTAL MANA HELPERS ──────────────────────────────────
   v3 replaces the single integer mana with a per-element pool
   fed by MTG-style "Crystal" cards. Old data still works: a card
   with a legacy `cost: N` number is auto-derived to
   { [element]: ceil(N/2), any: floor(N/2) }. New cards can opt
   in by setting `cost: { fire: 2, any: 1 }` directly.
   ──────────────────────────────────────────────────────────── */
export function emptyMana() {
  return { fire: 0, water: 0, earth: 0, air: 0, light: 0, dark: 0 };
}
/* Rarity-tiered elemental ratio: higher-rarity cards demand more of
   their own color, so legendaries are near-mono and commons are loose.
   The formula was hand-tuned against the 66-card catalog so:
     - Diavoletto (common, fire 1)     → { fire: 1 }
     - Mago Acqua  (rare, water 3)     → { water: 2, any: 1 }
     - Marid       (epic, water 5)     → { water: 4, any: 1 }
     - Drago Rosso (legendary, fire 8) → { fire: 7, any: 1 }
   Individual cards can still override with `cost: {fire:3, water:1}`. */
const ELEMENTAL_RATIO_BY_RARITY = {
  common:    0.5,
  rare:      0.65,
  epic:      0.75,
  legendary: 0.85,
};
export function normalizeCost(def) {
  // Explicit elemental override via `mana: { fire: 3, any: 1 }`.
  // Cards keep their numeric `cost` for sorting/shop pricing/UI text.
  const explicit = (def?.mana && typeof def.mana === "object") ? def.mana
                 : (def?.cost && typeof def.cost === "object") ? def.cost
                 : null;
  if (explicit) {
    return {
      fire:  explicit.fire  || 0,
      water: explicit.water || 0,
      earth: explicit.earth || 0,
      air:   explicit.air   || 0,
      light: explicit.light || 0,
      dark:  explicit.dark  || 0,
      any:   explicit.any   || 0,
    };
  }
  // Fallback: derive from numeric cost + rarity. Used for any card that
  // hasn't been hand-tuned yet.
  const n = Math.max(0, Number(def?.cost) || 0);
  const ratio = ELEMENTAL_RATIO_BY_RARITY[def?.rarity] ?? 0.5;
  const elem = Math.min(n, Math.ceil(n * ratio));
  const any  = Math.max(0, n - elem);
  const out = { fire: 0, water: 0, earth: 0, air: 0, light: 0, dark: 0, any };
  if (def?.element && elem > 0 && ELEMENTS.includes(def.element)) out[def.element] = elem;
  return out;
}
export function totalCost(def) {
  const c = normalizeCost(def);
  return ELEMENTS.reduce((s, e) => s + c[e], 0) + c.any;
}
function poolTotal(pool) {
  return ELEMENTS.reduce((s, e) => s + (pool?.[e] || 0), 0);
}
export function canAffordCost(pool, cost) {
  // Every colored requirement must be covered by that exact color.
  for (const el of ELEMENTS) {
    if ((cost[el] || 0) > (pool?.[el] || 0)) return false;
  }
  // Remaining "any" must fit in the leftover pool.
  const colored = ELEMENTS.reduce((s, e) => s + (cost[e] || 0), 0);
  const leftover = poolTotal(pool) - colored;
  return leftover >= (cost.any || 0);
}
/* Returns a new pool with `cost` paid. Pays colored requirements first,
   then spends "any" from least-needed-looking colors so combo elements
   aren't wasted. Caller must guarantee canAffordCost(pool, cost). */
export function payCost(pool, cost) {
  const next = { ...pool };
  for (const el of ELEMENTS) next[el] -= (cost[el] || 0);
  let anyLeft = cost.any || 0;
  // Spend `any` from elements NOT needed elsewhere in this cost first.
  const sortedEls = ELEMENTS.slice().sort((a, b) => (cost[a] || 0) - (cost[b] || 0));
  for (const el of sortedEls) {
    if (anyLeft <= 0) break;
    const spend = Math.min(next[el], anyLeft);
    next[el] -= spend;
    anyLeft  -= spend;
  }
  return next;
}
/* Sum mana produced by all crystals on the field (a {fire,...} pool). */
export function crystalsToMana(crystalList) {
  const out = emptyMana();
  for (const el of (crystalList || [])) {
    if (out[el] !== undefined) out[el] += 1;
  }
  return out;
}
/* Pretty-print a cost like "🔥🔥⚪" for logs. */
function formatCost(cost) {
  const icons = { fire: "🔥", water: "💧", earth: "🌿", air: "🌪", light: "✨", dark: "🌑" };
  let s = "";
  for (const el of ELEMENTS) {
    for (let i = 0; i < (cost[el] || 0); i++) s += icons[el];
  }
  for (let i = 0; i < (cost.any || 0); i++) s += "⚪";
  return s || "—";
}

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

function clone(s) {
  // Plain-data state — JSON round trip is fine and keeps Firestore writes simple.
  const next = JSON.parse(JSON.stringify(s));
  // Migrate older states that don't carry newer fields yet, so any in-flight
  // match stays playable instead of crashing on first action.
  if (!next.burn)       next.burn       = { challenger: 0, challenged: 0 };
  if (!next.dmgShield)  next.dmgShield  = { challenger: 0, challenged: 0 };
  if (!next.champRegen) next.champRegen = { challenger: 0, challenged: 0 };
  if (!Array.isArray(next.events)) next.events = [];
  if (!next.secrets)    next.secrets    = { challenger: [], challenged: [] };
  if (!Array.isArray(next.secrets.challenger)) next.secrets.challenger = [];
  if (!Array.isArray(next.secrets.challenged)) next.secrets.challenged = [];
  if (!next.phase) next.phase = "main";
  if (next.pendingAttack === undefined) next.pendingAttack = null;
  if (next.combat === undefined) next.combat = null; // declare-all combat
  if (!Array.isArray(next.stack)) next.stack = [];   // Stage 1: effect stack
  if (next.priority === undefined) next.priority = null; // who may respond (Stage 2+)
  if (next.stackExpiry === undefined) next.stackExpiry = null; // Stage 2: priority deadline
  if (next.stackPassed === undefined) next.stackPassed = null; // Stage 3: last side that passed
  if (!next.affinityUsed) {
    next.affinityUsed = {
      challenger: { water: false, dark: false },
      challenged: { water: false, dark: false },
    };
  }
  if (!next.affinityUsed.challenger) next.affinityUsed.challenger = { water: false, dark: false };
  if (!next.affinityUsed.challenged) next.affinityUsed.challenged = { water: false, dark: false };
  for (const s2 of ["challenger", "challenged"]) {
    for (const bc of next.board?.[s2] || []) {
      if (!bc.grants)        bc.grants = [];
      if (!bc.grantedValues) bc.grantedValues = {};
      if (!bc.tempBuffs)     bc.tempBuffs = [];
    }
  }
  /* v3: per-element mana + crystal field. Migrate older matches so
     in-flight games stay playable instead of crashing on first action.
     Old `mana[side] = N` is mapped to an even pool (N/6 per element). */
  if (!next.crystals) next.crystals = { challenger: [], challenged: [] };
  if (!Array.isArray(next.crystals.challenger)) next.crystals.challenger = [];
  if (!Array.isArray(next.crystals.challenged)) next.crystals.challenged = [];
  if (!next.crystalsPlayedThisTurn) next.crystalsPlayedThisTurn = { challenger: 0, challenged: 0 };
  for (const s2 of ["challenger", "challenged"]) {
    const m = next.mana?.[s2];
    if (typeof m === "number") {
      // Legacy state — spread the integer across elements so the player can still cast.
      const each = Math.floor(m / ELEMENTS.length);
      const rem  = m - each * ELEMENTS.length;
      const pool = emptyMana();
      for (const el of ELEMENTS) pool[el] = each;
      if (rem > 0) pool.fire += rem; // arbitrary bucket for the remainder
      next.mana[s2] = pool;
    } else if (!m || typeof m !== "object") {
      next.mana[s2] = emptyMana();
    } else {
      next.mana[s2] = { ...emptyMana(), ...m };
    }
  }
  return next;
}

function sideName(side) {
  return side === "challenger" ? "Sfidante" : "Sfidato";
}

function opp(side) {
  return side === "challenger" ? "challenged" : "challenger";
}

/* ── Effective keyword lookups ───────────────────────────────
   A creature on the board can collect extra keywords from:
     • spells   (Pelle di Pietra grants Bulwark)
     • grants   (Crescita Selvaggia grants Linfa permanently)
     • tempBuffs (Ali Spirituali grants Volo for 2 rounds)
   We always read keywords through these helpers so all three
   sources combine with the printed ones.
   ──────────────────────────────────────────────────────────── */
function effectiveMechanics(bc) {
  const def = TCG_CARDS[bc.cardId];
  const base = def?.mechanics || [];
  const granted = bc.grants || [];
  const temp = (bc.tempBuffs || []).map(t => t.keyword);
  // De-dupe while preserving order.
  const seen = new Set();
  const out = [];
  for (const k of [...base, ...granted, ...temp]) {
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

function effectiveMechValue(bc, key) {
  const def = TCG_CARDS[bc.cardId];
  const fromTemp = (bc.tempBuffs || []).find(t => t.keyword === key)?.value;
  return fromTemp
    ?? bc.grantedValues?.[key]
    ?? def?.mechanicsValues?.[key];
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

  const activeSide = Math.random() < 0.5 ? "challenger" : "challenged";

  const state = {
    round: 1,
    activeSide,
    phase: "main",
    stack: [],          // Stage 1: effect stack (LIFO)
    priority: null,      // Stage 2+: who may respond before resolution
    stackExpiry: null,   // Stage 2: deadline for the priority holder
    stackPassed: null,   // Stage 3: side that just passed priority
    hp:        { challenger: STARTING_HP, challenged: STARTING_HP },
    /* v3 — mana is per-element, fed by crystals on the field.
       maxMana is kept for log compatibility (cap) but mana refresh
       is driven by crystals[side].length. */
    mana:      { challenger: emptyMana(), challenged: emptyMana() },
    crystals:  { challenger: [], challenged: [] },               // ["fire", "water", ...]
    crystalsPlayedThisTurn: { challenger: 0, challenged: 0 },
    deck:      { challenger: cDeck, challenged: dDeck },
    hand:      { challenger: cHand, challenged: dHand },
    board:     { challenger: [], challenged: [] },
    graveyard: { challenger: [], challenged: [] },
    burn:       { challenger: 0, challenged: 0 },
    dmgShield:  { challenger: 0, challenged: 0 },  // absorbed-first damage (Argine Arcano)
    champRegen: { challenger: 0, challenged: 0 },  // healed at start of YOUR turn (Aureola Sacra)
    secrets:    { challenger: [], challenged: [] }, // face-down trap zone for Contromagie
    affinityUsed: {
      challenger: { water: false, dark: false },
      challenged: { water: false, dark: false },
    },
    log: [],
    events: [],     // structured float events (damage/heal/death) — UI watches the delta
    winner: null,
  };

  return startTurn(state, activeSide);
}

function makeHandCard(cardId) {
  return { instId: rid(), cardId };
}

function makeBoardCard(cardId) {
  const def = TCG_CARDS[cardId];
  if (!def) return null;
  const mech = def.mechanics || [];
  const hasSurge   = mech.includes("surge");
  const hasBulwark = mech.includes("bulwark");
  const hpBonus    = hasBulwark ? 2 : 0; // Bulwark adds permanent +2 HP on enter
  return {
    instId: rid(),
    cardId,
    atk: def.atk,
    hp:    def.hp + hpBonus,
    maxHp: def.hp + hpBonus,
    sick: !hasSurge,
    tapped: false,
    revived: false,
    justPlayed: true,
    grants: [],
    grantedValues: {},
    tempBuffs: [],
  };
}

/* ── Float events ────────────────────────────────────────────
   Engine pushes a structured event whenever a creature or
   champion's HP changes. The UI watches the delta of
   `state.events` and animates a floating number on the right
   anchor (creature instId or champion side). Events accumulate
   for the whole match; the UI tracks an internal cursor.
   Shape: { kind: "damage"|"heal"|"death", target: "creature"|"champion",
            side, instId?, amount? }
   ──────────────────────────────────────────────────────────── */
function pushFloat(state, evt) {
  if (!state.events) state.events = [];
  // Drop no-op heal/damage events so the UI doesn't burn an animation slot on zero values.
  if ((evt.kind === "damage" || evt.kind === "heal") && (!evt.amount || evt.amount <= 0)) return;
  state.events = [...state.events, evt];
}

/* ── Secret/trap triggers ────────────────────────────────────
   Counters are cast face-down to state.secrets[side]. When the
   matching event fires on the defender's side, the FIRST queued
   secret with that trigger auto-resolves and goes to graveyard.
   Returns { cancelled?: bool } so callers (e.g. magic-cast) can
   short-circuit the resolution of a cancelled spell.
   Triggers used here:
     • face_damage       — defender's champion is about to take damage
     • enemy_summon      — attacker just placed a creature on board
     • enemy_magic_cast  — attacker just cast a non-creature card
     • burn_applied      — defender just received Bruciatura stacks
   ──────────────────────────────────────────────────────────── */
function triggerSecrets(state, defenderSide, eventType, eventData) {
  const list = state.secrets?.[defenderSide] || [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.trigger !== eventType) continue;
    const def = TCG_CARDS[s.cardId];
    if (!def) continue;
    // Resolve (effect application unified through the trigger funnel)
    const result = resolveTrigger(state, {
      trig: "secret", defenderSide, def, eventData,
    }) || {};
    // Remove from secrets, push to graveyard
    state.secrets[defenderSide].splice(i, 1);
    state.graveyard[defenderSide] = [...state.graveyard[defenderSide], s.cardId];
    state.log = [...state.log, {
      side: defenderSide,
      text: `🛡 Contromagia attivata: ${def.name}!`,
    }];
    return result;
  }
  return null;
}

function resolveSecret(state, defenderSide, def, eventData) {
  const fx = def.effect;
  if (!fx) return null;
  const attackerSide = opp(defenderSide);
  switch (fx.kind) {
    case "secret_extinguish": {
      const before = state.burn[defenderSide] || 0;
      state.burn[defenderSide] = 0;
      state.log = [...state.log, {
        side: defenderSide,
        text: `💧 ${def.name}: ${before} turn${before === 1 ? "o" : "i"} di Bruciatura cancellat${before === 1 ? "o" : "i"}.`,
      }];
      return { handled: true };
    }
    case "secret_arcane_ward": {
      const amt = fx.amount || 5;
      state.dmgShield[defenderSide] = (state.dmgShield[defenderSide] || 0) + amt;
      state.log = [...state.log, {
        side: defenderSide,
        text: `🛡 ${def.name}: Argine ${amt} pronto ad assorbire i danni.`,
      }];
      return { handled: true };
    }
    case "secret_negate": {
      const instId = eventData?.instId;
      if (!instId) return { handled: false };
      const c = state.board[attackerSide]?.find(x => x.instId === instId);
      if (!c) return { handled: false };
      c.hp = 0; // resolveDeaths will clean up; cinder/veil still apply
      state.log = [...state.log, {
        side: defenderSide,
        text: `❌ ${def.name}: ${TCG_CARDS[c.cardId].name} viene cancellato prima di agire.`,
      }];
      return { handled: true };
    }
    case "secret_cancel_magic": {
      state.log = [...state.log, {
        side: defenderSide,
        text: `🌬 ${def.name}: l'incantesimo avversario svanisce nel nulla.`,
      }];
      return { cancelled: true };
    }
    default:
      return null;
  }
}

/* ── dealChampionDamage ──────────────────────────────────────
   ALL face damage funnels through here so Argine Arcano
   (damage shield) absorbs uniformly: combat hits, pierce
   overkill, cinder, burn ticks, fire affinity (Ardore), spell
   damage, AoE, deck fatigue. Argine-secrets fire BEFORE the
   shield check so an incoming hit can wake the trap.
   Returns the HP actually lost after the shield.
   ──────────────────────────────────────────────────────────── */
function dealChampionDamage(state, side, amount, opts = {}) {
  if (amount <= 0) return 0;
  // Wake any face_damage secrets first; they may add to dmgShield
  triggerSecrets(state, side, "face_damage", { amount });
  let remaining = amount;
  const shield = state.dmgShield?.[side] || 0;
  if (shield > 0) {
    const absorbed = Math.min(shield, remaining);
    state.dmgShield[side] = shield - absorbed;
    remaining -= absorbed;
    if (!opts.silentShield) {
      state.log = [...state.log, {
        side,
        text: `🛡 Argine Arcano assorbe ${absorbed} danni (${state.dmgShield[side]} residui).`,
      }];
    }
  }
  if (remaining > 0) {
    state.hp[side] = Math.max(0, state.hp[side] - remaining);
    pushFloat(state, { kind: "damage", target: "champion", side, amount: remaining });
  }
  return remaining;
}

/* ── Phase transitions ────────────────────────────────────── */
function startTurn(state, side) {
  const next = clone(state);
  const isFirstTurnEver = state.log.length === 0;
  next.activeSide = side;
  next.phase = "main";
  next.pendingAttack = null;
  next.combat = null;       // a turn never begins mid-combat
  next.stack = [];          // a turn never begins with a pending stack
  next.priority = null;
  next.stackExpiry = null;
  next.stackPassed = null;
  if (!isFirstTurnEver) next.round = state.round + 1;
  /* v3 mana refresh: pool is fully restored to whatever the player's
     crystals produce. No "grows by 1" — players control their mana
     ramp by playing crystal cards. */
  next.mana[side] = crystalsToMana(next.crystals?.[side]);
  next.crystalsPlayedThisTurn[side] = 0;
  // Reset per-turn affinity flags for the side whose turn is starting
  next.affinityUsed[side] = { water: false, dark: false };
  // Untap creatures and clear summoning sickness
  next.board[side] = next.board[side].map(c => ({
    ...c,
    tapped: false,
    sick: false,
    justPlayed: false,
  }));
  // Prune expired tempBuffs on EVERY board card (both sides) — at the
  // start of every turn. Buffs cast on round R with duration D expire
  // once round > R + D.
  for (const s2 of ["challenger", "challenged"]) {
    for (const bc of next.board[s2]) {
      if (!bc.tempBuffs?.length) continue;
      const before = bc.tempBuffs.length;
      bc.tempBuffs = bc.tempBuffs.filter(t => t.expiresOnRound >= next.round);
      const removed = before - bc.tempBuffs.length;
      if (removed > 0) {
        next.log = [...next.log, {
          side: s2,
          text: `✨ ${TCG_CARDS[bc.cardId].name}: ${removed} effetto temporaneo svanisce.`,
        }];
      }
    }
  }
  // Champion regen — apply BEFORE burn so the regen can offset a tick
  const regen = next.champRegen?.[side] || 0;
  if (regen > 0 && next.hp[side] < STARTING_HP) {
    const before = next.hp[side];
    next.hp[side] = Math.min(STARTING_HP, next.hp[side] + regen);
    const gained = next.hp[side] - before;
    if (gained > 0) {
      next.log = [...next.log, {
        side,
        text: `👑 Aureola: il campione recupera ${gained} PF.`,
      }];
      pushFloat(next, { kind: "heal", target: "champion", side, amount: gained });
    }
  }
  // Burn — at the start of YOUR turn, take 1 dmg per remaining stack and decay 1
  if ((next.burn[side] || 0) > 0) {
    const dmg = 1;
    dealChampionDamage(next, side, dmg);
    next.burn[side] -= 1;
    next.log = [...next.log, {
      side,
      text: `🔥 Bruciatura: ${sideName(side)} subisce ${dmg} danno (${next.burn[side]} turni residui).`,
    }];
    if (next.hp[side] <= 0) {
      endGame(next, opp(side), "bruciatura");
      return next;
    }
  }
  // Linfa — at the start of YOUR turn, each of your creatures with Linfa heals X
  for (const bc of next.board[side]) {
    const mech = effectiveMechanics(bc);
    if (!mech.includes("linfa")) continue;
    const x = effectiveMechValue(bc, "linfa") || 0;
    if (x <= 0) continue;
    const before = bc.hp;
    bc.hp = Math.min(bc.maxHp, bc.hp + x);
    const gained = bc.hp - before;
    if (gained > 0) {
      next.log = [...next.log, {
        side,
        text: `🌿 Linfa: ${TCG_CARDS[bc.cardId].name} recupera ${gained} PF.`,
      }];
      pushFloat(next, { kind: "heal", target: "creature", side, instId: bc.instId, amount: gained });
    }
  }
  if (!isFirstTurnEver) drawCard(next, side);
  next.log = [...next.log, {
    side,
    text: `▶ Turno ${next.round} — tocca a ${sideName(side)}.`,
  }];
  // Stamp the wall-clock deadline for this turn so both clients can
  // render the countdown and so the auto-skip can fire when the
  // active player goes idle.
  next.turnExpiry = Date.now() + TURN_DURATION_MS;
  return next;
}

function drawCard(state, side) {
  if (state.deck[side].length === 0) {
    dealChampionDamage(state, side, 2);
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

/* ── Affinity triggers — passive per-element on play ─────── */
function applyAffinity(state, side, def) {
  if (!def) return;
  const oside = opp(side);
  const isCreature = getCardType(def) === "creature";
  switch (def.element) {
    case "fire": {
      // Ardore: 1 damage to opp champion
      dealChampionDamage(state, oside, 1);
      state.log = [...state.log, { side, text: `🜂 Ardore: 1 danno al campione avversario.` }];
      if (state.hp[oside] <= 0) endGame(state, side, "Ardore");
      return;
    }
    case "water": {
      // Marea: draw 1, max once per turn
      if (state.affinityUsed[side].water) return;
      state.affinityUsed[side].water = true;
      state.log = [...state.log, { side, text: `🜄 Marea: peschi 1 carta.` }];
      drawCard(state, side);
      return;
    }
    case "earth": {
      // Radici: only on creature plays — other Earth creatures get +0/+1
      if (!isCreature) return;
      let buffed = 0;
      for (const bc of state.board[side]) {
        if (bc.justPlayed) continue; // skip the one we just played
        const cdef = TCG_CARDS[bc.cardId];
        if (cdef?.element !== "earth") continue;
        bc.maxHp += 1;
        bc.hp    += 1;
        buffed++;
      }
      if (buffed > 0) {
        state.log = [...state.log, {
          side,
          text: `🜃 Radici: le tue altre creature di Terra (${buffed}) ricevono +0/+1.`,
        }];
      }
      return;
    }
    case "air": {
      // Brezza: wake up one of your other Air creatures (remove sick + tap)
      for (const bc of state.board[side]) {
        if (bc.justPlayed) continue;
        const cdef = TCG_CARDS[bc.cardId];
        if (cdef?.element !== "air") continue;
        if (!bc.sick && !bc.tapped) continue;
        bc.sick = false;
        bc.tapped = false;
        state.log = [...state.log, {
          side,
          text: `🜁 Brezza: ${cdef.name} si scuote e torna pronto.`,
        }];
        return;
      }
      return;
    }
    case "light": {
      // Grazia: heal champion 2 (capped at STARTING_HP)
      const before = state.hp[side];
      state.hp[side] = Math.min(STARTING_HP, state.hp[side] + 2);
      const gained = state.hp[side] - before;
      if (gained > 0) {
        state.log = [...state.log, {
          side,
          text: `✦ Grazia: il campione recupera ${gained} PF.`,
        }];
        pushFloat(state, { kind: "heal", target: "champion", side, amount: gained });
      }
      return;
    }
    case "dark": {
      // Anima: return last fallen CREATURE from graveyard to hand, 1×/turn
      if (state.affinityUsed[side].dark) return;
      const grave = state.graveyard[side];
      for (let i = grave.length - 1; i >= 0; i--) {
        const id = grave[i];
        const cdef = TCG_CARDS[id];
        if (cdef && getCardType(cdef) === "creature") {
          if (state.hand[side].length >= MAX_HAND) {
            // No room — silently skip but still consume the trigger
            state.affinityUsed[side].dark = true;
            return;
          }
          grave.splice(i, 1);
          state.hand[side].push(makeHandCard(id));
          state.affinityUsed[side].dark = true;
          state.log = [...state.log, {
            side,
            text: `✶ Anima: ${cdef.name} torna nella tua mano dal cimitero.`,
          }];
          return;
        }
      }
      return;
    }
    default:
      return;
  }
}

/* ── Action: play a card from hand ────────────────────────── */
export function playCard(state, side, instId, targetSpec = null) {
  if (state.winner) return state;
  if (state.activeSide !== side) return state;

  const next = clone(state);
  const handIdx = next.hand[side].findIndex(c => c.instId === instId);
  if (handIdx < 0) return state;
  const handCard = next.hand[side][handIdx];
  const def = TCG_CARDS[handCard.cardId];
  if (!def) return state;

  const type = getCardType(def);

  /* Crystal: free, no target, max 1 per turn. Joins the crystal field
     and immediately produces +1 mana of its element for this turn. */
  if (type === "crystal") {
    if ((next.crystalsPlayedThisTurn?.[side] || 0) >= MAX_CRYSTALS_PER_TURN) return state;
    next.hand[side].splice(handIdx, 1);
    next.crystals[side] = [...(next.crystals[side] || []), def.element];
    next.crystalsPlayedThisTurn[side] = (next.crystalsPlayedThisTurn[side] || 0) + 1;
    next.mana[side] = next.mana[side] || emptyMana();
    next.mana[side][def.element] = (next.mana[side][def.element] || 0) + 1;
    next.log = [...next.log, {
      side,
      text: `💎 ${sideName(side)} pone ${def.name} (+1 mana ${def.element}).`,
    }];
    return next;
  }

  const cost = normalizeCost(def);
  if (!canAffordCost(next.mana[side], cost)) return state;

  if (type === "creature") {
    if (next.board[side].length >= MAX_BOARD) return state;
    next.mana[side] = payCost(next.mana[side], cost);
    next.hand[side].splice(handIdx, 1);
    const bc = makeBoardCard(handCard.cardId);
    next.board[side].push(bc);
    next.log = [...next.log, {
      side,
      text: `🎴 ${sideName(side)} evoca ${def.name} (${def.atk}/${bc.hp}, costo ${formatCost(cost)}).`,
    }];
    // Wake opp's enemy_summon secrets (Negazione) — they may set hp=0 here.
    triggerSecrets(next, opp(side), "enemy_summon", { instId: bc.instId });
    // Affinity fires AFTER any negation. If the creature was negated, it
    // already has hp=0 but applyAffinity for Earth Radici still buffs
    // OTHER creatures of yours (the negated one is skipped via justPlayed).
    resolveTrigger(next, { trig: "affinity", side, def });
    resolveDeaths(next);
    return next;
  }

  // Counter: goes face-down to the secrets zone if it carries a trigger.
  if (type === "counter" && def.effect?.trigger) {
    if ((next.secrets[side]?.length || 0) >= MAX_SECRETS) return state;
    next.mana[side] = payCost(next.mana[side], cost);
    next.hand[side].splice(handIdx, 1);
    next.secrets[side] = [
      ...(next.secrets[side] || []),
      { instId: handCard.instId, cardId: handCard.cardId, trigger: def.effect.trigger },
    ];
    next.log = [...next.log, {
      side,
      text: `🛡 ${sideName(side)} prepara una Contromagia segreta (${next.secrets[side].length}/${MAX_SECRETS}).`,
    }];
    return next;
  }

  // Spell, enchantment (and counters without a trigger, if any future) all
  // share the same play-flow. Validate target, deduct mana, then check for
  // opp's "enemy_magic_cast" secret (Dissolvi Magia) which may cancel us.
  if (!isValidSpellTarget(next, side, def, targetSpec)) return state;
  next.mana[side] = payCost(next.mana[side], cost);
  next.hand[side].splice(handIdx, 1);
  next.log = [...next.log, {
    side,
    text: `${TYPE_ICON_FOR(type)} ${sideName(side)} lancia ${def.name} (costo ${formatCost(cost)}).`,
  }];
  next.lastSpell = { cardId: def.id, side, ts: Date.now() };

  // Any non-creature cast can be cancelled by opp's Dissolvi Magia secret.
  const counter = triggerSecrets(next, opp(side), "enemy_magic_cast", { def });
  if (counter?.cancelled) {
    // Spell fizzles — to graveyard, no effect, no affinity.
    next.graveyard[side] = [...next.graveyard[side], handCard.cardId];
    return next;
  }

  // Stage 2/3: the spell/enchantment goes onto the stack, then the
  // OPPONENT gets priority — they may pass OR cast a response
  // (counter) on top. Resolution is one-at-a-time in passPriority().
  pushStack(next, {
    id: rid(),
    kind: "spell",
    controller: side,
    cardId: handCard.cardId,
    targetSpec: targetSpec ?? null,
    ts: Date.now(),
  });
  next.phase = "stack";
  next.priority = opp(side);
  next.stackPassed = null;
  next.stackExpiry = Date.now() + TURN_DURATION_MS;
  return next;
}

/* ── Action: cast a RESPONSE on the stack (Stage 3) ────────────
   Only the priority holder, only during a stack window, only with
   a counter-type card. It is pushed ON TOP of the stack (true
   LIFO); when it resolves it cancels the object directly beneath
   it. Priority then bounces to the opponent (who may respond to
   the response). */
export function canRespond(state, side, instId) {
  if (state.winner || state.phase !== "stack") return false;
  if (state.priority !== side) return false;
  const card = state.hand?.[side]?.find(c => c.instId === instId);
  if (!card) return false;
  const def = TCG_CARDS[card.cardId];
  if (!def || getCardType(def) !== "counter") return false;
  return canAffordCost(state.mana?.[side], normalizeCost(def));
}
export function castResponse(state, side, instId) {
  if (!canRespond(state, side, instId)) return state;
  const next = clone(state);
  const idx = next.hand[side].findIndex(c => c.instId === instId);
  if (idx < 0) return state;
  const handCard = next.hand[side][idx];
  const def = TCG_CARDS[handCard.cardId];
  next.mana[side] = payCost(next.mana[side], normalizeCost(def));
  next.hand[side].splice(idx, 1);
  pushStack(next, {
    id: rid(),
    kind: "response",
    controller: side,
    cardId: handCard.cardId,
    ts: Date.now(),
  });
  next.log = [...next.log, {
    side,
    text: `🛡 ${sideName(side)} risponde con ${def.name}.`,
  }];
  next.stackPassed = null;
  next.priority = opp(side);
  next.stackExpiry = Date.now() + TURN_DURATION_MS;
  return next;
}

/* ── Action: pass priority ─────────────────────────────────────
   Stage 3 ping-pong: a pass hands priority to the opponent. When
   BOTH players pass in succession (no new object added), the TOP
   object resolves (LIFO), then priority returns to the turn's
   active player if anything remains; otherwise back to main. */
export function passPriority(state, side) {
  if (state.winner) return state;
  if (state.phase !== "stack") return state;
  if (state.priority !== side) return state;
  const next = clone(state);
  if (next.stackPassed === opp(side)) {
    // Both passed → resolve exactly one (the top of the stack).
    resolveTopOfStack(next);
    next.stackPassed = null;
    if (!next.winner && Array.isArray(next.stack) && next.stack.length > 0) {
      next.priority = next.activeSide;          // active player acts first
      next.stackExpiry = Date.now() + TURN_DURATION_MS;
    } else {
      next.phase = "main";
      next.priority = null;
      next.stackExpiry = null;
    }
  } else {
    next.stackPassed = side;
    next.priority = opp(side);
    next.stackExpiry = Date.now() + TURN_DURATION_MS;
  }
  return next;
}

/* Timeout fallback: the priority holder didn't act before
   stackExpiry — resolve the stack (same as a pass) so the match
   can't stall. Either client may fire this once the deadline
   passes (guarded by the top object's ts on the UI side). */
export function resolveStackTimeout(state) {
  if (state.phase !== "stack") return state;
  const next = clone(state);
  next.log = [...next.log, {
    side: next.priority || next.activeSide,
    text: `⏰ Nessuna risposta — l'effetto si risolve.`,
  }];
  resolveStack(next);
  next.phase = "main";
  next.priority = null;
  next.stackExpiry = null;
  next.stackPassed = null;
  return next;
}

/* Tiny helper for the play log — keeps the icon set inline with TYPE_ICON
   in the data file without re-importing it. */
function TYPE_ICON_FOR(t) {
  return t === "enchantment" ? "🌟"
       : t === "counter"     ? "🛡"
       : t === "spell"       ? "📜"
       : "🎴";
}

/* ── Spell target validation ─────────────────────────────── */
function isValidSpellTarget(state, side, def, t) {
  const need = def?.effect?.target || "none";
  if (need === "none") return true;
  if (!t) return false;
  const oside = opp(side);

  if (need === "enemy_champion") {
    return t.kind === "champion" && t.side === oside;
  }
  if (need === "enemy_creature") {
    if (t.kind !== "creature" || t.side !== oside) return false;
    return creatureMatchesFilter(state, t, def.effect?.filter);
  }
  if (need === "ally_creature") {
    if (t.kind !== "creature" || t.side !== side) return false;
    return !!state.board[side].find(c => c.instId === t.instId);
  }
  if (need === "any_creature") {
    if (t.kind !== "creature") return false;
    return !!state.board[t.side]?.find(c => c.instId === t.instId);
  }
  if (need === "any") {
    if (t.kind === "champion" && t.side === oside) return true;
    if (t.kind === "creature") {
      return !!state.board[t.side]?.find(c => c.instId === t.instId);
    }
    return false;
  }
  return false;
}

function creatureMatchesFilter(state, t, filter) {
  const c = state.board[t.side]?.find(x => x.instId === t.instId);
  if (!c) return false;
  if (!filter) return true;
  const def = TCG_CARDS[c.cardId];
  if (filter.minAtk != null && def.atk < filter.minAtk) return false;
  if (filter.maxAtk != null && def.atk > filter.maxAtk) return false;
  return true;
}

/* ── Spell effect resolution ─────────────────────────────── */
function applySpellEffect(state, side, def, target) {
  const fx = def.effect;
  if (!fx) return;
  const oside = opp(side);

  switch (fx.kind) {
    case "damage": {
      if (!target) return;
      const mul = computeSpellMultiplier(def, target, state);
      const dmg = Math.max(0, Math.round(fx.amount * mul));
      if (target.kind === "champion") {
        dealChampionDamage(state, target.side, dmg);
        state.log = [...state.log, {
          side,
          text: `⚡ ${def.name} infligge ${dmg} danni al campione avversario${mul !== 1 ? ` (×${mul})` : ""}.`,
        }];
      } else if (target.kind === "creature") {
        const c = state.board[target.side]?.find(x => x.instId === target.instId);
        if (!c) return;
        c.hp = Math.max(0, c.hp - dmg);
        state.log = [...state.log, {
          side,
          text: `⚡ ${def.name} infligge ${dmg} danni a ${TCG_CARDS[c.cardId].name}${mul !== 1 ? ` (×${mul})` : ""}.`,
        }];
        pushFloat(state, { kind: "damage", target: "creature", side: target.side, instId: c.instId, amount: dmg });
      }
      return;
    }
    case "burn_champion": {
      state.burn[oside] = (state.burn[oside] || 0) + (fx.x || 1);
      state.log = [...state.log, {
        side,
        text: `🔥 ${def.name} applica Bruciatura ${fx.x} al campione avversario.`,
      }];
      triggerSecrets(state, oside, "burn_applied", { stacks: fx.x || 1 });
      return;
    }
    case "aoe": {
      // All enemy creatures take `amount` damage. Emit one float per
      // creature so the UI animates each hit individually.
      for (const c of state.board[oside]) {
        const tDef = TCG_CARDS[c.cardId];
        const mul = elementMultiplier(def.element, tDef.element);
        const dmg = Math.max(0, Math.round((fx.amount || 0) * mul));
        if (dmg <= 0) continue;
        c.hp = Math.max(0, c.hp - dmg);
        pushFloat(state, { kind: "damage", target: "creature", side: oside, instId: c.instId, amount: dmg });
      }
      state.log = [...state.log, {
        side,
        text: `💥 ${def.name} colpisce tutte le creature avversarie per ~${fx.amount} danni.`,
      }];
      return;
    }
    case "aoe_full": {
      // amount damage to all enemy creatures + opp champion
      for (const c of state.board[oside]) {
        c.hp = Math.max(0, c.hp - (fx.amount || 0));
        if ((fx.amount || 0) > 0) {
          pushFloat(state, { kind: "damage", target: "creature", side: oside, instId: c.instId, amount: fx.amount });
        }
      }
      dealChampionDamage(state, oside, fx.amount || 0);
      state.log = [...state.log, {
        side,
        text: `🌪 ${def.name} infligge ${fx.amount} danni a tutto lo schieramento nemico (creature e campione).`,
      }];
      return;
    }
    case "heal_champion": {
      const before = state.hp[side];
      state.hp[side] = Math.min(STARTING_HP, state.hp[side] + (fx.amount || 0));
      const gained = state.hp[side] - before;
      if (gained > 0) {
        state.log = [...state.log, {
          side,
          text: `💞 ${def.name} cura il campione di ${gained} PF.`,
        }];
        pushFloat(state, { kind: "heal", target: "champion", side, amount: gained });
      }
      if (fx.draw) {
        for (let i = 0; i < fx.draw; i++) drawCard(state, side);
      }
      return;
    }
    case "bounce": {
      if (!target || target.kind !== "creature") return;
      const owner = target.side;
      const idx = state.board[owner].findIndex(c => c.instId === target.instId);
      if (idx < 0) return;
      const bc = state.board[owner][idx];
      state.board[owner].splice(idx, 1);
      const cdef = TCG_CARDS[bc.cardId];
      if (state.hand[owner].length < MAX_HAND) {
        state.hand[owner].push(makeHandCard(bc.cardId));
        state.log = [...state.log, {
          side,
          text: `🌀 ${def.name} riporta ${cdef.name} nella mano del proprietario.`,
        }];
      } else {
        state.graveyard[owner].push(bc.cardId);
        state.log = [...state.log, {
          side,
          text: `🌀 ${def.name} riporta ${cdef.name} via, ma la mano è piena: va al cimitero.`,
        }];
      }
      return;
    }
    case "buff": {
      if (!target || target.kind !== "creature") return;
      const c = state.board[target.side]?.find(x => x.instId === target.instId);
      if (!c) return;
      c.atk   += fx.atk || 0;
      c.maxHp += fx.hp  || 0;
      c.hp    += fx.hp  || 0;
      if (fx.grants?.length) {
        c.grants = [...(c.grants || []), ...fx.grants];
      }
      state.log = [...state.log, {
        side,
        text: `🪨 ${def.name} potenzia ${TCG_CARDS[c.cardId].name}` +
          ` (+${fx.atk}/+${fx.hp}${fx.grants?.length ? ` · concede ${fx.grants.map(g => TCG_MECHANICS[g]?.name || g).join(", ")}` : ""}).`,
      }];
      return;
    }
    case "grant_keyword": {
      if (!target || target.kind !== "creature") return;
      const c = state.board[target.side]?.find(x => x.instId === target.instId);
      if (!c) return;
      c.grants = [...(c.grants || []), fx.keyword];
      if (fx.value != null) {
        c.grantedValues = { ...(c.grantedValues || {}), [fx.keyword]: fx.value };
      }
      const mLabel = TCG_MECHANICS[fx.keyword]?.name || fx.keyword;
      state.log = [...state.log, {
        side,
        text: `🌱 ${def.name} concede ${mLabel}${fx.value != null ? ` ${fx.value}` : ""} a ${TCG_CARDS[c.cardId].name}.`,
      }];
      return;
    }
    case "global_buff": {
      let n = 0;
      for (const c of state.board[side]) {
        c.atk   += fx.atk || 0;
        c.maxHp += fx.hp  || 0;
        c.hp    += fx.hp  || 0;
        n++;
      }
      state.log = [...state.log, {
        side,
        text: `🙏 ${def.name} potenzia le tue ${n} creature (+${fx.atk}/+${fx.hp}).`,
      }];
      return;
    }
    case "destroy": {
      if (!target || target.kind !== "creature") return;
      const c = state.board[target.side]?.find(x => x.instId === target.instId);
      if (!c) return;
      // Filter is enforced by isValidSpellTarget, but double-check.
      const cdef = TCG_CARDS[c.cardId];
      if (fx.filter?.minAtk != null && cdef.atk < fx.filter.minAtk) return;
      if (fx.filter?.maxAtk != null && cdef.atk > fx.filter.maxAtk) return;
      c.hp = 0; // resolveDeaths will process veil/cinder/etc.
      state.log = [...state.log, {
        side,
        text: `✨ ${def.name} dissolve ${cdef.name}.`,
      }];
      return;
    }
    case "raise_dead": {
      const grave = state.graveyard[side];
      for (let i = grave.length - 1; i >= 0; i--) {
        const id = grave[i];
        const cdef = TCG_CARDS[id];
        if (cdef && getCardType(cdef) === "creature") {
          if (state.hand[side].length >= MAX_HAND) {
            state.log = [...state.log, {
              side,
              text: `🗑 Mano piena: ${cdef.name} resta nel cimitero.`,
            }];
            return;
          }
          grave.splice(i, 1);
          state.hand[side].push(makeHandCard(id));
          state.log = [...state.log, {
            side,
            text: `☠ ${def.name} riporta ${cdef.name} dal cimitero alla mano.`,
          }];
          return;
        }
      }
      state.log = [...state.log, {
        side,
        text: `(${def.name}: nessuna creatura nel cimitero)`,
      }];
      return;
    }

    /* ── Enchantment effects ───────────────────────────────── */
    case "grant_temp_keyword": {
      // Attach a temporary keyword to an ally creature. Expires when
      // the round counter exceeds (round_at_cast + duration).
      if (!target || target.kind !== "creature") return;
      const c = state.board[target.side]?.find(x => x.instId === target.instId);
      if (!c) return;
      const dur = fx.duration || 2;
      c.tempBuffs = [
        ...(c.tempBuffs || []),
        {
          keyword: fx.keyword,
          value:   fx.value ?? null,
          expiresOnRound: state.round + dur,
        },
      ];
      const mLabel = TCG_MECHANICS[fx.keyword]?.name || fx.keyword;
      state.log = [...state.log, {
        side,
        text: `🌟 ${def.name}: ${TCG_CARDS[c.cardId].name} riceve ${mLabel} per ~${dur} turni.`,
      }];
      return;
    }
    case "champion_regen": {
      // Stack on the side that cast it. Heals at start of their turn.
      state.champRegen[side] = (state.champRegen[side] || 0) + (fx.amount || 0);
      state.log = [...state.log, {
        side,
        text: `👑 ${def.name}: il tuo campione recupererà ${fx.amount} PF all'inizio di ogni tuo turno.`,
      }];
      return;
    }
    case "wake": {
      // Clear summoning sickness AND tapped state on an ally creature,
      // so it can attack immediately this turn even if just summoned.
      if (!target || target.kind !== "creature") return;
      const c = state.board[target.side]?.find(x => x.instId === target.instId);
      if (!c) return;
      const wasSick   = c.sick;
      const wasTapped = c.tapped;
      c.sick   = false;
      c.tapped = false;
      if (wasSick || wasTapped) {
        state.log = [...state.log, {
          side,
          text: `🔥 ${def.name}: ${TCG_CARDS[c.cardId].name} si scuote e attacca subito.`,
        }];
      }
      return;
    }

    /* ── Counter effects ───────────────────────────────────── */
    case "extinguish": {
      // Wipe ALL Bruciatura stacks from YOUR champion.
      const before = state.burn[side] || 0;
      state.burn[side] = 0;
      state.log = [...state.log, {
        side,
        text: before > 0
          ? `💧 ${def.name}: ${before} turn${before === 1 ? "o" : "i"} di Bruciatura cancellat${before === 1 ? "o" : "i"}.`
          : `💧 ${def.name}: nessuna Bruciatura da spegnere.`,
      }];
      return;
    }
    case "dispel": {
      // Strip all granted keywords/values and temp buffs from an enemy
      // creature. ATK/HP boosts baked into the creature's stats are
      // NOT reverted (see project_tcg_v2 memory for the trade-off).
      if (!target || target.kind !== "creature") return;
      const c = state.board[target.side]?.find(x => x.instId === target.instId);
      if (!c) return;
      const removedGrants = (c.grants || []).length + (c.tempBuffs || []).length;
      c.grants = [];
      c.grantedValues = {};
      c.tempBuffs = [];
      state.log = [...state.log, {
        side,
        text: removedGrants > 0
          ? `🌬 ${def.name}: ${TCG_CARDS[c.cardId].name} perde ${removedGrants} effett${removedGrants === 1 ? "o magico" : "i magici"}.`
          : `🌬 ${def.name}: nessuna magia da dissolvere su ${TCG_CARDS[c.cardId].name}.`,
      }];
      return;
    }
    case "damage_shield": {
      state.dmgShield[side] = (state.dmgShield[side] || 0) + (fx.amount || 0);
      state.log = [...state.log, {
        side,
        text: `🛡 ${def.name}: il tuo campione ottiene ${fx.amount} PF di Argine assorbente.`,
      }];
      return;
    }

    default:
      return;
  }
}

function computeSpellMultiplier(spellDef, target, state) {
  if (target.kind !== "creature") return 1;
  const c = state.board[target.side]?.find(x => x.instId === target.instId);
  if (!c) return 1;
  const tDef = TCG_CARDS[c.cardId];
  return elementMultiplier(spellDef.element, tDef.element);
}

/* ════════════════════════════════════════════════════════════
   COMBAT — declare-all-attackers (MTG-style)
   The active player declares ANY number of their creatures as
   attackers; the defender then assigns blockers per attacker
   (each defender creature blocks at most one attacker); then
   everything resolves together. Attackers hit the opponent's
   hero unless blocked.
   ════════════════════════════════════════════════════════════ */

export function declareAttackers(state, side, attackerInstIds) {
  if (state.winner) return state;
  if (state.activeSide !== side) return state;
  if (state.phase !== "main") return state;
  const ids = [...new Set(Array.isArray(attackerInstIds) ? attackerInstIds : [])]
    .filter(id => canAttack(state, side, id));
  if (ids.length === 0) return state;
  const next = clone(state);
  for (const id of ids) {
    const a = next.board[side].find(c => c.instId === id);
    if (a) a.tapped = true;
  }
  next.combat = {
    side,
    attackers: ids,
    blocks: {},
    ts: Date.now(),
    expiry: Date.now() + TURN_DURATION_MS,
  };
  next.phase = "block";
  const names = ids
    .map(id => TCG_CARDS[next.board[side].find(c => c.instId === id)?.cardId]?.name)
    .filter(Boolean)
    .join(", ");
  next.lastAttack = { attacker: ids[0], target: null, side, flying: false, ts: Date.now() };
  next.log = [...next.log, {
    side,
    text: `🗡 ${sideName(side)} dichiara l'attacco con ${ids.length} creatur${ids.length === 1 ? "a" : "e"}: ${names}.`,
  }];
  return next;
}

/* Defender creatures that may legally block THIS attacker:
   untapped, flying-evasion respected, not already assigned to a
   different attacker in this combat. */
export function legalBlockersFor(state, attackerInstId) {
  const cm = state.combat;
  if (!cm || state.phase !== "block") return [];
  if (!cm.attackers.includes(attackerInstId)) return [];
  const atkSide = cm.side;
  const defSide = opp(atkSide);
  const attacker = state.board[atkSide]?.find(c => c.instId === attackerInstId);
  if (!attacker) return [];
  const attackerFlies = effectiveMechanics(attacker).includes("flying");
  const usedElsewhere = new Set();
  for (const [aid, list] of Object.entries(cm.blocks || {})) {
    if (aid === attackerInstId) continue;
    for (const b of list) usedElsewhere.add(b);
  }
  return (state.board[defSide] || [])
    .filter(c => {
      if (c.tapped) return false;
      if (usedElsewhere.has(c.instId)) return false;
      if (attackerFlies) {
        const m = effectiveMechanics(c);
        if (!m.includes("flying") && !m.includes("cacciatore")) return false;
      }
      return true;
    })
    .map(c => c.instId);
}

/* Toggle a blocker onto an attacker (a blocker blocks only one
   attacker — it is removed from any other first). */
export function assignBlock(state, defenderSide, attackerInstId, blockerInstId) {
  const cm = state.combat;
  if (state.winner || !cm || state.phase !== "block") return state;
  if (defenderSide !== opp(cm.side)) return state;
  if (!cm.attackers.includes(attackerInstId)) return state;
  const next = clone(state);
  const blocks = next.combat.blocks || (next.combat.blocks = {});
  const cur = blocks[attackerInstId] || [];
  if (cur.includes(blockerInstId)) {
    blocks[attackerInstId] = cur.filter(b => b !== blockerInstId);
    return next;
  }
  if (!legalBlockersFor(next, attackerInstId).includes(blockerInstId)) return state;
  for (const aid of Object.keys(blocks)) {
    blocks[aid] = (blocks[aid] || []).filter(b => b !== blockerInstId);
  }
  blocks[attackerInstId] = [...(blocks[attackerInstId] || []), blockerInstId];
  return next;
}

/* Bulwark = "must block if able": confirm is blocked while an
   unassigned defender Bulwark could still legally block some
   declared attacker. */
export function combatBlockMandatoryUnmet(state) {
  const cm = state.combat;
  if (!cm || state.phase !== "block") return false;
  const defSide = opp(cm.side);
  const assigned = new Set();
  for (const list of Object.values(cm.blocks || {})) for (const b of list) assigned.add(b);
  return (state.board[defSide] || []).some(c => {
    if (assigned.has(c.instId)) return false;
    if (c.tapped) return false;
    if (!effectiveMechanics(c).includes("bulwark")) return false;
    return cm.attackers.some(aid => legalBlockersFor(state, aid).includes(c.instId));
  });
}

/* Resolve ONE attacker vs its assigned blockers (or the hero).
   Reuses every keyword rule (Avanguardia / Letale / Affondo /
   Vampirismo / Bruciatura via resolveTrigger; Rinato / Cenere
   via resolveDeaths). */
function resolveOneAttacker(next, atkSide, attackerInstId, blockerIds) {
  const oside = opp(atkSide);
  const attacker = next.board[atkSide].find(c => c.instId === attackerInstId);
  if (!attacker) return;
  const aDef  = TCG_CARDS[attacker.cardId];
  const aMech = effectiveMechanics(attacker);
  const bruciaturaX = effectiveMechValue(attacker, "bruciatura") || 0;
  const blockers = (blockerIds || [])
    .map(id => next.board[oside].find(c => c.instId === id))
    .filter(b => b && b.hp > 0);

  next.lastAttack = {
    attacker: attackerInstId,
    target: blockers[0]?.instId || null,
    side: atkSide,
    flying: aMech.includes("flying"),
    ts: Date.now(),
  };

  if (blockers.length === 0) {
    const dmg = attacker.atk;
    dealChampionDamage(next, oside, dmg);
    next.log = [...next.log, {
      side: atkSide,
      text: `⚔ ${aDef.name} colpisce direttamente per ${dmg} danni!`,
    }];
    if (bruciaturaX > 0 && dmg > 0) {
      resolveTrigger(next, { trig: "bruciatura", side: oside, stacks: bruciaturaX, logSide: atkSide, variant: "turnstart" });
    }
    resolveTrigger(next, { trig: "soulburn", side: atkSide, dmg, mech: aMech });
    return;
  }

  const blkNames = blockers.map(b => TCG_CARDS[b.cardId].name).join(", ");
  next.log = [...next.log, {
    side: atkSide,
    text: `🛡 ${blkNames} blocca${blockers.length > 1 ? "no" : ""} ${aDef.name}.`,
  }];

  const anyBlockerVanguard = blockers.some(b => effectiveMechanics(b).includes("vanguard"));
  const aFirst = aMech.includes("vanguard") && !anyBlockerVanguard;
  const tFirst = anyBlockerVanguard && !aMech.includes("vanguard");
  const aReckon = aMech.includes("reckon");

  const distribute = () => {
    let pool = attacker.atk, dealt = 0;
    for (const b of blockers) {
      if (pool <= 0) break;
      if (b.hp <= 0) continue;
      const mul = elementMultiplier(aDef.element, TCG_CARDS[b.cardId].element);
      const rawNeed  = aReckon ? 1 : (mul > 0 ? Math.ceil(b.hp / mul) : b.hp);
      const rawSpent = Math.min(pool, rawNeed);
      const dmg      = aReckon ? b.hp : Math.round(rawSpent * mul);
      dealDamageToCreature(next, atkSide, b, dmg, attacker, aMech, mul, attacker.atk);
      pool -= rawSpent; dealt += dmg;
    }
    return { leftover: pool, dealt };
  };
  const blockersStrike = () => {
    for (const b of blockers) {
      if (b.hp <= 0) continue;
      const bMech = effectiveMechanics(b);
      const tMul  = elementMultiplier(TCG_CARDS[b.cardId].element, aDef.element);
      dealDamageToCreature(next, oside, attacker, Math.round(b.atk * tMul), b, bMech, tMul, b.atk);
    }
  };

  let leftover = 0, aDealt = 0;
  if (aFirst) {
    ({ leftover, dealt: aDealt } = distribute());
    blockersStrike();
  } else if (tFirst) {
    blockersStrike();
    if (attacker.hp > 0) ({ leftover, dealt: aDealt } = distribute());
    else next.log = [...next.log, { side: oside, text: `💢 ${aDef.name} cade prima di colpire!` }];
  } else {
    ({ leftover, dealt: aDealt } = distribute());
    blockersStrike();
  }

  if (aMech.includes("pierce") && leftover > 0) {
    dealChampionDamage(next, oside, leftover);
    next.log = [...next.log, {
      side: atkSide,
      text: `🩸 Affondo! ${leftover} danni passano al campione avversario.`,
    }];
    if (bruciaturaX > 0) {
      resolveTrigger(next, { trig: "bruciatura", side: oside, stacks: bruciaturaX, logSide: atkSide, variant: "pierce" });
    }
  }

  resolveTrigger(next, { trig: "soulburn", side: atkSide, dmg: aDealt, mech: aMech });
  const aliveBlk = blockers.filter(b => b.hp > 0).map(b => TCG_CARDS[b.cardId].name);
  const deadBlk  = blockers.filter(b => b.hp <= 0).map(b => TCG_CARDS[b.cardId].name);
  next.log = [...next.log, {
    side: atkSide,
    text: `🛡 Esito — ${aDef.name}: ${attacker.hp > 0 ? `sopravvive (${attacker.hp} PF)` : "distrutto"}`
      + (deadBlk.length ? ` · uccide: ${deadBlk.join(", ")}` : "")
      + (aliveBlk.length ? ` · resistono: ${aliveBlk.join(", ")}` : ""),
  }];
}

function resolveCombat(next) {
  const cm = next.combat;
  if (!cm) return;
  const atkSide = cm.side;
  for (const aid of cm.attackers) {
    resolveOneAttacker(next, atkSide, aid, (cm.blocks || {})[aid] || []);
    resolveDeaths(next);
    if (next.winner) break;
  }
  next.combat = null;
  next.phase = "main";
  if (!next.winner) {
    if (next.hp[opp(atkSide)] <= 0) endGame(next, atkSide, "PF azzerati");
    else if (next.hp[atkSide] <= 0) endGame(next, opp(atkSide), "PF azzerati (rappresaglia)");
  }
}

export function confirmBlocks(state, defenderSide) {
  if (state.winner) return state;
  const cm = state.combat;
  if (!cm || state.phase !== "block") return state;
  if (defenderSide !== opp(cm.side)) return state;
  if (combatBlockMandatoryUnmet(state)) return state;
  const next = clone(state);
  resolveCombat(next);
  return next;
}

export function resolveCombatTimeout(state) {
  const cm = state.combat;
  if (!cm || state.phase !== "block") return state;
  const next = clone(state);
  next.log = [...next.log, {
    side: opp(cm.side),
    text: `⏰ Il difensore non assegna i blocchi in tempo — il combattimento si risolve.`,
  }];
  resolveCombat(next);
  return next;
}

function dealDamageToCreature(state, attackerSide, victim, rawDmg, dealer, dealerMech, mul = 1, baseAtk = null) {
  if (rawDmg <= 0) return;
  const victimSide = opp(attackerSide);
  const isReckon = (dealerMech || []).includes("reckon");
  // Build a "[3 × ×1.5]" math hint when we have the base ATK; collapses to
  // empty for plain ×1 hits so we don't clutter every line.
  const mathHint = (baseAtk != null && (mul !== 1 || isReckon))
    ? ` [${baseAtk}${mul !== 1 ? ` × ×${mul}` : ""}${isReckon ? " · Letale" : ""}]`
    : "";
  if (isReckon) {
    const wasHp = victim.hp;
    victim.hp = 0;
    state.log = [...state.log, {
      side: attackerSide,
      text: `☠ Letale! ${TCG_CARDS[victim.cardId].name} viene distrutto sul colpo${mathHint}.`,
    }];
    pushFloat(state, { kind: "damage", target: "creature", side: victimSide, instId: victim.instId, amount: wasHp });
  } else {
    victim.hp = Math.max(0, victim.hp - rawDmg);
    state.log = [...state.log, {
      side: attackerSide,
      text: `→ ${TCG_CARDS[victim.cardId].name} subisce ${rawDmg} danni${mathHint} (${victim.hp}/${victim.maxHp} PF).`,
    }];
    pushFloat(state, { kind: "damage", target: "creature", side: victimSide, instId: victim.instId, amount: rawDmg });
  }
}

function applySoulburn(state, side, dmg, mech) {
  if (!mech || !mech.includes("soulburn")) return;
  if (dmg <= 0) return;
  const before = state.hp[side];
  state.hp[side] = Math.min(STARTING_HP + 5, state.hp[side] + dmg);
  const gained = state.hp[side] - before;
  if (gained > 0) {
    state.log = [...state.log, {
      side,
      text: `💞 Vampirismo: ${sideName(side)} recupera ${gained} PF.`,
    }];
    pushFloat(state, { kind: "heal", target: "champion", side, amount: gained });
  }
}

/* ── STAGE 0: the effect seam ──────────────────────────────────
   Every state-mutating effect can be expressed as a tagged
   descriptor and applied through this single dispatcher. Today it
   is a thin, behaviour-neutral pass-through to the existing
   helpers (same args, same order, identical result). Later stages
   (stack / priority) will route these through a queue WITHOUT
   touching the call sites again. Mutates `next` in place; only
   `damage_champion` returns a value (remaining damage), preserved
   for callers that read it. */
function resolveEffect(next, effect) {
  switch (effect.kind) {
    case "damage_creature":
      dealDamageToCreature(
        next, effect.attackerSide, effect.victim, effect.rawDmg,
        effect.dealer, effect.dealerMech, effect.mul, effect.baseAtk,
      );
      return undefined;
    case "damage_champion":
      return dealChampionDamage(next, effect.side, effect.amount, effect.opts || {});
    case "spell_effect":
      applySpellEffect(next, effect.side, effect.def, effect.targetSpec);
      return undefined;
    case "soulburn":
      applySoulburn(next, effect.side, effect.dmg, effect.mech);
      return undefined;
    case "deaths":
      resolveDeaths(next);
      return undefined;
    default:
      return undefined;
  }
}

/* ── STAGE 1: the effect stack ─────────────────────────────────
   Casting pushes a stack object; resolveStack() pops LIFO and
   applies it through the Stage-0 seam. Stage 1 has NO response
   window — resolveStack() is called immediately after the push,
   so a single spell behaves byte-identically to before. The
   loop already resolves one object at a time with deaths/endgame
   between pops, which is exactly the shape Stages 2-4 build on.
   Only `cardId` is stored (not the def object) so the stack stays
   small / serialises cleanly to Firestore. */
function pushStack(next, obj) {
  if (!Array.isArray(next.stack)) next.stack = [];
  next.stack.push(obj);
}
/* Resolve ONE popped stack object. A "spell" applies its effect
   (Stage-1 tail). A "response" (counter cast on the stack) cancels
   the object directly below it — the thing it was cast in response
   to — sending that card to its owner's graveyard with no effect. */
/* ── STAGE 4b: triggered-ability dispatcher ────────────────────
   Triggered abilities ("when X dies / when Y happens") are
   expressed as trigger descriptors and applied through this one
   funnel. Migrated one keyword family at a time; each migration
   is behaviour-neutral (same effect, same log, same order) so it
   can be parity-checked. First family: Cenere (cinder). */
function resolveTrigger(next, trig) {
  switch (trig.trig) {
    case "cinder": {
      dealChampionDamage(next, trig.side, trig.amount);
      next.log = [...next.log, {
        side: trig.owner,
        text: `💥 Cenere! ${trig.name} esplode infliggendo ${trig.amount} danni al campione avversario.`,
      }];
      return;
    }
    case "veil": {
      trig.bc.hp = 1;
      trig.bc.revived = true;
      trig.bc.tapped = true;
      next.log = [...next.log, {
        side: trig.owner,
        text: `👻 Rinato! ${trig.name} torna in piedi con 1 PF.`,
      }];
      return;
    }
    case "bruciatura": {
      next.burn[trig.side] = (next.burn[trig.side] || 0) + trig.stacks;
      next.log = [...next.log, {
        side: trig.logSide,
        text: trig.variant === "turnstart"
          ? `🔥 Bruciatura ${trig.stacks}: il campione subirà 1 danno all'inizio dei prossimi ${trig.stacks} turni.`
          : `🔥 Bruciatura ${trig.stacks}: il campione subirà 1 danno per ${trig.stacks} turni.`,
      }];
      triggerSecrets(next, trig.side, "burn_applied", { stacks: trig.stacks });
      return;
    }
    case "soulburn":
      applySoulburn(next, trig.side, trig.dmg, trig.mech);
      return;
    case "affinity":
      applyAffinity(next, trig.side, trig.def);
      return;
    case "secret":
      // Secrets (Contromagie face-down) are reactive triggers too.
      // The matcher/queue stays in triggerSecrets(); only the
      // EFFECT application is unified here. Timing unchanged — the
      // result (e.g. { cancelled }) is forwarded to the caller.
      return resolveSecret(next, trig.defenderSide, trig.def, trig.eventData);
    default:
      return;
  }
}

/* ── STAGE 4a: state-based actions ─────────────────────────────
   The canonical "between resolutions" check: clear dead creatures
   (Rinato / Cenere / graveyard via resolveDeaths) then award the
   game on a 0-PF champion. `winnerOnTie` keeps the win if BOTH
   champions are at 0 simultaneously — passing the effect's
   controller here reproduces the previous inline spell behaviour
   exactly (caster wins the tie). This single funnel is the hook
   Stage 4b (triggered-ability objects) will extend. */
function checkStateBasedActions(next, winnerOnTie) {
  resolveEffect(next, { kind: "deaths" });
  if (next.winner) return;
  const cDead = next.hp.challenger <= 0;
  const dDead = next.hp.challenged <= 0;
  if (cDead && dDead) {
    endGame(next, winnerOnTie || "challenger", "PF azzerati");
  } else if (cDead) {
    endGame(next, "challenged", "PF azzerati");
  } else if (dDead) {
    endGame(next, "challenger", "PF azzerati");
  }
}

function resolveStackObject(next, obj) {
  if (!obj) return;
  if (obj.kind === "spell") {
    const def = TCG_CARDS[obj.cardId];
    if (!def) return;
    const ctrl = obj.controller;
    resolveEffect(next, { kind: "spell_effect", side: ctrl, def, targetSpec: obj.targetSpec });
    next.graveyard[ctrl] = [...next.graveyard[ctrl], obj.cardId];
    resolveTrigger(next, { trig: "affinity", side: ctrl, def });
    checkStateBasedActions(next, ctrl);
    return;
  }
  if (obj.kind === "response") {
    const rDef = TCG_CARDS[obj.cardId];
    const ctrl = obj.controller;
    const victim = (Array.isArray(next.stack) && next.stack.length > 0)
      ? next.stack.pop() : null;
    if (victim) {
      const vDef = TCG_CARDS[victim.cardId];
      next.graveyard[victim.controller] =
        [...next.graveyard[victim.controller], victim.cardId];
      next.log = [...next.log, {
        side: ctrl,
        text: `🛡 ${rDef?.name || "Contromagia"} annulla ${vDef?.name || "l'effetto"}.`,
      }];
    } else {
      next.log = [...next.log, {
        side: ctrl,
        text: `🛡 ${rDef?.name || "Contromagia"} svanisce: nessun bersaglio.`,
      }];
    }
    next.graveyard[ctrl] = [...next.graveyard[ctrl], obj.cardId];
    return;
  }
}
/* Pop & resolve exactly ONE object (interactive ping-pong path). */
function resolveTopOfStack(next) {
  if (!Array.isArray(next.stack) || next.stack.length === 0) return;
  resolveStackObject(next, next.stack.pop());
}
/* Full drain — used by the timeout fallback so a stalled stack can
   never hard-lock the match. */
function resolveStack(next) {
  while (Array.isArray(next.stack) && next.stack.length > 0) {
    resolveTopOfStack(next);
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
      const mech = effectiveMechanics(bc);
      if (mech.includes("veil") && !bc.revived) {
        resolveTrigger(state, { trig: "veil", bc, name: def.name, owner: s });
        survivors.push(bc);
        continue;
      }
      if (mech.includes("cinder")) {
        resolveTrigger(state, {
          trig: "cinder", side: oside, amount: 2, name: def.name, owner: s,
        });
      }
      state.graveyard[s] = [...state.graveyard[s], bc.cardId];
      // Cosmetic only: tells the UI which creature died and when so it
      // can keep the card on the field (death animation) until the
      // combat/effect replay finishes. Does not affect game outcome.
      pushFloat(state, {
        kind: "death", target: "creature", side: s,
        instId: bc.instId, cardId: bc.cardId,
      });
      state.log = [...state.log, {
        side: s,
        text: `💀 ${def.name} viene distrutto.`,
      }];
    }
    state.board[s] = survivors;
  }
}

function endGame(state, winnerSide, reason) {
  if (state.winner) return;
  state.winner = winnerSide;
  state.phase = "ended";
  state.log = [...state.log, {
    side: winnerSide,
    text: `🏆 Vittoria di ${sideName(winnerSide)} (${reason})!`,
  }];
}

/* ── Action: discard a card from hand ─────────────────────
   Lets a player voluntarily send a hand card to the graveyard.
   Useful when the hand cap (MAX_HAND) is about to silently burn
   freshly-drawn cards, giving the player agency to pick which one
   to drop. Only allowed during your own turn, before the game
   ends, and the card must currently be in your hand. */
export function discardCard(state, side, instId) {
  if (state.winner) return state;
  if (state.activeSide !== side) return state;
  const next = clone(state);
  const idx = next.hand[side].findIndex(c => c.instId === instId);
  if (idx < 0) return state;
  const card = next.hand[side][idx];
  const def = TCG_CARDS[card.cardId];
  next.hand[side].splice(idx, 1);
  next.graveyard[side] = [...next.graveyard[side], card.cardId];
  next.log = [...next.log, {
    side,
    text: `🗑 ${sideName(side)} scarta ${def?.name || card.cardId}.`,
    kind: "discard",
  }];
  return next;
}

/* ── Action: end turn ─────────────────────────────────────── */
export function endTurn(state, side) {
  if (state.winner) return state;
  if (state.activeSide !== side) return state;
  if (state.phase !== "main") return state; // resolve the open block/stack first
  const next = clone(state);
  next.log = [...next.log, {
    side,
    text: `⏭ ${sideName(side)} passa il turno.`,
  }];
  return startTurn(next, opp(side));
}

/* ── Action: auto-skip turn (timeout) ─────────────────────────
   Fires when the active player's TURN_DURATION_MS deadline passes.
   `side` is the side BEING SKIPPED (the active one), so any
   client — including the spectator — can trigger this once the
   deadline lapses.

   Rule: if the auto-skipped player is holding more cards than the
   hand cap (MAX_HAND), the excess cards are discarded oldest-first
   so the turn always ends with the hand within the cap. */
export function autoSkipTurn(state, side) {
  if (state.winner) return state;
  // A pending block timed out: resolve it as "no block" instead of
  // skipping the attacker's whole turn.
  if (state.phase === "block") return resolveCombatTimeout(state);
  if (state.phase === "stack") return resolveStackTimeout(state);
  if (state.activeSide !== side) return state;
  let next = clone(state);
  const overflow = (next.hand[side]?.length || 0) - MAX_HAND;
  if (overflow > 0) {
    for (let i = 0; i < overflow; i++) {
      const card = next.hand[side].shift();
      if (!card) break;
      const def = TCG_CARDS[card.cardId];
      next.graveyard[side] = [...next.graveyard[side], card.cardId];
      next.log = [...next.log, {
        side,
        text: `🗑 ${sideName(side)} (timeout): scarta ${def?.name || card.cardId}.`,
        kind: "discard",
      }];
    }
  }
  next.log = [...next.log, {
    side,
    text: `⏰ ${sideName(side)} non ha agito in tempo — turno passato automaticamente.`,
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
  if (state.phase !== "main") return false; // a stack/block window is open
  const card = state.hand[side].find(c => c.instId === instId);
  if (!card) return false;
  const def = TCG_CARDS[card.cardId];
  if (!def) return false;
  const cardType = getCardType(def);
  /* Crystals are free to play but limited to 1/turn. They go to the
     crystal field, not the creature board, so MAX_BOARD doesn't apply. */
  if (cardType === "crystal") {
    return (state.crystalsPlayedThisTurn?.[side] || 0) < MAX_CRYSTALS_PER_TURN;
  }
  // Every other card type costs mana — check the per-element pool.
  if (!canAffordCost(state.mana?.[side], normalizeCost(def))) return false;
  if (cardType === "creature") {
    return state.board[side].length < MAX_BOARD;
  }
  // Counter trap: zone must have room
  if (cardType === "counter" && def.effect?.trigger) {
    return (state.secrets[side]?.length || 0) < MAX_SECRETS;
  }
  // Spell or enchantment: must have a legal target if it requires one
  const need = def.effect?.target || "none";
  if (need === "none") return true;
  return hasAnyLegalSpellTarget(state, side, def);
}

export function canAttack(state, side, instId) {
  if (state.winner || state.activeSide !== side) return false;
  if (state.phase !== "main") return false; // a block/stack window is open
  const c = state.board[side].find(x => x.instId === instId);
  if (!c) return false;
  if (c.sick || c.tapped) return false;
  if (effectiveMechanics(c).includes("bulwark")) return false;
  return true;
}

/* ── predictCombat ────────────────────────────────────────────
   Read-only outcome prediction used by the UI to show players
   what an attack will do BEFORE they commit. Honors Letale
   (any dmg = kill), Avanguardia (first-strike order, defender
   may not retaliate if it dies), Rinato (the first death
   resolves to 1 PF), Affondo (excess damage spills to face),
   Bruciatura (face-hit DoT). Mirrors the live attackWith()
   resolution rules so the badge in the UI doesn't lie.

   Returns null when the attack is illegal, or:
     { kind: "face",     targetDmg, bruciatura }
     { kind: "creature", aDmg, tDmg, aDies, tDies,
                         multiplier (a→t), counterMul (t→a),
                         pierceDmg, targetRevives, bruciatura,
                         attackerName, targetName }
   ──────────────────────────────────────────────────────────── */
export function predictCombat(state, side, attackerInstId, targetInstId) {
  const attacker = state.board[side]?.find(c => c.instId === attackerInstId);
  if (!attacker) return null;
  const oside = opp(side);
  const aMech = effectiveMechanics(attacker);
  const aDef = TCG_CARDS[attacker.cardId];
  const bruciaturaX = effectiveMechValue(attacker, "bruciatura") || 0;

  if (targetInstId === null) {
    // Face hit prediction (no retaliation from champion). Visible Argine
    // (dmgShield[oside]) is folded in; hidden secrets aren't, since the
    // opponent's secret zone is intentionally not revealed.
    const dmg     = attacker.atk;
    const shield  = state.dmgShield?.[oside] || 0;
    const dmgLand = Math.max(0, dmg - shield);
    const hpBefore = state.hp[oside];
    const hpAfter  = Math.max(0, hpBefore - dmgLand);
    return {
      kind: "face",
      targetDmg: dmg,
      shieldAbsorb: Math.min(shield, dmg),
      bruciatura: bruciaturaX,
      attackerName: aDef?.name,
      championHpBefore: hpBefore,
      championHpAfter:  hpAfter,
    };
  }

  const target = state.board[oside]?.find(c => c.instId === targetInstId);
  if (!target) return null;
  const tDef = TCG_CARDS[target.cardId];
  const tMech = effectiveMechanics(target);

  const aMul = elementMultiplier(aDef.element, tDef.element);
  const tMul = elementMultiplier(tDef.element, aDef.element);
  const aBase = Math.round(attacker.atk * aMul); // damage TARGET would take
  const tBase = Math.round(target.atk   * tMul); // damage ATTACKER would take

  const aIsReckon = aMech.includes("reckon");
  const tIsReckon = tMech.includes("reckon");
  const aFirst = aMech.includes("vanguard") && !tMech.includes("vanguard");
  const tFirst = tMech.includes("vanguard") && !aMech.includes("vanguard");

  // Provisional outcomes assuming simultaneous strike.
  let damageToTarget   = aBase;
  let damageToAttacker = tBase;
  let tDies = aIsReckon ? aBase > 0 : aBase >= target.hp;
  let aDies = tIsReckon ? tBase > 0 : tBase >= attacker.hp;

  // Vanguard: the side that strikes first kills before the other can swing.
  if (aFirst && tDies) {
    damageToAttacker = 0; // target dies before retaliating
    aDies = false;
  }
  if (tFirst && aDies) {
    damageToTarget = 0;   // attacker falls before completing its strike
    tDies = false;
  }

  // Rinato (Veil): a "first death" pops the creature back at 1 PF instead of
  // killing it. We surface this so the player doesn't think they're trading
  // 1-for-1 when actually the enemy will live.
  const targetRevives   = tDies && tMech.includes("veil") && !target.revived;
  const attackerRevives = aDies && aMech.includes("veil") && !attacker.revived;

  // Affondo: overkill spills to the opponent's champion when the target dies
  // (excluding Reckon kills, which deal 0 "overflow").
  let pierceDmg = 0;
  if (tDies && !aIsReckon && aMech.includes("pierce")) {
    pierceDmg = Math.max(0, aBase - target.hp);
  }

  // Concrete HP before/after so the UI can render "❤ 8 → 0" rows. Veil
  // saves stamp the after-value at 1 instead of 0 so the badge agrees with
  // the post-combat reality.
  const targetHpBefore   = target.hp;
  const attackerHpBefore = attacker.hp;
  let   targetHpAfter   = Math.max(0, targetHpBefore   - damageToTarget);
  let   attackerHpAfter = Math.max(0, attackerHpBefore - damageToAttacker);
  if (tDies   && targetRevives)   targetHpAfter   = 1;
  if (aDies   && attackerRevives) attackerHpAfter = 1;

  return {
    kind: "creature",
    damageToTarget,
    damageToAttacker,
    targetDies: tDies,
    attackerDies: aDies,
    targetRevives,
    attackerRevives,
    targetHpBefore, targetHpAfter,
    attackerHpBefore, attackerHpAfter,
    multiplier: aMul,
    counterMul: tMul,
    pierceDmg,
    bruciatura: bruciaturaX,
    attackerName: aDef?.name,
    targetName: tDef?.name,
  };
}

export function legalAttackTargets(state, side, attackerInstId) {
  const oside = opp(side);
  const oppBoard = state.board[oside];
  const attacker = state.board[side].find(c => c.instId === attackerInstId);
  if (!attacker) return { creatures: [], face: false };

  const aMech = effectiveMechanics(attacker);
  const attackerFlies   = aMech.includes("flying");
  const attackerReaches = aMech.includes("cacciatore");

  // Full-MTG declare: the hero is ALWAYS a legal target (the
  // defender decides whether to block). The old lane-defense /
  // forced-Bulwark targeting is gone. A specific enemy creature
  // can still be singled out, but a flying one only by a flyer
  // or Cacciatore (it can't be reached on the ground).
  const reachable = (c) => {
    const cMech = effectiveMechanics(c);
    if (cMech.includes("flying") && !attackerFlies && !attackerReaches) return false;
    return true;
  };
  const creatures = oppBoard.filter(reachable).map(c => c.instId);
  return { creatures, face: true };
}

/* Spell target listing for the UI overlay. Returns the
   sides + instIds that satisfy the spell's `target` (and any
   filter). Used to highlight valid clicks. */
export function legalSpellTargets(state, side, instId) {
  const card = state.hand[side]?.find(c => c.instId === instId);
  if (!card) return null;
  const def = TCG_CARDS[card.cardId];
  if (!def || getCardType(def) === "creature") return null;
  const need = def.effect?.target || "none";
  if (need === "none") return { kind: "none" };
  const oside = opp(side);

  const matchesFilter = (c) => {
    const f = def.effect?.filter;
    if (!f) return true;
    const d = TCG_CARDS[c.cardId];
    if (f.minAtk != null && d.atk < f.minAtk) return false;
    if (f.maxAtk != null && d.atk > f.maxAtk) return false;
    return true;
  };

  if (need === "enemy_champion") return { champions: [oside] };
  if (need === "enemy_creature") {
    return {
      creatures: { [oside]: state.board[oside].filter(matchesFilter).map(c => c.instId) },
    };
  }
  if (need === "ally_creature") {
    return {
      creatures: { [side]: state.board[side].filter(matchesFilter).map(c => c.instId) },
    };
  }
  if (need === "any_creature") {
    return {
      creatures: {
        [side]:  state.board[side ].filter(matchesFilter).map(c => c.instId),
        [oside]: state.board[oside].filter(matchesFilter).map(c => c.instId),
      },
    };
  }
  if (need === "any") {
    return {
      champions: [oside],
      creatures: {
        [side]:  state.board[side ].filter(matchesFilter).map(c => c.instId),
        [oside]: state.board[oside].filter(matchesFilter).map(c => c.instId),
      },
    };
  }
  return null;
}

function hasAnyLegalSpellTarget(state, side, def) {
  const need = def.effect?.target || "none";
  if (need === "none") return true;
  const oside = opp(side);

  const matchesFilter = (c) => {
    const f = def.effect?.filter;
    if (!f) return true;
    const d = TCG_CARDS[c.cardId];
    if (f.minAtk != null && d.atk < f.minAtk) return false;
    if (f.maxAtk != null && d.atk > f.maxAtk) return false;
    return true;
  };

  if (need === "enemy_champion") return true;
  if (need === "enemy_creature") return state.board[oside].some(matchesFilter);
  if (need === "ally_creature")  return state.board[side ].some(matchesFilter);
  if (need === "any_creature")   return state.board[side ].some(matchesFilter) || state.board[oside].some(matchesFilter);
  if (need === "any")            return true;
  return false;
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

export function isValidDeck(deck) {
  if (!Array.isArray(deck) || deck.length !== DECK_SIZE) return false;
  return deck.every(id => !!TCG_CARDS[id]);
}

export function ownsDeck(deck, collection, foils = {}) {
  if (!Array.isArray(deck)) return false;
  const needed = {};
  for (const id of deck) needed[id] = (needed[id] || 0) + 1;
  for (const [id, n] of Object.entries(needed)) {
    const have = (collection?.[id] || 0) + (foils?.[id] || 0);
    if (have < n) return false;
  }
  return true;
}

export function deckCount(deck, cardId) {
  if (!Array.isArray(deck)) return 0;
  let n = 0;
  for (const id of deck) if (id === cardId) n++;
  return n;
}

export function autoBuildDeckFromCollection(collection, foils = {}) {
  const flat = [];
  for (const [id, n] of Object.entries(collection || {})) {
    if (!TCG_CARDS[id]) continue;
    for (let i = 0; i < n; i++) flat.push(id);
  }
  for (const [id, n] of Object.entries(foils || {})) {
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

export function resolveDeckForMatch(deck, collection, foils = {}) {
  let resolved;
  if (isValidDeck(deck) && ownsDeck(deck, collection, foils)) resolved = deck;
  else {
    const built = autoBuildDeckFromCollection(collection, foils);
    resolved = built || buildRandomDeck();
  }
  return ensureCrystals(resolved);
}

/* Make sure every match-bound deck carries enough Crystal cards so
   the player can actually pay for spells beyond turn 1. We don't
   require the user to own crystals (they're effectively "lands" —
   free utility cards); we just inject them on the fly. The crystals
   chosen mirror the deck's element distribution so the mana you draw
   matches the colors you want to cast. */
export function ensureCrystals(deck, minCount = Math.max(6, Math.round(DECK_SIZE * 0.28))) {
  if (!Array.isArray(deck) || deck.length !== DECK_SIZE) return deck;
  let crystalCount = 0;
  const elemCounts = {};
  for (const id of deck) {
    const def = TCG_CARDS[id];
    if (!def) continue;
    if (getCardType(def) === "crystal") { crystalCount++; continue; }
    if (def.element && ELEMENTS.includes(def.element)) {
      elemCounts[def.element] = (elemCounts[def.element] || 0) + 1;
    }
  }
  if (crystalCount >= minCount) return deck;
  const sortedEls = Object.entries(elemCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([e]) => e);
  // Distribute over the top 2-3 elements; fall back to fire/water if the
  // deck somehow has no element-tagged cards.
  const topEls = sortedEls.slice(0, 3);
  if (topEls.length === 0) topEls.push("fire", "water");

  const out = deck.slice();
  let added = 0;
  const needed = minCount - crystalCount;
  for (let i = 0; i < out.length && added < needed; i++) {
    const def = TCG_CARDS[out[i]];
    if (def && getCardType(def) === "crystal") continue;
    out[i] = "crystal_" + topEls[added % topEls.length];
    added++;
  }
  return shuffle(out);
}

/* Build a 20-card deck biased toward a chosen element, mechanic and/or
   card type. The user's owned cards (collection + foils) form the pool;
   foil copies count alongside normals (the engine treats them the same
   at match time). Options:
     element  — "fire" / "water" / "earth" / "air" / "light" / "dark"
     mechanic — any key in TCG_MECHANICS (creature keyword)
     type     — "creature" / "spell" / "enchantment" / "counter"
     strict   — when true, ONLY cards matching all filters are used. If
                fewer than 20 owned cards match, returns null. When
                false, matching cards fill the deck FIRST, then the
                remaining slots are filled from the rest of the pool.
   Returns a 20-element cardId array, or null when the filters can't be
   satisfied (strict mode) or the collection has < 20 cards total. */
export function buildFilteredDeck(collection, foils = {}, opts = {}) {
  const { element, mechanic, type, strict = false } = opts || {};

  // Merge owned counts (foils are interchangeable with normals at match time).
  const owned = {};
  for (const [id, n] of Object.entries(collection || {})) {
    if (TCG_CARDS[id]) owned[id] = (owned[id] || 0) + n;
  }
  for (const [id, n] of Object.entries(foils || {})) {
    if (TCG_CARDS[id]) owned[id] = (owned[id] || 0) + n;
  }

  const matches = (c) => {
    if (element  && c.element !== element) return false;
    if (mechanic && !((c.mechanics || []).includes(mechanic))) return false;
    if (type     && getCardType(c) !== type) return false;
    return true;
  };

  // Two buckets so non-strict mode can prioritize matching cards first.
  const matchingPool = [];
  const restPool     = [];
  for (const [id, n] of Object.entries(owned)) {
    const c = TCG_CARDS[id];
    if (!c) continue;
    const m = matches(c);
    for (let i = 0; i < n; i++) (m ? matchingPool : restPool).push(id);
  }

  if (strict) {
    if (matchingPool.length < DECK_SIZE) return null;
    return shuffle(matchingPool).slice(0, DECK_SIZE);
  }
  // Misto: shuffle matching first, then fill with the rest.
  const combined = [...shuffle(matchingPool), ...shuffle(restPool)];
  if (combined.length < DECK_SIZE) return null;
  return combined.slice(0, DECK_SIZE);
}
