import React, { useEffect, useState, useMemo, useRef } from "react";
import { db } from "../firebase";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import {
  TCG_CARDS, TCG_CARD_LIST, TCG_MECHANICS, MECHANICS_ORDER,
  ELEMENT_ICON, ELEMENT_LABEL, ELEMENT_COLOR, RARITY_LABEL, RARITY_COLOR,
  ELEMENT_CYCLE, LIGHT_DARK, randomCompliment,
} from "../data/tcgCards";
import {
  buildRandomDeck, initMatchState, playCard, attackWith, endTurn, forfeit,
  canPlayCard, canAttack, legalAttackTargets, oppSide, STARTING_HP,
} from "../utils/tcg";
import "./Tcg.css";

/* ============================================================
   TCG — Magic-style D&D 1v1 trading card game.
   Tabs: Sfide (lobby), Carte (codex), Manuale (rulebook).
   When in a match, the lobby is replaced by the live board.
   ============================================================ */
export default function Tcg() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState("lobby");
  const [me, setMe] = useState(null);
  const [openMatches, setOpenMatches] = useState([]);
  const [activeMatches, setActiveMatches] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [activeMatchId, setActiveMatchId] = useState(null);

  /* ── Live "me" snapshot ───────────────────────────────── */
  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(doc(db, "characters", currentUser.uid), s => {
      if (s.exists()) setMe({ uid: currentUser.uid, ...s.data() });
    });
  }, [currentUser]);

  /* ── Stream all TCG matches ───────────────────────────── */
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "tcg_matches"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOpenMatches(all.filter(m => m.status === "open"));
      setActiveMatches(all.filter(m => {
        if (m.status !== "active") return false;
        return m.challenger?.uid === currentUser.uid || m.challenged?.uid === currentUser.uid;
      }));
      setRecentMatches(all.filter(m => m.status === "ended").slice(0, 8));
    });
  }, [currentUser]);

  /* ── Auto-enter active match ──────────────────────────── */
  useEffect(() => {
    if (activeMatchId) return;
    const mine = activeMatches[0];
    if (mine) setActiveMatchId(mine.id);
  }, [activeMatches, activeMatchId]);

  /* ── Create challenge ─────────────────────────────────── */
  const createChallenge = async () => {
    if (!currentUser || !me) return;
    try {
      await addDoc(collection(db, "tcg_matches"), {
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        challenger: { uid: currentUser.uid, name: me.name || "Sfidante" },
        challenged: null,
        state: null,
      });
    } catch (err) {
      console.error("create tcg challenge failed:", err);
      alert("Errore: " + err.message);
    }
  };

  /* ── Accept challenge ─────────────────────────────────── */
  const acceptChallenge = async (match) => {
    if (!currentUser || !me) return;
    if (match.challenger.uid === currentUser.uid) {
      alert("Non puoi accettare la tua stessa sfida.");
      return;
    }
    try {
      const cDeck = buildRandomDeck();
      const dDeck = buildRandomDeck();
      const initState = initMatchState(cDeck, dDeck);
      await updateDoc(doc(db, "tcg_matches", match.id), {
        status: "active",
        updatedAt: serverTimestamp(),
        challenged: { uid: currentUser.uid, name: me.name || "Sfidato" },
        state: initState,
      });
      setActiveMatchId(match.id);
    } catch (err) {
      console.error("accept tcg failed:", err);
      alert("Errore: " + err.message);
    }
  };

  const cancelChallenge = async (match) => {
    if (!currentUser) return;
    if (match.challenger.uid !== currentUser.uid) return;
    if (!window.confirm("Annullare la tua sfida?")) return;
    try { await deleteDoc(doc(db, "tcg_matches", match.id)); } catch (err) { console.error(err); }
  };

  if (!currentUser) {
    return (
      <section className="tcg-page">
        <div className="tcg-locked">
          <div className="tcg-locked-icon">🎴</div>
          <h2>Eldoria TCG</h2>
          <p>Effettua l'accesso per scendere in campo.</p>
        </div>
      </section>
    );
  }

  /* ── If in a match, render the live board only ───────── */
  const activeMatch = activeMatches.find(m => m.id === activeMatchId);
  if (activeMatch) {
    return (
      <section className="tcg-page">
        <LiveMatch
          match={activeMatch}
          uid={currentUser.uid}
          onExit={() => setActiveMatchId(null)}
        />
      </section>
    );
  }

  return (
    <section className="tcg-page">
      <header className="tcg-head">
        <h1 className="tcg-title">
          <span className="tcg-title-icon">🎴</span>
          <span className="tcg-title-text">Eldoria TCG</span>
          <span className="tcg-title-spark">✦</span>
        </h1>
        <p className="tcg-sub">Magia, draghi e tattica · sfide 1v1 con carte di rarità leggendaria</p>
      </header>

      <div className="tcg-tabs" role="tablist">
        <button
          type="button"
          className={`tcg-tab tcg-tab--lobby ${tab === "lobby" ? "tcg-tab--active" : ""}`}
          onClick={() => setTab("lobby")}
        >
          <span className="tcg-tab-icon">⚔</span>
          <span className="tcg-tab-label">Sfide</span>
        </button>
        <button
          type="button"
          className={`tcg-tab tcg-tab--codex ${tab === "codex" ? "tcg-tab--active" : ""}`}
          onClick={() => setTab("codex")}
        >
          <span className="tcg-tab-icon">📖</span>
          <span className="tcg-tab-label">Carte</span>
        </button>
        <button
          type="button"
          className={`tcg-tab tcg-tab--rules ${tab === "rules" ? "tcg-tab--active" : ""}`}
          onClick={() => setTab("rules")}
        >
          <span className="tcg-tab-icon">📜</span>
          <span className="tcg-tab-label">Manuale</span>
        </button>
      </div>

      <div className="tcg-tab-body">
        {tab === "lobby" && (
          <Lobby
            currentUser={currentUser}
            openMatches={openMatches}
            recentMatches={recentMatches}
            onCreate={createChallenge}
            onAccept={acceptChallenge}
            onCancel={cancelChallenge}
          />
        )}
        {tab === "codex" && <Codex />}
        {tab === "rules" && <Rules />}
      </div>
    </section>
  );
}

