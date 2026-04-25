import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { db, storage } from "../firebase";
import "./admin.css";
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import HtmlToolbar from "../components/HtmlToolbar";
import { createMarketItem } from "../utils/itemTemplates";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const RARITIES = ["Comune", "Raro", "Magico", "Epico", "Leggendario"];
const ITEM_TYPES = ["Arma", "Armatura", "Accessori", "Artefatto Magico", "Pozioni", "Pergamene", "Reagenti", "Varie"];

const initialFormData = {
  name: "", type: "Arma", class: "Comune", saleType: "auction",
  startingBid: "", endDate: "", description: "", img: "", minLevel: 0,
};

const formatEndDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const formatTimeLeft = (iso) => {
  if (!iso) return null;
  const diff = new Date(iso) - new Date();
  if (diff <= 0) return { text: "Scaduta", expired: true };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return { text: `${d}g ${h}h`, expired: false };
  if (h > 0) return { text: `${h}h ${m}m`, expired: false };
  return { text: `${m}m`, expired: false };
};

export default function MarketAdmin() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [globalCountdown, setGlobalCountdown] = useState("");
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const descRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleImageUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Per favore seleziona un file immagine valido (jpg, png, webp, gif).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Immagine troppo grande (max 5MB). Comprimi il file e riprova.");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_").slice(0, 40);
      const path = `market-items/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file, { contentType: file.type });
      const url = await getDownloadURL(ref);
      setFormData(prev => ({ ...prev, img: url }));
    } catch (err) {
      console.error("Upload error:", err);
      alert("Errore durante l'upload: " + (err.message || err.code || "sconosciuto"));
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  };

  const handleClearImage = (e) => {
    e?.stopPropagation();
    setFormData(prev => ({ ...prev, img: "" }));
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Eliminare "${item.name}"?`)) return;
    try {
      if (item.img && item.img.includes("firebasestorage.googleapis.com")) {
        try {
          await deleteObject(storageRef(storage, item.img));
        } catch (err) {
          console.warn("Pulizia storage fallita (file forse già eliminato):", err.code);
        }
      }
      await deleteDoc(doc(db, "items", item.id));
    } catch (err) {
      alert("Errore eliminazione: " + err.message);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.email !== MASTER_EMAIL) return;
    const unsubConfig = onSnapshot(doc(db, "settings", "market_config"), (snap) => {
      if (snap.exists()) setGlobalCountdown(snap.data().nextOpening || "");
    });
    const unsubItems = onSnapshot(collection(db, "items"), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubConfig(); unsubItems(); };
  }, [currentUser]);

  const handleUpdateCountdown = async () => {
    await setDoc(doc(db, "settings", "market_config"), { nextOpening: globalCountdown });
    alert("✅ Programmazione salvata!");
  };

  const handleEditInit = (item) => {
    setEditId(item.id);
    setFormData({
      ...initialFormData,
      ...item,
      saleType: "auction",
      endDate: item.endDate ? new Date(item.endDate).toISOString().slice(0, 16) : ""
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploading) return;
    if (!formData.img) {
      alert("Carica un'immagine prima di salvare l'oggetto.");
      return;
    }
    setLoading(true);
    const dataToSubmit = {
      ...formData,
      saleType: "auction",
      startingBid: Number(formData.startingBid || 0)
    };

    if (editId) {
      await updateDoc(doc(db, "items", editId), dataToSubmit);
      setEditId(null);
    } else {
      await setDoc(doc(collection(db, "items")), createMarketItem(dataToSubmit));
    }
    setFormData(initialFormData);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter(i => !i.isSold && (!i.endDate || new Date(i.endDate) > new Date())).length;
    const sold = items.filter(i => i.isSold).length;
    const expired = items.filter(i => !i.isSold && i.endDate && new Date(i.endDate) <= new Date()).length;
    const bids = items.reduce((s, i) => s + (i.bids ? Object.keys(i.bids).length : 0), 0);
    return { total, active, sold, expired, bids };
  }, [items]);

  const visibleItems = useMemo(() => {
    return items.filter(i => {
      if (filter === "all") return true;
      if (filter === "active") return !i.isSold && (!i.endDate || new Date(i.endDate) > new Date());
      if (filter === "sold") return i.isSold;
      if (filter === "expired") return !i.isSold && i.endDate && new Date(i.endDate) <= new Date();
      return true;
    });
  }, [items, filter]);

  const previewRarityKey = (formData.class || "Comune").replace(/\s/g, "");

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <p style={{ textAlign: "center", paddingTop: "100px" }}>Accesso negato.</p>;
  }

  return (
    <section className="admin-market-page mkadm">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard</Link>

      {/* ─── HERO STATS BAR ─── */}
      <div className="mkadm-hero">
        <div className="mkadm-hero-titles">
          <h1 className="mkadm-title">⚔ Forgia del Mercato Nero</h1>
          <p className="mkadm-subtitle">Solo aste alla cieca · Crea, modifica e gestisci il magazzino</p>
        </div>
        <div className="mkadm-stats">
          <div className="mkadm-stat"><span>Totale</span><strong>{stats.total}</strong></div>
          <div className="mkadm-stat active"><span>Attive</span><strong>{stats.active}</strong></div>
          <div className="mkadm-stat sold"><span>Vendute</span><strong>{stats.sold}</strong></div>
          <div className="mkadm-stat expired"><span>Scadute</span><strong>{stats.expired}</strong></div>
          <div className="mkadm-stat bids"><span>Offerte</span><strong>{stats.bids}</strong></div>
        </div>
      </div>

      {/* ─── MARKET OPENING CONFIG ─── */}
      <div className="mkadm-config">
        <div className="mkadm-config-icon">⏰</div>
        <div className="mkadm-config-body">
          <label className="mkadm-config-label">Prossima apertura mercato</label>
          <div className="mkadm-config-row">
            <input
              type="datetime-local"
              className="admin-field-input"
              value={globalCountdown}
              onChange={(e) => setGlobalCountdown(e.target.value)}
            />
            <button onClick={handleUpdateCountdown} className="mkadm-btn-save">Salva</button>
          </div>
        </div>
      </div>

      {/* ─── EDITOR + LIVE PREVIEW ─── */}
      <div className="mkadm-workshop">
        <div className="mkadm-editor">
          <div className="mkadm-editor-head">
            <h2>{editId ? "✎ Modifica oggetto" : "✨ Nuovo oggetto"}</h2>
            {editId && <span className="mkadm-edit-tag">Editing #{editId.slice(0, 6)}</span>}
          </div>

          <form onSubmit={handleSubmit} className="mkadm-form">
            <div className="mkadm-field">
              <label>Nome oggetto</label>
              <input
                className="admin-field-input"
                placeholder="Es. Spada del Tramonto"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="mkadm-field-row">
              <div className="mkadm-field">
                <label>Rarità</label>
                <select
                  className="admin-field-select"
                  required
                  value={formData.class}
                  onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                >
                  {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="mkadm-field">
                <label>Tipo</label>
                <select
                  className="admin-field-select"
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="mkadm-field-row">
              <div className="mkadm-field">
                <label>Base d'asta (MP)</label>
                <input
                  className="admin-field-input"
                  type="number"
                  placeholder="0"
                  required
                  value={formData.startingBid}
                  onChange={(e) => setFormData({ ...formData, startingBid: e.target.value })}
                />
              </div>
              <div className="mkadm-field">
                <label>Livello Ratto min</label>
                <input
                  className="admin-field-input"
                  type="number"
                  placeholder="0"
                  required
                  value={formData.minLevel}
                  onChange={(e) => setFormData({ ...formData, minLevel: e.target.value })}
                />
              </div>
            </div>

            <div className="mkadm-field">
              <label>Scadenza asta</label>
              <input
                className="admin-field-input"
                type="datetime-local"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>

            <div className="mkadm-field">
              <label>Immagine</label>
              <div
                className={`mkadm-drop ${dragOver ? "drag" : ""} ${uploading ? "loading" : ""} ${formData.img ? "filled" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = "";
                  }}
                />
                {uploading ? (
                  <div className="mkadm-drop-state">
                    <span className="mkadm-drop-spinner" />
                    <strong>Caricamento in corso…</strong>
                    <small>Attendi qualche istante</small>
                  </div>
                ) : formData.img ? (
                  <div className="mkadm-drop-preview">
                    <img src={formData.img} alt="" onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
                    <div className="mkadm-drop-overlay">
                      <span>📤 Cambia immagine</span>
                      <button type="button" className="mkadm-drop-clear" onClick={handleClearImage}>✕ Rimuovi</button>
                    </div>
                  </div>
                ) : (
                  <div className="mkadm-drop-state">
                    <span className="mkadm-drop-icon">📥</span>
                    <strong>Trascina qui un'immagine</strong>
                    <small>oppure clicca per selezionarla · max 5MB</small>
                  </div>
                )}
              </div>
              <input
                type="url"
                className="admin-field-input mkadm-img-url"
                placeholder="…oppure incolla un URL diretto"
                value={formData.img}
                onChange={(e) => setFormData({ ...formData, img: e.target.value })}
              />
            </div>

            <div className="mkadm-field">
              <label>Descrizione (HTML consentito)</label>
              <HtmlToolbar textAreaRef={descRef} formData={formData} setFormData={setFormData} fieldName="description" />
              <textarea
                ref={descRef}
                className="admin-field-textarea"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows="5"
              />
            </div>

            <div className="mkadm-form-actions">
              <button type="submit" disabled={loading || uploading} className="mkadm-btn-primary">
                {uploading ? "⏳ Upload in corso…" : editId ? "💾 Salva modifiche" : "🪄 Crea oggetto"}
              </button>
              {editId && (
                <button type="button" onClick={handleCancelEdit} className="mkadm-btn-secondary">
                  Annulla
                </button>
              )}
            </div>
          </form>
        </div>

        {/* LIVE PREVIEW */}
        <aside className="mkadm-preview">
          <div className="mkadm-preview-head">
            <span className="mkadm-preview-label">👁 Anteprima player</span>
            <span className="mkadm-preview-hint">Come apparirà nel mercato</span>
          </div>
          <div className={`mkadm-preview-card rarity-bg-${previewRarityKey}`}>
            <div className="mkadm-preview-img-wrap">
              {formData.img
                ? <img src={formData.img} alt="" className="mkadm-preview-img" onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
                : <div className="mkadm-preview-placeholder">🖼<small>Nessuna immagine</small></div>}
              <span className={`mkadm-preview-rarity rarity-${previewRarityKey}`}>{formData.class || "Comune"}</span>
            </div>
            <div className="mkadm-preview-body">
              <p className="mkadm-preview-type">{formData.type || "—"}</p>
              <h3 className="mkadm-preview-name">{formData.name || "Nome oggetto"}</h3>
              <p className="mkadm-preview-bid">
                Base d'asta: <strong>{formData.startingBid || 0} MP</strong>
              </p>
              {formData.endDate && (
                <p className="mkadm-preview-deadline">
                  ⏳ Scade il {formatEndDate(formData.endDate)}
                </p>
              )}
              {formData.description && (
                <div
                  className="mkadm-preview-desc"
                  dangerouslySetInnerHTML={{ __html: formData.description }}
                />
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ─── INVENTORY ─── */}
      <div className="mkadm-inventory">
        <div className="mkadm-inv-head">
          <h2>📦 Magazzino <small>({visibleItems.length}/{items.length})</small></h2>
          <div className="mkadm-filter-tabs">
            {[
              { k: "all", label: "Tutti" },
              { k: "active", label: "Attivi" },
              { k: "sold", label: "Venduti" },
              { k: "expired", label: "Scaduti" },
            ].map(t => (
              <button
                key={t.k}
                className={`mkadm-filter ${filter === t.k ? "on" : ""}`}
                onClick={() => setFilter(t.k)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <p className="mkadm-empty">Nessun oggetto in questa vista.</p>
        ) : (
          <div className="mkadm-inv-grid">
            {visibleItems.map(item => {
              const rk = (item.class || "Comune").replace(/\s/g, "");
              const tl = formatTimeLeft(item.endDate);
              const bidCount = item.bids ? Object.keys(item.bids).length : 0;
              const isExpired = !item.isSold && tl?.expired;
              return (
                <article key={item.id} className={`mkadm-inv-card rarity-bg-${rk} ${item.isSold ? "is-sold" : ""} ${isExpired ? "is-expired" : ""}`}>
                  <div className="mkadm-inv-thumb-wrap">
                    <img
                      src={item.img || "/assets/placeholder.jpg"}
                      alt={item.name}
                      className="mkadm-inv-thumb"
                    />
                    <span className={`mkadm-inv-rarity rarity-${rk}`}>{item.class || "Comune"}</span>
                    {item.isSold && <div className="mkadm-inv-badge sold">VENDUTO</div>}
                    {isExpired && <div className="mkadm-inv-badge expired">SCADUTA</div>}
                  </div>
                  <div className="mkadm-inv-body">
                    <h4 className="mkadm-inv-name" title={item.name}>{item.name}</h4>
                    <p className="mkadm-inv-type">{item.type}</p>
                    <div className="mkadm-inv-row">
                      <span className="mkadm-inv-price">Base <strong>{item.startingBid || item.price || 0}</strong> MP</span>
                      {bidCount > 0 && <span className="mkadm-inv-bids">📢 {bidCount}</span>}
                    </div>
                    {tl && !item.isSold && (
                      <p className={`mkadm-inv-timer ${tl.expired ? "expired" : ""}`}>
                        {tl.expired ? "⛔ Scaduta" : `⏳ ${tl.text}`}
                      </p>
                    )}
                  </div>
                  <div className="mkadm-inv-actions">
                    <button onClick={() => handleEditInit(item)} className="mkadm-icon-btn edit" title="Modifica">✎</button>
                    <button
                      onClick={() => handleDeleteItem(item)}
                      className="mkadm-icon-btn danger"
                      title="Elimina"
                    >
                      🗑
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
