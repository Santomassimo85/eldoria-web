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
export const STARTING_HAND_SIZE = 4;
export const DECK_SIZE         = 20;
export const MAX_MANA          = 10;
export const MAX_BOARD         = 6;
export const MAX_HAND          = 7;
export const MAX_SECRETS       = 5;

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
    hp:        { challenger: STARTING_HP, challenged: STARTING_HP },
    maxMana:   { challenger: 0, challenged: 0 },
    mana:      { challenger: 0, challenged: 0 },
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
    // Resolve
    const result = resolveSecret(state, defenderSide, def, eventData) || {};
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
  if (!isFirstTurnEver) next.round = state.round + 1;
  // Mana grows by 1 each turn (capped), refills to max
  next.maxMana[side] = Math.min(MAX_MANA, next.maxMana[side] + 1);
  next.mana[side] = next.maxMana[side];
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

  if (next.mana[side] < def.cost) return state;

  const type = getCardType(def);

  if (type === "creature") {
    if (next.board[side].length >= MAX_BOARD) return state;
    next.mana[side] -= def.cost;
    next.hand[side].splice(handIdx, 1);
    const bc = makeBoardCard(handCard.cardId);
    next.board[side].push(bc);
    next.log = [...next.log, {
      side,
      text: `🎴 ${sideName(side)} evoca ${def.name} (${def.atk}/${bc.hp}, costo ${def.cost}).`,
    }];
    // Wake opp's enemy_summon secrets (Negazione) — they may set hp=0 here.
    triggerSecrets(next, opp(side), "enemy_summon", { instId: bc.instId });
    // Affinity fires AFTER any negation. If the creature was negated, it
    // already has hp=0 but applyAffinity for Earth Radici still buffs
    // OTHER creatures of yours (the negated one is skipped via justPlayed).
    applyAffinity(next, side, def);
    resolveDeaths(next);
    return next;
  }

  // Counter: goes face-down to the secrets zone if it carries a trigger.
  if (type === "counter" && def.effect?.trigger) {
    if ((next.secrets[side]?.length || 0) >= MAX_SECRETS) return state;
    next.mana[side] -= def.cost;
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
  next.mana[side] -= def.cost;
  next.hand[side].splice(handIdx, 1);
  next.log = [...next.log, {
    side,
    text: `${TYPE_ICON_FOR(type)} ${sideName(side)} lancia ${def.name} (costo ${def.cost}).`,
  }];
  next.lastSpell = { cardId: def.id, side, ts: Date.now() };

  // Any non-creature cast can be cancelled by opp's Dissolvi Magia secret.
  const counter = triggerSecrets(next, opp(side), "enemy_magic_cast", { def });
  if (counter?.cancelled) {
    // Spell fizzles — to graveyard, no effect, no affinity.
    next.graveyard[side] = [...next.graveyard[side], handCard.cardId];
    return next;
  }

  applySpellEffect(next, side, def, targetSpec);
  next.graveyard[side] = [...next.graveyard[side], handCard.cardId];
  applyAffinity(next, side, def);
  resolveDeaths(next);
  if (next.hp[opp(side)] <= 0 && !next.winner) endGame(next, side, "PF azzerati");
  if (next.hp[side]      <= 0 && !next.winner) endGame(next, opp(side), "PF azzerati");
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

/* ── Action: attack with a creature ───────────────────────── */
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
  const aMech = effectiveMechanics(attacker);
  if (aMech.includes("bulwark")) return state; // bulwark cannot attack
  const attackerFlies = aMech.includes("flying");
  const attackerReaches = aMech.includes("cacciatore");
  const bruciaturaX = effectiveMechValue(attacker, "bruciatura") || 0;

  const canReach = (c) => {
    const cMech = effectiveMechanics(c);
    // Cacciatore: a grounded attacker with reach can still hit flying defenders.
    if (cMech.includes("flying") && !attackerFlies && !attackerReaches) return false;
    return true;
  };

  const oppBoard = next.board[oside];
  const tauntingBulwarks = oppBoard.filter(c => {
    const cMech = effectiveMechanics(c);
    if (!cMech.includes("bulwark")) return false;
    return canReach(c);
  });
  if (tauntingBulwarks.length > 0) {
    if (targetInstId === null) return state;
    const targetIsBulwark = tauntingBulwarks.some(c => c.instId === targetInstId);
    if (!targetIsBulwark) return state;
  } else if (targetInstId === null) {
    // No Bulwarks but face still requires a clear lane: ground attackers
    // are blocked by any ground defender; flying attackers by any flying
    // defender. Cacciatore doesn't grant face-bypass.
    const blocksFace = (c) => {
      const cFlies = effectiveMechanics(c).includes("flying");
      return attackerFlies ? cFlies : !cFlies;
    };
    if (oppBoard.some(blocksFace)) return state;
  }

  attacker.tapped = true;

  next.lastAttack = {
    attacker: attackerInstId,
    target: targetInstId,
    side,
    flying: attackerFlies,
    ts: Date.now(),
  };

  if (targetInstId === null) {
    // Direct hit on opponent face
    const dmg = attacker.atk;
    dealChampionDamage(next, oside, dmg);
    const flewOver = attackerFlies && oppBoard.some(c => {
      const cMech = effectiveMechanics(c);
      return !cMech.includes("flying");
    });
    next.log = [...next.log, {
      side,
      text: flewOver
        ? `🪽 ${aDef.name} sorvola la linea nemica e colpisce per ${dmg} danni!`
        : `⚔ ${aDef.name} colpisce direttamente per ${dmg} danni!`,
    }];
    // Bruciatura on champion hit
    if (bruciaturaX > 0 && dmg > 0) {
      next.burn[oside] = (next.burn[oside] || 0) + bruciaturaX;
      next.log = [...next.log, {
        side,
        text: `🔥 Bruciatura ${bruciaturaX}: il campione subirà 1 danno all'inizio dei prossimi ${bruciaturaX} turni.`,
      }];
      triggerSecrets(next, oside, "burn_applied", { stacks: bruciaturaX });
    }
    applySoulburn(next, side, dmg, aMech);
    if (next.hp[oside] <= 0) endGame(next, side, "PF azzerati");
    return next;
  }

  const target = oppBoard.find(c => c.instId === targetInstId);
  if (!target) return state;
  const tDef = TCG_CARDS[target.cardId];
  const tMech = effectiveMechanics(target);
  // Flying defenders are unreachable unless the attacker flies or has Cacciatore.
  if (tMech.includes("flying") && !attackerFlies && !attackerReaches) return state;

  const aMul = elementMultiplier(aDef.element, tDef.element);
  const tMul = elementMultiplier(tDef.element, aDef.element);
  const aDmg = Math.round(attacker.atk * aMul);
  const tDmg = Math.round(target.atk   * tMul);
  const targetHpBefore = target.hp;

  const aFirst = aMech.includes("vanguard") && !tMech.includes("vanguard");
  const tFirst = tMech.includes("vanguard") && !aMech.includes("vanguard");

  // Build a matchup summary showing BOTH multipliers when they differ
  // from ×1, so the player can audit why each side's damage came out the
  // way it did. "→×1.5 ↩×0.5" reads "deals 1.5×, takes 0.5× back".
  const aTag = aMul > 1 ? "→×1.5 super-efficace" : aMul < 1 ? "→×0.5 poco efficace" : null;
  const tTag = tMul > 1 ? "↩×1.5"               : tMul < 1 ? "↩×0.5"               : null;
  const mulHints = [aTag, tTag].filter(Boolean).join(" · ");
  next.log = [...next.log, {
    side,
    text: `⚔ ${aDef.name} attacca ${tDef.name}${mulHints ? ` (${mulHints})` : ""}.`,
  }];

  if (aFirst) {
    dealDamageToCreature(next, side, target, aDmg, attacker, aMech, aMul, attacker.atk);
    if (target.hp > 0) {
      dealDamageToCreature(next, oside, attacker, tDmg, target, tMech, tMul, target.atk);
    } else {
      next.log = [...next.log, { side, text: `💢 ${tDef.name} non fa in tempo a rispondere!` }];
    }
  } else if (tFirst) {
    dealDamageToCreature(next, oside, attacker, tDmg, target, tMech, tMul, target.atk);
    if (attacker.hp > 0) {
      dealDamageToCreature(next, side, target, aDmg, attacker, aMech, aMul, attacker.atk);
    } else {
      next.log = [...next.log, { side: oside, text: `💢 ${aDef.name} cade prima di colpire!` }];
    }
  } else {
    dealDamageToCreature(next, side, target, aDmg, attacker, aMech, aMul, attacker.atk);
    dealDamageToCreature(next, oside, attacker, tDmg, target, tMech, tMul, target.atk);
  }

  // Pierce: excess damage spills to face — bruciatura ALSO triggers here
  if (aMech.includes("pierce") && target.hp <= 0) {
    const overkill = Math.max(0, aDmg - targetHpBefore);
    if (overkill > 0) {
      dealChampionDamage(next, oside, overkill);
      next.log = [...next.log, {
        side,
        text: `🩸 Affondo! ${overkill} danni passano al campione avversario.`,
      }];
      if (bruciaturaX > 0) {
        next.burn[oside] = (next.burn[oside] || 0) + bruciaturaX;
        next.log = [...next.log, {
          side,
          text: `🔥 Bruciatura ${bruciaturaX}: il campione subirà 1 danno per ${bruciaturaX} turni.`,
        }];
        triggerSecrets(next, oside, "burn_applied", { stacks: bruciaturaX });
      }
    }
  }

  applySoulburn(next, side, aDmg, aMech);
  resolveDeaths(next);

  if (next.hp[oside] <= 0) endGame(next, side, "PF azzerati");
  if (next.hp[side]  <= 0) endGame(next, oside, "PF azzerati (rappresaglia)");
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
      if (mech.includes("cinder")) {
        dealChampionDamage(state, oside, 2);
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
  if (state.winner) return;
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
  const cardType = getCardType(def);
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

  const reachable = (c) => {
    const cMech = effectiveMechanics(c);
    if (cMech.includes("flying") && !attackerFlies && !attackerReaches) return false;
    return true;
  };
  // A defender "blocks the champion path" if it shares the attacker's lane:
  //   • Non-flying attacker → blocked by every ground creature
  //   • Flying attacker     → blocked only by flying creatures (ground
  //     defenders can't reach the sky)
  // Cacciatore is offensive reach only; it does NOT grant face-bypass.
  const blocksFace = (c) => {
    const cFlies = effectiveMechanics(c).includes("flying");
    return attackerFlies ? cFlies : !cFlies;
  };

  const tauntingBulwarks = oppBoard.filter(c => {
    const cMech = effectiveMechanics(c);
    if (!cMech.includes("bulwark")) return false;
    return reachable(c);
  });
  if (tauntingBulwarks.length > 0) {
    return { creatures: tauntingBulwarks.map(c => c.instId), face: false };
  }

  const blockers = oppBoard.filter(blocksFace);
  const face = blockers.length === 0;
  const creatures = oppBoard.filter(reachable).map(c => c.instId);
  return { creatures, face };
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
  if (isValidDeck(deck) && ownsDeck(deck, collection, foils)) return deck;
  const built = autoBuildDeckFromCollection(collection, foils);
  if (built) return built;
  return buildRandomDeck();
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
