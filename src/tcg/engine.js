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
import {
  initClassState, rewardAt, levelForXp, spellSlotTier,
  SLOT_TIER_UNLOCK_LEVEL, MAX_LEVEL,
} from "./classes.js";

export const START_HP = 30;
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

/* keyword check for a creature INSTANCE — looks at the card's printed
   keywords PLUS any granted ones living on the instance (cr.extraKw) or
   coming from a class-wide aura on the owning side. Use this anywhere we
   need to know "does this specific creature have <kw> right now". */
function crKw(s, side, cr, name) {
  if (!cr) return false;
  if (kw(cr.cardId, name)) return true;
  if (Array.isArray(cr.extraKw) && cr.extraKw.includes(name)) return true;
  // tempKw is wiped at endTurn — used by one-turn ultimates (e.g. Druido
  // "Risveglio della Foresta" grants Trample for the turn).
  if (Array.isArray(cr.tempKw) && cr.tempKw.includes(name)) return true;
  const p = s && s.players && s.players[side];
  // hasClass is a function declaration — hoisted, so safe to call here.
  if (!p || !hasClass(p)) return false;
  if (name === "trample"  && p.perks.creatureTrample  > 0) return true;
  if (name === "lifelink" && p.perks.creatureLifelink > 0) return true;
  return false;
}
export function creatureKeywords(cardId) {
  const c = getCard(cardId);
  return c && Array.isArray(c.keywords) ? c.keywords : [];
}

function mkPlayer(name, deck, classOpt) {
  const base = {
    name: name || "Giocatore",
    hp: START_HP,
    tempHp: 0,         // ward / temporary HP, soaks damage before hp
    deck: deck.slice(),
    hand: [],
    battlefield: [], // creatures
    lands: [],       // {instId, cardId, element, tapped}
    artifacts: [],
    graveyard: [],   // cardIds
    playedLand: false, // a land already played this turn?
    charges: 0,        // Cariche for Element Powers (gain 1/turn, cap 2)
    attuned: {},       // { fire:bool, … } — set in createGame from the deck
    /* Class system (Fase 1). When classOpt is null the player is a
       "neutral" hero with no class — XP/levels/slots stay inert and
       the engine falls back to pre-class behaviour (backward compat). */
    klass: null,
    via: null,
    xp: 0,
    level: 1,
    slots: null,           // { 1, 2, 3 } or null when classless
    slotsUnlocked: null,
    slotCap: null,
    casterTier: null,
    perks: null,
    turnFlags: null,
    levelHistory: [],      // [{level, name}, …] — for UI history
  };
  if (classOpt && classOpt.klass && classOpt.via) {
    Object.assign(base, initClassState(classOpt.klass, classOpt.via));
  }
  return base;
}

/* Heal helper — regular heals are capped at START_HP. Ward heals
   (opts.ward) also cap hp but route the overflow into tempHp, which
   soaks damage before hp. Returns the amount actually applied (heal
   + ward) so callers can decide whether to log. */
