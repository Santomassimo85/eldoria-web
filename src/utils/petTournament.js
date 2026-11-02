/* ============================================================
   TORNEO DEI PET (2026-11-02) — a gironi come l'Arena.
   pet_meta/tournament = il torneo in corso (uno alla volta):
     { tid, name, status: registration|groups|final|done|cancelled, maxLevel,
       openedAt, startedAt, endedAt, groupA, groupB, names {uid: nome},
       round (round dei gironi avviato, 0 = nessuno), rounds,
       final: { a, b, id } | null, winner, winnerName,
       prizes: { gold, corone, winXp, joinXp }, prizesDelivered }
   Premi (scelti dal Master): al campione monete d'oro (foundry_inbox → zaino
   su Foundry, le porta "Fetch admin") e Corone (characters.platinum), date
   alla proclamazione; PE ai pet iscritti (joinXp a tutti, winXp in più al
   campione) che ognuno ritira da sé (op del server claimTournamentXp).
   «Iniziamo» (2026-11-02): ogni lotta nasce con readyCheck = true; si gioca
   solo quando i due hanno premuto Iniziamo (o il Master ha forzato).
   pet_tournament_entries/{tid}_{uid} = iscrizione: { tid, uid, name, team: [pet…], at }
     la scrive il giocatore solo a iscrizioni aperte (regole), il Master sempre.
   Le lotte sono normali pet_matches (id pt_{tid}_{chiave}, campi tournament,
   tKey, tGroup "A"|"B"|"F", tRound) create dal Master già "active": si giocano
   come le sfide (PvpBattle) e i premi delle sfide valgono anche qui.
   Le classifiche si contano dalle lotte stesse: niente da tenere allineato.
   Al via di ogni lotta la squadra si rilegge dal Rifugio vero del giocatore
   (i pet iscritti che ha ancora) e chi nel frattempo ha superato il livello
   massimo gioca AL livello massimo.
   ============================================================ */

import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { newBattle } from "../data/petEngine";
import { MAX_TEAM } from "../data/petDex";
import { denOf } from "./petDen";
import { isHiddenChar } from "../data/hiddenPlayers";

export const TOURNEY_REF = () => doc(db, "pet_meta", "tournament");
const entryRef = (tid, uid) => doc(db, "pet_tournament_entries", `${tid}_${uid}`);
const clean = (o) => JSON.parse(JSON.stringify(o));
const notify = (userId, title, message) =>
  addDoc(collection(db, "notifications"), { userId, title, message, read: false, timestamp: serverTimestamp() }).catch(() => {});

export const LIVE = ["registration", "groups", "final"];
export const isLive = (t) => !!t && LIVE.includes(t.status);
export const MAX_LEVEL_CAP = 60;

/* Premi: numeri interi nei limiti, 0 = niente. */
export const PRIZE_LIMITS = { gold: 100000, corone: 1000, winXp: 20000, joinXp: 5000 };
export function cleanPrizes(p = {}) {
  return Object.fromEntries(Object.entries(PRIZE_LIMITS).map(([k, max]) => [k, Math.max(0, Math.min(max, Math.round(Number(p[k]) || 0)))]));
}
export function prizeText(p) {
  const x = cleanPrizes(p);
  const win = [x.gold && `${x.gold} mo`, x.corone && `${x.corone} Corone`, x.winXp && `+${x.winXp} PE ai suoi pet`].filter(Boolean);
  return { win: win.length ? win.join(" · ") : "solo la gloria", join: x.joinXp ? `+${x.joinXp} PE a ogni pet iscritto` : "" };
}
export const updatePrizes = (prizes) => updateDoc(TOURNEY_REF(), { prizes: cleanPrizes(prizes) });

