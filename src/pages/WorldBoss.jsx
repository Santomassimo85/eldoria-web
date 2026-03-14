import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";

import {
  doc,
  updateDoc,
  onSnapshot,
  writeBatch,
  increment,
  collection,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./WorldBoss.css";
import TimerDisplay from "../components/TimerDisplay";

export default function WorldBoss() {
  const { currentUser } = useAuth();
  const [charData, setCharData] = useState(null);
  const [activeBosses, setActiveBosses] = useState([]);
  const [messages, setMessages] = useState([]);

  const [selectedMod, setSelectedMod] = useState(null); // 'int' o 'wis'

  const calculateTimeLeft = (expiryDate) => {
    const difference = +new Date(expiryDate) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        h: Math.floor((difference / (1000 * 60 * 60)) % 24),
        m: Math.floor((difference / 1000 / 60) % 60),
        s: Math.floor((difference / 1000) % 60),
      };
    }
    return timeLeft;
  };

  // 1. DICHIARA LO STATO PLAYERS
  const [players, setPlayers] = useState([]);

  const [text, setText] = useState("");
  const [openSections, setOpenSections] = useState({ Armi: true });
  const chatEndRef = useRef(null);

  const MASTER_EMAIL = "santomassimo85@gmail.com";

  // 2. DICHIARA ISMASTER PRIMA DI USARLO NEGLI EFFECT
  const isMaster = currentUser?.email === MASTER_EMAIL;

  // Per togliere/aggiungere vita ai player
  const damagePlayer = async (playerId, amount) => {
    try {
      const playerRef = doc(db, "characters", playerId);
      // Importa 'increment' da firebase/firestore se non l'hai fatto
      await updateDoc(playerRef, {
        "stats.hp": increment(amount),
      });
    } catch (err) {
      console.error("Errore HP Player:", err);
    }
  };

// Stati per il turno
const [turnState, setTurnState] = useState({ phase: 'players', turnNumber: 1, actedPlayers: [] });

// Listen al turno in tempo reale
useEffect(() => {
  const unsub = onSnapshot(doc(db, "battle_meta", "turn_tracker"), (doc) => {
    if (doc.exists()) setTurnState(doc.data());
  });
  return () => unsub();
}, []);

// Funzione per il player per segnare che ha agito
const endMyTurn = async () => {
  if (turnState.actedPlayers.includes(currentUser.uid)) return;
  await updateDoc(doc(db, "battle_meta", "turn_tracker"), {
    actedPlayers: arrayUnion(currentUser.uid)
  });
};

