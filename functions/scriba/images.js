// functions/scriba/images.js
//
// Genera 2-3 illustrazioni per "Lo Scriba" con Gemini (stesso endpoint REST
// già usato dal Sapiente), le carica su Firebase Storage e ne restituisce gli
// URL (https) — così funzionano sia in email sia nell'archivio web.
//
// Robustezza:
//  - URL via download-token di Firebase Storage (niente makePublic: funziona
//    anche con uniform bucket-level access attivo).
//  - chiamata Gemini con fallback senza generationConfig.
//  - best-effort: se qualcosa fallisce, salta l'immagine; il giornale esce.

const crypto = require("crypto");

const IMAGE_MODEL = "gemini-2.5-flash-image";

// Stile coerente "gazzetta antica": xilografia/incisione, niente testo dentro.
const STYLE_PREFIX =
    "Antique woodcut engraving illustration for a fantasy newspaper broadsheet, " +
    "detailed cross-hatching, sepia ink on aged parchment, vintage 19th-century " +
    "broadsheet art style, dramatic but elegant, no text, no letters, no words, " +
    "no captions, no signatures. Scene: ";

async function callGemini(geminiKey, body) {
    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${geminiKey}`;
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
    if (!inline?.data) throw new Error("nessuna immagine nella risposta di Gemini");
    return { buffer: Buffer.from(inline.data, "base64"), mime: inline.mimeType || inline.mime_type || "image/png" };
}

async function generateOne(geminiKey, artPrompt) {
    const contents = [{ parts: [{ text: STYLE_PREFIX + artPrompt }] }];
    try {
        return await callGemini(geminiKey, { contents, generationConfig: { responseModalities: ["TEXT", "IMAGE"] } });
    } catch (e) {
        // Alcune varianti del modello rifiutano generationConfig: riprova nudo.
        return await callGemini(geminiKey, { contents });
    }
}

/**
 * @param {{
 *   geminiKey: string,
 *   illustrations: Array<{section:string, caption:string, art_prompt:string}>,
 *   bucket: import('@google-cloud/storage').Bucket,
 *   prefix: string,   // cartella su Storage, es. "scriba/12"
 * }} args
 * @returns {Promise<Array<{url:string, caption:string, placement:string}>>}
 */
async function generateIllustrations({ geminiKey, illustrations, bucket, prefix }) {
    if (!geminiKey) { console.warn("[scriba] GEMINI_API_KEY assente: niente immagini."); return []; }
    if (!Array.isArray(illustrations) || !illustrations.length) return [];

    const list = illustrations.slice(0, 3);
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const ill = list[i];
        if (!ill?.art_prompt) continue;
        try {
            const { buffer, mime } = await generateOne(geminiKey, ill.art_prompt);
            const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
            const token = crypto.randomUUID();
            const file = bucket.file(`${prefix}/${i}.${ext}`);
            await file.save(buffer, {
                contentType: mime,
                resumable: false,
                metadata: {
                    cacheControl: "public, max-age=31536000",
                    metadata: { firebaseStorageDownloadTokens: token },
                },
            });
            const url =
                `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
                `${encodeURIComponent(file.name)}?alt=media&token=${token}`;
            out.push({ url, caption: ill.caption || "", placement: ill.section || "lead" });
        } catch (e) {
            console.error(`[scriba] illustrazione ${i} fallita:`, e.message);
        }
    }
    return out;
}

module.exports = { generateIllustrations };