/* Chi deve ancora premere «Iniziamo» in questa lotta. */
export const awaitingReady = (m) => !!m?.readyCheck && m.status === "active";
export const needsMyReady = (m, uid) => awaitingReady(m) && (m.a === uid || m.b === uid) && !m.ready?.[uid];
export function confirmReady(matchId, uid, { force = false } = {}) {
  return runTransaction(db, async (tx) => {
    const r = doc(db, "pet_matches", matchId);
    const s = await tx.get(r);
    const m = s.data();
    if (!m || m.status !== "active" || !m.readyCheck) return null;
    if (!force && m.a !== uid && m.b !== uid) throw new Error("Non è una tua lotta.");
    const ready = { ...(m.ready || {}), ...(force ? {} : { [uid]: true }) };
    const go = force || (ready[m.a] && ready[m.b]);
    const text = force ? "Il Master dà il via!" : go ? "Tutti e due pronti: si comincia!" : null;
    tx.update(r, {
      ready, ...(go ? { readyCheck: false, readyAt: serverTimestamp() } : {}),
      ...(text ? { logText: [...(m.logText || []), text].slice(-150) } : {}),
      updatedAt: serverTimestamp(),
    });
    return { m, go, other: m.a === uid ? m.b : m.a, otherName: m.a === uid ? m.aName : m.bName };
  }).then((res) => {
    if (!res) return null;
    const { m, go } = res;
    const who = m.a === uid ? m.aName : m.bName;
    if (go) [m.a, m.b].filter((u) => u !== uid || force).forEach((u) => notify(u, "🏆 Torneo dei Pet: si comincia!", `La lotta fra ${m.aName} e ${m.bName} è partita: scegli la tua mossa.`));
    else notify(res.other, "🏆 Torneo dei Pet: pronto!", `${who} ha premuto Iniziamo: tocca a te dare il via alla lotta.`);
    return res;
  });
}

/* Calendario all'italiana (come l'Arena): con un numero dispari uno riposa. */
export function roundRobin(ids) {
  const players = [...ids];
  if (players.length < 2) return [];
  if (players.length % 2 === 1) players.push(null);
  const n = players.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = players[i], b = players[n - 1 - i];
      if (a && b) pairs.push([a, b]);
    }
    rounds.push(pairs);
    const fixed = players[0];
    const rest = players.slice(1);
    rest.unshift(rest.pop());
    players.length = 0;
    players.push(fixed, ...rest);
  }
  return rounds;
}

/* Gironi: da 4 iscritti in su due gironi (A e B, a sorte), altrimenti uno solo.
   Con 2 iscritti si va dritti in finale. */
export function planGroups(uids) {
  const s = [...uids];
  for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
  if (s.length <= 2) return { groupA: s, groupB: [] };
  if (s.length <= 3) return { groupA: s, groupB: [] };
  const half = Math.ceil(s.length / 2);
  return { groupA: s.slice(0, half), groupB: s.slice(half) };
}
export function totalRounds(t) {
  return Math.max(roundRobin(t.groupA || []).length, roundRobin(t.groupB || []).length);
}

/* Classifica di un girone dalle lotte finite: vittorie, poi scontro diretto,
   poi meno sconfitte, poi ordine d'iscrizione. */
export function standings(ids = [], matches = [], group) {
  const row = Object.fromEntries(ids.map((u, i) => [u, { uid: u, w: 0, l: 0, played: 0, i }]));
  const h2h = {};
  matches.forEach((m) => {
    if (m.tGroup !== group || m.status !== "done" || !m.winner) return;
    const win = m.winner === "p" ? m.a : m.b;
    const lose = m.winner === "p" ? m.b : m.a;
    if (row[win]) { row[win].w += 1; row[win].played += 1; }
    if (row[lose]) { row[lose].l += 1; row[lose].played += 1; }
    (h2h[win] ||= {})[lose] = win;
    (h2h[lose] ||= {})[win] = win;
  });
  return Object.values(row).sort((p, q) => {
    if (q.w !== p.w) return q.w - p.w;
    const hw = h2h[p.uid]?.[q.uid];
    if (hw === p.uid) return -1;
    if (hw === q.uid) return 1;
    if (p.l !== q.l) return p.l - q.l;
    return p.i - q.i;
  });
}

