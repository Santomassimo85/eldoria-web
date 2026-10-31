/* ============================================================
   PET DEN (2026-10-31) — scritture del nuovo sistema pet.
   Stato sul personaggio: characters/{uid}.petDen = {
     starter,               specie scelta al primo accesso (una volta sola)
     pets: [{id, species, level, xp, nick, from, at}],
     team: [id, id, id],    massimo 3, in ordine (il primo entra in campo)
     tower: {floor, best, wins},   floor = prossimo piano da combattere
     eggs: [{id, egg, from, at}],  il NIDO: uova da schiudere
     mascot: id del pet mascotte (+5% PE, si vede accanto all'avatar)
     items: {id: quantità}  la Bisaccia del Domatore (data/petBag.js)
     pvp: {wins, losses, day, rewarded, claimed[]}  sfide fra giocatori
   }
   Sul pet: learned {grado: mossa}, moveset [4], tms [pergamene],
   forgotten [innate dimenticate], charm {id, left} (amuleto tenuto).
   + characters.petGifts = [{species | egg, from, itemId, at}] scritto dal
   Mercato Nero alla consegna dell'asta: il Rifugio li ritira (i pet nella
   collezione, le uova nel nido).
   Il portafoglio resta characters.petPoints (utils/pet.js).
   Pixel art: pet_dex/{species} = {image (PNG trasparente), look}.
   Tutto in transazione: due schede aperte non comprano due volte.
   ============================================================ */

