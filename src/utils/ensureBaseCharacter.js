// src/utils/ensureBaseCharacter.js
//
// Se un player fa login SENZA un PG associato (doc characters/{uid} assente, o
// presente solo per la presenza online ma senza "name"), gli assegniamo una
// volta sola un GUERRIERO base di livello 4 — così può usare scheda, Arena e
// Boss Fight da subito. Se in futuro arriva il PG vero dalla macro Foundry, lo
// sovrascrive (qui marchiamo il PG base con autoCreated:true).
//
// Lo schema rispecchia i lettori dell'app (SchedaPG / Party / Arena): stats con
// caratteristiche nel formato ricco {score, mod, save}, armi come voci di
// "actions" con category "Armi", classLevels per l'Arena.

import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// Master e co-master non sono "player": non gli assegniamo mai un PG base.
const NO_PG_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];

const ab = (score, mod, save) => ({ score, mod, save });

// PG base: Guerriero Lv4, +2 competenza, 2 armi (mischia + distanza), no magie.
export function baseWarriorCharacter() {
  return {
    name: "Recluta",
    class: "Guerriero",
    subclass: "",
    level: 4,
    race: "Umano",
    background: "Soldato",
    image: "",
    classLevels: { fighter: 4 },   // l'Arena usa i livelli per-classe
    autoCreated: true,
    stats: {
      hp: 36, maxHp: 36, tempHp: 0,
      ac: 16, shield: 0,
      initiative: 1, speed: 9, prof: 2, spellDc: 0,
      // Caratteristiche del guerriero (TS competenti: FOR e COS → save = mod + prof)
      str: ab(16, 3, 5),
      dex: ab(13, 1, 1),
      con: ab(14, 2, 4),
      int: ab(10, 0, 0),
      wis: ab(12, 1, 1),
      cha: ab(10, 0, 0),
    },
    actions: [
      { name: "Spada lunga", category: "Armi", bonus: "+5", damage: "1d8 + 3", description: "Arma da mischia versatile." },
      { name: "Arco corto", category: "Armi", bonus: "+3", damage: "1d6 + 1", description: "Arma a distanza." },
    ],
    skills: [],
    spellSlots: [],
    inventory: [],
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
  };
}

/**
 * Crea il PG base SOLO se il player non ne ha già uno (nessun "name").
 * Usa merge:true per non toccare campi già presenti (lastSeen, fcmTokens, pet…).
 * @param {{uid:string}} user utente Firebase Auth loggato
 */
export async function ensureBaseCharacter(user) {
  if (!user?.uid) return;
  if (NO_PG_EMAILS.includes((user.email || "").toLowerCase())) return;
  try {
    const ref = doc(db, "characters", user.uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : null;
    // Ha già un PG (vero o base creato in precedenza) → non tocchiamo nulla.
    if (data?.name) return;
    await setDoc(
      ref,
      { ...baseWarriorCharacter(), autoCreatedAt: serverTimestamp() },
      { merge: true },
    );
    console.log("[ensureBaseCharacter] PG base (Guerriero Lv4) assegnato a", user.uid);
  } catch (e) {
    console.warn("[ensureBaseCharacter]", e?.message || e);
  }
}
