/* ============================================================
   TCG — GAME ENGINE  (pure, deterministic, JSON-serializable)
   ------------------------------------------------------------
   Magic-style rules, D&D themed:
     • 20 starting HP, 7-card opening hand, 60-card deck.
     • MANA = LANDS. You may play at most ONE land per turn from
       hand; lands stay on the battlefield and untap at the start
       of your turn. Each land taps for 1 mana of its element.
     • Cards have a colored cost {generic, fire, water, ...}.
       Colored pips need that element's mana; generic pips accept
       any element. Unspent mana empties (lands just untap next
       turn — there is no stored pool).
     • Draw 1 at the start of your turn (player on the play skips
       their first draw). Summoning sickness, tap on attack,
       simultaneous combat damage, hand cap 7, empty deck = no
       draw (no decking-out damage).
     • Win: reduce the opponent to 0 HP. Both at 0 = draw.

   Every exported action returns a NEW state (never mutates input).
   Sides are "p0" and "p1".
   ============================================================ */

import { getCard, buildDeck, ELEMENTS } from "./cards.js";

export const START_HP = 20;
export const OPENING_HAND = 6;
export const HAND_CAP = 7;
export const SIDES = ["p0", "p1"];

export const opp = (s) => (s === "p0" ? "p1" : "p0");

const clone = (s) => JSON.parse(JSON.stringify(s));

/* keyword check for a creature instance (by cardId) */
function kw(cardId, name) {
  const c = getCard(cardId);
  return !!c && Array.isArray(c.keywords) && c.keywords.includes(name);
}
export function creatureKeywords(cardId) {
  const c = getCard(cardId);
  return c && Array.isArray(c.keywords) ? c.keywords : [];
}

function mkPlayer(name, deck) {
  return {
    name: name || "Giocatore",
    hp: START_HP,
    deck: deck.slice(),
    hand: [],
    battlefield: [], // creatures
    lands: [],       // {instId, cardId, element, tapped}
    artifacts: [],
    graveyard: [],   // cardIds
    playedLand: false, // a land already played this turn?
  };
}

/* ---- fx / log helpers (operate on a draft state) ---- */
function fx(s, ev) {
  s._seq.fx += 1;
  s.fx.push({ id: s._seq.fx, ...ev });
  if (s.fx.length > 80) s.fx = s.fx.slice(-80);
}
function logMsg(s, side, text) {
  s._seq.log += 1;
  s.log.push({ id: s._seq.log, side, text });
  if (s.log.length > 120) s.log = s.log.slice(-120);
}
function newInst(s) {
  s._seq.inst += 1;
  return "i" + s._seq.inst;
}

/* ---- lookups ---- */
export function findCreature(s, instId) {
  for (const side of SIDES) {
    const c = s.players[side].battlefield.find((x) => x.instId === instId);
    if (c) return { side, creature: c };
  }
  return null;
}
function handCard(s, side, instId) {
  return s.players[side].hand.find((h) => h.instId === instId) || null;
}

/* anthem bonus from a side's artifacts */
export function anthemBonus(s, side) {
  let p = 0, t = 0;
  for (const a of s.players[side].artifacts) {
    const card = getCard(a.cardId);
    if (card && card.passive && card.passive.kind === "anthem") {
      p += card.passive.p || 0;
      t += card.passive.t || 0;
    }
  }
  return { p, t };
}

/* effective P/T of a creature including permanent buffs + anthems */
export function effStats(s, side, creature) {
  const card = getCard(creature.cardId) || { power: 0, toughness: 0 };
  const ab = anthemBonus(s, side);
  return {
    power: Math.max(0, card.power + creature.plusP + ab.p),
    toughness: Math.max(1, card.toughness + creature.plusT + ab.t),
  };
}

/* ============================================================
   MANA  (derived from untapped lands — no stored pool)
   ============================================================ */
export function availableMana(s, side) {
  const m = {};
  for (const el of ELEMENTS) m[el] = 0;
  for (const l of s.players[side].lands) if (!l.tapped) m[l.element] += 1;
  return m;
}
export function manaTotal(mana) {
  return ELEMENTS.reduce((n, el) => n + (mana[el] || 0), 0);
}

