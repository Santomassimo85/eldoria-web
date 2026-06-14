import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, setDoc, collection, onSnapshot, deleteDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import DateTimePicker from "../components/DateTimePicker";
import "./admin.css";

export default function AdminSessions() {
  const [party, setParty] = useState("Amea");
  const [date, setDate] = useState("");
  const [activeSessions, setActiveSessions] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "sessions"), (snapshot) => {
      setActiveSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const saveSession = async () => {
    if (!date) return alert("Per favore, seleziona una data e un orario.");
    try {
      await setDoc(doc(db, "sessions", party), { date, updatedAt: new Date().toISOString() });
      alert(`Sessione per il party ${party} salvata con successo!`);
    } catch (e) {
      alert("Errore nel salvataggio: " + e.message);
    }
  };

  const deleteSession = async (id) => {
    if (window.confirm(`Vuoi davvero eliminare la sessione di ${id}?`)) {
      try {
        await deleteDoc(doc(db, "sessions", id));
        alert("Sessione eliminata.");
      } catch (e) {
        alert("Errore nell'eliminazione: " + e.message);
      }
    }
  };

  return (
    <section className="admin-sessions-page">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard Admin</Link>

      <h1 className="admin-page-title">Gestione Sessioni</h1>
      <div className="admin-divider"><span className="admin-divider-icon">📅</span></div>

      {/* Form nuova sessione */}
      <div className="admin-card">
        <h2 className="admin-section-title">Imposta Nuova Sessione</h2>
        <div className="admin-form-grid admin-form-grid--2col">
          <div>
            <label>Seleziona Party</label>
            <select
              className="admin-field-select"
              value={party}
              onChange={(e) => setParty(e.target.value)}
            >
              <option value="Amea">Amea</option>
              <option value="Lac">Lac</option>
              <option value="Enox">Enox</option>
              <option value="Leaf">Leaf</option>
              <option value="Eco">Eco</option>
            </select>
          </div>
          <div>
            <label>Data e Ora</label>
            <DateTimePicker
              value={date}
              onChange={setDate}
              presets="session"
              placeholder="Quando si gioca?"
            />
          </div>
          <div className="btn-admin-actions">
            <button onClick={saveSession} className="btn-admin-primary">
              Salva / Aggiorna Sessione
            </button>
          </div>
        </div>
      </div>

      {/* Sessioni attive */}
      <div className="admin-item-list-card">
        <div style={{ padding: "0 18px" }}>
          <h2 className="admin-section-title" style={{ marginTop: 18, marginBottom: 0 }}>
            Sessioni Attive nel Database
          </h2>
        </div>
        {activeSessions.length === 0 ? (
          <p style={{ padding: "16px 18px", color: "#aaa", fontStyle: "italic" }}>
            Nessuna sessione programmata al momento.
          </p>
        ) : (
          <table className="sessions-table">
            <thead>
              <tr>
                <th>Party</th>
                <th>Data e Ora</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {activeSessions.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.id}</strong></td>
                  <td>{new Date(s.date).toLocaleString("it-IT")}</td>
                  <td>
                    <button onClick={() => deleteSession(s.id)} className="btn-admin-danger">
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
