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
import { VfxLayer, pickEffectForAction } from "./WorldBossVfx";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const BOSS_SYSTEM_UID = "BOSS_MSG";

const PLAYER_TURN_DURATION = 3 * 60 * 60 * 1000;
const BOSS_TURN_DURATION = 1 * 60 * 60 * 1000;

export default function WorldBoss() {
  const { currentUser } = useAuth();
  const [charData, setCharData] = useState(null);
  const [activeBosses, setActiveBosses] = useState([]);
  const [messages, setMessages] = useState([]);
  const [players, setPlayers] = useState([]);
  const [text, setText] = useState("");
  const [openSections, setOpenSections] = useState({ Armi: true });
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [dmgDiceCount, setDmgDiceCount] = useState(1);
  const [dmgSelectedStat, setDmgSelectedStat] = useState(null);
  const [battleBg, setBattleBg] = useState(null);
  const [partyZoneHeight, setPartyZoneHeight] = useState(0);
  const partyZoneRef = useRef(null);
  const [mobileTab, setMobileTab] = useState("status");
  const [playersOpen, setPlayersOpen] = useState(true);
  const [playerActionMode, setPlayerActionMode] = useState("saves");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  const [turnState, setTurnState] = useState({
    phase: "players",
    turnNumber: 1,
    actedPlayers: [],
    fightStarted: false,
  });

  const fightStarted = turnState.fightStarted === true;

  const isBossDefeated = useMemo(() => {
    return activeBosses.length > 0 && activeBosses[0].hp <= 0;
  }, [activeBosses]);

  const areAllPlayersDead = useMemo(() => {
    if (!players.length) return false;
    return players.every((p) => (p.stats?.hp ?? 0) <= 0);
  }, [players]);

  const isFightOver = isBossDefeated || areAllPlayersDead;

  const isTimeExpired = useMemo(() => {
    if (activeBosses.length === 0 || !activeBosses[0].expiryDate) return false;
    const now = new Date().getTime();
    const expiry = new Date(activeBosses[0].expiryDate).getTime();
    return now >= expiry && activeBosses[0].hp > 0;
  }, [activeBosses]);

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
    const duration = newPhase === "players" ? PLAYER_TURN_DURATION : BOSS_TURN_DURATION;
    const newExpiry = new Date(Date.now() + duration);
    const turnMsg =
      newPhase === "players"
        ? "🛡️ TURNO DEGLI EROI: È il momento di colpire!"
        : "🔥 TURNO DEL BOSS: Preparate le difese!";
    try {
      const turnRef = doc(db, "battle_meta", "turn_tracker");
      await updateDoc(turnRef, {
        phase: newPhase,
        expiryDate: newExpiry,
        actedPlayers: [],
        turnNumber: newPhase === "players" ? increment(1) : turnState.turnNumber,
      });
      await addDoc(collection(db, "world_boss_chat"), {
        text: turnMsg, senderName: "Master System", uid: BOSS_SYSTEM_UID,
        content: turnMsg, category: "Turno", timestamp: serverTimestamp(), isSystem: true,
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
        if (data.lastSwitchedAt) {
          const lastMs = data.lastSwitchedAt.toMillis
            ? data.lastSwitchedAt.toMillis()
            : new Date(data.lastSwitchedAt).getTime();
          if (Date.now() - lastMs < 10000) return;
        }
        if (data.phase !== turnState.phase) return;
        newPhaseName = data.phase === "players" ? "boss" : "players";
        const duration = newPhaseName === "players" ? PLAYER_TURN_DURATION : BOSS_TURN_DURATION;
        const newExpiry = new Date(Date.now() + duration);
        transaction.update(turnRef, {
          phase: newPhaseName, expiryDate: newExpiry, actedPlayers: [],
          turnNumber: newPhaseName === "players" ? (data.turnNumber || 0) + 1 : data.turnNumber,
          lastSwitchedAt: serverTimestamp(),
        });
        didSwitch = true;
      });
      if (didSwitch) {
        const turnMsg = newPhaseName === "boss"
          ? "⚠️ TEMPO SCADUTO! Il Boss entra in azione!"
          : "🛡️ IL BOSS tace... Eroi, tocca a voi!";
        await addDoc(collection(db, "world_boss_chat"), {
          text: turnMsg, senderName: "SISTEMA", uid: BOSS_SYSTEM_UID,
          content: turnMsg, category: "Turno", timestamp: serverTimestamp(), isSystem: true,
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
        const totalDuration = turnState.phase === "players" ? PLAYER_TURN_DURATION : BOSS_TURN_DURATION;
        setIsUrgent(diff < totalDuration * 0.1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [turnState?.expiryDate, turnState?.phase, isMaster, isBossDefeated, fightStarted, handleAutoTurnChange]);

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
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isMaster || !isBossDefeated || activeBosses.length === 0) return;
    const boss = activeBosses[0];
    if (boss.victoryNotified) return;
    const notify = async () => {
      await sendBattleNotification(
        "🏆 VITTORIA DEGLI EROI!",
        `Avete sconfitto ${boss.name}! ${boss.rewards ? "Ricompense: " + boss.rewards : "Il Master vi assegnerà le ricompense."}`
      );
      await updateDoc(doc(db, "bosses", boss.id), { victoryNotified: true });
    };
    notify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBossDefeated]);

  useEffect(() => {
    if (!isMaster || !isTimeExpired || activeBosses.length === 0) return;
    const boss = activeBosses[0];
    if (boss.defeatNotified) return;
    const notify = async () => {
      await sendBattleNotification(
        "💀 SCONFITTA!",
        `${boss.name} ha prevalso! ${boss.penalties ? "Penalità: " + boss.penalties : "Il Master applicherà le conseguenze."}`
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
    for (let i = 0; i < dmgDiceCount; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      totalRoll += roll;
      rollsDetail.push(roll);
    }
    const statMod = dmgSelectedStat ? (charData?.stats?.[dmgSelectedStat] ?? 0) : 0;
    let sneakDamage = 0;
    const characterClass = charData?.class?.toLowerCase() || "";
    const isRogue = characterClass === "ladro" || characterClass === "rogue";
    if (isRogue) sneakDamage = Math.floor(Math.random() * 6) + 1;
    const finalDamage = totalRoll + statMod + sneakDamage;
    const currentShield = boss.shield || 0;
    const currentHp = boss.hp || 0;
    let remainingDamage = finalDamage;
    let newShield = currentShield;
    let newHp = currentHp;
    if (currentShield > 0) {
      if (currentShield >= remainingDamage) { newShield = currentShield - remainingDamage; remainingDamage = 0; }
      else { remainingDamage -= currentShield; newShield = 0; newHp = Math.max(0, currentHp - remainingDamage); }
    } else {
      newHp = Math.max(0, currentHp - remainingDamage);
    }
    try {
      await updateDoc(doc(db, "bosses", boss.id), { hp: newHp, shield: newShield });
      let detailString = `${dmgDiceCount}${die} (${rollsDetail.join("+")})`;
      if (statMod !== 0) detailString += ` ${statMod > 0 ? "+ " + statMod : statMod}`;
      if (isRogue) detailString += ` + 1d6 Ladro (${sneakDamage})`;
      let shieldNote = currentShield > 0 ? ` (Scudo colpito! Rimanente: ${newShield})` : "";
      await addDoc(collection(db, "world_boss_chat"), {
        type: "action", senderName: charData?.name || "Eroe",
        actionName: `Danno Arma${isRogue ? " (Furtivo)" : ""}`,
        damageRoll: `💥 INFLITTI ${finalDamage} DANNI!${shieldNote}`,
        description: `Tiro: ${detailString}`, uid: currentUser.uid,
        category: "Danno", timestamp: serverTimestamp(),
        effect: "slash", effectTargets: ["boss"],
      });
      setDmgDiceCount(1);
      setDmgSelectedStat(null);
      await updateDoc(doc(db, "battle_meta", "turn_tracker"), {
        [`attackCounts.${currentUser.uid}`]: increment(1),
      });
      await endMyTurn();
    } catch (err) {
      console.error("Errore durante l'applicazione del danno:", err);
    }
  };

  const handleSavingThrow = async (statKey) => {
    if (isUserLocked || !charData || !charData.stats) return;
    const condition = charData.nextTurnCondition;
    let d20, rollLabel;
    if (condition === "advantage" || condition === "disadvantage") {
      const r1 = Math.floor(Math.random() * 20) + 1;
      const r2 = Math.floor(Math.random() * 20) + 1;
      d20 = condition === "advantage" ? Math.max(r1, r2) : Math.min(r1, r2);
      rollLabel = `${condition === "advantage" ? "⬆ Vantaggio" : "⬇ Svantaggio"} [${r1},${r2}]→${d20}`;
      await updateDoc(doc(db, "characters", currentUser.uid), { nextTurnCondition: null });
    } else {
      d20 = Math.floor(Math.random() * 20) + 1;
      rollLabel = `d20(${d20})`;
    }
    const mod = charData.stats[statKey] || 0;
    await addDoc(collection(db, "world_boss_chat"), {
      type: "action", senderName: charData.name || "Eroe",
      actionName: `Tiro Salvezza ${statKey.toUpperCase()}`,
      hitRoll: `🎲 ${rollLabel} + mod(${mod}) = ${d20 + mod}`,
      uid: currentUser.uid, category: "Tiro Salvezza", timestamp: serverTimestamp(),
    });
  };

  const handleSetCondition = async (playerId, condition) => {
    await updateDoc(doc(db, "characters", playerId), { nextTurnCondition: condition });
    const player = players.find((p) => p.id === playerId);
    const pName = player?.name?.split(" ")[0] || "Eroe";
    const label = condition === "advantage" ? "⬆ Vantaggio" : condition === "disadvantage" ? "⬇ Svantaggio" : "nessun bonus";
    await addDoc(collection(db, "world_boss_chat"), {
      uid: BOSS_SYSTEM_UID, senderName: "Master System", type: "notification",
      content: `🎲 ${pName}: ${label} al prossimo tiro!`,
      timestamp: serverTimestamp(), isSystem: true,
    });
  };

  const toggleSelectAll = () => {
    if (selectedTargets.length === players.length) setSelectedTargets([]);
    else setSelectedTargets(players.map((p) => p.id));
  };

  const healAllPlayers = async () => {
    const confirmHeal = window.confirm("DM, vuoi curare TUTTI i player al massimo della vita?");
    if (!confirmHeal) return;
    try {
      const batch = writeBatch(db);
      players.forEach((player) => {
        const playerRef = doc(db, "characters", player.id);
        batch.update(playerRef, { "stats.hp": player.stats.maxHp || 100 });
      });
      await batch.commit();
      await addDoc(collection(db, "world_boss_chat"), {
        uid: BOSS_SYSTEM_UID, senderName: "Master System", type: "notification",
        content: "✨ Un'aura divina avvolge gli eroi: TUTTI i player sono stati curati al massimo!",
        timestamp: serverTimestamp(),
      });
      alert("Tutti i player sono stati curati!");
    } catch (error) {
      console.error("Errore nella cura globale:", error);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "battle_meta", "turn_tracker"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setTurnState(data);
        setBattleBg(data.battleBg || null);
      }
    });
    return () => unsub();
  }, []);

  // Measure party zone height + track mobile breakpoint
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!partyZoneRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setPartyZoneHeight(entry.contentRect.height);
    });
    obs.observe(partyZoneRef.current);
    return () => obs.disconnect();
  }, []);

  // All players subscribed for everyone (party display in battle scene)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "characters"), (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);


  useEffect(() => {
    if (!currentUser) return;
    const unsubChar = onSnapshot(doc(db, "characters", currentUser.uid), (snap) => {
      setCharData(snap.data());
    });
    const unsubBoss = onSnapshot(collection(db, "bosses"), (snap) => {
      const bosses = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.isActive);
      setActiveBosses(bosses);
    });
    const q = query(collection(db, "world_boss_chat"), orderBy("timestamp", "desc"), limit(100));
    const unsubChat = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubChar(); unsubBoss(); unsubChat(); };
  }, [currentUser]);


  const rollDice = (formula) => {
    try {
      const clean = formula.replace(/\s+/g, "");
      return clean.split("+").reduce((acc, part) => {
        if (part.includes("d")) {
          const [num, sides] = part.split("d").map((n) => parseInt(n) || 1);
          for (let i = 0; i < num; i++) acc += Math.floor(Math.random() * sides) + 1;
        } else { acc += parseInt(part) || 0; }
        return acc;
      }, 0);
    } catch { return 0; }
  };

  const endMyTurn = async () => {
    if (turnState.actedPlayers.includes(currentUser.uid)) return;
    await updateDoc(doc(db, "battle_meta", "turn_tracker"), { actedPlayers: arrayUnion(currentUser.uid) });
  };

  const handleActionRoll = async (action) => {
    const boss = activeBosses[0];
    if (!boss || isUserLocked) return;
    const isAttack = action.category === "Armi" || action.category?.toLowerCase().includes("livello") || action.category === "Trucchetto";
    const condition = charData.nextTurnCondition;
    let d20, rollLabel;
    if (condition === "advantage" || condition === "disadvantage") {
      const r1 = Math.floor(Math.random() * 20) + 1;
      const r2 = Math.floor(Math.random() * 20) + 1;
      d20 = condition === "advantage" ? Math.max(r1, r2) : Math.min(r1, r2);
      rollLabel = `${condition === "advantage" ? "⬆ Vant" : "⬇ Svan"} [${r1},${r2}]→${d20}`;
      await updateDoc(doc(db, "characters", currentUser.uid), { nextTurnCondition: null });
    } else {
      d20 = Math.floor(Math.random() * 20) + 1;
      rollLabel = `d20(${d20})`;
    }
    const bonusToHit = parseInt(action.bonus?.replace(/[^0-9+-]/g, "")) || 0;
    const hitTotal = d20 + bonusToHit;
    const isCritical = d20 === 20;
    let actionData = {
      type: "action", senderName: charData?.name || "Eroe",
      actionName: action.name + (isCritical ? " (CRITICO!)" : ""),
      timestamp: serverTimestamp(), uid: currentUser.uid, category: action.category,
      hitRoll: `🎲 ${rollLabel} + bonus(${bonusToHit}) = ${hitTotal} `,
    };
    if (isAttack) {
      const effectKey = pickEffectForAction(action);
      if (isCritical || hitTotal >= (boss.ac || 10)) {
        let formulaRaw = action.damage && action.damage !== "0" ? action.damage : "1d6";
        const isFinesseOrRanged = action.name?.toLowerCase().includes("rapier") || action.name?.toLowerCase().includes("arco") || action.name?.toLowerCase().includes("scimitar");
        const modValue = isFinesseOrRanged ? charData?.stats?.dex || 0 : charData?.stats?.str || 0;
        let cleanFormula = formulaRaw.replace(/@mod/g, modValue).replace(/\s+/g, "");
        const parts = cleanFormula.split("+");
        const diePart = parts[0];
        let staticBonus = 0;
        for (let i = 1; i < parts.length; i++) staticBonus += parseInt(parts[i]) || 0;
        const [num, sides] = diePart.split("d").map((n) => parseInt(n) || 1);
        let dieRollTotal = 0;
        let rolls = [];
        for (let i = 0; i < num; i++) { const r = Math.floor(Math.random() * sides) + 1; dieRollTotal += r; rolls.push(r); }
        let totalDamage = dieRollTotal + staticBonus;
        if (isCritical) totalDamage *= 2;
        let dieDetail = `Dado ${diePart}[${rolls.join("+")}]`;
        let damageString = `🎯 COLPITO! | 🎲 ${dieDetail} ${staticBonus !== 0 ? "+ bonus(" + staticBonus + ")" : ""}`;
        if (isCritical) damageString = `🔥 CRITICO! | (${dieRollTotal} + ${staticBonus}) x2`;
        if (charData?.class?.toLowerCase() === "ladro" || charData?.class?.toLowerCase() === "rogue") {
          const sneak = Math.floor(Math.random() * 6) + 1;
          totalDamage += sneak;
          damageString += ` + 1d6 Furtivo(${sneak})`;
        }
        const currentShield = boss.shield || 0;
        const currentHp = boss.hp || 0;
        let dmgRem = totalDamage;
        let newShield = currentShield;
        let newHp = currentHp;
        if (currentShield > 0) {
          if (currentShield >= dmgRem) { newShield -= dmgRem; dmgRem = 0; }
          else { dmgRem -= currentShield; newShield = 0; newHp = Math.max(0, currentHp - dmgRem); }
        } else { newHp = Math.max(0, currentHp - dmgRem); }
        await updateDoc(doc(db, "bosses", boss.id), { hp: newHp, shield: newShield });
        actionData.damageRoll = `${damageString} = 💥 ${totalDamage} DANNI!`;
        if (newShield < currentShield) actionData.damageRoll += " 🛡️ Scudo colpito!";
        actionData.effect = effectKey;
        actionData.effectTargets = ["boss"];
      } else {
        actionData.damageRoll = "🛡️ MANCATO! Il colpo non incide.";
      }
      await addDoc(collection(db, "world_boss_chat"), actionData);
      await updateDoc(doc(db, "battle_meta", "turn_tracker"), {
        [`attackCounts.${currentUser.uid}`]: increment(1),
      });
      await endMyTurn();
    } else {
      actionData.effect = pickEffectForAction(action);
      actionData.effectTargets = [`player-${currentUser.uid}`];
      await addDoc(collection(db, "world_boss_chat"), actionData);
    }
  };

  const toggleTarget = (uid) => {
    setSelectedTargets((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]);
  };

  const handleBossRoll = async (boss, action) => {
    if (isFightOver) return alert("La battaglia è terminata: nessun attacco possibile.");
    if (selectedTargets.length === 0) return alert("DM, seleziona almeno un bersaglio!");
    const d20 = Math.floor(Math.random() * 20) + 1;
    const bossBonus = parseInt(action.bonus) || 0;
    const hitTotal = d20 + bossBonus;
    const damageDealt = rollDice(action.damage || "1d6");
    const results = [];
    for (const targetId of selectedTargets) {
      const p = players.find((player) => player.id === targetId);
      if (!p) continue;
      const playerCA = p.stats?.ac || 10;
      const isHit = hitTotal >= playerCA;
      if (isHit) {
        let remainingDmg = damageDealt;
        let currentShield = p.stats?.shield || 0;
        let currentHp = p.stats?.hp || 0;
        if (currentShield > 0) {
          if (currentShield >= remainingDmg) { currentShield -= remainingDmg; remainingDmg = 0; }
          else { remainingDmg -= currentShield; currentShield = 0; }
        }
        await updateDoc(doc(db, "characters", targetId), {
          "stats.hp": Math.max(0, currentHp - remainingDmg), "stats.shield": currentShield,
        });
      }
      results.push({ id: targetId, name: p.name.split(" ")[0], hit: isHit, roll: `${hitTotal} (${d20}+${bossBonus}) vs CA ${playerCA}`, dmg: isHit ? damageDealt : 0 });
    }
    const hitTargets = results.filter((r) => r.hit).map((r) => r.name).join(", ");
    const missedTargets = results.filter((r) => !r.hit).map((r) => r.name).join(", ");
    const hitTargetIds = results.filter((r) => r.hit).map((r) => `player-${r.id}`);
    await addDoc(collection(db, "world_boss_chat"), {
      uid: BOSS_SYSTEM_UID, senderName: boss.name, type: "action", category: "Attacco Boss",
      actionName: action.name,
      description: `Il Boss scatena ${action.name} (Danni: ${damageDealt})! ${hitTargets.length > 0 ? "Colpisce: " + hitTargets : ""}${missedTargets.length > 0 ? ". Mancati: " + missedTargets : ""}`,
      masterDetails: results, timestamp: serverTimestamp(),
      ...(hitTargetIds.length > 0 ? { effect: pickEffectForAction(action), effectTargets: hitTargetIds } : {}),
    });
    setSelectedTargets([]);
  };

  const damagePlayerManual = async (playerId, amount) => {
    await updateDoc(doc(db, "characters", playerId), { "stats.hp": increment(amount) });
  };

  const healBossManual = async (amount) => {
    const boss = activeBosses[0];
    if (!boss) return;
    await updateDoc(doc(db, "bosses", boss.id), { hp: Math.min(boss.maxHp, boss.hp + amount) });
  };

  const shieldBossManual = async () => {
    const boss = activeBosses[0];
    if (!boss) return;
    const val = prompt("Quanti HP di scudo vuoi dare al Boss?");
    if (val && !isNaN(val)) {
      await updateDoc(doc(db, "bosses", boss.id), { shield: increment(parseInt(val)) });
    }
  };

  const clearChat = async () => {
    if (!window.confirm("Purgare la chat?")) return;
    const snapshot = await getDocs(collection(db, "world_boss_chat"));
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  };

  const sendBattleNotification = async (title, message) => {
    try {
      const charsSnap = await getDocs(collection(db, "characters"));
      const batch = writeBatch(db);
      charsSnap.docs.forEach((charDoc) => {
        const notifyRef = doc(collection(db, "notifications"));
        batch.set(notifyRef, { userId: charDoc.id, title, message, read: false, timestamp: serverTimestamp() });
      });
      await batch.commit();
    } catch (e) {
      console.error("Errore invio notifica battaglia:", e);
    }
  };

  const handleStartFight = async () => {
    if (!isMaster) return;
    const boss = activeBosses[0];
    if (!boss) return;
    const newExpiry = new Date(Date.now() + PLAYER_TURN_DURATION);
    try {
      const turnRef = doc(db, "battle_meta", "turn_tracker");
      await updateDoc(turnRef, {
        fightStarted: true, phase: "players", expiryDate: newExpiry,
        actedPlayers: [], turnNumber: 1, lastSwitchedAt: serverTimestamp(),
        attackCounts: {},
      });
      await addDoc(collection(db, "world_boss_chat"), {
        text: `⚔️ LA BATTAGLIA HA INIZIO! ${boss.name} vi sfida! Eroi, è il vostro momento!`,
        senderName: "Master System", uid: BOSS_SYSTEM_UID,
        content: `⚔️ LA BATTAGLIA HA INIZIO! ${boss.name} vi sfida!`,
        category: "Sistema", timestamp: serverTimestamp(), isSystem: true,
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

  const groupedActions = useMemo(() => {
    if (!charData?.actions) return {};
    return charData.actions.reduce((acc, action) => {
      const cat = action.category || "Altro";
      // Esclude la categoria "Abilità / Skill" dal pannello azioni del WorldBoss.
      if (/abilit|skill/i.test(cat)) return acc;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(action);
      return acc;
    }, {});
  }, [charData]);

  const sortedCategories = useMemo(() => {
    return Object.keys(groupedActions).sort((a, b) => a === "Armi" ? -1 : b === "Armi" ? 1 : a.localeCompare(b));
  }, [groupedActions]);

  const lastActionText = useMemo(() => {
    const actionMsgs = messages.filter(m => m.type === "action" && m.actionName);
    if (!actionMsgs.length) return null;
    const last = actionMsgs[actionMsgs.length - 1];
    return `${last.senderName} · ${last.actionName}`;
  }, [messages]);

  const isPlayerDead = !isMaster && (charData?.stats?.hp ?? 0) <= 0;

  const isUserLocked =
    !isMaster && (!fightStarted || turnState.phase === "boss" || turnState.actedPlayers.includes(currentUser?.uid) || isPlayerDead || isFightOver);

  if (!currentUser) return <div className="rpg-denied">Loggati per entrare.</div>;

  const boss = activeBosses[0] ?? null;
  const isGameOver = isBossDefeated || isTimeExpired || areAllPlayersDead;
  const partyForDisplay = players.length > 0
    ? players
    : charData ? [{ id: currentUser.uid, ...charData }] : [];

  return (
    <div className="rpg-screen">
      <VfxLayer messages={messages} />

      {/* ── ACTION BANNER ── */}
      <div className="rpg-action-banner">
        <span className="rpg-banner-text">
          {lastActionText
            || (boss && !fightStarted ? `${boss.name} minaccia Exanthia!` : null)
            || (fightStarted && !isGameOver
              ? (turnState.phase === "players" ? "⚔ Turno degli Eroi" : "🔥 Il Boss Attacca!")
              : null)
            || (isBossDefeated ? "🏆 VITTORIA DEGLI EROI!" : isTimeExpired ? "💀 IL BOSS HA PREVALSO!" : areAllPlayersDead ? "💀 GLI EROI SONO CADUTI!" : "—")}
        </span>
        {isMaster && (
          <div className="rpg-dm-topbar">
            <span className="rpg-dm-badge">DM</span>
            <button className="rpg-topbar-btn" onClick={clearChat}>Pulisci Log</button>
          </div>
        )}
      </div>

      {/* ── BATTLE SCENE ── */}
      <div
        className="rpg-battle-scene"
        style={battleBg ? { backgroundImage: `url(${battleBg})`, backgroundSize: "cover", backgroundPosition: "center bottom" } : undefined}
      >

        {/* Boss — left */}
        <div className="rpg-boss-zone">
          {!boss ? (
            <p className="rpg-no-boss-msg">Nessun boss attivo</p>
          ) : (
            <div data-vfx-target="boss" className={`rpg-boss-sprite-wrap ${isBossDefeated ? "dead" : ""} ${fightStarted && turnState.phase === "boss" && !isGameOver ? "boss-turn" : ""}`}>
              <img
                className="rpg-boss-sprite"
                src={(isBossDefeated && boss.deadImageUrl) ? boss.deadImageUrl : (boss.imageUrl || "/assets/default-boss.png")}
                alt={boss.name}
              />
              {isBossDefeated && <div className="rpg-torn-overlay" />}
            </div>
          )}
        </div>

        {/* Party — right: scattered absolute positions, N rows of 4 */}
        <div className="rpg-party-zone" ref={partyZoneRef}>
          {partyForDisplay
            .filter(p => turnState.actedPlayers?.includes(p.id))
            .map((p, i) => {
              const COLS       = isMobile ? 3 : 4;
              const ROW_STEP   = partyZoneHeight > 0 ? Math.min(140, (partyZoneHeight - 80) / Math.max(1, Math.ceil(partyForDisplay.filter(x => turnState.actedPlayers?.includes(x.id)).length / COLS) - 0.5)) : 120;
              const col        = i % COLS;
              const row        = Math.floor(i / COLS);
              const jX         = ((i * 47 + 13) % 28) - 14;
              const jY         = ((i * 31 +  7) % 20) - 10;
              const leftPct    = col * 24 + 1 + jX / 10;
              const bottomPx   = row * ROW_STEP + 8 + jY;
              const isDead     = (p.stats?.hp ?? 1) <= 0;
              const sprite     = isDead
                ? (p.deadSpriteUrl || p.spriteUrl || p.image)
                : (p.spriteUrl || p.image);
              const breathDelay = `${(i * 0.37).toFixed(2)}s`;
              return (
                <div
                  key={p.id || i}
                  data-vfx-target={`player-${p.id}`}
                  className={`rpg-char-wrap ${isDead ? "char-dead" : "char-alive"}`}
                  data-has-dead-sprite={isDead && p.deadSpriteUrl ? "1" : undefined}
                  style={{ position: "absolute", left: `${leftPct}%`, bottom: `${bottomPx}px` }}
                >
                  {sprite
                    ? <img className="rpg-char-sprite" src={sprite} alt={p.name}
                        style={!isDead ? { animationDelay: breathDelay } : undefined} />
                    : <div className="rpg-char-placeholder">{(p.name || "?")[0].toUpperCase()}</div>
                  }
                  <span className="rpg-char-name-tag">{(p.name || "Eroe").split(" ")[0]}</span>
                </div>
              );
            })
          }
        </div>

        {/* Game over overlays */}
        {isBossDefeated && (
          <div className="rpg-scene-banner rpg-scene-banner--victory">🏆 VITTORIA DEGLI EROI 🏆</div>
        )}
        {isTimeExpired && (
          <div className="rpg-scene-banner rpg-scene-banner--defeat">💀 IL BOSS HA PREVALSO 💀</div>
        )}
        {areAllPlayersDead && !isBossDefeated && !isTimeExpired && (
          <div className="rpg-scene-banner rpg-scene-banner--defeat">💀 GLI EROI SONO CADUTI 💀</div>
        )}

        {/* Pre-fight */}
        {!fightStarted && !isGameOver && boss && (
          <div className="rpg-prefight-overlay">
            {isMaster ? (
              <div className="rpg-prefight-box">
                <p className="rpg-prefight-hint">Scrivi prima in chat, poi avvia</p>
                <button className="rpg-btn rpg-btn--start" onClick={handleStartFight}>⚔ INIZIA BATTAGLIA</button>
              </div>
            ) : (
              <p className="rpg-waiting-msg">⏳ In attesa del Master...</p>
            )}
          </div>
        )}
      </div>

      {/* ── TAB BAR ── */}
      {(isMaster || fightStarted) && (
        <div className="rpg-mob-tabs">
          {[["status","🛡 Status"],["actions","⚔ Azioni"],["log","📜 Log"]].map(([key,label]) => (
            <button key={key} className={`rpg-mob-tab${mobileTab===key?" active":""}`} onClick={() => setMobileTab(key)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── STATUS PANEL ── */}
      {boss && mobileTab === "status" && (
        <div className="rpg-status-panel">
          <div className="rpg-hud-boss">
            <div className="rpg-hud-boss-name">{boss.name}</div>
            <div className="rpg-hud-bar-row">
              <span className="rpg-bar-label">HP</span>
              <div className="rpg-bar-track">
                <div className={`rpg-bar-hp ${boss.hp / boss.maxHp < 0.25 ? "crit" : boss.hp / boss.maxHp < 0.5 ? "low" : ""}`}
                  style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }} />
                {(boss.shield ?? 0) > 0 && (
                  <div className="rpg-bar-shield" style={{ width: `${Math.min(100, (boss.shield / boss.maxHp) * 100)}%` }} />
                )}
              </div>
              {isMaster && <span className="rpg-hud-hp-val">{boss.hp} / {boss.maxHp}</span>}
            </div>
            {fightStarted && !isGameOver && (
              <div className="rpg-hud-turn-row">
                <span className={`rpg-phase-pill ${turnState.phase}`}>
                  {turnState.phase === "players" ? "⚔ EROI" : "🔥 BOSS"}
                </span>
                <span className={`rpg-hud-timer ${isUrgent ? "urgent" : ""}`}>
                  T{turnState.turnNumber} · {formatTime(timeLeft)}
                </span>
              </div>
            )}
            {fightStarted && !isGameOver && boss.expiryDate && (
              <div className="rpg-event-expiry">
                <span className="rpg-event-label">Evento:</span>
                <TimerDisplay expiryDate={boss.expiryDate} />
              </div>
            )}
          </div>

          <div className="rpg-hud-party">
            {isMaster ? null : (
              charData && (() => {
                const hp = charData.stats?.hp ?? 0;
                const maxHp = charData.stats?.maxHp ?? 1;
                const pct = Math.max(0, (hp / maxHp) * 100);
                const hpClass = pct < 25 ? "crit" : pct < 50 ? "low" : "";
                return (
                  <div className="rpg-own-hp-block">
                    <span className="rpg-own-name">{charData.name?.split(" ")[0]}</span>
                    <div className="rpg-hud-bar-row">
                      <span className="rpg-bar-label">HP</span>
                      <div className="rpg-bar-track">
                        <div className={`rpg-bar-hp ${hpClass}`} style={{ width: `${pct}%` }} />
                        {(charData.stats?.shield ?? 0) > 0 && (
                          <div className="rpg-bar-shield" style={{ width: `${Math.min(100, (charData.stats.shield / maxHp) * 100)}%` }} />
                        )}
                      </div>
                      <span className="rpg-hud-hp-val">{hp} / {maxHp}</span>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* ── STAKES BANNER (solo status tab) ── */}
      {mobileTab === "status" && boss && (boss.rewards || boss.penalties) && (
        <div className="rpg-stakes-bar">
          {boss.penalties && !isBossDefeated && (
            <div className="rpg-stake-block rpg-stake-block--penalty">
              <span className="rpg-stake-icon">💀</span>
              <div>
                <div className="rpg-stake-label">PENALITÀ</div>
                <div className="rpg-stake-text">{boss.penalties}</div>
              </div>
            </div>
          )}
          {boss.rewards && !isTimeExpired && (
            <div className="rpg-stake-block rpg-stake-block--reward">
              <span className="rpg-stake-icon">🏆</span>
              <div>
                <div className="rpg-stake-label">RICOMPENSA</div>
                <div className="rpg-stake-text">{boss.rewards}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BATTLE INTERFACE ── */}
      {(isMaster || fightStarted) && (mobileTab === "actions" || mobileTab === "log") && (
        <div className="rpg-battle-interface rpg-battle-interface--mobile">
          <div className={`rpg-log-panel${mobileTab === "actions" ? " rpg-hidden" : ""}`}>
            <div className="rpg-log-title">Registro di Battaglia</div>
            <form className="rpg-chat-form" onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) {
                addDoc(collection(db, "world_boss_chat"), { type: "narrative", senderName: charData.name, content: text, uid: currentUser.uid, timestamp: serverTimestamp() });
                setText("");
              }
            }}>
              <input className="rpg-chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Narra la tua mossa…" disabled={isUserLocked} />
              <button className="rpg-chat-send" type="submit" disabled={isUserLocked}>▶</button>
            </form>
            <div className="rpg-log-scroll">
              {messages.map((m) => (
                <div key={m.id} className={`rpg-log-msg ${m.type || "narrative"} ${m.uid === currentUser.uid ? "mine" : ""} ${m.isSystem ? "sys" : ""}`}>
                  <div className="rpg-log-head">
                    <ChatAvatar uid={m.uid} isBoss={m.uid === BOSS_SYSTEM_UID} />
                    <span className="rpg-log-who">{m.senderName}</span>
                    {m.timestamp && (
                      <span className="rpg-log-time">
                        {new Date(m.timestamp.seconds * 1000).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {isMaster && <button className="rpg-del-btn" onClick={() => handleDeleteMessage(m.id)}>✖</button>}
                  </div>
                  {m.type === "action" ? (
                    <div className={`rpg-log-action cat-${(m.category || "").toLowerCase().replace(/\s/g, "-")}`}>
                      {m.actionName && <strong className="rpg-act-name">{m.actionName}</strong>}
                      {m.description && <span className="rpg-act-desc"> {m.description}</span>}
                      {((m.uid === BOSS_SYSTEM_UID && isMaster) || m.uid !== BOSS_SYSTEM_UID) && (
                        <div className="rpg-rolls">
                          {m.hitRoll && <span className="rpg-hit-roll">{m.hitRoll}</span>}
                          {m.damageRoll && <span className="rpg-dmg-roll">{m.damageRoll}</span>}
                          {isMaster && m.masterDetails?.map((r, i) => (
                            <span key={i} className="rpg-master-detail">• {r.name}: {r.hit ? `✅ ${r.dmg} HP` : "🛡 Miss"} ({r.roll})</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="rpg-log-text">{m.content || m.text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={`rpg-action-panel ${isUserLocked ? "locked" : ""}${mobileTab === "log" ? " rpg-hidden" : ""}`}>
            {isMaster && (
              <div className="rpg-master-panel">
                <div className="rpg-panel-title">♛ Master</div>

                {/* ── Turno ── */}
                <div className="rpg-section-label">Turno · Azioni {turnState.actedPlayers?.length ?? 0}/{players.length}</div>
                <div className="rpg-btn-row">
                  <button className="rpg-btn rpg-btn--hero" onClick={() => handleManualTurnChange("players")}>⚔ Eroi</button>
                  <button className="rpg-btn rpg-btn--boss" onClick={() => handleManualTurnChange("boss")}>🔥 Boss</button>
                </div>

                {/* ── Boss ── */}
                {boss && (
                  <>
                    <div className="rpg-section-label">Boss</div>
                    {boss.action1 && <button className="rpg-btn rpg-btn--atk" onClick={() => handleBossRoll(boss, boss.action1)}>{boss.action1.name}</button>}
                    {boss.action2 && <button className="rpg-btn rpg-btn--atk" onClick={() => handleBossRoll(boss, boss.action2)}>{boss.action2.name}</button>}
                    <div className="rpg-btn-row">
                      <button className="rpg-sm-btn" onClick={() => healBossManual(5)}>+5 HP</button>
                      <button className="rpg-sm-btn" onClick={() => healBossManual(10)}>+10 HP</button>
                      <button className="rpg-sm-btn" onClick={shieldBossManual}>🛡 Scudo</button>
                    </div>
                  </>
                )}

                {/* ── Giocatori (unificato: target + HP + controlli) ── */}
                <div className="rpg-section-label rpg-section-label--toggle" onClick={() => setPlayersOpen(o => !o)}>
                  <span>{playersOpen ? "▼" : "▶"} Giocatori <span className="rpg-section-count">({players.length})</span></span>
                  <span className="rpg-section-tools" onClick={(e) => e.stopPropagation()}>
                    <button className="rpg-sm-btn" onClick={toggleSelectAll}>
                      {selectedTargets.length === players.length ? "⊘ Desel." : "⊕ Tutti"}
                    </button>
                    <button className="rpg-sm-btn" onClick={healAllPlayers}>💖 Full</button>
                  </span>
                </div>
                {playersOpen && (
                <div className="rpg-player-adj-list">
                  {players.map((p) => {
                    const hp     = p.stats?.hp ?? 0;
                    const maxHp  = p.stats?.maxHp ?? 1;
                    const pct    = Math.max(0, (hp / maxHp) * 100);
                    const hpCls  = pct < 25 ? "crit" : pct < 50 ? "low" : "";
                    const acted  = turnState.actedPlayers?.includes(p.id);
                    const isTgt  = selectedTargets.includes(p.id);
                    const isDead = hp <= 0;
                    return (
                      <div key={p.id} className={`rpg-master-row ${acted ? "acted" : ""} ${isTgt ? "targeted" : ""} ${isDead ? "dead" : ""}`}>
                        <button className="rpg-master-row-head" onClick={() => toggleTarget(p.id)} title="Seleziona come bersaglio">
                          <span className="rpg-master-row-name">
                            {isTgt && <span className="rpg-target-mark">◀</span>}
                            {(p.name || "?").split(" ")[0]}
                            <span className="rpg-attack-counter" title="Attacchi totali al boss">
                              ⚔ {turnState.attackCounts?.[p.id] ?? 0}
                            </span>
                            {acted && <span className="rpg-check-mark">✓</span>}
                            {isDead && <span className="rpg-dead-mark">💀</span>}
                          </span>
                          <span className="rpg-master-row-hp">{hp}/{maxHp}{(p.stats?.shield ?? 0) > 0 ? ` 🛡${p.stats.shield}` : ""}</span>
                          <div className="rpg-bar-track rpg-bar-track--sm">
                            <div className={`rpg-bar-hp ${hpCls}`} style={{ width: `${pct}%` }} />
                            {(p.stats?.shield ?? 0) > 0 && (
                              <div className="rpg-bar-shield" style={{ width: `${Math.min(100, (p.stats.shield / maxHp) * 100)}%` }} />
                            )}
                          </div>
                        </button>
                        <div className="rpg-master-row-btns">
                          <button className="rpg-sm-btn rpg-sm-btn--heal" onClick={() => damagePlayerManual(p.id, 1)}>+1</button>
                          <button className="rpg-sm-btn rpg-sm-btn--heal" onClick={() => damagePlayerManual(p.id, 3)}>+3</button>
                          <button className="rpg-sm-btn rpg-sm-btn--danger" onClick={() => damagePlayerManual(p.id, -1)}>−1</button>
                          <button className="rpg-sm-btn" onClick={() => { const val = prompt("HP Scudo?"); if (val) updateDoc(doc(db, "characters", p.id), { "stats.shield": increment(parseInt(val)) }); }}>🛡</button>
                          {(p.stats?.shield ?? 0) > 0 && (
                            <button className="rpg-sm-btn rpg-sm-btn--danger" onClick={() => updateDoc(doc(db, "characters", p.id), { "stats.shield": 0 })}>✕</button>
                          )}
                          <button
                            className={`rpg-sm-btn rpg-sm-btn--adv${p.nextTurnCondition === "advantage" ? " active" : ""}`}
                            onClick={() => handleSetCondition(p.id, p.nextTurnCondition === "advantage" ? null : "advantage")}
                            title="Vantaggio prossimo tiro"
                          >⬆</button>
                          <button
                            className={`rpg-sm-btn rpg-sm-btn--dis${p.nextTurnCondition === "disadvantage" ? " active" : ""}`}
                            onClick={() => handleSetCondition(p.id, p.nextTurnCondition === "disadvantage" ? null : "disadvantage")}
                            title="Svantaggio prossimo tiro"
                          >⬇</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}

                {/* ── Log ── */}
                <button className="rpg-btn rpg-btn--danger" style={{ width: "100%", marginTop: 10 }} onClick={clearChat}>🗑 Pulisci Log</button>
              </div>
            )}
            {!isMaster && (
              <div className="rpg-player-panel">
                <div className="rpg-panel-title">{charData?.name || "Eroe"}{isUserLocked && <span className="rpg-locked-tag"> — Attendi</span>}</div>
                {charData?.nextTurnCondition && (
                  <div className={`rpg-condition-badge rpg-condition-badge--${charData.nextTurnCondition}`}>
                    {charData.nextTurnCondition === "advantage" ? "⬆ Prossimo tiro: VANTAGGIO" : "⬇ Prossimo tiro: SVANTAGGIO"}
                  </div>
                )}
                {fightStarted && turnState.phase === "players" && (
                  <button className={`rpg-btn rpg-btn--endturn ${turnState.actedPlayers?.includes(currentUser.uid) ? "done" : ""}`}
                    onClick={endMyTurn} disabled={turnState.actedPlayers?.includes(currentUser.uid)}>
                    {turnState.actedPlayers?.includes(currentUser.uid) ? "✓ Azione Eseguita" : "⏩ Fine Turno"}
                  </button>
                )}
                <div className="rpg-mode-toggle">
                  <button
                    className={`rpg-mode-btn${playerActionMode === "saves" ? " active" : ""}`}
                    onClick={() => setPlayerActionMode("saves")}
                  >🛡 Tiri Salvezza</button>
                  <button
                    className={`rpg-mode-btn${playerActionMode === "damage" ? " active" : ""}`}
                    onClick={() => setPlayerActionMode("damage")}
                  >💥 Danno Manuale</button>
                </div>
                {playerActionMode === "saves" ? (
                  <div className="rpg-saves-grid">
                    {["str", "dex", "cos", "int", "wis", "cha"].map((s) => (
                      <button key={s} className="rpg-save-btn" onClick={() => handleSavingThrow(s)} disabled={isUserLocked}>
                        <span className="rpg-save-key">{s.toUpperCase()}</span>
                        <span className="rpg-save-mod">{charData?.stats?.[s] >= 0 ? "+" : ""}{charData?.stats?.[s] ?? 0}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="rpg-manual-dmg-row">
                      <select className="rpg-select" value={dmgDiceCount} onChange={(e) => setDmgDiceCount(parseInt(e.target.value))}>
                        {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}d</option>)}
                      </select>
                      <select className="rpg-select" value={dmgSelectedStat || ""} onChange={(e) => setDmgSelectedStat(e.target.value || null)}>
                        <option value="">No Bonus</option>
                        {["str", "dex", "cos", "int", "wis", "cha"].map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div className="rpg-dice-row">
                      {["d4", "d6", "d8", "d10", "d12"].map((die) => (
                        <button key={die} className="rpg-die-btn" onClick={() => handleManualDamageToBoss(die)} disabled={isUserLocked}>{die}</button>
                      ))}
                    </div>
                  </>
                )}
                <div className="rpg-section-label">Azioni</div>
                <div className="rpg-accordion">
                  {sortedCategories.map((cat) => {
                    const catCls = /armi|arma|weapon/i.test(cat) ? "cat--weapon"
                      : /abilit|skill/i.test(cat) ? "cat--skill"
                      : /trucchett|cantrip|spell|incant/i.test(cat) ? "cat--spell"
                      : /livello|level/i.test(cat) ? "cat--level"
                      : "cat--default";
                    return (
                      <div key={cat} className={`rpg-acc-item ${catCls}`}>
                        <button className="rpg-acc-trigger" onClick={() => setOpenSections((p) => ({ ...p, [cat]: !p[cat] }))}>
                          {openSections[cat] ? "▼" : "▶"} {cat}
                        </button>
                        {openSections[cat] && (
                          <div className="rpg-acc-content">
                            {groupedActions[cat].map((action, idx) => (
                              <button key={idx} className="rpg-action-btn" onClick={() => handleActionRoll(action)} disabled={isUserLocked}>
                                <span className="rpg-action-name">{action.name}</span>
                                {action.bonus && <span className="rpg-action-bonus"> +{action.bonus}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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

  if (isBoss) return <span className="boss-chat-icon">👹</span>;
  if (!avatarUrl) return <div className="avatar-placeholder" />;
  return <img src={avatarUrl} alt="Avatar" className="chat-avatar-img" />;
}
