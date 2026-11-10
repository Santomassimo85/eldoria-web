/* Le Segrete: combattimento in prima persona, sincronizzato con dungeon_runs.
   Il server risolve le azioni; la coda mostra dado, effetto e danno in sequenza. */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, getDoc, getDocs, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { heroActionList, targetKind, AFK_MS } from "../data/segreteEngine";
import { classInfo, classColor, clsStyle, diffOf, sizeOf } from "../data/segrete";
import { WEAPON_CHOICES, TWO_HANDED } from "../data/segreteKits";
import { classSpriteDocId } from "../data/arenaClassSprites";
import { showD20Roll, preloadDice3D, whenDiceIdle } from "../components/DiceRoll";
import { popAt, popTag } from "../fx/hitNumbers";
import { CrawlerEngine, CW_W, CW_H } from "../fx/crawlerEngine";
import { armorGlove, handSpec, handDoc, pairKey } from "../fx/crawlerArt";
// colpo d'arma? Le righe nuove lo dicono (w: 1, dal server); per le vecchie: forme da mischia, o freccia
// fisica (balestra). Freccia Acida e gli altri incantesimi hanno un elemento: partono dal focus.
const MELEE_FX = new Set(["slash", "smash", "thrust", "punch"]);
const isWeaponRow = (l) => (l.w != null ? !!l.w : MELEE_FX.has(l.fx) || (l.fx === "arrow" && (l.el || "physical") === "physical"));
import { bagOf, battleItem, itemTarget, itemOf, COIN_ICON } from "../data/segreteItems";
import { SgIcon } from "../components/GameIcon";
import { sgTone } from "../data/segreteIcons";
import StatusPips from "../components/StatusPips";
import { useFightMode } from "../utils/fightMode";
import { VfxLayer } from "./WorldBossVfx";
import { leaveRoom, backToRoom } from "../utils/segreteRooms";
import { FloorGains, SpoilsBox, FoeCard } from "./SegreteCombatUI";
import { statusIcons, actInfo } from "../utils/segreteCombat";
import "./SegreteCombat.css";
import "./SegreteCrawler.css";

const ROW_GAP_MS = 900;
const DICE_GAP_MS = 250;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vfxKey = (id) => `seg-${id}`;
const BOW_KEY = "seg-my-bow"; // da dove parte la freccia in prima persona: l'arco, in basso al centro
const HAND_KEY = "seg-my-focus"; // la mano sinistra (focus, mano libera o scudo), in basso a sinistra nella scena
let callable = null;
const segreteDo = (data) => { callable = callable || httpsCallable(functions, "segreteDo"); return callable(data).then((r) => r.data); };
const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const pipsOf = (c, round) => statusIcons(c, round || 1).map((i) => ({ k: i.k, icon: i.ico, tag: i.tag, dur: i.n ? String(i.n) : "", good: i.good, tip: `${i.t}${i.n ? ` · ${i.n} round` : ""}` }));
/* CRONACA (2026-11-07): striscia e nomi col colore della classe per gli eroi, rosso per i mostri;
   "N danni" in arancione; il tiro per colpire in una pastiglia; sotto, il tiro dei dadi del danno (row.dr). */
