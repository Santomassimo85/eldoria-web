import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "../AuthContext";

/**
 * Cinema Component
 * 
 * Displays an archive of recorded session videos from Firestore.
 * Only authenticated users can view the video collection.
 * 
 * @component
 * @returns {JSX.Element} A grid layout displaying video cards with embedded YouTube players,
 *                        or an access denied message if user is not authenticated.
 * 
 * @example
 * // Usage in routing
 * <Route path="/cinema" element={<Cinema />} />
 * 
 * @requires useAuth - Custom hook to get current authenticated user
 * @requires useState - React hook for state management
 * @requires useEffect - React hook for side effects
 * @requires getDocs - Firestore function to fetch documents
 * @requires collection - Firestore function to reference a collection
 * @requires db - Firestore database instance
 * 
 * @state {Object[]} videos - Array of video objects from Firestore
 * @state {boolean} loading - Loading state while fetching videos from Firestore
 * 
 * Video object structure:
 * @typedef {Object} Video
 * @property {string} id - Document ID from Firestore
 * @property {string} videoId - YouTube video ID for embedding
 * @property {string} title - Video title
 * @property {string} desc - Video description
 * 
 * Styling:
 * - Uses CSS variable --gold for accent color
 * - Responsive grid layout with minimum 300px card width
 * - Dark theme with #1a1a1a background for video cards
 */
export default function Cinema() {
  const { currentUser } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch videos from Firestore collection on component mount
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "session_videos"));
        // Map documents to include both id and data properties
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

  // Display access denied message for unauthenticated users
  if (!currentUser) {
    return (
      <div style={{ textAlign: "center", padding: "50px", color: "white" }}>
        <h2 style={{ color: "red" }}>🚫 ACCESS DENIED</h2>
        <p>You must be a logged-in party member to view recordings.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px 20px", maxWidth: "1000px", margin: "0 auto", color: "white" }}>
      <h1 style={{ textAlign: "center", color: "var(--gold)", marginBottom: "40px", fontSize: "3rem" }}>
        📽️ Session Archive
      </h1>

      {/* Show loading message or video grid */}
      {loading ? <p>Loading magical recordings...</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "30px" }}>
          {/* Display empty state if no videos found */}
          {videos.length === 0 && <p>No recordings found.</p>}
          
          {/* Render video cards for each video */}
          {videos.map((video) => (
            <div key={video.id} style={{ background: "#1a1a1a", borderRadius: "10px", overflow: "hidden", border: "1px solid #444", boxShadow: "0 5px 15px rgba(0,0,0,0.5)" }}>
              {/* YouTube video player with responsive aspect ratio */}
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
                <iframe
                  src={`https://www.youtube.com/embed/${video.videoId}`}
                  title={video.title}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              
              {/* Video title and description */}
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