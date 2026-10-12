// Set del Mercato Nero nello zaino del PG.
//
// Un oggetto dell'inventario (sync Foundry) fa parte di un set se:
//  1. il suo NOME coincide con un pezzo noto (`items.setPayload` del Mercato
//     + il registro `market_sets`, che tiene anche i pezzi cancellati), oppure
//  2. la sua DESCRIZIONE porta la riga "Set «Nome» (N pezzi) — …" che
//     `marketItemToFoundryPayload` scrive su Foundry.
// I pezzi si contano per nome distinto: due copie dello stesso pezzo = 1.
import { setSlug } from "../pages/MarketSetRegistry";

const normBonuses = (bonuses) =>
  (Array.isArray(bonuses) ? bonuses : [])
    .map((b) => ({ pieces: Number(b.pieces) || 1, effect: String(b.effect || "").trim() }))
    .filter((b) => b.effect)
    .sort((a, b) => a.pieces - b.pieces);

function upsertSet(sets, name, size, bonuses) {
  const slug = setSlug(name);
  const prev = sets.get(slug);
  sets.set(slug, {
    slug,
    name: prev?.name || String(name).trim(),
    size: Math.max(Number(size) || 0, prev?.size || 0) || null,
    bonuses: prev?.bonuses?.length ? prev.bonuses : normBonuses(bonuses),
    pieces: prev?.pieces || new Map(), // nomeNorm -> nome da mostrare
  });
  return sets.get(slug);
}

/**
 * @param items    oggetti del Mercato ({id, ...data}) — basta quelli con setPayload
 * @param registry documenti di market_sets ({id, ...data}), anche vuoto
 * @returns { sets: Map<slug, set>, byPiece: Map<nomeNorm, slug> }
 */
export function buildSetIndex(items = [], registry = []) {
  const sets = new Map();
  const byPiece = new Map();
  const addPiece = (set, pieceName) => {
    const key = setSlug(pieceName);
    if (!set.pieces.has(key)) set.pieces.set(key, String(pieceName).trim());
    byPiece.set(key, set.slug);
  };

  for (const r of registry) {
    if (!r?.name) continue;
    const set = upsertSet(sets, r.name, r.size, r.bonuses);
    for (const p of Object.values(r.pieces || {})) if (p?.name) addPiece(set, p.name);
  }
  for (const it of items) {
    const sp = it?.setPayload;
    if (!sp?.name || !String(sp.name).trim()) continue;
    const set = upsertSet(sets, sp.name, sp.size, sp.bonuses);
    if (it.name) addPiece(set, it.name);
  }
  return { sets, byPiece };
}

// "Set «Nome» (5 pezzi) — 2 pezzi: effetto · 4 pezzi: effetto"
const DESC_RE = /Set\s*[«"]([^»"]+)[»"]\s*\((\d+|\?)\s*pezzi\)(?:\s*[—-]\s*(.*))?/i;

function setFromDescription(desc) {
  const m = DESC_RE.exec(String(desc || ""));
  if (!m) return null;
  const bonuses = (m[3] || "").split("·").map((s) => {
    const b = /^\s*(\d+)\s*pezzi:\s*(.+?)\s*$/i.exec(s);
    return b ? { pieces: Number(b[1]), effect: b[2] } : null;
  }).filter(Boolean);
  return { name: m[1].trim(), size: Number(m[2]) || null, bonuses };
}

/**
 * Abbina l'inventario ai set.
 * `setOf(item)` → null oppure
 *   { slug, name, size, bonuses, have,
 *     pieces: [{name, owned}]   // pezzi noti del set, posseduti per primi
 *     unknown }                 // pezzi che esistono ma di cui non si sa il nome
 */
export function matchInventorySets(inventory = [], index) {
  const sets = new Map();
  for (const [slug, s] of index?.sets || []) sets.set(slug, { ...s, pieces: new Map(s.pieces) });
  const byPiece = index?.byPiece || new Map();
  const itemSlug = new Map(); // item -> slug
  const owned = new Map();    // slug -> Map<nomeNorm, nome>

  for (const it of inventory) {
    if (!it?.name || it.isContainer) continue;
    const key = setSlug(it.name);
    let slug = byPiece.get(key);
    if (!slug) {
      const fromDesc = setFromDescription(it.description);
      if (!fromDesc) continue;
      const set = upsertSet(sets, fromDesc.name, fromDesc.size, fromDesc.bonuses);
      if (!set.pieces.has(key)) set.pieces.set(key, it.name);
      slug = set.slug;
    }
    itemSlug.set(it, slug);
    if (!owned.has(slug)) owned.set(slug, new Map());
    owned.get(slug).set(key, it.name);
  }

  const result = new Map();
  for (const [slug, mine] of owned) {
    const set = sets.get(slug);
    if (!set) continue;
    const pieces = [...set.pieces].map(([k, name]) => ({ name: mine.get(k) || name, owned: mine.has(k) }))
      .sort((a, b) => (b.owned - a.owned) || a.name.localeCompare(b.name, "it"));
    const size = Math.max(set.size || 0, pieces.length);
    result.set(slug, {
      slug, name: set.name, bonuses: set.bonuses,
      size, have: mine.size, pieces, unknown: Math.max(0, size - pieces.length),
    });
  }
  return {
    owned: result,
    setOf: (item) => result.get(itemSlug.get(item)) || null,
  };
}
