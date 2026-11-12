/* DEMO: "database" in memoria al posto di Firestore. Niente rete, niente chiavi. */
const docs = new Map();
const subs = new Map();
const key = (col, id) => `${col}/${id}`;
export function readDoc(col, id) { return docs.get(key(col, id)); }
export function listCol(col) {
  const out = [];
  docs.forEach((v, k) => { if (k.startsWith(`${col}/`)) out.push([k.slice(col.length + 1), v]); });
  return out;
}
export function writeDoc(col, id, data) {
  const k = key(col, id);
  if (data == null) docs.delete(k); else docs.set(k, JSON.parse(JSON.stringify(data)));
  (subs.get(k) || []).forEach((cb) => cb());
}
export function watchDoc(col, id, cb) {
  const k = key(col, id);
  if (!subs.has(k)) subs.set(k, new Set());
  subs.get(k).add(cb);
  return () => subs.get(k).delete(cb);
}
