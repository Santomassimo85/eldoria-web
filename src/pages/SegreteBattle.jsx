/* LE SEGRETE · la lotta (fase 3, 2026-11-04)
   Legge dungeon_runs/{roomId} (lo scrive solo il server, callable segreteDo) e
   manda le azioni. Gruppo in basso a sinistra, mostri a destra sullo sfondo del
   dungeon; quando tocca a te scegli l'azione e (se serve) il bersaglio toccandolo.
   Chi non risponde per 5 minuti: chiunque del gruppo lo fa difendere (anche da solo). */
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { heroActionList, targetKind, AFK_MS } from "../data/segreteEngine";
import { classInfo, clsStyle, sizeScale, diffOf } from "../data/segrete";
import { classSpriteDocId } from "../data/arenaClassSprites";
import { showD20Roll, preloadDice3D, whenDiceIdle } from "../components/DiceRoll";
import { popAt, popTag } from "../fx/hitNumbers";
import { bagOf, battleItem, itemTarget, itemOf, COIN_ICON } from "../data/segreteItems";
import { SgIcon } from "../components/GameIcon";
import { sgTone } from "../data/segreteIcons";
import StatusPips from "../components/StatusPips";
import { useFightMode } from "../utils/fightMode";
import { VfxLayer } from "./WorldBossVfx";
import { leaveRoom, backToRoom } from "../utils/segreteRooms";
import "./SegreteBattle.css";

const ROW_GAP_MS = 900; // pausa dopo ogni colpo, per leggere numeri e cronaca
const DICE_GAP_MS = 250; // fra il dado che sparisce e l'effetto
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// quando arriva il colpo sullo sprite (ms dall'inizio dell'effetto): lì scendono i PF e cade il nemico
const vfxKey = (id) => `seg-${id}`;
let callable = null;
const segreteDo = (data) => { callable = callable || httpsCallable(functions, "segreteDo"); return callable(data).then((r) => r.data); };
const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/* Icone di stato sopra lo sprite (senza riquadro): solo il simbolo, il numero dei
   round che restano, alone verde = bonus, rosso = malus. Effetti attivi finché round < until. */
export function statusIcons(c, round) {
  const fx = c.fx || {};
  const untilOf = (u) => (typeof u === "number" ? u : u?.until || 0);
  const on = (u) => !!u && round < untilOf(u);
  const left = (u) => Math.max(1, untilOf(u) - round);
  const out = [];
  (fx.ac || []).filter(on).forEach((e, i) => out.push({ k: `ac${i}`, ico: "🛡", n: left(e), good: true, tag: `+${e.v} CA`, t: `+${e.v} CA` }));
  if (fx.dodge) out.push({ k: "dodge", ico: "🌀", n: 1, good: true, tag: "+4 CA", t: "In difesa: +4 CA fino alla sua prossima azione" });
  if (on(fx.adv)) out.push({ k: "adv", ico: "🎯", n: left(fx.adv), good: true, tag: "vant.", t: "Vantaggio agli attacchi" });
  if (on(fx.dmg)) out.push({ k: "dmg", ico: "⚔", n: left(fx.dmg), good: true, tag: `+${fx.dmg.v} danni`, t: `+${fx.dmg.v} ai danni` });
  if (on(fx.rage)) out.push({ k: "rage", ico: "💢", n: left(fx.rage), good: true, tag: `+${fx.rage.v} furia`, t: `Furia: +${fx.rage.v} danni, danni fisici dimezzati` });
  if (on(fx.dis)) out.push({ k: "dis", ico: "🌫", n: left(fx.dis), good: false, tag: "svant.", t: "Svantaggio agli attacchi" });
  if (on(fx.reckless)) out.push({ k: "reck", ico: "😤", n: left(fx.reckless), good: false, tag: "−2 CA", t: "Irruento: −2 CA" });
  if (fx.stun) out.push({ k: "stun", ico: "💫", n: 1, good: false, tag: "salta", t: "Stordito: salta il prossimo turno" });
  // STATI (2026-11-06): danni a turni, blocchi e malus (vedi STATUS in segreteEngine.js)
  if (on(fx.burn)) out.push({ k: "burn", ico: "🔥", n: left(fx.burn), good: false, tag: `${fx.burn.dice}/t`, t: `Bruciato: ${fx.burn.dice} fuoco all'inizio di ogni suo turno (Tonico o Bomba d'Acqua)` });
  if (on(fx.poison)) out.push({ k: "poison", ico: "☠", n: left(fx.poison), good: false, tag: `${fx.poison.dice}/t`, t: `Avvelenato: ${fx.poison.dice} veleno all'inizio di ogni suo turno (Tonico)` });
  if (fx.frozen) out.push({ k: "frozen", ico: "🧊", n: fx.frozen.left, good: false, tag: "−2 CA", t: "Congelato: salta i turni e −2 CA. Lo libera il Tonico o un colpo di fuoco" });
  if (fx.paralyzed) out.push({ k: "par", ico: "⚡", n: fx.paralyzed.left, good: false, tag: "fermo", t: `Paralizzato: salta il turno, TS ${String(fx.paralyzed.stat || "con").toUpperCase()} CD ${fx.paralyzed.dc || 12} a ogni turno per liberarsi; chi lo attacca ha vantaggio` });
  if (fx.petrified) out.push({ k: "stone", ico: "🗿", n: fx.petrified.left, good: false, tag: "pietra", t: "Pietrificato: non agisce, danni dimezzati, chi lo attacca ha vantaggio. Solo la Panacea lo libera prima" });
  if (on(fx.frightened)) out.push({ k: "fear", ico: "😱", n: left(fx.frightened), good: false, tag: "paura", t: "Spaventato: svantaggio, non può curare né aiutare gli altri (Tonico)" });
  if (on(fx.blinded)) out.push({ k: "blind", ico: "🌑", n: left(fx.blinded), good: false, tag: "cieco", t: "Accecato: svantaggio, chi lo attacca ha vantaggio (Tonico)" });
  if (on(fx.slow)) out.push({ k: "slow", ico: "🐌", n: left(fx.slow), good: false, tag: "lento", t: "Rallentato: svantaggio agli attacchi (Tonico o Bomba d'Acqua)" });
  if (on(fx.confused)) out.push({ k: "conf", ico: "😵", n: left(fx.confused), good: false, tag: "confuso", t: "Confuso: sceglie l'azione ma il bersaglio esce a caso, anche un compagno (Tonico)" });
  return out;
}

