/* ============================================================
   LE SEGRETE (story mode della Sala della Gloria, 2026-11-04)
   Dati condivisi fra lobby, admin e (fase 3) motore del combattimento.
   - Gruppi da 1 a MAX_PARTY giocatori, si parte quando TUTTI premono Avvia.
   - Tipi di dungeon (caverna, segrete, magma…): quelli base qui sotto, il
     Master ne aggiunge/modifica in dungeon_types/{key} (fase 2). Ogni tipo
     avrà i suoi mostri e i suoi sfondi.
   - Livello di STORIA per classe: si accumula giocando e si azzera con la
     settimana dell'Arena (domenica 23:00, currentWeekKey).
   ============================================================ */
import { ARENA_CLASSES } from "./arenaClassSprites";
import { currentWeekKey } from "./arenaWeek";
import { levelOfXp } from "./segreteKits";

export const MAX_PARTY = 4;
// Se qualcuno sparisce durante il dungeon: dopo 10 minuti il suo turno è difensivo.
export const AFK_DEFEND_MS = 10 * 60 * 1000;
// Stanze aperte e ferme da più di tanto si possono sciogliere (il Master o chi entra).
export const ROOM_IDLE_MS = 3 * 60 * 60 * 1000;

export const DEFAULT_DUNGEONS = [
  { key: "segrete", name: "Le Segrete", icon: "⛓", desc: "Celle umide, catene e guardie che non dormono mai. Non morti e banditi." },
  { key: "caverna", name: "La Caverna", icon: "🕳", desc: "Gallerie strette nel buio: bestie, goblin e ragni giganti." },
  { key: "magma", name: "Caverna di Magma", icon: "🌋", desc: "Fiumi di lava e aria che brucia: elementali del fuoco e salamandre." },
];

export const STORY_CLASSES = ARENA_CLASSES.map(({ key, it, icon }) => ({ key, it, icon }));
export const classInfo = (key) => STORY_CLASSES.find((c) => c.key === key) || null;

// Eroe di classe (permanente, 2026-11-04): characters.storyChars[cls] = {stats, asi, picks, xp}.
export const heroOf = (charData, classKey) => charData?.storyChars?.[classKey] || null;
export function storyLevelOf(charData, classKey) {
  const h = heroOf(charData, classKey);
  return h ? levelOfXp(h.xp) : 1;
}

// Dungeon disponibili: quelli base, sovrascritti/integrati da dungeon_types del Master
// (un tipo con hidden: true sparisce dalla scelta).
export function mergeDungeons(custom = []) {
  const map = new Map(DEFAULT_DUNGEONS.map((d) => [d.key, d]));
  custom.forEach((d) => { if (d?.key) map.set(d.key, { ...(map.get(d.key) || {}), ...d }); });
  return [...map.values()].filter((d) => !d.hidden);
}

export const roomMember = (room, uid) => (room?.members || []).find((m) => m.uid === uid) || null;
export const roomFull = (room) => (room?.members || []).length >= MAX_PARTY;
export const allReady = (room) => (room?.members || []).length > 0 && room.members.every((m) => m.ready);

/* ── Bestiario e tipi di dungeon del Master (fase 2) ──────────────
   dungeon_types/{key}: { name, icon, desc, floors, backgrounds: [url], hidden }
     floors = incontri prima del boss (il boss è l'ultima sala).
   dungeon_monsters/{id}: { name, desc, role, level, hp, ac, init, save,
     dungeons: [key], imageUrl, deadImageUrl, facing, actions: [azione World
     Boss], resistances, vulnerabilities, immunities, source }
     role: minion (gruppi), elite (da solo o con 1-2 minion), boss (ultima sala). */
export const DEFAULT_FLOORS = 3;
export const MONSTER_ROLES = [
  { key: "minion", label: "Gregario", icon: "🐀", hint: "Escono in gruppo nelle sale normali." },
  { key: "elite", label: "Élite", icon: "💀", hint: "Più forte: da solo o con qualche gregario." },
  { key: "boss", label: "Boss", icon: "👑", hint: "L'ultima sala del dungeon." },
];
export const roleInfo = (k) => MONSTER_ROLES.find((r) => r.key === k) || MONSTER_ROLES[0];
export const dungeonSlug = (name) => String(name || "").toLowerCase()
  .normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/* ── LIMITI (2026-11-04, rifatti): PER CLASSE, 1 dungeon al giorno (giorno di Roma)
   e 3 a settimana (settimana dell'Arena). Chi ha fatto il Mago oggi può giocare col
   Guerriero. Un dungeon CONTA solo dopo almeno RUN_COUNTS_AFTER sale ripulite (o la
   vittoria): chi cade prima può riprovare. Lo conta il SERVER (segreteDo), il
   Master principale è esente.
   characters.storyClassRuns[cls] = { weekKey, count, day, dayCount }
   (il vecchio characters.storyRuns, per giocatore, non si usa più). */
export const DAILY_RUNS = 1;
/* TETTO PER GIOCATORE (2026-11-04 sera): oltre a 1 per classe, al massimo DAILY_TOTAL
   dungeon FINITI al giorno in tutto (vinti o persi dopo la 2ª sala), contati alla fine
   della partita in characters.storyDaily = { day, count }. */
export const DAILY_TOTAL = 3;
export const dailyTotalOf = (charData, day = romeDayKey()) => (charData?.storyDaily?.day === day ? Number(charData.storyDaily.count) || 0 : 0);
export const nextDailyPatch = (charData, day = romeDayKey()) => ({ day, count: dailyTotalOf(charData, day) + 1 });
export const WEEKLY_RUNS = 3;
export const RUN_COUNTS_AFTER = 2;
export const romeDayKey = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
export function runsOf(charData, cls, week = currentWeekKey(), day = romeDayKey()) {
  const r = charData?.storyClassRuns?.[cls];
  const weekCount = r && r.weekKey === week ? Number(r.count) || 0 : 0;
  const dayCount = r && r.weekKey === week && r.day === day ? Number(r.dayCount) || 0 : 0;
  const total = dailyTotalOf(charData, day);
  const totalFull = total >= DAILY_TOTAL;
  return { weekCount, dayCount, total, totalFull, canRun: !totalFull && weekCount < WEEKLY_RUNS && dayCount < DAILY_RUNS };
}
export function nextRunsPatch(charData, cls, week = currentWeekKey(), day = romeDayKey()) {
  const { weekCount, dayCount } = runsOf(charData, cls, week, day);
  return { weekKey: week, count: weekCount + 1, day, dayCount: dayCount + 1 };
}
