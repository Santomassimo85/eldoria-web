/* Torneo dei Pet (2026-11-02): iscrizioni, gironi, round, finale.
   La logica sta in utils/petTournament.js; qui la pagina dentro il Rifugio. */
import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { PET_DEX, MAX_TEAM } from "../data/petDex";
import { formName, evoStage } from "../data/petEngine";
import { PETS_PUBLIC } from "../data/petReads";
import { pendingSide } from "../utils/petPvp";
import {
  isLive, MAX_LEVEL_CAP, eligible, standings, finalists, openTournament, joinTournament, leaveTournament,
  startTournament, nextRound, startFinal, assignWin, closeTournament, cancelTournament, removeEntry,
  PRIZE_LIMITS, cleanPrizes, prizeText, updatePrizes, confirmReady, awaitingReady, needsMyReady,
} from "../utils/petTournament";

const STATUS = {
  registration: "📝 Iscrizioni aperte",
  groups: "⚔ Gironi in corso",
  final: "🏆 Finale",
  done: "✓ Concluso",
  cancelled: "✕ Annullato",
};
const petLabel = (p) => `${PET_DEX[p.species]?.icon || "🐾"} ${p.nick || PET_DEX[p.species]?.name || p.species} Lv ${p.level}`;

export function useTournament(uid) {
  const [t, setT] = useState(undefined);
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(doc(db, "pet_meta", "tournament"), (s) => setT(s.exists() ? s.data() : null), () => setT(null));
  }, [uid]);
  return t;
}

// Iscrizione propria al torneo in corso (per la piastrella dell'hub).
export function useMyEntry(t, uid) {
  const [on, setOn] = useState(false);
  const tid = t?.tid;
  useEffect(() => {
    if (!tid || !uid) { setOn(false); return undefined; }
    return onSnapshot(doc(db, "pet_tournament_entries", `${tid}_${uid}`), (s) => setOn(s.exists()), () => setOn(false));
  }, [tid, uid]);
  return on;
}

export function tournamentTile(t, uid, matches, entered) {
  if (t === undefined) return null;
  const myTurn = matches.filter((m) => m.tournament && m.tournament === t?.tid && m.status === "active" && (pendingSide(m, uid) || needsMyReady(m, uid))).length;
  let sub = "nessun torneo in corso";
  if (t?.status === "registration") sub = `iscrizioni aperte · max Lv ${t.maxLevel}${entered ? " · sei iscritto" : ""}`;
  else if (t?.status === "groups") sub = `gironi · round ${t.round}/${t.rounds}`;
  else if (t?.status === "final") sub = "la finale!";
  else if (t?.status === "done") sub = `ultimo campione: ${t.winnerName}`;
  if (myTurn) sub = `✨ tocca a te · ${sub}`;
  return { key: "torneo", icon: "🏆", title: "Torneo dei Pet", sub, hot: myTurn > 0 || (t?.status === "registration" && !entered) };
}

