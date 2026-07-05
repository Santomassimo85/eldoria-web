import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import ToggleSection from "./ToggleSection";
import { useAuth } from "../AuthContext";
import GeoAdmin from "./GeoAdmin";
import { awardPetPoints } from "../utils/pet";
import { buildLoreRegistry, linkifyLoreHtml, norm, firstTok, loreSlug } from "../utils/loreLinks";
import './Geo.css';
import '../styles/cinematic.css';
import useParallaxScroll from '../hooks/useParallaxScroll';
import AmbientFX from '../components/AmbientFX';
import CineToolbar from '../components/CineToolbar';

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/aenlor.png";
const CONTINENT_IMAGES = {
  Vathriddon: "/assets/PhotoStory/GruppoMEAA/bear.png",
  Ehkia: "/assets/PhotoStory/GruppoMEAA/hellhound.png",
  Ohzkie: "/assets/PhotoStory/GruppoLAC/zombie_fungo.png",
};
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
// HTML → testo semplice (per l'anteprima nel popup interattivo)
const stripHtml = (html) => {
  if (!html) return "";
  const tmp = typeof document !== "undefined" ? document.createElement("div") : null;
  if (!tmp) return String(html).replace(/<[^>]*>/g, " ");
  tmp.innerHTML = String(html).replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|div|h[1-6]|li)>/gi, "\n");
  return (tmp.textContent || tmp.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
};

