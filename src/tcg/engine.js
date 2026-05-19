/* ============================================================
   TCG — GAME ENGINE  (pure, deterministic, JSON-serializable)
   ------------------------------------------------------------
   Magic-style rules, D&D themed:
     • 25 starting HP, 7-card opening hand, 60-card deck.
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

import {
  getCard, buildDeck, shuffle, ELEMENTS,
  ELEMENT_POWERS, attunedElements, POWER_MANA, POWER_CHARGE_CAP,
  DICE_STATS, statDice,
} from "./cards.js";

export const START_HP = 25;
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
    charges: 0,        // Cariche for Element Powers (gain 1/turn, cap 2)
    attuned: {},       // { fire:bool, … } — set in createGame from the deck
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

/* roll "base + 1dN" for one stat (die 0 → fixed base) */
function rollStat(value, cmc) {
  const { base, die } = statDice(value, cmc);
  return die ? base + 1 + Math.floor(Math.random() * die) : base;
}

/* build a fresh creature instance, rolling its Forza/Costituzione
   at summon when DICE_STATS is on. Logs the roll for flavour. */
function mkCreature(s, side, cardId) {
  const card = getCard(cardId);
  const cr = {
    instId: newInst(s),
    cardId,
    damage: 0,
    tapped: false,
    sick: !kw(cardId, "haste"),
    plusP: 0,
    plusT: 0,
    tempP: 0,
    tempT: 0,
    shield: kw(cardId, "shield"),
  };
  if (DICE_STATS && card) {
    cr.basePower = rollStat(card.power, card.cmc);
    cr.baseToughness = Math.max(1, rollStat(card.toughness, card.cmc));
    fx(s, {
      kind: "summonRoll", side, instId: cr.instId,
      power: cr.basePower, toughness: cr.baseToughness,
    });
    logMsg(s, side,
      `🎲 ${card.name}: ${cr.basePower}/${cr.baseToughness}.`);
  }
  return cr;
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

/* base Forza/Costituzione of a creature instance — the dice are
   rolled at summon (rollStats) and stored on the instance; if the
   dice feature is off (or an old instance) we fall back to the
   card's fixed numbers. */
function baseStats(creature) {
  const card = getCard(creature.cardId) || { power: 0, toughness: 0 };
  if (DICE_STATS && creature.basePower != null)
    return { power: creature.basePower, toughness: creature.baseToughness };
  return { power: card.power, toughness: card.toughness };
}

/* effective P/T of a creature including permanent buffs + anthems */
export function effStats(s, side, creature) {
  const b = baseStats(creature);
  const ab = anthemBonus(s, side);
  return {
    power: Math.max(0, b.power + creature.plusP + (creature.tempP || 0) + ab.p),
    toughness: Math.max(1, b.toughness + creature.plusT + (creature.tempT || 0) + ab.t),
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
  // ALWAYS shuffle the library at game start — a player-built deck is
  // saved grouped (copies/lands together), so without this the opening
  // hand and draws come out in order (e.g. all lands first).
  const d0 = shuffle(deck0 || buildDeck());
  const d1 = shuffle(deck1 || buildDeck());
  const s = {
    v: 2,
    players: {
      p0: mkPlayer(p0Name, d0),
      p1: mkPlayer(p1Name, d1),
    },
    turn: 0,
    active: starter === "p1" ? "p1" : starter === "p0" ? "p0" : Math.random() < 0.5 ? "p0" : "p1",
    phase: "main", // "main" | "block" | "ended"
    combat: null,
    attackedThisTurn: false,
    stack: [],          // spells waiting to resolve (LIFO; end = top)
    priority: null,     // side that may currently respond / must pass
    passes: 0,          // consecutive passes since the stack last changed
    combatFog: false,   // a Fog prevented this combat's damage
    winner: null,
    log: [],
    fx: [],
    _seq: { inst: 0, fx: 0, log: 0 },
  };
  s.players.p0.attuned = attunedElements(d0);
  s.players.p1.attuned = attunedElements(d1);
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

  // gain 1 Carica for Element Powers (capped)
  p.charges = Math.min(POWER_CHARGE_CAP, (p.charges || 0) + 1);

  // untap lands + creatures, clear summoning sickness
  for (const l of p.lands) l.tapped = false;
  for (const cr of p.battlefield) {
    if (cr.frozen) {
      // Morsa Glaciale: stays tapped this turn, thaws afterwards
      cr.frozen = false;
    } else {
      cr.tapped = false;
    }
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
  if (s.stack.length || s.priority) return false; // sorcery speed only
  const p = s.players[side];
  if (p.playedLand) return false;
  const hc = handCard(s, side, instId);
  if (!hc) return false;
  const card = getCard(hc.cardId);
  return !!card && card.type === "land";
}

/* may `side` cast an INSTANT right now? (holds priority, or an open
   sorcery-timing / combat window) */
export function canCastInstant(s, side) {
  if (s.winner) return false;
  if (s.priority === side) return true; // responding in an open window
  if (!s.stack.length && !s.priority) {
    if (s.active === side && s.phase === "main") return true; // own turn
    if (s.phase === "block") return true;                     // combat trick
  }
  return false;
}

export function canPlay(s, side, instId) {
  if (s.winner) return false;
  const hc = handCard(s, side, instId);
  if (!hc) return false;
  const card = getCard(hc.cardId);
  if (!card) return false;
  if (card.type === "land") return canPlayLand(s, side, instId);
  if (!canAfford(s, side, card.cost)) return false;

  const isInstant = card.type === "spell" && card.speed === "instant";
  if (isInstant) {
    if (!canCastInstant(s, side)) return false;
  } else {
    // sorcery speed: your turn, main phase, nothing on the stack
    if (s.active !== side || s.phase !== "main") return false;
    if (s.stack.length || s.priority) return false;
  }

  // target availability
  if (card.type === "spell") {
    const need = card.effect.kind;
    if (need === "destroy") return creatureExists(s);
    if (need === "buff" || need === "pump")
      return s.players[side].battlefield.length > 0;
    if (need === "raise") return s.players[side].graveyard.some((id) => isCreature(id));
    if (need === "damage" && card.effect.target === "creature") return creatureExists(s);
    if (need === "counter") return s.stack.some((it) => it.side !== side);
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
  if (e.kind === "buff" || e.kind === "pump")
    return {
      kind: "friendly_creature",
      creatures: s.players[side].battlefield.map((c) => ({ side, instId: c.instId })),
      heroes: [],
    };
  return { kind: "none", creatures: [], heroes: [] };
}

/* ============================================================
   ELEMENT POWERS — Affinità Elementale
   ============================================================ */
const POWER_COST = (el) => ({ [el]: POWER_MANA });

/* the elements this side may actually wield (deck-attuned) */
export function attunedPowers(s, side) {
  const at = s.players[side].attuned || {};
  return ELEMENTS.filter((el) => at[el]).map((el) => ({
    el, ...ELEMENT_POWERS[el],
  }));
}

/* may `side` fire `el`'s power right now? (sorcery speed, on the
   stack, deck-attuned, has a Carica and 3 mana of that colour) */
export function canUsePower(s, side, el) {
  if (s.winner || !ELEMENT_POWERS[el]) return false;
  const p = s.players[side];
  if (!p.attuned || !p.attuned[el]) return false;
  if ((p.charges || 0) < 1) return false;
  if (s.active !== side || s.phase !== "main") return false;
  if (s.stack.length || s.priority) return false;     // sorcery speed
  if (!canAfford(s, side, POWER_COST(el))) return false;
  // a targeted power needs a legal target to exist
  const tg = powerTargets(s, side, el);
  if (tg.kind === "creature" && tg.creatures.length === 0) return false;
  return true;
}

/* legal targets for an element power (mirrors spellTargets) */
export function powerTargets(s, side, el) {
  const P = ELEMENT_POWERS[el];
  if (!P) return { kind: "none", creatures: [], heroes: [] };
  const e = P.effect;
  const foe = opp(side);
  if (e.kind === "damage" && e.target === "any") {
    const cr = [];
    for (const sd of SIDES)
      for (const c of s.players[sd].battlefield) {
        if (sd === foe && kw(c.cardId, "hexproof")) continue;
        cr.push({ side: sd, instId: c.instId });
      }
    return { kind: "any", creatures: cr, heroes: ["p0", "p1"] };
  }
  if (e.kind === "freeze" || e.kind === "weaken") {
    const cr = s.players[foe].battlefield
      .filter((c) => !kw(c.cardId, "hexproof"))
      .map((c) => ({ side: foe, instId: c.instId }));
    return { kind: "creature", creatures: cr, heroes: [] };
  }
  if (e.kind === "buff")
    return {
      kind: "friendly_creature",
      creatures: s.players[side].battlefield.map((c) => ({ side, instId: c.instId })),
      heroes: [],
    };
  return { kind: "none", creatures: [], heroes: [] };
}

/* activate an element power → it goes on the stack like a spell */
export function castElementPower(state, side, el, target = null) {
  if (!canUsePower(state, side, el)) return state;
  const P = ELEMENT_POWERS[el];
  const tg = powerTargets(state, side, el);
  if (tg.kind === "creature" || tg.kind === "any") {
    // needs a target — must be one of the legal ones
    const ok =
      target &&
      ((target.type === "creature" &&
        tg.creatures.some((c) => c.instId === target.instId)) ||
        (target.type === "hero" && tg.heroes.includes(target.side)));
    if (!ok) return state;
  } else if (tg.kind === "friendly_creature") {
    if (!target || target.type !== "creature" ||
        !tg.creatures.some((c) => c.instId === target.instId))
      return state;
  }
  const s = clone(state);
  const p = s.players[side];
  payCost(s, side, POWER_COST(el));
  p.charges -= 1;
  s.stack.push({ uid: newInst(s), side, power: el, target });
  s.priority = opp(side);
  s.passes = 0;
  fx(s, { kind: "stack", side, cardId: null, element: el });
  logMsg(s, side, `${p.name} invoca ${P.name} (in pila).`);
  return s;
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
    const cr = mkCreature(s, side, card.id);
    p.battlefield.push(cr);
    fx(s, { kind: "play", side, cardId: card.id, into: "battlefield", instId: cr.instId });
    logMsg(s, side, `${p.name} evoca ${card.name}.`);
    resolveDeaths(s);
    checkWin(s);
  } else if (card.type === "artifact") {
    p.artifacts.push({ instId: newInst(s), cardId: card.id });
    fx(s, { kind: "play", side, cardId: card.id, into: "artifacts" });
    logMsg(s, side, `${p.name} attiva ${card.name}.`);
  } else {
    // SPELL → goes on the stack; the opponent gets a chance to respond
    s.stack.push({ uid: newInst(s), side, cardId: card.id, target });
    s.priority = opp(side);
    s.passes = 0;
    fx(s, { kind: "stack", side, cardId: card.id });
    logMsg(s, side, `${p.name} lancia ${card.name} (in pila).`);
  }
  return s;
}

/* ============================================================
   THE STACK — priority passing & LIFO resolution
   ============================================================ */
export function stackTop(s) {
  return s.stack && s.stack.length ? s.stack[s.stack.length - 1] : null;
}

/* a stack item is either a spell card or an Element Power.
   This returns a uniform { effect, element, name } view. */
function stackSpell(item) {
  if (item.power) {
    const P = ELEMENT_POWERS[item.power];
    return P
      ? { effect: P.effect, element: item.power, name: P.name, isPower: true }
      : null;
  }
  const c = getCard(item.cardId);
  return c ? { effect: c.effect, element: c.element, name: c.name } : null;
}

function resolveTop(s) {
  const item = s.stack.pop();
  if (!item) return;
  const sp = stackSpell(item);
  if (!sp) { resolveDeaths(s); checkWin(s); return; }
  const ctrl = s.players[item.side];
  if (sp.effect.kind === "counter") {
    // counter a targeted (or the most recent enemy) spell/power on the stack
    let idx = -1;
    if (item.target && item.target.uid != null)
      idx = s.stack.findIndex((x) => x.uid === item.target.uid);
    if (idx < 0)
      for (let i = s.stack.length - 1; i >= 0; i--)
        if (s.stack[i].side !== item.side) { idx = i; break; }
    if (idx >= 0) {
      const cd = s.stack.splice(idx, 1)[0];
      const csp = stackSpell(cd);
      if (cd.power) {
        fx(s, { kind: "counter", side: item.side, cardId: null });
        logMsg(s, item.side, `${ctrl.name} controbatte ${csp ? csp.name : "il potere"}.`);
      } else {
        const cc = getCard(cd.cardId);
        s.players[cd.side].graveyard.push(cc.id);
        fx(s, { kind: "counter", side: item.side, cardId: cc.id });
        logMsg(s, item.side, `${ctrl.name} controbatte ${cc.name}.`);
      }
    } else {
      logMsg(s, item.side, `${sp.name} svanisce: nessun bersaglio.`);
    }
  } else {
    fx(s, {
      kind: "spell", side: item.side,
      cardId: item.power ? null : item.cardId, element: sp.element,
    });
    logMsg(s, item.side, `Si risolve ${sp.name}.`);
    applySpell(s, item.side, sp, item.target);
  }
  // spell cards go to the graveyard; powers just expire
  if (!item.power) ctrl.graveyard.push(item.cardId);
  resolveDeaths(s);
  checkWin(s);
}

/* a player passes priority. When BOTH pass in a row the top of the
   stack resolves; an empty stack + both pass closes the window. */
export function passPriority(state, side) {
  if (state.winner || state.priority !== side) return state;
  const s = clone(state);
  s.passes = (s.passes || 0) + 1;
  if (s.passes >= 2) {
    if (s.stack.length) {
      resolveTop(s);
      s.passes = 0;
      s.priority = s.winner ? null : s.stack.length ? s.active : null;
    } else {
      s.priority = null; // nothing to resolve — window closes
    }
  } else {
    s.priority = opp(side); // let the other player respond
  }
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
  } else if (e.kind === "pump") {
    // temporary buff — wears off at end of turn
    if (target && target.type === "creature") {
      const f = findCreature(s, target.instId);
      if (f && f.side === side) {
        f.creature.tempP = (f.creature.tempP || 0) + e.p;
        f.creature.tempT = (f.creature.tempT || 0) + e.t;
        fx(s, { kind: "buff", side, instId: f.creature.instId });
        logMsg(s, side,
          `${getCard(f.creature.cardId).name} ottiene +${e.p}/+${e.t} fino a fine turno.`);
      }
    }
  } else if (e.kind === "freeze") {
    // Morsa Glaciale — tap an enemy creature; it skips its next untap
    if (target && target.type === "creature") {
      const f = findCreature(s, target.instId);
      if (f && f.side !== side) {
        f.creature.tapped = true;
        f.creature.frozen = true;
        fx(s, { kind: "freeze", side: f.side, instId: f.creature.instId });
        logMsg(s, side, `${getCard(f.creature.cardId).name} è congelata.`);
      }
    }
  } else if (e.kind === "weaken") {
    // Tributo Necrotico — permanent -p/-t on an enemy creature
    if (target && target.type === "creature") {
      const f = findCreature(s, target.instId);
      if (f && f.side !== side) {
        f.creature.plusP -= e.p;
        f.creature.plusT -= e.t;
        const base = getCard(f.creature.cardId) || { toughness: 0 };
        const rawT = base.toughness + (f.creature.plusT || 0);
        fx(s, { kind: "damageCreature", side: f.side, instId: f.creature.instId, amount: e.t, element: "darkness" });
        logMsg(s, side, `${base.name} subisce -${e.p}/-${e.t}.`);
        if (rawT <= 0) f.creature.damage = 9999; // withered away
      }
    }
  } else if (e.kind === "fog") {
    s.combatFog = true;
    fx(s, { kind: "fog", side });
    logMsg(s, side, `${me.name}: i danni da combattimento sono prevenuti questo turno.`);
  } else if (e.kind === "draw") {
    for (let i = 0; i < e.amount; i++) drawOne(s, side, false);
    logMsg(s, side, `${me.name} pesca ${e.amount} carte.`);
  } else if (e.kind === "raise") {
    const gi = me.graveyard.findIndex((id) => isCreature(id));
    if (gi >= 0) {
      const cardId = me.graveyard.splice(gi, 1)[0];
      const cr = mkCreature(s, side, cardId);
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
  if (state.stack.length || state.priority) return state; // resolve stack first
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
  if (state.stack.length || state.priority) return state; // resolve tricks first
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
  // a Fog cancels ALL combat damage this turn
  if (s.combatFog) {
    logMsg(s, null, "I danni da combattimento sono prevenuti (Nebbia).");
    s.combat = null;
    s.phase = s.winner ? "ended" : "main";
    return s;
  }
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
  if (state.stack.length || state.priority) return state; // resolve stack first
  // must get down to the hand cap by discarding manually first
  if (state.players[side].hand.length > HAND_CAP) return state;
  const s = clone(state);

  s.combatFog = false;
  for (const sd of SIDES)
    for (const cr of s.players[sd].battlefield) {
      cr.damage = 0;
      cr.tempP = 0; // temporary pumps wear off
      cr.tempT = 0;
    }

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
  if (!Array.isArray(s.stack)) s.stack = [];
  if (typeof s.priority === "undefined") s.priority = null;
  if (typeof s.passes !== "number") s.passes = 0;
  if (typeof s.combatFog !== "boolean") s.combatFog = false;
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
      if (typeof cr.tempP !== "number") cr.tempP = 0;
      if (typeof cr.tempT !== "number") cr.tempT = 0;
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
