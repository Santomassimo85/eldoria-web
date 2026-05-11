import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "../firebase";
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, getDoc, increment, arrayUnion,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { PET_SPECIES, RARITY_LABEL, RARITY_COLOR } from "../data/petSpecies";
import { PET_MOVES, TYPE_ICON, TYPE_LABEL, diceLabel } from "../data/petMoves";
import {
  petStatsAtLevel, levelFromExp, expForLevel, petUnlockedMoves,
  petEffectiveHp, petNextHealTickIn, expFromBattle,
} from "../utils/pet";
import {
  MAX_TEAM_SIZE, MIN_TEAM_SIZE, TYPE_CYCLE, LIGHT_DARK_PAIR,
  ACTION_TIMEOUT_MS,
  petSnapshotForBattle, initLiveBattleState, resolveLiveRound,
  snapshotUnlockedMoves, firstAliveSwitch, pickAutoAction,
} from "../utils/petBattleLive";
import PetAvatar from "../components/PetAvatar";
import "./PetArena.css";

export default function PetArena({ embedded = false } = {}) {
  const { currentUser } = useAuth();
  const [me, setMe] = useState(null);
  const [openMatches, setOpen] = useState([]);
  const [activeBattles, setActive] = useState([]);
  const [resolvedBattles, setResolved] = useState([]);
  const [picker, setPicker] = useState(null); // { mode: "create" | "accept", battleId? }
  const [activeBattleId, setActiveBattleId] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Live "me" snapshot ──────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(doc(db, "characters", currentUser.uid), s => {
      if (s.exists()) setMe({ uid: currentUser.uid, ...s.data() });
    });
  }, [currentUser]);

  // ── Stream battles (v2 = live) ──────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "pet_battles"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(b => b.version === 2);
      setOpen(all.filter(b => b.status === "open"));
      setActive(all.filter(b => b.status === "active" && (b.challenger?.uid === currentUser.uid || b.challenged?.uid === currentUser.uid)));
      setResolved(all.filter(b => b.status === "resolved").slice(0, 8));
    });
  }, [currentUser]);

  // ── Auto-enter battle screen when I have an active battle ───
  useEffect(() => {
    if (activeBattleId) return;
    const mine = activeBattles[0];
    if (mine) setActiveBattleId(mine.id);
  }, [activeBattles, activeBattleId]);

  const myPets = useMemo(() => Array.isArray(me?.pets) ? me.pets : [], [me]);
  const isResting = (pet) => pet.restingUntil && new Date(pet.restingUntil) > new Date();
  const eligiblePets = myPets.filter(p => !isResting(p) && petEffectiveHp(p) > 0);

  /* ── Create challenge ──────────────────────────────────── */
  const createChallenge = async (team) => {
    if (!currentUser || !me || team.length < MIN_TEAM_SIZE) return;
    try {
      const snaps = team.map(petSnapshotForBattle).filter(Boolean);
      await addDoc(collection(db, "pet_battles"), {
        version: 2,
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        challenger: { uid: currentUser.uid, ownerName: me.name || "Sfidante" },
        challenged: null,
        teams: { challenger: snaps, challenged: [] },
        state: null,
      });
      setPicker(null);
    } catch (err) {
      console.error("create challenge failed", err);
      alert("Errore: " + err.message);
    }
  };

  /* ── Accept challenge ──────────────────────────────────── */
  const acceptChallenge = async (battle, team) => {
    if (!currentUser || !me) return;
    if (battle.challenger.uid === currentUser.uid) {
      alert("Non puoi accettare la tua stessa sfida.");
      return;
    }
    try {
      const snaps = team.map(petSnapshotForBattle).filter(Boolean);
      const initState = initLiveBattleState(battle.teams.challenger, snaps);
      const ref = doc(db, "pet_battles", battle.id);
      await updateDoc(ref, {
        status: "active",
        updatedAt: serverTimestamp(),
        challenged: { uid: currentUser.uid, ownerName: me.name || "Sfidato" },
        "teams.challenged": snaps,
        state: initState,
      });
      setPicker(null);
      setActiveBattleId(battle.id);
    } catch (err) {
      console.error("accept failed:", err);
      alert("Errore: " + (err?.message || err));
    }
  };

  const cancelChallenge = async (battle) => {
    if (!currentUser) return;
    if (battle.challenger.uid !== currentUser.uid) return;
    if (!window.confirm("Annullare la tua sfida?")) return;
    try { await deleteDoc(doc(db, "pet_battles", battle.id)); } catch (err) { console.error(err); }
  };

  if (!currentUser) {
    const lockedBody = (
      <div className="pa-locked">
        <div className="pa-locked-icon">🐉</div>
        <h2>Pet Arena</h2>
        <p>Effettua l'accesso per portare i tuoi compagni in battaglia.</p>
      </div>
    );
    return embedded ? lockedBody : <section className="pa-page">{lockedBody}</section>;
  }

  const Wrapper = embedded ? React.Fragment : "section";
  const wrapperProps = embedded ? {} : { className: "pa-page" };

  // ── If I'm in an active battle, show the live battle screen ──
  const activeBattle = activeBattles.find(b => b.id === activeBattleId);
  if (activeBattle) {
    return (
      <Wrapper {...wrapperProps}>
        <LiveBattleScreen
          battle={activeBattle}
          me={me}
          onExit={() => setActiveBattleId(null)}
          embedded={embedded}
        />
      </Wrapper>
    );
  }

  return (
    <Wrapper {...wrapperProps}>
      {!embedded && (
        <header className="pa-head">
          <h1 className="pa-title">🐉 Pet Arena</h1>
          <p className="pa-sub">Sfide live a squadre · scegli da 1 a 5 compagni, scambia in volata, conquista la vittoria.</p>
        </header>
      )}

      <TypeCycleLegend />

      {/* My pets summary */}
      <div className="pa-panel">
        <h2 className="pa-panel-title">⚔ I tuoi compagni</h2>
        {myPets.length === 0 ? (
          <p className="pa-empty">Non hai ancora nessun compagno. Vai alla <Link to="/pet">Bottega</Link> ▸ Bestiario.</p>
        ) : (
          <div className="pa-pet-row">
            {myPets.map(pet => {
              const sp = PET_SPECIES[pet.speciesKey];
              if (!sp) return null;
              const lvl = levelFromExp(pet.exp || 0);
              const stats = petStatsAtLevel(pet.speciesKey, lvl);
              const curHp = petEffectiveHp(pet);
              const hpPct = Math.max(0, Math.min(100, (curHp / stats.hp) * 100));
              const resting = isResting(pet);
              const minutesLeft = resting ? Math.ceil((new Date(pet.restingUntil) - new Date()) / 60000) : 0;
              const tickMs = petNextHealTickIn(pet);
              const tickMin = tickMs > 0 ? Math.max(1, Math.ceil(tickMs / 60000)) : 0;
              return (
                <div key={pet.id} className={`pa-pet-mini pa-pet-mini--${sp.type}`}>
                  <PetAvatar species={sp} className="pa-pet-mini-icon" />
                  <div className="pa-pet-mini-name">{pet.nickname}</div>
                  <div className="pa-pet-mini-meta">Lv {lvl} · {TYPE_ICON[sp.type]}</div>
                  <div className="pa-pet-mini-bar">
                    <div className="pa-pet-mini-bar-fill" style={{ width: `${hpPct}%` }} />
                  </div>
                  <div className="pa-pet-mini-hp">{curHp}/{stats.hp} PF</div>
                  {tickMin > 0 && <div className="pa-pet-mini-regen">💚 +1 PF tra {tickMin}m</div>}
                  {resting && <div className="pa-resting">😴 {minutesLeft}min</div>}
                </div>
              );
            })}
          </div>
        )}
        {eligiblePets.length > 0 && (
          <button type="button" className="pa-btn pa-btn--primary pa-create-btn"
                  onClick={() => setPicker({ mode: "create" })}>
            ⚔ Lancia una sfida (squadra di 1-{MAX_TEAM_SIZE})
          </button>
        )}
      </div>

      {/* Open challenges */}
      <div className="pa-panel">
        <h2 className="pa-panel-title">📯 Sfide in attesa</h2>
        {openMatches.length === 0 ? (
          <p className="pa-empty">Nessuna sfida aperta. Sii il primo a lanciarne una!</p>
        ) : (
          <div className="pa-challenge-list">
            {openMatches.map(b => {
              const isMine = b.challenger.uid === currentUser.uid;
              const team = b.teams?.challenger || [];
              return (
                <div key={b.id} className={`pa-challenge-row ${isMine ? "pa-challenge-row--mine" : ""}`}>
                  <div className="pa-ch-team">
                    {team.map((p, i) => (
                      <PetAvatar
                        key={p.petId || i}
                        species={PET_SPECIES[p.speciesKey]}
                        className="pa-ch-team-icon"
                      />
                    ))}
                  </div>
                  <div className="pa-ch-info">
                    <div className="pa-ch-pet-name">
                      <strong>{b.challenger.ownerName}</strong> · squadra di {team.length}
                    </div>
                    <div className="pa-ch-meta">
                      {team.map(p => `${p.icon} Lv${p.level}`).join(" · ")}
                    </div>
                  </div>
                  {isMine ? (
                    <button className="pa-btn pa-btn--ghost" onClick={() => cancelChallenge(b)}>✕ Annulla</button>
                  ) : (
                    <button
                      className="pa-btn pa-btn--accept"
                      disabled={eligiblePets.length === 0}
                      onClick={() => setPicker({ mode: "accept", battleId: b.id })}
                    >
                      {eligiblePets.length === 0 ? "Nessun compagno disponibile" : "⚔ Accetta"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent results */}
      <div className="pa-panel">
        <h2 className="pa-panel-title">📜 Ultimi scontri</h2>
        {resolvedBattles.length === 0 ? (
          <p className="pa-empty">Nessuno scontro risolto ancora.</p>
        ) : (
          <div className="pa-recent-list">
            {resolvedBattles.map(b => {
              const w = b.state?.winner;
              const winnerName = w === "challenger" ? b.challenger?.ownerName
                : w === "challenged" ? b.challenged?.ownerName
                : "Pareggio";
              return (
                <div key={b.id} className="pa-recent-row">
                  <div className="pa-recent-summary">
                    <span className={`pa-recent-side ${w === "challenger" ? "win" : w === "draw" ? "" : "loss"}`}>
                      {b.challenger?.ownerName} ({b.teams?.challenger?.length || 0})
                    </span>
                    <span className="pa-recent-vs">vs</span>
                    <span className={`pa-recent-side ${w === "challenged" ? "win" : w === "draw" ? "" : "loss"}`}>
                      {b.challenged?.ownerName} ({b.teams?.challenged?.length || 0})
                    </span>
                    <span className="pa-recent-winner">→ {winnerName}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Team picker modal */}
      {picker && (
        <TeamPickerModal
          pets={eligiblePets}
          onClose={() => setPicker(null)}
          onPick={(team) => {
            if (picker.mode === "create") createChallenge(team);
            else {
              const battle = openMatches.find(b => b.id === picker.battleId);
              if (battle) acceptChallenge(battle, team);
            }
          }}
          mode={picker.mode}
          requireSize={picker.mode === "accept"
            ? openMatches.find(b => b.id === picker.battleId)?.teams?.challenger?.length
            : null}
        />
      )}
    </Wrapper>
  );
}

/* ============================================================
   TYPE CYCLE LEGEND — small bar showing 🔥 → 🌿 → ⚡ → 💧 → 🔥
   ============================================================ */
function TypeCycleLegend() {
  return (
    <div className="pa-type-cycle-wrap">
      <div
        className="pa-type-cycle"
        title="Ogni tipo è super-efficace contro il successivo (×1.5) e poco efficace contro il precedente (×0.5)."
      >
        <span className="pa-type-cycle-label">Cerchio di Resistenza</span>
        {TYPE_CYCLE.map((t, i) => (
          <React.Fragment key={t}>
            <span className={`pa-type-cycle-node pa-type-cycle-node--${t}`}>
              {TYPE_ICON[t]} {TYPE_LABEL[t]}
            </span>
            {i < TYPE_CYCLE.length - 1 && <span className="pa-type-cycle-arrow">→</span>}
          </React.Fragment>
        ))}
        <span className="pa-type-cycle-arrow">↺</span>
      </div>
      <div
        className="pa-type-cycle pa-type-cycle--pair"
        title="Luce e Tenebre si combattono solo tra loro: ×1.5 reciproco. Sono neutre contro tutti gli altri elementi."
      >
        <span className="pa-type-cycle-label">Dualità</span>
        <span className={`pa-type-cycle-node pa-type-cycle-node--${LIGHT_DARK_PAIR[0]}`}>
          {TYPE_ICON[LIGHT_DARK_PAIR[0]]} {TYPE_LABEL[LIGHT_DARK_PAIR[0]]}
        </span>
        <span className="pa-type-cycle-arrow">⇄</span>
        <span className={`pa-type-cycle-node pa-type-cycle-node--${LIGHT_DARK_PAIR[1]}`}>
          {TYPE_ICON[LIGHT_DARK_PAIR[1]]} {TYPE_LABEL[LIGHT_DARK_PAIR[1]]}
        </span>
      </div>
    </div>
  );
}

/* ── Stats legend (collapsible) ────────────────────────── */
function StatsLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pa-stats-legend">
      <button
        type="button"
        className="pa-stats-legend-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {open ? "▼" : "▶"} ❔ Cosa significano le statistiche?
      </button>
      {open && (
        <div className="pa-stats-legend-body">
          <div className="pa-stats-legend-row">
            <span className="pa-stat-key">🛡 CA</span>
            <span>Classe Armatura. L'attaccante tira <b>d20 + ATK + mod. mossa</b> e deve eguagliare o superare la CA per colpire.</span>
          </div>
          <div className="pa-stats-legend-row">
            <span className="pa-stat-key">⚔ ATK</span>
            <span>Bonus al tiro per colpire. Cresce di +1 ogni 2 livelli (oltre alla base specie).</span>
          </div>
          <div className="pa-stats-legend-row">
            <span className="pa-stat-key">💨 SPD</span>
            <span>Velocità. Determina chi attacca per primo nel round; cresce ogni 3 livelli.</span>
          </div>
          <div className="pa-stats-legend-row">
            <span className="pa-stat-key">🎯 PROF</span>
            <span>Bonus competenza. Sommato ai dadi di danno (es. <code>1d6+PROF</code>). +2 a Lv1-4, +3 a Lv5-8, +4 a Lv9+.</span>
          </div>
          <div className="pa-stats-legend-row">
            <span className="pa-stat-key">PF</span>
            <span>Punti Ferita. Cresce di +2 per livello; salire di livello ripristina i PF al massimo.</span>
          </div>
          <div className="pa-stats-legend-row">
            <span className="pa-stat-key">🎲 d20</span>
            <span>Tiro per colpire: nat <b>20</b> = critico (doppi dadi danno), nat <b>1</b> = fallimento critico (manca a prescindere).</span>
          </div>
          <div className="pa-stats-legend-row">
            <span className="pa-stat-key">×1.5 / ×0.5</span>
            <span>Moltiplicatore di tipo. Vedi il "Cerchio di Resistenza" sopra: super-efficace o poco efficace contro alcuni elementi.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TEAM PICKER MODAL — pick 1 to MAX_TEAM_SIZE pets.
   When accepting, lock the team size to match the challenger.
   ============================================================ */
function TeamPickerModal({ pets, onClose, onPick, mode, requireSize }) {
  const [selected, setSelected] = useState([]); // array of pet.id

  const toggle = (petId) => {
    setSelected(prev => {
      if (prev.includes(petId)) return prev.filter(x => x !== petId);
      if (prev.length >= MAX_TEAM_SIZE) return prev;
      return [...prev, petId];
    });
  };

  const team = selected.map(id => pets.find(p => p.id === id)).filter(Boolean);
  const sizeOk = requireSize ? team.length === requireSize : team.length >= MIN_TEAM_SIZE;

  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div className="pa-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="pa-modal-head">
          <h3>
            {mode === "create" ? "Scegli la tua squadra" : "Componi la squadra per accettare"}
            {requireSize && <span className="pa-team-required"> · serve esattamente {requireSize}</span>}
          </h3>
          <button className="pa-modal-close" onClick={onClose}>✕</button>
        </header>
        <div className="pa-modal-body">
          <div className="pa-team-counter">
            Selezionati: <strong>{team.length}</strong> / {requireSize || `1-${MAX_TEAM_SIZE}`}
          </div>
          {pets.length === 0 ? (
            <p className="pa-empty">Nessun compagno pronto al combattimento.</p>
          ) : (
            <div className="pa-picker-grid">
              {pets.map(pet => {
                const sp = PET_SPECIES[pet.speciesKey];
                const lvl = levelFromExp(pet.exp || 0);
                const stats = petStatsAtLevel(pet.speciesKey, lvl);
                const moves = petUnlockedMoves(pet);
                const isSel = selected.includes(pet.id);
                const order = isSel ? selected.indexOf(pet.id) + 1 : null;
                return (
                  <button
                    key={pet.id}
                    className={`pa-picker-card pa-picker-card--${sp?.type} ${isSel ? "pa-picker-card--selected" : ""}`}
                    onClick={() => toggle(pet.id)}
                  >
                    {order && <span className="pa-team-order">#{order}</span>}
                    <PetAvatar species={sp} className="pa-picker-icon" />
                    <div className="pa-picker-name">{pet.nickname}</div>
                    <div className="pa-picker-meta">Lv {lvl} · {TYPE_ICON[sp?.type]}</div>
                    <div className="pa-picker-stats">
                      ❤️ {petEffectiveHp(pet)}/{stats.hp} · 🛡 {stats.ac} · 🎯 +{stats.atkBonus} · ⚡ {stats.spd}
                    </div>
                    <div className="pa-picker-moves">
                      {moves.map(m => (
                        <span
                          key={m.id}
                          className={`pa-picker-move pa-picker-move--${m.category}`}
                          title={`${m.name} · ${m.desc}${m.damageDice ? ` · ${diceLabel(m.damageDice)}` : ""}`}
                        >
                          {m.icon}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <footer className="pa-modal-foot">
          <button className="pa-btn pa-btn--ghost" onClick={onClose}>Annulla</button>
          <button
            className="pa-btn pa-btn--primary"
            disabled={!sizeOk}
            onClick={() => onPick(team)}
          >
            {mode === "create" ? `⚔ Lancia con ${team.length} pet` : `⚔ Combatti con ${team.length} pet`}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ============================================================
   LIVE BATTLE SCREEN — turn-based real-time PvP
   ============================================================ */
function LiveBattleScreen({ battle, me, onExit, embedded }) {
  const { currentUser } = useAuth();
  const isChallenger = battle.challenger.uid === currentUser.uid;
  const mySide = isChallenger ? "challenger" : "challenged";
  const oppSide = isChallenger ? "challenged" : "challenger";

  const myTeam = battle.teams[mySide];
  const oppTeam = battle.teams[oppSide];
  const myActiveIdx = battle.state.activeIdx[mySide];
  const oppActiveIdx = battle.state.activeIdx[oppSide];
  const myActive = myTeam[myActiveIdx];
  const oppActive = oppTeam[oppActiveIdx];
  const myHp = battle.state.hp[mySide][myActiveIdx];
  const oppHp = battle.state.hp[oppSide][oppActiveIdx];
  const myPending = battle.state.pendingActions[mySide];
  const oppPending = battle.state.pendingActions[oppSide];
  const winner = battle.state.winner;

  const [showSwitch, setShowSwitch] = useState(false);
  const [now, setNow] = useState(Date.now());
  const resolveLockRef = useRef(false);
  const autoLockRef = useRef({}); // side+round → bool

  /* ── 1Hz tick for countdowns ──────────────────────────── */
  useEffect(() => {
    if (winner) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [winner]);

  /* ── Auto-submit when a deadline expires ─────────────── */
  useEffect(() => {
    if (winner) return;
    for (const side of ["challenger", "challenged"]) {
      const ddl = battle.state.actionDeadlines?.[side];
      if (!ddl) continue;
      if (battle.state.pendingActions?.[side]) continue;
      if (new Date(ddl).getTime() > now) continue;

      // De-dupe: only fire once per (round, side) per client
      const key = `${battle.state.round}|${side}`;
      if (autoLockRef.current[key]) continue;
      autoLockRef.current[key] = true;

      const action = pickAutoAction(
        battle.id, battle.state.round, side, battle.teams, battle.state
      );
      if (!action) continue;

      updateDoc(doc(db, "pet_battles", battle.id), {
        [`state.pendingActions.${side}`]: action,
        [`state.actionDeadlines.${side}`]: null,
        updatedAt: serverTimestamp(),
      }).catch(err => {
        console.warn("[auto-submit failed]", err);
        // Allow retry on next tick
        autoLockRef.current[key] = false;
      });
    }
  }, [now, battle, winner]);

  /* ── Round resolution (challenger client only) ────────── */
  useEffect(() => {
    if (winner) return;
    if (!isChallenger) return;
    // Forfeits short-circuit: resolve immediately even with one side pending.
    const forfeitPending = myPending?.kind === "forfeit" || oppPending?.kind === "forfeit";
    if (!forfeitPending && (!myPending || !oppPending)) return;
    if (resolveLockRef.current) return;
    resolveLockRef.current = true;

    (async () => {
      try {
        const fresh = await getDoc(doc(db, "pet_battles", battle.id));
        if (!fresh.exists()) return;
        const data = fresh.data();
        const aPend = data.state?.pendingActions?.challenger;
        const bPend = data.state?.pendingActions?.challenged;
        const aFor = aPend?.kind === "forfeit";
        const bFor = bPend?.kind === "forfeit";
        // Allow resolution when both submitted OR either side forfeited.
        if (!aFor && !bFor && (!aPend || !bPend)) return;
        if (data.state.winner) return;
        const newState = resolveLiveRound({
          challenger: data.challenger,
          challenged: data.challenged,
          teams: data.teams,
          state: data.state,
        });
        const update = {
          state: newState,
          updatedAt: serverTimestamp(),
        };
        if (newState.winner) {
          update.status = "resolved";
        }
        await updateDoc(doc(db, "pet_battles", battle.id), update);
      } catch (err) {
        console.error("resolve round failed:", err);
      } finally {
        // Allow next resolution after a short delay
        setTimeout(() => { resolveLockRef.current = false; }, 200);
      }
    })();
  }, [myPending, oppPending, isChallenger, battle.id, winner]);

  /* ── On battle end, persist back to both players ──────── */
  const persistedRef = useRef(false);
  useEffect(() => {
    if (!winner) return;
    if (persistedRef.current) return;
    if (!isChallenger) return; // only host writes results
    persistedRef.current = true;
    (async () => {
      try {
        await persistBattleResults(battle, mySide, oppSide);
      } catch (err) {
        console.error("persist results failed:", err);
      }
    })();
  }, [winner, isChallenger, battle, mySide, oppSide]);

  /* ── Submit my action ────────────────────────────────── */
  const submitAction = async (action) => {
    if (winner) return;
    if (myPending) return;
    try {
      await updateDoc(doc(db, "pet_battles", battle.id), {
        [`state.pendingActions.${mySide}`]: action,
        [`state.actionDeadlines.${mySide}`]: null,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("submit action failed:", err);
      alert("Errore: " + err.message);
    }
  };

  const myAlive = battle.state.hp[mySide].some(h => h > 0);
  const myActiveFainted = myHp <= 0;
  const moves = snapshotUnlockedMoves(myActive);

  // If my active is KO'd, force-show the switch panel
  useEffect(() => {
    if (myActiveFainted && myAlive && !myPending) setShowSwitch(true);
  }, [myActiveFainted, myAlive, myPending]);

  const handleForfeit = async () => {
    if (!window.confirm("Sicuro di voler abbandonare? Perderai la sfida.")) return;
    await submitAction({ kind: "forfeit" });
  };

  if (winner) {
    const won = winner === mySide;
    return (
      <div className="pa-battle-end">
        <h2 className={`pa-battle-end-title pa-battle-end-title--${winner === "draw" ? "draw" : won ? "win" : "loss"}`}>
          {winner === "draw" ? "⚖ Pareggio" : won ? "🏆 Vittoria!" : "💀 Sconfitta"}
        </h2>
        {won && <p className="pa-battle-end-sub">+5 punti Bestiario · EXP guadagnata · 30 min di riposo per la squadra</p>}
        {!won && winner !== "draw" && <p className="pa-battle-end-sub">La tua squadra si ritira a leccarsi le ferite (30 min di riposo).</p>}
        <div className="pa-battle-log pa-battle-log--end">
          {(battle.state.log || []).slice(-30).map((line, i) => {
            const text = typeof line === "string" ? line : line.text;
            const lineSide = typeof line === "object" && line ? line.side : null;
            const sideClass = lineSide === mySide ? " pa-battle-line--mine"
              : lineSide && lineSide !== "draw" ? " pa-battle-line--opp"
              : "";
            return <div key={i} className={`pa-battle-line${sideClass}`}>{text}</div>;
          })}
        </div>
        <button className="pa-btn pa-btn--primary" onClick={onExit}>Torna al lobby</button>
      </div>
    );
  }

  return (
    <div className="pa-live">
      <header className="pa-live-head">
        <div className="pa-live-round">Round {battle.state.round}</div>
        <div className="pa-live-timers">
          <ActionTimer
            label="Tu"
            deadlineIso={battle.state.actionDeadlines?.[mySide]}
            submitted={!!myPending}
            now={now}
          />
          <ActionTimer
            label="Avv."
            deadlineIso={battle.state.actionDeadlines?.[oppSide]}
            submitted={!!oppPending}
            now={now}
          />
        </div>
        <button className="pa-btn pa-btn--ghost pa-btn--tiny" onClick={handleForfeit}>🏳 Abbandona</button>
      </header>

      <TypeCycleLegend />
      <StatsLegend />

      <div className="pa-live-field">
        {/* Opponent side */}
        <div className="pa-live-side pa-live-side--opp">
          <div className="pa-live-owner">{battle[oppSide]?.ownerName || "Avversario"}</div>
          <PetCard
            pet={oppActive}
            hp={oppHp}
            shield={battle.state.shield[oppSide][oppActiveIdx]}
            poison={battle.state.poison[oppSide][oppActiveIdx]}
            opponent
          />
          <BenchRow team={oppTeam} activeIdx={oppActiveIdx} hp={battle.state.hp[oppSide]} />
        </div>

        <div className="pa-live-vs">⚔</div>

        {/* My side */}
        <div className="pa-live-side pa-live-side--mine">
          <div className="pa-live-owner">Tu</div>
          <PetCard
            pet={myActive}
            hp={myHp}
            shield={battle.state.shield[mySide][myActiveIdx]}
            poison={battle.state.poison[mySide][myActiveIdx]}
          />
          <BenchRow team={myTeam} activeIdx={myActiveIdx} hp={battle.state.hp[mySide]} />
        </div>
      </div>

      {/* Action panel */}
      <div className="pa-live-actions">
        {myPending ? (
          <div className="pa-live-waiting">
            ⏳ Azione inviata · in attesa dell'avversario…
            <span className="pa-live-waiting-sub">
              {oppPending ? "(risolvendo il round…)" : "(non hanno ancora scelto)"}
            </span>
          </div>
        ) : myActiveFainted && myAlive ? (
          <SwitchPanel
            team={myTeam}
            hp={battle.state.hp[mySide]}
            activeIdx={myActiveIdx}
            onSwitch={(toIdx) => submitAction({ kind: "switch", toIdx })}
            forced
          />
        ) : showSwitch ? (
          <SwitchPanel
            team={myTeam}
            hp={battle.state.hp[mySide]}
            activeIdx={myActiveIdx}
            onSwitch={(toIdx) => { setShowSwitch(false); submitAction({ kind: "switch", toIdx }); }}
            onCancel={() => setShowSwitch(false)}
          />
        ) : (
          <MovePanel
            moves={moves}
            moveUses={battle.state.moveUses[mySide][myActiveIdx]}
            onPick={(moveId) => submitAction({ kind: "move", moveId })}
            onShowSwitch={() => setShowSwitch(true)}
            canSwitch={myTeam.length > 1 && firstAliveSwitch(battle.state, mySide) >= 0}
          />
        )}
      </div>

      {/* Battle log */}
      <div className="pa-battle-log">
        {(battle.state.log || []).slice(-15).map((line, i) => {
          const text = typeof line === "string" ? line : line.text;
          const lineSide = typeof line === "object" && line ? line.side : null;
          const sideClass = lineSide === mySide ? " pa-battle-line--mine"
            : lineSide && lineSide !== "draw" ? " pa-battle-line--opp"
            : "";
          return <div key={i} className={`pa-battle-line${sideClass}`}>{text}</div>;
        })}
      </div>
    </div>
  );
}

/* ── Action timer badge ───────────────────────────────── */
function ActionTimer({ label, deadlineIso, submitted, now }) {
  if (submitted) {
    return <span className="pa-timer pa-timer--done">{label}: ✓</span>;
  }
  if (!deadlineIso) return null;
  const ms = Math.max(0, new Date(deadlineIso).getTime() - now);
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const urgent = ms <= 30000;
  return (
    <span className={`pa-timer ${urgent ? "pa-timer--urgent" : ""}`} title={`${label}: tempo per scegliere — auto-attacco se scade`}>
      {label}: ⏱ {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

/* ── Active pet card ──────────────────────────────────── */
function PetCard({ pet, hp, shield, poison, opponent }) {
  if (!pet) return null;
  const hpPct = Math.max(0, Math.min(100, (hp / pet.maxHp) * 100));
  const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
  return (
    <div className={`pa-live-card pa-live-card--${pet.type} ${opponent ? "pa-live-card--opp" : ""}`}>
      <PetAvatar species={{ image: PET_SPECIES[pet.speciesKey]?.image, icon: pet.icon, name: pet.nickname }} className="pa-live-avatar" />
      <div className="pa-live-info">
        <div className="pa-live-name">{pet.nickname}</div>
        <div className="pa-live-meta">
          Lv {pet.level} · <span className={`pa-type-badge pa-type-badge--${pet.type}`}>{TYPE_ICON[pet.type]} {TYPE_LABEL[pet.type]}</span>
        </div>
        <div className="pa-live-stats">
          <span className="pa-stat" title="Classe Armatura — l'attaccante deve eguagliare o superare questo numero per colpire">
            🛡 CA <b>{pet.ac}</b>
          </span>
          <span className="pa-stat" title="Bonus al tiro per colpire — sommato al d20 di ogni attacco">
            ⚔ ATK <b>{fmt(pet.atkBonus)}</b>
          </span>
          <span className="pa-stat" title="Velocità — chi è più veloce attacca per primo nel round">
            💨 SPD <b>{pet.spd}</b>
          </span>
          <span className="pa-stat" title="Bonus competenza — sommato ai dadi di danno">
            🎯 PROF <b>{fmt(pet.profBonus)}</b>
          </span>
        </div>
        <div className="pa-live-hp-label">
          <span>PF {hp} / {pet.maxHp}</span>
          {shield?.turns > 0 && <span className="pa-live-buff">🛡 +{shield.val} ({shield.turns}t)</span>}
          {poison?.turns > 0 && <span className="pa-live-debuff">☠ {poison.val}/t ({poison.turns}t)</span>}
        </div>
        <div className="pa-live-hp-track">
          <div className="pa-live-hp-fill" style={{ width: `${hpPct}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ── Bench row (small icons for the rest of the team) ── */
function BenchRow({ team, activeIdx, hp }) {
  if (!team || team.length <= 1) return null;
  return (
    <div className="pa-live-bench">
      {team.map((p, i) => {
        const ko = hp[i] <= 0;
        const active = i === activeIdx;
        return (
          <div
            key={p.petId || i}
            className={`pa-live-bench-pet ${active ? "pa-live-bench-pet--active" : ""} ${ko ? "pa-live-bench-pet--ko" : ""}`}
            title={`${p.nickname} · ${hp[i]}/${p.maxHp} PF${ko ? " · KO" : ""}`}
          >
            <PetAvatar species={{ image: PET_SPECIES[p.speciesKey]?.image, icon: p.icon, name: p.nickname }} className="pa-bench-icon" />
            <div className="pa-bench-hp-mini">
              <div className="pa-bench-hp-fill" style={{ width: `${Math.max(0, (hp[i] / p.maxHp) * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Move panel ───────────────────────────────────────── */
function MovePanel({ moves, moveUses, onPick, onShowSwitch, canSwitch }) {
  return (
    <div className="pa-action-grid">
      {moves.map(m => {
        const left = m.maxUses == null ? "∞" : (moveUses?.[m.id] ?? m.maxUses);
        const out = m.maxUses != null && left <= 0;
        const dice = m.damageDice ? diceLabel(m.damageDice) : null;
        return (
          <button
            key={m.id}
            type="button"
            className={`pa-action-btn pa-action-btn--${m.type} pa-action-btn--${m.category} ${out ? "pa-action-btn--out" : ""}`}
            onClick={() => onPick(m.id)}
            disabled={out}
            title={m.desc}
          >
            <div className="pa-action-row">
              <span className="pa-action-icon">{m.icon}</span>
              <span className="pa-action-name">{m.name}</span>
              <span className="pa-action-uses">{left}</span>
            </div>
            <div className="pa-action-meta">
              {TYPE_ICON[m.type]} {dice && <span className="pa-action-dice">{dice}</span>}
              {(m.toHit || 0) !== 0 && <span> · {m.toHit > 0 ? "+" : ""}{m.toHit} colpo</span>}
              {m.effect?.kind === "heal" && <span> · ♥+{m.effect.value}</span>}
              {m.effect?.kind === "shield" && <span> · 🛡+{m.effect.value}</span>}
              {m.effect?.kind === "poison" && <span> · ☠{m.effect.value}/t</span>}
            </div>
          </button>
        );
      })}
      {canSwitch && (
        <button
          type="button"
          className="pa-action-btn pa-action-btn--switch"
          onClick={onShowSwitch}
          title="Sostituisci il compagno (gratis, dopo lo scambio puoi attaccare lo stesso turno)"
        >
          <div className="pa-action-row">
            <span className="pa-action-icon">🔄</span>
            <span className="pa-action-name">Sostituisci</span>
          </div>
          <div className="pa-action-meta">cambia compagno · azione gratuita</div>
        </button>
      )}
    </div>
  );
}

/* ── Switch panel ─────────────────────────────────────── */
function SwitchPanel({ team, hp, activeIdx, onSwitch, onCancel, forced }) {
  return (
    <div className="pa-switch-panel">
      <h4 className="pa-switch-title">
        {forced ? "💀 Il tuo compagno è KO · scegli chi schierare" : "🔄 Scegli il compagno da schierare"}
      </h4>
      <div className="pa-switch-grid">
        {team.map((p, i) => {
          const ko = hp[i] <= 0;
          const current = i === activeIdx;
          const disabled = ko || current;
          return (
            <button
              key={p.petId || i}
              type="button"
              disabled={disabled}
              className={`pa-switch-pet ${disabled ? "pa-switch-pet--disabled" : ""}`}
              onClick={() => onSwitch(i)}
              title={ko ? "KO" : current ? "Già in campo" : "Schiera"}
            >
              <PetAvatar species={{ image: PET_SPECIES[p.speciesKey]?.image, icon: p.icon, name: p.nickname }} className="pa-switch-avatar" />
              <div className="pa-switch-name">{p.nickname}</div>
              <div className="pa-switch-hp">{hp[i]}/{p.maxHp} PF</div>
              {ko && <div className="pa-switch-badge">KO</div>}
              {current && <div className="pa-switch-badge pa-switch-badge--active">in campo</div>}
            </button>
          );
        })}
      </div>
      {!forced && onCancel && (
        <button className="pa-btn pa-btn--ghost pa-btn--tiny" onClick={onCancel}>← Indietro</button>
      )}
    </div>
  );
}

/* ============================================================
   Persist results — write back HP / EXP / wins / losses /
   restingUntil / lastHealTick for both players' teams.
   Award pet points to the winner.
   ============================================================ */
async function persistBattleResults(battle, mySide, oppSide) {
  const restingUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const winner = battle.state.winner;

  const writeForSide = async (side) => {
    const sideData = battle[side];
    if (!sideData?.uid) return;
    const ref = doc(db, "characters", sideData.uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const pets = Array.isArray(data.pets) ? data.pets.slice() : [];
      const team = battle.teams[side] || [];
      const opp = side === "challenger" ? "challenged" : "challenger";
      const oppTeam = battle.teams[opp] || [];
      const oppAvgLvl = Math.max(1, Math.round(
        oppTeam.reduce((s, p) => s + (p.level || 1), 0) / Math.max(1, oppTeam.length)
      ));
      const sideWon = winner === side;
      const drew = winner === "draw";

      // EXP rules: every pet that participated gains EXP.
      //   Winners: full reward (15 + 5×opponentAvgLevel).
      //   Losers / draws: half reward (rounded down, min 1).
      // Level-up auto-fills HP.
      const fullReward = expFromBattle(oppAvgLvl);
      const expReward = sideWon ? fullReward : Math.max(1, Math.floor(fullReward / 2));

      team.forEach((snapPet, i) => {
        const idx = pets.findIndex(p => p.id === snapPet.petId);
        if (idx < 0) return;
        const updated = { ...pets[idx] };
        const newHp = battle.state.hp[side][i];
        updated.currentHp = Math.max(1, newHp);
        updated.lastHealTick = nowIso;
        updated.restingUntil = restingUntil;

        const lvlBefore = updated.level || levelFromExp(updated.exp || 0);
        updated.exp = (updated.exp || 0) + expReward;
        updated.level = levelFromExp(updated.exp);
        if (updated.level > lvlBefore) {
          const stats = petStatsAtLevel(updated.speciesKey, updated.level, updated.bonusStats);
          updated.currentHp = stats.hp; // free heal on level-up (preserves item bonusStats)
        }

        if (sideWon) {
          updated.wins = (updated.wins || 0) + 1;
        } else if (!drew) {
          updated.losses = (updated.losses || 0) + 1;
        }

        pets[idx] = updated;
      });

      const patch = { pets };
      if (sideWon) {
        patch.petPoints = increment(5);
        patch.petPointsLedger = arrayUnion({
          source: "pet_battle_win",
          label: "Vittoria al Pet Arena (live)",
          amount: 5,
          ts: nowIso,
          resourceKey: battle.id,
        });
      }
      await updateDoc(ref, patch);
    } catch (err) {
      console.warn(`[persistBattleResults ${side}]`, err);
    }
  };

  await writeForSide("challenger");
  await writeForSide("challenged");
}
