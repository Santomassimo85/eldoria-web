// api/_gemini.js — chiamate a Gemini GRATUITO (2026-10-21).
// Il file comincia con "_": Vercel non lo pubblica come funzione, è solo un aiuto.
//
// La chiave è quella del piano gratuito (progetto "Eldoria Project"): in Vercel
// sta in GEMINI_FREE_KEY; GEMINI_API_KEY resta come riserva. Il vecchio progetto
// a credito prepagato ha finito il credito e NON va riattivato senza chiederlo.
// I modelli 2.5 non sono più dati ai progetti nuovi: si usano i 3.x, con un
// modello di riserva se il primo è pieno (429) o non c'è (404).
// Le IMMAGINI nel piano gratuito hanno quota zero: si prova lo stesso, e se
// Google rifiuta si risponde con un messaggio chiaro invece dell'errore inglese.

export const TEXT_MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
export const IMAGE_MODELS = ["gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"];

export const geminiKey = () => process.env.GEMINI_FREE_KEY || process.env.GEMINI_API_KEY || "";

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
    return "Gemini: il credito del progetto a pagamento è finito. Il sito usa il piano gratuito: controlla che in Vercel ci sia GEMINI_FREE_KEY.";
  }
  if (err.httpStatus === 429 || /quota/i.test(msg)) {
    return "Gemini gratuito: limite di richieste raggiunto per ora (si azzera da solo, a mezzanotte ora del Pacifico per il limite del giorno). Riprova più tardi.";
  }
  return msg || "Errore di Gemini.";
}
