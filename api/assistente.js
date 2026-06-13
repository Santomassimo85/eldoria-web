// api/assistente.js
// Assistente player di Eldoria — powered by Gemini (gratuito).
// Legge da Firestore, propone azioni con conferma obbligatoria prima di scrivere.
//
// STRUMENTI disponibili:
//   leggi_scheda, leggi_mercato, leggi_bacheca, leggi_riassunti,
//   leggi_npc, leggi_geo, leggi_arena, leggi_party, leggi_divinita
//   fai_offerta (SCRITTURA — richiede conferma frontend)
//   accetta_missione (SCRITTURA — richiede conferma frontend)
//
// Il backend NON esegue mai azioni di scrittura direttamente:
// restituisce { pendingAction: { type, params } } e aspetta che il
// frontend mandi { confirmedAction: { type, params } } per eseguire.

const PROJECT_ID = "eldoria-web";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ---- Party roster: unica fonte di verità (allineata a Bacheca.jsx) ----
// L'appartenenza al gruppo si deriva dal NOME del personaggio (campo char.name).
const PARTY_ROSTER = {
  "AMEA": ["Tanagar", "Garroth Tel´Arion", "Caius Maxis-Richtofen"],
  "ENOX": ["Temistocle Sottocolle Milo", "Dante", "Roynot", "Vyger", "Timoty Bevibotte", "Alaric Voltasorte"],
  "LAC":  ["Horn", "Thinkle Muschioverde", "Cleofe"],
  "LEAF": ["Makenna", "Taaras Stormrage", "Soran", "Zethir Nightwhisper"],
  "ECO":  ["Aksel", "Dago", "Ismael Van Dyke"],
};
const PARTY_IDS = Object.keys(PARTY_ROSTER);

function getPartyByCharName(name) {
  if (!name) return "Senza Gruppo";
  for (const [party, members] of Object.entries(PARTY_ROSTER)) {
    if (members.includes(name)) return party;
  }
  return "Senza Gruppo";
}

// ---- Pantheon (già conosciuto, non serve leggerlo da Firestore) ----
const PANTHEON_BRIEF = `Vecchie divinità: Vulkàros(fuoco/guerra), Nysia(acqua/vita/morte), Syrael(aria/profezia), Drokhan(terra/giustizia), Enoia(spirito/destino), Lirael(arte/memoria), Myrhal(magia/segreti), Zenara(natura/bestie), Kal-Durr(tempo/fato), Naavir(inganno/ombre).
Nuovi dei: Malakor(ordine/contratti distorto), Venestra(amore ossessivo/disperazione), Xylos(sfortuna), Sune(bellezza/amore buono).
Divinità malvagie: Morgath(magia corrotta/fame), Xul'Korah(inganno/malattie), Thal-Grimor(guerra crudele/tirannia), Malakhia(oblio/follia/vuoto).`;

// ---- Helpers Firestore REST ----
async function readCollection(name, apiKey, limit = 30) {
  const url = `${FS_BASE}/${name}?key=${apiKey}&pageSize=${limit}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.documents || []).map(d => firestoreDocToObj(d));
}

async function readDoc(path, apiKey) {
  const url = `${FS_BASE}/${path}?key=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const data = await r.json();
  return firestoreDocToObj(data);
}

// PATCH con supporto a field paths annidati (es. "bids.UID") e valori mappa/array.
async function patchDoc(path, fields, apiKey) {
  const mask = Object.keys(fields)
    .map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");
  const url = `${FS_BASE}/${path}?key=${apiKey}&${mask}`;
  const body = { fields: {} };
  for (const [k, v] of Object.entries(fields)) {
    body.fields[k] = toFirestoreValue(v);
  }
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.ok;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === "object") {
    const f = {};
    for (const [k, val] of Object.entries(v)) f[k] = toFirestoreValue(val);
    return { mapValue: { fields: f } };
  }
  return { stringValue: String(v) };
}

function firestoreDocToObj(doc) {
  if (!doc || !doc.fields) return {};
  const obj = { _id: doc.name?.split("/").pop() };
  for (const [k, v] of Object.entries(doc.fields)) obj[k] = extractValue(v);
  return obj;
}
function extractValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return Number(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.mapValue) return firestoreDocToObj(v.mapValue);
  if (v.arrayValue) return (v.arrayValue.values || []).map(extractValue);
  return null;
}

