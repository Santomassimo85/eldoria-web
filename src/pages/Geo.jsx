import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore"; // Aggiunti import mancanti
import ToggleSection from "./ToggleSection";
import { useAuth } from "../AuthContext";
import GeoAdmin from "./GeoAdmin"; // Importiamo l'admin per usarlo come editor rapido

export default function Geo() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingLoc, setEditingLoc] = useState(null); // Stato per il luogo in modifica
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === "santomassimo85@gmail.com";

  useEffect(() => {
    // Listener in tempo reale
    const unsub = onSnapshot(collection(db, "geo_archive"), (snap) => {
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <p style={{ textAlign: "center", color: "var(--gold)" }}>Consultando le mappe antiche...</p>;

  const continents = ["Vathriddon", "Ehkia", "Ohzkie"];

  return (
    <section style={{ position: "relative" }}>
      <h1 style={{ textAlign: "center", marginBottom: "40px", fontSize: "2rem" }}>Archivio Geomantico</h1>

      {/* MODAL DI MODIFICA RAPIDA */}
      {editingLoc && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(255, 255, 255, 0.8)", zIndex: 9999, overflowY: "auto", padding: "20px"
        }}>
          <div style={{ backgroundColor: "#ffffffc0", padding: "20px", borderRadius: "10px", maxWidth: "800px", margin: "auto" }}>
            <button onClick={() => setEditingLoc(null)} style={{ float: "right", background: "red", color: "white", border: "none", padding: "5px 10px", cursor: "pointer" }}>CHIUDI X</button>
            <h2 className="">Modifica {editingLoc.name}</h2>
            {/* Riutilizziamo GeoAdmin passando il luogo da editare */}
            <GeoAdmin editTarget={editingLoc} onComplete={() => setEditingLoc(null)} />
          </div>
        </div>
      )}

      {continents.map((contName) => {
        const locationsInContinent = locations.filter(l => l.continent === contName || (contName === "Vathriddon" && !l.continent));
        if (locationsInContinent.length === 0) return null;

        return (
          <div key={contName} className="continent-wrapper" style={{ marginBottom: "60px" }}>
            <h1 className="continent-title">{contName}</h1>
            <section className="city" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", width: "100%" }}>
              {locationsInContinent.map((loc) => (
                <ToggleSection key={loc.id} title={loc.name} defaultOpen={false}>
                  {isMaster && (
                    <div style={{ textAlign: "right", marginBottom: "10px" }}>
                      <button 
                        onClick={() => setEditingLoc(loc)} // Apre l'editor nello stato locale
                        style={{ background: "var(--gold)", color: "black", border: "none", padding: "5px 15px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
                      >
                        ⚙️ Modifica Luogo
                      </button>
                    </div>
                  )}
                  <img src={loc.image} alt={loc.name} className="city-img" style={{ width: "100%", borderRadius: "8px" }} />
                  <div className="geo-description" dangerouslySetInnerHTML={{ __html: loc.description }} style={{ textAlign: "left", lineHeight: "1.6", marginTop: "15px" }} />
                </ToggleSection>
              ))}
            </section>
          </div>
        );
      })}
    </section>
  );
}