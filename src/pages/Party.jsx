import React from 'react';
import ToggleSection from './ToggleSection'; 
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
  party3: [
   { name: "Roynot", race: "EUmanoo", class: "Druido", image: "/assets/player/Roynot.jpg" },
    { name: "Dante", race: "Umano V.", class: "Ladro", image: "/assets/player/Dante.png" },
    { name: "Vyger", race: "Umano", class: "Mago", image: "/assets/player/Vyger.png" },
    { name: "Temistocle Sottocolle", race: "Halfling piede lesto", class: "Stregone", image: "/assets/player/Temistocle.jpeg" },
    { name: "Khorvash", race: "Tiefling ", class: "Barbaro", image: "/assets/player/Khorvash.jpg" },

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

    </section>
  );
}