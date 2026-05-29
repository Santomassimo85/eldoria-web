import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { db } from "../firebase";
import {
  doc, getDoc, getDocs, onSnapshot, updateDoc, setDoc, deleteDoc,
  arrayUnion, arrayRemove, addDoc, collection, serverTimestamp,
  runTransaction, increment, query, where,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { showD20Roll } from "../components/DiceRoll";
import { awardPetPoints } from "../utils/pet";
import "./Arena.css";
import "./ArenaHero.css";

/* FIX: P5b/P5c/P5d — reusable modal portal */
function ArenaModal({ open, onClose, title, children, variant = "modal" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  const overlayClass =
    variant === "drawer" ? "arena-drawer-overlay"
    : variant === "combat" ? "arena-combat-overlay"
    : "arena-modal-overlay";
  const dialogClass =
    variant === "drawer" ? "arena-drawer-dialog"
    : variant === "combat" ? "arena-combat-dialog"
    : "arena-modal-dialog";
  return createPortal(
    <div className={overlayClass} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={dialogClass} onClick={(e) => e.stopPropagation()}>
        {variant === "drawer" && <span className="arena-drawer-handle" aria-hidden="true" />}
        <header className="arena-modal-header">
          <h3 className="arena-modal-title">{title}</h3>
          <button type="button" className="arena-modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </header>
        <div className="arena-modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ── WIZARD SPELLS (Mago) — pool: 6 trucchetti · 8 lv1 · 5 lv2 · 3 lv3 (sceglie 3+4+2)
const WIZARD_SPELLS = [
  // ── Trucchetti ──────────────────────────────────────────────────────────────
  { name: "Dardo di Fuoco",        level: 0, hitBonus: 3, damage: "1d10",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco", maxUses: 4 },
  { name: "Tocco Gelido",          level: 0, hitBonus: 3, damage: "1d8",   statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Necrotico", maxUses: 4 },
  { name: "Spruzzo Velenoso",      level: 0, hitBonus: 3, damage: "1d12",  statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Veleno", maxUses: 4 },
  { name: "Scossa Folgorante",     level: 0, hitBonus: 3, damage: "1d8",   statKey: null, type: "spell", icon: "⚡", info: "Trucchetto · Fulmine", maxUses: 4 },
  { name: "Raggio di Gelo",        level: 0, hitBonus: 3, damage: "1d8",   statKey: null, type: "spell", icon: "🧊", info: "Trucchetto · Freddo", maxUses: 4 },
  { name: "Lama Vorticosa",        level: 0, hitBonus: 3, damage: "1d8",   statKey: null, type: "spell", icon: "🌀", info: "Trucchetto · Tuono · mischia", maxUses: 4 },
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Dardo Incantato",       level: 1, hitBonus: 3,  damage: "3d4",   statKey: null, type: "spell", icon: "✨", info: "Lv1 · Forza · TS DES", maxUses: 4 },
  { name: "Mani Brucianti",        level: 1, hitBonus: 3,  damage: "3d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv1 · Fuoco", maxUses: 4 },
  { name: "Scudo",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 2 },
  { name: "Sonno",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "😴", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 4 },
  { name: "Colpo Cromatico",       level: 1, hitBonus: 3,  damage: "3d8",   statKey: null, type: "spell", icon: "🌈", info: "Lv1 · Magico", maxUses: 4 },
  { name: "Onda Tonante",          level: 1, hitBonus: 3,  damage: "2d8",   statKey: null, type: "spell", icon: "💨", info: "Lv1 · Tuono", maxUses: 4 },
  { name: "Raggio Avvelenato",     level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🤢", info: "Lv1 · TS COS · 2d6 veleno a inizio turno per 2 turni", special: "save_dot", saveDotAbility: "con", saveDotDamage: "2d6", saveDotTurns: 2, maxUses: 4 },
  { name: "Assorbire Elementi",    level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🔰", info: "Lv1 · +3 ai prossimi 3 TS (difesa elementale)", special: "save_buff", tsBonus: 3, tsAttacks: 3, maxUses: 2 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Raggio Rovente",        level: 2, hitBonus: 3, damage: "6d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco (3 raggi × 2d6)", maxUses: 2 },
  { name: "Frantumare",            level: 2, hitBonus: 3, damage: "3d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Invisibilità",          level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "👻", info: "Lv2 · Il nemico non può attaccarti il prossimo turno", special: "invisibility", maxUses: 2 },
  { name: "Cecità/Sordità",        level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🙈", info: "Lv2 · −3 ai tiri per colpire del nemico", special: "blind_debuff", maxUses: 2 },
  { name: "Tocco Vampirico",       level: 2, hitBonus: 3, damage: "3d6",   statKey: null, type: "spell", icon: "🩸", info: "Lv2 · Necrotico · cura 1d8 in caso di danno", vampiric: true, vampiricHeal: "1d8", maxUses: 2 },
  // ── Livello 3 (bloccati — sbloccabili con Potenziamento) ──────────────────
  { name: "Palla di Fuoco",        level: 3, hitBonus: 3, damage: "8d6",   statKey: null, type: "spell", icon: "💥", info: "Lv3 · Fuoco", maxUses: 1 },
  { name: "Fulmine",               level: 3, hitBonus: 3, damage: "8d6",   statKey: null, type: "spell", icon: "⚡", info: "Lv3 · Fulmine", maxUses: 1 },
  { name: "Contrincantesimo",      level: 3, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🚫", info: "Lv3 · Controllo · TS o perdi 2 turni", special: "control", maxUses: 1 },
];

// ── SORCERER SPELLS (Stregone) — pool: 4 trucchetti · 4 lv1 · 3 lv2 (sceglie 4+4+2)
const SORCERER_SPELLS = [
  { name: "Dardo di Fuoco",        level: 0, hitBonus: 3,  damage: "1d10",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco", maxUses: 4 },
  { name: "Scossa Folgorante",     level: 0, hitBonus: 3,  damage: "1d8",   statKey: null, type: "spell", icon: "⚡",  info: "Trucchetto · Fulmine", maxUses: 4 },
  { name: "Gelidito",              level: 0, hitBonus: 3,  damage: "1d8",   statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Freddo", maxUses: 4 },
  { name: "Spruzzo Velenoso",      level: 0, hitBonus: 3,  damage: "1d12",  statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Veleno", maxUses: 4 },
  { name: "Mani Brucianti",        level: 1, hitBonus: 3,  damage: "2d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv1 · Fuoco", maxUses: 3 },
  { name: "Dardo Incantato",       level: 1, hitBonus: 3,  damage: "3d4",   statKey: null, type: "spell", icon: "✨", info: "Lv1 · Forza · TS DES", maxUses: 3 },
  { name: "Scudo",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 2 },
  { name: "Sonno",                 level: 1, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "😴", info: "Lv1 · Controllo · TS o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Raggio Rovente",        level: 2, hitBonus: 3,  damage: "4d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco (2 raggi × 2d6)", maxUses: 2 },
  { name: "Frantumare",            level: 2, hitBonus: 3,  damage: "2d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Suggestione",           level: 2, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "🌀", info: "Lv2 · Controllo · TS o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Palla di Fuoco",        level: 3, hitBonus: 3,  damage: "8d6",   statKey: null, type: "spell", icon: "💥", info: "Lv3 · Fuoco", maxUses: 1 },
  { name: "Fulmine",               level: 3, hitBonus: 3,  damage: "8d6",   statKey: null, type: "spell", icon: "⚡", info: "Lv3 · Fulmine", maxUses: 1 },
  { name: "Paura",                 level: 3, hitBonus: 0,  damage: "—",     statKey: null, type: "spell", icon: "😱", info: "Lv3 · Controllo · TS o perdi 2 turni", special: "control", maxUses: 1 },
];

// ── WARLOCK SPELLS (Oscuro Cultore) — pool: 4 trucchetti · 5 lv1 · 4 lv2 (sceglie 2 trucchetti + 2 slot lv1/lv2 misti)
const WARLOCK_SPELLS = [
  // ── Trucchetti ──────────────────────────────────────────────────────────────
  { name: "Deflagrazione Occulta",  level: 0, hitBonus: 3, damage: "1d10", statKey: null, type: "spell", icon: "🟣", info: "Trucchetto · Forza", maxUses: 4 },
  { name: "Rintocco Funebre",       level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "🔔", info: "Trucchetto · Necrotico · 1d8 (1d12 se nemico ferito)", damageWhenHurt: "1d12", maxUses: 4 },
  { name: "Spruzzo Velenoso",       level: 0, hitBonus: 3, damage: "1d12", statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Veleno", maxUses: 4 },
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Braccia di Hadar",       level: 1, hitBonus: 3, damage: "2d6",  statKey: null, type: "spell", icon: "🐙", info: "Lv1 · Necrotico", maxUses: 2 },
  { name: "Malocchio",              level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "👁", info: "Lv1 · Controllo · TS o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Scudo",                  level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 2 },
  { name: "Rappresaglia Infernale", level: 1, hitBonus: 3, damage: "2d10", statKey: null, type: "spell", icon: "🔥", info: "Lv1 · Fuoco · risposta ai danni", maxUses: 2 },
  { name: "Charme su Persone",      level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🫦", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 2 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Frantumare",             level: 2, hitBonus: 3, damage: "3d8",  statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Blocca Persone",         level: 2, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🧊", info: "Lv2 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Corona della Pazzia",    level: 2, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🌀", info: "Lv2 · Controllo · TS SAG o attacca sé stesso", special: "corona_pazzia", maxUses: 2 },
  { name: "Oscurità",               level: 2, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🌑", info: "Lv2 · Svantaggio ai tiri per colpire del nemico per 3 turni", special: "disadvantage_enemy", disadvantageTurns: 3, maxUses: 2 },
];

// ── DRUID SPELLS (Druido) — 2 trucchetti · 4 lv1 · 2 lv2
const DRUID_SPELLS = [
  // ── Trucchetti ──────────────────────────────────────────────────────────────
  { name: "Frusta di Spine",    level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🌿", info: "Trucchetto · Perforante", maxUses: 4 },
  { name: "Produrre Fiamma",    level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco", maxUses: 4 },
  { name: "Spruzzo Velenoso",   level: 0, hitBonus: 3, damage: "1d12", statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Veleno", maxUses: 4 },
  { name: "Infestazione",       level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🐜", info: "Trucchetto · Veleno", maxUses: 4 },
  { name: "Morso di Gelo",      level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Freddo", maxUses: 4 },
  { name: "Schianto di Tuono",  level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "⚡", info: "Trucchetto · Tuono", maxUses: 4 },
  { name: "Guida",              level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "⭐", info: "Trucchetto · +1 ai prossimi 3 attacchi", special: "magic_detect", buffBonus: 1, buffAttacks: 3, maxUses: 4 },
  { name: "Resistenza",         level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🔰", info: "Trucchetto · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 4 },
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Cura Ferite",        level: 1, hitBonus: 0, damage: "1d8",   statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 2 },
  { name: "Parola Guaritrice",  level: 1, hitBonus: 0, damage: "1d4",   statKey: null, type: "spell", icon: "💙", info: "Lv1 · Cura rapida · ripristina HP", special: "heal", maxUses: 2 },
  { name: "Onda Tonante",       level: 1, hitBonus: 3, damage: "2d8",   statKey: null, type: "spell", icon: "💨", info: "Lv1 · Tuono", maxUses: 2 },
  { name: "Intralciare",        level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌱", info: "Lv1 · Controllo · TS FOR o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Luci Fatate",        level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🧚", info: "Lv1 · +2 ai prossimi 2 attacchi", special: "magic_detect", buffBonus: 2, buffAttacks: 2, maxUses: 2 },
  { name: "Coltello di Ghiaccio",level:1, hitBonus: 3, damage: "1d10",  statKey: null, type: "spell", icon: "🧊", info: "Lv1 · Freddo", maxUses: 2 },
  { name: "Charme su Persone",  level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🫦", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Assorbire Elementi", level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 ai prossimi 3 TS (difesa elementale)", special: "save_buff", tsBonus: 3, tsAttacks: 3, maxUses: 2 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Riscaldare Arma",    level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🔩", info: "Lv2 · Il nemico non può attaccare con armi per 2 turni", special: "weapon_lock", weaponLockTurns: 2, maxUses: 2 },
  { name: "Frantumare",         level: 2, hitBonus: 3, damage: "3d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 2 },
  { name: "Blocca Persone",     level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🧲", info: "Lv2 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Raggio di Luna",     level: 2, hitBonus: 3, damage: "2d10",  statKey: null, type: "spell", icon: "🌙", info: "Lv2 · Radiante", maxUses: 2 },
  { name: "Scorza Coriacea",    level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🪵", info: "Lv2 · +3 CA per 3 turni", special: "shield_buff", maxUses: 2 },
  { name: "Lama di Fiamma",     level: 2, hitBonus: 3, damage: "3d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco", maxUses: 2 },
];

// ── CLERIC SPELLS (Chierico) — 3 trucchetti · 4 lv1 · 2 lv2
const CLERIC_SPELLS = [
  // ── Trucchetti ──────────────────────────────────────────────────────────────
  { name: "Fiamma Sacra",       level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "✨", info: "Trucchetto · Radiante", maxUses: 4 },
  { name: "Rintocco dei Morti", level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "💀", info: "Trucchetto · Necrotico", maxUses: 4 },
  { name: "Parola di Splendore",level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🌟", info: "Trucchetto · Radiante", maxUses: 4 },
  { name: "Infestazione",       level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🐜", info: "Trucchetto · Veleno", maxUses: 4 },
  { name: "Guida",              level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "⭐", info: "Trucchetto · +1 ai prossimi 3 attacchi", special: "magic_detect", buffBonus: 1, buffAttacks: 3, maxUses: 4 },
  { name: "Resistenza",         level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🔰", info: "Trucchetto · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 4 },
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Cura Ferite",        level: 1, hitBonus: 0, damage: "1d8",   statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Parola Guaritrice",  level: 1, hitBonus: 0, damage: "1d4",   statKey: null, type: "spell", icon: "💙", info: "Lv1 · Cura rapida · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Dardo Guidato",      level: 1, hitBonus: 3, damage: "2d6",   statKey: null, type: "spell", icon: "🌟", info: "Lv1 · Radiante", maxUses: 3 },
  { name: "Infliggi Ferite",    level: 1, hitBonus: 3, damage: "3d10",  statKey: null, type: "spell", icon: "🩸", info: "Lv1 · Necrotico", maxUses: 3 },
  { name: "Scudo della Fede",   level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 2 },
  { name: "Comando",            level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "📯", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Disgrazia",          level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌑", info: "Lv1 · Svantaggio agli attacchi del nemico per 2 turni", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 3 },
  { name: "Benedire",           level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "✨", info: "Lv1 · Vantaggio ai tuoi attacchi per 2 turni", special: "self_advantage", advantageTurns: 2, maxUses: 3 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Arma Spirituale",        level: 2, hitBonus: 3, damage: "1d8+4", statKey: null, type: "spell", icon: "⚔",  info: "Lv2 · Forza", maxUses: 2 },
  { name: "Ristorare Inferiore",    level: 2, hitBonus: 0, damage: "1d4+2", statKey: null, type: "spell", icon: "💊", info: "Lv2 · Rimuove condizioni + cura 1d4+2 HP", special: "heal", maxUses: 2 },
  { name: "Blocca Persone",         level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🧊", info: "Lv2 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Aiuto",                  level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🤝", info: "Lv2 · +1 ai prossimi 2 attacchi", special: "magic_detect", buffBonus: 1, buffAttacks: 2, maxUses: 2 },
  { name: "Cecità/Sordità",         level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🙈", info: "Lv2 · Svantaggio agli attacchi del nemico per 2 turni", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 2 },
  { name: "Preghiera di Guarigione",level: 2, hitBonus: 0, damage: "2d8",   statKey: null, type: "spell", icon: "🙏", info: "Lv2 · Cura potente · ripristina HP", special: "heal", maxUses: 2 },
];

// ── BARD SPELLS (Bardo) — niente trucchetti · 4 lv1 · 2 lv2
const BARD_SPELLS = [
  // ── Livello 1 ──────────────────────────────────────────────────────────────
  { name: "Parola Guaritrice",          level: 1, hitBonus: 0, damage: "1d4",   statKey: null, type: "spell", icon: "💙", info: "Lv1 · Cura rapida · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Charme su Persone",          level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🫦", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Risata Incontenibile",       level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🤣", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Individuazione del Magico",  level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🔮", info: "Lv1 · +3 al prossimo tiro per colpire", special: "magic_detect", maxUses: 3 },
  // ── Livello 2 ──────────────────────────────────────────────────────────────
  { name: "Frastornare",                level: 2, hitBonus: 3, damage: "4d8",   statKey: null, type: "spell", icon: "💥", info: "Lv2 · Tuono", maxUses: 3 },
  { name: "Cecità/Sordità",             level: 2, hitBonus: 3, damage: "—",     statKey: null, type: "spell", icon: "🙈", info: "Lv2 · −3 ai tiri per colpire del nemico", special: "blind_debuff", maxUses: 2 },
  { name: "Invisibilità",               level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "👻", info: "Lv2 · Il nemico non può attaccarti per 2 turni", special: "invisibility", invisibilityDuration: 2, maxUses: 2 },
  { name: "Suggestione",                level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌀", info: "Lv2 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 2 },
  { name: "Melodia Curativa",           level: 1, hitBonus: 0, damage: "2d8",   statKey: null, type: "spell", icon: "🎶", info: "Lv1 · Cura · 2d8 + CAR HP", special: "heal", healModStat: "cha", maxUses: 2 },
];

// ── PALADIN SPELLS (Paladino) — pool: 3 lv1 · 3 lv2 (sceglie 2+1)
const PALADIN_SPELLS = [
  { name: "Cura Ferite",           level: 1, hitBonus: 0, damage: "1d8",   statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Punizione Travolgente", level: 1, hitBonus: 3, damage: "1d6",   statKey: null, type: "spell", icon: "⚡", info: "Lv1 · Radiante bonus", maxUses: 3 },
  { name: "Comando",               level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "📞", info: "Lv1 · Controllo · TS o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Punizione Marchiante",  level: 2, hitBonus: 3, damage: "2d6",   statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Radiante", maxUses: 2 },
  { name: "Ristorare Inferiore",   level: 2, hitBonus: 0, damage: "1d4+2", statKey: null, type: "spell", icon: "💊", info: "Lv2 · Rimuove condizioni + cura 1d4+2 HP", special: "heal", maxUses: 2 },
  { name: "Aiuto",                 level: 2, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🤝", info: "Lv2 · +2 ai prossimi 3 attacchi", special: "magic_detect", buffBonus: 2, buffAttacks: 3, maxUses: 2 },
];

// ── RANGER SPELLS (Ranger) — pool: 6 lv1 (sceglie 3)
const RANGER_SPELLS = [
  { name: "Cura Ferite",           level: 1, hitBonus: 0, damage: "1d8",   statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · ripristina HP", special: "heal", maxUses: 3 },
  { name: "Intralciare",           level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌱", info: "Lv1 · Controllo · TS FOR o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Grandine di Spine",     level: 1, hitBonus: 3, damage: "1d10",  statKey: null, type: "spell", icon: "🌵", info: "Lv1 · Perforante · bonus attacco ranged", maxUses: 3 },
  { name: "Colpo Intralciante",    level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🕸", info: "Lv1 · Controllo · TS FOR o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Nebbia",                level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "🌫", info: "Lv1 · Svantaggio ai tiri per colpire del nemico per 3 turni", special: "disadvantage_enemy", disadvantageTurns: 3, maxUses: 3 },
  { name: "Passo Spedito",         level: 1, hitBonus: 0, damage: "—",     statKey: null, type: "spell", icon: "💨", info: "Lv1 · Doppio turno il prossimo turno", special: "extra_turn", maxUses: 3 },
];

// ── ARMI SEMPLICI ──────────────────────────────────────────────────────
// damageType: "contundente" | "perforante" | "tagliente" (D&D 5e)
const SIMPLE_WEAPONS = [
  { name: "Daga",             hitBonus: 3, damage: "1d4",  statKey: "dex", type: "weapon", icon: "🗡", twoHanded: false, damageType: "perforante" },
  { name: "Randello",         hitBonus: 3, damage: "1d4",  statKey: "str", type: "weapon", icon: "🏏", twoHanded: false, damageType: "contundente" },
  { name: "Ascetta",          hitBonus: 3, damage: "1d6",  statKey: "str", type: "weapon", icon: "🪓", twoHanded: false, damageType: "tagliente" },
  { name: "Giavellotto",      hitBonus: 3, damage: "1d6",  statKey: "str", type: "weapon", icon: "🎯", twoHanded: false, damageType: "perforante" },
  { name: "Martello Leggero", hitBonus: 3, damage: "1d4",  statKey: "str", type: "weapon", icon: "🔨", twoHanded: false, damageType: "contundente" },
  { name: "Mazza",            hitBonus: 3, damage: "1d6",  statKey: "str", type: "weapon", icon: "🏏", twoHanded: false, damageType: "contundente" },
  { name: "Bastone Ferrato",  hitBonus: 3, damage: "1d8",  statKey: "str", type: "weapon", icon: "🪄", twoHanded: true,  damageType: "contundente" },
  { name: "Falcetto",         hitBonus: 3, damage: "1d4",  statKey: "dex", type: "weapon", icon: "⚔",  twoHanded: false, damageType: "tagliente" },
  { name: "Lancia",           hitBonus: 3, damage: "1d8",  statKey: "str", type: "weapon", icon: "🔱", twoHanded: false, damageType: "perforante" },
  { name: "Arco Corto",       hitBonus: 3, damage: "1d6",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true,  damageType: "perforante" },
  { name: "Balestra Leggera", hitBonus: 3, damage: "1d8",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true,  damageType: "perforante" },
  { name: "Dardo",            hitBonus: 3, damage: "1d4",  statKey: "dex", type: "weapon", icon: "🎯", twoHanded: false, damageType: "perforante" },
  { name: "Fionda",           hitBonus: 3, damage: "1d4",  statKey: "str", type: "weapon", icon: "⭕",  twoHanded: false, damageType: "contundente" },
];

// ── ARMI MARZIALI ─────────────────────────────────────────────────────
const MARTIAL_WEAPONS = [
  { name: "Ascia da Battaglia",  hitBonus: 3, damage: "1d10", statKey: "str", type: "weapon", icon: "🪓", twoHanded: false, damageType: "tagliente" },
  { name: "Flagello",            hitBonus: 3, damage: "1d8",  statKey: "str", type: "weapon", icon: "⚔",  twoHanded: false, damageType: "contundente" },
  { name: "Alabarda",            hitBonus: 3, damage: "1d10", statKey: "str", type: "weapon", icon: "⚔",  twoHanded: true,  damageType: "tagliente" },
  { name: "Spadone",             hitBonus: 3, damage: "2d6",  statKey: "str", type: "weapon", icon: "⚔",  twoHanded: true,  damageType: "tagliente" },
  { name: "Maglio",              hitBonus: 3, damage: "2d6",  statKey: "str", type: "weapon", icon: "🔨", twoHanded: true,  damageType: "contundente" },
  { name: "Ascia Bipenne",       hitBonus: 3, damage: "1d12", statKey: "str", type: "weapon", icon: "🪓", twoHanded: true,  damageType: "tagliente" },
  { name: "Lancia da Cavaliere", hitBonus: 3, damage: "1d12", statKey: "str", type: "weapon", icon: "🏇", twoHanded: true,  damageType: "perforante" },
  { name: "Spada Lunga",         hitBonus: 3, damage: "1d10", statKey: "str", type: "weapon", icon: "⚔",  twoHanded: false, damageType: "tagliente" },
  { name: "Martello da Guerra",  hitBonus: 3, damage: "1d10", statKey: "str", type: "weapon", icon: "🔨", twoHanded: false, damageType: "contundente" },
  { name: "Morgenstern",         hitBonus: 3, damage: "1d8",  statKey: "str", type: "weapon", icon: "⚙",  twoHanded: false, damageType: "perforante" },
  { name: "Stocco",              hitBonus: 3, damage: "1d8",  statKey: "dex", type: "weapon", icon: "🗡", twoHanded: false, damageType: "perforante" },
  { name: "Scimitarra",          hitBonus: 3, damage: "1d6",  statKey: "dex", type: "weapon", icon: "⚔",  twoHanded: false, damageType: "tagliente" },
  { name: "Spada Corta",         hitBonus: 3, damage: "1d6",  statKey: "dex", type: "weapon", icon: "⚔",  twoHanded: false, damageType: "perforante" },
  { name: "Tridente",            hitBonus: 3, damage: "1d8",  statKey: "str", type: "weapon", icon: "🔱", twoHanded: false, damageType: "perforante" },
  { name: "Frusta",              hitBonus: 3, damage: "1d4",  statKey: "dex", type: "weapon", icon: "⛓",  twoHanded: false, damageType: "tagliente" },
  { name: "Arco Lungo",          hitBonus: 3, damage: "1d8",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true,  damageType: "perforante" },
  { name: "Balestra Pesante",    hitBonus: 3, damage: "1d10", statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true,  damageType: "perforante" },
  { name: "Balestra a Mano",     hitBonus: 3, damage: "1d6",  statKey: "dex", type: "weapon", icon: "🏹", twoHanded: false, damageType: "perforante" },
];

// ── Set armi per classe (derivati dagli array base) ───────────────────────────────
const _sw = (n) => SIMPLE_WEAPONS.find(w => w.name === n);
const _mw = (n) => MARTIAL_WEAPONS.find(w => w.name === n);
const CLERIC_WEAPON_OPTIONS  = SIMPLE_WEAPONS;
const DRUID_WEAPON_OPTIONS   = SIMPLE_WEAPONS;
const BARD_WEAPON_OPTIONS    = [...SIMPLE_WEAPONS, _mw("Stocco")].filter(Boolean);
// Il Ladro combatte a due armi (mano1 + mano2): niente armi a due mani.
const ROGUE_WEAPON_OPTIONS   = [...SIMPLE_WEAPONS, _mw("Stocco"), _mw("Scimitarra"), _mw("Spada Corta"), _mw("Frusta"), _mw("Balestra a Mano")].filter(Boolean).filter(w => !w.twoHanded);
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
// HP della forma = tiro vero del dado (vedi handleWildShape), non massimo teorico.
const WILD_SHAPES = {
  wolf: {
    name: "Lupo", icon: "🐺",
    ac: 14,
    hpDice: { count: 3, sides: 12 },
    actions: [
      { name: "Artiglio", damage: "1d6"  , statKey: "str", type: "weapon", icon: "🐾", hitBonus: 3 },
      { name: "Morso",    damage: "1d6"  , statKey: "str", type: "weapon", icon: "🦷", hitBonus: 3 },
    ],
  },
  bear: {
    name: "Orso", icon: "🐻",
    ac: 16,
    hpDice: { count: 5, sides: 12 },
    actions: [
      { name: "Artiglio", damage: "1d6"  , statKey: "str", type: "weapon", icon: "🐾", hitBonus: 3 },
      { name: "Morso",    damage: "1d4"  , statKey: "str", type: "weapon", icon: "🦷", hitBonus: 3 },
    ],
  },
  spider: {
    name: "Ragno", icon: "🕷",
    ac: 12,
    hpDice: { count: 3, sides: 12 },
    actions: [
      { name: "Morso",     level: 0, damage: "1d4"  , statKey: "str", type: "weapon", icon: "🦷", hitBonus: 3 },
      { name: "Veleno",    level: 0, damage: "—",     statKey: null,  type: "spell",  icon: "☠",  hitBonus: 0, special: "save_dot", saveDotAbility: "con", saveDotDamage: "1d8", saveDotTurns: 3, saveDotDC: 12, maxUses: 3 },
      { name: "Ragnatela", level: 0, damage: "—",     statKey: null,  type: "spell",  icon: "🕸", hitBonus: 0, special: "web",    saveAbility: "str", saveDC: 13, maxUses: 3 },
    ],
  },
};

// Helper: AC of a player accounting for an active wild-shape form.
// When the druid is transformed, the form's AC overrides the character's base AC.
function getEffectiveAc(matchPlayer, charSnapshot) {
  const baseAc = charSnapshot?.stats?.ac ?? 10;
  if (matchPlayer?.wildShape && WILD_SHAPES[matchPlayer.wildShape]?.ac != null) {
    return WILD_SHAPES[matchPlayer.wildShape].ac;
  }
  return baseAc;
}

// Carica del Guerriero — aggiunto automaticamente (max 3 cariche)
const CHARGE_ACTION = {
  name: "Carica", hitBonus: 3, damage: "2d6", statKey: "str",
  type: "skill", icon: "⚔", info: "2d6+FOR · 3 cariche", maxUses: 3,
};

// Secondo Respiro (Fighter) — cura 1d12+5, 3 usi
const SECOND_WIND_ACTION = {
  name: "Secondo Respiro", hitBonus: 0, damage: "1d12", statKey: null,
  type: "skill", icon: "💨", info: "Cura 1d12+5 · 3 usi", special: "second_wind", maxUses: 3,
};

// Scatto d'Azione (Fighter) — Bonus Action: guadagna un'azione extra questo turno, 3 cariche
const ACTION_SURGE_ACTION = {
  name: "Scatto d'Azione", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "⚡", info: "Bonus Action · azione extra questo turno · 3 cariche", special: "action_surge", maxUses: 3, bonusAction: true,
};

// Disarmare (Fighter) — disarma il nemico: non può attaccare con armi per 3 turni
const DISARM_ACTION = {
  name: "Disarmare", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🪓", info: "Disarma il nemico: non può attaccare con armi per 3 turni · 2 cariche",
  special: "weapon_lock", weaponLockTurns: 3, maxUses: 2,
};

// Presenza Possente (Fighter) — passiva: se tiri 1 al tiro per colpire, ritira il dado
const PRESENZA_POSSENTE_PASSIVE = {
  name: "Presenza Possente", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "👑", info: "Passiva · se tiri 1 al tiro per colpire, ritira il dado",
};

// Critico Migliorato (Fighter) — passiva: critico anche con 19
const CRITICO_MIGLIORATO_PASSIVE = {
  name: "Critico Migliorato", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "💥", info: "Passiva · critico con 19 e 20 (non solo 20)",
};

// Colpo Mortale (Rogue) — aggiunto automaticamente (max 2 usi, solo ≤20% HP)
const DEATHBLOW_ACTION = {
  name: "Colpo Mortale", hitBonus: 3, damage: "4d6"  , statKey: "dex",
  type: "skill", icon: "💀", info: "Solo ≤20% HP · +DES", special: "deathblow", maxUses: 2,
};

// Attacco Furtivo (Rogue) — arma equipaggiata + 1d6, 3 cariche
const SNEAK_ATTACK_ACTION = {
  name: "Attacco Furtivo", hitBonus: 0, damage: "1d6", statKey: null,
  type: "skill", icon: "🗡", info: "Arma+1d6+DES · 3 cariche", special: "sneak_attack", maxUses: 3,
};

// Furtività (Rogue) — buff puro: vantaggio ai propri 3 attacchi, 3 cariche
const STEALTH_ACTION = {
  name: "Furtività", hitBonus: 0, damage: "", statKey: null,
  type: "skill", icon: "🌑", info: "Attiva Furtività · vantaggio ai tuoi prossimi 3 attacchi · 3 cariche", special: "stealth", maxUses: 3,
};

// Triboli (Rogue) — applica svantaggio + sanguinamento (1d6/turno) per 3 turni
const TRIBOLI_ACTION = {
  name: "Triboli", hitBonus: 0, damage: "", statKey: null,
  type: "skill", icon: "🪤",
  info: "Sparge triboli · svantaggio agli attacchi e sanguinamento (1d6/turno) per 3 turni · 2 cariche",
  special: "triboli",
  disadvantageTurns: 3,
  bleedTurns: 3,
  bleedDice: "1d6",
  maxUses: 2,
};

// Ispirazione Bardica — cariche = modificatore CAR (impostate dinamicamente al join)
const BARDIC_INSPIRATION_ACTION = {
  name: "Ispirazione Bardica", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🎵", info: "Bonus Action · +1d6 al prossimo tiro per colpire · cariche = CAR",
  special: "bardic_inspiration", maxUses: 1, bonusAction: true,
};

// Furia (Barbarian) — aggiunto automaticamente (4 cariche, +2 danno armi per 3 turni)
const RAGE_ACTION = {
  name: "Furia", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🔥", info: "Bonus Action · +2 danno armi per 3 turni · 4 cariche",
  special: "rage", maxUses: 4, bonusAction: true,
};

// Turbine di Lame (Barbarian) — 2 attacchi rapidi, 2d10+FOR+3 totali
const TURBINE_LAME_ACTION = {
  name: "Turbine di Lame", hitBonus: 3, damage: "2d10"  , statKey: "str",
  type: "skill", icon: "🌪", info: "2 attacchi rapidi · 2d10+FOR+3 · 2 cariche",
  special: "turbine_lame", maxUses: 2,
};

// Attacco Poderoso (Barbarian) — 2d8+FOR + vantaggio per 3 turni, 2 cariche
const MIGHTY_STRIKE_ACTION = {
  name: "Attacco Poderoso", hitBonus: 3, damage: "2d8", statKey: "str",
  type: "skill", icon: "💪", info: "2d8+FOR · concede vantaggio per 3 turni · 2 cariche",
  grantsAdvTurns: 3, maxUses: 2,
};

// Pugno (Monk) — attacco a mani nude, 1d6+DES, sempre disponibile
const PUGNO_ACTION = {
  name: "Pugno", hitBonus: 3, damage: "1d6", statKey: "dex",
  type: "skill", icon: "👊", info: "Colpo a mani nude · 1d6+DES", damageType: "contundente",
};
// Carica di Pugni (Monk) — 2 pugni consecutivi, 2d6+DES, 2 usi
const CARICA_PUGNI_ACTION = {
  name: "Carica di Pugni", hitBonus: 3, damage: "2d6", statKey: "dex",
  type: "skill", icon: "💥", info: "2 colpi a mani nude · 2d6+DES · 2 usi", maxUses: 2, damageType: "contundente",
};

// Concentrazione (Monk) — Bonus Action: +4 danni per 2 turni, 2 cariche
const CONCENTRAZIONE_ACTION = {
  name: "Concentrazione", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🧘", info: "Bonus Action · +4 danni per 2 turni · 2 cariche",
  special: "concentrate_buff", maxUses: 2, bonusAction: true,
};

// Assorbire Danni (Monk) — Bonus Action: il prossimo danno subito ti cura del 50%
const ASSORBIRE_DANNI_ACTION = {
  name: "Assorbire Danni", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🌀", info: "Bonus Action · il prossimo danno subito ti cura del 50% · 2 cariche",
  special: "absorb_damage", maxUses: 2, bonusAction: true,
};

// Cura Ki (Monk) — Bonus Action: cura 1d8+SAG HP, 2 cariche
const KI_HEALING_ACTION = {
  name: "Cura Ki", hitBonus: 0, damage: "1d8", statKey: null,
  type: "skill", icon: "🧘", info: "Bonus Action · cura 1d8+SAG HP · 2 cariche",
  special: "ki_healing", maxUses: 2, bonusAction: true,
};

// Marchio del Cacciatore (Ranger) — +3 ai tiri per colpire per 3 turni, 2 cariche · BONUS ACTION
const HUNTER_MARK_ACTION = {
  name: "Marchio del Cacciatore", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🎯", info: "Bonus action · +3 ai tiri per colpire per 3 turni · 2 cariche", special: "hunter_mark", bonusAction: true, maxUses: 2,
};

// Compagni Animali (Ranger) — uno scelto in fase di loadout
const RANGER_PETS = {
  wolf: {
    key: "wolf", name: "Lupo", icon: "🐺",
    info: "Bonus action · Il lupo morde per 1d8+3 · 3 cariche",
    action: {
      name: "Morso del Lupo", hitBonus: 0, damage: "1d8+3", statKey: null,
      type: "skill", icon: "🐺", info: "Bonus Action · 1d8+3 danni automatici · 3 cariche",
      special: "pet_wolf", maxUses: 3, bonusAction: true,
    },
  },
  spider: {
    key: "spider", name: "Ragno", icon: "🕷",
    info: "Bonus action · morde e intrappola · veleno 1d4/2t + TS FOR (CD 13) · fallisce 2t · supera 1t · 2 cariche",
    action: {
      name: "Morso del Ragno", hitBonus: 0, damage: "—", statKey: null,
      type: "skill", icon: "🕷", info: "Bonus Action · veleno 1d4 per 2 turni + TS FOR (CD 13) · fallisce: salta 2 turni · supera: salta 1 turno · 2 cariche",
      special: "pet_spider", saveAbility: "str", saveDC: 13, maxUses: 2, bonusAction: true,
    },
  },
  eagle: {
    key: "eagle", name: "Aquila", icon: "🦅",
    info: "Bonus action · picchiata · 1d4 danni + accecato + svantaggio per 3 turni · 2 cariche",
    action: {
      name: "Picchiata dell'Aquila", hitBonus: 0, damage: "1d4", statKey: null,
      type: "skill", icon: "🦅", info: "Bonus Action · 1d4 danni + accecato + svantaggio per 3 turni · 2 cariche",
      special: "pet_eagle", maxUses: 2, bonusAction: true,
    },
  },
  drago: {
    key: "drago", name: "Drago di Smeraldo", icon: "🐉",
    info: "Unico (Bottega) · bonus action · 3d6+3 danni auto-hit + cura 1d6 · 2 cariche",
    requiresBuff: "rangerUniquePet",
    action: {
      name: "Soffio del Drago", hitBonus: 0, damage: "3d6+3", statKey: null,
      type: "skill", icon: "🐉", info: "Bonus Action · 3d6+3 danni auto-hit + cura 1d6 PF · 2 cariche",
      special: "pet_drago", maxUses: 2, bonusAction: true,
    },
  },
};

// Demoni Evocati (Warlock) — uno scelto in fase di loadout
const WARLOCK_DEMONS = {
  mephit: {
    key: "mephit", name: "Mephit di Fiamma", icon: "🔥",
    info: "Bonus action · brucia il nemico: 1d8+2 fuoco per 3 turni · 3 cariche",
    action: {
      name: "Mephit di Fiamma", hitBonus: 0, damage: "—", statKey: null,
      type: "skill", icon: "🔥", info: "Bonus Action · brucia il nemico: 1d8+2 fuoco a inizio turno per 3 turni · 3 cariche",
      special: "demon_mephit", maxUses: 3, bonusAction: true,
      burnTurns: 3, burnDice: "1d8+2",
    },
  },
  succubus: {
    key: "succubus", name: "Succubus", icon: "💋",
    info: "Ammalia il nemico · TS CAR (CD 13) · fallisce 3t + svantaggio 3t · supera 1t + svantaggio 2t · 2 cariche",
    action: {
      name: "Bacio della Succubus", hitBonus: 0, damage: "—", statKey: null,
      type: "skill", icon: "💋", info: "TS CAR (CD 13) · fallisce: salta 3t + svantaggio 3t · supera: salta 1t + svantaggio 2t · 2 cariche",
      special: "demon_succubus", saveAbility: "cha", saveDC: 13, maxUses: 2,
    },
  },
  demon: {
    key: "demon", name: "Demone Maggiore", icon: "👹",
    info: "Drena 2d12 PF dal bersaglio · cura il warlock per la stessa quantità · 2 cariche",
    action: {
      name: "Drenaggio Demoniaco", hitBonus: 0, damage: "2d12", statKey: null,
      type: "skill", icon: "👹", info: "2d12 danni auto-hit · cura il warlock per la stessa quantità · 2 cariche",
      special: "demon_greater", maxUses: 2,
    },
  },
};

// ── ARTIFICER (Artefice) — sbloccato dalla Bottega ──────────────────────────
// Armi extra: Rifle e Pistola
const ARTIFICER_RANGED = [
  { name: "Rifle",   hitBonus: 3, damage: "1d8", statKey: "dex", type: "weapon", icon: "🔫", twoHanded: true,  info: "Arma da fuoco · 1d8+DES" },
  { name: "Pistola", hitBonus: 3, damage: "1d6", statKey: "dex", type: "weapon", icon: "🔫", twoHanded: false, info: "Arma da fuoco · 1d6+DES" },
];
const ARTIFICER_WEAPON_OPTIONS = [...SIMPLE_WEAPONS, ...ARTIFICER_RANGED];

// Spells: 4 cantrips, 4 lv1 — il giocatore sceglie 2 + 3
const ARTIFICER_SPELLS = [
  // ── Cantrips ──
  { name: "Acid Splash", level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "🧪", info: "Trucchetto · Acido", maxUses: 4 },
  { name: "Fire Bolt",   level: 0, hitBonus: 3, damage: "1d10", statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco", maxUses: 4 },
  { name: "Frost Bite",  level: 0, hitBonus: 3, damage: "1d6",  statKey: null, type: "spell", icon: "❄️", info: "Trucchetto · Freddo · 1d6 danni", maxUses: 4 },
  { name: "Resistance",  level: 0, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🛡", info: "Trucchetto · +2 al prossimo tiro per colpire", special: "magic_detect", maxUses: 4 },
  // ── Livello 1 ──
  { name: "Grease",       level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🛢", info: "Lv1 · Controllo · TS DES o perdi 2 turni", special: "control", maxUses: 3 },
  { name: "Cure Wounds",  level: 1, hitBonus: 0, damage: "1d8",  statKey: null, type: "spell", icon: "💚", info: "Lv1 · Cura · 1d8 + INT PF", special: "heal", healModStat: "int", maxUses: 3 },
  { name: "Faerie Fire",  level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🌟", info: "Lv1 · +2 al prossimo tiro per colpire", special: "magic_detect", maxUses: 3 },
  { name: "False Life",   level: 1, hitBonus: 0, damage: "1d4+4",statKey: null, type: "spell", icon: "🩸", info: "Lv1 · Cura · 1d4+4 PF temporanei", special: "heal", maxUses: 3 },
];

// Costrutti — scelti come pet del ranger ma con effetti meccanici diversi
const ARTIFICER_CONSTRUCTS = {
  golem: {
    key: "golem", name: "Golem di Ferro", icon: "🤖",
    info: "Attacco 1d8+3 · il prossimo attacco subìto dall'Artefice è dimezzato · 2 cariche",
    action: {
      name: "Golem di Ferro", hitBonus: 0, damage: "1d8+3", statKey: null,
      type: "skill", icon: "🤖", info: "1d8+3 danni · prossimo colpo subìto dimezzato",
      special: "construct_golem", maxUses: 2,
    },
  },
  snake: {
    key: "snake", name: "Serpente di Ferro", icon: "🐍",
    info: "Attacco 1d6+3 · veleno 1d6 per 2 turni · 2 cariche",
    action: {
      name: "Serpente di Ferro", hitBonus: 0, damage: "1d6+3", statKey: null,
      type: "skill", icon: "🐍", info: "1d6+3 danni + 1d6 veleno per 2 turni",
      special: "construct_snake", maxUses: 2,
    },
  },
};

// Forgia Armatura — skill unica dell'Artefice: +2 CA per 2 turni, 2 cariche
const FORGIA_ARMATURA_ACTION = {
  name: "Forgia Armatura", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🛠", info: "+2 CA per 2 turni · 2 cariche",
  special: "armor_forge", maxUses: 2,
};

// Stregoneria Innata (Sorcerer) — passiva: se il nemico ottiene 4 o meno sul TS, danni +50%
const INNATE_SORCERY_PASSIVE = {
  name: "Stregoneria Innata", hitBonus: 0, damage: "—", statKey: null,
  type: "passive", icon: "🌟", info: "Passiva · se il nemico tira ≤4 sul TS contro le tue spell, danni +50%",
};

// Fonte di Magia (Sorcerer) — ripristina 2 slot magia, 2 cariche
const processWsKnockouts = (players) => {
  const extraLogs = [];
  const updated = players.map(p => {
    if (!p.wildShape || p.hp > 0) return p;
    const restoredMaxHp = p.preWildShapeMaxHp ?? p.maxHp ?? 1;
    // Morte in forma selvatica: torna umano con il 60% degli HP totali della forma umana.
    const restored = Math.max(1, Math.floor(restoredMaxHp * 0.6));
    const formName = WILD_SHAPES[p.wildShape]?.name || p.wildShape;
    extraLogs.push(`🐾 ${p.name} viene abbattuto in forma ${formName} e ritorna alla forma originale (${restored}/${restoredMaxHp} HP)!`);
    return { ...p, hp: restored, maxHp: restoredMaxHp, wildShape: null, preWildShapeHp: null, preWildShapeMaxHp: null };
  });
  return { players: updated, extraLogs };
};

const FONTE_DI_MAGIA_ACTION = {
  name: "Fonte di Magia", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🔮", info: "Ripristina 2 slot magia a scelta · 2 cariche", special: "fonte_di_magia", maxUses: 2,
};

const CASTER_SKILLS = [];

// ── AI OPPONENT (hard mode) ───────────────────────────────────────────────────
// Players can spawn a 1v1 Sfida Libera against an AI bot when no human is
// available. The AI rolls initiative and attacks the player each turn using a
// fixed archetype. Combat logic lives in aiRollInitiative / aiPerformAttack
// inside the Arena component (driven by a useEffect on the match owner's
// client). The AI uses only basic weapon attacks — no spells, items, buffs.
const AI_BOT_PREFIX = "AI_BOT_";

const AI_HARD_PRESETS = [
  {
    archetype: "fighter-plate",
    name: "🤖 Veterano d'Acciaio",
    class: "Fighter",
    // High STR, modest DEX, very high CON. Plate armour for max AC.
    stats: { str: 5, dex: 1, con: 5, int: -1, wis: 1, cha: 0 },
    armor: { name: "Piastre Intere", baseAc: 17, maxDex: 0, hitPenalty: -2, icon: "🛡", info: "Pesante · senza DES" },
    hasShield: null,
    weapons: [{ name: "Spadone", hitBonus: 3, damage: "2d6", statKey: "str", type: "weapon", icon: "⚔", twoHanded: true }],
    hp: 95,
    items: { pozione_cura: 2 },
  },
  {
    archetype: "barbarian-axe",
    name: "🤖 Vargash il Sanguinario",
    class: "Barbarian",
    stats: { str: 5, dex: 3, con: 5, int: -1, wis: 0, cha: -1 },
    armor: { name: "Senza Armatura", baseAc: 10, maxDex: 99, hitPenalty: 0, icon: "💪", info: "Senza armatura · 10+DES+COS", unarmoredDefense: true },
    hasShield: null,
    weapons: [{ name: "Ascia Bipenne", hitBonus: 3, damage: "1d12", statKey: "str", type: "weapon", icon: "🪓", twoHanded: true }],
    hp: 105,
    items: { pozione_cura: 1, bomba: 1 },
  },
  {
    archetype: "ranger-longbow",
    name: "🤖 Liriel Occhio d'Aquila",
    class: "Ranger",
    stats: { str: 1, dex: 5, con: 4, int: 0, wis: 4, cha: 0 },
    armor: { name: "Cuoio Borchiato", baseAc: 14, maxDex: 2, hitPenalty: 0, icon: "⚙", info: "Borchiata · +DES max 2" },
    hasShield: null,
    weapons: [{ name: "Arco Lungo", hitBonus: 3, damage: "1d8", statKey: "dex", type: "weapon", icon: "🏹", twoHanded: true }],
    hp: 78,
    items: { pozione_cura: 2 },
  },
  {
    archetype: "rogue-twin",
    name: "🤖 Vyra la Cuspide",
    class: "Rogue",
    stats: { str: 0, dex: 5, con: 4, int: 2, wis: 1, cha: 1 },
    armor: { name: "Armatura di cuoio borchiato", baseAc: 12, maxDex: 99, hitPenalty: 0, icon: "👘", info: "Leggera · +DES pieno" },
    hasShield: null,
    // Rogue gets 3 attacks/turn — gets to swing both blades + one more.
    weapons: [
      { name: "Spada Corta", hitBonus: 3, damage: "1d6", statKey: "dex", type: "weapon", icon: "⚔", twoHanded: false },
      { name: "Stocco",      hitBonus: 3, damage: "1d8", statKey: "dex", type: "weapon", icon: "🗡", twoHanded: false },
    ],
    hp: 74,
    items: { pozione_cura: 1, pozione_veleno: 1 },
  },
  {
    archetype: "paladin-sword-shield",
    name: "🤖 Sir Caedric il Giudice",
    class: "Paladin",
    stats: { str: 5, dex: 1, con: 4, int: 0, wis: 1, cha: 4 },
    armor: { name: "Armatura a Placche", baseAc: 16, maxDex: 0, hitPenalty: -1, icon: "🛡", info: "Pesante" },
    hasShield: "metallo", // +2 AC
    weapons: [{ name: "Spada Lunga", hitBonus: 3, damage: "1d10", statKey: "str", type: "weapon", icon: "⚔", twoHanded: false }],
    hp: 90,
    items: { pozione_cura: 2 },
  },
  {
    // Pure arcane caster — opens with a control or save-buff, then leans on
    // damage spells (TS-based). Carries a dagger as a fallback when slots
    // run dry. CD-mod uses INT (=4).
    archetype: "wizard-fire",
    name: "🤖 Arconte Pyrios",
    class: "Wizard",
    stats: { str: -1, dex: 2, con: 3, int: 5, wis: 1, cha: 0 },
    armor: { name: "Senza Armatura", baseAc: 10, maxDex: 99, hitPenalty: 0, icon: "🪶", info: "Senza armatura · 10+DES" },
    hasShield: null,
    weapons: [{ name: "Pugnale", hitBonus: 3, damage: "1d4", statKey: "dex", type: "weapon", icon: "🗡", twoHanded: false }],
    spells: [
      // Trucchetti — usabili a oltranza (4 cariche)
      { name: "Dardo di Fuoco", level: 0, hitBonus: 3, damage: "1d10", statKey: null, type: "spell", icon: "🔥", info: "Trucchetto · Fuoco", maxUses: 4 },
      { name: "Tocco Gelido",   level: 0, hitBonus: 3, damage: "1d8",  statKey: null, type: "spell", icon: "❄",  info: "Trucchetto · Necrotico", maxUses: 4 },
      // Lv1 — controllo + danno
      { name: "Sonno",          level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "😴", info: "Lv1 · Controllo · TS SAG o perdi 2 turni", special: "control", maxUses: 4 },
      { name: "Mani Brucianti", level: 1, hitBonus: 3, damage: "3d6",  statKey: null, type: "spell", icon: "🔥", info: "Lv1 · Fuoco", maxUses: 4 },
      { name: "Scudo",          level: 1, hitBonus: 0, damage: "—",    statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +1 CA per 3 turni", special: "shield_buff", shieldBuffBonus: 1, shieldBuffTurns: 3, maxUses: 2 },
      // Lv2 — danno grosso
      { name: "Raggio Rovente", level: 2, hitBonus: 3, damage: "6d6",  statKey: null, type: "spell", icon: "🔥", info: "Lv2 · Fuoco (3 raggi × 2d6)", maxUses: 2 },
    ],
    hp: 60,
    items: { pozione_cura: 2 },
  },
];

function makeAiSnapshotAndPlayer(matchSeed) {
  const preset = AI_HARD_PRESETS[Math.floor(Math.random() * AI_HARD_PRESETS.length)];
  const aiUid  = `${AI_BOT_PREFIX}${matchSeed}`;
  const dexMod = preset.stats.dex;
  const conMod = preset.stats.con;
  const shieldAcBonus = preset.hasShield ? 2 : 0;
  const finalAc = preset.armor.unarmoredDefense
    ? 10 + dexMod + conMod + shieldAcBonus
    : preset.armor.baseAc + Math.min(Math.max(dexMod, 0), preset.armor.maxDex) + shieldAcBonus;

  // Item keys (for snapshot.selectedItemKeys) and itemUsesLeft map.
  const itemEntries = Object.entries(preset.items || {}).filter(([, n]) => n > 0);
  const selectedItemKeys = itemEntries.flatMap(([k, n]) => Array(n).fill(k));
  const itemUsesLeft = Object.fromEntries(itemEntries);
  const isPaladin = preset.class.toLowerCase().includes("paladin");

  const snapshot = {
    name:            preset.name,
    image:           null,
    class:           preset.class,
    stats:           { ...preset.stats, maxHp: preset.hp, ac: finalAc },
    selectedActions: [
      ...preset.weapons.map(w => ({ ...w })),
      ...((preset.spells || []).map(s => ({ ...s }))),
    ],
    hasWildShape:    false,
    hasShield:       preset.hasShield,
    selectedArmor:   { ...preset.armor },
    selectedItemKeys,
    arenaBuffs:      {},
    titles:          [],
    selectedPet:     null,
    selectedDemon:   null,
    selectedConstruct: null,
    isAi:            true,
    aiArchetype:    preset.archetype,
  };
  const playerObj = {
    id:    aiUid,
    name:  preset.name,
    class: preset.class.toLowerCase(),
    hp:    preset.hp,
    maxHp: preset.hp,
    init:  0,
    itemUsesLeft,
    // Paladins start with Lay of Hands pool = maxHp / 3, capped at 30.
    layOfHandsPool: isPaladin ? Math.min(30, Math.floor(preset.hp / 3)) : 0,
    equippedWeaponNames: preset.weapons.map(w => w.name),
    // AI-specific tracking
    aiAttacksMade: 0,
    aiSecondWindUsed: false,
    aiSurgeUsed: false,
    isAi: true,
  };
  return { aiUid, snapshot, playerObj, archetype: preset.archetype };
}

// ── ITEMS ─────────────────────────────────────────────────────────────────────
const ARENA_ITEMS = [
  { key: "pozione_cura",        name: "Pozione di Cura",        icon: "🧪", info: "Cura 2d12 · Passa il turno",                 damage: "2d12" },
  { key: "pozione_cura_media",  name: "Pozione di Cura Media",  icon: "💚", info: "Cura 2d8 · Passa il turno (Bottega Arena)",   damage: "2d8",  shopOnly: true },
  { key: "bomba",               name: "Bomba",                  icon: "💣", info: "2d6 danni al bersaglio · Passa il turno",    damage: "2d6"  },
  { key: "pozione_veleno",      name: "Pozione di Veleno",      icon: "☠",  info: "1d6 veleno al bersaglio il prossimo turno",   damage: "1d6"  },
];

const ARENA_INITIATIVE_DURATION = 10 * 60 * 1000;      // 10 minuti per tirare iniziativa
const ARENA_TURN_DURATION       = 1 * 60 * 60 * 1000;  // 1 ora per fare la propria azione
const FUN_MATCH_PRUNE_GRACE_MS  = 10 * 60 * 1000;      // attesa prima di rimuovere una Sfida Libera finita+archiviata

// Smite del Paladino — aggiunto automaticamente (max 2 usi)
const SMITE_ACTION = {
  name: "Smite Divino", hitBonus: 0, damage: "2d8", statKey: null,
  type: "skill", icon: "⚡", info: "Attacca con arma +2d8 · 2 cariche", special: "smite", maxUses: 2,
};

// Lay of Hands — aggiunto automaticamente al Paladino (pool = 1/3 HP)
const LAY_OF_HANDS_ACTION = {
  name: "Lay of Hands", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🙏", info: "Bonus Action · cura dalla pozza (1/3 HP max) · scegli l'importo", special: "lay_of_hands", bonusAction: true,
};

// Recupero Arcano (Wizard) — ripristina 2 slot lv1 e 1 slot lv2, 1 uso
const RECUPERO_ARCANO_ACTION = {
  name: "Recupero Arcano", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "📖", info: "Ripristina 2 slot lv1 + 1 slot lv2 · 1 uso", special: "recupero_arcano", maxUses: 1,
};

// Astuzia Magica (Warlock) — salta il turno e ripristina 1 carica per slot magia
const MAGICAL_CUNNING_ACTION = {
  name: "Astuzia Magica", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🌀", info: "Salta il turno · +1 carica a ogni slot magia · 2 cariche", special: "magical_cunning", maxUses: 2,
};

/* Patto Demoniaco (Warlock) — sacrifica 1d4 PF per 3 turni di +1d12 ai
   danni delle spell che colpiscono. La penalità è pagata subito; il buff
   `pattoTurns` decresce a ogni attacco del warlock. */
const PATTO_DEMONIACO_ACTION = {
  name: "Patto Demoniaco", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🩸",
  info: "Sacrifica 1d4 PF · per 3 turni le tue spell che colpiscono fanno +1d12 danni · 2 cariche",
  special: "patto_demoniaco", maxUses: 2,
};

// ── TITOLI D'ARENA (assegnati dal Master, attivi solo in Torneo / Arena Campioni) ─
const ARENA_TITLES = {
  myrhal:     { key: "myrhal",     name: "Campione di Myrhal",   icon: "✨", short: "+1 hit spell (Mago/Stregone)" },
  vulkaros:   { key: "vulkaros",   name: "Campione di Vulkaros", icon: "⚔",  short: "+1 hit arma (Guerriero)" },
  gufoBianco: { key: "gufoBianco", name: "Gufo Bianco",          icon: "🦉", short: "+1 hit Druido (forma selvatica)" },
  spazzaossa: { key: "spazzaossa", name: "Spazzaossa",           icon: "🦴", short: "+1 hit senz'armi o con armi contundenti" },
};

// Restituisce +1 se il titolo deve attivarsi su questo tiro per colpire, altrimenti 0.
// "Spazzaossa" si attiva su qualsiasi azione non-spell con damageType "contundente"
// (include Pugno/Carica di Pugni del Monaco, che sono unarmed-bludgeoning).
function getTitleHitBonus({ titleKey, classLower, isSpellAction, wildShapeForm, actionDamageType }) {
  if (!titleKey) return 0;
  if (titleKey === "myrhal"     && isSpellAction && (isWizardClass(classLower) || isSorcererClass(classLower))) return 1;
  if (titleKey === "vulkaros"   && !isSpellAction && isFighterClass(classLower)) return 1;
  if (titleKey === "gufoBianco" && isDruidClass(classLower) && !!wildShapeForm) return 1;
  if (titleKey === "spazzaossa" && !isSpellAction && actionDamageType === "contundente") return 1;
  return 0;
}

// Invisibilità con durata variabile. `invisibilityTurns` è la fonte di verità; legacy `invisible: true/false` fa da fallback.
function consumeInvisibility(p) {
  const turns = p.invisibilityTurns ?? (p.invisible ? 1 : 0);
  if (turns > 1) return { invisible: true, invisibilityTurns: turns - 1 };
  return { invisible: false, invisibilityTurns: 0 };
}

// Eagle debuff: aquila del Ranger applica blindDebuff per 3 turni dell'avversario.
// Il timer va decrementato quando il turno del giocatore colpito termina, qualunque azione abbia scelto.
function tickEagleEnd(p) {
  const newEagle = Math.max(0, (p.eagleDebuffTurns ?? 0) - 1);
  return { eagleDebuffTurns: newEagle, blindDebuff: newEagle > 0 ? p.blindDebuff : false };
}

// Riduzione danni: il Barbaro in Furia subisce metà danni da armi/skill e -25% dagli incantesimi.
function applyBarbarianRageReduction(rawDmg, defenderSnap, defenderMatchPlayer, isSpell) {
  if (rawDmg <= 0) return rawDmg;
  const defClass = (defenderSnap?.class || "").toLowerCase();
  if (!["barbarian","barbaro"].some(c => defClass.includes(c))) return rawDmg;
  if ((defenderMatchPlayer?.rageTurns ?? 0) <= 0) return rawDmg;
  if (isSpell) return Math.max(1, Math.floor(rawDmg * 0.75));
  return Math.floor(rawDmg / 2);
}

// Titoli cumulativi: legge l'array `arenaTitles` e fa fallback al legacy `arenaTitle` singolo.
function getCharTitles(ch) {
  if (!ch) return [];
  if (Array.isArray(ch.arenaTitles)) return ch.arenaTitles.filter(Boolean);
  if (ch.arenaTitle) return [ch.arenaTitle];
  return [];
}
function getSnapTitles(snap) {
  if (!snap) return [];
  if (Array.isArray(snap.titles)) return snap.titles.filter(Boolean);
  if (snap.title) return [snap.title];
  return [];
}

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
// Spell mod del caster (INT/SAG/CAR a seconda della classe).
function getSpellMod(snap) {
  const cls = (snap?.class || "").toLowerCase();
  const key = getSpellcastingAbility(cls);
  return snap?.stats?.[key] ?? 0;
}
// CD TS = 10 + 3 + spell mod (caster) — formula uniforme per tutti gli incantesimi (incluso danno).
function getSpellSaveDC(snap) { return 10 + 3 + getSpellMod(snap); }
// Un incantesimo a danno usa il TS al posto del tiro per colpire.
// Eccezioni: spell con `special` (control/heal/buff/etc.) e quelle marcate auto-hit (hitBonus ≥ 20, es. Dardo Incantato).
function isSaveDamageSpell(action) {
  if (!action || action.type !== "spell") return false;
  if (action.special) return false;
  if (!action.damage || action.damage === "—") return false;
  if ((action.hitBonus ?? 0) >= 20) return false;
  return true;
}
// Determina l'abilità del TS dalla descrizione (es. "TS SAG", "TS COS"). Default: SAG.
function parseSpellSaveAbility(action) {
  const info = (action?.info || "").toUpperCase();
  if (info.includes("TS FOR")) return "str";
  if (info.includes("TS DES")) return "dex";
  if (info.includes("TS COS")) return "con";
  if (info.includes("TS INT")) return "int";
  if (info.includes("TS CAR")) return "cha";
  return "wis";
}
const SAVE_LABEL = { str: "FOR", dex: "DES", con: "COS", int: "INT", wis: "SAG", cha: "CAR" };
function isRogueClass(cls)      { return ["rogue","ladro"].some(c => cls.includes(c)); }
function isRangerClass(cls)     { return ["ranger","cacciatore"].some(c => cls.includes(c)); }
function isArtificerClass(cls)  { return ["artificer","artefice"].some(c => cls.includes(c)); }
function isBarbarianClass(cls)  { return ["barbarian","barbaro"].some(c => cls.includes(c)); }
function isMonkClass(cls)       { return ["monk","monaco"].some(c => cls.includes(c)); }

// Furtività: due contatori indipendenti (vantaggio del Ladro / svantaggio dei nemici).
// Compatibili con il vecchio campo `stealthTurns` tramite fallback.
function readStealthAdvTurns(p)    { return p?.stealthAdvTurns    ?? p?.stealthTurns ?? 0; }
function readStealthDisadvTurns(p) { return p?.stealthDisadvTurns ?? p?.stealthTurns ?? 0; }
function readStealthAnyTurns(p)    { return Math.max(readStealthAdvTurns(p), readStealthDisadvTurns(p)); }

// Numero massimo di azioni per turno: Monaco = 2, Ladro = 2, altrimenti 1.
// +1 se il giocatore ha extraTurnActive (Passo Spedito).
// +1 se Scatto d'Azione è attivo (Guerriero) — concede un'azione extra per questo turno.
function getMaxActionsPerTurn(snap, matchPlayer) {
  if (!snap) return 1;
  const cls = (snap.class || "").toLowerCase();
  let base = 1;
  if (isMonkClass(cls)) base = 2;
  else if (isRogueClass(cls)) base = 2;
  if (matchPlayer?.extraTurnActive) base += 1;
  if (matchPlayer?.actionSurgeActive) base += 1;
  return base;
}

// Bonus al tiro per colpire delle spell di buff: Chierico/Paladino sono ridotti a +2.
function getMagicDetectBonusForClass(cls) {
  const c = (cls || "").toLowerCase();
  return (isClericClass(c) || isPaladinClass(c)) ? 2 : 3;
}
function getAidBonusForClass(cls) {
  const c = (cls || "").toLowerCase();
  return (isClericClass(c) || isPaladinClass(c)) ? 2 : 4;
}
// Legge il valore numerico del buff, con fallback al default storico (per match già in corso).
function readActiveBonus(v, legacyDefault) {
  if (typeof v === "number") return v;
  return v ? legacyDefault : 0;
}

// ── Stati di combattimento mostrati come badge sulla card del combattente. ──
// Funzione PURA: deriva tutto dall'oggetto giocatore `p`, così umano e IA
// mostrano sempre gli stessi badge (prima veleno/sanguinamento/save-DoT non
// comparivano affatto sulle card → invisibili nelle battaglie IA).
// Ritorna { key, icon, text, tip, cls }; `cls` sceglie il colore in CSS.
function getFighterStatuses(p) {
  if (!p) return [];
  const out = [];
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
  const push = (key, icon, text, cls, tip) => out.push({ key, icon, text, cls, tip: tip || text });

  // ── Danno nel tempo / debuff (mostrati per primi: sono le minacce attive) ──
  if (p.poisonDoT) {
    const icon = p.poisonDoTIcon || "☠";
    const noun = p.poisonDoTSourceLabel || p.poisonDoTNoun || "Veleno";
    const t = p.poisonDoTTurns ?? 1;
    const dice = p.poisonDoTDice || "";
    const isFire = icon === "🔥";
    push("poison", icon, `${cap(noun)} ${t}t`, isFire ? "is-fire" : "is-poison",
      `${cap(noun)} — ${dice ? dice + " danni " : ""}a inizio turno per ${t} turno/i`);
  }
  if (p.bleedDoT) {
    const t = p.bleedDoTTurns ?? 1;
    const dice = p.bleedDoTDice || "";
    push("bleed", p.bleedDoTIcon || "🩸", `${cap(p.bleedDoTSourceLabel || "Sanguinamento")} ${t}t`, "is-bleed",
      `Sanguinamento — ${dice ? dice + " danni " : ""}a inizio turno per ${t} turno/i`);
  }
  if (p.pendingSaveDot) {
    const sd = p.pendingSaveDot;
    push("savedot", "🤢", `TS ${sd.name || "Veleno"}`, "is-poison",
      `Deve superare un Tiro Salvezza o subire ${sd.dice || "2d6"} per ${sd.turns ?? 3} turni`);
  }
  if (p.entangled)                          push("entangled", "🕸", "Intrappolato", "is-control");
  if ((p.controlLostTurns ?? 0) > 0)        push("control", "🌀", `Controllo ${p.controlLostTurns}t`, "is-control", "Sotto controllo: salta il turno");
  if ((p.weaponLockTurns ?? 0) > 0)         push("wlock", "🔩", `Arma Bloccata ${p.weaponLockTurns}t`, "is-control");
  if ((p.attackDisadvantageTurns ?? 0) > 0) push("disadv", "🌫", `Svantaggio ${p.attackDisadvantageTurns}t`, "is-debuff", "Svantaggio agli attacchi");
  if (p.blindDebuff)                        push("blind", "🙈", "Accecato −3", "is-debuff");

  // ── Buff difensivi ──
  if ((p.shieldSkillTurns ?? 0) > 0)        push("shield", "🛡", `Scudo +${p.shieldSkillBonus ?? 3} ${p.shieldSkillTurns}t`, "is-shield", `+${p.shieldSkillBonus ?? 3} CA per ${p.shieldSkillTurns} turni`);
  if ((p.defensiveBonus ?? 0) > 0)          push("def", "🛡", `Difensivo +${p.defensiveBonus}`, "is-shield", `+${p.defensiveBonus} CA fino al prossimo turno`);
  if ((p.saveBuffAttacks ?? 0) > 0)         push("savebuff", "🧿", `Difesa Mistica +${p.saveBuffBonus ?? 0}`, "is-shield", `+${p.saveBuffBonus ?? 0} ai TS · ${p.saveBuffAttacks} rimasti`);
  if (p.absorbDamageNext)                   push("absorb", "✨", "Assorbi danno", "is-shield", "Assorbe il prossimo colpo");

  // ── Buff offensivi / vantaggi ──
  if ((p.selfAdvTurns ?? 0) > 0)            push("selfadv", "🌟", `Vantaggio ${p.selfAdvTurns}t`, "is-buff");
  if (!p.invisible && readStealthAdvTurns(p) > 0) push("stealth", "🥷", `Furtività ${readStealthAdvTurns(p)}t`, "is-buff", "Vantaggio dalla furtività");
  if (p.invisible)                          push("invis", "👻", "Invisibile", "is-buff");
  if (p.weaponPoisoned)                     push("wpoison", "🧪", "Arma Avvelenata", "is-buff", "Prossimo colpo: +1d12 veleno");
  if (p.aidBuff)                            push("aid", "🤝", `Aiuto +${readActiveBonus(p.aidBuff, 4)}`, "is-buff", `+${readActiveBonus(p.aidBuff, 4)} al prossimo tiro per colpire`);
  if ((p.rageTurns ?? 0) > 0)               push("rage", "🔥", `Furia +2 ${p.rageTurns}t`, "is-rage", `+2 danni · riduzione danni subiti · ${p.rageTurns} turni`);
  if ((p.hunterMarkTurns ?? 0) > 0)         push("mark", "🎯", `Marchio ${p.hunterMarkTurns}t`, "is-rage", `+3 al colpire per ${p.hunterMarkTurns} turni`);

  // ── Energia / azioni extra ──
  if (p.actionSurgeActive)                  push("surge", "⚡", "Scatto d'Azione", "is-energy", "Azione extra questo turno");
  if (p.extraTurnActive)                    push("extra", "💨", "Passo Spedito", "is-energy", "+1 azione questo turno");

  // ── Magia / concentrazione ──
  if (p.bardicInspirationActive)            push("bard", "🎵", "Ispirazione +1d6", "is-magic", "+1d6 al prossimo tiro");
  if (p.magicDetectActive)                  push("md", "🔮", `Buff Attacco +${readActiveBonus(p.magicDetectActive, 3)}`, "is-magic", `+${readActiveBonus(p.magicDetectActive, 3)} al colpire · ${p.magicDetectAttacks ?? 1} rimasti`);
  if ((p.concentrationTurns ?? 0) > 0)      push("conc", "🧠", `Concentrazione ${p.concentrationTurns}t`, "is-magic");

  // ── Trasformazione ──
  if (p.wildShape) {
    const ws = WILD_SHAPES[p.wildShape];
    push("wild", ws?.icon || "🐾", ws?.name || "Forma Selvatica", "is-wild");
  }

  return out;
}

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
  if (isArtificerClass(cls))  return { armorCategory: "lightMedium", canHaveShield: true   };
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
  if (["artificer","artefice"].some(c => cls.includes(c)))                          return "artificer";
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
  warlock:  { 0: 2, 1: 2, 2: 2, 3: 0 },
  druid:    { 0: 2, 1: 4, 2: 2, 3: 0 },
  cleric:   { 0: 3, 1: 4, 2: 2, 3: 0 },
  bard:     { 0: 0, 1: 4, 2: 2, 3: 0 },
  paladin:  { 0: 0, 1: 2, 2: 1, 3: 0 },
  ranger:   { 0: 0, 1: 3, 2: 0, 3: 0 },
  artificer:{ 0: 2, 1: 3, 2: 0, 3: 0 },
  generic:  { 0: 1, 1: 1, 2: 1, 3: 0 },
};

function getLoadoutConfig(charClass) {
  const cls = (charClass || "").toLowerCase();
  const { armorCategory, canHaveShield } = getArmorConfig(cls);
  const sumLimits = (lim) => Object.values(lim).reduce((a, b) => a + b, 0);
  if (isWizardClass(cls))   return { weaponOptions: SIMPLE_WEAPONS,        spellOptions: WIZARD_SPELLS,   spellLimits: SPELL_LIMITS.wizard,   skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.wizard),   autoActions: [RECUPERO_ARCANO_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isSorcererClass(cls)) return { weaponOptions: SIMPLE_WEAPONS,         spellOptions: SORCERER_SPELLS, spellLimits: SPELL_LIMITS.sorcerer, skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.sorcerer), autoActions: [INNATE_SORCERY_PASSIVE, FONTE_DI_MAGIA_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isWarlockClass(cls))  return { weaponOptions: SIMPLE_WEAPONS,         spellOptions: WARLOCK_SPELLS,  spellLimits: SPELL_LIMITS.warlock,  skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.warlock),  autoActions: [MAGICAL_CUNNING_ACTION, PATTO_DEMONIACO_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isPaladinClass(cls))  return { weaponOptions: MARTIAL_WEAPONS,        spellOptions: PALADIN_SPELLS,  spellLimits: SPELL_LIMITS.paladin,  skillOptions: [], maxWeapons: 2, maxSpells: sumLimits(SPELL_LIMITS.paladin),  autoActions: [SMITE_ACTION, LAY_OF_HANDS_ACTION],  hasWildShape: false, armorCategory, canHaveShield };
  if (isFighterClass(cls))  return { weaponOptions: [...SIMPLE_WEAPONS, ...MARTIAL_WEAPONS], spellOptions: [], spellLimits: {}, skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [SECOND_WIND_ACTION, ACTION_SURGE_ACTION, CHARGE_ACTION, DISARM_ACTION, PRESENZA_POSSENTE_PASSIVE, CRITICO_MIGLIORATO_PASSIVE], hasWildShape: false, armorCategory, canHaveShield };
  if (isBarbarianClass(cls))return { weaponOptions: [...SIMPLE_WEAPONS, ...MARTIAL_WEAPONS], spellOptions: [], spellLimits: {}, skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [RAGE_ACTION, TURBINE_LAME_ACTION, MIGHTY_STRIKE_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isClericClass(cls))   return { weaponOptions: CLERIC_WEAPON_OPTIONS,  spellOptions: CLERIC_SPELLS,   spellLimits: SPELL_LIMITS.cleric,   skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.cleric),   autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  if (isDruidClass(cls))    return { weaponOptions: DRUID_WEAPON_OPTIONS,   spellOptions: DRUID_SPELLS,    spellLimits: SPELL_LIMITS.druid,    skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.druid),    autoActions: [], hasWildShape: true,  armorCategory, canHaveShield };
  if (isBardClass(cls))     return { weaponOptions: BARD_WEAPON_OPTIONS,    spellOptions: BARD_SPELLS,     spellLimits: SPELL_LIMITS.bard,     skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.bard),     autoActions: [BARDIC_INSPIRATION_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isMonkClass(cls))     return { weaponOptions: MONK_WEAPON_OPTIONS,     spellOptions: [],              spellLimits: {},                    skillOptions: [], maxWeapons: 1, maxSpells: 0, autoActions: [PUGNO_ACTION, CARICA_PUGNI_ACTION, CONCENTRAZIONE_ACTION, ASSORBIRE_DANNI_ACTION, KI_HEALING_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isRogueClass(cls))    return { weaponOptions: ROGUE_WEAPON_OPTIONS,   spellOptions: [],              spellLimits: {},                    skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [SNEAK_ATTACK_ACTION, STEALTH_ACTION, TRIBOLI_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isRangerClass(cls))   return { weaponOptions: RANGER_WEAPON_OPTIONS,  spellOptions: RANGER_SPELLS,   spellLimits: SPELL_LIMITS.ranger,   skillOptions: [], maxWeapons: 2, maxSpells: sumLimits(SPELL_LIMITS.ranger),   autoActions: [HUNTER_MARK_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isArtificerClass(cls))return { weaponOptions: ARTIFICER_WEAPON_OPTIONS, spellOptions: ARTIFICER_SPELLS, spellLimits: SPELL_LIMITS.artificer, skillOptions: [], maxWeapons: 2, maxSpells: sumLimits(SPELL_LIMITS.artificer), autoActions: [FORGIA_ARMATURA_ACTION], hasWildShape: false, armorCategory, canHaveShield };
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

  const getRecentForm = (uid) => {
    const history = (arenaMeta.matchHistory || []).filter(e => e.uid === uid);
    return history.slice(-3).map(e => e.result);
  };

  // Solo match torneo: scommesse non disponibili sull'Arena Libera.
  const activeMatches = (arenaMeta.matches || []).filter(m => m.kind !== "fun" && m.status !== "finished" && !m.winner);
  const allFighters = arenaMeta.participants || [];
  const eliminatedUids = new Set(
    (arenaMeta.matches || [])
      .filter(m => m.kind !== "fun" && m.status === "finished" && m.winner)
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
                    const form = getRecentForm(p.id);
                    return (
                      <div key={p.id} className={`bet-fighter ${isBetTarget ? "bet-fighter--chosen" : ""}`}>
                        {snap.image && <img src={snap.image} alt="" className="bet-fighter-avatar" />}
                        <span className="bet-fighter-name">{p.name}</span>
                        {form.length > 0 && (
                          <div className="bet-form-row">
                            {form.map((r, i) => (
                              <span key={i} className={`bet-form-badge ${r === "W" ? "form-win" : r === "L" ? "form-loss" : "form-draw"}`}>{r}</span>
                            ))}
                          </div>
                        )}
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
                  const form = getRecentForm(uid);
                  return (
                    <div key={uid} className="bet-tournament-fighter">
                      {snap.image && <img src={snap.image} alt="" className="bet-fighter-avatar" />}
                      <span className="bet-fighter-name">{snap.name || uid}</span>
                      {form.length > 0 && (
                        <div className="bet-form-row">
                          {form.map((r, i) => (
                            <span key={i} className={`bet-form-badge ${r === "W" ? "form-win" : r === "L" ? "form-loss" : "form-draw"}`}>{r}</span>
                          ))}
                        </div>
                      )}
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

// ── MASTER TITLE EDITOR ──────────────────────────────────────────────────────
// Persistente: i titoli vivono sul documento `characters/{uid}.arenaTitle`
// e restano per sempre, anche dopo reset/fine torneo.
function MasterTitleEditor({ forceOpen = false } = {}) {
  /* FIX: P5c — forceOpen makes this render its body unconditionally
     (used when wrapped in ArenaModal). The legacy toggle remains
     when forceOpen is false. */
  const [openState, setOpen]    = useState(false);
  const open                    = forceOpen || openState;
  const [allChars, setAllChars] = useState([]);
  const [filter, setFilter]     = useState("");

  useEffect(() => {
    if (!open) return;
    const unsub = onSnapshot(collection(db, "characters"), snap => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setAllChars(list);
    });
    return () => unsub();
  }, [open]);

  const writeTitles = async (uid, newTitles) => {
    try {
      // Scrive l'array canonico e azzera il legacy single-field per evitare duplicati di lettura.
      await updateDoc(doc(db, "characters", uid), { arenaTitles: newTitles, arenaTitle: null });
      try {
        await updateDoc(doc(db, "arena_meta", "global"), {
          [`characterSnapshots.${uid}.titles`]: newTitles,
          [`characterSnapshots.${uid}.title`]: null,
        });
      } catch { /* snapshot non presente — ok */ }
    } catch (err) { console.error("set arena titles:", err); }
  };

  const addTitle = (uid, key) => {
    if (!key) return;
    const ch = allChars.find(c => c.uid === uid);
    const current = getCharTitles(ch);
    if (current.includes(key)) return;
    return writeTitles(uid, [...current, key]);
  };
  const removeTitle = (uid, key) => {
    const ch = allChars.find(c => c.uid === uid);
    const current = getCharTitles(ch);
    return writeTitles(uid, current.filter(k => k !== key));
  };

  const q = filter.trim().toLowerCase();
  const visible = q ? allChars.filter(c => (c.name || "").toLowerCase().includes(q) || (c.class || "").toLowerCase().includes(q)) : allChars;

  return (
    <div className={`master-title-editor${forceOpen ? " in-modal" : ""}`}>
      {!forceOpen && (
        <button
          type="button"
          className="master-title-toggle"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
        >
          {open ? "▲" : "▼"} ♛ Titoli d'Arena — Permanenti
          {!open && <span className="master-title-hint">clicca per gestire</span>}
        </button>
      )}
      {open && (
        <div className="master-title-body">
          <p className="empty-note" style={{ marginBottom: 8 }}>
            I titoli sono permanenti e attivi sia in Torneo che in Arena dei Campioni.
          </p>
          {!allChars.length ? (
            <p className="empty-note">Caricamento giocatori…</p>
          ) : (
            <>
              <input
                className="title-filter-input"
                placeholder="Cerca giocatore o classe…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              <div className="title-edit-list">
                {visible.map(ch => {
                  const owned = getCharTitles(ch);
                  const available = Object.values(ARENA_TITLES).filter(opt => !owned.includes(opt.key));
                  return (
                    <div key={ch.uid} className="title-edit-row">
                      <span className="title-edit-name">{ch.name || ch.uid}</span>
                      {ch.class && <span className="p-class">{ch.class}</span>}
                      {owned.map(key => (
                        <span key={key} className="p-title-badge" title={ARENA_TITLES[key]?.short}>
                          {ARENA_TITLES[key]?.icon} {ARENA_TITLES[key]?.name}
                          <button
                            type="button"
                            className="p-title-badge-x"
                            title="Rimuovi titolo"
                            onClick={() => removeTitle(ch.uid, key)}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      <select
                        className="title-select"
                        value=""
                        disabled={available.length === 0}
                        onChange={e => { const v = e.target.value; e.target.value = ""; addTitle(ch.uid, v); }}
                      >
                        <option value="">{available.length === 0 ? "— Tutti assegnati —" : "+ Aggiungi titolo…"}</option>
                        {available.map(opt => (
                          <option key={opt.key} value={opt.key}>{opt.icon} {opt.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
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
  const [tournamentHistory, setTournamentHistory] = useState([]);
  const [profileLookup, setProfileLookup]     = useState({});

  // Loadout — "idle" | "class-select" | "stat-assign" | "rolling" | "selecting"
  const [loadoutPhase, setLoadoutPhase]     = useState("idle");
  const [charPreview, setCharPreview]       = useState(null);
  const [pendingStats, setPendingStats]     = useState({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
  const [pendingWeapons, setPendingWeapons] = useState([]);
  const [pendingSpells, setPendingSpells]   = useState([]);
  const [pendingSkills, setPendingSkills]   = useState([]);
  const [pendingArmor, setPendingArmor]     = useState(null);
  const [pendingShield, setPendingShield]   = useState(null); // null | "legno" | "metallo"
  const [pendingPet, setPendingPet]         = useState(null); // ranger only — "wolf" | "spider" | "eagle" | "drago"
  const [pendingDemon, setPendingDemon]     = useState(null); // warlock only — "mephit" | "succubus" | "demon"
  const [pendingConstruct, setPendingConstruct] = useState(null); // artificer only — "golem" | "snake"
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
  const [combatModalOpen, setCombatModalOpen] = useState(false);
  // Popup di fine combattimento (vittoria/sconfitta). null = nessun popup.
  const [fightResult, setFightResult] = useState(null);
  const fightResultSeenRef = useRef(null);
  /* FIX: P5b/P5c/P5d — modal/drawer state */
  const [bracketModalOpen, setBracketModalOpen] = useState(false);
  const [bettingDrawerOpen, setBettingDrawerOpen] = useState(false);
  const [titlesModalOpen, setTitlesModalOpen] = useState(false);
  const [statsTournModalOpen, setStatsTournModalOpen] = useState(false);
  const [statsFunModalOpen, setStatsFunModalOpen] = useState(false);

  /* FIX: P5d — count placed bets for FAB badge */
  const [userBetsCount, setUserBetsCount] = useState(0);
  useEffect(() => {
    if (!currentUser) { setUserBetsCount(0); return; }
    const qBets = query(
      collection(db, "arena_bets"),
      where("uid", "==", currentUser.uid),
      where("status", "==", "pending")
    );
    return onSnapshot(qBets, snap => setUserBetsCount(snap.size));
  }, [currentUser]);

  // Tick ogni secondo per aggiornare i timer in-render
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Reazioni simpatiche in combattimento (cooldown 20s per giocatore) ──
  const [reactCooldownUntil, setReactCooldownUntil] = useState(0);
  const [reactPickerMatch, setReactPickerMatch] = useState(null);
  const REACT_COOLDOWN_MS = 20000;
  const ARENA_REACTIONS = ["😂", "🔥", "👏", "😱", "💀", "👑", "🤡", "🫡", "😎", "🤝"];
  const sendArenaReaction = async (matchId, emoji) => {
    if (!currentUser) return;
    const now = Date.now();
    if (now < reactCooldownUntil) return;
    setReactCooldownUntil(now + REACT_COOLDOWN_MS);
    setReactPickerMatch(null);
    const myName =
      (arenaMetaRef.current?.matches || [])
        .find(m => m.matchId === matchId)?.players
        ?.find(p => p.id === currentUser.uid)?.name
      || arenaMetaRef.current?.characterSnapshots?.[currentUser.uid]?.name
      || "Sfidante";
    const entry = { id: `${currentUser.uid}-${now}`, matchId, uid: currentUser.uid, name: myName, emoji, ts: now };
    try {
      const prev = (arenaMetaRef.current?.reactions || []).filter(r => now - (r.ts || 0) < 12000);
      await updateDoc(doc(db, "arena_meta", "global"), { reactions: [...prev, entry] });
    } catch (e) {
      console.error("Errore invio reazione arena:", e);
      setReactCooldownUntil(0); // se fallisce, sblocca subito
    }
  };

  // Parallax hero: aggiorna CSS variable --arena-scroll su scroll, senza re-render.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      document.documentElement.style.setProperty("--arena-scroll", String(window.scrollY));
      raf = 0;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      document.documentElement.style.removeProperty("--arena-scroll");
    };
  }, []);

  // ── Active-fight UX: detect the user's current match so we can hoist it
  // to the top, auto-scroll into it, and float a "your turn" pulse when
  // the user scrolls away from the fight. ─────────────────────────────────
  const myActiveMatchId = useMemo(() => {
    if (!currentUser || !arenaMeta?.matches?.length) return null;
    const phaseInCombat = arenaMeta.phase === "combat";
    const m = arenaMeta.matches.find(mm =>
      ((mm.kind === "fun") || phaseInCombat) &&
      mm.players?.some(p => p.id === currentUser.uid) &&
      mm.status !== "open" &&
      mm.status !== "finished"
    );
    return m?.matchId || null;
  }, [arenaMeta, currentUser]);

  const isMyTurnInActive = useMemo(() => {
    if (!myActiveMatchId || !currentUser) return false;
    const m = arenaMeta?.matches?.find(mm => mm.matchId === myActiveMatchId);
    return !!(m && m.turn === currentUser.uid);
  }, [arenaMeta, myActiveMatchId, currentUser]);

  // Auto-scroll into the fight the first time a new active match appears.
  const lastScrolledMatchRef = useRef(null);
  useEffect(() => {
    if (!myActiveMatchId) { lastScrolledMatchRef.current = null; return; }
    if (lastScrolledMatchRef.current === myActiveMatchId) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById("arena-my-match");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        lastScrolledMatchRef.current = myActiveMatchId;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [myActiveMatchId]);

  // Hide the floating pulse when the match is comfortably in view.
  const [matchInView, setMatchInView] = useState(false);
  useEffect(() => {
    if (!myActiveMatchId) { setMatchInView(false); return; }
    if (typeof IntersectionObserver === "undefined") return;
    let cancelled = false;
    let observer = null;
    const trySetup = () => {
      if (cancelled) return;
      const el = document.getElementById("arena-my-match");
      if (!el) { requestAnimationFrame(trySetup); return; }
      observer = new IntersectionObserver(
        ([entry]) => setMatchInView(entry.isIntersecting),
        { rootMargin: "-20% 0px -55% 0px" }
      );
      observer.observe(el);
    };
    trySetup();
    return () => { cancelled = true; observer?.disconnect(); };
  }, [myActiveMatchId]);

  // Guardia anti–doppio click: impedisce che due attacchi/skill partano sulla stessa
  // istantanea di arenaMeta prima che updateDoc sia stato confermato da Firestore.
  // Senza, online (latenza > local) si possono accumulare clic che partono da uno
  // stato stantio e l'azione "non succede nulla" agli occhi dell'utente.
  const actionInFlightRef = useRef(false);

  // Master join setup
  const [masterJoinSetup, setMasterJoinSetup] = useState(false);
  const [masterJoinName, setMasterJoinName]   = useState("");
  const [masterJoinClass, setMasterJoinClass] = useState("");
  const [equipSelections, setEquipSelections] = useState({});

  // ── Arena Libera (Fun) ────────────────────────────────────────────────────
  // Loadout context: "tournament" (default) o "fun" (sfida libera).
  // funAcceptMatchId: null se sto creando una sfida, matchId se sto accettando.
  // aiMatchPending: true se il loadout sta preparando una sfida contro l'IA.
  const [loadoutContext, setLoadoutContext] = useState("tournament");
  const [funAcceptMatchId, setFunAcceptMatchId] = useState(null);
  const [aiMatchPending, setAiMatchPending] = useState(false);

  const isMaster = currentUser?.email === "santomassimo85@gmail.com";

  // ── My arena buffs (sblocchi acquistati in Bottega) — usato per gating classi/buff anche prima della loadout. ──
  const [myArenaBuffs, setMyArenaBuffs] = useState({});
  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(doc(db, "characters", currentUser.uid), snap => {
      if (snap.exists()) setMyArenaBuffs(snap.data().arenaBuffs || {});
    });
  }, [currentUser]);

  // ── Monete Arena ──────────────────────────────────────────────────────────
  const awardArenaCoins = async (uid, amount) => {
    try {
      await updateDoc(doc(db, "characters", uid), { arenaCoins: increment(amount) });
    } catch { /* NPC o doc mancante: ignora */ }
  };

  const awardRoundCoins = async (updatedMatches) => {
    for (const m of updatedMatches) {
      const prev = arenaMeta?.matches?.find(x => x.matchId === m.matchId);
      const justFinished = m.status === "finished" && prev?.status !== "finished";
      if (m.kind === "fun") {
        // 🐣 pet system: +1 point for completing an Arena Libera fight (capped 5/day)
        if (justFinished) {
          for (const p of (m.players || [])) {
            if (p?.id) awardPetPoints(p.id, "arena_libera", { resourceKey: m.matchId });
          }
        }
        continue; // Arena Libera: nessuna ricompensa MA
      }
      if (justFinished && m.winner) {
        await awardArenaCoins(m.winner, 7);
        // 🐣 pet system: +3 points to the winner of a tournament round
        awardPetPoints(m.winner, "arena_round", { resourceKey: m.matchId });
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

  const archiveTournament = async (winnerId, snapshotsOverride, participantsOverride, matchesOverride) => {
    const snaps = snapshotsOverride || arenaMeta?.characterSnapshots || {};
    const ids   = participantsOverride || arenaMeta?.participants || [];
    const matches = matchesOverride || arenaMeta?.matches || [];
    const wins = {}, losses = {};
    matches.forEach(m => {
      if (m.status !== "finished" || !m.winner) return;
      (m.players || []).forEach(p => {
        if (p.id === m.winner) wins[p.id] = (wins[p.id] || 0) + 1;
        else losses[p.id] = (losses[p.id] || 0) + 1;
      });
    });
    const participants = ids
      .map(uid => ({
        uid,
        name:  snaps[uid]?.name  || "",
        class: (snaps[uid]?.class || "").toLowerCase().trim(),
        matchWins:   wins[uid]   || 0,
        matchLosses: losses[uid] || 0,
      }))
      .filter(p => p.class);
    if (participants.length === 0) return;
    const winnerSnap = snaps[winnerId] || {};
    const winnerClass = (winnerSnap.class || "").toLowerCase().trim();
    try {
      await addDoc(collection(db, "arena_tournament_history"), {
        ts: serverTimestamp(),
        winnerId: winnerId || null,
        winnerName: winnerSnap.name || null,
        winnerImage: winnerSnap.image || null,
        winnerClass: winnerClass || null,
        participants,
      });
    } catch (e) {
      console.error("archiveTournament error:", e);
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
      if (m.kind === "fun") continue; // Arena Libera: nessuna scommessa
      const prev = arenaMeta?.matches?.find(x => x.matchId === m.matchId);
      if (m.status === "finished" && prev?.status !== "finished" && m.winner)
        await resolveMatchBets(m.matchId, m.winner);
    }
  };

  const recordMatchHistory = async (updatedMatches) => {
    const newEntries = [];
    for (const m of updatedMatches) {
      if (m.kind === "fun") continue; // Arena Libera: niente storico/statistiche
      const prev = arenaMeta?.matches?.find(x => x.matchId === m.matchId);
      if (m.status === "finished" && prev?.status !== "finished" && m.winner) {
        for (const p of m.players) {
          newEntries.push({ uid: p.id, result: p.id === m.winner ? "W" : "L", matchId: m.matchId, ts: new Date().toISOString() });
        }
      }
    }
    if (newEntries.length === 0) return;
    const existing = arenaMeta?.matchHistory || [];
    await updateDoc(doc(db, "arena_meta", "global"), { matchHistory: [...existing, ...newEntries] });
  };

  useEffect(() => {
    const ref = doc(db, "arena_meta", "global");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setArenaMeta(data);
        if (isMaster) setPrizeText(data.prizes || "");
      }
      /* Niente auto-setDoc: se il doc è temporaneamente assente (race con
         cache offline o emulator restart) NON ricreiamo nulla per non
         sovrascrivere i dati reali. L'inizializzazione avviene solo via
         pulsante Reset del Master. */
    });
    return () => unsub();
  }, [isMaster]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "arena_tournament_history"), (snap) => {
      setTournamentHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const championsRaw = useMemo(() => {
    const map = {};
    for (const t of tournamentHistory) {
      const uid = t.winnerId;
      if (!uid) continue;
      const prev = map[uid];
      const tsMs = t.ts?.toMillis ? t.ts.toMillis() : 0;
      if (!prev) {
        map[uid] = {
          uid,
          name:  t.winnerName  || null,
          class: t.winnerClass || null,
          image: t.winnerImage || null,
          wins:  1,
          lastWonAt: tsMs,
          entryIds: [t.id],
        };
      } else {
        prev.wins++;
        prev.entryIds.push(t.id);
        if (tsMs > prev.lastWonAt) {
          prev.lastWonAt = tsMs;
          prev.name  = t.winnerName  || prev.name;
          prev.class = t.winnerClass || prev.class;
          prev.image = t.winnerImage || prev.image;
        }
      }
    }
    return Object.values(map).sort((a, b) => b.wins - a.wins || b.lastWonAt - a.lastWonAt);
  }, [tournamentHistory]);

  // Lazy-fetch character profile for champions whose archived entry lacks name/image
  useEffect(() => {
    const missing = championsRaw
      .filter(c => (!c.name || !c.image) && !(c.uid in profileLookup))
      .map(c => c.uid);
    const lastChampUid = arenaMeta?.lastChampion?.uid;
    if (lastChampUid && !(lastChampUid in profileLookup)) missing.push(lastChampUid);
    const unique = [...new Set(missing)];
    if (unique.length === 0) return;
    (async () => {
      const updates = {};
      for (const uid of unique) {
        try {
          const snap = await getDoc(doc(db, "characters", uid));
          updates[uid] = snap.exists() ? { name: snap.data().name || null, image: snap.data().image || null } : { name: null, image: null };
        } catch {
          updates[uid] = { name: null, image: null };
        }
      }
      setProfileLookup(prev => ({ ...prev, ...updates }));
    })();
  }, [championsRaw, arenaMeta?.lastChampion?.uid, profileLookup]);

  const champions = useMemo(() =>
    championsRaw.map(c => ({
      ...c,
      name:  c.name  || profileLookup[c.uid]?.name  || null,
      image: c.image || profileLookup[c.uid]?.image || null,
    }))
  , [championsRaw, profileLookup]);

  const mostRecentChampion = useMemo(() => {
    const enrich = (champ) => champ ? {
      ...champ,
      name:  champ.name  || profileLookup[champ.uid]?.name  || null,
      image: champ.image || profileLookup[champ.uid]?.image || null,
    } : null;
    if (arenaMeta?.lastChampion?.uid) return enrich(arenaMeta.lastChampion);
    if (!tournamentHistory.length) return null;
    const sorted = [...tournamentHistory].sort((a, b) => {
      const at = a.ts?.toMillis ? a.ts.toMillis() : 0;
      const bt = b.ts?.toMillis ? b.ts.toMillis() : 0;
      return bt - at;
    });
    const latest = sorted.find(t => t.winnerId);
    if (!latest) return null;
    return enrich({
      uid:    latest.winnerId,
      name:   latest.winnerName  || null,
      class:  latest.winnerClass || null,
      image:  latest.winnerImage || null,
      prizes: "",
      wonAt:  latest.ts?.toDate?.()?.toISOString?.() || null,
    });
  }, [arenaMeta?.lastChampion, tournamentHistory, profileLookup]);

  // ── Auto-registra i match finiti in matchHistory (transazione idempotente) ──
  const syncMatchHistory = useCallback(async () => {
    if (!arenaMeta?.matches) return 0;
    const matches = arenaMeta.matches;
    try {
      const metaRef = doc(db, "arena_meta", "global");
      let addedCount = 0;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(metaRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const existing = data.matchHistory || [];
        const existingIds = new Set(existing.map(e => e.matchId));
        const toAdd = [];
        for (const m of matches) {
          if (m.kind === "fun") continue; // Arena Libera: niente storico
          if (m.status !== "finished" || !m.winner) continue;
          if (existingIds.has(m.matchId)) continue;
          for (const p of m.players) {
            toAdd.push({
              uid: p.id,
              result: p.id === m.winner ? "W" : "L",
              matchId: m.matchId,
              ts: new Date().toISOString(),
            });
          }
          existingIds.add(m.matchId);
        }
        if (toAdd.length === 0) return;
        addedCount = toAdd.length;
        tx.update(metaRef, { matchHistory: [...existing, ...toAdd] });
      });
      return addedCount;
    } catch (e) {
      console.error("syncMatchHistory error:", e);
      return -1;
    }
  }, [arenaMeta?.matches]);

  useEffect(() => {
    if (!isMaster || !arenaMeta?.matches) return;
    const processed = new Set((arenaMeta.matchHistory || []).map(e => e.matchId));
    const hasUnrecorded = arenaMeta.matches.some(
      m => m.kind !== "fun" && m.status === "finished" && m.winner && !processed.has(m.matchId)
    );
    if (!hasUnrecorded) return;
    syncMatchHistory();
  }, [isMaster, arenaMeta?.matches, arenaMeta?.matchHistory, syncMatchHistory]);

  // ── Archive finished fun matches in funMatchHistory (master) ──────────────
  // Permette di tenere statistiche delle Sfide Libere anche quando i match
  // vengono rimossi da arena_meta.matches.
  useEffect(() => {
    if (!isMaster || !arenaMeta?.matches) return;
    const archived = new Set((arenaMeta.funMatchHistory || []).map(e => e.matchId));
    const toArchive = arenaMeta.matches.filter(m =>
      m.kind === "fun" &&
      m.status === "finished" &&
      m.players?.length >= 2 &&
      !archived.has(m.matchId)
    );
    if (toArchive.length === 0) return;
    const snaps = arenaMeta.characterSnapshots || {};
    const additions = toArchive.map(m => {
      const winnerP = (m.players || []).find(p => p.id === m.winner);
      const loserP  = (m.players || []).find(p => p.id !== m.winner);
      const wClass = (winnerP?.class || snaps[winnerP?.id]?.class || "").toLowerCase().trim() || null;
      const lClass = (loserP?.class  || snaps[loserP?.id]?.class  || "").toLowerCase().trim() || null;
      return {
        matchId: m.matchId,
        winnerId: m.winner || null,
        winnerClass: wClass,
        loserClass:  lClass,
        ts: new Date().toISOString(),
      };
    });
    updateDoc(doc(db, "arena_meta", "global"), {
      funMatchHistory: [...(arenaMeta.funMatchHistory || []), ...additions],
    }).catch(e => console.error("funMatchHistory archive error:", e));
  }, [isMaster, arenaMeta?.matches, arenaMeta?.funMatchHistory, arenaMeta?.characterSnapshots]);

  // ── Auto-pulizia: rimuove dalle `matches` live le Sfide Libere finite e già
  // archiviate da un po' (finestra di grazia), così il doc arena_meta non si
  // gonfia all'infinito. NB: i vincitori restano in funMatchHistory / matchHistory
  // / lastChampion / arena_tournament_history — qui non si tocca nulla di quello.
  useEffect(() => {
    if (!isMaster || !arenaMeta?.matches) return;
    const archivedTs = new Map((arenaMeta.funMatchHistory || []).map(e => [e.matchId, e.ts]));
    const now = Date.now();
    const staleIds = new Set(
      arenaMeta.matches
        .filter(m =>
          m.kind === "fun" &&
          m.status === "finished" &&
          archivedTs.has(m.matchId) &&
          (now - new Date(archivedTs.get(m.matchId)).getTime()) > FUN_MATCH_PRUNE_GRACE_MS
        )
        .map(m => m.matchId)
    );
    if (staleIds.size === 0) return;
    const kept = arenaMeta.matches.filter(m => !staleIds.has(m.matchId));
    updateDoc(doc(db, "arena_meta", "global"), { matches: kept })
      .catch(e => console.error("prune fun matches error:", e));
  }, [isMaster, arenaMeta?.matches, arenaMeta?.funMatchHistory]);

  // ── Popup fine combattimento: appena un match a cui partecipo si conclude
  // con un vincitore, mostra "Hai Vinto!" (in grande) oppure "Hai Perso" con
  // chi ha vinto. Al primo caricamento i match già finiti sono marcati come
  // "visti" così il popup non riappare per scontri vecchi dopo un refresh.
  useEffect(() => {
    if (!currentUser || !arenaMeta?.matches) return;
    const mine = arenaMeta.matches.filter(m =>
      m.status === "finished" && m.winner && m.players?.some(p => p.id === currentUser.uid)
    );
    if (fightResultSeenRef.current === null) {
      fightResultSeenRef.current = new Set(mine.map(m => m.matchId));
      return;
    }
    const fresh = mine.find(m => !fightResultSeenRef.current.has(m.matchId));
    if (!fresh) return;
    fightResultSeenRef.current.add(fresh.matchId);
    const winnerP    = fresh.players.find(p => p.id === fresh.winner);
    const winnerSnap = snapshots[fresh.winner] || {};
    setFightResult({
      won:         fresh.winner === currentUser.uid,
      winnerName:  winnerP?.name || winnerSnap.name || "Sfidante",
      winnerImage: winnerSnap.image || null,
      winnerClass: winnerP?.class || winnerSnap.class || "",
    });
  }, [arenaMeta?.matches, currentUser, snapshots]);

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
      arenaTitles: getCharTitles(d),
      classLevels: d.classLevels || {},
      rolledHp:    null,
      hpRerollCount: 0,
    });
    setPendingStats({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
    setPendingWeapons([]);
    setPendingSpells([]);
    setPendingSkills([]);
    // Default: torneo. Le funzioni fun (openFunCreate/openFunAccept) sovrascrivono dopo questo.
    setLoadoutContext("tournament");
    setFunAcceptMatchId(null);
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
    const cls = (charPreview.class || "").toLowerCase();
    const buffs = charPreview.arenaBuffs || {};
    const monkPunchUpgraded = (buffs.monkPunchD8 ?? 0) > 0;
    const petAction = (isRangerClass(cls) && pendingPet && RANGER_PETS[pendingPet]) ? RANGER_PETS[pendingPet].action : null;
    const demonAction = (isWarlockClass(cls) && pendingDemon && WARLOCK_DEMONS[pendingDemon]) ? WARLOCK_DEMONS[pendingDemon].action : null;
    const constructAction = (isArtificerClass(cls) && pendingConstruct && ARTIFICER_CONSTRUCTS[pendingConstruct]) ? ARTIFICER_CONSTRUCTS[pendingConstruct].action : null;
    const finalActions = [
      ...pendingWeapons, ...pendingSpells, ...pendingSkills,
      ...config.autoActions.map(a => {
        if (a.special === "bardic_inspiration") return { ...a, maxUses: Math.max(1, chaScore) };
        if (a.name === "Pugno" && monkPunchUpgraded) return { ...a, damage: "1d8", info: "Colpo a mani nude · 1d8+DES (potenziato)" };
        return a;
      }),
      ...(petAction ? [petAction] : []),
      ...(demonAction ? [demonAction] : []),
      ...(constructAction ? [constructAction] : []),
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
      titles:          charPreview.arenaTitles || [],
      selectedPet:     petAction ? pendingPet : null,
      selectedDemon:   demonAction ? pendingDemon : null,
      selectedConstruct: constructAction ? pendingConstruct : null,
    };

    // ── Branch: Arena Libera (Sfida) ──────────────────────────────────────
    if (loadoutContext === "fun") {
      // Bug-guard: un partecipante al torneo non può creare/accettare sfide libere,
      // perché la registrazione fun sovrascriverebbe characterSnapshots[uid] e
      // cambierebbe la sua classe nei prossimi round del torneo.
      const inTournament =
        (arenaMeta?.participants || []).includes(currentUser.uid) ||
        (arenaMeta?.matches || []).some(
          m => m.kind !== "fun" && m.status !== "finished" &&
               (m.players || []).some(p => p.id === currentUser.uid)
        );
      if (inTournament) {
        alert("⚠ Sei iscritto a un torneo in corso. Non puoi creare o accettare Sfide Libere finché il torneo non termina (non puoi cambiare classe a torneo iniziato).");
        cancelLoadout();
        return;
      }
      const baseHp = snapshot.stats.maxHp;
      const itemUses = {};
      (snapshot.selectedItemKeys || []).forEach(k => { itemUses[k] = (itemUses[k] || 0) + 1; });
      const shopPotions = snapshot.arenaBuffs?.healingPotions ?? 0;
      if (shopPotions > 0) itemUses["pozione_cura_media"] = shopPotions;
      const layOfHandsPool = isPaladinClass((snapshot.class || "").toLowerCase()) ? Math.floor(baseHp / 3) : 0;
      // class embedded così le statistiche fun sopravvivono all'overwrite di characterSnapshots
      const playerObj = {
        id: currentUser.uid,
        name: snapshot.name || "?",
        class: (snapshot.class || "").toLowerCase().trim(),
        hp: baseHp, maxHp: baseHp, init: 0,
        itemUsesLeft: itemUses,
        layOfHandsPool,
      };

      if (aiMatchPending) {
        // ── SFIDA L'IA: crea un match già pronto al lancio (initiative).
        const matchId = `FUN_AI_${Date.now()}_${currentUser.uid}`;
        const { aiUid, snapshot: aiSnap, playerObj: aiPlayerObj, archetype } = makeAiSnapshotAndPlayer(matchId);
        const newMatch = {
          matchId,
          kind: "fun",
          ai: true,
          aiOwnerId: currentUser.uid,
          aiId: aiUid,
          aiArchetype: archetype,
          challengerId: currentUser.uid,
          opponentId: aiUid,
          players: [playerObj, aiPlayerObj],
          status: "initiative",
          turn: null,
          turnExpiry: new Date(Date.now() + ARENA_INITIATIVE_DURATION).toISOString(),
          logs: [
            `🛡 ${snapshot.name || "?"} sfida ${aiSnap.name} — Hard Mode AI.`,
            `⚡ Tirate iniziativa.`,
          ],
          winner: null,
          participantsAwarded: [],
          isFFA: false,
          createdAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: [...(arenaMeta.matches || []), newMatch],
          [`characterSnapshots.${currentUser.uid}`]: snapshot,
          [`characterSnapshots.${aiUid}`]: aiSnap,
        });
        cancelLoadout();
        return;
      }

      if (funAcceptMatchId) {
        // ACCETTA sfida esistente: aggiungo come secondo giocatore + parte iniziativa.
        const targetMatch = (arenaMeta.matches || []).find(m => m.matchId === funAcceptMatchId);
        if (!targetMatch || targetMatch.status !== "open") {
          alert("⚠ La sfida non è più disponibile.");
          cancelLoadout();
          return;
        }
        const updatedMatches = (arenaMeta.matches || []).map(m => {
          if (m.matchId !== funAcceptMatchId) return m;
          return {
            ...m,
            opponentId: currentUser.uid,
            players: [...(m.players || []), playerObj],
            status: "initiative",
            turn: null,
            turnExpiry: new Date(Date.now() + ARENA_INITIATIVE_DURATION).toISOString(),
            logs: [...(m.logs || []), `⚔ ${snapshot.name || "?"} accetta la sfida! Tirate iniziativa.`],
          };
        });
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: updatedMatches,
          [`characterSnapshots.${currentUser.uid}`]: snapshot,
        });
      } else {
        // CREA nuova sfida aperta.
        const newMatch = {
          matchId: `FUN_${Date.now()}_${currentUser.uid}`,
          kind: "fun",
          challengerId: currentUser.uid,
          opponentId: null,
          players: [playerObj],
          status: "open",
          turn: null,
          turnExpiry: null,
          logs: [`🛡 ${snapshot.name || "?"} ha aperto una Sfida Libera. In attesa di un avversario…`],
          winner: null,
          participantsAwarded: [],
          isFFA: false,
          createdAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: [...(arenaMeta.matches || []), newMatch],
          [`characterSnapshots.${currentUser.uid}`]: snapshot,
        });
      }
      cancelLoadout();
      return;
    }

    if (arenaMeta?.championsOnly) {
      const isChampion = tournamentHistory.some(t => t.winnerId === currentUser.uid);
      if (!isChampion) {
        alert("⚠ Questo è un torneo Solo Campioni: solo chi ha già vinto un torneo può iscriversi.");
        return;
      }
    }

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
    setPendingPet(null);
    setPendingDemon(null);
    setPendingConstruct(null);
    setPendingItemCounts({ pozione_cura: 0, bomba: 0, pozione_veleno: 0 });
    setLoadoutContext("tournament");
    setFunAcceptMatchId(null);
    setAiMatchPending(false);
  };

  // ── ARENA LIBERA: open/cancel/abandon ─────────────────────────────────────
  // L'Arena Libera è sempre disponibile, anche per chi è iscritto al torneo.
  const openFunCreate = async () => {
    await openLoadoutPicker();
    // Sovrascrivo il default "tournament" impostato da openLoadoutPicker.
    setLoadoutContext("fun");
    setFunAcceptMatchId(null);
    setAiMatchPending(false);
  };

  // Solo-vs-AI: stesso loadout della Sfida Libera, ma genera un avversario
  // gestito dal client. L'IA prende decisioni di combattimento sul tuo
  // browser quando è il suo turno.
  const openAiCreate = async () => {
    await openLoadoutPicker();
    setLoadoutContext("fun");
    setFunAcceptMatchId(null);
    setAiMatchPending(true);
  };

  const openFunAccept = async (matchId) => {
    const target = (arenaMeta?.matches || []).find(m => m.matchId === matchId);
    if (!target || target.status !== "open") { alert("Sfida non più disponibile."); return; }
    if (target.challengerId === currentUser?.uid) { alert("Non puoi accettare la tua stessa sfida."); return; }
    await openLoadoutPicker();
    setLoadoutContext("fun");
    setFunAcceptMatchId(matchId);
  };

  /* Auto-scroll to the loadout panel when it opens for an Arena Libera
     create/accept. Without this, players get stuck staring at the
     unchanged screen because the panel renders far below the fold.
     We only scroll on the *initial* open (idle → class-select) so the
     view doesn't jump every time the user advances a step. */
  const prevLoadoutPhaseRef = useRef("idle");
  useEffect(() => {
    const prev = prevLoadoutPhaseRef.current;
    prevLoadoutPhaseRef.current = loadoutPhase;
    if (loadoutContext !== "fun") return;
    if (!(prev === "idle" && loadoutPhase !== "idle")) return;
    // Wait two frames so the panel is mounted + painted before scrolling.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = document.getElementById("arena-loadout");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [loadoutPhase, loadoutContext]);

  const cancelFunChallenge = async (matchId) => {
    const m = (arenaMeta?.matches || []).find(x => x.matchId === matchId);
    if (!m || m.kind !== "fun" || m.status !== "open") return;
    if (m.challengerId !== currentUser?.uid && !isMaster) return;
    const updatedMatches = (arenaMeta.matches || []).filter(x => x.matchId !== matchId);
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const abandonFunMatch = async (matchId) => {
    const m = (arenaMeta?.matches || []).find(x => x.matchId === matchId);
    if (!m || m.kind !== "fun" || m.status === "finished") return;
    if (!m.players?.some(p => p.id === currentUser?.uid) && !isMaster) return;
    if (!window.confirm("Abbandonare la sfida?")) return;
    const opponent = (m.players || []).find(p => p.id !== currentUser?.uid);
    const meName = (m.players || []).find(p => p.id === currentUser?.uid)?.name || "?";
    const winnerId = opponent?.id || null;
    const updatedMatches = (arenaMeta.matches || []).map(x => {
      if (x.matchId !== matchId) return x;
      return {
        ...x,
        status: "finished",
        winner: winnerId,
        logs: [...(x.logs || []), `🏳 ${meName} ha abbandonato la sfida.${opponent ? ` 🛡 ${opponent.name} vince.` : ""}`],
      };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const removeFunMatch = async (matchId) => {
    const m = (arenaMeta?.matches || []).find(x => x.matchId === matchId);
    if (!m || m.kind !== "fun" || m.status !== "finished") return;
    if (!m.players?.some(p => p.id === currentUser?.uid) && !isMaster) return;
    const updatedMatches = (arenaMeta.matches || []).filter(x => x.matchId !== matchId);
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
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
  const MASTER_JOIN_CLASSES_BASE = ["Fighter","Barbarian","Paladin","Ranger","Monk","Rogue","Wizard","Sorcerer","Warlock","Druid","Cleric","Bard"];
  const MASTER_JOIN_CLASSES = (() => {
    const base = MASTER_JOIN_CLASSES_BASE.slice();
    // Sblocca Artefice solo se il giocatore corrente lo ha acquistato in Bottega (vale anche per il master).
    const buffs = charPreview?.arenaBuffs ?? myArenaBuffs ?? {};
    if ((buffs.classArtificer ?? 0) > 0) base.push("Artificer");
    return base;
  })();

  // ── Genera un PG d'Arena completo e casuale (classe, stat, HP, armi,
  //    incantesimi, armatura, scudo, oggetto, pet/demone/costrutto) e porta
  //    direttamente alla fase di revisione "selecting". ──
  const autoGeneratePg = () => {
    if (!charPreview) return;
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

    const classPool = MASTER_JOIN_CLASSES.length ? MASTER_JOIN_CLASSES : MASTER_JOIN_CLASSES_BASE;
    const cls = rnd(classPool);
    const clsLower = (cls || "").toLowerCase();
    const config = getLoadoutConfig(cls);

    // stat: 10 punti casuali, cap 3 per stat
    const stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const keys = Object.keys(stats);
    let rem = 10, guard = 0;
    while (rem > 0 && guard++ < 500) {
      const k = rnd(keys);
      if (stats[k] < 3) { stats[k]++; rem--; }
      else if (keys.every(kk => stats[kk] >= 3)) break;
    }

    // HP
    const { count, sides } = getHpDice(cls, charPreview.classLevels);
    let hp = 0;
    for (let i = 0; i < count; i++) hp += Math.floor(Math.random() * sides) + 1;
    hp = Math.max(1, hp + (stats.con || 0) * count);

    // armi
    const weapons = shuffle(config.weaponOptions).slice(0, config.maxWeapons);
    const has2H = weapons.some(w => w.twoHanded);

    // incantesimi (rispetta i limiti per livello; salta i livelli bloccati ≥3)
    const spells = [];
    const limits = config.spellLimits || {};
    for (const sp of shuffle(config.spellOptions)) {
      if (spells.length >= config.maxSpells) break;
      const lvl = sp.level ?? 0;
      if (lvl >= 3) continue;
      const atLvl = spells.filter(s => (s.level ?? 0) === lvl).length;
      if (atLvl >= (limits[lvl] ?? 0)) continue;
      spells.push(sp);
    }

    // armatura
    const armorList = ARENA_ARMORS[config.armorCategory] || [];
    const armor = armorList.length ? rnd(armorList) : null;

    // scudo (se idoneo e nessuna arma a due mani)
    let shield = null;
    if (config.canHaveShield && !has2H) {
      const opts = config.canHaveShield === "wood" ? ["legno", null] : ["legno", "metallo", null];
      shield = rnd(opts);
    }

    // oggetto: 1 a caso (esclusi quelli solo-bottega)
    const itemCounts = { pozione_cura: 0, bomba: 0, pozione_veleno: 0 };
    const itemPool = ARENA_ITEMS.filter(i => !i.shopOnly && itemCounts[i.key] !== undefined);
    if (itemPool.length) itemCounts[rnd(itemPool).key] = 1;

    // pet / demone / costrutto se richiesti dalla classe
    let pet = null, demon = null, construct = null;
    if (isRangerClass(clsLower)) {
      const buffs = charPreview.arenaBuffs || {};
      const pets = Object.values(RANGER_PETS).filter(p => !p.requiresBuff || (buffs[p.requiresBuff] ?? 0) > 0);
      pet = pets.length ? rnd(pets).key : null;
    }
    if (isWarlockClass(clsLower))   demon = rnd(Object.values(WARLOCK_DEMONS)).key;
    if (isArtificerClass(clsLower)) construct = rnd(Object.values(ARTIFICER_CONSTRUCTS)).key;

    setCharPreview(prev => ({ ...prev, class: cls, stats, rolledHp: hp, hpRerollCount: 0 }));
    setPendingStats(stats);
    setPendingWeapons(weapons);
    setPendingSpells(spells);
    setPendingSkills([]);
    setPendingArmor(armor);
    setPendingShield(shield);
    setPendingItemCounts(itemCounts);
    setPendingPet(pet);
    setPendingDemon(demon);
    setPendingConstruct(construct);
    setLoadoutPhase("selecting");
  };

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
    let arenaBuffs = {};
    try {
      const charSnap = await getDoc(doc(db, "characters", currentUser.uid));
      if (charSnap.exists()) {
        const d = charSnap.data();
        classLevels = d.classLevels || {};
        arenaBuffs = d.arenaBuffs || {};
      }
    } catch { /* ignore */ }
    setCharPreview({
      name:        masterJoinName.trim(),
      image:       null,
      class:       masterJoinClass,
      stats,
      classLevels,
      arenaBuffs,
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

  const benchParticipant = async (uid) => {
    await updateDoc(doc(db, "arena_meta", "global"), {
      participants: arrayRemove(uid),
      waitingList:  arrayUnion(uid),
    });
  };

  const benchAllParticipants = async () => {
    const ps = arenaMeta.participants || [];
    if (ps.length === 0) return;
    const merged = Array.from(new Set([...(arenaMeta.waitingList || []), ...ps]));
    await updateDoc(doc(db, "arena_meta", "global"), {
      participants: [],
      waitingList:  merged,
    });
  };

  const clearWaitingList = async () => {
    if ((arenaMeta.waitingList || []).length === 0) return;
    if (!window.confirm("Svuotare la lista d'attesa? Le iscrizioni in attesa verranno rimosse.")) return;
    const waitingIds  = arenaMeta.waitingList || [];
    const participants = new Set(arenaMeta.participants || []);
    const funUids = new Set();
    (arenaMeta.matches || []).filter(m => m.kind === "fun").forEach(m =>
      (m.players || []).forEach(p => funUids.add(p.id))
    );
    const snaps = { ...(arenaMeta.characterSnapshots || {}) };
    let snapsChanged = false;
    waitingIds.forEach(uid => {
      if (!participants.has(uid) && !funUids.has(uid) && snaps[uid]) {
        delete snaps[uid];
        snapsChanged = true;
      }
    });
    const updates = { waitingList: [] };
    if (snapsChanged) updates.characterSnapshots = snaps;
    await updateDoc(doc(db, "arena_meta", "global"), updates);
  };

  // ── Round-robin helpers ────────────────────────────────────────────────────
  // Circle method: for N ids returns rounds[][pair] schedule. Adds a bye when N is odd.
  const roundRobinSchedule = (ids) => {
    const players = [...ids];
    if (players.length < 2) return [];
    if (players.length % 2 === 1) players.push(null);
    const n = players.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = players[i];
        const b = players[n - 1 - i];
        if (a && b) pairs.push([a, b]);
      }
      rounds.push(pairs);
      // rotate, keeping first fixed
      const fixed = players[0];
      const rest  = players.slice(1);
      rest.unshift(rest.pop());
      players.length = 0;
      players.push(fixed, ...rest);
    }
    return rounds;
  };

  const buildPlayerForMatch = (id, snapshots) => {
    const snap = snapshots[id] || {};
    const baseHp   = snap.stats?.maxHp ?? 70;
    const startHp  = baseHp + (snap.arenaHpBonus ?? 0);
    const itemUses = {};
    (snap.selectedItemKeys || []).forEach(k => { itemUses[k] = (itemUses[k] || 0) + 1; });
    const shopPotions = snap.arenaBuffs?.healingPotions ?? 0;
    if (shopPotions > 0) itemUses["pozione_cura_media"] = shopPotions;
    const lockedClass = (snap.class || "").toLowerCase().trim();
    const layOfHandsPool = isPaladinClass(lockedClass) ? Math.floor(startHp / 3) : 0;
    // Embed `class` so the tournament class is locked at match-build time and
    // cannot be silently changed by later writes to characterSnapshots.
    return { id, name: snap.name || "Sconosciuto", class: lockedClass, hp: startHp, maxHp: startHp, init: 0, itemUsesLeft: itemUses, layOfHandsPool };
  };

  const buildGroupRoundMatches = (group, round, snapshots) => {
    const ids = group === "A" ? (arenaMeta.groupA || []) : (arenaMeta.groupB || []);
    const schedule = roundRobinSchedule(ids);
    const pairs = schedule[round - 1] || [];
    return pairs.map((pair, idx) => ({
      matchId: `G${group}_R${round}_M${idx}`,
      kind: "group",
      group,
      players: pair.map(id => buildPlayerForMatch(id, snapshots)),
      status: "initiative", turn: null, turnExpiry: new Date(Date.now() + ARENA_INITIATIVE_DURATION).toISOString(),
      logs:   ["⚔️ Il match ha inizio!"], winner: null, participantsAwarded: [],
      isFFA:  false,
    }));
  };

  const buildFinalMatch = (winnerA, winnerB, snapshots) => ({
    matchId: "FINAL_M0",
    kind: "final",
    group: null,
    players: [buildPlayerForMatch(winnerA, snapshots), buildPlayerForMatch(winnerB, snapshots)],
    status: "initiative", turn: null, turnExpiry: new Date(Date.now() + ARENA_INITIATIVE_DURATION).toISOString(),
    logs:   ["🏆 La Finale ha inizio!"], winner: null, participantsAwarded: [],
    isFFA:  false,
  });

  const computeGroupStandings = (group, matches) => {
    const ids = group === "A" ? (arenaMeta.groupA || []) : (arenaMeta.groupB || []);
    const wins = {}, losses = {};
    const h2h = {}; // h2h[a][b] = winnerId
    matches.forEach(m => {
      if (m.kind !== "group" || m.group !== group) return;
      if (m.status !== "finished" || !m.winner) return;
      (m.players || []).forEach(p => {
        if (p.id === m.winner) wins[p.id] = (wins[p.id] || 0) + 1;
        else losses[p.id] = (losses[p.id] || 0) + 1;
      });
      if (m.players?.length === 2) {
        const [a, b] = m.players.map(p => p.id);
        h2h[a] = h2h[a] || {}; h2h[b] = h2h[b] || {};
        h2h[a][b] = m.winner; h2h[b][a] = m.winner;
      }
    });
    const standings = ids.map(uid => ({
      uid,
      wins:   wins[uid]   || 0,
      losses: losses[uid] || 0,
    }));
    standings.sort((p, q) => {
      if (q.wins !== p.wins) return q.wins - p.wins;
      // tiebreak: head-to-head winner
      const w = h2h[p.uid]?.[q.uid];
      if (w === p.uid) return -1;
      if (w === q.uid) return 1;
      return 0;
    });
    return standings;
  };

  const groupRoundsTotal = () => {
    const a = roundRobinSchedule(arenaMeta.groupA || []).length;
    const b = roundRobinSchedule(arenaMeta.groupB || []).length;
    return Math.max(a, b);
  };

  const startTournament = async () => {
    if ((arenaMeta.participants || []).length < 2) return alert("Minimo 2 partecipanti!");
    const shuffled = [...arenaMeta.participants].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    const groupA = shuffled.slice(0, half);
    const groupB = shuffled.slice(half);
    const snapshots = arenaMeta.characterSnapshots || {};
    const existingFun = (arenaMeta.matches || []).filter(m => m.kind === "fun");
    // Generate round 1 group matches (need groupA/groupB temporarily applied to local ref)
    const scheduleA = roundRobinSchedule(groupA);
    const scheduleB = roundRobinSchedule(groupB);
    const r1Matches = [];
    (scheduleA[0] || []).forEach((pair, idx) => {
      r1Matches.push({
        matchId: `GA_R1_M${idx}`, kind: "group", group: "A",
        players: pair.map(id => buildPlayerForMatch(id, snapshots)),
        status: "initiative", turn: null, turnExpiry: new Date(Date.now() + ARENA_INITIATIVE_DURATION).toISOString(),
        logs: ["⚔️ Il match ha inizio!"], winner: null, participantsAwarded: [], isFFA: false,
      });
    });
    (scheduleB[0] || []).forEach((pair, idx) => {
      r1Matches.push({
        matchId: `GB_R1_M${idx}`, kind: "group", group: "B",
        players: pair.map(id => buildPlayerForMatch(id, snapshots)),
        status: "initiative", turn: null, turnExpiry: new Date(Date.now() + ARENA_INITIATIVE_DURATION).toISOString(),
        logs: ["⚔️ Il match ha inizio!"], winner: null, participantsAwarded: [], isFFA: false,
      });
    });
    // Edge case: a group with a single player has no matches in round 1; if both groups generated nothing,
    // jump straight to the final between the two lone players.
    let initialMatches = [...existingFun, ...r1Matches];
    if (r1Matches.length === 0 && groupA.length === 1 && groupB.length === 1) {
      initialMatches = [...existingFun, buildFinalMatch(groupA[0], groupB[0], snapshots)];
    }
    await updateDoc(doc(db, "arena_meta", "global"), {
      matches: initialMatches, phase: "combat", currentRound: 1, tournamentWinner: null,
      groupA, groupB,
    });
  };

  const advanceRound = async () => {
    const cr = arenaMeta.currentRound || 1;
    const snapshots = arenaMeta.characterSnapshots || {};
    const totalGroupRounds = groupRoundsTotal();
    const finalExists = (arenaMeta.matches || []).some(m => m.kind === "final");
    const groupA = arenaMeta.groupA || [];
    const groupB = arenaMeta.groupB || [];

    /* Diagnostic context — the tournament was silently halting at the
       round → final boundary with no UI feedback. Log + alert any
       reason we bail so the master can see why nothing happened. */
    const ctx = { cr, totalGroupRounds, finalExists, groupA: groupA.length, groupB: groupB.length };
    console.log("[arena] advanceRound", ctx);

    try {
      if (cr < totalGroupRounds) {
        const next = cr + 1;
        const matches = arenaMeta.matches || [];
        const more = [
          ...buildGroupRoundMatches("A", next, snapshots),
          ...buildGroupRoundMatches("B", next, snapshots),
        ];
        if (more.length === 0) {
          console.warn("[arena] advanceRound: no matches generated for round", next, ctx);
          alert(`Errore: nessun match generato per il Round ${next}.\nGirone A: ${groupA.length} giocatori · Girone B: ${groupB.length} giocatori.\nControlla che entrambi i gironi abbiano almeno 2 giocatori.`);
          return;
        }
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: [...matches, ...more], currentRound: next,
        });
        console.log("[arena] advanceRound: generated", more.length, "matches for round", next);
        return;
      }

      if (finalExists) {
        console.log("[arena] advanceRound: final already exists, nothing to do");
        return;
      }

      const standA = computeGroupStandings("A", arenaMeta.matches || []);
      const standB = computeGroupStandings("B", arenaMeta.matches || []);
      const winnerA = standA[0]?.uid;
      const winnerB = standB[0]?.uid;
      console.log("[arena] advanceRound: standings A:", standA, "B:", standB);
      if (!winnerA || !winnerB) {
        console.warn("[arena] advanceRound: missing winners", { winnerA, winnerB, standA, standB });
        alert(`Errore: impossibile determinare i vincitori dei gironi.\nGirone A: ${standA.length} classifiche · Girone B: ${standB.length} classifiche.\nProbabilmente uno dei gironi non ha partecipanti.`);
        return;
      }
      const finalMatch = buildFinalMatch(winnerA, winnerB, snapshots);
      await updateDoc(doc(db, "arena_meta", "global"), {
        matches: [...(arenaMeta.matches || []), finalMatch],
      });
      console.log("[arena] advanceRound: final generated", winnerA, "vs", winnerB);
    } catch (e) {
      console.error("[arena] advanceRound failed:", e);
      alert(`Errore durante l'avanzamento del torneo: ${e?.message || e}`);
    }
  };

  const sendChampionNotification = async (winnerId, winnerName, prizes, matchesOverride) => {
    const prizeMsg = prizes ? `Il tuo premio: ${prizes}` : "Che il tuo valore sia ricordato nelle cronache di Exanthia!";
    await addDoc(collection(db, "notifications"), {
      userId: winnerId,
      title:  "🏆 Campione dell'Arena!",
      message: `${winnerName}, hai trionfato nell'Arena dei Campioni! ${prizeMsg}`,
      read: false, timestamp: serverTimestamp(),
    });
    await awardArenaCoins(winnerId, 30);
    await resolveTournamentBets(winnerId, winnerName);
    await archiveTournament(winnerId, undefined, undefined, matchesOverride);
    const winnerSnap = (arenaMeta?.characterSnapshots || {})[winnerId] || {};
    await updateDoc(doc(db, "arena_meta", "global"), {
      lastChampion: {
        uid:     winnerId,
        name:    winnerSnap.name  || winnerName || "Campione",
        class:   winnerSnap.class || null,
        image:   winnerSnap.image || null,
        prizes:  prizes || "",
        wonAt:   new Date().toISOString(),
      },
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
    const hasAdv = isRogueClass((mySnap?.class || "").toLowerCase());
    const d20a   = Math.floor(Math.random() * 20) + 1;
    const d20b   = hasAdv ? Math.floor(Math.random() * 20) + 1 : 0;
    const d20    = hasAdv ? Math.max(d20a, d20b) : d20a;
    const roll   = d20 + dex;
    await showD20Roll(d20, { label: "Iniziativa" });
    const advTag = hasAdv ? ` 🌟vant.[${d20a},${d20b}]` : "";
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
        logs:   [...m.logs, `🎲 ${mySnap?.name ?? "?"} tira iniziativa: ${roll}${advTag}`],
      };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── AI auto-actor ────────────────────────────────────────────────────────
  // Drives an AI opponent (Sfida l'IA): rolls initiative + takes a weapon
  // attack on its turn. Runs only on the AI match owner's client so a single
  // browser controls the bot. Reads latest arenaMeta via a ref to avoid
  // acting on stale state captured by setTimeout closures.
  const arenaMetaRef = useRef(null);
  useEffect(() => { arenaMetaRef.current = arenaMeta; }, [arenaMeta]);
  const aiInFlightRef = useRef({});

  const aiRollInitiative = async (matchId) => {
    const meta = arenaMetaRef.current;
    if (!meta) return;
    const m = meta.matches?.find(mm => mm.matchId === matchId);
    if (!m || m.status !== "initiative") return;
    const aiId = m.aiId;
    const aiSnap = meta.characterSnapshots?.[aiId];
    if (!aiSnap || !aiId) return;
    const aiPlayer = m.players?.find(p => p.id === aiId);
    if (!aiPlayer || aiPlayer.init > 0) return;
    const dex = aiSnap.stats?.dex ?? 0;
    const d20 = Math.floor(Math.random() * 20) + 1;
    const roll = d20 + dex;
    const updatedMatches = meta.matches.map(x => {
      if (x.matchId !== matchId) return x;
      const updatedPlayers = x.players.map(p =>
        p.id === aiId ? { ...p, init: roll } : p
      );
      const allRolled = updatedPlayers.every(p => p.init > 0);
      const sorted    = [...updatedPlayers].sort((a, b) => b.init - a.init);
      return {
        ...x,
        players:     updatedPlayers,
        status:      allRolled ? "active" : "initiative",
        turn:        allRolled ? sorted[0].id : null,
        turnExpiry:  allRolled
          ? new Date(Date.now() + ARENA_TURN_DURATION).toISOString()
          : (x.turnExpiry || new Date(Date.now() + ARENA_INITIATIVE_DURATION).toISOString()),
        fightStartAt: allRolled ? new Date().toISOString() : (x.fightStartAt || null),
        logs: [...x.logs, `🎲 ${aiSnap.name} tira iniziativa: ${roll}`],
      };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // Master AI turn handler — chains heal → first-turn buff → attack → Action
  // Surge. Returns control to the human only when the AI exhausts all its
  // action economy for the turn. Driven by the useEffect, which re-fires this
  // each time the AI still has actions left and the match state changed.
  const aiTakeAction = async (matchId) => {
    const meta = arenaMetaRef.current;
    if (!meta) return;
    const m = meta.matches?.find(mm => mm.matchId === matchId);
    if (!m || m.status !== "active") return;
    const aiId = m.aiId;
    if (!aiId || m.turn !== aiId) return;
    const aiSnap = meta.characterSnapshots?.[aiId];
    const aiPlayer = m.players.find(p => p.id === aiId);
    const target = m.players.find(p => p.id !== aiId && p.hp > 0);
    if (!aiSnap || !aiPlayer || aiPlayer.hp <= 0 || !target) return;
    const targetSnap = meta.characterSnapshots?.[target.id];
    if (!targetSnap) return;

    const aiName = aiSnap.name || "Avversario";

    // ── PHASE 0 — Resolve any pending TS the AI owes BEFORE acting ──────────
    // The AI is a fully-fledged player: when the human lands a control
    // spell, save-vs-poison, etc., the AI must roll its own TS (visible
    // d20 popup, same flow the human goes through). Pass → clear and act
    // normally. Fail → apply the consequence and end the AI's turn.
    if (aiPlayer.pendingControlSave) {
      const isCorona = aiPlayer.pendingControlSave === "corona_pazzia";
      const ctrlAbility = aiPlayer.pendingControlSaveAbility || "wis";
      const ctrlDC      = aiPlayer.pendingControlDC || 13;
      const ctrlMod     = aiSnap.stats?.[ctrlAbility] ?? 0;
      const saveBuffActive = (aiPlayer.saveBuffAttacks ?? 0) > 0;
      const saveBuffBonus  = saveBuffActive ? (aiPlayer.saveBuffBonus ?? 0) : 0;
      const d20 = Math.floor(Math.random() * 20) + 1;
      const lbl = SAVE_LABEL[ctrlAbility] || ctrlAbility.toUpperCase();
      await showD20Roll(d20, { label: `TS · ${lbl} · ${aiName}` });
      const total = d20 + ctrlMod + saveBuffBonus;
      const pass  = total >= ctrlDC;
      const sign  = ctrlMod >= 0 ? "+" : "";
      const buffTag = saveBuffBonus > 0 ? `+${saveBuffBonus}🛡` : "";
      const tsLabel = isCorona ? "Corona della Pazzia" : "Controllo";
      const expiry  = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();

      let resultLog;
      const passTurnAfter = !pass; // fail → end AI turn (skip / corona)

      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const players = x.players.map(p => {
          if (p.id !== aiId) return p;
          const up = { ...p };
          // Decrement save-buff counter if it contributed.
          if (saveBuffActive) {
            const newAtk = Math.max(0, (p.saveBuffAttacks ?? 0) - 1);
            up.saveBuffAttacks = newAtk;
            if (newAtk === 0) up.saveBuffBonus = 0;
          }
          if (pass) {
            delete up.pendingControlSave;
            delete up.pendingControlDC;
            delete up.pendingControlSaveAbility;
            up.controlLostTurns = 0;
            resultLog = `🌀 ${aiName} TS ${lbl} ${tsLabel}: ${d20}${sign}${ctrlMod}${buffTag}=${total} vs CD ${ctrlDC} → ✅ PASSA — si libera e agisce.`;
          } else if (isCorona) {
            // Corona: self-damage with equipped weapon, no recurring TS.
            const equipped = p.equippedWeaponNames?.[0];
            const weapon = (aiSnap.selectedActions || []).find(a => a.name === equipped && a.type === "weapon");
            const { total: selfDmg, rolls: selfRolls } = rollDmg(weapon?.damage || "1d6");
            up.hp = Math.max(0, (up.hp ?? 0) - selfDmg);
            delete up.pendingControlSave;
            delete up.pendingControlDC;
            delete up.pendingControlSaveAbility;
            resultLog = `🌀 ${aiName} TS ${lbl} ${tsLabel}: ${d20}${sign}${ctrlMod}${buffTag}=${total} vs CD ${ctrlDC} → ❌ FALLISCE — attacca sé stesso con ${weapon?.icon || "⚔"} ${equipped || "arma"}: ${selfDmg} danni [🎲${selfRolls}].`;
          } else {
            // Regular control fail: burn one budget turn, keep TS armed if budget remains.
            const remaining = Math.max(0, (p.controlLostTurns ?? 2) - 1);
            up.controlLostTurns = remaining;
            up.multiActionsUsed = 0;
            up.turnWeaponsUsed = [];
            up.turnSkillUsed = false;
            up.bonusActionUsed = false;
            if (remaining > 0) {
              resultLog = `🌀 ${aiName} TS ${lbl} ${tsLabel}: ${d20}${sign}${ctrlMod}${buffTag}=${total} vs CD ${ctrlDC} → ❌ FALLISCE — turno saltato (${remaining} rimanenti).`;
            } else {
              delete up.pendingControlSave;
              delete up.pendingControlDC;
              delete up.pendingControlSaveAbility;
              resultLog = `🌀 ${aiName} TS ${lbl} ${tsLabel}: ${d20}${sign}${ctrlMod}${buffTag}=${total} vs CD ${ctrlDC} → ❌ FALLISCE — turno saltato, effetto esaurito.`;
            }
          }
          return up;
        });
        const next = passTurnAfter
          ? { turn: target.id, turnExpiry: expiry }
          : {};
        return { ...x, players, logs: [...x.logs, resultLog], ...next };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return; // on pass, the watcher re-fires with pendingControlSave cleared
    }

    if (aiPlayer.pendingSaveDot) {
      const dot     = aiPlayer.pendingSaveDot;
      const ability = dot.ability || "con";
      const dc      = dot.dc || 13;
      const mod     = aiSnap.stats?.[ability] ?? 0;
      const saveBuffActive = (aiPlayer.saveBuffAttacks ?? 0) > 0;
      const saveBuffBonus  = saveBuffActive ? (aiPlayer.saveBuffBonus ?? 0) : 0;
      const d20 = Math.floor(Math.random() * 20) + 1;
      const lbl = SAVE_LABEL[ability] || ability.toUpperCase();
      await showD20Roll(d20, { label: `TS · ${lbl} · ${aiName}` });
      const total = d20 + mod + saveBuffBonus;
      const pass  = total >= dc;
      const sign  = mod >= 0 ? "+" : "";
      const buffTag = saveBuffBonus > 0 ? `+${saveBuffBonus}🛡` : "";
      const dotName = dot.name || "Veleno";
      const dotIcon = dot.icon || "🤢";

      const resultLog = pass
        ? `${dotIcon} ${aiName} TS ${lbl} (${dotName}): ${d20}${sign}${mod}${buffTag}=${total} vs CD ${dc} → ✅ PASSA — resiste!`
        : `${dotIcon} ${aiName} TS ${lbl} (${dotName}): ${d20}${sign}${mod}${buffTag}=${total} vs CD ${dc} → ❌ FALLISCE — Avvelenato! ${dot.dice || "2d6"} a inizio turno per ${dot.turns ?? 3} turni.`;

      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const players = x.players.map(p => {
          if (p.id !== aiId) return p;
          const up = { ...p };
          delete up.pendingSaveDot;
          if (saveBuffActive) {
            const newAtk = Math.max(0, (p.saveBuffAttacks ?? 0) - 1);
            up.saveBuffAttacks = newAtk;
            if (newAtk === 0) up.saveBuffBonus = 0;
          }
          if (!pass) {
            up.poisonDoT = true;
            up.poisonDoTTurns = dot.turns ?? 3;
            up.poisonDoTDice  = dot.dice  ?? "2d6";
            up.poisonDoTSourceLabel = dotName;
            up.poisonDoTIcon = dotIcon;
          }
          return up;
        });
        return { ...x, players, logs: [...x.logs, resultLog] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return; // watcher will re-fire; AI then acts (or ticks poison) next time
    }

    // Apply a pending poisonDoT tick at the very start of the AI's turn —
    // mirrors the human flow where the poison hits on turn entry.
    if (aiPlayer.poisonDoT && (aiPlayer.poisonResolvedTurnToken || "") !== (m.turnExpiry || "")) {
      const dice = aiPlayer.poisonDoTDice || "1d6";
      const { total: poisonDmg, rolls: poisonRolls } = rollDmg(dice);
      const sourceLabel = aiPlayer.poisonDoTSourceLabel || "veleno";
      const icon = aiPlayer.poisonDoTIcon || "☠";
      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const rawPlayers = x.players.map(p => {
          if (p.id !== aiId) return p;
          const remaining = Math.max(0, (p.poisonDoTTurns ?? 1) - 1);
          const stillAfflicted = remaining > 0;
          return {
            ...p,
            hp: Math.max(0, (p.hp ?? 0) - poisonDmg),
            poisonDoT: stillAfflicted,
            poisonDoTTurns: remaining,
            poisonResolvedTurnToken: x.turnExpiry || "",
            ...(stillAfflicted ? {} : {
              poisonDoTDice: null, poisonDoTSourceLabel: null, poisonDoTIcon: null,
            }),
          };
        });
        const log = `${icon} ${aiName} subisce il ${sourceLabel}: ${poisonDmg} danni [🎲${dice}=${poisonRolls}]!`;
        // If poison kills the AI, end the match.
        const meAfter = rawPlayers.find(p => p.id === aiId);
        if ((meAfter?.hp ?? 0) <= 0) {
          const alive = rawPlayers.filter(p => p.hp > 0);
          if (alive.length === 1) {
            return { ...x, players: rawPlayers, status: "finished", winner: alive[0].id, logs: [...x.logs, log, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
          }
        }
        return { ...x, players: rawPlayers, logs: [...x.logs, log] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return; // watcher re-fires; AI then takes its action
    }

    // Apply pending bleedDoT tick (sanguinamento da Triboli) — stack indipendente dal veleno.
    if (aiPlayer.bleedDoT && (aiPlayer.bleedResolvedTurnToken || "") !== (m.turnExpiry || "")) {
      const dice = aiPlayer.bleedDoTDice || "1d6";
      const { total: bleedDmg, rolls: bleedRolls } = rollDmg(dice);
      const sourceLabel = aiPlayer.bleedDoTSourceLabel || "sanguinamento";
      const icon = aiPlayer.bleedDoTIcon || "🩸";
      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const rawPlayers = x.players.map(p => {
          if (p.id !== aiId) return p;
          const remaining = Math.max(0, (p.bleedDoTTurns ?? 1) - 1);
          const stillAfflicted = remaining > 0;
          return {
            ...p,
            hp: Math.max(0, (p.hp ?? 0) - bleedDmg),
            bleedDoT: stillAfflicted,
            bleedDoTTurns: remaining,
            bleedResolvedTurnToken: x.turnExpiry || "",
            ...(stillAfflicted ? {} : {
              bleedDoTDice: null, bleedDoTSourceLabel: null, bleedDoTIcon: null,
            }),
          };
        });
        const log = `${icon} ${aiName} subisce il ${sourceLabel}: ${bleedDmg} danni [🎲${dice}=${bleedRolls}]!`;
        const meAfter = rawPlayers.find(p => p.id === aiId);
        if ((meAfter?.hp ?? 0) <= 0) {
          const alive = rawPlayers.filter(p => p.hp > 0);
          if (alive.length === 1) {
            return { ...x, players: rawPlayers, status: "finished", winner: alive[0].id, logs: [...x.logs, log, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
          }
        }
        return { ...x, players: rawPlayers, logs: [...x.logs, log] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return;
    }

    // ── Control budget burning down without a pending save (rare edge case) ──
    if ((aiPlayer.controlLostTurns ?? 0) > 0 && !aiPlayer.pendingControlSave) {
      const remaining = Math.max(0, (aiPlayer.controlLostTurns ?? 0) - 1);
      const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const players = x.players.map(p =>
          p.id === aiId
            ? { ...p, controlLostTurns: remaining, multiActionsUsed: 0, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false }
            : p
        );
        return { ...x, players, turn: target.id, turnExpiry: expiry, logs: [...x.logs, `🌀 ${aiName} è sotto controllo: turno saltato (${remaining} rimanenti).`] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return;
    }

    const cls    = (aiSnap.class || "").toLowerCase();
    const maxHp  = aiSnap.stats?.maxHp ?? aiPlayer.maxHp ?? 70;
    const hpPct  = aiPlayer.hp / maxHp;
    const usedSoFar = aiPlayer.multiActionsUsed ?? 0;
    const isFirstAttackThisTurn = usedSoFar === 0;
    const tsNow  = new Date().toISOString();

    // ── FREE-ITEM PHASE: heal when hurting (uses a Pozione di Cura), then
    //    keep going with an attack. Gli oggetti sono azione gratuita: non
    //    consumano azione né bonus action, ma uno solo per turno. ──
    if (
      isFirstAttackThisTurn &&
      hpPct < 0.35 &&
      (aiPlayer.itemUsesLeft?.pozione_cura ?? 0) > 0 &&
      !aiPlayer.itemUsedThisTurn
    ) {
      const { total: heal, rolls: healRolls } = rollDmg("2d12");
      const newHp = Math.min(maxHp, aiPlayer.hp + heal);
      const healLog = {
        pub: `🧪 ${aiSnap.name} usa Pozione di Cura [🎲${healRolls}=${heal}] — recupera ${heal} HP (${newHp} HP) · azione gratuita`,
        ts: tsNow,
      };
      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const players = x.players.map(p => {
          if (p.id !== aiId) return p;
          const newUses = { ...(p.itemUsesLeft || {}), pozione_cura: Math.max(0, (p.itemUsesLeft?.pozione_cura ?? 0) - 1) };
          return { ...p, hp: newHp, itemUsesLeft: newUses, itemUsedThisTurn: true };
        });
        return { ...x, players, logs: [...x.logs, healLog] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return; // next tick of the useEffect will trigger the attack
    }

    // Pre-attack buff state to set on the AI's own player object (rage,
    // hunter's mark, smite-style flags). Triggered on the first attack of
    // the fight to mirror how human players burn their bonus action.
    const buffPatch = {};
    let preLog = null;
    if (isFirstAttackThisTurn && (aiPlayer.aiBuffActivated !== true)) {
      if (cls.includes("barbar") && !aiPlayer.rageTurns) {
        buffPatch.rageTurns = 5;
        buffPatch.aiBuffActivated = true;
        preLog = { pub: `🔥 ${aiSnap.name} entra in Furia! (+2 danni e dimezza i danni fisici subiti per 5 turni)`, ts: tsNow };
      } else if ((cls.includes("ranger") || cls.includes("cacciat")) && !aiPlayer.hunterMarkTurns) {
        buffPatch.hunterMarkTurns = 5;
        buffPatch.aiBuffActivated = true;
        preLog = { pub: `🎯 ${aiSnap.name} marca ${target.name}! (+3 danni per 5 turni)`, ts: tsNow };
      } else if (cls.includes("paladin")) {
        // Paladin opens with Magic Detect/Aid bonus prep (+aid bonus on first hits).
        buffPatch.aidBuff = 4;
        buffPatch.aiBuffActivated = true;
        preLog = { pub: `🙏 ${aiSnap.name} invoca un'aura di guida divina (+4 al prossimo colpo)`, ts: tsNow };
      } else if (cls.includes("fighter")) {
        // Fighter doesn't buff turn 1 — saves Action Surge for later.
        buffPatch.aiBuffActivated = true;
      }
    }

    // ── SPELL PHASE — cast a spell if it scores higher than the best weapon ──
    // Mirrors how a competent caster plays: trucchetti for chip damage,
    // lv1+ slots for control/burst, self-buffs early. We score every
    // available spell and the best weapon swing, then commit to the
    // highest. Spells that target the human (control/save_dot/damage)
    // produce the same pendingSave bookkeeping as the human casting them.
    const _ALL_ACTIONS = aiSnap.selectedActions || [];
    const _allSpells = _ALL_ACTIONS.filter(a => a.type === "spell");
    if (_allSpells.length > 0) {
      const _usesLeftMap = aiPlayer.actionUsesLeft || {};
      const _hasUses = (a) => (_usesLeftMap[a.name] ?? a.maxUses ?? 999) > 0;
      const _avg = (formula) => {
        const mtx = /^(\d+)d(\d+)/.exec(formula || "");
        if (!mtx) return 0;
        return parseInt(mtx[1], 10) * (parseInt(mtx[2], 10) + 1) / 2;
      };

      const _castAbility = getSpellcastingAbility(cls);
      const _spellMod    = aiSnap.stats?.[_castAbility] ?? 0;
      const _spellDC     = 10 + 3 + _spellMod;
      const _tgtMP       = m.players.find(p => p.id === target.id);
      const _tgtCtrl     = !!_tgtMP?.pendingControlSave || (_tgtMP?.controlLostTurns ?? 0) > 0;
      const _tgtPoison   = !!_tgtMP?.pendingSaveDot || !!_tgtMP?.poisonDoT;
      // Heuristic fail-chance: assumes the target's TS mod ≈ 0 (good enough
      // for scoring; the real roll happens at resolution time).
      const _failChance  = Math.max(0.15, Math.min(0.9, (_spellDC - 10) / 20));

      const _candidates = [];
      for (const sp of _allSpells) {
        if (!_hasUses(sp)) continue;
        if (sp.special === "shield_buff") {
          if ((aiPlayer.shieldSkillTurns ?? 0) === 0 && hpPct < 0.85) {
            _candidates.push({ kind: "shield_buff", spell: sp, score: 7 });
          }
        } else if (sp.special === "save_buff") {
          if ((aiPlayer.saveBuffAttacks ?? 0) === 0) {
            _candidates.push({ kind: "save_buff", spell: sp, score: 6 });
          }
        } else if (sp.special === "heal" || ((sp.info || "").toLowerCase().includes("cura") && (sp.damage || "—") !== "—")) {
          if (hpPct < 0.55) _candidates.push({ kind: "heal", spell: sp, score: 12 });
        } else if (sp.special === "control") {
          if (!_tgtCtrl) _candidates.push({ kind: "control", spell: sp, score: 14 * _failChance + 4 });
        } else if (sp.special === "save_dot") {
          if (!_tgtPoison) {
            const dotAvg = _avg(sp.saveDotDamage || "2d6") * (sp.saveDotTurns ?? 3);
            _candidates.push({ kind: "save_dot", spell: sp, score: dotAvg * _failChance });
          }
        } else if (isSaveDamageSpell(sp)) {
          // TS-based damage — expected damage on fail
          const dmgAvg = _avg(sp.damage) + _spellMod;
          _candidates.push({ kind: "save_damage", spell: sp, score: dmgAvg * _failChance });
        }
      }

      // Weapon baseline (best avg damage + stat mod)
      const _weaponsList = _ALL_ACTIONS.filter(a => a.type === "weapon");
      const _bestWpn = _weaponsList.slice().sort((a, b) => _avg(b.damage) - _avg(a.damage))[0];
      const _weaponBaseline = _bestWpn ? _avg(_bestWpn.damage) + (aiSnap.stats?.[_bestWpn.statKey || "str"] ?? 0) : 0;
      // Caster bias — a wizard/cleric/etc. should lean on spells.
      const _isCaster = (
        cls.includes("mago") || cls.includes("wizard") ||
        cls.includes("strego") || cls.includes("sorcerer") ||
        cls.includes("warlock") ||
        cls.includes("cleric") || cls.includes("chierico") ||
        cls.includes("druid") || cls.includes("druido") ||
        cls.includes("bard") || cls.includes("bardo")
      );
      const _casterBias = _isCaster ? 3 : 0;

      const _picked = _candidates.sort((a, b) => b.score - a.score)[0];

      if (_picked && (_picked.score + _casterBias) > _weaponBaseline) {
        const sp = _picked.spell;
        const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();

        let logMsg;
        let dmgToTarget = 0;
        let aiPatch = {};
        const targetPatch = {};

        if (_picked.kind === "shield_buff") {
          const turns = sp.shieldBuffTurns ?? 3;
          const bonus = sp.shieldBuffBonus ?? 1;
          aiPatch = { shieldSkillTurns: turns, shieldSkillBonus: bonus };
          logMsg = `${sp.icon || "🛡"} ${aiName} lancia ${sp.name} — +${bonus} CA per ${turns} turni.`;
        } else if (_picked.kind === "save_buff") {
          const atk = sp.tsAttacks ?? 3;
          const bonus = sp.tsBonus ?? 3;
          aiPatch = { saveBuffAttacks: atk, saveBuffBonus: bonus };
          logMsg = `${sp.icon || "🔰"} ${aiName} lancia ${sp.name} — +${bonus} ai prossimi ${atk} TS.`;
        } else if (_picked.kind === "heal") {
          const { total: hDice, rolls: hRolls } = rollDmg(sp.damage || "2d8");
          const healAmt = Math.max(1, hDice + _spellMod);
          const newHp = Math.min(maxHp, aiPlayer.hp + healAmt);
          aiPatch = { hp: newHp };
          const modPart = _spellMod !== 0 ? `${_spellMod >= 0 ? "+" : ""}${_spellMod}` : "";
          logMsg = `${sp.icon || "💚"} ${aiName} lancia ${sp.name} — cura sé stesso di ${healAmt} HP [🎲${hRolls}${modPart}].`;
        } else if (_picked.kind === "control") {
          const saveAbility = parseSpellSaveAbility(sp);
          targetPatch.pendingControlSave = true;
          targetPatch.pendingControlDC = _spellDC;
          targetPatch.pendingControlSaveAbility = saveAbility;
          targetPatch.controlLostTurns = 2;
          logMsg = `${sp.icon || "🌀"} ${aiName} lancia ${sp.name} su ${target.name} → TS ${SAVE_LABEL[saveAbility]} (CD ${_spellDC}) richiesto!`;
        } else if (_picked.kind === "save_dot") {
          const saveAbility = sp.saveDotAbility || "con";
          const dotDC = sp.saveDotDC ?? _spellDC;
          targetPatch.pendingSaveDot = {
            ability: saveAbility,
            dc: dotDC,
            dice: sp.saveDotDamage || "2d6",
            turns: sp.saveDotTurns ?? 3,
            name: sp.name,
            icon: sp.icon,
          };
          logMsg = `${sp.icon || "🤢"} ${aiName} lancia ${sp.name} su ${target.name} → TS ${SAVE_LABEL[saveAbility]} (CD ${dotDC}) richiesto!`;
        } else if (_picked.kind === "save_damage") {
          // Resolve the human's TS now with a visible d20 popup, mirroring
          // the reverse direction (handleSpellSave shows a d20 too).
          const ability = _castAbility;
          const defMod  = targetSnap.stats?.[ability] ?? 0;
          const tgtSaveBuff = (_tgtMP?.saveBuffAttacks ?? 0) > 0 ? (_tgtMP?.saveBuffBonus ?? 0) : 0;
          const d20 = Math.floor(Math.random() * 20) + 1;
          await showD20Roll(d20, { label: `TS ${SAVE_LABEL[ability]} · ${sp.name}` });
          const tsTotal = d20 + defMod + tgtSaveBuff;
          const saves   = tsTotal >= _spellDC;
          const { total: dmg, rolls: dmgRolls } = saves ? { total: 0, rolls: "0" } : rollDmg(sp.damage);
          dmgToTarget = saves ? 0 : Math.max(0, dmg + _spellMod);
          const modSign = _spellMod >= 0 ? "+" : "";
          const buffTag = tgtSaveBuff > 0 ? ` +${tgtSaveBuff}🛡` : "";
          logMsg = saves
            ? `✨ ${target.name} resiste a ${sp.name} di ${aiName} (TS ${SAVE_LABEL[ability]} ${tsTotal}${buffTag} ≥ CD ${_spellDC}) — nessun danno.`
            : `✨ ${aiName} colpisce ${target.name} con ${sp.icon || "✨"} ${sp.name} (TS ${SAVE_LABEL[ability]} ${tsTotal}${buffTag} < CD ${_spellDC}) — 🎲${dmgRolls}${modSign}${_spellMod} = ${dmgToTarget} danni.`;
          if (tgtSaveBuff > 0) {
            const newAtk = Math.max(0, (_tgtMP?.saveBuffAttacks ?? 0) - 1);
            targetPatch.saveBuffAttacks = newAtk;
            if (newAtk === 0) targetPatch.saveBuffBonus = 0;
          }
        }

        // Multi-action logic — only damage spells get the multi-action
        // privilege (rogue/monk double-tap). Control/save_dot/heal/buff
        // always end the AI's turn, matching the human handlers.
        const baseMax = (cls.includes("monk") || cls.includes("monaco") || cls.includes("rogue") || cls.includes("ladr")) ? 2 : 1;
        const effectiveMax = baseMax + ((aiPlayer.actionSurgeActive ? 1 : 0));
        const isDamageSpell = _picked.kind === "save_damage";
        const stayingThisTurn = isDamageSpell && (usedSoFar + 1) < effectiveMax;
        const newMultiUsed = stayingThisTurn ? (usedSoFar + 1) : 0;
        const passTurnAfterSpell = !stayingThisTurn;

        let spellAbsorbedLog = null;
        const updatedMatches = meta.matches.map(x => {
          if (x.matchId !== matchId) return x;
          const rawPlayers = x.players.map(p => {
            if (p.id === target.id) {
              // Monk's "Assorbire Danni" also catches save-based damage spells.
              if (p.absorbDamageNext && dmgToTarget > 0) {
                const tgtMaxHp = targetSnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
                const heal = Math.floor(dmgToTarget / 2);
                spellAbsorbedLog = `🌀 ${p.name} assorbe il colpo e si cura di ${heal} HP!`;
                return {
                  ...p,
                  hp: Math.min(tgtMaxHp, (p.hp ?? 0) + heal),
                  absorbDamageNext: false,
                  ...targetPatch,
                  ...consumeInvisibility(p),
                  stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1),
                };
              }
              const newHp = Math.max(0, (p.hp ?? 0) - dmgToTarget);
              return {
                ...p,
                hp: newHp,
                ...targetPatch,
                ...consumeInvisibility(p),
                stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1),
              };
            }
            if (p.id === aiId) {
              const newUses = {
                ...(p.actionUsesLeft || {}),
                [sp.name]: Math.max(0, ((p.actionUsesLeft?.[sp.name]) ?? sp.maxUses ?? 1) - 1),
              };
              const turnEndPatch = stayingThisTurn ? {} : {
                rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1),
                hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1),
                shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1),
                concentrationTurns: Math.max(0, (p.concentrationTurns ?? 0) - 1),
                pattoTurns: Math.max(0, (p.pattoTurns ?? 0) - 1),
                armorForgeTurns: Math.max(0, (p.armorForgeTurns ?? 0) - 1),
                selfAdvTurns: Math.max(0, (p.selfAdvTurns ?? 0) - 1),
                ...tickEagleEnd(p),
                aidBuff: false,
                bonusActionUsed: false, itemUsedThisTurn: false,
                actionSurgeActive: false,
                multiActionsUsed: 0,
              };
              return {
                ...p,
                ...aiPatch,
                actionUsesLeft: newUses,
                multiActionsUsed: newMultiUsed,
                aiAttacksMade: (p.aiAttacksMade ?? 0) + 1,
                aiBuffActivated: true,
                ...turnEndPatch,
              };
            }
            return p;
          });

          const alive = rawPlayers.filter(pp => pp.hp > 0);
          const logs = [...x.logs, logMsg];
          if (spellAbsorbedLog) logs.push(spellAbsorbedLog);
          if (alive.length === 1) {
            logs.push(`🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`);
            return { ...x, players: rawPlayers, status: "finished", winner: alive[0].id, logs };
          }
          if (passTurnAfterSpell) {
            const human = rawPlayers.find(pp => pp.id !== aiId);
            return { ...x, players: rawPlayers, turn: human.id, turnExpiry: expiry, logs };
          }
          return { ...x, players: rawPlayers, logs };
        });

        await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
        return; // spell consumed the action; watcher re-fires if multi-action
      }
    }

    // ── ATTACK PHASE ──
    const weapons = (aiSnap.selectedActions || []).filter(a => a.type === "weapon");
    if (weapons.length === 0) return;
    const avgDmg = (formula) => {
      const mtx = /^(\d+)d(\d+)/.exec(formula || "");
      if (!mtx) return 0;
      return parseInt(mtx[1], 10) * (parseInt(mtx[2], 10) + 1) / 2;
    };
    const sortedWeapons = weapons.slice().sort((a, b) => avgDmg(b.damage) - avgDmg(a.damage));
    // Rogue/Monk multi-action: rotate through weapons. Single-weapon classes
    // just always use the best.
    const chosen = (weapons.length > 1 && (cls.includes("rogue") || cls.includes("ladr") || cls.includes("monk") || cls.includes("monaco")))
      ? weapons[usedSoFar % weapons.length]
      : sortedWeapons[0];

    const armorPenalty   = aiSnap.selectedArmor?.hitPenalty ?? 0;
    const statKey        = chosen.statKey || "str";
    const statMod        = aiSnap.stats?.[statKey] ?? 0;
    // Apply pre-buffs to the bonus picture too.
    const effRageTurns       = (buffPatch.rageTurns ?? aiPlayer.rageTurns ?? 0) > 0;
    const effHunterMark      = (buffPatch.hunterMarkTurns ?? aiPlayer.hunterMarkTurns ?? 0) > 0;
    const effAidBonus        = readActiveBonus(buffPatch.aidBuff ?? aiPlayer.aidBuff, 4);
    const rageDmgBonus       = effRageTurns ? 2 : 0;
    const barbarianDmgBonus  = cls.includes("barbar") ? 2 : 0;
    const hunterMarkDmgBonus = effHunterMark ? 3 : 0;
    // Fighter: crit on 19+ (Critico Migliorato).
    const isFighter   = cls.includes("fighter") || cls.includes("guerr");
    const critThresh  = isFighter ? 19 : 20;

    // Roll attack — fighter rerolls 1s (Presenza Possente).
    // Vantaggio/svantaggio: stessa regola del giocatore. Si annullano se entrambi presenti.
    const tgtMatchPlayer  = m.players.find(p => p.id === target.id);
    const aiEagleActive   = (aiPlayer.eagleDebuffTurns ?? 0) > 0;
    const aiHasAdvantage  = readStealthAdvTurns(aiPlayer) > 0 || (aiPlayer.selfAdvTurns ?? 0) > 0;
    const aiHasDisadvantage = readStealthDisadvTurns(tgtMatchPlayer) > 0 || aiEagleActive || (aiPlayer.attackDisadvantageTurns ?? 0) > 0;
    let d20a = Math.floor(Math.random() * 20) + 1;
    if (d20a === 1 && isFighter) d20a = Math.floor(Math.random() * 20) + 1;
    let d20b = (aiHasAdvantage || aiHasDisadvantage) ? Math.floor(Math.random() * 20) + 1 : 0;
    if (d20b === 1 && isFighter && (aiHasAdvantage || aiHasDisadvantage)) d20b = Math.floor(Math.random() * 20) + 1;
    const d20 = aiHasAdvantage && !aiHasDisadvantage ? Math.max(d20a, d20b)
              : aiHasDisadvantage && !aiHasAdvantage ? Math.min(d20a, d20b)
              : d20a;
    const shieldSkillBonus = (tgtMatchPlayer?.shieldSkillTurns ?? 0) > 0
      ? (tgtMatchPlayer?.shieldSkillBonus ?? 3) : 0;
    const defensiveBonus   = tgtMatchPlayer?.defensiveBonus ?? 0;
    const targetAc = getEffectiveAc(tgtMatchPlayer, targetSnap) + shieldSkillBonus + defensiveBonus;

    const hitTotal = d20 + (chosen.hitBonus || 0) + statMod + armorPenalty + effAidBonus;
    const isCrit   = d20 >= critThresh;
    const isHit    = hitTotal >= targetAc || isCrit;

    let damage = 0;
    let damageRolls = "0";
    if (isHit) {
      const { total, rolls } = rollDmg(chosen.damage);
      const critMult = isCrit ? 2 : 1;
      const raw = (total + statMod + rageDmgBonus + barbarianDmgBonus + hunterMarkDmgBonus) * critMult;
      damage = applyBarbarianRageReduction(raw, targetSnap, tgtMatchPlayer, false);
      damageRolls = rolls;
    }

    const critTag = isCrit ? " ★CRITICO★" : "";
    const aidPart = effAidBonus ? ` +${effAidBonus} aiuto` : "";
    const ragePart= rageDmgBonus ? ` +${rageDmgBonus} furia` : "";
    const barbPart= barbarianDmgBonus ? ` +${barbarianDmgBonus} barb` : "";
    const hmPart  = hunterMarkDmgBonus ? ` +${hunterMarkDmgBonus} 🎯marchio` : "";
    const aiAdvTag = aiHasAdvantage && !aiHasDisadvantage ? ` 🌟vant.[${d20a},${d20b}]`
                   : aiHasDisadvantage && !aiHasAdvantage ? ` 🌑svant.[${d20a},${d20b}]`
                   : (aiHasAdvantage && aiHasDisadvantage) ? ` ⚖️ vant.+svant. annullati` : "";
    const breakdown = `d20=${d20}${aiAdvTag}+hit${chosen.hitBonus || 0}${statMod >= 0 ? "+" : ""}${statMod} ${statKey.toUpperCase()}${armorPenalty < 0 ? ` ${armorPenalty} arm.` : ""}${aidPart}=${hitTotal} vs CA ${targetAc}`;
    const attackLog = {
      pub: isHit
        ? `💥 ${aiSnap.name} colpisce ${target.name} con ${chosen.name}${critTag} — ${damage} danni`
        : `🛡️ ${aiSnap.name} manca ${target.name} con ${chosen.name} (${hitTotal} vs CA ${targetAc})`,
      att: isHit
        ? `💥 Colpisci ${target.name} con ${chosen.name} [${breakdown}]${critTag} → 🎲${damageRolls}${statMod !== 0 ? `${statMod >= 0 ? "+" : ""}${statMod}` : ""}${ragePart}${barbPart}${hmPart}${isCrit ? " ×2" : ""} = ${damage} danni`
        : `🛡️ Manchi ${target.name} con ${chosen.name} [${breakdown}]`,
      def: isHit
        ? `⚔️ ${aiSnap.name} ti colpisce con ${chosen.name}${critTag} — ${damage} danni`
        : `🛡️ ${aiSnap.name} ti ha mancato con ${chosen.name}`,
      ts: tsNow, attId: aiId, defId: target.id,
    };

    // ── ACTION SURGE decision (Fighter only) — fires once per match, on the
    //    first attack of any turn while bloodied (<70%) or whenever the AI
    //    has missed badly. Gives +1 action this turn. ──
    const wantsSurge =
      isFighter &&
      !aiPlayer.aiSurgeUsed &&
      isFirstAttackThisTurn &&
      (hpPct < 0.70 || (!isHit && Math.random() < 0.5));
    const surgePatch = wantsSurge ? { actionSurgeActive: true, aiSurgeUsed: true } : {};
    if (wantsSurge) {
      preLog = { pub: `⚡ ${aiSnap.name} attiva Scatto d'Azione! (azione extra questo turno)`, ts: tsNow };
    }

    // Multi-action arithmetic mirrors the existing player flow at line ~3070:
    // staying-this-turn iff (used+1) < maxActions. Action Surge bumps cap.
    const baseMaxActions = (cls.includes("monk") || cls.includes("monaco") || cls.includes("rogue") || cls.includes("ladr")) ? 2 : 1;
    const effectiveMaxActions = baseMaxActions + (surgePatch.actionSurgeActive ? 1 : 0) + (aiPlayer.actionSurgeActive ? 1 : 0);
    const stayingThisTurn = (usedSoFar + 1) < effectiveMaxActions;

    let absorbedLog = null;
    const updatedMatches = meta.matches.map(x => {
      if (x.matchId !== matchId) return x;
      const rawPlayers = x.players.map(p => {
        if (p.id === target.id) {
          // Monk's "Assorbire Danni": next damage taken is converted into a 50% heal.
          if (p.absorbDamageNext && damage > 0) {
            const tgtMaxHp = targetSnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
            const heal = Math.floor(damage / 2);
            absorbedLog = `🌀 ${p.name} assorbe il colpo e si cura di ${heal} HP!`;
            return {
              ...p,
              hp: Math.min(tgtMaxHp, (p.hp ?? 0) + heal),
              absorbDamageNext: false,
              ...consumeInvisibility(p),
              stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1),
            };
          }
          return {
            ...p,
            hp: Math.max(0, (p.hp ?? 0) - damage),
            ...consumeInvisibility(p),
            stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1),
          };
        }
        if (p.id === aiId) {
          const newMultiUsed = stayingThisTurn ? (usedSoFar + 1) : 0;
          // End-of-turn buff decays mirror the human flow.
          const turnEndPatch = stayingThisTurn ? {} : {
            rageTurns:       Math.max(0, (p.rageTurns ?? 0) - 1),
            hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1),
            shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1),
            concentrationTurns: Math.max(0, (p.concentrationTurns ?? 0) - 1),
            pattoTurns: Math.max(0, (p.pattoTurns ?? 0) - 1),
            armorForgeTurns: Math.max(0, (p.armorForgeTurns ?? 0) - 1),
            selfAdvTurns: Math.max(0, (p.selfAdvTurns ?? 0) - 1),
            ...tickEagleEnd(p),
            aidBuff:         false,
            bonusActionUsed: false, itemUsedThisTurn: false,
            actionSurgeActive: false,
            multiActionsUsed: 0,
          };
          // Use up aidBuff after the swing it powered.
          const consumedAid = effAidBonus ? { aidBuff: false } : {};
          return {
            ...p,
            ...buffPatch,
            ...surgePatch,
            ...consumedAid,
            multiActionsUsed: newMultiUsed,
            aiAttacksMade: (p.aiAttacksMade ?? 0) + 1,
            ...turnEndPatch,
          };
        }
        return p;
      });
      const alive = rawPlayers.filter(pp => pp.hp > 0);
      const logs  = [...x.logs];
      if (preLog) logs.push(preLog);
      logs.push(attackLog);
      if (absorbedLog) logs.push(absorbedLog);
      if (alive.length === 1) {
        logs.push(`🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`);
        return { ...x, players: rawPlayers, status: "finished", winner: alive[0].id, logs };
      }
      if (stayingThisTurn) {
        return { ...x, players: rawPlayers, logs };
      }
      const human = rawPlayers.find(pp => pp.id !== aiId);
      return {
        ...x,
        players: rawPlayers,
        turn: human.id,
        turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString(),
        logs,
      };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // Watcher: schedules AI moves with a small dramatic delay. Only the match's
  // aiOwnerId runs this so two open browsers don't double-act.
  useEffect(() => {
    if (!arenaMeta?.matches || !currentUser) return;
    const myAiMatches = arenaMeta.matches.filter(m =>
      m.ai === true &&
      m.aiOwnerId === currentUser.uid &&
      (m.status === "initiative" || m.status === "active")
    );
    if (myAiMatches.length === 0) return;
    const timers = [];
    for (const m of myAiMatches) {
      const aiId = m.aiId;
      const aiPlayer = m.players?.find(p => p.id === aiId);
      if (!aiPlayer) continue;
      // Initiative: roll once for the AI when needed.
      if (m.status === "initiative" && aiPlayer.init === 0) {
        const key = `${m.matchId}:init`;
        if (aiInFlightRef.current[key]) continue;
        aiInFlightRef.current[key] = true;
        const t = setTimeout(() => {
          aiRollInitiative(m.matchId).finally(() => {
            delete aiInFlightRef.current[key];
          });
        }, 900 + Math.random() * 700);
        timers.push(t);
        continue;
      }
      // Active turn: AI takes its decision (heal / buff / attack / surge).
      // The useEffect re-fires after each Firestore write, so multi-action
      // turns chain naturally — each tick handles ONE action and either
      // stays (multiActionsUsed bumps) or passes the turn to the human.
      if (m.status === "active" && m.turn === aiId && aiPlayer.hp > 0) {
        const human = m.players.find(p => p.id !== aiId);
        const key = `${m.matchId}:turn:${m.turnExpiry || ""}:${aiPlayer.hp}:${aiPlayer.multiActionsUsed ?? 0}:${aiPlayer.bonusActionUsed ? 1 : 0}:${human?.hp ?? "0"}`;
        if (aiInFlightRef.current[key]) continue;
        aiInFlightRef.current[key] = true;
        const delay = (aiPlayer.multiActionsUsed ?? 0) === 0
          ? 1400 + Math.random() * 1100   // first action: dramatic delay
          : 700  + Math.random() * 500;   // subsequent attacks (rogue/monk/surge): snappier
        const t = setTimeout(() => {
          aiTakeAction(m.matchId).finally(() => {
            delete aiInFlightRef.current[key];
          });
        }, delay);
        timers.push(t);
      }
    }
    return () => { timers.forEach(t => clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaMeta, currentUser]);

  // Helper: il match è bloccato dal pulsante Pausa? Le sfide libere (kind="fun") restano libere.
  const isMatchPausedForAction = (matchId) => {
    if (!arenaMeta?.timerPaused) return false;
    const m = arenaMeta.matches?.find(x => x.matchId === matchId);
    if (!m) return false;
    return m.kind !== "fun";
  };

  const handleAttack = async (matchId, targetId, action) => {
    if (actionInFlightRef.current) return; // anti–doppio click: l'azione precedente non è ancora confermata
    if (isMatchPausedForAction(matchId)) {
      alert("⏸ L'arena è in pausa. Non puoi agire finché il Master non riprende il match.");
      return;
    }
    actionInFlightRef.current = true;
    try {
      await _runAttack(matchId, targetId, action);
    } finally {
      actionInFlightRef.current = false;
    }
  };

  const _runAttack = async (matchId, targetId, action) => {
    const snapshots    = arenaMeta.characterSnapshots || {};
    const attackerSnap = snapshots[currentUser.uid];
    const defenderSnap = snapshots[targetId];
    const attName = attackerSnap?.name || "?";
    const defName = defenderSnap?.name || "?";

    // 🔩 Riscaldare Arma — blocca attacchi con armi finché weaponLockTurns > 0.
    const _myMatchEarly = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
    if (action.type === "weapon" && (_myMatchEarly?.weaponLockTurns ?? 0) > 0) {
      alert(`🔩 La tua arma è incandescente! Non puoi attaccare con armi per ${_myMatchEarly.weaponLockTurns} turno/i.`);
      return;
    }

    // 🗡 Ladro — struttura del turno: 1 attacco mano1 + 1 attacco mano2 + 1 abilità
    // (Attacco Furtivo o Triboli) + 1 bonus action. Ogni arma una sola volta a turno;
    // una sola abilità a turno. Furtività resta libera (non occupa slot).
    if (isRogueClass((attackerSnap?.class || "").toLowerCase())) {
      const _skillSlot = action.special === "sneak_attack" || action.special === "triboli";
      if (action.type === "weapon" && (_myMatchEarly?.turnWeaponsUsed || []).includes(action.name)) {
        alert("🗡 Hai già attaccato con quest'arma questo turno. Usa l'altra mano o un'abilità.");
        return;
      }
      if (_skillSlot && _myMatchEarly?.turnSkillUsed) {
        alert("🗡 Hai già usato un'abilità (Attacco Furtivo o Triboli) questo turno.");
        return;
      }
    }

    // 1 moneta al primo attacco del giocatore in questo match (escluse Sfide Libere)
    const _currentMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const _alreadyAwarded = (_currentMatch?.participantsAwarded || []).includes(currentUser.uid);
    if (!_alreadyAwarded && _currentMatch?.kind !== "fun") await awardArenaCoins(currentUser.uid, 5);

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
      const shieldSkillBonusDef = (defMatchPlayer?.shieldSkillTurns ?? 0) > 0 ? (defMatchPlayer?.shieldSkillBonus ?? 3) : 0;
      const targetAc = getEffectiveAc(defMatchPlayer, defenderSnap) + shieldSkillBonusDef + (defMatchPlayer?.defensiveBonus ?? 0);
      const smiteStrMod = attackerSnap?.stats?.str ?? 0;
      const smiteMdAtk = myMatchPlayer?.magicDetectAttacks ?? 0;
      const smiteAidBonus = smiteMdAtk > 0
        ? readActiveBonus(myMatchPlayer?.magicDetectActive, 0)
        : readActiveBonus(myMatchPlayer?.aidBuff, 4);
      const d20 = Math.floor(Math.random() * 20) + 1;
      await showD20Roll(d20, { label: "Smite Divino" });
      const totalHit = d20 + (weaponAction.hitBonus || 0) + smiteStrMod + armorPenalty + smiteAidBonus;
      const isHit = totalHit >= targetAc;
      const isCrit = d20 === 20;
      const critMult = isCrit ? 2 : 1;

      const { total: wDmg, rolls: wRolls } = isHit ? rollDmg(weaponAction.damage) : { total: 0, rolls: "" };
      const { total: sDmg, rolls: sRolls } = isHit ? rollDmg("2d8") : { total: 0, rolls: "" };
      const rawSmiteDmg = (wDmg + sDmg + smiteStrMod) * critMult;
      const totalDmg = applyBarbarianRageReduction(rawSmiteDmg, defenderSnap, defMatchPlayer, false);

      const smiteExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      const hitStr = isHit ? `COLPISCE` : `MANCA`;
      const strPart = smiteStrMod !== 0 ? `+${smiteStrMod} FOR` : "";
      const aidPart = smiteAidBonus ? ` +${smiteAidBonus} Aiuto` : "";
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
        const rawPlayers = m.players.map(p => {
          if (p.id === targetId && isHit) return { ...p, hp: Math.max(0, (p.hp ?? 0) - totalDmg) };
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 1)) - 1) };
            const prevMdAtk = p.magicDetectAttacks ?? (p.magicDetectActive ? 1 : 0);
            const newMdAtk  = Math.max(0, prevMdAtk - 1);
            const newMd     = newMdAtk > 0 ? p.magicDetectActive : false;
            return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), ...tickEagleEnd(p), defensiveBonus: 0, aidBuff: false, bonusActionUsed: false, itemUsedThisTurn: false, magicDetectActive: newMd, magicDetectAttacks: newMdAtk, actionUsesLeft: newUses };
          }
          return p;
        });
        const { players, extraLogs } = processWsKnockouts(rawPlayers);
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        const alive = players.filter(p => p.hp > 0);
        if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, participantsAwarded: pa, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
        return { ...m, players, turn: advanceTurn(players, m), turnExpiry: smiteExpiry, participantsAwarded: pa, logs: [...m.logs, log, ...extraLogs] };
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
      const shieldSkillBonusDef = (defMatchPlayer?.shieldSkillTurns ?? 0) > 0 ? (defMatchPlayer?.shieldSkillBonus ?? 3) : 0;
      const targetAc = getEffectiveAc(defMatchPlayer, defenderSnap) + shieldSkillBonusDef + (defMatchPlayer?.defensiveBonus ?? 0);
      const dexMod = attackerSnap?.stats?.dex ?? 0;
      const sneakMdAtk = myMatchPlayer?.magicDetectAttacks ?? 0;
      const aidBonus = sneakMdAtk > 0
        ? readActiveBonus(myMatchPlayer?.magicDetectActive, 0)
        : readActiveBonus(myMatchPlayer?.aidBuff, 4);
      // Furtività dà vantaggio su TUTTI gli attacchi del Ladro (Attacco Furtivo incluso).
      // Svantaggio: stealth del bersaglio, accecato dall'aquila, o svantaggio agli attacchi (Triboli/Oscurità).
      const sneakEagleActive     = (myMatchPlayer?.eagleDebuffTurns ?? 0) > 0;
      const sneakHasAdvantage    = readStealthAdvTurns(myMatchPlayer) > 0 || (myMatchPlayer?.selfAdvTurns ?? 0) > 0;
      const sneakHasDisadvantage = readStealthDisadvTurns(defMatchPlayer) > 0 || sneakEagleActive || (myMatchPlayer?.attackDisadvantageTurns ?? 0) > 0;
      const sneakD20a = Math.floor(Math.random() * 20) + 1;
      const sneakD20b = (sneakHasAdvantage || sneakHasDisadvantage) ? Math.floor(Math.random() * 20) + 1 : 0;
      // Vantaggio + svantaggio si annullano (regola D&D 5e).
      const d20 = sneakHasAdvantage && !sneakHasDisadvantage ? Math.max(sneakD20a, sneakD20b)
                : sneakHasDisadvantage && !sneakHasAdvantage ? Math.min(sneakD20a, sneakD20b)
                : sneakD20a;
      await showD20Roll(d20, { label: "Attacco Furtivo" });
      const totalHit = d20 + (weaponAction.hitBonus || 0) + dexMod + armorPenalty + aidBonus;
      const isHit = totalHit >= targetAc;
      const isCrit = d20 === 20;
      const critMult = isCrit ? 2 : 1;

      const { total: wDmg, rolls: wRolls } = isHit ? rollDmg(weaponAction.damage) : { total: 0, rolls: "" };
      const { total: sneakDmg, rolls: sneakRolls } = isHit ? rollDmg("1d6") : { total: 0, rolls: "" };
      // Sneak Attack: weapon dice + 1d6 sneak dice + DEX mod (no hardcoded +3;
      // weapon formulas no longer have a baked ability mod since the
      // double-count fix).
      const rawSneakDmg = (wDmg + sneakDmg + dexMod) * critMult;
      const totalDmg = applyBarbarianRageReduction(rawSneakDmg, defenderSnap, defMatchPlayer, false);

      const sneakExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      const critTag = isCrit ? " ★CRITICO★" : "";
      const dexPart = dexMod !== 0 ? `+${dexMod} DES` : "";
      const aidPart = aidBonus ? ` +${aidBonus} Aiuto` : "";
      const sneakAdvTag = sneakHasAdvantage && !sneakHasDisadvantage ? ` 🌟vant.[${sneakD20a},${sneakD20b}]`
                        : sneakHasDisadvantage && !sneakHasAdvantage ? ` 🌑svant.[${sneakD20a},${sneakD20b}]`
                        : "";
      const hitStr = `🎲d20=${d20}${critTag}${sneakAdvTag} +${weaponAction.hitBonus} hit ${dexPart}${aidPart}${armorPenalty < 0 ? ` ${armorPenalty} arm.` : ""} = ${totalHit} vs CA ${targetAc}`;
      const log = {
        pub: isHit
          ? `🗡 ${attName} colpisce ${defName} con Attacco Furtivo${critTag} (${totalHit} vs CA ${targetAc}) [🎲${wRolls}+furtivo 🎲${sneakRolls}+${dexMod} DES = ${totalDmg}] — ${totalDmg} danni`
          : `🛡️ ${attName} manca ${defName} con Attacco Furtivo (${totalHit} vs CA ${targetAc})`,
        att: isHit
          ? `🗡 Colpisci ${defName} con Attacco Furtivo [${hitStr}] [arma 🎲${wRolls} + furtivo 🎲${sneakRolls} +${dexMod} DES = ${totalDmg}] — ${totalDmg} danni`
          : `🛡️ Manchi ${defName} con Attacco Furtivo [${hitStr}]`,
        def: isHit
          ? `🗡 ${attName} ti ha colpito con Attacco Furtivo${critTag} — ${totalDmg} danni`
          : `🛡️ ${attName} ti ha mancato con Attacco Furtivo`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };

      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const rawPlayers = m.players.map(p => {
          if (p.id === targetId) return { ...p, hp: isHit ? Math.max(0, (p.hp ?? 0) - totalDmg) : p.hp, stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1) };
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 3)) - 1) };
            const prevMdAtk = p.magicDetectAttacks ?? (p.magicDetectActive ? 1 : 0);
            const newMdAtk  = Math.max(0, prevMdAtk - 1);
            const newMd     = newMdAtk > 0 ? p.magicDetectActive : false;
            // Timer turn-based: NON decrementati qui — solo a fine turno (turnEndDecays).
            return { ...p, defensiveBonus: 0, aidBuff: false, bonusActionUsed: false, itemUsedThisTurn: false, magicDetectActive: newMd, magicDetectAttacks: newMdAtk, stealthAdvTurns: Math.max(0, readStealthAdvTurns(p) - 1), actionUsesLeft: newUses };
          }
          return p;
        });
        const { players, extraLogs } = processWsKnockouts(rawPlayers);
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        const alive = players.filter(p => p.hp > 0);
        if (alive.length === 1) {
          return { ...m, players, status: "finished", winner: alive[0].id, participantsAwarded: pa, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
        }
        // Multi-azione (Monaco x2, Ladro x2): non avanza il turno finché restano azioni.
        const me = m.players.find(p => p.id === currentUser.uid);
        const maxActions = getMaxActionsPerTurn(attackerSnap, me);
        const usedSoFar = me?.multiActionsUsed ?? 0;
        const multiWillStay = (usedSoFar + 1) < maxActions;
        const newMultiUsed = multiWillStay ? usedSoFar + 1 : 0;
        const preservedBonusUsed = !!me?.bonusActionUsed;
        const preservedItemUsed  = !!me?.itemUsedThisTurn;
        const turnEndDecaysSneak = multiWillStay ? {} : {
          attackDisadvantageTurns: Math.max(0, (me?.attackDisadvantageTurns ?? 0) - 1),
          weaponLockTurns: Math.max(0, (me?.weaponLockTurns ?? 0) - 1),
          shieldSkillTurns: Math.max(0, (me?.shieldSkillTurns ?? 0) - 1),
          rageTurns: Math.max(0, (me?.rageTurns ?? 0) - 1),
          hunterMarkTurns: Math.max(0, (me?.hunterMarkTurns ?? 0) - 1),
          concentrationTurns: Math.max(0, (me?.concentrationTurns ?? 0) - 1),
          pattoTurns: Math.max(0, (me?.pattoTurns ?? 0) - 1),
          armorForgeTurns: Math.max(0, (me?.armorForgeTurns ?? 0) - 1),
          selfAdvTurns: Math.max(0, (me?.selfAdvTurns ?? 0) - 1),
          ...tickEagleEnd(me || {}),
        };
        const playersWithMultiState = players.map(p =>
          p.id === currentUser.uid
            ? { ...p,
                multiActionsUsed: newMultiUsed,
                turnSkillUsed:     multiWillStay ? true : false,
                turnWeaponsUsed:   multiWillStay ? (me?.turnWeaponsUsed || []) : [],
                bonusActionUsed:   multiWillStay ? !!preservedBonusUsed   : false,
                itemUsedThisTurn:  multiWillStay ? !!preservedItemUsed    : false,
                extraTurnActive:   multiWillStay ? !!p.extraTurnActive    : false,
                actionSurgeActive: multiWillStay ? !!p.actionSurgeActive  : false,
                ...turnEndDecaysSneak }
            : p
        );
        const nextTurn = multiWillStay ? currentUser.uid : advanceTurn(playersWithMultiState, m);
        return { ...m, players: playersWithMultiState, turn: nextTurn, turnExpiry: sneakExpiry, participantsAwarded: pa, logs: [...m.logs, log, ...extraLogs] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return;
    }

    // ── Furtività (Rogue) — buff puro, nessun attacco ────────────────
    if (action.special === "stealth") {
      const log = {
        pub: `🌑 ${attName} entra in Furtività — vantaggio ai prossimi 3 attacchi`,
        att: `🌑 Entri in Furtività — i tuoi prossimi 3 attacchi hanno vantaggio`,
        def: `🌑 ${attName} è scivolato nell'ombra...`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };
      const stealthExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const me = m.players.find(p => p.id === currentUser.uid);
        // Furtività = azione gratuita: non avanza il turno né consuma uno slot
        // multi-azione del Ladro. bonusActionUsed resta quello che era.
        const preservedBonusUsed = !!me?.bonusActionUsed;
        const players = m.players.map(p => {
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
            return { ...p, stealthAdvTurns: 3, stealthDisadvTurns: 0, stealthTurns: 0, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), defensiveBonus: 0, aidBuff: false, bonusActionUsed: preservedBonusUsed, actionUsesLeft: newUses, multiActionsUsed: me?.multiActionsUsed ?? 0 };
          }
          return p;
        });
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        return { ...m, players, turnExpiry: stealthExpiry, participantsAwarded: pa, logs: [...m.logs, log] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return;
    }

    // ── Triboli (Rogue: svantaggio + sanguinamento 1d6/turno per 3 turni, no save) ─
    if (action.special === "triboli") {
      const turns      = action.disadvantageTurns ?? 3;
      const bleedTurns = action.bleedTurns ?? 3;
      const bleedDice  = action.bleedDice  || "1d6";
      const log = {
        pub: `🪤 ${attName} sparge Triboli su ${defName} — svantaggio agli attacchi + sanguinamento ${bleedDice}/turno per ${turns} turni.`,
        att: `🪤 Spargi Triboli su ${defName} — svantaggio + sanguinamento ${bleedDice}/turno per ${turns} turni.`,
        def: `🪤 Sei trafitto dai Triboli — svantaggio agli attacchi e sanguinamento ${bleedDice}/turno per ${turns} turni.`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };
      const triboliExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id === targetId) return {
            ...p,
            attackDisadvantageTurns: Math.max(p.attackDisadvantageTurns ?? 0, turns),
            bleedDoT: true,
            bleedDoTTurns: Math.max(p.bleedDoTTurns ?? 0, bleedTurns),
            bleedDoTDice: bleedDice,
            bleedDoTSourceLabel: "sanguinamento",
            bleedDoTNoun: "sanguinante",
            bleedDoTIcon: "🩸",
          };
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = action.maxUses !== undefined
              ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) }
              : uses;
            // Timer turn-based gestiti in turnEndDecaysTriboli (sotto), non qui.
            return { ...p, defensiveBonus: 0, actionUsesLeft: newUses };
          }
          return p;
        });
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        // Triboli = slot abilità del Ladro: non termina il turno finché restano
        // azioni (mano1/mano2). Una sola abilità a turno (turnSkillUsed).
        const me = m.players.find(p => p.id === currentUser.uid);
        const maxActions = getMaxActionsPerTurn(attackerSnap, me);
        const usedSoFar = me?.multiActionsUsed ?? 0;
        const multiWillStay = (usedSoFar + 1) < maxActions;
        const newMultiUsed = multiWillStay ? usedSoFar + 1 : 0;
        const preservedBonusUsed = !!me?.bonusActionUsed;
        const preservedItemUsed  = !!me?.itemUsedThisTurn;
        const turnEndDecaysTriboli = multiWillStay ? {} : {
          attackDisadvantageTurns: Math.max(0, (me?.attackDisadvantageTurns ?? 0) - 1),
          weaponLockTurns: Math.max(0, (me?.weaponLockTurns ?? 0) - 1),
          shieldSkillTurns: Math.max(0, (me?.shieldSkillTurns ?? 0) - 1),
          rageTurns: Math.max(0, (me?.rageTurns ?? 0) - 1),
          hunterMarkTurns: Math.max(0, (me?.hunterMarkTurns ?? 0) - 1),
          concentrationTurns: Math.max(0, (me?.concentrationTurns ?? 0) - 1),
          pattoTurns: Math.max(0, (me?.pattoTurns ?? 0) - 1),
          armorForgeTurns: Math.max(0, (me?.armorForgeTurns ?? 0) - 1),
          selfAdvTurns: Math.max(0, (me?.selfAdvTurns ?? 0) - 1),
          ...tickEagleEnd(me || {}),
        };
        const playersWithMultiState = updatedPlayers.map(p =>
          p.id === currentUser.uid
            ? { ...p,
                multiActionsUsed: newMultiUsed,
                turnSkillUsed:     multiWillStay ? true : false,
                turnWeaponsUsed:   multiWillStay ? (me?.turnWeaponsUsed || []) : [],
                bonusActionUsed:   multiWillStay ? !!preservedBonusUsed   : false,
                itemUsedThisTurn:  multiWillStay ? !!preservedItemUsed    : false,
                extraTurnActive:   multiWillStay ? !!p.extraTurnActive    : false,
                actionSurgeActive: multiWillStay ? !!p.actionSurgeActive  : false,
                ...turnEndDecaysTriboli }
            : p
        );
        const nextTurn = multiWillStay ? currentUser.uid : advanceTurn(playersWithMultiState, m);
        return { ...m, players: playersWithMultiState, turn: nextTurn, turnExpiry: triboliExpiry, participantsAwarded: pa, logs: [...m.logs, log] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return;
    }

    // ── Ragnatela (intrappola · TS FOR CD 13 OGNI turno per liberarsi) ────
    if (action.special === "web") {
      const saveAbility = action.saveAbility || "str";
      const saveDC = action.saveDC ?? 13;
      const log = {
        pub: `🕸 ${attName} lancia Ragnatela su ${defName} — intrappolato! TS ${SAVE_LABEL[saveAbility]} (CD ${saveDC}) ogni turno per liberarsi.`,
        att: `🕸 Lanci la Ragnatela su ${defName} — dovrà superare un TS ${SAVE_LABEL[saveAbility]} (CD ${saveDC}) ogni turno per liberarsi.`,
        def: `🕸 Sei avvolto dalla Ragnatela — TS ${SAVE_LABEL[saveAbility]} (CD ${saveDC}) ogni turno per liberarti.`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };
      const webExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id === targetId) return {
            ...p,
            pendingControlSave: true,
            pendingControlDC: saveDC,
            pendingControlSaveAbility: saveAbility,
            controlLostTurns: 2,
          };
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = action.maxUses !== undefined
              ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) }
              : uses;
            return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), ...tickEagleEnd(p), defensiveBonus: 0, actionUsesLeft: newUses };
          }
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
        const rawPlayers = m.players.map(p => {
          if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - damage), pendingConSave: true };
          if (p.id === currentUser.uid) return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), ...tickEagleEnd(p), defensiveBonus: 0 };
          return p;
        });
        const { players: updatedPlayers, extraLogs } = processWsKnockouts(rawPlayers);
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        const alive = updatedPlayers.filter(p => p.hp > 0);
        if (alive.length === 1) {
          return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
            participantsAwarded: pa, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
        }
        return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: poisonExpiry, participantsAwarded: pa, logs: [...m.logs, log, ...extraLogs] };
      });
      const finalM = updatedMatches.find(m => m.kind === "final");
      if (finalM && finalM.status === "finished" && finalM.winner) {
        const champSnap = snapshots[finalM.winner] || {};
        await sendChampionNotification(finalM.winner, champSnap.name || "Campione", arenaMeta?.prizes || "", updatedMatches);
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: updatedMatches, tournamentWinner: finalM.winner, phase: "finished",
        });
        // 🐣 pet system: tournament champion bonus
        awardPetPoints(finalM.winner, "arena_tournament", { resourceKey: finalM.matchId });
        return;
      }
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
      return;
    }

    // ── Incantesimo a danno → TS al posto del tiro per colpire ───────
    if (isSaveDamageSpell(action)) { await handleSpellSave(matchId, targetId, action); return; }

    // ── Attacco normale ───────────────────────────────────────────────
    const attackerMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
    // Class lock: prefer the class embedded on the match player (locked at match build),
    // fall back to characterSnapshots only for legacy matches without an embedded class.
    const attackerClassLower = (attackerMatchPlayer?.class || arenaMeta.characterSnapshots?.[currentUser.uid]?.class || "").toLowerCase();
    const isSpellAction = action.type === "spell";
    const spellcastKey  = isSpellAction ? getSpellcastingAbility(attackerClassLower) : null;
    const statMod  = action.statKey
      ? (attackerSnap?.stats?.[action.statKey] ?? 0)
      : isSpellAction
      ? (attackerSnap?.stats?.[spellcastKey] ?? 0)
      : 0;
    const weaponBuff = !isSpellAction && (attackerSnap?.arenaBuffs?.weaponBonus ? 1 : 0);
    const aidBonus           = readActiveBonus(attackerMatchPlayer?.aidBuff, 4);
    const rageDmgBonus       = !isSpellAction && (attackerMatchPlayer?.rageTurns ?? 0) > 0 ? 2 : 0;
    const barbarianDmgBonus  = !isSpellAction && isBarbarianClass(attackerClassLower) ? 2 : 0;
    const concentrationDmg   = (attackerMatchPlayer?.concentrationTurns ?? 0) > 0 ? 4 : 0;
    const bardInspirationActive = !!attackerMatchPlayer?.bardicInspirationActive;
    const { total: inspirationBonus, rolls: inspirationRolls } = bardInspirationActive ? rollDmg("1d6") : { total: 0, rolls: "" };
    const magicDetectBonus   = readActiveBonus(attackerMatchPlayer?.magicDetectActive, 3);
    const hunterMarkBonus    = (attackerMatchPlayer?.hunterMarkTurns ?? 0) > 0 ? 3 : 0;
    const eagleActive        = (attackerMatchPlayer?.eagleDebuffTurns ?? 0) > 0;
    const blindDebuffPenalty = (attackerMatchPlayer?.blindDebuff || eagleActive) ? -3 : 0;
    const isBlindDebuff      = action.special === "blind_debuff";
    const attackerTitles     = getSnapTitles(attackerSnap);
    const titleHitCtx        = { classLower: attackerClassLower, isSpellAction, wildShapeForm: attackerMatchPlayer?.wildShape || null, actionDamageType: action?.damageType || null };
    const titleHitBonus      = attackerTitles.reduce((sum, k) => sum + getTitleHitBonus({ titleKey: k, ...titleHitCtx }), 0);
    const defMatchPlayer     = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === targetId);
    const hasAdvantage       = readStealthAdvTurns(attackerMatchPlayer) > 0 || (attackerMatchPlayer?.selfAdvTurns ?? 0) > 0;
    const hasDisadvantage    = readStealthDisadvTurns(defMatchPlayer) > 0 || eagleActive || (attackerMatchPlayer?.attackDisadvantageTurns ?? 0) > 0;
    const isFighter = isFighterClass(attackerClassLower);
    let d20a = Math.floor(Math.random() * 20) + 1;
    if (d20a === 1 && isFighter) d20a = Math.floor(Math.random() * 20) + 1; // Presenza Possente: ritira l'1
    let d20b = (hasAdvantage || hasDisadvantage) ? Math.floor(Math.random() * 20) + 1 : 0;
    if (d20b === 1 && isFighter && (hasAdvantage || hasDisadvantage)) d20b = Math.floor(Math.random() * 20) + 1;
    const d20      = hasAdvantage && !hasDisadvantage ? Math.max(d20a, d20b)
                   : hasDisadvantage && !hasAdvantage ? Math.min(d20a, d20b)
                   : d20a;
    await showD20Roll(d20, { label: isSpellAction ? action.name : `Attacco · ${action.name}` });
    const hitTotal = d20 + (action.hitBonus || 0) + statMod + armorPenalty + weaponBuff + aidBonus + inspirationBonus + magicDetectBonus + hunterMarkBonus + blindDebuffPenalty + titleHitBonus;
    const shieldLost       = defenderSnap?.hasShield && defMatchPlayer?.shieldSuppressed;
    const shieldSkillBonus = (defMatchPlayer?.shieldSkillTurns ?? 0) > 0 ? (defMatchPlayer?.shieldSkillBonus ?? 3) : 0;
    const armorForgeBonus  = (defMatchPlayer?.armorForgeTurns ?? 0) > 0 ? 2 : 0;
    const defensiveAcBonus = defMatchPlayer?.defensiveBonus ?? 0;
    const defAC    = getEffectiveAc(defMatchPlayer, defenderSnap) - (shieldLost ? 2 : 0) + shieldSkillBonus + armorForgeBonus + defensiveAcBonus;
    const critThreshold = isFighter ? 19 : 20; // Critico Migliorato: 19-20 per il guerriero
    const isCrit   = d20 >= critThreshold; // nat 20 (o 19 per fighter) = critico
    const isHit    = hitTotal >= defAC || isCrit;
    const { total: baseDmg, rolls: diceRolls } = isHit ? rollDmg(action.damage) : { total: 0, rolls: "0" };
    // Critico spells: doppio danno
    const critMult = isCrit ? 2 : 1;
    // Weapon poison bonus
    const weaponPoisoned = !!attackerMatchPlayer?.weaponPoisoned;
    const { total: poisonBonusDmg, rolls: poisonRolls } = isHit && weaponPoisoned ? rollDmg("1d12") : { total: 0, rolls: "" };
    // Patto Demoniaco (Warlock): +1d12 ai danni delle spell che colpiscono per 3 turni dopo l'attivazione.
    const pattoActive = (attackerMatchPlayer?.pattoTurns ?? 0) > 0;
    const { total: pattoBonusDmg, rolls: pattoRolls } = isHit && isSpellAction && pattoActive ? rollDmg("1d12") : { total: 0, rolls: "" };
    // Le spell che fanno danno usano il mod del caster (INT/SAG/CAR), come le armi col loro statKey.
    const spellDealsDmg  = isSpellAction && (action.damage && action.damage !== "—");
    const dmgStatMod     = !isSpellAction ? statMod : (spellDealsDmg ? statMod : 0);
    const rawDamage = (isHit && !isBlindDebuff) ? (baseDmg + dmgStatMod + weaponBuff + rageDmgBonus + barbarianDmgBonus + concentrationDmg) * critMult + poisonBonusDmg + pattoBonusDmg : 0;
    // Furia del Barbaro: dimezza i danni subiti da armi e skill (non da incantesimi).
    const rageReducedDamage = applyBarbarianRageReduction(rawDamage, defenderSnap, defMatchPlayer, isSpellAction);
    // Golem dell'Artefice: il prossimo colpo ricevuto dalla vittima è dimezzato.
    const golemHalved = isHit && !!defMatchPlayer?.nextHitHalved && rageReducedDamage > 0;
    const damage = golemHalved ? Math.floor(rageReducedDamage / 2) : rageReducedDamage;

    // Log breakdown
    const statPart       = !isSpellAction && action.statKey ? ` ${statMod >= 0 ? "+" : ""}${statMod} ${action.statKey.toUpperCase()}` : '';
    const spellModPart   = isSpellAction && spellcastKey ? ` ${statMod >= 0 ? "+" : ""}${statMod} ${spellcastKey.toUpperCase()}` : '';
    const dmgModPart     = (dmgStatMod !== 0) ? ` ${dmgStatMod >= 0 ? "+" : ""}${dmgStatMod} ${(action.statKey || spellcastKey || "").toUpperCase()}` : '';
    const aidPart        = aidBonus > 0 ? ` +${aidBonus} Aiuto` : '';
    const penPart        = armorPenalty < 0 ? ` ${armorPenalty} arm.` : '';
    const critTag        = isCrit ? " ★CRITICO★" : "";
    const poisonTag      = poisonBonusDmg > 0 ? ` | veleno 🎲${poisonRolls}=${poisonBonusDmg}` : "";
    const pattoTag       = pattoBonusDmg > 0 ? ` | 🩸patto 🎲${pattoRolls}=${pattoBonusDmg}` : "";
    const rageTag        = rageDmgBonus > 0 ? ` | furia +${rageDmgBonus}` : "";
    const barbDmgTag     = barbarianDmgBonus > 0 ? ` | barb +${barbarianDmgBonus}` : "";
    const concentrationTag = concentrationDmg > 0 ? ` | 🧘conc. +${concentrationDmg}` : "";
    const inspirationTag = inspirationBonus > 0 ? ` +ispirazione 🎵🎲${inspirationRolls}=${inspirationBonus}` : "";
    const magicDetTag    = magicDetectBonus > 0 ? ` +${magicDetectBonus} 🔮det.` : "";
    const advantageTag   = hasAdvantage && !hasDisadvantage ? ` 🌟vant.[${d20a},${d20b}]`
                         : hasDisadvantage && !hasAdvantage ? ` 🌑svant.[${d20a},${d20b}]`
                         : "";
    const hunterMarkTag  = hunterMarkBonus > 0 ? ` +3 🎯marchio` : "";
    const blindPenTag    = blindDebuffPenalty < 0 ? ` ${blindDebuffPenalty} 🙈acc.` : "";
    const titleTag       = titleHitBonus > 0
      ? ` +${titleHitBonus} ${attackerTitles.filter(k => getTitleHitBonus({ titleKey: k, ...titleHitCtx }) > 0).map(k => ARENA_TITLES[k]?.icon || "♛").join("")}titolo`
      : "";
    const critDmgNote    = isCrit ? ` ×2` : "";
    const dmgBreakdown   = (isHit && !isBlindDebuff)
      ? ` [danni: 🎲${diceRolls}${dmgModPart}${critDmgNote}${poisonTag}${pattoTag}${rageTag}${barbDmgTag}${concentrationTag} = ${damage}]`
      : "";
    const hitBreakdown = `🎲d20=${d20}${critTag}${advantageTag} +${action.hitBonus} hit${statPart}${spellModPart}${penPart}${aidPart}${inspirationTag}${magicDetTag}${hunterMarkTag}${blindPenTag}${titleTag} = ${hitTotal} vs CA ${defAC}`;
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

    const newTurnExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    let absorbedLog = null;
    let updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const rawPlayers = m.players.map(p => {
        if (p.id === targetId) {
          // nextHitHalved: una volta consumato dal colpo che ha ricevuto il dimezzamento, lo togliamo.
          const golemConsumed = golemHalved ? { nextHitHalved: false } : {};
          if (p.absorbDamageNext && damage > 0) {
            const tgtSnap = (arenaMeta.characterSnapshots || {})[targetId] || {};
            const maxHp = tgtSnap.stats?.maxHp ?? p.maxHp ?? p.hp;
            const heal  = Math.floor(damage / 2);
            absorbedLog = `🌀 ${p.name} assorbe il colpo e si cura di ${heal} HP!`;
            return { ...p, hp: Math.min(maxHp, p.hp + heal), absorbDamageNext: false, blindDebuff: isBlindDebuff && isHit ? true : (p.blindDebuff ?? false), ...consumeInvisibility(p), ...golemConsumed, stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1) };
          }
          return { ...p, hp: Math.max(0, p.hp - damage), blindDebuff: isBlindDebuff && isHit ? true : (p.blindDebuff ?? false), ...consumeInvisibility(p), ...golemConsumed, stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1) };
        }
        if (p.id === currentUser.uid) {
          // Magic-detect counter: scala 1 per attacco. Si svuota (spegne il buff) solo a contatore=0.
          const prevMdAtk = p.magicDetectAttacks ?? (p.magicDetectActive ? 1 : 0);
          const newMdAtk  = Math.max(0, prevMdAtk - 1);
          const newMd     = newMdAtk > 0 ? p.magicDetectActive : false;
          // Attacco Poderoso: SET di selfAdvTurns (buff appena attivato).
          // Il tick "−1 per turno" è gestito in turnEndDecays.
          const selfAdvPatch = action.grantsAdvTurns ? { selfAdvTurns: action.grantsAdvTurns } : {};
          // Timer turn-based (Furia/Hunter Mark/Scudo/Patto/Forgia/Concentr/Aquila):
          // NON decrementati qui — si decrementano a fine turno (turnEndDecays).
          const up = { ...p, defensiveBonus: 0, weaponPoisoned: false, aidBuff: false, bonusActionUsed: false, itemUsedThisTurn: false, bardicInspirationActive: false, magicDetectActive: newMd, magicDetectAttacks: newMdAtk, ...consumeInvisibility(p), stealthAdvTurns: Math.max(0, readStealthAdvTurns(p) - 1), ...selfAdvPatch };
          if (action.maxUses !== undefined) {
            const prev = p.actionUsesLeft ?? {};
            up.actionUsesLeft = { ...prev, [action.name]: Math.max(0, (prev[action.name] ?? action.maxUses) - 1) };
          }
          return up;
        }
        return { ...p, ...consumeInvisibility(p) };
      });
      const { players: updatedPlayers, extraLogs } = processWsKnockouts(rawPlayers);
      const newParticipantsAwarded = _alreadyAwarded
        ? (m.participantsAwarded || [])
        : [...(m.participantsAwarded || []), currentUser.uid];
      const allLogs = [...m.logs, log, ...extraLogs, ...(absorbedLog ? [absorbedLog] : [])];
      const alive = updatedPlayers.filter(p => p.hp > 0);
      if (alive.length === 1) {
        return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
          participantsAwarded: newParticipantsAwarded,
          logs: [...allLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      }
      // Multi-azione (Monaco x2, Ladro x2, Scatto d'Azione +1): non avanza il turno finché restano azioni.
      const meBefore = m.players.find(p => p.id === currentUser.uid);
      const maxActions = getMaxActionsPerTurn(attackerSnap, meBefore);
      const usedSoFar = meBefore?.multiActionsUsed ?? 0;
      const stayingThisTurn = (usedSoFar + 1) < maxActions;
      const newMultiUsed = stayingThisTurn ? usedSoFar + 1 : 0;
      // bonusActionUsed / itemUsedThisTurn devono persistere per l'intero turno del giocatore:
      // si resettano solo quando il turno avanza davvero.
      const preservedBonusUsed = !!meBefore?.bonusActionUsed;
      const preservedItemUsed  = !!meBefore?.itemUsedThisTurn;
      // Timer "per N turni": decrementati SOLO a fine turno (non per ogni multi-azione).
      const turnEndDecays = stayingThisTurn ? {} : {
        attackDisadvantageTurns: Math.max(0, (meBefore?.attackDisadvantageTurns ?? 0) - 1),
        weaponLockTurns: Math.max(0, (meBefore?.weaponLockTurns ?? 0) - 1),
        shieldSkillTurns: Math.max(0, (meBefore?.shieldSkillTurns ?? 0) - 1),
        rageTurns: Math.max(0, (meBefore?.rageTurns ?? 0) - 1),
        hunterMarkTurns: Math.max(0, (meBefore?.hunterMarkTurns ?? 0) - 1),
        concentrationTurns: Math.max(0, (meBefore?.concentrationTurns ?? 0) - 1),
        pattoTurns: Math.max(0, (meBefore?.pattoTurns ?? 0) - 1),
        armorForgeTurns: Math.max(0, (meBefore?.armorForgeTurns ?? 0) - 1),
        selfAdvTurns: action.grantsAdvTurns ? action.grantsAdvTurns : Math.max(0, (meBefore?.selfAdvTurns ?? 0) - 1),
        ...tickEagleEnd(meBefore || {}),
      };
      // 🗡 Ladro: traccia le armi usate nel turno (ogni mano una sola volta).
      const _rogueAtt = isRogueClass((attackerSnap?.class || "").toLowerCase());
      const _accWeaponsUsed = (_rogueAtt && action.type === "weapon")
        ? [ ...((meBefore?.turnWeaponsUsed) || []), action.name ]
        : ((meBefore?.turnWeaponsUsed) || []);
      const playersWithMultiState = updatedPlayers.map(p =>
        p.id === currentUser.uid
          ? { ...p,
              multiActionsUsed: newMultiUsed,
              turnWeaponsUsed:   stayingThisTurn ? _accWeaponsUsed : [],
              turnSkillUsed:     stayingThisTurn ? !!meBefore?.turnSkillUsed : false,
              bonusActionUsed:   stayingThisTurn ? !!preservedBonusUsed   : false,
              itemUsedThisTurn:  stayingThisTurn ? !!preservedItemUsed    : false,
              extraTurnActive:   stayingThisTurn ? !!p.extraTurnActive    : false,
              actionSurgeActive: stayingThisTurn ? !!p.actionSurgeActive  : false,
              ...turnEndDecays }
          : p
      );
      const nextTurn = stayingThisTurn ? currentUser.uid : advanceTurn(playersWithMultiState, m);
      return { ...m, players: playersWithMultiState, turn: nextTurn, turnExpiry: newTurnExpiry, participantsAwarded: newParticipantsAwarded, logs: allLogs };
    });

    await awardRoundCoins(updatedMatches);
    await resolveBetsForFinishedMatches(updatedMatches);
    await recordMatchHistory(updatedMatches);
    const finalM = updatedMatches.find(m => m.kind === "final");
    if (finalM && finalM.status === "finished" && finalM.winner) {
      const champSnap = snapshots[finalM.winner] || {};
      await sendChampionNotification(finalM.winner, champSnap.name || "Campione", arenaMeta?.prizes || "", updatedMatches);
      await updateDoc(doc(db, "arena_meta", "global"), {
        matches: updatedMatches, tournamentWinner: finalM.winner, phase: "finished",
      });
      return;
    }
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── SCUDO (skill caster) ──────────────────────────────────────────────────
  const handleShieldSkill = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const bonus = action?.shieldBuffBonus ?? 3;
    const turns = action?.shieldBuffTurns ?? 3;
    const spellName = action?.name || "Scudo";
    const log = { pub: `🛡 ${myName} lancia ${spellName}! (+${bonus} CA per ${turns} turni)`, attId: currentUser.uid, ts: new Date().toISOString() };
    const shieldExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = action?.maxUses !== undefined
          ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) }
          : uses;
        return { ...p, shieldSkillTurns: turns, shieldSkillBonus: bonus, defensiveBonus: 0, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: shieldExpiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── SECONDO RESPIRO (Fighter) ─────────────────────────────────────────────
  const handleSecondWind = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Guerriero";
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const { total: healAmt, rolls: healRolls } = rollDmg("1d12");
    const totalHeal = healAmt + 5;
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const maxHp = mySnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, hp: Math.min(maxHp, p.hp + totalHeal), shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), ...tickEagleEnd(p), defensiveBonus: 0, aidBuff: false, bonusActionUsed: false, itemUsedThisTurn: false, actionUsesLeft: newUses };
      });
      const log = { pub: `💨 ${myName} usa Secondo Respiro! Cura 🎲${healRolls}+5=${totalHeal} HP`, attId: currentUser.uid, ts: new Date().toISOString() };
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── SCATTO D'AZIONE (Fighter) ─────────────────────────────────────────────
  const handleActionSurge = async (matchId, action) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    try {
      const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Guerriero";
      const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
      const me = myMatch?.players.find(p => p.id === currentUser.uid);
      if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
      const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id !== currentUser.uid) return p;
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, actionSurgeActive: true, bonusActionUsed: true, actionUsesLeft: newUses };
        });
        const log = { pub: `⚡ ${myName} attiva Scatto d'Azione! Guadagna un'azione extra.`, attId: currentUser.uid, ts: new Date().toISOString() };
        // Turn stays on current player
        return { ...m, players: updatedPlayers, turn: currentUser.uid, turnExpiry: expiry, logs: [...m.logs, log] };
      });
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
    } finally {
      actionInFlightRef.current = false;
    }
  };

  // ── INDIVIDUAZIONE DEL MAGICO / Guida / Aiuto / Luci Fatate / Benedire / Passo Spedito ──
  // Bonus a numero di attacchi (counter): action.buffBonus + action.buffAttacks
  const handleMagicDetect = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "Bardo";
    const bonusVal = action.buffBonus ?? getMagicDetectBonusForClass((mySnap?.class || "").toLowerCase());
    const attacksVal = action.buffAttacks ?? 1;
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, magicDetectActive: bonusVal, magicDetectAttacks: attacksVal, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const turnsTxt = attacksVal === 1 ? "prossimo attacco" : `prossimi ${attacksVal} attacchi`;
      const log = { pub: `🔮 ${myName} invoca ${action.name}! (+${bonusVal} ai ${turnsTxt})`, attId: currentUser.uid, ts: new Date().toISOString() };
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── CONCENTRAZIONE (Monk · Bonus Action: +4 danni per 2 turni) ────────────
  const handleConcentrate = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Monaco";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, concentrationTurns: 2, bonusActionUsed: true, actionUsesLeft: newUses };
      });
      const log = { pub: `🧘 ${myName} si concentra! +4 danni per 2 turni (bonus action)`, attId: currentUser.uid, ts: new Date().toISOString() };
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── CURA KI (Monk · Bonus Action: cura 1d8+SAG HP) ────────────────────────
  const handleKiHealing = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Monaco";
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const wisMod = mySnap?.stats?.wis ?? 0;
    const { total: healAmt, rolls: healRolls } = rollDmg(action.damage || "1d8");
    const totalHeal = Math.max(1, healAmt + wisMod);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const maxHp = mySnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, hp: Math.min(maxHp, p.hp + totalHeal), bonusActionUsed: true, actionUsesLeft: newUses };
      });
      const sign = wisMod >= 0 ? "+" : "";
      const log = { pub: `🧘 ${myName} canalizza il Ki! Cura 🎲${healRolls}${sign}${wisMod} SAG = ${totalHeal} HP (bonus action)`, attId: currentUser.uid, ts: new Date().toISOString() };
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── ASSORBIRE DANNI (Monk · Bonus Action: prossimo danno → cura 50%) ──────
  // Il nemico vede solo una posa marziale generica per non perdere l'incentivo ad attaccare.
  const handleAbsorbDamage = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Monaco";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const log = {
      pub: `🧘 ${myName} chiude gli occhi e respira profondamente.`,
      att: `🌀 Ti prepari ad assorbire il prossimo colpo (curi il 50% del danno subito · bonus action)`,
      attId: currentUser.uid, ts: new Date().toISOString(),
    };
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, absorbDamageNext: true, bonusActionUsed: true, actionUsesLeft: newUses };
      });
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── INVISIBILITÀ (il nemico non può attaccare il prossimo turno) ──────────
  const handleInvisibility = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Bardo";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const duration = action.invisibilityDuration ?? 1;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, invisible: true, invisibilityTurns: duration, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const turnsLog = duration > 1 ? `${duration} turni` : "il prossimo turno";
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, `👻 ${myName} svanisce nell'ombra! Il nemico non può attaccare per ${turnsLog}.`] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── ISPIRAZIONE BARDICA (Bonus Action) ─────────────────────────────────────
  const handleBardicInspiration = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Bardo";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, bardicInspirationActive: true, bonusActionUsed: true, actionUsesLeft: newUses };
      });
      const log = `🎵 ${myName} si ispira! +1d6 al prossimo tiro per colpire (bonus action).`;
      // Bonus action: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── FURIA (Barbarian · Bonus Action) ───────────────────────────────────────
  const handleRage = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Barbaro";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const log = `🔥 ${myName} entra in Furia! (+2 danno armi per 3 turni · bonus action)`;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, rageTurns: 3, bonusActionUsed: true, actionUsesLeft: newUses };
      });
      // Bonus action: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── MARCHIO DEL CACCIATORE (Ranger · BONUS ACTION) ────────────────────────
  const handleHunterMark = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Ranger";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const log = `🎯 ${myName} segna il bersaglio con il Marchio del Cacciatore! (+3 ai tiri per colpire per 3 turni · bonus action)`;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, hunterMarkTurns: 3, bonusActionUsed: true, actionUsesLeft: newUses };
      });
      // Bonus action: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── COMPAGNI ANIMALI (Ranger) ─────────────────────────────────────────────
  const handlePetWolf = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Ranger";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const { total: rawDmg, rolls } = rollDmg(action.damage);
    const targetSnapPre = arenaMeta.characterSnapshots?.[targetId];
    const targetMatchPre = myMatch?.players.find(p => p.id === targetId);
    const dmg = applyBarbarianRageReduction(rawDmg, targetSnapPre, targetMatchPre, false);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, bonusActionUsed: true, actionUsesLeft: newUses };
        }
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - dmg) };
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `🐺 Il lupo di ${myName} morde ${targetName} 🎲(${rolls})=${dmg} danni! · bonus action`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      // Bonus action: il turno NON avanza.
      return { ...m, players, logs: [...m.logs, log, ...extraLogs] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const handlePetSpider = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Ranger";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const targetSnap = arenaMeta.characterSnapshots?.[targetId];
    const targetName = targetSnap?.name || "?";
    const saveAbility = action.saveAbility || "str";
    const saveDC = action.saveDC ?? 13;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, bonusActionUsed: true, actionUsesLeft: newUses };
        }
        if (p.id === targetId) return {
          ...p,
          pendingControlSave: true,
          pendingControlDC: saveDC,
          pendingControlSaveAbility: saveAbility,
          controlLostTurns: 2,
          poisonDoT: true,
          poisonDoTTurns: Math.max(p.poisonDoTTurns ?? 0, 2),
          poisonDoTDice: "1d4",
          poisonDoTSourceLabel: "veleno del ragno",
          poisonDoTIcon: "🕷",
        };
        return p;
      });
      const log = `🕷 Il ragno di ${myName} morde e intrappola ${targetName} — veleno 🕷 1d4 a inizio turno per 2 turni · TS ${SAVE_LABEL[saveAbility]} (CD ${saveDC}) ogni turno per liberarsi. · bonus action`;
      // Bonus action: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const handlePetEagle = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Ranger";
    const _eagleMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = _eagleMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const { total: rawDmg, rolls } = rollDmg(action.damage);
    const dmg = applyBarbarianRageReduction(rawDmg, arenaMeta.characterSnapshots?.[targetId], _eagleMatch?.players.find(p => p.id === targetId), false);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, bonusActionUsed: true, actionUsesLeft: newUses };
        }
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - dmg), blindDebuff: true, eagleDebuffTurns: 3 };
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `🦅 L'aquila di ${myName} si avventa su ${targetName}! 🎲(${rolls})=${dmg} danni · accecato + svantaggio per 3 turni. · bonus action`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      // Bonus action: il turno NON avanza.
      return { ...m, players, logs: [...m.logs, log, ...extraLogs] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── DRAGO DI SMERALDO (Ranger unique) — auto-hit + cura caster ──────────
  const handlePetDrago = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Ranger";
    const _dragoMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = _dragoMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const { total: rawDmg, rolls } = rollDmg(action.damage);
    const dmg = applyBarbarianRageReduction(rawDmg, arenaMeta.characterSnapshots?.[targetId], _dragoMatch?.players.find(p => p.id === targetId), false);
    const { total: heal, rolls: healRolls } = rollDmg("1d6");
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          const maxHp = p.maxHp || p.hp;
          return { ...p, hp: Math.min(maxHp, p.hp + heal), bonusActionUsed: true, actionUsesLeft: newUses };
        }
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - dmg) };
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `🐉 Il Drago di Smeraldo di ${myName} colpisce ${targetName} 🎲(${rolls})=${dmg} danni e cura il padrone 🎲(${healRolls})=${heal} PF! · bonus action`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      // Bonus action: il turno NON avanza.
      return { ...m, players, logs: [...m.logs, log, ...extraLogs] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── DEMONI EVOCATI (Warlock) ─────────────────────────────────────────────
  const handleDemonMephit = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Warlock";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const burnTurns = action.burnTurns ?? 3;
    const burnDice  = action.burnDice  ?? "1d8+2";
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const updatedPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, bonusActionUsed: true, actionUsesLeft: newUses };
        }
        if (p.id === targetId) return {
          ...p,
          poisonDoT: true,
          poisonDoTTurns: burnTurns,
          poisonDoTDice: burnDice,
          poisonDoTNoun: "in fiamme",
          poisonDoTSourceLabel: "fuoco",
          poisonDoTIcon: "🔥",
        };
        return p;
      });
      const log = `🔥 Il Mephit di ${myName} brucia ${targetName}! Subirà ${burnDice} fuoco a inizio turno per ${burnTurns} turni. · bonus action`;
      // Bonus action: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const handleDemonSuccubus = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Warlock";
    const targetSnap = arenaMeta.characterSnapshots?.[targetId];
    const targetName = targetSnap?.name || "?";
    const saveAbility = action.saveAbility || "cha";
    const saveDC = action.saveDC ?? 13;
    const defMod = targetSnap?.stats?.[saveAbility] ?? 0;
    const d20 = Math.floor(Math.random() * 20) + 1;
    await showD20Roll(d20, { label: `TS ${SAVE_LABEL[saveAbility]} · ${action.name}` });
    const tsTotal = d20 + defMod;
    const saved = tsTotal >= saveDC;
    const lostTurns      = saved ? 1 : 3;
    const disadvantageT  = saved ? 2 : 3;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses };
        }
        if (p.id === targetId) return {
          ...p,
          controlLostTurns: lostTurns,
          attackDisadvantageTurns: Math.max(p.attackDisadvantageTurns ?? 0, disadvantageT),
        };
        return p;
      });
      const log = saved
        ? `💋 La Succubus di ${myName} ammalia ${targetName} (TS ${SAVE_LABEL[saveAbility]} ${tsTotal} ≥ ${saveDC}) — salta 1 turno · svantaggio per 2 turni.`
        : `💋 La Succubus di ${myName} ammalia ${targetName} (TS ${SAVE_LABEL[saveAbility]} ${tsTotal} < ${saveDC}) — salta 3 turni · svantaggio per 3 turni.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const handleDemonGreater = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Warlock";
    const { total: rawDmg, rolls } = rollDmg(action.damage);
    const _demonMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const dmg = applyBarbarianRageReduction(rawDmg, arenaMeta.characterSnapshots?.[targetId], _demonMatch?.players.find(p => p.id === targetId), false);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          const maxHp = p.maxHp || p.hp;
          return { ...p, hp: Math.min(maxHp, p.hp + dmg), ...tickEagleEnd(p), actionUsesLeft: newUses };
        }
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - dmg) };
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `👹 Il Demone di ${myName} drena ${targetName} 🎲(${rolls})=${dmg} PF e ridona al padrone gli stessi ${dmg} PF!`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log, ...extraLogs] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── COSTRUTTI (Artefice) ─────────────────────────────────────────────────
  const handleConstructGolem = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Artefice";
    const { total: rawDmg, rolls } = rollDmg(action.damage);
    const _golemMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const dmg = applyBarbarianRageReduction(rawDmg, arenaMeta.characterSnapshots?.[targetId], _golemMatch?.players.find(p => p.id === targetId), false);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          // Imposta la difesa: il prossimo colpo subìto è dimezzato.
          return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses, nextHitHalved: true };
        }
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - dmg) };
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `🤖 Il Golem di ${myName} colpisce ${targetName} 🎲(${rolls})=${dmg} danni · prossimo colpo subìto sarà dimezzato.`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log, ...extraLogs] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  const handleConstructSnake = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Artefice";
    const { total: rawDmg, rolls } = rollDmg(action.damage);
    const _snakeMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const dmg = applyBarbarianRageReduction(rawDmg, arenaMeta.characterSnapshots?.[targetId], _snakeMatch?.players.find(p => p.id === targetId), false);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses };
        }
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - dmg), poisonDoT: true, poisonDoTTurns: 2 };
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `🐍 Il Serpente di ${myName} morde ${targetName} 🎲(${rolls})=${dmg} danni · veleno 1d6 per 2 turni.`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log, ...extraLogs] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── FORGIA ARMATURA (Artefice) — +2 CA per 2 turni ─────────────────────────
  const handleArmorForge = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Artefice";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, armorForgeTurns: 2, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, `🛠 ${myName} forgia un'armatura sul campo! +2 CA per 2 turni.`] };
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
        return { ...p, ...tickEagleEnd(p), actionUsesLeft: uses };
      });
      const log = `🔮 ${myName} attinge alla Fonte di Magia! Ripristina: ${selectedSpellNames.join(", ")}`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
    setShowFontePicker(false);
    setFonteSelected([]);
  };

  // ── ASTUZIA MAGICA (Warlock) — salta turno, ripristina tutti gli slot ──────
  // ── PATTO DEMONIACO (Warlock) ─────────────────────────────────────────────
  // Sacrifica 1d4 PF e attiva pattoTurns=3. Mentre pattoTurns > 0, ogni
  // spell che colpisce aggiunge 1d12 ai danni (vedi spell damage path).
  const handlePattoDemoniaco = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Warlock";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const { total: selfDmg, rolls: selfRolls } = rollDmg("1d4");
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const rawPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, hp: Math.max(0, p.hp - selfDmg), pattoTurns: 3, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `🩸 ${myName} stringe un Patto Demoniaco · sacrifica 🎲(${selfRolls})=${selfDmg} PF · per 3 turni le sue spell che colpiscono fanno +1d12 danni!`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: expiry, logs: [...m.logs, log, ...extraLogs] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

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
        // Restore +1 charge to each spell slot (capped at its maxUses)
        (mySnap?.selectedActions || []).forEach(a => {
          if (a.maxUses && a.level > 0) {
            const cur = uses[a.name] ?? a.maxUses;
            uses[a.name] = Math.min(a.maxUses, cur + 1);
          }
        });
        return { ...p, ...tickEagleEnd(p), actionUsesLeft: uses };
      });
      const log = `🌀 ${myName} usa Astuzia Magica! Salta il turno e ripristina 1 carica a ogni slot magia.`;
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
        return { ...p, ...tickEagleEnd(p), actionUsesLeft: uses };
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

  // ── POISON DOT — applica DoT una volta per turno (dado/flavor configurabili) ──
  const handleResolvePoisonDoT = async (matchId) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    const turnTokenAtClick = myMatch?.turnExpiry || "";
    // Già risolto in questo stesso turno: non riapplicare.
    if (me?.poisonResolvedTurnToken && me.poisonResolvedTurnToken === turnTokenAtClick) return;
    const dice = me?.poisonDoTDice || "1d6";
    const sourceLabel = me?.poisonDoTSourceLabel || "veleno";
    const icon = me?.poisonDoTIcon || "☠";
    const { total: poisonDmg, rolls: poisonRolls } = rollDmg(dice);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const rawPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const remainingDoT = Math.max(0, (p.poisonDoTTurns ?? 1) - 1);
        const stillAfflicted = remainingDoT > 0;
        const patch = {
          ...p,
          hp: Math.max(0, (p.hp ?? 0) - poisonDmg),
          poisonDoT: stillAfflicted,
          poisonDoTTurns: remainingDoT,
          poisonResolvedTurnToken: m.turnExpiry || "",
        };
        if (!stillAfflicted) {
          patch.poisonDoTDice = null;
          patch.poisonDoTNoun = null;
          patch.poisonDoTSourceLabel = null;
          patch.poisonDoTIcon = null;
        }
        return patch;
      });
      const { players: updatedPlayers, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `${icon} ${myName} subisce il ${sourceLabel}: ${poisonDmg} danni [🎲${dice}=${poisonRolls}]!`;
      return { ...m, players: updatedPlayers, logs: [...m.logs, log, ...extraLogs] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── BLEED DOT — sanguinamento (Triboli del Ladro). Stack indipendente dal veleno. ──
  const handleResolveBleedDoT = async (matchId) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    const turnTokenAtClick = myMatch?.turnExpiry || "";
    if (me?.bleedResolvedTurnToken && me.bleedResolvedTurnToken === turnTokenAtClick) return;
    const dice = me?.bleedDoTDice || "1d6";
    const sourceLabel = me?.bleedDoTSourceLabel || "sanguinamento";
    const icon = me?.bleedDoTIcon || "🩸";
    const { total: bleedDmg, rolls: bleedRolls } = rollDmg(dice);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const rawPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const remaining = Math.max(0, (p.bleedDoTTurns ?? 1) - 1);
        const stillAfflicted = remaining > 0;
        const patch = {
          ...p,
          hp: Math.max(0, (p.hp ?? 0) - bleedDmg),
          bleedDoT: stillAfflicted,
          bleedDoTTurns: remaining,
          bleedResolvedTurnToken: m.turnExpiry || "",
        };
        if (!stillAfflicted) {
          patch.bleedDoTDice = null;
          patch.bleedDoTNoun = null;
          patch.bleedDoTSourceLabel = null;
          patch.bleedDoTIcon = null;
        }
        return patch;
      });
      const { players: updatedPlayers, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `${icon} ${myName} subisce il ${sourceLabel}: ${bleedDmg} danni [🎲${dice}=${bleedRolls}]!`;
      return { ...m, players: updatedPlayers, logs: [...m.logs, log, ...extraLogs] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── LAY OF HANDS — Bonus Action: cura senza terminare il turno ─────────────
  const handleLayOfHands = async (matchId, healAmt) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Paladino";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const maxHp = p.maxHp || p.hp;
        const newHp = Math.min(maxHp, (p.hp || 0) + healAmt);
        const newPool = Math.max(0, (p.layOfHandsPool ?? 0) - healAmt);
        return { ...p, hp: newHp, layOfHandsPool: newPool, bonusActionUsed: true };
      });
      const log = `🙏 ${myName} usa Lay of Hands → cura sé stesso di ${healAmt} HP · bonus action`;
      // Bonus action: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    setShowLayOfHandsPicker(false);
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── AID BUFF (Aiuto) — +4 di default, +2 per Chierico/Paladino ──────────────
  const handleAidBuff = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "Paladino";
    const bonusVal = getAidBonusForClass((mySnap?.class || "").toLowerCase());
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 1)) - 1) };
        return { ...p, aidBuff: bonusVal, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const log = `🤝 ${myName} si concentra — +${bonusVal} al prossimo tiro per colpire!`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── SAVE BUFF (Assorbire Elementi) — +N ai prossimi M tiri salvezza ──────
  const handleSaveBuff = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "?";
    const bonus = action.tsBonus ?? 3;
    const attacks = action.tsAttacks ?? 3;
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = action.maxUses !== undefined ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) } : uses;
        return { ...p, saveBuffBonus: bonus, saveBuffAttacks: attacks, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const log = `🔰 ${myName} invoca ${action.name}! +${bonus} ai prossimi ${attacks} TS.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── WEAPON LOCK (Riscaldare Arma) — il nemico non può attaccare con armi per N turni ─
  const handleWeaponLock = async (matchId, targetId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "?";
    const turns = action.weaponLockTurns ?? 2;
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id === targetId) return { ...p, weaponLockTurns: turns };
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = action.maxUses !== undefined ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) } : uses;
          return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses };
        }
        return p;
      });
      const targetName = (arenaMeta.characterSnapshots || {})[targetId]?.name || "?";
      const log = `🔩 ${myName} arroventa l'arma di ${targetName}! Per ${turns} turni non può usarla.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── SELF ADVANTAGE (Benedire) — vantaggio ai propri attacchi per N turni ────
  const handleSelfAdvantage = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "?";
    const turns = action.advantageTurns ?? 2;
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = action.maxUses !== undefined
          ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) }
          : uses;
        return { ...p, selfAdvTurns: turns, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const log = `✨ ${myName} invoca ${action.name}! Vantaggio ai prossimi ${turns} attacchi.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── DISADVANTAGE ENEMY (Nebbia / Oscurità) — svantaggio agli attacchi del nemico ────
  const handleDisadvEnemy = async (matchId, targetId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "?";
    const turns = action.disadvantageTurns ?? 3;
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id === targetId) return { ...p, attackDisadvantageTurns: turns };
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = action.maxUses !== undefined ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) } : uses;
          return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses };
        }
        return p;
      });
      const targetName = (arenaMeta.characterSnapshots || {})[targetId]?.name || "?";
      const log = `🌫 ${myName} oscura ${targetName}! Svantaggio ai suoi tiri per colpire per ${turns} turni.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── EXTRA TURN (Passo Spedito) — la prossima volta che agisci hai 2 azioni ─
  const handleExtraTurn = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "?";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = action.maxUses !== undefined ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) } : uses;
        return { ...p, extraTurnActive: true, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const log = { pub: `💨 ${myName} si prepara a un Passo Spedito: il prossimo turno avrà 2 azioni!`, attId: currentUser.uid, ts: new Date().toISOString() };
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── SAVE DOT (Raggio Avvelenato) — TS COS o subisci 2d6/turno per 3 turni ─
  const handleSaveDotSpell = async (matchId, targetId, action) => {
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const myName = mySnap?.name || "?";
    const dc = action.saveDotDC ?? getSpellSaveDC(mySnap);
    const ability = action.saveDotAbility || "con";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
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
            const uses = (p.actionUsesLeft || {});
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 1)) - 1) };
            return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses };
          }
          if (p.id === targetId) return { ...p, pendingSaveDot: { ability, dc, dice: action.saveDotDamage || "2d6", turns: action.saveDotTurns ?? 3, name: action.name, icon: action.icon } };
          return p;
        });
        const nextIndex = (m.players.findIndex(p => p.id === m.turn) + 1) % m.players.length;
        const log = `${myName} lancia ${action.icon || "🤢"} ${action.name} su ${targetName} → TS ${SAVE_LABEL[ability]} (CD ${dc}) richiesto!`;
        return { ...m, players, turn: m.players[nextIndex].id, turnExpiry: expiry, logs: [...m.logs, log] };
      });
      tx.update(ref, { matches });
    });
  };

  // ── SKIP TURN (bersaglio invisibile, non puoi attaccare) ────────────────────
  const handleSkipForcedTurn = async (matchId, reason = "invisible") => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const players = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, multiActionsUsed: 0, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false, ...tickEagleEnd(p) } : p
      );
      const log = reason === "invisible"
        ? `👻 ${myName} non riesce a colpire un bersaglio invisibile e salta il turno.`
        : `⏭ ${myName} salta il turno.`;
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── Salta turno perché sotto controllo (TS controllo fallito) ────────────
  const skipControlTurn = async (matchId) => {
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Avventuriero";
      const meBefore = m.players.find(p => p.id === currentUser.uid);
      const remaining = Math.max(0, (meBefore?.controlLostTurns ?? 0) - 1);
      const players = m.players.map(p =>
        p.id === currentUser.uid
          ? { ...p, controlLostTurns: remaining, multiActionsUsed: 0, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false, ...tickEagleEnd(p) }
          : p
      );
      const log = `🌀 ${myName} è sotto controllo e perde il turno (${remaining} turni rimanenti).`;
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── Termina turno volontariamente (Monaco/Ladro doppie armi: salta le azioni rimanenti) ─
  const endMultiActionTurn = async (matchId) => {
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const players = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, multiActionsUsed: 0, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false, ...tickEagleEnd(p) } : p
      );
      const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Avventuriero";
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: expiry, logs: [...m.logs, `⏭ ${myName} termina il turno volontariamente.`] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── Salta turno (qualsiasi giocatore, qualsiasi tipo di arena) ──────────────
  // Avanza il turno e fa scalare i timer basati su round (rage, shield, marchio, ecc.).
  // I buff "al prossimo attacco" (magic_detect, aiuto, veleno) restano intatti perché non hai attaccato.
  const handleSkipTurn = async (matchId) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Avventuriero";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const players = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        return {
          ...p,
          multiActionsUsed: 0,
          turnWeaponsUsed: [],
          turnSkillUsed: false,
          bonusActionUsed: false, itemUsedThisTurn: false,
          defensiveBonus: 0,
          actionSurgeActive: false,
          bardicInspirationActive: false,
          extraTurnActive: false,
          ...tickEagleEnd(p),
          ...consumeInvisibility(p),
          rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1),
          shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1),
          hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1),
          concentrationTurns: Math.max(0, (p.concentrationTurns ?? 0) - 1),
          armorForgeTurns: Math.max(0, (p.armorForgeTurns ?? 0) - 1),
          selfAdvTurns: Math.max(0, (p.selfAdvTurns ?? 0) - 1),
          stealthAdvTurns: Math.max(0, readStealthAdvTurns(p) - 1),
          attackDisadvantageTurns: Math.max(0, (p.attackDisadvantageTurns ?? 0) - 1),
          weaponLockTurns: Math.max(0, (p.weaponLockTurns ?? 0) - 1),
        };
      });
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: expiry, logs: [...m.logs, `⏭ ${myName} salta il turno.`] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── WILD SHAPE ─────────────────────────────────────────────────────────────
  // La trasformazione NON consuma il turno: il druido può trasformarsi e poi
  // attaccare nello stesso turno. Il ritorno volontario invece passa il turno.
  const handleWildShape = async (matchId, formKey) => {
    const myMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
    const wsUsesLeft = myMatchPlayer?.wildShapeUsesLeft ?? 1;
    if (wsUsesLeft <= 0) return;
    const form = WILD_SHAPES[formKey];
    const { count, sides } = form.hpDice;
    // HP della forma = tiro vero del dado (countdsides), non massimo teorico.
    const { total: rolledHp, rolls: hpRolls } = rollDmg(`${count}d${sides}`);
    const newHp = Math.max(1, rolledHp);
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Druido";
    const newUsesLeft = wsUsesLeft - 1;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const me = m.players.find(p => p.id === currentUser.uid);
      const preHp    = me?.hp    ?? 0;
      const preMaxHp = me?.maxHp ?? preHp;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, hp: newHp, maxHp: newHp, wildShape: formKey, preWildShapeHp: preHp, preWildShapeMaxHp: preMaxHp, wildShapeUsesLeft: newUsesLeft, ...tickEagleEnd(p) } : p
      );
      return { ...m, players: updatedPlayers,
        logs: [...m.logs, `🐾 ${myName} si trasforma in ${form.icon} ${form.name}! [🎲${count}d${sides}=${hpRolls}] → ${newHp} HP [Usi rimasti: ${newUsesLeft}/1]`] };
    });
    setShowWildPicker(false);
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // Ritornare alla forma umana è l'azione del turno: dopo il ritorno il turno passa.
  const revertWildShape = async (matchId) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Druido";
    const expiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const myPData = m.players.find(p => p.id === currentUser.uid);
      const restoredHp    = myPData?.preWildShapeHp    ?? myPData?.hp    ?? 0;
      const restoredMaxHp = myPData?.preWildShapeMaxHp ?? myPData?.maxHp ?? restoredHp;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid
          ? { ...p, hp: restoredHp, maxHp: restoredMaxHp, wildShape: null, preWildShapeHp: null, preWildShapeMaxHp: null, multiActionsUsed: 0, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false, ...tickEagleEnd(p) }
          : p
      );
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry,
        logs: [...m.logs, `🧙 ${myName} ritorna alla forma originale (${restoredHp} HP)`] };
    });
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── CURE ──────────────────────────────────────────────────────────────────
  const handleHealSpell = async (matchId, action) => {
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const myName = mySnap?.name || "?";
    const { total: healDice, rolls: healRolls } = rollDmg(action.damage);
    const useOverride = !!action.healModStat;
    const spellMod = useOverride
      ? (mySnap?.stats?.[action.healModStat] ?? 0)
      : getSpellMod(mySnap);
    const healAmt  = Math.max(1, healDice + spellMod);
    const modKey   = useOverride
      ? action.healModStat.toUpperCase()
      : getSpellcastingAbility((mySnap?.class || "").toLowerCase()).toUpperCase();
    const modPart  = spellMod !== 0 ? ` ${spellMod >= 0 ? "+" : ""}${spellMod} ${modKey}` : "";
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
          return { ...p, hp: newHp, ...tickEagleEnd(p), actionUsesLeft: newUses };
        });
        const nextIndex = (m.players.findIndex(p => p.id === m.turn) + 1) % m.players.length;
        const log = `${myName} lancia ${action.icon} ${action.name} → cura sé stesso di ${healAmt} HP 🎲(${healRolls}${modPart})`;
        return { ...m, players, turn: m.players[nextIndex].id, turnExpiry: healExpiry, logs: [...m.logs, log] };
      });
      tx.update(ref, { matches });
    });
  };

  // ── INCANTESIMO A DANNO via TS ─────────────────────────────────────────────
  // Sostituisce il tiro per colpire degli incantesimi: il bersaglio tira d20 + mod
  // nella stessa abilità di lancio del caster (INT/SAG/CAR a seconda della classe).
  // Pass = nessun danno · Fail = danno pieno (dado + spell mod del caster).
  const handleSpellSave = async (matchId, targetId, action) => {
    const snapshots    = arenaMeta.characterSnapshots || {};
    const attackerSnap = snapshots[currentUser.uid];
    const defenderSnap = snapshots[targetId];
    const attName = attackerSnap?.name || "?";
    const defName = defenderSnap?.name || "?";

    // 1 moneta al primo attacco del giocatore in questo match (escluse Sfide Libere)
    const _currentMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const _alreadyAwarded = (_currentMatch?.participantsAwarded || []).includes(currentUser.uid);
    if (!_alreadyAwarded && _currentMatch?.kind !== "fun") await awardArenaCoins(currentUser.uid, 5);

    const ability = getSpellcastingAbility((attackerSnap?.class || "").toLowerCase());
    const dc      = getSpellSaveDC(attackerSnap);
    const defMod  = defenderSnap?.stats?.[ability] ?? 0;
    const defMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === targetId);
    const saveBuffBonus = (defMatchPlayer?.saveBuffAttacks ?? 0) > 0 ? (defMatchPlayer?.saveBuffBonus ?? 0) : 0;
    const d20     = Math.floor(Math.random() * 20) + 1;
    await showD20Roll(d20, { label: `TS ${SAVE_LABEL[ability]} · ${action.name}` });
    const tsTotal = d20 + defMod + saveBuffBonus;
    const saves   = tsTotal >= dc;
    // Stregoneria Innata: nemico tira ≤4 sul d20 → danno +50%.
    const sorcererCrit = !saves && isSorcererClass((attackerSnap?.class || "").toLowerCase()) && d20 <= 4;
    // Rintocco Funebre: 1d12 se nemico già ferito.
    const targetMaxHp = defenderSnap?.stats?.maxHp ?? defMatchPlayer?.maxHp ?? defMatchPlayer?.hp ?? 0;
    const targetCurHp = defMatchPlayer?.hp ?? 0;
    const targetIsHurt = targetMaxHp > 0 && targetCurHp < targetMaxHp;
    const dmgFormula = (action.damageWhenHurt && targetIsHurt) ? action.damageWhenHurt : action.damage;
    const casterMod = attackerSnap?.stats?.[ability] ?? 0;
    const attackerMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
    const concentrationDmg = (attackerMatchPlayer?.concentrationTurns ?? 0) > 0 ? 4 : 0;
    const { total: baseDmg, rolls: diceRolls } = saves ? { total: 0, rolls: "0" } : rollDmg(dmgFormula);
    const rawDmg = saves ? 0 : Math.max(0, baseDmg + casterMod + concentrationDmg);
    const damage = sorcererCrit ? Math.floor(rawDmg * 1.5) : rawDmg;
    // Tocco Vampirico: cura il caster su danno inflitto.
    const { total: vampHeal, rolls: vampRolls } = (!saves && action.vampiric && damage > 0) ? rollDmg(action.vampiricHeal || "1d8") : { total: 0, rolls: "" };
    const modSign = casterMod >= 0 ? "+" : "";
    const concentrationTag = concentrationDmg > 0 ? ` | 🧘conc. +${concentrationDmg}` : "";
    const sorceryTag = sorcererCrit ? " | 🌟Stregoneria Innata +50%" : "";
    const hurtTag    = (action.damageWhenHurt && targetIsHurt) ? ` | 🩸ferito (${dmgFormula})` : "";
    const buffTag    = saveBuffBonus > 0 ? ` +${saveBuffBonus} 🛡abs.` : "";
    const dmgPart = saves ? "" : ` 🎲(${diceRolls})${modSign}${casterMod} ${ability.toUpperCase()}${concentrationTag}${sorceryTag}${hurtTag} = ${damage}`;
    const vampTag    = vampHeal > 0 ? ` | 🩸cura ${vampHeal} HP [🎲${vampRolls}]` : "";
    const log = {
      pub: saves
        ? `✨ ${defName} resiste a ${action.name} (TS ${SAVE_LABEL[ability]} ${tsTotal}${buffTag} ≥ ${dc}) — nessun danno.`
        : `✨ ${attName} colpisce ${defName} con ${action.name} (TS ${SAVE_LABEL[ability]} ${tsTotal}${buffTag} < ${dc})${dmgPart}${vampTag} — ${damage} danni.`,
      att: saves
        ? `✨ ${defName} resiste a ${action.name} (TS ${SAVE_LABEL[ability]} ${tsTotal}${buffTag} ≥ CD ${dc}).`
        : `✨ Colpisci ${defName} con ${action.name} (TS ${SAVE_LABEL[ability]} ${tsTotal}${buffTag} < CD ${dc})${dmgPart}${vampTag} — ${damage} danni.`,
      def: saves
        ? `✨ Resisti a ${action.name} (TS ${SAVE_LABEL[ability]} ${tsTotal}${buffTag} ≥ CD ${dc}).`
        : `✨ ${attName} ti colpisce con ${action.name} (TS ${SAVE_LABEL[ability]} ${tsTotal}${buffTag} < CD ${dc}) — ${damage} danni.`,
      attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
    };

    const newTurnExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    let spellAbsorbedLog = null;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const rawPlayers = m.players.map(p => {
        if (p.id === targetId) {
          // Save buff (Assorbire Elementi): scala il counter solo se il buff ha contribuito.
          const decSaveBuff = (p.saveBuffAttacks ?? 0) > 0;
          const newSaveAtk  = decSaveBuff ? Math.max(0, (p.saveBuffAttacks ?? 0) - 1) : (p.saveBuffAttacks ?? 0);
          const newSaveBon  = newSaveAtk > 0 ? p.saveBuffBonus : 0;
          const baseSavePatch = decSaveBuff ? { saveBuffAttacks: newSaveAtk, saveBuffBonus: newSaveBon } : {};
          if (saves) return { ...p, ...consumeInvisibility(p), stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1), ...baseSavePatch };
          if (p.absorbDamageNext && damage > 0) {
            const tgtMaxHp = defenderSnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
            const heal = Math.floor(damage / 2);
            spellAbsorbedLog = `🌀 ${p.name} assorbe il colpo e si cura di ${heal} HP!`;
            return { ...p, hp: Math.min(tgtMaxHp, p.hp + heal), absorbDamageNext: false, ...consumeInvisibility(p), stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1), ...baseSavePatch };
          }
          return { ...p, hp: Math.max(0, p.hp - damage), ...consumeInvisibility(p), stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1), ...baseSavePatch };
        }
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = action.maxUses !== undefined ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) } : uses;
          // Tocco Vampirico: cura il caster.
          const myMaxHp = attackerSnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
          const healedHp = vampHeal > 0 ? Math.min(myMaxHp, (p.hp ?? 0) + vampHeal) : (p.hp ?? 0);
          // Timer turn-based gestiti in turnEndDecaysSpell (sotto), non qui.
          return { ...p, hp: healedHp, defensiveBonus: 0, weaponPoisoned: false, aidBuff: false, bonusActionUsed: false, itemUsedThisTurn: false, bardicInspirationActive: false, ...consumeInvisibility(p), stealthAdvTurns: Math.max(0, readStealthAdvTurns(p) - 1), actionUsesLeft: newUses };
        }
        return { ...p, ...consumeInvisibility(p) };
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
      const alive = players.filter(p => p.hp > 0);
      const absorbLogArr = spellAbsorbedLog ? [spellAbsorbedLog] : [];
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, participantsAwarded: pa, logs: [...m.logs, log, ...extraLogs, ...absorbLogArr, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      // Multi-azione: Monaco x2, Ladro x2, +1 se Passo Spedito attivo.
      const meBefore = m.players.find(p => p.id === currentUser.uid);
      const maxActions = getMaxActionsPerTurn(attackerSnap, meBefore);
      const usedSoFar = meBefore?.multiActionsUsed ?? 0;
      const multiWillStay = (usedSoFar + 1) < maxActions;
      const newMultiUsed = multiWillStay ? usedSoFar + 1 : 0;
      const preservedBonusUsed = !!meBefore?.bonusActionUsed;
      const preservedItemUsed  = !!meBefore?.itemUsedThisTurn;
      const turnEndDecaysSpell = multiWillStay ? {} : {
        attackDisadvantageTurns: Math.max(0, (meBefore?.attackDisadvantageTurns ?? 0) - 1),
        weaponLockTurns: Math.max(0, (meBefore?.weaponLockTurns ?? 0) - 1),
        shieldSkillTurns: Math.max(0, (meBefore?.shieldSkillTurns ?? 0) - 1),
        rageTurns: Math.max(0, (meBefore?.rageTurns ?? 0) - 1),
        hunterMarkTurns: Math.max(0, (meBefore?.hunterMarkTurns ?? 0) - 1),
        concentrationTurns: Math.max(0, (meBefore?.concentrationTurns ?? 0) - 1),
        pattoTurns: Math.max(0, (meBefore?.pattoTurns ?? 0) - 1),
        armorForgeTurns: Math.max(0, (meBefore?.armorForgeTurns ?? 0) - 1),
        selfAdvTurns: Math.max(0, (meBefore?.selfAdvTurns ?? 0) - 1),
        ...tickEagleEnd(meBefore || {}),
      };
      const playersWithMultiState = players.map(p =>
        p.id === currentUser.uid
          ? { ...p,
              multiActionsUsed: newMultiUsed,
              bonusActionUsed:   multiWillStay ? !!preservedBonusUsed   : false,
              itemUsedThisTurn:  multiWillStay ? !!preservedItemUsed    : false,
              extraTurnActive:   multiWillStay ? !!p.extraTurnActive    : false,
              actionSurgeActive: multiWillStay ? !!p.actionSurgeActive  : false,
              ...turnEndDecaysSpell }
          : p
      );
      const nextTurn = multiWillStay ? currentUser.uid : advanceTurn(playersWithMultiState, m);
      return { ...m, players: playersWithMultiState, turn: nextTurn, turnExpiry: newTurnExpiry, participantsAwarded: pa, logs: [...m.logs, log, ...extraLogs, ...absorbLogArr] };
    });

    await awardRoundCoins(updatedMatches);
    await resolveBetsForFinishedMatches(updatedMatches);
    await recordMatchHistory(updatedMatches);
    const finalM = updatedMatches.find(m => m.kind === "final");
    if (finalM && finalM.status === "finished" && finalM.winner) {
      const champSnap = snapshots[finalM.winner] || {};
      await sendChampionNotification(finalM.winner, champSnap.name || "Campione", arenaMeta?.prizes || "", updatedMatches);
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches, tournamentWinner: finalM.winner, phase: "finished" });
      return;
    }
    await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
  };

  // ── CONTROLLO ─────────────────────────────────────────────────────────────
  const handleControlSpell = async (matchId, targetId, action) => {
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const myName = mySnap?.name || "?";
    const ctrlExpiry = new Date(Date.now() + ARENA_TURN_DURATION).toISOString();
    const ctrlDC      = getSpellSaveDC(mySnap);
    const saveAbility = parseSpellSaveAbility(action);
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
            return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses };
          }
          if (p.id === targetId) {
            const isCoronaSpell = action.special === "corona_pazzia";
            return {
              ...p,
              pendingControlSave: isCoronaSpell ? "corona_pazzia" : true,
              pendingControlDC: ctrlDC,
              pendingControlSaveAbility: saveAbility,
              // Non-corona control: arm a 2-turn budget so the target re-rolls each turn until they save or it expires.
              ...(isCoronaSpell ? {} : { controlLostTurns: 2 }),
            };
          }
          return p;
        });
        const nextIndex = (m.players.findIndex(p => p.id === m.turn) + 1) % m.players.length;
        const log = `${myName} lancia ${action.icon} ${action.name} su ${targetName} → TS ${SAVE_LABEL[saveAbility]} (CD ${ctrlDC}) richiesto!`;
        return { ...m, players, turn: m.players[nextIndex].id, turnExpiry: ctrlExpiry, logs: [...m.logs, log] };
      });
      tx.update(ref, { matches });
    });
  };

  // ── TIRI SALVEZZA ──────────────────────────────────────────────────────────
  const rollSavingThrow = async (matchId, saveType, context) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const isControl = context === "control_spell" || context === "corona_pazzia";
    const isSaveDot = context === "save_dot";
    // Per il TS controllo, usa l'abilità memorizzata sul player (es. SAG/COS/FOR) e la CD del caster.
    const myMatch  = arenaMeta.matches?.find(m => m.matchId === matchId);
    const myPlayer = myMatch?.players?.find(p => p.id === currentUser.uid);
    const ctrlAbility = isControl ? (myPlayer?.pendingControlSaveAbility || saveType || "wis") : saveType;
    const ctrlDC      = isControl ? (myPlayer?.pendingControlDC || 13) : null;
    const dotAbility  = isSaveDot ? (myPlayer?.pendingSaveDot?.ability || saveType || "con") : null;
    const dotDC       = isSaveDot ? (myPlayer?.pendingSaveDot?.dc || 13) : null;
    const effectiveAbility = isControl ? ctrlAbility : isSaveDot ? dotAbility : saveType;
    const saveBuffActive = (myPlayer?.saveBuffAttacks ?? 0) > 0;
    const saveBuffBonus  = saveBuffActive ? (myPlayer?.saveBuffBonus ?? 0) : 0;
    const d20 = Math.floor(Math.random() * 20) + 1;
    await showD20Roll(d20, { label: `TS · ${SAVE_LABEL[effectiveAbility] || (effectiveAbility || "").toUpperCase()}` });
    const mod = mySnap?.stats?.[effectiveAbility] ?? 0;
    const dc  = isControl ? ctrlDC : isSaveDot ? dotDC : 15;
    const total = d20 + mod + saveBuffBonus;
    const pass = total >= dc;
    const buffSign = saveBuffBonus > 0 ? `+${saveBuffBonus}🛡` : "";
    const myName = mySnap?.name || "?";
    const modSign = mod >= 0 ? "+" : "";
    let logMsg = isControl
      ? `🌀 ${myName} — TS ${SAVE_LABEL[ctrlAbility] || ctrlAbility.toUpperCase()} (Controllo): ${d20}${modSign}${mod}${buffSign}=${total} (CD ${dc}) → ${pass ? "✅ PASSA" : "❌ FALLISCE"}`
      : isSaveDot
      ? `🤢 ${myName} — TS ${SAVE_LABEL[dotAbility] || dotAbility.toUpperCase()} (${myPlayer?.pendingSaveDot?.name || "Veleno"}): ${d20}${modSign}${mod}${buffSign}=${total} (CD ${dc}) → ${pass ? "✅ PASSA" : "❌ FALLISCE"}`
      : `🎲 ${myName} — TS ${SAVE_LABEL[saveType] || saveType.toUpperCase()}: ${d20}${modSign}${mod}${buffSign}=${total} (CD ${dc}) → ${pass ? "✅ PASSA" : "❌ FALLISCE"}`;

    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      let extraTurn = {};

      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const up = { ...p };
        // Save-buff scala il counter (se ha contribuito a questo TS).
        if (saveBuffActive) {
          const newAtk = Math.max(0, (p.saveBuffAttacks ?? 0) - 1);
          up.saveBuffAttacks = newAtk;
          if (newAtk === 0) up.saveBuffBonus = 0;
        }
        if (context === "save_dot") {
          const dot = p.pendingSaveDot;
          delete up.pendingSaveDot;
          if (!pass && dot) {
            up.poisonDoT = true;
            up.poisonDoTTurns = dot.turns ?? 3;
            up.poisonDoTDice  = dot.dice  ?? "2d6";
            logMsg += ` — Avvelenato! Subirà ${up.poisonDoTDice} a inizio turno per ${up.poisonDoTTurns} turni.`;
          } else {
            logMsg += " — Resiste al veleno!";
          }
        }
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
          if (pass) {
            // Free: clear all control state and let the player act this turn.
            delete up.pendingControlSave;
            delete up.pendingControlDC;
            delete up.pendingControlSaveAbility;
            up.controlLostTurns = 0;
            logMsg += " — Passa! Si libera dal controllo e può agire normalmente.";
          } else if (isCorona) {
            // Corona della Pazzia: one-shot self-damage, no recurring TS.
            const mySnap2 = (arenaMeta.characterSnapshots || {})[currentUser.uid];
            const equippedName = p.equippedWeaponNames?.[0];
            const weapon = (mySnap2?.selectedActions || []).find(a => a.name === equippedName && a.type === "weapon");
            const dmgFormula = weapon?.damage || "1d6";
            const { total: selfDmg, rolls: selfRolls } = rollDmg(dmgFormula);
            up.hp = Math.max(0, (up.hp ?? 0) - selfDmg);
            delete up.pendingControlSave;
            delete up.pendingControlDC;
            delete up.pendingControlSaveAbility;
            logMsg += ` — Fallisce! Attacca sé stesso con ${weapon?.icon || "⚔"} ${equippedName || "arma"}: ${selfDmg} danni [🎲${selfRolls}]!`;
            const currentIndex = m.players.findIndex(pl => pl.id === currentUser.uid);
            let nextIndex = (currentIndex + 1) % m.players.length;
            while (m.players[nextIndex]?.hp <= 0) nextIndex = (nextIndex + 1) % m.players.length;
            extraTurn = { turn: m.players[nextIndex].id, turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString() };
          } else {
            // Regular control spell: burn one turn of the control budget, auto-skip, re-roll TS next turn until pass or budget exhausted.
            const remaining = Math.max(0, (p.controlLostTurns ?? 2) - 1);
            up.controlLostTurns = remaining;
            if (remaining > 0) {
              // Keep TS armed for next turn.
              logMsg += ` — Fallisce! Turno saltato — ${remaining} turno/i di controllo rimasti (TS al prossimo turno).`;
            } else {
              delete up.pendingControlSave;
              delete up.pendingControlDC;
              delete up.pendingControlSaveAbility;
              logMsg += " — Fallisce! Turno saltato — l'effetto si esaurisce.";
            }
            const currentIndex = m.players.findIndex(pl => pl.id === currentUser.uid);
            let nextIndex = (currentIndex + 1) % m.players.length;
            while (m.players[nextIndex]?.hp <= 0) nextIndex = (nextIndex + 1) % m.players.length;
            extraTurn = { turn: m.players[nextIndex].id, turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString() };
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

  // ── ITEMS — azione gratuita: non consuma azione né bonus action, ma 1 sola per turno ──
  const useItem = async (matchId, itemKey, targetId) => {
    const myName  = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const item    = ARENA_ITEMS.find(i => i.key === itemKey);
    if (!item) return;
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.itemUsedThisTurn) { alert("⚠ Hai già usato un oggetto questo turno."); return; }

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
            log = { pub: `🧪 ${myName} usa Pozione di Cura [🎲${healRolls}=${heal}] — recupera ${heal} HP (${newHp} HP) · azione gratuita`, ts: _itemTs };
            return { ...p, hp: newHp, itemUsesLeft: newUses, itemUsedThisTurn: true };
          }
          if (itemKey === "pozione_veleno") {
            return { ...p, itemUsesLeft: newUses, itemUsedThisTurn: true };
          }
          return { ...p, itemUsesLeft: newUses, itemUsedThisTurn: true };
        }
        if (itemKey === "bomba" && p.id === targetId) {
          const { total: dmg, rolls: bombRolls } = rollDmg("2d6");
          log = { pub: `💣 ${myName} lancia una Bomba su ${p.name} [🎲${bombRolls}=${dmg}] — ${dmg} danni! · azione gratuita`, ts: _itemTs };
          return { ...p, hp: Math.max(0, p.hp - dmg) };
        }
        if (itemKey === "pozione_veleno" && p.id === targetId) {
          log = { pub: `☠ ${myName} lancia Pozione di Veleno su ${p.name} — subirà 1d6 veleno al prossimo turno! · azione gratuita`, ts: _itemTs };
          return { ...p, poisonDoT: true };
        }
        return p;
      });

      const alive = updatedPlayers.filter(p => p.hp > 0);
      if (alive.length === 1) {
        return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
          logs: [...m.logs, ...(log ? [log] : []), `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      }
      // Azione gratuita: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, ...(log ? [log] : [])] };
    });

    // Check tournament end
    await awardRoundCoins(updatedMatches);
    await resolveBetsForFinishedMatches(updatedMatches);
    await recordMatchHistory(updatedMatches);
    const finalM = updatedMatches.find(m => m.kind === "final");
    if (finalM && finalM.status === "finished" && finalM.winner) {
      const champSnap = (arenaMeta.characterSnapshots || {})[finalM.winner] || {};
      await sendChampionNotification(finalM.winner, champSnap.name || "Campione", arenaMeta?.prizes || "", updatedMatches);
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches, tournamentWinner: finalM.winner, phase: "finished" });
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
    if (!expiredInitMatch && !expiredActiveMatch) return;

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
            const hasAdv = isRogueClass((snapshots[p.id]?.class || "").toLowerCase());
            const d20a = Math.floor(Math.random() * 20) + 1;
            const d20b = hasAdv ? Math.floor(Math.random() * 20) + 1 : 0;
            const d20 = hasAdv ? Math.max(d20a, d20b) : d20a;
            const roll = d20 + dex;
            const advTag = hasAdv ? ` 🌟vant.[${d20a},${d20b}]` : "";
            newLogs.push(`🎲 ${snapshots[p.id]?.name || p.name} tira iniziativa (automatico): ${roll}${advTag}`);
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
          // Sotto controllo: il timer scade → decrementa il contatore invece di applicare la posizione difensiva.
          const wasControlled = (p.controlLostTurns ?? 0) > 0;
          let up = wasControlled
            ? { ...p, controlLostTurns: Math.max(0, (p.controlLostTurns ?? 0) - 1), actionSurgeActive: false, bardicInspirationActive: false, extraTurnActive: false, ...tickEagleEnd(p), ...consumeInvisibility(p), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), attackDisadvantageTurns: Math.max(0, (p.attackDisadvantageTurns ?? 0) - 1), weaponLockTurns: Math.max(0, (p.weaponLockTurns ?? 0) - 1), multiActionsUsed: 0, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false }
            : { ...p, defensiveBonus: 0, actionSurgeActive: false, bardicInspirationActive: false, extraTurnActive: false, ...tickEagleEnd(p), ...consumeInvisibility(p), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), attackDisadvantageTurns: Math.max(0, (p.attackDisadvantageTurns ?? 0) - 1), weaponLockTurns: Math.max(0, (p.weaponLockTurns ?? 0) - 1), multiActionsUsed: 0, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false };
          if (wasControlled && !hasPendingCtrl) newLogs2.push(`🌀 ${p.name} è sotto controllo: turno saltato (${up.controlLostTurns} rimanenti).`);
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
          if (hasPoisonDoT && (p.poisonResolvedTurnToken || "") !== (match.turnExpiry || "")) {
            const dice = p.poisonDoTDice || "1d6";
            const { total: poisonDmgAuto } = rollDmg(dice);
            up.hp = Math.max(0, (up.hp ?? 0) - poisonDmgAuto);
            const remaining = Math.max(0, (p.poisonDoTTurns ?? 1) - 1);
            up.poisonDoT = remaining > 0;
            up.poisonDoTTurns = remaining;
            up.poisonResolvedTurnToken = match.turnExpiry || "";
            if (remaining === 0) up.poisonDoTDice = null;
            newLogs2.push(`☠ ${p.name} subisce il veleno automaticamente: ${poisonDmgAuto} danni [${dice}]!`);
            autoRolledSave = true;
          }
          if (p.bleedDoT && (p.bleedResolvedTurnToken || "") !== (match.turnExpiry || "")) {
            const dice = p.bleedDoTDice || "1d6";
            const { total: bleedDmgAuto } = rollDmg(dice);
            up.hp = Math.max(0, (up.hp ?? 0) - bleedDmgAuto);
            const remaining = Math.max(0, (p.bleedDoTTurns ?? 1) - 1);
            up.bleedDoT = remaining > 0;
            up.bleedDoTTurns = remaining;
            up.bleedResolvedTurnToken = match.turnExpiry || "";
            if (remaining === 0) up.bleedDoTDice = null;
            newLogs2.push(`🩸 ${p.name} subisce il sanguinamento automaticamente: ${bleedDmgAuto} danni [${dice}]!`);
            autoRolledSave = true;
          }
          if (hasPendingCtrl) {
            const d20 = Math.floor(Math.random() * 20) + 1;
            const ctrlAbility = p.pendingControlSaveAbility || "wis";
            const ctrlMod = data.characterSnapshots?.[p.id]?.stats?.[ctrlAbility] ?? 0;
            const ctrlDC  = p.pendingControlDC || 13;
            const total   = d20 + ctrlMod;
            const pass    = total >= ctrlDC;
            const sign    = ctrlMod >= 0 ? "+" : "";
            const lbl     = SAVE_LABEL[ctrlAbility] || ctrlAbility.toUpperCase();
            const isCorona = p.pendingControlSave === "corona_pazzia";
            if (pass) {
              // Free on auto-roll: clear all control state.
              delete up.pendingControlSave;
              delete up.pendingControlDC;
              delete up.pendingControlSaveAbility;
              up.controlLostTurns = 0;
              newLogs2.push(`🌀 ${p.name} TS ${lbl} Controllo automatico: ${d20}${sign}${ctrlMod}=${total} vs CD ${ctrlDC} → ✅ PASSA — Si libera!`);
            } else if (isCorona) {
              // Corona: one-shot self-damage, no recurring TS.
              const snapForAuto = data?.characterSnapshots?.[p.id];
              const equippedNameAuto = p.equippedWeaponNames?.[0];
              const weaponAuto = (snapForAuto?.selectedActions || []).find(a => a.name === equippedNameAuto && a.type === "weapon");
              const { total: selfDmgAuto } = rollDmg(weaponAuto?.damage || "1d6");
              up.hp = Math.max(0, (up.hp ?? 0) - selfDmgAuto);
              delete up.pendingControlSave;
              delete up.pendingControlDC;
              delete up.pendingControlSaveAbility;
              newLogs2.push(`🌀 ${p.name} TS ${lbl} Corona della Pazzia automatico: ${d20}${sign}${ctrlMod}=${total} vs CD ${ctrlDC} → ❌ FALLISCE — Attacca sé stesso: ${selfDmgAuto} danni!`);
            } else {
              // Regular control fail on auto-roll: burn one budget turn, keep TS armed if budget remains.
              const remaining = Math.max(0, (p.controlLostTurns ?? 2) - 1);
              up.controlLostTurns = remaining;
              if (remaining > 0) {
                newLogs2.push(`🌀 ${p.name} TS ${lbl} Controllo automatico: ${d20}${sign}${ctrlMod}=${total} vs CD ${ctrlDC} → ❌ FALLISCE — Turno saltato (${remaining} rimanenti, nuovo TS al prossimo turno).`);
              } else {
                delete up.pendingControlSave;
                delete up.pendingControlDC;
                delete up.pendingControlSaveAbility;
                newLogs2.push(`🌀 ${p.name} TS ${lbl} Controllo automatico: ${d20}${sign}${ctrlMod}=${total} vs CD ${ctrlDC} → ❌ FALLISCE — Turno saltato, effetto esaurito.`);
              }
            }
            autoRolledSave = true;
          }
          return up;
        });
        // ── AUTO-ATTACCO su timeout ──────────────────────────────────────
        // Se il giocatore non ha agito (e non era sotto controllo o impegnato
        // a tirare salvataggi automatici), invece di stare fermo prova a
        // colpire UNA VOLTA il primo avversario vivo con l'arma equipaggiata.
        // Un colpo solo anche per i multi-attaccanti; nessuna feature di
        // classe (smite, furia, ispirazione…) per tenerlo prevedibile.
        const updatedCurrentP = updatedPlayers.find(p => p.id === currentTurnId);
        const wasControlled = (currentPlayerObj.controlLostTurns ?? 0) > 0;
        const isWildShaped  = !!currentPlayerObj.wildShape;
        let didAutoAttack = false;

        if (!autoRolledSave && !wasControlled && !isWildShaped) {
          const attackerSnap   = data.characterSnapshots?.[currentTurnId] || {};
          const equippedNames  = updatedCurrentP?.equippedWeaponNames || currentPlayerObj.equippedWeaponNames || [];
          const allWeapons     = (attackerSnap.selectedActions || []).filter(a => a.type === "weapon");
          const weapon         = allWeapons.find(a => equippedNames.includes(a.name)) || allWeapons[0];
          const aliveOpponents = alivePlayers.filter(p => p.id !== currentTurnId);
          const target         = aliveOpponents[0];

          if (weapon && target) {
            const targetSnap         = data.characterSnapshots?.[target.id] || {};
            const targetMatchPlayer  = updatedPlayers.find(p => p.id === target.id) || target;
            const attName            = attackerSnap.name || currentPlayerObj.name || "?";
            const defName            = targetSnap.name   || target.name           || "?";

            const statKey      = weapon.statKey || "str";
            const statMod      = attackerSnap.stats?.[statKey] ?? 0;
            const armorPenalty = attackerSnap?.selectedArmor?.hitPenalty ?? 0;

            const shieldLost       = targetSnap?.hasShield && targetMatchPlayer?.shieldSuppressed;
            const shieldSkillBonus = (targetMatchPlayer?.shieldSkillTurns ?? 0) > 0 ? (targetMatchPlayer?.shieldSkillBonus ?? 3) : 0;
            const armorForgeBonus  = (targetMatchPlayer?.armorForgeTurns ?? 0) > 0 ? 2 : 0;
            const defensiveAcBonus = targetMatchPlayer?.defensiveBonus ?? 0;
            const defAC = getEffectiveAc(targetMatchPlayer, targetSnap) - (shieldLost ? 2 : 0) + shieldSkillBonus + armorForgeBonus + defensiveAcBonus;

            const d20      = Math.floor(Math.random() * 20) + 1;
            const isCrit   = d20 === 20;
            const hitTotal = d20 + (weapon.hitBonus || 0) + statMod + armorPenalty;
            const isHit    = hitTotal >= defAC || isCrit;

            let damageDealt = 0;
            let diceInfo    = "";
            if (isHit) {
              const { total: baseDmg, rolls: diceRolls } = rollDmg(weapon.damage);
              const critMult = isCrit ? 2 : 1;
              const rawDmg   = (baseDmg + statMod) * critMult;
              damageDealt    = applyBarbarianRageReduction(rawDmg, targetSnap, targetMatchPlayer, false);
              const sign     = statMod >= 0 ? "+" : "";
              diceInfo       = ` 🎲${diceRolls}${statMod !== 0 ? `${sign}${statMod}` : ""}${isCrit ? "×2" : ""} = ${damageDealt}`;
            }

            const critTag  = isCrit ? " ★CRITICO★" : "";
            const hitBd    = `d20(${d20})+${weapon.hitBonus ?? 0}${statMod !== 0 ? (statMod >= 0 ? `+${statMod}` : `${statMod}`) : ""}${armorPenalty !== 0 ? ` ${armorPenalty}arm.` : ""} = ${hitTotal} vs CA ${defAC}`;
            newLogs2.push(
              isHit
                ? `⏰ ${attName} non ha agito — attacco automatico con ${weapon.name}: COLPISCE ${defName}${critTag} [${hitBd}]${diceInfo ? ` →${diceInfo} danni` : ""}`
                : `⏰ ${attName} non ha agito — attacco automatico con ${weapon.name}: MANCA ${defName} [${hitBd}]`
            );

            if (isHit && damageDealt > 0) {
              for (let i = 0; i < updatedPlayers.length; i++) {
                if (updatedPlayers[i].id === target.id) {
                  updatedPlayers[i] = { ...updatedPlayers[i], hp: Math.max(0, (updatedPlayers[i].hp ?? 0) - damageDealt) };
                  break;
                }
              }
            }
            didAutoAttack = true;
          }
        }

        if (!autoRolledSave && !didAutoAttack) {
          newLogs2.push(`🛡 ${currentPlayerObj.name} non ha agito — Posizione Difensiva`);
        }

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
    if (!arenaMeta) return;
    // Attiva auto-pass se torneo in corso O se ci sono sfide libere in corso.
    const hasFunInProgress = (arenaMeta.matches || []).some(m =>
      m.kind === "fun" && (m.status === "initiative" || m.status === "active")
    );
    if (arenaMeta.phase !== "combat" && !hasFunInProgress) return;
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
      if ((hasExpiredInit || hasExpiredActive) && now - lastAutoPassFireRef.current > 10000) {
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
      nightAutoPaused: false,
    });
  };

  const resumeArenaTimers = async () => {
    if (!arenaMeta?.pausedAt) return;
    const elapsed = Date.now() - new Date(arenaMeta.pausedAt).getTime();
    const updatedMatches = (arenaMeta.matches || []).map(m => {
      if (m.status === "finished") return m;
      // Le sfide libere (training) non sono mai congelate → non shiftiamo i loro timer.
      if (m.kind === "fun") return m;
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
      nightAutoPaused: false,
      matches: updatedMatches,
    });
  };

  // Pausa/ripresa timer torneo: gestione manuale via pulsante Master (no auto-night).

  // ── RENDER ─────────────────────────────────────────────────────────────────
  if (!arenaMeta) return <div className="arena-loading">Ingresso nell'Arena...</div>;

  const snapshots        = arenaMeta.characterSnapshots || {};
  const timerRef         = arenaMeta.timerPaused && arenaMeta.pausedAt
    ? new Date(arenaMeta.pausedAt).getTime()
    : Date.now();
  const isRegistered     = arenaMeta.participants?.includes(currentUser?.uid);
  const isPending        = arenaMeta.waitingList?.includes(currentUser?.uid);
  const tournamentMatches = (arenaMeta.matches || []).filter(m => m.kind !== "fun");
  const funMatches        = (arenaMeta.matches || []).filter(m => m.kind === "fun");
  const allMatchesDone   = tournamentMatches.length > 0 && tournamentMatches.every(m => m.status === "finished");
  const finalMatch       = tournamentMatches.find(m => m.kind === "final");
  const finalFinished    = !!(finalMatch && finalMatch.status === "finished" && finalMatch.winner);
  const totalGroupRounds = groupRoundsTotal();
  const cr               = arenaMeta.currentRound || 1;
  const moreGroupRoundsToPlay = cr < totalGroupRounds;
  const canAdvanceRound  = isMaster && arenaMeta.phase === "combat" && allMatchesDone && !finalMatch && (arenaMeta.groupA?.length || 0) >= 1 && (arenaMeta.groupB?.length || 0) >= 1;
  const advanceLabel     = moreGroupRoundsToPlay ? `⚔ Round ${cr + 1}` : "🏆 Genera Finale";
  const canDeclareChampion = isMaster && arenaMeta.phase === "combat" && finalFinished && !arenaMeta.tournamentWinner;

  const declareTournamentChampion = async () => {
    if (!canDeclareChampion) return;
    const championId = finalMatch.winner;
    const champSnap = snapshots[championId] || {};
    try {
      await sendChampionNotification(championId, champSnap.name || "Campione", arenaMeta?.prizes || "");
      await updateDoc(doc(db, "arena_meta", "global"), {
        tournamentWinner: championId, phase: "finished",
      });
    } catch (e) {
      console.error("declareTournamentChampion error:", e);
    }
  };

  const masterForceWinner = async (matchId, winnerId) => {
    if (!isMaster) return;
    const match = arenaMeta.matches?.find(m => m.matchId === matchId);
    if (!match || match.status === "finished") return;
    const winnerP = match.players.find(p => p.id === winnerId);
    if (!winnerP) return;
    const winnerName = winnerP.name || snapshots[winnerId]?.name || "?";
    if (!window.confirm(`Dichiarare ${winnerName} vincitore di questo match?`)) return;

    const updatedMatch = {
      ...match,
      status: "finished",
      winner: winnerId,
      logs: [...(match.logs || []), `♛ Master: ${winnerName.toUpperCase()} dichiarato vincitore!`],
    };
    const updatedMatches = (arenaMeta.matches || []).map(m => m.matchId === matchId ? updatedMatch : m);

    try {
      await awardRoundCoins(updatedMatches);
      await resolveBetsForFinishedMatches(updatedMatches);
      await recordMatchHistory(updatedMatches);

      const finalM = updatedMatches.find(m => m.kind === "final");
      if (finalM && finalM.status === "finished" && finalM.winner) {
        const champSnap = snapshots[finalM.winner] || {};
        await sendChampionNotification(finalM.winner, champSnap.name || "Campione", arenaMeta?.prizes || "", updatedMatches);
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: updatedMatches, tournamentWinner: finalM.winner, phase: "finished",
        });
        // 🐣 pet system: tournament champion bonus
        awardPetPoints(finalM.winner, "arena_tournament", { resourceKey: finalM.matchId });
        return;
      }
      await updateDoc(doc(db, "arena_meta", "global"), { matches: updatedMatches });
    } catch (e) {
      console.error("masterForceWinner error:", e);
    }
  };

  const liveTournament = (() => {
    if (!arenaMeta || arenaMeta.phase === "finished") return null;
    const ids = arenaMeta.participants || [];
    const matches = (arenaMeta.matches || []).filter(m => m.kind !== "fun");
    const wins = {}, losses = {};
    matches.forEach(m => {
      if (m.status !== "finished" || !m.winner) return;
      (m.players || []).forEach(p => {
        if (p.id === m.winner) wins[p.id] = (wins[p.id] || 0) + 1;
        else losses[p.id] = (losses[p.id] || 0) + 1;
      });
    });
    const participants = ids
      .map(uid => ({
        uid,
        name:  snapshots[uid]?.name  || "",
        class: (snapshots[uid]?.class || "").toLowerCase().trim(),
        matchWins:   wins[uid]   || 0,
        matchLosses: losses[uid] || 0,
      }))
      .filter(p => p.class);
    if (participants.length === 0) return null;
    return { winnerId: null, participants, phase: arenaMeta.phase };
  })();

  return (
    <div className={`arena-page${myActiveMatchId ? " arena-page--focus" : ""}`}>

      {/* ── Floating Fight Button — sempre visibile durante un match attivo.
            Più epico quando è il tuo turno (pulsa rosso). ── */}
      {myActiveMatchId && (() => {
        const m = arenaMeta?.matches?.find(mm => mm.matchId === myActiveMatchId);
        if (!m) return null;
        const opp = m.players?.find(p => p.id !== currentUser.uid);
        const oppFirst = (opp?.name || "").split(" ")[0] || "avversario";
        const subLabel = isMyTurnInActive
          ? "Tocca per agire"
          : m.status === "initiative"
            ? "Tira iniziativa"
            : `Turno di ${oppFirst}`;
        return (
          <button
            type="button"
            className={`arena-fight-icon${isMyTurnInActive ? " arena-fight-icon--your-turn" : ""}`}
            onClick={() => setCombatModalOpen(true)}
            aria-label={isMyTurnInActive ? "È il tuo turno — apri il combat" : "Sfida in corso — apri il combat"}
            title={isMyTurnInActive ? `È il tuo turno · ${subLabel}` : `Sfida in corso · ${subLabel}`}
          >
            ⚔
          </button>
        );
      })()}

      {/* ── HERO SECTION (full-vh, parallax, immagine epica) ── */}
      <section id="arena-hero-top" className="arena-hero" aria-label="Arena dei Campioni">
        <div className="arena-hero-media" aria-hidden="true">
          <img
            src="/assets/PhotoStory/GruppoMEAA/partyfun.jpg"
            alt=""
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <div className="arena-hero-vignette" />
          <div className="arena-hero-gradient" />
          <div className="arena-hero-pattern" />
        </div>
        <div className="arena-hero-content">
          <span className="arena-hero-eyebrow">Cronache di Exanthia</span>
          <h1 className="arena-hero-title">Arena dei Campioni</h1>
          <p className="arena-hero-tagline">
            Dodici classi, una sola corona. Solo i più forti scriveranno il loro nome nelle leggende.
          </p>
          <div className="arena-hero-meta">
            {arenaMeta.phase === "registration" && (
              <span className="arena-hero-pill open">● Iscrizioni Aperte</span>
            )}
            {arenaMeta.phase === "combat" && (
              <span className="arena-hero-pill combat">
                ● {finalMatch ? "Finale" : `Round ${arenaMeta.currentRound || 1}`}
              </span>
            )}
            {arenaMeta.phase === "finished" && (
              <span className="arena-hero-pill finished">● Torneo Concluso</span>
            )}
            {arenaMeta.timerPaused && (
              <span className="arena-hero-pill paused">⏸ Timer in Pausa</span>
            )}
          </div>
        </div>
        <div className="arena-hero-scroll-hint" aria-hidden="true">
          <span>Scroll</span>
          <span className="arena-hero-arrow">↓</span>
        </div>
      </section>

      {/* ── SIDE NAV: icone piccole laterali per saltare alle sezioni
            (sostituisce la vecchia sticky mini-nav: c'è già il side-nav
            verticale a sinistra su desktop e in basso su mobile) ── */}
      <nav className="arena-side-nav" aria-label="Navigazione rapida sezioni">
        <a href="#arena-hero-top" className="arena-side-nav-btn" title="Inizio" aria-label="Vai all'inizio">
          <span aria-hidden="true">🏰</span>
        </a>
        <a href="#arena-info-anchor" className="arena-side-nav-btn" title="Regole, classi, glorie" aria-label="Regole">
          <span aria-hidden="true">📜</span>
        </a>
        {isMaster && (
          <a href="#arena-master-panel" className="arena-side-nav-btn" title="Pannello del Master" aria-label="Master">
            <span aria-hidden="true">♛</span>
          </a>
        )}
        <a href="#arena-training" className="arena-side-nav-btn" title="Arena Libera (sfide allenamento)" aria-label="Arena Libera">
          <span aria-hidden="true">⚔</span>
        </a>
        <a href="#arena-bracket-anchor" className="arena-side-nav-btn" title="Tabellone del Torneo" aria-label="Bracket">
          <span aria-hidden="true">🏆</span>
        </a>
      </nav>

      {/* ── RICOMPENSA PROSSIMA ARENA (visibile a tutti) ── */}
      {(isMaster || (arenaMeta.prizes && arenaMeta.prizes.trim())) && (
        <div className="arena-reward-panel">
          <div className="arena-reward-deco" aria-hidden="true">🏆</div>
          <div className="arena-reward-body">
            <div className="arena-reward-label">Ricompensa della prossima Arena</div>
            {isMaster ? (
              <div className="arena-reward-editor">
                <textarea
                  className="arena-reward-textarea"
                  rows={2}
                  placeholder="Descrivi la ricompensa che vedranno tutti i giocatori…"
                  value={prizeText}
                  onChange={e => setPrizeText(e.target.value)}
                />
                <button className="arena-reward-save" onClick={savePrizes}>💾 Salva</button>
                {arenaMeta.prizes && arenaMeta.prizes.trim() && (
                  <p className="arena-reward-current">In palio ora: <strong>{arenaMeta.prizes}</strong></p>
                )}
              </div>
            ) : (
              <div className="arena-reward-text">{arenaMeta.prizes}</div>
            )}
          </div>
          <div className="arena-reward-deco" aria-hidden="true">🏆</div>
        </div>
      )}

      {arenaMeta.championsOnly && arenaMeta.phase !== "finished" && (
        <div className="champions-arena-banner">
          <div className="champions-arena-deco-left">⚜</div>
          <div className="champions-arena-content">
            <div className="champions-arena-crown">♛</div>
            <div className="champions-arena-title">Arena dei Campioni</div>
            <div className="champions-arena-subtitle">
              Solo chi ha già conquistato la corona può scendere in campo
            </div>
            {champions.length > 0 && (
              <div className="champions-arena-roll">
                {champions.slice(0, 8).map(c => (
                  <span key={c.uid} className="champions-arena-chip" title={`${c.name || "Campione"} — ${c.wins} ${c.wins === 1 ? "vittoria" : "vittorie"}`}>
                    {c.image
                      ? <img src={c.image} alt="" />
                      : <span className="champions-arena-chip-icon">{CLASS_ICONS[c.class] || "♛"}</span>}
                    <span className="champions-arena-chip-name">{(c.name || "Campione").split(" ")[0]}</span>
                    <span className="champions-arena-chip-wins">×{c.wins}</span>
                  </span>
                ))}
                {champions.length > 8 && <span className="champions-arena-more">+{champions.length - 8}</span>}
              </div>
            )}
          </div>
          <div className="champions-arena-deco-right">⚜</div>
        </div>
      )}

      {/* FASE */}
      <div className="arena-phase-banner">
        {arenaMeta.phase === "registration" ? (
          <span className="phase-tag open">Iscrizioni Aperte</span>
        ) : arenaMeta.phase === "finished" ? (
          <span className="phase-tag finished">Torneo Concluso</span>
        ) : (
          <span className="phase-tag combat">
            {finalMatch ? "Campionato — Finale" : `Campionato — Round ${arenaMeta.currentRound}`}
          </span>
        )}
        {arenaMeta.timerPaused && (
          <span className="phase-tag paused">⏸ Timer in Pausa</span>
        )}
      </div>

      {/* ── QUICK NAV (sticky) ── */}
      {currentUser && (() => {
        const hasMyActive = (arenaMeta.matches || []).some(m =>
          ((m.kind === "fun") || arenaMeta.phase === "combat") &&
          m.players?.some(p => p.id === currentUser?.uid) &&
          m.status !== "open"
        );
        const hasBracket = (arenaMeta.phase === "combat" || arenaMeta.phase === "finished") && tournamentMatches.length > 0;
        const goTo = (id) => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        };
        return (
          <nav className="arena-quicknav" aria-label="Navigazione rapida Arena">
            <span className="arena-quicknav-deco" aria-hidden="true">⚜</span>
            {hasMyActive && (
              <button
                type="button"
                className={`arena-quicknav-chip arena-quicknav-chip--active${isMyTurnInActive ? " arena-quicknav-chip--your-turn" : ""}`}
                onClick={() => goTo("arena-my-match")}
              >
                <span className="arena-quicknav-chip-icon">{isMyTurnInActive ? "⚔" : "🛡"}</span>
                <span className="arena-quicknav-chip-label">
                  {isMyTurnInActive ? "È il tuo turno" : "La Tua Sfida"}
                </span>
                <span className="arena-quicknav-chip-pulse" aria-hidden="true" />
              </button>
            )}
            <button type="button" className="arena-quicknav-chip" onClick={() => goTo("arena-training")}>
              <span className="arena-quicknav-chip-icon">⚔</span>
              <span className="arena-quicknav-chip-label">Arena Libera</span>
            </button>
            {hasBracket && (
              <button type="button" className="arena-quicknav-chip" onClick={() => goTo("arena-bracket")}>
                <span className="arena-quicknav-chip-icon">♛</span>
                <span className="arena-quicknav-chip-label">Tabellone</span>
              </button>
            )}
            <span className="arena-quicknav-deco" aria-hidden="true">⚜</span>
          </nav>
        );
      })()}

      {/* ── SCROLLYTELLING: Lex Arenae (immagine sticky + frames che si rivelano) ── */}
      <section className="arena-scrollytell" aria-label="Lex Arenae">
        <div className="arena-scrollytell-media" aria-hidden="true">
          <img
            src="/assets/PhotoStory/GruppoLAC/woods_war.jpg"
            alt=""
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <div className="arena-scrollytell-bottom-fade" aria-hidden="true" />
        </div>
        <div className="arena-scrollytell-content">
          <div className="arena-scrollytell-frame">
            <span className="arena-scrollytell-eyebrow">Lex Arenae</span>
            <h2 className="arena-scrollytell-title">Regole, Classi &amp; Glorie</h2>
            <p className="arena-scrollytell-text">
              Dodici classi, una sola corona. 10 minuti per l'iniziativa, 1 ora per agire.
              +5 MA per match, +7 per round, +30 per la corona. Scendi in campo da campione.
            </p>
          </div>
        </div>
      </section>

      {/* ── SEZIONE SPIEGAZIONE ── */}
      <div id="arena-info-anchor" className="arena-info-section">
        <button className="arena-info-toggle" onClick={() => setArenaInfoOpen(v => !v)}>
          {arenaInfoOpen ? "▲" : "▼"} Come funziona l'Arena
        </button>
        {arenaInfoOpen && (
          <div className="arena-info-body">

            <h3 className="arena-info-title">⚔ Come funziona l'Arena</h3>
            <ul className="arena-info-list">
              <li>Il Master apre le iscrizioni e approva i partecipanti uno per uno.</li>
              <li>Ogni combattente <strong>crea un personaggio da zero</strong> solo per l'Arena: sceglie classe, distribuisce i punti caratteristica, sceglie armi, armatura, oggetti e tira i propri HP.</li>
              <li>I match si giocano in modalità asincrona a turni. Il vincitore di ogni match avanza al round successivo fino al campione finale.</li>
              <li>Oltre al torneo è sempre attiva la <strong>Sfida Libera</strong>: 1v1 amichevoli senza ricompense, utili per allenarti.</li>
            </ul>

            <h3 className="arena-info-title">⏱ Timer e turni</h3>
            <div className="arena-info-example">
              <p><strong>Iniziativa:</strong> ogni giocatore ha <strong>10 minuti</strong> per tirare la propria iniziativa (d20 + DES; il Ladro tira con vantaggio). Allo scadere il sistema tira automaticamente al posto tuo.</p>
              <p><strong>Turno di azione:</strong> ogni giocatore ha <strong>1 ora</strong> per agire nel proprio turno. Se non agisci, parte un <strong>attacco automatico</strong> con l'arma equipaggiata sul primo bersaglio vivo (oppure posizione difensiva se non hai armi).</p>
              <p><strong>Pausa:</strong> solo il Master può sospendere i timer con il pulsante "⏸ Pausa Timer". Alla ripresa i turn-expiry vengono shiftati in avanti del tempo trascorso, così nessuno viene penalizzato.</p>
            </div>

            <h3 className="arena-info-title">🧙 Creazione del Personaggio</h3>
            <div className="arena-info-example">
              <p><strong>1. Classe:</strong> scegli tra le 12 classi (vedi elenco sotto). Ogni classe ha le proprie armi consentite, abilità di classe automatiche, eventuali slot magia e armatura permessa.</p>
              <p><strong>2. Caratteristiche:</strong> distribuisci i punti stat (FOR, DES, COS, INT, SAG, CAR). I modificatori si applicano a tiri per colpire, danni, salvezze e CA delle armature leggere/medie.</p>
              <p><strong>3. Equipaggiamento:</strong> scegli armi, armatura, scudo (se la classe lo permette) e oggetti consumabili. Le restrizioni dipendono dalla classe.</p>
              <p><strong>4. HP:</strong> tutte le classi tirano <strong>7d10 + COS×7</strong>. Ogni livello di classe acquistato alla Bottega aggiunge +1d10 al tiro. Hai un numero limitato di reroll.</p>
              <p><strong>Nota:</strong> il personaggio Arena è separato dalla tua scheda principale e non influenza la campagna.</p>
            </div>

            <h3 className="arena-info-title">🎲 Come si combatte</h3>
            <div className="arena-info-example">
              <p><strong>Attacco con arma:</strong> d20 + bonus arma + FOR (mischia) o DES (distanza/finezza) vs CA. Se colpisce: danno dell'arma + modificatore. <em>Critico</em> su 20: danno ×2.</p>
              <p><strong>Attacco con incantesimo:</strong> d20 + bonus incantesimo + INT/SAG/CAR (a seconda della classe) vs CA, oppure il bersaglio tira un Tiro Salvezza. Alcune spell infliggono effetti continuati (veleno, sanguinamento, controllo).</p>
              <p><strong>Azione bonus:</strong> molte abilità di classe (Furia, Marchio, Lay of Hands, Cura Ki, Ispirazione Bardica…) sono <strong>bonus action</strong> — puoi farle nello stesso turno di un attacco.</p>
              <p><strong>Armature:</strong> le pesanti hanno CA fissa alta ma penalità ai tiri. Le leggere/medie sommano DES (cap variabile) alla CA base. Lo scudo, se ammesso, dà +2 CA.</p>
              <p><strong>Esempio:</strong> Fighter (FOR +3) con Spada Lunga (1d8). d20=14 → 14+3+3=20 vs CA 16 → <em>colpo!</em> Danno: 1d8=5 → 5+3 = <strong>8</strong>.</p>
            </div>

            <h3 className="arena-info-title">🛡 Le 12 Classi</h3>
            <div className="arena-info-example">
              <p><strong>Guerriero (Fighter)</strong> — Armi semplici e marziali, 2 armi equipaggiabili, armatura pesante + scudo. <em>Skill:</em> Secondo Respiro (cura), Scatto d'Azione (azione extra), Carica (2d6+FOR), Disarmare (blocca armi 3T), Presenza Possente + Critico Migliorato (passive).</p>
              <p><strong>Barbaro (Barbarian)</strong> — Armi semplici e marziali, 2 armi, armatura leggera/media o nessuna + scudo. <em>Skill:</em> Furia (+2 danni e riduzione danni 3T), Turbine di Lame (2 attacchi 2d10+FOR), Attacco Poderoso (2d8+FOR + vantaggio 3T).</p>
              <p><strong>Paladino (Paladin)</strong> — Armi marziali, 2 armi, armatura pesante + scudo. Spell paladino. <em>Skill:</em> Smite Divino (arma +2d8, 2 cariche), Imposizione delle Mani (pozza di cura = HP/3, scegli quanti curare).</p>
              <p><strong>Cacciatore (Ranger)</strong> — Armi ranger, 2 armi, armatura leggera/media + scudo. Spell ranger. <em>Skill:</em> Marchio del Cacciatore (+3 ai TPC per 3 turni, bonus action).</p>
              <p><strong>Monaco (Monk)</strong> — Armi monaco, 1 arma, nessuna armatura (CA = 10 + DES + SAG), no scudo. <em>Skill:</em> Pugno (1d6+DES), Carica di Pugni (2 colpi 2d6+DES), Concentrazione (+4 danno 2T), Assorbire Danni (50% del prossimo danno si converte in cura), Cura Ki (1d8+SAG).</p>
              <p><strong>Ladro (Rogue)</strong> — Armi ladro, 2 armi, armatura leggera, no scudo. Vantaggio all'iniziativa. <em>Skill:</em> Attacco Furtivo (arma +1d6+DES, 3 cariche), Furtività (vantaggio sui prossimi 3 attacchi), Triboli (svantaggio + 1d6 sanguinamento/turno per 3T).</p>
              <p><strong>Mago (Wizard)</strong> — Armi semplici, 1 arma, abito da mago (no armatura, no scudo). Slot magia ampi. <em>Skill:</em> Recupero Arcano (ripristina 2 slot lv1 + 1 slot lv2).</p>
              <p><strong>Stregone (Sorcerer)</strong> — Armi semplici, 1 arma, no armatura, no scudo. <em>Skill:</em> Magia Innata (passiva), Fonte di Magia (ripristina 2 slot magia a scelta).</p>
              <p><strong>Warlock</strong> — Armi semplici, 1 arma, armatura leggera, no scudo. <em>Skill:</em> Magical Cunning (salta turno → +1 carica a ogni slot, 2 cariche), Patto Demoniaco (sacrifica 1d4 HP → +1d12 alle spell per 3T).</p>
              <p><strong>Druido (Druid)</strong> — Armi druido, 1 arma, armatura druidica + scudo di legno. Spell druido. <em>Skill:</em> Forma Selvaggia (Wild Shape, trasformazione con HP propri).</p>
              <p><strong>Chierico (Cleric)</strong> — Armi cleric, 1 arma, armatura leggera/media + scudo. Slot magia (cura, buff, danni divini).</p>
              <p><strong>Bardo (Bard)</strong> — Armi bardo, 1 arma, armatura leggera, no scudo. Spell bardo. <em>Skill:</em> Ispirazione Bardica (+1d6 al prossimo TPC alleato, cariche = CAR, bonus action).</p>
            </div>

            <h3 className="arena-info-title">🧪 Oggetti Consumabili</h3>
            <ul className="arena-info-list">
              <li><strong>🧪 Pozione di Cura</strong> — 2d12 HP, consuma il turno.</li>
              <li><strong>💚 Pozione di Cura Media</strong> — 2d8 HP (acquistabile in Bottega), consuma il turno.</li>
              <li><strong>💣 Bomba</strong> — 2d6 danni al bersaglio, consuma il turno.</li>
              <li><strong>☠ Pozione di Veleno</strong> — applica 1d6 veleno al bersaglio per il turno successivo.</li>
              <li>Gli oggetti acquistati in Bottega vengono aggiunti al loadout per il torneo successivo.</li>
            </ul>

            <h3 className="arena-info-title">🪙 Monete Arena (MA)</h3>
            <ul className="arena-info-list">
              <li><strong>+5 MA</strong> per aver partecipato a un match dell'Arena (al primo turno giocato).</li>
              <li><strong>+7 MA</strong> per ogni round vinto.</li>
              <li><strong>+30 MA</strong> se vinci il torneo (in aggiunta ai +7 della finale).</li>
              <li>Spendile alla <strong>Bottega dell'Arena</strong> per pozioni, livelli di classe extra e oggetti speciali da usare nei prossimi tornei.</li>
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
      {arenaMeta.phase !== "finished" && !arenaMeta.tournamentWinner && mostRecentChampion?.uid && (
        <div className="champion-banner last-champion">
          <div className="champion-crown">♛</div>
          <div className="champion-label">Ultimo Campione</div>
          <div className="champion-name">
            {mostRecentChampion.image && (
              <img src={mostRecentChampion.image} alt="" className="last-champion-avatar" />
            )}
            {mostRecentChampion.name || "Campione"}
            {mostRecentChampion.class && <span className="last-champion-class"> · {mostRecentChampion.class}</span>}
          </div>
          {mostRecentChampion.prizes && <div className="champion-prize">Premio: {mostRecentChampion.prizes}</div>}
        </div>
      )}

      {champions.length > 0 && (
        <HallOfChampions
          champions={champions}
          isMaster={isMaster}
          onRemove={async (uid) => {
            const champ = champions.find(c => c.uid === uid);
            if (!champ) return;
            if (!window.confirm(`Rimuovere ${champ.name || "questo campione"} dalla Sala dei Campioni? Verranno eliminate ${champ.wins} vittorie.`)) return;
            for (const id of champ.entryIds) {
              try { await deleteDoc(doc(db, "arena_tournament_history", id)); }
              catch (e) { console.error("delete champion entry:", e); }
            }
          }}
        />
      )}

      {/* ── SCROLLYTELLING: Custode dell'Arena (visibile al Master) ── */}
      {isMaster && (
        <section className="arena-scrollytell" aria-label="Il Custode dell'Arena">
          <div className="arena-scrollytell-media" aria-hidden="true">
            <img
              src="/assets/Helmvil.jpg"
              alt=""
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </div>
          <div className="arena-scrollytell-content">
            <div className="arena-scrollytell-frame">
              <span className="arena-scrollytell-eyebrow">♛ Il Custode</span>
              <h2 className="arena-scrollytell-title">Sangue, Onore, Decisioni</h2>
              <p className="arena-scrollytell-text">
                Apri le iscrizioni, approva i campioni, pausa il tempo, dichiara i vincitori.
                L'Arena risponde alla tua mano — qui sotto trovi il pannello del Master.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── PANNELLO MASTER ── */}
      {isMaster && (
        <div id="arena-master-panel" className="master-panel">
          <h3 className="master-panel-title"><span className="master-crown">♛</span> Pannello del Master</h3>

          {arenaMeta.phase === "registration" && (
            <div className="prize-editor">
              <p className="col-label">♛ Opzioni Iscrizioni</p>
              <label className="champions-only-toggle">
                <input
                  type="checkbox"
                  checked={!!arenaMeta.championsOnly}
                  onChange={async (e) => {
                    const enabling = e.target.checked;
                    await updateDoc(doc(db, "arena_meta", "global"), { championsOnly: enabling });
                    if (enabling && champions.length > 0) {
                      const sendInvites = window.confirm(
                        `Inviare un invito ai ${champions.length} campioni della Sala?`
                      );
                      if (sendInvites) {
                        for (const c of champions) {
                          try {
                            await addDoc(collection(db, "notifications"), {
                              userId: c.uid,
                              read: false,
                              timestamp: serverTimestamp(),
                              title: "♛ Arena dei Campioni — Iscrizioni Aperte",
                              message: `Solo i Campioni possono entrare. Hai già vinto ${c.wins} ${c.wins === 1 ? "torneo" : "tornei"}: dimostra ancora il tuo valore!`,
                            });
                          } catch (err) { console.error("champion invite:", err); }
                        }
                        alert(`✔ Inviati ${champions.length} inviti.`);
                      }
                    }
                  }}
                />
                <span>♛ Solo Campioni — solo chi ha già vinto un torneo può iscriversi</span>
              </label>
            </div>
          )}


          <div className="master-sections">
            <div className="master-col">
              <p className="col-label">Approvati ({arenaMeta.participants?.length || 0})</p>
              {arenaMeta.participants?.length === 0 && <p className="empty-note">Nessuno ancora approvato.</p>}
              {arenaMeta.participants?.map(uid => {
                const titles = getSnapTitles(snapshots[uid]);
                return (
                  <div key={uid} className="participant-tag participant-title-row">
                    <span className="p-dot approved" />
                    <span className="p-name">{snapshots[uid]?.name || uid}</span>
                    {snapshots[uid]?.class && <span className="p-class">{snapshots[uid].class}</span>}
                    {titles.map(key => ARENA_TITLES[key] && (
                      <span key={key} className="p-title-badge" title={ARENA_TITLES[key].short}>
                        {ARENA_TITLES[key].icon} {ARENA_TITLES[key].name}
                      </span>
                    ))}
                    {arenaMeta.phase === "registration" && (
                      <button className="btn-bench-one" onClick={() => benchParticipant(uid)} title="Sposta in attesa">
                        ↩
                      </button>
                    )}
                  </div>
                );
              })}
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
                {advanceLabel}
              </button>
            )}
            {canDeclareChampion && (
              <button className="btn-advance-round" onClick={declareTournamentChampion}>
                🏆 Dichiara Campione
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
            {(arenaMeta.participants?.length || 0) > 0 && (
              <button className="btn-bench-all" onClick={benchAllParticipants} title="Sposta tutti i partecipanti nella lista d'attesa">
                ↩ Tutti in attesa
              </button>
            )}
            {(arenaMeta.waitingList?.length || 0) > 0 && (
              <button className="btn-clear-waiting" onClick={clearWaitingList} title="Svuota la lista d'attesa">
                🗑 Svuota attesa
              </button>
            )}
            {(() => {
              const archivedIds = new Set((arenaMeta.funMatchHistory || []).map(e => e.matchId));
              const prunable = (arenaMeta.matches || []).filter(
                m => m.kind === "fun" && m.status === "finished" && archivedIds.has(m.matchId)
              );
              if (prunable.length === 0) return null;
              return (
                <button
                  className="btn-clear-waiting"
                  title="Rimuove dalle partite live le Sfide Libere finite e già archiviate (i vincitori restano nello storico)"
                  onClick={async () => {
                    if (!window.confirm(`Pulire ${prunable.length} sfida/e libera/e finite dall'arena? I vincitori restano nello storico.`)) return;
                    const prunableIds = new Set(prunable.map(m => m.matchId));
                    const kept = (arenaMeta.matches || []).filter(m => !prunableIds.has(m.matchId));
                    await updateDoc(doc(db, "arena_meta", "global"), { matches: kept });
                  }}
                >
                  🧹 Pulisci partite finite ({prunable.length})
                </button>
              );
            })()}
            <button className="btn-reset" onClick={async () => {
              const inCombat = arenaMeta.phase === "combat";
              const inFinished = arenaMeta.phase === "finished";
              const partCount = (arenaMeta.participants?.length || 0);
              const warn = inCombat
                ? `Sei sicuro di voler resettare? Il torneo è IN CORSO con ${partCount} partecipanti. Tutto andrà perso (match, bracket, scommesse rimborsate).`
                : inFinished
                ? "Sei sicuro di voler resettare? Il torneo è concluso ma azzererai bracket, partecipanti e storico match dell'arena meta."
                : `Sei sicuro di voler resettare l'arena? (${partCount} iscritti verranno rimossi)`;
              if (!window.confirm(warn)) return;
              if (inCombat && !window.confirm("CONFERMA FINALE: stai per cancellare un torneo in corso. Procedere?")) return;
              await refundAllBets();
              const preservedFun = (arenaMeta.matches || []).filter(m => m.kind === "fun");
              // Conserva gli snapshot dei giocatori in fun match attive E quelli ancora in lista d'attesa,
              // così che il reset non costringa i waitlistati a re-iscriversi.
              const keepUids = new Set(arenaMeta.waitingList || []);
              preservedFun.forEach(m => (m.players || []).forEach(p => keepUids.add(p.id)));
              const allSnaps = arenaMeta.characterSnapshots || {};
              const preservedSnaps = {};
              keepUids.forEach(uid => { if (allSnaps[uid]) preservedSnaps[uid] = allSnaps[uid]; });
              await updateDoc(doc(db, "arena_meta", "global"), {
                phase: "registration", prizes: arenaMeta.prizes || "",
                participants: [], matches: preservedFun,
                characterSnapshots: preservedSnaps, tournamentWinner: null,
                currentRound: 1, matchHistory: [],
                groupA: [], groupB: [],
                championsOnly: arenaMeta.championsOnly || false,
                // waitingList intenzionalmente NON azzerata: usa "Svuota attesa" per pulirla.
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
                <button className="btn-auto-generate" onClick={() => {
                  const RANDOM_NAMES = ["Caelus", "Selene Vale", "Thorin Vex", "Lyra Sangueforte", "Argus Nera-Lama", "Kael Ombravento", "Mira Spaccaossa", "Borin Hammerstein", "Vesper Ombracorvo", "Auron Ferrosaldo", "Nyx Velocelama", "Roric Cuoredrago", "Sylas Forgiatuono", "Elara Ventoluce", "Garrick Pugnoreale"];
                  const randName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
                  const randClass = MASTER_JOIN_CLASSES[Math.floor(Math.random() * MASTER_JOIN_CLASSES.length)];
                  setMasterJoinName(randName);
                  setMasterJoinClass(randClass);
                }} title="Riempie nome e classe casuali">
                  🎲 Genera
                </button>
                <button className="btn-join" onClick={startMasterLoadout} disabled={!masterJoinName.trim() || !masterJoinClass}>
                  Continua →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FIX: P5c — collapsible master panels become trigger buttons + modals */}
      {isMaster && (
        <div className="arena-modal-trigger-row">
          <button
            type="button"
            className="arena-modal-trigger"
            onClick={() => setTitlesModalOpen(true)}
          >
            <span className="arena-modal-trigger-icon">✦</span>
            <span className="arena-modal-trigger-text">
              <span className="arena-modal-trigger-title">Titoli d'Arena</span>
              <span className="arena-modal-trigger-sub">Permanenti — gestisci titoli</span>
            </span>
          </button>
          <button
            type="button"
            className="arena-modal-trigger"
            onClick={() => setStatsTournModalOpen(true)}
          >
            <span className="arena-modal-trigger-icon">★</span>
            <span className="arena-modal-trigger-text">
              <span className="arena-modal-trigger-title">Statistiche Torneo</span>
              <span className="arena-modal-trigger-sub">Classi · Tornei archiviati</span>
            </span>
          </button>
          <button
            type="button"
            className="arena-modal-trigger"
            onClick={() => setStatsFunModalOpen(true)}
          >
            <span className="arena-modal-trigger-icon">⚜</span>
            <span className="arena-modal-trigger-text">
              <span className="arena-modal-trigger-title">Statistiche Arena Libera</span>
              <span className="arena-modal-trigger-sub">Sfide concluse</span>
            </span>
          </button>
        </div>
      )}
      <ArenaModal
        open={titlesModalOpen}
        onClose={() => setTitlesModalOpen(false)}
        title="♛ Titoli d'Arena — Permanenti"
      >
        <MasterTitleEditor forceOpen />
      </ArenaModal>
      <ArenaModal
        open={statsTournModalOpen}
        onClose={() => setStatsTournModalOpen(false)}
        title="📊 Statistiche Classi — Torneo"
      >
        <TournamentClassStats liveTournament={liveTournament} onSync={syncMatchHistory} forceOpen />
      </ArenaModal>
      <ArenaModal
        open={statsFunModalOpen}
        onClose={() => setStatsFunModalOpen(false)}
        title="⚔ Statistiche Classi — Arena Libera"
      >
        <FunArenaClassStats
          funHistory={arenaMeta.funMatchHistory || []}
          currentMatches={arenaMeta.matches || []}
          isMaster={isMaster}
          onReset={async () => {
            await updateDoc(doc(db, "arena_meta", "global"), { funMatchHistory: [] });
          }}
          forceOpen
        />
      </ArenaModal>

      {/* ── ZONA LOADOUT (tournament registration) ── */}
      {(
        (arenaMeta.phase === "registration" && (!isMaster || loadoutPhase !== "idle")) ||
        (loadoutContext === "fun" && loadoutPhase !== "idle")
      ) && (
        <div id="arena-loadout" className={`join-zone ${loadoutContext === "fun" ? "join-zone-fun" : ""}`}>

          {loadoutContext === "fun" && (
            <div className={`fun-loadout-banner${aiMatchPending ? " fun-loadout-banner-ai" : ""}`}>
              {aiMatchPending
                ? "🤖 Stai preparando una Sfida contro l'IA — Hard Mode. L'avversario sarà generato al lancio."
                : (funAcceptMatchId
                    ? "🛡 Stai accettando una Sfida Libera — nessuna ricompensa, solo per il gusto del combattimento"
                    : "🛡 Stai creando una Sfida Libera — nessuna ricompensa, solo per il gusto del combattimento")}
            </div>
          )}

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
              <button className="btn-join btn-auto-pg" onClick={autoGeneratePg} title="Crea un personaggio completo e casuale, pronto da rivedere">
                ⚡ Genera a caso
              </button>
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
                  <button className="btn-auto-generate" onClick={() => {
                    /* distribuisci 10 punti random tra 6 stat, cap a 3 per stat */
                    const stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
                    let remaining = 10;
                    const keys = Object.keys(stats);
                    while (remaining > 0) {
                      const k = keys[Math.floor(Math.random() * keys.length)];
                      if (stats[k] < 3) { stats[k]++; remaining--; }
                      else if (keys.every(kk => stats[kk] >= 3)) break;
                    }
                    setPendingStats(stats);
                  }} title="Distribuisce 10 punti casuali">
                    🎲 Random
                  </button>
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
            const isRanger     = isRangerClass((charPreview.class || "").toLowerCase());
            const isWarlock    = isWarlockClass((charPreview.class || "").toLowerCase());
            const isArtificer  = isArtificerClass((charPreview.class || "").toLowerCase());
            const petReady     = !isRanger || !!pendingPet;
            const demonReady   = !isWarlock || !!pendingDemon;
            const constructReady = !isArtificer || !!pendingConstruct;
            const weaponsLeft  = config.maxWeapons - pendingWeapons.length;
            const spellsLeft   = config.maxSpells  - pendingSpells.length;
            const armorReady   = !!pendingArmor;
            const totalItems   = Object.values(pendingItemCounts).reduce((a, b) => a + b, 0);
            const isReady      = weaponsLeft === 0 && spellsLeft === 0 && armorReady && totalItems >= 1 && petReady && demonReady && constructReady;
            const btnParts     = [];
            if (weaponsLeft > 0) btnParts.push(`${weaponsLeft} arm${weaponsLeft === 1 ? "a" : "i"}`);
            if (spellsLeft  > 0) btnParts.push(`${spellsLeft} incantesim${spellsLeft === 1 ? "o" : "i"}`);
            if (!armorReady)     btnParts.push("1 armatura");
            if (totalItems < 1)  btnParts.push("1 oggetto");
            if (!petReady)       btnParts.push("1 compagno animale");
            if (!demonReady)     btnParts.push("1 demone");
            if (!constructReady) btnParts.push("1 costrutto");
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
                {/* Anteprima personaggio — intestazione verticale a tutta larghezza */}
                <div className="loadout-char-preview loadout-char-preview--top">
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
                        {item.damageType && <span className={`loadout-item-dmgtype dt-${item.damageType}`}>{item.damageType}</span>}
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

                {/* Compagno Animale (Ranger) */}
                {isRanger && (() => {
                  const ownedBuffs = charPreview.arenaBuffs || {};
                  const availablePets = Object.values(RANGER_PETS).filter(pet => !pet.requiresBuff || (ownedBuffs[pet.requiresBuff] ?? 0) > 0);
                  return (
                    <>
                      <div className="loadout-section-title">
                        🐾 Compagno Animale — {pendingPet ? "1/1" : "0/1"}
                      </div>
                      <div className="loadout-grid">
                        {availablePets.map(pet => {
                          const isSelected = pendingPet === pet.key;
                          return (
                            <button
                              key={pet.key}
                              className={`loadout-item ${isSelected ? "selected" : ""}`}
                              onClick={() => setPendingPet(isSelected ? null : pet.key)}
                            >
                              <span className="loadout-item-icon">{pet.icon}</span>
                              <span className="loadout-item-name">{pet.name}</span>
                              <span className="loadout-item-info">{pet.info}</span>
                              {isSelected && <span className="loadout-check">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

                {/* Demone Evocato (Warlock) */}
                {isWarlock && (
                  <>
                    <div className="loadout-section-title">
                      👁 Demone Evocato — {pendingDemon ? "1/1" : "0/1"}
                    </div>
                    <div className="loadout-grid">
                      {Object.values(WARLOCK_DEMONS).map(demon => {
                        const isSelected = pendingDemon === demon.key;
                        return (
                          <button
                            key={demon.key}
                            className={`loadout-item ${isSelected ? "selected" : ""}`}
                            onClick={() => setPendingDemon(isSelected ? null : demon.key)}
                          >
                            <span className="loadout-item-icon">{demon.icon}</span>
                            <span className="loadout-item-name">{demon.name}</span>
                            <span className="loadout-item-info">{demon.info}</span>
                            {isSelected && <span className="loadout-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Costrutto (Artefice) */}
                {isArtificerClass((charPreview.class || "").toLowerCase()) && (
                  <>
                    <div className="loadout-section-title">
                      🤖 Costrutto — {pendingConstruct ? "1/1" : "0/1"}
                    </div>
                    <div className="loadout-grid">
                      {Object.values(ARTIFICER_CONSTRUCTS).map(c => {
                        const isSelected = pendingConstruct === c.key;
                        return (
                          <button
                            key={c.key}
                            className={`loadout-item ${isSelected ? "selected" : ""}`}
                            onClick={() => setPendingConstruct(isSelected ? null : c.key)}
                          >
                            <span className="loadout-item-icon">{c.icon}</span>
                            <span className="loadout-item-name">{c.name}</span>
                            <span className="loadout-item-info">{c.info}</span>
                            {isSelected && <span className="loadout-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
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

              {!isRegistered && !isPending && (() => {
                const userIsChampion = tournamentHistory.some(t => t.winnerId === currentUser?.uid);
                const lockedOut = arenaMeta.championsOnly && !userIsChampion;
                return (
                  <>
                    {arenaMeta.championsOnly && (
                      <div className={`champions-only-badge${lockedOut ? " locked" : ""}`}>
                        ♛ Solo Campioni — {lockedOut
                          ? "non puoi iscriverti, devi prima vincere un torneo"
                          : "sei un Campione: puoi iscriverti"}
                      </div>
                    )}
                    <button className="btn-join" onClick={openLoadoutPicker} disabled={lockedOut}>
                      ⚔ Crea il tuo Personaggio
                    </button>
                  </>
                );
              })()}
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

      {/* ── ARENA LIBERA (Fun) — sempre disponibile, separata dal torneo ── */}
      {currentUser && (() => {
        const openChallenges = funMatches.filter(m => m.status === "open" && !m.ai);
        const ongoingFun = funMatches.filter(m => m.status === "initiative" || m.status === "active");
        const myActiveFun = ongoingFun.find(m => m.players?.some(p => p.id === currentUser.uid));
        // AI matches are private to the owner — hide them from other players' lobby.
        const otherActiveFun = ongoingFun.filter(m => !m.players?.some(p => p.id === currentUser.uid) && !m.ai);
        const myFinishedFun = funMatches
          .filter(m => m.status === "finished" && m.players?.some(p => p.id === currentUser.uid))
          .slice(-3);
        return (
          <>
            {/* ── SCROLLYTELLING: Allenamento Libero ── */}
            <section className="arena-scrollytell" aria-label="Arena Libera">
              <div className="arena-scrollytell-media" aria-hidden="true">
                <img
                  src="/assets/PhotoStory/GruppoMEAA/locanda3.jpg"
                  alt=""
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </div>
              <div className="arena-scrollytell-content">
                <div className="arena-scrollytell-frame">
                  <span className="arena-scrollytell-eyebrow">⚔ Sfide Libere</span>
                  <h2 className="arena-scrollytell-title">Allenamento Senza Tempo</h2>
                  <p className="arena-scrollytell-text">
                    Nessuna ricompensa, solo ferro contro ferro. Sfida un compagno o l'IA con le
                    stesse regole del torneo — addestra la tua build senza perdere onore.
                  </p>
                </div>
              </div>
            </section>
            <div className="fun-arena-section" id="arena-training">
              <div className="fun-arena-header">
                <span className="fun-arena-icon">⚔</span>
                <div className="fun-arena-title-block">
                  <h3 className="fun-arena-title">Arena Libera <span className="fun-arena-title-tag">Allenamento</span></h3>
                <p className="fun-arena-subtitle">
                  Sfide 1v1 senza ricompense. Stesso regolamento del torneo, solo per il gusto di combattere.
                </p>
              </div>
              {ongoingFun.length > 0 && (
                <span className="fun-arena-live-badge" title={`${ongoingFun.length} sfida/e in corso`}>
                  🔴 {ongoingFun.length} in corso
                </span>
              )}
              {!myActiveFun && (
                <div className="fun-arena-create-row">
                  <button className="btn-fun-create" onClick={openFunCreate}>
                    ⚔ Crea Sfida
                  </button>
                  <button
                    className="btn-fun-create btn-fun-ai"
                    onClick={openAiCreate}
                    title="Combatti contro un avversario IA in modalità difficile"
                  >
                    🤖 Sfida l'IA
                    <span className="btn-fun-ai-tag">Hard</span>
                  </button>
                </div>
              )}
            </div>

            {otherActiveFun.length > 0 && (
              <div className="fun-arena-lobby">
                <div className="fun-arena-lobby-title">Sfide in corso</div>
                {otherActiveFun.map(m => {
                  const [pa, pb] = m.players || [];
                  const aSnap = snapshots[pa?.id] || {};
                  const bSnap = snapshots[pb?.id] || {};
                  const turnName = m.players?.find(p => p.id === m.turn)?.name;
                  return (
                    <div key={m.matchId} className="fun-challenge-row fun-challenge-row--live">
                      <div className="fun-challenge-info">
                        <span className="fun-challenge-name">
                          {pa?.name || "?"}{aSnap.class ? ` (${aSnap.class})` : ""} <span className="fun-challenge-vs">VS</span> {pb?.name || "?"}{bSnap.class ? ` (${bSnap.class})` : ""}
                        </span>
                        <span className="fun-challenge-hp">
                          {m.status === "initiative" ? "⚡ Iniziativa" : `⚔ Turno di ${turnName || "?"}`}
                          {" · "}HP {pa?.hp ?? "?"} / {pb?.hp ?? "?"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {openChallenges.length > 0 && (
              <div className="fun-arena-lobby">
                <div className="fun-arena-lobby-title">Sfide aperte</div>
                {openChallenges.map(m => {
                  const challenger = m.players?.[0];
                  const cSnap = snapshots[challenger?.id] || {};
                  const isMine = m.challengerId === currentUser.uid;
                  return (
                    <div key={m.matchId} className="fun-challenge-row">
                      {cSnap.image && <img src={cSnap.image} alt="" className="fun-challenge-avatar" />}
                      <div className="fun-challenge-info">
                        <span className="fun-challenge-name">{challenger?.name || "?"}</span>
                        {cSnap.class && <span className="fun-challenge-class">{cSnap.class}</span>}
                        <span className="fun-challenge-hp">{challenger?.maxHp ?? "?"} HP · CA {cSnap.stats?.ac ?? "?"}</span>
                      </div>
                      {isMine ? (
                        <button className="btn-fun-cancel" onClick={() => cancelFunChallenge(m.matchId)}>
                          ✕ Annulla
                        </button>
                      ) : (
                        <button className="btn-fun-accept" onClick={() => openFunAccept(m.matchId)} disabled={!!myActiveFun}>
                          {myActiveFun ? "Hai già una sfida in corso" : "⚔ Accetta"}
                        </button>
                      )}
                      {isMaster && !isMine && (
                        <button className="btn-fun-cancel" onClick={() => cancelFunChallenge(m.matchId)}>♛ Rimuovi</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {myFinishedFun.length > 0 && (
              <div className="fun-arena-history">
                <div className="fun-arena-history-title">Le tue ultime sfide</div>
                {myFinishedFun.slice().reverse().map(m => {
                  const opp = m.players?.find(p => p.id !== currentUser.uid);
                  const won = m.winner === currentUser.uid;
                  const draw = !m.winner;
                  return (
                    <div key={m.matchId} className={`fun-history-row ${draw ? "draw" : won ? "win" : "lose"}`}>
                      <span className="fun-history-result">
                        {draw ? "🤝 Annullata" : won ? `🛡 Hai vinto contro ${opp?.name || "?"}` : `💀 Sconfitto da ${opp?.name || "?"}`}
                      </span>
                      <button className="btn-fun-remove" onClick={() => removeFunMatch(m.matchId)} title="Rimuovi dalla lista">×</button>
                    </div>
                  );
                })}
              </div>
            )}

            {openChallenges.length === 0 && !myActiveFun && otherActiveFun.length === 0 && myFinishedFun.length === 0 && (
              <div className="fun-arena-empty">Nessuna sfida aperta. Sii il primo a lanciarne una!</div>
            )}
            </div>
          </>
        );
      })()}

      {/* ── SCROLLYTELLING: Tabellone (visibile in combat/finished) ── */}
      {(arenaMeta.phase === "combat" || arenaMeta.phase === "finished") && tournamentMatches.length > 0 && (
        <section className="arena-scrollytell" aria-label="Tabellone del Campionato">
          <div className="arena-scrollytell-media" aria-hidden="true">
            <img
              src="/assets/PhotoStory/GruppoMEAA/run.jpg"
              alt=""
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </div>
          <div className="arena-scrollytell-content">
            <div className="arena-scrollytell-frame">
              <span className="arena-scrollytell-eyebrow">Bracket</span>
              <h2 className="arena-scrollytell-title">Tabellone del Campionato</h2>
              <p className="arena-scrollytell-text">
                Gironi, scontri diretti, finale. Il tabellone vivo qui sotto racconta in tempo reale
                chi è ancora in piedi — segui la tua sfida verso la corona.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── TABELLONE DEL CAMPIONATO (visibile a tutti gli utenti loggati) ── */}
      <span id="arena-bracket-anchor" aria-hidden="true" />
      {(arenaMeta.phase === "combat" || arenaMeta.phase === "finished") && tournamentMatches.length > 0 && (() => {
        const renderMatchCard = (m) => {
          const isMyMatch = m.players.some(p => p.id === currentUser?.uid);

          // ── Compact view for finished matches ─────────────────
          // Single line: [W/L badge] WinnerName  ▸  LoserName(struck-through)
          // Badge color reflects viewer's outcome if they were in the match.
          if (m.status === "finished") {
            const winner = m.players.find(p => p.id === m.winner);
            const losers = m.players.filter(p => p.id !== m.winner);
            const myRole = isMyMatch
              ? (m.winner === currentUser?.uid ? "win" : "loss")
              : null;
            return (
              <div key={m.matchId} className={`bracket-card-mini ${myRole ? `mine-${myRole}` : ""}`}>
                <span className={`bracket-mini-badge ${myRole || "neutral"}`}>
                  {myRole === "win" ? "W" : myRole === "loss" ? "L" : "✓"}
                </span>
                <span className="bracket-mini-winner" title={winner?.name || "?"}>
                  {winner?.name || "?"}
                </span>
                <span className="bracket-mini-vs" aria-hidden="true">▸</span>
                <span className="bracket-mini-losers" title={losers.map(l => l.name).join(", ")}>
                  {losers.map(l => l.name).join(", ") || "—"}
                </span>
              </div>
            );
          }

          // ── Full detail card for active / initiative / pending ──
          return (
            <div key={m.matchId} className={`bracket-card ${m.status}${isMyMatch ? " my-match" : ""}`}>
              {m.players.map((p, idx) => {
                const char = snapshots[p.id] || { stats: { maxHp: 70 } };
                const maxHp = char.stats?.maxHp ?? 70;
                const hpPct = Math.max(0, Math.min(100, (p.hp / maxHp) * 100));
                // Badge HP: rosso scuro fisso (override CSS in Arena.css); bar fill: verde chiaro fisso, track dietro rosso scuro.
                const isActive = m.turn === p.id && m.status === "active";
                return (
                  <React.Fragment key={p.id}>
                    {idx > 0 && <div className="bracket-sep">VS</div>}
                    <div className={`bracket-fighter${isActive ? " active-turn" : ""}`}>
                      <div className="bracket-fighter-row">
                        {char.image && <img src={char.image} className="bracket-avatar" alt="" />}
                        <div className="bracket-fighter-info">
                          <span className="bracket-fighter-name">{p.name}</span>
                          {char.class && <span className="bracket-fighter-class">{char.class}</span>}
                          {getSnapTitles(char).map(key => ARENA_TITLES[key] && (
                            <span key={key} className="bracket-fighter-title" title={ARENA_TITLES[key].short}>
                              {ARENA_TITLES[key].icon} {ARENA_TITLES[key].name}
                            </span>
                          ))}
                        </div>
                        {isActive
                          ? <span className="bracket-active-dot" title="Turno in corso">●</span>
                          : <span className="bracket-hp-badge">{p.hp}</span>
                        }
                      </div>
                      <div className="bracket-hp-track">
                        <div className="bracket-hp-bar" style={{ width: `${hpPct}%` }} />
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div className={`bracket-status ${m.status}`}>
                {m.status === "initiative" ? "⚡ Iniziativa" : "⚔ In combattimento"}
              </div>
              {m.logs?.length > 0 && m.status === "active" && (
                <div className="bracket-last-log">{logPubText(m.logs[m.logs.length - 1])}</div>
              )}
              {isMaster && (
                <div className="bracket-force-winner">
                  <span className="bracket-force-label">♛ Forza vincitore:</span>
                  <div className="bracket-force-btns">
                    {m.players.map(p => (
                      <button
                        key={p.id}
                        className="btn-force-winner"
                        onClick={() => masterForceWinner(m.matchId, p.id)}
                        title={`Dichiara ${p.name} vincitore di questo match`}
                      >
                        👑 {(p.name || "?").split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        };

        const renderGroupColumn = (groupKey) => {
          const groupIds = groupKey === "A" ? (arenaMeta.groupA || []) : (arenaMeta.groupB || []);
          if (groupIds.length === 0) return null;
          const groupMatches = tournamentMatches.filter(m => m.kind === "group" && m.group === groupKey);
          const byRound = {};
          groupMatches.forEach(m => {
            const r = parseInt((m.matchId.match(/_R(\d+)_/) || [, 1])[1]);
            (byRound[r] = byRound[r] || []).push(m);
          });
          const rounds = Object.entries(byRound).sort(([a], [b]) => a - b);
          const standings = computeGroupStandings(groupKey, tournamentMatches);
          return (
            <div className="bracket-group">
              <div className="bracket-group-header">
                <span className="bracket-group-title">Girone {groupKey}</span>
                <span className="bracket-group-count">{groupIds.length} {groupIds.length === 1 ? "giocatore" : "giocatori"}</span>
              </div>
              <table className="bracket-standings">
                <thead>
                  <tr><th>#</th><th>Giocatore</th><th>V</th><th>S</th></tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => {
                    const snap = snapshots[s.uid] || {};
                    return (
                      <tr key={s.uid} className={i === 0 ? "leader" : ""}>
                        <td>{i + 1}</td>
                        <td>
                          {snap.image && <img src={snap.image} className="standings-avatar" alt="" />}
                          {snap.name || "?"}
                        </td>
                        <td>{s.wins}</td>
                        <td>{s.losses}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="bracket-rounds-list">
                {rounds.map(([round, rMatches]) => (
                  <div key={round} className="bracket-round-col">
                    <div className="bracket-round-header">Round {round}</div>
                    {rMatches.map(renderMatchCard)}
                  </div>
                ))}
                {rounds.length === 0 && (
                  <div className="bracket-rounds-empty">Nessun match in questo girone.</div>
                )}
              </div>
            </div>
          );
        };

        const finalM = tournamentMatches.find(m => m.kind === "final");

        /* FIX: P5b — compact summary card per girone (just the standings) */
        const renderGroupSummary = (groupKey) => {
          const groupIds = groupKey === "A" ? (arenaMeta.groupA || []) : (arenaMeta.groupB || []);
          if (groupIds.length === 0) return null;
          const standings = computeGroupStandings(groupKey, tournamentMatches);
          return (
            <div key={groupKey} className="bracket-summary-card">
              <h4 className="bracket-summary-card-title">⚜ Girone {groupKey}</h4>
              <table className="bracket-standings">
                <thead>
                  <tr><th>#</th><th>Giocatore</th><th>V</th><th>S</th></tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => {
                    const snap = snapshots[s.uid] || {};
                    return (
                      <tr key={s.uid} className={i === 0 ? "leader" : ""}>
                        <td>{i + 1}</td>
                        <td>
                          {snap.image && <img src={snap.image} className="standings-avatar" alt="" />}
                          {snap.name || "?"}
                        </td>
                        <td>{s.wins}</td>
                        <td>{s.losses}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        };

        return (
          <>
            {/* FIX: P5b — inline trigger row + standings summary */}
            <div className="bracket-open-row" id="arena-bracket">
              <div className="bracket-open-row-info">
                <h3 className="bracket-open-row-title">⚔ Tabellone — Riepilogo</h3>
                {arenaMeta.phase === "combat" && !finalM && (
                  <span className="bracket-round-badge">Round {arenaMeta.currentRound}</span>
                )}
                {finalM && <span className="bracket-round-badge final-badge">Finale</span>}
              </div>
              <button type="button" className="btn-bracket-open" onClick={() => setBracketModalOpen(true)}>
                📊 Apri Tabellone
              </button>
            </div>
            <div className="bracket-summary-grid">
              {renderGroupSummary("A")}
              {renderGroupSummary("B")}
            </div>

            {/* FIX: P5b — full bracket lives inside modal */}
            <ArenaModal
              open={bracketModalOpen}
              onClose={() => setBracketModalOpen(false)}
              title="⚔ Tabellone del Campionato"
            >
              <div className="bracket-section">
                <div className="bracket-section-round-bar">
                  {arenaMeta.phase === "combat" && !finalM && <span className="bracket-round-badge bracket-round-badge--inline">Round {arenaMeta.currentRound}</span>}
                  {finalM && <span className="bracket-round-badge final-badge bracket-round-badge--inline">Finale</span>}
                </div>
                <div className="bracket-groups-wrap">
                  {renderGroupColumn("A")}
                  {renderGroupColumn("B")}
                </div>
                {finalM && (
                  <div className="bracket-final-wrap">
                    <div className="bracket-final-header">🏆 Finale di Campionato</div>
                    {renderMatchCard(finalM)}
                  </div>
                )}
              </div>
            </ArenaModal>
          </>
        );
      })()}

      {/* FIX: P5d — Betting moved to floating drawer (FAB-triggered).
          Inline render is suppressed by CSS; the FAB and drawer below replace it. */}
      {arenaMeta.phase === "combat" && (!isRegistered || isMaster) && currentUser && (
        <>
          <button
            type="button"
            className="arena-bet-fab"
            onClick={() => setBettingDrawerOpen(true)}
            aria-label="Apri pannello scommesse"
          >
            <span className="arena-bet-fab-icon">🎲</span>
            <span>Scommetti</span>
            {userBetsCount > 0 && (
              <span className="arena-bet-fab-badge">{userBetsCount}</span>
            )}
          </button>
          <ArenaModal
            open={bettingDrawerOpen}
            onClose={() => setBettingDrawerOpen(false)}
            title="🎲 Scommesse Arena"
            variant="drawer"
          >
            <BettingPanel
              arenaMeta={arenaMeta}
              snapshots={snapshots}
              currentUser={currentUser}
              isMaster={isMaster}
            />
          </ArenaModal>
        </>
      )}

      {/* ── POPUP FINE COMBATTIMENTO (vittoria / sconfitta) ── */}
      {fightResult && createPortal(
        <div
          className={`fight-result-overlay ${fightResult.won ? "is-win" : "is-lose"}`}
          onClick={() => setFightResult(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="fight-result-card" onClick={(e) => e.stopPropagation()}>
            {fightResult.won ? (
              <>
                <div className="fight-result-emblem win">🏆</div>
                <div className="fight-result-title win">HAI VINTO!</div>
                {fightResult.winnerImage && (
                  <img className="fight-result-avatar" src={fightResult.winnerImage} alt="" />
                )}
                <div className="fight-result-champ-name">{fightResult.winnerName}</div>
                <div className="fight-result-sub">Gloria nell'Arena di Eldoria</div>
              </>
            ) : (
              <>
                <div className="fight-result-emblem lose">💀</div>
                <div className="fight-result-title lose">Hai Perso</div>
                <div className="fight-result-winner">
                  {fightResult.winnerImage && (
                    <img className="fight-result-winner-img" src={fightResult.winnerImage} alt="" />
                  )}
                  <div className="fight-result-winner-text">
                    <span className="fight-result-winner-label">Ha vinto</span>
                    <span className="fight-result-winner-name">{fightResult.winnerName}</span>
                    {fightResult.winnerClass && (
                      <span className="fight-result-winner-class">{fightResult.winnerClass}</span>
                    )}
                  </div>
                </div>
              </>
            )}
            <button className="fight-result-close" onClick={() => setFightResult(null)}>
              Continua
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── COMBAT MODAL (popup attivato dal floating fight button) ──
          Match in cui sono coinvolto: torneo (in combat) e sfide libere accettate. */}
      {(arenaMeta.matches || []).some(m =>
        ((m.kind === "fun") || arenaMeta.phase === "combat") &&
        m.players?.some(p => p.id === currentUser?.uid) &&
        m.status !== "open"
      ) && (
        <ArenaModal
          open={combatModalOpen}
          onClose={() => setCombatModalOpen(false)}
          title={isMyTurnInActive ? "⚔ È il tuo turno" : "🛡 Il tuo combattimento"}
          variant="combat"
        >
        <div className="matches-container" id="arena-my-match">
          <div className="my-arena-banner">
            <span className="my-arena-banner-deco">⚔</span>
            <div className="my-arena-banner-text">
              <span className="my-arena-banner-eyebrow">La Tua Arena</span>
              <span className="my-arena-banner-title">Il Tuo Campo di Battaglia</span>
            </div>
            <span className="my-arena-banner-deco">⚔</span>
          </div>
          {arenaMeta.matches
            .filter(m => m.players.some(p => p.id === currentUser?.uid))
            .filter(m => m.kind === "fun" || arenaMeta.phase === "combat")
            .filter(m => m.status !== "open")
            .map(m => {
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
            const pendingPoisonDoT = !!myPlayer?.poisonDoT && (myPlayer?.poisonResolvedTurnToken || "") !== (m.turnExpiry || "");
            const pendingBleedDoT  = !!myPlayer?.bleedDoT && (myPlayer?.bleedResolvedTurnToken || "") !== (m.turnExpiry || "");
            const pendingSaveDot = !!myPlayer?.pendingSaveDot;
            const isControlLost  = (myPlayer?.controlLostTurns ?? 0) > 0;
            const hasPendingSave = pendingDexSave || pendingConSave || pendingControlSave || pendingPoisonDoT || pendingBleedDoT || pendingSaveDot || isControlLost;
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
            const isMatchPaused    = arenaMeta.timerPaused && m.kind !== "fun" && m.status !== "finished";

            return (
              <div key={m.matchId} className={`match-card ${m.status === "finished" ? "finished" : ""} ${m.kind === "fun" ? "match-fun" : ""} ${isMatchPaused ? "match-paused" : ""}`}>

                {isMatchPaused && (
                  <div className="match-pause-banner">
                    <span className="match-pause-flag">⛔</span>
                    <div className="match-pause-text">
                      <div className="match-pause-title">ARENA IN PAUSA</div>
                      <div className="match-pause-sub">
                        Il Master ha messo in pausa il match. Nessuna azione disponibile fino alla ripresa.
                      </div>
                    </div>
                    <span className="match-pause-flag">⛔</span>
                  </div>
                )}

                <div className="match-header">
                  <span className="match-round-label">
                    {m.kind === "fun" ? "🛡 Sfida Libera"
                      : m.kind === "final" ? "🏆 Finale"
                      : m.group ? `Girone ${m.group} · Round ${arenaMeta.currentRound}`
                      : `Round ${arenaMeta.currentRound}`}
                  </span>
                  <span className="match-vs-label">{isFFA ? "FFA" : "VS"}</span>
                  <span className="match-status-label">
                    {m.status === "initiative" ? "⚡ Iniziativa"
                      : m.status === "finished" ? (m.kind === "fun" ? "✓ Sfida conclusa" : "🏆 Concluso")
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

                {/* Fighters */}
                <div className="fighters-row">
                  {m.players.map((p, idx) => {
                    const char     = snapshots[p.id] || { stats: { maxHp: 70, ac: 10 } };
                    const isDead   = p.hp <= 0;
                    const isActive = m.turn === p.id;
                    const hpPct    = Math.max(0, (p.hp / (char.stats?.maxHp ?? 70)) * 100);
                    const hpColor  = hpPct > 60 ? "#4ade80" : hpPct > 30 ? "#facc15" : "#f87171";

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
                          {getSnapTitles(char).map(key => ARENA_TITLES[key] && (
                            <div key={key} className="fighter-title-badge" title={ARENA_TITLES[key].short}>
                              {ARENA_TITLES[key].icon} {ARENA_TITLES[key].name}
                            </div>
                          ))}
                          <div className="fighter-meta">
                            CA {p.wildShape && WILD_SHAPES[p.wildShape]?.ac != null ? WILD_SHAPES[p.wildShape].ac : (char.stats?.ac ?? "?")}
                            {(() => {
                              const shieldBonus = (p.shieldSkillTurns ?? 0) > 0 ? (p.shieldSkillBonus ?? 3) : 0;
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

                          {(() => {
                            const statuses = getFighterStatuses(p);
                            if (!statuses.length) return null;
                            return (
                              <div className="fighter-statuses">
                                {statuses.map(s => (
                                  <div key={s.key} className={`fighter-status ${s.cls}`} title={s.tip}>
                                    <span className="fighter-status-ico">{s.icon}</span>
                                    <span className="fighter-status-txt">{s.text}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}

                          {isMyMatch && m.status === "initiative" && p.id === currentUser?.uid && p.init === 0 && (
                            <button className="btn-init" onClick={() => rollInit(m.matchId)}>
                              🎲 Tira Iniziativa
                            </button>
                          )}

                          {/* reazioni fluttuanti sopra questo combattente */}
                          {(arenaMeta.reactions || [])
                            .filter(r => r.matchId === m.matchId && r.uid === p.id && (Date.now() - (r.ts || 0)) < 2400)
                            .map(r => (
                              <span key={r.id} className="arena-fight-react" aria-hidden="true">{r.emoji}</span>
                            ))}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Barra reazioni — i due sfidanti possono inviare emoji (cooldown 20s) */}
                {isMyMatch && m.status !== "finished" && (() => {
                  const onCd = Date.now() < reactCooldownUntil;
                  const cdLeft = Math.max(0, Math.ceil((reactCooldownUntil - Date.now()) / 1000));
                  const open = reactPickerMatch === m.matchId;
                  return (
                    <div className="arena-react-bar">
                      <button
                        type="button"
                        className={`arena-react-toggle${onCd ? " is-cd" : ""}`}
                        onClick={() => { if (!onCd) setReactPickerMatch(open ? null : m.matchId); }}
                        disabled={onCd}
                        title={onCd ? `Aspetta ${cdLeft}s prima di reagire di nuovo` : "Invia una reazione"}
                      >
                        {onCd ? `⏳ ${cdLeft}s` : "😄 Reagisci"}
                      </button>
                      {open && !onCd && (
                        <div className="arena-react-row" role="menu" aria-label="Reazioni">
                          {ARENA_REACTIONS.map(e => (
                            <button
                              key={e}
                              type="button"
                              className="arena-react-emo"
                              onClick={() => sendArenaReaction(m.matchId, e)}
                              aria-label={`Reagisci con ${e}`}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

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
                      const wsLeft = myPlayer?.wildShapeUsesLeft ?? 1;
                      return (
                        <div className="wild-shape-bar">
                          {wsLeft > 0 ? (
                            <button className="btn-wild-shape" onClick={() => setShowWildPicker(true)}>
                              🐾 Forma Selvatica <span className="action-uses-badge">{wsLeft}/1</span>
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
                      const bonusBlocked = !!myPlayer?.bonusActionUsed;
                      return (
                        <button className="btn-wild-shape" onClick={() => { setLayOfHandsAmt(Math.min(1, maxHeal)); setShowLayOfHandsPicker(true); }}
                          disabled={maxHeal <= 0 || bonusBlocked}
                          title={bonusBlocked ? "Bonus action già usata questo turno" : "Bonus action · cura dalla pozza"}>
                          🙏 Lay of Hands <span className="ws-uses-tag">Bonus · Pozza: {pool} HP{bonusBlocked ? " · ⏳" : ""}</span>
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

                    {/* ── Patto Demoniaco (Warlock) ── */}
                    {(() => {
                      const mySnap = snapshots[currentUser?.uid];
                      const isWarlock = isWarlockClass((mySnap?.class || "").toLowerCase());
                      if (!isWarlock) return null;
                      const pattoAction = (mySnap?.selectedActions || []).find(a => a.special === "patto_demoniaco");
                      if (!pattoAction) return null;
                      const usesLeft = myPlayer?.actionUsesLeft?.[pattoAction.name] ?? pattoAction.maxUses;
                      const noUses = usesLeft <= 0;
                      const pattoT = myPlayer?.pattoTurns ?? 0;
                      if (pattoT > 0) {
                        return <div className="btn-wild-shape" style={{ background: "#7c2d12", color: "#fef9c3" }}>🩸 Patto Attivo · +1d12 spell · {pattoT}t</div>;
                      }
                      if (noUses) return <div className="btn-wild-shape exhausted">🩸 Patto Demoniaco — Esaurito</div>;
                      return (
                        <button
                          className="btn-wild-shape"
                          title="Sacrifica 1d4 PF · per 3 turni le tue spell che colpiscono fanno +1d12 danni"
                          onClick={() => handlePattoDemoniaco(m.matchId, pattoAction)}
                        >
                          🩸 Patto Demoniaco <span className="ws-uses-tag">{usesLeft}/{pattoAction.maxUses} uso</span>
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
                                    {a.special === "web" ? " (TS FOR ogni turno)" : ""}
                                    {a.special === "poison" ? " (TS COS)" : ""}
                                    {a.special === "save_dot" ? ` (TS COS · ${a.saveDotDamage || "1d8"}/turno)` : ""}
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
                    {!pendingDexSave && !pendingConSave && pendingControlSave && (() => {
                      const ctrlAbilityUI = myPlayer?.pendingControlSaveAbility || "wis";
                      const ctrlDcUI      = myPlayer?.pendingControlDC || 13;
                      const ctrlLblUI     = SAVE_LABEL[ctrlAbilityUI] || ctrlAbilityUI.toUpperCase();
                      const ctrlRemaining = myPlayer?.controlLostTurns ?? 0;
                      const isCoronaUI    = pendingControlSave === "corona_pazzia";
                      return (
                        <div className="save-block control control-vivid">
                          <p className="save-block-label">
                            {isCoronaUI
                              ? `🌀 Corona della Pazzia! TS ${ctrlLblUI} (CD ${ctrlDcUI}) — se fallisci attacchi te stesso!`
                              : `🌀 Sotto Controllo! TS ${ctrlLblUI} (CD ${ctrlDcUI}) ogni turno — passa per liberarti, fallisci e perdi il turno${ctrlRemaining > 0 ? ` (${ctrlRemaining} turno/i rimanenti)` : ""}.`}
                          </p>
                          <button className="btn-saving-throw btn-ts-vivid" onClick={() => rollSavingThrow(m.matchId, ctrlAbilityUI, isCoronaUI ? "corona_pazzia" : "control_spell")}>
                            🎲 TS {ctrlLblUI}
                          </button>
                        </div>
                      );
                    })()}

                    {/* ── DoT (Veleno / Fuoco / …) — risolvi prima di agire ── */}
                    {!pendingDexSave && !pendingConSave && !pendingControlSave && !pendingSaveDot && pendingPoisonDoT && (() => {
                      const dotIcon   = myPlayer?.poisonDoTIcon || "☠";
                      const dotNoun   = myPlayer?.poisonDoTNoun || "avvelenato";
                      const dotSource = myPlayer?.poisonDoTSourceLabel || "veleno";
                      return (
                        <div className="save-block con">
                          <p className="save-block-label">{dotIcon} Sei {dotNoun}! Subisci {myPlayer?.poisonDoTDice || "1d6"} danni da {dotSource} ({myPlayer?.poisonDoTTurns ?? 1} turno/i rimanenti) — poi puoi agire.</p>
                          <button className="btn-saving-throw" onClick={() => handleResolvePoisonDoT(m.matchId)}>
                            🎲 Subisci danno da {dotSource}
                          </button>
                        </div>
                      );
                    })()}

                    {/* ── Bleed DoT (Triboli del Ladro) — stack indipendente dal veleno ── */}
                    {!pendingDexSave && !pendingConSave && !pendingControlSave && !pendingSaveDot && !pendingPoisonDoT && pendingBleedDoT && (() => {
                      const dotIcon   = myPlayer?.bleedDoTIcon || "🩸";
                      const dotNoun   = myPlayer?.bleedDoTNoun || "sanguinante";
                      const dotSource = myPlayer?.bleedDoTSourceLabel || "sanguinamento";
                      return (
                        <div className="save-block con">
                          <p className="save-block-label">{dotIcon} Sei {dotNoun}! Subisci {myPlayer?.bleedDoTDice || "1d6"} danni da {dotSource} ({myPlayer?.bleedDoTTurns ?? 1} turno/i rimanenti) — poi puoi agire.</p>
                          <button className="btn-saving-throw" onClick={() => handleResolveBleedDoT(m.matchId)}>
                            🎲 Subisci danno da {dotSource}
                          </button>
                        </div>
                      );
                    })()}

                    {/* ── TS Save-DOT (Raggio Avvelenato) ── */}
                    {!pendingDexSave && !pendingConSave && !pendingControlSave && pendingSaveDot && (() => {
                      const sdAbility = myPlayer?.pendingSaveDot?.ability || "con";
                      const sdDC      = myPlayer?.pendingSaveDot?.dc || 13;
                      const sdName    = myPlayer?.pendingSaveDot?.name || "Veleno";
                      const sdDice    = myPlayer?.pendingSaveDot?.dice || "2d6";
                      const sdTurns   = myPlayer?.pendingSaveDot?.turns ?? 3;
                      const sdLbl     = SAVE_LABEL[sdAbility] || sdAbility.toUpperCase();
                      return (
                        <div className="save-block con">
                          <p className="save-block-label">🤢 {sdName}! TS {sdLbl} (CD {sdDC}) — se fallisci subisci {sdDice} ad inizio turno per {sdTurns} turni.</p>
                          <button className="btn-saving-throw" onClick={() => rollSavingThrow(m.matchId, sdAbility, "save_dot")}>
                            🎲 TS {sdLbl}
                          </button>
                        </div>
                      );
                    })()}

                    {/* ── Tiro Salvezza FOR (liberarsi dalla ragnatela) ── */}
                    {isEntangled && !hasPendingSave && (
                      <div className="save-block str">
                        <p className="save-block-label">🕸 Sei intrappolato nella ragnatela! TS FOR per liberarti (CD 15) — il turno passa.</p>
                        <button className="btn-saving-throw" onClick={() => rollSavingThrow(m.matchId, "str", "str_escape")}>
                          🎲 TS Forza (Liberarsi)
                        </button>
                      </div>
                    )}

                    {isControlLost && !pendingControlSave && isMyTurn && (
                      <div className="save-block control-lost">
                        <p className="save-block-label">🌀 Sei sotto controllo! Salti il turno · {(myPlayer?.controlLostTurns ?? 0)} turno/i rimanenti dopo questo.</p>
                        <button className="btn-saving-throw" onClick={() => skipControlTurn(m.matchId)}>
                          ⏭ Salta Turno
                        </button>
                      </div>
                    )}

                    {/* ── Salta turno se il bersaglio è invisibile ── */}
                    {isMyTurn && !hasPendingSave && !isEntangled && !needsEquip && (() => {
                      const tgt = m.players.find(p => p.id === chosenTargetId);
                      if (!tgt?.invisible) return null;
                      return (
                        <div className="save-block control-lost">
                          <p className="save-block-label">👻 {tgt.name} è invisibile — non puoi colpirlo. Salta il turno.</p>
                          <button className="btn-saving-throw" onClick={() => handleSkipForcedTurn(m.matchId, "invisible")}>
                            ⏭ Salta Turno
                          </button>
                        </div>
                      );
                    })()}

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
                          if (action.special === "patto_demoniaco") return null; // rendered in outer block
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
                            const _casterSnap = arenaMeta.characterSnapshots?.[currentUser.uid];
                            const _dc      = getSpellSaveDC(_casterSnap);
                            const _ability = SAVE_LABEL[parseSpellSaveAbility(action)] || "SAG";
                            return (
                              <button key={action.name} className={`btn-action spell control ${noUses ? "no-uses" : ""}`}
                                disabled={noUses || !chosenTargetId} title={noUses ? "Usi esauriti" : `${action.name} — TS ${_ability} (CD ${_dc}) o perdi 2 turni`}
                                onClick={() => !noUses && chosenTargetId && handleControlSpell(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `TS ${_ability} CD ${_dc}`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "bardic_inspiration") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.bardicInspirationActive;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed && !alreadyActive ? "Bonus action già usata questo turno" : alreadyActive ? "Già attiva" : noUses ? "Cariche esaurite" : "Bonus action · +1d6 al prossimo tiro per colpire"}
                                onClick={() => !blocked && handleBardicInspiration(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attiva" : baUsed ? "⚡ Usata" : noUses ? "Esaurita" : "+1d6 hit"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "magic_detect") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.magicDetectActive;
                            const mdBonusVal  = action.buffBonus  ?? getMagicDetectBonusForClass(mySnap?.class || "");
                            const mdAttacks   = action.buffAttacks ?? 1;
                            const atkLeft     = myPlayer?.magicDetectAttacks ?? (alreadyActive ? 1 : 0);
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? `Attivo (${atkLeft} attacchi rimanenti)` : noUses ? "Cariche esaurite" : `+${mdBonusVal} ai prossimi ${mdAttacks} attacchi`}
                                onClick={() => !noUses && !alreadyActive && handleMagicDetect(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${atkLeft}x` : noUses ? "Esaurito" : `+${mdBonusVal} hit · ${mdAttacks}x`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "concentrate_buff") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = (myPlayer?.concentrationTurns ?? 0) > 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed && !alreadyActive ? "Bonus action già usata questo turno" : alreadyActive ? `Concentrazione attiva (${myPlayer.concentrationTurns} turni)` : noUses ? "Cariche esaurite" : "Bonus action · +4 danni per 2 turni"}
                                onClick={() => !blocked && handleConcentrate(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.concentrationTurns} turni` : baUsed ? "⚡ Usata" : noUses ? "Esaurita" : "+4 dmg · 2 turni"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "absorb_damage") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.absorbDamageNext;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed && !alreadyActive ? "Bonus action già usata questo turno" : alreadyActive ? "Pronto ad assorbire il prossimo colpo" : noUses ? "Cariche esaurite" : "Bonus action · il prossimo danno subito ti cura del 50%"}
                                onClick={() => !blocked && handleAbsorbDamage(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Pronto" : baUsed ? "⚡ Usata" : noUses ? "Esaurita" : "Cura 50% prossimo colpo"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "ki_healing") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed ? "Bonus action già usata questo turno" : noUses ? "Cariche esaurite" : "Bonus action · cura 1d8+SAG HP"}
                                onClick={() => !blocked && handleKiHealing(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{baUsed ? "⚡ Usata" : noUses ? "Esaurita" : "1d8+SAG cura"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "pet_wolf") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || baUsed || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed ? "Bonus action già usata questo turno" : noUses ? "Cariche esaurite" : "Bonus action · 1d8+3 danni"}
                                onClick={() => !blocked && handlePetWolf(m.matchId, chosenTargetId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{baUsed ? "⚡ Usata" : noUses ? "Esaurita" : action.damage}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "pet_spider") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "TS FOR (CD 13): fallisce 2t · supera 1t"}
                                onClick={() => !blocked && handlePetSpider(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurita" : "TS FOR · 1-2t"}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "pet_eagle") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "1d4 + accecato + svantaggio per 3 turni"}
                                onClick={() => !blocked && handlePetEagle(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurita" : `${action.damage} + 🙈`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "pet_drago") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "3d6+3 auto-hit + cura 1d6"}
                                onClick={() => !blocked && handlePetDrago(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurita" : `${action.damage} +💚`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "demon_mephit") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || baUsed || !chosenTargetId;
                            const burnDice = action.burnDice ?? "1d8+2";
                            const burnT    = action.burnTurns ?? 3;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed ? "Bonus action già usata questo turno" : noUses ? "Cariche esaurite" : `Bonus action · brucia: ${burnDice} fuoco per ${burnT} turni`}
                                onClick={() => !blocked && handleDemonMephit(m.matchId, chosenTargetId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{baUsed ? "⚡ Usata" : noUses ? "Esaurita" : `🔥 ${burnDice}×${burnT}t`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "demon_succubus") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "TS CAR (CD 13): fallisce 3t+svant.3t · supera 1t+svant.2t"}
                                onClick={() => !blocked && handleDemonSuccubus(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurita" : "TS CAR · 1-3t + 🌑"}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "demon_greater") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "Drena 2d12 PF · cura il warlock per la stessa quantità"}
                                onClick={() => !blocked && handleDemonGreater(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `${action.damage} ↺💚`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "construct_golem") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "1d8+3 · prossimo colpo subìto dimezzato"}
                                onClick={() => !blocked && handleConstructGolem(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `${action.damage} 🛡½`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "construct_snake") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "1d6+3 + 1d6 veleno per 2 turni"}
                                onClick={() => !blocked && handleConstructSnake(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `${action.damage} ☠`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "armor_forge") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const alreadyActive = (myPlayer?.armorForgeTurns ?? 0) > 0;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? `Forgia attiva (${myPlayer.armorForgeTurns} turni)` : noUses ? "Cariche esaurite" : "+2 CA per 2 turni"}
                                onClick={() => !noUses && !alreadyActive && handleArmorForge(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.armorForgeTurns}t` : noUses ? "Esaurito" : "+2 CA · 2t"}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
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
                                title={alreadyActive ? "Già invisibile" : noUses ? "Usi esauriti" : `Il nemico non può attaccarti per ${action.invisibilityDuration ?? 1} turn${(action.invisibilityDuration ?? 1) === 1 ? "o" : "i"}`}
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
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed && !alreadyActive ? "Bonus action già usata questo turno" : alreadyActive ? "Già attivo" : noUses ? "Usi esauriti" : "Bonus action · azione extra questo turno"}
                                onClick={() => !blocked && handleActionSurge(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attivo" : baUsed ? "⚡ Usata" : noUses ? "Esaurito" : "+1 azione"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "rage") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = (myPlayer?.rageTurns ?? 0) > 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed && !alreadyActive ? "Bonus action già usata questo turno" : alreadyActive ? "Furia già attiva" : noUses ? "Cariche esaurite" : "Bonus action · +2 danno armi per 3 turni"}
                                onClick={() => !blocked && handleRage(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.rageTurns} turni` : baUsed ? "⚡ Usata" : noUses ? "Esaurita" : "+2 danno · 3 turni"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "hunter_mark") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = (myPlayer?.hunterMarkTurns ?? 0) > 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed && !alreadyActive ? "Bonus action già usata questo turno" : alreadyActive ? "Marchio già attivo" : noUses ? "Cariche esaurite" : "Bonus action · +3 ai tiri per colpire per 3 turni"}
                                onClick={() => !blocked && handleHunterMark(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.hunterMarkTurns} turni` : baUsed ? "⚡ Usata" : noUses ? "Esaurito" : "+3 hit · 3 turni"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "weapon_lock") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action spell ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : `Il nemico non potrà attaccare con armi per ${action.weaponLockTurns ?? 2} turni`}
                                onClick={() => !blocked && handleWeaponLock(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `🔒 armi · ${action.weaponLockTurns ?? 2}t`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "disadvantage_enemy") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action spell ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : `Svantaggio agli attacchi del nemico per ${action.disadvantageTurns ?? 3} turni`}
                                onClick={() => !blocked && handleDisadvEnemy(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `🌑 svant. · ${action.disadvantageTurns ?? 3}t`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "self_advantage") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = (myPlayer?.selfAdvTurns ?? 0) > 0;
                            const advTurns = action.advantageTurns ?? 2;
                            return (
                              <button key={action.name}
                                className={`btn-action spell ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? `Già attivo (${myPlayer.selfAdvTurns} turni rimanenti)` : noUses ? "Cariche esaurite" : `Vantaggio ai prossimi ${advTurns} attacchi`}
                                onClick={() => !noUses && !alreadyActive && handleSelfAdvantage(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.selfAdvTurns}t` : noUses ? "Esaurito" : `🌟 vant. · ${advTurns}t`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "extra_turn") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.extraTurnActive;
                            return (
                              <button key={action.name}
                                className={`btn-action spell ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? "Già attivo" : noUses ? "Cariche esaurite" : "Doppio turno il prossimo turno"}
                                onClick={() => !noUses && !alreadyActive && handleExtraTurn(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attivo" : noUses ? "Esaurito" : "+1 azione"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "save_buff") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = (myPlayer?.saveBuffAttacks ?? 0) > 0;
                            return (
                              <button key={action.name}
                                className={`btn-action spell ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? `Attivo (${myPlayer.saveBuffAttacks} TS rimanenti)` : noUses ? "Cariche esaurite" : `+${action.tsBonus ?? 3} ai prossimi ${action.tsAttacks ?? 3} TS`}
                                onClick={() => !noUses && !alreadyActive && handleSaveBuff(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.saveBuffAttacks} TS` : noUses ? "Esaurito" : `+${action.tsBonus ?? 3} TS · ${action.tsAttacks ?? 3}x`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "save_dot") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            const _casterSnap = arenaMeta.characterSnapshots?.[currentUser.uid];
                            const _dc      = action.saveDotDC ?? getSpellSaveDC(_casterSnap);
                            const _ability = SAVE_LABEL[action.saveDotAbility || "con"];
                            return (
                              <button key={action.name}
                                className={`btn-action spell ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : `${action.saveDotDamage || "2d6"} a inizio turno · TS ${_ability} CD ${_dc}`}
                                onClick={() => !blocked && handleSaveDotSpell(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `TS ${_ability} · ${action.saveDotDamage || "2d6"}/turno`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "shield_buff") {
                            const sbBonus = action.shieldBuffBonus ?? 3;
                            const sbTurns = action.shieldBuffTurns ?? 3;
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            return (
                              <button key={action.name} className={`btn-action skill ${noUses ? "no-uses" : ""}`}
                                disabled={noUses}
                                title={noUses ? "Cariche esaurite" : `+${sbBonus} CA per ${sbTurns} turni`}
                                onClick={() => !noUses && handleShieldSkill(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `+${sbBonus} CA · ${sbTurns}t`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "aid_buff") {
                            const usesLeft = action.maxUses !== undefined ? (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses) : null;
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.aidBuff;
                            const aidBonusVal = getAidBonusForClass(mySnap?.class || "");
                            return (
                              <button key={action.name} className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? "Già attivo" : noUses ? "Usi esauriti" : `+${aidBonusVal} al prossimo tiro per colpire`}
                                onClick={() => !noUses && !alreadyActive && handleAidBuff(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attivo" : noUses ? "Esaurito" : `+${aidBonusVal} hit`}</span>
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
                          const stealthTurnsLeft = action.special === "stealth" ? readStealthAnyTurns(myPlayer) : 0;
                          const isStealthActive = stealthTurnsLeft > 0;
                          // 🗡 Ladro: una sola arma per mano e una sola abilità (Furtivo/Triboli) a turno.
                          const isRogueMe = isRogueClass((mySnap?.class || "").toLowerCase());
                          const handUsedThisTurn = isRogueMe && isWeapon && isEquipped && (myPlayer?.turnWeaponsUsed || []).includes(action.name);
                          const skillSlotUsed = isRogueMe && (action.special === "sneak_attack" || action.special === "triboli") && !!myPlayer?.turnSkillUsed;
                          const rogueBlocked = handUsedThisTurn || skillSlotUsed;
                          return (
                            <button
                              key={action.name}
                              className={`btn-action ${action.type} ${isWeapon && !wildShapeForm ? (isEquipped ? "equipped" : "unequipped") : ""} ${noUsesLeft || disabledByInvis || isStealthActive || rogueBlocked ? "no-uses" : ""} ${isDeathblow ? "deathblow-ready" : ""} ${action.special === "smite" && !noUsesLeft ? "smite-active" : ""} ${isStealthActive ? "stealth-active" : ""}`}
                              disabled={noUsesLeft || disabledByInvis || isStealthActive || rogueBlocked}
                              title={isStealthActive
                                ? `🌑 Furtività attiva — ${stealthTurnsLeft} turno/i rimasti`
                                : handUsedThisTurn
                                ? "🗡 Arma già usata questo turno — usa l'altra mano"
                                : skillSlotUsed
                                ? "🗡 Abilità già usata questo turno (1 tra Attacco Furtivo / Triboli)"
                                : noUsesLeft
                                ? `${action.name} — Usi esauriti`
                                : disabledByInvis ? "👻 Bersaglio invisibile — solo guarigione disponibile"
                                : action.special === "web" ? "Ragnatela — intrappola: TS FOR (CD 13) ogni turno per liberarsi"
                                : action.special === "triboli" ? "Triboli — svantaggio + sanguinamento 1d6/turno per 3 turni"
                                : action.special === "poison" ? `Veleno — ${action.damage} danni + TS COS`
                                : action.special === "deathblow" ? `Colpo Mortale — ${action.damage} +DES (solo ≤20% HP)`
                                : action.special === "stealth" ? `Furtività — vantaggio ai tuoi prossimi 3 attacchi`
                                : !isEquipped ? "Clicca per impugnare (spende il turno)"
                                : `+${action.hitBonus}${action.statKey ? ` +${action.statKey.toUpperCase()}` : ""} | ${action.damage}${action.statKey ? ` +${action.statKey.toUpperCase()}` : ""}`}
                              onClick={() => {
                                if (noUsesLeft || disabledByInvis || isStealthActive || rogueBlocked) return;
                                isEquipped
                                  ? handleAttack(m.matchId, chosenTargetId, action)
                                  : handleSwitchWeapon(m.matchId, action.name);
                              }}
                            >
                              <span className="action-icon">{action.icon}</span>
                              <span className="action-name">{action.name}</span>
                              <span className="action-dice">
                                {isStealthActive ? `🌑 ${stealthTurnsLeft}t attiva`
                                  : handUsedThisTurn ? "✓ Usata"
                                  : skillSlotUsed ? "✓ Abilità usata"
                                  : noUsesLeft ? "Esaurito"
                                  : disabledByInvis ? "👻 Invisibile"
                                  : !isEquipped ? "🔄 Cambia"
                                  : action.special === "web" ? "🕸 Intrappola"
                                  : action.special === "triboli" ? "🩸 Sang. 3t · svant."
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

                    {/* ── Indicatore multi-azione (Monaco x3, Ladro x3) ── */}
                    {!hasPendingSave && (() => {
                      const maxActs = getMaxActionsPerTurn(mySnap, myPlayer);
                      if (maxActs <= 1) return null;
                      const used = myPlayer?.multiActionsUsed ?? 0;
                      const isMonk = isMonkClass((mySnap?.class || "").toLowerCase());
                      const label = isMonk ? "🥋 Stile Monaco" : "🗡 Doppie Lame";
                      const canEndEarly = used >= 1;
                      return (
                        <div className="dual-action-row">
                          <span className="dual-action-label">
                            {label} · Azione {used + 1} / {maxActs}
                          </span>
                          {canEndEarly && (
                            <button
                              className="btn-end-dual-turn"
                              onClick={() => endMultiActionTurn(m.matchId)}
                              title="Salta le azioni rimanenti e termina il turno"
                            >
                              ⏭ Termina Turno
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Salta turno (disponibile per tutti, in qualsiasi arena) ── */}
                    {!hasPendingSave && (myPlayer?.multiActionsUsed ?? 0) === 0 && (
                      <div className="dual-action-row">
                        <button
                          className="btn-end-dual-turn"
                          onClick={() => handleSkipTurn(m.matchId)}
                          title="Passa il turno senza fare nulla"
                        >
                          ⏭ Salta Turno
                        </button>
                      </div>
                    )}

                    {/* ── Oggetti (Azione Gratuita · 1/turno) ── */}
                    {!hasPendingSave && (() => {
                      const myItemKeys = arenaMeta.characterSnapshots?.[currentUser?.uid]?.selectedItemKeys || [];
                      if (myItemKeys.length === 0) return null;
                      const myItemUsesLeft = myPlayer?.itemUsesLeft || {};
                      const itemCountsInSnap = {};
                      myItemKeys.forEach(k => { itemCountsInSnap[k] = (itemCountsInSnap[k] || 0) + 1; });
                      const itemUsed = !!myPlayer?.itemUsedThisTurn;
                      return (
                        <div className="items-row">
                          {Object.entries(itemCountsInSnap).map(([key]) => {
                            const item   = ARENA_ITEMS.find(i => i.key === key);
                            if (!item) return null;
                            const uses   = myItemUsesLeft[key] ?? 0;
                            const total  = itemCountsInSnap[key];
                            const needsTarget = key === "bomba" || key === "pozione_veleno";
                            const disabled    = uses <= 0 || (needsTarget && !chosenTargetId) || itemUsed;
                            const titleStr = itemUsed ? "Oggetto già usato questo turno" : `${item.info} · azione gratuita (1/turno)`;
                            return (
                              <button key={key}
                                className={`btn-item bonus-action ${uses <= 0 || itemUsed ? "no-uses" : ""}`}
                                disabled={disabled}
                                title={titleStr}
                                onClick={() => useItem(m.matchId, key, needsTarget ? chosenTargetId : null)}>
                                <span className="bonus-action-tag">🆓 Gratis</span>
                                <span className="item-icon">{item.icon}</span>
                                <span className="item-name">{item.name}</span>
                                <span className="item-uses">{itemUsed ? "⏳" : `${uses}/${total}`}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="match-log">
                  <div className="match-log-head">
                    <span className="match-log-icon" aria-hidden="true">📜</span>
                    <span className="match-log-title">Cronaca dello Scontro</span>
                    <span className="match-log-count">{(m.logs || []).length} {(m.logs || []).length === 1 ? "evento" : "eventi"}</span>
                  </div>
                  <div className="match-log-scroll">
                    {[...(m.logs || [])].reverse().map((l, i) => {
                      const text = displayLog(l, currentUser?.uid);
                      const isLatest = i === 0;
                      const isAttLog = typeof l === 'object' && l.attId === currentUser?.uid;
                      const isDefLog = typeof l === 'object' && l.defId === currentUser?.uid;
                      const ts = typeof l === 'object' && l.ts
                        ? new Date(l.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : null;
                      return (
                        <p key={i} className={`log-entry ${isLatest ? "latest" : ""} ${isAttLog ? "log-attacker" : ""} ${isDefLog ? "log-defender" : ""}`}>
                          {ts && <span className="log-ts">{ts}</span>}
                          {text}
                        </p>
                      );
                    })}
                    {(m.logs || []).length === 0 && (
                      <p className="match-log-empty">— Il combattimento non è ancora iniziato —</p>
                    )}
                  </div>
                </div>

                {/* Arena Libera: bottone abbandono / chiudi */}
                {m.kind === "fun" && m.status !== "finished" && (
                  <button className="btn-fun-abandon" onClick={() => abandonFunMatch(m.matchId)}>
                    🏳 Abbandona Sfida
                  </button>
                )}
                {m.kind === "fun" && m.status === "finished" && (
                  <button className="btn-fun-remove-inline" onClick={() => removeFunMatch(m.matchId)}>
                    ✕ Chiudi e rimuovi
                  </button>
                )}
              </div>
            );
          })}
        </div>
        </ArenaModal>
      )}

    </div>
  );
}

// ── Master tournament class stats ───────────────────────────────────────────
const CLASS_ICONS = {
  fighter: "⚔", guerriero: "⚔",
  barbarian: "🪓", barbaro: "🪓",
  paladin: "🛡", paladino: "🛡",
  ranger: "🏹", pattugliatore: "🏹",
  monk: "👊", monaco: "👊",
  rogue: "🗡", ladro: "🗡",
  wizard: "🧙", mago: "🧙",
  sorcerer: "🔥", stregone: "🔥",
  warlock: "👁",
  druid: "🌿", druido: "🌿",
  cleric: "✨", chierico: "✨",
  bard: "🎵", bardo: "🎵",
};

function HallOfChampions({ champions, isMaster, onRemove }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hall-of-champions">
      <button className="hall-toggle" onClick={() => setOpen(v => !v)}>
        {open ? "▲" : "▼"} 🏆 Sala dei Campioni <span className="hall-count">({champions.length})</span>
      </button>
      {open && (
        <div className="hall-body">
          {champions.length === 0 ? (
            <p className="hall-empty">Nessun campione ancora. Vinci un torneo per entrare nella Sala.</p>
          ) : (
            <div className="hall-list">
              {champions.map((c, i) => (
                <div key={c.uid} className="hall-row">
                  <div className="hall-rank">#{i + 1}</div>
                  {c.image ? <img src={c.image} alt="" className="hall-avatar" /> : <div className="hall-avatar placeholder">{CLASS_ICONS[c.class] || "♛"}</div>}
                  <div className="hall-info">
                    <div className="hall-name">{c.name || "Campione"}</div>
                    {c.class && <div className="hall-class">{CLASS_ICONS[c.class] || "❔"} {c.class}</div>}
                  </div>
                  <div className="hall-wins" title={`${c.wins} vittorie`}>
                    <span className="hall-wins-num">{c.wins}</span>
                    <span className="hall-wins-label">{c.wins === 1 ? "vittoria" : "vittorie"}</span>
                  </div>
                  {isMaster && (
                    <button className="hall-remove" title="Rimuovi dalla Sala (solo master)" onClick={() => onRemove(c.uid)}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TournamentClassStats({ liveTournament, onSync, forceOpen = false }) {
  /* FIX: P5c — forceOpen renders body unconditionally (used inside modal) */
  const [openState, setOpen] = useState(false);
  const open                  = forceOpen || openState;
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded]   = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  useEffect(() => {
    if (!open) return;
    const unsub = onSnapshot(collection(db, "arena_tournament_history"), (snap) => {
      setHistory(snap.docs.map(d => d.data()));
      setLoaded(true);
    });
    return () => unsub();
  }, [open]);

  const { top, totalTournaments, totalPart, totalMatches, includesLive } = useMemo(() => {
    const perClass = {};
    let totalPartLocal = 0;
    let totalMatchesLocal = 0;
    const dataset = [...history];
    if (liveTournament) dataset.push(liveTournament);
    dataset.forEach(t => {
      (t.participants || []).forEach(p => {
        const cls = (p.class || "").toLowerCase().trim();
        if (!cls) return;
        const played = (p.matchWins ?? 0) + (p.matchLosses ?? 0);
        perClass[cls] = perClass[cls] || { uses: 0, matches: 0, wins: 0 };
        perClass[cls].uses++;
        perClass[cls].matches += played;
        perClass[cls].wins    += (p.matchWins ?? 0);
        totalPartLocal++;
        totalMatchesLocal += played;
      });
    });
    const arr = Object.entries(perClass).map(([cls, v]) => ({
      cls,
      uses:    v.uses,
      matches: v.matches,
      wins:    v.wins,
      usage:   totalPartLocal > 0 ? (v.uses / totalPartLocal) * 100 : 0,
      winrate: v.matches > 0 ? (v.wins / v.matches) * 100 : 0,
    }));
    arr.sort((a, b) => b.uses - a.uses || b.wins - a.wins);
    return {
      top: arr.slice(0, 5),
      totalTournaments: history.length + (liveTournament ? 1 : 0),
      totalPart: totalPartLocal,
      totalMatches: totalMatchesLocal,
      includesLive: !!liveTournament,
    };
  }, [history, liveTournament]);

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  return (
    <div className={`class-stats-section${forceOpen ? " in-modal" : ""}`}>
      {!forceOpen && (
        <button className="class-stats-toggle" onClick={() => setOpen(v => !v)}>
          {open ? "▲" : "▼"} 📊 Statistiche Classi — Torneo / Campioni
        </button>
      )}
      {open && (
        <div className="class-stats-body">
          {!loaded ? (
            <p className="class-stats-empty">Caricamento…</p>
          ) : totalPart === 0 ? (
            <p className="class-stats-empty">Nessun torneo archiviato ancora. Le statistiche compariranno dopo il primo torneo concluso.</p>
          ) : (
            <>
              <div className="class-stats-meta">
                <span>🏆 Tornei {includesLive ? "(incluso quello in corso)" : "archiviati"}: <strong>{totalTournaments}</strong></span>
                <span>👥 Partecipazioni: <strong>{totalPart}</strong></span>
                <span>⚔ Match giocati: <strong>{totalMatches}</strong></span>
                {includesLive && <span className="class-stats-live-badge">🔴 LIVE</span>}
                {onSync && (
                  <button
                    className="class-stats-sync-btn"
                    disabled={syncing}
                    onClick={async () => {
                      setSyncing(true);
                      setSyncMsg(null);
                      const added = await onSync();
                      setSyncing(false);
                      if (added < 0)       setSyncMsg("❌ Errore sync");
                      else if (added === 0) setSyncMsg("✓ Già aggiornate");
                      else                 setSyncMsg(`✓ +${added / 2} match recuperati`);
                      setTimeout(() => setSyncMsg(null), 4000);
                    }}
                    title="Forza sincronizzazione storico match"
                  >
                    {syncing ? "…" : "🔄 Ricalcola"}
                  </button>
                )}
                {syncMsg && <span className="class-stats-sync-msg">{syncMsg}</span>}
              </div>
              <div className="class-stats-list">
                {top.map((row, i) => (
                  <div key={row.cls} className="class-stats-row">
                    <div className="class-stats-rank">#{i + 1}</div>
                    <div className="class-stats-icon">{CLASS_ICONS[row.cls] || "❔"}</div>
                    <div className="class-stats-name">{capitalize(row.cls)}</div>
                    <div className="class-stats-bars">
                      <div className="class-stats-bar-row">
                        <span className="class-stats-bar-label">Uso</span>
                        <div className="class-stats-bar-track">
                          <div className="class-stats-bar-fill usage" style={{ width: `${row.usage}%` }} />
                        </div>
                        <span className="class-stats-bar-val">{row.usage.toFixed(0)}% <em>({row.uses})</em></span>
                      </div>
                      <div className="class-stats-bar-row">
                        <span className="class-stats-bar-label">Win</span>
                        <div className="class-stats-bar-track">
                          <div className="class-stats-bar-fill winrate" style={{ width: `${row.winrate}%` }} />
                        </div>
                        <span className="class-stats-bar-val">{row.winrate.toFixed(0)}% <em>({row.wins}/{row.matches})</em></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Statistiche classi Arena Libera (basate su funMatchHistory) ─────────────
function FunArenaClassStats({ funHistory, currentMatches, isMaster, onReset, forceOpen = false }) {
  /* FIX: P5c — forceOpen renders body unconditionally (used inside modal) */
  const [openState, setOpen] = useState(false);
  const open = forceOpen || openState;
  const [resetting, setResetting] = useState(false);

  const { top, totalMatches, livePending } = useMemo(() => {
    const perClass = {};
    let totalLocal = 0;
    let liveLocal  = 0;

    // History archiviata
    (funHistory || []).forEach(h => {
      const w = h.winnerClass;
      const l = h.loserClass;
      if (w) {
        perClass[w] = perClass[w] || { uses: 0, wins: 0 };
        perClass[w].uses++;
        perClass[w].wins++;
      }
      if (l) {
        perClass[l] = perClass[l] || { uses: 0, wins: 0 };
        perClass[l].uses++;
      }
      if (w || l) totalLocal++;
    });

    // Match fun ancora in arena_meta non ancora archiviati
    const archived = new Set((funHistory || []).map(h => h.matchId));
    (currentMatches || []).forEach(m => {
      if (m.kind !== "fun" || m.status !== "finished" || !m.players || m.players.length < 2) return;
      if (archived.has(m.matchId)) return;
      const winnerP = m.players.find(p => p.id === m.winner);
      const loserP  = m.players.find(p => p.id !== m.winner);
      const w = (winnerP?.class || "").toLowerCase().trim();
      const l = (loserP?.class  || "").toLowerCase().trim();
      if (w) {
        perClass[w] = perClass[w] || { uses: 0, wins: 0 };
        perClass[w].uses++;
        perClass[w].wins++;
      }
      if (l) {
        perClass[l] = perClass[l] || { uses: 0, wins: 0 };
        perClass[l].uses++;
      }
      if (w || l) { totalLocal++; liveLocal++; }
    });

    const arr = Object.entries(perClass).map(([cls, v]) => ({
      cls,
      uses:    v.uses,
      wins:    v.wins,
      usage:   totalLocal > 0 ? (v.uses / (totalLocal * 2)) * 100 : 0,
      winrate: v.uses > 0 ? (v.wins / v.uses) * 100 : 0,
    }));
    arr.sort((a, b) => b.uses - a.uses || b.wins - a.wins);
    return { top: arr.slice(0, 8), totalMatches: totalLocal, livePending: liveLocal };
  }, [funHistory, currentMatches]);

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  return (
    <div className={`class-stats-section fun-class-stats${forceOpen ? " in-modal" : ""}`}>
      {!forceOpen && (
        <button className="class-stats-toggle fun" onClick={() => setOpen(v => !v)}>
          {open ? "▲" : "▼"} 🛡 Statistiche Classi — Arena Libera
        </button>
      )}
      {open && (
        <div className="class-stats-body">
          {totalMatches === 0 ? (
            <p className="class-stats-empty">Nessuna sfida libera conclusa ancora. Le statistiche compariranno dopo la prima sfida finita.</p>
          ) : (
            <>
              <div className="class-stats-meta">
                <span>⚔ Sfide concluse: <strong>{totalMatches}</strong></span>
                {livePending > 0 && <span className="class-stats-live-badge fun">🔴 {livePending} in attesa archivio</span>}
                {isMaster && onReset && (
                  <button
                    className="class-stats-sync-btn fun"
                    disabled={resetting}
                    onClick={async () => {
                      if (!window.confirm("Azzerare lo storico delle Sfide Libere? L'azione non è reversibile.")) return;
                      setResetting(true);
                      await onReset();
                      setResetting(false);
                    }}
                    title="Cancella tutto lo storico Arena Libera"
                  >
                    {resetting ? "…" : "♻ Azzera"}
                  </button>
                )}
              </div>
              <div className="class-stats-list">
                {top.map((row, i) => (
                  <div key={row.cls} className="class-stats-row">
                    <div className="class-stats-rank">#{i + 1}</div>
                    <div className="class-stats-icon">{CLASS_ICONS[row.cls] || "❔"}</div>
                    <div className="class-stats-name">{capitalize(row.cls)}</div>
                    <div className="class-stats-bars">
                      <div className="class-stats-bar-row">
                        <span className="class-stats-bar-label">Uso</span>
                        <div className="class-stats-bar-track">
                          <div className="class-stats-bar-fill usage fun" style={{ width: `${row.usage}%` }} />
                        </div>
                        <span className="class-stats-bar-val">{row.usage.toFixed(0)}% <em>({row.uses})</em></span>
                      </div>
                      <div className="class-stats-bar-row">
                        <span className="class-stats-bar-label">Win</span>
                        <div className="class-stats-bar-track">
                          <div className="class-stats-bar-fill winrate fun" style={{ width: `${row.winrate}%` }} />
                        </div>
                        <span className="class-stats-bar-val">{row.winrate.toFixed(0)}% <em>({row.wins}/{row.uses})</em></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
