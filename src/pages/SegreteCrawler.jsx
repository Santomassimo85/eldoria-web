/* LE SEGRETE IN PRIMA PERSONA (2026-11-07): la stessa lotta di SegreteBattle.jsx con un'altra vista.
   Stessi dati (dungeon_runs, scritto solo dal server), stesse operazioni di segreteDo, stessa coda
   dado → effetto → danno, stessi pannelli di azioni, zaino, bottino e fine dungeon. Cambia il campo:
   la stanza in prospettiva di src/fx/crawlerEngine.js, le armi in mano, il party in basso.
   Per ora la vede solo il Master principale (Segrete.jsx, CRAWLER_PUBLIC in data/segrete.js).
   I bottoni sopra i mostri (.cw-foe) sono trasparenti e seguono gli sprite: servono per mirare, per la
   scheda (pressione lunga) e come ancora degli effetti (data-vfx-target), come gli sprite classici. */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, getDoc, getDocs, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { heroActionList, targetKind, AFK_MS } from "../data/segreteEngine";
import { classInfo, clsStyle, sizeScale, diffOf } from "../data/segrete";
import { WEAPON_CHOICES, TWO_HANDED } from "../data/segreteKits";
import { classSpriteDocId } from "../data/arenaClassSprites";
import { showD20Roll, preloadDice3D, whenDiceIdle } from "../components/DiceRoll";
import { popAt, popTag } from "../fx/hitNumbers";
import { CrawlerEngine, CW_W, CW_H } from "../fx/crawlerEngine";
import { GLOVES, gloveOf, handSpec, handDoc, pairKey } from "../fx/crawlerArt";
// colpo d'arma? Le righe nuove lo dicono (w: 1, dal server); per le vecchie: forme da mischia, o freccia
// fisica (balestra). Freccia Acida e gli altri incantesimi hanno un elemento: partono dal focus.
const MELEE_FX = new Set(["slash", "smash", "thrust", "punch"]);
const isWeaponRow = (l) => (l.w != null ? !!l.w : MELEE_FX.has(l.fx) || (l.fx === "arrow" && (l.el || "physical") === "physical"));
import { bagOf, battleItem, itemTarget } from "../data/segreteItems";
import { SgIcon } from "../components/GameIcon";
import { sgTone } from "../data/segreteIcons";
import StatusPips from "../components/StatusPips";
import { useFightMode } from "../utils/fightMode";
import { VfxLayer } from "./WorldBossVfx";
import { leaveRoom, backToRoom } from "../utils/segreteRooms";
import { statusIcons, rowSide, LogText, FloorGains, SpoilsBox, FoeCard, actInfo } from "./SegreteBattle";
import "./SegreteBattle.css";
import "./SegreteCrawler.css";

const ROW_GAP_MS = 900;
const DICE_GAP_MS = 250;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vfxKey = (id) => `seg-${id}`;
const HAND_KEY = "seg-my-focus"; // la mano sinistra col focus, in basso a sinistra nella scena
let callable = null;
const segreteDo = (data) => { callable = callable || httpsCallable(functions, "segreteDo"); return callable(data).then((r) => r.data); };
const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const pipsOf = (c, round) => statusIcons(c, round || 1).map((i) => ({ k: i.k, icon: i.ico, tag: i.tag, dur: i.n ? String(i.n) : "", good: i.good, tip: `${i.t}${i.n ? ` · ${i.n} round` : ""}` }));
const stateOf = (c) => (c.fx?.petrified ? "stone" : c.fx?.frozen ? "ice" : "");

