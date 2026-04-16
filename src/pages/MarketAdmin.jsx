import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import "./admin.css";
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

  if (!currentUser || currentUser.email !== MASTER_EMAIL) return <p style={{ textAlign: "center", paddingTop: "100px" }}>Accesso negato.</p>;

  return (
    <section className="admin-market-page">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard</Link>

      <h1 className="admin-page-title">{editId ? "Modifica Oggetto" : "Nuovo Oggetto"}</h1>
      <div className="admin-divider"><span className="admin-divider-icon">🛡</span></div>

      {/* Config prossimo mercato */}
      <div className="admin-card">
        <h2 className="admin-section-title">Prossima Apertura Mercato</h2>
        <div className="admin-form-row" style={{ alignItems: "flex-end" }}>
          <input
            type="datetime-local"
            className="admin-field-input"
            value={globalCountdown}
            onChange={(e) => setGlobalCountdown(e.target.value)}
          />
          <button onClick={handleUpdateCountdown} className="btn-admin-save" style={{ padding: "10px 20px", borderRadius: 8, fontSize: "0.85rem" }}>
            Salva Data
          </button>
        </div>
      </div>

      {/* Form oggetto */}
      <div className="admin-card">
        <h2 className="admin-section-title">{editId ? "Modifica Oggetto" : "Crea Nuovo Oggetto"}</h2>
        <form onSubmit={handleSubmit} className="admin-form-grid">
          <div>
            <label>Nome Oggetto</label>
            <input className="admin-field-input" name="name" placeholder="Nome" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="admin-form-row">
            <div>
              <label>Rarità</label>
              <select className="admin-field-select" name="class" required value={formData.class} onChange={(e) => setFormData({...formData, class: e.target.value})}>
                {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label>Tipo</label>
              <select className="admin-field-select" name="type" required value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label>Livello Ratto Minimo</label>
            <input className="admin-field-input" name="minLevel" type="number" placeholder="0" value={formData.minLevel} required onChange={(e) => setFormData({...formData, minLevel: e.target.value})} />
          </div>
          <div>
            <label>Descrizione (HTML consentito)</label>
            <HtmlToolbar textAreaRef={descRef} formData={formData} setFormData={setFormData} fieldName="description" />
            <textarea ref={descRef} className="admin-field-textarea" name="description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required rows="6" />
          </div>
          <div>
            <label>URL Immagine</label>
            <input className="admin-field-input" name="img" placeholder="https://..." value={formData.img} required onChange={(e) => setFormData({...formData, img: e.target.value})} />
          </div>
          <div>
            <label>Tipo Vendita</label>
            <select className="admin-field-select" name="saleType" value={formData.saleType} onChange={(e) => setFormData({...formData, saleType: e.target.value})}>
              <option value="fixed">Prezzo Fisso</option>
              <option value="auction">Asta</option>
            </select>
          </div>
          {formData.saleType === "fixed" ? (
            <div>
              <label>Prezzo (MP)</label>
              <input className="admin-field-input" name="price" type="number" placeholder="0" value={formData.price} required onChange={(e) => setFormData({...formData, price: e.target.value})} />
            </div>
          ) : (
            <div className="admin-form-row">
              <div>
                <label>Base Asta (MP)</label>
                <input className="admin-field-input" name="startingBid" type="number" placeholder="0" value={formData.startingBid} required onChange={(e) => setFormData({...formData, startingBid: e.target.value})} />
              </div>
              <div>
                <label>Scadenza Asta</label>
                <input className="admin-field-input" name="endDate" type="datetime-local" value={formData.endDate} required onChange={(e) => setFormData({...formData, endDate: e.target.value})} />
              </div>
            </div>
          )}
          <div className="btn-admin-actions">
            <button type="submit" disabled={loading} className="btn-admin-primary">
              {editId ? "Salva Modifiche" : "Crea Item"}
            </button>
            {editId && (
              <button type="button" onClick={() => { setEditId(null); setFormData(initialFormData); }} className="btn-admin-secondary">
                Annulla
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista oggetti */}
      <div className="admin-item-list-card">
        <div style={{ padding: "0 18px" }}>
          <h2 className="admin-section-title" style={{ marginTop: 18, marginBottom: 0 }}>
            Magazzino ({items.length})
          </h2>
        </div>
        {items.map(item => (
          <div key={item.id} className="admin-item-entry">
            <div className="admin-item-entry-label">
              <strong>{item.name}</strong>
              <div className="admin-item-entry-meta">{item.class} — {item.price || item.startingBid} MP</div>
            </div>
            <div className="admin-item-entry-actions">
              <button onClick={() => handleEditInit(item)} className="btn-admin-edit">Modifica</button>
              <button onClick={async () => { if (window.confirm("Eliminare?")) await deleteDoc(doc(db, "items", item.id)); }} className="btn-admin-danger">X</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}