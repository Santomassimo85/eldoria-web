// ─────────────────────────────────────────────────────────────────────────
// battleModel — the Firestore-backed tactical battle model + combat helpers.
//
// The whole live battle lives in a single doc `battle_state/current`. It is a
// SELF-CONTAINED snapshot: when the master spawns a player we copy the needed
// stats from `characters/{uid}` into the unit, so the engine never has to join
// across docs mid-fight. The player's *available actions* are still read live
// from their character doc (so weapons/spells stay current). The chat log
// reuses the existing `world_boss_chat` collection unchanged.
// ─────────────────────────────────────────────────────────────────────────
import { db } from "../../firebase";
import { doc } from "firebase/firestore";
import { DEFAULT_MOVE, makeFlatMap } from "./isoCore";

export const BATTLE_REF = () => doc(db, "battle_state", "current");
export const BOSS_SYSTEM_UID = "BOSS_MSG";

// ── Dice ──────────────────────────────────────────────────────────────────
export const rollDie = (s) => Math.floor(Math.random() * s) + 1;
export function rollFormula(f, mod = 0) {
  let total = 0;
  const clean = String(f ?? "").replace(/@mod/g, mod).replace(/\s/g, "");
  if (!clean) return 0;
  for (const part of clean.split("+")) {
    if (part.includes("d")) {
      const [n, s] = part.split("d").map(Number);
      for (let i = 0; i < (n || 1); i++) total += rollDie(s || 6);
    } else total += parseInt(part) || 0;
  }
  return total;
}

// ── Initiative & turn order ────────────────────────────────────────────────
export const allRolled = (units) =>
  units.length > 0 && units.every((u) => typeof u.initiative === "number");

// Higher initiative first; ties broken by DEX then a stable id compare.
export function computeTurnOrder(units) {
  return [...units]
    .sort((a, b) =>
      (b.initiative ?? -99) - (a.initiative ?? -99) ||
      (b.dex ?? 0) - (a.dex ?? 0) ||
      String(a.id).localeCompare(String(b.id)))
    .map((u) => u.id);
}

// Next index in turnOrder whose unit is still alive (skips the dead).
export function nextAliveIdx(order, units, fromIdx) {
  const byId = Object.fromEntries(units.map((u) => [u.id, u]));
  for (let i = 1; i <= order.length; i++) {
    const idx = (fromIdx + i) % order.length;
    const u = byId[order[idx]];
    if (u && !u.dead) return idx;
  }
  return fromIdx;
}

// ── Unit builders ──────────────────────────────────────────────────────────
// Movement comes from the character's speed (1 tile = 1 m); fallback DEFAULT_MOVE.
// Foundry stores speed in feet (e.g. 30 = 9 m ≈ 9 tiles); small values are
// already meters/tiles. TODO: update the Foundry import macro to bring speed in.
function moveFromChar(char) {
  const raw = char?.stats?.speed ?? char?.speed;
  const n = Number(raw);
  if (!n) return DEFAULT_MOVE;
  return n > 15 ? Math.max(1, Math.round(n / 3.28)) : Math.max(1, Math.round(n));
}

export function makePlayerUnit(char, uid, x, y) {
  const s = char?.stats || {};
  return {
    // NOTE: no image fields stored here — they are resolved client-side from the
    // `characters` collection to keep the battle doc under Firestore's 1 MB cap.
    id: uid, uid, side: "hero", kind: "player",
    name: char?.name || "Eroe",
    x, y,
    hp: s.hp ?? s.maxHp ?? 10, maxHp: s.maxHp ?? s.hp ?? 10,
    ac: s.ac ?? 10, dex: s.dex ?? 0,
    move: moveFromChar(char),
    initiative: null, hasMoved: false, hasActed: false, dead: (s.hp ?? 1) <= 0,
  };
}

export function makeBossUnit(boss, x, y, dex = 0) {
  return {
    id: "boss", side: "enemy", kind: "boss",
    name: boss?.name || "Boss",
    // images resolved client-side from the `bosses` collection (see makePlayerUnit)
    x, y,
    hp: boss?.hp ?? boss?.maxHp ?? 100, maxHp: boss?.maxHp ?? boss?.hp ?? 100,
    ac: boss?.ac ?? 12, dex,
    move: boss?.move ?? 4,
    bossId: boss?.id || null,
    initiative: null, hasMoved: false, hasActed: false, dead: false,
  };
}

