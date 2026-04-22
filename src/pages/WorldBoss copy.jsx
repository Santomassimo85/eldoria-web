import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
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
  runTransaction,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./WorldBoss.css";
import TimerDisplay from "../components/TimerDisplay";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const BOSS_SYSTEM_UID = "BOSS_MSG";

const PLAYER_TURN_DURATION = 3 * 60 * 60 * 1000; // 3 Ore
const BOSS_TURN_DURATION = 1 * 60 * 60 * 1000; // 1 Ora

export default function WorldBoss() {
  const { currentUser } = useAuth();
  const [charData, setCharData] = useState(null);
  const [activeBosses, setActiveBosses] = useState([]);
  const [messages, setMessages] = useState([]);
  const [players, setPlayers] = useState([]);
  const [text, setText] = useState("");
  const [openSections, setOpenSections] = useState({ Armi: true });
  const [selectedTargets, setSelectedTargets] = useState([]); // Stato per selezione bersagli Master
  const [dmgDiceCount, setDmgDiceCount] = useState(1); // Numero di dadi (default 1)
  const [dmgSelectedStat, setDmgSelectedStat] = useState(null); // Caratteristica per il danno

  const [turnState, setTurnState] = useState({
    phase: "players",
    turnNumber: 1,
    actedPlayers: [],
    fightStarted: false,
  });

  const fightStarted = turnState.fightStarted === true;

  // --- 1. LOGICHE DI STATO (Da mettere dopo gli useState) ---
  const isBossDefeated = useMemo(() => {
    return activeBosses.length > 0 && activeBosses[0].hp <= 0;
  }, [activeBosses]);

  // Controlliamo se la data di scadenza del boss è passata
  const isTimeExpired = useMemo(() => {
    if (activeBosses.length === 0 || !activeBosses[0].expiryDate) return false;
    const now = new Date().getTime();
    const expiry = new Date(activeBosses[0].expiryDate).getTime();
    return now >= expiry && activeBosses[0].hp > 0;
  }, [activeBosses, Date.now()]); // Date.now() qui è indicativo, il memo si aggiornerà al cambio boss

  // isBossDefeated e isTimeExpired coprono insieme tutti i casi di fine battaglia
  const chatEndRef = useRef(null);
  const isMaster = useMemo(
    () => currentUser?.email === MASTER_EMAIL,
    [currentUser],
  );

  const [timeLeft, setTimeLeft] = useState(0);
  const [isUrgent, setIsUrgent] = useState(false);
  const lastAutoFireRef = useRef(0);

  const handleManualTurnChange = async (newPhase) => {
    if (!isMaster) return;

    // Impostiamo le nuove durate: 1 minuto per eroi, 30 secondi per boss
    const duration = newPhase === "players" ? PLAYER_TURN_DURATION : BOSS_TURN_DURATION;
    // CREIAMO UNA NUOVA DATA DI SCADENZA REALE
    const newExpiry = new Date(Date.now() + duration);

    const turnMsg =
      newPhase === "players"
        ? "🛡️ TURNO DEGLI EROI: È il momento di colpire!"
        : "🔥 TURNO DEL BOSS: Preparate le difese!";

    try {
      const turnRef = doc(db, "battle_meta", "turn_tracker");
      await updateDoc(turnRef, {
        phase: newPhase,
        expiryDate: newExpiry, // QUESTO AGGIORNA IL TIMER SUL DB
        actedPlayers: [],
        turnNumber:
          newPhase === "players" ? increment(1) : turnState.turnNumber,
      });

      await addDoc(collection(db, "world_boss_chat"), {
        text: turnMsg,
        senderName: "Master System",
        uid: BOSS_SYSTEM_UID,
        content: turnMsg,
        category: "Turno",
        timestamp: serverTimestamp(),
        isSystem: true,
      });
    } catch (e) {
      console.error("Errore cambio turno:", e);
    }
  };

  const handleAutoTurnChange = useCallback(async () => {
    if (!turnState?.expiryDate) return;

    try {
      const turnRef = doc(db, "battle_meta", "turn_tracker");
      let didSwitch = false;
      let newPhaseName = "";

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(turnRef);
        if (!snap.exists()) return;

        const data = snap.data();

        // Dedup: skip if another client already switched in the last 10 seconds
        if (data.lastSwitchedAt) {
          const lastMs = data.lastSwitchedAt.toMillis
            ? data.lastSwitchedAt.toMillis()
            : new Date(data.lastSwitchedAt).getTime();
          if (Date.now() - lastMs < 10000) return;
        }

        // Skip if phase already changed by another client
        if (data.phase !== turnState.phase) return;

        newPhaseName = data.phase === "players" ? "boss" : "players";
        const duration =
          newPhaseName === "players" ? PLAYER_TURN_DURATION : BOSS_TURN_DURATION;
        const newExpiry = new Date(Date.now() + duration);

        transaction.update(turnRef, {
          phase: newPhaseName,
          expiryDate: newExpiry,
          actedPlayers: [],
          turnNumber:
            newPhaseName === "players"
              ? (data.turnNumber || 0) + 1
              : data.turnNumber,
          lastSwitchedAt: serverTimestamp(),
        });

        didSwitch = true;
      });

      if (didSwitch) {
        const turnMsg =
          newPhaseName === "boss"
            ? "⚠️ TEMPO SCADUTO! Il Boss entra in azione!"
            : "🛡️ IL BOSS tace... Eroi, tocca a voi!";

        await addDoc(collection(db, "world_boss_chat"), {
          text: turnMsg,
          senderName: "SISTEMA",
          uid: BOSS_SYSTEM_UID,
          content: turnMsg,
          category: "Turno",
          timestamp: serverTimestamp(),
          isSystem: true,
        });
      }
    } catch (e) {
      console.error("Errore switch automatico:", e);
    }
  }, [turnState.phase, turnState.turnNumber, turnState?.expiryDate]);

  useEffect(() => {
    lastAutoFireRef.current = 0;
    if (!turnState?.expiryDate || isBossDefeated || !fightStarted) {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();

      let expiry;
      if (turnState.expiryDate?.toMillis) {
        expiry = turnState.expiryDate.toMillis();
      } else {
        expiry = new Date(turnState.expiryDate).getTime();
      }

      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft(0);
        if (!isBossDefeated) {
          const now2 = Date.now();
          if (now2 - lastAutoFireRef.current > 12000) {
            lastAutoFireRef.current = now2;
            handleAutoTurnChange();
          }
        }
      } else {
        setTimeLeft(diff);
        const totalDuration =
          turnState.phase === "players"
            ? PLAYER_TURN_DURATION
            : BOSS_TURN_DURATION;
        setIsUrgent(diff < totalDuration * 0.1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    turnState?.expiryDate,
    turnState?.phase,
    isMaster,
    isBossDefeated,
    fightStarted,
    handleAutoTurnChange,
  ]);

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
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Notifica VITTORIA (solo Master la invia, una sola volta)
  useEffect(() => {
    if (!isMaster || !isBossDefeated || activeBosses.length === 0) return;
    const boss = activeBosses[0];
    if (boss.victoryNotified) return;

    const notify = async () => {
      await sendBattleNotification(
        "🏆 VITTORIA DEGLI EROI!",
        `Avete sconfitto ${boss.name}! ${
          boss.rewards
            ? "Ricompense: " + boss.rewards
            : "Il Master vi assegnerà le ricompense."
        }`
      );
      await updateDoc(doc(db, "bosses", boss.id), { victoryNotified: true });
    };
    notify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBossDefeated]);

  // Notifica SCONFITTA (solo Master la invia, una sola volta)
  useEffect(() => {
    if (!isMaster || !isTimeExpired || activeBosses.length === 0) return;
    const boss = activeBosses[0];
    if (boss.defeatNotified) return;

    const notify = async () => {
      await sendBattleNotification(
        "💀 SCONFITTA!",
        `${boss.name} ha prevalso! ${
          boss.penalties
            ? "Penalità: " + boss.penalties
            : "Il Master applicherà le conseguenze."
        }`
      );
      await updateDoc(doc(db, "bosses", boss.id), { defeatNotified: true });
    };
    notify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimeExpired]);

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
        shield: newShield,
      });

      // 6. COSTRUZIONE DETTAGLIO CHAT
      let detailString = `${dmgDiceCount}${die} (${rollsDetail.join("+")})`;
      if (statMod !== 0)
        detailString += ` ${statMod > 0 ? "+ " + statMod : statMod}`;
      if (isRogue) detailString += ` + 1d6 Ladro (${sneakDamage})`;

      let shieldNote =
        currentShield > 0 ? ` (Scudo colpito! Rimanente: ${newShield})` : "";

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
        senderName: "Master System",
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

    const isAttack =
      action.category === "Armi" ||
      action.category?.toLowerCase().includes("livello") ||
      action.category === "Trucchetto";
    const d20 = Math.floor(Math.random() * 20) + 1;
    const bonusToHit = parseInt(action.bonus?.replace(/[^0-9+-]/g, "")) || 0;
    const hitTotal = d20 + bonusToHit;
    const isCritical = d20 === 20;

    let actionData = {
      type: "action",
      senderName: charData?.name || "Eroe",
      actionName: action.name + (isCritical ? " (CRITICO!)" : ""),
      timestamp: serverTimestamp(),
      uid: currentUser.uid,
      category: action.category,
      hitRoll: `🎲 d20(${d20}) + bonus(${bonusToHit}) = ${hitTotal} `,
    };

    if (isAttack) {
      if (isCritical || hitTotal >= (boss.ac || 10)) {
        // 1. GESTIONE DINAMICA DI @mod[cite: 1, 14]
        let formulaRaw =
          action.damage && action.damage !== "0" ? action.damage : "1d6";

        // Determiniamo quale modificatore usare per @mod
        // Di base: Armi a distanza o con "Finesse" -> Destrezza (dex), altrimenti Forza (str)
        const isFinesseOrRanged =
          action.name?.toLowerCase().includes("rapier") ||
          action.name?.toLowerCase().includes("arco") ||
          action.name?.toLowerCase().includes("scimitar");

        const modValue = isFinesseOrRanged
          ? charData?.stats?.dex || 0
          : charData?.stats?.str || 0;

        // Sostituiamo @mod con il valore numerico reale
        let cleanFormula = formulaRaw
          .replace(/@mod/g, modValue)
          .replace(/\s+/g, "");

        // 2. ANALISI DEI COMPONENTI (es: "2d6+4+1")
        const parts = cleanFormula.split("+");
        const diePart = parts[0];

        // Sommiamo tutti i bonus numerici rimasti nella formula (es: 4 + 1)
        let staticBonus = 0;
        for (let i = 1; i < parts.length; i++) {
          staticBonus += parseInt(parts[i]) || 0;
        }

        // 3. LANCIO DEI DADI
        const [num, sides] = diePart.split("d").map((n) => parseInt(n) || 1);
        let dieRollTotal = 0;
        let rolls = [];
        for (let i = 0; i < num; i++) {
          const r = Math.floor(Math.random() * sides) + 1;
          dieRollTotal += r;
          rolls.push(r);
        }

        // 4. CALCOLO FINALE[cite: 14]
        let totalDamage = dieRollTotal + staticBonus;
        if (isCritical) totalDamage *= 2;

        let dieDetail = `Dado ${diePart}[${rolls.join("+")}]`;
        let damageString = `🎯 COLPITO! | 🎲 ${dieDetail} ${staticBonus !== 0 ? "+ bonus(" + staticBonus + ")" : ""}`;

        if (isCritical)
          damageString = `🔥 CRITICO! | (${dieRollTotal} + ${staticBonus}) x2`;

        // 5. LOGICA LADRO[cite: 14]
        if (
          charData?.class?.toLowerCase() === "ladro" ||
          charData?.class?.toLowerCase() === "rogue"
        ) {
          const sneak = Math.floor(Math.random() * 6) + 1;
          totalDamage += sneak;
          damageString += ` + 1d6 Furtivo(${sneak})`;
        }

        // 6. APPLICAZIONE AL BOSS[cite: 14]
        const currentShield = boss.shield || 0;
        const currentHp = boss.hp || 0;
        let dmgRem = totalDamage;
        let newShield = currentShield;
        let newHp = currentHp;

        if (currentShield > 0) {
          if (currentShield >= dmgRem) {
            newShield -= dmgRem;
            dmgRem = 0;
          } else {
            dmgRem -= currentShield;
            newShield = 0;
            newHp = Math.max(0, currentHp - dmgRem);
          }
        } else {
          newHp = Math.max(0, currentHp - dmgRem);
        }

        await updateDoc(doc(db, "bosses", boss.id), {
          hp: newHp,
          shield: newShield,
        });

        actionData.damageRoll = `${damageString} = 💥 ${totalDamage} DANNI!`;
        if (newShield < currentShield)
          actionData.damageRoll += " 🛡️ Scudo colpito!";
      } else {
        actionData.damageRoll = "🛡️ MANCATO! Il colpo non incide.";
      }

      await addDoc(collection(db, "world_boss_chat"), actionData);
      await endMyTurn();
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

  // Invia notifica a TUTTI i personaggi nel DB
  const sendBattleNotification = async (title, message) => {
    try {
      const charsSnap = await getDocs(collection(db, "characters"));
      const batch = writeBatch(db);
      charsSnap.docs.forEach((charDoc) => {
        const notifyRef = doc(collection(db, "notifications"));
        batch.set(notifyRef, {
          userId: charDoc.id,
          title,
          message,
          read: false,
          timestamp: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (e) {
      console.error("Errore invio notifica battaglia:", e);
    }
  };

  // Master: avvia ufficialmente la battaglia (players sempre per primi)
  const handleStartFight = async () => {
    if (!isMaster) return;
    const boss = activeBosses[0];
    if (!boss) return;

    const newExpiry = new Date(Date.now() + PLAYER_TURN_DURATION);

    try {
      const turnRef = doc(db, "battle_meta", "turn_tracker");
      await updateDoc(turnRef, {
        fightStarted: true,
        phase: "players",
        expiryDate: newExpiry,
        actedPlayers: [],
        turnNumber: 1,
        lastSwitchedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "world_boss_chat"), {
        text: `⚔️ LA BATTAGLIA HA INIZIO! ${boss.name} vi sfida! Eroi, è il vostro momento!`,
        senderName: "Master System",
        uid: BOSS_SYSTEM_UID,
        content: `⚔️ LA BATTAGLIA HA INIZIO! ${boss.name} vi sfida! Eroi, è il vostro momento!`,
        category: "Sistema",
        timestamp: serverTimestamp(),
        isSystem: true,
      });

      await sendBattleNotification(
        "⚔️ LA BATTAGLIA INIZIA!",
        `Il Master ha dato inizio allo scontro con ${boss.name}! Entrate immediatamente in BossFight!`
      );
    } catch (e) {
      console.error("Errore avvio battaglia:", e);
    }
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
    (!fightStarted ||
      turnState.phase === "boss" ||
      turnState.actedPlayers.includes(currentUser?.uid));

  if (!currentUser)
    return <div className="denied-msg">Loggati per entrare.</div>;

  return (
    <div className="wb-container">

      {/* Top bar: nota importante + DM controls */}
      <div className="wb-topbar">
        <p className="wb-note">⚔️ Almeno 2 attacchi per ricevere ricompense</p>
        {isMaster && (
          <div className="wb-dm-bar">
            <span className="dm-overlay-label">DM</span>
            <button onClick={clearChat} className="dm-clear-button">Pulisci Chat</button>
          </div>
        )}
      </div>

      {/* AREA BOSS */}
      <section className="boss-area">
        {activeBosses.length === 0 && (
          <div className="wb-no-boss">Nessun boss attivo al momento.</div>
        )}

        {activeBosses.map((boss) => {
          const isGameOver = isBossDefeated || isTimeExpired;

          return (
            <div key={boss.id} className={`boss-card ${isGameOver ? "boss-card--over" : ""} ${isBossDefeated ? "boss-card--victory" : ""} ${isTimeExpired ? "boss-card--defeat" : ""}`}>

              {/* ---- GAMEOVER BANNERS ---- */}
              {isBossDefeated && (
                <div className="wb-banner wb-banner--victory">
                  🏆 VITTORIA DEGLI EROI 🏆
                </div>
              )}
              {isTimeExpired && (
                <div className="wb-banner wb-banner--defeat">
                  💀 IL BOSS HA PREVALSO 💀
                </div>
              )}

              {/* ---- BOSS INFO: image left, details right ---- */}
              <div className="wb-boss-layout">

                {/* Left col: image */}
                <div className="wb-boss-img-col">
                  <div className={`boss-image-container ${isGameOver ? "boss-defeated-visual" : ""}`}>
                    <img
                      src={boss.imageUrl || "/assets/default-boss.png"}
                      alt={boss.name}
                      className={`boss-image ${isBossDefeated ? "boss-image-grayscale" : ""}`}
                    />
                    {isBossDefeated && <div className="torn-overlay" />}
                  </div>
                </div>

                {/* Right col: name, HP, turn info, controls */}
                <div className="wb-boss-info-col">
                  <h2 className="boss-name">{boss.name}</h2>

                  {boss.description && (
                    <p className="boss-flavor-text">{boss.description}</p>
                  )}

                  {/* HP Bar */}
                  <div className="wb-hp-section">
                    <div className="wb-hp-labels">
                      <span>HP</span>
                      {isMaster && <span className="wb-hp-numbers">{boss.hp} / {boss.maxHp}</span>}
                    </div>
                    <div className="hp-bar-outer">
                      <div
                        className="hp-bar-inner"
                        style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }}
                      />
                      {boss.shield > 0 && (
                        <div
                          className="shield-bar-boss-fill"
                          style={{
                            width: `${Math.min(100, (boss.shield / boss.maxHp) * 100)}%`,
                            position: "absolute", top: 0, left: 0,
                            height: "100%", background: "rgba(0,191,255,0.5)", zIndex: 2,
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Penalties / Rewards */}
                  <div className="wb-stakes">
                    {!isBossDefeated && boss.penalties && (
                      <div className="wb-stake wb-stake--penalty">
                        <span className="wb-stake-label">💀 Penalità</span>
                        <span className="wb-stake-text">{boss.penalties}</span>
                      </div>
                    )}
                    {!isTimeExpired && boss.rewards && (
                      <div className="wb-stake wb-stake--reward">
                        <span className="wb-stake-label">🏆 Bottino</span>
                        <span className="wb-stake-text">{boss.rewards}</span>
                      </div>
                    )}
                  </div>

                  {/* Pre-fight: start button or waiting */}
                  {isMaster && !fightStarted && !isGameOver && (
                    <div className="wb-prefight">
                      <button className="btn-start-fight" onClick={handleStartFight}>
                        ⚔️ Inizia Battaglia
                      </button>
                      <p className="start-fight-hint">Scrivi prima in chat, poi avvia</p>
                    </div>
                  )}
                  {!isMaster && !fightStarted && !isGameOver && (
                    <div className="waiting-for-fight">
                      <span className="waiting-icon">⏳</span>
                      In attesa che il Master avvii la battaglia…
                    </div>
                  )}

                  {/* Fight active: event timer + turn banner */}
                  {fightStarted && !isGameOver && (
                    <div className="wb-fight-status">
                      <div className="wb-event-timer">
                        <span className="wb-event-label">Scadenza evento:</span>
                        <TimerDisplay expiryDate={boss.expiryDate} />
                      </div>

                      <div className={`turn-banner ${turnState.phase}-phase`}>
                        <span className="turn-count">Turno {turnState.turnNumber}</span>
                        <span className="phase-text">
                          {turnState.phase === "players" ? "🛡️ Eroi" : "🔥 Boss"}
                        </span>
                        <span className={`turn-timer ${isUrgent ? "urgent" : ""}`}>
                          {formatTime(timeLeft)}
                        </span>
                        {turnState.phase === "players" && !isMaster && (
                          <button
                            className={`btn-end-turn ${turnState.actedPlayers.includes(currentUser.uid) ? "acted" : ""}`}
                            onClick={endMyTurn}
                            disabled={turnState.actedPlayers.includes(currentUser.uid)}
                          >
                            {turnState.actedPlayers.includes(currentUser.uid) ? "✓ Azione fatta" : "Fine Turno"}
                          </button>
                        )}
                      </div>

                      {/* Master: change turn buttons */}
                      {isMaster && (
                        <div className="wb-turn-controls">
                          <button className="btn-turn-players" onClick={() => handleManualTurnChange("players")}>
                            🛡️ Turno Eroi
                          </button>
                          <button className="btn-turn-boss" onClick={() => handleManualTurnChange("boss")}>
                            🔥 Turno Boss
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Gameover master: turn controls still accessible */}
                  {isMaster && isGameOver && fightStarted && (
                    <div className="wb-turn-controls">
                      <button className="btn-turn-players" onClick={() => handleManualTurnChange("players")}>🛡️ Turno Eroi</button>
                      <button className="btn-turn-boss" onClick={() => handleManualTurnChange("boss")}>🔥 Turno Boss</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Interfaccia battaglia: master la vede sempre (chat pre-fight), player solo dopo l'inizio */}
      {(isMaster || fightStarted) && (
      <div className="battle-interface">
        {/* FINE BATTAGLIA: mostra risultato completo con immagine, descrizione e penalità/ricompense */}
        {(isBossDefeated || isTimeExpired) && !isMaster ? (
          <div className="end-game-screen"></div>
        ) : (
          <>
            {/* SEZIONE CHAT */}
            <section className="chat-section">
              <div className="chat-messages">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`msg-bubble ${m.type} ${m.uid === currentUser.uid ? "msg-right" : "msg-left"} ${m.isSystem ? "system-msg" : ""}`}
                  >
                    <div className="msg-header">
                      <ChatAvatar
                        uid={m.uid}
                        isBoss={m.uid === BOSS_SYSTEM_UID}
                      />
                      <span className="msg-author">{m.senderName}</span>
                      {m.timestamp && (
                        <span className="msg-timestamp">
                          {(() => {
                            const d = new Date(m.timestamp.seconds * 1000);
                            const day = d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
                            const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                            return `${day} · ${time}`;
                          })()}
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

                        {/* Dettagli tiri (Visibili a tutti se player, solo master se boss) */}
                        {((m.uid === BOSS_SYSTEM_UID && isMaster) ||
                          m.uid !== BOSS_SYSTEM_UID) && (
                          <div className="rolls-box">
                            {m.hitRoll && (
                              <span className="hit-res">{m.hitRoll}</span>
                            )}
                            {m.damageRoll && (
                              <span className="dmg-res">{m.damageRoll}</span>
                            )}

                            {isMaster &&
                              m.masterDetails?.map((res, idx) => (
                                <div key={idx} className="master-detail-line">
                                  • {res.name}:{" "}
                                  {res.hit ? `✅ ${res.dmg} HP` : `🛡️ Miss`} (
                                  {res.roll})
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
                <button type="submit" disabled={isUserLocked}>
                  Invia
                </button>
              </form>
            </section>

            {/* SIDEBAR AZIONI */}
            <section
              className={`player-actions-sidebar ${isUserLocked ? "is-locked" : ""}`}
            >
              {/* DASHBOARD MASTER */}
              {isMaster && (
                <div className="admin-controls">
                  <h3 className="sidebar-title">Master Dashboard</h3>

                  <div className="acted-counter">
                    ⚔️ Azioni: {turnState.actedPlayers.length} /{" "}
                    {players.length}
                  </div>

                  <div className="master-buttons-group">
                    <button onClick={toggleSelectAll}>
                      {selectedTargets.length === players.length
                        ? "🚫 Deseleziona"
                        : "🎯 Seleziona Tutti"}
                    </button>
                    <button onClick={healAllPlayers}>💖 Full HP</button>
                  </div>

                  <div className="target-list">
                    {players.map((p) => (
                      <div key={p.id} className="target-item-container">
                        <div
                          className={`target-selector ${selectedTargets.includes(p.id) ? "is-selected" : ""} ${turnState?.actedPlayers?.includes(p.id) ? "has-acted" : ""}`}
                          onClick={() => toggleTarget(p.id)}
                        >
                          <span className="target-name">
                            {p.name?.split(" ")[0]}
                          </span>
                          <div className="target-hp-bar">
                            <div
                              className="hp-fill"
                              style={{
                                width: `${(p.stats?.hp / p.stats?.maxHp) * 100}%`,
                              }}
                            />
                            {p.stats?.shield > 0 && (
                              <div
                                className="shield-fill"
                                style={{
                                  width: `${Math.min(100, (p.stats.shield / p.stats.maxHp) * 100)}%`,
                                }}
                              />
                            )}
                          </div>
                        </div>

                        <div className="quick-hp-btns">
                          <button onClick={() => damagePlayerManual(p.id, 1)}>
                            +1
                          </button>
                          <button onClick={() => damagePlayerManual(p.id, 3)}>
                            +3
                          </button>
                          <button
                            onClick={() => {
                              const val = prompt("HP Scudo?");
                              if (val)
                                updateDoc(doc(db, "characters", p.id), {
                                  "stats.shield": increment(parseInt(val)),
                                });
                            }}
                          >
                            🛡️
                          </button>
                          {p.stats?.shield > 0 && (
                            <button
                              onClick={() =>
                                updateDoc(doc(db, "characters", p.id), {
                                  "stats.shield": 0,
                                })
                              }
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="boss-admin-actions">
                    <h4>Attacchi Boss</h4>
                    <button
                      onClick={() =>
                        handleBossRoll(activeBosses[0], activeBosses[0].action1)
                      }
                    >
                      {activeBosses[0]?.action1.name}
                    </button>
                    <button
                      onClick={() =>
                        handleBossRoll(activeBosses[0], activeBosses[0].action2)
                      }
                    >
                      {activeBosses[0]?.action2.name}
                    </button>

                    <h4>Gestione Boss</h4>
                    <div className="boss-heal-btns">
                      <button onClick={() => healBossManual(5)}>Cura +5</button>
                      <button onClick={() => healBossManual(10)}>
                        Cura +10
                      </button>
                      <button onClick={shieldBossManual}>🛡️ Scudo</button>
                    </div>
                  </div>
                </div>
              )}

              {/* INTERFACCIA PLAYER (Azioni e Tiri Salvezza) */}
              {!isMaster && (
                <div className="player-controls">
                  <div className="player-health-status">
                    <span>
                      HP: {charData?.stats?.hp}/{charData?.stats?.maxHp}
                    </span>
                    <div className="player-hp-bar">
                      <div
                        className="fill"
                        style={{
                          width: `${(charData?.stats?.hp / charData?.stats?.maxHp) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="saving-throws-grid">
                    {["str", "dex", "cos", "int", "wis", "cha"].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSavingThrow(s)}
                        disabled={isUserLocked}
                      >
                        {s.toUpperCase()} (
                        {charData?.stats?.[s] >= 0 ? "+" : ""}
                        {charData?.stats?.[s] ?? 0})
                      </button>
                    ))}
                  </div>

                  <div className="manual-dmg-control">
                    <select
                      value={dmgDiceCount}
                      onChange={(e) =>
                        setDmgDiceCount(parseInt(e.target.value))
                      }
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
                    >
                      <option value="">No Bonus</option>
                      {["str", "dex", "cos", "int", "wis", "cha"].map((s) => (
                        <option key={s} value={s}>
                          {s.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <div className="dice-btns">
                      {["d4", "d6", "d8", "d10", "d12"].map((die) => (
                        <button
                          key={die}
                          onClick={() => handleManualDamageToBoss(die)}
                          disabled={isUserLocked}
                        >
                          {die}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="actions-accordion">
                    {sortedCategories.map((cat) => (
                      <div key={cat} className="acc-item">
                        <button
                          className="acc-trigger"
                          onClick={() =>
                            setOpenSections((p) => ({ ...p, [cat]: !p[cat] }))
                          }
                        >
                          {cat} {openSections[cat] ? "▲" : "▼"}
                        </button>
                        {openSections[cat] && (
                          <div className="acc-content">
                            {groupedActions[cat].map((action, idx) => (
                              <button
                                key={idx}
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
                </div>
              )}
            </section>
          </>
        )}
      </div>
      )}
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
