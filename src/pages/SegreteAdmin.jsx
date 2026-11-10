/* Console delle Segrete: dungeon, bestiario, oggetti, bottino e grafica in prima persona. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../AuthContext";
import { isAdminEmail } from "../utils/roles";
import ImageTonePicker from "../components/ImageTonePicker";
import { cleanSpriteDataUrl } from "../utils/aiSprite";
import {
  DEFAULT_DUNGEONS, DEFAULT_FLOORS, mergeMonsters, MIMIC_MONSTER, MONSTER_ROLES, MONSTER_SIZES, sizeOf, roleInfo, dungeonSlug,
} from "../data/segrete";
import {
  ActionsList, DefensesPicker, blankAction, sanitizeActions,
  defensesOf,
} from "./WorldBossAdmin";
import CrawlerArtTab from "./SegreteAdminCrawler";
import SegreteAdminItems from "./SegreteAdminItems";
import { useSegreteItems } from "../utils/segreteItemsLive";
import { frontSpriteUrl } from "../utils/crawlerGen";
import { DAMAGE_TYPES } from "./worldBossEffects";
import { hasMetalProtection } from "../data/segreteMaterials";
import "./admin.css";
import "./WorldBossAdmin.css";
import "./SegreteAdmin.css";
import "./SegreteJrpg.css";

const blankMonster = (dungeon = "") => ({
  name: "", desc: "", role: "minion", level: 1, hp: 12, ac: 12, init: 1, save: 1,
  dungeons: dungeon ? [dungeon] : [], frontImageUrl: "", icon: "", look: "",
  actions: [blankAction(0)], resistances: [], vulnerabilities: [], immunities: [],
});
const num = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const cleanMonster = (m) => ({
  name: String(m.name || "").trim().slice(0, 60),
  desc: String(m.desc || "").trim().slice(0, 600),
  look: String(m.look || "").trim().slice(0, 600),
  role: MONSTER_ROLES.some((r) => r.key === m.role) ? m.role : "minion",
  level: num(m.level, 1, 20, 1), hp: num(m.hp, 1, 2000, 10), ac: num(m.ac, 5, 30, 12),
  init: num(m.init, -5, 15, 0), save: num(m.save, -5, 15, 0),
  dungeons: Array.isArray(m.dungeons) ? m.dungeons : [],
  frontImageUrl: m.frontImageUrl || "",
  ...(typeof m.metalProtection === "boolean" ? { metalProtection: m.metalProtection } : { metalProtection: null }),
  size: sizeOf(m),
  actions: sanitizeActions(m.actions, 1),
  ...defensesOf(m),
  ...(m.source ? { source: m.source } : {}),
  ...(m.icon ? { icon: String(m.icon).slice(0, 8) } : {}),
});

const fileToDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
const uid8 = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
async function uploadPng(blob) {
  const ref = storageRef(storage, `segrete/mostro-${uid8()}.png`);
  await uploadBytes(ref, blob, { contentType: "image/png" });
  return getDownloadURL(ref);
}
/* Ripulisce uno sprite già salvato dagli avanzi del fondo magenta (2026-11-06).
   Restituisce il nuovo url, o null se era già pulito. */
async function recleanSprite(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("sprite non scaricabile");
  const b = await r.blob();
  const src = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); });
  const out = await cleanSpriteDataUrl(src);
  if (out === src) return null;
  return uploadPng(await (await fetch(out)).blob());
}
// sprite caricato dal PC: rimpicciolito (pixel art) a 512 px, png
const fileToSpriteBlob = (file) => fileToDataUrl(file).then((src) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => {
    const scale = img.width > 512 ? 512 / img.width : 1;
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    const ctx = c.getContext("2d"); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob fallito"))), "image/png");
  };
  img.onerror = rej; img.src = src;
}));

