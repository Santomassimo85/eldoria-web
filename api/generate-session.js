// api/generate-session.js
// Genera la PREP di una sessione D&D come HTML stand-alone, nello stile del
// template grafico fornito, usando il contesto narrativo del party.
// Strumento privato (solo master) — l'autorizzazione è lato client/rotta.
//
// Input (POST JSON):
//   party, world, groupCharacters[], closingChronicle   // meta party
//   sessionNumber, suggestedTitle, focus, involvedCharacters[], durata, note  // form
//   templateHtml            // [A] guscio grafico (reference_sessions/sessione_20.html)
//   recaps[]                // [B-a] riassunti REALI (summaries) del gruppo, cronologici: { n, title, date, text }
//   preps[]                 // [B-b] prep già generate (dm_sessions): cosa era PREVISTO, non accaduto
//   lastPrepText            // [B-c] testo dell'ultima prep generata (senza CSS)
//   pastSummaries[] / lastSessionHtml  // forma vecchia, ancora accettata
//   mode                    // "draft" = solo la BOZZA (JSON), niente HTML
//   approvedDraft           // bozza approvata dal DM: la sessione completa la deve seguire
//   previousDraft, draftFeedback  // per "Rifai": bozza scartata + indicazioni del DM
//
// Output: JSON { text } (---HTML--- <!DOCTYPE html>… ---SUMMARY--- {…})
//         oppure { draft } in modalità bozza.

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
Riceverai il contesto narrativo del party:
- i RIASSUNTI delle sessioni giocate (ordine cronologico): sono la VERITÀ, è ciò che è accaduto davvero. L'ULTIMO riassunto dice dove si trova il gruppo ORA: la sessione riparte da lì.
- le PREP delle sessioni precedenti: dicono cosa il DM aveva PREVISTO. Non è detto che sia andata così: se una prep contraddice i riassunti, vincono i riassunti; quello che nella prep non è stato giocato puoi riusarlo solo se ha ancora senso.
Usali per garantire continuità: riprendi ganci aperti, NPC, luoghi, oggetti e cliffhanger. NON contraddire la storia. Se non c'è contesto passato, tratta questa come una sessione d'apertura coerente col mondo.

[BOZZA APPROVATA]
Se ricevi una BOZZA APPROVATA dal DM, è il piano vincolante: stessi atti nello stesso ordine, stessi luoghi, scontri, NPC, colpo di scena, bottino e finale. Il tuo compito è svilupparla in una prep completa e giocabile, non cambiarla.

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

function buildPast(b) {
  // Forma nuova: riassunti veri + prep separate.
  if (Array.isArray(b.recaps) || Array.isArray(b.preps)) {
    const recaps = (b.recaps || []).map((r) =>
      `• Sessione ${r.n}${r.title ? ` «${r.title}»` : ""}${r.date ? ` (${r.date})` : ""}:\n${r.text || "(vuoto)"}`
    ).join("\n\n") || "(nessun riassunto: è un inizio)";
    const preps = (b.preps || []).map((s) => {
      const sum = s.summary || {};
      const txt = [sum.panoramica, sum.ganciAperti && `Ganci: ${sum.ganciAperti}`].filter(Boolean).join(" — ");
      return `• Prep sessione ${s.sessionNumber ?? "?"}${s.title ? ` «${s.title}»` : ""}: ${txt || "(nessun sunto)"}`;
    }).join("\n") || "(nessuna prep precedente)";
    const last = b.lastPrepText ? String(b.lastPrepText).slice(0, 10000) : "(nessuna)";
    return `[INPUT B-a] RIASSUNTI DELLE SESSIONI GIOCATE — LA VERITÀ (ordine cronologico, l'ultimo = dove sono ora):
${recaps}

[INPUT B-b] PREP DELLE SESSIONI PRECEDENTI — cosa era PREVISTO (non necessariamente accaduto):
${preps}

[INPUT B-c] TESTO DELL'ULTIMA PREP GENERATA (dettaglio di cosa era previsto):
${last}`;
  }
  // Forma vecchia.
  const past = Array.isArray(b.pastSummaries) && b.pastSummaries.length
    ? b.pastSummaries.map((s) => {
        const sum = s.summary || {};
        const txt = typeof s.summary === "string"
          ? s.summary
          : [sum.panoramica, sum.bottino && `Bottino: ${sum.bottino}`, sum.ganciAperti && `Ganci: ${sum.ganciAperti}`].filter(Boolean).join(" — ");
        return `• Sessione ${s.sessionNumber ?? "?"}${s.title ? ` "${s.title}"` : ""}: ${txt || "(nessun riassunto)"}`;
      }).join("\n")
    : "(nessuna sessione passata registrata — è un inizio)";
  const lastHtml = b.lastSessionHtml ? String(b.lastSessionHtml).slice(0, 24000) : "(nessuna sessione precedente)";
  return `[INPUT B-a] RIASSUNTI DELLE SESSIONI PASSATE (ordine cronologico):
${past}

[INPUT B-b] HTML DELL'ULTIMA SESSIONE (contesto dettagliato "dove sono ora"):
${lastHtml}`;
}