const FOE_RED = "#ff6b5a";
const escRx = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function sideOf(l, run) {
  const id = l?.actor || l?.from, c = id ? [...(run.heroes || []), ...(run.foes || [])].find((x) => x.id === id) : null;
  return !c ? null : c.side === "h" ? classColor(c.cls) : FOE_RED;
}
const drText = (d) => {
  if (!d || !d.n) return "";
  const p = Number(d.p) || 0, x = Number(d.x) || 1;
  return `${d.n}d${d.s}: ${(d.r || []).join(" + ")}${p ? ` ${p > 0 ? "+" : "−"} ${Math.abs(p)}` : ""}${x !== 1 ? ` ×${String(x).replace(".", ",")}` : ""}`;
};
function CwLogText({ l, run }) {
  if (!l) return null;
  const people = [...(run.heroes || []).map((h) => ({ n: h.name, c: classColor(h.cls) })), ...(run.foes || []).map((f) => ({ n: f.name, c: FOE_RED }))]
    .filter((p) => p.n).sort((a, b) => b.n.length - a.n.length);
  const color = Object.fromEntries(people.map((p) => [p.n, p.c]));
  const rx = new RegExp(`(\\(🎲[^)]*\\))|(\\d+ danni)|(CRITICO!)${people.length ? `|(${people.map((p) => escRx(p.n)).join("|")})` : ""}`, "g");
  const out = [], txt = String(l.txt || "");
  let last = 0, m, k = 0;
  while ((m = rx.exec(txt))) {
    if (m.index > last) out.push(txt.slice(last, m.index));
    if (m[1]) out.push(<span key={k++} className="cw-lg-roll" style={{ "--side": sideOf(l, run) || "#c9bfad" }}>{m[1].slice(1, -1)}</span>);
    else if (m[2]) out.push(<b key={k++} className="cw-lg-dmg">{m[2]}</b>);
    else if (m[3]) out.push(<b key={k++} className="cw-lg-crit">{m[3]}</b>);
    else out.push(<b key={k++} className="cw-lg-name" style={{ color: color[m[0]] }}>{m[0]}</b>);
    last = rx.lastIndex;
  }
  if (last < txt.length) out.push(txt.slice(last));
  const dr = l.kind !== "miss" ? drText(l.dr) : "";
  return <>{out}{dr && <span className="cw-lg-dr">🎲 danno {dr}</span>}</>;
}

/* TAGLIE IN PRIMA PERSONA (2026-11-07): piccolo ~0,7, grande ~1,5, enorme quasi il doppio. */
const CW_SIZE = { tiny: 0.55, small: 0.72, medium: 1, large: 1.5, huge: 1.85, gargantuan: 2.15 };
const SMALL_RX = /goblin|coboldo|kobold|ratt[oi]|stirge|follett|spiritell|\bimp\b|pixie|gnom|halfling|pipistrell|mefit|ragnett|serpentell|lucertol|scheggia|ranocchi|lupacchiott|cucciol/i;
const LARGE_RX = /troll|ogre|orco gigante|gigant|giant|drag[oh]|golem|elemental|minotaur|basilisc|\borso\b|owlbear|ettin|wyvern|idra|hydra|ciclope|cyclop|treant|ent\b|mammut|behemoth|colosso/i;
function crawlerScale(f) {
  let size = sizeOf(f);
  if (size === "medium") size = SMALL_RX.test(f.name || "") ? "small" : LARGE_RX.test(f.name || "") ? "large" : "medium";
  return CW_SIZE[size] || 1;
}
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

