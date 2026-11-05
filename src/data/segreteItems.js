/* LE SEGRETE · oggetti e Monete Antiche (2026-11-04)
   Valuta delle Segrete = Monete Antiche (characters.storyCoins, del giocatore, valgono per
   tutti i suoi eroi). Zaino del giocatore = characters.storyBag = {idOggetto: quantità}.
   - Ogni sala vinta (anche il boss) dà 1d20 Monete Antiche a ogni eroe rimasto.
   - I mostri che cadono a volte lasciano Monete o un oggetto (DROP_CHANCE per ruolo,
     oggetto pescato a peso di rarità: le cose forti sono rare).
   - Monete e oggetti trovati restano nel "bottino della spedizione" e si portano a casa
     SOLO se il gruppo vince il dungeon: se cade, si perde tutto (regola delle Segrete).
   - Gli oggetti da lotta si usano col turno (come un'azione) e si consumano subito dallo zaino.
   - Le armi magiche (+1, +2) si equipaggiano sull'eroe (storyChars[cls].weaponItem) se il
     tipo d'arma è fra le due della sua classe: +N a colpire e ai danni.
   Prezzi tarati su ~45 Monete a dungeon (3 sale + boss ≈ 4 × 10,5 + qualche drop):
   una pozione ≈ mezzo dungeon, un'arma +1 ≈ 2 settimane di gioco. */
import { WEAPONS } from "./segreteKits";

export const COIN_NAME = "Monete Antiche";
export const COIN_ICON = "🪙";
export const FLOOR_COINS_DIE = 20; // 1d20 a sala vinta

export const RARITY = {
  common: { it: "Comune", w: 60, color: "#d8ccb4" },
  uncommon: { it: "Non comune", w: 28, color: "#6fd48a" },
  rare: { it: "Raro", w: 10, color: "#6fb6ff" },
  veryRare: { it: "Molto raro", w: 2, color: "#c48bff" },
};

/* kind: heal (cura un alleato, anche a terra = no: per rialzare serve la Piuma) · cleanse
   (toglie svantaggio, stordimento, irruenza) · buff (ac/adv come le abilità) · throw (colpisce
   sempre un nemico) · throw_area (TS di tutti i nemici, metà se riesce) · revive (rialza a %) */
const BASE_ITEMS = {
  pozione: { name: "Pozione di Guarigione", icon: "🧪", kind: "heal", dice: "2d4", flat: 2, price: 25, rarity: "common", desc: "Cura 2d4+2 PF a te o a un alleato in piedi." },
  pozione_magg: { name: "Pozione di Guarigione Maggiore", icon: "🍷", kind: "heal", dice: "4d4", flat: 4, price: 60, rarity: "uncommon", desc: "Cura 4d4+4 PF a te o a un alleato in piedi." },
  pozione_sup: { name: "Pozione di Guarigione Superiore", icon: "⚗", kind: "heal", dice: "8d4", flat: 8, price: 150, rarity: "rare", desc: "Cura 8d4+8 PF a te o a un alleato in piedi." },
  tonico: { name: "Tonico Purificante", icon: "🌿", kind: "cleanse", price: 25, rarity: "common", desc: "Toglie svantaggio, stordimento e irruenza a te o a un alleato." },
  pelle_pietra: { name: "Pozione di Pelle di Pietra", icon: "🪨", kind: "buff", buff: "ac", value: 2, turns: 3, price: 45, rarity: "uncommon", desc: "+2 CA per 3 round a te o a un alleato." },
  eroismo: { name: "Pozione dell'Eroismo", icon: "🦸", kind: "buff", buff: "adv", turns: 2, price: 50, rarity: "uncommon", desc: "Vantaggio agli attacchi per 2 round a te o a un alleato." },
  fuoco_alch: { name: "Fuoco dell'Alchimista", icon: "🔥", kind: "throw", dice: "2d6", dmg: "fire", price: 30, rarity: "common", desc: "Lanci la fiala su un nemico: 2d6 fuoco, colpisce sempre." },
  acido: { name: "Fiala d'Acido", icon: "🫙", kind: "throw", dice: "2d6", dmg: "acid", price: 30, rarity: "common", desc: "Lanci la fiala su un nemico: 2d6 acido, colpisce sempre." },
  acqua_santa: { name: "Acqua Santa", icon: "💧", kind: "throw", dice: "2d8", dmg: "radiant", price: 45, rarity: "uncommon", desc: "Su un nemico: 2d8 radiosi, colpisce sempre." },
  pietra_tuono: { name: "Pietra del Tuono", icon: "💥", kind: "throw_area", dice: "2d6", dmg: "thunder", save: "con", dc: 13, price: 70, rarity: "uncommon", desc: "Esplode fra i nemici: 2d6 tuono a tutti, TS COS CD 13 per metà." },
  piuma_fenice: { name: "Piuma della Fenice", icon: "🪶", kind: "revive", pct: 50, price: 200, rarity: "rare", desc: "Rialza un alleato a terra con metà dei PF." },
};

