/* LE SEGRETE · admin (fase 2, 2026-11-04) = /dm-admin/segrete
   Due pieghe:
   - Dungeon: i tipi (caverna, segrete, magma…) con icona, descrizione, numero
     di sale prima del boss e SFONDI (caricati dal PC o generati con l'IA, uno
     o più per tipo: in partita se ne pesca uno). dungeon_types/{key}.
   - Bestiario: i mostri (dungeon_monsters), con ruolo (gregario/élite/boss),
     livello, PF, CA, iniziativa, TS, azioni nello STESSO formato del World Boss
     (attacchi, tiri salvezza, aree, cure, +CA, vantaggio/svantaggio),
     resistenze, sprite vivo/morto e i dungeon in cui escono. Si possono
     generare con l'IA o importare dai minion/boss del World Boss. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes, uploadString } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../AuthContext";
import { isAdminEmail } from "../utils/roles";
import { getImageTone } from "../data/imageTone";
import ImageTonePicker from "../components/ImageTonePicker";
import {
  DEFAULT_DUNGEONS, DEFAULT_FLOORS, MONSTER_ROLES, roleInfo, dungeonSlug,
} from "../data/segrete";
import {
  ActionsList, DefensesPicker, FacingPicker, SpriteDropzone, blankAction, sanitizeActions, pixelArtPrompt,
  dataUrlToTransparentBlob, defensesOf,
} from "./WorldBossAdmin";
import "./admin.css";
import "./WorldBossAdmin.css";
import "./SegreteAdmin.css";

const blankMonster = (dungeon = "") => ({
  name: "", desc: "", role: "minion", level: 1, hp: 12, ac: 12, init: 1, save: 1,
  dungeons: dungeon ? [dungeon] : [], imageUrl: "", deadImageUrl: "", facing: "left",
  actions: [blankAction(0)], resistances: [], vulnerabilities: [], immunities: [],
});
const num = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const cleanMonster = (m) => ({
  name: String(m.name || "").trim().slice(0, 60),
  desc: String(m.desc || "").trim().slice(0, 600),
  role: MONSTER_ROLES.some((r) => r.key === m.role) ? m.role : "minion",
  level: num(m.level, 1, 20, 1), hp: num(m.hp, 1, 2000, 10), ac: num(m.ac, 5, 30, 12),
  init: num(m.init, -5, 15, 0), save: num(m.save, -5, 15, 0),
  dungeons: Array.isArray(m.dungeons) ? m.dungeons : [],
  imageUrl: m.imageUrl || "", deadImageUrl: m.deadImageUrl || "", facing: m.facing === "right" ? "right" : "left",
  actions: sanitizeActions(m.actions, 1),
  ...defensesOf(m),
  ...(m.source ? { source: m.source } : {}),
});

const toJpegDataUrl = (src, max = 1280) => new Promise((res, rej) => {
  const i = new Image();
  i.crossOrigin = "anonymous";
  i.onload = () => {
    const scale = i.width > max ? max / i.width : 1;
    const c = document.createElement("canvas");
    c.width = Math.round(i.width * scale); c.height = Math.round(i.height * scale);
    c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
    res(c.toDataURL("image/jpeg", 0.8));
  };
  i.onerror = () => rej(new Error("immagine non leggibile"));
  i.src = src;
});
const fileToDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
const uid8 = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
async function uploadJpeg(dataUrl) {
  const ref = storageRef(storage, `segrete/bg-${uid8()}.jpg`);
  await uploadString(ref, dataUrl, "data_url", { contentType: "image/jpeg" });
  return getDownloadURL(ref);
}
async function uploadPng(blob) {
  const ref = storageRef(storage, `segrete/mostro-${uid8()}.png`);
  await uploadBytes(ref, blob, { contentType: "image/png" });
  return getDownloadURL(ref);
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

const bgPrompt = (d, idea) => `Wide 16:9 background scene for a turn-based fight between a party of up to four fantasy heroes and a group of monsters, high-quality SERIOUS dark-fantasy pixel art like a polished modern 2D RPG: detailed 32-bit-era shading, rich but limited palette, crisp pixels, no anti-aliasing, no blur.
Setting: a Dungeons & Dragons dungeon: ${d.name}${d.desc ? ` — ${d.desc}` : ""}.${idea ? ` Details: ${idea}.` : ""}
Composition (IMPORTANT): a wide flat floor area. The heroes will stand in the LOWER-LEFT foreground, the monsters in the RIGHT middle ground: keep both areas clear, flat and simple. Scenery and details around the edges and at the top; the bottom strip stays calm because a menu will cover it.
EMPTY SCENE: no characters, no people, no creatures, no weapons on the ground, no text, no UI, no frame, no border.`;

export default function SegreteAdmin() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState("dungeon");
  const [custom, setCustom] = useState([]);
  const [monsters, setMonsters] = useState([]);
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
          <p className="adm-sub">Tipi di dungeon con i loro sfondi, e il bestiario dei mostri che ci vivono.</p>
        </div>
        <div className="adm-mast-aside">
          <div className="adm-stat"><span>Dungeon</span><strong>{dungeons.filter((d) => !d.hidden).length}</strong></div>
          <div className="adm-stat"><span>Mostri</span><strong>{monsters.length}</strong></div>
        </div>
      </div>

      <div className="sga-tabs">
        {[["dungeon", "🏰 Dungeon"], ["bestiario", "👹 Bestiario"]].map(([k, l]) => (
          <button key={k} type="button" aria-pressed={tab === k} className={tab === k ? "is-on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "dungeon"
        ? <DungeonsTab dungeons={dungeons} monsters={monsters} />
        : <BestiaryTab dungeons={dungeons} monsters={monsters} wbMinions={wbMinions} wbBosses={wbBosses} />}
    </section>
  );
}

/* ── DUNGEON ─────────────────────────────────────────────────── */
function DungeonsTab({ dungeons, monsters }) {
  const [editKey, setEditKey] = useState(null);
  const [draft, setDraft] = useState(null);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState("");
  const fileRef = useRef(null);

  const open = (d) => { setEditKey(d?.key || "__new"); setDraft(d ? { floors: DEFAULT_FLOORS, backgrounds: [], ...d } : { key: "", name: "", icon: "🗝", desc: "", floors: DEFAULT_FLOORS, backgrounds: [], hidden: false }); setIdea(""); };
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
        floors: num(draft.floors, 1, 10, DEFAULT_FLOORS), backgrounds: draft.backgrounds || [], hidden: !!draft.hidden,
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
  const addBg = async (dataUrl) => {
    const url = await uploadJpeg(await toJpegDataUrl(dataUrl));
    setDraft((d) => ({ ...d, backgrounds: [...(d.backgrounds || []), url] }));
  };
  const onFile = async (f) => {
    if (!f) return;
    setBusy("bg");
    try { await addBg(await fileToDataUrl(f)); } catch (e) { alert(e.message); } finally { setBusy(""); }
  };
  const generate = async () => {
    if (!draft.name.trim()) return alert("Dai prima un nome al dungeon.");
    setBusy("bg");
    try {
      const r = await fetch("/api/genera-immagine", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: bgPrompt(draft, idea.trim()), aspectRatio: "16:9", tono: getImageTone() }),
      });
      const data = await r.json();
      if (!r.ok || data.error || !data.immagine) throw new Error(data.error || "Nessuna immagine ricevuta.");
      await addBg(data.immagine);
    } catch (e) { alert("Generazione sfondo fallita: " + (e.message || e)); } finally { setBusy(""); }
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
        <label className="sga-field"><span>Descrizione (la leggono i giocatori nella lobby)</span>
          <textarea className="admin-field-input" rows={2} value={draft.desc || ""} onChange={(e) => set({ desc: e.target.value })} /></label>
        {editKey !== "__new" && <p className="sga-hint">Chiave: <code>{editKey}</code> · mostri di questo dungeon nel bestiario: {monsters.filter((m) => (m.dungeons || []).includes(editKey)).length}</p>}

        <h3 className="sga-h3">Sfondi <small>in partita se ne pesca uno a caso</small></h3>
        <div className="sga-bgs">
          {(draft.backgrounds || []).map((u, i) => (
            <figure key={u} className="sga-bg">
              <img src={u} alt={`Sfondo ${i + 1}`} />
              <button type="button" className="sga-x" aria-label="Togli lo sfondo" onClick={() => set({ backgrounds: draft.backgrounds.filter((x) => x !== u) })}>✕</button>
            </figure>
          ))}
          {!(draft.backgrounds || []).length && <div className="sga-bg sga-bg--empty">{draft.icon || "🗝"}<small>nessuno sfondo</small></div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        <textarea className="admin-field-input" rows={2} value={idea} onChange={(e) => setIdea(e.target.value)}
          placeholder='Idea per il disegno (facoltativa): es. "stalattiti di cristallo azzurro", "ponte di pietra sulla lava"' />
        <ImageTonePicker />
        <div className="sga-btns">
          <button type="button" className="adm-btn" disabled={!!busy} onClick={() => fileRef.current?.click()}>📁 Carica dal PC</button>
          <button type="button" className="adm-btn" disabled={!!busy} onClick={generate}>{busy === "bg" ? "⏳ Disegno…" : "✨ Genera con l'IA"}</button>
        </div>

        <label className="sga-check"><input type="checkbox" checked={!!draft.hidden} onChange={(e) => set({ hidden: e.target.checked })} /> Nascosto (i giocatori non lo possono scegliere)</label>
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
      <div className="sga-grid">
        {dungeons.map((d) => {
          const n = monsters.filter((m) => (m.dungeons || []).includes(d.key));
          const bosses = n.filter((m) => m.role === "boss").length;
          return (
            <button key={d.key} type="button" className={`sga-card sga-dcard${d.hidden ? " is-hidden" : ""}`} onClick={() => open(d)}>
              <div className="sga-dcard-bg" style={d.backgrounds?.[0] ? { backgroundImage: `url(${d.backgrounds[0]})` } : undefined}>
                {!d.backgrounds?.[0] && <span aria-hidden="true">{d.icon}</span>}
              </div>
              <b>{d.icon} {d.name}{d.hidden ? " · nascosto" : ""}</b>
              <small>{d.floors || DEFAULT_FLOORS} sale + boss · {(d.backgrounds || []).length} sfondi · {n.length} mostri{bosses ? "" : " · ⚠ nessun boss"}</small>
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
    if (!m.name) return alert("Dai un nome al mostro.");
    flag("save", true);
    try {
      if (form.id) await updateDoc(doc(db, "dungeon_monsters", form.id), { ...m, updatedAt: serverTimestamp() });
      else await addDoc(collection(db, "dungeon_monsters"), { ...m, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setForm(null);
    } catch (e) { alert(e.message); } finally { flag("save", false); }
  };
  const remove = async () => {
    if (!window.confirm(`Eliminare «${form.name}» dal bestiario?`)) return;
    await deleteDoc(doc(db, "dungeon_monsters", form.id)); setForm(null);
  };
  const duplicate = () => setForm((f) => ({ ...f, id: undefined, name: `${f.name} (copia)` }));

  const genSprite = async (dead) => {
    if (!form.name.trim()) return alert("Dai prima un nome al mostro.");
    const key = dead ? "dead" : "alive";
    flag(key, true);
    try {
      const r = await fetch("/api/genera-immagine", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: pixelArtPrompt(form.name, form.desc, dead, { deadStyle: "corpse", withRef: !!(dead && form.imageUrl) }),
          ...(dead && form.imageUrl ? { refs: [form.imageUrl] } : {}), tono: getImageTone(),
        }),
      });
      const data = await r.json();
      if (!r.ok || data.error || !data.immagine) throw new Error(data.error || "Nessuna immagine ricevuta.");
      const url = await uploadPng(await dataUrlToTransparentBlob(data.immagine));
      set(dead ? { deadImageUrl: url } : { imageUrl: url });
    } catch (e) { alert("Sprite: " + (e.message || e)); } finally { flag(key, false); }
  };
  const onSpriteFile = (dead) => async (file) => {
    const key = dead ? "dead" : "alive";
    flag(key, true);
    try { const url = await uploadPng(await fileToSpriteBlob(file)); set(dead ? { deadImageUrl: url } : { imageUrl: url }); }
    catch (e) { alert(e.message); } finally { flag(key, false); }
  };
  // L'IA scrive la scheda (stesso endpoint dei minion/boss del World Boss)
  const generate = async () => {
    flag("gen", true);
    try {
      const dn = (form.dungeons || []).map((k) => dungeons.find((d) => d.key === k)?.name).filter(Boolean).join(", ");
      const ctx = [hint.trim() || form.name, dn && `vive nel dungeon: ${dn}`, `ruolo: ${roleInfo(form.role).label}`, `livello ${form.level} (scala D&D 5e)`, "mostro del bestiario base di D&D 5e se possibile"].filter(Boolean).join(" · ");
      const r = await fetch("/api/genera-boss", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo: form.role === "boss" ? "boss" : "minion", contesto: ctx, evita: monsters.map((m) => m.name).filter(Boolean) }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || "Generazione fallita.");
      set({
        name: data.name || form.name,
        desc: data.description || form.desc,
        hp: data.hp ?? data.maxHp ?? form.hp,
        ac: data.ac ?? form.ac,
        actions: sanitizeActions(data.actions, 1),
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
      imageUrl: src.imageUrl || "", deadImageUrl: src.deadImageUrl || "", facing: src.facing === "right" ? "right" : "left",
      actions: sanitizeActions(src.actions, 1), ...defensesOf(src), source: `wb-${kind}:${src.id}`,
    });
    setShowImport(false);
  };

  if (form) {
    return (
      <div className="sga-card sga-form">
        <h2 className="sga-h2">{form.id ? `✎ ${form.name}` : "Nuovo mostro"}</h2>
        <div className="sga-ai">
          <input className="admin-field-input" value={hint} onChange={(e) => setHint(e.target.value)}
            placeholder='Spunto per l&apos;IA (facoltativo): es. "goblin arciere", "ragno gigante", "salamandra"' />
          <button type="button" className="adm-btn" disabled={busy.gen} onClick={generate}>{busy.gen ? "⏳ Scrivo…" : "✨ Scrivi la scheda con l'IA"}</button>
        </div>
        <div className="sga-row">
          <label className="sga-field"><span>Nome</span>
            <input className="admin-field-input" value={form.name} onChange={(e) => set({ name: e.target.value })} /></label>
          <label className="sga-field sga-field--s"><span>Ruolo</span>
            <select className="admin-field-input" value={form.role} onChange={(e) => set({ role: e.target.value })}>
              {MONSTER_ROLES.map((r) => <option key={r.key} value={r.key}>{r.icon} {r.label}</option>)}
            </select></label>
        </div>
        <p className="sga-hint">{roleInfo(form.role).hint}</p>
        <div className="sga-row">
          {[["level", "Livello", 1, 20], ["hp", "PF", 1, 2000], ["ac", "CA", 5, 30], ["init", "Iniziativa +", -5, 15], ["save", "Tiri salvezza +", -5, 15]].map(([k, l, lo, hi]) => (
            <label key={k} className="sga-field sga-field--xs"><span>{l}</span>
              <input className="admin-field-input" type="number" min={lo} max={hi} value={form[k]} onChange={(e) => set({ [k]: e.target.value })} /></label>
          ))}
        </div>
        <label className="sga-field"><span>Descrizione / aspetto (serve anche all'IA per lo sprite)</span>
          <textarea className="admin-field-input" rows={2} value={form.desc} onChange={(e) => set({ desc: e.target.value })} /></label>

        <h3 className="sga-h3">Dove esce</h3>
        <div className="sga-chips">
          {dungeons.map((d) => {
            const on = (form.dungeons || []).includes(d.key);
            return (
              <button key={d.key} type="button" aria-pressed={on} className={on ? "is-on" : ""}
                onClick={() => set({ dungeons: on ? form.dungeons.filter((k) => k !== d.key) : [...(form.dungeons || []), d.key] })}>
                {d.icon} {d.name}
              </button>
            );
          })}
        </div>

        <ActionsList actions={form.actions} min={1} onChange={(actions) => set({ actions })} title="⚔ Azioni (attacchi, incantesimi, aree, cure…)" />
        <h3 className="sga-h3">Resistenze</h3>
        <DefensesPicker value={form} onChange={(d) => set(d)} />

        <h3 className="sga-h3">Sprite</h3>
        <ImageTonePicker />
        <div className="sga-sprites">
          <SpriteDropzone label="Vivo" icon="👹" value={form.imageUrl} uploading={false} generating={busy.alive}
            onFile={onSpriteFile(false)} onClear={() => set({ imageUrl: "" })} onGenerate={() => genSprite(false)} />
          <SpriteDropzone label="Morto" icon="💀" value={form.deadImageUrl} uploading={false} generating={busy.dead}
            onFile={onSpriteFile(true)} onClear={() => set({ deadImageUrl: "" })} onGenerate={() => genSprite(true)} accent="var(--sangue)" />
        </div>
        <div className="sga-btns">
          {!form.imageUrl && <button type="button" className="adm-btn" disabled={busy.alive} onClick={() => genSprite(false)}>✨ Genera lo sprite</button>}
          {form.imageUrl && !form.deadImageUrl && <button type="button" className="adm-btn" disabled={busy.dead} onClick={() => genSprite(true)}>✨ Genera lo sprite morto</button>}
        </div>
        <FacingPicker value={form.facing} onChange={(facing) => set({ facing })} imageUrl={form.imageUrl} name={form.name} />

        <div className="sga-savebar">
          <button type="button" className="adm-btn adm-btn--gold" disabled={busy.save} onClick={save}>{busy.save ? "Salvo…" : "💾 Salva"}</button>
          <button type="button" className="adm-btn" onClick={() => setForm(null)}>Annulla</button>
          {form.id && <button type="button" className="adm-btn" onClick={duplicate}>⧉ Duplica</button>}
          {form.id && <button type="button" className="adm-btn adm-btn--danger" onClick={remove}>🗑 Elimina</button>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sga-btns">
        <button type="button" className="adm-btn adm-btn--gold" onClick={() => setForm(blankMonster(filter !== "all" && filter !== "none" ? filter : ""))}>＋ Nuovo mostro</button>
        <button type="button" className="adm-btn" aria-pressed={showImport} onClick={() => setShowImport((v) => !v)}>📥 Importa dal World Boss</button>
      </div>
      {showImport && (
        <div className="sga-card sga-import">
          <p className="sga-hint">Copia nome, PF, CA, azioni, resistenze e sprite in un mostro nuovo (poi scegli dungeon e livello e salvi).</p>
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
              {m.imageUrl ? <img src={m.imageUrl} alt="" className={m.facing === "right" ? "" : "mirror"} /> : <span aria-hidden="true">{roleInfo(m.role).icon}</span>}
            </div>
            <div className="sga-mcard-main">
              <b>{m.name}</b>
              <small>{roleInfo(m.role).icon} {roleInfo(m.role).label} · Lv {m.level} · {m.hp} PF · CA {m.ac}</small>
              <small>{(m.actions || []).map((a) => a.name).filter(Boolean).join(" · ") || "nessuna azione"}</small>
              <small className="sga-mcard-d">{(m.dungeons || []).map((k) => dungeons.find((d) => d.key === k)?.icon || "").join(" ") || "⚠ in nessun dungeon"}</small>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
