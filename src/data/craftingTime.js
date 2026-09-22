// ── Tempo di lavoro dell'Officina (in tempo reale) ──────────────────────────
// Ogni prova di crafting ha un TEMPO FISSO, deciso prima del tiro e mai
// cambiato dal risultato del d20: la pregiatura a cui si punta dà la base,
// e la si abbrevia con gli strumenti, i componenti trovati in sessione,
// il Ritmo di bottega (livello 6)
// e il ritmo scelto (con calma = doppio tempo e +2 al tiro, di fretta = metà
// tempo e −3). Quanto si spende nei materiali (INVESTMENTS) cambia tiro, PE e
// qualità dell'oggetto, ma NON il tempo. Finché il lavoro non è finito l'oggetto resta "sul banco":
// si vede solo la barra del tempo. I limiti (1 al giorno, 3 a settimana)
// restano quelli di craftingWeek.js e si consumano all'inizio del lavoro.

// Base in minuti per rarità mirata (Scarso non si può mirare): 5 h · 8 h · 5 giorni · 7 giorni · 14 giorni.
import { normTier } from "./crafting";

export const CRAFT_BASE_MINUTES = { common: 300, uncommon: 480, rare: 5 * 1440, veryRare: 7 * 1440, legendary: 14 * 1440 };

// Strumenti della professione: −2 ore. Senza strumenti si tira con svantaggio.
export const TOOLS_MINUTES = 120;

// Tempo minimo di un lavoro, qualunque sconto si sommi.
export const CRAFT_MIN_MINUTES = 30;

// Componenti usabili in una sola prova.
export const MAX_COMPONENTS = 3;

// ── I 10 componenti base ────────────────────────────────────────────────────
// Oggetti solo descrittivi che il Master fa trovare in sessione e assegna dal
// pannello dell'Officina (`characters/{uid}.crafting.components[key]`). Non
// Ognuno accorcia il tempo di lavoro, dà +1d3 al tiro (COMPONENT_ROLL_DIE) e
// si consuma. Quattro hanno anche un effetto sull'oggetto creato (`effect`):
// `price` = monete in più al valore su Foundry; `dm` = nota "a scelta del DM"
// scritta nella descrizione dell'oggetto e nella coda del Master.
export const COMPONENT_ROLL_DIE = 3;
export const COMPONENTS = [
  { key: "quercia",   icon: "🪵", name: "Legno di Quercia Antica",     minutes: 30, aliases: ["quercia antica", "ancient oak"], desc: "Un ceppo stagionato cent'anni: non si spacca e prende forma senza sforzo." },
  { key: "ferro",     icon: "⛏", name: "Minerale di Ferro Puro",      minutes: 30, aliases: ["ferro puro", "minerale di ferro", "pure iron"], desc: "Ferro senza scorie, dalle vene profonde di Helmvil: fonde in metà del tempo." },
  { key: "seta",      icon: "🧵", name: "Filo di Seta di Ragno",       minutes: 30, aliases: ["seta di ragno", "spider silk"], desc: "Un gomitolo lucido e tenace: si cuce, si lega e si intreccia quasi da solo.", effect: { dm: "bonus al movimento", label: "Bonus al movimento (a scelta del DM)" } },
  { key: "lunaria",   icon: "🌿", name: "Erba Lunaria",                minutes: 30, aliases: ["lunaria", "moonwort"], desc: "Raccolta con la luna piena, già essiccata: pronta da pestare o infondere.", effect: { dm: "potenziamento notturno", label: "Potenziamento notturno (a scelta del DM)" } },
  { key: "carbone",   icon: "🔥", name: "Carbone Runico",              minutes: 45, aliases: ["carbone runico", "runic coal", "rune coal"], desc: "Brucia più caldo e più a lungo: la fucina o il fornello arrivano subito a temperatura." },
  { key: "sorgente",  icon: "💧", name: "Acqua di Sorgente Benedetta", minutes: 30, aliases: ["sorgente benedetta", "blessed spring"], desc: "Limpida e senza impurità: distillati, tinture e impasti non vanno filtrati." },
  { key: "osso",      icon: "🦴", name: "Osso di Bestia Antica",       minutes: 45, aliases: ["osso di bestia", "ancient beast bone", "beast bone"], desc: "Duro come pietra ma facile da incidere: ottimo per manici, intarsi e amuleti.", effect: { dm: "bonus di attacco", label: "Bonus di attacco (a scelta del DM)" } },
  { key: "sale",      icon: "🧂", name: "Sale delle Profondità",       minutes: 30, aliases: ["sale delle profondità", "deep salt"], desc: "Cristalli grigi delle miniere: conservano, fissano i colori e stabilizzano le miscele." },
  { key: "cera",      icon: "🕯", name: "Cera d'Api Titanica",         minutes: 45, aliases: ["cera titanica", "titan beeswax", "titanic beeswax"], desc: "Un panetto che non si scioglie al sole: per stampi, sigilli, lucidature e candele." },
  { key: "cristallo", icon: "💎", name: "Scheggia di Cristallo Grezzo", minutes: 60, aliases: ["cristallo grezzo", "raw crystal", "rough crystal"], desc: "Vibra piano se la si accosta a qualcosa d'incantato: accorda i materiali fra loro.", effect: { price: 500, label: "+500 mo al valore dell'oggetto" } },
];
// Etichetta breve dell'effetto extra di un componente ("" se non ne ha).
export const componentEffectLabel = (c) => c?.effect?.label || "";

