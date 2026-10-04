// api/genera-riassunto.js
// "Cervello" della cronaca di sessione. Riceve le linee guida di ciò che è
// accaduto e le espande in un riassunto nello stile delle memorie di Eldoria
// (voce del "Monaco Errante"). Restituisce JSON pronto per la pagina /riassunti.
// La chiave Anthropic resta qui, nascosta (Vercel).
// Con `contesto` riceve anche l'archivio del mondo letto dal client del Master
// (src/utils/cronacaContext.js): cronache precedenti, prep, diario, PG, NPC, luoghi.

export const config = { maxDuration: 300 };

const SYSTEM = `Sei il Monaco Errante, cronista delle "Cronache di Eldoria": raccogli le gesta delle compagnie di avventurieri sessione dopo sessione e le trascrivi come memorie del reame.

VOCE E STILE
- Prosa narrativa evocativa in ITALIANO, in terza persona, tono da cronaca fantasy d'epoca: atmosfera, immagini vivide, ritmo. Racconti, non elenchi.
- I PROTAGONISTI sono i personaggi del gruppo indicato (usa i loro nomi, che ti vengono forniti). Sono eroi reali del mondo, non "giocatori": non nominare MAI giocatori, sessioni, master, dadi, punti ferita, tiri, livelli, classi, meccaniche o regole. Nessuna quarta parete.
- Resta FEDELE alle linee guida ricevute: racconta ciò che è accaduto, senza inventare svolte importanti non implicate. Puoi arricchire con atmosfera, dettagli sensoriali e dialoghi brevi plausibili, ma non stravolgere i fatti.
- Ancòra i luoghi e le figure ai nomi citati nelle linee guida. Non contraddire l'ambientazione.

CRONACA PRECEDENTE (quando ti viene fornita)
- È la puntata subito prima di questa: leggila TUTTA. La nuova cronaca è il suo seguito: riparte da dove quella si chiude (luogo, situazione, umore), senza ripeterla né riassumerla.
- Continua sulla STESSA LINEA: stessa voce, stesso ritmo, stessa lunghezza indicativa, stessi espedienti (capolettera, sottotitoli di scena, dialoghi in oro) e gli stessi nomi scritti allo stesso modo.

ARCHIVIO DEL MONDO (quando ti viene fornito)
- Prima di scrivere, leggi l'ARCHIVIO: cronache precedenti del gruppo, preparazione del Master, diario dei giocatori, schede dei protagonisti, NPC e luoghi citati.
- Usalo per la COERENZA: nomi scritti giusti, ruoli e fazioni degli NPC, aspetto e carattere dei luoghi, legami con gli eventi passati, fili lasciati aperti. Un breve richiamo a ciò che è accaduto prima dà continuità: fallo, ma senza riassumere le cronache vecchie.
- I FATTI di questa sessione sono SOLO quelli delle linee guida. La preparazione del Master dice cosa era previsto, non cosa è successo: non raccontare scene della prep che le linee guida non citano. Se archivio e linee guida si contraddicono, vincono le linee guida.

FORMATO
- "title": SOLO il NOME evocativo di questa cronaca (es. "Il Lago dei Druidi Inventati"): niente "Cronaca di Obia", niente "Vol.", niente numeri, niente virgolette. La parte "Cronaca di Obia, Vol. N" la aggiunge l'app.
- "subTitle": la frase d'apertura in esergo, di una o due righe, NELLO STESSO STILE del sottotitolo della cronaca precedente (se c'è: stessa costruzione, stesso tono, es. "Vi sono… E vi sono…"), ma con parole nuove.
- "contentHtml": la cronaca completa in HTML, con formattazione ricca ESATTAMENTE come le memorie esistenti. Usa questi tag/stili e NIENT'ALTRO:
  · <p> per ogni paragrafo.
  · <b>…</b> per il testo IMPORTANTE (nomi propri di personaggi/luoghi al primo emergere, oggetti chiave, colpi di scena, esiti decisivi).
  · <span style="color:var(--gold)">…</span> per i DIALOGHI (battute pronunciate) e per i frammenti più solenni o evocativi.
  · <i>…</i> per pensieri interiori, presagi o enfasi lieve.
  · <h3 style="color:var(--gold); border-bottom: 1px solid #444; padding-bottom: 5px;">…</h3> per eventuali sottotitoli di scena (usane 0-3, solo se la sessione ha fasi nette).
  · <blockquote>…</blockquote> per una profezia o citazione isolata (facoltativo).
  · Puoi aprire la cronaca con un capolettera: avvolgi SOLO la prima lettera del primo paragrafo in <span class="start">L</span>.
  NIENTE <html>, <body>, <script>, immagini, link, o altri stili inline diversi da quelli indicati. Da 4 a 8 paragrafi, coerenti con la mole delle linee guida. Non abusare dell'oro/grassetto: evidenzia solo ciò che conta davvero.
- "scenePrompts": un ARRAY di 5 descrizioni, in INGLESE, di 5 MOMENTI DIVERSI e distinti della sessione (NON varianti della stessa scena). Ogni voce è una scena diversa per luogo, azione e personaggi coinvolti (es. un'imboscata nel bosco, un dialogo teso in una sala del trono, la scoperta di una cripta, un duello, una fuga sotto la pioggia…), ciascuna pensata per un illustratore (soggetto, ambientazione, atmosfera, luce). Nessun testo o scritta nell'immagine, nessuna cornice.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo prima o dopo, senza backtick, in questa forma esatta:
{"title":"","subTitle":"","contentHtml":"","scenePrompts":["","","","",""]}`;

