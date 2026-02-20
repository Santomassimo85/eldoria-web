import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import Countdown from '../components/Countdown';

export default function NextGame() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    // Ascolta la collezione sessions in tempo reale
    const unsubscribe = onSnapshot(collection(db, "sessions"), (snapshot) => {
      const sessionData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSessions(sessionData);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="next-game-page" style={{ padding: "20px", color: "white" }}>
      <h1 style={{ textAlign: "center", fontFamily: "Cinzel Decorative" }}>Prossime Sessioni</h1>
      <div className="countdown-grid" style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
       
       
       {sessions.map((s) => (
  <Countdown 
    key={s.id} 
    partyName={s.id} // Questo passerà "Amea", "Lac" o "Enox"
    targetDate={s.date} 
    // linkRoll20={s.link}  <-- Possiamo anche smettere di passarlo se lo mettiamo fisso nel Countdown
  />
))}
      </div>
    </div>
  );
}