/* can the side's available mana pay this cost? */
export function canAfford(s, side, cost) {
  if (!cost) return true;
  const m = availableMana(s, side);
  let pool = manaTotal(m);
  for (const el of ELEMENTS) {
    const need = cost[el] || 0;
    if ((m[el] || 0) < need) return false;
    pool -= need; // colored pips consume their colour
  }
  return pool >= (cost.generic || 0);
}

/* tap lands on a DRAFT state to pay a cost (colored first, then any) */
function payCost(s, side, cost) {
  if (!cost) return;
  const lands = s.players[side].lands;
  const tapOne = (pred) => {
    const l = lands.find((x) => !x.tapped && pred(x));
    if (l) { l.tapped = true; return true; }
    return false;
  };
  for (const el of ELEMENTS) {
    for (let i = 0; i < (cost[el] || 0); i++) tapOne((x) => x.element === el);
  }
  for (let i = 0; i < (cost.generic || 0); i++) tapOne(() => true);
}

/* ---- creation ---- */
export function createGame({ p0Name, p1Name, deck0, deck1, starter } = {}) {
  const s = {
    v: 2,
    players: {
      p0: mkPlayer(p0Name, deck0 || buildDeck()),
      p1: mkPlayer(p1Name, deck1 || buildDeck()),
    },
    turn: 0,
    active: starter === "p1" ? "p1" : starter === "p0" ? "p0" : Math.random() < 0.5 ? "p0" : "p1",
    phase: "main", // "main" | "block" | "ended"
    combat: null,
    attackedThisTurn: false,
    winner: null,
    log: [],
    fx: [],
    _seq: { inst: 0, fx: 0, log: 0 },
  };
  for (const side of SIDES) {
    for (let i = 0; i < OPENING_HAND; i++) drawOne(s, side, true);
  }
  logMsg(s, null, `La partita ha inizio. ${s.players[s.active].name} muove per primo.`);
  startTurn(s, s.active, true);
  return s;
}

/* ---- draw ---- */
function drawOne(s, side, silent) {
  const p = s.players[side];
  if (p.deck.length === 0) {
    if (!silent) logMsg(s, side, `${p.name} non ha più carte da pescare.`);
    return false;
  }
  const cardId = p.deck.shift();
  p.hand.push({ instId: newInst(s), cardId });
  if (!silent) fx(s, { kind: "draw", side });
  return true;
}

/* ---- turn flow ---- */
function startTurn(s, side, isGameStart) {
  const p = s.players[side];
  s.turn += 1;
  s.active = side;
  s.phase = "main";
  s.combat = null;
  s.attackedThisTurn = false;
  p.playedLand = false;

  // untap lands + creatures, clear summoning sickness
  for (const l of p.lands) l.tapped = false;
  for (const cr of p.battlefield) {
    cr.tapped = false;
    cr.sick = false;
    cr.regenUsed = false; // Rigenerazione: one save per turn
  }

  // start-of-turn artifact triggers
  let healSum = 0, drawExtra = 0;
  for (const a of p.artifacts) {
    const c = getCard(a.cardId);
    if (!c || !c.passive) continue;
    if (c.passive.kind === "startHeal") healSum += c.passive.amount || 0;
    if (c.passive.kind === "startDraw") drawExtra += c.passive.amount || 0;
  }
  if (healSum > 0) {
    p.hp += healSum;
    fx(s, { kind: "healHero", side, amount: healSum });
    logMsg(s, side, `${p.name} recupera ${healSum} PV (manufatto).`);
  }

  const skipDraw = isGameStart && s.turn === 1;
  if (!skipDraw) drawOne(s, side, false);
  for (let i = 0; i < drawExtra; i++) drawOne(s, side, false);

  logMsg(s, side, `Turno di ${p.name} (turno ${s.turn}).`);
  checkWin(s);
}

/* ============================================================
   PLAYING CARDS
   ============================================================ */
export function canPlayLand(s, side, instId) {
  if (s.winner || s.active !== side || s.phase !== "main") return false;
  const p = s.players[side];
  if (p.playedLand) return false;
  const hc = handCard(s, side, instId);
  if (!hc) return false;
  const card = getCard(hc.cardId);
  return !!card && card.type === "land";
}

