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
import { VfxLayer } from "./WorldBossVfx";
import { pickEffectForAction, areaSpellFor, damageFormulaFor, elementFor, SAVE_LABEL_IT, skillKindFor, skillTagFor, isSkillCategory } from "./worldBossSpells";
import { isHiddenChar } from "../data/hiddenPlayers";

// Campi effetto da scrivere sul messaggio di chat (li legge VfxLayer su ogni client).
// Etichetta di un'azione di boss/minion nel pannello Master: icona, tipo e se
// richiede un bersaglio (attacco singolo / svantaggio) — le AREE colpiscono tutti,
// cura/+CA/vantaggio agiscono sul nemico stesso.
function masterActionMeta(a) {
  const t = a.type || "attack";
  if (t === "heal") return { kind: "self", ico: "💚", tag: `si cura ${parseInt(a.diceNum) || 1}${a.diceType || "d6"}${parseInt(a.bonus) ? "+" + parseInt(a.bonus) : ""}` };
  if (t === "buff_ca") return { kind: "self", ico: "🛡", tag: `+${parseInt(a.acBonus) || 0} CA a sé` };
  if (t === "buff_adv") return { kind: "self", ico: "⬆", tag: "vantaggio a sé" };
  if (t === "debuff_dis") return { kind: "debuff", ico: "🌑", tag: "svantaggio ai bersagli", needs: true };
  const aoe = areaSpellFor(a);
  const dmg = a.damage || `${parseInt(a.diceNum) || 1}${a.diceType || "d6"}`;
  if (aoe) return { kind: "aoe", ico: "🌀", tag: `AREA · ${dmg} · TS ${SAVE_LABEL_IT[aoe.save] || aoe.save}` };
  return { kind: "atk", ico: "⚔", tag: `${dmg}${parseInt(a.bonus) ? ` · +${parseInt(a.bonus)} al tiro` : ""}`, needs: true };
}

// `kind` forza la forma (heal/buff/shield/debuff); altrimenti la decide l'azione.
const fxFields = (action, targets, { kind = null, from = null, miss = [], kill = [] } = {}) => {
  const fx = pickEffectForAction(action, kind);
  const out = { effect: fx.kind, effectEl: fx.el, effectTargets: targets };
  if (from) out.effectFrom = from;
  if (miss.length) out.effectMissTargets = miss;
  if (kill.length) out.effectKill = kill;
  return out;
};
// Modificatore al tiro salvezza di un nemico (boss/minion): se il doc lo porta, altrimenti 0.
const enemySaveMod = (enemy, ab) => Number(enemy?.saves?.[ab] ?? enemy?.abilities?.[ab] ?? enemy?.[ab] ?? 0) || 0;
const rollD20 = () => Math.floor(Math.random() * 20) + 1;

const MASTER_EMAIL = "santomassimo85@gmail.com";
const BOSS_SYSTEM_UID = "BOSS_MSG";

const PLAYER_TURN_DURATION = 3 * 60 * 60 * 1000;
const BOSS_TURN_DURATION = 1 * 60 * 60 * 1000;

// QUORUM del turno degli eroi: quando ha agito almeno questa quota degli eroi
// VIVI (2/3: 8 su 12), il turno si chiude entro 10 minuti invece di aspettare
// le 3 ore — se mancano meno di 10 minuti il timer resta com'è. Scatta una
// sola volta per turno (`quorumTurn` = turnNumber sul turn_tracker).
const QUORUM_RATIO = 2 / 3;
const QUORUM_WINDOW_MS = 10 * 60 * 1000;
const quorumTarget = (n) => Math.max(1, Math.ceil(n * QUORUM_RATIO));

// Detect what a spell does so we can route it correctly:
//   self_buff → +AC on caster (Mage Armor, Shield, Barkskin, …)
//   heal      → restore HP to a chosen ally
//   buff      → advantage on next roll for chosen ally(ies)
//   debuff    → disadvantage on boss's next attack
//   attack    → roll d20 + bonus vs boss CA, deal damage
// Inferred from the action name + description (Italian + English keywords).
function detectSpellIntent(action) {
  const cat = (action.category || "").toLowerCase();
  // Weapons always attack
  if (/armi|arma|weapon/.test(cat)) return "attack";
  const text = `${action.name || ""} ${action.description || ""}`.toLowerCase();

  // Self-buff (AC bonus on caster) — checked BEFORE generic buff so "Shield" the spell
  // (one round, +5 AC) doesn't get misrouted to ally-buff. Excludes "Shield of Faith"
  // which targets allies and is matched by the buff regex below.
  if (
    /\bmage armou?r\b|\barmatura magica\b/i.test(text) ||
    /\bbarkskin\b|\bscorza coriacea\b|\bscorza\b/i.test(text) ||
    /\bstoneskin\b|\bpelle di pietra\b/i.test(text) ||
    /\bmirror image\b|immagine specul/i.test(text) ||
    /\bblur\b|\boffuscamento\b|\boffuscare\b/i.test(text) ||
    /\bsanctuary\b|\bsantuario\b/i.test(text) ||
    // "Shield" the spell — keep "Shield of Faith" (ally) out
    (/(\bshield\b|\bscudo\b)/.test(text) && !/shield of faith|scudo della fede/.test(text))
  ) {
    return "self_buff";
  }

  // Heal — most specific first
  if (/\bcur(a|are|i|ato)\b|guarisc|guarigione|cure wounds|healing|tocco curativ|parola guarit|rigenera|ristoro|bende sacre/i.test(text)) return "heal";
  // Buff (positive effect on allies)
  if (/ispirazion|inspiration|benedic|bless|\baid\b|aiuto magico|scudo della fede|shield of faith|\bhaste\b|velocità|guida|guidance|favore divin|protezione dal|eroismo|heroism|coraggio/i.test(text)) return "buff";
  // Debuff (negative effect on enemy / control)
  if (/svantaggio|paura|spavent|maledizione|\bbane\b|malocchio|frighten|hold person|hold monster|tratteni|paralis|\bsonno\b|\bsleep\b|charme|charm|sciagura|disgrazia|nebbia|oscurità|ostacolo|rallenta|\bslow\b|taccia|silen(zio|ce)|debilita|indebol/i.test(text)) return "debuff";
  return "attack";
}

// Pick the AC bonus a self-buff grants. Tries to read "+N CA" / "+N AC" from the
// description; otherwise falls back to per-spell defaults; final default is +2.
function selfBuffAcBonus(action) {
  const text = `${action.name || ""} ${action.description || ""}`.toLowerCase();
  // Regex grab: "+3 CA", "+2 ac", "ca +3", "+5 ca"
  const m = text.match(/\+\s*(\d+)\s*(ca|ac)\b/i) || text.match(/(?:ca|ac)\s*\+\s*(\d+)/i);
  if (m) return Math.min(8, Math.max(1, parseInt(m[1], 10)));
  if (/\bmage armou?r\b|\barmatura magica\b/.test(text)) return 3;
  if (/\bshield\b|\bscudo\b/.test(text) && !/scudo della fede/.test(text)) return 5;
  if (/\bbarkskin\b|\bscorza/.test(text)) return 3;
  if (/\bstoneskin\b|\bpelle di pietra\b/.test(text)) return 3;
  if (/\bmirror image\b|immagine specul|\bblur\b|\boffuscamento\b/.test(text)) return 2;
  if (/\bsanctuary\b|\bsantuario\b/.test(text)) return 2;
  return 2;
}

// Caratteristiche del PG: formato nuovo {score, mod, save} (sync Foundry) oppure vecchio
// (numero = modificatore). In pagina la costituzione è "cos", nel documento può essere "con".
// Mai passare il valore grezzo al JSX: un oggetto renderizzato come figlio manda React in crash
// (pagina nera per il giocatore).
function readStat(charData, key) {
  const s = charData?.stats || {};
  const raw = s[key] ?? (key === "cos" ? s.con : key === "con" ? s.cos : undefined);
  if (raw == null) return { mod: 0, save: 0 };
  if (typeof raw === "object") {
    const score = raw.score != null ? Number(raw.score) : null;
    const mod = raw.mod != null ? (Number(raw.mod) || 0) : (score != null ? Math.floor((score - 10) / 2) : 0);
    const save = raw.save != null ? (Number(raw.save) || 0) : mod;
    return { mod, save };
  }
  const n = Number(raw) || 0;
  return { mod: n, save: n };
}
const statMod = (charData, key) => readStat(charData, key).mod;
const statSave = (charData, key) => readStat(charData, key).save;

// Spellcasting modifier: highest of INT/WIS/CHA — works for any caster class.
function getSpellMod(charData) {
  return Math.max(statMod(charData, "int"), statMod(charData, "wis"), statMod(charData, "cha"));
}

// 5e proficiency bonus: quello salvato dalla sync (stats.prof) se c'è, altrimenti dal livello
// (1-4 → +2, 5-8 → +3, 9-12 → +4, 13-16 → +5, 17+ → +6).
function getProfBonus(charData) {
  const saved = parseInt(charData?.stats?.prof);
  if (saved > 0) return saved;
  const lvl = Math.max(1, parseInt(charData?.level) || 1);
  return Math.ceil(lvl / 4) + 1;
}

