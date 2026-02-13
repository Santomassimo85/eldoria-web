import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import ToggleSection from "./ToggleSection";

export default function Geo() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGeo = async () => {
      const snap = await getDocs(collection(db, "geo_archive"));
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    loadGeo();
  }, []);

  if (loading) return <p>Consultando le mappe antiche...</p>;

  return (
    <section>
      <h1>Archivio Geomantico</h1>
      <section className="city">
        {locations.map((loc) => (
          <ToggleSection key={loc.id} title={loc.name} defaultOpen={false}>
            {/* Struttura fedele alla foto: Immagine in alto */}
            <img src={loc.image} alt={loc.name} className="city-img" />
            <br />
            
            {/* Descrizione con Drop Cap simulato se necessario via CSS */}
            <div 
              className="geo-description" 
              dangerouslySetInnerHTML={{ __html: loc.description }} 
            />
            <br />
            
            {/* Baluardi e Cuori */}
            {loc.landmarks && (
              <>
                <h4>Baluardi e Cuori della Città</h4>
                <div dangerouslySetInnerHTML={{ __html: loc.landmarks }} />
                <br />
              </>
            )}

            {/* Punti di Interesse dinamici */}
            <h4 style={{ textAlign: "left" }}>Punti di Interesse</h4>
            <ul style={{ padding: 0 }}>
              {loc.pointsOfInterest?.map((poi, index) => (
                <li key={index} style={{ display: "flex", alignItems: "center", marginBottom: "10px", gap: "10px" }}>
                  <img src={poi.icon} alt="icon" style={{ width: "24px", height: "24px" }} />
                  <span>{poi.label}</span>
                </li>
              ))}
            </ul>
          </ToggleSection>
        ))}
      </section>
    </section>
  );
}