export default function TournamentTab({ t, uid, char, den, master, art, PetSprite, run, openMatch }) {
  const tid = t?.tid;
  const [entries, setEntries] = useState([]);
  const [matches, setMatches] = useState([]);
  useEffect(() => {
    if (!tid) { setEntries([]); return undefined; }
    return onSnapshot(query(collection(db, "pet_tournament_entries"), where("tid", "==", tid)),
      (s) => setEntries(s.docs.map((d) => d.data()).sort((a, b) => (a.at?.toMillis?.() || 0) - (b.at?.toMillis?.() || 0))), () => setEntries([]));
  }, [tid]);
  useEffect(() => {
    if (!tid) { setMatches([]); return undefined; }
    return onSnapshot(query(collection(db, "pet_matches"), where("tournament", "==", tid)),
      (s) => setMatches(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setMatches([]));
  }, [tid]);

  if (t === undefined) return <p className="pd-loading">Carico il torneo…</p>;
  const live = isLive(t);
  const myEntry = entries.find((e) => e.uid === uid);

  return (
    <div className="pd-tab pd-tourney">
      {t && (
        <div className={`pd-tn-head is-${t.status}`}>
          <div>
            <h2>{t.name}</h2>
            <p className="pd-fine">{STATUS[t.status] || t.status} · pet fino al <b>Lv {t.maxLevel}</b> · {entries.length} iscritti</p>
            <p className="pd-tn-prize">🎁 Al campione: <b>{prizeText(t.prizesDelivered || t.prizes).win}</b>{prizeText(t.prizesDelivered || t.prizes).join ? ` · a chi partecipa: ${prizeText(t.prizesDelivered || t.prizes).join}` : ""}</p>
          </div>
          {t.status === "done" && <div className="pd-tn-champ">👑 {t.winnerName}<small>2° {t.runnerName}</small></div>}
        </div>
      )}

      {!live && (master
        ? <OpenForm run={run} uid={uid} last={t} />
        : <p className="pd-empty">{t?.status === "done" ? `Il torneo è finito: ha vinto ${t.winnerName}. ` : ""}Nessun torneo aperto per ora: quando il Master lo apre ti arriva una notifica.</p>)}

      {master && live && <PrizeEditor t={t} run={run} />}

      {t?.status === "registration" && (
        <>
          <JoinBox t={t} uid={uid} char={char} den={den} art={art} PetSprite={PetSprite} entry={myEntry} run={run} />
          <EntrantsPanel t={t} entries={entries} master={master} run={run} uid={uid} />
        </>
      )}

      {t && ["groups", "final", "done"].includes(t.status) && (t.groupA?.length || t.final) && (
        <Bracket t={t} matches={matches} uid={uid} master={master} run={run} openMatch={openMatch} entries={entries} />
      )}

      {t && ["groups", "final"].includes(t.status) && myEntry && (
        <details className="pd-tn-fold">
          <summary>La tua squadra del torneo</summary>
          <p className="pd-fine">{myEntry.team.map(petLabel).join(" · ")}. Se un pet sale oltre il Lv {t.maxLevel}, nel torneo combatte al Lv {t.maxLevel}.</p>
        </details>
      )}
    </div>
  );
}

/* ── Master: nuovo torneo ─────────────────────────────────── */
function OpenForm({ run, uid, last }) {
  const [name, setName] = useState("");
  const [lv, setLv] = useState(last?.maxLevel || 10);
  const [busy, setBusy] = useState(false);
  const [prizes, setPrizes] = useState(() => cleanPrizes(last?.prizes || { gold: 100, corone: 5, winXp: 200, joinXp: 40 }));
  const go = () => {
    if (!window.confirm(`Aprire le iscrizioni (pet fino al Lv ${lv}) e mandare la notifica a tutti i giocatori?\nAl campione: ${prizeText(prizes).win}${prizeText(prizes).join ? `\nA chi partecipa: ${prizeText(prizes).join}` : ""}`)) return;
    setBusy(true);
    run(async () => {
      const r = await openTournament({ name, maxLevel: lv, masterUid: uid, prizes });
      return r;
    }, "Iscrizioni aperte: notifica mandata a tutti i giocatori attivi.").finally(() => setBusy(false));
  };
  return (
    <div className="pd-tn-box">
      <h3>🏆 Organizza un torneo</h3>
      {!PETS_PUBLIC && <p className="pd-tn-warn">⚠ Il Rifugio adesso è chiuso ai giocatori (PETS_PUBLIC = false): riceveranno la notifica ma non potranno entrare a iscriversi finché non lo riapri.</p>}
      <label className="pd-tn-field">Nome
        <input className="pd-search" value={name} maxLength={60} placeholder="Torneo dei Pet" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="pd-tn-field">Livello massimo dei pet
        <span className="pd-tn-lv">
          <input className="pd-search" type="number" min={1} max={MAX_LEVEL_CAP} value={lv}
            onChange={(e) => setLv(Math.max(1, Math.min(MAX_LEVEL_CAP, Number(e.target.value) || 1)))} />
          {[5, 10, 15, 20, 30].map((n) => (
            <button key={n} type="button" className={`pd-chipbtn${lv === n ? " is-on" : ""}`} onClick={() => setLv(n)}>{n}</button>
          ))}
        </span>
      </label>
      <PrizeFields prizes={prizes} set={setPrizes} />
      <p className="pd-fine">Si gioca a gironi come l'Arena: da 4 iscritti due gironi a sorte, ognuno contro tutti un round alla volta, poi la finale fra i primi dei due gironi (con 3 iscritti un girone e finale fra i primi due, con 2 si va dritti in finale). Le lotte sono come le sfide fra domatori, con le squadre dell'iscrizione.</p>
      <button type="button" className="pd-btn pd-btn--main pd-btn--big" disabled={busy} onClick={go}>📣 Apri le iscrizioni e avvisa tutti</button>
    </div>
  );
}

/* ── Premi ────────────────────────────────────────────────── */
const PRIZE_FIELDS = [
  { k: "gold", icon: "🪙", label: "Monete d'oro al campione", hint: "vanno nello zaino del suo personaggio su Foundry (con Fetch admin)", unit: "mo" },
  { k: "corone", icon: "👑", label: "Corone al campione", hint: "per il Mercato Nero, subito", unit: "Corone" },
  { k: "winXp", icon: "✨", label: "PE ai pet del campione", hint: "a ognuno dei pet con cui si è iscritto", unit: "PE" },
  { k: "joinXp", icon: "🐾", label: "PE a chi partecipa", hint: "a ogni pet iscritto, di tutti (campione compreso)", unit: "PE" },
];
function PrizeFields({ prizes, set }) {
  return (
    <div className="pd-tn-prizes">
      {PRIZE_FIELDS.map((f) => (
        <label key={f.k} className="pd-tn-field">
          <span>{f.icon} {f.label}</span>
          <span className="pd-tn-lv">
            <input className="pd-search" type="number" min={0} max={PRIZE_LIMITS[f.k]} value={prizes[f.k]}
              onChange={(e) => set((p) => cleanPrizes({ ...p, [f.k]: e.target.value }))} />
            <small>{f.unit}</small>
          </span>
          <small>{f.hint}</small>
        </label>
      ))}
      <p className="pd-fine">I PE dei pet non contano nel tetto giornaliero: sono un premio. Monete e Corone si consegnano quando proclami il campione; i PE li prende ognuno appena apre il Rifugio. 0 = niente.</p>
    </div>
  );
}
function PrizeEditor({ t, run }) {
  const [open, setOpen] = useState(false);
  const [prizes, setPrizes] = useState(() => cleanPrizes(t.prizes));
  useEffect(() => setPrizes(cleanPrizes(t.prizes)), [t.tid, t.prizes?.gold, t.prizes?.corone, t.prizes?.winXp, t.prizes?.joinXp]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <details className="pd-tn-box pd-tn-fold" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>🛡 Premi del torneo · modifica</summary>
      <PrizeFields prizes={prizes} set={setPrizes} />
      <div className="pd-tn-actions">
        <button type="button" className="pd-btn pd-btn--main" onClick={() => run(() => updatePrizes(prizes), "Premi aggiornati.")}>Salva i premi</button>
      </div>
    </details>
  );
}

/* ── Iscrizione ───────────────────────────────────────────── */
function JoinBox({ t, uid, char, den, art, PetSprite, entry, run }) {
  const initial = useMemo(() => {
    const own = (entry?.team || []).map((p) => p.id).filter((id) => den.pets.some((p) => p.id === id && eligible(p, t.maxLevel)));
    if (own.length) return own;
    return den.team.filter((id) => den.pets.some((p) => p.id === id && eligible(p, t.maxLevel))).slice(0, MAX_TEAM);
  }, [entry, den, t.maxLevel]);
  const [pick, setPick] = useState(initial);
  useEffect(() => setPick(initial), [initial.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id) => setPick((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_TEAM ? cur : [...cur, id]));
  const pets = [...den.pets].sort((a, b) => (eligible(b, t.maxLevel) - eligible(a, t.maxLevel)) || b.level - a.level);
  const okCount = den.pets.filter((p) => eligible(p, t.maxLevel)).length;
  const save = () => run(() => joinTournament({ t, uid, name: char?.name, den, teamIds: pick }), entry ? "Squadra del torneo aggiornata." : "Sei iscritto al torneo! 🏆");
  return (
    <div className="pd-tn-box">
      <h3>{entry ? "✓ Sei iscritto" : "Iscriviti"} <small>scegli fino a {MAX_TEAM} pet, al massimo Lv {t.maxLevel}</small></h3>
      {!den.pets.length && <p className="pd-empty">Non hai ancora pet: scegli il tuo primo compagno nel Rifugio.</p>}
      {den.pets.length > 0 && !okCount && <p className="pd-tn-warn">Nessuno dei tuoi pet è entro il Lv {t.maxLevel}: schiudi un uovo nuovo per partecipare.</p>}
      <div className="pd-tn-pets">
        {pets.map((p) => {
          const ok = eligible(p, t.maxLevel);
          const on = pick.includes(p.id);
          return (
            <button key={p.id} type="button" className={`pd-tn-pet${on ? " is-on" : ""}${ok ? "" : " is-over"}`} disabled={!ok || (!on && pick.length >= MAX_TEAM)}
              onClick={() => toggle(p.id)} aria-pressed={on} title={ok ? "" : `Oltre il Lv ${t.maxLevel}: non può partecipare`}>
              <PetSprite species={p.species} evo={evoStage(p)} art={art} size={56} />
              <b>{p.nick || formName(p)}</b>
              <small>{ok ? `Lv ${p.level}` : `Lv ${p.level} · oltre il max`}</small>
              {on && <i aria-hidden="true">{pick.indexOf(p.id) + 1}</i>}
            </button>
          );
        })}
      </div>
      <div className="pd-tn-actions">
        <button type="button" className="pd-btn pd-btn--main" disabled={!pick.length} onClick={save}>{entry ? "Aggiorna la squadra" : `Iscriviti con ${pick.length || "…"} pet`}</button>
        {entry && <button type="button" className="pd-btn pd-btn--ghost" onClick={() => window.confirm("Ritirare l'iscrizione?") && run(() => leaveTournament(t, uid), "Iscrizione ritirata.")}>Ritira l'iscrizione</button>}
      </div>
      <p className="pd-fine">Il primo pet scelto è quello che scende in campo per primo. Puoi cambiare la squadra finché le iscrizioni sono aperte.</p>
    </div>
  );
}

/* ── Iscritti (il Master li gestisce da qui) ──────────────── */
function EntrantsPanel({ t, entries, master, run, uid }) {
  const [busy, setBusy] = useState(false);
  const start = () => {
    if (!window.confirm(`Chiudere le iscrizioni con ${entries.length} iscritti e avviare il torneo?`)) return;
    setBusy(true);
    run(() => startTournament(t), "Torneo avviato: gironi fatti e prime lotte create, i giocatori sono avvisati.").finally(() => setBusy(false));
  };
  return (
    <div className="pd-tn-box">
      <h3>Iscritti <small>{entries.length}</small></h3>
      {!entries.length && <p className="pd-empty">Ancora nessuno.</p>}
      {entries.length > 0 && (
        <div className="pd-tn-table" role="table" aria-label="Iscritti al torneo">
          <div className="pd-tn-tr is-head" role="row"><span role="columnheader">Domatore</span><span role="columnheader">Pet</span><span role="columnheader">Livelli</span>{master && <span role="columnheader" />}</div>
          {entries.map((e) => {
            const lvls = e.team.map((p) => Number(p.level) || 1);
            return (
              <div key={e.uid} className={`pd-tn-tr${e.uid === uid ? " is-me" : ""}`} role="row">
                <span role="cell"><b>{e.name}</b></span>
                <span role="cell">{e.team.length}/{MAX_TEAM}</span>
                <span role="cell" className="pd-tn-lvls">
                  {e.team.map((p) => <em key={p.id} title={petLabel(p)}>{PET_DEX[p.species]?.icon || "🐾"} {p.level}</em>)}
                  <small>max {Math.max(...lvls)} · media {Math.round(lvls.reduce((a, n) => a + n, 0) / lvls.length)}</small>
                </span>
                {master && (
                  <span role="cell">
                    <button type="button" className="pd-link" onClick={() => window.confirm(`Togliere ${e.name} dal torneo?`) && run(() => removeEntry(t, e.uid), `${e.name} tolto dal torneo.`)}>Togli</button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {master && (
        <div className="pd-tn-actions">
          <button type="button" className="pd-btn pd-btn--main" disabled={busy || entries.length < 2} onClick={start}>
            ⚔ Chiudi le iscrizioni e inizia{entries.length < 2 ? " (servono 2 iscritti)" : ` (${entries.length})`}
          </button>
          <button type="button" className="pd-btn pd-btn--danger" onClick={() => window.confirm("Annullare il torneo?") && run(() => cancelTournament(t, []), "Torneo annullato.")}>Annulla il torneo</button>
        </div>
      )}
    </div>
  );
}

/* ── Gironi, round e finale ───────────────────────────────── */
function MatchRow({ m, uid, master, run, openMatch }) {
  const mine = m.a === uid || m.b === uid;
  const rw = awaitingReady(m);
  const myTurn = !!pendingSide(m, uid) || needsMyReady(m, uid);
  const winName = m.winner === "p" ? m.aName : m.winner === "e" ? m.bName : null;
  let state = "";
  if (rw) state = `✋ Iniziamo: ${m.aName} ${m.ready?.[m.a] ? "✅" : "⏳"} · ${m.bName} ${m.ready?.[m.b] ? "✅" : "⏳"}${needsMyReady(m, uid) ? " · ✨ premi Iniziamo" : ""}`;
  else if (m.status === "active") state = mine ? (myTurn ? "✨ tocca a te" : "aspetti l'altro") : `turno ${(m.seq || 0) + 1}`;
  else if (m.status === "done") state = `✓ vince ${winName}${m.byMaster ? " (Master)" : m.forfeit ? " (a tavolino/abbandono)" : ""}`;
  else if (m.status === "cancelled") state = "annullata";
  return (
    <div className={`pd-mrow pd-tn-match${myTurn ? " is-hot" : ""}${m.status === "done" ? " is-past" : ""}`}>
      <span className="pd-mrow-who">
        <span><b className={m.winner === "p" ? "is-win" : ""}>{m.aName}</b> contro <b className={m.winner === "e" ? "is-win" : ""}>{m.bName}</b></span>
        <small>{state}</small>
      </span>
      <span className="pd-mrow-actions">
        {mine && m.battle && m.status !== "cancelled" && <button type="button" className={`pd-btn${myTurn ? " pd-btn--main" : ""}`} onClick={() => openMatch(m.id)}>{m.status === "active" ? (needsMyReady(m, uid) ? "✋ Iniziamo" : "Entra") : "Rivedi"}</button>}
        {master && rw && <button type="button" className="pd-btn" onClick={() => run(() => confirmReady(m.id, uid, { force: true }), "Lotta avviata.")}>▶ Avvia</button>}
        {master && m.status === "active" && (
          <>
            <button type="button" className="pd-btn pd-btn--ghost" onClick={() => window.confirm(`Assegnare la vittoria a ${m.aName}?`) && run(() => assignWin(m.id, "p"), `Vittoria assegnata a ${m.aName}.`)}>Vince {m.aName}</button>
            <button type="button" className="pd-btn pd-btn--ghost" onClick={() => window.confirm(`Assegnare la vittoria a ${m.bName}?`) && run(() => assignWin(m.id, "e"), `Vittoria assegnata a ${m.bName}.`)}>Vince {m.bName}</button>
          </>
        )}
      </span>
    </div>
  );
}

function GroupTable({ name, ids, matches, t }) {
  const rows = standings(ids, matches, name);
  return (
    <div className="pd-tn-group">
      <h4>Girone {name}</h4>
      <div className="pd-tn-table" role="table" aria-label={`Classifica girone ${name}`}>
        <div className="pd-tn-tr is-head pd-tn-tr--st" role="row"><span role="columnheader">#</span><span role="columnheader">Domatore</span><span role="columnheader">V</span><span role="columnheader">S</span></div>
        {rows.map((r, i) => (
          <div key={r.uid} className={`pd-tn-tr pd-tn-tr--st${i === 0 ? " is-top" : ""}`} role="row">
            <span role="cell">{i + 1}</span><span role="cell"><b>{t.names?.[r.uid] || "?"}</b></span><span role="cell">{r.w}</span><span role="cell">{r.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bracket({ t, matches, uid, master, run, openMatch }) {
  const [busy, setBusy] = useState(false);
  const groupMatches = matches.filter((m) => m.tGroup !== "F");
  const finalMatch = matches.find((m) => m.tGroup === "F");
  const curRound = groupMatches.filter((m) => m.tRound === t.round);
  const roundDone = curRound.length > 0 && curRound.every((m) => m.status === "done");
  const groupsDone = t.round >= t.rounds && groupMatches.every((m) => m.status === "done");
  const rounds = [...new Set(groupMatches.map((m) => m.tRound))].sort((a, b) => b - a);
  const f = t.status === "groups" && groupsDone ? finalists(t, matches) : null;
  const act = (fn, ok) => { setBusy(true); run(fn, ok).finally(() => setBusy(false)); };
  return (
    <>
      {(t.groupA?.length > 0 && t.rounds > 0) && (
        <div className="pd-tn-box">
          <h3>Gironi <small>{t.status === "groups" ? `round ${t.round} di ${t.rounds}` : "conclusi"}</small></h3>
          <div className="pd-tn-groups">
            <GroupTable name="A" ids={t.groupA} matches={matches} t={t} />
            {t.groupB?.length > 0 && <GroupTable name="B" ids={t.groupB} matches={matches} t={t} />}
          </div>
          <p className="pd-fine">{t.groupB?.length ? "In finale vanno i primi dei due gironi." : "In finale vanno i primi due."} A pari vittorie conta lo scontro diretto.</p>
        </div>
      )}

      {master && t.status === "groups" && (
        <div className="pd-tn-box pd-tn-master">
          <h3>🛡 Pannello del Master</h3>
          {!roundDone && <p className="pd-fine">Round {t.round}: {curRound.filter((m) => m.status === "done").length}/{curRound.length} lotte finite. Se una lotta è ferma puoi assegnare tu la vittoria.</p>}
          <div className="pd-tn-actions">
            {t.round < t.rounds && <button type="button" className="pd-btn pd-btn--main" disabled={busy || !roundDone} onClick={() => act(() => nextRound(t, matches), `Round ${t.round + 1} avviato.`)}>▶ Avvia il round {t.round + 1}</button>}
            {t.round >= t.rounds && (
              <button type="button" className="pd-btn pd-btn--main" disabled={busy || !groupsDone || !f} onClick={() => act(() => startFinal(t, matches), "Finale avviata!")}>
                🏆 Avvia la finale{f ? `: ${t.names?.[f[0]]} contro ${t.names?.[f[1]]}` : ""}
              </button>
            )}
            <button type="button" className="pd-btn pd-btn--danger" onClick={() => window.confirm("Annullare il torneo? Le lotte aperte si chiudono.") && act(() => cancelTournament(t, matches), "Torneo annullato.")}>Annulla il torneo</button>
          </div>
        </div>
      )}

      {(t.status === "final" || t.status === "done") && finalMatch && (
        <div className="pd-tn-box pd-tn-final">
          <h3>🏆 Finale</h3>
          <MatchRow m={finalMatch} uid={uid} master={master} run={run} openMatch={openMatch} />
          {master && t.status === "final" && (
            <div className="pd-tn-actions">
              <button type="button" className="pd-btn pd-btn--main" disabled={busy || finalMatch.status !== "done"} onClick={() => act(() => closeTournament(t, finalMatch).then((r) => r), "Torneo concluso: campione proclamato e notifica mandata.")}>👑 Proclama il campione</button>
              <button type="button" className="pd-btn pd-btn--danger" onClick={() => window.confirm("Annullare il torneo?") && act(() => cancelTournament(t, matches), "Torneo annullato.")}>Annulla il torneo</button>
            </div>
          )}
        </div>
      )}

      {rounds.map((r) => (
        <div key={r} className="pd-tn-box">
          <h3>Round {r}{r === t.round && t.status === "groups" ? <small>in corso</small> : null}</h3>
          <div className="pd-mlist">
            {groupMatches.filter((m) => m.tRound === r).sort((a, b) => a.tKey.localeCompare(b.tKey)).map((m) => (
              <MatchRow key={m.id} m={m} uid={uid} master={master} run={run} openMatch={openMatch} />
            ))}
          </div>
          {(() => {
            const playing = new Set(groupMatches.filter((m) => m.tRound === r).flatMap((m) => [m.a, m.b]));
            const rest = [...(t.groupA || []), ...(t.groupB || [])].filter((u) => !playing.has(u));
            return rest.length ? <p className="pd-fine">Riposa: {rest.map((u) => t.names?.[u]).join(", ")}.</p> : null;
          })()}
        </div>
      ))}
    </>
  );
}
