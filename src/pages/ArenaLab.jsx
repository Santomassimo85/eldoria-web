// ─────────────────────────────────────────────────────────────────────────────
// ARENA · LABORATORIO (/arena-lab) — MOCKUP della "Vista Palco" (2026-11-02)
// Un combattimento dell'Arena impaginato come la lotta dei pet: tu in primo piano
// in basso a sinistra (guardi a destra), l'avversario lontano in alto a destra
// (guarda te). Menu a sezioni (Attacchi · Magie · Abilità · Oggetti · Passive ·
// Info) che si apre dal fondo del campo e non lo copre mai tutto.
// NON tocca l'Arena vera: niente letture/scritture di match, tutto in locale con
// regole semplificate e dati finti. Legge solo sprite/ritratti dei PG e lo
// sfondo dell'Arena per far vedere com'è con la grafica vera. Solo il Master.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import { isHiddenChar } from "../data/hiddenPlayers";
import { showD20Roll, preloadDice3D } from "../components/DiceRoll";
import { VfxLayer } from "./WorldBossVfx";
import "./ArenaLab.css";

/* ── Dadi ─────────────────────────────────────────────────────────────────── */
const d = (n) => 1 + Math.floor(Math.random() * n);
// "1d8+4+1d8", "2d8+4d6", "1d6-1": ogni pezzo NdM (raddoppiato col critico) o numero
function rollExpr(expr, crit = false) {
  const toks = String(expr).replace(/\s/g, "").match(/[+-]?[^+-]+/g) || ["0"];
  let total = 0;
  const shown = toks.map((t) => {
    const neg = t.startsWith("-");
    const body = t.replace(/^[+-]/, "");
    const m = /^(\d+)d(\d+)$/.exec(body);
    if (!m) { total += (neg ? -1 : 1) * Number(body || 0); return t; }
    const n = Number(m[1]) * (crit ? 2 : 1);
    for (let i = 0; i < n; i++) total += (neg ? -1 : 1) * d(Number(m[2]));
    return `${neg ? "-" : t.startsWith("+") ? "+" : ""}${n}d${m[2]}`;
  });
  total = Math.max(0, total);
  return { total, text: `${shown.join(" ").replace(/ \+/g, " + ").replace(/ -/g, " − ")} = ${total}` };
}
const modOf = (score) => Math.floor((score - 10) / 2);
const sgn = (n) => (n >= 0 ? `+${n}` : `${n}`);

/* ── Classi di prova (dati finti, regole semplificate) ────────────────────── */
// tab: atk | spell | skill | item | passive
// kind: hit (tiro per colpire) · save (TS del bersaglio) · auto (colpisce sempre)
//       heal · ac (CA in più per N turni) · adv (vantaggio al prossimo colpo)
//       extra (+1 azione) · slot (recupera uno slot) · move (distanza)
const ITEMS = [
  { id: "pozione", tab: "item", icon: "🧪", name: "Pozione di Guarigione", kind: "heal", dice: "2d4+2", bonus: true, qty: 2, desc: "Azione bonus. Recuperi 2d4 + 2 PF." },
  { id: "pozione_sup", tab: "item", icon: "⚗️", name: "Pozione Superiore", kind: "heal", dice: "4d4+4", qty: 1, desc: "Recuperi 4d4 + 4 PF." },
  { id: "olio", tab: "item", icon: "🔥", name: "Olio Incendiario", kind: "hit", toHit: 5, dice: "2d6", dmg: "fuoco", el: "fire", fx: "arrow", qty: 1, onHit: { st: "burn", turns: 2 }, ranged: true, desc: "Lo lanci: 2d6 fuoco e il bersaglio brucia per 2 turni (1d4 a turno)." },
  { id: "bomba", tab: "item", icon: "💥", name: "Bomba di Luce", kind: "save", save: ["COS", 13], dice: "1d6", dmg: "radioso", el: "radiant", fx: "aoe", qty: 1, onFail: { st: "blind", turns: 2 }, desc: "TS COS CD 13: se fallisce è accecato 2 turni (svantaggio ai suoi attacchi)." },
  { id: "pergamena", tab: "item", icon: "📜", name: "Pergamena: Scudo della Fede", kind: "ac", v: 2, turns: 3, bonus: true, qty: 1, desc: "Azione bonus. +2 CA per 3 turni." },
];

