import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import "./style.css";

// AUTH & CONTEXT
import { AuthProvider, useAuth } from "./AuthContext";
import LoginDropdown from "./LoginDropdown";

// FIREBASE
import { db } from "./firebase";
import {
  doc, updateDoc, setDoc, onSnapshot, collection,
  serverTimestamp,
} from "firebase/firestore";
import { isHiddenChar } from "./data/hiddenPlayers";

// PAGES

import Home from "./pages/Home";
import Party from "./pages/Party";
import Notifications from "./pages/Notifications";
import Riassunti from "./pages/Riassunti";
import RiassuntoSingolo from "./pages/RiassuntoSingolo";
import SessionDetail from "./pages/SessionDetail";
import GenerateSession from "./pages/GenerateSession";
import Mercato from "./pages/Mercato";
import Geo from "./pages/Geo";
import ItemDetail from "./pages/ItemDetail";
import AdminPanel from "./pages/AdminPanel";
import MarketAdmin from "./pages/MarketAdmin";
import SummaryAdmin from "./pages/SummaryAdmin";
import LoScribaAdmin from "./pages/LoScribaAdmin";
import Scriba from "./pages/Scriba";
import ScribaSingolo from "./pages/ScribaSingolo";
import Almanacco from "./pages/Almanacco";
import SchedaPG from "./pages/SchedaPG";
import PlatinumAdmin from "./pages/PlatinumAdmin";
import RattiLore from "./pages/RattiLore";
import Diario from "./pages/Diario";
import Bacheca from "./pages/Bacheca";
import QuestAdmin from "./pages/QuestAdmin";
import QuestDetail from "./pages/QuestDetail";
import ReputationAdmin from "./pages/ReputazioneAdmin";
import VideoAdmin from "./pages/VideoAdmin";
import Cinema from "./pages/Cinema";
import Tarocchi from "./pages/Tarocchi";
import GeoAdmin from "./pages/GeoAdmin";
import WorldMap from "./pages/WorldMap";
import AdminSessions from "./pages/AdminSessions";
import WorldBoss from "./pages/WorldBoss";
import WorldBossAdmin from "./pages/WorldBossAdmin";
import Arena from "./pages/Arena";
import ArenaMarket from "./pages/ArenaMarket";
import BossTactics from "./pages/tactics/BossTactics";
import BattleMapEditor from "./pages/tactics/BattleMapEditor";
import DmTools from "./pages/DmTools";
import Assistente from "./pages/Assistente";
import Concilio from "./pages/Concilio";
// PET SYSTEM — temporarily disabled. Re-enable by uncommenting these
// imports and the matching nav link / routes below.
// import PetArena from "./pages/PetArena";
// import PetHub from "./pages/PetHub";
import Tcg from "./pages/Tcg";
import { isTcgUnlockedFor } from "./tcg/access";
import Crafting from "./pages/Crafting";
import PetPointsAdmin from "./pages/PetPointsAdmin";
import NPC from "./pages/NPC";
import GeneraNPC from "./GeneraNPC";
import FoundryItemForm from "./pages/FoundryItemForm";
import FoundryNpcForm from "./pages/FoundryNpcForm";
import Feedback from "./pages/Feedback";
import Updates from "./pages/Updates";
import SendNotification from "./components/SendNotification";
import NotificationOptIn from "./components/NotificationOptIn";
import FirestoreErrorGuard from "./components/FirestoreErrorGuard";
import CovoOverlay from "./components/CovoOverlay";
import PlayerSpritesAdmin from "./pages/PlayerSpritesAdmin";
import DiceRollHost from "./components/DiceRoll";

// CONFIG
const MASTER_EMAIL_UI = "santomassimo85@gmail.com";

// I CINQUE RESPIRI del drago (tema del sito, html[data-soffio]): Fuoco, Gelo,
// Arcano (viola), Veleno (drago verde), Bianco (drago bianco = tema chiaro).
const SOFFI = [
  { key: "fuoco",  label: "Fuoco",  title: "Drago rosso: braci",          d: "M8 1c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s0 2 1.5 2C7 6 6 4 8 1z" },
  { key: "gelo",   label: "Gelo",   title: "Drago blu: cristalli",        d: "M7.3 1h1.4v3.2l2-1.2.7 1.2-2.7 1.6V8l2.3 1.3 2-1.2.7 1.2-1.6.9 2.5 1.5-.7 1.2-2.6-1.5v2l-1.4.1v-3.1L8.7 9.1v2.7l2 1.2-.7 1.2L8 13.1 6.3 14.2l-.7-1.2 2-1.2V9.1l-1.3-.7v3.1L4.9 11.6v-2L2.3 11.1l-.7-1.2 2.5-1.5-1.6-.9.7-1.2 2 1.2L7.3 6.3V4.6L4.6 4.2l.7-1.2 2 1.2z" },
  { key: "arcano", label: "Arcano", title: "Drago arcano: scintille viola", d: "M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" },
  { key: "veleno", label: "Veleno", title: "Drago verde: spore",           d: "M13 2c-6 0-10 3-10 9 0 1 .2 2 .6 3 .9-3 3-6 6.4-8-2.5 2.5-4 5-4.6 8 1 .3 2 .5 3 .5 5 0 6-5 4.6-12.5z" },
  { key: "bianco", label: "Bianco", title: "Drago bianco: la tana alla luce", d: "M8 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM7.3 0h1.4v2.6H7.3zM7.3 13.4h1.4V16H7.3zM0 7.3h2.6v1.4H0zM13.4 7.3H16v1.4h-2.6zM2.3 3.3l1-1 1.8 1.8-1 1zM10.9 11.9l1-1 1.8 1.8-1 1zM2.3 12.7l1.8-1.8 1 1-1.8 1.8zM10.9 4.1l1.8-1.8 1 1-1.8 1.8z" },
];
const APP_VERSION = "2.2.1"; // <--- CAMBIA QUESTO NUMERO PER FORZARE IL REFRESH GLOBALE

