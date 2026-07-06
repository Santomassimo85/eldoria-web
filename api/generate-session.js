// api/generate-session.js
// Genera la PREP di una sessione D&D come HTML stand-alone, nello stile del
// template grafico fornito, usando il contesto narrativo del party.
// Strumento privato (solo master) — l'autorizzazione è lato client/rotta.
//
// Input (POST JSON):
//   party, world, groupCharacters[], closingChronicle   // meta party
//   sessionNumber, suggestedTitle, focus, involvedCharacters[], durata, note  // form
//   templateHtml            // [A] guscio grafico (reference_sessions/sessione_20.html)
//   pastSummaries[]         // [B-a] riassunti sessioni passate (ordine cronologico)
//   lastSessionHtml         // [B-b] HTML intero dell'ultima sessione (contesto "dove sono ora")
//
// Output: stream di testo plain col formato:
//   ---HTML---\n<!DOCTYPE html>…\n---SUMMARY---\n{ "panoramica","bottino","ganciAperti" }

// 800s: tetto massimo del piano Vercel Pro (con Fluid Compute). Serve tempo:
// una sessione completa e ricca può richiedere svariati minuti di generazione.
// Su Hobby Vercel ricappa automaticamente a 300s (nessun errore, solo meno tempo).
export const config = { maxDuration: 800 };

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

// Durata scelta → struttura in atti (passata nel prompt).
const DURATION_PLAN = {
  "2h":    "3 atti da ~40 minuti ciascuno (data-duration timer: 2400s)",
  "2.30h": "3 atti da ~50 minuti ciascuno (data-duration timer: 3000s)",
  "3h":    "4 atti da ~45 minuti ciascuno (data-duration timer: 2700s)",
  "3.30h": "4 atti da ~52 minuti ciascuno (data-duration timer: 3120s)",
  "4h":    "4-5 atti da ~50 minuti ciascuno (data-duration timer: 3000s)",
};

function toRoman(num) {
  const n = parseInt(num, 10);
  if (!Number.isFinite(n) || n <= 0) return String(num || "");
  const map = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let r = "", x = n;
  for (const [v, s] of map) while (x >= v) { r += s; x -= v; }
  return r;
}

