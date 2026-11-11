const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
let calls = [];
global.__testSpell = (options) => { calls.push(options); return 380; };
let source = fs.readFileSync('src/pages/WorldBossVfx.jsx', 'utf8');
source = source.replace('import { playSpell } from "../fx/spellFx";', 'const playSpell = global.__testSpell;');
source = source.replace('import { shake, recoil, castPose, strikePose, stageOf } from "../fx/hitFeel";', 'const shake = () => {}, recoil = () => {}, castPose = () => {}, strikePose = () => {}, stageOf = () => null;');
source += '\nexport { playCanvas };';
const code = esbuild.buildSync({ stdin: { contents: source, resolveDir: path.resolve('src/pages'), loader: 'jsx' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', define: { 'import.meta.env.DEV': 'false' }, loader: { '.css': 'empty' }, write: false }).outputFiles[0].text;
const filename = path.resolve('thunderwave-test.cjs');
const mod = new Module(filename, module);
mod.paths = module.paths; mod._compile(code, filename);
global.document = { querySelector: (selector) => selector.startsWith('[data-vfx-target=') ? { getBoundingClientRect: () => ({ left: 100, top: 100, width: 90, height: 120, bottom: 220 }) } : null };
for (const targets of [['foe-1'], ['foe-1', 'foe-2', 'foe-3', 'foe-4']]) {
  calls = [];
  const hits = mod.exports.playCanvas({ effect: 'thunderwave', effectEl: 'thunder', effectFrom: 'hero' }, targets);
  assert.equal(calls.length, 1, 'one cast regardless of enemy count');
  assert.equal(calls[0].kind, 'thunderwave');
  assert.equal(calls[0].quiet, true, 'no extra central projectile impact');
  assert.deepEqual(Object.keys(hits), targets);
  assert.ok(Object.values(hits).every((time) => time === 380), 'all targets struck together');
}
console.log('Thunderwave: one screen wave for one or four foes, simultaneous impacts.');
