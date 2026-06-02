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
import { doc, runTransaction } from "firebase/firestore";
import { DEFAULT_MOVE, makeFlatMap, tileAt, TERRAINS } from "./isoCore";

export const BATTLE_REF = () => doc(db, "battle_state", "current");
export const BOSS_SYSTEM_UID = "BOSS_MSG";

// ── Async round model (Model A: free order within a phase) ──────────────────
// Players don't take strict per-unit turns: during the heroes' phase every
// player controls their own PG and acts whenever they're online, in any order.
// The phase ends when all living heroes are done OR the window expires; then the
// master plays the enemies in their own (shorter) window. Tile collisions are
// impossible because every mutation goes through a Firestore transaction that
// re-reads fresh state and patches units by id (see txnBattle / the movement
// transaction in BossTactics).
export const PLAYER_PHASE_MS = 3 * 60 * 60 * 1000; // heroes: 3 hours
export const ENEMY_PHASE_MS = 1 * 60 * 60 * 1000;  // enemies (boss): 1 hour

// A unit has finished its round when it explicitly ended its turn, or it has
// used BOTH its move and its action.
export const unitDone = (u) => !!u.done || (!!u.hasMoved && !!u.hasActed);

// Every living unit on `side` has finished this round (false if none alive).
export const sideAllDone = (units, side) => {
  const living = units.filter((u) => u.side === side && !u.dead);
  return living.length > 0 && living.every(unitDone);
};

// Reset a side's per-round flags — called when that side's phase begins.
export const resetSide = (units, side) =>
  units.map((u) => (u.side === side ? { ...u, hasMoved: false, hasActed: false, done: false } : u));

// Atomically read→mutate→write the battle's units. `mutate(freshUnits, freshDoc)`
// receives the FRESH units array and must patch by id and return the new array
// (or throw to abort) — never rebuild from stale client state, so two players
// writing at the same moment can't clobber each other. `extra` adds doc fields
// (object, or a function of the fresh doc).
export async function txnBattle(mutate, extra = {}) {
  return runTransaction(db, async (tx) => {
    const ref = BATTLE_REF();
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("no-battle");
    const data = snap.data();
    const nextUnits = mutate(data.units || [], data);
    const ex = typeof extra === "function" ? extra(data) : extra;
    tx.update(ref, { units: nextUnits, ...ex });
  });
}