function Fighter({ c, isTurn, done, selectable, picked, onPick, classSprite, flash, round, onInspect }) {
  const icons = c.hp > 0 ? statusIcons(c, round || 1) : [];
  /* TOCCO vs PRESSIONE (2026-11-06): il bersaglio si prende AL RILASCIO del dito (pointerup), non
     sul "click" che sui telefoni arriva dopo e a volte si perde; tenere premuto 450 ms = scheda.
     Il click resta solo per la tastiera (detail 0). */
  const lp = useRef({ t: null, fired: false, x: 0, y: 0, down: false, handled: false });
  const startPress = (e) => {
    lp.current = { ...lp.current, fired: false, handled: false, down: true, x: e.clientX, y: e.clientY };
    clearTimeout(lp.current.t);
    if (onInspect) lp.current.t = setTimeout(() => { lp.current.fired = true; onInspect(c.id); }, 450);
  };
  const cancelPress = () => { clearTimeout(lp.current.t); lp.current.down = false; };
  const movePress = (e) => { if (lp.current.down && Math.hypot(e.clientX - lp.current.x, e.clientY - lp.current.y) > 18) cancelPress(); };
  const endPress = (e) => {
    const wasDown = lp.current.down;
    clearTimeout(lp.current.t);
    lp.current.down = false;
    if (!wasDown || lp.current.fired || (e.button != null && e.button > 0)) return;
    lp.current.handled = true;
    if (selectable) onPick(c.id);
  };
  const dead = c.hp <= 0;
  const img = dead && c.deadImg ? c.deadImg : c.img || (c.side === "h" ? classSprite : "");
  const pct = Math.max(0, Math.round((100 * c.hp) / Math.max(1, c.maxHp)));
  const mirror = c.side === "f" ? c.facing !== "right" : true;
  return (
    <button type="button" className={`sgb-f sgb-f--${c.side}${c.role === "boss" ? " is-boss" : ""}${dead ? " is-dead" : ""}${!dead && c.fx?.petrified ? " is-stone" : ""}${!dead && c.fx?.frozen ? " is-frozen" : ""}${isTurn ? " is-turn" : ""}${selectable ? " is-pick" : ""}${picked ? " is-picked" : ""}${c.side === "h" ? " has-cls" : ""}`}
      style={c.side === "h" ? clsStyle(c.cls) : { "--sz": sizeScale(c) }}
      aria-disabled={!selectable} aria-label={`${c.name}, ${c.hp} su ${c.maxHp} PF${onInspect ? " (tieni premuto per la scheda)" : ""}`}
      onClick={(e) => { if (lp.current.handled || lp.current.fired) { lp.current.handled = false; lp.current.fired = false; return; } if (e.detail === 0 && selectable) onPick(c.id); }}
      onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={cancelPress} onPointerCancel={cancelPress} onPointerMove={movePress}
      onContextMenu={(e) => { if (onInspect) { e.preventDefault(); onInspect(c.id); } }}>
      {flash && <span key={flash.k} className={`sgb-pop sgb-pop--${flash.kind}`}>{flash.txt}</span>}
      {picked && <span className="sgb-aim" aria-hidden="true">🎯</span>}
      {!!icons.length && (
        <StatusPips className="sgb-st-pips" max={9}
          items={icons.map((i) => ({ k: i.k, icon: i.ico, tag: i.tag, dur: i.n ? String(i.n) : "", good: i.good, tip: `${i.t}${i.n ? ` · ${i.n} round` : ""}` }))} />
      )}
      <span className="sgb-sprite" data-vfx-target={vfxKey(c.id)}>
        {img ? <img src={img} alt="" className={mirror ? "mirror" : ""} draggable="false" />
          : c.side === "h" ? <SgIcon kind="cls" of={c.cls} fallback={classInfo(c.cls)?.icon} size="xl" className="sgb-emoji" /> : <span className="sgb-emoji" aria-hidden="true">{c.icon || (c.role === "boss" ? "👑" : "👹")}</span>}
      </span>
      <span className="sgb-hud">
        <b>{done ? "✓ " : ""}{c.name}</b>
        {c.side === "h" && <em className="sgb-cls">{c.helper ? "🤝 " : ""}<SgIcon kind="cls" of={c.cls} fallback={classInfo(c.cls)?.icon} /> {classInfo(c.cls)?.it} · Lv {c.level}</em>}
        <span className="sgb-bar"><i style={{ width: `${pct}%` }} className={pct < 30 ? "low" : ""} /></span>
        {c.side === "h"
          ? <small>{dead ? (c.fled ? "fuggito" : "a terra") : `${c.hp}/${c.maxHp} PF · CA ${c.ac}`}</small>
          : dead ? <small>sconfitto</small> : null}
      </span>
    </button>
  );
}

