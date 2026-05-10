import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, increment, serverTimestamp, addDoc } from 'firebase/firestore';
import "./admin.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

/* Quick-grant chips visible inline on each row */
const QUICK_AMOUNTS = [+5, +10, +25, +50, -5, -10];

export default function PetPointsAdmin() {
  const { currentUser } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [tempBalances, setTempBalances] = useState({});
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState({}); // uid → bool

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, 'characters'), (snap) => {
      const charList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort: highest pet points first
      charList.sort((a, b) => (b.petPoints || 0) - (a.petPoints || 0));
      setCharacters(charList);
      setTempBalances(prev => {
        const next = { ...prev };
        charList.forEach(char => {
          // only seed if user hasn't typed something
          if (!(char.id in next)) next[char.id] = char.petPoints || 0;
        });
        return next;
      });
      setLoading(false);
    }, (err) => {
      setStatus(`❌ Errore Firestore: ${err.message}`);
    });
    return () => unsub();
  }, [currentUser]);

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <p style={{ textAlign: 'center', paddingTop: '100px' }}>Accesso negato: solo DM.</p>;
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter(c =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.class || "").toLowerCase().includes(q)
    );
  }, [characters, filter]);

  const flash = (msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2500);
  };

  /* Direct write — sets the wallet to the typed value */
  const handleSaveBalance = async (charId, charName) => {
    const newBalance = tempBalances[charId];
    if (newBalance === '' || isNaN(newBalance)) return;
    setBusy(b => ({ ...b, [charId]: true }));
    try {
      const before = characters.find(c => c.id === charId)?.petPoints || 0;
      const target = Math.max(0, Math.floor(Number(newBalance)));
      const delta  = target - before;
      await updateDoc(doc(db, 'characters', charId), {
        petPoints: target,
        // append a master ledger entry
        petPointsLedger: [
          { source: "master_set", label: `♛ Master ha impostato il saldo (${delta >= 0 ? "+" : ""}${delta})`, amount: delta, ts: new Date().toISOString(), resourceKey: null },
          ...((characters.find(c => c.id === charId)?.petPointsLedger || []).slice(0, 29)),
        ],
      });
      // notify the player
      try {
        await addDoc(collection(db, "notifications"), {
          userId: charId,
          read: false,
          timestamp: serverTimestamp(),
          title: "♛ Punti Bestiario aggiornati dal Master",
          message: `Il tuo saldo è ora ${target} punti (${delta >= 0 ? "+" : ""}${delta}).`,
        });
      } catch {}
      flash(`✅ ${charName}: saldo impostato a ${target} (${delta >= 0 ? "+" : ""}${delta})`);
    } catch (err) {
      flash(`❌ ${err.message}`);
    } finally {
      setBusy(b => ({ ...b, [charId]: false }));
    }
  };

  /* Quick delta — adds (or removes) without overwriting the wallet */
  const handleDelta = async (charId, charName, delta) => {
    setBusy(b => ({ ...b, [charId]: true }));
    try {
      const beforeChar = characters.find(c => c.id === charId);
      const before = beforeChar?.petPoints || 0;
      const after  = Math.max(0, before + delta);
      const realDelta = after - before;
      await updateDoc(doc(db, 'characters', charId), {
        petPoints: after,
        petPointsLedger: [
          { source: "master_grant", label: `♛ Master ${realDelta >= 0 ? "ha donato" : "ha rimosso"} ${Math.abs(realDelta)} punti`, amount: realDelta, ts: new Date().toISOString(), resourceKey: null },
          ...((beforeChar?.petPointsLedger || []).slice(0, 29)),
        ],
      });
      // optimistic local update so the typed input matches
      setTempBalances(prev => ({ ...prev, [charId]: after }));
      try {
        await addDoc(collection(db, "notifications"), {
          userId: charId,
          read: false,
          timestamp: serverTimestamp(),
          title: realDelta >= 0 ? "✦ Punti Bestiario ricevuti" : "✦ Punti Bestiario rimossi",
          message: `${realDelta >= 0 ? "Hai ricevuto" : "Ti sono stati tolti"} ${Math.abs(realDelta)} punti dal Master · saldo: ${after}.`,
        });
      } catch {}
      flash(`${realDelta >= 0 ? "✦" : "↓"} ${charName}: ${realDelta >= 0 ? "+" : ""}${realDelta} → ${after}`);
    } catch (err) {
      flash(`❌ ${err.message}`);
    } finally {
      setBusy(b => ({ ...b, [charId]: false }));
    }
  };

  return (
    <section className="admin-platinum-page">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard Admin</Link>

      <h1 className="admin-page-title">Punti Bestiario (✦)</h1>
      <div className="admin-divider"><span className="admin-divider-icon">🐣</span></div>

      <div style={{ maxWidth: 720, margin: "0 auto 14px", padding: "0 16px" }}>
        <input
          type="text"
          placeholder="🔍 Filtra per nome, classe o email…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            border: "1.5px solid #c9a961",
            borderRadius: 10,
            fontSize: "0.95rem",
            background: "#fffdf6",
          }}
        />
      </div>

      {status && (
        <div className={status.includes('✅') || status.includes('✦') ? 'admin-status-ok' : 'admin-status-err'}>
          {status}
        </div>
      )}

      <div className="admin-item-list-card">
        {loading ? (
          <p style={{ padding: "20px 18px", color: "#aaa", fontStyle: "italic" }}>Caricamento personaggi…</p>
        ) : visible.length === 0 ? (
          <p style={{ padding: "20px 18px", color: "#aaa", fontStyle: "italic" }}>Nessun personaggio corrisponde al filtro.</p>
        ) : (
          visible.map(char => {
            const points = char.petPoints || 0;
            const eggs = (char.petEggs || []).length;
            const pets = (char.pets || []).length;
            const isBusy = !!busy[char.id];
            return (
              <div key={char.id} className="platinum-char-row" style={{ flexWrap: "wrap" }}>
                <div className="platinum-char-info" style={{ flex: "1 1 240px" }}>
                  <strong>{char.name || char.email?.split('@')[0]}</strong>
                  <small>
                    {(char.class || "—")} · {points} ✦
                    {eggs > 0 && ` · 🥚 ${eggs}`}
                    {pets > 0 && ` · 🐾 ${pets}`}
                  </small>
                </div>

                <div className="platinum-input-group" style={{ flex: "0 0 auto" }}>
                  <input
                    type="number"
                    className="platinum-input"
                    min="0"
                    value={tempBalances[char.id] ?? ''}
                    onChange={(e) => setTempBalances(p => ({ ...p, [char.id]: e.target.value === '' ? '' : parseInt(e.target.value) }))}
                    disabled={isBusy}
                    style={{ width: 96 }}
                  />
                  <span className="platinum-unit">✦</span>
                  <button
                    onClick={() => handleSaveBalance(char.id, char.name || char.email)}
                    className="btn-admin-save"
                    disabled={isBusy}
                    title="Imposta il saldo a questo valore esatto"
                  >
                    Imposta
                  </button>
                </div>

                <div style={{ flex: "1 1 100%", display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {QUICK_AMOUNTS.map(amt => (
                    <button
                      key={amt}
                      onClick={() => handleDelta(char.id, char.name || char.email, amt)}
                      disabled={isBusy || (amt < 0 && points + amt < 0)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 999,
                        border: amt > 0 ? "1.5px solid #3a7a4a" : "1.5px solid #a04545",
                        background: amt > 0 ? "rgba(58, 122, 74, 0.08)" : "rgba(160, 69, 69, 0.08)",
                        color: amt > 0 ? "#1f5532" : "#a04545",
                        fontWeight: 700,
                        fontSize: "0.84rem",
                        cursor: isBusy ? "not-allowed" : "pointer",
                        opacity: isBusy ? 0.5 : 1,
                        transition: "background 0.15s, transform 0.12s",
                      }}
                      onMouseDown={(e) => e.currentTarget.style.transform = "translateY(1px)"}
                      onMouseUp={(e) => e.currentTarget.style.transform = ""}
                      onMouseLeave={(e) => e.currentTarget.style.transform = ""}
                      title={amt > 0 ? `Aggiungi ${amt} punti` : `Rimuovi ${Math.abs(amt)} punti`}
                    >
                      {amt > 0 ? `+${amt}` : amt}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p style={{ textAlign: "center", marginTop: 18, color: "#888", fontSize: "0.82rem", fontStyle: "italic", maxWidth: 720, marginLeft: "auto", marginRight: "auto", padding: "0 16px" }}>
        Ogni modifica scrive nel log del giocatore (visibile dalla sua scheda PG → "Storia punti") e invia una notifica.
      </p>
    </section>
  );
}
