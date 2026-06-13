// api/assistente.js
// Assistente player di Eldoria — powered by Gemini (gratuito).
// Legge da Firestore, propone azioni con conferma obbligatoria prima di scrivere.
//
// STRUMENTI disponibili:
//   leggi_scheda, leggi_mercato, leggi_bacheca, leggi_riassunti,
//   leggi_npc, leggi_geo, leggi_crafting, leggi_arena, leggi_party
//   fai_offerta (SCRITTURA — richiede conferma frontend)
//   accetta_missione (SCRITTURA — richiede conferma frontend)
//
// Il backend NON esegue mai azioni di scrittura direttamente:
// restituisce { action: { type, params, label } } e aspetta che il
// frontend mandi { confirmedAction: { type, params } } per eseguire.

const PROJECT_ID = "eldoria-web";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ---- Pantheon (già conosciuto, non serve leggerlo da Firestore) ----
const PANTHEON_BRIEF = `Vecchie divinità: Vulkàros(fuoco/guerra), Nysia(acqua/vita/morte), Syrael(aria/profezia), Drokhan(terra/giustizia), Enoia(spirito/destino), Lirael(arte/memoria), Myrhal(magia/segreti), Zenara(natura/bestie), Kal-Durr(tempo/fato), Naavir(inganno/ombre).
Nuovi dei: Malakor(ordine/contratti distorto), Venestra(amore ossessivo/disperazione), Xylos(sfortuna), Sune(bellezza/amore buono).
Divinità malvagie: Morgath(magia corrotta/fame), Xul'Korah(inganno/malattie), Thal-Grimor(guerra crudele/tirannia), Malakhia(oblio/follia/vuoto).`;

// ---- Leggi una collection Firestore ----
async function readCollection(name, apiKey, limit = 20) {
  const url = `${FS_BASE}/${name}?key=${apiKey}&pageSize=${limit}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.documents || []).map(d => firestoreDocToObj(d));
}

// ---- Leggi un singolo documento ----
async function readDoc(path, apiKey) {
  const url = `${FS_BASE}/${path}?key=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const data = await r.json();
  return firestoreDocToObj(data);
}

// ---- Patch un documento (solo campi specifici) ----
async function patchDoc(path, fields, apiKey) {
  const mask = Object.keys(fields).map(f => `updateMask.fieldPaths=${f}`).join("&");
  const url = `${FS_BASE}/${path}?key=${apiKey}&${mask}`;
  const body = { fields: {} };
  for (const [k, v] of Object.entries(fields)) {
    body.fields[k] = typeof v === "number" ? { integerValue: String(v) }
      : typeof v === "boolean" ? { booleanValue: v }
      : { stringValue: String(v) };
  }
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.ok;
}

// ---- Converte documento Firestore in oggetto JS semplice ----
function firestoreDocToObj(doc) {
  if (!doc || !doc.fields) return {};
  const obj = { _id: doc.name?.split("/").pop() };
  for (const [k, v] of Object.entries(doc.fields)) {
    obj[k] = extractValue(v);
  }
  return obj;
}
function extractValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return Number(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.mapValue) return firestoreDocToObj(v.mapValue);
  if (v.arrayValue) return (v.arrayValue.values || []).map(extractValue);
  return null;
}

