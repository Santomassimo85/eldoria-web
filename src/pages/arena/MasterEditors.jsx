// Editor del Master: titoli e monete.
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.
import { db } from "../../firebase";
import { collection, doc, getDocs, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { ARENA_TITLES, getCharTitles, getSnapTitles } from "./arenaRules";

// ── MASTER TITLE EDITOR ──────────────────────────────────────────────────────
// Persistente: i titoli POSSEDUTI vivono sul documento `characters/{uid}.arenaTitles`
// e restano per sempre, anche dopo reset/fine torneo. Il titolo INDOSSATO (uno solo)
// nel torneo in corso vive sullo snapshot `characterSnapshots.{uid}.titles` e di norma
// lo sceglie il giocatore all'iscrizione; il Master può impostarlo qui se uno se ne dimentica.
export function MasterTitleEditor({ forceOpen = false, snapshots = {} } = {}) {
  /* FIX: P5c — forceOpen makes this render its body unconditionally
     (used when wrapped in ArenaModal). The legacy toggle remains
     when forceOpen is false. */
  const [openState, setOpen]    = useState(false);
  const open                    = forceOpen || openState;
  const [allChars, setAllChars] = useState([]);
  const [filter, setFilter]     = useState("");

  useEffect(() => {
    if (!open) return;
    const unsub = onSnapshot(collection(db, "characters"), snap => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setAllChars(list);
    });
    return () => unsub();
  }, [open]);

  // Gestione del POSSESSO (pool di titoli del personaggio). Non forza più l'indossato:
  // il titolo indossato nello snapshot viene solo "ripulito" se non è più posseduto.
  const writeTitles = async (uid, newTitles) => {
    try {
      // Scrive l'array canonico e azzera il legacy single-field per evitare duplicati di lettura.
      await updateDoc(doc(db, "characters", uid), { arenaTitles: newTitles, arenaTitle: null });
      try {
        const wornNow = (snapshots[uid]?.titles || []).filter(k => newTitles.includes(k));
        await updateDoc(doc(db, "arena_meta", "global"), {
          [`characterSnapshots.${uid}.titles`]: wornNow,
          [`characterSnapshots.${uid}.title`]: null,
        });
      } catch { /* snapshot non presente — ok */ }
    } catch (err) { console.error("set arena titles:", err); }
  };

  // Imposta il titolo INDOSSATO (uno solo) sullo snapshot del torneo in corso.
  // Utile quando un giocatore si dimentica di sceglierlo all'iscrizione.
  const setWorn = async (uid, key) => {
    try {
      await updateDoc(doc(db, "arena_meta", "global"), {
        [`characterSnapshots.${uid}.titles`]: key ? [key] : [],
        [`characterSnapshots.${uid}.title`]: null,
      });
    } catch (err) { console.error("set worn title:", err); }
  };

  const addTitle = (uid, key) => {
    if (!key) return;
    const ch = allChars.find(c => c.uid === uid);
    const current = getCharTitles(ch);
    if (current.includes(key)) return;
    return writeTitles(uid, [...current, key]);
  };
  const removeTitle = (uid, key) => {
    const ch = allChars.find(c => c.uid === uid);
    const current = getCharTitles(ch);
    return writeTitles(uid, current.filter(k => k !== key));
  };

  const q = filter.trim().toLowerCase();
  const visible = q ? allChars.filter(c => (c.name || "").toLowerCase().includes(q) || (c.class || "").toLowerCase().includes(q)) : allChars;

  return (
    <div className={`master-title-editor${forceOpen ? " in-modal" : ""}`}>
      {!forceOpen && (
        <button
          type="button"
          className="master-title-toggle"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
        >
          {open ? "▲" : "▼"} ♛ Titoli d'Arena — Permanenti
          {!open && <span className="master-title-hint">clicca per gestire</span>}
        </button>
      )}
      {open && (
        <div className="master-title-body">
          <p className="empty-note" style={{ marginBottom: 8 }}>
            I titoli posseduti sono permanenti. In torneo ogni giocatore ne indossa <strong>uno solo</strong>,
            che sceglie all'iscrizione: imposta qui l'<strong>Indossato</strong> solo se qualcuno se ne dimentica.
          </p>
          {!allChars.length ? (
            <p className="empty-note">Caricamento giocatori…</p>
          ) : (
            <>
              <input
                className="title-filter-input"
                placeholder="Cerca giocatore o classe…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              <div className="title-edit-list">
                {visible.map(ch => {
                  const owned = getCharTitles(ch);
                  const available = Object.values(ARENA_TITLES).filter(opt => !owned.includes(opt.key));
                  // Titolo indossato nello snapshot del torneo (uno solo). Solo se registrato.
                  const snap = snapshots[ch.uid];
                  const wornKey = snap ? (getSnapTitles(snap).find(k => ARENA_TITLES[k]) || "") : "";
                  return (
                    <div key={ch.uid} className="title-edit-row">
                      <span className="title-edit-name">{ch.name || ch.uid}</span>
                      {ch.class && <span className="p-class">{ch.class}</span>}
                      {owned.map(key => (
                        <span key={key} className={`p-title-badge${key === wornKey ? " worn" : ""}`} title={ARENA_TITLES[key]?.short}>
                          {key === wornKey ? "♛ " : ""}{ARENA_TITLES[key]?.icon} {ARENA_TITLES[key]?.name}
                          <button
                            type="button"
                            className="p-title-badge-x"
                            title="Rimuovi titolo"
                            onClick={() => removeTitle(ch.uid, key)}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      <select
                        className="title-select"
                        value=""
                        disabled={available.length === 0}
                        onChange={e => { const v = e.target.value; e.target.value = ""; addTitle(ch.uid, v); }}
                      >
                        <option value="">{available.length === 0 ? "— Tutti assegnati —" : "+ Aggiungi titolo…"}</option>
                        {available.map(opt => (
                          <option key={opt.key} value={opt.key}>{opt.icon} {opt.name}</option>
                        ))}
                      </select>
                      {/* Indossato: override del Master (solo se iscritto al torneo) */}
                      {snap && owned.length > 0 && (
                        <select
                          className="title-select title-worn-select"
                          value={wornKey}
                          onChange={e => setWorn(ch.uid, e.target.value || null)}
                          title="Titolo indossato in torneo"
                        >
                          <option value="">♛ Indossato: nessuno</option>
                          {owned.map(key => (
                            <option key={key} value={key}>♛ Indossa: {ARENA_TITLES[key]?.icon} {ARENA_TITLES[key]?.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── MASTER COIN EDITOR ────────────────────────────────────────────────────────
export function MasterCoinEditor() {
  const [allChars, setAllChars] = useState([]);
  const [editCoins, setEditCoins] = useState({});

  useEffect(() => {
    getDocs(collection(db, "characters")).then(snap => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setAllChars(list);
    });
    const unsub = onSnapshot(collection(db, "characters"), snap => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setAllChars(list);
    });
    return () => unsub();
  }, []);

  const handleChange = (uid, val) => setEditCoins(prev => ({ ...prev, [uid]: val }));

  const saveCoins = async (uid) => {
    const val = parseInt(editCoins[uid], 10);
    if (isNaN(val)) return;
    await updateDoc(doc(db, "characters", uid), { arenaCoins: val });
    setEditCoins(prev => { const n = { ...prev }; delete n[uid]; return n; });
  };

  if (!allChars.length) return null;

  return (
    <div className="master-coin-editor">
      <p className="col-label">🪙 Monete Arena — Tutti i Giocatori</p>
      {allChars.map(ch => (
        <div key={ch.uid} className="coin-edit-row">
          <span className="coin-edit-name">{ch.name || ch.uid}</span>
          <span className="coin-current">{ch.arenaCoins ?? 0} MA</span>
          <input
            className="coin-edit-input"
            type="number"
            min={0}
            placeholder="nuovo valore"
            value={editCoins[ch.uid] ?? ""}
            onChange={e => handleChange(ch.uid, e.target.value)}
          />
          <button className="btn-save-coins" onClick={() => saveCoins(ch.uid)}>Salva</button>
        </div>
      ))}
    </div>
  );
}
