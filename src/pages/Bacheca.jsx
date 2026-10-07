import { useState, useEffect } from "react";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Bacheca.css";
import "../styles/cinematic.css";
import useParallaxScroll from "../hooks/useParallaxScroll";
import AmbientFX from "../components/AmbientFX";
import GlacierHero from "../components/glacier/GlacierHero";
import {
  collection, onSnapshot, doc, getDoc,
  query, where, getDocs,
  writeBatch, serverTimestamp
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import {
  PARTY_ROSTER, NO_PARTY, getPartyByCharName, questSlotOf, questLockRef,
  questMonthKey, nextMonthLabel, acceptQuest, releaseQuest,
} from "../data/questLimits";

const MASTER_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"]; // master + co-master
const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/treasure.png";

export default function Bacheca() {
  const navigate = useNavigate();
  const [quests, setQuests]             = useState([]);
  const [userCharName, setUserCharName] = useState("");
  const [userParty, setUserParty]       = useState("");
  const [loading, setLoading]           = useState(true);
  const [hoveredId, setHoveredId]       = useState(null);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState(null); // null | "available" | "accepted"

  const { currentUser } = useAuth();
  const isMaster = MASTER_EMAILS.includes(currentUser?.email);
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

  // ── Sigillo della quindicina: una missione ogni 2 settimane per gruppo ──────
  const [monthLock, setMonthLock] = useState(null);
  const [notice, setNotice]       = useState("");
  const [busyId, setBusyId]       = useState(null);
  useEffect(() => {
    if (!userCharName || isMaster) { setMonthLock(null); return; }
    const ref = questLockRef(questSlotOf(userCharName, userParty), questMonthKey());
    return onSnapshot(ref, (snap) => setMonthLock(snap.exists() ? snap.data() : null), () => setMonthLock(null));
  }, [userCharName, userParty, isMaster]);
  const monthTaken = !!monthLock;

  // ── Accetta / Rilascia ─────────────────────────────────────
  const toggleQuestStatus = async (quest, accept) => {
    if (busyId) return;
    setBusyId(quest.id);
    setNotice("");
    try {
      if (!accept) {
        await releaseQuest(quest);
        return;
      }
      if (!userCharName) { setNotice("Il tuo personaggio non ha un nome valido."); return; }
      await acceptQuest({ questId: quest.id, charName: userCharName, isMaster });

      // la missione va al gruppo: avvisa tutti i membri del party di chi l'ha presa
      const batch = writeBatch(db);
      const membersNames = userParty !== NO_PARTY ? (PARTY_ROSTER[userParty] || []) : [];
      if (membersNames.length > 0) {
        const charQuery = query(collection(db, "characters"), where("name", "in", membersNames));
        const charSnaps = await getDocs(charQuery);
        charSnaps.forEach((memberDoc) => {
          batch.set(doc(collection(db, "notifications")), {
            userId:    memberDoc.id,
            title:     "⚔️ Missione di Gruppo!",
            message:   `${userCharName} ha accettato "${quest.title}" per il party ${userParty}. È la missione della quindicina: preparatevi!`,
            read:      false,
            timestamp: serverTimestamp(),
          });
        });
      } else {
        batch.set(doc(collection(db, "notifications")), {
          userId:    currentUser.uid,
          title:     "📜 Incarico Accettato",
          message:   `Hai preso in carico la missione: "${quest.title}".`,
          read:      false,
          timestamp: serverTimestamp(),
        });
      }
      await batch.commit().catch((err) => console.error("Notifiche missione:", err));
    } catch (err) {
      if (err?.code === "limit" || err?.code === "taken") setNotice(err.message);
      else { console.error("Errore gestione incarico:", err); setNotice("Qualcosa è andato storto, riprova."); }
    } finally {
      setBusyId(null);
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
  const q = search.trim().toLowerCase();
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
    <section className="cine-page bacheca-page cine-compact" style={{ "--cine-accent": "var(--el)", "--cine-accent-2": "var(--el-soft)" }}>
      <AmbientFX variant="fireflies" />

      {/* ── HERO = VARCO (prototipo J): il tesoro nel portale esagonale,
            saluto dinamico sotto la testata, CTA verso l'albo ── */}
      <GlacierHero
        id="bacheca-top"
        ariaLabel="Hemile's Board"
        image={HERO_IMAGE}
        eyebrow="Bacheca di Hemile"
        title={<>Hemile's<br />Board</>}
        seal={userCharName
          ? `${userCharName}${userParty && userParty !== NO_PARTY ? ` · Party ${userParty}` : ""}`
          : undefined}
        tagline="Pergamene, sigilli e missive attendono mani coraggiose."
        actions={<a href="#bacheca-albo" className="gl-cta" aria-label="Scorri all'albo">✦ Apri l'albo</a>}
      >
        <p className="bch-glacier-greet">
          Bentornato, <strong>{userCharName || "Avventuriero"}</strong>
          {userParty && userParty !== NO_PARTY ? <> — Party <strong>{userParty}</strong></> : ""}.
        </p>
      </GlacierHero>

      {/* ══ L'ALBO DEL NESSO: etichetta, ricerca a pillola, filtri-satellite ══ */}
      <div id="bacheca-albo" className="gl-sezlabel">Incarichi · Le Missive</div>
      <p className="nx-nota bch-sezsub">
        Scegli con cura: lascia che il tuo nome resti scolpito nella memoria dei mondani.
        {" "}Ogni gruppo può prendere <strong>una missione ogni due settimane</strong> (dall’1 al 15 e dal 16 a fine mese).
      </p>

      {!isMaster && monthTaken && (
        <p className="nx-nota bch-month-lock" role="status">
          🛡 {userParty !== NO_PARTY ? <>Il party <strong>{userParty}</strong> ha</> : "Hai"} già preso la missione di questa quindicina:{" "}
          <strong>"{monthLock.questTitle}"</strong>{monthLock.by ? <> (scelta da {monthLock.by})</> : null}.
          {" "}La prossima dal <strong>{nextMonthLabel()}</strong>.
        </p>
      )}
      {notice && <p className="nx-nota bch-month-lock is-warn" role="alert">{notice}</p>}

      {!loading && questEntries.length > 0 && (
        <div className="bch-toolbar">
          <input
            type="search"
            className="bch-search"
            placeholder="Cerca per titolo, gruppo o personaggio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cerca missive"
          />
          <div className="nx-pillole bch-filtri" role="group" aria-label="Filtra per stato">
            <button type="button" className={`nx-pillola${statusFilter == null ? " on" : ""}`} onClick={() => setStatusFilter(null)}>✦ Tutte</button>
            <button type="button" className={`nx-pillola${statusFilter === "available" ? " on" : ""}`} onClick={() => setStatusFilter("available")}>📜 Disponibili</button>
            <button type="button" className={`nx-pillola${statusFilter === "accepted" ? " on" : ""}`} onClick={() => setStatusFilter("accepted")}>🛡 In corso</button>
          </div>
          <span className="bch-count">{visibleQuests.length} {visibleQuests.length === 1 ? "missiva" : "missive"}</span>
        </div>
      )}

      {loading ? (
        <div className="cine-loading"><span className="cine-loading-icon">📜</span>Caricamento pergamene…</div>
      ) : questEntries.length === 0 ? (
        <div className="cine-empty">Nessuna missiva al momento. Torna più tardi.</div>
      ) : visibleQuests.length === 0 ? (
        <div className="cine-empty">Nessuna missiva corrisponde alla ricerca.</div>
      ) : (
        <div className="nx-griglia scrolls-grid">
          {visibleQuests.map((quest) => {
            const isAccepted          = !!quest.acceptedBy;
            const isAcceptedByMe      = quest.acceptedBy === userCharName;
            const isAcceptedByMyParty = quest.acceptedParty === userParty;
            const isPartyQuest        = quest.targetParty && quest.targetParty !== "All";
            const isPrivate           = quest.targetCharacter && quest.targetCharacter !== "All";
            const isHovered           = hoveredId === quest.id;
            const isOpenVisual        = !quest._sealed && (isAccepted || (quest._canOpen && isHovered));
            const badgeIcon           = quest._sealed ? "🔒" : isPrivate ? "🔒" : isPartyQuest ? "🛡️" : "🌐";
            const tag = quest._sealed ? "Sigillata"
              : isAccepted ? "In corso"
              : isPrivate ? "Privata"
              : isPartyQuest ? quest.targetParty
              : "Aperta";

            const cardClass = [
              "nx-pannello",
              quest._canOpen ? "nx-pannello--tap" : "",
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
                <span className={`nx-tag quest-tag${isAccepted ? " is-accepted" : ""}`}>{tag}</span>

                {/* sigillo della missiva: la pergamena si apre da sola al passaggio */}
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

                <h3 className="nx-nome quest-card-title">
                  {quest._sealed ? "Missiva sigillata" : quest.title}
                </h3>

                {quest._sealed ? (
                  <p className="nx-meta quest-card-meta sealed">
                    In carico al gruppo {quest.acceptedParty}
                  </p>
                ) : (
                  <>
                    {isPrivate && (
                      <p className="nx-meta quest-card-meta private">
                        Solo per {quest.targetCharacter}
                      </p>
                    )}
                    {isPartyQuest && !isAccepted && (
                      <p className="nx-meta quest-card-meta party">
                        Riservata a {quest.targetParty}
                      </p>
                    )}

                    {isAccepted && (
                      <div className="quest-card-accepted">
                        <p className="nx-nota">
                          In carico al gruppo{" "}
                          <strong className={isAcceptedByMyParty ? "mine" : "others"}>
                            {quest.acceptedParty || quest.acceptedBy}
                          </strong>
                        </p>
                        {(isAcceptedByMe || isMaster || isAcceptedByMyParty) && (
                          <button
                            type="button"
                            className="nx-pillola btn-quest btn-quest-release"
                            disabled={busyId === quest.id}
                            onClick={(e) => { e.stopPropagation(); toggleQuestStatus(quest, false); }}
                          >
                            Rilascia
                          </button>
                        )}
                      </div>
                    )}

                    {!isAccepted && isHovered && quest._canOpen && (
                      monthTaken && !isMaster ? (
                        <span className="nx-pillola btn-quest btn-quest-locked" aria-disabled="true">
                          Missione della quindicina già presa
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="gl-cta btn-quest btn-quest-accept"
                          disabled={busyId === quest.id}
                          onClick={(e) => { e.stopPropagation(); toggleQuestStatus(quest, true); }}
                        >
                          Accetta ora
                        </button>
                      )
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
