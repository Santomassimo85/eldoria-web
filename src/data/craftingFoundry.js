// ── Dall'oggetto del manuale al form "Crea Oggetto → Foundry" ────────────────
// L'Officina tira sulle tabelle d12 del manuale (src/data/crafting.js): da lì
// escono solo [nome, descrizione]. Qui si ricavano TUTTI i campi che il form
// del Master (FoundryItemForm) manda in `foundry_inbox`: tipo dnd5e, rarità,
// prezzo, peso, danno/attacco per le armi (valori SRD), CA per le armature,
// proprietà… così l'oggetto creato dal giocatore arriva su Foundry "da manuale".

import { PREGIATURE, normTier } from "./crafting";
import { componentByKey, craftTimeLabel, fmtMo, roundMo } from "./craftingTime";
import { itemMech } from "./craftingCatalogo";

// Rarità dnd5e e valore (mo) dell'oggetto su Foundry per pregiatura: sopra il
// costo fisso dei materiali del manuale (50 · 500 · 3.000 · 10.000 mo).
export const TIER_TO_FOUNDRY = {
  scarso:    { rarity: "common",    price: 20 },
  common:    { rarity: "common",    price: 75 },
  uncommon:  { rarity: "uncommon",  price: 750 },
  rare:      { rarity: "rare",      price: 4500 },
  veryRare:  { rarity: "veryRare",  price: 15000 },
  legendary: { rarity: "legendary", price: 40000 },
};

// ── Valore di vendita deciso dal TIRO (2026-10-27) ──────────────────────────
// Prima il valore era fisso per rarità USCITA mentre la spesa è della rarità
// MIRATA (più l'investimento): bastava mancare di una fascia per vendere
// sotto costo. Ora il valore parte da quanto costano i materiali della prova
// (listino della mirata con l'investimento, prima dello sconto del 20
// naturale) e il tiro lo moltiplica: centrare la rarità rende sempre più di
// quanto si è speso, e più il totale supera la soglia, più l'oggetto vale.
// Mancarla è una perdita. Sotto non si va mai sotto `TIER_TO_FOUNDRY[uscita]`.
const TIER_MIN_TOTAL = { common: 6, uncommon: 11, rare: 16, veryRare: 21, legendary: 26 };
export const CRAFT_VALUE_SCALE = [
  { key: "nat20",  mult: 2.5,  label: "20 naturale" },
  { key: "top",    mult: 2,    label: "centrata, 4+ sopra la soglia" },
  { key: "good",   mult: 1.75, label: "centrata, 2–3 sopra la soglia" },
  { key: "hit",    mult: 1.5,  label: "centrata di misura" },
  { key: "miss1",  mult: 0.9,  label: "una rarità sotto" },
  { key: "miss2",  mult: 0.6,  label: "due o più rarità sotto" },
  { key: "scarso", mult: 0.35, label: "Scarso" },
  { key: "nat1",   mult: 0.25, label: "1 naturale" },
];
const SCALE_BY_KEY = Object.fromEntries(CRAFT_VALUE_SCALE.map((s) => [s.key, s]));

// Gradino della scala per un esito. `tier` = rarità uscita, `total` = totale del d20.
export function craftValueStep({ targetTier, tier, total, nat20 = false, fumble = false }) {
  const target = normTier(targetTier);
  const out = normTier(tier);
  if (fumble) return SCALE_BY_KEY.nat1;
  if (nat20) return SCALE_BY_KEY.nat20;
  if (out === "scarso") return SCALE_BY_KEY.scarso;
  const order = PREGIATURE.map((p) => p.key);
  const dist = order.indexOf(target) - order.indexOf(out);
  if (dist >= 2) return SCALE_BY_KEY.miss2;
  if (dist === 1) return SCALE_BY_KEY.miss1;
  // Centrata (anche con l'Opera Definitiva, che la impone col totale basso).
  const margin = (Number(total) || 0) - (TIER_MIN_TOTAL[target] || 0);
  return margin >= 4 ? SCALE_BY_KEY.top : margin >= 2 ? SCALE_BY_KEY.good : SCALE_BY_KEY.hit;
}