const CLASSES = {
  guerriero: {
    label: "Guerriero", icon: "⚔️", lv: 7, hp: 64, ac: 18, prof: 3, speed: 9, actions: 2,
    stats: { FOR: 18, DES: 13, COS: 16, INT: 9, SAG: 12, CAR: 10 }, saves: ["FOR", "COS"],
    res: [], crit: 19,
    moves: [
      { id: "spada", tab: "atk", icon: "🗡️", name: "Spada Lunga", kind: "hit", toHit: 7, dice: "1d8+4", dmg: "tagliente", el: "physical", fx: "slash", desc: "Arma in mischia, versatile." },
      { id: "ascia", tab: "atk", icon: "🪓", name: "Ascia da Lancio", kind: "hit", toHit: 7, dice: "1d6+4", dmg: "tagliente", el: "physical", fx: "arrow", ranged: true, desc: "Arma da lancio: si usa anche a distanza." },
      { id: "arco", tab: "atk", icon: "🏹", name: "Arco Lungo", kind: "hit", toHit: 4, dice: "1d8+1", dmg: "perforante", el: "physical", fx: "arrow", ranged: true, desc: "Arma a distanza." },
      { id: "poderoso", tab: "skill", icon: "💪", name: "Attacco Poderoso", kind: "hit", toHit: 2, dice: "1d8+14", dmg: "tagliente", el: "physical", fx: "slash", uses: 2, desc: "−5 al tiro per colpire, +10 ai danni." },
      { id: "sbilanciante", tab: "skill", icon: "🌀", name: "Colpo Sbilanciante", kind: "hit", toHit: 7, dice: "1d8+4+1d8", dmg: "contundente", el: "physical", fx: "slash", uses: 3, onHit: { st: "stun", turns: 1 }, desc: "Manovra: +1d8 danni e il bersaglio perde il prossimo turno." },
      { id: "vento", tab: "skill", icon: "💨", name: "Secondo Vento", kind: "heal", dice: "1d10+7", bonus: true, uses: 1, desc: "Azione bonus. Recuperi 1d10 + livello PF." },
      { id: "impeto", tab: "skill", icon: "⚡", name: "Azione Impetuosa", kind: "extra", bonus: true, uses: 1, desc: "Azione bonus. Ottieni un'azione in più in questo turno." },
      { id: "p_difesa", tab: "passive", icon: "🛡️", name: "Stile: Difesa", desc: "+1 alla CA con l'armatura (già contato)." },
      { id: "p_extra", tab: "passive", icon: "⚔️", name: "Attacco Extra", desc: "Due azioni d'attacco per turno." },
      { id: "p_critico", tab: "passive", icon: "🎯", name: "Critico Migliorato", desc: "Critico con 19 o 20 naturale." },
    ],
  },
  mago: {
    label: "Mago", icon: "🔮", lv: 7, hp: 44, ac: 13, prof: 3, speed: 9, actions: 1,
    stats: { FOR: 8, DES: 14, COS: 14, INT: 18, SAG: 12, CAR: 10 }, saves: ["INT", "SAG"],
    res: ["fuoco"], slots: { 1: 4, 2: 3, 3: 3, 4: 1 }, dc: 15,
    moves: [
      { id: "bastone", tab: "atk", icon: "🪄", name: "Bastone Ferrato", kind: "hit", toHit: 2, dice: "1d6-1", dmg: "contundente", el: "physical", fx: "slash", desc: "Quando la magia non basta." },
      { id: "dardo_fuoco", tab: "spell", lvl: 0, icon: "🔥", name: "Dardo di Fuoco", kind: "hit", toHit: 7, dice: "2d10", dmg: "fuoco", el: "fire", fx: "bolt", ranged: true, desc: "Trucchetto: tiro per colpire con incantesimo." },
      { id: "gelo", tab: "spell", lvl: 0, icon: "❄️", name: "Raggio di Gelo", kind: "hit", toHit: 7, dice: "2d8", dmg: "freddo", el: "frost", fx: "bolt", ranged: true, desc: "Trucchetto: freddo a distanza." },
      { id: "missile", tab: "spell", lvl: 1, icon: "✨", name: "Dardo Incantato", kind: "auto", dice: "3d4+3", dmg: "forza", el: "arcane", fx: "bolt", ranged: true, desc: "Colpisce sempre." },
      { id: "scudo", tab: "spell", lvl: 1, icon: "🛡️", name: "Scudo", kind: "ac", v: 5, turns: 1, bonus: true, desc: "Azione bonus (in Arena). +5 CA fino al tuo prossimo turno." },
      { id: "blocca", tab: "spell", lvl: 2, icon: "⛓️", name: "Blocca Persone", kind: "save", save: ["SAG", 15], dice: "0", el: "arcane", fx: "debuff", onFail: { st: "stun", turns: 2 }, desc: "TS SAG: se fallisce perde 2 turni." },
      { id: "fireball", tab: "spell", lvl: 3, icon: "☄️", name: "Palla di Fuoco", kind: "save", save: ["DES", 15], dice: "8d6", half: true, dmg: "fuoco", el: "fire", fx: "aoe", desc: "TS DES: 8d6 fuoco, metà se lo supera." },
      { id: "fulmine", tab: "spell", lvl: 3, icon: "⚡", name: "Fulmine", kind: "save", save: ["DES", 15], dice: "8d6", half: true, dmg: "fulmine", el: "lightning", fx: "bolt", desc: "TS DES: 8d6 fulmine, metà se lo supera." },
      { id: "tempesta", tab: "spell", lvl: 4, icon: "🧊", name: "Tempesta di Ghiaccio", kind: "save", save: ["DES", 15], dice: "2d8+4d6", half: true, dmg: "freddo", el: "frost", fx: "aoe", desc: "TS DES: 2d8 contundenti + 4d6 freddo." },
      { id: "recupero", tab: "skill", icon: "📖", name: "Recupero Arcano", kind: "slot", bonus: true, uses: 1, desc: "Azione bonus. Recuperi uno slot di 1° livello." },
      { id: "p_scultore", tab: "passive", icon: "🗿", name: "Scultore di Incantesimi", desc: "Le tue aree non colpiscono gli alleati." },
      { id: "p_resist", tab: "passive", icon: "🔥", name: "Anello di Resistenza", desc: "Resistenza al fuoco (danni dimezzati)." },
    ],
  },
  ladra: {
    label: "Ladra", icon: "🗝️", lv: 7, hp: 50, ac: 16, prof: 3, speed: 9, actions: 1,
    stats: { FOR: 10, DES: 18, COS: 14, INT: 12, SAG: 13, CAR: 14 }, saves: ["DES", "INT"],
    res: [],
    moves: [
      { id: "stocco", tab: "atk", icon: "🗡️", name: "Stocco", kind: "hit", toHit: 7, dice: "1d8+4", sneak: "4d6", dmg: "perforante", el: "physical", fx: "slash", desc: "Accurata: con vantaggio aggiunge l'Attacco Furtivo (4d6)." },
      { id: "balestra", tab: "atk", icon: "🏹", name: "Balestra a Mano", kind: "hit", toHit: 7, dice: "1d6+4", sneak: "4d6", dmg: "perforante", el: "physical", fx: "arrow", ranged: true, desc: "A distanza, anche lei col Furtivo." },
      { id: "pugnale_v", tab: "atk", icon: "🧪", name: "Pugnale Avvelenato", kind: "hit", toHit: 7, dice: "1d4+4", dmg: "veleno", el: "poison", fx: "slash", uses: 2, onHit: { st: "poison", turns: 3 }, desc: "Avvelena: 1d4 a turno per 3 turni." },
      { id: "scaltra", tab: "skill", icon: "👣", name: "Azione Scaltra: Nascondersi", kind: "adv", bonus: true, desc: "Azione bonus. Vantaggio al prossimo attacco (quindi Furtivo)." },
      { id: "schivata", tab: "skill", icon: "🌫️", name: "Schivata Prodigiosa", kind: "ac", v: 3, turns: 1, uses: 2, bonus: true, desc: "Azione bonus (in Arena). +3 CA fino al tuo prossimo turno." },
      { id: "p_furtivo", tab: "passive", icon: "🗡️", name: "Attacco Furtivo", desc: "4d6 in più una volta per turno, con vantaggio." },
      { id: "p_elusione", tab: "passive", icon: "💨", name: "Elusione", desc: "TS DES riuscito = nessun danno invece di metà." },
    ],
  },
};
const MOVE_ACTIONS = [
  { id: "avvicina", tab: "atk", icon: "🏃", name: "Avvicinati", kind: "move", to: true, desc: "Chiudi la distanza senza attaccare." },
  { id: "arretra", tab: "atk", icon: "↩️", name: "Arretra", kind: "move", to: false, bonus: true, desc: "Azione bonus. Riapri la distanza." },
];

