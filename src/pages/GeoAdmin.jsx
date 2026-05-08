import React, { useState, useEffect, useMemo, useRef } from "react";
import { db, storage } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import HtmlToolbar from "../components/HtmlToolbar";
import { CITIES_HUB } from "../data/citiesHub";
import "./admin.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

// Inline SVG placeholder (no network request → evita loop infinito su 404).
const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23222'/><text x='50' y='55' text-anchor='middle' fill='%23888' font-family='sans-serif' font-size='10'>no image</text></svg>";
const handleImgError = (e) => {
  if (e.currentTarget.dataset.fallback === "1") return;
  e.currentTarget.dataset.fallback = "1";
  e.currentTarget.src = PLACEHOLDER_IMG;
};

const initialGeoData = {
  name: "",
  image: "",
  description: "",
  continent: "Vathriddon",
  pointsOfInterest: [],
};

const initialNpcData = {
  name: "",
  image: "",
  faction: "",
  location: "",
  description: "",
  linkedCity: "",
  mapX: 50,
  mapY: 50,
  
};

/* ──────────────────────────────────────────────────────────────
   DropZone — reusable drag&drop image slot
   ────────────────────────────────────────────────────────────── */
const DropZone = ({ value, uploading, onFile, onClear, label = "Trascina un'immagine", icon = "📥", aspect = "1/1", round = false }) => {
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
      className={`geo-drop ${dragOver ? "drag" : ""} ${uploading ? "loading" : ""} ${value ? "filled" : ""} ${round ? "round" : ""}`}
      style={{ aspectRatio: aspect }}
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
        <div className="geo-drop-state">
          <span className="geo-drop-spinner" />
          <strong>Caricamento…</strong>
        </div>
      ) : value ? (
        <>
          <img src={value} alt="" className="geo-drop-img" onError={handleImgError} />
          <div className="geo-drop-overlay">
            <span>📤 Cambia</span>
            {onClear && (
              <button
                type="button"
                className="geo-drop-clear"
                onClick={(e) => { e.stopPropagation(); onClear(); }}
              >
                ✕ Rimuovi
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="geo-drop-state">
          <span className="geo-drop-icon">{icon}</span>
          <strong>{label}</strong>
          <small>o clicca · max 5MB</small>
        </div>
      )}
    </div>
  );
};

