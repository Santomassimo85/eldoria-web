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
import { collection, deleteField, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import { isHiddenChar } from "../data/hiddenPlayers";
import {
  PET_DEX, PET_DEX_ORDER, PET_DEX_MOVES, STARTERS, RARITY, MAX_TEAM, MAX_PER_SPECIES, MAX_EGGS,
  MOVE_UNLOCK, TYPE_ICON, TYPE_LABEL, TYPE_COLORS, ELEMENTS, EGGS, EGG_ORDER, HATCH_RARITIES,
  eggChances, hatchRarityOf, strongAgainst, weakAgainst, DMG_ICON, DMG_LABEL, ELEMENT_ODDS, PRISM_ODDS,
  MOVE_GRADES, MAX_MOVES, GRADE_ROMAN, gradeOfLevel, learnPool, moveCat, damageKindOf,
} from "../data/petDex";
import {
  statsAt, xpToNext, newBattle, battleMoves, learnedMoves, knownMoves, playTurn, activeOf, benchAlive, towerFloor, towerXp, towerPoints, AI_LABEL,
} from "../data/petEngine";
import {
  denOf, countOf, chooseStarter, givePet, buyEgg, hatchEgg, releasePet, setTeam, renamePet, claimGifts,
  recordTowerResult, savePetArt, savePetLook, petArtPrompt, setMascot, resetPetPlayers, MASCOT_XP_BONUS,
  learnMove, setMoveset,
} from "../utils/petDen";
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
        r.eggs?.length && `🥚 Nel nido: ${r.eggs.map((e) => EGGS[e]?.name).join(", ")}.`,
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
    torre: { title: "Torre dei Cuccioli" },
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
        <Hub den={den} art={art} points={points} master={master} go={go} />
      ) : (
        <>
          <SectionHead title={SECTIONS[sec].title} sub={SECTIONS[sec].sub} onBack={back} />
          {sec === "squadra" && <TeamTab uid={uid} den={den} art={art} run={run} />}
          {sec === "nido" && <NestTab uid={uid} den={den} art={art} goShop={() => go("uova")} />}
          {sec === "uova" && <EggShopTab uid={uid} den={den} art={art} points={points} run={run} ledger={char.petPointsLedger || []} goNest={() => go("nido")} />}
          {sec === "dex" && <DexTab den={den} art={art} />}
          {sec === "manuale" && <Manual />}
          {sec === "torre" && (
            <TowerTab den={den} art={art} onFight={(plan) => { unlockAudio(); setBattle({ plan, teamIds: den.team, key: Date.now() }); }} />
          )}
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

function Hub({ den, art, points, master, go }) {
  const mascot = den.pets.find((p) => p.id === den.mascot);
  const team = den.team.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  const owned = PET_DEX_ORDER.filter((k) => countOf(den, k) > 0).length;
  const tiles = [
    { key: "squadra", icon: "🐾", title: "Squadra e collezione", sub: `${team.length}/${MAX_TEAM} in squadra · ${den.pets.length} pet` },
    { key: "nido", icon: "🥚", title: "Il nido", sub: den.eggs.length ? `${den.eggs.length} uova da schiudere` : "nessun uovo", hot: den.eggs.length > 0 },
    { key: "uova", icon: "🛒", title: "Bottega delle uova", sub: `${points} punti pet da spendere` },
    { key: "torre", icon: "🗼", title: "Torre dei Cuccioli", sub: `piano ${den.tower.floor} · record ${den.tower.best || 0}` },
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
          <li>Salendo gli avversari crescono di livello, diventano due e poi tre, e sono sempre più furbi. Ogni 5 piani c'è un Guardiano.</li>
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
        </dl>
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
function TowerTab({ den, art, onFight }) {
  const floor = den.tower.floor || 1;
  const team = den.team.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  const plan = towerFloor(floor, team[0] ? PET_DEX[team[0].species]?.type : null);
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
                <small>Lv {t.level} · {TYPE_ICON[PET_DEX[t.species].type]}</small>
                <ResLine species={t.species} compact />
              </div>
            ))}
          </div>
          <button type="button" className="pd-btn pd-btn--main pd-btn--big" disabled={!team.length} onClick={() => onFight(plan)}>
            ⚔ Sali al piano {floor}
          </button>
          <p className="pd-fine">Vinci e passi al piano dopo. Perdi e ritenti lo stesso piano (la squadra prende comunque un po' di PE). A ogni piano gli avversari salgono di livello e diventano più furbi.</p>
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
        </div>
      </div>
    </div>
  );
}

/* ── LOTTA ────────────────────────────────────────────────── */
const STEP_MS = 850;
const STATUS_TXT = { burn: "🔥 Scottato", poison: "☠ Avvelenato", stun: "💫 Intontito" };

