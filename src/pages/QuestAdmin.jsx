import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc 
} from "firebase/firestore";
import { Link } from "react-router-dom";

export default function QuestAdmin() {
  const [quests, setQuests] = useState([]);
  const [characters, setCharacters] = useState([]); 
  const [loading, setLoading] = useState(false);
  
  // Stato del Form con ricompense divise e destinatario
  const [formData, setFormData] = useState({ 
    title: "", 
    desc: "", 
    diff: "Media", 
    zona: "", 
    rewardGold: 0, 
    rewardItem: "", 
    rewardOther: "",
    targetCharacter: "All" 
  });

  // 1. Carica Quest e Personaggi dal Database
  const fetchData = async () => {
    try {
      // Carica le Quest attive
      const questSnap = await getDocs(collection(db, "quests"));
      setQuests(questSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Carica i Personaggi (usando il campo 'name' che hai appena aggiunto)
      const charSnap = await getDocs(collection(db, "characters"));
      const charList = charSnap.docs.map(d => ({ 
        id: d.id, 
        charName: d.data().name || "Eroe Senza Nome" 
      }));
      setCharacters(charList);
    } catch (error) {
      console.error("Errore nel caricamento dati:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Gestione Invio Nuova Missiva
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "quests"), {
        ...formData,
        rewardGold: Number(formData.rewardGold), // Forza il formato numerico per le monete
        createdAt: new Date().toISOString()
      });
      
      // Reset dei campi dopo l'invio
      setFormData({ 
        title: "", desc: "", diff: "Media", zona: "", 
        rewardGold: 0, rewardItem: "", rewardOther: "", targetCharacter: "All" 
      });
      
      fetchData(); // Rinfresca la lista visualizzata
      alert("La pergamena è stata appesa in bacheca!");
    } catch (error) {
      console.error("Errore salvataggio:", error);
      alert("Errore nel sigillare la missiva.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Rimoziome Quest
  const handleDelete = async (id) => {
    if (window.confirm("Sei sicuro di voler strappare questa missione dalla bacheca?")) {
      await deleteDoc(doc(db, "quests", id));
      fetchData();
    }
  };

  return (
    <section className="admin-page quest-admin">
      <Link to="/dm-admin" className="back-button">← Dashboard Master</Link>
      <h1>Gestione Bacheca di Hemile</h1>

      <div className="admin-container">
        {/* FORM DI CREAZIONE MISSIONE */}
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-section">
            <h3>📜 Dettagli della Missiva</h3>
            <input 
              placeholder="Titolo della Quest" 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              required 
            />
            <textarea 
              placeholder="Descrizione per i giocatori (Lore e obiettivi)..." 
              value={formData.desc} 
              onChange={e => setFormData({...formData, desc: e.target.value})} 
              required 
              style={
                {width: "100%", height: "150px", borderRadius: "15px", padding: "10px", fontSize: "1rem", border: "1px solid #ccc"}
              }
              rows="4"
            />
            <div className="form-row">
              <select value={formData.diff} onChange={e => setFormData({...formData, diff: e.target.value})}>
                <option value="Facile">Facile</option>
                <option value="Media">Media</option>
                <option value="Difficile">Difficile</option>
                <option value="Eroica">Eroica</option>
              </select>
              <input 
                placeholder="Zona di Eldoria" 
                value={formData.zona} 
                onChange={e => setFormData({...formData, zona: e.target.value})} 
                required 
              />
            </div>
          </div>

          <div className="form-section">
            <h3>💰 Ricompense Promesse</h3>
            <div className="reward-inputs">
              <input 
                type="number" 
                placeholder="Monete Platino" 
                value={formData.rewardGold} 
                onChange={e => setFormData({...formData, rewardGold: e.target.value})} 
              />
              <input 
                type="text" 
                placeholder="Oggetto Magico / Loot" 
                value={formData.rewardItem} 
                onChange={e => setFormData({...formData, rewardItem: e.target.value})} 
              />
              <input 
                type="text" 
                placeholder="Altro (Informazioni, Legami...)" 
                value={formData.rewardOther} 
                onChange={e => setFormData({...formData, rewardOther: e.target.value})} 
              />
            </div>
          </div>

          <div className="form-section">
            <h3>👤 Destinatario (Segretezza)</h3>
            <select 
              value={formData.targetCharacter} 
              onChange={e => setFormData({...formData, targetCharacter: e.target.value})}
              className="target-select"
            >
              <option value="All">🌐 Pubblica (Visibile a tutti)</option>
              {characters.map(char => (
                <option key={char.id} value={char.charName}>
                  🔒 Solo per {char.charName}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="admin-button" disabled={loading}>
            {loading ? "Affiggendo..." : "Appendi alla Bacheca"}
          </button>
        </form>

        {/* ELENCO MISSIONI ATTIVE */}
        <div className="admin-list">
          <h2>Missive Attive ({quests.length})</h2>
          {quests.map(q => (
            <div key={q.id} className="admin-item-row">
              <div className="item-info">
                <strong>{q.title}</strong>
                <span className={`tag ${q.targetCharacter === 'All' ? 'tag-public' : 'tag-private'}`}>
                  {q.targetCharacter === 'All' ? "Pubblica" : `Privata per ${q.targetCharacter}`}
                </span>
              </div>
              <button onClick={() => handleDelete(q.id)} className="delete-btn">Rimuovi</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}