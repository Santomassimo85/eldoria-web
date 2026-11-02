// src/utils/aiSprite.js
//
// Generazione di sprite pixel-art SENZA sfondo via l'endpoint Vercel
// /api/genera-immagine (Gemini). Il soggetto viene chiesto su fondo magenta
// uniforme e poi lo sfondo viene rimosso lato client con un flood-fill dai bordi
// (chroma key). Restituisce un dataURL PNG trasparente, pronto da salvare in
// Firestore (prop_sprites) o da convertire in blob per lo Storage.

import { getImageTone } from "../data/imageTone";

// Prompt per un PROP della mappa (albero/sasso/colonna): oggetto singolo, niente
// scena, su fondo magenta da rimuovere.
const PROP_SUBJECT = {
  tree: "a single fantasy tree (trunk and foliage)",
  boulder: "a single large rounded rock / boulder",
  column: "a single ancient stone column / pillar",
};
export function propPixelPrompt(kind) {
  const subj = PROP_SUBJECT[kind] || "a single fantasy map object";
  return `Pixel art sprite of ${subj} for a tactical RPG battle map.
Style: crisp 16-bit pixel art, limited palette, clean hard outlines, NO anti-aliasing, NO blur.
CRITICAL: render ONLY the object, centered, on a SOLID UNIFORM background of pure magenta (#FF00FF, RGB 255,0,255). The background MUST be one flat magenta color — no gradient, no ground, no shadow, no scenery, no other objects. No text, no frame, no border.`;
}

// Rimuove lo sfondo magenta e ridimensiona a pixel-art. Ritorna un dataURL PNG.
// Pulizia migliorata (2026-11-02): prima si toglieva lo sfondo DOPO aver
// rimpicciolito e solo partendo dai bordi, con 4 angoli come riferimento: restavano
// aloni viola sui contorni (pixel sfumati fra creatura e magenta), le "isole"
// di sfondo chiuse (fra zampe e coda) e il rumore del jpeg. Ora, a piena
// risoluzione: colore di fondo = mediana del bordo, flood-fill dai bordi,
// via anche il fondo racchiuso, contorni ripuliti (i pixel color magenta-sporco
// a contatto col trasparente spariscono, gli altri perdono la tinta magenta),
// via i puntini isolati; solo alla fine si rimpicciolisce senza sfumare.
const MAGENTA = [255, 0, 255];

