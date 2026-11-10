const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
function load(file) {
  const code = esbuild.buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const mod = new Module(file, module); mod._compile(code, file); return mod.exports;
}
const K = load('src/data/segreteKits.js');
const A = load('src/fx/crawlerArt.js');
const E = require('../functions/segreteBundle.js');
for (const cls of ['fighter', 'paladin']) {
  assert.ok(K.armorChoices(cls).includes('piastre'));
  assert.ok(K.armorChoices(cls).includes('scaglie'));
  assert.equal(K.heroDefense(cls, { dex: 3 }, { armor: 'piastre', shield: true }).ac, 20);
}
for (const cls of ['rogue', 'cleric', 'ranger', 'monk', 'wizard', 'druid']) assert.ok(!K.canWear(cls, 'piastre'));
assert.equal(K.weaponOf('rogue', 'scimitarra').key, 'pugnali');
assert.ok(!K.WEAPON_CHOICES.rogue.includes('scimitarra'));
const actions = K.heroActions('rogue', 1, [], 'pugnali');
assert.equal(K.attacksOf('rogue', 1, actions[0]), 2);
assert.equal(actions[0].dice, '1d4');
assert.equal(actions.find(a => a.id === 'mirato').uses, 3);
for (let lv = 1; lv <= 20; lv++) assert.equal(K.sneakDiceOf(lv), Math.ceil(lv / 2));
assert.equal(A.handSpec({ cls: 'rogue' }, 'pugnali', false).off, 'mirror');
const hands = A.handEntries({ ...K, ITEMS: {} });
const daggers = hands.find(e => e.base === 'pugnali');
assert.equal(daggers.key, 'pugnali~mirror');
assert.match(A.handPrompt(daggers), /SECOND matching short dagger/);
function attack(armor, rng, adv = false) {
  const s = E.withRng(() => 0.5, () => E.newRun({ room: { type: 'segrete' }, heroes: [{ uid: 'one', name: 'Hero', cls: 'paladin', hero: { armor } }], bestiary: [], dungeon: { name: 'Test', floors: 1 }, now: 1000 }));
  const h = s.heroes[0];
  if (adv) h.fx.adv = 99;
  s.foes = [{ id: 'f_test', side: 'f', name: 'Target', hp: 1000, maxHp: 1000, ac: 15, fx: {}, res: [], imm: [], vul: [] }];
  s.order = []; s.acted = {}; s.status = 'fight';
  E.withRng(() => rng, () => E.act(s, 'one', { actionId: 'arma', targetId: 'f_test' }, 2000));
  return s.log.find(l => l.actor === h.id && ['hit', 'miss', 'crit'].includes(l.kind));
}
assert.doesNotMatch(attack('piastre', 0.49).txt, /ingombro/);
assert.match(attack('piastre', 0.60).txt, /ingombro: -1/);
assert.match(attack('piastre', 0.80).txt, /ingombro: svantaggio/);
assert.equal(attack('piastre', 0.80).roll.dice.length, 2);
assert.equal(attack('piastre', 0.80, true).roll.dice.length, 1);
assert.doesNotMatch(attack('scaglie', 0.80).txt, /ingombro/);
console.log('Segrete gear: class permissions, legacy rogue, two daggers, admin prompts and all armor penalty branches passed.');
