const assert = require('node:assert/strict');
const E = require('../functions/segreteBundle.js');

function chestRun() {
  const s = E.withRng(() => 0.5, () => E.newRun({
    room: { type: 'segrete' }, heroes: [{ uid: 'one', name: 'Eroe', cls: 'fighter', hero: {} }],
    bestiary: [], dungeon: { name: 'Test', floors: 1 }, now: 1000,
  }));
  s.status = 'treasure'; s.treasure = true; s.floor = 3; s.foes = [];
  s.spoils = { one: { coins: 17, items: { pozione: 1 } } };
  return s;
}

// Threshold is exactly 10%; ordinary chests still pay immediately.
for (const [r, mimic] of [[0, true], [0.09999, true], [0.10, false], [0.9, false]]) {
  const s = chestRun();
  E.withRng(() => r, () => E.openChest(s, 'one', 2000));
  assert.equal(!!s.mimic, mimic);
  assert.equal(s.status, mimic ? 'fight' : 'won');
  if (mimic) {
    assert.equal(s.chest, undefined);
    assert.equal(s.spoils.one.coins, 17);
    assert.equal(s.foes[0].name, 'Mimic');
    assert.ok(s.foes[0].hp > 0);
    assert.throws(() => E.openChest(s, 'one', 2001));
  }
}

// Defeating the Mimic pays the chest once, without another encounter or floor reward.
{
  const s = chestRun();
  E.withRng(() => 0, () => E.openChest(s, 'one', 2000));
  s.foes[0].hp = 0;
  E.withRng(() => 0.5, () => E.act(s, 'one', { actionId: 'difesa' }, 3000));
  assert.equal(s.status, 'won');
  assert.equal(s.mimic.result, 'won');
  assert.ok(s.chest);
  assert.equal(s.spoils.one.coins, 17 + s.chest.coins);
  assert.throws(() => E.openChest(s, 'one', 4000));
}

// Death against the Mimic preserves all prior spoils and withholds the entire chest.
{
  const s = chestRun();
  E.withRng(() => 0, () => E.openChest(s, 'one', 2000));
  const before = structuredClone(s.spoils);
  s.heroes[0].hp = 1; s.heroes[0].ac = -100;
  E.withRng(() => 0.9, () => E.act(s, 'one', { actionId: 'difesa' }, 3000));
  assert.equal(s.heroes[0].hp, 0);
  assert.equal(s.status, 'won');
  assert.equal(s.mimic.result, 'lost');
  assert.equal(s.chest, undefined);
  assert.deepEqual(s.spoils, before);
}

// The automatic chest opening follows the same Mimic path.
{
  const s = chestRun(); s.chestAt = 1000;
  E.withRng(() => 0, () => E.timeout(s, 100000));
  assert.equal(s.mimic.result, 'fight');
}
console.log('Segrete: Mimic threshold, victory, defeat and automatic opening passed.');
