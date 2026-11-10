/* Immagini dell'IA per la vista in prima persona (admin delle Segrete). */
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";
import { getImageTone } from "../data/imageTone";
import { frontPrompt } from "../fx/crawlerArt";
import { dataUrlToTransparentDataUrl } from "./aiSprite";

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Immagine non leggibile.")); i.src = src; });
// la mano sinistra rovesciata = una mano destra: è il modello giusto per l'arma
export async function flipX(dataUrl) {
  const i = await loadImg(dataUrl), c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
  const g = c.getContext("2d"); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(i, 0, 0);
  return c.toDataURL("image/png");
}
// toglie dallo sprite di un'arma a una mano la mano in più che l'IA a volte disegna in basso a sinistra.
// Restituisce null se lì non c'era niente.
export async function dropExtraHand(dataUrl) {
  const i = await loadImg(dataUrl), c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(i, 0, 0);
  const x1 = Math.round(c.width * 0.46), y0 = Math.round(c.height * 0.5), d = g.getImageData(0, y0, x1, c.height - y0).data;
  let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k] > 40) n++;
  if (n < 30) return null;
  g.clearRect(0, y0, x1, c.height - y0);
  return c.toDataURL("image/png");
}
// lo sprite tocca il bordo in alto (arma tagliata)?
export async function touchesTop(dataUrl) {
  const i = await loadImg(dataUrl), c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(i, 0, 0);
  const d = g.getImageData(0, 0, c.width, 3).data;
  let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k] > 40) n++;
  return n > 2;
}
export async function askImage(body) {
  const r = await fetch("/api/genera-immagine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, tono: getImageTone() }) });
  const data = await r.json();
  if (!r.ok || data.error || !data.immagine) throw new Error(data.error || "Nessuna immagine ricevuta.");
  return data.immagine;
}
// Lo sprite salvato ha il fondo trasparente: come riferimento all'IA va messo sul magenta (sul nero
// trasparente l'IA perdeva la sagoma e a volte ridisegnava lo stesso sprite di tre quarti).
export async function refOnMagenta(url) {
  try {
    const b = await (await fetch(url)).blob();
    const src = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); });
    const i = await loadImg(src), k = Math.min(1, 512 / Math.max(i.width, i.height));
    const c = document.createElement("canvas"); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
    const g = c.getContext("2d"); g.fillStyle = "#ff00ff"; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false; g.drawImage(i, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } catch { return url; }
}
// Usa il frontale esistente come riferimento; accetta anche immagini già archiviate.
export async function frontSpriteUrl(m) {
  const source = m.frontImageUrl || m.imageUrl;
  const ref = source ? await refOnMagenta(source) : "";
  const img = await askImage({ prompt: frontPrompt(m.name, m.look || m.desc, !!ref, m.size), aspectRatio: "3:4", ...(ref ? { refs: [ref], refMode: "same" } : {}) });
  const clean = await dataUrlToTransparentDataUrl(img, 256);
  const blob = await (await fetch(clean)).blob();
  const sref = storageRef(storage, `segrete/fronte-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
  await uploadBytes(sref, blob, { contentType: "image/png" });
  return getDownloadURL(sref);
}
