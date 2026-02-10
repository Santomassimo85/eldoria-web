import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function VideoAdmin() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [videos, setVideos] = useState([]);
  const navigate = useNavigate();

  // Carica i video esistenti
  const fetchVideos = async () => {
    const querySnapshot = await getDocs(collection(db, "session_videos"));
    const vids = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setVideos(vids);
  };

  useEffect(() => { fetchVideos(); }, []);

  // Estrae l'ID del video dal link (gestisce formati diversi)
  const extractVideoID = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    const videoId = extractVideoID(youtubeLink);
    
    if (!videoId) {
      alert("Link YouTube non valido!");
      return;
    }

    try {
      await addDoc(collection(db, "session_videos"), {
        title,
        desc,
        videoId, // Salviamo solo l'ID (es. dQw4w9WgXcQ)
        date: new Date().toISOString()
      });
      alert("Video Aggiunto!");
      setTitle(""); setDesc(""); setYoutubeLink("");
      fetchVideos();
    } catch (error) {
      console.error("Errore:", error);
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm("Sicuro di voler cancellare questo video?")) {
      await deleteDoc(doc(db, "session_videos", id));
      fetchVideos();
    }
  };

  return (
    <div style={{ padding: "40px", color: "white", maxWidth: "600px", margin: "0 auto" }}>
      <button onClick={() => navigate("/dm-admin")} style={{ marginBottom: "20px", background: "none", color: "var(--gold)", border: "1px solid var(--gold)", padding: "5px" }}>← Admin Panel</button>
      
      <h2 style={{ color: "var(--gold)" }}>Gestione Cinema 🎬</h2>

      <form onSubmit={handleAddVideo} style={{ background: "#222", padding: "20px", borderRadius: "10px", marginBottom: "30px" }}>
        <input 
          placeholder="Titolo Sessione (es. Sessione 4: Il Drago)" 
          value={title} onChange={e => setTitle(e.target.value)} 
          style={{ width: "100%", marginBottom: "10px", padding: "8px" }} 
          required 
        />
        <input 
          placeholder="Link YouTube (Copia incolla qui)" 
          value={youtubeLink} onChange={e => setYoutubeLink(e.target.value)} 
          style={{ width: "100%", marginBottom: "10px", padding: "8px" }} 
          required 
        />
        <textarea 
          placeholder="Breve descrizione..." 
          value={desc} onChange={e => setDesc(e.target.value)} 
          style={{ width: "100%", marginBottom: "10px", padding: "8px", minHeight: "80px" }} 
        />
        <button type="submit" style={{ width: "100%", background: "var(--gold)", border: "none", padding: "10px", fontWeight: "bold", cursor: "pointer" }}>PUBBLICA VIDEO</button>
      </form>

      {videos.map(video => (
        <div key={video.id} style={{ borderBottom: "1px solid #444", padding: "10px 0", display: "flex", justifyContent: "space-between" }}>
          <span>{video.title}</span>
          <button onClick={() => handleDelete(video.id)} style={{ background: "red", color: "white", border: "none", cursor: "pointer" }}>X</button>
        </div>
      ))}
    </div>
  );
}