// ── Sneak Attack (rogues) ───────────────────────────────────────────────────
// Number of d6 a rogue adds on a qualifying hit (D&D 5e progression):
// dice = ceil(level/2) → lvl1 1d6, lvl3 2d6, lvl5 3d6, lvl7 4d6, lvl11 6d6,
// lvl18 9d6, capped at 10d6. Returns 0 for non-rogues.
export function sneakAttackDice(cls = "", level = 1) {
  if (!/ladro|rogue|rouge/i.test(cls || "")) return 0;
  return Math.min(10, Math.max(1, Math.ceil((Number(level) || 1) / 2)));
}

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
    cls: char?.class || char?.cls || "",   // class + level → Sneak Attack scaling (rogues)
    level: char?.level ?? 1,
    x, y,
    hp: s.hp ?? s.maxHp ?? 10, maxHp: s.maxHp ?? s.hp ?? 10,
    ac: s.ac ?? 10, dex: s.dex ?? 0,
    abilities: abilityBlock(s),         // mods for saving throws when targeted
    spellDC: computeSpellDC(char),      // CD of this PG's own spells (8+prof+mod)
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
    abilities: { ...abilityBlock(boss), dex },   // saves when targeted (mostly 0s unless boss doc has mods)
    spellDC: boss?.spellDC ?? 13,                // CD of the boss's own AoE spells (tune on the boss doc)
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
    defId: spec?.defId || null,   // saved-minion doc id (custom builder) → sprite resolved client-side
    // Builder minions carry their own list of attacks (same shape as boss actions);
    // legacy player_sprites minions have none and fall back to the single atk below.
    actions: Array.isArray(spec?.actions) && spec.actions.length ? spec.actions : null,
    x, y,
    hp: spec?.hp ?? 12, maxHp: spec?.hp ?? 12,
    ac: spec?.ac ?? 11, dex: spec?.dex ?? 0,
    abilities: { ...abilityBlock(spec), dex: spec?.dex ?? 0 }, // saves when caught in an AoE
    spellDC: spec?.spellDC ?? 13,                              // DC of the minion's own AoE attacks
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
    round: 1, phaseDeadline: null,
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
  const aoe = spellAoE(action);
  if (aoe) return aoe.range;                 // AoE spells carry their own range
  const t = `${action.name || ""}`.toLowerCase();
  if (/arco|balestra|long ?bow|short ?bow|crossbow|fionda|sling|dardo|javelin|giavellotto/.test(t)) return 6;
  if (detectSpellIntent(action) === "attack" && /trucchett|cantrip|livello|level|raggio|bolt|fire|fulmine|ray|eldritch/.test(`${action.category || ""} ${t}`)) return 6;
  // Healing / support spells: most reach allies at a distance (Healing Word &c.).
  // Touch spells stay adjacent; "ranged" wording reaches far; others get a
  // comfortable default so players aren't forced to stand next to the target.
  const intent = detectSpellIntent(action);
  if (intent === "heal" || intent === "buff") {
    if (/tocco|touch|contatto|imposizione|cure wounds|cura ferite/.test(t)) return 1;
    if (/parola|word|distanza|a distanza|raggio|ranged|aura|massa|\bmass\b|preghiera|benedizione|bless/.test(t)) return 8;
    return 6;
  }
  return 1;
}

// ── Spell save DC (D&D standard: 8 + proficiency + casting-ability mod) ──────
// Ability scores are already stored as MODIFIERS (str/dex/… = +3, −1…).
export const profFromLevel = (lvl) => 2 + Math.floor((Math.max(1, lvl || 1) - 1) / 4);
export function spellcastingAbility(cls = "") {
  const c = cls.toLowerCase();
  if (/bard|bardo|warlock|sorcerer|stregone|paladin|paladino/.test(c)) return "cha";
  if (/cleric|chierico|druid|druido|ranger|cacciatore|monk|monaco/.test(c)) return "wis";
  return "int"; // wizard / artificer / default
}
export function computeSpellDC(char) {
  const ab = spellcastingAbility(char?.class || char?.cls || "");
  const mod = char?.stats?.[ab] ?? 0;
  return 8 + profFromLevel(char?.level ?? 1) + mod;
}
export const abilityBlock = (s = {}) => ({
  str: s.str ?? 0, dex: s.dex ?? 0, con: s.con ?? 0,
  int: s.int ?? 0, wis: s.wis ?? 0, cha: s.cha ?? 0,
});
export const SAVE_LABEL = { str: "FOR", dex: "DES", con: "COS", int: "INT", wis: "SAG", cha: "CAR" };

