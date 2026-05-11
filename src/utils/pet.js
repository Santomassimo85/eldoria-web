/* ============================================================
   PET utilities — points wallet, hatch RNG, level/EXP curve,
   D&D-style battle resolver. Pure functions + a couple of
   Firestore helpers for awarding points & writing pet state.
   ============================================================ */

import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { PET_SPECIES, HATCH_POOLS, SKILL_UNLOCK_LEVELS } from "../data/petSpecies";
import { PET_MOVES, typeMultiplier } from "../data/petMoves";

/* ----------------------------------------------------------------
   POINT SOURCES & DAILY CAPS
   ---------------------------------------------------------------- */

export const PET_POINT_SOURCES = {
  arena_round:      { label: "Round Arena vinto",         amount: 3, dailyCap: null },
  arena_tournament: { label: "Vincitore del torneo",      amount: 25, dailyCap: null },
  arena_libera:     { label: "Sfida Libera conclusa",     amount: 1, dailyCap: 5 },
  market_bid:       { label: "Offerta al Mercato Nero",   amount: 1, dailyCap: 5 },
  summary_read:     { label: "Riassunto letto",           amount: 2, dailyCap: null, oncePerKey: true },
  npc_visit:        { label: "Archivio NPC consultato",   amount: 1, dailyCap: 1 },
  geo_visit:        { label: "Archivio Geomantico letto", amount: 1, dailyCap: 1 },
  daily_login:      { label: "Login del giorno",          amount: 2, dailyCap: 1 },
  pet_battle_win:   { label: "Vittoria al Pet Arena",     amount: 5, dailyCap: null },
};

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/* ----------------------------------------------------------------
   AWARD POINTS — single transactional mutation on the player doc.
   ---------------------------------------------------------------- */

const PET_LEDGER_LIMIT = 30;

export async function awardPetPoints(uid, sourceKey, opts = {}) {
  if (!uid || !sourceKey) return { awarded: 0, reason: "no-args" };
  const def = PET_POINT_SOURCES[sourceKey];
  if (!def) return { awarded: 0, reason: "unknown-source" };
  const { resourceKey = null, amountOverride = null, label: customLabel = null } = opts;
  const amount = Math.max(0, amountOverride ?? def.amount);
  if (amount <= 0) return { awarded: 0, reason: "zero-amount" };

  const ref = doc(db, "characters", uid);
  try {
    const out = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return { awarded: 0, reason: "no-doc" };
      const data = snap.data();
      const today = todayKey();
      const daily = data.petPointsDaily || {};
      const todayMap = { ...(daily[today] || {}) };
      const seen = data.petPointsSeen || {};

      if (def.oncePerKey && resourceKey) {
        const seenList = seen[sourceKey] || [];
        if (seenList.includes(resourceKey)) {
          return { awarded: 0, reason: "already-seen" };
        }
      }

      if (def.dailyCap != null) {
        const used = todayMap[sourceKey] || 0;
        if (used >= def.dailyCap) return { awarded: 0, reason: "daily-cap" };
      }

      const newPoints = (data.petPoints || 0) + amount;
      const ledger = [
        { source: sourceKey, label: customLabel || def.label, amount, ts: new Date().toISOString(), resourceKey: resourceKey || null },
        ...((data.petPointsLedger || []).slice(0, PET_LEDGER_LIMIT - 1)),
      ];

      const patch = {
        petPoints: newPoints,
        petPointsLedger: ledger,
      };

      if (def.dailyCap != null) {
        todayMap[sourceKey] = (todayMap[sourceKey] || 0) + 1;
        patch[`petPointsDaily.${today}`] = todayMap[sourceKey];
        const allDays = Object.keys(daily).sort().filter(k => k !== today);
        if (allDays.length > 6) {
          const stale = allDays.slice(0, allDays.length - 6);
          stale.forEach(d => { patch[`petPointsDaily.${d}`] = null; });
        }
      }

      if (def.oncePerKey && resourceKey) {
        const seenList = seen[sourceKey] || [];
        patch[`petPointsSeen.${sourceKey}`] = [...seenList, resourceKey];
      }

      tx.update(ref, patch);
      return { awarded: amount };
    });
    return out;
  } catch (err) {
    console.warn("[awardPetPoints]", err);
    return { awarded: 0, reason: "tx-failed" };
  }
}

