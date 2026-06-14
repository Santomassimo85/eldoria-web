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
    <section className="adm" style={{ "--cine-accent": "#6b34a8", "--cine-accent-2": "#9a52cf" }}>
      <Link to="/dm-admin" className="adm-back">← Console del Master</Link>

      <div className="adm-masthead">
        <div className="adm-mast-main">
          <span className="adm-eyebrow">🎬 Teatro delle Cronache</span>
          <h1 className="adm-title">Gestione Cinema</h1>
          <p className="adm-sub">Pubblica i link delle registrazioni delle sessioni passate.</p>
        </div>
        <div className="adm-mast-aside">
          <div className="adm-stat"><span>Registrazioni</span><strong>{videos.length}</strong></div>
        </div>
      </div>

      <div className="adm-workspace">
        {/* Editor */}
        <form onSubmit={handleAddVideo} className="adm-panel adm-col-sticky">
          <div className="adm-panel-head"><h2 className="adm-panel-title">✦ Pubblica registrazione</h2></div>
          <div className="adm-form">
            <div className="adm-field">
              <label>Titolo Sessione</label>
              <input className="adm-input" placeholder="es. Sessione 42: La caduta di Exanthia" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div className="adm-field">
              <label>Link Video YouTube</label>
              <input className="adm-input" placeholder="https://www.youtube.com/watch?v=..." value={youtubeLink} onChange={e => setYoutubeLink(e.target.value)} required />
            </div>
            <div className="adm-field">
              <label>Descrizione</label>
              <textarea className="adm-textarea" placeholder="Cosa è successo in questa sessione?" value={desc} onChange={e => setDesc(e.target.value)} rows="3" />
            </div>
            <div className="adm-btn-row">
              <button type="submit" className="adm-btn adm-btn--primary">▶ Pubblica</button>
            </div>
          </div>
        </form>

        {/* Lista */}
        <div className="adm-panel">
          <div className="adm-panel-head"><h2 className="adm-panel-title">🎞 Video caricati <span style={{ opacity: .6, fontWeight: 400 }}>({videos.length})</span></h2></div>
          {videos.length === 0 ? (
            <p className="adm-empty">Nessuna registrazione presente.</p>
          ) : (
            <div className="adm-list">
              {videos.map(video => (
                <div key={video.id} className="adm-row">
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ color: "var(--cine-accent)", fontFamily: "var(--font-head, 'Cinzel'), serif", display: "block" }}>{video.title}</strong>
                    <small style={{ color: "#9a8a6b" }}>{video.platform === "twitch" ? "Twitch" : "YouTube"} · ID: {video.videoId}</small>
                  </div>
                  <button onClick={() => handleDelete(video.id)} className="adm-btn adm-btn--danger" style={{ padding: "7px 14px", fontSize: "0.78rem" }}>Elimina</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
