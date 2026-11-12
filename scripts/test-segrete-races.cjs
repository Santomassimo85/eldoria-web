const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const output = buildSync({ stdin: { contents: 'import * as E from "./src/data/segreteEngine"; import * as K from "./src/data/segreteKits"; import * as R from "./src/data/segreteRaces"; import * as A from "./src/fx/crawlerArt"; import * as I from "./src/data/segreteItems"; export { E, K, R, A, I };', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const compiled = new Module('races'); compiled._compile(output, 'races');
const { E, K, R, A, I } = compiled.exports;

for (const [race, def] of Object.entries(R.RACES)) {
  const raceStats = def.stats.slice(0, def.count);
  const hero = { xp: 0, xpv: 2, stats: { str: 3, con: 2 }, race, raceStats };
  assert.ok(R.hasRace(hero));
  const stats = K.heroStats(hero), base = K.heroStats(hero, false);
  for (const stat of K.STAT_KEYS) assert.equal(stats[stat], base[stat] + (raceStats.includes(stat) ? 1 : 0));
  const first = R.chooseHeroRace({ storyCoins: 0, storyChars: { fighter: { stats: {} } } }, 'fighter', race, raceStats);
  assert.equal(first.cost, 0);
  const same = R.chooseHeroRace({ storyCoins: 0, storyChars: { fighter: hero } }, 'fighter', race, [...raceStats].reverse());
  assert.equal(same.cost, 0, 'Una richiesta ripetuta identica non addebita due volte');
}
for (const raceStats of [[], ['str'], ['str', 'str'], ['str', 'fake'], ['str', 'dex', 'con']]) {
  assert.ok(!R.hasRace({ race: 'human', raceStats }));
  assert.throws(() => R.chooseHeroRace({ storyChars: { fighter: {} } }, 'fighter', 'human', raceStats));
}
assert.ok(!R.hasRace({}));
const human = { race: 'human', raceStats: ['str', 'dex'], stats: { str: 3 }, asi: { str: 2 } };
assert.equal(K.heroStats(human).str, 6, 'Il bonus razziale resta aggiuntivo anche al limite dei punti normali');
const data = { storyCoins: 2500, storyChars: { fighter: human } };
const change = R.chooseHeroRace(data, 'fighter', 'elf', ['wis']);
assert.equal(change.cost, 1000); assert.equal(change.coins, 1500);
assert.throws(() => R.chooseHeroRace({ ...data, storyCoins: 999 }, 'fighter', 'orc', ['str']), /1000/);
assert.equal(R.chooseHeroRace(data, 'fighter', 'human', ['str', 'con']).cost, 1000, 'Cambiare solo i bonus costa come cambiare razza');
assert.deepEqual(data.storyChars.fighter, human, 'La scelta non altera i dati letti dalla transazione');

function run(race, cls = 'fighter', size = 2) {
  const def = R.RACES[race];
  return E.withRng(() => .5, () => E.newRun({ room: { type: 'segrete' }, heroes: Array.from({ length: size }, (_, i) => ({
    uid: i ? 'two' : 'one', name: i ? 'Amico' : 'Eroe', cls: i ? 'fighter' : cls,
    hero: { xp: K.xpForLevel(3), xpv: 2, stats: { str: 3, wis: 3 }, race: i ? 'human' : race, raceStats: i ? ['str', 'dex'] : def.stats.slice(0, def.count) },
  })), bestiary: [], dungeon: { name: 'Test', floors: 3 }, now: 1 }));
}
for (const race of Object.keys(R.RACES)) {
  const h = run(race).heroes[0];
  assert.equal(h.race, race);
  assert.equal(h.size, race === 'halfling' ? 'small' : 'medium');
}
function strike(race, chance, fraction = 1, spell = false) {
  const s = run(race, spell ? 'wizard' : 'fighter'), h = s.heroes[0], f = s.foes[0];
  s.foes = [f]; f.hp = f.maxHp = 10000; f.ac = -100; f.res = []; f.imm = []; f.vul = [];
  h.hp = h.maxHp * fraction;
  E.withRng(() => chance, () => E.act(s, 'one', { actionId: spell ? 'dardo_fuoco' : 'arma', targetId: f.id }, 2));
  return s.log.find(l => l.actor === h.id && ['hit', 'crit', 'miss'].includes(l.kind));
}
assert.equal(strike('halfling', .02).roll.dice.length, 2);
assert.equal(strike('halfling', .5).roll.dice.length, 1);
assert.equal(strike('halfling', .02, 1, true).roll.dice.length, 1, 'La fortuna non si applica agli incantesimi');
const healthy = strike('orc', .1, 1), wounded = strike('orc', .1, .29), boundary = strike('orc', .1, .30);
assert.equal(wounded.dmg, healthy.dmg + 5);
assert.equal(boundary.dmg, healthy.dmg);
assert.equal(strike('orc', .5, .29).dmg, strike('orc', .5, 1).dmg);
assert.equal(strike('orc', .1, .29, true).dmg, strike('orc', .1, 1, true).dmg);

function incoming(race, type, active) {
  const s = run(race, 'fighter', 1), h = s.heroes[0], f = s.foes[0];
  if (!active) delete h.race;
  f.actions = [{ type: 'attack', name: 'Attacco', hitMode: 'save', aoeShape: 'sphere', diceNum: 4, diceType: 'd6', dmgType: type, saveAbility: 'wis', halfOnSave: false }];
  f.cap.dc = 999; f.cap.dmg = 999; f.adapt = { mult: 1, dmg: 0, hit: 0 };
  s.foes = [f]; s.order = [f.id];
  E.withRng(() => .01, () => E.act(s, 'one', { actionId: 'difesa' }, 2));
  const attack = s.log.find(l => l.actor === f.id && l.targets?.includes(h.id));
  return -(attack?.nums?.[h.id] || 0);
}
assert.equal(incoming('elf', 'fuoco', true), Math.floor(incoming('elf', 'fuoco', false) / 2));
assert.equal(incoming('elf', 'contundente', true), incoming('elf', 'contundente', false));
assert.equal(incoming('dragonborn', 'contundente', true), Math.floor(incoming('dragonborn', 'contundente', false) / 2));
assert.equal(incoming('dragonborn', 'fuoco', true), incoming('dragonborn', 'fuoco', false));

const artContext = { ...K, ITEMS: I.ITEMS, gearUsers: I.gearUsers };
const entries = A.handEntries(artContext);
for (const race of ['orc', 'dragonborn']) for (const cls of Object.keys(K.KITS)) {
  const weapon = K.WEAPON_CHOICES[cls][0], spec = A.handSpec({ cls, race }, weapon, K.TWO_HANDED.has(weapon));
  assert.ok(spec.glove.endsWith(`~${race}`));
  const entry = entries.find(e => e.base === weapon && e.glove === spec.glove && e.off === spec.off);
  assert.ok(entry, `${race}/${cls}/${weapon}`);
  assert.match(A.handPrompt(entry), race === 'orc' ? /olive-green/ : /bronze scales/);
}
assert.equal(A.handSpec({ cls: 'wizard', race: 'elf' }, 'bastone', false).glove, A.gloveOf('wizard'));
const armor = A.armorHandEntries('test', { kind: 'armor', base: 'magica', look: 'silk sleeves' }, artContext);
assert.ok(armor.some(e => e.glove === A.armorGlove('test', 'orc')));
assert.ok(armor.some(e => e.glove === A.armorGlove('test', 'dragonborn')));
console.log('OK: cinque razze, bonus separati, costi e duplicati, resistenze, fortuna, soglia orchesca e varianti mani/armature.');