function PartySlot({ h, turn, done, selectable, picked, onPick, classSprite, round }) {
  const press = usePress(h.id, selectable, onPick, null);
  const dead = h.hp <= 0, pct = Math.max(0, Math.round((100 * h.hp) / Math.max(1, h.maxHp))), img = h.img || classSprite, pips = dead ? [] : pipsOf(h, round);
  return (
    <button type="button" className={`cw-pm${turn ? " is-turn" : ""}${dead ? " is-dead" : ""}${selectable ? " is-pick" : ""}${picked ? " is-picked" : ""}`}
      style={clsStyle(h.cls)} aria-disabled={!selectable} aria-label={`${h.name}, ${classInfo(h.cls)?.it}, ${h.hp} su ${h.maxHp} PF`} {...press}>
      <span className="cw-face" data-vfx-target={vfxKey(h.id)}>
        {img ? <img src={img} alt="" draggable="false" /> : <SgIcon kind="cls" of={h.cls} fallback={classInfo(h.cls)?.icon} size="sm" />}
        {done && <i className="cw-done" aria-hidden="true">✓</i>}
      </span>
      <span className="cw-pm-txt">
        <b className="cw-nm">{h.helper ? "🤝 " : ""}{h.name}</b>
        <em className="cw-pm-cls">{classInfo(h.cls)?.it}{h.level ? ` · Lv ${h.level}` : ""}</em>
        <span className="cw-bar"><i className={pct < 30 ? "low" : ""} style={{ width: `${pct}%` }} /></span>
        <small>{dead ? (h.fled ? "fuggito" : "a terra") : `${h.hp}/${h.maxHp} · CA ${h.ac}`}</small>
      </span>
      {!!pips.length && <span className="cw-pm-st"><StatusPips className="cw-pips" max={3} items={pips} /></span>}
    </button>
  );
}
// il tuo eroe: barra larga sopra il log. È anche il bersaglio quando curi te stesso, e l'ancora dei numeri
function MeBar({ h, turn, done, selectable, picked, onPick, round }) {
  const press = usePress(h.id, selectable, onPick, null);
  const dead = h.hp <= 0, pct = Math.max(0, Math.round((100 * h.hp) / Math.max(1, h.maxHp))), pips = dead ? [] : pipsOf(h, round);
  return (
    <button type="button" className={`cw-me${turn ? " is-turn" : ""}${dead ? " is-dead" : ""}${selectable ? " is-pick" : ""}${picked ? " is-picked" : ""}`}
      style={clsStyle(h.cls)} data-vfx-target={vfxKey(h.id)} aria-disabled={!selectable}
      aria-label={`${h.name}, ${h.hp} su ${h.maxHp} punti ferita, CA ${h.ac}`} {...press}>
      <span className="cw-me-top">
        <b>{h.helper ? "🤝 " : ""}{h.name}</b>
        <em>{classInfo(h.cls)?.it} · Lv {h.level}</em>
        {done && <i className="cw-me-done">✓ hai agito</i>}
        {!!pips.length && <StatusPips className="cw-pips" max={6} items={pips} />}
      </span>
      <span className="cw-me-row">
        <span className="cw-me-bar"><i className={pct < 30 ? "low" : ""} style={{ width: `${pct}%` }} /></span>
        <span className="cw-me-hp">{dead ? (h.fled ? "fuggito" : "a terra") : <>{h.hp}<small>/{h.maxHp}</small></>}</span>
        <span className="cw-me-ca">CA {h.ac}</span>
      </span>
    </button>
  );
}

/* LO SCRIGNO SI APRE: coperchio e monete nella scena, poi gli oggetti uno alla volta. Per ogni oggetto
   ogni giocatore ha tirato un d20 (sul server): il tuo dado rotola davvero, poi si vedono tutti i tiri e chi vince. */
// le monete che salgono contando, come nei vecchi giochi
function CountUp({ to, ms = 900 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now(); let raf = 0;
    const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); setV(Math.round(to * k)); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}
