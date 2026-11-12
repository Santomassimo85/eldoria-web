const assert = require("node:assert/strict");
const segrete = require("../functions/segreteBundle.js");

// 1) Verifica che La Torre di Vethrik sia presente nei dungeon di default con 100 piani
const dungeons = segrete.mergeDungeons([]);
const tower = dungeons.find((d) => d.key === segrete.TOWER_KEY);
assert.ok(tower, "La Torre di Vethrik deve esistere in mergeDungeons");
assert.equal(tower.isTower, true);
assert.equal(tower.floors, 100);
assert.equal(segrete.isTowerDungeon("torre_vethrik"), true);
assert.equal(segrete.isTowerDungeon("segrete"), false);

// 2) Verifica Sigillo della Torre (in Bottega a 900 monete, max 1/giorno) e oggetti unici towerOnly (MAI in Bottega)
const sigillo = segrete.itemOf("sigillo_vethrik");
assert.ok(sigillo, "sigillo_vethrik deve esistere");
assert.equal(sigillo.price, 900);
assert.equal(segrete.dailyLimit("sigillo_vethrik"), 1);
assert.ok(segrete.SHOP_ITEMS.includes("sigillo_vethrik"), "sigillo_vethrik deve essere acquistabile in Bottega");

for (const id of ["essenza_vethrik", "lacrima_vethrik", ...segrete.TOWER_GEAR_IDS]) {
  const it = segrete.itemOf(id);
  assert.ok(it, `${id} deve esistere`);
  assert.equal(it.towerOnly, true, `${id} deve essere towerOnly`);
  assert.equal(segrete.SHOP_ITEMS.includes(id), false, `${id} NON deve mai comparire nella Bottega`);
}

// 3) Verifica stato settimanale e Sigilli (3 gratis a settimana + zaino)
const st0 = segrete.towerStatusOf({}, "2026-11-09");
assert.equal(st0.freeLeft, 3);
assert.equal(st0.canOpen, true);
assert.equal(st0.floor, 0);

const stUsed3 = segrete.towerStatusOf({
  storyTower: { weekKey: "2026-11-09", usedFree: 3, floor: 12, bestWeekFloor: 12, allTimeBest: 25 },
  storyBag: { sigillo_vethrik: 0 },
}, "2026-11-09");
assert.equal(stUsed3.freeLeft, 0);
assert.equal(stUsed3.canOpen, false);
assert.equal(stUsed3.floor, 12);

const stWithBagKey = segrete.towerStatusOf({
  storyTower: { weekKey: "2026-11-09", usedFree: 3, floor: 12 },
  storyBag: { sigillo_vethrik: 2 },
}, "2026-11-09");
assert.equal(stWithBagKey.freeLeft, 0);
assert.equal(stWithBagKey.bagKeys, 2);
assert.equal(stWithBagKey.canOpen, true);

// 4) Verifica auto-generazione dei piani (temi diversi, boss ogni 5 piani, difficoltà crescente indipendente dal livello eroe)
const bestiary = segrete.mergeMonsters([]);
const run = segrete.newRun({
  room: { id: "r_tower", type: "torre_vethrik", weekKey: "2026-11-09", startKey: 1000, difficulty: "facile" },
  heroes: [{
    uid: "u1",
    name: "Orpheus",
    cls: "fighter",
    avatar: "",
    hero: { stats: { str: 3, dex: 1, con: 2, int: 0, wis: 0, cha: 0 }, picks: ["secondo_fiato"], weapon: "spada_lunga", armor: "cotta_maglia", shield: true, race: "human", xp: 0, xpv: segrete.XP_VERSION },
  }],
  bestiary,
  dungeon: tower,
  now: 1000,
});

assert.equal(run.isTower, true);
assert.equal(run.floors, 100);
assert.equal(run.floor, 1);
assert.equal(run.boss, false);
assert.ok(run.floorTheme, "Il Piano 1 deve avere un floorTheme generato");

const floor1Hp = run.foes.reduce((t, f) => t + f.maxHp, 0);

// Simula il superamento dei primi 5 piani
for (let f = 1; f <= 5; f++) {
  assert.equal(run.floor, f);
  assert.equal(run.boss, f % 5 === 0, `Piano ${f}: boss deve essere ${f % 5 === 0}`);
  const prevTheme = run.floorTheme;
  // Sconfiggi i nemici del piano
  run.foes.forEach((foe) => { foe.hp = 1; });
  // Usa Lacrima di Vethrik o attacco per chiudere il piano
  segrete.useItem(run, "u1", { itemId: "fuoco_alch", targetId: run.foes[0].id }, 2000 + f);
  if (run.status === "fight") {
    // Finisci eventuali nemici rimasti
    run.foes.forEach((foe) => { foe.hp = 0; });
    segrete.useItem(run, "u1", { itemId: "lacrima_vethrik" }, 2500 + f);
  }
  assert.equal(run.status, "cleared", `Piano ${f} deve risultare cleared`);
  assert.equal(run.towerCleared, f);
  assert.ok(run.towerXp > 0, "I PE della Torre devono accumularsi a ogni piano");
  assert.equal(Object.keys(run.spoils || {}).length, 0, "Nessun drop normale di monete/oggetti nei piani della Torre");
  if (f < 5) {
    segrete.nextFloor(run, bestiary, 3000 + f);
    assert.notEqual(run.floorTheme, prevTheme, "Il tema visivo della stanza deve cambiare da un piano al successivo");
  }
}

