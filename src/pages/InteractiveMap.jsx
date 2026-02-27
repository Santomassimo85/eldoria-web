import React, { useState } from 'react';
import './InteractiveMap.css'; // Creeremo questo file o useremo style.css

const MAP_POINTS = [
  {
    id: "tirrendale",
    name: "Tirrendale",
    x: 51.3, // Esempio di coordinata %
    y: 62.2, 
    description: "La Regina dei Mari e il cuore pulsante del commercio di Eldoria.",
    image: "/assets/Tirrendale_view.png"
  },
  {
    id: "Golden Castle",
    name: "Golden Castle",
    x: 62.1,
    y: 32.8,
    description: "Il castello del drago dorato Aurexion",
    image: "/assets/Golden_castle.png"
  },
   {
    id: "Helmvil",
    name: "Helmvil",
    x: 53.1,
    y: 37.8,
    description: "Il castello del drago dorato Aurexion",
    image: "/assets/Golden_castle.png"
  },
   {
    id: "Hopeclif",
    name: "Hopeclif",
    x: 74.1,
    y: 65.8,
    description: "Il castello del drago dorato Aurexion",
    image: "/assets/Golden_castle.png"
  },
   {
    id: "Yotta",
    name: "Yotta",
    x: 26.1,
    y: 31.8,
    description: "Il castello del drago dorato Aurexion",
    image: "/assets/Golden_castle.png"
  },
  
   {
    id: "Black Castle",
    name: "Black Castle",
    x: 11.1,
    y: 33.8,
    description: "Il castello del drago dorato Aurexion",
    image: "/assets/Golden_castle.png"
  }
];

export default function InteractiveMap() {
  const [selectedPoint, setSelectedPoint] = useState(null);

  // FUNZIONE PER TROVARE LE COORDINATE (Usa questa in sviluppo!)
  const handleMapClick = (e) => {
    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    console.log(`Punto trovato: x: ${x.toFixed(1)}, y: ${y.toFixed(1)}`);
  };

  return (
    <div className="map-page-container">
      <h1 className="map-title">Mappa di Eldoria</h1>
      
      <div className="map-viewport">
        <div className="map-wrapper">
          <img 
            src="/assets/Eldoria_Map.jpg" 
            alt="Mappa Interattiva" 
            className="main-map-img"
            onClick={handleMapClick} 
          />

          {/* Render dei Marker (Punti) */}
          {MAP_POINTS.map(point => (
            <div 
              key={point.id}
              className="map-marker"
              style={{ top: `${point.y}%`, left: `${point.x}%` }}
              onClick={() => setSelectedPoint(point)}
            >
              <div className="marker-icon">📍</div>
              <span className="marker-label">{point.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* OVERLAY / POPUP (Adattivo per PC e Mobile) */}
      {selectedPoint && (
        <div className="map-overlay" onClick={() => setSelectedPoint(null)}>
          <div className="map-info-card" onClick={e => e.stopPropagation()}>
            <button className="close-card" onClick={() => setSelectedPoint(null)}>✕</button>
            {selectedPoint.image && <img src={selectedPoint.image} alt={selectedPoint.name} />}
            <div className="card-body">
              <h2>{selectedPoint.name}</h2>
              <p>{selectedPoint.description}</p>
              <button className="btn-go" onClick={() => alert('Dettagli in arrivo...')}>Esplora Archivio</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}