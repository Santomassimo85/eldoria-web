const STOP = new Set('chi che cosa come quando dove quale quali quanto quanta quanti quante era erano sono stato stata stati delle della dello degli del dei con per una uno nel nella nelle sul sulla alla alle agli anche aveva avevano mio mia miei mie suo sua suoi sue player giocatore personaggio dimmi ricordi ricorda cerca raccontami riguardo'.split(' '));
const normalize = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const plain = (text) => String(text || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
const stem = (word) => word.length > 4 ? word.replace(/[aeio]$/, '') : word;

export async function authenticatedUser(req, apiKey) {
  const token = String(req.headers?.authorization || '').match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const user = (await response.json()).users?.[0];
  return user?.localId ? { uid: user.localId, email: user.email || '', token } : null;
}

const FIELDS = {
  summaries: ['title', 'subTitle', 'party', 'date', 'content'],
  npcs: ['name', 'faction', 'location', 'linkedCity', 'description', 'background', 'notes', 'masterNotes', 'secrets', 'relationships'],
  characters: ['name', 'party', 'race', 'class', 'subclass', 'level', 'background', 'description', 'notes', 'story', 'relationships', 'personality', 'ideals', 'bonds', 'flaws', 'stats', 'currency', 'platinum', 'rattoPoints', 'inventory', 'actions'],
  geo_archive: ['name', 'continent', 'description', 'history', 'notes', 'masterNotes', 'secrets'],
  quests: ['title', 'description', 'targetParty', 'targetCharacter', 'acceptedBy', 'status', 'reward', 'notes'],
};
const TYPES = { summaries: 'Riassunto', npcs: 'NPC', characters: 'Personaggio', geo_archive: 'Luogo', quests: 'Missione' };

export async function loadCampaignMemory(readAll) {
  const collections = Object.keys(FIELDS);
  const results = await Promise.allSettled(collections.map(readAll));
  const sources = [], unavailable = [];
  results.forEach((result, index) => {
    const collection = collections[index];
    if (result.status === 'rejected') { unavailable.push(collection); return; }
    for (const doc of result.value) {
      const text = FIELDS[collection].flatMap((field) => {
        const value = doc[field];
        if (value == null || value === '') return [];
        return `${field}: ${plain(typeof value === 'object' ? JSON.stringify(value) : value)}`;
      }).join('\n');
      sources.push({ id: doc._id, collection, tipo: TYPES[collection], titolo: doc.title || doc.name || doc._id,
        gruppo: doc.party || null, data: doc.date || null, text,
        href: collection === 'summaries' ? `/riassunti?s=${encodeURIComponent(doc._id)}` : null });
    }
  });
  return { sources, unavailable };
}

export function searchCampaignMemory(memory, query, party = '') {
  const terms = [...new Set(normalize(query).split(' ').filter((word) => word.length > 2 && !STOP.has(word)).map(stem))];
  if (!terms.length) return { risultati: [], nota: 'Indica un nome, luogo o evento da cercare.', fontiNonDisponibili: memory.unavailable };
  const eligible = memory.sources.filter((source) => !party || source.gruppo === party || source.gruppo === 'Unico' || !source.gruppo);
  const frequencies = terms.map((term) => eligible.filter((source) => normalize(source.text).split(' ').some((word) => stem(word) === term)).length);
  const ranked = eligible.map((source) => {
    const words = normalize(source.text).split(' ');
    const matched = terms.filter((term) => words.some((word) => stem(word) === term));
    const score = matched.reduce((sum, term) => sum + 1 + Math.log(1 + eligible.length / (frequencies[terms.indexOf(term)] || 1)), 0)
      + (source.collection === 'summaries' && matched.length ? 2 : 0);
    return { source, score, matched };
  }).filter((item) => item.matched.length).sort((a, b) => b.score - a.score).slice(0, 16);
  return { risultati: ranked.map(({ source, matched }) => {
    // Finestre intorno ai termini, anche quando il dettaglio è in fondo alla sessione.
    const chunks = [];
    for (let start = 0; start < source.text.length; start += 1000) {
      const text = source.text.slice(Math.max(0, start - 200), start + 1400);
      const words = normalize(text).split(' ').map(stem);
      chunks.push({ text, score: matched.filter((term) => words.includes(term)).length });
    }
    const excerpts = chunks.filter((chunk) => chunk.score).sort((a, b) => b.score - a.score).slice(0, 2).map((chunk) => chunk.text);
    const { text, ...citation } = source;
    return { ...citation, estratti: excerpts };
  }), fontiNonDisponibili: memory.unavailable };
}

export function readCampaignSource(memory, collection, id, offset = 0) {
  const source = memory.sources.find((entry) => entry.collection === collection && entry.id === id);
  if (!source) return { errore: 'Fonte non trovata.' };
  const start = Math.max(0, Math.floor(Number(offset) || 0));
  const { text, ...citation } = source;
  const end = start + 12000;
  return { ...citation, testo: text.slice(start, end), prossimoOffset: end < text.length ? end : null };
}
