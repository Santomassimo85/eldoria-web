// ─────────────────────────────────────────────────────────────────────────
// BattleChat — the old WorldBoss battle log, reused verbatim, as a toggleable
// dockable panel. Subscribes to `world_boss_chat` itself so it works exactly
// like before (action rolls, narrative lines, master delete, avatars). A 📜
// button opens/closes it. Reuses WorldBoss.css for pixel-identical styling.
// ─────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, doc, deleteDoc, getDocs, writeBatch,
} from "firebase/firestore";
import "../WorldBoss.css";
import "./BattleChat.css";

const BOSS_SYSTEM_UID = "BOSS_MSG";

function ChatAvatar({ uid, isBoss }) {
  const [avatarUrl, setAvatarUrl] = useState(null);
  useEffect(() => {
    if (isBoss || !uid) return;
    const unsub = onSnapshot(doc(db, "characters", uid), (snap) => {
      if (snap.exists()) setAvatarUrl(snap.data().image);
    });
    return () => unsub();
  }, [uid, isBoss]);
  if (isBoss) return <span className="boss-chat-icon">👹</span>;
  if (!avatarUrl) return <div className="avatar-placeholder" />;
  return <img src={avatarUrl} alt="Avatar" className="chat-avatar-img" />;
}

export default function BattleChat({ currentUser, isMaster, charData, locked = false }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const q = query(collection(db, "world_boss_chat"), orderBy("timestamp", "desc"), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      // store ascending so newest is at the bottom (matches old layout)
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse());
    });
    return () => unsub();
  }, []);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    addDoc(collection(db, "world_boss_chat"), {
      type: "narrative", senderName: charData?.name || "Eroe",
      content: text, uid: currentUser?.uid, timestamp: serverTimestamp(),
    });
    setText("");
  };
  const del = (id) => { if (isMaster) deleteDoc(doc(db, "world_boss_chat", id)); };
  // Master-only: wipe the whole battle log. Firestore batches cap at 500 ops,
  // so delete in chunks until the collection is empty.
  const clearAll = async () => {
    if (!isMaster) return;
    if (!window.confirm("Pulire TUTTO il registro di battaglia?")) return;
    let snap;
    do {
      snap = await getDocs(query(collection(db, "world_boss_chat"), limit(450)));
      if (snap.empty) break;
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } while (snap.size === 450);
  };

  return (
    <>
      <button
        className={`bc-toggle ${open ? "is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={open ? "Chiudi log" : "Apri log"}
      >
        📜
      </button>

      {open && (
        <div className="bc-panel">
          <div className="rpg-log-panel">
            <div className="rpg-log-title">
              Registro di Battaglia
              {isMaster && (
                <button className="bc-clear" onClick={clearAll} title="Pulisci tutto il registro">🗑</button>
              )}
              <button className="bc-close" onClick={() => setOpen(false)} aria-label="Chiudi">✕</button>
            </div>
            <form className="rpg-chat-form" onSubmit={send}>
              <input
                className="rpg-chat-input" value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Narra la tua mossa…" disabled={locked}
              />
              <button className="rpg-chat-send" type="submit" disabled={locked}>▶</button>
            </form>
            <div className="rpg-log-scroll">
              {messages.map((m) => (
                <div key={m.id} className={`rpg-log-msg ${m.type || "narrative"} ${m.uid === currentUser?.uid ? "mine" : ""} ${m.isSystem ? "sys" : ""}`}>
                  <div className="rpg-log-head">
                    <ChatAvatar uid={m.uid} isBoss={m.uid === BOSS_SYSTEM_UID} />
                    <span className="rpg-log-who">{m.senderName}</span>
                    {m.timestamp && (
                      <span className="rpg-log-time">
                        {new Date(m.timestamp.seconds * 1000).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {isMaster && <button className="rpg-del-btn" onClick={() => del(m.id)}>✖</button>}
                  </div>
                  {m.type === "action" ? (
                    <div className={`rpg-log-action cat-${(m.category || "").toLowerCase().replace(/\s/g, "-")}`}>
                      {m.actionName && <strong className="rpg-act-name">{m.actionName}</strong>}
                      {m.description && <span className="rpg-act-desc"> {m.description}</span>}
                      {((m.uid === BOSS_SYSTEM_UID && isMaster) || m.uid !== BOSS_SYSTEM_UID) && (
                        <div className="rpg-rolls">
                          {m.hitRoll && <span className="rpg-hit-roll">{m.hitRoll}</span>}
                          {m.damageRoll && <span className="rpg-dmg-roll">{m.damageRoll}</span>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="rpg-log-text">{m.content || m.text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