export function canPlay(s, side, instId) {
  if (s.winner || s.active !== side || s.phase !== "main") return false;
  const hc = handCard(s, side, instId);
  if (!hc) return false;
  const card = getCard(hc.cardId);
  if (!card) return false;
  if (card.type === "land") return canPlayLand(s, side, instId);
  if (!canAfford(s, side, card.cost)) return false;
  // target availability
  if (card.type === "spell") {
    const need = card.effect.kind;
    if (need === "destroy") return creatureExists(s);
    if (need === "buff") return s.players[side].battlefield.length > 0;
    if (need === "raise") return s.players[side].graveyard.some((id) => isCreature(id));
    if (need === "damage" && card.effect.target === "creature") return creatureExists(s);
  }
  return true;
}
function creatureExists(s) {
  return s.players.p0.battlefield.length + s.players.p1.battlefield.length > 0;
}
function isCreature(cardId) {
  const c = getCard(cardId);
  return c && c.type === "creature";
}

/* legal targets for a spell in hand — used by UI to drive targeting */
export function spellTargets(s, side, instId) {
  const hc = handCard(s, side, instId);
  if (!hc) return { kind: "none", creatures: [], heroes: [] };
  const card = getCard(hc.cardId);
  if (!card || card.type !== "spell") return { kind: "none", creatures: [], heroes: [] };
  const e = card.effect;
  const foe = opp(side);
  const allCreatures = [];
  for (const sd of SIDES)
    for (const cr of s.players[sd].battlefield) {
      // Elusione: a hexproof enemy creature can't be targeted
      if (sd === foe && kw(cr.cardId, "hexproof")) continue;
      allCreatures.push({ side: sd, instId: cr.instId });
    }

  if (e.kind === "damage" && e.target === "any")
    return { kind: "any", creatures: allCreatures, heroes: ["p0", "p1"] };
  if (e.kind === "damage" && e.target === "creature")
    return { kind: "creature", creatures: allCreatures, heroes: [] };
  if (e.kind === "destroy")
    return { kind: "creature", creatures: allCreatures, heroes: [] };
  if (e.kind === "buff")
    return {
      kind: "friendly_creature",
      creatures: s.players[side].battlefield.map((c) => ({ side, instId: c.instId })),
      heroes: [],
    };
  return { kind: "none", creatures: [], heroes: [] };
}

/* ---- play a land ---- */
export function playLand(state, side, instId) {
  if (!canPlayLand(state, side, instId)) return state;
  const s = clone(state);
  const p = s.players[side];
  const idx = p.hand.findIndex((h) => h.instId === instId);
  const hc = p.hand[idx];
  const card = getCard(hc.cardId);
  p.hand.splice(idx, 1);
  p.lands.push({
    instId: newInst(s),
    cardId: card.id,
    element: card.element,
    tapped: false,
  });
  p.playedLand = true;
  fx(s, { kind: "play", side, cardId: card.id, into: "lands" });
  logMsg(s, side, `${p.name} gioca ${card.name}.`);
  return s;
}

/* ---- play a card (land / creature / artifact / spell) ---- */
export function playCard(state, side, instId, target = null) {
  if (!canPlay(state, side, instId)) return state;
  const pre = getCard(handCard(state, side, instId).cardId);
  if (pre.type === "land") return playLand(state, side, instId);

  const s = clone(state);
  const p = s.players[side];
  const idx = p.hand.findIndex((h) => h.instId === instId);
  const hc = p.hand[idx];
  const card = getCard(hc.cardId);

  payCost(s, side, card.cost);
  p.hand.splice(idx, 1);

  if (card.type === "creature") {
    const cr = {
      instId: newInst(s),
      cardId: card.id,
      damage: 0,
      tapped: false,
      sick: !kw(card.id, "haste"),
      plusP: 0,
      plusT: 0,
      shield: kw(card.id, "shield"),
    };
    p.battlefield.push(cr);
    fx(s, { kind: "play", side, cardId: card.id, into: "battlefield", instId: cr.instId });
    logMsg(s, side, `${p.name} evoca ${card.name}.`);
  } else if (card.type === "artifact") {
    p.artifacts.push({ instId: newInst(s), cardId: card.id });
    fx(s, { kind: "play", side, cardId: card.id, into: "artifacts" });
    logMsg(s, side, `${p.name} attiva ${card.name}.`);
  } else {
    fx(s, { kind: "spell", side, cardId: card.id, element: card.element });
    logMsg(s, side, `${p.name} lancia ${card.name}.`);
    applySpell(s, side, card, target);
    p.graveyard.push(card.id);
  }

  resolveDeaths(s);
  checkWin(s);
  return s;
}

