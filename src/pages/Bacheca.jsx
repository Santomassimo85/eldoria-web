import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";

// Definiamo MASTER_EMAIL per la vista speciale
export default function Bacheca() {
  const MASTER_EMAIL = "santomassimo85@gmail.com";
  const [sentStatus, setSentStatus] = useState(null); // può essere null, 'sending', 'success', 'error'

  const handleSubmitMissiva = async (e) => {
    e.preventDefault();
    setSentStatus("sending");

    const formData = new FormData(e.target);

    try {
      // Invia i dati a Pipedream "dietro le quinte"
      await fetch("https://eo8kpflu157ld7n.m.pipedream.net", {
        method: "POST",
        body: formData,
        mode: "no-cors", // Importante per evitare problemi di sicurezza browser
      });

      setSentStatus("success");
      e.target.reset(); // Svuota il form

      // Rimuove il messaggio di successo dopo 5 secondi
      setTimeout(() => setSentStatus(null), 5000);
    } catch (error) {
      console.error("Errore invio:", error);
      setSentStatus("error");
    }
  };

  // Funzione per Accettare o Rifiutare la Quest
 const toggleQuestStatus = async (questId, status) => {
  try {
    const questRef = doc(db, "quests", questId);
    
    await updateDoc(questRef, {
      acceptedBy: status ? userCharName : null 
    });

    if (status) {
      const params = new URLSearchParams();
      params.append("Mittente", userCharName);
      
      // AGGIUNGIAMO IL DETTAGLIO DELLA CONDIVISIONE
      const condivisione = shareWithParty ? "SI ✅" : "NO ❌";

      const dettaglioMissione = `
📢 MISSIONE ACCETTATA!
----------------------------------
📜 TITOLO: ${selectedQuest.title}
👥 CONDIVISA CON IL PARTY: ${condivisione}
👤 DA: ${selectedQuest.sender || "Ignoto"}
🌍 ZONA: ${selectedQuest.zona}
⚔️ DIFFICOLTÀ: ${selectedQuest.diff}

💰 RICOMPENSE:
- Platino: ${selectedQuest.rewardGold || 0}
- Oggetto: ${selectedQuest.rewardItem || "Nessuno"}
- Extra: ${selectedQuest.rewardOther || "Nessuno"}

📝 DESCRIZIONE:
${selectedQuest.desc}
----------------------------------
      `;

      params.append("Messaggio_Giocatore", dettaglioMissione);

      fetch("https://eo8kpflu157ld7n.m.pipedream.net", {
        method: "POST",
        body: params,
      });
    }

    setSelectedQuest(null);
  } catch (error) {
    console.error("Errore database:", error);
    alert("Errore nel sigillare la missiva.");
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
          <div className="scrolls-container">
            {visibleQuests.length > 0 ? (
              visibleQuests.map((quest) => {
                // CONTROLLO: Questa missione è stata accettata dall'utente attuale?
                const isAccepted = quest.acceptedBy === userCharName;

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
                      // SE ACCETTATA: diventa grigia e semi-trasparente
                      opacity: isAccepted ? 0.5 : 1,
                      filter: isAccepted ? "grayscale(100%)" : "none",
                    }}
                  >
                    <img
  // L'immagine resta APERTA se:
  // 1. È stata accettata (isAccepted)
  // 2. È quella cliccata/selezionata (selectedQuest?.id === quest.id)
  // 3. Il mouse ci sta passando sopra (hoveredQuestId === quest.id)
  src={
    isAccepted || selectedQuest?.id === quest.id || hoveredQuestId === quest.id
      ? "/openScroll.png"
      : "/closedScroll.png"
  }
  alt="Pergamena"
  style={{
    width: "160px",
    height: "160px",
    objectFit: "contain",
    transition: "transform 0.5s ease",
    // Ruota e ingrandisce se aperta in uno dei tre casi sopra
    transform:
      isAccepted || selectedQuest?.id === quest.id || hoveredQuestId === quest.id
        ? "rotate(-10deg) scale(1.1)"
        : "rotate(0deg)",
  }}
/>
                    <p
                      className="scroll-title"
                      style={{
                        marginTop: "10px",
                        textAlign: "center",
                        // Se accettata il testo diventa grigio, altrimenti rosso/bianco
                        color: isAccepted
                          ? "#888"
                          : hoveredQuestId === quest.id
                            ? "var(--red)"
                            : "white",
                      }}
                    >
                      {isAccepted && "✅ "}{" "}
                      {/* Aggiunge una spunta se completata */}
                      {quest.targetCharacter !== "All" && "🔒 "}
                      {quest.title}
                    </p>

                    {/* TASTO PER RIFIUTARE (esce solo se la missione è già stata accettata) */}
                    {isAccepted && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Evita di aprire il popup quando clicchi "Annulla"
                          toggleQuestStatus(quest.id, false);
                        }}
                        style={{
                          marginTop: "10px",
                          background: "#ff4444",
                          color: "white",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "5px",
                          fontSize: "0.7rem",
                          cursor: "pointer",
                        }}
                      >
                        Annulla Missione
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <p style={{ textAlign: "center", gridColumn: "1/-1" }}>
                Nessuna missiva disponibile per te.
              </p>
            )}
          </div>
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
              <p
                style={{
                  marginBottom: "10px",
                  fontSize: "1.1rem",
                  color: "var(--gold)",
                }}
              >
                <strong>Da:</strong>{" "}
                {selectedQuest.sender || "Un mittente misterioso"}
              </p>
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

              {/* Nel Popup della missione */}
              <div className="quest-actions" style={{ marginTop: "20px" }}>
                {selectedQuest.acceptedBy === userCharName ? (
                  <p style={{ color: "green", fontWeight: "bold" }}>
                    Hai già preso in carico questa missiva.
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
                    Accetta Incarico
                  </button>
                )}
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
            <input
              type="hidden"
              name="Missione"
              value={selectedQuest?.title || "Generale"}
            />

            <textarea
              name="Messaggio_Giocatore"
              placeholder="Scrivi qui la tua missiva..."
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
                ? "Invio in corso..."
                : "Affida al Corvo Messaggero"}
            </button>

            {/* MESSAGGI DI FEEDBACK SOTTO IL FORM */}
            {sentStatus === "success" && (
              <p
                style={{
                  color: "#4CAF50",
                  marginTop: "15px",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                ✅ Missiva consegnata con successo! Il Master la riceverà a
                breve.
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
                ❌ Il corvo si è smarrito. Riprova tra poco.
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
