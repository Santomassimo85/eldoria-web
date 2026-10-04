// api/generate-session.js
// Genera la PREP di una sessione D&D: una traccia BASE (cosa succede, cosa
// fare, tempi), non un documento grafico. Il modello scrive solo il contenuto
// con pochi tag; il guscio grafico fisso lo aggiunge `wrapSimple`. Così l'output
// è circa metà di prima e la generazione dura circa metà (2026-10-04).
// Strumento privato (solo master) — l'autorizzazione è lato client/rotta.
//
// Input (POST JSON):
//   party, world, groupCharacters[], closingChronicle   // meta party
//   sessionNumber, suggestedTitle, focus, involvedCharacters[], durata, note  // form
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
  "2h":    "3 atti da ~40 minuti ciascuno",
  "2.30h": "3 atti da ~50 minuti ciascuno",
  "3h":    "4 atti da ~45 minuti ciascuno",
  "3.30h": "4 atti da ~52 minuti ciascuno",
  "4h":    "4-5 atti da ~50 minuti ciascuno",
};

function toRoman(num) {
  const n = parseInt(num, 10);
  if (!Number.isFinite(n) || n <= 0) return String(num || "");
  const map = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let r = "", x = n;
  for (const [v, s] of map) while (x >= v) { r += s; x -= v; }
  return r;
}

// Regola comune a bozza e sessione: il DM non può decidere per i giocatori.
const NO_PLAYER_ACTIONS = `- NON scrivere MAI cosa fanno, dicono, decidono o provano i personaggi dei giocatori ("Caius lancia…", "Tanagar decide…", "il party sceglie di…" come fatto compiuto). I giocatori sono liberi: descrivi SITUAZIONI, cosa fanno gli NPC e il mondo, cosa c'è in gioco, e le reazioni possibili nella forma "Se il gruppo… → …".`;

function buildSystem({ party, world, closingChronicle, actsPlan }) {
  return `Sei un assistente di Dungeon Master per il party ${party} della campagna "Crit Happens", ambientata in ${world}. Scrivi la PREP di UNA sessione di D&D 5e: una traccia BASE e veloce da consultare al tavolo, per capire cosa succede, cosa fare e come scandire i tempi. Niente letteratura: frasi brevi, concrete, utili.

[CONTINUITÀ]
- I RIASSUNTI delle sessioni giocate sono la VERITÀ. L'ULTIMO dice dove si trova il gruppo ORA: si riparte da lì.
- Le PREP precedenti dicono solo cosa era PREVISTO: se contraddicono i riassunti, vincono i riassunti.
- Riusa luoghi e NPC esistenti con i loro nomi esatti; inventane solo se serve davvero. Intreccia i FILI indicati dal DM.
- Se ricevi una BOZZA APPROVATA, è il piano vincolante: stessi atti, luoghi, scontri, NPC, colpo di scena, bottino e finale. Sviluppala, non cambiarla.

[REGOLE]
${NO_PLAYER_ACTIONS}
- DIALOGHI: pochi, solo degli NPC, una battuta breve ciascuno e solo quando serve a dare il tono o un'informazione chiave. Al massimo 6 battute in tutta la sessione. In corsivo con le virgolette basse: <i>«così»</i>.
- TEMPI: ${actsPlan}. Ogni atto ha la sua fascia oraria (es. 0:00–0:45) e ogni scena i minuti indicativi. Nelle Note per il DM indica cosa tagliare se si è in ritardo e cosa aggiungere se si è in anticipo.
- SCONTRI: stat block compatti su UNA riga per tipo di nemico (CA, PF, attacco +bonus e danni in dadi, eventuale tratto o TS con CD), più una riga di tattica.
- Meccaniche D&D 5e reali. ITALIANO. Breve: in tutto circa 1.200–2.000 parole.

[FORMATO HTML — SOLO QUESTI TAG E QUESTE CLASSI]
Scrivi SOLO il contenuto del <body> (niente <html>, <head>, <style>, <script>, niente CSS né attributi style). Usa esattamente questa struttura:
<header><h1>Titolo</h1><p class="sub">sottotitolo in una riga</p><p class="meta">Sessione N · Durata · Luogo · Focus</p></header>
<section class="box"><h2>Panoramica</h2><p><b>Si riparte da:</b> …</p><p><b>Cosa c'è in gioco:</b> …</p><p><b>Scaletta:</b> Atto I 0:00–0:45 · Atto II …</p></section>
<section class="atto"><h2>Atto I — Titolo <span class="tempo">0:00–0:45</span></h2>
  <p class="luogo">📍 Luogo</p>
  <h3>Cosa succede</h3><p>…</p>
  <h3>Scene</h3><ol><li><b>Nome scena</b> <span class="min">~15 min</span> — situazione, cosa trova il gruppo, prove possibili (abilità e CD).</li></ol>
  <h3>Se il gruppo…</h3><ul><li>…prova a X → conseguenza</li></ul>
  <div class="npc"><b>Nome NPC</b> — ruolo · cosa vuole · come si comporta. <i>«battuta facoltativa»</i></div>
  <div class="scontro"><b>⚔ Scontro: titolo</b><ul><li><b>Nemico ×2</b> — CA 13 · PF 22 · Spada +4 (1d8+2) · tratto</li></ul><p><b>Tattica:</b> …</p></div>
</section>
(un <section class="atto"> per ogni atto; ometti h3, npc e scontro che non servono)
<section class="box"><h2>Bottino e indizi</h2><ul><li>…</li></ul></section>
<section class="box"><h2>Note per il DM</h2><ul><li>Se siete in ritardo: …</li><li>Se siete in anticipo: …</li><li>…</li></ul></section>
<p class="chiusura"><i>«citazione di chiusura»</i> — ${closingChronicle}</p>
<!--FINE-->

[OUTPUT — formato ESATTO, nient'altro]
---HTML---
…il contenuto del body come sopra, che finisce con <!--FINE-->…
---SUMMARY---
{"panoramica": "...", "bottino": "...", "ganciAperti": "..."}`;
}

