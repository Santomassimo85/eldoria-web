// api/genera-video.js
// Avvia la generazione di un VIDEO breve con fal.ai (Vidu Q4 image-to-video).
// La chiave sta in FAL_KEY (Vercel), MAI nel client. La generazione e'
// asincrona: qui si SOTTOMETTE il lavoro alla coda di fal e si restituiscono
// gli URL di stato/risultato; il client poi interroga /api/video-stato.
//
// Costo: Vidu Q4 ~0,07 $/s (720p). Un clip di default (6 s) ≈ 0,40 €.

const MODEL = "fal-ai/vidu/q4/image-to-video";
const SUBMIT_URL = `https://queue.fal.run/${MODEL}`;

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const key = process.env.FAL_KEY || "";
  if (!key) {
    return res.status(500).json({ error: "Manca FAL_KEY: aggiungila nelle variabili d'ambiente di Vercel." });
  }

  const { imageUrl, prompt, duration, resolution } = req.body || {};
  if (!imageUrl || typeof imageUrl !== "string") {
    return res.status(400).json({ error: "Serve una copertina (imageUrl) da cui partire." });
  }

  // Durata 3–16 s (Vidu); default 6. Risoluzione: 720p di default (buon prezzo).
  const dur = Math.min(16, Math.max(3, Number(duration) || 6));
  const RES = ["540p", "720p", "1080p", "2K", "4K"];
  const resol = RES.includes(resolution) ? resolution : "720p";

  const input = {
    image_url: imageUrl,
    prompt: String(prompt || "").slice(0, 5000) ||
      "Subtle cinematic motion, slow drifting camera, living fantasy illustration, gentle parallax, drifting embers and dust, flowing fabric and hair, atmospheric light. Keep the original art style.",
    duration: dur,
    resolution: resol,
  };

  try {
    const r = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify(input),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.detail || data?.error || `fal HTTP ${r.status}`;
      return res.status(502).json({ error: typeof msg === "string" ? msg : JSON.stringify(msg) });
    }
    // fal restituisce request_id + status_url + response_url.
    return res.status(200).json({
      requestId: data.request_id,
      statusUrl: data.status_url,
      responseUrl: data.response_url,
    });
  } catch (e) {
    return res.status(500).json({ error: "Errore avvio video: " + (e.message || e) });
  }
}
