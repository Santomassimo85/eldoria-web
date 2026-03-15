import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc, setDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./Arena.css";

const FAKE_DATABASE = [
  { id: "test_1", name: "Grom il Terribile", stats: { hp: 100, maxHp: 100, ac: 18, dex: 1 }, actions: [{name: "Ascia Bipenne", bonus: "+7", damage: 12}] },
  { id: "test_2", name: "Eldra la Silente", stats: { hp: 70, maxHp: 70, ac: 15, dex: 4 }, actions: [{name: "Arco Lungo", bonus: "+8", damage: 10}] },
  { id: "test_3", name: "Zorkan il Mago", stats: { hp: 60, maxHp: 60, ac: 12, dex: 2 }, actions: [{name: "Dardo Incantato", bonus: "+6", damage: 15}] },
  { id: "test_4", name: "Borin il Nano", stats: { hp: 120, maxHp: 120, ac: 20, dex: -1 }, actions: [{name: "Martello", bonus: "+6", damage: 8}] },
  { id: "test_5", name: "Sif l'Agile", stats: { hp: 80, maxHp: 80, ac: 17, dex: 5 }, actions: [{name: "Daga", bonus: "+9", damage: 7}] },
  { id: "test_6", name: "Malakar l'Oscuro", stats: { hp: 90, maxHp: 90, ac: 16, dex: 2 }, actions: [{name: "Tocco Gelido", bonus: "+7", damage: 11}] },
];