// Valore in mo: costo dei materiali × gradino, mai sotto il valore base della rarità uscita.
export function craftSaleValue({ costMo, tier, ...rest }) {
  const step = craftValueStep({ tier, ...rest });
  const floor = (TIER_TO_FOUNDRY[normTier(tier)] || TIER_TO_FOUNDRY.common).price;
  return { price: Math.max(floor, roundMo((Number(costMo) || 0) * step.mult)), step };
}

// Tipo dnd5e "di casa" per ogni professione (quando il nome non dice altro).
const PROF_DEFAULT_TYPE = {
  fabbro: "equipment", alchimista: "consumable", intagliatore: "loot", sarto: "equipment",
  erborista: "consumable", cuoco: "consumable", ingegnere: "loot", cartografo: "loot",
  gioielliere: "equipment", incantatore: "consumable",
};

// ── Armi SRD (prima parola-chiave che combacia, in ordine) ──────────────────
// [chiavi nel nome, danno, tipo, versatile, proprietà, peso lb, mischia/distanza]
const WEAPONS = [
  [["spadone"],                       "2d6",  "slashing",    "",     ["hvy", "two"],        6,  "mwak"],
  [["spada corta", "scimitarra"],     "1d6",  "slashing",    "",     ["fin", "lgt"],        3,  "mwak"],
  [["spada lunga", "lama", "spada del", "spada di", "spada"], "1d8", "slashing", "1d10", ["ver"], 3, "mwak"],
  [["stocco"],                        "1d8",  "piercing",    "",     ["fin"],               2,  "mwak"],
  [["pugnale", "daga"],               "1d4",  "piercing",    "",     ["fin", "lgt", "thr"], 1,  "mwak"],
  [["martello da guerra", "martello del", "martello dell", "martello dei"], "1d8", "bludgeoning", "1d10", ["ver"], 2, "mwak"],
  [["martello"],                      "1d4",  "bludgeoning", "",     ["lgt", "thr"],        2,  "mwak"],
  [["maglio"],                        "2d6",  "bludgeoning", "",     ["hvy", "two"],        10, "mwak"],
  [["mazza"],                         "1d6",  "bludgeoning", "",     [],                    4,  "mwak"],
  [["ascia bipenne"],                 "1d12", "slashing",    "",     ["hvy", "two"],        7,  "mwak"],
  [["ascia da battaglia", "ascia del", "ascia dell"], "1d8", "slashing", "1d10", ["ver"],  4,  "mwak"],
  [["ascia"],                         "1d6",  "slashing",    "",     ["lgt", "thr"],        2,  "mwak"],
  [["alabarda", "falcione"],          "1d10", "slashing",    "",     ["hvy", "rch", "two"], 6,  "mwak"],
  [["picca", "luccio"],               "1d10", "piercing",    "",     ["hvy", "rch", "two"], 18, "mwak"],
  [["lancia", "punta di lancia"],     "1d6",  "piercing",    "1d8",  ["thr"],               3,  "mwak"],
  [["tridente"],                      "1d6",  "piercing",    "1d8",  ["thr"],               4,  "mwak"],
  [["flagello", "catena"],            "1d8",  "bludgeoning", "",     [],                    2,  "mwak"],
  [["frusta"],                        "1d4",  "slashing",    "",     ["fin", "rch"],        3,  "mwak"],
  [["spuntoni"],                      "1d4",  "piercing",    "",     ["lgt"],               1,  "mwak"],
  [["balestra pesante"],              "1d10", "piercing",    "",     ["amm", "hvy", "two"], 18, "rwak"],
  [["balestra a mano"],               "1d6",  "piercing",    "",     ["amm", "lgt"],        3,  "rwak"],
  [["balestra"],                      "1d8",  "piercing",    "",     ["amm", "two"],        5,  "rwak"],
  [["arco lungo", "arco imperiale", "arco della"],  "1d8",  "piercing",    "",     ["amm", "hvy", "two"], 2,  "rwak"],
  [["arco corto", "arco"],            "1d6",  "piercing",    "",     ["amm", "two"],        2,  "rwak"],
  [["bastone", "staffa"],             "1d6",  "bludgeoning", "1d8",  ["ver"],               4,  "mwak"],
];

