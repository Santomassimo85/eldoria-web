const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const esbuild = require('esbuild');

async function moduleOf(entry) {
  const result = await esbuild.build({ stdin: { contents: `export * from './src/data/${entry}';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', write: false });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, console });
  return module.exports;
}
(async () => {
  const F = await moduleOf('craftingFoundry.js');
  const M = await moduleOf('craftingMaterials.js');
  const enhancer = F.ENHANCERS[0];
  const sheet = { name: 'Palar', inventory: [{ id: 'crystal', name: enhancer.name, quantity: 1 }] };
  const reserved = M.reserveMaterial(enhancer, { charData: sheet }, 'enhancers', 'craft1_enhancer');
  sheet.crafting = { materialReservations: { craft1_enhancer: reserved.use } };
  assert.equal(F.enhancerEvidence(enhancer, { charData: sheet }).ok, false);
  assert.throws(() => M.reserveMaterial(enhancer, { charData: sheet }, 'enhancers', 'craft2_enhancer'));
  sheet.inventory[0].quantity = 0;
  sheet.crafting.materialReservations.craft1_enhancer.status = 'done';
  assert.equal(F.enhancerEvidence(enhancer, { charData: sheet, marketItems: [{ id: 'sale', isSold: true, buyerName: 'Palar', name: enhancer.name }] }).ok, false);
  const legacy = { name: 'Palar' };
  const marketItems = [{ id: 'sale', isSold: true, buyerName: 'Palar', name: enhancer.name }];
  const bought = M.reserveMaterial(enhancer, { charData: legacy, marketItems }, 'enhancers', 'craft3');
  legacy.crafting = { materialReservations: { craft3: { ...bought.use, status: 'done' } } };
  assert.equal(F.enhancerEvidence(enhancer, { charData: legacy, marketItems }).ok, false);
  const stock = M.reserveMaterial(enhancer, { charData: { crafting: { enhancers: { [enhancer.key]: 2 } } } }, 'enhancers', 'stock');
  assert.equal(stock.patch[`crafting.enhancers.${enhancer.key}`], 1);

  const base = { profession: { key: 'fabbro', name: 'Fabbro' }, tier: 'common', name: 'Spada lunga', desc: '', crafter: { uid: 'u', name: 'Palar' }, roll: { d20: 15, bonus: 2, total: 17 } };
  const fire = F.craftedItemToFoundryPayload({ ...base, enhancer });
  assert.equal(fire.damage2Formula, '1d4'); assert.equal(fire.damage2Type, 'fire');
  const mithril = F.craftedItemToFoundryPayload({ ...base, enhancer: F.ENHANCERS.find(e => e.key === 'polvere_mithril') });
  assert.equal(mithril.attackBonus, 1);
  const armor = F.craftedItemToFoundryPayload({ ...base, name: 'Cotta di maglia', enhancer: F.ENHANCERS.find(e => e.key === 'scaglia_drago') });
  const plainArmor = F.craftedItemToFoundryPayload({ ...base, name: 'Cotta di maglia' });
  assert.equal(armor.armorValue, plainArmor.armorValue + 1);
  const potion = F.craftedItemToFoundryPayload({ ...base, profession: { key: 'alchimista', name: 'Alchimista' }, name: 'Pozione di Guarigione', enhancer: F.ENHANCERS.find(e => e.key === 'lacrima_driade') });
  assert.ok(potion.damageFormula.endsWith('+ 1d4'), potion.damageFormula);
  assert.equal(F.craftedItemToFoundryPayload({ ...base, enhancer: F.ENHANCERS.find(e => e.key === 'cuore_arcanite') }).rarity, 'uncommon');

  const macro = fs.readFileSync('src/foundry-macro-sync-all.txt', 'utf8');
  new Function(macro);
  const start = macro.indexOf('const nomeMaterialeCraft');
  const end = macro.indexOf('// FINE MATERIALI CRAFT');
  const context = vm.createContext({ console, Date, fetch: async () => ({ ok: true, status: 200 }), FIREBASE_CONFIG: { apiKey: 'test' }, BASE: 'test' });
  vm.runInContext(macro.slice(start, end), context);
  const item = { id: 'crystal', name: enhancer.name, system: { quantity: 2 }, receipts: {}, getFlag: () => item.receipts };
  const actor = { items: Object.assign([item], { get: id => id === item.id ? item : null }), async updateEmbeddedDocuments(type, updates) {
    for (const update of updates) { item.system.quantity = update['system.quantity']; item.receipts = update['flags.world.craftMaterialReceipts']; }
  } };
  const use = { ...reserved.use, status: 'pending' };
  await context.consumaMaterialiCraft(actor, [use]);
  assert.equal(item.system.quantity, 1);
  await context.consumaMaterialiCraft(actor, [use]);
  assert.equal(item.system.quantity, 1, 'Un retry non consuma una seconda volta');
  await assert.rejects(context.consumaMaterialiCraft(actor, [{ ...use, reservationId: 'other', quantity: 2 }]));
  assert.equal(item.system.quantity, 1, 'Una richiesta senza abbastanza materiale non modifica la quantità');
  // L'oggetto è creato, ma la conferma al sito fallisce: il giro seguente riprende senza duplicare nulla.
  const processStart = macro.indexOf('async function processaCoda(');
  const processEnd = macro.indexOf('// Attore di un UID', processStart);
  let deliveries = 0, confirmations = 0, deleted = 0;
  actor.createEmbeddedDocuments = async (type, [data]) => {
    deliveries++;
    actor.items.push({ id: 'crafted', getFlag: (scope, key) => key === 'craftInboxId' ? data.flags.world.craftInboxId : {} });
  };
  context.foundry = { utils: { setProperty: (object, key, value) => { object.flags = { world: { craftInboxId: value } }; } } };
  context.buildItemData = () => ({ name: 'Spada potenziata' });
  context.descriviVoce = () => 'craft';
  context.cancellaVoce = async () => { deleted++; };
  context.prenotaCodaMateriali = async () => true;
  context.confermaMaterialiCraft = async () => { if (++confirmations === 1) throw new Error('Test rete: conferma fallita'); };
  context.console = { ...console, error: () => {} };
  vm.runInContext(macro.slice(processStart, processEnd), context);
  const job = { _id: 'queue1', target: 'player', targetUid: 'u', materialUses: [{ ...use, reservationId: 'last-unit' }] };
  await context.processaCoda([job], () => actor);
  await context.processaCoda([job], () => actor);
  assert.equal(deliveries, 1);
  assert.equal(item.system.quantity, 0);
  assert.equal(deleted, 1);
  console.log('OK — prenotazioni, scorte, mercato, quantità Foundry, retry e bonus del craft');
})().catch(error => { console.error(error); process.exitCode = 1; });

