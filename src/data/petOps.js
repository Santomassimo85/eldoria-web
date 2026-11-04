/* ============================================================
   PET OPS (2026-10-31) — le regole del Rifugio dei Pet, PURE (niente
   Firebase). Le usa il SERVER: la callable `petDo` (functions/index.js)
   carica functions/petBundle.js, che è QUESTO file impacchettato con
   esbuild (`npm run build:pets`, da rifare dopo ogni modifica qui, in
   petDex.js, petEngine.js o petBag.js). Il sito chiama solo la callable
   (utils/petDen.js): le regole di Firestore non lasciano scrivere petDen,
   punti pet e regali dal browser.
   Ogni operazione è (den, data, ...args) → { patch, out }: modifica `den`
   (= denOf(data)) e restituisce i campi in più da scrivere sul personaggio.
   ============================================================ */

import { PET_DEX, STARTERS, MAX_PER_SPECIES, MAX_TEAM, MAX_EGGS, MAX_MOVES, MAX_LEVEL, EGGS, refundOf, rollEgg, gradeOfLevel, learnPool } from "./petDex";
import { mix32, desperateOk, addXp, towerXp, towerLossXp, LOSS_XP, towerPoints, battleMoves, knownMoves, learnedMoves, xpToNext, newBattle, playTurn, withSeed, towerFloor, towerWeek, DAILY_XP_CAP, xpTodayOf, xpDayKey } from "./petEngine";
import { PET_BAG, SCROLL_SLOTS, CHARMS, towerDrops, usableInBattle, EVO_STONE } from "./petBag";
import { EVOLUTIONS, evoLevelOf, evoDiceOf } from "./petEvo";
export { LOSS_XP };

