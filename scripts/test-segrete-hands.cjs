const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
const E = require('../functions/segreteBundle.js');
function load(file) {
  const code = esbuild.buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const mod = new Module(file, module); mod._compile(code, file); return mod.exports;
}
const { CrawlerEngine } = load('src/fx/crawlerEngine.js');
const A = load('src/fx/crawlerArt.js');
const K = load('src/data/segreteKits.js');
function strikes(cls, weapon, actionId, rng = 0.5, level = 3, adv = false, hp = 1000, res = []) {
  const s = E.withRng(() => 0.5, () => E.newRun({ room: { type: 'segrete' }, heroes: [{ uid: 'one', name: 'Hero', cls, hero: { weapon, picks: ['ki', 'stordente'], xp: K.xpForLevel(level), xpv: 2 } }], bestiary: [], dungeon: { name: 'Test', floors: 1 }, now: 1000 }));
  s.foes = [{ id: 'f_test', side: 'f', name: 'Target', hp, maxHp: 1000, ac: 5, fx: {}, res, imm: [], vul: [] }];
  s.order = []; s.acted = {}; s.status = 'fight';
  if (adv) s.heroes[0].fx.adv = 99;
  E.withRng(() => rng, () => E.act(s, 'one', { actionId, targetId: 'f_test' }, 2000));
  return s.log.filter(l => l.actor === s.heroes[0].id && ['hit', 'miss', 'crit'].includes(l.kind));
}
for (const rng of [0, 0.5]) {
  const daggers = strikes('rogue', 'pugnali', 'arma', rng);
  assert.deepEqual(daggers.map(l => l.hand), ['R', 'L']);
  assert.ok(daggers.every(l => !l.unarmed));
  const flurry = strikes('monk', 'bastone', 'raffica', rng);
  assert.deepEqual(flurry.map(l => l.hand), ['L', 'R']);
  assert.ok(flurry.every(l => l.unarmed && l.fx === 'punch'));
}
assert.deepEqual(strikes('monk', 'bastone', 'ki').map(l => l.hand), ['L']);
assert.ok(strikes('monk', 'bastone', 'stordente').every(l => l.hand === 'L' && l.unarmed));
assert.deepEqual(strikes('monk', 'bastone', 'arma').map(l => l.hand), ['R']);
assert.ok(strikes('monk', 'bastone', 'arma').every(l => !l.unarmed));
assert.deepEqual(strikes('rogue', 'pugnali', 'arma').map(l => l.hand), ['R', 'L']);
// Attacco Furtivo automatico (2026-11-10): una volta per round, sul primo colpo a segno, con vantaggio
for (let level = 1; level <= 20; level++) {
  const sneak = strikes('rogue', 'pugnali', 'arma', 0.5, level, true);
  assert.equal(sneak.length, 2);
  assert.equal(sneak[0].dmg, 3 + 4 * Math.ceil(level / 2));
  assert.equal(sneak[1].dmg, 3);
  assert.equal(sneak[0].fx, 'thrust');
  // da solo e senza vantaggio niente furtivo
  assert.ok(strikes('rogue', 'pugnali', 'arma', 0.5, level).every(l => l.dmg === 3));
}
const engine = Object.create(CrawlerEngine.prototype);
engine.calm = false; engine.offKind = 'none';
engine.mainWeapon = 'pugnali';
engine.attack('thrust', { hand: 'R' });
assert.equal(engine.act.kind, 'slash');
for (const hand of ['R', 'L']) {
  engine.attack('thrust', { hand });
  engine.act.t0 = performance.now() - 215;
  const dagger = engine.moveNow();
  engine.mainWeapon = 'spada_lunga';
  engine.attack('slash', { hand });
  engine.act.t0 = performance.now() - 215;
  const sword = engine.moveNow();
  for (const key of ['dx', 'dy', 'rot', 's']) assert.ok(Math.abs(dagger[hand][key] - sword[hand][key]) < 0.1);
  engine.mainWeapon = 'pugnali';
}
for (const res of [[], ['piercing']]) {
  const normal = strikes('rogue', 'pugnali', 'arma', 0.5, 3, false, 1000, res)[0];
  const lethal = strikes('rogue', 'pugnali', 'arma', 0.5, 3, false, 1, res)[0];
  assert.equal(lethal.dmg, normal.dmg);
  assert.equal(lethal.nums.f_test, -normal.dmg);
  assert.ok(lethal.kill.includes('f_test'));
}
engine.act = { kind: 'punch', hand: 'L', unarmed: true, t0: performance.now() - 170, ms: 340 };
let mv = engine.moveNow();
assert.ok(mv.L.dx > 60 && mv.L.s > 1.3);
assert.equal(mv.R.dx, 0);
engine.act = { kind: 'punch', hand: 'R', unarmed: true, t0: performance.now() - 170, ms: 340 };
mv = engine.moveNow();
assert.ok(mv.R.dx < -60 && mv.R.s > 1.3);
assert.equal(mv.L.dx, 0);
// Unarmed attacks draw fists instead of the equipped two-handed staff; then restore it.
const drawn = [];
engine.ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale'].map(k => [k, () => {}]));
engine.ctx.drawImage = img => drawn.push(img.id);
engine.cam = { bob: 0 };
engine.hands = { R: { id: 'staff', width: 100, height: 100 } };
engine.fists = { R: { id: 'right-fist', width: 100, height: 100 }, L: { id: 'left-fist', width: 100, height: 100 }, mirrorL: true };
engine.drawHands();
assert.deepEqual(drawn, ['left-fist', 'right-fist']);
drawn.length = 0; engine.act = null; engine.drawHands();
assert.deepEqual(drawn, ['staff']);
engine.calm = true;
engine.act = { kind: 'punch', hand: 'L', unarmed: true, t0: performance.now() - 100, ms: 60 };
engine.moveNow();
assert.equal(engine.act, null);
assert.equal(A.handSpec({ cls: 'monk' }, 'pugni', false).off, 'mirror');
const fists = A.handEntries({ ...K, ITEMS: {} }).find(e => e.base === 'pugni');
assert.equal(fists.key, 'pugni~mirror');
assert.match(A.handPrompt(fists), /no weapon: both fists clenched/);
console.log('Segrete hands: right/left daggers, left/right monk fists, misses, single punch, movement and staff restoration passed.');
