import React, { useState, useEffect, useCallback, useRef } from "react";
import { db } from "../firebase";
import {
  doc, getDoc, getDocs, onSnapshot, updateDoc, setDoc,
  arrayUnion, arrayRemove, addDoc, collection, serverTimestamp,
  runTransaction, increment, query, where,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./Arena.css";

// ── WIZARD SPELLS (Mago) — pool: 6 trucchetti · 8 lv1 · 5 lv2 · 3 lv3 (sceglie 3+4+2)
const WIZARD_SPELLS = [
  // ── Trucchetti ──────────────────────────────────────────────────────────────
  { name: "Dardo di Fuoco",        level: 0, hitBonus: 3, damage: "1d10",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco" },
  { name: "Tocco Gelido",          level: 0, hitBonus: 3, damage: "1d8",   statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Necrotico" },
  { name: "Spruzzo Velenoso",      level: 0, hitBonus: 3, damage: "1d12",  statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Veleno" },
  { name: "Scossa Folgorante",     level: 0, hitBonus: 3, damage: "1d8",   statKey: null, type: "spell", icon: "⚡", info: "Trucchetto · Fulmine" },
  { name: "Raggio di Gelo",        level: 0, hitBonus: 3, damage: "1d8",   statKey: null, type: "spell", icon: "🧊", info: "Trucchetto · Freddo" },
  { name: "Lama Vorticosa",        level: 0, hitBonus: 3, damage: "1d8",   statKey: null, type: "spell", icon: "🌀", info: "Trucchetto · Tuono · mischia" },
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Dardo Incantato",       level: 1, hitBonus: 39, damage: "3d4+3", statKey: null, type: "spell", icon: "✨", info: "Lv1 · Forza · colpisce sempre", maxUses: 4 },
  { name: "Mani Brucianti",        level: 1, hitBonus: 3,  damage: "3d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv1 · Fuoco", maxUses: 4 },
  { name: "Scudo",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 CA/3 turni", special: "shield_buff", maxUses: 2 },
  { name: "Sonno",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "😴", info: "Lv1 · Controllo · TS SAG o perdi turno", special: "control", maxUses: 4 },
  { name: "Colpo Cromatico",       level: 1, hitBonus: 3,  damage: "3d8",   statKey: null, type: "spell", icon: "🌈", info: "Lv1 · Magico", maxUses: 4 },
  { name: "Onda Tonante",          level: 1, hitBonus: 3,  damage: "2d8",   statKey: null, type: "spell", icon: "💨", info: "Lv1 · Tuono", maxUses: 4 },
  { name: "Raggio Avvelenato",     level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🤢", info: "Lv1 · Controllo · TS COS o perdi turno", special: "control", maxUses: 4 },
  { name: "Assorbire Elementi",    level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🔰", info: "Lv1 · +3 CA per 3 turni", special: "shield_buff", maxUses: 2 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Raggio Rovente",        level: 2, hitBonus: 3, damage: "6d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco (3 raggi × 2d6)", maxUses: 2 },
  { name: "Frantumare",            level: 2, hitBonus: 3, damage: "3d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Invisibilità",          level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "👻", info: "Lv2 · Il nemico non può attaccarti il prossimo turno", special: "invisibility", maxUses: 2 },
  { name: "Cecità/Sordità",        level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🙈", info: "Lv2 · −3 ai tiri per colpire del nemico", special: "blind_debuff", maxUses: 2 },
  { name: "Tocco Vampirico",       level: 2, hitBonus: 3, damage: "3d6",   statKey: null, type: "spell", icon: "🩸", info: "Lv2 · Necrotico", maxUses: 2 },
  // ── Livello 3 (bloccati — sbloccabili con Potenziamento) ──────────────────
  { name: "Palla di Fuoco",        level: 3, hitBonus: 3, damage: "8d6",   statKey: null, type: "spell", icon: "💥", info: "Lv3 · Fuoco", maxUses: 1 },
  { name: "Fulmine",               level: 3, hitBonus: 3, damage: "8d6",   statKey: null, type: "spell", icon: "⚡", info: "Lv3 · Fulmine", maxUses: 1 },
  { name: "Contrincantesimo",      level: 3, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🚫", info: "Lv3 · Controllo · TS o perdi turno", special: "control", maxUses: 1 },
];

// ── SORCERER SPELLS (Stregone) — pool: 4 trucchetti · 4 lv1 · 3 lv2 (sceglie 4+4+2)
const SORCERER_SPELLS = [
  { name: "Dardo di Fuoco",        level: 0, hitBonus: 3,  damage: "1d10",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco" },
  { name: "Scossa Folgorante",     level: 0, hitBonus: 3,  damage: "1d8",   statKey: null, type: "spell", icon: "⚡",  info: "Trucchetto · Fulmine" },
  { name: "Gelidito",              level: 0, hitBonus: 3,  damage: "1d8",   statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Freddo" },
  { name: "Spruzzo Velenoso",      level: 0, hitBonus: 3,  damage: "1d12",  statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Veleno" },
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

// ── WARLOCK SPELLS (Oscuro Cultore) — pool: 4 trucchetti · 5 lv1 · 4 lv2 (sceglie 2 trucchetti + 2 slot lv1/lv2 misti)
const WARLOCK_SPELLS = [
  // ── Trucchetti ──────────────────────────────────────────────────────────────
  { name: "Deflagrazione Occulta",  level: 0, hitBonus: 3, damage: "1d10", statKey: null, type: "spell", icon: "🟣", info: "Trucchetto · Forza" },
  { name: "Rintocco Funebre",       level: 0, hitBonus: 3, damage: "1d10", statKey: null, type: "spell", icon: "🔔", info: "Trucchetto · Necrotico (1d12 se già ferito)" },
  { name: "Spruzzo Velenoso",       level: 0, hitBonus: 3, damage: "1d12", statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Veleno" },
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Braccia di Hadar",       level: 1, hitBonus: 3, damage: "2d6",  statKey: null, type: "spell", icon: "🐙", info: "Lv1 · Necrotico", maxUses: 2 },
  { name: "Malocchio",              level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "👁", info: "Lv1 · Controllo · TS o perdi turno", special: "control", maxUses: 2 },
  { name: "Scudo",                  level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 CA/3 turni", special: "shield_buff", maxUses: 2 },
  { name: "Rappresaglia Infernale", level: 1, hitBonus: 3, damage: "2d10", statKey: null, type: "spell", icon: "🔥", info: "Lv1 · Fuoco · risposta ai danni", maxUses: 2 },
  { name: "Charme su Persone",      level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🫦", info: "Lv1 · Controllo · TS SAG o perdi turno", special: "control", maxUses: 2 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Frantumare",             level: 2, hitBonus: 3, damage: "3d8",  statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Blocca Persone",         level: 2, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🧊", info: "Lv2 · Controllo · TS SAG o perdi turno", special: "control", maxUses: 2 },
  { name: "Corona della Pazzia",    level: 2, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🌀", info: "Lv2 · Controllo · TS SAG o attacca sé stesso", special: "corona_pazzia", maxUses: 2 },
  { name: "Oscurità",               level: 2, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🌑", info: "Lv2 · −3 ai tiri per colpire del nemico", special: "blind_debuff", maxUses: 2 },
];

// ── DRUID SPELLS (Druido) — 2 trucchetti · 4 lv1 · 2 lv2
const DRUID_SPELLS = [
  // ── Trucchetti (nessun limite di usi) ──────────────────────────────────────
  { name: "Frusta di Spine",    level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🌿", info: "Trucchetto · Perforante" },
  { name: "Produrre Fiamma",    level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco" },
  { name: "Spruzzo Velenoso",   level: 0, hitBonus: 3, damage: "1d12", statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Veleno" },
  { name: "Infestazione",       level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🐜", info: "Trucchetto · Veleno" },
  { name: "Morso di Gelo",      level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Freddo" },
  { name: "Schianto di Tuono",  level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "⚡", info: "Trucchetto · Tuono" },
  { name: "Guida",              level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "⭐", info: "Trucchetto · +3 al prossimo tiro per colpire", special: "magic_detect" },
  { name: "Resistenza",         level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🔰", info: "Trucchetto · +3 CA per 3 turni", special: "shield_buff" },
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Cura Ferite",        level: 1, hitBonus: 0, damage: "1d8+3", statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Parola Guaritrice",  level: 1, hitBonus: 0, damage: "1d4+3", statKey: null, type: "spell", icon: "💙", info: "Lv1 · Cura rapida · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Onda Tonante",       level: 1, hitBonus: 3, damage: "2d8",   statKey: null, type: "spell", icon: "💨", info: "Lv1 · Tuono", maxUses: 3 },
  { name: "Intralciare",        level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌱", info: "Lv1 · Controllo · TS FOR o perdi turno", special: "control", maxUses: 3 },
  { name: "Luci Fatate",        level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🧚", info: "Lv1 · +4 al prossimo tiro per colpire", special: "aid_buff", maxUses: 3 },
  { name: "Coltello di Ghiaccio",level:1, hitBonus: 3, damage: "1d10",  statKey: null, type: "spell", icon: "🧊", info: "Lv1 · Freddo", maxUses: 3 },
  { name: "Charme su Persone",  level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🫦", info: "Lv1 · Controllo · TS SAG o perdi turno", special: "control", maxUses: 3 },
  { name: "Assorbire Elementi", level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 CA per 3 turni (difesa elementale)", special: "shield_buff", maxUses: 3 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Riscaldare Metallo", level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🔩", info: "Lv2 · −3 ai tiri per colpire del nemico", special: "blind_debuff", maxUses: 2 },
  { name: "Frantumare",         level: 2, hitBonus: 3, damage: "3d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Blocca Persone",     level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🧲", info: "Lv2 · Controllo · TS SAG o perdi turno", special: "control", maxUses: 2 },
  { name: "Raggio di Luna",     level: 2, hitBonus: 3, damage: "2d10",  statKey: null, type: "spell", icon: "🌙", info: "Lv2 · Radiante", maxUses: 2 },
  { name: "Scorza Coriacea",    level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🪵", info: "Lv2 · +3 CA per 3 turni", special: "shield_buff", maxUses: 2 },
  { name: "Lama di Fiamma",     level: 2, hitBonus: 3, damage: "3d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco", maxUses: 2 },
];

// ── CLERIC SPELLS (Chierico) — 3 trucchetti · 4 lv1 · 2 lv2
const CLERIC_SPELLS = [
  // ── Trucchetti (nessun limite di usi) ──────────────────────────────────────
  { name: "Fiamma Sacra",       level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "✨", info: "Trucchetto · Radiante" },
  { name: "Rintocco dei Morti", level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "💀", info: "Trucchetto · Necrotico" },
  { name: "Parola di Splendore",level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🌟", info: "Trucchetto · Radiante" },
  { name: "Infestazione",       level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🐜", info: "Trucchetto · Veleno" },
  { name: "Guida",              level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "⭐", info: "Trucchetto · +3 al prossimo tiro per colpire", special: "magic_detect" },
  { name: "Resistenza",         level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🔰", info: "Trucchetto · +3 CA per 3 turni", special: "shield_buff" },
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Cura Ferite",        level: 1, hitBonus: 0, damage: "1d8+3", statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Parola Guaritrice",  level: 1, hitBonus: 0, damage: "1d4+3", statKey: null, type: "spell", icon: "💙", info: "Lv1 · Cura rapida · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Dardo Guidato",      level: 1, hitBonus: 3, damage: "4d6",   statKey: null, type: "spell", icon: "🌟", info: "Lv1 · Radiante", maxUses: 3 },
  { name: "Infliggi Ferite",    level: 1, hitBonus: 3, damage: "3d10",  statKey: null, type: "spell", icon: "🩸", info: "Lv1 · Necrotico", maxUses: 3 },
  { name: "Scudo della Fede",   level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 CA per 3 turni", special: "shield_buff", maxUses: 2 },
  { name: "Comando",            level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "📯", info: "Lv1 · Controllo · TS SAG o perdi turno", special: "control", maxUses: 3 },
  { name: "Disgrazia",          level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌑", info: "Lv1 · −3 ai tiri per colpire del nemico", special: "blind_debuff", maxUses: 3 },
  { name: "Benedire",           level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "✨", info: "Lv1 · +3 al prossimo tiro per colpire", special: "magic_detect", maxUses: 3 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Arma Spirituale",        level: 2, hitBonus: 3, damage: "1d8+4", statKey: null, type: "spell", icon: "⚔",  info: "Lv2 · Forza", maxUses: 2 },
  { name: "Ristorare Inferiore",    level: 2, hitBonus: 0, damage: "1d4+2", statKey: null, type: "spell", icon: "💊", info: "Lv2 · Rimuove condizioni + cura 1d4+2 HP", special: "heal", maxUses: 2 },
  { name: "Blocca Persone",         level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🧊", info: "Lv2 · Controllo · TS SAG o perdi turno", special: "control", maxUses: 2 },
  { name: "Aiuto",                  level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🤝", info: "Lv2 · +4 al prossimo tiro per colpire", special: "aid_buff", maxUses: 2 },
  { name: "Cecità/Sordità",         level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🙈", info: "Lv2 · −3 ai tiri per colpire del nemico", special: "blind_debuff", maxUses: 2 },
  { name: "Preghiera di Guarigione",level: 2, hitBonus: 0, damage: "2d8+3", statKey: null, type: "spell", icon: "🙏", info: "Lv2 · Cura potente · ripristina HP", special: "heal", maxUses: 2 },
];

// ── BARD SPELLS (Bardo) — niente trucchetti · 4 lv1 · 2 lv2
const BARD_SPELLS = [
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Parola Guaritrice",          level: 1, hitBonus: 0, damage: "1d4+3", statKey: null, type: "spell", icon: "💙", info: "Lv1 · Cura rapida · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Charme su Persone",          level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🫦", info: "Lv1 · Controllo · TS SAG o perdi turno", special: "control", maxUses: 3 },
  { name: "Risata Incontenibile",       level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🤣", info: "Lv1 · Controllo · TS SAG o perdi turno", special: "control", maxUses: 3 },
  { name: "Individuazione del Magico",  level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🔮", info: "Lv1 · +3 al prossimo tiro per colpire", special: "magic_detect", maxUses: 3 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Frastornare",                level: 2, hitBonus: 3, damage: "3d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Cecità/Sordità",             level: 2, hitBonus: 3, damage: "—",     statKey: null, type: "spell", icon: "🙈", info: "Lv2 · −3 ai tiri per colpire del nemico", special: "blind_debuff", maxUses: 2 },
  { name: "Invisibilità",               level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "👻", info: "Lv2 · Il nemico non può attaccarti il prossimo turno", special: "invisibility", maxUses: 2 },
  { name: "Suggestione",                level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌀", info: "Lv2 · Controllo · TS SAG o perdi turno", special: "control", maxUses: 2 },
];

// ── PALADIN SPELLS (Paladino) — pool: 3 lv1 · 3 lv2 (sceglie 2+1)
const PALADIN_SPELLS = [
  { name: "Cura Ferite",           level: 1, hitBonus: 0, damage: "1d8+3", statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Punizione Travolgente", level: 1, hitBonus: 3, damage: "1d6",   statKey: null, type: "spell", icon: "⚡", info: "Lv1 · Radiante bonus", maxUses: 3 },
  { name: "Comando",               level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "📞", info: "Lv1 · Controllo · TS o perdi turno", special: "control", maxUses: 3 },
  { name: "Punizione Marchiante",  level: 2, hitBonus: 3, damage: "2d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Radiante", maxUses: 2 },
  { name: "Ristorare Inferiore",   level: 2, hitBonus: 0, damage: "1d4+2", statKey: null, type: "spell", icon: "💊", info: "Lv2 · Rimuove condizioni + cura 1d4+2 HP", special: "heal", maxUses: 2 },
  { name: "Aiuto",                 level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🤝", info: "Lv2 · +4 al prossimo tiro per colpire", special: "aid_buff", maxUses: 2 },
];

// ── RANGER SPELLS (Ranger) — pool: 6 lv1 (sceglie 3)
const RANGER_SPELLS = [
  { name: "Cura Ferite",           level: 1, hitBonus: 0, damage: "1d8+3", statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Intralciare",           level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌱", info: "Lv1 · Controllo · TS FOR o perdi turno", special: "control", maxUses: 3 },
  { name: "Grandine di Spine",     level: 1, hitBonus: 3, damage: "1d10",  statKey: null, type: "spell", icon: "🌵", info: "Lv1 · Perforante · bonus attacco ranged", maxUses: 3 },
  { name: "Colpo Intralciante",    level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🕸", info: "Lv1 · Controllo · TS FOR o perdi turno", special: "control", maxUses: 3 },
  { name: "Nebbia",                level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌫", info: "Lv1 · +3 CA per 3 turni", special: "shield_buff", maxUses: 3 },
  { name: "Passo Spedito",         level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "💨", info: "Lv1 · +3 al prossimo tiro per colpire", special: "magic_detect", maxUses: 3 },
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
const CLERIC_WEAPON_OPTIONS  = SIMPLE_WEAPONS;
const DRUID_WEAPON_OPTIONS   = SIMPLE_WEAPONS;
const BARD_WEAPON_OPTIONS    = [...SIMPLE_WEAPONS, _mw("Stocco")].filter(Boolean);
const ROGUE_WEAPON_OPTIONS   = [...SIMPLE_WEAPONS, _mw("Stocco"), _mw("Scimitarra"), _mw("Spada Corta"), _mw("Frusta"), _mw("Balestra a Mano")].filter(Boolean);
const RANGER_WEAPON_OPTIONS  = [...SIMPLE_WEAPONS, ...MARTIAL_WEAPONS];
const MONK_WEAPON_OPTIONS    = [...SIMPLE_WEAPONS, _mw("Spada Corta"), _mw("Frusta"), _mw("Balestra a Mano")].filter(Boolean);
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
    { name: "Cotta ad Anelli",    baseAc: 15, maxDex: 0, hitPenalty: -1, icon: "🛡", info: "Pesante · senza DES · −1 attacco" },
    // { name: "Cotta di Maglia",    baseAc: 20, maxDex: 0, hitPenalty: -2, icon: "🛡", info: "Pesante · senza DES · −2 attacco" },
    { name: "Armatura a Placche", baseAc: 16, maxDex: 0, hitPenalty: -1, icon: "🛡", info: "Pesante · senza DES · −3 attacco" },
    { name: "Piastre Intere",     baseAc: 17, maxDex: 0, hitPenalty: -2, icon: "🛡", info: "Pesante · senza DES · −4 attacco" },
  ],
  // Druido: leggere + medie, niente metalli
  druid:      [..._ARMOR_LIGHT, ..._ARMOR_MEDIUM],
  // Ranger: leggere + medie + borchiate
  lightMedium:[..._ARMOR_LIGHT, ..._ARMOR_MEDIUM, ..._ARMOR_MEDIUM_STUDDED],
  // Barbarian: leggere + medie + opzione senza armatura (10+DES+COS)
  barbarian:  [
    { name: "Senza Armatura", baseAc: 10, maxDex: 99, hitPenalty: 0, icon: "💪", info: "Senza armatura · 10+DES+COS", unarmoredDefense: true },
    ..._ARMOR_LIGHT,
    ..._ARMOR_MEDIUM,
    ..._ARMOR_MEDIUM_STUDDED,
  ],
  monk: [
    { name: "Senza Armatura", baseAc: 10, maxDex: 99, hitPenalty: 0, icon: "🥋", info: "Senza armatura · 10+DES+SAG", unarmoredDefense: true, unarmoredStat: "wis" },
  ],
  sorcerer: [
    { name: "Senza Armatura", baseAc: 10, maxDex: 99, hitPenalty: 0, icon: "✨", info: "Senza armatura · 10+max(COS,DES)", unarmoredDefense: true, unarmoredMaxStat: true },
  ],
};

// ── WILD SHAPE FORMS ──────────────────────────────────────────────────────────
const WILD_SHAPES = {
  wolf: {
    name: "Lupo", icon: "🐺",
    hpDice: { count: 4, sides: 12 },
    actions: [
      { name: "Artiglio", damage: "1d6+3", statKey: "str", type: "weapon", icon: "🐾", hitBonus: 3 },
      { name: "Morso",    damage: "1d6+3", statKey: "str", type: "weapon", icon: "🦷", hitBonus: 3 },
    ],
  },
  bear: {
    name: "Orso", icon: "🐻",
    hpDice: { count: 6, sides: 12 },
    actions: [
      { name: "Artiglio", damage: "1d6+3", statKey: "str", type: "weapon", icon: "🐾", hitBonus: 3 },
      { name: "Morso",    damage: "1d4+3", statKey: "str", type: "weapon", icon: "🦷", hitBonus: 3 },
    ],
  },
  spider: {
    name: "Ragno", icon: "🕷",
    hpDice: { count: 4, sides: 12 },
    actions: [
      { name: "Morso",     damage: "1d4+3", statKey: "str", type: "weapon", icon: "🦷", hitBonus: 3 },
      { name: "Veleno",    damage: "1d6+3", statKey: null,  type: "spell",  icon: "☠",  hitBonus: 0, special: "poison" },
      { name: "Ragnatela", damage: "—",     statKey: null,  type: "spell",  icon: "🕸", hitBonus: 0, special: "web"    },
    ],
  },
};

// Carica del Guerriero — aggiunto automaticamente (max 2 usi)
const CHARGE_ACTION = {
  name: "Carica", hitBonus: 3, damage: "2d6", statKey: "str",
  type: "skill", icon: "⚔", info: "2d6+FOR · 2 cariche", maxUses: 2,
};

// Secondo Respiro (Fighter) — cura 1d10+5, 2 usi
const SECOND_WIND_ACTION = {
  name: "Secondo Respiro", hitBonus: 0, damage: "1d10", statKey: null,
  type: "skill", icon: "💨", info: "Cura 1d10+5 · 2 usi", special: "second_wind", maxUses: 2,
};

// Scatto d'Azione (Fighter) — guadagna un'azione extra questo turno, 1 uso
const ACTION_SURGE_ACTION = {
  name: "Scatto d'Azione", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "⚡", info: "Azione extra questo turno · 1 uso", special: "action_surge", maxUses: 1,
};

// Colpo Mortale (Rogue) — aggiunto automaticamente (max 2 usi, solo ≤20% HP)
const DEATHBLOW_ACTION = {
  name: "Colpo Mortale", hitBonus: 3, damage: "4d6+3", statKey: "dex",
  type: "skill", icon: "💀", info: "Solo ≤20% HP · +DES", special: "deathblow", maxUses: 2,
};

// Attacco Furtivo (Rogue) — arma equipaggiata + 1d6, 3 cariche
const SNEAK_ATTACK_ACTION = {
  name: "Attacco Furtivo", hitBonus: 0, damage: "1d6", statKey: null,
  type: "skill", icon: "🗡", info: "Arma+1d6+DES+3 · 3 cariche", special: "sneak_attack", maxUses: 3,
};

// Furtività (Rogue) — buff puro: vantaggio 3 turni, nemico svantaggio 3 turni, 3 cariche
const STEALTH_ACTION = {
  name: "Furtività", hitBonus: 0, damage: "", statKey: null,
  type: "skill", icon: "🌑", info: "Attiva Furtività · vantaggio attacchi 3 turni · nemico svantaggio 3 turni · 3 cariche", special: "stealth", maxUses: 3,
};

// Ispirazione Bardica — cariche = modificatore CAR (impostate dinamicamente al join)
const BARDIC_INSPIRATION_ACTION = {
  name: "Ispirazione Bardica", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🎵", info: "+1d6 al prossimo tiro per colpire · cariche = CAR", special: "bardic_inspiration", maxUses: 1,
};

// Furia (Barbarian) — aggiunto automaticamente (2 cariche, +2 danno armi per 3 turni)
const RAGE_ACTION = {
  name: "Furia", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🔥", info: "+2 danno armi per 3 turni · 2 cariche", special: "rage", maxUses: 2,
};

// Pugno (Monk) — attacco a mani nude, 1d6+DES, sempre disponibile
const PUGNO_ACTION = {
  name: "Pugno", hitBonus: 3, damage: "1d6", statKey: "dex",
  type: "skill", icon: "👊", info: "Colpo a mani nude · 1d6+DES",
};
// Carica di Pugni (Monk) — 2 pugni consecutivi, 2d6+DES, 2 usi
const CARICA_PUGNI_ACTION = {
  name: "Carica di Pugni", hitBonus: 3, damage: "2d6", statKey: "dex",
  type: "skill", icon: "💥", info: "2 colpi a mani nude · 2d6+DES · 2 usi", maxUses: 2,
};

// Marchio del Cacciatore (Ranger) — +3 ai tiri per colpire per 3 turni, 2 cariche
const HUNTER_MARK_ACTION = {
  name: "Marchio del Cacciatore", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🎯", info: "+3 ai tiri per colpire per 3 turni · 2 cariche", special: "hunter_mark", maxUses: 2,
};

// Stregoneria Innata (Sorcerer) — passiva: vantaggio sui tiri per colpire con incantesimi
const INNATE_SORCERY_PASSIVE = {
  name: "Stregoneria Innata", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🌟", info: "Passiva · vantaggio su tutti i tiri per colpire con incantesimi",
};

// Fonte di Magia (Sorcerer) — ripristina 2 slot magia, 2 cariche
const FONTE_DI_MAGIA_ACTION = {
  name: "Fonte di Magia", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🔮", info: "Ripristina 2 slot magia a scelta · 2 cariche", special: "fonte_di_magia", maxUses: 2,
};

const CASTER_SKILLS = [];

// ── ITEMS ─────────────────────────────────────────────────────────────────────
const ARENA_ITEMS = [
  { key: "pozione_cura",        name: "Pozione di Cura",        icon: "🧪", info: "Cura 2d12 · Passa il turno",                 damage: "2d12" },
  { key: "pozione_cura_media",  name: "Pozione di Cura Media",  icon: "💚", info: "Cura 2d8 · Passa il turno (Bottega Arena)",   damage: "2d8",  shopOnly: true },
  { key: "bomba",               name: "Bomba",                  icon: "💣", info: "2d6 danni al bersaglio · Passa il turno",    damage: "2d6"  },
  { key: "pozione_veleno",      name: "Pozione di Veleno",      icon: "☠",  info: "1d6 veleno al bersaglio il prossimo turno",   damage: "1d6"  },
];

const ARENA_INITIATIVE_DURATION = 10 * 60 * 1000;      // 10 minuti per tirare iniziativa
const ARENA_TURN_DURATION       = 1 * 60 * 60 * 1000;  // 1 ora per fare la propria azione
const ARENA_FIGHT_DURATION      = 10 * 60 * 60 * 1000; // 10 ore limite globale per fight

// Smite del Paladino — aggiunto automaticamente (max 2 usi)
const SMITE_ACTION = {
  name: "Smite Divino", hitBonus: 0, damage: "2d8", statKey: null,
  type: "skill", icon: "⚡", info: "Attacca con arma +2d8 · 1 carica", special: "smite", maxUses: 1,
};

// Lay of Hands — aggiunto automaticamente al Paladino (pool = 1/3 HP)
const LAY_OF_HANDS_ACTION = {
  name: "Lay of Hands", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🙏", info: "Cura dalla pozza (1/3 HP max) · scegli l'importo", special: "lay_of_hands",
};

// Recupero Arcano (Wizard) — ripristina 2 slot lv1 e 1 slot lv2, 1 uso
const RECUPERO_ARCANO_ACTION = {
  name: "Recupero Arcano", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "📖", info: "Ripristina 2 slot lv1 + 1 slot lv2 · 1 uso", special: "recupero_arcano", maxUses: 1,
};

// Astuzia Magica (Warlock) — salta il turno ma ripristina tutti gli slot
const MAGICAL_CUNNING_ACTION = {
  name: "Astuzia Magica", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🌀", info: "Salta il turno · ripristina tutti gli slot magia · 1 uso", special: "magical_cunning", maxUses: 1,
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
  // CHA: Bardo, Paladino, Stregone, Warlock
  if (["bard","bardo","warlock","sorcerer","stregone","paladin","paladino"].some(c => cls.includes(c))) return "cha";
  // WIS: Chierico, Druido, Ranger, Monaco
  if (["cleric","chierico","druid","druido","ranger","cacciatore","monk","monaco"].some(c => cls.includes(c))) return "wis";
  // INT: Mago, Artefice, Guerriero (Cavaliere Arcano), Ladro (Mistificatore Arcano) + default
  return "int";
}
function isRogueClass(cls)      { return ["rogue","ladro"].some(c => cls.includes(c)); }
function isRangerClass(cls)     { return ["ranger","cacciatore"].some(c => cls.includes(c)); }
function isBarbarianClass(cls)  { return ["barbarian","barbaro"].some(c => cls.includes(c)); }
function isMonkClass(cls)       { return ["monk","monaco"].some(c => cls.includes(c)); }

function getArmorConfig(cls) {
  if (isSorcererClass(cls))   return { armorCategory: "sorcerer",    canHaveShield: false  };
  if (isWarlockClass(cls))    return { armorCategory: "light",       canHaveShield: false  };
  if (isWizardClass(cls))     return { armorCategory: "sorcerer",    canHaveShield: false  };
  if (isFullCaster(cls))      return { armorCategory: "caster",      canHaveShield: false  };
  if (isDruidClass(cls))      return { armorCategory: "druid",       canHaveShield: "wood" };
  if (isPaladinClass(cls))    return { armorCategory: "heavy",       canHaveShield: true   };
  if (isClericClass(cls))     return { armorCategory: "lightMedium", canHaveShield: true   };
  if (isFighterClass(cls))    return { armorCategory: "heavy",       canHaveShield: true   };
  if (isBarbarianClass(cls))  return { armorCategory: "barbarian",   canHaveShield: true   }; // leggere+medie+no armatura, scudo ok
  if (isMonkClass(cls))       return { armorCategory: "monk",        canHaveShield: false  }; // solo senza armatura, 10+DES+SAG
  if (isRogueClass(cls))      return { armorCategory: "light",       canHaveShield: false  };
  if (isRogueBardClass(cls))  return { armorCategory: "light",       canHaveShield: false  };
  if (isRangerClass(cls))     return { armorCategory: "lightMedium", canHaveShield: true   };
  if (PHYSICAL_CLASSES.some(c => cls.includes(c))) return { armorCategory: "medium", canHaveShield: false };
  if (CASTER_CLASSES.some(c => cls.includes(c)))   return { armorCategory: "caster", canHaveShield: false };
  return { armorCategory: "medium", canHaveShield: false };
}

function getClassKey(charClass) {
  const cls = (charClass || "").toLowerCase();
  if (["barbarian","barbaro"].some(c => cls.includes(c)))                           return "barbarian";
  if (["fighter","guerriero","warrior"].some(c => cls.includes(c)))                 return "fighter";
  if (["paladin","paladino"].some(c => cls.includes(c)))                            return "paladin";
  if (["ranger","cacciatore"].some(c => cls.includes(c)))                           return "ranger";
  if (["bard","bardo"].some(c => cls.includes(c)))                                  return "bard";
  if (["cleric","chierico"].some(c => cls.includes(c)))                             return "cleric";
  if (["druid","druido"].some(c => cls.includes(c)))                                return "druid";
  if (["monk","monaco"].some(c => cls.includes(c)))                                 return "monk";
  if (["rogue","ladro"].some(c => cls.includes(c)))                                 return "rogue";
  if (["warlock"].some(c => cls.includes(c)))                                       return "warlock";
  if (["wizard","mago"].some(c => cls.includes(c)))                                 return "wizard";
  if (["sorcerer","stregone"].some(c => cls.includes(c)))                           return "sorcerer";
  return "fighter";
}

function getHpDice(charClass, classLevels) {
  const classKey = getClassKey(charClass);
  const extraLevels = Math.max(0, (classLevels?.[classKey] ?? 1) - 1);
  return { count: 7 + extraLevels, sides: 10 };
}

// spellLimits: { level: maxSelectable } — lv3+ bloccati nell'arena
const SPELL_LIMITS = {
  wizard:   { 0: 3, 1: 4, 2: 2, 3: 0 },
  sorcerer: { 0: 4, 1: 4, 2: 2, 3: 0 },
  warlock:  { 0: 2, 1: 2, 2: 2, 3: 0, nonCantripMax: 2 },
  druid:    { 0: 2, 1: 4, 2: 2, 3: 0 },
  cleric:   { 0: 3, 1: 4, 2: 2, 3: 0 },
  bard:     { 0: 0, 1: 4, 2: 2, 3: 0 },
  paladin:  { 0: 0, 1: 2, 2: 1, 3: 0 },
  ranger:   { 0: 0, 1: 3, 2: 0, 3: 0 },
  generic:  { 0: 1, 1: 1, 2: 1, 3: 0 },
};

function getLoadoutConfig(charClass) {
  const cls = (charClass || "").toLowerCase();
  const { armorCategory, canHaveShield } = getArmorConfig(cls);
  const sumLimits = (lim) => Object.values(lim).reduce((a, b) => a + b, 0);
  if (isWizardClass(cls))   return { weaponOptions: SIMPLE_WEAPONS,        spellOptions: WIZARD_SPELLS,   spellLimits: SPELL_LIMITS.wizard,   skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.wizard),   autoActions: [RECUPERO_ARCANO_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isSorcererClass(cls)) return { weaponOptions: SIMPLE_WEAPONS,         spellOptions: SORCERER_SPELLS, spellLimits: SPELL_LIMITS.sorcerer, skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.sorcerer), autoActions: [INNATE_SORCERY_PASSIVE, FONTE_DI_MAGIA_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isWarlockClass(cls))  return { weaponOptions: SIMPLE_WEAPONS,         spellOptions: WARLOCK_SPELLS,  spellLimits: SPELL_LIMITS.warlock,  skillOptions: [], maxWeapons: 1, maxSpells: 4,  autoActions: [MAGICAL_CUNNING_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isPaladinClass(cls))  return { weaponOptions: MARTIAL_WEAPONS,        spellOptions: PALADIN_SPELLS,  spellLimits: SPELL_LIMITS.paladin,  skillOptions: [], maxWeapons: 2, maxSpells: sumLimits(SPELL_LIMITS.paladin),  autoActions: [SMITE_ACTION, LAY_OF_HANDS_ACTION],  hasWildShape: false, armorCategory, canHaveShield };
  if (isFighterClass(cls))  return { weaponOptions: [...SIMPLE_WEAPONS, ...MARTIAL_WEAPONS], spellOptions: [], spellLimits: {}, skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [SECOND_WIND_ACTION, ACTION_SURGE_ACTION, CHARGE_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isBarbarianClass(cls))return { weaponOptions: [...SIMPLE_WEAPONS, ...MARTIAL_WEAPONS], spellOptions: [], spellLimits: {}, skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [RAGE_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isClericClass(cls))   return { weaponOptions: CLERIC_WEAPON_OPTIONS,  spellOptions: CLERIC_SPELLS,   spellLimits: SPELL_LIMITS.cleric,   skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.cleric),   autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  if (isDruidClass(cls))    return { weaponOptions: DRUID_WEAPON_OPTIONS,   spellOptions: DRUID_SPELLS,    spellLimits: SPELL_LIMITS.druid,    skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.druid),    autoActions: [], hasWildShape: true,  armorCategory, canHaveShield };
  if (isBardClass(cls))     return { weaponOptions: BARD_WEAPON_OPTIONS,    spellOptions: BARD_SPELLS,     spellLimits: SPELL_LIMITS.bard,     skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.bard),     autoActions: [BARDIC_INSPIRATION_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isMonkClass(cls))     return { weaponOptions: MONK_WEAPON_OPTIONS,     spellOptions: [],              spellLimits: {},                    skillOptions: [], maxWeapons: 1, maxSpells: 0, autoActions: [PUGNO_ACTION, CARICA_PUGNI_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isRogueClass(cls))    return { weaponOptions: ROGUE_WEAPON_OPTIONS,   spellOptions: [],              spellLimits: {},                    skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [SNEAK_ATTACK_ACTION, STEALTH_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isRangerClass(cls))   return { weaponOptions: RANGER_WEAPON_OPTIONS,  spellOptions: RANGER_SPELLS,   spellLimits: SPELL_LIMITS.ranger,   skillOptions: [], maxWeapons: 2, maxSpells: sumLimits(SPELL_LIMITS.ranger),   autoActions: [HUNTER_MARK_ACTION], hasWildShape: false, armorCategory, canHaveShield };
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

// ── BETTING PANEL ─────────────────────────────────────────────────────────────
function BettingPanel({ arenaMeta, snapshots, currentUser, isMaster }) {
  const [userBets, setUserBets] = useState([]);
  const [charCoins, setCharCoins] = useState(0);
  // localBets: matchId -> bet obj — updated synchronously on click, before Firestore confirms
  const [localBets, setLocalBets] = useState({});
  const placedRef = useRef(new Set()); // synchronous guard against double-clicks

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "arena_bets"),
      where("uid", "==", currentUser.uid),
      where("status", "==", "pending"));
    return onSnapshot(q, snap => setUserBets(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(doc(db, "characters", currentUser.uid), snap => {
      if (snap.exists()) setCharCoins(snap.data().arenaCoins ?? 0);
    });
  }, [currentUser]);

  // merge Firestore bets with optimistic local bets
  const existingBet = (matchId) =>
    userBets.find(b => b.matchId === matchId) || localBets[matchId] || null;

  const placeBet = async (type, matchId, targetUid, targetName, amount) => {
    if (placedRef.current.has(matchId)) return; // synchronous block
    if (existingBet(matchId)) return;
    if (charCoins < amount) return alert("Monete Arena insufficienti.");

    // Block immediately — before any await
    placedRef.current.add(matchId);
    const multiplier = type === "tournament" ? 2 : 2;
    // Optimistic local display
    setLocalBets(prev => ({ ...prev, [matchId]: { targetUid, targetName, amount, multiplier } }));

    try {
      await updateDoc(doc(db, "characters", currentUser.uid), { arenaCoins: increment(-amount) });
      await addDoc(collection(db, "arena_bets"), {
        uid: currentUser.uid,
        type, matchId, targetUid, targetName, amount, multiplier,
        status: "pending",
        createdAt: serverTimestamp(),
      });
    } catch {
      // rollback on error
      placedRef.current.delete(matchId);
      setLocalBets(prev => { const n = { ...prev }; delete n[matchId]; return n; });
    }
  };

  const activeMatches = (arenaMeta.matches || []).filter(m => m.status !== "finished" && !m.winner);
  const allFighters = arenaMeta.participants || [];
  const eliminatedUids = new Set(
    (arenaMeta.matches || [])
      .filter(m => m.status === "finished" && m.winner)
      .flatMap(m => m.players.filter(p => p.id !== m.winner).map(p => p.id))
  );
  const bettableFighters = allFighters.filter(uid => !eliminatedUids.has(uid));

  return (
    <div className="betting-panel">
      <div className="betting-header">
        <span className="betting-title">🎲 Scommesse Arena</span>
        <span className="betting-balance">🪙 {charCoins} MA disponibili</span>
      </div>

      {/* Match bets */}
      {activeMatches.length > 0 && (
        <div className="betting-section">
          <p className="betting-section-label">Fight in corso — vittoria x2 (max 1 MA)</p>
          {activeMatches.map(m => {
            const bet = existingBet(m.matchId);
            const bettingOpen = m.players.every(p => p.maxHp > 0 && p.hp >= p.maxHp * 0.5);
            return (
              <div key={m.matchId} className="bet-match-card">
                {!bettingOpen && !bet && (
                  <div className="bet-closed-notice">⚠ Scommesse chiuse — un combattente è sotto il 50% HP</div>
                )}
                <div className="bet-fighters">
                  {m.players.map(p => {
                    const snap = snapshots[p.id] || {};
                    const isBetTarget = bet?.targetUid === p.id;
                    return (
                      <div key={p.id} className={`bet-fighter ${isBetTarget ? "bet-fighter--chosen" : ""}`}>
                        {snap.image && <img src={snap.image} alt="" className="bet-fighter-avatar" />}
                        <span className="bet-fighter-name">{p.name}</span>
                        {!bet && bettingOpen && (
                          <div className="bet-amounts">
                            {[1].map(amt => (
                              <button
                                key={amt}
                                className="bet-amount-btn"
                                disabled={charCoins < amt || placedRef.current.has(m.matchId)}
                                onClick={() => placeBet("match", m.matchId, p.id, p.name, amt)}
                              >
                                {amt}MA
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {bet && (
                  <div className="bet-placed">
                    ✓ Hai scommesso <strong>{bet.amount} MA</strong> su <strong>{bet.targetName}</strong> — possibile vincita: <strong>{bet.amount * bet.multiplier} MA</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tournament bet */}
      {bettableFighters.length > 1 && (() => {
        const tBet = existingBet("tournament");
        return (
          <div className="betting-section">
            <p className="betting-section-label">🏆 Vincitore del torneo — vittoria x2 (max 3 MA)</p>
            {tBet ? (
              <div className="bet-placed">
                ✓ Hai scommesso <strong>{tBet.amount} MA</strong> su <strong>{tBet.targetName}</strong> — possibile vincita: <strong>{tBet.amount * (tBet.multiplier || 2)} MA</strong>
              </div>
            ) : (arenaMeta.currentRound || 1) > 1 ? (
              <div className="bet-closed-notice">⚠ Scommesse sul vincitore chiuse — disponibili solo al Round 1</div>
            ) : (
              <div className="bet-tournament-grid">
                {bettableFighters.map(uid => {
                  const snap = snapshots[uid] || {};
                  return (
                    <div key={uid} className="bet-tournament-fighter">
                      {snap.image && <img src={snap.image} alt="" className="bet-fighter-avatar" />}
                      <span className="bet-fighter-name">{snap.name || uid}</span>
                      <div className="bet-amounts">
                        {[1, 2, 3].map(amt => (
                          <button
                            key={amt}
                            className="bet-amount-btn"
                            disabled={charCoins < amt || placedRef.current.has("tournament")}
                            onClick={() => placeBet("tournament", "tournament", uid, snap.name || uid, amt)}
                          >
                            {amt}MA
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
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

  // Loadout — "idle" | "class-select" | "stat-assign" | "rolling" | "selecting"
  const [loadoutPhase, setLoadoutPhase]     = useState("idle");
  const [charPreview, setCharPreview]       = useState(null);
  const [pendingStats, setPendingStats]     = useState({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
  const [pendingWeapons, setPendingWeapons] = useState([]);
  const [pendingSpells, setPendingSpells]   = useState([]);
  const [pendingSkills, setPendingSkills]   = useState([]);
  const [pendingArmor, setPendingArmor]     = useState(null);
  const [pendingShield, setPendingShield]   = useState(null); // null | "legno" | "metallo"
  const [showWildPicker, setShowWildPicker] = useState(false);
  const [showLayOfHandsPicker, setShowLayOfHandsPicker] = useState(false);
  const [layOfHandsAmt, setLayOfHandsAmt] = useState(1);
  const [showFontePicker, setShowFontePicker] = useState(false);
  const [fonteSelected, setFonteSelected] = useState([]);
  const [showRecuperoPicker, setShowRecuperoPicker] = useState(false);
  const [recuperoLv1Selected, setRecuperoLv1Selected] = useState([]);
  const [recuperoLv2Selected, setRecuperoLv2Selected] = useState([]);
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
        await awardArenaCoins(m.winner, 2);
      }
    }
  };

  // ── Bet resolution ─────────────────────────────────────────────────────────
  const resolveMatchBets = async (matchId, winnerId) => {
    const q = query(collection(db, "arena_bets"), where("matchId", "==", matchId), where("status", "==", "pending"));
    let snap;
    try { snap = await getDocs(q); } catch { return; }
    for (const betDoc of snap.docs) {
      const bet = betDoc.data();
      if (bet.targetUid === winnerId) {
        const payout = bet.amount * bet.multiplier;
        await updateDoc(doc(db, "characters", bet.uid), { arenaCoins: increment(payout) });
        await addDoc(collection(db, "notifications"), {
          userId: bet.uid, read: false, timestamp: serverTimestamp(),
          title: "🎰 Scommessa vinta!",
          message: `Hai scommesso su ${bet.targetName} e hai vinto il fight! Guadagni ${payout} Monete Arena.`,
        });
        await updateDoc(betDoc.ref, { status: "won", payout });
      } else {
        await updateDoc(betDoc.ref, { status: "lost" });
      }
    }
  };

  const resolveTournamentBets = async (winnerId, winnerName) => {
    const q = query(collection(db, "arena_bets"), where("matchId", "==", "tournament"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    for (const betDoc of snap.docs) {
      const bet = betDoc.data();
      if (bet.targetUid === winnerId) {
        const payout = bet.amount * bet.multiplier;
        await updateDoc(doc(db, "characters", bet.uid), { arenaCoins: increment(payout) });
        await addDoc(collection(db, "notifications"), {
          userId: bet.uid, read: false, timestamp: serverTimestamp(),
          title: "🏆 Scommessa sul torneo vinta!",
          message: `${winnerName} ha vinto il torneo! La tua scommessa ti frutta ${payout} Monete Arena.`,
        });
        await updateDoc(betDoc.ref, { status: "won", payout });
      } else {
        await updateDoc(betDoc.ref, { status: "lost" });
      }
    }
  };

  const refundAllBets = async () => {
    const q = query(collection(db, "arena_bets"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    for (const betDoc of snap.docs) {
      const bet = betDoc.data();
      await updateDoc(doc(db, "characters", bet.uid), { arenaCoins: increment(bet.amount) });
      await addDoc(collection(db, "notifications"), {
        userId: bet.uid, read: false, timestamp: serverTimestamp(),
        title: "↩ Scommessa rimborsata",
        message: `L'arena è stata chiusa prima della fine. Ti vengono restituite ${bet.amount} Monete Arena.`,
      });
      await updateDoc(betDoc.ref, { status: "refunded" });
    }
  };

  const resolveBetsForFinishedMatches = async (updatedMatches) => {
    for (const m of updatedMatches) {
      const prev = arenaMeta?.matches?.find(x => x.matchId === m.matchId);
      if (m.status === "finished" && prev?.status !== "finished" && m.winner)
        await resolveMatchBets(m.matchId, m.winner);
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

  // ── STEP 1: carica personaggio → class-select ────────────────────────────
  const openLoadoutPicker = async () => {
    const charSnap = await getDoc(doc(db, "characters", currentUser.uid));
    if (!charSnap.exists()) {
      alert("Non hai ancora una scheda personaggio! Creala nella sezione 'Scheda Personaggio'.");
      return;
    }
    const d = charSnap.data();
    setCharPreview({
      name:        d.name  || "Avventuriero",
      image:       d.image || null,
      class:       "",
      stats:       { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      arenaBuffs:  d.arenaBuffs  || {},
      classLevels: d.classLevels || {},
      rolledHp:    null,
      hpRerollCount: 0,
    });
    setPendingStats({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
    setPendingWeapons([]);
    setPendingSpells([]);
    setPendingSkills([]);
    setLoadoutPhase("class-select");
  };

  // ── STEP 3: tira HP (+CON per dado) ──────────────────────────────────────
  const rollHp = () => {
    const { count, sides } = getHpDice(charPreview.class, charPreview.classLevels);
    const conMod = charPreview.stats.con ?? 0;
    let total = 0;
    for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
    total += conMod * count;
    setCharPreview(prev => ({ ...prev, rolledHp: Math.max(1, total), hpRerollCount: (prev.hpRerollCount || 0) + 1 }));
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

    // Calcolo CA finale: base + DES (cappato) + scudo; se senza armatura (barbaro): 10+DES+COS
    const dexMod    = charPreview.stats.dex ?? 0;
    const conMod    = charPreview.stats.con ?? 0;
    const shieldBonus = pendingShield ? 2 : 0;
    const armorBuffBonus = charPreview.arenaBuffs?.armorBonus ? 1 : 0;
    const unarmoredBonus = pendingArmor.unarmoredStat ? (charPreview.stats[pendingArmor.unarmoredStat] ?? 0) : conMod;
    const finalAc   = pendingArmor.unarmoredDefense
      ? pendingArmor.unarmoredMaxStat
        ? 10 + Math.max(conMod, dexMod) + shieldBonus + armorBuffBonus
        : 10 + dexMod + unarmoredBonus + shieldBonus + armorBuffBonus
      : pendingArmor.baseAc + Math.max(0, Math.min(dexMod, pendingArmor.maxDex)) + shieldBonus + armorBuffBonus;

    const chaScore = charPreview.stats.cha ?? 0;
    const finalActions = [
      ...pendingWeapons, ...pendingSpells, ...pendingSkills,
      ...config.autoActions.map(a =>
        a.special === "bardic_inspiration"
          ? { ...a, maxUses: Math.max(1, chaScore) }
          : a
      ),
    ];
    const selectedItemKeys = Object.entries(pendingItemCounts)
      .flatMap(([k, n]) => Array(n).fill(k))
      .filter(k => !ARENA_ITEMS.find(i => i.key === k)?.shopOnly);
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
    setPendingStats({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
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
      // Warlock mixed-slot budget: max 2 non-cantrip spells regardless of level
      if (lvl > 0 && spellLimits?.nonCantripMax != null) {
        const nonCantripCount = prev.filter(a => (a.level ?? 0) > 0).length;
        if (nonCantripCount >= spellLimits.nonCantripMax) return prev;
      }
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
      return { maxHp: 85, ac: 16, str: 3, dex: 1, con: 2, int: 0, wis: 1, cha: 1 };
    if (["Ranger","Monk"].includes(cls))
      return { maxHp: 75, ac: 15, str: 1, dex: 3, con: 2, int: 0, wis: 2, cha: 0 };
    if (["Rogue"].includes(cls))
      return { maxHp: 70, ac: 15, str: 1, dex: 3, con: 2, int: 1, wis: 1, cha: 2 };
    if (["Wizard"].includes(cls))
      return { maxHp: 60, ac: 13, str: 0, dex: 2, con: 1, int: 3, wis: 1, cha: 0 };
    if (["Sorcerer","Bard","Warlock"].includes(cls))
      return { maxHp: 62, ac: 13, str: 0, dex: 2, con: 1, int: 1, wis: 1, cha: 3 };
    if (["Druid","Cleric"].includes(cls))
      return { maxHp: 70, ac: 14, str: 1, dex: 2, con: 2, int: 0, wis: 3, cha: 1 };
    return { maxHp: 70, ac: 14, str: 2, dex: 2, con: 2, int: 1, wis: 1, cha: 1 };
  };

  const startMasterLoadout = async () => {
    if (!masterJoinName.trim() || !masterJoinClass) return;
    const stats = getMasterDefaultStats(masterJoinClass);
    let classLevels = {};
    try {
      const charSnap = await getDoc(doc(db, "characters", currentUser.uid));
      if (charSnap.exists()) classLevels = charSnap.data().classLevels || {};
    } catch { /* ignore */ }
    setCharPreview({
      name:        masterJoinName.trim(),
      image:       null,
      class:       masterJoinClass,
      stats,
      classLevels,
      rolledHp:    null,
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
  };

  const startTournament = async () => {
    if (arenaMeta.participants.length < 2) return alert("Minimo 2 partecipanti!");
    const shuffled = [...arenaMeta.participants].sort(() => Math.random() - 0.5);
    const matches  = generateMatches(shuffled, 1, arenaMeta.characterSnapshots || {});
    const arenaEndsAt = new Date(Date.now() + 10 * 3600 * 1000).toISOString();
    await updateDoc(doc(db, "arena_meta", "global"), {
      matches, phase: "combat", currentRound: 1, tournamentWinner: null, arenaEndsAt,
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
          const baseHp   = snap.stats?.maxHp ?? 70;
          const startHp  = baseHp + (snap.arenaHpBonus ?? 0);
          const itemUses = {};
          (snap.selectedItemKeys || []).forEach(k => { itemUses[k] = (itemUses[k] || 0) + 1; });
          const shopPotions = snap.arenaBuffs?.healingPotions ?? 0;
          if (shopPotions > 0) itemUses["pozione_cura_media"] = shopPotions;
          const layOfHandsPool = isPaladinClass((snap.class || "").toLowerCase()) ? Math.floor(startHp / 3) : 0;
          return { id, name: snap.name || "Sconosciuto", hp: startHp, maxHp: startHp, init: 0, itemUsesLeft: itemUses, layOfHandsPool };
        }),
        status: "initiative", turn: null, turnExpiry: new Date(Date.now() + ARENA_INITIATIVE_DURATION).toISOString(),
        logs:   ["⚔️ Il match ha inizio!"], winner: null, participantsAwarded: [],
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
    await awardArenaCoins(winnerId, 5);
    await resolveTournamentBets(winnerId, winnerName);
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

    // 1 moneta al primo attacco del giocatore in questo match
    const _currentMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const _alreadyAwarded = (_currentMatch?.participantsAwarded || []).includes(currentUser.uid);
    if (!_alreadyAwarded) await awardArenaCoins(currentUser.uid, 1);

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
      const smiteStrMod = attackerSnap?.stats?.str ?? 0;
      const smiteAidBonus = myMatchPlayer?.aidBuff ? 4 : 0;
      const d20 = Math.floor(Math.random() * 20) + 1;
      const totalHit = d20 + (weaponAction.hitBonus || 0) + smiteStrMod + armorPenalty + smiteAidBonus;
      const isHit = totalHit >= targetAc;
      const isCrit = d20 === 20;
      const critMult = isCrit ? 2 : 1;

      const { total: wDmg, rolls: wRolls } = isHit ? rollDmg(weaponAction.damage) : { total: 0, rolls: "" };
      const { total: sDmg, rolls: sRolls } = isHit ? rollDmg("2d8") : { total: 0, rolls: "" };
      const totalDmg = (wDmg + sDmg + smiteStrMod) * critMult;

      const smiteExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      const hitStr = isHit ? `COLPISCE` : `MANCA`;
      const strPart = smiteStrMod !== 0 ? `+${smiteStrMod} FOR` : "";
      const aidPart = smiteAidBonus ? ` +4 Aiuto` : "";
      const hitInfo = `d20(${d20})+${weaponAction.hitBonus}${strPart}+arm(${armorPenalty})${aidPart}=${totalHit} vs CA ${targetAc}`;
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
            return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), defensiveBonus: 0, aidBuff: false, actionUsesLeft: newUses };
          }
          return p;
        });
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        return { ...m, players, turn: advanceTurn(players, m), turnExpiry: smiteExpiry, participantsAwarded: pa, logs: [...m.logs, log] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return;
    }

    // ── Attacco Furtivo (Rogue) — arma equipaggiata + 1d6 ────────────
    if (action.special === "sneak_attack") {
      const myMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
      const equippedNames = myMatchPlayer?.equippedWeaponNames || [];
      const allWeapons = (attackerSnap?.selectedActions || []).filter(a => a.type === "weapon");
      const weaponAction = allWeapons.find(a => equippedNames.includes(a.name)) || allWeapons[0];
      if (!weaponAction) return;

      const defMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === targetId);
      const shieldSkillBonusDef = (defMatchPlayer?.shieldSkillTurns ?? 0) > 0 ? 3 : 0;
      const targetAc = (defenderSnap?.stats?.ac ?? 10) + shieldSkillBonusDef + (defMatchPlayer?.defensiveBonus ?? 0);
      const dexMod = attackerSnap?.stats?.dex ?? 0;
      const aidBonus = myMatchPlayer?.aidBuff ? 4 : 0;
      const sneakDefStealthed   = (defMatchPlayer?.stealthTurns ?? 0) > 0;
      const sneakSelfStealthed  = (myMatchPlayer?.stealthTurns ?? 0) > 0;
      const sneakHasAdvantage   = sneakSelfStealthed && !sneakDefStealthed;
      const sneakHasDisadvantage = sneakDefStealthed && !sneakSelfStealthed;
      const sneakD20a = Math.floor(Math.random() * 20) + 1;
      const sneakD20b = (sneakHasAdvantage || sneakHasDisadvantage) ? Math.floor(Math.random() * 20) + 1 : 0;
      const d20 = sneakHasAdvantage ? Math.max(sneakD20a, sneakD20b)
                : sneakHasDisadvantage ? Math.min(sneakD20a, sneakD20b)
                : sneakD20a;
      const totalHit = d20 + (weaponAction.hitBonus || 0) + dexMod + armorPenalty + aidBonus;
      const isHit = totalHit >= targetAc;
      const isCrit = d20 === 20;
      const critMult = isCrit ? 2 : 1;

      const { total: wDmg, rolls: wRolls } = isHit ? rollDmg(weaponAction.damage) : { total: 0, rolls: "" };
      const { total: sneakDmg, rolls: sneakRolls } = isHit ? rollDmg("1d6") : { total: 0, rolls: "" };
      const totalDmg = (wDmg + sneakDmg + dexMod + 3) * critMult;

      const sneakExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      const critTag = isCrit ? " ★CRITICO★" : "";
      const dexPart = dexMod !== 0 ? `+${dexMod} DES` : "";
      const aidPart = aidBonus ? ` +4 Aiuto` : "";
      const hitStr = `🎲d20=${d20}${critTag} +${weaponAction.hitBonus} hit ${dexPart}${aidPart}${armorPenalty < 0 ? ` ${armorPenalty} arm.` : ""} = ${totalHit} vs CA ${targetAc}`;
      const log = {
        pub: isHit
          ? `🗡 ${attName} colpisce ${defName} con Attacco Furtivo${critTag} (${totalHit} vs CA ${targetAc}) [🎲${wRolls}+furtivo 🎲${sneakRolls}+${dexMod} DES+3 = ${totalDmg}] — ${totalDmg} danni`
          : `🛡️ ${attName} manca ${defName} con Attacco Furtivo (${totalHit} vs CA ${targetAc})`,
        att: isHit
          ? `🗡 Colpisci ${defName} con Attacco Furtivo [${hitStr}] [arma 🎲${wRolls} + furtivo 🎲${sneakRolls} +${dexMod} DES +3 = ${totalDmg}] — ${totalDmg} danni`
          : `🛡️ Manchi ${defName} con Attacco Furtivo [${hitStr}]`,
        def: isHit
          ? `🗡 ${attName} ti ha colpito con Attacco Furtivo${critTag} — ${totalDmg} danni`
          : `🛡️ ${attName} ti ha mancato con Attacco Furtivo`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };

      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const players = m.players.map(p => {
          if (p.id === targetId) return { ...p, hp: isHit ? Math.max(0, (p.hp ?? 0) - totalDmg) : p.hp, stealthTurns: Math.max(0, (p.stealthTurns ?? 0) - 1) };
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 3)) - 1) };
            return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), defensiveBonus: 0, aidBuff: false, stealthTurns: Math.max(0, (p.stealthTurns ?? 0) - 1), actionUsesLeft: newUses };
          }
          return p;
        });
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        const alive = players.filter(p => p.hp > 0);
        if (alive.length === 1) {
          return { ...m, players, status: "finished", winner: alive[0].id, participantsAwarded: pa, logs: [...m.logs, log, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
        }
        return { ...m, players, turn: advanceTurn(players, m), turnExpiry: sneakExpiry, participantsAwarded: pa, logs: [...m.logs, log] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return;
    }

    // ── Furtività (Rogue) — buff puro, nessun attacco ────────────────
    if (action.special === "stealth") {
      const log = {
        pub: `🌑 ${attName} entra in Furtività — vantaggio per 3 turni, ${defName} in svantaggio`,
        att: `🌑 Entri in Furtività — i tuoi attacchi hanno vantaggio per 3 turni`,
        def: `🌑 ${attName} è scivolato nell'ombra! Sei in svantaggio per 3 turni`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };
      const stealthExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const players = m.players.map(p => {
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
            return { ...p, stealthTurns: 3, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), defensiveBonus: 0, aidBuff: false, actionUsesLeft: newUses };
          }
          return p;
        });
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        return { ...m, players, turnExpiry: stealthExpiry, participantsAwarded: pa, logs: [...m.logs, log] };
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
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: webExpiry, participantsAwarded: pa, logs: [...m.logs, log] };
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
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        const alive = updatedPlayers.filter(p => p.hp > 0);
        if (alive.length === 1) {
          return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
            participantsAwarded: pa, logs: [...m.logs, log, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
        }
        return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: poisonExpiry, participantsAwarded: pa, logs: [...m.logs, log] };
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
    const attackerMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
    const aidBonus           = attackerMatchPlayer?.aidBuff ? 4 : 0;
    const rageDmgBonus       = !isSpellAction && (attackerMatchPlayer?.rageTurns ?? 0) > 0 ? 2 : 0;
    const bardInspirationActive = !!attackerMatchPlayer?.bardicInspirationActive;
    const { total: inspirationBonus, rolls: inspirationRolls } = bardInspirationActive ? rollDmg("1d6") : { total: 0, rolls: "" };
    const magicDetectBonus   = attackerMatchPlayer?.magicDetectActive ? 3 : 0;
    const hunterMarkBonus    = (attackerMatchPlayer?.hunterMarkTurns ?? 0) > 0 ? 3 : 0;
    const blindDebuffPenalty = attackerMatchPlayer?.blindDebuff ? -3 : 0;
    const isBlindDebuff      = action.special === "blind_debuff";
    const defMatchPlayer     = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === targetId);
    const hasSorceryAdvantage = isSorcererClass(attackerClassLower) && isSpellAction;
    const hasAdvantage       = hasSorceryAdvantage || (attackerMatchPlayer?.stealthTurns ?? 0) > 0;
    const hasDisadvantage    = (defMatchPlayer?.stealthTurns ?? 0) > 0;
    const d20a     = Math.floor(Math.random() * 20) + 1;
    const d20b     = (hasAdvantage || hasDisadvantage) ? Math.floor(Math.random() * 20) + 1 : 0;
    const d20      = hasAdvantage && !hasDisadvantage ? Math.max(d20a, d20b)
                   : hasDisadvantage && !hasAdvantage ? Math.min(d20a, d20b)
                   : d20a;
    const hitTotal = d20 + (action.hitBonus || 0) + statMod + armorPenalty + weaponBuff + aidBonus + inspirationBonus + magicDetectBonus + hunterMarkBonus + blindDebuffPenalty;
    const shieldLost       = defenderSnap?.hasShield && defMatchPlayer?.shieldSuppressed;
    const shieldSkillBonus = (defMatchPlayer?.shieldSkillTurns ?? 0) > 0 ? 3 : 0;
    const defensiveAcBonus = defMatchPlayer?.defensiveBonus ?? 0;
    const defAC    = (defenderSnap?.stats?.ac ?? 10) - (shieldLost ? 2 : 0) + shieldSkillBonus + defensiveAcBonus;
    const isCrit   = d20 === 20 && action.type === "spell";
    const isHit    = hitTotal >= defAC;
    const { total: baseDmg, rolls: diceRolls } = isHit ? rollDmg(action.damage) : { total: 0, rolls: "0" };
    // Critico spells: doppio danno
    const critMult = isCrit ? 2 : 1;
    // Weapon poison bonus
    const weaponPoisoned = !!attackerMatchPlayer?.weaponPoisoned;
    const { total: poisonBonusDmg, rolls: poisonRolls } = isHit && weaponPoisoned ? rollDmg("1d12") : { total: 0, rolls: "" };
    // Le armi aggiungono statMod al danno; le spell no (statMod è già usato per colpire)
    const dmgStatMod = isSpellAction ? 0 : statMod;
    const damage   = (isHit && !isBlindDebuff) ? (baseDmg + dmgStatMod + weaponBuff + rageDmgBonus) * critMult + poisonBonusDmg : 0;

    // Log breakdown
    const statPart       = !isSpellAction && action.statKey && statMod !== 0 ? ` +${statMod} ${action.statKey.toUpperCase()}` : '';
    const spellModPart   = isSpellAction && statMod !== 0 ? ` +${statMod} ${spellcastKey?.toUpperCase()}` : '';
    const aidPart        = aidBonus > 0 ? ` +4 Aiuto` : '';
    const penPart        = armorPenalty < 0 ? ` ${armorPenalty} arm.` : '';
    const critTag        = isCrit ? " ★CRITICO★" : "";
    const poisonTag      = poisonBonusDmg > 0 ? ` | veleno 🎲${poisonRolls}=${poisonBonusDmg}` : "";
    const rageTag        = rageDmgBonus > 0 ? ` | furia +${rageDmgBonus}` : "";
    const inspirationTag = inspirationBonus > 0 ? ` +ispirazione 🎵🎲${inspirationRolls}=${inspirationBonus}` : "";
    const magicDetTag    = magicDetectBonus > 0 ? ` +3 🔮det.` : "";
    const advantageTag   = hasAdvantage && !hasDisadvantage ? ` 🌟vant.[${d20a},${d20b}]`
                         : hasDisadvantage && !hasAdvantage ? ` 🌑svant.[${d20a},${d20b}]`
                         : "";
    const hunterMarkTag  = hunterMarkBonus > 0 ? ` +3 🎯marchio` : "";
    const blindPenTag    = blindDebuffPenalty < 0 ? ` ${blindDebuffPenalty} 🙈acc.` : "";
    const critDmgNote    = isCrit ? ` ×2` : "";
    const dmgBreakdown   = (isHit && !isBlindDebuff)
      ? ` [danni: 🎲${diceRolls}${statPart}${critDmgNote}=${baseDmg * critMult + dmgStatMod * critMult}${poisonTag}${rageTag} = ${damage}]`
      : "";
    const hitBreakdown = `🎲d20=${d20}${critTag}${advantageTag} +${action.hitBonus} hit${statPart}${spellModPart}${penPart}${aidPart}${inspirationTag}${magicDetTag}${hunterMarkTag}${blindPenTag} = ${hitTotal} vs CA ${defAC}`;
    const log = {
      pub: isHit
        ? (isBlindDebuff
            ? `🙈 ${attName} accieca ${defName}! (−3 ai tiri per colpire per 1 turno)`
            : `💥 ${attName} colpisce ${defName} con ${action.name}${critTag} (${hitTotal} vs CA ${defAC})${dmgBreakdown} — ${damage} danni`)
        : `🛡️ ${attName} manca ${defName} con ${action.name} (${hitTotal} vs CA ${defAC})`,
      att: isHit
        ? (isBlindDebuff
            ? `🙈 Acceci ${defName}! [${hitBreakdown}] — −3 ai tiri per colpire`
            : `💥 Colpisci ${defName} con ${action.name} [${hitBreakdown}]${dmgBreakdown} — ${damage} danni`)
        : `🛡️ Manchi ${defName} con ${action.name} [${hitBreakdown}]`,
      def: isHit
        ? (isBlindDebuff
            ? `🙈 ${attName} ti ha accecato! −3 ai tuoi tiri per colpire per 1 turno`
            : `⚔️ ${attName} ti ha colpito con ${action.name}${critTag}${dmgBreakdown} — ${damage} danni`)
        : `🛡️ ${attName} ti ha mancato con ${action.name}`,
      attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
    };

    const surgeWasActive = !!(attackerMatchPlayer?.actionSurgeActive);
    const newTurnExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    let updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - damage), blindDebuff: isBlindDebuff && isHit ? true : (p.blindDebuff ?? false), invisible: false, stealthTurns: Math.max(0, (p.stealthTurns ?? 0) - 1) };
        if (p.id === currentUser.uid) {
          const up = { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), defensiveBonus: 0, weaponPoisoned: false, aidBuff: false, actionSurgeActive: false, bardicInspirationActive: false, magicDetectActive: false, blindDebuff: false, invisible: false, stealthTurns: Math.max(0, (p.stealthTurns ?? 0) - 1) };
          if (action.maxUses !== undefined) {
            const prev = p.actionUsesLeft ?? {};
            up.actionUsesLeft = { ...prev, [action.name]: Math.max(0, (prev[action.name] ?? action.maxUses) - 1) };
          }
          return up;
        }
        return { ...p, invisible: false };
      });
      const newParticipantsAwarded = _alreadyAwarded
        ? (m.participantsAwarded || [])
        : [...(m.participantsAwarded || []), currentUser.uid];
      const alive = updatedPlayers.filter(p => p.hp > 0);
      if (alive.length === 1) {
        return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
          participantsAwarded: newParticipantsAwarded,
          logs: [...m.logs, log, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      }
      // If surge was active, this was the extra action — keep turn on same player for one more action; otherwise advance
      const nextTurn = surgeWasActive ? currentUser.uid : advanceTurn(updatedPlayers, m);
      return { ...m, players: updatedPlayers, turn: nextTurn, turnExpiry: newTurnExpiry, participantsAwarded: newParticipantsAwarded, logs: [...m.logs, log] };
    });

    await awardRoundCoins(updatedMatches);
    await resolveBetsForFinishedMatches(updatedMatches);
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

  // ── SECONDO RESPIRO (Fighter) ─────────────────────────────────────────────
  const handleSecondWind = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Guerriero";
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const { total: healAmt, rolls: healRolls } = rollDmg("1d10");
    const totalHeal = healAmt + 5;
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const maxHp = mySnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, hp: Math.min(maxHp, p.hp + totalHeal), shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), defensiveBonus: 0, aidBuff: false, actionUsesLeft: newUses };
      });
      const log = `💨 ${myName} usa Secondo Respiro! Cura 🎲${healRolls}+5=${totalHeal} HP`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── SCATTO D'AZIONE (Fighter) ─────────────────────────────────────────────
  const handleActionSurge = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Guerriero";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, actionSurgeActive: true, actionUsesLeft: newUses };
      });
      const log = `⚡ ${myName} attiva Scatto d'Azione! Guadagna un'azione extra.`;
      // Turn stays on current player
      return { ...m, players: updatedPlayers, turn: currentUser.uid, turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── INDIVIDUAZIONE DEL MAGICO (+3 prossimo tiro per colpire) ─────────────
  const handleMagicDetect = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Bardo";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, magicDetectActive: true, actionUsesLeft: newUses };
      });
      return { ...m, players: updatedPlayers, turn: currentUser.uid, turnExpiry: expiry, logs: [...m.logs, `🔮 ${myName} individua le debolezze magiche! (+3 al prossimo tiro per colpire)`] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── INVISIBILITÀ (il nemico non può attaccare il prossimo turno) ──────────
  const handleInvisibility = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Bardo";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, invisible: true, actionUsesLeft: newUses };
      });
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, `👻 ${myName} svanisce nell'ombra! Il nemico non può attaccare questo turno.`] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── ISPIRAZIONE BARDICA ────────────────────────────────────────────────────
  const handleBardicInspiration = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Bardo";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, bardicInspirationActive: true, actionUsesLeft: newUses };
      });
      const log = `🎵 ${myName} si ispira! +1d6 al prossimo tiro per colpire.`;
      return { ...m, players: updatedPlayers, turn: currentUser.uid, turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── FURIA (Barbarian) ──────────────────────────────────────────────────────
  const handleRage = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Barbaro";
    const log = `🔥 ${myName} entra in Furia! (+2 danno armi per 3 turni)`;
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, rageTurns: 3, actionUsesLeft: newUses };
      });
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── MARCHIO DEL CACCIATORE (Ranger) ───────────────────────────────────────
  const handleHunterMark = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Ranger";
    const log = `🎯 ${myName} segna il bersaglio con il Marchio del Cacciatore! (+3 ai tiri per colpire per 3 turni)`;
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, hunterMarkTurns: 3, actionUsesLeft: newUses };
      });
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── FONTE DI MAGIA (Sorcerer) — ripristina 2 slot magia ──────────────────
  const handleFonteConfirm = async (matchId, fonteAction, selectedSpellNames) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Stregone";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = { ...(p.actionUsesLeft || {}) };
        // Decrement Fonte di Magia charge
        uses[fonteAction.name] = Math.max(0, (uses[fonteAction.name] ?? fonteAction.maxUses) - 1);
        // Restore 1 use for each selected spell
        const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
        selectedSpellNames.forEach(spellName => {
          const spell = (mySnap?.selectedActions || []).find(a => a.name === spellName);
          if (spell?.maxUses) {
            uses[spellName] = Math.min(spell.maxUses, (uses[spellName] ?? spell.maxUses) + 1);
          }
        });
        return { ...p, actionUsesLeft: uses };
      });
      const log = `🔮 ${myName} attinge alla Fonte di Magia! Ripristina: ${selectedSpellNames.join(", ")}`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
    setShowFontePicker(false);
    setFonteSelected([]);
  };

  // ── ASTUZIA MAGICA (Warlock) — salta turno, ripristina tutti gli slot ──────
  const handleMagicalCunning = async (matchId, cunningAction) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Oscuro Cultore";
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = { ...(p.actionUsesLeft || {}) };
        // Consume the Magical Cunning charge
        uses[cunningAction.name] = Math.max(0, (uses[cunningAction.name] ?? cunningAction.maxUses) - 1);
        // Restore all spell slots to their maxUses
        (mySnap?.selectedActions || []).forEach(a => {
          if (a.maxUses && a.level > 0) {
            uses[a.name] = a.maxUses;
          }
        });
        return { ...p, actionUsesLeft: uses };
      });
      const log = `🌀 ${myName} usa Astuzia Magica! Salta il turno e ripristina tutti gli slot magia.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── RECUPERO ARCANO (Wizard) — ripristina 2 slot lv1 + 1 slot lv2 ──────────
  const handleRecuperoArcano = async (matchId, recuperoAction, lv1Names, lv2Names) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Mago";
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = { ...(p.actionUsesLeft || {}) };
        uses[recuperoAction.name] = Math.max(0, (uses[recuperoAction.name] ?? recuperoAction.maxUses) - 1);
        [...lv1Names, ...lv2Names].forEach(spellName => {
          const spell = (mySnap?.selectedActions || []).find(a => a.name === spellName);
          if (spell?.maxUses) uses[spellName] = Math.min(spell.maxUses, (uses[spellName] ?? spell.maxUses) + 1);
        });
        return { ...p, actionUsesLeft: uses };
      });
      const restored = [...lv1Names, ...lv2Names].join(", ");
      const log = `📖 ${myName} usa Recupero Arcano! Ripristina: ${restored}`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
    setShowRecuperoPicker(false);
    setRecuperoLv1Selected([]);
    setRecuperoLv2Selected([]);
  };

  // ── POISON DOT — applica 1d6 veleno senza perdere il turno ──────────────────
  const handleResolvePoisonDoT = async (matchId) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const { total: poisonDmg, rolls: poisonRolls } = rollDmg("1d6");
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        return { ...p, hp: Math.max(0, (p.hp ?? 0) - poisonDmg), poisonDoT: false };
      });
      const log = `☠ ${myName} subisce il veleno: ${poisonDmg} danni [🎲${poisonRolls}]!`;
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── LAY OF HANDS ───────────────────────────────────────────────────────────
  const handleLayOfHands = async (matchId, healAmt) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Paladino";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const maxHp = p.maxHp || p.hp;
        const newHp = Math.min(maxHp, (p.hp || 0) + healAmt);
        const newPool = Math.max(0, (p.layOfHandsPool ?? 0) - healAmt);
        return { ...p, hp: newHp, layOfHandsPool: newPool };
      });
      const log = `🙏 ${myName} usa Lay of Hands → cura sé stesso di ${healAmt} HP`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    setShowLayOfHandsPicker(false);
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── AID BUFF (Aiuto) ────────────────────────────────────────────────────────
  const handleAidBuff = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Paladino";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 1)) - 1) };
        return { ...p, aidBuff: true, actionUsesLeft: newUses };
      });
      const log = `🤝 ${myName} si concentra — +4 al prossimo tiro per colpire!`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
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
          if (p.id === targetId) return { ...p, pendingControlSave: action.special === "corona_pazzia" ? "corona_pazzia" : true };
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
        if (context === "control_spell" || context === "corona_pazzia") {
          const isCorona = p.pendingControlSave === "corona_pazzia" || context === "corona_pazzia";
          delete up.pendingControlSave;
          if (!pass) {
            if (isCorona) {
              // Enemy attacks themselves with their equipped weapon
              const mySnap2 = (arenaMeta.characterSnapshots || {})[currentUser.uid];
              const equippedName = p.equippedWeaponNames?.[0];
              const weapon = (mySnap2?.selectedActions || []).find(a => a.name === equippedName && a.type === "weapon");
              const dmgFormula = weapon?.damage || "1d6";
              const { total: selfDmg, rolls: selfRolls } = rollDmg(dmgFormula);
              up.hp = Math.max(0, (up.hp ?? 0) - selfDmg);
              logMsg += ` — Fallisce! Attacca sé stesso con ${weapon?.icon || "⚔"} ${equippedName || "arma"}: ${selfDmg} danni [🎲${selfRolls}]!`;
            } else {
              logMsg += " — Fallisce! Il turno è perso!";
            }
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
            return { ...p, itemUsesLeft: newUses };
          }
          return { ...p, itemUsesLeft: newUses };
        }
        if (itemKey === "bomba" && p.id === targetId) {
          const { total: dmg, rolls: bombRolls } = rollDmg("2d6");
          log = { pub: `💣 ${myName} lancia una Bomba su ${p.name} [🎲${bombRolls}=${dmg}] — ${dmg} danni!`, ts: _itemTs };
          return { ...p, hp: Math.max(0, p.hp - dmg) };
        }
        if (itemKey === "pozione_veleno" && p.id === targetId) {
          log = { pub: `☠ ${myName} lancia Pozione di Veleno su ${p.name} — subirà 1d6 veleno al prossimo turno!`, ts: _itemTs };
          return { ...p, poisonDoT: true };
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
    await resolveBetsForFinishedMatches(updatedMatches);
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
        const hasPoisonDoT = currentPlayerObj.poisonDoT;
        let autoRolledSave = false;

        const updatedPlayers = match.players.map(p => {
          if (p.id !== currentTurnId) return p;
          let up = { ...p, defensiveBonus: 1, actionSurgeActive: false, bardicInspirationActive: false, magicDetectActive: false, blindDebuff: false, invisible: false, hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1) };
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
          if (hasPoisonDoT) {
            const { total: poisonDmgAuto } = rollDmg("1d6");
            up.hp = Math.max(0, (up.hp ?? 0) - poisonDmgAuto);
            up.poisonDoT = false;
            newLogs2.push(`☠ ${p.name} subisce il veleno automaticamente: ${poisonDmgAuto} danni!`);
            autoRolledSave = true;
          }
          if (hasPendingCtrl) {
            const d20 = Math.floor(Math.random() * 20) + 1;
            const total = d20 + 3;
            const pass = total >= 13;
            const isCorona = p.pendingControlSave === "corona_pazzia";
            if (!pass && isCorona) {
              const snapForAuto = data?.characterSnapshots?.[p.id];
              const equippedNameAuto = p.equippedWeaponNames?.[0];
              const weaponAuto = (snapForAuto?.selectedActions || []).find(a => a.name === equippedNameAuto && a.type === "weapon");
              const { total: selfDmgAuto } = rollDmg(weaponAuto?.damage || "1d6");
              up.hp = Math.max(0, (up.hp ?? 0) - selfDmgAuto);
              newLogs2.push(`🌀 ${p.name} TS Corona della Pazzia automatico: ${d20}+3=${total} vs CD 13 → ❌ FALLISCE — Attacca sé stesso: ${selfDmgAuto} danni!`);
            } else {
              newLogs2.push(`🌀 ${p.name} TS Controllo automatico: ${d20}+3=${total} vs CD 13 → ${pass ? "✅ PASSA" : "❌ FALLISCE — Turno perso!"}`);
            }
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
      if (arenaMeta?.timerPaused) return;
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

  // ── Pause/Resume timers (Master only) ──────────────────────────────────────
  const pauseArenaTimers = async () => {
    await updateDoc(doc(db, "arena_meta", "global"), {
      timerPaused: true,
      pausedAt: new Date().toISOString(),
    });
  };

  const resumeArenaTimers = async () => {
    if (!arenaMeta?.pausedAt) return;
    const elapsed = Date.now() - new Date(arenaMeta.pausedAt).getTime();
    const updatedMatches = (arenaMeta.matches || []).map(m => {
      if (m.status === "finished") return m;
      return {
        ...m,
        turnExpiry: m.turnExpiry
          ? new Date(new Date(m.turnExpiry).getTime() + elapsed).toISOString()
          : m.turnExpiry ?? null,
        fightStartAt: m.fightStartAt
          ? new Date(new Date(m.fightStartAt).getTime() + elapsed).toISOString()
          : m.fightStartAt ?? null,
      };
    });
    await updateDoc(doc(db, "arena_meta", "global"), {
      timerPaused: false,
      pausedAt: null,
      arenaEndsAt: arenaMeta.arenaEndsAt
        ? new Date(new Date(arenaMeta.arenaEndsAt).getTime() + elapsed).toISOString()
        : arenaMeta.arenaEndsAt ?? null,
      matches: updatedMatches,
    });
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  if (!arenaMeta) return <div className="arena-loading">Ingresso nell'Arena...</div>;

  const snapshots        = arenaMeta.characterSnapshots || {};
  const timerRef         = arenaMeta.timerPaused && arenaMeta.pausedAt
    ? new Date(arenaMeta.pausedAt).getTime()
    : Date.now();
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
        {arenaMeta.timerPaused && (
          <span className="phase-tag paused">⏸ Timer in Pausa</span>
        )}
      </div>

      {/* ── SEZIONE SPIEGAZIONE ── */}
      <div className="arena-info-section">
        <button className="arena-info-toggle" onClick={() => setArenaInfoOpen(v => !v)}>
          {arenaInfoOpen ? "▲" : "▼"} Come funziona l'Arena
        </button>
        {arenaInfoOpen && (
          <div className="arena-info-body">

            <h3 className="arena-info-title">⚔ Come funziona l'Arena</h3>
            <ul className="arena-info-list">
              <li>Il Master apre le iscrizioni e approva i partecipanti uno per uno.</li>
              <li>Ogni combattente <strong>crea un personaggio da zero</strong> solo per l'Arena: sceglie classe, distribuisce i punti caratteristica, sceglie armi, armatura, oggetti e tira i propri HP.</li>
              <li>I fight durano al massimo <strong>10 ore</strong>. Ogni giocatore ha <strong>1 ora</strong> per compiere la propria azione; per tirare iniziativa ci sono <strong>10 minuti</strong>. Allo scadere del tempo globale, vince chi ha più HP rimasti.</li>
              <li>Il vincitore di ogni match avanza al turno successivo fino al campione finale.</li>
            </ul>

            <h3 className="arena-info-title">🧙 Creazione del Personaggio</h3>
            <div className="arena-info-example">
              <p><strong>1. Classe:</strong> scegli tra tutte le classi disponibili (Fighter, Rogue, Wizard, Druid…). Ogni classe ha un dado HP, abilità caratteristiche e un set di equipaggiamenti dedicato.</p>
              <p><strong>2. Caratteristiche:</strong> distribuisci i punti stat (FOR, DES, COS, INT, SAG, CAR) liberamente nel limite consentito. Le stat determinano modificatori usati in ogni tiro.</p>
              <p><strong>3. Equipaggiamento:</strong> scegli armi, armatura e oggetti consumabili dal catalogo Arena. Ogni classe ha restrizioni su cosa può equipaggiare.</p>
              <p><strong>4. HP:</strong> tira i tuoi dadi vita — <strong>tutte le classi usano 7d10</strong> (+ modificatore COS per dado). Ogni livello di classe acquistato alla Bottega aggiunge +1d10 al tiro. Hai un numero limitato di reroll.</p>
              <p><strong>Nota:</strong> il personaggio Arena è separato dalla tua scheda principale e non influenza la campagna.</p>
            </div>

            <h3 className="arena-info-title">🎲 Come si combatte</h3>
            <div className="arena-info-example">
              <p><strong>Attacco con arma:</strong> d20 + 3 (competenza) + FOR o DES → se supera la CA avversaria, tiro danno dell'arma + FOR o DES.</p>
              <p><strong>Attacco con incantesimo:</strong> d20 + 3 (competenza) + INT/SAG/CAR (in base alla classe) → se colpisce, danno dell'incantesimo senza modificatore aggiuntivo.</p>
              <p><strong>Esempio:</strong> Fighter (FOR +3) con Spada Lunga (1d8). d20=14 → 14+3+3=20 vs CA 16 → <em>colpo!</em> Danno: 1d8=5+3=<strong>8</strong>.</p>
              <p><strong>Armature:</strong> le armature pesanti danno più CA ma applicano una penalità ai tiri per colpire. Le armature leggere/medie sommano il modificatore DES alla CA base.</p>
            </div>

            <h3 className="arena-info-title">🪙 Monete Arena (MA)</h3>
            <ul className="arena-info-list">
              <li><strong>+1 MA</strong> per aver partecipato all'Arena.</li>
              <li><strong>+2 MA</strong> per ogni round vinto.</li>
              <li><strong>+5 MA</strong> se vinci il torneo.</li>
              <li>Spendile alla <strong>Bottega dell'Arena</strong> per pozioni, armi e armature speciali da usare nei prossimi tornei.</li>
            </ul>

            <h3 className="arena-info-title">💰 Sistema Scommesse</h3>
            <div className="arena-info-example">
              <p>Durante il torneo puoi scommettere le tue <strong>Monete Arena (MA)</strong> sui combattenti usando il pannello Scommesse — anche se non hai partecipato all'arena.</p>
              <p><strong>Scommessa su un match:</strong> scegli il vincitore di un singolo fight — puntata fissa di <strong>1 MA</strong>, vincita <strong>2 MA</strong> (+1 MA profitto).</p>
              <p><strong>Scommessa sul torneo:</strong> scegli chi vincerà l'intero torneo. Puntata da 1, 2 o 3 MA → se azzecchi, ricevi <strong>x2</strong> la puntata.</p>
              <p>Puoi piazzare <strong>una sola scommessa per match</strong> e una sola sul vincitore finale. Le MA vengono scalate subito; la vincita viene accreditata automaticamente a torneo concluso.</p>
              <p><strong>Attenzione:</strong> le scommesse sui singoli match sono aperte solo finché entrambi i combattenti sono sopra il 50% HP. La scommessa sul vincitore del torneo è disponibile <strong>solo durante il Round 1</strong>.</p>
            </div>

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


          {arenaMeta.phase === "combat" && arenaMeta.arenaEndsAt && (
            (() => {
              const msLeft = Math.max(0, new Date(arenaMeta.arenaEndsAt).getTime() - timerRef);
              const h   = Math.floor(msLeft / 3600000);
              const min = Math.floor((msLeft % 3600000) / 60000);
              const sec = Math.floor((msLeft % 60000) / 1000);
              const fmt = `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
              const urgent = msLeft < 3600000;
              return (
                <div className={`fight-global-timer${urgent ? " urgent" : ""}`} style={{ marginBottom: 12 }}>
                  ⏰ Fine Arena: <span className="arena-turn-timer">{fmt}</span>
                  {msLeft === 0 && <span className="fight-timer-note"> — Tempo scaduto!</span>}
                </div>
              );
            })()
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
            {arenaMeta.phase === "combat" && (
              arenaMeta.timerPaused ? (
                <button className="btn-timer-play" onClick={resumeArenaTimers}>
                  ▶ Riprendi Timer
                </button>
              ) : (
                <button className="btn-timer-pause" onClick={pauseArenaTimers}>
                  ⏸ Pausa Timer
                </button>
              )
            )}
            <button className="btn-reset" onClick={async () => {
              await refundAllBets();
              await updateDoc(doc(db, "arena_meta", "global"), {
                phase: "registration", prizes: arenaMeta.prizes || "",
                participants: [], waitingList: [], matches: [],
                characterSnapshots: {}, tournamentWinner: null,
              });
            }}>↺ Reset</button>
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

          {/* ── Fase CLASS-SELECT: scelta classe ── */}
          {loadoutPhase === "class-select" && charPreview && (
            <div className="hp-roll-panel">
              <div className="loadout-char-preview" style={{ justifyContent: "center", marginBottom: 20 }}>
                {charPreview.image && (
                  <img src={charPreview.image} alt={charPreview.name} className="loadout-avatar" />
                )}
                <div>
                  <div className="loadout-char-name">{charPreview.name}</div>
                  <div className="loadout-char-class">Scegli la tua classe</div>
                </div>
              </div>
              <div className="hp-roll-title">Classe</div>
              <div className="class-select-grid">
                {MASTER_JOIN_CLASSES.map(cls => (
                  <button key={cls} className="class-select-btn" onClick={() => {
                    setCharPreview(prev => ({ ...prev, class: cls }));
                    setPendingStats({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
                    setLoadoutPhase("stat-assign");
                  }}>
                    {cls}
                  </button>
                ))}
              </div>
              <button className="btn-cancel-loadout" style={{ marginTop: 18 }} onClick={cancelLoadout}>
                Annulla
              </button>
            </div>
          )}

          {/* ── Fase STAT-ASSIGN: distribuzione punti ── */}
          {loadoutPhase === "stat-assign" && charPreview && (() => {
            const STAT_BUDGET = 10;
            const spent = Object.values(pendingStats).reduce((a, b) => a + b, 0);
            const remaining = STAT_BUDGET - spent;
            const STAT_LABELS = [["str","FOR"],["dex","DES"],["con","COS"],["int","INT"],["wis","SAG"],["cha","CAR"]];
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
                <div className="hp-roll-title">Caratteristiche</div>
                <div className="stat-budget-badge">{remaining > 0 ? `${remaining} punti da assegnare` : "✓ Punti assegnati"}</div>
                <div className="stat-assign-grid">
                  {STAT_LABELS.map(([key, label]) => (
                    <div key={key} className="stat-assign-row">
                      <span className="stat-assign-label">{label}</span>
                      <button
                        className="stat-adj-btn"
                        onClick={() => setPendingStats(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }))}
                        disabled={pendingStats[key] <= 0}
                      >−</button>
                      <span className="stat-assign-val">{pendingStats[key] >= 0 ? "+" : ""}{pendingStats[key]}</span>
                      <button
                        className="stat-adj-btn"
                        onClick={() => setPendingStats(prev => ({ ...prev, [key]: Math.min(3, prev[key] + 1) }))}
                        disabled={pendingStats[key] >= 3 || remaining <= 0}
                      >+</button>
                    </div>
                  ))}
                </div>
                <div className="hp-roll-buttons">
                  <button className="btn-cancel-loadout" onClick={() => setLoadoutPhase("class-select")}>← Classe</button>
                  <button
                    className="btn-join"
                    disabled={remaining !== 0}
                    onClick={() => {
                      setCharPreview(prev => ({ ...prev, stats: { ...pendingStats } }));
                      setLoadoutPhase("rolling");
                    }}
                  >
                    {remaining > 0 ? `Mancano ${remaining} punti` : remaining < 0 ? "Troppi punti" : "Continua →"}
                  </button>
                </div>
                <button className="btn-cancel-loadout" style={{ marginTop: 12 }} onClick={cancelLoadout}>
                  Annulla
                </button>
              </div>
            );
          })()}

          {/* ── Fase ROLLING: tiro HP ── */}
          {loadoutPhase === "rolling" && charPreview && (() => {
            const { count, sides } = getHpDice(charPreview.class, charPreview.classLevels);
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

                <div className="hp-roll-title">Punti Vita</div>
                <div className="hp-dice-formula">{count}d{sides}{charPreview.stats.con > 0 ? ` + ${charPreview.stats.con * count} (COS)` : ""}</div>

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
            const conMod   = charPreview.stats.con ?? 0;
            const previewAc = pendingArmor
              ? pendingArmor.unarmoredDefense
                ? pendingArmor.unarmoredMaxStat
                  ? 10 + Math.max(dexMod, conMod) + (pendingShield ? 2 : 0)
                  : 10 + dexMod + (pendingArmor.unarmoredStat ? (charPreview.stats[pendingArmor.unarmoredStat] ?? 0) : conMod) + (pendingShield ? 2 : 0)
                : pendingArmor.baseAc + Math.max(0, Math.min(dexMod, pendingArmor.maxDex)) + (pendingShield ? 2 : 0)
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
                                : lvl > 0 && config.spellLimits?.nonCantripMax != null
                                  ? <><span className={`spell-level-badge lv${lvl}`}>{LEVEL_LABELS[lvl]}</span><span className="spell-level-count">{pendingSpells.filter(s => (s.level ?? 0) > 0).length}/{config.spellLimits.nonCantripMax} slot totali</span></>
                                  : <><span className={`spell-level-badge lv${lvl}`}>{LEVEL_LABELS[lvl]}</span><span className="spell-level-count">{selectedAtLevel}/{limit}</span></>
                              }
                            </div>
                            <div className="loadout-grid">
                              {spellsOfLevel.map(item => {
                                const isSelected = pendingSpells.some(a => a.name === item.name);
                                const atLevelLimit = !isSelected && selectedAtLevel >= limit;
                                const nonCantripBudgetFull = !isSelected && lvl > 0 && config.spellLimits?.nonCantripMax != null
                                  && pendingSpells.filter(s => (s.level ?? 0) > 0).length >= config.spellLimits.nonCantripMax;
                                const isDisabled = isLocked || atLevelLimit || nonCantripBudgetFull;
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
                    const con = charPreview.stats.con ?? 0;
                    const dexContrib = Math.max(0, Math.min(dex, armor.maxDex));
                    const acPreview = armor.unarmoredDefense
                      ? armor.unarmoredMaxStat ? 10 + Math.max(dex, con) : 10 + dex + (armor.unarmoredStat ? (charPreview.stats[armor.unarmoredStat] ?? 0) : con)
                      : armor.baseAc + dexContrib;
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
                        {ARENA_ITEMS.filter(item => !item.shopOnly).map(item => {
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
                  ⚔ Crea il tuo Personaggio
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

      {/* ── SCOMMESSE (non partecipanti + master) ── */}
      {arenaMeta.phase === "combat" && (!isRegistered || isMaster) && currentUser && (
        <BettingPanel
          arenaMeta={arenaMeta}
          snapshots={snapshots}
          currentUser={currentUser}
          isMaster={isMaster}
        />
      )}

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
            const pendingPoisonDoT = !!myPlayer?.poisonDoT;
            const hasPendingSave = pendingDexSave || pendingConSave || pendingControlSave || pendingPoisonDoT;
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
                      const msLeft = Math.max(0, new Date(m.turnExpiry).getTime() - timerRef);
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
                      const msLeft = Math.max(0, new Date(m.turnExpiry).getTime() - timerRef);
                      const min = Math.floor(msLeft / 60000);
                      const sec = Math.floor((msLeft % 60000) / 1000);
                      const fmt = `${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
                      const urgent = msLeft < 20000;
                      return <span className={`arena-turn-timer${urgent ? " urgent" : ""}`}>{fmt}</span>;
                    })()}
                  </div>
                )}

                {m.status === "active" && m.fightStartAt && (() => {
                  const msLeft = Math.max(0, new Date(m.fightStartAt).getTime() + ARENA_FIGHT_DURATION - timerRef);
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
                          {p.aidBuff && (
                            <div className="fighter-aid-badge">🤝 Aiuto (+4 hit)</div>
                          )}
                          {(p.rageTurns ?? 0) > 0 && (
                            <div className="fighter-rage-badge">🔥 Furia (+2 danno · {p.rageTurns} turni)</div>
                          )}
                          {(p.hunterMarkTurns ?? 0) > 0 && (
                            <div className="fighter-rage-badge">🎯 Marchio ({p.hunterMarkTurns} turni · +3 hit)</div>
                          )}
                          {p.actionSurgeActive && (
                            <div className="fighter-surge-badge">⚡ Scatto d'Azione (azione extra!)</div>
                          )}
                          {p.bardicInspirationActive && (
                            <div className="fighter-bard-badge">🎵 Ispirazione (+1d6 hit)</div>
                          )}
                          {p.magicDetectActive && (
                            <div className="fighter-bard-badge">🔮 Det. Magico (+3 hit)</div>
                          )}
                          {p.blindDebuff && (
                            <div className="fighter-blind-badge">🙈 Accecato (−3 attacco)</div>
                          )}
                          {p.invisible && (
                            <div className="fighter-invisible-badge">👻 Invisibile</div>
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

                    {/* ── Lay of Hands ── */}
                    {(() => {
                      const mySnap = snapshots[currentUser?.uid];
                      const isPaladino = isPaladinClass((mySnap?.class || "").toLowerCase());
                      if (!isPaladino) return null;
                      const pool = myPlayer?.layOfHandsPool ?? 0;
                      const myHp = myPlayer?.hp ?? 0;
                      const maxHp = myPlayer?.maxHp ?? 0;
                      const maxHeal = Math.min(pool, maxHp - myHp);
                      if (showLayOfHandsPicker) {
                        return (
                          <div className="lay-of-hands-picker">
                            <div className="loh-title">🙏 Lay of Hands — Pozza: {pool} HP</div>
                            <div className="loh-controls">
                              <button className="stat-adj-btn" onClick={() => setLayOfHandsAmt(a => Math.max(1, a - 1))} disabled={layOfHandsAmt <= 1}>−</button>
                              <span className="loh-amount">{layOfHandsAmt} HP</span>
                              <button className="stat-adj-btn" onClick={() => setLayOfHandsAmt(a => Math.min(maxHeal, a + 1))} disabled={layOfHandsAmt >= maxHeal}>+</button>
                            </div>
                            <div className="loh-buttons">
                              <button className="btn-cancel-wild" onClick={() => setShowLayOfHandsPicker(false)}>Annulla</button>
                              <button className="btn-join" style={{ padding: "6px 18px", fontSize: "0.88rem" }}
                                onClick={() => handleLayOfHands(m.matchId, layOfHandsAmt)}
                                disabled={layOfHandsAmt < 1 || maxHeal <= 0}>
                                Cura {layOfHandsAmt} HP
                              </button>
                            </div>
                          </div>
                        );
                      }
                      if (pool <= 0) {
                        return <div className="btn-wild-shape exhausted">🙏 Lay of Hands — Pozza esaurita</div>;
                      }
                      return (
                        <button className="btn-wild-shape" onClick={() => { setLayOfHandsAmt(Math.min(1, maxHeal)); setShowLayOfHandsPicker(true); }}
                          disabled={maxHeal <= 0}>
                          🙏 Lay of Hands <span className="ws-uses-tag">Pozza: {pool} HP</span>
                        </button>
                      );
                    })()}

                    {/* ── Fonte di Magia (Sorcerer) ── */}
                    {(() => {
                      const mySnap = snapshots[currentUser?.uid];
                      const isStregone = isSorcererClass((mySnap?.class || "").toLowerCase());
                      if (!isStregone) return null;
                      const fonteAction = (mySnap?.selectedActions || []).find(a => a.special === "fonte_di_magia");
                      if (!fonteAction) return null;
                      const usesLeft = myPlayer?.actionUsesLeft?.[fonteAction.name] ?? fonteAction.maxUses;
                      const noUses = usesLeft <= 0;
                      // Spells that have been partially or fully depleted
                      const depleteableSpells = (mySnap?.selectedActions || []).filter(a => {
                        if (!a.maxUses) return false;
                        const used = myPlayer?.actionUsesLeft?.[a.name] ?? a.maxUses;
                        return used < a.maxUses;
                      });
                      if (showFontePicker) {
                        return (
                          <div className="lay-of-hands-picker">
                            <div className="loh-title">🔮 Fonte di Magia — Scegli 2 slot da ripristinare ({2 - fonteSelected.length} rimasti)</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "8px 0" }}>
                              {depleteableSpells.length === 0
                                ? <span style={{ opacity: 0.6 }}>Nessun slot esaurito</span>
                                : depleteableSpells.map(sp => {
                                    const cur = myPlayer?.actionUsesLeft?.[sp.name] ?? sp.maxUses;
                                    const isSel = fonteSelected.includes(sp.name);
                                    return (
                                      <button key={sp.name}
                                        className={`equip-weapon-btn ${isSel ? "sel" : ""}`}
                                        disabled={!isSel && fonteSelected.length >= 2}
                                        onClick={() => setFonteSelected(prev =>
                                          isSel ? prev.filter(n => n !== sp.name) : [...prev, sp.name]
                                        )}>
                                        {sp.icon} {sp.name} ({cur}/{sp.maxUses})
                                      </button>
                                    );
                                  })
                              }
                            </div>
                            <div className="loh-buttons">
                              <button className="btn-cancel-wild" onClick={() => { setShowFontePicker(false); setFonteSelected([]); }}>Annulla</button>
                              <button className="btn-join" style={{ padding: "6px 18px", fontSize: "0.88rem" }}
                                disabled={fonteSelected.length === 0}
                                onClick={() => handleFonteConfirm(m.matchId, fonteAction, fonteSelected)}>
                                Ripristina ({fonteSelected.length}/2)
                              </button>
                            </div>
                          </div>
                        );
                      }
                      if (noUses) {
                        return <div className="btn-wild-shape exhausted">🔮 Fonte di Magia — Cariche esaurite</div>;
                      }
                      return (
                        <button className="btn-wild-shape" onClick={() => { setShowFontePicker(true); setFonteSelected([]); }}>
                          🔮 Fonte di Magia <span className="ws-uses-tag">{usesLeft}/{fonteAction.maxUses} cariche</span>
                        </button>
                      );
                    })()}

                    {/* ── Astuzia Magica (Warlock) ── */}
                    {(() => {
                      const mySnap = snapshots[currentUser?.uid];
                      const isWarlock = isWarlockClass((mySnap?.class || "").toLowerCase());
                      if (!isWarlock) return null;
                      const cunningAction = (mySnap?.selectedActions || []).find(a => a.special === "magical_cunning");
                      if (!cunningAction) return null;
                      const usesLeft = myPlayer?.actionUsesLeft?.[cunningAction.name] ?? cunningAction.maxUses;
                      const noUses = usesLeft <= 0;
                      if (noUses) return <div className="btn-wild-shape exhausted">🌀 Astuzia Magica — Esaurita</div>;
                      return (
                        <button className="btn-wild-shape" onClick={() => handleMagicalCunning(m.matchId, cunningAction)}>
                          🌀 Astuzia Magica <span className="ws-uses-tag">{usesLeft}/{cunningAction.maxUses} uso</span>
                        </button>
                      );
                    })()}

                    {/* ── Recupero Arcano (Wizard) ── */}
                    {(() => {
                      const mySnap = snapshots[currentUser?.uid];
                      const isMago = isWizardClass((mySnap?.class || "").toLowerCase());
                      if (!isMago) return null;
                      const recuperoAction = (mySnap?.selectedActions || []).find(a => a.special === "recupero_arcano");
                      if (!recuperoAction) return null;
                      const usesLeft = myPlayer?.actionUsesLeft?.[recuperoAction.name] ?? recuperoAction.maxUses;
                      const noUses = usesLeft <= 0;
                      const allSpells = mySnap?.selectedActions || [];
                      const deplLv1 = allSpells.filter(a => a.maxUses && (a.level ?? 0) === 1 && (myPlayer?.actionUsesLeft?.[a.name] ?? a.maxUses) < a.maxUses);
                      const deplLv2 = allSpells.filter(a => a.maxUses && (a.level ?? 0) === 2 && (myPlayer?.actionUsesLeft?.[a.name] ?? a.maxUses) < a.maxUses);
                      if (showRecuperoPicker) {
                        return (
                          <div className="lay-of-hands-picker">
                            <div className="loh-title">📖 Recupero Arcano — Scegli fino a 2 slot Lv1 e 1 slot Lv2</div>
                            <div style={{ marginBottom: "6px", fontSize: "0.82rem", opacity: 0.8 }}>Lv1 ({recuperoLv1Selected.length}/2):</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                              {deplLv1.length === 0
                                ? <span style={{ opacity: 0.5, fontSize: "0.82rem" }}>Nessun slot lv1 esaurito</span>
                                : deplLv1.map(sp => {
                                    const cur = myPlayer?.actionUsesLeft?.[sp.name] ?? sp.maxUses;
                                    const isSel = recuperoLv1Selected.includes(sp.name);
                                    return (
                                      <button key={sp.name} className={`equip-weapon-btn ${isSel ? "sel" : ""}`}
                                        disabled={!isSel && recuperoLv1Selected.length >= 2}
                                        onClick={() => setRecuperoLv1Selected(prev => isSel ? prev.filter(n => n !== sp.name) : [...prev, sp.name])}>
                                        {sp.icon} {sp.name} ({cur}/{sp.maxUses})
                                      </button>
                                    );
                                  })}
                            </div>
                            <div style={{ marginBottom: "6px", fontSize: "0.82rem", opacity: 0.8 }}>Lv2 ({recuperoLv2Selected.length}/1):</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                              {deplLv2.length === 0
                                ? <span style={{ opacity: 0.5, fontSize: "0.82rem" }}>Nessun slot lv2 esaurito</span>
                                : deplLv2.map(sp => {
                                    const cur = myPlayer?.actionUsesLeft?.[sp.name] ?? sp.maxUses;
                                    const isSel = recuperoLv2Selected.includes(sp.name);
                                    return (
                                      <button key={sp.name} className={`equip-weapon-btn ${isSel ? "sel" : ""}`}
                                        disabled={!isSel && recuperoLv2Selected.length >= 1}
                                        onClick={() => setRecuperoLv2Selected(prev => isSel ? prev.filter(n => n !== sp.name) : [...prev, sp.name])}>
                                        {sp.icon} {sp.name} ({cur}/{sp.maxUses})
                                      </button>
                                    );
                                  })}
                            </div>
                            <div className="loh-buttons">
                              <button className="btn-cancel-wild" onClick={() => { setShowRecuperoPicker(false); setRecuperoLv1Selected([]); setRecuperoLv2Selected([]); }}>Annulla</button>
                              <button className="btn-join" style={{ padding: "6px 18px", fontSize: "0.88rem" }}
                                disabled={recuperoLv1Selected.length === 0 && recuperoLv2Selected.length === 0}
                                onClick={() => handleRecuperoArcano(m.matchId, recuperoAction, recuperoLv1Selected, recuperoLv2Selected)}>
                                Ripristina
                              </button>
                            </div>
                          </div>
                        );
                      }
                      if (noUses) return <div className="btn-wild-shape exhausted">📖 Recupero Arcano — Esaurito</div>;
                      return (
                        <button className="btn-wild-shape" onClick={() => { setShowRecuperoPicker(true); setRecuperoLv1Selected([]); setRecuperoLv2Selected([]); }}>
                          📖 Recupero Arcano <span className="ws-uses-tag">{usesLeft}/{recuperoAction.maxUses} uso</span>
                        </button>
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
                        <p className="save-block-label">
                          {pendingControlSave === "corona_pazzia"
                            ? "🌀 Corona della Pazzia! TS SAG (CD 13) — se fallisci attacchi te stesso!"
                            : "🌀 Tiro Salvezza contro Spell di Controllo! (CD 13)"}
                        </p>
                        <button className="btn-saving-throw" onClick={() => rollSavingThrow(m.matchId, null, pendingControlSave === "corona_pazzia" ? "corona_pazzia" : "control_spell")}>
                          🎲 TS Controllo
                        </button>
                      </div>
                    )}

                    {/* ── Veleno DoT — risolvi prima di agire ── */}
                    {!pendingDexSave && !pendingConSave && !pendingControlSave && pendingPoisonDoT && (
                      <div className="save-block con">
                        <p className="save-block-label">☠ Sei avvelenato! Subisci 1d6 danni da veleno — poi puoi agire.</p>
                        <button className="btn-saving-throw" onClick={() => handleResolvePoisonDoT(m.matchId)}>
                          🎲 Subisci danno da veleno
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
                            return (
                              <button
                                key={w.name}
                                className={`equip-weapon-btn ${isSel ? "sel" : ""}`}
                                onClick={() => {
                                  setEquipSelections(prev => {
                                    const cur = prev[m.matchId] !== undefined ? prev[m.matchId] : [];
                                    if (isSel) return { ...prev, [m.matchId]: cur.filter(n => n !== w.name) };
                                    // 2H: replace all — only this weapon
                                    if (w.twoHanded) return { ...prev, [m.matchId]: [w.name] };
                                    // 1H: remove any 2H already selected, then add this
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
                        const skillActions  = currentActions.filter(a => (a.type === "skill" || a.type === "passive") && !(action => action.special === "deathblow" && targetHpPct > 20)(a));
                        const spellGroups   = [0, 1, 2, 3].map(lvl => ({
                          lvl,
                          spells: currentActions.filter(a => a.type === "spell" && a.level === lvl),
                        })).filter(g => g.spells.length > 0);
                        const LEVEL_LABELS = { 0: "Trucchetti", 1: "Livello 1", 2: "Livello 2", 3: "Livello 3" };

                        const renderActionBtn = (action) => {
                          if (action.type === "passive") {
                            return (
                              <div key={action.name} className="btn-action passive" title={action.info}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">Passiva</span>
                              </div>
                            );
                          }
                          if (action.special === "fonte_di_magia") return null; // rendered in outer block
                          if (action.special === "magical_cunning") return null; // rendered in outer block
                          if (action.special === "recupero_arcano") return null; // rendered in outer block
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
                          if (action.special === "control" || action.special === "corona_pazzia") {
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
                          if (action.special === "bardic_inspiration") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.bardicInspirationActive;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? "Già attiva" : noUses ? "Cariche esaurite" : "+1d6 al prossimo tiro per colpire"}
                                onClick={() => !noUses && !alreadyActive && handleBardicInspiration(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attiva" : noUses ? "Esaurita" : "+1d6 hit"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "magic_detect") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.magicDetectActive;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? "Già attivo" : noUses ? "Cariche esaurite" : "+3 al prossimo tiro per colpire"}
                                onClick={() => !noUses && !alreadyActive && handleMagicDetect(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attivo" : noUses ? "Esaurito" : "+3 hit"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "invisibility") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.invisible;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? "Già invisibile" : noUses ? "Usi esauriti" : "Il nemico non può attaccarti il prossimo turno"}
                                onClick={() => !noUses && !alreadyActive && handleInvisibility(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attiva" : noUses ? "Esaurita" : "1 turno"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "second_wind") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses ? "no-uses" : ""}`}
                                disabled={noUses}
                                title={noUses ? "Usi esauriti" : "Cura 1d10+5 HP"}
                                onClick={() => !noUses && handleSecondWind(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">1d10+5 cura</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "action_surge") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.actionSurgeActive;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? "Già attivo" : noUses ? "Usi esauriti" : "Guadagna un'azione extra questo turno"}
                                onClick={() => !noUses && !alreadyActive && handleActionSurge(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attivo" : noUses ? "Esaurito" : "+1 azione"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "rage") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = (myPlayer?.rageTurns ?? 0) > 0;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? "Furia già attiva" : noUses ? "Cariche esaurite" : "+2 danno armi per 3 turni"}
                                onClick={() => !noUses && !alreadyActive && handleRage(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.rageTurns} turni` : noUses ? "Esaurita" : "+2 danno · 3 turni"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "hunter_mark") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = (myPlayer?.hunterMarkTurns ?? 0) > 0;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? "Marchio già attivo" : noUses ? "Cariche esaurite" : "+3 ai tiri per colpire per 3 turni"}
                                onClick={() => !noUses && !alreadyActive && handleHunterMark(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.hunterMarkTurns} turni` : noUses ? "Esaurito" : "+3 hit · 3 turni"}</span>
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
                          if (action.special === "aid_buff") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.aidBuff;
                            return (
                              <button key={action.name} className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? "Già attivo" : noUses ? "Usi esauriti" : "+4 al prossimo tiro per colpire"}
                                onClick={() => !noUses && !alreadyActive && handleAidBuff(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attivo" : noUses ? "Esaurito" : "+4 hit"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "lay_of_hands") {
                            const pool = myPlayer?.layOfHandsPool ?? 0;
                            return null; // rendered separately outside renderActionBtn
                          }
                          const usesLeft = action.maxUses !== undefined
                            ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses)
                            : null;
                          const noUsesLeft = usesLeft !== null && usesLeft <= 0;
                          const isWeapon   = action.type === "weapon";
                          const isEquipped = !isWeapon || wildShapeForm || equippedNames.includes(action.name);
                          const targetIsInvisible = m.players.find(p => p.id === chosenTargetId)?.invisible ?? false;
                          const isOffensive = action.special !== "heal" && action.special !== "shield_buff" && action.special !== "aid_buff";
                          const disabledByInvis = targetIsInvisible && isOffensive && isEquipped;
                          const stealthTurnsLeft = action.special === "stealth" ? (myPlayer?.stealthTurns ?? 0) : 0;
                          const isStealthActive = stealthTurnsLeft > 0;
                          return (
                            <button
                              key={action.name}
                              className={`btn-action ${action.type} ${isWeapon && !wildShapeForm ? (isEquipped ? "equipped" : "unequipped") : ""} ${noUsesLeft || disabledByInvis || isStealthActive ? "no-uses" : ""} ${isDeathblow ? "deathblow-ready" : ""} ${action.special === "smite" && !noUsesLeft ? "smite-active" : ""} ${isStealthActive ? "stealth-active" : ""}`}
                              disabled={noUsesLeft || disabledByInvis || isStealthActive}
                              title={isStealthActive
                                ? `🌑 Furtività attiva — ${stealthTurnsLeft} turno/i rimasti`
                                : noUsesLeft
                                ? `${action.name} — Usi esauriti`
                                : disabledByInvis ? "👻 Bersaglio invisibile — solo guarigione disponibile"
                                : action.special === "web" ? "Ragnatela — TS DES bersaglio"
                                : action.special === "poison" ? `Veleno — ${action.damage} danni + TS COS`
                                : action.special === "deathblow" ? `Colpo Mortale — ${action.damage} +DES (solo ≤20% HP)`
                                : action.special === "stealth" ? `Furtività — attiva vantaggio 3 turni · nemico svantaggio 3 turni`
                                : !isEquipped ? "Clicca per impugnare (spende il turno)"
                                : `+${action.hitBonus}${action.statKey ? ` +${action.statKey.toUpperCase()}` : ""} | ${action.damage}${action.statKey ? ` +${action.statKey.toUpperCase()}` : ""}`}
                              onClick={() => {
                                if (noUsesLeft || disabledByInvis || isStealthActive) return;
                                isEquipped
                                  ? handleAttack(m.matchId, chosenTargetId, action)
                                  : handleSwitchWeapon(m.matchId, action.name);
                              }}
                            >
                              <span className="action-icon">{action.icon}</span>
                              <span className="action-name">{action.name}</span>
                              <span className="action-dice">
                                {isStealthActive ? `🌑 ${stealthTurnsLeft}t attiva`
                                  : noUsesLeft ? "Esaurito"
                                  : disabledByInvis ? "👻 Invisibile"
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
                            const needsTarget = key === "bomba" || key === "pozione_veleno";
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