// ── Armature SRD ────────────────────────────────────────────────────────────
// [chiavi, tipo, CA, peso]
const ARMORS = [
  [["mezza armatura"],               "medium", 15, 40],
  [["armatura completa", "armatura di piastre", "corazza di piastre", "armatura del", "armatura in"], "heavy", 18, 65],
  [["cotta di maglia", "corazza runica", "corazza"], "heavy", 16, 55],
  [["armatura pesante"],              "heavy",  16, 55],
  [["cuoio borchiato"],               "light",  12, 13],
  [["armatura di cuoio", "cuoio"],    "light",  11, 10],
  [["armatura difettosa", "armatura"],"medium", 14, 20],
  [["scudo"],                         "shield", 2,  6],
];

// Oggetti da indossare senza CA (vesti, mantelli, anelli…): equipment "trinket".
const WEARABLE = ["veste", "abito", "mantello", "stivali", "guanti", "guanto", "cintura", "cappello", "cappuccio", "sciarpa", "tunica", "calze", "elmo", "diadema", "corona", "anello", "collana", "braccial", "orecchin", "pendente", "spilla", "cammeo", "talismano", "monile", "gemma", "amuleto", "velo", "ferri da cavallo", "ferro dell", "zaino", "borsa"];
// Consumabili (pozioni, cibo, pergamene, munizioni…).
const CONSUMABLE = ["pozione", "elisir", "veleno", "siero", "acido", "antidoto", "sale", "inalante", "solvente", "profumo", "polvere", "boccetta", "bomba", "fuoco dell", "lacrime", "inchiostro", "mutazione", "unguento", "essenza", "esca", "rimedio", "attrattivo", "pomata", "tisana", "erbe", "erba", "tabacco", "filtro", "polline", "foglia", "bouquet", "cibo", "bevanda", "birra", "pasto", "liquore", "pane", "stufato", "dolce", "tè", "vino", "spezia", "razion", "piatto", "filetto", "banchetto", "torta", "idromele", "zuppa", "ambrosia", "distillato", "antitossina", "belladonna", "semi", "radice", "ghirlanda", "frecce", "dardi", "quadrell", "acido", "scroll", "pergamena", "proiettil", "oggetto monouso", "bacchetta", "sfera di luce", "runa", "glifo", "sigillo"];
// Strumenti (grimaldelli, utensili…).
const TOOLS = ["grimaldell", "utensile", "piede di porco", "strumento", "set di", "bussola", "cannocchiale", "lente", "orologio", "sveglia", "calcolatrice", "penne", "strumenti", "lira", "arpa", "pipa", "liuto", "mandolino", "rampino"];
// Libri, mappe, sigilli…: tesoro/varie anche per le professioni "da consumabile".
const LOOT = ["tomo", "grimorio", "libro", "diario", "mappa", "sigillo", "lettera", "bandiera", "stendardo", "codice", "cifrario", "genealogia", "carta", "atlante", "scrigno", "trono", "statua", "carro", "porta", "automa", "golem", "costrutto", "servo", "macchina", "occhio del cielo", "cuore di fuoco"];

const lc = (s) => String(s || "").toLowerCase();
// La chiave deve iniziare a inizio parola ("lancia" non deve combaciare con "bilanciato").
const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (name, keys) => keys.some((k) => new RegExp(`(^|[^a-zà-ÿ])${esc(k)}`).test(name));

