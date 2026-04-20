import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
  collection, addDoc, query, orderBy, limit, onSnapshot,
  serverTimestamp, doc, getDoc, getDocs, deleteDoc
} from "firebase/firestore";
import { useAuth } from "../AuthContext";

const MASTER_EMAIL = "santomassimo85@gmail.com";

export default function GlobalChat() {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [charName, setCharName] = useState("Eroe");

  const chatEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const chatWindowRef = useRef(null);
  const isOpenRef = useRef(false);
  const isMaster = currentUser?.email === MASTER_EMAIL;

  const scrollToBottom = (behavior = "smooth") => {
    chatEndRef.current?.scrollIntoView({ behavior });
  };

  // keep isOpenRef in sync with state (so the snapshot callback can read it without re-subscribing)
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => scrollToBottom("instant"), 50);
    }
  }, [isOpen]);

  // chiusura al click esterno
  useEffect(() => {
    function handleClickOutside(event) {
      if (chatWindowRef.current && !chatWindowRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // nome personaggio
  useEffect(() => {
    if (!currentUser || isMaster) return;
    getDoc(doc(db, "characters", currentUser.uid))
      .then(snap => { if (snap.exists()) setCharName(snap.data().name); })
      .catch(() => {});
  }, [currentUser, isMaster]);

  // listener messaggi — dipende solo da currentUser, non da isOpen
  useEffect(() => {
    if (!currentUser) return;
    let initialLoad = true;

    const q = query(collection(db, "global_chat"), orderBy("timestamp", "asc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      if (initialLoad) {
        initialLoad = false;
        return; // messaggi già esistenti: non contare come non letti
      }

      if (!isOpenRef.current) {
        setUnreadCount(prev => prev + 1);
      } else {
        const container = messagesContainerRef.current;
        if (container) {
          const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
          if (isAtBottom) scrollToBottom("smooth");
        }
      }
    });
    return () => unsub();
  }, [currentUser]);

  // pulizia massiva
  const handleManualCleanup = async () => {
    if (!window.confirm("Vuoi ripulire la locanda? (Resteranno i 10 più recenti)")) return;
    try {
      const snap = await getDocs(query(collection(db, "global_chat"), orderBy("timestamp", "desc")));
      if (snap.size > 10) {
        await Promise.all(snap.docs.slice(10).map(d => deleteDoc(doc(db, "global_chat", d.id))));
      }
    } catch (err) { console.error("Cleanup error:", err); }
  };

  const deleteSingleMessage = async (messageId) => {
    if (!window.confirm("Vuoi eliminare questo messaggio?")) return;
    await deleteDoc(doc(db, "global_chat", messageId)).catch(console.error);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, "global_chat"), {
        uid: currentUser.uid,
        displayName: isMaster ? "Il Master" : charName,
        text: text.trim(),
        timestamp: serverTimestamp()
      });
      setText("");
      setTimeout(() => scrollToBottom("smooth"), 100);
    } catch (err) { console.error("Send error:", err); }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "";
    const d = ts.toDate();
    return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}, ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  };

  if (!currentUser) return null;

  return (
    <div ref={chatWindowRef}>
      {/* Toggle button */}
      <button className={`chat-toggle-btn ${isOpen ? "open" : ""}`} onClick={() => setIsOpen(v => !v)}>
        {isOpen ? "✕" : "💬"}
        {unreadCount > 0 && !isOpen && (
          <span className="chat-notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {/* Chat window */}
      <div className={`global-chat-window ${isOpen ? "visible" : ""}`}>
        <div className="chat-header">
          <span className="chat-header-title">Locanda di Eldoria</span>
          {isMaster && (
            <button className="master-cleanup-btn" onClick={handleManualCleanup} title="Ripulisci chat">🗑</button>
          )}
        </div>

        <div className="chat-messages" ref={messagesContainerRef}>
          {messages.map((m) => {
            const isOwn = m.uid === currentUser.uid;
            const isMasterMsg = m.displayName === "Il Master";
            return (
              <div key={m.id} className={`chat-msg ${isOwn ? "own" : ""} ${isMasterMsg ? "master-msg" : ""}`}>
                <div className="msg-meta">
                  <span className="msg-user">{m.displayName}</span>
                  {m.timestamp && <span className="msg-timestamp">{formatTimestamp(m.timestamp)}</span>}
                  {(isMaster || m.uid === currentUser.uid) && (
                    <span className="msg-delete" onClick={() => deleteSingleMessage(m.id)} title="Elimina">✕</span>
                  )}
                </div>
                <p className="msg-text">{m.text}</p>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={sendMessage} className="chat-input-area">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isMaster ? "Parla come Master…" : `Parla come ${charName}…`}
            className="chat-input"
          />
          <button type="submit" className="chat-send-btn">Invia</button>
        </form>
      </div>
    </div>
  );
}
