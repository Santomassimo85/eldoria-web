/* ============================================================
   LETTURE E VISITE CHE DANNO PUNTI PET (2026-10-31)
   Ogni cosa paga UNA volta sola per personaggio, per sempre: lo decide
   il server (callable `petReadReward`, registro `pet_reads` che nessun
   client può scrivere). Copia del catalogo in functions/petReads.js:
   TENERLE ALLINEATE (punti e pagine).
   ============================================================ */

export const READ_POINTS = { summary: 2, npc: 1, geo: 1, page: 1 };

export const READ_KIND_LABEL = {
  summary: "Cronache lette",
  npc: "NPC consultati",
  geo: "Luoghi esplorati",
  page: "Pagine visitate",
};

// Pagine che pagano la prima visita (chiave stabile → percorso).
export const READ_PAGES = [
  { key: "almanacco", path: "/almanacco", label: "Almanacco del Mondo" },
  { key: "atlante", path: "/world-map", label: "L'Atlante" },
  { key: "luoghi", path: "/Geo", label: "Archivio dei luoghi" },
  { key: "npc", path: "/npc", label: "Archivio NPC" },
  { key: "cronache", path: "/riassunti", label: "Le Cronache" },
  { key: "diario", path: "/diario", label: "Diario di Bordo" },
  { key: "scriba", path: "/scriba", label: "Lo Scriba" },
  { key: "party", path: "/party", label: "Party" },
  { key: "scheda", path: "/scheda-pg", label: "Scheda PG" },
  { key: "bacheca", path: "/bacheca", label: "Bacheca" },
  { key: "mercato", path: "/mercato", label: "Mercato Nero" },
  { key: "ratti", path: "/ratti-lore", label: "Gilda dei Ratti" },
  { key: "officina", path: "/officina", label: "Officina" },
  { key: "manuale-crafting", path: "/crafting", label: "Manuale del crafting" },
  { key: "ruota", path: "/ruota", label: "Ruota di Exanthia" },
  { key: "arena", path: "/arena", label: "Arena" },
  { key: "world-boss", path: "/world-boss-fight", label: "World Boss" },
];
export const pageKeyOf = (path) => READ_PAGES.find((p) => p.path === path)?.key || null;

/* Quanto tempo ATTIVO serve perché una lettura conti (2026-10-31). Leggero
   apposta: leggere non è obbligatorio, è solo un invito. Cronaca = ~15% del
   tempo di lettura stimato (250 parole al minuto), fra 12 e 40 secondi, e
   bisogna scorrerla almeno al 60%. Il SERVER rifà lo stesso conto e paga
   solo se dal suo "inizio" è passato davvero questo tempo. */
export const READ_FIXED_MS = { npc: 5000, geo: 5000, page: 4000 };
export const READ_SCROLL_NEED = { summary: 0.6 };
export const wordCount = (html) => String(html || "").replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
export function readNeedMs(kind, words = 0) {
  if (kind !== "summary") return READ_FIXED_MS[kind] || 5000;
  return Math.round(Math.min(40000, Math.max(12000, (words / 250) * 60000 * 0.15)));
}

// Finché il Rifugio dei Pet è solo del Master, l'indicatore di lettura e la
// parte "punti" del Resoconto li vede solo lui. Quando apre a tutti: true.
export const PETS_PUBLIC = false;