// armi magiche: una +1 (rara, in bottega) e una +2 (molto rara, solo dai mostri) per ogni arma
const WEAPON_ITEMS = {};
Object.entries(WEAPONS).forEach(([k, w]) => {
  WEAPON_ITEMS[`${k}_1`] = { name: `${w.name} +1`, icon: w.icon, kind: "weapon", base: k, plus: 1, price: 600, rarity: "rare", desc: `${w.dice} +1 a colpire e ai danni. Si equipaggia sull'eroe che usa questo tipo d'arma.` };
  WEAPON_ITEMS[`${k}_2`] = { name: `${w.name} +2`, icon: w.icon, kind: "weapon", base: k, plus: 2, price: 0, rarity: "veryRare", desc: `${w.dice} +2 a colpire e ai danni. Si trova solo nelle Segrete.` };
});

export const ITEMS = { ...BASE_ITEMS, ...WEAPON_ITEMS };
export const itemOf = (id) => (ITEMS[id] ? { id, ...ITEMS[id] } : null);
export const SHOP_ITEMS = Object.keys(ITEMS).filter((id) => ITEMS[id].price > 0);
export const battleItem = (id) => { const it = itemOf(id); return it && it.kind !== "weapon" ? it : null; };
// a chi si può dare in lotta: "ally" (anche se stessi), "downed" (alleato a terra), "foe", null (nessun bersaglio)
export function itemTarget(it) {
  if (!it) return null;
  if (it.kind === "throw") return "foe";
  if (it.kind === "throw_area") return null;
  if (it.kind === "revive") return "downed";
  return "ally";
}
export const coinsOf = (charData) => Math.max(0, Number(charData?.storyCoins) || 0);
export const bagOf = (charData) => {
  const b = charData?.storyBag || {};
  const out = {};
  Object.entries(b).forEach(([k, n]) => { if (ITEMS[k] && Number(n) > 0) out[k] = Number(n); });
  return out;
};

/* ── bottino dei mostri ── */
// per mostro che cade: probabilità (su 100) di monete e di un oggetto, e dadi delle monete
export const DROP_CHANCE = {
  minion: { coins: 20, coinDice: [1, 6], item: 5 },
  elite: { coins: 40, coinDice: [2, 6], item: 12 },
  boss: { coins: 75, coinDice: [4, 6], item: 30 },
};
/* Oggetto pescato a peso di rarità. Le armi escono solo fra quelle che il gruppo può usare
   (`weaponBases`), così una spada trovata si equipaggia davvero al prossimo dungeon. */
export function rollDropItem(rnd, weaponBases = [], role = "minion") {
  const pool = Object.keys(ITEMS).filter((id) => {
    const it = ITEMS[id];
    if (it.kind === "weapon") return weaponBases.includes(it.base);
    return true;
  });
  // il boss pesca un po' meglio: le rarità alte pesano di più
  const boost = role === "boss" ? { rare: 2, veryRare: 2.5 } : role === "elite" ? { rare: 1.4, veryRare: 1.5 } : {};
  // le armi sono tante (una per tipo): il loro peso totale non deve schiacciare le pozioni
  const weapons = pool.filter((id) => ITEMS[id].kind === "weapon").length || 1;
  const weight = (id) => {
    const it = ITEMS[id];
    const w = RARITY[it.rarity].w * (boost[it.rarity] || 1);
    return it.kind === "weapon" ? (w * 2) / weapons : w;
  };
  const tot = pool.reduce((t, id) => t + weight(id), 0);
  let r = rnd() * tot;
  for (const id of pool) { r -= weight(id); if (r <= 0) return id; }
  return pool[pool.length - 1];
}
