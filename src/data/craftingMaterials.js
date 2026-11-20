// Prenotazioni separate dallo specchio Foundry: il sync non può restituire un materiale già impegnato.
export const materialName = (s) => String(s || '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').trim();
const quantity = (item) => Math.max(0, Math.floor(Number(item.quantity ?? item.qty ?? 1) || 0));
const itemId = (item) => item.id || item._id || item.foundryId || '';

export function availableCraftInventory(charData) {
  const inventory = Array.isArray(charData?.inventory) ? charData.inventory : [];
  const ids = new Set(inventory.map(itemId).filter(Boolean));
  const pending = new Map();
  for (const use of Object.values(charData?.crafting?.materialReservations || {})) {
    if (use.status !== 'pending' || !['scheda', 'mercato'].includes(use.source)) continue;
    const key = use.itemId && ids.has(use.itemId) ? `id:${use.itemId}` : `name:${materialName(use.itemName)}`;
    pending.set(key, (pending.get(key) || 0) + (Number(use.quantity) || 1));
  }
  return inventory.map((item) => {
    let available = quantity(item);
    let reserved = 0;
    for (const key of [itemId(item) ? `id:${itemId(item)}` : '', `name:${materialName(item.name)}`].filter(Boolean)) {
      const used = Math.min(available, pending.get(key) || 0);
      available -= used;
      reserved += used;
      pending.set(key, (pending.get(key) || 0) - used);
    }
    return { ...item, quantity: available, craftReserved: reserved };
  });
}

export function materialEvidence(material, { charData, marketItems = [], isMaster = false } = {}, bucket = 'enhancers') {
  if (!material) return { ok: false, qty: 0, source: '', label: '' };
  if (isMaster) return { ok: true, qty: Infinity, source: 'master', label: 'Master' };
  const stock = Math.max(0, Number(charData?.crafting?.[bucket]?.[material.key]) || 0);
  if (stock >= 1) return { ok: true, qty: stock, stock, source: 'scorta', label: `assegnato dal Master (${stock})` };
  const names = [material.name, ...(material.aliases || [])].map(materialName);
  const matches = (name) => names.some((alias) => materialName(name).includes(alias));
  const uses = Object.values(charData?.crafting?.materialReservations || {});
  // L'inventario è autorevole quando esiste, anche se vuoto. actions è il formato legacy.
  const rawSheet = Array.isArray(charData?.inventory) ? charData.inventory : (Array.isArray(charData?.actions) ? charData.actions : []);
  const sheet = availableCraftInventory({ ...charData, inventory: rawSheet });
  const seen = new Set();
  for (const item of sheet.filter((entry) => matches(entry?.name))) {
    const id = itemId(item);
    const key = id || materialName(item.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const owned = id ? quantity(item) : sheet.filter((entry) => !itemId(entry) && materialName(entry.name) === materialName(item.name)).reduce((total, entry) => total + quantity(entry), 0);
    const available = owned;
    if (available > 0) return { ok: true, qty: available, source: 'scheda', itemId: id, itemName: item.name, label: `sulla scheda: ${item.name} (${available})` };
  }
  // Acquisti storici non sono nuove scorte: si usano solo per schede prive di inventario.
  if (!Array.isArray(charData?.inventory)) {
    const me = materialName(charData?.name);
    const bought = marketItems.find((item) => item.isSold && me && materialName(item.buyerName) === me && matches(item.name) &&
      !uses.some((use) => use.marketId === (item.id || item._id)));
    if (bought && (bought.id || bought._id)) return { ok: true, qty: 1, source: 'mercato', marketId: bought.id || bought._id,
      itemName: bought.name, label: `comprato al Mercato: ${bought.name}` };
  }
  return { ok: false, qty: 0, source: '', label: 'nessuna unità disponibile: sincronizza l’inventario Foundry o chiedi al Master' };
}

export function reserveMaterial(material, ctx, bucket, reservationId) {
  if (ctx.charData?.crafting?.materialReservations?.[reservationId]) throw new Error('Materiale già prenotato per questo lavoro.');
  const evidence = materialEvidence(material, ctx, bucket);
  if (!evidence.ok) throw new Error(`${material.name}: ${evidence.label}.`);
  if (evidence.source === 'master') return { evidence, patch: {}, use: null };
  if (evidence.source === 'scorta') return { evidence, patch: { [`crafting.${bucket}.${material.key}`]: evidence.stock - 1 }, use: null };
  const use = { reservationId, key: material.key, bucket, name: material.name, aliases: material.aliases || [],
    source: evidence.source, itemId: evidence.itemId || '', itemName: evidence.itemName || material.name,
    marketId: evidence.marketId || '', quantity: 1, status: 'pending' };
  return { evidence, use, patch: { [`crafting.materialReservations.${reservationId}`]: use } };
}
