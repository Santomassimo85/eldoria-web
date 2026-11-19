import assert from 'node:assert/strict';
import handler from '../api/assistente.js';
import { loadCampaignMemory, searchCampaignMemory, readCampaignSource } from '../api/_campaignMemory.js';

const longSummary = `${'Una lunga cronaca. '.repeat(400)} Palar ritrova la sua amica Nerissa al ponte.`;
const memory = await loadCampaignMemory(async (collection) => collection === 'summaries'
  ? [{ _id: 'old-session', title: 'Il ponte', party: 'ENOX', content: longSummary }]
  : collection === 'characters' ? [{ _id: 'palar', name: 'Palar', background: 'Cerca Nerissa.', fcmTokens: ['private-device-token'] }] : []);
const found = searchCampaignMemory(memory, 'Chi era l’amica di Palar?');
assert.ok(found.risultati[0].estratti.join(' ').includes('Nerissa'));
assert.equal(found.risultati[0].href, '/riassunti?s=old-session');
assert.equal(searchCampaignMemory(memory, 'Palar', 'LAC').risultati.some((source) => source.collection === 'summaries'), false);
assert.ok(!JSON.stringify(memory).includes('private-device-token'));
const first = readCampaignSource(memory, 'summaries', 'old-session');
assert.ok(first.testo.includes('Nerissa'));
assert.equal(readCampaignSource(memory, 'agent_stats', 'global').errore, 'Fonte non trovata.');

process.env.GEMINI_API_KEY = 'test-only';
const originalFetch = globalThis.fetch;
const doc = (id, fields) => ({ name: `projects/eldoria-web/databases/(default)/documents/${id}`, fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { stringValue: value }])) });
let authenticatedEmail = 'santomassimo85@gmail.com';
let archiveReads = 0, geminiRequests = [], forceMasterTool = false;
globalThis.fetch = async (url, options = {}) => {
  const address = String(url);
  if (address.includes('accounts:lookup')) return Response.json({ users: [{ localId: 'verified-uid', email: authenticatedEmail }] });
  if (address.includes('generativelanguage.googleapis.com')) {
    const body = JSON.parse(options.body);
    geminiRequests.push(body);
    if (forceMasterTool && geminiRequests.length === 1) return Response.json({ candidates: [{ content: { parts: [{ functionCall: { name: 'cerca_memoria_campagna', args: { query: 'Palar' } } }] } }] });
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Risposta con fonte.' }] } }] });
  }
  const parsed = new URL(address);
  const collection = parsed.pathname.split('/documents/')[1];
  if (collection === 'characters/verified-uid') return Response.json(doc(collection, { name: 'Master' }));
  archiveReads++;
  if (collection === 'summaries' && !parsed.searchParams.has('pageToken')) return Response.json({ documents: [doc('summaries/first', { title: 'Altra sessione', content: 'Altri eventi.' })], nextPageToken: 'next-page' });
  if (collection === 'summaries') return Response.json({ documents: [doc('summaries/old-session', { title: 'Il ponte', party: 'ENOX', content: longSummary })] });
  return Response.json({ documents: [] });
};
async function request(body, token = 'valid-test-token') {
  let status, result;
  await handler({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body }, {
    status(code) { status = code; return this; }, json(value) { result = value; return this; },
  });
  return { status, result };
}
try {
  const question = { messages: [{ role: 'user', content: 'Chi era l’amica di Palar?' }], uid: 'spoofed-uid', email: 'spoofed@example.com' };
  const master = await request(question);
  assert.equal(master.status, 200);
  assert.equal(master.result.mode, 'master');
  assert.ok(master.result.sources.some((source) => source.id === 'old-session'));
  assert.ok(geminiRequests[0].system_instruction.parts[0].text.includes('Nerissa'));
  assert.ok(geminiRequests[0].tools[0].function_declarations.some((tool) => tool.name === 'leggi_fonte_campagna'));
  assert.equal((await request(question, '')).status, 401);
  for (const email of ['player@example.com', 'ripperti96@gmail.com']) {
    authenticatedEmail = email;
    archiveReads = 0;
    geminiRequests = [];
    forceMasterTool = true;
    const player = await request({ ...question, email: 'santomassimo85@gmail.com' });
    assert.equal(player.result.mode, 'player');
    assert.deepEqual(player.result.sources, []);
    assert.equal(archiveReads, 0, 'Nessuna lettura dell’archivio Master per altri account');
    assert.ok(!geminiRequests[0].tools[0].function_declarations.some((tool) => tool.name === 'cerca_memoria_campagna'));
    assert.ok(JSON.stringify(geminiRequests[1].contents).includes('riservata al Master principale'));
  }
  console.log('OK — archivio paginato, estratti profondi, fonti, login verificato e accesso esclusivo Master');
} finally {
  globalThis.fetch = originalFetch;
}
