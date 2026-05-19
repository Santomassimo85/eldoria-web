/* ============================================================
   TCG — AI OPPONENT  (Magic-style: plays lands, pays colours)
   ------------------------------------------------------------
   nextAction(state, side) -> one of:
     { type: "land",   instId }
     { type: "play",   instId, target }
     { type: "attack", attackerIds: [...] }
     { type: "discard", instId }
     { type: "end" }

   chooseBlocks(state, side) -> { [attackerInstId]: [blockerInstId, …] }
   ============================================================ */

import { getCard, ELEMENTS } from "./cards.js";
import {
  effStats, canPlay, canPlayLand, spellTargets, legalAttackers, opp,
  HAND_CAP,
} from "./engine.js";

const creatureValue = (s, side, cr) => {
  const e = effStats(s, side, cr);
  return e.power + e.toughness;
};

function biggestThreat(s, foe) {
  let best = null;
  for (const cr of s.players[foe].battlefield) {
    const e = effStats(s, foe, cr);
    if (!best || e.power > best.p || (e.power === best.p && e.toughness > best.t))
      best = { instId: cr.instId, p: e.power, t: e.toughness };
  }
  return best;
}

/* score a single playable hand card; also resolve its best target */
function scorePlay(s, side, hc) {
  const card = getCard(hc.cardId);
  const foe = opp(side);
  const me = s.players[side];

  if (card.type === "creature") {
    return { score: card.power + card.toughness + card.cmc * 0.5, target: null };
  }
  if (card.type === "artifact") {
    const boardN = me.battlefield.length;
    if (card.passive.kind === "anthem")
      return { score: 4 + boardN * (card.passive.p + card.passive.t), target: null };
    return { score: 6, target: null };
  }

  // spells
  const e = card.effect;
  if (e.kind === "destroy" || (e.kind === "damage" && e.target === "creature")) {
    const t = biggestThreat(s, foe);
    if (!t) return { score: -1, target: null };
    if (e.kind === "damage" && e.amount < t.t)
      return { score: t.p * 0.6, target: { type: "creature", instId: t.instId } };
    return { score: 6 + t.p + t.t, target: { type: "creature", instId: t.instId } };
  }
  if (e.kind === "damage" && e.target === "any") {
    if (s.players[foe].hp <= e.amount) return { score: 999, target: { type: "hero", side: foe } };
    const t = biggestThreat(s, foe);
    if (t && t.t <= e.amount && t.p >= 4)
      return { score: 6 + t.p, target: { type: "creature", instId: t.instId } };
    if (s.players[foe].hp <= 8) return { score: 5, target: { type: "hero", side: foe } };
    if (t && t.t <= e.amount) return { score: 4 + t.p, target: { type: "creature", instId: t.instId } };
    return { score: 3, target: { type: "hero", side: foe } };
  }
  if (e.kind === "aoe_enemy") {
    let kills = 0;
    for (const cr of s.players[foe].battlefield)
      if (effStats(s, foe, cr).toughness <= e.amount) kills += 1;
    return { score: kills * 5 - (kills === 0 ? 10 : 0), target: null };
  }
  if (e.kind === "heal") {
    const missing = Math.max(0, 20 - me.hp);
    return { score: me.hp <= 8 ? 7 + Math.min(missing, e.amount) : -2, target: null };
  }
  if (e.kind === "draw") {
    return { score: me.hand.length <= 3 ? 6 : 3, target: null };
  }
  if (e.kind === "buff") {
    if (me.battlefield.length === 0) return { score: -1, target: null };
    let best = null;
    for (const cr of me.battlefield) {
      const v = creatureValue(s, side, cr);
      if (!best || v > best.v) best = { instId: cr.instId, v };
    }
    return { score: 4 + e.p + e.t, target: { type: "creature", instId: best.instId } };
  }
  if (e.kind === "raise") {
    return { score: me.graveyard.some((id) => getCard(id)?.type === "creature") ? 7 : -1, target: null };
  }
  return { score: 0, target: null };
}

/* which land in hand best fits what we want to cast?
   weight = colour pips of every non-land card in hand, with a
   small nudge toward colours we don't yet produce. */
