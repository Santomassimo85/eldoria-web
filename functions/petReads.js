// Letture e visite che danno punti pet (2026-10-31). Copia del catalogo di
// src/data/petReads.js: TENERLE ALLINEATE (punti e chiavi delle pagine).
const READ_POINTS = { summary: 2, npc: 1, geo: 1, page: 1 };
const READ_PAGES = {
  almanacco: "Almanacco del Mondo", atlante: "L'Atlante", luoghi: "Archivio dei luoghi",
  npc: "Archivio NPC", cronache: "Le Cronache", diario: "Diario di Bordo", scriba: "Lo Scriba",
  party: "Party", scheda: "Scheda PG", bacheca: "Bacheca", mercato: "Mercato Nero",
  ratti: "Gilda dei Ratti", officina: "Officina", "manuale-crafting": "Manuale del crafting",
  ruota: "Ruota di Exanthia", arena: "Arena", "world-boss": "World Boss",
};
// Collezione dove deve esistere la cosa letta.
const READ_COLLECTION = { summary: "summaries", npc: "npcs", geo: "geo_archive" };
const KIND_LABEL = { summary: "Cronaca letta", npc: "NPC consultato", geo: "Luogo esplorato", page: "Pagina visitata" };

// Tempo minimo (copia di readNeedMs in src/data/petReads.js).
const READ_FIXED_MS = { npc: 5000, geo: 5000, page: 4000 };
const wordCount = (html) => String(html || "").replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
function readNeedMs(kind, words = 0) {
  if (kind !== "summary") return READ_FIXED_MS[kind] || 5000;
  return Math.round(Math.min(40000, Math.max(12000, (words / 250) * 60000 * 0.15)));
}

module.exports = { READ_POINTS, READ_PAGES, READ_COLLECTION, KIND_LABEL, wordCount, readNeedMs };