/* Chi va in finale: 1° A contro 1° B; con un girone solo, 1° contro 2°. */
export function finalists(t, matches) {
  const a = standings(t.groupA, matches, "A");
  if ((t.groupB || []).length) {
    const b = standings(t.groupB, matches, "B");
    return a[0] && b[0] ? [a[0].uid, b[0].uid] : null;
  }
  return a[0] && a[1] ? [a[0].uid, a[1].uid] : null;
}

/* La squadra che un giocatore porta: i pet iscritti che ha ancora, al massimo
   MAX_TEAM, col livello tagliato al massimo del torneo. */
const SNAP_KEYS = ["id", "species", "level", "nick", "evo"];
export const snapPet = (p) => clean(Object.fromEntries(SNAP_KEYS.map((k) => [k, p[k]]).filter(([, v]) => v !== undefined)));
export function eligible(p, maxLevel) { return (Number(p.level) || 1) <= maxLevel; }
export function tournamentTeam(den, ids = [], maxLevel) {
  return ids.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean).slice(0, MAX_TEAM)
    .map((p) => clean({ ...p, level: Math.min(Number(p.level) || 1, maxLevel) }));
}

/* ── Master: apre le iscrizioni e avvisa tutti ─────────────── */
export async function openTournament({ name, maxLevel, masterUid, prizes = {} }) {
  const lv = Math.max(1, Math.min(MAX_LEVEL_CAP, Math.round(Number(maxLevel) || 0)));
  if (!lv) throw new Error("Scegli il livello massimo.");
  const title = String(name || "").trim().slice(0, 60) || "Torneo dei Pet";
  const tid = Date.now().toString(36);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(TOURNEY_REF());
    if (s.exists() && isLive(s.data())) throw new Error("C'è già un torneo in corso.");
    tx.set(TOURNEY_REF(), {
      tid, name: title, status: "registration", maxLevel: lv, openedAt: serverTimestamp(), openedBy: masterUid,
      groupA: [], groupB: [], names: {}, round: 0, rounds: 0, final: null, winner: null, winnerName: null,
      startedAt: null, endedAt: null, prizes: cleanPrizes(prizes), prizesDelivered: null,
    });
  });
  const pz = prizeText(prizes);
  const chars = await getDocs(collection(db, "characters"));
  const batch = writeBatch(db);
  let n = 0;
  chars.forEach((d) => {
    const c = d.data();
    if (!c?.name || isHiddenChar({ id: d.id, ...c }) || d.id === masterUid) return;
    batch.set(doc(collection(db, "notifications")), {
      userId: d.id, title: "🏆 Torneo dei Pet: iscrizioni aperte!",
      message: `${title}: pet fino al livello ${lv}. Al campione: ${pz.win}${pz.join ? `; a chi partecipa ${pz.join}` : ""}. Iscriviti dal Rifugio dei Pet → Torneo.`,
      read: false, timestamp: serverTimestamp(),
    });
    n += 1;
  });
  if (n) await batch.commit();
  return { tid, notified: n };
}

/* ── Iscrizione (giocatore o Master) ───────────────────────── */
export async function joinTournament({ t, uid, name, den, teamIds }) {
  if (!t || t.status !== "registration") throw new Error("Le iscrizioni sono chiuse.");
  const ids = [...new Set(teamIds)].slice(0, MAX_TEAM);
  if (!ids.length) throw new Error("Scegli almeno un pet.");
  const team = ids.map((id) => den.pets.find((p) => p.id === id));
  if (team.some((p) => !p)) throw new Error("Uno dei pet scelti non è più tuo.");
  const over = team.find((p) => !eligible(p, t.maxLevel));
  if (over) throw new Error(`${over.nick || over.species} è oltre il livello ${t.maxLevel}.`);
  await setDoc(entryRef(t.tid, uid), { tid: t.tid, uid, name: name || "Un domatore", team: team.map(snapPet), at: serverTimestamp() });
}
export const leaveTournament = (t, uid) => deleteDoc(entryRef(t.tid, uid));