function buildSystem({ party, world, closingChronicle, durata, actsPlan }) {
  return `Sei un assistente esperto di Dungeon Master per il party ${party} della campagna "Crit Happens" di Luca, ambientata in ${world}. Generi la PREPARAZIONE di UNA sessione di D&D 5e come singolo documento HTML stand-alone (CSS e JS inline, nessuna dipendenza esterna). È uno strumento PRIVATO per il DM: una traccia dettagliata da seguire al tavolo.

[INPUT A — TEMPLATE GRAFICO]
Riceverai un file HTML di riferimento. Serve SOLO come modello grafico/strutturale: riusa la sua struttura, le sue classi CSS, i suoi widget (nav-tabs a scomparsa, timer per atto con data-duration, .scene, .combat-card con .enemy-grid/.enemy-card, .quote, .info-box, .crypt-box, .twist-box, .missive-box, .npc-card, keyword span colorati) e il layout responsive. IGNORA COMPLETAMENTE il suo contenuto narrativo (personaggi, luoghi, trama del template): è di un'altra sessione e non c'entra.
NON scrivere NESSUN blocco <script>: il JavaScript (switch tab, timer, collassabili) viene iniettato dall'app che mostra il documento. A te servono solo markup e CSS, con le STESSE classi e gli STESSI attributi del template (.tab-btn con data-tab, .tab-content con id corrispondente, .collapsible-header, .timer-widget con .timer-display data-duration e .timer-btn data-action start/pause/reset). Il primo .tab-btn e il primo .tab-content devono avere già la classe "active".

[PALETTE]
Scegli una palette tematica NUOVA e DIVERSA a ogni sessione, coerente col mood di QUESTA sessione (es. gelo/notte, foresta, fuoco, mare, sacro, veleno…). Ridefinisci le variabili CSS in :root con colori adatti al tema. NON copiare pedissequamente la palette del template.

[CONTINUITÀ — INPUT B]
Riceverai il contesto narrativo del party: i riassunti delle sessioni passate (ordine cronologico) e l'HTML dell'ultima sessione. Usali per garantire continuità: riprendi ganci aperti, NPC, luoghi, oggetti e cliffhanger. NON contraddire la storia. Se non c'è contesto passato, tratta questa come una sessione d'apertura coerente col mondo.

[FILI DA RIPRENDERE]
Il DM può indicarti dei "fili" della campagna che vuole far tornare in QUESTA sessione (es. "Il Corvo", "La Mummia"). Se presenti, DEVI intrecciarli nella trama in modo naturale e sensato — non forzato, non tutti in blocco: falli riemergere con tempismo (un ricomparire, una rivelazione, una conseguenza) coerente con dove si trovano i personaggi e con la loro storia passata. Ogni filo indicato deve avere un momento riconoscibile nella sessione.

[MONDO ESISTENTE — INPUT C]
Riceverai l'elenco delle CITTÀ/LUOGHI e degli NPC che già esistono nel mondo (archivio geografico + anagrafe). REGOLE:
- RIUSA i luoghi e gli NPC esistenti ogni volta che è plausibile, invece di inventarne di nuovi. La coerenza col mondo già scritto viene prima dell'originalità.
- Sii PRECISO: se ambienti una scena in una città presente nell'elenco, usa i suoi NPC reali (nome, ruolo, fazione) e i dettagli della sua descrizione. Es.: se in quella città vive un arcanista o un re già schedati, sono LORO a comparire, con i loro nomi esatti.
- Puoi creare un nuovo luogo/NPC SOLO se la trama lo richiede davvero e nessuno di quelli esistenti è adatto; in tal caso rendilo coerente col mondo.
- Non contraddire descrizioni, ruoli o fazioni degli elementi esistenti. Nomi esatti come nell'elenco.

[STRUTTURA]
Questa sessione deve avere: ${actsPlan}. Header con numero sessione in numeri romani, titolo, sottotitolo-citazione, riga data. meta-bar (Durata, Party, Luogo, Focus). nav-tabs: Panoramica + un tab per Atto + "Bottino & Indizi" + "Note DM". Timer con data-duration corretto per ogni atto. Combat con stat block concreti (CA, PF, attacchi +bonus, danni in dadi, TS/CD, tratti). Chiudi con una citazione delle "${closingChronicle}".

[BUDGET — PRIORITÀ ASSOLUTA]
Il documento deve arrivare COMPLETO fino a </html>, con il pannello .tab-content di OGNI tab dichiarato nella nav. Un documento troncato è INUTILIZZABILE. Per starci nel budget:
- COMPATTA il CSS: niente commenti, niente righe vuote, selettori sulla stessa riga. Riusa le classi del template ma non ricopiarne la formattazione estesa.
- Se lo spazio stringe, ACCORCIA la prosa degli atti — non omettere MAI un pannello.

[REGOLE DI STILE]
- Prosa in ITALIANO. Tono epico ma non pomposo, concreto.
- Dialoghi in corsivo con virgolette basse: «così».
- Meccaniche D&D 5e reali e giocabili (CA, PF, TS su caratteristica, CD, danni in dadi, condizioni).
- Sii COMPLETO ma ECONOMICO: contenuto ricco e utile al tavolo, senza prolissità. Priorità alla giocabilità.

[OUTPUT — formato ESATTO, nient'altro]
Rispondi SOLO così, senza testo prima o dopo, senza backticks:
---HTML---
<!DOCTYPE html> … documento completo stand-alone …
---SUMMARY---
{"panoramica": "...", "bottino": "...", "ganciAperti": "..."}
Il blocco SUMMARY deve essere JSON valido su una riga o poche righe.`;
}

