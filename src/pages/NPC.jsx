import React, { useState, useEffect } from 'react';
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import ToggleSection from './ToggleSection';
import './NPC.css';

export default function NPC() {
  const [npcs, setNpcs] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "npcs"), (snap) => {
      setNpcs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Raggruppa per linkedCity; senza città → sezione "Erranti"
  const grouped = npcs.reduce((acc, npc) => {
    const city = npc.linkedCity?.trim() || "Erranti";
    if (!acc[city]) acc[city] = [];
    acc[city].push(npc);
    return acc;
  }, {});

  // Ordina: città alfabetiche, "Erranti" sempre in fondo
  const cityKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "Erranti") return 1;
    if (b === "Erranti") return -1;
    return a.localeCompare(b, "it");
  });

  return (
    <section className="npc-page">

      <div className="npc-header">
        <h1 className="npc-title">Gli abitanti del mondo</h1>
        <div className="npc-divider">
          <span className="npc-divider-icon">✦</span>
        </div>
      </div>

      {npcs.length === 0 ? (
        <p className="npc-empty">Nessun personaggio censito.</p>
      ) : (
        cityKeys.map((city, idx) => (
          <div key={city} className="npc-city-section">
            <ToggleSection title={`${city}  (${grouped[city].length})`} defaultOpen={idx === 0}>
              <div className="npc-grid">
                {grouped[city].map((npc) => (
                  <div key={npc.id} className="npc-card">
                    <img
                      src={npc.image || "/assets/player/default.png"}
                      alt={npc.name}
                      className="npc-card-image"
                    />
                    <div className="npc-card-body">
                      <h3 className="npc-card-name">{npc.name}</h3>
                      {(npc.faction || npc.location) && (
                        <p className="npc-card-meta">
                          {[npc.faction, npc.location].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {npc.description && (
                        <p className="npc-card-desc">{npc.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ToggleSection>
          </div>
        ))
      )}

    </section>
  );
}