/* ----------------------------------------------------------------
   HATCH — weighted random pick from a rarity pool.
   ---------------------------------------------------------------- */

export function rollHatchSpecies(rarity) {
  const pool = HATCH_POOLS[rarity] || HATCH_POOLS.common;
  const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.key;
  }
  return pool[pool.length - 1].key;
}

export function newPetFromSpecies(speciesKey, nickname = null) {
  const sp = PET_SPECIES[speciesKey];
  if (!sp) return null;
  return {
    id: `pet-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
    speciesKey,
    nickname: nickname || sp.name,
    level: 1,
    exp: 0,
    currentHp: petStatsAtLevel(speciesKey, 1).hp,
    hatchedAt: new Date().toISOString(),
    wins: 0,
    losses: 0,
    restingUntil: null,
  };
}

/* ----------------------------------------------------------------
   LEVEL / EXP / STATS curve
   Level cap is 10. Curve: expForLevel(L) = 5·L² → L10 = 500 EXP.
   ---------------------------------------------------------------- */

export const MAX_PET_LEVEL = 10;

export function expForLevel(level) {
  if (level <= 1) return 0;
  return Math.round(5 * level * level);
}

export function levelFromExp(exp) {
  let lvl = 1;
  while (lvl < MAX_PET_LEVEL && exp >= expForLevel(lvl + 1)) lvl++;
  return lvl;
}

/* Clamp a pet's level to the current cap regardless of stored value
   (handles legacy docs whose `level` field was set before the cap). */
export function effectivePetLevel(pet) {
  if (!pet) return 1;
  const stored = pet.level || levelFromExp(pet.exp || 0);
  return Math.max(1, Math.min(MAX_PET_LEVEL, stored));
}

/* D&D 5e-style proficiency bonus: +2 at L1..4, +3 at 5..8, +4 at 9..12,
   +5 at 13..16, +6 at 17..20. Added to damage rolls. */
export function profBonusFor(level) {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}

/* Returns { hp, ac, atkBonus, spd, profBonus } including item bonusStats.
   bonusStats keys (legacy): hp, atk (→ atkBonus), spd, ac. */
export function petStatsAtLevel(speciesKey, level, bonusStats = null) {
  const sp = PET_SPECIES[speciesKey];
  if (!sp) return { hp: 1, ac: 10, atkBonus: 0, atk: 0, spd: 1, profBonus: 2 };
  const lvl = Math.max(1, level);
  const b = bonusStats || {};
  const baseAc = sp.base.ac ?? 12;
  // HP +2/lvl · atkBonus +1 every 2 lvls · ac +1 every 4 lvls · spd +1 every 3 lvls
  const hp       = sp.base.hp  + (lvl - 1) * 2          + (b.hp  || 0);
  const atkBonus = sp.base.atk + Math.floor((lvl - 1) / 2) + (b.atk || 0);
  const ac       = baseAc      + Math.floor((lvl - 1) / 4) + (b.ac  || 0);
  const spd      = sp.base.spd + Math.floor((lvl - 1) / 3) + (b.spd || 0);
  return {
    hp, ac, atkBonus, spd,
    atk: atkBonus,            // alias for legacy UI
    profBonus: profBonusFor(lvl),
  };
}

export function petStatsForPet(pet) {
  if (!pet) return { hp: 1, ac: 10, atkBonus: 0, atk: 0, spd: 1, profBonus: 2 };
  const lvl = levelFromExp(pet.exp || 0);
  return petStatsAtLevel(pet.speciesKey, lvl, pet.bonusStats);
}

/* ----------------------------------------------------------------
   PASSIVE HP REGEN — heals 1 PF every HEAL_TICK_MS while idle.
   Uses pet.lastHealTick (ISO ts) as the anchor. Pets that pre-date
   this feature (no lastHealTick set) don't auto-heal until their
   next battle / item use sets the field — that avoids retroactive
   full heals on rollout.
   ---------------------------------------------------------------- */

export const HEAL_PF_PER_HOUR = 6;
export const HEAL_TICK_MS = Math.floor(60 * 60 * 1000 / HEAL_PF_PER_HOUR); // 10 min/PF

export function petEffectiveHp(pet) {
  if (!pet) return 0;
  const stats = petStatsForPet(pet);
  const base = pet.currentHp ?? stats.hp;
  if (base >= stats.hp) return stats.hp;
  if (!pet.lastHealTick) return base;
  const elapsed = Date.now() - new Date(pet.lastHealTick).getTime();
  if (elapsed <= 0) return base;
  const ticks = Math.floor(elapsed / HEAL_TICK_MS);
  if (ticks <= 0) return base;
  return Math.min(stats.hp, base + ticks);
}

/* Milliseconds until the next +1 PF tick lands. Returns 0 when
   already at full HP or when no tick anchor exists. */
export function petNextHealTickIn(pet) {
  if (!pet?.lastHealTick) return 0;
  const stats = petStatsForPet(pet);
  if ((pet.currentHp ?? stats.hp) >= stats.hp) return 0;
  if (petEffectiveHp(pet) >= stats.hp) return 0;
  const elapsed = Date.now() - new Date(pet.lastHealTick).getTime();
  return Math.max(0, HEAL_TICK_MS - (elapsed % HEAL_TICK_MS));
}

/* ----------------------------------------------------------------
   APPLY ITEM EFFECT TO A PET
   ---------------------------------------------------------------- */

export function applyItemToPet(pet, itemDef) {
  if (!pet || !itemDef) return { ok: false, message: "Oggetto sconosciuto." };
  const next = { ...pet, bonusStats: { ...(pet.bonusStats || {}) } };
  const eff = itemDef.effect || {};
  const lvl = levelFromExp(next.exp || 0);
  const stats = petStatsAtLevel(next.speciesKey, lvl, next.bonusStats);

  switch (eff.kind) {
    case "heal": {
      // Use effective HP so item bonus stacks on top of pending regen.
      const before = petEffectiveHp(next);
      next.currentHp = Math.min(stats.hp, before + (eff.value || 0));
      next.lastHealTick = new Date().toISOString();
      const restored = next.currentHp - before;
      if (restored <= 0) return { ok: false, message: `${next.nickname} è già al massimo dei PF.` };
      return { ok: true, pet: next, message: `+${restored} PF (${before} → ${next.currentHp})` };
    }
    case "heal_full": {
      const before = petEffectiveHp(next);
      next.currentHp = stats.hp;
      next.restingUntil = null;
      next.lastHealTick = new Date().toISOString();
      const restored = next.currentHp - before;
      return { ok: true, pet: next, message: `Guarito completamente · +${restored} PF · riposo rimosso` };
    }
    case "exp": {
      const lvlBefore = lvl;
      next.exp = (next.exp || 0) + (eff.value || 0);
      next.level = levelFromExp(next.exp);
      const newStats = petStatsAtLevel(next.speciesKey, next.level, next.bonusStats);
      if (next.level > lvlBefore) {
        next.currentHp = newStats.hp;
        return { ok: true, pet: next, message: `+${eff.value} EXP · 🌟 Salito al Lv ${next.level}!` };
      }
      return { ok: true, pet: next, message: `+${eff.value} EXP` };
    }
    case "level_up": {
      if (lvl >= MAX_PET_LEVEL) return { ok: false, message: "Già al livello massimo." };
      const target = Math.min(MAX_PET_LEVEL, lvl + (eff.value || 1));
      next.level = target;
      next.exp = expForLevel(target);
      const newStats = petStatsAtLevel(next.speciesKey, target, next.bonusStats);
      next.currentHp = newStats.hp;
      return { ok: true, pet: next, message: `🌟 Salito al Lv ${target}!` };
    }
    case "wake": {
      if (!next.restingUntil || new Date(next.restingUntil) <= new Date()) {
        return { ok: false, message: `${next.nickname} non è in riposo.` };
      }
      next.restingUntil = null;
      return { ok: true, pet: next, message: `Riposo rimosso · pronto al combattimento` };
    }
    case "stat_perm": {
      const stat = eff.stat;
      const val  = eff.value || 0;
      if (!["hp", "atk", "spd", "ac"].includes(stat)) return { ok: false, message: "Stat non valida." };
      next.bonusStats[stat] = (next.bonusStats[stat] || 0) + val;
      if (stat === "hp") {
        next.currentHp = (next.currentHp ?? stats.hp) + val;
      }
      const labels = { hp: "PF max", atk: "ATK", spd: "SPD", ac: "CA" };
      return { ok: true, pet: next, message: `+${val} ${labels[stat]} permanente!` };
    }
    default:
      return { ok: false, message: "Effetto sconosciuto." };
  }
}

/* ----------------------------------------------------------------
   MOVE LISTING
   ---------------------------------------------------------------- */

/* Returns the array of move objects this pet currently has access to.
   Attacks are always available; skills unlock at SKILL_UNLOCK_LEVELS. */
export function petUnlockedMoves(pet) {
  const sp = PET_SPECIES[pet?.speciesKey];
  if (!sp) return [];
  const lvl = effectivePetLevel(pet);
  const out = [];
  (sp.attacks || []).forEach(id => {
    const m = PET_MOVES[id];
    if (m) out.push(m);
  });
  (sp.skills || []).forEach((id, idx) => {
    const unlock = SKILL_UNLOCK_LEVELS[idx] ?? 1;
    if (lvl >= unlock) {
      const m = PET_MOVES[id];
      if (m) out.push(m);
    }
  });
  return out;
}

/* { id, name, unlockLevel } for the next still-locked skill, or null. */
export function petNextLockedMove(pet) {
  const sp = PET_SPECIES[pet?.speciesKey];
  if (!sp) return null;
  const lvl = effectivePetLevel(pet);
  for (let i = 0; i < (sp.skills || []).length; i++) {
    const unlock = SKILL_UNLOCK_LEVELS[i] ?? 1;
    if (lvl < unlock) {
      const m = PET_MOVES[sp.skills[i]];
      return m ? { ...m, unlockLevel: unlock } : null;
    }
  }
  return null;
}

export function petTotalMoveCount(speciesKey) {
  const sp = PET_SPECIES[speciesKey];
  if (!sp) return 0;
  return (sp.attacks?.length || 0) + (sp.skills?.length || 0);
}

/* ----------------------------------------------------------------
   BATTLE RESOLVER (D&D-style, deterministic given seed)
   - d20 attack roll + atkBonus + move.toHit vs target.ac
   - nat 20 → critical (double damage dice)
   - nat 1  → fumble (auto-miss)
   - damage = (sum(damage dice) + profBonus) × typeMultiplier
   ---------------------------------------------------------------- */

function seededRng(seed) {
  // mulberry32
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollDie(rng, sides) {
  return Math.floor(rng() * sides) + 1;
}

function rollDice(rng, num, sides) {
  const rolls = [];
  for (let i = 0; i < num; i++) rolls.push(rollDie(rng, sides));
  return rolls;
}

function diceTotal(rolls) {
  return rolls.reduce((s, n) => s + n, 0);
}

/* Average expected damage for AI scoring (no RNG). */
function expectedDamage(move, profBonus, typeMul) {
  if (!move?.damageDice) return 0;
  const { num, sides } = move.damageDice;
  const avgDice = num * (sides + 1) / 2;
  const toHitMod = move.toHit || 0;
  // Rough hit chance assumes AC ~ 13: (21 - (13 - atkBonus 6 - toHit)) / 20
  const hitChance = 0.65 + toHitMod * 0.05;
  return (avgDice + profBonus) * typeMul * Math.max(0.1, Math.min(0.95, hitChance));
}

export function resolveBattle({ a, b, seed }) {
  const rng = seededRng(seed);

  const spA = PET_SPECIES[a.pet.speciesKey];
  const spB = PET_SPECIES[b.pet.speciesKey];
  if (!spA || !spB) return { winner: null, logs: ["Specie sconosciuta — combattimento annullato."] };

  const lvlA = a.pet.level || levelFromExp(a.pet.exp || 0);
  const lvlB = b.pet.level || levelFromExp(b.pet.exp || 0);
  const statA = petStatsAtLevel(a.pet.speciesKey, lvlA, a.pet.bonusStats);
  const statB = petStatsAtLevel(b.pet.speciesKey, lvlB, b.pet.bonusStats);

  // Battle starts at currentHp (clamped to max) — wounds carry over until
  // the pet heals (passive regen, items, or rest+full-heal items).
  const startA = Math.max(1, Math.min(statA.hp, a.pet.currentHp ?? statA.hp));
  const startB = Math.max(1, Math.min(statB.hp, b.pet.currentHp ?? statB.hp));

  const state = {
    a: {
      ownerName: a.ownerName, pet: a.pet, type: spA.type,
      name: a.pet.nickname || spA.name, icon: spA.icon, level: lvlA,
      hp: startA, maxHp: statA.hp,
      ac: statA.ac, atkBonus: statA.atkBonus, profBonus: statA.profBonus, spd: statA.spd,
      moveUses: {}, shieldTurns: 0, shieldVal: 0,
      poisonTurns: 0, poisonVal: 0,
    },
    b: {
      ownerName: b.ownerName, pet: b.pet, type: spB.type,
      name: b.pet.nickname || spB.name, icon: spB.icon, level: lvlB,
      hp: startB, maxHp: statB.hp,
      ac: statB.ac, atkBonus: statB.atkBonus, profBonus: statB.profBonus, spd: statB.spd,
      moveUses: {}, shieldTurns: 0, shieldVal: 0,
      poisonTurns: 0, poisonVal: 0,
    },
  };

  const logs = [];
  logs.push(`${state.a.icon} ${state.a.name} (Lv${lvlA}) sfida ${state.b.icon} ${state.b.name} (Lv${lvlB})!`);
  logs.push(`📊 ${state.a.name} · PF ${state.a.hp}/${state.a.maxHp} · CA ${state.a.ac} · +${state.a.atkBonus} al colpo`);
  logs.push(`📊 ${state.b.name} · PF ${state.b.hp}/${state.b.maxHp} · CA ${state.b.ac} · +${state.b.atkBonus} al colpo`);

  const aFirst = state.a.spd > state.b.spd
    || (state.a.spd === state.b.spd && rng() < 0.5);
  const order = aFirst ? ["a", "b"] : ["b", "a"];
  const first = aFirst ? state.a : state.b;
  logs.push(`${first.icon} ${first.name} è più rapido (SPD ${first.spd}) e attacca per primo.`);

  const movesA = petUnlockedMoves(a.pet);
  const movesB = petUnlockedMoves(b.pet);

  function pickMove(side) {
    const movesPool = side === "a" ? movesA : movesB;
    const me = state[side];
    const them = state[side === "a" ? "b" : "a"];

    // Heal if low HP and a heal-skill is available.
    const healMove = movesPool.find(m =>
      m.effect?.kind === "heal" && (me.moveUses[m.id] ?? m.maxUses ?? 99) > 0
    );
    if (healMove && me.hp < me.maxHp * 0.4) return healMove;

    // Score every available move by expected damage (utility ≈ 0).
    let best = null;
    let bestScore = -1;
    for (const m of movesPool) {
      const usesLeft = me.moveUses[m.id] ?? m.maxUses ?? 99;
      if (usesLeft <= 0) continue;
      const typeMul = typeMultiplier(m.type, them.type);
      const score = expectedDamage(m, me.profBonus, typeMul);
      // Tie-break: prefer skills (richer dice) when scores are close
      const adjusted = score + (m.category === "skill" ? 0.01 : 0);
      if (adjusted > bestScore) { bestScore = adjusted; best = m; }
    }
    return best || movesPool[0];
  }

  function rollAttack(rng, attacker, move, target) {
    const d20 = rollDie(rng, 20);
    const total = d20 + attacker.atkBonus + (move.toHit || 0);
    return {
      d20,
      total,
      crit: d20 === 20,
      fumble: d20 === 1,
      hit: d20 !== 1 && (d20 === 20 || total >= target.ac),
    };
  }

  function rollMoveDamage(rng, attacker, move, isCrit, typeMul) {
    if (!move.damageDice) return { rolls: [], total: 0, withMul: 0 };
    const { num, sides } = move.damageDice;
    const rolls = rollDice(rng, isCrit ? num * 2 : num, sides);
    const subtotal = diceTotal(rolls) + attacker.profBonus;
    const withMul = Math.max(1, Math.round(subtotal * typeMul));
    return { rolls, total: subtotal, withMul };
  }

  function applyDamage(target, dmg) {
    let actual = dmg;
    if (target.shieldTurns > 0) {
      actual = Math.max(1, dmg - target.shieldVal);
    }
    target.hp = Math.max(0, target.hp - actual);
    return { actual, blocked: dmg - actual };
  }

  function tickStartOfTurn(side) {
    const me = state[side];
    if (me.poisonTurns > 0 && me.hp > 0) {
      const dmg = me.poisonVal;
      const before = me.hp;
      me.hp = Math.max(0, me.hp - dmg);
      logs.push(`☠ ${me.name} subisce ${dmg} danni dal veleno (${before}→${me.hp}).`);
      me.poisonTurns--;
    }
    if (me.shieldTurns > 0) me.shieldTurns--;
  }

  function diceLabel(dice, isCrit) {
    if (!dice) return "";
    const n = isCrit ? dice.num * 2 : dice.num;
    return `${n}d${dice.sides}`;
  }

  let turn = 0;
  const MAX_TURNS = 60;

  while (turn < MAX_TURNS && state.a.hp > 0 && state.b.hp > 0) {
    for (const side of order) {
      tickStartOfTurn(side);
      if (state.a.hp <= 0 || state.b.hp <= 0) break;

      const me = state[side];
      const them = state[side === "a" ? "b" : "a"];
      const move = pickMove(side);
      if (!move) {
        logs.push(`${me.icon} ${me.name} non ha mosse · salta il turno.`);
        continue;
      }

      const usesLeft = me.moveUses[move.id] ?? move.maxUses ?? null;
      if (usesLeft != null) me.moveUses[move.id] = usesLeft - 1;

      // Pure-utility skill (no damage dice): apply effect on self, no attack roll
      if (!move.damageDice) {
        if (move.effect?.kind === "heal") {
          const before = me.hp;
          me.hp = Math.min(me.maxHp, me.hp + (move.effect.value || 0));
          logs.push(`${me.icon} ${me.name} usa ${move.icon} ${move.name} · recupera ${me.hp - before} PF (${before}→${me.hp}).`);
        } else if (move.effect?.kind === "shield") {
          me.shieldTurns = move.effect.turns || 2;
          me.shieldVal = move.effect.value || 0;
          logs.push(`${me.icon} ${me.name} usa ${move.icon} ${move.name} · +${me.shieldVal} CA per ${me.shieldTurns} turni.`);
        }
        continue;
      }

      // Attack roll
      const atk = rollAttack(rng, me, move, them);
      const atkSign = me.atkBonus >= 0 ? `+${me.atkBonus}` : `${me.atkBonus}`;
      const moveSign = (move.toHit || 0) ? ` ${move.toHit > 0 ? "+" : ""}${move.toHit}` : "";
      const toHitTag = ` ${atkSign}${moveSign}`;

      if (atk.fumble) {
        logs.push(`${me.icon} ${me.name} usa ${move.icon} ${move.name} · 🎲 d20=1 → fallimento critico!`);
        continue;
      }
      if (!atk.hit) {
        logs.push(`${me.icon} ${me.name} usa ${move.icon} ${move.name} · 🎲 d20=${atk.d20}${toHitTag} = ${atk.total} vs CA ${them.ac} · manca!`);
        continue;
      }

      const typeMul = typeMultiplier(move.type, them.type);
      const dmg = rollMoveDamage(rng, me, move, atk.crit, typeMul);
      const { actual, blocked } = applyDamage(them, dmg.withMul);

      let mulTag = "";
      if (typeMul > 1) mulTag = " 🌟super-efficace";
      else if (typeMul < 1) mulTag = " 💤poco efficace";
      const blockedTag = blocked > 0 ? ` (scudo blocca ${blocked})` : "";
      const critTag = atk.crit ? " 🎯CRITICO!" : "";
      const diceTag = `${diceLabel(move.damageDice, atk.crit)}+${me.profBonus}=${dmg.total}`;

      logs.push(
        `${me.icon} ${me.name} usa ${move.icon} ${move.name} · 🎲 d20=${atk.d20}${toHitTag} = ${atk.total} vs CA ${them.ac} · colpisce!${critTag}` +
        ` · danni ${diceTag}${mulTag} → ${them.name} -${actual} PF (${them.hp + actual}→${them.hp})${blockedTag}.`
      );

      // Post-hit effect on damaging skills
      if (move.effect?.kind === "poison") {
        them.poisonTurns = Math.max(them.poisonTurns, move.effect.turns || 2);
        them.poisonVal = Math.max(them.poisonVal, move.effect.value || 0);
        logs.push(`☠ ${them.name} è ora ${move.type === "fire" ? "in fiamme" : "avvelenato"} (${move.effect.value}/turno · ${move.effect.turns || 2}t).`);
      } else if (move.effect?.kind === "shield") {
        me.shieldTurns = move.effect.turns || 2;
        me.shieldVal = move.effect.value || 0;
        logs.push(`🛡 ${me.name} guadagna ${me.shieldVal} CA per ${me.shieldTurns} turni.`);
      } else if (move.effect?.kind === "heal") {
        // life drain — damage move that also heals the attacker
        const before = me.hp;
        me.hp = Math.min(me.maxHp, me.hp + (move.effect.value || 0));
        if (me.hp > before) {
          logs.push(`🩸 ${me.name} drena ${me.hp - before} PF dalla ferita (${before}→${me.hp}).`);
        }
      }

      if (state.a.hp <= 0 || state.b.hp <= 0) break;
    }
    turn++;
  }

  let winner = "draw";
  if (state.a.hp <= 0 && state.b.hp > 0) winner = "b";
  else if (state.b.hp <= 0 && state.a.hp > 0) winner = "a";
  else if (state.a.hp > state.b.hp) winner = "a";
  else if (state.b.hp > state.a.hp) winner = "b";

  if (winner === "draw") {
    logs.push(`⚖ Pareggio dopo ${turn} round!`);
  } else {
    const w = state[winner];
    logs.push(`🏆 ${w.icon} ${w.name} vince lo scontro! (PF rimasti ${w.hp}/${w.maxHp})`);
  }

  return {
    winner,
    logs,
    remaining: { a: state.a.hp, b: state.b.hp, aMaxHp: state.a.maxHp, bMaxHp: state.b.maxHp },
    turns: turn,
    seed,
  };
}

/* EXP awarded to winner — based on loser's level */
export function expFromBattle(loserLevel) {
  return 15 + 5 * loserLevel;
}
