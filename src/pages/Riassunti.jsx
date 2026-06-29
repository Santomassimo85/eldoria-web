// src/pages/Riassunti.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ToggleSection from "./ToggleSection";
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { awardPetPoints } from '../utils/pet';
import { buildLoreRegistry, linkifyLoreHtml, norm, firstTok } from '../utils/loreLinks';
import './Riassunti.css';

const MASTER_EMAIL = "santomassimo85@gmail.com";

// Immagine eroica della testata — NON usata in Arena.
const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/garroth_lago.jpg";

const slugify = (s) =>
    String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[c]));

const stripHtml = (html) =>
    String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ");

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
    const navigate = useNavigate();
    const isMaster = currentUser?.email === MASTER_EMAIL;
    // Deep-link a un riassunto specifico: /riassunti?s=<id>
    const [searchParams] = useSearchParams();
    const targetId = searchParams.get('s');
    const didDeepLink = useRef(false);
    // id del riassunto di cui è stato appena copiato il link (feedback "✓")
    const [copiedId, setCopiedId] = useState(null);
    // riassunto aperto "in grande" nel popup (null = chiuso)
    const [enlargedId, setEnlargedId] = useState(null);
    const [allSummaries, setAllSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [activeGroup, setActiveGroup] = useState(null);
    // dati per i link interattivi (PG / NPC / città)
    const [loreData, setLoreData] = useState({ characters: [], npcs: [], geo: [] });
    // entità mostrata nel popup interno (null = chiuso)
    const [lorePopup, setLorePopup] = useState(null);

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

    // Copia negli appunti il link diretto a una memoria, da condividere coi player.
    const copySummaryLink = async (summaryId) => {
        const url = `${window.location.origin}/riassunto/${summaryId}`;
        try {
            await navigator.clipboard.writeText(url);
        } catch (_) {
            // clipboard non disponibile (http, permessi) → mostra il link da copiare a mano
            window.prompt("Copia il link a questa memoria:", url);
            return;
        }
        setCopiedId(summaryId);
        setTimeout(() => setCopiedId(c => (c === summaryId ? null : c)), 1800);
    };

    // Apre il riassunto "in grande" nel popup (resta sulla pagina) e conta la lettura.
    const openEnlarged = (summary) => {
        setEnlargedId(summary.id);
        recordVisit(summary.id);
    };

    // memoria mostrata nel popup
    const enlarged = useMemo(
        () => allSummaries.find(s => s.id === enlargedId) || null,
        [allSummaries, enlargedId]
    );

    // popup aperto: chiusura con Esc + blocco scroll del documento
    useEffect(() => {
        if (!enlargedId) return;
        const onKey = (e) => { if (e.key === "Escape") setEnlargedId(null); };
        window.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [enlargedId]);

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

    // --- Deep-link: se l'URL è /riassunti?s=<id>, scorri alla memoria e contala ---
    useEffect(() => {
        if (loading || !targetId || didDeepLink.current) return;
        if (!allSummaries.some(s => s.id === targetId)) return; // id non valido
        didDeepLink.current = true;
        // breve attesa perché le card siano nel DOM (la ToggleSection è già aperta
        // via defaultOpen sotto), poi porta la memoria al centro dello schermo.
        const t = setTimeout(() => {
            const el = document.getElementById(`rs-summary-${targetId}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            recordVisit(targetId);
        }, 350);
        return () => clearTimeout(t);
    }, [loading, targetId, allSummaries]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Dati per i link interattivi: PG (characters), NPC (npcs), città (geo) ---
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const [charsSnap, npcsSnap, geoSnap] = await Promise.all([
                    getDocs(collection(db, 'characters')),
                    getDocs(collection(db, 'npcs')),
                    getDocs(collection(db, 'geo_archive')),
                ]);
                if (!alive) return;
                const characters = charsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const npcs = npcsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const geo = geoSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setLoreData({ characters, npcs, geo });
            } catch (_) { /* link interattivi opzionali */ }
        })();
        return () => { alive = false; };
    }, []);

    // registro dei nomi linkabili (ricostruito solo quando cambiano i dati)
    const loreRegistry = useMemo(
        () => buildLoreRegistry({
            characters: loreData.characters,
            npcs: loreData.npcs,
            cities: loreData.geo.map(g => g.name).filter(Boolean),
        }),
        [loreData]
    );

    // mappa "chiave normalizzata" → dettagli da mostrare nel popup interno.
    // Le chiavi combaciano con data-key impostato dai link (loreLinks.norm).
    const loreDetails = useMemo(() => {
        const map = new Map();
        const put = (key, data) => { if (key && !map.has(key)) map.set(key, data); };

        for (const c of loreData.characters) {
            if (!c?.name) continue;
            const tok = firstTok(c.name);
            const meta = [c.race, c.class].filter(Boolean).join(" · ");
            const data = {
                type: "char",
                name: c.name,
                image: c.image || "/assets/player/default.png",
                meta: c.level ? `${meta}${meta ? " · " : ""}Liv. ${c.level}` : meta,
                desc: c.background || "",
                href: `/party?hero=${encodeURIComponent(tok)}`,
            };
            put(norm(c.name), data);
            put(norm(tok), data);
        }
        for (const n of loreData.npcs) {
            if (!n?.name) continue;
            put(norm(n.name), {
                type: "npc",
                name: n.name,
                image: n.image || "/assets/player/default.png",
                meta: [n.faction, n.location].filter(Boolean).join(" · "),
                desc: n.description || "",
                href: `/npc?focus=${slugify(n.name)}`,
            });
        }
        for (const g of loreData.geo) {
            if (!g?.name) continue;
            put(norm(g.name), {
                type: "city",
                name: g.name,
                image: g.image || "",
                meta: g.continent || "",
                desc: g.description || "",
                href: `/Geo?focus=${slugify(g.name)}`,
            });
        }
        return map;
    }, [loreData]);

    // contenuto HTML con i nomi già trasformati in link (memoizzato)
    const linkedContent = useMemo(() => {
        const map = {};
        if (!loreRegistry.regex) return map;
        for (const s of allSummaries) {
            if (s.content) map[s.id] = linkifyLoreHtml(s.content, loreRegistry);
        }
        return map;
    }, [allSummaries, loreRegistry]);

    // intercetta i click sui link interattivi: apre un popup SULLA PAGINA,
    // senza portare via l'utente. Se non ho dettagli, ripiego sulla navigazione.
    const handleLoreClick = (e) => {
        const a = e.target.closest('a[data-lore]');
        if (!a) return;
        e.preventDefault();
        const key = a.getAttribute('data-key');
        const detail = key && loreDetails.get(key);
        if (detail) {
            setLorePopup(detail);
            return;
        }
        const href = a.getAttribute('data-href');
        if (href) navigate(href);
    };

    // chiusura popup con Esc
    useEffect(() => {
        if (!lorePopup) return;
        const onKey = (e) => { if (e.key === "Escape") setLorePopup(null); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [lorePopup]);

    // --- Parallax: aggiorna --rs-scroll su scroll, senza re-render (come Arena) ---
    useEffect(() => {
        let raf = 0;
        const update = () => {
            document.documentElement.style.setProperty("--rs-scroll", String(window.scrollY));
            raf = 0;
        };
        const onScroll = () => {
            if (raf) return;
            raf = requestAnimationFrame(update);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        update();
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (raf) cancelAnimationFrame(raf);
            document.documentElement.style.removeProperty("--rs-scroll");
        };
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

    const groupKeys = useMemo(() => Object.keys(groupedSummaries), [groupedSummaries]);

    // --- Filtro: gruppo attivo + ricerca testuale (gruppo / numero / parola) ---
    const visibleGroups = useMemo(() => {
        const q = query.trim().toLowerCase();
        return groupKeys
            .map((partyKey, gi) => ({
                partyKey,
                gi,
                // numero di sessione (1-based) all'interno del gruppo
                summaries: groupedSummaries[partyKey].map((s, i) => ({ ...s, num: i + 1 })),
            }))
            .filter(g => activeGroup === null || g.partyKey === activeGroup)
            .map(g => {
                if (!q) return g;
                const summaries = g.summaries.filter(s => {
                    const hay = [
                        g.partyKey,
                        `#${s.num}`, `sessione ${s.num}`, String(s.num),
                        s.title, s.subTitle, s.date, stripHtml(s.content),
                    ].join(" ").toLowerCase();
                    return hay.includes(q);
                });
                return { ...g, summaries };
            })
            .filter(g => g.summaries.length > 0);
    }, [groupKeys, groupedSummaries, query, activeGroup]);

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

    const totalMemories = allSummaries.length;
    const visibleCount = visibleGroups.reduce((n, g) => n + g.summaries.length, 0);
    const isFiltering = query.trim() !== "" || activeGroup !== null;

    return (
        <section className="riassunti-page">

            {/* ── SFONDO ANIMATO COSTANTE: rune fluttuanti (stile Arena) ── */}
            <div className="rs-rune-ambient" aria-hidden="true">
                {Array.from({ length: 12 }).map((_, i) => (
                    <span key={i} className={`rs-rune rr${i + 1}`} />
                ))}
            </div>

            {/* ── HERO ASIMMETRICO: immagine full-bleed + placca-registro a sinistra ── */}
            <section id="rs-top" className="rs-hero" aria-label="Memorie del Monaco Errante">
                <div className="rs-hero-media" aria-hidden="true">
                    <img
                        src={HERO_IMAGE}
                        alt=""
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                </div>
                <div className="rs-hero-wash" aria-hidden="true" />
                <div className="rs-hero-plate">
                    <span className="rs-hero-seal">❦ Cronache di Eldoria</span>
                    <h1 className="rs-hero-title">Memorie del<br />Monaco Errante</h1>
                    <p className="rs-hero-tagline">
                        Le schegge del mondo, raccolte sessione dopo sessione.
                        Ciò che la forza dimentica, la memoria conserva.
                    </p>
                    <dl className="rs-hero-stats">
                        <div><dt>Memorie</dt><dd>{totalMemories}</dd></div>
                        <div><dt>{groupKeys.length === 1 ? "Gruppo" : "Gruppi"}</dt><dd>{groupKeys.length}</dd></div>
                    </dl>
                </div>
                <div className="rs-hero-scroll-hint" aria-hidden="true">
                    <span>Scorri</span>
                    <span className="rs-hero-arrow">↓</span>
                </div>
            </section>

            {/* ── TOOLBAR: ricerca + filtri gruppo (sticky) ── */}
            <div className="rs-toolbar">
                <div className="rs-search">
                    <span className="rs-search-icon" aria-hidden="true">🔍</span>
                    <input
                        type="text"
                        className="rs-search-input"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cerca per gruppo, numero di sessione o parola…"
                        aria-label="Cerca nelle memorie"
                    />
                    {query && (
                        <button
                            type="button"
                            className="rs-search-clear"
                            onClick={() => setQuery("")}
                            aria-label="Cancella ricerca"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {groupKeys.length > 1 && (
                    <div className="rs-chips" role="group" aria-label="Filtra per gruppo">
                        <button
                            type="button"
                            className={`rs-chip ${activeGroup === null ? "active" : ""}`}
                            onClick={() => setActiveGroup(null)}
                        >
                            Tutti
                        </button>
                        {groupKeys.map((k, gi) => (
                            <button
                                key={k}
                                type="button"
                                data-accent={gi % 5}
                                className={`rs-chip ${activeGroup === k ? "active" : ""}`}
                                onClick={() => setActiveGroup(activeGroup === k ? null : k)}
                            >
                                ❦ {k}
                            </button>
                        ))}
                    </div>
                )}

                <span className="rs-result-count">
                    {visibleCount} {visibleCount === 1 ? "memoria" : "memorie"}
                    {isFiltering ? " trovate" : ""}
                </span>
            </div>

            {/* ── INTRO manoscritto (nascosto quando si filtra) ── */}
            {!isFiltering && (
                <div className="rs-intro">
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
            )}

            {/* ── GRUPPI PARTY ── */}
            {visibleGroups.length === 0 ? (
                <p className="riassunti-empty">
                    {isFiltering
                        ? "Nessuna memoria corrisponde alla ricerca."
                        : "Nessuna memoria archiviata."}
                </p>
            ) : (
                visibleGroups.map(({ partyKey, gi, summaries }) => {
                    return (
                        <section
                            key={partyKey}
                            id={`rs-group-${slugify(partyKey)}`}
                            className="rs-group"
                            data-accent={gi % 5}
                            aria-label={`Gruppo ${partyKey}`}
                        >
                            {/* marginalia sticky del gruppo */}
                            <aside className="rs-group-aside">
                                <span className="rs-group-seal" aria-hidden="true">❦</span>
                                <span className="rs-group-eyebrow">Cronaca</span>
                                <h2 className="rs-group-name">Gruppo {partyKey}</h2>
                                <span className="rs-group-chip">
                                    {summaries.length} {summaries.length === 1 ? "memoria" : "memorie"}
                                    {query.trim() && groupedSummaries[partyKey].length !== summaries.length
                                        ? ` di ${groupedSummaries[partyKey].length}`
                                        : ""}
                                </span>
                                <button
                                    type="button"
                                    className="riassunti-export-btn"
                                    onClick={() => exportPartyAsPdf(partyKey, groupedSummaries[partyKey])}
                                    title={`Esporta tutte le memorie del Gruppo ${partyKey} in PDF`}
                                >
                                    📥 Esporta (PDF)
                                </button>
                            </aside>

                            {/* card delle memorie */}
                            <div className="rs-group-body">
                                <div className="summary-grid">
                                    {summaries.map(summary => (
                                        <div
                                            key={summary.id}
                                            id={`rs-summary-${summary.id}`}
                                            className={`summary-card-wrapper${targetId === summary.id ? " is-deeplinked" : ""}`}
                                        >
                                            <ToggleSection
                                                defaultOpen={targetId === summary.id}
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
                                                        <span className="summary-card-num">Sessione #{summary.num}</span>
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
                                                        <button
                                                            type="button"
                                                            className="summary-enlarge-btn"
                                                            title="Apri la memoria in grande"
                                                            aria-label="Apri la memoria in grande"
                                                            onClick={(e) => { e.stopPropagation(); openEnlarged(summary); }}
                                                        >
                                                            ⛶ Apri
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`summary-share-btn${copiedId === summary.id ? " is-copied" : ""}`}
                                                            title="Copia il link diretto a questa memoria"
                                                            aria-label="Copia il link diretto a questa memoria"
                                                            onClick={(e) => { e.stopPropagation(); copySummaryLink(summary.id); }}
                                                        >
                                                            {copiedId === summary.id ? "✓ Copiato" : "🔗 Link"}
                                                        </button>
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
                                                    className="rs-summary-html"
                                                    onClick={handleLoreClick}
                                                    dangerouslySetInnerHTML={{ __html: linkedContent[summary.id] || summary.content }}
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
                            </div>
                        </section>
                    );
                })
            )}

            {enlarged && (
                <div
                    className="rs-modal-overlay"
                    onClick={() => setEnlargedId(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label={enlarged.title}
                >
                    <div className="rs-modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="rs-modal-close"
                            onClick={() => setEnlargedId(null)}
                            aria-label="Chiudi"
                        >✕</button>

                        <div className="rs-modal-scroll">
                            {enlarged.coverImage && (
                                <div className="rs-modal-cover">
                                    <img
                                        src={enlarged.coverImage}
                                        alt={enlarged.title}
                                        onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }}
                                    />
                                </div>
                            )}
                            <span className="rs-modal-eyebrow">
                                ❦ Cronache di Eldoria{enlarged.party ? ` · Gruppo ${enlarged.party}` : ""}
                            </span>
                            <h2 className="rs-modal-title">{enlarged.title || "Senza titolo"}</h2>
                            {enlarged.date && <p className="rs-modal-date">{enlarged.date}</p>}
                            {enlarged.subTitle && <p className="rs-modal-sub">{enlarged.subTitle}</p>}

                            <div
                                className="rs-summary-html rs-modal-body"
                                onClick={handleLoreClick}
                                dangerouslySetInnerHTML={{ __html: linkedContent[enlarged.id] || enlarged.content }}
                            />

                            {Array.isArray(enlarged.images) && enlarged.images.length > 0 && (
                                <div className="summary-gallery">
                                    {enlarged.images.map((url, i) => (
                                        <a
                                            key={url + i}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="summary-gallery-item"
                                        >
                                            <img
                                                src={url}
                                                alt={`${enlarged.title} — immagine ${i + 1}`}
                                                loading="lazy"
                                                onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }}
                                            />
                                        </a>
                                    ))}
                                </div>
                            )}

                            <div className="rs-modal-foot">
                                <button
                                    type="button"
                                    className={`summary-share-btn${copiedId === enlarged.id ? " is-copied" : ""}`}
                                    onClick={() => copySummaryLink(enlarged.id)}
                                >
                                    {copiedId === enlarged.id ? "✓ Link copiato" : "🔗 Copia link"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {lorePopup && (
                <div
                    className="lore-popup-overlay"
                    onClick={() => setLorePopup(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label={lorePopup.name}
                >
                    <div
                        className={`lore-popup lore-popup--${lorePopup.type}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="lore-popup-close"
                            onClick={() => setLorePopup(null)}
                            aria-label="Chiudi"
                        >✕</button>

                        {lorePopup.image && (
                            <img
                                className="lore-popup-img"
                                src={lorePopup.image}
                                alt={lorePopup.name}
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                        )}

                        <div className="lore-popup-body">
                            <span className="lore-popup-kind">
                                {lorePopup.type === "char" ? "Personaggio"
                                    : lorePopup.type === "npc" ? "Personaggio non giocante"
                                    : "Luogo"}
                            </span>
                            <h3 className="lore-popup-name">{lorePopup.name}</h3>
                            {lorePopup.meta && (
                                <p className="lore-popup-meta">{lorePopup.meta}</p>
                            )}
                            {lorePopup.desc && (
                                <p className="lore-popup-desc">{stripHtml(lorePopup.desc).trim()}</p>
                            )}
                            <button
                                type="button"
                                className="lore-popup-go"
                                onClick={() => { setLorePopup(null); navigate(lorePopup.href); }}
                            >
                                Apri la scheda completa →
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
