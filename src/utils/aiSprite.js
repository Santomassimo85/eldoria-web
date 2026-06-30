// src/utils/aiSprite.js
//
// Generazione di sprite pixel-art SENZA sfondo via l'endpoint Vercel
// /api/genera-immagine (Gemini). Il soggetto viene chiesto su fondo magenta
// uniforme e poi lo sfondo viene rimosso lato client con un flood-fill dai bordi
// (chroma key). Restituisce un dataURL PNG trasparente, pronto da salvare in
// Firestore (prop_sprites) o da convertire in blob per lo Storage.

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

// Rimuove lo sfondo a tinta unita (magenta) con flood-fill dai bordi e
// ridimensiona a pixel-art. Ritorna un dataURL PNG.
export function dataUrlToTransparentDataUrl(dataUrl, maxPx = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxPx ? maxPx / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const cornerAt = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
      const corners = [cornerAt(0, 0), cornerAt(w - 1, 0), cornerAt(0, h - 1), cornerAt(w - 1, h - 1)];
      const ref = [0, 1, 2].map((k) => Math.round(corners.reduce((a, c) => a + c[k], 0) / corners.length));
      const TOL2 = 110 * 110;
      const match = (p) => {
        const dr = d[p * 4] - ref[0], dg = d[p * 4 + 1] - ref[1], db = d[p * 4 + 2] - ref[2];
        return dr * dr + dg * dg + db * db <= TOL2;
      };
      const visited = new Uint8Array(w * h);
      const stack = [];
      const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const p = y * w + x; if (!visited[p]) stack.push(p); };
      for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
      for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
      while (stack.length) {
        const p = stack.pop();
        if (visited[p]) continue;
        visited[p] = 1;
        if (!match(p)) continue;
        d[p * 4 + 3] = 0;
        const x = p % w, y = (p / w) | 0;
        push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
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
    body: JSON.stringify({ prompt }),
  });
  const data = await r.json();
  if (!r.ok || data.error || !data.immagine) throw new Error(data.error || "Nessuna immagine ricevuta.");
  return await dataUrlToTransparentDataUrl(data.immagine, maxPx);
}
