// src/pages/MarketAdmin.jsx (CRUD Item - CODICE COMPLETO)

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore'; 
// Assicurati che questo percorso corrisponda a dove salverai il codice della utility function sotto:
import { createMarketItem } from '../utils/itemTemplates'; 

const MASTER_EMAIL = "santomassimo85@gmail.com"; 

// --- ARRAY PER I CAMPI SELECT ---
const RARITIES = ['Comune', 'Raro', 'Magico', 'Epico', 'Leggendario'];
const ITEM_TYPES = ['Arma', 'Armatura', 'Accessori', 'Artefatto Magico', 'Pozioni', 'Pergamne', 'Reagenti'];

const initialFormData = {
    name: '',
    type: 'Arma',
    class: 'Comune',
    saleType: 'fixed',
    price: '',         // Stringa vuota per placeholder
    startingBid: '',   // Stringa vuota per placeholder
    endDate: '',       // Data e ora di scadenza (datetime-local)
    description: '',
    img: '',
    itemClass: '', 
};


export default function MarketAdmin() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const { id } = useParams();

    const [items, setItems] = useState([]);
    const [formData, setFormData] = useState(initialFormData);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');

    const isEditMode = !!id;

    // --- PROTEZIONE DI ACCESSO ---
    if (!currentUser || currentUser.email !== MASTER_EMAIL) {
        return <p style={{ textAlign: 'center', paddingTop: '100px' }}>Accesso negato: solo DM.</p>;
    }

    // --- LOGICA DI CARICAMENTO DATI ---
    const fetchItems = async () => {
        try {
            const itemsCollection = collection(db, 'items');
            const itemSnapshot = await getDocs(itemsCollection);
            const itemsList = itemSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            const itemRef = doc(db, 'items', itemId);
            const itemSnap = await getDoc(itemRef);
            if (itemSnap.exists()) {
                const data = itemSnap.data();
                setFormData({
                    ...data,
                    class: data.class || data.itemClass || '', 
                    price: data.price ? String(data.price) : '', 
                    startingBid: data.startingBid ? String(data.startingBid) : '',
                    saleType: data.saleType || (data.startingBid > 0 ? 'auction' : 'fixed'),
                    endDate: data.endDate ? new Date(data.endDate).toISOString().slice(0, 16) : '', 
                });
            } else {
                setStatus("Item non trovato per la modifica.");
            }
        } catch (error) {
            setStatus(`❌ Errore nel caricamento item: ${error.message}`);
        }
    }

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


    // --- GESTIONE FORM ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: value 
        }));
    };

    const handleDelete = async (itemId) => {
        if (!window.confirm("Sei sicuro di voler eliminare questo item? ATTENZIONE: Questa azione è irreversibile.")) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, 'items', itemId));
            setItems(items.filter(item => item.id !== itemId));
            setStatus(`✅ Item eliminato con successo!`);
            if (isEditMode) navigate('/dm-admin/market');
        } catch (error) {
            setStatus(`❌ Errore nell'eliminazione: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus('');
        
        try {
            // 1. PREPARAZIONE DATI E VALIDAZIONE
            const dataToSubmit = {
                ...formData,
                price: Number(formData.price || 0),
                startingBid: Number(formData.startingBid || 0),
            };
            
            if (dataToSubmit.saleType === 'fixed') {
                if (dataToSubmit.price <= 0) throw new Error("Il Prezzo Fisso deve essere maggiore di zero.");
            } else { // 'auction'
                if (dataToSubmit.startingBid <= 0) throw new Error("Il Prezzo Base Asta deve essere maggiore di zero.");
                if (!formData.endDate) throw new Error("L'asta richiede una Data di Scadenza.");
            }


            if (isEditMode) {
                // MODIFICA (UPDATE)
                const { id: docId, ...dataToUpdate } = dataToSubmit; 
                await updateDoc(doc(db, 'items', id), dataToUpdate); 
                setStatus(`✅ Item '${dataToUpdate.name}' modificato con successo!`);
            } else {
                // CREAZIONE (CREATE)
                const newItem = createMarketItem(dataToSubmit);
                await setDoc(doc(collection(db, 'items')), newItem); 
                setStatus(`✅ Item '${newItem.name}' creato con successo!`);
                setFormData(initialFormData);
            }
            
            await fetchItems(); 
            if (isEditMode) navigate('/dm-admin/market');
            
        } catch (error) {
            setStatus(`❌ Errore: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- JSX RENDER ---
    return (
        <section className="admin-market-page">
            <Link to="/dm-admin" className="back-button">← Dashboard Admin</Link>
            
            <h1>{isEditMode ? 'Modifica Item' : 'Aggiungi Nuovo Item'}</h1>
            {status && <p className={`admin-status ${status.includes('✅') ? 'success' : 'error'}`}>{status}</p>}

            <form onSubmit={handleSubmit} className="admin-form">
                
                <input name="name" onChange={handleChange} placeholder="Nome Oggetto" required value={formData.name || ''} />
                
                {/* RARITÀ */}
                <select name="class" onChange={handleChange} required value={formData.class || ''}>
                    <option value="">-- Seleziona Rarità --</option>
                    {RARITIES.map(rarity => (<option key={rarity} value={rarity}>{rarity}</option>))}
                </select>

                {/* TIPOLOGIA */}
                <select name="type" onChange={handleChange} required value={formData.type || ''}>
                    <option value="">-- Seleziona Tipologia --</option>
                    {ITEM_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                </select>
                
                <textarea name="description" onChange={handleChange} placeholder="Descrizione completa dell'item..." required value={formData.description || ''} rows="4"></textarea>
                <input name="img" onChange={handleChange} placeholder="Percorso Immagine (es. /assets/spada.png)" required value={formData.img || ''} />

                <hr />
                
                {/* 🎯 SELETTORE TIPO VENDITA */}
                <div className="form-group full-width" style={{marginBottom: '15px'}}>
                    <label>Modalità di Vendita:</label>
                    <select name="saleType" onChange={handleChange} value={formData.saleType}>
                         <option value="fixed">Prezzo Fisso (Compra Subito)</option>
                         <option value="auction">Asta (Blind Bid)</option>
                    </select>
                </div>
                
                {/* 🎯 CAMPI CONDIZIONALI */}
                {formData.saleType === 'fixed' ? (
                    <input 
                        name="price" 
                        type="number" 
                        onChange={handleChange} 
                        placeholder="Prezzo Fisso (MP)" 
                        value={formData.price || ''} 
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
                            value={formData.startingBid || ''} 
                            required 
                            min="1"
                        />
                        <input 
                            name="endDate" 
                            type="datetime-local" 
                            onChange={handleChange} 
                            placeholder="Data Scadenza Asta" 
                            value={formData.endDate || ''} 
                            required
                        />
                    </>
                )}
                
                <button type="submit" disabled={loading}>
                    {loading ? 'Salvataggio...' : (isEditMode ? 'Salva Modifiche' : 'Crea Item su Firestore')}
                </button>
                {isEditMode && (
                    <button type="button" onClick={() => handleDelete(id)} disabled={loading} style={{backgroundColor: '#e74c3c'}}>
                        Elimina Item
                    </button>
                )}
            </form>
            
            {/* TABELLA DI GESTIONE */}
            {!isEditMode && (
                <>
                    <h2>Item Esistenti ({items.length})</h2>
                    <p>Clicca 'Modifica' per cambiare i dettagli di un item o forzare un prezzo di base.</p>
                    <div className="admin-item-list">
                        {loading ? <p>Caricamento item...</p> : (
                            items.map(item => (
                                <div key={item.id} className="admin-item-row">
                                    <span>{item.name} ({item.class || item.itemClass})</span>
                                    <span>Base: {item.startingBid || item.price} MP</span>
                                    <div>
                                        <Link to={`/dm-admin/market/edit/${item.id}`} className="admin-link-small">Modifica</Link>
                                        <button onClick={() => handleDelete(item.id)} className="admin-delete-button">X</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </section>
    );
}