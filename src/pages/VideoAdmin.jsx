import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { Link } from "react-router-dom";
import "./admin.css";

export default function VideoAdmin() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [videos, setVideos] = useState([]);

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

  const extractYouTubeID = (url) => {
    if (!url) return null;
    const trimmed = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    try {
      const u = new URL(trimmed);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "youtu.be") {
        const id = u.pathname.slice(1).split("/")[0];
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
      if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
        const v = u.searchParams.get("v");
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
        const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/);
        if (m) return m[2];
      }
    } catch { /* not a URL */ }
    return null;
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    const videoId = extractYouTubeID(youtubeLink);
    if (!videoId) {
      alert("❌ Link YouTube non valido! Incolla un link tipo: https://www.youtube.com/watch?v=XXXXXXXXXXX o https://youtu.be/XXXXXXXXXXX");
      return;
    }
    try {
      await addDoc(collection(db, "session_videos"), {
        title, desc, videoId,
        platform: "youtube",
        createdAt: new Date()
      });
      setTitle(""); setDesc(""); setYoutubeLink("");
      fetchVideos();
      alert("✅ Video di YouTube pubblicato correttamente!");
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
        <form onSubmit={handleAddVideo} className="admin-form-grid admin-form-grid--2col">
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
            <label>Link Video YouTube</label>
            <input
              className="admin-field-input"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeLink}
              onChange={e => setYoutubeLink(e.target.value)}
              required
            />
          </div>
          <div className="full">
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
              <small>
                {video.platform === "twitch" ? "Twitch" : "YouTube"} · ID: {video.videoId}
              </small>
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
