import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  doc, getDoc, onSnapshot, updateDoc, setDoc,
  arrayUnion, arrayRemove, addDoc, collection, serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./Arena.css";

// ── SPELL LIST (20) ──────────────────────────────────────────────────────────
const ARENA_SPELLS = [
  { name: "Raggio di Fuoco",     hitBonus: 9, damage: "2d10",    statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco"     },
  { name: "Raggio di Gelo",      hitBonus: 9, damage: "2d8",     statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Freddo"    },
  { name: "Tocco del Gelo",      hitBonus: 9, damage: "2d8",     statKey: null, type: "spell", icon: "💀", info: "Trucchetto · Necrotico" },
  { name: "Nebbia Acida",        hitBonus: 9, damage: "2d6",     statKey: null, type: "spell", icon: "🫧", info: "Trucchetto · Acido"     },
  { name: "Mani Brucianti",      hitBonus: 9, damage: "3d6",     statKey: null, type: "spell", icon: "🔥", info: "Livello 1 · Fuoco"      },
  { name: "Missile Magico",      hitBonus: 9, damage: "3d4+3",   statKey: null, type: "spell", icon: "✨", info: "Livello 1 · Forza"      },
  { name: "Onda Tonante",        hitBonus: 9, damage: "2d8",     statKey: null, type: "spell", icon: "💨", info: "Livello 1 · Tuono"      },
  { name: "Sfera Cromatica",     hitBonus: 9, damage: "3d8",     statKey: null, type: "spell", icon: "🔮", info: "Livello 1 · Vario"      },
  { name: "Freccia Acida",       hitBonus: 9, damage: "4d4+4",   statKey: null, type: "spell", icon: "☠",  info: "Livello 2 · Acido"     },
  { name: "Nube di Daghe",       hitBonus: 9, damage: "4d4",     statKey: null, type: "spell", icon: "🌀", info: "Livello 2 · Tagliente"  },
  { name: "Palla di Fuoco",      hitBonus: 9, damage: "8d6",     statKey: null, type: "spell", icon: "💥", info: "Livello 3 · Fuoco"      },
  { name: "Fulmine",             hitBonus: 9, damage: "8d6",     statKey: null, type: "spell", icon: "⚡", info: "Livello 3 · Fulmine"    },
  { name: "Tempesta di Fulmini", hitBonus: 9, damage: "3d10",    statKey: null, type: "spell", icon: "⛈", info: "Livello 3 · Fulmine"    },
  { name: "Decadimento",         hitBonus: 9, damage: "8d8",     statKey: null, type: "spell", icon: "🍂", info: "Livello 4 · Necrotico"  },
  { name: "Parete di Fuoco",     hitBonus: 9, damage: "5d8",     statKey: null, type: "spell", icon: "🔥", info: "Livello 4 · Fuoco"      },
  { name: "Cono di Freddo",      hitBonus: 9, damage: "8d8",     statKey: null, type: "spell", icon: "🌨", info: "Livello 5 · Freddo"     },
  { name: "Nube Mortale",        hitBonus: 9, damage: "5d8",     statKey: null, type: "spell", icon: "☁",  info: "Livello 5 · Veleno"    },
  { name: "Disintegrazione",     hitBonus: 9, damage: "10d6+40", statKey: null, type: "spell", icon: "☄",  info: "Livello 6 · Forza"     },
  { name: "Morte del Dito",      hitBonus: 9, damage: "7d8+30",  statKey: null, type: "spell", icon: "💀", info: "Livello 7 · Necrotico"  },
  { name: "Sciame di Meteore",   hitBonus: 9, damage: "20d6",    statKey: null, type: "spell", icon: "🌠", info: "Livello 9 · Fuoco"      },
];

// Armi fisiche
const ARENA_WEAPONS = [
  { name: "Spada",              hitBonus: 9, damage: "2d6+5",  statKey: "str", type: "weapon", icon: "⚔",  twoHanded: false },
  { name: "Spadone a due mani", hitBonus: 9, damage: "2d10+5", statKey: "str", type: "weapon", icon: "⚔",  twoHanded: true  },
  { name: "Maglio",             hitBonus: 9, damage: "2d10+5", statKey: "str", type: "weapon", icon: "🔨", twoHanded: true  },
  { name: "Lancia",             hitBonus: 9, damage: "2d8+5",  statKey: "str", type: "weapon", icon: "🪃", twoHanded: false },
  { name: "Bastone Ferrato",    hitBonus: 9, damage: "2d8+5",  statKey: "str", type: "weapon", icon: "🪄", twoHanded: true  },
  { name: "Pugnale",            hitBonus: 9, damage: "2d4+5",  statKey: "dex", type: "weapon", icon: "🗡", twoHanded: false },
  { name: "Falcetto",           hitBonus: 9, damage: "2d4+5",  statKey: "dex", type: "weapon", icon: "⚔",  twoHanded: false },
  { name: "Arco",               hitBonus: 9, damage: "2d8+5",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true  },
  { name: "Balestra",           hitBonus: 9, damage: "2d10+5", statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true  },
];

// Armi esclusive caster puri (wizard/warlock/sorcerer)
const CASTER_WEAPONS = [
  { name: "Bastone",           hitBonus: 5, damage: "2d8+5", statKey: "int", type: "weapon", icon: "🪄", info: "Mischia · +INT",      twoHanded: true  },
  { name: "Bacchetta e Focus", hitBonus: 5, damage: "3d6+5", statKey: "int", type: "weapon", icon: "✨", info: "Incantesimo · +INT",  twoHanded: false },
];

// Armi del Druido
const DRUID_WEAPONS = [
  { name: "Scimitarra", hitBonus: 9, damage: "3d6+5", statKey: "str", type: "weapon", icon: "⚔",  twoHanded: false },
  { name: "Pugnale",    hitBonus: 9, damage: "2d4+5", statKey: "dex", type: "weapon", icon: "🗡",  twoHanded: false },
  { name: "Bastone",    hitBonus: 9, damage: "2d8+5", statKey: "str", type: "weapon", icon: "🪄",  twoHanded: true  },
  { name: "Falcetto",   hitBonus: 9, damage: "2d4+5", statKey: "dex", type: "weapon", icon: "⚔",  twoHanded: false },
  { name: "Lancia",     hitBonus: 9, damage: "2d8+5", statKey: "str", type: "weapon", icon: "🪃",  twoHanded: false },
];

// Smite del Paladino — aggiunto automaticamente
const SMITE_ACTION = {
  name: "Smite Divino", hitBonus: 9, damage: "5d12", statKey: "wis",
  type: "weapon", icon: "⚡", info: "Colpo Divino · +SAG",
};

// Abilità Scudo (caster) — selezionabile nel loadout
const CASTER_SKILLS = [
  { name: "Scudo", type: "skill", special: "shield_buff", icon: "🛡", info: "+2 CA per 3 turni", damage: "—", statKey: null, hitBonus: 0 },
];

// Colpo Mortale (Rogue) — aggiunto automaticamente, usabile solo sotto 20% HP
const DEATHBLOW_ACTION = {
  name: "Colpo Mortale", hitBonus: 9, damage: "4d6+5", statKey: "dex",
  type: "skill", icon: "💀", info: "Solo ≤20% HP · +DES", special: "deathblow",
};

// ── WILD SHAPE FORMS ──────────────────────────────────────────────────────────
const WILD_SHAPES = {
  wolf: {
    name: "Lupo", icon: "🐺",
    hpDice: { count: 8, sides: 12 },
    actions: [
      { name: "Artiglio", damage: "2d6+5", statKey: "str", type: "weapon", icon: "🐾", hitBonus: 5 },
      { name: "Morso",    damage: "3d6+5", statKey: "str", type: "weapon", icon: "🦷", hitBonus: 5 },
    ],
  },
  bear: {
    name: "Orso", icon: "🐻",
    hpDice: { count: 12, sides: 12 },
    actions: [
      { name: "Artiglio", damage: "2d6+5", statKey: "str", type: "weapon", icon: "🐾", hitBonus: 5 },
      { name: "Morso",    damage: "3d6+5", statKey: "str", type: "weapon", icon: "🦷", hitBonus: 5 },
    ],
  },
  spider: {
    name: "Ragno", icon: "🕷",
    hpDice: { count: 6, sides: 12 },
    actions: [
      { name: "Morso",     damage: "2d6+5", statKey: "str", type: "weapon", icon: "🦷", hitBonus: 5 },
      { name: "Veleno",    damage: "3d6+5", statKey: null,  type: "spell",  icon: "☠",  hitBonus: 0, special: "poison" },
      { name: "Ragnatela", damage: "—",     statKey: null,  type: "spell",  icon: "🕸", hitBonus: 0, special: "web"    },
    ],
  },
};

// ── ARMATURE (base ufficiale D&D 5e +5 CA) ───────────────────────────────────
const ARENA_ARMORS = {
  light: [
    { name: "Vesti Imbottite",    baseAc: 16, maxDex: 99, icon: "🧥", info: "Leggera · +DES (pieno)" },
    { name: "Armatura di Cuoio", baseAc: 16, maxDex: 99, icon: "🧥", info: "Leggera · +DES (pieno)" },
    { name: "Cuoio Rinforzato",  baseAc: 17, maxDex: 99, icon: "🧥", info: "Leggera · +DES (pieno)" },
  ],
  medium: [
    { name: "Pelliccia Rinforzata", baseAc: 17, maxDex: 2, icon: "🦺", info: "Media · +DES max 2" },
    { name: "Cuoio Indurito",       baseAc: 18, maxDex: 2, icon: "🦺", info: "Media · +DES max 2" },
    { name: "Armatura d'Ossa",      baseAc: 19, maxDex: 2, icon: "🦺", info: "Media · +DES max 2" },
  ],
  mediumStudded: [
    { name: "Cuoio Borchiato",   baseAc: 17, maxDex: 2, icon: "⚙", info: "Media Borchiata · +DES max 2" },
    { name: "Maglia di Cuoio",   baseAc: 19, maxDex: 2, icon: "⚙", info: "Media Borchiata · +DES max 2" },
    { name: "Mezza Piastre",     baseAc: 20, maxDex: 2, icon: "⚙", info: "Media Borchiata · +DES max 2" },
  ],
  heavy: [
    { name: "Cotta ad Anelli",    baseAc: 19, maxDex: 0, icon: "🛡", info: "Pesante · senza DES" },
    { name: "Cotta di Maglia",    baseAc: 21, maxDex: 0, icon: "🛡", info: "Pesante · senza DES" },
    { name: "Armatura a Placche", baseAc: 22, maxDex: 0, icon: "🛡", info: "Pesante · senza DES" },
    { name: "Piastre Intere",     baseAc: 23, maxDex: 0, icon: "🛡", info: "Pesante · senza DES" },
  ],
};

// ── CLASSI ───────────────────────────────────────────────────────────────────
const PHYSICAL_CLASSES = ["fighter","guerriero","warrior","rogue","ladro","paladin","paladino","ranger","cacciatore","barbarian","barbaro","monk","monaco"];
const CASTER_CLASSES   = ["wizard","mago","sorcerer","stregone","warlock","bard","bardo","cleric","chierico","druid","druido"];

function isFullCaster(cls)   { return ["wizard","mago","sorcerer","stregone","warlock"].some(c => cls.includes(c)); }
function isDruidClass(cls)   { return ["druid","druido"].some(c => cls.includes(c)); }
function isPaladinClass(cls) { return ["paladin","paladino"].some(c => cls.includes(c)); }
function isClericClass(cls)  { return ["cleric","chierico"].some(c => cls.includes(c)); }
function isFighterClass(cls) { return ["fighter","guerriero","warrior"].some(c => cls.includes(c)); }
function isRogueBardClass(cls){ return ["rogue","ladro","bard","bardo"].some(c => cls.includes(c)); }
function isRogueClass(cls)    { return ["rogue","ladro"].some(c => cls.includes(c)); }

function getArmorConfig(cls) {
  if (isFullCaster(cls))    return { armorCategory: "light",         canHaveShield: false };
  if (isDruidClass(cls))    return { armorCategory: "medium",        canHaveShield: true  };
  if (isPaladinClass(cls))  return { armorCategory: "heavy",         canHaveShield: true  };
  if (isClericClass(cls))   return { armorCategory: "heavy",         canHaveShield: true  };
  if (isFighterClass(cls))  return { armorCategory: "heavy",         canHaveShield: true  };
  if (isRogueBardClass(cls))return { armorCategory: "mediumStudded", canHaveShield: false };
  if (PHYSICAL_CLASSES.some(c => cls.includes(c))) return { armorCategory: "medium", canHaveShield: false };
  if (CASTER_CLASSES.some(c => cls.includes(c)))   return { armorCategory: "light",  canHaveShield: false };
  return { armorCategory: "medium", canHaveShield: false };
}

function getHpDice(charClass) {
  const cls = (charClass || "").toLowerCase();
  if (["fighter","guerriero","warrior","paladin","paladino"].some(c => cls.includes(c))) return { count: 13, sides: 12 };
  if (["rogue","ladro","druid","druido"].some(c => cls.includes(c)))                      return { count: 11, sides: 12 };
  return { count: 10, sides: 12 };
}

function getLoadoutConfig(charClass) {
  const cls = (charClass || "").toLowerCase();
  const { armorCategory, canHaveShield } = getArmorConfig(cls);
  if (isFullCaster(cls))   return { weaponOptions: CASTER_WEAPONS, spellOptions: ARENA_SPELLS, skillOptions: CASTER_SKILLS, maxWeapons: 1, maxSpells: 6, maxSkills: 1, autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  if (isDruidClass(cls))   return { weaponOptions: DRUID_WEAPONS,  spellOptions: ARENA_SPELLS, skillOptions: CASTER_SKILLS, maxWeapons: 1, maxSpells: 3, maxSkills: 1, autoActions: [], hasWildShape: true,  armorCategory, canHaveShield };
  if (isPaladinClass(cls)) return { weaponOptions: ARENA_WEAPONS,  spellOptions: [],           skillOptions: [],            maxWeapons: 2, maxSpells: 0, maxSkills: 0, autoActions: [SMITE_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isRogueClass(cls))   return { weaponOptions: ARENA_WEAPONS,  spellOptions: [],           skillOptions: [],            maxWeapons: 2, maxSpells: 0, maxSkills: 0, autoActions: [DEATHBLOW_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (PHYSICAL_CLASSES.some(c => cls.includes(c))) return { weaponOptions: ARENA_WEAPONS, spellOptions: [],           skillOptions: [],            maxWeapons: 2, maxSpells: 0, maxSkills: 0, autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  if (CASTER_CLASSES.some(c => cls.includes(c)))   return { weaponOptions: ARENA_WEAPONS, spellOptions: ARENA_SPELLS, skillOptions: CASTER_SKILLS, maxWeapons: 1, maxSpells: 1, maxSkills: 1, autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  return { weaponOptions: ARENA_WEAPONS, spellOptions: [], skillOptions: [], maxWeapons: 2, maxSpells: 0, maxSkills: 0, autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
}

// ── DAMAGE ROLLER ─────────────────────────────────────────────────────────────
function rollDamageFormula(formula) {
  if (!formula) return 0;
  const str = String(formula).trim();
  if (!str || str === "0") return 0;
  if (!isNaN(Number(str))) return Number(str);
  let total = 0;
  const normalized = str.replace(/-/g, "+-");
  const parts = normalized.split("+").map(p => p.trim()).filter(p => p !== "");
  for (const part of parts) {
    const negative = part.startsWith("-");
    const abs = negative ? part.slice(1) : part;
    if (abs.includes("d")) {
      const [numStr, sidesStr] = abs.split("d");
      const num   = parseInt(numStr)  || 1;
      const sides = parseInt(sidesStr) || 1;
      let rolled = 0;
      for (let i = 0; i < num; i++) rolled += Math.floor(Math.random() * sides) + 1;
      total += negative ? -rolled : rolled;
    } else {
      const val = parseInt(abs) || 0;
      total += negative ? -val : val;
    }
  }
  return Math.max(0, total);
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function Arena() {
  const { currentUser } = useAuth();
  const [arenaMeta, setArenaMeta]             = useState(null);
  const [prizeText, setPrizeText]             = useState("");
  const [selectedTargets, setSelectedTargets] = useState({});

  // Loadout — "idle" | "rolling" | "selecting"
  const [loadoutPhase, setLoadoutPhase]     = useState("idle");
  const [charPreview, setCharPreview]       = useState(null);
  const [pendingWeapons, setPendingWeapons] = useState([]);
  const [pendingSpells, setPendingSpells]   = useState([]);
  const [pendingSkills, setPendingSkills]   = useState([]);
  const [pendingArmor, setPendingArmor]     = useState(null);
  const [pendingShield, setPendingShield]   = useState(false);
  const [showWildPicker, setShowWildPicker] = useState(false);
  const [equipSelections, setEquipSelections] = useState({});

  const isMaster = currentUser?.email === "santomassimo85@gmail.com";

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "arena_meta", "global"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setArenaMeta(data);
        if (isMaster) setPrizeText(data.prizes || "");
      } else {
        setDoc(doc(db, "arena_meta", "global"), {
          phase: "registration", prizes: "",
          waitingList: [], participants: [],
          characterSnapshots: {}, matches: [],
          currentRound: 1, tournamentWinner: null,
        });
      }
    });
    return () => unsub();
  }, [isMaster]);

  // ── STEP 1: carica personaggio → rolling ─────────────────────────────────
  const openLoadoutPicker = async () => {
    const charSnap = await getDoc(doc(db, "characters", currentUser.uid));
    if (!charSnap.exists()) {
      alert("Non hai ancora una scheda personaggio! Creala nella sezione 'Scheda Personaggio'.");
      return;
    }
    const d = charSnap.data();
    setCharPreview({
      name:  d.name  || "Avventuriero",
      image: d.image || null,
      class: d.class || "",
      stats: {
        maxHp: d.stats?.maxHp ?? d.stats?.hp ?? 70,
        ac:    d.stats?.ac   ?? 15,
        str:   d.stats?.str  ?? 0,
        dex:   d.stats?.dex  ?? 0,
        int:   d.stats?.int  ?? 0,
        wis:   d.stats?.wis  ?? 0,
      },
      rolledHp: null,
    });
    setPendingWeapons([]);
    setPendingSpells([]);
    setPendingSkills([]);
    setLoadoutPhase("rolling");
  };

  // ── STEP 2: tira HP ───────────────────────────────────────────────────────
  const rollHp = () => {
    const { count, sides } = getHpDice(charPreview.class);
    let total = 0;
    for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
    setCharPreview(prev => ({ ...prev, rolledHp: total }));
  };

  // ── STEP 3: conferma iscrizione ───────────────────────────────────────────
  const confirmJoin = async () => {
    const config = getLoadoutConfig(charPreview.class);
    if (pendingWeapons.length < config.maxWeapons) return;
    if (pendingSpells.length  < config.maxSpells)  return;
    if (!charPreview.rolledHp) return;
    if (!pendingArmor) return;

    // Calcolo CA finale: base + DES (cappato) + scudo
    const dexMod    = charPreview.stats.dex ?? 0;
    const dexBonus  = Math.min(dexMod, pendingArmor.maxDex);
    const shieldBonus = pendingShield ? 2 : 0;
    const finalAc   = pendingArmor.baseAc + dexBonus + shieldBonus;

    const finalActions = [...pendingWeapons, ...pendingSpells, ...pendingSkills, ...config.autoActions];
    const snapshot = {
      name:            charPreview.name,
      image:           charPreview.image,
      class:           charPreview.class,
      stats:           { ...charPreview.stats, maxHp: charPreview.rolledHp, ac: finalAc },
      selectedActions: finalActions,
      hasWildShape:    config.hasWildShape,
      hasShield:       pendingShield,
      selectedArmor:   pendingArmor,
    };
    await updateDoc(doc(db, "arena_meta", "global"), {
      waitingList: arrayUnion(currentUser.uid),
      [`characterSnapshots.${currentUser.uid}`]: snapshot,
    });
    cancelLoadout();
  };

  const cancelLoadout = () => {
    setLoadoutPhase("idle");
    setCharPreview(null);
    setPendingWeapons([]);
    setPendingSpells([]);
    setPendingSkills([]);
    setPendingArmor(null);
    setPendingShield(false);
  };

  const toggleWeapon = (item, maxWeapons) => {
    setPendingWeapons(prev => {
      const already = prev.find(a => a.name === item.name);
      if (already) return prev.filter(a => a.name !== item.name);
      if (prev.length >= maxWeapons) return maxWeapons === 1 ? [item] : prev;
      return [...prev, item];
    });
  };

  const toggleSpell = (item, maxSpells) => {
    setPendingSpells(prev => {
      const already = prev.find(a => a.name === item.name);
      if (already) return prev.filter(a => a.name !== item.name);
      if (prev.length >= maxSpells) return prev;
      return [...prev, item];
    });
  };

  const toggleSkill = (item, maxSkills) => {
    setPendingSkills(prev => {
      const already = prev.find(a => a.name === item.name);
      if (already) return prev.filter(a => a.name !== item.name);
      if (prev.length >= maxSkills) return maxSkills === 1 ? [item] : prev;
      return [...prev, item];
    });
  };

  // ── MASTER helpers ─────────────────────────────────────────────────────────
  const savePrizes = async () => {
    await updateDoc(doc(db, "arena_meta", "global"), { prizes: prizeText });
  };

  const approveParticipant = async (uid) => {
    await updateDoc(doc(db, "arena_meta", "global"), {
      waitingList:  arrayRemove(uid),
      participants: arrayUnion(uid),
    });
  };

  const startTournament = async () => {
    if (arenaMeta.participants.length < 2) return alert("Minimo 2 partecipanti!");
    const shuffled = [...arenaMeta.participants].sort(() => Math.random() - 0.5);
    const matches  = generateMatches(shuffled, 1, arenaMeta.characterSnapshots || {});
    await updateDoc(doc(db, "arena_meta", "global"), {
      matches, phase: "combat", currentRound: 1, tournamentWinner: null,
    });
  };

  const advanceRound = async () => {
    const winners = arenaMeta.matches.filter(m => m.status === "finished" && m.winner).map(m => m.winner);
    if (winners.length < 2) return;
    const nextRound  = (arenaMeta.currentRound || 1) + 1;
    const newMatches = generateMatches(winners, nextRound, arenaMeta.characterSnapshots || {});
    await updateDoc(doc(db, "arena_meta", "global"), { matches: newMatches, currentRound: nextRound });
  };

  const generateMatches = (competitors, round, snapshots) => {
    const matches = [];
    let i = 0;
    while (i < competitors.length) {
      const remaining      = competitors.length - i;
      const matchPlayerIds = remaining === 3 ? competitors.slice(i, i + 3) : competitors.slice(i, i + 2);
      if (matchPlayerIds.length < 2) break;
      matches.push({
        matchId: `R${round}_M${matches.length}`,
        players: matchPlayerIds.map(id => {
          const snap = snapshots[id] || {};
          return { id, name: snap.name || "Sconosciuto", hp: snap.stats?.maxHp ?? 70, init: 0 };
        }),
        status: "initiative", turn: null,
        logs:   ["⚔️ Il match ha inizio!"], winner: null,
        isFFA:  matchPlayerIds.length === 3,
      });
      i += matchPlayerIds.length;
    }
    return matches;
  };

  const sendChampionNotification = async (winnerId, winnerName, prizes) => {
    const prizeMsg = prizes ? `Il tuo premio: ${prizes}` : "Che il tuo valore sia ricordato nelle cronache di Eldoria!";
    await addDoc(collection(db, "notifications"), {
      userId: winnerId,
      title:  "🏆 Campione dell'Arena!",
      message: `${winnerName}, hai trionfato nell'Arena dei Campioni! ${prizeMsg}`,
      read: false, timestamp: serverTimestamp(),
    });
  };

  // ── COMBAT ─────────────────────────────────────────────────────────────────
  const advanceTurn = (players, matchObj) => {
    const currentIndex = matchObj.players.findIndex(p => p.id === currentUser.uid);
    let nextIndex = (currentIndex + 1) % players.length;
    while (players[nextIndex]?.hp <= 0) nextIndex = (nextIndex + 1) % players.length;
    return players[nextIndex].id;
  };

  const rollInit = async (matchId) => {
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const dex    = mySnap?.stats?.dex ?? 0;
    const roll   = Math.floor(Math.random() * 20) + 1 + dex;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, init: roll } : p
      );
      const allRolled = updatedPlayers.every(p => p.init > 0);
      const sorted    = [...updatedPlayers].sort((a, b) => b.init - a.init);
      return {
        ...m, players: updatedPlayers,
        status: allRolled ? "active" : "initiative",
        turn:   allRolled ? sorted[0].id : null,
        logs:   [...m.logs, `🎲 ${mySnap?.name ?? "?"} tira iniziativa: ${roll}`],
      };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const handleAttack = async (matchId, targetId, action) => {
    const snapshots    = arenaMeta.characterSnapshots || {};
    const attackerSnap = snapshots[currentUser.uid];
    const defenderSnap = snapshots[targetId];
    const attName = attackerSnap?.name || "?";
    const defName = defenderSnap?.name || "?";

    // ── Ragnatela (DEX save, no damage) ──────────────────────────────
    if (action.special === "web") {
      const log = `🕸 ${attName} lancia una Ragnatela su ${defName}! — TS DES richiesto (CD 15)`;
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id === targetId) return { ...p, pendingDexSave: true };
          if (p.id === currentUser.uid) return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1) };
          return p;
        });
        return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), logs: [...m.logs, log] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return;
    }

    // ── Veleno (damage + CON save) ────────────────────────────────────
    if (action.special === "poison") {
      const damage = rollDamageFormula(action.damage);
      const log = `☠ ${attName} usa Veleno su ${defName} — ${damage} danni + TS COS richiesto (CD 15)!`;
      let updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - damage), pendingConSave: true };
          if (p.id === currentUser.uid) return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1) };
          return p;
        });
        const alive = updatedPlayers.filter(p => p.hp > 0);
        if (alive.length === 1) {
          return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
            logs: [...m.logs, log, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
        }
        return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), logs: [...m.logs, log] };
      });
      const allDone = updatedMatches.every(m => m.status === "finished");
      const winners = updatedMatches.filter(m => m.winner).map(m => m.winner);
      if (allDone && winners.length === 1) {
        const champSnap = snapshots[winners[0]] || {};
        await sendChampionNotification(winners[0], champSnap.name || "Campione", arenaMeta?.prizes || "");
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: updatedMatches, tournamentWinner: winners[0], phase: "finished",
        });
        return;
      }
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return;
    }

    // ── Attacco normale ───────────────────────────────────────────────
    const statMod  = action.statKey ? (attackerSnap?.stats?.[action.statKey] ?? 0) : 0;
    const d20      = Math.floor(Math.random() * 20) + 1;
    const hitTotal = d20 + (action.hitBonus || 0) + statMod;
    // CA effettiva: sottrai bonus scudo fisico se arma a 2 mani; aggiungi Scudo (skill) se attivo
    const defMatchPlayer     = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === targetId);
    const shieldLost         = defenderSnap?.hasShield && defMatchPlayer?.shieldSuppressed;
    const shieldSkillBonus   = (defMatchPlayer?.shieldSkillTurns ?? 0) > 0 ? 2 : 0;
    const defAC    = (defenderSnap?.stats?.ac ?? 10) - (shieldLost ? 2 : 0) + shieldSkillBonus;
    const isHit    = hitTotal >= defAC;
    const baseDmg  = isHit ? rollDamageFormula(action.damage) : 0;
    const damage   = isHit ? baseDmg + statMod : 0;

    const statLabel = action.statKey ? ` +${action.statKey.toUpperCase()}(${statMod})` : "";
    const log = isHit
      ? `💥 ${attName} colpisce ${defName} con ${action.name} (${hitTotal} vs CA ${defAC}) — ${damage} danni${statLabel}`
      : `🛡️ ${attName} manca ${defName} con ${action.name} (${hitTotal} vs CA ${defAC})`;

    let updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - damage) };
        if (p.id === currentUser.uid) return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1) };
        return p;
      });
      const alive = updatedPlayers.filter(p => p.hp > 0);
      if (alive.length === 1) {
        return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
          logs: [...m.logs, log, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      }
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), logs: [...m.logs, log] };
    });

    const allDone = updatedMatches.every(m => m.status === "finished");
    const winners = updatedMatches.filter(m => m.winner).map(m => m.winner);
    if (allDone && winners.length === 1) {
      const champSnap = snapshots[winners[0]] || {};
      await sendChampionNotification(winners[0], champSnap.name || "Campione", arenaMeta?.prizes || "");
      await updateDoc(doc(db, "arena_meta", "global"), {
        matches: updatedMatches, tournamentWinner: winners[0], phase: "finished",
      });
      return;
    }
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── SCUDO (skill caster) ──────────────────────────────────────────────────
  const handleShieldSkill = async (matchId) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const log = `🛡 ${myName} attiva Scudo! (+2 CA per 3 turni)`;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, shieldSkillTurns: 3 } : p
      );
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── WILD SHAPE ─────────────────────────────────────────────────────────────
  const handleWildShape = async (matchId, formKey) => {
    const form = WILD_SHAPES[formKey];
    const { count, sides } = form.hpDice;
    let newHp = 0;
    for (let i = 0; i < count; i++) newHp += Math.floor(Math.random() * sides) + 1;
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Druido";
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const preHp = m.players.find(p => p.id === currentUser.uid)?.hp ?? 0;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, hp: newHp, wildShape: formKey, preWildShapeHp: preHp } : p
      );
      return { ...m, players: updatedPlayers,
        logs: [...m.logs, `🐾 ${myName} si trasforma in ${form.icon} ${form.name}! (${newHp} HP)`] };
    });
    setShowWildPicker(false);
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const revertWildShape = async (matchId) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Druido";
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const myPData = m.players.find(p => p.id === currentUser.uid);
      const restoredHp = myPData?.preWildShapeHp ?? myPData?.hp ?? 0;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid
          ? { ...p, hp: restoredHp, wildShape: null, preWildShapeHp: null }
          : p
      );
      return { ...m, players: updatedPlayers,
        logs: [...m.logs, `🧙 ${myName} ritorna alla forma originale (${restoredHp} HP)`] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── TIRI SALVEZZA ──────────────────────────────────────────────────────────
  const rollSavingThrow = async (matchId, saveType, context) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const mod = mySnap?.stats?.[saveType] ?? 0;
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + mod;
    const dc = 15;
    const pass = total >= dc;
    const labels = { str: "FOR", dex: "DES", con: "COS" };
    const myName = mySnap?.name || "?";
    let logMsg = `🎲 ${myName} — TS ${labels[saveType] || saveType.toUpperCase()}: ${d20}+${mod}=${total} (CD ${dc}) → ${pass ? "✅ PASSA" : "❌ FALLISCE"}`;

    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      let extraTurn = {};

      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const up = { ...p };
        if (context === "con_poison") {
          delete up.pendingConSave;
          if (!pass) {
            const poisonDmg = rollDamageFormula("2d6");
            up.hp = Math.max(0, (up.hp ?? 0) - poisonDmg);
            logMsg += ` — Avvelenato! Subisce ${poisonDmg} danni da veleno.`;
          }
        }
        if (context === "dex_web") {
          delete up.pendingDexSave;
          if (!pass) { up.entangled = true; logMsg += " — Intrappolato nella ragnatela!"; }
          else logMsg += " — Ha schivato la ragnatela!";
        }
        if (context === "str_escape") {
          if (pass) { delete up.entangled; logMsg += " — Si è liberato!"; }
          else logMsg += " — Ancora intrappolato!";
          // Passa il turno (non può attaccare)
          const currentIndex = m.players.findIndex(pl => pl.id === currentUser.uid);
          let nextIndex = (currentIndex + 1) % m.players.length;
          while (m.players[nextIndex]?.hp <= 0) nextIndex = (nextIndex + 1) % m.players.length;
          extraTurn = { turn: m.players[nextIndex].id };
        }
        return up;
      });

      return { ...m, players: updatedPlayers, logs: [...m.logs, logMsg], ...extraTurn };
    });

    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── EQUIPAGGIAMENTO ARMI ──────────────────────────────────────────────────
  // Equip iniziale (azione gratuita all'inizio del primo turno)
  const handleEquipWeapons = async (matchId, weaponNames) => {
    const allActions = (arenaMeta.characterSnapshots?.[currentUser.uid]?.selectedActions || []);
    const hasTwoHanded = weaponNames.some(n => allActions.find(a => a.name === n)?.twoHanded);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid
          ? { ...p, equippedWeaponNames: weaponNames, shieldSuppressed: hasTwoHanded }
          : p
      );
      return { ...m, players: updatedPlayers };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // Cambio arma durante il combat (costa il turno)
  const handleSwitchWeapon = async (matchId, weaponName) => {
    const mySnap   = arenaMeta.characterSnapshots?.[currentUser.uid];
    const action   = mySnap?.selectedActions?.find(a => a.name === weaponName);
    const is2H     = action?.twoHanded || false;
    const myName   = mySnap?.name || "?";
    const log      = `🔄 ${myName} cambia arma → ${action?.icon || ""} ${weaponName} — turno speso`;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        return { ...p, equippedWeaponNames: [weaponName], shieldSuppressed: is2H, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1) };
      });
      const currentIndex = m.players.findIndex(p => p.id === currentUser.uid);
      let nextIndex = (currentIndex + 1) % m.players.length;
      while (updatedPlayers[nextIndex]?.hp <= 0) nextIndex = (nextIndex + 1) % m.players.length;
      return { ...m, players: updatedPlayers, turn: updatedPlayers[nextIndex].id, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  if (!arenaMeta) return <div className="arena-loading">Ingresso nell'Arena...</div>;

  const snapshots        = arenaMeta.characterSnapshots || {};
  const isRegistered     = arenaMeta.participants?.includes(currentUser?.uid);
  const isPending        = arenaMeta.waitingList?.includes(currentUser?.uid);
  const allMatchesDone   = arenaMeta.matches?.length > 0 && arenaMeta.matches?.every(m => m.status === "finished");
  const roundWinnerCount = arenaMeta.matches?.filter(m => m.winner).length || 0;
  const canAdvanceRound  = isMaster && arenaMeta.phase === "combat" && allMatchesDone && roundWinnerCount >= 2;

  return (
    <div className="arena-page">

      {/* HEADER */}
      <div className="arena-header">
        <div className="arena-header-deco">⚔</div>
        <h1 className="arena-title">Arena dei Campioni</h1>
        <div className="arena-header-deco">⚔</div>
      </div>

      {/* FASE */}
      <div className="arena-phase-banner">
        {arenaMeta.phase === "registration" ? (
          <span className="phase-tag open">Iscrizioni Aperte</span>
        ) : arenaMeta.phase === "finished" ? (
          <span className="phase-tag finished">Torneo Concluso</span>
        ) : (
          <span className="phase-tag combat">Torneo in Corso — Round {arenaMeta.currentRound}</span>
        )}
      </div>

      {/* CHAMPION BANNER */}
      {arenaMeta.phase === "finished" && arenaMeta.tournamentWinner && (
        <div className="champion-banner">
          <div className="champion-crown">♛</div>
          <div className="champion-label">Campione dell'Arena</div>
          <div className="champion-name">{snapshots[arenaMeta.tournamentWinner]?.name || "Campione"}</div>
          {arenaMeta.prizes && <div className="champion-prize">Premio: {arenaMeta.prizes}</div>}
        </div>
      )}

      {/* ── PANNELLO MASTER ── */}
      {isMaster && (
        <div className="master-panel">
          <h3 className="master-panel-title"><span className="master-crown">♛</span> Pannello del Master</h3>

          {arenaMeta.phase === "registration" && (
            <div className="prize-editor">
              <p className="col-label">🏆 Premi in Palio</p>
              <textarea className="prize-textarea" rows={2} placeholder="Descrivi i premi dell'arena…"
                value={prizeText} onChange={e => setPrizeText(e.target.value)} />
              <button className="btn-save-prize" onClick={savePrizes}>Salva</button>
            </div>
          )}

          <div className="master-sections">
            <div className="master-col">
              <p className="col-label">Approvati ({arenaMeta.participants?.length || 0})</p>
              {arenaMeta.participants?.length === 0 && <p className="empty-note">Nessuno ancora approvato.</p>}
              {arenaMeta.participants?.map(uid => (
                <div key={uid} className="participant-tag">
                  <span className="p-dot approved" />
                  {snapshots[uid]?.name || uid}
                  {snapshots[uid]?.class && <span className="p-class">{snapshots[uid].class}</span>}
                </div>
              ))}
            </div>
            <div className="master-col">
              <p className="col-label">In Attesa ({arenaMeta.waitingList?.length || 0})</p>
              {arenaMeta.waitingList?.length === 0 && <p className="empty-note">Nessuna richiesta.</p>}
              {arenaMeta.waitingList?.map(uid => (
                <div key={uid} className="approval-row">
                  <span className="p-dot pending" />
                  <span className="p-name">{snapshots[uid]?.name || uid}</span>
                  <button className="btn-approve" onClick={() => approveParticipant(uid)}>✓ Ammetti</button>
                </div>
              ))}
            </div>
          </div>

          <div className="master-actions">
            {arenaMeta.phase === "registration" && (
              <button className="btn-start-tournament" onClick={startTournament}
                disabled={!arenaMeta.participants || arenaMeta.participants.length < 2}>
                ⚔ Dai inizio all'Arena
              </button>
            )}
            {canAdvanceRound && (
              <button className="btn-advance-round" onClick={advanceRound}>
                ⚔ Round {(arenaMeta.currentRound || 1) + 1}
              </button>
            )}
            <button className="btn-reset" onClick={() => updateDoc(doc(db, "arena_meta", "global"), {
              phase: "registration", prizes: arenaMeta.prizes || "",
              participants: [], waitingList: [], matches: [],
              characterSnapshots: {}, tournamentWinner: null,
            })}>↺ Reset</button>
          </div>
        </div>
      )}

      {/* ── ZONA PLAYER: ISCRIZIONE ── */}
      {arenaMeta.phase === "registration" && !isMaster && (
        <div className="join-zone">

          {/* ── Fase ROLLING: tiro HP ── */}
          {loadoutPhase === "rolling" && charPreview && (() => {
            const { count, sides } = getHpDice(charPreview.class);
            return (
              <div className="hp-roll-panel">
                <div className="loadout-char-preview" style={{ justifyContent: "center", marginBottom: 20 }}>
                  {charPreview.image && (
                    <img src={charPreview.image} alt={charPreview.name} className="loadout-avatar" />
                  )}
                  <div>
                    <div className="loadout-char-name">{charPreview.name}</div>
                    <div className="loadout-char-class">{charPreview.class}</div>
                  </div>
                </div>

                <div className="hp-roll-title">Tira i tuoi Punti Vita</div>
                <div className="hp-dice-formula">{count}d{sides}</div>

                {!charPreview.rolledHp ? (
                  <button className="btn-roll-hp" onClick={rollHp}>
                    🎲 Tira {count}d{sides}
                  </button>
                ) : (
                  <div className="hp-roll-result-wrap">
                    <div className="hp-rolled-result">
                      <span className="hp-result-number">{charPreview.rolledHp}</span>
                      <span className="hp-result-label">punti vita</span>
                    </div>
                    <div className="hp-roll-buttons">
                      <button className="btn-reroll" onClick={rollHp}>↺ Ritira</button>
                      <button className="btn-join" onClick={() => setLoadoutPhase("selecting")}>
                        Continua →
                      </button>
                    </div>
                  </div>
                )}
                <button className="btn-cancel-loadout" style={{ marginTop: 18 }} onClick={cancelLoadout}>
                  Annulla
                </button>
              </div>
            );
          })()}

          {/* ── Fase SELECTING: equipaggiamento ── */}
          {loadoutPhase === "selecting" && charPreview && (() => {
            const config       = getLoadoutConfig(charPreview.class);
            const weaponsLeft  = config.maxWeapons - pendingWeapons.length;
            const spellsLeft   = config.maxSpells  - pendingSpells.length;
            const armorReady   = !!pendingArmor;
            const isReady      = weaponsLeft === 0 && spellsLeft === 0 && armorReady;
            const btnParts     = [];
            if (weaponsLeft > 0) btnParts.push(`${weaponsLeft} arm${weaponsLeft === 1 ? "a" : "i"}`);
            if (spellsLeft  > 0) btnParts.push(`${spellsLeft} incantesim${spellsLeft === 1 ? "o" : "i"}`);
            if (!armorReady)     btnParts.push("1 armatura");
            const btnText = isReady ? "Invia Iscrizione" : `Mancano: ${btnParts.join(" + ")}`;

            // Calcolo CA anteprima
            const dexMod   = charPreview.stats.dex ?? 0;
            const previewAc = pendingArmor
              ? pendingArmor.baseAc + Math.min(dexMod, pendingArmor.maxDex) + (pendingShield ? 2 : 0)
              : charPreview.stats.ac;

            // Scudo disabilitato se c'è un'arma a 2 mani selezionata
            const has2HWeapon  = pendingWeapons.some(w => w.twoHanded);
            const shieldLocked = has2HWeapon;

            return (
              <div className="loadout-panel">
                {/* Anteprima personaggio */}
                <div className="loadout-char-preview">
                  {charPreview.image && (
                    <img src={charPreview.image} alt={charPreview.name} className="loadout-avatar" />
                  )}
                  <div>
                    <div className="loadout-char-name">{charPreview.name}</div>
                    <div className="loadout-char-class">{charPreview.class}</div>
                    <div className="loadout-char-stats">
                      ❤ <strong>{charPreview.rolledHp}</strong> HP · 🛡 CA <strong>{previewAc}</strong>
                      · FOR {charPreview.stats.str >= 0 ? "+" : ""}{charPreview.stats.str}
                      · DES {charPreview.stats.dex >= 0 ? "+" : ""}{charPreview.stats.dex}
                      {charPreview.stats.int !== 0 && ` · INT ${charPreview.stats.int >= 0 ? "+" : ""}${charPreview.stats.int}`}
                      {charPreview.stats.wis !== 0 && ` · SAG ${charPreview.stats.wis >= 0 ? "+" : ""}${charPreview.stats.wis}`}
                    </div>
                  </div>
                </div>

                {/* Sezione Armi */}
                <div className="loadout-section-title">
                  ⚔ {config.maxWeapons === 1 ? "Arma" : "Armi"} — {pendingWeapons.length}/{config.maxWeapons}
                </div>
                <div className="loadout-grid">
                  {config.weaponOptions.map(item => {
                    const isSelected = pendingWeapons.some(a => a.name === item.name);
                    const isDisabled = !isSelected && pendingWeapons.length >= config.maxWeapons;
                    return (
                      <button
                        key={item.name}
                        className={`loadout-item weapon ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                        onClick={() => toggleWeapon(item, config.maxWeapons)}
                      >
                        <span className="loadout-item-icon">{item.icon}</span>
                        <span className="loadout-item-name">{item.name}</span>
                        <span className="loadout-item-damage">
                          {item.damage}{item.statKey ? ` +${item.statKey.toUpperCase()}` : ""}
                        </span>
                        {item.twoHanded && <span className="loadout-item-info">2 mani</span>}
                        {item.info && !item.twoHanded && <span className="loadout-item-info">{item.info}</span>}
                        {isSelected && <span className="loadout-check">✓</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Sezione Incantesimi */}
                {config.spellOptions.length > 0 && (
                  <>
                    <div className="loadout-section-title">
                      ✨ Incantesimi — {pendingSpells.length}/{config.maxSpells}
                    </div>
                    <div className="loadout-grid">
                      {config.spellOptions.map(item => {
                        const isSelected = pendingSpells.some(a => a.name === item.name);
                        const isDisabled = !isSelected && pendingSpells.length >= config.maxSpells;
                        return (
                          <button
                            key={item.name}
                            className={`loadout-item spell ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                            onClick={() => toggleSpell(item, config.maxSpells)}
                          >
                            <span className="loadout-item-icon">{item.icon}</span>
                            <span className="loadout-item-name">{item.name}</span>
                            <span className="loadout-item-damage">{item.damage}</span>
                            {item.info && <span className="loadout-item-info">{item.info}</span>}
                            {isSelected && <span className="loadout-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Sezione Abilità (Scudo caster) */}
                {config.skillOptions?.length > 0 && (
                  <>
                    <div className="loadout-section-title">
                      ⚡ Abilità — {pendingSkills.length}/{config.maxSkills} <span className="loadout-optional">(opzionale)</span>
                    </div>
                    <div className="loadout-grid">
                      {config.skillOptions.map(item => {
                        const isSelected = pendingSkills.some(a => a.name === item.name);
                        return (
                          <button
                            key={item.name}
                            className={`loadout-item spell ${isSelected ? "selected" : ""}`}
                            onClick={() => toggleSkill(item, config.maxSkills)}
                          >
                            <span className="loadout-item-icon">{item.icon}</span>
                            <span className="loadout-item-name">{item.name}</span>
                            <span className="loadout-item-damage">{item.info}</span>
                            {isSelected && <span className="loadout-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Abilità automatiche (Smite Paladino) */}
                {config.autoActions.length > 0 && (
                  <div className="loadout-auto-block">
                    <div className="loadout-section-title">⚡ Abilità Speciali (incluse automaticamente)</div>
                    {config.autoActions.map(a => (
                      <div key={a.name} className="loadout-auto-tag">
                        <span className="loadout-auto-icon">{a.icon}</span>
                        <span className="loadout-auto-name">{a.name}</span>
                        <span className="loadout-auto-dmg">{a.damage}{a.statKey ? ` +${a.statKey.toUpperCase()}` : ""}</span>
                        {a.info && <span className="loadout-auto-info">{a.info}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Sezione Armatura ── */}
                <div className="loadout-section-title">
                  🛡 Armatura — {pendingArmor ? `✓ ${pendingArmor.name}` : "nessuna selezionata"}
                </div>
                <div className="loadout-grid armor-grid">
                  {(ARENA_ARMORS[config.armorCategory] || []).map(armor => {
                    const isSelected = pendingArmor?.name === armor.name;
                    const dex = charPreview.stats.dex ?? 0;
                    const acPreview = armor.baseAc + Math.min(dex, armor.maxDex);
                    return (
                      <button
                        key={armor.name}
                        className={`loadout-item armor ${isSelected ? "selected" : ""}`}
                        onClick={() => { setPendingArmor(armor); if (shieldLocked) setPendingShield(false); }}
                      >
                        <span className="loadout-item-icon">{armor.icon}</span>
                        <span className="loadout-item-name">{armor.name}</span>
                        <span className="loadout-item-damage">CA {acPreview}{armor.maxDex > 0 ? `+DES` : ""}</span>
                        <span className="loadout-item-info">{armor.info}</span>
                        {isSelected && <span className="loadout-check">✓</span>}
                      </button>
                    );
                  })}
                </div>

                {/* ── Scudo (classi idonee) ── */}
                {config.canHaveShield && (
                  <div className="loadout-shield-row">
                    <button
                      className={`loadout-shield-btn ${pendingShield ? "selected" : ""} ${shieldLocked ? "disabled" : ""}`}
                      onClick={() => { if (!shieldLocked) setPendingShield(v => !v); }}
                      disabled={shieldLocked}
                    >
                      🛡 Scudo {shieldLocked ? "(incompatibile — arma a 2 mani)" : pendingShield ? "✓ Equipaggiato (+2 CA)" : "— +2 CA"}
                    </button>
                  </div>
                )}

                {/* Forma Selvatica (Druid) */}
                {config.hasWildShape && (
                  <div className="loadout-wild-note">
                    🐾 Avrai accesso alla <strong>Forma Selvatica</strong> durante il combattimento.
                  </div>
                )}

                {/* Preview selezione */}
                {(pendingWeapons.length > 0 || pendingSpells.length > 0) && (
                  <div className="loadout-selected-preview">
                    {[...pendingWeapons, ...pendingSpells].map(a => (
                      <span key={a.name} className="loadout-selected-tag">
                        {a.icon} {a.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="loadout-actions">
                  <button className="btn-cancel-loadout" onClick={cancelLoadout}>Annulla</button>
                  <button className="btn-join" onClick={confirmJoin} disabled={!isReady}>
                    {btnText}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── Vista idle: join / pending / registered ── */}
          {loadoutPhase === "idle" && (
            <div className="join-zone-inner">
              <div className="join-icon">⚔</div>
              <h2 className="join-title">Entra nell'Arena</h2>

              {arenaMeta.prizes && (
                <div className="prize-display">
                  <div className="prize-display-label">🏆 Premi in Palio</div>
                  <div className="prize-display-text">{arenaMeta.prizes}</div>
                </div>
              )}

              <p className="join-sub">
                {isRegistered
                  ? "Sei stato accettato. Preparati al combattimento."
                  : isPending
                  ? "La tua richiesta è stata inviata. Attendi l'approvazione del Master."
                  : "Scegli il tuo equipaggiamento e sfida i tuoi avversari."}
              </p>

              {!isRegistered && !isPending && (
                <button className="btn-join" onClick={openLoadoutPicker}>
                  Scegli Equipaggiamento
                </button>
              )}
              {isPending && (
                <button className="btn-join pending" disabled>⏳ In attesa di approvazione…</button>
              )}
              {isRegistered && (
                <div className="registered-badge">✔ Iscrizione confermata</div>
              )}

              {(isRegistered || isPending) && snapshots[currentUser?.uid]?.selectedActions && (
                <div className="my-loadout-preview">
                  <div className="my-loadout-label">Il tuo equipaggiamento:</div>
                  {snapshots[currentUser.uid].selectedActions.map(a => (
                    <span key={a.name} className="loadout-selected-tag">
                      {a.icon} {a.name} <em>{a.damage}{a.statKey ? ` +${a.statKey.toUpperCase()}` : ""}</em>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── COMBATTIMENTO ── */}
      {arenaMeta.phase === "combat" && (
        <div className="matches-container">
          {arenaMeta.matches.map(m => {
            const myPlayer       = m.players.find(p => p.id === currentUser?.uid);
            const isMyMatch      = !!myPlayer;
            const isMyTurn       = m.turn === currentUser?.uid;
            const isFFA          = m.players.length >= 3;
            const mySnap         = snapshots[currentUser?.uid];
            const myActions      = mySnap?.selectedActions || [];
            const aliveOpponents = m.players.filter(p => p.id !== currentUser?.uid && p.hp > 0);
            const chosenTargetId = isFFA
              ? (selectedTargets[m.matchId] || aliveOpponents[0]?.id || null)
              : aliveOpponents[0]?.id || null;
            const wildShapeForm  = myPlayer?.wildShape   || null;
            const isEntangled    = !!myPlayer?.entangled;
            const pendingDexSave = !!myPlayer?.pendingDexSave;
            const pendingConSave = !!myPlayer?.pendingConSave;
            const hasPendingSave = pendingDexSave || pendingConSave;
            const currentActions = wildShapeForm
              ? (WILD_SHAPES[wildShapeForm]?.actions || [])
              : myActions;

            // Sistema impugnatura armi
            const myWeaponActions  = myActions.filter(a => a.type === "weapon");
            const needsEquip       = !wildShapeForm && myPlayer?.equippedWeaponNames == null && myWeaponActions.length > 0;
            const equippedNames    = myPlayer?.equippedWeaponNames ?? [];
            // Selezioni pending equip (per pannello iniziale)
            const rawEquipSel      = equipSelections[m.matchId];
            const currentEquipSel  = rawEquipSel !== undefined
              ? rawEquipSel
              : myWeaponActions.map(w => w.name);
            const equipHas2H       = currentEquipSel.some(n => myWeaponActions.find(w => w.name === n)?.twoHanded);

            return (
              <div key={m.matchId} className={`match-card ${m.status === "finished" ? "finished" : ""}`}>

                <div className="match-header">
                  <span className="match-round-label">Round {arenaMeta.currentRound}</span>
                  <span className="match-vs-label">{isFFA ? "FFA" : "VS"}</span>
                  <span className="match-status-label">
                    {m.status === "initiative" ? "⚡ Iniziativa"
                      : m.status === "finished" ? "🏆 Concluso"
                      : isFFA ? "⚔ Tutti contro Tutti"
                      : "⚔ Combattimento"}
                  </span>
                </div>

                {m.status === "active" && m.turn && (
                  <div className="turn-tracker">
                    Turno di: <strong>{m.players.find(p => p.id === m.turn)?.name || "?"}</strong>
                  </div>
                )}

                {/* Fighters */}
                <div className="fighters-row">
                  {m.players.map((p, idx) => {
                    const char     = snapshots[p.id] || { stats: { maxHp: 70, ac: 10 } };
                    const isDead   = p.hp <= 0;
                    const isActive = m.turn === p.id;
                    const hpPct    = Math.max(0, (p.hp / (char.stats?.maxHp ?? 70)) * 100);
                    const hpColor  = hpPct > 60 ? "#27ae60" : hpPct > 30 ? "#e67e22" : "#c0392b";

                    return (
                      <React.Fragment key={p.id}>
                        {idx > 0 && <div className="vs-divider">{isFFA ? "·" : "VS"}</div>}
                        <div className={`fighter-card ${isActive ? "active-turn" : ""} ${isDead ? "defeated" : ""}`}>
                          {isActive && !isDead && <div className="turn-indicator">Il tuo turno</div>}
                          {isDead && <div className="defeated-banner">Sconfitto</div>}

                          {char.image && (
                            <img src={char.image} alt={p.name} className="fighter-avatar" />
                          )}
                          <div className="fighter-name">{p.name}</div>
                          {char.class && <div className="fighter-class">{char.class}</div>}
                          <div className="fighter-meta">CA {char.stats?.ac ?? "?"} · Init {p.init > 0 ? p.init : "—"}</div>

                          <div className="hp-bar-wrap">
                            <div className="hp-bar-bg">
                              <div className="hp-bar-fill" style={{ width: `${hpPct}%`, background: hpColor }} />
                            </div>
                            <span className="hp-label">{p.hp} / {char.stats?.maxHp ?? 70} HP</span>
                          </div>

                          {p.wildShape && (
                            <div className="fighter-wild-badge">
                              {WILD_SHAPES[p.wildShape]?.icon} {WILD_SHAPES[p.wildShape]?.name}
                            </div>
                          )}
                          {p.entangled && (
                            <div className="fighter-entangled-badge">🕸 Intrappolato</div>
                          )}
                          {(p.shieldSkillTurns ?? 0) > 0 && (
                            <div className="fighter-shield-skill-badge">🛡 Scudo ({p.shieldSkillTurns} turni)</div>
                          )}

                          {isMyMatch && m.status === "initiative" && p.id === currentUser?.uid && p.init === 0 && (
                            <button className="btn-init" onClick={() => rollInit(m.matchId)}>
                              🎲 Tira Iniziativa
                            </button>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Action panel */}
                {isMyMatch && isMyTurn && m.status === "active" && (
                  <div className="action-panel">
                    {isFFA && (
                      <div className="target-selector-row">
                        <span className="target-selector-label">Bersaglio:</span>
                        {aliveOpponents.map(t => (
                          <button
                            key={t.id}
                            className={`btn-target ${chosenTargetId === t.id ? "selected" : ""}`}
                            onClick={() => setSelectedTargets(prev => ({ ...prev, [m.matchId]: t.id }))}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {!isFFA && chosenTargetId && (
                      <div className="target-1v1-label">
                        Attacchi: <strong>{m.players.find(p => p.id === chosenTargetId)?.name}</strong>
                      </div>
                    )}

                    {/* ── Wild Shape: pulsante selezione ── */}
                    {mySnap?.hasWildShape && !wildShapeForm && !showWildPicker && !hasPendingSave && !isEntangled && (
                      <div className="wild-shape-bar">
                        <button className="btn-wild-shape" onClick={() => setShowWildPicker(true)}>
                          🐾 Forma Selvatica
                        </button>
                      </div>
                    )}

                    {/* ── Wild Shape: picker animali ── */}
                    {showWildPicker && !wildShapeForm && (
                      <div className="wild-picker">
                        <div className="wild-picker-title">Scegli la Forma Selvatica</div>
                        <div className="wild-picker-forms">
                          {Object.entries(WILD_SHAPES).map(([key, form]) => (
                            <button key={key} className="btn-wild-form" onClick={() => handleWildShape(m.matchId, key)}>
                              <span className="wild-form-icon">{form.icon}</span>
                              <span className="wild-form-name">{form.name}</span>
                              <span className="wild-form-hp">{form.hpDice.count}d{form.hpDice.sides} HP</span>
                              <div className="wild-form-actions">
                                {form.actions.map(a => (
                                  <span key={a.name} className="wild-form-action-tag">
                                    {a.icon} {a.name} {a.damage !== "—" ? a.damage : ""}
                                    {a.statKey ? ` +${a.statKey.toUpperCase()}` : ""}
                                    {a.special === "web" ? " (TS DES)" : ""}
                                    {a.special === "poison" ? " (TS COS)" : ""}
                                  </span>
                                ))}
                              </div>
                            </button>
                          ))}
                        </div>
                        <button className="btn-cancel-wild" onClick={() => setShowWildPicker(false)}>
                          ✕ Annulla
                        </button>
                      </div>
                    )}

                    {/* ── Wild Shape attiva ── */}
                    {wildShapeForm && (
                      <div className="wild-shape-active-bar">
                        <span className="wild-active-label">
                          {WILD_SHAPES[wildShapeForm]?.icon} {WILD_SHAPES[wildShapeForm]?.name}
                        </span>
                        <button className="btn-revert-wild" onClick={() => revertWildShape(m.matchId)}>
                          ↩ Forma Originale
                        </button>
                      </div>
                    )}

                    {/* ── Tiro Salvezza DEX (ragnatela) ── */}
                    {pendingDexSave && (
                      <div className="save-block dex">
                        <p className="save-block-label">🕸 Tiro Salvezza su DES per evitare la ragnatela! (CD 15)</p>
                        <button className="btn-saving-throw" onClick={() => rollSavingThrow(m.matchId, "dex", "dex_web")}>
                          🎲 TS Destrezza
                        </button>
                      </div>
                    )}

                    {/* ── Tiro Salvezza CON (veleno) ── */}
                    {!pendingDexSave && pendingConSave && (
                      <div className="save-block con">
                        <p className="save-block-label">☠ Tiro Salvezza su COS contro il Veleno! (CD 15)</p>
                        <button className="btn-saving-throw" onClick={() => rollSavingThrow(m.matchId, "con", "con_poison")}>
                          🎲 TS Costituzione
                        </button>
                      </div>
                    )}

                    {/* ── Tiro Salvezza FOR (liberarsi dalla ragnatela) ── */}
                    {isEntangled && !hasPendingSave && (
                      <div className="save-block str">
                        <p className="save-block-label">🕸 Sei intrappolato nella ragnatela! TS FOR per liberarti (CD 15) — il turno passa.</p>
                        <button className="btn-saving-throw" onClick={() => rollSavingThrow(m.matchId, "str", "str_escape")}>
                          🎲 TS Forza (Liberarsi)
                        </button>
                      </div>
                    )}

                    {/* ── Pannello equip iniziale (gratuito, primo turno) ── */}
                    {needsEquip && !hasPendingSave && !isEntangled && !showWildPicker && (
                      <div className="equip-panel">
                        <div className="equip-panel-title">⚔ Scegli le armi da impugnare</div>
                        <div className="equip-panel-weapons">
                          {myWeaponActions.map(w => {
                            const isSel = currentEquipSel.includes(w.name);
                            const isDisabled = !isSel && equipHas2H && !w.twoHanded;
                            const otherIs2H = !isSel && w.twoHanded && currentEquipSel.length > 0;
                            return (
                              <button
                                key={w.name}
                                className={`equip-weapon-btn ${isSel ? "sel" : ""} ${isDisabled || otherIs2H ? "locked" : ""}`}
                                onClick={() => {
                                  if (isDisabled || otherIs2H) return;
                                  setEquipSelections(prev => {
                                    const cur = prev[m.matchId] !== undefined ? prev[m.matchId] : myWeaponActions.map(x => x.name);
                                    if (isSel) return { ...prev, [m.matchId]: cur.filter(n => n !== w.name) };
                                    if (w.twoHanded) return { ...prev, [m.matchId]: [w.name] };
                                    const no2H = cur.filter(n => !myWeaponActions.find(x => x.name === n)?.twoHanded);
                                    return { ...prev, [m.matchId]: [...no2H, w.name] };
                                  });
                                }}
                              >
                                {w.icon} {w.name}
                                {w.twoHanded && <span className="equip-2h-tag">2 mani</span>}
                                {isSel && " ✓"}
                              </button>
                            );
                          })}
                        </div>
                        {mySnap?.hasShield && !equipHas2H && (
                          <p className="equip-shield-note">🛡 Scudo attivo (+2 CA){equipHas2H ? " — disabilitato con arma a 2 mani" : ""}</p>
                        )}
                        {equipHas2H && mySnap?.hasShield && (
                          <p className="equip-shield-note locked">🛡 Scudo non disponibile con arma a 2 mani</p>
                        )}
                        <button
                          className="btn-confirm-equip"
                          onClick={() => handleEquipWeapons(m.matchId, currentEquipSel)}
                          disabled={currentEquipSel.length === 0}
                        >
                          ✓ Conferma Impugnatura
                        </button>
                      </div>
                    )}

                    {/* ── Pulsanti attacco ── */}
                    {!needsEquip && !hasPendingSave && !isEntangled && !showWildPicker && (
                      chosenTargetId ? (() => {
                        const targetMatchPlayer = m.players.find(p => p.id === chosenTargetId);
                        const targetMaxHp = snapshots[chosenTargetId]?.stats?.maxHp ?? 70;
                        const targetHpPct = targetMatchPlayer ? (targetMatchPlayer.hp / targetMaxHp) * 100 : 100;
                        return (
                          <div className="action-buttons">
                            {currentActions.map(action => {
                              // Colpo Mortale: visibile solo se il bersaglio è ≤20% HP
                              if (action.special === "deathblow" && targetHpPct > 20) return null;
                              // Scudo: non richiede bersaglio, gestito separatamente
                              if (action.special === "shield_buff") {
                                return (
                                  <button
                                    key={action.name}
                                    className="btn-action skill"
                                    title="+2 CA per 3 turni"
                                    onClick={() => handleShieldSkill(m.matchId)}
                                  >
                                    <span className="action-icon">{action.icon}</span>
                                    <span className="action-name">{action.name}</span>
                                    <span className="action-dice">+2 CA · 3 turni</span>
                                  </button>
                                );
                              }
                              const isWeapon   = action.type === "weapon";
                              const isEquipped = !isWeapon || wildShapeForm || equippedNames.includes(action.name);
                              return (
                                <button
                                  key={action.name}
                                  className={`btn-action ${action.type} ${isWeapon && !wildShapeForm ? (isEquipped ? "equipped" : "unequipped") : ""}`}
                                  title={action.special === "web"
                                    ? "Ragnatela — TS DES bersaglio"
                                    : action.special === "poison"
                                    ? `Veleno — ${action.damage} danni + TS COS`
                                    : action.special === "deathblow"
                                    ? `Colpo Mortale — ${action.damage} +DES (solo ≤20% HP)`
                                    : !isEquipped
                                    ? "Clicca per impugnare (spende il turno)"
                                    : `+${action.hitBonus}${action.statKey ? ` +${action.statKey.toUpperCase()}` : ""} | ${action.damage}${action.statKey ? ` +${action.statKey.toUpperCase()}` : ""}`}
                                  onClick={() =>
                                    isEquipped
                                      ? handleAttack(m.matchId, chosenTargetId, action)
                                      : handleSwitchWeapon(m.matchId, action.name)
                                  }
                                >
                                  <span className="action-icon">{action.icon}</span>
                                  <span className="action-name">{action.name}</span>
                                  <span className="action-dice">
                                    {!isEquipped
                                      ? "🔄 Cambia"
                                      : action.special === "web" ? "TS DES"
                                      : action.special === "poison" ? `${action.damage} +TS COS`
                                      : `${action.damage}${action.statKey ? ` +${action.statKey.toUpperCase()}` : ""}`}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })() : (
                        <div className="no-target-msg">Nessun bersaglio disponibile.</div>
                      )
                    )}
                  </div>
                )}

                <div className="match-log">
                  {m.logs.slice(-5).map((l, i) => (
                    <p key={i} className={`log-entry ${i === m.logs.slice(-5).length - 1 ? "latest" : ""}`}>{l}</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