// ── Investimento nei materiali (2026-09-22) ─────────────────────────────────
// Al posto del vecchio "aiutante" e della "qualità dei materiali": il giocatore
// decide QUANTO spende sopra il costo della rarità. Non cambia il tempo, solo
// il tiro, l'oggetto e i PE.
//   +20% → +2 al tiro e +5% di PE;
//   +50% → l'oggetto esce MIGLIORATO (craftedItemToFoundryPayload) e +10% di PE.
export const INVESTMENTS = [
  { key: "",       icon: "🪙", label: "Costo base",          costPct: 0,  roll: 0, xpPct: 0,  upgrade: false, desc: "Paghi solo i materiali della rarità." },
  { key: "extra",  icon: "🎯", label: "Materiali scelti",    costPct: 20, roll: 2, xpPct: 5,  upgrade: false, desc: "Spendi il 20% in più: +2 al tiro e +5% di PE." },
  { key: "pregio", icon: "💎", label: "Materiali di pregio", costPct: 50, roll: 0, xpPct: 10, upgrade: true,  desc: "Spendi il 50% in più: l'oggetto esce migliorato (stat o effetti superiori) e +10% di PE." },
];
export const investmentByKey = (k) => INVESTMENTS.find((i) => i.key === (k || "")) || INVESTMENTS[0];
// Costo dei materiali con l'investimento scelto, in monete d'oro.
export const investCostMo = (mo, inv) => Math.round((Number(mo) || 0) * (1 + (investmentByKey(inv?.key ?? inv).costPct) / 100));
// "3.000 mo"
export const fmtMo = (n) => `${new Intl.NumberFormat("it-IT").format(Math.round(Number(n) || 0))} mo`;
// PE della prova con l'investimento (arrotondati per eccesso: +5% di 10 = 11).
export const xpWithInvestment = (xp, inv) => { const i = investmentByKey(inv?.key ?? inv); return i.xpPct ? Math.ceil((Number(xp) || 0) * (1 + i.xpPct / 100)) : (Number(xp) || 0); };

// Etichette dell'AIUTO, dismesso il 2026-09-22: servono solo a rileggere le prove vecchie.
const LEGACY_HELP = { artigiano: "un artigiano", mastro: "un mastro competente" };

