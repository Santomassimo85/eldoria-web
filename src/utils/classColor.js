/* ── COLORE DI CLASSE (solo presentazione) — condiviso tra Eroi (Party),
      menu avatar (LoginDropdown) e chiunque voglia tingere un elemento con
      la classe del PG. Colori ACCESI per il fondo scuro del Nesso. ── */
export const CLASS_COLORS = [
  [/mago|wizard/i,            "#60a5fa"], // blu arcano
  [/stregon|sorcer/i,         "#f472b6"], // rosa sangue di drago
  [/warlock|occult/i,         "#a78bfa"], // viola del patto
  [/chieric|cleric/i,         "#fde68a"], // oro sacro
  [/paladin/i,                "#fbbf24"], // ambra del giuramento
  [/guerrier|fighter/i,       "#f87171"], // rosso d'acciaio
  [/barbar/i,                 "#fb923c"], // arancio furia
  [/ladr|rogue/i,             "#a3e635"], // lime dell'ombra
  [/ranger|sniper|arcier/i,   "#4ade80"], // verde bosco
  [/druid/i,                  "#34d399"], // smeraldo
  [/bard/i,                   "#e879f9"], // magenta
  [/monac|monk/i,             "#2dd4bf"], // teal
  [/artef|artific/i,          "#22d3ee"], // ciano
];

/** Il Master veste l'oro chiaro. */
export const MASTER_COLOR = "#fde68a";

export const classColor = (klass) => {
  const k = String(klass || "");
  const hit = CLASS_COLORS.find(([re]) => re.test(k));
  return hit ? hit[1] : "#c4b5fd";
};
