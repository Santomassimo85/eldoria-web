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
// Se qualcuno sparisce durante il dungeon: dopo 5 minuti (era 10 fino al 2026-11-05) il suo turno è difensivo.
export const AFK_DEFEND_MS = 5 * 60 * 1000;
// Stanze aperte e ferme da più di tanto si possono sciogliere (il Master o chi entra).
export const ROOM_IDLE_MS = 3 * 60 * 60 * 1000;

export const DEFAULT_DUNGEONS = [
  { key: "segrete", name: "Le Segrete", icon: "⛓", desc: "Celle umide, catene e guardie che non dormono mai. Non morti e banditi." },
  { key: "caverna", name: "La Caverna", icon: "🕳", desc: "Gallerie strette nel buio: bestie, goblin e ragni giganti." },
  { key: "magma", name: "Caverna di Magma", icon: "🌋", desc: "Fiumi di lava e aria che brucia: elementali del fuoco e salamandre." },
  // 2026-11-06
  { key: "ghiaccio", name: "Il Ghiacciaio Eterno", icon: "🧊", desc: "Gallerie di ghiaccio azzurro e vento che taglia: lupi dell'inverno, mefiti di brina e la Regina di Brina." },
  { key: "palude", name: "La Palude Marcia", icon: "🐸", desc: "Acqua nera, nebbia e fango che risucchia: annegati che si rialzano e troll che non muoiono mai del tutto." },
  { key: "tempio", name: "Il Tempio Sepolto", icon: "🏛", desc: "Rovine di un culto dimenticato sotto la sabbia: guardiani di pietra, morti inquieti e trappole antiche." },
];

/* MOSTRI DI BASE (2026-11-06): stanno nel codice come i dungeon di base e si uniscono al
   bestiario (dungeon_monsters). Il Master li modifica dall'admin: il salvataggio crea un doc
   con lo STESSO id che li sovrascrive; eliminarli = doc con hidden: true. */
const BA = (name, diceNum, diceType, bonus, extra = {}) => ({ type: "attack", name, diceNum, diceType, bonus, hitMode: "hit", aoeShape: "single", dmgType: "", ...extra });
export const BASE_MONSTERS = [
  { id: "base-lupo-invernale", name: "Lupo Invernale", icon: "🐺", role: "minion", size: "medium", level: 2, hp: 15, ac: 13, init: 2, save: 1, dungeons: ["ghiaccio"],
    desc: "Lupo dal pelo bianco come la neve, caccia in branco e morde alle gambe.", resistances: ["cold"], vulnerabilities: ["fire"], immunities: [],
    actions: [BA("Morso Gelido", 1, "d8", 4, { dmgType: "ghiaccio" }), { type: "buff_adv", name: "Ululato del Branco", durationTurns: 2 }] },
  { id: "base-mefite-brina", name: "Mefite di Brina", icon: "❄", role: "minion", size: "small", level: 2, hp: 12, ac: 12, init: 2, save: 1, dungeons: ["ghiaccio"],
    desc: "Piccolo spirito dispettoso di ghiaccio, sputa schegge e soffia nevischio.", resistances: [], vulnerabilities: ["fire", "bludgeoning"], immunities: ["cold", "poison"],
    actions: [BA("Artiglio di Ghiaccio", 1, "d6", 3, { dmgType: "ghiaccio" }), BA("Soffio di Nevischio", 2, "d4", 0, { dmgType: "ghiaccio", hitMode: "save", aoeShape: "cone", saveAbility: "dex", saveDC: 11, halfOnSave: true })] },
  { id: "base-annegato", name: "Annegato", icon: "🧟", role: "minion", size: "medium", level: 1, hp: 16, ac: 10, init: 0, save: 0, dungeons: ["palude", "tempio"],
    desc: "Cadavere gonfio d'acqua che esce dal fango e trascina giù chi afferra.", resistances: [], vulnerabilities: ["radiant"], immunities: ["poison"],
    actions: [BA("Pugno Fradicio", 1, "d6", 3, { dmgType: "fisico" }), BA("Morsa del Fango", 1, "d8", 3, { dmgType: "oscurità" })] },
  { id: "base-troll-ghiacci", name: "Troll dei Ghiacci", icon: "🧌", role: "elite", size: "large", level: 4, hp: 45, ac: 14, init: 1, save: 2, dungeons: ["ghiaccio", "palude"],
    desc: "Troll enorme con la pelle coperta di brina: le ferite si richiudono, se non le bruci.", resistances: ["cold"], vulnerabilities: ["fire", "acid"], immunities: [],
    actions: [BA("Artigli", 2, "d6", 5), BA("Clava di Ghiaccio", 1, "d12", 5, { dmgType: "ghiaccio" }), { type: "heal", name: "Rigenerazione", diceNum: 2, diceType: "d6", bonus: 2 }] },
  { id: "base-regina-brina", name: "Vyrskaal, Regina di Brina", icon: "🐉", role: "boss", size: "huge", level: 6, hp: 90, ac: 16, init: 1, save: 4, dungeons: ["ghiaccio"],
    desc: "Giovane drago bianco che regna sul ghiacciaio: tutto quello che tocca diventa statua di ghiaccio.", resistances: [], vulnerabilities: ["fire"], immunities: ["cold"],
    actions: [BA("Morso", 2, "d10", 6), BA("Artigli di Brina", 2, "d6", 6, { dmgType: "ghiaccio" }),
      BA("Soffio Gelido", 6, "d8", 0, { dmgType: "ghiaccio", hitMode: "save", aoeShape: "cone", saveAbility: "con", saveDC: 15, halfOnSave: true }),
      { type: "buff_ca", name: "Corazza di Ghiaccio", acBonus: 2, durationTurns: 2 }, { type: "debuff_dis", name: "Tormenta Accecante", durationTurns: 2 }] },
];
/* bestiario completo: mostri di base (non sovrascritti) + documenti del Master, senza i nascosti */
export function mergeMonsters(docs = []) {
  const ids = new Set(docs.map((d) => d.id));
  return BASE_MONSTERS.filter((m) => !ids.has(m.id)).map((m) => ({ ...m, base: true }))
    .concat(docs.map((d) => (BASE_MONSTERS.some((m) => m.id === d.id) ? { ...BASE_MONSTERS.find((m) => m.id === d.id), ...d, base: true } : d)))
    .filter((m) => !m.hidden);
}

