// ─────────────────────────────────────────────────────────────────────────
// Giocatori NASCOSTI (non cancellati).
// I personaggi qui elencati NON vengono mostrati né al Master nelle liste
// admin, né ai giocatori (presenza online, registro Compagnie…).
// Restano intatti su Firestore: per farne riapparire uno, basta rimuovere
// il suo UID (e/o il nome) da queste liste. Nessun dato viene perso.
//
// NB: le pagine di gioco (TCG / Arena / World Boss) NON applicano questo
// filtro per scelta progettuale (non vanno toccate).
// ─────────────────────────────────────────────────────────────────────────

// UID Firestore (doc id della collection `characters`).
export const HIDDEN_PLAYER_UIDS = new Set([
  "5gm0PeyGvYTP665x6D2uVRHcE032", // Dante
  "Q5Yj7RJtjHM4TvOPtF1XAsn2ZWy2", // Daga
  "2vTiCnBtHIe4y2p0VSQ3lje0aHQ2", // Ismael Van Dyke
  "kfUcKrRjt1Rnybtm40sjERg0EWj2", // Taaras Stormrage
  "2TLy9pRAdIUMKW7CZMB00UUA0ZE3", // Roynot
  "687rg1HsmqgQ0X4X1EEIHeBAd9J3", // Cornelius
  "BKIjjWJfOld8gy04qJnxO3sU67K2", // Goran Rosman "Sentenza"
  "o5NrDuH3zdVgW25FzWiby4AyQ612", // Timoty Bevibotte
  "BEctG30gGONN67AkcBV6JhAqF3y1", // Tinkle Muschioverde
  "DUlfCGLTo8PjGD0M9EB3yaIrecC3", // Vyger
  "ZETcx5SwVtdd4yjwikuv75MrAL23", // account vuoto (nessun PG creato)
]);

// Primo nome (minuscolo) — per le viste hardcoded basate sul nome (es. Party).
export const HIDDEN_PLAYER_NAMES = new Set([
  "dante", "daga", "ismael", "taaras", "roynot",
  "cornelius", "goran", "timoty", "tinkle", "vyger",
]);

export function isHiddenUid(uid) {
  return !!uid && HIDDEN_PLAYER_UIDS.has(uid);
}

// Confronta il "primo nome" normalizzato (gestisce apostrofi/virgolette/spazi).
export function isHiddenName(name) {
  if (!name) return false;
  const first = String(name).trim().toLowerCase().split(/[\s'"’]+/)[0];
  return !!first && HIDDEN_PLAYER_NAMES.has(first);
}

// Helper generico per un doc `characters` ({id|uid, name}).
export function isHiddenChar(c) {
  if (!c) return false;
  return isHiddenUid(c.id || c.uid) || isHiddenName(c.name);
}