/* ── Master: lotte di un round ─────────────────────────────── */
function buildMatch(t, key, group, round, A, B, dens, entries) {
  const ta = tournamentTeam(dens[A], entries[A]?.team.map((p) => p.id), t.maxLevel);
  const tb = tournamentTeam(dens[B], entries[B]?.team.map((p) => p.id), t.maxLevel);
  const aName = t.names?.[A] || entries[A]?.name || "?";
  const bName = t.names?.[B] || entries[B]?.name || "?";
  const label = group === "F" ? "🏆 Finale" : `Girone ${group} · round ${round}`;
  const base = {
    a: A, b: B, aName, bName, tournament: t.tid, tKey: key, tGroup: group, tRound: round, tName: t.name,
    actions: {}, seq: 0, seed: Math.floor(Math.random() * 1e9),
  };
  // Chi non ha più nessun pet iscritto perde a tavolino.
  if (!ta.length || !tb.length) {
    const winner = !ta.length && !tb.length ? "p" : ta.length ? "p" : "e";
    const text = `${label}: ${!ta.length ? aName : bName} non ha più pet iscritti, vittoria a tavolino.`;
    return { ...base, status: "done", winner, forfeit: winner === "p" ? "e" : "p", teams: { p: ta, e: tb }, events: [{ kind: "info", text }], logText: [text] };
  }
  const battle = newBattle(ta, tb, { pvp: true, names: { p: aName, e: bName } });
  delete battle.log;
  const start = [
    { kind: "info", text: `${label} del ${t.name}!` },
    { kind: "info", text: `${aName} manda in campo ${battle.sides.p.team[0].name}!` },
    { kind: "info", text: `${bName} manda in campo ${battle.sides.e.team[0].name}!` },
  ];
  return { ...base, status: "active", readyCheck: true, ready: {}, teams: { p: ta, e: tb }, battle, events: start, logText: start.map((e) => e.text) };
}

