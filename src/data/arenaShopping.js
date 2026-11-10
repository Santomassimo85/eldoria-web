// Stato e timer della preparazione del torneo, condivisi con il cron del server.
export const ARENA_INITIAL_SHOP_DURATION = 30 * 60 * 1000;
export const ARENA_SHOP_DURATION = 60 * 60 * 1000;
const INITIATIVE_DURATION = 5 * 60 * 1000;

export function beginTournamentShopping(existingMatches, firstMatches, now) {
  return {
    matches: (existingMatches || []).filter((m) => m.kind === "fun"),
    phase: "shopping", currentRound: 1, tournamentWinner: null,
    shopEndsAt: new Date(now + ARENA_INITIAL_SHOP_DURATION).toISOString(),
    initialShopping: true, pendingNextRound: 1, pendingNextMatches: firstMatches,
  };
}

export function promoteArenaShopping(data, now, force = false) {
  if (data.phase !== "shopping") return null;
  const end = data.shopEndsAt?.toMillis ? data.shopEndsAt.toMillis() : Date.parse(data.shopEndsAt);
  if (!force && (!Number.isFinite(end) || now < end)) return null;
  const existing = Array.isArray(data.matches) ? data.matches : [];
  const ids = new Set(existing.map((m) => m.matchId));
  const pending = Array.isArray(data.pendingNextMatches) ? data.pendingNextMatches : [];
  const added = pending.filter((m) => !ids.has(m.matchId)).map((m) => (
    m.status === "initiative" && !m.readyCheck
      ? { ...m, turnExpiry: new Date(now + INITIATIVE_DURATION).toISOString() } : m
  ));
  return {
    matches: [...existing, ...added],
    currentRound: data.pendingNextRound || (data.currentRound || 1) + (pending.length ? 1 : 0),
    phase: "combat", shopEndsAt: null, initialShopping: false,
    pendingNextMatches: null, pendingNextRound: null,
  };
}
