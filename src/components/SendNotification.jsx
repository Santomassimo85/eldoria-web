import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { Link } from "react-router-dom";
import { isHiddenChar } from "../data/hiddenPlayers";
import "../pages/admin.css";

export default function SendNotification() {
  const [characters, setCharacters] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCharacters = async () => {
      const querySnapshot = await getDocs(collection(db, "characters"));
      const chars = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || "Eroe Senza Nome",
      })).filter(c => !isHiddenChar(c));
      chars.sort((a, b) => a.name.localeCompare(b.name));
      setCharacters(chars);
    };
    fetchCharacters();
  }, []);

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? characters.filter(c => c.name.toLowerCase().includes(q)) : characters;
  }, [characters, query]);

  const allSelected = characters.length > 0 && selectedIds.length === characters.length;
  const toggleAll = () => setSelectedIds(allSelected ? [] : characters.map(c => c.id));

  const handleSend = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !title || !message) return alert("Compila tutto!");
    setLoading(true);
    try {
      const promises = selectedIds.map(userId =>
        addDoc(collection(db, "notifications"), {
          userId, title, message, read: false, timestamp: serverTimestamp(),
        })
      );
      await Promise.all(promises);
      alert("Messaggi magici inviati con successo!");
      setTitle(""); setMessage(""); setSelectedIds([]);
    } catch (err) {
      console.error(err);
      alert("Errore nell'invio del corvo messaggero.");
    }
    setLoading(false);
  };

  return (
    <section className="adm" style={{ "--cine-accent": "#3f5a7a", "--cine-accent-2": "#5a7ea8" }}>
      <Link to="/dm-admin" className="adm-back">← Console del Master</Link>

      <div className="adm-masthead">
        <div className="adm-mast-main">
          <span className="adm-eyebrow">🪶 Corvi messaggeri</span>
          <h1 className="adm-title">Invia Notifica</h1>
          <p className="adm-sub">Recapita un messaggio diretto nel menu personale dei giocatori.</p>
        </div>
        <div className="adm-mast-aside">
          <div className="adm-stat"><span>Selezionati</span><strong>{selectedIds.length}</strong></div>
        </div>
      </div>

      <form onSubmit={handleSend} className="adm-workspace">
        {/* Destinatari */}
        <div className="adm-panel">
          <div className="adm-panel-head">
            <h2 className="adm-panel-title">✦ Destinatari</h2>
            <button type="button" className="adm-btn adm-btn--ghost" style={{ padding: "6px 14px", fontSize: ".76rem" }} onClick={toggleAll}>
              {allSelected ? "Deseleziona tutti" : "Seleziona tutti"}
            </button>
          </div>
          <input
            className="adm-input"
            placeholder="🔎 Cerca un eroe…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginBottom: 14 }}
          />
          <div className="sn-recipients">
            {visible.map(char => {
              const on = selectedIds.includes(char.id);
              return (
                <button
                  type="button"
                  key={char.id}
                  className={`sn-chip ${on ? "on" : ""}`}
                  onClick={() => toggleSelect(char.id)}
                >
                  <span className="sn-chip-tick" aria-hidden="true">{on ? "✓" : "○"}</span>
                  {char.name}
                </button>
              );
            })}
            {visible.length === 0 && <p className="adm-empty" style={{ padding: 12 }}>Nessun eroe trovato.</p>}
          </div>
        </div>

        {/* Messaggio */}
        <div className="adm-panel adm-col-sticky">
          <div className="adm-panel-head"><h2 className="adm-panel-title">✉ Messaggio</h2></div>
          <div className="adm-form">
            <div className="adm-field">
              <label>Titolo</label>
              <input className="adm-input" placeholder="es. Un sussurro nell'ombra" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="adm-field">
              <label>Testo</label>
              <textarea className="adm-textarea" placeholder="Scrivi il messaggio qui…" value={message} onChange={(e) => setMessage(e.target.value)} rows="5" required />
            </div>
            <div className="adm-btn-row">
              <button type="submit" className="adm-btn adm-btn--primary" disabled={loading}>
                {loading ? "Incantando…" : `🪶 Invia a ${selectedIds.length || 0}`}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
