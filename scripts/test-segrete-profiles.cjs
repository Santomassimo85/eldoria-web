const assert = require("node:assert/strict");
const { buildSync } = require("esbuild");
const Module = require("node:module");
const compiled = buildSync({ entryPoints: ["src/data/segreteEngine.js"], bundle: true, platform: "node", format: "cjs", write: false });
const moduleUnderTest = new Module("segrete-profile-engine");
moduleUnderTest._compile(compiled.outputFiles[0].text, "segrete-profile-engine.cjs");
const E = moduleUnderTest.exports;
const server = require("../functions/segreteBundle.js");

(async () => {
  const { DUNGEON_PROFILES, NEUTRAL_DUNGEON, dungeonProfile, runProfile, applyDungeonDefenses, dungeonDropContext } = await import("../src/data/segreteProfiles.js");
  const itemsCode = buildSync({ entryPoints: ["src/data/segreteItems.js"], bundle: true, platform: "node", format: "cjs", write: false });
  const itemsModule = new Module("profile-items");
  itemsModule._compile(itemsCode.outputFiles[0].text, "profile-items.cjs");
  const I = itemsModule.exports;
  function make(key, party = 2, extra = {}) {
    return E.withRng(() => 0.5, () => E.newRun({ room: { type: key, difficulty: "facile" },
      heroes: Array.from({ length: party }, (_, i) => ({ uid: `p${i}`, name: `Hero ${i}`, cls: "fighter", hero: {} })),
      bestiary: [], dungeon: { key, name: key, floors: 3, ...extra }, now: 1000 }));
  }
  const baseline = make("segrete"), cavern = make("caverna"), abyss = make("abisso");
  assert.ok(cavern.foes.length > baseline.foes.length, "La Caverna ha davvero più nemici");
  assert.ok(abyss.foes.reduce((n, f) => n + f.maxHp, 0) > baseline.foes.reduce((n, f) => n + f.maxHp, 0), "Il budget non normalizza via il pericolo");
  for (const P of DUNGEON_PROFILES) {
    for (const party of [1, 2, 4]) {
      const run = make(P.key, party);
      assert.equal(run.dungeonRules.key, P.key);
      assert.ok(run.foes.length <= 5);
      assert.ok(run.foes.every(f => f.hp > 0 && Number.isFinite(f.cap.dmg)));
      for (const type of P.res) assert.ok(run.foes.every(f => f.res.includes(type) || f.imm.includes(type) || f.vul.includes(type)));
      if (P.metal) assert.ok(run.foes.every(f => f.metalProtection));
      assert.equal(server.xpGain(1, 3, "medio", party, P), E.xpGain(1, 3, "medio", party, P));
    }
    assert.ok(E.xpGain(1, 3, "facile", 2, P) >= E.xpGain(1, 3, "facile", 2));
    assert.ok(P.treasure.every(id => I.itemOf(id)), `${P.key}: oggetti reali`);
  }
  const overridden = make("caverna", 2, { challengeProfile: "forgia" });
  assert.equal(overridden.dungeonRules.key, "forgia");
  assert.equal(dungeonProfile({ key: "abisso", challengeProfile: "neutro" }), NEUTRAL_DUNGEON);
  assert.equal(runProfile({ type: "abisso" }), NEUTRAL_DUNGEON, "Vecchie partite senza bonus retroattivi");
  const defended = applyDungeonDefenses({ imm: ["cold"], res: ["fire"], vul: [] }, { ...NEUTRAL_DUNGEON, res: ["cold"], vul: ["fire"] });
  assert.deepEqual(defended.res, ["fire"]);
  assert.deepEqual(defended.vul, []);
  function chest(key) {
    const run = make(key);
    run.status = "treasure"; run.foes = [];
    E.withRng(() => 0.5, () => E.openChest(run, "p0", 2000));
    return run;
  }
  const ordinary = chest("custom"), themed = chest("abisso");
  assert.equal(themed.chest.items.length, ordinary.chest.items.length + 1);
  assert.ok(themed.chest.items.some(it => themed.dungeonRules.treasure.includes(it.id)));
  assert.ok(themed.chest.coins > ordinary.chest.coins);
  assert.throws(() => E.openChest(themed, "p0", 3000));
  const p = dungeonProfile({ key: "forgia" });
  const baseWeights = new Map(I.dropWeights({ dungeon: "forgia" }));
  const favoredWeights = new Map(I.dropWeights({ dungeon: "forgia", ...dungeonDropContext(p) }));
  assert.equal(favoredWeights.get("acido"), baseWeights.get("acido") * 3);
  console.log("OK: nove profili, gruppi 1/2/4, numero nemici e budget reali, difese senza conflitti, XP server, premi tematici e probabilità, admin override, vecchie partite e scrigno singolo.");
})().catch(e => { console.error(e); process.exitCode = 1; });
