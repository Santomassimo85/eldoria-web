// Generatore Sessioni: quanto mondo mandare a Claude, per spendere pochi token.
// Prima andavano TUTTI i luoghi (descrizione di 400 caratteri) e TUTTI gli
// NPC (240 caratteri) a ogni richiesta, bozza e sessione. Ora:
//  - per intero solo i luoghi e gli NPC citati nel testo della richiesta
//    (focus, note, fili, ultimo riassunto, bozza) + gli NPC che vivono nei
//    luoghi citati;
//  - tutti gli altri solo come NOMI, così l'AI li può ancora riusare.
// Niente dipendenze dall'app: si prova da node.
import { normText, mentioned } from "./nameMatch.js";

const MAX_CITIES = 6;
const MAX_NPCS = 14;

export function pickWorld({ cities = [], npcs = [] } = {}, text = "") {
  const hay = normText(text);
  const cityHits = cities.filter((c) => c.name && mentioned(c.name, hay, { partial: false })).slice(0, MAX_CITIES);
  const hitCityNames = new Set(cityHits.map((c) => normText(c.name)));
  const npcHits = npcs
    .filter((n) => n.name && (mentioned(n.name, hay) || hitCityNames.has(normText(n.city))))
    // prima quelli citati per nome, poi quelli che stanno solo nei luoghi citati
    .sort((a, b) => Number(mentioned(b.name, hay)) - Number(mentioned(a.name, hay)))
    .slice(0, MAX_NPCS);
  const fullCity = new Set(cityHits.map((c) => c.name));
  const fullNpc = new Set(npcHits.map((n) => n.name));
  return {
    worldCities: cityHits,
    worldNpcs: npcHits,
    worldNames: {
      cities: cities.filter((c) => c.name && !fullCity.has(c.name)).map((c) => c.name),
      npcs: npcs.filter((n) => n.name && !fullNpc.has(n.name)).map((n) => (n.city ? `${n.name} (${n.city})` : n.name)),
    },
  };
}

// Riassunti per la BOZZA: gli ultimi 3 abbastanza lunghi, i 5 prima in breve,
// i più vecchi solo col titolo (bastano a ricordare che sono esistiti).
export function trimRecapsForDraft(recaps = []) {
  const n = recaps.length;
  return recaps.map((r, i) => {
    const fromEnd = n - 1 - i;
    const max = fromEnd < 3 ? 3000 : fromEnd < 8 ? 400 : 0;
    const text = String(r.text || "");
    return { ...r, text: max ? (text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + "…" : text) : "" };
  });
}

// Riassunti per la SESSIONE (dopo la bozza approvata): la bozza ha già la
// continuità, basta l'ultimo riassunto per ricordare dove si trovano.
export function trimRecapsForSession(recaps = []) {
  const last = recaps[recaps.length - 1];
  if (!last) return [];
  const text = String(last.text || "");
  return [{ ...last, text: text.length > 2500 ? text.slice(0, 2500).replace(/\s+\S*$/, "") + "…" : text }];
}
