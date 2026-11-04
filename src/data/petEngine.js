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
     (2026-10-31) dadi della mossa (più dadi salendo di livello) +
     modificatore, × stadi Attacco/Difesa × elemento × resistenze D&D
     (metà / doppio / zero) × stesso elemento 1,25; critico = dadi doppi.
   - Tiri alla D&D (2026-10-31): ogni attacco tira il d20 contro la CA
     (20 naturale = critico, 1 = mancato); le mosse di stato sul nemico
     chiedono un tiro salvezza contro la CD. Avvelenato = svantaggio
     (tira due d20 e tiene il peggiore). Bonus/CA in dndOf (petDex.js).
   - Sfide fra giocatori: battle.pvp = true → l'azione della parte "e"
     la sceglie l'altro giocatore (niente IA), i cambi forzati possono
     servire a tutte e due (needSwitch "p" | "e" | "pe") e i dadi vengono
     da un seme (withSeed), così il turno si risolve uguale ovunque.
   ============================================================ */

import { PET_DEX, PET_DEX_MOVES, MOVE_UNLOCK, MAX_LEVEL, PET_DEX_ORDER, MAX_MOVES, typeMultiplier, resistMultiplier, damageKindOf, gradeOfLevel, learnPool, dndOf, accMod, usesOf, DMG_LABEL, baseOf } from "./petDex";
import { charmFx, PET_BAG } from "./petBag";
import { EVOLUTIONS, evoLevelOf, evoDiceOf } from "./petEvo";

let rnd = Math.random;
/* Dadi a seme (2026-11-04): prima si usava un generatore lineare (LCG) e i
   semi dei turni differivano di 7919 → il primo d20 di ogni turno saliva di
   ~1,4 a turno, sempre uguale: i giocatori lo avevano imparato. Ora il seme
   passa da un hash (mix32) e il generatore è mulberry32: semi vicini danno
   sequenze scorrelate. */