function buildWorld(b) {
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
        .map((city) => `📍 ${city}:\n${npcByCity[city].map((n) => `   - ${n.name}${n.faction ? ` [${n.faction}]` : ""}${n.desc ? `: ${n.desc}` : ""}`).join("\n")}`)
        .join("\n")
    : "(nessun NPC in anagrafe)";
  return `[INPUT C-1] CITTÀ E LUOGHI ESISTENTI (riusali, non inventarne di nuovi se puoi):
${cities}

[INPUT C-2] NPC ESISTENTI, per città (usa i loro nomi e ruoli esatti quando ambienti lì):
${npcs}`;
}

// Bozza (oggetto JSON) → testo leggibile per il prompt.
function formatDraft(d) {
  if (!d) return "";
  if (typeof d === "string") return d;
  const atti = (d.atti || []).map((a, i) => [
    `ATTO ${i + 1} — ${a.titolo || ""}${a.luogo ? ` · ${a.luogo}` : ""}`,
    a.sintesi ? `  ${a.sintesi}` : "",
    ...(a.scene || []).filter(Boolean).map((sc) => `  - ${sc}`),
    a.scontro ? `  ⚔ Scontro: ${a.scontro}` : "",
    (a.npc || []).filter(Boolean).length ? `  NPC: ${a.npc.filter(Boolean).join(", ")}` : "",
  ].filter(Boolean).join("\n")).join("\n");
  return [
    `Titolo: ${d.titolo || ""}`,
    d.sottotitolo ? `Sottotitolo: ${d.sottotitolo}` : "",
    d.ripartenza ? `Da dove si riparte: ${d.ripartenza}` : "",
    d.logline ? `In breve: ${d.logline}` : "",
    atti,
    (d.fili || []).length ? `Fili ripresi:\n${d.fili.map((f) => `  - ${f.filo}: ${f.come}`).join("\n")}` : "",
    d.colpoDiScena ? `Colpo di scena: ${d.colpoDiScena}` : "",
    d.bottino ? `Bottino: ${d.bottino}` : "",
    d.finale ? `Finale: ${d.finale}` : "",
  ].filter(Boolean).join("\n");
}

function buildUserMessage(b, { draft = false } = {}) {
  const roman = toRoman(b.sessionNumber);
  const threads = Array.isArray(b.resumeThreads) && b.resumeThreads.length
    ? b.resumeThreads.map((t) => `• ${t.label}${t.note ? ` — ${t.note}` : ""}`).join("\n")
    : "";

  const head = `RICHIESTA DEL DM per la Sessione ${roman} (numero ${b.sessionNumber}) del party ${b.party}.

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
${threads || "(nessuno indicato)"}`;

  const context = `========================================
${buildPast(b)}

========================================
${buildWorld(b)}`;

  if (draft) {
    const redo = b.previousDraft
      ? `
========================================
BOZZA PRECEDENTE, SCARTATA DAL DM:
${formatDraft(b.previousDraft)}

INDICAZIONI DEL DM PER LA NUOVA BOZZA (seguile alla lettera):
${b.draftFeedback || "(nessuna indicazione: proponi un taglio diverso)"}
`
      : "";
    return `${head}

${context}
${redo}
========================================
Scrivi ora SOLO la BOZZA della Sessione ${roman} nel formato JSON richiesto.`;
  }

  const approved = b.approvedDraft
    ? `
========================================
BOZZA APPROVATA DAL DM (piano vincolante — sviluppala, non cambiarla):
${formatDraft(b.approvedDraft)}
`
    : "";

  return `${head}
${approved}
========================================
[INPUT A] TEMPLATE GRAFICO (usa SOLO la forma, ignora il contenuto):
${b.templateHtml || "(template mancante)"}

${context}

========================================
Genera ora la Sessione ${roman} nel formato richiesto (---HTML--- poi ---SUMMARY---).`;
}

