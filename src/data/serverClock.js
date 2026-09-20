// ── Ora del server ───────────────────────────────────────────────────────────
// I limiti dell'Officina (1 prova al giorno, 3 a settimana) non devono fidarsi
// dell'orologio del telefono: chi lo sposta avanti "guadagnerebbe" una prova.
// L'ora vera arriva dall'intestazione HTTP `Date` di una richiesta HEAD al sito
// stesso (Vercel in produzione, Vite in sviluppo): la scrive il server, non il
// dispositivo, e un orologio spostato non la cambia. Precisione al secondo.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe() {
  const t0 = Date.now();
  const res = await fetch(`${location.origin}/?_clock=${Math.random().toString(36).slice(2)}`, { method: "HEAD", cache: "no-store", credentials: "omit" });
  const ms = Date.parse(res.headers.get("date") || "");
  if (!Number.isFinite(ms)) throw new Error("no-date-header");
  return new Date(ms + Math.round((Date.now() - t0) / 2)); // + metà del giro
}

// Ora del server come Date (3 tentativi).
export async function serverNow() {
  let err;
  for (let i = 0; i < 3; i++) {
    try { return await probe(); } catch (e) { err = e; await wait(250 * (i + 1)); }
  }
  throw new Error("Ora del server non disponibile: riprova.");
}

// Scarto (ms) fra server e dispositivo: da sommare a Date.now() per avere l'ora vera.
export async function serverClockOffset() {
  const t = await serverNow();
  return t.getTime() - Date.now();
}
