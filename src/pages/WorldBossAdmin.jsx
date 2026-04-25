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
import "./admin.css";
import "./WorldBossAdmin.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

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
  action1: { name: "", diceNum: 1, diceType: "d6", bonus: 0 },
  action2: { name: "", diceNum: 1, diceType: "d8", bonus: 0 },
};

const DICE = ["d4", "d6", "d8", "d10", "d12", "d20"];

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
    setEditData({ ...boss });
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
          <p className="wb-hero-sub">Forgia, evoca e governa le calamità di Eldoria</p>
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

            <div className="wb-actions-grid">
              {[1, 2].map((n) => {
                const k = `action${n}`;
                const a = newBoss[k];
                return (
                  <div key={k} className="wb-action-block">
                    <label>⚔ Azione {n}</label>
                    <input
                      className="admin-field-input"
                      placeholder={n === 1 ? "Artiglio del Vuoto" : "Grido della Fine"}
                      value={a.name}
                      onChange={(e) => setNewBoss({ ...newBoss, [k]: { ...a, name: e.target.value } })}
                    />
                    <div className="wb-dice-row">
                      <input
                        className="admin-field-input"
                        type="number"
                        placeholder="N°"
                        value={a.diceNum}
                        onChange={(e) => setNewBoss({ ...newBoss, [k]: { ...a, diceNum: e.target.value } })}
                      />
                      <select
                        className="admin-field-input"
                        value={a.diceType}
                        onChange={(e) => setNewBoss({ ...newBoss, [k]: { ...a, diceType: e.target.value } })}
                      >
                        {DICE.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <input
                        className="admin-field-input"
                        type="number"
                        placeholder="+"
                        value={a.bonus}
                        onChange={(e) => setNewBoss({ ...newBoss, [k]: { ...a, bonus: e.target.value } })}
                      />
                    </div>
                  </div>
                );
              })}
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

                      <div className="wb-field-row2">
                        <div className="wb-field">
                          <label>Azione 1</label>
                          <input className="admin-field-input" value={editData.action1?.name || ""} onChange={(e) => setEditData({ ...editData, action1: { ...editData.action1, name: e.target.value } })} />
                        </div>
                        <div className="wb-field">
                          <label>Azione 2</label>
                          <input className="admin-field-input" value={editData.action2?.name || ""} onChange={(e) => setEditData({ ...editData, action2: { ...editData.action2, name: e.target.value } })} />
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
