import React, { useState, useEffect, useMemo } from "react";
import { db, storage } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import DateTimePicker from "../components/DateTimePicker";
import { DMG_TYPE_OPTIONS } from "./worldBossSpells";
import { DAMAGE_TYPES, DAMAGE_TYPE_KEYS, EFFECT_TURNS_DEFAULT, EFFECT_TURNS_MAX } from "./worldBossEffects";
import { resetWorldBossFight } from "../data/worldBossReset";
import "./admin.css";
import "./WorldBossAdmin.css";
import { getImageTone } from "../data/imageTone";
import ImageTonePicker from "../components/ImageTonePicker";
import { deliverBossRewards, deliverySummaryText, MIN_ATTACKS, NO_PARTY } from "../data/worldBossRewardsDelivery";
import BossRewardsEditor, { blankRewards, normalizeRewards, cleanRewards, rewardsSummary } from "./WorldBossRewards";

import { isAdminEmail } from "../utils/roles";

const MIN_ACTIONS = 2;
const MAX_ACTIONS = 5;

const ACTION_TYPES = [
  { value: "attack",     label: "⚔ Attacco",     hint: "Tira d20 + bonus vs CA. Danni: N×d." },
  { value: "heal",       label: "💖 Cura",        hint: "Cura il Boss di NdT + bonus HP." },
  { value: "buff_ca",    label: "🛡 +CA",        hint: "Alza la CA del Boss del bonus indicato per N turni." },
  { value: "buff_adv",   label: "⬆ Vantaggio",   hint: "Vantaggio sugli attacchi del Boss per N turni." },
  { value: "debuff_dis", label: "⬇ Svantaggio",  hint: "Svantaggio ai tiri dei bersagli per N turni." },
];

// AoE shapes (mirrors battleModel.spellAoE geometry) + saving-throw abilities.
const AOE_SHAPES = [
  { value: "single", icon: "🎯", label: "Singolo" },
  { value: "sphere", icon: "⭕", label: "Cerchio" },
  { value: "square", icon: "⬛", label: "Quadrato" },
  { value: "line",   icon: "➖", label: "Linea" },
  { value: "cone",   icon: "🔺", label: "Cono" },
];
const SAVES = [
  { v: "dex", l: "DES" }, { v: "con", l: "COS" }, { v: "wis", l: "SAG" },
  { v: "str", l: "FOR" }, { v: "int", l: "INT" }, { v: "cha", l: "CAR" },
];

const blankAction = (i = 0) => ({
  type: "attack",
  name: "",
  diceNum: 1,
  diceType: i === 1 ? "d8" : "d6",
  bonus: 0,
  acBonus: 2,
  durationTurns: EFFECT_TURNS_DEFAULT, // turni che durano +CA / vantaggio / svantaggio
  range: 1,            // gittata in tile (raggio d'azione per colpire/mirare)
  aoeShape: "single",  // single | sphere | square | line | cone
  aoeSize: 1,          // raggio (cerchio/quadrato) o lunghezza (linea/cono)
  dmgType: "",         // tipo di danno → effetto/tinta a schermo (vedi DMG_TYPE_OPTIONS); "" = auto dal nome
  hitMode: "hit",     // "hit" = tiro per colpire vs CA · "save" = gli eroi tirano un TS (in automatico)
  saveAbility: "dex",  // TS che i bersagli tirano (modalità "save" e aree)
  saveDC: 13,          // CD del TS (modalità "save")
  halfOnSave: true,    // metà danni se superano il TS
});

// A saved minion: simplified boss — name, HP, CA, attacks + alive/dead sprites.
const blankMinion = () => ({ name: "", hp: 12, ac: 11, imageUrl: "", deadImageUrl: "", facing: "left", actions: [blankAction(0)], resistances: [], vulnerabilities: [], immunities: [] });

const initialBossState = {
  name: "",
  maxHp: "",
  ac: "",
  rewardsData: blankRewards(),
  penalties: "",
  imageUrl: "",
  deadImageUrl: "",
  facing: "left", // verso del disegno: "left" = lo sprite guarda a sinistra → in battaglia viene specchiato
  description: "",
  gradoSfida: "",
  expiryDate: "",
  actions: [blankAction(0), blankAction(1)],
  resistances: [], vulnerabilities: [], immunities: [],
};

const DICE = ["d4", "d6", "d8", "d10", "d12", "d20"];

const ACTION_PLACEHOLDERS = [
  "Artiglio del Vuoto",
  "Grido della Fine",
  "Sguardo Pietrificante",
  "Maledizione Nera",
  "Frantumare Anima",
];

