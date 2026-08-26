// src/pages/RiassuntoSingolo.jsx
// Pagina a sé per UNA singola memoria, raggiungibile via /riassunto/:id.
// NON è linkata dal menu: serve a condividere un riassunto specifico coi player.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, increment, collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { awardPetPoints } from '../utils/pet';
import { buildLoreRegistry, linkifyLoreHtml, norm, firstTok } from '../utils/loreLinks';
import GlacierHero from "../components/glacier/GlacierHero";
import './Riassunti.css';
import './RiassuntoSingolo.css';

const MASTER_EMAIL = "santomassimo85@gmail.com";

const slugify = (s) =>
    String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const stripHtml = (html) =>
    String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ");

// Le memorie contengono <img> con src RELATIVI (es. "assets/...").
// Su /riassunto/:id (due segmenti di path) un src relativo verrebbe risolto
// sotto /riassunto/ e l'immagine si rompe: qui lo riportiamo alla radice.
const absolutizeAssets = (html) =>
    String(html ?? "").replace(
        /(<(?:img|source)\b[^>]*?\bsrc=)(["'])(?!https?:|data:|blob:|\/|#)([^"']*)\2/gi,
        (_m, pre, q, url) => `${pre}${q}/${url}${q}`
    );

export default function RiassuntoSingolo() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const isMaster = currentUser?.email === MASTER_EMAIL;

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [copied, setCopied] = useState(false);
    const [loreData, setLoreData] = useState({ characters: [], npcs: [], geo: [] });
    const [lorePopup, setLorePopup] = useState(null);
    const counted = useRef(false);

    // --- Carica la singola memoria + conta la visita una sola volta ---
    useEffect(() => {
        let alive = true;
        setLoading(true); setNotFound(false); setSummary(null); counted.current = false;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'summaries', id));
                if (!alive) return;
                if (!snap.exists()) { setNotFound(true); return; }
                const data = { id: snap.id, ...snap.data() };
                setSummary(data);
                // Conta la lettura (come nella lista): salta il master.
                if (!isMaster && !counted.current) {
                    counted.current = true;
                    updateDoc(doc(db, 'summaries', id), { viewCount: increment(1) }).catch(() => {});
                    if (currentUser?.uid) awardPetPoints(currentUser.uid, "summary_read", { resourceKey: id });
                }
            } catch (_) {
                if (alive) setNotFound(true);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [id, isMaster, currentUser?.uid]);

    // --- Dati per i link interattivi: PG / NPC / città ---
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
                setLoreData({
                    characters: charsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                    npcs: npcsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                    geo: geoSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                });
            } catch (_) { /* link interattivi opzionali */ }
        })();
        return () => { alive = false; };
    }, []);

    const loreRegistry = useMemo(
        () => buildLoreRegistry({
            characters: loreData.characters,
            npcs: loreData.npcs,
            cities: loreData.geo.map(g => g.name).filter(Boolean),
        }),
        [loreData]
    );

    const loreDetails = useMemo(() => {
        const map = new Map();
        const put = (key, data) => { if (key && !map.has(key)) map.set(key, data); };
        for (const c of loreData.characters) {
            if (!c?.name) continue;
            const tok = firstTok(c.name);
            const meta = [c.race, c.class].filter(Boolean).join(" · ");
            const data = {
                type: "char", name: c.name,
                image: c.image || "/assets/player/default.png",
                meta: c.level ? `${meta}${meta ? " · " : ""}Liv. ${c.level}` : meta,
                desc: c.background || "",
                href: `/party?hero=${encodeURIComponent(tok)}`,
            };
            put(norm(c.name), data); put(norm(tok), data);
        }
        for (const n of loreData.npcs) {
            if (!n?.name) continue;
            put(norm(n.name), {
                type: "npc", name: n.name,
                image: n.image || "/assets/player/default.png",
                meta: [n.faction, n.location].filter(Boolean).join(" · "),
                desc: n.description || "",
                href: `/npc?focus=${slugify(n.name)}`,
            });
        }
        for (const g of loreData.geo) {
            if (!g?.name) continue;
            put(norm(g.name), {
                type: "city", name: g.name,
                image: g.image || "", meta: g.continent || "",
                desc: g.description || "",
                href: `/Geo?focus=${slugify(g.name)}`,
            });
        }
        return map;
    }, [loreData]);

    const linkedHtml = useMemo(() => {
        if (!summary?.content) return "";
        const base = loreRegistry.regex
            ? linkifyLoreHtml(summary.content, loreRegistry)
            : summary.content;
        return absolutizeAssets(base);
    }, [summary, loreRegistry]);

    const handleLoreClick = (e) => {
        const a = e.target.closest('a[data-lore]');
        if (!a) return;
        e.preventDefault();
        const key = a.getAttribute('data-key');
        const detail = key && loreDetails.get(key);
        if (detail) { setLorePopup(detail); return; }
        const href = a.getAttribute('data-href');
        if (href) navigate(href);
    };

    useEffect(() => {
        if (!lorePopup) return;
        const onKey = (e) => { if (e.key === "Escape") setLorePopup(null); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [lorePopup]);

    const copyLink = async () => {
        const url = window.location.href;
        try { await navigator.clipboard.writeText(url); }
        catch (_) { window.prompt("Copia il link a questa memoria:", url); return; }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    if (loading) {
        return (
            <section className="riassunti-page">
                <div className="riassunti-loading">
                    <span className="riassunti-loading-icon">📜</span>
                    Caricamento memoria…
                </div>
            </section>
        );
    }

    if (notFound || !summary) {
        return (
            <section className="rsx-page">
                <div className="rsx-missing">
                    <span className="rsx-missing-seal" aria-hidden="true">❦</span>
                    <h1>Memoria non trovata</h1>
                    <p>Questa cronaca non esiste più o il link non è corretto.</p>
                    <Link to="/riassunti" className="rsx-back-btn">← Tutte le memorie</Link>
                </div>
            </section>
        );
    }

    return (
        <section className="rsx-page">
            <article className="rsx-scroll">
                <div className="rsx-topbar">
                    <Link to="/riassunti" className="rsx-back">← Tutte le memorie</Link>
                    <button
                        type="button"
                        className={`rsx-share${copied ? " is-copied" : ""}`}
                        onClick={copyLink}
                        title="Copia il link a questa memoria"
                    >
                        {copied ? "✓ Copiato" : "🔗 Copia link"}
                    </button>
                </div>

                {/* ── Testata = FINESTRA ARTICA (GlacierHero) con la copertina
                      dinamica della memoria (arco d'abisso se assente) ── */}
                <GlacierHero
                    className="rsx-glhero"
                    ariaLabel={summary.title || "Memoria"}
                    image={summary.coverImage || undefined}
                    eyebrow={`Cronache di Eldoria${summary.party ? ` · Gruppo ${summary.party}` : ""}`}
                    title={summary.title || "Senza titolo"}
                    seal={summary.date || undefined}
                    tagline={summary.subTitle || undefined}
                >
                    {isMaster && (
                        <span className="rsx-visits" title="Visite totali">👁 {summary.viewCount || 0}</span>
                    )}
                </GlacierHero>

                <div
                    className="rs-summary-html rsx-body"
                    onClick={handleLoreClick}
                    dangerouslySetInnerHTML={{ __html: linkedHtml || summary.content }}
                />

                {Array.isArray(summary.images) && summary.images.length > 0 && (
                    <div className="summary-gallery rsx-gallery">
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

                <div className="rsx-foot">
                    <Link to="/riassunti" className="rsx-back-btn">← Torna a tutte le memorie</Link>
                </div>
            </article>

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
                            {lorePopup.meta && <p className="lore-popup-meta">{lorePopup.meta}</p>}
                            {lorePopup.desc && <p className="lore-popup-desc">{stripHtml(lorePopup.desc).trim()}</p>}
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
