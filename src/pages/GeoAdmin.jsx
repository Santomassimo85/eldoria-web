import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import HtmlToolbar from "../components/HtmlToolbar";

const MASTER_EMAIL = "santomassimo85@gmail.com";

// Definizione esterna per evitare errori di riferimento
const initialGeoData = {
  name: "",
  image: "",
  description: "",
  continent: "Vathriddon", 
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
  const [newPoi, setNewPoi] = useState({ icon: "/assets/icons/market.png", label: "" });
  const descRef = useRef(null);

const [isNpcEditing, setIsNpcEditing] = useState(false);
const [npcEditingId, setNpcEditingId] = useState(null);
const [npcs, setNpcs] = useState([]); // Aggiungi questo se non lo avevi per la lista

const [npcData, setNpcData] = useState({ 
  name: "", 
  image: "", 
  faction: "", 
  location: "", 
  description: "" 
});



const handleNpcSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    // Se stiamo modificando usiamo l'ID esistente, altrimenti ne creiamo uno dal nome
    const npcId = isNpcEditing ? npcEditingId : npcData.name.replace(/\s+/g, '_').toLowerCase();
    
    await setDoc(doc(db, "npcs", npcId), npcData);
    
    alert(isNpcEditing ? "Dati aggiornati!" : "NPC registrato!");
    
    // Reset
    setNpcData({ name: "", image: "", faction: "", location: "", description: "" });
    setIsNpcEditing(false);
    setNpcEditingId(null);
  } catch (error) {
    alert("Errore: " + error.message);
  }
  setLoading(false);
};

