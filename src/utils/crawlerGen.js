/* Immagini dell'IA per la vista in prima persona (admin delle Segrete). */
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";
import { getImageTone } from "../data/imageTone";
import { frontPrompt } from "../fx/crawlerArt";
import { dataUrlToTransparentDataUrl } from "./aiSprite";

export async function askImage(body) {
  const r = await fetch("/api/genera-immagine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, tono: getImageTone() }) });
  const data = await r.json();
  if (!r.ok || data.error || !data.immagine) throw new Error(data.error || "Nessuna immagine ricevuta.");
  return data.immagine;
}
// sprite frontale di un mostro: se c'è lo sprite classico l'IA parte da lì, così resta lo stesso mostro
export async function frontSpriteUrl(m) {
  const img = await askImage({ prompt: frontPrompt(m.name, m.desc, !!m.imageUrl), ...(m.imageUrl ? { refs: [m.imageUrl] } : {}) });
  const clean = await dataUrlToTransparentDataUrl(img, 256);
  const blob = await (await fetch(clean)).blob();
  const ref = storageRef(storage, `segrete/fronte-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
  await uploadBytes(ref, blob, { contentType: "image/png" });
  return getDownloadURL(ref);
}