// Full spell attack bonus = spell mod + proficiency.
function getSpellAttackBonus(charData) {
  return getSpellMod(charData) + getProfBonus(charData);
}

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
  // Pannello Master (2026-09-15): attacco in 3 passi + eroi espandibili
  const [attackerId, setAttackerId] = useState(null);      // chi attacca (boss o minion)
  const [targetMode, setTargetMode] = useState("all");     // "all" = tutti gli eroi vivi · "pick" = scelti
  const [spawnOpen, setSpawnOpen] = useState(false);       // riga "Evoca minion" aperta
  const [heroOpenId, setHeroOpenId] = useState(null);      // eroe con i comandi cura/ferite aperti
  const [heroAmount, setHeroAmount] = useState("5");       // quantità "a piacere"
  const [heroShield, setHeroShield] = useState("5");       // HP di scudo da dare
  const [showInactive, setShowInactive] = useState(false); // mostra anche chi ha lasciato la campagna
  const [playerActionMode, setPlayerActionMode] = useState("saves");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  const [turnState, setTurnState] = useState({
    phase: "players",
    turnNumber: 1,
    actedPlayers: [],
    fightStarted: false,
  });

  // Spell target picker — opened when player casts a heal/buff spell that needs target selection.
  // Shape: { action, intent: "heal" | "buff", selected: string[] }
  const [spellPicker, setSpellPicker] = useState(null);
  const [weaponPicker, setWeaponPicker] = useState(null); // {skill, weapons}: arma su cui applicare un'abilità "su arma"

  // ── MINION ──
  // `minionDefs`      = sagome salvate nella Caserma (collection `minions`, solo attive)
  // `minionInstances` = servi EVOCATI in questa battaglia (collection `world_boss_minions`):
  //                     copia viva con hp/scudo propri. Il Master li evoca dal pannello,
  //                     i giocatori scelgono chi colpire (boss o minion). La vittoria
  //                     arriva solo quando TUTTI i nemici sono a terra.
  const [minionDefs, setMinionDefs] = useState([]);
  const [minionInstances, setMinionInstances] = useState([]);
  const [spawnDefId, setSpawnDefId] = useState("");
  const [targetId, setTargetId] = useState(null); // bersaglio scelto dal giocatore (id boss o minion)

  const fightStarted = turnState.fightStarted === true;

  // Tutti i nemici in scena: il boss per primo, poi i minion evocati.
  const enemies = useMemo(() => {
    const list = [];
    if (activeBosses[0]) list.push({ ...activeBosses[0], kind: "boss", vfxKey: "boss" });
    minionInstances.forEach((m) => list.push({ ...m, kind: "minion", vfxKey: `minion-${m.id}` }));
    return list;
  }, [activeBosses, minionInstances]);
  const livingEnemies = useMemo(() => enemies.filter((e) => (e.hp ?? 0) > 0), [enemies]);

  // Il boss è a terra (sprite morto) — ma la battaglia continua finché vivono i servi.
  const isBossDefeated = useMemo(() => {
    return activeBosses.length > 0 && activeBosses[0].hp <= 0;
  }, [activeBosses]);
  // VITTORIA: boss E minion tutti a zero.
  const areAllEnemiesDead = useMemo(
    () => enemies.length > 0 && livingEnemies.length === 0,
    [enemies, livingEnemies],
  );

  const areAllPlayersDead = useMemo(() => {
    if (!players.length) return false;
    return players.every((p) => (p.stats?.hp ?? 0) <= 0);
  }, [players]);

  const isFightOver = areAllEnemiesDead || areAllPlayersDead;

  // Bersaglio corrente del giocatore: quello scelto se è ancora vivo, altrimenti il primo vivo.
  const currentTarget = useMemo(
    () => livingEnemies.find((e) => e.id === targetId) || livingEnemies[0] || null,
    [livingEnemies, targetId],
  );
  const enemyRef = (e) => doc(db, e.kind === "minion" ? "world_boss_minions" : "bosses", e.id);
  // Attaccante scelto dal Master: quello toccato se è vivo, altrimenti il primo vivo.
  const attacker = useMemo(
    () => livingEnemies.find((e) => e.id === attackerId) || livingEnemies[0] || null,
    [livingEnemies, attackerId],
  );
  const attackerActions = useMemo(() => {
    if (!attacker) return [];
    const list = Array.isArray(attacker.actions) && attacker.actions.length > 0
      ? attacker.actions
      : [attacker.action1, attacker.action2, attacker.action3, attacker.action4, attacker.action5];
    return list.filter((a) => a && a.name);
  }, [attacker]);

  // Live clock — ticks every second so the boss deadline (expiryDate) countdown
  // and isTimeExpired recompute even with no Firestore change on the page.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Milliseconds left until the boss deadline (the event scadenza set at creation).
  // null when there's no active boss / no deadline.
  const bossTimeLeft = useMemo(() => {
    if (activeBosses.length === 0 || !activeBosses[0].expiryDate) return null;
    const expiry = new Date(activeBosses[0].expiryDate).getTime();
    if (Number.isNaN(expiry)) return null;
    return expiry - nowTs;
  }, [activeBosses, nowTs]);

  const isTimeExpired = useMemo(() => {
    if (activeBosses.length === 0 || !activeBosses[0].expiryDate) return false;
    const expiry = new Date(activeBosses[0].expiryDate).getTime();
    if (Number.isNaN(expiry)) return false;
    // scaduto = tempo finito con almeno un nemico (boss o minion) ancora in piedi
    return nowTs >= expiry && livingEnemies.length > 0;
  }, [activeBosses, nowTs, livingEnemies]);

  const chatEndRef = useRef(null);
  // Solo in sviluppo: `?vista=player` mostra la pagina come la vede un giocatore (controllo grafico).
  const isMaster = useMemo(
    () => currentUser?.email === MASTER_EMAIL
      && !(import.meta.env.DEV && new URLSearchParams(window.location.search).get("vista") === "player"),
    [currentUser],
  );
  // Solo in sviluppo: `&pg=<uid>` carica la scheda di QUEL personaggio (azioni vere) al posto della propria.
  const devPgUid = import.meta.env.DEV ? (new URLSearchParams(window.location.search).get("pg") || null) : null;
  const myUid = devPgUid || currentUser?.uid;

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
    if (!turnState?.expiryDate || areAllEnemiesDead || !fightStarted) {
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
        if (!areAllEnemiesDead) {
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
  }, [turnState?.expiryDate, turnState?.phase, isMaster, areAllEnemiesDead, fightStarted, handleAutoTurnChange]);

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
    if (!isMaster || !areAllEnemiesDead || activeBosses.length === 0) return;
    const boss = activeBosses[0];
    if (boss.victoryNotified) return;
    const notify = async () => {
      const servi = minionInstances.length ? ` e i suoi ${minionInstances.length} servi` : "";
      await sendBattleNotification(
        "🏆 VITTORIA DEGLI EROI!",
        `Avete sconfitto ${boss.name}${servi}! ${boss.rewards ? "Ricompense: " + boss.rewards : "Il Master vi assegnerà le ricompense."}`
      );
      await updateDoc(doc(db, "bosses", boss.id), { victoryNotified: true });
    };
    notify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areAllEnemiesDead]);

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
    const boss = currentTarget; // boss o minion scelto dal giocatore
    if (!boss || isUserLocked) return;
    const sides = parseInt(die.replace("d", ""));
    let totalRoll = 0;
    let rollsDetail = [];
    for (let i = 0; i < dmgDiceCount; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      totalRoll += roll;
      rollsDetail.push(roll);
    }
    const abilityBonus = dmgSelectedStat ? readStat(charData, dmgSelectedStat).mod : 0;
    let sneakDamage = 0;
    const characterClass = charData?.class?.toLowerCase() || "";
    const isRogue = characterClass === "ladro" || characterClass === "rogue";
    const sneakDiceCount = (charData?.level ?? 1) >= 3 ? 2 : 1;
    const sneakRolls = [];
    if (isRogue) {
      for (let i = 0; i < sneakDiceCount; i++) {
        const r = Math.floor(Math.random() * 6) + 1;
        sneakRolls.push(r);
        sneakDamage += r;
      }
    }
    const finalDamage = totalRoll + abilityBonus + sneakDamage;
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
      await updateDoc(enemyRef(boss), { hp: newHp, shield: newShield });
      let detailString = `${dmgDiceCount}${die} (${rollsDetail.join("+")})`;
      if (abilityBonus !== 0) detailString += ` ${abilityBonus > 0 ? "+ " + abilityBonus : abilityBonus}`;
      if (isRogue) detailString += ` + ${sneakDiceCount}d6 Ladro (${sneakRolls.join("+")})`;
      let shieldNote = currentShield > 0 ? ` (Scudo colpito! Rimanente: ${newShield})` : "";
      if (newHp <= 0) shieldNote += ` ☠ ${boss.name} cade!`;
      await addDoc(collection(db, "world_boss_chat"), {
        type: "action", senderName: charData?.name || "Eroe",
        actionName: `Danno Arma${isRogue ? " (Furtivo)" : ""} → ${boss.name}`,
        damageRoll: `💥 INFLITTI ${finalDamage} DANNI!${shieldNote}`,
        description: `Tiro: ${detailString}`, uid: currentUser.uid,
        category: "Danno", timestamp: serverTimestamp(),
        effect: "slash", effectEl: "physical", effectTargets: [boss.vfxKey], effectFrom: `player-${myUid}`,
        ...(newHp <= 0 ? { effectKill: [boss.vfxKey] } : {}),
      });
      setDmgDiceCount(1);
      setDmgSelectedStat(null);
      if (activeBosses[0]?.id) {
        await updateDoc(doc(db, "battle_meta", "turn_tracker"), {
          [`attackCounts.${activeBosses[0].id}.${currentUser.uid}`]: increment(1),
        });
      }
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
    const mod = statSave(charData, statKey);
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
    const unsubChar = onSnapshot(doc(db, "characters", devPgUid || currentUser.uid), (snap) => {
      setCharData(snap.data());
    });
    const unsubBoss = onSnapshot(collection(db, "bosses"), (snap) => {
      const bosses = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.isActive);
      setActiveBosses(bosses);
    });
    // Servi evocati in questa battaglia (ordine di evocazione).
    const unsubMinions = onSnapshot(collection(db, "world_boss_minions"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.createdAt?.seconds ?? Infinity) - (b.createdAt?.seconds ?? Infinity));
      setMinionInstances(list);
    });
    // Sagome della Caserma (solo quelle attive) — servono al Master per evocare.
    const unsubDefs = onSnapshot(collection(db, "minions"), (snap) => {
      // TUTTE le sagome della Caserma: quelle segnate ⚡ per prime, ma si può evocare qualunque
      const defs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      defs.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || (a.name || "").localeCompare(b.name || ""));
      setMinionDefs(defs);
      setSpawnDefId((cur) => (defs.some((d) => d.id === cur) ? cur : (defs[0]?.id || "")));
    });
    const q = query(collection(db, "world_boss_chat"), orderBy("timestamp", "desc"), limit(100));
    const unsubChat = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubChar(); unsubBoss(); unsubChat(); unsubMinions(); unsubDefs(); };
  }, [currentUser, devPgUid]);


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

  // ── ABILITÀ dei PG nel World Boss ─────────────────────────────────────────
  // Uso limitato (riposo/usi nella descrizione) = UNA volta per battaglia, segnato su
  // characters/{uid}.wbSkillUses[bossId][slug]; cambia boss → si azzera da solo.
  const skillSlug = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "x";
  const currentBossId = activeBosses[0]?.id || null;
  const skillUses = (currentBossId && charData?.wbSkillUses?.[currentBossId]) || {};
  const isSkillUsed = (action, skill) => !!(skill?.limited && skillUses[skillSlug(action?.name)]);
  const markSkillUsed = async (action, skill) => {
    if (!skill?.limited || !currentBossId || !myUid) return;
    try {
      await updateDoc(doc(db, "characters", myUid), { [`wbSkillUses.${currentBossId}.${skillSlug(action.name)}`]: increment(1) });
    } catch (e) { console.warn("Uso abilità non segnato:", e); }
  };
  // Formula di un'abilità pronta al tiro: @mod = mod. di magia del PG, "livello × N" = numero fisso.
  const resolveSkillFormula = (skill) => {
    if (skill?.perLevel) return String(Math.max(1, parseInt(charData?.level) || 1) * skill.perLevel);
    return String(skill?.formula || "1d6").replace(/@mod/g, getSpellMod(charData)).replace(/\s+/g, "");
  };
  // Tira "NdM+K" (più termini) → { total, detail: "2d8[3+7]+2" }.
  const rollDetail = (formula) => {
    const parts = String(formula).replace(/\s+/g, "").split("+").filter(Boolean);
    let total = 0; const bits = [];
    for (const part of parts) {
      if (/^\d*d\d+$/.test(part)) {
        const [n, sides] = part.split("d").map((x) => parseInt(x) || 1);
        const rolls = [];
        for (let i = 0; i < n; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
        total += rolls.reduce((a, b) => a + b, 0); bits.push(`${part}[${rolls.join("+")}]`);
      } else { const k = parseInt(part) || 0; total += k; if (k) bits.push(String(k)); }
    }
    return { total, detail: bits.join("+") };
  };
  const myWeapons = useMemo(() => (charData?.actions || []).filter((a) => /armi|arma|weapon/i.test(a.category || "")), [charData]);

  // Cura da ABILITÀ (Lay on Hands, Second Wind, Turn the Tide): uno o più alleati, cap al massimo.
  const castSkillHeal = async (action, skill, targetIds) => {
    if (isUserLocked || !targetIds?.length) return;
    const formula = resolveSkillFormula(skill);
    const { total, detail } = rollDetail(formula);
    const rows = [];
    try {
      const batch = writeBatch(db);
      for (const id of targetIds) {
        const t = players.find((p) => p.id === id);
        if (!t) continue;
        const cur = t.stats?.hp ?? 0;
        const max = t.stats?.maxHp ?? cur + total;
        const nh = Math.min(max, cur + total);
        batch.update(doc(db, "characters", id), { "stats.hp": nh });
        rows.push(`${(t.name || "alleato").split(" ")[0]} +${nh - cur} (${cur}→${nh})`);
      }
      await batch.commit();
      await addDoc(collection(db, "world_boss_chat"), {
        type: "action", senderName: charData?.name || "Eroe",
        actionName: `${action.name} (Cura)`,
        damageRoll: `💚 ${rows.join(" · ")}`,
        description: `Tiro cura: ${detail || formula} = ${total}`,
        uid: currentUser.uid, category: action.category || "Abilità",
        timestamp: serverTimestamp(),
        effect: "heal", effectEl: "radiant", effectTargets: targetIds.map((id) => `player-${id}`),
      });
      await markSkillUsed(action, skill);
      await endMyTurn();
    } catch (err) { console.error("Errore cura (abilità):", err); }
  };

  // PF temporanei da ABILITÀ (Form of Dread, Wild Shape) → scudo del PG (non si sommano: resta il maggiore).
  const castSkillShield = async (action, skill) => {
    if (isUserLocked) return;
    const formula = resolveSkillFormula(skill);
    const { total, detail } = rollDetail(formula);
    const cur = charData?.stats?.shield ?? 0;
    const next = Math.max(cur, total);
    try {
      await updateDoc(doc(db, "characters", myUid), { "stats.shield": next });
      await addDoc(collection(db, "world_boss_chat"), {
        type: "action", senderName: charData?.name || "Eroe",
        actionName: `${action.name} (PF temporanei)`,
        damageRoll: `🛡 Scudo ${detail || formula} = ${total}${next === cur && cur > 0 ? ` (resta lo scudo attuale ${cur})` : ` → scudo ${next}`}`,
        description: action.description ? String(action.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 160) : "",
        uid: currentUser.uid, category: action.category || "Abilità",
        timestamp: serverTimestamp(),
        effect: "shield", effectEl: elementFor(action), effectTargets: [`player-${myUid}`],
      });
      await markSkillUsed(action, skill);
      await endMyTurn();
    } catch (err) { console.error("Errore scudo (abilità):", err); }
  };

  const endMyTurn = async () => {
    if (turnState.actedPlayers.includes(currentUser.uid)) return;
    await updateDoc(doc(db, "battle_meta", "turn_tracker"), { actedPlayers: arrayUnion(currentUser.uid) });
    try { await checkQuorum(); } catch (e) { console.warn("Quorum turno:", e); }
  };

  // Eroi ATTIVI (la collection `characters` tiene anche chi ha lasciato la
  // campagna: quelli in hiddenPlayers non contano) e vivi → base del quorum
  // (12 attivi → scatta all'8°). Solo per il conteggio: le liste di gioco restano intere.
  // Escluso anche il PG di servizio del Master ("master"): non è un eroe.
  const activePlayers = useMemo(() => players.filter((p) => !isHiddenChar(p) && !/^master$/i.test(String(p.name || "").trim())), [players]);
  const alivePlayerIds = useMemo(() => activePlayers.filter((p) => (p.stats?.hp ?? 0) > 0).map((p) => p.id), [activePlayers]);
  // Pannello Master: eroi vivi attaccabili, bersagli effettivi del passo 2, liste della sezione Eroi.
  const aliveHeroes = useMemo(() => activePlayers.filter((p) => (p.stats?.hp ?? 0) > 0), [activePlayers]);
  const selectedAliveIds = useMemo(() => selectedTargets.filter((id) => aliveHeroes.some((p) => p.id === id)), [selectedTargets, aliveHeroes]);
  const masterTargetIds = targetMode === "all" ? aliveHeroes.map((p) => p.id) : selectedAliveIds;
  const masterTargetNames = targetMode === "all" && aliveHeroes.length > 3
    ? `tutti i ${aliveHeroes.length} eroi in piedi`
    : aliveHeroes.filter((p) => masterTargetIds.includes(p.id)).map((p) => (p.name || "?").split(" ")[0]).join(", ");
  const inactiveHeroes = useMemo(() => players.filter((p) => !activePlayers.includes(p)), [players, activePlayers]);
  const shownHeroes = showInactive ? players : activePlayers;
  const actedAlive = useMemo(
    () => (turnState.actedPlayers || []).filter((id) => alivePlayerIds.includes(id)).length,
    [turnState.actedPlayers, alivePlayerIds],
  );
  const quorumNeeded = quorumTarget(alivePlayerIds.length);
  const quorumReached = fightStarted && turnState.phase === "players" && turnState.quorumTurn === turnState.turnNumber;

  // Chi fa scattare il quorum (l'ottavo eroe su dodici) accorcia il timer del turno
  // a 10 minuti con una transazione: se un altro client lo ha già fatto, o se
  // mancano meno di 10 minuti, non tocca nulla. Avvisa tutti in chat.
  const checkQuorum = async () => {
    const turnRef = doc(db, "battle_meta", "turn_tracker");
    const alive = alivePlayerIds;
    const target = quorumTarget(alive.length);
    let fired = null;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(turnRef);
      const d = snap.exists() ? snap.data() : null;
      if (!d || !d.fightStarted || d.phase !== "players") return;
      if (d.quorumTurn === d.turnNumber) return;
      const acted = (d.actedPlayers || []).filter((id) => alive.includes(id)).length;
      if (acted < target) return;
      const expiry = d.expiryDate?.toMillis ? d.expiryDate.toMillis() : new Date(d.expiryDate).getTime();
      const newExpiry = Date.now() + QUORUM_WINDOW_MS;
      if (!(expiry > newExpiry)) { tx.update(turnRef, { quorumTurn: d.turnNumber }); return; }
      tx.update(turnRef, { expiryDate: new Date(newExpiry), quorumTurn: d.turnNumber });
      fired = { acted, total: alive.length };
    });
    if (fired) {
      const msg = `⏱ ${fired.acted} eroi su ${fired.total} hanno agito: il turno si chiude tra 10 minuti! Chi manca, si sbrighi.`;
      await addDoc(collection(db, "world_boss_chat"), {
        text: msg, content: msg, senderName: "Master System", uid: BOSS_SYSTEM_UID,
        category: "Turno", timestamp: serverTimestamp(), isSystem: true,
      });
    }
  };

  // ── HEAL SPELL: roll heal dice + spell mod, apply to a single ally (capped at maxHp) ──
  const castHealOnTarget = async (action, targetId) => {
    if (isUserLocked) return;
    const target = players.find((p) => p.id === targetId);
    if (!target) return;
    const formula = action.damage && action.damage !== "0" ? action.damage : "1d8";
    const spellMod = getSpellMod(charData);
    const cleanFormula = String(formula).replace(/@mod/g, spellMod);
    const healRoll = rollDice(cleanFormula);
    const totalHeal = healRoll;
    const currentHp = target.stats?.hp ?? 0;
    const maxHp = target.stats?.maxHp ?? currentHp + totalHeal;
    const newHp = Math.min(maxHp, currentHp + totalHeal);
    const actualHealed = newHp - currentHp;
    try {
      await updateDoc(doc(db, "characters", targetId), { "stats.hp": newHp });
      await addDoc(collection(db, "world_boss_chat"), {
        type: "action", senderName: charData?.name || "Eroe",
        actionName: `${action.name} (Cura)`,
        damageRoll: `💚 Cura ${target.name?.split(" ")[0] || "alleato"}: +${actualHealed} HP (${currentHp}→${newHp})`,
        description: `Tiro cura: ${cleanFormula} = ${healRoll}${spellMod !== 0 ? ` (incl. mod magia +${spellMod})` : ""}`,
        uid: currentUser.uid, category: action.category || "Incantesimo",
        timestamp: serverTimestamp(),
        effect: "heal", effectTargets: [`player-${targetId}`],
      });
      await endMyTurn();
    } catch (err) {
      console.error("Errore cura:", err);
    }
  };

  // ── SELF-BUFF SPELL: apply temp +AC to the caster (Mage Armor, Shield, …) ──
  // Persists for the rest of the battle (cleared automatically when the boss is
  // defeated / battle ends, or manually by re-casting / master). Replaces any
  // previous self-buff so stacking is intentional.
  const castSelfBuff = async (action, bonusOverride = null) => {
    if (isUserLocked) return;
    const acBonus = bonusOverride || selfBuffAcBonus(action);
    try {
      await updateDoc(doc(db, "characters", currentUser.uid), {
        selfAcBonus: acBonus,
        selfAcSource: action.name || "Buff difensivo",
        selfAcAppliedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, "world_boss_chat"), {
        type: "action", senderName: charData?.name || "Eroe",
        actionName: `${action.name} (Buff su sé)`,
        damageRoll: `🛡 +${acBonus} CA mentre attivo (CA effettiva: ${(charData?.stats?.ac || 10) + acBonus})`,
        description: action.description || `${charData?.name || "Eroe"} si protegge magicamente.`,
        uid: currentUser.uid, category: action.category || "Incantesimo",
        timestamp: serverTimestamp(),
        effect: "shield", effectEl: "arcane", effectTargets: [`player-${currentUser.uid}`],
      });
      await endMyTurn();
    } catch (err) {
      console.error("Errore self-buff:", err);
    }
  };

  // ── BUFF SPELL: apply advantage on next roll to one or more allies ──
  // Stores `nextTurnCondition: "advantage"` on each selected character — same field already used.
  const castBuffOnTargets = async (action, targetIds) => {
    if (isUserLocked || !targetIds.length) return;
    try {
      const batch = writeBatch(db);
      targetIds.forEach((uid) => {
        batch.update(doc(db, "characters", uid), { nextTurnCondition: "advantage" });
      });
      await batch.commit();
      const names = targetIds
        .map((uid) => players.find((p) => p.id === uid)?.name?.split(" ")[0] || "?")
        .join(", ");
      await addDoc(collection(db, "world_boss_chat"), {
        type: "action", senderName: charData?.name || "Eroe",
        actionName: `${action.name} (Buff)`,
        damageRoll: `🌟 ${names}: vantaggio al prossimo tiro!`,
        description: action.description || `${charData?.name || "Eroe"} potenzia gli alleati.`,
        uid: currentUser.uid, category: action.category || "Incantesimo",
        timestamp: serverTimestamp(),
        effect: "buff", effectTargets: targetIds.map((id) => `player-${id}`),
      });
      await endMyTurn();
    } catch (err) {
      console.error("Errore buff:", err);
    }
  };

  // ── DEBUFF SPELL: applies disadvantage to the chosen enemy's next attack roll ──
  const castDebuffOnBoss = async (action) => {
    const boss = currentTarget;
    if (!boss || isUserLocked) return;
    try {
      await updateDoc(enemyRef(boss), {
        nextTurnCondition: "disadvantage",
        debuffSource: action.name || null,
      });
      await addDoc(collection(db, "world_boss_chat"), {
        type: "action", senderName: charData?.name || "Eroe",
        actionName: `${action.name} (Debuff) → ${boss.name}`,
        damageRoll: `🌑 ${boss.name}: svantaggio al prossimo attacco!`,
        description: action.description || `${charData?.name || "Eroe"} ostacola ${boss.kind === "minion" ? boss.name : "il Boss"}.`,
        uid: currentUser.uid, category: action.category || "Incantesimo",
        timestamp: serverTimestamp(),
        effect: "debuff", effectEl: "darkness", effectTargets: [boss.vfxKey], effectFrom: `player-${myUid}`,
      });
      await endMyTurn();
    } catch (err) {
      console.error("Errore debuff:", err);
    }
  };

  // ── MAGIA AD AREA (giocatore): un solo tiro di danno, OGNI nemico vivo tira il
  // suo TS contro la CD del PG (8 + competenza + mod magia). TS superato = metà
  // danni (o nessuno, se la magia lo dice); fallito = danno pieno. Scudo prima degli HP.
  // `enemiesArg` = bersagli espliciti (abilità a TS su UN nemico: Wrath of the Storm…); `skill` =
  // abilità del PG (formula propria, CD sulla caratteristica indicata, uso limitato da segnare).
  const castAreaSpell = async (action, aoe, enemiesArg = null, skill = null) => {
    const targets = enemiesArg?.length ? enemiesArg : livingEnemies;
    if (isUserLocked || !targets.length) return;
    const spellMod = getSpellMod(charData);
    const dcMod = aoe.dcAbility ? statMod(charData, aoe.dcAbility) : spellMod;
    const dc = 8 + getProfBonus(charData) + dcMod;
    const formula = skill ? resolveSkillFormula(skill) : damageFormulaFor(action, "1d6").replace(/@mod/g, spellMod);
    const total = rollDice(formula);
    const results = [];
    for (const enemy of targets) {
      const roll = rollD20();
      const mod = enemySaveMod(enemy, aoe.save);
      const saved = roll + mod >= dc;
      const dmg = saved ? (aoe.half ? Math.floor(total / 2) : 0) : total;
      const currentShield = enemy.shield || 0;
      const currentHp = enemy.hp || 0;
      let rem = dmg, newShield = currentShield, newHp = currentHp;
      if (currentShield > 0) {
        if (currentShield >= rem) { newShield -= rem; rem = 0; }
        else { rem -= currentShield; newShield = 0; newHp = Math.max(0, currentHp - rem); }
      } else { newHp = Math.max(0, currentHp - rem); }
      results.push({ enemy, roll, mod, saved, dmg, newShield, newHp, shieldHit: newShield < currentShield, killed: newHp <= 0 && currentHp > 0 });
    }
    try {
      const batch = writeBatch(db);
      results.forEach((r) => batch.update(enemyRef(r.enemy), { hp: r.newHp, shield: r.newShield }));
      await batch.commit();
      const saveLbl = SAVE_LABEL_IT[aoe.save] || aoe.save.toUpperCase();
      const tsLine = results.map((r) => `${r.enemy.name}: d20(${r.roll})${r.mod ? (r.mod > 0 ? "+" : "") + r.mod : ""}=${r.roll + r.mod} ${r.saved ? "✅" : "❌"}`).join(" · ");
      const dmgLine = results.map((r) => `${r.enemy.name} −${r.dmg}${r.saved ? (aoe.half ? " (metà)" : " (evitato)") : ""}${r.shieldHit ? " 🛡️" : ""}${r.killed ? " ☠" : ""}`).join(", ");
      await addDoc(collection(db, "world_boss_chat"), {
        type: "action", senderName: charData?.name || "Eroe",
        actionName: `${action.name}${enemiesArg?.length ? "" : " (AREA)"} → ${results.length === 1 ? results[0].enemy.name : `${results.length} nemici`}`,
        hitRoll: `🎲 CD ${dc} · TS ${saveLbl} — ${tsLine}`,
        damageRoll: `💥 ${formula} = ${total} · ${dmgLine}`,
        uid: currentUser.uid, category: action.category,
        timestamp: serverTimestamp(),
        ...fxFields(action, results.map((r) => r.enemy.vfxKey), {
          kind: enemiesArg?.length === 1 ? "bolt" : "aoe", from: `player-${myUid}`,
          miss: results.filter((r) => r.dmg === 0).map((r) => r.enemy.vfxKey),
          kill: results.filter((r) => r.killed).map((r) => r.enemy.vfxKey),
        }),
      });
      if (activeBosses[0]?.id) {
        await updateDoc(doc(db, "battle_meta", "turn_tracker"), {
          [`attackCounts.${activeBosses[0].id}.${currentUser.uid}`]: increment(1),
        });
      }
      await markSkillUsed(action, skill);
      await endMyTurn();
    } catch (err) {
      console.error("Errore magia ad area:", err);
    }
  };

  // `opts.rider` = abilità che aggiunge dadi al colpo d'arma (Divine Smite…): `action` è l'ARMA.
  const handleActionRoll = async (action, opts = {}) => {
    const boss = currentTarget; // il nemico scelto (boss o minion)
    if (!boss || isUserLocked) return;
    const rider = opts.rider || null;
    const riderSkill = rider ? skillKindFor(rider) : null;

    // ── ABILITÀ del PG (categoria "Abilità"): smite/colpi psionici sull'arma, cure, scudi,
    // +CA, attacchi a TS o ad area. Le passive non arrivano qui (filtrate in groupedActions).
    const skill = !rider && isSkillCategory(action.category) ? skillKindFor(action) : null;
    if (skill) {
      if (isSkillUsed(action, skill)) { window.alert(`"${action.name}" è già stata usata in questa battaglia.`); return; }
      if (skill.kind === "rider") {
        if (!myWeapons.length) { window.alert(`Per usare "${action.name}" serve un'arma nella scheda.`); return; }
        if (myWeapons.length === 1) { await handleActionRoll(myWeapons[0], { rider: action }); return; }
        setWeaponPicker({ skill: action, weapons: myWeapons });
        return;
      }
      if (skill.kind === "heal") {
        if (skill.target === "self") { await castSkillHeal(action, skill, [myUid]); return; }
        if (skill.target === "allies") {
          // "ogni creatura a tua scelta…" (Turn the Tide) → tutti gli alleati vivi e feriti
          const hurt = players.filter((p) => (p.stats?.hp ?? 0) > 0 && (p.stats?.hp ?? 0) < (p.stats?.maxHp ?? Infinity));
          if (!hurt.length) { window.alert("Nessun alleato ferito da curare."); return; }
          await castSkillHeal(action, skill, hurt.map((p) => p.id));
          return;
        }
        setSpellPicker({ action, intent: "heal", selected: [], skill });
        return;
      }
      if (skill.kind === "shield") { await castSkillShield(action, skill); return; }
      if (skill.kind === "ac") {
        const bonus = skill.acProf ? getProfBonus(charData) : (skill.acBonus || selfBuffAcBonus(action));
        if (!window.confirm(`Usare "${action.name}"? +${bonus} CA per tutta la battaglia.`)) return;
        await castSelfBuff(action, bonus);
        return;
      }
      if (skill.kind === "area") { await castAreaSpell(action, skill.area, null, skill); return; }
      if (skill.kind === "save") {
        await castAreaSpell(action, { save: skill.save, half: skill.half, dcAbility: skill.dcAbility }, [boss], skill);
        return;
      }
      // kind "attack" (Ram / colpo senza armi) → tiro per colpire qui sotto
    }

    // Route spells by intent (self_buff/heal/buff/debuff). Weapons always fall through to attack.
    const intent = skill ? "attack" : detectSpellIntent(action);
    if (intent === "self_buff") {
      const bonus = selfBuffAcBonus(action);
      const cur = charData?.selfAcBonus || 0;
      const replacing = cur > 0 && (charData?.selfAcSource !== action.name);
      const msg = replacing
        ? `Lanciare "${action.name}" (+${bonus} CA)? Sostituirà il buff attivo "${charData.selfAcSource}" (+${cur}).`
        : `Lanciare "${action.name}" su te stesso? +${bonus} CA per tutta la battaglia.`;
      const ok = window.confirm(msg);
      if (!ok) return;
      await castSelfBuff(action);
      return;
    }
    if (intent === "heal") {
      setSpellPicker({ action, intent: "heal", selected: [] });
      return;
    }
    if (intent === "buff") {
      setSpellPicker({ action, intent: "buff", selected: [] });
      return;
    }
    if (intent === "debuff") {
      const ok = window.confirm(`Lanciare "${action.name}" su ${boss.name}? Applicherà svantaggio al suo prossimo attacco.`);
      if (!ok) return;
      await castDebuffOnBoss(action);
      return;
    }

    // Magia AD AREA (Onda di Tuono, Mani Brucianti, Frantumare, Palla di Fuoco…):
    // colpisce TUTTI i nemici in campo, ognuno tira il suo TS contro la CD del PG.
    const aoe = areaSpellFor(action);
    if (aoe && livingEnemies.length > 0) {
      await castAreaSpell(action, aoe);
      return;
    }

    const isAttack = action.category === "Armi" || action.category?.toLowerCase().includes("livello") || action.category === "Trucchetto" || skill?.kind === "attack";
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
    const parsedBonus = parseInt(action.bonus?.replace(/[^0-9+-]/g, "")) || 0;
    // Spell hit-roll fallback: when the action is a cantrip or "Livello X"
    // spell, prefer the proper spell attack bonus (spellMod + prof) if it
    // beats the stored bonus. This fixes level 1+ spells whose Foundry sync
    // didn't compute a bonus (cantrips usually had it baked in correctly).
    const isSpell = action.category === "Trucchetto"
      || (action.category?.toLowerCase().includes("livello"));
    let bonusToHit = parsedBonus;
    let bonusLabel = `bonus(${parsedBonus})`;
    if (isSpell) {
      const spellMod = getSpellMod(charData);
      const profBonus = getProfBonus(charData);
      const spellAtk = spellMod + profBonus;
      if (spellAtk > parsedBonus) {
        bonusToHit = spellAtk;
        bonusLabel = `magia(+${spellMod}) + comp(+${profBonus}) = +${spellAtk}`;
      }
    }
    if (skill) {
      // Abilità d'attacco senza bonus salvato: il migliore fra mischia (FOR/DES + comp) e magia.
      const meleeAtk = Math.max(statMod(charData, "str"), statMod(charData, "dex")) + getProfBonus(charData);
      const best = Math.max(parsedBonus, meleeAtk, getSpellAttackBonus(charData));
      if (best > parsedBonus) { bonusToHit = best; bonusLabel = `bonus(+${best})`; }
    }
    const hitTotal = d20 + bonusToHit;
    const isCritical = d20 === 20;
    let actionData = {
      type: "action", senderName: charData?.name || "Eroe",
      actionName: (rider ? `${action.name} + ${rider.name}` : action.name) + (isCritical ? " (CRITICO!)" : "") + (isAttack ? ` → ${boss.name}` : ""),
      timestamp: serverTimestamp(), uid: currentUser.uid, category: action.category,
      hitRoll: `🎲 ${rollLabel} + ${bonusLabel} = ${hitTotal} `,
    };
    const fxAction = rider ? { ...action, dmgType: elementFor(rider) } : action;
    if (isAttack) {
      if (isCritical || hitTotal >= (boss.ac || 10)) {
        let formulaRaw = action.damage && action.damage !== "0" ? action.damage : "1d6";
        const isFinesseOrRanged = action.name?.toLowerCase().includes("rapier") || action.name?.toLowerCase().includes("arco") || action.name?.toLowerCase().includes("scimitar");
        const modValue = statMod(charData, isFinesseOrRanged ? "dex" : "str");
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
        // Abilità "su arma" (Divine Smite, Psionic Strike, Planar Warrior…): dadi extra sul colpo, raddoppiati dal critico.
        let riderNote = "";
        if (rider && riderSkill) {
          const r = rollDetail(resolveSkillFormula(riderSkill));
          totalDamage += r.total;
          riderNote = ` + ${rider.name} ${r.detail}=${r.total}`;
        }
        if (isCritical) totalDamage *= 2;
        let dieDetail = `Dado ${diePart}[${rolls.join("+")}]`;
        let damageString = `🎯 COLPITO! | 🎲 ${dieDetail} ${staticBonus !== 0 ? "+ bonus(" + staticBonus + ")" : ""}${riderNote}`;
        if (isCritical) damageString = `🔥 CRITICO! | (${dieRollTotal} + ${staticBonus}${riderNote}) x2`;
        if (charData?.class?.toLowerCase() === "ladro" || charData?.class?.toLowerCase() === "rogue") {
          const sneakDice = (charData?.level ?? 1) >= 3 ? 2 : 1;
          const sneakRolls = [];
          let sneakTotal = 0;
          for (let i = 0; i < sneakDice; i++) {
            const r = Math.floor(Math.random() * 6) + 1;
            sneakRolls.push(r);
            sneakTotal += r;
          }
          totalDamage += sneakTotal;
          damageString += ` + ${sneakDice}d6 Furtivo(${sneakRolls.join("+")}=${sneakTotal})`;
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
        await updateDoc(enemyRef(boss), { hp: newHp, shield: newShield });
        actionData.damageRoll = `${damageString} = 💥 ${totalDamage} DANNI!`;
        if (newShield < currentShield) actionData.damageRoll += " 🛡️ Scudo colpito!";
        if (newHp <= 0) actionData.damageRoll += ` ☠ ${boss.name} cade!`;
        Object.assign(actionData, fxFields(fxAction, [boss.vfxKey], { from: `player-${myUid}`, kill: newHp <= 0 ? [boss.vfxKey] : [] }));
        // uso limitato speso solo a colpo andato a segno (lo smite si decide dopo il colpo)
        await markSkillUsed(rider, riderSkill);
        await markSkillUsed(action, skill);
      } else {
        actionData.damageRoll = "🛡️ MANCATO! Il colpo non incide.";
        // il colpo parte lo stesso, ma sul bersaglio compare "mancato" invece dello scoppio
        Object.assign(actionData, fxFields(fxAction, [boss.vfxKey], { from: `player-${myUid}`, miss: [boss.vfxKey] }));
      }
      await addDoc(collection(db, "world_boss_chat"), actionData);
      if (activeBosses[0]?.id) {
        await updateDoc(doc(db, "battle_meta", "turn_tracker"), {
          [`attackCounts.${activeBosses[0].id}.${currentUser.uid}`]: increment(1),
        });
      }
      await endMyTurn();
    } else {
      Object.assign(actionData, fxFields(action, [`player-${myUid}`], { kind: "buff" }));
      await addDoc(collection(db, "world_boss_chat"), actionData);
    }
  };

  const toggleTarget = (uid) => {
    setSelectedTargets((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]);
  };

  // Attacco/abilità di un NEMICO (boss o minion evocato): stessa logica, cambia il doc.
  // `targetIdsArg` = bersagli scelti nel pannello Master (passo 2); senza, i selezionati.
  const handleBossRoll = async (bossOrMinion, action, targetIdsArg) => {
    const targets = Array.isArray(targetIdsArg) ? targetIdsArg : selectedTargets;
    if (isFightOver) return alert("La battaglia è terminata: nessun attacco possibile.");
    const boss = bossOrMinion.kind ? bossOrMinion : { ...bossOrMinion, kind: "boss", vfxKey: "boss" };
    if ((boss.hp ?? 0) <= 0) return alert(`${boss.name} è a terra: non può agire.`);
    const who = boss.kind === "minion" ? boss.name : "Il Boss";
    const actionType = action.type || "attack";

    // ── HEAL: boss restores HP by NdT + bonus ──
    if (actionType === "heal") {
      const formula = `${parseInt(action.diceNum) || 1}${action.diceType || "d6"}+${parseInt(action.bonus) || 0}`;
      const healed = rollDice(formula);
      const newHp = Math.min(boss.maxHp ?? boss.hp ?? 0, (boss.hp || 0) + healed);
      await updateDoc(enemyRef(boss), { hp: newHp });
      await addDoc(collection(db, "world_boss_chat"), {
        uid: BOSS_SYSTEM_UID, senderName: boss.name, type: "action", category: "Cura Boss",
        actionName: action.name,
        description: `${who} invoca ${action.name} e si cura di 💖 ${healed} HP (${formula}). HP: ${newHp}/${boss.maxHp ?? "?"}.`,
        ...fxFields(action, [boss.vfxKey], { kind: "heal" }),
        timestamp: serverTimestamp(),
      });
      return;
    }

    // ── BUFF +CA: bump boss CA by acBonus ──
    if (actionType === "buff_ca") {
      const bump = parseInt(action.acBonus) || 0;
      if (bump <= 0) return alert("Imposta un bonus CA > 0 per questa abilità.");
      const newAc = (boss.ac || 10) + bump;
      await updateDoc(enemyRef(boss), { ac: newAc });
      await addDoc(collection(db, "world_boss_chat"), {
        uid: BOSS_SYSTEM_UID, senderName: boss.name, type: "action", category: "Buff Boss",
        actionName: action.name,
        description: `${who} usa ${action.name}: 🛡 CA +${bump} (ora ${newAc}).`,
        ...fxFields(action, [boss.vfxKey], { kind: "shield" }),
        timestamp: serverTimestamp(),
      });
      return;
    }

    // ── BUFF advantage: boss gains advantage on its next attack ──
    if (actionType === "buff_adv") {
      await updateDoc(enemyRef(boss), { nextTurnCondition: "advantage", debuffSource: action.name || null });
      await addDoc(collection(db, "world_boss_chat"), {
        uid: BOSS_SYSTEM_UID, senderName: boss.name, type: "action", category: "Buff Boss",
        actionName: action.name,
        description: `${who} invoca ${action.name}: ⬆ vantaggio sul prossimo attacco.`,
        ...fxFields(action, [boss.vfxKey], { kind: "buff" }),
        timestamp: serverTimestamp(),
      });
      return;
    }

    // ── DEBUFF disadvantage: selected players' next roll has disadvantage ──
    if (actionType === "debuff_dis") {
      if (targets.length === 0) return alert("DM, seleziona almeno un bersaglio!");
      const batch = writeBatch(db);
      targets.forEach((uid) => {
        batch.update(doc(db, "characters", uid), { nextTurnCondition: "disadvantage" });
      });
      await batch.commit();
      const names = players
        .filter((p) => targets.includes(p.id))
        .map((p) => (p.name || "").split(" ")[0])
        .join(", ");
      await addDoc(collection(db, "world_boss_chat"), {
        uid: BOSS_SYSTEM_UID, senderName: boss.name, type: "action", category: "Debuff Boss",
        actionName: action.name,
        description: `${who} colpisce con ${action.name}: ⬇ svantaggio sul prossimo tiro di ${names}.`,
        ...fxFields(action, targets.map((uid) => `player-${uid}`), { kind: "debuff", from: boss.vfxKey }),
        timestamp: serverTimestamp(),
      });
      setSelectedTargets([]);
      return;
    }

    // ── ATTACCO AD AREA (forma scelta nell'editor): colpisce TUTTI gli eroi vivi
    // (o solo i selezionati, se il Master ne ha scelti); ognuno tira il TS contro
    // la CD del nemico (spellDC del doc, default 13). Superato = metà (o niente).
    const bossAoe = areaSpellFor(action);
    if (bossAoe) {
      const alive = players.filter((p) => (p.stats?.hp ?? 0) > 0);
      const pool = targets.length ? alive.filter((p) => targets.includes(p.id)) : alive;
      if (!pool.length) return alert("Nessun eroe in piedi da colpire.");
      const dc = parseInt(boss.spellDC) || 13;
      const formula = action.damage || `${parseInt(action.diceNum) || 1}${action.diceType || "d6"}`;
      const total = rollDice(formula);
      const results = [];
      for (const p of pool) {
        const roll = rollD20();
        const mod = statSave(p, bossAoe.save);
        const saved = roll + mod >= dc;
        const dmg = saved ? (bossAoe.half ? Math.floor(total / 2) : 0) : total;
        let rem = dmg;
        let shield = p.stats?.shield || 0;
        const hp = p.stats?.hp || 0;
        if (shield > 0) { if (shield >= rem) { shield -= rem; rem = 0; } else { rem -= shield; shield = 0; } }
        const newHp = Math.max(0, hp - rem);
        if (dmg > 0) await updateDoc(doc(db, "characters", p.id), { "stats.hp": newHp, "stats.shield": shield });
        results.push({ id: p.id, name: (p.name || "Eroe").split(" ")[0], hit: dmg > 0, roll: `TS ${SAVE_LABEL_IT[bossAoe.save] || bossAoe.save} d20(${roll})${mod ? (mod > 0 ? "+" : "") + mod : ""}=${roll + mod} vs CD ${dc}${saved ? " ✅" : " ❌"}`, dmg, killed: newHp <= 0 && hp > 0 });
      }
      const line = results.map((r) => `${r.name} −${r.dmg}${r.dmg === 0 ? " (evitato)" : r.dmg < total ? " (metà)" : ""}${r.killed ? " ☠" : ""}`).join(", ");
      await addDoc(collection(db, "world_boss_chat"), {
        uid: BOSS_SYSTEM_UID, senderName: boss.name, type: "action", category: "Attacco Boss",
        actionName: `${action.name} (AREA)`,
        description: `${who} scatena ${action.name} su tutta la zona · CD ${dc}, TS ${SAVE_LABEL_IT[bossAoe.save] || bossAoe.save} · Danni ${formula} = ${total} → ${line}`,
        masterDetails: results, timestamp: serverTimestamp(),
        ...fxFields(action, results.map((r) => `player-${r.id}`), {
          kind: "aoe", from: boss.vfxKey,
          miss: results.filter((r) => r.dmg === 0).map((r) => `player-${r.id}`),
          kill: results.filter((r) => r.killed).map((r) => `player-${r.id}`),
        }),
      });
      setSelectedTargets([]);
      return;
    }

    // ── ATTACK (default) ──
    if (targets.length === 0) return alert("DM, seleziona almeno un bersaglio!");
    // Consume any debuff condition (e.g. svantaggio applied by a player spell)
    const condition = boss.nextTurnCondition;
    let d20, rollLabel;
    if (condition === "advantage" || condition === "disadvantage") {
      const r1 = Math.floor(Math.random() * 20) + 1;
      const r2 = Math.floor(Math.random() * 20) + 1;
      d20 = condition === "advantage" ? Math.max(r1, r2) : Math.min(r1, r2);
      rollLabel = `${condition === "advantage" ? "⬆ Vantaggio" : "⬇ Svantaggio"}[${r1},${r2}]→${d20}`;
      // Clear after use so it only applies to one roll.
      try { await updateDoc(enemyRef(boss), { nextTurnCondition: null, debuffSource: null }); } catch (_) {}
    } else {
      d20 = Math.floor(Math.random() * 20) + 1;
      rollLabel = `d20(${d20})`;
    }
    const bossBonus = parseInt(action.bonus) || 0;
    const hitTotal = d20 + bossBonus;
    const damageFormula = action.damage || `${parseInt(action.diceNum) || 1}${action.diceType || "d6"}`;
    const damageDealt = rollDice(damageFormula);
    const results = [];
    for (const targetId of targets) {
      const p = players.find((player) => player.id === targetId);
      if (!p) continue;
      const baseCA = p.stats?.ac || 10;
      const buffBonus = p.selfAcBonus || 0;
      const playerCA = baseCA + buffBonus;
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
      const caStr = buffBonus > 0
        ? `CA ${playerCA} (${baseCA}+${buffBonus} ${p.selfAcSource || "buff"})`
        : `CA ${playerCA}`;
      results.push({ id: targetId, name: p.name.split(" ")[0], hit: isHit, roll: `${hitTotal} (${d20}+${bossBonus}) vs ${caStr}`, dmg: isHit ? damageDealt : 0, killed: isHit && (p.stats?.hp || 0) > 0 && Math.max(0, (p.stats?.hp || 0) - Math.max(0, damageDealt - (p.stats?.shield || 0))) <= 0 });
    }
    const hitTargets = results.filter((r) => r.hit).map((r) => r.name).join(", ");
    const missedTargets = results.filter((r) => !r.hit).map((r) => r.name).join(", ");
    const allTargetIds = results.map((r) => `player-${r.id}`);
    const missTargetIds = results.filter((r) => !r.hit).map((r) => `player-${r.id}`);
    const killTargetIds = results.filter((r) => r.killed).map((r) => `player-${r.id}`);
    const condTag = condition === "disadvantage" ? " 🌑(svantaggio)" : condition === "advantage" ? " ⬆(vantaggio)" : "";
    await addDoc(collection(db, "world_boss_chat"), {
      uid: BOSS_SYSTEM_UID, senderName: boss.name, type: "action", category: "Attacco Boss",
      actionName: action.name,
      description: `${who} scatena ${action.name}${condTag} · Tiro: ${rollLabel} + ${bossBonus} = ${hitTotal} (Danni: ${damageDealt})! ${hitTargets.length > 0 ? "Colpisce: " + hitTargets : ""}${missedTargets.length > 0 ? ". Mancati: " + missedTargets : ""}`,
      masterDetails: results, timestamp: serverTimestamp(),
      ...fxFields(action, allTargetIds, { from: boss.vfxKey, miss: missTargetIds, kill: killTargetIds }),
    });
    setSelectedTargets([]);
  };

  // Cura/ferita manuale di un eroe: mai sotto 0 né sopra i PF massimi.
  const adjustHeroHp = async (p, delta) => {
    const hp = p.stats?.hp ?? 0;
    const maxHp = p.stats?.maxHp ?? Math.max(1, hp);
    const newHp = Math.max(0, Math.min(maxHp, hp + delta));
    if (newHp === hp) return;
    await updateDoc(doc(db, "characters", p.id), { "stats.hp": newHp });
  };
  // Cura manuale di boss o minion (l'attaccante scelto nel pannello).
  const healEnemyManual = async (e, amount) => {
    if (!e) return;
    await updateDoc(enemyRef(e), { hp: Math.min(e.maxHp ?? e.hp ?? 0, (e.hp || 0) + amount) });
  };

  const shieldBossManual = async () => {
    const boss = activeBosses[0];
    if (!boss) return;
    const val = prompt("Quanti HP di scudo vuoi dare al Boss?");
    if (val && !isNaN(val)) {
      await updateDoc(doc(db, "bosses", boss.id), { shield: increment(parseInt(val)) });
    }
  };

  // ── MINION (solo Master): evoca dalla Caserma, cura/scuda/congeda ──
  const spawnMinion = async () => {
    const def = minionDefs.find((d) => d.id === spawnDefId) || minionDefs[0];
    if (!def) return alert("Nessun minion attivo in Caserma: crealo e attivalo in DM Admin → World Boss.");
    const sameKind = minionInstances.filter((m) => m.defId === def.id).length;
    const name = sameKind > 0 ? `${def.name} ${sameKind + 1}` : def.name;
    try {
      await addDoc(collection(db, "world_boss_minions"), {
        defId: def.id, name,
        hp: parseInt(def.hp) || 1, maxHp: parseInt(def.hp) || 1, ac: parseInt(def.ac) || 10, shield: 0,
        imageUrl: def.imageUrl || "", deadImageUrl: def.deadImageUrl || "",
        facing: def.facing === "right" ? "right" : "left",
        actions: Array.isArray(def.actions) ? def.actions.filter((a) => a && a.name) : [],
        nextTurnCondition: null, debuffSource: null,
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, "world_boss_chat"), {
        uid: BOSS_SYSTEM_UID, senderName: "Master System", type: "notification",
        content: `🪓 ${name} entra in battaglia al fianco di ${activeBosses[0]?.name || "del Boss"}!`,
        timestamp: serverTimestamp(), isSystem: true,
      });
    } catch (e) {
      console.error("Errore evocazione minion:", e);
      alert("Evocazione fallita: " + (e.message || e));
    }
  };
  const shieldMinionManual = async (m) => {
    const val = prompt(`Quanti HP di scudo vuoi dare a ${m.name}?`);
    if (val && !isNaN(val)) await updateDoc(doc(db, "world_boss_minions", m.id), { shield: increment(parseInt(val)) });
  };
  const removeMinion = async (m) => {
    if (!window.confirm(`Congedare ${m.name} dalla battaglia?`)) return;
    await deleteDoc(doc(db, "world_boss_minions", m.id));
  };
  const clearMinions = async () => {
    if (!minionInstances.length || !window.confirm("Congedare TUTTI i minion evocati?")) return;
    const batch = writeBatch(db);
    minionInstances.forEach((m) => batch.delete(doc(db, "world_boss_minions", m.id)));
    await batch.commit();
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
    const seenSkills = new Map(); // nome → indice nella categoria (la sync duplica alcune voci)
    return charData.actions.reduce((acc, action) => {
      const cat = action.category || "Altro";
      // Categoria "Abilità": entrano SOLO quelle usabili (danno / cura / scudo / +CA) riconosciute
      // da skillKindFor; le passive restano fuori. Doppioni: una voce sola, tenendo quella con i dadi.
      if (isSkillCategory(cat)) {
        if (!skillKindFor(action)) return acc;
        if (!acc[cat]) acc[cat] = [];
        const key = String(action.name || "").trim().toLowerCase();
        if (seenSkills.has(key)) {
          const i = seenSkills.get(key);
          if (!/\d+d\d+/.test(String(acc[cat][i].damage || "")) && /\d+d\d+/.test(String(action.damage || ""))) acc[cat][i] = action;
          return acc;
        }
        seenSkills.set(key, acc[cat].length);
        acc[cat].push(action);
        return acc;
      }
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
    const last = actionMsgs[0]; // i messaggi arrivano dal più recente (orderBy desc)
    return `${last.senderName} · ${last.actionName}`;
  }, [messages]);

  const isPlayerDead = !isMaster && (charData?.stats?.hp ?? 0) <= 0;

  const isUserLocked =
    !isMaster && (!fightStarted || turnState.phase === "boss" || turnState.actedPlayers.includes(myUid) || isPlayerDead || isFightOver);

  if (!currentUser) return <div className="rpg-denied">Loggati per entrare.</div>;

  const boss = activeBosses[0] ?? null;
  const isGameOver = areAllEnemiesDead || isTimeExpired || areAllPlayersDead;
  // il giocatore può scegliere il bersaglio solo se in scena c'è più di un nemico vivo
  const canPickTarget = !isMaster && livingEnemies.length > 1 && !isGameOver;
  const partyForDisplay = players.length > 0
    ? players
    : charData ? [{ id: currentUser.uid, ...charData }] : [];

  return (
    <div className="rpg-screen">
      <VfxLayer messages={messages} />

      {/* ── ACTION BANNER ── */}
      <div className="rpg-action-banner">
        <span className="rpg-banner-text">
          {(areAllEnemiesDead ? "🏆 VITTORIA DEGLI EROI!" : null)
            || (isBossDefeated && !areAllEnemiesDead && !isTimeExpired ? `⚔ ${boss?.name || "Il Boss"} è caduto! Abbattete i suoi servi!` : null)
            || lastActionText
            || (boss && !fightStarted ? `${boss.name} minaccia Exanthia!` : null)
            || (fightStarted && !isGameOver
              ? (turnState.phase === "players" ? "⚔ Turno degli Eroi" : "🔥 Il Boss Attacca!")
              : null)
            || (isTimeExpired ? "💀 IL BOSS HA PREVALSO!" : areAllPlayersDead ? "💀 GLI EROI SONO CADUTI!" : "—")}
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
        <div className={`rpg-boss-zone ${minionInstances.length > 0 ? "has-minions" : ""}`}>
          {!boss ? (
            <p className="rpg-no-boss-msg">Nessun boss attivo</p>
          ) : (
            <div
              data-vfx-target="boss"
              className={`rpg-boss-sprite-wrap ${isBossDefeated ? "dead" : ""} ${fightStarted && turnState.phase === "boss" && !isGameOver ? "boss-turn" : ""} ${canPickTarget && currentTarget?.id === boss.id ? "is-target" : ""} ${canPickTarget && !isBossDefeated ? "pickable" : ""}`}
              onClick={() => { if (canPickTarget && !isBossDefeated) setTargetId(boss.id); }}
              role={canPickTarget && !isBossDefeated ? "button" : undefined}
              title={canPickTarget && !isBossDefeated ? `Bersaglio: ${boss.name}` : undefined}
            >
              {canPickTarget && currentTarget?.id === boss.id && <span className="rpg-target-arrow" aria-hidden="true">▼</span>}
              <img
                className={`rpg-boss-sprite${boss.facing === "right" ? " faces-right" : ""}`}
                src={(isBossDefeated && boss.deadImageUrl) ? boss.deadImageUrl : (boss.imageUrl || "/assets/default-boss.png")}
                alt={boss.name}
              />
              {isBossDefeated && <div className="rpg-torn-overlay" />}
            </div>
          )}

          {/* Servi evocati: fila di sprite più piccoli ai piedi del boss */}
          {minionInstances.length > 0 && (
            <div className="rpg-minion-row">
              {minionInstances.map((m) => {
                const dead = (m.hp ?? 0) <= 0;
                const pct = Math.max(0, Math.min(100, ((m.hp ?? 0) / Math.max(1, m.maxHp ?? 1)) * 100));
                const isTgt = canPickTarget && currentTarget?.id === m.id;
                const pickable = canPickTarget && !dead;
                const sprite = dead ? (m.deadImageUrl || m.imageUrl) : m.imageUrl;
                return (
                  <div
                    key={m.id}
                    data-vfx-target={`minion-${m.id}`}
                    className={`rpg-minion-wrap ${dead ? "dead" : ""} ${isTgt ? "is-target" : ""} ${pickable ? "pickable" : ""} ${fightStarted && turnState.phase === "boss" && !isGameOver && !dead ? "boss-turn" : ""}`}
                    onClick={() => { if (pickable) setTargetId(m.id); }}
                    role={pickable ? "button" : undefined}
                    title={pickable ? `Bersaglio: ${m.name}` : m.name}
                  >
                    {isTgt && <span className="rpg-target-arrow" aria-hidden="true">▼</span>}
                    {sprite
                      ? <img className={`rpg-minion-sprite${m.facing === "right" ? " faces-right" : ""}`} src={sprite} alt={m.name} />
                      : <div className="rpg-minion-placeholder">{dead ? "☠" : "🪓"}</div>}
                    <span className="rpg-minion-tag">{m.name}</span>
                    <span className="rpg-minion-hpbar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
                  </div>
                );
              })}
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
        {areAllEnemiesDead && (
          <div className="rpg-scene-banner rpg-scene-banner--victory">🏆 VITTORIA DEGLI EROI 🏆</div>
        )}
        {isTimeExpired && (
          <div className="rpg-scene-banner rpg-scene-banner--defeat">💀 IL BOSS HA PREVALSO 💀</div>
        )}
        {areAllPlayersDead && !areAllEnemiesDead && !isTimeExpired && (
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
          {[
            ["status", "🛡", "Status"],
            ["actions", "⚔", "Azioni"],
            ["log", "📜", "Log"],
          ].map(([key, icon, label]) => (
            <button key={key} className={`rpg-mob-tab${mobileTab===key?" active":""}`} onClick={() => setMobileTab(key)}>
              <span className="rpg-tab-icon">{icon}</span>
              <span className="rpg-tab-label">{label}</span>
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
            {minionInstances.length > 0 && (
              <div className="rpg-hud-minions">
                {minionInstances.map((m) => {
                  const dead = (m.hp ?? 0) <= 0;
                  const pct = Math.max(0, Math.min(100, ((m.hp ?? 0) / Math.max(1, m.maxHp ?? 1)) * 100));
                  return (
                    <div key={m.id} className={`rpg-hud-minion ${dead ? "dead" : ""}`}>
                      <span className="rpg-hud-minion-name">{dead ? "☠" : "🪓"} {m.name}</span>
                      <div className="rpg-bar-track rpg-bar-track--sm">
                        <div className={`rpg-bar-hp ${pct < 25 ? "crit" : pct < 50 ? "low" : ""}`} style={{ width: `${pct}%` }} />
                        {(m.shield ?? 0) > 0 && (
                          <div className="rpg-bar-shield" style={{ width: `${Math.min(100, (m.shield / Math.max(1, m.maxHp ?? 1)) * 100)}%` }} />
                        )}
                      </div>
                      {isMaster && <span className="rpg-hud-hp-val">{m.hp} / {m.maxHp}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            {fightStarted && !isGameOver && (
              <div className="rpg-hud-turn-row">
                <span className={`rpg-phase-pill ${turnState.phase}`}>
                  {turnState.phase === "players" ? "⚔ EROI" : "🔥 BOSS"}
                </span>
                <span className={`rpg-hud-timer ${isUrgent ? "urgent" : ""}`}>
                  T{turnState.turnNumber} · {formatTime(timeLeft)}
                </span>
                {turnState.phase === "players" && (
                  <span
                    className={`rpg-hud-quorum ${quorumReached ? "reached" : ""}`}
                    title={quorumReached
                      ? "Quorum raggiunto: il turno si chiude entro 10 minuti"
                      : `Hanno agito ${actedAlive} eroi su ${alivePlayerIds.length}: al ${quorumNeeded}° il turno si chiude in 10 minuti`}
                  >
                    {quorumReached ? `⏱ ${actedAlive}/${alivePlayerIds.length} · chiusura in 10 min` : `⚔ ${actedAlive}/${alivePlayerIds.length} · quorum ${quorumNeeded}`}
                  </span>
                )}
              </div>
            )}
            {!isGameOver && boss.expiryDate && (
              <div className={`rpg-event-expiry ${bossTimeLeft != null && bossTimeLeft < 60 * 60 * 1000 ? "urgent" : ""}`}>
                <span className="rpg-event-label">⏳ Tempo del Boss:</span>
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
          {boss.penalties && !areAllEnemiesDead && (
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

                {/* ── Turno: stato + due leve ── */}
                <div className="rpg-turn-bar">
                  <div className="rpg-turn-info">
                    <strong>{!fightStarted ? "⏳ Battaglia non iniziata" : turnState.phase === "boss" ? "🔥 Turno del Boss" : "⚔ Turno degli Eroi"}</strong>
                    <span title={`Quorum ${quorumNeeded} su ${alivePlayerIds.length} attivi vivi (${activePlayers.length} attivi su ${players.length} iscritti): al raggiungimento il turno si chiude in 10 min`}>
                      {actedAlive}/{alivePlayerIds.length} hanno agito · quorum {quorumNeeded}{quorumReached ? " ✓ (chiusura in 10 min)" : ""}
                    </span>
                  </div>
                  <div className="rpg-btn-row rpg-turn-btns">
                    <button className={`rpg-btn rpg-btn--hero${fightStarted && turnState.phase === "players" ? " is-on" : ""}`} onClick={() => handleManualTurnChange("players")}>⚔ Passa agli Eroi</button>
                    <button className={`rpg-btn rpg-btn--boss${fightStarted && turnState.phase === "boss" ? " is-on" : ""}`} onClick={() => handleManualTurnChange("boss")}>🔥 Passa al Boss</button>
                  </div>
                </div>

                {/* ── ATTACCO in 3 passi: chi attacca → contro chi → con cosa ── */}
                <section className="rpg-flow rpg-flow--who">
                  <header className="rpg-flow-head">
                    <span className="rpg-flow-num">1</span>
                    <span className="rpg-flow-title">Chi attacca</span>
                    <button className={`rpg-sm-btn${spawnOpen ? " active" : ""}`} onClick={() => setSpawnOpen((o) => !o)}>➕ Evoca minion</button>
                  </header>
                  {spawnOpen && (
                    <div className="rpg-flow-spawn">
                      <div className="rpg-minion-spawn">
                        <select className="rpg-select" value={spawnDefId} onChange={(e) => setSpawnDefId(e.target.value)} disabled={!minionDefs.length}>
                          {minionDefs.length === 0
                            ? <option value="">Nessuna sagoma in Caserma</option>
                            : minionDefs.map((d) => <option key={d.id} value={d.id}>{d.isActive ? "⚡ " : ""}{d.name} · {d.hp} HP · CA {d.ac}</option>)}
                        </select>
                        <button className="rpg-btn rpg-btn--hero rpg-btn--spawn" onClick={spawnMinion} disabled={!minionDefs.length}>Evoca</button>
                      </div>
                      <p className="rpg-hint">
                        {minionDefs.length === 0
                          ? "Nessuna sagoma: creala nella Caserma (DM Admin → World Boss Fight), poi torna qui."
                          : "Il servo compare in scena accanto al boss e qui sotto come attaccante. Puoi evocarne più copie."}
                        {minionInstances.length > 0 && <> <button className="rpg-link-btn" onClick={clearMinions}>Congeda tutti i minion ({minionInstances.length})</button></>}
                      </p>
                    </div>
                  )}
                  <div className="rpg-attacker-strip">
                    {enemies.map((e) => {
                      const dead = (e.hp ?? 0) <= 0;
                      const pct = Math.max(0, Math.min(100, ((e.hp ?? 0) / Math.max(1, e.maxHp ?? 1)) * 100));
                      const on = attacker?.id === e.id;
                      return (
                        <button
                          key={e.id}
                          className={`rpg-attacker-chip${on ? " on" : ""}${dead ? " dead" : ""}${e.kind === "boss" ? " is-boss" : ""}`}
                          disabled={dead}
                          onClick={() => setAttackerId(e.id)}
                          title={dead ? `${e.name} è a terra` : `Attacca con ${e.name}`}
                        >
                          <span className="rpg-attacker-chip-ico">{dead ? "☠" : e.kind === "boss" ? "👑" : "🪓"}</span>
                          <span className="rpg-attacker-chip-name">{e.name}</span>
                          <span className="rpg-attacker-chip-hp"><i style={{ width: `${pct}%` }} /></span>
                          <span className="rpg-attacker-chip-val">{e.hp}/{e.maxHp ?? "?"}</span>
                        </button>
                      );
                    })}
                    {enemies.length === 0 && <span className="rpg-hint">Nessun boss attivo.</span>}
                  </div>
                  {attacker && (
                    <div className="rpg-attacker-care">
                      <span className="rpg-attacker-care-txt">
                        {attacker.kind === "boss" ? "👑" : "🪓"} <b>{attacker.name}</b> · {attacker.hp}/{attacker.maxHp ?? "?"} HP · CA {attacker.ac ?? "?"}
                        {(attacker.shield ?? 0) > 0 ? ` · 🛡 ${attacker.shield}` : ""}
                        {attacker.nextTurnCondition === "advantage" ? " · ⬆ vantaggio" : attacker.nextTurnCondition === "disadvantage" ? " · 🌑 svantaggio" : ""}
                      </span>
                      <span className="rpg-attacker-care-btns">
                        <button className="rpg-sm-btn rpg-sm-btn--heal" onClick={() => healEnemyManual(attacker, 5)}>+5</button>
                        <button className="rpg-sm-btn rpg-sm-btn--heal" onClick={() => healEnemyManual(attacker, 10)}>+10</button>
                        <button className="rpg-sm-btn" onClick={() => attacker.kind === "minion" ? shieldMinionManual(attacker) : shieldBossManual()}>🛡 Scudo</button>
                        {attacker.kind === "minion" && <button className="rpg-sm-btn rpg-sm-btn--danger" onClick={() => removeMinion(attacker)}>✕ Congeda</button>}
                      </span>
                    </div>
                  )}
                </section>

                <section className="rpg-flow rpg-flow--target">
                  <header className="rpg-flow-head">
                    <span className="rpg-flow-num">2</span>
                    <span className="rpg-flow-title">Contro chi</span>
                  </header>
                  <div className="rpg-seg">
                    <button className={`rpg-seg-btn${targetMode === "all" ? " on" : ""}`} onClick={() => setTargetMode("all")}>
                      Tutti gli eroi vivi <b>{aliveHeroes.length}</b>
                    </button>
                    <button className={`rpg-seg-btn${targetMode === "pick" ? " on" : ""}`} onClick={() => setTargetMode("pick")}>
                      Scelgo io <b>{selectedAliveIds.length}</b>
                    </button>
                  </div>
                  {targetMode === "pick" && (
                    <div className="rpg-hero-chips">
                      {aliveHeroes.map((p) => {
                        const on = selectedTargets.includes(p.id);
                        const hp = p.stats?.hp ?? 0, maxHp = p.stats?.maxHp ?? 1;
                        const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
                        return (
                          <button key={p.id} className={`rpg-hero-chip${on ? " on" : ""}`} onClick={() => toggleTarget(p.id)} title={`CA ${(p.stats?.ac || 10) + (p.selfAcBonus || 0)}`}>
                            <span className="rpg-hero-chip-check" aria-hidden="true">{on ? "✓" : ""}</span>
                            <span className="rpg-hero-chip-name">{(p.name || "?").split(" ")[0]}</span>
                            <span className="rpg-hero-chip-hp"><i className={pct < 25 ? "crit" : pct < 50 ? "low" : ""} style={{ width: `${pct}%` }} /></span>
                            <span className="rpg-hero-chip-val">{hp}/{maxHp}</span>
                          </button>
                        );
                      })}
                      {aliveHeroes.length === 0 && <span className="rpg-hint">Nessun eroe in piedi.</span>}
                      {aliveHeroes.length > 1 && (
                        <button className="rpg-link-btn" onClick={() => setSelectedTargets(selectedAliveIds.length === aliveHeroes.length ? [] : aliveHeroes.map((p) => p.id))}>
                          {selectedAliveIds.length === aliveHeroes.length ? "Deseleziona tutti" : "Seleziona tutti"}
                        </button>
                      )}
                    </div>
                  )}
                  <p className={`rpg-flow-summary${masterTargetIds.length === 0 ? " is-empty" : ""}`}>
                    {masterTargetIds.length === 0
                      ? (targetMode === "pick" ? "Nessun bersaglio scelto: tocca gli eroi qui sopra." : "Nessun eroe in piedi.")
                      : `→ ${masterTargetNames}`}
                  </p>
                </section>

                <section className="rpg-flow rpg-flow--what">
                  <header className="rpg-flow-head">
                    <span className="rpg-flow-num">3</span>
                    <span className="rpg-flow-title">Con cosa</span>
                    {attacker && <span className="rpg-flow-sub">di {attacker.name}</span>}
                  </header>
                  {attacker ? (
                    <div className="rpg-act-list">
                      {attackerActions.map((a, i) => {
                        const meta = masterActionMeta(a);
                        const blocked = meta.needs && masterTargetIds.length === 0;
                        return (
                          <button
                            key={i}
                            className={`rpg-act-btn rpg-act-btn--${meta.kind}`}
                            disabled={blocked || isFightOver}
                            onClick={() => handleBossRoll(attacker, a, masterTargetIds)}
                            title={blocked ? "Scegli prima un bersaglio (passo 2)" : undefined}
                          >
                            <span className="rpg-act-btn-ico">{meta.ico}</span>
                            <span className="rpg-act-btn-name">{a.name}</span>
                            <span className="rpg-act-btn-tag">{meta.tag}</span>
                          </button>
                        );
                      })}
                      {attackerActions.length === 0 && <p className="rpg-hint">{attacker.name} non ha attacchi salvati (DM Admin → World Boss).</p>}
                    </div>
                  ) : (
                    <p className="rpg-hint">Scegli prima chi attacca (passo 1).</p>
                  )}
                  {isFightOver && <p className="rpg-hint">La battaglia è terminata: nessun attacco possibile.</p>}
                </section>

                {/* ── EROI: cura & ferite (tocca un eroe per aprire i comandi) ── */}
                <div className="rpg-section-label rpg-section-label--players">
                  <span>Eroi · cura &amp; ferite <span className="rpg-section-count">({shownHeroes.length})</span></span>
                  <span className="rpg-section-tools">
                    <button className="rpg-sm-btn rpg-sm-btn--heal" onClick={healAllPlayers}>💖 Tutti al massimo</button>
                  </span>
                </div>
                <p className="rpg-hint">Tocca un eroe: si aprono i comandi per curarlo (poco, tanto o del tutto), ferirlo, dargli scudo o vantaggio.</p>
                <div className="rpg-hero-list">
                  {shownHeroes.map((p) => {
                    const hp     = p.stats?.hp ?? 0;
                    const maxHp  = p.stats?.maxHp ?? 1;
                    const pct    = Math.max(0, Math.min(100, (hp / maxHp) * 100));
                    const hpCls  = pct < 25 ? "crit" : pct < 50 ? "low" : "";
                    const acted  = turnState.actedPlayers?.includes(p.id);
                    const isDead = hp <= 0;
                    const open   = heroOpenId === p.id;
                    const amount = Math.max(1, parseInt(heroAmount) || 1);
                    const shieldAmt = Math.max(1, parseInt(heroShield) || 1);
                    return (
                      <div key={p.id} className={`rpg-hero-row${acted ? " acted" : ""}${isDead ? " dead" : ""}${open ? " open" : ""}${isHiddenChar(p) ? " inactive" : ""}`}>
                        <button className="rpg-hero-row-head" onClick={() => setHeroOpenId(open ? null : p.id)} aria-expanded={open}>
                          <span className="rpg-hero-row-name">
                            {(p.name || "?").split(" ")[0]}
                            {acted && <span className="rpg-check-mark" title="Ha già agito">✓</span>}
                            {isDead && <span className="rpg-dead-mark" title="A terra">💀</span>}
                            {(p.stats?.shield ?? 0) > 0 && <span className="rpg-ca-badge">🛡 {p.stats.shield}</span>}
                            {(p.selfAcBonus ?? 0) > 0 && <span className="rpg-ca-badge" title={p.selfAcSource || "Buff CA attivo"}>+{p.selfAcBonus} CA</span>}
                            {p.nextTurnCondition === "advantage" && <span className="rpg-ca-badge" title="Vantaggio al prossimo tiro">⬆</span>}
                            {p.nextTurnCondition === "disadvantage" && <span className="rpg-ca-badge rpg-ca-badge--dis" title="Svantaggio al prossimo tiro">⬇</span>}
                          </span>
                          <span className={`rpg-hero-row-hp ${hpCls}`}>{hp}/{maxHp}</span>
                          <span className="rpg-hero-row-chev" aria-hidden="true">{open ? "▴" : "▾"}</span>
                          <div className="rpg-bar-track rpg-bar-track--sm">
                            <div className={`rpg-bar-hp ${hpCls}`} style={{ width: `${pct}%` }} />
                            {(p.stats?.shield ?? 0) > 0 && (
                              <div className="rpg-bar-shield" style={{ width: `${Math.min(100, (p.stats.shield / maxHp) * 100)}%` }} />
                            )}
                          </div>
                        </button>
                        {open && (
                          <div className="rpg-hero-edit">
                            <div className="rpg-hero-edit-row">
                              <span className="rpg-hero-edit-lbl rpg-hero-edit-lbl--dmg">🩸 Ferisci</span>
                              {[1, 3, 5, 10].map((n) => (
                                <button key={n} className="rpg-sm-btn rpg-sm-btn--danger" disabled={hp <= 0} onClick={() => adjustHeroHp(p, -n)}>−{n}</button>
                              ))}
                              <button className="rpg-sm-btn rpg-sm-btn--danger rpg-sm-btn--wide" disabled={hp <= 0} onClick={() => adjustHeroHp(p, -maxHp)}>A terra</button>
                            </div>
                            <div className="rpg-hero-edit-row">
                              <span className="rpg-hero-edit-lbl rpg-hero-edit-lbl--heal">💚 Cura</span>
                              {[1, 3, 5, 10].map((n) => (
                                <button key={n} className="rpg-sm-btn rpg-sm-btn--heal" disabled={hp >= maxHp} onClick={() => adjustHeroHp(p, n)}>+{n}</button>
                              ))}
                              <button className="rpg-sm-btn rpg-sm-btn--heal rpg-sm-btn--wide" disabled={hp >= maxHp} onClick={() => adjustHeroHp(p, maxHp)}>Del tutto</button>
                            </div>
                            <div className="rpg-hero-edit-row rpg-hero-edit-row--custom">
                              <span className="rpg-hero-edit-lbl">🔢 A piacere</span>
                              <input className="rpg-num" type="number" min="1" inputMode="numeric" value={heroAmount} onChange={(e) => setHeroAmount(e.target.value)} aria-label="Quantità" />
                              <button className="rpg-sm-btn rpg-sm-btn--danger" disabled={hp <= 0} onClick={() => adjustHeroHp(p, -amount)}>Ferisci −{amount}</button>
                              <button className="rpg-sm-btn rpg-sm-btn--heal" disabled={hp >= maxHp} onClick={() => adjustHeroHp(p, amount)}>Cura +{amount}</button>
                            </div>
                            <div className="rpg-hero-edit-row rpg-hero-edit-row--custom">
                              <span className="rpg-hero-edit-lbl">🛡 Scudo</span>
                              <input className="rpg-num" type="number" min="1" inputMode="numeric" value={heroShield} onChange={(e) => setHeroShield(e.target.value)} aria-label="HP di scudo" />
                              <button className="rpg-sm-btn" onClick={() => updateDoc(doc(db, "characters", p.id), { "stats.shield": increment(shieldAmt) })}>+{shieldAmt} scudo</button>
                              {(p.stats?.shield ?? 0) > 0 && (
                                <button className="rpg-sm-btn rpg-sm-btn--danger" onClick={() => updateDoc(doc(db, "characters", p.id), { "stats.shield": 0 })}>Azzera scudo</button>
                              )}
                              {(p.selfAcBonus ?? 0) > 0 && (
                                <button className="rpg-sm-btn rpg-sm-btn--danger"
                                        title={`Rimuovi buff "${p.selfAcSource || "?"}"`}
                                        onClick={() => updateDoc(doc(db, "characters", p.id), { selfAcBonus: 0, selfAcSource: null, selfAcAppliedAt: null })}>
                                  ✕ buff CA
                                </button>
                              )}
                            </div>
                            <div className="rpg-hero-edit-row">
                              <span className="rpg-hero-edit-lbl">🎲 Prossimo tiro</span>
                              <button
                                className={`rpg-sm-btn rpg-sm-btn--adv${p.nextTurnCondition === "advantage" ? " active" : ""}`}
                                onClick={() => handleSetCondition(p.id, p.nextTurnCondition === "advantage" ? null : "advantage")}
                              >⬆ Vantaggio</button>
                              <button
                                className={`rpg-sm-btn rpg-sm-btn--dis${p.nextTurnCondition === "disadvantage" ? " active" : ""}`}
                                onClick={() => handleSetCondition(p.id, p.nextTurnCondition === "disadvantage" ? null : "disadvantage")}
                              >⬇ Svantaggio</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {inactiveHeroes.length > 0 && (
                  <button className="rpg-link-btn" onClick={() => setShowInactive((v) => !v)}>
                    {showInactive ? "Nascondi" : "Mostra anche"} i {inactiveHeroes.length} iscritti che hanno lasciato la campagna
                  </button>
                )}

                {/* ── Log ── */}
                <button className="rpg-btn rpg-btn--danger" style={{ width: "100%", marginTop: 10 }} onClick={clearChat}>🗑 Pulisci Log</button>
              </div>
            )}
            {!isMaster && (
              <div className="rpg-player-panel">
                <div className="rpg-panel-title">{charData?.name || "Eroe"}{isUserLocked && <span className="rpg-locked-tag"> — Attendi</span>}</div>
                {isUserLocked && (
                  <div className="rpg-locked-note">
                    {isFightOver ? "⚑ La battaglia è finita."
                      : isPlayerDead ? "☠ Sei a terra: non puoi agire finché non vieni curato."
                      : !fightStarted ? "⏳ In attesa che il Master dia inizio alla battaglia."
                      : turnState.phase === "boss" ? "🔥 Turno del Boss: le tue azioni tornano al turno degli Eroi."
                      : "✓ Hai già agito in questo turno: attendi il prossimo."}
                  </div>
                )}
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
                {/* ── Bersaglio: chi colpire, quando in scena c'è più di un nemico ── */}
                {livingEnemies.length > 1 && (
                  <>
                    <div className="rpg-section-label rpg-section-label--target">Bersaglio</div>
                    <div className="rpg-target-chips">
                      {livingEnemies.map((e) => {
                        const pct = Math.max(0, Math.min(100, Math.round(((e.hp ?? 0) / Math.max(1, e.maxHp ?? 1)) * 100)));
                        const on = currentTarget?.id === e.id;
                        return (
                          <button key={e.id} type="button" className={`rpg-target-chip ${on ? "on" : ""} ${e.kind}`} onClick={() => setTargetId(e.id)}>
                            <span className="rpg-target-chip-ico">{e.kind === "boss" ? "👹" : "🪓"}</span>
                            <span className="rpg-target-chip-name">{e.name}</span>
                            <span className="rpg-target-chip-hp"><i style={{ width: `${pct}%` }} /></span>
                          </button>
                        );
                      })}
                    </div>
                  </>
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
                    {["str", "dex", "cos", "int", "wis", "cha"].map((s) => {
                      const save = statSave(charData, s);
                      return (
                        <button key={s} className="rpg-save-btn" onClick={() => handleSavingThrow(s)} disabled={isUserLocked}>
                          <span className="rpg-save-key">{s.toUpperCase()}</span>
                          <span className="rpg-save-mod">{save >= 0 ? "+" : ""}{save}</span>
                        </button>
                      );
                    })}
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
                            {groupedActions[cat].map((action, idx) => {
                              const skill = isSkillCategory(cat) ? skillKindFor(action) : null;
                              const used = skill ? isSkillUsed(action, skill) : false;
                              const isArea = skill ? skill.kind === "area" : !!areaSpellFor(action);
                              const title = used ? "Già usata in questa battaglia (una volta per battaglia)"
                                : skill ? `${skillTagFor(skill)}${skill.limited ? " · una volta per battaglia" : ""}`
                                : isArea ? "Magia ad area: colpisce tutti i nemici in campo" : undefined;
                              const skillDice = skill && !used ? (skill.perLevel ? `${skill.perLevel}×liv` : String(skill.formula || "").replace(/@mod/g, "mod")) : "";
                              return (
                                <button key={idx} className={`rpg-action-btn${used ? " is-used" : ""}`} onClick={() => handleActionRoll(action)} disabled={isUserLocked || used} title={title}>
                                  <span className="rpg-action-name">{action.name}</span>
                                  {used ? <span className="rpg-action-aoe rpg-action-used">usata</span>
                                    : skill ? <span className={`rpg-action-aoe rpg-action-skill rpg-action-skill--${skill.kind}`}>{skillTagFor(skill)}</span>
                                    : isArea ? <span className="rpg-action-aoe">area</span> : null}
                                  {skillDice && <span className="rpg-action-bonus">{skillDice}</span>}
                                  {!skill && action.bonus && <span className="rpg-action-bonus"> {/^[+-]/.test(String(action.bonus).trim()) ? String(action.bonus).trim() : `+${action.bonus}`}</span>}
                                </button>
                              );
                            })}
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

      {/* ── ARMA per l'abilità "su arma" (Divine Smite, Psionic Strike…) ───── */}
      {weaponPicker && (
        <div className="rpg-spell-picker-backdrop" onClick={() => setWeaponPicker(null)}>
          <div className="rpg-spell-picker" onClick={(e) => e.stopPropagation()}>
            <div className="rpg-spell-picker-head">
              <div>
                <div className="rpg-spell-picker-icon">⚔</div>
                <h3>Con quale arma?</h3>
                <p className="rpg-spell-picker-spell">{weaponPicker.skill.name} → {currentTarget?.name || "bersaglio"}</p>
                <p className="rpg-spell-picker-desc">I dadi dell'abilità si aggiungono al colpo se l'arma va a segno.</p>
              </div>
              <button className="rpg-spell-picker-close" onClick={() => setWeaponPicker(null)} aria-label="Chiudi">✕</button>
            </div>
            <div className="rpg-spell-picker-list">
              {weaponPicker.weapons.map((w, i) => (
                <button key={i} className="rpg-spell-picker-row"
                  onClick={async () => { const sk = weaponPicker.skill; setWeaponPicker(null); await handleActionRoll(w, { rider: sk }); }}>
                  <span className="rpg-spell-picker-mark">⚔</span>
                  <span className="rpg-spell-picker-name">{w.name}</span>
                  <span className="rpg-spell-picker-hp">{w.damage && w.damage !== "0" ? w.damage : "1d6"}{parseInt(w.bonus) ? ` · +${parseInt(w.bonus)}` : ""}</span>
                </button>
              ))}
            </div>
            <div className="rpg-spell-picker-foot">
              <button className="rpg-spell-picker-cancel" onClick={() => setWeaponPicker(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SPELL TARGET PICKER MODAL ───────────────────────────────────── */}
      {spellPicker && (() => {
        const { action, intent, selected } = spellPicker;
        const eligible = players.filter((p) => (p.stats?.hp ?? 0) > 0);
        const isHeal = intent === "heal";
        const allSelected = !isHeal && selected.length === eligible.length && eligible.length > 0;
        const toggleOne = (uid) => {
          if (isHeal) {
            setSpellPicker((s) => ({ ...s, selected: [uid] }));
          } else {
            setSpellPicker((s) => ({
              ...s,
              selected: s.selected.includes(uid)
                ? s.selected.filter((x) => x !== uid)
                : [...s.selected, uid],
            }));
          }
        };
        const toggleAll = () => {
          setSpellPicker((s) => ({
            ...s,
            selected: allSelected ? [] : eligible.map((p) => p.id),
          }));
        };
        const confirm = async () => {
          if (selected.length === 0) return;
          if (isHeal && spellPicker.skill) {
            await castSkillHeal(action, spellPicker.skill, [selected[0]]);
          } else if (isHeal) {
            await castHealOnTarget(action, selected[0]);
          } else {
            await castBuffOnTargets(action, selected);
          }
          setSpellPicker(null);
        };
        return (
          <div className="rpg-spell-picker-backdrop" onClick={() => setSpellPicker(null)}>
            <div className="rpg-spell-picker" onClick={(e) => e.stopPropagation()}>
              <div className="rpg-spell-picker-head">
                <div>
                  <div className="rpg-spell-picker-icon">{isHeal ? "💚" : "🌟"}</div>
                  <h3>{isHeal ? "Cura un alleato" : "Buff agli alleati"}</h3>
                  <p className="rpg-spell-picker-spell">{action.name}</p>
                  {action.description && <p className="rpg-spell-picker-desc">{action.description}</p>}
                </div>
                <button className="rpg-spell-picker-close" onClick={() => setSpellPicker(null)} aria-label="Chiudi">✕</button>
              </div>

              {!isHeal && eligible.length > 1 && (
                <button className="rpg-spell-picker-all" onClick={toggleAll}>
                  {allSelected ? "✓ Tutti selezionati · clic per deselezionare" : "👥 Seleziona TUTTI gli alleati"}
                </button>
              )}

              <div className="rpg-spell-picker-list">
                {eligible.length === 0 ? (
                  <p className="rpg-spell-picker-empty">Nessun alleato vivo da bersagliare.</p>
                ) : eligible.map((p) => {
                  const isOn = selected.includes(p.id);
                  const hp = p.stats?.hp ?? 0;
                  const maxHp = p.stats?.maxHp ?? hp;
                  const pct = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
                  return (
                    <button
                      key={p.id}
                      className={`rpg-spell-picker-row ${isOn ? "on" : ""}`}
                      onClick={() => toggleOne(p.id)}
                    >
                      <span className="rpg-spell-picker-mark">
                        {isHeal ? (isOn ? "●" : "○") : (isOn ? "✓" : "")}
                      </span>
                      {p.image
                        ? <img src={p.image} alt="" className="rpg-spell-picker-avatar" />
                        : <span className="rpg-spell-picker-avatar placeholder">{(p.name || "?").charAt(0)}</span>}
                      <span className="rpg-spell-picker-name">{p.name || "?"}</span>
                      <span className="rpg-spell-picker-hp">{hp}/{maxHp} HP ({pct}%)</span>
                    </button>
                  );
                })}
              </div>

              <div className="rpg-spell-picker-foot">
                <button className="rpg-spell-picker-cancel" onClick={() => setSpellPicker(null)}>Annulla</button>
                <button
                  className="rpg-spell-picker-confirm"
                  disabled={selected.length === 0}
                  onClick={confirm}
                >
                  {isHeal ? "💚 Cura" : `🌟 Lancia su ${selected.length || 0} ${selected.length === 1 ? "alleato" : "alleati"}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── DEFEAT SCREEN — time ran out & boss still alive ──────────────── */}
      {isTimeExpired && boss && (
        <div className="rpg-defeat-screen" role="alertdialog" aria-label="Sconfitta">
          <div className="rpg-defeat-scanlines" />
          <div className="rpg-defeat-box">
            <div className="rpg-defeat-skull">💀</div>
            <h2 className="rpg-defeat-title">GAME OVER</h2>
            <p className="rpg-defeat-sub">GLI EROI SONO STATI SCONFITTI</p>
            <p className="rpg-defeat-flavor">
              Il tempo è scaduto. <span className="rpg-defeat-bossname">{boss.name}</span> ha
              prevalso e ancora incombe su Exanthia.
            </p>
            <div className="rpg-defeat-penalty">
              <div className="rpg-defeat-penalty-label">⚔ PENALITÀ INFLITTA ⚔</div>
              <div className="rpg-defeat-penalty-text">
                {boss.penalties || "Il Master applicherà le conseguenze della sconfitta."}
              </div>
            </div>
            <div className="rpg-defeat-press">— LA SCONFITTA È SEGNATA —</div>
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
