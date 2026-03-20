import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import ToggleSection from "./ToggleSection";

export default function Geo() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGeo = async () => {
      try {
        const snap = await getDocs(collection(db, "geo_archive"));
        setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Errore caricamento Geo:", error);
      }
      setLoading(false);
    };
    loadGeo();
  }, []);

  if (loading) return <p style={{textAlign:"center", color:"var(--gold)"}}>Consultando le mappe antiche...</p>;

  const continents = ["Vathriddon", "Ehkia", "Ohzkie"];

  return (
    <section>
      <h1 style={{textAlign: "center", marginBottom: "40px", fontSize: "2rem"}}>Archivio Geomantico</h1>

      {continents.map(contName => {
        // Se una città vecchia non ha continente, la mettiamo di default in Vathriddon per non farla sparire
        const locationsInContinent = locations.filter(l => 
          (l.continent === contName) || (contName === "Vathriddon" && !l.continent)
        );

        if (locationsInContinent.length === 0) return null;

        return (
          <div key={contName} className="continent-wrapper" style={{marginBottom: "60px"}}>
            <h1 className="continent-title">{contName}</h1>
            
            <section className="city" style={{
  display: "grid",
  // Cambiato da 45% a 300px per permettere al responsive di scendere a 1 colonna
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
  gap: "20px", // Ridotto leggermente il gap per schermi piccoli
  width: "100%"
}}>
  {locationsInContinent.map((loc) => (
    <ToggleSection key={loc.id} title={loc.name} defaultOpen={false}>
                  <img src={loc.image} alt={loc.name} className="city-img" style={{width: "100%", borderRadius:"8px"}} />
                  <br /><br />
                  <div 
                    className="geo-description" 
                    dangerouslySetInnerHTML={{ __html: loc.description }} 
                    style={{textAlign: "left", lineHeight: "1.6"}}
                  />
                  <br />
                  
                  {loc.pointsOfInterest && loc.pointsOfInterest.length > 0 && (
                    <div className="poi-section" style={{textAlign: "left"}}>
                      <h4 style={{ color: "var(--red)" }}>Punti di Interesse</h4>
                      <ul style={{ padding: 0, listStyle: "none" }}>
                        {loc.pointsOfInterest.map((poi, index) => (
                          <li key={index} style={{ display: "flex", alignItems: "center", marginBottom: "10px", gap: "10px" }}>
                            <img src={poi.icon} alt="icon" style={{ width: "24px", height: "24px" }} />
                            <span>{poi.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </ToggleSection>
              ))}
            </section>
          </div>
        );
      })}
    </section>
  );
}