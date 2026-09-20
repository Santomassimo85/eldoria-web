// ── Tempo di lavoro dell'Officina (in tempo reale) ──────────────────────────
// Ogni prova di crafting ha un TEMPO FISSO, deciso prima del tiro e mai
// cambiato dal risultato del d20: la pregiatura a cui si punta dà la base,
// e la si abbrevia con gli strumenti, i componenti trovati in sessione,
// l'aiuto di un artigiano o di un mastro, il Ritmo di bottega (livello 6)
// e il ritmo scelto (con calma = doppio tempo e +2 al tiro, di fretta = metà
// tempo e −2). Finché il lavoro non è finito l'oggetto resta "sul banco":
// si vede solo la barra del tempo. I limiti (1 al giorno, 3 a settimana)
// restano quelli di craftingWeek.js e si consumano all'inizio del lavoro.

// Base in minuti per pregiatura mirata (Scarso non si può mirare).
export const CRAFT_BASE_MINUTES = { comune: 300, raro: 480, magico: 720, perfetto: 1440 };

// Strumenti della professione: −2 ore. Senza strumenti si tira con svantaggio.
export const TOOLS_MINUTES = 120;

// Tempo minimo di un lavoro, qualunque sconto si sommi.
export const CRAFT_MIN_MINUTES = 30;

// Componenti usabili in una sola prova.
export const MAX_COMPONENTS = 3;

// ── I 10 componenti base ────────────────────────────────────────────────────
// Oggetti solo descrittivi che il Master fa trovare in sessione e assegna dal
// pannello dell'Officina (`characters/{uid}.crafting.components[key]`). Non
// cambiano l'oggetto creato: accorciano il tempo di lavoro e si consumano.
export const COMPONENTS = [
  { key: "quercia",   icon: "🪵", name: "Legno di Quercia Antica",     minutes: 30, desc: "Un ceppo stagionato cent'anni: non si spacca e prende forma senza sforzo." },
  { key: "ferro",     icon: "⛏", name: "Minerale di Ferro Puro",      minutes: 30, desc: "Ferro senza scorie, dalle vene profonde di Helmvil: fonde in metà del tempo." },
  { key: "seta",      icon: "🧵", name: "Filo di Seta di Ragno",       minutes: 30, desc: "Un gomitolo lucido e tenace: si cuce, si lega e si intreccia quasi da solo." },
  { key: "lunaria",   icon: "🌿", name: "Erba Lunaria",                minutes: 30, desc: "Raccolta con la luna piena, già essiccata: pronta da pestare o infondere." },
  { key: "carbone",   icon: "🔥", name: "Carbone Runico",              minutes: 45, desc: "Brucia più caldo e più a lungo: la fucina o il fornello arrivano subito a temperatura." },
  { key: "sorgente",  icon: "💧", name: "Acqua di Sorgente Benedetta", minutes: 30, desc: "Limpida e senza impurità: distillati, tinture e impasti non vanno filtrati." },
  { key: "osso",      icon: "🦴", name: "Osso di Bestia Antica",       minutes: 45, desc: "Duro come pietra ma facile da incidere: ottimo per manici, intarsi e amuleti." },
  { key: "sale",      icon: "🧂", name: "Sale delle Profondità",       minutes: 30, desc: "Cristalli grigi delle miniere: conservano, fissano i colori e stabilizzano le miscele." },
  { key: "cera",      icon: "🕯", name: "Cera d'Api Titanica",         minutes: 45, desc: "Un panetto che non si scioglie al sole: per stampi, sigilli, lucidature e candele." },
  { key: "cristallo", icon: "💎", name: "Scheggia di Cristallo Grezzo", minutes: 60, desc: "Vibra piano se la si accosta a qualcosa d'incantato: accorda i materiali fra loro." },
];

// ── Aiuto al banco ──────────────────────────────────────────────────────────
export const HELP_OPTIONS = [
  { key: "",          icon: "🙅", label: "Da solo",            minutes: 0,  roll: 0, desc: "Lavori per conto tuo." },
  { key: "artigiano", icon: "🤝", label: "Un artigiano",       minutes: 30, roll: 1, desc: "Un collega competente ti dà una mano: +1 al tiro, −30 min." },
  { key: "mastro",    icon: "🎓", label: "Un mastro competente", minutes: 60, roll: 1, desc: "Un maestro della tua arte ti guida: +1 al tiro, −1 h." },
];

// ── Ritmo del lavoro ────────────────────────────────────────────────────────
export const PACE_OPTIONS = [
  { key: "calma",   icon: "🐢", label: "Con calma", mult: 2,   roll: 2,  desc: "Il doppio del tempo, +2 al tiro." },
  { key: "normale", icon: "⚒",  label: "Normale",   mult: 1,   roll: 0,  desc: "Tempo pieno, nessun bonus." },
  { key: "fretta",  icon: "🏃", label: "Di fretta", mult: 0.5, roll: -2, desc: "Metà del tempo, −2 al tiro." },
];

export const componentByKey = (k) => COMPONENTS.find((c) => c.key === k) || null;
export const helpByKey = (k) => HELP_OPTIONS.find((h) => h.key === (k || "")) || HELP_OPTIONS[0];
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
export function craftMinutes({ tier = "comune", tools = true, components = [], help = "", pace = "normale", ritmoBottega = false } = {}) {
  const base = CRAFT_BASE_MINUTES[tier] || CRAFT_BASE_MINUTES.comune;
  const parts = [{ key: "base", label: "Base", min: base }];
  let min = base;
  if (tools) { min -= TOOLS_MINUTES; parts.push({ key: "tools", label: "Strumenti", min: -TOOLS_MINUTES }); }
  const comps = [...new Set(components)].map(componentByKey).filter(Boolean).slice(0, MAX_COMPONENTS);
  for (const c of comps) { min -= c.minutes; parts.push({ key: `comp:${c.key}`, label: `${c.icon} ${c.name}`, min: -c.minutes }); }
  const h = helpByKey(help);
  if (h.minutes) { min -= h.minutes; parts.push({ key: "help", label: h.label, min: -h.minutes }); }
  if (ritmoBottega) { const cut = Math.round(Math.max(min, 0) * 0.25); min -= cut; parts.push({ key: "ritmo", label: "Ritmo di bottega (−¼)", min: -cut }); }
  const p = paceByKey(pace);
  if (p.mult !== 1) { const before = Math.max(min, CRAFT_MIN_MINUTES); min = Math.round(before * p.mult); parts.push({ key: "pace", label: p.label, min: min - before }); }
  min = Math.max(CRAFT_MIN_MINUTES, Math.round(min));
  return { minutes: min, parts, base, tools: !!tools, components: comps.map((c) => c.key), help: h.key, pace: p.key, ritmoBottega: !!ritmoBottega };
}

// Riassunto in una riga per la coda del Master e la descrizione su Foundry.
export function craftTimeLabel(work) {
  if (!work) return "";
  const bits = [];
  if (work.tools) bits.push("strumenti");
  for (const k of work.components || []) { const c = componentByKey(k); if (c) bits.push(c.name); }
  const h = helpByKey(work.help); if (h.key) bits.push(h.label.toLowerCase());
  if (work.ritmoBottega) bits.push("ritmo di bottega");
  const p = paceByKey(work.pace); if (p.mult !== 1) bits.push(p.label.toLowerCase());
  return `${fmtMinutes(work.minutes)}${bits.length ? ` (${bits.join(", ")})` : ""}`;
}
