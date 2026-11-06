/* Spezza un testo nei suoi pezzi: stringhe e icone al posto delle emoji di src/data/emojiIcons.js.
   Niente React qui: lo usano sia il runtime JSX sia chi scrive direttamente nel DOM (fillEmoji). */
import { EMOJI_ICONS, T } from "../data/emojiIcons";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RE = new RegExp(
  `(?:${Object.keys(EMOJI_ICONS).sort((a, b) => b.length - a.length).map(esc).join("|")})` +
  "[\\u{1F3FB}-\\u{1F3FF}]?\\uFE0F?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*",
  "gu",
);
// controllo veloce: quasi tutti i testi non hanno niente di simile a un'emoji
const HINT = /[ℹ←-⯿\uD83C-\uD83E]/;

export const iconUrl = (name) => `url(/gi/${name}.svg)`;

function iconOf(match) {
  const [name, tone] = (EMOJI_ICONS[String.fromCodePoint(match.codePointAt(0))] || "").split("|");
  return name ? { name, color: tone ? T[tone] : undefined } : null;
}

/** null se il testo non ha emoji da cambiare, altrimenti [stringa | {name, color}, …] */
export function emojiParts(text) {
  if (!HINT.test(text)) return null;
  let last = 0, out = null;
  for (const m of text.matchAll(RE)) {
    const ic = iconOf(m[0]);
    if (!ic) continue;
    out ||= [];
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(ic);
    last = m.index + m[0].length;
  }
  if (!out) return null;
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** come el.textContent = text, ma con le icone (per chi non passa da React) */
export function fillEmoji(el, text) {
  el.textContent = "";
  for (const p of emojiParts(String(text)) || [String(text)]) {
    if (typeof p === "string") { el.append(p); continue; }
    const s = document.createElement("span");
    s.className = "gi gi-m gi--sm";
    s.setAttribute("aria-hidden", "true");
    s.style.setProperty("--gi-i", iconUrl(p.name));
    if (p.color) s.style.setProperty("--gi-c", p.color);
    el.append(s);
  }
}
