import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import ToggleSection from "./ToggleSection";
import { useAuth } from "../AuthContext";
import GeoAdmin from "./GeoAdmin";
import { awardPetPoints } from "../utils/pet";
import './Geo.css';

export default function Geo() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingLoc, setEditingLoc] = useState(null);
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === "santomassimo85@gmail.com";

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "geo_archive"), (snap) => {
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 🐣 pet system: +1 point per day for opening the Geo archive
  useEffect(() => {
    if (currentUser?.uid) awardPetPoints(currentUser.uid, "geo_visit");
  }, [currentUser]);

  if (loading) {
    return (
      <section className="geo-page">
        <div className="geo-loading">
          <span className="geo-loading-icon">🗺️</span>
          Consultando le mappe antiche…
        </div>
      </section>
    );
  }

  const continents = ["Vathriddon", "Ehkia", "Ohzkie"];

  return (
    <section className="geo-page">

      {/* ---- HEADER ---- */}
      <div className="geo-header">
        <h1 className="geo-title">Archivio Geomantico</h1>
        <div className="geo-divider">
          <span className="geo-divider-icon">✦</span>
        </div>
      </div>

      {/* ---- MODAL MODIFICA RAPIDA ---- */}
      {editingLoc && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(255,255,255,0.85)", zIndex: 9999,
          overflowY: "auto", padding: "20px"
        }}>
          <div style={{
            backgroundColor: "#ffffffee", padding: "24px", borderRadius: "12px",
            maxWidth: "800px", margin: "0 auto",
            border: "1.5px solid rgba(212,175,55,0.3)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.1)"
          }}>
            <button
              onClick={() => setEditingLoc(null)}
              style={{
                float: "right", background: "var(--red)", color: "white",
                border: "none", padding: "6px 14px", cursor: "pointer",
                borderRadius: "6px", fontWeight: "bold"
              }}
            >
              ✕ Chiudi
            </button>
            <h2 style={{ color: "var(--red)", fontFamily: "var(--font-title)", marginBottom: "16px" }}>
              Modifica — {editingLoc.name}
            </h2>
            <GeoAdmin editTarget={editingLoc} onComplete={() => setEditingLoc(null)} />
          </div>
        </div>
      )}

      {/* ---- CONTINENTI ---- */}
      {continents.map((contName) => {
        const locationsInContinent = locations.filter(
          l => l.continent === contName || (contName === "Vathriddon" && !l.continent)
        );
        if (locationsInContinent.length === 0) return null;

        return (
          <div key={contName} className="continent-wrapper">
            <h2 className="continent-title">{contName}</h2>

            <div className="geo-grid">
              {locationsInContinent.map((loc) => (
                <div key={loc.id} className="geo-card-wrapper">
                  <ToggleSection
                    title={loc.name}
                    defaultOpen={false}
                    staticContent={loc.image && (
                      <img src={loc.image} alt={loc.name} className="geo-card-preview" />
                    )}
                  >
                    {isMaster && (
                      <button
                        className="geo-edit-btn"
                        onClick={() => setEditingLoc(loc)}
                      >
                        ⚙️ Modifica Luogo
                      </button>
                    )}
                    <div
                      className="geo-description"
                      dangerouslySetInnerHTML={{ __html: loc.description }}
                    />
                  </ToggleSection>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
