// src/pages/PlatinumAdmin.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'; 

const MASTER_EMAIL = "santomassimo85@gmail.com"; 

export default function PlatinumAdmin() {
    const { currentUser } = useAuth();
    const [characters, setCharacters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    
    // Stato per tracciare le modifiche locali prima del salvataggio
    const [tempBalances, setTempBalances] = useState({}); 

    if (!currentUser || currentUser.email !== MASTER_EMAIL) {
        return <p style={{ textAlign: 'center', paddingTop: '100px' }}>Accesso negato: solo DM.</p>;
    }

    // --- CARICAMENTO PG ---
    const fetchCharacters = async () => {
        setLoading(true);
        try {
            const charsCollection = collection(db, 'characters');
            const charSnapshot = await getDocs(charsCollection);
            const charList = charSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            setCharacters(charList);
            
            // Inizializza i saldi temporanei con i valori attuali
            const initialBalances = charList.reduce((acc, char) => {
                acc[char.id] = char.platinum || 0;
                return acc;
            }, {});
            setTempBalances(initialBalances);
            
            setStatus('');
        } catch (error) {
            setStatus(`❌ Errore nel caricamento dei personaggi: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCharacters();
    }, []);
    
    // --- GESTIONE CAMBIAMENTO INPUT ---
    const handleBalanceChange = (uid, value) => {
        // Accetta solo numeri (o stringa vuota)
        const numericValue = value === '' ? '' : parseInt(value);
        if (isNaN(numericValue) && value !== '') return;
        
        setTempBalances(prev => ({
            ...prev,
            [uid]: numericValue,
        }));
    };
    
    // --- SALVATAGGIO SINGOLO SALDO ---
    const handleSaveBalance = async (charId) => {
        const newBalance = tempBalances[charId] || 0;
        
        // Impedisce di salvare se non è un numero valido
        if (newBalance === '' || isNaN(newBalance)) return;

        setLoading(true);
        setStatus(`Salvando ${newBalance} MP per ${charId}...`);
        
        try {
            const charRef = doc(db, 'characters', charId);
            await updateDoc(charRef, {
                platinum: Number(newBalance),
                lastUpdated: new Date().toISOString()
            });
            
            // Ricarica per aggiornare lo stato di tutti i personaggi
            await fetchCharacters(); 
            setStatus(`✅ Saldo aggiornato a ${newBalance} MP per l'utente ${charId}.`);
            
        } catch (error) {
            setStatus(`❌ Errore nel salvataggio: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };


    return (
        <section className="admin-page">
            <Link to="/dm-admin" className="back-button">← Dashboard Admin</Link>
            <h1>Gestione Saldi Monete Platino (MP)</h1>
            
            {status && <p className={`admin-status ${status.includes('✅') ? 'success' : 'error'}`}>{status}</p>}

            {loading ? (
                <p>Caricamento personaggi...</p>
            ) : (
                <div className="admin-list-container">
                    {characters.map(char => (
                        <div key={char.id} className="admin-char-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #333' }}>
                            
                            <span style={{ fontWeight: 'bold', minWidth: '150px' }}>{char.email.split('@')[0]}</span>
                            <span style={{ fontSize: '0.8em', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '30%' }}>UID: {char.id}</span>
                            
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="number"
                                    value={tempBalances[char.id]}
                                    className='inputPlatinum'
                                    onChange={(e) => handleBalanceChange(char.id, e.target.value)}
                                    style={{ width: '80px', textAlign: 'right', marginRight: '10px' }}
                                    min="0"
                                />
                                <span> MP</span>
                                <button 
                                    onClick={() => handleSaveBalance(char.id)}
                                    disabled={loading || tempBalances[char.id] === '' || Number(tempBalances[char.id]) === char.platinum}
                                    style={{ marginLeft: '10px', backgroundColor: '#4CAF50', color: 'white', padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Salva
                                </button>
                            </div>
                        </div>
                    ))}
                    {!characters.length && <p>Nessun personaggio trovato nella collezione 'characters'.</p>}
                </div>
            )}
        </section>
    );
}