function cleanPixels(d, w, h) {
  const N = w * h;
  const A = (p) => d[p * 4 + 3];
  // 1) colore di fondo: mediana dei pixel di bordo ancora opachi (o magenta puro)
  const border = [];
  for (let x = 0; x < w; x++) { border.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { border.push(y * w, y * w + w - 1); }
  const opaque = border.filter((p) => A(p) > 0);
  let ref = MAGENTA;
  if (opaque.length > border.length * 0.5) {
    const med = (k) => { const v = opaque.map((p) => d[p * 4 + k]).sort((a, b) => a - b); return v[v.length >> 1]; };
    ref = [med(0), med(1), med(2)];
  }
  const refMagenta = ref[0] > 150 && ref[2] > 150 && ref[1] < 110;
  const dist2 = (p) => { const r = d[p * 4] - ref[0], g = d[p * 4 + 1] - ref[1], b = d[p * 4 + 2] - ref[2]; return r * r + g * g + b * b; };
  // "magenta-ità": quanto rosso e blu superano il verde
  const mag = (p) => Math.min(d[p * 4], d[p * 4 + 2]) - d[p * 4 + 1];
  const looksBg = (p, tol) => dist2(p) <= tol * tol || (refMagenta && mag(p) > 120 && Math.abs(d[p * 4] - d[p * 4 + 2]) < 90);
  const clear = (p) => { d[p * 4 + 3] = 0; };

  // 2) flood-fill dai bordi (e da ciò che è già trasparente)
  const seen = new Uint8Array(N);
  const stack = [];
  for (let p = 0; p < N; p++) if (A(p) === 0) stack.push(p);
  border.forEach((p) => stack.push(p));
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (A(p) !== 0) { if (!looksBg(p, 120)) continue; clear(p); }
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  // 3) fondo racchiuso (fra zampe, dentro le anse): solo se è proprio color fondo
  for (let p = 0; p < N; p++) {
    if (A(p) === 0) continue;
    if (dist2(p) <= 55 * 55 || (refMagenta && mag(p) > 175 && Math.abs(d[p * 4] - d[p * 4 + 2]) < 70)) clear(p);
  }
  // 4) contorni: due passate sui pixel opachi che toccano il trasparente
  const nearClear = (p) => {
    const x = p % w, y = (p / w) | 0;
    return (x > 0 && A(p - 1) === 0) || (x < w - 1 && A(p + 1) === 0) || (y > 0 && A(p - w) === 0) || (y < h - 1 && A(p + w) === 0);
  };
  for (let pass = 0; pass < 2; pass++) {
    const edge = [];
    for (let p = 0; p < N; p++) if (A(p) !== 0 && nearClear(p)) edge.push(p);
    edge.forEach((p) => {
      const m = mag(p);
      if (refMagenta ? (m > 60 && dist2(p) <= 175 * 175) : dist2(p) <= 150 * 150) { clear(p); return; }
      if (refMagenta && m > 15) {
        // toglie la tinta magenta rimasta sul contorno
        const ex = m * 0.85;
        d[p * 4] = Math.max(0, d[p * 4] - ex);
        d[p * 4 + 2] = Math.max(0, d[p * 4 + 2] - ex);
      }
      d[p * 4 + 3] = 255; // niente semi-trasparenze: pixel art
    });
  }
  // 5) puntini isolati (macchioline rimaste nel fondo)
  const minSize = Math.max(4, Math.round(N * 0.00004));
  const comp = new Int32Array(N).fill(-1);
  let id = 0;
  for (let s = 0; s < N; s++) {
    if (A(s) === 0 || comp[s] !== -1) continue;
    const list = [s];
    comp[s] = id;
    for (let i = 0; i < list.length; i++) {
      const p = list[i], x = p % w, y = (p / w) | 0;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      nb.forEach((q) => { if (q >= 0 && A(q) !== 0 && comp[q] === -1) { comp[q] = id; list.push(q); } });
    }
    if (list.length < minSize) list.forEach(clear);
    id += 1;
  }
  // 6) alfa binario
  for (let p = 0; p < N; p++) if (A(p) !== 0 && A(p) < 128) clear(p); else if (A(p) !== 0) d[p * 4 + 3] = 255;
}

export function dataUrlToTransparentDataUrl(dataUrl, maxPx = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // pulizia a piena risoluzione (al massimo 1024 di lato)
        const big = Math.min(1, 1024 / Math.max(img.width, img.height));
        const W = Math.round(img.width * big), H = Math.round(img.height * big);
        const c1 = document.createElement("canvas");
        c1.width = W; c1.height = H;
        const x1 = c1.getContext("2d", { willReadFrequently: true });
        x1.imageSmoothingEnabled = false;
        x1.drawImage(img, 0, 0, W, H);
        const id1 = x1.getImageData(0, 0, W, H);
        cleanPixels(id1.data, W, H);
        x1.putImageData(id1, 0, 0);
        // poi si rimpicciolisce senza sfumare
        const scale = W > maxPx ? maxPx / W : 1;
        const w = Math.round(W * scale), h = Math.round(H * scale);
        const c2 = document.createElement("canvas");
        c2.width = w; c2.height = h;
        const x2 = c2.getContext("2d", { willReadFrequently: true });
        x2.imageSmoothingEnabled = false;
        x2.drawImage(c1, 0, 0, w, h);
        // un ultimo giro sui contorni alla misura finale
        const id2 = x2.getImageData(0, 0, w, h);
        cleanPixels(id2.data, w, h);
        x2.putImageData(id2, 0, 0);
        resolve(c2.toDataURL("image/png"));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("immagine non caricabile"));
    img.src = dataUrl;
  });
}

// Ripulisce uno sprite già salvato (già trasparente) senza ridimensionarlo.
export function cleanSpriteDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.imageSmoothingEnabled = false;
        x.drawImage(img, 0, 0);
        const id = x.getImageData(0, 0, c.width, c.height);
        const before = id.data.slice();
        cleanPixels(id.data, c.width, c.height);
        // niente cambiato = stesso dataURL (chi chiama capisce che era già pulito)
        let changed = false;
        for (let i = 0; i < before.length && !changed; i++) if (before[i] !== id.data[i]) changed = true;
        if (!changed) { resolve(dataUrl); return; }
        x.putImageData(id, 0, 0);
        resolve(c.toDataURL("image/png"));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("immagine non caricabile"));
    img.src = dataUrl;
  });
}

/**
 * Genera uno sprite pixel-art trasparente da un prompt e lo restituisce come dataURL.
 * @param {string} prompt
 * @param {{maxPx?:number}} opts
 * @returns {Promise<string>} dataURL PNG con sfondo trasparente
 */
export async function generateTransparentSpriteDataUrl(prompt, { maxPx = 256 } = {}) {
  const r = await fetch("/api/genera-immagine", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, tono: getImageTone() }),
  });
  const data = await r.json();
  if (!r.ok || data.error || !data.immagine) throw new Error(data.error || "Nessuna immagine ricevuta.");
  return await dataUrlToTransparentDataUrl(data.immagine, maxPx);
}
