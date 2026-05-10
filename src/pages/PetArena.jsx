import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "../firebase";
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, getDoc, increment, arrayUnion,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { PET_SPECIES, RARITY_LABEL, RARITY_COLOR } from "../data/petSpecies";
import { TYPE_ICON, TYPE_LABEL, diceLabel } from "../data/petMoves";
import {
  petStatsAtLevel, levelFromExp, expForLevel, petUnlockedMoves,
  petNextLockedMove, petEffectiveHp, petNextHealTickIn,
  resolveBattle, expFromBattle,
} from "../utils/pet";
import PetAvatar from "../components/PetAvatar";
import "./PetArena.css";

export default function PetArena({ embedded = false } = {}) {
  const { currentUser } = useAuth();
  const [me, setMe]               = useState(null);
  const [openMatches, setOpen]    = useState([]);
  const [activeMatches, setActive]= useState([]);
  const [resolved, setResolved]   = useState([]);
  const [pickerFor, setPickerFor] = useState(null); // "create" | matchId
  const [playingLog, setPlayingLog] = useState(null); // { battle, idx, doc }

  // FIX: track mounted state so deferred writes don't fire after unmount
  const mountedRef = useRef(true);
  const pendingTimersRef = useRef(new Set());
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingTimersRef.current.forEach(id => clearTimeout(id));
      pendingTimersRef.current.clear();
    };
  }, []);

  // Load my character (for pets + name)
  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(doc(db, "characters", currentUser.uid), s => {
      if (s.exists()) setMe({ uid: currentUser.uid, ...s.data() });
    });
  }, [currentUser]);

  // Stream all battles
  useEffect(() => {
    const q = query(collection(db, "pet_battles"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOpen(all.filter(b => b.status === "open"));
      setActive(all.filter(b => b.status === "active"));
      setResolved(all.filter(b => b.status === "resolved").slice(0, 10));
    });
  }, []);

  const myPets = useMemo(() => Array.isArray(me?.pets) ? me.pets : [], [me]);

  /* ── Create challenge ─────────────────────────────────────── */
  const createChallenge = async (pet) => {
    if (!currentUser || !me) return;
    try {
      await addDoc(collection(db, "pet_battles"), {
        status: "open",
        createdAt: serverTimestamp(),
        challenger: {
          uid: currentUser.uid,
          ownerName: me.name || "Sfidante",
          pet,
        },
      });
      setPickerFor(null);
    } catch (err) {
      console.error("create challenge failed", err);
      alert("Errore: " + err.message);
    }
  };

  /* ── Accept ───────────────────────────────────────────────── */
  // FIX: race-free flow. We compute everything client-side from the live
  // snapshot of `me` (kept fresh by the listener), then issue a small set
  // of independent updateDoc calls in sequence. No runTransaction, no
  // getDoc-then-updateDoc on docs that already have an active listener.
  const acceptChallenge = async (battle, pet) => {
    if (!currentUser || !me) return;
    if (battle.challenger.uid === currentUser.uid) {
      alert("Non puoi accettare la tua stessa sfida.");
      return;
    }

    setPickerFor(null);

    try {
      const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
      // Resolver starts each fighter at currentHp (clamped to max). Compute
      // effective HP first so passive regen since last tick is honored.
      const myPetForBattle  = { ...pet, currentHp: petEffectiveHp(pet) };
      const oppPetForBattle = { ...battle.challenger.pet, currentHp: petEffectiveHp(battle.challenger.pet) };
      const result = resolveBattle({
        a: { ownerName: battle.challenger.ownerName, pet: oppPetForBattle },
        b: { ownerName: me.name || "Sfidato", pet: myPetForBattle },
        seed,
      });

      const myUid    = currentUser.uid;
      const otherUid = battle.challenger.uid;
      const battleRef = doc(db, "pet_battles", battle.id);
      const meRef     = doc(db, "characters", myUid);
      const oppRef    = doc(db, "characters", otherUid);
      const restingUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      // ── 1. Build my updated pets array from the in-memory snapshot ──
      const myWon  = result.winner === "b";
      const myDrew = result.winner === "draw";
      const myPets = Array.isArray(me.pets) ? me.pets.slice() : [];
      const myIdx  = myPets.findIndex(p => p.id === pet.id);
      if (myIdx >= 0) {
        const updated = { ...myPets[myIdx] };
        updated.currentHp = Math.max(1, result.remaining.b || 1);
        updated.lastHealTick = new Date().toISOString();
        if (myWon) {
          updated.wins = (updated.wins || 0) + 1;
          const lvlBefore = updated.level || 1;
          updated.exp   = (updated.exp || 0) + expFromBattle(battle.challenger.pet.level || 1);
          updated.level = levelFromExp(updated.exp);
          // small reward: full HP on level-up
          if (updated.level > lvlBefore) {
            const stats = petStatsAtLevel(updated.speciesKey, updated.level);
            updated.currentHp = stats.hp;
          }
        } else if (!myDrew) {
          updated.losses = (updated.losses || 0) + 1;
        }
        updated.restingUntil = restingUntil;
        myPets[myIdx] = updated;
      }

      // ── 2. Resolve the battle doc ─────────────────────────────────
      await updateDoc(battleRef, {
        status: "resolved",
        challenged: { uid: myUid, ownerName: me.name || "Sfidato", pet },
        result: {
          winner: result.winner,
          winnerSide: result.winner,
          logs: result.logs,
          remaining: result.remaining,
          turns: result.turns,
          seed: result.seed,
          resolvedAt: new Date().toISOString(),
        },
      });

      // ── 3. Patch my character (single write, increment + arrayUnion) ──
      const myPatch = { pets: myPets };
      if (myWon) {
        myPatch.petPoints = increment(5);
        myPatch.petPointsLedger = arrayUnion({
          source: "pet_battle_win",
          label: "Vittoria al Pet Arena",
          amount: 5,
          ts: new Date().toISOString(),
          resourceKey: battle.id,
        });
      }
      await updateDoc(meRef, myPatch);

      // ── 4. Best-effort: opponent's character (deferred, isolated) ──
      // Cancellable: if the user navigates away, the timer is cleared in
      // the cleanup hook. The mountedRef check is a second guard.
      const tid = setTimeout(async () => {
        pendingTimersRef.current.delete(tid);
        if (!mountedRef.current) return;
        try {
          const oppSnap = await getDoc(oppRef);
          if (!oppSnap.exists()) return;
          const oppData = oppSnap.data();
          const oppPets = Array.isArray(oppData.pets) ? oppData.pets.slice() : [];
          const oppPetId = battle.challenger.pet.id;
          const oppIdx = oppPets.findIndex(p => p.id === oppPetId);
          if (oppIdx >= 0) {
            const won = result.winner === "a";
            const drew = result.winner === "draw";
            const updated = { ...oppPets[oppIdx] };
            updated.currentHp = Math.max(1, result.remaining.a || 1);
            updated.lastHealTick = new Date().toISOString();
            if (won) {
              updated.wins = (updated.wins || 0) + 1;
              const lvlBefore = updated.level || 1;
              updated.exp   = (updated.exp || 0) + expFromBattle(pet.level || 1);
              updated.level = levelFromExp(updated.exp);
              if (updated.level > lvlBefore) {
                const stats = petStatsAtLevel(updated.speciesKey, updated.level);
                updated.currentHp = stats.hp;
              }
            } else if (!drew) {
              updated.losses = (updated.losses || 0) + 1;
            }
            updated.restingUntil = restingUntil;
            oppPets[oppIdx] = updated;
          }
          const oppPatch = { pets: oppPets };
          if (result.winner === "a") {
            oppPatch.petPoints = increment(5);
            oppPatch.petPointsLedger = arrayUnion({
              source: "pet_battle_win",
              label: "Vittoria al Pet Arena",
              amount: 5,
              ts: new Date().toISOString(),
              resourceKey: battle.id,
            });
          }
          await updateDoc(oppRef, oppPatch);
        } catch (err) {
          console.warn("[opponent update skipped]", err);
        }
      }, 200);
      pendingTimersRef.current.add(tid);

      const enrichedBattle = {
        ...battle,
        challenged: { uid: myUid, ownerName: me.name || "Sfidato", pet },
      };
      setPlayingLog({ battle: enrichedBattle, result, mineSide: "b" });
    } catch (err) {
      console.error("accept failed:", err);
      alert("Errore: " + (err?.message || err));
    }
  };

  /* ── Cancel my open challenge ─────────────────────────────── */
  const cancelChallenge = async (battle) => {
    if (!currentUser) return;
    if (battle.challenger.uid !== currentUser.uid) return;
    if (!window.confirm("Annullare la tua sfida?")) return;
    try {
      await deleteDoc(doc(db, "pet_battles", battle.id));
    } catch (err) {
      console.error(err);
    }
  };

  /* ── UI helpers ───────────────────────────────────────────── */
  const isResting = (pet) => pet.restingUntil && new Date(pet.restingUntil) > new Date();
  const eligiblePets = myPets.filter(p => !isResting(p) && (p.currentHp ?? 0) > 0);

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
  return (
    <Wrapper {...wrapperProps}>
      {!embedded && (
        <header className="pa-head">
          <h1 className="pa-title">🐉 Pet Arena</h1>
          <p className="pa-sub">Sfide tra compagni — schiusi dalle uova del Bestiario, allevati nella tua scheda PG.</p>
          <div className="pa-quick-links">
            <Link to="/my-pg" className="pa-link-pill">📜 Vai al roster</Link>
            <Link to="/arena-bottega" className="pa-link-pill">🐣 Compra uova</Link>
          </div>
        </header>
      )}

      {/* My pets summary */}
      <div className="pa-panel">
        <h2 className="pa-panel-title">⚔ I tuoi compagni</h2>
        {myPets.length === 0 ? (
          <p className="pa-empty">Non hai ancora nessun compagno. Vai alla <Link to="/arena-bottega">Bottega Arena</Link> ▸ Bestiario.</p>
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
              const nextTickMs = petNextHealTickIn(pet);
              const tickMin = nextTickMs > 0 ? Math.max(1, Math.ceil(nextTickMs / 60000)) : 0;
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
                  onClick={() => setPickerFor("create")}>
            ⚔ Lancia una sfida
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
              const sp = PET_SPECIES[b.challenger.pet.speciesKey];
              const isMine = b.challenger.uid === currentUser.uid;
              return (
                <div key={b.id} className={`pa-challenge-row ${isMine ? "pa-challenge-row--mine" : ""}`}>
                  <PetAvatar
                    species={sp}
                    className="pa-ch-icon"
                    style={{ background: `radial-gradient(circle at 35% 30%, #fff, ${RARITY_COLOR[sp?.rarity]}33)` }}
                  />

                  <div className="pa-ch-info">
                    <div className="pa-ch-pet-name">{b.challenger.pet.nickname || sp?.name}</div>
                    <div className="pa-ch-meta">
                      <strong>{b.challenger.ownerName}</strong> · Lv {levelFromExp(b.challenger.pet.exp || 0)} · {sp ? TYPE_ICON[sp.type] : ""}
                    </div>
                  </div>
                  {isMine ? (
                    <button className="pa-btn pa-btn--ghost" onClick={() => cancelChallenge(b)}>✕ Annulla</button>
                  ) : (
                    <button
                      className="pa-btn pa-btn--accept"
                      disabled={eligiblePets.length === 0}
                      onClick={() => setPickerFor(b.id)}
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
        {resolved.length === 0 ? (
          <p className="pa-empty">Nessuno scontro risolto ancora.</p>
        ) : (
          <div className="pa-recent-list">
            {resolved.map(b => {
              const a = b.challenger?.pet;
              const z = b.challenged?.pet;
              const w = b.result?.winner;
              const aSp = PET_SPECIES[a?.speciesKey];
              const zSp = PET_SPECIES[z?.speciesKey];
              const winnerName = w === "a" ? (a?.nickname || aSp?.name)
                              : w === "b" ? (z?.nickname || zSp?.name)
                              : "Pareggio";
              return (
                <div key={b.id} className="pa-recent-row">
                  <div className="pa-recent-summary">
                    <span className={`pa-recent-side ${w === "a" ? "win" : w === "draw" ? "" : "loss"}`}>
                      {aSp?.icon} {a?.nickname || aSp?.name}
                    </span>
                    <span className="pa-recent-vs">vs</span>
                    <span className={`pa-recent-side ${w === "b" ? "win" : w === "draw" ? "" : "loss"}`}>
                      {zSp?.icon} {z?.nickname || zSp?.name}
                    </span>
                    <span className="pa-recent-winner">→ {winnerName}</span>
                  </div>
                  <button className="pa-btn pa-btn--ghost pa-btn--tiny"
                          onClick={() => setPlayingLog({ battle: b, result: b.result, mineSide: null })}>
                    Log
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pet picker modal */}
      {pickerFor && (
        <PetPickerModal
          pets={eligiblePets}
          onClose={() => setPickerFor(null)}
          onPick={(pet) => {
            if (pickerFor === "create") createChallenge(pet);
            else {
              const battle = openMatches.find(b => b.id === pickerFor);
              if (battle) acceptChallenge(battle, pet);
            }
          }}
          mode={pickerFor === "create" ? "create" : "accept"}
        />
      )}

      {/* Battle log modal */}
      {playingLog && (
        <BattleLogModal
          battle={playingLog.battle}
          result={playingLog.result}
          mineSide={playingLog.mineSide}
          onClose={() => setPlayingLog(null)}
        />
      )}
    </Wrapper>
  );
}

/* ============================================================
   PET PICKER MODAL
   ============================================================ */
function PetPickerModal({ pets, onClose, onPick, mode }) {
  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div className="pa-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="pa-modal-head">
          <h3>{mode === "create" ? "Scegli un compagno per la sfida" : "Scegli un compagno per accettare"}</h3>
          <button className="pa-modal-close" onClick={onClose}>✕</button>
        </header>
        <div className="pa-modal-body">
          {pets.length === 0 ? (
            <p className="pa-empty">Nessun compagno pronto al combattimento.</p>
          ) : (
            <div className="pa-picker-grid">
              {pets.map(pet => {
                const sp = PET_SPECIES[pet.speciesKey];
                const lvl = levelFromExp(pet.exp || 0);
                const stats = petStatsAtLevel(pet.speciesKey, lvl);
                const moves = petUnlockedMoves(pet);
                return (
                  <button key={pet.id} className={`pa-picker-card pa-picker-card--${sp?.type}`}
                          onClick={() => onPick(pet)}>
                    <PetAvatar species={sp} className="pa-picker-icon" />
                    <div className="pa-picker-name">{pet.nickname}</div>
                    <div className="pa-picker-meta">Lv {lvl} · {TYPE_ICON[sp?.type]}</div>
                    <div className="pa-picker-stats">
                      ❤️ {petEffectiveHp(pet)}/{stats.hp} · 🛡 CA {stats.ac} · 🎯 +{stats.atkBonus} · ⚡ {stats.spd}
                    </div>
                    <div className="pa-picker-moves">
                      {moves.map(m => (
                        <span
                          key={m.id}
                          className={`pa-picker-move pa-picker-move--${m.category}`}
                          title={`${m.name} · ${m.desc}${m.damageDice ? ` · ${diceLabel(m.damageDice)}` : ""}${m.toHit ? ` · ${m.toHit > 0 ? "+" : ""}${m.toHit} colpo` : ""}`}
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
      </div>
    </div>
  );
}

/* ============================================================
   BATTLE LOG MODAL — animated reveal
   ============================================================ */
function BattleLogModal({ battle, result, mineSide, onClose }) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!result?.logs) return;
    let i = 0;
    setRevealed(0);
    const tick = () => {
      i++;
      setRevealed(i);
      if (i < result.logs.length) {
        setTimeout(tick, 700);
      }
    };
    setTimeout(tick, 300);
  }, [result?.logs]);

  if (!result) return null;

  const a = battle.challenger?.pet;
  const z = battle.challenged?.pet;
  const aSp = PET_SPECIES[a?.speciesKey];
  const zSp = PET_SPECIES[z?.speciesKey];
  const w = result.winner;

  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div className="pa-modal-dialog pa-battle-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pa-modal-head pa-battle-head">
          <PetAvatar species={aSp} className="pa-battle-avatar" />
          <h3>
            {a?.nickname} <span className="pa-vs-tag">vs</span> {z?.nickname || "?"}
          </h3>
          <PetAvatar species={zSp} className="pa-battle-avatar" />
          <button className="pa-modal-close" onClick={onClose}>✕</button>
        </header>
        <div className="pa-modal-body">
          <div className="pa-battle-log">
            {(result.logs || []).slice(0, revealed).map((line, i) => (
              <div key={i} className="pa-battle-line">{line}</div>
            ))}
          </div>
          {revealed >= (result.logs?.length ?? 0) && (
            <div className={`pa-battle-result pa-battle-result--${w}`}>
              {w === "draw" ? "⚖ Pareggio" :
               w === "a"   ? `🏆 Vince ${a?.nickname || aSp?.name}` :
                             `🏆 Vince ${z?.nickname || zSp?.name}`}
              {mineSide && (
                <div className="pa-battle-result-mine">
                  {w === mineSide ? "🌟 Hai vinto! +5 punti Bestiario, +EXP al tuo compagno."
                                  : w === "draw" ? "Pareggio."
                                  : "Sconfitta. Il tuo compagno ha bisogno di riposo (30 min)."}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