function applySpell(s, side, card, target) {
  const e = card.effect;
  const me = s.players[side];
  if (e.kind === "damage") {
    if (target && target.type === "hero") {
      damageHero(s, target.side, e.amount, card.element);
    } else if (target && target.type === "creature") {
      const f = findCreature(s, target.instId);
      if (f) damageCreature(s, f.side, f.creature, e.amount, card.element);
    }
  } else if (e.kind === "aoe_enemy") {
    const foe = opp(side);
    for (const cr of s.players[foe].battlefield.slice())
      damageCreature(s, foe, cr, e.amount, card.element);
  } else if (e.kind === "heal") {
    me.hp += e.amount;
    fx(s, { kind: "healHero", side, amount: e.amount });
    logMsg(s, side, `${me.name} recupera ${e.amount} PV.`);
  } else if (e.kind === "destroy") {
    if (target && target.type === "creature") {
      const f = findCreature(s, target.instId);
      if (f) {
        f.creature.damage = 9999;
        logMsg(s, side, `${getCard(f.creature.cardId).name} viene distrutto.`);
      }
    }
  } else if (e.kind === "buff") {
    if (target && target.type === "creature") {
      const f = findCreature(s, target.instId);
      if (f && f.side === side) {
        f.creature.plusP += e.p;
        f.creature.plusT += e.t;
        fx(s, { kind: "buff", side, instId: f.creature.instId });
        logMsg(s, side, `${getCard(f.creature.cardId).name} ottiene +${e.p}/+${e.t}.`);
      }
    }
  } else if (e.kind === "draw") {
    for (let i = 0; i < e.amount; i++) drawOne(s, side, false);
    logMsg(s, side, `${me.name} pesca ${e.amount} carte.`);
  } else if (e.kind === "raise") {
    const gi = me.graveyard.findIndex((id) => isCreature(id));
    if (gi >= 0) {
      const cardId = me.graveyard.splice(gi, 1)[0];
      const cr = {
        instId: newInst(s),
        cardId,
        damage: 0,
        tapped: false,
        sick: !kw(cardId, "haste"),
        plusP: 0,
        plusT: 0,
        shield: kw(cardId, "shield"),
      };
      me.battlefield.push(cr);
      fx(s, { kind: "play", side, cardId, into: "battlefield", instId: cr.instId });
      logMsg(s, side, `${me.name} rievoca ${getCard(cardId).name} dal cimitero.`);
    }
  }
}

/* ---- damage primitives ---- */
function damageHero(s, side, amount, element) {
  s.players[side].hp -= amount;
  fx(s, { kind: "damageHero", side, amount, element });
}
function damageCreature(s, side, creature, amount, element) {
  creature.damage += amount;
  fx(s, { kind: "damageCreature", side, instId: creature.instId, amount, element });
}

function resolveDeaths(s) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const side of SIDES) {
      const bf = s.players[side].battlefield;
      for (let i = bf.length - 1; i >= 0; i--) {
        const cr = bf[i];
        const { toughness } = effStats(s, side, cr);
        if (cr.damage >= toughness) {
          // Rigenerazione: survive once per turn, damage cleared
          if (kw(cr.cardId, "regen") && !cr.regenUsed) {
            cr.regenUsed = true;
            cr.damage = 0;
            cr.tapped = true;
            fx(s, { kind: "regen", side, instId: cr.instId });
            logMsg(s, side, `${getCard(cr.cardId).name} si rigenera.`);
            continue;
          }
          bf.splice(i, 1);
          s.players[side].graveyard.push(cr.cardId);
          fx(s, { kind: "death", side, instId: cr.instId, cardId: cr.cardId });
          logMsg(s, side, `${getCard(cr.cardId).name} muore.`);
          changed = true;
        }
      }
    }
  }
}