const STATUS = {
  burn: { icon: "🔥", label: "Brucia", good: false, info: "1d4 fuoco a inizio turno" },
  poison: { icon: "☠️", label: "Avvelenato", good: false, info: "1d4 veleno a inizio turno" },
  stun: { icon: "💫", label: "Stordito", good: false, info: "Salta il turno" },
  blind: { icon: "🙈", label: "Accecato", good: false, info: "Svantaggio agli attacchi" },
  ac: { icon: "🛡️", label: "CA +", good: true, info: "CA in più" },
  adv: { icon: "👁️", label: "Vantaggio", good: true, info: "Al prossimo attacco" },
};

const TABS = [
  { k: "atk", icon: "⚔️", label: "Attacchi" },
  { k: "spell", icon: "✨", label: "Magie" },
  { k: "skill", icon: "🎯", label: "Abilità" },
  { k: "item", icon: "🎒", label: "Oggetti" },
  { k: "passive", icon: "🛡️", label: "Passive" },
  { k: "info", icon: "ℹ️", label: "Info" },
];
const ABIL = ["FOR", "DES", "COS", "INT", "SAG", "CAR"];
const TURN_SECONDS = 300;

function makeFighter(cls, who) {
  const c = CLASSES[cls];
  const uses = {};
  c.moves.forEach((m) => { if (m.uses) uses[m.id] = m.uses; });
  const items = {};
  ITEMS.forEach((it) => { items[it.id] = it.qty; });
  return { cls, name: who?.name || c.label, hp: c.hp, maxHp: c.hp, slots: { ...(c.slots || {}) }, uses, items, st: [] };
}
const acOf = (f) => CLASSES[f.cls].ac + f.st.filter((s) => s.k === "ac").reduce((a, s) => a + s.v, 0);
const has = (f, k) => f.st.some((s) => s.k === k);
const saveMod = (f, ab) => { const c = CLASSES[f.cls]; return modOf(c.stats[ab]) + (c.saves.includes(ab) ? c.prof : 0); };

/* metadati del tasto: tiro, danno, usi */
function moveMeta(m, f, foe, close) {
  let roll = "";
  if (m.kind === "hit") roll = `🎯 d20 ${sgn(m.toHit)} vs CA ${acOf(foe)}`;
  else if (m.kind === "save") roll = `TS ${m.save[0]} CD ${m.save[1]}`;
  else if (m.kind === "auto") roll = "colpisce sempre";
  else if (m.kind === "heal") roll = `💚 ${m.dice}`;
  else if (m.kind === "ac") roll = `🛡 +${m.v} CA · ${m.turns}t`;
  else if (m.kind === "adv") roll = "👁 vantaggio";
  else if (m.kind === "extra") roll = "+1 azione";
  else if (m.kind === "slot") roll = "+1 slot 1°";
  else if (m.kind === "move") roll = m.to ? "→ in mischia" : "← a distanza";
  const dmg = ["hit", "save", "auto"].includes(m.kind) && m.dice !== "0" ? `${m.dice}${m.sneak ? ` (+${m.sneak})` : ""}${m.dmg ? ` ${m.dmg}` : ""}` : "";
  let left = null, max = null;
  if (m.uses) { left = f.uses[m.id]; max = m.uses; }
  if (m.tab === "item") { left = f.items[m.id]; max = m.qty; }
  if (m.lvl >= 1) { left = f.slots[m.lvl] ?? 0; max = CLASSES[f.cls].slots?.[m.lvl] ?? 0; }
  const melee = m.tab === "atk" && m.kind === "hit" && !m.ranged;
  const charge = melee && !close;
  return { roll, dmg, left, max, charge };
}

/* ── Componente ───────────────────────────────────────────────────────────── */
export default function ArenaLab() {
  const { currentUser } = useAuth();
  // in sviluppo si apre anche senza login, per provarlo in locale
  const master = isMainMaster(currentUser?.email) || import.meta.env.DEV;
  const [chars, setChars] = useState([]);
  const [bg, setBg] = useState(null);
  const [meId, setMeId] = useState("");
  const [foeId, setFoeId] = useState("");
  const [meCls, setMeCls] = useState("guerriero");
  const [foeCls, setFoeCls] = useState("mago");

  useEffect(() => {
    if (!master) return;
    preloadDice3D();
    getDoc(doc(db, "arena_meta", "global")).then((s) => setBg(s.data()?.battleBg || null)).catch(() => {});
    getDocs(collection(db, "characters")).then((snap) => {
      const list = snap.docs.map((x) => ({ id: x.id, ...x.data() }))
        .filter((c) => c.name && !isHiddenChar(c))
        .map((c) => ({ id: c.id, name: c.name, sprite: c.spriteUrl || "", dead: c.deadSpriteUrl || "", image: c.image || "" }))
        .sort((a, b) => (!!b.sprite - !!a.sprite) || a.name.localeCompare(b.name));
      setChars(list);
      const mine = list.find((c) => c.id === currentUser?.uid && c.sprite) || list[0];
      setMeId(mine?.id || "");
      setFoeId(list.find((c) => c.id !== mine?.id && c.sprite)?.id || list[1]?.id || "");
    }).catch(() => {});
  }, [master, currentUser?.uid]);

  const me = chars.find((c) => c.id === meId) || null;
  const foe = chars.find((c) => c.id === foeId) || null;

  if (!master) return <div className="al-page"><p className="al-note">Il laboratorio dell'Arena per ora lo vede solo il Master.</p></div>;
  return (
    <div className="al-page">
      <header className="al-head">
        <div>
          <span className="al-eyebrow">Arena · Laboratorio</span>
          <h1>Vista Palco <small>mockup</small></h1>
        </div>
        <p className="al-note">Prova grafica: regole semplificate e dati finti, non si salva niente e l'Arena vera non cambia.</p>
      </header>
      <Battle key={`${meId}|${foeId}|${meCls}|${foeCls}`} me={me} foe={foe} meCls={meCls} foeCls={foeCls} bg={bg} uid={currentUser?.uid || "dev"} />
      <details className="al-setup">
        <summary>⚙ Prova con altri PG o altre classi</summary>
        <div className="al-setup-grid">
          <label>Tu <select value={meId} onChange={(e) => setMeId(e.target.value)}>{chars.map((c) => <option key={c.id} value={c.id}>{c.name}{c.sprite ? "" : " (senza sprite)"}</option>)}</select></label>
          <label>Classe <select value={meCls} onChange={(e) => setMeCls(e.target.value)}>{Object.entries(CLASSES).map(([k, c]) => <option key={k} value={k}>{c.icon} {c.label}</option>)}</select></label>
          <label>Avversario <select value={foeId} onChange={(e) => setFoeId(e.target.value)}>{chars.map((c) => <option key={c.id} value={c.id}>{c.name}{c.sprite ? "" : " (senza sprite)"}</option>)}</select></label>
          <label>Classe <select value={foeCls} onChange={(e) => setFoeCls(e.target.value)}>{Object.entries(CLASSES).map(([k, c]) => <option key={k} value={k}>{c.icon} {c.label}</option>)}</select></label>
        </div>
        <p className="al-note">Gli sprite sono quelli di DM Admin → Sprite Personaggi (disegnati rivolti a sinistra: il tuo qui viene specchiato). Chi non ha lo sprite usa il ritratto.</p>
      </details>
    </div>
  );
}

