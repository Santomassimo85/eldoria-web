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

/**
 * Bacheca Component
 * Main quest board page where players can view, accept, and manage quests.
 * The Master has special privileges to view and manage all quests.
 */
export default function Bacheca() {
  const navigate = useNavigate();
  const MASTER_EMAIL = "santomassimo85@gmail.com";
  
  // State management
  const [sentStatus, setSentStatus] = useState(null); // 'sending', 'success', 'error', or null
  const [quests, setQuests] = useState([]);
  const [userCharName, setUserCharName] = useState("");
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [shareWithParty, setShareWithParty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredQuestId, setHoveredQuestId] = useState(null);

  

  // Authentication
  const { currentUser } = useAuth();
  const isMaster = currentUser && currentUser.email === MASTER_EMAIL;

  /**
   * Sends a message to the webhook endpoint via the Raven Messenger form.
   * Manages form submission, loading state, and user feedback.
   *
   * @async
   * @param {Event} e - The form submission event
   * @returns {Promise<void>}
   */
  const handleSubmitMissiva = async (e) => {
    e.preventDefault();
    setSentStatus("sending");

    const formData = new FormData(e.target);

    try {
      await fetch("https://eo8kpflu157ld7n.m.pipedream.net", {
        method: "POST",
        body: formData,
        mode: "no-cors",
      });

      setSentStatus("success");
      e.target.reset();

      // Auto-clear success message after 5 seconds
      setTimeout(() => setSentStatus(null), 5000);
    } catch (error) {
      console.error("Error sending message:", error);
      setSentStatus("error");
    }
  };

  /**
   * Toggles quest acceptance status.
   * When accepting: sends quest details to webhook.
   * When declining: removes the quest assignment.
   *
   * @async
   * @param {string} questId - The ID of the quest
   * @param {boolean} status - True to accept, false to decline
   * @returns {Promise<void>}
   */
  const toggleQuestStatus = async (questId, status) => {
    try {
      const questRef = doc(db, "quests", questId);

      await updateDoc(questRef, {
        acceptedBy: status ? userCharName : null,
      });

      if (status) {
        const params = new URLSearchParams();
        params.append("Mittente", userCharName);

        const sharedWithParty = shareWithParty ? "YES ✅" : "NO ❌";

        const missionDetails = `
📢 MISSION ACCEPTED!
----------------------------------
📜 TITLE: ${selectedQuest.title}
👥 SHARED WITH PARTY: ${sharedWithParty}
👤 FROM: ${selectedQuest.sender || "Unknown"}
🌍 ZONE: ${selectedQuest.zona}
⚔️ DIFFICULTY: ${selectedQuest.diff}

💰 REWARDS:
- Platinum: ${selectedQuest.rewardGold || 0}
- Item: ${selectedQuest.rewardItem || "None"}
- Extra: ${selectedQuest.rewardOther || "None"}

📝 DESCRIPTION:
${selectedQuest.desc}
----------------------------------
      `;

        params.append("Messaggio_Giocatore", missionDetails);

        fetch("https://eo8kpflu157ld7n.m.pipedream.net", {
          method: "POST",
          body: params,
        });
      }

      setSelectedQuest(null);
    } catch (error) {
      console.error("Database error:", error);
      alert("Error sealing the message.");
    }
  };


  const [userParty, setUserParty] = useState("");
  /**
   * Fetch the logged-in user's character name from Firestore
   */
  useEffect(() => {
  if (currentUser) {
    const fetchUserChar = async () => {
      const userRef = doc(db, "characters", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserCharName(userSnap.data().name);
        setUserParty(userSnap.data().party); 
      }
    };
    fetchUserChar();
  }
}, [currentUser]);

  /**
   * Real-time listener for quests collection.
   * Updates quest list whenever data changes in Firestore.
   */
  useEffect(() => {
    const questsCollection = collection(db, "quests");
    const unsubscribe = onSnapshot(questsCollection, (snapshot) => {
      const questsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setQuests(questsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Privacy filter: Show only public quests, quests for this character, or all quests if Master
   */
const visibleQuests = quests.filter((q) => {
  if (isMaster) return true;

  // 1. MISSIONI PRIVATE: solo per il destinatario specifico
  if (q.targetCharacter && q.targetCharacter !== "All") {
    return q.targetCharacter === userCharName;
  }

  // 2. MISSIONI ACCETTATE (IL FIX):
  if (q.acceptedBy) {
    // Se la missione è stata presa dal MIO party, devo continuare a vederla!
    if (q.acceptedParty && q.acceptedParty === userParty) {
      return true;
    }
    // Se è stata presa da un altro party (o da un singolo di un altro party), sparisce
    return false; 
  }

  // 3. MISSIONI LIBERE: le vedono tutti
  return true;
});

  /**
   * Navigate to the detailed quest page
   *
   * @param {Object} quest - The quest object
   */
  const handleOpenQuest = (quest) => {
    navigate(`/quest/${quest.id}`);
    setShareWithParty(false);
  };

  return (
    <section className="bacheca-page">
      <div>
        <h1 className="main-title">Hemile's Board</h1>
        <h6 className="subtitle">
          Welcome, {userCharName}. Review the messages.
        </h6>
      </div>

      {loading ? (
        <p style={{ textAlign: "center" }}>Loading scrolls...</p>
      ) : (
        <div className="scrolls-container">
          <div className="scrolls-container">
            {visibleQuests.map((quest) => {
              // Quest is accepted if acceptedBy field exists
              const isAccepted = quest.acceptedBy != null;
              // Check if current user accepted this quest
              const isAcceptedByMe = quest.acceptedBy === userCharName;

              return (
                <div
                  key={quest.id}
                  className={`scroll-item ${quest.targetCharacter !== "All" ? "private-scroll" : ""}`}
                  onClick={() => handleOpenQuest(quest)}
                  onMouseEnter={() => setHoveredQuestId(quest.id)}
                  onMouseLeave={() => setHoveredQuestId(null)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    opacity: isAccepted ? 0.5 : 1,
                    filter: isAccepted ? "grayscale(100%)" : "none",
                  }}
                >
                  <img
                    src={
                      isAccepted || hoveredQuestId === quest.id
                        ? "/openScroll.png"
                        : "/closedScroll.png"
                    }
                    alt="Scroll"
                    style={{
                      width: "130px",
                      height: "130px",
                      objectFit: "contain",
                      transition: "transform 0.5s ease",
                      transform:
                        isAccepted || hoveredQuestId === quest.id
                          ? "rotate(-10deg) scale(1.1)"
                          : "rotate(0deg)",
                    }}
                  />
                  <p
                    className="scroll-title"
                    style={{
                      marginTop: "10px",
                      textAlign: "center",
                      color: isAccepted ? "#888" : (hoveredQuestId === quest.id ? "var(--red)" : "black"),
                    }}
                  >
                    {quest.targetCharacter !== "All" && `🔒 [${quest.targetCharacter}] `}
                    {quest.title}
                  </p>

                  {/* Quest acceptance info */}
                  {isAccepted && (
  <div style={{ textAlign: "center", fontSize: "0.8rem" }}>
    <p style={{ color: "var(--gold)", margin: "5px 0" }}>
      In carico al gruppo: <strong>{quest.acceptedParty || "Ignoto"}</strong>
    </p>
    <p style={{ color: "black", opacity: 0.7 }}>
      (Referente: {quest.acceptedBy})
    </p>

                      {/* Only the acceptor or Master can cancel the quest */}
                      {(isAcceptedByMe || isMaster) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleQuestStatus(quest.id, false);
                          }}
                          style={{
                            background: "#ff4444",
                            color: "black",
                            border: "none",
                            padding: "3px 8px",
                            borderRadius: "5px",
                            cursor: "pointer",
                          }}
                        >
                          {isMaster ? "Release Quest" : "Cancel"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quest detail modal */}
      {selectedQuest && (
        <div className="quest-overlay" onClick={() => setSelectedQuest(null)}>
          <div className="scroll-popup" onClick={(e) => e.stopPropagation()}>
            <h2
              style={{ borderBottom: "1px solid #333", paddingBottom: "10px" }}
            >
              {selectedQuest.title}
            </h2>

            <div className="quest-body">
              <p
                style={{
                  marginBottom: "10px",
                  fontSize: "1.1rem",
                  color: "var(--gold)",
                }}
              >
                <strong>From:</strong>{" "}
                {selectedQuest.sender || "A mysterious sender"}
              </p>
              <p>
                <strong>Description:</strong> {selectedQuest.desc}
              </p>

              <p>
                <strong>Zone:</strong> {selectedQuest.zona} |{" "}
                <strong>Difficulty:</strong> {selectedQuest.diff}
              </p>

              {/* Rewards section */}
              <div className="rewards-box">
                <p>
                  <strong>Expected Rewards:</strong>
                </p>
                <ul>
                  {selectedQuest.rewardGold > 0 && (
                    <li>{selectedQuest.rewardGold} Platinum Coins</li>
                  )}
                  {selectedQuest.rewardItem && (
                    <li>
                      <strong>Item:</strong> {selectedQuest.rewardItem}
                    </li>
                  )}
                  {selectedQuest.rewardOther && (
                    <li>
                      <strong>Extra:</strong> {selectedQuest.rewardOther}
                    </li>
                  )}
                </ul>
              </div>

              {/* Quest action buttons */}
              <div className="quest-actions" style={{ marginTop: "20px" }}>
                {selectedQuest.acceptedBy === userCharName ? (
                  <p style={{ color: "green", fontWeight: "bold" }}>
                    You have already accepted this message.
                  </p>
                ) : (
                  <button
                    className="accept-btn"
                    onClick={() => toggleQuestStatus(selectedQuest.id, true)}
                    style={{
                      width: "100%",
                      padding: "15px",
                      background: "var(--gold)",
                      color: "black",
                      fontWeight: "bold",
                      border: "none",
                      cursor: "pointer",
                      borderRadius: "5px",
                    }}
                  >
                    Accept Quest
                  </button>
                )}
              </div>

              {selectedQuest.targetCharacter !== "All" && (
                <p className="private-notice">
                  <i>***This mission is reserved exclusively for you.***</i>
                </p>
              )}
            </div>

            {/* Share quest with party checkbox */}
            <div className="party-consent">
              <label>
                <p className="check">
                  Share with party
                  <input
                    type="checkbox"
                    checked={shareWithParty}
                    onChange={() => setShareWithParty(!shareWithParty)}
                  />
                </p>
              </label>
            </div>

            <button
              className="close-btn"
              onClick={() => setSelectedQuest(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <hr className="bacheca-divider" />
      <hr className="gold-divider" />

      {/* Master contact form */}
      <div className="master-contact-section">
        <h3>Send a Message to the Master</h3>
        <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "20px" }}>
          Use this form to accept a mission or send a secret message to Hemile.
        </p>

        <form onSubmit={handleSubmitMissiva} className="hemile-form">
          <input type="hidden" name="Mittente" value={userCharName} />
          <input
            type="hidden"
            name="Missione"
            value={selectedQuest?.title || "General"}
          />

          <textarea
            name="Messaggio_Giocatore"
            placeholder="Write your message here..."
            required
            style={{
              width: "100%",
              height: "220px",
              borderRadius: "15px",
              padding: "10px",
              fontSize: "1rem",
              border: "1px solid #ccc",
            }}
          ></textarea>

          <button
            type="submit"
            className="hemile-button"
            disabled={sentStatus === "sending"}
          >
            {sentStatus === "sending"
              ? "Sending..."
              : "Entrust to the Messenger Raven"}
          </button>

          {/* Feedback messages */}
          {sentStatus === "success" && (
            <p
              style={{
                color: "#4CAF50",
                marginTop: "15px",
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              ✅ Message delivered successfully! The Master will receive it
              shortly.
            </p>
          )}
          {sentStatus === "error" && (
            <p
              style={{
                color: "#ff4444",
                marginTop: "15px",
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              ❌ The raven got lost. Try again shortly.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
