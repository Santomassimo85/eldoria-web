import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../AuthContext";

/* ============================================================
   Scheda PG — vista in stile grimorio, legge characters/{uid}.
   Stile e logica sono dentro questo file (niente CSS esterni).
   - La pagina parte SOTTO la navbar fissa (padding-top: --navbar-h).
   - Mobile-first (colonna ~560px), su PC si allarga a ~980px con
     griglie a più colonne.
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');
.spg-page{
  /* Pergamena Antica (chiaro) — palette ribaltata dal vecchio grimorio scuro */
  --bg:#ece0c2; --panel:#fbf4e0; --panel2:#f1e7cf; --line:#c9b78a;
  --gold:#7c560f; --gold-dim:#a9781a; --arc:#6f44c9; --arc-dim:#b79bf0;
  --ink:#33281a; --muted:#6a5b41; --hp:#b8362a; --hp-track:#e6d3c0;
  --neg:#b0552a; --key:#2c8a5a; --key-dim:#7bbf9a;
  min-height:100vh;
  /* la navbar del sito è FISSA: la scheda parte sempre sotto di lei */
  padding: calc(var(--navbar-h, 80px) + 16px) 14px 60px;
  font-family:'EB Garamond', Georgia, serif; font-size:17px; line-height:1.5; color:var(--ink);
  background:radial-gradient(900px 480px at 50% -8%, rgba(169,120,26,.14) 0%, rgba(246,237,214,0) 60%), var(--bg);
}
.spg-page *{box-sizing:border-box; -webkit-tap-highlight-color:transparent}
.spg-wrap{max-width:560px; margin:0 auto;}
.spg-loading,.spg-empty{max-width:520px;margin:60px auto;text-align:center;color:var(--muted);font-family:'EB Garamond',serif}
.spg-hero{display:flex;gap:16px;align-items:center;padding:6px 2px 18px}
.spg-portrait{width:84px;height:84px;flex:0 0 84px;border-radius:50%;
  background:linear-gradient(160deg,#f3ead4,#e3d4b0);border:2px solid var(--gold-dim);
  box-shadow:0 0 0 4px rgba(155,108,214,.12),0 6px 20px rgba(86,64,30,.28);
  display:flex;align-items:center;justify-content:center;overflow:hidden;
  font-family:'Cinzel',serif;font-size:34px;color:var(--gold)}
.spg-portrait img{width:100%;height:100%;object-fit:cover}
.spg-eyebrow{font-family:'Cinzel',serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--arc);margin:0 0 4px}
.spg-name{font-family:'Cinzel',serif;font-weight:700;font-size:27px;line-height:1.05;margin:0;color:var(--ink)}
.spg-sub{margin:5px 0 0;color:var(--muted);font-size:15px}
.spg-vitals{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;
  background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin-bottom:14px}