function pickLand(s, side) {
  const me = s.players[side];
  const lands = me.hand.filter((h) => getCard(h.cardId).type === "land");
  if (!lands.length) return null;

  const need = {};
  for (const el of ELEMENTS) need[el] = 0;
  for (const h of me.hand) {
    const c = getCard(h.cardId);
    if (c.type === "land") continue;
    for (const el of ELEMENTS) if (c.cost[el]) need[el] += c.cost[el];
  }
  const have = {};
  for (const el of ELEMENTS) have[el] = 0;
  for (const l of me.lands) have[l.element] += 1;

  let best = null;
  for (const h of lands) {
    const el = getCard(h.cardId).element;
    // prioritise colours we need but barely produce
    const score = need[el] * 2 - have[el];
    if (!best || score > best.score) best = { instId: h.instId, score };
  }
  return best ? best.instId : lands[0].instId;
}

export function nextAction(s, side) {
  if (s.winner || s.active !== side || s.phase !== "main") return { type: "end" };

  // 1) drop a land for the turn (helps everything that follows)
  if (!s.players[side].playedLand) {
    const landInst = pickLand(s, side);
    if (landInst && canPlayLand(s, side, landInst))
      return { type: "land", instId: landInst };
  }

  // 2) best beneficial, affordable play
  let best = null;
  for (const hc of s.players[side].hand) {
    if (getCard(hc.cardId).type === "land") continue;
    if (!canPlay(s, side, hc.instId)) continue; // canPlay already checks mana
    const r = scorePlay(s, side, hc);
    if (r.score <= 0) continue;
    if (!best || r.score > best.score) best = { instId: hc.instId, ...r };
  }
  if (best) {
    let target = best.target;
    if (target == null) {
      const tg = spellTargets(s, side, best.instId);
      if (tg.kind === "any") target = { type: "hero", side: opp(side) };
    }
    return { type: "play", instId: best.instId, target };
  }

  // 3) attacks
  if (!s.attackedThisTurn) {
    const ids = legalAttackers(s, side);
    if (ids.length) {
      const foe = opp(side);
      const foeBlockers = s.players[foe].battlefield.filter((c) => !c.tapped);
      const myAtt = ids.map((id) => {
        const cr = s.players[side].battlefield.find((c) => c.instId === id);
        return { id, ...effStats(s, side, cr) };
      });
      const totalPow = myAtt.reduce((a, b) => a + b.power, 0);

      if (totalPow >= s.players[foe].hp && foeBlockers.length < myAtt.length) {
        return { type: "attack", attackerIds: ids };
      }

      const chosen = [];
      for (const a of myAtt) {
        if (foeBlockers.length === 0) { chosen.push(a.id); continue; }
        let dies = false, kills = false;
        for (const b of foeBlockers) {
          const be = effStats(s, foe, b);
          if (be.power >= a.toughness) dies = true;
          if (a.power >= be.toughness) kills = true;
        }
        if (!dies || kills) chosen.push(a.id);
      }
      if (chosen.length) return { type: "attack", attackerIds: chosen };
    }
  }

  // nothing left to do — trim down to the hand cap before ending
  const hand = s.players[side].hand;
  if (hand.length > HAND_CAP) {
    // drop the least useful: surplus lands first, else highest cmc
    const haveLands = s.players[side].lands.length;
    let worst = null;
    for (const h of hand) {
      const c = getCard(h.cardId);
      const isLand = c.type === "land";
      const score =
        (isLand ? (haveLands >= 5 ? 100 : 20) : 0) + (c.cmc || 0);
      if (!worst || score > worst.score) worst = { instId: h.instId, score };
    }
    return { type: "discard", instId: worst.instId };
  }

  return { type: "end" };
}