function ChestReveal({ chest, uid, onDone }) {
  const [stage, setStage] = useState(0); // 0 si apre · 1 monete · 2+i oggetto i (2+n = fine)
  const [showRolls, setShowRolls] = useState(-1);
  useEffect(() => {
    let alive = true;
    (async () => {
      await sleep(1300); // intanto nella scena il coperchio si alza (lo apre la pagina appena arriva l'esito)
      if (!alive) return; setStage(1);
      await sleep(1100);
      for (let i = 0; i < chest.items.length; i++) {
        if (!alive) return;
        setStage(2 + i); setShowRolls(-1);
        const it = chest.items[i], mine = it.rolls.find((r) => r.uid === uid);
        await sleep(450);
        if (mine) { await whenDiceIdle(); await showD20Roll(mine.v, { label: `Scrigno: ${itemOf(it.id)?.name || it.id}` }).catch(() => {}); }
        if (!alive) return;
        setShowRolls(i);
        await sleep(1400);
      }
      if (alive) setStage(2 + chest.items.length);
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const done = stage >= 2 + chest.items.length;
  return (
    <div className="sgb-end cw-reveal">
      <p className="cw-reveal-head"><span>✦ TESORO ✦</span>{chest.by} apre lo scrigno!</p>
      {stage >= 1 && <p className="cw-reveal-coins"><i aria-hidden="true" />+<b><CountUp to={chest.coins} /></b> Monete Antiche a testa</p>}
      {!chest.items.length && stage >= 1 && <p className="cw-reveal-none">Nessun oggetto, solo monete.</p>}
      <ul className="cw-reveal-items">
        {chest.items.map((it, i) => {
          if (stage < 2 + i) return null;
          const item = itemOf(it.id), shown = showRolls >= i || stage > 2 + i, rolls = it.rerolls ? it.rerolls[it.rerolls.length - 1] : it.rolls;
          return (
            <li key={i} className={it.rare ? "is-rare" : ""}>
              <span className="cw-reveal-it"><span className="cw-reveal-ico">{item?.icon || "🎁"}</span><b>{item?.name || it.id}</b>{it.rare ? <em>RARO!</em> : null}</span>
              {shown ? (
                <span className="cw-reveal-rolls">
                  {it.rolls.map((r) => <span key={r.uid} className={r.uid === it.winner && !it.rerolls ? "win" : ""}>🎲 {r.uid === uid ? "Tu" : r.name} {r.v}</span>)}
                  {it.rerolls && <span className="tie">pareggio, si ritira: {rolls.map((r) => `${r.uid === uid ? "Tu" : r.name} ${r.v}`).join(" · ")}</span>}
                  <b className={`cw-reveal-win${it.winner === uid ? " is-me" : ""}`}>▶ {it.winner === uid ? "È TUO!" : it.winnerName || "nessuno"}</b>
                </span>
              ) : <span className="cw-reveal-rolls">🎲 si tira…</span>}
            </li>
          );
        })}
      </ul>
      {done && <button type="button" className="sgb-btn cw-reveal-ok" onClick={onDone}>▶ Continua</button>}
    </div>
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
  // armatura speciale con il suo aspetto (2026-11-08): maniche e guanti suoi
  const armorKey = me?.armorItem && itemOf(me.armorItem)?.look ? me.armorItem : "";
  useEffect(() => {
    if (!eng || !weaponKey) return;
    // empty = lo stesso sprite con la freccia già scoccata (arco e balestra)
    const read = (k, gl = glove) => (k ? getDoc(doc(db, "dungeon_tiles", handDoc(k, gl))).then((s) => s.data() || {}).catch(() => ({})) : Promise.resolve({}));
    Promise.all([
      specialKey ? read(pairKey(specialKey, offKey)) : {},
      armorKey ? read(pairKey(weaponKey, offKey), armorGlove(armorKey)) : {},
      read(pairKey(weaponKey, offKey)),
      glove === "wraps" ? read(pairKey("pugni", "mirror")) : {},
    ]).then(([special, armor, base, fists]) => {
      const use = special.image ? special : armor.image ? armor : base;
      eng.setHands(`${weaponKey}:${specialKey}:${armorKey}:${offKey}:${glove}`, { main: weaponKey, off: offKey, pairUrl: use.image || "", pairEmptyUrl: use.empty || "", punchPairUrl: fists.image || "" });
    });
  }, [eng, weaponKey, specialKey, armorKey, offKey, glove]);

  // i PF sugli sprite scendono quando ARRIVA il colpo, non quando risponde il server
  const lag = useMemo(() => {
    const out = {};
    if (shownSeq != null) (run?.log || []).filter((l) => l.i > shownSeq).forEach((l) => Object.entries(l.nums || {}).forEach(([id, v]) => { out[id] = (out[id] || 0) + v; }));
    return out;
  }, [run?.log, shownSeq]);
  const shown = (c) => (lag[c.id] ? { ...c, hp: Math.max(0, Math.min(c.maxHp, c.hp - lag[c.id])) } : c);

  const foeList = (run?.foes || []).map((f0) => {
    const f = shown(f0);
    return { id: f.id, name: f.name, hp: f.hp, maxHp: f.maxHp, role: f.role, icon: f.icon, img: fronts[f.src] || f.img || "", scale: crawlerScale(f), state: stateOf(f) };
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
  // lo scrigno: c'è nella sala del tesoro; a partita già vinta (ricarica) resta aperto e non si rianima
  const [chestDone, setChestDone] = useState(false);
  const chestSeen = useRef(null);
  const chestOpened = useRef(null);
  useEffect(() => {
    if (!eng || !run || run.startKey !== startKey) return;
    if (chestSeen.current !== startKey) { chestSeen.current = startKey; setChestDone(run.status === "won"); }
    if (run.status === "treasure") eng.setChest("closed");
    else if (run.status === "won" && run.chest) { eng.setChest(chestDone ? "open" : "closed"); if (!chestDone && chestOpened.current !== startKey) { chestOpened.current = startKey; eng.openChest(); } }
    else eng.setChest(null);
  }, [eng, run?.status, run?.chest, run?.treasure, startKey, chestDone]); // eslint-disable-line react-hooks/exhaustive-deps
  // nessuno lo apre: dopo un minuto e mezzo lo apre il server (lo chiede chiunque del gruppo)
  const chestAsked = useRef("");
  useEffect(() => {
    if (run?.status !== "treasure") return undefined;
    const k = `${startKey}:chest`;
    const t = setTimeout(() => { if (chestAsked.current === k) return; chestAsked.current = k; segreteDo({ op: "timeout", roomId: room.id }).catch(() => {}); }, 95000);
    return () => clearTimeout(t);
  }, [run?.status, startKey, room.id]);
  const hover = (id) => engRef.current?.setHover(id);

  /* ── coda della lotta: dado → effetto → danno, una riga alla volta ── */
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
    const focusHand = !!meRef.current; // 2026-11-07: gli incantesimi di TUTTE le classi partono dalla mano sinistra
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
        // con l'arco la freccia parte allo scocco, non quando le mani iniziano a tendere
        const myShot = l.fx === "arrow" && who === myId && isWeaponRow(l) && e?.ranged;
        let handAnimation;
        if (l.fx && who === myId) handAnimation = e?.attack(isWeaponRow(l) ? l.fx : "cast", { hand: l.hand || "R", unarmed: !!l.unarmed });
        else if (l.fx && who && String(who).startsWith("f")) e?.lunge(who);
        if (myShot) await sleep(e.releaseMs());
        if (l.fx && targets.length) {
          await new Promise((res) => {
            let done = false;
            const finish = () => { if (done) return; done = true; land(); res(); };
            timers.current.push(setTimeout(finish, 3000));
            setVfxMsgs((m) => [...m.slice(-20), {
              id: `seg-${room.id}-${startKey}-${l.i}`, effect: l.fx, effectEl: l.el,
              effectTargets: targets.map(vfxKey),
              effectFrom: myShot ? BOW_KEY : focusHand && who === myId && !isWeaponRow(l) ? HAND_KEY : l.from ? vfxKey(l.from) : undefined,
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
        if (handAnimation) await handAnimation;
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
  const openChest = () => { if (!busy) send({ op: "chest" }); };
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
        return f ? <FoeCard f={{ ...f, frontImg: fronts[f.src] || f.frontImg }} known={!!known[f.src]} kills={known[f.src]?.count || 0} round={run.round} onClose={() => setInspect(null)} /> : null;
      })()}
      <div className="sgb-top cw-top">
        <span className="sgb-where">{run.dungeonIcon} {run.dungeonName}{run.diff && run.diff !== "facile" ? ` · ${diffOf(run.diff).icon} ${diffOf(run.diff).name}` : ""} · {run.treasure ? "💰 Sala del tesoro" : run.boss ? "👑 Sala del boss" : `Sala ${run.floor}/${run.floors}`} · round {run.round}</span>
        {run.status === "fight" && me && me.hp > 0 && <button type="button" className="sgb-flee" onClick={flee}>🏃 Abbandona</button>}
      </div>

      <div className="cw-stage">
        <canvas ref={setCv} width={CW_W} height={CW_H} aria-label="La stanza del dungeon vista in prima persona" />
        <canvas ref={setFg} className="cw-fg" aria-hidden="true" />
        {me && <span className="cw-hand" data-vfx-target={HAND_KEY} aria-hidden="true" />}
        {me && <span className="cw-bow" data-vfx-target={BOW_KEY} aria-hidden="true" />}
        {run.status === "treasure" && !walking && (
          <button type="button" className="cw-chest" ref={(el) => bind("chest", el)} disabled={busy} onClick={openChest} aria-label="Apri lo scrigno">
            <span>{busy ? "…" : "Toccami!"}</span>
          </button>
        )}
        {!walking && run.foes.map((f) => {
          const c = shown(f);
          return <FoeAnchor key={f.id} f={c} round={run.round} bind={bind} onHover={hover} onInspect={setInspect} onPick={pickTarget} picked={aiming?.id === f.id} selectable={!!(tk === "foe" && c.hp > 0 && !aiming)} />;
        })}
      </div>

      {me && (() => {
        const h = shown(me);
        return <MeBar h={h} round={run.round} turn={fighting && h.hp > 0 && !acted[h.id]} done={fighting && !!acted[h.id]} picked={aiming?.id === h.id} onPick={pickTarget}
          selectable={!aiming && !!(tk === "ally" && !h.fled && (itk === "downed" ? h.hp <= 0 : itk === "ally" ? h.hp > 0 : (h.hp > 0 || chosen?.kind === "heal")))} />;
      })()}
      <button type="button" className="sgb-log" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen}>
        <span className="sgb-log-text cw-log-text" key={last?.i} style={{ "--side": sideOf(last, run) || "transparent" }}><CwLogText l={last} run={run} /></span>
        <span className="sgb-log-n">{logOpen ? "▴" : "▾"}</span>
      </button>
      {logOpen && (
        <ol className="sgb-log-list">
          {[...shownLog].reverse().map((l) => <li key={l.i} className={`cw-lg k-${l.kind || ""}`} style={{ "--side": sideOf(l, run) || "transparent" }}><CwLogText l={l} run={run} /></li>)}
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
        {run.status === "treasure" && (
          <div className="sgb-end cw-chest-msg">
            <p>💰 <b>In fondo alla sala c'è uno scrigno.</b> Uno di voi lo apre per tutti: monete in più a testa, e gli oggetti si tirano col dado.</p>
            <button type="button" className="sgb-btn" disabled={busy} onClick={openChest}>{busy ? "⏳ Apro…" : "💰 Apri lo scrigno"}</button>
          </div>
        )}
        {run.status === "won" && run.chest && !chestDone && (
          <ChestReveal chest={run.chest} uid={uid} onDone={() => setChestDone(true)} />
        )}
        {!playing && (run.status === "lost" || (run.status === "won" && (!run.chest || chestDone))) && (
          <div className="sgb-end">
            <p className="sgb-result">{run.mimic?.result === "lost" ? "Il Mimic vi ha sconfitti: scrigno perduto, bottino precedente e PE conservati." : run.status === "won" ? `🏆 Vittoria! ${run.dungeonName} è vostro.` : "☠ Sconfitta. Le Segrete vi hanno inghiottito: tutto è perduto."}</p>
            {(run.levelUps || []).map((l) => <p key={l.uid}>⭐ {l.name} ({classInfo(l.cls)?.it}): +{(l.xp || 0).toLocaleString("it-IT")} PE{l.to > l.from ? <> · <b>sale al livello {l.to}!</b> Passa dalla lobby per i punti e le scelte nuove.</> : ""}</p>)}
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

      {run.heroes.some((h) => h.uid !== uid) && <div className="cw-party" style={{ "--cw-n": run.heroes.filter((h) => h.uid !== uid).length }}>
        {run.heroes.filter((h) => h.uid !== uid).map((h0) => {
          const h = shown(h0);
          return <PartySlot key={h.id} h={h} round={run.round} classSprite={sprites[h.cls]} turn={fighting && h.hp > 0 && !acted[h.id]} done={fighting && !!acted[h.id]}
            picked={aiming?.id === h.id} onPick={pickTarget}
            selectable={!aiming && !!(tk === "ally" && !h.fled && (itk === "downed" ? h.hp <= 0 : itk === "ally" ? h.hp > 0 : (h.hp > 0 || chosen?.kind === "heal")))} />;
        })}
      </div>}
    </div>,
    document.body,
  );
}
