import React, { useEffect, useState, useMemo, useRef } from "react";
import { db } from "../firebase";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp, increment,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import {
  TCG_CARDS, TCG_CARD_LIST, TCG_MECHANICS, MECHANICS_ORDER,
  ELEMENT_ICON, ELEMENT_LABEL, RARITY_LABEL, RARITY_COLOR,
  ELEMENT_CYCLE, LIGHT_DARK, randomCompliment,
  PACK_DEFS, PACK_ORDER, openPack, openStarterPack,
  TRASH_REFUND, FOIL_TRASH_REFUND, FOIL_RATE, trashRefundFor,
} from "../data/tcgCards";
import {
  initMatchState, playCard, attackWith, endTurn, forfeit,
  canPlayCard, canAttack, legalAttackTargets, oppSide,
  STARTING_HP, DECK_REQUIRED_SIZE,
  isValidDeck, ownsDeck, deckCount, autoBuildDeckFromCollection,
  resolveDeckForMatch,
} from "../utils/tcg";
import "./Tcg.css";

/* ============================================================
   ELDORIA TCG — Magic-style D&D 1v1 trading card game.
   Tabs: Sfide · Bottega · Collezione · Carte · Manuale.
   First-time players are prompted to pick a free starter pack
   (20 cards biased toward an element of their choosing).
   ============================================================ */