// "Pugnale, Martello da Guerra o Lancia" → ["Pugnale", "Martello da Guerra", "Lancia"]
export function itemChoices(name) {
  const parts = String(name || "").split(/\s*(?:\/|,| o )\s*/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [String(name || "").trim()];
}

// "+1"/"+2" nel nome o nella descrizione (es. "Armatura di Piastre +1", "+1 CA").
function plusBonus(name, desc) {
  const m = /\+(\d)\b/.exec(name) || /\+(\d)\s*(?:ca|al colpire|ai tiri per colpire|attacco)/i.exec(desc || "");
  return m ? Number(m[1]) : 0;
}

// Riconoscimento del tipo dnd5e e dei dati meccanici da nome + professione.
export function classifyCraftedItem(profKey, name, desc = "") {
  const n = lc(name);
  const w = WEAPONS.find(([keys]) => has(n, keys));
  if (w && !has(n, ["ferri da cavallo", "grimaldell", "catena debole", "catena spezzapatti", "proiettil"])) {
    const [, dmg, dtype, ver, props, weight, action] = w;
    return { foundryType: "weapon", actionType: action, damageFormula: dmg, damageType: dtype, versatileFormula: ver, properties: [...props], weight };
  }
  const a = ARMORS.find(([keys]) => has(n, keys));
  if (a) {
    const [, armorType, ac, weight] = a;
    return { foundryType: "equipment", armorType, armorValue: ac, weight };
  }
  if (has(n, TOOLS)) return { foundryType: "tool", weight: 1 };
  if (has(n, LOOT)) return { foundryType: "loot", weight: 1 };
  if (has(n, CONSUMABLE)) return { foundryType: "consumable", weight: 0.5 };
  if (has(n, WEARABLE)) return { foundryType: "equipment", armorType: "", armorValue: 0, weight: 1 };
  return { foundryType: PROF_DEFAULT_TYPE[profKey] || "loot", weight: 1 };
}

// ── Potenziatori (lista BASE, 2026-09-19): oggetti che il PG deve POSSEDERE in gioco.
// Si applicano al momento della creazione e il Master li verifica sulla scheda.
// La lista crescerà: ogni voce dice a quali tipi si applica e cosa cambia nel payload.
export const ENHANCERS = [
  { key: "cristallo_fuoco",   icon: "🔥", name: "Cristallo Elementale di Fuoco",   applies: ["weapon"], aliases: ["cristallo di fuoco", "cristallo elementale (fuoco)", "fire crystal"],
    desc: "Incastonato nell'arma: +1d4 danni da fuoco.", effect: { damage2Formula: "1d4", damage2Type: "fire", properties: ["mgc"] } },
  { key: "cristallo_gelo",    icon: "❄", name: "Cristallo Elementale di Gelo",     applies: ["weapon"], aliases: ["cristallo di gelo", "cristallo di ghiaccio", "cristallo elementale (gelo)", "frost crystal"],
    desc: "Incastonato nell'arma: +1d4 danni da freddo.", effect: { damage2Formula: "1d4", damage2Type: "cold", properties: ["mgc"] } },
  { key: "cristallo_folgore", icon: "⚡", name: "Cristallo Elementale di Folgore",  applies: ["weapon"], aliases: ["cristallo di folgore", "cristallo di fulmine", "cristallo elementale (folgore)", "lightning crystal"],
    desc: "Incastonato nell'arma: +1d4 danni da fulmine.", effect: { damage2Formula: "1d4", damage2Type: "lightning", properties: ["mgc"] } },
  { key: "polvere_mithril",   icon: "✨", name: "Polvere di Mithril",              applies: ["weapon"], aliases: ["mithril", "mithral"],
    desc: "Lega leggera e affilata: +1 al colpire, l'arma conta come magica.", effect: { attackBonus: 1, properties: ["mgc"] } },
  { key: "scaglia_drago",     icon: "🐉", name: "Scaglia di Drago",                applies: ["equipment"], aliases: ["scaglia di drago", "scaglie di drago", "dragon scale"],
    desc: "Ribattuta nell'armatura: +1 alla CA.", effect: { armorValue: 1 } },
  { key: "filo_ombra",        icon: "🌑", name: "Filo d'Ombra",                    applies: ["equipment"], aliases: ["filo d'ombra", "filo dell'ombra", "shadow thread"],
    desc: "Cucito nelle vesti: vantaggio a Furtività finché lo indossi (nota per il Master).", effect: { descAppend: "Vantaggio alle prove di Destrezza (Furtività) mentre lo si indossa." } },
  { key: "lacrima_driade",    icon: "💧", name: "Lacrima di Driade",               applies: ["consumable"], aliases: ["lacrima di driade", "lacrime di driade", "dryad tear"],
    desc: "Sciolta nel preparato: l'effetto curativo o benefico aumenta di 1d4.", effect: { descAppend: "Preparato con Lacrima di Driade: +1d4 all'effetto curativo o benefico." } },
  { key: "cuore_arcanite",    icon: "💠", name: "Scheggia di Arcanite",            applies: ["weapon", "equipment", "consumable", "loot", "tool"], aliases: ["scheggia di arcanite", "arcanite grezza", "arcanite"],
    desc: "Il materiale leggendario di Exanthia: l'oggetto sale di una rarità su Foundry.", effect: { rarityUp: 1 } },
];

const RARITY_ORDER = ["common", "uncommon", "rare", "veryRare", "legendary", "artifact"];

// ── Verifica del possesso di un potenziatore ("deve essere posseduto in gioco").
// Tre prove valide, in quest'ordine:
//   1. scorta assegnata dal Master: `characters/{uid}.crafting.enhancers[key]` > 0 (si consuma all'uso);
//   2. l'oggetto è sulla scheda sincronizzata da Foundry (`characters.actions[].name`);
//   3. l'oggetto è stato comprato al Mercato Nero (`items` con isSold e buyerName = nome del PG).
// Il Master non ha bisogno di prove.
export function enhancerEvidence(enh, { charData, marketItems = [], isMaster = false } = {}) {
  if (!enh) return { ok: false, source: "", label: "" };
  if (isMaster) return { ok: true, source: "master", label: "Master" };
  const stock = Number(charData?.crafting?.enhancers?.[enh.key]) || 0;
  if (stock > 0) return { ok: true, source: "scorta", label: `assegnato dal Master (${stock})`, stock };
  const names = [enh.name, ...(enh.aliases || [])].map((x) => x.toLowerCase());
  const match = (n) => { const l = String(n || "").toLowerCase(); return names.some((a) => l.includes(a)); };
  const actions = Array.isArray(charData?.actions) ? charData.actions : [];
  const onSheet = actions.find((a) => match(a?.name));
  if (onSheet) return { ok: true, source: "scheda", label: `sulla scheda: ${onSheet.name}` };
  const me = String(charData?.name || "").trim().toLowerCase();
  const bought = me && marketItems.find((it) => it?.isSold && String(it.buyerName || "").trim().toLowerCase() === me && match(it.name));
  if (bought) return { ok: true, source: "mercato", label: `comprato al Mercato: ${bought.name}` };
  return { ok: false, source: "", label: "non risulta né sulla scheda né al Mercato: chiedi al Master di assegnartelo" };
}

// ── Resistenze a scelta (Cotta della Resistenza, Pozione di Resistenza…) ──
export const DAMAGE_TYPES_IT = [
  ["fire", "Fuoco"], ["cold", "Freddo"], ["lightning", "Fulmine"], ["acid", "Acido"], ["poison", "Veleno"],
  ["thunder", "Tuono"], ["necrotic", "Necrotico"], ["radiant", "Radioso"], ["force", "Forza"], ["psychic", "Psichico"],
];
const DMG_IT = Object.fromEntries(DAMAGE_TYPES_IT);

// ── Effetti attivi per Foundry (dnd5e): "ac+1", "res:fire", "str=21"… ──
// ADD = 2, UPGRADE = 4 (la caratteristica sale a N, mai scende).
function fxChanges(fx = []) {
  const out = [];
  for (const f of fx) {
    let m;
    if ((m = /^ac\+(\d+)$/.exec(f))) out.push({ key: "system.attributes.ac.bonus", mode: 2, value: `+${m[1]}` });
    else if ((m = /^save\+(\d+)$/.exec(f))) out.push({ key: "system.bonuses.abilities.save", mode: 2, value: `+${m[1]}` });
    else if ((m = /^spell\+(\d+)$/.exec(f))) { out.push({ key: "system.bonuses.msak.attack", mode: 2, value: `+${m[1]}` }); out.push({ key: "system.bonuses.rsak.attack", mode: 2, value: `+${m[1]}` }); }
    else if ((m = /^dc\+(\d+)$/.exec(f))) out.push({ key: "system.bonuses.spell.dc", mode: 2, value: `+${m[1]}` });
    else if ((m = /^res:(\w+)$/.exec(f))) out.push({ key: "system.traits.dr.value", mode: 2, value: m[1] });
    else if ((m = /^imm:(\w+)$/.exec(f))) out.push({ key: "system.traits.di.value", mode: 2, value: m[1] });
    else if ((m = /^(str|dex|con|int|wis|cha)=(\d+)$/.exec(f))) out.push({ key: `system.abilities.${m[1]}.value`, mode: 4, value: m[2] });
    else if ((m = /^(swim|fly|climb)=(\d+)$/.exec(f))) out.push({ key: `system.attributes.movement.${m[1]}`, mode: 4, value: m[2] });
  }
  return out;
}

// ── Payload per `foundry_inbox`: stessa forma del form del Master + i dati della prova.
// `resType` = resistenza scelta al ritiro (oggetti con `res: "choice"`).
// `crafter.level` ≥ 10 = Nome nel regno: firma nel nome e valore doppio.
// `sale` = { targetTier, total, nat20, fumble, costMo }: il valore lo decide il
// tiro (craftSaleValue). Senza, resta il valore fisso della rarità (prove vecchie).
export function craftedItemToFoundryPayload({ profession, tier: rawTier, name, desc, choice, enhancer, crafter, roll, note, work, components = [], upgraded = false, resType = "", sale = null }) {
  const tier = normTier(rawTier);
  const chosen = (choice || itemChoices(name)[0] || name).trim();
  // La meccanica Foundry della ricetta (craftingCatalogo.js), se c'è.
  const mech = itemMech(chosen) || itemMech(name) || null;
  const cls0 = classifyCraftedItem(profession.key, mech?.base || chosen, desc);
  const cls = mech?.type && mech.type !== cls0.foundryType
    ? { ...cls0, foundryType: mech.type, ...(mech.type === "equipment" && !cls0.armorType ? { armorType: "", armorValue: 0 } : {}) }
    : (mech?.ctype && cls0.foundryType !== "weapon" && cls0.foundryType !== "equipment" ? { ...cls0, foundryType: "consumable" } : cls0);
  const t = TIER_TO_FOUNDRY[tier] || TIER_TO_FOUNDRY.common;
  const tierMeta = PREGIATURE.find((p) => p.key === tier);
  const magic = ["uncommon", "rare", "veryRare", "legendary"].includes(tier);
  const plus = mech?.plus != null ? mech.plus : plusBonus(chosen, desc);
  const res = mech?.res === "choice" ? (DMG_IT[resType] ? resType : "") : "";
  let finalName = res ? `${chosen} (${DMG_IT[res]})` : chosen;

  let rarity = t.rarity;
  let properties = [...(cls.properties || [])];
  if (cls.foundryType === "weapon" && magic && !properties.includes("mgc")) properties.push("mgc");
  // +N delle armi: al colpire E ai danni (prima andava solo al colpire).
  let attackBonus = cls.foundryType === "weapon" ? plus : 0;
  let damageBonus = cls.foundryType === "weapon" ? plus : 0;
  let armorValue = cls.foundryType === "equipment" ? (cls.armorValue || 0) + (cls.armorType ? plus : 0) : 0;
  let damage2Formula = "", damage2Type = "";
  const extraDamage = [];
  if (mech?.extra && cls.foundryType === "weapon") extraDamage.push([mech.extra[0], mech.extra[1]]);
  const descParts = [desc || ""];

  if (enhancer && enhancer.applies.includes(cls.foundryType)) {
    const e = enhancer.effect || {};
    if (e.damage2Formula) { damage2Formula = e.damage2Formula; damage2Type = e.damage2Type || ""; }
    if (e.attackBonus) attackBonus += e.attackBonus;
    if (e.armorValue && cls.armorType) armorValue += e.armorValue;
    if (Array.isArray(e.properties) && cls.foundryType === "weapon") for (const p of e.properties) if (!properties.includes(p)) properties.push(p);
    if (e.rarityUp) rarity = RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, RARITY_ORDER.indexOf(rarity) + e.rarityUp)];
    if (e.descAppend) descParts.push(e.descAppend);
    descParts.push(`Potenziato con ${enhancer.name} (${enhancer.desc})`);
  }

  // Componenti con effetto sull'oggetto: monete in più o nota "a scelta del DM".
  // Col tiro il "pregio" è già nel costo dei materiali (+50%): niente ×1,5 in più.
  const saleValue = sale && Number(sale.costMo) > 0 ? craftSaleValue({ ...sale, tier }) : null;
  let price = saleValue ? saleValue.price : t.price;

  // Materiali di pregio (+50% di spesa): l'oggetto esce MIGLIORATO.
  // Armi: +1 al colpire e ai danni, conta come magica. Armature/scudi: +1 alla CA.
  // Tutto il resto: nota per il DM (effetto di un grado più forte). Vale +50% anche sul prezzo.
  if (upgraded) {
    if (cls.foundryType === "weapon") {
      attackBonus += 1;
      if (cls.damageFormula) damageBonus += 1;
      if (!properties.includes("mgc")) properties.push("mgc");
      descParts.push("✦ Fattura superiore (materiali di pregio): +1 ai tiri per colpire e ai danni; l'arma conta come magica.");
    } else if (cls.foundryType === "equipment" && cls.armorType) {
      armorValue += 1;
      descParts.push("✦ Fattura superiore (materiali di pregio): +1 alla Classe Armatura.");
    } else {
      descParts.push("✦ Fattura superiore (materiali di pregio): l'effetto dell'oggetto è di un grado più forte — +1d4 all'effetto, durata doppia o bonus equivalente a scelta del DM.");
    }
    if (!saleValue) price = roundMo(price * 1.5);
  }
  for (const k of components) {
    const c = componentByKey(k);
    if (!c?.effect) continue;
    if (c.effect.price) price += c.effect.price;
    if (c.effect.dm) descParts.push(`${c.icon} ${c.name}: ${c.effect.label}.`);
  }

  // ── Meccanica dei consumabili e degli oggetti con usi/effetti ──
  const isCons = cls.foundryType === "consumable";
  let actionType = cls.foundryType === "weapon" ? (cls.actionType || "mwak") : "";
  let damageFormula = cls.damageFormula ? (damageBonus ? `${cls.damageFormula} + ${damageBonus}` : cls.damageFormula) : "";
  let damageType = cls.damageType || "slashing";
  if (mech && cls.foundryType !== "weapon") {
    if (mech.heal) { actionType = "heal"; damageFormula = mech.heal; damageType = "healing"; }
    else if (mech.temp) { actionType = "heal"; damageFormula = mech.temp; damageType = "temphp"; }
    else if (mech.dmg) { actionType = mech.save ? "save" : mech.ctype === "trinket" ? "rwak" : "other"; damageFormula = mech.dmg[0]; damageType = mech.dmg[1]; }
    else if (mech.save) actionType = "save";
    if (mech.dmg2) extraDamage.push([mech.dmg2[0], mech.dmg2[1]]);
  }
  const saveAbility = mech?.save ? mech.save[0] : "";
  const saveDC = mech?.save ? Number(mech.save[1]) || 0 : 0;
  const uses = mech?.uses
    ? { max: Number(mech.uses[0]) || 1, per: mech.uses[1] || "charges", recovery: mech.uses[2] || "" }
    : isCons ? { max: 1, per: "charges", recovery: "" } : null;
  // Effetti attivi: addosso finché lo porti (equipaggiamento) o da applicare
  // dalla scheda quando lo usi (consumabili).
  const fx = [...(mech?.fx || []), ...(res ? [`res:${res}`] : [])];
  const changes = fxChanges(fx);
  const effects = changes.length ? [{ name: finalName, changes, transfer: !isCons }] : [];

  // Nome nel regno (livello 10 della professione): la firma e il valore doppio.
  if (Number(crafter?.level) >= 10 && crafter?.name) {
    finalName = `${finalName} · firma di ${String(crafter.name).split(" ")[0]}`;
    price = roundMo(price * 2);
  }

  descParts.push(
    `— Creato nell'Officina da ${crafter.name} (${profession.name}, ${crafter.gradeName}). ` +
    `Rarità ${tierMeta?.label || tier}: d20 ${roll.d20} + ${roll.bonus} = ${roll.total}${roll.d12 ? `, d12 = ${roll.d12}` : ", oggetto scelto dal catalogo"}.` +
    (work ? ` Tempo di lavoro: ${craftTimeLabel(work)}.` : "") +
    (saleValue ? ` Valore: ${fmtMo(saleValue.price)} (${saleValue.step.label}, ×${String(saleValue.step.mult).replace(".", ",")} sul costo dei materiali).` : "") +
    (note ? ` Nota: ${note}` : "")
  );

  return {
    name: finalName,
    foundryType: cls.foundryType,
    rarity,
    description: descParts.filter(Boolean).join("\n"),
    img: "",
    price,
    weight: Number(cls.weight) || 0,
    quantity: 1,
    target: "player",
    targetUid: crafter.uid,
    targetName: crafter.name,
    actionType,
    damageFormula,
    damageType,
    damage2Formula,
    damage2Type,
    extraDamage: extraDamage.map(([formula, type]) => ({ formula, type })),
    versatileFormula: cls.versatileFormula ? (damageBonus ? `${cls.versatileFormula} + ${damageBonus}` : cls.versatileFormula) : "",
    attackBonus,
    proficient: true,
    properties: cls.foundryType === "weapon" ? properties : [],
    armorType: cls.foundryType === "equipment" ? (cls.armorType || "") : "",
    armorValue,
    saveAbility,
    saveDC,
    consumableType: isCons ? (mech?.ctype || "trinket") : "",
    uses,
    effects,
  };
}

