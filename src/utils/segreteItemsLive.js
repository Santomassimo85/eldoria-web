/* Oggetti delle Segrete creati dal Master (2026-11-08): ascolta segrete_items e li unisce a ITEMS
   (data/segreteItems.js). Un solo ascolto per tutta l'app; chi usa l'hook si ridisegna quando cambiano. */
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { registerCustomItems } from "../data/segreteItems";

let version = 0, unsub = null, docs = [];
const subs = new Set();
function start() {
  if (unsub) return;
  unsub = onSnapshot(collection(db, "segrete_items"), (s) => {
    docs = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    registerCustomItems(docs);
    version++;
    subs.forEach((f) => f(version));
  }, () => {});
}
// restituisce la versione (cambia a ogni aggiornamento) e i documenti grezzi (anche i nascosti)
export function useSegreteItems() {
  const [v, setV] = useState(version);
  useEffect(() => { start(); subs.add(setV); setV(version); return () => { subs.delete(setV); }; }, []);
  return { version: v, docs };
}
