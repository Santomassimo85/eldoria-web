// functions/scriba/buildSampleIssue.js
//
// Genera UN numero reale de "Lo Scriba" (Claude + Gemini) e lo salva come
// asset bundlati per l'anteprima online dell'archivio /scriba:
//   - public/scriba-sample/{0,1,2}.png   (illustrazioni)
//   - src/data/scribaSample.json         (array di numeri: 1 reale + segnaposto)
// Scriba.jsx mostra questi numeri SOLO se Firestore è ancora vuoto.
//
//   node scriba/buildSampleIssue.js

const fs = require("fs");
const path = require("path");
const { generateScribaContent } = require("./prompt");
const { renderScribaHtml } = require("./renderHtml");

const ROOT = path.join(__dirname, "..", "..");
const PUBLIC_DIR = path.join(ROOT, "public", "scriba-sample");
const OUT_JSON = path.join(ROOT, "src", "data", "scribaSample.json");

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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: STYLE_PREFIX + prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const inline = (parts.find((p) => p.inlineData?.data || p.inline_data?.data) || {});
    const d = inline.inlineData || inline.inline_data;
    if (!d?.data) throw new Error("nessuna immagine");
    return { buffer: Buffer.from(d.data, "base64"), mime: d.mimeType || d.mime_type || "image/png" };
}

async function main() {
    const env = loadEnv();
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });

    console.log("→ Claude scrive il numero…");
    const content = await generateScribaContent({ apiKey: env.ANTHROPIC_API_KEY, data: SAMPLE_DATA });

    console.log("→ Gemini illustra (salvo in public/scriba-sample)…");
    const images = [];
    for (let i = 0; i < content.illustrations.length; i++) {
        try {
            const { buffer, mime } = await geminiImage(env.GEMINI_API_KEY, content.illustrations[i].art_prompt);
            const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
            fs.writeFileSync(path.join(PUBLIC_DIR, `${i}.${ext}`), buffer);
            images.push({ url: `/scriba-sample/${i}.${ext}`, caption: content.illustrations[i].caption || "", placement: content.illustrations[i].section || "lead" });
            console.log(`   img ${i} ok`);
        } catch (e) { console.warn(`   img ${i} saltata: ${e.message}`); }
    }

    const html = renderScribaHtml({ content, edition: 3, images });

    // Numero reale (Giugno) + segnaposto (Maggio/Aprile) per mostrare i mesi.
    // I segnaposto riusano html/immagini del reale solo a scopo di anteprima layout.
    const real = { id: "sample-3", number: 3, sentAt: "2026-06-19T10:00:00Z", content, images, html };
    const ph = (id, number, sentAt, motto, lead) => ({
        id, number, sentAt,
        content: { edition_motto: motto, lead: { headline: lead } },
        images: [], html,
    });
    const issues = [
        real,
        ph("sample-2", 2, "2026-05-22T10:00:00Z", "Quando il fiume restituisce ciò che ha preso", "Ritrovato il carico perduto al Guado di Maelis"),
        ph("sample-1", 1, "2026-05-04T10:00:00Z", "La prima campana di una lunga stagione", "Le casate si contendono il Mercato Basso"),
        ph("sample-0", 0, "2026-04-15T10:00:00Z", "Dove tutto ebbe inizio", "Cronache dai primi giorni del disgelo"),
    ];

    fs.writeFileSync(OUT_JSON, JSON.stringify(issues, null, 2));
    console.log(`\n✓ Salvato ${OUT_JSON} (${issues.length} numeri, 1 reale).`);
}

main().catch((e) => { console.error("\n✗ ERRORE:", e.message); process.exit(1); });
