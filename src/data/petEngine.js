/* ============================================================
   PET ENGINE (2026-10-31) — lotta a turni "alla Pokémon", tutta
   pura (niente Firestore): la pagina tiene lo stato in memoria e
   salva solo l'esito.
   - Un pet in campo per parte, fino a 3 in squadra.
   - Ogni turno: mossa o CAMBIO (il cambio consuma il turno: il
     nemico colpisce chi entra). Chi va a 0 PF esce e si sceglie
     il prossimo senza perdere il turno.
   - Ordine: priorità della mossa, poi velocità (pari = a caso).
   - Danno = potenza × ATK/DEF × fattore di livello × tipo ×
     resistenze D&D (metà / doppio / zero) × STAB 1,25 × critico 1,5
     (6%) × caso 0,85–1.
   ============================================================ */

import { PET_DEX, PET_DEX_MOVES, MOVE_UNLOCK, MAX_LEVEL, PET_DEX_ORDER, typeMultiplier, resistMultiplier, damageKindOf } from "./petDex";

const rnd = () => Math.random();
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ── LIVELLI ───────────────────────────────────────────────── */
export const xpToNext = (level) => 30 + level * 20;

// Aggiunge PE a un pet ({level, xp}) e restituisce il nuovo stato + livelli presi.
export function addXp(pet, amount) {
  let level = pet.level || 1, xp = (pet.xp || 0) + Math.max(0, amount), ups = 0;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) { xp -= xpToNext(level); level += 1; ups += 1; }
  if (level >= MAX_LEVEL) xp = 0;
  return { ...pet, level, xp, ups };
}

export function statsAt(speciesKey, level, boost = 1) {
  const b = PET_DEX[speciesKey]?.base || { hp: 40, atk: 10, def: 10, spd: 10 };
  const L = clamp(level || 1, 1, MAX_LEVEL);
  const grow = (v, k) => Math.round(v * (1 + (L - 1) * k) * boost);
  return { hp: grow(b.hp, 0.08), atk: grow(b.atk, 0.06), def: grow(b.def, 0.06), spd: grow(b.spd, 0.05) };
}

export const movesAt = (speciesKey, level) =>
  (PET_DEX[speciesKey]?.moves || []).filter((_, i) => (level || 1) >= MOVE_UNLOCK[i]);

/* ── COMBATTENTI ───────────────────────────────────────────── */
export function makeFighter(pet, boost = 1) {
  const sp = PET_DEX[pet.species];
  const st = statsAt(pet.species, pet.level, boost);
  return {
    id: pet.id, species: pet.species, name: pet.nick || sp?.name || pet.species,
    type: sp?.type || "neutral", level: pet.level || 1,
    maxHp: st.hp, hp: st.hp, atk: st.atk, def: st.def, spd: st.spd,
    stages: { atk: 0, def: 0, spd: 0 },
    status: null,          // { kind: "burn"|"poison", turns }
    stunned: false,
    pp: Object.fromEntries(movesAt(pet.species, pet.level).map((m) => [m, PET_DEX_MOVES[m].pp])),
  };
}

const stageMult = (s) => (s >= 0 ? 1 + 0.25 * s : 1 / (1 + 0.25 * -s));
const eff = (f, stat) => f[stat] * stageMult(f.stages[stat] || 0);

export function newBattle(playerPets, enemyPets, { enemyBoost = 1, aiLevel = 0 } = {}) {
  return {
    sides: {
      p: { team: playerPets.map((p) => makeFighter(p)), active: 0 },
      e: { team: enemyPets.map((p) => makeFighter(p, enemyBoost)), active: 0 },
    },
    aiLevel,
    turn: 1,
    log: [],
    over: null,            // "p" | "e" quando finisce
    needSwitch: null,      // "p" se il giocatore deve mandare un nuovo pet
  };
}

export const activeOf = (b, side) => b.sides[side].team[b.sides[side].active];
const other = (side) => (side === "p" ? "e" : "p");
const alive = (f) => f && f.hp > 0;
export const benchAlive = (b, side) =>
  b.sides[side].team.map((f, i) => ({ f, i })).filter(({ f, i }) => alive(f) && i !== b.sides[side].active);

