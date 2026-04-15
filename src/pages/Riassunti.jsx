// src/pages/Riassunti.jsx

import React, { useState, useEffect, useMemo } from 'react';
import ToggleSection from "./ToggleSection";
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import './Riassunti.css';

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
                const summariesList = summarySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
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
            const partyKey = summary.party || 'AMEA';
            if (!acc[partyKey]) acc[partyKey] = [];
            acc[partyKey].push(summary);
            return acc;
        }, {});
    }, [allSummaries]);

    if (loading) {
        return (
            <section className="riassunti-page">
                <div className="riassunti-loading">
                    <span className="riassunti-loading-icon">📜</span>
                    Caricamento memorie…
                </div>
            </section>
        );
    }

    return (
        <section className="riassunti-page">

            {/* ---- HEADER ---- */}
            <div className="riassunti-header">
                <h1 className="riassunti-title">Memorie del Monaco Errante</h1>
                <div className="riassunti-divider">
                    <span className="riassunti-divider-icon">✦</span>
                </div>
            </div>

            {/* ---- INTRO STATICA ---- */}
            <div className="riassunti-intro">
                <h3>Le schegge del mondo</h3>
                <p>
                    <span className="riassunti-drop">A</span>nno 1852 d.C.S.
                    "Scrivo queste parole perché il mondo dimentica più in fretta
                    di quanto il vento spenga una candela." Sono trascorsi quasi
                    duemila anni dalla Caduta delle Stelle… "Se questo mondo
                    dovrà essere ricomposto, non sarà con la forza, ma con la
                    memoria." — <em>Obia, Monaco dell'Eco Silente</em>
                </p>
            </div>

            {/* ---- GRUPPI PARTY ---- */}
            {Object.keys(groupedSummaries).length === 0 ? (
                <p className="riassunti-empty">Nessuna memoria archiviata.</p>
            ) : (
                Object.keys(groupedSummaries).map(partyKey => (
                    <div key={partyKey} className="riassunti-party-section">
                        <ToggleSection
                            title={`Gruppo ${partyKey}`}
                            defaultOpen={true}
                        >
                            <div className="summary-grid">
                                {groupedSummaries[partyKey].map(summary => (
                                    <div key={summary.id} className="summary-card-wrapper">
                                        <ToggleSection
                                            title={
                                                <>
                                                    {summary.title}
                                                    {summary.date && (
                                                        <span className="summary-card-date-chip">
                                                            {summary.date}
                                                        </span>
                                                    )}
                                                </>
                                            }
                                            titleClass="summaryTitle"
                                            contentClass="summary-content-padding"
                                        >
                                            {summary.date && (
                                                <h2 className="summaryDate">{summary.date}</h2>
                                            )}
                                            {summary.subTitle && (
                                                <h4 className="Obia">{summary.subTitle}</h4>
                                            )}
                                            <div
                                                dangerouslySetInnerHTML={{ __html: summary.content }}
                                            />
                                        </ToggleSection>
                                    </div>
                                ))}
                            </div>
                        </ToggleSection>
                    </div>
                ))
            )}
        </section>
    );
}