export default function Arena() {
  const { currentUser } = useAuth();
  const [arenaMeta, setArenaMeta] = useState(null);
  const [selectedForTest, setSelectedForTest] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "arena_meta", "global"), (snap) => {
      if (snap.exists()) setArenaMeta(snap.data());
    });
    return () => unsub();
  }, []);

  const startTournament = async () => {
    if (selectedForTest.length < 2) return alert("Seleziona almeno 2 guerrieri!");
    
    const shuffled = [...selectedForTest].sort(() => Math.random() - 0.5);
    const matches = [];
    
    // Generazione accoppiamenti 1v1
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i+1]) {
        const p1 = FAKE_DATABASE.find(f => f.id === shuffled[i]);
        const p2 = FAKE_DATABASE.find(f => f.id === shuffled[i+1]);
        matches.push({
          matchId: `R1_M${i}`,
          round: "Ottavi/Quarti",
          p1: p1.id, p2: p2.id,
          p1Hp: p1.stats.hp, p2Hp: p2.stats.hp,
          p1Init: 0, p2Init: 0,
          turn: null,
          status: "initiative", // initiative, active, finished
          winner: null,
          logs: ["Inizia il torneo!"]
        });
      }
    }

    await updateDoc(doc(db, "arena_meta", "global"), {
      participants: selectedForTest,
      matches: matches,
      phase: "combat"
    });
  };

  const handleAttack = async (matchId, attackerId, action) => {
    const match = arenaMeta.matches.find(m => m.matchId === matchId);
    if (match.status === "finished") return;

    const isP1 = match.p1 === attackerId;
    const defenderId = isP1 ? match.p2 : match.p1;
    const attacker = FAKE_DATABASE.find(f => f.id === attackerId);
    const defender = FAKE_DATABASE.find(f => f.id === defenderId);

    const d20 = Math.floor(Math.random() * 20) + 1;
    const hitTotal = d20 + parseInt(action.bonus);
    let log = "";
    let damage = 0;

    if (hitTotal >= defender.stats.ac) {
      damage = action.damage;
      log = `🎯 ${attacker.name} COLPISCE! (${hitTotal} vs CA ${defender.stats.ac}) -> ${damage} danni.`;
    } else {
      log = `🛡️ ${attacker.name} MANCA! (${hitTotal} vs CA ${defender.stats.ac})`;
    }

    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId === matchId) {
        if (isP1) m.p2Hp = Math.max(0, m.p2Hp - damage);
        else m.p1Hp = Math.max(0, m.p1Hp - damage);
        
        // Controllo Morte / Fine Match
        if (m.p1Hp <= 0 || m.p2Hp <= 0) {
          m.status = "finished";
          m.winner = m.p1Hp <= 0 ? m.p2 : m.p1;
          const winnerName = FAKE_DATABASE.find(f => f.id === m.winner).name;
          m.logs.push(`🏆 ${winnerName.toUpperCase()} VINCE IL DUELLO!`);
        } else {
          m.turn = defenderId;
          m.logs.push(log);
        }
      }
      return m;
    });

    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const rollInit = async (matchId, playerId) => {
    const player = FAKE_DATABASE.find(f => f.id === playerId);
    const roll = Math.floor(Math.random() * 20) + 1 + player.stats.dex;
    
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId === matchId) {
        if (m.p1 === playerId) m.p1Init = roll;
        else m.p2Init = roll;
        if (m.p1Init > 0 && m.p2Init > 0) {
          m.status = "active";
          m.turn = m.p1Init >= m.p2Init ? m.p1 : m.p2;
        }
      }
      return m;
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  if (!arenaMeta) return null;

  return (
    <div className="arena-container">
      <h1 className="gold-text">TORNEO AD ELIMINAZIONE</h1>

      {arenaMeta.phase === "idle" && (
        <div className="setup-box">
          <div className="test-grid">
            {FAKE_DATABASE.map(p => (
              <div key={p.id} className={`test-card ${selectedForTest.includes(p.id) ? "active" : ""}`} onClick={() => setSelectedForTest(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id])}>
                {p.name}
              </div>
            ))}
          </div>
          <button className="wb-btn-action" onClick={startTournament}>⚔️ AVVIA TORNEO</button>
        </div>
      )}

      {arenaMeta.phase === "combat" && (
        <div className="tournament-bracket">
          {arenaMeta.matches.map(m => {
            const p1 = FAKE_DATABASE.find(f => f.id === m.p1);
            const p2 = FAKE_DATABASE.find(f => f.id === m.p2);
            const isFinished = m.status === "finished";

            return (
              <div key={m.matchId} className={`match-card ${isFinished ? "finished" : ""}`}>
                <div className="match-header">{m.round}</div>
                
                <div className="duel-row">
                  {/* Player 1 */}
                  <div className={`fighter ${m.turn === p1.id ? "active-turn" : ""}`}>
                    <div className="hp-mini-bar"><div style={{width: `${(m.p1Hp/p1.stats.hp)*100}%`}}></div></div>
                    <span>{p1.name} ({m.p1Hp} HP)</span>
                    {!isFinished && (m.status === "initiative" ? <button onClick={() => rollInit(m.matchId, p1.id)} disabled={m.p1Init > 0}>Init</button> : m.turn === p1.id && <button onClick={() => handleAttack(m.matchId, p1.id, p1.actions[0])}>Attacca</button>)}
                  </div>

                  <div className="vs-badge">VS</div>

                  {/* Player 2 */}
                  <div className={`fighter ${m.turn === p2.id ? "active-turn" : ""}`}>
                    <div className="hp-mini-bar"><div style={{width: `${(m.p2Hp/p2.stats.hp)*100}%`}}></div></div>
                    <span>{p2.name} ({m.p2Hp} HP)</span>
                    {!isFinished && (m.status === "initiative" ? <button onClick={() => rollInit(m.matchId, p2.id)} disabled={m.p2Init > 0}>Init</button> : m.turn === p2.id && <button onClick={() => handleAttack(m.matchId, p2.id, p2.actions[0])}>Attacca</button>)}
                  </div>
                </div>

                {isFinished && <div className="winner-announcement">VINCITORE: {FAKE_DATABASE.find(f => f.id === m.winner).name}</div>}
                <div className="log-box">{m.logs.slice(-2).map((l, i) => <p key={i}>{l}</p>)}</div>
              </div>
            );
          })}
          <button onClick={() => updateDoc(doc(db, "arena_meta", "global"), {phase: "idle"})}>RESET</button>
        </div>
      )}
    </div>
  );
}