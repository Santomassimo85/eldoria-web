/* ============================================================
   BISACCIA DEL DOMATORE (2026-10-31) — oggetti del nuovo Rifugio.
   (Il vecchio data/petItems.js resta per il PetHub spento.)
   Stato: characters.petDen.items = { [id]: quantità }.
   Tipi:
   - level  = Caramella Rara: +1 livello. RARISSIMA: non si compra,
              esce solo dalla Torre (1% a piano, sicura ogni 25 piani).
              Torta della Crescita (2026-11-01): +1 livello, si compra ma
              costa tanto (TORTA_PRICE) e salta il tetto di PE del giorno.
   - xp     = Pietra dell'Esperienza: tanti PE in un colpo.
   - evo    = Pietra dell'Evoluzione (2026-11-01): fa evolvere SUBITO un
              pet che ha un'evoluzione, a qualunque livello. Carissima
              (EVO_STONE_PRICE). Si usa dall'evoluzione (op evolvePet con
              stone = true): se il pet ha già il livello non si consuma.
   - charm  = amuleto da far TENERE a un pet: vale per `fights` lotte
     (2026-11-01: da 3 a 10 lotte, ~un giorno di torre)
              (Torre o sfide), poi si consuma. Uno per pet.
   - battle = da usare IN LOTTA (2026-11-01): Pozione, Antidoto, Elisir,
              Piuma della Fenice. Si danno al pet scelto dalla Bisaccia
              durante la lotta e consumano il turno. In lotta si possono
              dare anche gli amuleti: valgono subito e il pet li tiene.
   - scroll = Pergamena: insegna UNA mossa di qualunque elemento (anche
              un incantesimo di gelo a un pet di fuoco), al posto di
              una che il pet dimentica, come le MT di Pokémon. Massimo
              SCROLL_SLOTS mosse da pergamena per pet.
   ============================================================ */

import { PET_DEX_MOVES, ELEMENTS, TYPE_ICON, TYPE_LABEL } from "./petDex";

export const SCROLL_SLOTS = 2;
export const EVO_STONE = "pietra_evo";
export const EVO_STONE_PRICE = 1500;
export const TORTA_PRICE = 400;

const BASE = {
  caramella: { name: "Caramella Rara", icon: "🍬", kind: "level", rarity: "legendary", price: null,
    desc: "Il pet sale subito di un livello. Rarissima: esce solo dalla Torre." },
  pietra: { name: "Pietra dell'Esperienza", icon: "💎", kind: "xp", rarity: "rare", price: 70,
    desc: "Dà al pet PE pari a metà del suo livello attuale (minimo 60), dentro il tetto di PE del giorno." },
  torta: { name: "Torta della Crescita", icon: "🎂", kind: "level", rarity: "epic", price: TORTA_PRICE,
    desc: "Il pet sale subito di un livello, anche se oggi ha già preso tutti i suoi PE. Costa cara." },
  pietra_evo: { name: "Pietra dell'Evoluzione", icon: "🌟", kind: "evo", rarity: "legendary", price: EVO_STONE_PRICE,
    desc: "Fa evolvere subito qualunque pet che ha un'evoluzione, a qualsiasi livello. Rarissima e carissima." },
  amuleto_scudo: { name: "Amuleto dello Scudo", icon: "🛡️", kind: "charm", rarity: "common", price: 30, fights: 10, fx: { ac: 2 },
    desc: "+2 alla Classe Armatura." },
  zanna: { name: "Zanna Affilata", icon: "🦷", kind: "charm", rarity: "common", price: 30, fights: 10, fx: { hit: 2 },
    desc: "+2 ai tiri per colpire e alla CD delle sue mosse." },
  ghianda: { name: "Ghianda Robusta", icon: "🌰", kind: "charm", rarity: "common", price: 30, fights: 10, fx: { hp: 0.15 },
    desc: "+15% di Punti Ferita massimi." },
  piuma: { name: "Piuma del Vento", icon: "🪶", kind: "charm", rarity: "common", price: 25, fights: 10, fx: { spd: 1 },
    desc: "Entra in campo con la Velocità già aumentata." },
  occhio: { name: "Occhio di Gufo", icon: "🦉", kind: "charm", rarity: "common", price: 25, fights: 10, fx: { save: 3 },
    desc: "+3 ai tiri salvezza contro veleni, sonni e maledizioni." },
  bacca: { name: "Bacca Curativa", icon: "🫐", kind: "charm", rarity: "common", price: 20, fights: 6, fx: { berry: 0.35 },
    desc: "Sotto metà dei PF la mangia e recupera il 35% (una volta per lotta)." },
  quadrifoglio: { name: "Quadrifoglio", icon: "🍀", kind: "charm", rarity: "rare", price: 45, fights: 10, fx: { crit: 19 },
    desc: "Critico anche col 19 naturale." },
  pozione: { name: "Pozione", icon: "🧪", kind: "battle", rarity: "common", price: 15, use: { heal: 0.4 },
    desc: "In lotta: cura il 40% dei PF del pet scelto (consuma il turno)." },
  antidoto: { name: "Antidoto", icon: "🌿", kind: "battle", rarity: "common", price: 10, use: { cure: true },
    desc: "In lotta: toglie veleno, scottatura e intontimento al pet scelto." },
  elisir: { name: "Elisir", icon: "⚗️", kind: "battle", rarity: "rare", price: 35, use: { uses: 2 },
    desc: "In lotta: ridà fino a 2 usi a ogni mossa che non è infinita." },
  fenice: { name: "Piuma della Fenice", icon: "🪽", kind: "battle", rarity: "epic", price: 80, use: { revive: 0.5 },
    desc: "In lotta: rianima un pet a terra con metà dei PF." },
  corona: { name: "Coroncina del Campione", icon: "👑", kind: "charm", rarity: "epic", price: 120, fights: 15, fx: { ac: 1, hit: 1, hp: 0.1 },
    desc: "+1 CA, +1 per colpire e +10% PF." },
};

// Un talismano di resistenza per ogni elemento.
const TALISMANS = Object.fromEntries(ELEMENTS.map((el) => [`talismano_${el}`, {
  name: `Talismano ${TYPE_LABEL[el] === "Fuoco" ? "del Fuoco" : `di ${TYPE_LABEL[el]}`}`, icon: TYPE_ICON[el], kind: "charm", rarity: "common",
  price: 30, fights: 10, fx: { resist: el }, desc: `Resistenza ai danni da ${TYPE_LABEL[el].toLowerCase()} (metà danni).`,
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
export const BAG_KIND_LABEL = { evo: "Evoluzione", level: "Livello", xp: "Esperienza", charm: "Amuleto", battle: "Da lotta", scroll: "Pergamena" };
// Oggetti che si possono dare in lotta: quelli da lotta e gli amuleti.
export const usableInBattle = (id) => ["battle", "charm"].includes(PET_BAG[id]?.kind);
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