function gainHp(s, side, amount, opts = {}) {
  if (amount <= 0) return 0;
  const p = s.players[side];
  const room = Math.max(0, START_HP - p.hp);
  const heal = Math.min(room, amount);
  const overflow = amount - heal;
  p.hp += heal;
  let wardGain = 0;
  if (opts.ward && overflow > 0) {
    p.tempHp = (p.tempHp || 0) + overflow;
    wardGain = overflow;
  }
  const shown = heal + wardGain;
  if (shown > 0) fx(s, { kind: "healHero", side, amount: shown });
  return shown;
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

/* ============================================================
   CLASS · XP · LEVEL-UP · SLOTS
   ============================================================ */

/* true when this player has a class (so the XP/slot machinery
   should run). Backward-compat shortcut used everywhere. */
function hasClass(p) {
  return !!(p && p.klass && p.via && p.perks);
}

/* Slot tier required for a card. Creatures/artifacts/lands → 0
   (no slot needed). Spells (sorceries + instants) use spellSlotTier. */
function slotTierForCard(card) {
  if (!card) return 0;
  if (card.type !== "spell") return 0;
  return spellSlotTier(card.cmc || 0);
}

/* Effective cost after class perks (mana side only — slots are gated
   separately). Always returns a fresh object, leaving the card's own
   cost untouched. Discounts only reduce GENERIC pips; colored pips
   stay sacred so an "Evocazione" Mago can't free-cast Verde 🟢. */
function effectiveCost(s, side, card) {
  const baseCost = card.cost || {};
  const p = s.players[side];
  if (!hasClass(p)) return baseCost;
  let gen = baseCost.generic || 0;
  // Mago (caster pieno): -1 generic on every spell (incl. reactions)
  if (p.casterTier === "full" && card.type === "spell") gen = Math.max(0, gen - 1);
  // +N from explicit casterDiscountBonus perk
  if (card.type === "spell" && p.perks && p.perks.casterDiscountBonus)
    gen = Math.max(0, gen - p.perks.casterDiscountBonus);
  // First creature this turn: Mago-Evocazione lv2 grants -N on generic
  if (
    card.type === "creature" &&
    p.perks && p.perks.firstCreatureDiscount &&
    p.turnFlags && !p.turnFlags.firstCreaturePlayed
  ) {
    gen = Math.max(0, gen - p.perks.firstCreatureDiscount);
  }
  // Druido-Terra lv3 "Foresta Antica": creatures with cmc ≥ 4 cost -N
  if (
    card.type === "creature" &&
    (card.cmc || 0) >= 4 &&
    p.perks && p.perks.bigCreatureDiscount
  ) {
    gen = Math.max(0, gen - p.perks.bigCreatureDiscount);
  }
  // Aether Surge (Mago-Invocazione lv5 ult): spells cost 0 mana this turn
  if (
    card.type === "spell" &&
    p.perks && p.perks.ultimateActive &&
    p.perks.ultimateId === "aether_surge"
  ) {
    // wipe ALL mana cost (generic + colored) for the turn the ult is up
    const free = { generic: 0 };
    for (const el of ELEMENTS) free[el] = 0;
    return free;
  }
  if (gen === (baseCost.generic || 0)) return baseCost; // unchanged
  return { ...baseCost, generic: gen };
}

/* Can `side` afford to consume one slot of the given tier? */
function canAffordSlot(s, side, tier) {
  if (tier <= 0) return true;
  const p = s.players[side];
  if (!hasClass(p)) return true; // no class = no slot system
  if (!p.slotsUnlocked || !p.slotsUnlocked[tier]) return false;
  return (p.slots[tier] || 0) > 0;
}

/* Pay one slot of the given tier. No-op when classless or tier == 0. */
function consumeSlot(s, side, tier) {
  if (tier <= 0) return;
  const p = s.players[side];
  if (!hasClass(p)) return;
  p.slots[tier] = Math.max(0, (p.slots[tier] || 0) - 1);
}

/* Apply a single level-up reward patch onto the player's perks +
   open any newly unlocked slot tiers. Idempotent per (level). */
function applyReward(s, side, reward) {
  if (!reward) return;
  const p = s.players[side];
  const patch = reward.patch || {};
  for (const k of [
    "extraSlot1PerTurn", "extraSlot2PerTurn", "extraSlot3PerTurn",
    "firstCreatureDiscount",
    "firstCreatureBuffP", "firstCreatureBuffT",
    "creatureBuffP", "creatureBuffT",
    "onCreaturePlayPing", "onCreaturePlayHeal", "aoeBonus",
    "heroDmgBonus",
    "extraHealPerTurn", "healBonus",
    "onKillHeal", "onEnemyDeathPing", "creatureLifelink",
    "creatureTrample", "creatureCombatBonus",
    "firstReactionDmgBonus", "singleTargetDmgBonus",
    "onReactionDraw", "firstCreatureFlying",
    "extraLandPerTurn", "bigCreatureDiscount",
    "extraDrawPerTurn", "casterDiscountBonus",
  ]) {
    if (patch[k] != null) p.perks[k] = (p.perks[k] || 0) + patch[k];
  }
  if (patch.ultimate) {
    p.perks.ultimateId = patch.ultimate;
    p.perks.ultimateUsed = false;
    p.perks.ultimateActive = false;
  }
  p.levelHistory.push({ level: reward.level, name: reward.name, icon: reward.icon });
  fx(s, { kind: "levelUp", side, level: reward.level, name: reward.name });
  logMsg(s, side, `⭐ ${p.name} sale al livello ${reward.level} — ${reward.icon} ${reward.name}.`);
}

/* Process pending level-ups for `side`. Each level-up triggered by
   the current XP total fires once. Newly unlocked slot tiers also
   grant 1 slot of that tier on the spot. */
function applyLevelUps(s, side) {
  const p = s.players[side];
  if (!hasClass(p)) return;
  const target = Math.min(MAX_LEVEL, levelForXp(p.xp));
  while (p.level < target) {
    const newLevel = p.level + 1;
    p.level = newLevel;
    // slot-tier unlocks (driven by level, not by class)
    for (const tier of [2, 3]) {
      if (SLOT_TIER_UNLOCK_LEVEL[tier] === newLevel && !p.slotsUnlocked[tier]) {
        p.slotsUnlocked[tier] = true;
        p.slots[tier] = Math.min(p.slotCap[tier], (p.slots[tier] || 0) + 1);
        logMsg(s, side, `🔓 ${p.name} sblocca gli spell slot di tier ${tier}.`);
      }
    }
    // subclass-specific reward (may be missing for stubbed classes)
    const reward = rewardAt(p.klass, p.via, newLevel);
    applyReward(s, side, reward);
  }
}

/* True when `side`'s ultimate is unlocked, not yet used, and the
   game state allows a sorcery-speed activation. */
export function canActivateUltimate(s, side) {
  return ultimateBlockReason(s, side) === null;
}

/* When an ultimate cannot be fired, return a short Italian message
   explaining WHY (used by the UI to spell it out on the button —
   players were clicking and seeing nothing happen). Returns null when
   the ult is ready to go. */
export function ultimateBlockReason(s, side) {
  if (!s) return "Partita non pronta.";
  if (s.winner) return "Partita conclusa.";
  const p = s.players[side];
  if (!hasClass(p))      return "Nessuna classe attiva.";
  if (!p.perks.ultimateId) return "Sblocca al livello 5.";
  if (p.perks.ultimateUsed) return "Già usata.";
  if (s.active !== side) return "Solo nel tuo turno.";
  if (s.phase !== "main") return "Solo in fase principale.";
  if (s.stack.length)    return "Aspetta che la pila si risolva.";
  if (s.priority)        return "Risolvi prima la pila.";
  return null;
}

/* Fire the lv-5 ultimate. Each class+via has its own resolution. */
export function activateUltimate(state, side) {
  if (!canActivateUltimate(state, side)) return state;
  const s = clone(state);
  const p = s.players[side];
  const id = p.perks.ultimateId;
  p.perks.ultimateUsed = true;
  fx(s, { kind: "ultimate", side, id });
  if (id === "aether_surge") {
    p.perks.ultimateActive = true;
    logMsg(s, side, `🌌 ${p.name} scatena Aether Surge: questo turno i tuoi spell costano 0 mana!`);
  } else if (id === "risveglio_ancestrale") {
    // pick the strongest creature in the graveyard (by cmc, then power+toughness)
    let bestId = null, bestScore = -1;
    for (const cardId of p.graveyard) {
      const c = getCard(cardId);
      if (!c || c.type !== "creature") continue;
      const score = (c.cmc || 0) * 100 + (c.power || 0) + (c.toughness || 0);
      if (score > bestScore) { bestScore = score; bestId = cardId; }
    }
    if (bestId) {
      const cr = mkCreature(s, side, bestId);
      cr.sick = false; // haste-like burst on the revived copy
      p.battlefield.push(cr);
      fx(s, { kind: "play", side, cardId: bestId, into: "battlefield", instId: cr.instId });
      logMsg(s, side, `🌟 Risveglio Ancestrale evoca una copia di ${getCard(bestId).name}!`);
    } else {
      logMsg(s, side, `🌟 Risveglio Ancestrale fallisce: nessuna creatura nel cimitero.`);
    }
  } else if (id === "esplosione_vulcanica") {
    // Guerriero-Campione lv5: 5 to all enemy creatures, 3 to enemy hero.
    const foe = opp(side);
    const foeCrs = s.players[foe].battlefield.slice();
    for (const cr of foeCrs) damageCreature(s, foe, cr, 5, "fire");
    damageHero(s, foe, 3, "fire");
    logMsg(s, side, `🌋 Esplosione Vulcanica devasta il campo nemico!`);
    resolveDeaths(s);
    checkWin(s);
  } else if (id === "unisono_acciaio") {
    // Guerriero-Battaglia lv5: untap all your creatures + haste +
    // +2 damage for the duration of this turn (one-shot). We re-use
    // the per-creature plusP and clear it at end of turn (the engine
    // already wipes tempP on endTurn so we lean on tempP here).
    for (const cr of p.battlefield) {
      cr.tapped = false;
      cr.sick = false;
      cr.tempP = (cr.tempP || 0) + 2;
    }
    p.perks.ultimateActive = true;
    logMsg(s, side, `🗡️🛡️ Unisono d'Acciaio: le tue creature ruggiscono e attaccano insieme!`);
  } else if (id === "resurrezione_divina") {
    // Chierico-Vita lv5: heal 15 PV; overflow → temporary HP (ward).
    const got = gainHp(s, side, 15, { ward: true });
    logMsg(s, side, `🌟 Resurrezione Divina: ${p.name} risorge — +${got} PV (eccedenza → PV temporanei).`);
  } else if (id === "apocalisse") {
    // Chierico-Morte lv5: 4 to all enemy creatures; heal 2 for each
    // creature that DIES from this effect (snapshot before/after).
    const foe = opp(side);
    const before = s.players[foe].battlefield.length;
    for (const cr of s.players[foe].battlefield.slice()) {
      damageCreature(s, foe, cr, 4, "darkness");
    }
    resolveDeaths(s);
    const killed = before - s.players[foe].battlefield.length;
    const healed = killed * 2;
    if (healed > 0) {
      const got = gainHp(s, side, healed);
      logMsg(s, side, `☠️ Apocalisse: ${killed} creature dissolte, ${p.name} recupera ${got} PV.`);
    } else {
      logMsg(s, side, `☠️ Apocalisse: nessuna creatura nemica è caduta.`);
    }
    checkWin(s);
  } else if (id === "assassinio") {
    // Ladro-Assassino lv5: outright destroy the foe's strongest creature.
    // Hexproof/shield cannot save it (this is a direct removal effect).
    const foe = opp(side);
    let best = null, bestScore = -1;
    for (const cr of s.players[foe].battlefield) {
      const st = effStats(s, foe, cr);
      const score = st.power * 100 + st.toughness;
      if (score > bestScore) { bestScore = score; best = cr; }
    }
    if (best) {
      best.damage = 9999;
      best.shield = false;
      const card = getCard(best.cardId);
      logMsg(s, side, `🗡️ Assassinio: ${card.name} viene eliminato silenziosamente.`);
      resolveDeaths(s);
      checkWin(s);
    } else {
      logMsg(s, side, `🗡️ Assassinio: nessuna creatura da colpire.`);
    }
  } else if (id === "furto_perfetto") {
    // Ladro-Thief lv5: draw 3 cards.
    let drew = 0;
    for (let i = 0; i < 3; i++) { if (drawOne(s, side, true)) drew++; }
    logMsg(s, side, `🎴 Furto Perfetto: ${p.name} pesca ${drew} carte.`);
  } else if (id === "risveglio_foresta") {
    // Druido-Terra lv5: all your creatures +2/+2 and Trample until EOT.
    for (const cr of p.battlefield) {
      cr.tempP = (cr.tempP || 0) + 2;
      cr.tempT = (cr.tempT || 0) + 2;
      cr.tempKw = [...(cr.tempKw || []), "trample"];
    }
    p.perks.ultimateActive = true;
    logMsg(s, side, `🌲 Risveglio della Foresta: i tuoi alleati ruggiscono!`);
  } else if (id === "forma_predatore") {
    // Druido-Luna lv5: all your creatures +3/+3 and Trample until EOT.
    for (const cr of p.battlefield) {
      cr.tempP = (cr.tempP || 0) + 3;
      cr.tempT = (cr.tempT || 0) + 3;
      cr.tempKw = [...(cr.tempKw || []), "trample"];
    }
    p.perks.ultimateActive = true;
    logMsg(s, side, `🐅 Forma del Predatore: le tue creature diventano belve!`);
  } else {
    logMsg(s, side, `${p.name} prepara la sua ultimate.`);
  }
  return s;
}

/* Grant XP and resolve any level-ups it triggers. Sources:
     "damage"  — to enemy hero
     "kill"    — killed an enemy creature
     "reaction"— cast an instant-speed spell
     "upkeep"  — survived another turn                              */
function gainXp(s, side, amount, reason) {
  if (amount <= 0) return;
  const p = s.players[side];
  if (!hasClass(p)) return;
  if (p.level >= MAX_LEVEL && p.xp >= LAST_THRESHOLD) return; // capped
  p.xp += amount;
  fx(s, { kind: "xpGain", side, amount, reason, total: p.xp });
  applyLevelUps(s, side);
}
const LAST_THRESHOLD = 36; // mirrors LEVEL_THRESHOLDS[MAX_LEVEL]

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
  // generic: tap from the element with the MOST untapped lands left,
  // so we never waste a scarce colour on a generic pip — this keeps
  // mana behaving predictably across several plays in a turn.
  for (let i = 0; i < (cost.generic || 0); i++) {
    const free = {};
    for (const l of lands) if (!l.tapped) free[l.element] = (free[l.element] || 0) + 1;
    let best = null;
    for (const el in free) if (best == null || free[el] > free[best]) best = el;
    if (best) tapOne((x) => x.element === best);
    else tapOne(() => true);
  }
}

