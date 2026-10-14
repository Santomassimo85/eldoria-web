// Bacheca: le missive NON prese si cancellano dopo una settimana dalla
// creazione (2026-10-14). Lo fa la function `cleanupExpiredQuests` ogni ora;
// la pagina intanto mostra il countdown e nasconde quelle già scadute.
export const QUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function questExpiresAt(quest) {
  const t = quest?.createdAt ? new Date(quest.createdAt).getTime() : NaN;
  return Number.isNaN(t) ? null : t + QUEST_TTL_MS;
}

// ms rimasti per una missiva non presa; null = non scade (presa o senza data)
export function questTimeLeft(quest, now = Date.now()) {
  if (quest?.acceptedBy) return null;
  const end = questExpiresAt(quest);
  return end == null ? null : end - now;
}

export function fmtTimeLeft(ms) {
  if (ms <= 0) return "in scadenza";
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
  if (d > 0) return `${d}g ${h}h`;
  if (h > 0) return `${h}h ${min}m`;
  return `${min}m`;
}
