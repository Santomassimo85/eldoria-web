// src/pages/MarketAdmin.jsx (CRUD Item)

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { createMarketItem } from '../utils/itemTemplates';


// 🎯 VARIABILE MASTER CRITICA
const MASTER_EMAIL = "santomassimo85@gmail.com"; 

export default function MarketAdmin() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const { id } = useParams(); // ID dell'item se siamo in modalità modifica

    const [items, setItems] = useState([]);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');

    const isEditMode = !!id; // True se c'è un ID nel parametro URL

    // --- PROTEZIONE DI ACCESSO ---
    if (!currentUser || currentUser.email !== MASTER_EMAIL) {
        return <p style={{ textAlign: 'center', paddingTop: '100px' }}>Accesso negato: solo DM.</p>;
    }

    // --- LOGICA DI CARICAMENTO DATI ---
    const fetchItems = async () => {
        setLoading(true);
        const itemsCollection = collection(db, 'items');
        const itemSnapshot = await getDocs(itemsCollection);
        const itemsList = itemSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setItems(itemsList);
        setLoading(false);

        // Se siamo in modalità modifica, precarica i dati nel form
        if (isEditMode) {
            const itemToEdit = itemsList.find(item => item.id === id);
            if (itemToEdit) {
                setFormData(itemToEdit);
            } else {
                setStatus("Item non trovato per la modifica.");
            }
        }
    };
    
    useEffect(() => {
        fetchItems();
    }, [id]); // Ricarica quando l'ID (modalità modifica) cambia

    // --- GESTIONE FORM ---
    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'number' ? Number(value) : value 
        }));
    };

    const handleDelete = async (itemId) => {
        if (!window.confirm("Sei sicuro di voler eliminare questo item? ATTENZIONE: Questa azione è irreversibile.")) return;
        try {
            await deleteDoc(doc(db, 'items', itemId));
            setItems(items.filter(item => item.id !== itemId));
            setStatus(`✅ Item eliminato con successo!`);
            if (isEditMode) navigate('/dm-admin/market'); // Torna all'elenco dopo l'eliminazione
        } catch (error) {
            setStatus(`❌ Errore nell'eliminazione: ${error.message}`);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus('');
        
        try {
            const itemData = {
                ...formData,
                itemClass: formData.class || formData.itemClass, 
                startingBid: Number(formData.startingBid) || 0,
                price: Number(formData.price) || 0,
            };

            if (isEditMode) {
                // MODIFICA (UPDATE)
                const { id: docId, ...dataToUpdate } = itemData; 
                await updateDoc(doc(db, 'items', docId), dataToUpdate);
                setStatus(`✅ Item '${itemData.name}' modificato con successo!`);
            } else {
                // CREAZIONE (CREATE)
                const newItem = createMarketItem(itemData);
                // setDoc senza un ID lo crea (ma l'ID è generato da Firestore, non dal codice)
                await setDoc(doc(collection(db, 'items')), newItem); 
                setStatus(`✅ Item '${newItem.name}' creato con successo!`);
                setFormData({}); // Resetta il form
            }
            
            setLoading(false);
            fetchItems(); 
            if (isEditMode) navigate('/dm-admin/market'); // Torna all'elenco dopo la modifica
            
        } catch (error) {
            setStatus(`❌ Errore: ${error.message}`);
            setLoading(false);
        }
    };

    // --- JSX RENDER ---
    return (
        <section className="admin-market-page">
            <Link to="/dm-admin" className="back-button">← Dashboard Admin</Link>
            
            <h1>{isEditMode ? 'Modifica Item' : 'Aggiungi Nuovo Item'}</h1>
            {status && <p className={`admin-status ${status.includes('✅') ? 'success' : 'error'}`}>{status}</p>}

            /* FORM DI CREAZIONE/MODIFICA */
                        <form onSubmit={handleSubmit} className="admin-form">
                            <input name="name" onChange={handleChange} placeholder="Nome Oggetto" required value={formData.name || ''} />
                            
                            <select name="class" onChange={handleChange} required value={formData.class || formData.itemClass || ''}>
                                <option value="">-- Seleziona Rarità --</option>
                                <option value="Comune">Comune</option>
                                <option value="Raro">Raro</option>
                                <option value="Magico">Magico</option>
                                <option value="Epico">Epico</option>
                                <option value="Leggendario">Leggendario</option>
                            </select>

                            <select name="type" onChange={handleChange} required value={formData.type || ''}>
                                <option value="">-- Seleziona Tipologia --</option>
                                <option value="Arma">Arma</option>
                                <option value="Armatura">Armatura</option>
                                <option value="Accessori">Accessori</option>
                                <option value="Artefatto Magico">Artefatto Magico</option>
                                <option value="Pozioni">Pozioni</option>
                                <option value="Pergamne">Pergamne</option>
                                <option value="Reagenti">Reagenti</option>
                            </select>
                            <input name="price" type="number" onChange={handleChange} placeholder="Prezzo Fisso" value={formData.price || 0} />
                            <input name="startingBid" type="number" onChange={handleChange} placeholder="Prezzo Base Asta" value={formData.startingBid || 0} />
                            <textarea name="description" onChange={handleChange} placeholder="Descrizione completa dell'item..." required value={formData.description || ''} rows="4"></textarea>
                            <input name="img" onChange={handleChange} placeholder="Percorso Immagine" required value={formData.img || ''} />

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
                                    <span>{item.name} ({item.class})</span>
                                    <span>Base: {item.startingBid || item.price} GP</span>
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