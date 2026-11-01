/* ============================================================
   IL RIFUGIO DEI PET (2026-10-31) — /pet
   Nuovo sistema pet alla Pokémon (dati in data/petDex.js, lotta in
   data/petEngine.js, scritture in utils/petDen.js). Aperto a tutti i
   giocatori dal 2026-10-31; Bestiario, Giocatori e gli strumenti di
   prova restano del Master principale (isMainMaster).
   Hub a piastrelle → sezioni (ognuna con "← Torna all'hub"): Squadra ·
   Nido · Bottega delle uova · Torre · Pet Dex · Manuale · Bestiario e
   Giocatori (solo Master: pixel art con Gemini, reset di punti e pet).
   ============================================================ */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { collection, deleteField, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import { isHiddenChar } from "../data/hiddenPlayers";
import {
  PET_DEX, PET_DEX_ORDER, PET_DEX_MOVES, STARTERS, RARITY, MAX_TEAM, MAX_PER_SPECIES, MAX_EGGS,
  MOVE_UNLOCK, TYPE_ICON, TYPE_LABEL, TYPE_COLORS, ELEMENTS, EGGS, EGG_ORDER, HATCH_RARITIES,
  eggChances, hatchRarityOf, strongAgainst, weakAgainst, DMG_ICON, DMG_LABEL, ELEMENT_ODDS, PRISM_ODDS,
  MOVE_GRADES, MAX_MOVES, GRADE_ROMAN, gradeOfLevel, learnPool, moveCat, damageKindOf, dndOf, usesOf, accMod, resOf,
} from "../data/petDex";
import {
  statsAt, xpToNext, LOSS_XP, withSeed, petStats, formName, canEvolve, evoStage, parseFx, fxKey, towerWeek, towerWeekLeftMs, battleMoves, learnedMoves, knownMoves, acOf, diceText, INFINITE, playTurn, activeOf, benchAlive, towerFloor, towerXp, towerPoints, AI_LABEL,
} from "../data/petEngine";
import {
  denOf, countOf, chooseStarter, givePet, buyEgg, hatchEgg, releasePet, setTeam, renamePet, claimGifts,
  towerFinish, towerSeed, towerTurnSeed, towerStart, towerFresh, canResetTower, resetTower, PVP_WIN_XP, PVP_LOSS_XP, PVP_XP_FIGHTS, savePetArt, savePetLook, petArtPrompt, setMascot, resetPetPlayers, resetPetTowers, MASCOT_XP_BONUS,
  learnMove, setMoveset, buyItem, giveItems, applyGrowthItem, giveCharm, teachScroll, recordPvpResult, PVP_POINTS, PVP_DAILY,
  evolvePet, evoArtKey, petEvoArtPrompt,
} from "../utils/petDen";
import { EVOLUTIONS, EVO_PASSIVES, EVO_LEVEL, evoLevelOf, evoDiceOf } from "../data/petEvo";
import { playDiceRoll } from "../components/diceSound";
import {
  createChallenge, acceptChallenge, declineChallenge, cancelChallenge, submitAction, forfeit, pendingSide, sidesOf, flipBattle, flipEvent,
} from "../utils/petPvp";
import { PET_BAG, BAG_ORDER, CHARMS, SCROLL_IDS, SCROLL_SLOTS, usableInBattle } from "../data/petBag";
import PetFx from "./PetFx";
import { showD20Roll, preloadDice3D, DICE_SKINS } from "../components/DiceRoll";
import { unlock as unlockAudio, sfx, jingle, battleMusic, setMusicOn, setSfxOn, audioPrefs, onAudioPrefs } from "../utils/petAudio";
import { dataUrlToTransparentDataUrl } from "../utils/aiSprite";
import "./PetDen.css";

// Mosse fisiche: chi attacca fa un balzo verso il bersaglio (classi in PetFx.css).
const LUNGE_FX = { stomp: "stomp", bite: "lunge", claw: "lunge", whip: "lunge", sting: "lunge", dash: "dash" };

/* ── pezzi comuni ─────────────────────────────────────────── */
// evo = forma evoluta (2026-11-01): pixel art in pet_dex/{specie}__evo1, più grande;
// finché non è disegnata si usa quella del cucciolo con un alone.
export function PetSprite({ species, art, flip = false, size = 96, fainted = false, hit = false, evo = 0 }) {
  const sp = PET_DEX[species];
  const ev = evo ? EVOLUTIONS[species] : null;
  const evoImg = ev ? art?.[evoArtKey(species)]?.image : null;
  const img = evoImg || art?.[species]?.image;
  const name = ev?.name || sp?.name || species;
  return (
    <span
      className={`pd-sprite${flip ? " is-flip" : ""}${fainted ? " is-down" : ""}${hit ? " is-hit" : ""}${ev ? " is-evo" : ""}${ev && !evoImg ? " is-evo-raw" : ""}`}
      style={{ "--pd-size": `${ev ? Math.round(size * 1.18) : size}px` }}
    >
      <span className="pd-breathe">
        {img
          ? <img src={img} alt={name} draggable="false" />
          : <span className="pd-emoji" aria-label={name}>{ev?.icon || sp?.icon || "❔"}</span>}
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
const usesTxt = (m) => (usesOf(m) == null ? "usi ∞" : `${usesOf(m)} usi`);
const accTxt = (m) => `${accMod(PET_DEX_MOVES[m].acc) >= 0 ? "+" : "−"}${Math.abs(accMod(PET_DEX_MOVES[m].acc))} al colpire`;
const moveInfo = (m) => {
  const mv = PET_DEX_MOVES[m];
  const kind = moveCat(m) === "atk" ? "attacco" : "incantesimo";
  return mv.power ? `${kind} · ${mv.dice} ${DMG_LABEL[damageKindOf(mv)].toLowerCase()} · ${accTxt(m)} · ${usesTxt(m)}` : `${kind} di stato · ${usesTxt(m)}`;
};
function MoveChip({ m, on, disabled, onClick, title }) {
  const mv = PET_DEX_MOVES[m];
  return (
    <button type="button" className={`pd-mchip${on ? " is-on" : ""}`} style={{ "--tc": TYPE_COLORS[mv.type][1] }}
      disabled={disabled} onClick={onClick} aria-pressed={on} title={title}>
      <b>{TYPE_ICON[mv.type]} {mv.name}</b>
      <small>{moveInfo(m)}</small>
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
    if (!uid) return undefined;
    return onSnapshot(doc(db, "characters", uid), (s) => setChar(s.exists() ? s.data() : {}));
  }, [uid]);
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(collection(db, "pet_dex"), (snap) => {
      const m = {};
      snap.forEach((d) => { m[d.id] = d.data(); });
      setArt(m);
    }, () => setArt({}));
  }, [uid]);

  useEffect(() => {
    if (!uid) return undefined;
    const sub = (field, set) => onSnapshot(query(collection(db, "pet_matches"), where(field, "==", uid)),
      (snap) => set(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => set([]));
    const u1 = sub("a", setMA), u2 = sub("b", setMB);
    return () => { u1(); u2(); };
  }, [uid]);
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
          onRetry={(att) => { unlockAudio(); setBattle((b) => ({ ...b, key: Date.now(), att })); }}
          att={battle.att}
        />
      </section>
    );
  }

  if (pvpId) {
    return (
      <section className="pd-page pd-page--battle">
        <PvpBattle key={pvpId} uid={uid} id={pvpId} art={art} den={den} onExit={() => { setPvpId(null); setTab("sfide"); }} />
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
            <TowerTab uid={uid} den={den} art={art} run={run} onFight={(plan) => { unlockAudio(); setBattle({ plan, teamIds: den.team, key: Date.now() }); }} />
          )}
          {sec === "sfide" && <ChallengesTab uid={uid} char={char} den={den} matches={matches} master={master} run={run} openMatch={setPvpId} />}
          {sec === "bisaccia" && <BagTab uid={uid} den={den} points={points} run={run} />}
          {sec === "bestiario" && <MasterTools uid={uid} den={den} art={art} run={run} />}
          {sec === "giocatori" && <PlayersAdmin run={run} art={art} />}
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
    { key: "torre", icon: "🗼", title: "Torre dei Cuccioli", sub: (() => { const t = towerFresh(den.tower); return `piano ${t.floor} · record della settimana ${t.best || 0}`; })() },
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
            <PetSprite species={p.species} evo={evoStage(p)} art={art} size={88} />
            <span>{p.nick || formName(p)}{p.id === den.mascot ? " ⭐" : ""}</span>
            <small>Lv {p.level}</small>
          </div>
        ))}
        {mascot && !den.team.includes(mascot.id) && (
          <div className="pd-hub-pet is-mascot">
            <PetSprite species={mascot.species} evo={evoStage(mascot)} art={art} size={70} />
            <span>{mascot.nick || formName(mascot)} ⭐</span>
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
function ResLine({ species, compact = false, evo = 0 }) {
  const r = resOf(species, evo);
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

/* ── evoluzioni (2026-11-01) ──────────────────────────────── */
// Abilità speciale della forma evoluta, in una riga.
function skillLine(species) {
  const s = EVOLUTIONS[species]?.skill || {};
  if (s.passive) {
    const p = EVO_PASSIVES[s.passive];
    return p ? `${p.icon} ${p.name} (passiva): ${p.text(s.v, s.st, s.el)}` : "";
  }
  const mv = PET_DEX_MOVES[s.move];
  if (!mv) return "";
  const n = usesOf(s.move) || 1;
  return `✦ ${mv.name} (mossa speciale, ${TYPE_ICON[mv.type]} ${mv.power ? `${mv.dice} ` : ""}${n} ${n === 1 ? "uso" : "usi"} per lotta, in più alle 4 mosse)`;
}
const resWords = (r) => [
  r?.immune?.length ? `immune a ${r.immune.map((k) => DMG_LABEL[k].toLowerCase()).join(", ")}` : "",
  r?.resist?.length ? `resiste a ${r.resist.map((k) => DMG_LABEL[k].toLowerCase()).join(", ")}` : "",
].filter(Boolean).join(" · ");

// Riquadro nei Dettagli del pet: cosa diventa, quando, cosa prende.
function EvoBox({ pet, art, onEvolve }) {
  const ev = EVOLUTIONS[pet.species];
  if (!ev) return null;
  const evo = evoStage(pet);
  const need = evoLevelOf(PET_DEX[pet.species].rarity);
  const [n, d] = evoDiceOf(PET_DEX[pet.species].rarity);
  return (
    <div className={`pd-evobox${evo ? " is-done" : ""}`}>
      <PetSprite species={pet.species} evo={1} art={art} size={60} />
      <div>
        <b>{evo ? `✨ Forma evoluta: ${ev.name}` : `✨ Evoluzione: ${ev.name} (Lv ${need})`}</b>
        <small>{skillLine(pet.species)}</small>
        {ev.res && <small>Nuove difese: {resWords(ev.res)}</small>}
        <small>{evo
          ? `Evoluto al Lv ${pet.evoAt || "?"}: +${pet.evoHp ?? "?"} PF${pet.evoRolls ? ` (🎲 ${pet.evoRolls.join(" + ")})` : ""}, ATK/DIF +12%, VEL +8%, CA +${1 + (ev.plus?.ac || 0)}.`
          : `Prende ATK/DIF +12%, VEL +8%, CA +${1 + (ev.plus?.ac || 0)} e ${n}d${d} PF in più (si tirano i dadi).`}</small>
        {!evo && canEvolve(pet) && <button type="button" className="pd-btn pd-btn--evo" onClick={onEvolve}>✨ Evolvi ora</button>}
        {!evo && !canEvolve(pet) && <small>Manca{need - pet.level === 1 ? "" : "no"} {need - pet.level} livell{need - pet.level === 1 ? "o" : "i"}.</small>}
      </div>
    </div>
  );
}

/* Evoluzione: luce → il pet cresce → dadi dei PF (li ha già tirati il
   server, qui rotolano e si fermano uno alla volta) → la forma nuova. */
function EvolveModal({ evo, art, onPhase, onClose }) {
  const { pet, phase, result } = evo;
  const ev = EVOLUTIONS[pet.species];
  const [faces, setFaces] = useState([]);
  const [stopped, setStopped] = useState(0);
  const rolls = useMemo(() => result?.rolls || [], [result]);
  const die = Number(String(result?.dice || "d8").split("d")[1]) || 8;
  useEffect(() => {
    if (phase !== "dice" || !rolls.length) return undefined;
    const total = 900 + rolls.length * 450;
    playDiceRoll(total, rolls.length);
    const t0 = Date.now();
    const iv = setInterval(() => {
      const el = Date.now() - t0;
      const done = rolls.filter((_, i) => el >= 900 + i * 450).length;
      setStopped(done);
      setFaces(rolls.map((r, i) => (i < done ? r : 1 + Math.floor(Math.random() * die))));
      if (done >= rolls.length) { clearInterval(iv); setTimeout(() => onPhase("reveal"), 900); }
    }, 70);
    return () => clearInterval(iv);
  }, [phase, rolls, die]); // eslint-disable-line react-hooks/exhaustive-deps
  const before = petStats(pet);
  const after = petStats({ ...pet, evo: 1, evoHp: result?.hp || 0 });
  const rows = [["PF", "hp"], ["ATK", "atk"], ["DIF", "def"], ["VEL", "spd"], ["CA", "ac"]];
  return (
    <div className="pd-hatch pd-evolve" role="dialog" aria-label="Evoluzione">
      <div className={`pd-hatch-box${phase === "reveal" ? " is-reveal" : ""}`} style={{ "--pd-rc": TYPE_COLORS[PET_DEX[pet.species].type][1] }}>
        {phase === "error" ? (
          <>
            <p>{evo.error}</p>
            <button type="button" className="pd-btn" onClick={onClose}>Chiudi</button>
          </>
        ) : phase === "glow" ? (
          <>
            <div className="pd-hatch-stage pd-evo-stage">
              <span className="pd-evo-glow" />
              <span className="pd-evo-grow"><PetSprite species={pet.species} art={art} size={130} /></span>
            </div>
            <p className="pd-hatch-txt">{pet.nick || formName(pet)} si sta evolvendo…</p>
          </>
        ) : phase === "dice" ? (
          <>
            <div className="pd-hatch-stage pd-evo-stage">
              <span className="pd-hatch-rays" />
              <PetSprite species={pet.species} evo={1} art={art} size={150} />
            </div>
            <p className="pd-hatch-txt">Punti Ferita in più: {result?.dice}</p>
            <div className="pd-evodice">
              {rolls.map((r, i) => (
                <span key={i} className={`pd-evodie${i < stopped ? " is-stop" : ""}`} data-max={i < stopped && r === die ? "1" : undefined}>{faces[i] ?? "?"}</span>
              ))}
            </div>
            <p className="pd-evo-sum">{stopped >= rolls.length ? `= +${result?.hp} PF` : "🎲 …"}</p>
          </>
        ) : (
          <>
            <div className="pd-hatch-stage pd-evo-stage">
              <span className="pd-hatch-rays" />
              <PetSprite species={pet.species} evo={1} art={art} size={150} />
            </div>
            <p className="pd-hatch-rar">Evoluzione</p>
            <h2>{ev.name}</h2>
            <p className="pd-fine">{ev.desc}</p>
            <p className="pd-evo-sum">🎲 {result.dice}: {rolls.join(" + ")} = +{result.hp} PF</p>
            <dl className="pd-stats pd-evo-stats">
              {rows.map(([l, k]) => (
                <div key={k}><dt>{l}</dt><dd>{before[k]} → <b>{after[k]}</b></dd></div>
              ))}
            </dl>
            <p className="pd-evo-skill">{skillLine(pet.species)}</p>
            {ev.res && <p className="pd-fine">Nuove difese: {resWords(ev.res)}</p>}
            <button type="button" className="pd-btn pd-btn--main" onClick={onClose}>Fantastico!</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── icone di bonus e malus in lotta (2026-11-01) ──────────── */
const STAGE_FX = { atk: ["⚔️", "Attacco"], def: ["🛡", "Difesa"], spd: ["💨", "Velocità"], ac: ["🧱", "CA"] };
function fxList(f, fx) {
  const L = [];
  Object.entries(STAGE_FX).forEach(([k, [icon, name]]) => {
    const v = fx[k];
    if (!v) return;
    const isAc = k === "ac";
    const val = isAc ? `${v > 0 ? "+" : "−"}${Math.abs(v)}` : (v > 0 ? "↑" : "↓").repeat(Math.abs(v));
    L.push({ k, icon, val, good: v > 0, dur: "↺", text: `${name} ${val}${isAc ? "" : ` (${v > 0 ? "+" : "−"}${Math.abs(v) * 25}%)`}: dura finché resta in campo (si azzera col cambio).` });
  });
  if (fx.burn) L.push({ k: "burn", icon: "🔥", good: false, dur: `${fx.burn}t`, text: `Scottato: perde 1/12 dei PF a fine turno, ancora ${fx.burn} turn${fx.burn === 1 ? "o" : "i"}.` });
  if (fx.poison) L.push({ k: "poison", icon: "☠", good: false, dur: `${fx.poison}t`, text: `Avvelenato: svantaggio ai tiri per colpire e 1/14 dei PF a fine turno, ancora ${fx.poison} turn${fx.poison === 1 ? "o" : "i"}.` });
  if (fx.stun) L.push({ k: "stun", icon: "💫", good: false, dur: "1t", text: "Intontito: salta la prossima azione." });
  if (fx.blur) L.push({ k: "blur", icon: "🌫️", good: true, dur: "⟳", text: "Sfocatura: chi lo attacca tira con svantaggio, finché non lo colpisce (torna a fine turno)." });
  if (f.charm && PET_BAG[f.charm]) {
    const it = PET_BAG[f.charm];
    L.push({ k: "charm", icon: it.icon, good: true, dur: "lotta", text: `${it.name}: ${it.desc} Dura tutta la lotta${f.charmLeft ? ` (lo tiene ancora per ${f.charmLeft} lott${f.charmLeft === 1 ? "a" : "e"}, questa compresa)` : ""}.` });
  }
  if (f.berry && !fx.berryUsed) L.push({ k: "berry", icon: "🍒", good: true, dur: "1×", text: "Bacca Curativa: la mangia da solo sotto metà PF, una volta." });
  if (f.passive && EVO_PASSIVES[f.passive.id]) {
    const p = EVO_PASSIVES[f.passive.id];
    const spent = (f.passive.id === "tenacia" && fx.tenUsed) || (f.passive.id === "leggendaria" && fx.legUsed);
    const once = ["tenacia", "leggendaria"].includes(f.passive.id);
    L.push({ k: "passive", icon: p.icon, good: true, spent, dur: spent ? "usata" : once ? "1×" : "∞", text: `${p.name} (evoluzione): ${p.text(f.passive.v, f.passive.st, f.passive.el)}${spent ? " Già usata in questa lotta." : ""}` });
  }
  return L;
}
function FxIcons({ f, fx, open, onToggle }) {
  const L = fxList(f, fx);
  if (!L.length) return null;
  return (
    <div className="pd-fxbar">
      <button type="button" className="pd-fxrow" onClick={onToggle} aria-expanded={open} title="Bonus e malus attivi: tocca per i dettagli">
        {L.map((x) => (
          <span key={x.k} className={`pd-fxi ${x.good ? "is-good" : "is-bad"}${x.spent ? " is-spent" : ""}`}>
            <i aria-hidden="true">{x.icon}</i>{x.val && <b>{x.val}</b>}<small>{x.dur}</small>
          </span>
        ))}
      </button>
      {open && (
        <ul className="pd-fxlist">
          {L.map((x) => <li key={x.k} className={x.good ? "is-good" : "is-bad"}><i aria-hidden="true">{x.icon}</i> {x.text}</li>)}
        </ul>
      )}
    </div>
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
          <li><b>Si tira il dado, come in D&amp;D e in Arena</b>: ogni attacco è d20 + bonus per colpire contro la <b>Classe Armatura</b> (CA) del bersaglio. 20 naturale = colpo critico (dadi del danno doppi), 1 naturale = mancato. Ogni mossa ha il suo bonus o malus al colpire.</li>
          <li><b>Danni in dadi</b>: ogni attacco fa i suoi dadi (2d6 da fuoco, 3d10 tagliente…) + il modificatore del pet. Salendo di livello i dadi aumentano, come i trucchetti: ×1,5 al Lv 9, ×2 al 17, ×3 al 33. Poi contano elemento, resistenze e stesso elemento (×1,25).</li>
          <li><b>Usi</b>: gli attacchi base (grado I) si usano quanto vuoi (∞); le altre mosse hanno pochi usi per lotta (6 al grado II, 4 al III, 3 al IV, 2 al V, 1 al VI; cure 2). Sul tasto vedi quanti ne restano.</li>
          <li>Le mosse di stato sul nemico (veleno, sonno, maledizioni) chiedono a lui un <b>tiro salvezza</b> contro la CD di chi le lancia.</li>
          <li>Alcune mosse alzano la CA (Rintanarsi, Scudo della Fede, Pelle di Pietra…, fino a +4); l'acido la corrode. Chi è <b>avvelenato</b> perde PF ogni turno e attacca con <b>svantaggio</b> (tira due d20, tiene il peggiore).</li>
          <li>Competenza e CA crescono insieme ogni 12 livelli: un attacco normale va a segno circa 3 volte su 4. Sul tasto di ogni mossa vedi il tiro per colpire e la CA del bersaglio (o la CD del tiro salvezza).</li>
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
        <h3>Evoluzioni</h3>
        <ul>
          <li>Ogni pet ha un'evoluzione: una forma adulta, più grande e più seria. Si sblocca al <b>Lv {EVO_LEVEL.common}</b> (comuni e iniziali), <b>{EVO_LEVEL.rare}</b> (rari), <b>{EVO_LEVEL.epic}</b> (epici), <b>{EVO_LEVEL.legendary}</b> (leggendari). Decidi tu quando: Squadra → "✨ Può evolvere". Non si torna indietro.</li>
          <li>Prende ATK e DIF +12%, VEL +8%, CA +1 e Punti Ferita in più tirati coi dadi: {["common", "rare", "epic", "legendary"].map((r) => `${evoDiceOf(r).join("d")} ${RARITY[r].label.toLowerCase()}`).join(", ")}. Il tiro lo fa il server e resta per sempre.</li>
          <li>Alcune forme prendono resistenze o immunità nuove, e ognuna ha un'<b>abilità speciale</b>: una mossa in più (✦, pochi usi per lotta, si aggiunge alle {MAX_MOVES}) o una passiva (rigenerazione, spine, furia, tenacia, sfocatura, corazza…). La vedi nel Pet Dex e nei Dettagli.</li>
          <li>Anche i nemici della Torre si evolvono quando arrivano al loro livello.</li>
        </ul>
      </section>
      <section>
        <h3>Bonus e malus in lotta</h3>
        <ul>
          <li>Sotto il nome del pet in campo ci sono le icone degli effetti attivi: verdi i bonus, rosse i malus. Toccale per leggere cosa fanno e quanto durano.</li>
          <li>↺ = gradi di Attacco/Difesa/Velocità/CA: durano finché il pet resta in campo. 3t = turni rimasti (scottatura, veleno). 1t = intontito, salta la prossima azione. "lotta" = amuleto, vale tutta la lotta. ∞ = passiva dell'evoluzione, 1× = vale una volta.</li>
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
          <li>Vittoria: PE alla squadra e +{PVP_POINTS} punti pet (prime {PVP_DAILY} vittorie del giorno), a volte un amuleto. PE fissi: {PVP_WIN_XP} a chi vince, {PVP_LOSS_XP} a chi perde, solo per le prime {PVP_XP_FIGHTS} sfide del giorno. Abbandonare conta come sconfitta e non dà PE.</li>
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
          <li>Se perdi ritenti lo stesso piano e la squadra prende solo {LOSS_XP} PE; se ti ritiri non prende niente.</li>
          <li>I dadi di un piano sono fissati: ritirarsi e ricominciare dà gli stessi tiri. Cambiano solo dopo una sconfitta. L'esito lo ricontrolla il server.</li>
          <li>È infinita e in una settimana uguale per tutti: il piano 3 è lo stesso piano 3 per chiunque. Salendo gli avversari crescono di livello, diventano due e poi tre, e sono sempre più furbi. Ogni 5 piani c'è un Guardiano.</li>
          <li><b>Ogni domenica alle 23:59</b> la torre si azzera per tutti e cambiano i mostri dei piani. In più puoi <b>ricominciare dal piano 1 una volta al giorno</b>: i piani già superati in settimana danno solo PE, niente punti né premi.</li>
          <li><b>In lotta</b> col tasto 🎒 Oggetti dai al pet che scegli, anche quello in campo, una Pozione, un Antidoto, un Elisir, una Piuma della Fenice o un amuleto (che vale subito e il pet si tiene: se ne aveva già uno, lo sostituisce). Consuma il turno.</li>
          <li>Premi: ogni 5 piani un amuleto, ogni 10 una pergamena, ogni 25 una Caramella Rara (e una piccola probabilità a ogni piano). La classifica della settimana mostra fin dove è arrivato ognuno.</li>
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
function PlayersAdmin({ run, art }) {
  const [open, setOpen] = useState(null);
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
  const actTower = (full) => {
    const withDen = picked.filter((c) => c.petDen);
    if (!withDen.length) return;
    const how = full
      ? "dal piano 1 E record della settimana a zero: i piani ridanno punti e premi"
      : "dal piano 1, record della settimana tenuto: i piani già fatti danno solo PE";
    if (!window.confirm(`Torre di ${withDen.length === list.filter((c) => c.petDen).length ? "TUTTI i " + withDen.length : withDen.length} giocatori: ${how}.
${withDen.map((c) => `${c.name} (piano ${towerFresh(c.petDen.tower).floor || 1})`).join(", ")}

Il record di sempre resta. Procedo?`)) return;
    run(() => resetPetTowers(withDen, { full }), `Fatto: torre ricominciata per ${withDen.length} giocatori.`).then(() => setSel({}));
  };
  return (
    <div className="pd-tab">
      <p className="pd-fine">Scegli uno, alcuni o tutti, poi azzera i punti pet, i pet o entrambi, oppure fai ricominciare la loro torre. Azzerare i pet toglie anche l'iniziale: al prossimo accesso lo sceglieranno di nuovo.</p>
      <div className="pd-admin-bar">
        <label className="pd-check"><input type="checkbox" checked={all} onChange={() => setSel(all ? {} : Object.fromEntries(list.map((c) => [c.id, true])))} /> Tutti ({list.length})</label>
        <label className="pd-check"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Mostra anche gli inattivi</label>
        <span className="pd-admin-count">{picked.length} scelti</span>
        <button type="button" className="pd-btn pd-btn--danger" disabled={!picked.length} onClick={() => act({ points: true })}>Azzera punti</button>
        <button type="button" className="pd-btn pd-btn--danger" disabled={!picked.length} onClick={() => act({ pets: true })}>Azzera pet</button>
        <button type="button" className="pd-btn pd-btn--danger" disabled={!picked.length} onClick={() => act({ points: true, pets: true })}>Azzera tutto</button>
      </div>
      <div className="pd-admin-bar">
        <span className="pd-fine">🗼 Torre dei scelti:</span>
        <button type="button" className="pd-btn" disabled={!picked.some((c) => c.petDen)} onClick={() => actTower(false)} title="Piano 1, il record della settimana resta: i piani già superati danno solo PE">↺ Ricomincia dal piano 1</button>
        <button type="button" className="pd-btn pd-btn--danger" disabled={!picked.some((c) => c.petDen)} onClick={() => actTower(true)} title="Piano 1 e record della settimana a zero: i piani ridanno punti e premi">↺ Torre da zero (anche il record)</button>
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
              <span className="pd-admin-stat">{d.starter ? `piano ${towerFresh(d.tower).floor || 1}` : "senza iniziale"}</span>
              {d.starter && (
                <button type="button" className="pd-btn pd-btn--ghost pd-admin-open" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                  {open === c.id ? "Chiudi" : "👁 Pet e storia"}
                </button>
              )}
              {open === c.id && <TamerDetail c={c} d={d} art={art} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Master: i pet di un giocatore e come li ha avuti (2026-10-31) ── */
const FROM_TXT = (from) => {
  if (!from) return "?";
  if (from === "starter") return "🌱 iniziale";
  if (from === "master") return "🎁 dato dal Master";
  if (from === "mercato") return "🏴 Mercato Nero";
  if (from.startsWith("uovo:")) return `🥚 uovo ${EGGS[from.slice(5)]?.name || from.slice(5)}`;
  return from;
};
const whenTxt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
// PE totali di un pet: tutti i livelli già presi + quelli verso il prossimo.
const totalXpOf = (p) => {
  let t = p.xp || 0;
  for (let l = 1; l < (p.level || 1); l++) t += xpToNext(l);
  return t;
};
const spName = (k) => PET_DEX[k]?.name || k;
const itName = (k) => PET_BAG[k]?.name || k;
function logTxt(e) {
  switch (e.k) {
    case "starter": return `🌱 Sceglie l'iniziale ${spName(e.species)}`;
    case "give": return `🎁 Il Master gli dà ${spName(e.species)}`;
    case "egg_buy": return `🛒 Compra ${EGGS[e.egg]?.name || e.egg}${e.cost ? ` (−${e.cost} pt)` : " (gratis)"}`;
    case "hatch": return `🥚 Schiude ${EGGS[e.egg]?.name || e.egg} → ${spName(e.species)} (${RARITY[e.rarity]?.label || e.rarity})${e.refunded ? ` · doppione, +${e.refunded} pt` : ""}`;
    case "gift": return `🏴 Dal ${e.from || "mercato"}: ${e.species ? spName(e.species) : e.egg ? EGGS[e.egg]?.name || e.egg : itName(e.item)}${e.refunded ? ` · doppione, +${e.refunded} pt` : ""}`;
    case "tower": return `🗼 Piano ${e.f} ${e.won ? (e.again ? "rivinto (solo PE)" : "VINTO") : "perso"} · +${e.xp} PE${e.pts ? ` · +${e.pts} pt` : ""}${e.drops?.length ? ` · ${e.drops.map(itName).join(", ")}` : ""}${e.team?.length ? ` · ${e.team.map((x) => { const [s, l] = x.split(":"); return `${spName(s)} Lv ${l}`; }).join(", ")}` : ""}`;
    case "tower_master": return `🛡 Il Master ricomincia la sua torre dal piano 1 (era al ${e.from})${e.full ? ", record della settimana azzerato" : ""}`;
    case "master_reset": return `🛡 ${e.note || "Reset del Master"}`;
    case "tower_reset": return `↺ Ricomincia la torre dal piano 1 (era al ${e.from})`;
    case "battle_items": return `🎒 Oggetti usati in lotta: ${(e.items || []).map(itName).join(", ")}`;
    case "pvp": return `⚔ Sfida ${e.won ? "vinta" : "persa"} contro ${e.vs || "?"} · +${e.xp} PE${e.pts ? ` · +${e.pts} pt` : ""}`;
    case "item_buy": return `🎒 Compra ${itName(e.item)} (−${e.cost} pt)`;
    case "item_give": return `🎁 Il Master gli dà ${(e.items || []).length} oggetti`;
    case "item_use": return `✨ Usa ${itName(e.item)} su ${spName(e.species)} → Lv ${e.level}`;
    case "evolve": return `✨ ${spName(e.species)} si evolve in ${EVOLUTIONS[e.species]?.name || "?"} (Lv ${e.level}) · +${e.hp} PF${e.rolls ? ` (${e.rolls.join(" + ")})` : ""}`;
    case "scroll": return `📜 ${itName(e.item)} a ${spName(e.species)} (dimentica ${PET_DEX_MOVES[e.forget]?.name || e.forget})`;
    default: return e.k;
  }
}
function TamerDetail({ c, d, art }) {
  const ledger = Array.isArray(c.petPointsLedger) ? c.petPointsLedger : [];
  const items = Object.entries(d.items).filter(([, n]) => Number(n) > 0);
  // PE che i soli piani vinti possono dare (mascotte +5%): se un pet ne ha molti di più
  // li ha presi perdendo (fino al 2026-10-31 un terzo a sconfitta), dalle sfide o da oggetti.
  const winsXp = Array.from({ length: d.tower.best || 0 }, (_, i) => towerXp(i + 1)).reduce((a, n) => a + n, 0);
  return (
    <div className="pd-tamer">
      <div className="pd-tamer-stats">
        <span>🗼 piano {d.tower.floor} · record {d.tower.best || 0} · {d.tower.wins || 0} vinti{d.tower.losses != null ? ` · ${d.tower.losses} persi` : ""}</span>
        <span>⚔ sfide {d.pvp.wins} vinte · {d.pvp.losses} perse</span>
        <span>💰 {Number(c.petPoints) || 0} punti</span>
      </div>
      <h4>Pet ({d.pets.length})</h4>
      <ul className="pd-tamer-pets">
        {d.pets.map((p) => {
          const tot = totalXpOf(p);
          const much = winsXp > 0 && tot > winsXp * 1.6;
          return (
            <li key={p.id}>
              <PetSprite species={p.species} evo={evoStage(p)} art={art} size={52} />
              <div>
                <b>{p.nick || formName(p)}</b>{p.nick ? <small> ({formName(p)})</small> : null}{evoStage(p) ? <em className="pd-tamer-tag">✨ evoluto{p.evoRolls ? ` · +${p.evoHp} PF (${p.evoRolls.join("+")})` : ""}</em> : null}
                {d.team.includes(p.id) && <em className="pd-tamer-tag">in squadra</em>}
                {d.mascot === p.id && <em className="pd-tamer-tag">⭐ mascotte</em>}
                <small>Lv {p.level} · {tot} PE in tutto{much ? ` ⚠ più di quanti ne danno i piani vinti (${winsXp})` : ""}</small>
                <small>{FROM_TXT(p.from)} · {whenTxt(p.at)}</small>
              </div>
            </li>
          );
        })}
      </ul>
      {d.eggs.length > 0 && <p className="pd-fine">🥚 Nel nido: {d.eggs.map((e) => `${EGGS[e.egg]?.name || e.egg} (${e.from}, ${whenTxt(e.at)})`).join(" · ")}</p>}
      {items.length > 0 && <p className="pd-fine">🎒 Bisaccia: {items.map(([k, n]) => `${itName(k)} ×${n}`).join(" · ")}</p>}
      <h4>Storia del Rifugio</h4>
      {d.log.length ? (
        <ol className="pd-tamer-log">
          {d.log.map((e, i) => <li key={i}><time>{whenTxt(e.t)}</time> {logTxt(e)}</li>)}
        </ol>
      ) : <p className="pd-fine">Nessuna voce: la storia si registra dal 2026-10-31 sera (prima c'erano solo i pet con origine e data qui sopra).</p>}
      {ledger.length > 0 && (
        <>
          <h4>Registro dei punti</h4>
          <ol className="pd-tamer-log">
            {ledger.map((e, i) => <li key={i}><time>{whenTxt(e.ts)}</time> {e.label || e.source} · {e.amount > 0 ? "+" : ""}{e.amount}</li>)}
          </ol>
        </>
      )}
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
function PetCard({ pet, art, inTeam, slot, onToggle, onRename, onRelease, canAdd, isMascot, onMascot, onLearn, onMoveset, onEvolve }) {
  const sp = PET_DEX[pet.species];
  const st = petStats(pet);
  const evo = evoStage(pet);
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState(pet.nick || "");
  return (
    <article className={`pd-card${inTeam ? " is-team" : ""}${isMascot ? " is-mascot" : ""}`}>
      {inTeam && <span className="pd-slot">#{slot + 1}</span>}
      {isMascot && <span className="pd-mascot-badge" title="Mascotte">⭐</span>}
      <PetSprite species={pet.species} evo={evo} art={art} size={84} />
      <div className="pd-card-body">
        <h3>{pet.nick || formName(pet)} <small>Lv {pet.level}</small>{evo ? <span className="pd-evotag" title="Forma evoluta">✨ evoluto</span> : null}
          {gradeOfLevel(pet.level) > Object.keys(pet.learned || {}).filter((k) => k <= gradeOfLevel(pet.level)).length && <span className="pd-newmove" title="Ha un grado di mosse da scegliere (Dettagli)">✨ mossa nuova</span>}
        </h3>
        <div className="pd-chips"><TypeChip type={sp.type} /><RarityChip rarity={sp.rarity} /></div>
        <ResLine species={pet.species} evo={evo} compact />
        {canEvolve(pet) && <button type="button" className="pd-btn pd-btn--evo" onClick={onEvolve}>✨ Può evolvere in {EVOLUTIONS[pet.species].name}!</button>}
        <div className="pd-xp"><Bar value={pet.xp} max={xpToNext(pet.level)} kind="xp" /><small>{pet.xp}/{xpToNext(pet.level)} PE</small></div>
        <dl className="pd-stats pd-stats--row">
          <div><dt>PF</dt><dd>{st.hp}</dd></div><div><dt>ATK</dt><dd>{st.atk}</dd></div>
          <div><dt>DIF</dt><dd>{st.def}</dd></div><div><dt>VEL</dt><dd>{st.spd}</dd></div>
          <div><dt>CA</dt><dd>{st.ac}</dd></div><div><dt>Colpire</dt><dd>+{st.toHit}</dd></div>
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
            <p className="pd-fine">{evo ? EVOLUTIONS[pet.species].desc : sp.desc}</p>
            <ResLine species={pet.species} evo={evo} />
            <EvoBox pet={pet} art={art} onEvolve={onEvolve} />
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
  const [evoing, setEvoing] = useState(null);
  const team = den.team.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  const evolve = (p) => {
    if (!window.confirm(`Far evolvere ${p.nick || formName(p)} in ${EVOLUTIONS[p.species].name}? Non si torna indietro.`)) return;
    unlockAudio();
    const t0 = Date.now();
    setEvoing({ pet: p, phase: "glow" });
    evolvePet(uid, p.id)
      .then((r) => setTimeout(() => setEvoing({ pet: p, phase: "dice", result: r }), Math.max(0, 2200 - (Date.now() - t0))))
      .catch((e) => setEvoing({ pet: p, phase: "error", error: e.message || String(e) }));
  };
  const rest = den.pets.filter((p) => !den.team.includes(p.id));
  const toggle = (p) => {
    const next = den.team.includes(p.id) ? den.team.filter((x) => x !== p.id) : [...den.team, p.id];
    if (!next.length) return run(async () => { throw new Error("Serve almeno un pet in squadra."); });
    return run(() => setTeam(uid, next));
  };
  const lead = (p) => run(() => setTeam(uid, [p.id, ...den.team.filter((x) => x !== p.id)]), `${p.nick || formName(p)} entra in campo per primo.`);
  const card = (p, i) => (
    <PetCard
      key={p.id} pet={p} art={art} inTeam={den.team.includes(p.id)} slot={i}
      canAdd={den.team.length < MAX_TEAM}
      onToggle={() => toggle(p)}
      onRename={(n) => run(() => renamePet(uid, p.id, n), "Nome cambiato.")}
      onRelease={() => window.confirm(`Liberare ${p.nick || formName(p)}? Non torna più.`) && run(() => releasePet(uid, p.id), "Liberato.")}
      onLearn={(g, m) => run(() => learnMove(uid, p.id, g, m), `${p.nick || formName(p)} impara ${PET_DEX_MOVES[m].name}!`)}
      onMoveset={(list) => run(() => setMoveset(uid, p.id, list))}
      onEvolve={() => evolve(p)}
      isMascot={den.mascot === p.id}
      onMascot={() => run(() => setMascot(uid, den.mascot === p.id ? null : p.id), den.mascot === p.id ? "Niente più mascotte." : `${p.nick || formName(p)} è la tua mascotte!`)}
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
      {evoing && <EvolveModal evo={evoing} art={art} onPhase={(phase) => setEvoing((e) => ({ ...e, phase }))} onClose={() => setEvoing(null)} />}
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
              {EVOLUTIONS[k] && (
                <div className="pd-dex-evo">
                  <PetSprite species={k} evo={1} art={art} size={54} />
                  <p><b>✨ Lv {evoLevelOf(sp.rarity)} → {EVOLUTIONS[k].name}</b><small>{skillLine(k)}</small></p>
                </div>
              )}
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
function TowerTab({ uid, den, art, run, onFight }) {
  const week = towerWeek();
  const tw = towerFresh(den.tower, week);
  const floor = tw.floor || 1;
  const team = den.team.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  const plan = towerFloor(floor, week);
  const upcoming = [floor + 1, floor + 2, floor + 3].map((n) => towerFloor(n, week));
  const left = towerWeekLeftMs();
  const leftTxt = left > 864e5 ? `${Math.floor(left / 864e5)} g ${Math.floor((left % 864e5) / 36e5)} h` : `${Math.floor(left / 36e5)} h ${Math.floor((left % 36e5) / 6e4)} min`;
  const canReset = canResetTower(tw);
  const reset = () => window.confirm(`Ricominciare la torre dal piano 1?\nPuoi farlo una volta al giorno. Il record della settimana (piano ${tw.best || 0}) resta; i piani già superati questa settimana danno solo PE, niente punti né premi.`)
    && run(() => resetTower(uid), "Torre ricominciata dal piano 1.");
  return (
    <div className="pd-tab">
      <div className="pd-tower">
        <div className="pd-tower-now">
          <p className="pd-eyebrow">Torre dei Cuccioli · piano</p>
          <div className="pd-tower-floor">{floor}</div>
          <p className="pd-sub">Record della settimana: piano {tw.best || 0} · {tw.wins || 0} vittorie{tw.bestEver ? ` · record di sempre ${Math.max(tw.bestEver, tw.best || 0)}` : ""}</p>
          <p className="pd-fine">🔄 La torre cambia fra {leftTxt} (ogni domenica alle 23:59): si riparte tutti dal piano 1 con mostri nuovi.</p>
          {plan.boss && <p className="pd-tower-boss">👑 Piano del Guardiano</p>}
          <dl className="pd-tower-meta">
            <div><dt>Avversario</dt><dd>{AI_LABEL[plan.aiLevel]}</dd></div>
            <div><dt>Premio</dt><dd>{towerXp(floor)} PE a testa{floor > (tw.best || 0) ? ` · ${towerPoints(floor)} pt` : " · già superato in settimana: solo PE"}</dd></div>
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
          {floor > 1 && (
            <button type="button" className="pd-btn pd-btn--ghost" disabled={!canReset} onClick={reset}>
              {canReset ? "↺ Ricomincia dal piano 1 (1 volta al giorno)" : "↺ Già ricominciata oggi: domani di nuovo"}
            </button>
          )}
          <p className="pd-fine">La torre non finisce mai: in una settimana ogni piano è uguale per tutti, con avversari diversi e sempre più forti. Vinci e passi al piano dopo; perdi e ritenti lo stesso piano (la squadra prende comunque un po' di PE). Fin dove arrivi lo dice la classifica. Premi: ogni 5 piani un amuleto, ogni 10 una pergamena, ogni 25 una Caramella Rara (e 1% a ogni piano).</p>
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
          <p className="pd-fine">I tuoi in squadra: {team.map((p) => `${p.nick || formName(p)} Lv ${p.level}`).join(", ") || "nessuno"}</p>
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
      <p className="pd-fine">Sfida un altro domatore con la tua squadra (fino a {MAX_TEAM} pet). Si gioca a turni: ognuno sceglie la sua mossa quando può, anche a distanza di ore. Vittoria = PE alla squadra e +{PVP_POINTS} punti pet (le prime {PVP_DAILY} vittorie del giorno); PE fissi: {PVP_WIN_XP} a chi vince e {PVP_LOSS_XP} a chi perde, per le prime {PVP_XP_FIGHTS} sfide del giorno; chi abbandona niente. Le statistiche: {den.pvp.wins} vinte · {den.pvp.losses} perse.</p>
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
      <h2 className="pd-h2">Lancia una sfida <small>la tua squadra: {team.map((p) => `${p.nick || formName(p)} Lv ${p.level}`).join(", ") || "vuota"}</small></h2>
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
          {den.pets.map((p) => <option key={p.id} value={p.id}>{p.nick || formName(p)} · Lv {p.level} · {TYPE_ICON[PET_DEX[p.species].type]}{p.charm ? ` · tiene ${PET_BAG[p.charm.id]?.icon}` : ""}</option>)}
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
    return shopKind === "charm" ? it.kind === "charm" : shopKind === "battle" ? it.kind === "battle" : it.kind === "xp";
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
          ) : it.kind === "battle" ? (
            <small className="pd-fine">Si usa in lotta: tasto 🎒 Oggetti.</small>
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
            {holders.map((p) => <li key={p.id}><span>{PET_BAG[p.charm.id].icon} {p.nick || formName(p)} tiene {PET_BAG[p.charm.id].name}</span><b>{p.charm.left}</b><small>lotte</small></li>)}
          </ul>
        </>
      )}
      <h2 className="pd-h2">Bottega degli oggetti <small>{points} punti pet</small></h2>
      <div className="pd-filters">
        {[["battle", "Da lotta"], ["charm", "Amuleti"], ["xp", "Esperienza"], ["scroll", "Pergamene"]].map(([k, l]) => (
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
    const week = towerWeek();
    getDocs(collection(db, "characters")).then((snap) => setRows(snap.docs.map((d) => ({ id: d.id, name: d.data().name, best: (d.data().petDen?.tower?.week || "2026-10-26") === week ? d.data().petDen?.tower?.best || 0 : 0, hidden: isHiddenChar(d.data()) }))
      .filter((r) => r.name && r.best > 0 && !r.hidden).sort((a, b) => b.best - a.best).slice(0, 20))).catch(() => setRows([]));
  }, []);
  if (!rows) return null;
  return (
    <div className="pd-board">
      <h3>🏆 Classifica della settimana</h3>
      {!rows.length ? <p className="pd-fine">Questa settimana nessuno ha ancora superato un piano.</p> : (
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
// Come in Arena: prima di ogni tiro per colpire o tiro salvezza rotola il
// d20 3D, poi si vede la riga con l'effetto.
const diceLabel = (r, ev) => (r.kind === "save"
  ? `${r.who}: tiro salvezza ${sgn(r.mod)} contro CD ${r.vs}`
  : `${ev.att} · ${ev.mname}: d20 ${sgn(r.mod)} contro CA ${r.vs}${r.dis ? " (svantaggio)" : ""}`);
// history = righe già mostrate (la cronologia del fight, senza anticipare quelle in coda).
function useLinePlayer(initial = []) {
  const [queue, setQueue] = useState([]);
  const [shown, setShown] = useState(null);
  const [seq, setSeq] = useState(0);
  const [history, setHistory] = useState(initial);
  const first = useRef(false);
  useEffect(() => { preloadDice3D(); }, []);
  useEffect(() => {
    if (!queue.length) return undefined;
    let alive = true;
    const next = queue[0];
    const t = setTimeout(async () => {
      const r = next.kind === "move" ? next.roll : null;
      if (r) {
        // chi tira: l'attaccante, o il bersaglio se è un tiro salvezza. Il nemico (lato "e") ha il dado rosso.
        const roller = r.kind === "save" ? (next.side === "p" ? "e" : "p") : next.side;
        await showD20Roll(r.d, { label: `${roller === "e" ? "🟥 " : ""}${diceLabel(r, next)}`, skin: roller === "e" ? "nemico" : petDiceSkin(),
          dice: r.dis ? [{ value: r.d, name: "tiene" }, { value: r.d2, name: "scarta", dim: true }] : undefined });
      }
      if (!alive) return;
      setShown(next); setSeq((n) => n + 1); setQueue((q) => q.slice(1));
      if (next.text) setHistory((h) => [...h, next.text].slice(-150));
    }, first.current ? 60 : STEP_MS);
    first.current = false;
    return () => { alive = false; clearTimeout(t); };
  }, [queue]);
  useEffect(() => { sfx(shown); }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps
  const play = (events) => {
    if (!events.length) return;
    // finché il primo dado rotola il campo resta com'era prima del turno
    first.current = true;
    setShown({ kind: "wait", snap: events[0].snap, text: "" });
    setQueue(events);
  };
  return { shown, seq, busy: queue.length > 0, play, history, seed: setHistory };
}

/* Dadi della lotta dei pet (2026-10-31): scelta SEPARATA da quella
   dell'Arena (localStorage pd_dice_skin, non eldoria_dice_skin_<uid>). */
const PD_SKIN_KEY = "pd_dice_skin";
function petDiceSkin() {
  try { const s = localStorage.getItem(PD_SKIN_KEY); return DICE_SKINS.some((d) => d.id === s) ? s : "classic"; } catch { return "classic"; }
}
function PetDicePicker({ onClose }) {
  const [cur, setCur] = useState(petDiceSkin);
  const [pics, setPics] = useState({});
  useEffect(() => {
    let alive = true;
    import("../components/dice3d").then((m) => {
      if (!alive || !m.canUse3D()) return;
      const out = {};
      DICE_SKINS.forEach((s) => { try { out[s.id] = m.previewDie(s.id, 120); } catch { /* resta il campione */ } });
      setPics(out);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const pick = (s) => {
    setCur(s.id);
    try { localStorage.setItem(PD_SKIN_KEY, s.id); } catch { /* storage spento */ }
    showD20Roll(2 + Math.floor(Math.random() * 18), { label: `Anteprima · ${s.label}`, skin: s.id });
  };
  const group = (kind, title) => (
    <>
      <p className="pd-dice-sec">{title}</p>
      <div className="pd-dice-grid">
        {DICE_SKINS.filter((s) => s.kind === kind).map((s) => (
          <button key={s.id} type="button" className={`pd-dice-card${cur === s.id ? " is-on" : ""}`} onClick={() => pick(s)} aria-pressed={cur === s.id}>
            {pics[s.id] ? <img src={pics[s.id]} alt="" /> : <span className={`dice-swatch skin-${s.id}`} aria-hidden="true" />}
            <b>{s.label}</b>
            {s.desc && <small>{s.desc}</small>}
            {cur === s.id && <i aria-hidden="true">✓</i>}
          </button>
        ))}
      </div>
    </>
  );
  return createPortal(
    <div className="pd-dice-modal" role="dialog" aria-modal="true" aria-label="I dadi del Rifugio" onClick={onClose}>
      <div className="pd-dice-box" onClick={(e) => e.stopPropagation()}>
        <div className="pd-dice-head">
          <h3>🎲 I dadi del Rifugio</h3>
          <button type="button" className="pd-btn pd-btn--ghost" onClick={onClose}>Chiudi</button>
        </div>
        <p className="pd-fine">Il d20 delle lotte dei pet. È una scelta a parte: il dado dell'Arena non cambia. Il dado dell'avversario è sempre rosso, così si capisce chi sta tirando. Critico (20) e fallimento (1) restano in oro e rosso.</p>
        {group("base", "Colori base")}
        {group("special", "Speciali ✦")}
      </div>
    </div>,
    document.body,
  );
}

function AudioToggles() {
  const [prefs, setPrefs] = useState(audioPrefs);
  const [dice, setDice] = useState(false);
  useEffect(() => onAudioPrefs(setPrefs), []);
  return (
    <span className="pd-audio">
      <button type="button" className="pd-audio-btn" onClick={() => setDice(true)} title="Cambia il dado">🎲<small>Dado</small></button>
      {dice && <PetDicePicker onClose={() => setDice(false)} />}
      <button type="button" className={`pd-audio-btn${prefs.musicOn ? "" : " is-off"}`} onClick={() => setMusicOn(!prefs.musicOn)}
        aria-pressed={prefs.musicOn} title={prefs.musicOn ? "Spegni la musica" : "Accendi la musica"}>{prefs.musicOn ? "🎵" : "🔇"}<small>Musica</small></button>
      <button type="button" className={`pd-audio-btn${prefs.sfxOn ? "" : " is-off"}`} onClick={() => setSfxOn(!prefs.sfxOn)}
        aria-pressed={prefs.sfxOn} title={prefs.sfxOn ? "Spegni gli effetti" : "Accendi gli effetti"}>{prefs.sfxOn ? "🔊" : "🔈"}<small>Effetti</small></button>
    </span>
  );
}

// Campo di lotta: HUD (con CA), sprite, effetti, dado del tiro e testo.
function BattleScreen({ battle, player, art, top, children, labels = {} }) {
  const { shown, seq, busy, history } = player;
  const [histOpen, setHistOpen] = useState(false);
  const [fxOpen, setFxOpen] = useState(null);
  const fieldRef = useRef(null);
  const spotP = useRef(null), spotE = useRef(null);
  const snap = busy ? (shown?.snap || null) : null;
  const sideView = (side) => {
    const s = battle.sides[side];
    const idx = snap ? snap[side].active : s.active;
    const f = s.team[idx];
    const hp = snap ? snap[side].hp[idx] : f.hp;
    const status = snap ? snap[side].status[idx] : (f.status?.kind || (f.stunned ? "stun" : null));
    const fx = parseFx(snap && snap[side].fx ? snap[side].fx[idx] : fxKey(f));
    return { f, hp, status, idx, fx };
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
  const hud = (side, V) => (
    <div className={`pd-hud pd-hud--${side}`}>
      <div className="pd-hud-name"><b>{V.f.name}</b><small>Lv {V.f.level}</small></div>
      {labels[side] && <div className="pd-hud-owner">{labels[side]}</div>}
      <div className="pd-hud-chips">
        <TypeChip type={V.f.type} />
        <span className="pd-ac" title="Classe Armatura">🛡 CA {acOf(V.f)}</span>
        <ResLine species={V.f.species} evo={V.f.evo} compact />
      </div>
      <FxIcons f={V.f} fx={V.fx} open={fxOpen === side} onToggle={() => setFxOpen((o) => (o === side ? null : side))} />
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
            <PetSprite key={`e${E.idx}`} species={E.f.species} evo={E.f.evo} art={art} size={150} flip fainted={E.hp <= 0} hit={hitSide === "e"} />
          </div>
        </div>
        <div className="pd-spot pd-spot--p" ref={spotP}>
          <div key={actCls("p") ? `p${seq}` : "p"} className={`pd-act side-p${actCls("p")}`}>
            <PetSprite key={`p${P.idx}`} species={P.f.species} evo={P.f.evo} art={art} size={170} fainted={P.hp <= 0} hit={hitSide === "p"} />
          </div>
        </div>
        {hud("p", P)}
        <PetFx ev={shown} seq={seq} fieldRef={fieldRef} spotRefs={{ p: spotP, e: spotE }} />
      </div>
      <div className="pd-console">
        <p className="pd-text" aria-live="polite">{shown?.text || history[history.length - 1] || ""}</p>
        {history.length > 1 && (
          <div className="pd-hist">
            <button type="button" className="pd-hist-btn" aria-expanded={histOpen} onClick={() => setHistOpen((o) => !o)}>
              📜 Cronologia del fight ({history.length}) {histOpen ? "▴" : "▾"}
            </button>
            {histOpen && (
              <ol className="pd-hist-list">
                {history.map((t, i) => ({ t, i })).reverse().map(({ t, i }) => <li key={i}><span>{i + 1}</span>{t}</li>)}
              </ol>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// Mosse e cambi del pet in campo (lato "p" della vista).
function BattleControls({ battle, busy, art, onAct, forced, bag = {} }) {
  const [view, setView] = useState("main");
  const [item, setItem] = useState(null);
  const me = activeOf(battle, "p");
  const foe = activeOf(battle, "e");
  const bench = benchAlive(battle, "p");
  const act = (a) => { setView("main"); onAct(a); };
  const items = BAG_ORDER.filter((k) => usableInBattle(k) && bag[k] > 0);
  if (!forced && view === "items") {
    const it = item && PET_BAG[item];
    const team = battle.sides.p.team;
    const okFor = (f) => (it.use?.revive ? f.hp <= 0 : f.hp > 0);
    return (
      <div className="pd-switch pd-bagfight">
        {!it ? (
          <>
            <p className="pd-fine">🎒 Dare un oggetto consuma il turno.</p>
            {items.length ? items.map((k) => (
              <button key={k} type="button" className="pd-switch-btn" disabled={busy} onClick={() => setItem(k)}>
                <span className="pd-bagfight-icon" aria-hidden="true">{PET_BAG[k].icon}</span>
                <span><b>{PET_BAG[k].name}</b> ×{bag[k]}<small className="pd-bagfight-desc">{PET_BAG[k].desc}</small></span>
              </button>
            )) : <p className="pd-empty">Niente da usare in lotta: pozioni, antidoti, elisir, piume della fenice e amuleti si comprano nella Bisaccia.</p>}
            <button type="button" className="pd-btn pd-btn--ghost" onClick={() => setView("main")}>Indietro</button>
          </>
        ) : (
          <>
            <p className="pd-fine">{it.icon} {it.name}: a chi lo dai?</p>
            {team.map((f, i) => (
              <button key={f.id} type="button" className="pd-switch-btn" disabled={busy || !okFor(f)} onClick={() => { setItem(null); act({ kind: "item", item, index: i }); }}>
                <PetSprite species={f.species} art={art} size={44} fainted={f.hp <= 0} />
                <span><b>{f.name}</b> Lv {f.level}{i === battle.sides.p.active ? " · in campo" : ""}<Bar value={f.hp} max={f.maxHp} /></span>
                <small>{f.hp > 0 ? `${f.hp}/${f.maxHp}` : "a terra"}{f.charm ? ` · ${PET_BAG[f.charm]?.icon || ""}${it.kind === "charm" ? " (lo sostituisce)" : ""}` : ""}</small>
              </button>
            ))}
            <button type="button" className="pd-btn pd-btn--ghost" onClick={() => setItem(null)}>Indietro</button>
          </>
        )}
      </div>
    );
  }
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
      <p className="pd-fine pd-uses-head">Usi rimasti in questa lotta · gli attacchi base sono infiniti (∞)</p>
      <div className="pd-movegrid">
        {Object.keys(me.pp).map((m) => {
          const mv = PET_DEX_MOVES[m];
          const self = !mv.power && !(mv.effect?.foe || mv.effect?.burn || mv.effect?.poison || mv.effect?.stun);
          const toHit = me.toHit + accMod(mv.acc);
          const dc = me.dcBase + accMod(mv.acc);
          const left = me.pp[m];
          const max = usesOf(m);
          return (
            <button key={m} type="button" className={`pd-move${left === 0 ? " is-spent" : ""}${mv.sig ? " is-sig" : ""}`} style={{ "--tc": TYPE_COLORS[mv.type][1] }} disabled={busy || left === 0} onClick={() => act({ kind: "move", move: m })}>
              <span className="pd-move-top"><b>{mv.sig ? "✦ " : ""}{mv.name}</b><em className={`pd-uses${left === INFINITE ? " is-inf" : ""}`}>{left === INFINITE ? "∞" : `${left}/${max}`}</em></span>
              <small>
                {TYPE_ICON[mv.type]} {mv.power ? `${diceText(m, me.level)}${me.atkMod ? sgn(me.atkMod) : ""} ${DMG_LABEL[damageKindOf(mv)].toLowerCase()}` : "stato"}
                {mv.power ? ` · 🎯 d20 ${sgn(toHit)} vs CA ${foe ? acOf(foe) : "?"}` : self ? "" : ` · TS CD ${dc}`}
              </small>
            </button>
          );
        })}
      </div>
      {Object.values(me.pp).every((v) => v === 0) && (
        <button type="button" className="pd-btn" disabled={busy} onClick={() => act({ kind: "move", move: "zampata" })}>✊ Zampata disperata (usi finiti)</button>
      )}
      <button type="button" className="pd-btn pd-switch-open" disabled={busy || !bench.length} onClick={() => setView("switch")}>
        🔄 Cambia pet {bench.length ? `(${bench.length})` : ""}
      </button>
      <button type="button" className="pd-btn pd-switch-open" disabled={busy} onClick={() => { setItem(null); setView("items"); }}>
        🎒 Oggetti {items.length ? `(${items.reduce((a, k) => a + bag[k], 0)})` : ""}
      </button>
    </div>
  );
}

const dropNames = (ids = []) => ids.map((k) => `${PET_BAG[k]?.icon} ${PET_BAG[k]?.name}`).join(", ");

/* Torre verificata dal server (2026-10-31): dadi a seme fisso (towerSeed:
   giocatore + piano + tentativo, cambia solo dopo una sconfitta registrata),
   si tiene la lista delle azioni e a fine lotta il server la rigioca
   (towerFinish) e decide lui l'esito. Dopo una sconfitta si riparte solo
   quando la scheda ha già il tentativo nuovo (e i PE presi), altrimenti la
   lotta del telefono e quella del server non coinciderebbero. */
function PetBattle(props) {
  const { den, plan, att } = props;
  const tw = towerFresh(den.tower);
  const curAtt = tw.att?.floor === plan.floor ? tw.att.n || 0 : 0;
  // si controlla solo prima di partire: a lotta iniziata la scheda cambia (esito salvato)
  const started = useRef(false);
  if (!started.current && att != null && curAtt !== att) return <p className="pd-loading">Preparo il piano…</p>;
  started.current = true;
  return <PetBattleRun {...props} />;
}
function PetBattleRun({ uid, den, art, plan, teamIds, onExit, onRetry }) {
  const seed = useMemo(() => towerSeed(uid, den, plan.floor), []); // eslint-disable-line react-hooks/exhaustive-deps
  const actions = useRef([]);
  const [usedItems, setUsedItems] = useState({});
  const [battle, setBattleState] = useState(() => {
    const b = towerStart(den, plan.floor, teamIds, seed);
    return { ...b, log: [{ text: `Piano ${plan.floor}: l'avversario manda in campo ${activeOf(b, "e").name}!` }, { text: `Vai, ${activeOf(b, "p").name}!` }] };
  });
  const player = useLinePlayer(battle.log.map((l) => l.text));
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
    towerFinish(uid, plan.floor, teamIds, actions.current)
      .then((r) => setResult(r))
      .catch((e) => setResult({ won: false, error: e.message }))
      .finally(() => setSaving(false));
  }, [battle.over, busy, uid, plan.floor, teamIds]);

  const act = (action) => {
    if (busy || battle.over) return;
    const i = actions.current.length;
    const { battle: nb, events } = withSeed(towerTurnSeed(seed, i), () => playTurn(battle, action));
    actions.current.push(action);
    if (action.kind === "item") setUsedItems((u) => ({ ...u, [action.item]: (u[action.item] || 0) + 1 }));
    setBattleState(nb);
    player.play(events);
  };

  const top = (
    <>
      <span>🗼 Piano {plan.floor}{plan.boss ? " · 👑 Guardiano" : ""} · {AI_LABEL[plan.aiLevel]}</span>
      <AudioToggles />
      <button type="button" className="pd-btn pd-btn--ghost" onClick={() => (battle.over || window.confirm("Ritirarti? Niente PE, il piano resta da fare.")) && onExit()}>
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
                  : <button type="button" className="pd-btn pd-btn--main" onClick={() => onRetry(result.att)}>Ritenta il piano</button>}
                <button type="button" className="pd-btn pd-btn--ghost" onClick={onExit}>Al Rifugio</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <BattleControls battle={battle} busy={busy} art={art} onAct={act} forced={battle.needSwitch === "p" && !busy}
          bag={Object.fromEntries(Object.entries(den.items).map(([k, n]) => [k, (Number(n) || 0) - (usedItems[k] || 0)]))} />
      )}
    </BattleScreen>
  );
}

/* ── Sfida fra giocatori: la lotta letta da pet_matches ───── */
function PvpBattle({ uid, id, art, den, onExit }) {
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
    if (lastSeq.current === null) {
      lastSeq.current = m.seq || 0;
      if (!m.seq && m.events) player.play(m.events);
      else player.seed(m.logText || []);
      return;
    }
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
          <BattleControls battle={battle} busy={player.busy || sending} art={art} onAct={send} forced={forcedHere}
            bag={Object.fromEntries(Object.entries(den?.items || {}).map(([k, n]) => [k, (Number(n) || 0) - ((m.used?.[viewSide]?.[k] || []).length) - (m.actions?.[viewSide]?.item === k ? 1 : 0)]))} />
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
  // `key` = specie o forma evoluta (specie__evo1, 2026-11-01)
  const evoSp = (key) => (key.includes("__evo") ? key.split("__evo")[0] : null);
  const lookOf = (key) => looks[key] ?? art[key]?.look ?? (evoSp(key) ? EVOLUTIONS[evoSp(key)].look : PET_DEX[key].look);
  const nameOf = (key) => (evoSp(key) ? EVOLUTIONS[evoSp(key)].name : PET_DEX[key].name);

  const generate = async (key) => {
    if (busy[key]) return;
    if (art[key]?.image && !window.confirm(`Rifare la pixel art di ${nameOf(key)}?`)) return;
    setBusy((b) => ({ ...b, [key]: true }));
    setErr("");
    try {
      const look = lookOf(key);
      const sp = evoSp(key);
      const r = await fetch("/api/genera-immagine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: sp ? petEvoArtPrompt(sp, look) : petArtPrompt(key, look), qualita: true }),
      });
      const data = await r.json();
      if (!r.ok || data.error || !data.immagine) throw new Error(data.error || "Nessuna immagine ricevuta.");
      const png = await dataUrlToTransparentDataUrl(data.immagine, sp ? 320 : 256);
      await savePetArt(key, png, look);
    } catch (e) {
      setErr(`${nameOf(key)}: ${e.message || e}`);
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  const resetMine = () => window.confirm("Azzerare il TUO Rifugio (pet, squadra, torre) per riprovare la scelta iniziale?")
    && run(() => updateDoc(doc(db, "characters", uid), { petDen: deleteField() }), "Rifugio azzerato.");
  const done = PET_DEX_ORDER.filter((k) => art[k]?.image).length;
  const evoDone = PET_DEX_ORDER.filter((k) => EVOLUTIONS[k] && art[evoArtKey(k)]?.image).length;

  return (
    <div className={`pd-tab pd-master${compact ? " is-compact" : ""}`}>
      <div className="pd-master-head">
        <h2 className="pd-h2">Bestiario del Master <small>pixel art {done}/{PET_DEX_ORDER.length} · evoluzioni {evoDone}/{Object.keys(EVOLUTIONS).length}</small></h2>
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
              {EVOLUTIONS[k] && (() => {
                const ek = evoArtKey(k);
                return (
                  <div className="pd-art-evo">
                    <div className="pd-art-preview"><PetSprite species={k} evo={1} art={art} size={96} /></div>
                    <div className="pd-art-body">
                      <h3>✨ {EVOLUTIONS[k].name} <small>Lv {evoLevelOf(sp.rarity)}</small></h3>
                      <p className="pd-fine">{skillLine(k)}</p>
                      <textarea rows={3} value={lookOf(ek)} onChange={(e) => setLooks((l) => ({ ...l, [ek]: e.target.value }))} />
                      <div className="pd-art-actions">
                        <button type="button" className="pd-btn pd-btn--main" disabled={busy[ek]} onClick={() => generate(ek)}>
                          {busy[ek] ? "Gemini disegna…" : art[ek]?.image ? "↻ Rifai l'evoluzione" : "✨ Genera l'evoluzione"}
                        </button>
                        {looks[ek] != null && looks[ek] !== (art[ek]?.look ?? EVOLUTIONS[k].look) && (
                          <button type="button" className="pd-btn pd-btn--ghost" onClick={() => run(() => savePetLook(ek, looks[ek]), "Descrizione salvata.")}>Salva descrizione</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </article>
          );
        })}
      </div>
    </div>
  );
}
