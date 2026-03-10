import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { 
  collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, increment 
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./WorldBossAdmin.css";
import { getDocs } from "firebase/firestore"; // Importazione necessaria per clearChat

export default function WorldBossAdmin() {
  const { currentUser } = useAuth();
  const [bosses, setBosses] = useState([]);
const [newBoss, setNewBoss] = useState({ name: "", maxHp: "", imageUrl: "", description: "" });  const [damageAmount, setDamageAmount] = useState(10);

  const MASTER_EMAIL = "santomassimo85@gmail.com";


  const clearChat = async () => {
  if (!window.confirm("Sei sicuro di voler cancellare TUTTA la chat del World Boss? L'azione è irreversibile.")) return;

  try {
    const chatRef = collection(db, "world_boss_chat");
    const snapshot = await getDocs(chatRef); // Importa getDocs da firebase/firestore
    
    const deletePromises = snapshot.docs.map(document => deleteDoc(doc(db, "world_boss_chat", document.id)));
    await Promise.all(deletePromises);
    
    alert("Chat pulita con successo!");
  } catch (err) {
    console.error("Errore durante la pulizia della chat:", err);
  }
};


  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bosses"), (snap) => {
      setBosses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return (
      <section className="denied-container">
        <h1 className="denied-text">Accesso Negato</h1>
        <p>Solo il Dungeon Master può evocare creature in questo piano.</p>
      </section>
    );
  }

  // Creazione Boss
const handleCreateBoss = async (e) => {
  e.preventDefault();
  if (!newBoss.name || !newBoss.maxHp) return;
  
  await addDoc(collection(db, "bosses"), {
    name: newBoss.name,
    maxHp: parseInt(newBoss.maxHp),
    hp: parseInt(newBoss.maxHp),
    imageUrl: newBoss.imageUrl,
    description: newBoss.description, 
    isActive: false
  });
  
  setNewBoss({ name: "", maxHp: "", imageUrl: "", description: "" });
};

  // Attivazione/Disattivazione Singola (Checkbox style)
  const toggleBossStatus = async (bossId, currentStatus) => {
    const bossRef = doc(db, "bosses", bossId);
    await updateDoc(bossRef, { isActive: !currentStatus });
  };

  // Applicazione Danno
  const applyDamage = async (bossId) => {
    const bossRef = doc(db, "bosses", bossId);
    await updateDoc(bossRef, {
      hp: increment(-damageAmount)
    });
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1 className="gold-text">Gestione World Boss</h1>
        <p className="admin-subtitle">Pannello di Controllo Divino</p>

        <button onClick={clearChat} className="admin-button btn-clear-chat">
  🗑️ Svuota Chat World Boss
</button>
      </header>

      {/* FORM CREAZIONE */}
      <section className="admin-section creation-form">
        <h3>Evoca un Nuovo Boss</h3>
        <form onSubmit={handleCreateBoss} className="boss-form">
          <input 
            type="text" 
            placeholder="Nome Boss" 
            value={newBoss.name} 
            onChange={e => setNewBoss({...newBoss, name: e.target.value})} 
            className="admin-input" 
          />
          <textarea 
  placeholder="Descrizione narrativa del Boss..." 
  value={newBoss.description} 
  onChange={e => setNewBoss({...newBoss, description: e.target.value})} 
  className="admin-input"
  style={{ minHeight: '80px', width: '100%' }}
/>
          <input 
            type="number" 
            placeholder="HP Max" 
            value={newBoss.maxHp} 
            onChange={e => setNewBoss({...newBoss, maxHp: e.target.value})} 
            className="admin-input" 
          />
          <input 
            type="text" 
            placeholder="URL Immagine" 
            value={newBoss.imageUrl} 
            onChange={e => setNewBoss({...newBoss, imageUrl: e.target.value})} 
            className="admin-input" 
          />
          <button type="submit" className="admin-button btn-evoke">Evoca Boss</button>
        </form>
      </section>

      {/* LISTA BOSS */}
      <div className="admin-dashboard-grid">
        {bosses.map(boss => (
          <div key={boss.id} className={`admin-block boss-card ${boss.isActive ? 'active-boss' : ''}`}>
            <div className="boss-card-header">
              <h2 className="boss-title">{boss.name}</h2>
              {boss.isActive && <span className="active-tag">ATTIVO</span>}
            </div>
            
            <p className="boss-hp-text">HP: <strong>{boss.hp}</strong> / {boss.maxHp}</p>
            
            <div className="admin-actions-container">
              <div className="admin-action-row">
                {/* CHECKBOX PER ATTIVAZIONE */}
                <label className="toggle-container">
                  <input 
                    type="checkbox" 
                    checked={boss.isActive} 
                    onChange={() => toggleBossStatus(boss.id, boss.isActive)} 
                  />
                  <span className="toggle-label">Attivo nel Mondo</span>
                </label>
                
                {/* CONTROLLO DANNO */}
                <div className="damage-control">
                  <input 
                    type="number" 
                    value={damageAmount} 
                    onChange={e => setDamageAmount(parseInt(e.target.value) || 0)} 
                    className="damage-input"
                  />
                  <button onClick={() => applyDamage(boss.id)} className="admin-button btn-damage">
                    Infiggi Danno
                  </button>
                </div>
              </div>

              {/* ELIMINA */}
              <button 
                onClick={() => deleteDoc(doc(db, "bosses", boss.id))} 
                className="admin-button btn-delete"
              >
                Elimina Definitivamente
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}