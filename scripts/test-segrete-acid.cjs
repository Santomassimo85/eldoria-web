const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
function load(file) {
  const code = esbuild.buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const mod = new Module(file, module); mod._compile(code, file); return mod.exports;
}
const M = load('src/data/segreteMaterials.js');
const K = load('src/data/segreteKits.js');
const E = require('../functions/segreteBundle.js');
for (const name of ['Golem di ferro', 'Automa di rame', 'Iron golem', 'Guardia con cotta di maglia', 'Knight in plate armor', 'Corazza di acciaio']) assert.equal(M.hasMetalProtection({ name }), true, name);
for (const name of ['Golem di pietra', 'Clay golem', 'Golem di carne', 'Bandito con spada di ferro', 'Arciere con armatura di cuoio e arco di acciaio', 'Mimic di legno con fasce di ferro', 'Cuoio Borchiato']) assert.equal(M.hasMetalProtection({ name }), false, name);
assert.equal(M.hasMetalProtection({ name: 'Iron golem', metalProtection: false }), false);
assert.equal(M.hasMetalProtection({ name: 'Guardia', metalProtection: true }), true);
function cast({ cls = 'wizard', actionId = 'acida', metal = false, res = [], vul = [], imm = [], hp = 1000 } = {}) {
  const s = E.withRng(() => 0.5, () => E.newRun({ room: { type: 'segrete' }, heroes: [{ uid: 'one', name: 'Mage', cls, hero: { xp: K.xpForLevel(3), xpv: 2, picks: [actionId] } }], bestiary: [], dungeon: { name: 'Test', floors: 1 }, now: 1000 }));
  s.foes = [{ id: 'f_test', side: 'f', name: 'Target', hp, maxHp: 1000, ac: 5, save: -99, fx: {}, res, vul, imm, metalProtection: metal }];
  s.order = []; s.acted = {}; s.status = 'fight';
  E.withRng(() => 0.5, () => E.act(s, 'one', { actionId, targetId: 'f_test' }, 2000));
  return s.log.find(l => l.actor === s.heroes[0].id && ['hit', 'crit', 'area'].includes(l.kind));
}
const base = cast(), metal = cast({ metal: true });
assert.equal(base.fx, 'acidArrow');
assert.equal(metal.dmg, base.dmg * M.ACID_METAL_MULT);
assert.equal(metal.tags.f_test, 'corrode');
assert.equal(cast({ metal: true, res: ['acid'] }).dmg, Math.floor(metal.dmg / 2));
assert.equal(cast({ metal: true, vul: ['acid'] }).dmg, metal.dmg * 2);
assert.equal(cast({ metal: true, imm: ['acid'] }).dmg, 0);
const lethal = cast({ metal: true, hp: 1 });
assert.equal(lethal.nums.f_test, -metal.dmg);
for (const cls of ['druid', 'bard']) {
  const wave = cast({ cls, actionId: cls === 'bard' ? 'onda_b' : 'onda' });
  assert.equal(wave.fx, 'thunderwave');
  assert.equal(wave.el, 'thunder');
}
for (const [cls, armor, expected] of [['fighter', 'maglia', true], ['rogue', 'cuoio', false], ['wizard', 'abiti', false], ['fighter', 'pelle', false]]) {
  const s = E.withRng(() => 0.5, () => E.newRun({ room: { type: 'segrete' }, heroes: [{ uid: 'one', name: 'Hero', cls, hero: { armor } }], bestiary: [], dungeon: { name: 'Test', floors: 1 }, now: 1000 }));
  assert.equal(s.heroes[0].metalProtection, expected, `${cls}/${armor}`);
}
console.log('Segrete acid: metal bodies/armor, weapon exclusions, overrides, resistance, immunity, vulnerability, lethal numbers and distinct spell effects passed.');
