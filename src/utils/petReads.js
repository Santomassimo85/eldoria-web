/* ============================================================
   Punti pet delle letture e visite (2026-10-31) — lato sito.
   `useReadTracker(kind, id, active, {targetId})`:
   1. chiede al server di segnare l'INIZIO (callable petReadReward,
      action "start", ora del server). Se la cosa è già stata pagata non
      fa altro.
   2. conta il tempo ATTIVO: avanza solo se la pagina è in primo piano e
      il giocatore ha fatto qualcosa (scorrere, toccare, mouse, tasti)
      negli ultimi IDLE_MS. Per le cronache serve anche aver scorso il
      testo (elemento `targetId`) fino a READ_SCROLL_NEED.
   3. a tempo raggiunto chiede la FINE: il server paga solo se dal suo
      inizio è passato davvero il tempo minimo e se è la prima volta.
   In localStorage resta solo un promemoria per non richiamare a vuoto.
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase";
import { READ_SCROLL_NEED } from "../data/petReads";

const IDLE_MS = 30000;
const TICK_MS = 500;

const storeKey = (uid) => `pet_reads_done_${uid}`;
function doneSet(uid) {
  try { return new Set(JSON.parse(localStorage.getItem(storeKey(uid)) || "[]")); } catch { return new Set(); }
}
function remember(uid, key) {
  try {
    const s = doneSet(uid); s.add(key);
    localStorage.setItem(storeKey(uid), JSON.stringify([...s].slice(-3000)));
  } catch { /* storage bloccato: chiederà di nuovo al server, che dirà "già fatto" */ }
}
const call = (data) => httpsCallable(functions, "petReadReward")(data).then((r) => r.data);

// Ultima attività del giocatore, condivisa da tutti i tracker.
let lastActivity = Date.now();
let listening = false;
function listenActivity() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const bump = () => { lastActivity = Date.now(); };
  ["scroll", "wheel", "pointerdown", "pointermove", "keydown", "touchstart", "touchmove"].forEach((ev) =>
    window.addEventListener(ev, bump, { passive: true, capture: true }));
}

// Quanto del testo è passato sotto gli occhi (0..1): il fondo dello schermo
// rispetto all'elemento. Un testo corto, tutto visibile, vale subito 1.
function seenFraction(el) {
  if (!el) return 1;
  const r = el.getBoundingClientRect();
  if (r.height <= 0) return 0;
  return Math.max(0, Math.min(1, (window.innerHeight - r.top) / r.height));
}

/** state: idle | starting | reading | finishing | done | already */
export function useReadTracker(kind, id, active = true, { targetId } = {}) {
  const [state, setState] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [points, setPoints] = useState(0);
  const run = useRef(0);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!active || !id || !uid) { setState("idle"); setProgress(0); return undefined; }
    const key = `${kind}:${id}`;
    if (doneSet(uid).has(key)) { setState("already"); return undefined; }
    const me = ++run.current;
    const alive = () => run.current === me;
    let timer = null;
    listenActivity();
    lastActivity = Date.now();
    setState("starting");
    setProgress(0);

    call({ action: "start", kind, id: String(id) }).then((res) => {
      if (!alive()) return;
      if (res?.already) { remember(uid, key); setState("already"); return; }
      const need = Number(res?.need) || 5000;
      const scrollNeed = READ_SCROLL_NEED[kind] || 0;
      let acc = 0;
      let seen = 0;
      setPoints(res?.points || 0);
      setState("reading");
      const finish = (tries = 0) => {
        setState("finishing");
        call({ action: "finish", kind, id: String(id) }).then((r) => {
          if (!alive()) return;
          if (r?.notYet && tries < 3) { setTimeout(() => alive() && finish(tries + 1), 2000); return; }
          if (r?.notYet) { setState("idle"); return; }
          remember(uid, key);
          setState(r?.already ? "already" : "done");
        }).catch(() => alive() && setState("idle"));
      };
      timer = setInterval(() => {
        if (!alive()) { clearInterval(timer); return; }
        const visible = document.visibilityState === "visible";
        if (visible && Date.now() - lastActivity < IDLE_MS) acc += TICK_MS;
        if (scrollNeed) seen = Math.max(seen, seenFraction(targetId ? document.getElementById(targetId) : null));
        const p = Math.min(acc / need, scrollNeed ? seen / scrollNeed : 1, 1);
        setProgress(p);
        if (acc >= need && (!scrollNeed || seen >= scrollNeed)) { clearInterval(timer); finish(); }
      }, TICK_MS);
    }).catch(() => alive() && setState("idle")); // rete o server giù: si riprova alla prossima apertura

    return () => { run.current += 1; if (timer) clearInterval(timer); };
  }, [kind, id, active, targetId]);

  return { state, progress, points };
}