import { deleteField, doc, runTransaction, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { PET_DEX, STARTERS, MAX_PER_SPECIES, MAX_TEAM, MAX_EGGS, MAX_MOVES, MAX_LEVEL, EGGS, refundOf, rollEgg, gradeOfLevel, learnPool } from "../data/petDex";
import { addXp, towerXp, towerLossXp, towerPoints, battleMoves, knownMoves, learnedMoves, xpToNext } from "../data/petEngine";
import { PET_BAG, SCROLL_SLOTS, CHARMS, towerDrops } from "../data/petBag";

const newId = () => `pet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const charRef = (uid) => doc(db, "characters", uid);

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
  };
};
export const countOf = (den, species) => den.pets.filter((p) => p.species === species).length;

async function mutate(uid, fn) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(charRef(uid));
    if (!snap.exists()) throw new Error("Scheda del personaggio non trovata.");
    const data = snap.data();
    const den = denOf(data);
    const res = fn(den, data) || {};
    tx.update(charRef(uid), { petDen: den, ...(res.patch || {}) });
    return res.out;
  });
}

const makePet = (species, from) => ({ id: newId(), species, level: 1, xp: 0, nick: "", from, at: new Date().toISOString() });

export function chooseStarter(uid, species) {
  return mutate(uid, (den) => {
    if (den.starter || den.pets.length) throw new Error("Hai già scelto il tuo primo compagno.");
    if (!STARTERS.includes(species)) throw new Error("Non è un pet iniziale.");
    const p = makePet(species, "starter");
    den.starter = species;
    den.pets.push(p);
    den.team = [p.id];
  });
}

// Pet dato a mano (Master, per le prove): niente punti.
export function givePet(uid, species) {
  return mutate(uid, (den) => {
    if (!PET_DEX[species]) throw new Error("Specie sconosciuta.");
    if (countOf(den, species) >= MAX_PER_SPECIES) throw new Error(`Hai già ${MAX_PER_SPECIES} ${PET_DEX[species].name}.`);
    const p = makePet(species, "master");
    den.pets.push(p);
    if (den.team.length < MAX_TEAM) den.team.push(p.id);
  });
}

const makeEgg = (egg, from) => ({ id: newId().replace("pet_", "egg_"), egg, from, at: new Date().toISOString() });

export function buyEgg(uid, eggKey, { free = false } = {}) {
  return mutate(uid, (den, data) => {
    const egg = EGGS[eggKey];
    if (!egg) throw new Error("Uovo sconosciuto.");
    if (den.eggs.length >= MAX_EGGS) throw new Error(`Il nido è pieno (${MAX_EGGS} uova): schiudine qualcuna.`);
    const cost = free ? 0 : egg.cost;
    const pts = Number(data.petPoints) || 0;
    if (pts < cost) throw new Error(`Ti mancano ${cost - pts} punti pet.`);
    den.eggs.push(makeEgg(eggKey, free ? "master" : "bottega"));
    return { patch: cost ? { petPoints: pts - cost } : {} };
  });
}

/* Schiude un uovo: il tiro avviene DENTRO la transazione, quindi l'esito
   salvato è quello mostrato. Doppione oltre il limite = punti pet. */
export function hatchEgg(uid, eggId) {
  return mutate(uid, (den, data) => {
    if (!den.starter) throw new Error("Prima scegli il tuo pet iniziale.");
    const egg = den.eggs.find((e) => e.id === eggId);
    if (!egg) throw new Error("Quest'uovo non c'è più.");
    den.eggs = den.eggs.filter((e) => e.id !== eggId);
    const { species, rarity } = rollEgg(egg.egg);
    if (countOf(den, species) >= MAX_PER_SPECIES) {
      const pts = refundOf(species);
      return { patch: { petPoints: (Number(data.petPoints) || 0) + pts }, out: { species, rarity, refunded: pts } };
    }
    const p = makePet(species, `uovo:${egg.egg}`);
    den.pets.push(p);
    const joined = den.team.length < MAX_TEAM;
    if (joined) den.team.push(p.id);
    return { out: { species, rarity, petId: p.id, joined } };
  });
}

export const MASCOT_XP_BONUS = 0.05;

// Mascotte: un pet a scelta (o nessuno con petId null).
export function setMascot(uid, petId) {
  return mutate(uid, (den) => {
    if (petId && !den.pets.some((p) => p.id === petId)) throw new Error("Pet non trovato.");
    den.mascot = petId || null;
  });
}

export function releasePet(uid, petId) {
  return mutate(uid, (den) => {
    if (den.pets.length <= 1) throw new Error("Non puoi restare senza pet.");
    if (den.mascot === petId) den.mascot = null;
    den.pets = den.pets.filter((p) => p.id !== petId);
    den.team = den.team.filter((id) => id !== petId);
    if (!den.team.length) den.team = [den.pets[0].id];
  });
}

export function setTeam(uid, team) {
  return mutate(uid, (den) => {
    const ids = [...new Set(team)].filter((id) => den.pets.some((p) => p.id === id)).slice(0, MAX_TEAM);
    if (!ids.length) throw new Error("La squadra deve avere almeno un pet.");
    den.team = ids;
  });
}

export function renamePet(uid, petId, nick) {
  return mutate(uid, (den) => {
    const p = den.pets.find((x) => x.id === petId);
    if (p) p.nick = String(nick || "").trim().slice(0, 18);
  });
}

/* Gradi delle mosse: impara (o cambia) la mossa del grado `grade`.
   La nuova mossa entra subito fra quelle di lotta: al posto della
   vecchia dello stesso grado, oppure in un posto libero. */
export function learnMove(uid, petId, grade, moveId) {
  return mutate(uid, (den) => {
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
  });
}

export function setMoveset(uid, petId, moves) {
  return mutate(uid, (den) => {
    const p = den.pets.find((x) => x.id === petId);
    if (!p) throw new Error("Pet non trovato.");
    const known = knownMoves(p);
    const set = moves.filter((m, i, a) => known.includes(m) && a.indexOf(m) === i).slice(0, MAX_MOVES);
    if (!set.length) throw new Error("Serve almeno una mossa.");
    p.moveset = set;
  });
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

export function buyItem(uid, id) {
  return mutate(uid, (den, data) => {
    const it = PET_BAG[id];
    if (!it || !it.price) throw new Error("Questo oggetto non si compra.");
    const pts = Number(data.petPoints) || 0;
    if (pts < it.price) throw new Error(`Servono ${it.price} punti pet.`);
    addItems(den, [id]);
    const ledger = [{ source: "shop", label: `Bisaccia: ${it.name}`, amount: -it.price, ts: new Date().toISOString() }, ...((data.petPointsLedger || []).slice(0, 29))];
    return { patch: { petPoints: pts - it.price, petPointsLedger: ledger } };
  });
}

// Oggetti gratis (Master, per le prove).
export function giveItems(uid, ids) {
  return mutate(uid, (den) => { addItems(den, ids); });
}

// Caramella Rara (+1 livello) o Pietra dell'Esperienza (PE).
export function applyGrowthItem(uid, petId, id) {
  return mutate(uid, (den) => {
    const it = PET_BAG[id];
    const p = petOf(den, petId);
    if (it?.kind === "level") {
      if ((p.level || 1) >= MAX_LEVEL) throw new Error("È già al livello massimo.");
      takeItem(den, id);
      p.level = (p.level || 1) + 1;
      p.xp = 0;
      return { out: { level: p.level } };
    }
    if (it?.kind === "xp") {
      if ((p.level || 1) >= MAX_LEVEL) throw new Error("È già al livello massimo.");
      takeItem(den, id);
      const n = addXp(p, Math.max(60, Math.round(xpToNext(p.level || 1) / 2)));
      p.level = n.level; p.xp = n.xp;
      return { out: { level: p.level, ups: n.ups } };
    }
    throw new Error("Oggetto non adatto.");
  });
}

// Amuleto: il pet lo tiene per `fights` lotte. Uno solo: quello vecchio si perde.
export function giveCharm(uid, petId, id) {
  return mutate(uid, (den) => {
    const it = PET_BAG[id];
    if (it?.kind !== "charm") throw new Error("Non è un amuleto.");
    const p = petOf(den, petId);
    takeItem(den, id);
    p.charm = { id, left: it.fights };
  });
}

/* Pergamena: insegna la sua mossa (di qualunque elemento) al posto di
   `forget`, che il pet dimentica: se era di un grado il grado si libera,
   se era innata finisce fra le dimenticate, se era di pergamena sparisce. */
export function teachScroll(uid, petId, id, forget) {
  return mutate(uid, (den) => {
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
    p.tms = [...tms, it.move];
    p.moveset = before.includes(forget) ? before.map((m) => (m === forget ? it.move : m)) : [...before, it.move].slice(0, MAX_MOVES);
  });
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
export function claimGifts(uid) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(charRef(uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    const gifts = Array.isArray(data.petGifts) ? data.petGifts : [];
    if (!gifts.length) return null;
    const den = denOf(data);
    const got = [], refunded = [], eggs = [];
    let pts = Number(data.petPoints) || 0;
    gifts.forEach((g) => {
      if (g.item && PET_BAG[g.item]) {
        addItems(den, [g.item]);
        eggs.push(`item:${g.item}`);
        return;
      }
      if (g.egg && EGGS[g.egg]) {
        den.eggs.push(makeEgg(g.egg, g.from || "mercato"));
        eggs.push(g.egg);
        return;
      }
      if (!PET_DEX[g.species]) return;
      if (countOf(den, g.species) >= MAX_PER_SPECIES) { pts += refundOf(g.species); refunded.push(g.species); return; }
      const p = makePet(g.species, g.from || "mercato");
      den.pets.push(p);
      if (den.team.length < MAX_TEAM) den.team.push(p.id);
      got.push(g.species);
    });
    tx.update(charRef(uid), { petDen: den, petGifts: [], petPoints: pts });
    return { got, refunded, eggs };
  });
}

/* Esito di un piano della torre. Vittoria = PE alla squadra, punti pet
   e piano successivo; sconfitta = un terzo dei PE e si ritenta lo stesso piano. Si scrive
   solo se il piano è ancora quello in corso (niente doppie vittorie). */
export function recordTowerResult(uid, floor, won, teamIds) {
  return mutate(uid, (den, data) => {
    if (den.tower.floor !== floor) throw new Error("Questo piano è già stato registrato.");
    const xp = won ? towerXp(floor) : towerLossXp(floor);
    const ups = [];
    den.pets = den.pets.map((p) => {
      if (!teamIds.includes(p.id)) return p;
      const n = addXp(p, p.id === den.mascot ? Math.round(xp * (1 + MASCOT_XP_BONUS)) : xp);
      if (n.ups) ups.push({ id: p.id, species: p.species, level: n.level });
      const { ups: _u, ...rest } = n;
      return rest;
    });
    wearCharms(den, teamIds);
    if (!won) return { out: { won: false, xp, pts: 0, ups, drops: [] } };
    const pts = towerPoints(floor);
    const drops = towerDrops(floor);
    addItems(den, drops);
    den.tower = { floor: floor + 1, best: Math.max(den.tower.best || 0, floor), wins: (den.tower.wins || 0) + 1 };
    return { patch: { petPoints: (Number(data.petPoints) || 0) + pts }, out: { won: true, xp, pts, ups, drops } };
  });
}

/* Esito di una sfida fra giocatori, ritirato da ciascuno per sé (una volta
   sola per sfida: l'id finisce in pvp.claimed). PE alla squadra (vincitore
   pieni, sconfitto un terzo), +PVP_POINTS punti pet per le prime
   PVP_DAILY vittorie del giorno, e ogni tanto un amuleto. Le sfide contro
   sé stessi (Master, per le prove) non danno premi. */
export const PVP_POINTS = 3;
export const PVP_DAILY = 3;
export const pvpXp = (foeAvgLevel) => 20 + Math.round(foeAvgLevel * 4);
export function recordPvpResult(uid, match, side) {
  return mutate(uid, (den, data) => {
    if (den.pvp.claimed.includes(match.id)) return { out: { already: true } };
    den.pvp.claimed = [match.id, ...den.pvp.claimed].slice(0, 40);
    const won = match.winner === side;
    const self = match.a === match.b;
    const teamIds = (match.teams?.[side] || []).map((p) => p.id);
    wearCharms(den, teamIds);
    if (self) return { out: { won, self: true, xp: 0, pts: 0, ups: [], drops: [] } };
    const foe = match.teams?.[side === "p" ? "e" : "p"] || [];
    const avg = foe.length ? foe.reduce((a, p) => a + (p.level || 1), 0) / foe.length : 1;
    const xp = won ? pvpXp(avg) : Math.floor(pvpXp(avg) / 3);
    const ups = [];
    den.pets = den.pets.map((p) => {
      if (!teamIds.includes(p.id)) return p;
      const n = addXp(p, p.id === den.mascot ? Math.round(xp * (1 + MASCOT_XP_BONUS)) : xp);
      if (n.ups) ups.push({ id: p.id, species: p.species, level: n.level });
      const { ups: _u, ...rest } = n;
      return rest;
    });
    const day = new Date().toISOString().slice(0, 10);
    if (den.pvp.day !== day) { den.pvp.day = day; den.pvp.rewarded = 0; }
    if (won) den.pvp.wins += 1; else den.pvp.losses += 1;
    let pts = 0;
    const drops = [];
    if (won && den.pvp.rewarded < PVP_DAILY) {
      den.pvp.rewarded += 1;
      pts = PVP_POINTS;
      if (Math.random() < 0.2) drops.push(CHARMS[Math.floor(Math.random() * CHARMS.length)]);
      addItems(den, drops);
    }
    return { patch: pts ? { petPoints: (Number(data.petPoints) || 0) + pts } : {}, out: { won, xp, pts, ups, drops } };
  });
}

/* Reset del Master (2026-10-31): per i personaggi scelti azzera i punti
   pet (e il loro registro) e/o i pet (Rifugio intero: collezione,
   squadra, nido, torre, mascotte, regali in attesa). */
export async function resetPetPlayers(uids, { points = false, pets = false } = {}) {
  if (!uids.length || (!points && !pets)) return 0;
  for (let i = 0; i < uids.length; i += 400) {
    const batch = writeBatch(db);
    uids.slice(i, i + 400).forEach((uid) => {
      const patch = {};
      if (points) Object.assign(patch, { petPoints: 0, petPointsLedger: [], petPointsDaily: {}, petPointsSeen: {} });
      if (pets) Object.assign(patch, { petDen: deleteField(), petGifts: deleteField() });
      batch.update(charRef(uid), patch);
    });
    await batch.commit();
  }
  return uids.length;
}

export const savePetArt = (species, image, look) =>
  setDoc(doc(db, "pet_dex", species), { image, look: look || PET_DEX[species]?.look || "", updatedAt: serverTimestamp() }, { merge: true });
export const savePetLook = (species, look) =>
  setDoc(doc(db, "pet_dex", species), { look, updatedAt: serverTimestamp() }, { merge: true });

/* Prompt per Gemini: creatura pucciosa in pixel art su magenta (lo sfondo
   si toglie poi col chroma key di utils/aiSprite.js). Il pet è rivolto a
   DESTRA: in lotta il nostro sta a sinistra, quello avversario si specchia. */
export function petArtPrompt(species, look) {
  const sp = PET_DEX[species];
  return `Pixel art sprite of a single cute baby fantasy creature for a turn-based monster-collecting battle game (like the creature sprites of classic handheld monster-battle RPGs), inspired by Dungeons & Dragons.
Creature: ${sp?.name || species} — ${look || sp?.look || ""}.
Element: ${sp?.type || "neutral"} (use a colour palette that suggests it).
Style: adorable, chubby, "pucci" chibi proportions with a big head and big expressive shiny eyes, friendly and cuddly but still recognisable as the D&D monster. Crisp 32-bit-era pixel art, limited rich palette, clean dark outlines, soft pixel shading, NO anti-aliasing, NO blur.
Pose: full body, standing in an idle stance, three-quarter view facing toward the RIGHT edge of the image, centered, filling about 75% of the canvas.
CRITICAL: render the creature ALONE and centered on a SOLID UNIFORM background of pure magenta (#FF00FF, RGB 255,0,255). The background MUST be one flat magenta color — no gradient, no ground shadow, no scenery, no props. No text, no frame, no border.`;
}
