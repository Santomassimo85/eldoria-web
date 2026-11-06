import { fillEmoji } from "../jsx/emojiParts";
/* Aggiornamento automatico (2026-10-31).
   L'app Android (Capacitor) e la PWA caricano il sito dal vivo, ma se restano
   aperte in secondo piano tengono il codice vecchio finché non si ricaricano.
   Qui si confronta lo script principale della pagina con quello dell'index.html
   pubblicato adesso:
   - al ritorno in primo piano, se è cambiato, si ricarica subito (l'utente non
     stava facendo niente);
   - con la pagina aperta, ogni 10 minuti: se è cambiato compare un avviso
     "Nuova versione · Aggiorna" in basso (niente ricarica a sorpresa a metà di
     una lotta o di un modulo). */

const CHECK_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;

const mainScriptOf = (root) => {
  const s = [...root.querySelectorAll('script[type="module"][src]')].map((el) => el.getAttribute("src"))
    .find((src) => /\/assets\/index-[^/]+\.js$/.test(src || ""));
  return s || null;
};

let current = null;
let lastCheck = 0;
let banner = null;

async function liveScript() {
  const res = await fetch(`/?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  return m ? m[1] : null;
}

function showBanner() {
  if (banner) return;
  banner = document.createElement("div");
  banner.setAttribute("role", "status");
  banner.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(96px + env(safe-area-inset-bottom));z-index:9000;display:flex;gap:10px;align-items:center;padding:10px 14px;background:#1c1714;color:#f3ead8;border:2px solid #f2c14e;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.5);font:600 14px Alegreya,Georgia,serif;max-width:calc(100vw - 32px)";
  const txt = document.createElement("span");
  fillEmoji(txt, "✨ C'è una nuova versione del sito");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Aggiorna";
  btn.style.cssText = "background:#f2c14e;color:#1c1714;border:0;border-radius:4px;padding:8px 12px;font:700 14px Cinzel,Georgia,serif;cursor:pointer;min-height:36px";
  btn.onclick = () => window.location.reload();
  const x = document.createElement("button");
  x.type = "button";
  x.textContent = "×";
  x.setAttribute("aria-label", "Più tardi");
  x.style.cssText = "background:none;border:0;color:#c9bfad;font-size:20px;cursor:pointer;min-width:32px;min-height:36px";
  x.onclick = () => { banner.remove(); banner = null; };
  banner.append(txt, btn, x);
  document.body.appendChild(banner);
}

async function check(fromForeground) {
  if (!current || Date.now() - lastCheck < MIN_GAP_MS) return;
  lastCheck = Date.now();
  try {
    const live = await liveScript();
    if (!live || live === current) return;
    if (fromForeground) window.location.reload();
    else showBanner();
  } catch { /* rete assente: si riprova al prossimo giro */ }
}

export function startAutoUpdate() {
  if (import.meta.env.DEV || typeof document === "undefined") return;
  current = mainScriptOf(document);
  if (!current) return;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check(true);
  });
  setInterval(() => { if (document.visibilityState === "visible") check(false); }, CHECK_MS);
}
