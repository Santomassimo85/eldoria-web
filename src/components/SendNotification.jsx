import React, { useState, useEffect } from "react";
import { db } from "../firebase"; // Assicurati che il percorso sia corretto
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import "./SendNotification.css"; 
// Aggiungi stili personalizzati se necessario
export default function SendNotification() {
  const [characters, setCharacters] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Carica la lista dei personaggi all'avvio
  useEffect(() => {
    const fetchCharacters = async () => {
      const querySnapshot = await getDocs(collection(db, "characters"));
      const chars = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || "Eroe Senza Nome"
      }));
      setCharacters(chars);
    };
    fetchCharacters();
  }, []);

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !title || !message) return alert("Compila tutto!");

    setLoading(true);
    try {
      // Invia una notifica separata per ogni player selezionato
      const promises = selectedIds.map(userId => 
        addDoc(collection(db, "notifications"), {
          userId,
          title,
          message,
          read: false,
          timestamp: serverTimestamp()
        })
      );
      
      await Promise.all(promises);
      alert("Messaggi magici inviati con successo!");
      setTitle("");
      setMessage("");
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      alert("Errore nell'invio del corvo messaggero.");
    }
    setLoading(false);
  };

  return (
    <div className="admin-notif-container">
      <h2>Invia Notifica ad Exanthia</h2>
      <form onSubmit={handleSend}>
        <div className="player-selector">
          <p>Seleziona i destinatari:</p>
          {characters.map(char => (
            <label key={char.id} className="checkbox-label">
              <input 
                type="checkbox" 
                checked={selectedIds.includes(char.id)} 
                onChange={() => toggleSelect(char.id)}
              />
              {char.name}
            </label>
          ))}
        </div>

        <input 
          type="text" 
          placeholder="Titolo (es: Un sussurro nell'ombra)" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <textarea 
          placeholder="Scrivi il messaggio qui..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Incantando..." : "Invia Messaggio"}
        </button>
      </form>
    </div>
  );
}