import React, { useState, useEffect, useMemo, useRef } from "react";
import { db, storage } from "../firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { Link } from "react-router-dom";
import "./admin.css";

const PARTY_ROSTER = {
  AMEA: ["Tanagar", "Garroth", "Caius Maxis-Richtofen"],
  ENOX: ["Temistocle Sottocolle Milo", "Dante", "Roynot", "Vyger", "Timoty Bevibotte", "Alaric Voltasorte"],
  LAC: ["Horn", "Thinkle Muschioverde", "Cleofe"],
  LEAF: ["Makenna", "Taaras Stormrage", "Soran", "Zethir"],
  ECO: ["Aksel", "Dago", "Ismael Van Dyke"],
};

const PARTY_COLORS = {
  AMEA: "#c0392b",
  ENOX: "#8e44ad",
  LAC: "#2980b9",
  LEAF: "#27ae60",
  ECO: "#0f766e",
};

const DIFFICULTIES = [
  { key: "Facile",   color: "#27ae60", icon: "🌿" },
  { key: "Media",    color: "#2980b9", icon: "⚔" },
  { key: "Difficile",color: "#d97706", icon: "🔥" },
  { key: "Eroica",   color: "#c0392b", icon: "👑" },
];

const diffMeta = (k) => DIFFICULTIES.find((d) => d.key === k) || DIFFICULTIES[1];

const getPartyByCharName = (name) => {
  for (const [party, members] of Object.entries(PARTY_ROSTER)) {
    if (members.includes(name)) return party;
  }
  return "Senza Gruppo";
};

const initialForm = {
  title: "",
  desc: "",
  diff: "Media",
  type: "Generale",
  cr: "1",
  zona: "",
  rewardGold: 0,
  rewardItem: "",
  rewardOther: "",
  targetCharacter: "All",
  coverImage: "",
};

/* ──────────────────────────────────────────────────────────────
   DropZone — same pattern
   ────────────────────────────────────────────────────────────── */
const DropZone = ({ value, uploading, onFile, onClear, label, icon = "📜" }) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={`qstadm-drop ${dragOver ? "drag" : ""} ${uploading ? "loading" : ""} ${value ? "filled" : ""}`}
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
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <div className="qstadm-drop-state">
          <span className="qstadm-drop-spinner" />
          <strong>Sigillo in corso…</strong>
        </div>
      ) : value ? (
        <>
          <img src={value} alt="" className="qstadm-drop-img" onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
          <div className="qstadm-drop-overlay">
            <span>📤 Cambia copertina</span>
            {onClear && (
              <button
                type="button"
                className="qstadm-drop-clear"
                onClick={(e) => { e.stopPropagation(); onClear(); }}
              >
                ✕ Rimuovi
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="qstadm-drop-state">
          <span className="qstadm-drop-icon">{icon}</span>
          <strong>{label}</strong>
          <small>Trascina o clicca · max 5MB</small>
        </div>
      )}
    </div>
  );
};

