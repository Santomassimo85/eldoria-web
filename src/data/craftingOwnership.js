// ── Possesso di strumenti e componenti (l'Officina) ─────────────────────────
// I giocatori possono usare gli strumenti della professione e i componenti
// SOLO se li hanno davvero. Tre prove valide, in quest'ordine:
//   1. scorta assegnata dal Master (`characters/{uid}.crafting.components[key]`);
//   2. la scheda sincronizzata da Foundry: `characters.inventory[]` (strumenti,
//      consumabili, tesori: li manda la macro src/foundry-macro-sync.txt) e
//      `characters.actions[]` (armi, equipaggiamento, talenti);
//   3. acquisti al Mercato Nero (`items` con isSold e buyerName = nome del PG).
// Il confronto è per PAROLE CHIAVE (italiano e inglese, apostrofi normalizzati):
// basta che il nome dell'oggetto su Foundry contenga uno degli alias.
// Il Master non ha bisogno di prove.

import { COMPONENTS } from "./craftingTime";

// Nomi (o pezzi di nome) degli strumenti di ogni professione, come compaiono
// negli oggetti dnd5e in italiano e in inglese.
export const PROFESSION_TOOLS = {
  fabbro:       { hint: "Strumenti da fabbro", aliases: ["strumenti da fabbro", "attrezzi da fabbro", "smith's tools", "smiths tools"] },
  alchimista:   { hint: "Materiali da alchimista", aliases: ["strumenti da alchimista", "materiali da alchimista", "alchemist's supplies", "alchemist supplies"] },
  intagliatore: { hint: "Strumenti da intagliatore o da falegname", aliases: ["strumenti da intagliatore", "strumenti da falegname", "strumenti da carpentiere", "woodcarver's tools", "carpenter's tools"] },
  sarto:        { hint: "Strumenti da tessitore o da conciatore", aliases: ["strumenti da tessitore", "strumenti da conciatore", "strumenti da sarto", "weaver's tools", "leatherworker's tools"] },
  erborista:    { hint: "Kit da erborista", aliases: ["kit da erborista", "borsa da erborista", "strumenti da erborista", "herbalism kit"] },
  cuoco:        { hint: "Utensili da cuoco o materiali da birraio", aliases: ["utensili da cuoco", "strumenti da cuoco", "materiali da birraio", "cook's utensils", "brewer's supplies"] },
  ingegnere:    { hint: "Strumenti da inventore o da fabbro", aliases: ["strumenti da inventore", "strumenti da fabbro", "tinker's tools", "smith's tools"] },
  cartografo:   { hint: "Strumenti da cartografo, da navigatore o da calligrafo", aliases: ["strumenti da cartografo", "strumenti da navigatore", "materiali da calligrafo", "cartographer's tools", "navigator's tools", "calligrapher's supplies"] },
  gioielliere:  { hint: "Strumenti da gioielliere", aliases: ["strumenti da gioielliere", "strumenti da orafo", "jeweler's tools", "jeweller's tools"] },
  incantatore:  { hint: "Materiali da calligrafo, focus arcano o libro degli incantesimi", aliases: ["materiali da calligrafo", "calligrapher's supplies", "focus arcano", "arcane focus", "libro degli incantesimi", "spellbook", "simbolo sacro", "holy symbol", "bacchetta", "wand", "bastone", "staff", "orb", "sfera arcana", "cristallo arcano"] },
};

// Normalizza per il confronto: minuscolo, apostrofi tipografici → ', spazi singoli.
export const normName = (s) => String(s || "").toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim();

// Tutto ciò che il PG possiede secondo la scheda e il Mercato: [{ name, qty, source }].
export function ownedItems(charData, marketItems = []) {
  const out = [];
  const inv = Array.isArray(charData?.inventory) ? charData.inventory : [];
  for (const it of inv) if (it?.name) out.push({ name: it.name, qty: Math.max(1, Number(it.quantity) || 1), source: "scheda" });
  const acts = Array.isArray(charData?.actions) ? charData.actions : [];
  for (const a of acts) if (a?.name && !inv.some((i) => normName(i?.name) === normName(a.name))) out.push({ name: a.name, qty: 1, source: "scheda" });
  const me = normName(charData?.name);
  if (me) for (const it of marketItems) if (it?.isSold && normName(it.buyerName) === me && it.name) out.push({ name: it.name, qty: Math.max(1, Number(it.quantity) || 1), source: "mercato" });
  return out;
}

// Cerca un oggetto posseduto il cui nome contenga uno degli alias.
export function findOwned(aliases, charData, marketItems = []) {
  const keys = (aliases || []).map(normName).filter(Boolean);
  const hits = ownedItems(charData, marketItems).filter((it) => { const n = normName(it.name); return keys.some((k) => n.includes(k)); });
  if (!hits.length) return { ok: false, qty: 0, label: "", source: "" };
  const qty = hits.reduce((a, h) => a + h.qty, 0);
  const first = hits[0];
  return { ok: true, qty, source: first.source, label: `${first.source === "mercato" ? "comprato al Mercato" : "sulla scheda"}: ${first.name}${hits.length > 1 ? ` (+${hits.length - 1})` : ""}` };
}

// Strumenti della professione: ok se sulla scheda/inventario o comprati; il Master sempre.
export function toolsEvidence(prof, { charData, marketItems = [], isMaster = false } = {}) {
  const def = PROFESSION_TOOLS[prof?.key] || { hint: "gli strumenti della professione", aliases: [] };
  if (isMaster) return { ok: true, source: "master", label: "Master", hint: def.hint };
  const f = findOwned(def.aliases, charData, marketItems);
  return { ...f, hint: def.hint, label: f.ok ? f.label : `non risultano sulla scheda: servono "${def.hint}" nell'inventario di Foundry (poi sincronizza) o comprati al Mercato` };
}

// Componente: scorta del Master (si consuma) → scheda/inventario → Mercato. `qty` = pezzi usabili.
export function componentEvidence(comp, { charData, marketItems = [], isMaster = false } = {}) {
  if (!comp) return { ok: false, qty: 0, label: "", source: "" };
  if (isMaster) return { ok: true, qty: Infinity, source: "master", label: "Master" };
  const stock = Number(charData?.crafting?.components?.[comp.key]) || 0;
  const f = findOwned([comp.name, ...(comp.aliases || [])], charData, marketItems);
  const qty = stock + (f.ok ? f.qty : 0);
  if (qty <= 0) return { ok: false, qty: 0, source: "", label: "non risulta: il Master lo assegna dopo la sessione o lo mette sulla scheda Foundry" };
  const bits = [];
  if (stock > 0) bits.push(`assegnato dal Master (${stock})`);
  if (f.ok) bits.push(f.label);
  return { ok: true, qty, stock, source: stock > 0 ? "scorta" : f.source, label: bits.join(" · ") };
}

export const componentDefs = () => COMPONENTS;
