const assert = require('node:assert/strict'), { buildSync } = require('esbuild'), Module = require('node:module');
function compile(file) { const m = new Module(file); m._compile(buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text, file); return m.exports; }
const E = compile('src/data/segreteEngine.js'), K = compile('src/data/segreteKits.js');
function run(lv = 5, size = 2) {
  return E.withRng(() => .5, () => E.newRun({ room: { type: 'segrete' },
    heroes: Array.from({ length: size }, (_, i) => ({ uid: i ? `ally${i}` : 'pal', name: i ? 'Amico' : 'Paladino', cls: i ? 'fighter' : 'paladin', hero: { xp: K.xpForLevel(lv), xpv: 2, picks: ['punizione', 'cura_p'], stats: { str: 3, cha: 3, con: 2 } } })),
    bestiary: [], dungeon: { name: 'Test', floors: 3 }, now: 1 }));
}
const cast = (s, amount, target = 'h_ally1', actionId = 'mani') => { s.acted = {}; return E.withRng(() => .5, () => E.act(s, 'pal', { actionId, targetId: target, amount }, 2)); };
for (const lv of [1, 4, 5, 10]) for (const n of [1, 2, 4]) {
  const s = run(lv, n), h = s.heroes[0];
  assert.equal(h.healingPoolMax, h.maxHp + lv * 2);
  assert.equal(h.healingPool, h.healingPoolMax);
}
{
  const s = run(), h = s.heroes[0], ally = s.heroes[1], max = h.healingPool;
  ally.hp -= 15; h.hp -= 15;
  const hp = ally.hp; cast(s, 5);
  assert.equal(ally.hp, hp + 5); assert.equal(h.healingPool, max - 5);
  assert.equal(E.heroActionList(h).find(a => a.id === 'mani').left, max - 5);
  const selfHp = h.hp; cast(s, undefined, h.id, 'cura_p');
  // 1d8 con rng 0.5 => 5, + 2 * cha(3) = 11 PF curati, senza toccare la riserva di Imposizione delle Mani
  assert.equal(h.hp, selfHp + 11); assert.equal(h.healingPool, max - 5);
  assert.equal(E.heroActionList(h).find(a => a.id === 'cura_p').left, 1);
  s.status = 'cleared'; E.withRng(() => .5, () => E.nextFloor(s, [], 3));
  assert.equal(h.healingPool, max - 5, 'Il cambio sala non ricarica la riserva');
  assert.equal(E.heroActionList(h).find(a => a.id === 'cura_p').left, 2, 'Il cambio sala ricarica Cura Ferite');
}
{
  const s = run(), h = s.heroes[0], ally = s.heroes[1];
  ally.hp = ally.maxHp - 2; const before = h.healingPool;
  cast(s, 10); assert.equal(h.healingPool, before - 2); assert.equal(ally.hp, ally.maxHp);
  ally.hp = 0; cast(s, 3); assert.equal(ally.hp, 3, 'Puoi rialzare un alleato');
  h.healingPool = 0; const hp = ally.hp;
  assert.throws(() => cast(s, 1), /riserva/); assert.equal(ally.hp, hp);
}
for (const amount of [undefined, 0, -1, 1.5, Infinity, 999999]) {
  const s = run(); s.heroes[1].hp -= 10; const pool = s.heroes[0].healingPool;
  assert.throws(() => cast(s, amount)); assert.equal(s.heroes[0].healingPool, pool); assert.ok(!s.acted.h_pal);
}
{
  const s = run(); s.heroes[1].hp -= 10;
  assert.throws(() => cast(s, 2, 'f0'), /alleato/);
  delete s.heroes[0].healingPool; delete s.heroes[0].healingPoolMax; s.heroes[0].uses.mani = 0;
  const max = s.heroes[0].maxHp + s.heroes[0].level * 2; cast(s, 2);
  assert.equal(s.heroes[0].healingPool, max - 2, 'Compatibilità con partite esistenti');
}
for (const lv of [1, 5]) for (const immune of ['', 'slashing', 'radiant']) {
  const s = run(lv), f = s.foes[0]; s.foes = [f]; f.hp = f.maxHp = 10000; f.ac = -100; f.res = []; f.vul = []; f.imm = immune ? [immune] : [];
  E.withRng(() => .5, () => E.act(s, 'pal', { actionId: 'punizione', targetId: f.id }, 2));
  const hit = s.log.find(l => l.actor === 'h_pal' && l.kind === 'hit');
  const normal = immune === 'slashing' ? 0 : 8, radiant = immune === 'radiant' ? 0 : lv === 1 ? 10 : 15;
  assert.equal(hit.dr.n, 1, 'Il dado normale dell’arma non cresce insieme al bonus');
  assert.equal(hit.dmg, normal + radiant); assert.equal(hit.el, 'radiant');
}
{
  const s = run(), f = s.foes[0]; s.foes = [f]; f.hp = 1; f.ac = -100; f.imm = []; f.res = []; f.vul = [];
  E.withRng(() => .5, () => E.act(s, 'pal', { actionId: 'punizione', targetId: f.id }, 2));
  assert.equal(s.log.find(l => l.actor === 'h_pal' && l.kind === 'hit').dmg, 23, 'Bonus radioso presente anche sul colpo mortale');
}
console.log('OK: riserva PF massimi+livello, gruppi e livelli, cura scelta e condivisa, solo PF recuperati, nessuna ricarica tra sale, validazione, alleati a terra e arma+radioso separati anche su colpi mortali.');