function buildDraftSystem({ party, world, actsPlan }) {
  return `Sei un assistente esperto di Dungeon Master per il party ${party} della campagna "Crit Happens", ambientata in ${world}. Prima di scrivere la prep completa di una sessione di D&D 5e, proponi al DM una BOZZA: la scaletta di come intendi costruirla, così che possa approvarla, scartarla o chiederti modifiche.

REGOLE
- Leggi con attenzione i RIASSUNTI delle sessioni giocate: sono la verità. L'ULTIMO riassunto dice dove si trova il gruppo ora: la bozza riparte da lì, in modo esplicito.
- Le PREP precedenti dicono cosa era previsto, non cosa è accaduto: se contraddicono i riassunti, vincono i riassunti.
- Segui il FOCUS e le NOTE del DM: sono la richiesta. Intreccia i FILI indicati.
- Riusa luoghi e NPC esistenti con i loro nomi esatti; inventane solo se serve davvero.
- Struttura: ${actsPlan}. Ogni atto ha un luogo, cosa succede in concreto, 2-4 scene chiave, l'eventuale scontro (nemici, quanti, difficoltà indicativa per il gruppo; vuoto se non c'è) e gli NPC presenti.
- Se il DM ti ha dato indicazioni su una bozza precedente, rispettale alla lettera e cambia ciò che chiede.
- Concreto e breve: è una scaletta da leggere in un minuto, non la prep. ITALIANO.
- In "dubbi" metti 0-3 domande per il DM solo se una scelta importante dipende da lui.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo prima o dopo, senza backtick, in questa forma:
{"titolo":"","sottotitolo":"","ripartenza":"dove e come riparte il gruppo, dall'ultimo riassunto","logline":"la sessione in due frasi","atti":[{"titolo":"","luogo":"","sintesi":"","scene":["",""],"scontro":"","npc":[""]}],"fili":[{"filo":"","come":"come torna in questa sessione"}],"colpoDiScena":"","bottino":"","finale":"come si chiude / cliffhanger","dubbi":[""]}`;
}

// Estrae il JSON della bozza tollerando fence o testo attorno.
function parseDraft(text) {
  const t = String(text || "").replace(/```json|```/g, "").trim();
  const a = t.indexOf("{");
  const z = t.lastIndexOf("}");
  if (a === -1 || z <= a) throw new Error("la bozza non è in formato JSON");
  return JSON.parse(t.slice(a, z + 1));
}

// Chiamata a Claude in streaming (la connessione resta viva durante le
// generazioni lunghe), accumulando il testo. Verso il browser si risponde UNA
// volta sola in JSON: lo streaming Node→browser su Vercel viene reciso dopo
// pochi KB ("network error").
async function callClaude({ system, user, maxTokens }) {
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      stream: true,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!upstream.ok || !upstream.body) {
    const errTxt = await upstream.text().catch(() => "");
    const e = new Error(`Upstream ${upstream.status}: ${errTxt.slice(0, 300)}`);
    e.status = 502;
    throw e;
  }
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  let streamErr = "";
  let stopReason = "";
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
        if (ev.type === "content_block_delta" && ev.delta?.text) full += ev.delta.text;
        else if (ev.type === "message_delta" && ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
        else if (ev.type === "error") streamErr = ev.error?.message || "errore di streaming upstream";
      } catch { /* riga SSE non-JSON: ignora */ }
    }
  }
  return { full, streamErr, stopReason };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY mancante" });

  const b = req.body || {};
  const isDraft = b.mode === "draft";
  if (!b.party || !b.sessionNumber) return res.status(400).json({ error: "Servono party e sessionNumber." });
  if (!isDraft && !b.templateHtml) return res.status(400).json({ error: "Template grafico mancante." });

  const actsPlan = DURATION_PLAN[b.durata] || "4 atti da ~45 minuti ciascuno";

  try {
    if (isDraft) {
      const { full, streamErr } = await callClaude({
        system: buildDraftSystem({ party: b.party, world: b.world || "", actsPlan }),
        user: buildUserMessage(b, { draft: true }),
        maxTokens: 6000,
      });
      if (!full) return res.status(502).json({ error: streamErr || "Nessuna bozza generata." });
      try {
        return res.status(200).json({ draft: parseDraft(full) });
      } catch (e) {
        return res.status(502).json({ error: "Bozza illeggibile: " + e.message, raw: full.slice(0, 2000) });
      }
    }

    const { full, streamErr, stopReason } = await callClaude({
      system: buildSystem({
        party: b.party, world: b.world || "", closingChronicle: b.closingChronicle || "Cronache",
        durata: b.durata, actsPlan,
      }),
      user: buildUserMessage(b),
      maxTokens: 32000, // Opus 4.8 arriva a 128K; 32K ≈ 120KB HTML = sessione molto ricca
    });
    if (!full) return res.status(502).json({ error: streamErr || "Nessun contenuto generato." });
    const warning = streamErr || (stopReason === "max_tokens" ? "Limite di lunghezza raggiunto: la sessione potrebbe essere troncata." : "");
    return res.status(200).json({ text: full, ...(warning ? { warning } : {}) });
  } catch (e) {
    if (!res.headersSent) return res.status(e.status || 500).json({ error: "Generazione fallita: " + e.message });
    try { res.end(); } catch { /* noop */ }
  }
}