/* ---- combat ---- */
export function canAttack(s, side, instId) {
  if (s.winner || s.active !== side || s.phase !== "main" || s.attackedThisTurn) return false;
  const cr = s.players[side].battlefield.find((c) => c.instId === instId);
  if (!cr) return false;
  if (cr.sick || cr.tapped) return false;
  if (kw(cr.cardId, "defender")) return false; // Difensore: non attacca
  return effStats(s, side, cr).power > 0;
}
export function legalAttackers(s, side) {
  return s.players[side].battlefield
    .filter(
      (c) =>
        !c.sick &&
        !c.tapped &&
        !kw(c.cardId, "defender") &&
        effStats(s, side, c).power > 0
    )
    .map((c) => c.instId);
}

export function declareAttackers(state, side, attackerIds) {
  if (state.winner || state.active !== side || state.phase !== "main" || state.attackedThisTurn)
    return state;
  const valid = attackerIds.filter((id) => canAttack(state, side, id));
  if (valid.length === 0) return state;
  const s = clone(state);
  for (const id of valid) {
    const cr = s.players[side].battlefield.find((c) => c.instId === id);
    if (!kw(cr.cardId, "vigilance")) cr.tapped = true; // Vigilanza: non si tappa
  }
  s.combat = { attackerSide: side, attackers: valid, blocks: {} };
  s.phase = "block";
  s.attackedThisTurn = true;
  logMsg(s, side, `${s.players[side].name} attacca con ${valid.length} creatura/e.`);
  if (s.players[opp(side)].battlefield.length === 0) {
    return resolveCombatInternal(s);
  }
  return s;
}

/* can `blk` legally block `atk` (evasion keywords)? */
function canBlock(s, atkSide, atk, blk) {
  if (kw(atk.cardId, "unblockable")) return false;
  if (
    kw(atk.cardId, "flying") &&
    !kw(blk.cardId, "flying") &&
    !kw(blk.cardId, "reach")
  )
    return false;
  return true;
}

export function legalBlockers(s, attackerInstId) {
  if (!s.combat) return [];
  const defSide = opp(s.combat.attackerSide);
  const atkSide = s.combat.attackerSide;
  const atk = s.players[atkSide].battlefield.find((c) => c.instId === attackerInstId);
  if (!atk) return [];
  // a creature can only be assigned to ONE attacker — collect every
  // creature already used across all blocker lists
  const used = new Set();
  for (const arr of Object.values(s.combat.blocks || {}))
    for (const id of arr || []) used.add(id);
  return s.players[defSide].battlefield
    .filter((c) => !c.tapped && !used.has(c.instId))
    .filter((c) => canBlock(s, atkSide, atk, c))
    .map((c) => c.instId);
}

/* blocksMap: { [attackerInstId]: blockerInstId | [blockerInstId, …] }
   One creature may block only one attacker; one attacker may be blocked
   by MANY creatures (gang block). Menace needs 2+ blockers. */
export function confirmBlocks(state, defenderSide, blocksMap = {}) {
  if (!state.combat || state.phase !== "block") return state;
  if (defenderSide !== opp(state.combat.attackerSide)) return state;
  const s = clone(state);
  const atkSide = s.combat.attackerSide;
  const used = new Set();
  const blocks = {};
  for (const atkId of s.combat.attackers) {
    const raw = blocksMap[atkId];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const atk = s.players[atkSide].battlefield.find((c) => c.instId === atkId);
    if (!atk) continue;
    const assigned = [];
    for (const blkId of list) {
      if (used.has(blkId)) continue;
      const blk = s.players[defenderSide].battlefield.find((c) => c.instId === blkId);
      if (!blk || blk.tapped) continue;
      if (!canBlock(s, atkSide, atk, blk)) continue; // Volare / Inafferrabile
      assigned.push(blkId);
      used.add(blkId);
    }
    // Minaccia: needs at least 2 blockers, else it goes through
    if (kw(atk.cardId, "menace") && assigned.length < 2) {
      for (const b of assigned) used.delete(b);
      continue;
    }
    if (assigned.length) blocks[atkId] = assigned;
  }
  s.combat.blocks = blocks;
  return resolveCombatInternal(s);
}