const normalizeBossActions = (boss) => {
  if (Array.isArray(boss?.actions) && boss.actions.length >= MIN_ACTIONS) {
    return boss.actions.map((a) => ({ ...blankAction(0), ...a }));
  }
  const legacy = [boss?.action1, boss?.action2, boss?.action3, boss?.action4, boss?.action5]
    .filter((a) => a && (a.name || a.diceType));
  const arr = legacy.map((a) => ({ ...blankAction(0), ...a }));
  while (arr.length < MIN_ACTIONS) arr.push(blankAction(arr.length));
  return arr.slice(0, MAX_ACTIONS);
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ──────────────────────────────────────────────────────────────
   AI helpers — generazione (boss/minion/sprite) via endpoint Vercel
   ────────────────────────────────────────────────────────────── */
const VALID_TYPES = ACTION_TYPES.map((t) => t.value);
const VALID_DICE = DICE;
const VALID_SHAPES = AOE_SHAPES.map((s) => s.value);
const VALID_DMG = DMG_TYPE_OPTIONS.map((d) => d.value);
const VALID_SAVE = SAVES.map((s) => s.v);

// Normalizza un'azione generata dall'IA contro le enumerazioni valide, così il
// form resta coerente anche se il modello inventa un valore fuori lista.
const sanitizeAction = (a = {}, i = 0) => {
  const base = blankAction(i);
  return {
    ...base,
    type: VALID_TYPES.includes(a.type) ? a.type : "attack",
    name: String(a.name || "").slice(0, 50),
    diceNum: clamp(parseInt(a.diceNum) || 1, 1, 12),
    diceType: VALID_DICE.includes(a.diceType) ? a.diceType : base.diceType,
    bonus: clamp(parseInt(a.bonus) || 0, -5, 30),
    acBonus: clamp(parseInt(a.acBonus) || 2, 1, 10),
    durationTurns: clamp(parseInt(a.durationTurns) || EFFECT_TURNS_DEFAULT, 1, EFFECT_TURNS_MAX),
    range: clamp(parseInt(a.range) || 1, 1, 12),
    aoeShape: VALID_SHAPES.includes(a.aoeShape) ? a.aoeShape : "single",
    aoeSize: clamp(parseInt(a.aoeSize) || 1, 1, 6),
    dmgType: VALID_DMG.includes(a.dmgType) ? a.dmgType : "",
    saveAbility: VALID_SAVE.includes(a.saveAbility) ? a.saveAbility : "dex",
    halfOnSave: a.halfOnSave !== false,
    hitMode: a.hitMode === "save" ? "save" : "hit",
    saveDC: clamp(parseInt(a.saveDC) || 13, 5, 30),
  };
};

const sanitizeActions = (arr, min) => {
  const out = (Array.isArray(arr) ? arr : []).map(sanitizeAction).slice(0, MAX_ACTIONS);
  while (out.length < min) out.push(blankAction(out.length));
  return out;
};

// Prompt per lo sprite pixel-art: soggetto SOLO, su fondo magenta uniforme che
// poi rimuoviamo lato client (chroma key). Niente sfondo/scena/testo.
// Lo sprite "morto" si disegna PARTENDO DA QUELLO VIVO (passato come immagine
// di riferimento): senza, l'IA inventava un'altra creatura (2026-10-03).
// Due forme: "corpse" = la stessa creatura stesa a terra, "tomb" = una tomba
// che porta i suoi segni (arma, elmo, colori).
const pixelArtPrompt = (name, desc, dead, { deadStyle = "corpse", withRef = false } = {}) => {
  const bg = "CRITICAL: render the subject ALONE and centered on a SOLID UNIFORM background of pure magenta (#FF00FF, RGB 255,0,255). The background MUST be one flat magenta color — no gradient, no ground shadow, no scenery. No text, no frame, no border. Only the subject on flat magenta.";
  const style = "Style: crisp 16-bit pixel art, limited palette, clean hard outlines, NO anti-aliasing, NO blur.";
  const subject = `Subject: ${name || "fantasy monster"}.${desc ? ` Description: ${desc}.` : ""}`;
  if (!dead) return `Pixel art sprite of a single fantasy creature or character for a tactical RPG game.
${subject}
Pose: a SINGLE idle standing pose, full body, three-quarter view facing the viewer.
${style}
${bg}`;
  const refLine = withRef
    ? "The attached image is the LIVING sprite of this EXACT creature. Keep it the SAME individual: same species, anatomy, body shape, colors and palette, armor, clothes, weapons and accessories, same pixel-art style, same pixel density and roughly the same scale. Do NOT invent a different creature."
    : subject;
  const pose = deadStyle === "tomb"
    ? "Draw its GRAVE instead of the creature: a single small tombstone or burial cairn with a low mound of earth, decorated with this creature's signature items (its weapon, helmet, mask, horns or a scrap of its clothing resting on or against the stone) and using the same color palette, so it is obvious whose grave it is. No living creature in the image."
    : "Draw the SAME creature DEAD: collapsed and lying flat on its side or back on the ground, eyes closed or empty, limbs limp, its weapon dropped beside it. Horizontal composition (wider than tall). It must be clearly recognizable as the same creature, just defeated.";
  return `Pixel art sprite for a tactical RPG game: the defeated form of ${name || "a fantasy monster"}.
${refLine}
${pose}
${style}
${bg}`;
};

// Rimuove lo sfondo a tinta unita (magenta) con un flood-fill dai bordi: così
// non cancella eventuali pixel dello stesso colore "intrappolati" nel soggetto.
// Ridimensiona a pixel-art (nearest neighbor) e restituisce un Blob PNG.
const dataUrlToTransparentBlob = (dataUrl) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const MAX = 256;
    const scale = img.width > MAX ? MAX / img.width : 1;
    const w = Math.round(img.width * scale);
    const hh = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = hh;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w, hh);

    const imgData = ctx.getImageData(0, 0, w, hh);
    const d = imgData.data;
    const cornerAt = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const corners = [cornerAt(0, 0), cornerAt(w - 1, 0), cornerAt(0, hh - 1), cornerAt(w - 1, hh - 1)];
    const ref = [0, 1, 2].map((k) => Math.round(corners.reduce((a, c) => a + c[k], 0) / corners.length));
    const TOL2 = 110 * 110;
    const match = (p) => {
      const dr = d[p * 4] - ref[0], dg = d[p * 4 + 1] - ref[1], db = d[p * 4 + 2] - ref[2];
      return dr * dr + dg * dg + db * db <= TOL2;
    };
    const visited = new Uint8Array(w * hh);
    const stack = [];
    const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= hh) return; const p = y * w + x; if (!visited[p]) stack.push(p); };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, hh - 1); }
    for (let y = 0; y < hh; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const p = stack.pop();
      if (visited[p]) continue;
      visited[p] = 1;
      if (!match(p)) continue;
      d[p * 4 + 3] = 0;                          // rendi trasparente
      const x = p % w, y = (p / w) | 0;
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
    ctx.putImageData(imgData, 0, 0);
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob fallito"))), "image/png");
  };
  img.onerror = () => reject(new Error("immagine non caricabile"));
  img.src = dataUrl;
});

/* ──────────────────────────────────────────────────────────────
   ActionEditor — un'azione in una scheda compatta (2026-10-21):
   tipo + nome in testa, dadi e tipo di danno su una riga, il TS
   solo se serve. La spiegazione del tipo sta nel title del select.
   ────────────────────────────────────────────────────────────── */
const TIMED_TYPES = ["buff_ca", "buff_adv", "debuff_dis"];

/* Resistenze / vulnerabilità / immunità (2026-10-24): un tocco sul tipo di danno
   cicla — · ½ resiste · ×2 vulnerabile · 🚫 immune. Valgono contro i danni degli eroi
   nel fight (worldBossEffects.applyResist). */
const DEF_STATES = [
  { k: null, tag: "", title: "normale" },
  { k: "resistances", tag: "½", title: "resiste: metà danni" },
  { k: "vulnerabilities", tag: "×2", title: "vulnerabile: danni doppi" },
  { k: "immunities", tag: "🚫", title: "immune: nessun danno" },
];
const DEF_KEYS = ["resistances", "vulnerabilities", "immunities"];
const cleanDefList = (v) => (Array.isArray(v) ? v.filter((k) => DAMAGE_TYPE_KEYS.includes(k)) : []);
const defensesOf = (o) => Object.fromEntries(DEF_KEYS.map((k) => [k, cleanDefList(o?.[k])]));
const DefensesPicker = ({ value, onChange }) => {
  const stateOf = (key) => DEF_KEYS.find((k) => (value?.[k] || []).includes(key)) || null;
  const cycle = (key) => {
    const cur = stateOf(key);
    const next = DEF_STATES[(DEF_STATES.findIndex((st) => st.k === cur) + 1) % DEF_STATES.length].k;
    const out = defensesOf(value);
    DEF_KEYS.forEach((k) => { out[k] = out[k].filter((x) => x !== key); });
    if (next) out[next] = [...out[next], key];
    onChange(out);
  };
  return (
    <div className="wb-defs">
      <div className="wb-defs-grid">
        {DAMAGE_TYPES.map((d) => {
          const st = DEF_STATES.find((x) => x.k === stateOf(d.key));
          return (
            <button key={d.key} type="button" className={`wb-def ${st.k ? "wb-def--" + st.k : ""}`}
              aria-label={`${d.label}: ${st.title}`} title={`${d.label}: ${st.title} (tocca per cambiare)`}
              onClick={() => cycle(d.key)}>
              <span aria-hidden="true">{d.icon}</span> {d.label}{st.tag && <b>{st.tag}</b>}
            </button>
          );
        })}
      </div>
      <p className="wb-defs-hint">Tocca un tipo di danno: <b>½</b> resiste · <b>×2</b> vulnerabile · <b>🚫</b> immune · di nuovo = normale.</p>
    </div>
  );
};