// ---- Esegui uno strumento (lettura) ----
async function executeTool(toolName, toolInput, uid, apiKey) {
  switch (toolName) {
    case "leggi_scheda": {
      const doc = await readDoc(`characters/${uid}`, apiKey);
      if (!doc) return "Scheda non trovata. Chiedi al Master di sincronizzarla da Foundry.";
      return JSON.stringify({
        nome: doc.name, classe: doc.class, livello: doc.level,
        race: doc.race, pf: doc.stats?.hp, maxPf: doc.stats?.maxHp,
        ca: doc.stats?.ac, oro: doc.currency,
        incantesimi: (doc.actions || []).filter(a => a.category?.includes("Livello") || a.category === "Trucchetto").map(a => a.name),
        inventario: (doc.inventory || []).slice(0, 10).map(i => `${i.name} x${i.quantity}`)
      });
    }
    case "leggi_mercato": {
      const items = await readCollection("items", apiKey, 30);
      if (!items.length) return "Il mercato nero è vuoto al momento.";
      return JSON.stringify(items.map(i => ({ id: i._id, nome: i.name || i.nome, prezzo: i.price || i.prezzo, descrizione: i.description || i.descrizione, scadenza: i.expiresAt || i.scadenza })));
    }
    case "leggi_bacheca": {
      const quests = await readCollection("quests", apiKey, 20);
      if (!quests.length) return "Nessuna missione in bacheca al momento.";
      return JSON.stringify(quests.map(q => ({ id: q._id, titolo: q.title || q.titolo, descrizione: q.description || q.descrizione, stato: q.status || q.stato, ricompensa: q.reward || q.ricompensa })));
    }
    case "leggi_riassunti": {
      const summaries = await readCollection("summaries", apiKey, 10);
      if (!summaries.length) return "Nessun riassunto di sessione trovato.";
      const query = (toolInput?.query || "").toLowerCase();
      const filtered = query
        ? summaries.filter(s => JSON.stringify(s).toLowerCase().includes(query))
        : summaries;
      return JSON.stringify(filtered.slice(0, 5).map(s => ({ id: s._id, titolo: s.title || s.titolo, data: s.date || s.data, testo: (s.content || s.testo || "").substring(0, 400) + "..." })));
    }
    case "leggi_npc": {
      const npcs = await readCollection("npcs", apiKey, 50);
      const query = (toolInput?.query || "").toLowerCase();
      const filtered = query
        ? npcs.filter(n => JSON.stringify(n).toLowerCase().includes(query))
        : npcs.slice(0, 10);
      if (!filtered.length) return `Nessun NPC trovato${query ? ` per "${toolInput.query}"` : ""}.`;
      return JSON.stringify(filtered.map(n => ({ nome: n.name || n.nome, ruolo: n.role || n.ruolo, descrizione: n.description || n.descrizione, segreto: n.secret || n.segreto })));
    }
    case "leggi_geo": {
      const places = await readCollection("geo_visit", apiKey, 50);
      const query = (toolInput?.query || "").toLowerCase();
      const filtered = query
        ? places.filter(p => JSON.stringify(p).toLowerCase().includes(query))
        : places.slice(0, 10);
      if (!filtered.length) return `Nessun luogo trovato${query ? ` per "${toolInput.query}"` : ""}.`;
      return JSON.stringify(filtered.map(p => ({ nome: p.name || p.nome, tipo: p.type || p.tipo, descrizione: p.description || p.descrizione })));
    }
    case "leggi_crafting": {
      const items = await readCollection("crafting", apiKey, 30);
      if (!items.length) return "Nessuna ricetta di crafting trovata.";
      return JSON.stringify(items.map(i => ({ nome: i.name || i.nome, materiali: i.materials || i.materiali, risultato: i.result || i.risultato })));
    }
    case "leggi_arena": {
      const entries = await readCollection("arena", apiKey, 20);
      if (!entries.length) return "Nessun dato arena trovato.";
      return JSON.stringify(entries.slice(0, 10));
    }
    case "leggi_party": {
      const chars = await readCollection("characters", apiKey, 30);
      return JSON.stringify(chars.map(c => ({ nome: c.name, classe: c.class, livello: c.level, pf: c.stats?.hp, maxPf: c.stats?.maxHp })));
    }
    case "leggi_divinita": {
      return PANTHEON_BRIEF;
    }
    default:
      return "Strumento non riconosciuto.";
  }
}

