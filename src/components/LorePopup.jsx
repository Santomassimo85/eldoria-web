// Popup di PG / NPC / luoghi per le sessioni del Generatore (dettaglio e
// anteprima). Le sessioni stanno in un iframe: il runtime iniettato
// (utils/sessionRuntime.js) intercetta il clic su a[data-lore] e manda alla
// pagina un postMessage {type: "crit-lore", key, href, text}; qui lo si
// ascolta e si apre lo STESSO popup dei riassunti (classi .lore-popup di
// Riassunti.css), senza lasciare la pagina.
import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { norm, firstTok, loreSlug } from "../utils/loreLinks";
import "../pages/Riassunti.css";

const stripHtml = (html) => String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();

// Dettagli per chiave normalizzata (nome intero e, per i PG, primo nome).
function useLoreDetails() {
  const [data, setData] = useState({ characters: [], npcs: [], geo: [] });
  useEffect(() => {
    let alive = true;
    const list = (p) => p.then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []);
    Promise.all([
      list(getDocs(collection(db, "characters"))),
      list(getDocs(collection(db, "npcs"))),
      list(getDocs(collection(db, "geo_archive"))),
    ]).then(([characters, npcs, geo]) => { if (alive) setData({ characters, npcs, geo }); });
    return () => { alive = false; };
  }, []);
  return useMemo(() => {
    const map = new Map();
    const put = (key, d) => { if (key && !map.has(key)) map.set(key, d); };
    for (const c of data.characters) {
      if (!c?.name) continue;
      const tok = firstTok(c.name);
      const meta = [c.race, c.class].filter(Boolean).join(" · ");
      const d = {
        type: "char", name: c.name, image: c.image || "/assets/player/default.png",
        meta: c.level ? `${meta}${meta ? " · " : ""}Liv. ${c.level}` : meta,
        desc: c.background || "", href: `/party?hero=${encodeURIComponent(tok)}`,
      };
      put(norm(c.name), d); put(norm(tok), d);
    }
    for (const n of data.npcs) {
      if (!n?.name) continue;
      put(norm(n.name), {
        type: "npc", name: n.name, image: n.image || "/assets/player/default.png",
        meta: [n.faction, n.location].filter(Boolean).join(" · "),
        desc: n.description || "", href: `/npc?focus=${loreSlug(n.name)}`,
      });
    }
    for (const g of data.geo) {
      if (!g?.name) continue;
      put(norm(g.name), {
        type: "city", name: g.name, image: g.image || "", meta: g.continent || "",
        desc: g.description || "", href: `/Geo?focus=${loreSlug(g.name)}`,
      });
    }
    return map;
  }, [data]);
}

// Ascolta i clic dei link dentro l'iframe della sessione e mostra il popup.
export default function SessionLorePopup() {
  const details = useLoreDetails();
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    const onMsg = (e) => {
      const m = e.data;
      if (!m || m.type !== "crit-lore") return;
      const found = details.get(m.key) || details.get(norm(m.text || ""));
      const type = String(m.href || "").startsWith("/npc") ? "npc" : String(m.href || "").startsWith("/Geo") ? "city" : "char";
      setPopup(found || { type, name: m.text || "", href: m.href || "/" });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [details]);

  useEffect(() => {
    if (!popup) return;
    const onKey = (e) => { if (e.key === "Escape") setPopup(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popup]);

  if (!popup) return null;
  return (
    <div className="lore-popup-overlay" onClick={() => setPopup(null)} role="dialog" aria-modal="true" aria-label={popup.name}>
      <div className={`lore-popup lore-popup--${popup.type}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="lore-popup-close" onClick={() => setPopup(null)} aria-label="Chiudi">✕</button>
        {popup.image && (
          <img className="lore-popup-img" src={popup.image} alt={popup.name}
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <div className="lore-popup-body">
          <span className="lore-popup-kind">
            {popup.type === "char" ? "Personaggio" : popup.type === "npc" ? "Personaggio non giocante" : "Luogo"}
          </span>
          <h3 className="lore-popup-name">{popup.name}</h3>
          {popup.meta && <p className="lore-popup-meta">{popup.meta}</p>}
          {popup.desc && <p className="lore-popup-desc">{stripHtml(popup.desc)}</p>}
          {/* La scheda completa si apre a parte: la sessione resta aperta qui. */}
          <a className="lore-popup-go" href={popup.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            Apri la scheda completa ↗
          </a>
        </div>
      </div>
    </div>
  );
}