/* Cronaca (2026-11-06): i tiri "(🎲12+5=17 vs CA 14)" hanno il colore di chi tira: la classe per
   gli eroi, rosso pieno per i mostri (il rosso del Barbaro è simile, per questo il mostro ha il fondo). */
export const rowSide = (l, run) => {
  const id = l?.actor || l?.from;
  const c = id ? [...(run.heroes || []), ...(run.foes || [])].find((x) => x.id === id) : null;
  if (!c) return { cls: "", style: undefined };
  return c.side === "h" ? { cls: " by-hero", style: clsStyle(c.cls) } : { cls: " by-foe", style: undefined };
};
export function LogText({ l, run }) {
  if (!l) return null;
  const { cls, style } = rowSide(l, run);
  if (!cls) return l.txt;
  return String(l.txt).split(/(\(🎲[^)]*\))/).map((p, i) => (i % 2
    ? <span key={i} className={`sgb-roll${cls}`} style={style}>{p.slice(1, -1)}</span>
    : p));
}

export default function SegreteBattle({ room, uid }) {
  useFightMode(true);
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aiming, setAiming] = useState(null); // bersaglio appena toccato: si vede subito, mentre il server risponde
  const [err, setErr] = useState("");
  const [chosen, setChosen] = useState(null); // azione che aspetta il bersaglio
  const [logOpen, setLogOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [sprites, setSprites] = useState({});
  const [flashes, setFlashes] = useState({});
  const [vfxMsgs, setVfxMsgs] = useState([]);
  const [inspect, setInspect] = useState(null);
  // 2026-11-04: i PF sugli sprite scendono quando ARRIVA il colpo, non quando risponde il server
  // (prima il nemico cadeva mentre il dado rotolava ancora). shownSeq = ultima riga già "arrivata".
  const [shownSeq, setShownSeq] = useState(null);
  const [myChar, setMyChar] = useState(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [chosenItem, setChosenItem] = useState(null);
  const [known, setKnown] = useState({});
  useEffect(() => onSnapshot(doc(db, "dungeon_meta", "known"), (snap) => setKnown(snap.exists() ? snap.data().sources || {} : {}), () => {}), []);
  const initAsked = useRef("");
  const seenSeq = useRef(0);
  const timeoutAsked = useRef("");

  useEffect(() => { preloadDice3D(); }, []);
  useEffect(() => (uid ? onSnapshot(doc(db, "characters", uid), (snap) => setMyChar(snap.exists() ? snap.data() : null), () => {}) : undefined), [uid]);
  useEffect(() => onSnapshot(doc(db, "dungeon_runs", room.id), (s) => setRun(s.exists() ? s.data() : null), (e) => setErr(e.message)), [room.id]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // la partita non c'è (o è di un avvio precedente): la crea il server
  const startKey = room.startedAt?.toMillis ? room.startedAt.toMillis() : 0;
  useEffect(() => {
    if (room.status !== "running") return;
    if (run && run.startKey === startKey) return;
    const k = `${room.id}:${startKey}`;
    if (initAsked.current === k) return;
    initAsked.current = k;
    segreteDo({ op: "init", roomId: room.id }).catch((e) => setErr(e.message));
  }, [room.id, room.status, run, startKey]);

  // sprite di classe degli eroi senza immagine
  const clsList = useMemo(() => [...new Set((run?.heroes || []).map((h) => h.cls))].join(","), [run?.heroes]);
  useEffect(() => {
    clsList.split(",").filter(Boolean).forEach((cls) => {
      if (sprites[cls] !== undefined) return;
      getDoc(doc(db, "arena_meta", classSpriteDocId(cls))).then((s) => setSprites((m) => ({ ...m, [cls]: s.exists() ? s.data().image || "" : "" }))).catch(() => {});
    });
  }, [clsList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Righe nuove della cronaca → effetti pixel + suoni (VfxLayer del World Boss) e numeri che
  // saltano, UNA RIGA ALLA VOLTA (la fase dei mostri arriva tutta insieme dal server).
  const timers = useRef([]);
  const sendP = useRef(Promise.resolve());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; timers.current.forEach(clearTimeout); }; }, []);
  /* SEQUENZA DELLA LOTTA (2026-11-05): le righe nuove si giocano UNA ALLA VOLTA, in fila:
     1) il d20, solo per i TUOI tiri (2026-11-06: quelli di compagni e mostri stanno nella cronaca),
     2) l'effetto a canvas, 3) all'istante VERO dell'impatto (msg.onImpact dal VfxLayer) escono
     i numeri e scendono i PF, 4) una pausa per leggere. Prima dado, effetto e PF andavano
     ognuno col suo orologio e si vedevano sfasati. */
  const queue = useRef(Promise.resolve());
  const queued = useRef(0); // righe ancora da giocare: finché > 0 le azioni restano nascoste
  const [, setAnimating] = useState(false); // rinfresca la vista a fine coda
  useEffect(() => {
    if (!run?.log?.length) return;
    const last = run.log[run.log.length - 1].i;
    if (!seenSeq.current) { seenSeq.current = last; setShownSeq(last); return; }
    const fresh = run.log.filter((l) => l.i > seenSeq.current);
    if (!fresh.length) return;
    seenSeq.current = last;
    const all = [...(run.heroes || []), ...(run.foes || [])];
    const nameOf = (id) => all.find((c) => c.id === id)?.name || "";
    // rete di sicurezza: se qualcosa si pianta (scheda in pausa, dado appeso) i PF si allineano comunque
    timers.current.push(setTimeout(() => setShownSeq((v) => Math.max(v || 0, last)), 15000 + fresh.length * 5000));
    queued.current += fresh.length;
    setAnimating(true);
    queue.current = queue.current.catch(() => {}).then(async () => {
      await sendP.current.catch(() => {});
      for (const l of fresh) {
        if (!mounted.current) return;
        // 1) il dado (solo il proprio)
        if (l.roll?.nat && l.actor === `h_${uid}`) {
          const dice = (l.roll.dice || []).length > 1 ? l.roll.dice.map((v) => ({ value: v, dim: v !== l.roll.nat })) : undefined;
          await whenDiceIdle();
          await showD20Roll(l.roll.nat, { label: nameOf(l.actor), dice }).catch(() => {});
          await sleep(DICE_GAP_MS);
        }
        if (!mounted.current) return;
        // 2) effetto + 3) impatto
        const targets = l.targets || [];
        const tags = l.tags || {};
        const nums = l.nums ? Object.entries(l.nums).map(([id, v]) => ({ t: vfxKey(id), v, crit: l.kind === "crit", tag: tags[id] }))
          : l.dmg && targets.length === 1 ? [{ t: vfxKey(targets[0]), v: -l.dmg, crit: l.kind === "crit", tag: tags[targets[0]] }] : [];
        Object.entries(tags).forEach(([id, tag]) => { if (!nums.some((n) => n.t === vfxKey(id))) nums.push({ t: vfxKey(id), v: 0, tag }); });
        const land = () => setShownSeq((v) => Math.max(v || 0, l.i));
        if (l.fx && targets.length) {
          await new Promise((res) => {
            let done = false;
            const finish = () => { if (done) return; done = true; land(); res(); };
            timers.current.push(setTimeout(finish, 3000)); // l'effetto non è partito: si va avanti lo stesso
            setVfxMsgs((m) => [...m.slice(-20), {
              id: `seg-${room.id}-${l.i}`, effect: l.fx, effectEl: l.el,
              effectTargets: targets.map(vfxKey), effectFrom: l.from ? vfxKey(l.from) : undefined,
              effectMissTargets: l.kind === "miss" ? targets.map(vfxKey) : [], effectKill: (l.kill || []).map(vfxKey),
              effectNums: nums,
              onImpact: (ms) => timers.current.push(setTimeout(finish, ms + 40)),
            }]);
          });
        } else {
          nums.forEach((n) => popAt(n.t, { value: n.v, kind: n.v > 0 ? "heal" : "dmg", crit: n.crit, el: l.el }));
          Object.entries(tags).forEach(([id, tag]) => {
            const el = document.querySelector(`[data-vfx-target="${vfxKey(id)}"]`);
            const r = el?.getBoundingClientRect();
            if (r?.width) popTag({ x: r.left + r.width / 2, y: r.top + r.height * 0.35, tag, delay: 120 });
          });
          land();
        }
        // 4) il tempo di leggere: più lungo dopo un colpo, breve per le righe di servizio
        await sleep(l.fx ? ROW_GAP_MS : l.roll ? 500 : 250);
        queued.current = Math.max(0, queued.current - 1);
      }
      setFlashes({});
      if (!queued.current) setAnimating(false);
    }).catch(() => { queued.current = 0; setAnimating(false); });
    // rete di sicurezza per i tasti: mai bloccati per più di così
    timers.current.push(setTimeout(() => { if (queued.current) { queued.current = 0; setAnimating(false); } }, 20000 + fresh.length * 5000));
    return undefined;
  }, [run?.log, room.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Turni a fasi: tutti gli eroi insieme, poi i mostri. pending = eroi vivi che devono ancora agire.
  const fighting = run?.status === "fight";
  const acted = run?.acted || {};
  const pending = fighting ? run.heroes.filter((h) => h.hp > 0 && !acted[h.id]) : [];
  const me = run?.heroes.find((h) => h.uid === uid) || null;
  const myTurn = !!(fighting && me && me.hp > 0 && !acted[me.id]);
  const afkLeft = fighting && pending.length ? AFK_MS - (now - (run.phaseAt || run.turnAt || now)) : null;

  // tempo scaduto: chiunque del gruppo fa difendere chi è sparito (una volta per turno)
  useEffect(() => {
    if (!pending.length || afkLeft == null || afkLeft > 0) return;
    const k = `${run.floor}:${run.round}`;
    if (timeoutAsked.current === k) return;
    timeoutAsked.current = k;
    segreteDo({ op: "timeout", roomId: room.id }).catch(() => {});
  }, [afkLeft, pending.length, run?.floor, run?.round, room.id]);

  useEffect(() => { if (!myTurn) { setChosen(null); setChosenItem(null); setBagOpen(false); } }, [myTurn]);

  const send = async (data) => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const p = segreteDo({ roomId: room.id, ...data });
      // la cronaca nuova aspetta questa promessa (e il dado) prima di animarsi
      // il dado del proprio tiro lo mostra la sequenza della lotta, insieme a quelli degli altri
      sendP.current = p.then(() => {});
      await p;
    } catch (e) { setErr(e.message || "Azione non riuscita."); }
    finally { setBusy(false); setChosen(null); setAiming(null); }
  };
  const pickAction = (a) => {
    const tk = targetKind(a);
    if (!tk) return send({ op: "act", actionId: a.id });
    setChosen(a);
  };
  const pickTarget = (id) => {
    if (busy || aiming || !(chosen || chosenItem)) return;
    setAiming({ id, name: [...(run?.heroes || []), ...(run?.foes || [])].find((x) => x.id === id)?.name || "" });
    if (chosenItem) { const it = chosenItem; setChosenItem(null); setBagOpen(false); return send({ op: "item", itemId: it.id, targetId: id }); }
    return chosen && send({ op: "act", actionId: chosen.id, targetId: id });
  };
  const pickItem = (it) => {
    if (!itemTarget(it)) { setBagOpen(false); return send({ op: "item", itemId: it.id }); }
    setChosen(null); setChosenItem(it);
  };
  const flee = () => window.confirm("Abbandonare il dungeon? Il tuo eroe fugge e non prenderà premi.") && send({ op: "flee" });

  if (!run || run.startKey !== startKey) {
    return <div className="sgb-loading">{err ? <p className="sgb-err">{err}</p> : <p>🗝 Le porte delle Segrete si aprono…</p>}</div>;
  }

  const itk = chosenItem ? itemTarget(chosenItem) : null;
  const tk = chosenItem ? (itk === "downed" ? "ally" : itk) : chosen ? targetKind(chosen) : null;
  // righe non ancora "arrivate": i loro cambi di PF non si mostrano ancora
  const pendingRows = shownSeq == null ? [] : run.log.filter((l) => l.i > shownSeq);
  const playing = pendingRows.length > 0;
  // 2026-11-05: il menu delle azioni sparisce SOLO mentre si gioca il turno dei mostri (o il cambio
  // di round/sala); i colpi degli altri eroi non lo tolgono: resta finché non agisci tu
  const heroIdSet = new Set((run.heroes || []).map((h) => h.id));
  const blocking = pendingRows.some((l) => !(l.actor && heroIdSet.has(l.actor)) && l.kind !== "info" && l.kind !== "loot");
  const lag = {};
  pendingRows.forEach((l) => Object.entries(l.nums || {}).forEach(([id, v]) => { lag[id] = (lag[id] || 0) + v; }));
  const shown = (c) => (lag[c.id] ? { ...c, hp: Math.max(0, Math.min(c.maxHp, c.hp - lag[c.id])) } : c);
  const shownLog = run.log.filter((l) => shownSeq == null || l.i <= shownSeq);
  const last = shownLog[shownLog.length - 1] || run.log[run.log.length - 1];
  const acts = me ? heroActionList(me) : [];
  const bag = bagOf(myChar);
  const bagList = Object.entries(bag).map(([id, n]) => ({ ...battleItem(id), n })).filter((x) => x.id);
  const spoils = (run.spoils || {})[uid];

  return (
    <div className="sgb">
      <VfxLayer messages={vfxMsgs} selfUid={uid} canvas />
      {inspect && (() => {
        const f = run.foes.find((x) => x.id === inspect);
        return f ? <FoeCard f={f} known={!!known[f.src]} kills={known[f.src]?.count || 0} round={run.round} onClose={() => setInspect(null)} /> : null;
      })()}
      <div className="sgb-top">
        <span className="sgb-where">{run.dungeonIcon} {run.dungeonName}{run.diff && run.diff !== "facile" ? ` · ${diffOf(run.diff).icon} ${diffOf(run.diff).name}` : ""} · {run.boss ? "👑 Sala del boss" : `Sala ${run.floor}/${run.floors}`} · round {run.round}</span>
        {run.status === "fight" && me && me.hp > 0 && <button type="button" className="sgb-flee" onClick={flee}>🏃 Abbandona</button>}
      </div>
      <button type="button" className="sgb-log" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen}>
        <span className="sgb-log-text" key={last?.i}><LogText l={last} run={run} /></span>
        <span className="sgb-log-n">{logOpen ? "▴" : "▾"}</span>
      </button>
      {logOpen && (
        <ol className="sgb-log-list">
          {[...shownLog].reverse().map((l) => <li key={l.i} className={`k-${l.kind || ""}${rowSide(l, run).cls}`} style={rowSide(l, run).style}><LogText l={l} run={run} /></li>)}
        </ol>
      )}

      <div className={`sgb-field${run.bg ? " has-bg" : ""}`} style={run.bg ? { backgroundImage: `url(${run.bg})` } : undefined}>
        <div className="sgb-foes">
          {run.foes.map((f) => (
            <Fighter key={f.id} c={shown(f)} round={run.round} isTurn={false} flash={flashes[f.id]} onInspect={setInspect} picked={aiming?.id === f.id}
              selectable={!!(tk === "foe" && f.hp > 0 && !aiming)} onPick={pickTarget} />
          ))}
        </div>
        <div className="sgb-heroes">
          {run.heroes.map((h) => (
            <Fighter key={h.id} c={shown(h)} round={run.round} isTurn={fighting && h.hp > 0 && !acted[h.id]} done={fighting && !!acted[h.id]} flash={flashes[h.id]} classSprite={sprites[h.cls]}
              picked={aiming?.id === h.id} selectable={!aiming && !!(tk === "ally" && !h.fled && (itk === "downed" ? h.hp <= 0 : itk === "ally" ? h.hp > 0 : (h.hp > 0 || chosen?.kind === "heal")))} onPick={pickTarget} />
          ))}
        </div>
      </div>

      <div className="sgb-panel">
        {err && <p className="sgb-err" role="alert">{err}</p>}
        {run.status === "fight" && blocking && (
          <p className="sgb-turn sgb-turn--wait">🎬 Si tirano i dadi e partono i colpi… {myTurn ? "poi tocca a te." : ""}</p>
        )}
        {run.status === "fight" && !blocking && (myTurn ? (
          chosen || chosenItem ? (
            <div className="sgb-pickmsg">
              {aiming
                ? <span>⏳ {(chosenItem || chosen).icon} <b>{(chosenItem || chosen).name}</b> su <b>{aiming.name}</b>…</span>
                : <span>{(chosenItem || chosen).icon} <b>{(chosenItem || chosen).name}</b>: tocca {tk === "foe" ? "un nemico" : itk === "downed" ? "un alleato a terra" : "te o un alleato"} sul campo.</span>}
              {!aiming && <button type="button" className="sgb-btn sgb-btn--ghost" onClick={() => { setChosen(null); setChosenItem(null); }}>Annulla</button>}
            </div>
          ) : bagOpen ? (
            <div className="sgb-bag">
              <p className="sgb-turn">🎒 Zaino: usare un oggetto è la tua azione del round.</p>
              {!bagList.length && <p className="sgb-pickmsg">Lo zaino è vuoto. Gli oggetti si comprano alla Bottega delle Segrete (nella lobby) o si trovano sui mostri.</p>}
              <div className="sgb-acts">
                {bagList.map((it) => (
                  <button key={it.id} type="button" className="sgb-act k-item" disabled={busy} onClick={() => pickItem(it)} title={it.desc}>
                    <SgIcon kind="item" of={it} frame size="md" className={`sgb-act-ico gi-r-${it.rarity}`} />
                    <span className="sgb-act-name">{it.name}</span>
                    <span className="sgb-act-info">{it.desc}</span>
                    <span className="sgb-act-uses">×{it.n}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="sgb-btn sgb-btn--ghost" onClick={() => setBagOpen(false)}>← Torna alle azioni</button>
            </div>
          ) : (
            <>
              <p className="sgb-turn">⚔ Tocca al gruppo: scegli la tua azione{afkLeft != null ? ` · ⏳ ${fmtLeft(afkLeft)}` : ""}{pending.length > 1 ? ` · mancano ${pending.length}` : ""}</p>
              <div className="sgb-acts">
                <button type="button" className="sgb-act k-item" disabled={busy} onClick={() => setBagOpen(true)}>
                  <SgIcon kind="ui" of="bag" fallback="🎒" frame size="md" className="sgb-act-ico" color="#e8c48a" />
                  <span className="sgb-act-name">Zaino</span>
                  <span className="sgb-act-info">{bagList.length ? `${bagList.reduce((t, x) => t + x.n, 0)} oggetti da usare` : "vuoto"}</span>
                </button>
                {acts.map((a) => (
                  <button key={a.id} type="button" className={`sgb-act k-${a.kind}`} disabled={busy || (a.left != null && a.left <= 0)} onClick={() => pickAction(a)}>
                    <SgIcon kind="action" of={a} frame size="md" className="sgb-act-ico" color={sgTone(a)} />
                    <span className="sgb-act-name">{a.name}</span>
                    <span className="sgb-act-info">{a.info || actInfo(a, me.level)}</span>
                    {a.left != null && <span className="sgb-act-uses">{a.left}/{a.uses}</span>}
                  </button>
                ))}
              </div>
            </>
          )
        ) : (
          <p className="sgb-turn sgb-turn--wait">
            {pending.length
              ? <>{me && acted[me.id] ? (me.fx?.petrified ? "🗿 Sei di pietra: salti il turno. " : me.fx?.frozen ? "🧊 Sei congelato: salti il turno. " : me.fx?.paralyzed ? "⚡ Sei paralizzato: salti il turno. " : "✓ Hai agito. ") : ""}⏳ Aspettiamo <b>{pending.map((h) => h.name).join(", ")}</b>{afkLeft != null ? ` · ${afkLeft > 0 ? `poi tocca ai mostri (chi manca si difende da solo tra ${fmtLeft(afkLeft)})` : "faccio difendere chi manca…"}` : ""}</>
              : "👹 I mostri si muovono…"}
            {me && me.hp <= 0 && " · sei a terra: un alleato può curarti"}
          </p>
        ))}
        <SpoilsBox run={run} uid={uid} spoils={spoils} hidden={playing} />
        {playing && run.status !== "fight" && <p className="sgb-turn sgb-turn--wait">⏳ …</p>}
        {!playing && run.status === "cleared" && (
          <div className="sgb-end">
            <p>✅ Sala ripulita! Breve riposo: +30% PF, chi è a terra si rialza, incantesimi ricaricati.</p>
            <FloorGains run={run} uid={uid} />
            <button type="button" className="sgb-btn" disabled={busy} onClick={() => send({ op: "next" })}>{run.floor >= run.floors ? "👑 Affronta il boss" : "🚪 Prosegui alla prossima sala"}</button>
          </div>
        )}
        {!playing && (run.status === "won" || run.status === "lost") && (
          <div className="sgb-end">
            <p className="sgb-result">{run.status === "won" ? `🏆 Vittoria! ${run.dungeonName} è vostro.` : "☠ Sconfitta. Le Segrete vi hanno inghiottito: tutto è perduto."}</p>
            {(run.levelUps || []).map((l) => <p key={l.uid}>⭐ {l.name} ({classInfo(l.cls)?.it}): +{(l.xp || 0).toLocaleString("it-IT")} PE{l.to > l.from ? <> · <b>sale al livello {l.to}!</b> Passa dalla lobby per i punti e le scelte nuove.</> : ""}</p>)}
            {run.status === "won" && !!run.corone && <p>🪙 +{run.corone} Corone a ogni eroe rimasto fino alla fine{(run.heroes || []).some((h) => h.helper) ? " (non a chi è venuto ad aiutare)" : ""}.</p>}
            {run.loot && (
              <p className="sgb-loot">{run.loot.img && <img src={run.loot.img} alt="" />}
                <span>🎁 Nel forziere del boss: <b>{run.loot.name}</b>, va a <b>{run.loot.winner}</b>{run.loot.uid === uid ? " (a te!)" : ""}. Arriverà nella scheda su Foundry.</span></p>
            )}
            <div className="sgb-endbtns">
              <button type="button" className="sgb-btn" disabled={busy} onClick={() => backToRoom(room.id, uid).catch((e) => setErr(e.message))}>↩ Torna al gruppo</button>
              <button type="button" className="sgb-btn sgb-btn--ghost" disabled={busy} onClick={() => leaveRoom(room.id, uid).catch((e) => setErr(e.message))}>Esci dal gruppo</button>
            </div>
            <p className="sgb-endnote">Il gruppo e la chat vocale restano: tornati al gruppo potete votare il prossimo dungeon.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* Bottino (2026-11-05): cosa hai preso finora, sala per sala (run.gains[uid] dal motore). */
const floorLabel = (run, fl) => (fl > run.floors ? "👑 Boss" : `🚪 Sala ${fl}`);
const gainText = (g) => (g.it ? `${itemOf(g.it)?.icon || "🎁"} ${itemOf(g.it)?.name || g.it}` : `${COIN_ICON} ${g.c}`);
export function FloorGains({ run, uid }) {
  const list = ((run.gains || {})[uid] || []).filter((g) => g.fl === run.floor);
  if (!list.length) return <p className="sgb-gain-none">In questa sala non hai raccolto niente.</p>;
  const coins = list.reduce((t, g) => t + (g.c || 0), 0);
  return (
    <p className="sgb-gain-floor">🎒 In questa sala hai preso: <b>{COIN_ICON} {coins}</b>
      {list.filter((g) => g.it).map((g, i) => <span key={i}> · {gainText(g)}</span>)}</p>
  );
}
export function SpoilsBox({ run, uid, spoils, hidden }) {
  const [open, setOpen] = useState(false);
  const gains = (run.gains || {})[uid] || [];
  if ((run.heroes || []).find((h) => h.uid === uid)?.helper) {
    return <div className="sgb-spoils"><p className="sgb-spoils-head">🤝 Partecipi come aiuto: hai già finito i dungeon con questo eroe, quindi niente PE, monete né bottino. Il gruppo ti ringrazia!</p></div>;
  }
  if (!spoils && !gains.length) return null;
  const coins = spoils?.coins || 0;
  const items = Object.entries(spoils?.items || {});
  const byFloor = [];
  gains.forEach((g) => { const last = byFloor[byFloor.length - 1]; if (last && last.fl === g.fl) last.list.push(g); else byFloor.push({ fl: g.fl, list: [g] }); });
  const state = run.status === "won" ? "portato a casa!" : run.status === "lost" ? "perduto." : "lo portate a casa solo se vincete";
  return (
    <div className={`sgb-spoils${hidden ? " is-wait" : ""}`}>
      <button type="button" className="sgb-spoils-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>🎒 Il tuo bottino: <b>{COIN_ICON} {coins} Monete Antiche</b>
          {items.map(([id, n]) => itemOf(id) && <span key={id}> · {itemOf(id).icon} {itemOf(id).name}{n > 1 ? ` ×${n}` : ""}</span>)}
          <small> · {state}</small></span>
        {!!gains.length && <em>{open ? "chiudi ▴" : "sala per sala ▾"}</em>}
      </button>
      {open && (
        <ol className="sgb-spoils-list">
          {byFloor.map((b) => (
            <li key={b.fl}>
              <b>{floorLabel(run, b.fl)}</b>
              <span>{b.list.map((g, i) => <span key={i} className="sgb-gain">{gainText(g)} <small>{g.src}</small></span>)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function actInfo(a, lv) {
  if (a.kind === "defend") return "+4 CA fino al tuo turno";
  if (a.kind === "heal") return a.flat ? `cura ${lv * 5}` : `cura ${a.dice}${a.plusMod ? "+mod" : ""}`;
  if (a.kind === "heal_all") return `cura tutti ${a.dice}+mod`;
  if (a.kind === "buff") return a.buff === "ac" ? `+${a.value} CA · ${a.turns}t` : a.buff === "adv" ? `vantaggio · ${a.turns}t` : `+${a.value} danni · ${a.turns}t`;
  if (a.kind === "save") return `${a.dice} · TS ${a.save.toUpperCase()}${a.area ? " · tutti" : ""}`;
  if (a.kind === "missile") return `${a.dice}+${a.flat || 0} · colpisce sempre`;
  return `${a.dice}${a.kind === "weapon" ? "+mod" : ""}`;
}

/* Scheda del nemico (pressione lunga). I dati veri solo se quel TIPO di mostro è già stato
   sconfitto almeno una volta in una qualunque partita (dungeon_meta/known), sennò ????. */
const DMG_LABEL = { slashing: "🗡 Tagliente", piercing: "🏹 Perforante", bludgeoning: "🔨 Contundente", fire: "🔥 Fuoco", cold: "❄ Freddo", lightning: "⚡ Fulmine", thunder: "🔊 Tuono", acid: "🧪 Acido", poison: "☠ Veleno", necrotic: "🌑 Necrotico", radiant: "✨ Radioso", force: "💫 Forza", psychic: "🧠 Psichico" };
const ROLE_LABEL = { minion: "🐀 Gregario", elite: "💀 Élite", boss: "👑 Boss" };
function foeActionLine(a) {
  const dice = a.diceNum && a.diceType ? `${a.diceNum}${a.diceType}${Number(a.bonus) && a.type === "heal" ? `+${a.bonus}` : ""}` : "";
  if (a.type === "heal") return `💚 cura ${dice}`;
  if (a.type === "buff_ca") return `🛡 +${a.acBonus || 2} CA per ${a.durationTurns || 2} round`;
  if (a.type === "buff_adv") return `🎯 vantaggio per ${a.durationTurns || 2} round`;
  if (a.type === "debuff_dis") return `🌫 svantaggio ${a.aoeShape && a.aoeShape !== "single" ? "a tutti" : "a un eroe"} per ${a.durationTurns || 2} round`;
  const area = a.aoeShape && a.aoeShape !== "single";
  const save = a.hitMode === "save" || area;
  return `${dice}${save ? ` · TS ${String(a.saveAbility || "dex").toUpperCase()} CD ${a.saveDC || 12}${a.halfOnSave !== false ? " (metà se lo superi)" : ""}` : ` · +${a.bonus || 0} al colpire`}${area ? " · tutto il gruppo" : ""}`;
}
export function FoeCard({ f, known, kills, round, onClose }) {
  const q = "????";
  const list = (arr) => (arr || []).map((k) => DMG_LABEL[k] || k).join(", ");
  const icons = f.hp > 0 ? statusIcons(f, round) : [];
  return (
    <div className="sgb-card-back" role="presentation" onClick={onClose}>
      <div className="sgb-card" role="dialog" aria-modal="true" aria-label={`Scheda di ${f.name}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sgb-card-x" onClick={onClose} aria-label="Chiudi">✕</button>
        <div className="sgb-card-head">
          {f.img ? <img src={f.img} alt="" className={f.facing !== "right" ? "mirror" : ""} /> : <span className="sgb-emoji" aria-hidden="true">{f.icon || "👹"}</span>}
          <div>
            <b>{f.name}</b>
            <small>{ROLE_LABEL[f.role] || ""} · Lv {f.level}</small>
            <small className={known ? "is-known" : "is-unknown"}>{known ? `📖 Conosciuto · sconfitto ${kills} ${kills === 1 ? "volta" : "volte"} nelle Segrete` : "❔ Mai sconfitto: nessuno sa ancora com'è fatto"}</small>
          </div>
        </div>
        <dl className="sgb-card-stats">
          <div><dt>PF</dt><dd>{known ? `${f.hp} / ${f.maxHp}` : q}</dd></div>
          <div><dt>CA</dt><dd>{known ? f.ac : q}</dd></div>
        </dl>
        <p className="sgb-card-h">Resistenze</p>
        {known ? (
          <ul className="sgb-card-list">
            <li><span>Resiste (½)</span> {list(f.res) || "—"}</li>
            <li><span>Vulnerabile (×2)</span> {list(f.vul) || "—"}</li>
            <li><span>Immune</span> {list(f.imm) || "—"}</li>
          </ul>
        ) : <p className="sgb-card-q">{q}</p>}
        <p className="sgb-card-h">Attacchi e poteri</p>
        {known ? (
          <ul className="sgb-card-list">
            {(f.actions || []).map((a, i) => <li key={i}><b>{a.name || "Attacco"}</b> {foeActionLine(a)}</li>)}
            {!(f.actions || []).length && <li>—</li>}
          </ul>
        ) : <p className="sgb-card-q">{q}</p>}
        {!!icons.length && (
          <>
            <p className="sgb-card-h">Effetti adesso</p>
            <ul className="sgb-card-list">{icons.map((i) => <li key={i.k}>{i.ico} {i.t}{i.n ? ` · ${i.n} round` : ""}</li>)}</ul>
          </>
        )}
        {!known && <p className="sgb-card-hint">Sconfiggetene uno e la sua scheda si svelerà per tutti.</p>}
      </div>
    </div>
  );
}
