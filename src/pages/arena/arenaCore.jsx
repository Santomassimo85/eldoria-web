// Tempi, orologio del server, id di bot e PG del Master, «Iniziamo», slot salvati, firma del match.
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.
import { AI_BOT_PREFIX } from "./arenaAi";

// Il timer parte solo dopo che entrambi hanno premuto "Iniziamo" (sono live): 5 minuti a testa.
export const ARENA_INITIATIVE_DURATION = 5 * 60 * 1000;       // 5 minuti per tirare iniziativa
export const ARENA_TURN_DURATION       = 5 * 60 * 1000;       // 5 minuti per fare la propria azione
export const ARENA_SHOP_DURATION       = 1 * 60 * 60 * 1000;  // 1 ora di acquisti tra un round e l'altro
export const FUN_MATCH_PRUNE_GRACE_MS  = 10 * 60 * 1000;      // attesa prima di rimuovere una Sfida Libera finita+archiviata

// Ora del SERVER per scadenze e timeout dei turni (src/data/serverClock.js). Prima
// contava l'orologio del telefono: un dispositivo avanti di un'ora faceva scattare
// subito l'attacco automatico sul turno dell'altro, uno indietro scriveva scadenze
// già passate. Lo scarto si misura all'apertura dell'Arena; se la sonda fallisce
// resta 0 (comportamento di prima).
let _arenaClockOffset = 0;
// Arena() la corregge con l'ora del server: un import non si può riassegnare.
export const setArenaClockOffset = (o) => { _arenaClockOffset = o; };
export const arenaNow = () => Date.now() + _arenaClockOffset;
// Margine prima di considerare scaduto un turno (piccoli scarti residui fra dispositivi).
export const ARENA_EXPIRY_GRACE_MS = 20 * 1000;

// ── CONFERMA "INIZIAMO" (2026-10-19) ──────────────────────────────────────────
// Ogni match nasce con readyCheck: niente timer e niente iniziativa finché ogni
// giocatore umano non ha premuto "Iniziamo" (i bot sono pronti da sé). Quando
// l'ultimo conferma parte l'iniziativa, col suo timer.
export const isArenaBotId = (id) => typeof id === "string" && id.startsWith(AI_BOT_PREFIX);
// Personaggi in più del Master nel torneo (2026-10-20): id = "<uid del Master>__ALT2", "__ALT3"…
// Li gioca il Master a mano (non sono bot), ma come i bot non prendono premi né classifica.
export const MASTER_ALT_SEP = "__ALT";
export const MASTER_ALT_MAX = 8;
export const isMasterAltId = (id) => typeof id === "string" && id.includes(MASTER_ALT_SEP);
export const masterEntryIds = (uid) => [uid, ...Array.from({ length: MASTER_ALT_MAX - 1 }, (_, i) => `${uid}${MASTER_ALT_SEP}${i + 2}`)];
export const withReadyCheck = (match) => {
  const ready = {};
  (match.players || []).forEach(p => { if (isArenaBotId(p.id)) ready[p.id] = true; });
  if ((match.players || []).every(p => ready[p.id])) return match; // solo bot: parte subito
  return {
    ...match, readyCheck: true, ready, turnExpiry: null,
    logs: [...(match.logs || []), "✋ Il timer parte quando entrambi premono «Iniziamo»."],
  };
};
export const isAwaitingReady = (m) => m?.readyCheck === true && m.status === "initiative";

// Ri-equipaggiamento del torneo: si può cambiare assetto in pausa Bottega e
// durante il combattimento quando NON si sta combattendo (match finito, o il
// prossimo non ancora partito). null = consentito, altrimenti il motivo.
export const reloadoutBlockReason = (meta, uid) => {
  if (!meta || !uid) return "no";
  if (!["combat", "shopping"].includes(meta.phase) || meta.tournamentWinner) return "phase";
  if (!(meta.participants || []).includes(uid) || !meta.characterSnapshots?.[uid]) return "notIn";
  const live = (meta.matches || []).some(m =>
    m.kind !== "fun" && m.status !== "finished" && !isAwaitingReady(m) && (m.players || []).some(p => p.id === uid));
  return live ? "fighting" : null;
};

// Numero di slot per i PG d'Arena salvati (build pronti da ripescare all'iscrizione).
export const SAVED_ARENA_SLOTS = 4;

// Numero di slot "PG di Riserva" del Master: bot pronti a entrare quando il numero
// di iscritti al torneo è dispari (ne viene pescato uno a caso e inserito).
export const MASTER_RESERVE_SLOTS = 4;

// Archetipo IA dedotto dalla classe: guida alcune euristiche del motore IA quando
// pilota un PG di riserva creato dal Master (fallback: fighter-plate).
export const ARENA_ARCHETYPE_BY_CLASS = {
  fighter: "fighter-plate", barbarian: "barbarian-axe", ranger: "ranger-longbow",
  rogue: "rogue-twin", monk: "rogue-twin", paladin: "paladin-sword-shield",
  wizard: "wizard-fire", sorcerer: "wizard-fire", warlock: "wizard-fire",
  bard: "wizard-fire", druid: "ranger-longbow", cleric: "paladin-sword-shield",
  artificer: "fighter-plate",
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────
// Firma di un match per il controllo di concorrenza: ogni azione cambia almeno
// uno di questi campi (i log crescono a ogni mossa).
export const matchSig = (m) => `${m?.status}|${m?.turn}|${(m?.logs || []).length}|${m?.winner || ""}`;
