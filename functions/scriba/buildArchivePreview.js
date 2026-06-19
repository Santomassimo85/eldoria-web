// functions/scriba/buildArchivePreview.js
//
// Genera un MOCKUP STATICO della pagina archivio "/scriba" per revisione locale
// (apri _archive_preview.html nel browser). Mostra: testata, filtro di ricerca,
// numeri raggruppati per mese, card, e click → apre il giornale vero in overlay.
// Font fantasy via Google Fonts (nel browser si caricano davvero, a differenza
// di Gmail). Un numero è REALE (Claude+Gemini, immagini come data-URI per
// funzionare da file://), gli altri sono segnaposto per mostrare il layout.
//
//   node scriba/buildArchivePreview.js

const fs = require("fs");
const path = require("path");
const { generateScribaContent } = require("./prompt");
const { renderScribaHtml } = require("./renderHtml");

function loadEnv() {
    const txt = fs.readFileSync(path.join(__dirname, "..", ".env.eldoria-web"), "utf8");
    const env = {};
    for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) env[m[1]] = m[2];
    }
    return env;
}

const SAMPLE_DATA = require("./_sampleData");

const IMAGE_MODEL = "gemini-2.5-flash-image";
const STYLE_PREFIX =
    "Antique woodcut engraving illustration for a fantasy newspaper broadsheet, " +
    "detailed cross-hatching, sepia ink on aged parchment, vintage 19th-century " +
    "broadsheet art style, dramatic but elegant, no text, no letters, no words. Scene: ";