// tocco = bersaglio (al rilascio: il click sui telefoni a volte si perde), 450 ms premuto = scheda
function usePress(id, selectable, onPick, onInspect) {
  const lp = useRef({ t: null, fired: false, x: 0, y: 0, down: false, handled: false });
  const cancel = () => { clearTimeout(lp.current.t); lp.current.down = false; };
  return {
    onPointerDown: (e) => {
      lp.current = { ...lp.current, fired: false, handled: false, down: true, x: e.clientX, y: e.clientY };
      clearTimeout(lp.current.t);
      if (onInspect) lp.current.t = setTimeout(() => { lp.current.fired = true; onInspect(id); }, 450);
    },
    onPointerMove: (e) => { if (lp.current.down && Math.hypot(e.clientX - lp.current.x, e.clientY - lp.current.y) > 18) cancel(); },
    onPointerLeave: cancel, onPointerCancel: cancel,
    onPointerUp: (e) => {
      const was = lp.current.down;
      clearTimeout(lp.current.t); lp.current.down = false;
      if (!was || lp.current.fired || (e.button != null && e.button > 0)) return;
      lp.current.handled = true;
      if (selectable) onPick(id);
    },
    onClick: (e) => {
      if (lp.current.handled || lp.current.fired) { lp.current.handled = false; lp.current.fired = false; return; }
      if (e.detail === 0 && selectable) onPick(id); // tastiera
    },
    onContextMenu: (e) => { if (onInspect) { e.preventDefault(); onInspect(id); } },
  };
}

function FoeAnchor({ f, round, selectable, picked, onPick, onInspect, bind, onHover }) {
  const press = usePress(f.id, selectable, onPick, onInspect);
  const enter = () => onHover(f.id), leave = () => onHover(null);
  const pips = f.hp > 0 ? pipsOf(f, round) : [];
  return (
    <button type="button" ref={(el) => bind(f.id, el)} className={`cw-foe${selectable ? " is-pick" : ""}${picked ? " is-picked" : ""}${f.hp <= 0 ? " is-dead" : ""}`}
      data-vfx-target={vfxKey(f.id)} aria-disabled={!selectable} tabIndex={f.hp > 0 ? 0 : -1}
      aria-label={`${f.name}${f.hp <= 0 ? ", sconfitto" : ""} (tieni premuto per la scheda)`} {...press}
      onPointerEnter={enter} onFocus={enter} onBlur={leave}
      onPointerLeave={(e) => { leave(); press.onPointerLeave(e); }}>
      {!!pips.length && <StatusPips className="cw-pips" max={6} items={pips} />}
    </button>
  );
}

function PartySlot({ h, me, turn, done, selectable, picked, onPick, classSprite, round }) {
  const press = usePress(h.id, selectable, onPick, null);
  const dead = h.hp <= 0, pct = Math.max(0, Math.round((100 * h.hp) / Math.max(1, h.maxHp))), img = h.img || classSprite, pips = dead ? [] : pipsOf(h, round);
  return (
    <button type="button" className={`cw-pm${me ? " is-me" : ""}${turn ? " is-turn" : ""}${dead ? " is-dead" : ""}${selectable ? " is-pick" : ""}${picked ? " is-picked" : ""}`}
      style={clsStyle(h.cls)} aria-disabled={!selectable} aria-label={`${h.name}, ${classInfo(h.cls)?.it}, ${h.hp} su ${h.maxHp} PF`} {...press}>
      <span className="cw-pm-st">{!!pips.length && <StatusPips className="cw-pips" max={4} items={pips} />}</span>
      <span className="cw-face" data-vfx-target={vfxKey(h.id)}>
        {img ? <img src={img} alt="" draggable="false" /> : <SgIcon kind="cls" of={h.cls} fallback={classInfo(h.cls)?.icon} size="md" />}
        {done && <i className="cw-done" aria-hidden="true">✓</i>}
      </span>
      <b className="cw-nm">{h.helper ? "🤝 " : ""}{h.name}</b>
      <span className="cw-bar"><i className={pct < 30 ? "low" : ""} style={{ width: `${pct}%` }} /></span>
      <small>{dead ? (h.fled ? "fuggito" : "a terra") : `${h.hp}/${h.maxHp} · CA ${h.ac}`}</small>
    </button>
  );
}

