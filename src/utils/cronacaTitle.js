// Titolo delle cronache: "Cronaca di Obia, Vol. XXIV — "Il Lago dei Druidi Inventati"".
// La PRIMA parte ("Cronaca di Obia, Vol. XXV") si ricava dall'ultima cronaca del
// gruppo, col numero romano successivo e lo stesso stile (ogni gruppo ha il suo:
// ENOX "Cronache di obia - vol. X "…"", LEAF in maiuscolo…). La SECONDA parte,
// il nome della cronaca, la sceglie il Master.

const ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];

export function toRoman(n) {
  let x = Math.max(1, Math.floor(Number(n) || 1)), r = "";
  for (const [v, s] of ROMAN) while (x >= v) { r += s; x -= v; }
  return r;
}

export function fromRoman(s) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const t = String(s || "").toUpperCase();
  let total = 0;
  for (let i = 0; i < t.length; i++) {
    const v = map[t[i]] || 0, next = map[t[i + 1]] || 0;
    total += v < next ? -v : v;
  }
  return total;
}

const DEFAULT = { prefix: "Cronaca di Obia, Vol. I", sep: " — ", open: "“", close: "”" };

// Dall'ultimo titolo del gruppo → { prefix, sep, open, close } della cronaca successiva.
export function nextTitleParts(lastTitle, fallbackNumber = 1) {
  const t = String(lastTitle || "").trim();
  const m = t.match(/^(.*?\bvol\.?\s*)([IVXLCDM]+)\b(\s*[—–\-:·,]?\s*)(["“”«]?)/i);
  if (!m) return { ...DEFAULT, prefix: `Cronaca di Obia, Vol. ${toRoman(fallbackNumber)}` };
  const upper = m[2] === m[2].toUpperCase();
  let roman = toRoman(fromRoman(m[2]) + 1);
  if (!upper) roman = roman.toLowerCase();
  const sep = m[3] && (m[3].trim() || m[4]) ? m[3] : " — ";
  const open = m[4] || "";
  const close = open === "“" ? "”" : open === "«" ? "»" : open;
  return { prefix: m[1] + roman, sep, open, close };
}

export function composeTitle({ prefix, sep, open, close }, name) {
  const n = String(name || "").trim().replace(/^["“”«»]+|["“”«»]+$/g, "");
  if (!n) return String(prefix || "").trim();
  return `${String(prefix || "").trim()}${sep}${open}${n}${close}`;
}
