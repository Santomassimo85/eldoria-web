import React, { useState, useEffect, useRef, useCallback } from 'react';
import QuickPinchZoom, { make3dTransformValue } from 'react-quick-pinch-zoom';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import './InteractiveMap.css';

const MASTER_EMAIL = "santomassimo85@gmail.com";
const ROMBO_SCALE = 2.5; 

export default function InteractiveMap() {
  const { currentUser } = useAuth();
  const imgRef = useRef();
  const pinchZoomRef = useRef(); // Riferimento al componente zoom
  
  const [pins, setPins] = useState([]);
  const [showPins, setShowPins] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userParty, setUserParty] = useState(null);

  const [isMeasuring, setIsMeasuring] = useState(false);
  const [waypoints, setWaypoints] = useState([]);
  const [travelResults, setTravelResults] = useState(null);

  const [newPin, setNewPin] = useState(null);
  const [pinData, setPinData] = useState({ party: "Amea", desc: "" });

  // --- LOGICA ZOOM ---
  const onUpdate = useCallback(({ x, y, scale }) => {
    const { current: img } = imgRef;
    if (img) {
      const value = make3dTransformValue({ x, y, scale });
      img.style.setProperty('transform', value);
    }
  }, []);

  // Gestore per lo zoom con rotellina (Mouse Wheel)
  const handleWheel = useCallback((e) => {
    if (pinchZoomRef.current) {
      // Regola la velocità dello zoom qui (0.001 è standard)
      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
      pinchZoomRef.current.scaleTo({
        x: e.clientX,
        y: e.clientY,
        scale: pinchZoomRef.current.scale * scaleFactor,
      });
    }
  }, []);

  useEffect(() => {
    const isMaster = currentUser?.email === MASTER_EMAIL;
    setIsAdmin(isMaster);

    if (currentUser && !isMaster) {
      const fetchUserParty = async () => {
        try {
          const userDoc = await getDoc(doc(db, "characters", currentUser.uid));
          if (userDoc.exists()) setUserParty(userDoc.data().party);
        } catch (error) {
          console.error("Errore recupero party:", error);
        }
      };
      fetchUserParty();
    }

    const unsub = onSnapshot(collection(db, "map_pins"), (snap) => {
      setPins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentUser]);

  // --- GESTIONE CLICK ---
  const handleMapClick = (e) => {
    if (e.target.closest('.map-pin-form') || e.target.closest('.pin-info-popup') || e.target.closest('.travel-results-card')) return;

    const rect = imgRef.current.getBoundingClientRect();
    
    // Calcoliamo la posizione corretta tenendo conto dello zoom attuale
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (isMeasuring) {
      setWaypoints([...waypoints, { x, y }]);
      return;
    }

    if (isAdmin && !e.target.closest('.map-fantasy-pin')) {
      setNewPin({ x, y });
    }
  };

  const savePin = async () => {
    if (!pinData.desc) return alert("Inserisci una descrizione!");
    await addDoc(collection(db, "map_pins"), {
      ...pinData,
      x: newPin.x,
      y: newPin.y,
      timestamp: new Date().toLocaleString('it-IT', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
    });
    setNewPin(null);
    setPinData({ party: "Amea", desc: "" });
  };

  const deletePin = async (id, e) => {
    e.stopPropagation();
    if (window.confirm("Eliminare questo punto?")) {
      await deleteDoc(doc(db, "map_pins", id));
    }
  };

  const calculateTravel = () => {
    if (waypoints.length < 2) return;
    let totalDist = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const d = Math.sqrt(Math.pow(waypoints[i+1].x - waypoints[i].x, 2) + Math.pow(waypoints[i+1].y - waypoints[i].y, 2));
      totalDist += d;
    }
    const totalRombi = totalDist / ROMBO_SCALE;
    setTravelResults({
      rombi: totalRombi.toFixed(1),
      foot: ((totalRombi * 4) / 24).toFixed(1),
      horse: ((totalRombi * 2) / 24).toFixed(1)
    });
  };

  const filteredPins = pins.filter(pin => isAdmin || (showPins && (pin.party === userParty || pin.party === "Generale")));

  return (
    <div className="map-page-container" onWheel={handleWheel}>
      
      <div className="map-interface-overlay">
        <button className={`map-btn-reveal ${showPins ? 'active' : ''}`} onClick={() => setShowPins(!showPins)}>
          {showPins ? "Nascondi Cronologia" : "Mostra Cronologia"}
        </button>

        <button className={`map-btn-measure ${isMeasuring ? 'active' : ''}`} onClick={() => {
          setIsMeasuring(!isMeasuring);
          setWaypoints([]);
          setTravelResults(null);
        }}>
          {isMeasuring ? "Esci Righello" : "📏 Misura Distanze"}
        </button>
        
        {isAdmin && <span className="map-admin-badge">DM MODE</span>}
      </div>

      {travelResults && (
        <div className="travel-results-card">
          <h4>Viaggio Stimato</h4>
          <p>Distanza: <strong>{travelResults.rombi} Rombi</strong></p>
          <p>🚶 Piedi: {travelResults.foot} gg</p>
          <p>🐎 Cavallo: {travelResults.horse} gg</p>
          <button onClick={() => {setWaypoints([]); setTravelResults(null);}}>Reset</button>
        </div>
      )}

      <QuickPinchZoom 
        ref={pinchZoomRef}
        onUpdate={onUpdate} 
        wheelScaleFactor={0.002} 
        draggableUnZoomed={true}
        enforceBoundsDuringZoom={true}
        maxZoom={5}
        minZoom={0.5}
      >
        <div className="map-viewport" ref={imgRef} onClick={handleMapClick}>
          <div className="map-scroll-canvas">
            <img src="/assets/Eldoria_Map.jpg" alt="Map" className="map-base-img" />
            
            {isMeasuring && (
               <svg className="map-svg-layer">
                 {waypoints.length > 1 && (
                   <polyline 
                     points={waypoints.map(p => `${p.x}%,${p.y}%`).join(' ')} 
                     fill="none" stroke="var(--gold)" strokeWidth="0.5" strokeDasharray="1"
                   />
                 )}
               </svg>
            )}

            {waypoints.map((p, i) => (
              <div key={i} className="waypoint-dot" style={{ left: `${p.x}%`, top: `${p.y}%` }}>{i + 1}</div>
            ))}

            {filteredPins.map(pin => (
              <div key={pin.id} className={`map-fantasy-pin ${pin.party.toLowerCase()}`}
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                onClick={(e) => isAdmin && !isMeasuring && deletePin(pin.id, e)}
              >
                <div className="pin-head"><div className="pin-dot"></div></div>
                <div className="pin-info-popup">
                  <strong>{pin.party}</strong>
                  <p>{pin.desc}</p>
                </div>
              </div>
            ))}

            {isAdmin && newPin && (
              <div className="map-fantasy-pin temp-placement" style={{ left: `${newPin.x}%`, top: `${newPin.y}%` }}>
                <div className="pin-head"></div>
              </div>
            )}
          </div>
        </div>
      </QuickPinchZoom>

      {isMeasuring && waypoints.length > 1 && !travelResults && (
        <button className="btn-calculate-dist" onClick={calculateTravel}>CALCOLA DISTANZA</button>
      )}

      {isAdmin && newPin && (
        <div className="map-form-modal" onClick={() => setNewPin(null)}>
          <div className="map-pin-form" onClick={e => e.stopPropagation()}>
            <h3>Nuovo Pin</h3>
            <select value={pinData.party} onChange={e => setPinData({...pinData, party: e.target.value})}>
              <option value="Amea">Amea</option>
              <option value="Lac">Lac</option>
              <option value="Enox">Enox</option>
              <option value="Generale">Generale</option>
            </select>
            <textarea value={pinData.desc} onChange={e => setPinData({...pinData, desc: e.target.value})} />
            <button onClick={savePin} className="btn-save">Salva</button>
          </div>
        </div>
      )}
    </div>
  );
}