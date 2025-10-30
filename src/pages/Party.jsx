import React from 'react';
import ToggleSection from './ToggleSection'; // Assumi che ToggleSection.jsx sia nella stessa cartella
// import './Party.css'; 
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
  return (
    <section className="party-page">
      <h3>I Nostri Eroici Avventurieri</h3>

      <ToggleSection title="Party AMEA" defaultOpen={false}> {/* Puoi decidere quale aprire di default */}
        <div className="party-grid">
          {partyData.party1.map((char, index) => (
            <CharacterCard key={index} character={char} />
          ))}
        </div>
      </ToggleSection>

      <ToggleSection title="Party LAC">
        <div className="party-grid">
          {partyData.party2.map((char, index) => (
            <CharacterCard key={index} character={char} />
          ))}
        </div>
      </ToggleSection>

      {/* Puoi aggiungere altre sezioni per futuri party o PNG */}
    </section>
  );
}