useEffect(() => {
  const fetchNpcs = async () => {
    const querySnapshot = await getDocs(collection(db, "npcs"));
    setNpcs(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };
  fetchNpcs();
}, [loading]);

// 2. Prepara il form per la modifica
const startNpcEdit = (npc) => {
  setNpcData(npc);
  setIsNpcEditing(true);
  setNpcEditingId(npc.id);
  window.scrollTo(0, 0); // Torna su al form
};

// 3. Elimina NPC
const deleteNpc = async (id) => {
  if (window.confirm("Sei sicuro di voler eliminare questo NPC dall'anagrafe?")) {
    await deleteDoc(doc(db, "npcs", id));
    setNpcs(npcs.filter(n => n.id !== id));
    alert("Personaggio rimosso.");
  }
};


  // Spostiamo useEffect all'inizio per rispettare le regole di React
  useEffect(() => {
    const fetchLocations = async () => {
      if (!currentUser || currentUser.email !== MASTER_EMAIL) return;
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "geo_archive"));
        setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Errore caricamento:", error);
      }
      setLoading(false);
    };

    fetchLocations();
  }, [currentUser]);

  // Il controllo di sicurezza va DOPO gli hook
  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <div style={{color: "white", textAlign: "center", padding: "50px"}}>Accesso Negato</div>;
  }

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
      const docId = isEditing ? editingId : formData.name.replace(/\s+/g, '_').toLowerCase();
      await setDoc(doc(db, "geo_archive", docId), formData);
      alert("Archivio aggiornato con successo!");
      handleReset();
      // Ricarichiamo la lista aggiornata
      const snap = await getDocs(collection(db, "geo_archive"));
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      alert("Errore nel salvataggio: " + error.message);
    }
    setLoading(false);
  };

  const startEdit = (loc) => {
    setFormData(loc);
    setEditingId(loc.id);
    setIsEditing(true);
    window.scrollTo(0, 0);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Sei sicuro di voler eliminare questo luogo?")) {
      await deleteDoc(doc(db, "geo_archive", id));
      const snap = await getDocs(collection(db, "geo_archive"));
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  };

  const handleReset = () => {
    setFormData(initialGeoData);
    setIsEditing(false);
    setEditingId(null);
  };

  return (
    <section className="admin-page">
      <Link to="/dm-admin" className="back-button">← Dashboard</Link>
      <h1 style={{ color: "var(--gold)", textAlign: "center" }}>Gestione Archivio Geomantico</h1>

      <form onSubmit={handleSubmit}>
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
          <label>Continente:</label>
          <select 
            style={{ width: "100%", padding: "8px" }}
            value={formData.continent || "Vathriddon"} 
            onChange={e => setFormData({...formData, continent: e.target.value})}
          >
            <option value="Vathriddon">Vathriddon</option>
            <option value="Ehkia">Ehkia</option>
            <option value="Ohzkie">Ohzkie</option>
          </select>
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

        <div className="poi-builder">
          <h4 style={{ color: "var(--gold)", marginTop: 0 }}>Aggiungi Punto di Interesse</h4>
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <select 
              value={newPoi.icon} 
              onChange={e => setNewPoi({...newPoi, icon: e.target.value})}
              style={{ padding: "5px" }}
            >
              <option value="/assets/icons/market.png">Mercato</option>
              <option value="/assets/icons/alchemy.svg">Alchimia</option>
              <option value="/assets/icons/deja-vu.png">Arcanista</option>
              <option value="/assets/icons/blacksmith.png">Fucina</option>
              <option value="/assets/icons/open-book.png">Libreria</option>
              <option value="/assets/icons/prison.svg">Prigione</option>
              <option value="/assets/icons/pvp.png">Arena</option>
              <option value="/assets/icons/table.png">Locanda</option>
            </select>
            <input 
              style={{ flexGrow: 1, padding: "5px" }}
              placeholder="Nome del POI" 
              value={newPoi.label} 
              onChange={e => setNewPoi({...newPoi, label: e.target.value})} 
            />
            <button type="button" onClick={handleAddPoi}>+</button>
          </div>
          
          <ul style={{ listStyle: "none", padding: 0 }}>
            {formData.pointsOfInterest && formData.pointsOfInterest.map((p, i) => (
              <li key={i} className="admin-item-row" style={{justifyContent: "space-between"}}>
                <span>{p.label}</span>
                <button type="button" onClick={() => removePoi(i)} className="admin-delete-button">X</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-item-row" style={{border: "none"}}>
          <button type="submit" disabled={loading}>
            {loading ? "Salvataggio..." : isEditing ? "SALVA MODIFICHE" : "CREA NUOVO LUOGO"}
          </button>
          {isEditing && <button type="button" onClick={handleReset} style={{background: "var(--gold)"}}>ANNULLA</button>}
        </div>
      </form>

      <h3 style={{ color: "var(--gold)", borderBottom: "1px solid var(--gold)", marginTop: "40px" }}>Luoghi Esistenti</h3>
      <div className="admin-list">
        {locations.map(loc => (
          <div key={loc.id} className="admin-item-row">
            <span style={{flexGrow: 1}}>{loc.name} ({loc.continent || "Vathriddon"})</span>
            <div>
              <button onClick={() => startEdit(loc)}>Modifica</button>
              <button onClick={() => handleDelete(loc.id)} style={{background: "#e74c3c"}}>Elimina</button>
            </div>
          </div>
        ))}
      </div>


      <hr style={{ margin: "50px 0", borderColor: "var(--gold)" }} />
<section className="admin-section" style={{ marginTop: "50px", borderTop: "2px solid var(--gold)", paddingTop: "20px" }}>
  <h2 className="gold-text">{isNpcEditing ? "Modifica NPC" : "Gestione Anagrafe NPC"}</h2>
  
  <form onSubmit={handleNpcSubmit} className="creation-form">
    <div className="boss-form">
      <input 
        className="admin-input" 
        placeholder="Nome Personaggio"
        value={npcData.name} 
        onChange={e => setNpcData({...npcData, name: e.target.value})} 
        required 
      />
      <input 
        className="admin-input" 
        placeholder="Fazione / Titolo"
        value={npcData.faction} 
        onChange={e => setNpcData({...npcData, faction: e.target.value})} 
      />
      <input 
        className="admin-input" 
        placeholder="Luogo (Città/Regione)"
        value={npcData.location} 
        onChange={e => setNpcData({...npcData, location: e.target.value})} 
      />
      <input 
        className="admin-input" 
        placeholder="URL Immagine"
        value={npcData.image} 
        onChange={e => setNpcData({...npcData, image: e.target.value})} 
      />
      <textarea 
        className="admin-input" 
        placeholder="Descrizione e Note DM..."
        style={{ width: "100%", minHeight: "80px" }}
        value={npcData.description} 
        onChange={e => setNpcData({...npcData, description: e.target.value})} 
      />
      
      <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
        <button type="submit" className="admin-button-boss btn-evoke" style={{ flex: 2 }}>
          {loading ? "Salvataggio..." : isNpcEditing ? "SALVA MODIFICHE" : "REGISTRA NPC"}
        </button>
        {isNpcEditing && (
          <button 
            type="button" 
            onClick={() => {
              setIsNpcEditing(false);
              setNpcData({ name: "", image: "", faction: "", location: "", description: "" });
            }} 
            className="admin-button-boss" 
            style={{ flex: 1, background: 'gray' }}
          >
            ANNULLA
          </button>
        )}
      </div>
    </div>
  </form>

  {/* LISTA NPC PER MODIFICA/ELIMINAZIONE */}
  <h3 className="gold-text" style={{ marginTop: "30px", fontSize: "1.5rem" }}>NPC Registrati</h3>
  <div className="admin-list">
    {npcs.map(npc => (
      <div key={npc.id} className="admin-item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #333' }}>
        <span>
          <strong>{npc.name}</strong> <small style={{color: 'var(--gold)'}}>({npc.location})</small>
        </span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => startNpcEdit(npc)} className="admin-edit-button">Modifica</button>
          <button onClick={() => deleteNpc(npc.id)} className="admin-delete-button" style={{ background: '#8b0000' }}>Elimina</button>
        </div>
      </div>
    ))}
  </div>
</section>
    </section>
  );
}