// Ogni riga porta l'istantanea dei PF: la pagina la mostra passo passo.
const snapOf = (b) => Object.fromEntries(["p", "e"].map((side) => {
  const s = b.sides[side];
  return [side, { active: s.active, hp: s.team.map((f) => f.hp), status: s.team.map((f) => f.status?.kind || (f.stunned ? "stun" : null)) }];
}));
function emit(b, out, ev) { out.push({ ...ev, snap: snapOf(b) }); }

/* ── DANNO ─────────────────────────────────────────────────── */
export function previewDamage(att, def, moveId) {
  const m = PET_DEX_MOVES[moveId];
  if (!m || !m.power) return 0;
  const tm = typeMultiplier(m.type, def.type) * resistMultiplier(def.species, damageKindOf(m));
  const stab = m.type === att.type && m.type !== "neutral" ? 1.25 : 1;
  const lvl = 0.18 + att.level * 0.012;
  return m.power * (eff(att, "atk") / Math.max(1, eff(def, "def"))) * lvl * tm * stab;
}

function applyMove(b, side, moveId, out) {
  const att = activeOf(b, side), foe = activeOf(b, other(side));
  const m = PET_DEX_MOVES[moveId];
  if (!att || !alive(att) || !m) return;
  if (att.stunned) {
    att.stunned = false;
    emit(b, out, { side, kind: "stun", text: `${att.name} è intontito e non riesce a muoversi!` });
    return;
  }
  if (att.pp[moveId] != null) att.pp[moveId] = Math.max(0, att.pp[moveId] - 1);
  emit(b, out, { side, kind: "move", move: moveId, mtype: m.type, fx: m.fx, text: `${att.name} usa ${m.name}!` });
  const e = m.effect || {};
  const targetsFoe = m.power > 0 || e.foe || e.burn || e.poison || e.stun;
  if (targetsFoe && rnd() * 100 >= m.acc) {
    emit(b, out, { side, kind: "miss", text: "…ma manca il bersaglio!" });
    return;
  }
  let dealt = 0;
  const rm = resistMultiplier(foe?.species, damageKindOf(m));
  if (m.power > 0 && alive(foe) && rm === 0) {
    emit(b, out, { side, kind: "immune", target: other(side), text: `${foe.name} è immune: nessun danno!` });
  } else if (m.power > 0 && alive(foe)) {
    const crit = rnd() < 0.06;
    const raw = previewDamage(att, foe, moveId) * (crit ? 1.5 : 1) * (0.85 + rnd() * 0.15);
    dealt = Math.max(1, Math.round(raw));
    foe.hp = Math.max(0, foe.hp - dealt);
    const tm = typeMultiplier(m.type, foe.type);
    const note = [
      tm > 1 ? " È superefficace!" : tm < 1 ? " Non è molto efficace…" : "",
      rm > 1 ? ` ${foe.name} è vulnerabile!` : rm < 1 ? ` ${foe.name} resiste.` : "",
    ].join("");
    emit(b, out, { side, kind: "hit", dmg: dealt, crit, tm: tm * rm, target: other(side),
      text: `${foe.name} perde ${dealt} PF.${crit ? " Colpo critico!" : ""}${note}` });
  }
  const chance = (c) => rnd() < (c ?? 1);
  if (e.drain && dealt) {
    const h = Math.max(1, Math.round(dealt * e.drain));
    att.hp = Math.min(att.maxHp, att.hp + h);
    emit(b, out, { side, kind: "heal", amount: h, text: `${att.name} recupera ${h} PF.` });
  }
  if (e.recoil && dealt) {
    const r = Math.max(1, Math.round(dealt * e.recoil));
    att.hp = Math.max(0, att.hp - r);
    emit(b, out, { side, kind: "recoil", text: `${att.name} si fa male nel colpo (−${r} PF).` });
  }
  if (e.heal) {
    const h = Math.round(att.maxHp * e.heal);
    const before = att.hp;
    att.hp = Math.min(att.maxHp, att.hp + h);
    emit(b, out, { side, kind: "heal", amount: att.hp - before, text: att.hp > before ? `${att.name} recupera ${att.hp - before} PF.` : `${att.name} è già in piena forma.` });
  }
  if (e.self) {
    Object.entries(e.self).forEach(([k, v]) => {
      att.stages[k] = clamp((att.stages[k] || 0) + v, -3, 3);
    });
    emit(b, out, { side, kind: "buff", text: `${att.name} si carica: ${statWords(e.self)}.` });
  }
  if (alive(foe)) {
    if (e.foe && chance(e.chance)) {
      Object.entries(e.foe).forEach(([k, v]) => { foe.stages[k] = clamp((foe.stages[k] || 0) + v, -3, 3); });
      emit(b, out, { side, kind: "debuff", target: other(side), text: `${foe.name}: ${statWords(e.foe)}.` });
    }
    if ((e.burn || e.poison) && !foe.status) {
      const kind = e.burn ? "burn" : "poison";
      // In D&D chi è immune al fuoco/veleno non si scotta e non si avvelena.
      const immuneTo = resistMultiplier(foe.species, kind === "burn" ? "fire" : "poison") === 0;
      if (immuneTo) {
        if (!m.power) emit(b, out, { side, kind: "miss", text: `…ma ${foe.name} è immune.` });
      } else if (chance(e.burn || e.poison)) {
        foe.status = { kind, turns: kind === "burn" ? 3 : 4 };
        emit(b, out, { side, kind: "status", target: other(side), text: `${foe.name} ${kind === "burn" ? "si scotta" : "è avvelenato"}!` });
      } else if (!m.power) emit(b, out, { side, kind: "miss", text: "…ma non ha effetto." });
    }
    if (e.stun && !foe.stunned && chance(e.stun)) {
      foe.stunned = true;
      emit(b, out, { side, kind: "status", target: other(side), text: `${foe.name} è intontito!` });
    }
  }
}

