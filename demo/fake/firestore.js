/* DEMO: stessa forma delle funzioni di firebase/firestore usate dal gioco, tutto in memoria. */
import { readDoc, listCol, writeDoc, watchDoc } from "./store";
const snapOf = (col, id, data) => ({ id, ref: { col, id }, exists: () => data !== undefined, data: () => (data === undefined ? undefined : JSON.parse(JSON.stringify(data))) });
export const getFirestore = () => ({});
export const doc = (_db, col, id) => ({ col, id });
export const collection = (_db, col) => ({ col });
export const query = (c) => c;
export const where = () => null;
export const orderBy = () => null;
export const limit = () => null;
export const serverTimestamp = () => Date.now();
export const increment = (n) => n;
export const deleteField = () => undefined;
export const arrayUnion = (...a) => a;
export const arrayRemove = () => [];
export async function getDoc(r) { return snapOf(r.col, r.id, readDoc(r.col, r.id)); }
export async function getDocs(c) {
  const docs = listCol(c.col).map(([id, d]) => snapOf(c.col, id, d));
  return { docs, empty: !docs.length, size: docs.length, forEach: (f) => docs.forEach(f) };
}
export function onSnapshot(r, cb) {
  if (!r.id) { getDocs(r).then(cb); return () => {}; }
  const fire = () => cb(snapOf(r.col, r.id, readDoc(r.col, r.id)));
  queueMicrotask(fire);
  return watchDoc(r.col, r.id, fire);
}
export async function setDoc(r, d) { writeDoc(r.col, r.id, d); }
export async function updateDoc(r, d) { writeDoc(r.col, r.id, { ...(readDoc(r.col, r.id) || {}), ...d }); }
export async function deleteDoc(r) { writeDoc(r.col, r.id, null); }
export async function runTransaction(_db, fn) { return fn({ get: getDoc, set: setDoc, update: updateDoc, delete: deleteDoc }); }