function Battle({ me, foe, meCls, foeCls, bg, uid }) {
  const [st, setSt] = useState(() => ({
    p: makeFighter(meCls, me), e: makeFighter(foeCls, foe),
    turn: "p", round: 1, actions: CLASSES[meCls].actions, bonus: 1, close: false, busy: false, over: null, sneakUsed: false,
  }));
  const ref = useRef(st);
  const set = useCallback((fn) => { ref.current = typeof fn === "function" ? fn(ref.current) : fn; setSt(ref.current); }, []);
  const [tab, setTab] = useState(null);
  const [infoWho, setInfoWho] = useState("p");
  const [openDesc, setOpenDesc] = useState(null);
  const [line, setLine] = useState({ id: 0, text: "Il combattimento comincia: tocca a te!" });
  const [log, setLog] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [floats, setFloats] = useState([]);
  const [shake, setShake] = useState(null);
  const [secs, setSecs] = useState(TURN_SECONDS);

  // nomi aggiornati quando arrivano i PG (il primo render può essere senza)
  useEffect(() => { set((s) => ({ ...s, p: { ...s.p, name: me?.name || s.p.name }, e: { ...s.e, name: foe?.name || s.e.name } })); }, [me?.name, foe?.name, set]);
  // timer del turno (solo da vedere)
  useEffect(() => { setSecs(TURN_SECONDS); }, [st.turn, st.round]);
  useEffect(() => { const t = setInterval(() => setSecs((x) => Math.max(0, x - 1)), 1000); return () => clearInterval(t); }, []);

  const say = useCallback((text, kind = "") => {
    setLine({ id: Date.now() + Math.random(), text, kind });
    setLog((l) => [{ id: Date.now() + Math.random(), text, kind }, ...l].slice(0, 80));
  }, []);
  const float = useCallback((side, text, kind) => {
    const id = Date.now() + Math.random();
    setFloats((f) => [...f, { id, side, text, kind }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1300);
  }, []);
  const vfx = useCallback((from, to, m, miss, kill) => {
    if (!m.fx) return;
    const id = `lab-${Date.now()}-${Math.random()}`;
    setMsgs((x) => [...x.slice(-12), { id, effect: m.fx, effectEl: m.el || "physical", effectTargets: [`lab-${to}`], effectFrom: `lab-${from}`, effectMissTargets: miss ? [`lab-${to}`] : [], effectKill: kill ? [`lab-${to}`] : [], timestamp: { toMillis: () => Date.now() } }]);
  }, []);
  const hurt = useCallback((side, amount, dmgType) => {
    const f = ref.current[side];
    const resisted = dmgType && CLASSES[f.cls].res.includes(dmgType);
    const n = resisted ? Math.floor(amount / 2) : amount;
    set((s) => ({ ...s, [side]: { ...s[side], hp: Math.max(0, s[side].hp - n) } }));
    if (n > 0) { float(side, `−${n}`, "dmg"); setShake(side); setTimeout(() => setShake(null), 420); }
    return { n, resisted };
  }, [float, set]);
  const addSt = useCallback((side, k, turns, v) => set((s) => ({ ...s, [side]: { ...s[side], st: [...s[side].st.filter((x) => x.k !== k || k === "ac"), { k, turns, v }] } })), [set]);

  /* risolve una mossa di chi (p/e) */
  const resolve = useCallback(async (who, m) => {
    const foeSide = who === "p" ? "e" : "p";
    const s0 = ref.current;
    const me0 = s0[who], foe0 = s0[foeSide];
    const nm = me0.name, fn = foe0.name;
    // consumi
    set((s) => {
      const f = { ...s[who], uses: { ...s[who].uses }, items: { ...s[who].items }, slots: { ...s[who].slots } };
      if (m.uses) f.uses[m.id] -= 1;
      if (m.tab === "item") f.items[m.id] -= 1;
      if (m.lvl >= 1) f.slots[m.lvl] -= 1;
      return { ...s, [who]: f, ...(m.bonus ? { bonus: 0 } : { actions: s.actions - 1 }) };
    });
    const skin = who === "e" ? "nemico" : undefined;
    const tag = who === "e" ? "🟥 " : "";

    if (m.kind === "move") {
      set((s) => ({ ...s, close: m.to }));
      say(m.to ? `${nm} si getta in avanti: ora siete in mischia.` : `${nm} arretra: ora siete a distanza.`);
      return;
    }
    if (m.kind === "heal") {
      const r = rollExpr(m.dice);
      const healed = Math.min(r.total, me0.maxHp - ref.current[who].hp);
      set((s) => ({ ...s, [who]: { ...s[who], hp: Math.min(s[who].maxHp, s[who].hp + r.total) } }));
      vfx(who, who, { fx: "heal", el: "radiant" });
      float(who, `+${healed}`, "heal");
      say(`${m.icon} ${nm} usa ${m.name}: 🎲 ${r.text} → +${healed} PF.`, "good");
      return;
    }
    if (m.kind === "ac") { addSt(who, "ac", m.turns, m.v); vfx(who, who, { fx: "shield", el: "arcane" }); float(who, `+${m.v} CA`, "buff"); say(`${m.icon} ${nm} usa ${m.name}: +${m.v} CA per ${m.turns} turn${m.turns > 1 ? "i" : "o"}.`, "good"); return; }
    if (m.kind === "adv") { addSt(who, "adv", 1); vfx(who, who, { fx: "buff", el: "darkness" }); say(`${m.icon} ${nm} sparisce nell'ombra: vantaggio al prossimo attacco.`, "good"); return; }
    if (m.kind === "extra") { set((s) => ({ ...s, actions: s.actions + 1 })); vfx(who, who, { fx: "buff", el: "lightning" }); say(`${m.icon} ${nm}: Azione Impetuosa, un'azione in più!`, "good"); return; }
    if (m.kind === "slot") { set((s) => ({ ...s, [who]: { ...s[who], slots: { ...s[who].slots, 1: Math.min(CLASSES[s[who].cls].slots[1], (s[who].slots[1] || 0) + 1) } } })); vfx(who, who, { fx: "buff", el: "arcane" }); say(`${m.icon} ${nm} recupera uno slot di 1° livello.`, "good"); return; }

    if (m.kind === "auto") {
      const r = rollExpr(m.dice);
      vfx(who, foeSide, m);
      const h = hurt(foeSide, r.total, m.dmg);
      say(`${m.icon} ${nm} lancia ${m.name}: colpisce sempre. 🎲 ${r.text}${h.resisted ? " · resiste (½)" : ""} → ${h.n} ${m.dmg}.`);
      return;
    }
    if (m.kind === "save") {
      const [ab, dc] = m.save;
      const dd = d(20), tot = dd + saveMod(foe0, ab), ok = tot >= dc;
      await showD20Roll(dd, { label: `${foeSide === "e" ? "🟥 " : ""}${fn} · TS ${ab} ${sgn(saveMod(foe0, ab))} vs CD ${dc}`, skin: foeSide === "e" ? "nemico" : undefined });
      vfx(who, foeSide, m, ok && !m.half && m.dice === "0");
      let txt = `${m.icon} ${nm} usa ${m.name}. ${fn}: TS ${ab} 🎲 ${dd} ${sgn(saveMod(foe0, ab))} = ${tot} vs CD ${dc} → ${ok ? "superato" : "fallito"}`;
      if (m.dice !== "0") {
        const r = rollExpr(m.dice);
        let dmg = r.total;
        if (ok) dmg = m.half ? Math.floor(dmg / 2) : 0;
        const h = hurt(foeSide, dmg, m.dmg);
        txt += `: 🎲 ${r.text} → ${h.n} ${m.dmg}${h.resisted ? " (resiste)" : ""}${ok && m.half ? " (metà)" : ""}.`;
      } else txt += ".";
      if (!ok && m.onFail) { addSt(foeSide, m.onFail.st, m.onFail.turns); txt += ` ${STATUS[m.onFail.st].icon} ${STATUS[m.onFail.st].label} per ${m.onFail.turns} turni.`; }
      say(txt, ok ? "miss" : "");
      return;
    }
    // hit
    const charge = m.tab !== "item" && !m.ranged && !s0.close;
    const adv = has(me0, "adv");
    const dis = has(me0, "blind") || charge;
    const a = d(20), b = d(20);
    const mode = adv && !dis ? "adv" : dis && !adv ? "dis" : null;
    const dd = mode === "adv" ? Math.max(a, b) : mode === "dis" ? Math.min(a, b) : a;
    const ac = acOf(foe0), tot = dd + m.toHit;
    const critAt = CLASSES[me0.cls].crit || 20;
    const crit = dd >= critAt, hit = dd !== 1 && (crit || tot >= ac);
    const label = `${tag}${nm} · ${m.name} · d20 ${sgn(m.toHit)} vs CA ${ac}${mode === "adv" ? " · vantaggio" : mode === "dis" ? " · svantaggio" : ""}`;
    const kept = dd === a ? 0 : 1;
    await showD20Roll(dd, { label, skin, ...(mode ? { dice: [{ value: a, dim: kept !== 0 }, { value: b, dim: kept !== 1 }] } : {}) });
    if (adv) set((s) => ({ ...s, [who]: { ...s[who], st: s[who].st.filter((x) => x.k !== "adv") } }));
    if (charge) set((s) => ({ ...s, close: true }));
    if (!hit) {
      vfx(who, foeSide, m, true);
      float(foeSide, "MANCATO", "miss");
      say(`${m.icon} ${nm} · ${m.name}: 🎲 ${dd} ${sgn(m.toHit)} = ${tot} vs CA ${ac} → ${dd === 1 ? "1 naturale, mancato!" : "mancato."}${charge ? " (carica: ora siete in mischia)" : ""}`, "miss");
      return;
    }
    const base = rollExpr(m.dice, crit);
    let dmg = base.total, sneakTxt = "";
    const doSneak = m.sneak && (mode === "adv") && !ref.current.sneakUsed;
    if (doSneak) { const sn = rollExpr(m.sneak, crit); dmg += sn.total; sneakTxt = ` + Furtivo ${sn.total}`; set((s) => ({ ...s, sneakUsed: true })); }
    const willKill = ref.current[foeSide].hp - dmg <= 0;
    vfx(who, foeSide, m, false, willKill);
    const h = hurt(foeSide, dmg, m.dmg);
    if (crit) float(foeSide, "CRITICO!", "crit");
    let txt = `${m.icon} ${nm} · ${m.name}: 🎲 ${dd} ${sgn(m.toHit)} = ${tot} vs CA ${ac} → ${crit ? "CRITICO! " : "colpito! "}🎲 ${base.text}${sneakTxt} → ${h.n} ${m.dmg}${h.resisted ? " (resiste)" : ""}.${charge ? " Carica: ora siete in mischia." : ""}`;
    if (m.onHit && ref.current[foeSide].hp > 0) { addSt(foeSide, m.onHit.st, m.onHit.turns); txt += ` ${STATUS[m.onHit.st].icon} ${STATUS[m.onHit.st].label} (${m.onHit.turns}t).`; }
    say(txt, crit ? "crit" : "");
  }, [addSt, float, hurt, say, set, vfx]);

  const checkOver = useCallback(() => {
    const s = ref.current;
    if (s.e.hp <= 0) { set((x) => ({ ...x, over: "win", busy: false })); say(`🏆 ${s.e.name} è a terra: vittoria!`, "crit"); return true; }
    if (s.p.hp <= 0) { set((x) => ({ ...x, over: "lose", busy: false })); say(`💀 ${s.p.name} cade: sconfitta.`, "miss"); return true; }
    return false;
  }, [say, set]);

  /* inizio turno: danni continui, stati che scadono, stordimento */
  const startTurn = useCallback(async (side) => {
    const f = ref.current[side];
    for (const k of ["burn", "poison"]) {
      if (has(f, k)) {
        const r = d(4);
        hurt(side, r, k === "burn" ? "fuoco" : "veleno");
        vfx(side, side, { fx: "hit", el: k === "burn" ? "fire" : "poison" });
        say(`${STATUS[k].icon} ${f.name} ${k === "burn" ? "brucia" : "soffre il veleno"}: −${r} PF.`);
        await wait(700);
      }
    }
    const stunned = has(ref.current[side], "stun");
    set((s) => ({ ...s, [side]: { ...s[side], st: s[side].st.map((x) => ({ ...x, turns: x.turns - (x.k === "adv" ? 0 : 1) })).filter((x) => x.turns > 0 || (x.k === "adv")) } }));
    return stunned;
  }, [hurt, say, set, vfx]);

  const enemyTurn = useCallback(async () => {
    set((s) => ({ ...s, turn: "e", busy: true, actions: CLASSES[s.e.cls].actions, bonus: 1, sneakUsed: false }));
    await wait(700);
    if (await startTurn("e")) { say(`💫 ${ref.current.e.name} è stordito e salta il turno.`); await wait(900); }
    else {
      if (checkOver()) return;
      // azione bonus utile
      const ef = ref.current.e, c = CLASSES[ef.cls];
      const pool = [...c.moves, ...ITEMS, ...MOVE_ACTIONS];
      const usable = (m) => m.tab !== "passive" && (!m.uses || ef.uses[m.id] > 0) && (m.tab !== "item" || ef.items[m.id] > 0) && (!(m.lvl >= 1) || (ef.slots[m.lvl] || 0) > 0);
      const bonusPick = pool.filter((m) => m.bonus && usable(m) && (m.kind === "heal" ? ef.hp < ef.maxHp * 0.45 : m.kind === "adv" ? true : m.kind === "ac" && !has(ef, "ac") && Math.random() < 0.35));
      if (bonusPick.length) { await resolve("e", bonusPick[0]); await wait(900); if (checkOver()) return; }
      while (ref.current.actions > 0 && !ref.current.over) {
        const e2 = ref.current.e;
        const usable2 = (m) => m.tab !== "passive" && !m.bonus && (!m.uses || e2.uses[m.id] > 0) && (m.tab !== "item" || e2.items[m.id] > 0) && (!(m.lvl >= 1) || (e2.slots[m.lvl] || 0) > 0);
        const atksAll = pool.filter((m) => usable2(m) && ["hit", "save", "auto"].includes(m.kind) && m.tab !== "item");
        // a distanza non carica in mischia se ha qualcosa che arriva da lontano
        const far = !ref.current.close;
        const reach = atksAll.filter((m) => !(m.kind === "hit" && !m.ranged));
        const atks = far && reach.length ? reach : atksAll;
        const strong = atks.filter((m) => m.lvl >= 2 || m.uses);
        const from = strong.length && Math.random() < 0.55 ? strong : atks;
        const pick = from[Math.floor(Math.random() * from.length)];
        if (!pick) break;
        await resolve("e", pick);
        await wait(1000);
        if (checkOver()) return;
      }
    }
    // torna a te
    set((s) => ({ ...s, turn: "p", round: s.round + 1, actions: CLASSES[s.p.cls].actions, bonus: 1, sneakUsed: false }));
    if (await startTurn("p")) {
      if (checkOver()) return;
      say(`💫 ${ref.current.p.name} è stordito: salti il turno.`);
      await wait(1100);
      return enemyTurn();
    }
    if (checkOver()) return;
    set((s) => ({ ...s, busy: false }));
    say(`Tocca a te, ${ref.current.p.name}.`);
  }, [checkOver, resolve, say, set, startTurn]);

  const play = async (m) => {
    const s = ref.current;
    if (s.busy || s.over || s.turn !== "p") return;
    set((x) => ({ ...x, busy: true }));
    setOpenDesc(null);
    if (window.matchMedia?.("(max-width: 760px)").matches) setTab(null); // sul telefono si richiude per vedere l'effetto
    await resolve("p", m);
    await wait(500);
    if (checkOver()) return;
    if (ref.current.actions <= 0) { await wait(500); return enemyTurn(); }
    set((x) => ({ ...x, busy: false }));
  };
  const endTurn = () => { if (!ref.current.busy && !ref.current.over && ref.current.turn === "p") enemyTurn(); };
  const restart = () => {
    set({ p: makeFighter(meCls, me), e: makeFighter(foeCls, foe), turn: "p", round: 1, actions: CLASSES[meCls].actions, bonus: 1, close: false, busy: false, over: null, sneakUsed: false });
    setLog([]); say("Si ricomincia: tocca a te!");
  };

  const P = st.p, E = st.e;
  const myCls = CLASSES[P.cls];
  const all = useMemo(() => [...myCls.moves, ...MOVE_ACTIONS, ...ITEMS], [myCls]);
  const byTab = (k) => all.filter((m) => m.tab === k);
  const myTurn = st.turn === "p" && !st.busy && !st.over;
  const canUse = (m, meta) => myTurn && (m.bonus ? st.bonus > 0 : st.actions > 0) && (meta.left == null || meta.left > 0)
    && !(m.kind === "move" && m.to === st.close) && !(m.kind === "heal" && P.hp >= P.maxHp);
  const toggleTab = (k) => { setTab((t) => (t === k ? null : k)); setOpenDesc(null); if (k === "info") setInfoWho("p"); };

  const renderMove = (m) => {
    const meta = moveMeta(m, P, E, st.close);
    const ok = canUse(m, meta);
    const el = m.el || (m.kind === "heal" ? "radiant" : m.kind === "move" ? "physical" : "arcane");
    return (
      <div key={m.id} className={`al-move el-${el}${meta.left === 0 ? " is-spent" : ""}`}>
        <button type="button" className="al-move-main" disabled={!ok} onClick={() => play(m)} aria-label={`${m.name}: ${meta.roll}${meta.dmg ? `, ${meta.dmg}` : ""}`}>
          <span className="al-move-top">
            <span className="al-move-icon" aria-hidden="true">{m.icon}</span>
            <b>{m.name}</b>
            {meta.left != null && <span className="al-uses">{meta.left}/{meta.max}</span>}
          </span>
          <small><span>{meta.roll}</span>{meta.dmg && <span>{meta.dmg}</span>}</small>
          <span className="al-tags">
            {m.bonus && <i className="al-tag al-tag--bonus">⚡ bonus</i>}
            {meta.charge && <i className="al-tag al-tag--warn">⚠ carica · svantaggio</i>}
            {m.ranged && m.tab === "atk" && <i className="al-tag">↔ distanza</i>}
          </span>
        </button>
        <button type="button" className="al-move-info" aria-label={`Cosa fa ${m.name}`} aria-expanded={openDesc === m.id} onClick={() => setOpenDesc((x) => (x === m.id ? null : m.id))}>i</button>
        {openDesc === m.id && <p className="al-move-desc">{m.desc}</p>}
      </div>
    );
  };

  const panel = () => {
    if (tab === "atk") return (
      <>
        <p className="al-sec">Armi</p>
        <div className="al-grid">{byTab("atk").filter((m) => m.kind !== "move").map(renderMove)}</div>
        <p className="al-sec">Movimento <span>{st.close ? "⚔ siete in mischia" : "↔ siete a distanza"}</span></p>
        <div className="al-grid">{MOVE_ACTIONS.map(renderMove)}</div>
      </>
    );
    if (tab === "spell") {
      const sp = byTab("spell");
      if (!sp.length) return <p className="al-empty">{myCls.label}: niente incantesimi.</p>;
      const lvls = [...new Set(sp.map((m) => m.lvl))].sort();
      return lvls.map((l) => (
        <div key={l}>
          <p className="al-sec">{l === 0 ? "Trucchetti" : `Livello ${l}`}
            {l > 0 && <span className="al-pips" aria-label={`${P.slots[l] || 0} slot su ${myCls.slots[l]}`}>{Array.from({ length: myCls.slots[l] }, (_, i) => <i key={i} className={i < (P.slots[l] || 0) ? "on" : ""} />)}</span>}
            <span>CD {myCls.dc ?? "—"}</span>
          </p>
          <div className="al-grid">{sp.filter((m) => m.lvl === l).map(renderMove)}</div>
        </div>
      ));
    }
    if (tab === "skill") { const sk = byTab("skill"); return sk.length ? <div className="al-grid">{sk.map(renderMove)}</div> : <p className="al-empty">Nessuna abilità attiva.</p>; }
    if (tab === "item") return (<><p className="al-sec">Bisaccia <span>dalla Bottega Arena</span></p><div className="al-grid">{ITEMS.map(renderMove)}</div></>);
    if (tab === "passive") return (
      <div className="al-grid al-grid--passive">
        {byTab("passive").map((m) => (
          <div key={m.id} className="al-passive"><span aria-hidden="true">{m.icon}</span><div><b>{m.name}</b><small>{m.desc}</small></div></div>
        ))}
      </div>
    );
    if (tab === "info") return <InfoSheet f={infoWho === "p" ? P : E} foe={infoWho === "p" ? E : P} who={infoWho} setWho={setInfoWho} />;
    return null;
  };

  const mm = String(Math.floor(secs / 60)), ss = String(secs % 60).padStart(2, "0");
  return (
    <section className="al-battle">
      <div className={`al-field${bg ? " has-bg" : ""}${tab ? " is-menu" : ""}`} style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
        {/* avversario: HUD in alto a sinistra, sprite lontano in alto a destra */}
        <button type="button" className="al-hud al-hud--e" onClick={() => { setTab("info"); setInfoWho("e"); }} aria-label={`Scheda di ${E.name}`}>
          <Hud f={E} />
        </button>
        <Spot side="e" f={E} who={foe} shake={shake === "e"} floats={floats} turn={st.turn === "e" && !st.over} />
        <Spot side="p" f={P} who={me} shake={shake === "p"} floats={floats} turn={st.turn === "p" && !st.over} />
        <div className="al-dist" aria-live="polite">{st.close ? "⚔ In mischia" : "↔ A distanza"}</div>

        {/* riga dell'azione: compare sopra il campo e sfuma */}
        <p key={line.id} className={`al-line ${line.kind || ""}`} aria-live="polite">{line.text}</p>

        {st.over && (
          <div className={`al-over is-${st.over}`}>
            <b>{st.over === "win" ? "🏆 Vittoria!" : "💀 Sconfitta"}</b>
            <button type="button" className="al-btn al-btn--main" onClick={restart}>↺ Ricomincia</button>
          </div>
        )}

        {/* fondo: il tuo HUD + il menu a sezioni */}
        <div className="al-dock">
          <div className="al-hud al-hud--p">
            <Hud f={P} mine />
            <div className="al-turn">
              {st.over ? <span>Fine</span> : st.turn === "p" ? (
                <>
                  <span className="al-pips al-pips--act" title="Azioni rimaste">{Array.from({ length: Math.max(myCls.actions, st.actions) }, (_, i) => <i key={i} className={i < st.actions ? "on" : ""} />)}</span>
                  <span className={`al-bonus${st.bonus ? " on" : ""}`} title="Azione bonus">⚡</span>
                  <span className="al-timer">⏱ {mm}:{ss}</span>
                </>
              ) : <span className="al-wait">turno di {E.name}…</span>}
            </div>
          </div>
          {tab && (
            <div className="al-panel" role="region" aria-label={TABS.find((t) => t.k === tab)?.label}>
              <div className="al-panel-head">
                <b>{TABS.find((t) => t.k === tab)?.icon} {TABS.find((t) => t.k === tab)?.label}</b>
                <button type="button" className="al-x" onClick={() => setTab(null)} aria-label="Chiudi il menu">✕</button>
              </div>
              <div className="al-panel-body">{panel()}</div>
            </div>
          )}
          <div className="al-tabs" role="tablist" aria-label="Menu del combattimento">
            {TABS.map((t) => {
              const n = t.k === "info" || t.k === "passive" ? null : all.filter((m) => m.tab === t.k).length;
              return (
                <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} className={`al-tab${tab === t.k ? " is-on" : ""}`} onClick={() => toggleTab(t.k)} disabled={n === 0}>
                  <span aria-hidden="true">{t.icon}</span><small>{t.label}</small>
                </button>
              );
            })}
            <button type="button" className="al-tab al-tab--end" disabled={!myTurn} onClick={endTurn}><span aria-hidden="true">⏭</span><small>Fine<span className="al-wide"> turno</span></small></button>
          </div>
        </div>
      </div>

      <details className="al-log">
        <summary>📜 Cronologia del fight ({log.length}) · round {st.round}</summary>
        <ol>{log.map((l) => <li key={l.id} className={l.kind}>{l.text}</li>)}</ol>
      </details>
      <VfxLayer messages={msgs} selfUid={uid} />
    </section>
  );
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function Hud({ f, mine }) {
  const pct = Math.max(0, Math.round((f.hp / f.maxHp) * 100));
  const col = pct > 50 ? "#5fd16b" : pct > 25 ? "#f2c14e" : "#e0624f";
  const c = CLASSES[f.cls];
  return (
    <>
      <span className="al-hud-top"><b>{f.name}</b><small>{c.icon} {c.label} · Lv {c.lv}</small></span>
      <span className="al-bar" aria-hidden="true"><span style={{ width: `${pct}%`, background: col }} /></span>
      <span className="al-hud-row">
        <span className="al-hp">{mine ? `${f.hp}/${f.maxHp} PF` : `${pct}%`}</span>
        <span className="al-ac">🛡 {acOf(f)}</span>
      </span>
      {f.st.length > 0 && (
        <span className="al-fx">
          {f.st.map((s, i) => (
            <i key={`${s.k}${i}`} className={STATUS[s.k].good ? "good" : "bad"} title={`${STATUS[s.k].label}${s.k === "ac" ? ` ${s.v}` : ""} · ${STATUS[s.k].info}${s.k === "adv" ? "" : ` · ${s.turns} turni`}`}>
              {STATUS[s.k].icon}{s.k === "ac" ? `+${s.v}` : ""}{s.k !== "adv" && <sub>{s.turns}</sub>}
            </i>
          ))}
        </span>
      )}
    </>
  );
}

function Spot({ side, f, who, shake, floats, turn }) {
  const dead = f.hp <= 0;
  const src = dead ? (who?.dead || who?.sprite || who?.image) : (who?.sprite || who?.image);
  const isSprite = !!who?.sprite;
  return (
    <div className={`al-spot al-spot--${side}${shake ? " is-hit" : ""}${dead ? " is-dead" : ""}${turn ? " is-turn" : ""}`} data-vfx-target={`lab-${side}`}>
      {src
        ? <img src={src} alt={f.name} className={`al-sprite${isSprite ? "" : " is-portrait"}`} draggable="false" />
        : <span className="al-sprite al-sprite--emoji" aria-hidden="true">{CLASSES[f.cls].icon}</span>}
      {floats.filter((x) => x.side === side).map((x) => <span key={x.id} className={`al-float is-${x.kind}`}>{x.text}</span>)}
    </div>
  );
}

function InfoSheet({ f, foe, who, setWho }) {
  const c = CLASSES[f.cls];
  return (
    <div className="al-info">
      <div className="al-seg" role="group" aria-label="Di chi">
        <button type="button" aria-pressed={who === "p"} onClick={() => setWho("p")}>Tu</button>
        <button type="button" aria-pressed={who === "e"} onClick={() => setWho("e")}>Avversario</button>
      </div>
      <div className="al-info-top">
        <div><small>PF</small><b>{f.hp}/{f.maxHp}</b></div>
        <div><small>CA</small><b>{acOf(f)}{acOf(f) !== c.ac && <em> (base {c.ac})</em>}</b></div>
        <div><small>Competenza</small><b>+{c.prof}</b></div>
        <div><small>Velocità</small><b>{c.speed} m</b></div>
        {c.dc && <div><small>CD incantesimi</small><b>{c.dc}</b></div>}
        <div><small>Critico</small><b>{c.crit ? `${c.crit}–20` : "20"}</b></div>
      </div>
      <p className="al-sec">Caratteristiche e tiri salvezza</p>
      <div className="al-stats">
        {ABIL.map((a) => (
          <div key={a} className={c.saves.includes(a) ? "is-prof" : ""}>
            <small>{a}</small><b>{c.stats[a]}</b><span>{sgn(modOf(c.stats[a]))}</span><em>TS {sgn(saveMod(f, a))}</em>
          </div>
        ))}
      </div>
      {c.slots && (
        <>
          <p className="al-sec">Slot incantesimo</p>
          <div className="al-slots">{Object.keys(c.slots).map((l) => (
            <span key={l}><small>{l}°</small><span className="al-pips">{Array.from({ length: c.slots[l] }, (_, i) => <i key={i} className={i < (f.slots[l] || 0) ? "on" : ""} />)}</span></span>
          ))}</div>
        </>
      )}
      <p className="al-sec">Stati</p>
      {f.st.length ? (
        <ul className="al-stlist">{f.st.map((s, i) => <li key={i} className={STATUS[s.k].good ? "good" : "bad"}>{STATUS[s.k].icon} <b>{STATUS[s.k].label}{s.k === "ac" ? ` ${s.v}` : ""}</b> · {STATUS[s.k].info}{s.k === "adv" ? "" : ` · ancora ${s.turns} turn${s.turns > 1 ? "i" : "o"}`}</li>)}</ul>
      ) : <p className="al-empty">Nessun bonus o malus attivo.</p>}
      <p className="al-sec">Resistenze</p>
      <p className="al-empty">{c.res.length ? c.res.map((r) => `½ ${r}`).join(" · ") : "Nessuna."}</p>
      {who === "e" && <p className="al-empty">Contro di te: tira {sgn(Math.max(...c.moves.filter((m) => m.toHit).map((m) => m.toHit), 0))} per colpire la tua CA {acOf(foe)}.</p>}
    </div>
  );
}