const newId = () => `pet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const denOf = (data) => {
  const d = data?.petDen || {};
  return {
    starter: d.starter || null,
    pets: Array.isArray(d.pets) ? d.pets : [],
    team: Array.isArray(d.team) ? d.team : [],
    tower: { floor: 1, best: 0, wins: 0, ...(d.tower || {}) },
    eggs: Array.isArray(d.eggs) ? d.eggs : [],
    mascot: d.mascot || null,
    items: d.items && typeof d.items === "object" ? { ...d.items } : {},
    pvp: { wins: 0, losses: 0, day: "", rewarded: 0, claimed: [], ...(d.pvp || {}) },
    tourney: { claimed: [], wins: 0, ...(d.tourney || {}) },
    log: Array.isArray(d.log) ? d.log : [],
  };
};
// Una voce nella storia del Rifugio (la più recente in testa).
const LOG_MAX = 150;
const addLog = (den, entry) => { den.log = [{ t: new Date().toISOString(), ...entry }, ...den.log].slice(0, LOG_MAX); };
export const countOf = (den, species) => den.pets.filter((p) => p.species === species).length;


const makePet = (species, from) => ({ id: newId(), species, level: 1, xp: 0, nick: "", from, at: new Date().toISOString() });

export const STARTER_GIFT = 120;
export function chooseStarter(den, data, species) {
    if (den.starter || den.pets.length) throw new Error("Hai già scelto il tuo primo compagno.");
    if (!STARTERS.includes(species)) throw new Error("Non è un pet iniziale.");
    const p = makePet(species, "starter");
    den.starter = species;
    den.pets.push(p);
    den.team = [p.id];
    addLog(den, { k: "starter", species });
    // Regalo di benvenuto (2026-11-01): due uova, squadra di 3 già dalla prima settimana.
    const ledger = [{ source: "starter_gift", label: "Regalo di benvenuto del Rifugio", amount: STARTER_GIFT, ts: new Date().toISOString() }, ...((data.petPointsLedger || []).slice(0, 29))];
    return { patch: { petPoints: (Number(data.petPoints) || 0) + STARTER_GIFT, petPointsLedger: ledger }, out: { gift: STARTER_GIFT } };
}

// Pet dato a mano (Master, per le prove): niente punti.
export function givePet(den, data, species) {
    if (!PET_DEX[species]) throw new Error("Specie sconosciuta.");
    if (countOf(den, species) >= MAX_PER_SPECIES) throw new Error(`Hai già ${MAX_PER_SPECIES} ${PET_DEX[species].name}.`);
    const p = makePet(species, "master");
    den.pets.push(p);
    if (den.team.length < MAX_TEAM) den.team.push(p.id);
    addLog(den, { k: "give", species });
}

const makeEgg = (egg, from) => ({ id: newId().replace("pet_", "egg_"), egg, from, at: new Date().toISOString() });

export function buyEgg(den, data, eggKey, { free = false } = {}) {
    const egg = EGGS[eggKey];
    if (!egg) throw new Error("Uovo sconosciuto.");
    if (den.eggs.length >= MAX_EGGS) throw new Error(`Il nido è pieno (${MAX_EGGS} uova): schiudine qualcuna.`);
    const cost = free ? 0 : egg.cost;
    const pts = Number(data.petPoints) || 0;
    if (pts < cost) throw new Error(`Ti mancano ${cost - pts} punti pet.`);
    den.eggs.push(makeEgg(eggKey, free ? "master" : "bottega"));
    addLog(den, { k: "egg_buy", egg: eggKey, cost });
    return { patch: cost ? { petPoints: pts - cost } : {} };
}

/* Schiude un uovo: il tiro avviene DENTRO la transazione, quindi l'esito
   salvato è quello mostrato. Doppione oltre il limite = punti pet. */
export function hatchEgg(den, data, eggId) {
    if (!den.starter) throw new Error("Prima scegli il tuo pet iniziale.");
    const egg = den.eggs.find((e) => e.id === eggId);
    if (!egg) throw new Error("Quest'uovo non c'è più.");
    den.eggs = den.eggs.filter((e) => e.id !== eggId);
    const { species, rarity } = rollEgg(egg.egg);
    if (countOf(den, species) >= MAX_PER_SPECIES) {
      const pts = refundOf(species);
      addLog(den, { k: "hatch", egg: egg.egg, species, rarity, refunded: pts });
      return { patch: { petPoints: (Number(data.petPoints) || 0) + pts }, out: { species, rarity, refunded: pts } };
    }
    const p = makePet(species, `uovo:${egg.egg}`);
    den.pets.push(p);
    const joined = den.team.length < MAX_TEAM;
    if (joined) den.team.push(p.id);
    addLog(den, { k: "hatch", egg: egg.egg, species, rarity });
    return { out: { species, rarity, petId: p.id, joined } };
}

export const MASCOT_XP_BONUS = 0.05;

/* PE con il tetto giornaliero (2026-11-01): ogni pet prende al massimo
   DAILY_XP_CAP PE al giorno (giorno di Roma) fra torre, sfide e Pietra
   dell'Esperienza; il resto si perde. Restituisce il pet aggiornato,
   i livelli presi (ups) e i PE presi davvero (gained). */
function gainXp(p, amount) {
    const today = xpDayKey();
    const done = xpTodayOf(p);
    const gained = Math.max(0, Math.min(amount, DAILY_XP_CAP - done));
    const n = addXp(p, gained);
    const { ups, ...rest } = n;
    return { pet: { ...rest, xpDay: { d: today, n: done + gained } }, ups, gained };
}

// Mascotte: un pet a scelta (o nessuno con petId null).
export function setMascot(den, data, petId) {
    if (petId && !den.pets.some((p) => p.id === petId)) throw new Error("Pet non trovato.");
    den.mascot = petId || null;
}

export function releasePet(den, data, petId) {
    if (den.pets.length <= 1) throw new Error("Non puoi restare senza pet.");
    if (den.mascot === petId) den.mascot = null;
    den.pets = den.pets.filter((p) => p.id !== petId);
    den.team = den.team.filter((id) => id !== petId);
    if (!den.team.length) den.team = [den.pets[0].id];
}

export function setTeam(den, data, team) {
    const ids = [...new Set(team)].filter((id) => den.pets.some((p) => p.id === id)).slice(0, MAX_TEAM);
    if (!ids.length) throw new Error("La squadra deve avere almeno un pet.");
    den.team = ids;
}

export function renamePet(den, data, petId, nick) {
    const p = den.pets.find((x) => x.id === petId);
    if (p) p.nick = String(nick || "").trim().slice(0, 18);
}

/* Gradi delle mosse: impara (o cambia) la mossa del grado `grade`.
   La nuova mossa entra subito fra quelle di lotta: al posto della
   vecchia dello stesso grado, oppure in un posto libero. */
export function learnMove(den, data, petId, grade, moveId) {
    const p = den.pets.find((x) => x.id === petId);
    if (!p) throw new Error("Pet non trovato.");
    if (grade > gradeOfLevel(p.level)) throw new Error("Grado non ancora sbloccato.");
    if (!learnPool(p.species, grade).includes(moveId)) throw new Error("Questo pet non può imparare questa mossa.");
    const before = battleMoves(p);
    const old = (p.learned || {})[grade];
    p.learned = { ...(p.learned || {}), [grade]: moveId };
    let set = before.map((m) => (m === old ? moveId : m));
    if (!set.includes(moveId) && set.length < MAX_MOVES) set = [...set, moveId];
    p.moveset = set;
}

export function setMoveset(den, data, petId, moves) {
    const p = den.pets.find((x) => x.id === petId);
    if (!p) throw new Error("Pet non trovato.");
    const known = knownMoves(p);
    const set = moves.filter((m, i, a) => known.includes(m) && a.indexOf(m) === i).slice(0, MAX_MOVES);
    if (!set.length) throw new Error("Serve almeno una mossa.");
    p.moveset = set;
}

/* ── BISACCIA DEL DOMATORE ───────────────────────────────────── */
const addItems = (den, ids) => ids.forEach((id) => { if (PET_BAG[id]) den.items[id] = (den.items[id] || 0) + 1; });
const takeItem = (den, id) => {
  if (!(den.items[id] > 0)) throw new Error("Non hai questo oggetto.");
  den.items[id] -= 1;
  if (!den.items[id]) delete den.items[id];
};
const petOf = (den, petId) => {
  const p = den.pets.find((x) => x.id === petId);
  if (!p) throw new Error("Pet non trovato.");
  return p;
};

export function buyItem(den, data, id) {
    const it = PET_BAG[id];
    if (!it || !it.price) throw new Error("Questo oggetto non si compra.");
    const pts = Number(data.petPoints) || 0;
    if (pts < it.price) throw new Error(`Servono ${it.price} punti pet.`);
    addItems(den, [id]);
    addLog(den, { k: "item_buy", item: id, cost: it.price });
    const ledger = [{ source: "shop", label: `Bisaccia: ${it.name}`, amount: -it.price, ts: new Date().toISOString() }, ...((data.petPointsLedger || []).slice(0, 29))];
    return { patch: { petPoints: pts - it.price, petPointsLedger: ledger } };
}

// Oggetti gratis (Master, per le prove).
export function giveItems(den, data, ids) { addItems(den, ids); addLog(den, { k: "item_give", items: ids }); }

// Caramella Rara (+1 livello) o Pietra dell'Esperienza (PE).
export function applyGrowthItem(den, data, petId, id) {
    const it = PET_BAG[id];
    const p = petOf(den, petId);
    if (it?.kind === "level") {
      if ((p.level || 1) >= MAX_LEVEL) throw new Error("È già al livello massimo.");
      takeItem(den, id);
      p.level = (p.level || 1) + 1;
      p.xp = 0;
      addLog(den, { k: "item_use", item: id, pet: p.id, species: p.species, level: p.level });
      return { out: { level: p.level } };
    }
    if (it?.kind === "xp") {
      if ((p.level || 1) >= MAX_LEVEL) throw new Error("È già al livello massimo.");
      if (xpTodayOf(p) >= DAILY_XP_CAP) throw new Error(`Oggi ha già preso tutti i suoi ${DAILY_XP_CAP} PE: riprova domani.`);
      takeItem(den, id);
      const g = gainXp(p, Math.max(60, Math.round(xpToNext(p.level || 1) / 2)));
      Object.assign(p, g.pet);
      addLog(den, { k: "item_use", item: id, pet: p.id, species: p.species, level: p.level, xp: g.gained });
      return { out: { level: p.level, ups: g.ups, gained: g.gained } };
    }
    throw new Error("Oggetto non adatto.");
}

/* Evoluzione (2026-11-01): dal livello della rarità il pet cambia forma.
   I PF in più li tira il server coi dadi della rarità (EVO_HP_DICE) e
   restano sul pet (evoHp + i dadi usciti in evoRolls). */
// stone = true: Pietra dell'Evoluzione (si consuma solo se il livello non basta).
export function evolvePet(den, data, petId, stone = false) {
    const p = petOf(den, petId);
    const ev = EVOLUTIONS[p.species];
    if (!ev) throw new Error("Questo pet non ha ancora un'evoluzione.");
    if ((p.evo || 0) >= 1) throw new Error("È già evoluto.");
    const rar = PET_DEX[p.species]?.rarity;
    const need = evoLevelOf(rar);
    let usedStone = false;
    if ((p.level || 1) < need) {
      if (stone !== true) throw new Error(`Si evolve al livello ${need}.`);
      takeItem(den, EVO_STONE);
      usedStone = true;
    }
    const [n, d] = evoDiceOf(rar);
    const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * d));
    const hp = rolls.reduce((a, x) => a + x, 0);
    p.evo = 1; p.evoHp = hp; p.evoRolls = rolls; p.evoAt = p.level || 1; p.evoTs = Date.now();
    addLog(den, { k: "evolve", pet: p.id, species: p.species, level: p.level, hp, rolls, ...(usedStone ? { item: EVO_STONE } : {}) });
    return { out: { name: ev.name, rolls, dice: `${n}d${d}`, hp, usedStone } };
}

// Amuleto: il pet lo tiene per `fights` lotte. Uno solo: quello vecchio si perde.
export function giveCharm(den, data, petId, id) {
    const it = PET_BAG[id];
    if (it?.kind !== "charm") throw new Error("Non è un amuleto.");
    const p = petOf(den, petId);
    takeItem(den, id);
    p.charm = { id, left: it.fights };
}

/* Pergamena: insegna la sua mossa (di qualunque elemento) al posto di
   `forget`, che il pet dimentica: se era di un grado il grado si libera,
   se era innata finisce fra le dimenticate, se era di pergamena sparisce. */
export function teachScroll(den, data, petId, id, forget) {
    const it = PET_BAG[id];
    if (it?.kind !== "scroll") throw new Error("Non è una pergamena.");
    const p = petOf(den, petId);
    const known = knownMoves(p);
    if (known.includes(it.move)) throw new Error("La conosce già.");
    if (!known.includes(forget)) throw new Error("Scegli la mossa da dimenticare.");
    const tms = (p.tms || []).filter((m) => m !== forget);
    if (tms.length >= SCROLL_SLOTS) throw new Error(`Ha già ${SCROLL_SLOTS} mosse da pergamena: dimentica una di quelle.`);
    const before = battleMoves(p);
    if ((p.tms || []).includes(forget)) {
      // già tolta sopra
    } else if (learnedMoves(p).includes(forget)) {
      const g = Object.keys(p.learned || {}).find((k) => p.learned[k] === forget);
      const learned = { ...(p.learned || {}) };
      delete learned[g];
      p.learned = learned;
    } else {
      p.forgotten = [...(p.forgotten || []), forget];
    }
    takeItem(den, id);
    addLog(den, { k: "scroll", item: id, pet: p.id, species: p.species, forget });
    p.tms = [...tms, it.move];
    p.moveset = before.includes(forget) ? before.map((m) => (m === forget ? it.move : m)) : [...before, it.move].slice(0, MAX_MOVES);
}

// Dopo ogni lotta gli amuleti dei pet in squadra perdono una carica.
function wearCharms(den, teamIds) {
  den.pets.forEach((p) => {
    if (!teamIds.includes(p.id) || !p.charm) return;
    const left = (p.charm.left || 1) - 1;
    if (left > 0) p.charm = { ...p.charm, left };
    else delete p.charm;
  });
}

// Ritira i pet arrivati dal Mercato: oltre il limite diventano punti.
export function claimGifts(den, data) {
  const gifts = Array.isArray(data.petGifts) ? data.petGifts : [];
  if (!gifts.length) return { out: null };
  const got = [], refunded = [], eggs = [];
  let pts = Number(data.petPoints) || 0;
  gifts.forEach((g) => {
    if (g.item && PET_BAG[g.item]) {
      addItems(den, [g.item]);
      addLog(den, { k: "gift", item: g.item, from: g.from || "mercato" });
      eggs.push(`item:${g.item}`);
      return;
    }
    if (g.egg && EGGS[g.egg]) {
      den.eggs.push(makeEgg(g.egg, g.from || "mercato"));
      addLog(den, { k: "gift", egg: g.egg, from: g.from || "mercato" });
      eggs.push(g.egg);
      return;
    }
    if (!PET_DEX[g.species]) return;
    if (countOf(den, g.species) >= MAX_PER_SPECIES) { pts += refundOf(g.species); refunded.push(g.species); addLog(den, { k: "gift", species: g.species, from: g.from || "mercato", refunded: refundOf(g.species) }); return; }
    addLog(den, { k: "gift", species: g.species, from: g.from || "mercato" });
    const p = makePet(g.species, g.from || "mercato");
    den.pets.push(p);
    if (den.team.length < MAX_TEAM) den.team.push(p.id);
    got.push(g.species);
  });
  return { patch: { petGifts: [], petPoints: pts }, out: { got, refunded, eggs } };
}

/* Esito di un piano della torre. Vittoria = PE alla squadra, punti pet
   e piano successivo; sconfitta = PE minimi (LOSS_XP) e si ritenta lo stesso piano. Si scrive
   solo se il piano è ancora quello in corso (niente doppie vittorie). */
function recordTowerResult(den, data, floor, won, teamIds) {
    if (den.tower.floor !== floor) throw new Error("Questo piano è già stato registrato.");
    const xp = won ? towerXp(floor) : towerLossXp(floor);
    const ups = [];
    const gained = {};
    den.pets = den.pets.map((p) => {
      if (!teamIds.includes(p.id)) return p;
      const g = gainXp(p, p.id === den.mascot ? Math.round(xp * (1 + MASCOT_XP_BONUS)) : xp);
      gained[p.id] = g.gained;
      if (g.ups) ups.push({ id: p.id, species: p.species, level: g.pet.level });
      return g.pet;
    });
    const capped = Object.values(gained).some((v) => v < xp);
    wearCharms(den, teamIds);
    const team = teamIds.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean).map((p) => `${p.species}:${p.level}`);
    if (!won) {
      const att = den.tower.att?.floor === floor ? den.tower.att.n || 0 : 0;
      den.tower = { ...den.tower, losses: (den.tower.losses || 0) + 1, att: { floor, n: att + 1 } };
      addLog(den, { k: "tower", f: floor, won: false, xp, team, capped });
      return { out: { won: false, xp, pts: 0, ups, drops: [], att: att + 1, gained, capped } };
    }
    // punti e premi solo la prima volta in settimana (dopo un reset si risale per i PE)
    const first = floor > (den.tower.best || 0);
    const pts = first ? towerPoints(floor) : 0;
    const drops = first ? towerDrops(floor) : [];
    addItems(den, drops);
    den.tower = { ...den.tower, att: null, floor: floor + 1, best: Math.max(den.tower.best || 0, floor), wins: (den.tower.wins || 0) + 1 };
    addLog(den, { k: "tower", f: floor, won: true, xp, pts, drops, team, again: !first, capped });
    return { patch: pts ? { petPoints: (Number(data.petPoints) || 0) + pts } : {}, out: { won: true, xp, pts, ups, drops, again: !first, gained, capped } };
}

/* Esito di una sfida fra giocatori, ritirato da ciascuno per sé (una volta
   sola per sfida: l'id finisce in pvp.claimed). PE alla squadra (vincitore
   pieni, sconfitto LOSS_XP, chi abbandona niente), +PVP_POINTS punti pet per le prime
   PVP_DAILY vittorie del giorno, e ogni tanto un amuleto. Le sfide contro
   sé stessi (Master, per le prove) non danno premi. */
export const PVP_POINTS = 3;
export const PVP_DAILY = 3;
// PE delle sfide (2026-10-31, scelta del Master): fissi e bassi, solo per le
// prime PVP_XP_FIGHTS sfide del giorno; chi abbandona non prende niente.
export const PVP_WIN_XP = 10;
export const PVP_LOSS_XP = 3;
export const PVP_XP_FIGHTS = 5;
export function recordPvpResult(den, data, match, side) {
  if (den.pvp.claimed.includes(match.id)) return { out: { already: true } };
  den.pvp.claimed = [match.id, ...den.pvp.claimed].slice(0, 40);
  const won = match.winner === side;
  const self = match.a === match.b;
  const teamIds = (match.teams?.[side] || []).map((p) => p.id);
  spendBattleItems(den, match.used?.[side], teamIds, match.teams?.[side]);
  wearCharms(den, teamIds);
  if (self) return { out: { won, self: true, xp: 0, pts: 0, ups: [], drops: [] } };
  const day = new Date().toISOString().slice(0, 10);
  if (den.pvp.day !== day) { den.pvp.day = day; den.pvp.rewarded = 0; den.pvp.fights = 0; }
  const quit = !won && match.forfeit === side;
  const capped = (den.pvp.fights || 0) >= PVP_XP_FIGHTS;
  const xp = capped || quit ? 0 : won ? PVP_WIN_XP : PVP_LOSS_XP;
  if (!capped && !quit) den.pvp.fights = (den.pvp.fights || 0) + 1;
  const ups = [];
  den.pets = den.pets.map((p) => {
    if (!teamIds.includes(p.id) || !xp) return p;
    const g = gainXp(p, xp);
    if (g.ups) ups.push({ id: p.id, species: p.species, level: g.pet.level });
    return g.pet;
  });
  if (won) den.pvp.wins += 1; else den.pvp.losses += 1;
  let pts = 0;
  const drops = [];
  if (won && den.pvp.rewarded < PVP_DAILY) {
    den.pvp.rewarded += 1;
    pts = PVP_POINTS;
    if (Math.random() < 0.2) drops.push(CHARMS[Math.floor(Math.random() * CHARMS.length)]);
    addItems(den, drops);
  }
  addLog(den, { k: "pvp", won, xp, pts, drops, quit, capped, vs: side === "p" ? match.bName : match.aName });
  return { patch: pts ? { petPoints: (Number(data.petPoints) || 0) + pts } : {}, out: { won, xp, pts, ups, drops, capped, quit } };
}

/* ── TORRE VERIFICATA DAL SERVER (2026-10-31) ─────────────────────
   La lotta si gioca sul telefono, ma coi dadi a seme fisso: il seme
   dipende da giocatore, piano e tentativo (cambia SOLO dopo una
   sconfitta registrata, quindi ritirarsi e riprovare non rifà i dadi).
   A fine lotta il sito manda le azioni scelte; il server rigioca tutto
   con lo stesso seme e decide lui se è vittoria o sconfitta. */
// Torre della settimana `week`: se è di un'altra settimana riparte da zero
// (piano 1, record della settimana 0; il record di sempre resta in bestEver).
export function towerFresh(tower, week = towerWeek()) {
  // le torri di prima della torre settimanale contano come settimana del 26/10/2026 (si azzerano la sera del 1/11)
  const t = { ...(tower || {}), week: tower?.week || "2026-10-26" };
  if (t.week === week) return { floor: 1, best: 0, wins: 0, ...t };
  return {
    week, floor: 1, best: 0, wins: 0, losses: 0, att: null, resets: 0, resetDay: t.resetDay || null,
    bestEver: Math.max(t.bestEver || 0, t.best || 0),
  };
}
const romeDay = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
export const canResetTower = (tower, now = Date.now()) => (tower.floor || 1) > 1 && tower.resetDay !== romeDay(now);
export function towerSeed(uid, den, floor, week = towerWeek()) {
  const t = towerFresh(den.tower, week);
  const att = t.att?.floor === floor ? t.att.n || 0 : 0;
  let h = 2166136261;
  for (const ch of `${uid}|${week}|${t.resets || 0}|${floor}|${att}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/* Reset della torre a mano (2026-11-01): una volta al giorno si riparte dal
   piano 1 (seme nuovo). Il record della settimana resta; i piani già fatti in
   settimana danno solo PE. */
