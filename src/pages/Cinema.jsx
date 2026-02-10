import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "../AuthContext";

export default function Cinema() {
  const { currentUser } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "session_videos"));
        // Ordiniamo per data (i più recenti in alto?) o come preferisci
        const vids = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setVideos(vids);
      } catch (error) {
        console.error("Errore caricamento video:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, []);

  // --- BLOCCO DI SICUREZZA ---
  if (!currentUser) {
    return (
      <div style={{ textAlign: "center", padding: "50px", color: "white" }}>
        <h2 style={{ color: "red" }}>🚫 ACCESSO NEGATO</h2>
        <p>Devi essere un membro del party loggato per vedere le registrazioni.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px 20px", maxWidth: "1000px", margin: "0 auto", color: "white" }}>
      <h1 style={{ textAlign: "center", color: "var(--gold)", marginBottom: "40px", fontSize: "3rem" }}>
        📽️ Archivio Sessioni
      </h1>

      {loading ? <p>Srotolando le pellicole magiche...</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "30px" }}>
          {videos.length === 0 && <p>Nessuna registrazione trovata.</p>}
          
          {videos.map((video) => (
            <div key={video.id} style={{ background: "#1a1a1a", borderRadius: "10px", overflow: "hidden", border: "1px solid #444", boxShadow: "0 5px 15px rgba(0,0,0,0.5)" }}>
              {/* VIDEO PLAYER */}
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
                <iframe
                  src={`https://www.youtube.com/embed/${video.videoId}`}
                  title={video.title}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              
              <div style={{ padding: "20px" }}>
                <h3 style={{ color: "var(--gold)", margin: "0 0 10px 0" }}>{video.title}</h3>
                <p style={{ fontSize: "0.9rem", color: "#ccc", lineHeight: "1.4" }}>{video.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}