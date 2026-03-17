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
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./WorldBossAdmin.css";

export default function WorldBossAdmin() {
  const { currentUser } = useAuth();
  const [bosses, setBosses] = useState([]);
  // const [players, setPlayers] = useState([]); // Lista player per selezione target
  // const [selectedPlayers, setSelectedPlayers] = useState([]); // Array di UID selezionati
  
  const [newBoss, setNewBoss] = useState({
    name: "",
    maxHp: "",
    ac: "", // Classe Armatura
    rewards: "",
    imageUrl: "",
    description: "",
    gradoSfida: "",
    expiryDate: "",
    action1: { name: "", diceNum: 1, diceType: "d6", bonus: 0 },
    action2: { name: "", diceNum: 1, diceType: "d8", bonus: 0 },
  });

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  // const [damageAmount, setDamageAmount] = useState(10);

  const MASTER_EMAIL = "santomassimo85@gmail.com";

  // Caricamento Boss e Player in tempo reale
  useEffect(() => {
    const unsubBoss = onSnapshot(collection(db, "bosses"), (snap) => {
      setBosses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubPlayers = onSnapshot(collection(db, "characters"), (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubBoss(); unsubPlayers(); };
  }, []);

  // --- LOGICA LANCO DADI BOSS ---
  

 

  const updateBossLocation = async (e, bossId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    await updateDoc(doc(db, "bosses", bossId), {
      mapX: parseFloat(xPercent.toFixed(2)),
      mapY: parseFloat(yPercent.toFixed(2)),
    });
    
  };

  const handleCreateBoss = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "bosses"), {
        ...newBoss,
        ac: parseInt(newBoss.ac) || 10,
        hp: parseInt(newBoss.maxHp),
        maxHp: parseInt(newBoss.maxHp),
        isActive: false,
        mapX: 50,
        mapY: 50,
        createdAt: serverTimestamp(),
      });
      alert("Boss Creato!");
    } catch (err) { console.error(err); }
  };

  const startEdit = (boss) => {
    setEditingId(boss.id);
    setEditData({ ...boss });
  };

  const saveEdit = async (id) => {
    const bossRef = doc(db, "bosses", id);
    await updateDoc(bossRef, {
      ...editData,
      ac: parseInt(editData.ac) || 10,
      maxHp: parseInt(editData.maxHp) || 100,
      hp: parseInt(editData.hp)
    });
    setEditingId(null);
  };

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <div className="denied">Accesso Negato.</div>;
  }

  return (
    <div className="admin-page">
      <section className="creation-form">
        <h3 className="gold-text">Configura Nuova Minaccia</h3>
        <form onSubmit={handleCreateBoss} className="boss-form">
          <div className="form-row">
            <input className="admin-input" placeholder="Nome" value={newBoss.name} onChange={e => setNewBoss({...newBoss, name: e.target.value})} />
            <input className="admin-input" type="number" placeholder="HP Max" value={newBoss.maxHp} onChange={e => setNewBoss({...newBoss, maxHp: e.target.value})} />
            <input className="admin-input" type="number" placeholder="CA (Classe Armatura)" value={newBoss.ac} onChange={e => setNewBoss({...newBoss, ac: e.target.value})} />
          </div>

          <div className="actions-setup-admin">
            <h4>Azione 1: {newBoss.action1.name || "Senza Nome"}</h4>
            <div className="dice-config">
              <input type="text" placeholder="Nome Skill" onChange={e => setNewBoss({...newBoss, action1: {...newBoss.action1, name: e.target.value}})} />
              <input type="number" placeholder="N. Dadi" onChange={e => setNewBoss({...newBoss, action1: {...newBoss.action1, diceNum: e.target.value}})} />
              <select onChange={e => setNewBoss({...newBoss, action1: {...newBoss.action1, diceType: e.target.value}})}>
                <option value="d4">d4</option><option value="d6">d6</option><option value="d8">d8</option><option value="d10">d10</option><option value="d12">d12</option>
              </select>
              <input type="number" placeholder="Bonus +" onChange={e => setNewBoss({...newBoss, action1: {...newBoss.action1, bonus: e.target.value}})} />
            </div>
          </div>
          
          <textarea className="admin-input" placeholder="Ricompense..." value={newBoss.rewards} onChange={e => setNewBoss({...newBoss, rewards: e.target.value})} />
          <input className="admin-input" placeholder="URL Immagine" value={newBoss.imageUrl} onChange={e => setNewBoss({...newBoss, imageUrl: e.target.value})} />
          <button type="submit" className="admin-button-boss btn-evoke">Genera Boss</button>
        </form>
      </section>

      <div className="admin-dashboard-grid">
        {bosses.map((boss) => (
          <div key={boss.id} className="boss-card">
            {editingId === boss.id ? (
              <div className="edit-mode expanded">
                <input className="admin-input" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                <input className="admin-input" type="number" value={editData.ac} onChange={e => setEditData({...editData, ac: e.target.value})} placeholder="CA" />
                <textarea className="admin-input" value={editData.rewards} onChange={e => setEditData({...editData, rewards: e.target.value})} />
                <div className="edit-btns">
                  <button onClick={() => saveEdit(boss.id)} className="btn-save">Salva</button>
                  <button onClick={() => setEditingId(null)} className="btn-cancel">Annulla</button>
                </div>
              </div>
            ) : (
              <div className="view-mode">
                <h3>{boss.name} | 🛡️ CA: {boss.ac}</h3>
              

                

                <div className="admin-map-preview">
                  <div className="map-click-area">
                    <img src="/assets/Eldoria.jpg" onClick={(e) => updateBossLocation(e, boss.id)} alt="Map" />
                    <div className="boss-ping" style={{ left: `${boss.mapX}%`, top: `${boss.mapY}%` }}></div>
                  </div>
                </div>

                <div className="boss-actions-admin">
                  <button onClick={() => updateDoc(doc(db, "bosses", boss.id), { isActive: !boss.isActive })} className="btn-toggle">
                    {boss.isActive ? "Nascondi" : "Mostra"}
                  </button>
                  <button onClick={() => startEdit(boss)} className="btn-edit">📝</button>
                  <button onClick={() => deleteDoc(doc(db, "bosses", boss.id))} className="btn-delete">✖️</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}