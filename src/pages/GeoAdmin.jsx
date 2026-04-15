import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import HtmlToolbar from "../components/HtmlToolbar";

const MASTER_EMAIL = "santomassimo85@gmail.com";

// Queste sono le coordinate che ottieni dal console.log cliccando sulla mappa
const CITIES_HUB = [
  { name: "Tirrendale", x: 50.55, y: 62.23 },
  { name: "Helmvil", x: 53.87, y: 37.42 },
  { name: "Yotta", x: 26.44, y: 31.82 },
  { name: "Foresta del Tiglio Bianco", x: 23.40, y: 43.20 },
  { name: "Castello Dorato", x: 67.53, y: 20.68 },
  { name: "Gossvill", x: 86.37, y: 31.81 },
  { name: "Clan dei Senza Onore", x: 26.82, y: 75.41 },
  { name: "Clan dei Demoni Grigi", x: 44.32, y: 44.38 },
  { name: "Nerocastello", x: 11.41, y: 35.18 },
  { name: "Thenduin Village", x: 92.45, y: 30.12 },
  { name: "Monaci delle Sabbie", x: 91.69, y: 41.26 },
  { name: "Torre dell'Arcano", x: 72.29, y: 21.02 },
  { name: "Tassio", x: 60.88, y: 53.40 },
  { name: "Hopeclif", x: 74.38, y: 64.79 },
  { name: "Ganno", x: 64.55, y: 37.97 },
    { name: "Inss", x: 58.16, y: 75.81 },
    { name: "Nølborg", x: 19.56, y: 38.55 },
    { name: "Plia", x: 25.42, y: 50.47 },


];

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
    }

    return () => { unsubLocs(); unsubNpcs(); };
  }, [currentUser, editTarget]);

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <div className="denied-msg">Accesso Negato</div>;
  }

  const handleGeoSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docId = isEditing ? editingId : formData.name.replace(/\s+/g, "_").toLowerCase();
      await setDoc(doc(db, "geo_archive", docId), formData);
      alert("Archivio luoghi aggiornato!");
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
    // Se la città è bloccata su un Hub, non permettiamo il click manuale
    if (npcData.linkedCity) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    // RIPRISTINATO: Log per il Master per creare nuovi Hub
    console.log(`NUOVO HUB -> { name: "NOME", x: ${x}, y: ${y} },`);

    setNpcData((prev) => ({ ...prev, mapX: x, mapY: y }));
  };

  const handleNpcSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const npcId = isNpcEditing ? npcEditingId : npcData.name.replace(/\s+/g, "_").toLowerCase();
      await setDoc(doc(db, "npcs", npcId), npcData);
      alert(isNpcEditing ? "NPC aggiornato!" : "NPC registrato!");
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

  const deleteNpc = async (id) => {
    if (window.confirm("Rimuovere NPC definitivamente?")) await deleteDoc(doc(db, "npcs", id));
  };

  const deleteLocation = async (id) => {
    if (window.confirm("Eliminare definitivamente questo luogo?")) await deleteDoc(doc(db, "geo_archive", id));
  };

  return (
    <section className="admin-page">
      {!onComplete && <Link to="/dm-admin" className="back-button">← Dashboard</Link>}
      <h1 className="gold-text" style={{ textAlign: "center" }}>Gestione Mondo & NPC</h1>

      {/* 1. FORM LUOGHI */}
      <div className="admin-section card">
        <h2 className="gold-text">{isEditing ? "Modifica Luogo" : "Crea Nuovo Luogo"}</h2>
        <form onSubmit={handleGeoSubmit}>
          <div className="form-row">
            <input className="admin-input" placeholder="Nome Luogo" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            <select className="admin-input" value={formData.continent} onChange={(e) => setFormData({ ...formData, continent: e.target.value })}>
              <option value="Vathriddon">Vathriddon</option>
              <option value="Ehkia">Ehkia</option>
              <option value="Ohzkie">Ohzkie</option>
            </select>
          </div>
          <input className="admin-input" placeholder="URL Immagine" value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} required />

          <HtmlToolbar textAreaRef={descRef} formData={formData} setFormData={setFormData} fieldName="description" />
          <textarea ref={descRef} className="admin-input" style={{ minHeight: "150px" }} placeholder="Descrizione luogo..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />

          <div style={{ display: "flex", gap: "10px" }}>
            <button type="submit" disabled={loading} className="btn-evoke" style={{ flex: 2 }}>
              {isEditing ? "SALVA MODIFICHE" : "CREA LUOGO"}
            </button>
            {isEditing && <button type="button" onClick={resetGeoForm} className="btn-cancel" style={{ flex: 1 }}>ANNULLA</button>}
          </div>
        </form>
      </div>

      {/* 2. FORM NPC */}
      <div className="admin-section card" style={{ marginTop: "30px" }}>
        <h2 className="gold-text">{isNpcEditing ? "Modifica NPC" : "Registra NPC"}</h2>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          <form onSubmit={handleNpcSubmit} style={{ flex: 1, minWidth: "300px" }}>
            <input className="admin-input" placeholder="Nome NPC" value={npcData.name} onChange={(e) => setNpcData({ ...npcData, name: e.target.value })} required />
            <div className="form-row">
                <input className="admin-input" placeholder="Fazione" value={npcData.faction} onChange={(e) => setNpcData({ ...npcData, faction: e.target.value })} />
                <input className="admin-input" placeholder="Posizione Specifica" value={npcData.location} onChange={(e) => setNpcData({ ...npcData, location: e.target.value })} />
            </div>
            <input className="admin-input" placeholder="URL Immagine" value={npcData.image} onChange={(e) => setNpcData({ ...npcData, image: e.target.value })} />

            <label className="gold-text" style={{ fontSize: "0.8rem" }}>Città Hub:</label>
            <select className="admin-input" value={npcData.linkedCity || ""} onChange={(e) => {
              const selected = e.target.value;
              const coords = CITIES_HUB.find(c => c.name === selected);
              setNpcData({ ...npcData, linkedCity: selected, mapX: coords ? coords.x : npcData.mapX, mapY: coords ? coords.y : npcData.mapY });
            }}>
              <option value="">-- Libero --</option>
              {CITIES_HUB.map(city => <option key={city.name} value={city.name}>{city.name}</option>)}
            </select>

            <textarea className="admin-input" placeholder="Note..." value={npcData.description} onChange={(e) => setNpcData({ ...npcData, description: e.target.value })} />
            
            <button type="submit" disabled={loading} className="btn-evoke" style={{ width: "100%" }}>{isNpcEditing ? "AGGIORNA NPC" : "REGISTRA NPC"}</button>
            {isNpcEditing && <button type="button" onClick={resetNpcForm} className="btn-cancel" style={{ width: "100%", marginTop: "5px" }}>ANNULLA</button>}
          </form>

          <div style={{ flex: 1, minWidth: "300px" }}>
            <h4 className="gold-text">Mappa</h4>
            <div onClick={handleMapClick} className="map-picker-container" style={{ position: "relative", border: "1px solid #d4af37", borderRadius: "8px", overflow: "hidden", cursor: npcData.linkedCity ? "default" : "crosshair" }}>
              <img src="/assets/Exanthia.jpg" alt="Mappa" style={{ width: "100%", display: "block" }} />
              <div style={{ position: "absolute", left: `${npcData.mapX}%`, top: `${npcData.mapY}%`, width: "12px", height: "12px", background: "gold", border: "2px solid white", borderRadius: "50%", transform: "translate(-50%, -50%)", boxShadow: "0 0 10px gold" }} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. LISTA LUOGHI */}
      <div className="admin-list-section" style={{ marginTop: "40px" }}>
        <h3 className="gold-text">Geografia Registrata</h3>
        <div className="admin-list">
          {locations.map((loc) => (
            <div key={loc.id} className="admin-item-row">
              <span><strong>{loc.name}</strong> ({loc.continent})</span>
              <div className="btn-group">
                <button onClick={() => { setFormData(loc); setIsEditing(true); setEditingId(loc.id); window.scrollTo(0,0); }}>Edit</button>
                <button onClick={() => deleteLocation(loc.id)} className="btn-danger">X</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. LISTA NPC */}
      <div className="admin-list-section" style={{ marginTop: "30px" }}>
        <h3 className="gold-text">Anagrafe NPC</h3>
        <div className="admin-list">
          {npcs.map((npc) => (
            <div key={npc.id} className="admin-item-row">
              <span><strong>{npc.name}</strong> - {npc.linkedCity || npc.location}</span>
              <div className="btn-group">
                <button onClick={() => { setNpcData(npc); setIsNpcEditing(true); setNpcEditingId(npc.id); window.scrollTo(0,0); }}>Edit</button>
                <button onClick={() => deleteNpc(npc.id)} className="btn-danger">X</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}