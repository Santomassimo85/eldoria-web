// Dove sta DAVVERO la figura dentro uno sprite: i PNG hanno margini trasparenti
// diversi (Temistocle occupa solo l'angolo in basso a destra del suo quadrato),
// quindi nome e barra dei PF sotto il riquadro finivano lontani dai piedi.
// Misura una volta per immagine il riquadro dei pixel non trasparenti e restituisce,
// in frazioni del riquadro QUADRATO in cui lo sprite è disegnato (object-fit: contain,
// object-position: center bottom), il punto dei piedi (`feet`) e il centro (`cx`);
// `rawFeet`/`rawCx` sono le stesse misure in frazioni dell'immagine intera.
import { useEffect, useState } from "react";

const DEFAULT = { feet: 1, cx: 0.5, rawFeet: 1, rawCx: 0.5 };
const cache = new Map(); // url → {feet, cx} | Promise

function measure(url) {
  return new Promise((resolve) => {
    const img = new Image();
    if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) return resolve(DEFAULT);
        // basta una versione piccola per trovare il riquadro
        const k = Math.min(1, 160 / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
        const c = document.createElement("canvas");
        c.width = cw; c.height = ch;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, cw, ch);
        const data = ctx.getImageData(0, 0, cw, ch).data;
        let l = cw, r = -1, b = -1;
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            if (data[(y * cw + x) * 4 + 3] > 24) {
              if (x < l) l = x;
              if (x > r) r = x;
              if (y > b) b = y;
            }
          }
        }
        if (r < 0) return resolve(DEFAULT);
        // dimensioni disegnate nel quadrato (contain) e scostamento (center bottom)
        const m = Math.max(w, h);
        const dw = w / m, dh = h / m;
        const x0 = (1 - dw) / 2, y0 = 1 - dh;
        const rawFeet = (b + 1) / ch, rawCx = (l + r + 1) / 2 / cw;
        resolve({ feet: y0 + rawFeet * dh, cx: x0 + rawCx * dw, rawFeet, rawCx });
      } catch {
        resolve(DEFAULT); // immagine "tainted" (CORS): resta il centro del riquadro
      }
    };
    img.onerror = () => resolve(DEFAULT);
    img.src = url;
  });
}

/** `mirrored` = sprite specchiato in CSS (scaleX(-1)): il centro si ribalta. */
export function useSpriteBox(url, mirrored = false) {
  const hit = url ? cache.get(url) : null;
  const [box, setBox] = useState(hit && !(hit instanceof Promise) ? hit : DEFAULT);
  useEffect(() => {
    if (!url) { setBox(DEFAULT); return undefined; }
    let alive = true;
    let v = cache.get(url);
    if (!v) { v = measure(url).then((res) => { cache.set(url, res); return res; }); cache.set(url, v); }
    Promise.resolve(v).then((res) => { if (alive) setBox(res); });
    return () => { alive = false; };
  }, [url]);
  return mirrored ? { ...box, cx: 1 - box.cx, rawCx: 1 - box.rawCx } : box;
}

/** Variabili CSS da mettere sul contenitore dello sprite. */
export const spriteVars = (box) => ({ "--feet": box.feet.toFixed(3), "--cx": box.cx.toFixed(3) });
