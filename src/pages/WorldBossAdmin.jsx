import React, { useState, useEffect, useRef } from "react";
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
import { Link } from "react-router-dom";
import "./admin.css";
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
    deadImageUrl: "",
    description: "",
    gradoSfida: "",
    expiryDate: "",
    action1: { name: "", diceNum: 1, diceType: "d6", bonus: 0 },
    action2: { name: "", diceNum: 1, diceType: "d8", bonus: 0 },
  };

  const [newBoss, setNewBoss] = useState(initialBossState);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const newFileRef    = useRef(null);
  const newDeadRef    = useRef(null);
  const editFileRef   = useRef(null);
  const editDeadRef   = useRef(null);

  const loadSprite = (file, onBase64) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 512;
        const scale = img.width > MAX ? MAX / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onBase64(canvas.toDataURL("image/png"));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

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
    } catch (err) {
      console.error(err);
    }
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
        hp:
          parseInt(editData.hp) > parseInt(editData.maxHp)
            ? parseInt(editData.maxHp)
            : parseInt(editData.hp),
      });
      setEditingId(null);
      alert("Boss aggiornato!");
    } catch (err) {
      console.error(err);
    }
  };

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <div className="denied">Accesso Negato.</div>;
  }

  return (
    <div className="wb-admin-page">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard Admin</Link>

      <h1 className="admin-page-title">Gestione World Boss</h1>
      <div className="admin-divider"><span className="admin-divider-icon">⚔️</span></div>

      {/* FORM CREAZIONE */}
      <div className="admin-card">
        <h2 className="admin-section-title">Configura Nuova Minaccia</h2>
        <form onSubmit={handleCreateBoss} className="boss-form">

          <div className="boss-form-row">
            <div>
              <label>Nome Boss</label>
              <input
                className="admin-field-input"
                placeholder="es. Il Divoratore delle Anime"
                value={newBoss.name}
                onChange={(e) => setNewBoss({ ...newBoss, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label>HP Massimi</label>
              <input
                className="admin-field-input"
                type="number"
                placeholder="es. 500"
                value={newBoss.maxHp}
                onChange={(e) => setNewBoss({ ...newBoss, maxHp: e.target.value })}
                required
              />
            </div>
            <div>
              <label>CA (Classe Armatura)</label>
              <input
                className="admin-field-input"
                type="number"
                placeholder="es. 18"
                value={newBoss.ac}
                onChange={(e) => setNewBoss({ ...newBoss, ac: e.target.value })}
              />
            </div>
          </div>

          <div className="boss-actions-setup">
            <div className="boss-action-block">
              <label>Azione 1 — Nome</label>
              <input
                className="admin-field-input"
                placeholder="es. Artiglio del Vuoto"
                value={newBoss.action1.name}
                onChange={(e) => setNewBoss({ ...newBoss, action1: { ...newBoss.action1, name: e.target.value } })}
              />
              <div className="boss-dice-row">
                <input
                  className="admin-field-input"
                  type="number"
                  placeholder="N. dadi"
                  value={newBoss.action1.diceNum}
                  onChange={(e) => setNewBoss({ ...newBoss, action1: { ...newBoss.action1, diceNum: e.target.value } })}
                />
                <select
                  className="admin-field-input"
                  value={newBoss.action1.diceType}
                  onChange={(e) => setNewBoss({ ...newBoss, action1: { ...newBoss.action1, diceType: e.target.value } })}
                >
                  {["d4","d6","d8","d10","d12","d20"].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <input
                  className="admin-field-input"
                  type="number"
                  placeholder="Bonus"
                  value={newBoss.action1.bonus}
                  onChange={(e) => setNewBoss({ ...newBoss, action1: { ...newBoss.action1, bonus: e.target.value } })}
                />
              </div>
            </div>

            <div className="boss-action-block">
              <label>Azione 2 — Nome</label>
              <input
                className="admin-field-input"
                placeholder="es. Grido della Fine"
                value={newBoss.action2.name}
                onChange={(e) => setNewBoss({ ...newBoss, action2: { ...newBoss.action2, name: e.target.value } })}
              />
              <div className="boss-dice-row">
                <input
                  className="admin-field-input"
                  type="number"
                  placeholder="N. dadi"
                  value={newBoss.action2.diceNum}
                  onChange={(e) => setNewBoss({ ...newBoss, action2: { ...newBoss.action2, diceNum: e.target.value } })}
                />
                <select
                  className="admin-field-input"
                  value={newBoss.action2.diceType}
                  onChange={(e) => setNewBoss({ ...newBoss, action2: { ...newBoss.action2, diceType: e.target.value } })}
                >
                  {["d4","d6","d8","d10","d12","d20"].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <input
                  className="admin-field-input"
                  type="number"
                  placeholder="Bonus"
                  value={newBoss.action2.bonus}
                  onChange={(e) => setNewBoss({ ...newBoss, action2: { ...newBoss.action2, bonus: e.target.value } })}
                />
              </div>
            </div>
          </div>

          <div>
            <label>Descrizione</label>
            <textarea
              className="admin-field-textarea"
              placeholder="Descrizione narrativa del boss..."
              value={newBoss.description}
              onChange={(e) => setNewBoss({ ...newBoss, description: e.target.value })}
              rows="3"
            />
          </div>

          <div className="boss-form-row">
            <div>
              <label>Ricompense (vittoria)</label>
              <textarea
                className="admin-field-textarea"
                placeholder="Oro, oggetti, XP..."
                value={newBoss.rewards}
                onChange={(e) => setNewBoss({ ...newBoss, rewards: e.target.value })}
                rows="2"
              />
            </div>
            <div>
              <label>Penalità (sconfitta)</label>
              <textarea
                className="admin-field-textarea"
                placeholder="Conseguenze per i player..."
                value={newBoss.penalties}
                onChange={(e) => setNewBoss({ ...newBoss, penalties: e.target.value })}
                rows="2"
              />
            </div>
          </div>

          <div className="boss-form-row">
            <div>
              <label>Sprite Boss</label>
              <div className="boss-sprite-upload" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>Sprite Vivo</span>
                  {newBoss.imageUrl && <img src={newBoss.imageUrl} alt="preview" className="boss-sprite-preview" />}
                  <input ref={newFileRef} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={e => loadSprite(e.target.files[0], b64 => setNewBoss(b => ({ ...b, imageUrl: b64 })))} />
                  <button type="button" className="btn-admin-secondary" onClick={() => newFileRef.current?.click()}>
                    📁 Sprite Vivo
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>Sprite Morto</span>
                  {newBoss.deadImageUrl && <img src={newBoss.deadImageUrl} alt="dead preview" className="boss-sprite-preview" style={{ filter: "grayscale(0.6)" }} />}
                  <input ref={newDeadRef} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={e => loadSprite(e.target.files[0], b64 => setNewBoss(b => ({ ...b, deadImageUrl: b64 })))} />
                  <button type="button" className="btn-admin-secondary" onClick={() => newDeadRef.current?.click()}>
                    💀 Sprite Morto
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label>Scadenza Evento</label>
              <input
                className="admin-field-input"
                type="datetime-local"
                value={newBoss.expiryDate}
                onChange={(e) => setNewBoss({ ...newBoss, expiryDate: e.target.value })}
              />
            </div>
          </div>

          <div className="btn-admin-actions">
            <button type="submit" className="btn-admin-primary">
              ⚡ Genera Boss
            </button>
          </div>
        </form>
      </div>

      {/* LISTA BOSS */}
      <div className="admin-dashboard-grid wb-boss-grid">
        {bosses.map((boss) => (
          <div key={boss.id} className={`boss-card ${boss.isActive ? "active-boss" : ""}`}>
            {editingId === boss.id ? (
              <div className="edit-mode expanded">
                <h4>Modifica: {editData.name}</h4>
                <div className="edit-grid-mini">
                  <div>
                    <label>Nome</label>
                    <input className="admin-field-input" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                  </div>
                  <div>
                    <label>CA</label>
                    <input className="admin-field-input" type="number" value={editData.ac} onChange={(e) => setEditData({ ...editData, ac: e.target.value })} />
                  </div>
                  <div>
                    <label>Max HP</label>
                    <input className="admin-field-input" type="number" value={editData.maxHp} onChange={(e) => setEditData({ ...editData, maxHp: e.target.value })} />
                  </div>
                  <div>
                    <label>HP Correnti</label>
                    <input className="admin-field-input" type="number" value={editData.hp} onChange={(e) => setEditData({ ...editData, hp: e.target.value })} />
                  </div>
                </div>

                <label>Sprite Boss</label>
                <div className="boss-sprite-upload" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, opacity: 0.6 }}>Sprite Vivo</span>
                    {editData.imageUrl && <img src={editData.imageUrl} alt="preview" className="boss-sprite-preview" />}
                    <input ref={editFileRef} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => loadSprite(e.target.files[0], b64 => setEditData(d => ({ ...d, imageUrl: b64 })))} />
                    <button type="button" className="btn-admin-secondary" onClick={() => editFileRef.current?.click()}>
                      📁 Sprite Vivo
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, opacity: 0.6 }}>Sprite Morto</span>
                    {editData.deadImageUrl && <img src={editData.deadImageUrl} alt="dead preview" className="boss-sprite-preview" style={{ filter: "grayscale(0.6)" }} />}
                    <input ref={editDeadRef} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => loadSprite(e.target.files[0], b64 => setEditData(d => ({ ...d, deadImageUrl: b64 })))} />
                    <button type="button" className="btn-admin-secondary" onClick={() => editDeadRef.current?.click()}>
                      💀 Sprite Morto
                    </button>
                  </div>
                </div>

                <label>Scadenza Evento</label>
                <input className="admin-field-input" type="datetime-local" value={editData.expiryDate || ""} onChange={(e) => setEditData({ ...editData, expiryDate: e.target.value })} />

                <label>Descrizione</label>
                <textarea className="admin-field-textarea" value={editData.description || ""} onChange={(e) => setEditData({ ...editData, description: e.target.value })} rows="2" />

                <label>Ricompense</label>
                <textarea className="admin-field-textarea" value={editData.rewards || ""} onChange={(e) => setEditData({ ...editData, rewards: e.target.value })} rows="2" />

                <label>Penalità</label>
                <textarea className="admin-field-textarea" value={editData.penalties || ""} onChange={(e) => setEditData({ ...editData, penalties: e.target.value })} rows="2" />

                <div className="edit-actions-block">
                  <label>Azione 1</label>
                  <input className="admin-field-input" value={editData.action1?.name || ""} onChange={(e) => setEditData({ ...editData, action1: { ...editData.action1, name: e.target.value } })} />
                  <label>Azione 2</label>
                  <input className="admin-field-input" value={editData.action2?.name || ""} onChange={(e) => setEditData({ ...editData, action2: { ...editData.action2, name: e.target.value } })} />
                </div>

                <div className="edit-btns">
                  <button onClick={() => saveEdit(boss.id)} className="btn-admin-save">Salva</button>
                  <button onClick={() => setEditingId(null)} className="btn-admin-secondary">Annulla</button>
                </div>
              </div>
            ) : (
              <div className="view-mode">
                <div className="boss-card-header">
                  <h3>{boss.name} <small>CA {boss.ac}</small></h3>
                  <span className={`status-tag ${boss.isActive ? "on" : "off"}`}>
                    {boss.isActive ? "ATTIVO" : "NASCOSTO"}
                  </span>
                </div>

                {boss.isActive && (
                  <div className="expiry-info">
                    HP: {boss.hp} / {boss.maxHp}
                  </div>
                )}

                <div className="admin-map-preview">
                  <div className="map-click-area" onClick={(e) => updateBossLocation(e, boss.id)}>
                    <img src="/assets/Exanthia.jpg" alt="Map" />
                    <div className="boss-ping" style={{ left: `${boss.mapX}%`, top: `${boss.mapY}%` }} />
                  </div>
                </div>

                <div className="boss-actions-admin">
                  <button
                    onClick={() => updateDoc(doc(db, "bosses", boss.id), { isActive: !boss.isActive })}
                    className="btn-toggle"
                  >
                    {boss.isActive ? "Nascondi" : "Mostra"}
                  </button>
                  <button onClick={() => startEdit(boss)} className="btn-edit">📝 Modifica</button>
                  <button onClick={() => deleteDoc(doc(db, "bosses", boss.id))} className="btn-delete btn-admin-danger">✖ Elimina</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
