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
import { WEAPONS, WEAPON_CHOICES, ARMOR_PROF, ARMORS, HEAVY_ARMOR_TEXT, weaponOf, armorProf, canWear } from "./segreteKits";

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
  pozione: { name: "Pozione di Guarigione", icon: "🧪", kind: "heal", dice: "2d4", flat: 2, price: 25, daily: 3, rarity: "common", desc: "❤ +2d4+2 PF · te o un alleato in piedi" },
  pozione_magg: { name: "Pozione di Guarigione Maggiore", icon: "🍷", kind: "heal", dice: "4d4", flat: 4, price: 90, daily: 2, rarity: "uncommon", desc: "❤ +4d4+4 PF · te o un alleato in piedi" },
  pozione_sup: { name: "Pozione di Guarigione Superiore", icon: "⚗", kind: "heal", dice: "8d4", flat: 8, price: 250, daily: 1, rarity: "rare", desc: "❤ +8d4+8 PF · te o un alleato in piedi" },
  tonico: { name: "Tonico Purificante", icon: "🌿", kind: "cleanse", price: 40, daily: 2, rarity: "common", desc: "Te o un alleato: toglie 🔥 ☠ 🧊 ⚡ 😱 🌑 🐌 😵 🌫 💫 😤 · non 🗿" },
  bomba_acqua: { name: "Bomba d'Acqua", icon: "💧", kind: "cleanse_party", price: 200, daily: 1, rarity: "uncommon", desc: "Tutto il gruppo: toglie 🔥 🐌 ⚡" },
  panacea: { name: "Panacea", icon: "✨", kind: "panacea", price: 150, daily: 1, rarity: "rare", desc: "Te o un alleato: toglie tutti gli stati, anche 🗿" },
  pelle_pietra: { name: "Pozione di Pelle di Pietra", icon: "🪨", kind: "buff", buff: "ac", value: 2, turns: 3, price: 90, daily: 1, rarity: "uncommon", desc: "🛡 +2 CA · 3 round · te o un alleato" },
  eroismo: { name: "Pozione dell'Eroismo", icon: "🦸", kind: "buff", buff: "adv", turns: 2, price: 100, daily: 1, rarity: "uncommon", desc: "🎯 vantaggio · 2 round · te o un alleato" },
  fuoco_alch: { name: "Fuoco dell'Alchimista", icon: "🔥", kind: "throw", dice: "2d6", dmg: "fire", price: 50, daily: 2, rarity: "common", desc: "🔥 2d6 fuoco · colpisce sempre" },
  acido: { name: "Fiala d'Acido", icon: "🫙", kind: "throw", dice: "2d6", dmg: "acid", price: 50, daily: 2, rarity: "common", desc: "🧪 2d6 acido · colpisce sempre" },
  acqua_santa: { name: "Acqua Santa", icon: "💧", kind: "throw", dice: "2d8", dmg: "radiant", price: 80, daily: 1, rarity: "uncommon", desc: "✨ 2d8 radiosi · colpisce sempre" },
  pietra_tuono: { name: "Pietra del Tuono", icon: "💥", kind: "throw_area", dice: "2d6", dmg: "thunder", save: "con", dc: 13, price: 140, daily: 1, rarity: "uncommon", desc: "💥 2d6 tuono a tutti i nemici · TS COS CD 13 per metà" },
  piuma_fenice: { name: "Piuma della Fenice", icon: "🪶", kind: "revive", pct: 50, price: 400, daily: 1, rarity: "rare", desc: "Rialza un alleato a terra con metà PF" },
};

// armi magiche: una +1 (rara, in bottega) e una +2 (molto rara, solo dai mostri) per ogni arma
const WEAPON_ITEMS = {};
Object.entries(WEAPONS).forEach(([k, w]) => {
  WEAPON_ITEMS[`${k}_1`] = { name: `${w.name} +1`, icon: w.icon, kind: "weapon", base: k, plus: 1, price: 1200, daily: 1, rarity: "rare", group: "weapon", desc: `${w.dice} · +1 a colpire e ai danni` };
  WEAPON_ITEMS[`${k}_2`] = { name: `${w.name} +2`, icon: w.icon, kind: "weapon", base: k, plus: 2, price: 0, rarity: "veryRare", group: "weapon", desc: `${w.dice} · +2 a colpire e ai danni · solo nelle Segrete` };
});