.spg-hptop{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.spg-hplabel{font-family:'Cinzel',serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.spg-hpval{font-family:'Cinzel',serif;font-size:18px}
.spg-hpval b{color:var(--hp)}
.spg-hpbar{height:10px;border-radius:6px;background:var(--hp-track);overflow:hidden}
.spg-hpfill{height:100%;background:linear-gradient(90deg,#a8453f,var(--hp));border-radius:6px;transition:width .8s ease}
.spg-ac{width:66px;height:74px;flex:0 0 66px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:radial-gradient(circle at 50% 30%,#fbf4e0,#e9dcbe);border:1px solid var(--gold-dim);
  clip-path:polygon(50% 0,100% 18%,100% 62%,50% 100%,0 62%,0 18%)}
.spg-ac .n{font-family:'Cinzel',serif;font-size:26px;color:var(--gold);line-height:1}
.spg-ac .l{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:3px}
.spg-ribbon{display:flex;gap:8px;margin-bottom:14px}
.spg-chip{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:9px 4px;text-align:center}
.spg-chip .n{font-family:'Cinzel',serif;font-size:19px;line-height:1}
.spg-chip .l{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:4px}
.spg-search{display:flex;align-items:center;gap:9px;background:var(--panel);border:1px solid var(--line);
  border-radius:12px;padding:10px 14px;margin-bottom:12px}
.spg-search:focus-within{border-color:var(--gold-dim)}
.spg-search .ico{flex:0 0 auto;opacity:.7}
.spg-search input{flex:1;min-width:0;background:transparent;border:none;outline:none;color:var(--ink);
  font-family:'EB Garamond',Georgia,serif;font-size:16px}
.spg-search input::placeholder{color:var(--muted);opacity:.8}
.spg-search .clr{flex:0 0 auto;background:transparent;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:2px 4px}
.spg-tabs{position:sticky;top:var(--navbar-h, 80px);z-index:5;display:flex;gap:4px;padding:8px 0 12px;
  background:linear-gradient(var(--bg) 78%,rgba(10,11,20,0))}
.spg-tab{flex:1;padding:10px 4px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--muted);
  font-family:'Cinzel',serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;text-align:center;cursor:pointer;transition:.18s}
.spg-tab.on{background:linear-gradient(180deg,#f3e6c4,#e9d9b0);color:var(--gold);border-color:var(--gold-dim);box-shadow:0 2px 8px -4px rgba(169,120,26,.5)}
.spg-panel{animation:spgFade .35s ease}
@keyframes spgFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.spg-sec{font-family:'Cinzel',serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-dim);
  margin:22px 2px 10px;display:flex;align-items:center;gap:10px}
.spg-sec::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line),transparent)}
.spg-runes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.spg-rune{position:relative;border:1px solid var(--line);border-radius:14px;padding:12px 6px 10px;text-align:center;overflow:hidden;
  background:radial-gradient(120px 60px at 50% -10%,rgba(155,108,214,.18),transparent 70%),linear-gradient(180deg,var(--panel2),var(--panel))}
.spg-rune .ab{font-family:'Cinzel',serif;font-size:11px;letter-spacing:.14em;color:var(--arc);text-transform:uppercase}
.spg-rune .mod{font-family:'Cinzel',serif;font-size:30px;color:var(--gold);line-height:1.1;margin:3px 0}
.spg-rune .score{font-size:13px;color:var(--muted)}
.spg-rune .save{margin-top:9px;padding-top:7px;border-top:1px solid var(--line);font-size:12px;color:var(--muted);
  display:flex;align-items:center;justify-content:center;gap:6px}
.spg-rune .save .dot{width:6px;height:6px;border-radius:50%;background:var(--line)}
.spg-rune.prof .save .dot{background:var(--gold);box-shadow:0 0 6px var(--gold)}
.spg-rune.prof .save{color:var(--ink)}
/* Stat chiave della classe → verde · modificatori negativi → arancio */
.spg-rune.keystat{border-color:var(--key-dim);
  background:radial-gradient(120px 60px at 50% -10%,rgba(95,207,138,.16),transparent 70%),linear-gradient(180deg,var(--panel2),var(--panel));
  box-shadow:0 0 12px rgba(95,207,138,.12)}
.spg-rune.keystat .ab{color:var(--key)}
.spg-rune.keystat .mod{color:var(--key)}
.spg-rune.keystat .keytag{position:absolute;top:6px;right:6px;font-size:9px;letter-spacing:.06em;color:var(--key);opacity:.9}
.spg-rune .mod.neg{color:var(--neg)}
.spg-skills{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}
.spg-skill{display:flex;align-items:center;gap:9px;padding:7px 2px;border-bottom:1px solid var(--line)}
.spg-skill .pip{width:8px;height:8px;border-radius:50%;border:1px solid var(--gold-dim);flex:0 0 8px}
.spg-skill.prof .pip{background:var(--gold);box-shadow:0 0 6px rgba(224,189,107,.6)}
.spg-skill .sn{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px}
.spg-skill .sm{font-family:'Cinzel',serif;color:var(--gold);font-size:15px}
.spg-cards{display:grid;grid-template-columns:1fr;gap:8px;align-items:start}
.spg-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.spg-card[open]{border-color:var(--gold-dim)}
.spg-card summary{list-style:none;cursor:pointer;padding:12px 14px;display:flex;align-items:center;gap:10px}
.spg-card summary::-webkit-details-marker{display:none}
.spg-card .cn{flex:1;min-width:0;font-size:16px}
.spg-badge{font-family:'Cinzel',serif;font-size:12px;padding:3px 8px;border-radius:7px;white-space:nowrap}
.spg-badge.dmg{background:rgba(184,54,42,.14);color:#b8362a;border:1px solid rgba(184,54,42,.4)}
.spg-badge.hit{background:rgba(224,189,107,.14);color:var(--gold);border:1px solid rgba(224,189,107,.3)}
.spg-chev{color:var(--muted);transition:.2s;flex:0 0 auto}
.spg-card[open] .spg-chev{transform:rotate(90deg)}
.spg-body{padding:0 14px 14px;color:var(--muted);font-size:15px;line-height:1.55}
.spg-roll{margin-top:10px;width:100%;padding:10px;border:1px solid var(--gold-dim);border-radius:9px;
  background:linear-gradient(180deg,#f3e6c4,#e9d9b0);color:var(--gold);font-family:'Cinzel',serif;font-size:14px;cursor:pointer}
.spg-roll:active{transform:scale(.98)}
.spg-slots{display:flex;flex-direction:column;gap:10px;margin-bottom:6px}
.spg-slot{background:linear-gradient(180deg,#efe2c6,var(--panel));border:1px solid var(--arc-dim);border-radius:12px;
  padding:12px 14px;display:flex;align-items:center;justify-content:space-between}
.spg-slot .sl{font-family:'Cinzel',serif;font-size:15px}
.spg-pips{display:flex;gap:6px}
.spg-pips .p{width:14px;height:14px;border-radius:50%;border:1px solid var(--arc-dim);background:transparent}
.spg-pips .p.on{background:var(--arc);box-shadow:0 0 8px rgba(155,108,214,.7)}
.spg-coins{display:flex;gap:8px;margin-bottom:16px}
.spg-coin{flex:1;text-align:center;background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:9px 2px}
.spg-coin .cv{font-family:'Cinzel',serif;font-size:17px;line-height:1}
.spg-coin .cl{font-size:10px;letter-spacing:.1em;color:var(--muted);margin-top:4px}
.spg-coin.pp .cv{color:#5a6b7a}.spg-coin.gp .cv{color:var(--gold)}.spg-coin.ep .cv{color:#8a7320}
.spg-coin.sp .cv{color:#6b7280}.spg-coin.cp .cv{color:#b5651d}
.spg-invgrid{display:grid;grid-template-columns:1fr;gap:7px;align-items:start}
.spg-inv{display:flex;align-items:center;gap:10px;padding:11px 12px;background:var(--panel);border:1px solid var(--line);border-radius:11px}
.spg-inv .qty{font-family:'Cinzel',serif;font-size:13px;color:var(--gold);min-width:30px;text-align:center}
.spg-inv .in{flex:1;min-width:0}
.spg-inv .in .nm{font-size:16px}
.spg-inv .in .mt{font-size:13px;color:var(--muted)}
.spg-inv .eq{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--arc);border:1px solid var(--arc-dim);border-radius:6px;padding:2px 6px}
.spg-bag{font-family:'Cinzel',serif;font-size:13px;letter-spacing:.1em;color:var(--gold-dim);margin:18px 2px 9px;display:flex;align-items:center;gap:8px}
.spg-hint{color:var(--muted);font-size:14px;text-align:center;padding:16px;border:1px dashed var(--line);border-radius:12px}
/* ── DESKTOP: scheda larga, griglie a più colonne ─────────────── */
@media (min-width:840px){
  .spg-wrap{max-width:980px}
  .spg-loading,.spg-empty{max-width:980px}
  .spg-portrait{width:104px;height:104px;flex-basis:104px;font-size:42px}
  .spg-name{font-size:34px}
  .spg-runes{grid-template-columns:repeat(6,1fr)}
  .spg-skills{grid-template-columns:repeat(3,1fr)}
  .spg-cards{grid-template-columns:1fr 1fr;gap:10px}
  .spg-invgrid{grid-template-columns:1fr 1fr;gap:9px}
  .spg-slots{flex-direction:row;flex-wrap:wrap}
  .spg-slot{flex:1 1 260px}
  .spg-tabs{gap:8px}
  .spg-tab{font-size:13px}
}
@media (prefers-reduced-motion:reduce){.spg-page *{animation:none!important;transition:none!important}}
`;

const AB_LABELS = { str:"FOR", dex:"DES", con:"COS", int:"INT", wis:"SAG", cha:"CAR" };
const sign = n => (n >= 0 ? "+" : "") + n;

/* Colore per livello di incantesimo: 0=trucchetti acciaio, 1=azzurro,
   2=rosso, 3=verde, 4=viola, 5=arancio, 6+=oro/teal/rosa/indaco. */
const LEVEL_COLORS = [
  "#a8b6c8", "#54a8e8", "#e25d55", "#52c47e", "#c468e0",
  "#e8a04c", "#e8d04c", "#7fd6d0", "#e87fb0", "#b0a8ff",
];
const levelColor = lv => LEVEL_COLORS[Math.max(0, Math.min(9, lv))] || "#a8b6c8";
// "Trucchetto" → 0 · "Livello 3" → 3 · altro → null
function spellLevelOf(category) {
  if (/trucchett/i.test(category || "")) return 0;
  if (/livello/i.test(category || "")) return parseInt((category || "").replace(/\D/g, ""), 10) || 0;
  return null;
}

/* Stat chiave per classe (verdi nella griglia caratteristiche).
   Match per parola chiave così funziona con nomi ITA/ENG da Foundry. */
const KEY_STATS_BY_CLASS = [
  [/barbar/i,            ["str", "con"]],
  [/guerr|fighter|warrior/i, ["str", "con"]],
  [/palad/i,             ["str", "cha"]],
  [/ranger|cacciat/i,    ["dex", "wis"]],
  [/monk|monac/i,        ["dex", "wis"]],
  [/rogue|ladr/i,        ["dex", "con"]],
  [/wizard|mago/i,       ["int", "con"]],
  [/sorcer|stregon/i,    ["cha", "con"]],
  [/warlock/i,           ["cha", "dex"]],
  [/bard/i,              ["cha", "dex"]],
  [/cleric|chier/i,      ["wis", "con"]],
  [/druid/i,             ["wis", "con"]],
  [/artif|artef/i,       ["int", "dex"]],
];
function keyStatsFor(charClass) {
  for (const [re, stats] of KEY_STATS_BY_CLASS) if (re.test(charClass || "")) return stats;
  return [];
}

/* Tipologie zaino: mappa il type di Foundry (ITA/ENG) a un gruppo leggibile. */
const INV_TYPE_GROUPS = [
  [/weapon|arma/i,                       "⚔ Armi"],
  [/ammo|muniz/i,                        "🏹 Munizioni"],
  [/armor|armatur|equip|abbigl|shield|scud/i, "🛡 Equipaggiamento"],
  [/consum|pozion|potion|cibo|food|scroll|pergamen/i, "🧪 Consumabili"],
  [/tool|strument|kit/i,                 "🛠 Strumenti"],
  [/loot|tesor|gemm|treasure|prezios/i,  "💎 Tesori"],
];
function invGroupOf(item) {
  const t = item?.type || "";
  for (const [re, label] of INV_TYPE_GROUPS) if (re.test(t)) return label;
  if (t) return "📦 " + t.charAt(0).toUpperCase() + t.slice(1);
  return "📦 Altro";
}
const INV_GROUP_ORDER = ["⚔ Armi", "🏹 Munizioni", "🛡 Equipaggiamento", "🧪 Consumabili", "🛠 Strumenti", "💎 Tesori"];

function cleanText(s) {
  if (!s) return "Nessuna descrizione.";
  return String(s)
    .replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/@\w+\[([^\]|]+)(?:\|[^\]]*)?\]/g, "$1")
    .replace(/&Reference\[(?:[^\]=]*=)?([^\]{}]+)\]/gi, "$1")
    .replace(/\{([^}]*)\}/g, "$1").replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/\s+/g, " ").trim() || "Nessuna descrizione.";
}

// Legge una caratteristica sia dal formato nuovo {score,mod,save} che dal vecchio (numero = mod)
function readAbility(stats, key) {
  const a = stats?.[key];
  if (a == null) return null;
  if (typeof a === "object") return { score: a.score, mod: a.mod ?? 0, save: a.save ?? a.mod ?? 0 };
  return { score: null, mod: a, save: a };
}

export default function SchedaPG() {
  const { currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("profilo");
  const [imgOk, setImgOk] = useState(true);
  const [query, setQuery] = useState("");

  // Lettura UNA volta all'apertura
  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "characters", currentUser.uid));
        if (snap.exists()) setData(snap.data());
      } catch (e) {
        console.error("Errore lettura scheda:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser]);

  // Tiro di dado — stessa logica della tua scheda, scrive su "rolls"
  async function handleRoll(action) {
    if (!data || !action) return;
    const d20 = Math.floor(Math.random() * 20) + 1;
    const bonusToHit = parseInt(action.bonus?.replace(/[^0-9+-]/g, "")) || 0;
    const hitTotal = d20 + bonusToHit;
    const isCritical = d20 === 20;
    let finalDamage = 0;
    const details = [];
    const parts = (action.damage && action.damage !== "0" ? action.damage : "1d4").split("+").map(p => p.trim());
    parts.forEach(part => {
      if (part.includes("d")) {
        const [num, sides] = part.split("d").map(n => parseInt(n) || 1);
        let tot = 0; const rolls = [];
        for (let i = 0; i < num; i++) { const r = Math.floor(Math.random() * sides) + 1; tot += r; rolls.push(r); }
        finalDamage += tot; details.push(`${num}d${sides}(${rolls.join("+")})`);
      } else {
        const b = parseInt(part) || 0; finalDamage += b; if (b !== 0) details.push(`+${b}`);
      }
    });
    if (isCritical) finalDamage *= 2;
    try {
      await addDoc(collection(db, "rolls"), {
        characterName: data.name, itemName: action.name, toHit: hitTotal,
        damageDealt: finalDamage, diceResults: details.join(" "),
        timestamp: serverTimestamp(), uid: currentUser.uid
      });
    } catch (err) { console.error(err); }
  }

  if (loading) return <div className="spg-page"><style>{CSS}</style><div className="spg-loading">Caricamento scheda…</div></div>;
  if (!currentUser) return <div className="spg-page"><style>{CSS}</style><div className="spg-empty">Accedi per vedere la tua scheda.</div></div>;
  if (!data) return (
    <div className="spg-page"><style>{CSS}</style>
      <div className="spg-empty">
        Nessuna scheda trovata.<br />Chiedi al Master di sincronizzarla da Foundry.
      </div>
    </div>
  );

  const s = data.stats || {};
  const hpPct = s.maxHp ? Math.max(0, Math.min(100, Math.round((s.hp / s.maxHp) * 100))) : 0;
  const abilityKeys = ["str", "dex", "con", "int", "wis", "cha"];
  const actions = data.actions || [];
  const weapons = actions.filter(a => a.category === "Armi");
  const abilities = actions.filter(a => a.category === "Abilità" || a.category === "Feat" || a.category === "Azione");
  const cantrips = actions.filter(a => a.category === "Trucchetto");
  const leveled = actions.filter(a => /livello/i.test(a.category || ""));
  const levels = [...new Set(leveled.map(a => a.category))]
    .sort((a, b) => (parseInt(a.replace(/\D/g, "")) || 0) - (parseInt(b.replace(/\D/g, "")) || 0));
  const skills = data.skills || [];
  const slots = data.spellSlots || [];
  const cur = data.currency || {};
  const inv = data.inventory || [];
  const initial = (data.name || "?").trim().charAt(0).toUpperCase();
  const keyStats = keyStatsFor(data.class);

  // ── RICERCA GLOBALE: azioni, incantesimi e zaino ──
  const q = query.trim().toLowerCase();
  const matches = (txt) => (txt || "").toLowerCase().includes(q);
  const foundActions = q ? weapons.concat(abilities).filter(a => matches(a.name) || matches(a.category)) : [];
  const foundSpells  = q ? cantrips.concat(leveled).filter(a => matches(a.name) || matches(a.category)) : [];
  const foundItems   = q ? inv.filter(i => matches(i.name) || matches(i.type)) : [];

  const ActionCard = ({ a, hideRoll = false, accent = null }) => {
    const hasRoll = !hideRoll && ((a.damage && a.damage !== "0") || (a.bonus && a.bonus !== "0"));
    return (
      <details className="spg-card" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
        <summary>
          <span className="cn">{a.name}</span>
          {a.damage && a.damage !== "0" && <span className="spg-badge dmg">{a.damage}</span>}
          {a.bonus && a.bonus !== "0" && <span className="spg-badge hit">{a.bonus}</span>}
          <span className="spg-chev">›</span>
        </summary>
        <div className="spg-body">
          {cleanText(a.description)}
          {hasRoll && (
            <button className="spg-roll" onClick={() => handleRoll(a)}>🎲 Tira {a.name}</button>
          )}
        </div>
      </details>
    );
  };

  // accentFor: colora la card della spell in base al suo livello
  const accentFor = (a) => {
    const lv = spellLevelOf(a.category);
    return lv == null ? null : levelColor(lv);
  };

  const Group = ({ title, list, hideRoll = false, accent = null, spellAccents = false }) => (!list.length ? null : (
    <>
      <div className="spg-sec" style={accent ? { color: accent } : undefined}>{title}</div>
      <div className="spg-cards">
        {list.map((a, i) => (
          <ActionCard key={i} a={a} hideRoll={hideRoll} accent={spellAccents ? accentFor(a) : accent} />
        ))}
      </div>
    </>
  ));

  const InvRow = (i, idx) => (
    <div key={idx} className="spg-inv">
      <span className="qty">×{i.quantity ?? 1}</span>
      <div className="in">
        <div className="nm">{i.name}</div>
        <div className="mt">{[i.weight ? `${i.weight} kg` : null, i.type].filter(Boolean).join(" · ")}</div>
      </div>
      {i.equipped && <span className="eq">Eq.</span>}
    </div>
  );

  return (
    <div className="spg-page">
      <style>{CSS}</style>
      <div className="spg-wrap">

        {/* HERO */}
        <div className="spg-hero">
          <div className="spg-portrait">
            {data.image && imgOk
              ? <img src={data.image} alt={data.name} onError={() => setImgOk(false)} />
              : initial}
          </div>
          <div>
            <p className="spg-eyebrow">Livello {data.level || 1}{data.race ? ` · ${data.race}` : ""}</p>
            <h1 className="spg-name">{data.name}</h1>
            <p className="spg-sub">{data.class}{data.subclass ? ` — ${data.subclass}` : ""}</p>
          </div>
        </div>

        {/* VITALS */}
        <div className="spg-vitals">
          <div>
            <div className="spg-hptop">
              <span className="spg-hplabel">Punti Ferita</span>
              <span className="spg-hpval"><b>{s.hp ?? "—"}</b> / {s.maxHp ?? "—"}{s.tempHp ? ` (+${s.tempHp})` : ""}</span>
            </div>
            <div className="spg-hpbar"><div className="spg-hpfill" style={{ width: `${hpPct}%` }} /></div>
          </div>
          <div className="spg-ac"><span className="n">{s.ac ?? "—"}</span><span className="l">CA</span></div>
        </div>

        {/* RIBBON */}
        <div className="spg-ribbon">
          <div className="spg-chip"><div className="n">{s.initiative != null ? sign(s.initiative) : "—"}</div><div className="l">Iniz.</div></div>
          <div className="spg-chip"><div className="n">{s.speed ?? "—"}</div><div className="l">Velocità</div></div>
          <div className="spg-chip"><div className="n">{s.prof != null ? sign(s.prof) : "—"}</div><div className="l">Compet.</div></div>
          <div className="spg-chip"><div className="n">{s.spellDc || "—"}</div><div className="l">CD Inc.</div></div>
        </div>

        {/* RICERCA */}
        <div className="spg-search">
          <span className="ico">🔎</span>
          <input
            type="text"
            placeholder="Cerca oggetti, incantesimi, azioni…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && <button className="clr" onClick={() => setQuery("")} aria-label="Pulisci ricerca">✕</button>}
        </div>

        {/* RISULTATI RICERCA — sostituiscono i pannelli finché si cerca */}
        {q ? (
          <div className="spg-panel" key="search">
            {(foundActions.length || foundSpells.length || foundItems.length) ? (
              <>
                <Group title={`Azioni (${foundActions.length})`} list={foundActions}
                  hideRoll={false} spellAccents={false} />
                <Group title={`Incantesimi (${foundSpells.length})`} list={foundSpells} spellAccents />
                {foundItems.length > 0 && (
                  <>
                    <div className="spg-sec">Zaino ({foundItems.length})</div>
                    <div className="spg-invgrid">{foundItems.map(InvRow)}</div>
                  </>
                )}
              </>
            ) : <div className="spg-hint">Nessun risultato per “{query}”.</div>}
          </div>
        ) : (
          <>
            {/* TABS */}
            <div className="spg-tabs">
              {[["profilo", "Profilo"], ["azioni", "Azioni"], ["magie", "Magie"], ["zaino", "Zaino"]].map(([id, label]) => (
                <div key={id} className={"spg-tab" + (tab === id ? " on" : "")}
                  onClick={() => { setTab(id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  {label}
                </div>
              ))}
            </div>

            {/* PANELS */}
            {tab === "profilo" && (
              <div className="spg-panel" key="profilo">
                <div className="spg-sec">Caratteristiche</div>
                <div className="spg-runes">
                  {abilityKeys.map(k => {
                    const a = readAbility(s, k);
                    if (!a) return null;
                    const prof = a.save !== a.mod;
                    const isKey = keyStats.includes(k);
                    return (
                      <div key={k} className={"spg-rune" + (prof ? " prof" : "") + (isKey ? " keystat" : "")}>
                        {isKey && <span className="keytag">⭐</span>}
                        <div className="ab">{AB_LABELS[k]}</div>
                        <div className={"mod" + (a.mod < 0 ? " neg" : "")}>{sign(a.mod)}</div>
                        {a.score != null && <div className="score">{a.score}</div>}
                        <div className="save"><span className="dot" />TS {sign(a.save)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="spg-sec">Abilità</div>
                {skills.length ? (
                  <div className="spg-skills">
                    {skills.map((x, i) => (
                      <div key={i} className={"spg-skill" + (x.proficient ? " prof" : "")}>
                        <span className="pip" /><span className="sn">{x.name}</span><span className="sm">{sign(x.mod)}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="spg-hint">Sincronizza la scheda da Foundry per vedere le abilità.</div>}
              </div>
            )}

            {tab === "azioni" && (
              <div className="spg-panel" key="azioni">
                {(weapons.length || abilities.length) ? (
                  <>
                    {/* Armi: niente tasto "Tira" (richiesta 2026-06-12) */}
                    <Group title="Armi" list={weapons} hideRoll />
                    <Group title="Abilità & Tratti" list={abilities} />
                  </>
                ) : <div className="spg-hint">Nessuna azione. Sincronizza la scheda da Foundry.</div>}
              </div>
            )}

            {tab === "magie" && (
              <div className="spg-panel" key="magie">
                {slots.length > 0 && (
                  <>
                    <div className="spg-sec">Slot Incantesimo</div>
                    <div className="spg-slots">
                      {slots.map((sl, i) => (
                        <div key={i} className="spg-slot">
                          <span className="sl">{sl.label}</span>
                          <div className="spg-pips">
                            {Array.from({ length: sl.max }).map((_, j) => (
                              <span key={j} className={"p" + (j < sl.value ? " on" : "")} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {(cantrips.length || leveled.length) ? (
                  <>
                    <Group title="Trucchetti" list={cantrips} accent={levelColor(0)} spellAccents />
                    {levels.map(lv => (
                      <Group key={lv} title={lv} list={leveled.filter(a => a.category === lv)}
                        accent={levelColor(spellLevelOf(lv) ?? 0)} spellAccents />
                    ))}
                  </>
                ) : <div className="spg-hint">Nessun incantesimo. Sincronizza la scheda da Foundry.</div>}
              </div>
            )}

            {tab === "zaino" && (
              <div className="spg-panel" key="zaino">
                <div className="spg-coins">
                  {["pp", "gp", "ep", "sp", "cp"].map(k => (
                    <div key={k} className={"spg-coin " + k}>
                      <div className="cv">{cur[k] ?? 0}</div><div className="cl">{k.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
                {inv.length ? (() => {
                  const loose = inv.filter(i => !i.container && !i.isContainer);
                  const containers = inv.filter(i => i.isContainer);
                  // Raggruppa gli oggetti sciolti per tipologia
                  const groups = {};
                  loose.forEach(i => {
                    const g = invGroupOf(i);
                    (groups[g] = groups[g] || []).push(i);
                  });
                  const ordered = [
                    ...INV_GROUP_ORDER.filter(g => groups[g]),
                    ...Object.keys(groups).filter(g => !INV_GROUP_ORDER.includes(g)).sort(),
                  ];
                  return (
                    <>
                      {ordered.map(g => (
                        <React.Fragment key={g}>
                          <div className="spg-sec">{g} ({groups[g].length})</div>
                          <div className="spg-invgrid">{groups[g].map(InvRow)}</div>
                        </React.Fragment>
                      ))}
                      {containers.map((c, ci) => {
                        const inside = inv.filter(i => i.container && i.container.toLowerCase() === c.name.toLowerCase());
                        return (
                          <React.Fragment key={ci}>
                            <div className="spg-bag">🎒 {c.name}</div>
                            <div className="spg-invgrid">
                              {inside.length ? inside.map(InvRow)
                                : <div className="spg-inv"><div className="in"><div className="mt">Vuoto</div></div></div>}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </>
                  );
                })() : <div className="spg-hint">Inventario vuoto. Sincronizza la scheda da Foundry.</div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