// Funzione Master per cambiare fase
const togglePhase = async (newPhase) => {
  const update = { 
    phase: newPhase,
    actedPlayers: [] // Resetta chi ha agito al cambio fase
  };
  if (newPhase === 'players') {
    update.turnNumber = increment(1);
  }
  await updateDoc(doc(db, "battle_meta", "turn_tracker"), update);
};



  useEffect(() => {
    if (!isMaster) return; // Solo il Master scarica i dati di tutti i player

    const unsubPlayers = onSnapshot(collection(db, "characters"), (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsubPlayers();
  }, [isMaster]);


const handleManualHit = async () => {
  const d20 = Math.floor(Math.random() * 20) + 1;
  const modValue = charData?.stats?.[selectedMod] || 0;
  
  await addDoc(collection(db, "world_boss_chat"), {
    type: "action",
    senderName: charData?.name || "Eroe",
    actionName: `Tiro Manuale (${selectedMod.toUpperCase()})`,
    hitRoll: `${d20 + modValue} (${d20} + ${modValue})`,
    timestamp: serverTimestamp(),
    uid: currentUser.uid,
    category: "Manuale"
  });
};

const handleManualDamage = async (die) => {
  const sides = parseInt(die.replace('d', ''));
  const roll = Math.floor(Math.random() * sides) + 1;

  await addDoc(collection(db, "world_boss_chat"), {
    type: "action",
    senderName: charData?.name || "Eroe",
    actionName: `Danno Manuale ${die}`,
    damageRoll: `${roll} [${roll}]`,
    timestamp: serverTimestamp(),
    uid: currentUser.uid,
    category: "Manuale"
  });
};


  // Per far attaccare il Boss (genera il messaggio in chat)
  const handleBossRoll = async (boss, action) => {
    await addDoc(collection(db, "world_boss_chat"), {
      uid: "BOSS_MSG",
      senderName: boss.name,
      type: "action",
      category: "Attacco Boss",
      actionName: action.name,
      description: `Il boss scatena ${action.name}!`,
      hitRoll: `🎯 Colpire: d20 + ${action.bonus}`,
      damageRoll: `💥 Danni: ${action.damage}`,
      timestamp: serverTimestamp(),
    });
  };

  const handleDeleteMessage = async (id) => {
    if (window.confirm("DM, vuoi eliminare questo messaggio dalla storia?")) {
      try {
        await deleteDoc(doc(db, "world_boss_chat", id));
      } catch (err) {
        console.error("Errore eliminazione messaggio:", err);
      }
    }
  };

  // --- LOGICA CALCOLO DANNO ---
  const rollDamage = (dmgFormula) => {
    try {
      const cleanFormula = dmgFormula.replace(/\s+/g, "");
      const parts = cleanFormula.split("+");
      let totalDmg = 0;
      let detailedDmg = "";

      parts.forEach((part) => {
        if (part.includes("d")) {
          const [num, sides] = part.split("d").map(Number);
          for (let i = 0; i < (num || 1); i++) {
            const roll = Math.floor(Math.random() * sides) + 1;
            totalDmg += roll;
            detailedDmg += (detailedDmg ? " + " : "") + roll;
          }
        } else {
          const val = parseInt(part) || 0;
          totalDmg += val;
          detailedDmg += (detailedDmg ? " + " : "") + val;
        }
      });
      return { total: totalDmg, detail: detailedDmg };
    } catch (e) {
      return { total: 0, detail: "???" };
    }
  };

  function ChatAvatar({ uid }) {
    const [avatarUrl, setAvatarUrl] = useState(null);

    useEffect(() => {
      const unsub = onSnapshot(doc(db, "characters", uid), (snap) => {
        if (snap.exists()) setAvatarUrl(snap.data().image);
      });
      return () => unsub();
    }, [uid]);

    if (!avatarUrl) return <div className="avatar-placeholder" />;

    return <img src={avatarUrl} alt="Avatar" className="chat-avatar-img" />;
  }

  // --- LOGICA PULIZIA CHAT (BATCH) ---
  const clearChat = async () => {
    if (
      !window.confirm(
        "Sei sicuro di voler purgare l'intera chat? Questa azione è irreversibile.",
      )
    )
      return;

    try {
      const chatRef = collection(db, "world_boss_chat");
      const snapshot = await getDocs(query(chatRef));

      if (snapshot.empty) {
        alert("La chat è già vuota.");
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => {
        batch.delete(d.ref);
      });

      await batch.commit();
      console.log("Chat purgata con successo.");
    } catch (err) {
      console.error("Errore durante la purga della chat:", err);
      alert("Errore: controlla le regole di Firebase o la tua connessione.");
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    // Snapshot Personaggio
    const unsubChar = onSnapshot(
      doc(db, "characters", currentUser.uid),
      (snap) => {
        setCharData(snap.data());
      },
    );

    // Snapshot Boss Attivi
    const unsubBoss = onSnapshot(collection(db, "bosses"), (snap) => {
      const bosses = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((b) => b.isActive === true);
      setActiveBosses(bosses);
    });

    // Snapshot Chat
    const q = query(
      collection(db, "world_boss_chat"),
      orderBy("timestamp", "asc"),
      limit(100),
    );
    const unsubChat = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    return () => {
      unsubChar();
      unsubBoss();
      unsubChat();
    };
  }, [currentUser]);

  // Raggruppamento azioni
  const groupedActions = charData?.actions?.reduce((acc, action) => {
    const cat = action.category || "Altro";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(action);
    return acc;
  }, {});

  const sortedCategories = groupedActions
    ? Object.keys(groupedActions).sort((a, b) => {
        if (a === "Armi") return -1;
        if (b === "Armi") return 1;
        return a.localeCompare(b);
      })
    : [];

  const handleActionRoll = async (action) => {
    const isAttack = action.category === "Armi";

    let actionData = {
      type: "action",
      senderName: charData?.name || "Eroe",
      actionName: action.name,
      description: action.description,
      timestamp: serverTimestamp(),
      uid: currentUser.uid,
      category: action.category,
    };

    if (isAttack) {
      const d20 = Math.floor(Math.random() * 20) + 1;
      const bonus = parseInt(action.bonus?.replace(/[^0-9+-]/g, "")) || 0;
      const damageResult = rollDamage(action.damage || "1d4");

      actionData.hitRoll = `${d20 + bonus} (${d20} + ${bonus})`;
      actionData.damageRoll = `${damageResult.total} [${damageResult.detail}]`;
    } else {
      actionData.hitRoll = null;
      actionData.damageRoll = null;
    }

    await addDoc(collection(db, "world_boss_chat"), actionData);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await addDoc(collection(db, "world_boss_chat"), {
      type: "narrative",
      senderName: charData?.name || "Eroe",
      content: text,
      timestamp: serverTimestamp(),
      uid: currentUser.uid,
    });
    setText("");
  };

  const isBossActive = activeBosses.length > 0;
  const hasMission = charData?.activeMissionId?.includes("WORLD_BOSS");

  // --- CONTROLLO ACCESSO AGGIORNATO ---
  if (!currentUser)
    return <div className="denied-msg">Loggati per entrare.</div>;

  // Entrano: Master, chi ha la missione, o CHIUNQUE se c'è un boss attivo nel mondo
  if (!isMaster && !isBossActive && !hasMission) {
    return (
      <div className="denied-msg">
        Non ci sono Boss attivi al momento... la quiete prima della tempesta.
      </div>
    );
  }

  return (
    <div className="wb-container">
      {isMaster && (
        <div className="dm-controls-top">
          <div className="dm-overlay-label">MODALITÀ DUNGEON MASTER</div>
          <button onClick={clearChat} className="dm-clear-button">
            Svuota Chat
          </button>
        </div>
      )}

      {/* AREA BOSS */}
      <section className="boss-area">
        {activeBosses.length === 0 && (
          <div className="no-boss">Nessun Boss attivo nel mondo.</div>
        )}
        {activeBosses.map((boss) => (
          <div key={boss.id} className="boss-unit">
            <h2 className="boss-name">{boss.name}</h2>
            <div className="boss-badge">Grado Sfida: {boss.gradoSfida}</div>
            {/* Visualizzazione descrizione narrativa */}
            {boss.description && (
              <p className="boss-flavor-text">{boss.description}</p>
            )}

            <div className="hp-bar-outer">
              <div
                className="hp-bar-inner"
                style={{
                  width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`,
                }}
              >
                {isMaster && (
                  <span className="hp-text-admin">
                    {boss.hp} / {boss.maxHp}
                  </span>
                )}
                
              </div>
             
            </div>

            <div className="main-boss-timer">
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#404040" }}>
                SCADENZA MINACCIA:
              </p>
              <TimerDisplay expiryDate={activeBosses[0]?.expiryDate} />
            </div>
<div className={`turn-banner ${turnState.phase}-phase`}>
  <div className="turn-count">TURNO {turnState.turnNumber}</div>
  <div className="phase-text">
    {turnState.phase === 'players' ? "🛡️ TURNO EROI" : "🔥 TURNO BOSS"}
  </div>
  
  {turnState.phase === 'players' && !isMaster && (
    <button 
    className={`btn-end-turn ${turnState.actedPlayers.includes(currentUser.uid) ? 'acted' : ''}`}
    onClick={endMyTurn}
    disabled={turnState.actedPlayers.includes(currentUser.uid)}
    >
      {turnState.actedPlayers.includes(currentUser.uid) ? "Azione Eseguita" : "Concludi Azione"}
    </button>
  )}
</div>
  {isMaster && (
  <div className="master-turn-controls">
    <button onClick={() => togglePhase('players')}>Passa a Eroi (Nuovo Turno)</button>
    <button onClick={() => togglePhase('boss')}>Passa a Boss</button>
    <div className="acted-summary">
      Agiti: {turnState.actedPlayers.length} / {players.length}
    </div>
  </div>
)}
            <img src={boss.imageUrl} alt={boss.name} className="boss-image" />
          </div>
        ))}
      </section>

      <div className="battle-interface">
        {/* CHAT PBP */}
        <section className="chat-section">
          <div className="chat-messages">
            {messages.map((m, index) => {
              const isDifferentAuthor =
                index === 0 || messages[index - 1].uid !== m.uid;

              let authorChangeCount = 0;
              for (let i = 0; i <= index; i++) {
                if (i === 0 || messages[i - 1].uid !== messages[i].uid)
                  authorChangeCount++;
              }
              const isAlternate = authorChangeCount % 2 === 0;

              const isMasterMessage =
                m.uid === "WNXsX7fSY5a3g2VZruYEXgFILOJ3" ||
                m.uid === "BOSS_MSG";
              return (
                <div
                  key={m.id}
                  className={`msg-bubble ${m.type} 
        ${isAlternate ? "msg-right bg-variant" : "msg-left bg-standard"} 
        ${isDifferentAuthor ? "new-author-block" : ""}
        ${isMasterMessage ? "is-master-msg" : ""}`} // <--- CLASSE AGGIUNTA
                >
                  <div className="msg-header">
                    <ChatAvatar uid={m.uid} />
                    <span className="msg-author">{m.senderName}</span>

                    {/* LA PICCOLA X ROSSA SOLO PER IL MASTER */}
                    {currentUser?.email === MASTER_EMAIL && (
                      <button
                        className="btn-delete-msg"
                        onClick={() => handleDeleteMessage(m.id)}
                        title="Elimina messaggio"
                      >
                        ✖
                      </button>
                    )}
                  </div>

                  {m.type === "action" ? (
                    <div
                      className={`action-result cat-${m.category?.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      <strong className="action-title">{m.actionName}</strong>
                      <p className="action-desc">{m.description}</p>
                      {(m.hitRoll || m.damageRoll) && (
                        <div className="rolls-box">
                          {m.hitRoll && <span>🎯 Colpire: {m.hitRoll}</span>}
                          {m.damageRoll && (
                            <span>💥 Danno: {m.damageRoll}</span>
                          )}
                        </div>
                      )}
                      {!m.hitRoll && (
                        <div className="info-tag">{m.category}</div>
                      )}
                    </div>
                  ) : (
                    <p className="msg-text">{m.content}</p>
                  )}
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-form" onSubmit={handleSendMessage}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Narra l'azione..."
            />
            <button className="invia" type="submit">
              Invia
            </button>
          </form>
        </section>

        {/* SIDEBAR AZIONI DINAMICA (MASTER VS PLAYER) */}
        <section className="player-actions-sidebar">
          {currentUser?.email === MASTER_EMAIL ? (
            /* --- VISTA DUNGEON MASTER --- */
            <div className="admin-battle-controls">
              <h3 className="sidebar-title">⚡ Dashboard Master</h3>

              {/* MONITORAGGIO PARTY */}
              <div className="party-status-monitor">
                <h4 className="sub-title-admin">Salute Party</h4>
                {players &&
                  players.map((p) => {
                    // Calcoliamo la percentuale in modo sicuro per evitare divisioni per zero o undefined
                    const currentHp = p.stats?.hp ?? "ND";
                    const maxHp = p.stats?.maxHp ?? "ND"; // 1 evita divisione per zero
                    const hpPercentage = Math.min(
                      100,
                      Math.max(0, (currentHp / maxHp) * 100),
                    );

                    return (
                      <div key={p.id} className="player-hp-row">
                        <span className="p-name">
                          {p.name?.split(" ")[0] || "Eroe"}
                        </span>
                        <div className="hp-bar-mini-container">
                          <div
                            className="hp-bar-mini-fill"
                            style={{ width: `${hpPercentage}%` }}
                          ></div>
                          <span className="hp-text-overlay">
                            {currentHp}/{maxHp}
                          </span>
                        </div>
                        <div className="hp-btns">
                          <div className="hp-btn-group">
                            <button
                              onClick={() => damagePlayer(p.id, -5)}
                              className="btn-hp minus"
                            >
                              -5
                            </button>
                            <button
                              onClick={() => damagePlayer(p.id, -1)}
                              className="btn-hp minus"
                            >
                              -1
                            </button>
                          </div>

                          <div className="hp-btn-group">
                            <button
                              onClick={() => damagePlayer(p.id, 1)}
                              className="btn-hp plus"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => damagePlayer(p.id, 5)}
                              className="btn-hp plus"
                            >
                              +5
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* AZIONI BOSS ATTIVI */}
              <div
                className="boss-actions-monitor"
                style={{ marginTop: "20px" }}
              >
                <h4 className="sub-title-admin">Attacchi dei Boss</h4>
                {activeBosses.map((boss) => (
                  <div key={boss.id} className="boss-control-card">
                    <p className="boss-mini-name">{boss.name}</p>
                    <div className="wb-action-list">
                      {boss.action1?.name && (
                        <button
                          className="wb-btn-action boss-atk"
                          onClick={() => handleBossRoll(boss, boss.action1)}
                        >
                          ⚔️ {boss.action1.name} ({boss.action1.damage})
                        </button>
                      )}
                      {boss.action2?.name && (
                        <button
                          className="wb-btn-action boss-atk"
                          onClick={() => handleBossRoll(boss, boss.action2)}
                        >
                          🔥 {boss.action2.name} ({boss.action2.damage})
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* --- VISTA PLAYER (ORIGINALE) --- */
            <>
              <h3 className="sidebar-title">
                Capacità di {charData?.name?.split(" ")[0] || "Eroe"}
              </h3>
              <div className="accordion-container">
                {sortedCategories.map((cat) => (
                  <div key={cat} className="wb-section">
                    <button
                      className="wb-section-toggle"
                      onClick={() =>
                        setOpenSections((prev) => ({
                          ...prev,
                          [cat]: !prev[cat],
                        }))
                      }
                    >
                      {cat} {openSections[cat] ? "▲" : "▼"}
                    </button>
                    {openSections[cat] && (
                      <div className="wb-action-list">
                        {groupedActions[cat].map((action, idx) => (
                          <button
                            key={idx}
                            className="wb-btn-action"
                            onClick={() => handleActionRoll(action)}
                          >
                            {action.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="quick-roll-panel">
  <h4 className="sidebar-subtitle">Tiri Rapidi</h4>
  
  {/* SELEZIONE STATISTICA */}
  <div className="stat-selector">
    <button 
  className={`stat-btn ${selectedMod === 'int' ? 'active' : ''}`}
  onClick={() => setSelectedMod('int')}
>
  INT ({charData?.stats?.int >= 0 ? '+' : ''}{charData?.stats?.int ?? 0})
</button>
    <button 
      className={`stat-btn ${selectedMod === 'wis' ? 'active' : ''}`}
      onClick={() => setSelectedMod('wis')}
    >
      SAG {charData?.stats?.wis >= 0 ? `+${charData.stats.wis}` : charData?.stats?.wis}
    </button>
  </div>

  <button 
    className="wb-btn-action roll-d20" 
    disabled={!selectedMod}
    onClick={() => handleManualHit()}
  >
    🎲 Tira d20 {selectedMod ? `(${selectedMod.toUpperCase()})` : "(Scegli Stat)"}
  </button>

  {/* SELEZIONE DADI DANNO */}
  <div className="damage-dice-grid">
    {['d4', 'd6', 'd8', 'd10', 'd12'].map(die => (
      <button key={die} className="die-btn" onClick={() => handleManualDamage(die)}>
        {die}
      </button>
    ))}
  </div>
</div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