const STAT_IT = { atk: "Attacco", def: "Difesa", spd: "Velocità" };
const statWords = (o) => Object.entries(o).map(([k, v]) => `${STAT_IT[k]} ${v > 0 ? "↑".repeat(v) : "↓".repeat(-v)}`).join(", ");

function endOfTurn(b, out) {
  ["p", "e"].forEach((side) => {
    const f = activeOf(b, side);
    if (!alive(f) || !f.status) return;
    const frac = f.status.kind === "burn" ? 1 / 12 : 1 / 10;
    const d = Math.max(1, Math.round(f.maxHp * frac));
    f.hp = Math.max(0, f.hp - d);
    emit(b, out, { side, kind: "dot", text: `${f.name} ${f.status.kind === "burn" ? "brucia" : "soffre il veleno"} (−${d} PF).` });
    f.status.turns -= 1;
    if (f.status.turns <= 0) { f.status = null; emit(b, out, { side, kind: "info", text: `${f.name} si riprende.` }); }
  });
}

function doSwitch(b, side, idx, out) {
  const s = b.sides[side];
  const prev = activeOf(b, side);
  if (prev) { prev.stages = { atk: 0, def: 0, spd: 0 }; prev.stunned = false; }
  s.active = idx;
  emit(b, out, { side, kind: "switch", text: side === "p" ? `Vai, ${activeOf(b, side).name}!` : `L'avversario manda in campo ${activeOf(b, side).name}!` });
}

// Dopo i colpi: chi è a terra esce; se non resta nessuno la lotta finisce.
function checkFaints(b, out) {
  ["e", "p"].forEach((side) => {
    const f = activeOf(b, side);
    if (f && f.hp <= 0 && !f._fainted) {
      f._fainted = true;
      emit(b, out, { side, kind: "faint", text: `${f.name} è esausto!` });
    }
  });
  const pLeft = b.sides.p.team.some(alive), eLeft = b.sides.e.team.some(alive);
  if (!eLeft) { b.over = "p"; return; }
  if (!pLeft) { b.over = "e"; return; }
  if (!alive(activeOf(b, "e"))) {
    const next = aiPickReplacement(b);
    doSwitch(b, "e", next, out);
  }
  if (!alive(activeOf(b, "p"))) b.needSwitch = "p";
}

