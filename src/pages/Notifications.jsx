import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch 
} from "firebase/firestore";

export default function Notifications() {
  const { currentUser } = useAuth();
  const [list, setList] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid),
      orderBy("timestamp", "desc")
    );

    return onSnapshot(q, (snap) => {
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [currentUser]);

  const markAsRead = async (id) => {
    await updateDoc(doc(db, "notifications", id), { read: true });
  };

  // Rimuove una singola notifica
  const deleteNotification = async (e, id) => {
    e.stopPropagation(); // Evita di attivare markAsRead cliccando sul cestino
    if (window.confirm("Vuoi eliminare questo messaggio?")) {
      await deleteDoc(doc(db, "notifications", id));
    }
  };

  // Svuota tutto il log dell'utente corrente
  const clearAllNotifications = async () => {
    if (list.length === 0) return;
    if (window.confirm("Sei sicuro di voler svuotare tutto il log dei messaggi?")) {
      const batch = writeBatch(db);
      list.forEach((n) => {
        batch.delete(doc(db, "notifications", n.id));
      });
      await batch.commit();
    }
  };

  return (
    <section className="notifications-page" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="gold-text">Log dei Messaggi</h1>
        {list.length > 0 && (
          <button onClick={clearAllNotifications} className="btn-clear-all">
            🗑️ Svuota Log
          </button>
        )}
      </div>

      <div className="notifications-container">
        {list.map(n => (
          <div 
            key={n.id} 
            className={`notification-card ${n.read ? "read" : "unread"}`} 
            onClick={() => markAsRead(n.id)}
            style={{ 
              position: 'relative', 
              padding: '15px', 
              border: '1px solid #d4af37', 
              marginBottom: '10px',
              borderRadius: '8px',
              cursor: 'pointer',
              background: n.read ? 'rgba(0,0,0,0.2)' : 'rgba(212, 175, 55, 0.1)'
            }}
          >
            <button 
              onClick={(e) => deleteNotification(e, n.id)}
              style={{ 
                position: 'absolute', 
                top: '10px', 
                right: '10px', 
                background: 'none', 
                border: 'none', 
                color: '#ff4444', 
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
              title="Elimina"
            >
              ×
            </button>
            
            <h3 style={{ margin: '0 0 10px 0', color: '#d4af37' }}>{n.title}</h3>
            <p style={{ margin: '0 0 10px 0' }}>{n.message}</p>
            <small style={{ color: '#888' }}>
              {n.timestamp?.seconds 
                ? new Date(n.timestamp.seconds * 1000).toLocaleString() 
                : "Data ignota"}
            </small>
          </div>
        ))}
        {list.length === 0 && (
          <p style={{ textAlign: 'center', color: '#888' }}>
            Nessun messaggio per te, avventuriero.
          </p>
        )}
      </div>
    </section>
  );
}