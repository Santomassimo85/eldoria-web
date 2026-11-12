const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const compiled = buildSync({ stdin: { contents: 'import * as E from "./src/data/segreteEngine"; import * as K from "./src/data/segreteKits"; import * as I from "./src/data/segreteItems"; import * as A from "./src/fx/crawlerArt"; import * as C from "./src/utils/segreteCombat"; export { E, K, I, A, C };', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const mod = new Module('party-skills');
mod._compile(compiled, 'party-skills');
const { E, K, I, A, C } = mod.exports;

for (const kit of Object.values(K.KITS)) for (const a of [...kit.base, ...kit.pool]) {
  if (a.scale) { assert.equal(a.cantrip, true); assert.ok(!a.uses); }
  assert.doesNotMatch(C.actInfo(a, 5), /infinito|competenza|\b8 \+/i);
}
assert.match(C.actInfo(K.KITS.wizard.base.find(a => a.id === 'dardo_fuoco'), 5), /^2d10/);
assert.match(C.actInfo(K.KITS.paladin.base.find(a => a.id === 'abiurazione')), /TS SAG$/);
assert.match(C.actInfo(K.KITS.cleric.pool.find(a => a.id === 'fiamma')), /TS DES$/);

function run(cls, level) {
  return E.withRng(() => .5, () => E.newRun({ room: { type: 'segrete' }, heroes: [
    { uid: 'one', name: 'Eroe', cls, hero: { xp: K.xpForLevel(level) + 50, xpv: 2, stats: { wis: 3, cha: 3 }, picks: [] } },
    { uid: 'two', name: 'Amico', cls: 'fighter', hero: { xp: 0, xpv: 2 } },
  ], bestiary: [], dungeon: { name: 'Test', floors: 3 }, now: 1 }));
}
for (const lv of [1, 2, 3, 8]) {
  const actions = K.heroActions('paladin', lv, ['benedizione']);
  assert.equal(actions.filter(a => a.id === 'benedizione').length, 1);
  assert.equal(K.heroActions('paladin', lv).some(a => a.id === 'benedizione'), lv >= 3);
  assert.equal(actions.some(a => a.id === 'abiurazione'), lv >= 3);
}
assert.ok(!K.poolFor('paladin', 3).some(a => a.id === 'benedizione'));
assert.equal(K.heroPending({ xp: K.xpForLevel(3), xpv: 2, picks: ['benedizione'] }).picks, 2);
{
  const s = run('paladin', 3);
  assert.equal(s.heroes[0].xp, K.xpForLevel(3) + 50);
  E.act(s, 'one', { actionId: 'benedizione' }, 2);
  assert.ok(s.heroes.every(h => h.fx.adv > s.round));
}
for (const cls of ['paladin', 'cleric']) {
  const s = run(cls, cls === 'paladin' ? 3 : 1);
  const f = s.foes[0];
  s.foes = [{ ...f, id: 'undead', name: 'Scheletro', undead: true, save: 0, fx: {} },
    { ...f, id: 'living', name: 'Scheletro meccanico', undead: false, save: 0, fx: {} },
    { ...f, id: 'resists', name: 'Spettro', undead: true, save: 50, fx: {} }];
  const hp = s.foes.map(f => f.hp);
  const actionId = cls === 'paladin' ? 'abiurazione' : 'scaccia_non_morti';
  E.withRng(() => 0, () => E.act(s, 'one', { actionId }, 2));
  assert.equal(s.foes[0].fx.frightened.until, s.round + 3);
  assert.equal(Boolean(s.foes[1].fx.frightened), cls === 'paladin');
  assert.ok(!s.foes[2].fx.frightened);
  assert.deepEqual(s.foes.map(f => f.hp), hp, 'La paura non infligge danni');
  assert.equal(E.heroActionList(s.heroes[0]).find(a => a.id === actionId).left, 0);
}
assert.ok(E.isUndead({ creature: 'non morto', name: 'Custode' }));
assert.ok(E.isUndead({ name: 'Cantore', desc: 'Re scheletrico' }));
assert.ok(!E.isUndead({ creature: 'costrutto', name: 'Scheletro meccanico' }));
assert.ok(!E.isUndead({ name: 'Lupo' }));

const id = 'x_test-veste';
I.registerCustomItems([{ id, name: 'Veste', kind: 'armor', base: 'magica', rarity: 'rare', dungeons: ['caverna', 'tempio', 'palude'] }]);
const context = { dungeon: 'caverna', classes: ['wizard'], rank: 0 };
const weights = I.dropWeights(context, 'boss');
const index = weights.findIndex(([key]) => key === id);
assert.ok(index >= 0 && weights[index][1] > 0);
const total = weights.reduce((sum, [, w]) => sum + w, 0);
const draw = (weights.slice(0, index).reduce((sum, [, w]) => sum + w, 0) + weights[index][1] / 2) / total;
assert.equal(I.rollDropItem(() => draw, context, 'boss'), id);
assert.ok(!I.dropPool({ ...context, dungeon: 'segrete' }).includes(id));
assert.ok(!I.dropPool({ ...context, classes: ['fighter'] }).includes(id));
{
  const s = run('wizard', 3);
  s.type = 'caverna';
  delete s.dungeonRules;
  s.foes = [{ ...s.foes[0], role: 'boss', hp: 0, looted: false }];
  const ctx = { ...context, bases: s.heroes.map(h => h.weapon), classes: s.heroes.map(h => h.cls) };
  const ws = I.dropWeights(ctx, 'boss');
  const at = ws.findIndex(([key]) => key === id);
  const pick = (ws.slice(0, at).reduce((sum, [, w]) => sum + w, 0) + ws[at][1] / 2) / ws.reduce((sum, [, w]) => sum + w, 0);
  const randoms = [0, .99, 0, pick];
  E.withRng(() => randoms.shift() ?? .5, () => E.lootDead(s));
  assert.equal(s.spoils.one.items[id], 1, 'Equip creato assegnato al bottino dal vero percorso di morte del mostro');
}
for (const size of [1, 2, 3, 4]) assert.equal(I.partyDropMultiplier(size), [1, 1.03, 1.05, 1.08][size - 1]);

const size = 32, pixels = new Uint8ClampedArray(size * size * 4);
for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 31 + Math.floor(i / 13)) % 256;
A.blendTileEdges(pixels, size);
for (let p = 0; p < size; p++) for (let c = 0; c < 3; c++) {
  assert.equal(pixels[(p * size) * 4 + c], pixels[(p * size + size - 1) * 4 + c]);
  assert.equal(pixels[p * 4 + c], pixels[((size - 1) * size + p) * 4 + c]);
}
console.log('OK: abilità automatiche, vantaggio al party, TS e paura selettiva di 3 turni, cariche, PE, equip creati nel drop e bordi delle texture continui.');