export default function GeoAdmin({ editTarget = null, onComplete = null }) {
  const { currentUser } = useAuth();
  const [locations, setLocations] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [formData, setFormData] = useState(initialGeoData);
  const [npcData, setNpcData] = useState(initialNpcData);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isNpcEditing, setIsNpcEditing] = useState(false);
  const [npcEditingId, setNpcEditingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [uploadState, setUploadState] = useState({}); // { loc: bool, npc: bool }
  const [tab, setTab] = useState("locations"); // 'locations' | 'npcs'
  const [searchLoc, setSearchLoc] = useState("");
  const [searchNpc, setSearchNpc] = useState("");
  const descRef = useRef(null);

  useEffect(() => {
    if (!currentUser || currentUser.email !== MASTER_EMAIL) return;

    const unsubLocs = onSnapshot(collection(db, "geo_archive"), (snap) => {
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubNpcs = onSnapshot(collection(db, "npcs"), (snap) => {
      setNpcs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    if (editTarget) {
      setFormData(editTarget);
      setIsEditing(true);
      setEditingId(editTarget.id);
      setTab("locations");
    }

    return () => { unsubLocs(); unsubNpcs(); };
  }, [currentUser, editTarget]);

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <div className="denied-msg">Accesso Negato</div>;
  }

  /* ── Image upload helpers ── */
  const uploadImage = async (file, folder, slotKey) => {
    if (!file?.type?.startsWith("image/")) return null;
    if (file.size > 5 * 1024 * 1024) return null;
    setUploadState((s) => ({ ...s, [slotKey]: true }));
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safe = (file.name || "img").replace(/[^a-z0-9._-]/gi, "_").slice(0, 36);
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file, { contentType: file.type });
      return await getDownloadURL(ref);
    } catch (err) {
      console.error("Upload fallito:", err);
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

  const onLocFile = async (file) => {
    const url = await uploadImage(file, "geo-archive", "loc");
    if (url) {
      if (formData.image) cleanupStorageUrl(formData.image);
      setFormData((d) => ({ ...d, image: url }));
    }
  };
  const onNpcFile = async (file) => {
    const url = await uploadImage(file, "npcs", "npc");
    if (url) {
      if (npcData.image) cleanupStorageUrl(npcData.image);
      setNpcData((d) => ({ ...d, image: url }));
    }
  };

  /* ── Submit handlers ── */
  const handleGeoSubmit = async (e) => {
    e.preventDefault();
    if (uploadState.loc) return;
    if (!formData.image) { alert("Carica un'immagine prima di salvare."); return; }
    setLoading(true);
    try {
      const docId = isEditing ? editingId : formData.name.replace(/\s+/g, "_").toLowerCase();
      await setDoc(doc(db, "geo_archive", docId), formData);
      alert("✅ Archivio luoghi aggiornato!");
      resetGeoForm();
      if (onComplete) onComplete();
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  };

  const resetGeoForm = () => {
    setFormData(initialGeoData);
    setIsEditing(false);
    setEditingId(null);
  };

  const handleMapClick = (e) => {
    if (npcData.linkedCity) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));
    console.log(`NUOVO HUB -> { name: "NOME", x: ${x}, y: ${y} },`);
    setNpcData((prev) => ({ ...prev, mapX: x, mapY: y }));
  };

  const handleNpcSubmit = async (e) => {
    e.preventDefault();
    if (uploadState.npc) return;
    setLoading(true);
    try {
      const npcId = isNpcEditing ? npcEditingId : npcData.name.replace(/\s+/g, "_").toLowerCase();
      await setDoc(doc(db, "npcs", npcId), npcData);
      alert(isNpcEditing ? "✅ NPC aggiornato!" : "✅ NPC registrato!");
      resetNpcForm();
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  };

  const resetNpcForm = () => {
    setNpcData(initialNpcData);
    setIsNpcEditing(false);
    setNpcEditingId(null);
  };

  const deleteNpc = async (npc) => {
    if (!window.confirm(`Rimuovere "${npc.name}" definitivamente?`)) return;
    await cleanupStorageUrl(npc.image);
    await deleteDoc(doc(db, "npcs", npc.id));
  };

  const deleteLocation = async (loc) => {
    if (!window.confirm(`Eliminare "${loc.name}" definitivamente?`)) return;
    await cleanupStorageUrl(loc.image);
    await deleteDoc(doc(db, "geo_archive", loc.id));
  };

  const editLocation = (loc) => {
    setFormData(loc);
    setIsEditing(true);
    setEditingId(loc.id);
    setTab("locations");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const editNpc = (npc) => {
    setNpcData(npc);
    setIsNpcEditing(true);
    setNpcEditingId(npc.id);
    setTab("npcs");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stats = useMemo(() => ({
    locTotal: locations.length,
    npcTotal: npcs.length,
    continents: new Set(locations.map((l) => l.continent).filter(Boolean)).size,
    factions: new Set(npcs.map((n) => n.faction).filter(Boolean)).size,
  }), [locations, npcs]);

  const filteredLocs = useMemo(() => {
    const q = searchLoc.toLowerCase().trim();
    if (!q) return locations;
    return locations.filter((l) =>
      (l.name || "").toLowerCase().includes(q) ||
      (l.continent || "").toLowerCase().includes(q)
    );
  }, [locations, searchLoc]);

  const filteredNpcs = useMemo(() => {
    const q = searchNpc.toLowerCase().trim();
    if (!q) return npcs;
    return npcs.filter((n) =>
      (n.name || "").toLowerCase().includes(q) ||
      (n.faction || "").toLowerCase().includes(q) ||
      (n.linkedCity || "").toLowerCase().includes(q) ||
      (n.location || "").toLowerCase().includes(q)
    );
  }, [npcs, searchNpc]);

  return (
    <section className="admin-geo-page geoadm">
      {!onComplete && <Link to="/dm-admin" className="admin-back-link">← Dashboard</Link>}

      {/* ── HERO ── */}
      <header className="geoadm-hero">
        <div className="geoadm-hero-titles">
          <h1 className="geoadm-title">🗺 Cartografo dei Mondi</h1>
          <p className="geoadm-sub">Archivia luoghi, fazioni e abitanti di Exanthia</p>
        </div>
        <div className="geoadm-stats">
          <div className="geoadm-stat"><span>Luoghi</span><strong>{stats.locTotal}</strong></div>
          <div className="geoadm-stat"><span>NPC</span><strong>{stats.npcTotal}</strong></div>
          <div className="geoadm-stat alt"><span>Continenti</span><strong>{stats.continents}</strong></div>
          <div className="geoadm-stat alt"><span>Fazioni</span><strong>{stats.factions}</strong></div>
        </div>
      </header>

      {/* ── TABS ── */}
      <div className="geoadm-tabs">
        <button
          className={`geoadm-tab ${tab === "locations" ? "on" : ""}`}
          onClick={() => setTab("locations")}
        >
          🏰 Luoghi
        </button>
        <button
          className={`geoadm-tab ${tab === "npcs" ? "on" : ""}`}
          onClick={() => setTab("npcs")}
        >
          👤 NPC
        </button>
      </div>

      {/* ─── LUOGHI TAB ─── */}
      {tab === "locations" && (
        <>
          <div className="geoadm-workshop">
            <section className="geoadm-card">
              <div className="geoadm-card-head">
                <h2>{isEditing ? "✎ Modifica Luogo" : "✨ Nuovo Luogo"}</h2>
                {isEditing && <span className="geoadm-edit-tag">{editingId}</span>}
              </div>

              <form onSubmit={handleGeoSubmit} className="geoadm-form">
                <div className="geoadm-row2">
                  <div className="geoadm-field">
                    <label>Nome</label>
                    <input
                      className="admin-field-input"
                      placeholder="Es. Castello di Atrius"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="geoadm-field">
                    <label>Continente</label>
                    <select
                      className="admin-field-select"
                      value={formData.continent}
                      onChange={(e) => setFormData({ ...formData, continent: e.target.value })}
                    >
                      <option value="Vathriddon">Vathriddon</option>
                      <option value="Ehkia">Ehkia</option>
                      <option value="Ohzkie">Ohzkie</option>
                    </select>
                  </div>
                </div>

                <div className="geoadm-field">
                  <label>Immagine</label>
                  <DropZone
                    value={formData.image}
                    uploading={uploadState.loc}
                    onFile={onLocFile}
                    onClear={() => {
                      cleanupStorageUrl(formData.image);
                      setFormData((d) => ({ ...d, image: "" }));
                    }}
                    aspect="16/9"
                    label="Trascina la mappa o foto del luogo"
                    icon="🗺"
                  />
                  <input
                    type="url"
                    className="admin-field-input geoadm-url"
                    placeholder="…oppure incolla un URL diretto"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  />
                </div>

                <div className="geoadm-field">
                  <label>Descrizione (HTML consentito)</label>
                  <HtmlToolbar textAreaRef={descRef} formData={formData} setFormData={setFormData} fieldName="description" />
                  <textarea
                    ref={descRef}
                    className="admin-field-textarea"
                    placeholder="Storia, atmosfera, particolarità…"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="6"
                  />
                </div>

                <div className="geoadm-actions">
                  <button type="submit" disabled={loading || uploadState.loc} className="geoadm-btn primary">
                    {uploadState.loc ? "⏳ Upload…" : isEditing ? "💾 Salva modifiche" : "🪄 Crea luogo"}
                  </button>
                  {isEditing && (
                    <button type="button" onClick={resetGeoForm} className="geoadm-btn ghost">Annulla</button>
                  )}
                </div>
              </form>
            </section>

            <aside className="geoadm-preview">
              <div className="geoadm-card-head">
                <h2>👁 Anteprima</h2>
                <small>Come apparirà nell'archivio</small>
              </div>
              <div className="geoadm-loc-preview">
                {formData.image ? (
                  <img src={formData.image} alt="" onError={handleImgError} />
                ) : (
                  <div className="geoadm-loc-noimg">🗺<small>Nessuna immagine</small></div>
                )}
                <div className="geoadm-loc-body">
                  <span className="geoadm-loc-continent">{formData.continent}</span>
                  <h3>{formData.name || "Nome luogo"}</h3>
                  {formData.description ? (
                    <div
                      className="geoadm-loc-desc"
                      dangerouslySetInnerHTML={{ __html: formData.description }}
                    />
                  ) : (
                    <p className="geoadm-loc-desc placeholder">La descrizione apparirà qui…</p>
                  )}
                </div>
              </div>
            </aside>
          </div>

          {/* Lista luoghi */}
          <section className="geoadm-archive">
            <div className="geoadm-archive-head">
              <h2>📚 Archivio Luoghi <small>({filteredLocs.length}/{locations.length})</small></h2>
              <input
                type="search"
                className="admin-field-input geoadm-search"
                placeholder="🔍 Cerca per nome o continente…"
                value={searchLoc}
                onChange={(e) => setSearchLoc(e.target.value)}
              />
            </div>
            {filteredLocs.length === 0 ? (
              <p className="geoadm-empty">Nessun luogo registrato.</p>
            ) : (
              <div className="geoadm-grid">
                {filteredLocs.map((loc) => (
                  <article key={loc.id} className="geoadm-loc-card">
                    <div className="geoadm-loc-card-img">
                      {loc.image ? (
                        <img src={loc.image} alt={loc.name} onError={handleImgError} />
                      ) : (
                        <div className="geoadm-loc-noimg">🗺</div>
                      )}
                      <span className="geoadm-loc-card-cont">{loc.continent}</span>
                    </div>
                    <div className="geoadm-loc-card-body">
                      <h4>{loc.name}</h4>
                    </div>
                    <div className="geoadm-loc-card-actions">
                      <button onClick={() => editLocation(loc)} className="geoadm-icon edit" title="Modifica">✎</button>
                      <button onClick={() => deleteLocation(loc)} className="geoadm-icon danger" title="Elimina">🗑</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ─── NPC TAB ─── */}
      {tab === "npcs" && (
        <>
          <div className="geoadm-workshop">
            <section className="geoadm-card">
              <div className="geoadm-card-head">
                <h2>{isNpcEditing ? "✎ Modifica NPC" : "✨ Nuovo NPC"}</h2>
                {isNpcEditing && <span className="geoadm-edit-tag">{npcEditingId}</span>}
              </div>

              <form onSubmit={handleNpcSubmit} className="geoadm-form">
                <div className="geoadm-npc-head">
                  <DropZone
                    value={npcData.image}
                    uploading={uploadState.npc}
                    onFile={onNpcFile}
                    onClear={() => {
                      cleanupStorageUrl(npcData.image);
                      setNpcData((d) => ({ ...d, image: "" }));
                    }}
                    aspect="1/1"
                    round
                    label="Ritratto"
                    icon="🧝"
                  />
                  <div className="geoadm-npc-fields">
                    <div className="geoadm-field">
                      <label>Nome NPC</label>
                      <input
                        className="admin-field-input"
                        placeholder="Es. Maestro Aldwin"
                        value={npcData.name}
                        onChange={(e) => setNpcData({ ...npcData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="geoadm-row2">
                      <div className="geoadm-field">
                        <label>Fazione</label>
                        <input
                          className="admin-field-input"
                          placeholder="Es. Ordine del Velo"
                          value={npcData.faction}
                          onChange={(e) => setNpcData({ ...npcData, faction: e.target.value })}
                        />
                      </div>
                      <div className="geoadm-field">
                        <label>Posizione</label>
                        <input
                          className="admin-field-input"
                          placeholder="Es. Locanda del Drago"
                          value={npcData.location}
                          onChange={(e) => setNpcData({ ...npcData, location: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="geoadm-field">
                  <label>Città Hub <small>(blocca il pin sulla mappa)</small></label>
                  <select
                    className="admin-field-select"
                    value={npcData.linkedCity || ""}
                    onChange={(e) => {
                      const selected = e.target.value;
                      const coords = CITIES_HUB.find((c) => c.name === selected);
                      setNpcData({
                        ...npcData,
                        linkedCity: selected,
                        mapX: coords ? coords.x : npcData.mapX,
                        mapY: coords ? coords.y : npcData.mapY,
                      });
                    }}
                  >
                    <option value="">— Libero (clicca sulla mappa) —</option>
                    {CITIES_HUB.map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}
                  </select>
                </div>

                <div className="geoadm-field">
                  <label>Note</label>
                  <textarea
                    className="admin-field-textarea"
                    placeholder="Personalità, segreti, motivazioni…"
                    value={npcData.description}
                    onChange={(e) => setNpcData({ ...npcData, description: e.target.value })}
                    rows="4"
                  />
                </div>

                <input
                  type="url"
                  className="admin-field-input geoadm-url"
                  placeholder="…oppure incolla un URL diretto del ritratto"
                  value={npcData.image}
                  onChange={(e) => setNpcData({ ...npcData, image: e.target.value })}
                />

                <div className="geoadm-actions">
                  <button type="submit" disabled={loading || uploadState.npc} className="geoadm-btn primary">
                    {uploadState.npc ? "⏳ Upload…" : isNpcEditing ? "💾 Salva modifiche" : "🪄 Registra NPC"}
                  </button>
                  {isNpcEditing && (
                    <button type="button" onClick={resetNpcForm} className="geoadm-btn ghost">Annulla</button>
                  )}
                </div>
              </form>
            </section>

            <aside className="geoadm-preview">
              <div className="geoadm-card-head">
                <h2>📍 Posizione su Mappa</h2>
                <small>{npcData.linkedCity ? `Bloccato su ${npcData.linkedCity}` : "Clicca per posizionare"}</small>
              </div>
              <div
                onClick={handleMapClick}
                className={`geoadm-map ${npcData.linkedCity ? "locked" : ""}`}
              >
                <img src="/assets/Exanthia.jpg" alt="Mappa" />
                <div
                  className="geoadm-map-pin"
                  style={{ left: `${npcData.mapX}%`, top: `${npcData.mapY}%` }}
                />
                <div className="geoadm-map-coords">
                  X: {npcData.mapX.toFixed(2)} · Y: {npcData.mapY.toFixed(2)}
                </div>
              </div>
            </aside>
          </div>

          {/* Lista NPC */}
          <section className="geoadm-archive">
            <div className="geoadm-archive-head">
              <h2>🗒 Anagrafe NPC <small>({filteredNpcs.length}/{npcs.length})</small></h2>
              <input
                type="search"
                className="admin-field-input geoadm-search"
                placeholder="🔍 Cerca per nome, fazione o città…"
                value={searchNpc}
                onChange={(e) => setSearchNpc(e.target.value)}
              />
            </div>
            {filteredNpcs.length === 0 ? (
              <p className="geoadm-empty">Nessun NPC registrato.</p>
            ) : (
              <div className="geoadm-grid npc-grid">
                {filteredNpcs.map((npc) => (
                  <article key={npc.id} className="geoadm-npc-card">
                    <div className="geoadm-npc-portrait">
                      {npc.image ? (
                        <img src={npc.image} alt={npc.name} onError={handleImgError} />
                      ) : (
                        <div className="geoadm-npc-noimg">🧝</div>
                      )}
                    </div>
                    <div className="geoadm-npc-body">
                      <h4>{npc.name}</h4>
                      {npc.faction && <p className="geoadm-npc-faction">{npc.faction}</p>}
                      {(npc.linkedCity || npc.location) && (
                        <p className="geoadm-npc-loc">📍 {npc.linkedCity || npc.location}</p>
                      )}
                    </div>
                    <div className="geoadm-loc-card-actions">
                      <button onClick={() => editNpc(npc)} className="geoadm-icon edit" title="Modifica">✎</button>
                      <button onClick={() => deleteNpc(npc)} className="geoadm-icon danger" title="Elimina">🗑</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
