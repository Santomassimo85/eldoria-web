import { useState, useEffect } from "react";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";

// --- TABELLA GRUPPI STATICA ---
const getPartyByCharName = (name) => {
  const mapping = {
    "Tanagar": "AMEA",
    "Garroth": "AMEA",
    "Caius Maxis-Richtofen": "AMEA",
    "Temistocle Sottocolle Milo": "ENOX",
    "Dante": "ENOX",
    "Roynot": "ENOX", 
    "Vyger": "ENOX",
    "Horn":"LAC",
    "Thinkle Muschioverde":"LAC",
    "Cleofe":"LAC",
  };
  return mapping[name] || "Senza Gruppo";
};

export default function Bacheca() {
  const navigate = useNavigate();
  const MASTER_EMAIL = "santomassimo85@gmail.com";
  
  const [quests, setQuests] = useState([]);
  const [userCharName, setUserCharName] = useState("");
  const [userParty, setUserParty] = useState("");
  const [loading, setLoading] = useState(true);
  const [hoveredQuestId, setHoveredQuestId] = useState(null);

  const { currentUser } = useAuth();
  const isMaster = currentUser && currentUser.email === MASTER_EMAIL;

  useEffect(() => {
    if (currentUser) {
      const fetchUserChar = async () => {
        const userRef = doc(db, "characters", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const charName = userSnap.data().name || "Eroe";
          setUserCharName(charName);
          setUserParty(getPartyByCharName(charName)); 
        }
      };
      fetchUserChar();
    }
  }, [currentUser]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "quests"), (snapshot) => {
      setQuests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const toggleQuestStatus = async (questId, status) => {
    try {
      const questRef = doc(db, "quests", questId);
      await updateDoc(questRef, {
        acceptedBy: status ? userCharName : null,
        acceptedParty: status ? userParty : null,
        status: status ? "in_progress" : "available"
      });
    } catch (error) {
      console.error("Errore rilascio incarico:", error);
    }
  };

  // --- LOGICA FILTRI AGGIORNATA ---
  const visibleQuests = quests.filter((q) => {
    if (isMaster) return true;
    
    // Se la missione è PRIVATA (targetCharacter specifico)
    if (q.targetCharacter && q.targetCharacter !== "All") {
      // La vede SOLO il destinatario
      return q.targetCharacter === userCharName;
    }
    
    // Se la missione è PUBBLICA/GENERALE
    // La vedono TUTTI sempre, anche se è già stata accettata da un altro gruppo
    return true;
  });

  return (
    <section className="bacheca-page">
      <h1 className="main-title">Hemile's Board</h1>
      <h6 className="subtitle">Bentornato, {userCharName} ({userParty})</h6>

      {loading ? (
        <p style={{ textAlign: "center" }}>Caricamento pergamene...</p>
      ) : (
        <div className="scrolls-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
          {visibleQuests.map((quest) => {
            const isAccepted = quest.acceptedBy != null;
            const isAcceptedByMe = quest.acceptedBy === userCharName;
            const isAcceptedByMyParty = quest.acceptedParty === userParty;
            const isPrivate = quest.targetCharacter && quest.targetCharacter !== "All";

            return (
              <div
                key={quest.id}
                className={`scroll-item ${isAccepted ? "accepted" : ""}`}
                onClick={() => navigate(`/quest/${quest.id}`)}
                onMouseEnter={() => setHoveredQuestId(quest.id)}
                onMouseLeave={() => setHoveredQuestId(null)}
                style={{ textAlign: 'center', cursor: 'pointer', width: '200px' }}
              >
                <img
                  src={isAccepted || hoveredQuestId === quest.id ? "/openScroll.png" : "/closedScroll.png"}
                  alt="Scroll"
                  style={{ width: '150px', filter: isAccepted ? 'grayscale(1)' : 'none' }}
                />
                
                <p className="scroll-title" style={{ fontWeight: 'bold', margin: '5px 0' }}>
                  {isPrivate ? "🔒 " : "🌐 "} {quest.title}
                </p>
                
                {isPrivate && <small style={{ color: 'var(--gold)' }}>Solo per {quest.targetCharacter}</small>}

                {isAccepted && (
                  <div className="acceptance-info" style={{ fontSize: '0.8rem', marginTop: '5px' }}>
                    <p>In carico a: <strong style={{color: isAcceptedByMyParty ? '#27ae60' : '#e74c3c'}}>{quest.acceptedParty}</strong></p>
                    {/* Solo chi l'ha accettata (o il Master) può rilasciarla */}
                    {(isAcceptedByMe || isMaster) && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleQuestStatus(quest.id, false); }}
                        style={{ background: '#ff4444', border: 'none', color: 'white', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', marginTop: '5px' }}
                      >
                        Rilascia Incarico
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}