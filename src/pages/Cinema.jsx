import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./admin.css";

export default function Cinema() {
  const { currentUser } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

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
      <section className="cinema-page" style={{ textAlign: "center", paddingTop: "120px" }}>
        <h2 style={{ color: "var(--red)", fontFamily: "var(--font-title)" }}>Accesso Negato</h2>
        <p>Devi essere loggato per vedere le registrazioni.</p>
      </section>
    );
  }

  return (
    <section className="cinema-page">
      <h1 className="admin-page-title">Archivio Sessioni</h1>
      <div className="admin-divider"><span className="admin-divider-icon">📽</span></div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#aaa", fontStyle: "italic" }}>Caricamento registrazioni magiche...</p>
      ) : videos.length === 0 ? (
        <p style={{ textAlign: "center", color: "#aaa", fontStyle: "italic" }}>Nessuna registrazione trovata.</p>
      ) : (
        <div className="cinema-video-grid">
          {videos.map((video) => {
            const embedSrc = video.platform === "twitch"
              ? `https://player.twitch.tv/?video=${video.videoId}&parent=${currentDomain}&autoplay=false`
              : `https://www.youtube.com/embed/${video.videoId}`;
            return (
              <div key={video.id} className="cinema-video-card">
                <div className="cinema-video-embed">
                  <iframe
                    src={embedSrc}
                    title={video.title}
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
                <div className="cinema-video-info">
                  <h3 className="cinema-video-title">{video.title}</h3>
                  {video.desc && <p className="cinema-video-desc">{video.desc}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
