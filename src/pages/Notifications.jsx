import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import {
  collection, query, where, orderBy,
  onSnapshot, doc, updateDoc, deleteDoc, writeBatch
} from "firebase/firestore";
import "./admin.css";

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

  const deleteNotification = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Vuoi eliminare questo messaggio?")) {
      await deleteDoc(doc(db, "notifications", id));
    }
  };

  const clearAllNotifications = async () => {
    if (list.length === 0) return;
    if (window.confirm("Sei sicuro di voler svuotare tutto il log dei messaggi?")) {
      const batch = writeBatch(db);
      list.forEach((n) => batch.delete(doc(db, "notifications", n.id)));
      await batch.commit();
    }
  };

  return (
    <section className="notifications-page">
      <div className="notifications-header">
        <h1 className="notifications-title">Log dei Messaggi</h1>
        {list.length > 0 && (
          <button onClick={clearAllNotifications} className="btn-clear-all">
            🗑 Svuota Log
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <p className="notifications-empty">Nessun messaggio per te, avventuriero.</p>
      ) : (
        list.map(n => (
          <div
            key={n.id}
            className={`notification-card ${n.read ? "read" : "unread"}`}
            onClick={() => markAsRead(n.id)}
          >
            <button
              className="notification-card-delete"
              onClick={(e) => deleteNotification(e, n.id)}
              title="Elimina"
            >
              ×
            </button>
            <h3 className="notification-card-title">{n.title}</h3>
            <p className="notification-card-msg">{n.message}</p>
            <small className="notification-card-time">
              {n.timestamp?.seconds
                ? new Date(n.timestamp.seconds * 1000).toLocaleString()
                : "Data ignota"}
            </small>
          </div>
        ))
      )}
    </section>
  );
}
