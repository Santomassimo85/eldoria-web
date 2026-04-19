import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import "./admin.css";

export default function QuestAdmin() {
  const [quests, setQuests] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sender, setSender] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    desc: "",
    diff: "Media",
    type: "Generale", 
    cr: "1", 
    zona: "",
    rewardGold: 0,
    rewardItem: "",
    rewardOther: "",
    targetCharacter: "All", // Gestirà sia "All", che i nomi dei PG, che i nomi dei Party
  });

  const fetchData = async () => {
    try {
      const questSnap = await getDocs(collection(db, "quests"));
      setQuests(questSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const charSnap = await getDocs(collection(db, "characters"));
      setCharacters(charSnap.docs.map((d) => ({
        id: d.id,
        charName: d.data().name || "Eroe Senza Nome",
      })));
    } catch (error) {
      console.error("Errore nel caricamento dati:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Logica per distinguere se il destinatario è un Party o un PG
      const isParty = ["AMEA", "ENOX", "LAC", "LEAF"].includes(formData.targetCharacter);
      
      await addDoc(collection(db, "quests"), {
        ...formData,
        sender: sender,
        targetParty: isParty ? formData.targetCharacter : "All",
        targetCharacter: isParty ? "All" : formData.targetCharacter,
        rewardGold: Number(formData.rewardGold),
        createdAt: new Date().toISOString(),
      });

      setFormData({
        title: "",
        desc: "",
        diff: "Media",
        type: "Generale",
        cr: "1",
        zona: "",
        rewardGold: 0,
        rewardItem: "",
        rewardOther: "",
        targetCharacter: "All",
      });
      setSender("");
      fetchData();
      alert("La pergamena è stata sigillata e appesa!");
    } catch (error) {
      console.error("Errore salvataggio:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Vuoi davvero strappare questa missione dalla bacheca?")) {
      await deleteDoc(doc(db, "quests", id));
      fetchData();
    }
  };

  return (
    <section className="admin-quest-page">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard Master</Link>

      <h1 className="admin-page-title">Bacheca di Hemile</h1>
      <div className="admin-divider"><span className="admin-divider-icon">📜</span></div>

      {/* Form nuova missione */}
      <div className="admin-card">
        <h2 className="admin-section-title">Nuova Missiva</h2>
        <form onSubmit={handleSubmit} className="admin-form-grid">
          <div>
            <label>Titolo della Quest</label>
            <input className="admin-field-input" type="text" placeholder="Titolo della Quest" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
          </div>
          <div>
            <label>Mittente</label>
            <input className="admin-field-input" type="text" placeholder="es. Hemile, Un Corvo Ignoto..." value={sender} onChange={(e) => setSender(e.target.value)} required />
          </div>
          <div>
            <label>Descrizione (Lore e obiettivi)</label>
            <textarea className="admin-field-textarea" placeholder="Descrizione..." value={formData.desc} onChange={(e) => setFormData({ ...formData, desc: e.target.value })} required rows="4" />
          </div>
          <div className="admin-form-row">
            <div>
              <label>Difficoltà</label>
              <select className="admin-field-select" value={formData.diff} onChange={(e) => setFormData({ ...formData, diff: e.target.value })}>
                <option value="Facile">Facile</option>
                <option value="Media">Media</option>
                <option value="Difficile">Difficile</option>
                <option value="Eroica">Eroica</option>
              </select>
            </div>
            <div>
              <label>Zona di Exanthia</label>
              <input className="admin-field-input" placeholder="Zona..." value={formData.zona} onChange={(e) => setFormData({ ...formData, zona: e.target.value })} required />
            </div>
          </div>
          <div className="admin-form-row">
            <div>
              <label>Ricompensa Platino</label>
              <input className="admin-field-input" type="number" placeholder="0" value={formData.rewardGold} onChange={(e) => setFormData({ ...formData, rewardGold: e.target.value })} />
            </div>
            <div>
              <label>Oggetto / Loot</label>
              <input className="admin-field-input" type="text" placeholder="Oggetto/Loot" value={formData.rewardItem} onChange={(e) => setFormData({ ...formData, rewardItem: e.target.value })} />
            </div>
          </div>
          <div>
            <label>Destinatario (Segretezza)</label>
            <select className="admin-field-select" value={formData.targetCharacter} onChange={(e) => setFormData({ ...formData, targetCharacter: e.target.value })}>
              <option value="All">Pubblica (Visibile a tutti)</option>
              <optgroup label="Party">
                <option value="AMEA">Solo Party AMEA</option>
                <option value="ENOX">Solo Party ENOX</option>
                <option value="LAC">Solo Party LAC</option>
                <option value="LEAF">Solo Party LEAF</option>
              </optgroup>
              <optgroup label="Personaggi">
                {characters.map((char) => (
                  <option key={char.id} value={char.charName}>Solo per {char.charName}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="btn-admin-actions">
            <button type="submit" className="btn-admin-primary" disabled={loading}>
              {loading ? "Affiggendo..." : "Appendi alla Bacheca"}
            </button>
          </div>
        </form>
      </div>

      {/* Lista missioni attive */}
      <div className="admin-item-list-card">
        <div style={{ padding: "0 18px" }}>
          <h2 className="admin-section-title" style={{ marginTop: 18, marginBottom: 0 }}>
            Missive Attive ({quests.length})
          </h2>
        </div>
        {quests.map((q) => (
          <div key={q.id} className="admin-item-entry">
            <div className="admin-item-entry-label">
              <strong>{q.title}</strong>
              <div className="admin-item-entry-meta">
                Da: {q.sender} —{" "}
                {q.targetParty !== "All"
                  ? `Party: ${q.targetParty}`
                  : q.targetCharacter === "All"
                    ? "Pubblica"
                    : `Privata: ${q.targetCharacter}`}
              </div>
            </div>
            <div className="admin-item-entry-actions">
              <button onClick={() => handleDelete(q.id)} className="btn-admin-danger">Rimuovi</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}