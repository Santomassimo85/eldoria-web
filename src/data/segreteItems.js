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
   Prezzi (rialzati il 2026-11-05: deve restare difficile) su ~40 Monete a dungeon a eroe:
   la pozione base si compra facile (25), il resto costa 2–10 dungeon, un'arma +1 ≈ un mese.
   `daily` = quanti se ne possono comprare al giorno (giorno di Roma), per giocatore:
   characters.storyShopDay = {day, n: {id: quantità}}. Lo controlla il server (shopBuy). */
import { WEAPONS, WEAPON_CHOICES, ARMOR_PROF, armorProf, canWear } from "./segreteKits";

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
  pozione: { name: "Pozione di Guarigione", icon: "🧪", kind: "heal", dice: "2d4", flat: 2, price: 25, daily: 3, rarity: "common", desc: "Cura 2d4+2 PF a te o a un alleato in piedi." },
  pozione_magg: { name: "Pozione di Guarigione Maggiore", icon: "🍷", kind: "heal", dice: "4d4", flat: 4, price: 90, daily: 2, rarity: "uncommon", desc: "Cura 4d4+4 PF a te o a un alleato in piedi." },
  pozione_sup: { name: "Pozione di Guarigione Superiore", icon: "⚗", kind: "heal", dice: "8d4", flat: 8, price: 250, daily: 1, rarity: "rare", desc: "Cura 8d4+8 PF a te o a un alleato in piedi." },
  tonico: { name: "Tonico Purificante", icon: "🌿", kind: "cleanse", price: 40, daily: 2, rarity: "common", desc: "Toglie svantaggio, stordimento e irruenza a te o a un alleato." },
  pelle_pietra: { name: "Pozione di Pelle di Pietra", icon: "🪨", kind: "buff", buff: "ac", value: 2, turns: 3, price: 90, daily: 1, rarity: "uncommon", desc: "+2 CA per 3 round a te o a un alleato." },
  eroismo: { name: "Pozione dell'Eroismo", icon: "🦸", kind: "buff", buff: "adv", turns: 2, price: 100, daily: 1, rarity: "uncommon", desc: "Vantaggio agli attacchi per 2 round a te o a un alleato." },
  fuoco_alch: { name: "Fuoco dell'Alchimista", icon: "🔥", kind: "throw", dice: "2d6", dmg: "fire", price: 50, daily: 2, rarity: "common", desc: "Lanci la fiala su un nemico: 2d6 fuoco, colpisce sempre." },
  acido: { name: "Fiala d'Acido", icon: "🫙", kind: "throw", dice: "2d6", dmg: "acid", price: 50, daily: 2, rarity: "common", desc: "Lanci la fiala su un nemico: 2d6 acido, colpisce sempre." },
  acqua_santa: { name: "Acqua Santa", icon: "💧", kind: "throw", dice: "2d8", dmg: "radiant", price: 80, daily: 1, rarity: "uncommon", desc: "Su un nemico: 2d8 radiosi, colpisce sempre." },
  pietra_tuono: { name: "Pietra del Tuono", icon: "💥", kind: "throw_area", dice: "2d6", dmg: "thunder", save: "con", dc: 13, price: 140, daily: 1, rarity: "uncommon", desc: "Esplode fra i nemici: 2d6 tuono a tutti, TS COS CD 13 per metà." },
  piuma_fenice: { name: "Piuma della Fenice", icon: "🪶", kind: "revive", pct: 50, price: 400, daily: 1, rarity: "rare", desc: "Rialza un alleato a terra con metà dei PF." },
};

// armi magiche: una +1 (rara, in bottega) e una +2 (molto rara, solo dai mostri) per ogni arma
const WEAPON_ITEMS = {};
Object.entries(WEAPONS).forEach(([k, w]) => {
  WEAPON_ITEMS[`${k}_1`] = { name: `${w.name} +1`, icon: w.icon, kind: "weapon", base: k, plus: 1, price: 1200, daily: 1, rarity: "rare", group: "weapon", desc: `${w.dice} +1 a colpire e ai danni. Si equipaggia sull'eroe che usa questo tipo d'arma.` };
  WEAPON_ITEMS[`${k}_2`] = { name: `${w.name} +2`, icon: w.icon, kind: "weapon", base: k, plus: 2, price: 0, rarity: "veryRare", group: "weapon", desc: `${w.dice} +2 a colpire e ai danni. Si trova solo nelle Segrete.` };
});

