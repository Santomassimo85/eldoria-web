import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import "./admin.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

export default function PlatinumAdmin() {
  const { currentUser } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [tempBalances, setTempBalances] = useState({});
  const [tempCoins, setTempCoins] = useState({});
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, 'characters'), (snap) => {
      const charList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      charList.sort((a, b) =>
        (a.name || a.email || a.id).localeCompare(b.name || b.email || b.id)
      );
      setCharacters(charList);
      setTempBalances(prev => {
        const next = { ...prev };
        charList.forEach(char => {
          if (!(char.id in next)) next[char.id] = char.platinum || 0;
        });
        return next;
      });
      setTempCoins(prev => {
        const next = { ...prev };
        charList.forEach(char => {
          if (!(char.id in next)) next[char.id] = char.tcgCoins || 0;
        });
        return next;
      });
      setLoading(false);
    }, (err) => {
      setStatus(`❌ Errore Firestore: ${err.message}`);
    });
    return () => unsub();
  }, [currentUser]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  }, [characters, query]);

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <p style={{ textAlign: 'center', paddingTop: '100px' }}>Accesso negato: solo DM.</p>;
  }

  const flashStatus = (text) => {
    setStatus(text);
    setTimeout(() => setStatus(s => (s === text ? '' : s)), 2500);
  };

  const handleBalanceChange = (uid, value) => {
    const numericValue = value === '' ? '' : parseInt(value);
    setTempBalances(prev => ({ ...prev, [uid]: numericValue }));
  };

  const handleSaveBalance = async (charId) => {
    const newBalance = tempBalances[charId];
    if (newBalance === '' || isNaN(newBalance)) return;
    setStatus('Salvataggio…');
    try {
      await updateDoc(doc(db, 'characters', charId), {
        platinum: Number(newBalance),
        lastUpdated: new Date().toISOString()
      });
      flashStatus('✅ MP aggiornati');
    } catch (error) {
      flashStatus(`❌ Errore: ${error.message}`);
    }
  };

  const handleCoinsChange = (uid, value) => {
    const v = value === '' ? '' : parseInt(value);
    setTempCoins(prev => ({ ...prev, [uid]: v }));
  };

  const handleSaveCoins = async (charId) => {
    const v = tempCoins[charId];
    if (v === '' || isNaN(v)) return;
    setStatus('Salvataggio…');
    try {
      await updateDoc(doc(db, 'characters', charId), {
        tcgCoins: Math.max(0, Number(v)),
        lastUpdated: new Date().toISOString()
      });
      flashStatus('✅ Monete TCG aggiornate');
    } catch (error) {
      flashStatus(`❌ Errore: ${error.message}`);
    }
  };

  const adjustCoins = async (charId, delta) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    const current = Number(char.tcgCoins || 0);
    const next = Math.max(0, current + delta);
    try {
      await updateDoc(doc(db, 'characters', charId), {
        tcgCoins: next,
        lastUpdated: new Date().toISOString()
      });
      setTempCoins(prev => ({ ...prev, [charId]: next }));
      flashStatus(`✅ 🪙 ${current} → ${next}`);
    } catch (error) {
      flashStatus(`❌ Errore: ${error.message}`);
    }
  };

  const adjustPlatinum = async (charId, delta) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    const current = Number(char.platinum || 0);
    const next = current + delta;
    try {
      await updateDoc(doc(db, 'characters', charId), {
        platinum: next,
        lastUpdated: new Date().toISOString()
      });
      setTempBalances(prev => ({ ...prev, [charId]: next }));
      flashStatus(`✅ MP ${current} → ${next}`);
    } catch (error) {
      flashStatus(`❌ Errore: ${error.message}`);
    }
  };

  return (
    <section className="admin-platinum-page pa-page">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard Admin</Link>

      <h1 className="admin-page-title">Monete Platino &amp; Monete TCG</h1>
      <div className="admin-divider"><span className="admin-divider-icon">🪙</span></div>

      <div className="pa-toolbar">
        <input
          type="search"
          className="pa-search"
          placeholder="Cerca personaggio, email o ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="pa-count">{visible.length} / {characters.length}</span>
      </div>

      {status && (
        <div className={`pa-status ${status.includes('✅') ? 'is-ok' : status.includes('❌') ? 'is-err' : 'is-info'}`}>
          {status}
        </div>
      )}

      {loading ? (
        <p className="pa-loading">Caricamento…</p>
      ) : visible.length === 0 ? (
        <p className="pa-loading">Nessun personaggio trovato.</p>
      ) : (
        <ul className="pa-list">
          {visible.map(char => {
            const displayName = char.name || char.email?.split('@')[0] || char.id;
            const mp = char.platinum || 0;
            const coins = char.tcgCoins || 0;
            return (
              <li key={char.id} className="pa-card">
                <header className="pa-card__head">
                  <div className="pa-card__id">
                    <strong>{displayName}</strong>
                    {char.email && <small>{char.email}</small>}
                  </div>
                  <div className="pa-card__totals">
                    <span className="pa-pill pa-pill--mp" title="Monete Platino attuali">
                      <b>{mp}</b> MP
                    </span>
                    <span className="pa-pill pa-pill--tcg" title="Monete TCG attuali">
                      <b>{coins}</b> 🪙
                    </span>
                  </div>
                </header>

                <div className="pa-field">
                  <label className="pa-field__label">Monete Platino (MP)</label>
                  <div className="pa-field__row">
                    <button type="button" className="pa-btn pa-btn--ghost" onClick={() => adjustPlatinum(char.id, -10)} title="-10 MP">−10</button>
                    <button type="button" className="pa-btn pa-btn--ghost" onClick={() => adjustPlatinum(char.id, -1)} title="-1 MP">−1</button>
                    <input
                      type="number"
                      className="pa-input"
                      value={tempBalances[char.id] ?? ''}
                      onChange={(e) => handleBalanceChange(char.id, e.target.value)}
                      aria-label="Saldo MP"
                    />
                    <button type="button" className="pa-btn pa-btn--ghost" onClick={() => adjustPlatinum(char.id, +1)} title="+1 MP">+1</button>
                    <button type="button" className="pa-btn pa-btn--ghost" onClick={() => adjustPlatinum(char.id, +10)} title="+10 MP">+10</button>
                    <button type="button" className="pa-btn pa-btn--save" onClick={() => handleSaveBalance(char.id)}>Salva</button>
                  </div>
                </div>

                <div className="pa-field">
                  <label className="pa-field__label">Monete TCG 🪙</label>
                  <div className="pa-field__row">
                    <button type="button" className="pa-btn pa-btn--ghost" onClick={() => adjustCoins(char.id, -100)} title="-100">−100</button>
                    <button type="button" className="pa-btn pa-btn--ghost" onClick={() => adjustCoins(char.id, -10)} title="-10">−10</button>
                    <input
                      type="number"
                      className="pa-input"
                      value={tempCoins[char.id] ?? ''}
                      onChange={(e) => handleCoinsChange(char.id, e.target.value)}
                      aria-label="Monete TCG"
                    />
                    <button type="button" className="pa-btn pa-btn--ghost" onClick={() => adjustCoins(char.id, +10)} title="+10">+10</button>
                    <button type="button" className="pa-btn pa-btn--ghost" onClick={() => adjustCoins(char.id, +100)} title="+100">+100</button>
                    <button type="button" className="pa-btn pa-btn--save" onClick={() => handleSaveCoins(char.id)}>Salva</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