// --- Dropdown menu component ---
function NavDropdown({ label, children, closeAll, id, openId, setOpenId }) {
  // Modalità "fisarmonica" se controllato (id + setOpenId): un solo menu aperto per volta.
  const controlled = id !== undefined && typeof setOpenId === "function";
  const [openU, setOpenU] = useState(false);
  const open = controlled ? openId === id : openU;
  const setOpen = (v) => {
    const next = typeof v === "function" ? v(open) : v;
    if (controlled) setOpenId(next ? id : null);
    else setOpenU(next);
  };
  const ref = useRef(null);

  // Click-fuori: solo in modalità NON controllata. In accordion (controllato)
  // se ne occupa un singolo listener nel padre, altrimenti i fratelli si
  // interferiscono e il re-click non chiude il sottomenu.
  useEffect(() => {
    if (controlled) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpenU(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [controlled]);

  const handleChildClick = () => {
    setOpen(false);
    closeAll();
  };

  return (
    <div className={`nav-dd${open ? " nav-dd--open" : ""}`} ref={ref}>
      <button
        className="nav-dd-trigger"
        data-dd={id}
        onClick={() => setOpen((v) => !v)}
      >
        {label} <span className="nav-dd-arrow">▾</span>
      </button>
      <div className="nav-dd-menu">
        {React.Children.map(children, (child) =>
          child
            ? React.cloneElement(child, { onClick: handleChildClick })
            : null
        )}
      </div>
    </div>
  );
}

// Elenco dei co-master: hanno accesso agli strumenti DM ma non al pannello admin completo.
const CO_MASTER_EMAILS = ["ripperti96@gmail.com"];
const isDmUser = (email) => email === MASTER_EMAIL_UI || CO_MASTER_EMAILS.includes(email);

// --- Link al Generatore NPC (master + co-master) ---
const NpcGenNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (!isDmUser(currentUser?.email)) return null;
  return (
    <NavLink to="/dm-admin/genera-npc" onClick={closeMenu} style={({ isActive }) => ({ color: isActive ? "#fff" : "var(--red)", fontWeight: 700 })}>
      Genera NPC
    </NavLink>
  );
};
// --- Link agli strumenti DM (master + co-master) ---
const DmToolsNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (!isDmUser(currentUser?.email)) return null;
  return <NavLink to="/dm-admin/strumenti" onClick={closeMenu} style={({ isActive }) => ({ color: isActive ? "#fff" : "var(--red)", fontWeight: 700 })}>Strumenti DM</NavLink>;
};

// --- Link al form "Crea Oggetto → Foundry" (master + co-master) ---
const FoundryItemNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (!isDmUser(currentUser?.email)) return null;
  return <NavLink to="/dm-admin/foundry-item" onClick={closeMenu} style={({ isActive }) => ({ color: isActive ? "#fff" : "var(--red)", fontWeight: 700 })}>Oggetto → Foundry</NavLink>;
};

// --- Menu raggruppato "DM Tools" (master + co-master) ---
const DmToolsDropdown = ({ closeMenu, openId, setOpenId }) => {
  const { currentUser } = useAuth();
  if (!isDmUser(currentUser?.email)) return null;
  return (
    <NavDropdown label="DM Tools" closeAll={closeMenu} id="dmtools" openId={openId} setOpenId={setOpenId}>
      <NavLink to="/dm-admin/genera-npc">Genera NPC</NavLink>
      <NavLink to="/dm-admin/strumenti">Strumenti DM</NavLink>
      <NavLink to="/dm/generate-session">Genera Sessione</NavLink>
      <NavLink to="/dm-admin/foundry-item">Oggetto → Foundry</NavLink>
      <NavLink to="/dm-admin/foundry-npc">NPC → Foundry</NavLink>
    </NavDropdown>
  );
};