function buildUserMessage(b) {
  const roman = toRoman(b.sessionNumber);
  const past = Array.isArray(b.pastSummaries) && b.pastSummaries.length
    ? b.pastSummaries.map((s) => {
        const sum = s.summary || {};
        const txt = typeof s.summary === "string"
          ? s.summary
          : [sum.panoramica, sum.bottino && `Bottino: ${sum.bottino}`, sum.ganciAperti && `Ganci: ${sum.ganciAperti}`].filter(Boolean).join(" — ");
        return `• Sessione ${s.sessionNumber ?? "?"}${s.title ? ` "${s.title}"` : ""}: ${txt || "(nessun riassunto)"}`;
      }).join("\n")
    : "(nessuna sessione passata registrata — è un inizio)";

  const lastHtml = b.lastSessionHtml
    ? String(b.lastSessionHtml).slice(0, 24000) // cap input per latenza
    : "(nessuna sessione precedente)";

  const threads = Array.isArray(b.resumeThreads) && b.resumeThreads.length
    ? b.resumeThreads.map((t) => `• ${t.label}${t.note ? ` — ${t.note}` : ""}`).join("\n")
    : "";

  const cities = Array.isArray(b.worldCities) && b.worldCities.length
    ? b.worldCities.map((c) => `• ${c.name}${c.continent ? ` (${c.continent})` : ""}${c.desc ? `: ${c.desc}` : ""}`).join("\n")
    : "(nessuna città in archivio)";

  // NPC raggruppati per città per rendere evidenti i legami luogo→personaggi.
  const npcList = Array.isArray(b.worldNpcs) ? b.worldNpcs : [];
  const npcByCity = npcList.reduce((acc, n) => {
    const key = n.city || "Erranti / senza sede";
    (acc[key] = acc[key] || []).push(n);
    return acc;
  }, {});
  const npcs = Object.keys(npcByCity).length
    ? Object.keys(npcByCity)
        .map((city) => {
          const rows = npcByCity[city]
            .map((n) => `   - ${n.name}${n.faction ? ` [${n.faction}]` : ""}${n.desc ? `: ${n.desc}` : ""}`)
            .join("\n");
          return `📍 ${city}:\n${rows}`;
        })
        .join("\n")
    : "(nessun NPC in anagrafe)";

  return `RICHIESTA DEL DM per la Sessione ${roman} (numero ${b.sessionNumber}) del party ${b.party}.

Mondo: ${b.world}
Personaggi del gruppo: ${(b.groupCharacters || []).join(", ") || "—"}
Personaggi coinvolti in questa sessione: ${(b.involvedCharacters || []).join(", ") || "tutti"}
Titolo suggerito: ${b.suggestedTitle || "(scegli tu un titolo evocativo)"}
Durata prevista: ${b.durata || "—"}

FOCUS DELLA SESSIONE (cosa deve succedere):
${b.focus || "(libero — proponi tu uno sviluppo coerente con la continuità)"}

NOTE AGGIUNTIVE DEL DM:
${b.note || "(nessuna)"}

FILI DELLA CAMPAGNA DA FAR TORNARE IN QUESTA SESSIONE (intrecciali con tempismo, in modo naturale):
${threads || "(nessuno indicato)"}

========================================
[INPUT A] TEMPLATE GRAFICO (usa SOLO la forma, ignora il contenuto):
${b.templateHtml || "(template mancante)"}

========================================
[INPUT B-a] RIASSUNTI DELLE SESSIONI PASSATE (ordine cronologico):
${past}

[INPUT B-b] HTML DELL'ULTIMA SESSIONE (contesto dettagliato "dove sono ora"):
${lastHtml}

========================================
[INPUT C-1] CITTÀ E LUOGHI ESISTENTI (riusali, non inventarne di nuovi se puoi):
${cities}

[INPUT C-2] NPC ESISTENTI, per città (usa i loro nomi e ruoli esatti quando ambienti lì):
${npcs}

========================================
Genera ora la Sessione ${roman} nel formato richiesto (---HTML--- poi ---SUMMARY---).`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY mancante" });

  const b = req.body || {};
  if (!b.party || !b.sessionNumber) return res.status(400).json({ error: "Servono party e sessionNumber." });
  if (!b.templateHtml) return res.status(400).json({ error: "Template grafico mancante." });

  const actsPlan = DURATION_PLAN[b.durata] || "4 atti da ~45 minuti ciascuno";
  const system = buildSystem({
    party: b.party, world: b.world || "", closingChronicle: b.closingChronicle || "Cronache",
    durata: b.durata, actsPlan,
  });
  const userMsg = buildUserMessage(b);

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 32000, // Opus 4.8 arriva a 128K; 32K ≈ 120KB HTML = sessione molto ricca
        stream: true,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errTxt = await upstream.text().catch(() => "");
      return res.status(502).json({ error: `Upstream ${upstream.status}: ${errTxt.slice(0, 300)}` });
    }

    // Leggiamo in STREAMING da Anthropic (la connessione resta viva durante la
    // generazione lunga), ma verso il client accumuliamo e rispondiamo UNA
    // volta sola in JSON: lo streaming Node→browser su Vercel viene reciso dopo
    // pochi KB ("network error"). Stesso schema degli altri endpoint che vanno.
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let full = "";
    let streamErr = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === "content_block_delta" && ev.delta?.text) {
            full += ev.delta.text;
          } else if (ev.type === "error") {
            streamErr = ev.error?.message || "errore di streaming upstream";
          }
        } catch { /* riga SSE non-JSON: ignora */ }
      }
    }

    if (!full) return res.status(502).json({ error: streamErr || "Nessun contenuto generato." });
    return res.status(200).json({ text: full, ...(streamErr ? { warning: streamErr } : {}) });
  } catch (e) {
    if (!res.headersSent) return res.status(500).json({ error: "Generazione fallita: " + e.message });
    try { res.end(); } catch { /* noop */ }
  }
}