// ---- Definizioni strumenti per Gemini ----
const TOOLS_DEF = {
  function_declarations: [
    { name: "leggi_scheda", description: "Legge la scheda del player loggato (PF, CA, livello, inventario, incantesimi, oro).", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_mercato", description: "Legge gli oggetti in vendita al mercato nero con prezzi e scadenze.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_bacheca", description: "Legge le missioni disponibili sulla bacheca della gilda.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_riassunti", description: "Cerca nei riassunti delle sessioni passate.", parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Parola chiave da cercare (es. 'Hemile', 'sessione 3')" } }, required: [] } },
    { name: "leggi_npc", description: "Cerca un NPC per nome o caratteristica.", parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Nome o ruolo dell'NPC da cercare" } }, required: [] } },
    { name: "leggi_geo", description: "Cerca luoghi, città o regioni di Eldoria.", parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Nome del luogo da cercare" } }, required: [] } },
    { name: "leggi_crafting", description: "Legge le ricette di crafting disponibili.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_arena", description: "Legge la classifica e i dati dell'arena.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_party", description: "Legge i dati di tutti i personaggi del party.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_divinita", description: "Ottieni informazioni sulle divinità e il pantheon di Eldoria.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "fai_offerta", description: "Fa un'offerta su un oggetto del mercato nero. RICHIEDE CONFERMA dell'utente prima di eseguire.", parameters: { type: "OBJECT", properties: { item_id: { type: "STRING", description: "ID dell'oggetto" }, item_nome: { type: "STRING", description: "Nome dell'oggetto" }, importo: { type: "NUMBER", description: "Importo in mp" } }, required: ["item_id", "item_nome", "importo"] } },
    { name: "accetta_missione", description: "Accetta una missione dalla bacheca. RICHIEDE CONFERMA dell'utente prima di eseguire.", parameters: { type: "OBJECT", properties: { quest_id: { type: "STRING", description: "ID della missione" }, quest_titolo: { type: "STRING", description: "Titolo della missione" } }, required: ["quest_id", "quest_titolo"] } }
  ]
};

const SYSTEM_PROMPT = `Sei l'assistente di gioco per la campagna fantasy Eldoria (sistema D&D 5e).
Aiuti i giocatori a consultare le informazioni della campagna e a compiere azioni nel gioco.
Rispondi SEMPRE in italiano, in modo conciso e coinvolgente, con lo stile di un narratore fantasy.
Usa gli strumenti disponibili per rispondere a domande su scheda, mercato, missioni, NPC, luoghi, sessioni passate, divinità, crafting, arena.
Per le azioni (offerte, missioni): usa lo strumento corretto, poi nella risposta finale indica chiaramente cosa stai per fare e chiedi conferma — non agire mai senza che l'utente confermi.
Non inventare mai informazioni non presenti negli strumenti. Se non trovi qualcosa, dillo chiaramente.`;

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
        const ok = await patchDoc(`items/${params.item_id}`, {
          offerta: params.importo, offertaUid: uid, offertaNome: params.item_nome
        }, apiKey);
        return res.status(200).json({ reply: ok ? `✅ Offerta di **${params.importo} mp** su **${params.item_nome}** inviata! Il Master vedrà la tua offerta.` : "❌ Errore nell'invio dell'offerta. Riprova." });
      }
      if (type === "accetta_missione") {
        const ok = await patchDoc(`quests/${params.quest_id}`, {
          accettata: true, accettataUid: uid
        }, apiKey);
        return res.status(200).json({ reply: ok ? `✅ Missione **${params.quest_titolo}** accettata! Buona fortuna, avventuriero.` : "❌ Errore nell'accettare la missione. Riprova." });
      }
      return res.status(400).json({ error: "Azione non riconosciuta." });
    } catch (e) {
      return res.status(500).json({ error: "Errore azione: " + e.message });
    }
  }

  // ---- Conversazione normale con Gemini ----
  if (!messages || !messages.length) return res.status(400).json({ error: "Messaggi mancanti." });

  const geminiMessages = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  try {
    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: geminiMessages,
          tools: [TOOLS_DEF]
        })
      }
    );

    let data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    // ---- Ciclo tool use ----
    const toolResults = [];
    let pendingAction = null;
    let iterations = 0;

    while (iterations < 6) {
      iterations++;
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const toolCalls = parts.filter(p => p.functionCall);

      if (!toolCalls.length) break; // nessun tool → risposta finale

      // Esegui ogni tool call
      const resultParts = [];
      for (const part of toolCalls) {
        const { name, args } = part.functionCall;

        // Azioni di scrittura → non eseguire, segnalare al frontend
        if (name === "fai_offerta" || name === "accetta_missione") {
          pendingAction = { type: name, params: args };
          resultParts.push({ functionResponse: { name, response: { result: "RICHIEDE_CONFERMA_UTENTE" } } });
          continue;
        }

        const result = await executeTool(name, args, uid, apiKey);
        toolResults.push({ tool: name, result });
        resultParts.push({ functionResponse: { name, response: { result } } });
      }

      // Rimanda i risultati a Gemini
      geminiMessages.push({ role: "model", parts });
      geminiMessages.push({ role: "user", parts: resultParts });

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: geminiMessages,
            tools: [TOOLS_DEF]
          })
        }
      );
      data = await response.json();
      if (data.error) return res.status(500).json({ error: data.error.message });
    }

    const finalParts = data?.candidates?.[0]?.content?.parts || [];
    const reply = finalParts.filter(p => p.text).map(p => p.text).join("") || "Non ho trovato una risposta.";

    return res.status(200).json({ reply, pendingAction });
  } catch (e) {
    return res.status(500).json({ error: "Errore assistente: " + e.message });
  }
}