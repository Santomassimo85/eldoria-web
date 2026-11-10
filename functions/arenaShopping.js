var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/data/arenaShopping.js
var arenaShopping_exports = {};
__export(arenaShopping_exports, {
  ARENA_INITIAL_SHOP_DURATION: () => ARENA_INITIAL_SHOP_DURATION,
  ARENA_SHOP_DURATION: () => ARENA_SHOP_DURATION,
  beginTournamentShopping: () => beginTournamentShopping,
  promoteArenaShopping: () => promoteArenaShopping
});
module.exports = __toCommonJS(arenaShopping_exports);
var ARENA_INITIAL_SHOP_DURATION = 30 * 60 * 1e3;
var ARENA_SHOP_DURATION = 60 * 60 * 1e3;
var INITIATIVE_DURATION = 5 * 60 * 1e3;
function beginTournamentShopping(existingMatches, firstMatches, now) {
  return {
    matches: (existingMatches || []).filter((m) => m.kind === "fun"),
    phase: "shopping",
    currentRound: 1,
    tournamentWinner: null,
    shopEndsAt: new Date(now + ARENA_INITIAL_SHOP_DURATION).toISOString(),
    initialShopping: true,
    pendingNextRound: 1,
    pendingNextMatches: firstMatches
  };
}
function promoteArenaShopping(data, now, force = false) {
  if (data.phase !== "shopping") return null;
  const end = data.shopEndsAt?.toMillis ? data.shopEndsAt.toMillis() : Date.parse(data.shopEndsAt);
  if (!force && (!Number.isFinite(end) || now < end)) return null;
  const existing = Array.isArray(data.matches) ? data.matches : [];
  const ids = new Set(existing.map((m) => m.matchId));
  const pending = Array.isArray(data.pendingNextMatches) ? data.pendingNextMatches : [];
  const added = pending.filter((m) => !ids.has(m.matchId)).map((m) => m.status === "initiative" && !m.readyCheck ? { ...m, turnExpiry: new Date(now + INITIATIVE_DURATION).toISOString() } : m);
  return {
    matches: [...existing, ...added],
    currentRound: data.pendingNextRound || (data.currentRound || 1) + (pending.length ? 1 : 0),
    phase: "combat",
    shopEndsAt: null,
    initialShopping: false,
    pendingNextMatches: null,
    pendingNextRound: null
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ARENA_INITIAL_SHOP_DURATION,
  ARENA_SHOP_DURATION,
  beginTournamentShopping,
  promoteArenaShopping
});