// --- Link "Agenti" (Il Concilio) — solo Master, voce di primo livello ---
const ConcilioNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (currentUser?.email !== MASTER_EMAIL_UI) return null;
  return (
    <NavLink
      to="/agenti"
      className={({ isActive }) => isActive ? "active admin-link admin-link-red" : "admin-link admin-link-red"}
      onClick={closeMenu}
      style={{ backgroundColor: "var(--red)", color: "#ffe7a8", fontWeight: "bold" }}
      title="Il Concilio — i tuoi agenti AI"
    >
      🜂 AGENTI
    </NavLink>
  );
};

// --- Componente Link Admin Condizionale ---
const AdminNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (currentUser?.email === MASTER_EMAIL_UI) {
    return (
      <NavLink
        to="/dm-admin"
        className={({ isActive }) => isActive ? "active admin-link admin-link-red" : "admin-link admin-link-red"}
        onClick={closeMenu}
        style={{ backgroundColor: "var(--red)", color: "#ffe7a8", fontWeight: "bold" }}
      >
        DM ADMIN
      </NavLink>
    );
  }
  return null;
};

// --- Link DM dedicati al co-master (summaries + black market) ---
const SummaryAdminNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (!CO_MASTER_EMAILS.includes(currentUser?.email)) return null;
  const linkStyle = { backgroundColor: "var(--gold)", color: "var(--red)", fontWeight: "bold" };
  return (
    <>
      <NavLink
        to="/dm-admin/summaries"
        className={({ isActive }) => isActive ? "active admin-link" : "admin-link"}
        onClick={closeMenu}
        style={linkStyle}
      >
        RIASSUNTI
      </NavLink>
      <NavLink
        to="/dm-admin/market"
        className={({ isActive }) => isActive ? "active admin-link" : "admin-link"}
        onClick={closeMenu}
        style={linkStyle}
      >
        MARKET
      </NavLink>
      <NavLink
        to="/dm/generate-session"
        className={({ isActive }) => isActive ? "active admin-link" : "admin-link"}
        onClick={closeMenu}
        style={linkStyle}
      >
        GENERA SESSIONE
      </NavLink>
    </>
  );
};

// --- TCG nav link — hidden while the page is locked unless the
//     current account is on the TCG allow-list (master, testers). ---
const TcgNavLink = ({ onClick }) => {
  const { currentUser } = useAuth();
  if (!isTcgUnlockedFor(currentUser?.email)) return null;
  return (
    <NavLink to="/tcg" onClick={onClick}>🎴 TCG</NavLink>
  );
};

// --- Master-only link to the offline pricing tool (opens in a new tab) ---
const MasterPricingLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (currentUser?.email !== MASTER_EMAIL_UI) return null;
  return (
    <a
      href="/mercato-nero-pricing.html"
      target="_blank"
      rel="noopener noreferrer"
      onClick={closeMenu}
      style={{ color: "var(--gold)", fontStyle: "italic" }}
      title="Listino prezzi del Mercato Nero · solo Master"
    >
      💀 Listino MN (DM)
    </a>
  );
};

// ── L'ORBE DEL NESSO — nav radiale (prototipo J), a OGNI larghezza ────────────
// Le rotte sono ESATTAMENTE quelle del menu esistente (nessun link/route nuovo).
// I gruppi aprono una "costellazione" (pannello con i link); "Altro" apre il
// drawer completo (Agent, Update, Guide, DM Tools, DM Admin…).
const NESSO_GROUPS = {
  mondo: { rune: "ᛗ", label: "Mondo", links: [
    { to: "/world-map", label: "Mappa" },
    { to: "/Geo", label: "Archivio Geomantico" },
  ]},
  biblioteca: { rune: "ᛒ", label: "Biblioteca", links: [
    { to: "/scriba", label: "Lo Scriba" },
    { to: "/riassunti", label: "Riassunti" },
    { to: "/diario", label: "Diario di Bordo" },
    { to: "/almanacco", label: "Almanacco del Mondo" },
    { to: "/crafting", label: "Crafting" },
    { to: "/ratti-lore", label: "Gilda dei Ratti" },
  ]},
  eroi: { rune: "ᛖ", label: "Eroi", links: [
    { to: "/party", label: "Party" },
    { to: "/scheda-pg", label: "Scheda PG" },
    { to: "/npc", label: "NPC" },
  ]},
  gilda: { rune: "ᚷ", label: "Gilda", links: [
    { to: "/mercato", label: "Mercato Nero" },
    { to: "/bacheca", label: "Bacheca" },
    { to: "/cinema", label: "Cinema" },
    { to: "/tarocchi", label: "L'Oracolo" },
    { to: "/feedback", label: "Feedback" },
  ]},
  battaglia: { rune: "ᚦ", label: "Battaglia", links: [
    { to: "/arena", label: "Arena" },
    { to: "/arena-bottega", label: "Bottega Arena" },
    { to: "/world-boss-fight", label: "World Fight" },
  ]},
};
const NESSO_GROUP_OF = (p) =>
  p === "/" ? "home"
  : ["/world-map", "/Geo"].includes(p) ? "mondo"
  : ["/scriba", "/riassunti", "/diario", "/almanacco", "/crafting", "/ratti-lore", "/riassunto", "/giornale"].some((x) => p.startsWith(x)) ? "biblioteca"
  : ["/party", "/scheda-pg", "/my-pg", "/npc"].some((x) => p.startsWith(x)) ? "eroi"
  : ["/mercato", "/bacheca", "/cinema", "/tarocchi", "/feedback", "/quest"].some((x) => p.startsWith(x)) ? "gilda"
  : ["/arena", "/arena-bottega", "/world-boss", "/tcg", "/boss-tactics"].some((x) => p.startsWith(x)) ? "battaglia"
  : null;

