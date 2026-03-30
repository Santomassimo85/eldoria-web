import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";

// --- TABELLA GRUPPI STATICA ---
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

  if (loading) return <p style={{ textAlign: 'center', marginTop: '50px' }}>Leggendo i sigilli...</p>;
  if (!quest) return <p style={{ textAlign: 'center', marginTop: '50px' }}>Incarico non trovato.</p>;

  return (
    <section className="quest-detail-page" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px' }}>
      <button onClick={() => navigate(-1)} className="back-button">← Torna alla Bacheca</button>
      <div className="scroll-detail-content" style={{ background: 'rgba(255,255,255,0.8)', padding: '30px', borderRadius: '15px', border: '2px solid var(--gold)', marginTop: '20px' }}>
        <h1 style={{ color: 'var(--gold)', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>{quest.title}</h1>
        <p><strong>Emesso da:</strong> {quest.sender || "Mittente Misterioso"}</p>
        <p><strong>Zona:</strong> {quest.zona}</p>
        <p style={{ marginTop: '20px', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{quest.desc}</p>
        
        <div style={{ background: 'rgba(212,175,55,0.1)', padding: '15px', borderRadius: '8px', marginTop: '20px' }}>
            <strong>Ricompense:</strong> {quest.rewardGold || 0} Platino, {quest.rewardItem || "Nessun Oggetto"}
        </div>

        {/* Mostra il pulsante "Accetta" solo se la missione è libera */}
        {!quest.acceptedBy ? (
  <button onClick={handleAccept} className="invia">Accetta Missione</button>
) : (
  <div style={{ textAlign: 'center', marginTop: '30px' }}>
    <p>📜 Incarico in gestione al Party: 
      <strong style={{
        color: quest.acceptedParty === userParty ? '#27ae60' : '#e74c3c',
        marginLeft: '10px'
      }}>
        {quest.acceptedParty}
      </strong>
    </p>
    {/* Se l'ha presa qualcuno del mio party, mostro il nome del compagno */}
    {quest.acceptedParty === userParty && quest.acceptedBy !== userCharName && (
      <p style={{fontSize: '0.9rem'}}>(Accettata da {quest.acceptedBy})</p>
    )}
  </div>
)}
      </div>
    </section>
  );
}