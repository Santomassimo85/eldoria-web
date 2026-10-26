// api/video-file.js?url=<url video fal>
// Proxy che scarica l'mp4 generato da fal (host fal.media) e lo restituisce al
// client, per evitare problemi di CORS quando il sito lo ricarica su Storage.
// Accetta SOLO URL di fal (difesa SSRF).

export const config = { maxDuration: 60 };

const okUrl = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && /(^|\.)fal\.(media|run)$/.test(x.hostname);
  } catch { return false; }
};

export default async function handler(req, res) {
  const url = req.query?.url;
  if (!okUrl(url)) return res.status(400).json({ error: "URL non valido." });
  try {
    const key = process.env.FAL_KEY || "";
    const r = await fetch(url, key ? { headers: { Authorization: `Key ${key}` } } : undefined);
    if (!r.ok) return res.status(502).json({ error: `Download fal HTTP ${r.status}` });
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("content-type", r.headers.get("content-type") || "video/mp4");
    res.setHeader("cache-control", "no-store");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: "Errore proxy video: " + (e.message || e) });
  }
}
