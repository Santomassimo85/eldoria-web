import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { Link } from "react-router-dom";
import "./admin.css";

export default function VideoAdmin() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [twitchLink, setTwitchLink] = useState("");
  const [videos, setVideos] = useState([]);
  const navigate = useNavigate();

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

  const extractTwitchID = (url) => {
    if (!url) return null;
    if (url.includes("twitch.tv/videos/")) {
      const parts = url.split("videos/");
      return parts[1].split(/[?#]/)[0];
    }
    if (/^\d+$/.test(url.trim())) return url.trim();
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
        title, desc, videoId,
        platform: "twitch",
        createdAt: new Date()
      });
      setTitle(""); setDesc(""); setTwitchLink("");
      fetchVideos();
      alert("✅ Video di Twitch pubblicato correttamente!");
    } catch (error) {
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
    <section className="admin-video-page">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard Admin</Link>

      <h1 className="admin-page-title">Gestione Cinema</h1>
      <div className="admin-divider"><span className="admin-divider-icon">🎬</span></div>

      {/* Form aggiunta video */}
      <div className="admin-card">
        <h2 className="admin-section-title">Pubblica Nuova Registrazione</h2>
        <form onSubmit={handleAddVideo} className="admin-form-grid">
          <div>
            <label>Titolo Sessione</label>
            <input
              className="admin-field-input"
              placeholder="es. Sessione 42: La caduta di Exanthia"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Link Video Twitch</label>
            <input
              className="admin-field-input"
              placeholder="https://www.twitch.tv/videos/..."
              value={twitchLink}
              onChange={e => setTwitchLink(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Descrizione</label>
            <textarea
              className="admin-field-textarea"
              placeholder="Cosa è successo in questa sessione?"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows="3"
            />
          </div>
          <div className="btn-admin-actions">
            <button type="submit" className="btn-admin-primary">Pubblica Registrazione</button>
          </div>
        </form>
      </div>

      {/* Lista video */}
      <div className="admin-item-list-card">
        <div style={{ padding: "0 18px" }}>
          <h2 className="admin-section-title" style={{ marginBottom: 0, marginTop: 18 }}>
            Video Caricati ({videos.length})
          </h2>
        </div>
        {videos.length === 0 && (
          <p style={{ padding: "20px 18px", color: "#aaa", fontStyle: "italic" }}>Nessuna registrazione presente.</p>
        )}
        {videos.map(video => (
          <div key={video.id} className="video-admin-card">
            <div className="video-admin-card-info">
              <strong>{video.title}</strong>
              <small>ID Twitch: {video.videoId}</small>
            </div>
            <button onClick={() => handleDelete(video.id)} className="btn-admin-danger">
              Elimina
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
