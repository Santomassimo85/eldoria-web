/* ============================================================
   IL RIFUGIO DEI PET (2026-10-31) — /pet
   Nuovo sistema pet alla Pokémon (dati in data/petDex.js, lotta in
   data/petEngine.js, scritture in utils/petDen.js). Per ora SOLO il
   Master principale lo vede (isMainMaster): agli altri la pagina dice
   che apre presto e il menu non lo mostra.
   Pieghe: Squadra · Rifugio (Pet Dex + adozioni) · Torre · Bestiario
   (Master: pixel art con Gemini, descrizione per il disegno, prove).
   ============================================================ */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { collection, deleteField, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import {
  PET_DEX, PET_DEX_ORDER, PET_DEX_MOVES, STARTERS, RARITY, MAX_TEAM, MAX_PER_SPECIES,
  MOVE_UNLOCK, TYPE_ICON, TYPE_LABEL, costOf,
} from "../data/petDex";
import {
  statsAt, movesAt, xpToNext, newBattle, playTurn, activeOf, benchAlive, towerFloor, towerXp, towerPoints, AI_LABEL,
} from "../data/petEngine";
import {
  denOf, countOf, chooseStarter, buyPet, releasePet, setTeam, renamePet, claimGifts,
  recordTowerResult, savePetArt, savePetLook, petArtPrompt,
} from "../utils/petDen";
import { dataUrlToTransparentDataUrl } from "../utils/aiSprite";
import "./PetDen.css";

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
  <span className={`pd-type pd-type--${type}`}>{TYPE_ICON[type]} {TYPE_LABEL[type]}</span>
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

function MoveList({ species, level }) {
  return (
    <ul className="pd-moves">
      {(PET_DEX[species]?.moves || []).map((m, i) => {
        const mv = PET_DEX_MOVES[m];
        const locked = level < MOVE_UNLOCK[i];
        return (
          <li key={m} className={locked ? "is-locked" : ""}>
            <span>{TYPE_ICON[mv.type]} {mv.name}</span>
            <small>{locked ? `🔒 Lv ${MOVE_UNLOCK[i]}` : mv.power ? `pot. ${mv.power} · ${mv.acc}%` : "stato"}</small>
          </li>
        );
      })}
    </ul>
  );
}

/* ── pagina ───────────────────────────────────────────────── */
export default function PetDen() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const master = isMainMaster(currentUser?.email);
  const [char, setChar] = useState(null);
  const [art, setArt] = useState({});
  const [tab, setTab] = useState("squadra");
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
      setMsg([r.got.length && `🎁 Arrivati dal Mercato: ${names(r.got)}.`, r.refunded.length && `Già al completo: ${names(r.refunded)} → convertiti in punti pet.`].filter(Boolean).join(" "));
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

  if (battle) {
    return (
      <section className="pd-page pd-page--battle">
        <PetBattle
          key={battle.key}
          uid={uid} den={den} art={art} plan={battle.plan} teamIds={battle.teamIds}
          onExit={() => setBattle(null)}
          onRetry={() => setBattle((b) => ({ ...b, key: Date.now() }))}
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

  const TABS = [
    { key: "squadra", label: "Squadra" },
    { key: "rifugio", label: "Rifugio" },
    { key: "torre", label: "Torre" },
    ...(master ? [{ key: "bestiario", label: "Bestiario · Master" }] : []),
  ];

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

      <div className="pd-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "squadra" && <TeamTab uid={uid} den={den} art={art} run={run} />}
      {tab === "rifugio" && <ShopTab uid={uid} den={den} art={art} points={points} run={run} ledger={char.petPointsLedger || []} />}
      {tab === "torre" && (
        <TowerTab den={den} art={art} onFight={(plan) => setBattle({ plan, teamIds: den.team, key: Date.now() })} />
      )}
      {tab === "bestiario" && master && <MasterTools uid={uid} den={den} art={art} run={run} />}
    </section>
  );
}

/* ── scelta dell'iniziale ─────────────────────────────────── */
function StarterPick({ art, onPick }) {
  const [sel, setSel] = useState(null);
  return (
    <div className="pd-starter">
      <p className="pd-eyebrow">Il primo passo</p>
      <h1>Scegli il tuo primo compagno</h1>
      <p className="pd-sub">Si sceglie una volta sola. Gli altri quattro si potranno adottare più avanti, al Rifugio.</p>
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
function PetCard({ pet, art, inTeam, slot, onToggle, onRename, onRelease, canAdd }) {
  const sp = PET_DEX[pet.species];
  const st = statsAt(pet.species, pet.level);
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState(pet.nick || "");
  return (
    <article className={`pd-card${inTeam ? " is-team" : ""}`}>
      {inTeam && <span className="pd-slot">#{slot + 1}</span>}
      <PetSprite species={pet.species} art={art} size={84} />
      <div className="pd-card-body">
        <h3>{pet.nick || sp.name} <small>Lv {pet.level}</small></h3>
        <div className="pd-chips"><TypeChip type={sp.type} /><RarityChip rarity={sp.rarity} /></div>
        <div className="pd-xp"><Bar value={pet.xp} max={xpToNext(pet.level)} kind="xp" /><small>{pet.xp}/{xpToNext(pet.level)} PE</small></div>
        <dl className="pd-stats pd-stats--row">
          <div><dt>PF</dt><dd>{st.hp}</dd></div><div><dt>ATK</dt><dd>{st.atk}</dd></div>
          <div><dt>DIF</dt><dd>{st.def}</dd></div><div><dt>VEL</dt><dd>{st.spd}</dd></div>
        </dl>
        <div className="pd-card-actions">
          <button type="button" className="pd-btn" onClick={onToggle} disabled={!inTeam && !canAdd}>
            {inTeam ? "Togli dalla squadra" : canAdd ? "In squadra" : "Squadra piena"}
          </button>
          <button type="button" className="pd-btn pd-btn--ghost" onClick={() => setOpen((o) => !o)}>{open ? "Chiudi" : "Dettagli"}</button>
        </div>
        {open && (
          <div className="pd-card-more">
            <MoveList species={pet.species} level={pet.level} />
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
    />
  );
  return (
    <div className="pd-tab">
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
        : <p className="pd-empty">Tutti i tuoi pet sono in squadra. Adottane altri al Rifugio.</p>}
    </div>
  );
}

/* ── Rifugio: Pet Dex + adozioni ──────────────────────────── */
function ShopTab({ uid, den, art, points, run, ledger }) {
  const [filter, setFilter] = useState("all");
  const list = PET_DEX_ORDER.filter((k) => filter === "all" || PET_DEX[k].rarity === filter);
  const owned = PET_DEX_ORDER.filter((k) => countOf(den, k) > 0).length;
  return (
    <div className="pd-tab">
      <div className="pd-shop-head">
        <h2 className="pd-h2">Pet Dex <small>{owned}/{PET_DEX_ORDER.length} specie</small></h2>
        <div className="pd-filters">
          {["all", "starter", "common", "rare", "epic", "legendary"].map((r) => (
            <button key={r} type="button" aria-pressed={filter === r} className={filter === r ? "on" : ""} onClick={() => setFilter(r)}>
              {r === "all" ? "Tutti" : RARITY[r].label}
            </button>
          ))}
        </div>
      </div>
      <div className="pd-dex">
        {list.map((k) => {
          const sp = PET_DEX[k];
          const n = countOf(den, k);
          const cost = costOf(k);
          const full = n >= MAX_PER_SPECIES;
          return (
            <article key={k} className={`pd-dex-card${n ? " is-owned" : ""}`}>
              <span className="pd-dex-n">#{String(PET_DEX_ORDER.indexOf(k) + 1).padStart(2, "0")}</span>
              <PetSprite species={k} art={art} size={80} />
              <h3>{sp.name}</h3>
              <div className="pd-chips"><TypeChip type={sp.type} /><RarityChip rarity={sp.rarity} /></div>
              <p>{sp.desc}</p>
              <p className="pd-dex-own">{n ? `Ne hai ${n}/${MAX_PER_SPECIES}` : "Non ancora tuo"}</p>
              <button
                type="button" className="pd-btn pd-btn--main" disabled={full || points < cost}
                onClick={() => window.confirm(`Adottare ${sp.name} per ${cost} punti pet?`) && run(() => buyPet(uid, k), `${sp.name} adottato!`)}
              >
                {full ? "Collezione piena" : `Adotta · ${cost} pt`}
              </button>
            </article>
          );
        })}
      </div>
      <h2 className="pd-h2">Come si guadagnano i punti</h2>
      <ul className="pd-howto">
        <li>⚔ Arena: round e tornei vinti, Sfide Libere concluse</li>
        <li>🗓 Login del giorno</li>
        <li>🐉 Vittoria contro il World Boss</li>
        <li>🗼 Ogni nuovo piano della Torre</li>
        <li>💰 Alcuni pet compaiono anche all'asta del Mercato Nero</li>
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

/* ── Torre ────────────────────────────────────────────────── */
function TowerTab({ den, art, onFight }) {
  const floor = den.tower.floor || 1;
  const plan = towerFloor(floor);
  const team = den.team.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
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
  const [view, setView] = useState("main"); // main | switch
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);

  // Mostra le righe una alla volta.
  useEffect(() => {
    if (!queue.length) return undefined;
    const t = setTimeout(() => { setShown(queue[0]); setQueue((q) => q.slice(1)); }, STEP_MS);
    return () => clearTimeout(t);
  }, [queue]);
  const busy = queue.length > 0;

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
        <button type="button" className="pd-btn pd-btn--ghost" onClick={() => (battle.over || window.confirm("Ritirarti? Il piano resta da fare.")) && onExit()}>
          {battle.over ? "Esci" : "Ritirati"}
        </button>
      </div>

      <div className="pd-field">
        <div className="pd-hud pd-hud--e">
          <div className="pd-hud-name"><b>{E.f.name}</b><small>Lv {E.f.level}</small></div>
          <div className="pd-hud-chips"><TypeChip type={E.f.type} />{E.status && <span className="pd-status">{STATUS_TXT[E.status]}</span>}</div>
          <Bar value={E.hp} max={E.f.maxHp} />
          <div className="pd-balls">{balls("e")}</div>
        </div>
        <div className="pd-spot pd-spot--e">
          <PetSprite key={`e${E.idx}`} species={E.f.species} art={art} size={150} flip fainted={E.hp <= 0} hit={hitSide === "e"} />
        </div>
        <div className="pd-spot pd-spot--p">
          <PetSprite key={`p${P.idx}`} species={P.f.species} art={art} size={170} fainted={P.hp <= 0} hit={hitSide === "p"} />
        </div>
        <div className="pd-hud pd-hud--p">
          <div className="pd-hud-name"><b>{P.f.name}</b><small>Lv {P.f.level}</small></div>
          <div className="pd-hud-chips"><TypeChip type={P.f.type} />{P.status && <span className="pd-status">{STATUS_TXT[P.status]}</span>}</div>
          <Bar value={P.hp} max={P.f.maxHp} />
          <div className="pd-hud-hp">{P.hp}/{P.f.maxHp} PF</div>
          <div className="pd-balls">{balls("p")}</div>
        </div>
        {shown?.kind === "move" && <span key={shown.text + queue.length} className={`pd-fx pd-fx--${shown.mtype} pd-fx--from-${shown.side}`} />}
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
              {movesAt(me.species, me.level).map((m) => {
                const mv = PET_DEX_MOVES[m];
                return (
                  <button key={m} type="button" className={`pd-move pd-move--${mv.type}`} disabled={busy || me.pp[m] <= 0} onClick={() => act({ kind: "move", move: m })}>
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
          <Link className="pd-btn pd-btn--ghost" to="/dm-admin/pet-points">Punti pet dei giocatori</Link>
          {den.starter && <button type="button" className="pd-btn pd-btn--danger" onClick={resetMine}>Azzera il mio Rifugio</button>}
        </div>
      </div>
      <p className="pd-fine">"Genera pixel art" chiede a Gemini UNA creatura alla volta (la descrizione qui sotto dice cosa disegnare, in inglese; si può ritoccare e resta salvata). Lo sfondo magenta si toglie da solo e il respiro è un'animazione del sito.</p>
      {err && <p className="pd-msg">{err}</p>}
      <div className="pd-art-grid">
        {PET_DEX_ORDER.map((k) => {
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
                    <button type="button" className="pd-btn pd-btn--ghost" onClick={() => run(() => buyPet(uid, k, { free: true }), `${sp.name} aggiunto (prova).`)}>+ Dammelo</button>
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