/* Un turno completo. action = { kind: "move", move } | { kind: "switch", index }.
   Restituisce una COPIA della lotta con le righe nuove in `events`. */
export function playTurn(battle, action) {
  const b = structuredClone(battle);
  const out = [];
  if (b.over) return { battle: b, events: out };

  // Cambio forzato dopo un pet a terra: non consuma il turno.
  if (b.needSwitch === "p") {
    if (action.kind !== "switch") return { battle: b, events: out };
    doSwitch(b, "p", action.index, out);
    b.needSwitch = null;
    b.log = [...b.log, ...out].slice(-80);
    return { battle: b, events: out };
  }

  const ai = aiChoose(b);
  // `who` = chi ha scelto l'azione: se nel frattempo è stato sostituito
  // (era a terra), la sua mossa non la fa il nuovo arrivato.
  const acts = [{ side: "p", a: action, who: b.sides.p.active }, { side: "e", a: ai, who: b.sides.e.active }];
  // I cambi vanno sempre prima; poi priorità e velocità.
  const prio = ({ side, a }) => {
    if (a.kind === "switch") return [10, 0];
    const f = activeOf(b, side);
    return [PET_DEX_MOVES[a.move]?.prio || 0, eff(f, "spd") + rnd() * 0.01];
  };
  acts.sort((x, y) => {
    const [px, sx] = prio(x), [py, sy] = prio(y);
    return py - px || sy - sx;
  });
  for (const { side, a, who } of acts) {
    if (b.over) break;
    const me = activeOf(b, side);
    if (a.kind === "switch") { doSwitch(b, side, a.index, out); continue; }
    if (b.sides[side].active !== who || !alive(me)) continue;
    applyMove(b, side, a.move, out);
    checkFaints(b, out);
    if (b.needSwitch) break;
  }
  if (!b.over) {
    endOfTurn(b, out);
    checkFaints(b, out);
  }
  b.turn += 1;
  b.log = [...b.log, ...out].slice(-80);
  return { battle: b, events: out };
}

/* ── IA ────────────────────────────────────────────────────────
   aiLevel 0 = mosse a caso · 1 = spesso la più forte · 2 = sempre la
   migliore, si cura quando è bassa · 3 = come 2 e cambia pet quando il
   confronto di tipo è sfavorevole. */
function usableMoves(f) {
  const list = Object.keys(f.pp).filter((m) => f.pp[m] > 0);
  return list.length ? list : ["zampata"];
}

function scoreMove(b, me, foe, m) {
  const mv = PET_DEX_MOVES[m];
  const e = mv.effect || {};
  let s = previewDamage(me, foe, m) * (mv.acc / 100);
  const low = me.hp / me.maxHp;
  if (e.heal) s = low < 0.4 ? 40 : low < 0.65 ? 10 : 0;
  if (e.self) s = Math.max(s, (me.stages.atk < 2 && low > 0.6) ? 12 : 2);
  if (e.foe && !mv.power) s = Math.max(s, foe.hp / foe.maxHp > 0.6 ? 9 : 2);
  if ((e.burn || e.poison) && !mv.power) s = foe.status ? 0 : 14;
  if (e.stun && !mv.power) s = foe.stunned ? 0 : 13;
  if (mv.power && previewDamage(me, foe, m) * 0.85 >= foe.hp) s += 50; // lo finisce
  return s;
}

function bestMove(b, side) {
  const me = activeOf(b, side), foe = activeOf(b, other(side));
  const moves = usableMoves(me);
  return moves.map((m) => ({ m, s: scoreMove(b, me, foe, m) })).sort((x, y) => y.s - x.s)[0].m;
}

function matchup(attType, defType) {
  return typeMultiplier(attType, defType) / typeMultiplier(defType, attType);
}

