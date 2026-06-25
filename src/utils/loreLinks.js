// ─────────────────────────────────────────────────────────────────────────
// loreLinks — rende cliccabili i nomi noti (personaggi, NPC, città) dentro
// l'HTML dei riassunti, SENZA toccare tag/attributi/link già presenti.
//
// 1) buildLoreRegistry({characters, npcs, cities}) → { regex, lookup, size }
// 2) linkifyLoreHtml(html, registry) → nuovo HTML con <a data-lore …> sui nomi
//
// La navigazione vera è gestita da chi renderizza (delegated click su
// a[data-lore] → useNavigate). Le pagine bersaglio leggono ?focus=/?hero=.
// ─────────────────────────────────────────────────────────────────────────

import { CITIES_HUB } from "../data/citiesHub";
import { isHiddenChar } from "../data/hiddenPlayers";

// slugify IDENTICO a quello usato nelle pagine NPC/Geo (niente strip accenti),
// così ?focus=<slug> combacia con gli id delle schede.
export const loreSlug = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// chiave di confronto: minuscolo, apostrofi unificati, spazi compattati.
export const norm = (s) =>
  String(s ?? "").toLowerCase().replace(/[’´`ʼ]/g, "'").replace(/\s+/g, " ").trim();

export const firstTok = (s) => norm(s).split(/[\s'"\-]+/)[0];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// da una chiave normalizzata costruisce un pattern tollerante a varianti di
// apostrofo e di spaziatura presenti nel testo originale.
const patternFor = (key) =>
  escapeRe(key)
    .replace(/'/g, "['’´`]")
    .replace(/\\?\s+/g, "\\s+");

const isWordChar = (c) => !!c && /[\p{L}\p{N}]/u.test(c);

/* Costruisce il registro dei nomi linkabili.
   - characters: array di doc {id, name} (collection `characters`)
   - npcs:       array di doc {name}      (collection `npcs`)
   - cities:     array di stringhe        (nomi città; opzionale, si fondono a CITIES_HUB) */
export function buildLoreRegistry({ characters = [], npcs = [], cities = [] } = {}) {
  const lookup = new Map(); // key normalizzata → { type, href, len }
  const add = (rawName, type, href) => {
    const key = norm(rawName);
    if (key.length < 4) return;          // evita match troppo corti/ambigui
    if (lookup.has(key)) return;         // primo arrivato vince
    lookup.set(key, { type, href, len: key.length });
  };

  // ── Personaggi (PG) → /party?hero=<primo nome> ──
  for (const c of characters) {
    if (!c?.name || isHiddenChar(c)) continue;
    const tok = firstTok(c.name);
    if (!tok) continue;
    const href = `/party?hero=${encodeURIComponent(tok)}`;
    add(c.name, "char", href);          // nome completo ("Caius Maxis-Richtofen")
    add(tok, "char", href);             // alias breve ("Caius")
  }

  // ── NPC → /npc?focus=<slug> ──
  for (const n of npcs) {
    if (!n?.name) continue;
    add(n.name, "npc", `/npc?focus=${loreSlug(n.name)}`);
  }

  // ── Città → /Geo?focus=<slug> ──
  const cityNames = [...CITIES_HUB.map((c) => c.name), ...cities];
  for (const name of cityNames) {
    if (!name) continue;
    add(name, "city", `/Geo?focus=${loreSlug(name)}`);
  }

  if (lookup.size === 0) return { regex: null, lookup, size: 0 };

  // alternation ordinata per lunghezza DESC (alternation JS = leftmost-first,
  // quindi i nomi più lunghi vanno prima per vincere su "Caius" vs "Caius …").
  const keys = [...lookup.keys()].sort((a, b) => b.length - a.length);
  const regex = new RegExp("(" + keys.map(patternFor).join("|") + ")", "giu");
  return { regex, lookup, size: lookup.size };
}

// Sostituisce i match dentro un singolo nodo testo.
function replaceInText(textNode, doc, registry) {
  const text = textNode.nodeValue;
  if (!text || !text.trim()) return;
  const re = registry.regex;
  re.lastIndex = 0;
  let m, last = 0, frag = null;
  while ((m = re.exec(text)) !== null) {
    const matched = m[0];
    const start = m.index;
    const end = start + matched.length;
    if (matched.length === 0) { re.lastIndex++; continue; }
    // confine di parola: niente lettere/cifre attaccate prima/dopo
    if (isWordChar(text[start - 1]) || isWordChar(text[end])) continue;
    const target = registry.lookup.get(norm(matched));
    if (!target) continue;
    if (!frag) frag = doc.createDocumentFragment();
    if (start > last) frag.appendChild(doc.createTextNode(text.slice(last, start)));
    const a = doc.createElement("a");
    a.setAttribute("data-lore", target.type);
    a.setAttribute("data-href", target.href);
    a.setAttribute("data-key", norm(matched)); // chiave per risolvere i dettagli nel popup
    a.setAttribute("href", "#" + target.href); // fallback non-JS, intercettato al click
    a.className = `lore-link lore-link--${target.type}`;
    a.textContent = matched;
    frag.appendChild(a);
    last = end;
  }
  if (frag) {
    if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
    textNode.parentNode.replaceChild(frag, textNode);
  }
}

const SKIP_TAGS = new Set(["A", "SCRIPT", "STYLE", "CODE", "PRE", "BUTTON", "TEXTAREA"]);

/* Restituisce un nuovo HTML con i nomi noti trasformati in link interni.
   Se non c'è nulla da fare (no registro / no DOMParser) ritorna l'html invariato. */
export function linkifyLoreHtml(html, registry) {
  if (!html || !registry?.regex) return html;
  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") return html;
  try {
    const doc = new DOMParser().parseFromString(`<div id="__lore_root">${html}</div>`, "text/html");
    const root = doc.getElementById("__lore_root");
    if (!root) return html;
    const walk = (node) => {
      for (let child = node.firstChild; child; ) {
        const next = child.nextSibling;
        if (child.nodeType === 3) {
          replaceInText(child, doc, registry);
        } else if (child.nodeType === 1 && !SKIP_TAGS.has(child.tagName)) {
          walk(child);
        }
        child = next;
      }
    };
    walk(root);
    return root.innerHTML;
  } catch (_) {
    return html;
  }
}
