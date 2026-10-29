// Ritratto da mandare a Foundry dentro la voce della coda.
// Su Forge le immagini di Firebase non si caricano nel canvas (niente CORS per
// quel dominio: il token resta vuoto), quindi il sito — che invece può leggerle —
// le rimpicciolisce in un webp e le macro ("Fetch admin", "NCP gen") lo caricano
// fra i file di Foundry, come ritratto e come token.
export async function portraitData(url, max = 512) {
  const abs = new URL(url, window.location.origin).href; // anche "/assets/npc/…"
  const blob = await (await fetch(abs)).blob();
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/webp", 0.85);
}

// Link assoluto (le macro girano su Forge: "/assets/…" lì non esiste).
export const absoluteUrl = (url) => (url ? new URL(url, window.location.origin).href : "");
