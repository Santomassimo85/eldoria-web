/* ============================================================
   PET BATTLE — LIVE (real-time, turn-based, 1v1 team vs team)
   ------------------------------------------------------------
   Two players, each with a team of 1-5 pets, fight one active
   pet at a time. Both players submit an action per round
   (move OR switch). The challenger client resolves the round
   once both actions are present and writes the new state back.

   Switching is free — no turn cost. After a switch, attacks
   still resolve from BOTH sides in SPD order.

   Type cycle (already in petMoves.js):
     🔥 Fire > 🌿 Earth > ⚡ Air > 💧 Water > 🔥 Fire
   ============================================================ */

import { PET_MOVES, typeMultiplier } from "../data/petMoves";
import { PET_SPECIES, SKILL_UNLOCK_LEVELS } from "../data/petSpecies";
import { petStatsAtLevel, petEffectiveHp, effectivePetLevel } from "./pet";

export const MAX_TEAM_SIZE = 5;
export const MIN_TEAM_SIZE = 1;

/* Per-action timeout. After this elapses without an action the
   auto-submit kicks in with a random move (or a switch if the
   active pet is fainted). Both clients can fire it; pickAutoAction
   is deterministic on (battleId, round, side) so the result is the
   same and the Firestore write is idempotent. */
export const ACTION_TIMEOUT_MS = 5 * 60 * 1000;

export function nextActionDeadline() {
  return new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
}

/* ----------------------------------------------------------------
   Tiny deterministic RNG (mulberry32) seeded from a string. Used
   only by pickAutoAction so any client can compute the same auto
   action without coordinating.
   ---------------------------------------------------------------- */
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Pick a random valid action for a side that didn't submit in time.
   - If active is fainted, returns a switch to the first alive pet.
   - Otherwise picks a random unlocked move with uses remaining;
     unlimited-use attacks are always eligible.
   Returns null only if there's no possible action (no alive pets). */
export function pickAutoAction(battleId, round, side, teams, state) {
  const rng = seededRng(hashSeed(`${battleId}|${round}|${side}`));
  const myIdx = state.activeIdx[side];
  const team = teams[side];
  if (!team || team.length === 0) return null;

  const myHp = state.hp[side][myIdx];
  if (myHp <= 0) {
    // Forced switch — first alive pet
    for (let i = 0; i < team.length; i++) {
      if (i !== myIdx && state.hp[side][i] > 0) {
        return { kind: "switch", toIdx: i };
      }
    }
    return null; // no one alive — battle is already over
  }

  const me = team[myIdx];
  const moves = snapshotUnlockedMoves(me).filter(m => {
    if (m.maxUses == null) return true;
    const left = state.moveUses[side][myIdx]?.[m.id] ?? m.maxUses;
    return left > 0;
  });
  if (moves.length === 0) return null;
  const choice = moves[Math.floor(rng() * moves.length)];
  return { kind: "move", moveId: choice.id };
}

/* ----------------------------------------------------------------
   Freeze a pet's combat-relevant state at battle start. The live
   battle uses these snapshots throughout — pet edits made on the
   character doc during a fight don't leak in.
   ---------------------------------------------------------------- */
export function petSnapshotForBattle(pet) {
  if (!pet) return null;
  const sp = PET_SPECIES[pet.speciesKey];
  if (!sp) return null;
  const lvl = effectivePetLevel(pet);
  const stats = petStatsAtLevel(pet.speciesKey, lvl, pet.bonusStats);
  const startHp = Math.max(1, Math.min(stats.hp, petEffectiveHp(pet)));
  // Skills unlocked at this level — sourced from SKILL_UNLOCK_LEVELS so the
  // resolver and the UI stay in sync if cadence ever changes.
  const unlockedSkills = (sp.skills || [])
    .filter((_, i) => lvl >= (SKILL_UNLOCK_LEVELS[i] ?? 1));
  return {
    petId: pet.id,
    speciesKey: pet.speciesKey,
    nickname: pet.nickname || sp.name,
    icon: sp.icon,
    type: sp.type,
    level: lvl,
    maxHp: stats.hp,
    startHp,
    ac: stats.ac,
    atkBonus: stats.atkBonus,
    spd: stats.spd,
    profBonus: stats.profBonus,
    attacks: sp.attacks || [],
    skills: unlockedSkills,
  };
}

/* ----------------------------------------------------------------
   Initial battle state given both teams (already snapshotted).
   ---------------------------------------------------------------- */
