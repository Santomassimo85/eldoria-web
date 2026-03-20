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
  const [showScrollArrow, setShowScrollArrow] = useState(false);
  const [charName, setCharName] = useState("Eroe");
  
  const chatEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const chatWindowRef = useRef(null); // Ref per il click esterno
  const isMaster = currentUser?.email === MASTER_EMAIL;

  const scrollToBottom = (behavior = "smooth") => {
    chatEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. CHIUSURA AL CLICK ESTERNO
  useEffect(() => {
    function handleClickOutside(event) {
      if (chatWindowRef.current && !chatWindowRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // 2. RECUPERO NOME PERSONAGGIO
  useEffect(() => {
    if (!currentUser || isMaster) return;
    const fetchCharName = async () => {
      try {
        const charRef = doc(db, "characters", currentUser.uid);
        const charSnap = await getDoc(charRef);
        if (charSnap.exists()) setCharName(charSnap.data().name);
      } catch (err) { console.error("Errore PG:", err); }
    };
    fetchCharName();
  }, [currentUser, isMaster]);

  // 3. LISTENER MESSAGGI E LOGICA NOTIFICA
  useEffect(() => {
    if (!currentUser) return;
    
    const q = query(collection(db, "global_chat"), orderBy("timestamp", "asc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      
      // Se la chat è chiusa, incrementa notifiche
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      } else {
        // Se aperta, auto-scroll se l'utente è già vicino al fondo
        const container = messagesContainerRef.current;
        if (container) {
          const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
          if (isAtBottom) scrollToBottom("smooth");
        }
      }
    });
    return () => unsub();
  }, [currentUser, isOpen]);

  // --- FIX NOTIFICA: Reset quando si apre ---
  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  // 4. GESTIONE SCROLL (Mostra/Nascondi Freccia)
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 80;
    setShowScrollArrow(!isNearBottom);
  };

  // 5. PULIZIA MANUALE (Solo Master)
  const handleManualCleanup = async () => {
    if (!window.confirm("Master, vuoi ripulire la locanda? (Resteranno i 10 più recenti)")) return;
    try {
      const q = query(collection(db, "global_chat"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      if (snapshot.size > 10) {
        const toDelete = snapshot.docs.slice(10);
        await Promise.all(toDelete.map(d => deleteDoc(doc(db, "global_chat", d.id))));
        alert("Locanda ripulita!");
      }
    } catch (err) { console.error("Cleanup error:", err); }
  };

  // 6. INVIO MESSAGGIO
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, "global_chat"), {
        uid: currentUser.uid,
        displayName: isMaster ? "🔥 IL MASTER" : charName,
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
    return `${d.toLocaleDateString([], {day:'2-digit', month:'short'})}, ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:false})}`;
  };

  if (!currentUser) return null;

  return (
    <div ref={chatWindowRef}>
      {/* PULSANTE CHAT */}
      <button className={`chat-toggle-btn ${isOpen ? "open" : ""}`} onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? "✖" : "💬"}
        {unreadCount > 0 && !isOpen && (
          <span className="chat-notification-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* FINESTRA CHAT */}
      <div className={`global-chat-window ${isOpen ? "visible" : ""}`}>
        <div className="chat-header">
          <span>📜 Locanda di Eldoria</span>
          {isMaster && (
            <button className="master-cleanup-btn" onClick={handleManualCleanup}>🗑️</button>
          )}
        </div>

        <div className="chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
          {messages.map((m) => (
            <div key={m.id} className={`chat-msg ${m.uid === currentUser.uid ? "own" : ""}`}>
              <span className="msg-user">{m.displayName}</span>
              <p className="msg-text">{m.text}</p>
              {m.timestamp && <span className="msg-timestamp">{formatTimestamp(m.timestamp)}</span>}
            </div>
          ))}
          <div ref={chatEndRef} />
          
          {/* FRECCIA VAI IN FONDO */}
          {/* {showScrollArrow && (
            <button className="chat-scroll-to-bottom-btn" onClick={() => scrollToBottom("smooth")}>
              ⬇️
            </button>
          )} */}
        </div>

        <form onSubmit={sendMessage} className="chat-input-area">
          <input 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder={isMaster ? "Parla come Master..." : `Parla come ${charName}...`} 
          />
          <button type="submit" className="submit">&gt;</button>
        </form>
      </div>
    </div>
  );
}