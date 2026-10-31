/* ============================================================
   TESORERIA DEL MASTER — /dm-admin/platinum (rifatta 2026-10-31)
   A sinistra i giocatori (nome + riassunto delle monete), a destra il
   pannello di quello scelto con le quattro casse: Corone (platinum),
   Monete TCG (tcgCoins), Monete Arena (arenaCoins) e Punti Pet
   (petPoints). Ogni cassa: valore attuale, ± rapidi, "aggiungi/togli N"
   e "imposta a". Le aggiunte usano increment (niente sovrascritture da
   una copia vecchia); sotto zero si ferma a 0 (le Corone possono andare
   in negativo come prima). I Punti Pet dati a mano finiscono anche nel
   registro del giocatore (petPointsLedger). Le Corone le registra già da
   sola logPlatinumChange (functions).
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { isAdminEmail } from "../utils/roles";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, doc, increment, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { isHiddenChar } from "../data/hiddenPlayers";
import "./admin.css";
import "./PlatinumAdmin.css";

const PURSES = [
  { key: "platinum", label: "Corone", icon: "👑", note: "La valuta del Mercato Nero e della Ruota.", allowNegative: true },
  { key: "tcgCoins", label: "Monete TCG", icon: "🎴", note: "Si spendono nel gioco di carte." },
  { key: "arenaCoins", label: "Monete Arena", icon: "⚔", note: "Bottega dell'Arena · domenica alle 23:00 tornano a 60." },
  { key: "petPoints", label: "Punti Pet", icon: "🐾", note: "Uova e Rifugio dei Pet.", ledger: true },
];
const STEPS = [-10, -5, -1, 1, 5, 10];
const num = (v) => Number(v) || 0;

function Purse({ char, purse, flash }) {
  const now = num(char[purse.key]);
  const [amount, setAmount] = useState("");
  const [setTo, setSetTo] = useState("");
  useEffect(() => { setAmount(""); setSetTo(""); }, [char.id]);

  const ref = doc(db, "characters", char.id);
  const write = async (fn, ok) => {
    try { await fn(); flash(`✅ ${ok}`); } catch (e) { flash(`❌ ${e.message}`); }
  };
  const add = (delta) => {
    if (!delta) return;
    if (purse.ledger) {
      return write(() => runTransaction(db, async (tx) => {
        const s = await tx.get(ref);
        const d = s.data() || {};
        const next = Math.max(0, num(d[purse.key]) + delta);
        const ledger = [
          { source: "master", label: delta > 0 ? "Dono del Master" : "Tolti dal Master", amount: next - num(d[purse.key]), ts: new Date().toISOString() },
          ...((d.petPointsLedger || []).slice(0, 29)),
        ];
        tx.update(ref, { [purse.key]: next, petPointsLedger: ledger });
      }), `${purse.label}: ${delta > 0 ? "+" : ""}${delta}`);
    }
    // Sotto zero no (tranne le Corone): in quel caso si scrive 0.
    const patch = !purse.allowNegative && now + delta < 0 ? { [purse.key]: 0 } : { [purse.key]: increment(delta) };
    return write(() => updateDoc(ref, { ...patch, lastUpdated: new Date().toISOString() }), `${purse.label}: ${delta > 0 ? "+" : ""}${delta}`);
  };
  const applySet = () => {
    const v = parseInt(setTo, 10);
    if (Number.isNaN(v)) return;
    const target = purse.allowNegative ? v : Math.max(0, v);
    if (!window.confirm(`Impostare ${purse.label} di ${char.name} a ${target}? (ora ${now})`)) return;
    if (purse.ledger) { add(target - now); setSetTo(""); return; }
    write(() => updateDoc(ref, { [purse.key]: target, lastUpdated: new Date().toISOString() }), `${purse.label} = ${target}`);
    setSetTo("");
  };

  return (
    <article className={`ta-purse ta-purse--${purse.key}`}>
      <header>
        <span className="ta-purse-icon" aria-hidden="true">{purse.icon}</span>
        <div>
          <h3>{purse.label}</h3>
          <small>{purse.note}</small>
        </div>
        <strong className="ta-purse-now">{now}</strong>
      </header>
      <div className="ta-steps">
        {STEPS.map((s) => (
          <button key={s} type="button" className={`ta-step${s < 0 ? " is-minus" : " is-plus"}`} onClick={() => add(s)}>
            {s > 0 ? `+${s}` : `−${-s}`}
          </button>
        ))}
      </div>
      <div className="ta-row">
        <input type="number" inputMode="numeric" placeholder="quanto" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={`Quantità di ${purse.label}`} />
        <button type="button" className="ta-btn is-plus" disabled={!parseInt(amount, 10)} onClick={() => { add(Math.abs(parseInt(amount, 10))); setAmount(""); }}>Aggiungi</button>
        <button type="button" className="ta-btn is-minus" disabled={!parseInt(amount, 10)} onClick={() => { add(-Math.abs(parseInt(amount, 10))); setAmount(""); }}>Togli</button>
      </div>
      <div className="ta-row">
        <input type="number" inputMode="numeric" placeholder={`imposta a… (ora ${now})`} value={setTo} onChange={(e) => setSetTo(e.target.value)} aria-label={`Imposta ${purse.label}`} />
        <button type="button" className="ta-btn" disabled={setTo === ""} onClick={applySet}>Imposta</button>
      </div>
    </article>
  );
}

export default function PlatinumAdmin() {
  const { currentUser } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [selId, setSelId] = useState(null);

  useEffect(() => {
    if (!currentUser) return undefined;
    return onSnapshot(collection(db, "characters"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || a.email || a.id).localeCompare(b.name || b.email || b.id));
      setCharacters(list);
      setLoading(false);
    }, (err) => setStatus(`❌ Errore Firestore: ${err.message}`));
  }, [currentUser]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characters
      .filter((c) => showHidden || (c.name && !isHiddenChar(c)))
      .filter((c) => !q || (c.name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [characters, query, showHidden]);
  const sel = characters.find((c) => c.id === selId) || null;

  if (!currentUser || !isAdminEmail(currentUser.email)) {
    return <p style={{ textAlign: "center", paddingTop: "100px" }}>Accesso negato: solo DM.</p>;
  }

  const flash = (text) => {
    setStatus(text);
    setTimeout(() => setStatus((s) => (s === text ? "" : s)), 2500);
  };
  const nameOf = (c) => c.name || c.email?.split("@")[0] || c.id;
  const pick = (id) => {
    setSelId(id);
    if (window.matchMedia("(max-width: 860px)").matches) setTimeout(() => document.getElementById("ta-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <section className="adm pa-page ta-page" style={{ "--cine-accent": "#fbbf24", "--cine-accent-2": "#fde68a" }}>
      <Link to="/dm-admin" className="adm-back">← Console del Master</Link>

      <div className="adm-masthead">
        <div className="adm-mast-main">
          <span className="adm-eyebrow">🪙 Tesoreria</span>
          <h1 className="adm-title">Monete dei giocatori</h1>
          <p className="adm-sub">Scegli un giocatore e gestisci le sue Corone, Monete TCG, Monete Arena e Punti Pet.</p>
        </div>
        <div className="adm-mast-aside">
          <div className="adm-stat"><span>Giocatori</span><strong>{visible.length}</strong></div>
        </div>
      </div>

      {status && (
        <div className={`adm-status ta-status ${status.includes("✅") ? "adm-status--ok" : status.includes("❌") ? "adm-status--err" : ""}`}>{status}</div>
      )}

      <div className="ta-layout">
        <aside className="ta-side">
          <input type="search" className="adm-input ta-search" placeholder="🔎 Cerca giocatore…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className="ta-hidden-toggle">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Mostra anche gli inattivi
          </label>
          {loading ? <p className="pa-loading">Caricamento…</p> : !visible.length ? <p className="pa-loading">Nessun giocatore.</p> : (
            <ul className="ta-players">
              {visible.map((c) => (
                <li key={c.id}>
                  <button type="button" className={`ta-player${selId === c.id ? " is-on" : ""}`} onClick={() => pick(c.id)} aria-pressed={selId === c.id}>
                    <img src={c.image || "/assets/player/default.png"} alt="" />
                    <span className="ta-player-main">
                      <b>{nameOf(c)}{isHiddenChar(c) ? <small> · inattivo</small> : null}</b>
                      <span className="ta-player-mini">
                        {PURSES.map((p) => <span key={p.key} title={p.label}>{p.icon} {num(c[p.key])}</span>)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="ta-detail" id="ta-detail">
          {!sel ? (
            <div className="ta-empty">
              <span aria-hidden="true">👈</span>
              <p>Tocca un giocatore per aprire le sue casse.</p>
            </div>
          ) : (
            <>
              <header className="ta-detail-head">
                <img src={sel.image || "/assets/player/default.png"} alt="" />
                <div>
                  <h2>{nameOf(sel)}</h2>
                  {sel.email && <small>{sel.email}</small>}
                </div>
                <button type="button" className="ta-close" onClick={() => setSelId(null)} aria-label="Chiudi">✕</button>
              </header>
              <div className="ta-purses">
                {PURSES.map((p) => <Purse key={p.key} char={sel} purse={p} flash={flash} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
