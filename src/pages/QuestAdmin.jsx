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
      const isParty = ["AMEA", "ENOX", "LAC"].includes(formData.targetCharacter);
      
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
    <section className="admin-page quest-admin">
      <Link to="/dm-admin" className="back-button">← Dashboard Master</Link>
      <h1>Gestione Bacheca di Hemile</h1>

      <div className="admin-container">
        <h3>Nuova Missiva</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Titolo della Quest"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
          />

          <input
            type="text"
            placeholder="Mittente (es. Hemile, Un Corvo Ignoto...)"
            value={sender} 
            onChange={(e) => setSender(e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "10px", marginTop: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
            required
          />

          <textarea
            placeholder="Descrizione (Lore e obiettivi)..."
            value={formData.desc}
            onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
            required
            style={{ width: "100%", height: "120px", padding: "10px", borderRadius: "10px", border: "1px solid #ccc" }}
          />

          <div className="form-row">
            <select value={formData.diff} onChange={(e) => setFormData({ ...formData, diff: e.target.value })}>
              <option value="Facile">Facile</option>
              <option value="Media">Media</option>
              <option value="Difficile">Difficile</option>
              <option value="Eroica">Eroica</option>
            </select>
            <input
              placeholder="Zona di Exanthia"
              value={formData.zona}
              onChange={(e) => setFormData({ ...formData, zona: e.target.value })}
              required
            />
          </div>

          {/* <div className="form-row">
            <label>Tipo:</label>
            <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
              <option value="Generale">Generale</option>
              <option value="Mondiale">Mondiale</option>
            </select>

            <label>CR:</label>
            <select value={formData.cr} onChange={(e) => setFormData({...formData, cr: e.target.value})}>
              <option value="1">Livello 1</option>
              <option value="3">Livello 3</option>
              <option value="5">Livello 5</option>
              <option value="10">Livello 10</option>
            </select>
          </div> */}

          <div className="form-section">
            <h3>💰 Ricompense</h3>
            <div className="reward-inputs">
              <input type="number" placeholder="Platino" value={formData.rewardGold} onChange={(e) => setFormData({ ...formData, rewardGold: e.target.value })} />
              <input type="text" placeholder="Oggetto/Loot" value={formData.rewardItem} onChange={(e) => setFormData({ ...formData, rewardItem: e.target.value })} />
            </div>
          </div>

          <div className="form-section">
            <h3>👤 DESTINATARIO (SEGRETEZZA)</h3>
            <select
              value={formData.targetCharacter}
              onChange={(e) => setFormData({ ...formData, targetCharacter: e.target.value })}
              className="target-select"
              style={{ width: "100%", padding: "10px", borderRadius: "5px" }}
            >
              <option value="All">🌐 Pubblica (Visibile a tutti)</option>
              
              <optgroup label="🛡️ Party">
                <option value="AMEA">Solo Party AMEA</option>
                <option value="ENOX">Solo Party ENOX</option>
                <option value="LAC">Solo Party LAC</option>
              </optgroup>

              <optgroup label="👤 Personaggi">
                {characters.map((char) => (
                  <option key={char.id} value={char.charName}>
                    🔒 Solo per {char.charName}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button type="submit" className="admin-button" disabled={loading}>
            {loading ? "Affiggendo..." : "Appendi alla Bacheca"}
          </button>
        </form>

        <div className="admin-list">
          <h2>Missive Attive ({quests.length})</h2>
          {quests.map((q) => (
            <div key={q.id} className="admin-item-row">
              <div className="item-info">
                <strong>{q.title}</strong>
                <small style={{ display: "block" }}>Inviata da: {q.sender}</small>
                <span className={`tag ${q.targetCharacter === "All" && q.targetParty === "All" ? "tag-public" : "tag-private"}`}>
                  {q.targetParty !== "All" ? `Party: ${q.targetParty}` : (q.targetCharacter === "All" ? "Pubblica" : `Privata: ${q.targetCharacter}`)}
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