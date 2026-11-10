const assert = require("node:assert/strict");
const { buildSync } = require("esbuild");
const Module = require("node:module");

(async () => {
  const shopping = await import("../src/data/arenaShopping.js");
  const { subclassToMount } = await import("../src/data/arenaSubclasses.js");
  const server = require("../functions/arenaShopping.js");
  const compiled = buildSync({ entryPoints: ["src/pages/arena/arenaCore.jsx"], bundle: true, platform: "node", format: "cjs", write: false });
  const mod = new Module("arena-core-test");
  mod._compile(compiled.outputFiles[0].text, "arena-core-test.cjs");
  const { reloadoutBlockReason } = mod.exports;
  const now = Date.parse("2026-11-10T12:00:00Z");
  const fun = { matchId: "fun", kind: "fun" };

  for (const count of [2, 3, 5, 6]) {
    const participants = Array.from({ length: count }, (_, i) => `p${i}`);
    const first = [{ matchId: count === 2 ? "final" : "GA_R1_M0", kind: count === 2 ? "final" : "group", status: "initiative", readyCheck: true, turnExpiry: null, players: participants.slice(0, 2).map(id => ({ id })) }];
    const patch = shopping.beginTournamentShopping([fun], first, now);
    const meta = { ...patch, participants, characterSnapshots: Object.fromEntries(participants.map(id => [id, { class: "Fighter" }])) };
    assert.equal(Date.parse(patch.shopEndsAt) - now, 30 * 60000);
    assert.deepEqual(patch.matches, [fun]);
    for (const uid of participants) assert.equal(reloadoutBlockReason(meta, uid), null, `Assetto disponibile anche per il bye: ${uid}`);
    assert.equal(shopping.promoteArenaShopping(meta, now + 30 * 60000 - 1), null);
    const promoted = shopping.promoteArenaShopping(meta, now + 30 * 60000);
    assert.equal(promoted.currentRound, 1);
    assert.equal(promoted.matches.length, 2);
    assert.equal(promoted.matches[1].turnExpiry, null);
    assert.equal(shopping.promoteArenaShopping({ ...meta, ...promoted }, now + 31 * 60000), null);
    assert.deepEqual(server.promoteArenaShopping(meta, now + 30 * 60000), promoted);
    assert.equal(shopping.promoteArenaShopping(meta, now, true).phase, "combat");
    const weekly = { weekKey: "test", subclasses: { fighter: "campione" } };
    const offer = subclassToMount(meta, "p0", weekly, "test");
    assert.equal(offer, "campione");
  }

  assert.equal(shopping.ARENA_SHOP_DURATION, 60 * 60000);
  const later = { phase: "shopping", currentRound: 1, pendingNextRound: 2, shopEndsAt: new Date(now + shopping.ARENA_SHOP_DURATION).toISOString(), matches: [], pendingNextMatches: [{ matchId: "bots", status: "initiative", turnExpiry: "old" }] };
  assert.equal(shopping.promoteArenaShopping(later, now + 59 * 60000), null);
  const promoted = shopping.promoteArenaShopping(later, now + 60 * 60000);
  assert.equal(promoted.currentRound, 2);
  assert.equal(Date.parse(promoted.matches[0].turnExpiry), now + 65 * 60000);
  const duplicate = shopping.promoteArenaShopping({ ...later, matches: later.pendingNextMatches }, now + 60 * 60000);
  assert.equal(duplicate.matches.length, 1);
  console.log("OK: preparazione 30 minuti, iscritti pari/dispari e bye, finale diretta, sottoclasse immediata, pause successive 1 ora, timer bot e promozione idempotente client/server.");
})().catch(err => { console.error(err); process.exitCode = 1; });
