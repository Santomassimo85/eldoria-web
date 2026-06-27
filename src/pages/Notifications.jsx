import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import {
  collection, query, where, orderBy,
  onSnapshot, doc, updateDoc, deleteDoc, writeBatch
} from "firebase/firestore";
import "./admin.css";
import "../styles/cinematic.css";
import "./Notifications.css";
import useParallaxScroll from "../hooks/useParallaxScroll";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/tanagar3.png";

export default function Notifications() {
  useParallaxScroll();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
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

  // Apre la pagina collegata alla notifica (es. l'Oracolo) segnando il messaggio
  // come letto. Link interni → router; eventuali URL esterni → nuova scheda.
  const openLink = (e, n) => {
    e.stopPropagation();
    if (!n.link) return;
    markAsRead(n.id);
    if (/^https?:\/\//i.test(n.link)) window.open(n.link, "_blank", "noopener");
    else navigate(n.link);
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
    <section className="cine-page notifications-page" style={{ "--cine-accent": "#3f5a7a", "--cine-accent-2": "#5a7ea8" }}>
      {/* ── HERO ASIMMETRICO: immagine full-bleed + placca a sinistra ── */}
      <section className="notif-hero" aria-label="Log dei Messaggi">
        <div className="notif-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
        
        <div className="notif-hero-wash" aria-hidden="true" />
        <div className="notif-hero-plate">
          <span className="notif-hero-seal">🪶 Corvi messaggeri</span>
          <h1 className="notif-hero-title">Log dei<br />Messaggi</h1>
          <p className="notif-hero-tagline">Missive, esiti d'asta e richiami del Master, tutti in un luogo.</p>
          {list.length > 0 && (
            <dl className="notif-hero-stats">
              <div><dt>Messaggi</dt><dd>{list.length}</dd></div>
            </dl>
          )}
        </div>
      </section>

      <div className="cine-wrap cine-wrap--narrow notif-body">
      {list.length > 0 && (
        <div className="notif-toolbar">
          <button onClick={clearAllNotifications} className="btn-clear-all">🗑 Svuota Log</button>
        </div>
      )}

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
            {n.link && (
              <button
                className="notification-card-cta"
                onClick={(e) => openLink(e, n)}
              >
                {n.link === "/tarocchi" ? "Apri l'Oracolo" : "Vai alla pagina"}&nbsp;→
              </button>
            )}
            <small className="notification-card-time">
              {n.timestamp?.seconds
                ? new Date(n.timestamp.seconds * 1000).toLocaleString()
                : "Data ignota"}
            </small>
          </div>
        ))
      )}
      </div>
    </section>
  );
}
