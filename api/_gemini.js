// api/_gemini.js — tutte le chiamate a Gemini del sito (2026-10-21).
// Il file comincia con "_": Vercel non lo pubblica come funzione, è solo un aiuto.
//
// Chiave = GEMINI_API_KEY di Vercel, il progetto "Eldoria" a CREDITO PREPAGATO
// (…1EHk): scelta dell'utente, che ricarica lui il credito. Il 2026-10-21 il
// credito era finito (402): finché non ricarica tutto risponde "credito finito".
// Testi: come prima gemini-2.5-flash, con riserva sui 3.x se non risponde.
// Immagini: gemini-2.5-flash-image è stato SPENTO da Google il 2026-10-02, quindi
// si usa per primo il più economico (3.1-flash-lite-image, ~0,034 $/immagine) e
// come riserva 3.1-flash-image (~0,067 $).

export const TEXT_MODELS = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
export const IMAGE_MODELS = ["gemini-3.1-flash-lite-image", "gemini-3.1-flash-image"];

export const geminiKey = () => process.env.GEMINI_API_KEY || "";

const NEXT_MODEL = new Set([404, 429, 500, 503]);

/**
 * Manda `body` a generateContent provando i modelli in ordine. Restituisce la
 * risposta JSON di Google (con `error` se tutti hanno fallito), come prima.
 */
export async function geminiCall(body, { models = TEXT_MODELS, key = geminiKey() } = {}) {
  let last = { error: { message: "Chiave Gemini mancante." } };
  if (!key) return last;
  for (const model of models) {
    let payload = body;
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({ error: { message: `HTTP ${r.status}` } }));
      if (!data.error) return data;
      last = { ...data, error: { ...data.error, httpStatus: r.status } };
      // Alcuni modelli "lite" non accettano thinkingConfig: si riprova senza.
      if (r.status === 400 && payload.generationConfig?.thinkingConfig) {
        const { thinkingConfig, ...gc } = payload.generationConfig;
        payload = { ...payload, generationConfig: gc };
        continue;
      }
      break;
    }
    if (!NEXT_MODEL.has(last.error.httpStatus) && last.error.httpStatus !== 400) break;
  }
  last.error.message = friendlyGeminiError(last.error);
  return last;
}

/** Messaggio in italiano per gli errori di quota/credito. */
export function friendlyGeminiError(err = {}) {
  const msg = String(err.message || "");
  if (err.httpStatus === 402 || /prepayment|credits are depleted|billing/i.test(msg)) {
    return "Gemini: il credito prepagato è finito. Ricaricalo su AI Studio (ai.studio/projects → progetto Eldoria → Billing) e riprova.";
  }
  if (err.httpStatus === 429 || /quota/i.test(msg)) {
    return "Gemini: troppe richieste in questo momento. Riprova fra qualche minuto.";
  }
  return msg || "Errore di Gemini.";
}
