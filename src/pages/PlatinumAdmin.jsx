import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore'; 

const MASTER_EMAIL = "santomassimo85@gmail.com"; 

export default function PlatinumAdmin() {
    const { currentUser } = useAuth();
    const [characters, setCharacters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [tempBalances, setTempBalances] = useState({}); 

    // Protezione DM
    if (!currentUser || currentUser.email !== MASTER_EMAIL) {
        return <p style={{ textAlign: 'center', paddingTop: '100px' }}>Accesso negato: solo DM.</p>;
    }

    // Listener in tempo reale (Sostituisce fetchCharacters per essere più reattivo)
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'characters'), (snap) => {
            const charList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCharacters(charList);
            
            // Aggiorna i saldi temporanei solo per i nuovi PG o se non stiamo scrivendo
            setTempBalances(prev => {
                const next = { ...prev };
                charList.forEach(char => {
                    if (!(char.id in next)) next[char.id] = char.platinum || 0;
                });
                return next;
            });
            setLoading(false);
        }, (err) => {
            setStatus(`❌ Errore Firestore: ${err.message}`);
        });

        return () => unsub();
    }, []);
    
    const handleBalanceChange = (uid, value) => {
        const numericValue = value === '' ? '' : parseInt(value);
        setTempBalances(prev => ({ ...prev, [uid]: numericValue }));
    };
    
    const handleSaveBalance = async (charId) => {
        const newBalance = tempBalances[charId];
        if (newBalance === '' || isNaN(newBalance)) return;

        setStatus(`Salvataggio...`);
        try {
            await updateDoc(doc(db, 'characters', charId), {
                platinum: Number(newBalance),
                lastUpdated: new Date().toISOString()
            });
            setStatus(`✅ Saldo aggiornato per ${charId}`);
            setTimeout(() => setStatus(''), 3000);
        } catch (error) {
            setStatus(`❌ Errore: ${error.message}`);
        }
    };

    return (
        <section className="admin-page" style={{padding: '20px', maxWidth: '800px', margin: '0 auto'}}>
            <Link to="/dm-admin" className="back-button">← Dashboard Admin</Link>
            <h1>Gestione Monete Platino (MP)</h1>
            
            {status && <p className={`admin-status ${status.includes('✅') ? 'success' : 'error'}`}>{status}</p>}

            {loading ? <p>Caricamento...</p> : (
                <div className="admin-list-container">
                    {characters.map(char => (
                        <div key={char.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #333', alignItems: 'center' }}>
                            <div style={{flex: 1}}>
                                <strong>{char.name || char.email?.split('@')[0]}</strong>
                                <br/><small style={{color: '#666'}}>{char.id}</small>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="number"
                                    value={tempBalances[char.id] ?? ''}
                                    onChange={(e) => handleBalanceChange(char.id, e.target.value)}
                                    style={{ width: '100px', padding: '5px', background: '#111', color: 'white', border: '1px solid #444' }}
                                />
                                <span>MP</span>
                                <button 
                                    onClick={() => handleSaveBalance(char.id)}
                                    className="admin-button-relaunch"
                                    style={{padding: '5px 15px'}}
                                >
                                    Salva
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}