/* ARMI SPECIALI (2026-11-06): solo dai mostri, quasi tutte di UN dungeon (`dungeons`), alcune
   solo a Medio/Leggenda (`minDiff`). `fx` = effetti al colpo (motore: weaponHitFx):
   extra [dado, tipo] · burn/poison {chance, dice, turns} (danno a ogni turno del mostro) ·
   slow {chance, turns} (svantaggio) · stun {chance} (i boss lo evitano metà delle volte) ·
   drain % (il danno extra ti cura) · crit (critico da N) · multi {double, none} (colpi in più/in meno). */
const SPECIAL_WEAPONS = {
  lingua_salamandra: { name: "Lingua di Salamandra", icon: "🔥", base: "spada_lunga", plus: 1, rarity: "rare", dungeons: ["magma"],
    fx: { extra: ["1d4", "fire"], burn: { chance: 20, dice: "1d4", turns: 2 } },
    desc: "Spada lunga +1 ancora calda di lava." },
  maglio_fabbro: { name: "Maglio del Fabbro Pazzo", icon: "⚒", base: "maglio", plus: 1, rarity: "rare", dungeons: ["magma"], minDiff: "medio",
    fx: { burn: { chance: 20, dice: "1d6", turns: 2 } },
    desc: "Maglio +1. «Basta scaldarlo un altro pochino.»" },
  zanna_vyrskaal: { name: "Zanna di Vyrskaal", icon: "❄", base: "ascia_bip", plus: 1, rarity: "veryRare", dungeons: ["ghiaccio"], minDiff: "leggenda",
    fx: { extra: ["1d6", "cold"], slow: { chance: 25, turns: 1 } },
    desc: "Ascia bipenne +1: un dente della Regina di Brina." },
  lancia_pescatore: { name: "Fiocina del Pescatore di Annegati", icon: "🔱", base: "lancia", plus: 1, rarity: "rare", dungeons: ["palude", "ghiaccio"],
    fx: { slow: { chance: 30, turns: 1 } },
    desc: "Lancia +1 con l'uncino." },
  spina_palude: { name: "Spina della Palude", icon: "🌿", base: "stocco", plus: 0, rarity: "uncommon", dungeons: ["palude"],
    fx: { poison: { chance: 30, dice: "1d4", turns: 3 } },
    desc: "Stocco fatto da una spina gigante, sempre appiccicoso." },
  falce_ragno: { name: "Zampa del Ragno Gigante", icon: "🕷", base: "scimitarra", plus: 0, rarity: "uncommon", dungeons: ["caverna"],
    fx: { poison: { chance: 25, dice: "1d6", turns: 2 } },
    desc: "Scimitarra: il veleno del ragno c'è ancora." },
  arco_ratto: { name: "Arco del Ratto Ubriaco", icon: "🏹", base: "arco_lungo", plus: 0, rarity: "uncommon", dungeons: ["caverna"],
    fx: { multi: { double: 25, none: 10 } },
    desc: "Arco lungo di un ratto mannaro con un debole per il sidro." },
  stiletto_rimorso: { name: "Stiletto del Rimorso", icon: "🗡", base: "stocco", plus: 1, rarity: "rare", dungeons: ["segrete"],
    fx: { crit: 19 },
    desc: "Stocco +1 di un carceriere pentito: sussurra «scusa»." },
  catene_mazzafrusto: { name: "Mazzafrusto delle Catene", icon: "⛓", base: "mazzafrusto", plus: 1, rarity: "rare", dungeons: ["segrete"],
    fx: { slow: { chance: 25, turns: 1 } },
    desc: "Mazzafrusto +1: le catene si attorcigliano da sole." },
  mazza_penitenza: { name: "Mazza della Penitenza", icon: "🩸", base: "mazza", plus: 1, rarity: "rare", dungeons: ["tempio"],
    fx: { extra: ["1d6", "radiant"], drain: 50 },
    desc: "Mazza +1 di un culto dimenticato." },
  balestra_tobia: { name: "Balestra a Ripetizione di Zio Tobia", icon: "🏹", base: "balestra_l", plus: 0, rarity: "uncommon", dungeons: ["tempio"],
    fx: { multi: { double: 30, none: 5 } },
    desc: "Balestra leggera, invenzione di zio Tobia. Spesso funziona." },
  martello_brontola: { name: "Martello che Brontola", icon: "🔨", base: "martello", plus: 1, rarity: "rare",
    fx: { stun: { chance: 15 } },
    desc: "Martello da guerra +1 che borbotta insulti in nanico." },
  mestolo_nonna: { name: "Mestolo della Nonna", icon: "🥄", base: "bastone", plus: 0, rarity: "uncommon",
    fx: { extra: ["1d4", "bludgeoning"], stun: { chance: 10 } },
    desc: "Bastone: un mestolo enorme. Tutti ne hanno paura." },
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
  scaglie_salamandra: { name: "Scaglie della Salamandra", icon: "🦎", kind: "armor", base: "scaglie", plus: 0, rarity: "rare", dungeons: ["magma"], res: ["fire"], desc: "🔥 resistenza al fuoco · scaglie di salamandra." },
  pelliccia_lupo: { name: "Pelliccia del Lupo Invernale", icon: "🐺", kind: "armor", base: "cuoio", plus: 0, rarity: "uncommon", dungeons: ["ghiaccio"], res: ["cold"], desc: "🧊 resistenza al freddo · profuma di cane bagnato." },
  mezza_ghiaccio: { name: "Mezza Armatura del Ghiaccio Eterno", icon: "🧊", kind: "armor", base: "mezza", plus: 1, rarity: "veryRare", dungeons: ["ghiaccio"], minDiff: "medio", res: ["cold"], desc: "🧊 resistenza al freddo · mezza armatura +1." },
  giaco_muschio: { name: "Giaco di Muschio", icon: "🍄", kind: "armor", base: "giaco", plus: 0, rarity: "uncommon", dungeons: ["palude"], res: ["poison"], desc: "☠ resistenza al veleno · giaco di muschio." },
  giubba_galline: { name: "Giubba del Ladro di Galline", icon: "🐔", kind: "armor", base: "borchiato", plus: 1, rarity: "rare", dungeons: ["caverna"], desc: "Cuoio borchiato +1 pieno di piume. Funziona." },
  catene_carceriere: { name: "Catene del Carceriere", icon: "⛓", kind: "armor", base: "maglia", plus: 0, rarity: "rare", dungeons: ["segrete"], res: ["necrotic"], desc: "💀 resistenza al necrotico · cotta di maglia." },
  piastre_guardiano: { name: "Piastre del Guardiano Sepolto", icon: "🏛", kind: "armor", base: "piastre", plus: 0, rarity: "veryRare", dungeons: ["tempio"], minDiff: "leggenda", saveBonus: 1, res: ["radiant"], desc: "CA 18 · +1 ai TS · ✨ resistenza al radioso." },
  // scudi (Guerriero, Paladino, Chierico, Barbaro, Ranger, Druido con un'arma a una mano)
  scudo_1: { name: "Scudo +1", icon: "🛡", kind: "shield", plus: 1, price: 0, rarity: "rare", group: "armor", desc: "+3 CA invece di +2." },
  scudo_padella: { name: "Scudo-Padella", icon: "🍳", kind: "shield", plus: 0, rarity: "uncommon", thorns: { chance: 25, dice: "1d4", dmg: "bludgeoning" }, desc: "+2 CA · 25%: chi ti colpisce prende 1d4." },
  scudo_brina: { name: "Scudo di Brina", icon: "❄", kind: "shield", plus: 0, rarity: "uncommon", dungeons: ["ghiaccio"], res: ["cold"], desc: "+2 CA · 🧊 resistenza al freddo." },
  scudo_magma: { name: "Scudo di Ossidiana", icon: "🌋", kind: "shield", plus: 1, rarity: "rare", dungeons: ["magma"], minDiff: "medio", thorns: { chance: 25, dice: "1d6", dmg: "fire" }, desc: "+3 CA · 25%: chi ti colpisce prende 🔥 1d6." },
};
Object.values(SPECIAL_WEAPONS).forEach((w) => { w.kind = "weapon"; w.price = 0; w.special = true; });
Object.values(ARMOR_ITEMS).forEach((a) => { if (a.price == null) a.price = 0; });

