const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function compile(file) {
  const code = buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'], write: false }).outputFiles[0].text;
  const mod = new Module(__filename, module); mod.paths = module.paths; mod._compile(code, file); return mod.exports;
}
const { partySpriteOf, default: Sprite } = compile('src/components/SegretePartySprite.jsx');
const { ARENA_CLASSES } = compile('src/data/arenaClassSprites.js');
const { RACES } = compile('src/data/segreteRaces.js');
const { default: Card } = compile('src/components/SegreteCompanionCard.jsx');
assert.equal(ARENA_CLASSES.length, 12);
assert.equal(Object.keys(RACES).length, 5);
const combinations = new Set();
for (const race of Object.keys(RACES)) for (const [index, cls] of ARENA_CLASSES.entries()) {
  const hero = { cls: cls.key, race };
  const sprite = partySpriteOf(hero);
  assert.equal(sprite.column, index % 6); assert.equal(sprite.row, Math.floor(index / 6));
  assert.ok(fs.statSync(`public${sprite.src}`).size > 1000);
  combinations.add(`${sprite.src}:${sprite.column}:${sprite.row}`);
  const html = renderToStaticMarkup(React.createElement(Sprite, { hero }));
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /draggable="false"/);
  assert.ok(html.includes(sprite.src));
}
assert.equal(combinations.size, 60);
assert.deepEqual(partySpriteOf({ cls: 'unknown', race: 'unknown' }), { src: '/assets/segrete/party/human.webp', column: 0, row: 0 });
const hero = { id: 'ally', side: 'h', name: 'Compagno', cls: 'paladin', race: 'dragonborn', level: 5, hp: 12, maxHp: 40, ac: 18, fx: {} };
const html = renderToStaticMarkup(React.createElement(Card, { hero, round: 1, acted: true, onClose() {} }));
for (const text of ['Compagno', 'Paladino', 'Dragonide', '12/40 PF', 'CA 18', 'Ha agito']) assert.ok(html.includes(text), text);
assert.match(html, /cw-party-sprite is-large/);
assert.ok(!fs.readFileSync('src/pages/SegreteCrawler.jsx', 'utf8').includes('classSpriteDocId'), 'Il party usa le varianti classe/razza locali');
console.log('OK party: 60 combinazioni classe/razza, immagini locali, coordinate, fallback, sprite decorativi e scheda completa del compagno.');
