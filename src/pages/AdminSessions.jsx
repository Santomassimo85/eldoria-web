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
    <section className="adm" style={{ "--cine-accent": "#3f5a7a", "--cine-accent-2": "#5a7ea8" }}>
      <Link to="/dm-admin" className="adm-back">← Console del Master</Link>

      <div className="adm-masthead">
        <div className="adm-mast-main">
          <span className="adm-eyebrow">📅 Calendario di gioco</span>
          <h1 className="adm-title">Gestione Sessioni</h1>
          <p className="adm-sub">Imposta date, orari e link per i party di Exanthia.</p>
        </div>
        <div className="adm-mast-aside">
          <div className="adm-stat"><span>Programmate</span><strong>{activeSessions.length}</strong></div>
        </div>
      </div>

      <div className="adm-workspace">
        {/* Editor */}
        <div className="adm-panel adm-col-sticky">
          <div className="adm-panel-head"><h2 className="adm-panel-title">✦ Imposta sessione</h2></div>
          <div className="adm-form adm-form--2">
            <div className="adm-field">
              <label>Party</label>
              <select className="adm-select" value={party} onChange={(e) => setParty(e.target.value)}>
                <option value="Amea">Amea</option>
                <option value="Lac">Lac</option>
                <option value="Enox">Enox</option>
                <option value="Leaf">Leaf</option>
                <option value="Eco">Eco</option>
              </select>
            </div>
            <div className="adm-field">
              <label>Data e Ora</label>
              <DateTimePicker value={date} onChange={setDate} presets="session" placeholder="Quando si gioca?" />
            </div>
            <div className="full adm-btn-row">
              <button onClick={saveSession} className="adm-btn adm-btn--primary">💾 Salva / Aggiorna</button>
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="adm-panel">
          <div className="adm-panel-head"><h2 className="adm-panel-title">🗓 Sessioni attive</h2></div>
          {activeSessions.length === 0 ? (
            <p className="adm-empty">Nessuna sessione programmata al momento.</p>
          ) : (
            <div className="adm-list">
              {activeSessions.map(s => (
                <div key={s.id} className="adm-row">
                  <div>
                    <strong style={{ color: "var(--cine-accent)", fontFamily: "var(--font-head, 'Cinzel'), serif" }}>{s.id}</strong>
                    <div style={{ fontSize: "0.82rem", color: "#6a5b41" }}>{new Date(s.date).toLocaleString("it-IT")}</div>
                  </div>
                  <button onClick={() => deleteSession(s.id)} className="adm-btn adm-btn--danger" style={{ padding: "7px 14px", fontSize: "0.78rem" }}>Elimina</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
