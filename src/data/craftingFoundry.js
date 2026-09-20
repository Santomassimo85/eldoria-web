// ── Dall'oggetto del manuale al form "Crea Oggetto → Foundry" ────────────────
// L'Officina tira sulle tabelle d12 del manuale (src/data/crafting.js): da lì
// escono solo [nome, descrizione]. Qui si ricavano TUTTI i campi che il form
// del Master (FoundryItemForm) manda in `foundry_inbox`: tipo dnd5e, rarità,
// prezzo, peso, danno/attacco per le armi (valori SRD), CA per le armature,
// proprietà… così l'oggetto creato dal giocatore arriva su Foundry "da manuale".

import { PREGIATURE } from "./crafting";
import { craftTimeLabel } from "./craftingTime";

// Rarità dnd5e e valore (mo) dell'oggetto su Foundry per pregiatura: sopra il
// costo fisso dei materiali del manuale (50 · 500 · 3.000 · 10.000 mo).
export const TIER_TO_FOUNDRY = {
  scarso:   { rarity: "common",    price: 20 },
  comune:   { rarity: "common",    price: 75 },
  raro:     { rarity: "uncommon",  price: 750 },
  magico:   { rarity: "rare",      price: 4500 },
  perfetto: { rarity: "legendary", price: 15000 },
};

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
  [["martello da guerra", "martello del", "martello dell"], "1d8", "bludgeoning", "1d10", ["ver"], 2, "mwak"],
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
  [["arco lungo", "arco imperiale"],  "1d8",  "piercing",    "",     ["amm", "hvy", "two"], 2,  "rwak"],
  [["arco corto", "arco"],            "1d6",  "piercing",    "",     ["amm", "two"],        2,  "rwak"],
  [["bastone", "staffa"],             "1d6",  "bludgeoning", "1d8",  ["ver"],               4,  "mwak"],
];

// ── Armature SRD ────────────────────────────────────────────────────────────
// [chiavi, tipo, CA, peso]
const ARMORS = [
  [["armatura completa", "armatura di piastre", "corazza di piastre", "armatura del", "armatura in"], "heavy", 18, 65],
  [["cotta di maglia", "corazza runica", "corazza"], "heavy", 16, 55],
  [["armatura pesante"],              "heavy",  16, 55],
  [["cuoio borchiato"],               "light",  12, 13],
  [["armatura di cuoio", "cuoio"],    "light",  11, 10],
  [["armatura difettosa", "armatura"],"medium", 14, 20],
  [["scudo"],                         "shield", 2,  6],
];

// Oggetti da indossare senza CA (vesti, mantelli, anelli…): equipment "trinket".
const WEARABLE = ["veste", "abito", "mantello", "stivali", "guanti", "cintura", "cappello", "cappuccio", "sciarpa", "tunica", "calze", "elmo", "diadema", "anello", "collana", "bracciale", "orecchin", "pendente", "spilla", "cammeo", "talismano", "monile", "gemma", "amuleto", "velo", "ferri da cavallo", "ferro dell"];
// Consumabili (pozioni, cibo, pergamene, munizioni…).
const CONSUMABLE = ["pozione", "elisir", "veleno", "siero", "acido", "antidoto", "sale", "inalante", "solvente", "profumo", "polvere", "boccetta", "bomba", "fuoco dell", "lacrime", "inchiostro", "mutazione", "unguento", "essenza", "esca", "rimedio", "attrattivo", "pomata", "tisana", "erbe", "erba", "tabacco", "filtro", "polline", "foglia", "bouquet", "cibo", "bevanda", "birra", "pasto", "liquore", "pane", "stufato", "dolce", "tè", "vino", "spezia", "razione", "piatto", "filetto", "banchetto", "scroll", "pergamena", "proiettil", "oggetto monouso", "bacchetta", "sfera di luce", "runa", "glifo", "sigillo"];
// Strumenti (grimaldelli, utensili…).
const TOOLS = ["grimaldell", "utensile", "piede di porco", "strumento", "set di", "bussola", "cannocchiale", "lente", "orologio", "sveglia", "calcolatrice", "penne", "lira", "arpa", "pipa"];

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

// ── Payload per `foundry_inbox`: stessa forma del form del Master + i dati della prova.
export function craftedItemToFoundryPayload({ profession, tier, name, desc, choice, enhancer, crafter, roll, note, work }) {
  const finalName = (choice || itemChoices(name)[0] || name).trim();
  const cls = classifyCraftedItem(profession.key, finalName, desc);
  const t = TIER_TO_FOUNDRY[tier] || TIER_TO_FOUNDRY.comune;
  const tierMeta = PREGIATURE.find((p) => p.key === tier);
  const magic = tier === "raro" || tier === "magico" || tier === "perfetto";
  const plus = plusBonus(finalName, desc);

  let rarity = t.rarity;
  let properties = [...(cls.properties || [])];
  if (cls.foundryType === "weapon" && magic && !properties.includes("mgc")) properties.push("mgc");
  let attackBonus = cls.foundryType === "weapon" ? plus : 0;
  let armorValue = cls.foundryType === "equipment" ? (cls.armorValue || 0) + (cls.armorType ? plus : 0) : 0;
  let damage2Formula = "", damage2Type = "";
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

  descParts.push(
    `— Creato nell'Officina da ${crafter.name} (${profession.name}, ${crafter.gradeName}). ` +
    `Pregiatura ${tierMeta?.label || tier}: d20 ${roll.d20} + ${roll.bonus} = ${roll.total}, d12 = ${roll.d12}.` +
    (work ? ` Tempo di lavoro: ${craftTimeLabel(work)}.` : "") +
    (note ? ` Nota: ${note}` : "")
  );

  return {
    name: finalName,
    foundryType: cls.foundryType,
    rarity,
    description: descParts.filter(Boolean).join("\n"),
    img: "",
    price: t.price,
    weight: Number(cls.weight) || 0,
    quantity: 1,
    target: "player",
    targetUid: crafter.uid,
    targetName: crafter.name,
    actionType: cls.foundryType === "weapon" ? (cls.actionType || "mwak") : "",
    damageFormula: cls.damageFormula || "",
    damageType: cls.damageType || "slashing",
    damage2Formula,
    damage2Type,
    versatileFormula: cls.versatileFormula || "",
    attackBonus,
    proficient: true,
    properties: cls.foundryType === "weapon" ? properties : [],
    armorType: cls.foundryType === "equipment" ? (cls.armorType || "") : "",
    armorValue,
    saveAbility: "",
    saveDC: 0,
  };
}