// ── Area-of-effect spell table (CURATED, tile-scaled to these maps) ─────────
// First regex match on the spell name wins. shapes:
//   "sphere"/"square" — centred on a tile within `range`
//   "line"/"cone"     — emanate from the caster toward the aimed tile, length=size
// `save` = the ability the targets roll; `half:true` halves damage on a save
// (Fireball-style), false = no damage on a save. ➕ Add new spells here. Note:
// values are tuned to a 1 tile = 1 m grid, NOT literal D&D feet (a 20-ft fireball
// would swallow these maps), so they read smaller than the rulebook on purpose.
const AOE_TABLE = [
  { re: /zona nera/,                                          shape: "sphere", size: 1, range: 6, save: "dex", half: true, dmgType: "vuoto" },  // boss: 3×3 cerchio
  { re: /palla di fuoco|fire ?ball/,                          shape: "sphere", size: 2, range: 8, save: "dex", half: true, dmgType: "fuoco" },
  { re: /tempesta di ghiaccio|ice ?storm|grandine/,           shape: "sphere", size: 2, range: 8, save: "dex", half: true, dmgType: "freddo" },
  { re: /fulmine|lightning ?bolt|saetta|catena di fulmini|chain lightning/, shape: "line", size: 8, range: 8, save: "dex", half: true, dmgType: "fulmine" },
  { re: /cono di freddo|cone of cold/,                        shape: "cone",   size: 5, range: 5, save: "con", half: true, dmgType: "freddo" },
  { re: /mani brucianti|burning hands/,                       shape: "cone",   size: 3, range: 3, save: "dex", half: true, dmgType: "fuoco" },
  { re: /soffio|breath|\bcono\b|\bcone\b/,                     shape: "cone",   size: 4, range: 4, save: "dex", half: true },
  { re: /nova|deflagraz|esplos|onda d.?urto|frantum|shatter/, shape: "sphere", size: 2, range: 6, save: "con", half: true },
];
// AoE geometry for an action, or null if it isn't an area damage spell. Only
// "attack"-intent actions can be AoE (heals/buffs stay single-target for now).
export function spellAoE(action) {
  if (!action || detectSpellIntent(action) !== "attack") return null;
  // Flat fields authored in the Boss editor take precedence (aoeShape/aoeSize).
  if (action.aoeShape && action.aoeShape !== "single") {
    return {
      shape: action.aoeShape,
      size: Number(action.aoeSize) || 1,
      range: Number(action.range) || Number(action.aoeSize) || 6,
      save: action.saveAbility || "dex",
      half: action.halfOnSave !== false,
      dmgType: action.dmgType || undefined,
    };
  }
  if (action.area && action.area.shape) {          // explicit override, if ever provided by data
    const a = action.area;
    return { shape: a.shape, size: a.size ?? a.radius ?? 1, range: a.range ?? a.size ?? 6,
             save: action.saveAbility || "dex", half: action.halfOnSave !== false, dmgType: action.dmgType };
  }
  const t = `${action.name || ""}`.toLowerCase();
  const e = AOE_TABLE.find((x) => x.re.test(t));
  return e ? { ...e } : null;
}

// Enumerate the tiles a blast covers (every living unit inside — friend OR foe —
// is affected). `aoe` from spellAoE; centre (cx,cy) is the aimed tile.
export function aoeCells(map, caster, cx, cy, aoe) {
  const out = new Set();
  const ok = (x, y) =>
    x >= 0 && y >= 0 && x < map.w && y < map.h &&
    TERRAINS[tileAt(map, x, y)?.terrain]?.color != null;
  const add = (x, y) => { if (ok(x, y)) out.add(`${x},${y}`); };
  if (!aoe || aoe.shape === "single") { add(cx, cy); return out; }
  if (aoe.shape === "sphere" || aoe.shape === "square") {
    const r = aoe.size ?? 1;
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (aoe.shape === "square" || (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r) add(x, y);
  } else if (aoe.shape === "line") {
    const len = aoe.size ?? 6;
    const dx = cx - caster.x, dy = cy - caster.y, mag = Math.hypot(dx, dy) || 1;
    for (let i = 1; i <= len; i++) add(Math.round(caster.x + (dx / mag) * i), Math.round(caster.y + (dy / mag) * i));
  } else if (aoe.shape === "cone") {
    const len = aoe.size ?? 4;
    const dx = cx - caster.x, dy = cy - caster.y, mag = Math.hypot(dx, dy) || 1;
    const ux = dx / mag, uy = dy / mag;
    for (let y = caster.y - len; y <= caster.y + len; y++)
      for (let x = caster.x - len; x <= caster.x + len; x++) {
        const vx = x - caster.x, vy = y - caster.y, vm = Math.hypot(vx, vy);
        if (vm === 0 || vm > len) continue;
        if ((vx * ux + vy * uy) / vm >= 0.5) add(x, y); // within ~60° of the aim direction
      }
  }
  return out;
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
