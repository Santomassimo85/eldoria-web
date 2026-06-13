/* ============================================================
   GameTable — MTGA-style board, Magic colored-mana rules.

   Zones, top → bottom:
     opponent hand (face-down, per-element backs)
     opponent lands · opponent creatures
     ───────────── center divider ─────────────
     my creatures · my lands (+ artifacts)
     my hand (fanned)

   Avatar pods float on the LEFT edge; the big action button is
   on the RIGHT rail. Lands auto-tap to pay costs (like MTGA).
   ============================================================ */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CardView from "./CardView.jsx";
import CardZoom from "./CardZoom.jsx";
import { FloatingLayer, TurnBanner, SpellBurst, EndOverlay } from "./Fx.jsx";
import {
  getCard, ELEMENT_PIP, ELEMENT_LABEL, coverUrl, cardArtUrl,
} from "../../tcg/cards.js";
import {
  playCard, declareAttackers, confirmBlocks, endTurn, forfeit,
  canPlay, canAttack, spellTargets, effStats, opp, reviveState,
  discardCard, HAND_CAP, passPriority, START_HP,
  legalBlockers, activateUltimate, canActivateUltimate, ultimateBlockReason,
  resolveCombatPending, forceEndTurn,
} from "../../tcg/engine.js";
import ClassPanel from "./ClassPanel.jsx";
import {
  nextAction as aiNext, chooseBlocks as aiBlocks, respondToStack,
} from "../../tcg/ai.js";
import {
  pushState, heartbeat, opponentGone, sendEmote, sendCardReaction,
  deleteMatch, leaveMatch,
} from "../../tcg/net.js";
import { TCG_COINS } from "../../tcg/collection.js";
import { playSfx } from "../../utils/tcgSfx.js";

const EMOTES = [
  "Ben giocato!",
  "Per gli dèi!",
  "Tornerò!",
  "Tira iniziativa!",
  "Per la corona di Eldoria!",
  "Hai pescato bene, eh?",
];
const EMOTE_COOLDOWN_MS = 60 * 1000; // 1 minuto fra un emote e l'altro

// Tempo massimo per turno: scaduto, il turno passa automaticamente.
const TURN_MS = 2 * 60 * 1000; // 2 minuti per turno
// Il giocatore NON attivo fa da fallback (se l'attivo è in background e il
// suo timer è "congelato" dal browser) con un piccolo ritardo extra.
const TURN_FALLBACK_MS = 15 * 1000;
// Durata massima di una partita: scaduta, il match si chiude senza
// vincitore e senza premi, i giocatori vengono espulsi.
const MATCH_MS = 3 * 60 * 60 * 1000; // 3 ore

const tsMillis = (t) =>
  t && typeof t.toMillis === "function" ? t.toMillis() : t ? +new Date(t) : 0;
const fmtClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};

/* Mana gems — one gem per ELEMENT instead of one per land (saves room
   on phones). Each gem shows the count overlaid on the diamond. Spent
   mana (tapped lands) gets a separate half-coloured / half-grey gem so
   you can tell at a glance "X available, Y already used" without the
   panel growing with every extra land.
   Element order is stable for a calm UI. */
