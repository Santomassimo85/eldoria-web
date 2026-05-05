import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./admin.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

// ── Unica fonte di verità per i party ─────────────────────────
const PARTY_ROSTER = {
  "AMEA": ["Tanagar", "Garroth", "Caius Maxis-Richtofen"],
  "ENOX": ["Temistocle Sottocolle Milo", "Dante", "Roynot", "Vyger", "Timoty Bevibotte", "Alaric Voltasorte"],
  "LAC":  ["Horn", "Thinkle Muschioverde", "Cleofe"],
  "LEAF": ["Makenna", "Taaras Stormrage", "Soran", "Zethir"],
  "ECO":  ["Aksel", "Dago", "Ismael Van Dyke"],
};

const getPartyByCharName = (name) => {
  for (const [party, members] of Object.entries(PARTY_ROSTER)) {
    if (members.includes(name)) return party;
  }
  return "Senza Gruppo";
};

export default function QuestDetail() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const { currentUser } = useAuth();

  const [quest, setQuest]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [userCharName, setUserCharName] = useState(null); // null = ancora in caricamento
  const [userParty, setUserParty]     = useState("");

  const isMaster = currentUser?.email === MASTER_EMAIL;

  useEffect(() => {
    if (!currentUser) { setUserCharName(""); return; }
    const fetch = async () => {
      const snap = await getDoc(doc(db, "characters", currentUser.uid));
      if (snap.exists()) {
        const name = snap.data().name || "";
        setUserCharName(name);
        setUserParty(getPartyByCharName(name));
      } else {
        setUserCharName("");
      }
    };
    fetch();
  }, [currentUser]);

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDoc(doc(db, "quests", id));
      if (snap.exists()) setQuest({ id: snap.id, ...snap.data() });
      setLoading(false);
    };
    fetch();
  }, [id]);

  const handleAccept = async () => {
    if (!userCharName) { alert("Il tuo personaggio non ha un nome valido!"); return; }
    const party = getPartyByCharName(userCharName);
    try {
      await updateDoc(doc(db, "quests", id), {
        acceptedBy:    userCharName,
        acceptedParty: party,
        status:        "in_progress",
      });
      navigate("/bacheca");
    } catch (err) {
      console.error("Errore salvataggio missione:", err);
    }
  };

  // ── Controllo accesso ──────────────────────────────────────
  const canAccess = () => {
    if (isMaster) return true;
    if (!quest || userCharName === null) return null; // ancora in caricamento

    const isPartyQuest = quest.targetParty && quest.targetParty !== "All";
    const isCharQuest  = quest.targetCharacter && quest.targetCharacter !== "All";

    if (isCharQuest)  return quest.targetCharacter === userCharName;
    if (isPartyQuest) return quest.targetParty === userParty;
    return true; // Generale
  };

  // ── Render ─────────────────────────────────────────────────
  if (loading || userCharName === null) {
    return (
      <section className="quest-detail-page">
        <p style={{ textAlign: "center", color: "#aaa", fontStyle: "italic" }}>Leggendo i sigilli...</p>
      </section>
    );
  }

  if (!quest) {
    return (
      <section className="quest-detail-page">
        <p style={{ textAlign: "center", color: "#aaa" }}>Incarico non trovato.</p>
      </section>
    );
  }

  const access = canAccess();

  if (access === false) {
    return (
      <section className="quest-detail-page">
        <button onClick={() => navigate("/bacheca")} className="admin-back-link">← Torna alla Bacheca</button>
        <div className="quest-detail-card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ fontSize: "2rem", marginBottom: "12px" }}>🔒</p>
          <h2 style={{ color: "var(--red)", fontFamily: "var(--font-title)", marginBottom: "8px" }}>Missiva Sigillata</h2>
          <p style={{ color: "#888" }}>Questa pergamena non è destinata a te.</p>
        </div>
      </section>
    );
  }

  const isAccepted        = !!quest.acceptedBy;
  const isAcceptedByMyParty = quest.acceptedParty === userParty;

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

        {!isAccepted ? (
          <div style={{ marginTop: 24 }}>
            <button onClick={handleAccept} className="btn-admin-primary questDetailButton">
              Accetta Missione
            </button>
          </div>
        ) : (
          <div className="quest-detail-accepted">
            <p>
              Presa in carico dal gruppo:{" "}
              <strong style={{ color: isAcceptedByMyParty ? "#27ae60" : "var(--red)" }}>
                {quest.acceptedParty || quest.acceptedBy}
              </strong>
            </p>
            {isAcceptedByMyParty && quest.acceptedBy !== userCharName && (
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
