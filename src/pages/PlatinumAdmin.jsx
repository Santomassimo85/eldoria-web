import React, { useState, useEffect } from 'react';
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
  const [tempPetPoints, setTempPetPoints] = useState({});

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, 'characters'), (snap) => {
      const charList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCharacters(charList);
      setTempBalances(prev => {
        const next = { ...prev };
        charList.forEach(char => {
          if (!(char.id in next)) next[char.id] = char.platinum || 0;
        });
        return next;
      });
      setTempPetPoints(prev => {
        const next = { ...prev };
        charList.forEach(char => {
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

  const handleBalanceChange = (uid, value) => {
    const numericValue = value === '' ? '' : parseInt(value);
    setTempBalances(prev => ({ ...prev, [uid]: numericValue }));
  };

  const handleSaveBalance = async (charId) => {
    const newBalance = tempBalances[charId];
    if (newBalance === '' || isNaN(newBalance)) return;
    setStatus('Salvataggio...');
    try {
      await updateDoc(doc(db, 'characters', charId), {
        platinum: Number(newBalance),
        lastUpdated: new Date().toISOString()
      });
      setStatus('✅ Saldo aggiornato!');
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      setStatus(`❌ Errore: ${error.message}`);
    }
  };

  const handlePetPointsChange = (uid, value) => {
    const numericValue = value === '' ? '' : parseInt(value);
    setTempPetPoints(prev => ({ ...prev, [uid]: numericValue }));
  };

  const handleSavePetPoints = async (charId) => {
    const newPoints = tempPetPoints[charId];
    if (newPoints === '' || isNaN(newPoints)) return;
    setStatus('Salvataggio Punti Bestiario...');
    try {
      await updateDoc(doc(db, 'characters', charId), {
        petPoints: Math.max(0, Number(newPoints)),
        lastUpdated: new Date().toISOString()
      });
      setStatus('✅ Punti Bestiario aggiornati!');
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      setStatus(`❌ Errore: ${error.message}`);
    }
  };

  const adjustPetPoints = async (charId, delta) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    const current = Number(char.petPoints || 0);
    const next = Math.max(0, current + delta);
    setStatus(`${delta >= 0 ? '+' : ''}${delta} Punti Bestiario...`);
    try {
      await updateDoc(doc(db, 'characters', charId), {
        petPoints: next,
        lastUpdated: new Date().toISOString()
      });
      setTempPetPoints(prev => ({ ...prev, [charId]: next }));
      setStatus(`✅ Punti Bestiario: ${current} → ${next}`);
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      setStatus(`❌ Errore: ${error.message}`);
    }
  };

  return (
    <section className="admin-platinum-page">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard Admin</Link>

      <h1 className="admin-page-title">Monete Platino (MP) e Punti Bestiario (TCG)</h1>
      <div className="admin-divider"><span className="admin-divider-icon">🪙</span></div>

      {status && (
        <div className={status.includes('✅') ? 'admin-status-ok' : 'admin-status-err'}>
          {status}
        </div>
      )}

      <div className="admin-item-list-card">
        {loading ? (
          <p style={{ padding: "20px 18px", color: "#aaa", fontStyle: "italic" }}>Caricamento...</p>
        ) : (
          characters.map(char => (
            <div key={char.id} className="platinum-char-row">
              <div className="platinum-char-info">
                <strong>{char.name || char.email?.split('@')[0]}</strong>
                <small>{char.id}</small>
              </div>
              <div className="platinum-input-group">
                <input
                  type="number"
                  className="platinum-input"
                  value={tempBalances[char.id] ?? ''}
                  onChange={(e) => handleBalanceChange(char.id, e.target.value)}
                />
                <span className="platinum-unit">MP</span>
                <button
                  onClick={() => handleSaveBalance(char.id)}
                  className="btn-admin-save"
                >
                  Salva
                </button>
              </div>
              <div className="platinum-input-group" style={{ marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => adjustPetPoints(char.id, -10)}
                  className="btn-admin-save"
                  style={{ minWidth: 44 }}
                  title="-10 Punti Bestiario"
                >−10</button>
                <button
                  type="button"
                  onClick={() => adjustPetPoints(char.id, -1)}
                  className="btn-admin-save"
                  style={{ minWidth: 40 }}
                  title="-1 Punto Bestiario"
                >−1</button>
                <input
                  type="number"
                  className="platinum-input"
                  value={tempPetPoints[char.id] ?? ''}
                  onChange={(e) => handlePetPointsChange(char.id, e.target.value)}
                  title="Punti Bestiario totali"
                />
                <span className="platinum-unit">✦</span>
                <button
                  type="button"
                  onClick={() => adjustPetPoints(char.id, +1)}
                  className="btn-admin-save"
                  style={{ minWidth: 40 }}
                  title="+1 Punto Bestiario"
                >+1</button>
                <button
                  type="button"
                  onClick={() => adjustPetPoints(char.id, +10)}
                  className="btn-admin-save"
                  style={{ minWidth: 44 }}
                  title="+10 Punti Bestiario"
                >+10</button>
                <button
                  type="button"
                  onClick={() => handleSavePetPoints(char.id)}
                  className="btn-admin-save"
                  title="Imposta il totale dei Punti Bestiario al valore mostrato"
                >Salva</button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