export function makeMinionUnit(spec, idx, x, y) {
  return {
    id: `minion-${idx}`, side: "enemy", kind: "minion",
    name: spec?.name || `Nemico ${idx + 1}`,
    tplId: spec?.tplId || null,   // player_sprites template id → images resolved client-side
    x, y,
    hp: spec?.hp ?? 12, maxHp: spec?.hp ?? 12,
    ac: spec?.ac ?? 11, dex: spec?.dex ?? 0,
    move: spec?.move ?? 5,
    atkName: spec?.atkName || "Attacco",
    atkDice: spec?.atkDice || "1d6", atkBonus: spec?.atkBonus ?? 2, atkRange: spec?.atkRange ?? 1,
    initiative: null, hasMoved: false, hasActed: false, dead: false,
  };
}

// ── Default map (until the master map editor lands) ────────────────────────
export function defaultBattleMap() {
  // 16×16 grassy field with a few blocking props and a small pond/lava patch.
  const map = makeFlatMap(16, 16, "grass");
  const set = (x, y, patch) => Object.assign(map.tiles[y * map.w + x], patch);
  for (let y = 11; y <= 13; y++) for (let x = 2; x <= 4; x++) set(x, y, { terrain: "water" });
  for (let x = 7; x <= 9; x++) set(x, 8, { terrain: "lava" });
  set(5, 4, { prop: "tree" }); set(10, 5, { prop: "boulder" });
  set(12, 10, { prop: "column" }); set(3, 7, { prop: "tree" });
  return map;
}

// ── Empty battle scaffold ──────────────────────────────────────────────────
export function emptyBattle() {
  return {
    active: false, fightStarted: false, phase: "setup",
    round: 1, activeIdx: 0, turnOrder: [],
    map: defaultBattleMap(), units: [],
  };
}

// ── Spell intent (ported from the old WorldBoss, trimmed) ──────────────────
export function detectSpellIntent(action) {
  const cat = (action.category || "").toLowerCase();
  if (/armi|arma|weapon/.test(cat)) return "attack";
  const text = `${action.name || ""} ${action.description || ""}`.toLowerCase();
  if (
    /\bmage armou?r\b|\barmatura magica\b/.test(text) ||
    /\bbarkskin\b|\bscorza\b/.test(text) ||
    /\bstoneskin\b|\bpelle di pietra\b/.test(text) ||
    /\bmirror image\b|immagine specul/.test(text) ||
    /\bblur\b|\boffuscamento\b/.test(text) ||
    /\bsanctuary\b|\bsantuario\b/.test(text) ||
    (/(\bshield\b|\bscudo\b)/.test(text) && !/shield of faith|scudo della fede/.test(text))
  ) return "self_buff";
  if (/\bcur(a|are|i|ato)\b|guarisc|guarigione|cure wounds|healing|tocco curativ|parola guarit|rigenera|ristoro|bende sacre/.test(text)) return "heal";
  if (/ispirazion|inspiration|benedic|bless|\baid\b|aiuto magico|scudo della fede|shield of faith|\bhaste\b|velocità|guida|guidance|favore divin|protezione dal|eroismo|heroism|coraggio/.test(text)) return "buff";
  if (/svantaggio|paura|spavent|maledizione|\bbane\b|malocchio|frighten|hold person|hold monster|tratteni|paralis|\bsonno\b|\bsleep\b|charme|charm|sciagura|disgrazia|nebbia|oscurità|ostacolo|rallenta|\bslow\b|silen(zio|ce)|debilita|indebol/.test(text)) return "debuff";
  return "attack";
}

// Default attack range by action name (ranged weapons/cantrips reach further).
export function actionRange(action) {
  const t = `${action.name || ""}`.toLowerCase();
  if (/arco|balestra|long ?bow|short ?bow|crossbow|fionda|sling|dardo|javelin|giavellotto/.test(t)) return 6;
  if (detectSpellIntent(action) === "attack" && /trucchett|cantrip|livello|level|raggio|bolt|fire|fulmine|ray|eldritch/.test(`${action.category || ""} ${t}`)) return 6;
  return 1;
}

// Group a character's actions like the old WorldBoss, but DROP abilities/skills
// (and "feature") so players only see weapons + spells.
export function battleActions(char) {
  if (!Array.isArray(char?.actions)) return [];
  return char.actions.filter((a) => {
    const cat = (a.category || "").toLowerCase();
    if (/abilit|skill|feature|tratto|privileg/.test(cat)) return false;
    return !!a?.name;
  });
}