export function resetTower(den) {
  den.tower = towerFresh(den.tower);
  if ((den.tower.floor || 1) <= 1) throw new Error("Sei già al piano 1.");
  const today = romeDay();
  if (den.tower.resetDay === today) throw new Error("Hai già ricominciato la torre oggi: riprova domani.");
  addLog(den, { k: "tower_reset", from: den.tower.floor });
  den.tower = { ...den.tower, floor: 1, att: null, resets: (den.tower.resets || 0) + 1, resetDay: today };
  return { out: { ok: true } };
}
/* Oggetti dati in lotta: si tolgono dalla bisaccia; gli amuleti restano al
   pet a cui sono stati dati (con tutte le lotte, questa compresa). `team` =
   i pet nell'ordine della lotta (per sapere a chi è andato l'amuleto). */
function spendBattleItems(den, used, teamIds, team) {
  if (!used) return;
  Object.entries(used).forEach(([id, list]) => {
    (Array.isArray(list) ? list : []).forEach((idx) => {
      if (!(den.items[id] > 0) || !usableInBattle(id)) return;
      den.items[id] -= 1;
      if (PET_BAG[id].kind === "charm") {
        const pid = (team?.[idx]?.id) || teamIds[idx];
        const p = den.pets.find((x) => x.id === pid);
        if (p) p.charm = { id, left: PET_BAG[id].fights };
      }
    });
  });
  addLog(den, { k: "battle_items", items: Object.keys(used) });
}
export const towerTurnSeed = (seed, i) => mix32(seed, i + 1, 0x70e7);
/* Seme della lotta (2026-11-04): prima era fisso (giocatore + piano +
   tentativo) e cambiava SOLO dopo una sconfitta: ritirandosi i dadi tornavano
   identici e c'era chi passava i piani imparandoli. Ora ogni volta che si
   entra in un piano il SERVER tira un seme casuale (crypto) e lo salva in
   tower.run; a fine lotta rigioca con quello e lo consuma. */
