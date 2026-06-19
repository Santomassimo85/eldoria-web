// functions/scriba/testSend.js
//
// PROVA LOCALE de "Lo Scriba" — gira con `node scriba/testSend.js` dentro
// functions/. Testa l'intera catena SENZA deploy né admin di Firebase:
//   1. Claude (claude-opus-4-8) scrive il numero da dati d'esempio.
//   2. Gemini illustra (best-effort): le immagini vengono ALLEGATE inline
//      (CID) invece che caricate su Storage — così non serve Firebase.
//   3. Nodemailer invia il giornale via Gmail alla mail master.
//
// Legge le chiavi da functions/.env.eldoria-web. Esce con codice 1 su errore.

const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const { generateScribaContent } = require("./prompt");
const { renderScribaHtml, italianDateLabel } = require("./renderHtml");

// ── .env parser minimale (KEY=VALUE per riga) ───────────────────────────────
function loadEnv() {
    const file = path.join(__dirname, "..", ".env.eldoria-web");
    const txt = fs.readFileSync(file, "utf8");
    const env = {};
    for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) env[m[1]] = m[2];
    }
    return env;
}

// ── Dati d'esempio (mimano collectScribaData) ───────────────────────────────
// Condivisi con buildSampleIssue.js per non divergere.
const SAMPLE_DATA = require("./_sampleData");

// ── Gemini: genera UN'immagine, restituisce {buffer, mime} ──────────────────
const IMAGE_MODEL = "gemini-2.5-flash-image";
const STYLE_PREFIX =
    "Antique woodcut engraving illustration for a fantasy newspaper broadsheet, " +
    "detailed cross-hatching, sepia ink on aged parchment, vintage 19th-century " +
    "broadsheet art style, dramatic but elegant, no text, no letters, no words, " +
    "no captions, no signatures. Scene: ";

async function geminiImage(geminiKey, artPrompt) {
    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${geminiKey}`;
    const contents = [{ parts: [{ text: STYLE_PREFIX + artPrompt }] }];
    const body = { contents, generationConfig: { responseModalities: ["TEXT", "IMAGE"] } };
    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
    const inline = imgPart?.inlineData || imgPart?.inline_data;
    if (!inline?.data) throw new Error("nessuna immagine nella risposta");
    return { buffer: Buffer.from(inline.data, "base64"), mime: inline.mimeType || inline.mime_type || "image/png" };
}

async function main() {
    const env = loadEnv();
    const anthropicKey = env.ANTHROPIC_API_KEY;
    const geminiKey = env.GEMINI_API_KEY;
    const gmailEmail = env.GMAIL_EMAIL;
    const gmailPass = env.GMAIL_APP_PASSWORD;
    const to = process.argv[2] || gmailEmail; // destinatario: arg o mittente stesso

    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY mancante in .env.eldoria-web");
    if (!gmailEmail || !gmailPass) throw new Error("GMAIL_EMAIL / GMAIL_APP_PASSWORD mancanti");

    console.log("→ [1/3] Claude scrive il numero di prova…");
    const content = await generateScribaContent({ apiKey: anthropicKey, data: SAMPLE_DATA });
    console.log(`   ok: motto="${content.edition_motto}", ${content.illustrations.length} illustrazioni richieste`);

    console.log("→ [2/3] Gemini illustra (allego inline via CID)…");
    const images = [];
    const attachments = [];
    if (geminiKey) {
        for (let i = 0; i < content.illustrations.length; i++) {
            const ill = content.illustrations[i];
            try {
                const { buffer, mime } = await geminiImage(geminiKey, ill.art_prompt);
                const cid = `scriba-img-${i}`;
                const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
                attachments.push({ filename: `scriba-${i}.${ext}`, content: buffer, cid });
                images.push({ url: `cid:${cid}`, caption: ill.caption || "", placement: ill.section || "lead" });
                console.log(`   immagine ${i} ok (${(buffer.length / 1024).toFixed(0)} KB)`);
            } catch (e) {
                console.warn(`   immagine ${i} saltata: ${e.message}`);
            }
        }
    } else {
        console.warn("   GEMINI_API_KEY assente: niente immagini.");
    }

    // Anteprima browser self-contained: immagini come data-URI (i cid: non si
    // vedono fuori da un client mail). Aprila per vedere il colore VERO.
    const previewImages = images.map((im, i) => {
        const att = attachments[i];
        if (!att) return im;
        const mime = att.filename.endsWith(".jpg") ? "image/jpeg" : "image/png";
        return { ...im, url: `data:${mime};base64,${att.content.toString("base64")}` };
    });
    // Numero 1 → data in-world "10 di Solleone" (il primo numero della testata).
    const EDITION = 1;
    const previewPath = path.join(__dirname, "_preview.html");
    fs.writeFileSync(previewPath, renderScribaHtml({ content, edition: EDITION, images: previewImages }));
    console.log(`   anteprima browser salvata: ${previewPath}`);

    console.log("→ [3/3] Invio via Gmail…");
    const html = renderScribaHtml({ content, edition: EDITION, images });
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailEmail, pass: gmailPass },
    });
    const info = await transporter.sendMail({
        from: `"Lo Scriba" <${gmailEmail}>`,
        to,
        subject: `📜 [PROVA] Lo Scriba N. ${EDITION} — ${italianDateLabel(EDITION)}`,
        html,
        attachments,
    });
    console.log(`\n✓ Inviata a ${to} (messageId ${info.messageId}).`);
}

main().catch((e) => {
    console.error("\n✗ ERRORE:", e.message);
    process.exit(1);
});