/* ARMI SPECIALI (2026-11-06): solo dai mostri, quasi tutte di UN dungeon (`dungeons`), alcune
   solo a Medio/Leggenda (`minDiff`). `fx` = effetti al colpo (motore: weaponHitFx):
   extra [dado, tipo] · burn/poison {chance, dice, turns} (danno a ogni turno del mostro) ·
   slow {chance, turns} (svantaggio) · stun {chance} (i boss lo evitano metà delle volte) ·
   drain % (il danno extra ti cura) · crit (critico da N) · multi {double, none} (colpi in più/in meno). */
const SPECIAL_WEAPONS = {
  lingua_salamandra: { name: "Lingua di Salamandra", icon: "🔥", base: "spada_lunga", plus: 1, rarity: "rare", dungeons: ["magma"],
    fx: { extra: ["1d4", "fire"], burn: { chance: 20, dice: "1d4", turns: 2 } },
    desc: "Spada lunga +1 ancora calda di lava: +1d4 fuoco e a volte il nemico prende fuoco." },
  maglio_fabbro: { name: "Maglio del Fabbro Pazzo", icon: "⚒", base: "maglio", plus: 1, rarity: "rare", dungeons: ["magma"], minDiff: "medio",
    fx: { burn: { chance: 20, dice: "1d6", turns: 2 } },
    desc: "Il fabbro giurava che bastava scaldarlo «un altro pochino». Maglio +1 che incendia chi colpisce." },
  zanna_vyrskaal: { name: "Zanna di Vyrskaal", icon: "❄", base: "ascia_bip", plus: 1, rarity: "veryRare", dungeons: ["ghiaccio"], minDiff: "leggenda",
    fx: { extra: ["1d6", "cold"], slow: { chance: 25, turns: 1 } },
    desc: "Un dente della Regina di Brina montato su un manico. Ascia bipenne +1, +1d6 freddo, a volte congela le gambe." },
  lancia_pescatore: { name: "Fiocina del Pescatore di Annegati", icon: "🔱", base: "lancia", plus: 1, rarity: "rare", dungeons: ["palude", "ghiaccio"],
    fx: { slow: { chance: 30, turns: 1 } },
    desc: "Lancia +1 con l'uncino: chi viene preso fatica a muoversi (svantaggio)." },
  spina_palude: { name: "Spina della Palude", icon: "🌿", base: "stocco", plus: 0, rarity: "uncommon", dungeons: ["palude"],
    fx: { poison: { chance: 30, dice: "1d4", turns: 3 } },
    desc: "Stocco ricavato da una spina gigante, sempre un po' appiccicoso. Spesso avvelena." },
  falce_ragno: { name: "Zampa del Ragno Gigante", icon: "🕷", base: "scimitarra", plus: 0, rarity: "uncommon", dungeons: ["caverna"],
    fx: { poison: { chance: 25, dice: "1d6", turns: 2 } },
    desc: "Una zampa di ragno affilata come una scimitarra. Il veleno c'è ancora." },
  arco_ratto: { name: "Arco del Ratto Ubriaco", icon: "🏹", base: "arco_lungo", plus: 0, rarity: "uncommon", dungeons: ["caverna"],
    fx: { multi: { double: 25, none: 10 } },
    desc: "Apparteneva a un ratto mannaro con un debole per il sidro. A volte tira due frecce, a volte nessuna." },
  stiletto_rimorso: { name: "Stiletto del Rimorso", icon: "🗡", base: "stocco", plus: 1, rarity: "rare", dungeons: ["segrete"],
    fx: { crit: 19 },
    desc: "Stocco +1 di un carceriere pentito: sussurra «scusa» e colpisce i punti giusti (critico con 19 o 20)." },
  catene_mazzafrusto: { name: "Mazzafrusto delle Catene", icon: "⛓", base: "mazzafrusto", plus: 1, rarity: "rare", dungeons: ["segrete"],
    fx: { slow: { chance: 25, turns: 1 } },
    desc: "Le catene si attorcigliano da sole attorno alle gambe del nemico. Mazzafrusto +1." },
  mazza_penitenza: { name: "Mazza della Penitenza", icon: "🩸", base: "mazza", plus: 1, rarity: "rare", dungeons: ["tempio"],
    fx: { extra: ["1d6", "radiant"], drain: 50 },
    desc: "Mazza +1 di un culto dimenticato: +1d6 radiosi e metà di quel danno ti cura." },
  balestra_tobia: { name: "Balestra a Ripetizione di Zio Tobia", icon: "🏹", base: "balestra_l", plus: 0, rarity: "uncommon", dungeons: ["tempio"],
    fx: { multi: { double: 30, none: 5 } },
    desc: "Un'invenzione di zio Tobia trovata fra le rovine. Spesso spara due quadrelli. Spesso." },
  martello_brontola: { name: "Martello che Brontola", icon: "🔨", base: "martello", plus: 1, rarity: "rare",
    fx: { stun: { chance: 15 } },
    desc: "Martello da guerra +1 che borbotta insulti in nanico. Ogni tanto il nemico resta stordito per la vergogna." },
  mestolo_nonna: { name: "Mestolo della Nonna", icon: "🥄", base: "bastone", plus: 0, rarity: "uncommon",
    fx: { extra: ["1d4", "bludgeoning"], stun: { chance: 10 } },
    desc: "Un mestolo enorme. Chiunque ne sia stato colpito da bambino si blocca per un attimo. +1d4 contundenti." },
};