/* one combatant deals `amount` to a creature, honouring Scudo
   Divino, Tocco Letale and Legame Vitale. */
function strikeCreature(s, srcSide, src, tgtSide, tgt, amount) {
  if (amount <= 0) return;
  if (tgt.shield) {
    tgt.shield = false;
    fx(s, { kind: "shield", side: tgtSide, instId: tgt.instId });
    return;
  }
  tgt.damage += amount;
  if (kw(src.cardId, "deathtouch")) tgt.damage = 9999;
  fx(s, { kind: "damageCreature", side: tgtSide, instId: tgt.instId, amount });
  if (kw(src.cardId, "lifelink")) {
    s.players[srcSide].hp += amount;
    fx(s, { kind: "healHero", side: srcSide, amount });
  }
}
function strikeHero(s, srcSide, src, tgtSide, amount) {
  if (amount <= 0) return;
  s.players[tgtSide].hp -= amount;
  fx(s, { kind: "damageHero", side: tgtSide, amount });
  if (src && kw(src.cardId, "lifelink")) {
    s.players[srcSide].hp += amount;
    fx(s, { kind: "healHero", side: srcSide, amount });
  }
}

function resolveCombatInternal(s) {
  const atkSide = s.combat.attackerSide;
  const defSide = opp(atkSide);
  const blocks = s.combat.blocks || {};
  const aliveA = (id) => s.players[atkSide].battlefield.find((c) => c.instId === id);
  const aliveD = (id) => s.players[defSide].battlefield.find((c) => c.instId === id);

  // engagement list (+ visual fx for arrows). blkIds = every creature
  // gang-blocking this attacker (may be 0 → hits the hero).
  const pairs = [];
  for (const atkId of s.combat.attackers) {
    const a = aliveA(atkId);
    if (!a) continue;
    const blkIds = Array.isArray(blocks[atkId]) ? blocks[atkId].slice() : [];
    pairs.push({ atkId, blkIds });
    if (blkIds.length) {
      for (const bId of blkIds)
        fx(s, {
          kind: "attack",
          side: atkSide,
          attackerInstId: atkId,
          targetKind: "creature",
          targetInstId: bId,
        });
    } else {
      fx(s, {
        kind: "attack",
        side: atkSide,
        attackerInstId: atkId,
        targetKind: "hero",
        targetInstId: null,
      });
    }
  }

  // two ordered passes: First Strike, then the rest
  const runPass = (firstStrike) => {
    for (const { atkId, blkIds } of pairs) {
      const a = aliveA(atkId);
      if (!a) continue;
      const aPow = effStats(s, atkSide, a).power;
      const aFS = kw(a.cardId, "firststrike");
      const dt = kw(a.cardId, "deathtouch");
      const blockers = blkIds.map((id) => aliveD(id)).filter(Boolean);
      const wasBlocked = blkIds.length > 0;

      if (blockers.length) {
        // attacker spreads its power across the blockers in order,
        // dealing each just enough to kill before moving on; the rest
        // tramples to the hero if it has Travolgere.
        if (aFS === firstStrike) {
          let pow = aPow;
          for (const b of blockers) {
            if (pow <= 0) break;
            const bt = effStats(s, defSide, b).toughness;
            const lethal = dt ? 1 : Math.max(1, bt - b.damage);
            const deal = Math.min(pow, lethal);
            strikeCreature(s, atkSide, a, defSide, b, deal);
            pow -= deal;
          }
          if (kw(a.cardId, "trample") && pow > 0)
            strikeHero(s, atkSide, a, defSide, Math.min(aPow, pow));
        }
        // every blocker strikes back at the attacker
        for (const b of blockers) {
          if (kw(b.cardId, "firststrike") === firstStrike && aliveA(atkId))
            strikeCreature(s, defSide, b, atkSide, a, effStats(s, defSide, b).power);
        }
      } else if (wasBlocked) {
        // all blockers died first — only Travolgere gets through
        if (kw(a.cardId, "trample") && aFS === firstStrike)
          strikeHero(s, atkSide, a, defSide, aPow);
      } else if (aFS === firstStrike) {
        strikeHero(s, atkSide, a, defSide, aPow);
      }
    }
    resolveDeaths(s);
  };

  const anyFS = pairs.some(({ atkId, blkIds }) => {
    const a = aliveA(atkId);
    if (a && kw(a.cardId, "firststrike")) return true;
    return blkIds.some((id) => {
      const b = aliveD(id);
      return b && kw(b.cardId, "firststrike");
    });
  });
  if (anyFS) runPass(true);
  runPass(false);

  s.combat = null;
  s.phase = s.winner ? "ended" : "main";
  checkWin(s);
  return s;
}

