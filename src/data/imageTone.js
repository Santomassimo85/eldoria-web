// src/data/imageTone.js
//
// TONO delle immagini disegnate dall'IA (2026-10-09): Normale · Serio ·
// Divertente · Horror. La chiave va a /api/genera-immagine come `tono`, che la
// traduce in una riga VINCOLANTE del prompt (vedi TONE_PROMPTS là). La scelta
// è una sola per tutto il sito (localStorage), così il Master la imposta una
// volta e vale per ritratti, scene, copertine, oggetti e sprite.
import { useEffect, useState } from "react";

export const IMAGE_TONES = [
  { key: "normale", label: "Normale", icon: "🎨", hint: "fantasy classico, equilibrato" },
  { key: "serio", label: "Serio", icon: "⚔", hint: "sobrio, solenne, realistico" },
  { key: "divertente", label: "Divertente", icon: "🍻", hint: "buffo, caricaturale, allegro" },
  { key: "horror", label: "Horror", icon: "💀", hint: "cupo, inquietante, macabro" },
];

const KEY = "ai_img_tono";
const EVT = "ai-img-tono";
const valid = (k) => IMAGE_TONES.some((t) => t.key === k);

export function getImageTone() {
  try {
    const k = localStorage.getItem(KEY);
    return valid(k) ? k : "normale";
  } catch { return "normale"; }
}

export function useImageTone() {
  const [tono, setTono] = useState(getImageTone);
  useEffect(() => {
    const sync = () => setTono(getImageTone());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const set = (k) => {
    if (!valid(k)) return;
    try { localStorage.setItem(KEY, k); } catch { /* niente storage: resta in pagina */ }
    setTono(k);
    window.dispatchEvent(new Event(EVT));
  };
  return [tono, set];
}