/* ARMATURE E SCUDI (2026-11-06): `base` = armatura di ARMORS (segreteKits.js). Si equipaggiano
   dalla scheda dell'eroe se la classe sa portarle; res = resistenze ai danni, saveBonus = +N ai
   tiri salvezza, thorns {chance, dice, dmg} = chi ti colpisce in mischia a volte si fa male. */
const ARMOR_ITEMS = {
  arm_mezza: { name: "Mezza Armatura", icon: "🛡", kind: "armor", base: "mezza", plus: 0, price: 500, daily: 1, rarity: "uncommon", group: "armor", desc: "Armatura media: CA 15 + DES (massimo +2)." },
  arm_stecche: { name: "Armatura a Stecche", icon: "🛡", kind: "armor", base: "stecche", plus: 0, price: 700, daily: 1, rarity: "uncommon", group: "armor", desc: "Armatura pesante: CA 17." },
  arm_piastre: { name: "Armatura di Piastre", icon: "🏰", kind: "armor", base: "piastre", plus: 0, price: 1500, daily: 1, rarity: "rare", group: "armor", desc: "La migliore armatura pesante: CA 18." },
  arm_cuoio_1: { name: "Armatura di Cuoio +1", icon: "🧥", kind: "armor", base: "cuoio", plus: 1, price: 0, rarity: "rare", group: "armor", desc: "Leggera: CA 12 + DES." },
  arm_borchiato_1: { name: "Cuoio Borchiato +1", icon: "🦺", kind: "armor", base: "borchiato", plus: 1, price: 0, rarity: "rare", group: "armor", desc: "Leggera: CA 13 + DES." },
  arm_scaglie_1: { name: "Corazza di Scaglie +1", icon: "🐉", kind: "armor", base: "scaglie", plus: 1, price: 0, rarity: "rare", group: "armor", desc: "Media: CA 15 + DES (massimo +2)." },
  arm_mezza_1: { name: "Mezza Armatura +1", icon: "🛡", kind: "armor", base: "mezza", plus: 1, price: 0, rarity: "veryRare", group: "armor", desc: "Media: CA 16 + DES (massimo +2)." },
  arm_maglia_1: { name: "Cotta di Maglia +1", icon: "⛓", kind: "armor", base: "maglia", plus: 1, price: 0, rarity: "rare", group: "armor", desc: "Pesante: CA 17." },
  arm_piastre_1: { name: "Armatura di Piastre +1", icon: "🏰", kind: "armor", base: "piastre", plus: 1, price: 0, rarity: "veryRare", group: "armor", desc: "Pesante: CA 19." },
  // a tema, dei dungeon
  scaglie_salamandra: { name: "Scaglie della Salamandra", icon: "🦎", kind: "armor", base: "scaglie", plus: 0, rarity: "rare", dungeons: ["magma"], res: ["fire"], desc: "Corazza di scaglie fatta con la pelle di una salamandra: resistenza al fuoco." },
  pelliccia_lupo: { name: "Pelliccia del Lupo Invernale", icon: "🐺", kind: "armor", base: "cuoio", plus: 0, rarity: "uncommon", dungeons: ["ghiaccio"], res: ["cold"], desc: "Armatura di cuoio foderata di pelo bianco: resistenza al freddo. Profuma di cane bagnato." },
  mezza_ghiaccio: { name: "Mezza Armatura del Ghiaccio Eterno", icon: "🧊", kind: "armor", base: "mezza", plus: 1, rarity: "veryRare", dungeons: ["ghiaccio"], minDiff: "medio", res: ["cold"], desc: "Mezza armatura +1 che non si scioglie mai: resistenza al freddo." },
  giaco_muschio: { name: "Giaco di Muschio", icon: "🍄", kind: "armor", base: "giaco", plus: 0, rarity: "uncommon", dungeons: ["palude"], res: ["poison"], desc: "Giaco di maglia ricoperto di muschio che assorbe i veleni: resistenza al veleno." },
  giubba_galline: { name: "Giubba del Ladro di Galline", icon: "🐔", kind: "armor", base: "borchiato", plus: 1, rarity: "rare", dungeons: ["caverna"], desc: "Cuoio borchiato +1 pieno di piume. Nessuno sa perché, ma funziona." },
  catene_carceriere: { name: "Catene del Carceriere", icon: "⛓", kind: "armor", base: "maglia", plus: 0, rarity: "rare", dungeons: ["segrete"], res: ["necrotic"], desc: "Cotta di maglia intrecciata con catene benedette: resistenza ai danni necrotici." },
  piastre_guardiano: { name: "Piastre del Guardiano Sepolto", icon: "🏛", kind: "armor", base: "piastre", plus: 0, rarity: "veryRare", dungeons: ["tempio"], minDiff: "leggenda", saveBonus: 1, res: ["radiant"], desc: "Armatura di piastre di un guardiano del tempio: CA 18, +1 ai tiri salvezza, resistenza ai radiosi." },
  // scudi (Guerriero, Paladino, Chierico, Barbaro, Ranger, Druido con un'arma a una mano)
  scudo_1: { name: "Scudo +1", icon: "🛡", kind: "shield", plus: 1, price: 0, rarity: "rare", group: "armor", desc: "+3 CA invece di +2." },
  scudo_padella: { name: "Scudo-Padella", icon: "🍳", kind: "shield", plus: 0, rarity: "uncommon", thorns: { chance: 25, dice: "1d4", dmg: "bludgeoning" }, desc: "Una padella gigante. +2 CA e chi ti colpisce in mischia a volte si prende una padellata (1d4)." },
  scudo_brina: { name: "Scudo di Brina", icon: "❄", kind: "shield", plus: 0, rarity: "uncommon", dungeons: ["ghiaccio"], res: ["cold"], desc: "+2 CA e resistenza al freddo." },
  scudo_magma: { name: "Scudo di Ossidiana", icon: "🌋", kind: "shield", plus: 1, rarity: "rare", dungeons: ["magma"], minDiff: "medio", thorns: { chance: 25, dice: "1d6", dmg: "fire" }, desc: "+3 CA: chi ti colpisce in mischia a volte si scotta (1d6 fuoco)." },
};
Object.values(SPECIAL_WEAPONS).forEach((w) => { w.kind = "weapon"; w.price = 0; w.special = true; });
Object.values(ARMOR_ITEMS).forEach((a) => { if (a.price == null) a.price = 0; });

