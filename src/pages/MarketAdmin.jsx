import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, doc, setDoc, deleteDoc, updateDoc, getDoc, onSnapshot } from "firebase/firestore";
import HtmlToolbar from "../components/HtmlToolbar";
import { createMarketItem } from "../utils/itemTemplates";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const RARITIES = ["Comune", "Raro", "Magico", "Epico", "Leggendario"];
const ITEM_TYPES = ["Arma", "Armatura", "Accessori", "Artefatto Magico", "Pozioni", "Pergamene", "Reagenti", "Varie"];

const initialFormData = {
  name: "", type: "Arma", class: "Comune", saleType: "fixed",
  price: "", startingBid: "", endDate: "", description: "", img: "", minLevel: 0,
};

export default function MarketAdmin() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [globalCountdown, setGlobalCountdown] = useState("");
  const descRef = useRef(null);

  useEffect(() => {
    if (!currentUser || currentUser.email !== MASTER_EMAIL) return;
    const unsubConfig = onSnapshot(doc(db, "settings", "market_config"), (snap) => {
      if (snap.exists()) setGlobalCountdown(snap.data().nextOpening || "");
    });
    const unsubItems = onSnapshot(collection(db, "items"), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubConfig(); unsubItems(); };
  }, [currentUser]);

  const handleUpdateCountdown = async () => {
    await setDoc(doc(db, "settings", "market_config"), { nextOpening: globalCountdown });
    alert("✅ Programmazione salvata!");
  };

  const handleEditInit = (item) => {
    setEditId(item.id);
    setFormData({
      ...initialFormData,
      ...item,
      endDate: item.endDate ? new Date(item.endDate).toISOString().slice(0, 16) : ""
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const dataToSubmit = { ...formData, price: Number(formData.price || 0), startingBid: Number(formData.startingBid || 0) };
    
    if (editId) {
      await updateDoc(doc(db, "items", editId), dataToSubmit);
      setEditId(null);
    } else {
      await setDoc(doc(collection(db, "items")), createMarketItem(dataToSubmit));
    }
    setFormData(initialFormData);
    setLoading(false);
  };

  if (!currentUser || currentUser.email !== MASTER_EMAIL) return <p className="denied-msg">Accesso negato.</p>;

  return (
    <section className="admin-market-page">
      <Link to="/dm-admin" className="back-button">← Dashboard</Link>
      <h1 className="main-title">{editId ? "🖋️ Modifica Oggetto" : "🛡️ Nuovo Oggetto"}</h1>

      <div className="admin-config-panel">
        <h3 className="panel-title">⏳ Prossimo Mercato</h3>
        <input type="datetime-local" value={globalCountdown} onChange={(e) => setGlobalCountdown(e.target.value)} className="admin-input-date" />
        <button onClick={handleUpdateCountdown} className="admin-button-relaunch">Salva Data</button>
      </div>

      <form onSubmit={handleSubmit} className="admin-form">
        <input name="name" onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Nome" required value={formData.name} className="admin-input" />
        <div className="form-row">
          <select name="class" onChange={(e) => setFormData({...formData, class: e.target.value})} required value={formData.class} className="admin-select">
            {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select name="type" onChange={(e) => setFormData({...formData, type: e.target.value})} required value={formData.type} className="admin-select">
            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <input name="minLevel" type="number" placeholder="Lv Ratto Minimo" onChange={(e) => setFormData({...formData, minLevel: e.target.value})} value={formData.minLevel} required className="admin-input" />
        <HtmlToolbar textAreaRef={descRef} formData={formData} setFormData={setFormData} fieldName="description" />
        <textarea ref={descRef} name="description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required className="admin-textarea" rows="6" />
        <input name="img" onChange={(e) => setFormData({...formData, img: e.target.value})} placeholder="URL Immagine" required value={formData.img} className="admin-input" />
        <select name="saleType" onChange={(e) => setFormData({...formData, saleType: e.target.value})} value={formData.saleType} className="admin-select">
          <option value="fixed">Prezzo Fisso</option>
          <option value="auction">Asta</option>
        </select>
        {formData.saleType === "fixed" ? (
          <input name="price" type="number" onChange={(e) => setFormData({...formData, price: e.target.value})} placeholder="Prezzo MP" value={formData.price} required className="admin-input" />
        ) : (
          <div className="form-row">
            <input name="startingBid" type="number" onChange={(e) => setFormData({...formData, startingBid: e.target.value})} placeholder="Base Asta" value={formData.startingBid} required className="admin-input" />
            <input name="endDate" type="datetime-local" onChange={(e) => setFormData({...formData, endDate: e.target.value})} value={formData.endDate} required className="admin-input" />
          </div>
        )}
        <button type="submit" disabled={loading} className="submit-btn">{editId ? "💾 Salva Modifiche" : "➕ Crea Item"}</button>
        {editId && <button type="button" onClick={() => {setEditId(null); setFormData(initialFormData);}} className="cancel-btn">Annulla</button>}
      </form>

      <div className="admin-item-list">
        <h2 className="section-title">📦 Magazzino ({items.length})</h2>
        {items.map(item => (
          <div key={item.id} className="admin-item-row">
            <span className="item-label">{item.name} ({item.price || item.startingBid} MP)</span>
            <div className="row-actions">
              <button onClick={() => handleEditInit(item)} className="edit-link">Modifica</button>
              <button onClick={async () => {if(window.confirm("Eliminare?")) await deleteDoc(doc(db, "items", item.id))}} className="delete-btn">X</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}