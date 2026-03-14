import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { 
  doc, onSnapshot, updateDoc, setDoc, arrayUnion, arrayRemove, collection 
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./Arena.css";

export default function Arena() {
  const { currentUser } = useAuth();
  const [arenaMeta, setArenaMeta] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  
  const isMaster = currentUser?.email === "santomassimo85@gmail.com";

  useEffect(() => {
    // 1. Ascolta lo stato dell'arena
    const unsub = onSnapshot(doc(db, "arena_meta", "global"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setArenaMeta(data);
        setIsJoined(data.participants?.includes(currentUser.uid));
      }
    });
    return () => unsub();
  }, [currentUser.uid]);

  const toggleArena = async () => {
    await updateDoc(doc(db, "arena_meta", "global"), {
      isOpen: !arenaMeta.isOpen,
      participants: !arenaMeta.isOpen ? [] : arenaMeta.participants // Reset se apriamo nuova sessione
    });
  };

  const joinArena = async () => {
    await updateDoc(doc(db, "arena_meta", "global"), {
      participants: arrayUnion(currentUser.uid)
    });
  };

  if (!arenaMeta) return <div className="arena-loading">Caricamento Arena...</div>;

  return (
    <div className="arena-container">
      <h1 className="gold-text">Santuario dei Campioni</h1>

      {/* SEZIONE MASTER */}
      {isMaster && (
        <div className="master-panel">
          <button onClick={toggleArena} className="wb-btn-action">
            {arenaMeta.isOpen ? "Chiudi Iscrizioni Arena" : "Apri Iscrizioni Arena"}
          </button>
          <div className="participants-count">
            Iscritti: {arenaMeta.participants?.length || 0}
          </div>
          <button className="wb-btn-action" style={{background: '#27ae60'}}>
            Genera Accoppiamenti
          </button>
        </div>
      )}

      {/* SEZIONE ISCRIZIONE PLAYER */}
      {arenaMeta.isOpen ? (
        <div className="join-section">
          <h2>Le iscrizioni sono APERTE!</h2>
          {!isJoined ? (
            <button onClick={joinArena} className="btn-join-arena">
              ⚔️ ISCRIVITI ORA ⚔️
            </button>
          ) : (
            <div className="joined-msg">Sei iscritto. Attendi la generazione degli scontri...</div>
          )}
        </div>
      ) : (
        <div className="results-section">
          <h2>Arena Chiusa</h2>
          <p>Qui verranno mostrati gli ultimi risultati dei tornei.</p>
          {/* Mappa dei risultati passati */}
        </div>
      )}
    </div>
  );
}