function buildUserMessage({ party, roster, date, linee, contesto, precedente, seme }) {
  const prev = precedente && precedente.text
    ? [
        "=== CRONACA PRECEDENTE (questa nuova ne è il seguito) ===",
        `Titolo: ${precedente.title || ""}`,
        precedente.subTitle ? `Sottotitolo: ${precedente.subTitle}` : "",
        String(precedente.text).slice(0, 12000),
        "=== FINE CRONACA PRECEDENTE ===\n",
      ].filter(Boolean).join("\n")
    : "";
  const gruppo = party ? `Gruppo "${party}"${roster ? ` (${roster})` : ""}` : "una compagnia di avventurieri";
  return [
    prev,
    contesto ? "=== ARCHIVIO DEL MONDO (consultalo per coerenza; non è la sessione da raccontare) ===" : "",
    contesto ? String(contesto).slice(0, 40000) : "",
    contesto ? "=== FINE ARCHIVIO ===\n" : "",
    `Scrivi la cronaca dell'ultima sessione per ${gruppo}.`,
    date ? `Data in gioco: ${date}.` : "",
    "",
    "LINEE GUIDA DI CIÒ CHE È ACCADUTO (fonte di verità, rispettale):",
    String(linee || "").trim() || "(nessun dettaglio fornito: componi una cronaca breve e sobria)",
    "",
    `Seme di variazione ${seme}: se ti viene chiesto di rigenerare, cambia taglio, incipit e immagini pur restando fedele agli stessi fatti.`,
  ].filter(Boolean).join("\n");
}

// Estrae il JSON tollerando fence o testo attorno, e chiude un JSON troncato.
function parseContent(text) {
  let t = String(text || "").replace(/```json|```/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    // Ultimo tentativo: taglia all'ultimo campo completo e richiudi.
    const cut = Math.max(t.lastIndexOf('",'), t.lastIndexOf('"}'));
    if (cut > 0) {
      let p = t.substring(0, cut + 2);
      const openO = (p.match(/\{/g) || []).length - (p.match(/\}/g) || []).length;
      p += "}".repeat(Math.max(0, openO));
      return JSON.parse(p);
    }
    throw new Error("JSON non interpretabile.");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { party, roster, date, linee, contesto, precedente } = req.body || {};
  if (!String(linee || "").trim()) {
    return res.status(400).json({ error: "Servono le linee guida di ciò che è accaduto." });
  }
  const seme = Math.floor(Math.random() * 1e9);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 6000,
        system: SYSTEM,
        messages: [{ role: "user", content: buildUserMessage({ party, roster, date, linee, contesto, precedente, seme }) }],
      }),
    });

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const testo = (data.content || []).map((b) => b.text || "").join("");
    const out = parseContent(testo);
    const rawScenes = Array.isArray(out.scenePrompts)
      ? out.scenePrompts
      : (out.scenePrompt ? [out.scenePrompt] : []);
    const scenePrompts = rawScenes.map((s) => String(s || "").trim()).filter(Boolean);
    return res.status(200).json({
      title: String(out.title || "").trim(),
      subTitle: String(out.subTitle || "").trim(),
      contentHtml: String(out.contentHtml || "").trim(),
      scenePrompts,
      scenePrompt: scenePrompts[0] || "", // retrocompatibilità
    });
  } catch (e) {
    return res.status(500).json({ error: "Generazione fallita: " + e.message });
  }
}