export default function QuestAdmin() {
  const [quests, setQuests] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sender, setSender] = useState("");
  const [formData, setFormData] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [filterDiff, setFilterDiff] = useState("all");
  const [filterTarget, setFilterTarget] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsubQ = onSnapshot(collection(db, "quests"), (snap) => {
      setQuests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubC = onSnapshot(collection(db, "characters"), (snap) => {
      setCharacters(
        snap.docs.map((d) => ({
          id: d.id,
          charName: d.data().name || "Eroe Senza Nome",
        }))
      );
    });
    return () => { unsubQ(); unsubC(); };
  }, []);

  /* ── Storage helpers ── */
  const uploadCover = async (file) => {
    if (!file?.type?.startsWith("image/")) {
      alert("Seleziona un file immagine valido.");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Immagine troppo grande (max 5MB).");
      return null;
    }
    setUploading(true);
    try {
      const safe = (file.name || "quest").replace(/[^a-z0-9._-]/gi, "_").slice(0, 36);
      const path = `quests/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file, { contentType: file.type });
      return await getDownloadURL(ref);
    } catch (err) {
      console.error("Upload fallito:", err);
      alert("Errore upload: " + (err.message || err.code));
      return null;
    } finally {
      setUploading(false);
    }
  };

  const cleanupStorageUrl = async (url) => {
    if (!url || !url.includes("firebasestorage.googleapis.com")) return;
    try { await deleteObject(storageRef(storage, url)); }
    catch (err) { console.warn("Storage cleanup skipped:", err.code); }
  };

  const onCoverFile = async (file) => {
    const url = await uploadCover(file);
    if (url) {
      if (formData.coverImage) cleanupStorageUrl(formData.coverImage);
      setFormData((d) => ({ ...d, coverImage: url }));
    }
  };

  /* ── Form handlers ── */
  const resetForm = () => {
    setFormData(initialForm);
    setSender("");
    setEditingId(null);
  };

  const handleEdit = (quest) => {
    setEditingId(quest.id);
    setFormData({
      title: quest.title || "",
      desc: quest.desc || "",
      diff: quest.diff || "Media",
      type: quest.type || "Generale",
      cr: quest.cr || "1",
      zona: quest.zona || "",
      rewardGold: quest.rewardGold || 0,
      rewardItem: quest.rewardItem || "",
      rewardOther: quest.rewardOther || "",
      targetCharacter:
        quest.targetParty && quest.targetParty !== "All"
          ? quest.targetParty
          : quest.targetCharacter || "All",
      coverImage: quest.coverImage || "",
    });
    setSender(quest.sender || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploading) return;
    setLoading(true);
    try {
      const isParty = ["AMEA", "ENOX", "LAC", "LEAF", "ECO"].includes(formData.targetCharacter);
      const payload = {
        ...formData,
        sender,
        targetParty: isParty ? formData.targetCharacter : "All",
        targetCharacter: isParty ? "All" : formData.targetCharacter,
        rewardGold: Number(formData.rewardGold),
      };

      if (editingId) {
        await updateDoc(doc(db, "quests", editingId), {
          ...payload,
          updatedAt: new Date().toISOString(),
        });
        alert("📜 Pergamena aggiornata.");
      } else {
        await addDoc(collection(db, "quests"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        alert("📜 La pergamena è stata sigillata e appesa!");
      }
      resetForm();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      alert("Errore: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (quest) => {
    if (!window.confirm(`Strappare "${quest.title}" dalla bacheca?`)) return;
    try {
      await cleanupStorageUrl(quest.coverImage);
      await deleteDoc(doc(db, "quests", quest.id));
    } catch (err) {
      alert("Errore: " + err.message);
    }
  };

  const fixAcceptedParty = async (q) => {
    if (!q.acceptedBy) return;
    const correctedParty = getPartyByCharName(q.acceptedBy);
    await updateDoc(doc(db, "quests", q.id), { acceptedParty: correctedParty });
    alert(`Corretto: ${q.acceptedBy} → ${correctedParty}`);
  };

  /* ── Stats / filters ── */
  const stats = useMemo(() => {
    const total = quests.length;
    const accepted = quests.filter((q) => q.acceptedBy).length;
    const publicQ = quests.filter((q) => q.targetCharacter === "All" && q.targetParty === "All").length;
    const heroic = quests.filter((q) => q.diff === "Eroica").length;
    return { total, accepted, publicQ, heroic, open: total - accepted };
  }, [quests]);

  const filteredQuests = useMemo(() => {
    const q = search.toLowerCase().trim();
    return quests
      .filter((x) => {
        if (filterDiff !== "all" && x.diff !== filterDiff) return false;
        if (filterTarget === "public" && !(x.targetCharacter === "All" && x.targetParty === "All")) return false;
        if (filterTarget === "private" && x.targetCharacter === "All" && x.targetParty === "All") return false;
        if (filterTarget === "accepted" && !x.acceptedBy) return false;
        if (filterTarget === "open" && x.acceptedBy) return false;
        if (!q) return true;
        return (
          (x.title || "").toLowerCase().includes(q) ||
          (x.zona || "").toLowerCase().includes(q) ||
          (x.sender || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [quests, filterDiff, filterTarget, search]);

  const previewDiff = diffMeta(formData.diff);
  const isPartyTarget = ["AMEA", "ENOX", "LAC", "LEAF", "ECO"].includes(formData.targetCharacter);

  return (
    <section className="admin-quest-page qstadm">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard Master</Link>

      {/* ── HERO ── */}
      <header className="qstadm-hero">
        <div className="qstadm-hero-titles">
          <h1 className="qstadm-title">📜 Bacheca di Hemile</h1>
          <p className="qstadm-sub">Sigilla missive, assegna ricompense, governa le voci della Locanda</p>
        </div>
        <div className="qstadm-stats">
          <div className="qstadm-stat"><span>Pergamene</span><strong>{stats.total}</strong></div>
          <div className="qstadm-stat open"><span>Aperte</span><strong>{stats.open}</strong></div>
          <div className="qstadm-stat accepted"><span>Accettate</span><strong>{stats.accepted}</strong></div>
          <div className="qstadm-stat"><span>Pubbliche</span><strong>{stats.publicQ}</strong></div>
          <div className="qstadm-stat heroic"><span>Eroiche</span><strong>{stats.heroic}</strong></div>
        </div>
      </header>

      {/* ── WORKSHOP ── */}
      <div className="qstadm-workshop">
        <section className="qstadm-card">
          <div className="qstadm-card-head">
            <h2>{editingId ? "✎ Modifica Pergamena" : "✨ Nuova Missiva"}</h2>
            {editingId && <span className="qstadm-edit-tag">{editingId.slice(0, 14)}…</span>}
          </div>

          <form onSubmit={handleSubmit} className="qstadm-form">
            <div className="qstadm-row2">
              <div className="qstadm-field">
                <label>Titolo della Quest</label>
                <input
                  className="admin-field-input"
                  placeholder="Es. Il Lupo del Crepuscolo"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="qstadm-field">
                <label>Mittente</label>
                <input
                  className="admin-field-input"
                  placeholder="Es. Hemile, Un Corvo Ignoto…"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="qstadm-field">
              <label>Copertina (opzionale)</label>
              <DropZone
                value={formData.coverImage}
                uploading={uploading}
                onFile={onCoverFile}
                onClear={() => {
                  cleanupStorageUrl(formData.coverImage);
                  setFormData((d) => ({ ...d, coverImage: "" }));
                }}
                label="Sigilla un'illustrazione"
                icon="🗝"
              />
              <input
                type="url"
                className="admin-field-input qstadm-url"
                placeholder="…oppure incolla un URL diretto"
                value={formData.coverImage}
                onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              />
            </div>

            <div className="qstadm-field">
              <label>Descrizione (lore e obiettivi)</label>
              <textarea
                className="admin-field-textarea"
                placeholder="Una notte di Eldarin, nel bosco di Tassio si sente l'ululato…"
                value={formData.desc}
                onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                required
                rows="5"
              />
            </div>

            <div className="qstadm-row2">
              <div className="qstadm-field">
                <label>Difficoltà</label>
                <div className="qstadm-diff-pills">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      className={`qstadm-diff-pill ${formData.diff === d.key ? "on" : ""}`}
                      style={formData.diff === d.key ? { background: d.color, borderColor: d.color, color: "#fff" } : { borderColor: d.color, color: d.color }}
                      onClick={() => setFormData({ ...formData, diff: d.key })}
                    >
                      {d.icon} {d.key}
                    </button>
                  ))}
                </div>
              </div>
              <div className="qstadm-field">
                <label>Zona di Exanthia</label>
                <input
                  className="admin-field-input"
                  placeholder="Es. Foresta di Tassio"
                  value={formData.zona}
                  onChange={(e) => setFormData({ ...formData, zona: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="qstadm-rewards">
              <label className="qstadm-rewards-label">🏆 Ricompense</label>
              <div className="qstadm-row3">
                <div className="qstadm-field">
                  <label>Platino</label>
                  <input
                    className="admin-field-input"
                    type="number"
                    placeholder="0"
                    value={formData.rewardGold}
                    onChange={(e) => setFormData({ ...formData, rewardGold: e.target.value })}
                  />
                </div>
                <div className="qstadm-field">
                  <label>Oggetto / Loot</label>
                  <input
                    className="admin-field-input"
                    placeholder="Es. Anello di Vyrra"
                    value={formData.rewardItem}
                    onChange={(e) => setFormData({ ...formData, rewardItem: e.target.value })}
                  />
                </div>
                <div className="qstadm-field">
                  <label>Altro</label>
                  <input
                    className="admin-field-input"
                    placeholder="Es. Favore di Hemile"
                    value={formData.rewardOther}
                    onChange={(e) => setFormData({ ...formData, rewardOther: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="qstadm-field">
              <label>📨 Destinatario (segretezza)</label>
              <select
                className="admin-field-select"
                value={formData.targetCharacter}
                onChange={(e) => setFormData({ ...formData, targetCharacter: e.target.value })}
              >
                <option value="All">🌍 Pubblica (visibile a tutti)</option>
                <optgroup label="🛡 Party">
                  <option value="AMEA">Solo Party AMEA</option>
                  <option value="ENOX">Solo Party ENOX</option>
                  <option value="LAC">Solo Party LAC</option>
                  <option value="LEAF">Solo Party LEAF</option>
                  <option value="ECO">Solo Party ECO</option>
                </optgroup>
                <optgroup label="👤 Personaggi">
                  {characters.map((char) => (
                    <option key={char.id} value={char.charName}>Solo per {char.charName}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="qstadm-actions">
              <button type="submit" disabled={loading || uploading} className="qstadm-btn primary">
                {uploading ? "⏳ Upload…" : loading ? "Affiggendo…" : editingId ? "💾 Salva modifiche" : "🪄 Appendi alla bacheca"}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="qstadm-btn ghost">Annulla</button>
              )}
            </div>
          </form>
        </section>

        {/* LIVE PREVIEW — looks like a wax-sealed scroll */}
        <aside className="qstadm-preview">
          <div className="qstadm-card-head">
            <h2>👁 Anteprima Pergamena</h2>
            <small>Come apparirà sulla bacheca</small>
          </div>
          <div
            className="qstadm-scroll"
            style={{ "--diff-color": previewDiff.color }}
          >
            {formData.coverImage && (
              <div className="qstadm-scroll-cover">
                <img src={formData.coverImage} alt="" onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
              </div>
            )}
            <div className="qstadm-scroll-body">
              <div className="qstadm-scroll-meta">
                <span className="qstadm-scroll-diff" style={{ background: previewDiff.color }}>
                  {previewDiff.icon} {formData.diff}
                </span>
                {formData.zona && <span className="qstadm-scroll-zone">📍 {formData.zona}</span>}
              </div>
              <h3 className="qstadm-scroll-title">{formData.title || "Titolo della Missiva"}</h3>
              {sender && <p className="qstadm-scroll-sender">— Da: <em>{sender}</em></p>}
              <p className="qstadm-scroll-desc">
                {formData.desc || "La descrizione della missione apparirà qui…"}
              </p>

              {(formData.rewardGold > 0 || formData.rewardItem || formData.rewardOther) && (
                <div className="qstadm-scroll-rewards">
                  <strong>🏆 Ricompensa:</strong>
                  <div className="qstadm-scroll-reward-list">
                    {formData.rewardGold > 0 && <span>💰 {formData.rewardGold} MP</span>}
                    {formData.rewardItem && <span>🎁 {formData.rewardItem}</span>}
                    {formData.rewardOther && <span>✨ {formData.rewardOther}</span>}
                  </div>
                </div>
              )}

              <div className="qstadm-scroll-target">
                {formData.targetCharacter === "All" ? (
                  <span>🌍 Pubblica</span>
                ) : isPartyTarget ? (
                  <span style={{ color: PARTY_COLORS[formData.targetCharacter] }}>
                    🛡 Solo Party {formData.targetCharacter}
                  </span>
                ) : (
                  <span>👤 Solo per {formData.targetCharacter}</span>
                )}
              </div>
            </div>
            <div className="qstadm-scroll-seal" style={{ background: previewDiff.color }}>
              {previewDiff.icon}
            </div>
          </div>
        </aside>
      </div>

      {/* ── ARCHIVE ── */}
      <section className="qstadm-archive">
        <div className="qstadm-archive-head">
          <h2>🗂 Bacheca Attiva <small>({filteredQuests.length}/{quests.length})</small></h2>
          <input
            type="search"
            className="admin-field-input qstadm-search"
            placeholder="🔍 Cerca per titolo, zona o mittente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="qstadm-filter-row">
          <div className="qstadm-filter-group">
            <span className="qstadm-filter-label">Difficoltà:</span>
            <button className={`qstadm-filter ${filterDiff === "all" ? "on" : ""}`} onClick={() => setFilterDiff("all")}>Tutte</button>
            {DIFFICULTIES.map((d) => (
              <button
                key={d.key}
                className={`qstadm-filter ${filterDiff === d.key ? "on" : ""}`}
                style={filterDiff === d.key ? { background: d.color, borderColor: d.color, color: "#fff" } : { borderColor: d.color, color: d.color }}
                onClick={() => setFilterDiff(d.key)}
              >
                {d.icon} {d.key}
              </button>
            ))}
          </div>
          <div className="qstadm-filter-group">
            <span className="qstadm-filter-label">Stato:</span>
            {[
              { k: "all", label: "Tutte" },
              { k: "open", label: "Aperte" },
              { k: "accepted", label: "Accettate" },
              { k: "public", label: "Pubbliche" },
              { k: "private", label: "Private" },
            ].map((t) => (
              <button
                key={t.k}
                className={`qstadm-filter ${filterTarget === t.k ? "on" : ""}`}
                onClick={() => setFilterTarget(t.k)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {filteredQuests.length === 0 ? (
          <p className="qstadm-empty">Nessuna missiva corrisponde ai filtri.</p>
        ) : (
          <div className="qstadm-grid">
            {filteredQuests.map((q) => {
              const dm = diffMeta(q.diff);
              const isPublic = q.targetCharacter === "All" && (!q.targetParty || q.targetParty === "All");
              const targetLabel = isPublic
                ? "🌍 Pubblica"
                : q.targetParty && q.targetParty !== "All"
                  ? `🛡 ${q.targetParty}`
                  : `👤 ${q.targetCharacter}`;
              const targetColor = q.targetParty && q.targetParty !== "All" ? PARTY_COLORS[q.targetParty] : null;

              return (
                <article
                  key={q.id}
                  className={`qstadm-quest ${q.acceptedBy ? "accepted" : ""}`}
                  style={{ "--diff-color": dm.color }}
                >
                  <div className="qstadm-quest-cover">
                    {q.coverImage ? (
                      <img src={q.coverImage} alt={q.title} onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
                    ) : (
                      <div className="qstadm-quest-noimg">📜</div>
                    )}
                    <span className="qstadm-quest-diff" style={{ background: dm.color }}>
                      {dm.icon} {q.diff}
                    </span>
                    {q.acceptedBy && <div className="qstadm-quest-accepted">⚔ {q.acceptedBy}</div>}
                  </div>

                  <div className="qstadm-quest-body">
                    <h4 className="qstadm-quest-title">{q.title}</h4>
                    <p className="qstadm-quest-sender">— da {q.sender || "Anonimo"}</p>
                    <p className="qstadm-quest-zone">{q.zona && <>📍 {q.zona}</>}</p>

                    <span
                      className="qstadm-quest-target"
                      style={targetColor ? { color: targetColor, borderColor: targetColor } : {}}
                    >
                      {targetLabel}
                    </span>

                    {(q.rewardGold > 0 || q.rewardItem) && (
                      <div className="qstadm-quest-rewards">
                        {q.rewardGold > 0 && <span>💰 {q.rewardGold}</span>}
                        {q.rewardItem && <span>🎁 {q.rewardItem}</span>}
                      </div>
                    )}
                  </div>

                  <div className="qstadm-quest-actions">
                    {q.acceptedBy && (!q.acceptedParty || q.acceptedParty === "Senza Gruppo") && (
                      <button onClick={() => fixAcceptedParty(q)} className="qstadm-icon fix" title="Correggi party accettante">🔧</button>
                    )}
                    <button onClick={() => handleEdit(q)} className="qstadm-icon edit" title="Modifica">✎</button>
                    <button onClick={() => handleDelete(q)} className="qstadm-icon danger" title="Strappa dalla bacheca">🗑</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