export const ITEMS = { ...BASE_ITEMS, ...WEAPON_ITEMS, ...SPECIAL_WEAPONS, ...ARMOR_ITEMS };
export const itemOf = (id) => (ITEMS[id] ? { id, ...ITEMS[id] } : null);
export const SHOP_ITEMS = Object.keys(ITEMS).filter((id) => ITEMS[id].price > 0);
export const isGear = (it) => !!it && (it.kind === "weapon" || it.kind === "armor" || it.kind === "shield");
export const battleItem = (id) => { const it = itemOf(id); return it && !isGear(it) ? it : null; };
// equipaggiamento dell'eroe con gli oggetti risolti (per heroDefense / heroAc di segreteKits)
export function heroGear(hero = {}, cls) {
  const wi = itemOf(hero?.weaponItem);
  return { armor: hero?.armor, shield: hero?.shield, weapon: (wi?.kind === "weapon" ? wi.base : hero?.weapon) || WEAPON_CHOICES[cls]?.[0], armorItem: itemOf(hero?.armorItem), shieldItem: itemOf(hero?.shieldItem) };
}
// chi può usare un equipaggiamento: classi (chiavi)
export function gearUsers(it) {
  if (!it) return [];
  if (it.kind === "weapon") return Object.keys(WEAPON_CHOICES).filter((c) => WEAPON_CHOICES[c].includes(it.base));
  if (it.kind === "armor") return Object.keys(ARMOR_PROF).filter((c) => canWear(c, it.base));
  if (it.kind === "shield") return Object.keys(ARMOR_PROF).filter((c) => armorProf(c).shield);
  return [];
}
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
/* Oggetto pescato a peso di rarità (2026-11-06, rifatto con dungeon e difficoltà).
   ctx = { dungeon, rank (0 Facile · 1 Medio · 2 Leggenda), boost (rarità della difficoltà),
   bases (armi del gruppo; null = tutte), classes (classi del gruppo; null = tutte) }.
   Le armi escono solo fra i tipi che il gruppo usa e armature/scudi solo se qualcuno li sa
   portare, così quello che si trova si equipaggia davvero. Gli oggetti con `dungeons` escono
   solo lì, quelli con `minDiff` solo da quella difficoltà in su. */
