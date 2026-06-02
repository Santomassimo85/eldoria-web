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
import { makeFlatMap, aoeCells, tilesWithinRange } from "./tactics/isoCore";
import "./admin.css";
import "./WorldBossAdmin.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

const MIN_ACTIONS = 2;
const MAX_ACTIONS = 5;

const ACTION_TYPES = [
  { value: "attack",     label: "⚔ Attacco",     hint: "Tira d20 + bonus vs CA. Danni: N×d." },
  { value: "heal",       label: "💖 Cura",        hint: "Cura il Boss di NdT + bonus HP." },
  { value: "buff_ca",    label: "🛡 +CA",        hint: "Alza la CA del Boss del bonus indicato." },
  { value: "buff_adv",   label: "⬆ Vantaggio",   hint: "Vantaggio sul prossimo attacco del Boss." },
  { value: "debuff_dis", label: "⬇ Svantaggio",  hint: "Svantaggio sul prossimo tiro dei bersagli." },
];

// AoE shapes (mirrors battleModel.spellAoE geometry) + saving-throw abilities.
const AOE_SHAPES = [
  { value: "single", icon: "🎯", label: "Singolo" },
  { value: "sphere", icon: "⭕", label: "Cerchio" },
  { value: "square", icon: "⬛", label: "Quadrato" },
  { value: "line",   icon: "➖", label: "Linea" },
  { value: "cone",   icon: "🔺", label: "Cono" },
];
const AOE_ELEMENTS = [
  { value: "",          label: "Elemento…" },
  { value: "fuoco",     label: "🔥 Fuoco" },
  { value: "ghiaccio",  label: "❄ Ghiaccio" },
  { value: "oscurità",  label: "🌑 Ombra" },
  { value: "arcano",    label: "✨ Arcano" },
];
const SAVES = [
  { v: "dex", l: "DES" }, { v: "con", l: "COS" }, { v: "wis", l: "SAG" },
  { v: "str", l: "FOR" }, { v: "int", l: "INT" }, { v: "cha", l: "CAR" },
];
// Boss action types that target tiles/units (so they get a range + preview).
const TARGETED_TYPES = ["attack", "heal", "debuff_dis"];

const blankAction = (i = 0) => ({
  type: "attack",
  name: "",
  diceNum: 1,
  diceType: i === 1 ? "d8" : "d6",
  bonus: 0,
  acBonus: 2,
  range: 1,            // gittata in tile (raggio d'azione per colpire/mirare)
  aoeShape: "single",  // single | sphere | square | line | cone
  aoeSize: 1,          // raggio (cerchio/quadrato) o lunghezza (linea/cono)
  dmgType: "",         // elemento → tinta dell'effetto a schermo
  saveAbility: "dex",  // TS che i bersagli tirano contro le aree
  halfOnSave: true,    // metà danni se superano il TS
});

