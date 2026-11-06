/* EMOJI → ICONE IN TUTTO IL SITO (2026-11-06). Tutto il JSX del sito passa di qui (jsxImportSource
   in vite.config.js): i testi figli di un elemento HTML vengono spezzati e le emoji diventano
   <span class="gi gi-m"> col disegno di game-icons.net. I componenti ricevono le stringhe intatte
   (la logica non cambia): si tocca solo l'ultimo passo, quello che finisce a schermo. */
import { jsx, Fragment } from "react/jsx-runtime";
import { emojiParts, iconUrl } from "./emojiParts";

// qui dentro non si può mettere un <span>: resta l'emoji
const SKIP = new Set(["option", "optgroup", "title", "textarea", "style", "script", "text", "tspan", "textPath", "desc"]);
const FORWARD_REF = Symbol.for("react.forward_ref");

const cache = new Map();
function iconizeText(text) {
  let hit = cache.get(text);
  if (hit !== undefined) return hit;
  const parts = emojiParts(text);
  hit = parts ? parts.map((p, i) => (typeof p === "string" ? p : jsx("span", {
    className: "gi gi-m gi--sm", "aria-hidden": "true",
    style: p.color ? { "--gi-i": iconUrl(p.name), "--gi-c": p.color } : { "--gi-i": iconUrl(p.name) },
  }, `i${i}`))) : text;
  if (cache.size > 4000) cache.clear();
  cache.set(text, hit);
  return hit;
}

function iconizeChild(c) {
  if (typeof c === "string") return iconizeText(c);
  if (Array.isArray(c)) {
    let out = null;
    for (let i = 0; i < c.length; i++) {
      const n = iconizeChild(c[i]);
      if (n !== c[i]) { out ||= c.slice(); out[i] = n; }
    }
    return out || c;
  }
  return c;
}

/* HTML, frammenti e i forwardRef delle librerie (Link e NavLink): gli altri componenti no,
   perché i loro figli passano comunque di qui quando arrivano a un elemento vero. */
const wants = (type) => (typeof type === "string" ? !SKIP.has(type) : type === Fragment || type?.$$typeof === FORWARD_REF);

export function iconizeProps(type, props) {
  if (!props || props.children == null || !wants(type)) return props;
  const children = iconizeChild(props.children);
  return children === props.children ? props : { ...props, children };
}