/* AI as the defender — assign blockers */
export function chooseBlocks(s, side) {
  if (!s.combat) return {};
  const atkSide = opp(side);
  const attackers = s.combat.attackers
    .map((id) => {
      const cr = s.players[atkSide].battlefield.find((c) => c.instId === id);
      return cr ? { id, ...effStats(s, atkSide, cr) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.power - a.power);

  const blockers = s.players[side].battlefield
    .filter((c) => !c.tapped)
    .map((c) => ({ id: c.instId, ...effStats(s, side, c) }))
    .sort((a, b) => a.power + a.toughness - (b.power + b.toughness));

  const blocks = {}; // { atkId: [blockerId, …] }
  const usedB = new Set();
  const totalDmg = attackers.reduce((a, b) => a + b.power, 0);
  const lethal = totalDmg >= s.players[side].hp;

  for (const atk of attackers) {
    let pick = null;
    for (const b of blockers) {
      if (usedB.has(b.id)) continue;
      const kills = b.power >= atk.toughness;
      const survives = atk.power < b.toughness;
      if (kills && survives) { pick = b; break; }
      if (kills && !pick) pick = b;
    }
    if (pick) {
      blocks[atk.id] = [pick.id];
      usedB.add(pick.id);
    }
  }

  if (lethal) {
    let incoming = attackers
      .filter((a) => !blocks[a.id])
      .reduce((acc, a) => acc + a.power, 0);
    for (const atk of attackers) {
      if (incoming < s.players[side].hp) break;
      if (blocks[atk.id]) continue;
      // chump, or gang up to actually kill it if cheap blockers are free
      const free = blockers.filter((b) => !usedB.has(b.id));
      if (!free.length) break;
      const gang = [];
      let sum = 0;
      for (const b of free) {
        gang.push(b.id);
        sum += b.power;
        if (sum >= atk.toughness) break; // enough to kill it
      }
      const chosen = gang.length ? gang : [free[0].id];
      blocks[atk.id] = chosen;
      for (const id of chosen) usedB.add(id);
      incoming -= atk.power;
    }
  }
  return blocks;
}

/* AI holds priority on the stack → cast an instant in response or pass.
   Returns { type:"instant", instId, target } | { type:"pass" } */
export function respondToStack(s, side) {
  const me = s.players[side];
  const foe = opp(side);
  const castable = me.hand.filter(
    (h) => getCard(h.cardId).type === "spell" && canPlay(s, side, h.instId)
  );
  if (!castable.length) return { type: "pass" };

  const find = (kind) =>
    castable.find((h) => getCard(h.cardId).effect.kind === kind);

  // 1) counter a dangerous enemy spell on the stack
  const enemyTop = [...s.stack].reverse().find((it) => it.side !== side);
  if (enemyTop) {
    const ec = getCard(enemyTop.cardId);
    const dangerous =
      ["destroy", "aoe_enemy", "raise", "counter"].includes(ec.effect.kind) ||
      (ec.effect.kind === "damage") ||
      (ec.effect.kind === "buff") ||
      (ec.effect.kind === "draw" && (ec.effect.amount || 0) >= 2);
    const ctr = find("counter");
    if (ctr && dangerous)
      return { type: "instant", instId: ctr.instId, target: { uid: enemyTop.uid } };
  }

  // 2) defending in combat and about to take a lot → Fog
  if (
    s.phase === "block" &&
    s.combat &&
    s.combat.attackerSide === foe
  ) {
    const incoming = s.combat.attackers.reduce((n, id) => {
      const cr = s.players[foe].battlefield.find((c) => c.instId === id);
      return n + (cr ? effStats(s, foe, cr).power : 0);
    }, 0);
    const fog = find("fog");
    if (fog && incoming >= Math.min(7, s.players[side].hp)) {
      return { type: "instant", instId: fog.instId, target: null };
    }
    // burn a small attacker with a damage instant
    const dmg = castable.find((h) => {
      const c = getCard(h.cardId);
      return c.effect.kind === "damage";
    });
    if (dmg) {
      const amount = getCard(dmg.cardId).effect.amount;
      for (const id of s.combat.attackers) {
        const cr = s.players[foe].battlefield.find((c) => c.instId === id);
        if (cr && effStats(s, foe, cr).toughness <= amount)
          return {
            type: "instant",
            instId: dmg.instId,
            target: { type: "creature", instId: id },
          };
      }
    }
  }

  // 3) finisher: a damage instant that kills the enemy hero
  const dmgAny = castable.find((h) => {
    const c = getCard(h.cardId);
    return c.effect.kind === "damage" && c.effect.target === "any";
  });
  if (dmgAny && s.players[foe].hp <= getCard(dmgAny.cardId).effect.amount)
    return {
      type: "instant",
      instId: dmgAny.instId,
      target: { type: "hero", side: foe },
    };

  return { type: "pass" };
}
