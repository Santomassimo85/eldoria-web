import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./WorldBossAdmin.css";

export default function WorldBossAdmin() {
  const { currentUser } = useAuth();
  const [bosses, setBosses] = useState([]);
  
  const initialBossState = {
    name: "",
    maxHp: "",
    ac: "",
    rewards: "",
    penalties: "",
    imageUrl: "",
    description: "",
    gradoSfida: "",
    expiryDate: "",
    action1: { name: "", diceNum: 1, diceType: "d6", bonus: 0 },
    action2: { name: "", diceNum: 1, diceType: "d8", bonus: 0 },
  };

  const [newBoss, setNewBoss] = useState(initialBossState);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const MASTER_EMAIL = "santomassimo85@gmail.com";

  useEffect(() => {
    const unsubBoss = onSnapshot(collection(db, "bosses"), (snap) => {
      setBosses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubBoss();
  }, []);

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
      setNewBoss(initialBossState);
    } catch (err) { console.error(err); }
  };

  const startEdit = (boss) => {
    setEditingId(boss.id);
    setEditData({ ...boss });
  };

  const saveEdit = async (id) => {
    const bossRef = doc(db, "bosses", id);
    try {
      await updateDoc(bossRef, {
        ...editData,
        ac: parseInt(editData.ac) || 10,
        maxHp: parseInt(editData.maxHp) || 100,
        // Se gli HP attuali sono superiori ai nuovi Max HP, li resettiamo al massimo
        hp: parseInt(editData.hp) > parseInt(editData.maxHp) ? parseInt(editData.maxHp) : parseInt(editData.hp)
      });
      setEditingId(null);
      alert("Boss aggiornato!");
    } catch (err) { console.error(err); }
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
            <input className="admin-input" type="number" placeholder="CA" value={newBoss.ac} onChange={e => setNewBoss({...newBoss, ac: e.target.value})} />
          </div>

          <div className="actions-setup-admin">
            <div className="dice-config">
              <input type="text" placeholder="Nome Azione 1" value={newBoss.action1.name} onChange={e => setNewBoss({...newBoss, action1: {...newBoss.action1, name: e.target.value}})} />
              <input type="number" placeholder="N. Dadi" value={newBoss.action1.diceNum} onChange={e => setNewBoss({...newBoss, action1: {...newBoss.action1, diceNum: e.target.value}})} />
              <select value={newBoss.action1.diceType} onChange={e => setNewBoss({...newBoss, action1: {...newBoss.action1, diceType: e.target.value}})}>
                {["d4","d6","d8","d10","d12","d20"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="number" placeholder="Bonus" value={newBoss.action1.bonus} onChange={e => setNewBoss({...newBoss, action1: {...newBoss.action1, bonus: e.target.value}})} />
            </div>
            <div className="dice-config">
              <input type="text" placeholder="Nome Azione 2" value={newBoss.action2.name} onChange={e => setNewBoss({...newBoss, action2: {...newBoss.action2, name: e.target.value}})} />
              <input type="number" placeholder="N. Dadi" value={newBoss.action2.diceNum} onChange={e => setNewBoss({...newBoss, action2: {...newBoss.action2, diceNum: e.target.value}})} />
              <select value={newBoss.action2.diceType} onChange={e => setNewBoss({...newBoss, action2: {...newBoss.action2, diceType: e.target.value}})}>
                {["d4","d6","d8","d10","d12","d20"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="number" placeholder="Bonus" value={newBoss.action2.bonus} onChange={e => setNewBoss({...newBoss, action2: {...newBoss.action2, bonus: e.target.value}})} />
            </div>
          </div>

          <textarea className="admin-input full-width" placeholder="Descrizione del Boss..." value={newBoss.description} onChange={e => setNewBoss({...newBoss, description: e.target.value})} />
          
          <div className="form-row">
            <textarea className="admin-input" placeholder="Ricompense..." value={newBoss.rewards} onChange={e => setNewBoss({...newBoss, rewards: e.target.value})} />
            <textarea className="admin-input" placeholder="Penalità..." value={newBoss.penalties} onChange={e => setNewBoss({...newBoss, penalties: e.target.value})} />
          </div>

          <div className="form-row">
            <input className="admin-input" placeholder="URL Immagine" value={newBoss.imageUrl} onChange={e => setNewBoss({...newBoss, imageUrl: e.target.value})} />
            <div className="datetime-wrapper">
              <label>Scadenza Countdown:</label>
              <input className="admin-input" type="datetime-local" value={newBoss.expiryDate} onChange={e => setNewBoss({...newBoss, expiryDate: e.target.value})} />
            </div>
          </div>

          <button type="submit" className="admin-button-boss btn-evoke">Genera Boss</button>
        </form>
      </section>

      <div className="admin-dashboard-grid">
        {bosses.map((boss) => (
          <div key={boss.id} className={`boss-card ${boss.isActive ? "active-boss" : ""}`}>
            {editingId === boss.id ? (
              <div className="edit-mode expanded">
                <h4>Modifica Completa: {editData.name}</h4>
                <div className="edit-grid-mini">
                    <input className="admin-input" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} placeholder="Nome" />
                    <input className="admin-input" type="number" value={editData.ac} onChange={e => setEditData({...editData, ac: e.target.value})} placeholder="CA" />
                    <input className="admin-input" type="number" value={editData.maxHp} onChange={e => setEditData({...editData, maxHp: e.target.value})} placeholder="Max HP" />
                </div>
                
                <input className="admin-input" value={editData.imageUrl} onChange={e => setEditData({...editData, imageUrl: e.target.value})} placeholder="URL Immagine" />
                <input className="admin-input" type="datetime-local" value={editData.expiryDate} onChange={e => setEditData({...editData, expiryDate: e.target.value})} />
                
                <textarea className="admin-input" value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} placeholder="Descrizione" />
                <textarea className="admin-input" value={editData.rewards} onChange={e => setEditData({...editData, rewards: e.target.value})} placeholder="Ricompense" />
                <textarea className="admin-input" value={editData.penalties} onChange={e => setEditData({...editData, penalties: e.target.value})} placeholder="Penalità" />

                <div className="edit-actions-block">
                    <label>Azione 1:</label>
                    <input className="admin-input" value={editData.action1?.name} onChange={e => setEditData({...editData, action1: {...editData.action1, name: e.target.value}})} />
                    <label>Azione 2:</label>
                    <input className="admin-input" value={editData.action2?.name} onChange={e => setEditData({...editData, action2: {...editData.action2, name: e.target.value}})} />
                </div>

                <div className="edit-btns">
                  <button onClick={() => saveEdit(boss.id)} className="btn-save">Salva Tutto</button>
                  <button onClick={() => setEditingId(null)} className="btn-cancel">Annulla</button>
                </div>
              </div>
            ) : (
              <div className="view-mode">
                <div className="boss-card-header">
                    <h3>{boss.name} | 🛡️ CA: {boss.ac}</h3>
                    <span className={`status-tag ${boss.isActive ? "on" : "off"}`}>{boss.isActive ? "ATTIVO" : "OFF"}</span>
                </div>
                
                <div className="admin-map-preview">
                  <div className="map-click-area">
                    <img src="/assets/Exanthia.jpg" onClick={(e) => updateBossLocation(e, boss.id)} alt="Map" />
                    <div className="boss-ping" style={{ left: `${boss.mapX}%`, top: `${boss.mapY}%` }}></div>
                  </div>
                </div>

                <div className="boss-actions-admin">
                  <button onClick={() => updateDoc(doc(db, "bosses", boss.id), { isActive: !boss.isActive })} className="btn-toggle">
                    {boss.isActive ? "Nascondi" : "Mostra"}
                  </button>
                  <button onClick={() => startEdit(boss)} className="btn-edit">📝 Modifica</button>
                  <button onClick={() => deleteDoc(doc(db, "bosses", boss.id))} className="btn-delete">✖️ Elimina</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}