function NessoNav({ openMenu }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);   // sfaccettature sbocciate
  const [sheet, setSheet] = useState(null);  // officina aperta
  const [d20, setD20] = useState({ n: 20, tira: false, crit: false }); // il d20 del menu
  const tiraD20 = () => {
    // il menu si apre SUBITO (voci cliccabili), il dado rotola per conto suo
    setD20({ n: 1 + Math.floor(Math.random() * 20), tira: true, crit: false });
    let t = 0;
    const iv = setInterval(() => {
      t += 1;
      const v = 1 + Math.floor(Math.random() * 20);
      if (t > 9) { clearInterval(iv); setD20({ n: v, tira: false, crit: v === 20 }); }
      else setD20((d) => ({ ...d, n: v }));
    }, 55);
  };
  const p = location.pathname;

  // chiudi tutto a ogni cambio rotta
  useEffect(() => { setSheet(null); setOpen(false); }, [p]);

  const group = NESSO_GROUP_OF(p);
  const g = sheet ? NESSO_GROUPS[sheet] : null;
  // Niente hover: anche su PC il d20 si TIRA col click (come sul cellulare).
  // Un click fuori dal d20 richiude le sfaccettature.
  const navRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  // Il pannello "sale" in .32s: un tap dato subito dove la voce sta per
  // arrivare colpirebbe il backdrop e chiuderebbe tutto → i primi 400ms li ignora.
  const sheetOpenedAt = useRef(0);
  const goHome = () => { setOpen(false); setSheet(null); navigate("/"); };
  const openGroup = (key) => { setOpen(false); sheetOpenedAt.current = Date.now(); setSheet((s) => (s === key ? null : key)); };
  const onBackdrop = () => { if (Date.now() - sheetOpenedAt.current < 400) return; setSheet(null); };
  const openDrawer = () => { setOpen(false); setSheet(null); openMenu(); };

  // TCG entra nella costellazione Battaglia solo se il link esiste nel drawer
  // (TcgNavLink decide da solo; qui replichiamo la rotta pubblica /tcg).
  const sats = [
    { key: "home", g: "✦", label: "Covo", onClick: goHome },
    { key: "mondo", g: "ᛗ", label: "Mondo", onClick: () => openGroup("mondo") },
    { key: "biblioteca", g: "ᛒ", label: "Libri", onClick: () => openGroup("biblioteca") },
    { key: "eroi", g: "ᛖ", label: "Eroi", onClick: () => openGroup("eroi") },
    { key: "gilda", g: "ᚷ", label: "Gilda", onClick: () => openGroup("gilda") },
    { key: "battaglia", g: "ᚦ", label: "Arena", onClick: () => openGroup("battaglia") },
    { key: "altro", g: "☰", label: "Altro", onClick: openDrawer },
  ];

  return (
    <>
      {g && <div className="mnav-backdrop" onClick={onBackdrop} aria-hidden="true" />}
      {g && (
        <div className="mnav-sheet" role="dialog" aria-label={g.label}>
          <div className="mnav-sheet-head"><span className="mnav-sheet-rune" data-g={sheet} aria-hidden="true">{g.rune}</span> {g.label}</div>
          <div className="mnav-sheet-links">
            {g.links.map((l) => (
              <NavLink key={l.to} to={l.to} className="mnav-sheet-link" onClick={() => setSheet(null)}>
                {l.label}
              </NavLink>
            ))}
            {sheet === "battaglia" && <TcgNavLink />}
            {sheet === "gilda" && <MasterPricingLink closeMenu={() => setSheet(null)} />}
          </div>
        </div>
      )}
      {/* L'ORBE: <div role="navigation">, NON <nav> (shell.css trasforma ogni
          <nav> nel drawer di sito). Si apre SOLO col click/tap: il dado rotola. */}
      <div
        ref={navRef}
        className={`nesso-nav${open ? " aperto" : ""}`}
        role="navigation"
        aria-label="Il d20 del Covo"
      >
        {!sheet && <span className="nesso-hint" aria-hidden="true">{d20.crit ? "critico! il covo si apre" : "tira il d20"}</span>}
        {sats.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={`nesso-sat s${i + 1}${group === s.key || sheet === s.key ? " on" : ""}`}
            onClick={s.onClick}
            tabIndex={open ? 0 : -1}
            aria-label={s.label}
          >
            <span className="nesso-sat-g" aria-hidden="true">{s.g}</span>{s.label}
          </button>
        ))}
        <button
          type="button"
          className={`nesso-orbe${d20.tira ? " tira" : ""}${d20.crit ? " crit" : ""}`}
          onClick={() => { setSheet(null); if (!open) tiraD20(); setOpen((v) => !v); }}
          aria-label={open ? "Chiudi il menu" : "Tira il d20 e apri il menu"}
          aria-expanded={open}
        >
          <svg className="d20-svg" viewBox="0 0 100 100" aria-hidden="true">
            <polygon className="faccia" points="50,4 92,28 92,72 50,96 8,72 8,28" />
            <polygon className="faccia alta" points="50,22 78,66 22,66" />
            <polygon className="faccia" points="50,4 50,22 92,28" /><polygon className="faccia" points="50,4 50,22 8,28" />
            <polygon className="faccia" points="92,28 78,66 92,72" /><polygon className="faccia" points="8,28 22,66 8,72" />
            <polygon className="faccia" points="78,66 50,96 92,72" /><polygon className="faccia" points="22,66 50,96 8,72" />
            <polygon className="faccia" points="50,22 92,28 78,66" /><polygon className="faccia" points="50,22 8,28 22,66" />
            <polygon className="faccia" points="22,66 78,66 50,96" />
            <polygon className="bordo" points="50,4 92,28 92,72 50,96 8,72 8,28" />
          </svg>
          <span className="nesso-orbe-glifo" aria-hidden="true">{d20.n}</span>
        </button>
      </div>
    </>
  );
}

