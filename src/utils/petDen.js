/* ============================================================
   PET DEN (2026-10-31) — il sito chiede, il SERVER scrive.
   Tutte le regole stanno in data/petOps.js; ogni operazione qui sotto è
   una chiamata alla callable `petDo` ({op, args}) che le esegue in
   transazione col personaggio di chi chiama. Le regole di Firestore non
   lasciano scrivere petDen / petPoints / petGifts dal browser (solo il
   Master: reset dei giocatori e Mercato Nero).
   Stato sul personaggio: characters/{uid}.petDen = {
     starter, pets: [{id, species, level, xp, nick, from, at, ...}],
     team: [id ×3], tower: {floor, best, wins, losses, att},
     eggs: [{id, egg, from, at}], mascot, items: {id: n},
     pvp: {wins, losses, day, rewarded, fights, claimed[]}, log: [...]
   }
   Pixel art: pet_dex/{species} = {image, look} (scritta dal Master).
   ============================================================ */

import { deleteField, doc, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { PET_DEX } from "../data/petDex";
export { denOf, countOf, MASCOT_XP_BONUS, PVP_POINTS, PVP_DAILY, PVP_WIN_XP, PVP_LOSS_XP, PVP_XP_FIGHTS, LOSS_XP, towerSeed, towerTurnSeed, towerStart, towerFresh, canResetTower } from "../data/petOps";

const charRef = (uid) => doc(db, "characters", uid);
let callable = null;
async function petDo(op, args) {
  callable = callable || httpsCallable(functions, "petDo");
  try {
    const r = await callable({ op, args });
    return r.data?.out ?? null;
  } catch (e) {
    throw new Error(e?.message || "Il Rifugio non risponde, riprova.");
  }
}
// La firma resta quella di prima (uid, ...): l'uid lo prende il server dal login.
const op = (name) => (_uid, ...args) => petDo(name, args);
export const chooseStarter = op("chooseStarter");
export const givePet = op("givePet");
export const buyEgg = op("buyEgg");
export const hatchEgg = op("hatchEgg");
export const setMascot = op("setMascot");
export const releasePet = op("releasePet");
export const setTeam = op("setTeam");
export const renamePet = op("renamePet");
export const learnMove = op("learnMove");
export const setMoveset = op("setMoveset");
export const buyItem = op("buyItem");
export const giveItems = op("giveItems");
export const applyGrowthItem = op("applyGrowthItem");
export const giveCharm = op("giveCharm");
export const teachScroll = op("teachScroll");
export const claimGifts = op("claimGifts");
// Torre: le azioni della lotta, il server la rigioca e decide l'esito.
export const towerFinish = op("towerFinish");
// Ricomincia la torre dal piano 1 (una volta al giorno).
export const resetTower = op("resetTower");
// Sfide: si manda solo l'id, il server legge la sfida.
export const recordPvpResult = (_uid, match, side) => petDo("recordPvpResult", [match.id, side]);

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