const initialBossState = {
  name: "",
  maxHp: "",
  ac: "",
  rewards: "",
  penalties: "",
  imageUrl: "",
  deadImageUrl: "",
  description: "",
  gradoSfida: "",
  expiryDate: "",
  actions: [blankAction(0), blankAction(1)],
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
   AoePreview — top-down mini-grid that visualises the tiles an
   action covers. Uses the SAME geometry as the live battle
   (aoeCells / tilesWithinRange) so it is WYSIWYG.
   ────────────────────────────────────────────────────────────── */
const AoePreview = ({ range, shape, size }) => {
  const R = clamp(parseInt(range) || 1, 1, 12);
  const Z = clamp(parseInt(size) || 1, 1, 6);
  const isAoe = shape && shape !== "single";

  const grid = useMemo(() => {
    const span = isAoe ? R + Z : R;
    const S = clamp(span * 2 + 1, 5, 13);
    const c = Math.floor(S / 2);
    const map = makeFlatMap(S, S, "grass");
    const caster = { x: c, y: c };
    const reach = tilesWithinRange(map, c, c, 1, R);   // tiles you can hit/aim
    let blast = new Set();
    if (isAoe) {
      const aimX = clamp(c + R, 0, S - 1);             // aim east at max range
      blast = aoeCells(map, caster, aimX, c, { shape, size: Z, range: R });
    }
    return { S, c, reach, blast };
  }, [R, Z, shape, isAoe]);

  const { S, c, reach, blast } = grid;
  const covered = isAoe ? blast.size : reach.size;

  return (
    <div className="wb-aoe-preview">
      <div
        className="wb-aoe-grid"
        style={{ gridTemplateColumns: `repeat(${S}, 1fr)` }}
      >
        {Array.from({ length: S * S }, (_, i) => {
          const x = i % S, y = Math.floor(i / S);
          const key = `${x},${y}`;
          const isCaster = x === c && y === c;
          const inBlast = blast.has(key);
          const inReach = reach.has(key);
          let cls = "wb-cell";
          if (isCaster) cls += " caster";
          else if (inBlast) cls += " blast";
          else if (inReach) cls += isAoe ? " reach" : " target";
          return <span key={i} className={cls}>{isCaster ? "👹" : ""}</span>;
        })}
      </div>
      <div className="wb-aoe-caption">
        {isAoe
          ? <>🎇 Copre <strong>{covered}</strong> tile · gittata <strong>{R}</strong></>
          : <>🎯 Colpisce entro <strong>{R}</strong> tile <span className="wb-aoe-dim">({covered} caselle)</span></>}
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   ActionEditor — single boss action card with type-specific fields
   ────────────────────────────────────────────────────────────── */
const ActionEditor = ({ action, idx, onChange, onRemove, canRemove }) => {
  const type = action.type || "attack";
  const meta = ACTION_TYPES.find((t) => t.value === type) || ACTION_TYPES[0];
  const targeted = TARGETED_TYPES.includes(type);   // has a range + tile preview
  const canAoE = type === "attack";                 // only attacks can be areas
  const shape = canAoE ? (action.aoeShape || "single") : "single";
  const isAoe = shape !== "single";
  return (
    <div className={`wb-action-block wb-action-block--${type}`}>
      <div className="wb-action-block-head">
        <label>{meta.label} · Azione {idx + 1}</label>
        <button
          type="button"
          className="wb-remove-action-btn"
          onClick={onRemove}
          disabled={!canRemove}
          title={canRemove ? "Rimuovi" : `Minimo ${MIN_ACTIONS} azioni`}
        >
          ✕
        </button>
      </div>

      <select
        className="admin-field-input wb-action-type-select"
        value={type}
        onChange={(e) => onChange({ type: e.target.value })}
      >
        {ACTION_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <input
        className="admin-field-input"
        placeholder={ACTION_PLACEHOLDERS[idx] || `Azione ${idx + 1}`}
        value={action.name || ""}
        onChange={(e) => onChange({ name: e.target.value })}
      />

      <small className="wb-action-help">{meta.hint}</small>

      {(type === "attack" || type === "heal") && (
        <div className="wb-dice-row">
          <input
            className="admin-field-input"
            type="number"
            placeholder="N°"
            value={action.diceNum ?? 1}
            onChange={(e) => onChange({ diceNum: e.target.value })}
          />
          <select
            className="admin-field-input"
            value={action.diceType || "d6"}
            onChange={(e) => onChange({ diceType: e.target.value })}
          >
            {DICE.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input
            className="admin-field-input"
            type="number"
            placeholder={type === "attack" ? "+ Hit" : "+ Bonus"}
            value={action.bonus ?? 0}
            onChange={(e) => onChange({ bonus: e.target.value })}
          />
        </div>
      )}

      {type === "buff_ca" && (
        <div className="wb-dice-row wb-dice-row--single">
          <label className="wb-inline-label">+CA</label>
          <input
            className="admin-field-input"
            type="number"
            placeholder="2"
            value={action.acBonus ?? 2}
            onChange={(e) => onChange({ acBonus: e.target.value })}
          />
        </div>
      )}

      {/* ── Gittata + Area + anteprima tile ── */}
      {targeted && (
        <div className="wb-aoe-box">
          <div className="wb-aoe-line">
            <label className="wb-inline-label">📏 Gittata</label>
            <input
              className="admin-field-input wb-num"
              type="number" min={1} max={12}
              value={action.range ?? 1}
              onChange={(e) => onChange({ range: clamp(parseInt(e.target.value) || 1, 1, 12) })}
            />
            <span className="wb-aoe-unit">tile</span>
          </div>

          {canAoE && (
            <>
              <div className="wb-aoe-shapes">
                {AOE_SHAPES.map((s) => (
                  <button
                    type="button"
                    key={s.value}
                    className={`wb-aoe-shape ${shape === s.value ? "on" : ""}`}
                    title={s.label}
                    onClick={() => onChange({ aoeShape: s.value })}
                  >
                    <span className="wb-aoe-shape-icon">{s.icon}</span>
                    <span className="wb-aoe-shape-lbl">{s.label}</span>
                  </button>
                ))}
              </div>

              {isAoe && (
                <>
                  <div className="wb-aoe-line">
                    <label className="wb-inline-label">
                      {shape === "line" || shape === "cone" ? "📐 Lunghezza" : "⬚ Raggio"}
                    </label>
                    <input
                      className="admin-field-input wb-num"
                      type="number" min={1} max={6}
                      value={action.aoeSize ?? 1}
                      onChange={(e) => onChange({ aoeSize: clamp(parseInt(e.target.value) || 1, 1, 6) })}
                    />
                    <span className="wb-aoe-unit">tile</span>
                    <select
                      className="admin-field-input wb-aoe-elem"
                      value={action.dmgType || ""}
                      onChange={(e) => onChange({ dmgType: e.target.value })}
                    >
                      {AOE_ELEMENTS.map((el) => <option key={el.value} value={el.value}>{el.label}</option>)}
                    </select>
                  </div>
                  <div className="wb-aoe-line">
                    <label className="wb-inline-label">🎲 TS</label>
                    <select
                      className="admin-field-input wb-num-wide"
                      value={action.saveAbility || "dex"}
                      onChange={(e) => onChange({ saveAbility: e.target.value })}
                    >
                      {SAVES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                    </select>
                    <label className="wb-aoe-check">
                      <input
                        type="checkbox"
                        checked={action.halfOnSave !== false}
                        onChange={(e) => onChange({ halfOnSave: e.target.checked })}
                      />
                      ½ danni se supera
                    </label>
                  </div>
                </>
              )}
            </>
          )}

          <AoePreview range={action.range ?? 1} shape={shape} size={action.aoeSize ?? 1} />
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   SpriteDropzone — drag & drop slot for a boss sprite
   ────────────────────────────────────────────────────────────── */
const SpriteDropzone = ({ label, icon, value, uploading, onFile, onClear, accent = "#d4af37" }) => {
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

  return (
    <div
      className={`wb-drop ${dragOver ? "drag" : ""} ${uploading ? "loading" : ""} ${value ? "filled" : ""}`}
      style={{ "--wb-accent": accent }}
      onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePick}
      />
      {uploading ? (
        <div className="wb-drop-state">
          <span className="wb-drop-spinner" />
          <strong>Forgia in corso…</strong>
        </div>
      ) : value ? (
        <>
          <img src={value} alt={label} className="wb-drop-preview" />
          <div className="wb-drop-overlay">
            <span className="wb-drop-overlay-label">{icon} Cambia</span>
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
        </div>
      )}
    </div>
  );
};

export default function WorldBossAdmin() {
  const { currentUser } = useAuth();
  const [bosses, setBosses] = useState([]);
  const [newBoss, setNewBoss] = useState(initialBossState);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [uploadState, setUploadState] = useState({}); // { newAlive: bool, newDead: bool, editAlive: bool, editDead: bool }

  useEffect(() => {
    const unsubBoss = onSnapshot(collection(db, "bosses"), (snap) => {
      setBosses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubBoss();
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

  /* ── New boss handlers ── */
  const onNewAlive = async (file) => {
    const url = await uploadSprite(file, "newAlive");
    if (url) {
      if (newBoss.imageUrl) cleanupStorageUrl(newBoss.imageUrl);
      setNewBoss((b) => ({ ...b, imageUrl: url }));
    }
  };
  const onNewDead = async (file) => {
    const url = await uploadSprite(file, "newDead");
    if (url) {
      if (newBoss.deadImageUrl) cleanupStorageUrl(newBoss.deadImageUrl);
      setNewBoss((b) => ({ ...b, deadImageUrl: url }));
    }
  };

  /* ── Edit boss handlers ── */
  const onEditAlive = async (file) => {
    const url = await uploadSprite(file, "editAlive");
    if (url) {
      if (editData.imageUrl) cleanupStorageUrl(editData.imageUrl);
      setEditData((d) => ({ ...d, imageUrl: url }));
    }
  };
  const onEditDead = async (file) => {
    const url = await uploadSprite(file, "editDead");
    if (url) {
      if (editData.deadImageUrl) cleanupStorageUrl(editData.deadImageUrl);
      setEditData((d) => ({ ...d, deadImageUrl: url }));
    }
  };

  /* ── Dynamic actions: new boss ── */
  const updateNewAction = (idx, patch) =>
    setNewBoss((b) => ({
      ...b,
      actions: b.actions.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  const addNewAction = () =>
    setNewBoss((b) =>
      b.actions.length >= MAX_ACTIONS
        ? b
        : { ...b, actions: [...b.actions, blankAction(b.actions.length)] }
    );
  const removeNewAction = (idx) =>
    setNewBoss((b) =>
      b.actions.length <= MIN_ACTIONS
        ? b
        : { ...b, actions: b.actions.filter((_, i) => i !== idx) }
    );

  /* ── Dynamic actions: edit boss ── */
  const updateEditAction = (idx, patch) =>
    setEditData((d) => ({
      ...d,
      actions: (d.actions || []).map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  const addEditAction = () =>
    setEditData((d) => {
      const cur = d.actions || [];
      if (cur.length >= MAX_ACTIONS) return d;
      return { ...d, actions: [...cur, blankAction(cur.length)] };
    });
  const removeEditAction = (idx) =>
    setEditData((d) => {
      const cur = d.actions || [];
      if (cur.length <= MIN_ACTIONS) return d;
      return { ...d, actions: cur.filter((_, i) => i !== idx) };
    });

  const updateBossLocation = async (e, bossId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    await updateDoc(doc(db, "bosses", bossId), {
      mapX: parseFloat(xPercent.toFixed(2)),
      mapY: parseFloat(yPercent.toFixed(2)),
    });
  };

  const handleCreateBoss = async (e) => {
    e.preventDefault();
    if (uploadState.newAlive || uploadState.newDead) return;
    try {
      await addDoc(collection(db, "bosses"), {
        ...newBoss,
        ac: parseInt(newBoss.ac) || 10,
        hp: parseInt(newBoss.maxHp),
        maxHp: parseInt(newBoss.maxHp),
        isActive: false,
        mapX: 50,
        mapY: 50,
        createdAt: serverTimestamp(),
      });
      alert("✅ Boss evocato!");
      setNewBoss(initialBossState);
    } catch (err) {
      console.error(err);
      alert("Errore creazione: " + err.message);
    }
  };

  const startEdit = (boss) => {
    setEditingId(boss.id);
    setEditData({ ...boss, actions: normalizeBossActions(boss) });
  };

  const saveEdit = async (id) => {
    if (uploadState.editAlive || uploadState.editDead) return;
    try {
      await updateDoc(doc(db, "bosses", id), {
        ...editData,
        ac: parseInt(editData.ac) || 10,
        maxHp: parseInt(editData.maxHp) || 100,
        hp:
          parseInt(editData.hp) > parseInt(editData.maxHp)
            ? parseInt(editData.maxHp)
            : parseInt(editData.hp),
        // Drop legacy per-slot action fields now that we use the actions array.
        action1: deleteField(),
        action2: deleteField(),
        action3: deleteField(),
        action4: deleteField(),
        action5: deleteField(),
      });
      setEditingId(null);
      alert("Boss aggiornato!");
    } catch (err) {
      console.error(err);
      alert("Errore: " + err.message);
    }
  };

  const handleDeleteBoss = async (boss) => {
    if (!window.confirm(`Eliminare "${boss.name}"? L'azione è irreversibile.`)) return;
    try {
      await Promise.all([
        cleanupStorageUrl(boss.imageUrl),
        cleanupStorageUrl(boss.deadImageUrl),
      ]);
      await deleteDoc(doc(db, "bosses", boss.id));
    } catch (err) {
      alert("Errore eliminazione: " + err.message);
    }
  };

  const stats = useMemo(() => ({
    total: bosses.length,
    active: bosses.filter((b) => b.isActive).length,
    defeated: bosses.filter((b) => (b.hp ?? 0) <= 0).length,
  }), [bosses]);

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <div className="denied">Accesso Negato.</div>;
  }

  return (
    <div className="wb-admin-page wb-redesign">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard Admin</Link>

      {/* ── HERO ── */}
      <header className="wb-hero">
        <div className="wb-hero-titles">
          <h1 className="wb-hero-title">🩸 Sala delle Minacce</h1>
          <p className="wb-hero-sub">Forgia, evoca e governa le calamità di Exanthia</p>
        </div>
        <div className="wb-hero-stats">
          <div className="wb-hero-stat"><span>Bestiario</span><strong>{stats.total}</strong></div>
          <div className="wb-hero-stat active"><span>Attivi</span><strong>{stats.active}</strong></div>
          <div className="wb-hero-stat defeated"><span>Sconfitti</span><strong>{stats.defeated}</strong></div>
        </div>
      </header>

      {/* ── WORKSHOP: FORGIA + ALTARE ── */}
      <div className="wb-workshop">
        <section className="wb-forge">
          <div className="wb-section-head">
            <h2>⚒ Forgia della Minaccia</h2>
            <small>Definisci nome, statistiche e azioni</small>
          </div>

          <form onSubmit={handleCreateBoss} className="wb-form">
            <div className="wb-field">
              <label>Nome Boss</label>
              <input
                className="admin-field-input"
                placeholder="es. Il Divoratore delle Anime"
                value={newBoss.name}
                onChange={(e) => setNewBoss({ ...newBoss, name: e.target.value })}
                required
              />
            </div>

            <div className="wb-field-row3">
              <div className="wb-field">
                <label>HP Massimi</label>
                <input
                  className="admin-field-input"
                  type="number"
                  placeholder="500"
                  value={newBoss.maxHp}
                  onChange={(e) => setNewBoss({ ...newBoss, maxHp: e.target.value })}
                  required
                />
              </div>
              <div className="wb-field">
                <label>CA</label>
                <input
                  className="admin-field-input"
                  type="number"
                  placeholder="18"
                  value={newBoss.ac}
                  onChange={(e) => setNewBoss({ ...newBoss, ac: e.target.value })}
                />
              </div>
              <div className="wb-field">
                <label>Grado Sfida</label>
                <input
                  className="admin-field-input"
                  placeholder="es. 12"
                  value={newBoss.gradoSfida}
                  onChange={(e) => setNewBoss({ ...newBoss, gradoSfida: e.target.value })}
                />
              </div>
            </div>

            <div className="wb-actions-section">
              <div className="wb-actions-head">
                <label>
                  ⚔ Azioni del Boss
                  <small>{newBoss.actions.length}/{MAX_ACTIONS}</small>
                </label>
                <button
                  type="button"
                  className="wb-add-action-btn"
                  onClick={addNewAction}
                  disabled={newBoss.actions.length >= MAX_ACTIONS}
                  title={
                    newBoss.actions.length >= MAX_ACTIONS
                      ? `Massimo ${MAX_ACTIONS} azioni`
                      : "Aggiungi un'azione"
                  }
                >
                  + Aggiungi
                </button>
              </div>
              <div className="wb-actions-grid">
                {newBoss.actions.map((a, idx) => (
                  <ActionEditor
                    key={idx}
                    action={a}
                    idx={idx}
                    onChange={(patch) => updateNewAction(idx, patch)}
                    onRemove={() => removeNewAction(idx)}
                    canRemove={newBoss.actions.length > MIN_ACTIONS}
                  />
                ))}
              </div>
            </div>

            <div className="wb-field">
              <label>Descrizione narrativa</label>
              <textarea
                className="admin-field-textarea"
                placeholder="Una creatura nata dal silenzio degli abissi…"
                value={newBoss.description}
                onChange={(e) => setNewBoss({ ...newBoss, description: e.target.value })}
                rows="3"
              />
            </div>

            <div className="wb-field-row2">
              <div className="wb-field">
                <label>🏆 Ricompense</label>
                <textarea
                  className="admin-field-textarea"
                  placeholder="Oro, oggetti, XP…"
                  value={newBoss.rewards}
                  onChange={(e) => setNewBoss({ ...newBoss, rewards: e.target.value })}
                  rows="2"
                />
              </div>
              <div className="wb-field">
                <label>💀 Penalità</label>
                <textarea
                  className="admin-field-textarea"
                  placeholder="Conseguenze per i player…"
                  value={newBoss.penalties}
                  onChange={(e) => setNewBoss({ ...newBoss, penalties: e.target.value })}
                  rows="2"
                />
              </div>
            </div>

            <div className="wb-field">
              <label>⏳ Scadenza Evento</label>
              <DateTimePicker
                value={newBoss.expiryDate}
                onChange={(v) => setNewBoss({ ...newBoss, expiryDate: v })}
                presets="auction"
                placeholder="Quando finisce l'evento?"
              />
            </div>

            <button
              type="submit"
              className="wb-evoke-btn"
              disabled={uploadState.newAlive || uploadState.newDead}
            >
              {(uploadState.newAlive || uploadState.newDead) ? "⏳ Forgia in corso…" : "⚡ Evoca Minaccia"}
            </button>
          </form>
        </section>

        <aside className="wb-altar">
          <div className="wb-section-head">
            <h2>🜲 Altare degli Sprite</h2>
            <small>Trascina qui le forme della minaccia</small>
          </div>

          <div className="wb-sprite-slots">
            <div className="wb-sprite-slot">
              <span className="wb-slot-tag">Forma viva</span>
              <SpriteDropzone
                label="Sprite Vivo"
                icon="🩸"
                value={newBoss.imageUrl}
                uploading={uploadState.newAlive}
                onFile={onNewAlive}
                onClear={() => {
                  cleanupStorageUrl(newBoss.imageUrl);
                  setNewBoss((b) => ({ ...b, imageUrl: "" }));
                }}
                accent="#d4af37"
              />
            </div>
            <div className="wb-sprite-slot">
              <span className="wb-slot-tag">Forma sconfitta</span>
              <SpriteDropzone
                label="Sprite Morto"
                icon="💀"
                value={newBoss.deadImageUrl}
                uploading={uploadState.newDead}
                onFile={onNewDead}
                onClear={() => {
                  cleanupStorageUrl(newBoss.deadImageUrl);
                  setNewBoss((b) => ({ ...b, deadImageUrl: "" }));
                }}
                accent="#7a0808"
              />
            </div>
          </div>

          <div className="wb-summary">
            <div className="wb-summary-name">{newBoss.name || "Nome ignoto"}</div>
            <div className="wb-summary-stats">
              <span>HP <strong>{newBoss.maxHp || "—"}</strong></span>
              <span>CA <strong>{newBoss.ac || "—"}</strong></span>
              <span>GS <strong>{newBoss.gradoSfida || "—"}</strong></span>
            </div>
            <div className="wb-summary-sprites">
              {newBoss.imageUrl && <span className="wb-summary-tag ok">🩸 Vivo</span>}
              {newBoss.deadImageUrl && <span className="wb-summary-tag ok dead">💀 Morto</span>}
              {!newBoss.imageUrl && !newBoss.deadImageUrl && <span className="wb-summary-tag empty">Nessuno sprite</span>}
            </div>
          </div>
        </aside>
      </div>

      {/* ── BESTIARIO ── */}
      <section className="wb-bestiary">
        <div className="wb-section-head">
          <h2>🦴 Bestiario ({bosses.length})</h2>
          <small>Clicca sulla mappa per riposizionare il ping</small>
        </div>

        {bosses.length === 0 ? (
          <p className="wb-empty">Nessuna minaccia evocata. La sala attende il tuo richiamo.</p>
        ) : (
          <div className="wb-bestiary-grid">
            {bosses.map((boss) => {
              const isEditing = editingId === boss.id;
              const isDefeated = (boss.hp ?? 0) <= 0;
              const hpPct = boss.maxHp ? Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100)) : 0;
              const sprite = isDefeated && boss.deadImageUrl ? boss.deadImageUrl : boss.imageUrl;

              return (
                <article
                  key={boss.id}
                  className={`wb-card ${boss.isActive ? "active" : ""} ${isDefeated ? "defeated" : ""}`}
                >
                  {!isEditing ? (
                    <>
                      <div className="wb-card-sprite">
                        {sprite ? (
                          <img src={sprite} alt={boss.name} className={isDefeated ? "dead" : ""} />
                        ) : (
                          <div className="wb-card-noimg">⚆<small>nessuno sprite</small></div>
                        )}
                        <span className={`wb-card-status ${boss.isActive ? "on" : "off"}`}>
                          {boss.isActive ? "● ATTIVO" : "○ NASCOSTO"}
                        </span>
                        {isDefeated && <div className="wb-card-defeated-stamp">SCONFITTO</div>}
                      </div>

                      <div className="wb-card-body">
                        <h3 className="wb-card-name">{boss.name}</h3>
                        <div className="wb-card-stats">
                          <span>CA <strong>{boss.ac}</strong></span>
                          {boss.gradoSfida && <span>GS <strong>{boss.gradoSfida}</strong></span>}
                        </div>

                        <div className="wb-hp">
                          <div className="wb-hp-track">
                            <div className="wb-hp-fill" style={{ width: `${hpPct}%` }} />
                          </div>
                          <span className="wb-hp-text">{boss.hp ?? 0} / {boss.maxHp ?? 0} HP</span>
                        </div>

                        <div className="wb-card-map">
                          <div className="map-click-area" onClick={(e) => updateBossLocation(e, boss.id)}>
                            <img src="/assets/Exanthia.jpg" alt="Map" />
                            <div className="boss-ping" style={{ left: `${boss.mapX}%`, top: `${boss.mapY}%` }} />
                          </div>
                        </div>

                        <div className="wb-card-actions">
                          <button
                            onClick={() => updateDoc(doc(db, "bosses", boss.id), { isActive: !boss.isActive })}
                            className={`wb-btn ${boss.isActive ? "warn" : "primary"}`}
                          >
                            {boss.isActive ? "🌑 Nascondi" : "🌕 Risveglia"}
                          </button>
                          <button onClick={() => startEdit(boss)} className="wb-btn ghost">✎</button>
                          <button onClick={() => handleDeleteBoss(boss)} className="wb-btn danger">🗑</button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="wb-edit">
                      <div className="wb-section-head"><h2>✎ {editData.name || "Modifica"}</h2></div>

                      <div className="wb-edit-sprites">
                        <SpriteDropzone
                          label="Sprite Vivo"
                          icon="🩸"
                          value={editData.imageUrl}
                          uploading={uploadState.editAlive}
                          onFile={onEditAlive}
                          onClear={() => {
                            cleanupStorageUrl(editData.imageUrl);
                            setEditData((d) => ({ ...d, imageUrl: "" }));
                          }}
                          accent="#d4af37"
                        />
                        <SpriteDropzone
                          label="Sprite Morto"
                          icon="💀"
                          value={editData.deadImageUrl}
                          uploading={uploadState.editDead}
                          onFile={onEditDead}
                          onClear={() => {
                            cleanupStorageUrl(editData.deadImageUrl);
                            setEditData((d) => ({ ...d, deadImageUrl: "" }));
                          }}
                          accent="#7a0808"
                        />
                      </div>

                      <div className="wb-edit-grid">
                        <div className="wb-field">
                          <label>Nome</label>
                          <input className="admin-field-input" value={editData.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                        </div>
                        <div className="wb-field">
                          <label>CA</label>
                          <input className="admin-field-input" type="number" value={editData.ac || ""} onChange={(e) => setEditData({ ...editData, ac: e.target.value })} />
                        </div>
                        <div className="wb-field">
                          <label>Max HP</label>
                          <input className="admin-field-input" type="number" value={editData.maxHp || ""} onChange={(e) => setEditData({ ...editData, maxHp: e.target.value })} />
                        </div>
                        <div className="wb-field">
                          <label>HP correnti</label>
                          <input className="admin-field-input" type="number" value={editData.hp ?? ""} onChange={(e) => setEditData({ ...editData, hp: e.target.value })} />
                        </div>
                      </div>

                      <div className="wb-field">
                        <label>Scadenza</label>
                        <DateTimePicker
                          value={editData.expiryDate || ""}
                          onChange={(v) => setEditData({ ...editData, expiryDate: v })}
                          presets="auction"
                          placeholder="Nuova scadenza"
                        />
                      </div>
                      <div className="wb-field">
                        <label>Descrizione</label>
                        <textarea className="admin-field-textarea" value={editData.description || ""} onChange={(e) => setEditData({ ...editData, description: e.target.value })} rows="2" />
                      </div>
                      <div className="wb-field-row2">
                        <div className="wb-field">
                          <label>Ricompense</label>
                          <textarea className="admin-field-textarea" value={editData.rewards || ""} onChange={(e) => setEditData({ ...editData, rewards: e.target.value })} rows="2" />
                        </div>
                        <div className="wb-field">
                          <label>Penalità</label>
                          <textarea className="admin-field-textarea" value={editData.penalties || ""} onChange={(e) => setEditData({ ...editData, penalties: e.target.value })} rows="2" />
                        </div>
                      </div>

                      <div className="wb-actions-section">
                        <div className="wb-actions-head">
                          <label>
                            ⚔ Azioni del Boss
                            <small>{(editData.actions || []).length}/{MAX_ACTIONS}</small>
                          </label>
                          <button
                            type="button"
                            className="wb-add-action-btn"
                            onClick={addEditAction}
                            disabled={(editData.actions || []).length >= MAX_ACTIONS}
                            title={
                              (editData.actions || []).length >= MAX_ACTIONS
                                ? `Massimo ${MAX_ACTIONS} azioni`
                                : "Aggiungi un'azione"
                            }
                          >
                            + Aggiungi
                          </button>
                        </div>
                        <div className="wb-actions-grid">
                          {(editData.actions || []).map((a, idx) => (
                            <ActionEditor
                              key={idx}
                              action={a}
                              idx={idx}
                              onChange={(patch) => updateEditAction(idx, patch)}
                              onRemove={() => removeEditAction(idx)}
                              canRemove={(editData.actions || []).length > MIN_ACTIONS}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="wb-edit-actions">
                        <button onClick={() => saveEdit(boss.id)} className="wb-btn primary">💾 Salva</button>
                        <button onClick={() => setEditingId(null)} className="wb-btn ghost">Annulla</button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
