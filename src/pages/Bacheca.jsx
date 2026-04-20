import { useState, useEffect } from "react";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./admin.css";
import {
  collection, onSnapshot, doc, getDoc,
  updateDoc, query, where, getDocs,
  writeBatch, serverTimestamp
} from "firebase/firestore";
import { useAuth } from "../AuthContext";

const MASTER_EMAIL = "santomassimo85@gmail.com";

// ── Unica fonte di verità per i party ─────────────────────────
const PARTY_ROSTER = {
  "AMEA": ["Tanagar", "Garroth Tel´Arion", "Caius Maxis-Richtofen"],
  "ENOX": ["Temistocle Sottocolle Milo", "Dante", "Roynot", "Vyger", "Timoty Bevibotte"],
  "LAC":  ["Horn", "Thinkle Muschioverde", "Cleofe"],
  "LEAF": ["Makenna", "Taaras Stormrage", "Soran", "Zethir Nightwhisper"],
};

const getPartyByCharName = (name) => {
  for (const [party, members] of Object.entries(PARTY_ROSTER)) {
    if (members.includes(name)) return party;
  }
  return "Senza Gruppo";
};

export default function Bacheca() {
  const navigate = useNavigate();
  const [quests, setQuests]           = useState([]);
  const [userCharName, setUserCharName] = useState("");
  const [userParty, setUserParty]     = useState("");
  const [loading, setLoading]         = useState(true);
  const [hoveredId, setHoveredId]     = useState(null);

  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === MASTER_EMAIL;

  useEffect(() => {
    if (!currentUser) return;
    const fetchUserChar = async () => {
      const snap = await getDoc(doc(db, "characters", currentUser.uid));
      if (snap.exists()) {
        const name = snap.data().name || "";
        setUserCharName(name);
        setUserParty(getPartyByCharName(name));
      }
    };
    fetchUserChar();
  }, [currentUser]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "quests"), (snapshot) => {
      setQuests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Accetta / Rilascia ─────────────────────────────────────
  const toggleQuestStatus = async (quest, accept) => {
    try {
      const batch    = writeBatch(db);
      const questRef = doc(db, "quests", quest.id);

      batch.update(questRef, {
        acceptedBy:    accept ? userCharName : null,
        acceptedParty: accept ? userParty    : null,
        status:        accept ? "in_progress" : "available",
      });

      if (accept) {
        const isPartyQuest = quest.targetParty && quest.targetParty !== "All";
        const membersNames = isPartyQuest ? (PARTY_ROSTER[quest.targetParty] || []) : [];

        if (membersNames.length > 0) {
          const charQuery = query(collection(db, "characters"), where("name", "in", membersNames));
          const charSnaps = await getDocs(charQuery);
          charSnaps.forEach((memberDoc) => {
            const notifyRef = doc(collection(db, "notifications"));
            batch.set(notifyRef, {
              userId:    memberDoc.id,
              title:     "⚔️ Missione di Gruppo!",
              message:   `${userCharName} ha accettato "${quest.title}" per il party ${userParty}. Preparatevi!`,
              read:      false,
              timestamp: serverTimestamp(),
            });
          });
        } else {
          const notifyRef = doc(collection(db, "notifications"));
          batch.set(notifyRef, {
            userId:    currentUser.uid,
            title:     "📜 Incarico Accettato",
            message:   `Hai preso in carico la missione: "${quest.title}".`,
            read:      false,
            timestamp: serverTimestamp(),
          });
        }
      }

      await batch.commit();
    } catch (err) {
      console.error("Errore gestione incarico:", err);
    }
  };

  // ── Visibilità e permessi ──────────────────────────────────
  // visible:  la missiva compare in bacheca
  // canOpen:  puoi cliccare e aprire i dettagli
  // sealed:   vedi solo l'icona (quest party accettata da altri)
  const questEntries = quests.map((quest) => {
    const isPartyQuest = quest.targetParty && quest.targetParty !== "All";
    const isCharQuest  = quest.targetCharacter && quest.targetCharacter !== "All";

    let visible = false, canOpen = false, sealed = false;

    if (isMaster) {
      visible = true; canOpen = true;
    } else if (isCharQuest) {
      visible = quest.targetCharacter === userCharName;
      canOpen = visible;
    } else if (isPartyQuest) {
      const isMyParty = quest.targetParty === userParty;
      if (isMyParty) {
        visible = true; canOpen = true;
      } else if (quest.acceptedBy) {
        // Accettata da un altro party → scroll sigillato visibile a tutti
        visible = true; canOpen = false; sealed = true;
      }
      // Non mio party + non ancora accettata → completamente nascosta
    } else {
      // Generale
      visible = true; canOpen = true;
    }

    return { ...quest, _canOpen: canOpen, _sealed: sealed, _visible: visible };
  }).filter(q => q._visible);

  // ── Render ─────────────────────────────────────────────────
  return (
    <section className="bacheca-page">
      <h1 className="bacheca-title">Hemile's Board</h1>
      <p className="bacheca-subtitle">
        Bentornato, {userCharName || "Avventuriero"}
        {userParty && userParty !== "Senza Gruppo" ? ` — Party ${userParty}` : ""}
      </p>

      {loading ? (
        <p style={{ textAlign: "center" }}>Caricamento pergamene...</p>
      ) : (
        <div className="scrolls-container" style={{ display: "flex", flexWrap: "wrap", gap: "20px", justifyContent: "center" }}>
          {questEntries.map((quest) => {
            const isAccepted        = !!quest.acceptedBy;
            const isAcceptedByMe    = quest.acceptedBy === userCharName;
            const isAcceptedByMyParty = quest.acceptedParty === userParty;
            const isPartyQuest      = quest.targetParty && quest.targetParty !== "All";
            const isPrivate         = quest.targetCharacter && quest.targetCharacter !== "All";
            const isHovered         = hoveredId === quest.id;

            // Scroll sigillato: mostra solo l'icona senza interazione
            if (quest._sealed) {
              return (
                <div key={quest.id} style={{ textAlign: "center", width: "200px", opacity: 0.5 }}>
                  <img src="/closedScroll.png" alt="Missiva sigillata" style={{ width: "150px", filter: "grayscale(1)" }} />
                  <p style={{ fontSize: "0.75rem", color: "#888", marginTop: 4, fontStyle: "italic" }}>
                    🔒 In carico al gruppo {quest.acceptedParty}
                  </p>
                </div>
              );
            }

            return (
              <div
                key={quest.id}
                className={`scroll-item ${isAccepted ? "accepted" : ""}`}
                onClick={() => quest._canOpen && navigate(`/quest/${quest.id}`)}
                onMouseEnter={() => quest._canOpen && setHoveredId(quest.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  textAlign: "center",
                  cursor: quest._canOpen ? "pointer" : "default",
                  width: "200px",
                }}
              >
                <img
                  src={isAccepted || isHovered ? "/openScroll.png" : "/closedScroll.png"}
                  alt="Scroll"
                  style={{ width: "150px", filter: isAccepted ? "grayscale(0.5)" : "none" }}
                />

                <p className="scroll-title" style={{ fontWeight: "bold", margin: "5px 0" }}>
                  {isPrivate ? "🔒 " : isPartyQuest ? "🛡️ " : "🌐 "}{quest.title}
                </p>

                {isPrivate && (
                  <small style={{ color: "var(--gold)" }}>Solo per {quest.targetCharacter}</small>
                )}
                {isPartyQuest && !isAccepted && (
                  <small style={{ color: "#27ae60" }}>Riservata a {quest.targetParty}</small>
                )}

                {isAccepted && (
                  <div className="acceptance-info" style={{ fontSize: "0.8rem", marginTop: "5px" }}>
                    <p>
                      Presa in carico dal gruppo{" "}
                      <strong style={{ color: isAcceptedByMyParty ? "#27ae60" : "var(--red)" }}>
                        {quest.acceptedParty || quest.acceptedBy}
                      </strong>
                    </p>
                    {(isAcceptedByMe || isMaster || isAcceptedByMyParty) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleQuestStatus(quest, false); }}
                        style={{ background: "#ff4444", border: "none", color: "white", borderRadius: "4px", padding: "2px 8px", cursor: "pointer", marginTop: "5px" }}
                      >
                        Rilascia Incarico
                      </button>
                    )}
                  </div>
                )}

                {!isAccepted && isHovered && quest._canOpen && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleQuestStatus(quest, true); }}
                    className="btn-quick-accept"
                    style={{ background: "var(--gold)", border: "none", color: "black", borderRadius: "4px", padding: "5px 10px", cursor: "pointer", marginTop: "5px", fontWeight: "bold" }}
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
