const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
const E = require('../functions/segreteBundle.js');
function load(file) {
  const code = esbuild.buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const mod = new Module(file, module); mod._compile(code, file); return mod.exports;
}
const { CrawlerEngine, thrustArmPoint } = load('src/fx/crawlerEngine.js');
const A = load('src/fx/crawlerArt.js');
const K = load('src/data/segreteKits.js');
function strikes(cls, weapon, actionId, rng = 0.5, level = 3) {
  const s = E.withRng(() => 0.5, () => E.newRun({ room: { type: 'segrete' }, heroes: [{ uid: 'one', name: 'Hero', cls, hero: { weapon, picks: ['ki', 'stordente'], xp: K.xpForLevel(level), xpv: 2 } }], bestiary: [], dungeon: { name: 'Test', floors: 1 }, now: 1000 }));
  s.foes = [{ id: 'f_test', side: 'f', name: 'Target', hp: 1000, maxHp: 1000, ac: 5, fx: {}, res: [], imm: [], vul: [] }];
  s.order = []; s.acted = {}; s.status = 'fight';
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
for (let level = 1; level <= 20; level++) {
  const sneak = strikes('rogue', 'pugnali', 'furtivo', 0.5, level);
  assert.equal(sneak.length, 1);
  assert.equal(sneak[0].dmg, 3 + 4 * Math.ceil(level / 2));
  assert.equal(sneak[0].fx, 'thrust');
}
const engine = Object.create(CrawlerEngine.prototype);
engine.calm = false; engine.offKind = 'none';
engine.mainWeapon = 'pugnali';
engine.attack('thrust', { hand: 'R' });
assert.equal(engine.act.kind, 'daggerThrust');
engine.act.t0 = performance.now() - 280;
const stab = engine.moveNow();
assert.ok(stab.R.rot < -0.5 && stab.R.s < 1);
assert.ok(stab.R.sy > 1.1 && stab.R.sx < 0.9 && stab.R.dy < -40);
const pinned = thrustArmPoint(100, 50, 150, 200, stab.R, 230, 250, 1, 1, 1);
assert.deepEqual(pinned, { x: 250, y: 250 });
const wrist = thrustArmPoint(100, 50, 150, 200, stab.R, 230, 250, 1, 0.6, 0.6);
assert.ok(wrist.y < 170);
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
