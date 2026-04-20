import React, { useState, useEffect, useCallback, useRef } from "react";
import { db } from "../firebase";
import {
  doc, getDoc, getDocs, onSnapshot, updateDoc, setDoc,
  arrayUnion, arrayRemove, addDoc, collection, serverTimestamp,
  runTransaction, increment,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./Arena.css";

// ── WIZARD SPELLS (Mago) — pool: 3 trucchetti · 4 lv1 · 3 lv2 · 3 lv3 (sceglie 2+2+2+1)
const WIZARD_SPELLS = [
  { name: "Dardo di Fuoco",        level: 0, hitBonus: 3,  damage: "1d10",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco" },
  { name: "Tocco gelido",              level: 0, hitBonus: 3,  damage: "1d8",   statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Freddo" },
  { name: "Spruzzo Velenoso",      level: 0, hitBonus: 3,  damage: "1d12",  statKey: null, type: "spell", icon: "🧄", info: "Trucchetto · Veleno" },
  { name: "Dardo Incantato",       level: 1, hitBonus: 39, damage: "3d4+3", statKey: null, type: "spell", icon: "✨", info: "Lv1 · Forza · colpisce sempre", maxUses: 3 },
  { name: "Mani Brucianti",        level: 1, hitBonus: 3,  damage: "3d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv1 · Fuoco", maxUses: 3 },
  { name: "Scudo",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 CA/3 turni", special: "shield_buff", maxUses: 2 },
  { name: "Sonno",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "😴", info: "Lv1 · Controllo · TS o perdi turno", special: "control", maxUses: 3 },
  { name: "Raggio Rovente",        level: 2, hitBonus: 3,  damage: "6d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco (3 raggi × 2d6)", maxUses: 2 },
  { name: "Frantumare",            level: 2, hitBonus: 3,  damage: "3d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Invisibilita",          level: 2, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "👻", info: "Lv2 · Controllo · TS o perdi turno", special: "control", maxUses: 2 },
  { name: "Palla di Fuoco",        level: 3, hitBonus: 3,  damage: "8d6",   statKey: null, type: "spell", icon: "💥", info: "Lv3 · Fuoco", maxUses: 1 },
  { name: "Fulmine",               level: 3, hitBonus: 3,  damage: "8d6",   statKey: null, type: "spell", icon: "⚡", info: "Lv3 · Fulmine", maxUses: 1 },
  { name: "Contrincantesimo",      level: 3, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🚫", info: "Lv3 · Controllo · TS o perdi turno", special: "control", maxUses: 1 },
];

// ── SORCERER SPELLS (Stregone) — pool: 3 trucchetti · 4 lv1 · 3 lv2 · 3 lv3 (sceglie 2+2+2+1)
const SORCERER_SPELLS = [
  { name: "Dardo di Fuoco",        level: 0, hitBonus: 3,  damage: "1d10",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco" },
  { name: "Scossa Folgorante",     level: 0, hitBonus: 3,  damage: "1d8",   statKey: null, type: "spell", icon: "⚡",  info: "Trucchetto · Fulmine" },
  { name: "Gelidito",              level: 0, hitBonus: 3,  damage: "1d8",   statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Freddo" },
  { name: "Mani Brucianti",        level: 1, hitBonus: 3,  damage: "3d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv1 · Fuoco", maxUses: 3 },
  { name: "Dardo Incantato",       level: 1, hitBonus: 39, damage: "3d4+3", statKey: null, type: "spell", icon: "✨", info: "Lv1 · Forza · colpisce sempre", maxUses: 3 },
  { name: "Scudo",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 CA/3 turni", special: "shield_buff", maxUses: 2 },
  { name: "Sonno",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "😴", info: "Lv1 · Controllo · TS o perdi turno", special: "control", maxUses: 3 },
  { name: "Raggio Rovente",        level: 2, hitBonus: 3,  damage: "6d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco (3 raggi × 2d6)", maxUses: 2 },
  { name: "Frantumare",            level: 2, hitBonus: 3,  damage: "3d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Suggestione",           level: 2, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🌀", info: "Lv2 · Controllo · TS o perdi turno", special: "control", maxUses: 2 },
  { name: "Palla di Fuoco",        level: 3, hitBonus: 3,  damage: "8d6",   statKey: null, type: "spell", icon: "💥", info: "Lv3 · Fuoco", maxUses: 1 },
  { name: "Fulmine",               level: 3, hitBonus: 3,  damage: "8d6",   statKey: null, type: "spell", icon: "⚡", info: "Lv3 · Fulmine", maxUses: 1 },
  { name: "Paura",                 level: 3, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "😱", info: "Lv3 · Controllo · TS o perdi turno", special: "control", maxUses: 1 },
];

// ── WARLOCK SPELLS (Oscuro Cultore) — pool: 2 trucchetti · 3 lv1 · 2 lv3 (sceglie 2+1+0+2)
const WARLOCK_SPELLS = [
  { name: "Deflagrazione Occulta", level: 0, hitBonus: 3, damage: "1d10", statKey: null, type: "spell", icon: "🟣", info: "Trucchetto · Forza" },
  { name: "Rintocco dei Morti",    level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "💀", info: "Trucchetto · Necrotico" },
  { name: "Braccia di Hadar",      level: 1, hitBonus: 3, damage: "2d6",  statKey: null, type: "spell", icon: "🐙", info: "Lv1 · Necrotico", maxUses: 3 },
  { name: "Scudo",                 level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 CA/3 turni", special: "shield_buff", maxUses: 2 },
  { name: "Malocchio",             level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "👁", info: "Lv1 · Controllo · TS o perdi turno", special: "control", maxUses: 3 },
  { name: "Fame di Hadar",         level: 3, hitBonus: 3, damage: "2d6",  statKey: null, type: "spell", icon: "🌑", info: "Lv3 · Freddo/Acido", maxUses: 1 },
  { name: "Paura",                 level: 3, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "😱", info: "Lv3 · Controllo · TS o perdi turno", special: "control", maxUses: 1 },
];

// ── DRUID SPELLS (Druido) — pool: 2 trucchetti · 3 lv1 · 3 lv2 · 2 lv3 (sceglie 1+1+1+1)
const DRUID_SPELLS = [
  { name: "Fiamma Sacra",          level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Radiante" },
  { name: "Frusta di Spine",       level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🌿", info: "Trucchetto · Perforante" },
  { name: "Onda Tonante",          level: 1, hitBonus: 3, damage: "2d8",  statKey: null, type: "spell", icon: "💨", info: "Lv1 · Tuono", maxUses: 3 },
  { name: "Cura Ferite",           level: 1, hitBonus: 0, damage: "1d8+3", statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Intralciare",           level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🌱", info: "Lv1 · Controllo · TS o perdi turno", special: "control", maxUses: 3 },
  { name: "Riscaldare Metallo",    level: 2, hitBonus: 3, damage: "2d8",  statKey: null, type: "spell", icon: "🔩", info: "Lv2 · Fuoco", maxUses: 2 },
  { name: "Frantumare",            level: 2, hitBonus: 3, damage: "3d8",  statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Blocca Persone",        level: 2, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🧊", info: "Lv2 · Controllo · TS o perdi turno", special: "control", maxUses: 2 },
  { name: "Richiamare Fulmini",    level: 3, hitBonus: 3, damage: "3d10", statKey: null, type: "spell", icon: "⛈", info: "Lv3 · Fulmine", maxUses: 1 },
  { name: "Crescita Vegetale",     level: 3, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🌾", info: "Lv3 · Controllo · TS o perdi turno", special: "control", maxUses: 1 },
];

// ── CLERIC SPELLS (Chierico) — pool: 2 trucchetti · 5 lv1 · 3 lv2 · 1 lv3 (sceglie 1+2+1+0)
const CLERIC_SPELLS = [
  { name: "Fiamma Sacra",          level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "✨", info: "Trucchetto · Radiante" },
  { name: "Rintocco dei Morti",    level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "💀", info: "Trucchetto · Necrotico" },
  { name: "Cura Ferite",           level: 1, hitBonus: 0, damage: "1d8+3", statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Parola Guaritrice",     level: 1, hitBonus: 0, damage: "1d4+3", statKey: null, type: "spell", icon: "💙", info: "Lv1 · Cura rapida · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Dardo Guidato",         level: 1, hitBonus: 3, damage: "4d6",  statKey: null, type: "spell", icon: "🌟", info: "Lv1 · Radiante", maxUses: 3 },
  { name: "Infliggi Ferite",       level: 1, hitBonus: 3, damage: "3d10", statKey: null, type: "spell", icon: "🩸", info: "Lv1 · Necrotico", maxUses: 3 },
  { name: "Scudo della Fede",      level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 CA/3 turni", special: "shield_buff", maxUses: 2 },
  { name: "Arma Spirituale",       level: 2, hitBonus: 3, damage: "1d8+4", statKey: null, type: "spell", icon: "⚔",  info: "Lv2 · Forza", maxUses: 2 },
  { name: "Ristorare Inferiore",   level: 2, hitBonus: 0, damage: "1d4+2", statKey: null, type: "spell", icon: "💊", info: "Lv2 · Rimuove condizioni + cura 1d4+2 HP", special: "heal", maxUses: 2 },
  { name: "Blocca Persone",        level: 2, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🧊", info: "Lv2 · Controllo · TS o perdi turno", special: "control", maxUses: 2 },
  { name: "Guardiani Spirituali",  level: 3, hitBonus: 3, damage: "3d8",  statKey: null, type: "spell", icon: "👼", info: "Lv3 · Radiante", maxUses: 1 },
];

// ── BARD SPELLS (Bardo) — pool: 2 trucchetti · 3 lv1 · 3 lv2 (sceglie 1+1+2+0)
const BARD_SPELLS = [
  { name: "Beffarda Scelleratezza",level: 0, hitBonus: 3, damage: "1d4",   statKey: null, type: "spell", icon: "🎵", info: "Trucchetto · Psichico" },
  { name: "Dardo di Fuoco",        level: 0, hitBonus: 3, damage: "1d10",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco" },
  { name: "Parola Guaritrice",     level: 1, hitBonus: 0, damage: "1d4+3", statKey: null, type: "spell", icon: "💙", info: "Lv1 · Cura rapida · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Onda Tonante",          level: 1, hitBonus: 3, damage: "2d8",   statKey: null, type: "spell", icon: "💨", info: "Lv1 · Tuono", maxUses: 3 },
  { name: "Risata Incontenibile",  level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🤣", info: "Lv1 · Controllo · TS o perdi turno", special: "control", maxUses: 3 },
  { name: "Frantumare",            level: 2, hitBonus: 3, damage: "3d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Suggestione",           level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌀", info: "Lv2 · Controllo · TS o perdi turno", special: "control", maxUses: 2 },
  { name: "Invisibilita",          level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "👻", info: "Lv2 · Controllo · TS o perdi turno", special: "control", maxUses: 2 },
];

// ── PALADIN SPELLS (Paladino) — pool: 4 lv1 · 3 lv2 · 3 lv3 (sceglie 0+2+1+1)
const PALADIN_SPELLS = [
  { name: "Cura Ferite",           level: 1, hitBonus: 0, damage: "1d8+3", statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Scudo della Fede",      level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 CA/3 turni", special: "shield_buff", maxUses: 2 },
  { name: "Punizione Travolgente", level: 1, hitBonus: 3, damage: "1d6",   statKey: null, type: "spell", icon: "⚡", info: "Lv1 · Radiante bonus", maxUses: 3 },
  { name: "Comando",               level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "📞", info: "Lv1 · Controllo · TS o perdi turno", special: "control", maxUses: 3 },
  { name: "Punizione Marchiante",  level: 2, hitBonus: 3, damage: "2d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Radiante", maxUses: 2 },
  { name: "Ristorare Inferiore",   level: 2, hitBonus: 0, damage: "1d4+2", statKey: null, type: "spell", icon: "💊", info: "Lv2 · Rimuove condizioni + cura 1d4+2 HP", special: "heal", maxUses: 2 },
  { name: "Zona di Verita",        level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "⚖",  info: "Lv2 · Controllo · TS o perdi turno", special: "control", maxUses: 2 },
  { name: "Aura di Vitalita",      level: 3, hitBonus: 0, damage: "2d6",   statKey: null, type: "spell", icon: "💛", info: "Lv3 · Cura potente · ripristina HP", special: "heal", maxUses: 1 },
  { name: "Dissolvi Magie",        level: 3, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "✨", info: "Lv3 · Controllo · TS o perdi turno", special: "control", maxUses: 1 },
  { name: "Punizione Accecante",   level: 3, hitBonus: 3, damage: "3d8",   statKey: null, type: "spell", icon: "💥", info: "Lv3 · Radiante", maxUses: 1 },
];

// ── RANGER SPELLS (Ranger) — pool: 3 lv1 · 2 lv2 (sceglie 0+2+1+0)
const RANGER_SPELLS = [
  { name: "Marchio del Cacciatore",level: 1, hitBonus: 3, damage: "1d6",   statKey: null, type: "spell", icon: "🎯", info: "Lv1 · Danno extra", maxUses: 3 },
  { name: "Cura Ferite",           level: 1, hitBonus: 0, damage: "1d8+3", statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Intralciare",           level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌱", info: "Lv1 · Controllo · TS o perdi turno", special: "control", maxUses: 3 },
  { name: "Passo Velato",          level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌀", info: "Lv2 · Controllo · TS o perdi turno", special: "control", maxUses: 2 },
  { name: "Corda del Cacciatore",  level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🧵", info: "Lv2 · Controllo · TS o perdi turno", special: "control", maxUses: 2 },
];

// ── ARMI SEMPLICI ──────────────────────────────────────────────────────
const SIMPLE_WEAPONS = [
  { name: "Daga",             hitBonus: 3, damage: "1d4+3",  statKey: "dex", type: "weapon", icon: "🗡", twoHanded: false },
  { name: "Randello",         hitBonus: 3, damage: "1d4+3",  statKey: "str", type: "weapon", icon: "🏏", twoHanded: false },
  { name: "Ascetta",          hitBonus: 3, damage: "1d6+3",  statKey: "str", type: "weapon", icon: "🪓", twoHanded: false },
  { name: "Giavellotto",      hitBonus: 3, damage: "1d6+3",  statKey: "str", type: "weapon", icon: "🎯", twoHanded: false },
  { name: "Martello Leggero", hitBonus: 3, damage: "1d4+3",  statKey: "str", type: "weapon", icon: "🔨", twoHanded: false },
  { name: "Mazza",            hitBonus: 3, damage: "1d6+3",  statKey: "str", type: "weapon", icon: "🏏", twoHanded: false },
  { name: "Bastone Ferrato",  hitBonus: 3, damage: "1d8+3",  statKey: "str", type: "weapon", icon: "🪄", twoHanded: true  },
  { name: "Falcetto",         hitBonus: 3, damage: "1d4+3",  statKey: "dex", type: "weapon", icon: "⚔",  twoHanded: false },
  { name: "Lancia",           hitBonus: 3, damage: "1d8+3",  statKey: "str", type: "weapon", icon: "🔱", twoHanded: false },
  { name: "Arco Corto",       hitBonus: 3, damage: "1d6+3",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true  },
  { name: "Balestra Leggera", hitBonus: 3, damage: "1d8+3",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true  },
  { name: "Dardo",            hitBonus: 3, damage: "1d4+3",  statKey: "dex", type: "weapon", icon: "🎯", twoHanded: false },
  { name: "Fionda",           hitBonus: 3, damage: "1d4+3",  statKey: "str", type: "weapon", icon: "⭕",  twoHanded: false },
];

// ── ARMI MARZIALI ─────────────────────────────────────────────────────
const MARTIAL_WEAPONS = [
  { name: "Ascia da Battaglia",  hitBonus: 3, damage: "1d10+3", statKey: "str", type: "weapon", icon: "🪓", twoHanded: false },
  { name: "Flagello",            hitBonus: 3, damage: "1d8+3",  statKey: "str", type: "weapon", icon: "⚔",  twoHanded: false },
  { name: "Alabarda",            hitBonus: 3, damage: "1d10+3", statKey: "str", type: "weapon", icon: "⚔",  twoHanded: true  },
  { name: "Spadone",             hitBonus: 3, damage: "2d6+3",  statKey: "str", type: "weapon", icon: "⚔",  twoHanded: true  },
  { name: "Maglio",              hitBonus: 3, damage: "2d6+3",  statKey: "str", type: "weapon", icon: "🔨", twoHanded: true  },
  { name: "Ascia Bipenne",       hitBonus: 3, damage: "1d12+3", statKey: "str", type: "weapon", icon: "🪓", twoHanded: true  },
  { name: "Lancia da Cavaliere", hitBonus: 3, damage: "1d12+3", statKey: "str", type: "weapon", icon: "🏇", twoHanded: true  },
  { name: "Spada Lunga",         hitBonus: 3, damage: "1d10+3", statKey: "str", type: "weapon", icon: "⚔",  twoHanded: false },
  { name: "Martello da Guerra",  hitBonus: 3, damage: "1d10+3", statKey: "str", type: "weapon", icon: "🔨", twoHanded: false },
  { name: "Morgenstern",         hitBonus: 3, damage: "1d8+3",  statKey: "str", type: "weapon", icon: "⚙",  twoHanded: false },
  { name: "Stocco",              hitBonus: 3, damage: "1d8+3",  statKey: "dex", type: "weapon", icon: "🗡", twoHanded: false },
  { name: "Scimitarra",          hitBonus: 3, damage: "1d6+3",  statKey: "dex", type: "weapon", icon: "⚔",  twoHanded: false },
  { name: "Spada Corta",         hitBonus: 3, damage: "1d6+3",  statKey: "dex", type: "weapon", icon: "⚔",  twoHanded: false },
  { name: "Tridente",            hitBonus: 3, damage: "1d8+3",  statKey: "str", type: "weapon", icon: "🔱", twoHanded: false },
  { name: "Frusta",              hitBonus: 3, damage: "1d4+3",  statKey: "dex", type: "weapon", icon: "⛓",  twoHanded: false },
  { name: "Arco Lungo",          hitBonus: 3, damage: "1d8+3",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true  },
  { name: "Balestra Pesante",    hitBonus: 3, damage: "1d10+3", statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true  },
  { name: "Balestra a Mano",     hitBonus: 3, damage: "1d6+3",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: false },
];

// ── Set armi per classe (derivati dagli array base) ───────────────────────────────
const _sw = (n) => SIMPLE_WEAPONS.find(w => w.name === n);
const _mw = (n) => MARTIAL_WEAPONS.find(w => w.name === n);
const CLERIC_WEAPON_OPTIONS  = [_sw("Mazza"), _sw("Balestra Leggera"), _mw("Martello da Guerra")].filter(Boolean);
const DRUID_WEAPON_OPTIONS   = [...SIMPLE_WEAPONS, _mw("Scimitarra")].filter(Boolean);
const BARD_WEAPON_OPTIONS    = [...SIMPLE_WEAPONS, _mw("Stocco")].filter(Boolean);
const ROGUE_WEAPON_OPTIONS   = [_mw("Stocco"), _sw("Arco Corto"), _sw("Daga"), _mw("Spada Corta")].filter(Boolean);
const RANGER_WEAPON_OPTIONS  = [...SIMPLE_WEAPONS, _mw("Spada Corta"), _mw("Arco Lungo")].filter(Boolean);
const WIZARD_WEAPON_OPTIONS  = [_sw("Bastone Ferrato"), _sw("Daga")].filter(Boolean);


// ── ARMATURE — hitPenalty: malus ai tiri per colpire (più è pesante, più rallenta) ──
const _ARMOR_LIGHT = [
  // { name: "Vesti Imbottite",            baseAc: 11, maxDex: 99, hitPenalty:  0, icon: "🧥", info: "Leggera · +DES pieno · ±0 attacco" },
  { name: "Armatura di cuoio",          baseAc: 11, maxDex: 99, hitPenalty:  0, icon: "👘", info: "Leggera · +DES pieno · ±0 attacco" },
  { name: "Armatura di cuoio borchiato",baseAc: 12, maxDex: 99, hitPenalty:  0, icon: "👘", info: "Leggera · +DES pieno · ±0 attacco" },
];
const _ARMOR_MEDIUM = [
  { name: "Pelliccia Rinforzata", baseAc: 12, maxDex: 2, hitPenalty:  0, icon: "🦺", info: "Media · +DES max 2 · ±0 attacco" },
  { name: "Cuoio Indurito",       baseAc: 13, maxDex: 2, hitPenalty: -1, icon: "🦺", info: "Media · +DES max 2 · −1 attacco" },
];
const _ARMOR_MEDIUM_STUDDED = [
  { name: "Cuoio Borchiato", baseAc: 14, maxDex: 2, hitPenalty:  0, icon: "⚙", info: "Borchiata · +DES max 2 · ±0 attacco" },
  // { name: "Maglia di Cuoio", baseAc: 1, maxDex: 2, hitPenalty: -1, icon: "⚙", info: "Borchiata · +DES max 2 · −1 attacco" },
  { name: "Mezza Piastre",   baseAc: 15, maxDex: 2, hitPenalty: -1, icon: "⚙", info: "Borchiata · +DES max 2 · −2 attacco" },
];
const ARENA_ARMORS = {
  caster:        [{ name: "Tunica", baseAc: 12, maxDex: 99, hitPenalty: 0, icon: "👘", info: "Caster · +DES pieno · ±0 attacco" }],
  light:         _ARMOR_LIGHT,
  medium:        _ARMOR_MEDIUM,
  mediumStudded: _ARMOR_MEDIUM_STUDDED,
  heavy: [
    { name: "Cotta ad Anelli",    baseAc: 16, maxDex: 0, hitPenalty: -1, icon: "🛡", info: "Pesante · senza DES · −1 attacco" },
    // { name: "Cotta di Maglia",    baseAc: 20, maxDex: 0, hitPenalty: -2, icon: "🛡", info: "Pesante · senza DES · −2 attacco" },
    { name: "Armatura a Placche", baseAc: 17, maxDex: 0, hitPenalty: -1, icon: "🛡", info: "Pesante · senza DES · −3 attacco" },
    { name: "Piastre Intere",     baseAc: 18, maxDex: 0, hitPenalty: -2, icon: "🛡", info: "Pesante · senza DES · −4 attacco" },
  ],
  // Druido: leggere + medie, niente metalli
  druid:      [..._ARMOR_LIGHT, ..._ARMOR_MEDIUM],
  // Ranger: leggere + medie + borchiate
  lightMedium:[..._ARMOR_LIGHT, ..._ARMOR_MEDIUM, ..._ARMOR_MEDIUM_STUDDED],
};

// ── WILD SHAPE FORMS ──────────────────────────────────────────────────────────
const WILD_SHAPES = {
  wolf: {
    name: "Lupo", icon: "🐺",
    hpDice: { count: 8, sides: 12 },
    actions: [
      { name: "Artiglio", damage: "2d6+5", statKey: "str", type: "weapon", icon: "🐾", hitBonus: 3 },
      { name: "Morso",    damage: "3d6+5", statKey: "str", type: "weapon", icon: "🦷", hitBonus: 3 },
    ],
  },
  bear: {
    name: "Orso", icon: "🐻",
    hpDice: { count: 12, sides: 12 },
    actions: [
      { name: "Artiglio", damage: "2d6+5", statKey: "str", type: "weapon", icon: "🐾", hitBonus: 3 },
      { name: "Morso",    damage: "3d6+5", statKey: "str", type: "weapon", icon: "🦷", hitBonus: 3 },
    ],
  },
  spider: {
    name: "Ragno", icon: "🕷",
    hpDice: { count: 6, sides: 12 },
    actions: [
      { name: "Morso",     damage: "2d4+5", statKey: "str", type: "weapon", icon: "🦷", hitBonus: 3 },
      { name: "Veleno",    damage: "2d6+5", statKey: null,  type: "spell",  icon: "☠",  hitBonus: 0, special: "poison" },
      { name: "Ragnatela", damage: "—",     statKey: null,  type: "spell",  icon: "🕸", hitBonus: 0, special: "web"    },
    ],
  },
};

// Carica del Guerriero — aggiunto automaticamente (max 2 usi)
const CHARGE_ACTION = {
  name: "Carica", hitBonus: 3, damage: "3d8+5", statKey: "str",
  type: "skill", icon: "⚔", info: "Carica · +FOR", maxUses: 2,
};

// Colpo Mortale (Rogue) — aggiunto automaticamente (max 2 usi, solo ≤20% HP)
const DEATHBLOW_ACTION = {
  name: "Colpo Mortale", hitBonus: 3, damage: "4d6+5", statKey: "dex",
  type: "skill", icon: "💀", info: "Solo ≤20% HP · +DES", special: "deathblow", maxUses: 2,
};

const CASTER_SKILLS = [];

// ── ITEMS ─────────────────────────────────────────────────────────────────────
const ARENA_ITEMS = [
  { key: "pozione_cura",        name: "Pozione di Cura",        icon: "🧪", info: "Cura 2d12 · Passa il turno",                 damage: "2d12" },
  { key: "pozione_cura_media",  name: "Pozione di Cura Media",  icon: "💚", info: "Cura 2d8 · Passa il turno (Bottega Arena)",   damage: "2d8"  },
  { key: "bomba",               name: "Bomba",                  icon: "💣", info: "3d10 danni al bersaglio · Passa il turno",   damage: "3d10" },
  { key: "pozione_veleno",      name: "Pozione di Veleno",      icon: "☠",  info: "+1d12 danno prossimo attacco · Passa turno", damage: "1d12" },
];

const ARENA_INITIATIVE_DURATION = 30 * 60 * 1000; // 30 minuti per tirare iniziativa
const ARENA_TURN_DURATION       = 3 * 60 * 60 * 1000; // 3 ore per fare la propria azione
const ARENA_FIGHT_DURATION      = 24 * 60 * 60 * 1000; // 24 ore limite globale per fight

// Smite del Paladino — aggiunto automaticamente (max 2 usi)
const SMITE_ACTION = {
  name: "Smite Divino", hitBonus: 0, damage: "2d8", statKey: null,
  type: "skill", icon: "⚡", info: "Attacca con arma +2d8 · 2 cariche", special: "smite", maxUses: 2,
};

// ── CLASSI ───────────────────────────────────────────────────────────────────
const PHYSICAL_CLASSES = ["fighter","guerriero","warrior","rogue","ladro","paladin","paladino","ranger","cacciatore","barbarian","barbaro","monk","monaco"];
const CASTER_CLASSES   = ["wizard","mago","sorcerer","stregone","warlock","bard","bardo","cleric","chierico","druid","druido"];

function isFullCaster(cls)    { return ["wizard","mago","sorcerer","stregone","warlock"].some(c => cls.includes(c)); }
function isWizardClass(cls)   { return ["wizard","mago"].some(c => cls.includes(c)); }
function isSorcererClass(cls) { return ["sorcerer","stregone"].some(c => cls.includes(c)); }
function isWarlockClass(cls)  { return ["warlock"].some(c => cls.includes(c)); }
function isDruidClass(cls)    { return ["druid","druido"].some(c => cls.includes(c)); }
function isPaladinClass(cls)  { return ["paladin","paladino"].some(c => cls.includes(c)); }
function isClericClass(cls)   { return ["cleric","chierico"].some(c => cls.includes(c)); }
function isBardClass(cls)     { return ["bard","bardo"].some(c => cls.includes(c)); }
function isFighterClass(cls)  { return ["fighter","guerriero","warrior"].some(c => cls.includes(c)); }
function isRogueBardClass(cls){ return ["rogue","ladro","bard","bardo"].some(c => cls.includes(c)); }
function getSpellcastingAbility(cls) {
  if (["wizard","mago","artificer"].some(c => cls.includes(c))) return "int";
  if (["cleric","chierico","druid","druido","ranger","cacciatore","monk","monaco"].some(c => cls.includes(c))) return "wis";
  if (["bard","bardo","warlock","sorcerer","stregone","paladin","paladino"].some(c => cls.includes(c))) return "cha";
  return "int";
}
function isRogueClass(cls)    { return ["rogue","ladro"].some(c => cls.includes(c)); }
function isRangerClass(cls)   { return ["ranger","cacciatore"].some(c => cls.includes(c)); }

function getArmorConfig(cls) {
  if (isFullCaster(cls))    return { armorCategory: "caster",      canHaveShield: false   };
  if (isDruidClass(cls))    return { armorCategory: "druid",       canHaveShield: "wood"  }; // leggere+medie, solo scudo legno
  if (isPaladinClass(cls))  return { armorCategory: "heavy",       canHaveShield: true    };
  if (isClericClass(cls))   return { armorCategory: "heavy",       canHaveShield: true    };
  if (isFighterClass(cls))  return { armorCategory: "heavy",       canHaveShield: true    };
  if (isRogueClass(cls))    return { armorCategory: "light",       canHaveShield: false   }; // solo leggere
  if (isRogueBardClass(cls))return { armorCategory: "light",       canHaveShield: false   }; // bardo — solo leggere
  if (isRangerClass(cls))   return { armorCategory: "lightMedium", canHaveShield: true    }; // leggere+medie+scudo
  if (PHYSICAL_CLASSES.some(c => cls.includes(c))) return { armorCategory: "medium", canHaveShield: false };
  if (CASTER_CLASSES.some(c => cls.includes(c)))   return { armorCategory: "caster", canHaveShield: false };
  return { armorCategory: "medium", canHaveShield: false };
}

function getHpDice(charClass) {
  const cls = (charClass || "").toLowerCase();
  if (["fighter","guerriero","warrior","paladin","paladino"].some(c => cls.includes(c))) return { count: 11, sides: 12 };
  if (["rogue","ladro","druid","druido"].some(c => cls.includes(c)))                      return { count: 9,  sides: 12 };
  return { count: 8, sides: 12 };
}

// spellLimits: { level: maxSelectable } — lv3+ bloccati nell'arena
const SPELL_LIMITS = {
  wizard:   { 0: 2, 1: 2, 2: 2, 3: 0 },
  sorcerer: { 0: 2, 1: 2, 2: 2, 3: 0 },
  warlock:  { 0: 2, 1: 1, 2: 1, 3: 0 },
  druid:    { 0: 1, 1: 1, 2: 1, 3: 0 },
  cleric:   { 0: 1, 1: 2, 2: 1, 3: 0 },
  bard:     { 0: 1, 1: 1, 2: 2, 3: 0 },
  paladin:  { 0: 0, 1: 2, 2: 1, 3: 0 },
  ranger:   { 0: 0, 1: 2, 2: 1, 3: 0 },
  generic:  { 0: 1, 1: 1, 2: 1, 3: 0 },
};

function getLoadoutConfig(charClass) {
  const cls = (charClass || "").toLowerCase();
  const { armorCategory, canHaveShield } = getArmorConfig(cls);
  const sumLimits = (lim) => Object.values(lim).reduce((a, b) => a + b, 0);
  const isBarbarianClass = (x) => ["barbarian","barbaro"].some(k => x.includes(k));
  const isMonkClass = (x) => ["monk","monaco"].some(k => x.includes(k));

  if (isWizardClass(cls))   return { weaponOptions: WIZARD_WEAPON_OPTIONS,  spellOptions: WIZARD_SPELLS,   spellLimits: SPELL_LIMITS.wizard,   skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.wizard),   autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  if (isSorcererClass(cls)) return { weaponOptions: SIMPLE_WEAPONS,         spellOptions: SORCERER_SPELLS, spellLimits: SPELL_LIMITS.sorcerer, skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.sorcerer), autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  if (isWarlockClass(cls))  return { weaponOptions: SIMPLE_WEAPONS,         spellOptions: WARLOCK_SPELLS,  spellLimits: SPELL_LIMITS.warlock,  skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.warlock),  autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  if (isPaladinClass(cls))  return { weaponOptions: MARTIAL_WEAPONS,        spellOptions: PALADIN_SPELLS,  spellLimits: SPELL_LIMITS.paladin,  skillOptions: [], maxWeapons: 2, maxSpells: sumLimits(SPELL_LIMITS.paladin),  autoActions: [SMITE_ACTION],  hasWildShape: false, armorCategory, canHaveShield };
  if (isFighterClass(cls))  return { weaponOptions: MARTIAL_WEAPONS,        spellOptions: [],              spellLimits: {},                    skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [CHARGE_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isBarbarianClass(cls))return { weaponOptions: MARTIAL_WEAPONS,        spellOptions: [],              spellLimits: {},                    skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [],              hasWildShape: false, armorCategory, canHaveShield };
  if (isClericClass(cls))   return { weaponOptions: CLERIC_WEAPON_OPTIONS,  spellOptions: CLERIC_SPELLS,   spellLimits: SPELL_LIMITS.cleric,   skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.cleric),   autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  if (isDruidClass(cls))    return { weaponOptions: DRUID_WEAPON_OPTIONS,   spellOptions: DRUID_SPELLS,    spellLimits: SPELL_LIMITS.druid,    skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.druid),    autoActions: [], hasWildShape: true,  armorCategory, canHaveShield };
  if (isBardClass(cls))     return { weaponOptions: BARD_WEAPON_OPTIONS,    spellOptions: BARD_SPELLS,     spellLimits: SPELL_LIMITS.bard,     skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.bard),     autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  if (isMonkClass(cls))     return { weaponOptions: SIMPLE_WEAPONS,         spellOptions: [],              spellLimits: {},                    skillOptions: [], maxWeapons: 1, maxSpells: 0, autoActions: [],              hasWildShape: false, armorCategory, canHaveShield };
  if (isRogueClass(cls))    return { weaponOptions: ROGUE_WEAPON_OPTIONS,   spellOptions: [],              spellLimits: {},                    skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [DEATHBLOW_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isRangerClass(cls))   return { weaponOptions: RANGER_WEAPON_OPTIONS,  spellOptions: RANGER_SPELLS,   spellLimits: SPELL_LIMITS.ranger,   skillOptions: [], maxWeapons: 2, maxSpells: sumLimits(SPELL_LIMITS.ranger),   autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  if (PHYSICAL_CLASSES.some(k => cls.includes(k))) return { weaponOptions: MARTIAL_WEAPONS, spellOptions: [], spellLimits: {}, skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  if (CASTER_CLASSES.some(k => cls.includes(k)))   return { weaponOptions: SIMPLE_WEAPONS, spellOptions: WIZARD_SPELLS, spellLimits: SPELL_LIMITS.generic, skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.generic), autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  return { weaponOptions: MARTIAL_WEAPONS, spellOptions: [], spellLimits: {}, skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
}

// ── DAMAGE ROLLER ─────────────────────────────────────────────────────────────
function rollDamageFormula(formula) {
  return rollDmg(formula).total;
}

// Returns { total, rolls } where rolls is a display string like "(3+5)=8"
function rollDmg(formula) {
  if (!formula) return { total: 0, rolls: "0" };
  const str = String(formula).trim();
  if (!str || str === "0" || str === "—") return { total: 0, rolls: "0" };
  if (!isNaN(Number(str))) return { total: Number(str), rolls: String(str) };
  let total = 0;
  const parts = [];
  const normalized = str.replace(/-/g, "+-");
  const tokens = normalized.split("+").map(p => p.trim()).filter(p => p !== "");
  for (const token of tokens) {
    const negative = token.startsWith("-");
    const abs = negative ? token.slice(1) : token;
    if (abs.includes("d")) {
      const [numStr, sidesStr] = abs.split("d");
      const num   = parseInt(numStr)  || 1;
      const sides = parseInt(sidesStr) || 1;
      const diceRolls = [];
      let rolled = 0;
      for (let i = 0; i < num; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        diceRolls.push(r);
        rolled += r;
      }
      total += negative ? -rolled : rolled;
      const diceStr = diceRolls.length === 1
        ? `${diceRolls[0]}`
        : `(${diceRolls.join("+")}=${rolled})`;
      parts.push(negative ? `-${diceStr}` : diceStr);
    } else {
      const val = parseInt(abs) || 0;
      total += negative ? -val : val;
      if (val !== 0) parts.push(negative ? `-${val}` : `+${val}`);
    }
  }
  return { total: Math.max(0, total), rolls: parts.join(" ") };
}

// ── LOG DISPLAY ───────────────────────────────────────────────────────────────
// I log di attacco sono oggetti { pub, att, def, attId, defId }; il resto sono stringhe.
function displayLog(log, viewerUid) {
  if (!log) return '';
  if (typeof log === 'string') return log;
  if (log.attId === viewerUid) return log.att;
  if (log.defId === viewerUid) return log.def;
  return log.pub;
}
function logPubText(log) {
  if (!log) return '';
  if (typeof log === 'string') return log;
  return log.pub;
}

// ── MASTER COIN EDITOR ────────────────────────────────────────────────────────
function MasterCoinEditor() {
  const [allChars, setAllChars] = useState([]);
  const [editCoins, setEditCoins] = useState({});

  useEffect(() => {
    getDocs(collection(db, "characters")).then(snap => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setAllChars(list);
    });
    const unsub = onSnapshot(collection(db, "characters"), snap => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setAllChars(list);
    });
    return () => unsub();
  }, []);

  const handleChange = (uid, val) => setEditCoins(prev => ({ ...prev, [uid]: val }));

  const saveCoins = async (uid) => {
    const val = parseInt(editCoins[uid], 10);
    if (isNaN(val)) return;
    await updateDoc(doc(db, "characters", uid), { arenaCoins: val });
    setEditCoins(prev => { const n = { ...prev }; delete n[uid]; return n; });
  };

  if (!allChars.length) return null;

  return (
    <div className="master-coin-editor">
      <p className="col-label">🪙 Monete Arena — Tutti i Giocatori</p>
      {allChars.map(ch => (
        <div key={ch.uid} className="coin-edit-row">
          <span className="coin-edit-name">{ch.name || ch.uid}</span>
          <span className="coin-current">{ch.arenaCoins ?? 0} MA</span>
          <input
            className="coin-edit-input"
            type="number"
            min={0}
            placeholder="nuovo valore"
            value={editCoins[ch.uid] ?? ""}
            onChange={e => handleChange(ch.uid, e.target.value)}
          />
          <button className="btn-save-coins" onClick={() => saveCoins(ch.uid)}>Salva</button>
        </div>
      ))}
    </div>
  );
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
  const [pendingShield, setPendingShield]   = useState(null); // null | "legno" | "metallo"
  const [showWildPicker, setShowWildPicker] = useState(false);
  const [pendingItemCounts, setPendingItemCounts] = useState({ pozione_cura: 0, bomba: 0, pozione_veleno: 0 });

  const [arenaInfoOpen, setArenaInfoOpen] = useState(false);

  // Tick ogni secondo per aggiornare i timer in-render
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Master join setup
  const [masterJoinSetup, setMasterJoinSetup] = useState(false);
  const [masterJoinName, setMasterJoinName]   = useState("");
  const [masterJoinClass, setMasterJoinClass] = useState("");
  const [equipSelections, setEquipSelections] = useState({});

  const isMaster = currentUser?.email === "santomassimo85@gmail.com";

  // ── Monete Arena ──────────────────────────────────────────────────────────
  const awardArenaCoins = async (uid, amount) => {
    try {
      await updateDoc(doc(db, "characters", uid), { arenaCoins: increment(amount) });
    } catch { /* NPC o doc mancante: ignora */ }
  };

  const awardRoundCoins = async (updatedMatches) => {
    for (const m of updatedMatches) {
      const prev = arenaMeta?.matches?.find(x => x.matchId === m.matchId);
      if (m.status === "finished" && prev?.status !== "finished" && m.winner) {
        await awardArenaCoins(m.winner, 1);
      }
    }
  };

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
        con:   d.stats?.con  ?? 0,
        int:   d.stats?.int  ?? 0,
        wis:   d.stats?.wis  ?? 0,
        cha:   d.stats?.cha  ?? 0,
      },
      arenaBuffs: d.arenaBuffs || {},
      rolledHp: null,
      hpRerollCount: 0,
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
    setCharPreview(prev => ({ ...prev, rolledHp: total, hpRerollCount: (prev.hpRerollCount || 0) + 1 }));
  };

  // ── STEP 3: conferma iscrizione ───────────────────────────────────────────
  const confirmJoin = async () => {
    const config = getLoadoutConfig(charPreview.class);
    if (pendingWeapons.length < config.maxWeapons) return;
    if (pendingSpells.length  < config.maxSpells)  return;
    if (!charPreview.rolledHp) return;
    if (!pendingArmor) return;
    const totalItemsJoin = Object.values(pendingItemCounts).reduce((a, b) => a + b, 0);
    if (totalItemsJoin < 1) return;

    // Calcolo CA finale: base + DES (cappato) + scudo
    const dexMod    = charPreview.stats.dex ?? 0;
    const dexBonus  = Math.max(0, Math.min(dexMod, pendingArmor.maxDex));
    const shieldBonus = pendingShield ? 2 : 0;
    const armorBuffBonus = charPreview.arenaBuffs?.armorBonus ? 1 : 0;
    const finalAc   = pendingArmor.baseAc + dexBonus + shieldBonus + armorBuffBonus;

    const finalActions = [...pendingWeapons, ...pendingSpells, ...pendingSkills, ...config.autoActions];
    const selectedItemKeys = Object.entries(pendingItemCounts).flatMap(([k, n]) => Array(n).fill(k));
    const snapshot = {
      name:            charPreview.name,
      image:           charPreview.image,
      class:           charPreview.class,
      stats:           { ...charPreview.stats, maxHp: charPreview.rolledHp, ac: finalAc },
      selectedActions: finalActions,
      hasWildShape:    config.hasWildShape,
      hasShield:       pendingShield,
      selectedArmor:   pendingArmor,
      selectedItemKeys,
      arenaBuffs:      charPreview.arenaBuffs || {},
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
    setPendingShield(null);
    setPendingItemCounts({ pozione_cura: 0, bomba: 0, pozione_veleno: 0 });
  };

  const toggleWeapon = (item, maxWeapons) => {
    setPendingWeapons(prev => {
      const already = prev.find(a => a.name === item.name);
      if (already) return prev.filter(a => a.name !== item.name);
      if (prev.length >= maxWeapons) return maxWeapons === 1 ? [item] : prev;
      return [...prev, item];
    });
  };

  const toggleSpell = (item, spellLimits) => {
    const lvl = item.level ?? 0;
    if (lvl >= 3) return; // lv3+ non disponibili in arena
    setPendingSpells(prev => {
      const already = prev.find(a => a.name === item.name);
      if (already) return prev.filter(a => a.name !== item.name);
      const countAtLevel = prev.filter(a => (a.level ?? 0) === lvl).length;
      const limit = spellLimits?.[lvl] ?? 0;
      if (countAtLevel >= limit) return prev;
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

  // ── MASTER join helpers ────────────────────────────────────────────────────
  const MASTER_JOIN_CLASSES = ["Fighter","Barbarian","Paladin","Ranger","Monk","Rogue","Wizard","Sorcerer","Warlock","Druid","Cleric","Bard"];

  const getMasterDefaultStats = (cls) => {
    if (["Fighter","Barbarian","Paladin"].includes(cls))
      return { maxHp: 85, ac: 16, str: 4, dex: 2, con: 3, int: 0, wis: 1, cha: 1 };
    if (["Ranger","Monk"].includes(cls))
      return { maxHp: 75, ac: 15, str: 2, dex: 4, con: 2, int: 0, wis: 2, cha: 0 };
    if (["Rogue"].includes(cls))
      return { maxHp: 70, ac: 15, str: 1, dex: 5, con: 2, int: 1, wis: 1, cha: 2 };
    if (["Wizard"].includes(cls))
      return { maxHp: 60, ac: 13, str: 0, dex: 2, con: 1, int: 5, wis: 1, cha: 0 };
    if (["Sorcerer","Bard","Warlock"].includes(cls))
      return { maxHp: 62, ac: 13, str: 0, dex: 2, con: 1, int: 1, wis: 1, cha: 5 };
    if (["Druid","Cleric"].includes(cls))
      return { maxHp: 70, ac: 14, str: 1, dex: 2, con: 2, int: 0, wis: 5, cha: 1 };
    return { maxHp: 70, ac: 14, str: 2, dex: 2, con: 2, int: 2, wis: 2, cha: 2 };
  };

  const startMasterLoadout = () => {
    if (!masterJoinName.trim() || !masterJoinClass) return;
    const stats = getMasterDefaultStats(masterJoinClass);
    setCharPreview({
      name:     masterJoinName.trim(),
      image:    null,
      class:    masterJoinClass,
      stats,
      rolledHp: null,
      hpRerollCount: 0,
    });
    setPendingWeapons([]);
    setPendingSpells([]);
    setPendingSkills([]);
    setPendingArmor(null);
    setPendingShield(null);
    setMasterJoinSetup(false);
    setLoadoutPhase("rolling");
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
    await awardArenaCoins(uid, 1); // 1 moneta per partecipazione
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
          const startHp = snap.stats?.maxHp ?? 70;
          const itemUses = {};
          (snap.selectedItemKeys || []).forEach(k => { itemUses[k] = (itemUses[k] || 0) + 1; });
          const shopPotions = snap.arenaBuffs?.healingPotions ?? 0;
          if (shopPotions > 0) itemUses["pozione_cura_media"] = shopPotions;
          return { id, name: snap.name || "Sconosciuto", hp: startHp, maxHp: startHp, init: 0, itemUsesLeft: itemUses };
        }),
        status: "initiative", turn: null, turnExpiry: new Date(Date.now() + ARENA_INITIATIVE_DURATION).toISOString(),
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
    await awardArenaCoins(winnerId, 5); // 5 monete per vittoria torneo
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
        status:     allRolled ? "active" : "initiative",
        turn:       allRolled ? sorted[0].id : null,
        turnExpiry: allRolled ? new Date(Date.now() + ARENA_TURN_DURATION).toISOString() : (m.turnExpiry || new Date(Date.now() + ARENA_INITIATIVE_DURATION).toISOString()),
        fightStartAt: allRolled ? new Date().toISOString() : (m.fightStartAt || null),
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

    // Penalità ai tiri per colpire basata sull'armatura dell'attaccante
    const armorPenalty = attackerSnap?.selectedArmor?.hitPenalty ?? 0;

    // ── Smite Divino (attacca con arma equipaggiata + 2d8 bonus) ────────
    if (action.special === "smite") {
      const mySnap = attackerSnap;
      const myName = attName;
      const myMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
      const equippedNames = myMatchPlayer?.equippedWeaponNames || [];
      const allWeapons = (mySnap?.selectedActions || []).filter(a => a.type === "weapon");
      const weaponAction = allWeapons.find(a => equippedNames.includes(a.name)) || allWeapons[0];
      if (!weaponAction) return;

      const defMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === targetId);
      const shieldSkillBonusDef = (defMatchPlayer?.shieldSkillTurns ?? 0) > 0 ? 3 : 0;
      const targetAc = (defenderSnap?.stats?.ac ?? 10) + shieldSkillBonusDef + (defMatchPlayer?.defensiveBonus ?? 0);
      const d20 = Math.floor(Math.random() * 20) + 1;
      const totalHit = d20 + (weaponAction.hitBonus || 0) + armorPenalty;
      const isHit = totalHit >= targetAc;
      const isCrit = d20 === 20;
      const critMult = isCrit ? 2 : 1;

      const { total: wDmg, rolls: wRolls } = isHit ? rollDmg(weaponAction.damage) : { total: 0, rolls: "" };
      const { total: sDmg, rolls: sRolls } = isHit ? rollDmg("2d8") : { total: 0, rolls: "" };
      const totalDmg = (wDmg + sDmg) * critMult;

      const smiteExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      const hitStr = isHit ? `COLPISCE` : `MANCA`;
      const hitInfo = `d20(${d20})+${weaponAction.hitBonus}+arm(${armorPenalty})=${totalHit} vs CA ${targetAc}`;
      const log = {
        pub: `⚡ ${myName} → Smite Divino su ${defName}: ${hitStr}${isHit ? ` per ${totalDmg} danni${isCrit ? " CRITICO!" : ""}` : ""}`,
        att: `⚡ Smite Divino su ${defName}: ${hitStr} [${hitInfo}]${isHit ? ` → arma🎲${wRolls}+smite🎲${sRolls}=${totalDmg}${isCrit ? " CRITICO!" : ""}` : ""}`,
        def: `⚡ ${myName} ti colpisce con Smite Divino: ${hitStr}${isHit ? ` per ${totalDmg} danni${isCrit ? " CRITICO!" : ""}` : ""}`,
        ts: new Date().toISOString(),
        attId: currentUser.uid, defId: targetId,
      };
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const players = m.players.map(p => {
          if (p.id === targetId && isHit) return { ...p, hp: Math.max(0, (p.hp ?? 0) - totalDmg) };
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 1)) - 1) };
            return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), defensiveBonus: 0, actionUsesLeft: newUses };
          }
          return p;
        });
        return { ...m, players, turn: advanceTurn(players, m), turnExpiry: smiteExpiry, logs: [...m.logs, log] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return;
    }

    // ── Ragnatela (DEX save, no damage) ──────────────────────────────
    if (action.special === "web") {
      const penStr = armorPenalty < 0 ? ` ${armorPenalty} arm.` : '';
      const log = {
        pub: `🕸 ${attName} lancia Ragnatela su ${defName} — TS DES richiesto (CD 15)`,
        att: `🕸 Lanci Ragnatela su ${defName}${penStr ? ` [penalità armatura: ${armorPenalty}]` : ''} — TS DES richiesto (CD 15)`,
        def: `🕸 ${attName} ti lancia una Ragnatela! Devi superare un TS DES (CD 15)`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };
      const webExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id === targetId) return { ...p, pendingDexSave: true };
          if (p.id === currentUser.uid) return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), defensiveBonus: 0 };
          return p;
        });
        return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: webExpiry, logs: [...m.logs, log] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return;
    }

    // ── Veleno (damage + CON save) ────────────────────────────────────
    if (action.special === "poison") {
      const { total: damage, rolls: poisonDiceRolls } = rollDmg(action.damage);
      const dmgNote = ` [🎲${poisonDiceRolls}=${damage}]`;
      const log = {
        pub: `☠ ${attName} usa Veleno su ${defName}${dmgNote} — ${damage} danni + TS COS (CD 15)`,
        att: `☠ Usi Veleno su ${defName}${dmgNote} — ${damage} danni + TS COS (CD 15)`,
        def: `☠ ${attName} ti ha colpito con Veleno${dmgNote} — ${damage} danni! Devi superare un TS COS (CD 15)`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };
      const poisonExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      let updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - damage), pendingConSave: true };
          if (p.id === currentUser.uid) return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), defensiveBonus: 0 };
          return p;
        });
        const alive = updatedPlayers.filter(p => p.hp > 0);
        if (alive.length === 1) {
          return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
            logs: [...m.logs, log, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
        }
        return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: poisonExpiry, logs: [...m.logs, log] };
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
    const attackerClassLower = (arenaMeta.characterSnapshots?.[currentUser.uid]?.class || "").toLowerCase();
    const isSpellAction = action.type === "spell";
    const spellcastKey  = isSpellAction ? getSpellcastingAbility(attackerClassLower) : null;
    const statMod  = action.statKey
      ? (attackerSnap?.stats?.[action.statKey] ?? 0)
      : isSpellAction
      ? (attackerSnap?.stats?.[spellcastKey] ?? 0)
      : 0;
    const weaponBuff = !isSpellAction && (attackerSnap?.arenaBuffs?.weaponBonus ? 1 : 0);
    const d20      = Math.floor(Math.random() * 20) + 1;
    const hitTotal = d20 + (action.hitBonus || 0) + statMod + armorPenalty + weaponBuff;
    const defMatchPlayer   = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === targetId);
    const shieldLost       = defenderSnap?.hasShield && defMatchPlayer?.shieldSuppressed;
    const shieldSkillBonus = (defMatchPlayer?.shieldSkillTurns ?? 0) > 0 ? 3 : 0;
    const defensiveAcBonus = defMatchPlayer?.defensiveBonus ?? 0;
    const defAC    = (defenderSnap?.stats?.ac ?? 10) - (shieldLost ? 2 : 0) + shieldSkillBonus + defensiveAcBonus;
    const isCrit   = d20 === 20 && action.type === "spell";
    const isHit    = hitTotal >= defAC;
    const { total: baseDmg, rolls: diceRolls } = isHit ? rollDmg(action.damage) : { total: 0, rolls: "0" };
    // Critico spells: doppio danno
    const critMult = isCrit ? 2 : 1;
    // Rogue sneak attack — sempre +1d6 se colpisce
    const isRogue   = attackerClassLower.includes("rogue") || attackerClassLower.includes("ladro");
    const { total: sneakDmg, rolls: sneakRolls } = isHit && isRogue ? rollDmg("1d6") : { total: 0, rolls: "" };
    // Weapon poison bonus
    const attackerMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
    const weaponPoisoned = !!attackerMatchPlayer?.weaponPoisoned;
    const { total: poisonBonusDmg, rolls: poisonRolls } = isHit && weaponPoisoned ? rollDmg("1d12") : { total: 0, rolls: "" };
    // Le armi aggiungono statMod al danno; le spell no (statMod è già usato per colpire)
    const dmgStatMod = isSpellAction ? 0 : statMod;
    const damage   = isHit ? (baseDmg + dmgStatMod + weaponBuff) * critMult + sneakDmg + poisonBonusDmg : 0;

    // Log breakdown
    const statPart    = !isSpellAction && action.statKey && statMod !== 0 ? ` +${statMod} ${action.statKey.toUpperCase()}` : '';
    const spellModPart = isSpellAction && statMod !== 0 ? ` +${statMod} ${spellcastKey?.toUpperCase()}` : '';
    const penPart     = armorPenalty < 0 ? ` ${armorPenalty} arm.` : '';
    const critTag     = isCrit ? " ★CRITICO★" : "";
    const sneakTag    = sneakDmg > 0 ? ` | furtivo 🎲${sneakRolls}=${sneakDmg}` : "";
    const poisonTag   = poisonBonusDmg > 0 ? ` | veleno 🎲${poisonRolls}=${poisonBonusDmg}` : "";
    const critDmgNote = isCrit ? ` ×2` : "";
    const dmgBreakdown = isHit
      ? ` [danni: 🎲${diceRolls}${statPart}${critDmgNote}=${baseDmg * critMult + dmgStatMod * critMult}${sneakTag}${poisonTag} = ${damage}]`
      : "";
    const hitBreakdown = `🎲d20=${d20}${critTag} +${action.hitBonus} hit${statPart}${spellModPart}${penPart} = ${hitTotal} vs CA ${defAC}`;
    const log = {
      pub: isHit
        ? `💥 ${attName} colpisce ${defName} con ${action.name}${critTag} (${hitTotal} vs CA ${defAC})${dmgBreakdown} — ${damage} danni`
        : `🛡️ ${attName} manca ${defName} con ${action.name} (${hitTotal} vs CA ${defAC})`,
      att: isHit
        ? `💥 Colpisci ${defName} con ${action.name} [${hitBreakdown}]${dmgBreakdown} — ${damage} danni`
        : `🛡️ Manchi ${defName} con ${action.name} [${hitBreakdown}]`,
      def: isHit
        ? `⚔️ ${attName} ti ha colpito con ${action.name}${critTag}${dmgBreakdown} — ${damage} danni`
        : `🛡️ ${attName} ti ha mancato con ${action.name}`,
      attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
    };

    const newTurnExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    let updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - damage) };
        if (p.id === currentUser.uid) {
          const up = { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), defensiveBonus: 0, weaponPoisoned: false };
          if (action.maxUses !== undefined) {
            const prev = p.actionUsesLeft ?? {};
            up.actionUsesLeft = { ...prev, [action.name]: Math.max(0, (prev[action.name] ?? action.maxUses) - 1) };
          }
          return up;
        }
        return p;
      });
      const alive = updatedPlayers.filter(p => p.hp > 0);
      if (alive.length === 1) {
        return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
          logs: [...m.logs, log, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      }
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: newTurnExpiry, logs: [...m.logs, log] };
    });

    await awardRoundCoins(updatedMatches);
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
    const log = `🛡 ${myName} lancia Scudo! (+3 CA per 3 turni)`;
    const shieldExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, shieldSkillTurns: 3, defensiveBonus: 0 } : p
      );
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: shieldExpiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── WILD SHAPE ─────────────────────────────────────────────────────────────
  const handleWildShape = async (matchId, formKey) => {
    const myMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
    const wsUsesLeft = myMatchPlayer?.wildShapeUsesLeft ?? 2;
    if (wsUsesLeft <= 0) return;
    const form = WILD_SHAPES[formKey];
    const { count, sides } = form.hpDice;
    let newHp = 0;
    for (let i = 0; i < count; i++) newHp += Math.floor(Math.random() * sides) + 1;
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Druido";
    const newUsesLeft = wsUsesLeft - 1;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const preHp = m.players.find(p => p.id === currentUser.uid)?.hp ?? 0;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, hp: newHp, wildShape: formKey, preWildShapeHp: preHp, wildShapeUsesLeft: newUsesLeft } : p
      );
      return { ...m, players: updatedPlayers,
        logs: [...m.logs, `🐾 ${myName} si trasforma in ${form.icon} ${form.name}! (${newHp} HP) [Usi rimasti: ${newUsesLeft}/2]`] };
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

  // ── CURE ──────────────────────────────────────────────────────────────────
  const handleHealSpell = async (matchId, action) => {
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const myName = mySnap?.name || "?";
    const { total: healAmt, rolls: healRolls } = rollDmg(action.damage);
    const healExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    await runTransaction(db, async (tx) => {
      const ref  = doc(db, "arena_meta", "global");
      const snap = await tx.get(ref);
      const data = snap.data();
      const matches = (data.matches || []).map(m => {
        if (m.matchId !== matchId) return m;
        const players = m.players.map(p => {
          if (p.id !== currentUser.uid) return p;
          const maxHp  = p.maxHp || p.hp;
          const newHp  = Math.min(maxHp, (p.hp || 0) + healAmt);
          const uses   = (p.actionUsesLeft || {});
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 1)) - 1) };
          return { ...p, hp: newHp, actionUsesLeft: newUses };
        });
        const nextIndex = (m.players.findIndex(p => p.id === m.turn) + 1) % m.players.length;
        const log = `${myName} lancia ${action.icon} ${action.name} → cura sé stesso di ${healAmt} HP 🎲(${healRolls})`;
        return { ...m, players, turn: m.players[nextIndex].id, turnExpiry: healExpiry, logs: [...m.logs, log] };
      });
      tx.update(ref, { matches });
    });
  };

  // ── CONTROLLO ─────────────────────────────────────────────────────────────
  const handleControlSpell = async (matchId, targetId, action) => {
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const myName = mySnap?.name || "?";
    const ctrlExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    await runTransaction(db, async (tx) => {
      const ref  = doc(db, "arena_meta", "global");
      const snap = await tx.get(ref);
      const data = snap.data();
      const matches = (data.matches || []).map(m => {
        if (m.matchId !== matchId) return m;
        const targetSnap = arenaMeta.characterSnapshots?.[targetId];
        const targetName = targetSnap?.name || "?";
        const players = m.players.map(p => {
          if (p.id === currentUser.uid) {
            const uses    = (p.actionUsesLeft || {});
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 1)) - 1) };
            return { ...p, actionUsesLeft: newUses };
          }
          if (p.id === targetId) return { ...p, pendingControlSave: true };
          return p;
        });
        const nextIndex = (m.players.findIndex(p => p.id === m.turn) + 1) % m.players.length;
        const log = `${myName} lancia ${action.icon} ${action.name} su ${targetName} → tiro salvezza richiesto!`;
        return { ...m, players, turn: m.players[nextIndex].id, turnExpiry: ctrlExpiry, logs: [...m.logs, log] };
      });
      tx.update(ref, { matches });
    });
  };

  // ── TIRI SALVEZZA ──────────────────────────────────────────────────────────
  const rollSavingThrow = async (matchId, saveType, context) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const d20 = Math.floor(Math.random() * 20) + 1;
    const isControl = context === "control_spell";
    const mod = isControl ? 3 : (mySnap?.stats?.[saveType] ?? 0);
    const dc = isControl ? 13 : 15;
    const total = d20 + mod;
    const pass = total >= dc;
    const labels = { str: "FOR", dex: "DES", con: "COS" };
    const myName = mySnap?.name || "?";
    let logMsg = isControl
      ? `🌀 ${myName} — TS Controllo: ${d20}+3=${total} (CD ${dc}) → ${pass ? "✅ PASSA" : "❌ FALLISCE"}`
      : `🎲 ${myName} — TS ${labels[saveType] || saveType.toUpperCase()}: ${d20}+${mod}=${total} (CD ${dc}) → ${pass ? "✅ PASSA" : "❌ FALLISCE"}`;

    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      let extraTurn = {};

      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const up = { ...p };
        if (context === "con_poison") {
          delete up.pendingConSave;
          if (!pass) {
            const { total: poisonDmg, rolls: pRolls } = rollDmg("2d6");
            up.hp = Math.max(0, (up.hp ?? 0) - poisonDmg);
            logMsg += ` — Avvelenato! Subisce ${poisonDmg} danni da veleno [🎲${pRolls}].`;
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
          const currentIndex = m.players.findIndex(pl => pl.id === currentUser.uid);
          let nextIndex = (currentIndex + 1) % m.players.length;
          while (m.players[nextIndex]?.hp <= 0) nextIndex = (nextIndex + 1) % m.players.length;
          extraTurn = { turn: m.players[nextIndex].id, turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString() };
        }
        if (context === "control_spell") {
          delete up.pendingControlSave;
          if (!pass) {
            logMsg += " — Fallisce! Il turno è perso!";
            const currentIndex = m.players.findIndex(pl => pl.id === currentUser.uid);
            let nextIndex = (currentIndex + 1) % m.players.length;
            while (m.players[nextIndex]?.hp <= 0) nextIndex = (nextIndex + 1) % m.players.length;
            extraTurn = { turn: m.players[nextIndex].id, turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString() };
          } else {
            logMsg += " — Passa! Può agire normalmente.";
          }
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
      return { ...m, players: updatedPlayers, turn: updatedPlayers[nextIndex].id, turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── ITEMS ──────────────────────────────────────────────────────────────────
  const useItem = async (matchId, itemKey, targetId) => {
    const myName  = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const item    = ARENA_ITEMS.find(i => i.key === itemKey);
    if (!item) return;
    const expiry  = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();

    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;

      // Decrement item use
      const myP = m.players.find(p => p.id === currentUser.uid);
      const curUses = myP?.itemUsesLeft?.[itemKey] ?? 0;
      if (curUses <= 0) return m;

      const _itemTs = new Date().toISOString();
      let log = null;
      const updatedPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const newUses = { ...(p.itemUsesLeft || {}), [itemKey]: Math.max(0, curUses - 1) };
          if (itemKey === "pozione_cura") {
            const { total: heal, rolls: healRolls } = rollDmg("2d12");
            const maxHp = (arenaMeta.characterSnapshots?.[currentUser.uid]?.stats?.maxHp) ?? p.maxHp ?? 70;
            const newHp = Math.min(maxHp, (p.hp || 0) + heal);
            log = { pub: `🧪 ${myName} usa Pozione di Cura [🎲${healRolls}=${heal}] — recupera ${heal} HP (${newHp} HP)`, ts: _itemTs };
            return { ...p, hp: newHp, itemUsesLeft: newUses };
          }
          if (itemKey === "pozione_veleno") {
            log = { pub: `☠ ${myName} avvelena la propria arma — prossimo attacco +1d12`, ts: _itemTs };
            return { ...p, weaponPoisoned: true, itemUsesLeft: newUses };
          }
          return { ...p, itemUsesLeft: newUses };
        }
        if (itemKey === "bomba" && p.id === targetId) {
          const { total: dmg, rolls: bombRolls } = rollDmg("3d10");
          log = { pub: `💣 ${myName} lancia una Bomba su ${p.name} [🎲${bombRolls}=${dmg}] — ${dmg} danni!`, ts: _itemTs };
          return { ...p, hp: Math.max(0, p.hp - dmg) };
        }
        return p;
      });

      const alive = updatedPlayers.filter(p => p.hp > 0);
      if (alive.length === 1) {
        return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
          logs: [...m.logs, ...(log ? [log] : []), `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      }
      // Advance turn
      const currentIdx = m.players.findIndex(p => p.id === currentUser.uid);
      let nextIdx = (currentIdx + 1) % m.players.length;
      while (updatedPlayers[nextIdx]?.hp <= 0) nextIdx = (nextIdx + 1) % m.players.length;
      return { ...m, players: updatedPlayers, turn: updatedPlayers[nextIdx].id, turnExpiry: expiry, logs: [...m.logs, ...(log ? [log] : [])] };
    });

    // Check tournament end
    await awardRoundCoins(updatedMatches);
    const allDone = updatedMatches.every(m => m.status === "finished");
    const winners = updatedMatches.filter(m => m.winner).map(m => m.winner);
    if (allDone && winners.length === 1) {
      const champSnap = (arenaMeta.characterSnapshots || {})[winners[0]] || {};
      await sendChampionNotification(winners[0], champSnap.name || "Campione", arenaMeta?.prizes || "");
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches, tournamentWinner: winners[0], phase: "finished" });
      return;
    }
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── AUTO-PASS / AUTO-INIT (timer scaduto) ──────────────────────────────────
  const lastAutoPassFireRef = useRef(0);

  const handleArenaAutoPass = useCallback(async () => {
    if (!arenaMeta?.matches) return;
    const now = Date.now();

    const expiredInitMatch = arenaMeta.matches.find(m => {
      if (m.status !== "initiative" || !m.turnExpiry) return false;
      return now >= new Date(m.turnExpiry).getTime();
    });
    const expiredActiveMatch = arenaMeta.matches.find(m => {
      if (m.status !== "active" || !m.turn || !m.turnExpiry) return false;
      return now >= new Date(m.turnExpiry).getTime();
    });
    const expiredFightMatch = arenaMeta.matches.find(m => {
      if (m.status !== "active" || !m.fightStartAt) return false;
      return now >= new Date(m.fightStartAt).getTime() + ARENA_FIGHT_DURATION;
    });
    if (!expiredInitMatch && !expiredActiveMatch && !expiredFightMatch) return;

    try {
      const metaRef = doc(db, "arena_meta", "global");
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(metaRef);
        if (!snap.exists()) return;
        const data = snap.data();

        // ── Iniziativa scaduta → auto-tiro ──────────────────────────────────
        if (expiredInitMatch) {
          const match = data.matches?.find(m => m.matchId === expiredInitMatch.matchId);
          if (!match || match.status !== "initiative" || !match.turnExpiry) return;
          if (Date.now() < new Date(match.turnExpiry).getTime()) return;
          const snapshots = data.characterSnapshots || {};
          const newLogs = [...match.logs];
          const updatedPlayers = match.players.map(p => {
            if (p.init > 0) return p;
            const dex = snapshots[p.id]?.stats?.dex ?? 0;
            const roll = Math.floor(Math.random() * 20) + 1 + dex;
            newLogs.push(`🎲 ${snapshots[p.id]?.name || p.name} tira iniziativa (automatico): ${roll}`);
            return { ...p, init: roll };
          });
          const allRolled = updatedPlayers.every(p => p.init > 0);
          const sorted = [...updatedPlayers].sort((a, b) => b.init - a.init);
          const updatedMatch = {
            ...match, players: updatedPlayers,
            status: allRolled ? "active" : "initiative",
            turn: allRolled ? sorted[0].id : null,
            turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString(),
            fightStartAt: allRolled ? new Date().toISOString() : (match.fightStartAt || null),
            logs: newLogs,
          };
          const updatedMatches = data.matches.map(m => m.matchId === match.matchId ? updatedMatch : m);
          transaction.update(metaRef, { matches: updatedMatches });
          return;
        }

        // ── Fight scaduto (24h) → vince chi ha più HP ────────────────────────
        if (expiredFightMatch) {
          const match = data.matches?.find(m => m.matchId === expiredFightMatch.matchId);
          if (match && match.status === "active" && match.fightStartAt &&
              Date.now() >= new Date(match.fightStartAt).getTime() + ARENA_FIGHT_DURATION) {
            const alivePlayers = match.players.filter(p => p.hp > 0);
            const winner = alivePlayers.reduce((best, p) => (!best || p.hp > best.hp ? p : best), null);
            if (winner) {
              const updatedMatch = {
                ...match,
                status: "finished",
                winner: winner.id,
                logs: [...match.logs, `⏰ Tempo scaduto! Vince ${winner.name.toUpperCase()} con ${winner.hp} HP rimanenti!`],
              };
              const updatedMatches = data.matches.map(m => m.matchId === match.matchId ? updatedMatch : m);
              const allDone2 = updatedMatches.every(m => m.status === "finished");
              const winners2 = updatedMatches.filter(m => m.winner).map(m => m.winner);
              if (allDone2 && winners2.length === 1) {
                const champSnap2 = (data.characterSnapshots || {})[winners2[0]] || {};
                transaction.update(metaRef, { matches: updatedMatches, tournamentWinner: winners2[0], phase: "finished" });
                await addDoc(collection(db, "notifications"), {
                  userId: winners2[0],
                  title: "🏆 Campione dell'Arena!",
                  message: `${champSnap2.name || "Campione"}, hai trionfato nell'Arena dei Campioni per supremazia di HP!`,
                  read: false, timestamp: serverTimestamp(),
                });
              } else {
                transaction.update(metaRef, { matches: updatedMatches });
              }
              return;
            }
          }
        }

        // ── Turno attivo scaduto → posizione difensiva ───────────────────────
        const match = data.matches?.find(m => m.matchId === expiredActiveMatch.matchId);
        if (!match || match.status !== "active" || !match.turn || !match.turnExpiry) return;
        if (Date.now() < new Date(match.turnExpiry).getTime()) return;
        if (match.lastAutoPassAt && Date.now() - new Date(match.lastAutoPassAt).getTime() < 10000) return;

        const currentTurnId = match.turn;
        const currentPlayerObj = match.players.find(p => p.id === currentTurnId);
        if (!currentPlayerObj) return;
        const alivePlayers = match.players.filter(p => p.hp > 0);
        const currentIdx = alivePlayers.findIndex(p => p.id === currentTurnId);
        const nextIdx = (currentIdx + 1) % alivePlayers.length;
        const nextTurnId = alivePlayers[nextIdx]?.id || null;

        const newLogs2 = [...match.logs];
        // Auto-roll any pending saving throws for the current player
        const hasPendingDex = currentPlayerObj.pendingDexSave;
        const hasPendingCon = currentPlayerObj.pendingConSave;
        const hasPendingCtrl = currentPlayerObj.pendingControlSave;
        let autoRolledSave = false;

        const updatedPlayers = match.players.map(p => {
          if (p.id !== currentTurnId) return p;
          let up = { ...p, defensiveBonus: 1 };
          if (hasPendingDex) {
            const d20 = Math.floor(Math.random() * 20) + 1;
            const mod = data.characterSnapshots?.[p.id]?.stats?.dex ?? 0;
            const total = d20 + mod;
            const pass = total >= 15;
            newLogs2.push(`🎲 ${p.name} TS DES automatico: ${d20}+${mod}=${total} vs CD 15 → ${pass ? "✅ PASSA" : "❌ FALLISCE — Intrappolato!"}`);
            delete up.pendingDexSave;
            if (!pass) up.entangled = true;
            autoRolledSave = true;
          }
          if (hasPendingCon) {
            const d20 = Math.floor(Math.random() * 20) + 1;
            const mod = data.characterSnapshots?.[p.id]?.stats?.con ?? 0;
            const total = d20 + mod;
            const pass = total >= 15;
            if (!pass) { up.hp = Math.max(0, (up.hp ?? 0) - (Math.floor(Math.random()*6)+1 + Math.floor(Math.random()*6)+1)); }
            newLogs2.push(`🎲 ${p.name} TS COS automatico: ${d20}+${mod}=${total} vs CD 15 → ${pass ? "✅ PASSA" : "❌ FALLISCE — Avvelenato!"}`);
            delete up.pendingConSave;
            autoRolledSave = true;
          }
          if (hasPendingCtrl) {
            const d20 = Math.floor(Math.random() * 20) + 1;
            const total = d20 + 3;
            const pass = total >= 13;
            newLogs2.push(`🌀 ${p.name} TS Controllo automatico: ${d20}+3=${total} vs CD 13 → ${pass ? "✅ PASSA" : "❌ FALLISCE — Turno perso!"}`);
            delete up.pendingControlSave;
            autoRolledSave = true;
          }
          return up;
        });
        if (!autoRolledSave) newLogs2.push(`🛡 ${currentPlayerObj.name} non ha agito — Posizione Difensiva (+1 CA)`);
        const newExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
        const updatedMatch = {
          ...match, players: updatedPlayers, turn: nextTurnId,
          turnExpiry: newExpiry, lastAutoPassAt: new Date().toISOString(),
          logs: newLogs2,
        };
        const updatedMatches = data.matches.map(m => m.matchId === expiredActiveMatch.matchId ? updatedMatch : m);
        transaction.update(metaRef, { matches: updatedMatches });
      });
    } catch (e) {
      console.error("Errore auto-pass arena:", e);
    }
  }, [arenaMeta]);

  useEffect(() => {
    if (!arenaMeta || arenaMeta.phase !== "combat") return;
    const interval = setInterval(() => {
      const now = Date.now();
      const hasExpiredInit = arenaMeta.matches?.some(m => {
        if (m.status !== "initiative" || !m.turnExpiry) return false;
        return now >= new Date(m.turnExpiry).getTime();
      });
      const hasExpiredActive = arenaMeta.matches?.some(m => {
        if (m.status !== "active" || !m.turn || !m.turnExpiry) return false;
        return now >= new Date(m.turnExpiry).getTime();
      });
      const hasExpiredFight = arenaMeta.matches?.some(m => {
        if (m.status !== "active" || !m.fightStartAt) return false;
        return now >= new Date(m.fightStartAt).getTime() + ARENA_FIGHT_DURATION;
      });
      if ((hasExpiredInit || hasExpiredActive || hasExpiredFight) && now - lastAutoPassFireRef.current > 10000) {
        lastAutoPassFireRef.current = now;
        handleArenaAutoPass();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [arenaMeta, handleArenaAutoPass]);

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

      {/* ── SEZIONE SPIEGAZIONE ── */}
      <div className="arena-info-section">
        <button className="arena-info-toggle" onClick={() => setArenaInfoOpen(v => !v)}>
          {arenaInfoOpen ? "▲" : "▼"} Come funziona l'Arena
        </button>
        {arenaInfoOpen && (
          <div className="arena-info-body">
            <h3 className="arena-info-title">⚔ Regole dell'Arena</h3>
            <ul className="arena-info-list">
              <li>Il Master apre le iscrizioni e approva i partecipanti.</li>
              <li>Ogni partecipante sceglie arma, armatura e fino a 2 incantesimi (max livello 2).</li>
              <li>I fight si svolgono con un timer di 24 ore: allo scadere vince chi ha più HP.</li>
              <li>Ogni round il vincitore del match avanza al turno successivo.</li>
              <li>Il campione dell'Arena è l'ultimo rimasto.</li>
            </ul>
            <h3 className="arena-info-title">🎲 Esempio di Turno</h3>
            <div className="arena-info-example">
              <p><strong>Attacco con arma:</strong> d20 + 3 (competenza) + FOR/DES → se supera la CA avversaria, tiro danno dell'arma + FOR/DES.</p>
              <p><strong>Attacco con incantesimo:</strong> d20 + 3 (competenza) + INT/SAG/CAR (in base alla classe) → se colpisce, tiro danno dell'incantesimo (senza modificatore di caratteristica).</p>
              <p><strong>Esempio:</strong> Guerriero (FOR +3) attacca con Spada Lunga (1d8). Tira d20=14 → 14+3+3=20 vs CA 16 → <em>colpo!</em> Danno: 1d8=5 +3=8 danni.</p>
              <p><strong>Armature:</strong> le armature pesanti offrono più CA ma penalizzano i tiri per colpire (HitPenalty). Le armature leggere/medie sommano la DES del personaggio alla CA base.</p>
            </div>
            <h3 className="arena-info-title">🪙 Monete Arena (MA)</h3>
            <ul className="arena-info-list">
              <li><strong>+1 MA</strong> per aver partecipato all'Arena.</li>
              <li><strong>+1 MA</strong> per ogni round vinto.</li>
              <li><strong>+5 MA</strong> se vinci il torneo.</li>
              <li>Spendile alla <strong>Bottega dell'Arena</strong> per pozioni, armi e armature potenziate.</li>
            </ul>
          </div>
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
            {arenaMeta.phase === "registration" && !isRegistered && !isPending && (
              <button className="btn-master-join" onClick={() => { setMasterJoinSetup(v => !v); setMasterJoinName(""); setMasterJoinClass(""); }}>
                🗡 Entra nell'Arena
              </button>
            )}
            {(isRegistered || isPending) && arenaMeta.phase === "registration" && (
              <div className="master-join-status">
                {isPending ? "⏳ In attesa di auto-approvazione…" : "✔ Iscritto come personaggio master"}
              </div>
            )}
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

          {masterJoinSetup && arenaMeta.phase === "registration" && (
            <div className="master-join-setup">
              <h4 className="master-join-setup-title">Crea il tuo personaggio</h4>
              <input
                className="master-join-input"
                placeholder="Nome personaggio…"
                value={masterJoinName}
                onChange={e => setMasterJoinName(e.target.value)}
                maxLength={30}
              />
              <select
                className="master-join-select"
                value={masterJoinClass}
                onChange={e => setMasterJoinClass(e.target.value)}
              >
                <option value="">— Scegli Classe —</option>
                {MASTER_JOIN_CLASSES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="master-join-setup-actions">
                <button className="btn-cancel-loadout" onClick={() => setMasterJoinSetup(false)}>Annulla</button>
                <button className="btn-join" onClick={startMasterLoadout} disabled={!masterJoinName.trim() || !masterJoinClass}>
                  Continua →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ZONA PLAYER: ISCRIZIONE (visibile anche al master durante rolling/selecting) ── */}
      {arenaMeta.phase === "registration" && (!isMaster || loadoutPhase !== "idle") && (
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
                      <button className="btn-reroll" onClick={rollHp} disabled={(charPreview.hpRerollCount || 0) >= 2}>↺ Ritira {(charPreview.hpRerollCount || 0) >= 2 ? "(esaurito)" : `(${2 - (charPreview.hpRerollCount || 0)} rimanenti)`}</button>
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
            const totalItems   = Object.values(pendingItemCounts).reduce((a, b) => a + b, 0);
            const isReady      = weaponsLeft === 0 && spellsLeft === 0 && armorReady && totalItems >= 1;
            const btnParts     = [];
            if (weaponsLeft > 0) btnParts.push(`${weaponsLeft} arm${weaponsLeft === 1 ? "a" : "i"}`);
            if (spellsLeft  > 0) btnParts.push(`${spellsLeft} incantesim${spellsLeft === 1 ? "o" : "i"}`);
            if (!armorReady)     btnParts.push("1 armatura");
            if (totalItems < 1)  btnParts.push("1 oggetto");
            const btnText = isReady ? "Invia Iscrizione" : `Mancano: ${btnParts.join(" + ")}`;

            // Calcolo CA anteprima
            const dexMod   = charPreview.stats.dex ?? 0;
            const previewAc = pendingArmor
              ? pendingArmor.baseAc + Math.max(0, Math.min(dexMod, pendingArmor.maxDex)) + (pendingShield ? 2 : 0)
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
                      {[["str","FOR"],["dex","DES"],["con","COS"],["int","INT"],["wis","SAG"],["cha","CAR"]].map(([k,lbl]) => {
                        const v = charPreview.stats[k] ?? 0;
                        return <span key={k}> · {lbl} {v >= 0 ? "+" : ""}{v}</span>;
                      })}
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

                {/* Sezione Incantesimi — raggruppati per livello */}
                {config.spellOptions.length > 0 && (() => {
                  const LEVEL_LABELS = { 0: "Trucchetti", 1: "Livello 1", 2: "Livello 2", 3: "Livello 3", 4: "Livello 4", 5: "Livello 5", 6: "Livello 6", 7: "Livello 7", 8: "Livello 8", 9: "Livello 9" };
                  const presentLevels = [...new Set(config.spellOptions.map(s => s.level ?? 0))].sort((a, b) => a - b);
                  return (
                    <>
                      <div className="loadout-section-title">
                        ✨ Incantesimi — {pendingSpells.length}/{config.maxSpells}
                      </div>
                      {presentLevels.map(lvl => {
                        const spellsOfLevel = config.spellOptions.filter(s => (s.level ?? 0) === lvl);
                        const isLocked = lvl >= 3;
                        const limit = config.spellLimits?.[lvl] ?? 0;
                        const selectedAtLevel = pendingSpells.filter(s => (s.level ?? 0) === lvl).length;
                        return (
                          <div key={lvl} className={`spell-level-group lv${lvl}${isLocked ? " locked-level" : ""}`}>
                            <div className="spell-level-header">
                              {isLocked
                                ? <><span className="spell-level-lock">🔒</span>{LEVEL_LABELS[lvl]} <span className="spell-level-locked-note">— Sbloccabile con Potenziamento</span></>
                                : <><span className={`spell-level-badge lv${lvl}`}>{LEVEL_LABELS[lvl]}</span><span className="spell-level-count">{selectedAtLevel}/{limit}</span></>
                              }
                            </div>
                            <div className="loadout-grid">
                              {spellsOfLevel.map(item => {
                                const isSelected = pendingSpells.some(a => a.name === item.name);
                                const atLevelLimit = !isSelected && selectedAtLevel >= limit;
                                const isDisabled = isLocked || atLevelLimit;
                                return (
                                  <button
                                    key={item.name}
                                    className={`loadout-item spell lv${item.level ?? 0} ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""} ${isLocked ? "spell-locked" : ""}`}
                                    onClick={() => toggleSpell(item, config.spellLimits)}
                                  >
                                    {isLocked && <span className="loadout-lock-icon">🔒</span>}
                                    <span className="loadout-item-icon">{item.icon}</span>
                                    <span className="loadout-item-name">{item.name}</span>
                                    <span className="loadout-item-damage">{item.damage}</span>
                                    {item.maxUses && !isLocked && <span className="spell-uses-tag">{item.maxUses} usi</span>}
                                    {item.info && <span className="loadout-item-info">{item.info}</span>}
                                    {isSelected && <span className="loadout-check">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}

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
                    const dexContrib = Math.max(0, Math.min(dex, armor.maxDex));
                    const acPreview = armor.baseAc + dexContrib;
                    const hasHitPenalty = armor.hitPenalty < 0;
                    return (
                      <button
                        key={armor.name}
                        className={`loadout-item armor ${isSelected ? "selected" : ""}`}
                        onClick={() => { setPendingArmor(armor); if (shieldLocked) setPendingShield(null); }}
                      >
                        <span className="loadout-item-icon">{armor.icon}</span>
                        <span className="loadout-item-name">{armor.name}</span>
                        <span className="loadout-item-damage">
                          CA {acPreview}
                          {armor.maxDex === 0
                            ? <span className="armor-no-dex"> (no DES)</span>
                            : armor.maxDex < 99
                            ? <span className="armor-dex-cap"> (+DES max {armor.maxDex})</span>
                            : <span className="armor-dex-cap"> (+DES {dex >= 0 ? "+" : ""}{dex})</span>}
                        </span>
                        {hasHitPenalty && (
                          <span className="armor-hit-penalty">⚔ attacco {armor.hitPenalty}</span>
                        )}
                        {isSelected && <span className="loadout-check">✓</span>}
                      </button>
                    );
                  })}
                </div>

                {/* ── Scudo (classi idonee) ── */}
                {config.canHaveShield && (
                  <div className="loadout-shield-row">
                    {/* Scudo di Legno — disponibile a tutte le classi con scudo */}
                    <button
                      className={`loadout-shield-btn ${pendingShield === "legno" ? "selected" : ""} ${shieldLocked ? "disabled" : ""}`}
                      onClick={() => { if (!shieldLocked) setPendingShield(v => v === "legno" ? null : "legno"); }}
                      disabled={shieldLocked}
                    >
                      🪵 Scudo di Legno {pendingShield === "legno" ? "✓ (+2 CA)" : "— +2 CA"}
                    </button>
                    {/* Scudo di Metallo — non disponibile per il Druido */}
                    {config.canHaveShield !== "wood" && (
                      <button
                        className={`loadout-shield-btn ${pendingShield === "metallo" ? "selected" : ""} ${shieldLocked ? "disabled" : ""}`}
                        onClick={() => { if (!shieldLocked) setPendingShield(v => v === "metallo" ? null : "metallo"); }}
                        disabled={shieldLocked}
                      >
                        🛡 Scudo di Metallo {pendingShield === "metallo" ? "✓ (+2 CA)" : "— +2 CA"}
                      </button>
                    )}
                    {shieldLocked && <small className="shield-locked-note">incompatibile — arma a 2 mani</small>}
                  </div>
                )}

                {/* Forma Selvatica (Druid) */}
                {config.hasWildShape && (
                  <div className="loadout-wild-note">
                    🐾 Avrai accesso alla <strong>Forma Selvatica</strong> durante il combattimento.
                  </div>
                )}

                {/* ── Sezione Oggetti ── */}
                {(() => {
                  const totalItems = Object.values(pendingItemCounts).reduce((a, b) => a + b, 0);
                  return (
                    <>
                      <div className="loadout-section-title">
                        🎒 Oggetti — {totalItems}/2 <span className="loadout-optional">(scegli fino a 2, anche uguali)</span>
                      </div>
                      <div className="loadout-grid">
                        {ARENA_ITEMS.map(item => {
                          const count = pendingItemCounts[item.key] || 0;
                          const canAdd = totalItems < 2;
                          return (
                            <div key={item.key} className={`loadout-item item-slot ${count > 0 ? "selected" : ""} ${!canAdd && count === 0 ? "disabled" : ""}`}>
                              <span className="loadout-item-icon">{item.icon}</span>
                              <span className="loadout-item-name">{item.name}</span>
                              <span className="loadout-item-damage">{item.info}</span>
                              <div className="item-counter-row">
                                <button className="item-counter-btn" disabled={count === 0}
                                  onClick={() => setPendingItemCounts(prev => ({ ...prev, [item.key]: Math.max(0, (prev[item.key] || 0) - 1) }))}>−</button>
                                <span className="item-counter-val">{count}</span>
                                <button className="item-counter-btn" disabled={!canAdd}
                                  onClick={() => setPendingItemCounts(prev => ({ ...prev, [item.key]: Math.min(2, (prev[item.key] || 0) + 1) }))}>+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

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
          {loadoutPhase === "idle" && !isMaster && (
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

      {/* ── TABELLONE DEL TORNEO (visibile a tutti gli utenti loggati) ── */}
      {(arenaMeta.phase === "combat" || arenaMeta.phase === "finished") && arenaMeta.matches?.length > 0 && (() => {
        const byRound = {};
        arenaMeta.matches.forEach(m => {
          const r = parseInt((m.matchId.match(/^R(\d+)/) || [, 1])[1]);
          (byRound[r] = byRound[r] || []).push(m);
        });
        const rounds = Object.entries(byRound).sort(([a], [b]) => a - b);
        return (
          <div className="bracket-section">
            <h3 className="bracket-title">⚔ Tabellone del Torneo
              {arenaMeta.phase === "combat" && <span className="bracket-round-badge">Round {arenaMeta.currentRound}</span>}
            </h3>
            <div className="bracket-scroll">
              {rounds.map(([round, rMatches]) => (
                <div key={round} className="bracket-round-col">
                  <div className="bracket-round-header">Round {round}</div>
                  {rMatches.map(m => {
                    const isMyMatch = m.players.some(p => p.id === currentUser?.uid);
                    return (
                      <div key={m.matchId} className={`bracket-card ${m.status}${isMyMatch ? " my-match" : ""}`}>
                        {m.isFFA && <div className="bracket-ffa-tag">FFA · 3 giocatori</div>}
                        {m.players.map((p, idx) => {
                          const char = snapshots[p.id] || { stats: { maxHp: 70 } };
                          const maxHp = char.stats?.maxHp ?? 70;
                          const hpPct = Math.max(0, Math.min(100, (p.hp / maxHp) * 100));
                          const hpColor = hpPct > 60 ? "#27ae60" : hpPct > 30 ? "#e67e22" : "#c0392b";
                          const isWin = m.winner === p.id;
                          const isActive = m.turn === p.id && m.status === "active";
                          return (
                            <React.Fragment key={p.id}>
                              {idx > 0 && <div className="bracket-sep">{m.isFFA ? "·" : "VS"}</div>}
                              <div className={`bracket-fighter${isWin ? " win" : ""}${p.hp <= 0 && m.status === "finished" ? " dead" : ""}${isActive ? " active-turn" : ""}`}>
                                <div className="bracket-fighter-row">
                                  {char.image && <img src={char.image} className="bracket-avatar" alt="" />}
                                  <div className="bracket-fighter-info">
                                    <span className="bracket-fighter-name">{isWin ? "🏆 " : ""}{p.name}</span>
                                    {char.class && <span className="bracket-fighter-class">{char.class}</span>}
                                  </div>
                                  {m.status === "finished"
                                    ? <span className={`bracket-result-tag${isWin ? " win" : " loss"}`}>{isWin ? "Vince" : "X"}</span>
                                    : isActive
                                    ? <span className="bracket-active-dot" title="Turno in corso">●</span>
                                    : <span className="bracket-hp-badge" style={{ background: hpColor }}>{p.hp}</span>
                                  }
                                </div>
                                {m.status !== "finished" && (
                                  <div className="bracket-hp-track">
                                    <div className="bracket-hp-bar" style={{ width: `${hpPct}%`, background: hpColor }} />
                                  </div>
                                )}
                              </div>
                            </React.Fragment>
                          );
                        })}
                        <div className={`bracket-status ${m.status}`}>
                          {m.status === "initiative" ? "⚡ Iniziativa"
                            : m.status === "active" ? "⚔ In combattimento"
                            : "✓ Concluso"}
                        </div>
                        {m.logs?.length > 0 && m.status === "active" && (
                          <div className="bracket-last-log">{logPubText(m.logs[m.logs.length - 1])}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── PANNELLO AZIONI (solo per partecipanti) ── */}
      {arenaMeta.phase === "combat" && (
        <div className="matches-container">
          {arenaMeta.matches.filter(m => m.players.some(p => p.id === currentUser?.uid)).map(m => {
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
            const pendingControlSave = !!myPlayer?.pendingControlSave;
            const hasPendingSave = pendingDexSave || pendingConSave || pendingControlSave;
            const currentActions = wildShapeForm
              ? (WILD_SHAPES[wildShapeForm]?.actions || [])
              : myActions;

            // Sistema impugnatura armi
            const myWeaponActions  = myActions.filter(a => a.type === "weapon");
            const needsEquip       = !wildShapeForm && myPlayer?.equippedWeaponNames == null && myWeaponActions.length > 0;
            const equippedNames    = myPlayer?.equippedWeaponNames ?? [];
            // Selezioni pending equip (per pannello iniziale)
            const rawEquipSel      = equipSelections[m.matchId];
            const currentEquipSel  = rawEquipSel !== undefined ? rawEquipSel : [];
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
                    {m.turnExpiry && (() => {
                      const msLeft = Math.max(0, new Date(m.turnExpiry).getTime() - Date.now());
                      const h = Math.floor(msLeft / 3600000);
                      const min = Math.floor((msLeft % 3600000) / 60000);
                      const sec = Math.floor((msLeft % 60000) / 1000);
                      const fmt = `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
                      const urgent = msLeft < 600000; // <10 min
                      return <span className={`arena-turn-timer${urgent ? " urgent" : ""}`}>{fmt}</span>;
                    })()}
                  </div>
                )}

                {m.status === "initiative" && m.turnExpiry && (
                  <div className="turn-tracker initiative-timer">
                    ⚡ Tira iniziativa entro:
                    {(() => {
                      const msLeft = Math.max(0, new Date(m.turnExpiry).getTime() - Date.now());
                      const min = Math.floor(msLeft / 60000);
                      const sec = Math.floor((msLeft % 60000) / 1000);
                      const fmt = `${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
                      const urgent = msLeft < 20000;
                      return <span className={`arena-turn-timer${urgent ? " urgent" : ""}`}>{fmt}</span>;
                    })()}
                  </div>
                )}

                {m.status === "active" && m.fightStartAt && (() => {
                  const msLeft = Math.max(0, new Date(m.fightStartAt).getTime() + ARENA_FIGHT_DURATION - Date.now());
                  const h   = Math.floor(msLeft / 3600000);
                  const min = Math.floor((msLeft % 3600000) / 60000);
                  const sec = Math.floor((msLeft % 60000) / 1000);
                  const fmt = `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
                  const urgent = msLeft < 3600000; // <1 ora
                  return (
                    <div className={`fight-global-timer${urgent ? " urgent" : ""}`}>
                      ⏰ Tempo rimasto al fight: <span className="arena-turn-timer">{fmt}</span>
                      <span className="fight-timer-note"> — allo scadere vince chi ha più HP</span>
                    </div>
                  );
                })()}

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
                          <div className="fighter-meta">
                            CA {char.stats?.ac ?? "?"}
                            {(() => {
                              const shieldBonus = (p.shieldSkillTurns ?? 0) > 0 ? 3 : 0;
                              const defBonus = p.defensiveBonus ?? 0;
                              const physShield = p.shieldBonus ?? 0;
                              const total = shieldBonus + defBonus + physShield;
                              return total > 0 ? <span style={{color:"#4ade80",fontWeight:"bold",marginLeft:2}}>(+{total})</span> : null;
                            })()}
                            {" · "}Init {p.init > 0 ? p.init : "—"}
                          </div>
                          {p.id === currentUser?.uid && char.stats && (
                            <div className="fighter-own-stats">
                              {[["str","FOR"],["dex","DES"],["con","COS"],["int","INT"],["wis","SAG"],["cha","CAR"]].map(([k,lbl]) => {
                                const v = char.stats[k] ?? 0;
                                return (
                                  <span key={k} className="fighter-stat-pill">
                                    {lbl} {v >= 0 ? "+" : ""}{v}
                                  </span>
                                );
                              })}
                            </div>
                          )}

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
                          {(p.defensiveBonus ?? 0) > 0 && (
                            <div className="fighter-defensive-badge">🛡 Difensivo (+{p.defensiveBonus} CA)</div>
                          )}
                          {p.weaponPoisoned && (
                            <div className="fighter-poison-badge">☠ Arma Avvelenata (+1d12)</div>
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
                    {mySnap?.hasWildShape && !wildShapeForm && !showWildPicker && !hasPendingSave && !isEntangled && (() => {
                      const wsLeft = myPlayer?.wildShapeUsesLeft ?? 2;
                      return (
                        <div className="wild-shape-bar">
                          {wsLeft > 0 ? (
                            <button className="btn-wild-shape" onClick={() => setShowWildPicker(true)}>
                              🐾 Forma Selvatica <span className="action-uses-badge">{wsLeft}/2</span>
                            </button>
                          ) : (
                            <div className="btn-wild-shape exhausted">🐾 Forma Selvatica — Esaurita</div>
                          )}
                        </div>
                      );
                    })()}

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

                    {/* ── Tiro Salvezza Controllo (spell di controllo) ── */}
                    {!pendingDexSave && !pendingConSave && pendingControlSave && (
                      <div className="save-block control">
                        <p className="save-block-label">🌀 Tiro Salvezza contro Spell di Controllo! (CD 13)</p>
                        <button className="btn-saving-throw" onClick={() => rollSavingThrow(m.matchId, null, "control_spell")}>
                          🎲 TS Controllo
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
                                    const cur = prev[m.matchId] !== undefined ? prev[m.matchId] : [];
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
                          <p className="equip-shield-note">
                            {mySnap.hasShield === "legno" ? "🪵 Scudo di Legno" : "🛡 Scudo di Metallo"} attivo (+2 CA)
                          </p>
                        )}
                        {equipHas2H && mySnap?.hasShield && (
                          <p className="equip-shield-note locked">
                            {mySnap.hasShield === "legno" ? "🪵 Scudo di Legno" : "🛡 Scudo di Metallo"} non disponibile con arma a 2 mani
                          </p>
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
                        const targetMaxHp = Math.max(1, targetMatchPlayer?.maxHp ?? snapshots[chosenTargetId]?.stats?.maxHp ?? 70);
                        const targetHpPct = targetMatchPlayer ? (targetMatchPlayer.hp / targetMaxHp) * 100 : 100;
                        // ── Raggruppa azioni per categoria ────────────────────
                        const isRangedWeapon = (a) => a.icon === "🏹" || ["Arco","Balestra","Fionda","Giavellotto","Dardo"].some(k => a.name.includes(k));
                        const meleeActions  = currentActions.filter(a => a.type === "weapon" && !isRangedWeapon(a));
                        const rangedActions = currentActions.filter(a => a.type === "weapon" && isRangedWeapon(a));
                        const skillActions  = currentActions.filter(a => a.type === "skill" && !(action => action.special === "deathblow" && targetHpPct > 20)(a));
                        const spellGroups   = [0, 1, 2, 3].map(lvl => ({
                          lvl,
                          spells: currentActions.filter(a => a.type === "spell" && a.level === lvl),
                        })).filter(g => g.spells.length > 0);
                        const LEVEL_LABELS = { 0: "Trucchetti", 1: "Livello 1", 2: "Livello 2", 3: "Livello 3" };

                        const renderActionBtn = (action) => {
                          if (action.special === "deathblow" && targetHpPct > 20) return null;
                          const isDeathblow = action.special === "deathblow";
                          if (action.special === "heal") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            return (
                              <button key={action.name} className={`btn-action spell heal ${noUses ? "no-uses" : ""}`}
                                disabled={noUses} title={noUses ? "Usi esauriti" : `${action.name} — cura ${action.damage} HP`}
                                onClick={() => !noUses && handleHealSpell(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `+${action.damage} HP`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "control") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            return (
                              <button key={action.name} className={`btn-action spell control ${noUses ? "no-uses" : ""}`}
                                disabled={noUses || !chosenTargetId} title={noUses ? "Usi esauriti" : `${action.name} — TS CD 13 o perdi turno`}
                                onClick={() => !noUses && chosenTargetId && handleControlSpell(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : "TS CD 13"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "shield_buff") {
                            return (
                              <button key={action.name} className="btn-action skill" title="+3 CA per 3 turni"
                                onClick={() => handleShieldSkill(m.matchId)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">+3 CA · 3 turni</span>
                              </button>
                            );
                          }
                          const usesLeft = action.maxUses !== undefined
                            ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses)
                            : null;
                          const noUsesLeft = usesLeft !== null && usesLeft <= 0;
                          const isWeapon   = action.type === "weapon";
                          const isEquipped = !isWeapon || wildShapeForm || equippedNames.includes(action.name);
                          return (
                            <button
                              key={action.name}
                              className={`btn-action ${action.type} ${isWeapon && !wildShapeForm ? (isEquipped ? "equipped" : "unequipped") : ""} ${noUsesLeft ? "no-uses" : ""} ${isDeathblow ? "deathblow-ready" : ""} ${action.special === "smite" && !noUsesLeft ? "smite-active" : ""}`}
                              disabled={noUsesLeft}
                              title={noUsesLeft
                                ? `${action.name} — Usi esauriti`
                                : action.special === "web" ? "Ragnatela — TS DES bersaglio"
                                : action.special === "poison" ? `Veleno — ${action.damage} danni + TS COS`
                                : action.special === "deathblow" ? `Colpo Mortale — ${action.damage} +DES (solo ≤20% HP)`
                                : !isEquipped ? "Clicca per impugnare (spende il turno)"
                                : `+${action.hitBonus}${action.statKey ? ` +${action.statKey.toUpperCase()}` : ""} | ${action.damage}${action.statKey ? ` +${action.statKey.toUpperCase()}` : ""}`}
                              onClick={() => {
                                if (noUsesLeft) return;
                                isEquipped
                                  ? handleAttack(m.matchId, chosenTargetId, action)
                                  : handleSwitchWeapon(m.matchId, action.name);
                              }}
                            >
                              <span className="action-icon">{action.icon}</span>
                              <span className="action-name">{action.name}</span>
                              <span className="action-dice">
                                {noUsesLeft ? "Esaurito"
                                  : !isEquipped ? "🔄 Cambia"
                                  : action.special === "web" ? "TS DES"
                                  : action.special === "poison" ? `${action.damage} +TS COS`
                                  : `${action.damage}${action.statKey ? ` +${action.statKey.toUpperCase()}` : ""}`}
                              </span>
                              {usesLeft !== null && (
                                <span className={`action-uses-badge ${noUsesLeft ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              )}
                            </button>
                          );
                        };

                        return (
                          <div className="action-groups">
                            {meleeActions.length > 0 && (
                              <div className="action-group">
                                <div className="action-group-label melee">⚔ Mischia</div>
                                <div className="action-buttons">{meleeActions.map(renderActionBtn)}</div>
                              </div>
                            )}
                            {rangedActions.length > 0 && (
                              <div className="action-group">
                                <div className="action-group-label ranged">🏹 Distanza</div>
                                <div className="action-buttons">{rangedActions.map(renderActionBtn)}</div>
                              </div>
                            )}
                            {spellGroups.map(({ lvl, spells }) => (
                              <div key={lvl} className="action-group">
                                <div className={`action-group-label spell-lv${lvl}`}>
                                  {lvl === 0 ? "✨" : "🔮"} {LEVEL_LABELS[lvl]}
                                </div>
                                <div className="action-buttons">{spells.map(renderActionBtn)}</div>
                              </div>
                            ))}
                            {skillActions.length > 0 && (
                              <div className="action-group">
                                <div className="action-group-label skill">⚡ Abilità</div>
                                <div className="action-buttons">{skillActions.map(renderActionBtn)}</div>
                              </div>
                            )}
                          </div>
                        );
                      })() : (
                        <div className="no-target-msg">Nessun bersaglio disponibile.</div>
                      )
                    )}

                    {/* ── Oggetti ── */}
                    {!hasPendingSave && (() => {
                      const myItemKeys = arenaMeta.characterSnapshots?.[currentUser?.uid]?.selectedItemKeys || [];
                      if (myItemKeys.length === 0) return null;
                      const myItemUsesLeft = myPlayer?.itemUsesLeft || {};
                      const itemCountsInSnap = {};
                      myItemKeys.forEach(k => { itemCountsInSnap[k] = (itemCountsInSnap[k] || 0) + 1; });
                      return (
                        <div className="items-row">
                          {Object.entries(itemCountsInSnap).map(([key]) => {
                            const item   = ARENA_ITEMS.find(i => i.key === key);
                            if (!item) return null;
                            const uses   = myItemUsesLeft[key] ?? 0;
                            const total  = itemCountsInSnap[key];
                            const needsTarget = key === "bomba";
                            const disabled    = uses <= 0 || (needsTarget && !chosenTargetId);
                            return (
                              <button key={key}
                                className={`btn-item ${uses <= 0 ? "no-uses" : ""}`}
                                disabled={disabled}
                                title={item.info}
                                onClick={() => useItem(m.matchId, key, needsTarget ? chosenTargetId : null)}>
                                <span className="item-icon">{item.icon}</span>
                                <span className="item-name">{item.name}</span>
                                <span className="item-uses">{uses}/{total}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="match-log">
                  {m.logs.slice(-5).map((l, i) => {
                    const text = displayLog(l, currentUser?.uid);
                    const isLatest = i === m.logs.slice(-5).length - 1;
                    const isAttLog = typeof l === 'object' && l.attId === currentUser?.uid;
                    const isDefLog = typeof l === 'object' && l.defId === currentUser?.uid;
                    const ts = typeof l === 'object' && l.ts
                      ? new Date(l.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : null;
                    return (
                      <p key={i} className={`log-entry ${isLatest ? "latest" : ""} ${isAttLog ? "log-attacker" : ""} ${isDefLog ? "log-defender" : ""}`}>
                        {isMaster && ts && <span className="log-ts">{ts}</span>}
                        {text}
                      </p>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
