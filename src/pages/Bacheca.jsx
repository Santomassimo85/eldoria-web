import { useState, useEffect } from "react";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Bacheca.css";
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
  "ENOX": ["Temistocle Sottocolle Milo", "Dante", "Roynot", "Vyger", "Timoty Bevibotte", "Alaric Voltasorte"],
  "LAC":  ["Horn", "Thinkle Muschioverde", "Cleofe"],
  "LEAF": ["Makenna", "Taaras Stormrage", "Soran", "Zethir Nightwhisper"],
  "ECO":  ["Aksel", "Dago", "Ismael Van Dyke"],
};

const getPartyByCharName = (name) => {
  for (const [party, members] of Object.entries(PARTY_ROSTER)) {
    if (members.includes(name)) return party;
  }
  return "Senza Gruppo";
};

export default function Bacheca() {
  const navigate = useNavigate();
  const [quests, setQuests]             = useState([]);
  const [userCharName, setUserCharName] = useState("");
  const [userParty, setUserParty]       = useState("");
  const [loading, setLoading]           = useState(true);
  const [hoveredId, setHoveredId]       = useState(null);

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
        visible = true; canOpen = false; sealed = true;
      }
    } else {
      visible = true; canOpen = true;
    }

    return { ...quest, _canOpen: canOpen, _sealed: sealed, _visible: visible };
  }).filter(q => q._visible);

  // ── Render ─────────────────────────────────────────────────
  return (
    <section className="bacheca-page">
      <div className="bacheca-header">
        <h1 className="bacheca-title">Hemile's Board</h1>
        <div className="bacheca-divider">
          <span className="bacheca-divider-icon">✦</span>
        </div>
        <p className="bacheca-subtitle">
          Bentornato, <strong>{userCharName || "Avventuriero"}</strong>
          {userParty && userParty !== "Senza Gruppo" ? ` — Party ${userParty}` : ""}
        </p>
      </div>

      <div className="bacheca-intro">
        Il vento porta nuove richieste sulla bacheca di Hemile. Pergamene, sigilli
        e missive attendono mani coraggiose: scegli con cura, e lascia che il tuo
        nome resti scolpito nella memoria dei mondani.
      </div>

      {loading ? (
        <div className="bacheca-loading">📜 Caricamento pergamene…</div>
      ) : questEntries.length === 0 ? (
        <div className="bacheca-empty">Nessuna missiva al momento. Torna più tardi.</div>
      ) : (
        <div className="scrolls-grid">
          {questEntries.map((quest) => {
            const isAccepted          = !!quest.acceptedBy;
            const isAcceptedByMe      = quest.acceptedBy === userCharName;
            const isAcceptedByMyParty = quest.acceptedParty === userParty;
            const isPartyQuest        = quest.targetParty && quest.targetParty !== "All";
            const isPrivate           = quest.targetCharacter && quest.targetCharacter !== "All";
            const isHovered           = hoveredId === quest.id;
            const isOpenVisual        = !quest._sealed && (isAccepted || (quest._canOpen && isHovered));
            const badgeIcon           = quest._sealed ? "🔒" : isPrivate ? "🔒" : isPartyQuest ? "🛡️" : "🌐";

            const cardClass = [
              "quest-card",
              quest._canOpen ? "is-clickable" : "",
              isOpenVisual ? "is-open" : "",
              isAccepted ? "accepted" : "",
              quest._sealed ? "sealed" : "",
            ].filter(Boolean).join(" ");

            return (
              <article
                key={quest.id}
                className={cardClass}
                onClick={() => quest._canOpen && navigate(`/quest/${quest.id}`)}
                onMouseEnter={() => quest._canOpen && setHoveredId(quest.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => quest._canOpen && setHoveredId(quest.id)}
                onBlur={() => setHoveredId(null)}
                tabIndex={quest._canOpen ? 0 : -1}
              >
                <span className="quest-badge" aria-hidden="true">{badgeIcon}</span>

                <div className="scroll-frame">
                  <img className="scroll-img closed" src="/closedScroll.png" alt="" />
                  {quest.coverImage ? (
                    <img
                      className="scroll-img open cover"
                      src={quest.coverImage}
                      alt=""
                      onError={(e) => { e.currentTarget.src = "/openScroll.png"; }}
                    />
                  ) : (
                    <img className="scroll-img open" src="/openScroll.png" alt="" />
                  )}
                </div>

                <h3 className="quest-card-title">
                  {quest._sealed ? "Missiva sigillata" : quest.title}
                </h3>

                {quest._sealed ? (
                  <p className="quest-card-meta sealed">
                    In carico al gruppo {quest.acceptedParty}
                  </p>
                ) : (
                  <>
                    {isPrivate && (
                      <p className="quest-card-meta private">
                        Solo per {quest.targetCharacter}
                      </p>
                    )}
                    {isPartyQuest && !isAccepted && (
                      <p className="quest-card-meta party">
                        Riservata a {quest.targetParty}
                      </p>
                    )}

                    {isAccepted && (
                      <div className="quest-card-accepted">
                        <p>
                          In carico al gruppo{" "}
                          <strong className={isAcceptedByMyParty ? "mine" : "others"}>
                            {quest.acceptedParty || quest.acceptedBy}
                          </strong>
                        </p>
                        {(isAcceptedByMe || isMaster || isAcceptedByMyParty) && (
                          <button
                            type="button"
                            className="btn-quest btn-quest-release"
                            onClick={(e) => { e.stopPropagation(); toggleQuestStatus(quest, false); }}
                          >
                            Rilascia
                          </button>
                        )}
                      </div>
                    )}

                    {!isAccepted && isHovered && quest._canOpen && (
                      <button
                        type="button"
                        className="btn-quest btn-quest-accept"
                        onClick={(e) => { e.stopPropagation(); toggleQuestStatus(quest, true); }}
                      >
                        Accetta Ora
                      </button>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
