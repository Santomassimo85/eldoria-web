import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  increment,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./WorldBossAdmin.css";
import { getDocs } from "firebase/firestore"; // Importazione necessaria per clearChat

export default function WorldBossAdmin() {
  const { currentUser } = useAuth();
  const [bosses, setBosses] = useState([]);
  const [newBoss, setNewBoss] = useState({
    name: "",
    maxHp: "",
    imageUrl: "",
    description: "",
    gradoSfida: "",
  });

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const updateBossLocation = async (e, bossId) => {
    // Calcola la posizione del click relativa all'immagine
    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    try {
      const bossRef = doc(db, "bosses", bossId);
      await updateDoc(bossRef, {
        mapX: x.toFixed(2),
        mapY: y.toFixed(2),
      });
      console.log("Posizione aggiornata!");
    } catch (err) {
      console.error("Errore aggiornamento mappa:", err);
    }
  };

  const [damageAmount, setDamageAmount] = useState(10);

  const MASTER_EMAIL = "santomassimo85@gmail.com";

  const clearChat = async () => {
    if (
      !window.confirm(
        "Sei sicuro di voler cancellare TUTTA la chat del World Boss? L'azione è irreversibile.",
      )
    )
      return;

    try {
      const chatRef = collection(db, "world_boss_chat");
      const snapshot = await getDocs(chatRef); // Importa getDocs da firebase/firestore

      const deletePromises = snapshot.docs.map((document) =>
        deleteDoc(doc(db, "world_boss_chat", document.id)),
      );
      await Promise.all(deletePromises);

      alert("Chat pulita con successo!");
    } catch (err) {
      console.error("Errore durante la pulizia della chat:", err);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bosses"), (snap) => {
      setBosses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      mapX: 50,
      mapY: 50,
      isActive: false,
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
      hp: increment(-damageAmount),
    });
  };

  const handleUpdateBoss = async (bossId) => {
    try {
      const bossRef = doc(db, "bosses", bossId);
      await updateDoc(bossRef, {
        name: editData.name,
        description: editData.description,
        gradoSfida: editData.gradoSfida,
        maxHp: parseInt(editData.maxHp),
        imageUrl: editData.imageUrl,
      });
      setEditingId(null); // Chiude la modalità edit
      console.log("Boss aggiornato!");
    } catch (err) {
      console.error("Errore aggiornamento:", err);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1 className="gold-text">Gestione World Boss</h1>
        <p className="admin-subtitle">Pannello di Controllo Divino</p>

        <button
          onClick={clearChat}
          className="admin-button-boss btn-clear-chat"
        >
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
            onChange={(e) => setNewBoss({ ...newBoss, name: e.target.value })}
            className="admin-input"
          />
          <textarea
            placeholder="Descrizione narrativa del Boss..."
            value={newBoss.description}
            onChange={(e) =>
              setNewBoss({ ...newBoss, description: e.target.value })
            }
            className="admin-input"
            style={{ minHeight: "80px", width: "100%" }}
          />
          <input
            type="text"
            placeholder="Grado Sfida (es. Grado 5)"
            value={newBoss.gradoSfida}
            onChange={(e) =>
              setNewBoss({ ...newBoss, gradoSfida: e.target.value })
            }
            className="admin-input"
          />

          <input
            type="number"
            placeholder="HP Max"
            value={newBoss.maxHp}
            onChange={(e) => setNewBoss({ ...newBoss, maxHp: e.target.value })}
            className="admin-input"
          />
          <input
            type="text"
            placeholder="URL Immagine"
            value={newBoss.imageUrl}
            onChange={(e) =>
              setNewBoss({ ...newBoss, imageUrl: e.target.value })
            }
            className="admin-input"
          />
          <button type="submit" className="admin-button-boss btn-evoke">
            Evoca Boss
          </button>
        </form>
      </section>

      {/* LISTA BOSS */}
      <div className="admin-dashboard-grid">
  {bosses.map((boss) => (
    <div
      key={boss.id}
      className={`boss-card ${boss.isActive ? "active-boss" : ""}`}
    >
      {editingId === boss.id ? (
        /* --- MODALITÀ MODIFICA (EDIT MODE) --- */
        <div className="edit-mode-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input 
            className="admin-input" 
            value={editData.name} 
            onChange={e => setEditData({...editData, name: e.target.value})} 
            placeholder="Nome Boss"
          />
          <input 
            className="admin-input" 
            value={editData.gradoSfida} 
            onChange={e => setEditData({...editData, gradoSfida: e.target.value})} 
            placeholder="Grado Sfida"
          />
          <textarea 
            className="admin-input" 
            value={editData.description} 
            onChange={e => setEditData({...editData, description: e.target.value})} 
            placeholder="Descrizione"
            style={{ minHeight: '60px' }}
          />
          <div style={{ display: 'flex', gap: '5px' }}>
            <input 
              type="number" 
              className="admin-input" 
              value={editData.maxHp} 
              onChange={e => setEditData({...editData, maxHp: e.target.value})} 
              placeholder="Max HP"
            />
            <input 
              className="admin-input" 
              value={editData.imageUrl} 
              onChange={e => setEditData({...editData, imageUrl: e.target.value})} 
              placeholder="URL Immagine"
            />
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button className="admin-button-boss" onClick={() => handleUpdateBoss(boss.id)} style={{ background: '#27ae60', color: 'white', flex: 1 }}>💾 Salva</button>
            <button className="admin-button-boss" onClick={() => setEditingId(null)} style={{ background: '#7f8c8d', color: 'white', flex: 1 }}>❌ Annulla</button>
          </div>
        </div>
      ) : (
        /* --- MODALITÀ LETTURA (VIEW MODE - ORIGINALE) --- */
        <>
          <div className="boss-card-header">
            <h2 className="boss-title">{boss.name}</h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                onClick={() => { setEditingId(boss.id); setEditData(boss); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                📝
              </button>
              {boss.isActive && <span className="active-tag">ATTIVO</span>}
            </div>
          </div>

          <p style={{ fontSize: '0.85rem', color: '#ccc', fontStyle: 'italic', margin: '5px 0' }}>
            {boss.description || "Nessuna descrizione"}
          </p>

          <p className="boss-hp-text">
            HP: <strong>{boss.hp}</strong> / {boss.maxHp} <span style={{fontSize: '0.8rem', color: 'var(--gold)'}}>({boss.gradoSfida})</span>
          </p>

          <div className="admin-actions-container">
            <div className="admin-action-row">
              <label className="toggle-container">
                <input
                  type="checkbox"
                  checked={boss.isActive}
                  onChange={() => toggleBossStatus(boss.id, boss.isActive)}
                />
                <span className="toggle-label">✅ Attiva nel Mondo</span>
              </label>

              <div className="damage-control">
                <input
                  type="number"
                  value={damageAmount}
                  onChange={(e) => setDamageAmount(parseInt(e.target.value) || 0)}
                  className="damage-input"
                />
                <button
                  className="admin-button-boss btn-damage"
                  onClick={() => applyDamage(boss.id)}
                >
                  ⚔️
                </button>
                <button
                  onClick={() => deleteDoc(doc(db, "bosses", boss.id))}
                  className="admin-button-boss btn-delete"
                >
                  ✖️
                </button>
              </div>

              <div className="admin-map-preview">
                <p>Clicca sulla mappa per posizionare {boss.name}</p>
                <div style={{ position: "relative" }}>
                  <img
                    src="/assets/Eldoria_Map.jpg"
                    onClick={(e) => updateBossLocation(e, boss.id)}
                    style={{ width: "100%", cursor: "crosshair", borderRadius: '4px' }}
                  />
                  <div
                    className="boss-ping"
                    style={{ 
                      left: `${boss.mapX}%`, 
                      top: `${boss.mapY}%`,
                      transform: 'translate(-50%, -50%)' 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  ))}
</div>
    </div>
  );
}
