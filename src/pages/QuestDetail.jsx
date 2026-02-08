import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";

export default function QuestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [quest, setQuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userCharName, setUserCharName] = useState("");

  // 1. Recupera nome PG per accettazione/notifica
  useEffect(() => {
    if (currentUser) {
      const fetchUserChar = async () => {
        const userRef = doc(db, "characters", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) setUserCharName(userSnap.data().name);
      };
      fetchUserChar();
    }
  }, [currentUser]);

  // 2. Recupera i dati della Quest
  useEffect(() => {
    const fetchQuest = async () => {
      const docRef = doc(db, "quests", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setQuest({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    };
    fetchQuest();
  }, [id]);

  const handleAccept = async () => {
    const questRef = doc(db, "quests", id);
    await updateDoc(questRef, { acceptedBy: userCharName });

    // Notifica Pipedream (opzionale se vuoi tenerla)
    const params = new URLSearchParams();
    params.append("Mittente", userCharName);
    params.append(
      "Messaggio_Giocatore",
      `HA ACCETTATO LA MISSIONE: ${quest.title}`,
    );
    fetch("https://eo8kpflu157ld7n.m.pipedream.net", {
      method: "POST",
      body: params,
    });

    alert("Incarico Accettato!");
    navigate("/bacheca"); // Torna alla bacheca
  };

  if (loading)
    return (
      <p style={{ textAlign: "center", paddingTop: "50px" }}>
        Leggendo i sigilli...
      </p>
    );
  if (!quest)
    return (
      <p style={{ textAlign: "center", paddingTop: "50px" }}>
        Missione scomparsa nel nulla.
      </p>
    );

  return (
    <section
      className="quest-detail-page"
      style={{
        padding: "40px",
        maxWidth: "800px",
        margin: "0 auto",
        color: "white",
      }}
    >
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "none",
          border: "1px solid var(--gold)",
          color: "var(--gold)",
          padding: "10px 20px",
          cursor: "pointer",
          marginBottom: "30px",
        }}
      >
        ← Torna alla Bacheca
      </button>

      <div
        className="scroll-detail-content"
        style={{
          background: "rgba(240, 233, 220, 0.7)",
          padding: "40px",
          borderRadius: "15px",
          border: "2px solid var(--gold)",
        }}
      >
        <h1
          style={{
            color: "var(--gold)",
            borderBottom: "1px solid #333",
            paddingBottom: "20px",
          }}
        >
          {quest.title}
        </h1>

        <div
          style={{ marginTop: "20px", fontSize: "1.2rem", lineHeight: "1.8" }}
        >
          <p>
            <strong>Da:</strong> {quest.sender || "Ignoto"}
          </p>
          <p>
            <strong>Zona:</strong> {quest.zona}
          </p>
          <p>
            <strong>Difficoltà:</strong> {quest.diff}
          </p>
          <hr style={{ borderColor: "#333", margin: "20px 0" }} />
          <p>
            <strong>Messaggio:</strong>
          </p>
          <p style={{ fontStyle: "italic", whiteSpace: "pre-wrap" }}>
            {quest.desc}
          </p>

          <div
            style={{
              background: "rgba(255,215,0,0.1)",
              padding: "20px",
              marginTop: "20px",
              borderRadius: "10px",
            }}
          >
            <p>
              <strong>Ricompense:</strong> {quest.rewardGold} Platino,{" "}
              {quest.rewardItem}, {quest.rewardOther}
            </p>
          </div>
        </div>

        {!quest.acceptedBy ? (
          <button onClick={handleAccept} className="questDetailButton"> Accetta la Missione</button>
        ) : (
          <p
            style={{
              marginTop: "30px",
              color: "var(--gold)",
              textAlign: "center",
            }}
          >
            ✅ Questa missione è già stata presa in carico.
          </p>
        )}
      </div>
    </section>
  );
}