function randomSeed() {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
export function towerBegin(den, data, floor) {
  den.tower = towerFresh(den.tower);
  if (den.tower.floor !== floor) throw new Error("Questo piano non è quello da fare: ricarica il Rifugio.");
  const seed = randomSeed();
  den.tower = { ...den.tower, run: { floor, seed, at: new Date().toISOString() } };
  return { out: { seed } };
}
export function towerStart(den, floor, teamIds, seed, week = towerWeek()) {
  const pets = teamIds.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean);
  if (!pets.length || pets.length !== teamIds.length || pets.length > MAX_TEAM) throw new Error("Squadra non valida.");
  const plan = towerFloor(floor, week);
  return withSeed(seed, () => newBattle(pets, plan.team, { enemyBoost: plan.enemyBoost, aiLevel: plan.aiLevel }));
}
// L'azione del giocatore è lecita? (mosse che il pet ha davvero, con usi; cambi verso pet vivi)
export function validAction(b, a, bag = {}) {
  const side = b.sides.p;
  const f = side.team[side.active];
  if (a?.kind === "item") {
    if (b.needSwitch && b.needSwitch.includes("p")) return false;
    const it = PET_BAG[a.item];
    const t = side.team[a.index];
    if (!it || !usableInBattle(a.item) || !(bag[a.item] > 0) || !Number.isInteger(a.index) || !t) return false;
    if (it.use?.revive) return t.hp <= 0;
    if (t.hp <= 0) return false;
    if (it.kind === "charm") return true; // sostituisce quello che ha
    return true;
  }
  if (a?.kind === "switch") {
    const t = side.team[a.index];
    return Number.isInteger(a.index) && !!t && t.hp > 0 && a.index !== side.active;
  }
  if (b.needSwitch && b.needSwitch.includes("p")) return false;
  if (a?.kind !== "move") return false;
  // "zampata" è ANCHE una mossa vera di grado I (Zampata, usi infiniti): se il pet la
  // conosce vale come le altre. Solo se NON la conosce è la "Zampata disperata",
  // permessa quando tutte le mosse hanno finito gli usi. (Bug 2026-11-02: Palar non
  // passava la torre perché usava la sua Zampata e il server la rifiutava.)
  if (Object.prototype.hasOwnProperty.call(f.pp, a.move)) return f.pp[a.move] !== 0;
  if (a.move === "zampata") return desperateOk(f, b.sides.e.team[b.sides.e.active]);
  return false;
}
export function replayTower(den, uid, floor, teamIds, actions, week = towerWeek()) {
  if (!Array.isArray(actions) || actions.length > 400) throw new Error("Lotta non valida.");
  const run = towerFresh(den.tower, week).run;
  if (!run || run.floor !== floor || !Number.isFinite(run.seed)) throw new Error("Lotta non avviata dal server: ricarica la pagina e riprova il piano.");
  const seed = run.seed;
  let b = towerStart(den, floor, teamIds, seed, week);
  const bag = { ...den.items };
  const used = {};
  actions.forEach((a, i) => {
    if (b.over) throw new Error("Lotta non valida (azioni dopo la fine).");
    if (!validAction(b, a, bag)) throw new Error("Lotta non valida (mossa non permessa).");
    if (a.kind === "item") { bag[a.item] -= 1; (used[a.item] ||= []).push(a.index); }
    b = withSeed(towerTurnSeed(seed, i), () => playTurn(b, a).battle);
  });
  if (!b.over) throw new Error("La lotta non è finita.");
  return { over: b.over, used };
}
export function towerFinish(den, data, floor, teamIds, actions, ctx) {
  const week = towerWeek();
  den.tower = towerFresh(den.tower, week);
  if (den.tower.floor !== floor) throw new Error(floor > 1 && den.tower.floor === 1 ? "La torre è ricominciata (nuova settimana o reset): riparti dal piano 1." : "Questo piano è già stato registrato.");
  const { over, used } = replayTower(den, ctx.uid, floor, teamIds, actions, week);
  den.tower = { ...den.tower, run: null }; // il seme si usa una volta sola
  spendBattleItems(den, used, teamIds, null);
  return recordTowerResult(den, data, floor, over === "p", teamIds);
}