// ---- Utility testo ----
function stripHtml(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function formatCurrency(cur) {
  if (!cur || typeof cur !== "object") return null;
  const parts = [];
  if (cur.pp) parts.push(`${cur.pp} pp`);
  if (cur.gp) parts.push(`${cur.gp} mo`);
  if (cur.ep) parts.push(`${cur.ep} me`);
  if (cur.sp) parts.push(`${cur.sp} ma`);
  if (cur.cp) parts.push(`${cur.cp} mr`);
  return parts.length ? parts.join(", ") : "nessuna moneta";
}

// ---- Contesto giocatore: chi è e in che gruppo gioca (letto una volta) ----
async function loadPlayerContext(uid, apiKey) {
  const me = await readDoc(`characters/${uid}`, apiKey);
  if (!me || !me.name) return { char: me, name: null, party: null };
  return { char: me, name: me.name, party: getPartyByCharName(me.name) };
}

// ---- Esegui uno strumento (lettura) ----
async function executeTool(toolName, toolInput, ctx, apiKey) {
  const { uid, name: myName, party: myParty } = ctx;
  switch (toolName) {
    case "leggi_scheda": {
      const doc = ctx.char || await readDoc(`characters/${uid}`, apiKey);
      if (!doc || !doc.name) return "Scheda non trovata. Chiedi al Master di sincronizzarla da Foundry.";
      const s = doc.stats || {};
      const cantrips = (doc.actions || []).filter(a => a.category === "Trucchetto").map(a => a.name);
      const spells = (doc.actions || []).filter(a => /livello/i.test(a.category || "")).map(a => `${a.name} (${a.category})`);
      return JSON.stringify({
        nome: doc.name, classe: doc.class, sottoclasse: doc.subclass || null,
        livello: doc.level, razza: doc.race, gruppo: myParty,
        pf: s.hp, pfMax: s.maxHp, ca: s.ac, iniziativa: s.initiative,
        cdIncantesimi: s.spellDc, bonusCompetenza: s.prof,
        valuta: formatCurrency(doc.currency), platinoMercato: doc.platinum || 0,
        slotIncantesimi: (doc.spellSlots || []).map(sl => `${sl.label}: ${sl.value}/${sl.max}`),
        trucchetti: cantrips,
        incantesimi: spells,
        inventario: (doc.inventory || []).slice(0, 25).map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}${i.equipped ? " (equipaggiato)" : ""}`),
      });
    }

    case "leggi_party": {
      if (!myParty || myParty === "Senza Gruppo") {
        return "Il tuo personaggio non risulta assegnato a nessun gruppo. Chiedi al Master.";
      }
      const memberNames = PARTY_ROSTER[myParty] || [];
      const all = await readCollection("characters", apiKey, 60);
      const members = all.filter(c => memberNames.includes(c.name));
      const found = members.map(c => ({
        nome: c.name, classe: c.class, sottoclasse: c.subclass || null,
        livello: c.level, razza: c.race,
        pf: c.stats?.hp, pfMax: c.stats?.maxHp, ca: c.stats?.ac,
      }));
      // membri del roster senza scheda sincronizzata
      const missing = memberNames.filter(n => !members.some(c => c.name === n));
      return JSON.stringify({ gruppo: myParty, membri: found, schedeMancanti: missing });
    }

    case "leggi_riassunti": {
      const all = await readCollection("summaries", apiKey, 60);
      if (!all.length) return "Nessun riassunto di sessione trovato.";
      const query = (toolInput?.query || "").toLowerCase();
      // party richiesto esplicitamente, altrimenti quello del giocatore
      let targetParty = (toolInput?.party || "").toUpperCase();
      if (!PARTY_IDS.includes(targetParty)) targetParty = PARTY_IDS.includes(myParty) ? myParty : null;

      let list = all;
      if (targetParty) {
        // riassunti del proprio gruppo + eventi di world-building condivisi ("Unico")
        list = all.filter(s => s.party === targetParty || s.party === "Unico");
      }
      if (query) {
        list = list.filter(s => JSON.stringify(s).toLowerCase().includes(query));
      }
      // più recenti prima: order desc, poi createdAt
      list.sort((a, b) => (b.order || 0) - (a.order || 0) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      if (!list.length) return `Nessun riassunto trovato${targetParty ? ` per il gruppo ${targetParty}` : ""}${query ? ` con "${toolInput.query}"` : ""}.`;
      return JSON.stringify({
        gruppo: targetParty || "tutti",
        riassunti: list.slice(0, 6).map(s => ({
          titolo: s.title, sottotitolo: s.subTitle || null, gruppo: s.party,
          data: s.date, testo: stripHtml(s.content).slice(0, 900),
        })),
      });
    }

    case "leggi_mercato": {
      const items = await readCollection("items", apiKey, 40);
      const onSale = items.filter(i => !i.isSold);
      if (!onSale.length) return "Il mercato nero è vuoto al momento.";
      return JSON.stringify(onSale.map(i => {
        const bids = i.bids ? Object.values(i.bids) : [];
        const topBid = bids.length ? Math.max(...bids.map(b => b?.amount ?? b ?? 0)) : 0;
        return {
          id: i._id, nome: i.name, tipo: i.type, rarita: i.class,
          modalita: i.saleType === "auction" ? "asta" : "prezzo fisso",
          prezzo: i.saleType === "auction" ? null : i.price,
          baseAsta: i.saleType === "auction" ? i.startingBid : null,
          offertaPiuAlta: topBid || null,
          descrizione: stripHtml(i.description).slice(0, 300),
          livelloRattoMin: i.minLevel || 0,
        };
      }));
    }

    case "leggi_bacheca": {
      const quests = await readCollection("quests", apiKey, 40);
      // Visibilità: All, oppure mirate al party / personaggio del giocatore
      const visible = quests.filter(q => {
        const tp = q.targetParty || "All";
        const tc = q.targetCharacter || "All";
        const partyOk = tp === "All" || tp === myParty;
        const charOk = tc === "All" || tc === myName;
        return partyOk && charOk;
      });
      if (!visible.length) return "Nessuna missione disponibile per te al momento.";
      return JSON.stringify(visible.map(q => ({
        id: q._id, titolo: q.title, descrizione: stripHtml(q.description).slice(0, 300),
        stato: q.status, difficolta: q.difficulty, zona: q.zone || null,
        perGruppo: q.targetParty || "All",
        ricompensa: [q.reward, q.rewardGold ? `${q.rewardGold} mo` : null, q.rewardItem].filter(Boolean).join(" · ") || null,
        accettataDa: q.acceptedBy || null,
      })));
    }

    case "leggi_npc": {
      const npcs = await readCollection("npcs", apiKey, 80);
      const query = (toolInput?.query || "").toLowerCase();
      const filtered = query
        ? npcs.filter(n => JSON.stringify(n).toLowerCase().includes(query))
        : npcs.slice(0, 12);
      if (!filtered.length) return `Nessun NPC trovato${query ? ` per "${toolInput.query}"` : ""}.`;
      return JSON.stringify(filtered.slice(0, 15).map(n => ({
        nome: n.name, fazione: n.faction || null, citta: n.linkedCity || n.location || null,
        descrizione: stripHtml(n.description).slice(0, 400),
      })));
    }

    case "leggi_geo": {
      const places = await readCollection("geo_archive", apiKey, 80);
      const query = (toolInput?.query || "").toLowerCase();
      const filtered = query
        ? places.filter(p => JSON.stringify(p).toLowerCase().includes(query))
        : places.slice(0, 12);
      if (!filtered.length) return `Nessun luogo trovato${query ? ` per "${toolInput.query}"` : ""}.`;
      return JSON.stringify(filtered.slice(0, 15).map(p => ({
        nome: p.name, continente: p.continent || null,
        descrizione: stripHtml(p.description).slice(0, 400),
      })));
    }

    case "leggi_arena": {
      const entries = await readCollection("arena", apiKey, 30);
      if (!entries.length) return "Nessun dato arena trovato.";
      return JSON.stringify(entries.slice(0, 15));
    }

    case "leggi_divinita":
      return PANTHEON_BRIEF;

    default:
      return "Strumento non riconosciuto.";
  }
}

// ---- Definizioni strumenti per Gemini ----
const TOOLS_DEF = {
  function_declarations: [
    { name: "leggi_scheda", description: "Legge la scheda del giocatore loggato: PF, CA, livello, classe, razza, gruppo, valuta, slot e incantesimi, inventario.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_party", description: "Legge i personaggi del GRUPPO del giocatore loggato (compagni di party): nomi, classi, livelli, PF, CA.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_riassunti", description: "Legge i riassunti delle sessioni passate. Di default filtra sul gruppo del giocatore (più gli eventi condivisi). Per 'ultima sessione' restituisce i più recenti.", parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Parola chiave opzionale da cercare (es. nome NPC, luogo)" }, party: { type: "STRING", description: "Forza un gruppo specifico: AMEA, ENOX, LAC, LEAF, ECO. Ometti per usare il gruppo del giocatore." } }, required: [] } },
    { name: "leggi_mercato", description: "Legge gli oggetti in vendita al mercato nero (prezzo fisso o asta) con prezzi, rarità e offerta più alta.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_bacheca", description: "Legge le missioni della bacheca visibili al giocatore (mirate al suo gruppo/personaggio o pubbliche).", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_npc", description: "Cerca un NPC per nome, fazione o città.", parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Nome, fazione o città dell'NPC" } }, required: [] } },
    { name: "leggi_geo", description: "Cerca luoghi, città o regioni di Eldoria.", parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Nome del luogo da cercare" } }, required: [] } },
    { name: "leggi_arena", description: "Legge i dati e la classifica dell'arena.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_divinita", description: "Informazioni sulle divinità e il pantheon di Eldoria.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "fai_offerta", description: "Piazza un'offerta su un oggetto del mercato nero IN ASTA (scala il platino dal personaggio). RICHIEDE CONFERMA dell'utente prima di eseguire.", parameters: { type: "OBJECT", properties: { item_id: { type: "STRING", description: "ID dell'oggetto" }, item_nome: { type: "STRING", description: "Nome dell'oggetto" }, importo: { type: "NUMBER", description: "Importo in MP (platino)" } }, required: ["item_id", "item_nome", "importo"] } },
    { name: "accetta_missione", description: "Accetta una missione dalla bacheca a nome del giocatore. RICHIEDE CONFERMA dell'utente prima di eseguire.", parameters: { type: "OBJECT", properties: { quest_id: { type: "STRING", description: "ID della missione" }, quest_titolo: { type: "STRING", description: "Titolo della missione" } }, required: ["quest_id", "quest_titolo"] } },
  ],
};

function buildSystemPrompt(ctx) {
  let who = "Il giocatore non ha ancora una scheda sincronizzata: invitalo a chiedere al Master.";
  if (ctx.name) {
    who = `Il giocatore loggato è **${ctx.name}**` +
      (ctx.char?.class ? `, ${ctx.char.class}` : "") +
      (ctx.char?.level ? ` di livello ${ctx.char.level}` : "") +
      `, e fa parte del gruppo **${ctx.party}**.` +
      (PARTY_ROSTER[ctx.party] ? ` Compagni di gruppo: ${PARTY_ROSTER[ctx.party].join(", ")}.` : "");
  }
  return `Sei l'assistente di gioco per la campagna fantasy Eldoria (sistema D&D 5e).
Sei un AGENTE: non ti limiti a chiacchierare, agisci. Per ogni richiesta consulti i dati reali con gli strumenti, ragioni e dai una risposta utile e concreta.

CONTESTO GIOCATORE (usalo sempre, non chiederlo): ${who}

Quando l'utente dice "il mio gruppo", "il party", "noi", "la nostra sessione", "l'ultima sessione", "riassumi" o "per me", riferisciti SEMPRE al gruppo del giocatore qui sopra (${ctx.party || "sconosciuto"}). Riassunti e missioni sono divisi per gruppo: gli strumenti filtrano già sul gruppo giusto.

COME LAVORI (importante):
- Per QUALSIASI domanda che riguardi dati di gioco, chiama PRIMA lo strumento giusto e poi rispondi sui risultati. Non rispondere mai "non lo so" senza aver provato uno strumento.
  · mercato / oggetti in vendita / aste → leggi_mercato
  · "per me" sul mercato → leggi_mercato e poi evidenzia ciò che è adatto al giocatore (livello Ratto, classe, soldi disponibili).
  · missioni / incarichi / bacheca → leggi_bacheca
  · la mia scheda / PF / incantesimi / inventario / soldi → leggi_scheda
  · il mio gruppo / compagni / party → leggi_party
  · riassunti / cosa è successo / ultima sessione → leggi_riassunti
  · NPC / personaggi → leggi_npc · luoghi / città → leggi_geo · divinità → leggi_divinita · arena → leggi_arena
- Puoi e DEVI usare più strumenti se serve (es. "cosa posso comprare?" → leggi_scheda + leggi_mercato per confrontare i soldi).
- Dopo aver ricevuto i risultati di uno strumento, produci SEMPRE una risposta testuale per il giocatore. Non terminare mai con una chiamata a strumento senza spiegare cosa hai trovato.

STILE:
- Rispondi SEMPRE in italiano, con tono da narratore fantasy ma chiaro e diretto. Vai al punto, usa elenchi quando aiutano.
- Non inventare dati non presenti negli strumenti. Se uno strumento non restituisce nulla, dillo con onestà (es. "Il mercato è vuoto al momento").

AZIONI (scrittura): per fai_offerta e accetta_missione chiama lo strumento, poi nella risposta finale spiega chiaramente cosa stai per fare e chiedi conferma. Non agire mai senza conferma dell'utente.`;
}

// ---- Scrittura: piazza un'offerta in asta (scala platino, scrive bids.UID) ----
async function placeBid(uid, params, apiKey) {
  const item = await readDoc(`items/${params.item_id}`, apiKey);
  if (!item || !item.name) return { ok: false, msg: "❌ Oggetto non più disponibile." };
  if (item.isSold) return { ok: false, msg: "❌ Questo oggetto è già stato venduto." };
  if (item.saleType !== "auction") return { ok: false, msg: "❌ Questo oggetto non è in asta: non si possono fare offerte." };
  const minBid = item.startingBid || 0;
  if (params.importo < minBid) return { ok: false, msg: `❌ L'offerta minima è ${minBid} MP.` };

  const me = await readDoc(`characters/${uid}`, apiKey);
  const platinum = me?.platinum || 0;
  if (platinum < params.importo) return { ok: false, msg: `❌ Platino insufficiente: hai ${platinum} MP, ne servono ${params.importo}.` };

  const charName = me?.name || "Un eroe";
  const okItem = await patchDoc(`items/${params.item_id}`, {
    [`bids.${uid}`]: { amount: params.importo, charName, timestamp: new Date().toISOString() },
  }, apiKey);
  if (!okItem) return { ok: false, msg: "❌ Errore nell'invio dell'offerta. Riprova." };

  await patchDoc(`characters/${uid}`, { platinum: platinum - params.importo }, apiKey);
  return { ok: true, msg: `✅ Offerta di **${params.importo} MP** su **${params.item_nome}** piazzata! Il platino è stato bloccato; verrà rimborsato se non vinci l'asta.` };
}

// ---- Scrittura: accetta una missione ----
async function acceptQuest(uid, params, apiKey) {
  const me = await readDoc(`characters/${uid}`, apiKey);
  if (!me || !me.name) return { ok: false, msg: "❌ Scheda non trovata: impossibile accettare la missione." };
  const party = getPartyByCharName(me.name);
  const ok = await patchDoc(`quests/${params.quest_id}`, {
    acceptedBy: me.name,
    acceptedParty: party,
    status: "in_progress",
  }, apiKey);
  return ok
    ? { ok: true, msg: `✅ Missione **${params.quest_titolo}** accettata a nome di **${me.name}** (gruppo ${party})! Buona fortuna, avventuriero.` }
    : { ok: false, msg: "❌ Errore nell'accettare la missione. Riprova." };
}

async function callGemini(geminiKey, systemPrompt, contents, { useTools = true } = {}) {
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      // Limita il "thinking" così non consuma tutti i token lasciando la risposta vuota,
      // ma ne tiene abbastanza per decidere quali strumenti usare.
      thinkingConfig: { thinkingBudget: 512 },
    },
  };
  if (useTools) body.tools = [TOOLS_DEF];
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return r.json();
}

// Estrae il testo dalle parti, ignorando le parti di "thinking".
function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter(p => p.text && !p.thought).map(p => p.text).join("").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { messages, uid, confirmedAction } = req.body || {};
  const apiKey = process.env.FIREBASE_API_KEY || "AIzaSyBGv3dT_2-ztsAwx0B4s42YtPL-Q1UBMcM";
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) return res.status(500).json({ error: "Chiave Gemini mancante." });
  if (!uid) return res.status(400).json({ error: "UID utente mancante." });

  // ---- Esecuzione azione confermata (scrittura) ----
  if (confirmedAction) {
    const { type, params } = confirmedAction;
    try {
      if (type === "fai_offerta") {
        const r = await placeBid(uid, params, apiKey);
        return res.status(200).json({ reply: r.msg });
      }
      if (type === "accetta_missione") {
        const r = await acceptQuest(uid, params, apiKey);
        return res.status(200).json({ reply: r.msg });
      }
      return res.status(400).json({ error: "Azione non riconosciuta." });
    } catch (e) {
      return res.status(500).json({ error: "Errore azione: " + e.message });
    }
  }

  // ---- Conversazione normale con Gemini ----
  if (!messages || !messages.length) return res.status(400).json({ error: "Messaggi mancanti." });

  try {
    // Carica una volta chi è il giocatore e in che gruppo gioca.
    const playerCtx = await loadPlayerContext(uid, apiKey);
    const ctx = { uid, ...playerCtx };
    const systemPrompt = buildSystemPrompt(ctx);

    const geminiMessages = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    let data = await callGemini(geminiKey, systemPrompt, geminiMessages);
    if (data.error) return res.status(500).json({ error: data.error.message });

    // ---- Ciclo tool use ----
    let pendingAction = null;
    let usedTools = false;
    let iterations = 0;

    while (iterations < 8) {
      iterations++;
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const toolCalls = parts.filter(p => p.functionCall);
      if (!toolCalls.length) break; // nessun tool → risposta finale

      const resultParts = [];
      for (const part of toolCalls) {
        const { name, args } = part.functionCall;
        usedTools = true;

        // Azioni di scrittura → non eseguire, segnalare al frontend per conferma
        if (name === "fai_offerta" || name === "accetta_missione") {
          pendingAction = { type: name, params: args };
          resultParts.push({ functionResponse: { name, response: { result: "RICHIEDE_CONFERMA_UTENTE: l'azione verrà eseguita solo dopo che l'utente conferma nel modale. Riassumi cosa stai per fare e chiedi conferma." } } });
          continue;
        }

        const result = await executeTool(name, args, ctx, apiKey);
        resultParts.push({ functionResponse: { name, response: { result } } });
      }

      geminiMessages.push({ role: "model", parts });
      geminiMessages.push({ role: "user", parts: resultParts });

      data = await callGemini(geminiKey, systemPrompt, geminiMessages);
      if (data.error) return res.status(500).json({ error: data.error.message });
    }

    let reply = extractText(data);

    // Fallback robusto: se il modello ha raccolto dati ma non ha prodotto testo
    // (thinking troppo lungo, MAX_TOKENS, oppure è rimasto bloccato sui tool),
    // forziamo una risposta finale SENZA strumenti usando il contesto già raccolto.
    if (!reply && (usedTools || pendingAction)) {
      geminiMessages.push({
        role: "user",
        parts: [{ text: "Ora rispondi al giocatore in italiano, in modo chiaro e discorsivo, usando SOLO le informazioni già raccolte qui sopra. Se hai trovato dei dati, presentali; non dire che non hai trovato una risposta." }],
      });
      const forced = await callGemini(geminiKey, systemPrompt, geminiMessages, { useTools: false });
      reply = extractText(forced);
    }

    if (!reply) {
      const fr = data?.candidates?.[0]?.finishReason;
      reply = fr === "SAFETY"
        ? "Mi spiace, non posso rispondere a questa richiesta."
        : "Non sono riuscito a formulare una risposta. Riprova a riformulare la domanda.";
    }

    return res.status(200).json({ reply, pendingAction });
  } catch (e) {
    return res.status(500).json({ error: "Errore assistente: " + e.message });
  }
}