export default function Geo() {
  useParallaxScroll();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingLoc, setEditingLoc] = useState(null);
  const [query, setQuery] = useState("");
  const [activeContinent, setActiveContinent] = useState(null);
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === "santomassimo85@gmail.com";
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const focusSlug = searchParams.get("focus");

  // ── Link interattivi: PG (characters) + NPC (npcs); le città sono i `locations` ──
  const [lore, setLore] = useState({ characters: [], npcs: [] });
  const [lorePopup, setLorePopup] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [charsSnap, npcsSnap] = await Promise.all([
          getDocs(collection(db, "characters")),
          getDocs(collection(db, "npcs")),
        ]);
        if (!alive) return;
        setLore({
          characters: charsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          npcs: npcsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        });
      } catch (_) { /* i link interattivi sono opzionali */ }
    })();
    return () => { alive = false; };
  }, []);

  // Registro dei nomi linkabili (PG, NPC, città = i luoghi dell'Atlante)
  const loreRegistry = useMemo(
    () => buildLoreRegistry({
      characters: lore.characters,
      npcs: lore.npcs,
      cities: locations.map((l) => l.name).filter(Boolean),
    }),
    [lore, locations]
  );

  // "chiave normalizzata" → dettagli mostrati nel popup interno
  const loreDetails = useMemo(() => {
    const map = new Map();
    const put = (key, data) => { if (key && !map.has(key)) map.set(key, data); };
    for (const c of lore.characters) {
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
    for (const n of lore.npcs) {
      if (!n?.name) continue;
      put(norm(n.name), {
        type: "npc", name: n.name,
        image: n.image || "/assets/player/default.png",
        meta: [n.faction, n.location].filter(Boolean).join(" · "),
        desc: n.description || "",
        href: `/npc?focus=${loreSlug(n.name)}`,
      });
    }
    for (const g of locations) {
      if (!g?.name) continue;
      put(norm(g.name), {
        type: "city", name: g.name,
        image: g.image || "",
        meta: g.continent || "",
        desc: g.description || "",
        href: `/Geo?focus=${loreSlug(g.name)}`,
      });
    }
    return map;
  }, [lore, locations]);

  // Click su un link interattivo → apre il popup sulla pagina (o naviga)
  const handleLoreClick = (e) => {
    const a = e.target.closest("a[data-lore]");
    if (!a) return;
    e.preventDefault();
    const key = a.getAttribute("data-key");
    const detail = key && loreDetails.get(key);
    if (detail) { setLorePopup(detail); return; }
    const href = a.getAttribute("data-href");
    if (href) navigate(href);
  };

  // chiusura popup con Esc
  useEffect(() => {
    if (!lorePopup) return;
    const onKey = (e) => { if (e.key === "Escape") setLorePopup(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lorePopup]);

  // Arrivo da un link interattivo (?focus=<slug>): scorri ed evidenzia il luogo
  useEffect(() => {
    if (!focusSlug || locations.length === 0) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`geo-card-${focusSlug}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("geo-card--focus");
      setTimeout(() => el.classList.remove("geo-card--focus"), 2800);
    }, 200);
    return () => clearTimeout(t);
  }, [focusSlug, locations]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "geo_archive"), (snap) => {
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 🐣 pet system: +1 point per day for opening the Geo archive
  useEffect(() => {
    if (currentUser?.uid) awardPetPoints(currentUser.uid, "geo_visit");
  }, [currentUser]);

  if (loading) {
    return (
      <section className="cine-page geo-page" style={{ "--cine-accent": "#1f8a6a", "--cine-accent-2": "#2fb088" }}>
        <div className="geo-loading">
          <span className="geo-loading-icon">🗺️</span>
          Consultando le mappe antiche…
        </div>
      </section>
    );
  }

  const continents = ["Vathriddon", "Ehkia", "Ohzkie"];
  const locsOf = (c) => locations.filter(
    l => l.continent === c || (c === "Vathriddon" && !l.continent)
  );
  const activeContinents = continents.filter(c => locsOf(c).length > 0);

  // ── Export TXT (solo master) ──────────────────────────────────────────
  const downloadTxt = (filename, text) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // converte l'HTML della descrizione in testo semplice leggibile
  const htmlToText = (html) => {
    if (!html) return "";
    const withBreaks = String(html)
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|ul|ol)>/gi, "\n")
      .replace(/<\s*li[^>]*>/gi, "• ");
    const tmp = document.createElement("div");
    tmp.innerHTML = withBreaks;
    return (tmp.textContent || tmp.innerText || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  // 1) Solo i nomi dei luoghi raggruppati per continente
  const exportLocationsTxt = () => {
    const lines = [];
    lines.push("ARCHIVIO GEOMANTICO — Luoghi per continente");
    lines.push(`Totale luoghi: ${locations.length}`);
    lines.push("");
    activeContinents.forEach((cont) => {
      const list = locsOf(cont)
        .map((l) => l.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "it"));
      lines.push(`=== ${cont} (${list.length}) ===`);
      list.forEach((name) => lines.push(`- ${name}`));
      lines.push("");
    });
    downloadTxt("luoghi_per_continente.txt", lines.join("\n"));
  };

  // 2) Luoghi CON descrizioni, città per città, raggruppati per continente
  const exportLocationsFullTxt = () => {
    const lines = [];
    lines.push("ARCHIVIO GEOMANTICO — Luoghi e descrizioni per continente");
    lines.push(`Totale luoghi: ${locations.length}`);
    lines.push("");
    activeContinents.forEach((cont) => {
      const list = locsOf(cont)
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "it"));
      lines.push(`==================================================`);
      lines.push(`CONTINENTE: ${cont} (${list.length})`);
      lines.push(`==================================================`);
      lines.push("");
      list.forEach((loc) => {
        lines.push(`### ${loc.name || "(senza nome)"}`);
        const desc = htmlToText(loc.description);
        lines.push(desc || "(nessuna descrizione)");
        lines.push("");
        lines.push("--------------------------------------------------");
        lines.push("");
      });
    });
    downloadTxt("luoghi_descrizioni_per_continente.txt", lines.join("\n"));
  };

  // ── Ricerca: nome luogo / continente / descrizione + filtro continente ──
  const q = query.trim().toLowerCase();
  const matchesLoc = (loc, cont) => {
    if (!q) return true;
    const hay = [loc.name, loc.continent || cont, loc.description]
      .filter(Boolean).join(" ").toLowerCase().replace(/<[^>]*>/g, " ");
    return hay.includes(q);
  };
  const visibleContinents = activeContinents
    .map(cont => ({ cont, list: locsOf(cont).filter(l => matchesLoc(l, cont)) }))
    .filter(({ cont, list }) => (activeContinent == null || activeContinent === cont) && list.length > 0);
  const visibleCount = visibleContinents.reduce((n, c) => n + c.list.length, 0);

  return (
    <section className="cine-page geo-page cine-compact" style={{ "--cine-accent": "#1f8a6a", "--cine-accent-2": "#2fb088" }}>
      <AmbientFX variant="cosmos" />

      {/* ── HERO ASIMMETRICO: immagine full-bleed + placca-registro a sinistra ── */}
      <section id="geo-top" className="geo-hero" aria-label="Archivio Geomantico">
        <div className="geo-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
        <div className="geo-hero-wash" aria-hidden="true" />
        <div className="geo-hero-plate">
          <span className="geo-hero-seal">✦ Atlante Geomantico</span>
          <h1 className="geo-hero-title">Archivio<br />Geomantico</h1>
          <p className="geo-hero-tagline">
            Continenti, regni e rovine: ogni luogo che le cronache hanno cartografato.
          </p>
          <dl className="geo-hero-stats">
            <div><dt>Luoghi</dt><dd>{locations.length}</dd></div>
            <div><dt>{activeContinents.length === 1 ? "Continente" : "Continenti"}</dt><dd>{activeContinents.length}</dd></div>
          </dl>
          {isMaster && locations.length > 0 && (
            <div className="geo-export-row">
              <button type="button" className="geo-export-btn" onClick={exportLocationsTxt}>
                ⬇ Esporta luoghi (.txt)
              </button>
              <button
                type="button"
                className="geo-export-btn geo-export-btn--alt"
                onClick={exportLocationsFullTxt}
                title="Esporta nomi e descrizioni, città per città"
              >
                📝 + descrizioni
              </button>
            </div>
          )}
        </div>
        <a href="#geo-index" className="geo-hero-scroll" aria-label="Scorri all'atlante">
          <span className="geo-hero-scroll-tx">Scorri</span>
          <span className="geo-hero-scroll-ic" aria-hidden="true">↓</span>
        </a>
      </section>

      {/* ── INDICE DEI CONTINENTI: sigilli inline (sostituisce il rail flottante) ── */}
      {activeContinents.length > 0 && (
        <div id="geo-index" className="geo-index">
          <span className="geo-index-eyebrow">Indice · Le Terre di Exanthia</span>
          <div className="geo-index-sigils">
            {activeContinents.map((c, i) => (
              <a key={c} href={`#geo-${slugify(c)}`} className="geo-sigil" data-accent={i % 3}>
                <span className="geo-sigil-crest" aria-hidden="true">🌍</span>
                <span className="geo-sigil-label">{c}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── RICERCA ── */}
      {locations.length > 0 && (
        <CineToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Cerca per luogo, continente o parola…"
          chips={activeContinents.map((c) => ({ key: c, label: c }))}
          activeChip={activeContinent}
          onChip={setActiveContinent}
          allLabel="Tutti i continenti"
          count={visibleCount}
          countNoun={visibleCount === 1 ? "luogo" : "luoghi"}
        />
      )}

      {/* ---- MODAL MODIFICA RAPIDA ---- */}
      {editingLoc && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(255,255,255,0.85)", zIndex: 9999,
          overflowY: "auto", padding: "20px"
        }}>
          <div style={{
            backgroundColor: "#ffffffee", padding: "24px", borderRadius: "12px",
            maxWidth: "800px", margin: "0 auto",
            border: "1.5px solid rgba(212,175,55,0.3)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.1)"
          }}>
            <button
              onClick={() => setEditingLoc(null)}
              style={{
                float: "right", background: "var(--red)", color: "white",
                border: "none", padding: "6px 14px", cursor: "pointer",
                borderRadius: "6px", fontWeight: "bold"
              }}
            >
              ✕ Chiudi
            </button>
            <h2 style={{ color: "var(--red)", fontFamily: "var(--font-title)", marginBottom: "16px" }}>
              Modifica — {editingLoc.name}
            </h2>
            <GeoAdmin editTarget={editingLoc} onComplete={() => setEditingLoc(null)} />
          </div>
        </div>
      )}

      {/* ---- NESSUN RISULTATO ---- */}
      {locations.length > 0 && visibleContinents.length === 0 && (
        <p className="cine-empty">Nessun luogo corrisponde alla ricerca.</p>
      )}

      {/* ---- CONTINENTI ---- */}
      {visibleContinents.map(({ cont: contName, list: locationsInContinent }, ci) => {
        return (
          <section
            key={contName}
            id={`geo-${slugify(contName)}`}
            className="continent-wrapper"
            data-accent={ci % 3}
            aria-label={contName}
          >
            {/* marginalia sticky del continente */}
            <aside className="geo-cont-aside">
              <span className="geo-cont-seal" aria-hidden="true">
                <img src={CONTINENT_IMAGES[contName] || HERO_IMAGE} alt=""
                     onError={(e) => { e.currentTarget.style.display = "none"; }} />
              </span>
              <span className="geo-cont-eyebrow">Continente</span>
              <h2 className="geo-cont-name">{contName}</h2>
              <span className="geo-cont-chip">
                {locationsInContinent.length} {locationsInContinent.length === 1 ? "luogo cartografato" : "luoghi cartografati"}
              </span>
            </aside>

            {/* carte d'atlante (accordion) */}
            <div className="geo-grid">
              {locationsInContinent.map((loc) => (
                <div key={loc.id} id={`geo-card-${slugify(loc.name)}`} className="geo-card-wrapper">
                  <ToggleSection
                    title={loc.name}
                    defaultOpen={!!focusSlug && slugify(loc.name) === focusSlug}
                    staticContent={loc.image && (
                      <img src={loc.image} alt={loc.name} className="geo-card-preview" />
                    )}
                  >
                    {isMaster && (
                      <button
                        className="geo-edit-btn"
                        onClick={() => setEditingLoc(loc)}
                      >
                        ⚙️ Modifica Luogo
                      </button>
                    )}
                    <div
                      className="geo-description"
                      onClick={handleLoreClick}
                      dangerouslySetInnerHTML={{ __html: linkifyLoreHtml(loc.description, loreRegistry) }}
                    />
                  </ToggleSection>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* ── Popup interattivo: dettaglio PG / NPC / città senza lasciare la pagina ── */}
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
