// src/pages/MarketAdmin.jsx (CRUD Item - CODICE COMPLETO)
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate, useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { increment } from "firebase/firestore";
// src/pages/MarketAdmin.jsx (IMPORT FIREBASE)
import HtmlToolbar from "../components/HtmlToolbar";

import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  runTransaction,
  deleteField,
} from "firebase/firestore";

import { createMarketItem } from "../utils/itemTemplates";

const MASTER_EMAIL = "santomassimo85@gmail.com";

// --- ARRAY PER I CAMPI SELECT ---
const RARITIES = ["Comune", "Raro", "Magico", "Epico", "Leggendario"];
const ITEM_TYPES = [
  "Arma",
  "Armatura",
  "Accessori",
  "Artefatto Magico",
  "Pozioni",
  "Pergamene",
  "Reagenti",
  "Varie",
];

const initialFormData = {
  name: "",
  type: "Arma",
  class: "Comune",
  saleType: "fixed",
  price: "", // Stringa vuota per placeholder
  startingBid: "", // Stringa vuota per placeholder
  endDate: "", // Data e ora di scadenza (datetime-local)
  description: "",
  img: "",
  minLevel: 0,
  itemClass: "",
};

export default function MarketAdmin() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const descRef = useRef(null);

  const isEditMode = !!id;

  // --- PROTEZIONE DI ACCESSO ---
  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return (
      <p style={{ textAlign: "center", paddingTop: "100px" }}>
        Accesso negato: solo DM.
      </p>
    );
  }

  const fetchItems = async () => {
    try {
      const itemsCollection = collection(db, "items");
      const itemSnapshot = await getDocs(itemsCollection);
      const itemsList = itemSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(itemsList);
      return itemsList;
    } catch (error) {
      setStatus(`❌ Errore nel caricamento lista item: ${error.message}`);
      return [];
    }
  };
  // --- FUNZIONE CARICA DATI PER MODIFICA ---
  const fetchItemForEdit = async (itemId) => {
    try {
      const itemRef = doc(db, "items", itemId);
      const itemSnap = await getDoc(itemRef);
      if (itemSnap.exists()) {
        const data = itemSnap.data();
        setFormData({
          ...data,
          class: data.class || data.itemClass || "",
          price: data.price ? String(data.price) : "",
          startingBid: data.startingBid ? String(data.startingBid) : "",
          saleType:
            data.saleType || (data.startingBid > 0 ? "auction" : "fixed"),
          endDate: data.endDate
            ? new Date(data.endDate).toISOString().slice(0, 16)
            : "",
        });
      } else {
        setStatus("Item non trovato per la modifica.");
      }
    } catch (error) {
      setStatus(`❌ Errore nel caricamento item: ${error.message}`);
    }
  };
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchItems();
      if (isEditMode) {
        await fetchItemForEdit(id);
      } else {
        setFormData(initialFormData);
      }
      setLoading(false);
    };
    loadData();
  }, [id]);

  // --- GESTIONE FORM E CRUD ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDelete = async (itemId) => {
    if (
      !window.confirm(
        "Sei sicuro di voler eliminare questo item? ATTENZIONE: Questa azione è irreversibile.",
      )
    )
      return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "items", itemId));
      setItems(items.filter((item) => item.id !== itemId));
      setStatus(`✅ Item eliminato con successo!`);
      if (isEditMode) navigate("/dm-admin/market");
    } catch (error) {
      setStatus(`❌ Errore nell'eliminazione: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      // 1. PREPARAZIONE DATI E VALIDAZIONE
      const dataToSubmit = {
        ...formData,
        price: Number(formData.price || 0),
        startingBid: Number(formData.startingBid || 0),
      };

      if (dataToSubmit.saleType === "fixed") {
        if (dataToSubmit.price <= 0)
          throw new Error("Il Prezzo Fisso deve essere maggiore di zero.");
      } else {
        // 'auction'
        if (dataToSubmit.startingBid <= 0)
          throw new Error("Il Prezzo Base Asta deve essere maggiore di zero.");
        if (!formData.endDate)
          throw new Error("L'asta richiede una Data di Scadenza.");
      }

      if (isEditMode) {
        // MODIFICA (UPDATE)
        const { id: docId, ...dataToUpdate } = dataToSubmit;
        await updateDoc(doc(db, "items", id), dataToUpdate);
        setStatus(`✅ Item '${dataToUpdate.name}' modificato con successo!`);
      } else {
        // CREAZIONE (CREATE)
        const newItem = createMarketItem(dataToSubmit);
        await setDoc(doc(collection(db, "items")), newItem);
        setStatus(`✅ Item '${newItem.name}' creato con successo!`);
        setFormData(initialFormData);
      }

      await fetchItems();
      if (isEditMode) navigate("/dm-admin/market");
    } catch (error) {
      setStatus(`❌ Errore: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // FUNZIONE CHIAVE: FINALIZZA ASTA (assegna vincitore e rimborsa perdenti)
  const handleFinalizeAuctionAndRefund = async (itemId) => {
    if (
      !window.confirm(
        "Sei sicuro di voler FINALIZZARE l'asta? Questo rimborserà tutti i partecipanti tranne l'offerente più alto, che si aggiudicherà l'oggetto.",
      )
    )
      return;

    const itemRef = doc(db, "items", itemId);
    setStatus(`Finalizzazione asta ${itemId} in corso...`);
    setLoading(true);

    try {
      await runTransaction(db, async (transaction) => {
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
          throw new Error("Item non trovato.");
        }
        const itemData = itemDoc.data();
        const allBids = itemData.bids || {};
        const bidderEmails = itemData.bidderEmails || {};
        const bidderUids = Object.keys(allBids);

        // ---------------------------------------------
        // SCENARIO A: NESSUNA OFFERTA RICEVUTA
        // ---------------------------------------------
        if (bidderUids.length === 0) {
          transaction.update(itemRef, {
            isRefunded: true,
            isSold: true,
            auctionStatus: "Scaduta senza offerte",
          });
          setStatus(
            `✅ Asta finalizzata! Nessuna offerta. Oggetto segnato come risolto.`,
          );
          return;
        }

        // ---------------------------------------------
        // SCENARIO B: ASTA CON VINCITORE
        // ---------------------------------------------

        // 1. TROVA L'OFFERTA PIÙ ALTA
        let winningBid = 0;
        let winnerUid = null;

        for (const uid in allBids) {
          if (allBids[uid] > winningBid) {
            winningBid = allBids[uid];
            winnerUid = uid;
          }
        }

        // 2. CICLA TUTTE LE OFFERTE, RIMBORSA I PERDENTI E PREMIA IL VINCITORE
        let refundsCount = 0;

        for (const uid of bidderUids) {
          const bidAmount = allBids[uid];
          const charRef = doc(db, "characters", uid);

          if (uid !== winnerUid) {
            // --- LOGICA RIMBORSO PERDENTI ---
            const charDoc = await transaction.get(charRef);
            if (charDoc.exists()) {
              const currentPlatinum = charDoc.data().platinum || 0;
              transaction.update(charRef, {
                platinum: currentPlatinum + bidAmount,
              });
              refundsCount++;
            }
          } else {
            // --- LOGICA REPUTAZIONE VINCITORE (+1 Punto Ratto) ---
            // Usiamo increment(1) per aggiungere il punto reputazione
            transaction.update(charRef, {
              rattoPoints: increment(1),
            });
          }
        }

        // 3. AGGIORNA LO STATO DELL'ITEM
        const updates = {
          isSold: true,
          isRefunded: true,
          winner: winnerUid,
          winningBid: winningBid,
          soldTo: bidderEmails[winnerUid],
          auctionStatus: "Venduto",
          bids: deleteField(),
          bidderEmails: deleteField(),
        };
        transaction.update(itemRef, updates);

        setStatus(
          `✅ Asta finalizzata! Oggetto aggiudicato a ${bidderEmails[winnerUid] || "N.D."} per ${winningBid} MP (+1 Reputazione Ratti). Rimborsi effettuati: ${refundsCount}.`,
        );
      });
    } catch (error) {
      setStatus(
        `❌ ERRORE CRITICO durante la finalizzazione dell'asta: ${error.message}`,
      );
      console.error("Errore Transazione Finalizzazione:", error);
    } finally {
      setLoading(false);
      fetchItems();
    }
  };



  const handleRelist = async (itemId, newDate) => {
  if (!newDate) return alert("Per favore, seleziona una nuova data di scadenza.");

  try {
    setLoading(true);
    // 1. Riferimento al documento (Assicurati che sia "items")
    const itemRef = doc(db, "items", itemId);

    // 2. Prepariamo i dati esatti
    const updatedData = {
      endDate: newDate,           // La nuova data dal selettore
      isSold: false,              // Deve tornare disponibile
      bids: {},                   // Resetta le offerte
      isRefunded: false,          // Resetta eventuali rimborsi
      createdAt: new Date().toISOString() // Lo riporta in cima alla lista
    };

    console.log("Tentativo di rilancio per ID:", itemId, updatedData);

    // 3. Esegui l'aggiornamento
    await updateDoc(itemRef, updatedData);

    alert("✅ Tomo aggiornato! L'oggetto è di nuovo all'asta.");
    
    // 4. Forza il ricaricamento della lista locale
    fetchItems(); 

  } catch (error) {
    console.error("Errore durante il rilancio:", error);
    alert("❌ Errore magico: " + error.message);
  } finally {
    setLoading(false);
  }
};
  // --- JSX RENDER ---
  return (
    <section className="admin-market-page">
      <Link to="/dm-admin" className="back-button">
        ← Dashboard Admin
      </Link>

      <h1>{isEditMode ? "Modifica Item" : "Aggiungi Nuovo Item"}</h1>
      {status && (
        <p
          className={`admin-status ${
            status.includes("✅") ? "success" : "error"
          }`}
        >
          {status}
        </p>
      )}

      <form onSubmit={handleSubmit} className="admin-form">
        {/* ... (Campi Nome, Rarità, Tipologia, Descrizione, Img) ... */}
        <input
          name="name"
          onChange={handleChange}
          placeholder="Nome Oggetto"
          required
          value={formData.name || ""}
        />
        <select
          name="class"
          onChange={handleChange}
          required
          value={formData.class || ""}
        >
          <option value="">-- Seleziona Rarità --</option>
          {RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {rarity}
            </option>
          ))}
        </select>
        <select
          name="type"
          onChange={handleChange}
          required
          value={formData.type || ""}
        >
          <option value="">-- Seleziona Tipologia --</option>
          {ITEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <div className="form-group" style={{ marginTop: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>
            Livello Ratto Minimo (0-5):
          </label>
          <input
            name="minLevel"
            type="number"
            min="0"
            max="5"
            onChange={handleChange}
            value={formData.minLevel || 0}
            required
            className="admin-input"
          />
        </div>

       <HtmlToolbar 
    textAreaRef={descRef} 
    formData={formData} 
    setFormData={setFormData} 
    fieldName="description" 
  />
        <textarea
    ref={descRef} // Collega il riferimento per la toolbar
    name="description" // Deve essere uguale a fieldName della toolbar
    value={formData.description || ""} // Prende il valore dallo stato
    onChange={handleChange} // Gestisce la scrittura normale da tastiera
    placeholder="Descrizione completa dell'oggetto..."
    required
    rows="6"
  ></textarea>
        <input
          name="img"
          onChange={handleChange}
          placeholder="Percorso Immagine (es. /assets/spada.png)"
          required
          value={formData.img || ""}
        />

        <hr />

        {/* SELETTORE TIPO VENDITA */}
        <div className="form-group full-width" style={{ marginBottom: "15px" }}>
          <label>Modalità di Vendita:</label>
          <select
            name="saleType"
            onChange={handleChange}
            value={formData.saleType}
          >
            <option value="fixed">Prezzo Fisso (Compra Subito)</option>
            <option value="auction">Asta (Blind Bid)</option>
          </select>
        </div>

        {/* CAMPI CONDIZIONALI */}
        {formData.saleType === "fixed" ? (
          <input
            name="price"
            type="number"
            onChange={handleChange}
            placeholder="Prezzo Fisso (MP)"
            value={formData.price || ""}
            required
            min="1"
          />
        ) : (
          <>
            <input
              name="startingBid"
              type="number"
              onChange={handleChange}
              placeholder="Prezzo Base Asta (MP)"
              value={formData.startingBid || ""}
              required
              min="1"
            />
            <input
              name="endDate"
              type="datetime-local"
              onChange={handleChange}
              placeholder="Data Scadenza Asta"
              value={formData.endDate || ""}
              required
            />
          </>
        )}

        <button type="submit" disabled={loading}>
          {loading
            ? "Salvataggio..."
            : isEditMode
              ? "Salva Modifiche"
              : "Crea Item su Firestore"}
        </button>
        {isEditMode && (
          <button
            type="button"
            onClick={() => handleDelete(id)}
            disabled={loading}
            style={{ backgroundColor: "#e74c3c" }}
          >
            Elimina Item
          </button>
        )}
      </form>

      {/* TABELLA DI GESTIONE */}
      {!isEditMode && (
        <>
          <h2>Item Esistenti ({items.length})</h2>
          <p>
            Clicca 'Modifica' per cambiare i dettagli di un item o forzare un
            prezzo di base.
          </p>
          <div className="admin-item-list">
  {loading ? (
    <p>Caricamento item...</p>
  ) : (
    items.map((item) => (
      <div
        key={item.id}
        className="admin-item-row"
      >
        {/* RIGA SUPERIORE: Informazioni e Azioni Standard */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%"
        }}>
          <span
            style={{
              flexGrow: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.name} ({item.class || item.itemClass})
          </span>

          <span style={{ width: "120px", textAlign: "right" }}>
            Base: {item.startingBid || item.price} MP
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginLeft: "15px",
            }}
          >
            <Link
              to={`/dm-admin/market/edit/${item.id}`}
              className="admin-link-small"
            >
              Modifica
            </Link>
            <button
              onClick={() => handleDelete(item.id)}
              className="admin-delete-button"
              
            >
              X
            </button>

            {/* PULSANTE DI FINALIZZAZIONE ASTA */}
            {item.saleType === "auction" && !item.isRefunded && (
              <button
                onClick={() => handleFinalizeAuctionAndRefund(item.id)}
                className="admin-button-exist"
                disabled={item.isSold}
                
              >
                Ok & Rimborsa
              </button>
            )}
          </div>
        </div>

        {/* RIGA INFERIORE: Modulo Rilancio (appare solo se l'asta è scaduta e non ci sono offerte) */}
        {item.saleType === "auction" && 
         new Date(item.endDate) < new Date() && 
         (!item.bids || Object.keys(item.bids).length === 0) && (
          <div >
            <div >
              <span style={{ fontSize: "0.85rem", color: "#f1c40f", fontWeight: "bold" }}>
                ⚠️ Asta conclusa senza offerte
              </span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <label style={{ fontSize: "0.75rem", color: "#ccc" }}>Nuova Scadenza:</label>
                <input 
                  type="datetime-local" 
                  id={`relist-date-${item.id}`}
                  style={{ 
                    padding: "4px", 
                    borderRadius: "4px", 
                    border: "none",
                    fontSize: "0.8rem" 
                  }}
                />
                <button 
                  onClick={() => {
                    const val = document.getElementById(`relist-date-${item.id}`).value;
                    handleRelist(item.id, val);
                  }}
                  className="admin-button-relaunch"
                 
                >
                  Rilancia
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    ))
  )}
</div>
        </>
      )}
    </section>
  );
}