// ── PRESENZA ONLINE ───────────────────────────────────────────────────────────
function relTime(ms) {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60)   return `${sec}s fa`;
  if (sec < 3600) return `${Math.floor(sec / 60)}min fa`;
  return `${Math.floor(sec / 3600)}h fa`;
}

function OnlinePresence() {
  const { currentUser } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [open, setOpen]               = useState(false);
  const [, setTick]                   = useState(0);
  const lastWriteRef                  = useRef(0);
  const isMaster = currentUser?.email === MASTER_EMAIL_UI;

  // Scrivi lastSeen in characters/{uid} — usa la collection che ha già le regole
  const writePresence = useRef(null);
  writePresence.current = async () => {
    if (!currentUser) return;
    const now = Date.now();
    if (now - lastWriteRef.current < 8000) return; // debounce 8s
    lastWriteRef.current = now;
    try {
      await setDoc(doc(db, "characters", currentUser.uid), {
        lastSeen: serverTimestamp(),
      }, { merge: true });
    } catch (_) {
      // ignora silenziosamente
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    const init = setTimeout(() => writePresence.current?.(), 1500);
    const hb   = setInterval(() => writePresence.current?.(), 30000);
    const act  = () => writePresence.current?.();
    window.addEventListener("click",      act);
    window.addEventListener("keydown",    act);
    window.addEventListener("touchstart", act);
    window.addEventListener("scroll",     act, { passive: true });
    const onVis = () => { if (document.visibilityState === "visible") writePresence.current?.(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(init); clearInterval(hb);
      window.removeEventListener("click",      act);
      window.removeEventListener("keydown",    act);
      window.removeEventListener("touchstart", act);
      window.removeEventListener("scroll",     act);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [currentUser]);

  // Solo master: ascolta characters collection
  useEffect(() => {
    if (!isMaster) return;
    const unsub = onSnapshot(collection(db, "characters"), (snap) => {
      const now = Date.now();
      const active = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(p => !isHiddenChar(p))
        .filter(p => {
          if (!p.lastSeen) return false;
          const ms = p.lastSeen.toMillis ? p.lastSeen.toMillis() : new Date(p.lastSeen).getTime();
          return now - ms < 15 * 60 * 1000; // ultimi 15 minuti
        });
      setOnlineUsers(active);
    });
    return () => unsub();
  }, [isMaster]);

  // Tick per aggiornare i tempi relativi ogni 5s
  useEffect(() => {
    if (!isMaster) return;
    const t = setInterval(() => setTick(v => v + 1), 5000);
    return () => clearInterval(t);
  }, [isMaster]);

  if (!isMaster) return null;

  return (
    <>
      {/* Pallino fluttuante */}
      <button
        className={`online-fab${open ? " open" : ""}`}
        onClick={() => setOpen(v => !v)}
        title="Giocatori online"
      >
        <span className="online-fab-dot" />
        {onlineUsers.length > 0 && (
          <span className="online-fab-count">{onlineUsers.length}</span>
        )}
      </button>

      {/* Popup */}
      {open && (
        <div className="online-popup">
          <div className="online-popup-title">
            <span className="online-dot-sm" /> Giocatori online
          </div>
          {onlineUsers.length === 0 ? (
            <div className="online-popup-empty">Nessuno attivo di recente</div>
          ) : (
            onlineUsers.map(u => {
              const ms = u.lastSeen?.toMillis ? u.lastSeen.toMillis() : new Date(u.lastSeen || 0).getTime();
              return (
                <div key={u.uid} className="online-popup-row">
                  <span className="online-popup-name">{u.name || "Eroe"}</span>
                  <span className="online-popup-time">{relTime(ms)}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [forceShowNav, setForceShowNav] = useState(false);
  const [openDd, setOpenDd] = useState(null); // dropdown nav aperto (fisarmonica: uno solo)
  const location = useLocation();

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => { setMenuOpen(false); setOpenDd(null); };
  // Il drawer scivola dentro in .28s: un click dato subito dove la voce sta per
  // arrivare colpirebbe il backdrop e richiuderebbe il menu → nei primi 450ms
  // il backdrop non chiude.
  const menuOpenedAt = useRef(0);
  useEffect(() => { if (menuOpen) menuOpenedAt.current = Date.now(); }, [menuOpen]);
  const closeMenuFromBackdrop = () => { if (Date.now() - menuOpenedAt.current < 450) return; closeMenu(); };

  // Chiude il dropdown aperto cliccando fuori da qualsiasi .nav-dd (un solo listener).
  useEffect(() => {
    if (!openDd) return;
    const h = (e) => { if (!e.target.closest || !e.target.closest(".nav-dd")) setOpenDd(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [openDd]);

  // Fullscreen battle pages hide the top nav to give the fight more room.
  const FULLSCREEN_ROUTES = ["/boss-tactics", "/world-boss-fight", "/dm-admin/battle-maps"];
  const hideChrome = FULLSCREEN_ROUTES.includes(location.pathname);
  // Nella pagina Arena (e sottosezioni: fight, tabellone, ecc.) nascondi la chat globale.
  const isArenaPage = location.pathname.startsWith("/arena");
  // Reset the temporary "reveal nav" whenever the route changes.
  useEffect(() => { setForceShowNav(false); }, [location.pathname]);

  // TEMA: il sito è light "pergamena" di default; le pagine immersive di gioco
  // (arena, tcg, world boss tattico, pet) restano scure → body.theme-dark.
  // Tema chiaro "Alba del Nesso": scelta dell'utente (☀/☾ nell'header),
  // salvata in localStorage; le pagine di gioco scure lo ignorano sempre.
  // IL RESPIRO DEL DRAGO (Covo): Fuoco o Gelo, scelto nell'header e salvato
  // in localStorage "covo_soffio" -> html[data-soffio]. I pannelli DM/Admin
  // respirano sempre ARCANO (body.covo-admin, vedi styles/covo.css).
  const [soffio, setSoffio] = useState(() => {
    try { const v = localStorage.getItem("covo_soffio"); return SOFFI.some((x) => x.key === v) ? v : "fuoco"; } catch { return "fuoco"; }
  });
  const cambiaSoffio = (s) => {
    setSoffio(s);
    try { localStorage.setItem("covo_soffio", s); } catch { /* ignora */ }
  };
  useEffect(() => {
    const p = location.pathname;
    const isDarkGamePage =
      p.startsWith("/arena") ||
      p === "/tcg" ||
      p.startsWith("/world-boss") ||
      p === "/boss-tactics" ||
      p.startsWith("/pet") ||
      p === "/dm-admin/battle-maps";
    const isAdminPage = p.startsWith("/dm-admin") || p.startsWith("/dm/") || p === "/agenti" || p.startsWith("/sessions/");
    document.body.classList.toggle("theme-dark", isDarkGamePage);
    document.body.classList.toggle("covo-admin", isAdminPage);
    // L'Arena resta theme-dark (CSS autonomo) ma veste il Covo: squame e respiro attivi
    document.body.classList.toggle("covo-arena", p === "/arena");
    document.documentElement.dataset.theme = soffio === "bianco" ? "light" : "dark";
    document.documentElement.dataset.soffio = soffio;
    return () => { document.body.classList.remove("theme-dark", "covo-admin", "covo-arena"); };
  }, [location.pathname, soffio]);

  // --- LOGICA REFRESH & CACHE BUSTING ---
  useEffect(() => {
    // 1. Controllo Versione (LocalStorage)
    const lastVersion = localStorage.getItem("app_version");
    if (lastVersion !== APP_VERSION) {
      localStorage.setItem("app_version", APP_VERSION);
      // Pulisce cache dei Service Workers se presenti
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) registration.unregister();
        });
      }
      // Forza ricaricamento ignorando la cache
      window.location.reload(true);
    }

    // 2. Listener per aggiornamenti Service Worker "al volo"
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                window.location.reload();
              }
            };
          }
        };
      });
    }
  }, []);

  return (
    <AuthProvider>
      <NotificationOptIn />
      {hideChrome && !forceShowNav && (
        <button className="battle-nav-reopen" onClick={() => setForceShowNav(true)} aria-label="Apri menu">
          ☰
        </button>
      )}
      {(!hideChrome || forceShowNav) && (
      <header className="app-nav">
        {/* Sinistra header: logo + respiro del drago (Fuoco/Gelo) */}
        <div className="header-left">
          <NavLink to="/" className="logo logo--img-only" onClick={closeMenu} aria-label="Crit Happens — Home">
            <img src="/logo.png" alt="Crit Happens" className="logo-img" />
          </NavLink>
          <div className="respiro" role="group" aria-label="Respiro del drago">
            {SOFFI.map((r) => (
              <button key={r.key} type="button" data-soffio={r.key} aria-pressed={soffio === r.key} onClick={() => cambiaSoffio(r.key)} title={r.title}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d={r.d} /></svg><span>{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Destra header: avatar sempre visibile + burger su mobile */}
        <div className="header-right">
          <LoginDropdown closeMenu={closeMenu} />

          <div className={`burger ${menuOpen ? "open" : ""}`} onClick={toggleMenu} aria-label="Apri menu">
            <span className="line line-1"></span>
            <span className="line line-2"></span>
            <span className="line line-3"></span>
          </div>

          {/* On fullscreen pages the header is only revealed via ☰ — this X
              hides it again and returns to the fullscreen view. */}
          {hideChrome && (
            <button
              className="nav-hide-btn"
              onClick={() => { setForceShowNav(false); setMenuOpen(false); }}
              aria-label="Nascondi menu"
              title="Nascondi menu"
            >
              ✕
            </button>
          )}
        </div>

        {menuOpen && <div className="nav-backdrop" onClick={closeMenuFromBackdrop} aria-hidden="true" />}
        <nav
          className={menuOpen ? "active" : ""}
          onClick={(e) => { if (e.target === e.currentTarget) closeMenu(); }}
        >
          <button type="button" className="nav-close" onClick={closeMenu} aria-label="Chiudi menu">×</button>
          <NavLink to="/" end onClick={closeMenu}>Home</NavLink>
          <NavLink to="/assistente" onClick={closeMenu} className="nav-agent">Agent</NavLink>
          <NavLink to="/updates" onClick={closeMenu}>UPDATE</NavLink>

          <NavDropdown label={<><span className="nav-rune" data-g="mondo" aria-hidden="true">ᛗ</span> Mondo</>} closeAll={closeMenu} id="mondo" openId={openDd} setOpenId={setOpenDd}>
            <NavLink to="/world-map">Mappa</NavLink>
            <NavLink to="/Geo">Archivio Geomantico</NavLink>
          </NavDropdown>

          <NavDropdown label={<><span className="nav-rune" data-g="biblioteca" aria-hidden="true">ᛒ</span> Biblioteca</>} closeAll={closeMenu} id="biblioteca" openId={openDd} setOpenId={setOpenDd}>
            <NavLink to="/scriba">Lo Scriba</NavLink>
            <NavLink to="/riassunti">Riassunti</NavLink>
            <NavLink to="/diario">Diario di Bordo</NavLink>
          </NavDropdown>

          <NavDropdown label={<><span className="nav-rune" data-g="guide" aria-hidden="true">ᚱ</span> Guide</>} closeAll={closeMenu} id="guide" openId={openDd} setOpenId={setOpenDd}>
            <NavLink to="/almanacco">Almanacco del Mondo</NavLink>
            <NavLink to="/crafting">Crafting</NavLink>
            <NavLink to="/ratti-lore">Gilda dei Ratti</NavLink>
          </NavDropdown>

          <NavDropdown label={<><span className="nav-rune" data-g="eroi" aria-hidden="true">ᛖ</span> Eroi</>} closeAll={closeMenu} id="eroi" openId={openDd} setOpenId={setOpenDd}>
            <NavLink to="/party">Party</NavLink>
            <NavLink to="/scheda-pg">Scheda PG</NavLink>
            <NavLink to="/npc">NPC</NavLink>
          </NavDropdown>

          <NavDropdown label={<><span className="nav-rune" data-g="gilda" aria-hidden="true">ᚷ</span> Gilda</>} closeAll={closeMenu} id="gilda" openId={openDd} setOpenId={setOpenDd}>
            <NavLink to="/mercato">Mercato Nero</NavLink>
            <MasterPricingLink closeMenu={closeMenu} />
            <NavLink to="/bacheca">Bacheca</NavLink>
            <NavLink to="/cinema">Cinema</NavLink>
            <NavLink to="/tarocchi">🔮 L'Oracolo</NavLink>
            <NavLink to="/feedback">💬 Feedback</NavLink>
          </NavDropdown>

          <NavDropdown label={<><span className="nav-rune" data-g="battaglia" aria-hidden="true">ᚦ</span> Battaglia</>} closeAll={closeMenu} id="battaglia" openId={openDd} setOpenId={setOpenDd}>
            <NavLink to="/arena">Arena</NavLink>
            <NavLink to="/arena-bottega">Bottega Arena</NavLink>
            {/* <NavLink to="/pet">Pet Hub</NavLink> */}
            <TcgNavLink />
            <NavLink to="/world-boss-fight">World Fight</NavLink>
          </NavDropdown>

          <DmToolsDropdown closeMenu={closeMenu} openId={openDd} setOpenId={setOpenDd} />
          <ConcilioNavLink closeMenu={closeMenu} />
          <AdminNavLink closeMenu={closeMenu} />
          <SummaryAdminNavLink closeMenu={closeMenu} />
        </nav>
      </header>
      )}

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/party" element={<Party />} />
          <Route path="/assistente" element={<Assistente />} />
          <Route path="/agenti" element={<Concilio />} />
          <Route path="/npc" element={<NPC />} />
          <Route path="/world-map" element={<WorldMap />} />
          <Route path="/Geo" element={<Geo />} />
          <Route path="/riassunti" element={<Riassunti />} />
          <Route path="/diario" element={<Diario />} />
          <Route path="/riassunto/:id" element={<RiassuntoSingolo />} />
          <Route path="/sessions/:party" element={<GenerateSession />} />
          <Route path="/sessions/:party/:number" element={<SessionDetail />} />
          <Route path="/dm/generate-session" element={<GenerateSession />} />
          <Route path="/scriba" element={<Scriba />} />
          <Route path="/giornale/:id" element={<ScribaSingolo />} />
          <Route path="/almanacco" element={<Almanacco />} />
          <Route path="/ratti-lore" element={<RattiLore />} />
          <Route path="/bacheca" element={<Bacheca />} />
          <Route path="/quest/:id" element={<QuestDetail />} />
          <Route path="/cinema" element={<Cinema />} />
          <Route path="/tarocchi" element={<Tarocchi />} />
          <Route path="/my-pg" element={<SchedaPG />} />
          <Route path="/scheda-pg" element={<SchedaPG />} />
          <Route path="/mercato" element={<Mercato />} />
          <Route path="/mercato/:id" element={<ItemDetail />} />
          <Route path="/arena" element={<Arena />} />
          <Route path="/arena-bottega" element={<ArenaMarket />} />
          {/* <Route path="/pet" element={<PetHub />} /> */}
          {/* <Route path="/pet-arena" element={<PetArena />} /> */}
          <Route path="/tcg" element={<Tcg />} />
          <Route path="/crafting" element={<Crafting />} />
          <Route path="/world-boss-fight" element={<BossTactics />} />
          <Route path="/world-boss-old" element={<WorldBoss />} />
          <Route path="/boss-tactics" element={<BossTactics />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/updates" element={<Updates />} />

          {/* ROTTE ADMIN */}
          <Route path="/dm-admin/genera-npc" element={<GeneraNPC />} />
          <Route path="/dm-admin/strumenti" element={<DmTools />} />
          <Route path="/dm-admin/foundry-item" element={<FoundryItemForm />} />
          <Route path="/dm-admin/foundry-npc" element={<FoundryNpcForm />} />
          <Route path="/dm-admin" element={<AdminPanel />} />
          <Route path="/dm-admin/world-boss" element={<WorldBossAdmin />} />
          <Route path="/dm-admin/quests" element={<QuestAdmin />} />
          <Route path="/dm-admin/market" element={<MarketAdmin />} />
          <Route path="/dm-admin/sessions" element={<AdminSessions />} />
          <Route path="/dm-admin/videos" element={<VideoAdmin />} />
          <Route path="/dm-admin/summaries" element={<SummaryAdmin />} />
          <Route path="/dm-admin/scriba" element={<LoScribaAdmin />} />
          <Route path="/dm-admin/platinum" element={<PlatinumAdmin />} />
          <Route path="/dm-admin/pet-points" element={<PetPointsAdmin />} />
          <Route path="/dm-admin/reputation" element={<ReputationAdmin />} />
          <Route path="/dm-admin/geo" element={<GeoAdmin />} />
          <Route path="/dm-admin/send-notif" element={<SendNotification />} />
          <Route path="/dm-admin/player-sprites" element={<PlayerSpritesAdmin />} />
          <Route path="/dm-admin/battle-maps" element={<BattleMapEditor />} />
        </Routes>
      </main>

      <DiceRollHost />
      {!hideChrome && <OnlinePresence />}
      <FirestoreErrorGuard />
      <CovoOverlay />

      {!hideChrome && <NessoNav openMenu={() => setMenuOpen(true)} />}

      <footer>
        <a
          className="footer-yt"
          href="https://www.youtube.com/@Crit_Happens-p9e"
          target="_blank"
          rel="noreferrer"
          aria-label="Crit Happens su YouTube"
        >
          <img src="/assets/critHappensMark.svg" alt="" className="footer-yt-logo" />
          Guardaci su YouTube
        </a>
        <p>
          © {new Date().getFullYear()}{" "}
          <strong>
            <a href="https://designbyorpheus.it/" target="_blank" rel="noreferrer">OrpheusDesign</a>
          </strong>
        </p>
      </footer>
    </AuthProvider>
  );
}