// Verifica che al piano 50 i nemici siano molto più forti che al piano 1 anche se l'eroe è Lv 1
run.status = "cleared";
run.floor = 49;
segrete.nextFloor(run, bestiary, 9000);
assert.equal(run.floor, 50);
assert.equal(run.boss, true, "Il Piano 50 è una sala del Guardiano (multiplo di 5)");
const floor50Hp = run.foes.reduce((t, f) => t + f.maxHp, 0);
assert.ok(floor50Hp > floor1Hp * 3, `I PF al Piano 50 (${floor50Hp}) devono essere molto più alti del Piano 1 (${floor1Hp})`);

// 5) Verifica Essenza di Vethrik (+35% PE per 3 dungeon)
const drank = segrete.drinkXpPotion({ storyBag: { essenza_vethrik: 1 } }, "essenza_vethrik");
assert.equal(drank.boost.pct, 35);
assert.equal(drank.boost.runs, 3);

// 6) Verifica Premi Unici Domenicali per ogni fascia di piano (incluso il Piano 100)
const r3 = segrete.towerRewardForFloor(3, {});
assert.equal(r3.tierName, "Iniziato della Torre");
assert.equal(r3.coins, 75);
assert.equal(r3.items.pozione_exp_10, 1);

const r7 = segrete.towerRewardForFloor(7, {});
assert.equal(r7.tierName, "Esploratore del Pendolo");
assert.equal(r7.coins, 150);
assert.equal(r7.items.essenza_vethrik, 1);

const r20 = segrete.towerRewardForFloor(20, {});
assert.equal(r20.tierName, "Spezzasigilli");
const gear20 = Object.keys(r20.items).filter((id) => segrete.TOWER_GEAR_IDS.includes(id));
assert.equal(gear20.length, 2, "Al Piano 20 si ottiene 1 reliquia unica +2 di Vethrik");

const r100 = segrete.towerRewardForFloor(100, {});
assert.equal(r100.tierName, "Conquistatore di Vethrik");
assert.equal(r100.coins, 2000);
const gear100 = Object.entries(r100.items).filter(([id]) => segrete.TOWER_GEAR_IDS.includes(id)).reduce((t, [, n]) => t + n, 0);
assert.equal(gear100, 8, "Al Piano 100 si ricevono 3 reliquie uniche +2 di Vethrik");

// Soglie cumulative, classe registrata, varianti equipaggiabili e nessuna vendita in Bottega.
for (const [cls, base] of Object.entries(segrete.TOWER_ARMOR_BY_CLASS)) {
  for (const floor of [19, 20, 39, 40, 59, 60, 79, 80, 99, 100]) {
    const reward = segrete.towerRewardForFloor(floor, { storyChars: { fighter: {}, wizard: {}, [cls]: {} }, storyTower: { cls } }, () => 0);
    const armorIds = Object.keys(reward.items).filter(id => segrete.itemOf(id).towerMilestone);
    assert.equal(armorIds.length, Math.floor(floor / 20), `${cls} al piano ${floor}`);
    for (const id of armorIds) {
      const armor = segrete.itemOf(id);
      assert.equal(armor.base, base);
      assert.ok(segrete.canWear(cls, armor.base));
      assert.ok(armor.res.length > 0);
      assert.equal(segrete.SHOP_ITEMS.includes(id), false);
    }
  }
}
assert.equal(segrete.towerEffectiveLevel(1), 2);
assert.equal(segrete.towerEffectiveLevel(30), 8);
for (let floor = 2; floor <= 100; floor++) assert.ok(segrete.towerEffectiveLevel(floor) >= segrete.towerEffectiveLevel(floor - 1));
// Stesso piano e stessi dadi: identica sfida per 1/2/4 eroi, anche sotto livello.
function encounterAt(floor, count, level) {
  const state = JSON.parse(JSON.stringify(run));
  state.heroes = Array.from({ length: count }, (_, i) => ({ ...state.heroes[0], id: `h${i}`, uid: `u${i}`, level, fled: false, maxHp: 20 + level * 7, hp: 20 + level * 7 }));
  state.party = count;
  state.floor = floor - 1;
  state.status = "cleared";
  let seed = 7349;
  segrete.withRng(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }, () => segrete.nextFloor(state, bestiary, 12000));
  return state.foes.map(f => ({ name: f.name, role: f.role, maxHp: f.maxHp, ac: f.ac, save: f.save, cap: f.cap }));
}
for (const floor of [1, 10, 20, 30, 60, 100]) {
  const reference = encounterAt(floor, 4, 8);
  for (const count of [1, 2, 4]) {
    for (const level of [1, 8, 20]) assert.deepEqual(encounterAt(floor, count, level), reference, `Piano ${floor}, ${count} eroi Lv ${level}`);
  }
  assert.ok(reference.length >= (floor % 5 === 0 ? 3 : 4));
}
console.log("test-segrete-tower: OK");