export default function Tcg() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState("lobby");
  const [me, setMe] = useState(null);
  const [openMatches, setOpenMatches] = useState([]);
  const [activeMatches, setActiveMatches] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [packReveal, setPackReveal] = useState(null);   // { packDef, cards }
  const [starterOpen, setStarterOpen] = useState(false);
  const [message, setMessage] = useState(null);         // { text, ok }
  const [viewingCard, setViewingCard] = useState(null); // { cardId, foil } | null
  const viewCard = (cardId, foil = false) => setViewingCard({ cardId, foil });

  const showMsg = (text, ok = true) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 3000);
  };

  /* ── Live "me" snapshot ───────────────────────────────── */
  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(doc(db, "characters", currentUser.uid), s => {
      if (s.exists()) setMe({ uid: currentUser.uid, ...s.data() });
    });
  }, [currentUser]);

  /* ── Open starter modal once when the player has never
       claimed it. We wait for `me` to load to avoid flashing. */
  useEffect(() => {
    if (!me) return;
    if (me.tcgStarterClaimed) return;
    if (starterOpen) return;
    setStarterOpen(true);
  }, [me, starterOpen]);

  /* ── Stream all TCG matches ───────────────────────────── */
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "tcg_matches"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOpenMatches(all.filter(m => m.status === "open"));
      setActiveMatches(all.filter(m => {
        if (m.status !== "active") return false;
        return m.challenger?.uid === currentUser.uid || m.challenged?.uid === currentUser.uid;
      }));
      setRecentMatches(all.filter(m => m.status === "ended").slice(0, 8));
    });
  }, [currentUser]);

  /* ── Auto-enter active match ──────────────────────────── */
  useEffect(() => {
    if (activeMatchId) return;
    const mine = activeMatches[0];
    if (mine) setActiveMatchId(mine.id);
  }, [activeMatches, activeMatchId]);

  /* ── Claim free starter pack ─────────────────────────── */
  const claimStarter = async (element) => {
    if (!currentUser || !me) return;
    if (me.tcgStarterClaimed) { setStarterOpen(false); return; }
    // Light and Dark are shop-exclusive — refuse them as a starter choice.
    if (element === "light" || element === "dark") return;
    const drawn = openStarterPack(element); // [{cardId, foil}]
    if (drawn.length === 0) return;
    const { normals, foils } = splitDrawn(drawn);
    const patch = {
      tcgStarterClaimed: true,
      tcgStarterElement: element,
      tcgDeck: drawn.slice(0, DECK_REQUIRED_SIZE).map(d => d.cardId),
    };
    for (const [id, n] of Object.entries(normals)) {
      patch[`tcgCollection.${id}`] = increment(n);
    }
    for (const [id, n] of Object.entries(foils)) {
      patch[`tcgFoils.${id}`] = increment(n);
    }
    try {
      await updateDoc(doc(db, "characters", currentUser.uid), patch);
      setPackReveal({
        packDef: { ...PACK_DEFS[element], name: "Pacchetto Iniziale", size: drawn.length },
        cards: drawn,
      });
      setStarterOpen(false);
    } catch (err) {
      console.error("starter claim failed:", err);
      alert("Errore: " + err.message);
    }
  };

  /* ── Buy a pack ───────────────────────────────────────── */
  const buyPack = async (packKey) => {
    if (!currentUser || !me) return;
    const def = PACK_DEFS[packKey];
    if (!def) return;
    const balance = me.petPoints || 0;
    if (balance < def.cost) {
      showMsg(`Servono ${def.cost - balance} ✦ in più.`, false);
      return;
    }
    const drawn = openPack(packKey); // [{cardId, foil}]
    const { normals, foils } = splitDrawn(drawn);
    const patch = { petPoints: increment(-def.cost) };
    for (const [id, n] of Object.entries(normals)) {
      patch[`tcgCollection.${id}`] = increment(n);
    }
    for (const [id, n] of Object.entries(foils)) {
      patch[`tcgFoils.${id}`] = increment(n);
    }
    try {
      await updateDoc(doc(db, "characters", currentUser.uid), patch);
      setPackReveal({ packDef: def, cards: drawn });
    } catch (err) {
      console.error("buyPack failed:", err);
      showMsg("Acquisto fallito: " + err.message, false);
    }
  };

  /* ── Trash a card from collection (refund in ✦) ──────── */
  const trashCard = async (cardId, foil = false) => {
    if (!currentUser || !me) return;
    const collMap = foil ? (me.tcgFoils || {}) : (me.tcgCollection || {});
    const owned = collMap[cardId] || 0;
    if (owned <= 0) return;
    const card = TCG_CARDS[cardId];
    if (!card) return;
    const refund = trashRefundFor(cardId, foil);
    if (!window.confirm(
      `Distruggere una copia ${foil ? "✨ BRILLANTE " : ""}di "${card.name}" (${RARITY_LABEL[card.rarity]})?\n` +
      `Recupererai ${refund} ✦ Punti Bestiario.\n` +
      `Possedute: ${owned} · operazione irreversibile.`
    )) return;
    const fieldPath = foil ? `tcgFoils.${cardId}` : `tcgCollection.${cardId}`;
    const patch = {
      [fieldPath]: increment(-1),
      petPoints: increment(refund),
    };
    // The deck draws from the combined (normal + foil) pool. If
    // trashing brings the total below the deck count, trim.
    const totalNormalAfter = (me.tcgCollection?.[cardId] || 0) - (foil ? 0 : 1);
    const totalFoilAfter   = (me.tcgFoils?.[cardId] || 0)      - (foil ? 1 : 0);
    const totalAfter = totalNormalAfter + totalFoilAfter;
    const inDeck = deckCount(me.tcgDeck, cardId);
    if (inDeck > totalAfter) {
      const newDeck = [...(me.tcgDeck || [])];
      let toRemove = inDeck - totalAfter;
      for (let i = newDeck.length - 1; i >= 0 && toRemove > 0; i--) {
        if (newDeck[i] === cardId) { newDeck.splice(i, 1); toRemove--; }
      }
      patch.tcgDeck = newDeck;
    }
    try {
      await updateDoc(doc(db, "characters", currentUser.uid), patch);
      showMsg(`🗑 ${foil ? "✨ " : ""}"${card.name}" distrutto · +${refund} ✦`);
    } catch (err) {
      console.error("trashCard failed:", err);
      showMsg("Distruzione fallita.", false);
    }
  };

  /* ── Save / clear deck ────────────────────────────────── */
  const saveDeck = async (newDeck) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, "characters", currentUser.uid), { tcgDeck: newDeck });
      showMsg(`💾 Mazzo salvato (${newDeck.length} carte).`);
    } catch (err) {
      console.error("saveDeck failed:", err);
      showMsg("Salvataggio mazzo fallito.", false);
    }
  };

  /* ── Create challenge ─────────────────────────────────── */
  const createChallenge = async () => {
    if (!currentUser || !me) return;
    const deck = resolveDeckForMatch(me.tcgDeck, me.tcgCollection, me.tcgFoils);
    try {
      await addDoc(collection(db, "tcg_matches"), {
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        challenger: { uid: currentUser.uid, name: me.name || "Sfidante" },
        challengerDeck: deck,
        challenged: null,
        state: null,
      });
    } catch (err) {
      console.error("create tcg challenge failed:", err);
      alert("Errore: " + err.message);
    }
  };

  /* ── Accept challenge ─────────────────────────────────── */
  const acceptChallenge = async (match) => {
    if (!currentUser || !me) return;
    if (match.challenger.uid === currentUser.uid) {
      alert("Non puoi accettare la tua stessa sfida.");
      return;
    }
    try {
      const cDeck = (isValidDeck(match.challengerDeck))
        ? match.challengerDeck
        : resolveDeckForMatch(null, null);
      const dDeck = resolveDeckForMatch(me.tcgDeck, me.tcgCollection, me.tcgFoils);
      const initState = initMatchState(cDeck, dDeck);
      await updateDoc(doc(db, "tcg_matches", match.id), {
        status: "active",
        updatedAt: serverTimestamp(),
        challenged: { uid: currentUser.uid, name: me.name || "Sfidato" },
        state: initState,
      });
      setActiveMatchId(match.id);
    } catch (err) {
      console.error("accept tcg failed:", err);
      alert("Errore: " + err.message);
    }
  };

  const cancelChallenge = async (match) => {
    if (!currentUser) return;
    if (match.challenger.uid !== currentUser.uid) return;
    if (!window.confirm("Annullare la tua sfida?")) return;
    try { await deleteDoc(doc(db, "tcg_matches", match.id)); } catch (err) { console.error(err); }
  };

  if (!currentUser) {
    return (
      <section className="tcg-page">
        <div className="tcg-locked">
          <div className="tcg-locked-icon">🎴</div>
          <h2>Eldoria TCG</h2>
          <p>Effettua l'accesso per scendere in campo.</p>
        </div>
      </section>
    );
  }

  /* ── If in a match, render the live board only ───────── */
  const activeMatch = activeMatches.find(m => m.id === activeMatchId);
  if (activeMatch) {
    return (
      <section className="tcg-page">
        <LiveMatch
          match={activeMatch}
          uid={currentUser.uid}
          onExit={() => setActiveMatchId(null)}
        />
      </section>
    );
  }

  const collection_ = me?.tcgCollection || {};
  const foils_ = me?.tcgFoils || {};
  const points = me?.petPoints || 0;
  const totalNormals = Object.values(collection_).reduce((s, n) => s + n, 0);
  const totalFoils = Object.values(foils_).reduce((s, n) => s + n, 0);

  return (
    <section className="tcg-page">
      <header className="tcg-head">
        <h1 className="tcg-title">
          <span className="tcg-title-icon">🎴</span>
          <span className="tcg-title-text">Eldoria TCG</span>
          <span className="tcg-title-spark">✦</span>
        </h1>
        <p className="tcg-sub">Magia, draghi e tattica · sfide 1v1 con carte di rarità leggendaria</p>
      </header>

      <div className="tcg-wallet-bar">
        <span>✦</span>
        <strong>{points}</strong>
        <span>Punti Bestiario</span>
        <span className="tcg-wallet-divider">·</span>
        <span>📚</span>
        <strong>{totalNormals + totalFoils}</strong>
        <span>carte</span>
        {totalFoils > 0 && (
          <>
            <span className="tcg-wallet-divider">·</span>
            <span className="tcg-wallet-foil" title="Carte brillanti possedute">
              ✨ <strong>{totalFoils}</strong> brillant{totalFoils === 1 ? "e" : "i"}
            </span>
          </>
        )}
      </div>

      {message && (
        <div className={`tcg-msg ${message.ok ? "" : "tcg-msg--err"}`}>{message.text}</div>
      )}

      <div className="tcg-tabs" role="tablist">
        <button
          type="button"
          className={`tcg-tab tcg-tab--lobby ${tab === "lobby" ? "tcg-tab--active" : ""}`}
          onClick={() => setTab("lobby")}
        >
          <span className="tcg-tab-icon">⚔</span>
          <span className="tcg-tab-label">Sfide</span>
        </button>
        <button
          type="button"
          className={`tcg-tab tcg-tab--shop ${tab === "shop" ? "tcg-tab--active" : ""}`}
          onClick={() => setTab("shop")}
        >
          <span className="tcg-tab-icon">🛒</span>
          <span className="tcg-tab-label">Bottega</span>
        </button>
        <button
          type="button"
          className={`tcg-tab tcg-tab--coll ${tab === "collection" ? "tcg-tab--active" : ""}`}
          onClick={() => setTab("collection")}
        >
          <span className="tcg-tab-icon">📚</span>
          <span className="tcg-tab-label">Collezione</span>
        </button>
        <button
          type="button"
          className={`tcg-tab tcg-tab--codex ${tab === "codex" ? "tcg-tab--active" : ""}`}
          onClick={() => setTab("codex")}
        >
          <span className="tcg-tab-icon">📖</span>
          <span className="tcg-tab-label">Carte</span>
        </button>
        <button
          type="button"
          className={`tcg-tab tcg-tab--rules ${tab === "rules" ? "tcg-tab--active" : ""}`}
          onClick={() => setTab("rules")}
        >
          <span className="tcg-tab-icon">📜</span>
          <span className="tcg-tab-label">Manuale</span>
        </button>
      </div>

      <div className="tcg-tab-body">
        {tab === "lobby" && (
          <Lobby
            currentUser={currentUser}
            me={me}
            openMatches={openMatches}
            recentMatches={recentMatches}
            onCreate={createChallenge}
            onAccept={acceptChallenge}
            onCancel={cancelChallenge}
          />
        )}
        {tab === "shop" && <Shop points={points} onBuy={buyPack} />}
        {tab === "collection" && (
          <CollectionTab
            me={me}
            onTrash={trashCard}
            onSaveDeck={saveDeck}
            onView={viewCard}
          />
        )}
        {tab === "codex" && <Codex onView={viewCard} />}
        {tab === "rules" && <Rules />}
      </div>

      {starterOpen && (
        <StarterModal
          onPick={claimStarter}
          onSkip={() => setStarterOpen(false)}
        />
      )}

      {packReveal && (
        <PackRevealModal
          packDef={packReveal.packDef}
          cards={packReveal.cards}
          onClose={() => setPackReveal(null)}
          onView={viewCard}
        />
      )}

      {viewingCard && (
        <CardDetailModal
          cardId={viewingCard.cardId}
          foil={viewingCard.foil}
          onClose={() => setViewingCard(null)}
        />
      )}
    </section>
  );
}

/* Splits a drawn pack ([{cardId, foil}]) into two count maps. */
function splitDrawn(drawn) {
  const normals = {}, foils = {};
  for (const d of drawn) {
    if (d.foil) foils[d.cardId] = (foils[d.cardId] || 0) + 1;
    else        normals[d.cardId] = (normals[d.cardId] || 0) + 1;
  }
  return { normals, foils };
}

/* ============================================================
   STARTER MODAL — pick one element, get 20 cards free.
   ============================================================ */
