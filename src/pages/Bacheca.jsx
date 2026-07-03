import { useState, useEffect } from "react";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Bacheca.css";
import "../styles/cinematic.css";
import useParallaxScroll from "../hooks/useParallaxScroll";
import AmbientFX from "../components/AmbientFX";
import CineToolbar from "../components/CineToolbar";
import {
  collection, onSnapshot, doc, getDoc,
  updateDoc, query, where, getDocs,
  writeBatch, serverTimestamp
} from "firebase/firestore";
import { useAuth } from "../AuthContext";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/treasure.png";

// ── Unica fonte di verità per i party ─────────────────────────
const PARTY_ROSTER = {
  "AMEA": ["Tanagar", "Garroth Tel´Arion", "Caius Maxis-Richtofen"],
  "ENOX": ["Makenna", "Temistocle Sottocolle Milo", "Alaric Voltasorte", "Lael"],
  "LAC":  ["Horn", "Thinkle Muschioverde", "Cleofe"],
  "LEAF": ["Soran", "Zethir Nightwhisper", "Aksel", "Dago"],
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
  const [query, setQuery]               = useState("");
  const [statusFilter, setStatusFilter] = useState(null); // null | "available" | "accepted"

  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === MASTER_EMAIL;
  useParallaxScroll();

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

  // ── Ricerca: titolo / gruppo / personaggio + filtro stato ──
  const q = query.trim().toLowerCase();
  const matchesQuest = (quest) => {
    const byStatus =
      statusFilter == null ? true :
      statusFilter === "accepted" ? !!quest.acceptedBy :
      !quest.acceptedBy;
    if (!byStatus) return false;
    if (!q) return true;
    // le missive sigillate mostrano solo il gruppo che le ha in carico
    const hay = quest._sealed
      ? [quest.acceptedParty]
      : [quest.title, quest.description, quest.targetParty, quest.targetCharacter, quest.acceptedParty, quest.acceptedBy];
    return hay.filter(Boolean).join(" ").toLowerCase().replace(/<[^>]*>/g, " ").includes(q);
  };
  const visibleQuests = questEntries.filter(matchesQuest);

  // ── Render ─────────────────────────────────────────────────
  return (
    <section className="cine-page bacheca-page cine-compact" style={{ "--cine-accent": "#9a4e16", "--cine-accent-2": "#c2691f" }}>
      <AmbientFX variant="fireflies" />

      {/* ── HERO ASIMMETRICO: immagine full-bleed + placca-saluto a sinistra ── */}
      <section id="bacheca-top" className="bch-hero" aria-label="Hemile's Board">
        <div className="bch-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
        <div className="bch-hero-wash" aria-hidden="true" />
        <div className="bch-hero-plate">
          <span className="bch-hero-seal">✦ Bacheca di Hemile</span>
          <h1 className="bch-hero-title">Hemile's<br />Board</h1>
          <p className="bch-hero-greet">
            Bentornato, <strong>{userCharName || "Avventuriero"}</strong>
            {userParty && userParty !== "Senza Gruppo" ? <> — Party <strong>{userParty}</strong></> : ""}.
          </p>
          <p className="bch-hero-tagline">
            Pergamene, sigilli e missive attendono mani coraggiose.
          </p>
        </div>
        <a href="#bacheca-albo" className="bch-hero-scroll" aria-label="Scorri all'albo">
          <span className="bch-hero-scroll-tx">Scorri</span>
          <span className="bch-hero-scroll-ic" aria-hidden="true">↓</span>
        </a>
      </section>

      {/* ── RUBRICA: Le Missive ── */}
      <div id="bacheca-albo" className="bch-rubric">
        <span className="bch-rubric-eyebrow">Incarichi</span>
        <h2 className="bch-rubric-title">Le Missive</h2>
        <p className="bch-rubric-sub">
          Scegli con cura: lascia che il tuo nome resti scolpito nella memoria dei mondani.
        </p>
      </div>

      {!loading && questEntries.length > 0 && (
        <CineToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Cerca per titolo, gruppo o personaggio…"
          chips={[{ key: "available", label: "📜 Disponibili" }, { key: "accepted", label: "🛡 In corso" }]}
          activeChip={statusFilter}
          onChip={setStatusFilter}
          allLabel="Tutte"
          count={visibleQuests.length}
          countNoun={visibleQuests.length === 1 ? "missiva" : "missive"}
        />
      )}

      {loading ? (
        <div className="cine-loading"><span className="cine-loading-icon">📜</span>Caricamento pergamene…</div>
      ) : questEntries.length === 0 ? (
        <div className="cine-empty">Nessuna missiva al momento. Torna più tardi.</div>
      ) : visibleQuests.length === 0 ? (
        <div className="cine-empty">Nessuna missiva corrisponde alla ricerca.</div>
      ) : (
        <div className="bch-board">
        <div className="scrolls-grid">
          {visibleQuests.map((quest) => {
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
        </div>
      )}
    </section>
  );
}