/* ============================================================
   LOBBY — challenge list, create & accept buttons
   ============================================================ */
function Lobby({ currentUser, openMatches, recentMatches, onCreate, onAccept, onCancel }) {
  return (
    <div className="tcg-lobby">
      <ElementWheelLegend />

      <div className="tcg-panel">
        <div className="tcg-panel-head">
          <h2 className="tcg-panel-title">⚔ Sfida un avversario</h2>
        </div>
        <p className="tcg-panel-sub">
          Lancia una sfida 1v1: il primo avventuriero che la accetta combatterà contro di te.
          Ogni partita usa un mazzo casuale di 20 carte.
        </p>
        <button type="button" className="tcg-btn tcg-btn--hero" onClick={onCreate}>
          🎴 Lancia una sfida
        </button>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">📯 Sfide aperte</h2>
        {openMatches.length === 0 ? (
          <p className="tcg-empty">Nessuna sfida in attesa. Sii il primo a lanciarne una!</p>
        ) : (
          <div className="tcg-challenge-list">
            {openMatches.map(m => {
              const mine = m.challenger.uid === currentUser.uid;
              return (
                <div key={m.id} className={`tcg-challenge ${mine ? "tcg-challenge--mine" : ""}`}>
                  <div className="tcg-challenge-info">
                    <div className="tcg-challenge-name">
                      <span className="tcg-challenge-icon">🎴</span>
                      <strong>{m.challenger.name}</strong>
                    </div>
                    <div className="tcg-challenge-meta">aspetta uno sfidante…</div>
                  </div>
                  {mine ? (
                    <button className="tcg-btn tcg-btn--ghost" onClick={() => onCancel(m)}>✕ Annulla</button>
                  ) : (
                    <button className="tcg-btn tcg-btn--accept" onClick={() => onAccept(m)}>
                      ⚔ Accetta
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">📜 Ultimi scontri</h2>
        {recentMatches.length === 0 ? (
          <p className="tcg-empty">Nessuno scontro risolto ancora.</p>
        ) : (
          <div className="tcg-recent-list">
            {recentMatches.map(m => {
              const w = m.state?.winner;
              const winnerName = w === "challenger" ? m.challenger?.name
                : w === "challenged" ? m.challenged?.name
                : "Pareggio";
              return (
                <div key={m.id} className="tcg-recent-row">
                  <span className={`tcg-recent-side ${w === "challenger" ? "win" : "loss"}`}>
                    {m.challenger?.name}
                  </span>
                  <span className="tcg-recent-vs">vs</span>
                  <span className={`tcg-recent-side ${w === "challenged" ? "win" : "loss"}`}>
                    {m.challenged?.name}
                  </span>
                  <span className="tcg-recent-winner">→ 🏆 {winnerName}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   ELEMENT WHEEL — visual rules of element advantage
   ============================================================ */
function ElementWheelLegend() {
  return (
    <div className="tcg-wheel-wrap">
      <div className="tcg-wheel" title="Ogni elemento è super-efficace contro il successivo (×1.5).">
        <span className="tcg-wheel-label">Cerchio degli Elementi</span>
        {ELEMENT_CYCLE.map((e, i) => (
          <React.Fragment key={e}>
            <span className={`tcg-wheel-node tcg-wheel-node--${e}`}>
              {ELEMENT_ICON[e]} {ELEMENT_LABEL[e]}
            </span>
            {i < ELEMENT_CYCLE.length - 1 && <span className="tcg-wheel-arrow">→</span>}
          </React.Fragment>
        ))}
        <span className="tcg-wheel-arrow">↺</span>
      </div>
      <div className="tcg-wheel tcg-wheel--pair" title="Luce e Tenebre si combattono solo tra loro.">
        <span className="tcg-wheel-label">Dualità</span>
        <span className={`tcg-wheel-node tcg-wheel-node--${LIGHT_DARK[0]}`}>
          {ELEMENT_ICON[LIGHT_DARK[0]]} {ELEMENT_LABEL[LIGHT_DARK[0]]}
        </span>
        <span className="tcg-wheel-arrow">⇄</span>
        <span className={`tcg-wheel-node tcg-wheel-node--${LIGHT_DARK[1]}`}>
          {ELEMENT_ICON[LIGHT_DARK[1]]} {ELEMENT_LABEL[LIGHT_DARK[1]]}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   CARD — full MTG-style card visual
   ============================================================ */
function Card({ card, size = "md", onClick, disabled, selected, className = "", showTooltip = true }) {
  const def = card;
  const cost = def.cost;
  const mechs = def.mechanics || [];
  const tip = showTooltip
    ? `${def.name} · ${RARITY_LABEL[def.rarity]} ${ELEMENT_ICON[def.element]}\n${def.flavor}\n` +
      mechs.map(k => `${TCG_MECHANICS[k].icon} ${TCG_MECHANICS[k].name}: ${TCG_MECHANICS[k].rules}`).join("\n")
    : undefined;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={
        `tcg-card tcg-card--${size}` +
        ` tcg-card--el-${def.element}` +
        ` tcg-card--r-${def.rarity}` +
        (selected ? " tcg-card--selected" : "") +
        (disabled ? " tcg-card--disabled" : "") +
        (onClick ? " tcg-card--clickable" : "") +
        (className ? " " + className : "")
      }
      onClick={onClick}
      disabled={disabled}
      title={tip}
    >
      <div className="tcg-card-header">
        <span className="tcg-card-cost" title="Costo di mana">{cost}</span>
        <span className="tcg-card-name">{def.name}</span>
        <span className="tcg-card-element" title={ELEMENT_LABEL[def.element]}>
          {ELEMENT_ICON[def.element]}
        </span>
      </div>

      <div className="tcg-card-art">
        <CardArt def={def} />
        {def.rarity !== "common" && (
          <span className={`tcg-card-rarity-badge tcg-card-rarity-badge--${def.rarity}`}>
            ★ {RARITY_LABEL[def.rarity]}
          </span>
        )}
      </div>

      {mechs.length > 0 && (
        <div className="tcg-card-mechs">
          {mechs.map(k => {
            const m = TCG_MECHANICS[k];
            return (
              <span key={k} className={`tcg-card-mech tcg-card-mech--${k}`} title={`${m.name}: ${m.rules}`}>
                {m.icon} {m.name}
              </span>
            );
          })}
        </div>
      )}

      {size !== "sm" && (
        <div className="tcg-card-flavor">{def.flavor}</div>
      )}

      <div className="tcg-card-stats">
        <span className="tcg-card-stat tcg-card-stat--atk">⚔ {def.atk}</span>
        <span className="tcg-card-stat tcg-card-stat--hp">❤ {def.hp}</span>
      </div>
    </Tag>
  );
}

function CardArt({ def }) {
  const [failed, setFailed] = useState(false);
  if (def.image && !failed) {
    return (
      <img
        src={def.image}
        alt={def.name}
        className="tcg-card-art-img"
        onError={() => setFailed(true)}
        loading="lazy"
      />
    );
  }
  return <span className="tcg-card-art-emoji">{def.icon}</span>;
}

/* ============================================================
   BOARD CARD — variant of Card showing live HP & status
   ============================================================ */
function BoardCard({ bc, def, size = "sm", onClick, disabled, selected, status }) {
  const mechs = def.mechanics || [];
  const tip = `${def.name}\nPF ${bc.hp}/${bc.maxHp} · ⚔ ${bc.atk}\n` +
    mechs.map(k => `${TCG_MECHANICS[k].icon} ${TCG_MECHANICS[k].name}`).join(" · ");
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={
        `tcg-card tcg-card--${size}` +
        ` tcg-card--el-${def.element}` +
        ` tcg-card--r-${def.rarity}` +
        ` tcg-board-card` +
        (selected ? " tcg-card--selected" : "") +
        (disabled ? " tcg-card--disabled" : "") +
        (onClick ? " tcg-card--clickable" : "") +
        (status === "sick" ? " tcg-board-card--sick" : "") +
        (status === "tapped" ? " tcg-board-card--tapped" : "") +
        (status === "ready" ? " tcg-board-card--ready" : "")
      }
      onClick={onClick}
      disabled={disabled}
      title={tip}
    >
      <div className="tcg-card-header">
        <span className="tcg-card-cost">{def.cost}</span>
        <span className="tcg-card-name">{def.name}</span>
        <span className="tcg-card-element">{ELEMENT_ICON[def.element]}</span>
      </div>
      <div className="tcg-card-art tcg-card-art--small">
        <CardArt def={def} />
      </div>
      {mechs.length > 0 && (
        <div className="tcg-card-mechs tcg-card-mechs--mini">
          {mechs.map(k => {
            const m = TCG_MECHANICS[k];
            return <span key={k} className="tcg-card-mech-mini" title={m.name}>{m.icon}</span>;
          })}
        </div>
      )}
      <div className="tcg-card-stats">
        <span className="tcg-card-stat tcg-card-stat--atk">⚔ {bc.atk}</span>
        <span className="tcg-card-stat tcg-card-stat--hp">
          ❤ {bc.hp}<em className="tcg-card-stat-sub">/{bc.maxHp}</em>
        </span>
      </div>
      {status === "sick" && <div className="tcg-board-tag">😴 sonnolento</div>}
      {status === "tapped" && <div className="tcg-board-tag">✓ usato</div>}
      {bc.revived && <div className="tcg-board-tag tcg-board-tag--revived">👻 rinato</div>}
    </Tag>
  );
}

/* ============================================================
   LIVE MATCH — full battle board
   ============================================================ */
function LiveMatch({ match, uid, onExit }) {
  const isChallenger = match.challenger.uid === uid;
  const mySide = isChallenger ? "challenger" : "challenged";
  const oSide = oppSide(mySide);
  const state = match.state;
  const myTurn = state.activeSide === mySide;

  const [selectedAttacker, setSelectedAttacker] = useState(null);
  const [endNoticeShown, setEndNoticeShown] = useState(false);
  const [compliment, setCompliment] = useState("");
  const logRef = useRef(null);

  /* Roll a compliment once when the match ends and I won */
  useEffect(() => {
    if (state.winner && state.winner === mySide && !compliment) {
      setCompliment(randomCompliment());
    }
  }, [state.winner, mySide, compliment]);

  /* Auto-scroll log */
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log?.length]);

  /* Clear selected attacker when not my turn */
  useEffect(() => {
    if (!myTurn) setSelectedAttacker(null);
  }, [myTurn]);

  const matchRef = doc(db, "tcg_matches", match.id);

  const updateState = async (newState, statusOverride) => {
    const patch = { state: newState, updatedAt: serverTimestamp() };
    if (statusOverride) patch.status = statusOverride;
    else if (newState.winner) patch.status = "ended";
    try {
      await updateDoc(matchRef, patch);
    } catch (err) {
      console.error("tcg update failed:", err);
      alert("Errore: " + err.message);
    }
  };

  const handlePlayCard = async (instId) => {
    if (!canPlayCard(state, mySide, instId)) return;
    const next = playCard(state, mySide, instId);
    await updateState(next);
  };

  const handleSelectAttacker = (instId) => {
    if (!canAttack(state, mySide, instId)) return;
    setSelectedAttacker(instId === selectedAttacker ? null : instId);
  };

  const handleAttackTarget = async (targetInstId) => {
    if (!selectedAttacker) return;
    const next = attackWith(state, mySide, selectedAttacker, targetInstId);
    setSelectedAttacker(null);
    await updateState(next);
  };

  const handleEndTurn = async () => {
    const next = endTurn(state, mySide);
    setSelectedAttacker(null);
    await updateState(next);
  };

  const handleForfeit = async () => {
    if (!window.confirm("Sicuro di voler abbandonare? Perderai la partita.")) return;
    const next = forfeit(state, mySide);
    await updateState(next);
  };

  const targets = selectedAttacker
    ? legalAttackTargets(state, mySide, selectedAttacker)
    : { creatures: [], face: false };

  /* End screen */
  if (state.winner) {
    const won = state.winner === mySide;
    return (
      <div className="tcg-end">
        <div className={`tcg-end-card ${won ? "tcg-end-card--win" : "tcg-end-card--loss"}`}>
          <div className="tcg-end-icon">{won ? "🏆" : "💀"}</div>
          <h2 className="tcg-end-title">
            {won ? "VITTORIA!" : "SCONFITTA"}
          </h2>
          {won && (
            <div className="tcg-end-compliment">
              <span className="tcg-end-compliment-quote">"</span>
              {compliment}
              <span className="tcg-end-compliment-quote">"</span>
            </div>
          )}
          <div className="tcg-end-summary">
            {match.challenger.name} <span className="tcg-end-vs">vs</span> {match.challenged.name}
          </div>
          <div className="tcg-end-log" ref={logRef}>
            {(state.log || []).slice(-20).map((line, i) => (
              <div key={i} className={`tcg-log-line tcg-log-line--${line.side === mySide ? "mine" : "opp"}`}>
                {line.text}
              </div>
            ))}
          </div>
          <button className="tcg-btn tcg-btn--hero" onClick={onExit}>
            ↩ Torna alla lobby
          </button>
        </div>
      </div>
    );
  }

  const myHand = state.hand[mySide];
  const oppHand = state.hand[oSide];
  const myBoard = state.board[mySide];
  const oppBoard = state.board[oSide];

  return (
    <div className="tcg-match">
      <header className="tcg-match-head">
        <button className="tcg-btn tcg-btn--ghost tcg-btn--tiny" onClick={onExit}>← Lobby</button>
        <div className="tcg-match-round">
          Turno {state.round} · {myTurn ? "🟢 Tocca a te" : "⏳ Avversario"}
        </div>
        <button className="tcg-btn tcg-btn--ghost tcg-btn--tiny tcg-btn--danger" onClick={handleForfeit}>
          🏳 Abbandona
        </button>
      </header>

      {/* Opponent zone */}
      <div className="tcg-zone tcg-zone--opp">
        <PlayerStrip
          side={oSide}
          name={match[oSide].name}
          hp={state.hp[oSide]}
          mana={state.mana[oSide]}
          maxMana={state.maxMana[oSide]}
          deckCount={state.deck[oSide].length}
          handCount={oppHand.length}
          opponent
          isActive={!myTurn}
        />
        <div className="tcg-board tcg-board--opp">
          {oppBoard.length === 0 ? (
            <div className="tcg-board-empty">Campo vuoto</div>
          ) : oppBoard.map(bc => {
            const def = TCG_CARDS[bc.cardId];
            const isLegal = selectedAttacker && targets.creatures.includes(bc.instId);
            return (
              <BoardCard
                key={bc.instId}
                bc={bc}
                def={def}
                onClick={isLegal ? () => handleAttackTarget(bc.instId) : undefined}
                disabled={!isLegal}
                selected={isLegal}
                status={bc.tapped ? "tapped" : null}
              />
            );
          })}
        </div>
      </div>

      {/* Center divider with face-attack target */}
      <div className="tcg-divider">
        <div className="tcg-divider-line" />
        {selectedAttacker && targets.face && (
          <button
            className="tcg-face-attack"
            onClick={() => handleAttackTarget(null)}
            title="Colpisci direttamente il campione avversario"
          >
            🎯 Colpisci il Campione ({match[oSide].name})
          </button>
        )}
        {selectedAttacker && !targets.face && targets.creatures.length > 0 && (
          <div className="tcg-divider-hint">
            🛡 Devi colpire prima un Baluardo!
          </div>
        )}
        <div className="tcg-divider-line" />
      </div>

      {/* My zone */}
      <div className="tcg-zone tcg-zone--mine">
        <div className="tcg-board tcg-board--mine">
          {myBoard.length === 0 ? (
            <div className="tcg-board-empty">Gioca una carta dalla mano</div>
          ) : myBoard.map(bc => {
            const def = TCG_CARDS[bc.cardId];
            const ready = canAttack(state, mySide, bc.instId);
            const isSelected = selectedAttacker === bc.instId;
            const status = bc.tapped ? "tapped" : (bc.sick ? "sick" : (ready ? "ready" : null));
            return (
              <BoardCard
                key={bc.instId}
                bc={bc}
                def={def}
                onClick={ready ? () => handleSelectAttacker(bc.instId) : undefined}
                disabled={!ready}
                selected={isSelected}
                status={status}
              />
            );
          })}
        </div>
        <PlayerStrip
          side={mySide}
          name={match[mySide].name}
          hp={state.hp[mySide]}
          mana={state.mana[mySide]}
          maxMana={state.maxMana[mySide]}
          deckCount={state.deck[mySide].length}
          handCount={myHand.length}
          isActive={myTurn}
        />
      </div>

      {/* Hand */}
      <div className="tcg-hand-wrap">
        <div className="tcg-hand-label">
          🎴 La tua mano · {myHand.length} carte
        </div>
        <div className="tcg-hand">
          {myHand.length === 0 ? (
            <div className="tcg-board-empty">Mano vuota</div>
          ) : myHand.map(c => {
            const def = TCG_CARDS[c.cardId];
            const playable = canPlayCard(state, mySide, c.instId);
            return (
              <Card
                key={c.instId}
                card={def}
                size="md"
                onClick={() => handlePlayCard(c.instId)}
                disabled={!playable}
              />
            );
          })}
        </div>
      </div>

      {/* Action bar + log */}
      <div className="tcg-action-bar">
        <button
          type="button"
          className="tcg-btn tcg-btn--end"
          onClick={handleEndTurn}
          disabled={!myTurn}
        >
          ⏭ Fine turno
        </button>
        <div className="tcg-log" ref={logRef}>
          {(state.log || []).slice(-7).map((line, i) => (
            <div key={i} className={`tcg-log-line tcg-log-line--${line.side === mySide ? "mine" : "opp"}`}>
              {line.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PLAYER STRIP — HP, mana, deck, hand counts
   ============================================================ */
function PlayerStrip({ side, name, hp, mana, maxMana, deckCount, handCount, opponent, isActive }) {
  const hpPct = Math.max(0, Math.min(100, (hp / STARTING_HP) * 100));
  return (
    <div className={`tcg-pstrip ${opponent ? "tcg-pstrip--opp" : "tcg-pstrip--mine"} ${isActive ? "tcg-pstrip--active" : ""}`}>
      <div className="tcg-pstrip-name">
        {isActive && <span className="tcg-pstrip-dot" />}
        {opponent ? "👤" : "🎯"} {name}
      </div>
      <div className="tcg-pstrip-row">
        <div className="tcg-pstrip-hp">
          <div className="tcg-pstrip-hp-label">❤ {hp}/{STARTING_HP}</div>
          <div className="tcg-pstrip-hp-track">
            <div className="tcg-pstrip-hp-fill" style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <div className="tcg-pstrip-mana" title="Mana disponibile / massimo">
          <span className="tcg-pstrip-mana-icon">🔮</span>
          <strong>{mana}</strong>/<em>{maxMana}</em>
        </div>
        <div className="tcg-pstrip-pile" title="Carte nel mazzo">📚 {deckCount}</div>
        <div className="tcg-pstrip-pile" title="Carte in mano">🃏 {handCount}</div>
      </div>
    </div>
  );
}

/* ============================================================
   CODEX — show every card in the pool
   ============================================================ */
function Codex() {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => {
    if (filter === "all") return TCG_CARD_LIST;
    return TCG_CARD_LIST.filter(c => c.element === filter || c.rarity === filter);
  }, [filter]);

  return (
    <div className="tcg-codex">
      <div className="tcg-codex-filters">
        <button className={`tcg-filter ${filter === "all" ? "tcg-filter--on" : ""}`} onClick={() => setFilter("all")}>
          Tutte ({TCG_CARD_LIST.length})
        </button>
        {Object.entries(ELEMENT_ICON).map(([el, ic]) => (
          <button key={el} className={`tcg-filter tcg-filter--el-${el} ${filter === el ? "tcg-filter--on" : ""}`} onClick={() => setFilter(el)}>
            {ic} {ELEMENT_LABEL[el]}
          </button>
        ))}
        {["common", "rare", "epic", "legendary"].map(r => (
          <button key={r} className={`tcg-filter tcg-filter--r-${r} ${filter === r ? "tcg-filter--on" : ""}`} onClick={() => setFilter(r)}>
            ★ {RARITY_LABEL[r]}
          </button>
        ))}
      </div>
      <div className="tcg-codex-grid">
        {filtered.map(c => (
          <Card key={c.id} card={c} size="md" />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   RULES — mechanics + flow rulebook
   ============================================================ */
function Rules() {
  return (
    <div className="tcg-rules">
      <div className="tcg-panel">
        <h2 className="tcg-panel-title">⚔ Come si gioca</h2>
        <ul className="tcg-rules-list">
          <li>Ogni giocatore parte con <strong>{STARTING_HP} PF</strong>, una mano di 4 carte e un mazzo di 20.</li>
          <li>A ogni turno il giocatore attivo guadagna <strong>+1 di Mana massimo</strong> (fino a 10) e ricarica tutto il mana.</li>
          <li>Si pesca 1 carta a turno. Le creature evocate hanno <em>sonno d'evocazione</em> e non possono attaccare lo stesso turno (a meno di "Furia").</li>
          <li>In combattimento, una creatura ne attacca un'altra (o il campione avversario) infliggendo i danni del proprio attacco. La difesa replica con il suo attacco.</li>
          <li>Vince chi porta a 0 i PF dell'avversario. Se finisci il mazzo, subisci 2 danni da affaticamento ad ogni pesca.</li>
        </ul>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">🌟 Cerchio degli elementi</h2>
        <ElementWheelLegend />
        <p className="tcg-panel-sub">
          Quando un attacco è super-efficace contro l'elemento bersaglio, infligge <strong>×1.5</strong> danni.
          Quando è poco efficace, <strong>×0.5</strong>. Luce e Tenebra si combattono solo tra loro (×1.5 reciproco)
          e sono neutre contro gli altri elementi.
        </p>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">⚡ Le 8 meccaniche</h2>
        <div className="tcg-mechs-grid">
          {MECHANICS_ORDER.map(k => {
            const m = TCG_MECHANICS[k];
            return (
              <div key={k} className={`tcg-mech-card tcg-mech-card--${k}`}>
                <div className="tcg-mech-card-head">
                  <span className="tcg-mech-card-icon" style={{ background: m.color }}>{m.icon}</span>
                  <span className="tcg-mech-card-name">{m.name}</span>
                </div>
                <div className="tcg-mech-card-rules">{m.rules}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">★ Rarità</h2>
        <div className="tcg-rarity-grid">
          {["common", "rare", "epic", "legendary"].map(r => (
            <div key={r} className={`tcg-rarity-card tcg-rarity-card--${r}`}>
              <div className="tcg-rarity-card-name" style={{ color: RARITY_COLOR[r] }}>
                ★ {RARITY_LABEL[r]}
              </div>
              <div className="tcg-rarity-card-desc">
                {r === "common"    && "Le carte di base. Costano poco mana e formano lo zoccolo del mazzo."}
                {r === "rare"      && "Specialisti affidabili. Una meccanica di rilievo o stat sopra la media."}
                {r === "epic"      && "Bestie di rispetto. Più meccaniche combinate, costo medio-alto."}
                {r === "legendary" && "Le creature da copertina. Stat alte, 3 meccaniche, esemplari rarissimi."}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