export const STORY_CLASSES = ARENA_CLASSES.map(({ key, it, icon }) => ({ key, it, icon }));
export const classInfo = (key) => STORY_CLASSES.find((c) => c.key === key) || null;
// colore di ogni classe nella lobby delle Segrete (carte, slot del gruppo, scheda dell'eroe)
export const CLASS_COLORS = {
  fighter: "#b9c6d8", barbarian: "#e2553f", paladin: "#f2c94c", ranger: "#3fae76",
  monk: "#45b8c4", rogue: "#9a9cb3", wizard: "#4f86ea", sorcerer: "#ff8a34",
  warlock: "#a95ee0", druid: "#a8c83c", cleric: "#f3ead0", bard: "#ea62ad",
};
export const classColor = (key) => CLASS_COLORS[key] || "#e0a85a";
export const clsStyle = (key) => ({ "--cls": classColor(key) });

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
// Taglia dei mostri (2026-11-05): scelta nell'admin, in lotta ingrandisce lo sprite.
// Senza taglia: boss Grande, gli altri Media.
export const MONSTER_SIZES = [
  { key: "tiny", label: "Minuscola", scale: 0.7 },
  { key: "small", label: "Piccola", scale: 0.85 },
  { key: "medium", label: "Media", scale: 1 },
  { key: "large", label: "Grande", scale: 1.3 },
  { key: "huge", label: "Enorme", scale: 1.6 },
  { key: "gargantuan", label: "Mastodontica", scale: 1.9 },
];
export const defaultSize = (role) => (role === "boss" ? "large" : "medium");
export const sizeOf = (m) => (MONSTER_SIZES.some((z) => z.key === m?.size) ? m.size : defaultSize(m?.role));
export const sizeScale = (m) => MONSTER_SIZES.find((z) => z.key === sizeOf(m))?.scale || 1;
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
export const WEEKLY_RUNS = 5; // 5 dungeon a settimana per classe (era 3 fino al 2026-11-06)
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
