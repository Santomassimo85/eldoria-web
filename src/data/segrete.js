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

// Livello di storia del personaggio per quella classe (1 se nuovo o di un'altra settimana).
export function storyLevelOf(charData, classKey, week = currentWeekKey()) {
  const s = charData?.storyWeekly;
  if (!s || s.weekKey !== week) return 1;
  return Math.max(1, Number(s.levels?.[classKey]) || 1);
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