async function geminiImage(key, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${key}`;
    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: STYLE_PREFIX + prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const inline = (parts.find((p) => p.inlineData?.data || p.inline_data?.data) || {});
    const d = inline.inlineData || inline.inline_data;
    if (!d?.data) throw new Error("nessuna immagine");
    const mime = d.mimeType || d.mime_type || "image/png";
    return `data:${mime};base64,${d.data}`;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Card segnaposto per mostrare il raggruppamento per mese (niente immagine).
const PLACEHOLDERS = [
    { mese: "Maggio 2026", number: 2, motto: "Quando il fiume restituisce ciò che ha preso", lead: "Ritrovato il carico perduto al Guado di Maelis" },
    { mese: "Maggio 2026", number: 1, motto: "La prima campana di una lunga stagione", lead: "Le casate si contendono il Mercato Basso" },
    { mese: "Aprile 2026", number: 0, motto: "Dove tutto ebbe inizio", lead: "Cronache dai primi giorni del disgelo" },
];

function cardHtml({ number, dateLabel, motto, lead, thumb, real }) {
    const thumbHtml = thumb
        ? `<div class="card-thumb" style="background-image:url('${thumb}')"></div>`
        : `<div class="card-thumb card-thumb--empty">📜</div>`;
    return `
    <button class="card" data-real="${real ? 1 : 0}" data-search="${esc((motto + " " + lead).toLowerCase())}">
      ${thumbHtml}
      <div class="card-body">
        <span class="card-num">Numero ${number}</span>
        <span class="card-date">${esc(dateLabel)}</span>
        <p class="card-motto">«${esc(motto)}»</p>
        <p class="card-lead">${esc(lead)}</p>
        <span class="card-cue">Leggi ›</span>
      </div>
    </button>`;
}

function monthGroup(title, cards) {
    return `<section class="month"><h2 class="month-title">${esc(title)}</h2><div class="grid">${cards.join("")}</div></section>`;
}

async function main() {
    const env = loadEnv();
    console.log("→ Genero il numero reale (Claude)…");
    const content = await generateScribaContent({ apiKey: env.ANTHROPIC_API_KEY, data: SAMPLE_DATA });

    console.log("→ Illustrazioni (Gemini, data-URI)…");
    const images = [];
    for (let i = 0; i < content.illustrations.length; i++) {
        try {
            const url = await geminiImage(env.GEMINI_API_KEY, content.illustrations[i].art_prompt);
            images.push({ url, caption: content.illustrations[i].caption || "", placement: content.illustrations[i].section || "lead" });
            console.log(`   img ${i} ok`);
        } catch (e) { console.warn(`   img ${i} saltata: ${e.message}`); }
    }

    const realHtml = renderScribaHtml({ content, edition: 3, images });
    const realThumb = images[0]?.url || "";

    // Card del numero reale (mese corrente) + segnaposto.
    const realCard = cardHtml({
        number: 3, dateLabel: "19 giugno 2026",
        motto: content.edition_motto, lead: content.lead?.headline || "",
        thumb: realThumb, real: true,
    });
    const giugno = monthGroup("Giugno 2026", [realCard]);
    const maggio = monthGroup("Maggio 2026", PLACEHOLDERS.filter((p) => p.mese === "Maggio 2026").map((p) => cardHtml({ ...p, dateLabel: p.mese, thumb: "", real: false })));
    const aprile = monthGroup("Aprile 2026", PLACEHOLDERS.filter((p) => p.mese === "Aprile 2026").map((p) => cardHtml({ ...p, dateLabel: p.mese, thumb: "", real: false })));

    const page = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@500;700&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<title>Lo Scriba — Archivio (anteprima)</title>
<style>
  :root{--ink:#1c1813;--ink2:#2b2620;--muted:#6b5d44;--accent:#7a1f12;--paper:#f4efe3;--paper2:#ece3d0;--line:#cdbfa3;}
  *{box-sizing:border-box;}
  body{margin:0;background:#ece3d0;color:var(--ink);font-family:'Lora',Georgia,serif;}
  .wrap{max-width:1040px;margin:0 auto;padding:34px 18px 80px;}
  .mast{text-align:center;border-bottom:3px double var(--ink);padding-bottom:18px;margin-bottom:22px;}
  .eyebrow{display:block;font-family:'Cinzel',serif;font-size:.74rem;letter-spacing:.34em;text-transform:uppercase;color:var(--muted);}
  .title{font-family:'Cinzel Decorative','Cinzel',serif;font-weight:900;font-size:clamp(2.8rem,9vw,5rem);line-height:1;letter-spacing:1px;color:var(--ink);margin:10px 0 8px;}
  .sub{font-style:italic;color:var(--muted);max-width:560px;margin:0 auto;}
  .toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center;margin:0 0 28px;}
  .toolbar input,.toolbar select{font-family:'Lora',serif;font-size:.95rem;padding:9px 13px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:4px;}
  .toolbar input{min-width:260px;}
  .month{margin:0 0 30px;}
  .month-title{font-family:'Cinzel',serif;font-weight:700;font-size:1.05rem;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);border-bottom:1px solid var(--ink);padding-bottom:6px;margin:0 0 16px;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;}
  .card{display:flex;flex-direction:column;text-align:left;background:var(--paper);border:1px solid var(--line);border-radius:5px;padding:0;cursor:pointer;overflow:hidden;font:inherit;color:inherit;transition:transform .15s,box-shadow .15s;}
  .card:hover{transform:translateY(-3px);box-shadow:0 8px 22px rgba(28,24,19,.18);}
  .card-thumb{height:152px;background-size:cover;background-position:center;border-bottom:1px solid var(--line);filter:sepia(.25) contrast(1.02);}
  .card-thumb--empty{display:flex;align-items:center;justify-content:center;font-size:3rem;background:var(--paper2);}
  .card-body{display:flex;flex-direction:column;gap:4px;padding:14px 16px 16px;}
  .card-num{font-family:'Cinzel',serif;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:.78rem;color:var(--accent);}
  .card-date{font-size:.78rem;color:#8a7d64;}
  .card-motto{font-style:italic;color:var(--muted);margin:4px 0 0;font-size:.92rem;}
  .card-lead{font-family:'Cinzel',serif;font-weight:700;color:var(--ink);margin:2px 0 0;font-size:1.02rem;line-height:1.25;}
  .card-cue{margin-top:8px;font-family:'Cinzel',serif;font-size:.8rem;color:var(--accent);}
  .reader{position:fixed;inset:0;z-index:50;background:rgba(28,24,19,.55);display:none;flex-direction:column;padding:18px;}
  .reader.open{display:flex;}
  .reader-bar{display:flex;justify-content:space-between;align-items:center;background:var(--ink);color:var(--paper);font-family:'Cinzel',serif;font-size:.85rem;padding:10px 16px;border-radius:6px 6px 0 0;}
  .reader-bar button{background:none;border:none;color:var(--paper);font-size:1.3rem;cursor:pointer;}
  .reader iframe{flex:1;width:100%;border:none;background:#e7e0d0;border-radius:0 0 6px 6px;}
  .hint{text-align:center;font-style:italic;color:var(--muted);font-size:.85rem;margin:-10px 0 24px;}
</style></head>
<body>
  <div class="wrap">
    <header class="mast">
      <span class="eyebrow">✦ Gazzetta di Exanthia ✦</span>
      <h1 class="title">Lo Scriba</h1>
      <p class="sub">L'archivio delle cronache del mondo. Ogni numero pubblicato resta qui, a futura memoria.</p>
    </header>
    <div class="hint">Anteprima statica — solo il Numero 3 è reale e apribile; gli altri sono segnaposto per mostrare il raggruppamento per mese e i filtri.</div>
    <div class="toolbar">
      <input id="q" type="search" placeholder="Cerca tra le cronache…">
      <select id="mese"><option value="">Tutti i mesi</option><option>Giugno 2026</option><option>Maggio 2026</option><option>Aprile 2026</option></select>
    </div>
    <div id="archive">
      ${giugno}
      ${maggio}
      ${aprile}
    </div>
  </div>

  <div class="reader" id="reader">
    <div class="reader-bar"><span>Lo Scriba · Numero 3 · 19 giugno 2026</span><button id="close">✕</button></div>
    <iframe id="frame"></iframe>
  </div>

  <script>
    const REAL_HTML = ${JSON.stringify(realHtml)};
    const reader = document.getElementById('reader');
    const frame = document.getElementById('frame');
    document.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => {
      frame.srcdoc = REAL_HTML; reader.classList.add('open');
    }));
    document.getElementById('close').addEventListener('click', () => reader.classList.remove('open'));
    // Filtri (ricerca testo + mese)
    const q = document.getElementById('q'), mese = document.getElementById('mese');
    function applyFilter(){
      const term = q.value.trim().toLowerCase();
      document.querySelectorAll('.month').forEach((m) => {
        const mTitle = m.querySelector('.month-title').textContent.trim();
        let visible = 0;
        m.querySelectorAll('.card').forEach((card) => {
          const okText = !term || card.dataset.search.includes(term);
          const okMese = !mese.value || mese.value === mTitle;
          const show = okText && okMese; card.style.display = show ? '' : 'none'; if (show) visible++;
        });
        m.style.display = visible ? '' : 'none';
      });
    }
    q.addEventListener('input', applyFilter); mese.addEventListener('change', applyFilter);
  </script>
</body></html>`;

    const out = path.join(__dirname, "_archive_preview.html");
    fs.writeFileSync(out, page);
    console.log(`\n✓ Mockup archivio salvato: ${out}`);
    console.log("  Aprilo nel browser per giudicare font, layout, mesi e filtri.");
}

main().catch((e) => { console.error("\n✗ ERRORE:", e.message); process.exit(1); });
