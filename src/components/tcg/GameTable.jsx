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
import React, { useEffect, useRef, useState } from "react";
import CardView from "./CardView.jsx";
import CardZoom from "./CardZoom.jsx";
import { FloatingLayer, TurnBanner, SpellBurst, EndOverlay } from "./Fx.jsx";
import {
  getCard, ELEMENT_PIP, ELEMENT_LABEL, ELEMENT_ICON, coverUrl,
} from "../../tcg/cards.js";
import {
  playCard, declareAttackers, confirmBlocks, endTurn, forfeit,
  canPlay, canAttack, spellTargets, effStats, opp, reviveState,
} from "../../tcg/engine.js";
import { nextAction as aiNext, chooseBlocks as aiBlocks } from "../../tcg/ai.js";
import {
  pushState, heartbeat, opponentGone, sendEmote, deleteMatch,
} from "../../tcg/net.js";
import { playSfx } from "../../utils/tcgSfx.js";

const EMOTES = ["Ben giocato!", "Per gli dèi!", "Tornerò!", "Tira iniziativa!"];

/* coloured mana gems built from the player's lands (dim = tapped) */
function ManaRow({ lands }) {
  if (!lands.length) return <span className="tcg-mana__none">nessuna terra</span>;
  return (
    <div className="tcg-mana" title="Mana disponibile (terre)">
      {lands.map((l) => (
        <span
          key={l.instId}
          className={`tcg-mana__gem ${l.tapped ? "is-tapped" : ""}`}
          style={{ "--pip": ELEMENT_PIP[l.element] }}
          title={ELEMENT_LABEL[l.element]}
        />
      ))}
    </div>
  );
}

/* Floating player panel — NO background, doesn't block the field.
   Name, HP bar with the number ON it, mana, and a visible deck
   pile (the player's chosen cover) + hand/graveyard counts. */
