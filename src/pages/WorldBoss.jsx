import React, { useState, useEffect, useRef, useMemo } from "react";
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
  arrayUnion,
  orderBy,
  limit,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./WorldBoss.css";
import TimerDisplay from "../components/TimerDisplay";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const BOSS_SYSTEM_UID = "BOSS_MSG";

export default function WorldBoss() {
  const { currentUser } = useAuth();
  const [charData, setCharData] = useState(null);
  const [activeBosses, setActiveBosses] = useState([]);
  const [messages, setMessages] = useState([]);
  const [players, setPlayers] = useState([]);
  const [text, setText] = useState("");
  const [selectedMod, setSelectedMod] = useState(null);
  const [openSections, setOpenSections] = useState({ Armi: true });
  const [selectedTargets, setSelectedTargets] = useState([]); // Stato per selezione bersagli Master
  const [dmgDiceCount, setDmgDiceCount] = useState(1); // Numero di dadi (default 1)
  const [dmgSelectedStat, setDmgSelectedStat] = useState(null); // Caratteristica per il danno

  const [turnState, setTurnState] = useState({
    phase: "players",
    turnNumber: 1,
    actedPlayers: [],
  });

  const chatEndRef = useRef(null);
  const isMaster = useMemo(
    () => currentUser?.email === MASTER_EMAIL,
    [currentUser],
  );

  const [timeLeft, setTimeLeft] = useState(0);
  const [isUrgent, setIsUrgent] = useState(false);

  const handleManualTurnChange = async (newPhase) => {
    if (!isMaster) return;

    const duration =
      newPhase === "players" ? 3 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000;
    const newExpiry = new Date(Date.now() + duration);

    try {
      await updateDoc(doc(db, "battle_meta", "turn_tracker"), {
        phase: newPhase,
        expiryDate: newExpiry,
        actedPlayers: [], // Reset dei player che hanno agito
        turnNumber:
          newPhase === "players" ? increment(1) : turnState.turnNumber,
      });

      // Opzionale: invia un messaggio di sistema in chat
      await addDoc(collection(db, "global_chat"), {
        text: `🔔 Il Master ha avviato il turno: ${newPhase.toUpperCase()}`,
        sender: "SISTEMA",
        uid: "SYS",
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Errore nel cambio turno:", err);
    }
  };

  const handleAutoTurnChange = async () => {
    // Cambiato turnData in turnState
    if (turnState.phase === "players") {
      if (turnState.actedPlayers.length <= 1) {
        // Estensione di 3 ore se ha agito solo 1 player
        const newExpiry = new Date(Date.now() + 3 * 60 * 60 * 1000);
        await updateDoc(doc(db, "battle_meta", "turn_tracker"), {
          expiryDate: newExpiry,
        });
        console.log("Turno esteso: pochi attaccanti.");
      } else {
        // Passaggio al Boss (1 ora)
        const newExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000);
        await updateDoc(doc(db, "battle_meta", "turn_tracker"), {
          phase: "boss",
          actedPlayers: [],
          expiryDate: newExpiry,
        });
      }
    } else {
      // Il Boss ha finito, torna ai Player (3 ore)
      const newExpiry = new Date(Date.now() + 3 * 60 * 60 * 1000);
      await updateDoc(doc(db, "battle_meta", "turn_tracker"), {
        phase: "players",
        turnNumber: increment(1),
        actedPlayers: [],
        expiryDate: newExpiry,
      });
    }
  };

  useEffect(() => {
    // Usiamo turnState e controlliamo se expiryDate esiste[cite: 7]
    if (!turnState?.expiryDate) return;

    const interval = setInterval(() => {
      const now = Date.now();
      // Gestione del timestamp di Firestore[cite: 7]
      const expiry = turnState.expiryDate.toMillis
        ? turnState.expiryDate.toMillis()
        : turnState.expiryDate;
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
        if (isMaster) handleAutoTurnChange();
      } else {
        setTimeLeft(diff);
        // Calcolo urgenza 10%
        const totalDuration =
          turnState.phase === "players"
            ? 3 * 60 * 60 * 1000
            : 1 * 60 * 60 * 1000;
        setIsUrgent(diff < totalDuration * 0.1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [turnState?.expiryDate, turnState?.phase, isMaster]);

  // Funzione per formattare millisecondi in HH:MM:SS
  const formatTime = (ms) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Player tornato attivo, forzo sincronizzazione...");
        // Opzionale: puoi chiamare una funzione di fetch o ricaricare
        // window.location.reload();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const handleManualDamageToBoss = async (die) => {
    const boss = activeBosses[0];
    if (!boss || isUserLocked) return;

    const sides = parseInt(die.replace("d", ""));
    let totalRoll = 0;
    let rollsDetail = [];

    // 1. Lancio dadi base (quelli selezionati dall'utente)
    for (let i = 0; i < dmgDiceCount; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      totalRoll += roll;
      rollsDetail.push(roll);
    }

    // 2. Bonus Caratteristica selezionata
    const statMod = dmgSelectedStat
      ? (charData?.stats?.[dmgSelectedStat] ?? 0)
      : 0;

    // 3. --- LOGICA LADRO (Sneak Attack automatico) ---
    let sneakDamage = 0;
    const characterClass = charData?.class?.toLowerCase() || "";
    const isRogue = characterClass === "ladro" || characterClass === "rogue";

    if (isRogue) {
      sneakDamage = Math.floor(Math.random() * 6) + 1; // 1d6 automatico
    }

    const finalDamage = totalRoll + statMod + sneakDamage;

    // 4. --- LOGICA CALCOLO DANNO VS SCUDO ---
    const currentShield = boss.shield || 0;
    const currentHp = boss.hp || 0;
    let remainingDamage = finalDamage;
    let newShield = currentShield;
    let newHp = currentHp;

    if (currentShield > 0) {
      if (currentShield >= remainingDamage) {
        // Lo scudo assorbe tutto il danno
        newShield = currentShield - remainingDamage;
        remainingDamage = 0;
      } else {
        // Lo scudo si rompe, il danno restante passa agli HP
        remainingDamage -= currentShield;
        newShield = 0;
        newHp = Math.max(0, currentHp - remainingDamage);
      }
    } else {
      // Niente scudo, danno diretto agli HP
      newHp = Math.max(0, currentHp - remainingDamage);
    }

    // 5. AGGIORNAMENTO DATABASE
    try {
      await updateDoc(doc(db, "bosses", boss.id), {
        hp: newHp,
        shield: newShield
      });

      // 6. COSTRUZIONE DETTAGLIO CHAT
      let detailString = `${dmgDiceCount}${die} (${rollsDetail.join("+")})`;
      if (statMod !== 0) detailString += ` ${statMod > 0 ? "+ " + statMod : statMod}`;
      if (isRogue) detailString += ` + 1d6 Ladro (${sneakDamage})`;
      
      let shieldNote = currentShield > 0 
        ? ` (Scudo colpito! Rimanente: ${newShield})` 
        : "";

      await addDoc(collection(db, "world_boss_chat"), {
        type: "action",
        senderName: charData?.name || "Eroe",
        actionName: `Danno Arma ${isRogue ? " (Furtivo)" : ""}`,
        damageRoll: `💥 INFLITTI ${finalDamage} DANNI!${shieldNote}`,
        description: `Tiro: ${detailString}`,
        uid: currentUser.uid,
        category: "Danno",
        timestamp: serverTimestamp(),
      });

      // Reset UI e fine turno
      setDmgDiceCount(1);
      setDmgSelectedStat(null);
      await endMyTurn();

    } catch (err) {
      console.error("Errore durante l'applicazione del danno:", err);
    }
  };

  const handleSavingThrow = async (statKey) => {
    // Aggiungi questo controllo all'inizio della funzione
    if (isUserLocked || !charData || !charData.stats) return;

    const d20 = Math.floor(Math.random() * 20) + 1;
    const mod = charData.stats[statKey] || 0;

    await addDoc(collection(db, "world_boss_chat"), {
      type: "action",
      senderName: charData.name || "Eroe",
      actionName: `Tiro Salvezza ${statKey.toUpperCase()}`,
      hitRoll: `🎲 d20(${d20}) + mod(${mod}) = ${d20 + mod}`,
      uid: currentUser.uid,
      category: "Tiro Salvezza",
      timestamp: serverTimestamp(),
    });
  };

  const toggleSelectAll = () => {
    if (selectedTargets.length === players.length) {
      // Se sono già tutti selezionati, svuota la selezione
      setSelectedTargets([]);
    } else {
      // Altrimenti, seleziona tutti gli ID dei player
      const allIds = players.map((p) => p.id);
      setSelectedTargets(allIds);
    }
  };

  const healAllPlayers = async () => {
    const confirmHeal = window.confirm(
      "DM, vuoi curare TUTTI i player al massimo della vita?",
    );
    if (!confirmHeal) return;

    try {
      const batch = writeBatch(db);

      players.forEach((player) => {
        const playerRef = doc(db, "characters", player.id);
        // Impostiamo gli HP attuali uguali ai Max HP
        batch.update(playerRef, {
          "stats.hp": player.stats.maxHp || 100,
        });
      });

      await batch.commit();

      // Notifica in chat l'azione divina
      await addDoc(collection(db, "world_boss_chat"), {
        uid: BOSS_SYSTEM_UID,
        senderName: "Sistema",
        type: "notification",
        content:
          "✨ Un'aura divina avvolge gli eroi: TUTTI i player sono stati curati al massimo!",
        timestamp: serverTimestamp(),
      });

      alert("Tutti i player sono stati curati!");
    } catch (error) {
      console.error("Errore nella cura globale:", error);
      alert("Errore durante la cura.");
    }
  };

  // Monitoraggio Turni
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "battle_meta", "turn_tracker"), (snap) => {
      if (snap.exists()) setTurnState(snap.data());
    });
    return () => unsub();
  }, []);

  // Monitoraggio Player (Solo Master)
  useEffect(() => {
    if (!isMaster) return;
    const unsub = onSnapshot(collection(db, "characters"), (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isMaster]);

  // Caricamento Dati Principali
  useEffect(() => {
    if (!currentUser) return;

    const unsubChar = onSnapshot(
      doc(db, "characters", currentUser.uid),
      (snap) => {
        setCharData(snap.data());
      },
    );

    const unsubBoss = onSnapshot(collection(db, "bosses"), (snap) => {
      const bosses = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((b) => b.isActive);
      setActiveBosses(bosses);
    });

    const q = query(
      collection(db, "world_boss_chat"),
      orderBy("timestamp", "desc"),
      limit(100),
    );
    const unsubChat = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse());
    });

    return () => {
      unsubChar();
      unsubBoss();
      unsubChat();
    };
  }, [currentUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Logica Dadi
  const rollDice = (formula) => {
    try {
      const clean = formula.replace(/\s+/g, "");
      return clean.split("+").reduce((acc, part) => {
        if (part.includes("d")) {
          const [num, sides] = part.split("d").map((n) => parseInt(n) || 1);
          for (let i = 0; i < num; i++)
            acc += Math.floor(Math.random() * sides) + 1;
        } else {
          acc += parseInt(part) || 0;
        }
        return acc;
      }, 0);
    } catch {
      return 0;
    }
  };
  // WorldBoss.jsx - Intorno alla riga 250
  const isBossDefeated = useMemo(() => {
    return activeBosses.length > 0 && activeBosses[0].hp <= 0;
  }, [activeBosses]);

  // --- AZIONI PLAYER ---
  const endMyTurn = async () => {
    if (turnState.actedPlayers.includes(currentUser.uid)) return;
    await updateDoc(doc(db, "battle_meta", "turn_tracker"), {
      actedPlayers: arrayUnion(currentUser.uid),
    });
  };

  const handleActionRoll = async (action) => {
    const boss = activeBosses[0];
    if (!boss || turnState.actedPlayers.includes(currentUser.uid)) return;

    const isAttack = action.category === "Armi";
    const d20 = Math.floor(Math.random() * 20) + 1;
    const bonus = parseInt(action.bonus?.replace(/[^0-9+-]/g, "")) || 0;
    const hitTotal = d20 + bonus;
    const isCritical = d20 === 20; // <--- Rilevamento Critico naturale

    let actionData = {
      type: "action",
      senderName: charData?.name || "Eroe",
      actionName: action.name + (isCritical ? " (CRITICO!)" : ""),
      timestamp: serverTimestamp(),
      uid: currentUser.uid,
      category: action.category,
      hitRoll: `🎲 d20(${d20}) + bonus(${bonus}) = ${hitTotal} `,
    };

    if (isAttack) {
      if (isCritical || hitTotal >= (boss.ac || 10)) {
        // Se è critico, salviamo l'informazione per il tiro danni successivo
        if (isCritical) {
          setDmgDiceCount(2); // Raddoppia automaticamente i dadi per il prossimo click
          actionData.damageRoll =
            "💥 CRITICO NATURALE! I tuoi dadi danno sono raddoppiati!";
        } else {
          actionData.damageRoll = "🎯 COLPITO! Tira il dado per i danni";
        }
      } else {
        actionData.damageRoll = "🛡️ MANCATO! Il colpo rimbalza.";
        await endMyTurn();
      }
      await addDoc(collection(db, "world_boss_chat"), actionData);
    } else {
      await addDoc(collection(db, "world_boss_chat"), actionData);
    }
  };

  // --- AZIONI MASTER (AUTOMAZIONE BOSS) ---
  const toggleTarget = (uid) => {
    setSelectedTargets((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  };

  // WorldBoss.jsx

  const handleBossRoll = async (boss, action) => {
    if (selectedTargets.length === 0)
      return alert("DM, seleziona almeno un bersaglio!");

    // 1. UNICO TIRO PER COLPIRE (Regola D&D)
    const d20 = Math.floor(Math.random() * 20) + 1;
    const bossBonus = parseInt(action.bonus) || 0;
    const hitTotal = d20 + bossBonus;

    // 2. UNICO TIRO PER IL DANNO (Regola D&D)
    const damageDealt = rollDice(action.damage || "1d6");

    const results = [];

    // 3. CONFRONTO DEL TIRO UNICO CON OGNI BERSAGLIO
    for (const targetId of selectedTargets) {
      const p = players.find((player) => player.id === targetId);
      if (!p) continue;

      const playerCA = p.stats?.ac || 10;
      const isHit = hitTotal >= playerCA;

      if (isHit) {
        let remainingDmg = damageDealt;
        let currentShield = p.stats?.shield || 0;
        let currentHp = p.stats?.hp || 0;

        // --- LOGICA SCUDO ---
        if (currentShield > 0) {
          if (currentShield >= remainingDmg) {
            // Lo scudo assorbe tutto il danno
            currentShield -= remainingDmg;
            remainingDmg = 0;
          } else {
            // Lo scudo si rompe, il danno rimanente passa agli HP
            remainingDmg -= currentShield;
            currentShield = 0;
          }
        }

        // Aggiornamento database: HP e Scudo
        await updateDoc(doc(db, "characters", targetId), {
          "stats.hp": Math.max(0, currentHp - remainingDmg),
          "stats.shield": currentShield,
        });
      }

      results.push({
        name: p.name.split(" ")[0],
        hit: isHit,
        roll: `${hitTotal} (${d20}+${bossBonus}) vs CA ${playerCA}`,
        dmg: isHit ? damageDealt : 0,
      });
    }

    // Preparazione narrazione per la chat
    const hitTargets = results
      .filter((r) => r.hit)
      .map((r) => r.name)
      .join(", ");
    const missedTargets = results
      .filter((r) => !r.hit)
      .map((r) => r.name)
      .join(", ");

    await addDoc(collection(db, "world_boss_chat"), {
      uid: BOSS_SYSTEM_UID,
      senderName: boss.name,
      type: "action",
      category: "Attacco Boss",
      actionName: action.name,
      description: `Il Boss scatena ${action.name} (Danni: ${damageDealt})! ${
        hitTargets.length > 0 ? "Colpisce: " + hitTargets : ""
      }${missedTargets.length > 0 ? ". Mancati: " + missedTargets : ""}`,
      masterDetails: results,
      timestamp: serverTimestamp(),
    });

    // Reset dei bersagli selezionati dopo l'attacco
    setSelectedTargets([]);
  };

  const togglePhase = async (newPhase) => {
    const update = { phase: newPhase, actedPlayers: [] };
    if (newPhase === "players") update.turnNumber = increment(1);
    await updateDoc(doc(db, "battle_meta", "turn_tracker"), update);
  };

  const damagePlayerManual = async (playerId, amount) => {
    await updateDoc(doc(db, "characters", playerId), {
      "stats.hp": increment(amount),
    });
  };

  const healBossManual = async (amount) => {
    const boss = activeBosses[0];
    if (!boss) return;

    await updateDoc(doc(db, "bosses", boss.id), {
      hp: Math.min(boss.maxHp, boss.hp + amount), // Cura senza superare il max
    });
  };

  const shieldBossManual = async () => {
    const boss = activeBosses[0];
    if (!boss) return;

    const val = prompt("Quanti HP di scudo vuoi dare al Boss?");
    if (val && !isNaN(val)) {
      await updateDoc(doc(db, "bosses", boss.id), {
        shield: increment(parseInt(val)),
      });
    }
  };

  const clearChat = async () => {
    if (!window.confirm("Purgare la chat?")) return;
    const snapshot = await getDocs(collection(db, "world_boss_chat"));
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  };

  const handleDeleteMessage = async (id) => {
    if (isMaster) await deleteDoc(doc(db, "world_boss_chat", id));
  };

  // Derived Data
  const groupedActions = useMemo(() => {
    if (!charData?.actions) return {};
    return charData.actions.reduce((acc, action) => {
      const cat = action.category || "Altro";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(action);
      return acc;
    }, {});
  }, [charData]);

  const sortedCategories = useMemo(() => {
    return Object.keys(groupedActions).sort((a, b) =>
      a === "Armi" ? -1 : b === "Armi" ? 1 : a.localeCompare(b),
    );
  }, [groupedActions]);

  const isUserLocked =
    !isMaster &&
    (turnState.phase === "boss" ||
      turnState.actedPlayers.includes(currentUser?.uid));

  if (!currentUser)
    return <div className="denied-msg">Loggati per entrare.</div>;

  return (
    <div className="wb-container">
      <h1>World Boss</h1>
      <h5>
        IMPORTANTE: solo i player che effettueranno piú di 2 attacchi
        riceveranno ricompense
      </h5>
      {isMaster && (
        <div className="dm-controls-top">
          <div className="dm-overlay-label">DUNGEON MASTER CONTROL</div>
          <button onClick={clearChat} className="dm-clear-button">
            Pulisci Chat
          </button>
        </div>
      )}

      {/* AREA BOSS */}
      <section className="boss-area">
        {activeBosses.map((boss) => {
          const isDefeated = boss.hp <= 0;

          return (
            <div
              key={boss.id}
              className={`boss-unit ${isDefeated ? "defeated-unit" : ""}`}
            >
              <h2 className="boss-name">{boss.name}</h2>

              {/* Se il boss è vivo, mostra la descrizione e le penalità */}
              {!isDefeated ? (
                <>
                  {boss.description && (
                    <p className="boss-flavor-text">{boss.description}</p>
                  )}
                  <div className="main-boss-timer">
                    <TimerDisplay expiryDate={boss.expiryDate} />
                  </div>
                  {boss.penalties && (
                    <div className="boss-penalties-glow-box">
                      <span className="penalties-label">
                        💀 PENALITÀ SCONFITTA:
                      </span>
                      <p className="penalties-text">{boss.penalties}</p>
                    </div>
                  )}
                </>
              ) : (
                /* Se il boss è sconfitto, mostra l'annuncio di vittoria */
                <div className="victory-announcement">
                  <h1 className="victory-glow-text">
                    🏆 VITTORIA DEGLI EROI 🏆
                  </h1>
                  {/* <p className="victory-sub" style={{color: 'black', fontWeight: 'bold'}}>
              Il male è stato sconfitto, il boss è caduto!
            </p> */}
                </div>
              )}

              {/* IL BOTTINO RIMANE SEMPRE SCRITTO (Sia da vivo che da morto) */}
              {boss.rewards && (
                <div className="boss-rewards-glow-box">
                  <span className="rewards-label">BOTTINO:</span>
                  <p className="rewards-text">{boss.rewards}</p>
                </div>
              )}

              {/* MOSTRA I TURNI E LA BARRA SOLO SE VIVO, ALTRIMENTI BARRA DEFUNTA */}
              {!isDefeated ? (
                <>
                  <div className={`turn-banner ${turnState.phase}-phase`}>
                    <div className="turn-count">
                      TURNO {turnState.turnNumber}
                    </div>
                    <div className="phase-text">
                      {turnState.phase === "players"
                        ? "🛡️ Turno eroi"
                        : "🔥 Turno Boss"}
                    </div>
                    <div className={`turn-timer ${isUrgent ? "urgent" : ""}`}>
                      <i className="fas fa-hourglass-half"></i>
                      <span>
                        {turnState?.turnType === "players"
                          ? "Tempo Eroi: "
                          : "Tempo Boss: "}
                      </span>
                      <strong>{formatTime(timeLeft)}</strong>
                    </div>

                    {turnState.phase === "players" && !isMaster && (
                      <button
                        className={`btn-end-turn ${turnState.actedPlayers.includes(currentUser.uid) ? "acted" : ""}`}
                        onClick={endMyTurn}
                        disabled={turnState.actedPlayers.includes(
                          currentUser.uid,
                        )}
                      >
                        {turnState.actedPlayers.includes(currentUser.uid)
                          ? "Azione Conclusa"
                          : "Fine Turno"}
                      </button>
                    )}
                  </div>

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
                    {/* BARRA SCUDO (Aggiunta qui) */}
                    {boss.shield > 0 && (
                      <div
                        className="shield-bar-boss-fill"
                        style={{
                          width: `${Math.min(100, (boss.shield / boss.maxHp) * 100)}%`,
                          position: "absolute",
                          top: 0,
                          left: 0,
                          height: "100%",
                          background: "rgba(0, 191, 255, 0.6)", // Blu scudo trasparente
                          borderRight: "2px solid #fff",
                          boxShadow: "0 0 10px #00bfff",
                          zIndex: 2,
                        }}
                      />
                    )}
                  </div>
                </>
              ) : (
                /* BARRA HP DEFUNTA */
                <div className="hp-bar-outer defeated-bar">
                  <div
                    className="hp-bar-inner defeated-fill"
                    style={{ width: "0%" }}
                  >
                    <span className="hp-text-admin" style={{ color: "white" }}>
                      💀
                    </span>
                  </div>
                </div>
              )}

              {/* CONTROLLI MASTER SEMPRE DISPONIBILI */}
              {/* {isMaster && (
                <div className="master-turn-controls">
                  <button onClick={() => togglePhase("players")}>
                    Fase Eroi
                  </button>
                  <button onClick={() => togglePhase("boss")}>Fase Boss</button>
                </div>
              )} */}
              {isMaster && (
                <div
                  className="admin-turn-controls"
                  style={{
                    marginTop: "20px",
                    border: "1px solid var(--gold)",
                    padding: "10px",
                  }}
                >
                  <h3>Gestione Turni</h3>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      justifyContent: "center",
                    }}
                  >
                    <button
                      className="wb-btn-action"
                      style={{ background: "#2ecc71" }}
                      onClick={() => handleManualTurnChange("players")}
                    >
                      Inizia Turno Eroi (3h)
                    </button>

                    <button
                      className="wb-btn-action"
                      style={{ background: "#e74c3c" }}
                      onClick={() => handleManualTurnChange("boss")}
                    >
                      Inizia Turno Boss (1h)
                    </button>
                  </div>
                </div>
              )}
              {/* IMMAGINE CON EFFETTO DEFEATED (Grigia e Strappata via CSS) */}
              <div
                className={`boss-image-container ${isDefeated ? "boss-defeated-visual" : ""}`}
              >
                <img
                  src={boss.imageUrl}
                  alt={boss.name}
                  className="boss-image"
                />
                {isDefeated && <div className="torn-overlay"></div>}
              </div>
            </div>
          );
        })}
      </section>

      <div className="battle-interface">
        {isBossDefeated ? (
          <div className="victory-screen-container">
            <div className="victory-glow-box">
              <h1 className="victory-title">⚔️ VITTORIA! ⚔️</h1>
              <p className="victory-text">
                Il male è stato scacciato. {activeBosses[0]?.name} è caduto
                sotto i colpi degli eroi di Eldoria!
              </p>
              <div className="victory-sub-text">
                La chat e le azioni sono state disattivate per celebrare il
                trionfo.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* CHAT */}
            <section className="chat-section">
              <div className="chat-messages">
                {messages.map((m, index) => (
                  <div
                    key={m.id}
                    className={`msg-bubble ${m.type} ${m.uid === currentUser.uid ? "msg-right" : "msg-left"} ${m.uid === BOSS_SYSTEM_UID ? "is-boss-msg" : ""}`}
                  >
                    <div className="msg-header">
                      <ChatAvatar
                        uid={m.uid}
                        isBoss={m.uid === BOSS_SYSTEM_UID}
                      />
                      <span className="msg-author">{m.senderName}</span>

                      {/* TIMESTAMP AGGIORNATO CON GIORNO E MESE */}
                      {m.timestamp && (
                        <span className="msg-timestamp">
                          {new Date(m.timestamp.seconds * 1000).toLocaleString(
                            "it-IT",
                            {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      )}

                      {isMaster && (
                        <button
                          className="btn-delete-msg"
                          onClick={() => handleDeleteMessage(m.id)}
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

                        {/* PRIVACY: Solo il Master vede i dettagli dei tiri del Boss */}
                        {((m.uid === BOSS_SYSTEM_UID && isMaster) ||
                          m.uid !== BOSS_SYSTEM_UID) && (
                          <div className="rolls-box">
                            {m.hitRoll && <span>{m.hitRoll}</span>}
                            {m.damageRoll && <span>{m.damageRoll}</span>}

                            {/* Visualizzazione dettagli individuali per il Master */}
                            {m.masterDetails &&
                              m.masterDetails.map((res, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    fontSize: "0.75rem",
                                    display: "block",
                                    width: "100%",
                                  }}
                                >
                                  • {res.name}:{" "}
                                  {res.hit
                                    ? `✅ COLPITO (${res.roll}) -> ${res.dmg} HP`
                                    : `🛡️ MANCATO (${res.roll})`}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="msg-text">{m.content}</p>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form
                className="chat-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim()) {
                    addDoc(collection(db, "world_boss_chat"), {
                      type: "narrative",
                      senderName: charData.name,
                      content: text,
                      uid: currentUser.uid,
                      timestamp: serverTimestamp(),
                    });
                    setText("");
                  }
                }}
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Narra la mossa..."
                  disabled={isUserLocked}
                />
                <button type="submit" disabled={isUserLocked} className="send">
                  Invia
                </button>
              </form>
            </section>

            {/* SIDEBAR AZIONI */}
            <section
              className={`player-actions-sidebar ${isUserLocked ? "locked-sidebar" : ""}`}
            >
              {isMaster ? (
                <div className="admin-battle-controls">
                  <h3 className="sidebar-title">Master Dashboard</h3>
                  {/* NUOVO CONTATORE AZIONI */}
                  <div
                    className="acted-players-counter"
                    style={{
                      textAlign: "center",
                      padding: "5px",
                      background: "#333",
                      color: "#fff",
                      borderRadius: "4px",
                      marginBottom: "10px",
                      fontSize: "0.8rem",
                      border: "1px solid var(--gold)",
                    }}
                  >
                    ⚔️ Eroi che hanno agito:{" "}
                    <strong>
                      {turnState.actedPlayers.length} / {players.length}
                    </strong>
                  </div>
                  {/* Controlli Master: Seleziona Tutti, Cura, Monitor HP */}
                  <div className="master-player-controls">
                    <div
                      className="selection-buttons-row"
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginBottom: "10px",
                      }}
                    >
                      <button
                        className="btn-select-all"
                        onClick={toggleSelectAll}
                      >
                        {selectedTargets.length === players.length
                          ? "🚫 Deseleziona"
                          : "🎯 Seleziona Tutti"}
                      </button>
                      <button className="btn-heal-all" onClick={healAllPlayers}>
                        💖 Full HP
                      </button>
                    </div>
                  </div>

                  <div className="party-status-monitor">
                    <h4>Bersagli Boss (Clicca per selezionare)</h4>
                    {players.map((p) => {
                      // Verifica se il giocatore ha già agito nel turno corrente
                      const hasActed = turnState?.actedPlayers?.includes(p.id);

                      return (
                        <div
                          key={p.id}
                          className="player-hp-control-group"
                          style={{ marginBottom: "15px" }}
                        >
                          <div
                            className={`player-hp-row selector ${selectedTargets.includes(p.id) ? "selected" : ""}`}
                            onClick={() => toggleTarget(p.id)}
                            style={{
                              // Se ha agito, diventa rosso scuro, altrimenti mantiene lo stile originale
                              backgroundColor: hasActed ? "#7a5555" : "",
                              transition: "background-color 0.3s ease",
                            }}
                          >
                            <span className="p-name">
                              {p.name?.split(" ")[0]}
                            </span>
                            <div className="hp-bar-mini-container">
                              {/* Barra HP Reale */}
                              <div
                                className="hp-bar-mini-fill"
                                style={{
                                  width: `${(p.stats?.hp / p.stats?.maxHp) * 100}%`,
                                }}
                              />
                              {/* BARRA SCUDO (Overlay Azzurro) */}
                              {p.stats?.shield > 0 && (
                                <div
                                  className="shield-bar-mini-fill"
                                  style={{
                                    width: `${Math.min(100, (p.stats.shield / p.stats.maxHp) * 100)}%`,
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    height: "100%",
                                    background: "rgba(0, 191, 255, 0.6)",
                                    borderRight: "2px solid white",
                                  }}
                                />
                              )}
                              <span className="hp-text-overlay">
                                {p.stats?.hp}
                                {p.stats?.shield > 0
                                  ? ` (+${p.stats.shield})`
                                  : ""}{" "}
                                / {p.stats?.maxHp}
                              </span>
                            </div>
                          </div>

                          {/* Tasti Rapidi per il Master */}
                          <div
                            className="master-quick-actions"
                            style={{
                              display: "flex",
                              gap: "5px",
                              marginTop: "5px",
                            }}
                          >
                            <button
                              className="btn-hp plus"
                              onClick={(e) => {
                                e.stopPropagation();
                                damagePlayerManual(p.id, 1);
                              }}
                            >
                              +1
                            </button>
                            <button
                              className="btn-hp plus"
                              onClick={(e) => {
                                e.stopPropagation();
                                damagePlayerManual(p.id, 3);
                              }}
                            >
                              +3
                            </button>

                            <button
                              className="btn-hp shield"
                              onClick={(e) => {
                                e.stopPropagation();
                                const val = prompt("Quanti HP di scudo?");
                                if (val)
                                  updateDoc(doc(db, "characters", p.id), {
                                    "stats.shield": increment(parseInt(val)),
                                  });
                              }}
                              style={{ background: "#00bfff", color: "white" }}
                            >
                              🛡️ Scudo
                            </button>

                            {/* TASTO SVUOTA SCUDO */}
                            {p.stats?.shield > 0 && (
                              <button
                                className="btn-hp clear-shield"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateDoc(doc(db, "characters", p.id), {
                                    "stats.shield": 0,
                                  });
                                }}
                                title="Rimuovi Scudo"
                                style={{
                                  background: "#ff4444",
                                  color: "white",
                                  padding: "2px 10px",
                                  fontWeight: "bold",
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="boss-actions-monitor">
                    <h4>Azioni Boss</h4>
                    {activeBosses[0] && (
                      <>
                        <div className="wb-action-list">
                          <button
                            className="wb-btn-action boss-atk"
                            onClick={() =>
                              handleBossRoll(
                                activeBosses[0],
                                activeBosses[0].action1,
                              )
                            }
                          >
                            ⚔️ {activeBosses[0].action1.name} (
                            {activeBosses[0].action1.damage})
                          </button>
                          <button
                            className="wb-btn-action boss-atk"
                            onClick={() =>
                              handleBossRoll(
                                activeBosses[0],
                                activeBosses[0].action2,
                              )
                            }
                          >
                            🔥 {activeBosses[0].action2.name} (
                            {activeBosses[0].action2.damage})
                          </button>
                        </div>

                        {/* NUOVI CONTROLLI RIGENERAZIONE BOSS */}
                        <h4
                          style={{
                            marginTop: "15px",
                            borderTop: "1px dashed #666",
                            paddingTop: "10px",
                          }}
                        >
                          Gestione Boss
                        </h4>
                        <div
                          className="boss-management-btns"
                          style={{
                            display: "flex",
                            gap: "5px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => healBossManual(5)}
                            style={{
                              background: "#27ae60",
                              color: "white",
                              flex: 1,
                              padding: "5px",
                              fontSize: "0.7rem",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            Cura +5
                          </button>
                          <button
                            onClick={() => healBossManual(10)}
                            style={{
                              background: "#2ecc71",
                              color: "white",
                              flex: 1,
                              padding: "5px",
                              fontSize: "0.7rem",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            Cura +10
                          </button>
                          <button
                            onClick={shieldBossManual}
                            style={{
                              background: "#00bfff",
                              color: "white",
                              flex: 1,
                              padding: "5px",
                              fontSize: "0.7rem",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            🛡️ Scudo
                          </button>
                          {activeBosses[0].shield > 0 && (
                            <button
                              onClick={() =>
                                updateDoc(
                                  doc(db, "bosses", activeBosses[0].id),
                                  { shield: 0 },
                                )
                              }
                              style={{
                                background: "#ff4444",
                                color: "white",
                                padding: "5px 10px",
                                fontSize: "0.7rem",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="personal-health-monitor">
                    <p>
                      Tua Salute: {charData?.stats?.hp}/{charData?.stats?.maxHp}
                    </p>
                    <div className="hp-bar-mini-container">
                      <div
                        className="hp-bar-mini-fill"
                        style={{
                          width: `${(charData?.stats?.hp / charData?.stats?.maxHp) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className="saving-throws-panel"
                    style={{
                      margin: "10px 0",
                      padding: "10px",
                      background: "rgba(0,0,0,0.05)",
                      borderRadius: "8px",
                      border: "1px solid gold",
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "0.8rem",
                        color: "#8b0000",
                        marginBottom: "8px",
                        textAlign: "center",
                        borderBottom: "1px solid #8b0000",
                      }}
                    >
                      Tiri Salvezza
                    </h4>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "5px",
                      }}
                    >
                      {["str", "dex", "cos", "int", "wis", "cha"].map((s) => (
                        <button
                          key={s}
                          disabled={isUserLocked || !charData}
                          onClick={() => handleSavingThrow(s)}
                          style={{
                            fontSize: "0.7rem",
                            padding: "5px",
                            cursor: "pointer",
                            background: "white",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                          }}
                        >
                          {s.toUpperCase()} (
                          {charData?.stats?.[s] >= 0 ? "+" : ""}
                          {charData?.stats?.[s] ?? 0})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    className="damage-dice-panel"
                    style={{
                      marginTop: "10px",
                      padding: "10px",
                      background: "rgba(139,0,0,0.1)",
                      borderRadius: "8px",
                      border: "1px solid #ff4444",
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "0.8rem",
                        color: "#ff4444",
                        marginBottom: "8px",
                        textAlign: "center",
                      }}
                    >
                      Danni & Caratteristica
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        marginBottom: "10px",
                      }}
                    >
                      <select
                        value={dmgDiceCount}
                        onChange={(e) =>
                          setDmgDiceCount(parseInt(e.target.value))
                        }
                        style={{ flex: 1, fontSize: "0.7rem" }}
                      >
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            {n}d
                          </option>
                        ))}
                      </select>
                      <select
                        value={dmgSelectedStat || ""}
                        onChange={(e) =>
                          setDmgSelectedStat(e.target.value || null)
                        }
                        style={{ flex: 2, fontSize: "0.7rem" }}
                      >
                        <option value="">No Bonus</option>
                        {["str", "dex", "cos", "int", "wis", "cha"].map((s) => (
                          <option key={s} value={s}>
                            {s.toUpperCase()} (+{charData?.stats?.[s] ?? 0})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, 1fr)",
                        gap: "5px",
                      }}
                    >
                      {["d4", "d6", "d8", "d10", "d12"].map((die) => (
                        <button
                          key={die}
                          disabled={isUserLocked}
                          onClick={() => handleManualDamageToBoss(die)}
                          className="die-btn"
                        >
                          {die}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    className="accordion-container"
                    style={{ marginTop: "15px" }}
                  >
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
                                disabled={isUserLocked}
                              >
                                {action.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function ChatAvatar({ uid, isBoss }) {
  const [avatarUrl, setAvatarUrl] = useState(null);
  useEffect(() => {
    if (isBoss) return;
    const unsub = onSnapshot(doc(db, "characters", uid), (snap) => {
      if (snap.exists()) setAvatarUrl(snap.data().image);
    });
    return () => unsub();
  }, [uid, isBoss]);

  if (isBoss) return <div className="boss-chat-icon">👹</div>;
  if (!avatarUrl) return <div className="avatar-placeholder" />;
  return <img src={avatarUrl} alt="Avatar" className="chat-avatar-img" />;
}
