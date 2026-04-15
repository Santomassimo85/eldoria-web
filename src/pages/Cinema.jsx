import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "../AuthContext";

/**
 * Cinema Component
 * * Visualizza l'archivio delle sessioni registrate caricandole da Twitch.
 */
export default function Cinema() {
  const { currentUser } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Determina il dominio corrente per il parametro "parent" di Twitch
  const currentDomain = window.location.hostname;

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "session_videos"));
        const vids = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setVideos(vids);
      } catch (error) {
        console.error("Error loading videos:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, []);

  if (!currentUser) {
    return (
      <div style={{ textAlign: "center", padding: "50px", color: "white" }}>
        <h2 style={{ color: "red" }}>🚫 ACCESSO NEGATO</h2>
        <p>Devi essere loggato per vedere le registrazioni.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "100px 20px 60px", maxWidth: "1000px", margin: "0 auto", color: "var(--text)" }}>
      <h1 className="page-title">
        📽️ Archivio Sessioni
      </h1>

      {loading ? (
        <p style={{ textAlign: "center" }}>Caricamento registrazioni magiche...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "30px" }}>
          {videos.length === 0 && <p style={{ textAlign: "center" }}>Nessuna registrazione trovata.</p>}
          
          {videos.map((video) => (
            <div key={video.id} style={{ background: "#1a1a1a", borderRadius: "10px", overflow: "hidden", border: "1px solid #444", boxShadow: "0 5px 15px rgba(0,0,0,0.5)" }}>
              
              {/* Twitch Video Player */}
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
                <iframe
                  // L'URL ora punta a Twitch usando l'ID salvato e il dominio dinamico
                  src={`https://player.twitch.tv/?video=${video.videoId}&parent=${currentDomain}&autoplay=false`}
                  title={video.title}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                  allowFullScreen
                ></iframe>
              </div>
              
              {/* Titolo e Descrizione */}
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