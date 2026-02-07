import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";

// Definiamo MASTER_EMAIL per la vista speciale
export default function Bacheca() {


    
    const MASTER_EMAIL = "santomassimo85@gmail.com";
    const [sentStatus, setSentStatus] = useState(null); // può essere null, 'sending', 'success', 'error'
    
    const handleSubmitMissiva = async (e) => {
      e.preventDefault();
      setSentStatus('sending');
    
      const formData = new FormData(e.target);
    
      try {
        // Invia i dati a Pipedream "dietro le quinte"
        await fetch("https://eo8kpflu157ld7n.m.pipedream.net", {
          method: "POST",
          body: formData,
          mode: "no-cors", // Importante per evitare problemi di sicurezza browser
        });
    
        setSentStatus('success');
        e.target.reset(); // Svuota il form
        
        // Rimuove il messaggio di successo dopo 5 secondi
        setTimeout(() => setSentStatus(null), 5000);
      } catch (error) {
        console.error("Errore invio:", error);
        setSentStatus('error');
      }
    };



  const { currentUser } = useAuth();
  const isMaster = currentUser && currentUser.email === MASTER_EMAIL;

  const [quests, setQuests] = useState([]);
  const [userCharName, setUserCharName] = useState(""); // Nome del PG loggato
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [shareWithParty, setShareWithParty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredQuestId, setHoveredQuestId] = useState(null);

  // 1. RECUPERA IL NOME DEL PERSONAGGIO LOGGATO
  useEffect(() => {
    if (currentUser) {
      const fetchUserChar = async () => {
        const userRef = doc(db, "characters", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserCharName(userSnap.data().name);
        }
      };
      fetchUserChar();
    }
  }, [currentUser]);

  // 2. ASCOLTO IN TEMPO REALE DELLE QUEST
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

  // 3. FILTRO PRIVACY: Mostra solo quest pubbliche, quelle del proprio PG, o tutto se Master
  const visibleQuests = quests.filter(
    (q) =>
      isMaster ||
      q.targetCharacter === "All" ||
      q.targetCharacter === userCharName,
  );

  const handleOpenQuest = (quest) => {
    setSelectedQuest(quest);
    setShareWithParty(false);
  };

  return (
    <section className="bacheca-page">
      <div>
        <h1 className="main-title">Bacheca di Hemile</h1>
        <h6 className="subtitle">
          Benvenuto, {userCharName}. Esamina le missive.
        </h6>
      </div>

      {loading ? (
        <p style={{ textAlign: "center" }}>Caricamento pergamene...</p>
      ) : (
        <div className="scrolls-container">
          {visibleQuests.length > 0 ? (
            visibleQuests.map((quest) => (
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
                }}
              >
                <img
                  // Cambia la sorgente in base allo stato hoveredQuestId
                  src={
                    hoveredQuestId === quest.id
                      ? "src/openScroll.png"
                      : "src/closedScroll.png"
                  }
                  alt="Pergamena"
                  style={{
                    width: "160px", // Aumentato un po' per visibilità
                    height: "160px",
                    objectFit: "contain",
                    transition: "transform 0.5s ease",
                    // Ruota leggermente se aperta (hover)
                    transform:
                      hoveredQuestId === quest.id
                        ? "rotate(-10deg) scale(1.1)"
                        : "rotate(0deg)",
                  }}
                />
                <p
                  className="scroll-title"
                  style={{
                    marginTop: "10px",
                    textAlign: "center",
                    color: hoveredQuestId === quest.id ? "var(--red)" : "white",
                  }}
                >
                  {quest.targetCharacter !== "All" && "🔒 "}
                  {quest.title}
                </p>
              </div>
            ))
          ) : (
            <p style={{ textAlign: "center", gridColumn: "1/-1" }}>
              Nessuna missiva disponibile per te.
            </p>
          )}
        </div>
      )}

      {/* POPUP PERGAMENA APERTA */}
      {selectedQuest && (
        <div className="quest-overlay" onClick={() => setSelectedQuest(null)}>
          <div className="scroll-popup" onClick={(e) => e.stopPropagation()}>
            <h2
              style={{ borderBottom: "1px solid #333", paddingBottom: "10px" }}
            >
              {selectedQuest.title}
            </h2>

            <div className="quest-body">
              <p>
                <strong>Descrizione:</strong> {selectedQuest.desc}
              </p>
              <p>
                <strong>Zona:</strong> {selectedQuest.zona} |{" "}
                <strong>Difficoltà:</strong> {selectedQuest.diff}
              </p>

              {/* SEZIONE RICOMPENSE DIVISE */}
              <div className="rewards-box">
                <p>
                  <strong>Ricompense Previste:</strong>
                </p>
                <ul>
                  {selectedQuest.rewardGold > 0 && (
                    <li>{selectedQuest.rewardGold} Monete Platino</li>
                  )}
                  {selectedQuest.rewardItem && (
                    <li>
                      <strong> Oggetto:</strong> {selectedQuest.rewardItem}
                    </li>
                  )}
                  {selectedQuest.rewardOther && (
                    <li>
                      <strong>Extra:</strong> {selectedQuest.rewardOther}
                    </li>
                  )}
                </ul>
              </div>

              {selectedQuest.targetCharacter !== "All" && (
                <p className="private-notice">
                  <i> ***Questa missione è riservata esclusivamente a te.***</i>
                </p>
              )}
            </div>

            <div className="party-consent">
              <label>
                <p className="check">
                  {" "}
                  Condividi con il party
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
              Chiudi
            </button>
          </div>
        </div>
      )}

      <hr className="bacheca-divider" />
      <hr className="gold-divider" />

      {/* FORM DI CONTATTO MASTER */}
      {/* SEZIONE INVIO MISSIVA AL MASTER */}
      <div className="master-contact-section">
        <h3>Invia una Missiva al Master</h3>
        <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "20px" }}>
          Usa questo form per accettare una missione o inviare un messaggio
          segreto ad Hemile.
        </p>

        {/* SOSTITUISCI L'URL QUI SOTTO CON QUELLO DI PIPEDREAM */}
        <div className="master-contact-section">
  {/* <h3>Invia una Missiva al Master</h3> */}
  
  <form onSubmit={handleSubmitMissiva} className="hemile-form">
    <input type="hidden" name="Mittente" value={userCharName} />
    <input type="hidden" name="Missione" value={selectedQuest?.title || "Generale"} />
    
    <textarea 
      name="Messaggio_Giocatore" 
      placeholder="Scrivi qui la tua missiva..." 
      required
      style={{
        width: "100%",
        height: "220px", borderRadius: "15px", padding: "10px", fontSize: "1rem", border: "1px solid #ccc",
      }}
    ></textarea>
    
    <button 
      type="submit" 
      className="hemile-button" 
      disabled={sentStatus === 'sending'}
    >
      {sentStatus === 'sending' ? "Invio in corso..." : "Affida al Corvo Messaggero"}
    </button>

    {/* MESSAGGI DI FEEDBACK SOTTO IL FORM */}
    {sentStatus === 'success' && (
      <p style={{ color: "#4CAF50", marginTop: "15px", fontWeight: "bold", textAlign: "center" }}>
        ✅ Missiva consegnata con successo! Il Master la riceverà a breve.
      </p>
    )}
    {sentStatus === 'error' && (
      <p style={{ color: "#ff4444", marginTop: "15px", fontWeight: "bold", textAlign: "center" }}>
        ❌ Il corvo si è smarrito. Riprova tra poco.
      </p>
    )}
  </form>
</div>
      </div>
    </section>
  );
}
