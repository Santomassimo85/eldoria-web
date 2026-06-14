/* ============================================================
   Mappa Mercato → Foundry — sorgente UNICA condivisa.
   Gli oggetti del Mercato (`items`) portano un sotto-oggetto
   facoltativo `foundry` con i dati di combattimento. Da qui si
   costruisce il payload per `foundry_inbox` (la macro su Foundry
   lo legge e crea l'Item dnd5e). Nessun dato qui è visibile ai
   player: il Mercato lato giocatore non legge `foundry`.
   ============================================================ */

// Tipo Mercato (IT) → foundryType dnd5e
export const TYPE_TO_FOUNDRY = {
  "Arma": "weapon",
  "Armatura": "equipment",
  "Accessori": "equipment",
  "Artefatto Magico": "equipment",
  "Pozioni": "consumable",
  "Pergamene": "consumable",
  "Reagenti": "loot",
  "Varie": "loot",
  "Pacchetto Carte": "loot",
  "Carta TCG": "loot",
};

// Rarità Mercato (IT) → rarity dnd5e
export const RARITY_TO_FOUNDRY = {
  "Comune": "common",
  "Non comune": "uncommon",
  "Rara": "rare",
  "Molto rara": "veryRare",
  "Leggendaria": "legendary",
  "Artefatto": "artifact",
};

// Liste opzioni (condivise con i form)
export const FOUNDRY_TYPES = [
  { v: "weapon", label: "Arma" },
  { v: "equipment", label: "Armatura / Equipaggiamento" },
  { v: "consumable", label: "Consumabile (pozione, pergamena)" },
  { v: "loot", label: "Tesoro / Varie" },
  { v: "tool", label: "Strumento" },
];
export const FOUNDRY_DAMAGE_TYPES = ["slashing", "piercing", "bludgeoning", "fire", "cold", "lightning", "thunder", "acid", "poison", "necrotic", "radiant", "psychic", "force"];
export const FOUNDRY_ACTION_TYPES = [
  { v: "", label: "Nessuno (passivo)" },
  { v: "mwak", label: "Arma da mischia" },
  { v: "rwak", label: "Arma a distanza" },
  { v: "msak", label: "Incantesimo da mischia" },
  { v: "rsak", label: "Incantesimo a distanza" },
  { v: "save", label: "Solo Tiro Salvezza" },
];
export const FOUNDRY_WEAPON_PROPS = [
  { v: "fin", label: "Finezza" }, { v: "ver", label: "Versatile" }, { v: "two", label: "Due mani" },
  { v: "thr", label: "Da lancio" }, { v: "lgt", label: "Leggera" }, { v: "hvy", label: "Pesante" },
  { v: "rch", label: "Portata" }, { v: "amm", label: "Munizioni" }, { v: "mgc", label: "Magica" },
];
export const FOUNDRY_ARMOR_TYPES = [
  { v: "", label: "—" }, { v: "light", label: "Leggera" }, { v: "medium", label: "Media" },
  { v: "heavy", label: "Pesante" }, { v: "shield", label: "Scudo" },
];
export const FOUNDRY_ABILITIES = ["", "str", "dex", "con", "int", "wis", "cha"];

// Sotto-oggetto `foundry` vuoto (dati di combattimento facoltativi).
export const EMPTY_FOUNDRY = {
  foundryType: "",          // "" = automatico dal Tipo del Mercato
  weight: "", quantity: 1,
  actionType: "mwak",
  damageFormula: "", damageType: "slashing",
  damage2Formula: "", damage2Type: "",
  versatileFormula: "",
  attackBonus: "", proficient: true,
  properties: [],
  armorType: "", armorValue: "",
  saveAbility: "", saveDC: "",
};

export const resolveFoundryType = (item) =>
  (item?.foundry?.foundryType) || TYPE_TO_FOUNDRY[item?.type] || "loot";

export const resolveFoundryRarity = (item) =>
  RARITY_TO_FOUNDRY[item?.class] || "common";

/* Quanto è "pronto" per l'import in un clic:
   - le armi senza formula di danno restano da completare
   - tutto il resto è importabile direttamente. */
export const foundryReadiness = (item) => {
  const ftype = resolveFoundryType(item);
  if (ftype === "weapon" && !(item?.foundry?.damageFormula || "").trim()) {
    return { ready: false, reason: "Arma senza formula di danno" };
  }
  return { ready: true, reason: "" };
};

/* Payload per `foundry_inbox` (senza status/createdAt/createdBy:
   li aggiunge chi scrive il documento). Stessa forma del form manuale. */
export const marketItemToFoundryPayload = (item, dest = {}) => {
  const f = item?.foundry || {};
  const ftype = resolveFoundryType(item);
  const target = dest.target || "world";
  return {
    name: (item?.name || "").trim(),
    foundryType: ftype,
    rarity: resolveFoundryRarity(item),
    description: item?.description || "",
    img: (item?.img || "").trim(),
    price: Number(item?.startingBid ?? item?.price ?? 0) || 0,
    weight: Number(f.weight) || 0,
    quantity: Number(f.quantity) || 1,
    target,
    targetUid: target === "player" ? (dest.targetUid || "") : "",
    targetName: target === "player" ? (dest.targetName || "") : "",
    actionType: (ftype === "weapon" || ftype === "consumable") ? (f.actionType || "") : "",
    damageFormula: (f.damageFormula || "").trim(),
    damageType: f.damageType || "slashing",
    damage2Formula: (f.damage2Formula || "").trim(),
    damage2Type: f.damage2Type || "",
    versatileFormula: (f.versatileFormula || "").trim(),
    attackBonus: (f.attackBonus === "" || f.attackBonus == null) ? 0 : Number(f.attackBonus) || 0,
    proficient: f.proficient !== false,
    properties: ftype === "weapon" ? (Array.isArray(f.properties) ? f.properties : []) : [],
    armorType: ftype === "equipment" ? (f.armorType || "") : "",
    armorValue: ftype === "equipment" ? (Number(f.armorValue) || 0) : 0,
    saveAbility: f.saveAbility || "",
    saveDC: (f.saveDC === "" || f.saveDC == null) ? 0 : Number(f.saveDC) || 0,
  };
};

/* Mappa un item del Mercato nello stato del form di FoundryItemForm
   (per il pulsante "Compila" → revisione prima della coda). */
export const marketItemToFormState = (item) => {
  const f = item?.foundry || {};
  return {
    name: item?.name || "",
    foundryType: resolveFoundryType(item),
    rarity: resolveFoundryRarity(item),
    description: item?.description || "",
    img: item?.img || "",
    price: String(item?.startingBid ?? item?.price ?? ""),
    weight: f.weight ?? "",
    quantity: f.quantity ?? 1,
    target: "world", targetUid: "", targetName: "",
    actionType: f.actionType || "mwak",
    damageFormula: f.damageFormula || "",
    damageType: f.damageType || "slashing",
    damage2Formula: f.damage2Formula || "",
    damage2Type: f.damage2Type || "",
    versatileFormula: f.versatileFormula || "",
    attackBonus: f.attackBonus ?? "",
    proficient: f.proficient !== false,
    properties: Array.isArray(f.properties) ? f.properties : [],
    armorType: f.armorType || "",
    armorValue: f.armorValue ?? "",
    saveAbility: f.saveAbility || "",
    saveDC: f.saveDC ?? "",
  };
};
