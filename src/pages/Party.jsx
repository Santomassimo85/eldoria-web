import React, { useState, useEffect } from 'react';
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import ToggleSection from './ToggleSection';

// Dati dei personaggi
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
   { name: "Roynot", race: "Umanoo", class: "Druido", image: "/assets/player/Roynot.jpg" },
    { name: "Dante", race: "Umano V.", class: "Ladro", image: "/assets/player/Dante.png" },
    { name: "Vyger", race: "Umano", class: "Mago", image: "/assets/player/Vyger.png" },
    { name: "Temistocle Sottocolle", race: "Halfling piede lesto", class: "Stregone", image: "/assets/player/Temistocle.jpeg" },
    { name: "Khorvash", race: "Tiefling ", class: "Barbaro", image: "/assets/player/Khorvash.jpg" },

  ],
  party4: [
    { name: "Makenna", race: "Changeling", class: "Ladro", image: "/assets/player/Makenna.jpg" },
    { name: "Cornelius", race: "Goliath", class: "Paladino", image: "/assets/player/Cornelius.jpg" },
    { name: "Soran", race: "Umano", class: "Bardo", image: "/assets/player/Soran.jpg" },
      { name: "Soran", race: "Halfling", class: "Ladro", image: "/assets/player/Cleofe.jpg" },

  ],
};

// Componente per una singola Card del personaggio
const CharacterCard = ({ character }) => (
  <div className="character-card">
    <img src={character.image} alt={character.name} className="character-image" />
    <div className="character-info">
      {/* TRASFORMAZIONE IN LINK CLICCABILE */}
      <a href="/link-placeholder" className="character-link" title={`Vedi scheda di ${character.name}`}>
        <h4 className="character-name">{character.name}</h4>
        <p className="character-details">{character.race} {character.class}</p>
      </a>
    </div>
  </div>
);

export default function Party() {

  const [npcs, setNpcs] = useState([]);

  // Recupera gli NPC in tempo reale dal database
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "npcs"), (snap) => {
      setNpcs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);
  return (
    <section className="party-page">
      <h3>I Nostri Eroici Avventurieri</h3>

      <ToggleSection title="Party AMEA 4/4" defaultOpen={false}> {/* Puoi decidere quale aprire di default */}
        <div className="party-grid">
          {partyData.party1.map((char, index) => (
            <CharacterCard key={index} character={char} />
          ))}
        </div>
      </ToggleSection>

      <ToggleSection title="Party LAC 3/4">
        <div className="party-grid">
          {partyData.party2.map((char, index) => (
            <CharacterCard key={index} character={char} />
          ))}
        </div>
      </ToggleSection>

      <ToggleSection title="Party Enox 5/5">
        <div className="party-grid">
          {partyData.party3.map((char, index) => (
            <CharacterCard key={index} character={char} />
          ))}
        </div>
      </ToggleSection>

<hr />
{/* NUOVA SEZIONE NPC DINAMICA */}
      <ToggleSection title="NPC ed Incontri Notevoli">
        <div className="party-grid">
          {npcs.length > 0 ? (
            npcs.map((npc) => (
              <div key={npc.id} className="character-card">
                <img src={npc.image || "/assets/player/default.png"} alt={npc.name} className="character-image" />
                <div className="character-info">
                  <h4 className="character-name">{npc.name}</h4>
                  <p className="character-details" style={{ color: "var(--gold)" }}>
                    {npc.faction} • {npc.location}
                  </p>
                  <p style={{ fontSize: "0.8rem", fontStyle: "italic", marginTop: "5px", color: "#4d4242" }}>
                    {npc.description}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p style={{ textAlign: "center", width: "100%", color: "#666" }}>Nessun NPC censito in questo continente.</p>
          )}
        </div>
      </ToggleSection>


    </section>
  );
}