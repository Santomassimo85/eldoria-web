import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import HtmlToolbar from "../components/HtmlToolbar";

const MASTER_EMAIL = "santomassimo85@gmail.com";

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
  
  { name: "Ganno", x: 64.55, y: 37.97 }
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
  linkedCity: "", // NUOVO: Nome della città hub
  mapX: 50,
  mapY: 50,
};

export default function GeoAdmin() {
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
  const [newPoi, setNewPoi] = useState({
    icon: "/assets/icons/market.png",
    label: "",
  });
  const descRef = useRef(null);

  // --- LISTENER DATI ---
  useEffect(() => {
    if (!currentUser || currentUser.email !== MASTER_EMAIL) return;

    const unsubLocs = onSnapshot(collection(db, "geo_archive"), (snap) => {
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubNpcs = onSnapshot(collection(db, "npcs"), (snap) => {
      setNpcs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubLocs();
      unsubNpcs();
    };
  }, [currentUser]);

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <div className="denied-msg">Accesso Negato</div>;
  }

  // --- LOGICA LUOGHI ---
  const handleGeoSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docId = isEditing
        ? editingId
        : formData.name.replace(/\s+/g, "_").toLowerCase();
      await setDoc(doc(db, "geo_archive", docId), formData);
      alert("Archivio luoghi aggiornato!");
      resetGeoForm();
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

  // --- LOGICA NPC & MAP PING ---
  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat(
      (((e.clientX - rect.left) / rect.width) * 100).toFixed(2),
    );
    const y = parseFloat(
      (((e.clientY - rect.top) / rect.height) * 100).toFixed(2),
    );

    // LOG PER IL MASTER: Copia questi valori per le tue città!
    console.log(`COORD CITTA' -> Nome: "NOME", mapX: ${x}, mapY: ${y}`);

    setNpcData((prev) => ({ ...prev, mapX: x, mapY: y }));
  };

  const handleNpcSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const npcId = isNpcEditing
        ? npcEditingId
        : npcData.name.replace(/\s+/g, "_").toLowerCase();
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
    if (window.confirm("Rimuovere NPC?")) await deleteDoc(doc(db, "npcs", id));
  };

  return (
    <section className="admin-page">
      <Link to="/dm-admin" className="back-button">
        ← Dashboard
      </Link>
      <h1 className="gold-text" style={{ textAlign: "center" }}>
        Gestione Mondo & NPC
      </h1>

      {/* SEZIONE LUOGHI */}
      <div className="admin-section">
        <h2 className="gold-text">Archivio Geomantico</h2>
        <form onSubmit={handleGeoSubmit}>
          <input
            className="admin-input"
            placeholder="Nome Luogo"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <select
            className="admin-input"
            value={formData.continent}
            onChange={(e) =>
              setFormData({ ...formData, continent: e.target.value })
            }
          >
            <option value="Vathriddon">Vathriddon</option>
            <option value="Ehkia">Ehkia</option>
            <option value="Ohzkie">Ohzkie</option>
          </select>
          <input
            className="admin-input"
            placeholder="URL Immagine"
            value={formData.image}
            onChange={(e) =>
              setFormData({ ...formData, image: e.target.value })
            }
            required
          />

          <HtmlToolbar
            textAreaRef={descRef}
            formData={formData}
            setFormData={setFormData}
            fieldName="description"
          />
          <textarea
            ref={descRef}
            className="admin-input"
            style={{ minHeight: "150px" }}
            placeholder="Descrizione luogo..."
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />

          <button type="submit" disabled={loading} className="btn-evoke">
            {isEditing ? "SALVA MODIFICHE LUOGO" : "CREA LUOGO"}
          </button>
          {isEditing && (
            <button type="button" onClick={resetGeoForm}>
              ANNULLA
            </button>
          )}
        </form>
      </div>

      <hr className="gold-hr" />

      {/* SEZIONE NPC CON MAP PING */}
<section className="admin-section">
  <h2 className="gold-text">
    {isNpcEditing ? "Modifica NPC" : "Registra Nuovo NPC"}
  </h2>
  
  <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
    <form
      onSubmit={handleNpcSubmit}
      style={{ flex: 1, minWidth: "300px" }}
    >
      <input
        className="admin-input"
        placeholder="Nome NPC"
        value={npcData.name}
        onChange={(e) => setNpcData({ ...npcData, name: e.target.value })}
        required
      />
      <input
        className="admin-input"
        placeholder="Fazione / Titolo"
        value={npcData.faction}
        onChange={(e) => setNpcData({ ...npcData, faction: e.target.value })}
      />
      <input
        className="admin-input"
        placeholder="Luogo base (es: Taverna del Tasso)"
        value={npcData.location}
        onChange={(e) => setNpcData({ ...npcData, location: e.target.value })}
      />
      <input
        className="admin-input"
        placeholder="URL Immagine"
        value={npcData.image}
        onChange={(e) => setNpcData({ ...npcData, image: e.target.value })}
      />

      {/* MENU A TENDINA CITTA' HUB */}
      <div className="form-group" style={{ marginBottom: "15px" }}>
        <label style={{ color: "var(--gold)", fontSize: "0.8rem", display: "block", marginBottom: "5px" }}>
          Assegna a Città Hub (per raggruppamento):
        </label>
        <select 
          className="admin-input"
          value={npcData.linkedCity || ""} 
          onChange={(e) => {
            const selectedCity = e.target.value;
            // Cerchiamo le coordinate nell'array CITIES_HUB (definito fuori o in alto)
            const cityCoords = CITIES_HUB.find(c => c.name === selectedCity);
            
            setNpcData({
              ...npcData, 
              linkedCity: selectedCity,
              // Se scelgo una città, il ping si sposta automaticamente lì
              mapX: cityCoords ? cityCoords.x : npcData.mapX,
              mapY: cityCoords ? cityCoords.y : npcData.mapY
            });
          }}
        >
          <option value="">-- Nessun Hub (Ping Libero sulla mappa) --</option>
          {CITIES_HUB.map(city => (
            <option key={city.name} value={city.name}>
              {city.name}
            </option>
          ))}
        </select>
      </div>

      <textarea
        className="admin-input"
        style={{ minHeight: "80px" }}
        placeholder="Note e descrizione..."
        value={npcData.description}
        onChange={(e) => setNpcData({ ...npcData, description: e.target.value })}
      />

      <p style={{ color: "var(--gold)", fontSize: "0.9rem" }}>
        Posizione attuale: <strong>X {npcData.mapX}% | Y {npcData.mapY}%</strong>
      </p>

      <button
        type="submit"
        disabled={loading}
        className="btn-evoke"
        style={{ width: "100%" }}
      >
        {isNpcEditing ? "AGGIORNA NPC" : "REGISTRA NPC"}
      </button>
      
      {isNpcEditing && (
        <button
          type="button"
          onClick={resetNpcForm}
          style={{ width: "100%", marginTop: "5px", background: "#666" }}
        >
          ANNULLA MODIFICA
        </button>
      )}
    </form>

    {/* MAP PICKER INTERATTIVO */}
    <div style={{ flex: 1, minWidth: "300px" }}>
      <h4 className="gold-text" style={{ marginBottom: "10px" }}>
        {npcData.linkedCity ? `Posizione bloccata su ${npcData.linkedCity}` : "Clicca sulla mappa per posizionare l'NPC"}
      </h4>
      <div
        className="map-picker-container"
        onClick={handleMapClick}
        style={{
          position: "relative",
          cursor: npcData.linkedCity ? "not-allowed" : "crosshair",
          border: "2px solid var(--gold)",
          borderRadius: "8px",
          overflow: "hidden",
          opacity: npcData.linkedCity ? 0.8 : 1
        }}
      >
        <img
          src="/assets/Eldoria.jpg"
          alt="Mappa"
          style={{ width: "100%", display: "block" }}
        />
        {/* IL PING VISIVO */}
        <div
          style={{
            position: "absolute",
            left: `${npcData.mapX}%`,
            top: `${npcData.mapY}%`,
            width: "16px",
            height: "16px",
            background: "#d4af37",
            border: "2px solid white",
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            boxShadow: "0 0 10px gold",
            pointerEvents: "none",
            zIndex: 10
          }}
        />
      </div>
      {npcData.linkedCity && (
        <small style={{ color: "#aaa", fontStyle: "italic", display: "block", marginTop: "5px" }}>
          Nota: Per cambiare posizione liberamente, imposta "Nessun Hub" nel menu a tendina.
        </small>
      )}
    </div>
  </div>

  <h3 className="gold-text" style={{ marginTop: "30px" }}>
    Anagrafe NPC Registrati
  </h3>
  <div className="admin-list">
    {npcs.map((npc) => (
      <div key={npc.id} className="admin-item-row">
        <span>
          <strong>{npc.name}</strong> {npc.linkedCity ? `📍Hub: ${npc.linkedCity}` : `🗺️ Libero: ${npc.location}`}
        </span>
        <div style={{ display: "flex", gap: "5px" }}>
          <button
            onClick={() => {
              setNpcData(npc);
              setIsNpcEditing(true);
              setNpcEditingId(npc.id);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Edit
          </button>
          <button
            onClick={() => deleteNpc(npc.id)}
            style={{ background: "#8b0000" }}
          >
            X
          </button>
        </div>
      </div>
    ))}
  </div>
</section>
    </section>
  );
}
