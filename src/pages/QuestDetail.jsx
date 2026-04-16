import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./admin.css";

const getPartyByCharName = (name) => {
  const mapping = {
    "Tanagar": "AMEA",
    "Garroth": "AMEA",
    "Caius Maxis-Richtofen": "AMEA",
    "Temistocle Sottocolle Milo": "ENOX",
    "Vyger": "",
    "Roynot": "ENOX",
    "Dante": "ENOX"
  };
  return mapping[name] || "Senza Gruppo";
};

export default function QuestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [quest, setQuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userCharName, setUserCharName] = useState("");
  const [userParty, setUserParty] = useState("");

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
    const fetchQuest = async () => {
      const docSnap = await getDoc(doc(db, "quests", id));
      if (docSnap.exists()) setQuest({ id: docSnap.id, ...docSnap.data() });
      setLoading(false);
    };
    fetchQuest();
  }, [id]);

  const handleAccept = async () => {
    if (!userCharName || userCharName === "Eroe") {
      alert("Errore: il tuo personaggio non ha un nome valido!");
      return;
    }
    const staticParty = getPartyByCharName(userCharName);
    try {
      await updateDoc(doc(db, "quests", id), {
        acceptedBy: userCharName,
        acceptedParty: staticParty,
        status: "in_progress",
      });
      alert(`Incarico accettato per il party: ${staticParty}`);
      navigate("/bacheca");
    } catch (error) {
      console.error("Errore salvataggio missione:", error);
    }
  };

  if (loading) return (
    <section className="quest-detail-page">
      <p style={{ textAlign: "center", color: "#aaa", fontStyle: "italic" }}>Leggendo i sigilli...</p>
    </section>
  );
  if (!quest) return (
    <section className="quest-detail-page">
      <p style={{ textAlign: "center", color: "#aaa" }}>Incarico non trovato.</p>
    </section>
  );

  return (
    <section className="quest-detail-page">
      <button onClick={() => navigate(-1)} className="admin-back-link">← Torna alla Bacheca</button>

      <div className="quest-detail-card">
        <h1 className="quest-detail-title">{quest.title}</h1>

        <p className="quest-detail-field">
          <strong>Emesso da:</strong> {quest.sender || "Mittente Misterioso"}
        </p>
        <p className="quest-detail-field">
          <strong>Zona:</strong> {quest.zona}
        </p>

        <p className="quest-detail-lore">{quest.desc}</p>

        <div className="quest-detail-rewards">
          <strong>Ricompense:</strong> {quest.rewardGold || 0} Platino
          {quest.rewardItem ? `, ${quest.rewardItem}` : ""}
        </div>

        {!quest.acceptedBy ? (
          <div style={{ marginTop: 24 }}>
            <button onClick={handleAccept} className="btn-admin-primary questDetailButton">
              Accetta Missione
            </button>
          </div>
        ) : (
          <div className="quest-detail-accepted">
            <p>
              Incarico in gestione al Party:{" "}
              <strong style={{ color: quest.acceptedParty === userParty ? "#27ae60" : "var(--red)" }}>
                {quest.acceptedParty}
              </strong>
            </p>
            {quest.acceptedParty === userParty && quest.acceptedBy !== userCharName && (
              <p style={{ fontSize: "0.85rem", color: "#888", marginTop: 4 }}>
                (Accettata da {quest.acceptedBy})
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