// Guscio grafico fisso e leggero: il modello scrive solo il contenuto.
const SHELL_CSS = `*{box-sizing:border-box}body{margin:0;background:#16130f;color:#e9e2d3;font:16px/1.55 Georgia,"Times New Roman",serif}main{max-width:860px;margin:0 auto;padding:28px 18px 60px}header{border-bottom:2px solid #c9a25a;padding-bottom:12px;margin-bottom:20px}h1{font-size:1.9rem;margin:0 0 4px;color:#f3e7c9}h2{font-size:1.3rem;margin:0 0 10px;color:#e3c27d;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}h3{font-size:.85rem;text-transform:uppercase;letter-spacing:.08em;color:#b9a67e;margin:16px 0 6px}.sub{margin:0;font-style:italic;color:#cfc3a8}.meta{margin:6px 0 0;font-size:.9rem;color:#a99d84}.box,.atto{background:#1f1b15;border:1px solid #3a3226;border-radius:6px;padding:16px 18px;margin:0 0 16px}.atto{border-left:4px solid #c9a25a}.tempo{font:600 .85rem/1.6 ui-monospace,Consolas,monospace;color:#16130f;background:#c9a25a;border-radius:4px;padding:1px 8px;align-self:center}.min{font:600 .8rem ui-monospace,Consolas,monospace;color:#c9a25a}.luogo{margin:0 0 4px;color:#cfc3a8}p{margin:6px 0}ul,ol{margin:6px 0;padding-left:22px}li{margin:4px 0}b{color:#f3e7c9}i{color:#e3c27d}.npc{background:#262017;border-radius:4px;padding:8px 12px;margin:8px 0}.scontro{background:#2a1714;border:1px solid #5a2a22;border-radius:4px;padding:10px 12px;margin:10px 0}.scontro>b:first-child{color:#f08a76}.chiusura{text-align:center;margin-top:26px;color:#cfc3a8}@media print{body{background:#fff;color:#111}.box,.atto,.npc,.scontro{background:#fff;border-color:#999}b,h1,h2,i{color:#111}.tempo{background:#ddd;color:#111}}`;

// Avvolge il contenuto del modello nel guscio fisso. Se il modello ha comunque
// scritto un documento intero, ne tiene solo il body.
function wrapSimple(fragment, title) {
  let body = String(fragment || "").trim();
  const m = body.match(/<body[^>]*>([\s\S]*?)(<\/body>|$)/i);
  if (m) body = m[1];
  body = body.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<\/?(html|head)[^>]*>/gi, "");
  const safeTitle = String(title || "Sessione").replace(/[<>&]/g, "");
  return `<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>${SHELL_CSS}</style></head>
<body class="sess-simple"><main>
${body}
</main></body></html>`;
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
${context}

========================================
Scrivi ora la Sessione ${roman} nel formato richiesto (---HTML--- poi ---SUMMARY---), breve e pratica.`;
}

function buildDraftSystem({ party, world, actsPlan }) {
  return `Sei un assistente esperto di Dungeon Master per il party ${party} della campagna "Crit Happens", ambientata in ${world}. Prima di scrivere la prep completa di una sessione di D&D 5e, proponi al DM una BOZZA: la scaletta di come intendi costruirla, così che possa approvarla, scartarla o chiederti modifiche.

REGOLE
- Leggi con attenzione i RIASSUNTI delle sessioni giocate: sono la verità. L'ULTIMO riassunto dice dove si trova il gruppo ora: la bozza riparte da lì, in modo esplicito.
- Le PREP precedenti dicono cosa era previsto, non cosa è accaduto: se contraddicono i riassunti, vincono i riassunti.
- Segui il FOCUS e le NOTE del DM: sono la richiesta. Intreccia i FILI indicati.
${NO_PLAYER_ACTIONS}
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
        party: b.party, world: b.world || "", closingChronicle: b.closingChronicle || "Cronache", actsPlan,
      }),
      user: buildUserMessage(b),
      maxTokens: 10000, // traccia base: ~1.200–2.000 parole stanno larghe
    });
    if (!full) return res.status(502).json({ error: streamErr || "Nessun contenuto generato." });
    // Contenuto del modello → documento completo col guscio fisso.
    const h = full.indexOf("---HTML---");
    const sIdx = full.indexOf("---SUMMARY---");
    const fragment = full.slice(h >= 0 ? h + 10 : 0, sIdx > h ? sIdx : undefined);
    const summaryPart = sIdx >= 0 ? full.slice(sIdx) : "---SUMMARY---\n{}";
    const title = (fragment.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "").replace(/<[^>]+>/g, "").trim();
    const text = `---HTML---\n${wrapSimple(fragment, title)}\n${summaryPart}`;
    const truncated = stopReason === "max_tokens" || !fragment.includes("<!--FINE-->");
    const warning = streamErr || (truncated ? "La sessione potrebbe essere troncata (manca la fine)." : "");
    return res.status(200).json({ text, ...(warning ? { warning } : {}) });
  } catch (e) {
    if (!res.headersSent) return res.status(e.status || 500).json({ error: "Generazione fallita: " + e.message });
    try { res.end(); } catch { /* noop */ }
  }
}