export default function SegreteAdmin() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState("dungeon");
  const [custom, setCustom] = useState([]);
  const [monsterDocs, setMonsters] = useState([]);
  // + mostri di base del codice (2026-11-06)
  const monsters = useMemo(() => mergeMonsters(monsterDocs), [monsterDocs]);
  const { version: itemsV } = useSegreteItems(); // oggetti creati qui: uniti a ITEMS
  const [wbMinions, setWbMinions] = useState([]);
  const [wbBosses, setWbBosses] = useState([]);

  useEffect(() => onSnapshot(collection(db, "dungeon_types"), (s) => setCustom(s.docs.map((d) => ({ key: d.id, ...d.data() }))), () => {}), []);
  useEffect(() => onSnapshot(collection(db, "dungeon_monsters"), (s) => setMonsters(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}), []);
  useEffect(() => onSnapshot(collection(db, "minions"), (s) => setWbMinions(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}), []);
  useEffect(() => onSnapshot(collection(db, "bosses"), (s) => setWbBosses(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}), []);

  // tutti i tipi, anche quelli nascosti (qui il Master li vede per riattivarli)
  const dungeons = useMemo(() => {
    const map = new Map(DEFAULT_DUNGEONS.map((d) => [d.key, { ...d, base: true }]));
    custom.forEach((d) => map.set(d.key, { ...(map.get(d.key) || {}), ...d, saved: true }));
    return [...map.values()];
  }, [custom]);

  if (!currentUser || !isAdminEmail(currentUser.email)) return <div className="denied">Accesso Negato.</div>;

  return (
    <section className="adm sga">
      <Link to="/dm-admin" className="adm-back">← Console del Master</Link>
      <div className="adm-masthead">
        <div className="adm-mast-main">
          <span className="adm-eyebrow">🗝 Sala della Gloria · Storia</span>
          <h1 className="adm-title">Le Segrete</h1>
          <p className="adm-sub">Dungeon, mostri, oggetti e grafica della spedizione in prima persona.</p>
        </div>
        <div className="adm-mast-aside">
          <div className="adm-stat"><span>Dungeon</span><strong>{dungeons.filter((d) => !d.hidden && d.active !== false).length}</strong></div>
          <div className="adm-stat"><span>Mostri</span><strong>{monsters.length}</strong></div>
        </div>
      </div>

      <div className="sga-tabs">
        {[["dungeon", "🏰 Dungeon"], ["bestiario", "👹 Bestiario"], ["oggetti", "⚔ Oggetti"], ["bottino", "🎁 Bottino Foundry"], ["crawler", "🎮 Grafica e armi"]].map(([k, l]) => (
          <button key={k} type="button" aria-pressed={tab === k} className={tab === k ? "is-on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "dungeon" && <DungeonsTab dungeons={dungeons} monsters={monsters} />}
      {tab === "bestiario" && <BestiaryTab dungeons={dungeons} monsters={monsters} wbMinions={wbMinions} wbBosses={wbBosses} />}
      {tab === "oggetti" && <SegreteAdminItems dungeons={dungeons} />}
      {tab === "bottino" && <LootTab dungeons={dungeons} />}
      {tab === "crawler" && <CrawlerArtTab dungeons={dungeons} monsters={monsters} itemsV={itemsV} />}
    </section>
  );
}

/* ── DUNGEON ─────────────────────────────────────────────────── */
function DungeonsTab({ dungeons, monsters }) {
  const [editKey, setEditKey] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState("");

  const open = (d) => { setEditKey(d?.key || "__new"); setDraft(d ? { floors: DEFAULT_FLOORS, ...d } : { key: "", name: "", icon: "🗝", desc: "", floors: DEFAULT_FLOORS, hidden: false }); };
  const close = () => { setEditKey(null); setDraft(null); };
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    const key = draft.key || dungeonSlug(draft.name);
    if (!draft.name.trim() || !key) return alert("Dai un nome al dungeon.");
    if (editKey === "__new" && dungeons.some((d) => d.key === key)) return alert("Esiste già un dungeon con questo nome.");
    setBusy("save");
    try {
      await setDoc(doc(db, "dungeon_types", key), {
        name: draft.name.trim().slice(0, 40), icon: (draft.icon || "🗝").slice(0, 4), desc: String(draft.desc || "").slice(0, 300),
        floors: num(draft.floors, 1, 10, DEFAULT_FLOORS), hidden: !!draft.hidden, active: draft.active !== false,
        lootChance: num(draft.lootChance, 0, 100, 35),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      close();
    } catch (e) { alert(e.message); } finally { setBusy(""); }
  };
  const remove = async () => {
    const d = dungeons.find((x) => x.key === editKey);
    if (d?.base) { set({ hidden: true }); return alert("È un dungeon di base: l'ho segnato «nascosto». Premi Salva."); }
    if (!window.confirm(`Eliminare il dungeon «${draft.name}»? I mostri restano nel bestiario.`)) return;
    await deleteDoc(doc(db, "dungeon_types", editKey)); close();
  };
  if (draft) {
    return (
      <div className="sga-card sga-form">
        <h2 className="sga-h2">{editKey === "__new" ? "Nuovo dungeon" : `✎ ${draft.name}`}</h2>
        <div className="sga-row">
          <label className="sga-field sga-field--xs"><span>Icona</span>
            <input className="admin-field-input" value={draft.icon || ""} maxLength={4} onChange={(e) => set({ icon: e.target.value })} /></label>
          <label className="sga-field"><span>Nome</span>
            <input className="admin-field-input" value={draft.name} placeholder="es. Caverna di Cristallo" onChange={(e) => set({ name: e.target.value })} /></label>
          <label className="sga-field sga-field--s" title="Quante sale con gregari/élite prima della sala del boss"><span>Sale prima del boss</span>
            <input className="admin-field-input" type="number" min="1" max="10" value={draft.floors} onChange={(e) => set({ floors: e.target.value })} /></label>
        </div>
        <div className="sga-row">
          <label className="sga-field sga-field--s" title="Probabilità che il gruppo trovi un oggetto del forziere (lo prende un eroe a caso)"><span>Probabilità oggetto %</span>
            <input className="admin-field-input" type="number" min="0" max="100" value={draft.lootChance ?? 35} onChange={(e) => set({ lootChance: e.target.value })} /></label>
        </div>
        <label className="sga-field"><span>Descrizione (la leggono i giocatori nella lobby)</span>
          <textarea className="admin-field-input" rows={2} value={draft.desc || ""} onChange={(e) => set({ desc: e.target.value })} /></label>
        {editKey !== "__new" && <p className="sga-hint">Chiave: <code>{editKey}</code> · mostri di questo dungeon nel bestiario: {monsters.filter((m) => (m.dungeons || []).includes(editKey)).length}</p>}

        <p className="sga-hint">Pareti, pavimento e soffitto si gestiscono nella scheda Grafica e armi.</p>

        <label className="sga-check"><input type="checkbox" checked={!draft.hidden && draft.active !== false} onChange={(e) => set({ active: e.target.checked, hidden: false })} /> Attivo e selezionabile dai giocatori</label>
        <div className="sga-savebar">
          <button type="button" className="adm-btn adm-btn--gold" disabled={!!busy} onClick={save}>{busy === "save" ? "Salvo…" : "💾 Salva"}</button>
          <button type="button" className="adm-btn" onClick={close}>Annulla</button>
          {editKey !== "__new" && <button type="button" className="adm-btn adm-btn--danger" onClick={remove}>🗑 Elimina</button>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sga-btns"><button type="button" className="adm-btn adm-btn--gold" onClick={() => open(null)}>＋ Nuovo dungeon</button></div>
      <fieldset className="sga-dungeon-availability">
        <legend>Dungeon attivi e selezionabili</legend>
        <p className="sga-hint">Disattivare un dungeon impedisce nuove partenze; le spedizioni in corso possono finire.</p>
        <div className="sga-dungeon-switches">{dungeons.map((d) => <label key={d.key} className="sga-check">
          <input type="checkbox" checked={!d.hidden && d.active !== false} disabled={!!busy} onChange={async (e) => {
            const active = e.target.checked;
            setBusy(`active:${d.key}`);
            try { await setDoc(doc(db, "dungeon_types", d.key), { active, ...(active ? { hidden: false } : {}), updatedAt: serverTimestamp() }, { merge: true }); }
            catch (err) { alert(err.message); } finally { setBusy(""); }
          }} /> {d.name}<small>{!d.hidden && d.active !== false ? "Attivo" : "Disattivato"}</small>
        </label>)}</div>
      </fieldset>
      <div className="sga-grid">
        {dungeons.map((d) => {
          const n = monsters.filter((m) => (m.dungeons || []).includes(d.key));
          const bosses = n.filter((m) => m.role === "boss").length;
          return (
            <button key={d.key} type="button" className={`sga-card sga-dcard${(d.hidden || d.active === false) ? " is-hidden" : ""}`} onClick={() => open(d)}>
              <div className="sga-dcard-bg"><span aria-hidden="true">{d.icon}</span></div>
              <b>{d.icon} {d.name}{d.hidden || d.active === false ? " · disattivato" : ""}</b>
              <small>{d.floors || DEFAULT_FLOORS} sale + boss · {n.length} mostri{bosses ? "" : " · ⚠ nessun boss"}</small>
              <small>🎁 {d.lootChance ?? 35}% oggetto · 10% Mimic nello scrigno finale</small>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ── BESTIARIO ───────────────────────────────────────────────── */
function BestiaryTab({ dungeons, monsters, wbMinions, wbBosses }) {
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(null); // {id?, ...mostro}
  const [busy, setBusy] = useState({});
  const [hint, setHint] = useState("");
  const [showImport, setShowImport] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const flag = (k, v) => setBusy((b) => ({ ...b, [k]: v }));

  const list = monsters
    .filter((m) => filter === "all" || (filter === "none" ? !(m.dungeons || []).length : (m.dungeons || []).includes(filter)))
    .sort((a, b) => (a.level || 1) - (b.level || 1) || String(a.name).localeCompare(b.name));

  const save = async () => {
    const m = cleanMonster(form);
    if (form.id === "mimic") { m.dungeons = []; m.role = "elite"; }
    if (!m.name) return alert("Dai un nome al mostro.");
    flag("save", true);
    try {
      if (form.id) await setDoc(doc(db, "dungeon_monsters", form.id), { ...m, updatedAt: serverTimestamp() }, { merge: true });
      else await addDoc(collection(db, "dungeon_monsters"), { ...m, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setForm(null);
    } catch (e) { alert(e.message); } finally { flag("save", false); }
  };
  const remove = async () => {
    if (!window.confirm(`Eliminare «${form.name}» dal bestiario?`)) return;
    // un mostro di base non si cancella dal codice: lo si nasconde
    if (form.base) await setDoc(doc(db, "dungeon_monsters", form.id), { hidden: true, updatedAt: serverTimestamp() }, { merge: true });
    else await deleteDoc(doc(db, "dungeon_monsters", form.id));
    setForm(null);
  };
  const cleanOne = async () => {
    const k = "frontImageUrl";
    flag("front", true);
    try { const u = await recleanSprite(form[k]); if (u) set({ [k]: u }); else alert("Era già pulito."); }
    catch (e) { alert(`Non riuscito: ${e.message}. Rigeneralo con ✨.`); }
    finally { flag("front", false); }
  };
  const cleanAll = async () => {
    const todo = monsters.filter((m) => m.frontImageUrl);
    if (!todo.length || !window.confirm(`Ripulire dagli avanzi viola gli sprite di ${todo.length} mostri? Si sovrascrivono (il disegno resta, sparisce solo il fondo magenta rimasto).`)) return;
    flag("cleanAll", "0/" + todo.length);
    let fixed = 0, failed = 0;
    for (let i = 0; i < todo.length; i++) {
      const m = todo[i];
      const patch = {};
      for (const k of ["frontImageUrl"]) {
        if (!m[k]) continue;
        try { const u = await recleanSprite(m[k]); if (u) patch[k] = u; } catch { failed++; }
      }
      if (Object.keys(patch).length) {
        await setDoc(doc(db, "dungeon_monsters", m.id), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
        fixed++;
      }
      flag("cleanAll", `${i + 1}/${todo.length}`);
    }
    flag("cleanAll", false);
    alert(`Ripuliti ${fixed} mostri.${failed ? ` ${failed} sprite non si sono potuti scaricare: rigenerali con ✨.` : ""}`);
  };
  const duplicate = () => setForm((f) => ({ ...f, id: undefined, base: undefined, name: `${f.name} (copia)` }));

  const genFront = async () => {
    if (!form.name.trim()) return alert("Dai prima un nome al mostro.");
    flag("front", true);
    try { set({ frontImageUrl: await frontSpriteUrl(form) }); }
    catch (e) { alert("Sprite frontale: " + (e.message || e)); } finally { flag("front", false); }
  };
  const onSpriteFile = (k) => async (file) => {
    const fk = "front";
    flag(fk, true);
    try { set({ [k]: await uploadPng(await fileToSpriteBlob(file)) }); }
    catch (e) { alert(e.message); } finally { flag(fk, false); }
  };
  /* L'IA scrive la scheda (2026-11-07, rifatto): endpoint dedicato alle Segrete (api/_segreteMonster.js)
     con resistenze, vulnerabilità, immunità, taglia, aspetto per lo sprite e stati inflitti. Senza spunto
     tira a sorte tipo di creatura e modo di combattere, e riceve TUTTI i nomi del bestiario da evitare:
     prima lo spunto era fisso ("mostro base di D&D") e uscivano sempre gli stessi. */
  const generate = async (mode) => {
    flag("gen", mode);
    try {
      const ds = (form.dungeons || []).map((k) => dungeons.find((d) => d.key === k)).filter(Boolean);
      const dungeon = ds.length ? { name: ds.map((d) => d.name).join(" / "), desc: ds.map((d) => d.desc).filter(Boolean).join(" ") } : {};
      const r = await fetch("/api/genera-boss", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tipo: "segrete", dungeon, role: form.role, level: num(form.level, 1, 20, 1), spunto: hint.trim(),
          evita: monsters.filter((m) => m.id !== form.id).map((m) => m.name).filter(Boolean),
          current: mode === "complete" && form.name.trim() ? { name: form.name, desc: form.desc, level: form.level, role: form.role } : null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.error || !data.monster) throw new Error(data.error || "Generazione fallita.");
      const m = data.monster;
      set({
        name: m.name || form.name, icon: m.icon || form.icon || "", desc: m.desc || form.desc, look: m.look || "",
        size: m.size || form.size, level: m.level ?? form.level, hp: m.hp ?? form.hp, ac: m.ac ?? form.ac,
        metalProtection: typeof m.metalProtection === "boolean" ? m.metalProtection : null,
        init: m.init ?? form.init, save: m.save ?? form.save,
        ...defensesOf(m),
        actions: sanitizeActions((m.actions || []).map((a) => ({ ...a, range: 1, aoeSize: a.aoeShape && a.aoeShape !== "single" ? 2 : 1 })), 1),
      });
    } catch (e) { alert("Genera mostro: " + (e.message || e)); } finally { flag("gen", false); }
  };
  const importFrom = (src, kind) => {
    setForm({
      ...blankMonster(filter !== "all" && filter !== "none" ? filter : ""),
      name: src.name || "", desc: src.description || "",
      role: kind === "boss" ? "boss" : "minion",
      level: num(src.gradoSfida, 1, 20, kind === "boss" ? 5 : 1),
      hp: num(src.hp ?? src.maxHp, 1, 2000, 10), ac: num(src.ac, 5, 30, 12),
      frontImageUrl: src.frontImageUrl || "",
      actions: sanitizeActions(src.actions, 1), ...defensesOf(src), source: `wb-${kind}:${src.id}`,
    });
    setShowImport(false);
  };

  if (form) {
    const defs = defensesOf(form);
    const dmgIco = (x) => DAMAGE_TYPES.find((d) => d.key === x)?.icon || x;
    const sprites = [{ k: "frontImageUrl", fk: "front", title: "Sprite del mostro", use: "Frontale, rivolto verso il giocatore", gen: genFront }];
    const face = form.frontImageUrl;
    /* SCHEDA DEL MOSTRO «MENU DA JRPG» (2026-11-08, richiesta dell'utente: più semplice, stile vecchio
       gioco). Finestre blu con doppia cornice (SegreteJrpg.css): in vista solo quello che conta
       (stato, IA, dove esce, azioni, difese, sprite), il resto in «Avanzate». */
    return (
      <div className="jrpg">
        <div className="jw jw-status">
          <div className={`jw-face${face ? "" : " is-empty"}`}>
            {face ? <img src={face} alt="" /> : <span>{form.icon || roleInfo(form.role).icon}</span>}
          </div>
          <div className="jw-stat-main">
            <div className="jw-name-row">
              <input className="jw-icon-in" value={form.icon || ""} maxLength={8} placeholder={roleInfo(form.role).icon} aria-label="Icona" onChange={(e) => set({ icon: e.target.value })} />
              <input className="jw-name-in" value={form.name} placeholder="NOME DEL MOSTRO" aria-label="Nome" onChange={(e) => set({ name: e.target.value })} />
              {form.base && <span className="jw-tag">di base</span>}
            </div>
            <div className="jw-menu jw-menu--row" role="group" aria-label="Ruolo">
              {MONSTER_ROLES.map((r) => <button key={r.key} type="button" aria-pressed={form.role === r.key} onClick={() => set({ role: r.key })}>{r.label}</button>)}
            </div>
            <div className="jw-stats">
              {[["level", "LV", 1, 20], ["hp", "PF", 1, 2000], ["ac", "CA", 5, 30]].map(([k, l, lo, hi]) => (
                <label key={k}><span>{l}</span><input type="number" min={lo} max={hi} value={form[k]} onChange={(e) => set({ [k]: e.target.value })} /></label>
              ))}
              <label><span>TAGLIA</span>
                <select value={sizeOf(form)} onChange={(e) => set({ size: e.target.value })}>{MONSTER_SIZES.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}</select></label>
            </div>
            <p className="jw-defs">
              {defs.immunities.length > 0 && <span>IMMUNE {defs.immunities.map(dmgIco).join("")}</span>}
              {defs.resistances.length > 0 && <span>RESISTE {defs.resistances.map(dmgIco).join("")}</span>}
              {defs.vulnerabilities.length > 0 && <span className="is-weak">DEBOLE {defs.vulnerabilities.map(dmgIco).join("")}</span>}
              {!defs.immunities.length && !defs.resistances.length && !defs.vulnerabilities.length && <span className="is-warn">⚠ nessuna resistenza o debolezza</span>}
            </p>
          </div>
          <textarea className="jw-desc" rows={2} value={form.desc} placeholder="Descrizione per i giocatori…" onChange={(e) => set({ desc: e.target.value })} />
        </div>

        <div className="jw jw-ai">
          <h3 className="jw-h">✨ Fatti aiutare dall'IA</h3>
          <input className="jw-in" value={hint} onChange={(e) => setHint(e.target.value)} placeholder='Spunto (facoltativo): "ragno che sputa acido"… vuoto = a sorpresa' />
          <div className="jw-cmds">
            <button type="button" disabled={!!busy.gen} onClick={() => generate("new")}>{busy.gen === "new" ? "⏳ SCRIVO…" : "🎲 MOSTRO NUOVO"}</button>
            {form.name.trim() && <button type="button" disabled={!!busy.gen} onClick={() => generate("complete")}>{busy.gen === "complete" ? "⏳ SCRIVO…" : "✨ COMPLETA LA SCHEDA"}</button>}
          </div>
        </div>

        <div className="jw">
          <h3 className="jw-h">Dove esce</h3>
          {form.id === "mimic" ? <p className="sga-hint">Solo nello scrigno finale di tutti i dungeon (10%). Genera gli sprite qui sotto e premi SALVA: saranno usati anche dal Mimic dello scrigno. Il livello si adatta al gruppo.</p> : <>
          <div className="jw-menu">
            {dungeons.map((d) => {
              const on = (form.dungeons || []).includes(d.key);
              return <button key={d.key} type="button" aria-pressed={on} onClick={() => set({ dungeons: on ? form.dungeons.filter((k) => k !== d.key) : [...(form.dungeons || []), d.key] })}>{d.icon} {d.name}</button>;
            })}
          </div>
          </>}
        </div>

        <div className="jw">
          <h3 className="jw-h">Azioni</h3>
          <ActionsList actions={form.actions} min={1} withInflict compact onChange={(actions) => set({ actions })} />
        </div>

        <div className="jw">
          <h3 className="jw-h">Resistenze e debolezze <small>tocca: — · ½ resiste · ×2 debole · 🚫 immune</small></h3>
          <label className="jw-field"><span>Armatura o corpo di metallo</span>
            <select className="jw-in" value={typeof form.metalProtection === "boolean" ? String(form.metalProtection) : "auto"}
              onChange={(e) => set({ metalProtection: e.target.value === "auto" ? null : e.target.value === "true" })}>
              <option value="auto">Automatico da nome e aspetto</option>
              <option value="true">Sì: metallo (acido ×1,5)</option>
              <option value="false">No: senza protezioni metalliche</option>
            </select>
          </label>
          <p className="sga-hint">{hasMetalProtection(form) ? "Corrosione attiva: danni acidi ×1,5." : "Nessun bonus acido da metallo."} Le sole armi non contano.</p>
          <DefensesPicker value={form} onChange={(d) => set(d)} />
        </div>

        <div className="jw">
          <h3 className="jw-h">Sprite</h3>
          <div className="jw-sprites">
            {sprites.map((sp) => {
              const src = form[sp.k], on = busy[sp.fk];
              return (
                <div key={sp.k} className="jw-spr">
                  <div className="jw-spr-img">
                    {on ? <span>⏳</span> : src ? <img src={src} alt={sp.title} className={sp.mirror ? "mirror" : ""} /> : <span className="is-none">?</span>}
                  </div>
                  <b>{sp.title}</b><small>{sp.use}</small>
                  <div className="jw-spr-btns">
                    <button type="button" disabled={!!on} onClick={sp.gen}>{src ? "✨ RIFAI" : "✨ GENERA"}</button>
                    <label>📁<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onSpriteFile(sp.k)(f); e.target.value = ""; }} /></label>
                    {src && <button type="button" disabled={!!on} title="Toglie il viola rimasto" onClick={cleanOne}>🧽</button>}
                    {src && <button type="button" disabled={!!on} aria-label={`Togli ${sp.title}`} onClick={() => set({ [sp.k]: "" })}>✕</button>}
                  </div>
                </div>
              );
            })}
          </div>
          <ImageTonePicker />
        </div>

        <details className="jw jw-adv">
          <summary className="jw-h">Avanzate</summary>
          <div className="jw-stats">
            <label><span>INIZIATIVA</span><input type="number" min="-5" max="15" value={form.init} onChange={(e) => set({ init: e.target.value })} /></label>
            <label><span>TIRI SALVEZZA</span><input type="number" min="-5" max="15" value={form.save} onChange={(e) => set({ save: e.target.value })} /></label>
          </div>
          <label className="jw-field"><span>Aspetto per il disegno (inglese)</span>
            <textarea className="jw-in" rows={2} value={form.look || ""} placeholder="gaunt grey ghoul with long black claws" onChange={(e) => set({ look: e.target.value })} /></label>
        </details>

        <div className="jw jw-cmdbar">
          <button type="button" className="is-main" disabled={busy.save} onClick={save}>{busy.save ? "SALVO…" : "💾 SALVA"}</button>
          <button type="button" onClick={() => setForm(null)}>ESCI</button>
          {form.id && <button type="button" onClick={duplicate}>DUPLICA</button>}
          {form.id && form.id !== "mimic" && <button type="button" className="is-danger" onClick={remove}>ELIMINA</button>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sga-btns">
        <button type="button" className="adm-btn adm-btn--gold" onClick={() => setForm({ ...blankMonster(), ...MIMIC_MONSTER, ...(monsters.find((m) => m.id === "mimic") || {}), id: "mimic", base: true })}>👹 Mimic dello scrigno · Sprite</button>
        <button type="button" className="adm-btn adm-btn--gold" onClick={() => setForm(blankMonster(filter !== "all" && filter !== "none" ? filter : ""))}>＋ Nuovo mostro</button>
        <button type="button" className="adm-btn" aria-pressed={showImport} onClick={() => setShowImport((v) => !v)}>📥 Importa dal World Boss</button>
      </div>
      {showImport && (
        <div className="sga-card sga-import">
          <p className="sga-hint">Copia nome, PF, CA, azioni e resistenze in un mostro nuovo. Poi scegli il dungeon, genera lo sprite frontale e salva.</p>
          {[["minion", wbMinions], ["boss", wbBosses]].map(([kind, arr]) => (
            <div key={kind}>
              <h3 className="sga-h3">{kind === "boss" ? "👑 Boss" : "🐀 Minion"} del World Boss</h3>
              <div className="sga-chips">
                {arr.map((s) => {
                  const done = monsters.some((m) => m.source === `wb-${kind}:${s.id}`);
                  return <button key={s.id} type="button" className={done ? "is-done" : ""} onClick={() => importFrom(s, kind)}>{done ? "✓ " : ""}{s.name || "(senza nome)"}</button>;
                })}
                {!arr.length && <small>nessuno</small>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="sga-btns">
        <button type="button" className="adm-btn" disabled={!!busy.cleanAll} onClick={cleanAll} title="Ripassa la pulizia del fondo magenta su tutti gli sprite già salvati">
          {busy.cleanAll ? `🧽 Ripulisco… ${busy.cleanAll}` : "🧽 Ripulisci tutti gli sprite"}
        </button>
      </div>
      <div className="sga-chips sga-filter">
        <button type="button" aria-pressed={filter === "all"} className={filter === "all" ? "is-on" : ""} onClick={() => setFilter("all")}>Tutti ({monsters.length})</button>
        {dungeons.map((d) => (
          <button key={d.key} type="button" aria-pressed={filter === d.key} className={filter === d.key ? "is-on" : ""} onClick={() => setFilter(d.key)}>
            {d.icon} {d.name} ({monsters.filter((m) => (m.dungeons || []).includes(d.key)).length})
          </button>
        ))}
        <button type="button" aria-pressed={filter === "none"} className={filter === "none" ? "is-on" : ""} onClick={() => setFilter("none")}>Senza dungeon</button>
      </div>
      {!list.length && <p className="sga-hint">Nessun mostro qui. Creane uno, fattelo scrivere dall'IA o importalo dal World Boss.</p>}
      <div className="sga-grid">
        {list.map((m) => (
          <button key={m.id} type="button" className="sga-card sga-mcard" onClick={() => setForm({ ...blankMonster(), ...m })}>
            <div className="sga-mcard-img">
              {m.frontImageUrl ? <img src={m.frontImageUrl} alt="" /> : <span aria-hidden="true">{m.icon || roleInfo(m.role).icon}</span>}
            </div>
            <div className="sga-mcard-main">
              <b>{m.name}</b>
              <small>{roleInfo(m.role).icon} {roleInfo(m.role).label} · {MONSTER_SIZES.find((z) => z.key === sizeOf(m))?.label} · Lv {m.level} · {m.hp} PF · CA {m.ac}</small>
              <small>{(m.actions || []).map((a) => a.name).filter(Boolean).join(" · ") || "nessuna azione"}</small>
              <small>{[["resistances", "½"], ["vulnerabilities", "×2"], ["immunities", "🚫"]].map(([k, t]) => ((m[k] || []).length ? `${t} ${(m[k] || []).map((x) => DAMAGE_TYPES.find((d) => d.key === x)?.icon || x).join("")}` : "")).filter(Boolean).join("  ") || "⚠ niente resistenze o debolezze"}</small>
              <small>{m.frontImageUrl ? "✓ Sprite pronto" : "⚠ Sprite frontale da creare"}</small>
              <small className="sga-mcard-d">{(m.dungeons || []).map((k) => dungeons.find((d) => d.key === k)?.icon || "").join(" ") || "⚠ in nessun dungeon"}</small>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

/* ── BOTTINO (fase 4) ─────────────────────────────────────────
   segrete_loot = oggetti creati dalla Forgia del Mercato Nero con destinazione
   "Le Segrete". status "pool" = in palio, "won" = vinto (wonBy, wonByName, wonAt):
   alla vittoria di un dungeon il server lo dà a un eroe a caso e lo manda in
   foundry_inbox come le aste vinte. Qui si sceglie dove esce, si rimette in palio o si toglie. */
function LootTab({ dungeons }) {
  const [loot, setLoot] = useState([]);
  useEffect(() => onSnapshot(collection(db, "segrete_loot"), (s) => setLoot(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}), []);
  const pool = loot.filter((l) => l.status !== "won");
  const won = loot.filter((l) => l.status === "won").sort((a, b) => (b.wonAt || 0) - (a.wonAt || 0));
  const toggle = (l, key) => {
    const ds = l.dungeons || [];
    updateDoc(doc(db, "segrete_loot", l.id), { dungeons: ds.includes(key) ? ds.filter((k) => k !== key) : [...ds, key] }).catch((e) => alert(e.message));
  };
  const card = (l) => (
    <div key={l.id} className="sga-card sga-loot">
      <div className="sga-mcard-img">{l.img ? <img src={l.img} alt="" /> : <span aria-hidden="true">🎁</span>}</div>
      <div className="sga-mcard-main">
        <b>{l.name}</b>
        <small>{l.type} · {l.class}</small>
        {l.status === "won"
          ? <small>🏆 vinto da <b>{l.wonByName || "?"}</b>{l.wonAt ? ` il ${new Date(l.wonAt).toLocaleDateString("it-IT")}` : ""}{l.dungeon ? ` · ${dungeons.find((d) => d.key === l.dungeon)?.name || l.dungeon}` : ""}</small>
          : (
            <div className="sga-chips sga-loot-chips">
              {dungeons.map((d) => {
                const on = (l.dungeons || []).includes(d.key);
                return <button key={d.key} type="button" aria-pressed={on} className={on ? "is-on" : ""} onClick={() => toggle(l, d.key)}>{d.icon} {d.name}</button>;
              })}
              <small>{(l.dungeons || []).length ? "" : "esce in tutti i dungeon"}</small>
            </div>
          )}
        <div className="sga-btns">
          {l.status === "won" && (
            <button type="button" className="adm-btn" onClick={() => updateDoc(doc(db, "segrete_loot", l.id), { status: "pool", wonBy: null, wonByName: null, wonAt: null }).catch((e) => alert(e.message))}>↺ Rimetti in palio</button>
          )}
          <button type="button" className="adm-btn adm-btn--danger" onClick={() => window.confirm(`Togliere «${l.name}» dal forziere?`) && deleteDoc(doc(db, "segrete_loot", l.id))}>🗑 Togli</button>
        </div>
      </div>
    </div>
  );
  return (
    <>
      <p className="sga-hint">Premi «veri» da portare su Foundry (creati in passato dalla Forgia del Mercato). Gli oggetti del GIOCO delle Segrete si creano nella piega «⚔ Oggetti». Alla vittoria di un dungeon, con la probabilità scelta nel dungeon, uno di questi va a un eroe a caso del gruppo e arriva su Foundry (Fetch admin) come un'asta vinta.</p>
      <h3 className="sga-h3">In palio <small>{pool.length}</small></h3>
      {!pool.length && <p className="sga-hint">Il forziere è vuoto: i gruppi vincono Monete Antiche, bottino delle sale e PE.</p>}
      <div className="sga-grid">{pool.map(card)}</div>
      <h3 className="sga-h3">Già vinti <small>{won.length}</small></h3>
      <div className="sga-grid">{won.map(card)}</div>
    </>
  );
}
