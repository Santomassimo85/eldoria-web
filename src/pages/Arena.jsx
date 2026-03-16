import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc, setDoc, arrayUnion } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./Arena.css";

// --- 1. DATABASE STATICO CAMPIONI ---
const FAKE_DATABASE = [
  { 
    id: "test_1", 
    name: "Dante Ivio", 
    stats: { hp: 100, maxHp: 100, ac: 18, dex: 2 }, 
    weapons: [
      { name: "Spada Vorpal", bonus: "+9", damage: 15 },
      { name: "Arco Composito", bonus: "+7", damage: 10 }
    ],
    spells: [
      { name: "Palla di Fuoco", bonus: "+8", damage: 28 },
      { name: "Fulmine", bonus: "+8", damage: 22 },
      { name: "Dardo Incantato", bonus: "+10", damage: 12 }
    ]
  },
  { 
    id: "test_2", 
    name: "Eldra la Silente", 
    stats: { hp: 80, maxHp: 80, ac: 16, dex: 4 }, 
    weapons: [
      { name: "Daga Avvelenata", bonus: "+8", damage: 12 },
      { name: "Balestra", bonus: "+8", damage: 14 }
    ],
    spells: [
      { name: "Colpo d'Ombra", bonus: "+9", damage: 18 }
    ]
  },
  { 
    id: "test_3", 
    name: "Thoki il Barbaro", 
    stats: { hp: 130, maxHp: 130, ac: 15, dex: 1 }, 
    weapons: [
      { name: "Ascia Bipenne", bonus: "+8", damage: 22 },
      { name: "Maglio", bonus: "+7", damage: 25 }
    ],
    spells: [{ name: "Ira Furiosa", bonus: "+0", damage: 5 }]
  },
  { 
    id: "test_4", 
    name: "Zorkan il Mago", 
    stats: { hp: 65, maxHp: 65, ac: 13, dex: 2 }, 
    weapons: [{ name: "Bastone", bonus: "+4", damage: 6 }],
    spells: [
      { name: "Disintegrazione", bonus: "+9", damage: 45 },
      { name: "Cono di Freddo", bonus: "+8", damage: 25 },
      { name: "Muro di Fuoco", bonus: "+8", damage: 20 }
    ]
  },
  { 
    id: "test_5", 
    name: "Sif l'Agile", 
    stats: { hp: 85, maxHp: 85, ac: 17, dex: 5 }, 
    weapons: [{ name: "Stocco", bonus: "+10", damage: 14 }],
    spells: [{ name: "Charme", bonus: "+7", damage: 0 }]
  },
  { 
    id: "test_6", 
    name: "Malakar", 
    stats: { hp: 95, maxHp: 95, ac: 16, dex: 2 }, 
    weapons: [{ name: "Lama Oscura", bonus: "+8", damage: 16 }],
    spells: [{ name: "Risucchio", bonus: "+8", damage: 14 }]
  },
  { 
    id: "test_7", 
    name: "Peppe l'Agile", 
    stats: { hp: 90, maxHp: 90, ac: 17, dex: 5 }, 
    weapons: [{ name: "Stocco", bonus: "+10", damage: 14 }],
    spells: [{ name: "Luce", bonus: "+0", damage: 0 }]
  },
  { 
    id: "test_8", 
    name: "Gianluigi l'Agile", 
    stats: { hp: 90, maxHp: 90, ac: 17, dex: 5 }, 
    weapons: [{ name: "Frusta", bonus: "+9", damage: 8 }],
    spells: [{ name: "Charme", bonus: "+7", damage: 0 }]
  }
];

