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
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./WorldBossAdmin.css";

export default function WorldBossAdmin() {
  const { currentUser } = useAuth();
  const [bosses, setBosses] = useState([]);
  const [newBoss, setNewBoss] = useState({
    name: "",
    maxHp: "",
    imageUrl: "",
    description: "",
    gradoSfida: "",
    expiryDate: "", // Data e ora di scadenza
    action1: { name: "", damage: "", bonus: "" },
    action2: { name: "", damage: "", bonus: "" },
  });

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [damageAmount, setDamageAmount] = useState(10);

  const MASTER_EMAIL = "santomassimo85@gmail.com";

  // Caricamento Boss in tempo reale
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bosses"), (snap) => {
      const bossList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBosses(bossList);
    });
    return () => unsub();
  }, []);

  // Gestione Posizionamento sulla Mappa
  // Gestione Posizionamento sulla Mappa (CORRETTA E PRECISA)
  const updateBossLocation = async (e, bossId) => {
    // 1. Otteniamo le dimensioni e la posizione esatta dell'immagine cliccata
    const rect = e.currentTarget.getBoundingClientRect();
    
    // 2. Calcoliamo la posizione del click relativa all'angolo in alto a sinistra dell'immagine
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // 3. Convertiamo in percentuale rispetto alla dimensione reale dell'immagine in quel momento
    const xPercent = (offsetX / rect.width) * 100;
    const yPercent = (offsetY / rect.height) * 100;

    try {
      const bossRef = doc(db, "bosses", bossId);
      await updateDoc(bossRef, {
        // Usiamo parseFloat per assicurarci che nel database finisca un NUMERO e non una stringa
        mapX: parseFloat(xPercent.toFixed(2)),
        mapY: parseFloat(yPercent.toFixed(2)),
      });
      console.log(`Ping posizionato a: X ${xPercent.toFixed(2)}% , Y ${yPercent.toFixed(2)}%`);
    } catch (err) {
      console.error("Errore aggiornamento mappa:", err);
    }
  };

  // Creazione Nuovo Boss
  const handleCreateBoss = async (e) => {
    e.preventDefault();
    if (!newBoss.name || !newBoss.maxHp) return;

    try {
      await addDoc(collection(db, "bosses"), {
        ...newBoss,
        hp: parseInt(newBoss.maxHp),
        maxHp: parseInt(newBoss.maxHp),
        isActive: false,
        mapX: 50,
        mapY: 50,
        createdAt: serverTimestamp(),
      });

      // Reset Form
      setNewBoss({
        name: "",
        maxHp: "",
        imageUrl: "",
        description: "",
        gradoSfida: "",
        expiryDate: "",
        action1: { name: "", damage: "", bonus: "" },
        action2: { name: "", damage: "", bonus: "" },
      });
    } catch (err) {
      console.error("Errore creazione boss:", err);
    }
  };

  // Toggle Stato Attivo
  const toggleBossActive = async (id, currentState) => {
    const bossRef = doc(db, "bosses", id);
    await updateDoc(bossRef, { isActive: !currentState });
  };

  // Applicazione Danno al Boss
  const applyDamage = async (id) => {
    const bossRef = doc(db, "bosses", id);
    await updateDoc(bossRef, {
      hp: increment(-damageAmount),
    });
  };

  // Pulizia Chat
  // const clearChat = async () => {
  //   if (window.confirm("Vuoi davvero svuotare tutta la chat del World Boss?")) {
  //     const chatRef = collection(db, "world_boss_chat");
  //     const snap = await getDocs(chatRef);
  //     snap.forEach(async (d) => {
  //       await deleteDoc(doc(db, "world_boss_chat", d.id));
  //     });
  //     alert("Chat svuotata!");
  //   }
  // };

  // Gestione Editing
  const startEdit = (boss) => {
    setEditingId(boss.id);
    setEditData({ ...boss });
  };

  const saveEdit = async (id) => {
    const bossRef = doc(db, "bosses", id);
    await updateDoc(bossRef, {
      ...editData,
      maxHp: parseInt(editData.maxHp),
      hp: parseInt(editData.hp) > parseInt(editData.maxHp) ? parseInt(editData.maxHp) : parseInt(editData.hp)
    });
    setEditingId(null);
  };

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <div className="denied">Accesso Negato. Solo il Master può accedere.</div>;
  }

  return (
    <div className="admin-page">
      {/* <div className="admin-header">
        <h1 className="gold-text">Santuario del Game Master</h1>
        <button onClick={clearChat} className="btn-clear-chat">🗑️ Svuota Chat Battaglia</button>
      </div> */}

      {/* FORM CREAZIONE */}
      <section className="creation-form">
        <h3 className="gold-text">Evoca una Nuova Minaccia</h3>
        <form onSubmit={handleCreateBoss} className="boss-form">
          <input className="admin-input" type="text" placeholder="Nome del Boss" value={newBoss.name} onChange={e => setNewBoss({...newBoss, name: e.target.value})} />
          <input className="admin-input" type="number" placeholder="HP Massimi" value={newBoss.maxHp} onChange={e => setNewBoss({...newBoss, maxHp: e.target.value})} />
          <input className="admin-input" type="text" placeholder="URL Immagine" value={newBoss.imageUrl} onChange={e => setNewBoss({...newBoss, imageUrl: e.target.value})} />
          <input className="admin-input" type="text" placeholder="Grado Sfida (es. 12)" value={newBoss.gradoSfida} onChange={e => setNewBoss({...newBoss, gradoSfida: e.target.value})} />
          
          <div className="datetime-wrapper">
            <label>Scadenza Evento:</label>
            <input className="admin-input" type="datetime-local" value={newBoss.expiryDate} onChange={e => setNewBoss({...newBoss, expiryDate: e.target.value})} />
          </div>

          <div className="actions-setup">
            <input className="admin-input" type="text" placeholder="Azione 1 (Nome)" value={newBoss.action1.name} onChange={e => setNewBoss({...newBoss, action1: {...newBoss.action1, name: e.target.value}})} />
            <input className="admin-input" type="text" placeholder="Danno (es. 2d10+5)" value={newBoss.action1.damage} onChange={e => setNewBoss({...newBoss, action1: {...newBoss.action1, damage: e.target.value}})} />
            <input className="admin-input" type="text" placeholder="Bonus (+)" value={newBoss.action1.bonus} onChange={e => setNewBoss({...newBoss, action1: {...newBoss.action1, bonus: e.target.value}})} />
          </div>

          <textarea className="admin-input full-width" placeholder="Descrizione epica..." value={newBoss.description} onChange={e => setNewBoss({...newBoss, description: e.target.value})} />
          
          <button type="submit" className="admin-button-boss btn-evoke">Inserisci nel Mondo</button>
        </form>
      </section>

      {/* DASHBOARD BOSS ESISTENTI */}
      <div className="admin-dashboard-grid">
        {bosses.map((boss) => (
          <div key={boss.id} className={`boss-card ${boss.isActive ? "active-boss" : ""}`}>
            {editingId === boss.id ? (
              <div className="edit-mode">
                <input className="admin-input" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                <input className="admin-input" type="number" value={editData.maxHp} onChange={e => setEditData({...editData, maxHp: e.target.value})} />
                <input className="admin-input" type="datetime-local" value={editData.expiryDate} onChange={e => setEditData({...editData, expiryDate: e.target.value})} />
                <textarea className="admin-input" value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} />
                <div className="edit-btns">
                  <button onClick={() => saveEdit(boss.id)} className="btn-save">💾 Salva</button>
                  <button onClick={() => setEditingId(null)} className="btn-cancel">❌ Annulla</button>
                </div>
              </div>
            ) : (
              <div className="view-mode">
                <div className="boss-card-header">
                  <h3>{boss.name}</h3>
                  <span className={`status-tag ${boss.isActive ? "on" : "off"}`}>
                    {boss.isActive ? "ATTIVO" : "DORMANTE"}
                  </span>
                </div>

                <p className="expiry-info">⌛ Scadenza: {boss.expiryDate ? boss.expiryDate.replace("T", " ") : "Nessuna"}</p>
                
                <div className="hp-control-admin">
                  <span>HP: {boss.hp} / {boss.maxHp}</span>
                  <div className="damage-tool">
                    <input type="number" value={damageAmount} onChange={(e) => setDamageAmount(parseInt(e.target.value))} className="damage-input" />
                    <button className="admin-button-boss btn-damage" onClick={() => applyDamage(boss.id)}>⚔️ Infliggi</button>
                  </div>
                </div>

                <div className="boss-actions-admin">
                  <button onClick={() => toggleBossActive(boss.id, boss.isActive)} className="btn-toggle">
                    {boss.isActive ? "Rimuovi dalla Mappa" : "Evoca sulla Mappa"}
                  </button>
                  <button onClick={() => startEdit(boss)} className="btn-edit">📝 Modifica</button>
                  <button onClick={() => deleteDoc(doc(db, "bosses", boss.id))} className="btn-delete">✖️ Elimina</button>
                </div>

                <div className="admin-map-preview">
                  <p>Posizione: {boss.mapX}% X, {boss.mapY}% Y (Clicca per spostare)</p>
                  <div className="map-click-area">
                    <img src="/assets/Eldoria.jpg" onClick={(e) => updateBossLocation(e, boss.id)} alt="Mappa Mini" />
                    <div className="boss-ping" style={{ left: `${boss.mapX}%`, top: `${boss.mapY}%` }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}