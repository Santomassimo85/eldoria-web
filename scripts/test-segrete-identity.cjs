const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
function bundle(file) {
  const code = esbuild.buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const mod = new Module(file, module);
  mod.paths = module.paths;
  mod._compile(code, file);
  return mod.exports;
}
const { heroIdentity, subclassName } = bundle('src/utils/segreteIdentity.js');
const { SUBCLASSES, XP_TABLE, XP_VERSION } = bundle('src/data/segreteKits.js');
for (const [cls, list] of Object.entries(SUBCLASSES)) {
  const base = heroIdentity(cls);
  for (const sub of list) {
    const hero = { xp: XP_TABLE[4], xpv: XP_VERSION, subclasses: [sub.key], subclass: sub.key };
    assert.equal(heroIdentity(cls, hero), `${base} · ${sub.name}`);
    assert.equal(subclassName(cls, { subclass: sub.key }), sub.name);
    assert.equal(subclassName(cls, { subName: sub.name }), sub.name);
    assert.equal(heroIdentity(cls, { ...hero, subclasses: [] }), base);
    assert.equal(heroIdentity(cls, { ...hero, xp: 0 }), base);
    assert.equal(heroIdentity(cls, { ...hero, subclass: '' }), base);
  }
  assert.equal(heroIdentity(cls, { subclass: 'unknown' }), base);
}
console.log('Segrete identity: all subclasses, ownership, level, snapshots and base classes passed.');