/* ── TORNEO DEI PET (2026-11-02): PE del torneo ─────────────────────
   Ognuno li ritira per sé (in automatico all'apertura del Rifugio) una
   volta per torneo: il server legge il torneo vero (pet_meta/tournament,
   concluso) e l'iscrizione vera di chi chiama. A tutti i pet iscritti
   `prizes.joinXp`, ai pet del campione anche `prizes.winXp`. Fuori dal
   tetto giornaliero dei PE: è un premio del Master. */
export function claimTournamentXp(den, data, t, entry) {
  if (!t || t.status !== "done" || !entry || entry.tid !== t.tid) throw new Error("Nessun premio del torneo da ritirare.");
  if (den.tourney.claimed.includes(t.tid)) return { out: { already: true } };
  den.tourney.claimed = [t.tid, ...den.tourney.claimed].slice(0, 30);
  const won = t.winner === entry.uid;
  const joinXp = Math.max(0, Math.min(5000, Math.round(Number(t.prizes?.joinXp) || 0)));
  const winXp = won ? Math.max(0, Math.min(20000, Math.round(Number(t.prizes?.winXp) || 0))) : 0;
  const xp = joinXp + winXp;
  const ids = (entry.team || []).map((p) => p.id);
  const ups = [];
  let pets = 0;
  if (xp > 0) {
    den.pets = den.pets.map((p) => {
      if (!ids.includes(p.id)) return p;
      pets += 1;
      const n = addXp(p, xp);
      const { ups: up, ...rest } = n;
      if (up) ups.push({ id: p.id, species: p.species, level: rest.level });
      return rest;
    });
  }
  if (won) den.tourney.wins = (den.tourney.wins || 0) + 1;
  addLog(den, { k: "tourney", name: t.name, won, xp, pets });
  return { out: { won, xp, joinXp, winXp, pets, ups, name: t.name } };
}

/* Operazioni che il server accetta (petDo). master = solo il Master. */
export const OPS = {
  chooseStarter: { run: chooseStarter },
  givePet: { run: givePet, master: true },
  buyEgg: { run: buyEgg, master: (args) => !!args[1]?.free },
  hatchEgg: { run: hatchEgg },
  setMascot: { run: setMascot },
  releasePet: { run: releasePet },
  setTeam: { run: setTeam },
  renamePet: { run: renamePet },
  learnMove: { run: learnMove },
  setMoveset: { run: setMoveset },
  buyItem: { run: buyItem },
  giveItems: { run: giveItems, master: true },
  applyGrowthItem: { run: applyGrowthItem },
  evolvePet: { run: evolvePet },
  giveCharm: { run: giveCharm },
  teachScroll: { run: teachScroll },
  claimGifts: { run: claimGifts },
  towerBegin: { run: towerBegin },
  towerFinish: { run: towerFinish },
  resetTower: { run: resetTower },
  recordPvpResult: { run: recordPvpResult, match: true },
  claimTournamentXp: { run: claimTournamentXp, tourney: true },
};
