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

// Estrae il primo numero da un valore (CA/PF possono essere "15" o "15 (cuoio)").
const numOf = (v) => {
  const m = String(v ?? "").match(/\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

export default function FoundryNpcForm() {
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === MASTER_EMAIL;

  const [npcs, setNpcs] = useState([]);
  const [pending, setPending] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [q, setQ] = useState("");
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

  const pendingIds = useMemo(() => new Set(pending.map((p) => p.sourceNpcId).filter(Boolean)), [pending]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return npcs;
    return npcs.filter((n) =>
      `${n.name} ${n.faction} ${n.location} ${n.linkedCity}`.toLowerCase().includes(s));
  }, [npcs, q]);

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

        {/* Barra selezione */}
        <div className="fdy-import-head" style={{ marginTop: 6 }}>
          <span className="fdy-import-title">👥 Anagrafe NPC</span>
          <span className="fdy-import-count">{filtered.length} · selezionati {sel.size}</span>
        </div>
        <input
          className="npcgen-input"
          placeholder="🔎 Cerca un NPC per nome, fazione o luogo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="dmt-row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button type="button" className="npcgen-btn npcgen-btn--ghost fdy-mini" onClick={selectAll}>Seleziona tutti ({filtered.length})</button>
          <button type="button" className="npcgen-btn npcgen-btn--ghost fdy-mini" onClick={clearSel} disabled={sel.size === 0}>Deseleziona</button>
          <button type="button" className="npcgen-btn" onClick={queueSelected} disabled={busy || sel.size === 0}>
            {busy ? "Invio…" : `📦 Prepara ${sel.size || ""} per Foundry`}
          </button>
        </div>
        <div className={`npcgen-status${msg.startsWith("Errore") ? " npcgen-status--error" : ""}`}>{msg}</div>

        {/* Lista NPC con checkbox */}
        <div className="fdy-import-list" style={{ marginTop: 10 }}>
          {filtered.length === 0 && <p className="npcgen-v">Nessun NPC nell'anagrafe.</p>}
          {filtered.map((n) => {
            const already = pendingIds.has(n.id);
            const checked = sel.has(n.id);
            return (
              <div className="fdy-row" key={n.id} style={checked ? { outline: "2px solid var(--red, #b03030)", outlineOffset: -2 } : {}}>
                <label style={{ display: "flex", alignItems: "center", paddingLeft: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(n.id)} />
                </label>
                <img className="fdy-thumb" src={n.image || "/assets/placeholder.jpg"} alt=""
                  onError={(e) => { e.currentTarget.src = "/assets/placeholder.jpg"; }} />
                <div className="fdy-row-main">
                  <div className="fdy-row-name">{n.name || "(senza nome)"}</div>
                  <div className="fdy-row-meta">
                    {n.faction && <span className="npcgen-chip dmt-pill">{n.faction}</span>}
                    {(n.location || n.linkedCity) && <span className="npcgen-chip dmt-pill">📍 {n.location || n.linkedCity}</span>}
                    <span className="npcgen-chip dmt-pill">CA {numOf(n.statblock?.CA) ?? "—"} · PF {numOf(n.statblock?.PF) ?? "—"}</span>
                    {already && <span className="npcgen-chip dmt-pill" title="Già presente nella coda">⏳ in coda</span>}
                  </div>
                </div>
                <div className="fdy-row-actions">
                  <button type="button" className="npcgen-btn fdy-mini" disabled={busy} onClick={() => queueOne(n)}>
                    📦 Coda
                  </button>
                </div>
              </div>
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
