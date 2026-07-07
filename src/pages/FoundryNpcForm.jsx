import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import {
  collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import "../GeneraNPC.css";
import "./DmTools.css";
import "./admin.css";

/* ============================================================
   Prepara NPC → Foundry
   Master-only. Seleziona uno/più/tutti gli NPC dell'anagrafe e li
   mette in coda in `foundry_npc_inbox` (stato "pending"). Poi la
   MACRO NPC su Foundry li legge e li crea come Attori type "npc".
   Vedi src/foundry-macro-create-npcs.txt per la macro da incollare.
   Coda separata da quella oggetti (foundry_inbox) apposta.
   ============================================================ */

const MASTER_EMAIL = "santomassimo85@gmail.com";
// Il co-master può usare l'invio a Foundry (le rules lo consentono già: isMaster()).
const CO_MASTER_EMAIL = "ripperti96@gmail.com";

// Estrae il primo numero da un valore (CA/PF possono essere "15" o "15 (cuoio)").
const numOf = (v) => {
  const m = String(v ?? "").match(/\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

// Continenti del mondo (i luoghi senza `continent` sono Vathriddon, come nell'Atlante).
const CONTINENTS = ["Vathriddon", "Ehkia", "Ohzkie"];
const OTHER = "Altrove";
const norm = (s) => String(s ?? "").trim().toLowerCase();
const cityOf = (n) => String(n.location || n.linkedCity || "").trim();

export default function FoundryNpcForm() {
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === MASTER_EMAIL || currentUser?.email === CO_MASTER_EMAIL;

  const [npcs, setNpcs] = useState([]);
  const [pending, setPending] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [continent, setContinent] = useState(null); // null = tutti
  const [city, setCity] = useState(null);            // null = tutte
  const [places, setPlaces] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Anagrafe NPC (live).
  useEffect(() => {
    if (!isMaster) return;
    const unsub = onSnapshot(collection(db, "npcs"), (snap) => {
      setNpcs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))));
    });
    return () => unsub();
  }, [isMaster]);

  // Coda NPC verso Foundry (live).
  useEffect(() => {
    if (!isMaster) return;
    const unsub = onSnapshot(query(collection(db, "foundry_npc_inbox"), orderBy("createdAt", "desc")), (snap) => {
      setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isMaster]);

  // Luoghi dell'Atlante (live): servono per mappare città → continente.
  useEffect(() => {
    if (!isMaster) return;
    const unsub = onSnapshot(collection(db, "geo_archive"), (snap) => {
      setPlaces(snap.docs.map((d) => d.data()));
    });
    return () => unsub();
  }, [isMaster]);

  const pendingIds = useMemo(() => new Set(pending.map((p) => p.sourceNpcId).filter(Boolean)), [pending]);

  // Mappa città (normalizzata) → continente. I luoghi senza continente = Vathriddon.
  const cityToContinent = useMemo(() => {
    const m = new Map();
    for (const g of places) {
      if (!g?.name) continue;
      m.set(norm(g.name), g.continent || "Vathriddon");
    }
    return m;
  }, [places]);

  const continentOf = useMemo(() => (n) => {
    const c = cityOf(n);
    if (!c) return OTHER;
    return cityToContinent.get(norm(c)) || OTHER;
  }, [cityToContinent]);

  // Continenti effettivamente presenti tra gli NPC, con conteggio (per le chip).
  const continentChips = useMemo(() => {
    const count = {};
    for (const n of npcs) { const c = continentOf(n); count[c] = (count[c] || 0) + 1; }
    const ordered = [...CONTINENTS, OTHER].filter((c) => count[c]);
    return ordered.map((c) => ({ key: c, n: count[c] }));
  }, [npcs, continentOf]);

  // Città disponibili nella select (rispettano il continente scelto).
  const cityOptions = useMemo(() => {
    const count = new Map();
    for (const n of npcs) {
      if (continent && continentOf(n) !== continent) continue;
      const c = cityOf(n); if (!c) continue;
      count.set(c, (count.get(c) || 0) + 1);
    }
    return [...count.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [npcs, continent, continentOf]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return npcs.filter((n) => {
      if (continent && continentOf(n) !== continent) return false;
      if (city && norm(cityOf(n)) !== norm(city)) return false;
      if (s && !`${n.name} ${n.faction} ${n.location} ${n.linkedCity}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [npcs, q, continent, city, continentOf]);

  // NPC filtrati raggruppati per città (organizzazione visiva).
  const groups = useMemo(() => {
    const m = new Map();
    for (const n of filtered) {
      const c = cityOf(n) || "— Senza luogo —";
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(n);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (!isMaster) {
    return <div className="npcgen-page"><div className="npcgen-inner"><h1 className="npcgen-title">Riservato al Master</h1></div></div>;
  }

  const toggle = (id) => setSel((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const selectAll = () => setSel(new Set(filtered.map((n) => n.id)));
  const clearSel = () => setSel(new Set());
  const selectCity = (list) => setSel((prev) => {
    const next = new Set(prev);
    list.forEach((n) => next.add(n.id));
    return next;
  });
  const setContinentFilter = (c) => { setContinent(c); setCity(null); };
  const resetFilters = () => { setContinent(null); setCity(null); setQ(""); };

  const buildPayload = (n) => ({
    status: "pending",
    kind: "npc",
    name: n.name || "NPC",
    img: n.image || "",
    ac: numOf(n.statblock?.CA),
    hp: numOf(n.statblock?.PF),
    saves: n.statblock?.tiri_salvezza || "",
    action: n.statblock?.azione || "",
    biography: n.description || "",
    faction: n.faction || "",
    location: n.location || n.linkedCity || "",
    sourceNpcId: n.id,
    target: "world",
    createdAt: serverTimestamp(),
    createdBy: currentUser.email,
  });

  const queueSelected = async () => {
    const chosen = filtered.filter((n) => sel.has(n.id));
    if (!chosen.length) { setMsg("Errore: seleziona almeno un NPC."); return; }
    setBusy(true); setMsg(`Invio ${chosen.length} NPC in coda…`);
    try {
      let ok = 0;
      for (const n of chosen) {
        try { await addDoc(collection(db, "foundry_npc_inbox"), buildPayload(n)); ok++; }
        catch (e) { console.error("Coda NPC fallita:", n.name, e); }
      }
      setMsg(`✅ ${ok} NPC in coda! Lancia la macro NPC su Foundry per crearli.`);
      clearSel();
    } catch (e) {
      setMsg("Errore: " + (e.message || e));
    } finally { setBusy(false); }
  };

  const queueOne = async (n) => {
    setBusy(true); setMsg(`Invio "${n.name}" in coda…`);
    try {
      await addDoc(collection(db, "foundry_npc_inbox"), buildPayload(n));
      setMsg(`✅ "${n.name}" in coda!`);
    } catch (e) {
      setMsg("Errore: " + (e.message || e));
    } finally { setBusy(false); }
  };

  const removePending = async (id) => {
    try { await deleteDoc(doc(db, "foundry_npc_inbox", id)); } catch { /* noop */ }
  };

  return (
    <div className="npcgen-page">
      <div className="npcgen-inner">
        <Link to="/dm-admin" className="adm-back">← Console del Master</Link>
        <h1 className="npcgen-title">Prepara NPC → Foundry</h1>
        <p className="npcgen-sub">
          Seleziona uno, più o tutti gli NPC dell'anagrafe e mettili in coda: poi lancia la
          macro NPC su Foundry per crearli come Attori (non giocanti).
        </p>

        {/* Intestazione + conteggio */}
        <div className="fdy-import-head" style={{ marginTop: 6 }}>
          <span className="fdy-import-title">👥 Anagrafe NPC</span>
          <span className="fdy-import-count">{filtered.length} di {npcs.length} · selezionati {sel.size}</span>
        </div>

        {/* Toolbar filtri: ricerca · continente · città */}
        <div className="fdy-filters">
          <input
            className="npcgen-input fdy-search"
            placeholder="🔎 Cerca per nome, fazione o luogo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="fdy-chips" role="group" aria-label="Filtro per continente">
            <button type="button" className={`fdy-chip${continent == null ? " is-on" : ""}`} onClick={() => setContinentFilter(null)}>
              🌍 Tutti <span className="fdy-chip-n">{npcs.length}</span>
            </button>
            {continentChips.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`fdy-chip${continent === c.key ? " is-on" : ""}`}
                onClick={() => setContinentFilter(continent === c.key ? null : c.key)}
              >
                {c.key} <span className="fdy-chip-n">{c.n}</span>
              </button>
            ))}
          </div>
          <div className="fdy-filter-right">
            <select
              className="fdy-select"
              value={city || ""}
              onChange={(e) => setCity(e.target.value || null)}
              aria-label="Filtro per città"
            >
              <option value="">🏙️ Tutte le città{cityOptions.length ? ` (${cityOptions.length})` : ""}</option>
              {cityOptions.map(([name, n]) => (
                <option key={name} value={name}>{name} ({n})</option>
              ))}
            </select>
            {(continent || city || q) && (
              <button type="button" className="fdy-clear" onClick={resetFilters}>✕ Azzera</button>
            )}
          </div>
        </div>

        {/* Azioni di selezione */}
        <div className="dmt-row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button type="button" className="npcgen-btn npcgen-btn--ghost fdy-mini" onClick={selectAll} disabled={filtered.length === 0}>Seleziona tutti ({filtered.length})</button>
          <button type="button" className="npcgen-btn npcgen-btn--ghost fdy-mini" onClick={clearSel} disabled={sel.size === 0}>Deseleziona</button>
          <button type="button" className="npcgen-btn" onClick={queueSelected} disabled={busy || sel.size === 0}>
            {busy ? "Invio…" : `📦 Prepara ${sel.size || ""} per Foundry`}
          </button>
        </div>
        <div className={`npcgen-status${msg.startsWith("Errore") ? " npcgen-status--error" : ""}`}>{msg}</div>

        {/* NPC raggruppati per città, in griglia di card */}
        <div className="fdy-npc-groups">
          {npcs.length === 0 && <p className="npcgen-v">Nessun NPC nell'anagrafe.</p>}
          {npcs.length > 0 && filtered.length === 0 && <p className="npcgen-v">Nessun NPC corrisponde ai filtri.</p>}
          {groups.map(([cityName, list]) => {
            const cont = list[0] ? continentOf(list[0]) : OTHER;
            return (
              <section className="fdy-npc-group" key={cityName}>
                <header className="fdy-npc-grouphead">
                  <span className="fdy-npc-city">📍 {cityName}</span>
                  <span className="fdy-npc-cont">{cont}</span>
                  <span className="fdy-npc-gcount">{list.length}</span>
                  <button type="button" className="npcgen-btn npcgen-btn--ghost fdy-mini fdy-npc-selcity" onClick={() => selectCity(list)}>
                    Seleziona città
                  </button>
                </header>
                <div className="fdy-npc-grid">
                  {list.map((n) => {
                    const already = pendingIds.has(n.id);
                    const checked = sel.has(n.id);
                    return (
                      <div
                        className={`fdy-npc-card${checked ? " is-checked" : ""}`}
                        key={n.id}
                        onClick={() => toggle(n.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(n.id); } }}
                      >
                        <input
                          type="checkbox"
                          className="fdy-npc-check"
                          checked={checked}
                          onChange={() => toggle(n.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Seleziona ${n.name || "NPC"}`}
                        />
                        <img
                          className="fdy-npc-img"
                          src={n.image || "/assets/placeholder.jpg"}
                          alt=""
                          onError={(e) => { e.currentTarget.src = "/assets/placeholder.jpg"; }}
                        />
                        <div className="fdy-npc-body">
                          <div className="fdy-npc-name">{n.name || "(senza nome)"}</div>
                          <div className="fdy-npc-meta">
                            {n.faction && <span className="npcgen-chip dmt-pill">{n.faction}</span>}
                            <span className="npcgen-chip dmt-pill">CA {numOf(n.statblock?.CA) ?? "—"} · PF {numOf(n.statblock?.PF) ?? "—"}</span>
                            {already && <span className="npcgen-chip dmt-pill" title="Già presente nella coda">⏳ in coda</span>}
                          </div>
                          <button
                            type="button"
                            className="npcgen-btn fdy-mini fdy-npc-queue"
                            disabled={busy}
                            onClick={(e) => { e.stopPropagation(); queueOne(n); }}
                          >
                            📦 Coda
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Coda verso Foundry */}
        <div className="dmt-result">
          <p className="npcgen-k">In coda per Foundry ({pending.length})</p>
          {pending.length === 0 && <p className="npcgen-v">Nessun NPC in coda. Quelli importati su Foundry vengono rimossi dalla macro.</p>}
          {pending.map((p) => (
            <div className="dmt-li" key={p.id}>
              <div className="n">
                {p.name}
                <span className="npcgen-chip dmt-pill">NPC</span>
                <span className="npcgen-chip dmt-pill">{p.status === "imported" ? "✅ importato" : "⏳ in attesa"}</span>
              </div>
              <div className="d">
                CA {p.ac ?? "—"} · PF {p.hp ?? "—"}
                <button className="npcgen-btn npcgen-btn--ghost" style={{ marginLeft: 10, padding: "2px 10px", fontSize: 12 }} onClick={() => removePending(p.id)}>Elimina</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