function StarterModal({ onPick, onSkip }) {
  const [picked, setPicked] = useState(null);
  return (
    <div className="tcg-overlay">
      <div className="tcg-modal tcg-starter">
        <div className="tcg-starter-icon">🎁</div>
        <h2 className="tcg-starter-title">Benvenuto nel TCG di Eldoria</h2>
        <p className="tcg-starter-sub">
          Scegli uno dei quattro elementi base e ricevi <strong>20 carte gratis</strong> per
          iniziare. Otterrai un mazzo da gioco completo con preferenza per
          l'elemento scelto. Questa scelta è una sola volta per ogni avventuriero.
          <br />
          <em>Luce</em> e <em>Tenebra</em> sono disponibili solo nella Bottega.
        </p>
        <div className="tcg-starter-grid">
          {["fire", "water", "earth", "air"].map(el => {
            const pd = PACK_DEFS[el];
            return (
              <button
                key={el}
                type="button"
                className={`tcg-starter-pick tcg-starter-pick--${el} ${picked === el ? "tcg-starter-pick--on" : ""}`}
                onClick={() => setPicked(el)}
              >
                <div className="tcg-starter-pick-icon">{pd.icon}</div>
                <div className="tcg-starter-pick-name">{ELEMENT_LABEL[el]}</div>
                <div className="tcg-starter-pick-desc">
                  Standard · ampio bestiario
                </div>
              </button>
            );
          })}
        </div>
        <div className="tcg-starter-actions">
          <button className="tcg-btn tcg-btn--ghost" onClick={onSkip}>
            Salta (potrai scegliere dopo)
          </button>
          <button
            className="tcg-btn tcg-btn--hero"
            disabled={!picked}
            onClick={() => picked && onPick(picked)}
          >
            🎁 Ricevi il pacchetto
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PACK REVEAL MODAL — shows the 8 cards just opened.
   ============================================================ */
function PackRevealModal({ packDef, cards, onClose, onView }) {
  const [step, setStep] = useState(0);
  // Reveal cards one by one for drama; "step" is the count visible.
  useEffect(() => {
    if (step >= cards.length) return;
    const t = setTimeout(() => setStep(s => s + 1), 200);
    return () => clearTimeout(t);
  }, [step, cards.length]);

  const bestRarity = useMemo(() => {
    const rank = { common: 1, rare: 2, epic: 3, legendary: 4 };
    let best = "common";
    for (const d of cards) {
      const c = TCG_CARDS[d.cardId];
      if (c && rank[c.rarity] > rank[best]) best = c.rarity;
    }
    return best;
  }, [cards]);

  const foilCount = useMemo(
    () => cards.filter(d => d.foil).length,
    [cards],
  );

  return (
    <div className="tcg-overlay" onClick={onClose}>
      <div
        className={`tcg-modal tcg-reveal tcg-reveal--${bestRarity} ${foilCount > 0 ? "tcg-reveal--has-foil" : ""}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="tcg-reveal-head">
          <span className="tcg-reveal-pack-icon">{packDef.icon}</span>
          <div>
            <div className="tcg-reveal-pack-name">{packDef.name}</div>
            <div className="tcg-reveal-pack-sub">{cards.length} carte ricevute</div>
          </div>
          {foilCount > 0 && (
            <div className="tcg-reveal-jackpot tcg-reveal-jackpot--foil">
              ✨ {foilCount === 1 ? "BRILLANTE!" : `${foilCount} BRILLANTI!`} ✨
            </div>
          )}
          {bestRarity === "legendary" && (
            <div className="tcg-reveal-jackpot">★ LEGGENDARIO! ★</div>
          )}
          {bestRarity === "epic" && (
            <div className="tcg-reveal-jackpot tcg-reveal-jackpot--epic">★ EPICO! ★</div>
          )}
        </div>
        <div className="tcg-reveal-grid">
          {cards.slice(0, step).map((d, i) => {
            const c = TCG_CARDS[d.cardId];
            return c
              ? <Card
                  key={i}
                  card={c}
                  foil={d.foil}
                  size="md"
                  className="tcg-reveal-card"
                  onClick={onView ? () => onView(d.cardId, d.foil) : undefined}
                />
              : null;
          })}
        </div>
        <button className="tcg-btn tcg-btn--hero" onClick={onClose}>
          Continua
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   CARD DETAIL MODAL — enlarged card view with full info.
   Triggered from Codex, Collection, and Pack reveal.
   ============================================================ */
function CardDetailModal({ cardId, foil = false, onClose }) {
  const c = TCG_CARDS[cardId];
  if (!c) return null;
  const mechs = c.mechanics || [];
  return (
    <div className="tcg-overlay" onClick={onClose}>
      <div
        className={
          `tcg-modal tcg-detail tcg-detail--r-${c.rarity} tcg-detail--el-${c.element}` +
          (foil ? " tcg-detail--foil" : "")
        }
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          className="tcg-detail-close"
          onClick={onClose}
          title="Chiudi"
        >✕</button>

        <div className="tcg-detail-art">
          <CardArt def={c} />
          {foil && <span className="tcg-card-foil-shine" aria-hidden="true" />}
          <div className="tcg-detail-badges">
            <span className={`tcg-rarity-chip tcg-rarity-chip--${c.rarity}`}>
              ★ {RARITY_LABEL[c.rarity]}
            </span>
            <span className={`tcg-element-chip tcg-element-chip--${c.element}`}>
              {ELEMENT_ICON[c.element]} {ELEMENT_LABEL[c.element]}
            </span>
            {foil && (
              <span className="tcg-detail-foil-chip" title="Edizione brillante">
                ✨ BRILLANTE
              </span>
            )}
          </div>
        </div>

        <h2 className="tcg-detail-name">{c.name}</h2>

        <div className="tcg-detail-stats">
          <div className="tcg-detail-stat tcg-detail-stat--mana">
            <span className="tcg-detail-stat-icon">🔮</span>
            <span className="tcg-detail-stat-val">{c.cost}</span>
            <span className="tcg-detail-stat-label">Mana</span>
          </div>
          <div className="tcg-detail-stat tcg-detail-stat--atk">
            <span className="tcg-detail-stat-icon">⚔</span>
            <span className="tcg-detail-stat-val">{c.atk}</span>
            <span className="tcg-detail-stat-label">Attacco</span>
          </div>
          <div className="tcg-detail-stat tcg-detail-stat--hp">
            <span className="tcg-detail-stat-icon">❤</span>
            <span className="tcg-detail-stat-val">{c.hp}</span>
            <span className="tcg-detail-stat-label">Punti Ferita</span>
          </div>
        </div>

        {mechs.length > 0 && (
          <div className="tcg-detail-mechs">
            <h4 className="tcg-detail-section">⚡ Abilità</h4>
            {mechs.map(k => {
              const m = TCG_MECHANICS[k];
              return (
                <div key={k} className={`tcg-detail-mech tcg-detail-mech--${k}`}>
                  <div className="tcg-detail-mech-head">
                    <span
                      className="tcg-detail-mech-icon"
                      style={{ background: m.color }}
                    >
                      {m.icon}
                    </span>
                    <strong className="tcg-detail-mech-name">{m.name}</strong>
                  </div>
                  <div className="tcg-detail-mech-rules">{m.rules}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="tcg-detail-flavor">
          <span className="tcg-detail-flavor-quote">"</span>
          {c.flavor}
          <span className="tcg-detail-flavor-quote">"</span>
        </div>

        <button
          type="button"
          className="tcg-btn tcg-btn--hero tcg-detail-done"
          onClick={onClose}
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   SHOP — buy element packs with ✦ Punti Bestiario.
   ============================================================ */
function Shop({ points, onBuy }) {
  return (
    <div className="tcg-shop">
      <div className="tcg-panel">
        <h2 className="tcg-panel-title">🛒 Forzieri della Bottega</h2>
        <p className="tcg-panel-sub">
          Ogni forziere contiene <strong>8 carte</strong>. I forzieri elementali
          standard hanno una <strong>0.5%</strong> di probabilità di contenere
          un Leggendario; i forzieri di <strong>Luce</strong> e <strong>Tenebra</strong>
          sono più costosi ma offrono il <strong>5%</strong> di Leggendario e più rare garantite.
        </p>
        <div className="tcg-packs-grid">
          {PACK_ORDER.map(key => {
            const pd = PACK_DEFS[key];
            const canBuy = points >= pd.cost;
            return (
              <div key={key} className={`tcg-pack tcg-pack--${key}`}>
                <div className="tcg-pack-banner">
                  <span className="tcg-pack-icon">{pd.icon}</span>
                  <span className="tcg-pack-name">{pd.name}</span>
                </div>
                <div className="tcg-pack-odds">
                  {pd.slots.filter(s => s === "common").length}× COMUNE
                  {" · "}
                  {pd.slots.filter(s => s === "rare").length}× RARO
                  {" · "}
                  1× PREMIO
                </div>
                <div className="tcg-pack-premium">
                  Slot premio: {Object.entries(pd.premiumOdds)
                    .map(([r, w]) => `${w}% ${RARITY_LABEL[r]}`)
                    .join(" · ")}
                </div>
                <p className="tcg-pack-desc">{pd.description}</p>
                <div className="tcg-pack-cost-row">
                  <span className="tcg-pack-cost">{pd.cost} ✦</span>
                </div>
                <button
                  type="button"
                  className="tcg-btn tcg-btn--hero tcg-pack-buy"
                  disabled={!canBuy}
                  onClick={() => onBuy(key)}
                >
                  {canBuy ? "🎁 Apri" : `Mancano ${pd.cost - points} ✦`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">💰 Come si guadagnano i Punti Bestiario</h2>
        <p className="tcg-panel-sub">
          Vinci all'Arena, partecipa al Pet Battle, fai offerte al Mercato Nero,
          leggi riassunti di sessione, visita gli Archivi, oppure semplicemente
          fai login giornaliero. La <strong>Bottega del Pet Hub</strong> mostra
          tutte le fonti di ✦.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   COLLECTION TAB — owned cards + deck builder + trash
   ============================================================ */
function CollectionTab({ me, onTrash, onSaveDeck, onView }) {
  const collection_ = me?.tcgCollection || {};
  const foils_ = me?.tcgFoils || {};
  const savedDeck = Array.isArray(me?.tcgDeck) ? me.tcgDeck : [];

  // Local editing state — initialized from saved deck
  const [editingDeck, setEditingDeck] = useState(savedDeck);
  const [filter, setFilter] = useState("all"); // all | element | rarity | inDeck | notInDeck
  const lastSavedRef = useRef(savedDeck);

  // When the saved deck changes externally (e.g. after trash trimmed it),
  // rebase the editing buffer if the user hasn't made changes.
  useEffect(() => {
    const dirty = JSON.stringify(editingDeck) !== JSON.stringify(lastSavedRef.current);
    if (!dirty) {
      setEditingDeck(savedDeck);
    }
    lastSavedRef.current = savedDeck;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(savedDeck)]);

  const cards = useMemo(() => {
    const owned = [];
    for (const [id, n] of Object.entries(collection_)) {
      if (n > 0 && TCG_CARDS[id]) {
        owned.push({ id, count: n, foil: false, def: TCG_CARDS[id] });
      }
    }
    for (const [id, n] of Object.entries(foils_)) {
      if (n > 0 && TCG_CARDS[id]) {
        owned.push({ id, count: n, foil: true, def: TCG_CARDS[id] });
      }
    }
    if (filter === "all") return sortCards(owned);
    if (filter === "foil") return sortCards(owned.filter(o => o.foil));
    if (["common", "rare", "epic", "legendary"].includes(filter)) {
      return sortCards(owned.filter(o => o.def.rarity === filter));
    }
    if (["fire", "water", "earth", "air", "light", "dark"].includes(filter)) {
      return sortCards(owned.filter(o => o.def.element === filter));
    }
    if (filter === "inDeck") {
      return sortCards(owned.filter(o => deckCount(editingDeck, o.id) > 0));
    }
    if (filter === "unused") {
      // A row is "available" if the combined pool exceeds usage in deck.
      return sortCards(owned.filter(o => {
        const totalForId = (collection_[o.id] || 0) + (foils_[o.id] || 0);
        return deckCount(editingDeck, o.id) < totalForId;
      }));
    }
    return sortCards(owned);
  }, [collection_, foils_, filter, editingDeck]);

  const totalOwned = useMemo(
    () => Object.values(collection_).reduce((s, n) => s + n, 0)
        + Object.values(foils_).reduce((s, n) => s + n, 0),
    [collection_, foils_],
  );
  const totalFoil = useMemo(
    () => Object.values(foils_).reduce((s, n) => s + n, 0),
    [foils_],
  );

  const deckCounts = useMemo(() => {
    const map = {};
    for (const id of editingDeck) map[id] = (map[id] || 0) + 1;
    return map;
  }, [editingDeck]);

  const addToDeck = (cardId) => {
    if (editingDeck.length >= DECK_REQUIRED_SIZE) return;
    const total = (collection_[cardId] || 0) + (foils_[cardId] || 0);
    const used = deckCounts[cardId] || 0;
    if (used >= total) return; // out of copies
    setEditingDeck(d => [...d, cardId]);
  };

  const removeFromDeck = (atIndex) => {
    setEditingDeck(d => d.filter((_, i) => i !== atIndex));
  };

  const clearDeck = () => {
    if (!window.confirm("Svuotare il mazzo in costruzione?")) return;
    setEditingDeck([]);
  };

  const autoFill = () => {
    const built = autoBuildDeckFromCollection(collection_, foils_);
    if (!built) {
      alert("Servono almeno 20 carte nella collezione per generare un mazzo.");
      return;
    }
    setEditingDeck(built);
  };

  const resetToSaved = () => {
    setEditingDeck(savedDeck);
  };

  const dirty = JSON.stringify(editingDeck) !== JSON.stringify(savedDeck);
  const deckValid = isValidDeck(editingDeck) && ownsDeck(editingDeck, collection_, foils_);

  if (totalOwned === 0) {
    return (
      <div className="tcg-panel tcg-empty-card">
        <div className="tcg-empty-icon">📚</div>
        <h3>La tua collezione è vuota</h3>
        <p>Vai alla <strong>Bottega</strong> per aprire il tuo primo Forziere — o riceverai un pacchetto iniziale gratuito al tuo prossimo accesso!</p>
      </div>
    );
  }

  return (
    <div className="tcg-coll">
      {/* DECK BUILDER */}
      <div className="tcg-panel">
        <div className="tcg-panel-head">
          <h2 className="tcg-panel-title">🃏 Il tuo mazzo · {editingDeck.length}/{DECK_REQUIRED_SIZE}</h2>
          <div className="tcg-deck-status">
            {deckValid
              ? <span className="tcg-tag tcg-tag--ok">✓ Mazzo valido</span>
              : <span className="tcg-tag tcg-tag--warn">⚠ Mazzo non completo o non legale</span>}
            {dirty && <span className="tcg-tag tcg-tag--dirty">● Modifiche non salvate</span>}
          </div>
        </div>
        <p className="tcg-panel-sub">
          Trascina (o clicca) le carte della collezione per aggiungerle. Clicca una carta nel mazzo per rimuoverla.
          Servono esattamente <strong>{DECK_REQUIRED_SIZE} carte</strong>. Quando giochi una sfida verrà usato il tuo mazzo
          salvato; se non è pronto, il gioco ne genera uno automaticamente dalla collezione.
        </p>

        <div className="tcg-deck-tray">
          {editingDeck.length === 0 ? (
            <div className="tcg-deck-empty">Nessuna carta nel mazzo · usa "Auto-genera" o aggiungile manualmente</div>
          ) : editingDeck.map((cardId, idx) => {
            const c = TCG_CARDS[cardId];
            if (!c) return null;
            return (
              <button
                key={`${cardId}-${idx}`}
                type="button"
                className={`tcg-deck-slot tcg-deck-slot--${c.rarity} tcg-deck-slot--el-${c.element}`}
                onClick={() => removeFromDeck(idx)}
                title={`${c.name} · clicca per rimuovere`}
              >
                <span className="tcg-deck-slot-cost">{c.cost}</span>
                <span className="tcg-deck-slot-el">{ELEMENT_ICON[c.element]}</span>
                <span className="tcg-deck-slot-name">{c.name}</span>
                <span className="tcg-deck-slot-stat">{c.atk}/{c.hp}</span>
                <span className="tcg-deck-slot-x">✕</span>
              </button>
            );
          })}
        </div>

        <div className="tcg-deck-actions">
          <button className="tcg-btn" onClick={autoFill}>🎲 Auto-genera</button>
          <button className="tcg-btn" onClick={clearDeck} disabled={editingDeck.length === 0}>🗑 Svuota</button>
          <button className="tcg-btn" onClick={resetToSaved} disabled={!dirty}>↺ Annulla modifiche</button>
          <button
            className="tcg-btn tcg-btn--hero"
            disabled={!dirty || !deckValid}
            onClick={() => onSaveDeck(editingDeck)}
          >
            💾 Salva mazzo
          </button>
        </div>
      </div>

      {/* COLLECTION FILTER + GRID */}
      <div className="tcg-panel">
        <h2 className="tcg-panel-title">
          📚 La tua collezione · {totalOwned} carte
          {totalFoil > 0 && (
            <span className="tcg-panel-title-foil"> · ✨ {totalFoil} brillant{totalFoil === 1 ? "e" : "i"}</span>
          )}
        </h2>
        <div className="tcg-codex-filters">
          <button className={`tcg-filter ${filter === "all" ? "tcg-filter--on" : ""}`} onClick={() => setFilter("all")}>
            Tutte ({cards.length})
          </button>
          <button className={`tcg-filter ${filter === "unused" ? "tcg-filter--on" : ""}`} onClick={() => setFilter("unused")}>
            Disponibili
          </button>
          <button className={`tcg-filter ${filter === "inDeck" ? "tcg-filter--on" : ""}`} onClick={() => setFilter("inDeck")}>
            Nel mazzo
          </button>
          {totalFoil > 0 && (
            <button className={`tcg-filter tcg-filter--foil ${filter === "foil" ? "tcg-filter--on" : ""}`} onClick={() => setFilter("foil")}>
              ✨ Brillanti
            </button>
          )}
          {Object.entries(ELEMENT_ICON).map(([el, ic]) => (
            <button key={el} className={`tcg-filter tcg-filter--el-${el} ${filter === el ? "tcg-filter--on" : ""}`} onClick={() => setFilter(el)}>
              {ic} {ELEMENT_LABEL[el]}
            </button>
          ))}
          {["common", "rare", "epic", "legendary"].map(r => (
            <button key={r} className={`tcg-filter tcg-filter--r-${r} ${filter === r ? "tcg-filter--on" : ""}`} onClick={() => setFilter(r)}>
              ★ {RARITY_LABEL[r]}
            </button>
          ))}
        </div>

        <div className="tcg-coll-grid">
          {cards.length === 0 ? (
            <p className="tcg-empty">Nessuna carta corrisponde al filtro.</p>
          ) : cards.map(({ id, count, foil, def }) => {
            const totalForId = (collection_[id] || 0) + (foils_[id] || 0);
            const usedInDeck = deckCounts[id] || 0;
            const canAddToDeck = totalForId > usedInDeck && editingDeck.length < DECK_REQUIRED_SIZE;
            const refundTable = foil ? FOIL_TRASH_REFUND : TRASH_REFUND;
            return (
              <div key={`${id}-${foil ? "f" : "n"}`} className={`tcg-coll-cell ${foil ? "tcg-coll-cell--foil" : ""}`}>
                <Card
                  card={def}
                  size="md"
                  foil={foil}
                  onClick={onView ? () => onView(id, foil) : undefined}
                />
                <div className="tcg-coll-meta">
                  <span className={`tcg-coll-owned ${foil ? "tcg-coll-owned--foil" : ""}`}>
                    {foil ? "✨ " : ""}×{count}
                  </span>
                  {usedInDeck > 0 && (
                    <span className="tcg-coll-indeck">Mazzo: {usedInDeck}</span>
                  )}
                  <span className="tcg-coll-refund" title="Distruzione: recupero in ✦">
                    🗑 {refundTable[def.rarity]}
                  </span>
                </div>
                <div className="tcg-coll-actions">
                  <button
                    type="button"
                    className="tcg-btn tcg-btn--tiny"
                    onClick={addToDeck.bind(null, id)}
                    disabled={!canAddToDeck}
                    title={
                      editingDeck.length >= DECK_REQUIRED_SIZE
                        ? "Mazzo pieno"
                        : (totalForId <= usedInDeck
                          ? "Tutte le copie sono nel mazzo"
                          : "Aggiungi al mazzo")
                    }
                  >
                    + Mazzo
                  </button>
                  <button
                    type="button"
                    className="tcg-btn tcg-btn--tiny tcg-btn--danger"
                    onClick={() => onTrash(id, foil)}
                    title={`Distruggi una copia ${foil ? "brillante " : ""}· recupera ${refundTable[def.rarity]} ✦`}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Sort cards: legendary→common, then by cost, then by name. */
function sortCards(arr) {
  const rank = { legendary: 0, epic: 1, rare: 2, common: 3 };
  return arr.slice().sort((a, b) => {
    const r = rank[a.def.rarity] - rank[b.def.rarity];
    if (r !== 0) return r;
    const c = (a.def.cost || 0) - (b.def.cost || 0);
    if (c !== 0) return c;
    const n = a.def.name.localeCompare(b.def.name);
    if (n !== 0) return n;
    // Same card: foil row first (rarer/prettier).
    if (a.foil !== b.foil) return a.foil ? -1 : 1;
    return 0;
  });
}

/* ============================================================
   LOBBY — challenge list, create & accept
   ============================================================ */
function Lobby({ currentUser, me, openMatches, recentMatches, onCreate, onAccept, onCancel }) {
  const deckOk = isValidDeck(me?.tcgDeck) && ownsDeck(me?.tcgDeck, me?.tcgCollection, me?.tcgFoils);
  const totalOwned = Object.values(me?.tcgCollection || {}).reduce((s, n) => s + n, 0)
                   + Object.values(me?.tcgFoils || {}).reduce((s, n) => s + n, 0);

  return (
    <div className="tcg-lobby">
      <ElementWheelLegend />

      <div className="tcg-panel">
        <div className="tcg-panel-head">
          <h2 className="tcg-panel-title">⚔ Sfida un avversario</h2>
        </div>
        <p className="tcg-panel-sub">
          Lancia una sfida 1v1: il primo avventuriero che la accetta combatterà contro di te.
          {deckOk
            ? " Userai il tuo mazzo salvato."
            : (totalOwned >= 20
              ? " Non hai un mazzo salvato: ne verrà generato uno dalla tua collezione."
              : " La tua collezione è troppo piccola: verrà usato un mazzo casuale di prova.")}
        </p>
        <button type="button" className="tcg-btn tcg-btn--hero" onClick={onCreate}>
          🎴 Lancia una sfida
        </button>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">📯 Sfide aperte</h2>
        {openMatches.length === 0 ? (
          <p className="tcg-empty">Nessuna sfida in attesa. Sii il primo a lanciarne una!</p>
        ) : (
          <div className="tcg-challenge-list">
            {openMatches.map(m => {
              const mine = m.challenger.uid === currentUser.uid;
              return (
                <div key={m.id} className={`tcg-challenge ${mine ? "tcg-challenge--mine" : ""}`}>
                  <div className="tcg-challenge-info">
                    <div className="tcg-challenge-name">
                      <span className="tcg-challenge-icon">🎴</span>
                      <strong>{m.challenger.name}</strong>
                    </div>
                    <div className="tcg-challenge-meta">aspetta uno sfidante…</div>
                  </div>
                  {mine ? (
                    <button className="tcg-btn tcg-btn--ghost" onClick={() => onCancel(m)}>✕ Annulla</button>
                  ) : (
                    <button className="tcg-btn tcg-btn--accept" onClick={() => onAccept(m)}>
                      ⚔ Accetta
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">📜 Ultimi scontri</h2>
        {recentMatches.length === 0 ? (
          <p className="tcg-empty">Nessuno scontro risolto ancora.</p>
        ) : (
          <div className="tcg-recent-list">
            {recentMatches.map(m => {
              const w = m.state?.winner;
              const winnerName = w === "challenger" ? m.challenger?.name
                : w === "challenged" ? m.challenged?.name
                : "Pareggio";
              return (
                <div key={m.id} className="tcg-recent-row">
                  <span className={`tcg-recent-side ${w === "challenger" ? "win" : "loss"}`}>
                    {m.challenger?.name}
                  </span>
                  <span className="tcg-recent-vs">vs</span>
                  <span className={`tcg-recent-side ${w === "challenged" ? "win" : "loss"}`}>
                    {m.challenged?.name}
                  </span>
                  <span className="tcg-recent-winner">→ 🏆 {winnerName}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   ELEMENT WHEEL — visual rules of element advantage
   ============================================================ */
function ElementWheelLegend() {
  return (
    <div className="tcg-wheel-wrap">
      <div className="tcg-wheel" title="Ogni elemento è super-efficace contro il successivo (×1.5).">
        <span className="tcg-wheel-label">Cerchio degli Elementi</span>
        {ELEMENT_CYCLE.map((e, i) => (
          <React.Fragment key={e}>
            <span className={`tcg-wheel-node tcg-wheel-node--${e}`}>
              {ELEMENT_ICON[e]} {ELEMENT_LABEL[e]}
            </span>
            {i < ELEMENT_CYCLE.length - 1 && <span className="tcg-wheel-arrow">→</span>}
          </React.Fragment>
        ))}
        <span className="tcg-wheel-arrow">↺</span>
      </div>
      <div className="tcg-wheel tcg-wheel--pair" title="Luce e Tenebre si combattono solo tra loro.">
        <span className="tcg-wheel-label">Dualità</span>
        <span className={`tcg-wheel-node tcg-wheel-node--${LIGHT_DARK[0]}`}>
          {ELEMENT_ICON[LIGHT_DARK[0]]} {ELEMENT_LABEL[LIGHT_DARK[0]]}
        </span>
        <span className="tcg-wheel-arrow">⇄</span>
        <span className={`tcg-wheel-node tcg-wheel-node--${LIGHT_DARK[1]}`}>
          {ELEMENT_ICON[LIGHT_DARK[1]]} {ELEMENT_LABEL[LIGHT_DARK[1]]}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   CARD — full MTG-style card visual
   ============================================================ */
function Card({ card, size = "md", onClick, disabled, selected, className = "", showTooltip = true, foil = false }) {
  const def = card;
  const cost = def.cost;
  const mechs = def.mechanics || [];
  const tip = showTooltip
    ? `${def.name} · ${RARITY_LABEL[def.rarity]} ${ELEMENT_ICON[def.element]}${foil ? " · ✨ Brillante" : ""}\n${def.flavor}\n` +
      mechs.map(k => `${TCG_MECHANICS[k].icon} ${TCG_MECHANICS[k].name}: ${TCG_MECHANICS[k].rules}`).join("\n")
    : undefined;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={
        `tcg-card tcg-card--${size}` +
        ` tcg-card--el-${def.element}` +
        ` tcg-card--r-${def.rarity}` +
        (foil ? " tcg-card--foil" : "") +
        (selected ? " tcg-card--selected" : "") +
        (disabled ? " tcg-card--disabled" : "") +
        (onClick ? " tcg-card--clickable" : "") +
        (className ? " " + className : "")
      }
      onClick={onClick}
      disabled={disabled}
      title={tip}
    >
      <div className="tcg-card-header">
        <span className="tcg-card-cost" title="Costo di mana">{cost}</span>
        <span className="tcg-card-name">{def.name}</span>
        <span className="tcg-card-element" title={ELEMENT_LABEL[def.element]}>
          {ELEMENT_ICON[def.element]}
        </span>
      </div>

      <div className="tcg-card-art">
        <CardArt def={def} />
        {foil && <span className="tcg-card-foil-shine" aria-hidden="true" />}
        {foil && <span className="tcg-card-foil-badge" title="Carta Brillante — esemplare rarissimo">✨ BRILLANTE</span>}
        {def.rarity !== "common" && (
          <span className={`tcg-card-rarity-badge tcg-card-rarity-badge--${def.rarity}`}>
            ★ {RARITY_LABEL[def.rarity]}
          </span>
        )}
      </div>

      {mechs.length > 0 && (
        <div className="tcg-card-mechs">
          {mechs.map(k => {
            const m = TCG_MECHANICS[k];
            return (
              <span key={k} className={`tcg-card-mech tcg-card-mech--${k}`} title={`${m.name}: ${m.rules}`}>
                {m.icon} {m.name}
              </span>
            );
          })}
        </div>
      )}

      {size !== "sm" && (
        <div className="tcg-card-flavor">{def.flavor}</div>
      )}

      <div className="tcg-card-stats">
        <span className="tcg-card-stat tcg-card-stat--atk">⚔ {def.atk}</span>
        <span className="tcg-card-stat tcg-card-stat--hp">❤ {def.hp}</span>
      </div>
    </Tag>
  );
}

function CardArt({ def }) {
  const [failed, setFailed] = useState(false);
  if (def.image && !failed) {
    return (
      <img
        src={def.image}
        alt={def.name}
        className="tcg-card-art-img"
        onError={() => setFailed(true)}
        loading="lazy"
      />
    );
  }
  return <span className="tcg-card-art-emoji">{def.icon}</span>;
}

/* ============================================================
   BOARD CARD — Card variant showing live HP & status
   ============================================================ */
function BoardCard({ bc, def, size = "sm", onClick, disabled, selected, status }) {
  const mechs = def.mechanics || [];
  const tip = `${def.name}\nPF ${bc.hp}/${bc.maxHp} · ⚔ ${bc.atk}\n` +
    mechs.map(k => `${TCG_MECHANICS[k].icon} ${TCG_MECHANICS[k].name}`).join(" · ");
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={
        `tcg-card tcg-card--${size}` +
        ` tcg-card--el-${def.element}` +
        ` tcg-card--r-${def.rarity}` +
        ` tcg-board-card` +
        (selected ? " tcg-card--selected" : "") +
        (disabled ? " tcg-card--disabled" : "") +
        (onClick ? " tcg-card--clickable" : "") +
        (status === "sick" ? " tcg-board-card--sick" : "") +
        (status === "tapped" ? " tcg-board-card--tapped" : "") +
        (status === "ready" ? " tcg-board-card--ready" : "")
      }
      onClick={onClick}
      disabled={disabled}
      title={tip}
    >
      <div className="tcg-card-header">
        <span className="tcg-card-cost">{def.cost}</span>
        <span className="tcg-card-name">{def.name}</span>
        <span className="tcg-card-element">{ELEMENT_ICON[def.element]}</span>
      </div>
      <div className="tcg-card-art tcg-card-art--small">
        <CardArt def={def} />
      </div>
      {mechs.length > 0 && (
        <div className="tcg-card-mechs tcg-card-mechs--mini">
          {mechs.map(k => {
            const m = TCG_MECHANICS[k];
            return <span key={k} className="tcg-card-mech-mini" title={m.name}>{m.icon}</span>;
          })}
        </div>
      )}
      <div className="tcg-card-stats">
        <span className="tcg-card-stat tcg-card-stat--atk">⚔ {bc.atk}</span>
        <span className="tcg-card-stat tcg-card-stat--hp">
          ❤ {bc.hp}<em className="tcg-card-stat-sub">/{bc.maxHp}</em>
        </span>
      </div>
      {status === "sick" && <div className="tcg-board-tag">😴 sonnolento</div>}
      {status === "tapped" && <div className="tcg-board-tag">✓ usato</div>}
      {bc.revived && <div className="tcg-board-tag tcg-board-tag--revived">👻 rinato</div>}
    </Tag>
  );
}

/* ============================================================
   LIVE MATCH — full battle board
   ============================================================ */
function LiveMatch({ match, uid, onExit }) {
  const isChallenger = match.challenger.uid === uid;
  const mySide = isChallenger ? "challenger" : "challenged";
  const oSide = oppSide(mySide);
  const state = match.state;
  const myTurn = state.activeSide === mySide;

  const [selectedAttacker, setSelectedAttacker] = useState(null);
  const [compliment, setCompliment] = useState("");
  const logRef = useRef(null);

  /* Roll a compliment once when the match ends and I won */
  useEffect(() => {
    if (state.winner && state.winner === mySide && !compliment) {
      setCompliment(randomCompliment());
    }
  }, [state.winner, mySide, compliment]);

  /* Auto-scroll log */
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log?.length]);

  /* Clear selected attacker when not my turn */
  useEffect(() => {
    if (!myTurn) setSelectedAttacker(null);
  }, [myTurn]);

  const matchRef = doc(db, "tcg_matches", match.id);

  const updateState = async (newState, statusOverride) => {
    const patch = { state: newState, updatedAt: serverTimestamp() };
    if (statusOverride) patch.status = statusOverride;
    else if (newState.winner) patch.status = "ended";
    try {
      await updateDoc(matchRef, patch);
    } catch (err) {
      console.error("tcg update failed:", err);
      alert("Errore: " + err.message);
    }
  };

  const handlePlayCard = async (instId) => {
    if (!canPlayCard(state, mySide, instId)) return;
    const next = playCard(state, mySide, instId);
    await updateState(next);
  };

  const handleSelectAttacker = (instId) => {
    if (!canAttack(state, mySide, instId)) return;
    setSelectedAttacker(instId === selectedAttacker ? null : instId);
  };

  const handleAttackTarget = async (targetInstId) => {
    if (!selectedAttacker) return;
    const next = attackWith(state, mySide, selectedAttacker, targetInstId);
    setSelectedAttacker(null);
    await updateState(next);
  };

  const handleEndTurn = async () => {
    const next = endTurn(state, mySide);
    setSelectedAttacker(null);
    await updateState(next);
  };

  const handleForfeit = async () => {
    if (!window.confirm("Sicuro di voler abbandonare? Perderai la partita.")) return;
    const next = forfeit(state, mySide);
    await updateState(next);
  };

  const targets = selectedAttacker
    ? legalAttackTargets(state, mySide, selectedAttacker)
    : { creatures: [], face: false };

  /* End screen */
  if (state.winner) {
    const won = state.winner === mySide;
    return (
      <div className="tcg-end">
        <div className={`tcg-end-card ${won ? "tcg-end-card--win" : "tcg-end-card--loss"}`}>
          <div className="tcg-end-icon">{won ? "🏆" : "💀"}</div>
          <h2 className="tcg-end-title">
            {won ? "VITTORIA!" : "SCONFITTA"}
          </h2>
          {won && (
            <div className="tcg-end-compliment">
              <span className="tcg-end-compliment-quote">"</span>
              {compliment}
              <span className="tcg-end-compliment-quote">"</span>
            </div>
          )}
          <div className="tcg-end-summary">
            {match.challenger.name} <span className="tcg-end-vs">vs</span> {match.challenged.name}
          </div>
          <div className="tcg-end-log" ref={logRef}>
            {(state.log || []).slice(-20).map((line, i) => (
              <div key={i} className={`tcg-log-line tcg-log-line--${line.side === mySide ? "mine" : "opp"}`}>
                {line.text}
              </div>
            ))}
          </div>
          <button className="tcg-btn tcg-btn--hero" onClick={onExit}>
            ↩ Torna alla lobby
          </button>
        </div>
      </div>
    );
  }

  const myHand = state.hand[mySide];
  const oppHand = state.hand[oSide];
  const myBoard = state.board[mySide];
  const oppBoard = state.board[oSide];

  return (
    <div className="tcg-match">
      <header className="tcg-match-head">
        <button className="tcg-btn tcg-btn--ghost tcg-btn--tiny" onClick={onExit}>← Lobby</button>
        <div className="tcg-match-round">
          Turno {state.round} · {myTurn ? "🟢 Tocca a te" : "⏳ Avversario"}
        </div>
        <button className="tcg-btn tcg-btn--ghost tcg-btn--tiny tcg-btn--danger" onClick={handleForfeit}>
          🏳 Abbandona
        </button>
      </header>

      {/* Opponent zone */}
      <div className="tcg-zone tcg-zone--opp">
        <PlayerStrip
          side={oSide}
          name={match[oSide].name}
          hp={state.hp[oSide]}
          mana={state.mana[oSide]}
          maxMana={state.maxMana[oSide]}
          deckCount={state.deck[oSide].length}
          handCount={oppHand.length}
          opponent
          isActive={!myTurn}
        />
        <div className="tcg-board tcg-board--opp">
          {oppBoard.length === 0 ? (
            <div className="tcg-board-empty">Campo vuoto</div>
          ) : oppBoard.map(bc => {
            const def = TCG_CARDS[bc.cardId];
            const isLegal = selectedAttacker && targets.creatures.includes(bc.instId);
            return (
              <BoardCard
                key={bc.instId}
                bc={bc}
                def={def}
                onClick={isLegal ? () => handleAttackTarget(bc.instId) : undefined}
                disabled={!isLegal}
                selected={isLegal}
                status={bc.tapped ? "tapped" : null}
              />
            );
          })}
        </div>
      </div>

      {/* Center divider with face-attack target */}
      <div className="tcg-divider">
        <div className="tcg-divider-line" />
        {selectedAttacker && targets.face && (
          <button
            className="tcg-face-attack"
            onClick={() => handleAttackTarget(null)}
            title="Colpisci direttamente il campione avversario"
          >
            🎯 Colpisci il Campione ({match[oSide].name})
          </button>
        )}
        {selectedAttacker && !targets.face && targets.creatures.length > 0 && (
          <div className="tcg-divider-hint">
            🛡 Devi colpire prima un Baluardo!
          </div>
        )}
        <div className="tcg-divider-line" />
      </div>

      {/* My zone */}
      <div className="tcg-zone tcg-zone--mine">
        <div className="tcg-board tcg-board--mine">
          {myBoard.length === 0 ? (
            <div className="tcg-board-empty">Gioca una carta dalla mano</div>
          ) : myBoard.map(bc => {
            const def = TCG_CARDS[bc.cardId];
            const ready = canAttack(state, mySide, bc.instId);
            const isSelected = selectedAttacker === bc.instId;
            const status = bc.tapped ? "tapped" : (bc.sick ? "sick" : (ready ? "ready" : null));
            return (
              <BoardCard
                key={bc.instId}
                bc={bc}
                def={def}
                onClick={ready ? () => handleSelectAttacker(bc.instId) : undefined}
                disabled={!ready}
                selected={isSelected}
                status={status}
              />
            );
          })}
        </div>
        <PlayerStrip
          side={mySide}
          name={match[mySide].name}
          hp={state.hp[mySide]}
          mana={state.mana[mySide]}
          maxMana={state.maxMana[mySide]}
          deckCount={state.deck[mySide].length}
          handCount={myHand.length}
          isActive={myTurn}
        />
      </div>

      {/* Hand */}
      <div className="tcg-hand-wrap">
        <div className="tcg-hand-label">
          🎴 La tua mano · {myHand.length} carte
        </div>
        <div className="tcg-hand">
          {myHand.length === 0 ? (
            <div className="tcg-board-empty">Mano vuota</div>
          ) : myHand.map(c => {
            const def = TCG_CARDS[c.cardId];
            const playable = canPlayCard(state, mySide, c.instId);
            return (
              <Card
                key={c.instId}
                card={def}
                size="md"
                onClick={() => handlePlayCard(c.instId)}
                disabled={!playable}
              />
            );
          })}
        </div>
      </div>

      {/* Action bar + log */}
      <div className="tcg-action-bar">
        <button
          type="button"
          className="tcg-btn tcg-btn--end"
          onClick={handleEndTurn}
          disabled={!myTurn}
        >
          ⏭ Fine turno
        </button>
        <div className="tcg-log" ref={logRef}>
          {(state.log || []).slice(-7).map((line, i) => (
            <div key={i} className={`tcg-log-line tcg-log-line--${line.side === mySide ? "mine" : "opp"}`}>
              {line.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PLAYER STRIP — HP, mana, deck, hand counts
   ============================================================ */
function PlayerStrip({ side, name, hp, mana, maxMana, deckCount, handCount, opponent, isActive }) {
  const hpPct = Math.max(0, Math.min(100, (hp / STARTING_HP) * 100));
  return (
    <div className={`tcg-pstrip ${opponent ? "tcg-pstrip--opp" : "tcg-pstrip--mine"} ${isActive ? "tcg-pstrip--active" : ""}`}>
      <div className="tcg-pstrip-name">
        {isActive && <span className="tcg-pstrip-dot" />}
        {opponent ? "👤" : "🎯"} {name}
      </div>
      <div className="tcg-pstrip-row">
        <div className="tcg-pstrip-hp">
          <div className="tcg-pstrip-hp-label">❤ {hp}/{STARTING_HP}</div>
          <div className="tcg-pstrip-hp-track">
            <div className="tcg-pstrip-hp-fill" style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <div className="tcg-pstrip-mana" title="Mana disponibile / massimo">
          <span className="tcg-pstrip-mana-icon">🔮</span>
          <strong>{mana}</strong>/<em>{maxMana}</em>
        </div>
        <div className="tcg-pstrip-pile" title="Carte nel mazzo">📚 {deckCount}</div>
        <div className="tcg-pstrip-pile" title="Carte in mano">🃏 {handCount}</div>
      </div>
    </div>
  );
}

/* ============================================================
   CODEX — show every card in the pool
   ============================================================ */
function Codex({ onView }) {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => {
    if (filter === "all") return TCG_CARD_LIST;
    return TCG_CARD_LIST.filter(c => c.element === filter || c.rarity === filter);
  }, [filter]);

  return (
    <div className="tcg-codex">
      <p className="tcg-panel-sub tcg-codex-hint">
        💡 Clicca una carta per ingrandirla, leggere la descrizione e tutti i dettagli delle abilità.
      </p>
      <div className="tcg-codex-filters">
        <button className={`tcg-filter ${filter === "all" ? "tcg-filter--on" : ""}`} onClick={() => setFilter("all")}>
          Tutte ({TCG_CARD_LIST.length})
        </button>
        {Object.entries(ELEMENT_ICON).map(([el, ic]) => (
          <button key={el} className={`tcg-filter tcg-filter--el-${el} ${filter === el ? "tcg-filter--on" : ""}`} onClick={() => setFilter(el)}>
            {ic} {ELEMENT_LABEL[el]}
          </button>
        ))}
        {["common", "rare", "epic", "legendary"].map(r => (
          <button key={r} className={`tcg-filter tcg-filter--r-${r} ${filter === r ? "tcg-filter--on" : ""}`} onClick={() => setFilter(r)}>
            ★ {RARITY_LABEL[r]}
          </button>
        ))}
      </div>
      <div className="tcg-codex-grid">
        {filtered.map(c => (
          <Card
            key={c.id}
            card={c}
            size="md"
            onClick={onView ? () => onView(c.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   RULES — mechanics + flow rulebook
   ============================================================ */
function Rules() {
  return (
    <div className="tcg-rules">
      <div className="tcg-panel">
        <h2 className="tcg-panel-title">⚔ Come si gioca</h2>
        <ul className="tcg-rules-list">
          <li>Ogni giocatore parte con <strong>{STARTING_HP} PF</strong>, una mano di 4 carte e un mazzo di {DECK_REQUIRED_SIZE}.</li>
          <li>A ogni turno il giocatore attivo guadagna <strong>+1 di Mana massimo</strong> (fino a 10) e ricarica tutto il mana.</li>
          <li>Si pesca 1 carta a turno. Le creature evocate hanno <em>sonno d'evocazione</em> e non possono attaccare lo stesso turno (a meno di "Furia").</li>
          <li>In combattimento, una creatura ne attacca un'altra (o il campione avversario) infliggendo i danni del proprio attacco. La difesa replica con il suo attacco.</li>
          <li>Vince chi porta a 0 i PF dell'avversario. Se finisci il mazzo, subisci 2 danni da affaticamento ad ogni pesca.</li>
        </ul>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">🛒 Bottega e Collezione</h2>
        <ul className="tcg-rules-list">
          <li>Al primo accesso ricevi un <strong>Pacchetto Iniziale gratuito</strong> di 20 carte (scegli l'elemento).</li>
          <li>I forzieri elementali standard costano <strong>80 ✦</strong>. I forzieri di <strong>Luce</strong> e <strong>Tenebra</strong> costano <strong>200 ✦</strong> ma offrono il 5% di Leggendari.</li>
          <li>Ogni forziere contiene 8 carte. Lo slot premio rolla rarità casuali fino al Leggendario.</li>
          <li>Nel pannello <strong>Collezione</strong> costruisci e salvi un mazzo da 20 carte tra quelle possedute. Le carte indesiderate possono essere <strong>distrutte</strong> per recuperare ✦ (3/8/20/50 per rarità).</li>
          <li>
            <strong>✨ Carte Brillanti</strong> — ogni carta acquistata in Bottega ha una probabilità del <strong>{(FOIL_RATE * 100).toFixed(1)}%</strong> di essere "brillante",
            una versione olografica rarissima e meravigliosa. Stesse statistiche, ma molto più preziosa: la distruzione restituisce <strong>4× ✦</strong>.
          </li>
        </ul>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">🌟 Cerchio degli elementi</h2>
        <ElementWheelLegend />
        <p className="tcg-panel-sub">
          Quando un attacco è super-efficace contro l'elemento bersaglio, infligge <strong>×1.5</strong> danni.
          Quando è poco efficace, <strong>×0.5</strong>. Luce e Tenebra si combattono solo tra loro (×1.5 reciproco)
          e sono neutre contro gli altri elementi.
        </p>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">⚡ Le 8 meccaniche</h2>
        <div className="tcg-mechs-grid">
          {MECHANICS_ORDER.map(k => {
            const m = TCG_MECHANICS[k];
            return (
              <div key={k} className={`tcg-mech-card tcg-mech-card--${k}`}>
                <div className="tcg-mech-card-head">
                  <span className="tcg-mech-card-icon" style={{ background: m.color }}>{m.icon}</span>
                  <span className="tcg-mech-card-name">{m.name}</span>
                </div>
                <div className="tcg-mech-card-rules">{m.rules}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">★ Rarità</h2>
        <div className="tcg-rarity-grid">
          {["common", "rare", "epic", "legendary"].map(r => (
            <div key={r} className={`tcg-rarity-card tcg-rarity-card--${r}`}>
              <div className="tcg-rarity-card-name" style={{ color: RARITY_COLOR[r] }}>
                ★ {RARITY_LABEL[r]}
              </div>
              <div className="tcg-rarity-card-desc">
                {r === "common"    && "Le carte di base. Costano poco mana e formano lo zoccolo del mazzo."}
                {r === "rare"      && "Specialisti affidabili. Una meccanica di rilievo o stat sopra la media."}
                {r === "epic"      && "Bestie di rispetto. Più meccaniche combinate, costo medio-alto."}
                {r === "legendary" && "Le creature da copertina. Stat alte, 3 meccaniche, esemplari rarissimi."}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
