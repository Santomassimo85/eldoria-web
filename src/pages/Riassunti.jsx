// src/pages/Riassunti.jsx

import React, { useState, useEffect, useMemo } from 'react';
import ToggleSection from "./ToggleSection";
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { awardPetPoints } from '../utils/pet';
import './Riassunti.css';

const MASTER_EMAIL = "santomassimo85@gmail.com";

const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[c]));

const stripImages = (html) =>
    String(html ?? "")
        .replace(/<img\b[^>]*>/gi, "")
        .replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, "")
        .replace(/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi, (_, inner) => inner.trim() ? `<div>${inner}</div>` : "");

const exportPartyAsPdf = (partyKey, summaries) => {
    const docTitle = `Memorie · Gruppo ${partyKey}`;
    const todayStr = new Date().toLocaleDateString("it-IT", {
        day: "2-digit", month: "long", year: "numeric",
    });

    const summariesHtml = summaries
        .map((s, i) => `
            <article class="ex-summary">
                <div class="ex-summary-num">Sessione ${i + 1}</div>
                <h2 class="ex-summary-title">${escapeHtml(s.title || "Senza titolo")}</h2>
                ${s.date ? `<div class="ex-summary-date">${escapeHtml(s.date)}</div>` : ""}
                ${s.subTitle ? `<div class="ex-summary-sub">${escapeHtml(s.subTitle)}</div>` : ""}
                <div class="ex-summary-body">${stripImages(s.content)}</div>
            </article>`)
        .join("");

    const html = `<!doctype html>
<html lang="it"><head>
<meta charset="utf-8" />
<title>${escapeHtml(docTitle)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Garamond, "EB Garamond", Georgia, serif;
    max-width: 760px;
    margin: 32px auto;
    padding: 0 24px;
    color: #2a1d0f;
    background: #fdfaf2;
  }
  h1.ex-doc-title {
    font-family: Cinzel, "Trajan Pro", Georgia, serif;
    text-align: center;
    color: #5a1a1a;
    border-bottom: 2px solid #b08a3e;
    padding-bottom: 12px;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }
  .ex-doc-meta {
    text-align: center;
    color: #8a6f3a;
    font-style: italic;
    margin-bottom: 32px;
    font-size: 0.9rem;
  }
  .ex-summary {
    page-break-after: always;
    margin-bottom: 48px;
  }
  .ex-summary:last-child { page-break-after: auto; }
  .ex-summary-num {
    display: inline-block;
    font-family: Cinzel, "Trajan Pro", Georgia, serif;
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #b08a3e;
    border: 1px solid #b08a3e;
    border-radius: 999px;
    padding: 3px 10px;
    margin-bottom: 8px;
  }
  .ex-summary-title {
    font-family: Cinzel, "Trajan Pro", Georgia, serif;
    color: #5a1a1a;
    margin: 0 0 4px;
    font-size: 1.7rem;
    letter-spacing: 0.03em;
  }
  .ex-summary-date {
    color: #8a6f3a;
    font-style: italic;
    margin-bottom: 4px;
    font-size: 0.95rem;
  }
  .ex-summary-sub {
    font-style: italic;
    color: #6a4a26;
    margin-bottom: 16px;
  }
  .ex-summary-body { line-height: 1.65; font-size: 1.02rem; }
  .ex-summary-body p { margin: 0 0 12px; }
  @media print {
    body { margin: 0; background: #fff; }
    @page { margin: 18mm; }
  }
</style></head>
<body>
<h1 class="ex-doc-title">${escapeHtml(docTitle)}</h1>
<div class="ex-doc-meta">${summaries.length} memorie · esportato il ${escapeHtml(todayStr)}</div>
${summariesHtml}
<script>
  window.addEventListener("load", () => setTimeout(() => window.print(), 200));
</script>
</body></html>`;

    const win = window.open("", "_blank", "width=960,height=1080");
    if (win && win.document) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        return;
    }

    // Popup blocked → fall back to downloading the HTML file. The user can open
    // it in their browser and print/save-as-PDF from there.
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Memorie-Gruppo-${partyKey}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

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
        // 🐣 pet system: +2 points the first time this summary is read
        if (currentUser?.uid) awardPetPoints(currentUser.uid, "summary_read", { resourceKey: summaryId });
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
                        <div className="riassunti-party-toolbar">
                            <button
                                type="button"
                                className="riassunti-export-btn"
                                onClick={() => exportPartyAsPdf(partyKey, groupedSummaries[partyKey])}
                                title={`Esporta tutte le memorie del Gruppo ${partyKey} in PDF`}
                            >
                                📥 Esporta gruppo {partyKey} (PDF)
                            </button>
                        </div>
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