export const ITEMS = { ...BASE_ITEMS, ...WEAPON_ITEMS, ...SPECIAL_WEAPONS, ...ARMOR_ITEMS };
export const itemOf = (id) => {
  const it = ITEMS[id];
  if (!it) return null;
  return { id, ...it, ...(it.kind === "armor" && ARMORS[it.base]?.cat === "heavy" ? { desc: `${it.desc || ""} / ${HEAVY_ARMOR_TEXT}.` } : {}) };
};
export const SHOP_ITEMS = Object.keys(ITEMS).filter((id) => ITEMS[id].price > 0);
export const isGear = (it) => !!it && (it.kind === "weapon" || it.kind === "armor" || it.kind === "shield");
export const battleItem = (id) => { const it = itemOf(id); return it && !isGear(it) ? it : null; };
// equipaggiamento dell'eroe con gli oggetti risolti (per heroDefense / heroAc di segreteKits)
export function heroGear(hero = {}, cls) {
  const wi = itemOf(hero?.weaponItem);
  const validWeapon = wi?.kind === "weapon" && (WEAPON_CHOICES[cls] || []).includes(wi.base);
  return { armor: hero?.armor, shield: hero?.shield, weapon: weaponOf(cls, validWeapon ? wi.base : hero?.weapon).key, armorItem: itemOf(hero?.armorItem), shieldItem: itemOf(hero?.shieldItem) };
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
  if (it.kind === "cleanse_party") return null;
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
    const w = RARITY[it.rarity].w * (boost[it.rarity] || 1) * ((ctx.favored || []).includes(id) ? 3 : 1);
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

/* ═══ OGGETTI CREATI DAL MASTER (2026-11-08) ═══════════════════
   Si creano nell'admin delle Segrete (piega «⚔ Oggetti») e stanno in segrete_items/{id}
   (id con il prefisso CUSTOM_PREFIX). Hanno lo STESSO formato degli oggetti qui sopra, quindi
   il motore li usa come gli altri: armi (base + plus + fx al colpo), armature e scudi (plus,
   resistenze, +TS, spine) e oggetti da lotta. Il sito li unisce a ITEMS con registerCustomItems
   (utils/segreteItemsLive.js), il server lo fa a ogni chiamata di segreteDo. `look` = aspetto
   in inglese per gli sprite (armi in mano, maniche e guanti delle armature in prima persona). */
export const CUSTOM_PREFIX = "x_";
export const DMG_KEYS = ["slashing", "piercing", "bludgeoning", "fire", "cold", "lightning", "thunder", "acid", "poison", "necrotic", "radiant", "force", "psychic"];
export const ITEM_KINDS = {
  weapon: { it: "Arma", icon: "⚔" },
  armor: { it: "Armatura / veste", icon: "🛡" },
  shield: { it: "Scudo", icon: "🛡" },
  heal: { it: "Cura", icon: "🧪" },
  revive: { it: "Rianima", icon: "🪶" },
  cleanse: { it: "Purifica un alleato", icon: "🌿" },
  cleanse_party: { it: "Purifica il gruppo", icon: "💧" },
  panacea: { it: "Panacea (tutti gli stati)", icon: "✨" },
  buff: { it: "Potenziamento", icon: "🦸" },
  throw: { it: "Da lancio (un nemico)", icon: "🔥" },
  throw_area: { it: "Da lancio (tutti i nemici)", icon: "💥" },
};
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d; };
const dice = (v, d = "1d6") => { const m = /^(\d{1,2})d(4|6|8|10|12|20)$/.exec(String(v || "").trim()); return m ? `${Math.min(10, +m[1])}d${m[2]}` : d; };
const dmgK = (v, d = "fire") => (DMG_KEYS.includes(v) ? v : d);
const str = (v, n) => String(v || "").trim().slice(0, n);
const dmgList = (v) => [...new Set((Array.isArray(v) ? v : []).filter((k) => DMG_KEYS.includes(k)))];
const thornsOf = (t) => (t && Number(t.chance) > 0 ? { chance: num(t.chance, 5, 100, 25), dice: dice(t.dice, "1d4"), dmg: dmgK(t.dmg, "bludgeoning") } : null);
// un oggetto creato dal Master → formato di ITEMS (null se non valido). Usato da admin, sito e server.
export function normalizeCustomItem(d = {}) {
  const kind = ITEM_KINDS[d.kind] ? d.kind : null;
  if (!kind) return null;
  const it = {
    name: str(d.name, 60) || "Oggetto senza nome", icon: str(d.icon, 8) || ITEM_KINDS[kind].icon, kind, custom: true,
    rarity: RARITY[d.rarity] ? d.rarity : "uncommon", desc: str(d.desc, 300),
    price: num(d.price, 0, 100000, 0), daily: num(d.daily, 1, 10, 1),
    ...(Array.isArray(d.dungeons) && d.dungeons.length ? { dungeons: d.dungeons.map((x) => str(x, 40)).filter(Boolean) } : {}),
    ...(DIFF_RANK[d.minDiff] ? { minDiff: d.minDiff } : {}),
    ...(str(d.look, 600) ? { look: str(d.look, 600) } : {}),
  };
  if (kind === "weapon") {
    if (!WEAPONS[d.base]) return null;
    it.base = d.base; it.plus = num(d.plus, 0, 3, 0); it.special = true;
    const f = d.fx || {}, fx = {};
    if (f.extra?.[0]) fx.extra = [dice(f.extra[0], "1d4"), dmgK(f.extra[1])];
    for (const k of ["burn", "poison"]) if (f[k] && Number(f[k].chance) > 0) fx[k] = { chance: num(f[k].chance, 5, 100, 20), dice: dice(f[k].dice, "1d4"), turns: num(f[k].turns, 1, 4, 2) };
    if (f.slow && Number(f.slow.chance) > 0) fx.slow = { chance: num(f.slow.chance, 5, 100, 25), turns: num(f.slow.turns, 1, 3, 1) };
    if (f.stun && Number(f.stun.chance) > 0) fx.stun = { chance: num(f.stun.chance, 5, 50, 10) };
    if (fx.extra && Number(f.drain) > 0) fx.drain = num(f.drain, 10, 100, 50);
    if (Number(f.crit) >= 17 && Number(f.crit) <= 19) fx.crit = num(f.crit, 17, 19, 19);
    if (f.multi && (Number(f.multi.double) > 0)) fx.multi = { double: num(f.multi.double, 5, 50, 20), none: num(f.multi.none, 0, 30, 0) };
    if (Object.keys(fx).length) it.fx = fx;
  } else if (kind === "armor" || kind === "shield") {
    if (kind === "armor") { if (!ARMORS[d.base]) return null; it.base = d.base; }
    it.plus = num(d.plus, 0, 3, 0);
    const res = dmgList(d.res); if (res.length) it.res = res;
    if (Number(d.saveBonus) > 0) it.saveBonus = num(d.saveBonus, 1, 3, 1);
    const th = thornsOf(d.thorns); if (th) it.thorns = th;
  } else if (kind === "heal") { it.dice = dice(d.dice, "2d4"); it.flat = num(d.flat, 0, 50, 0); }
  else if (kind === "revive") it.pct = num(d.pct, 10, 100, 50);
  else if (kind === "buff") { it.buff = d.buff === "adv" ? "adv" : "ac"; if (it.buff === "ac") it.value = num(d.value, 1, 5, 2); it.turns = num(d.turns, 1, 5, 2); }
  else if (kind === "throw") { it.dice = dice(d.dice, "2d6"); it.dmg = dmgK(d.dmg); }
  else if (kind === "throw_area") { it.dice = dice(d.dice, "2d6"); it.dmg = dmgK(d.dmg); it.save = ["str", "dex", "con", "int", "wis", "cha"].includes(d.save) ? d.save : "dex"; it.dc = num(d.dc, 8, 22, 13); }
  return it;
}
// unisce gli oggetti del Master a ITEMS (e alla bottega). Si può chiamare più volte: toglie quelli spariti.
let customIds = [];
export function registerCustomItems(list = []) {
  customIds.forEach((id) => { delete ITEMS[id]; });
  customIds = [];
  list.forEach((d) => {
    if (!d?.id || !String(d.id).startsWith(CUSTOM_PREFIX) || d.hidden) return;
    const it = normalizeCustomItem(d);
    if (it) { ITEMS[d.id] = it; customIds.push(d.id); }
  });
  SHOP_ITEMS.splice(0, SHOP_ITEMS.length, ...Object.keys(ITEMS).filter((id) => ITEMS[id].price > 0));
  return customIds.length;
}
