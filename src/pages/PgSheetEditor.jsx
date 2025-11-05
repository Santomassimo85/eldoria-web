// src/pages/PgSheetEditor.jsx (Editor Scheda PG per i Giocatori)

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore'; 

const STAT_ABBREVIATIONS = ['FOR', 'DES', 'COS', 'INT', 'SAG', 'CAR'];

// Calcola il modificatore (Modificatore = floor((Punteggio - 10) / 2))
const calculateMod = (score) => {
    const numScore = parseInt(score);
    if (isNaN(numScore) || numScore < 1) return '+0';
    const mod = Math.floor((numScore - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
};

export default function PgSheetEditor() {
    const { currentUser } = useAuth();
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!currentUser) {
        return <p style={{ textAlign: 'center', paddingTop: '100px' }}>Devi essere loggato per modificare la tua scheda.</p>;
    }
    
    const pgSheetRef = doc(db, 'pg_sheets', currentUser.uid);

    // --- CARICAMENTO DATI IN TEMPO REALE ---
    useEffect(() => {
        setLoading(true);
        const unsubscribe = onSnapshot(pgSheetRef, (docSnap) => {
            if (docSnap.exists()) {
                setFormData(docSnap.data());
            } else {
                // Inizializza con valori predefiniti se non esiste un documento
                setFormData({
                    name: currentUser.email.split('@')[0],
                    level: 1,
                    race: 'Umano',
                    class: 'Avventuriero',
                    bio: 'Inizia la tua storia qui...',
                    FOR: 10, DES: 10, COS: 10, INT: 10, SAG: 10, CAR: 10
                });
            }
            setLoading(false);
        }, (error) => {
            setStatus(`❌ Errore nel caricamento: ${error.message}`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser.uid]);

    // --- GESTIONE INPUT ---
    const handleChange = (e) => {
        const { name, value, type } = e.target;
        
        let finalValue = value;
        if (type === 'number') {
            finalValue = parseInt(value) || 0;
            if (finalValue > 20) finalValue = 20; // Cap stat a 20 per D&D
        }

        setFormData(prev => ({ 
            ...prev, 
            [name]: finalValue 
        }));
    };
    
    // --- SALVATAGGIO DATI (Modifica/Crea) ---
    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setStatus('Salvataggio in corso...');

        try {
            // Aggiungi dati non modificabili e timestamp
            const dataToSave = {
                ...formData,
                lastUpdated: new Date().toISOString(),
                // Inserisci qui l'UID se non è già nel form
            };
            
            // Usiamo setDoc (con merge implicito) sul documento con UID del PG
            await setDoc(pgSheetRef, dataToSave, { merge: true });

            setStatus('✅ Scheda personaggio salvata con successo!');
        } catch (error) {
            setStatus(`❌ Errore durante il salvataggio: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };


    if (loading) {
        return <p style={{ textAlign: 'center', paddingTop: '50px' }}>Caricamento scheda...</p>;
    }

    const userName = currentUser.email.split('@')[0];

    return (
        <section className="pg-editor-page">
            <h1 style={{ textAlign: 'center' }}>Modifica Scheda di {formData.name || userName}</h1>
            <p style={{ textAlign: 'center', marginBottom: '20px' }}>Aggiorna i tuoi punteggi e la tua biografia/inventario.</p>

            {status && <p className={`admin-status ${status.includes('✅') ? 'success' : 'error'}`}>{status}</p>}

            <form onSubmit={handleSave} className="pg-editor-form" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', border: '1px solid #444', borderRadius: '8px' }}>
                
                {/* INFORMAZIONI BASE */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <input name="name" onChange={handleChange} value={formData.name || ''} placeholder="Nome Personaggio" required style={{ flex: 1, marginRight: '10px' }} />
                    <input name="race" onChange={handleChange} value={formData.race || ''} placeholder="Razza" required style={{ flex: 1, marginRight: '10px' }} />
                    <input name="class" onChange={handleChange} value={formData.class || ''} placeholder="Classe" required style={{ flex: 1, marginRight: '10px' }} />
                    <input name="level" type="number" onChange={handleChange} value={formData.level || 1} placeholder="Livello" required min="1" max="20" style={{ width: '80px', textAlign: 'center' }} />
                </div>
                
                {/* 🎯 STATISTICHE FOR/DES/COS/INT/SAG/CAR */}
                <h2>Punteggi Caratteristica (Punteggio/Modificatore)</h2>
                <div className="stat-grid" >
                    {STAT_ABBREVIATIONS.map(stat => (
                        <div key={stat} style={{ width: '30%', minWidth: '100px', textAlign: 'center', backgroundColor: '#f38f8fff', padding: '10px', borderRadius: '4px' }}>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{stat}</label>
                            <input
                                name={stat}
                                type="number"
                                onChange={handleChange}
                                value={formData[stat] || 10}
                                min="1"
                                max="20"
                                required
                                style={{ width: '60px', textAlign: 'center', fontSize: '1.2em' }}
                            />
                            <div style={{ marginTop: '5px', color: 'var(--root)' }}>
                                Mod: {calculateMod(formData[stat])}
                            </div>
                        </div>
                    ))}
                </div>
                
                {/* BIO / INVENTARIO (HTML consentito per formattazione ricca) */}
                <h2>Biografia e Inventario</h2>
                <textarea 
                    name="bio" 
                    onChange={handleChange} 
                    value={formData.bio || ''} 
                    rows="10" 
                    placeholder="Scrivi qui la tua storia, il tuo inventario (usa HTML per formattazione come <ul>, <b>)." 
                    required 
                    style={{ width: '100%', minHeight: '150px' }}
                />
                
                <button type="submit" disabled={isSaving} style={{ width: '100%', padding: '15px', marginTop: '20px', backgroundColor: 'var(--red)', color: 'white', border: 'none', cursor: 'pointer' }}>
                    {isSaving ? 'Salvataggio...' : 'Salva Scheda Personaggio'}
                </button>
            </form>
        </section>
    );
}