import React from 'react';
import ToggleSection from './ToggleSection'; // Assumi che ToggleSection.jsx sia nella stessa cartella
// import './Party.css'; 
// Dati dei personaggi
const partyData = {
  party1: [
    { name: "Caius", race: "Elfo", class: "Mago", image: "/assets/party_members/caius.jpg" },
    { name: "Garroth", race: "Mezz'Elfo", class: "Ranger", image: "/assets/player/Garroth.jpg" },
    { name: "Tanagar", race: "Mezz'Orco", class: "Guerriero", image: "/assets/player/Tanagar.jpg" },
    { name: "Sylva", race: "Umana", class: "Barbari", image: "/assets/party_members/sylva.jpg" },
  ],
  party2: [
    { name: "Lyra", race: "Umana", class: "Barda", image: "/assets/party_members/lyra.jpg" },
    { name: "Thorn", race: "Nano", class: "Chierico", image: "/assets/party_members/thorn.jpg" },
    { name: "Kaelen", race: "Elfo", class: "Ladro", image: "/assets/party_members/kaelen.jpg" },
  ],
};

// Componente per una singola Card del personaggio
const CharacterCard = ({ character }) => (
  <div className="character-card">
    <img src={character.image} alt={character.name} className="character-image" />
    <div className="character-info">
      <h4 className="character-name">{character.name}</h4>
      <p className="character-details">{character.race} {character.class}</p>
    </div>
  </div>
);

export default function Party() {
  return (
    <section className="party-page">
      <h1>I Nostri Eroici Avventurieri</h1>

      <ToggleSection title="Party 1" defaultOpen={true}> {/* Puoi decidere quale aprire di default */}
        <div className="party-grid">
          {partyData.party1.map((char, index) => (
            <CharacterCard key={index} character={char} />
          ))}
        </div>
      </ToggleSection>

      <ToggleSection title="Party 2">
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