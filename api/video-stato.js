// api/video-stato.js
// Interroga lo stato di un video fal.ai avviato da /api/genera-video e, quando
// e' pronto, restituisce l'URL del video (hostato da fal). La chiave FAL_KEY
// resta qui lato server. Il client chiama questo ogni ~5 s finche' ready=true.

export const config = { maxDuration: 30 };

// Difesa SSRF: accettiamo solo URL della coda di fal.
const okFalUrl = (u) => typeof u === "string" && /^https:\/\/queue\.fal\.run\//.test(u);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const key = process.env.FAL_KEY || "";
  if (!key) return res.status(500).json({ error: "Manca FAL_KEY." });

  const { statusUrl, responseUrl } = req.body || {};
  if (!okFalUrl(statusUrl) || !okFalUrl(responseUrl)) {
    return res.status(400).json({ error: "URL di stato non validi." });
  }

  const auth = { Authorization: `Key ${key}` };

  try {
    const rs = await fetch(statusUrl, { headers: auth });
    const st = await rs.json().catch(() => ({}));
    if (!rs.ok) {
      return res.status(502).json({ error: st?.detail || `fal stato HTTP ${rs.status}` });
    }
    const status = st.status || "IN_PROGRESS";
    if (status !== "COMPLETED") {
      // IN_QUEUE / IN_PROGRESS: ancora in lavorazione.
      return res.status(200).json({ ready: false, status });
    }

    // Pronto: leggi il risultato.
    const rr = await fetch(responseUrl, { headers: auth });
    const out = await rr.json().catch(() => ({}));
    if (!rr.ok) {
      return res.status(502).json({ error: out?.detail || `fal risultato HTTP ${rr.status}` });
    }
    const url = out?.video?.url;
    if (!url) return res.status(502).json({ error: "Video non trovato nel risultato fal." });
    return res.status(200).json({ ready: true, url, coverUrl: out?.cover_image?.url || "" });
  } catch (e) {
    return res.status(500).json({ error: "Errore stato video: " + (e.message || e) });
  }
}
