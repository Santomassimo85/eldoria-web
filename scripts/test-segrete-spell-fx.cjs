const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
let clock = 1000, callbacks = [], draws = 0;
const context = new Proxy({}, { get: (o, key) => o[key] || (key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => { draws++; }), set: (o, key, value) => { o[key] = value; return true; } });
global.performance = { now: () => clock };
global.document = { body: { contains: () => true, appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, getContext: () => context }) };
global.window = { innerWidth: 1000, innerHeight: 700, addEventListener() {} };
global.requestAnimationFrame = (fn) => { callbacks.push(fn); return 1; };
global.matchMedia = () => ({ matches: false });
const file = 'src/fx/spellFx.js';
const code = esbuild.buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const mod = new Module(file, module); mod._compile(code, file);
const { playSpell, fxElement } = mod.exports;
assert.notEqual(fxElement('thunder'), fxElement('lightning'));
for (const reduced of [false, true]) for (const [kind, el, timing] of [['acidArrow', 'acid', 420], ['thunderwave', 'thunder', 380], ['bolt', 'acid', 460], ['cloud', 'poison', null], ['wave', 'arcane', 520]]) {
  global.matchMedia = () => ({ matches: reduced });
  const before = draws;
  const hit = playSpell({ kind, el, from: { x: 200, y: 550, size: 150 }, to: { x: 700, y: 200, size: 120, bottom: 280 } });
  if (timing != null) assert.equal(hit, timing * (reduced ? 0.6 : 1));
  for (let i = 0; i < 160 && callbacks.length; i++) { clock += 25; const frame = callbacks; callbacks = []; frame.forEach(fn => fn(clock)); }
  assert.ok(draws > before, `${kind} did not draw`);
  assert.equal(callbacks.length, 0, `${kind} did not finish`);
}
console.log('Segrete spell FX: acid projectile, corrosive impact, thunder pressure wave, poison, ki wave, impact timing and reduced motion rendered without errors.');
