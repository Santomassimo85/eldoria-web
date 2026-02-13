import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import HtmlToolbar from "../components/HtmlToolbar";

const MASTER_EMAIL = "santomassimo85@gmail.com";

const initialGeoData = {
  name: "",
  image: "",
  description: "",
  landmarks: "", 
  pointsOfInterest: [] 
};

export default function GeoAdmin() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [locations, setLocations] = useState([]);
  const [formData, setFormData] = useState(initialGeoData);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // State for the new POI being created
  const [newPoi, setNewPoi] = useState({ icon: "/assets/icons/market.png", label: "" });

  // Refs for the two textareas to work with HtmlToolbar
  const descRef = useRef(null);
  const landRef = useRef(null);

  // Security Check
  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <div style={{color: "white", textAlign: "center", padding: "50px"}}>Accesso Negato</div>;
  }

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "geo_archive"));
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Errore caricamento:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleAddPoi = () => {
    if (!newPoi.label) return;
    setFormData(prev => ({
      ...prev,
      pointsOfInterest: [...prev.pointsOfInterest, newPoi]
    }));
    setNewPoi({ icon: "/assets/icons/market.png", label: "" });
  };

  const removePoi = (index) => {
    const updatedPois = formData.pointsOfInterest.filter((_, i) => i !== index);
    setFormData({ ...formData, pointsOfInterest: updatedPois });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Use name as ID if not editing, otherwise use existing ID
      const docId = isEditing ? editingId : formData.name.replace(/\s+/g, '_').toLowerCase();
      
      await setDoc(doc(db, "geo_archive", docId), formData);
      
      alert("Archivio aggiornato con successo!");
      handleReset();
      fetchLocations();
    } catch (error) {
      alert("Errore nel salvataggio: " + error.message);
    }
    setLoading(false);
  };

  const startEdit = (loc) => {
    setFormData(loc);
    setEditingId(loc.id);
    setIsEditing(true);
    window.scrollTo(0, 0); // Scroll to top to see the form
  };

  const handleDelete = async (id) => {
    if (window.confirm("Sei sicuro di voler eliminare questo luogo per sempre?")) {
      await deleteDoc(doc(db, "geo_archive", id));
      fetchLocations();
    }
  };

  const handleReset = () => {
    setFormData(initialGeoData);
    setIsEditing(false);
    setEditingId(null);
  };

  return (
    <section className="admin-page" >
      <Link to="/dm-admin" className="back-button" >← Dashboard</Link>
      <h1 style={{ color: "var(--gold)", textAlign: "center" }}>Gestione Archivio Geomantico</h1>

      <form onSubmit={handleSubmit} >
        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>Nome Luogo:</label>
          <input 
            style={{ width: "100%", padding: "8px" }}
            placeholder="Esempio: Tirrendale" 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            required 
          />
        </div>
        
        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>URL Immagine:</label>
          <input 
            style={{ width: "100%", padding: "8px" }}
            placeholder="/assets/Tirrendale_view.png" 
            value={formData.image} 
            onChange={e => setFormData({...formData, image: e.target.value})} 
            required 
          />
        </div>

        {/* TOOLBAR PER DESCRIZIONE */}
        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>Descrizione Narrativa:</label>
          <HtmlToolbar 
            textAreaRef={descRef} 
            formData={formData} 
            setFormData={setFormData} 
            fieldName="description" 
          />
          <textarea 
            ref={descRef}
            style={{ width: "100%", padding: "8px", minHeight: "150px" }}
            placeholder="Scrivi la storia del luogo..." 
            value={formData.description} 
            onChange={e => setFormData({...formData, description: e.target.value})} 
          />
        </div>

        {/* TOOLBAR PER BALUARDI */}
        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>Baluardi e Cuori (HTML):</label>
          <HtmlToolbar 
            textAreaRef={landRef} 
            formData={formData} 
            setFormData={setFormData} 
            fieldName="landmarks" 
          />
          <textarea 
            ref={landRef}
            style={{ width: "100%", padding: "8px", minHeight: "100px" }}
            placeholder="Usa elenchi puntati per i quartieri..." 
            value={formData.landmarks} 
            onChange={e => setFormData({...formData, landmarks: e.target.value})} 
          />
        </div>

        {/* POI BUILDER */}
        <div className="poi-builder" >
          <h4 style={{ color: "var(--gold)", marginTop: 0 }}>Aggiungi Punto di Interesse</h4>
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <select 
              value={newPoi.icon} 
              onChange={e => setNewPoi({...newPoi, icon: e.target.value})}
              style={{ padding: "5px" }}
            >
              <option value="/assets/icons/market.png">Mercato</option>
              <option value="/assets/icons/alchemy.svg">Alchimia</option>
              <option value="/assets/icons/prison.svg">Prigione</option>
              <option value="/assets/icons/pvp.png">Arena</option>
              <option value="/assets/icons/tavern.png">Locanda</option>
            </select>
            <input 
              style={{ flexGrow: 1, padding: "5px" }}
              placeholder="Nome del POI (es: Locanda del Drago)" 
              value={newPoi.label} 
              onChange={e => setNewPoi({...newPoi, label: e.target.value})} 
            />
            <button type="button" onClick={handleAddPoi}>+</button>
          </div>
          
          <ul style={{ listStyle: "none", padding: 0 }}>
            {formData.pointsOfInterest.map((p, i) => (
              <li key={i} >
                <span>{p.label} <small>({p.icon.split('/').pop()})</small></span>
                <button type="button" onClick={() => removePoi(i)} >X</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-item-row">
          <button type="submit" disabled={loading}>
            {loading ? "Salvataggio..." : isEditing ? "SALVA MODIFICHE" : "CREA NUOVO LUOGO"}
          </button>
          {isEditing && (
            <button type="button" onClick={handleReset} >ANNULLA</button>
          )}
        </div>
      </form>

      <h2 style={{ color: "var(--gold)", borderBottom: "1px solid var(--gold)" }}>Luoghi Esistenti</h2>
      <div className="admin-list">
        {locations.map(loc => (
          <div key={loc.id} className="admin-item-row">
            <span style={{ fontSize: "1.2rem" }}>{loc.name}</span>
            <div>
              <button onClick={() => startEdit(loc)} >Modifica</button>
              <button onClick={() => handleDelete(loc.id)} >Elimina</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}