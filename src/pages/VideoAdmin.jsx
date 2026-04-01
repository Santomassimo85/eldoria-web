import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function VideoAdmin() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [twitchLink, setTwitchLink] = useState(""); // Rinominato per chiarezza
  const [videos, setVideos] = useState([]);
  const navigate = useNavigate();

  // Carica i video esistenti
  const fetchVideos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "session_videos"));
      const vids = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVideos(vids);
    } catch (error) {
      console.error("Errore nel caricamento video:", error);
    }
  };

  useEffect(() => { fetchVideos(); }, []);

  /**
   * NUOVA FUNZIONE: Estrae l'ID video da Twitch
   * Gestisce sia il link intero che l'ID numerico
   */
  const extractTwitchID = (url) => {
    if (!url) return null;
    // Se è un link intero tipo https://www.twitch.tv/videos/2720629570
    if (url.includes("twitch.tv/videos/")) {
      const parts = url.split("videos/");
      // Prende i numeri dopo "videos/" ignorando eventuali parametri extra (?t=...)
      return parts[1].split(/[?#]/)[0];
    }
    // Se hai inserito direttamente solo l'ID numerico
    if (/^\d+$/.test(url.trim())) {
      return url.trim();
    }
    return null;
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    const videoId = extractTwitchID(twitchLink);

    if (!videoId) {
      alert("❌ Link Twitch non valido! Incolla un link tipo: https://www.twitch.tv/videos/123456");
      return;
    }

    try {
      await addDoc(collection(db, "session_videos"), {
        title,
        desc,
        videoId, // Salviamo solo l'ID numerico
        platform: "twitch", // Utile per il futuro
        createdAt: new Date()
      });
      
      // Reset form e ricarica lista
      setTitle("");
      setDesc("");
      setTwitchLink("");
      fetchVideos();
      alert("✅ Video di Twitch pubblicato correttamente!");
    } catch (error) {
      console.error("Errore durante il salvataggio:", error);
      alert("Errore nel salvataggio del video.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Vuoi davvero eliminare questa registrazione?")) {
      await deleteDoc(doc(db, "session_videos", id));
      fetchVideos();
    }
  };

  return (
    <div style={{ padding: "40px 20px", maxWidth: "800px", margin: "0 auto", color: "white" }}>
      <button onClick={() => navigate("/dm-admin")} style={{ marginBottom: "20px", background: "#444", color: "white", border: "none", padding: "8px 15px", cursor: "pointer", borderRadius: "5px" }}>
        ⬅ Torna al Pannello Admin
      </button>

      <h1 style={{ color: "var(--gold)", marginBottom: "30px" }}>🎬 Gestione Cinema (Twitch)</h1>

      {/* Form di Inserimento */}
      <form onSubmit={handleAddVideo} style={{ background: "#222", padding: "20px", borderRadius: "10px", marginBottom: "30px", border: "1px solid #444" }}>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", color: "var(--gold)" }}>Titolo Sessione</label>
          <input 
            placeholder="es. Sessione 42: La caduta di Exanthia" 
            value={title} onChange={e => setTitle(e.target.value)} 
            style={{ width: "100%", padding: "10px", background: "#111", border: "1px solid #555", color: "white" }} 
            required 
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", color: "var(--gold)" }}>Link Video Twitch</label>
          <input 
            placeholder="https://www.twitch.tv/videos/..." 
            value={twitchLink} onChange={e => setTwitchLink(e.target.value)} 
            style={{ width: "100%", padding: "10px", background: "#111", border: "1px solid #555", color: "white" }} 
            required 
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", color: "var(--gold)" }}>Descrizione</label>
          <textarea 
            placeholder="Cosa è successo in questa sessione?" 
            value={desc} onChange={e => setDesc(e.target.value)} 
            style={{ width: "100%", padding: "10px", background: "#111", border: "1px solid #555", color: "white", minHeight: "80px" }} 
          />
        </div>

        <button type="submit" style={{ width: "100%", background: "var(--gold)", border: "none", padding: "12px", fontWeight: "bold", cursor: "pointer", color: "black", borderRadius: "5px" }}>
          PUBBLICA REGISTRAZIONE
        </button>
      </form>

      {/* Lista Video per eliminazione */}
      <h2 style={{ borderBottom: "1px solid var(--gold)", paddingBottom: "10px" }}>Video Caricati</h2>
      <div style={{ marginTop: "20px" }}>
        {videos.map(video => (
          <div key={video.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a1a1a", padding: "15px", borderRadius: "8px", marginBottom: "10px", border: "1px solid #333" }}>
            <div>
              <strong style={{ color: "var(--gold)" }}>{video.title}</strong>
              <p style={{ margin: "5px 0 0 0", fontSize: "0.8rem", color: "#aaa" }}>ID Twitch: {video.videoId}</p>
            </div>
            <button onClick={() => handleDelete(video.id)} style={{ background: "#ff4444", color: "white", border: "none", padding: "8px 12px", borderRadius: "5px", cursor: "pointer" }}>
              Elimina
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}