const ActionEditor = ({ action, idx, onChange, onRemove, canRemove }) => {
  const type = action.type || "attack";
  const meta = ACTION_TYPES.find((t) => t.value === type) || ACTION_TYPES[0];
  const isSave = action.hitMode === "save" || (action.aoeShape && action.aoeShape !== "single");
  return (
    <div className={`wb-action-block wb-action-block--${type}`}>
      <div className="wb-act-head">
        <span className="wb-act-n">{idx + 1}</span>
        <select className="admin-field-input wb-act-type" value={type} title={meta.hint}
          onChange={(e) => onChange({ type: e.target.value })}>
          {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input className="admin-field-input wb-act-name"
          placeholder={ACTION_PLACEHOLDERS[idx] || `Azione ${idx + 1}`}
          value={action.name || ""} onChange={(e) => onChange({ name: e.target.value })} />
        <button type="button" className="wb-remove-action-btn" onClick={onRemove} disabled={!canRemove}
          title={canRemove ? "Rimuovi" : `Minimo ${MIN_ACTIONS} azioni`}>✕</button>
      </div>

      {(type === "attack" || type === "heal") && (
        <div className="wb-act-row">
          <label className="wb-mini"><span>Dadi</span>
            <input className="admin-field-input" type="number" min="1" value={action.diceNum ?? 1} onChange={(e) => onChange({ diceNum: e.target.value })} />
          </label>
          <label className="wb-mini"><span>Dado</span>
            <select className="admin-field-input" value={action.diceType || "d6"} onChange={(e) => onChange({ diceType: e.target.value })}>
              {DICE.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="wb-mini"><span>{type === "attack" ? "Al colpire" : "Bonus"}</span>
            <input className="admin-field-input" type="number" value={action.bonus ?? 0} onChange={(e) => onChange({ bonus: e.target.value })} />
          </label>
          {type === "attack" && (
            <label className="wb-mini wb-mini--wide"><span>Tipo di danno</span>
              <select className="admin-field-input" value={action.dmgType || ""} onChange={(e) => onChange({ dmgType: e.target.value })}
                title="Decide l'effetto a schermo. Auto = dal nome dell'azione.">
                {DMG_TYPE_OPTIONS.map((el) => <option key={el.value} value={el.value}>{el.label}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      {type === "attack" && (
        <div className="wb-act-row">
          <label className="wb-mini wb-mini--wide"><span>Come colpisce</span>
            <select className="admin-field-input" value={isSave ? "save" : "hit"}
              onChange={(e) => onChange(e.target.value === "hit" ? { hitMode: "hit", aoeShape: "single" } : { hitMode: "save" })}
              title="Tiro salvezza = gli eroi colpiti tirano da soli il TS contro la CD.">
              <option value="hit">Tiro per colpire (vs CA)</option>
              <option value="save">Tiro salvezza degli eroi</option>
            </select>
          </label>
          {isSave && (<>
            <label className="wb-mini"><span>TS</span>
              <select className="admin-field-input" value={action.saveAbility || "dex"} onChange={(e) => onChange({ saveAbility: e.target.value })}>
                {SAVES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </label>
            <label className="wb-mini"><span>CD</span>
              <input className="admin-field-input" type="number" min="5" max="30" value={action.saveDC ?? 13} onChange={(e) => onChange({ saveDC: e.target.value })} />
            </label>
            <label className="wb-half">
              <input type="checkbox" checked={action.halfOnSave !== false} onChange={(e) => onChange({ halfOnSave: e.target.checked })} /> metà se superato
            </label>
          </>)}
        </div>
      )}

      {TIMED_TYPES.includes(type) && (
        <div className="wb-act-row">
          {type === "buff_ca" && (
            <label className="wb-mini"><span>+CA</span>
              <input className="admin-field-input" type="number" value={action.acBonus ?? 2} onChange={(e) => onChange({ acBonus: e.target.value })} />
            </label>
          )}
          <label className="wb-mini" title="Quanti turni dura l'effetto, poi scade da solo.">
            <span>Turni</span>
            <input className="admin-field-input" type="number" min="1" max={EFFECT_TURNS_MAX}
              value={action.durationTurns ?? EFFECT_TURNS_DEFAULT} onChange={(e) => onChange({ durationTurns: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
};

/* Lista di azioni con "+ Aggiungi" (boss e minion). */
const ActionsList = ({ actions, min, onChange, title = "⚔ Azioni" }) => {
  const update = (i, patch) => onChange(actions.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  return (
    <div className="wb-actions-section">
      <div className="wb-actions-head">
        <label>{title} <small>{actions.length}/{MAX_ACTIONS}</small></label>
        <button type="button" className="wb-add-action-btn" disabled={actions.length >= MAX_ACTIONS}
          onClick={() => onChange([...actions, blankAction(actions.length)])}>+ Aggiungi</button>
      </div>
      <div className="wb-actions-grid">
        {actions.map((a, idx) => (
          <ActionEditor key={idx} action={a} idx={idx}
            onChange={(patch) => update(idx, patch)}
            onRemove={() => actions.length > min && onChange(actions.filter((_, k) => k !== idx))}
            canRemove={actions.length > min} />
        ))}
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   SpriteDropzone — drag & drop slot for a boss sprite
   ────────────────────────────────────────────────────────────── */
// Verso dello sprite. In battaglia gli eroi stanno a DESTRA: se il disegno guarda a sinistra
// (com'è quasi sempre per le immagini generate dall'IA) la pagina lo specchia; se guarda già a
// destra va lasciato com'è. L'anteprima mostra ESATTAMENTE come apparirà in scena.
const FacingPicker = ({ value, onChange, imageUrl, name }) => {
  const facing = value === "right" ? "right" : "left";
  return (
    <div className="wb-facing">
      <div className="wb-facing-head">
        <label>Verso in battaglia</label>
        <small>gli eroi stanno a destra: il nemico deve guardarli</small>
      </div>
      <div className="wb-facing-row">
        <div className="wb-facing-opts" role="radiogroup" aria-label="Verso dello sprite">
          <button type="button" role="radio" aria-checked={facing === "left"}
            className={`wb-facing-opt${facing === "left" ? " on" : ""}`} onClick={() => onChange("left")}>
            <span className="wb-facing-ico">🪞</span>
            <span><b>Specchia</b><i>il disegno guarda a sinistra</i></span>
          </button>
          <button type="button" role="radio" aria-checked={facing === "right"}
            className={`wb-facing-opt${facing === "right" ? " on" : ""}`} onClick={() => onChange("right")}>
            <span className="wb-facing-ico">🖼</span>
            <span><b>Lascia com'è</b><i>guarda già a destra</i></span>
          </button>
        </div>
        <div className="wb-facing-preview" title="Anteprima: così apparirà in scena">
          {imageUrl
            ? <img src={imageUrl} alt={name || "sprite"} className={`wb-facing-img${facing === "left" ? " mirror" : ""}`} />
            : <span className="wb-facing-empty">nessuno sprite</span>}
          <span className="wb-facing-heroes" aria-hidden="true">⟶ eroi</span>
        </div>
      </div>
    </div>
  );
};

const blobToDataUrl = (blob) => new Promise((resolve) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result || ""));
  fr.onerror = () => resolve("");
  fr.readAsDataURL(blob);
});

// Come l'IA disegna lo sprite "morto": la stessa creatura stesa o la sua tomba.
// Bottoni con aria-pressed (mai role="tab": covo.css ci metterebbe le rune).
const DeadStylePicker = ({ value, onChange }) => (
  <div className="wb-deadstyle" aria-label="Forma dello sprite morto generato">
    {[["corpse", "💀 Steso a terra"], ["tomb", "🪦 Tomba"]].map(([k, l]) => (
      <button key={k} type="button" aria-pressed={value === k} className={value === k ? "is-on" : ""} onClick={() => onChange(k)}>{l}</button>
    ))}
  </div>
);

const SpriteDropzone = ({ label, icon, value, uploading, onFile, onClear, onGenerate, generating, accent = "var(--oro)" }) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = React.useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };
  const handlePick = (e) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = "";
  };

  const busy = uploading || generating;

  return (
    <div
      className={`wb-drop ${dragOver ? "drag" : ""} ${busy ? "loading" : ""} ${value ? "filled" : ""}`}
      style={{ "--wb-accent": accent }}
      onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !busy && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePick}
      />
      {busy ? (
        <div className="wb-drop-state">
          <span className="wb-drop-spinner" />
          <strong>{generating ? "L'IA disegna…" : "Forgia in corso…"}</strong>
        </div>
      ) : value ? (
        <>
          <img src={value} alt={label} className="wb-drop-preview" />
          <div className="wb-drop-overlay">
            <span className="wb-drop-overlay-label">{icon} Cambia</span>
            {onGenerate && (
              <button
                type="button"
                className="wb-drop-gen"
                onClick={(e) => { e.stopPropagation(); onGenerate(); }}
              >
                ✨ Rigenera
              </button>
            )}
            {onClear && (
              <button
                type="button"
                className="wb-drop-clear"
                onClick={(e) => { e.stopPropagation(); onClear(); }}
              >
                ✕ Rimuovi
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="wb-drop-state">
          <span className="wb-drop-icon">{icon}</span>
          <strong>{label}</strong>
          <small>Trascina o clicca</small>
          {onGenerate && (
            <button
              type="button"
              className="wb-drop-gen"
              onClick={(e) => { e.stopPropagation(); onGenerate(); }}
            >
              ✨ Genera pixel art
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   Pagina (2026-10-21): tre pieghe — Bestiario · Forgia · Minion —
   invece di un muro unico. Creare e modificare un boss usano la
   STESSA forgia a tutta larghezza (prima la modifica si apriva dentro
   la carta stretta del bestiario).
   ────────────────────────────────────────────────────────────── */
export default function WorldBossAdmin() {
  const { currentUser } = useAuth();
  const [bosses, setBosses] = useState([]);
  const [tab, setTab] = useState("bestiario");
  const [showHidden, setShowHidden] = useState(false); // mostra anche i boss disattivati
  const [mapOpenId, setMapOpenId] = useState(null);    // carta del bestiario con la mappa aperta
  const [form, setForm] = useState(initialBossState);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadState, setUploadState] = useState({}); // { alive, dead, minionAlive, minionDead, reward }

  // ── Minion builder (reusable mooks: name, HP, CA, attacks) ──
  const [minions, setMinions] = useState([]);                 // saved minion templates
  const [minionForm, setMinionForm] = useState(blankMinion());
  const [editingMinionId, setEditingMinionId] = useState(null);

  // ── Generazione IA (testo + sprite) ──
  const [genState, setGenState] = useState({}); // spinner per slot: { boss, minion, genAlive, ... }
  // Forma dello sprite "morto" generato dall'IA: la creatura stesa o la sua tomba.
  const [deadStyle, setDeadStyle] = useState("corpse");
  const [bossSpunto, setBossSpunto] = useState("");     // spunto facoltativo per il boss IA
  const [minionSpunto, setMinionSpunto] = useState(""); // spunto facoltativo per il minion IA

  useEffect(() => {
    const unsubBoss = onSnapshot(collection(db, "bosses"), (snap) => {
      setBosses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubBoss();
  }, []);

  // Attacchi per boss (chi ne ha fatti ≥ MIN_ATTACKS prende i premi).
  const [attackCounts, setAttackCounts] = useState({});
  const [delivering, setDelivering] = useState(null);
  const [lootOpenId, setLootOpenId] = useState(null);
  useEffect(() => onSnapshot(doc(db, "battle_meta", "turn_tracker"),
    (snap) => setAttackCounts(snap.data()?.attackCounts || {})), []);

  const consegnaPremi = async (boss) => {
    const n = Object.values(attackCounts[boss.id] || {}).filter((v) => (Number(v) || 0) >= MIN_ATTACKS).length;
    if (!window.confirm(`Consegnare i premi di "${boss.name}" ai ${n} eroi che lo hanno attaccato almeno ${MIN_ATTACKS} volte?

PE e monete vanno nella coda di Foundry, le Corone sul sito, ogni oggetto a un eroe a caso per gruppo.`)) return;
    setDelivering(boss.id);
    try {
      const res = await deliverBossRewards(boss.id, currentUser?.email || "");
      if (res.nothing) alert("Questo boss non ha premi impostati: aggiungili con ✎ Modifica.");
      else if (res.already) alert("Premi già consegnati.");
      else { alert("✅ " + deliverySummaryText(res)); setLootOpenId(boss.id); }
    } catch (e) {
      alert("Consegna fallita: " + (e.message || e));
    } finally {
      setDelivering(null);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "minions"), (snap) =>
      setMinions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  /**
   * Resize image in canvas (preserves pixel art) → upload to Firebase Storage → return URL
   */
  const uploadSprite = async (file, slotKey) => {
    if (!file?.type?.startsWith("image/")) {
      alert("Seleziona un file immagine valido.");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Immagine troppo grande (max 5MB).");
      return null;
    }
    setUploadState((s) => ({ ...s, [slotKey]: true }));
    try {
      const blob = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const MAX = 512;
            const scale = img.width > MAX ? MAX / img.width : 1;
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((b) => b ? resolve(b) : reject(new Error("toBlob fallito")), "image/png");
          };
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const safe = (file.name || "sprite").replace(/[^a-z0-9._-]/gi, "_").slice(0, 30);
      const path = `boss-sprites/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}.png`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, blob, { contentType: "image/png" });
      return await getDownloadURL(ref);
    } catch (err) {
      console.error("Upload sprite fallito:", err);
      alert("Errore upload: " + (err.message || err.code));
      return null;
    } finally {
      setUploadState((s) => ({ ...s, [slotKey]: false }));
    }
  };

  const cleanupStorageUrl = async (url) => {
    if (!url || !url.includes("firebasestorage.googleapis.com")) return;
    try { await deleteObject(storageRef(storage, url)); }
    catch (err) { console.warn("Storage cleanup skipped:", err.code); }
  };

  /* ── Generazione IA ── */
  const uploadBlobToStorage = async (blob) => {
    const path = `boss-sprites/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-ai.png`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, blob, { contentType: "image/png" });
    return await getDownloadURL(ref);
  };

  // Genera uno sprite pixel-art (sfondo rimosso) e lo applia via `apply(url)`.
  // `ref` = lo sprite VIVO (data URL o URL dello Storage): il morto lo copia.
  // Restituisce { url, ref } così chi genera vivo+morto passa il primo al secondo.
  const generateSprite = async ({ name, desc, dead, slotKey, apply, ref = "" }) => {
    if (!name?.trim()) { alert("Dai prima un nome al soggetto, così l'IA sa cosa disegnare."); return; }
    setGenState((s) => ({ ...s, [slotKey]: true }));
    try {
      const r = await fetch("/api/genera-immagine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: pixelArtPrompt(name, desc, dead, { deadStyle, withRef: !!(dead && ref) }),
          ...(dead && ref ? { refs: [ref] } : {}),
          tono: getImageTone(),
        }),
      });
      const data = await r.json();
      if (!r.ok || data.error || !data.immagine) throw new Error(data.error || "Nessuna immagine ricevuta.");
      const blob = await dataUrlToTransparentBlob(data.immagine);
      const url = await uploadBlobToStorage(blob);
      apply(url);
      return { url, ref: await blobToDataUrl(blob) };
    } catch (e) {
      alert("Generazione sprite fallita: " + (e.message || e));
      return null;
    } finally {
      setGenState((s) => ({ ...s, [slotKey]: false }));
    }
  };

  // Genera un BOSS completo e riempie la Forgia (tutto editabile).
  const generaBoss = async () => {
    setGenState((s) => ({ ...s, boss: true }));
    try {
      const r = await fetch("/api/genera-boss", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo: "boss", contesto: bossSpunto || form.name || "", evita: bosses.map((b) => b.name).filter(Boolean) }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || "Generazione fallita.");
      setForm((b) => ({
        ...b,
        name: data.name || b.name,
        maxHp: data.maxHp != null ? String(data.maxHp) : b.maxHp,
        ac: data.ac != null ? String(data.ac) : b.ac,
        gradoSfida: data.gradoSfida != null ? String(data.gradoSfida) : b.gradoSfida,
        description: data.description || b.description,
        // L'IA scrive il bottino a parole: finisce nelle note, i premi veri li decide il Master.
        rewardsData: data.rewards ? { ...b.rewardsData, note: data.rewards } : b.rewardsData,
        penalties: data.penalties || b.penalties,
        actions: sanitizeActions(data.actions, MIN_ACTIONS),
      }));
      // Genera anche gli sprite pixel-art (vivo + tomba) col nome/descrizione appena creati.
      // In fila: il morto parte dal vivo appena disegnato.
      (async () => {
        const alive = await generateSprite({
          name: data.name, desc: data.description, dead: false, slotKey: "genAlive",
          apply: (url) => setForm((b) => ({ ...b, imageUrl: url })),
        });
        await generateSprite({
          name: data.name, desc: data.description, dead: true, slotKey: "genDead", ref: alive?.ref || "",
          apply: (url) => setForm((b) => ({ ...b, deadImageUrl: url })),
        });
      })();
    } catch (e) {
      alert("Genera boss: " + (e.message || e));
    } finally {
      setGenState((s) => ({ ...s, boss: false }));
    }
  };

  // Genera un MINION completo e riempie il form della Caserma.
  const generaMinion = async () => {
    setGenState((s) => ({ ...s, minion: true }));
    try {
      const r = await fetch("/api/genera-boss", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo: "minion", contesto: minionSpunto || minionForm.name || "", evita: minions.map((m) => m.name).filter(Boolean) }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || "Generazione fallita.");
      setMinionForm((m) => ({
        ...m,
        name: data.name || m.name,
        hp: data.hp != null ? data.hp : m.hp,
        ac: data.ac != null ? data.ac : m.ac,
        actions: sanitizeActions(data.actions, 1),
      }));
      // Genera anche gli sprite pixel-art (vivo + tomba) del minion.
      // In fila: il morto parte dal vivo appena disegnato.
      (async () => {
        const alive = await generateSprite({
          name: data.name, desc: "", dead: false, slotKey: "genMinionAlive",
          apply: (url) => setMinionForm((m) => ({ ...m, imageUrl: url })),
        });
        await generateSprite({
          name: data.name, desc: "", dead: true, slotKey: "genMinionDead", ref: alive?.ref || "",
          apply: (url) => setMinionForm((m) => ({ ...m, deadImageUrl: url })),
        });
      })();
    } catch (e) {
      alert("Genera minion: " + (e.message || e));
    } finally {
      setGenState((s) => ({ ...s, minion: false }));
    }
  };

  /* ── Sprite della Forgia (nuovo o in modifica, stesso form) ── */
  const onFormSprite = (key, slot) => async (file) => {
    const url = await uploadSprite(file, slot);
    if (url) {
      if (form[key]) cleanupStorageUrl(form[key]);
      setForm((b) => ({ ...b, [key]: url }));
    }
  };

  /* ── Minion builder handlers ── */
  const onMinionAlive = async (file) => {
    const url = await uploadSprite(file, "minionAlive");
    if (url) {
      if (minionForm.imageUrl) cleanupStorageUrl(minionForm.imageUrl);
      setMinionForm((m) => ({ ...m, imageUrl: url }));
    }
  };
  const onMinionDead = async (file) => {
    const url = await uploadSprite(file, "minionDead");
    if (url) {
      if (minionForm.deadImageUrl) cleanupStorageUrl(minionForm.deadImageUrl);
      setMinionForm((m) => ({ ...m, deadImageUrl: url }));
    }
  };
  const editMinion = (m) => {
    setEditingMinionId(m.id);
    setMinionForm({
      name: m.name || "", hp: m.hp ?? 12, ac: m.ac ?? 11,
      imageUrl: m.imageUrl || "", deadImageUrl: m.deadImageUrl || "",
      facing: m.facing === "right" ? "right" : "left",
      actions: m.actions?.length ? m.actions.map((a) => ({ ...blankAction(0), ...a })) : [blankAction(0)],
      ...defensesOf(m),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancelMinionEdit = () => { setEditingMinionId(null); setMinionForm(blankMinion()); };
  const saveMinion = async (e) => {
    e?.preventDefault?.();
    if (uploadState.minionAlive || uploadState.minionDead) return;
    const payload = {
      name: minionForm.name?.trim() || "Minion",
      hp: parseInt(minionForm.hp) || 1,
      ac: parseInt(minionForm.ac) || 10,
      imageUrl: minionForm.imageUrl || "",
      deadImageUrl: minionForm.deadImageUrl || "",
      facing: minionForm.facing === "right" ? "right" : "left",
      actions: minionForm.actions,
      ...defensesOf(minionForm),
      updatedAt: serverTimestamp(),
    };
    try {
      if (editingMinionId) await updateDoc(doc(db, "minions", editingMinionId), payload);
      else await addDoc(collection(db, "minions"), { ...payload, isActive: false, createdAt: serverTimestamp() });
      cancelMinionEdit();
    } catch (err) {
      alert("Errore salvataggio minion: " + err.message);
    }
  };
  const toggleMinion = (m) => updateDoc(doc(db, "minions", m.id), { isActive: !m.isActive });
  const deleteMinion = async (m) => {
    if (!window.confirm(`Eliminare il minion "${m.name}"?`)) return;
    await Promise.all([cleanupStorageUrl(m.imageUrl), cleanupStorageUrl(m.deadImageUrl)]);
    await deleteDoc(doc(db, "minions", m.id));
    if (editingMinionId === m.id) cancelMinionEdit();
  };

  const updateBossLocation = async (e, bossId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    await updateDoc(doc(db, "bosses", bossId), {
      mapX: parseFloat(xPercent.toFixed(2)),
      mapY: parseFloat(yPercent.toFixed(2)),
    });
  };

  /* ── Forgia: nuovo boss o modifica di uno esistente ── */
  const newForge = () => { setEditingId(null); setForm(initialBossState); setTab("forgia"); };
  const startEdit = (boss) => {
    setEditingId(boss.id);
    setForm({
      ...initialBossState,
      ...boss,
      maxHp: boss.maxHp ?? "",
      ac: boss.ac ?? "",
      hp: boss.hp ?? "",
      actions: normalizeBossActions(boss),
      rewardsData: normalizeRewards(boss),
      ...defensesOf(boss),
    });
    setTab("forgia");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancelEdit = () => { setEditingId(null); setForm(initialBossState); setTab("bestiario"); };

  const saveBoss = async (e) => {
    e.preventDefault();
    if (uploadState.alive || uploadState.dead || saving) return;
    const maxHp = parseInt(form.maxHp) || 100;
    const base = {
      name: form.name.trim(),
      maxHp,
      ac: parseInt(form.ac) || 10,
      gradoSfida: form.gradoSfida || "",
      description: form.description || "",
      penalties: form.penalties || "",
      imageUrl: form.imageUrl || "",
      deadImageUrl: form.deadImageUrl || "",
      facing: form.facing === "right" ? "right" : "left",
      expiryDate: form.expiryDate || "",
      actions: form.actions,
      ...defensesOf(form),
      rewardsData: cleanRewards(form.rewardsData),
      rewards: rewardsSummary(form.rewardsData),
    };
    setSaving(true);
    try {
      if (editingId) {
        const hp = parseInt(form.hp);
        await updateDoc(doc(db, "bosses", editingId), {
          ...base,
          hp: Number.isFinite(hp) ? Math.min(hp, maxHp) : maxHp,
          // Campi che il form non usa più: le vecchie azioni a slot e la taglia (mappa tattica dismessa).
          action1: deleteField(), action2: deleteField(), action3: deleteField(),
          action4: deleteField(), action5: deleteField(), size: deleteField(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "bosses"), {
          ...base, hp: maxHp, isActive: false, mapX: 50, mapY: 50, createdAt: serverTimestamp(),
        });
        setShowHidden(true); // il nuovo nasce nascosto: fallo vedere nel bestiario
      }
      setEditingId(null);
      setForm(initialBossState);
      setTab("bestiario");
    } catch (err) {
      console.error(err);
      alert("Errore salvataggio: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Cambiare boss = battaglia nuova: minion evocati, turni, log e strascichi
  // sugli eroi si azzerano (prima restavano le tombe dei servi del boss vecchio).
  const toggleBoss = async (boss) => {
    const waking = !boss.isActive;
    const ok = window.confirm(waking
      ? `Risvegliare "${boss.name}" per una battaglia NUOVA?

Si azzera il fight: via i minion evocati, turni da capo, log svuotato, scudi e buff degli eroi tolti, e ${boss.name} torna a PV pieni.`
      : `Nascondere "${boss.name}"?

Si azzera anche il fight: via i minion evocati (e le loro tombe), turni da capo, log svuotato, scudi e buff degli eroi tolti.`);
    if (!ok) return;
    try {
      await updateDoc(doc(db, "bosses", boss.id), { isActive: waking });
      await resetWorldBossFight({ boss: waking ? boss : null });
    } catch (err) {
      alert("Errore: " + (err.message || err));
    }
  };

  const handleDeleteBoss = async (boss) => {
    if (!window.confirm(`Eliminare "${boss.name}"? L'azione è irreversibile.${boss.isActive ? "\n\nEra attivo: si azzera anche il fight (minion evocati, turni, log)." : ""}`)) return;
    try {
      await Promise.all([
        cleanupStorageUrl(boss.imageUrl),
        cleanupStorageUrl(boss.deadImageUrl),
      ]);
      await deleteDoc(doc(db, "bosses", boss.id));
      if (boss.isActive) await resetWorldBossFight();
      if (editingId === boss.id) cancelEdit();
    } catch (err) {
      alert("Errore eliminazione: " + err.message);
    }
  };

  const stats = useMemo(() => ({
    total: bosses.length,
    active: bosses.filter((b) => b.isActive).length,
    defeated: bosses.filter((b) => (b.hp ?? 0) <= 0).length,
  }), [bosses]);

  // Attivi per primi, poi i più recenti.
  const visibleBosses = useMemo(() => bosses
    .filter((b) => showHidden || b.isActive)
    .sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0)
      || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)), [bosses, showHidden]);

  if (!currentUser || !isAdminEmail(currentUser.email)) {
    return <div className="denied">Accesso Negato.</div>;
  }

  const busySprites = uploadState.alive || uploadState.dead;
  const TABS = [
    { key: "bestiario", label: "🦴 Bestiario", count: bosses.length },
    { key: "forgia", label: editingId ? `✎ ${form.name || "Modifica"}` : "⚒ Nuovo boss" },
    { key: "minion", label: "🪓 Minion", count: minions.length },
  ];

  return (
    <div className="wb-admin-page wb-redesign">
      <Link to="/dm-admin" className="adm-back">← Console del Master</Link>

      {/* ── TESTATA ── */}
      <header className="wb-hero">
        <div className="wb-hero-titles">
          <span className="adm-eyebrow">🩸 Bestiario delle Calamità</span>
          <h1 className="wb-hero-title">Sala delle Minacce</h1>
        </div>
        <div className="wb-hero-stats">
          <span className="wb-hero-stat"><strong>{stats.total}</strong> nel bestiario</span>
          <span className="wb-hero-stat active"><strong>{stats.active}</strong> attivi</span>
          <span className="wb-hero-stat defeated"><strong>{stats.defeated}</strong> sconfitti</span>
        </div>
      </header>

      <div className="wb-tabs" role="tablist" aria-label="Sezioni">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
            className={`wb-tab${tab === t.key ? " on" : ""}`}
            onClick={() => (t.key === "forgia" && tab !== "forgia" && !editingId ? newForge() : setTab(t.key))}>
            {t.label}{t.count != null && <small>{t.count}</small>}
          </button>
        ))}
      </div>

      {/* ══ BESTIARIO ══ */}
      {tab === "bestiario" && (
        <section className="wb-bestiary">
          <div className="wb-toolbar">
            <button type="button" className="wb-btn primary" onClick={newForge}>⚒ Nuovo boss</button>
            {bosses.some((b) => !b.isActive) && (
              <button type="button" className="wb-btn ghost" onClick={() => setShowHidden((v) => !v)}>
                {showHidden ? "🙈 Solo gli attivi" : `👁 Anche i nascosti (${bosses.filter((b) => !b.isActive).length})`}
              </button>
            )}
          </div>

          {visibleBosses.length === 0 ? (
            <p className="wb-empty">
              {bosses.length === 0
                ? "Nessuna minaccia evocata. La sala attende il tuo richiamo."
                : "Nessun boss attivo. Premi «Anche i nascosti» per vederli."}
            </p>
          ) : (
            <div className="wb-bestiary-grid">
              {visibleBosses.map((boss) => {
                const isDefeated = (boss.hp ?? 0) <= 0;
                const hpPct = boss.maxHp ? Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100)) : 0;
                const sprite = isDefeated && boss.deadImageUrl ? boss.deadImageUrl : boss.imageUrl;
                const rd = boss.rewardsData;
                return (
                  <article key={boss.id} className={`wb-card ${boss.isActive ? "active" : ""} ${isDefeated ? "defeated" : ""}`}>
                    <div className="wb-card-top">
                      <div className="wb-card-sprite">
                        {sprite
                          ? <img src={sprite} alt={boss.name} className={`${isDefeated ? "dead" : ""} ${boss.facing === "right" ? "" : "mirror"}`} />
                          : <span className="wb-card-noimg">⚆</span>}
                      </div>
                      <div className="wb-card-body">
                        <div className="wb-card-namerow">
                          <h3 className="wb-card-name">{boss.name}</h3>
                          <span className={`wb-card-status ${boss.isActive ? "on" : "off"}`}>
                            {isDefeated ? "✝ sconfitto" : boss.isActive ? "● attivo" : "○ nascosto"}
                          </span>
                        </div>
                        <div className="wb-card-stats">
                          <span>CA <strong>{boss.ac}</strong></span>
                          {boss.gradoSfida && <span>GS <strong>{boss.gradoSfida}</strong></span>}
                          <span><strong>{normalizeBossActions(boss).length}</strong> azioni</span>
                        </div>
                        <div className="wb-hp">
                          <div className="wb-hp-track"><div className="wb-hp-fill" style={{ width: `${hpPct}%` }} /></div>
                          <span className="wb-hp-text">{boss.hp ?? 0} / {boss.maxHp ?? 0} PV</span>
                        </div>
                      </div>
                    </div>

                    {(rd || boss.rewards) && (
                      <div className="wb-card-loot" title={boss.rewards || ""}>
                        🏆 {rd
                          ? [rd.xp && `${rd.xp} PE`, rd.corone && `${rd.corone} 👑`, rd.gp && `${rd.gp} mo`,
                            rd.items?.length && `${rd.items.length} oggett${rd.items.length === 1 ? "o" : "i"}`,
                            rd.bonuses?.length && `${rd.bonuses.length} bonus`].filter(Boolean).join(" · ") || "—"
                          : boss.rewards}
                      </div>
                    )}

                    {boss.rewardsDelivered ? (
                      <div className="wb-card-paid">
                        <button type="button" className="wb-card-paid-head" onClick={() => setLootOpenId(lootOpenId === boss.id ? null : boss.id)} aria-expanded={lootOpenId === boss.id}>
                          🎁 Premi consegnati a {boss.rewardsDelivered.participants?.length || 0} eroi {lootOpenId === boss.id ? "▴" : "▾"}
                        </button>
                        {lootOpenId === boss.id && (
                          <ul className="wb-card-paid-list">
                            {(boss.rewardsDelivered.participants || []).map((p) => (
                              <li key={p.uid}>
                                <strong>{p.name}</strong> <small>{p.party === NO_PARTY ? "senza gruppo" : p.party} · {p.attacks} attacchi</small>
                                {(boss.rewardsDelivered.items || []).filter((i) => i.uid === p.uid).map((i, k) => <span key={k} className="wb-paid-item">🎁 {i.item}</span>)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (rd && (isDefeated || boss.isActive)) ? (
                      <div className="wb-card-pay">
                        <small>⚔ {Object.values(attackCounts[boss.id] || {}).filter((v) => (Number(v) || 0) >= MIN_ATTACKS).length} eroi con almeno {MIN_ATTACKS} attacchi</small>
                        {isDefeated && (
                          <button type="button" className="wb-btn primary" disabled={delivering === boss.id} onClick={() => consegnaPremi(boss)}>
                            {delivering === boss.id ? "⏳ Consegno…" : "🎁 Consegna premi"}
                          </button>
                        )}
                      </div>
                    ) : null}

                    {mapOpenId === boss.id && (
                      <div className="wb-card-map">
                        <div className="map-click-area" onClick={(e) => updateBossLocation(e, boss.id)}>
                          <img src="/assets/Exanthia.jpg" alt="Mappa" />
                          <div className="boss-ping" style={{ left: `${boss.mapX}%`, top: `${boss.mapY}%` }} />
                        </div>
                        <small>Tocca la mappa per spostare il boss</small>
                      </div>
                    )}

                    <div className="wb-card-actions">
                      <button onClick={() => toggleBoss(boss)} className={`wb-btn ${boss.isActive ? "warn" : "primary"}`}>
                        {boss.isActive ? "🌑 Nascondi" : "🌕 Risveglia"}
                      </button>
                      <button onClick={() => startEdit(boss)} className="wb-btn ghost">✎ Modifica</button>
                      <button onClick={() => setMapOpenId(mapOpenId === boss.id ? null : boss.id)}
                        className={`wb-btn ghost${mapOpenId === boss.id ? " on" : ""}`} title="Posizione sulla mappa">📍</button>
                      <button onClick={() => handleDeleteBoss(boss)} className="wb-btn danger" title="Elimina">🗑</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ══ FORGIA (nuovo + modifica) ══ */}
      {tab === "forgia" && (
        <form onSubmit={saveBoss} className="wb-forge">
          {editingId ? (
            <div className="wb-editing">
              <span>✎ Stai modificando <strong>{form.name || "questo boss"}</strong></span>
              <button type="button" className="wb-btn ghost" onClick={newForge}>＋ Nuovo invece</button>
            </div>
          ) : (
            <div className="wb-ai-bar">
              <input className="admin-field-input" value={bossSpunto} onChange={(e) => setBossSpunto(e.target.value)} disabled={genState.boss}
                placeholder="Spunto per l'IA (facoltativo): es. drago di ghiaccio dei picchi di Ehkia" />
              <button type="button" className="wb-ai-btn" onClick={generaBoss} disabled={genState.boss}
                title="Riempie nome, statistiche e azioni e disegna gli sprite (vivo + morto). Poi puoi cambiare tutto.">
                {genState.boss ? "✨ L'IA forgia…" : "✨ Genera con l'IA"}
              </button>
            </div>
          )}

          <div className="wb-forge-top">
            <section className="wb-sec">
              <h2 className="wb-sec-title">Identità</h2>
              <div className="wb-field">
                <label>Nome</label>
                <input className="admin-field-input" placeholder="es. Il Divoratore delle Anime" required
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="wb-stats-row">
                <div className="wb-field">
                  <label>PV max</label>
                  <input className="admin-field-input" type="number" placeholder="500" required
                    value={form.maxHp} onChange={(e) => setForm({ ...form, maxHp: e.target.value })} />
                </div>
                {editingId && (
                  <div className="wb-field">
                    <label>PV attuali</label>
                    <input className="admin-field-input" type="number"
                      value={form.hp ?? ""} onChange={(e) => setForm({ ...form, hp: e.target.value })} />
                  </div>
                )}
                <div className="wb-field">
                  <label>CA</label>
                  <input className="admin-field-input" type="number" placeholder="18"
                    value={form.ac} onChange={(e) => setForm({ ...form, ac: e.target.value })} />
                </div>
                <div className="wb-field">
                  <label>Grado sfida</label>
                  <input className="admin-field-input" placeholder="12"
                    value={form.gradoSfida} onChange={(e) => setForm({ ...form, gradoSfida: e.target.value })} />
                </div>
              </div>
              <div className="wb-field">
                <label>Descrizione</label>
                <textarea className="admin-field-textarea" rows="3" placeholder="Una creatura nata dal silenzio degli abissi…"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="wb-field">
                <label>🛡 Resistenze e debolezze</label>
                <DefensesPicker value={form} onChange={(d) => setForm((b) => ({ ...b, ...d }))} />
              </div>
              <div className="wb-field">
                <label>⏳ Fine dell'evento</label>
                <DateTimePicker value={form.expiryDate || ""} onChange={(v) => setForm({ ...form, expiryDate: v })}
                  presets="auction" placeholder="Quando finisce l'evento?" />
              </div>
            </section>

            <section className="wb-sec wb-sec--sprites">
              <div className="wb-sec-titlerow">
                <h2 className="wb-sec-title">Sprite</h2>
                <ImageTonePicker compact />
              </div>
              <div className="wb-sprite-slots">
                <div className="wb-sprite-slot">
                  <span className="wb-slot-tag">Vivo</span>
                  <SpriteDropzone label="Sprite vivo" icon="🩸" value={form.imageUrl}
                    uploading={uploadState.alive} generating={genState.genAlive}
                    onGenerate={() => generateSprite({ name: form.name, desc: form.description, dead: false, slotKey: "genAlive", apply: (url) => { cleanupStorageUrl(form.imageUrl); setForm((b) => ({ ...b, imageUrl: url })); } })}
                    onFile={onFormSprite("imageUrl", "alive")}
                    onClear={() => { cleanupStorageUrl(form.imageUrl); setForm((b) => ({ ...b, imageUrl: "" })); }}
                    accent="var(--oro)" />
                </div>
                <div className="wb-sprite-slot">
                  <span className="wb-slot-tag">Sconfitto</span>
                  <SpriteDropzone label="Sprite morto" icon="💀" value={form.deadImageUrl}
                    uploading={uploadState.dead} generating={genState.genDead}
                    onGenerate={() => generateSprite({ name: form.name, desc: form.description, dead: true, slotKey: "genDead", ref: form.imageUrl || "", apply: (url) => { cleanupStorageUrl(form.deadImageUrl); setForm((b) => ({ ...b, deadImageUrl: url })); } })}
                    onFile={onFormSprite("deadImageUrl", "dead")}
                    onClear={() => { cleanupStorageUrl(form.deadImageUrl); setForm((b) => ({ ...b, deadImageUrl: "" })); }}
                    accent="#7a0808" />
                  <DeadStylePicker value={deadStyle} onChange={setDeadStyle} />
                </div>
              </div>
              <FacingPicker value={form.facing} imageUrl={form.imageUrl} name={form.name}
                onChange={(f) => setForm((b) => ({ ...b, facing: f }))} />
            </section>
          </div>

          <section className="wb-sec">
            <ActionsList title="⚔ Azioni del boss" actions={form.actions} min={MIN_ACTIONS}
              onChange={(actions) => setForm((b) => ({ ...b, actions }))} />
          </section>

          <div className="wb-forge-stakes">
            <section className="wb-sec wb-sec--loot">
              <h2 className="wb-sec-title">🏆 Premi della vittoria</h2>
              <BossRewardsEditor value={form.rewardsData}
                boss={{ name: form.name, description: form.description, gradoSfida: form.gradoSfida }}
                onChange={(rewardsData) => setForm((b) => ({ ...b, rewardsData }))}
                onUploadImg={(file) => uploadSprite(file, "reward")} />
            </section>
            <section className="wb-sec wb-sec--penalty">
              <h2 className="wb-sec-title">💀 Se gli eroi perdono</h2>
              <textarea className="admin-field-textarea" rows="5" placeholder="Conseguenze per i giocatori…"
                value={form.penalties} onChange={(e) => setForm({ ...form, penalties: e.target.value })} />
            </section>
          </div>

          <div className="wb-savebar">
            <span className="wb-savebar-sum">
              <strong>{form.name || "Senza nome"}</strong>
              <small>{form.maxHp || "—"} PV · CA {form.ac || "—"} · {form.actions.length} azioni{rewardsSummary(form.rewardsData) ? ` · 🏆 ${rewardsSummary(form.rewardsData)}` : ""}</small>
            </span>
            {editingId && <button type="button" className="wb-btn ghost" onClick={cancelEdit}>Annulla</button>}
            <button type="submit" className="wb-evoke-btn" disabled={busySprites || saving || uploadState.reward}>
              {busySprites || uploadState.reward ? "⏳ Carico l'immagine…" : saving ? "⏳ Salvo…" : editingId ? "💾 Salva modifiche" : "⚡ Evoca minaccia"}
            </button>
          </div>
        </form>
      )}

      {/* ══ CASERMA DEI MINION ══ */}
      {tab === "minion" && (
        <section className="wb-minions">
          <div className="wb-minion-workshop">
            <form className="wb-minion-form wb-sec" onSubmit={saveMinion}>
              {editingMinionId ? (
                <div className="wb-editing">
                  <span>✎ Stai modificando <strong>{minionForm.name || "questo minion"}</strong></span>
                  <button type="button" className="wb-btn ghost" onClick={cancelMinionEdit}>＋ Nuovo invece</button>
                </div>
              ) : (
                <div className="wb-ai-bar">
                  <input className="admin-field-input" value={minionSpunto} onChange={(e) => setMinionSpunto(e.target.value)} disabled={genState.minion}
                    placeholder="Spunto per l'IA (es. sciame di non-morti striscianti)" />
                  <button type="button" className="wb-ai-btn" onClick={generaMinion} disabled={genState.minion}
                    title="Riempie nome, PV, CA e attacchi e disegna gli sprite.">
                    {genState.minion ? "✨ L'IA crea…" : "✨ Genera con l'IA"}
                  </button>
                </div>
              )}

              <div className="wb-minion-grid">
                <div className="wb-minion-fields">
                  <div className="wb-field">
                    <label>Nome</label>
                    <input className="admin-field-input" placeholder="es. Scheletro guerriero" required
                      value={minionForm.name} onChange={(e) => setMinionForm({ ...minionForm, name: e.target.value })} />
                  </div>
                  <div className="wb-stats-row">
                    <div className="wb-field">
                      <label>PV</label>
                      <input className="admin-field-input" type="number" placeholder="12" required
                        value={minionForm.hp} onChange={(e) => setMinionForm({ ...minionForm, hp: e.target.value })} />
                    </div>
                    <div className="wb-field">
                      <label>CA</label>
                      <input className="admin-field-input" type="number" placeholder="11"
                        value={minionForm.ac} onChange={(e) => setMinionForm({ ...minionForm, ac: e.target.value })} />
                    </div>
                  </div>
                  <FacingPicker value={minionForm.facing} imageUrl={minionForm.imageUrl} name={minionForm.name}
                    onChange={(f) => setMinionForm((m) => ({ ...m, facing: f }))} />
                </div>
                <div className="wb-sec--sprites">
                  <div className="wb-sec-titlerow">
                    <span className="wb-slot-tag">Sprite</span>
                    <ImageTonePicker compact />
                  </div>
                  <div className="wb-sprite-slots">
                    <div className="wb-sprite-slot">
                      <SpriteDropzone label="Vivo" icon="🩸" value={minionForm.imageUrl}
                        uploading={uploadState.minionAlive} generating={genState.genMinionAlive}
                        onGenerate={() => generateSprite({ name: minionForm.name, desc: "", dead: false, slotKey: "genMinionAlive", apply: (url) => { cleanupStorageUrl(minionForm.imageUrl); setMinionForm((m) => ({ ...m, imageUrl: url })); } })}
                        onFile={onMinionAlive}
                        onClear={() => { cleanupStorageUrl(minionForm.imageUrl); setMinionForm((m) => ({ ...m, imageUrl: "" })); }}
                        accent="var(--oro)" />
                    </div>
                    <div className="wb-sprite-slot">
                      <SpriteDropzone label="Morto" icon="🪦" value={minionForm.deadImageUrl}
                        uploading={uploadState.minionDead} generating={genState.genMinionDead}
                        onGenerate={() => generateSprite({ name: minionForm.name, desc: "", dead: true, slotKey: "genMinionDead", ref: minionForm.imageUrl || "", apply: (url) => { cleanupStorageUrl(minionForm.deadImageUrl); setMinionForm((m) => ({ ...m, deadImageUrl: url })); } })}
                        onFile={onMinionDead}
                        onClear={() => { cleanupStorageUrl(minionForm.deadImageUrl); setMinionForm((m) => ({ ...m, deadImageUrl: "" })); }}
                        accent="#7a0808" />
                      <DeadStylePicker value={deadStyle} onChange={setDeadStyle} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="wb-field">
                <label>🛡 Resistenze e debolezze</label>
                <DefensesPicker value={minionForm} onChange={(d) => setMinionForm((m) => ({ ...m, ...d }))} />
              </div>

              <ActionsList title="⚔ Attacchi" actions={minionForm.actions} min={1}
                onChange={(actions) => setMinionForm((m) => ({ ...m, actions }))} />

              <div className="wb-minion-form-actions">
                <button type="submit" className="wb-btn primary" disabled={uploadState.minionAlive || uploadState.minionDead}>
                  {(uploadState.minionAlive || uploadState.minionDead)
                    ? "⏳ Upload…"
                    : editingMinionId ? "💾 Aggiorna minion" : "➕ Salva minion"}
                </button>
                {editingMinionId && (
                  <button type="button" className="wb-btn ghost" onClick={cancelMinionEdit}>Annulla</button>
                )}
              </div>
            </form>

            <aside className="wb-minion-roster wb-sec">
              <h3>Minion salvati ({minions.length})</h3>
              <small className="wb-roster-hint">⚡ = scende in campo da solo a inizio battaglia; gli altri si evocano dal fight.</small>
              {minions.length === 0 ? (
                <p className="wb-empty">Nessun minion. Creane uno qui a fianco.</p>
              ) : (
                <div className="wb-minion-chips">
                  {minions.map((m) => (
                    <div key={m.id} className={`wb-minion-chip ${m.isActive ? "on" : ""} ${editingMinionId === m.id ? "editing" : ""}`}>
                      <button type="button" className="wb-minion-chip-main" onClick={() => editMinion(m)} title="Modifica">
                        {m.imageUrl
                          ? <img className="wb-minion-thumb" src={m.imageUrl} alt="" />
                          : <span className="wb-minion-thumb placeholder">{(m.name || "?")[0].toUpperCase()}</span>}
                        <span className="wb-minion-chip-txt">
                          <strong>{m.name || "Minion"}</strong>
                          <span>❤ {m.hp ?? "—"} · 🛡 {m.ac ?? "—"} · {(m.actions || []).length} att.</span>
                        </span>
                      </button>
                      <button type="button" className={`wb-minion-toggle ${m.isActive ? "active" : ""}`} onClick={() => toggleMinion(m)}
                        title={m.isActive ? "⚡ Scende in campo da solo quando il Master preme Inizia battaglia — clicca per toglierlo" : "Clicca per farlo scendere in campo da solo all'inizio della battaglia (altrimenti si evoca a mano dal fight)"}>
                        {m.isActive ? "⚡" : "○"}
                      </button>
                      <button type="button" className="wb-minion-del" onClick={() => deleteMinion(m)} title="Elimina">🗑</button>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}