export function initLiveBattleState(teamA, teamB) {
  const buildSide = team => ({
    hp: team.map(p => p.startHp),
    moveUses: team.map(p => {
      const uses = {};
      // All skills tracked with maxUses; attacks are unlimited (null)
      for (const moveId of [...(p.attacks || []), ...(p.skills || [])]) {
        const m = PET_MOVES[moveId];
        if (m && m.maxUses != null) uses[moveId] = m.maxUses;
      }
      return uses;
    }),
    shield: team.map(() => ({ turns: 0, val: 0 })),
    poison: team.map(() => ({ turns: 0, val: 0 })),
  });
  return {
    round: 1,
    activeIdx: { challenger: 0, challenged: 0 },
    hp: { challenger: buildSide(teamA).hp,       challenged: buildSide(teamB).hp },
    moveUses: { challenger: buildSide(teamA).moveUses, challenged: buildSide(teamB).moveUses },
    shield: { challenger: buildSide(teamA).shield,   challenged: buildSide(teamB).shield },
    poison: { challenger: buildSide(teamA).poison,   challenged: buildSide(teamB).poison },
    pendingActions: { challenger: null, challenged: null },
    actionDeadlines: { challenger: nextActionDeadline(), challenged: nextActionDeadline() },
    log: [`Round 1 — ${teamA[0].icon} ${teamA[0].nickname} vs ${teamB[0].icon} ${teamB[0].nickname}`],
    winner: null,
  };
}

/* ----------------------------------------------------------------
   The unlocked moves a pet has at this level.
   ---------------------------------------------------------------- */
export function snapshotUnlockedMoves(petSnap) {
  if (!petSnap) return [];
  const out = [];
  for (const id of petSnap.attacks || []) {
    const m = PET_MOVES[id];
    if (m) out.push(m);
  }
  // skills already pre-filtered by level in the snapshot
  for (const id of petSnap.skills || []) {
    const m = PET_MOVES[id];
    if (m) out.push(m);
  }
  return out;
}

/* ----------------------------------------------------------------
   Dice
   ---------------------------------------------------------------- */
const rd = (n) => Math.floor(Math.random() * n);
function rollDie(sides) { return rd(sides) + 1; }
function rollDice(num, sides) {
  let total = 0;
  for (let i = 0; i < num; i++) total += rollDie(sides);
  return total;
}

function diceTag(dice, isCrit) {
  if (!dice) return "";
  const n = isCrit ? dice.num * 2 : dice.num;
  return `${n}d${dice.sides}`;
}

/* ----------------------------------------------------------------
   Resolve one full round given both pending actions.
   Returns mutated state (new object), plus the actions are cleared.

   Actions shape:
     { kind: "move",   moveId: string }
     { kind: "switch", toIdx: number }
     { kind: "forfeit" }
   ---------------------------------------------------------------- */
