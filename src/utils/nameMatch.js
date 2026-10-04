// Riconoscere un nome nel testo (NPC, luoghi, PG): usato dalla Cronaca
// (cronacaContext.js) e dal Generatore Sessioni (sessionWorld.js).
// Niente dipendenze: si prova anche da node.

// Confronto senza maiuscole, accenti e apostrofi.
export const normText = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, "")
    .toLowerCase();

// Titoli e particelle che da soli non identificano nessuno.
const NOT_A_NAME = new Set([
  "lady", "lord", "sire", "signore", "signora", "mastro", "padre", "madre", "fratello", "sorella",
  "conte", "contessa", "duca", "duchessa", "barone", "baronessa", "principe", "principessa",
  "regina", "capitano", "comandante", "generale", "maestro", "sommo", "alto", "vecchio", "vecchia",
  "della", "delle", "dello", "degli", "dalla", "dalle", "the", "von",
  "citta", "monte", "montagna", "montagne", "foresta", "bosco", "lago", "fiume", "valle", "porto", "clan",
]);

const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Il nome compare nel testo (già passato da normText)? Prova il nome intero,
// poi (con `partial`, il default: serve per le persone) ogni parola
// significativa (≥ 4 lettere, niente titoli: "Conte Aldric" → "aldric").
// Per i LUOGHI passare { partial: false }: "Lago di Mezzo" non deve scattare su "mezzo".
export function mentioned(name, haystack, { partial = true } = {}) {
  const n = normText(name).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (n.length < 3) return false;
  if (new RegExp(`\\b${esc(n)}\\b`).test(haystack)) return true;
  if (!partial) return false;
  return n.split(" ")
    .filter((w) => w.length >= 4 && !NOT_A_NAME.has(w))
    .some((w) => new RegExp(`\\b${esc(w)}\\b`).test(haystack));
}
