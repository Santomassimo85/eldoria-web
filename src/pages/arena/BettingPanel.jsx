// Pannello delle scommesse.
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.
import { currentWeekKey, weekEndLabel } from "../../data/arenaWeek";
import { db } from "../../firebase";
import { collection, doc, increment, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { isAwaitingReady } from "./arenaCore";

// ── BETTING PANEL ─────────────────────────────────────────────────────────────
// Puntate in Monete Arena tarate sulla Bottega di adesso (2026-10-22: prima erano
// 1 MA a fight e 1–3 sul torneo, briciole rispetto ai 60 MA della settimana e ai
// prezzi del catalogo). Le vincite si spendono subito alla Bottega; domenica alle
// 23:00 arenaWeeklyReset rimette tutti a 60 MA e annulla le scommesse aperte.
export const BET_MATCH_AMOUNTS = [5, 10, 20];
export const BET_MATCH_MULT = 2;          // fight vinto = puntata ×2
export const BET_TOURNAMENT_AMOUNTS = [5, 10, 20, 30];
export const BET_TOURNAMENT_MULT = 3;     // vincitore del torneo = puntata ×3 (più difficile da azzeccare)
// Si scommette solo su un fight NON ancora iniziato: in attesa di «Iniziamo», oppure
// (match di prima del ready check) in fase iniziativa senza che nessuno abbia tirato.
export const betOpenOn = (m) => !!m && m.kind !== "fun" && m.status === "initiative" && !m.winner
  && (isAwaitingReady(m) || (!m.readyCheck && !m.readyAt && !(m.players || []).some(p => p.init)));
export function BettingPanel({ arenaMeta, snapshots, currentUser, isMaster }) {
  const [userBets, setUserBets] = useState([]);
  const [charCoins, setCharCoins] = useState(0);
  // localBets: matchId -> bet obj — updated synchronously on click, before Firestore confirms
  const [localBets, setLocalBets] = useState({});
  const placedRef = useRef(new Set()); // synchronous guard against double-clicks

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "arena_bets"),
      where("uid", "==", currentUser.uid),
      where("status", "==", "pending"));
    return onSnapshot(q, snap => setUserBets(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(doc(db, "characters", currentUser.uid), snap => {
      if (snap.exists()) setCharCoins(snap.data().arenaCoins ?? 0);
    });
  }, [currentUser]);

  // merge Firestore bets with optimistic local bets
  const existingBet = (matchId) =>
    userBets.find(b => b.matchId === matchId) || localBets[matchId] || null;

  const placeBet = async (type, matchId, targetUid, targetName, amount) => {
    if (placedRef.current.has(matchId)) return; // synchronous block
    if (existingBet(matchId)) return;
    if (charCoins < amount) return alert("Monete Arena insufficienti.");

    // Block immediately — before any await
    placedRef.current.add(matchId);
    const multiplier = type === "tournament" ? BET_TOURNAMENT_MULT : BET_MATCH_MULT;
    // Optimistic local display
    setLocalBets(prev => ({ ...prev, [matchId]: { targetUid, targetName, amount, multiplier } }));

    try {
      // Le monete si tolgono in transazione: con due schede aperte (o un acquisto in
      // Bottega nello stesso istante) non si punta oro che non c'è più.
      const betRef = doc(collection(db, "arena_bets"));
      await runTransaction(db, async (tx) => {
        const charRef = doc(db, "characters", currentUser.uid);
        // il fight (o il Round 1 per il torneo) va ricontrollato sul server: può essere
        // partito mentre il pannello era aperto
        const meta = (await tx.get(doc(db, "arena_meta", "global"))).data() || {};
        if (type === "match" && !betOpenOn((meta.matches || []).find(x => x.matchId === matchId))) throw new Error("started");
        if (type === "tournament" && (meta.phase !== "combat" || (meta.currentRound || 1) > 1)) throw new Error("started");
        const cur = await tx.get(charRef);
        const coins = cur.exists() ? (cur.data().arenaCoins ?? 0) : 0;
        if (coins < amount) throw new Error("coins");
        tx.update(charRef, { arenaCoins: increment(-amount) });
        tx.set(betRef, {
          uid: currentUser.uid,
          type, matchId, targetUid, targetName, amount, multiplier,
          weekKey: currentWeekKey(),
          status: "pending",
          createdAt: serverTimestamp(),
        });
      });
    } catch (e) {
      // rollback on error
      placedRef.current.delete(matchId);
      setLocalBets(prev => { const n = { ...prev }; delete n[matchId]; return n; });
      if (e?.message === "coins") alert("Monete Arena insufficienti.");
      else if (e?.message === "started") alert("Troppo tardi: il fight è già iniziato, le scommesse sono chiuse.");
    }
  };
  const myUid = currentUser?.uid;
  // Chi combatte può puntare solo su sé stesso, mai sull'avversario (niente fight venduti).
  const canBetOn = (fighterIds, targetUid) => !fighterIds.includes(myUid) || targetUid === myUid;

  const getRecentForm = (uid) => {
    const history = (arenaMeta.matchHistory || []).filter(e => e.uid === uid);
    return history.slice(-3).map(e => e.result);
  };

  // Solo match torneo: scommesse non disponibili sull'Arena Libera.
  const activeMatches = (arenaMeta.matches || []).filter(m => m.kind !== "fun" && m.status !== "finished" && !m.winner);
  const allFighters = arenaMeta.participants || [];
  const eliminatedUids = new Set(
    (arenaMeta.matches || [])
      .filter(m => m.kind !== "fun" && m.status === "finished" && m.winner)
      .flatMap(m => m.players.filter(p => p.id !== m.winner).map(p => p.id))
  );
  const bettableFighters = allFighters.filter(uid => !eliminatedUids.has(uid));

  return (
    <div className="betting-panel">
      <div className="betting-header">
        <span className="betting-title">🎲 Scommesse Arena</span>
        <span className="betting-balance">🪙 {charCoins} MA disponibili</span>
      </div>
      <p className="betting-section-label">
        Le vincite sono Monete Arena da spendere subito alla Bottega. Tutto si azzera {weekEndLabel()}: le scommesse ancora aperte si annullano e le monete tornano a 60.
      </p>

      {activeMatches.length === 0 && (arenaMeta.phase !== "combat" || bettableFighters.length <= 1) && (
        <div className="bet-closed-notice">
          {arenaMeta.phase === "combat"
            ? "Nessun fight su cui puntare adesso: torna quando parte il prossimo round."
            : "Le scommesse si aprono quando il Master dà inizio al torneo."}
        </div>
      )}

      {/* Match bets */}
      {activeMatches.length > 0 && (
        <div className="betting-section">
          <p className="betting-section-label">Fight del round — si punta solo prima che inizino — vittoria ×{BET_MATCH_MULT} (puntata {BET_MATCH_AMOUNTS.join(" / ")} MA)</p>
          {activeMatches.map(m => {
            const bet = existingBet(m.matchId);
            const bettingOpen = betOpenOn(m);
            return (
              <div key={m.matchId} className="bet-match-card">
                {!bettingOpen && !bet && (
                  <div className="bet-closed-notice">⚠ Scommesse chiuse — il fight è già iniziato</div>
                )}
                <div className="bet-fighters">
                  {m.players.map(p => {
                    const snap = snapshots[p.id] || {};
                    const isBetTarget = bet?.targetUid === p.id;
                    const form = getRecentForm(p.id);
                    return (
                      <div key={p.id} className={`bet-fighter ${isBetTarget ? "bet-fighter--chosen" : ""}`}>
                        {snap.image && <img src={snap.image} alt="" className="bet-fighter-avatar" />}
                        <span className="bet-fighter-name">{p.name}</span>
                        {form.length > 0 && (
                          <div className="bet-form-row">
                            {form.map((r, i) => (
                              <span key={i} className={`bet-form-badge ${r === "W" ? "form-win" : r === "L" ? "form-loss" : "form-draw"}`}>{r}</span>
                            ))}
                          </div>
                        )}
                        {!bet && bettingOpen && canBetOn(m.players.map(x => x.id), p.id) && (
                          <div className="bet-amounts">
                            {BET_MATCH_AMOUNTS.map(amt => (
                              <button
                                key={amt}
                                className="bet-amount-btn"
                                disabled={charCoins < amt || placedRef.current.has(m.matchId)}
                                onClick={() => placeBet("match", m.matchId, p.id, p.name, amt)}
                              >
                                {amt}MA
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {bet && (
                  <div className="bet-placed">
                    ✓ Hai scommesso <strong>{bet.amount} MA</strong> su <strong>{bet.targetName}</strong> — possibile vincita: <strong>{bet.amount * bet.multiplier} MA</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tournament bet */}
      {arenaMeta.phase === "combat" && bettableFighters.length > 1 && (() => {
        const tBet = existingBet("tournament");
        return (
          <div className="betting-section">
            <p className="betting-section-label">🏆 Vincitore del torneo — vittoria ×{BET_TOURNAMENT_MULT} (puntata {BET_TOURNAMENT_AMOUNTS.join(" / ")} MA)</p>
            {tBet ? (
              <div className="bet-placed">
                ✓ Hai scommesso <strong>{tBet.amount} MA</strong> su <strong>{tBet.targetName}</strong> — possibile vincita: <strong>{tBet.amount * (tBet.multiplier || 2)} MA</strong>
              </div>
            ) : (arenaMeta.currentRound || 1) > 1 ? (
              <div className="bet-closed-notice">⚠ Scommesse sul vincitore chiuse — disponibili solo al Round 1</div>
            ) : (
              <div className="bet-tournament-grid">
                {bettableFighters.map(uid => {
                  const snap = snapshots[uid] || {};
                  const form = getRecentForm(uid);
                  return (
                    <div key={uid} className="bet-tournament-fighter">
                      {snap.image && <img src={snap.image} alt="" className="bet-fighter-avatar" />}
                      <span className="bet-fighter-name">{snap.name || uid}</span>
                      {form.length > 0 && (
                        <div className="bet-form-row">
                          {form.map((r, i) => (
                            <span key={i} className={`bet-form-badge ${r === "W" ? "form-win" : r === "L" ? "form-loss" : "form-draw"}`}>{r}</span>
                          ))}
                        </div>
                      )}
                      {canBetOn(allFighters, uid) && <div className="bet-amounts">
                        {BET_TOURNAMENT_AMOUNTS.map(amt => (
                          <button
                            key={amt}
                            className="bet-amount-btn"
                            disabled={charCoins < amt || placedRef.current.has("tournament")}
                            onClick={() => placeBet("tournament", "tournament", uid, snap.name || uid, amt)}
                          >
                            {amt}MA
                          </button>
                        ))}
                      </div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