/* how many cards over the hand cap this side is holding (0 = none) */
export function mustDiscardCount(s, side) {
  return Math.max(0, s.players[side].hand.length - HAND_CAP);
}

/* manually discard one chosen card (used to get back under the cap) */
export function discardCard(state, side, instId) {
  if (state.winner || state.active !== side || state.phase !== "main")
    return state;
  const p0 = state.players[side];
  const idx = p0.hand.findIndex((h) => h.instId === instId);
  if (idx < 0) return state;
  const s = clone(state);
  const p = s.players[side];
  const [hc] = p.hand.splice(idx, 1);
  p.graveyard.push(hc.cardId);
  fx(s, { kind: "discard", side, cardId: hc.cardId });
  logMsg(s, side, `${p.name} scarta ${getCard(hc.cardId).name}.`);
  return s;
}

/* ---- end turn ---- */
export function endTurn(state, side) {
  if (state.winner || state.active !== side || state.phase !== "main") return state;
  // must get down to the hand cap by discarding manually first
  if (state.players[side].hand.length > HAND_CAP) return state;
  const s = clone(state);
  const p = s.players[side];

  for (const sd of SIDES)
    for (const cr of s.players[sd].battlefield) cr.damage = 0;

  const next = opp(side);
  fx(s, { kind: "turn", side: next });
  startTurn(s, next, false);
  return s;
}

export function forfeit(state, side) {
  if (state.winner) return state;
  const s = clone(state);
  s.winner = opp(side);
  s.phase = "ended";
  logMsg(s, side, `${s.players[side].name} abbandona la partita.`);
  fx(s, { kind: "win", winner: s.winner });
  return s;
}

function checkWin(s) {
  if (s.winner) return;
  const d0 = s.players.p0.hp <= 0;
  const d1 = s.players.p1.hp <= 0;
  if (d0 && d1) s.winner = "draw";
  else if (d0) s.winner = "p1";
  else if (d1) s.winner = "p0";
  if (s.winner) {
    s.phase = "ended";
    s.combat = null;
    fx(s, { kind: "win", winner: s.winner });
    logMsg(
      s,
      null,
      s.winner === "draw"
        ? "Pareggio: entrambi gli eroi cadono."
        : `${s.players[s.winner].name} vince la partita!`
    );
  }
}

/* migration guard for in-flight PvP docs / older builds */
export function reviveState(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const s = clone(raw);
  if (!s._seq) s._seq = { inst: 9000, fx: 9000, log: 9000 };
  if (!Array.isArray(s.fx)) s.fx = [];
  if (!Array.isArray(s.log)) s.log = [];
  for (const sd of SIDES) {
    const p = s.players?.[sd];
    if (!p) continue;
    p.deck ||= [];
    p.hand ||= [];
    p.battlefield ||= [];
    p.lands ||= [];
    p.artifacts ||= [];
    p.graveyard ||= [];
    if (typeof p.playedLand !== "boolean") p.playedLand = false;
    for (const cr of p.battlefield) {
      if (typeof cr.shield !== "boolean") cr.shield = kw(cr.cardId, "shield");
      if (typeof cr.regenUsed !== "boolean") cr.regenUsed = false;
    }
  }
  // migrate old single-blocker combat ({atk: blkId}) → arrays
  if (s.combat && s.combat.blocks && typeof s.combat.blocks === "object") {
    const mig = {};
    for (const [aid, v] of Object.entries(s.combat.blocks)) {
      if (Array.isArray(v)) mig[aid] = v.filter(Boolean);
      else if (v) mig[aid] = [v];
    }
    s.combat.blocks = mig;
  }
  return s;
}
