// ── Esperienza delle professioni ─────────────────────────────────────────────
// Ogni prova di crafting fatta nell'Officina dà punti esperienza (PE) di
// professione in base alla pregiatura ottenuta. I PE fanno salire di LIVELLO
// (1–10); ogni due livelli si sale di GRADO sul Sentiero del Maestro
// (Apprendista → Discepolo → Artigiano → Maestro → Leggenda), che è quello che
// dà i bonus al tiro descritti nel manuale.

import { SENTIERO_MAESTRO, normTier } from "./crafting";

// PE per pregiatura ottenuta (un 20 naturale raddoppia).
export const XP_PER_TIER = { scarso: 5, common: 10, uncommon: 25, rare: 60, veryRare: 150, legendary: 300 };

// Scala dei livelli: PE totali necessari per raggiungere ogni livello.
export const XP_LEVELS = [
  { lv: 1,  xp: 0,    grado: 1, sblocca: "Conosci la tua arte: tiri normalmente." },
  { lv: 2,  xp: 40,   grado: 1, sblocca: "Mano ferma: gli oggetti Comuni che crei hanno una piccola rifinitura estetica (nota nella descrizione)." },
  { lv: 3,  xp: 100,  grado: 2, sblocca: "Discepolo: +1 a tutti i tiri. Riconosci a vista gli oggetti Non comuni della tua professione." },
  { lv: 4,  xp: 180,  grado: 2, sblocca: "Occhio esperto: per le rarità a caso (Molto raro, Leggendario) vedi in anticipo cosa esce con un 1 e con un 12 sul d12." },
  { lv: 5,  xp: 300,  grado: 3, sblocca: "Artigiano: gli oggetti Scarsi contano come Comuni (niente malus). 1 volta per riposo lungo raddoppi la competenza." },
  { lv: 6,  xp: 450,  grado: 3, sblocca: "Ritmo di bottega: ogni lavoro nell'Officina dura un quarto in meno." },
  { lv: 7,  xp: 700,  grado: 4, sblocca: "Maestro: +2 ai tiri e puoi puntare al Molto raro (21+). Firma del Maestro 1 volta per riposo lungo." },
  { lv: 8,  xp: 1000, grado: 4, sblocca: "Materiali docili: i materiali di qualità superiore ti danno Vantaggio anche se non sono quelli 'ideali'." },
  { lv: 9,  xp: 1500, grado: 5, sblocca: "Leggenda: +3 ai tiri e puoi puntare al Leggendario (26+). Opera Definitiva una volta per campagna." },
  { lv: 10, xp: 2200, grado: 5, sblocca: "Nome nel regno: le tue creazioni portano la tua firma e valgono il doppio al Mercato Nero." },
];

// Bonus al tiro per grado (come nel manuale: Discepolo +1, Maestro +2, Leggenda +3).
export const GRADE_BONUS = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 3 };

// Livello raggiunto con i PE dati.
export function levelFor(xp = 0) {
  const n = Number(xp) || 0;
  let cur = XP_LEVELS[0];
  for (const l of XP_LEVELS) if (n >= l.xp) cur = l;
  return cur;
}

// Prossimo livello (o null al massimo).
export function nextLevelFor(xp = 0) {
  const cur = levelFor(xp);
  return XP_LEVELS.find((l) => l.lv === cur.lv + 1) || null;
}

// Riassunto completo della progressione.
export function progression(xp = 0) {
  const level = levelFor(xp);
  const next = nextLevelFor(xp);
  const grado = SENTIERO_MAESTRO.find((g) => g.grado === level.grado) || SENTIERO_MAESTRO[0];
  const span = next ? next.xp - level.xp : 1;
  const into = next ? (Number(xp) || 0) - level.xp : 1;
  return {
    xp: Number(xp) || 0,
    level, next, grado,
    bonus: GRADE_BONUS[level.grado] || 0,
    canVeryRare: level.grado >= 4,          // Molto raro solo dal Maestro in su
    canLegendary: level.grado >= 5,         // Leggendario solo dalla Leggenda
    scarsoAsComune: level.grado >= 3,       // Artigiano: Salvataggio
    pct: next ? Math.max(0, Math.min(100, Math.round((into / span) * 100))) : 100,
  };
}

// PE guadagnati da una prova.
export function xpForCraft(tier, nat20 = false) {
  const base = XP_PER_TIER[normTier(tier)] || 0;
  return nat20 ? base * 2 : base;
}