export function resolveLiveRound(battle) {
  const next = clone(battle.state);
  const teams = battle.teams;
  const actionA = next.pendingActions.challenger;
  const actionB = next.pendingActions.challenged;
  const logs = [];

  // 0. Forfeits short-circuit the battle.
  if (actionA?.kind === "forfeit") {
    logs.push(`🏳 ${battle.challenger.ownerName} si è arreso.`);
    next.winner = "challenged";
  }
  if (actionB?.kind === "forfeit") {
    logs.push(`🏳 ${battle.challenged?.ownerName || "Sfidato"} si è arreso.`);
    next.winner = "challenger";
  }
  if (next.winner) {
    next.pendingActions = { challenger: null, challenged: null };
    next.log = [...battle.state.log, ...logs];
    return next;
  }

  // 1. Switches resolve first, simultaneously, with no turn cost.
  if (actionA?.kind === "switch") {
    const prevIdx = next.activeIdx.challenger;
    if (
      typeof actionA.toIdx === "number" &&
      actionA.toIdx !== prevIdx &&
      actionA.toIdx < teams.challenger.length &&
      next.hp.challenger[actionA.toIdx] > 0
    ) {
      next.activeIdx.challenger = actionA.toIdx;
      const newPet = teams.challenger[actionA.toIdx];
      logs.push(`🔄 ${battle.challenger.ownerName} fa entrare ${newPet.icon} ${newPet.nickname}!`);
    }
  }
  if (actionB?.kind === "switch") {
    const prevIdx = next.activeIdx.challenged;
    if (
      typeof actionB.toIdx === "number" &&
      actionB.toIdx !== prevIdx &&
      actionB.toIdx < teams.challenged.length &&
      next.hp.challenged[actionB.toIdx] > 0
    ) {
      next.activeIdx.challenged = actionB.toIdx;
      const newPet = teams.challenged[actionB.toIdx];
      logs.push(`🔄 ${battle.challenged.ownerName} fa entrare ${newPet.icon} ${newPet.nickname}!`);
    }
  }

  // 2. Poison ticks on the current active pets at the start of the action phase.
  for (const side of ["challenger", "challenged"]) {
    const idx = next.activeIdx[side];
    const p = next.poison[side][idx];
    const activeName = teams[side][idx].nickname;
    if (p.turns > 0 && next.hp[side][idx] > 0) {
      const before = next.hp[side][idx];
      next.hp[side][idx] = Math.max(0, before - p.val);
      logs.push(`☠ ${activeName} subisce ${p.val} danni dal veleno (${before}→${next.hp[side][idx]}).`);
      p.turns -= 1;
    }
    // Shield wears down by 1 turn at start
    const sh = next.shield[side][idx];
    if (sh.turns > 0) sh.turns -= 1;
    if (sh.turns <= 0) sh.val = 0;
  }

  // After poison, check if either active pet just fainted.
  // If so, that side doesn't attack this round.
  const fainted = {
    challenger: next.hp.challenger[next.activeIdx.challenger] <= 0,
    challenged: next.hp.challenged[next.activeIdx.challenged] <= 0,
  };
  if (fainted.challenger) logs.push(`💀 ${teams.challenger[next.activeIdx.challenger].nickname} è KO!`);
  if (fainted.challenged) logs.push(`💀 ${teams.challenged[next.activeIdx.challenged].nickname} è KO!`);

  // 3. Process attacks in SPD order.
  const moveActions = [];
  if (actionA?.kind === "move" && !fainted.challenger) {
    moveActions.push({ side: "challenger", action: actionA });
  }
  if (actionB?.kind === "move" && !fainted.challenged) {
    moveActions.push({ side: "challenged", action: actionB });
  }
  moveActions.sort((x, y) => {
    const sx = teams[x.side][next.activeIdx[x.side]].spd;
    const sy = teams[y.side][next.activeIdx[y.side]].spd;
    if (sx !== sy) return sy - sx;
    return Math.random() < 0.5 ? -1 : 1;
  });

  for (const { side, action } of moveActions) {
    const opp = side === "challenger" ? "challenged" : "challenger";
    const myIdx = next.activeIdx[side];
    const theirIdx = next.activeIdx[opp];
    if (next.hp[side][myIdx] <= 0) continue;
    if (next.hp[opp][theirIdx] <= 0) {
      // Target already KO'd this round — skip
      continue;
    }
    const me = teams[side][myIdx];
    const them = teams[opp][theirIdx];
    const move = PET_MOVES[action.moveId];
    if (!move) {
      logs.push(`${me.icon} ${me.nickname} è confuso e salta il turno.`);
      continue;
    }

    // Consume use
    if (move.maxUses != null) {
      const left = next.moveUses[side][myIdx][move.id] ?? 0;
      if (left <= 0) {
        logs.push(`${me.icon} ${me.nickname} prova ${move.icon} ${move.name} · esaurita!`);
        continue;
      }
      next.moveUses[side][myIdx][move.id] = left - 1;
    }

    // Pure utility move (no damage dice): apply effect on self
    if (!move.damageDice) {
      if (move.effect?.kind === "heal") {
        const before = next.hp[side][myIdx];
        next.hp[side][myIdx] = Math.min(me.maxHp, before + (move.effect.value || 0));
        logs.push(`${me.icon} ${me.nickname} usa ${move.icon} ${move.name} · +${next.hp[side][myIdx] - before} PF.`);
      } else if (move.effect?.kind === "shield") {
        const sh = next.shield[side][myIdx];
        sh.turns = move.effect.turns || 2;
        sh.val = move.effect.value || 0;
        logs.push(`🛡 ${me.nickname} usa ${move.icon} ${move.name} · +${sh.val} CA per ${sh.turns}t.`);
      }
      continue;
    }

    // Attack roll
    const d20 = rollDie(20);
    const total = d20 + me.atkBonus + (move.toHit || 0);
    const crit = d20 === 20;
    const fumble = d20 === 1;
    const toHitTag = (move.toHit || 0) ? ` ${move.toHit > 0 ? "+" : ""}${move.toHit}` : "";

    if (fumble) {
      logs.push(`${me.icon} ${me.nickname} usa ${move.icon} ${move.name} · 🎲 d20=1 → fallimento critico!`);
      continue;
    }
    const hit = crit || total >= them.ac;
    if (!hit) {
      logs.push(`${me.icon} ${me.nickname} usa ${move.icon} ${move.name} · 🎲 d20=${d20}${toHitTag} = ${total} vs CA ${them.ac} · manca!`);
      continue;
    }

    const typeMul = typeMultiplier(move.type, them.type);
    const diceRolled = rollDice(crit ? move.damageDice.num * 2 : move.damageDice.num, move.damageDice.sides);
    const rawDmg = Math.max(1, Math.round((diceRolled + me.profBonus) * typeMul));

    // Apply shield reduction
    const sh = next.shield[opp][theirIdx];
    const blocked = sh.turns > 0 ? Math.min(sh.val, Math.max(0, rawDmg - 1)) : 0;
    const dealt = Math.max(1, rawDmg - blocked);
    next.hp[opp][theirIdx] = Math.max(0, next.hp[opp][theirIdx] - dealt);

    const mulTag = typeMul > 1 ? " 🌟super-efficace" : typeMul < 1 ? " 💤poco efficace" : "";
    const blockedTag = blocked > 0 ? ` (scudo blocca ${blocked})` : "";
    const critTag = crit ? " 🎯CRITICO!" : "";
    const diceLabel = `${diceTag(move.damageDice, crit)}+${me.profBonus}=${diceRolled + me.profBonus}`;
    logs.push(
      `${me.icon} ${me.nickname} usa ${move.icon} ${move.name} · 🎲 d20=${d20}${toHitTag} = ${total} vs CA ${them.ac} · colpisce!${critTag}` +
      ` · danni ${diceLabel}${mulTag} → ${them.nickname} -${dealt} PF (${next.hp[opp][theirIdx] + dealt}→${next.hp[opp][theirIdx]})${blockedTag}.`
    );

    // Post-hit effects
    if (move.effect?.kind === "poison") {
      const ps = next.poison[opp][theirIdx];
      ps.turns = Math.max(ps.turns, move.effect.turns || 2);
      ps.val = Math.max(ps.val, move.effect.value || 0);
      logs.push(`☠ ${them.nickname} è avvelenato/in fiamme (${ps.val}/t · ${ps.turns}t).`);
    } else if (move.effect?.kind === "shield") {
      const mys = next.shield[side][myIdx];
      mys.turns = move.effect.turns || 2;
      mys.val = move.effect.value || 0;
      logs.push(`🛡 ${me.nickname} guadagna ${mys.val} CA per ${mys.turns}t.`);
    } else if (move.effect?.kind === "heal" && move.damageDice) {
      // Life-drain attack — heal the attacker
      const beforeMe = next.hp[side][myIdx];
      next.hp[side][myIdx] = Math.min(me.maxHp, beforeMe + (move.effect.value || 0));
      if (next.hp[side][myIdx] > beforeMe) {
        logs.push(`🩸 ${me.nickname} drena ${next.hp[side][myIdx] - beforeMe} PF dalla ferita.`);
      }
    }

    // Did the hit KO the target?
    if (next.hp[opp][theirIdx] <= 0) {
      logs.push(`💀 ${them.nickname} è KO!`);
    }
  }

  // 4. Check win condition
  const challengerAlive = next.hp.challenger.some(h => h > 0);
  const challengedAlive = next.hp.challenged.some(h => h > 0);
  if (!challengerAlive && !challengedAlive) next.winner = "draw";
  else if (!challengerAlive) next.winner = "challenged";
  else if (!challengedAlive) next.winner = "challenger";

  if (next.winner && next.winner !== "draw") {
    const wPet = next.winner === "challenger"
      ? teams.challenger[next.activeIdx.challenger]
      : teams.challenged[next.activeIdx.challenged];
    const wOwner = next.winner === "challenger" ? battle.challenger.ownerName : battle.challenged.ownerName;
    logs.push(`🏆 ${wOwner} vince con ${wPet.icon} ${wPet.nickname}!`);
  } else if (next.winner === "draw") {
    logs.push("⚖ Pareggio — entrambi i team sono caduti!");
  } else {
    next.round += 1;
    logs.push(`— Round ${next.round} —`);
  }

  // 5. Clear pending actions for the next round and reseed deadlines
  next.pendingActions = { challenger: null, challenged: null };
  if (next.winner) {
    next.actionDeadlines = { challenger: null, challenged: null };
  } else {
    next.actionDeadlines = {
      challenger: nextActionDeadline(),
      challenged: nextActionDeadline(),
    };
  }
  next.log = [...battle.state.log, ...logs];
  return next;
}

/* Deep-ish clone for the battle state (plain JSON-safe values). */
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

/* Helper for the UI: indices of alive pets on a side. */
export function aliveIndices(state, side) {
  const out = [];
  state.hp[side].forEach((h, i) => { if (h > 0) out.push(i); });
  return out;
}

/* Helper: pick the first alive pet that is not the current active. */
export function firstAliveSwitch(state, side) {
  const cur = state.activeIdx[side];
  for (let i = 0; i < state.hp[side].length; i++) {
    if (i !== cur && state.hp[side][i] > 0) return i;
  }
  return -1;
}

/* Type cycles for the UI legend.
   - TYPE_CYCLE: the 4-element ring (each beats the next).
   - LIGHT_DARK_PAIR: separate dual loop, only effective vs each other. */
export const TYPE_CYCLE = ["fire", "earth", "air", "water"];
export const LIGHT_DARK_PAIR = ["light", "dark"];