// La ricetta ha una resistenza da scegliere al ritiro?
export const needsResChoice = (name, choice) => (itemMech((choice || itemChoices(name)[0] || name || "").trim()) || itemMech(name))?.res === "choice";

// ── Spesa dei materiali → coda per Foundry (2026-09-22) ─────────────────────
// Le monete dei materiali si pagano in gioco. Invece di ricordarselo a voce, la
// prova può finire in `foundry_inbox` come documento `kind: "gold"`: la macro
// "Crea Oggetti dal sito → Foundry" lo riconosce, toglie le monete dall'attore
// col flag `world.firebaseUID` giusto e cancella il documento.
// NB: i documenti degli OGGETTI non hanno `kind` (la macro li tratta come "item").
export function craftGoldPayload({ crafter, amount, tierLabel, itemName, components = [], failed = false, nat20 = false, note = "" }) {
  const what = failed ? "prova fallita" : itemName || tierLabel || "creazione";
  const bits = [
    `Officina · materiali per ${what}${tierLabel && !failed ? ` (${tierLabel})` : ""}`,
    components.length ? `Componenti consumati: ${components.join(", ")}` : "",
    nat20 ? "20 naturale: costo dimezzato, ha usato metà materiali" : "",
    failed ? "Fallimento critico: materiali perduti, nessun oggetto" : "",
    note,
  ].filter(Boolean);
  return {
    kind: "gold",
    op: "subtract",
    currency: "gp",
    amount: Math.max(0, roundMo(amount)),
    name: `−${fmtMo(Math.max(0, roundMo(amount)))} · ${what}`,
    reason: bits.join(" · "),
    target: "player",
    targetUid: crafter.uid,
    targetName: crafter.name || "",
  };
}