const MANA_ELEMENT_ORDER = ["fire", "water", "nature", "light", "darkness"];
function ManaRow({ lands }) {
  if (!lands.length) return <span className="tcg-mana__none">nessuna terra</span>;
  const groups = {};
  for (const l of lands) {
    const g = groups[l.element] || (groups[l.element] = { avail: 0, spent: 0 });
    if (l.tapped) g.spent += 1; else g.avail += 1;
  }
  const ordered = MANA_ELEMENT_ORDER.filter((el) => groups[el]);
  for (const el of Object.keys(groups)) if (!ordered.includes(el)) ordered.push(el);
  return (
    <div className="tcg-mana" title="Mana disponibile · speso">
      {ordered.map((el) => {
        const g = groups[el];
        return (
          <React.Fragment key={el}>
            {g.avail > 0 && (
              <span
                className="tcg-mana__gem"
                style={{ "--pip": ELEMENT_PIP[el] }}
                title={`${ELEMENT_LABEL[el]} · ${g.avail} disponibili`}
              >
                <span className="tcg-mana__num">{g.avail}</span>
              </span>
            )}
            {g.spent > 0 && (
              <span
                className="tcg-mana__gem is-spent"
                style={{ "--pip": ELEMENT_PIP[el] }}
                title={`${ELEMENT_LABEL[el]} · ${g.spent} usati`}
              >
                <span className="tcg-mana__num">{g.spent}</span>
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* Floating player panel — NO background, doesn't block the field.
   Name, HP bar with the number ON it, mana, and a visible deck
   pile (the player's chosen cover) + hand/graveyard counts. */
function AvatarPod({
  p, top, cover, side, targetable, onClick, onDragOver, onDrop,
}) {
  const pct = Math.max(0, Math.min(100, (p.hp / START_HP) * 100));
  const temp = p.tempHp || 0;
  // Striscia blu degli HP temporanei: parte da dove finisce la barra rossa.
  // Scala come gli HP normali (1 punto = 1/START_HP della barra). Cappata
  // così la somma non eccede mai il 100% visivo; l'eventuale eccedenza
  // resta visibile come testo "+N".
  const tempPctRaw = (temp / START_HP) * 100;
  const tempPctVisible = Math.max(0, Math.min(100 - pct, tempPctRaw));
  return (
    <div
      className={`tcg-pod ${top ? "tcg-pod--foe" : "tcg-pod--me"} ${
        targetable ? "is-targetable" : ""
      }`}
      data-hero={side}
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span className="tcg-pod__name">{p.name}</span>
      <div
        className="tcg-pod__hpbar"
        title={temp > 0 ? `${p.hp} PV (+${temp} temporanei)` : `${p.hp} PV`}
      >
        <span className="tcg-pod__hpfill" style={{ width: pct + "%" }} />
        {temp > 0 && tempPctVisible > 0 && (
          <span
            className="tcg-pod__hpfill-temp"
            style={{ left: pct + "%", width: tempPctVisible + "%" }}
            aria-hidden="true"
          />
        )}
        <span className="tcg-pod__hpnum">
          {p.hp}
          {temp > 0 && (
            <span className="tcg-pod__hptemp" title={`${temp} PV temporanei`}>
              {" "}+{temp}
            </span>
          )}
        </span>
      </div>
      <div className="tcg-pod__row">
        <span className="tcg-pod__deck" title="Carte nel mazzo">
          <img
            className="tcg-pod__deckimg"
            src={coverUrl(cover)}
            alt=""
            draggable={false}
          />
          <b>{p.deck.length}</b>
        </span>
        <span className="tcg-pod__z" title="Carte in mano">
          ✋ {p.hand.length}
        </span>
        <span className="tcg-pod__z" title="Cimitero">
          ⚰️ {p.graveyard.length}
        </span>
        <ManaRow lands={p.lands} />
      </div>
    </div>
  );
}

export default function GameTable({
  mode,
  initialState,
  match,
  matchId,
  mySide: mySideProp,
  onExit,
  onRematch,
  onGameEnd,
  myCover = "nature",
  foeCover = "darkness",
}) {
  const isAi = mode === "ai";
  const mySide = isAi ? "p0" : mySideProp;
  const foeSide = opp(mySide);

  // chosen card-back covers (PvP: from the match doc; AI: props)
  const coverMe = isAi
    ? myCover
    : (match?.covers && match.covers[mySide]) || myCover || "nature";
  const coverFoe = isAi
    ? foeCover
    : (match?.covers && match.covers[foeSide]) || foeCover || "darkness";

  const [local, setLocal] = useState(initialState);
  // PvP: reviveState() builds a NEW object every call. Memoise it on the
  // raw match.state reference so `state` is stable between renders and
  // doesn't retrigger every [state]-dep effect (→ infinite render loop).
  const rawState = match?.state;
  const state = useMemo(
    () => (isAi ? local : reviveState(rawState)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAi, local, rawState]
  );

  const stateRef = useRef(state);
  stateRef.current = state;
  const applyState = (next) => {
    if (!next || next === stateRef.current) return;
    if (isAi) setLocal(next);
    else pushState(matchId, next).catch(() => {});
  };

  const [sel, setSel] = useState(null);
  const [attackers, setAttackers] = useState([]);
  const [blkAtk, setBlkAtk] = useState(null);
  const [blocks, setBlocks] = useState({});
  // foe (AI) blocks shown briefly before damage so arrows are visible
  const [previewBlocks, setPreviewBlocks] = useState(null);
  // bumped on resize so combat arrows recompute their coordinates
  const [arrowTick, setArrowTick] = useState(0);
  const [shake, setShake] = useState(null);
  const [inspect, setInspect] = useState(null);
  // hand starts grouped/closed on the right; first tap fans it open
  const [handOpen, setHandOpen] = useState(false);
  // discard mode (hand over the cap → must throw cards away)
  const [discarding, setDiscarding] = useState(false);

  const [floats, setFloats] = useState([]);
  const [burst, setBurst] = useState(null);
  const [banner, setBanner] = useState(null);
  // class system: animated toast that fires when somebody levels up
  const [levelToast, setLevelToast] = useState(null);
  const [hitShake, setHitShake] = useState(0);
  const [ghosts, setGhosts] = useState([]);
  const [emoteBubble, setEmoteBubble] = useState(null);
  // reazioni emoji su carta: spawn locale + animazione (anche per le mie
  // reazioni, così c'è feedback immediato). Auto-cleanup ~1.8s.
  const [cardReacts, setCardReacts] = useState([]);
  const reactSeq = useRef(0);
  const cardReactTs = useRef(0);
  // Cooldown locale per gli emote: dopo un click i bottoni si disabilitano
  // per EMOTE_COOLDOWN_MS, ma il sistema resta SEMPRE riutilizzabile (non
  // si "rompe" come prima). emoteCdEnd è il timestamp di fine cooldown.
  const [emoteCdEnd, setEmoteCdEnd] = useState(0);
  const [emoteNowTick, setEmoteNowTick] = useState(0);
  const [arrows, setArrows] = useState([]);
  // exact pixel size of the table → SVG viewBox, so arrow coords
  // (computed in table-px) map 1:1 and never "wrap" off-canvas
  const [svgBox, setSvgBox] = useState({ w: 0, h: 0 });
  // combat cinematic: creatures crumbling + cards being struck
  const [dyingIds, setDyingIds] = useState([]);
  const [combatShake, setCombatShake] = useState([]);
  // staged damage overlay: { [instId]: newDamageTotal }. Set as soon as
  // the damage float lands so the card's HP visibly drops in lockstep
  // with the floating number, then cleared when applyState commits.
  const [dmgOverlay, setDmgOverlay] = useState({});
  // drag&drop from hand: instId being dragged + a flag for styling
  const [dragging, setDragging] = useState(false);
  const dragInst = useRef(null);
  const tableRef = useRef(null);
  const lastFx = useRef(0);
  const fxReady = useRef(isAi);
  const floatSeq = useRef(0);
  const emoteTs = useRef(0);
  const endedRef = useRef(false);
  const cineRef = useRef(false);
  const cineTimers = useRef([]);
  // timer 2 minuti/turno: quando cambia il numero del turno ne registro
  // l'istante d'inizio (clock locale, come heartbeat/emote)
  const turnStartRef = useRef({ turn: -1, at: 0 });
  // istante d'inizio partita per il match timer da 3 ore.
  // PvP: ancora su `startedAt` (scritto quando entrambi confermano il
  // mulligan), coerente fra i client e sopravvive ai reconnect. MAI sul
  // createdAt: i match torneo nascono all'avvio del round, anche giorni
  // prima che si giochi — l'ancora sul createdAt faceva scadere il match
  // all'istante ed espelleva i giocatori appena entrati. Finché startedAt
  // non è ancora arrivato nello snapshot, fallback sul mount locale.
  const matchStartRef = useRef(null);
  if (matchStartRef.current == null) {
    matchStartRef.current = Date.now();
  }
  const matchStart = isAi
    ? matchStartRef.current
    : tsMillis(match?.startedAt) || matchStartRef.current;
  const [clockTick, setClockTick] = useState(0); // re-render per i countdown
  const [matchExpired, setMatchExpired] = useState(false);

  // award coins / notify exactly once when the game ends
  useEffect(() => {
    if (!state || !state.winner || endedRef.current) return;
    endedRef.current = true;
    const w = state.winner;
    const r = w === "draw" ? "draw" : w === mySide ? "win" : "lose";
    // la resa è segnalata dall'engine: l'hook lo propaga così i premi
    // possono essere soppressi a monte (awardFor in Tcg.jsx).
    if (onGameEnd) onGameEnd(r, { byForfeit: state.endReason === "forfeit" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state && state.winner]);

  // registra l'inizio di ogni turno (per il countdown dei 2 minuti)
  useEffect(() => {
    if (!state || state.winner) return;
    if (turnStartRef.current.turn !== state.turn) {
      turnStartRef.current = { turn: state.turn, at: Date.now() };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state && state.turn, state && state.winner]);

  // tick 1s per aggiornare i countdown (turno + partita) finché si gioca
  useEffect(() => {
    if (!state || state.winner || matchExpired) return;
    const iv = setInterval(() => setClockTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state && state.winner, matchExpired]);

  // TIMER 2 MINUTI/TURNO: se il giocatore attivo non agisce, il turno passa.
  // L'attivo applica allo scadere; l'avversario fa da rete di sicurezza con
  // un piccolo ritardo (caso tab in background dell'attivo). forceEndTurn è
  // idempotente: agisce solo sul turno corretto e altrimenti è un no-op.
  useEffect(() => {
    if (!state || state.winner || matchExpired) return;
    if (isAi && state.active !== mySide) return; // in AI l'IA gestisce il suo turno
    const amActive = state.active === mySide;
    const start = turnStartRef.current.at || Date.now();
    const fireAt = start + TURN_MS + (amActive ? 0 : TURN_FALLBACK_MS);
    const delay = Math.max(0, fireAt - Date.now());
    const t = setTimeout(() => {
      const s = stateRef.current;
      if (!s || s.winner || s.active !== state.active) return;
      const next = forceEndTurn(s, s.active);
      if (next !== s) applyState(next);
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state && state.turn, state && state.active, state && state.winner, matchExpired, isAi, mySide]);

  // MATCH TIMER 3 ORE: scaduto, chiudi il match (nessun vincitore, nessun
  // premio) ed espelli i giocatori.
  useEffect(() => {
    if (!state || state.winner || matchExpired) return;
    const fireAt = matchStart + MATCH_MS;
    const delay = fireAt - Date.now();
    const expire = () => {
      endedRef.current = true; // blocca qualsiasi erogazione premi
      setMatchExpired(true);
      if (!isAi && matchId) leaveMatch(matchId); // → doc "ended": espelle entrambi
      setTimeout(() => { if (onExit) onExit(); }, 5000);
    };
    if (delay <= 0) { expire(); return; }
    const t = setTimeout(expire, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state && state.winner, matchExpired, isAi, matchId, matchStart]);

  const pushFloat = (zone, text, tone) => {
    const pos = {
      "foe-hero": { x: 12, y: 16 },
      "me-hero": { x: 12, y: 84 },
      "foe-board": { x: 52 + (Math.random() * 24 - 12), y: 34 },
      "me-board": { x: 52 + (Math.random() * 24 - 12), y: 66 },
    }[zone] || { x: 50, y: 50 };
    const id = ++floatSeq.current;
    setFloats((f) => [...f, { id, text, tone, ...pos }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1600);
  };

  // Screen-space (viewport-relative) center. The arrow SVG is portaled to
  // <body> so its coord system IS the viewport — no rotation/parent
  // transform can skew the math (force-landscape rotates the board −90°
  // on portrait phones, which used to mis-map these coordinates).
  const centerOf = (sel) => {
    const el = tableRef.current && tableRef.current.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  // damage/heal number pinned to a specific card or hero pod
  const anchorFloat = (sel, text, tone, big) => {
    const root = tableRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const el = root.querySelector(sel);
    if (!el || !rect.width) return;
    const r = el.getBoundingClientRect();
    const x = ((r.left - rect.left + r.width / 2) / rect.width) * 100;
    const y = ((r.top - rect.top + r.height / 2) / rect.height) * 100;
    const id = ++floatSeq.current;
    setFloats((f) => [...f, { id, text, tone, x, y, big }]);
    cineTimers.current.push(
      setTimeout(
        () => setFloats((f) => f.filter((z) => z.id !== id)),
        big ? 1900 : 1500
      )
    );
  };

  // Staged combat resolution. The engine resolves a fight atomically,
  // so we DON'T apply the result immediately: we keep the pre-combat
  // board on screen and play it out beat by beat, anchoring every
  // damage number to the card/hero that took it, so the player can
  // read exactly why one creature died and the other survived.
  // Pre-state here is already at step="after_blocks" (blocks declared,
  // post-blocks priority window closed). We compute resolveCombatPending
  // to find out what WILL happen, then animate it before committing.
  const runCombatCinematic = (pre) => {
    if (cineRef.current) return;
    const next = resolveCombatPending(pre);
    if (next === pre) return; // engine refused → nothing to animate
    const baseId = lastFx.current;
    const fresh = next.fx.filter((e) => e.id > baseId);
    if (!fresh.some((e) => e.kind === "attack")) {
      // no real combat (e.g. Nebbia cancelled the damage)
      applyState(next);
      return;
    }
    cineRef.current = true;
    const T = (fn, ms) => cineTimers.current.push(setTimeout(fn, ms));
    const dmg = fresh.filter((e) =>
      ["damageCreature", "damageHero", "shield", "healHero", "regen"].includes(
        e.kind
      )
    );
    const deaths = fresh.filter((e) => e.kind === "death");
    const win = fresh.find((e) => e.kind === "win");

    // look up a creature by instId in the PRE-combat state (so we can
    // add the incoming damage on top of the damage it already had)
    const findCr = (instId) => {
      for (const sd of ["p0", "p1"]) {
        const c = pre.players[sd].battlefield.find((x) => x.instId === instId);
        if (c) return c;
      }
      return null;
    };

    // beat 1 — the clash
    playSfx("attack");
    setHitShake((n) => n + 1);
    T(() => setHitShake((n) => Math.max(0, n - 1)), 420);

    // beat 2 — damage numbers AND HP drop together (≈0.55s after clash)
    T(() => {
      const hit = [];
      const overlay = {};
      dmg.forEach((e) => {
        if (e.kind === "damageCreature") {
          anchorFloat(`[data-inst="${e.instId}"]`, `-${e.amount}`, "dmg", true);
          const cur = findCr(e.instId);
          overlay[e.instId] =
            (overlay[e.instId] != null ? overlay[e.instId] : (cur?.damage || 0))
            + e.amount;
          hit.push(e.instId);
        } else if (e.kind === "damageHero") {
          anchorFloat(`[data-hero="${e.side}"]`, `-${e.amount}`, "dmg", true);
          setHitShake((n) => n + 1);
          T(() => setHitShake((n) => Math.max(0, n - 1)), 420);
        } else if (e.kind === "healHero") {
          anchorFloat(`[data-hero="${e.side}"]`, `+${e.amount}`, "heal", false);
        } else if (e.kind === "shield") {
          anchorFloat(`[data-inst="${e.instId}"]`, "🛡", "heal", true);
        } else if (e.kind === "regen") {
          anchorFloat(`[data-inst="${e.instId}"]`, "↻", "heal", true);
        }
      });
      if (Object.keys(overlay).length) setDmgOverlay(overlay);
      if (hit.length) {
        playSfx("attack");
        setCombatShake(hit);
        T(() => setCombatShake([]), 380);
      }
    }, 550);

    // beat 3 — lethal creatures crumble in place
    T(() => {
      if (deaths.length) {
        setDyingIds(deaths.map((e) => e.instId));
        playSfx("death");
      }
    }, 1350);

    // beat 4 — commit the resolved board (2s total → snappy but readable)
    T(() => {
      lastFx.current = next.fx.length
        ? next.fx[next.fx.length - 1].id
        : baseId;
      if (win)
        playSfx(
          win.winner === "draw"
            ? "lose"
            : win.winner === mySide
            ? "win"
            : "lose"
        );
      setDyingIds([]);
      setCombatShake([]);
      setDmgOverlay({});
      setPreviewBlocks(null);
      setBlocks({});
      setBlkAtk(null);
      cineRef.current = false;
      applyState(next);
    }, 2000);
  };

  // drop pending cinematic timers if we leave the table
  useEffect(
    () => () => {
      cineTimers.current.forEach(clearTimeout);
      cineTimers.current = [];
    },
    []
  );

  // === COMBAT DAMAGE TRIGGER ==================================
  // When the engine sits at combat.step="after_blocks" with the stack
  // empty and no priority holder, both players have finished firing
  // instants/pumps — time to resolve damage. We play the cinematic on
  // the pre-damage state, then commit the resolved state.
  // PvP guard: in network play only ONE client should push the resolved
  // state (the attacker's), otherwise we'd race and double-commit.
  useEffect(() => {
    if (!state || !state.combat) return;
    if (state.combat.step !== "after_blocks") return;
    if (state.priority || state.stack.length) return;
    if (cineRef.current) return;
    if (!isAi && mySide !== state.combat.attackerSide) return;
    runCombatCinematic(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isAi, mySide]);

  // recompute combat arrows on resize / orientation flip / mobile-browser
  // chrome shifts (iOS address bar collapsing changes innerHeight)
  useEffect(() => {
    const on = () => setArrowTick((n) => n + 1);
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", on);
      vv.addEventListener("scroll", on);
    }
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
      if (vv) {
        vv.removeEventListener("resize", on);
        vv.removeEventListener("scroll", on);
      }
    };
  }, []);

  // LIVE combat arrows, drawn from the declared combat — never from
  // already-resolved state, so the trajectory is always correct:
  //   • red  = an attack going through to the enemy hero (unblocked)
  //   • blue = an attack stopped by a defending creature (blocked)
  useLayoutEffect(() => {
    const root = tableRef.current;
    if (!state || !root) {
      setArrows([]);
      return;
    }
    // SVG is portaled to <body> — viewport-sized so its viewBox is in
    // screen pixels (matches what getBoundingClientRect returns).
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setSvgBox((b) =>
      Math.round(b.w) === Math.round(vw) &&
      Math.round(b.h) === Math.round(vh)
        ? b
        : { w: vw, h: vh }
    );
    const C = centerOf;
    const out = [];

    // 1) while I'm choosing attackers → arrows toward the enemy hero
    if (
      state.active === mySide &&
      state.phase === "main" &&
      attackers.length
    ) {
      const to = C(`[data-hero="${foeSide}"]`);
      for (const id of attackers) {
        const from = C(`[data-inst="${id}"]`);
        if (from && to) out.push({ id: `sel-${id}`, from, to, kind: "atk" });
      }
    }

    // 2) combat declared → show every attacker's real trajectory
    if (state.phase === "block" && state.combat) {
      const aSide = state.combat.attackerSide;
      const dSide = opp(aSide);
      // who blocks: my live picks if I defend, else the AI preview
      const src =
        aSide === foeSide
          ? blocks
          : previewBlocks || state.combat.blocks || {};
      const heroPt = C(`[data-hero="${dSide}"]`);
      for (const atkId of state.combat.attackers) {
        const from = C(`[data-inst="${atkId}"]`);
        if (!from) continue;
        const bl = src[atkId] || [];
        if (bl.length) {
          for (const bId of bl) {
            const to = C(`[data-inst="${bId}"]`);
            if (to) out.push({ id: `b-${atkId}-${bId}`, from, to, kind: "blocked" });
          }
        } else if (heroPt) {
          out.push({ id: `h-${atkId}`, from, to: heroPt, kind: "atk" });
        }
      }
    }
    // bail the state update when the arrows are unchanged, so a churning
    // `state` reference can never drive an infinite render loop
    setArrows((prev) => {
      if (
        prev.length === out.length &&
        prev.every((a, i) => {
          const b = out[i];
          return (
            b &&
            a.id === b.id &&
            a.kind === b.kind &&
            a.from?.x === b.from?.x &&
            a.from?.y === b.from?.y &&
            a.to?.x === b.to?.x &&
            a.to?.y === b.to?.y
          );
        })
      ) {
        return prev;
      }
      return out;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, attackers, blocks, previewBlocks, mySide, foeSide, arrowTick]);

  useEffect(() => {
    if (!state || !state.fx.length) return;
    if (!fxReady.current) {
      fxReady.current = true;
      lastFx.current = state.fx[state.fx.length - 1].id;
      return;
    }
    const fresh = state.fx.filter((e) => e.id > lastFx.current);
    if (!fresh.length) return;
    lastFx.current = state.fx[state.fx.length - 1].id;
    let shakeBump = false;
    fresh.forEach((e) => {
      switch (e.kind) {
        case "attack":
          playSfx("attack");
          shakeBump = true;
          break;
        case "damageHero":
          anchorFloat(`[data-hero="${e.side}"]`, `-${e.amount}`, "dmg", true);
          shakeBump = true;
          break;
        case "healHero":
          anchorFloat(`[data-hero="${e.side}"]`, `+${e.amount}`, "heal", false);
          playSfx("heal");
          break;
        case "damageCreature":
          // pin the damage number to the SPECIFIC card that was hit, so
          // the player can read which creature took how much (instead of
          // a generic board-anchored float). The card's HP plate already
          // shows the new value because state has been applied here.
          anchorFloat(`[data-inst="${e.instId}"]`, `-${e.amount}`, "dmg", true);
          break;
        case "death": {
          const card = getCard(e.cardId);
          playSfx("death");
          if (card) {
            const gid = ++floatSeq.current;
            setGhosts((g) => [...g, { gid, card }]);
            setTimeout(
              () => setGhosts((g) => g.filter((x) => x.gid !== gid)),
              1400
            );
          }
          break;
        }
        case "spell": {
          const bid = e.id;
          setBurst({ id: bid, element: e.element });
          playSfx(
            e.element === "fire" ? "cinder" : e.element === "darkness" ? "veil" : "play"
          );
          setTimeout(
            () => setBurst((b) => (b && b.id === bid ? null : b)),
            1200
          );
          break;
        }
        case "play":
          playSfx("play");
          break;
        case "turn": {
          const k = e.id;
          setBanner({ key: k, mine: e.side === mySide });
          playSfx("turn");
          setTimeout(
            () => setBanner((b) => (b && b.key === k ? null : b)),
            1700
          );
          break;
        }
        case "win":
          playSfx(
            e.winner === "draw" ? "lose" : e.winner === mySide ? "win" : "lose"
          );
          break;
        case "xpGain":
          // tiny floating "+N XP" near the affected hero — feedback that
          // the class meter ticked. Skipped for the silent upkeep tick.
          if (e.reason !== "upkeep") {
            pushFloat(
              e.side === mySide ? "me-hero" : "foe-hero",
              `+${e.amount} XP`, "xp"
            );
          }
          break;
        case "levelUp": {
          const tid = e.id;
          setLevelToast({
            id: tid,
            mine: e.side === mySide,
            level: e.level,
            name: e.name,
          });
          playSfx("win"); // celebratory cue
          setTimeout(
            () => setLevelToast((t) => (t && t.id === tid ? null : t)),
            2600
          );
          break;
        }
        case "ultimate": {
          // brief flash + sfx; the perk-driven effect itself is logged by engine
          const bid = e.id;
          setBurst({ id: bid, element: "luce" });
          playSfx("win");
          setTimeout(
            () => setBurst((b) => (b && b.id === bid ? null : b)),
            1400
          );
          break;
        }
        default:
          break;
      }
    });
    if (shakeBump) {
      setHitShake((n) => n + 1);
      setTimeout(() => setHitShake((n) => Math.max(0, n - 1)), 480);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state && state.fx]);

  // ---------- AI driver ----------
  useEffect(() => {
    if (!isAi || !state || state.winner) return;
    let t;
    if (state.priority === "p1") {
      // AI holds priority on the stack → respond with an instant or pass
      t = setTimeout(() => {
        const s = stateRef.current;
        if (!s || s.winner || s.priority !== "p1") return;
        const r = respondToStack(s, "p1");
        if (r.type === "instant")
          applyState(playCard(s, "p1", r.instId, r.target));
        else applyState(passPriority(s, "p1"));
      }, 950);
    } else if (state.priority === "p0") {
      // the player's response window — the player's UI handles it
    } else if (
      state.active === "p1" &&
      state.phase === "main" &&
      !state.stack.length
    ) {
      t = setTimeout(() => {
        const s = stateRef.current;
        if (!s || s.winner || s.active !== "p1" || s.phase !== "main") return;
        if (s.stack.length || s.priority) return;
        const act = aiNext(s, "p1");
        if (act.type === "land" || act.type === "play")
          applyState(playCard(s, "p1", act.instId, act.target));
        else if (act.type === "ultimate")
          applyState(activateUltimate(s, "p1"));
        else if (act.type === "attack")
          applyState(declareAttackers(s, "p1", act.attackerIds));
        else if (act.type === "discard")
          applyState(discardCard(s, "p1", act.instId));
        else applyState(endTurn(s, "p1"));
      }, 1500);
    } else if (
      state.phase === "block" &&
      state.combat &&
      state.combat.attackerSide === "p0" &&
      state.combat.step === "declare_blocks" &&
      !state.stack.length &&
      !state.priority
    ) {
      // AI is defender at the dedicated block step. Pick blocks, flash
      // them as arrows for ~1.2s so the player sees who's defending,
      // then call confirmBlocks — the engine moves to "after_blocks"
      // and the post-blocks priority window opens. Damage resolves later,
      // via the cinematic useEffect, once both sides pass priority.
      t = setTimeout(() => {
        const s = stateRef.current;
        if (!s || s.phase !== "block" || s.combat?.step !== "declare_blocks") return;
        const b = aiBlocks(s, "p1");
        setPreviewBlocks(b);
        t = setTimeout(() => {
          const s2 = stateRef.current;
          if (!s2 || s2.combat?.step !== "declare_blocks") return;
          applyState(confirmBlocks(s2, "p1", b));
        }, 1200);
      }, 1300);
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isAi]);

  // human auto-pass: if I hold priority but have no instant I could
  // cast in response, pass automatically so normal games never stall.
  // Combat now opens up to 2 priority windows per fight, so each window
  // is short (250ms) when there's nothing to cast — keeps the rhythm
  // brisk while still leaving time to react in the rare case the player
  // actually has a relevant instant.
  useEffect(() => {
    const s = state;
    if (!s || !s.players || s.winner || s.priority !== mySide) return;
    const hand = s.players[mySide]?.hand || [];
    const canRespond = hand.some((h) => {
      const c = getCard(h.cardId);
      return c && c.type === "spell" && canPlay(s, mySide, h.instId);
    });
    if (canRespond) return; // let the player decide
    const t = setTimeout(() => {
      const cur = stateRef.current;
      if (cur && !cur.winner && cur.priority === mySide)
        applyState(passPriority(cur, mySide));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mySide]);

  useEffect(() => {
    if (isAi || !matchId) return;
    heartbeat(matchId, mySide);
    const iv = setInterval(() => heartbeat(matchId, mySide), 15000);
    return () => clearInterval(iv);
  }, [isAi, matchId, mySide]);

  useEffect(() => {
    if (isAi || !match?.emote) return;
    if (match.emote.ts && match.emote.ts !== emoteTs.current) {
      emoteTs.current = match.emote.ts;
      setEmoteBubble({ ...match.emote });
      const t = setTimeout(() => setEmoteBubble(null), 2000);
      return () => clearTimeout(t);
    }
  }, [isAi, match]);

  // Spawn locale di una reazione emoji "appiccicata" a una carta. Posiziona
  // l'emoji al centro della carta target (in coord % rispetto al tavolo).
  // Funziona sia per le reazioni mie (eco immediata al click) sia per
  // quelle che arrivano dall'avversario via Firestore.
  const spawnCardReact = (instId, emoji) => {
    const root = tableRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-inst="${instId}"]`);
    const rect = root.getBoundingClientRect();
    if (!el || !rect.width) return;
    const r = el.getBoundingClientRect();
    const x = ((r.left - rect.left + r.width / 2) / rect.width) * 100;
    const y = ((r.top - rect.top + r.height / 2) / rect.height) * 100;
    const id = ++reactSeq.current;
    setCardReacts((arr) => [...arr, { id, emoji, x, y }]);
    setTimeout(
      () => setCardReacts((arr) => arr.filter((z) => z.id !== id)),
      1800
    );
  };

  // Reazioni che arrivano dall'avversario (PvP) via Firestore: spawn
  // locale identico alle mie. Idempotente sul ts.
  useEffect(() => {
    if (isAi || !match?.cardReact) return;
    const r = match.cardReact;
    if (!r.ts || r.ts === cardReactTs.current) return;
    cardReactTs.current = r.ts;
    // skip echo: la mia reazione l'ho già fatta apparire localmente al click
    if (r.side === mySide) return;
    spawnCardReact(r.instId, r.emoji);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAi, match, mySide]);

  // Click su un'emoji del picker di una carta. Spawn locale immediato +
  // (PvP) push su Firestore. In AI mode è puramente locale: niente
  // backend, ma è comunque carino come feedback in single player.
  const reactToCard = (instId) => (emoji) => {
    spawnCardReact(instId, emoji);
    if (!isAi && matchId) sendCardReaction(matchId, mySide, instId, emoji);
  };

  // Tick 1s mentre c'è cooldown emote attivo: aggiorna emoteNowTick così
  // il countdown sui bottoni si re-renderizza e si auto-riabilita allo
  // scadere senza un secondo click.
  useEffect(() => {
    if (emoteCdEnd <= Date.now()) return;
    const iv = setInterval(() => setEmoteNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [emoteCdEnd]);

  if (!state || !state.players) {
    // Stato del match assente/incompleto: senza questo escape il giocatore
    // resta bloccato in "Caricamento partita…" all'infinito (es. torneo
    // chiuso col match mai realmente partito). Diamo sempre una via d'uscita.
    return (
      <div className="tcg-table tcg-table--loading">
        <div className="tcg-waiting__spinner" />
        <p>Caricamento partita…</p>
        <button
          className="tcg-btn tcg-btn--primary"
          style={{ marginTop: 18 }}
          onClick={() => {
            // Non basta tornare indietro: il match va abbandonato e chiuso,
            // altrimenti resta "active" e la lobby ci ri-trascina nel limbo.
            // leaveMatch cancella (se sei host) o segna "ended" (se sei p1).
            if (!isAi && matchId) leaveMatch(matchId);
            if (onExit) onExit();
          }}
        >
          ← Abbandona partita
        </button>
      </div>
    );
  }

  const me = state.players[mySide];
  const foe = state.players[foeSide];
  const winner = state.winner;

  const canMainAct =
    !winner && state.phase === "main" && state.active === mySide;
  // Only enable the block UI during the dedicated block step. While the
  // engine sits in "after_attackers" or "after_blocks" priority windows
  // the defender's role is "react with instants or pass", not click on
  // creatures to assign blockers — confirmBlocks would refuse anyway.
  const canBlockNow =
    !winner &&
    state.phase === "block" &&
    state.combat &&
    state.combat.attackerSide === foeSide &&
    state.combat.step === "declare_blocks";
  // which of my creatures may legally block the selected attacker
  // (engine enforces Volare → only Volare/Portata, tapped, gang use…)
  const legalBlkIds =
    canBlockNow && blkAtk ? legalBlockers(state, blkAtk) : [];
  const canBlockSel = (instId) => legalBlkIds.includes(instId);
  const iAmAttackerWaiting =
    state.phase === "block" &&
    state.combat &&
    state.combat.attackerSide === mySide;

  const selCard = sel
    ? getCard(me.hand.find((h) => h.instId === sel)?.cardId)
    : null;
  const tg = sel
    ? spellTargets(state, mySide, sel)
    : { kind: "none", creatures: [], heroes: [] };

  const oppLost = !isAi && !winner && opponentGone(match, mySide);

  const reject = (id) => {
    setShake(id);
    setTimeout(() => setShake((x) => (x === id ? null : x)), 420);
  };

  const onHandCard = (hc) => {
    // discard mode (only on your own main turn)
    if (canMainAct && (discarding || me.hand.length > HAND_CAP)) {
      applyState(discardCard(state, mySide, hc.instId));
      if (me.hand.length - 1 <= HAND_CAP) setDiscarding(false);
      return;
    }
    const card = getCard(hc.cardId);
    // canPlay already enforces sorcery vs instant timing (incl. windows)
    if (!canPlay(state, mySide, hc.instId)) {
      reject(hc.instId);
      return;
    }
    if (card.type === "land") {
      applyState(playCard(state, mySide, hc.instId));
      setSel(null);
      setHandOpen(false);
      return;
    }
    const needsTarget =
      card.type === "spell" &&
      spellTargets(state, mySide, hc.instId).kind !== "none";
    if (needsTarget) {
      setSel((s) => (s === hc.instId ? null : hc.instId));
      setAttackers([]);
      return;
    }
    if (sel === hc.instId) {
      applyState(playCard(state, mySide, hc.instId, null));
      setSel(null);
      setHandOpen(false);
    } else {
      setSel(hc.instId);
      setAttackers([]);
    }
  };

  const tryCastOn = (target) => {
    if (!sel) return false;
    const ok =
      (target.type === "creature" &&
        tg.creatures.some((c) => c.instId === target.instId)) ||
      (target.type === "hero" && tg.heroes.includes(target.side));
    if (!ok) {
      reject(target.instId || target.side);
      return false;
    }
    applyState(playCard(state, mySide, sel, target));
    setSel(null);
    setHandOpen(false);
    return true;
  };

  /* ---------- drag & drop from hand ---------- */
  const beginDrag = (hc) => (e) => {
    dragInst.current = hc.instId;
    setDragging(true);
    setSel(null);
    try {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(hc.instId));
    } catch {
      /* some browsers throw on setData — drag still works via the ref */
    }
  };
  const endDrag = () => {
    dragInst.current = null;
    setDragging(false);
  };
  const allowDrop = (e) => {
    if (dragInst.current == null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // dropped on the table / my field → play it straight away
  // (lands, creatures, no-target spells). Targeted spells get selected
  // so the next tap/drop picks the target.
  const dropToPlay = (e) => {
    if (dragInst.current == null) return;
    e.preventDefault();
    const id = dragInst.current;
    endDrag();
    const hc = me.hand.find((h) => h.instId === id);
    if (!hc) return;
    if (canMainAct && (discarding || me.hand.length > HAND_CAP)) {
      applyState(discardCard(state, mySide, hc.instId));
      if (me.hand.length - 1 <= HAND_CAP) setDiscarding(false);
      return;
    }
    const card = getCard(hc.cardId);
    if (!canPlay(state, mySide, hc.instId)) {
      reject(hc.instId);
      return;
    }
    if (card.type === "land") {
      applyState(playCard(state, mySide, hc.instId));
      setSel(null);
      setHandOpen(false);
      return;
    }
    const needsTarget =
      card.type === "spell" &&
      spellTargets(state, mySide, hc.instId).kind !== "none";
    if (needsTarget) {
      setSel(hc.instId);
      setAttackers([]);
      setHandOpen(true);
      return;
    }
    applyState(playCard(state, mySide, hc.instId, null));
    setSel(null);
    setHandOpen(false);
  };

  // dropped directly on a creature / hero → cast a targeted spell on it
  const dropOnTarget = (target) => (e) => {
    if (dragInst.current == null) return;
    e.preventDefault();
    e.stopPropagation();
    const id = dragInst.current;
    endDrag();
    const hc = me.hand.find((h) => h.instId === id);
    if (!hc) return;
    const card = getCard(hc.cardId);
    if (card.type !== "spell" || !canPlay(state, mySide, hc.instId)) {
      reject(hc.instId);
      return;
    }
    const t = spellTargets(state, mySide, hc.instId);
    const ok =
      (target.type === "creature" &&
        t.creatures.some((c) => c.instId === target.instId)) ||
      (target.type === "hero" && t.heroes.includes(target.side));
    if (!ok) {
      reject(target.instId || target.side);
      return;
    }
    applyState(playCard(state, mySide, hc.instId, target));
    setSel(null);
    setHandOpen(false);
  };

  const onMyCreature = (cr) => {
    if (sel && selCard?.type === "spell") {
      tryCastOn({ type: "creature", side: mySide, instId: cr.instId });
      return;
    }
    if (canBlockNow && blkAtk) {
      // a creature with neither Volare nor Portata cannot block a
      // flier — refuse it visibly instead of silently dropping it
      if (!canBlockSel(cr.instId)) {
        reject(cr.instId);
        return;
      }
      setBlocks((b) => {
        const nb = {};
        // a creature can only block one attacker → drop it elsewhere
        for (const k of Object.keys(b))
          nb[k] = (b[k] || []).filter((x) => x !== cr.instId);
        const cur = nb[blkAtk] || [];
        nb[blkAtk] = cur.includes(cr.instId)
          ? cur.filter((x) => x !== cr.instId) // tap again = unassign
          : [...cur, cr.instId];               // add another blocker
        for (const k of Object.keys(nb))
          if (!nb[k] || !nb[k].length) delete nb[k];
        return nb;
      });
      // keep the attacker selected so more blockers can be added
      return;
    }
    if (canMainAct && canAttack(state, mySide, cr.instId)) {
      setAttackers((a) =>
        a.includes(cr.instId)
          ? a.filter((x) => x !== cr.instId)
          : [...a, cr.instId]
      );
    } else if (canMainAct) {
      reject(cr.instId);
    }
  };

  const onFoeCreature = (cr) => {
    if (sel && selCard?.type === "spell") {
      tryCastOn({ type: "creature", side: foeSide, instId: cr.instId });
      return;
    }
    if (canBlockNow && state.combat.attackers.includes(cr.instId)) {
      setBlkAtk((x) => (x === cr.instId ? null : cr.instId));
    }
  };

  const onHero = (side) => {
    if (sel && selCard?.type === "spell") tryCastOn({ type: "hero", side });
  };

  const doAttack = () => {
    if (!attackers.length) return;
    applyState(declareAttackers(state, mySide, attackers));
    setAttackers([]);
    setSel(null);
  };

  const doConfirmBlocks = (skip) => {
    // Just commit the blocks; the engine transitions to step="after_blocks"
    // and opens the attacker's priority window. The cinematic will fire
    // later (via the after_blocks useEffect) once both pass with an
    // empty stack — giving both players the chance to fire instants.
    applyState(confirmBlocks(state, mySide, skip ? {} : blocks));
    setBlkAtk(null);
  };

  const myPriority = !winner && state.priority === mySide;
  const stackOpen = (state.stack && state.stack.length > 0) || !!state.priority;
  const doPass = () => {
    if (!myPriority) return;
    applyState(passPriority(state, mySide));
    setSel(null);
  };

  const doEndTurn = () => {
    if (!canMainAct) return;
    if (me.hand.length > HAND_CAP) {
      setDiscarding(true);
      setHandOpen(true);
      return;
    }
    // endTurn() ritorna lo stato INVARIATO se è rimasta aperta una finestra di
    // priorità o c'è qualcosa sulla pila: in quel caso applyState non farebbe
    // nulla ("non succede niente al click"). Se non avanza, forziamo la
    // chiusura del turno risolvendo le finestre pendenti (come fa il timer).
    let next = endTurn(state, mySide);
    if (next === state) next = forceEndTurn(state, mySide);
    applyState(next);
    setSel(null);
    setAttackers([]);
    setDiscarding(false);
  };

  const doForfeit = () => {
    if (winner) return;
    applyState(forfeit(state, mySide));
  };

  const claimWin = () => applyState(forfeit(state, foeSide));

  const handleExit = () => {
    if (!isAi && winner && matchId && match?.challenger?.uid && mySide === "p0")
      deleteMatch(matchId);
    onExit();
  };

  const liveStats = (side, cr) => {
    const e = effStats(state, side, cr);
    const ov = dmgOverlay[cr.instId];
    return {
      power: e.power,
      toughness: e.toughness,
      damage: ov != null ? ov : (cr.damage || 0),
      tapped: cr.tapped,
      sick: cr.sick,
    };
  };

  const result = winner
    ? winner === "draw"
      ? "draw"
      : winner === mySide
      ? "win"
      : "lose"
    : null;

  // end-of-match recap data — reads from the SAME constant as
  // `awardFor` in Tcg.jsx so the displayed number matches what
  // actually lands on the player's tcgCoins. (Previously the panel
  // showed 30/60 while only 5/15 were granted → user-visible bug.)
  const COIN_TABLE = isAi ? TCG_COINS.ai : TCG_COINS.pvp;
  // La resa non eroga premi: il pannello mostra 0 così combacia con ciò che
  // viene davvero accreditato (awardFor scarta i match conclusi per resa).
  const byForfeit = state.endReason === "forfeit";
  const endCoins = result ? (byForfeit ? 0 : COIN_TABLE[result] ?? 0) : null;
  const winnerName =
    !winner || winner === "draw"
      ? null
      : state.players[winner]?.name || (winner === mySide ? "Tu" : "Avversario");

  // countdown turno (2 min) e partita (3h). `clockTick` forza il refresh.
  void clockTick;
  // se l'effect non ha ancora registrato questo turno, considera il tempo
  // pieno (evita un lampo di "0:00" al primo render del nuovo turno).
  const turnStartedAt =
    turnStartRef.current.turn === state.turn ? turnStartRef.current.at : Date.now();
  const turnRemain = winner
    ? null
    : Math.max(0, TURN_MS - (Date.now() - turnStartedAt));
  const myTurnNow = !winner && state.active === mySide;
  const turnLow = turnRemain != null && turnRemain <= 30 * 1000;
  const matchRemain = winner
    ? null
    : Math.max(0, matchStart + MATCH_MS - Date.now());

  const statusLine = winner
    ? "Partita conclusa"
    : myPriority
    ? state.combat
      ? "Combatti — lancia un istantaneo o passa"
      : "Pila aperta — rispondi con un istante o passa"
    : stackOpen
    ? "Risoluzione della pila…"
    : canBlockNow
    ? "Dichiara i bloccanti (anche più di uno)"
    : iAmAttackerWaiting
    ? state.combat?.step === "after_attackers"
      ? "L'avversario può rispondere…"
      : state.combat?.step === "after_blocks"
      ? "Bloccanti dichiarati — pila aperta…"
      : "Attendi i bloccanti avversari…"
    : canMainAct && me.hand.length > HAND_CAP
    ? `Scarta ${me.hand.length - HAND_CAP} carta/e`
    : canMainAct && state.attackedThisTurn
    ? "Fase principale 2 — gioca, poi Fine turno"
    : canMainAct
    ? "Fase principale 1 — gioca o attacca"
    : isAi
    ? "L'IA sta pensando…"
    : "Turno dell'avversario…";

  const targetableFoeHero =
    sel && selCard?.type === "spell" && tg.heroes.includes(foeSide);
  const targetableMeHero =
    sel && selCard?.type === "spell" && tg.heroes.includes(mySide);

  const fanStyle = (i, n, open = true) => {
    if (n <= 1) return {};
    const mid = (n - 1) / 2;
    const off = i - mid;
    if (!open) {
      // closed: a tight, almost-square stack tilted slightly right
      return {
        transform: `rotate(${off * 1.4}deg) translateY(${
          -Math.abs(off) * 1.2
        }px)`,
        transformOrigin: "bottom center",
        zIndex: 30 + i,
      };
    }
    const spread = Math.min(4, 16 / n);
    return {
      transform: `rotate(${off * spread}deg) translateY(${
        -Math.abs(off) * Math.min(4, 22 / n)
      }px)`,
      transformOrigin: "bottom center",
      zIndex: 30 + i,
    };
  };


  const overCap = canMainAct ? me.hand.length - HAND_CAP : 0;

  // All creatures of mine that may legally attack right now (live engine
  // check — summoning sickness, tap state, "defender", combat phase, etc).
  // Empty when it's not my main phase or I've already attacked this turn.
  // Note: `myCreatures` alias is declared further down; reach into
  // me.battlefield directly so we stay above the TDZ.
  const eligibleAttackerIds =
    canMainAct && !state.attackedThisTurn
      ? me.battlefield
          .filter((cr) => canAttack(state, mySide, cr.instId))
          .map((cr) => cr.instId)
      : [];

  // One-click "attack with every eligible creature". Builds a fresh
  // attacker list straight from the engine's canAttack so the player
  // doesn't have to tap-select each one.
  const doAttackAll = () => {
    if (!eligibleAttackerIds.length) return;
    applyState(declareAttackers(state, mySide, eligibleAttackerIds));
    setAttackers([]);
    setSel(null);
  };

  const RailAction = () => {
    if (winner) return null;
    if (myPriority) {
      return (
        <button className="tcg-bigbtn tcg-bigbtn--pass" onClick={doPass}>
          ⏭️ PASSA
        </button>
      );
    }
    if (overCap > 0) {
      return (
        <button
          className="tcg-bigbtn tcg-bigbtn--discard"
          onClick={() => {
            setDiscarding(true);
            setHandOpen(true);
          }}
        >
          🗑️ SCARTA{"\n"}({overCap})
        </button>
      );
    }
    if (canBlockNow) {
      return (
        <>
          <button
            className="tcg-bigbtn tcg-bigbtn--go"
            onClick={() => doConfirmBlocks(false)}
          >
            Conferma{"\n"}blocchi
          </button>
          <button className="tcg-railbtn" onClick={() => doConfirmBlocks(true)}>
            Non bloccare
          </button>
        </>
      );
    }
    if (attackers.length) {
      // also expose "tutte" so the player can promote a partial pick to
      // a full charge without having to deselect/reselect every creature
      const canPromote = eligibleAttackerIds.length > attackers.length;
      return (
        <>
          <button className="tcg-bigbtn tcg-bigbtn--atk" onClick={doAttack}>
            ⚔️ Attacca{"\n"}({attackers.length})
          </button>
          {canPromote && (
            <button
              className="tcg-railbtn"
              onClick={doAttackAll}
              title="Attacca con tutte le creature pronte"
            >
              ⚔️ TUTTE{"\n"}({eligibleAttackerIds.length})
            </button>
          )}
        </>
      );
    }
    if (sel && selCard?.type === "spell" && tg.kind !== "none") {
      return (
        <button className="tcg-railbtn" onClick={() => setSel(null)}>
          Annulla{"\n"}bersaglio
        </button>
      );
    }
    return (
      <>
        <button
          className={`tcg-bigbtn tcg-bigbtn--end ${canMainAct ? "is-live" : ""}`}
          disabled={!canMainAct}
          onClick={doEndTurn}
        >
          {canMainAct ? "FINE\nTURNO" : statusLine}
        </button>
        {/* one-click charge: present whenever any of my creatures could
            attack right now, so the player doesn't have to tap-select
            them individually. Hidden once combat has been declared this
            turn (eligibleAttackerIds becomes empty). */}
        {eligibleAttackerIds.length > 0 && (
          <button
            className="tcg-railbtn tcg-railbtn--atkall"
            onClick={doAttackAll}
            title="Attacca con tutte le creature pronte"
          >
            ⚔️ ATTACCA{"\n"}TUTTE ({eligibleAttackerIds.length})
          </button>
        )}
      </>
    );
  };

  const foeCreatures = foe.battlefield;
  const myCreatures = me.battlefield;

  return (
    <div
      ref={tableRef}
      className={`tcg-table ${hitShake ? "is-shaking" : ""} ${
        dragging ? "is-dragging" : ""
      }`}
      onDragOver={allowDrop}
      onDrop={dropToPlay}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (e.target.classList.contains("tcg-table")) {
          setSel(null);
          setAttackers([]);
        }
      }}
    >
      <div className="tcg-divider" aria-hidden="true" />

      {/* opponent face-down hand (per-element backs) */}
      <div className="tcg-fan tcg-fan--foe" aria-hidden="true">
        {foe.hand.map((h, i) => (
          <div
            key={h.instId}
            className="tcg-fan__slot"
            style={fanStyle(i, foe.hand.length)}
          >
            <CardView variant="back" cover={coverFoe} />
          </div>
        ))}
      </div>

      {/* opponent field: lands (far) then creatures (near divider) */}
      <div className="tcg-field tcg-field--foe">
        <div className="tcg-zone tcg-zone--lands">
          {/* land tokens removed — mana is shown by the rhombus
              gems in the avatar pod (bottom-left) */}
          {foe.artifacts.map((a) => {
            const ac = getCard(a.cardId);
            if (!ac) return null;
            return (
              <div
                key={a.instId}
                className="tcg-relic"
                title={ac.name}
                onClick={() => setInspect(ac)}
              >
                {cardArtUrl(ac) ? (
                  <img
                    className="tcg-relic__img"
                    src={cardArtUrl(ac)}
                    alt={ac.name}
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span>{ac.icon}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="tcg-zone tcg-zone--creatures">
          {foeCreatures.length === 0 && (
            <span className="tcg-zone__empty">— nessuna creatura —</span>
          )}
          {foeCreatures.map((cr) => {
            const ls = liveStats(foeSide, cr);
            const isAttacker =
              state.combat &&
              state.combat.attackerSide === foeSide &&
              state.combat.attackers.includes(cr.instId);
            return (
              <CardView
                key={cr.instId}
                card={getCard(cr.cardId)}
                variant="board"
                instId={cr.instId}
                creature={ls}
                attacking={isAttacker}
                blocking={canBlockNow && blkAtk === cr.instId}
                dying={dyingIds.includes(cr.instId)}
                shake={combatShake.includes(cr.instId)}
                targetable={
                  (sel &&
                    selCard?.type === "spell" &&
                    tg.creatures.some((c) => c.instId === cr.instId)) ||
                  (canBlockNow &&
                    state.combat.attackers.includes(cr.instId))
                }
                onClick={() => onFoeCreature(cr)}
                onInspect={setInspect}
                onReact={reactToCard(cr.instId)}
                onDragOver={allowDrop}
                onDrop={dropOnTarget({
                  type: "creature",
                  side: foeSide,
                  instId: cr.instId,
                })}
              />
            );
          })}
        </div>
      </div>

      {/* my field: creatures (near divider) then lands (far) */}
      <div className="tcg-field tcg-field--me">
        <div className="tcg-zone tcg-zone--creatures">
          {myCreatures.length === 0 && (
            <span className="tcg-zone__empty">— schiera le tue creature —</span>
          )}
          {myCreatures.map((cr) => {
            const ls = liveStats(mySide, cr);
            const canAtk = canMainAct && canAttack(state, mySide, cr.instId);
            return (
              <CardView
                key={cr.instId}
                card={getCard(cr.cardId)}
                variant="board"
                instId={cr.instId}
                creature={ls}
                selected={attackers.includes(cr.instId)}
                playable={canAtk}
                blocking={Object.values(blocks).some((arr) =>
                  (arr || []).includes(cr.instId)
                )}
                targetable={
                  (sel &&
                    selCard?.type === "spell" &&
                    tg.creatures.some((c) => c.instId === cr.instId)) ||
                  (canBlockNow && !!blkAtk && canBlockSel(cr.instId))
                }
                dying={dyingIds.includes(cr.instId)}
                shake={shake === cr.instId || combatShake.includes(cr.instId)}
                onClick={() => onMyCreature(cr)}
                onInspect={setInspect}
                onDragOver={allowDrop}
                onDrop={dropOnTarget({
                  type: "creature",
                  side: mySide,
                  instId: cr.instId,
                })}
              />
            );
          })}
        </div>
        <div className="tcg-zone tcg-zone--lands">
          {/* land tokens removed — mana = the rhombus gems in the pod */}
          {me.artifacts.map((a) => {
            const ac = getCard(a.cardId);
            if (!ac) return null;
            return (
              <div
                key={a.instId}
                className="tcg-relic"
                title={ac.name}
                onClick={() => setInspect(ac)}
              >
                {cardArtUrl(ac) ? (
                  <img
                    className="tcg-relic__img"
                    src={cardArtUrl(ac)}
                    alt={ac.name}
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span>{ac.icon}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* my hand — grouped on the right; first tap fans it open */}
      {(() => {
        const discardMode = discarding || overCap > 0;
        const fanOpen = handOpen || discardMode;
        return (
      <div className={`tcg-fan tcg-fan--me${fanOpen ? " is-open" : ""}`}>
        {me.hand.length === 0 && (
          <span className="tcg-fan__empty">Mano vuota</span>
        )}
        {me.hand.map((h, i) => {
          const card = getCard(h.cardId);
          // canPlay already covers instant timing → instants glow in
          // response windows / combat, not only on your main turn
          const playable =
            !discardMode && canPlay(state, mySide, h.instId);
          return (
            <div
              key={h.instId}
              className="tcg-fan__slot"
              style={fanStyle(i, me.hand.length, fanOpen)}
            >
              <CardView
                card={card}
                variant="hand"
                instId={h.instId}
                selected={sel === h.instId}
                playable={playable}
                discard={discardMode}
                shake={shake === h.instId}
                draggable={fanOpen && (playable || discardMode)}
                onDragStart={beginDrag(h)}
                onDragEnd={endDrag}
                onClick={() =>
                  fanOpen ? onHandCard(h) : setHandOpen(true)
                }
                onInspect={setInspect}
              />
            </div>
          );
        })}
      </div>
        );
      })()}

      {/* floating pods */}
      <div className="tcg-pod-slot tcg-pod-slot--foe">
        <AvatarPod
          p={foe}
          top
          cover={coverFoe}
          side={foeSide}
          targetable={targetableFoeHero}
          onClick={() => onHero(foeSide)}
          onDragOver={allowDrop}
          onDrop={dropOnTarget({ type: "hero", side: foeSide })}
        />
        <ClassPanel player={foe} isMe={false} />
      </div>
      <div className="tcg-pod-slot tcg-pod-slot--me">
        <AvatarPod
          p={me}
          cover={coverMe}
          side={mySide}
          targetable={targetableMeHero}
          onClick={() => onHero(mySide)}
          onDragOver={allowDrop}
          onDrop={dropOnTarget({ type: "hero", side: mySide })}
        />
        <ClassPanel
          player={me}
          isMe={true}
          canUseUlt={canActivateUltimate(state, mySide)}
          ultBlockedReason={ultimateBlockReason(state, mySide)}
          onActivateUltimate={() => applyState(activateUltimate(state, mySide))}
        />
      </div>

      {/* Level-up celebration toast (auto-hides via setTimeout) */}
      {levelToast && (
        <div
          className={`tcg-lvl-toast ${levelToast.mine ? "is-me" : "is-foe"}`}
          role="status"
        >
          <div className="tcg-lvl-toast__lvl">LV {levelToast.level}</div>
          <div className="tcg-lvl-toast__name">⭐ {levelToast.name}</div>
        </div>
      )}

      {state.stack && state.stack.length > 0 && (
        <div className="tcg-stack" aria-label="Pila">
          <div className="tcg-stack__title">PILA</div>
          {state.stack.map((it, i) => {
            const c = getCard(it.cardId);
            const ico = c?.icon || "✦";
            const nm = c?.name || "—";
            return (
              <div
                key={it.uid}
                className={`tcg-stack__item ${
                  it.side === mySide ? "is-me" : "is-foe"
                } ${i === state.stack.length - 1 ? "is-top" : ""}`}
                onClick={() => c && setInspect(c)}
              >
                <span className="tcg-stack__ico">{ico}</span>
                <span className="tcg-stack__name">{nm}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="tcg-turnpill">
        <span className="tcg-turnpill__txt">{statusLine}</span>
        <span className="tcg-turnpill__n">Turno {state.turn}</span>
      </div>

      <div className="tcg-rail">
        <RailAction />
        {!winner && (
          <button className="tcg-railbtn tcg-railbtn--ghost" onClick={doForfeit}>
            Resa
          </button>
        )}
        {!isAi && (() => {
          const now = Date.now();
          // emoteNowTick è letto per forzare il re-render mentre il timer
          // gira; non serve direttamente nel calcolo.
          // eslint-disable-next-line no-unused-expressions
          emoteNowTick;
          const remaining = Math.max(0, emoteCdEnd - now);
          const onCooldown = remaining > 0;
          const secs = Math.ceil(remaining / 1000);
          return (
            <div className="tcg-emotes">
              {EMOTES.map((t) => (
                <button
                  key={t}
                  className={`tcg-emote${onCooldown ? " is-cooldown" : ""}`}
                  title={onCooldown ? `Aspetta ${secs}s` : t}
                  disabled={onCooldown}
                  onClick={() => {
                    if (Date.now() < emoteCdEnd) return; // safety
                    sendEmote(matchId, mySide, t);
                    setEmoteCdEnd(Date.now() + EMOTE_COOLDOWN_MS);
                  }}
                >
                  {onCooldown ? `${secs}s` : t.slice(0, 2)}
                </button>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="tcg-log">
        {state.log.slice(-3).map((l) => (
          <span key={l.id} className="tcg-log__line">
            {l.text}
          </span>
        ))}
      </div>

      {arrows.length > 0 && svgBox.w > 0 && createPortal(
        <svg
          className="tcg-arrows"
          aria-hidden="true"
          width={svgBox.w}
          height={svgBox.h}
          viewBox={`0 0 ${svgBox.w} ${svgBox.h}`}
          preserveAspectRatio="none"
        >
          <defs>
            <marker id="ah-atk" markerWidth="18" markerHeight="18"
              refX="12" refY="7" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,1 L13,7 L0,13 L4,7 Z" fill="#ff7a4a" />
            </marker>
            <marker id="ah-blocked" markerWidth="15" markerHeight="15"
              refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,1 L11,6 L0,11 L3,6 Z" fill="#86cdff" />
            </marker>
          </defs>
          {arrows.map((a) => {
            const dx = a.to.x - a.from.x;
            const dy = a.to.y - a.from.y;
            const len = Math.hypot(dx, dy) || 1;
            // perpendicular bend for a gentle arc; always curve "upward"
            // on screen (toward smaller y) for visual consistency
            const off = Math.min(140, len * 0.22);
            const nx = -dy / len;
            const ny = dx / len;
            const sign = ny <= 0 ? 1 : -1;
            const mx = (a.from.x + a.to.x) / 2 + nx * off * sign;
            const my = (a.from.y + a.to.y) / 2 + ny * off * sign;
            const d = `M ${a.from.x} ${a.from.y} Q ${mx} ${my} ${a.to.x} ${a.to.y}`;
            return (
              <g key={a.id} className={`tcg-arrow-g tcg-arrow-g--${a.kind}`}>
                <path className="tcg-arrow tcg-arrow--halo" d={d} fill="none" />
                <path
                  className={`tcg-arrow tcg-arrow--${a.kind}`}
                  d={d}
                  fill="none"
                  markerEnd={`url(#ah-${a.kind})`}
                />
              </g>
            );
          })}
        </svg>,
        document.body
      )}

      <FloatingLayer floats={floats} />
      <SpellBurst burst={burst} />
      <TurnBanner show={banner?.key} mine={banner?.mine} />

      {ghosts.length > 0 && (
        <div className="tcg-ghosts" aria-hidden="true">
          {ghosts.map((g) => (
            <div key={g.gid} className="tcg-ghost">
              <CardView card={g.card} variant="board" dying />
            </div>
          ))}
        </div>
      )}

      {emoteBubble && (
        <div
          className={`tcg-emotebubble ${
            emoteBubble.side === mySide ? "is-me" : "is-foe"
          }`}
        >
          {emoteBubble.text}
        </div>
      )}

      {cardReacts.length > 0 && (
        <div className="tcg-card-reacts" aria-hidden="true">
          {cardReacts.map((r) => (
            <span
              key={r.id}
              className="tcg-card-react"
              style={{ left: r.x + "%", top: r.y + "%" }}
            >
              {r.emoji}
            </span>
          ))}
        </div>
      )}

      {oppLost && (
        <div className="tcg-disconnect">
          <p>L'avversario sembra disconnesso.</p>
          <button className="tcg-btn tcg-btn--primary" onClick={claimWin}>
            Reclama vittoria
          </button>
        </div>
      )}

      {!winner && !matchExpired && turnRemain != null && (
        <div
          className={
            "tcg-timers" + (turnLow && myTurnNow ? " tcg-timers--urgent" : "")
          }
          aria-hidden="true"
        >
          <span className="tcg-timer tcg-timer--turn">
            ⏳ {myTurnNow ? "Tuo turno" : "Avversario"} {fmtClock(turnRemain)}
          </span>
          <span className="tcg-timer tcg-timer--match">
            🕒 {fmtClock(matchRemain)}
          </span>
        </div>
      )}

      {matchExpired && (
        <div className="tcg-disconnect">
          <p>Tempo della partita scaduto (3 ore). La partita è stata chiusa: nessun vincitore, nessun premio.</p>
          <button
            className="tcg-btn tcg-btn--primary"
            onClick={() => { if (onExit) onExit(); }}
          >
            Esci
          </button>
        </div>
      )}

      <CardZoom card={inspect} onClose={() => setInspect(null)} />

      <EndOverlay
        result={result}
        onExit={handleExit}
        onRematch={isAi ? onRematch : null}
        turns={state.turn}
        coins={endCoins}
        mode={mode}
        myName={me.name}
        foeName={foe.name}
        winnerName={winnerName}
      />
    </div>
  );
}
