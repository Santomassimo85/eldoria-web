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
    <section className="adm pa-page" style={{ "--cine-accent": "#7c560f", "--cine-accent-2": "#a9781a" }}>
      <Link to="/dm-admin" className="adm-back">← Console del Master</Link>

      <div className="adm-masthead">
        <div className="adm-mast-main">
          <span className="adm-eyebrow">🪙 Tesoreria</span>
          <h1 className="adm-title">Monete Platino &amp; TCG</h1>
          <p className="adm-sub">Aggiorna il saldo di Monete Platino e Monete TCG dei personaggi.</p>
        </div>
        <div className="adm-mast-aside">
          <div className="adm-stat"><span>Personaggi</span><strong>{characters.length}</strong></div>
        </div>
      </div>

      <div className="adm-panel" style={{ marginBottom: 18 }}>
        <div className="pa-toolbar" style={{ margin: 0 }}>
          <input
            type="search"
            className="adm-input pa-search"
            placeholder="🔎 Cerca personaggio, email o ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: "1 1 240px" }}
          />
          <span className="pa-count">{visible.length} / {characters.length}</span>
        </div>
      </div>

      {status && (
        <div className={`adm-status ${status.includes('✅') ? 'adm-status--ok' : status.includes('❌') ? 'adm-status--err' : ''}`}>
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
            const initial = (displayName || '?').trim().charAt(0).toUpperCase();
            return (
              <li key={char.id} className="pa-card">
                <header className="pa-card__head">
                  <span className="pa-avatar" aria-hidden="true">{initial}</span>
                  <div className="pa-card__id">
                    <strong>{displayName}</strong>
                    {char.email && <small>{char.email}</small>}
                  </div>
                </header>

                <div className="pa-cols">
                  <div className="pa-col pa-col--mp">
                    <div className="pa-col__head">
                      <span className="pa-col__icon" aria-hidden="true">💰</span>
                      <span className="pa-col__label">Monete Platino</span>
                      <span className="pa-col__now" title="Totale attuale">{mp}</span>
                    </div>
                    <div className="pa-col__row">
                      <button type="button" className="pa-btn pa-btn--minus" onClick={() => adjustPlatinum(char.id, -10)} title="-10 MP">−10</button>
                      <button type="button" className="pa-btn pa-btn--minus" onClick={() => adjustPlatinum(char.id, -5)} title="-5 MP">−5</button>
                      <input
                        type="number"
                        className="pa-input pa-input--mp"
                        value={tempBalances[char.id] ?? ''}
                        onChange={(e) => handleBalanceChange(char.id, e.target.value)}
                        aria-label="Saldo MP"
                      />
                      <button type="button" className="pa-btn pa-btn--plus" onClick={() => adjustPlatinum(char.id, +5)} title="+5 MP">+5</button>
                      <button type="button" className="pa-btn pa-btn--plus" onClick={() => adjustPlatinum(char.id, +10)} title="+10 MP">+10</button>
                    </div>
                    <button type="button" className="pa-btn pa-btn--save pa-btn--save-mp" onClick={() => handleSaveBalance(char.id)}>
                      Salva MP
                    </button>
                  </div>

                  <div className="pa-col pa-col--tcg">
                    <div className="pa-col__head">
                      <span className="pa-col__icon" aria-hidden="true">🪙</span>
                      <span className="pa-col__label">Monete TCG</span>
                      <span className="pa-col__now" title="Totale attuale">{coins}</span>
                    </div>
                    <div className="pa-col__row">
                      <button type="button" className="pa-btn pa-btn--minus" onClick={() => adjustCoins(char.id, -10)} title="-10 TCG">−10</button>
                      <button type="button" className="pa-btn pa-btn--minus" onClick={() => adjustCoins(char.id, -5)} title="-5 TCG">−5</button>
                      <input
                        type="number"
                        className="pa-input pa-input--tcg"
                        value={tempCoins[char.id] ?? ''}
                        onChange={(e) => handleCoinsChange(char.id, e.target.value)}
                        aria-label="Monete TCG"
                      />
                      <button type="button" className="pa-btn pa-btn--plus" onClick={() => adjustCoins(char.id, +5)} title="+5 TCG">+5</button>
                      <button type="button" className="pa-btn pa-btn--plus" onClick={() => adjustCoins(char.id, +10)} title="+10 TCG">+10</button>
                    </div>
                    <button type="button" className="pa-btn pa-btn--save pa-btn--save-tcg" onClick={() => handleSaveCoins(char.id)}>
                      Salva 🪙
                    </button>
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