function aiChoose(b) {
  const me = activeOf(b, "e"), foe = activeOf(b, "p");
  const lvl = b.aiLevel;
  if (lvl >= 3 && alive(me) && me.hp / me.maxHp > 0.25) {
    const bad = matchup(me.type, foe.type) < 1;
    if (bad && rnd() < 0.7) {
      const better = benchAlive(b, "e").find(({ f }) => matchup(f.type, foe.type) > 1);
      if (better) return { kind: "switch", index: better.i };
    }
  }
  if (lvl === 0) return { kind: "move", move: pick(usableMoves(me)) };
  if (lvl === 1 && rnd() < 0.45) return { kind: "move", move: pick(usableMoves(me)) };
  return { kind: "move", move: bestMove(b, "e") };
}

function aiPickReplacement(b) {
  const foe = activeOf(b, "p");
  const bench = benchAlive(b, "e");
  if (b.aiLevel >= 2 && foe) {
    bench.sort((x, y) => matchup(y.f.type, foe.type) - matchup(x.f.type, foe.type));
  }
  return bench[0]?.i ?? b.sides.e.active;
}

/* ── TORRE ─────────────────────────────────────────────────────
   Il piano N sale SEMPRE: livello dei nemici, numero di pet, astuzia
   dell'IA e (ogni 10 piani) un bonus alle statistiche. Il piano è
   deterministico (stesso seme = stessa squadra), così ritentarlo
   non rimescola gli avversari. */
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const RARITY_FLOOR = { starter: 1, common: 1, rare: 8, epic: 18, legendary: 30 };

/* leadType = tipo del primo pet in squadra: nei piani 1–3 l'avversario
   non ha vantaggio di tipo né immunità contro di lui (così nessuno
   parte svantaggiato). */
export function towerFloor(floor, leadType = null) {
  const n = Math.max(1, floor | 0);
  const r = seeded(n * 7919);
  const size = n <= 3 ? 1 : n <= 9 ? 2 : 3;
  const fair = (k) => !leadType || (typeMultiplier(PET_DEX[k].type, leadType) <= 1 && typeMultiplier(leadType, PET_DEX[k].type) >= 1
    && resistMultiplier(k, leadType) >= 1);
  const all = PET_DEX_ORDER.filter((k) => RARITY_FLOOR[PET_DEX[k].rarity] <= n);
  const pool = n <= 3 && all.some(fair) ? all.filter(fair) : all;
  const team = [];
  for (let i = 0; i < size; i++) {
    let k = pool[Math.floor(r() * pool.length)];
    if (team.some((t) => t.species === k) && pool.length > size) k = pool[Math.floor(r() * pool.length)];
    const lead = Math.round(1 + (n - 1) * 0.55);
    const level = clamp(lead + (i === size - 1 && n % 5 === 0 ? 1 : 0) - (size - 1 - i), 1, MAX_LEVEL);
    team.push({ id: `tw${n}_${i}`, species: k, level });
  }
  const aiLevel = n < 4 ? 0 : n < 10 ? 1 : n < 20 ? 2 : 3;
  // i primi piani sono un tutorial: avversari più deboli del normale
  const enemyBoost = n <= 3 ? 0.75 + (n - 1) * 0.05 : 1 + Math.floor((n - 1) / 10) * 0.06;
  const boss = n % 5 === 0;
  return { floor: n, team, aiLevel, enemyBoost, boss };
}

export const AI_LABEL = ["Novellino", "Sveglio", "Astuto", "Stratega"];

// PE a ogni pet della squadra per un piano vinto.
export const towerXp = (floor) => 25 + floor * 10;
// In sconfitta un terzo: chi resta bloccato su un piano cresce lo stesso.
export const towerLossXp = (floor) => Math.floor(towerXp(floor) / 3);
// Punti pet per un piano vinto (solo la prima volta: il piano sale).
export const towerPoints = (floor) => 2 + Math.floor(floor / 5) * 2 + (floor % 5 === 0 ? 5 : 0);