export function mix32(...parts) {
  let h = 0x9e3779b9;
  for (const p of parts) {
    h = Math.imul(h ^ (Number(p) >>> 0), 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  }
  return h >>> 0;
}
function diceRng(seed) {
  let a = mix32(seed) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Esegue fn con dadi a seme fisso (sfide: lo stesso turno dà lo stesso esito su ogni dispositivo).
export function withSeed(seed, fn) {
  const prev = rnd;
  rnd = diceRng(seed);
  try { return fn(); } finally { rnd = prev; }
}
const d20 = () => 1 + Math.floor(rnd() * 20);

/* Dadi del danno al livello del pet: il numero di dadi cresce come i
   trucchetti di D&D (×1,5 al Lv 9, ×2 al 17, ×3 al 33, ×4 al 49). */
export function diceAt(moveId, level) {
  const m = PET_DEX_MOVES[moveId];
  if (!m?.dice) return null;
  const [n, d] = m.dice.split("d").map(Number);
  return { n: Math.max(1, Math.round(n * (0.9375 + 0.0625 * (level || 1)))), d };
}
export const diceText = (moveId, level) => { const dd = diceAt(moveId, level); return dd ? `${dd.n}d${dd.d}` : ""; };
// Usi rimasti: -1 = infiniti (così si salva anche su Firestore).
export const INFINITE = -1;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ── LIVELLI ───────────────────────────────────────────────── */
/* Bilanciamento (2026-11-01): curva più ripida (prima 30 + 20×Lv) e tetto
   di PE al giorno per pet (DAILY_XP_CAP, applicato dal server in petOps.js):
   giocando al massimo ogni giorno l'evoluzione arriva in ~17 giorni
   (comuni, Lv 15), ~25 (rari, 18), ~40 (epici, 22), ~2 mesi (leggendari, 26). */
export const xpToNext = (level) => 40 + level * 25 + level * level;
export const DAILY_XP_CAP = 250;
const romeDayKey = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
// PE già presi oggi dal pet (giorno di Roma).
export const xpTodayOf = (pet, now = Date.now()) => (pet?.xpDay?.d === romeDayKey(now) ? pet.xpDay.n || 0 : 0);
export const xpDayKey = romeDayKey;

// Aggiunge PE a un pet ({level, xp}) e restituisce il nuovo stato + livelli presi.
export function addXp(pet, amount) {
  let level = pet.level || 1, xp = (pet.xp || 0) + Math.max(0, amount), ups = 0;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) { xp -= xpToNext(level); level += 1; ups += 1; }
  if (level >= MAX_LEVEL) xp = 0;
  return { ...pet, level, xp, ups };
}

export function statsAt(speciesKey, level, boost = 1, evo = 0) {
  const b = baseOf(speciesKey, evo);
  const L = clamp(level || 1, 1, MAX_LEVEL);
  const grow = (v, k) => Math.round(v * (1 + (L - 1) * k) * boost);
  // PF ×0,8: coi tiri per colpire (circa 3 su 4 a segno) le lotte durano come prima
  return { hp: Math.round(grow(b.hp, 0.08) * 0.8), atk: grow(b.atk, 0.06), def: grow(b.def, 0.06), spd: grow(b.spd, 0.05) };
}

export const movesAt = (speciesKey, level) =>
  (PET_DEX[speciesKey]?.moves || []).filter((_, i) => (level || 1) >= MOVE_UNLOCK[i]);

/* Gradi (2026-10-31): pet.learned = {grado: mossa} (una per grado
   sbloccato), pet.moveset = le MAX_MOVES mosse portate in lotta.
   Tutto si ricontrolla qui: una mossa che il pet non può avere (grado
   non ancora raggiunto, elemento sbagliato) viene ignorata. */
export function learnedMoves(pet) {
  const g = gradeOfLevel(pet?.level);
  return Object.entries(pet?.learned || {})
    .filter(([grade, m]) => Number(grade) <= g && learnPool(pet.species, Number(grade)).includes(m))
    .sort((a, b) => a[0] - b[0]).map(([, m]) => m);
}
// Innate (meno quelle dimenticate per una pergamena) + gradi + pergamene.
export const knownMoves = (pet) => {
  const forgot = pet?.forgotten || [];
  const tms = (pet?.tms || []).filter((m) => PET_DEX_MOVES[m]);
  return [...new Set([...movesAt(pet.species, pet.level).filter((m) => !forgot.includes(m)), ...learnedMoves(pet), ...tms])];
};
export function battleMoves(pet) {
  const known = knownMoves(pet);
  const chosen = (Array.isArray(pet?.moveset) ? pet.moveset : []).filter((m, i, a) => known.includes(m) && a.indexOf(m) === i);
  if (chosen.length) return chosen.slice(0, MAX_MOVES);
  if (!known.length) return ["zampata"];
  return known.slice(0, MAX_MOVES).length === known.length ? known : [...known.slice(0, MAX_MOVES - 1), known[known.length - 1]];
}

/* Mosse dei nemici della torre: per ogni grado sbloccato una mossa
   del suo repertorio (a seme fisso), poi le MAX_MOVES più forti fra
   innate e imparate, tenendo una mossa di stato se c'era. */
function enemyMoveset(species, level, r) {
  const learned = {};
  for (let g = 1; g <= gradeOfLevel(level); g++) {
    const pool = learnPool(species, g);
    if (pool.length) learned[g] = pool[Math.floor(r() * pool.length)];
  }
  const known = knownMoves({ species, level, learned });
  if (known.length <= MAX_MOVES) return known;
  const pow = (m) => PET_DEX_MOVES[m].power;
  const status = known.find((m) => !pow(m));
  const hits = known.filter((m) => pow(m)).sort((a, b) => pow(b) - pow(a));
  return status ? [...hits.slice(0, MAX_MOVES - 1), status] : hits.slice(0, MAX_MOVES);
}

/* ── EVOLUZIONI (2026-11-01, dati in petEvo.js) ────────────── */
// La forma del pet: evoluzione fatta (e ancora valida per la specie).
export const evoStage = (pet) => ((pet?.evo || 0) >= 1 && EVOLUTIONS[pet?.species] ? 1 : 0);
export const formName = (pet) => (evoStage(pet) ? EVOLUTIONS[pet.species].name : PET_DEX[pet?.species]?.name || pet?.species);
export const canEvolve = (pet) => !evoStage(pet) && !!EVOLUTIONS[pet?.species] && (pet.level || 1) >= evoLevelOf(PET_DEX[pet.species]?.rarity);
// PF in più dell'evoluzione: quelli tirati (pet.evoHp) o la media dei dadi (nemici della torre).
export const evoHpOf = (pet) => {
  if (!evoStage(pet)) return 0;
  if (Number.isFinite(pet.evoHp)) return pet.evoHp;
  const [n, d] = evoDiceOf(PET_DEX[pet.species]?.rarity);
  return Math.round((n * (d + 1)) / 2);
};
// Statistiche da scheda (senza amuleto): PF, ATK, DIF, VEL, CA, colpire.
export function petStats(pet) {
  const evo = evoStage(pet);
  const st = statsAt(pet.species, pet.level, 1, evo);
  const d = dndOf(pet.species, pet.level, evo);
  return { ...st, hp: st.hp + evoHpOf(pet), ac: d.ac, toHit: d.toHit };
}

/* ── COMBATTENTI ───────────────────────────────────────────── */
export function makeFighter(pet, boost = 1) {
  const evo = evoStage(pet);
  const ev = evo ? EVOLUTIONS[pet.species] : null;
  const sp = PET_DEX[pet.species];
  const st = statsAt(pet.species, pet.level, boost, evo);
  const d = dndOf(pet.species, pet.level, evo);
  const cf = charmFx(pet) || {};
  const hp = Math.round((st.hp + Math.round(evoHpOf(pet) * boost)) * (1 + (cf.hp || 0)));
  const skill = ev?.skill || {};
  const passive = skill.passive ? { id: skill.passive, v: skill.v ?? null, st: skill.st || null, el: skill.el || null } : null;
  const pp = Object.fromEntries(battleMoves(pet).map((m) => [m, usesOf(m) ?? INFINITE]));
  if (skill.move && PET_DEX_MOVES[skill.move]) pp[skill.move] = usesOf(skill.move) ?? 1;
  const critBase = passive?.id === "critico" ? passive.v : 20;
  return {
    id: pet.id, species: pet.species, name: pet.nick || formName(pet) || sp?.name, evo, passive, sig: skill.move || null,
    blur: passive?.id === "sfocatura",
    type: sp?.type || "neutral", level: pet.level || 1,
    maxHp: hp, hp, atk: st.atk, def: st.def, spd: st.spd,
    // D&D: CA, bonus per colpire, CD delle mosse di stato, tiro salvezza (+ amuleto)
    atkMod: d.atkMod, dmgBoost: boost,
    ac: d.ac + (cf.ac || 0), toHit: d.toHit + (cf.hit || 0), dcBase: d.dcBase + (cf.hit || 0), save: d.save + (cf.save || 0),
    critOn: Math.min(cf.crit || 20, critBase), critBase, resist: cf.resist || null, berry: cf.berry || 0, spd0: cf.spd || 0,
    charm: pet.charm?.id || null, charmLeft: pet.charm?.left || 0,
    stages: { atk: 0, def: 0, spd: cf.spd || 0, ac: 0 },
    status: null,          // { kind: "burn"|"poison", turns }
    stunned: false,        // salta la prossima azione: "daze" | "freeze" | "shock" (solo l'aspetto)
    sleep: 0,              // azioni che salta ancora dormendo
    wake: 0,               // appena sveglio: niente sonno per questi turni
    pp,
  };
}
const hasP = (f, id) => f?.passive?.id === id;

/* Effetti attivi del combattente per le icone della lotta (2026-11-01).
   Le parti che cambiano in lotta viaggiano nelle righe (snap.fx, una
   stringa "chiave:valore,..." perché Firestore non vuole array annidati):
   stadi (durano finché resta in campo), stato coi turni rimasti,
   intontito (salta il prossimo turno), sfocatura, tenacia/leggendaria/
   bacca già spese. */
export function fxKey(f) {
  if (!f) return "";
  const out = [];
  Object.entries(f.stages || {}).forEach(([k, v]) => { if (v) out.push(`${k}:${v}`); });
  if (f.status) out.push(`${f.status.kind}:${f.status.turns}`);
  if (f.stunned) out.push(`stun:${STUN_CODE[f.stunned] || 1}`);
  if (f.sleep) out.push(`sleep:${f.sleep}`);
  if (f.wake) out.push(`wake:${f.wake}`);
  if (hasP(f, "sfocatura") && f.blur) out.push("blur:1");
  if (f.tenUsed) out.push("tenUsed:1");
  if (f.legUsed) out.push("legUsed:1");
  if (f.berryUsed) out.push("berryUsed:1");
  return out.join(",");
}
// Intontito con la faccia dell'elemento: ghiacciato (gelo), folgorato (fulmine), stordito (il resto).
const STUN_CODE = { daze: 1, freeze: 2, shock: 3 };
const stunOf = (type) => (type === "cold" ? "freeze" : type === "lightning" ? "shock" : "daze");
const STUN_TXT = {
  daze: (n) => `💫 ${n} vede le stelline: salta il prossimo turno!`,
  freeze: (n) => `🧊 ${n} diventa un ghiacciolo: salta il prossimo turno!`,
  shock: (n) => `⚡ ${n} è tutto folgorato, coi peli dritti: salta il prossimo turno!`,
};
const STUN_SKIP = {
  daze: (n) => `💫 ${n} gira su sé stesso, stordito… e il turno passa!`,
  freeze: (n) => `🧊 ${n} è ancora un blocco di ghiaccio: non si muove!`,
  shock: (n) => `⚡ ${n} sfrigola tutto e non riesce a muoversi!`,
};
export const SLEEP_TURNS = 2;   // azioni saltate dormendo
const WAKE_GUARD = 2;           // turni da sveglio prima di potersi riaddormentare
const statusKey = (f) => f.status?.kind || (f.sleep ? "sleep" : f.stunned ? (f.stunned === true ? "daze" : f.stunned) : null);
export const parseFx = (s) => Object.fromEntries(String(s || "").split(",").filter(Boolean).map((x) => { const [k, v] = x.split(":"); return [k, Number(v)]; }));

const stageMult = (s) => (s >= 0 ? 1 + 0.25 * s : 1 / (1 + 0.25 * -s));
const eff = (f, stat) => f[stat] * stageMult(f.stages[stat] || 0);

export function newBattle(playerPets, enemyPets, { enemyBoost = 1, aiLevel = 0, pvp = false, names = null } = {}) {
  return startEffects({
    pvp, names,
    sides: {
      p: { team: playerPets.map((p) => makeFighter(p)), active: 0 },
      e: { team: enemyPets.map((p) => makeFighter(p, enemyBoost)), active: 0 },
    },
    aiLevel,
    turn: 1,
    log: [],
    over: null,            // "p" | "e" quando finisce
    needSwitch: null,      // "p" se il giocatore deve mandare un nuovo pet
  });
}
// Inizio lotta: le passive d'ingresso dei due pet in campo (senza righe: le icone le mostrano).
function startEffects(b) {
  intimidate(b, "p", null);
  intimidate(b, "e", null);
  return b;
}

export const activeOf = (b, side) => b.sides[side].team[b.sides[side].active];
const other = (side) => (side === "p" ? "e" : "p");
const alive = (f) => f && f.hp > 0;
export const benchAlive = (b, side) =>
  b.sides[side].team.map((f, i) => ({ f, i })).filter(({ f, i }) => alive(f) && i !== b.sides[side].active);

export const acOf = (f) => f.ac + (f.stages?.ac || 0);
// Resistenze D&D della specie (e della forma evoluta) + talismano dell'amuleto (metà danni)
// + Assorbimento (i colpi del suo elemento non lo feriscono).
function resistOf(f, kind) {
  if (hasP(f, "assorbi") && f.passive.el === kind) return 0;
  const rm = resistMultiplier(f?.species, kind, f?.evo || 0);
  return f?.resist === kind && rm > 0 ? rm * 0.5 : rm;
}

// Zampata disperata (anti-stallo, 2026-11-02): si può usare quando le mosse hanno
// finito gli usi OPPURE nessun attacco rimasto può ferire l'avversario in campo
// (immune: es. due pet del fulmine immuni al fulmine con solo Scarica infinita →
// prima la lotta non finiva mai). Le mosse di stato non sbloccano lo stallo.
export function desperateOk(f, foe) {
  const left = Object.keys(f?.pp || {}).filter((m) => f.pp[m] !== 0);
  if (!left.length) return true;
  if (!foe || foe.hp <= 0) return false;
  return !left.some((m) => {
    const mv = PET_DEX_MOVES[m];
    return mv?.power > 0 && resistOf(foe, damageKindOf(mv)) > 0;
  });
}

// Ogni riga porta l'istantanea dei PF: la pagina la mostra passo passo.
const snapOf = (b) => Object.fromEntries(["p", "e"].map((side) => {
  const s = b.sides[side];
  return [side, { active: s.active, hp: s.team.map((f) => f.hp), status: s.team.map(statusKey), fx: s.team.map(fxKey) }];
}));
function emit(b, out, ev) { out.push({ ...ev, snap: snapOf(b) }); }

/* ── DANNO ─────────────────────────────────────────────────── */
export function previewDamage(att, def, moveId) {
  const m = PET_DEX_MOVES[moveId];
  if (!m || !m.power) return 0;
  const dd = diceAt(moveId, att.level);
  const avg = Math.max(1, (dd.n * (dd.d + 1)) / 2 + (att.atkMod || 0));
  return avg * damageMult(att, def, m);
}

// Moltiplicatori del danno: stadi di Attacco/Difesa, elemento, resistenze, stesso elemento ×1,25.
function damageMult(att, def, m) {
  const tm = typeMultiplier(m.type, def.type) * resistOf(def, damageKindOf(m));
  const stab = m.type === att.type && m.type !== "neutral" ? (hasP(att, "elemento") ? 1.5 : 1.25) : 1;
  const rage = hasP(att, "furia") && att.hp > 0 && att.hp <= att.maxHp / 3 ? 1 + att.passive.v : 1;
  return (stageMult(att.stages.atk || 0) / stageMult(def.stages.def || 0)) * tm * stab * rage * (att.dmgBoost || 1);
}

// Probabilità che la mossa vada a segno (tiro per colpire o salvezza fallita).
export function hitChance(att, def, moveId) {
  const m = PET_DEX_MOVES[moveId];
  if (!m || !def) return 1;
  const e = m.effect || {};
  if (m.power > 0) {
    const need = acOf(def) - (att.toHit + accMod(m.acc));
    const p = clamp((21 - need) / 20, 0.05, 0.95);
    return att.status?.kind === "poison" || (hasP(def, "sfocatura") && def.blur) ? p * p : p;
  }
  if (e.foe || e.burn || e.poison || e.stun || e.sleep) return clamp((att.dcBase + accMod(m.acc) - def.save - 1) / 20, 0.05, 0.95);
  return 1;
}

const sign = (n) => (n >= 0 ? `+ ${n}` : `− ${-n}`);
function rollText(r) {
  if (!r) return "";
  if (r.kind === "atk") {
    const dice = r.dis ? `${r.d} (svantaggio: ${r.d} e ${r.d2})` : `${r.d}`;
    return ` 🎲 ${dice} ${sign(r.mod)} = ${r.total} contro CA ${r.vs}${r.d === 20 ? " · 20 naturale!" : ""}`;
  }
  return ` ${r.who} tira salvezza: 🎲 ${r.d} ${sign(r.mod)} = ${r.total} contro CD ${r.vs}`;
}

// Bacca Curativa: sotto metà PF la mangia (una volta per lotta).
function berryCheck(b, side, out) {
  const f = activeOf(b, side);
  if (!f || !alive(f) || !f.berry || f.berryUsed || f.hp >= f.maxHp / 2) return;
  f.berryUsed = true;
  const h = Math.round(f.maxHp * f.berry);
  f.hp = Math.min(f.maxHp, f.hp + h);
  emit(b, out, { side, kind: "heal", amount: h, text: `${f.name} mangia la Bacca Curativa: +${h} PF!` });
}

/* Oggetto dato in lotta (2026-11-01) al pet `idx` della squadra: consuma il turno.
   Da lotta: cura, antidoto, elisir, rianima. Amuleto: vale subito (CA, colpire,
   PF, velocità, TS, critico, resistenza, bacca) e il pet se lo tiene. */
export function giveItemInBattle(b, side, itemId, idx, out) {
  const it = PET_BAG[itemId];
  const f = b.sides[side].team[idx];
  if (!it || !f) return;
  const who = b.names ? `${b.names[side]} dà` : side === "p" ? "Dai" : "L'avversario dà";
  const pre = `${who} ${it.icon} ${it.name} a ${f.name}`;
  const u = it.use || {};
  if (u.revive) {
    if (f.hp > 0) return;
    f.hp = Math.max(1, Math.round(f.maxHp * u.revive));
    f._fainted = false; f.status = null; f.stunned = false; f.sleep = 0;
    emit(b, out, { side, kind: "heal", amount: f.hp, item: itemId, text: `${pre}: torna in piedi con ${f.hp} PF!` });
    return;
  }
  if (f.hp <= 0) return;
  if (u.heal) {
    const h = Math.min(f.maxHp - f.hp, Math.round(f.maxHp * u.heal));
    f.hp += h;
    emit(b, out, { side, kind: "heal", amount: h, item: itemId, text: `${pre}: +${h} PF.` });
  } else if (u.cure) {
    const was = f.sleep;
    f.status = null; f.stunned = false; f.sleep = 0;
    if (was) f.wake = WAKE_GUARD;
    emit(b, out, { side, kind: "info", item: itemId, text: `${pre}: niente più veleno, scottature, stelline${was ? " e via il sonno: si sveglia di colpo" : ""}!` });
  } else if (u.uses) {
    Object.keys(f.pp).forEach((m) => { if (f.pp[m] !== INFINITE) f.pp[m] = Math.min(usesOf(m) || 0, f.pp[m] + u.uses); });
    emit(b, out, { side, kind: "info", item: itemId, text: `${pre}: +${u.uses} usi alle sue mosse.` });
  } else if (it.kind === "charm") {
    // un amuleto solo: quello che aveva si toglie (e si perde, come fuori dalla lotta)
    const old = f.charm && PET_BAG[f.charm];
    const of = old?.fx || {};
    if (old) {
      if (of.hp) { const sub = Math.round((f.maxHp / (1 + of.hp)) * of.hp); f.maxHp -= sub; f.hp = Math.min(f.hp, f.maxHp); }
      f.ac -= of.ac || 0; f.toHit -= of.hit || 0; f.dcBase -= of.hit || 0; f.save -= of.save || 0;
      if (of.crit) f.critOn = f.critBase || 20;
      if (of.resist) f.resist = null;
      if (of.berry) f.berry = 0;
      if (of.spd) { f.stages.spd = Math.max(0, (f.stages.spd || 0) - of.spd); f.spd0 = 0; }
    }
    const cf = it.fx || {};
    if (cf.hp) { const add = Math.round(f.maxHp * cf.hp); f.maxHp += add; f.hp += add; }
    f.ac += cf.ac || 0; f.toHit += cf.hit || 0; f.dcBase += cf.hit || 0; f.save += cf.save || 0;
    if (cf.crit) f.critOn = Math.min(cf.crit, f.critBase || 20);
    if (cf.resist) f.resist = cf.resist;
    if (cf.berry) f.berry = cf.berry;
    if (cf.spd) { f.spd0 = cf.spd; f.stages.spd = Math.max(f.stages.spd || 0, cf.spd); }
    f.charm = itemId;
    f.charmLeft = it.fights || 0;
    emit(b, out, { side, kind: "info", item: itemId, text: `${pre}${old ? ` (al posto di ${old.icon} ${old.name})` : ""}: ${it.desc}` });
  }
}

function applyMove(b, side, moveId, out) {
  const att = activeOf(b, side), foe = activeOf(b, other(side));
  const m = PET_DEX_MOVES[moveId];
  if (!att || !alive(att) || !m) return;
  if (att.sleep > 0) {
    att.sleep -= 1;
    att.stunned = false; // chi dorme non è anche stordito
    if (att.sleep > 0) {
      emit(b, out, { side, kind: "sleep", text: `💤 ${att.name} dorme della grossa… zzz (ancora ${att.sleep} turn${att.sleep === 1 ? "o" : "i"}).` });
    } else {
      att.wake = WAKE_GUARD;
      emit(b, out, { side, kind: "sleep", text: `💤 ${att.name} russa per l'ultima volta… e si sveglia con uno sbadiglio! ☀️` });
    }
    return;
  }
  if (att.stunned) {
    const k = att.stunned === true ? "daze" : att.stunned;
    att.stunned = false;
    emit(b, out, { side, kind: "stun", text: STUN_SKIP[k](att.name) });
    return;
  }
  if (att.pp[moveId] > 0) att.pp[moveId] -= 1;
  const e = m.effect || {};
  const targetsFoe = alive(foe) && (m.power > 0 || e.foe || e.burn || e.poison || e.stun || e.sleep);
  let roll = null;
  if (targetsFoe && m.power > 0) {
    // tiro per colpire: d20 + bonus contro la CA (avvelenato = svantaggio)
    const dis = att.status?.kind === "poison" || (hasP(foe, "sfocatura") && foe.blur);
    const r1 = d20(), r2 = dis ? d20() : r1;
    const d = Math.min(r1, r2);
    const mod = att.toHit + accMod(m.acc);
    const vs = acOf(foe);
    const ok = d === 20 || (d !== 1 && d + mod >= vs);
    roll = { kind: "atk", d, d2: dis ? Math.max(r1, r2) : null, dis, mod, total: d + mod, vs, ok, crit: ok && d >= (att.critOn || 20) };
  } else if (targetsFoe) {
    // mossa di stato: il bersaglio tira salvezza contro la CD di chi la lancia
    const d = d20();
    const vs = att.dcBase + accMod(m.acc);
    let saved = d === 20 || (d !== 1 && d + foe.save >= vs);
    let legendary = false;
    if (!saved && hasP(foe, "leggendaria") && !foe.legUsed) { saved = true; legendary = true; foe.legUsed = true; }
    roll = { kind: "save", d, mod: foe.save, total: d + foe.save, vs, ok: !saved, who: foe.name, legendary };
  }
  emit(b, out, { side, kind: "move", move: moveId, mtype: m.type, fx: m.fx, roll, att: att.name, mname: m.name, text: `${att.name} usa ${m.name}!${rollText(roll)}` });
  if (roll && !roll.ok) {
    const txt = roll.legendary ? `…👑 Resistenza Leggendaria: ${foe.name} supera il tiro lo stesso!` : roll.kind === "save" ? `…${foe.name} resiste all'effetto!` : roll.d === 1 ? "…1 naturale: mancato!" : "…ma manca il bersaglio!";
    emit(b, out, { side, kind: "miss", text: txt });
    return;
  }
  let dealt = 0, dmgTxt = "";
  const rm = resistOf(foe, damageKindOf(m));
  if (m.power > 0 && alive(foe) && rm === 0 && hasP(foe, "assorbi") && foe.passive.el === damageKindOf(m)) {
    const h = Math.min(foe.maxHp - foe.hp, Math.round(foe.maxHp * 0.25));
    foe.hp += h;
    emit(b, out, { side: other(side), kind: "heal", amount: h, text: h ? `🌀 ${foe.name} assorbe il colpo: +${h} PF!` : `🌀 ${foe.name} assorbe il colpo: nessun danno.` });
  } else if (m.power > 0 && alive(foe) && rm === 0) {
    emit(b, out, { side, kind: "immune", target: other(side), text: `${foe.name} è immune: nessun danno!` });
  } else if (m.power > 0 && alive(foe)) {
    const crit = !!roll?.crit;
    // dadi del danno (col critico si tirano il doppio dei dadi, come in D&D) + modificatore
    const dd = diceAt(moveId, att.level);
    const nd = dd.n * (crit ? 2 : 1);
    let sum = 0;
    for (let i = 0; i < nd; i++) sum += 1 + Math.floor(rnd() * dd.d);
    const base = Math.max(1, sum + (att.atkMod || 0));
    const mult = damageMult(att, foe, m);
    dealt = Math.max(1, Math.round(base * mult));
    const multTxt = Math.abs(mult - 1) > 0.01 ? ` ×${String(Math.round(mult * 100) / 100).replace(".", ",")}` : "";
    let armorTxt = "";
    if (hasP(foe, "corazza")) { const nd2 = Math.max(1, dealt - foe.passive.v); armorTxt = nd2 < dealt ? `, 🛡️ corazza −${dealt - nd2}` : ""; dealt = nd2; }
    dmgTxt = ` (🎲 ${nd}d${dd.d} ${sign(att.atkMod || 0)} = ${base}${multTxt}, ${DMG_LABEL[damageKindOf(m)].toLowerCase()}${armorTxt})`;
    let held = false;
    if (hasP(foe, "tenacia") && !foe.tenUsed && foe.hp > 1 && dealt >= foe.hp) { dealt = foe.hp - 1; foe.tenUsed = true; held = true; }
    foe.hp = Math.max(0, foe.hp - dealt);
    if (hasP(foe, "sfocatura")) foe.blur = false;
    const tm = typeMultiplier(m.type, foe.type);
    const note = [
      tm > 1 ? " È superefficace!" : tm < 1 ? " Non è molto efficace…" : "",
      rm > 1 ? ` ${foe.name} è vulnerabile!` : rm < 1 ? ` ${foe.name} resiste.` : "",
    ].join("");
    emit(b, out, { side, kind: "hit", dmg: dealt, crit, tm: tm * rm, target: other(side),
      text: `${foe.name} perde ${dealt} PF${dmgTxt}.${crit ? " Colpo critico: dadi doppi!" : ""}${note}` });
    if (held) emit(b, out, { side: other(side), kind: "info", text: `🪨 ${foe.name} stringe i denti e resta in piedi a 1 PF!` });
    if (hasP(foe, "spine") && alive(att)) {
      const r = Math.max(1, Math.round(dealt * foe.passive.v));
      att.hp = Math.max(0, att.hp - r);
      emit(b, out, { side: other(side), kind: "info", text: `🌵 ${att.name} si fa male su ${foe.name} (−${r} PF).` });
    }
    if (hasP(att, "succhiavita") && alive(att) && att.hp < att.maxHp) {
      const h = Math.min(att.maxHp - att.hp, Math.max(1, Math.round(dealt * att.passive.v)));
      att.hp += h;
      emit(b, out, { side, kind: "heal", amount: h, text: `🩸 ${att.name} si nutre del colpo: +${h} PF.` });
    }
    if (hasP(att, "tocco") && alive(foe) && rnd() < att.passive.v) touchEffect(b, side, att, foe, out);
    berryCheck(b, other(side), out);
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
    berryCheck(b, side, out);
  }
  if (e.heal) {
    const h = Math.round(att.maxHp * e.heal);
    const before = att.hp;
    att.hp = Math.min(att.maxHp, att.hp + h);
    emit(b, out, { side, kind: "heal", amount: att.hp - before, text: att.hp > before ? `${att.name} recupera ${att.hp - before} PF.` : `${att.name} è già in piena forma.` });
  }
  if (e.cure && (att.status || att.stunned)) {
    att.status = null; att.stunned = false;
    emit(b, out, { side, kind: "info", text: `✨ ${att.name} si scrolla di dosso veleni, scottature e stelline!` });
  }
  if (e.self) {
    Object.entries(e.self).forEach(([k, v]) => {
      att.stages[k] = clamp((att.stages[k] || 0) + v, k === "ac" ? -4 : -3, k === "ac" ? 4 : 3);
    });
    emit(b, out, { side, kind: "buff", text: `${att.name} si carica: ${statWords(e.self)}.` });
  }
  if (alive(foe)) {
    if (e.foe && chance(e.chance)) {
      Object.entries(e.foe).forEach(([k, v]) => { foe.stages[k] = clamp((foe.stages[k] || 0) + v, k === "ac" ? -4 : -3, k === "ac" ? 4 : 3); });
      emit(b, out, { side, kind: "debuff", target: other(side), text: `${foe.name}: ${statWords(e.foe)}.` });
    }
    if ((e.burn || e.poison) && !foe.status) {
      const kind = e.burn ? "burn" : "poison";
      // In D&D chi è immune al fuoco/veleno non si scotta e non si avvelena.
      const immuneTo = statusImmune(foe, kind);
      if (immuneTo) {
        if (!m.power) emit(b, out, { side, kind: "miss", text: `…ma ${foe.name} è immune.` });
      } else if (chance(e.burn || e.poison)) {
        setStatus(b, side, foe, kind, out);
      } else if (!m.power) emit(b, out, { side, kind: "miss", text: "…ma non ha effetto." });
    }
    if (e.sleep) {
      if (foe.sleep) { if (!m.power) emit(b, out, { side, kind: "miss", text: `…ma ${foe.name} dorme già come un sasso.` }); }
      else if (foe.wake) { if (!m.power) emit(b, out, { side, kind: "miss", text: `…ma ${foe.name} si è appena svegliato ed è bello arzillo: niente sonno! ☕` }); }
      else if (hasP(foe, "purezza")) { if (!m.power) emit(b, out, { side, kind: "miss", text: `…ma ${foe.name} è immune.` }); }
      else if (chance(e.sleep)) {
        foe.sleep = SLEEP_TURNS; foe.stunned = false;
        emit(b, out, { side, kind: "status", st: "sleep", target: other(side), text: `💤 ${foe.name} sbadiglia, si acciambella e si addormenta! Dormirà per ${SLEEP_TURNS} turni.` });
      }
    }
    if (e.stun && !foe.stunned && !foe.sleep && !hasP(foe, "purezza") && chance(e.stun)) stunFoe(b, side, foe, stunOf(m.type), out);
  }
}

function setStatus(b, side, foe, kind, out) {
  foe.status = { kind, turns: kind === "burn" ? 3 : 4 };
  const text = kind === "burn"
    ? `🔥 ${foe.name} si scotta! Ahi ahi, brucerà per 3 turni.`
    : `☠️ ${foe.name} è avvelenato: diventa verdino, tira con svantaggio e soffre per 4 turni.`;
  emit(b, out, { side, kind: "status", st: kind, target: other(side), text });
}
function stunFoe(b, side, foe, k, out) {
  foe.stunned = k;
  emit(b, out, { side, kind: "status", st: k, target: other(side), text: STUN_TXT[k](foe.name) });
}
// Immune a scottature/veleno: immunità D&D al fuoco/veleno o Corpo Puro.
function statusImmune(f, kind) {
  return hasP(f, "purezza") || resistMultiplier(f.species, kind === "burn" ? "fire" : "poison", f.evo || 0) === 0;
}
// Tocco (passiva): il colpo scotta, avvelena, intontisce o toglie CA.
function touchEffect(b, side, att, foe, out) {
  const st = att.passive.st;
  if (st === "ac") {
    foe.stages.ac = clamp((foe.stages.ac || 0) - 1, -4, 4);
    emit(b, out, { side, kind: "debuff", target: other(side), text: `☣️ ${foe.name}: CA −1.` });
  } else if (st === "stun") {
    if (foe.stunned || foe.sleep || hasP(foe, "purezza")) return;
    stunFoe(b, side, foe, stunOf(att.type), out);
  } else if (!foe.status && !statusImmune(foe, st)) {
    setStatus(b, side, foe, st, out);
  }
}

const STAT_IT = { atk: "Attacco", def: "Difesa", spd: "Velocità" };
const statWords = (o) => Object.entries(o).map(([k, v]) => (k === "ac" ? `CA ${v > 0 ? "+" : "−"}${Math.abs(v)}` : `${STAT_IT[k]} ${v > 0 ? "↑".repeat(v) : "↓".repeat(-v)}`)).join(", ");

function endOfTurn(b, out) {
  ["p", "e"].forEach((side) => {
    const f = activeOf(b, side);
    if (!alive(f)) return;
    if (hasP(f, "sfocatura")) f.blur = true;
    if (f.wake) f.wake -= 1;
    if (hasP(f, "rigenera") && f.hp < f.maxHp) {
      const h = Math.min(f.maxHp - f.hp, Math.max(1, Math.round(f.maxHp * f.passive.v)));
      f.hp += h;
      emit(b, out, { side, kind: "heal", amount: h, text: `🌿 ${f.name} si rigenera: +${h} PF.` });
    }
    if (!f.status) return;
    const frac = f.status.kind === "burn" ? 1 / 12 : 1 / 14; // il veleno dà anche svantaggio
    const d = Math.max(1, Math.round(f.maxHp * frac));
    f.hp = Math.max(0, f.hp - d);
    f.status.turns -= 1;
    const left = f.status.turns > 0 ? ` · ancora ${f.status.turns}` : "";
    emit(b, out, { side, kind: "dot", st: f.status.kind, text: f.status.kind === "burn"
      ? `🔥 ${f.name} saltella sul posto: scotta! (−${d} PF${left})`
      : `☠️ ${f.name} ha il mal di pancia per il veleno (−${d} PF${left})` });
    if (f.status.turns <= 0) {
      const was = f.status.kind;
      f.status = null;
      emit(b, out, { side, kind: "info", text: was === "burn" ? `🧯 Le fiamme si spengono: ${f.name} tira un sospiro di sollievo.` : `🌿 Il veleno passa: ${f.name} torna del suo colore.` });
    }
    berryCheck(b, side, out);
  });
}

function doSwitch(b, side, idx, out) {
  const s = b.sides[side];
  const prev = activeOf(b, side);
  if (prev) { prev.stages = { atk: 0, def: 0, spd: prev.spd0 || 0, ac: 0 }; prev.stunned = false; }
  s.active = idx;
  const name = activeOf(b, side).name;
  emit(b, out, { side, kind: "switch", text: b.names ? `${b.names[side]} manda in campo ${name}!` : side === "p" ? `Vai, ${name}!` : `L'avversario manda in campo ${name}!` });
  intimidate(b, side, out);
}
// Presenza Terrificante: chi entra in campo toglie un grado di Attacco all'avversario.
function intimidate(b, side, out) {
  const f = activeOf(b, side), foe = activeOf(b, other(side));
  if (!hasP(f, "intimidire") || !alive(f) || !alive(foe)) return;
  foe.stages.atk = clamp((foe.stages.atk || 0) - 1, -3, 3);
  if (out) emit(b, out, { side, kind: "debuff", target: other(side), text: `😠 ${foe.name} si spaventa davanti a ${f.name}: Attacco ↓.` });
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
  let need = "";
  if (!alive(activeOf(b, "p"))) need += "p";
  if (!alive(activeOf(b, "e"))) {
    if (b.pvp) need += "e";              // nelle sfide sceglie l'altro giocatore
    else doSwitch(b, "e", aiPickReplacement(b), out);
  }
  b.needSwitch = need || null;
}

/* Un turno completo. action = { kind: "move", move } | { kind: "switch", index }.
   actionE = azione della parte "e" nelle sfide (altrimenti la sceglie l'IA).
   Restituisce una COPIA della lotta con le righe nuove in `events`. */
export function playTurn(battle, action, actionE = null) {
  const b = structuredClone(battle);
  const out = [];
  if (b.over) return { battle: b, events: out };
  b.log = b.log || [];

  // Cambio forzato dopo un pet a terra: non consuma il turno.
  if (b.needSwitch) {
    const pick = { p: action, e: actionE };
    const sides = b.needSwitch.split("");
    if (sides.some((sd) => pick[sd]?.kind !== "switch")) return { battle: b, events: out };
    sides.forEach((sd) => doSwitch(b, sd, pick[sd].index, out));
    b.needSwitch = null;
    b.log = [...b.log, ...out].slice(-80);
    return { battle: b, events: out };
  }

  const ai = b.pvp ? actionE : aiChoose(b);
  // `who` = chi ha scelto l'azione: se nel frattempo è stato sostituito
  // (era a terra), la sua mossa non la fa il nuovo arrivato.
  const acts = [{ side: "p", a: action, who: b.sides.p.active }, { side: "e", a: ai, who: b.sides.e.active }];
  // I cambi vanno sempre prima; poi priorità e velocità.
  const prio = ({ side, a }) => {
    if (a.kind === "switch" || a.kind === "item") return [10, 0];
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
    if (a.kind === "item") { giveItemInBattle(b, side, a.item, a.index, out); continue; }
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
function usableMoves(f, foe) {
  const list = Object.keys(f.pp).filter((m) => f.pp[m] !== 0);
  if (!list.length) return ["zampata"];
  // bloccato da un'immunità: la Zampata disperata entra fra le scelte (e vince il punteggio)
  return desperateOk(f, foe) && !list.includes("zampata") ? ["zampata", ...list] : list;
}

function scoreMove(b, me, foe, m) {
  const mv = PET_DEX_MOVES[m];
  const e = mv.effect || {};
  const hc = hitChance(me, foe, m);
  let s = previewDamage(me, foe, m) * hc;
  const low = me.hp / me.maxHp;
  if (e.heal) s = low < 0.4 ? 40 : low < 0.65 ? 10 : 0;
  if (e.self) s = Math.max(s, ((e.self.ac ? (me.stages.ac || 0) < 2 : me.stages.atk < 2) && low > 0.6) ? 12 : 2);
  if (e.foe && !mv.power) s = Math.max(s, foe.hp / foe.maxHp > 0.6 ? 9 * hc : 2);
  if ((e.burn || e.poison) && !mv.power) s = foe.status ? 0 : 16 * hc;
  if (e.stun && !mv.power) s = foe.stunned ? 0 : 15 * hc;
  if (e.sleep && !mv.power) s = foe.sleep || foe.wake || foe.stunned ? 0 : 24 * hc;
  if (mv.power && previewDamage(me, foe, m) * 0.85 >= foe.hp) s += 50; // lo finisce
  return s;
}

function bestMove(b, side) {
  const me = activeOf(b, side), foe = activeOf(b, other(side));
  const moves = usableMoves(me, foe);
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
  const foeNow = foe;
  if (desperateOk(me, foeNow) && !Object.prototype.hasOwnProperty.call(me.pp, "zampata")) return { kind: "move", move: "zampata" };
  if (lvl === 0) return { kind: "move", move: pick(usableMoves(me, foeNow)) };
  if (lvl === 1 && rnd() < 0.45) return { kind: "move", move: pick(usableMoves(me, foeNow)) };
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
// Ordine fisso (mescolato una volta per tutte) da cui la torre pesca: il piano
// N prende i pet dalla posizione N×3, così due piani di fila non si ripetono e
// ogni piano è sempre uguale per tutti.
function rotation(week = "") {
  let h = 424242;
  for (const ch of String(week)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  const r = seeded(h);
  const arr = [...PET_DEX_ORDER];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
const ROTATIONS = {};
const weekHash = (week) => { let h = 0; for (const ch of String(week || "")) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0; return h; };

/* Settimana della Torre (2026-11-01): cambia alle 23:59 di ogni domenica
   (ora di Roma). Ogni settimana la torre si azzera per tutti e i mostri dei
   piani cambiano (rotazione e mosse dipendono dalla settimana). */
export function towerWeek(now = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(new Date(now + 60000)).map((x) => [x.type, x.value]));
  const back = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - back));
  return d.toISOString().slice(0, 10);
}
// Quando cambia la torre (prossima domenica 23:59 di Roma), in ms da adesso: per il conto alla rovescia.
export function towerWeekLeftMs(now = Date.now()) {
  const cur = towerWeek(now);
  let lo = now, hi = now + 8 * 864e5;
  while (hi - lo > 30000) { const mid = (lo + hi) / 2; if (towerWeek(mid) === cur) lo = mid; else hi = mid; }
  return hi - now;
}

/* Torre INFINITA e uguale per tutti (2026-10-31): il piano N dipende solo
   da N. Livello, numero di pet, astuzia e bonus salgono per sempre. */
export function towerFloor(floor, week = towerWeek()) {
  const n = Math.max(1, floor | 0);
  const size = n <= 3 ? 1 : n <= 9 ? 2 : 3;
  const ROTATION = (ROTATIONS[week] ||= rotation(week));
  const wh = weekHash(week);
  const pool = ROTATION.filter((k) => RARITY_FLOOR[PET_DEX[k].rarity] <= n);
  const team = [];
  for (let i = 0; i < size; i++) {
    const k = pool[(n * 3 + i) % pool.length];
    const lead = Math.round(1 + (n - 1) * 0.55);
    const level = clamp(lead + (i === size - 1 && n % 5 === 0 ? 1 : 0) - (size - 1 - i), 1, MAX_LEVEL);
    // seme a parte: le mosse non cambiano le squadre dei piani
    const evo = EVOLUTIONS[k] && level >= evoLevelOf(PET_DEX[k].rarity) ? 1 : 0;
    team.push({ id: `tw${n}_${i}`, species: k, level, evo, moveset: enemyMoveset(k, level, seeded(n * 104729 + i * 31 + wh)) });
  }
  const aiLevel = n < 4 ? 0 : n < 10 ? 1 : n < 20 ? 2 : 3;
  // i primi piani sono un tutorial: avversari più deboli del normale
  const enemyBoost = n <= 3 ? 0.65 + (n - 1) * 0.05 : 1 + Math.floor((n - 1) / 10) * 0.06;
  const boss = n % 5 === 0;
  return { floor: n, team, aiLevel, enemyBoost, boss };
}

export const AI_LABEL = ["Novellino", "Sveglio", "Astuto", "Stratega"];

// PE a ogni pet della squadra per un piano vinto.
export const towerXp = (floor) => 20 + floor * 5;
// Sconfitta = PE minimi (2026-10-31): prima era un terzo e si saliva di
// livello perdendo apposta. Ritirarsi = niente PE (non si registra nulla).
export const LOSS_XP = 5;
export const towerLossXp = () => LOSS_XP;
// Punti pet per un piano vinto (solo la prima volta in settimana).
// Bilanciamento (2026-11-01): fissi, 4 a piano + 6 ai Guardiani (ogni 5),
// prima crescevano col piano e dal mese 2 i punti esplodevano.
export const towerPoints = (floor) => 4 + (floor % 5 === 0 ? 6 : 0);
