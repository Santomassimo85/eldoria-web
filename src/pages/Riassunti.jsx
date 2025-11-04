// src/pages/Riassunti.jsx 

import React, { useState, useEffect, useMemo } from 'react';
import ToggleSection from "./ToggleSection"; // Presupponendo che questo componente esista
import { db } from '../firebase'; // Assicurati che il percorso sia corretto
import { collection, getDocs } from 'firebase/firestore';

export default function Riassunti() {
    const [allSummaries, setAllSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // --- Caricamento Riassunti da Firestore ---
    useEffect(() => {
        const fetchSummaries = async () => {
            if (!db) return;
            try {
                const summariesCollection = collection(db, 'summaries');
                const summarySnapshot = await getDocs(summariesCollection);
                
                // Mappa e ordina per il campo 'order'
                const summariesList = summarySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                    .sort((a, b) => (a.order || 0) - (b.order || 0)); 
                    
                setAllSummaries(summariesList);
            } catch (error) {
                console.error("Errore nel caricamento dei riassunti:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSummaries();
    }, []); 

    // --- Raggruppamento per Party ---
    const groupedSummaries = useMemo(() => {
        return allSummaries.reduce((acc, summary) => {
            const partyKey = summary.party || 'AMEA'; // Usa AMEA come fallback
            if (!acc[partyKey]) {
                acc[partyKey] = [];
            }
            acc[partyKey].push(summary);
            return acc;
        }, {});
    }, [allSummaries]);
    
    // --- Contenuto Statico Introduttivo ---
    const staticIntro = (
        <>
            <h3>Le schegge del mondo</h3>
            <p>
                <span className="start">Anno 1852 d.C.S. </span>“Scrivo queste parole
                perché il mondo dimentica più in fretta di quanto il vento spenga una
                candela.” Sono trascorsi quasi duemila anni dalla Caduta delle Stelle...
                [Continua con il testo statico completo]
                ... “Se questo mondo dovrà essere ricomposto, non sarà con la forza, ma con la memoria.” — <i>Obia, Monaco dell’Eco Silente</i>
            </p>
        </>
    );

    if (loading) {
        return <section className="summary-page"><p style={{textAlign: 'center', paddingTop: '50px'}}>Caricamento memorie...</p></section>;
    }


    return (
        <section className="summary-page">
            <h1>Memorie del monaco errante</h1>
            {staticIntro}

            {/* --- RENDERING DINAMICO DEI GRUPPI --- */}
            {Object.keys(groupedSummaries).map(partyKey => (
                <ToggleSection title={`Gruppo ${partyKey}`} key={partyKey} defaultOpen={true}>
                    <div className="summary-grid">
                        {groupedSummaries[partyKey].map(summary => (
                            <ToggleSection
                                key={summary.id}
                                title={
                                    <>
                                        {summary.title.split(' ').slice(0, 1).join(' ')} <br />
                                        {summary.title.split(' ').slice(1).join(' ')}
                                    </>
                                }
                                titleClass="summaryTitle"
                                contentClass="summary-content-padding"
                            >
                                {/* MOSTRA LA DATA SOPRA TUTTO */}
                                {summary.date && <h2 className="summaryDate">{summary.date}</h2>}
                                
                                <h4 className="Obia">{summary.subTitle}</h4>
                                
                                <div dangerouslySetInnerHTML={{ __html: summary.content }} />
                                
                            </ToggleSection>
                        ))}
                    </div>
                </ToggleSection>
            ))}
        </section>
    );
}