export default function SegreteCrawler({ room, uid, tools }) {
  useFightMode(true);
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aiming, setAiming] = useState(null);
  const [err, setErr] = useState("");
  const [chosen, setChosen] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [sprites, setSprites] = useState({});
  const [vfxMsgs, setVfxMsgs] = useState([]);
  const [inspect, setInspect] = useState(null);
  const [shownSeq, setShownSeq] = useState(null);
  const [myChar, setMyChar] = useState(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [chosenItem, setChosenItem] = useState(null);
  const [known, setKnown] = useState({});
  const [fronts, setFronts] = useState({}); // id del bestiario → sprite frontale
  const [walking, setWalking] = useState(false);
  const [cv, setCv] = useState(null);
  const [fg, setFg] = useState(null);
  const [eng, setEng] = useState(null);
  const engRef = useRef(null);
  const initAsked = useRef("");
  const seenSeq = useRef(0);
  const seenKey = useRef(null); // avvio della partita a cui si riferisce seenSeq
  const timeoutAsked = useRef("");
  const floorSeen = useRef(null);
  const floorKey = useRef(null);

  useEffect(() => onSnapshot(doc(db, "dungeon_meta", "known"), (snap) => setKnown(snap.exists() ? snap.data().sources || {} : {}), () => {}), []);
  useEffect(() => { preloadDice3D(); }, []);
  useEffect(() => (uid ? onSnapshot(doc(db, "characters", uid), (snap) => setMyChar(snap.exists() ? snap.data() : null), () => {}) : undefined), [uid]);
  useEffect(() => onSnapshot(doc(db, "dungeon_runs", room.id), (s) => setRun(s.exists() ? s.data() : null), (e) => setErr(e.message)), [room.id]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    getDocs(collection(db, "dungeon_monsters")).then((s) => {
      const m = {}; s.docs.forEach((d) => { const u = d.data().frontImageUrl; if (u) m[d.id] = u; }); setFronts(m);
    }).catch(() => {});
  }, []);

  const startKey = room.startedAt?.toMillis ? room.startedAt.toMillis() : 0;
  useEffect(() => {
    if (room.status !== "running") return;
    if (run && run.startKey === startKey) return;
    const k = `${room.id}:${startKey}`;
    if (initAsked.current === k) return;
    initAsked.current = k;
    segreteDo({ op: "init", roomId: room.id }).catch((e) => setErr(e.message));
  }, [room.id, room.status, run, startKey]);

  const clsList = useMemo(() => [...new Set((run?.heroes || []).map((h) => h.cls))].join(","), [run?.heroes]);
  useEffect(() => {
    clsList.split(",").filter(Boolean).forEach((cls) => {
      if (sprites[cls] !== undefined) return;
      getDoc(doc(db, "arena_meta", classSpriteDocId(cls))).then((s) => setSprites((m) => ({ ...m, [cls]: s.exists() ? s.data().image || "" : "" }))).catch(() => {});
    });
  }, [clsList]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── il motore grafico ── */
  useEffect(() => {
    if (!cv || !fg) return undefined;
    const e = new CrawlerEngine(cv, fg);
    engRef.current = e; setEng(e);
    return () => { e.destroy(); engRef.current = null; setEng(null); };
  }, [cv, fg]);
  const dungeonType = run?.type || "";
  useEffect(() => {
    if (!eng || !dungeonType) return;
    eng.setTheme(dungeonType);
    getDoc(doc(db, "dungeon_tiles", dungeonType)).then((s) => { if (s.exists()) eng.setTheme(dungeonType, s.data()); }).catch(() => {});
  }, [eng, dungeonType]);

  const me = run?.heroes.find((h) => h.uid === uid) || null;
  const meRef = useRef(null);
  meRef.current = me;
  const weaponKey = me ? me.weapon || WEAPON_CHOICES[me.cls]?.[0] || "spada_lunga" : "";
  const spec = me ? handSpec(me, weaponKey, TWO_HANDED.has(weaponKey)) : null;
  const offKey = spec?.off || "", glove = spec?.glove || "";
  const specialKey = me?.wItem && !/_[12]$/.test(me.wItem) ? me.wItem : ""; // arma speciale: ha il suo sprite
  useEffect(() => {
    if (!eng || !weaponKey) return;
    const read = (k) => (k ? getDoc(doc(db, "dungeon_tiles", handDoc(k, glove))).then((s) => s.data()?.image || "").catch(() => "") : "");
    Promise.all([specialKey ? read(pairKey(specialKey, offKey)) : "", read(pairKey(weaponKey, offKey))]).then(([special, base]) => {
      eng.setHands(`${weaponKey}:${specialKey}:${offKey}:${glove}`, { main: weaponKey, off: offKey, pairUrl: special || base });
    });
  }, [eng, weaponKey, specialKey, offKey, glove]);

  // i PF sugli sprite scendono quando ARRIVA il colpo, non quando risponde il server
  const lag = useMemo(() => {
    const out = {};
    if (shownSeq != null) (run?.log || []).filter((l) => l.i > shownSeq).forEach((l) => Object.entries(l.nums || {}).forEach(([id, v]) => { out[id] = (out[id] || 0) + v; }));
    return out;
  }, [run?.log, shownSeq]);
  const shown = (c) => (lag[c.id] ? { ...c, hp: Math.max(0, Math.min(c.maxHp, c.hp - lag[c.id])) } : c);

  const foeList = (run?.foes || []).map((f0) => {
    const f = shown(f0);
    return { id: f.id, hp: f.hp, maxHp: f.maxHp, role: f.role, icon: f.icon, img: fronts[f.src] || f.img || "", scale: sizeScale(f), state: stateOf(f) };
  });
  const foeKey = JSON.stringify(foeList);
  useEffect(() => {
    if (!eng || !run) return;
    if (run.startKey !== startKey) return;
    if (floorSeen.current == null || floorKey.current !== startKey) { floorKey.current = startKey; floorSeen.current = run.floor; eng.setFoes(foeList); return; }
    if (run.floor !== floorSeen.current) {
      floorSeen.current = run.floor;
      setWalking(true);
      eng.walk(foeList).then(() => setWalking(false));
      return;
    }
    eng.setFoes(foeList);
  }, [eng, foeKey, run?.floor, startKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { eng?.setAim(aiming?.id); }, [eng, aiming]);
  const hover = (id) => engRef.current?.setHover(id);

  /* ── coda della lotta: dado → effetto → danno, una riga alla volta (come SegreteBattle) ── */
  const timers = useRef([]);
  const sendP = useRef(Promise.resolve());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; timers.current.forEach(clearTimeout); }; }, []);
  const queue = useRef(Promise.resolve());
  const queued = useRef(0);
  const [, setAnimating] = useState(false);
  useEffect(() => {
    if (!run?.log?.length || run.startKey !== startKey) return;
    const last = run.log[run.log.length - 1].i;
    if (seenKey.current !== startKey) { seenKey.current = startKey; seenSeq.current = last; setShownSeq(last); return; }
    const fresh = run.log.filter((l) => l.i > seenSeq.current);
    if (!fresh.length) return;
    seenSeq.current = last;
    const all = [...(run.heroes || []), ...(run.foes || [])];
    const nameOf = (id) => all.find((c) => c.id === id)?.name || "";
    const myId = `h_${uid}`;
    const focusHand = !!(meRef.current && GLOVES[gloveOf(meRef.current.cls)]?.focus);
    timers.current.push(setTimeout(() => setShownSeq((v) => Math.max(v || 0, last)), 15000 + fresh.length * 5000));
    queued.current += fresh.length;
    setAnimating(true);
    queue.current = queue.current.catch(() => {}).then(async () => {
      await sendP.current.catch(() => {});
      for (const l of fresh) {
        if (!mounted.current) return;
        if (l.roll?.nat && l.actor === myId) {
          const dice = (l.roll.dice || []).length > 1 ? l.roll.dice.map((v) => ({ value: v, dim: v !== l.roll.nat })) : undefined;
          await whenDiceIdle();
          await showD20Roll(l.roll.nat, { label: nameOf(l.actor), dice }).catch(() => {});
          await sleep(DICE_GAP_MS);
        }
        if (!mounted.current) return;
        const targets = l.targets || [];
        const tags = l.tags || {};
        const nums = l.nums ? Object.entries(l.nums).map(([id, v]) => ({ t: vfxKey(id), v, crit: l.kind === "crit", tag: tags[id] }))
          : l.dmg && targets.length === 1 ? [{ t: vfxKey(targets[0]), v: -l.dmg, crit: l.kind === "crit", tag: tags[targets[0]] }] : [];
        Object.entries(tags).forEach(([id, tag]) => { if (!nums.some((n) => n.t === vfxKey(id))) nums.push({ t: vfxKey(id), v: 0, tag }); });
        const e = engRef.current;
        const who = l.from || l.actor;
        const land = () => {
          setShownSeq((v) => Math.max(v || 0, l.i));
          if (l.kind === "miss") return;
          targets.forEach((id) => { if ((l.nums?.[id] ?? -1) < 0) { e?.flash(id); if (id === myId) e?.hurt(); } });
        };
        // chi agisce si muove: le tue armi, oppure il mostro che si fa avanti
        if (l.fx && who === myId) e?.attack(isWeaponRow(l) ? l.fx : "cast");
        else if (l.fx && who && String(who).startsWith("f")) e?.lunge(who);
        if (l.fx && targets.length) {
          await new Promise((res) => {
            let done = false;
            const finish = () => { if (done) return; done = true; land(); res(); };
            timers.current.push(setTimeout(finish, 3000));
            setVfxMsgs((m) => [...m.slice(-20), {
              id: `seg-${room.id}-${startKey}-${l.i}`, effect: l.fx, effectEl: l.el,
              effectTargets: targets.map(vfxKey),
              effectFrom: focusHand && who === myId && !isWeaponRow(l) ? HAND_KEY : l.from ? vfxKey(l.from) : undefined,
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
        await sleep(l.fx ? ROW_GAP_MS : l.roll ? 500 : 250);
        queued.current = Math.max(0, queued.current - 1);
      }
      if (!queued.current) setAnimating(false);
    }).catch(() => { queued.current = 0; setAnimating(false); });
    timers.current.push(setTimeout(() => { if (queued.current) { queued.current = 0; setAnimating(false); } }, 20000 + fresh.length * 5000));
    return undefined;
  }, [run?.log, room.id, startKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fighting = run?.status === "fight";
  const acted = run?.acted || {};
  const pending = fighting ? run.heroes.filter((h) => h.hp > 0 && !acted[h.id]) : [];
  const myTurn = !!(fighting && me && me.hp > 0 && !acted[me.id]);
  const afkLeft = fighting && pending.length ? AFK_MS - (now - (run.phaseAt || run.turnAt || now)) : null;

  useEffect(() => {
    if (!pending.length || afkLeft == null || afkLeft > 0) return;
    const k = `${startKey}:${run.floor}:${run.round}`;
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
      sendP.current = p.then(() => {});
      await p;
    } catch (e) { setErr(e.message || "Azione non riuscita."); }
    finally { setBusy(false); setChosen(null); setAiming(null); }
  };
  const pickAction = (a) => {
    if (!targetKind(a)) return send({ op: "act", actionId: a.id });
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
  const bind = (id, el) => engRef.current?.bindAnchor(id, el);

  if (!run || run.startKey !== startKey) {
    return <div className="sgb-loading">{err ? <p className="sgb-err">{err}</p> : <p>🗝 Le porte delle Segrete si aprono…</p>}</div>;
  }

  const itk = chosenItem ? itemTarget(chosenItem) : null;
  const tk = chosenItem ? (itk === "downed" ? "ally" : itk) : chosen ? targetKind(chosen) : null;
  eng?.setPickable(tk === "foe" && !aiming ? run.foes.filter((x) => shown(x).hp > 0).map((x) => x.id) : []);
  const pendingRows = shownSeq == null ? [] : run.log.filter((l) => l.i > shownSeq);
  const playing = pendingRows.length > 0;
  const heroIdSet = new Set((run.heroes || []).map((h) => h.id));
  const blocking = walking || pendingRows.some((l) => !(l.actor && heroIdSet.has(l.actor)) && l.kind !== "info" && l.kind !== "loot");
  const shownLog = run.log.filter((l) => shownSeq == null || l.i <= shownSeq);
  const last = shownLog[shownLog.length - 1] || run.log[run.log.length - 1];
  const acts = me ? heroActionList(me) : [];
  const bag = bagOf(myChar);
  const bagList = Object.entries(bag).map(([id, n]) => ({ ...battleItem(id), n })).filter((x) => x.id);
  const spoils = (run.spoils || {})[uid];

  return createPortal(
    <div className="sgb cw">
      <VfxLayer messages={vfxMsgs} selfUid={uid} canvas />
      {inspect && (() => {
        const f = run.foes.find((x) => x.id === inspect);
        return f ? <FoeCard f={f} known={!!known[f.src]} kills={known[f.src]?.count || 0} round={run.round} onClose={() => setInspect(null)} /> : null;
      })()}
      <div className="sgb-top cw-top">
        <span className="sgb-where">{run.dungeonIcon} {run.dungeonName}{run.diff && run.diff !== "facile" ? ` · ${diffOf(run.diff).icon} ${diffOf(run.diff).name}` : ""} · {run.boss ? "👑 Sala del boss" : `Sala ${run.floor}/${run.floors}`} · round {run.round}</span>
        {run.status === "fight" && me && me.hp > 0 && <button type="button" className="sgb-flee" onClick={flee}>🏃 Abbandona</button>}
      </div>

      <div className="cw-stage">
        <canvas ref={setCv} width={CW_W} height={CW_H} aria-label="La stanza del dungeon vista in prima persona" />
        <canvas ref={setFg} className="cw-fg" aria-hidden="true" />
        {me && GLOVES[gloveOf(me.cls)]?.focus && <span className="cw-hand" data-vfx-target={HAND_KEY} aria-hidden="true" />}
        {!walking && run.foes.map((f) => {
          const c = shown(f);
          return <FoeAnchor key={f.id} f={c} round={run.round} bind={bind} onHover={hover} onInspect={setInspect} onPick={pickTarget} picked={aiming?.id === f.id} selectable={!!(tk === "foe" && c.hp > 0 && !aiming)} />;
        })}
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

      <div className="sgb-panel cw-panel">
        {err && <p className="sgb-err" role="alert">{err}</p>}
        {walking && <p className="sgb-turn sgb-turn--wait">🚶 Il gruppo avanza verso la sala dopo…</p>}
        {!walking && run.status === "fight" && blocking && (
          <p className="sgb-turn sgb-turn--wait">🎬 Si tirano i dadi e partono i colpi… {myTurn ? "poi tocca a te." : ""}</p>
        )}
        {run.status === "fight" && !blocking && (myTurn ? (
          chosen || chosenItem ? (
            <div className="sgb-pickmsg">
              {aiming
                ? <span>⏳ {(chosenItem || chosen).icon} <b>{(chosenItem || chosen).name}</b> su <b>{aiming.name}</b>…</span>
                : <span>{(chosenItem || chosen).icon} <b>{(chosenItem || chosen).name}</b>: tocca {tk === "foe" ? "un nemico nella stanza" : itk === "downed" ? "un alleato a terra" : "te o un alleato nel party"}.</span>}
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
            <p className="sgb-endnote">Il gruppo e la chat vocale restano: tornati al gruppo potete scegliere il prossimo dungeon.</p>
          </div>
        )}
        {tools}
      </div>

      <div className="cw-party" style={{ "--cw-n": run.heroes.length }}>
        {run.heroes.map((h0) => {
          const h = shown(h0);
          return <PartySlot key={h.id} h={h} me={h.uid === uid} round={run.round} classSprite={sprites[h.cls]} turn={fighting && h.hp > 0 && !acted[h.id]} done={fighting && !!acted[h.id]}
            picked={aiming?.id === h.id} onPick={pickTarget}
            selectable={!aiming && !!(tk === "ally" && !h.fled && (itk === "downed" ? h.hp <= 0 : itk === "ally" ? h.hp > 0 : (h.hp > 0 || chosen?.kind === "heal")))} />;
        })}
      </div>
    </div>,
    document.body,
  );
}