export const DIFF_RANK = { facile: 0, medio: 1, leggenda: 2 };
export function dropPool(ctx = {}) {
  const { dungeon = null, rank = 0, bases = null, classes = null } = ctx;
  return Object.keys(ITEMS).filter((id) => {
    const it = ITEMS[id];
    if (it.dungeons && !it.dungeons.includes(dungeon)) return false;
    if (it.minDiff && (DIFF_RANK[it.minDiff] || 0) > rank) return false;
    if (it.kind === "weapon") return !bases || bases.includes(it.base);
    if (it.kind === "armor" || it.kind === "shield") return !classes || gearUsers(it).some((c) => classes.includes(c));
    return true;
  });
}
export function dropWeights(ctx = {}, role = "minion") {
  const pool = dropPool(ctx);
  // il boss pesca un po' meglio: le rarità alte pesano di più (e la difficoltà le alza ancora)
  const boost = { ...(role === "boss" ? { rare: 2, veryRare: 2.5 } : role === "elite" ? { rare: 1.4, veryRare: 1.5 } : {}) };
  Object.entries(ctx.boost || {}).forEach(([k, v]) => { boost[k] = (boost[k] || 1) * v; });
  // armi +1/+2 e armature generiche sono tante: tutte insieme pesano come 2 e 1,5 oggetti
  const gw = pool.filter((id) => ITEMS[id].group === "weapon").length || 1;
  const ga = pool.filter((id) => ITEMS[id].group === "armor").length || 1;
  return pool.map((id) => {
    const it = ITEMS[id];
    const w = RARITY[it.rarity].w * (boost[it.rarity] || 1);
    return [id, it.group === "weapon" ? (w * 2) / gw : it.group === "armor" ? (w * 1.5) / ga : w];
  });
}
export function rollDropItem(rnd, ctx = {}, role = "minion") {
  const ws = dropWeights(ctx, role);
  const tot = ws.reduce((t, [, w]) => t + w, 0);
  let r = rnd() * tot;
  for (const [id, w] of ws) { r -= w; if (r <= 0) return id; }
  return ws.length ? ws[ws.length - 1][0] : "pozione";
}
// % di ogni oggetto quando un mostro di quel ruolo lascia un oggetto (pannello della lobby)
export function dropOdds(ctx = {}, role = "minion") {
  const ws = dropWeights(ctx, role);
  const tot = ws.reduce((t, [, w]) => t + w, 0) || 1;
  return ws.map(([id, w]) => ({ id, pct: (100 * w) / tot })).sort((a, b) => b.pct - a.pct);
}

/* acquisti di oggi (giorno di Roma) */
export const romeDay = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
export function boughtToday(charData, id, day = romeDay()) {
  const d = charData?.storyShopDay;
  return d && d.day === day ? Number(d.n?.[id]) || 0 : 0;
}
export const dailyLimit = (id) => Number(ITEMS[id]?.daily) || 1;
/* REGALI FRA GIOCATORI (2026-11-05): un oggetto dello zaino a un altro giocatore costa
   GIFT_FEE Monete Antiche (le paga chi regala) e se ne possono fare GIFT_DAILY al giorno.
   Fra i propri eroi non serve: lo zaino è unico per tutti gli eroi del giocatore.
   characters.storyGiftDay = {day, n}. Lo controlla il server (segreteDo op giftItem). */
export const GIFT_FEE = 50;
export const GIFT_DAILY = 3;
export const giftsToday = (charData, day = romeDay()) => (charData?.storyGiftDay?.day === day ? Number(charData.storyGiftDay.n) || 0 : 0);