// ── Ritmo del lavoro ────────────────────────────────────────────────────────
export const PACE_OPTIONS = [
  { key: "calma",   icon: "🐢", label: "Con calma", mult: 2,   roll: 2,  desc: "Il doppio del tempo, +2 al tiro." },
  { key: "normale", icon: "⚒",  label: "Normale",   mult: 1,   roll: 0,  desc: "Tempo pieno, nessun bonus." },
  { key: "fretta",  icon: "🏃", label: "Di fretta", mult: 0.5, roll: -3, critFail: 5, desc: "Metà del tempo, −3 al tiro e 5% di fallimento critico: perdi i materiali e non crei nulla." },
];

export const componentByKey = (k) => COMPONENTS.find((c) => c.key === k) || null;
export const paceByKey = (k) => PACE_OPTIONS.find((p) => p.key === (k || "normale")) || PACE_OPTIONS[1];

// "3 h 30 min" · "45 min" · "1 giorno 2 h"
export function fmtMinutes(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), r = m % 60;
  const out = [];
  if (d) out.push(`${d} ${d === 1 ? "giorno" : "giorni"}`);
  if (h) out.push(`${h} h`);
  if (r || !out.length) out.push(`${r} min`);
  return out.join(" ");
}

// "2 h 05 min" per il conto alla rovescia (secondi sotto l'ora).
export function fmtCountdown(ms) {
  const s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (h >= 24) { const d = Math.floor(h / 24); return `${d} ${d === 1 ? "giorno" : "giorni"} ${h % 24} h`; }
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m) return `${m} min ${String(r).padStart(2, "0")} s`;
  return `${r} s`;
}

// Calcolo del tempo: base della pregiatura, poi gli sconti, poi il ritmo.
// Ritorna minuti totali e le voci (per mostrarle una per una nell'Officina).
export function craftMinutes({ tier = "common", tools = true, components = [], pace = "normale", ritmoBottega = false } = {}) {
  const base = CRAFT_BASE_MINUTES[normTier(tier)] || CRAFT_BASE_MINUTES.common;
  const parts = [{ key: "base", label: "Base", min: base }];
  let min = base;
  if (tools) { min -= TOOLS_MINUTES; parts.push({ key: "tools", label: "Strumenti", min: -TOOLS_MINUTES }); }
  const comps = [...new Set(components)].map(componentByKey).filter(Boolean).slice(0, MAX_COMPONENTS);
  for (const c of comps) { min -= c.minutes; parts.push({ key: `comp:${c.key}`, label: `${c.icon} ${c.name}`, min: -c.minutes }); }
  if (ritmoBottega) { const cut = Math.round(Math.max(min, 0) * 0.25); min -= cut; parts.push({ key: "ritmo", label: "Ritmo di bottega (−¼)", min: -cut }); }
  const p = paceByKey(pace);
  if (p.mult !== 1) { const before = Math.max(min, CRAFT_MIN_MINUTES); min = Math.round(before * p.mult); parts.push({ key: "pace", label: p.label, min: min - before }); }
  min = Math.max(CRAFT_MIN_MINUTES, Math.round(min));
  return { minutes: min, parts, base, tools: !!tools, components: comps.map((c) => c.key), pace: p.key, ritmoBottega: !!ritmoBottega };
}

// Riassunto in una riga per la coda del Master e la descrizione su Foundry.
export function craftTimeLabel(work) {
  if (!work) return "";
  const bits = [];
  if (work.tools) bits.push("strumenti");
  for (const k of work.components || []) { const c = componentByKey(k); if (c) bits.push(c.name); }
  if (work.help) bits.push(LEGACY_HELP[work.help] || String(work.help)); // prove di prima del 2026-09-22
  if (work.ritmoBottega) bits.push("ritmo di bottega");
  const p = paceByKey(work.pace); if (p.mult !== 1) bits.push(p.label.toLowerCase());
  return `${fmtMinutes(work.minutes)}${bits.length ? ` (${bits.join(", ")})` : ""}`;
}
