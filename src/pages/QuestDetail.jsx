import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./admin.css";
import "../styles/cinematic.css";
import "./QuestDetail.css";
import useParallaxScroll from "../hooks/useParallaxScroll";
import GlacierHero from "../components/glacier/GlacierHero";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/wolf_alpha.png";

// ── Unica fonte di verità per i party ─────────────────────────
const PARTY_ROSTER = {
  "AMEA": ["Tanagar", "Garroth", "Caius Maxis-Richtofen"],
  "ENOX": ["Makenna", "Temistocle Sottocolle Milo", "Alaric Voltasorte", "Lael"],
  "LAC":  ["Horn", "Thinkle Muschioverde", "Cleofe"],
  "LEAF": ["Soran", "Zethir", "Aksel", "Dago"],
};

const getPartyByCharName = (name) => {
  for (const [party, members] of Object.entries(PARTY_ROSTER)) {
    if (members.includes(name)) return party;
  }
  return "Senza Gruppo";
};

export default function QuestDetail() {
  useParallaxScroll();
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
      <section className="cine-page quest-detail-page" style={{ "--cine-accent": "#8b5cf6", "--cine-accent-2": "#c4b5fd" }}>
        <p className="qd-stato">Leggendo i sigilli...</p>
      </section>
    );
  }

  if (!quest) {
    return (
      <section className="cine-page quest-detail-page" style={{ "--cine-accent": "#8b5cf6", "--cine-accent-2": "#c4b5fd" }}>
        <p className="qd-stato">Incarico non trovato.</p>
      </section>
    );
  }

  const access = canAccess();

  if (access === false) {
    return (
      <section className="cine-page quest-detail-page" style={{ "--cine-accent": "#8b5cf6", "--cine-accent-2": "#c4b5fd" }}>
        <div className="qd-corpo qd-corpo--stato">
          <button onClick={() => navigate("/bacheca")} className="nx-pillola qd-back">← Torna alla Bacheca</button>
          <div className="nx-pannello qd-sigillata">
            <p className="qd-lucchetto" aria-hidden="true">🔒</p>
            <h2 className="nx-titolo">Missiva Sigillata</h2>
            <p className="nx-nota">Questa pergamena non è destinata a te.</p>
          </div>
        </div>
      </section>
    );
  }

  const isAccepted        = !!quest.acceptedBy;
  const isAcceptedByMyParty = quest.acceptedParty === userParty;

  return (
    <section className="cine-page quest-detail-page" style={{ "--cine-accent": "#8b5cf6", "--cine-accent-2": "#c4b5fd" }}>
      {/* ── HERO = VARCO (prototipo J): la copertina della missiva nel portale
            esagonale, sigillo con la zona, titolo a gradiente accanto ── */}
      <GlacierHero
        id="quest-top"
        ariaLabel={quest.title}
        image={quest.coverImage || HERO_IMAGE}
        eyebrow="Albo degli Incarichi"
        title={quest.title}
        seal={`📜 Incarico${quest.zona ? ` · ${quest.zona}` : ""}`}
        tagline={`Emesso da ${quest.sender || "Mittente Misterioso"}`}
      />

      {/* ══ IL CORPO DELLA MISSIVA: pannello largo centrato ══ */}
      <div className="qd-corpo">
        <button onClick={() => navigate(-1)} className="nx-pillola qd-back">← Torna alla Bacheca</button>

        <article className="nx-pannello qd-missiva">
          <span className="nx-tag">{isAccepted ? "In corso" : "Disponibile"}</span>
          <div className="gl-sezlabel qd-sez">La missiva</div>

          <div className="nx-meta-box qd-meta">
            <p><strong>Emesso da:</strong> {quest.sender || "Mittente Misterioso"}</p>
            <p><strong>Zona:</strong> {quest.zona}</p>
          </div>

          <p className="nx-prosa quest-detail-lore">{quest.desc}</p>

          <div className="nx-meta-box qd-ricompense">
            <p><strong>Ricompense:</strong> {quest.rewardGold || 0} Corone{quest.rewardItem ? `, ${quest.rewardItem}` : ""}</p>
          </div>

          {!isAccepted ? (
            <div className="qd-azioni">
              <button onClick={handleAccept} className="gl-cta questDetailButton">
                ⚔ Accetta missione
              </button>
            </div>
          ) : (
            <div className="nx-citazione qd-presa">
              <p>
                Presa in carico dal gruppo{" "}
                <strong className={isAcceptedByMyParty ? "mine" : "others"}>
                  {quest.acceptedParty || quest.acceptedBy}
                </strong>
              </p>
              {isAcceptedByMyParty && quest.acceptedBy !== userCharName && (
                <p className="nx-nota">(Accettata da {quest.acceptedBy})</p>
              )}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
