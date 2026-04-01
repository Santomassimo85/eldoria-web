import { useState, useEffect } from "react";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp
} from "firebase/firestore";
import { useAuth } from "../AuthContext";

// --- TABELLA GRUPPI STATICA (Deve essere identica ovunque) ---
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
    "Makenna":"LEAF",
  };
  return mapping[name] || "Senza Gruppo";
};

// Mappatura per sapere a chi inviare le notifiche di gruppo
const PARTY_MEMBERS = {
  "AMEA": ["Tanagar", "Garroth", "Caius Maxis-Richtofen"],
  "ENOX": ["Temistocle Sottocolle Milo", "Dante", "Roynot", "Vyger"],
  "LAC": ["Horn", "Thinkle Muschioverde", "Cleofe"]
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

  // --- LOGICA NOTIFICHE E STATO ---
  const toggleQuestStatus = async (quest, status) => {
    try {
      const batch = writeBatch(db);
      const questRef = doc(db, "quests", quest.id);

      // 1. Aggiorna la Quest
      batch.update(questRef, {
        acceptedBy: status ? userCharName : null,
        acceptedParty: status ? userParty : null,
        status: status ? "in_progress" : "available"
      });

      // 2. Crea Notifiche se la missione viene ACCETTATA
      if (status === true) {
        // Se è una quest indirizzata a un Party specifico (es. AMEA)
        if (quest.targetParty && quest.targetParty !== "All") {
          const membersNames = PARTY_MEMBERS[quest.targetParty] || [];
          
          // Cerchiamo gli UID di tutti i membri del party nel DB
          const charQuery = query(collection(db, "characters"), where("name", "in", membersNames));
          const charSnaps = await getDocs(charQuery);

          charSnaps.forEach((memberDoc) => {
            const notifyRef = doc(collection(db, "notifications"));
            batch.set(notifyRef, {
              userId: memberDoc.id,
              title: "⚔️ Missione di Gruppo!",
              message: `${userCharName} ha accettato "${quest.title}" per il party ${userParty}. Preparatevi!`,
              read: false,
              timestamp: serverTimestamp()
            });
          });
        } else {
          // Notifica singola (Quest pubblica o privata)
          const notifyRef = doc(collection(db, "notifications"));
          batch.set(notifyRef, {
            userId: currentUser.uid,
            title: "📜 Incarico Accettato",
            message: `Hai preso in carico la missione: "${quest.title}".`,
            read: false,
            timestamp: serverTimestamp()
          });
        }
      }

      await batch.commit();
    } catch (error) {
      console.error("Errore gestione incarico:", error);
    }
  };

  const visibleQuests = quests.filter((q) => {
    if (isMaster) return true;
    if (q.targetCharacter && q.targetCharacter !== "All") return q.targetCharacter === userCharName;
    if (q.targetParty && q.targetParty !== "All") return q.targetParty === userParty;
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
            const isPartyQuest = quest.targetParty && quest.targetParty !== "All";

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
                  {isPrivate ? "🔒 " : isPartyQuest ? "🛡️ " : "🌐 "} {quest.title}
                </p>
                
                {isPrivate && <small style={{ color: 'var(--gold)' }}>Solo per {quest.targetCharacter}</small>}
                {isPartyQuest && !isAccepted && <small style={{ color: '#27ae60' }}>Riservata a {quest.targetParty}</small>}

                {isAccepted && (
                  <div className="acceptance-info" style={{ fontSize: '0.8rem', marginTop: '5px' }}>
                    <p>In carico a: <strong style={{color: isAcceptedByMyParty ? '#27ae60' : '#e74c3c'}}>{quest.acceptedParty}</strong></p>
                    {(isAcceptedByMe || isMaster) && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleQuestStatus(quest, false); }}
                        style={{ background: '#ff4444', border: 'none', color: 'white', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', marginTop: '5px' }}
                      >
                        Rilascia Incarico
                      </button>
                    )}
                  </div>
                )}
                
                {!isAccepted && hoveredQuestId === quest.id && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleQuestStatus(quest, true); }}
                      className="btn-quick-accept"
                      style={{ background: 'var(--gold)', border: 'none', color: 'black', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', marginTop: '5px', fontWeight: 'bold' }}
                    >
                      Accetta Ora
                    </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}