/* ---- creation ---- */
export function createGame({
  p0Name, p1Name, deck0, deck1, starter,
  p0Class, p1Class, // { klass, via } each — optional (classless = backward compat)
} = {}) {
  // ALWAYS shuffle the library at game start — a player-built deck is
  // saved grouped (copies/lands together), so without this the opening
  // hand and draws come out in order (e.g. all lands first).
  const d0 = shuffle(deck0 || buildDeck());
  const d1 = shuffle(deck1 || buildDeck());
  const s = {
    v: 3, // bumped: class system added
    players: {
      p0: mkPlayer(p0Name, d0, p0Class),
      p1: mkPlayer(p1Name, d1, p1Class),
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

  // gain 1 Carica for Element Powers (capped) — kept for the legacy
  // power system while the class system is still bedding in.
  p.charges = Math.min(POWER_CHARGE_CAP, (p.charges || 0) + 1);

  // ── CLASS SYSTEM: upkeep XP tick, slot generation, perk hooks ──
  if (hasClass(p)) {
    // reset per-turn flags from the previous round
    p.turnFlags = {
      firstCreaturePlayed: false,
      firstReactionPlayed: false,
      landsPlayedThisTurn: 0,
    };
    // gain tier-1 slots (1 base + perk extra), capped by class
    const grant1 = 1 + (p.perks.extraSlot1PerTurn || 0);
    p.slots[1] = Math.min(p.slotCap[1], (p.slots[1] || 0) + grant1);
    // if higher tiers are unlocked we also drip 1 of each (capped)
    if (p.slotsUnlocked[2]) {
      const grant2 = 1 + (p.perks.extraSlot2PerTurn || 0);
      p.slots[2] = Math.min(p.slotCap[2], (p.slots[2] || 0) + grant2);
    }
    if (p.slotsUnlocked[3]) {
      const grant3 = 1 + (p.perks.extraSlot3PerTurn || 0);
      p.slots[3] = Math.min(p.slotCap[3], (p.slots[3] || 0) + grant3);
    }
    // expire ultimate-active flag at the start of YOUR next turn (the
    // ult is one-turn only). We do this BEFORE granting XP so the
    // visual fx of the survival tick can't be misread.
    if (p.perks.ultimateActive) p.perks.ultimateActive = false;
    // Chierico-Vita lv2 "Benedizione": upkeep heal
    if (p.perks.extraHealPerTurn > 0) {
      const got = gainHp(s, side, p.perks.extraHealPerTurn);
      if (got > 0) logMsg(s, side, `✨ ${p.name} recupera ${got} PV (Benedizione).`);
    }
    // +1 XP for surviving into another turn — symmetric pacing nudge
    gainXp(s, side, 1, "upkeep");
  }

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
    const got = gainHp(s, side, healSum);
    if (got > 0)
      logMsg(s, side, `${p.name} recupera ${got} PV (manufatto).`);
  }

  const skipDraw = isGameStart && s.turn === 1;
  if (!skipDraw) drawOne(s, side, false);
  for (let i = 0; i < drawExtra; i++) drawOne(s, side, false);
  // class perk: Mago-Invocazione lv3 draws +1 each turn
  if (hasClass(p)) {
    const perkDraw = p.perks.extraDrawPerTurn || 0;
    for (let i = 0; i < perkDraw; i++) drawOne(s, side, false);
  }

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
  // Druido-Terra lv2 "Crescita Naturale" allows +N extra lands/turn.
  // Without the perk we keep the classic 1-land-per-turn rule.
  const cap = 1 + (hasClass(p) ? (p.perks.extraLandPerTurn || 0) : 0);
  const played = hasClass(p) ? (p.turnFlags.landsPlayedThisTurn || 0) : (p.playedLand ? 1 : 0);
  if (played >= cap) return false;
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
  // EFFECTIVE COST: caster discount + ultimate-active free-spells +
  // first-creature discount (Mago-Evocazione lv2). Computed once here
  // and passed to canAfford so the slot/mana check stays in sync with
  // what payCost will actually consume in playCard.
  const eff = effectiveCost(s, side, card);
  if (!canAfford(s, side, eff)) return false;
  // SPELL SLOT GATE — only spells (sorceries + instants) need slots.
  const tier = slotTierForCard(card);
  if (tier > 0 && !canAffordSlot(s, side, tier)) return false;

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
  if (hasClass(p)) {
    p.turnFlags.landsPlayedThisTurn = (p.turnFlags.landsPlayedThisTurn || 0) + 1;
  }
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

  // pay mana cost using the perk-adjusted cost we'd validated in canPlay
  const eff = effectiveCost(s, side, card);
  payCost(s, side, eff);
  // pay the slot (sorceries + reactions only — creatures/artifacts skip)
  const tier = slotTierForCard(card);
  if (tier > 0) consumeSlot(s, side, tier);
  p.hand.splice(idx, 1);

  if (card.type === "creature") {
    // ── Legend rule ──────────────────────────────────────────────
    // A legendary creature is UNIQUE on your battlefield: casting a
    // second copy auto-destroys the previous one ("regola della
    // leggenda"). The new copy enters fresh — no shared HP/buffs.
    if (card.rarity === "legendary") {
      for (const existing of p.battlefield) {
        if (existing.cardId === card.id) {
          existing.damage = 9999;
        }
      }
    }
    const cr = mkCreature(s, side, card.id);
    // class perks: aura/firstCreature buffs baked in at summon. The
    // first-creature-this-turn slot fires its bonuses BEFORE we flip
    // the flag (else the discount would re-fire on a follow-up cast).
    if (hasClass(p)) {
      cr.plusP = (cr.plusP || 0) + (p.perks.creatureBuffP || 0);
      cr.plusT = (cr.plusT || 0) + (p.perks.creatureBuffT || 0);
      if (!p.turnFlags.firstCreaturePlayed) {
        cr.plusP += (p.perks.firstCreatureBuffP || 0);
        cr.plusT += (p.perks.firstCreatureBuffT || 0);
        // Ladro-Thief lv3 "Eclissi": first creature each turn gains Flying.
        // Stored on the instance (extraKw) so combat checks see it.
        if (p.perks.firstCreatureFlying > 0) {
          cr.extraKw = [...(cr.extraKw || []), "flying"];
        }
        p.turnFlags.firstCreaturePlayed = true;
      }
    }
    p.battlefield.push(cr);
    fx(s, { kind: "play", side, cardId: card.id, into: "battlefield", instId: cr.instId });
    if (card.rarity === "legendary"
        && p.battlefield.some((x) => x !== cr && x.cardId === card.id && x.damage >= 9999)) {
      logMsg(s, side, `⚖️ Regola della Leggenda: ${card.name} sostituisce la versione precedente.`);
    } else {
      logMsg(s, side, `${p.name} evoca ${card.name}.`);
    }
    // Mago-Evocazione lv4: each creature you play pings the foe for N
    if (hasClass(p) && p.perks.onCreaturePlayPing > 0) {
      const ping = p.perks.onCreaturePlayPing;
      logMsg(s, side, `✨ Convocazione Continua infligge ${ping} all'eroe avversario.`);
      damageHero(s, opp(side), ping, card.element || "natura");
    }
    // Chierico-Vita lv4 "Aura della Vita": heal N each summon
    if (hasClass(p) && p.perks.onCreaturePlayHeal > 0) {
      const got = gainHp(s, side, p.perks.onCreaturePlayHeal);
      if (got > 0) logMsg(s, side, `💗 Aura della Vita: ${p.name} recupera ${got} PV.`);
    }
    resolveDeaths(s);
    checkWin(s);
  } else if (card.type === "artifact") {
    p.artifacts.push({ instId: newInst(s), cardId: card.id });
    fx(s, { kind: "play", side, cardId: card.id, into: "artifacts" });
    logMsg(s, side, `${p.name} attiva ${card.name}.`);
  } else {
    // SPELL → goes on the stack; the opponent gets a chance to respond
    // Track "first reaction this turn" so Ladro-Assassino lv2 can boost
    // the FIRST instant only. The tag rides along on the stack item.
    let firstReaction = false;
    if (hasClass(p) && card.speed === "instant" && !p.turnFlags.firstReactionPlayed) {
      firstReaction = true;
      p.turnFlags.firstReactionPlayed = true;
    }
    s.stack.push({ uid: newInst(s), side, cardId: card.id, target, firstReaction });
    s.priority = opp(side);
    s.passes = 0;
    fx(s, { kind: "stack", side, cardId: card.id });
    logMsg(s, side, `${p.name} lancia ${card.name} (in pila).`);
    // XP: every spell at INSTANT speed (a "reazione") feeds the meter
    if (card.speed === "instant") gainXp(s, side, 1, "reaction");
    // Ladro-Thief lv4 "Furto": each reaction you cast also draws a card
    if (hasClass(p) && card.speed === "instant" && p.perks.onReactionDraw > 0) {
      for (let i = 0; i < p.perks.onReactionDraw; i++) drawOne(s, side, false);
      logMsg(s, side, `💎 Furto: ${p.name} pesca ${p.perks.onReactionDraw} carta.`);
    }
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
   This returns a uniform { effect, element, name, … } view. The
   `firstReaction` flag propagates from the stack item so the resolver
   can apply Ladro-Assassino lv2 to ONLY the first instant of the turn. */
function stackSpell(item) {
  if (item.power) {
    const P = ELEMENT_POWERS[item.power];
    return P
      ? { effect: P.effect, element: item.power, name: P.name, isPower: true }
      : null;
  }
  const c = getCard(item.cardId);
  return c ? {
    effect: c.effect, element: c.element, name: c.name,
    speed: c.speed || "sorcery",
    firstReaction: !!item.firstReaction,
  } : null;
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
    // Bonuses to single-target damage spells:
    //   • Ladro-Assassino lv3 "Veleno Sottile": every single-target dmg +N
    //   • Ladro-Assassino lv2 "Affondo Letale": FIRST reaction this turn +N
    let extra = 0;
    if (hasClass(me)) {
      extra += me.perks.singleTargetDmgBonus || 0;
      if (card.firstReaction && card.speed === "instant") {
        extra += me.perks.firstReactionDmgBonus || 0;
      }
    }
    const dmg = e.amount + extra;
    if (target && target.type === "hero") {
      damageHero(s, target.side, dmg, card.element);
    } else if (target && target.type === "creature") {
      const f = findCreature(s, target.instId);
      if (f) damageCreature(s, f.side, f.creature, dmg, card.element);
    }
  } else if (e.kind === "aoe_enemy") {
    const foe = opp(side);
    // Mago-Invocazione lv4 "Detonazione": +N to every AoE damage spell
    const aoeBonus = hasClass(me) ? (me.perks.aoeBonus || 0) : 0;
    const dmg = e.amount + aoeBonus;
    for (const cr of s.players[foe].battlefield.slice())
      damageCreature(s, foe, cr, dmg, card.element);
  } else if (e.kind === "heal") {
    // Chierico-Vita lv3 "Protezione Sacra": healBonus +N on every heal
    const bonus = hasClass(me) ? (me.perks.healBonus || 0) : 0;
    const got = gainHp(s, side, e.amount + bonus);
    logMsg(s, side,
      got > 0
        ? `${me.name} recupera ${got} PV.`
        : `${me.name} è già al massimo dei PV.`);
  } else if (e.kind === "wardHeal") {
    // heals up to max HP; any excess becomes temporary HP (a buffer
    // that absorbs damage before real HP — persists until consumed)
    const bonus = hasClass(me) ? (me.perks.healBonus || 0) : 0;
    const before = me.hp;
    const beforeTemp = me.tempHp || 0;
    gainHp(s, side, e.amount + bonus, { ward: true });
    const healed = me.hp - before;
    const warded = (me.tempHp || 0) - beforeTemp;
    const parts = [];
    if (healed > 0) parts.push(`recupera ${healed} PV`);
    if (warded > 0) parts.push(`ottiene ${warded} PV temporanei`);
    logMsg(s, side,
      parts.length
        ? `${me.name} ${parts.join(" e ")}.`
        : `${me.name} è già al massimo dei PV.`);
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
  if (amount <= 0) return;
  // Guerriero-Campione lv3 "Furia di Battaglia": +N to any damage you
  // deal to the enemy hero (spells + combat both pass through here or
  // strikeHero — both check this perk). Source is opp(side).
  const attacker = s.players[opp(side)];
  if (hasClass(attacker) && attacker.perks.heroDmgBonus) {
    amount += attacker.perks.heroDmgBonus;
  }
  const p = s.players[side];
  let remaining = amount;
  if (p.tempHp && p.tempHp > 0) {
    const soaked = Math.min(p.tempHp, remaining);
    p.tempHp -= soaked;
    remaining -= soaked;
  }
  p.hp -= remaining;
  fx(s, { kind: "damageHero", side, amount, element });
  // XP: the attacker (the OPPONENT of `side`) gains 1 XP per damage point
  gainXp(s, opp(side), amount, "damage");
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
          const dyingCard = getCard(cr.cardId);
          bf.splice(i, 1);
          s.players[side].graveyard.push(cr.cardId);
          fx(s, { kind: "death", side, instId: cr.instId, cardId: cr.cardId });
          logMsg(s, side, `${dyingCard.name} muore.`);
          // XP: the OPPONENT of the dying creature's owner gets cmc XP.
          // (Self-sacrifice cases are rare and we accept the simplification.)
          if (dyingCard && dyingCard.cmc != null) {
            gainXp(s, opp(side), dyingCard.cmc, "kill");
          }
          // Chierico-Morte perks on the killer (= opp(side)):
          //   lv2 onKillHeal       → killer recovers N PV
          //   lv4 onEnemyDeathPing → enemy hero (= side) takes N damage
          const killer = s.players[opp(side)];
          if (hasClass(killer)) {
            if (killer.perks.onKillHeal > 0) {
              const got = gainHp(s, opp(side), killer.perks.onKillHeal);
              if (got > 0) logMsg(s, opp(side), `🌑 Tocco Necrotico: ${killer.name} recupera ${got} PV.`);
            }
            if (killer.perks.onEnemyDeathPing > 0) {
              const ping = killer.perks.onEnemyDeathPing;
              logMsg(s, opp(side), `💀 Maledizione infligge ${ping} a ${s.players[side].name}.`);
              damageHero(s, side, ping, "darkness");
            }
          }
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

/* can `blk` legally block `atk` (evasion keywords)? Uses crKw so that
   granted keywords (e.g. Ladro-Thief's "first creature gains Flying")
   are honoured alongside intrinsic ones. */
function canBlock(s, atkSide, atk, blk) {
  const defSide = opp(atkSide);
  if (kw(atk.cardId, "unblockable")) return false;
  if (
    crKw(s, atkSide, atk, "flying") &&
    !crKw(s, defSide, blk, "flying") &&
    !crKw(s, defSide, blk, "reach")
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
  // Lifelink: from the source's keywords OR from a class-wide aura
  // (Chierico-Morte lv3 "Vampirismo" gives lifelink to ALL your creatures).
  const srcP = s.players[srcSide];
  const auraLifelink = hasClass(srcP) && srcP.perks.creatureLifelink > 0;
  if (kw(src.cardId, "lifelink") || auraLifelink) gainHp(s, srcSide, amount);
}
function strikeHero(s, srcSide, src, tgtSide, amount) {
  if (amount <= 0) return;
  // heroDmgBonus also applies to direct combat strikes (mirrors the
  // damageHero branch). Source is srcSide (the attacker).
  const attacker = s.players[srcSide];
  if (hasClass(attacker) && attacker.perks.heroDmgBonus) {
    amount += attacker.perks.heroDmgBonus;
  }
  const p = s.players[tgtSide];
  let remaining = amount;
  if (p.tempHp && p.tempHp > 0) {
    const soaked = Math.min(p.tempHp, remaining);
    p.tempHp -= soaked;
    remaining -= soaked;
  }
  p.hp -= remaining;
  fx(s, { kind: "damageHero", side: tgtSide, amount });
  const srcP = s.players[srcSide];
  const auraLifelink = hasClass(srcP) && srcP.perks.creatureLifelink > 0;
  if (src && (kw(src.cardId, "lifelink") || auraLifelink)) gainHp(s, srcSide, amount);
  // combat damage also feeds XP — same +1 per point as spell damage
  gainXp(s, srcSide, amount, "damage");
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
  const atkP = s.players[atkSide];
  // Ladro-Assassino lv4 "Colpo nel Buio": ALL your creatures hit harder
  // in combat. Folded into aPow up front so the trample / blocker math
  // stays consistent.
  const combatBonus = hasClass(atkP) ? (atkP.perks.creatureCombatBonus || 0) : 0;
  const runPass = (firstStrike) => {
    for (const { atkId, blkIds } of pairs) {
      const a = aliveA(atkId);
      if (!a) continue;
      const aPow = effStats(s, atkSide, a).power + combatBonus;
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
          if (crKw(s, atkSide, a, "trample") && pow > 0)
            strikeHero(s, atkSide, a, defSide, Math.min(aPow, pow));
        }
        // every blocker strikes back at the attacker
        for (const b of blockers) {
          if (kw(b.cardId, "firststrike") === firstStrike && aliveA(atkId))
            strikeCreature(s, defSide, b, atkSide, a, effStats(s, defSide, b).power);
        }
      } else if (wasBlocked) {
        // all blockers died first — only Travolgere gets through
        if (crKw(s, atkSide, a, "trample") && aFS === firstStrike)
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
      cr.tempKw = []; // one-turn granted keywords (Druido ultimates etc.)
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
    if (typeof p.charges !== "number") p.charges = 0;
    if (typeof p.tempHp !== "number") p.tempHp = 0;
    if (!p.attuned || typeof p.attuned !== "object") p.attuned = {};
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
