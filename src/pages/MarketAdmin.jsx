import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate, useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  runTransaction,
  deleteField,
  increment
} from "firebase/firestore";
import HtmlToolbar from "../components/HtmlToolbar";
import { createMarketItem } from "../utils/itemTemplates";

const MASTER_EMAIL = "santomassimo85@gmail.com";

const RARITIES = ["Comune", "Raro", "Magico", "Epico", "Leggendario"];
const ITEM_TYPES = [
  "Arma", "Armatura", "Accessori", "Artefatto Magico",
  "Pozioni", "Pergamene", "Reagenti", "Varie"
];

const initialFormData = {
  name: "",
  type: "Arma",
  class: "Comune",
  saleType: "fixed",
  price: "",
  startingBid: "",
  endDate: "",
  description: "",
  img: "",
  minLevel: 0,
  isVisible: true,
};

export default function MarketAdmin() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [globalCountdown, setGlobalCountdown] = useState("");
  const [marketConfig, setMarketConfig] = useState(null);
  const descRef = useRef(null);

  // --- 1. HOOKS E LISTENER (Sempre chiamati all'inizio) ---
  useEffect(() => {
    if (!currentUser) return;

    // Listener Timer Globale (Market Config)
    const unsubConfig = onSnapshot(doc(db, "settings", "market_config"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMarketConfig(data);
        setGlobalCountdown(data.nextOpening || "");
      }
    });

    // Listener Lista Item in tempo reale
    const unsubItems = onSnapshot(collection(db, "items"), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // Caricamento item specifico per la modifica
    const loadEditItem = async () => {
      if (isEditMode) {
        const itemSnap = await getDoc(doc(db, "items", id));
        if (itemSnap.exists()) {
          const data = itemSnap.data();
          setFormData({
            ...initialFormData,
            ...data,
            endDate: data.endDate ? new Date(data.endDate).toISOString().slice(0, 16) : "",
          });
        }
      } else {
        setFormData(initialFormData);
      }
    };

    loadEditItem();
    return () => { 
      unsubConfig(); 
      unsubItems(); 
    };
  }, [id, isEditMode, currentUser]);

  // --- 2. LOGICHE DI GESTIONE ---
  const handleUpdateCountdown = async () => {
    try {
      await setDoc(doc(db, "settings", "market_config"), {
        nextOpening: globalCountdown
      });
      alert("✅ Data apertura mercato salvata!");
    } catch (error) {
      alert("❌ Errore: " + error.message);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("Salvataggio in corso...");
    try {
      const dataToSubmit = {
        ...formData,
        price: Number(formData.price || 0),
        startingBid: Number(formData.startingBid || 0),
        votes: formData.votes || { up: [], down: [] },
        createdAt: formData.createdAt || new Date().toISOString()
      };

      if (isEditMode) {
        await updateDoc(doc(db, "items", id), dataToSubmit);
        setStatus("✅ Item modificato!");
        setTimeout(() => navigate("/dm-admin/market"), 1500);
      } else {
        const newItem = createMarketItem(dataToSubmit);
        await setDoc(doc(collection(db, "items")), newItem);
        setStatus("✅ Item creato!");
        setFormData(initialFormData);
      }
    } catch (error) {
      console.error(error);
      setStatus(`❌ Errore: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm("Eliminare definitivamente l'oggetto?")) return;
    try {
      await deleteDoc(doc(db, "items", itemId));
      if (isEditMode) navigate("/dm-admin/market");
    } catch (error) {
      alert("Errore: " + error.message);
    }
  };

  const handleFinalizeAuctionAndRefund = async (itemId) => {
    if (!window.confirm("Finalizzare l'asta?")) return;
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, "items", itemId);
        const itemDoc = await transaction.get(itemRef);
        const itemData = itemDoc.data();
        const allBids = itemData.bids || {};
        const bidderEmails = itemData.bidderEmails || {};
        const bidderUids = Object.keys(allBids);

        if (bidderUids.length === 0) {
          transaction.update(itemRef, { isSold: true, isRefunded: true, auctionStatus: "Chiusa senza offerte" });
          return;
        }

        let winningBid = 0;
        let winnerUid = null;
        for (const uid in allBids) {
          if (allBids[uid] > winningBid) {
            winningBid = allBids[uid];
            winnerUid = uid;
          }
        }

        for (const uid of bidderUids) {
          const charRef = doc(db, "characters", uid);
          if (uid !== winnerUid) {
            const charDoc = await transaction.get(charRef);
            if (charDoc.exists()) {
              transaction.update(charRef, { platinum: (charDoc.data().platinum || 0) + allBids[uid] });
            }
          } else {
            transaction.update(charRef, { rattoPoints: increment(1) });
          }
        }

        transaction.update(itemRef, {
          isSold: true,
          isRefunded: true,
          winner: winnerUid,
          winningBid: winningBid,
          soldTo: bidderEmails[winnerUid],
          auctionStatus: "Venduto",
          bids: deleteField(),
          bidderEmails: deleteField(),
        });
      });
      alert("✅ Asta conclusa!");
    } catch (error) {
      alert("Errore: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 3. PROTEZIONE ACCESSO (Sempre dopo gli Hooks) ---
  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <p style={{ textAlign: "center", paddingTop: "100px" }}>Accesso negato: solo DM.</p>;
  }

  return (
    <section className="admin-market-page" style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
      <Link to="/dm-admin" className="back-button">← Dashboard Admin</Link>

      <h1>{isEditMode ? "🖋️ Modifica Item" : "🛡️ Aggiungi Nuovo Item"}</h1>

      {!isEditMode && (
        <div style={{ background: "rgba(0,0,0,0.4)", padding: "20px", borderRadius: "10px", border: "2px solid var(--gold)", marginBottom: "30px" }}>
          <h3 style={{ color: "var(--gold)", marginTop: 0 }}>⏳ Programmazione Prossimo Mercato</h3>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="datetime-local"
              value={globalCountdown}
              onChange={(e) => setGlobalCountdown(e.target.value)}
              style={{ padding: "10px", borderRadius: "5px", background: "#111", color: "white", border: "1px solid #444" }}
            />
            <button onClick={handleUpdateCountdown} className="admin-button-relaunch">Salva Apertura</button>
          </div>
          {marketConfig?.nextOpening && (
              <p style={{ fontSize: "0.8rem", color: "#aaa", marginTop: "10px" }}>
                Data corrente nel Tomo: {new Date(marketConfig.nextOpening).toLocaleString()}
              </p>
          )}
        </div>
      )}

      {status && (
        <p className={`admin-status ${status.includes("✅") ? "success" : "error"}`} style={{ padding: "10px", borderRadius: "5px", textAlign: "center", background: "rgba(0,0,0,0.3)" }}>
          {status}
        </p>
      )}

      <form onSubmit={handleSubmit} className="admin-form">
        <input name="name" onChange={handleChange} placeholder="Nome Oggetto" required value={formData.name} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          <select name="class" onChange={handleChange} required value={formData.class}>
            <option value="">-- Rarità --</option>
            {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select name="type" onChange={handleChange} required value={formData.type}>
            <option value="">-- Tipologia --</option>
            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="form-group" style={{ margin: "15px 0" }}>
          <label>Livello Ratto Minimo (0-5):</label>
          <input name="minLevel" type="number" min="0" max="5" onChange={handleChange} value={formData.minLevel} required />
        </div>

        <HtmlToolbar textAreaRef={descRef} formData={formData} setFormData={setFormData} fieldName="description" />
        <textarea ref={descRef} name="description" value={formData.description} onChange={handleChange} placeholder="Descrizione..." required rows="6" />

        <input name="img" onChange={handleChange} placeholder="URL Immagine" required value={formData.img} />

        <div style={{ background: "rgba(255,255,255,0.05)", padding: "15px", borderRadius: "8px", margin: "15px 0" }}>
          <label>Modalità di Vendita:</label>
          <select name="saleType" onChange={handleChange} value={formData.saleType}>
            <option value="fixed">Prezzo Fisso</option>
            <option value="auction">Asta (Blind Bid)</option>
          </select>

          {formData.saleType === "fixed" ? (
            <input name="price" type="number" onChange={handleChange} placeholder="Prezzo MP" value={formData.price} required style={{ marginTop: "10px" }} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
              <input name="startingBid" type="number" onChange={handleChange} placeholder="Base Asta MP" value={formData.startingBid} required />
              <input name="endDate" type="datetime-local" onChange={handleChange} value={formData.endDate} required />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: "20px", background: "rgba(212,175,55,0.1)", padding: "10px", borderRadius: "5px" }}>
          <input type="checkbox" name="isVisible" checked={formData.isVisible} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
          <label style={{ color: 'var(--gold)', cursor: 'pointer' }}><strong>Attivo Subito?</strong></label>
        </div>

        <button type="submit" disabled={loading} className="submit-btn" style={{ width: "100%", padding: "15px", fontWeight: "bold", textTransform: "uppercase" }}>
          {loading ? "Elaborazione..." : (isEditMode ? "💾 Salva Modifiche" : "➕ Crea Oggetto")}
        </button>

        {isEditMode && (
          <button type="button" onClick={() => handleDelete(id)} className="delete-btn" style={{ background: "#c0392b", marginTop: "10px", width: "100%" }}>Elimina Oggetto</button>
        )}
      </form>

      {!isEditMode && (
        <div style={{ marginTop: "50px" }}>
          <h2>📦 Magazzino Item ({items.length})</h2>
          <div className="admin-item-list">
            {items.map((item) => (
              <div key={item.id} className="admin-item-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "6px", marginBottom: "8px", borderLeft: item.isVisible ? "4px solid #27ae60" : "4px solid #555" }}>
                <div>
                  <span style={{ color: item.isVisible ? "white" : "#888" }}>{item.name}</span>
                  <small style={{ marginLeft: "10px", color: "var(--gold)" }}>{item.price || item.startingBid} MP</small>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  {item.saleType === "auction" && !item.isSold && (
                    <button onClick={() => handleFinalizeAuctionAndRefund(item.id)} style={{ background: "#27ae60", fontSize: "0.7rem", padding: "5px 10px", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>Finalizza</button>
                  )}
                  <Link to={`/dm-admin/market/edit/${item.id}`} className="admin-link-small" style={{ color: "var(--gold)", fontSize: "0.8rem" }}>Modifica</Link>
                  <button onClick={() => handleDelete(item.id)} style={{ color: "#e74c3c", background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}>X</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}