async function loadEntries(tid) {
  const snap = await getDocs(query(collection(db, "pet_tournament_entries"), where("tid", "==", tid)));
  const out = {};
  snap.forEach((d) => { const e = d.data(); out[e.uid] = e; });
  return out;
}
async function loadDens(uids) {
  const out = {};
  await Promise.all(uids.map(async (u) => { const s = await getDoc(doc(db, "characters", u)); out[u] = denOf(s.exists() ? s.data() : {}); }));
  return out;
}
async function createMatches(t, list, entries) {
  const dens = await loadDens([...new Set(list.flatMap((x) => [x.a, x.b]))]);
  const batch = writeBatch(db);
  const made = [];
  list.forEach(({ key, group, round, a, b }) => {
    const id = `pt_${t.tid}_${key}`;
    const m = buildMatch(t, key, group, round, a, b, dens, entries);
    batch.set(doc(db, "pet_matches", id), { ...clean(m), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    made.push({ id, m });
  });
  await batch.commit();
  made.forEach(({ m }) => {
    if (m.status !== "active") return;
    const what = m.tGroup === "F" ? "la FINALE" : `il round ${m.tRound} (girone ${m.tGroup})`;
    notify(m.a, "🏆 Torneo dei Pet: tocca a te!", `${m.tName}: ${what} contro ${m.bName}. Entra dal Rifugio → Torneo e premi Iniziamo.`);
    notify(m.b, "🏆 Torneo dei Pet: tocca a te!", `${m.tName}: ${what} contro ${m.aName}. Entra dal Rifugio → Torneo e premi Iniziamo.`);
  });
  return made.length;
}

function roundPairs(t, round) {
  const out = [];
  [["A", t.groupA], ["B", t.groupB]].forEach(([g, ids]) => {
    (roundRobin(ids || [])[round - 1] || []).forEach(([a, b], i) => out.push({ key: `G${g}_R${round}_M${i}`, group: g, round, a, b }));
  });
  return out;
}

/* Chiude le iscrizioni, fa i gironi e avvia il primo round (o la finale con 2 iscritti). */
export async function startTournament(t) {
  const entries = await loadEntries(t.tid);
  const uids = Object.keys(entries);
  if (uids.length < 2) throw new Error("Servono almeno 2 iscritti.");
  const { groupA, groupB } = planGroups(uids);
  const names = Object.fromEntries(uids.map((u) => [u, entries[u].name]));
  const next = { ...t, groupA, groupB, names };
  await runTransaction(db, async (tx) => {
    const s = await tx.get(TOURNEY_REF());
    if (s.data()?.status !== "registration" || s.data()?.tid !== t.tid) throw new Error("Il torneo è già partito.");
    if (uids.length === 2) {
      tx.update(TOURNEY_REF(), { status: "final", groupA, groupB, names, round: 0, rounds: 0, startedAt: serverTimestamp(), final: { a: uids[0], b: uids[1], id: `pt_${t.tid}_FINAL` } });
    } else {
      tx.update(TOURNEY_REF(), { status: "groups", groupA, groupB, names, round: 1, rounds: totalRounds(next), startedAt: serverTimestamp() });
    }
  });
  if (uids.length === 2) return createMatches(next, [{ key: "FINAL", group: "F", round: 0, a: uids[0], b: uids[1] }], entries);
  return createMatches(next, roundPairs(next, 1), entries);
}

/* Round successivo dei gironi (quando il round in corso è tutto finito). */
export async function nextRound(t, matches) {
  const cur = matches.filter((m) => m.tGroup !== "F" && m.tRound === t.round);
  if (cur.some((m) => m.status !== "done")) throw new Error("Il round in corso non è ancora finito.");
  const round = t.round + 1;
  if (round > t.rounds) throw new Error("I gironi sono finiti: avvia la finale.");
  await runTransaction(db, async (tx) => {
    const s = await tx.get(TOURNEY_REF());
    if (s.data()?.tid !== t.tid || s.data()?.round !== t.round || s.data()?.status !== "groups") throw new Error("Il round è già stato avviato.");
    tx.update(TOURNEY_REF(), { round });
  });
  const entries = await loadEntries(t.tid);
  return createMatches({ ...t, round }, roundPairs(t, round), entries);
}

/* Finale: 1° A contro 1° B (o 1° contro 2° con un girone solo). */
export async function startFinal(t, matches) {
  const groupMatches = matches.filter((m) => m.tGroup !== "F");
  if (t.round < t.rounds || groupMatches.some((m) => m.status !== "done")) throw new Error("Prima si finiscono i gironi.");
  const f = finalists(t, matches);
  if (!f) throw new Error("Non riesco a capire chi va in finale.");
  const [a, b] = f;
  await runTransaction(db, async (tx) => {
    const s = await tx.get(TOURNEY_REF());
    if (s.data()?.tid !== t.tid || s.data()?.status !== "groups") throw new Error("La finale è già stata avviata.");
    tx.update(TOURNEY_REF(), { status: "final", final: { a, b, id: `pt_${t.tid}_FINAL` } });
  });
  const entries = await loadEntries(t.tid);
  return createMatches(t, [{ key: "FINAL", group: "F", round: 0, a, b }], entries);
}

/* Il Master chiude una lotta ferma assegnando la vittoria. */
export function assignWin(matchId, side) {
  return runTransaction(db, async (tx) => {
    const r = doc(db, "pet_matches", matchId);
    const s = await tx.get(r);
    const m = s.data();
    if (!m || m.status === "done") throw new Error("La lotta è già finita.");
    const text = `Il Master assegna la vittoria a ${side === "p" ? m.aName : m.bName}.`;
    tx.update(r, { status: "done", winner: side, forfeit: side === "p" ? "e" : "p", byMaster: true, logText: [...(m.logText || []), text].slice(-150), updatedAt: serverTimestamp() });
  });
}

/* Fine: si registra il campione e si avvisa tutti. */
export async function closeTournament(t, finalMatch) {
  if (!finalMatch || finalMatch.status !== "done") throw new Error("La finale non è ancora finita.");
  const winner = finalMatch.winner === "p" ? finalMatch.a : finalMatch.b;
  const winnerName = finalMatch.winner === "p" ? finalMatch.aName : finalMatch.bName;
  const runnerName = finalMatch.winner === "p" ? finalMatch.bName : finalMatch.aName;
  const delivered = await runTransaction(db, async (tx) => {
    const s = await tx.get(TOURNEY_REF());
    const cur = s.data();
    if (cur?.tid !== t.tid || cur?.status !== "final") throw new Error("Il torneo è già chiuso.");
    const pz = cleanPrizes(cur.prizes);
    const why = `Vittoria al ${cur.name || "Torneo dei Pet"}`;
    // monete d'oro: nello zaino del personaggio su Foundry (le porta "Fetch admin")
    if (pz.gold > 0) {
      tx.set(doc(collection(db, "foundry_inbox")), {
        status: "pending", origin: "pet_tournament", tournament: t.tid, kind: "gold", op: "add", currency: "gp", amount: pz.gold,
        name: `+${pz.gold} mo · ${why}`, reason: why, target: "player", targetUid: winner, targetName: winnerName, createdAt: serverTimestamp(),
      });
    }
    // Corone del Mercato Nero
    if (pz.corone > 0) tx.update(doc(db, "characters", winner), { platinum: increment(pz.corone) });
    const done = { gold: pz.gold, corone: pz.corone, winXp: pz.winXp, joinXp: pz.joinXp, at: new Date().toISOString() };
    tx.update(TOURNEY_REF(), { status: "done", winner, winnerName, runnerName, endedAt: serverTimestamp(), prizesDelivered: done });
    return done;
  });
  const entries = await loadEntries(t.tid);
  const pz = prizeText(delivered);
  Object.keys(entries).forEach((u) => notify(u, "🏆 Torneo dei Pet concluso",
    u === winner
      ? `Hai vinto il ${t.name}! Premio: ${pz.win}.${delivered.gold ? " Le monete arrivano nello zaino alla prossima sincronizzazione con Foundry." : ""}${delivered.winXp || delivered.joinXp ? " I PE ai pet arrivano appena apri il Rifugio." : ""}`
      : `${winnerName} vince il ${t.name}! Secondo posto: ${runnerName}.${delivered.joinXp ? ` Ai tuoi pet iscritti: +${delivered.joinXp} PE, appena apri il Rifugio.` : ""}`));
  return { winnerName, runnerName, delivered };
}

/* Annulla: le lotte ancora aperte si chiudono senza vincitore. */
export async function cancelTournament(t, matches = []) {
  await runTransaction(db, async (tx) => {
    const s = await tx.get(TOURNEY_REF());
    if (s.data()?.tid !== t.tid || !isLive(s.data())) throw new Error("Il torneo non è più in corso.");
    tx.update(TOURNEY_REF(), { status: "cancelled", endedAt: serverTimestamp() });
  });
  const open = matches.filter((m) => m.status === "active");
  if (open.length) {
    const b = writeBatch(db);
    open.forEach((m) => b.update(doc(db, "pet_matches", m.id), { status: "cancelled", updatedAt: serverTimestamp() }));
    await b.commit();
  }
}

/* Il Master toglie un iscritto (solo a iscrizioni aperte). */
export const removeEntry = (t, uid) => deleteDoc(entryRef(t.tid, uid));
