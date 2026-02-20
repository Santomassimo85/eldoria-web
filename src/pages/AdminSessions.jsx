import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, setDoc, collection, onSnapshot, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AdminSessions() {
    const [party, setParty] = useState("Amea"); 
    const [date, setDate] = useState("");
    const [activeSessions, setActiveSessions] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "sessions"), (snapshot) => {
            const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setActiveSessions(sessions);
        });
        return () => unsubscribe();
    }, []);

    const saveSession = async () => {
        if (!date) return alert("Per favore, seleziona una data e un orario.");
        
        try {
            await setDoc(doc(db, "sessions", party), {
                date: date,
                updatedAt: new Date().toISOString()
            });
            alert(`Sessione per il party ${party} salvata con successo!`);
        } catch (e) {
            alert("Errore nel salvataggio: " + e.message);
        }
    };

    const deleteSession = async (id) => {
        if (window.confirm(`Vuoi davvero eliminare la sessione di ${id}? Il countdown sparirà per i player.`)) {
            try {
                await deleteDoc(doc(db, "sessions", id));
                alert("Sessione eliminata.");
            } catch (e) {
                alert("Errore nell'eliminazione: " + e.message);
            }
        }
    };

    return (
        <div className="admin-container">
            <button onClick={() => navigate("/dm-admin")} className="admin-button">
                ← Torna al Pannello Admin
            </button>

            <h1>Gestione Sessioni</h1>

            <div className="admin-form">
                <h3>Imposta Nuova Sessione</h3>
                
                <label>Seleziona Party:</label>
                <select 
                    value={party} 
                    onChange={(e) => setParty(e.target.value)}
                    className="admin-input"
                >
                    <option value="Amea">Amea</option>
                    <option value="Lac">Lac</option>
                    <option value="Enox">Enox</option>
                </select>

                <label>Data e Ora:</label>
                <input 
                    type="datetime-local" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)}
                    className="admin-input"
                />

                <button onClick={saveSession} className="admin-button">
                    Salva / Aggiorna Sessione
                </button>
            </div>

            <div className="active-sessions-list">
                <h3>Sessioni Attive nel Database</h3>
                {activeSessions.length === 0 ? (
                    <p>Nessuna sessione programmata al momento.</p>
                ) : (
                    <div>
                        <table>
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
                                        <td>{s.id}</td>
                                        <td>{new Date(s.date).toLocaleString('it-IT')}</td>
                                        <td>
                                            <button onClick={() => deleteSession(s.id)} className="delete-button">
                                                Elimina
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
