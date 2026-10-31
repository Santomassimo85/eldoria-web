/* ============================================================
   IL RIFUGIO DEI PET (2026-10-31) — /pet
   Nuovo sistema pet alla Pokémon (dati in data/petDex.js, lotta in
   data/petEngine.js, scritture in utils/petDen.js). Per ora SOLO il
   Master principale lo vede (isMainMaster): agli altri la pagina dice
   che apre presto e il menu non lo mostra.
   Hub a piastrelle → sezioni (ognuna con "← Torna all'hub"): Squadra ·
   Nido · Bottega delle uova · Torre · Pet Dex · Manuale · Bestiario e
   Giocatori (solo Master: pixel art con Gemini, reset di punti e pet).
   ============================================================ */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { collection, deleteField, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import { isHiddenChar } from "../data/hiddenPlayers";
import {
  PET_DEX, PET_DEX_ORDER, PET_DEX_MOVES, STARTERS, RARITY, MAX_TEAM, MAX_PER_SPECIES, MAX_EGGS,
  MOVE_UNLOCK, TYPE_ICON, TYPE_LABEL, TYPE_COLORS, ELEMENTS, EGGS, EGG_ORDER, HATCH_RARITIES,
  eggChances, hatchRarityOf, strongAgainst, weakAgainst, DMG_ICON, DMG_LABEL, ELEMENT_ODDS, PRISM_ODDS,
  MOVE_GRADES, MAX_MOVES, GRADE_ROMAN, gradeOfLevel, learnPool, moveCat, damageKindOf, dndOf,
} from "../data/petDex";
import {
  statsAt, xpToNext, newBattle, battleMoves, learnedMoves, knownMoves, acOf, hitChance, playTurn, activeOf, benchAlive, towerFloor, towerXp, towerPoints, AI_LABEL,
} from "../data/petEngine";
import {
  denOf, countOf, chooseStarter, givePet, buyEgg, hatchEgg, releasePet, setTeam, renamePet, claimGifts,
  recordTowerResult, savePetArt, savePetLook, petArtPrompt, setMascot, resetPetPlayers, MASCOT_XP_BONUS,
  learnMove, setMoveset, buyItem, giveItems, applyGrowthItem, giveCharm, teachScroll, recordPvpResult, PVP_POINTS, PVP_DAILY,
} from "../utils/petDen";
import {
  createChallenge, acceptChallenge, declineChallenge, cancelChallenge, submitAction, forfeit, pendingSide, sidesOf, flipBattle, flipEvent,
} from "../utils/petPvp";
import { PET_BAG, BAG_ORDER, CHARMS, SCROLL_IDS, SCROLL_SLOTS } from "../data/petBag";
import PetFx from "./PetFx";
import { unlock as unlockAudio, sfx, jingle, battleMusic, setMusicOn, setSfxOn, audioPrefs, onAudioPrefs } from "../utils/petAudio";
import { dataUrlToTransparentDataUrl } from "../utils/aiSprite";
import "./PetDen.css";

// Mosse fisiche: chi attacca fa un balzo verso il bersaglio (classi in PetFx.css).
const LUNGE_FX = { stomp: "stomp", bite: "lunge", claw: "lunge", whip: "lunge", sting: "lunge", dash: "dash" };

/* ── pezzi comuni ─────────────────────────────────────────── */
export function PetSprite({ species, art, flip = false, size = 96, fainted = false, hit = false }) {
  const sp = PET_DEX[species];
  const img = art?.[species]?.image;
  return (
    <span
      className={`pd-sprite${flip ? " is-flip" : ""}${fainted ? " is-down" : ""}${hit ? " is-hit" : ""}`}
      style={{ "--pd-size": `${size}px` }}
    >
      <span className="pd-breathe">
        {img
          ? <img src={img} alt={sp?.name || species} draggable="false" />
          : <span className="pd-emoji" aria-label={sp?.name}>{sp?.icon || "❔"}</span>}
      </span>
    </span>
  );
}

const TypeChip = ({ type }) => (
  <span className="pd-type" style={{ "--tc": (TYPE_COLORS[type] || TYPE_COLORS.neutral)[1] }}>{TYPE_ICON[type]} {TYPE_LABEL[type]}</span>
);
const RarityChip = ({ rarity }) => (
  <span className="pd-rarity" style={{ "--pd-rc": RARITY[rarity]?.color }}>{RARITY[rarity]?.label}</span>
);
const Bar = ({ value, max, kind = "hp" }) => {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <span className={`pd-bar pd-bar--${kind}${kind === "hp" && pct < 25 ? " is-low" : kind === "hp" && pct < 50 ? " is-mid" : ""}`}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
};

/* ── Mosse del pet: in lotta, innate e gradi I–VI ───────────── */
const moveInfo = (m) => {
  const mv = PET_DEX_MOVES[m];
  const kind = moveCat(m) === "atk" ? "attacco" : "incantesimo";
  return mv.power ? `${kind} · pot. ${mv.power} · ${mv.acc}% · PP ${mv.pp}` : `${kind} di stato · PP ${mv.pp}`;
};
function MoveChip({ m, on, disabled, onClick, title }) {
  const mv = PET_DEX_MOVES[m];
  return (
    <button type="button" className={`pd-mchip${on ? " is-on" : ""}`} style={{ "--tc": TYPE_COLORS[mv.type][1] }}
      disabled={disabled} onClick={onClick} aria-pressed={on} title={title}>
      <b>{TYPE_ICON[mv.type]} {mv.name}</b>
      <small>{moveInfo(m)}{!mv.power ? "" : ` · ${DMG_ICON[damageKindOf(mv)]}`}</small>
    </button>
  );
}
function MovePanel({ pet, onLearn, onMoveset }) {
  const sp = PET_DEX[pet.species];
  const set = battleMoves(pet);
  const known = knownMoves(pet);
  const learned = learnedMoves(pet);
  const g = gradeOfLevel(pet.level);
  const toggle = (m) => {
    if (set.includes(m)) { if (set.length > 1) onMoveset(set.filter((x) => x !== m)); return; }
    if (set.length < MAX_MOVES) onMoveset([...set, m]);
  };
  return (
    <div className="pd-movepanel">
      <h4>In lotta <small>{set.length}/{MAX_MOVES} · tocca per togliere o mettere</small></h4>
      <div className="pd-mgrid">
        {known.map((m) => (
          <MoveChip key={m} m={m} on={set.includes(m)} disabled={!set.includes(m) && set.length >= MAX_MOVES}
            onClick={() => toggle(m)} title={set.includes(m) ? "Togli dalla lotta" : set.length >= MAX_MOVES ? `Ne porta già ${MAX_MOVES}: togline una` : "Porta in lotta"} />
        ))}
      </div>
      <h4>Innate</h4>
      <ul className="pd-moves">
        {sp.moves.map((m, i) => {
          const mv = PET_DEX_MOVES[m];
          const locked = pet.level < MOVE_UNLOCK[i];
          return (
            <li key={m} className={locked ? "is-locked" : ""}>
              <span>{TYPE_ICON[mv.type]} {mv.name}</span>
              <small>{locked ? `🔒 Lv ${MOVE_UNLOCK[i]}` : moveInfo(m)}</small>
            </li>
          );
        })}
      </ul>
      <h4>Gradi delle mosse <small>una a scelta per grado · attacchi {TYPE_ICON[sp.type]} o neutri, incantesimi solo {TYPE_ICON[sp.type]} {TYPE_LABEL[sp.type]}</small></h4>
      {MOVE_GRADES.map((lvl, i) => {
        const grade = i + 1;
        const open = grade <= g;
        const pick = (pet.learned || {})[grade];
        return (
          <div key={grade} className={`pd-grade${open ? "" : " is-locked"}`}>
            <div className="pd-grade-head">
              <b>Grado {GRADE_ROMAN[i]}</b>
              <small>{open ? (pick && learned.includes(pick) ? `imparata: ${PET_DEX_MOVES[pick].name}` : "✨ scegli una mossa") : `🔒 al Lv ${lvl}`}</small>
            </div>
            <div className="pd-mgrid">
              {learnPool(pet.species, grade).map((m) => (
                <MoveChip key={m} m={m} on={pick === m} disabled={!open || pick === m}
                  onClick={() => onLearn(grade, m)} title={open ? (pick ? `Impara ${PET_DEX_MOVES[m].name} al posto di ${PET_DEX_MOVES[pick]?.name}` : `Impara ${PET_DEX_MOVES[m].name}`) : `Si sblocca al Lv ${lvl}`} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── pagina ───────────────────────────────────────────────── */
export default function PetDen() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const master = isMainMaster(currentUser?.email);
  const [char, setChar] = useState(null);
  const [art, setArt] = useState({});
  const [tab, setTab] = useState("hub");
  const [msg, setMsg] = useState("");
  const [battle, setBattle] = useState(null); // { floor, plan, teamIds }
  const [pvpId, setPvpId] = useState(null);   // sfida aperta
  const [mA, setMA] = useState([]);
  const [mB, setMB] = useState([]);
  const giftsTried = useRef(false);

  useEffect(() => {
    if (!uid || !master) return undefined;
    return onSnapshot(doc(db, "characters", uid), (s) => setChar(s.exists() ? s.data() : {}));
  }, [uid, master]);
  useEffect(() => {
    if (!master) return undefined;
    return onSnapshot(collection(db, "pet_dex"), (snap) => {
      const m = {};
      snap.forEach((d) => { m[d.id] = d.data(); });
      setArt(m);
    }, () => setArt({}));
  }, [master]);

  useEffect(() => {
    if (!uid || !master) return undefined;
    const sub = (field, set) => onSnapshot(query(collection(db, "pet_matches"), where(field, "==", uid)),
      (snap) => set(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => set([]));
    const u1 = sub("a", setMA), u2 = sub("b", setMB);
    return () => { u1(); u2(); };
  }, [uid, master]);
  const matches = useMemo(() => {
    const all = [...mA, ...mB.filter((m) => m.a !== m.b)];
    const t = (m) => m.updatedAt?.toMillis?.() || 0;
    return all.sort((x, y) => t(y) - t(x));
  }, [mA, mB]);

  const den = useMemo(() => denOf(char), [char]);
  const points = Number(char?.petPoints) || 0;

  // Pet arrivati dal Mercato: si ritirano all'apertura (solo dopo l'iniziale).
  useEffect(() => {
    if (!uid || !char || giftsTried.current || !den.starter) return;
    if (!(char.petGifts || []).length) return;
    giftsTried.current = true;
    claimGifts(uid).then((r) => {
      if (!r) return;
      const names = (l) => l.map((k) => PET_DEX[k]?.name).join(", ");
      setMsg([
        r.got.length && `🎁 Arrivati dal Mercato: ${names(r.got)}.`,
        r.eggs?.filter((e) => !e.startsWith("item:")).length && `🥚 Nel nido: ${r.eggs.filter((e) => !e.startsWith("item:")).map((e) => EGGS[e]?.name).join(", ")}.`,
        r.eggs?.some((e) => e.startsWith("item:")) && `🎒 Nella bisaccia: ${r.eggs.filter((e) => e.startsWith("item:")).map((e) => PET_BAG[e.slice(5)]?.name).join(", ")}.`,
        r.refunded.length && `Già al completo: ${names(r.refunded)} → convertiti in punti pet.`,
      ].filter(Boolean).join(" "));
    }).catch((e) => setMsg(e.message));
  }, [uid, char, den.starter]);

  const run = async (fn, ok) => {
    try { await fn(); if (ok) setMsg(ok); } catch (e) { setMsg(e.message || String(e)); }
  };

  if (!currentUser) {
    return <section className="pd-page"><div className="pd-closed"><h1>Il Rifugio dei Pet</h1><p>Accedi per entrare.</p></div></section>;
  }
  if (!master) {
    return (
      <section className="pd-page">
        <div className="pd-closed">
          <span className="pd-closed-egg" aria-hidden="true">🥚</span>
          <h1>Il Rifugio dei Pet</h1>
          <p>Qualcosa si muove nelle uova… Il Rifugio aprirà presto.</p>
          <Link to="/" className="pd-btn">Torna al Covo</Link>
        </div>
      </section>
    );
  }
  if (!char) return <section className="pd-page"><p className="pd-loading">Il Rifugio si sveglia…</p></section>;

  // Ogni cambio di sezione riparte dall'alto della pagina.
  const go = (k) => { setTab(k); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (battle) {
    return (
      <section className="pd-page pd-page--battle">
        <PetBattle
          key={battle.key}
          uid={uid} den={den} art={art} plan={battle.plan} teamIds={battle.teamIds}
          onExit={() => { setBattle(null); setTab("torre"); }}
          onRetry={() => { unlockAudio(); setBattle((b) => ({ ...b, key: Date.now() })); }}
        />
      </section>
    );
  }

  if (pvpId) {
    return (
      <section className="pd-page pd-page--battle">
        <PvpBattle key={pvpId} uid={uid} id={pvpId} art={art} onExit={() => { setPvpId(null); setTab("sfide"); }} />
      </section>
    );
  }

  if (!den.starter) {
    return (
      <section className="pd-page">
        <StarterPick art={art} onPick={(k) => run(() => chooseStarter(uid, k), `${PET_DEX[k].name} è il tuo primo compagno!`)} />
        {master && <MasterTools uid={uid} den={den} art={art} compact />}
      </section>
    );
  }

  const SECTIONS = {
    squadra: { title: "Squadra e collezione", sub: `${den.pets.length} pet` },
    nido: { title: "Il nido", sub: `${den.eggs.length}/${MAX_EGGS} uova` },
    uova: { title: "Bottega delle uova" },
    torre: { title: "Torre dei Cuccioli", sub: "infinita" },
    sfide: { title: "Sfide fra domatori" },
    bisaccia: { title: "Bisaccia del Domatore", sub: "oggetti dei pet" },
    dex: { title: "Pet Dex" },
    manuale: { title: "Manuale" },
    bestiario: { title: "Bestiario del Master" },
    giocatori: { title: "Giocatori · punti e pet" },
  };
  const sec = SECTIONS[tab] && (!["bestiario", "giocatori"].includes(tab) || master) ? tab : "hub";
  const back = () => go("hub");

  return (
    <section className="pd-page">
      <header className="pd-head">
        <div>
          <p className="pd-eyebrow">Gilda · Compagni</p>
          <h1>Il Rifugio dei Pet</h1>
          <p className="pd-sub">Creature del mondo, piccole e pucciose. Fino a {MAX_TEAM} in squadra, {MAX_PER_SPECIES} per specie in collezione.</p>
        </div>
        <div className="pd-wallet" title="Si guadagnano con Arena, login, World Boss e Torre">
          <span className="pd-wallet-n">{points}</span>
          <span className="pd-wallet-l">punti pet</span>
        </div>
      </header>
      {master && <p className="pd-master-note">👁 Visibile solo a te: i giocatori vedono "aprirà presto".</p>}
      {msg && <p className="pd-msg" onClick={() => setMsg("")}>{msg}</p>}

      {sec === "hub" ? (
        <Hub den={den} art={art} points={points} master={master} go={go} matches={matches} uid={uid} />
      ) : (
        <>
          <SectionHead title={SECTIONS[sec].title} sub={SECTIONS[sec].sub} onBack={back} />
          {sec === "squadra" && <TeamTab uid={uid} den={den} art={art} run={run} />}
          {sec === "nido" && <NestTab uid={uid} den={den} art={art} goShop={() => go("uova")} />}
          {sec === "uova" && <EggShopTab uid={uid} den={den} art={art} points={points} run={run} ledger={char.petPointsLedger || []} goNest={() => go("nido")} />}
          {sec === "dex" && <DexTab den={den} art={art} />}
          {sec === "manuale" && <Manual />}
          {sec === "torre" && (
            <TowerTab uid={uid} den={den} art={art} onFight={(plan) => { unlockAudio(); setBattle({ plan, teamIds: den.team, key: Date.now() }); }} />
          )}
          {sec === "sfide" && <ChallengesTab uid={uid} char={char} den={den} matches={matches} master={master} run={run} openMatch={setPvpId} />}
          {sec === "bisaccia" && <BagTab uid={uid} den={den} points={points} run={run} />}
          {sec === "bestiario" && <MasterTools uid={uid} den={den} art={art} run={run} />}
          {sec === "giocatori" && <PlayersAdmin run={run} />}
          <div className="pd-secfoot"><button type="button" className="pd-back" onClick={back}>← Torna all'hub</button></div>
        </>
      )}
    </section>
  );
}

/* ── navigazione: hub e testata di sezione ────────────────── */
function SectionHead({ title, sub, onBack }) {
  return (
    <div className="pd-sechead">
      <button type="button" className="pd-back" onClick={onBack}>← Torna all'hub</button>
      <h2 className="pd-sectitle">{title}{sub && <small>{sub}</small>}</h2>
    </div>
  );
}

function Hub({ den, art, points, master, go, matches = [], uid }) {
  const mascot = den.pets.find((p) => p.id === den.mascot);
  const team = den.team.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  const owned = PET_DEX_ORDER.filter((k) => countOf(den, k) > 0).length;
  const tiles = [
    { key: "squadra", icon: "🐾", title: "Squadra e collezione", sub: `${team.length}/${MAX_TEAM} in squadra · ${den.pets.length} pet` },
    { key: "nido", icon: "🥚", title: "Il nido", sub: den.eggs.length ? `${den.eggs.length} uova da schiudere` : "nessun uovo", hot: den.eggs.length > 0 },
    { key: "uova", icon: "🛒", title: "Bottega delle uova", sub: `${points} punti pet da spendere` },
    { key: "torre", icon: "🗼", title: "Torre dei Cuccioli", sub: `piano ${den.tower.floor} · record ${den.tower.best || 0}` },
    (() => {
      const turn = matches.filter((m) => m.status === "active" && pendingSide(m, uid)).length;
      const inc = matches.filter((m) => m.status === "pending" && m.b === uid).length;
      return { key: "sfide", icon: "⚔", title: "Sfide fra domatori", sub: turn || inc ? [turn && `${turn} tocca a te`, inc && `${inc} nuove sfide`].filter(Boolean).join(" · ") : `${den.pvp.wins} vinte · ${den.pvp.losses} perse`, hot: turn + inc > 0 };
    })(),
    { key: "bisaccia", icon: "🎒", title: "Bisaccia del Domatore", sub: `${Object.values(den.items).reduce((a, n) => a + n, 0)} oggetti · amuleti, pergamene` },
    { key: "dex", icon: "📖", title: "Pet Dex", sub: `${owned}/${PET_DEX_ORDER.length} specie scoperte` },
    { key: "manuale", icon: "📜", title: "Manuale", sub: "regole, elementi, uova, torre" },
    ...(master ? [
      { key: "bestiario", icon: "🎨", title: "Bestiario · Master", sub: "pixel art con Gemini", master: true },
      { key: "giocatori", icon: "🛡", title: "Giocatori · Master", sub: "azzera punti e pet", master: true },
    ] : []),
  ];
  return (
    <div className="pd-hub">
      <div className="pd-hub-team">
        {team.map((p) => (
          <div key={p.id} className="pd-hub-pet">
            <PetSprite species={p.species} art={art} size={88} />
            <span>{p.nick || PET_DEX[p.species].name}{p.id === den.mascot ? " ⭐" : ""}</span>
            <small>Lv {p.level}</small>
          </div>
        ))}
        {mascot && !den.team.includes(mascot.id) && (
          <div className="pd-hub-pet is-mascot">
            <PetSprite species={mascot.species} art={art} size={70} />
            <span>{mascot.nick || PET_DEX[mascot.species].name} ⭐</span>
            <small>mascotte</small>
          </div>
        )}
      </div>
      <div className="pd-hub-grid">
        {tiles.map((t) => (
          <button key={t.key} type="button" className={`pd-tile${t.master ? " is-master" : ""}${t.hot ? " is-hot" : ""}`} onClick={() => go(t.key)}>
            <span className="pd-tile-icon" aria-hidden="true">{t.icon}</span>
            <strong>{t.title}</strong>
            <small>{t.sub}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── resistenze D&D ───────────────────────────────────────── */
function ResLine({ species, compact = false }) {
  const r = PET_DEX[species]?.res;
  const rows = [
    ["Immune", r?.immune, "imm"], ["Resiste", r?.resist, "res"], ["Vulnerabile", r?.vuln, "vul"],
  ].filter(([, l]) => l?.length);
  if (!rows.length) return compact ? null : <p className="pd-res pd-res--none">Nessuna resistenza particolare.</p>;
  return (
    <p className={`pd-res${compact ? " is-compact" : ""}`}>
      {rows.map(([label, list, cls]) => (
        <span key={cls} className={`pd-res-${cls}`} title={`${label}: ${list.map((k) => DMG_LABEL[k]).join(", ")}`}>
          {compact ? "" : `${label}: `}{list.map((k) => (compact ? DMG_ICON[k] : `${DMG_ICON[k]} ${DMG_LABEL[k]}`)).join(compact ? "" : ", ")}
        </span>
      ))}
    </p>
  );
}

/* ── filtri (Pet Dex e Bestiario) ─────────────────────────── */
const emptyFilter = { q: "", el: "all", rar: "all" };
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function filterSpecies(f) {
  const q = norm(f.q.trim());
  return PET_DEX_ORDER.filter((k) => {
    const sp = PET_DEX[k];
    if (f.el !== "all" && sp.type !== f.el) return false;
    if (f.rar !== "all" && sp.rarity !== f.rar) return false;
    return !q || norm(`${sp.name} ${sp.desc} ${TYPE_LABEL[sp.type]} ${RARITY[sp.rarity].label} ${sp.look}`).includes(q);
  });
}
function FilterBar({ f, set }) {
  return (
    <div className="pd-filterbar">
      <input
        type="search" className="pd-search" placeholder="🔍 Cerca per nome, elemento, descrizione…"
        value={f.q} onChange={(e) => set({ ...f, q: e.target.value })}
      />
      <div className="pd-filters">
        {["all", ...ELEMENTS].map((t) => (
          <button key={t} type="button" aria-pressed={f.el === t} className={f.el === t ? "on" : ""} onClick={() => set({ ...f, el: t })}>
            {t === "all" ? "Tutti gli elementi" : `${TYPE_ICON[t]} ${TYPE_LABEL[t]}`}
          </button>
        ))}
      </div>
      <div className="pd-filters">
        {["all", "starter", "common", "rare", "epic", "legendary"].map((r) => (
          <button key={r} type="button" aria-pressed={f.rar === r} className={f.rar === r ? "on" : ""} onClick={() => set({ ...f, rar: r })}>
            {r === "all" ? "Tutte le rarità" : RARITY[r].label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── manuale ──────────────────────────────────────────────── */
function Manual() {
  const typeList = (arr) => arr.map((t) => `${TYPE_ICON[t]} ${TYPE_LABEL[t]}`).join(", ") || "—";
  return (
    <div className="pd-tab pd-manual">
      <section>
        <h3>Il Rifugio in breve</h3>
        <ul>
          <li>Al primo accesso scegli un compagno fra {STARTERS.length} iniziali, uno per elemento. Una volta sola.</li>
          <li>Gli altri pet escono dalle <b>uova</b>: si comprano coi punti pet nella Bottega o si vincono all'asta del Mercato Nero, poi si schiudono nel Nido.</li>
          <li>Ne puoi avere al massimo {MAX_PER_SPECIES} della stessa specie; un doppione in più diventa punti pet.</li>
          <li>In squadra vanno fino a {MAX_TEAM} pet: il primo entra in campo.</li>
          <li>La <b>mascotte</b> (⭐, a scelta fra i tuoi pet) prende il {Math.round(MASCOT_XP_BONUS * 100)}% di PE in più e si vede accanto al tuo avatar in alto.</li>
        </ul>
      </section>
      <section>
        <h3>La lotta</h3>
        <ul>
          <li>Combatte un pet per parte. Ogni turno scegli una mossa oppure cambi pet: il cambio consuma il turno.</li>
          <li>Se il tuo pet va a terra, scegli il prossimo senza perdere il turno. Vince chi resta in piedi.</li>
          <li>Agisce prima chi è più veloce (alcune mosse rapide passano davanti a tutto).</li>
          <li><b>Si tira il dado, come in D&amp;D</b>: ogni attacco è d20 + bonus per colpire contro la <b>Classe Armatura</b> (CA) del bersaglio. 20 naturale = colpo critico, 1 naturale = mancato. La precisione della mossa diventa un bonus o un malus (100% = +2, 90% = 0, 75% = −3).</li>
          <li>Le mosse di stato sul nemico (veleno, sonno, maledizioni) chiedono a lui un <b>tiro salvezza</b> contro la CD di chi le lancia.</li>
          <li>Alcune mosse alzano la CA (Rintanarsi, Scudo della Fede, Pelle di Pietra…, fino a +4); l'acido la corrode. Chi è <b>avvelenato</b> perde PF ogni turno e attacca con <b>svantaggio</b> (tira due d20, tiene il peggiore).</li>
          <li>Competenza e CA crescono insieme ogni 12 livelli: un attacco normale va a segno circa 3 volte su 4. Sul tasto di ogni mossa vedi la probabilità.</li>
          <li>Le mosse hanno potenza, precisione e usi (PP). Le mosse di stato potenziano, curano, avvelenano, scottano o intontiscono.</li>
          <li>Le mosse dello stesso elemento del pet colpiscono un po' più forte. Delle 4 mosse innate, la terza e la quarta si sbloccano al livello 5 e 10.</li>
          <li>Effetti e suoni: ogni mossa ha la sua forma (pestone, morso, artigli, frusta, pungiglione, carica, spuntoni, raggio, soffio…) con i colori e il suono del suo elemento. La musica e gli effetti si spengono dai tasti 🎵 e 🔊 in alto nella lotta.</li>
        </ul>
      </section>
      <section>
        <h3>Gradi delle mosse (I–VI)</h3>
        <ul>
          <li>Crescendo, il pet sblocca sei gradi di mosse, come i livelli degli incantesimi: grado {MOVE_GRADES.map((l, i) => `${GRADE_ROMAN[i]} al Lv ${l}`).join(", ")}.</li>
          <li>Per ogni grado sbloccato impara <b>una</b> mossa a scelta (Squadra → Dettagli). Si può cambiare quando vuoi, fuori dalla lotta.</li>
          <li>Può imparare gli <b>attacchi</b> del suo elemento o neutri, e gli <b>incantesimi</b> SOLO del suo elemento: un pet di fuoco non imparerà mai un incantesimo di gelo.</li>
          <li>In lotta porta {MAX_MOVES} mosse, scelte fra le innate e quelle imparate. Più alto il grado, più forte (e meno precisa) la mossa.</li>
          <li>Anche i pet della Torre imparano le loro mosse salendo di livello.</li>
        </ul>
      </section>
      <section>
        <h3>Elementi</h3>
        <p>Un attacco forte contro l'elemento del bersaglio fa una volta e mezza i danni; al contrario fa la metà.</p>
        <table className="pd-chart">
          <thead><tr><th>Elemento</th><th>Forte contro</th><th>Debole contro</th></tr></thead>
          <tbody>
            {ELEMENTS.map((t) => (
              <tr key={t}><td>{TYPE_ICON[t]} {TYPE_LABEL[t]}</td><td>{typeList(strongAgainst(t))}</td><td>{typeList(weakAgainst(t))}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h3>Resistenze, immunità e vulnerabilità</h3>
        <p>Come in D&amp;D, ogni creatura ha le sue: <b>resistenza</b> = metà danni, <b>vulnerabilità</b> = danni doppi, <b>immunità</b> = nessun danno (e niente scottature o veleno se è immune a fuoco o veleno). Gli attacchi fisici sono contundenti (pestoni), perforanti (morsi) o taglienti (artigli). Le trovi nel Pet Dex e nei dettagli di ogni pet.</p>
      </section>
      <section>
        <h3>Sfide fra domatori</h3>
        <ul>
          <li>Dal Rifugio → Sfide scegli un altro domatore e lo sfidi con la tua squadra; lui accetta con la sua.</li>
          <li>Si gioca a turni anche a distanza: ognuno sceglie la mossa quando può, il turno parte quando avete scelto tutti e due. Arriva una notifica per la sfida, l'accettazione e la fine.</li>
          <li>Vittoria: PE alla squadra e +{PVP_POINTS} punti pet (prime {PVP_DAILY} vittorie del giorno), a volte un amuleto. Sconfitta: un terzo dei PE. Abbandonare conta come sconfitta.</li>
        </ul>
      </section>
      <section>
        <h3>Bisaccia del Domatore</h3>
        <ul>
          <li><b>Amuleti</b>: li tiene un pet e valgono per alcune lotte (CA, colpire, PF, velocità, tiri salvezza, critico col 19, resistenza a un elemento, bacca che cura).</li>
          <li><b>Pietra dell'Esperienza</b>: tanti PE in un colpo. <b>Caramella Rara</b>: +1 livello, rarissima (solo dalla Torre).</li>
          <li><b>Pergamene</b>: insegnano una mossa di qualunque elemento, anche un incantesimo di gelo a un pet di fuoco, ma il pet deve <b>dimenticarne</b> un'altra. Massimo {SCROLL_SLOTS} mosse da pergamena per pet.</li>
          <li>Si trovano nella Torre, vincendo sfide e nella bottega della Bisaccia (coi punti pet), e anche all'asta del Mercato Nero.</li>
        </ul>
      </section>
      <section>
        <h3>Uova</h3>
        <ul>
          <li>Ogni uovo elementale contiene un pet del suo elemento: Comune {ELEMENT_ODDS.common}%, Raro {ELEMENT_ODDS.rare}%, Epico {String(ELEMENT_ODDS.epic).replace(".", ",")}%, Leggendario {String(ELEMENT_ODDS.legendary).replace(".", ",")}%.</li>
          <li>L'Uovo Prismatico può contenere qualunque elemento, e le rarità alte escono più spesso ({PRISM_ODDS.common}/{PRISM_ODDS.rare}/{PRISM_ODDS.epic}/{PRISM_ODDS.legendary}).</li>
          <li>Se un elemento non ha pet di una rarità, la probabilità passa alla rarità più vicina. Nella Bottega vedi la percentuale vera di ogni pet.</li>
        </ul>
      </section>
      <section>
        <h3>Torre dei Cuccioli</h3>
        <ul>
          <li>Vinci un piano e sali al successivo: PE a tutta la squadra e punti pet.</li>
          <li>Se perdi ritenti lo stesso piano, e la squadra prende comunque un terzo dei PE.</li>
          <li>È infinita e uguale per tutti: il piano 3 è sempre lo stesso piano 3. Salendo gli avversari crescono di livello, diventano due e poi tre, e sono sempre più furbi. Ogni 5 piani c'è un Guardiano.</li>
          <li>Premi: ogni 5 piani un amuleto, ogni 10 una pergamena, ogni 25 una Caramella Rara (e una piccola probabilità a ogni piano). La classifica mostra fin dove è arrivato ognuno.</li>
        </ul>
      </section>
      <section>
        <h3>Punti pet</h3>
        <ul>
          <li>Arena: round e tornei vinti, Sfide Libere concluse.</li>
          <li>Login del giorno · vittoria contro il World Boss · ogni nuovo piano della Torre.</li>
        </ul>
      </section>
    </div>
  );
}

/* ── Giocatori (Master): azzera punti e pet ───────────────── */
function PlayersAdmin({ run }) {
  const [chars, setChars] = useState([]);
  const [sel, setSel] = useState({});
  const [showHidden, setShowHidden] = useState(false);
  useEffect(() => onSnapshot(collection(db, "characters"), (snap) => {
    setChars(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.name).sort((a, b) => a.name.localeCompare(b.name)));
  }), []);
  const list = chars.filter((c) => showHidden || !isHiddenChar(c) || c.petDen || c.petPoints);
  const picked = list.filter((c) => sel[c.id]);
  const all = list.length > 0 && picked.length === list.length;
  const act = (what) => {
    const ids = picked.map((c) => c.id);
    if (!ids.length) return;
    const label = what.points && what.pets ? "punti E pet" : what.points ? "i punti pet" : "i pet (collezione, nido, torre, mascotte)";
    if (!window.confirm(`Azzerare ${label} di ${ids.length === list.length ? "TUTTI i " + ids.length : ids.length} giocatori?\n${picked.map((c) => c.name).join(", ")}\n\nNon si torna indietro.`)) return;
    run(() => resetPetPlayers(ids, what), `Fatto: ${ids.length} giocatori azzerati.`).then(() => setSel({}));
  };
  return (
    <div className="pd-tab">
      <p className="pd-fine">Scegli uno, alcuni o tutti, poi azzera i punti pet, i pet o entrambi. Azzerare i pet toglie anche l'iniziale: al prossimo accesso lo sceglieranno di nuovo.</p>
      <div className="pd-admin-bar">
        <label className="pd-check"><input type="checkbox" checked={all} onChange={() => setSel(all ? {} : Object.fromEntries(list.map((c) => [c.id, true])))} /> Tutti ({list.length})</label>
        <label className="pd-check"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Mostra anche gli inattivi</label>
        <span className="pd-admin-count">{picked.length} scelti</span>
        <button type="button" className="pd-btn pd-btn--danger" disabled={!picked.length} onClick={() => act({ points: true })}>Azzera punti</button>
        <button type="button" className="pd-btn pd-btn--danger" disabled={!picked.length} onClick={() => act({ pets: true })}>Azzera pet</button>
        <button type="button" className="pd-btn pd-btn--danger" disabled={!picked.length} onClick={() => act({ points: true, pets: true })}>Azzera tutto</button>
      </div>
      <ul className="pd-admin-list">
        {list.map((c) => {
          const d = denOf(c);
          return (
            <li key={c.id} className={sel[c.id] ? "on" : ""}>
              <label className="pd-check">
                <input type="checkbox" checked={!!sel[c.id]} onChange={() => setSel((s) => ({ ...s, [c.id]: !s[c.id] }))} />
                <img src={c.image || "/assets/player/default.png"} alt="" />
                <span><b>{c.name}</b>{isHiddenChar(c) ? <small> · inattivo</small> : null}</span>
              </label>
              <span className="pd-admin-stat">{Number(c.petPoints) || 0} pt</span>
              <span className="pd-admin-stat">{d.pets.length} pet · {d.eggs.length} uova</span>
              <span className="pd-admin-stat">{d.starter ? `piano ${d.tower.floor}` : "senza iniziale"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── scelta dell'iniziale ─────────────────────────────────── */
function StarterPick({ art, onPick }) {
  const [sel, setSel] = useState(null);
  return (
    <div className="pd-starter">
      <p className="pd-eyebrow">Il primo passo</p>
      <h1>Scegli il tuo primo compagno</h1>
      <p className="pd-sub">Uno per elemento. Si sceglie una volta sola: gli altri possono uscire più avanti dalle uova.</p>
      <div className="pd-starter-grid">
        {STARTERS.map((k) => {
          const sp = PET_DEX[k];
          const st = statsAt(k, 1);
          return (
            <button key={k} type="button" className={`pd-starter-card${sel === k ? " on" : ""}`} onClick={() => setSel(k)}>
              <PetSprite species={k} art={art} size={112} />
              <strong>{sp.name}</strong>
              <TypeChip type={sp.type} />
              <p>{sp.desc}</p>
              <ResLine species={k} compact />
              <dl className="pd-stats">
                <div><dt>PF</dt><dd>{st.hp}</dd></div>
                <div><dt>ATK</dt><dd>{st.atk}</dd></div>
                <div><dt>DIF</dt><dd>{st.def}</dd></div>
                <div><dt>VEL</dt><dd>{st.spd}</dd></div>
              </dl>
            </button>
          );
        })}
      </div>
      <div className="pd-starter-go">
        <button type="button" className="pd-btn pd-btn--main" disabled={!sel} onClick={() => sel && onPick(sel)}>
          {sel ? `Scelgo ${PET_DEX[sel].name}` : "Tocca un compagno"}
        </button>
      </div>
    </div>
  );
}

/* ── squadra e collezione ─────────────────────────────────── */
function PetCard({ pet, art, inTeam, slot, onToggle, onRename, onRelease, canAdd, isMascot, onMascot, onLearn, onMoveset }) {
  const sp = PET_DEX[pet.species];
  const st = statsAt(pet.species, pet.level);
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState(pet.nick || "");
  return (
    <article className={`pd-card${inTeam ? " is-team" : ""}${isMascot ? " is-mascot" : ""}`}>
      {inTeam && <span className="pd-slot">#{slot + 1}</span>}
      {isMascot && <span className="pd-mascot-badge" title="Mascotte">⭐</span>}
      <PetSprite species={pet.species} art={art} size={84} />
      <div className="pd-card-body">
        <h3>{pet.nick || sp.name} <small>Lv {pet.level}</small>
          {gradeOfLevel(pet.level) > Object.keys(pet.learned || {}).filter((k) => k <= gradeOfLevel(pet.level)).length && <span className="pd-newmove" title="Ha un grado di mosse da scegliere (Dettagli)">✨ mossa nuova</span>}
        </h3>
        <div className="pd-chips"><TypeChip type={sp.type} /><RarityChip rarity={sp.rarity} /></div>
        <ResLine species={pet.species} compact />
        <div className="pd-xp"><Bar value={pet.xp} max={xpToNext(pet.level)} kind="xp" /><small>{pet.xp}/{xpToNext(pet.level)} PE</small></div>
        <dl className="pd-stats pd-stats--row">
          <div><dt>PF</dt><dd>{st.hp}</dd></div><div><dt>ATK</dt><dd>{st.atk}</dd></div>
          <div><dt>DIF</dt><dd>{st.def}</dd></div><div><dt>VEL</dt><dd>{st.spd}</dd></div>
          <div><dt>CA</dt><dd>{dndOf(pet.species, pet.level).ac}</dd></div><div><dt>Colpire</dt><dd>+{dndOf(pet.species, pet.level).toHit}</dd></div>
        </dl>
        {pet.charm && PET_BAG[pet.charm.id] && <p className="pd-holding">{PET_BAG[pet.charm.id].icon} Tiene {PET_BAG[pet.charm.id].name} · {pet.charm.left} lotte</p>}
        <div className="pd-card-actions">
          <button type="button" className="pd-btn" onClick={onToggle} disabled={!inTeam && !canAdd}>
            {inTeam ? "Togli dalla squadra" : canAdd ? "In squadra" : "Squadra piena"}
          </button>
          <button type="button" className={`pd-btn${isMascot ? " pd-btn--star" : " pd-btn--ghost"}`} onClick={onMascot} title={`La mascotte prende il ${Math.round(MASCOT_XP_BONUS * 100)}% di PE in più e si vede accanto al tuo avatar`}>
            {isMascot ? "⭐ Mascotte" : "☆ Fai mascotte"}
          </button>
          <button type="button" className="pd-btn pd-btn--ghost" onClick={() => setOpen((o) => !o)}>{open ? "Chiudi" : "Dettagli"}</button>
        </div>
        {open && (
          <div className="pd-card-more">
            <p className="pd-fine">{sp.desc}</p>
            <ResLine species={pet.species} />
            <MovePanel pet={pet} onLearn={onLearn} onMoveset={onMoveset} />
            <div className="pd-rename">
              <input value={nick} maxLength={18} placeholder={sp.name} onChange={(e) => setNick(e.target.value)} />
              <button type="button" className="pd-btn" onClick={() => onRename(nick)}>Rinomina</button>
            </div>
            <button type="button" className="pd-btn pd-btn--danger" onClick={onRelease}>Libera nel bosco</button>
          </div>
        )}
      </div>
    </article>
  );
}

function TeamTab({ uid, den, art, run }) {
  const team = den.team.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  const rest = den.pets.filter((p) => !den.team.includes(p.id));
  const toggle = (p) => {
    const next = den.team.includes(p.id) ? den.team.filter((x) => x !== p.id) : [...den.team, p.id];
    if (!next.length) return run(async () => { throw new Error("Serve almeno un pet in squadra."); });
    return run(() => setTeam(uid, next));
  };
  const lead = (p) => run(() => setTeam(uid, [p.id, ...den.team.filter((x) => x !== p.id)]), `${p.nick || PET_DEX[p.species].name} entra in campo per primo.`);
  const card = (p, i) => (
    <PetCard
      key={p.id} pet={p} art={art} inTeam={den.team.includes(p.id)} slot={i}
      canAdd={den.team.length < MAX_TEAM}
      onToggle={() => toggle(p)}
      onRename={(n) => run(() => renamePet(uid, p.id, n), "Nome cambiato.")}
      onRelease={() => window.confirm(`Liberare ${p.nick || PET_DEX[p.species].name}? Non torna più.`) && run(() => releasePet(uid, p.id), "Liberato.")}
      onLearn={(g, m) => run(() => learnMove(uid, p.id, g, m), `${p.nick || PET_DEX[p.species].name} impara ${PET_DEX_MOVES[m].name}!`)}
      onMoveset={(list) => run(() => setMoveset(uid, p.id, list))}
      isMascot={den.mascot === p.id}
      onMascot={() => run(() => setMascot(uid, den.mascot === p.id ? null : p.id), den.mascot === p.id ? "Niente più mascotte." : `${p.nick || PET_DEX[p.species].name} è la tua mascotte!`)}
    />
  );
  return (
    <div className="pd-tab">
      <p className="pd-fine">⭐ La mascotte prende il {Math.round(MASCOT_XP_BONUS * 100)}% di PE in più e si vede accanto al tuo avatar in alto.</p>
      <h2 className="pd-h2">In squadra <small>{team.length}/{MAX_TEAM} · il primo entra in campo</small></h2>
      <div className="pd-team">
        {team.map((p, i) => (
          <div key={p.id} className="pd-team-slot">
            {card(p, i)}
            {i > 0 && <button type="button" className="pd-lead" onClick={() => lead(p)}>⬆ Primo in campo</button>}
          </div>
        ))}
        {Array.from({ length: MAX_TEAM - team.length }).map((_, i) => (
          <div key={`e${i}`} className="pd-team-empty">Posto libero</div>
        ))}
      </div>
      <h2 className="pd-h2">Collezione <small>{den.pets.length} pet</small></h2>
      {rest.length ? <div className="pd-grid">{rest.map((p) => card(p, -1))}</div>
        : <p className="pd-empty">Tutti i tuoi pet sono in squadra. Altri escono dalle uova.</p>}
    </div>
  );
}

/* ── uova ─────────────────────────────────────────────────── */
export function EggArt({ egg, size = 72, wobble = false, crack = false }) {
  const el = EGGS[egg]?.element;
  const [c1, c2, c3] = el ? TYPE_COLORS[el] : ["#ffffff", "#c9b6ff", "#5b3fa8"];
  return (
    <span
      className={`pd-egg${el ? "" : " is-prism"}${wobble ? " is-wobble" : ""}${crack ? " is-crack" : ""}`}
      style={{ "--pd-size": `${size}px`, "--e1": c1, "--e2": c2, "--e3": c3 }}
      aria-label={EGGS[egg]?.name}
    >
      <span className="pd-egg-shell" />
      {el && <span className="pd-egg-mark">{TYPE_ICON[el]}</span>}
    </span>
  );
}

const pct = (n) => (n >= 10 ? n.toFixed(0) : n >= 1 ? n.toFixed(1) : n.toFixed(2)).replace(".", ",");

function EggShopTab({ uid, den, art, points, run, ledger, goNest }) {
  const [open, setOpen] = useState(null);
  const full = den.eggs.length >= MAX_EGGS;
  return (
    <div className="pd-tab">
      <div className="pd-shop-head">
        <h2 className="pd-h2">Bottega delle uova <small>nel nido {den.eggs.length}/{MAX_EGGS}</small></h2>
        {den.eggs.length > 0 && <button type="button" className="pd-btn" onClick={goNest}>🥚 Vai al nido</button>}
      </div>
      <p className="pd-fine">Compri l'uovo, lo schiudi nel nido e scopri chi c'è dentro. Se esce un pet che hai già in {MAX_PER_SPECIES} copie, diventa punti pet.</p>
      <div className="pd-eggshop">
        {EGG_ORDER.map((k) => {
          const egg = EGGS[k];
          const chances = eggChances(k);
          const isOpen = open === k;
          return (
            <article key={k} className={`pd-eggcard${k === "prismatic" ? " is-prism" : ""}`}>
              <EggArt egg={k} size={78} />
              <h3>{egg.name}</h3>
              {egg.element && <TypeChip type={egg.element} />}
              <p>{egg.desc}</p>
              <ul className="pd-odds">
                {HATCH_RARITIES.map((r) => (
                  <li key={r} style={{ "--pd-rc": RARITY[r].color }}><span>{RARITY[r].label}</span><b>{pct(egg.odds[r])}%</b></li>
                ))}
              </ul>
              <button type="button" className="pd-link" onClick={() => setOpen(isOpen ? null : k)}>
                {isOpen ? "Nascondi" : `Chi può uscire (${Object.keys(chances).length})`}
              </button>
              {isOpen && (
                <ul className="pd-eggpool">
                  {Object.entries(chances).sort((a, b) => b[1] - a[1]).map(([sk, c]) => (
                    <li key={sk}>
                      <PetSprite species={sk} art={art} size={34} />
                      <span>{PET_DEX[sk].name}{countOf(den, sk) ? " ✓" : ""}</span>
                      <small style={{ color: RARITY[hatchRarityOf(sk)].color }}>{pct(c)}%</small>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button" className="pd-btn pd-btn--main" disabled={full || points < egg.cost}
                onClick={() => window.confirm(`Comprare un ${egg.name} per ${egg.cost} punti pet?`) && run(() => buyEgg(uid, k), `${egg.name} nel nido!`)}
              >
                {full ? "Nido pieno" : `Compra · ${egg.cost} pt`}
              </button>
            </article>
          );
        })}
      </div>
      <p className="pd-fine">Le percentuali per pet tengono conto delle rarità che un elemento non ha (per esempio un uovo senza leggendari dà più epici).</p>
      <h2 className="pd-h2">Come si guadagnano i punti</h2>
      <ul className="pd-howto">
        <li>⚔ Arena: round e tornei vinti, Sfide Libere concluse</li>
        <li>🗓 Login del giorno</li>
        <li>🐉 Vittoria contro il World Boss</li>
        <li>🗼 Ogni nuovo piano della Torre</li>
        <li>💰 Uova e pet compaiono anche all'asta del Mercato Nero</li>
      </ul>
      {ledger.length > 0 && (
        <>
          <h2 className="pd-h2">Ultimi movimenti</h2>
          <ul className="pd-ledger">
            {ledger.slice(0, 8).map((l, i) => (
              <li key={i}><span>{l.label}</span><b>+{l.amount}</b><small>{String(l.ts || "").slice(0, 10)}</small></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function NestTab({ uid, den, art, goShop }) {
  const [hatch, setHatch] = useState(null); // { egg, phase, result, error }
  const start = async (e) => {
    if (hatch) return;
    setHatch({ egg: e.egg, phase: "shake" });
    const wait = new Promise((r) => setTimeout(r, 1900));
    try {
      const [res] = await Promise.all([hatchEgg(uid, e.id), wait]);
      setHatch((h) => ({ ...h, phase: "crack", result: res }));
      setTimeout(() => setHatch((h) => (h ? { ...h, phase: "reveal" } : h)), 650);
    } catch (err) {
      setHatch({ egg: e.egg, phase: "error", error: err.message || String(err) });
    }
  };
  return (
    <div className="pd-tab">
      <h2 className="pd-h2">Il nido <small>{den.eggs.length}/{MAX_EGGS} uova</small></h2>
      {!den.eggs.length ? (
        <div className="pd-nest-empty">
          <EggArt egg="prismatic" size={70} />
          <p>Il nido è vuoto. Le uova si comprano in bottega coi punti pet, o si vincono al Mercato Nero.</p>
          <button type="button" className="pd-btn pd-btn--main" onClick={goShop}>Alla bottega delle uova</button>
        </div>
      ) : (
        <div className="pd-nest">
          {[...den.eggs].sort((a, b) => EGG_ORDER.indexOf(a.egg) - EGG_ORDER.indexOf(b.egg)).map((e, i) => (
            <button key={e.id} type="button" className="pd-nest-egg" onClick={() => start(e)} disabled={!!hatch}>
              <EggArt egg={e.egg} size={70} wobble={i % 3 === 0} />
              <span>{EGGS[e.egg]?.name}</span>
              <small>{e.from === "mercato" ? "dal Mercato" : e.from === "master" ? "dono del Master" : "dalla bottega"}</small>
              <b>Schiudi</b>
            </button>
          ))}
        </div>
      )}
      {hatch && <HatchModal hatch={hatch} art={art} onClose={() => setHatch(null)} />}
    </div>
  );
}

function HatchModal({ hatch, art, onClose }) {
  const r = hatch.result;
  const sp = r ? PET_DEX[r.species] : null;
  const rar = r ? RARITY[r.rarity] : null;
  return (
    <div className="pd-hatch" role="dialog" aria-label="Schiusa">
      <div className={`pd-hatch-box${hatch.phase === "reveal" ? ` is-reveal is-${r?.rarity}` : ""}`} style={{ "--pd-rc": rar?.color || "#fff" }}>
        {hatch.phase === "error" ? (
          <>
            <p>{hatch.error}</p>
            <button type="button" className="pd-btn" onClick={onClose}>Chiudi</button>
          </>
        ) : hatch.phase !== "reveal" ? (
          <>
            <div className="pd-hatch-stage">
              <EggArt egg={hatch.egg} size={150} wobble crack={hatch.phase === "crack"} />
              {hatch.phase === "crack" && <span className="pd-hatch-flash" />}
            </div>
            <p className="pd-hatch-txt">{hatch.phase === "crack" ? "Crack!" : "Qualcosa si muove…"}</p>
          </>
        ) : (
          <>
            <div className="pd-hatch-stage">
              <span className="pd-hatch-rays" />
              <PetSprite species={r.species} art={art} size={170} />
            </div>
            <p className="pd-hatch-rar">{rar.label}</p>
            <h2>{sp.name}</h2>
            <div className="pd-chips pd-chips--center"><TypeChip type={sp.type} /></div>
            <p className="pd-fine">{sp.desc}</p>
            <p className="pd-hatch-note">
              {r.refunded ? `Ne avevi già ${MAX_PER_SPECIES}: diventa +${r.refunded} punti pet.` : r.joined ? "È entrato in squadra!" : "È nella tua collezione."}
            </p>
            <button type="button" className="pd-btn pd-btn--main" onClick={onClose}>Evviva!</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Pet Dex: il catalogo ─────────────────────────────────── */
function DexTab({ den, art }) {
  const [f, setF] = useState(emptyFilter);
  const list = filterSpecies(f);
  const owned = PET_DEX_ORDER.filter((k) => countOf(den, k) > 0).length;
  const typeList = (arr) => arr.map((t) => `${TYPE_ICON[t]} ${TYPE_LABEL[t]}`).join(", ") || "—";
  return (
    <div className="pd-tab">
      <p className="pd-fine">{owned}/{PET_DEX_ORDER.length} specie scoperte · {list.length} mostrate</p>
      <FilterBar f={f} set={setF} />
      {f.el !== "all" && (
        <p className="pd-fine">{TYPE_ICON[f.el]} {TYPE_LABEL[f.el]}: forte contro {typeList(strongAgainst(f.el))} · debole contro {typeList(weakAgainst(f.el))}.</p>
      )}
      {!list.length && <p className="pd-empty">Nessun pet con questi filtri.</p>}
      <div className="pd-dex">
        {list.map((k) => {
          const sp = PET_DEX[k];
          const n = countOf(den, k);
          return (
            <article key={k} className={`pd-dex-card${n ? " is-owned" : ""}`}>
              <span className="pd-dex-n">#{String(PET_DEX_ORDER.indexOf(k) + 1).padStart(2, "0")}</span>
              <PetSprite species={k} art={art} size={80} />
              <h3>{sp.name}</h3>
              <div className="pd-chips pd-chips--center"><TypeChip type={sp.type} /><RarityChip rarity={sp.rarity} /></div>
              <p>{sp.desc}</p>
              <ResLine species={k} />
              <p className="pd-dex-own">{n ? `Ne hai ${n}/${MAX_PER_SPECIES}` : "Non ancora tuo"}</p>
              <p className="pd-dex-egg">Esce da: {EGGS[sp.type]?.name} o Prismatico{sp.rarity === "starter" ? " (o come iniziale)" : ""}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ── Torre ────────────────────────────────────────────────── */
function TowerTab({ uid, den, art, onFight }) {
  const floor = den.tower.floor || 1;
  const team = den.team.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  const plan = towerFloor(floor);
  const upcoming = [floor + 1, floor + 2, floor + 3].map(towerFloor);
  return (
    <div className="pd-tab">
      <div className="pd-tower">
        <div className="pd-tower-now">
          <p className="pd-eyebrow">Torre dei Cuccioli · piano</p>
          <div className="pd-tower-floor">{floor}</div>
          <p className="pd-sub">Record: piano {den.tower.best || 0} · {den.tower.wins || 0} vittorie</p>
          {plan.boss && <p className="pd-tower-boss">👑 Piano del Guardiano</p>}
          <dl className="pd-tower-meta">
            <div><dt>Avversario</dt><dd>{AI_LABEL[plan.aiLevel]}</dd></div>
            <div><dt>Premio</dt><dd>{towerXp(floor)} PE a testa · {towerPoints(floor)} pt</dd></div>
          </dl>
          <div className="pd-tower-foes">
            {plan.team.map((t) => (
              <div key={t.id} className="pd-foe">
                <PetSprite species={t.species} art={art} size={72} flip />
                <span>{PET_DEX[t.species].name}</span>
                <small>Lv {t.level} · {TYPE_ICON[PET_DEX[t.species].type]} · CA {dndOf(t.species, t.level).ac}</small>
                <ResLine species={t.species} compact />
              </div>
            ))}
          </div>
          <button type="button" className="pd-btn pd-btn--main pd-btn--big" disabled={!team.length} onClick={() => onFight(plan)}>
            ⚔ Sali al piano {floor}
          </button>
          <p className="pd-fine">La torre non finisce mai: ogni piano è sempre uguale per tutti, con avversari diversi e sempre più forti. Vinci e passi al piano dopo; perdi e ritenti lo stesso piano (la squadra prende comunque un po' di PE). Fin dove arrivi lo dice la classifica. Premi: ogni 5 piani un amuleto, ogni 10 una pergamena, ogni 25 una Caramella Rara (e 1% a ogni piano).</p>
        </div>
        <div className="pd-tower-next">
          <h3>Più in alto…</h3>
          {upcoming.map((u) => (
            <div key={u.floor} className="pd-tower-row">
              <b>{u.floor}</b>
              <span>{u.team.map((t) => `${PET_DEX[t.species].icon} Lv ${t.level}`).join(" · ")}</span>
              <small>{AI_LABEL[u.aiLevel]}{u.boss ? " · 👑" : ""}</small>
            </div>
          ))}
          <p className="pd-fine">I tuoi in squadra: {team.map((p) => `${p.nick || PET_DEX[p.species].name} Lv ${p.level}`).join(", ") || "nessuno"}</p>
          <TowerBoard uid={uid} />
        </div>
      </div>
    </div>
  );
}

/* ── Sfide fra giocatori ──────────────────────────────────── */
const MATCH_LABEL = { pending: "in attesa", active: "in corso", done: "conclusa", declined: "rifiutata", cancelled: "annullata" };
function ChallengesTab({ uid, char, den, matches, master, run, openMatch }) {
  const [players, setPlayers] = useState(null);
  useEffect(() => {
    getDocs(collection(db, "characters")).then((snap) => setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => c.name && (c.petDen?.team || []).length && !isHiddenChar(c) && (c.id !== uid || master))
      .sort((a, b) => a.name.localeCompare(b.name)))).catch(() => setPlayers([]));
  }, [uid, master]);
  const team = den.team.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  const myName = char?.name || "Un domatore";
  const challenge = (c) => window.confirm(`Sfidare ${c.id === uid ? "te stesso (prova)" : c.name} con la tua squadra attuale?`)
    && run(() => createChallenge({ uid, name: myName, den, foeUid: c.id, foeName: c.id === uid ? `${myName} (2)` : c.name }), "Sfida inviata!");
  const by = (st) => matches.filter((m) => m.status === st);
  const incoming = by("pending").filter((m) => m.b === uid);
  const outgoing = by("pending").filter((m) => m.a === uid && m.b !== uid);
  const active = by("active");
  const done = matches.filter((m) => ["done", "declined", "cancelled"].includes(m.status)).slice(0, 12);
  const foeOf = (m) => (m.a === uid ? m.bName : m.aName);
  return (
    <div className="pd-tab">
      <p className="pd-fine">Sfida un altro domatore con la tua squadra (fino a {MAX_TEAM} pet). Si gioca a turni: ognuno sceglie la sua mossa quando può, anche a distanza di ore. Vittoria = PE alla squadra e +{PVP_POINTS} punti pet (le prime {PVP_DAILY} vittorie del giorno); chi perde prende un terzo dei PE. Le statistiche: {den.pvp.wins} vinte · {den.pvp.losses} perse.</p>
      {incoming.length > 0 && (
        <>
          <h2 className="pd-h2">Sfide ricevute</h2>
          <div className="pd-mlist">
            {incoming.map((m) => (
              <div key={m.id} className="pd-mrow is-hot">
                <span><b>{m.aName}</b> ti sfida · {(m.teams?.p || []).map((p) => `${PET_DEX[p.species]?.icon} Lv ${p.level}`).join(" ")}</span>
                <span className="pd-mrow-actions">
                  <button type="button" className="pd-btn pd-btn--main" disabled={!team.length} onClick={() => run(() => acceptChallenge(m.id, uid).then(() => { unlockAudio(); openMatch(m.id); }))}>Accetta</button>
                  {m.a !== uid && <button type="button" className="pd-btn pd-btn--ghost" onClick={() => run(() => declineChallenge(m.id), "Sfida rifiutata.")}>Rifiuta</button>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {active.length > 0 && (
        <>
          <h2 className="pd-h2">In corso</h2>
          <div className="pd-mlist">
            {active.map((m) => {
              const mineTurn = !!pendingSide(m, uid);
              return (
                <div key={m.id} className={`pd-mrow${mineTurn ? " is-hot" : ""}`}>
                  <span>contro <b>{foeOf(m)}</b> · turno {(m.seq || 0) + 1} · {mineTurn ? "✨ tocca a te" : "aspetti l'altro"}</span>
                  <button type="button" className="pd-btn pd-btn--main" onClick={() => { unlockAudio(); openMatch(m.id); }}>Entra</button>
                </div>
              );
            })}
          </div>
        </>
      )}
      {outgoing.length > 0 && (
        <>
          <h2 className="pd-h2">Sfide inviate</h2>
          <div className="pd-mlist">
            {outgoing.map((m) => (
              <div key={m.id} className="pd-mrow">
                <span>a <b>{m.bName}</b> · in attesa che accetti</span>
                <button type="button" className="pd-btn pd-btn--ghost" onClick={() => run(() => cancelChallenge(m.id), "Sfida annullata.")}>Annulla</button>
              </div>
            ))}
          </div>
        </>
      )}
      <h2 className="pd-h2">Lancia una sfida <small>la tua squadra: {team.map((p) => `${p.nick || PET_DEX[p.species].name} Lv ${p.level}`).join(", ") || "vuota"}</small></h2>
      {players === null ? <p className="pd-loading">Cerco i domatori…</p> : !players.length ? <p className="pd-empty">Nessun altro domatore ha ancora una squadra.</p> : (
        <div className="pd-mlist">
          {players.map((c) => {
            const d = denOf(c);
            const t = d.team.map((id) => d.pets.find((p) => p.id === id)).filter(Boolean);
            return (
              <div key={c.id} className="pd-mrow">
                <span className="pd-mrow-who">
                  <b>{c.id === uid ? "Te stesso (prova)" : c.name}</b>
                  <small>{t.map((p) => `${PET_DEX[p.species]?.icon} Lv ${p.level}`).join(" ")} · torre {d.tower.best || 0}</small>
                </span>
                <button type="button" className="pd-btn" disabled={!team.length} onClick={() => challenge(c)}>⚔ Sfida</button>
              </div>
            );
          })}
        </div>
      )}
      {done.length > 0 && (
        <>
          <h2 className="pd-h2">Ultime sfide</h2>
          <div className="pd-mlist">
            {done.map((m) => {
              const mine = sidesOf(m, uid);
              const res = m.status !== "done" ? MATCH_LABEL[m.status] : m.a === m.b ? "prova" : mine.includes(m.winner) ? "🏆 vinta" : "persa";
              return (
                <div key={m.id} className="pd-mrow is-past">
                  <span>contro <b>{foeOf(m)}</b> · {res}{m.forfeit ? " (abbandono)" : ""}</span>
                  {m.status === "done" && <button type="button" className="pd-btn pd-btn--ghost" onClick={() => openMatch(m.id)}>Rivedi</button>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Bisaccia del Domatore: oggetti posseduti e bottega ──── */
function BagUse({ id, den, onDone, run, uid }) {
  const it = PET_BAG[id];
  const [petId, setPetId] = useState(den.pets[0]?.id || "");
  const [forget, setForget] = useState("");
  const pet = den.pets.find((p) => p.id === petId);
  const known = pet ? knownMoves(pet) : [];
  const go = () => {
    if (!pet) return;
    const name = pet.nick || PET_DEX[pet.species].name;
    if (it.kind === "charm") {
      if (pet.charm && !window.confirm(`${name} tiene già ${PET_BAG[pet.charm.id]?.name}: si perde. Continuare?`)) return;
      return run(() => giveCharm(uid, pet.id, id), `${name} tiene ${it.name}.`).then(onDone);
    }
    if (it.kind === "scroll") {
      if (!forget) return;
      return run(() => teachScroll(uid, pet.id, id, forget), `${name} dimentica ${PET_DEX_MOVES[forget].name} e impara ${PET_DEX_MOVES[it.move].name}!`).then(onDone);
    }
    return run(() => applyGrowthItem(uid, pet.id, id), `${it.name} usata su ${name}!`).then(onDone);
  };
  return (
    <div className="pd-baguse">
      <label>Su quale pet?
        <select value={petId} onChange={(e) => { setPetId(e.target.value); setForget(""); }}>
          {den.pets.map((p) => <option key={p.id} value={p.id}>{p.nick || PET_DEX[p.species].name} · Lv {p.level} · {TYPE_ICON[PET_DEX[p.species].type]}{p.charm ? ` · tiene ${PET_BAG[p.charm.id]?.icon}` : ""}</option>)}
        </select>
      </label>
      {it.kind === "scroll" && pet && (
        known.includes(it.move) ? <p className="pd-fine">La conosce già.</p> : (
          <label>Quale mossa dimentica?
            <select value={forget} onChange={(e) => setForget(e.target.value)}>
              <option value="">— scegli —</option>
              {known.map((m) => <option key={m} value={m}>{TYPE_ICON[PET_DEX_MOVES[m].type]} {PET_DEX_MOVES[m].name}{(pet.tms || []).includes(m) ? " (pergamena)" : ""}</option>)}
            </select>
          </label>
        )
      )}
      <button type="button" className="pd-btn pd-btn--main" disabled={!pet || (it.kind === "scroll" && (!forget || known.includes(it.move)))} onClick={go}>Usa</button>
      <button type="button" className="pd-btn pd-btn--ghost" onClick={onDone}>Annulla</button>
    </div>
  );
}

function BagTab({ uid, den, points, run }) {
  const [using, setUsing] = useState(null);
  const [shopKind, setShopKind] = useState("charm");
  const [shopEl, setShopEl] = useState("all");
  const owned = BAG_ORDER.filter((k) => den.items[k] > 0);
  const holders = den.pets.filter((p) => p.charm && PET_BAG[p.charm.id]);
  const shop = BAG_ORDER.filter((k) => {
    const it = PET_BAG[k];
    if (!it.price) return false;
    if (shopKind === "scroll") return it.kind === "scroll" && (shopEl === "all" || PET_DEX_MOVES[it.move].type === shopEl);
    return shopKind === "charm" ? it.kind === "charm" : it.kind === "xp";
  });
  const row = (k, buy) => {
    const it = PET_BAG[k];
    const mv = it.move && PET_DEX_MOVES[it.move];
    return (
      <article key={k} className={`pd-item pd-item--${it.rarity}`}>
        <span className="pd-item-icon" aria-hidden="true">{it.icon}</span>
        <div className="pd-item-body">
          <h3>{it.name} {!buy && <small>×{den.items[k]}</small>}</h3>
          <p>{it.desc}{it.fights ? ` Dura ${it.fights} lotte.` : ""}</p>
          {mv && <small className="pd-fine">{TYPE_ICON[mv.type]} {moveInfo(it.move)}</small>}
          {buy ? (
            <button type="button" className="pd-btn" disabled={points < it.price} onClick={() => window.confirm(`Comprare ${it.name} per ${it.price} punti pet?`) && run(() => buyItem(uid, k), `${it.name} nella bisaccia!`)}>Compra · {it.price} pt</button>
          ) : using === k ? (
            <BagUse id={k} den={den} uid={uid} run={run} onDone={() => setUsing(null)} />
          ) : (
            <button type="button" className="pd-btn pd-btn--main" onClick={() => setUsing(k)}>{it.kind === "charm" ? "Fai tenere" : it.kind === "scroll" ? "Insegna" : "Usa"}</button>
          )}
        </div>
      </article>
    );
  };
  return (
    <div className="pd-tab">
      <p className="pd-fine">Amuleti da far tenere ai pet (valgono per alcune lotte, Torre o sfide), pietre e caramelle per crescere, pergamene per insegnare mosse di QUALUNQUE elemento al posto di un'altra (massimo {SCROLL_SLOTS} per pet). La Caramella Rara non si compra: esce solo dalla Torre.</p>
      <h2 className="pd-h2">Nella bisaccia <small>{owned.reduce((a, k) => a + den.items[k], 0)} oggetti</small></h2>
      {owned.length ? <div className="pd-items">{owned.map((k) => row(k, false))}</div> : <p className="pd-empty">La bisaccia è vuota. Gli oggetti escono dalla Torre (Guardiani, ogni 10 piani), dalle sfide vinte e dalla bottega qui sotto.</p>}
      {holders.length > 0 && (
        <>
          <h2 className="pd-h2">Amuleti in uso</h2>
          <ul className="pd-ledger">
            {holders.map((p) => <li key={p.id}><span>{PET_BAG[p.charm.id].icon} {p.nick || PET_DEX[p.species].name} tiene {PET_BAG[p.charm.id].name}</span><b>{p.charm.left}</b><small>lotte</small></li>)}
          </ul>
        </>
      )}
      <h2 className="pd-h2">Bottega degli oggetti <small>{points} punti pet</small></h2>
      <div className="pd-filters">
        {[["charm", "Amuleti"], ["xp", "Esperienza"], ["scroll", "Pergamene"]].map(([k, l]) => (
          <button key={k} type="button" className={`pd-chipbtn${shopKind === k ? " is-on" : ""}`} aria-pressed={shopKind === k} onClick={() => setShopKind(k)}>{l}</button>
        ))}
        {shopKind === "scroll" && (
          <select value={shopEl} onChange={(e) => setShopEl(e.target.value)} aria-label="Elemento">
            <option value="all">Tutti gli elementi</option>
            {[...ELEMENTS, "neutral"].map((el) => <option key={el} value={el}>{TYPE_ICON[el]} {TYPE_LABEL[el]}</option>)}
          </select>
        )}
      </div>
      <div className="pd-items">{shop.map((k) => row(k, true))}</div>
    </div>
  );
}

/* ── Classifica della Torre ───────────────────────────────── */
function TowerBoard({ uid }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    getDocs(collection(db, "characters")).then((snap) => setRows(snap.docs.map((d) => ({ id: d.id, name: d.data().name, best: d.data().petDen?.tower?.best || 0, hidden: isHiddenChar(d.data()) }))
      .filter((r) => r.name && r.best > 0 && !r.hidden).sort((a, b) => b.best - a.best).slice(0, 20))).catch(() => setRows([]));
  }, []);
  if (!rows) return null;
  return (
    <div className="pd-board">
      <h3>🏆 Classifica della Torre</h3>
      {!rows.length ? <p className="pd-fine">Nessuno ha ancora superato un piano.</p> : (
        <ol>
          {rows.map((r, i) => <li key={r.id} className={r.id === uid ? "is-me" : ""}><span>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`} {r.name}</span><b>piano {r.best}</b></li>)}
        </ol>
      )}
    </div>
  );
}

/* ── LOTTA ────────────────────────────────────────────────── */
const STEP_MS = 850;
const STATUS_TXT = { burn: "🔥 Scottato", poison: "☠ Avvelenato (svantaggio)", stun: "💫 Intontito" };
const sgn = (n) => (n >= 0 ? `+${n}` : `−${-n}`);

// Mostra le righe di un turno una alla volta (con il loro suono).
function useLinePlayer() {
  const [queue, setQueue] = useState([]);
  const [shown, setShown] = useState(null);
  const [seq, setSeq] = useState(0);
  useEffect(() => {
    if (!queue.length) return undefined;
    const t = setTimeout(() => { setShown(queue[0]); setSeq((n) => n + 1); setQueue((q) => q.slice(1)); }, STEP_MS);
    return () => clearTimeout(t);
  }, [queue]);
  useEffect(() => { sfx(shown); }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps
  const play = (events) => {
    setShown(events[0] || null);
    setSeq((n) => n + 1);
    setQueue(events.slice(1));
  };
  return { shown, seq, busy: queue.length > 0, play };
}

function AudioToggles() {
  const [prefs, setPrefs] = useState(audioPrefs);
  useEffect(() => onAudioPrefs(setPrefs), []);
  return (
    <span className="pd-audio">
      <button type="button" className={`pd-audio-btn${prefs.musicOn ? "" : " is-off"}`} onClick={() => setMusicOn(!prefs.musicOn)}
        aria-pressed={prefs.musicOn} title={prefs.musicOn ? "Spegni la musica" : "Accendi la musica"}>{prefs.musicOn ? "🎵" : "🔇"}<small>Musica</small></button>
      <button type="button" className={`pd-audio-btn${prefs.sfxOn ? "" : " is-off"}`} onClick={() => setSfxOn(!prefs.sfxOn)}
        aria-pressed={prefs.sfxOn} title={prefs.sfxOn ? "Spegni gli effetti" : "Accendi gli effetti"}>{prefs.sfxOn ? "🔊" : "🔈"}<small>Effetti</small></button>
    </span>
  );
}

// Campo di lotta: HUD (con CA), sprite, effetti, dado del tiro e testo.
function BattleScreen({ battle, player, art, top, children, labels = {} }) {
  const { shown, seq, busy } = player;
  const fieldRef = useRef(null);
  const spotP = useRef(null), spotE = useRef(null);
  const snap = busy ? (shown?.snap || null) : null;
  const sideView = (side) => {
    const s = battle.sides[side];
    const idx = snap ? snap[side].active : s.active;
    const f = s.team[idx];
    const hp = snap ? snap[side].hp[idx] : f.hp;
    const status = snap ? snap[side].status[idx] : (f.status?.kind || (f.stunned ? "stun" : null));
    return { f, hp, status, idx };
  };
  const P = sideView("p"), E = sideView("e");
  const hitSide = shown?.kind === "hit" ? shown.target : null;
  const lunge = shown?.kind === "move" ? LUNGE_FX[shown.fx] : null;
  const actCls = (side) => {
    if (!shown) return "";
    if (lunge && shown.side === side) return ` is-${lunge}`;
    if (shown.kind === "move" && ["stomp", "dash", "spikes"].includes(shown.fx) && shown.side !== side) return " is-shaken";
    return "";
  };
  const balls = (side) => battle.sides[side].team.map((f, i) => {
    const hp = snap ? snap[side].hp[i] : f.hp;
    return <span key={i} className={`pd-ball${hp > 0 ? "" : " is-out"}`} />;
  });
  const roll = shown?.kind === "move" ? shown.roll : null;
  const hud = (side, V) => (
    <div className={`pd-hud pd-hud--${side}`}>
      <div className="pd-hud-name"><b>{V.f.name}</b><small>Lv {V.f.level}</small></div>
      {labels[side] && <div className="pd-hud-owner">{labels[side]}</div>}
      <div className="pd-hud-chips">
        <TypeChip type={V.f.type} />
        <span className="pd-ac" title="Classe Armatura">🛡 CA {acOf(V.f)}</span>
        <ResLine species={V.f.species} compact />
        {V.f.charm && PET_BAG[V.f.charm] && <span className="pd-charmchip" title={PET_BAG[V.f.charm].name}>{PET_BAG[V.f.charm].icon}</span>}
        {V.status && <span className="pd-status">{STATUS_TXT[V.status]}</span>}
      </div>
      <Bar value={V.hp} max={V.f.maxHp} />
      {side === "p" && <div className="pd-hud-hp">{V.hp}/{V.f.maxHp} PF</div>}
      <div className="pd-balls">{balls(side)}</div>
    </div>
  );
  return (
    <div className="pd-battle">
      <div className="pd-battle-top">{top}</div>
      <div className={`pd-field${art.__arena?.bg ? " has-bg" : ""}`} ref={fieldRef}
        style={art.__arena?.bg ? { "--pd-bg-img": `url("${art.__arena.bg}")` } : undefined}>
        {hud("e", E)}
        <div className="pd-spot pd-spot--e" ref={spotE}>
          <div key={actCls("e") ? `e${seq}` : "e"} className={`pd-act side-e${actCls("e")}`}>
            <PetSprite key={`e${E.idx}`} species={E.f.species} art={art} size={150} flip fainted={E.hp <= 0} hit={hitSide === "e"} />
          </div>
        </div>
        <div className="pd-spot pd-spot--p" ref={spotP}>
          <div key={actCls("p") ? `p${seq}` : "p"} className={`pd-act side-p${actCls("p")}`}>
            <PetSprite key={`p${P.idx}`} species={P.f.species} art={art} size={170} fainted={P.hp <= 0} hit={hitSide === "p"} />
          </div>
        </div>
        {hud("p", P)}
        {roll && (
          <div key={`r${seq}`} className={`pd-roll${roll.d === 20 ? " is-crit" : roll.d === 1 ? " is-fumble" : ""}${roll.ok ? " is-ok" : " is-ko"}`}>
            <span className="pd-roll-die">{roll.d}</span>
            <span className="pd-roll-math">
              {roll.kind === "save" ? `TS ${sgn(roll.mod)} = ${roll.total} vs CD ${roll.vs}` : `${sgn(roll.mod)} = ${roll.total} vs CA ${roll.vs}`}
              {roll.dis && <small>svantaggio ({roll.d}/{roll.d2})</small>}
            </span>
          </div>
        )}
        <PetFx ev={shown} seq={seq} fieldRef={fieldRef} spotRefs={{ p: spotP, e: spotE }} />
      </div>
      <div className="pd-console">
        <p className="pd-text" aria-live="polite">{shown?.text || battle.log?.[battle.log.length - 1]?.text || ""}</p>
        {children}
      </div>
    </div>
  );
}

// Mosse e cambi del pet in campo (lato "p" della vista).
function BattleControls({ battle, busy, art, onAct, forced }) {
  const [view, setView] = useState("main");
  const me = activeOf(battle, "p");
  const foe = activeOf(battle, "e");
  const bench = benchAlive(battle, "p");
  const act = (a) => { setView("main"); onAct(a); };
  if (forced || view === "switch") {
    return (
      <div className="pd-switch">
        <p className="pd-fine">{forced ? "Chi mandi in campo?" : "Cambiare pet consuma il turno."}</p>
        {bench.map(({ f, i }) => (
          <button key={f.id} type="button" className="pd-switch-btn" disabled={busy} onClick={() => act({ kind: "switch", index: i })}>
            <PetSprite species={f.species} art={art} size={44} />
            <span><b>{f.name}</b> Lv {f.level}<Bar value={f.hp} max={f.maxHp} /></span>
            <small>{f.hp}/{f.maxHp}</small>
          </button>
        ))}
        {!forced && <button type="button" className="pd-btn pd-btn--ghost" onClick={() => setView("main")}>Indietro</button>}
      </div>
    );
  }
  return (
    <div className="pd-actions">
      <div className="pd-movegrid">
        {Object.keys(me.pp).map((m) => {
          const mv = PET_DEX_MOVES[m];
          const hc = foe ? Math.round(hitChance(me, foe, m) * 100) : 100;
          const self = !mv.power && !(mv.effect?.foe || mv.effect?.burn || mv.effect?.poison || mv.effect?.stun);
          return (
            <button key={m} type="button" className="pd-move" style={{ "--tc": TYPE_COLORS[mv.type][1] }} disabled={busy || me.pp[m] <= 0} onClick={() => act({ kind: "move", move: m })}>
              <b>{mv.name}</b>
              <small>{TYPE_ICON[mv.type]} {mv.power ? `pot. ${mv.power}` : "stato"} · PP {me.pp[m]}/{mv.pp}{self ? "" : ` · 🎲 ${hc}%`}</small>
            </button>
          );
        })}
      </div>
      <button type="button" className="pd-btn pd-switch-open" disabled={busy || !bench.length} onClick={() => setView("switch")}>
        🔄 Cambia pet {bench.length ? `(${bench.length})` : ""}
      </button>
    </div>
  );
}

const dropNames = (ids = []) => ids.map((k) => `${PET_BAG[k]?.icon} ${PET_BAG[k]?.name}`).join(", ");

function PetBattle({ uid, den, art, plan, teamIds, onExit, onRetry }) {
  const myPets = teamIds.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  const [battle, setBattleState] = useState(() => {
    const b = newBattle(myPets, plan.team, { enemyBoost: plan.enemyBoost, aiLevel: plan.aiLevel });
    return { ...b, log: [{ text: `Piano ${plan.floor}: l'avversario manda in campo ${activeOf(b, "e").name}!` }, { text: `Vai, ${activeOf(b, "p").name}!` }] };
  });
  const player = useLinePlayer();
  const { busy } = player;
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => { battleMusic(true); return () => battleMusic(false); }, []);
  const jingled = useRef(false);
  useEffect(() => {
    if (!battle.over || busy || jingled.current) return;
    jingled.current = true;
    battleMusic(false);
    jingle(battle.over === "p");
  }, [battle.over, busy]);

  // Fine lotta: salva l'esito una volta sola, dopo l'ultima riga.
  useEffect(() => {
    if (!battle.over || busy || savedRef.current) return;
    savedRef.current = true;
    setSaving(true);
    recordTowerResult(uid, plan.floor, battle.over === "p", teamIds)
      .then((r) => setResult({ ...r, won: battle.over === "p" }))
      .catch((e) => setResult({ won: battle.over === "p", error: e.message }))
      .finally(() => setSaving(false));
  }, [battle.over, busy, uid, plan.floor, teamIds]);

  const act = (action) => {
    if (busy || battle.over) return;
    const { battle: nb, events } = playTurn(battle, action);
    setBattleState(nb);
    player.play(events);
  };

  const top = (
    <>
      <span>🗼 Piano {plan.floor}{plan.boss ? " · 👑 Guardiano" : ""} · {AI_LABEL[plan.aiLevel]}</span>
      <AudioToggles />
      <button type="button" className="pd-btn pd-btn--ghost" onClick={() => (battle.over || window.confirm("Ritirarti? Il piano resta da fare.")) && onExit()}>
        {battle.over ? "Esci" : "Ritirati"}
      </button>
    </>
  );
  return (
    <BattleScreen battle={battle} player={player} art={art} top={top}>
      {battle.over && !busy ? (
        <div className="pd-result">
          {saving && <p>Salvo l'esito…</p>}
          {result && (
            <>
              <h2>{result.won ? "🏆 Piano superato!" : "💤 La squadra è esausta"}</h2>
              {result.error ? <p className="pd-fine">{result.error}</p> : (
                <p>
                  +{result.xp} PE a ogni pet della squadra{result.won ? ` · +${result.pts} punti pet` : ""}.
                  {(result.ups || []).map((u) => ` ${PET_DEX[u.species].name} sale al Lv ${u.level}!`).join("")}
                  {result.drops?.length ? ` Trovato: ${dropNames(result.drops)}!` : ""}
                </p>
              )}
              <div className="pd-result-actions">
                {result.won
                  ? <button type="button" className="pd-btn pd-btn--main" onClick={onExit}>Avanti</button>
                  : <button type="button" className="pd-btn pd-btn--main" onClick={onRetry}>Ritenta il piano</button>}
                <button type="button" className="pd-btn pd-btn--ghost" onClick={onExit}>Al Rifugio</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <BattleControls battle={battle} busy={busy} art={art} onAct={act} forced={battle.needSwitch === "p" && !busy} />
      )}
    </BattleScreen>
  );
}

/* ── Sfida fra giocatori: la lotta letta da pet_matches ───── */
function PvpBattle({ uid, id, art, onExit }) {
  const [m, setM] = useState(null);
  const player = useLinePlayer();
  const lastSeq = useRef(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const claimed = useRef(false);

  useEffect(() => onSnapshot(doc(db, "pet_matches", id), (s) => setM(s.exists() ? { id: s.id, ...s.data() } : false)), [id]);
  useEffect(() => { battleMusic(true); return () => battleMusic(false); }, []);

  const pend = m ? pendingSide(m, uid) : null;
  const mine = m ? sidesOf(m, uid) : [];
  // Il proprio lato sta sempre in basso; contro sé stessi si gira verso chi deve scegliere.
  const viewSide = pend || (mine.includes("p") ? "p" : "e");
  const flip = viewSide === "e";

  // Nuovo turno risolto: mostra le sue righe.
  useEffect(() => {
    if (!m || m.status === "pending") return;
    if (lastSeq.current === null) { lastSeq.current = m.seq || 0; if (!m.seq && m.events) player.play(m.events); return; }
    if ((m.seq || 0) > lastSeq.current) {
      lastSeq.current = m.seq;
      player.play((m.events || []).map((ev) => (flip ? flipEvent(ev) : ev)));
    }
  }, [m?.seq, m?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fine: musichetta e premi (ognuno ritira i suoi, una volta sola).
  const done = m?.status === "done" && !player.busy;
  useEffect(() => {
    if (!done || claimed.current) return;
    claimed.current = true;
    battleMusic(false);
    const myWin = mine.includes(m.winner);
    jingle(m.a === m.b ? true : myWin);
    const side = mine.includes("p") ? "p" : "e";
    recordPvpResult(uid, m, side).then(setResult).catch((e) => setResult({ error: e.message }));
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (m === null) return <p className="pd-loading">Carico la sfida…</p>;
  if (m === false) return <p className="pd-empty">Sfida non trovata. <button type="button" className="pd-btn" onClick={onExit}>Indietro</button></p>;
  if (!m.battle) return <p className="pd-empty">La sfida non è ancora iniziata. <button type="button" className="pd-btn" onClick={onExit}>Indietro</button></p>;

  const battle = flip ? flipBattle(m.battle) : m.battle;
  const foeName = flip ? m.aName : m.bName;
  const send = async (action) => {
    if (!pend || sending) return;
    setSending(true); setErr("");
    try { unlockAudio(); await submitAction(id, pend, action); } catch (e) { setErr(e.message); } finally { setSending(false); }
  };
  const giveUp = () => window.confirm("Abbandonare la sfida? Conta come sconfitta.") && forfeit(id, mine.includes("p") ? "p" : "e").catch((e) => setErr(e.message));
  const self = m.a === m.b;
  const top = (
    <>
      <span>⚔ {m.aName} contro {m.bName}{self ? " · prova" : ""} · turno {(m.seq || 0) + 1}</span>
      <AudioToggles />
      <button type="button" className="pd-btn pd-btn--ghost" onClick={onExit}>Esci</button>
    </>
  );
  const waiting = m.status === "active" && !pend;
  const forcedHere = !!pend && !!m.battle.needSwitch;
  return (
    <BattleScreen battle={battle} player={player} art={art} top={top} labels={{ p: flip ? m.bName : m.aName, e: foeName }}>
      {err && <p className="pd-msg">{err}</p>}
      {done ? (
        <div className="pd-result">
          <h2>{self ? `Vince ${m.winner === "p" ? m.aName : m.bName}` : mine.includes(m.winner) ? "🏆 Sfida vinta!" : "💤 Sfida persa"}</h2>
          {m.forfeit && <p className="pd-fine">{m.forfeit === "p" ? m.aName : m.bName} ha abbandonato.</p>}
          {result && !result.error && !result.self && !result.already && (
            <p>+{result.xp} PE a ogni pet della squadra{result.pts ? ` · +${result.pts} punti pet` : ""}.
              {(result.ups || []).map((u) => ` ${PET_DEX[u.species].name} sale al Lv ${u.level}!`).join("")}
              {result.drops?.length ? ` Trovato: ${dropNames(result.drops)}!` : ""}</p>
          )}
          {result?.self && <p className="pd-fine">Sfida di prova contro te stesso: niente premi.</p>}
          {result?.error && <p className="pd-fine">{result.error}</p>}
          <div className="pd-result-actions"><button type="button" className="pd-btn pd-btn--main" onClick={onExit}>Alle sfide</button></div>
        </div>
      ) : waiting ? (
        <div className="pd-wait">
          <p>⏳ {m.actions?.[viewSide] ? "Mossa scelta: aspetti" : "Tocca a"} {foeName}…</p>
          <small>Ti arriva tutto qui appena sceglie, anche se chiudi e riapri.</small>
          {!player.busy && <button type="button" className="pd-btn pd-btn--danger" onClick={giveUp}>Abbandona</button>}
        </div>
      ) : (
        <>
          {self && <p className="pd-fine">Scegli per {viewSide === "p" ? m.aName : m.bName}.</p>}
          <BattleControls battle={battle} busy={player.busy || sending} art={art} onAct={send} forced={forcedHere} />
          {!forcedHere && <button type="button" className="pd-link" onClick={giveUp}>Abbandona la sfida</button>}
        </>
      )}
    </BattleScreen>
  );
}

/* ── Bestiario del Master: pixel art e prove ──────────────── */
function MasterTools({ uid, den, art, run = async (f) => f(), compact = false }) {
  const [busy, setBusy] = useState({});
  const [looks, setLooks] = useState({});
  const [err, setErr] = useState("");
  const [f, setF] = useState(emptyFilter);
  const lookOf = (k) => looks[k] ?? art[k]?.look ?? PET_DEX[k].look;

  const generate = async (k) => {
    if (busy[k]) return;
    if (art[k]?.image && !window.confirm(`Rifare la pixel art di ${PET_DEX[k].name}?`)) return;
    setBusy((b) => ({ ...b, [k]: true }));
    setErr("");
    try {
      const look = lookOf(k);
      const r = await fetch("/api/genera-immagine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: petArtPrompt(k, look), qualita: true }),
      });
      const data = await r.json();
      if (!r.ok || data.error || !data.immagine) throw new Error(data.error || "Nessuna immagine ricevuta.");
      const png = await dataUrlToTransparentDataUrl(data.immagine, 256);
      await savePetArt(k, png, look);
    } catch (e) {
      setErr(`${PET_DEX[k].name}: ${e.message || e}`);
    } finally {
      setBusy((b) => ({ ...b, [k]: false }));
    }
  };

  const resetMine = () => window.confirm("Azzerare il TUO Rifugio (pet, squadra, torre) per riprovare la scelta iniziale?")
    && run(() => updateDoc(doc(db, "characters", uid), { petDen: deleteField() }), "Rifugio azzerato.");
  const done = PET_DEX_ORDER.filter((k) => art[k]?.image).length;

  return (
    <div className={`pd-tab pd-master${compact ? " is-compact" : ""}`}>
      <div className="pd-master-head">
        <h2 className="pd-h2">Bestiario del Master <small>pixel art {done}/{PET_DEX_ORDER.length}</small></h2>
        <div className="pd-master-tools">
          <Link className="pd-btn pd-btn--ghost" to="/dm-admin/pet-points">Dai punti pet</Link>
          {den.starter && <button type="button" className="pd-btn pd-btn--danger" onClick={resetMine}>Azzera il mio Rifugio</button>}
        </div>
      </div>
      <p className="pd-fine">"Genera pixel art" chiede a Gemini UNA creatura alla volta (la descrizione qui sotto dice cosa disegnare, in inglese; si può ritoccare e resta salvata). Lo sfondo magenta si toglie da solo e il respiro è un'animazione del sito.</p>
      {err && <p className="pd-msg">{err}</p>}
      {den.starter && (
        <div className="pd-master-eggs">
          <span>Oggetti gratis per provare la bisaccia:</span>
          <button type="button" className="pd-btn" onClick={() => run(() => giveItems(uid, ["caramella", "pietra", ...CHARMS.slice(0, 7), SCROLL_IDS[Math.floor(Math.random() * SCROLL_IDS.length)], SCROLL_IDS[Math.floor(Math.random() * SCROLL_IDS.length)]]), "Oggetti nella bisaccia (prova).")}>🎒 Riempi la bisaccia</button>
        </div>
      )}
      {den.starter && (
        <div className="pd-master-eggs">
          <span>Uova gratis per provare la schiusa:</span>
          {EGG_ORDER.map((k) => (
            <button key={k} type="button" className="pd-master-egg" title={EGGS[k].name} onClick={() => run(() => buyEgg(uid, k, { free: true }), `${EGGS[k].name} nel nido (prova).`)}>
              <EggArt egg={k} size={30} />
            </button>
          ))}
        </div>
      )}
      <FilterBar f={f} set={setF} />
      <div className="pd-art-grid">
        {filterSpecies(f).map((k) => {
          const sp = PET_DEX[k];
          return (
            <article key={k} className="pd-art-card">
              <div className="pd-art-preview"><PetSprite species={k} art={art} size={96} /></div>
              <div className="pd-art-body">
                <h3>{sp.name} <RarityChip rarity={sp.rarity} /></h3>
                <textarea rows={3} value={lookOf(k)} onChange={(e) => setLooks((l) => ({ ...l, [k]: e.target.value }))} />
                <div className="pd-art-actions">
                  <button type="button" className="pd-btn pd-btn--main" disabled={busy[k]} onClick={() => generate(k)}>
                    {busy[k] ? "Gemini disegna…" : art[k]?.image ? "↻ Rifai pixel art" : "✨ Genera pixel art"}
                  </button>
                  {looks[k] != null && looks[k] !== (art[k]?.look ?? sp.look) && (
                    <button type="button" className="pd-btn pd-btn--ghost" onClick={() => run(() => savePetLook(k, looks[k]), "Descrizione salvata.")}>Salva descrizione</button>
                  )}
                  {den.starter && countOf(den, k) < MAX_PER_SPECIES && (
                    <button type="button" className="pd-btn pd-btn--ghost" onClick={() => run(() => givePet(uid, k), `${sp.name} aggiunto (prova).`)}>+ Dammelo</button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
