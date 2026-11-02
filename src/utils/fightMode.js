// Modalità fight (2026-11-02): mentre un combattimento è aperto (Arena, Rifugio
// dei Pet, /arena-lab) il sito nasconde testata, d20 del menu, footer e pulsanti
// flottanti: resta solo il ☰ (apre il menu) e i comandi del fight stesso
// (Ritirati / Torna all'hub / ✕). Chi mostra un fight chiama useFightMode(true);
// App.jsx legge useInFight() e mette body.in-fight.
import { useEffect, useSyncExternalStore } from "react";

let count = 0;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

export function useFightMode(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    count += 1;
    emit();
    return () => { count -= 1; emit(); };
  }, [active]);
}

const subscribe = (cb) => { subs.add(cb); return () => subs.delete(cb); };
const snap = () => count > 0;
export function useInFight() {
  return useSyncExternalStore(subscribe, snap, snap);
}
