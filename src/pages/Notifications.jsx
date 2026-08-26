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
import GlacierHero from "../components/glacier/GlacierHero";

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
    <section className="cine-page notifications-page" style={{ "--cine-accent": "#8b5cf6", "--cine-accent-2": "#c4b5fd" }}>
      {/* ── VARCO (prototipo J): Tanagar nel portale esagonale ── */}
      <GlacierHero
        className="notif-glhero"
        ariaLabel="Log dei Messaggi"
        image={HERO_IMAGE}
        eyebrow="Corvi messaggeri"
        title={<>Log dei<br />Messaggi</>}
        seal={list.length > 0 ? `${list.length} messaggi` : undefined}
        tagline="Missive, esiti d'asta e richiami del Master, tutti in un luogo."
      />

      <div className="notif-body">
        <div className="gl-sezlabel notif-sezlabel">
          <span>Missive ricevute</span>
          {list.length > 0 && (
            <button onClick={clearAllNotifications} className="nx-pillola btn-clear-all">🗑 Svuota Log</button>
          )}
        </div>

        {list.length === 0 ? (
          <p className="notifications-empty">Nessun messaggio per te, avventuriero.</p>
        ) : (
          <div className="notif-colonna">
            {list.map(n => (
              <div
                key={n.id}
                className={`nx-pannello notification-card ${n.read ? "read" : "unread"}`}
                onClick={() => markAsRead(n.id)}
              >
                <span className="nx-tag notification-card-time">
                  {n.timestamp?.seconds
                    ? new Date(n.timestamp.seconds * 1000).toLocaleString()
                    : "Data ignota"}
                </span>
                <h3 className="nx-nome notification-card-title">
                  {!n.read && <span className="notif-dot" aria-hidden="true" />}
                  {n.title}
                </h3>
                <p className="nx-prosa notification-card-msg">{n.message}</p>
                <div className="notification-card-actions">
                  {n.link && (
                    <button
                      className="gl-cta notification-card-cta"
                      onClick={(e) => openLink(e, n)}
                    >
                      {n.link === "/tarocchi" ? "Apri l'Oracolo" : "Vai alla pagina"}&nbsp;→
                    </button>
                  )}
                  <button
                    className="notification-card-delete"
                    onClick={(e) => deleteNotification(e, n.id)}
                    title="Elimina"
                    aria-label="Elimina messaggio"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
