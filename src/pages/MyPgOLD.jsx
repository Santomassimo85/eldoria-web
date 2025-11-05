// src/pages/MyPg.jsx (Base per la Scheda Personalizzata)

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore'; 

// ⚠️ Mappa di Base: NON useremo Roll20, ma la usiamo come fallback per i PG
const CHARACTER_MAP = {
    // ESEMPIO DI MAPPATURA (SOLO PER NOME/UID)
    "UID_DI_GARROTH": { name: "Garroth R. - Il Cacciatore", race: "Mezz'elfo", class: "Ranger"}, 
    "UID_DI_TANAGAR": { name: "Tanagar - Il Muro Psionico", race: "Mezz'orco", class: "Guerriero"},
    "UID_DI_CAIUS": { name: "Caius N. - Il Negromante", race: "Umano", class: "Negromante"},
    // ...
};

export default function MyPg() {
    const { currentUser } = useAuth();
    const [charData, setCharData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // --- Caricamento Dati Aggiuntivi del PG da Firestore ---
    useEffect(() => {
        if (!currentUser) return;

        // Assumiamo che ci sia una collezione 'pg_sheets'
        const pgRef = doc(db, 'pg_sheets', currentUser.uid); 
        
        const unsubscribe = onSnapshot(pgRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCharData(data);
            } else {
                // Se non c'è il documento, usiamo i dati statici di fallback
                setCharData(CHARACTER_MAP[currentUser.uid] || {});
            }
            setLoading(false);
        }, (error) => {
            console.error("Errore nel caricamento scheda PG:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    if (!currentUser) { /* ... */ return <p>Devi essere loggato.</p>; }
    if (loading) { return <p style={{textAlign: 'center', paddingTop: '50px'}}>Caricamento scheda...</p>; }
    
    const baseInfo = CHARACTER_MAP[currentUser.uid] || {};
    const finalData = { ...baseInfo, ...charData }; // Mescola dati statici e Firebase
    
    // Fallback se il PG non è mappato
    if (!baseInfo.name && !charData) {
        return <p style={{textAlign: 'center'}}>Il tuo personaggio non è mappato in questa applicazione. Contatta il DM.</p>;
    }
    
    return (
        <section className="my-pg-page">
            <h1 style={{textAlign: 'center'}}>{finalData.name || 'Personaggio Non Trovato'}</h1>
            <h3 style={{textAlign: 'center', color: 'var(--gold)'}}>Livello {finalData.level || '?'} {finalData.race} {finalData.class}</h3>

            <div className="character-sheet-container" style={{maxWidth: '800px', margin: '30px auto', padding: '20px', border: '2px solid var(--gold)', borderRadius: '10px', backgroundColor: '#1e1e1e'}}>
                
                {/* 🎯 SEZIONE 1: Statistiche base (DOVRAI INSERIRE QUESTI DATI MANUALMENTE) */}
                <h2>Statistiche Base</h2>
                <div style={{display: 'flex', justifyContent: 'space-around', margin: '20px 0'}}>
                    {['FOR', 'DES', 'COS', 'INT', 'SAG', 'CAR'].map(stat => (
                        <div key={stat} style={{textAlign: 'center'}}>
                            <div style={{fontSize: '1.5em', fontWeight: 'bold'}}>{finalData[stat] || 10}</div>
                            <div>{stat}</div>
                            <div style={{color: 'var(--red)'}}>Mod: {finalData[`mod_${stat}`] || '+0'}</div>
                        </div>
                    ))}
                </div>

                <hr style={{borderColor: '#444'}}/>

                {/* 🎯 SEZIONE 2: Background e Inventario (Dati ricchi, ideali per HTML) */}
                <h2>Background & Inventario</h2>
                <div dangerouslySetInnerHTML={{ __html: finalData.bio || 'Nessuna biografia/inventario caricato.' }} style={{color: '#ccc', lineHeight: '1.4'}}/>
                
            </div>
            
        </section>
    );
}