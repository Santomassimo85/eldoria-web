const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const esbuild = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = fs.readFileSync('src/pages/SegreteCrawler.jsx', 'utf8');
const start = source.indexOf('        {run.status === "fight" && me && <>');
const panel = source.slice(start, source.indexOf('        <SpoilsBox', start));
const compiled = esbuild.buildSync({ stdin: { contents: `const SgIcon = () => null, sgTone = () => '', actInfo = () => ''; export function Panel({run, me, blocking, myTurn, acted = {}, afkLeft = null, chosen = null, chosenItem = null, aiming = null, healing = null, bagOpen = false, bagList = [], acts, busy = false, tk = 'foe', itk = null}) { return <>${panel}</>; }`, loader: 'jsx' }, bundle: true, jsx: 'automatic', external: ['react/jsx-runtime'], platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const mod = new Module(__filename, module); mod.paths = module.paths; mod._compile(compiled, __filename);
const action = { id: 'sword', name: 'Spada lunga', kind: 'weapon', left: 2, uses: 3 };
const props = { run: { status: 'fight' }, me: { id: 'hero', hp: 10, level: 5 }, acts: [action] };
const render = (extra) => renderToStaticMarkup(React.createElement(mod.exports.Panel, { ...props, ...extra }));
for (const extra of [{ myTurn: true }, { myTurn: true, blocking: true }, { myTurn: false, acted: { hero: true } }, { myTurn: false, me: { ...props.me, hp: 0 } }]) {
  const html = render(extra);
  assert.match(html, /Spada lunga/);
  assert.match(html, /Zaino/);
  if (extra.blocking || !extra.myTurn) assert.match(html, /disabled=""/);
}
assert.match(render({ myTurn: true, chosen: action }), /cw-actions is-compact/);
assert.match(render({ myTurn: true, chosen: action }), /aria-pressed="true"/);
assert.match(render({ myTurn: true, chosen: action, blocking: true }), /Spada lunga/);
console.log('Segrete actions: visible during ally animations, after acting, while downed and during compact selection.');