export default function Arena() {
  const { currentUser } = useAuth();
  const [arenaMeta, setArenaMeta] = useState(null);
  const [selectedForTest, setSelectedForTest] = useState([]);
  const isMaster = currentUser?.email === "santomassimo85@gmail.com";

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "arena_meta", "global"), (snap) => {
      if (snap.exists()) setArenaMeta(snap.data());
      else setDoc(doc(db, "arena_meta", "global"), { phase: "idle", matches: [], currentRound: 1, tournamentHistory: [] });
    });
    return () => unsub();
  }, []);

  // --- LOGICA DI AVANZAMENTO AUTOMATICO ---
  useEffect(() => {
    if (!isMaster || !arenaMeta || arenaMeta.phase !== "combat" || !arenaMeta.matches.length) return;

    const allFinished = arenaMeta.matches.every(m => m.status === "finished");
    
    if (allFinished && arenaMeta.matches.length > 0) {
      const winners = arenaMeta.matches.map(m => m.winner);
      
      // Se c'è solo un vincitore rimasto in tutto il torneo, è il Campione finale
      if (winners.length === 1 && arenaMeta.matches.length === 1) {
          console.log("Torneo Terminato! Campione:", winners[0]);
          return;
      }

      // Se tutti i match del round sono finiti, dopo 3 secondi genera il prossimo round
      const timer = setTimeout(() => {
        promoteWinners(winners);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [arenaMeta?.matches]);

  const generateMatches = (competitors, round) => {
    const matches = [];
    let i = 0;
    while (i < competitors.length) {
      const remaining = competitors.length - i;
      let matchPlayersIds = [];
      
      if (remaining === 3) {
        matchPlayersIds = [competitors[i], competitors[i+1], competitors[i+2]];
        i += 3;
      } else {
        matchPlayersIds = [competitors[i], competitors[i+1]];
        i += 2;
      }

      const pData = matchPlayersIds.map(id => {
        const p = FAKE_DATABASE.find(f => f.id === id);
        return { id: p.id, hp: p.stats.hp, init: 0, name: p.name };
      });

      matches.push({
        matchId: `R${round}_M${matches.length}`,
        players: pData,
        status: "initiative",
        turn: null,
        logs: [`Match Round ${round} pronto!`],
        winner: null
      });
    }
    return matches;
  };

  const startTournament = async () => {
    if (selectedForTest.length < 2) return alert("Seleziona almeno 2 guerrieri!");
    const shuffled = [...selectedForTest].sort(() => Math.random() - 0.5);
    const matches = generateMatches(shuffled, 1);

    await updateDoc(doc(db, "arena_meta", "global"), {
      participants: selectedForTest,
      matches,
      phase: "combat",
      currentRound: 1,
      tournamentHistory: []
    });
  };

  const promoteWinners = async (winners) => {
    const nextRound = arenaMeta.currentRound + 1;
    const newMatches = generateMatches(winners, nextRound);

    await updateDoc(doc(db, "arena_meta", "global"), {
      matches: newMatches,
      currentRound: nextRound,
      tournamentHistory: arrayUnion(...arenaMeta.matches)
    });
  };

  const rollInit = async (matchId, playerId) => {
    const player = FAKE_DATABASE.find(f => f.id === playerId);
    const roll = Math.floor(Math.random() * 20) + 1 + player.stats.dex;
    
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId === matchId) {
        const updatedPlayers = m.players.map(p => p.id === playerId ? { ...p, init: roll } : p);
        const allRolled = updatedPlayers.every(p => p.init > 0);
        return {
          ...m,
          players: updatedPlayers,
          status: allRolled ? "active" : "initiative",
          turn: allRolled ? [...updatedPlayers].sort((a, b) => b.init - a.init)[0].id : null,
          logs: [...m.logs, `🎲 ${player.name}: Iniziativa ${roll}`]
        };
      }
      return m;
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const handleAttack = async (matchId, attackerId, targetId, action) => {
    const match = arenaMeta.matches.find(m => m.matchId === matchId);
    const attacker = FAKE_DATABASE.find(f => f.id === attackerId);
    const defender = FAKE_DATABASE.find(f => f.id === targetId);

    const d20 = Math.floor(Math.random() * 20) + 1;
    const hitTotal = d20 + parseInt(action.bonus);
    let damage = hitTotal >= defender.stats.ac ? action.damage : 0;
    
    const log = damage > 0 
      ? `💥 ${attacker.name} COLPISCE ${defender.name}! (${hitTotal} vs CA ${defender.stats.ac}) -> ${damage} HP`
      : `🛡️ ${attacker.name} MANCA ${defender.name}! (${hitTotal} vs CA ${defender.stats.ac})`;

    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId === matchId) {
        const updatedPlayers = m.players.map(p => p.id === targetId ? { ...p, hp: Math.max(0, p.hp - damage) } : p);
        const alive = updatedPlayers.filter(p => p.hp > 0);
        
        if (alive.length === 1) {
          return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id, logs: [...m.logs, log, `🏆 ${alive[0].name.toUpperCase()} VINCE!`] };
        } else {
          const currentIndex = m.players.findIndex(p => p.id === attackerId);
          let nextIndex = (currentIndex + 1) % m.players.length;
          while (updatedPlayers[nextIndex].hp <= 0) { nextIndex = (nextIndex + 1) % m.players.length; }
          return { ...m, players: updatedPlayers, turn: updatedPlayers[nextIndex].id, logs: [...m.logs, log] };
        }
      }
      return m;
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const resetArena = async () => {
    await updateDoc(doc(db, "arena_meta", "global"), { phase: "idle", matches: [], currentRound: 1, tournamentHistory: [] });
    setSelectedForTest([]);
  };

  if (!arenaMeta) return <div className="loading">Caricamento Arena...</div>;

  return (
    <div className="arena-theme-page">
      <h1 className="arena-main-title">ARENA DEI CAMPIONI</h1>

      {/* --- TABELLONE GRAFICO (BRACKET) --- */}
      <div className="bracket-container">
        <h3 className="bracket-title">TABELLONE TORNEO</h3>
        <div className="bracket-flow">
          <div className="bracket-round">
            <span className="round-label">ROUND {arenaMeta.currentRound}</span>
            <div className="match-summaries">
              {arenaMeta.matches?.map(m => (
                <div key={m.matchId} className={`mini-match ${m.status === 'finished' ? 'done' : 'ongoing'}`}>
                  {m.players.map(p => p.name.split(' ')[0]).join(' vs ')}
                  {m.winner && <div className="mini-winner">🏆 {FAKE_DATABASE.find(f => f.id === m.winner)?.name.split(' ')[0]}</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="bracket-connector">➔</div>
          <div className="bracket-round">
            <span className="round-label">PROSSIMO ROUND</span>
            <div className="mini-match future">DA DEFINIRE</div>
          </div>
        </div>
      </div>

      {arenaMeta.phase === "idle" && (
        <div className="setup-area">
          <h2 className="gold-text">Seleziona Partecipanti</h2>
          <div className="selection-grid">
            {FAKE_DATABASE.map(p => (
              <button 
                key={p.id} 
                className={`p-card-btn ${selectedForTest.includes(p.id) ? "selected" : ""}`} 
                onClick={() => setSelectedForTest(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id])}
              >
                {p.name} <br/> 🛡️ CA: {p.stats.ac}
              </button>
            ))}
          </div>
          <button className="gold-action-btn" onClick={startTournament}>INIZIA TORNEO</button>
        </div>
      )}

      {arenaMeta.phase === "combat" && (
        <div className="active-matches">
          {arenaMeta.matches.map(m => (
            <div key={m.matchId} className={`arena-match-card ${m.status === "finished" ? "match-over" : ""}`}>
              <div className="match-id-badge">{m.status === "finished" ? "MATCH TERMINATO" : `MATCH ID: ${m.matchId}`}</div>
              <div className="fighters-row">
                {m.players.map(p => {
                  const pData = FAKE_DATABASE.find(f => f.id === p.id);
                  const isTurn = m.turn === p.id;
                  const isDead = p.hp <= 0;

                  return (
                    <div key={p.id} className={`fighter-stat-box ${isTurn ? "active-turn" : ""} ${isDead ? "defeated" : ""}`}>
                      <span className="f-name">{p.name}</span>
                      <div className="f-hp-bar">
                        <div className="f-hp-fill" style={{ width: `${(p.hp / pData.stats.maxHp) * 100}%` }}></div>
                        <span className="f-hp-text">{p.hp} / {pData.stats.maxHp} HP</span>
                      </div>
                      <div className="f-ca">🛡️ CA: {pData.stats.ac} | 🎲 INIZ: {p.init || "?"}</div>
                      
                      {isTurn && m.status === "active" && !isDead && (
                        <div className="arsenal-grid">
                          <p className="target-title">Bersaglio:</p>
                          {m.players.filter(t => t.id !== p.id && t.hp > 0).map(t => (
                            <div key={t.id} className="target-block">
                              <span className="target-name">⚔️ vs {t.name.split(' ')[0]}</span>
                              <div className="atk-row">
                                {pData.weapons.map(w => (
                                  <button key={w.name} className="btn-atk weapon" onClick={() => handleAttack(m.matchId, p.id, t.id, w)}>
                                    {w.name} ({w.bonus})
                                  </button>
                                ))}
                                {pData.spells.map(s => (
                                  <button key={s.name} className="btn-atk spell" onClick={() => handleAttack(m.matchId, p.id, t.id, s)}>
                                    {s.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {m.status === "initiative" && !isDead && (
                        <button className="init-btn-roll" onClick={() => rollInit(m.matchId, p.id)} disabled={p.init > 0}>
                          {p.init > 0 ? "Pronto" : "Tira Iniziativa"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="arena-chat-log">
                {m.logs.slice(-3).map((l, idx) => <p key={idx} className="log-line">{l}</p>)}
              </div>
            </div>
          ))}
          {isMaster && <button className="reset-btn" onClick={resetArena}>CHIUDI ARENA / RESET</button>}
        </div>
      )}
    </div>
  );
}