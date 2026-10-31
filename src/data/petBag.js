/* ============================================================
   BISACCIA DEL DOMATORE (2026-10-31) — oggetti del nuovo Rifugio.
   (Il vecchio data/petItems.js resta per il PetHub spento.)
   Stato: characters.petDen.items = { [id]: quantità }.
   Tipi:
   - level  = Caramella Rara: +1 livello. RARISSIMA: non si compra,
              esce solo dalla Torre (1% a piano, sicura ogni 25 piani).
   - xp     = Pietra dell'Esperienza: tanti PE in un colpo.
   - charm  = amuleto da far TENERE a un pet: vale per `fights` lotte
              (Torre o sfide), poi si consuma. Uno per pet.
   - scroll = Pergamena: insegna UNA mossa di qualunque elemento (anche
              un incantesimo di gelo a un pet di fuoco), al posto di
              una che il pet dimentica, come le MT di Pokémon. Massimo
              SCROLL_SLOTS mosse da pergamena per pet.
   ============================================================ */

import { PET_DEX_MOVES, ELEMENTS, TYPE_ICON, TYPE_LABEL } from "./petDex";

export const SCROLL_SLOTS = 2;

const BASE = {
  caramella: { name: "Caramella Rara", icon: "🍬", kind: "level", rarity: "legendary", price: null,
    desc: "Il pet sale subito di un livello. Rarissima: esce solo dalla Torre." },
  pietra: { name: "Pietra dell'Esperienza", icon: "💎", kind: "xp", rarity: "rare", price: 70,
    desc: "Dà al pet PE pari a metà del suo livello attuale (minimo 60)." },
  amuleto_scudo: { name: "Amuleto dello Scudo", icon: "🛡️", kind: "charm", rarity: "common", price: 30, fights: 3, fx: { ac: 2 },
    desc: "+2 alla Classe Armatura." },
  zanna: { name: "Zanna Affilata", icon: "🦷", kind: "charm", rarity: "common", price: 30, fights: 3, fx: { hit: 2 },
    desc: "+2 ai tiri per colpire e alla CD delle sue mosse." },
  ghianda: { name: "Ghianda Robusta", icon: "🌰", kind: "charm", rarity: "common", price: 30, fights: 3, fx: { hp: 0.15 },
    desc: "+15% di Punti Ferita massimi." },
  piuma: { name: "Piuma del Vento", icon: "🪶", kind: "charm", rarity: "common", price: 25, fights: 3, fx: { spd: 1 },
    desc: "Entra in campo con la Velocità già aumentata." },
  occhio: { name: "Occhio di Gufo", icon: "🦉", kind: "charm", rarity: "common", price: 25, fights: 3, fx: { save: 3 },
    desc: "+3 ai tiri salvezza contro veleni, sonni e maledizioni." },
  bacca: { name: "Bacca Curativa", icon: "🫐", kind: "charm", rarity: "common", price: 20, fights: 2, fx: { berry: 0.35 },
    desc: "Sotto metà dei PF la mangia e recupera il 35% (una volta per lotta)." },
  quadrifoglio: { name: "Quadrifoglio", icon: "🍀", kind: "charm", rarity: "rare", price: 45, fights: 3, fx: { crit: 19 },
    desc: "Critico anche col 19 naturale." },
  corona: { name: "Coroncina del Campione", icon: "👑", kind: "charm", rarity: "epic", price: 120, fights: 5, fx: { ac: 1, hit: 1, hp: 0.1 },
    desc: "+1 CA, +1 per colpire e +10% PF." },
};

// Un talismano di resistenza per ogni elemento.
const TALISMANS = Object.fromEntries(ELEMENTS.map((el) => [`talismano_${el}`, {
  name: `Talismano ${TYPE_LABEL[el] === "Fuoco" ? "del Fuoco" : `di ${TYPE_LABEL[el]}`}`, icon: TYPE_ICON[el], kind: "charm", rarity: "common",
  price: 30, fights: 3, fx: { resist: el }, desc: `Resistenza ai danni da ${TYPE_LABEL[el].toLowerCase()} (metà danni).`,
}]));

// Una pergamena per ogni mossa imparabile (gradi I–VI).
const SCROLL_PRICE = [0, 40, 60, 90, 130, 180, 240];
const SCROLLS = Object.fromEntries(Object.entries(PET_DEX_MOVES).filter(([, m]) => m.lv).map(([k, m]) => [`pergamena_${k}`, {
  name: `Pergamena: ${m.name}`, icon: "📜", kind: "scroll", move: k, rarity: m.lv >= 5 ? "epic" : m.lv >= 3 ? "rare" : "common",
  price: SCROLL_PRICE[m.lv], desc: `Insegna ${m.name} (${TYPE_LABEL[m.type]}, grado ${m.lv}) a qualunque pet, al posto di una mossa che dimentica.`,
}]));

export const PET_BAG = { ...BASE, ...TALISMANS, ...SCROLLS };
export const BAG_ORDER = Object.keys(PET_BAG);
export const CHARMS = BAG_ORDER.filter((k) => PET_BAG[k].kind === "charm");
export const SCROLL_IDS = BAG_ORDER.filter((k) => PET_BAG[k].kind === "scroll");
export const BAG_KIND_LABEL = { level: "Livello", xp: "Esperienza", charm: "Amuleto", scroll: "Pergamena" };
export const charmFx = (pet) => (pet?.charm && PET_BAG[pet.charm.id]?.fx) || null;

// Premi della Torre per un piano vinto (casuale: si tira una volta sola, nella transazione).
export function towerDrops(floor, rnd = Math.random) {
  const out = [];
  if (floor % 25 === 0 || rnd() < 0.01) out.push("caramella");
  if (floor % 5 === 0) out.push(CHARMS[Math.floor(rnd() * CHARMS.length)]);
  if (floor % 10 === 0) {
    const maxLv = Math.min(6, Math.ceil(floor / 10));
    const pool = SCROLL_IDS.filter((k) => PET_DEX_MOVES[PET_BAG[k].move].lv <= maxLv);
    out.push(pool[Math.floor(rnd() * pool.length)]);
  }
  return out;
}