function PetBattle({ uid, den, art, plan, teamIds, onExit, onRetry }) {
  const myPets = teamIds.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  const [battle, setBattleState] = useState(() => {
    const b = newBattle(myPets, plan.team, { enemyBoost: plan.enemyBoost, aiLevel: plan.aiLevel });
    return { ...b, log: [{ text: `Piano ${plan.floor}: l'avversario manda in campo ${activeOf(b, "e").name}!` }, { text: `Vai, ${activeOf(b, "p").name}!` }] };
  });
  const [queue, setQueue] = useState([]);   // righe ancora da mostrare
  const [shown, setShown] = useState(null); // riga corrente (con istantanea PF)
  const [seq, setSeq] = useState(0);        // conta le righe mostrate (riavvia gli effetti)
  const fieldRef = useRef(null);
  const spotP = useRef(null), spotE = useRef(null);
  const [view, setView] = useState("main"); // main | switch
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);

  // Mostra le righe una alla volta.
  useEffect(() => {
    if (!queue.length) return undefined;
    const t = setTimeout(() => { setShown(queue[0]); setSeq((n) => n + 1); setQueue((q) => q.slice(1)); }, STEP_MS);
    return () => clearTimeout(t);
  }, [queue]);
  const busy = queue.length > 0;

  // Suoni: musica per tutta la lotta, un effetto per ogni riga mostrata.
  const [prefs, setPrefs] = useState(audioPrefs);
  useEffect(() => onAudioPrefs(setPrefs), []);
  useEffect(() => { battleMusic(true); return () => battleMusic(false); }, []);
  useEffect(() => { sfx(shown); }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps
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
    setView("main");
    setShown(events[0] || null);
    setSeq((n) => n + 1);
    setQueue(events.slice(1));
  };

  // Durante l'animazione i PF e chi è in campo vengono dall'istantanea della riga.
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
  // Chi attacca con una mossa fisica balza; chi incassa un pestone sobbalza.
  const lunge = shown?.kind === "move" ? LUNGE_FX[shown.fx] : null;
  const actCls = (side) => {
    if (!shown) return "";
    if (lunge && shown.side === side) return ` is-${lunge}`;
    if (shown.kind === "move" && ["stomp", "dash", "spikes"].includes(shown.fx) && shown.side !== side) return " is-shaken";
    return "";
  };
  const text = shown?.text || battle.log[battle.log.length - 1]?.text || "";
  const me = activeOf(battle, "p");
  const bench = benchAlive(battle, "p");
  const forced = battle.needSwitch === "p" && !busy;
  const balls = (side) => battle.sides[side].team.map((f, i) => {
    const hp = snap ? snap[side].hp[i] : f.hp;
    return <span key={i} className={`pd-ball${hp > 0 ? "" : " is-out"}`} />;
  });

  return (
    <div className="pd-battle">
      <div className="pd-battle-top">
        <span>🗼 Piano {plan.floor}{plan.boss ? " · 👑 Guardiano" : ""} · {AI_LABEL[plan.aiLevel]}</span>
        <span className="pd-audio">
          <button type="button" className={`pd-audio-btn${prefs.musicOn ? "" : " is-off"}`} onClick={() => setMusicOn(!prefs.musicOn)}
            aria-pressed={prefs.musicOn} title={prefs.musicOn ? "Spegni la musica" : "Accendi la musica"}>{prefs.musicOn ? "🎵" : "🔇"}<small>Musica</small></button>
          <button type="button" className={`pd-audio-btn${prefs.sfxOn ? "" : " is-off"}`} onClick={() => setSfxOn(!prefs.sfxOn)}
            aria-pressed={prefs.sfxOn} title={prefs.sfxOn ? "Spegni gli effetti" : "Accendi gli effetti"}>{prefs.sfxOn ? "🔊" : "🔈"}<small>Effetti</small></button>
        </span>
        <button type="button" className="pd-btn pd-btn--ghost" onClick={() => (battle.over || window.confirm("Ritirarti? Il piano resta da fare.")) && onExit()}>
          {battle.over ? "Esci" : "Ritirati"}
        </button>
      </div>

      <div className={`pd-field${art.__arena?.bg ? " has-bg" : ""}`} ref={fieldRef}
        style={art.__arena?.bg ? { "--pd-bg-img": `url("${art.__arena.bg}")` } : undefined}>
        <div className="pd-hud pd-hud--e">
          <div className="pd-hud-name"><b>{E.f.name}</b><small>Lv {E.f.level}</small></div>
          <div className="pd-hud-chips"><TypeChip type={E.f.type} /><ResLine species={E.f.species} compact />{E.status && <span className="pd-status">{STATUS_TXT[E.status]}</span>}</div>
          <Bar value={E.hp} max={E.f.maxHp} />
          <div className="pd-balls">{balls("e")}</div>
        </div>
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
        <div className="pd-hud pd-hud--p">
          <div className="pd-hud-name"><b>{P.f.name}</b><small>Lv {P.f.level}</small></div>
          <div className="pd-hud-chips"><TypeChip type={P.f.type} /><ResLine species={P.f.species} compact />{P.status && <span className="pd-status">{STATUS_TXT[P.status]}</span>}</div>
          <Bar value={P.hp} max={P.f.maxHp} />
          <div className="pd-hud-hp">{P.hp}/{P.f.maxHp} PF</div>
          <div className="pd-balls">{balls("p")}</div>
        </div>
        <PetFx ev={shown} seq={seq} fieldRef={fieldRef} spotRefs={{ p: spotP, e: spotE }} />
      </div>

      <div className="pd-console">
        <p className="pd-text" aria-live="polite">{text}</p>

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
        ) : forced || view === "switch" ? (
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
        ) : (
          <div className="pd-actions">
            <div className="pd-movegrid">
              {Object.keys(me.pp).map((m) => {
                const mv = PET_DEX_MOVES[m];
                return (
                  <button key={m} type="button" className="pd-move" style={{ "--tc": TYPE_COLORS[mv.type][1] }} disabled={busy || me.pp[m] <= 0} onClick={() => act({ kind: "move", move: m })}>
                    <b>{mv.name}</b>
                    <small>{TYPE_ICON[mv.type]} {mv.power ? `pot. ${mv.power}` : "stato"} · PP {me.pp[m]}/{mv.pp}</small>
                  </button>
                );
              })}
            </div>
            <button type="button" className="pd-btn pd-switch-open" disabled={busy || !bench.length} onClick={() => setView("switch")}>
              🔄 Cambia pet {bench.length ? `(${bench.length})` : ""}
            </button>
          </div>
        )}
      </div>
    </div>
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
