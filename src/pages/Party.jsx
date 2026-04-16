import React, { useState, useEffect } from 'react';
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import ToggleSection from './ToggleSection';
import './Party.css';

const partyData = {
  party1: [
    { name: "Caius", race: "Elfo", class: "Mago", image: "/assets/player/Caius.jpg" },
    { name: "Garroth", race: "Mezz'Elfo", class: "Ranger", image: "/assets/player/Garroth.jpg" },
    { name: "Tanagar", race: "Mezz'Orco", class: "Guerriero", image: "/assets/player/Tanagar.jpg" },
    { name: "Sylva", race: "Umana", class: "Barbaro", image: "/assets/player/Sylva.png" },
  ],
  party2: [
    { name: "Horn", race: "Umano", class: "Ranger", image: "/assets/player/Horn.jpg" },
    { name: "Thoki", race: "Gnomo", class: "Mago", image: "/assets/player/Thoki.jpg" },
    { name: "Cleofe", race: "Halfling", class: "Ladro", image: "/assets/player/Cleofe.jpg" },
  ],
  party3: [
    { name: "Roynot", race: "Umano", class: "Druido", image: "/assets/player/Roynot.jpg" },
    { name: "Dante", race: "Umano V.", class: "Ladro", image: "/assets/player/Dante.png" },
    { name: "Vyger", race: "Umano", class: "Mago", image: "/assets/player/Vyger.png" },
    { name: "Temistocle Sottocolle", race: "Halfling piede lesto", class: "Stregone", image: "/assets/player/Temistocle.jpeg" },
    { name: "Timoty Bevibotte", race: "Lightfoot Halfling", class: "Ladro", image: "/assets/player/timotyBevibotte.jpeg" },
  ],
  party4: [
    { name: "Makenna", race: "Changeling", class: "Ladro", image: "/assets/player/Makenna.jpeg" },
    { name: "Taaras Stormrage", race: "Mezz'Elfo", class: "Chierico", image: "/assets/player/TaarasStormrage.png" },
    { name: "Soran", race: "Umano", class: "Bardo", image: "/assets/player/Soran.png" },
    { name: "Zethir", race: "Shadar-Kai", class: "Paladino", image: "/assets/player/Zethir.jpeg" },
  ],
};

const CharacterCard = ({ character }) => (
  <div className="character-card">
    <img src={character.image} alt={character.name} className="character-image" />
    <div className="character-info">
      <a href="/link-placeholder" className="character-link" title={`Vedi scheda di ${character.name}`}>
        <h4 className="character-name">{character.name}</h4>
        <p className="character-details">{character.race} · {character.class}</p>
      </a>
    </div>
  </div>
);

export default function Party() {
  const [npcs, setNpcs] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "npcs"), (snap) => {
      setNpcs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <section className="party-page">

      {/* ---- HEADER ---- */}
      <div className="party-header">
        <h1 className="party-title">I Nostri Eroici Avventurieri</h1>
        <div className="party-divider">
          <span className="party-divider-icon">✦</span>
        </div>
      </div>

      {/* ---- PARTY AMEA ---- */}
      <div className="party-section">
        <ToggleSection title="Party AMEA  4/4" defaultOpen={false}>
          <div className="party-grid">
            {partyData.party1.map((char, i) => <CharacterCard key={i} character={char} />)}
          </div>
        </ToggleSection>
      </div>

      {/* ---- PARTY LAC ---- */}
      <div className="party-section">
        <ToggleSection title="Party LAC  3/4">
          <div className="party-grid">
            {partyData.party2.map((char, i) => <CharacterCard key={i} character={char} />)}
          </div>
        </ToggleSection>
      </div>

      {/* ---- PARTY ENOX ---- */}
      <div className="party-section">
        <ToggleSection title="Party Enox  4/4">
          <div className="party-grid">
            {partyData.party3.map((char, i) => <CharacterCard key={i} character={char} />)}
          </div>
        </ToggleSection>
      </div>

      {/* ---- PARTY LEAF ---- */}
      <div className="party-section">
        <ToggleSection title="Party Leaf  4/4">
          <div className="party-grid">
            {partyData.party4.map((char, i) => <CharacterCard key={i} character={char} />)}
          </div>
        </ToggleSection>
      </div>

      <hr />

      {/* ---- NPC ---- */}
      <div className="party-section">
        <ToggleSection title="NPC ed Incontri Notevoli">
          <div className="party-grid">
            {npcs.length > 0 ? (
              npcs.map((npc) => (
                <div key={npc.id} className="character-card">
                  <img
                    src={npc.image || "/assets/player/default.png"}
                    alt={npc.name}
                    className="character-image"
                  />
                  <div className="character-info">
                    <h4 className="character-name">{npc.name}</h4>
                    <p className="npc-location">{npc.faction} · {npc.location}</p>
                    {npc.description && (
                      <p className="npc-desc">{npc.description}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ textAlign: "center", width: "100%", color: "#999", fontStyle: "italic" }}>
                Nessun NPC censito.
              </p>
            )}
          </div>
        </ToggleSection>
      </div>

    </section>
  );
}
