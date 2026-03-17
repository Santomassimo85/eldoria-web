import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./Arena.css";

// --- 1. DATABASE PERSONAGGI LEGATI A UID REALI ---
// Sostituisci "UID_UTENTE_X" con gli ID che trovi nella dashboard di Firebase Authentication
const CHARACTERS_DB = {
  "2TLy9pRAdIUMKW7CZMB00UUA0ZE3": { 
    name: "Dante Ivio", 
    stats: { hp: 100, maxHp: 100, ac: 18, dex: 2 }, 
    weapons: [{ name: "Spada Vorpal", bonus: "+9", damage: 15 }],
    spells: [{ name: "Palla di Fuoco", bonus: "+8", damage: 28 }]
  },
  "XabKC5DlEAPtEnqLU7BVGL8S9Jo1": { 
    name: "Peppe l'Agile", 
    stats: { hp: 90, maxHp: 90, ac: 17, dex: 5 }, 
    weapons: [{ name: "Stocco", bonus: "+10", damage: 14 }],
    spells: [{ name: "Luce", bonus: "+0", damage: 0 }]
  },
  // Aggiungi qui gli altri...
};

export default function Arena() {
  const { currentUser } = useAuth();
  const [arenaMeta, setArenaMeta] = useState(null);
  const isMaster = currentUser?.email === "santomassimo85@gmail.com";

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "arena_meta", "global"), (snap) => {
      if (snap.exists()) setArenaMeta(snap.data());
      else setDoc(doc(db, "arena_meta", "global"), { 
        phase: "registration", 
        waitingList: [], 
        participants: [], 
        matches: [], 
        currentRound: 1 
      });
    });
    return () => unsub();
  }, []);

  // --- LOGICA PLAYER: ISCRIZIONE ---
  const handleJoinRequest = async () => {
    if (!CHARACTERS_DB[currentUser.uid]) return alert("Non hai un personaggio assegnato per l'Arena. Contatta il Master!");
    await updateDoc(doc(db, "arena_meta", "global"), {
      waitingList: arrayUnion(currentUser.uid)
    });
    alert("Richiesta inviata! Attendi l'approvazione del Master.");
  };

  // --- LOGICA MASTER: APPROVAZIONE E MATCHMAKING ---
  const approveParticipant = async (uid) => {
    await updateDoc(doc(db, "arena_meta", "global"), {
      waitingList: arrayRemove(uid),
      participants: arrayUnion(uid)
    });
  };

  const startTournament = async () => {
    if (arenaMeta.participants.length < 2) return alert("Minimo 2 partecipanti!");
    const shuffled = [...arenaMeta.participants].sort(() => Math.random() - 0.5);
    const matches = generateMatches(shuffled, 1);
    await updateDoc(doc(db, "arena_meta", "global"), {
      matches,
      phase: "combat",
      currentRound: 1
    });
  };

  const generateMatches = (competitors, round) => {
    const matches = [];
    let i = 0;
    while (i < competitors.length) {
      const remaining = competitors.length - i;
      const matchPlayersIds = (remaining === 3) ? competitors.slice(i, i+3) : competitors.slice(i, i+2);
      if (matchPlayersIds.length < 2) break;

      matches.push({
        matchId: `R${round}_M${matches.length}`,
        players: matchPlayersIds.map(id => ({
          id,
          hp: CHARACTERS_DB[id].stats.hp,
          init: 0,
          name: CHARACTERS_DB[id].name
        })),
        status: "initiative",
        turn: null,
        logs: [`Match pronto!`],
        winner: null
      });
      i += matchPlayersIds.length;
    }
    return matches;
  };

  // --- LOGICA COMBATTIMENTO ---
  const rollInit = async (matchId) => {
    const playerStat = CHARACTERS_DB[currentUser.uid].stats;
    const roll = Math.floor(Math.random() * 20) + 1 + playerStat.dex;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId === matchId) {
        const updatedPlayers = m.players.map(p => p.id === currentUser.uid ? { ...p, init: roll } : p);
        const allRolled = updatedPlayers.every(p => p.init > 0);
        return {
          ...m,
          players: updatedPlayers,
          status: allRolled ? "active" : "initiative",
          turn: allRolled ? [...updatedPlayers].sort((a,b) => b.init - a.init)[0].id : null,
          logs: [...m.logs, `🎲 ${CHARACTERS_DB[currentUser.uid].name}: Init ${roll}`]
        };
      }
      return m;
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const handleAttack = async (matchId, targetId, action) => {
    const match = arenaMeta.matches.find(m => m.matchId === matchId);
    const attackerData = CHARACTERS_DB[currentUser.uid];
    const defenderData = CHARACTERS_DB[targetId];

    const d20 = Math.floor(Math.random() * 20) + 1;
    const hitTotal = d20 + parseInt(action.bonus);
    const isHit = hitTotal >= defenderData.stats.ac;
    const damage = isHit ? action.damage : 0;

    const log = isHit 
      ? `💥 ${attackerData.name} COLPISCE ${defenderData.name} (${hitTotal} vs CA ${defenderData.stats.ac}) -> ${damage} HP`
      : `🛡️ ${attackerData.name} MANCA ${defenderData.name} (${hitTotal} vs CA ${defenderData.stats.ac})`;

    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId === matchId) {
        const updatedPlayers = m.players.map(p => p.id === targetId ? { ...p, hp: Math.max(0, p.hp - damage) } : p);
        const alive = updatedPlayers.filter(p => p.hp > 0);
        if (alive.length === 1) {
          return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id, logs: [...m.logs, log, `🏆 ${alive[0].name.toUpperCase()} VINCE!`] };
        } else {
          const currentIndex = m.players.findIndex(p => p.id === currentUser.uid);
          let nextIndex = (currentIndex + 1) % m.players.length;
          while (updatedPlayers[nextIndex].hp <= 0) nextIndex = (nextIndex + 1) % m.players.length;
          return { ...m, players: updatedPlayers, turn: updatedPlayers[nextIndex].id, logs: [...m.logs, log] };
        }
      }
      return m;
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  if (!arenaMeta) return <div className="loading">Caricamento Arena...</div>;

  return (
    <div className="arena-theme-page">
      <h1 className="arena-main-title">ARENA DEI CAMPIONI</h1>

      {/* --- DASHBOARD MASTER --- */}
      {isMaster && (
        <div className="master-admin-panel">
          <h3>Pannello di Controllo Master</h3>
          <div className="waiting-list">
            <h4>Richieste Iscrizione:</h4>
            {arenaMeta.waitingList?.map(uid => (
              <div key={uid} className="approval-row">
                <span>{CHARACTERS_DB[uid]?.name || "Sconosciuto"}</span>
                <button onClick={() => approveParticipant(uid)}>✅ Approva</button>
              </div>
            ))}
          </div>
          <button className="gold-action-btn" onClick={startTournament}>INIZIA TORNEO</button>
          <button className="reset-btn" onClick={() => updateDoc(doc(db, "arena_meta", "global"), { phase: "registration", participants: [], waitingList: [], matches: [] })}>RESET ARENA</button>
        </div>
      )}

      {/* --- VISTA PLAYER: ISCRIZIONE --- */}
      {arenaMeta.phase === "registration" && !isMaster && (
        <div className="player-join-zone">
          <h2>Le iscrizioni sono aperte!</h2>
          <p>Vuoi partecipare con il tuo personaggio?</p>
          <button 
            className="gold-action-btn" 
            onClick={handleJoinRequest} 
            disabled={arenaMeta.waitingList?.includes(currentUser.uid) || arenaMeta.participants?.includes(currentUser.uid)}
          >
            {arenaMeta.participants?.includes(currentUser.uid) ? "Sei già iscritto" : "Invia Iscrizione"}
          </button>
        </div>
      )}

      {/* --- COMBATTIMENTO --- */}
      {arenaMeta.phase === "combat" && (
        <div className="active-matches">
          {arenaMeta.matches.map(m => {
            const myPlayer = m.players.find(p => p.id === currentUser.uid);
            const isMyMatch = !!myPlayer;
            const isMyTurn = m.turn === currentUser.uid;

            return (
              <div key={m.matchId} className="arena-match-card">
                <div className="match-id-badge">ROUND {arenaMeta.currentRound} - MATCH {m.matchId}</div>
                <div className="fighters-row">
                  {m.players.map(p => {
const char = CHARACTERS_DB[p.id] || { name: "Sconosciuto", stats: { maxHp: 100, ac: 10 } };                    const isDead = p.hp <= 0;
                    return (
                      <div key={p.id} className={`fighter-stat-box ${m.turn === p.id ? "active-turn" : ""} ${isDead ? "defeated" : ""}`}>
                        <span className="f-name">{p.name}</span>
                        <div className="f-hp-bar">
                          <div className="f-hp-fill" style={{ width: `${(p.hp / char.stats.maxHp) * 100}%` }}></div>
                        </div>
                        <span className="hp-text">{p.hp} HP</span>
                        
                        {/* PULSANTI: Visibili solo se è il MIO match e il MIO turno */}
                        {isMyMatch && isMyTurn && m.status === "active" && p.id === currentUser.uid && (
                          <div className="arsenal-grid">
                            {m.players.filter(t => t.id !== p.id && t.hp > 0).map(t => (
                              <div key={t.id} className="target-block">
                                <span className="target-name">Attacca {t.name.split(' ')[0]}</span>
                                <div className="atk-row">
                                  {char.weapons.map(w => <button key={w.name} className="btn-atk weapon" onClick={() => handleAttack(m.matchId, t.id, w)}>{w.name}</button>)}
                                  {char.spells.map(s => <button key={s.name} className="btn-atk spell" onClick={() => handleAttack(m.matchId, t.id, s)}>{s.name}</button>)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {isMyMatch && m.status === "initiative" && p.id === currentUser.uid && p.init === 0 && (
                          <button className="init-btn-roll" onClick={() => rollInit(m.matchId)}>Tira Iniziativa</button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="arena-chat-log">
                  {m.logs.slice(-3).map((l, i) => <p key={i} className="log-line">{l}</p>)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}