function AvatarPod({ p, top, cover, side, targetable, onClick }) {
  const pct = Math.max(0, Math.min(100, (p.hp / 20) * 100));
  return (
    <div
      className={`tcg-pod ${top ? "tcg-pod--foe" : "tcg-pod--me"} ${
        targetable ? "is-targetable" : ""
      }`}
      data-hero={side}
      onClick={onClick}
    >
      <span className="tcg-pod__name">{p.name}</span>
      <div className="tcg-pod__hpbar" title={`${p.hp} PV`}>
        <span className="tcg-pod__hpfill" style={{ width: pct + "%" }} />
        <span className="tcg-pod__hpnum">{p.hp}</span>
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
  myCover = "air",
  foeCover = "darkness",
}) {
  const isAi = mode === "ai";
  const mySide = isAi ? "p0" : mySideProp;
  const foeSide = opp(mySide);

  // chosen card-back covers (PvP: from the match doc; AI: props)
  const coverMe = isAi
    ? myCover
    : (match?.covers && match.covers[mySide]) || myCover || "air";
  const coverFoe = isAi
    ? foeCover
    : (match?.covers && match.covers[foeSide]) || foeCover || "darkness";

  const [local, setLocal] = useState(initialState);
  const state = isAi ? local : reviveState(match?.state);

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
  const [shake, setShake] = useState(null);
  const [inspect, setInspect] = useState(null);
  // hand starts grouped/closed on the right; first tap fans it open
  const [handOpen, setHandOpen] = useState(false);

  const [floats, setFloats] = useState([]);
  const [burst, setBurst] = useState(null);
  const [banner, setBanner] = useState(null);
  const [hitShake, setHitShake] = useState(0);
  const [ghosts, setGhosts] = useState([]);
  const [emoteBubble, setEmoteBubble] = useState(null);
  const [arrows, setArrows] = useState([]);
  const tableRef = useRef(null);
  const arrowSeq = useRef(0);
  const lastFx = useRef(0);
  const fxReady = useRef(isAi);
  const floatSeq = useRef(0);
  const emoteTs = useRef(0);
  const endedRef = useRef(false);

  // award coins / notify exactly once when the game ends
  useEffect(() => {
    if (!state || !state.winner || endedRef.current) return;
    endedRef.current = true;
    const w = state.winner;
    const r = w === "draw" ? "draw" : w === mySide ? "win" : "lose";
    if (onGameEnd) onGameEnd(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state && state.winner]);

  const pushFloat = (zone, text, tone) => {
    const pos = {
      "foe-hero": { x: 12, y: 16 },
      "me-hero": { x: 12, y: 84 },
      "foe-board": { x: 52 + (Math.random() * 24 - 12), y: 34 },
      "me-board": { x: 52 + (Math.random() * 24 - 12), y: 66 },
    }[zone] || { x: 50, y: 50 };
    const id = ++floatSeq.current;
    setFloats((f) => [...f, { id, text, tone, ...pos }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1150);
  };

  // draw an attack arrow (and a blue defense arrow if blocked) so
  // it's clear who is hitting whom — kept on screen ~2s
  const centerOf = (sel, rect) => {
    const el = tableRef.current && tableRef.current.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left - rect.left + r.width / 2, y: r.top - rect.top + r.height / 2 };
  };
  const addCombatArrow = (atkInst, targetKind, tgtInst, atkSide) => {
    requestAnimationFrame(() => {
      const root = tableRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const from = centerOf(`[data-inst="${atkInst}"]`, rect);
      const to =
        targetKind === "creature"
          ? centerOf(`[data-inst="${tgtInst}"]`, rect)
          : centerOf(`[data-hero="${opp(atkSide)}"]`, rect);
      if (!from || !to) return;
      const id = ++arrowSeq.current;
      setArrows((a) => [...a, { id, from, to, kind: "atk" }]);
      if (targetKind === "creature") {
        setArrows((a) => [
          ...a,
          { id: id + 0.5, from: to, to: from, kind: "def" },
        ]);
      }
      setTimeout(
        () => setArrows((a) => a.filter((x) => x.id !== id && x.id !== id + 0.5)),
        2000
      );
    });
  };

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
          addCombatArrow(e.attackerInstId, e.targetKind, e.targetInstId, e.side);
          break;
        case "damageHero":
          pushFloat(e.side === mySide ? "me-hero" : "foe-hero", `-${e.amount}`, "dmg");
          shakeBump = true;
          break;
        case "healHero":
          pushFloat(e.side === mySide ? "me-hero" : "foe-hero", `+${e.amount}`, "heal");
          playSfx("heal");
          break;
        case "damageCreature":
          pushFloat(e.side === mySide ? "me-board" : "foe-board", `-${e.amount}`, "dmg");
          break;
        case "death": {
          const card = getCard(e.cardId);
          playSfx("death");
          if (card) {
            const gid = ++floatSeq.current;
            setGhosts((g) => [...g, { gid, card }]);
            setTimeout(
              () => setGhosts((g) => g.filter((x) => x.gid !== gid)),
              950
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
            850
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
            1100
          );
          break;
        }
        case "win":
          playSfx(
            e.winner === "draw" ? "lose" : e.winner === mySide ? "win" : "lose"
          );
          break;
        default:
          break;
      }
    });
    if (shakeBump) {
      setHitShake((n) => n + 1);
      setTimeout(() => setHitShake((n) => Math.max(0, n - 1)), 360);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state && state.fx]);

  // ---------- AI driver ----------
  useEffect(() => {
    if (!isAi || !state || state.winner) return;
    let t;
    if (state.active === "p1" && state.phase === "main") {
      t = setTimeout(() => {
        const s = stateRef.current;
        if (!s || s.winner || s.active !== "p1" || s.phase !== "main") return;
        const act = aiNext(s, "p1");
        if (act.type === "land" || act.type === "play")
          applyState(playCard(s, "p1", act.instId, act.target));
        else if (act.type === "attack")
          applyState(declareAttackers(s, "p1", act.attackerIds));
        else applyState(endTurn(s, "p1"));
      }, 950);
    } else if (
      state.phase === "block" &&
      state.combat &&
      state.combat.attackerSide === "p0"
    ) {
      t = setTimeout(() => {
        const s = stateRef.current;
        if (!s || s.phase !== "block") return;
        applyState(confirmBlocks(s, "p1", aiBlocks(s, "p1")));
      }, 1300);
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isAi]);

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
      const t = setTimeout(() => setEmoteBubble(null), 2800);
      return () => clearTimeout(t);
    }
  }, [isAi, match]);

  if (!state || !state.players) {
    return (
      <div className="tcg-table tcg-table--loading">
        <div className="tcg-waiting__spinner" />
        <p>Caricamento partita…</p>
      </div>
    );
  }

  const me = state.players[mySide];
  const foe = state.players[foeSide];
  const winner = state.winner;

  const canMainAct =
    !winner && state.phase === "main" && state.active === mySide;
  const canBlockNow =
    !winner &&
    state.phase === "block" &&
    state.combat &&
    state.combat.attackerSide === foeSide;
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
    if (!canMainAct) return;
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

  const onMyCreature = (cr) => {
    if (sel && selCard?.type === "spell") {
      tryCastOn({ type: "creature", side: mySide, instId: cr.instId });
      return;
    }
    if (canBlockNow && blkAtk) {
      setBlocks((b) => {
        const nb = { ...b };
        for (const k of Object.keys(nb)) if (nb[k] === cr.instId) delete nb[k];
        nb[blkAtk] = cr.instId;
        return nb;
      });
      setBlkAtk(null);
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
    applyState(confirmBlocks(state, mySide, skip ? {} : blocks));
    setBlocks({});
    setBlkAtk(null);
  };

  const doEndTurn = () => {
    if (!canMainAct) return;
    applyState(endTurn(state, mySide));
    setSel(null);
    setAttackers([]);
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
    return {
      power: e.power,
      toughness: e.toughness,
      damage: cr.damage,
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

  const statusLine = winner
    ? "Partita conclusa"
    : canBlockNow
    ? "Dichiara i tuoi bloccanti"
    : iAmAttackerWaiting
    ? "Attendi i bloccanti avversari…"
    : canMainAct
    ? "È il tuo turno"
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

  /* mana = a small glowing element token (taps/untaps) */
  const LandCard = ({ land }) => {
    const c = getCard(land.cardId);
    return (
      <button
        className={`tcg-mtoken ${land.tapped ? "is-tapped" : ""}`}
        style={{ "--pip": ELEMENT_PIP[land.element] }}
        title={`${c.name}${land.tapped ? " — tappata" : ""}`}
        onClick={() => setInspect(c)}
      >
        <span className="tcg-mtoken__icon">{ELEMENT_ICON[land.element]}</span>
      </button>
    );
  };

  const RailAction = () => {
    if (winner) return null;
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
      return (
        <button className="tcg-bigbtn tcg-bigbtn--atk" onClick={doAttack}>
          ⚔️ Attacca{"\n"}({attackers.length})
        </button>
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
      <button
        className={`tcg-bigbtn tcg-bigbtn--end ${canMainAct ? "is-live" : ""}`}
        disabled={!canMainAct}
        onClick={doEndTurn}
      >
        {canMainAct ? "FINE\nTURNO" : statusLine}
      </button>
    );
  };

  const foeCreatures = foe.battlefield;
  const myCreatures = me.battlefield;

  return (
    <div
      ref={tableRef}
      className={`tcg-table ${hitShake ? "is-shaking" : ""}`}
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
          {foe.lands.map((l) => (
            <LandCard key={l.instId} land={l} side={foeSide} />
          ))}
          {foe.artifacts.map((a) => (
            <div
              key={a.instId}
              className="tcg-relic"
              title={getCard(a.cardId).name}
              onClick={() => setInspect(getCard(a.cardId))}
            >
              <span>{getCard(a.cardId).icon}</span>
            </div>
          ))}
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
                targetable={
                  (sel &&
                    selCard?.type === "spell" &&
                    tg.creatures.some((c) => c.instId === cr.instId)) ||
                  (canBlockNow &&
                    state.combat.attackers.includes(cr.instId))
                }
                onClick={() => onFoeCreature(cr)}
                onInspect={setInspect}
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
                blocking={Object.values(blocks).includes(cr.instId)}
                targetable={
                  sel &&
                  selCard?.type === "spell" &&
                  tg.creatures.some((c) => c.instId === cr.instId)
                }
                shake={shake === cr.instId}
                onClick={() => onMyCreature(cr)}
                onInspect={setInspect}
              />
            );
          })}
        </div>
        <div className="tcg-zone tcg-zone--lands">
          {me.lands.map((l) => (
            <LandCard key={l.instId} land={l} side={mySide} />
          ))}
          {me.artifacts.map((a) => (
            <div
              key={a.instId}
              className="tcg-relic"
              title={getCard(a.cardId).name}
              onClick={() => setInspect(getCard(a.cardId))}
            >
              <span>{getCard(a.cardId).icon}</span>
            </div>
          ))}
        </div>
      </div>

      {/* my hand — grouped on the right; first tap fans it open */}
      <div className={`tcg-fan tcg-fan--me${handOpen ? " is-open" : ""}`}>
        {me.hand.length === 0 && (
          <span className="tcg-fan__empty">Mano vuota</span>
        )}
        {me.hand.map((h, i) => {
          const card = getCard(h.cardId);
          const playable = canMainAct && canPlay(state, mySide, h.instId);
          return (
            <div
              key={h.instId}
              className="tcg-fan__slot"
              style={fanStyle(i, me.hand.length, handOpen)}
            >
              <CardView
                card={card}
                variant="hand"
                selected={sel === h.instId}
                playable={playable}
                shake={shake === h.instId}
                onClick={() =>
                  handOpen ? onHandCard(h) : setHandOpen(true)
                }
                onInspect={setInspect}
              />
            </div>
          );
        })}
      </div>

      {/* floating pods */}
      <div className="tcg-pod-slot tcg-pod-slot--foe">
        <AvatarPod
          p={foe}
          top
          cover={coverFoe}
          side={foeSide}
          targetable={targetableFoeHero}
          onClick={() => onHero(foeSide)}
        />
      </div>
      <div className="tcg-pod-slot tcg-pod-slot--me">
        <AvatarPod
          p={me}
          cover={coverMe}
          side={mySide}
          targetable={targetableMeHero}
          onClick={() => onHero(mySide)}
        />
      </div>

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
        {!isAi && (
          <div className="tcg-emotes">
            {EMOTES.map((t) => (
              <button
                key={t}
                className="tcg-emote"
                title={t}
                onClick={() => sendEmote(matchId, mySide, t)}
              >
                {t.slice(0, 2)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="tcg-log">
        {state.log.slice(-3).map((l) => (
          <span key={l.id} className="tcg-log__line">
            {l.text}
          </span>
        ))}
      </div>

      {arrows.length > 0 && (
        <svg className="tcg-arrows" aria-hidden="true">
          <defs>
            <marker id="ah-atk" markerWidth="9" markerHeight="9" refX="6" refY="3"
              orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3 L0,6 Z" fill="#ff4d3d" />
            </marker>
            <marker id="ah-def" markerWidth="9" markerHeight="9" refX="6" refY="3"
              orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3 L0,6 Z" fill="#5db4ff" />
            </marker>
          </defs>
          {arrows.map((a) => (
            <line
              key={a.id}
              className={`tcg-arrow tcg-arrow--${a.kind}`}
              x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y}
              markerEnd={`url(#ah-${a.kind})`}
            />
          ))}
        </svg>
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

      {oppLost && (
        <div className="tcg-disconnect">
          <p>L'avversario sembra disconnesso.</p>
          <button className="tcg-btn tcg-btn--primary" onClick={claimWin}>
            Reclama vittoria
          </button>
        </div>
      )}

      <CardZoom card={inspect} onClose={() => setInspect(null)} />

      <EndOverlay
        result={result}
        onExit={handleExit}
        onRematch={isAi ? onRematch : null}
      />
    </div>
  );
}
