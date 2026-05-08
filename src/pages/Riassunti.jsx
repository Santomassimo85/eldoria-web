// src/pages/Riassunti.jsx

import React, { useState, useEffect, useMemo } from 'react';
import ToggleSection from "./ToggleSection";
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import './Riassunti.css';

const MASTER_EMAIL = "santomassimo85@gmail.com";

export default function Riassunti() {
    const { currentUser } = useAuth();
    const isMaster = currentUser?.email === MASTER_EMAIL;
    const [allSummaries, setAllSummaries] = useState([]);
    const [loading, setLoading] = useState(true);

    const recordVisit = async (summaryId) => {
        if (isMaster) return;
        try {
            await updateDoc(doc(db, 'summaries', summaryId), {
                viewCount: increment(1),
            });
        } catch (_) {}
        setAllSummaries(prev =>
            prev.map(s => s.id === summaryId ? { ...s, viewCount: (s.viewCount || 0) + 1 } : s)
        );
    };

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
                                                    {summary.coverImage && (
                                                        <div className="summary-card-cover">
                                                            <img
                                                                src={summary.coverImage}
                                                                alt={summary.title}
                                                                loading="lazy"
                                                                onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }}
                                                            />
                                                        </div>
                                                    )}
                                                    <span className="summary-card-title-text">{summary.title}</span>
                                                    {summary.date && (
                                                        <span className="summary-card-date-chip">
                                                            {summary.date}
                                                        </span>
                                                    )}
                                                    {isMaster && (
                                                        <span className="summary-visit-badge" title="Visite totali">
                                                            👁 {summary.viewCount || 0}
                                                        </span>
                                                    )}
                                                </>
                                            }
                                            titleClass={`summaryTitle ${summary.coverImage ? "has-cover" : ""}`}
                                            contentClass="summary-content-padding"
                                            onOpen={() => recordVisit(summary.id)}
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
                                            {Array.isArray(summary.images) && summary.images.length > 0 && (
                                                <div className="summary-gallery">
                                                    {summary.images.map((url, i) => (
                                                        <a
                                                            key={url + i}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="summary-gallery-item"
                                                        >
                                                            <img
                                                                src={url}
                                                                alt={`${summary.title} — immagine ${i + 1}`}
                                                                loading="lazy"
                                                                onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }}
                                                            />
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
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
