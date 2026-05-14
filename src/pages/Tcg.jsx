import React, { useEffect, useState, useMemo, useRef } from "react";
import { db } from "../firebase";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp, increment,
  getDocs, writeBatch, deleteField,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import {
  TCG_CARDS, TCG_CARD_LIST, TCG_MECHANICS, MECHANICS_ORDER,
  TCG_AFFINITIES, ELEMENT_ICON, ELEMENT_LABEL, RARITY_LABEL, RARITY_COLOR,
  ELEMENT_CYCLE, LIGHT_DARK, randomCompliment,
  PACK_DEFS, PACK_ORDER, openPack, openStarterPack,
  TRASH_REFUND, FOIL_TRASH_REFUND, FOIL_RATE, trashRefundFor,
  getCardType, getMechLabel, TYPE_LABEL, TYPE_ICON,
} from "../data/tcgCards";
import {
  initMatchState, playCard, attackWith, endTurn, autoSkipTurn, forfeit,
  canPlayCard, canAttack, legalAttackTargets, legalSpellTargets, predictCombat, oppSide,
  STARTING_HP, DECK_REQUIRED_SIZE, MAX_HAND, TURN_DURATION_MS,
  isValidDeck, ownsDeck, deckCount, autoBuildDeckFromCollection, buildFilteredDeck,
  resolveDeckForMatch, discardCard,
  normalizeCost, totalCost, ELEMENTS,
} from "../utils/tcg";
import { playSfx, setSfxMuted, isSfxMuted, primeSfx } from "../utils/tcgSfx";
import { startBgm, stopBgm, setBgmMuted } from "../utils/tcgBgm";
import { PET_POINT_SOURCES, awardPetPoints } from "../utils/pet";
import "./Tcg.css";

/* Unlocked for all logged-in players. To re-gate the page, flip
   this to true (and edit TCG_ALLOWED_EMAILS below to whitelist
   specific testers). Exported so App.jsx's nav stays in sync. */
export const TCG_LOCKED = false;
export const TCG_ALLOWED_EMAILS = new Set([
  "santomassimo85@gmail.com",
]);
/* Master account — sees the destructive "Reset TCG" button. */
const TCG_MASTER_EMAIL = "santomassimo85@gmail.com";

export function isTcgUnlockedFor(email) {
  if (!TCG_LOCKED) return true;
  return TCG_ALLOWED_EMAILS.has(email || "");
}

/* Master action: wipe TCG progress on EVERY character + delete ALL
   matches. Iterates Firestore in batches of 450 ops. Designed to be
   triggered by a double-confirmed button in the lobby. Each player's
   StarterModal will re-open on their next snapshot because their
   tcgStarterClaimed flag is removed. */
async function resetAllTcgData(showMsg) {
  const charPatch = {
    tcgCollection:     deleteField(),
    tcgFoils:          deleteField(),
    tcgDeck:           deleteField(),
    tcgStarterClaimed: deleteField(),
    tcgStarterElement: deleteField(),
  };
  try {
    showMsg("⏳ Reset in corso…", true);

    // 1) Wipe TCG fields on every character doc
    const charsSnap = await getDocs(collection(db, "characters"));
    let batch = writeBatch(db);
    let ops = 0;
    let charCount = 0;
    for (const d of charsSnap.docs) {
      batch.update(d.ref, charPatch);
      ops++;
      charCount++;
      if (ops >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    // 2) Delete every match (open, active, ended)
    const matchesSnap = await getDocs(collection(db, "tcg_matches"));
    batch = writeBatch(db);
    ops = 0;
    let matchCount = 0;
    for (const d of matchesSnap.docs) {
      batch.delete(d.ref);
      ops++;
      matchCount++;
      if (ops >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    showMsg(
      `✅ Reset completato: ${charCount} giocator${charCount === 1 ? "e" : "i"}, ${matchCount} partit${matchCount === 1 ? "a" : "e"} eliminat${matchCount === 1 ? "a" : "e"}. Tutti riceveranno il Pacchetto Iniziale al prossimo accesso.`,
      true
    );
  } catch (err) {
    console.error("TCG reset failed:", err);
    showMsg("❌ Reset fallito: " + err.message, false);
  }
}

/* ============================================================
   ELDORIA TCG — Magic-style D&D 1v1 trading card game.
   Default export is a thin gate that either renders the real
   game (master / allow-listed accounts) or a "coming soon"
   screen for everyone else.
   ============================================================ */
export default function Tcg() {
  const { currentUser } = useAuth();
  if (!isTcgUnlockedFor(currentUser?.email)) {
    return <TcgLockedGate />;
  }
  return <TcgGame />;
}

function TcgLockedGate() {
  return (
    <section className="tcg-page">
      <div className="tcg-locked">
        <div className="tcg-locked-icon">🔒</div>
        <h2>Eldoria TCG</h2>
        <p>Il tavolo da gioco è in fase di rifinitura finale.</p>
        <p className="tcg-locked-sub">Torna presto: i forzieri delle carte stanno per aprirsi! 🎴✨</p>
      </div>
    </section>
  );
}

/* Tabs: Sfide · Bottega · Collezione · Carte · Manuale.
   First-time players are prompted to pick a free starter pack
   (20 cards biased toward an element of their choosing). */
function TcgGame() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState("lobby");
  const [me, setMe] = useState(null);
  const [openMatches, setOpenMatches] = useState([]);
  const [activeMatches, setActiveMatches] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [activeMatchId, setActiveMatchId] = useState(null);
  /* Track matches the user has explicitly exited via "← Lobby" so the
     auto-enter effect doesn't immediately throw them back in. Without
     this, clicking Lobby was a no-op: the state cleared, the effect
     re-ran, found the same active match in Firestore, re-entered it. */
  const exitedMatchIdsRef = useRef(new Set());
  const [packReveal, setPackReveal] = useState(null);   // { packDef, cards }
  const [starterOpen, setStarterOpen] = useState(false);
  const [message, setMessage] = useState(null);         // { text, ok }
  const [viewingCard, setViewingCard] = useState(null); // { cardId, foil } | null
  const viewCard = (cardId, foil = false) => setViewingCard({ cardId, foil });
  // Make the starter-pack decision once per session. Without this,
  // the "Salta" button and the snapshot-lag right after a claim
  // would both bounce the modal back open via the starterOpen dep.
  const starterCheckedRef = useRef(false);

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

  /* ── Open starter modal once per session, the first time
       `me` is loaded and tcgStarterClaimed is still falsy.
       Guarded by a ref so dismissing (skip OR claim) never
       re-opens it even if the Firestore snapshot lags. */
  useEffect(() => {
    if (!me) return;
    if (starterCheckedRef.current) return;
    starterCheckedRef.current = true;
    if (!me.tcgStarterClaimed) {
      setStarterOpen(true);
    }
  }, [me]);

  /* ── Stream all TCG matches ───────────────────────────── */
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "tcg_matches"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOpenMatches(all.filter(m => m.status === "open"));
      setActiveMatches(all.filter(m => {
        // Keep matches the user is in, including just-ended ones so the
        // end-of-match screen (winner + ✦ reward) actually renders. Without
        // this, the moment the engine writes status: "ended" the LiveMatch
        // component unmounts and the user is dumped to the lobby with no
        // popup. Exiting via the "Torna alla lobby" button still works
        // because exitedMatchIdsRef blocks auto-rejoin of the ended match.
        const mine = m.challenger?.uid === currentUser.uid || m.challenged?.uid === currentUser.uid;
        if (!mine) return false;
        return m.status === "active" || m.status === "ended";
      }));
      setRecentMatches(all.filter(m => m.status === "ended").slice(0, 8));
    });
  }, [currentUser]);

  /* ── Auto-enter active match ──────────────────────────────
     Only auto-enter matches that are still in "active" status AND
     the user hasn't explicitly exited. Ended matches stay in
     activeMatches (so the end-of-match screen can render mid-session)
     but aren't auto-entered on page reload — otherwise the user would
     see the same "VITTORIA!" popup every time they revisit the page. */
  useEffect(() => {
    if (activeMatchId) return;
    const mine = activeMatches.find(m =>
      m.status === "active" && !exitedMatchIdsRef.current.has(m.id)
    );
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
      // Optimistic local update so the modal can never re-trigger
      // off a stale `me` snapshot (race with the onSnapshot listener).
      setMe(prev => prev ? { ...prev, tcgStarterClaimed: true, tcgStarterElement: element } : prev);
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

  /* ── Skip the starter pack PERMANENTLY ─────────────────
     Writes `tcgStarterClaimed: true` (with a tcgStarterSkipped
     marker for auditing) so the modal never reopens on refresh
     or re-deploy. Only a master TCG reset can bring it back.
     Confirms first because this is a one-way decision: the
     player forfeits the free starter pack. */
  const skipStarter = async () => {
    if (!currentUser || !me) return;
    if (me.tcgStarterClaimed) { setStarterOpen(false); return; }
    const ok = window.confirm(
      "Sei sicuro di voler saltare?\n\n" +
      "Se confermi NON riceverai il Pacchetto Iniziale gratuito e il messaggio non comparirà più.\n" +
      "Potrai comunque giocare comprando forzieri dalla Bottega quando avrai abbastanza ✦."
    );
    if (!ok) return;
    try {
      await updateDoc(doc(db, "characters", currentUser.uid), {
        tcgStarterClaimed: true,
        tcgStarterSkipped: true,
      });
      setMe(prev => prev ? { ...prev, tcgStarterClaimed: true, tcgStarterSkipped: true } : prev);
      setStarterOpen(false);
    } catch (err) {
      console.error("starter skip failed:", err);
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

  /* ── If in a match, render the live board only.
        Battle is rendered in its own full-viewport shell (outside .tcg-page)
        so the page background can't scroll behind it. ────────── */
  const activeMatch = activeMatches.find(m => m.id === activeMatchId);
  if (activeMatch) {
    return (
      <div className="tcg-battle-shell">
        <LiveMatch
          match={activeMatch}
          uid={currentUser.uid}
          onExit={() => {
            if (activeMatchId) exitedMatchIdsRef.current.add(activeMatchId);
            setActiveMatchId(null);
          }}
        />
      </div>
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
        {currentUser?.email === TCG_MASTER_EMAIL && (
          <button
            type="button"
            className="tcg-master-reset"
            onClick={() => {
              if (!window.confirm(
                "⚠ ATTENZIONE: questo cancellerà la collezione TCG di TUTTI i giocatori (compresa la tua), tutti i mazzi, e tutte le partite in corso o concluse.\n\nProcedere?"
              )) return;
              if (!window.confirm(
                "Doppio controllo: vuoi davvero RESETTARE TUTTO IL TCG? Questa operazione è irreversibile."
              )) return;
              resetAllTcgData(showMsg);
            }}
            title="Master: reset completo del TCG per tutti i giocatori — irreversibile"
          >
            🔄 Reset TCG
          </button>
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
          onSkip={skipStarter}
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

/* Human-readable rendering of a spell's effect. Used on the card
   face (where stats would normally be) and on the detail modal.
   Mirrors the kinds the engine understands in tcg.js. */
function describeEffect(def) {
  const fx = def?.effect;
  if (!fx) return def?.flavor || "";
  switch (fx.kind) {
    case "damage":
      return `Infligge ${fx.amount} danni a un bersaglio scelto (creatura o campione).`;
    case "burn_champion":
      return `Applica Bruciatura ${fx.x} al campione avversario.`;
    case "aoe":
      return `Infligge ${fx.amount} danni a tutte le creature avversarie.`;
    case "aoe_full":
      return `Infligge ${fx.amount} danni a tutte le creature e al campione avversario.`;
    case "heal_champion":
      return `Cura ${fx.amount} PF al tuo campione${fx.draw ? ` e peschi ${fx.draw}` : ""}.`;
    case "bounce":
      return `Riporta una creatura nemica nella mano del proprietario.`;
    case "buff": {
      const gr = (fx.grants || []).map(g => TCG_MECHANICS[g]?.name || g).join(" + ");
      return `Una tua creatura riceve +${fx.atk}/+${fx.hp}${gr ? ` e ${gr}` : ""}.`;
    }
    case "grant_keyword": {
      const m = TCG_MECHANICS[fx.keyword]?.name || fx.keyword;
      return `Una tua creatura riceve ${m}${fx.value != null ? ` ${fx.value}` : ""}.`;
    }
    case "global_buff":
      return `Tutte le tue creature ricevono +${fx.atk}/+${fx.hp} permanente.`;
    case "destroy": {
      if (fx.filter?.minAtk != null) return `Distrugge una creatura nemica con ATK ≥ ${fx.filter.minAtk}.`;
      if (fx.filter?.maxAtk != null) return `Distrugge una creatura nemica con ATK ≤ ${fx.filter.maxAtk}.`;
      return `Distrugge una creatura nemica scelta.`;
    }
    case "raise_dead":
      return `Riporta in mano l'ultima creatura caduta dal tuo cimitero.`;
    case "grant_temp_keyword": {
      const m = TCG_MECHANICS[fx.keyword]?.name || fx.keyword;
      return `Una tua creatura riceve ${m}${fx.value != null ? ` ${fx.value}` : ""} per ~${fx.duration || 2} turni.`;
    }
    case "champion_regen":
      return `Il tuo campione recupera ${fx.amount} PF all'inizio di ogni tuo turno (permanente).`;
    case "wake":
      return `Una tua creatura perde il sonno d'evocazione e si stappa: può attaccare subito.`;
    case "extinguish":
      return `Cancella tutti i turni di Bruciatura accumulati sul tuo campione.`;
    case "dispel":
      return `Dissolve tutti i bonus magici (keyword concesse e buff temporanei) da una creatura nemica.`;
    case "damage_shield":
      return `Il tuo campione guadagna un Argine che assorbe i prossimi ${fx.amount} danni in entrata.`;
    /* ── Secret/trap kinds (counters) ──────────────────── */
    case "secret_extinguish":
      return `Segreta · Si attiva quando l'avversario applica Bruciatura al tuo campione. Cancella ogni traccia di Bruciatura.`;
    case "secret_cancel_magic":
      return `Segreta · Si attiva quando l'avversario lancia un Incantesimo, un'Aura o una Contromagia. Lo annulla prima che risolva.`;
    case "secret_arcane_ward":
      return `Segreta · Si attiva quando il tuo campione sta per subire danni. Aggiunge ${fx.amount} PF di Argine che vengono consumati per primi.`;
    case "secret_negate":
      return `Segreta · Si attiva quando l'avversario evoca una creatura. La distrugge prima che possa agire.`;
    default:
      return def?.flavor || "";
  }
}

/* Short human label of a spell's target requirement, used in the
   target-picker banner. */
function describeTargetNeed(def) {
  const need = def?.effect?.target || "none";
  switch (need) {
    case "none":            return "lancio immediato";
    case "enemy_champion":  return "il campione avversario";
    case "enemy_creature":  return "una creatura nemica";
    case "ally_creature":   return "una tua creatura";
    case "any_creature":    return "una creatura qualsiasi";
    case "any":             return "una creatura o un campione";
    default:                return "un bersaglio";
  }
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
          Scegli uno dei quattro elementi base e ricevi <strong>{DECK_REQUIRED_SIZE} carte gratis</strong> per
          iniziare. Otterrai un mazzo da gioco completo con preferenza per
          l'elemento scelto. <strong>Questa scelta è una sola volta per ogni avventuriero:</strong> dopo
          la prima conferma (o se salti) il messaggio non riapparirà più, nemmeno dopo un riavvio.
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
          <button
            className="tcg-btn tcg-btn--ghost"
            onClick={onSkip}
            title="Rinuncia al Pacchetto Iniziale: il messaggio non comparirà più"
          >
            Salta definitivamente
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
  const cardType = getCardType(c);
  const isCreature = cardType === "creature";
  const isSpell = !isCreature;
  const mechs = c.mechanics || [];
  return (
    <div className="tcg-overlay" onClick={onClose}>
      <div
        className={
          `tcg-modal tcg-detail tcg-detail--r-${c.rarity} tcg-detail--el-${c.element}` +
          ` tcg-detail--type-${cardType}` +
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
            <span className={`tcg-type-chip tcg-type-chip--${cardType}`}>
              {TYPE_ICON[cardType]} {TYPE_LABEL[cardType]}
            </span>
            {foil && (
              <span className="tcg-detail-foil-chip" title="Edizione brillante">
                ✨ BRILLANTE
              </span>
            )}
          </div>
        </div>

        <h2 className="tcg-detail-name">{c.name}</h2>

        {isSpell ? (
          <>
            <div className="tcg-detail-stats">
              <div className="tcg-detail-stat tcg-detail-stat--mana">
                <span className="tcg-detail-stat-icon">🔮</span>
                <span className="tcg-detail-stat-val tcg-detail-stat-val--pips">
                  <CostPips def={c} size="lg" />
                </span>
                <span className="tcg-detail-stat-label">Costo</span>
              </div>
              <div className="tcg-detail-stat tcg-detail-stat--spell">
                <span className="tcg-detail-stat-icon">📜</span>
                <span className="tcg-detail-stat-val">{TYPE_LABEL[cardType]}</span>
                <span className="tcg-detail-stat-label">Tipo</span>
              </div>
            </div>

            <div className="tcg-detail-effect">
              <h4 className="tcg-detail-section">{TYPE_ICON[cardType]} Effetto · {TYPE_LABEL[cardType]}</h4>
              <p className="tcg-detail-effect-text">{describeEffect(c)}</p>
            </div>
          </>
        ) : (
          <>
            <div className="tcg-detail-stats">
              <div className="tcg-detail-stat tcg-detail-stat--mana">
                <span className="tcg-detail-stat-icon">🔮</span>
                <span className="tcg-detail-stat-val tcg-detail-stat-val--pips">
                  <CostPips def={c} size="lg" />
                </span>
                <span className="tcg-detail-stat-label">Costo</span>
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
                        <strong className="tcg-detail-mech-name">{getMechLabel(c, k)}</strong>
                      </div>
                      <div className="tcg-detail-mech-rules">{m.rules}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
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
          Ogni forziere contiene <strong>15 carte</strong>: 7 comuni, 3 rare, 1 rara/epica,
          2 cristalli mana, 1 slot con chance brillante e 1 slot premio (raro → leggendario).
          I forzieri elementali standard danno un <strong>2%</strong> di Leggendario nello slot premio;
          il forziere <strong>Multicolore</strong> mescola tutti gli elementi; i forzieri di
          <strong> Luce</strong> e <strong>Tenebra</strong> sono esotici e più costosi
          ma offrono il <strong>5%</strong> di Leggendario.
        </p>
        <div className="tcg-packs-grid">
          {PACK_ORDER.map(key => {
            const pd = PACK_DEFS[key];
            const canBuy = points >= pd.cost;
            const slotCount = (k) => pd.slots.filter(s => s === k).length;
            return (
              <div key={key} className={`tcg-pack tcg-pack--${key}`}>
                <div className="tcg-pack-banner">
                  <span className="tcg-pack-icon">{pd.icon}</span>
                  <span className="tcg-pack-name">{pd.name}</span>
                </div>
                <div className="tcg-pack-odds">
                  {slotCount("common")}× COMUNE
                  {" · "}
                  {slotCount("rare")}× RARO
                  {" · "}
                  {slotCount("rarePlus")}× RARA/EPICA
                  {" · "}
                  {slotCount("crystal")}× CRISTALLO
                  {" · "}
                  {slotCount("foilChance")}× ✨BRILLANTE
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
  // Filtered auto-build dropdown state
  const [autoOpts, setAutoOpts] = useState({ element: "", mechanic: "", type: "", strict: false });
  const [autoOpen, setAutoOpen] = useState(false);
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
      alert(`Servono almeno ${DECK_REQUIRED_SIZE} carte nella collezione per generare un mazzo.`);
      return;
    }
    setEditingDeck(built);
  };

  const autoFillFiltered = () => {
    // Strip empty-string options so the helper treats them as "any".
    const o = { strict: autoOpts.strict };
    if (autoOpts.element)  o.element  = autoOpts.element;
    if (autoOpts.mechanic) o.mechanic = autoOpts.mechanic;
    if (autoOpts.type)     o.type     = autoOpts.type;
    const built = buildFilteredDeck(collection_, foils_, o);
    if (!built) {
      if (o.strict) {
        alert("Non hai abbastanza carte che corrispondono ai filtri scelti. Disattiva 'Solo carte filtrate' o cambia filtro.");
      } else {
        alert(`Servono almeno ${DECK_REQUIRED_SIZE} carte nella collezione per generare un mazzo.`);
      }
      return;
    }
    setEditingDeck(built);
  };

  // Reactively count how many owned cards match the current filter, so the
  // user knows whether strict mode is even feasible before clicking.
  const filteredMatchCount = useMemo(() => {
    let n = 0;
    const allCounts = {};
    for (const [id, k] of Object.entries(collection_)) allCounts[id] = (allCounts[id] || 0) + k;
    for (const [id, k] of Object.entries(foils_))      allCounts[id] = (allCounts[id] || 0) + k;
    for (const [id, k] of Object.entries(allCounts)) {
      const c = TCG_CARDS[id];
      if (!c) continue;
      if (autoOpts.element  && c.element !== autoOpts.element)  continue;
      if (autoOpts.mechanic && !(c.mechanics || []).includes(autoOpts.mechanic)) continue;
      if (autoOpts.type     && getCardType(c) !== autoOpts.type) continue;
      n += k;
    }
    return n;
  }, [collection_, foils_, autoOpts.element, autoOpts.mechanic, autoOpts.type]);

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
          <button
            className={`tcg-btn ${autoOpen ? "tcg-btn--on" : ""}`}
            onClick={() => setAutoOpen(o => !o)}
            title="Genera un mazzo con preferenze su elemento/abilità/tipo"
          >
            🎯 Auto-genera con filtro {autoOpen ? "▴" : "▾"}
          </button>
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

        {autoOpen && (
          <div className="tcg-autobuild">
            <p className="tcg-autobuild-hint">
              Genera un mazzo con preferenze: il builder pesca prima le carte che corrispondono ai filtri,
              poi riempie i posti rimanenti con altre carte della tua collezione. Spunta <strong>Solo carte filtrate</strong>{" "}
              per un mazzo "puro" (richiede {DECK_REQUIRED_SIZE} carte che corrispondano).
            </p>
            <div className="tcg-autobuild-form">
              <label className="tcg-autobuild-field">
                <span className="tcg-autobuild-label">Elemento</span>
                <select
                  className="tcg-autobuild-select"
                  value={autoOpts.element}
                  onChange={e => setAutoOpts(o => ({ ...o, element: e.target.value }))}
                >
                  <option value="">Qualsiasi</option>
                  {Object.entries(ELEMENT_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>{ELEMENT_ICON[k]} {label}</option>
                  ))}
                </select>
              </label>
              <label className="tcg-autobuild-field">
                <span className="tcg-autobuild-label">Abilità</span>
                <select
                  className="tcg-autobuild-select"
                  value={autoOpts.mechanic}
                  onChange={e => setAutoOpts(o => ({ ...o, mechanic: e.target.value }))}
                  title="Solo creature con questa keyword stampata"
                >
                  <option value="">Qualsiasi</option>
                  {MECHANICS_ORDER.map(k => {
                    const m = TCG_MECHANICS[k];
                    return <option key={k} value={k}>{m.icon} {m.name}{m.hasValue ? " X" : ""}</option>;
                  })}
                </select>
              </label>
              <label className="tcg-autobuild-field">
                <span className="tcg-autobuild-label">Tipo</span>
                <select
                  className="tcg-autobuild-select"
                  value={autoOpts.type}
                  onChange={e => setAutoOpts(o => ({ ...o, type: e.target.value }))}
                >
                  <option value="">Qualsiasi</option>
                  <option value="creature">🐲 Creatura</option>
                  <option value="spell">📜 Incantesimo</option>
                  <option value="enchantment">🌟 Aura</option>
                  <option value="counter">🛡 Contromagia</option>
                </select>
              </label>
              <label className="tcg-autobuild-field tcg-autobuild-field--check">
                <input
                  type="checkbox"
                  checked={autoOpts.strict}
                  onChange={e => setAutoOpts(o => ({ ...o, strict: e.target.checked }))}
                />
                <span>Solo carte filtrate (mazzo puro)</span>
              </label>
            </div>
            <div className="tcg-autobuild-actions">
              <span className="tcg-autobuild-count">
                {filteredMatchCount} carte corrispondono
                {autoOpts.strict && filteredMatchCount < DECK_REQUIRED_SIZE && (
                  <span className="tcg-autobuild-warn"> · servono almeno {DECK_REQUIRED_SIZE} per la modalità pura</span>
                )}
              </span>
              <button
                className="tcg-btn tcg-btn--hero"
                onClick={autoFillFiltered}
                disabled={autoOpts.strict && filteredMatchCount < DECK_REQUIRED_SIZE}
              >
                🎯 Genera mazzo
              </button>
            </div>
          </div>
        )}
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

/* Long-press / right-click inspect hook for cards. Returns a
   bundle of event handlers a card can spread, plus a `guardClick`
   wrapper that suppresses the synthetic click if a long-press
   already fired (so an inspect doesn't also play the card). The
   fire delay (500ms) is tuned to feel intentional but not slow. */
function useLongPress(onInspect, ms = 500) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);
  const startPosRef = useRef(null);
  if (!onInspect) {
    return { start: undefined, cancel: undefined, guardClick: (h) => h, onContext: undefined, onMove: undefined };
  }
  const start = (e) => {
    // Ignore middle/right clicks here — right-click is handled by onContextMenu
    if (e.type === "mousedown" && e.button !== 0) return;
    firedRef.current = false;
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    startPosRef.current = { x, y };
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onInspect();
    }, ms);
  };
  const cancel = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };
  const onMove = (e) => {
    if (!startPosRef.current || !timerRef.current) return;
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    const dx = x - startPosRef.current.x;
    const dy = y - startPosRef.current.y;
    if (Math.hypot(dx, dy) > 8) cancel();
  };
  const guardClick = (handler) => (e) => {
    if (firedRef.current) {
      firedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handler?.(e);
  };
  const onContext = (e) => { e.preventDefault(); onInspect(); };
  return { start, cancel, guardClick, onContext, onMove };
}

/* Colored cost pips — one chip per element in the card's cost, plus
   one chip for "any" generic cost. Total cost is shown as a small
   number in each chip so a card costing {fire: 2, any: 1} reads as
   `🔥2 ⚪1` instead of an opaque "3". */
function CostPips({ def, size = "sm" }) {
  const cost = normalizeCost(def);
  const total = totalCost(def);
  if (total === 0) return null;
  const chips = [];
  for (const el of ELEMENTS) {
    const n = cost[el];
    if (n <= 0) continue;
    chips.push(
      <span key={el} className={`tcg-cost-pip tcg-cost-pip--${el}`} title={`${ELEMENT_LABEL[el]}: ${n}`}>
        <span className="tcg-cost-pip-icon">{ELEMENT_ICON[el]}</span>
        <span className="tcg-cost-pip-num">{n}</span>
      </span>
    );
  }
  if (cost.any > 0) {
    chips.push(
      <span key="any" className="tcg-cost-pip tcg-cost-pip--any" title={`Mana qualsiasi: ${cost.any}`}>
        <span className="tcg-cost-pip-icon">⚪</span>
        <span className="tcg-cost-pip-num">{cost.any}</span>
      </span>
    );
  }
  return <span className={`tcg-cost-pips tcg-cost-pips--${size}`}>{chips}</span>;
}

/* ============================================================
   CARD — full MTG-style card visual
   ============================================================ */
function Card({ card, size = "md", onClick, disabled, selected, className = "", showTooltip = true, foil = false, onInspect, dataDraggable, dataCardId }) {
  const def = card;
  const cost = def.cost;
  const cardType = getCardType(def);
  const isCreature = cardType === "creature";
  const isSpellLikeCard = !isCreature; // spell / enchantment / counter all share the spell-flow visual
  const mechs = def.mechanics || [];
  const tipBody = isCreature
    ? mechs.map(k => `${TCG_MECHANICS[k].icon} ${getMechLabel(def, k)}: ${TCG_MECHANICS[k].rules}`).join("\n")
    : `${describeEffect(def)}`;
  const tip = showTooltip
    ? `${def.name} · ${TYPE_LABEL[cardType]} · ${RARITY_LABEL[def.rarity]} ${ELEMENT_ICON[def.element]}${foil ? " · ✨ Brillante" : ""}\n${def.flavor}\n${tipBody}${onInspect ? "\n\n(Tieni premuto, clic destro o 🔍 per ingrandire)" : ""}`
    : undefined;
  const lp = useLongPress(onInspect);
  /* Always render a <div> — using a real <button> element for the
     card breaks the DOM nesting rule because the inspect (🔍) child
     is itself a <button>. role="button" + tabIndex preserve a11y
     when the card is clickable, plus an Enter/Space keydown handler
     to fire onClick from the keyboard. */
  const handleKey = onClick && !disabled
    ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lp.guardClick(onClick)(e); } }
    : undefined;
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-disabled={disabled || undefined}
      className={
        `tcg-card tcg-card--${size}` +
        ` tcg-card--el-${def.element}` +
        ` tcg-card--r-${def.rarity}` +
        ` tcg-card--type-${cardType}` +
        (isCreature ? " tcg-card--creature" : " tcg-card--spell") +
        (foil ? " tcg-card--foil" : "") +
        (selected ? " tcg-card--selected" : "") +
        (disabled ? " tcg-card--disabled" : "") +
        (onClick ? " tcg-card--clickable" : "") +
        (className ? " " + className : "")
      }
      onClick={onClick && !disabled ? lp.guardClick(onClick) : undefined}
      onKeyDown={handleKey}
      onMouseDown={lp.start}
      onMouseUp={lp.cancel}
      onMouseLeave={lp.cancel}
      onMouseMove={lp.onMove}
      onTouchStart={lp.start}
      onTouchEnd={lp.cancel}
      onTouchCancel={lp.cancel}
      onTouchMove={lp.onMove}
      onContextMenu={lp.onContext}
      title={tip}
      data-tcg-draggable={dataDraggable || undefined}
      data-tcg-card-id={dataCardId || undefined}
    >
      <div className="tcg-card-header">
        <CostPips def={def} size={size} />
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
        <span className={`tcg-card-type-badge tcg-card-type-badge--${cardType}`} title={TYPE_LABEL[cardType]}>
          {TYPE_ICON[cardType]} {TYPE_LABEL[cardType]}
        </span>
        {onInspect && (
          <button
            type="button"
            className="tcg-card-inspect-btn"
            onClick={(e) => { e.stopPropagation(); onInspect(); }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            title="Ingrandisci e vedi i dettagli"
            aria-label="Ingrandisci"
          >🔍</button>
        )}
      </div>

      {isCreature ? (
        mechs.length > 0 && (
          <div className="tcg-card-mechs">
            {mechs.map(k => {
              const m = TCG_MECHANICS[k];
              return (
                <span key={k} className={`tcg-card-mech tcg-card-mech--${k}`} title={`${getMechLabel(def, k)}: ${m.rules}`}>
                  {m.icon} {getMechLabel(def, k)}
                </span>
              );
            })}
          </div>
        )
      ) : (
        <div className="tcg-card-effect">{describeEffect(def)}</div>
      )}

      {size !== "sm" && (
        <div className="tcg-card-flavor">{def.flavor}</div>
      )}

      {isCreature ? (
        <div className="tcg-card-stats tcg-card-stats--mtg">
          <span className="tcg-card-mtg-pt" title={`Attacco / Punti Ferita`}>
            <span className="tcg-card-mtg-atk">{def.atk}</span>
            <span className="tcg-card-mtg-sep">/</span>
            <span className="tcg-card-mtg-hp">{def.hp}</span>
          </span>
        </div>
      ) : (
        <div className={`tcg-card-stats tcg-card-stats--spell tcg-card-stats--${cardType}`}>
          <span className="tcg-card-stat tcg-card-stat--spell">{TYPE_ICON[cardType]} {TYPE_LABEL[cardType]}</span>
        </div>
      )}
    </div>
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
function BoardCard({ bc, def, size = "sm", onClick, disabled, selected, status, attackAnim, onInspect, floats = [], dataDraggable, dataDrop, dataCardId }) {
  const baseMechs = def.mechanics || [];
  const granted = bc.grants || [];
  const tempBuffKeywords = (bc.tempBuffs || []).map(t => t.keyword);
  const mechs = Array.from(new Set([...baseMechs, ...granted, ...tempBuffKeywords]));
  const isFlying = mechs.includes("flying");
  const labelFor = (k) => {
    const m = TCG_MECHANICS[k];
    if (!m) return "";
    if (m.hasValue) {
      const v = bc.grantedValues?.[k]
        ?? (bc.tempBuffs || []).find(t => t.keyword === k)?.value
        ?? def?.mechanicsValues?.[k];
      return v != null ? `${m.name} ${v}` : m.name;
    }
    return m.name;
  };
  const tip = `${def.name}\nPF ${bc.hp}/${bc.maxHp} · ⚔ ${bc.atk}\n` +
    mechs.map(k => `${TCG_MECHANICS[k].icon} ${labelFor(k)}`).join(" · ") +
    (onInspect ? `\n\n(Tieni premuto, clic destro o 🔍 per ingrandire)` : "");
  const lp = useLongPress(onInspect);
  /* Always a <div> — same nested-button reason as Card. */
  const handleKey = onClick && !disabled
    ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lp.guardClick(onClick)(e); } }
    : undefined;
  // attackAnim shape: { role: "attacker-up" | "attacker-down" | "target", ts: number }
  const animCls = attackAnim
    ? ` tcg-board-card--anim-${attackAnim.role}`
    : "";
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-disabled={disabled || undefined}
      // Re-mounting via key forces the CSS animation to restart on each new
      // attack against the same instId (otherwise the keyframe wouldn't replay).
      key={attackAnim ? `anim-${attackAnim.ts}` : undefined}
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
        (status === "ready" ? " tcg-board-card--ready" : "") +
        (isFlying ? " tcg-board-card--flying" : "") +
        animCls
      }
      onClick={onClick && !disabled ? lp.guardClick(onClick) : undefined}
      onKeyDown={handleKey}
      onMouseDown={lp.start}
      onMouseUp={lp.cancel}
      onMouseLeave={lp.cancel}
      onMouseMove={lp.onMove}
      onTouchStart={lp.start}
      onTouchEnd={lp.cancel}
      onTouchCancel={lp.cancel}
      onTouchMove={lp.onMove}
      onContextMenu={lp.onContext}
      title={tip}
      data-tcg-draggable={dataDraggable || undefined}
      data-tcg-drop={dataDrop || undefined}
      data-tcg-card-id={dataCardId || undefined}
    >
      {isFlying && (
        <>
          <span className="tcg-flying-wings" aria-hidden="true">🪽</span>
          <span className="tcg-flying-shadow" aria-hidden="true" />
        </>
      )}
      {floats.length > 0 && (
        <div className="tcg-floats-layer" aria-hidden="true">
          {floats.map(f => (
            <span key={f.id} className={`tcg-float tcg-float--${f.kind}`}>
              {f.kind === "heal" ? `+${f.amount}` : `−${f.amount}`}
            </span>
          ))}
        </div>
      )}
      <div className="tcg-card-header">
        <CostPips def={def} size={size} />
        <span className="tcg-card-name">{def.name}</span>
        <span className="tcg-card-element">{ELEMENT_ICON[def.element]}</span>
      </div>
      <div className="tcg-card-art tcg-card-art--small">
        <CardArt def={def} />
        {onInspect && (
          <button
            type="button"
            className="tcg-card-inspect-btn tcg-card-inspect-btn--board"
            onClick={(e) => { e.stopPropagation(); onInspect(); }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            title="Ingrandisci e vedi i dettagli"
            aria-label="Ingrandisci"
          >🔍</button>
        )}
      </div>
      {mechs.length > 0 && (
        <div className="tcg-card-mechs tcg-card-mechs--mini">
          {mechs.map(k => {
            const m = TCG_MECHANICS[k];
            return <span key={k} className="tcg-card-mech-mini" title={labelFor(k)}>{m.icon}</span>;
          })}
        </div>
      )}
      <div className="tcg-card-stats tcg-card-stats--mtg">
        <span className="tcg-card-mtg-pt" title={`${bc.atk} attacco / ${bc.hp} su ${bc.maxHp} PF`}>
          <span className="tcg-card-mtg-atk">{bc.atk}</span>
          <span className="tcg-card-mtg-sep">/</span>
          <span className={`tcg-card-mtg-hp ${bc.hp < bc.maxHp ? "tcg-card-mtg-hp--wounded" : ""}`}>
            {bc.hp}
          </span>
          {bc.hp !== bc.maxHp && (
            <span className="tcg-card-mtg-hp-max" aria-label="su massimo">/{bc.maxHp}</span>
          )}
        </span>
      </div>
      {status === "sick" && <div className="tcg-board-tag tcg-board-tag--icon" title="Sonnolenza da evocazione — non può attaccare questo turno">😴</div>}
      {status === "tapped" && <div className="tcg-board-tag tcg-board-tag--icon" title="Già usato questo turno">✓</div>}
      {bc.revived && <div className="tcg-board-tag tcg-board-tag--icon tcg-board-tag--revived" title="Rinato dal cimitero">👻</div>}
    </div>
  );
}

/* ============================================================
   BATTLE LOG — kind detection + number highlighting
   ============================================================ */
const LOG_KIND_MAP = [
  ["🎴", "play"],
  ["⚔",  "attack"],
  ["🪽", "flying"],
  ["→",  "damage"],
  ["💀", "death"],
  ["🩸", "pierce"],
  ["💞", "heal"],
  ["👻", "veil"],
  ["💥", "cinder"],
  ["▶",  "turn"],
  ["⏭",  "skip"],
  ["🏆", "win"],
  ["🏳", "forfeit"],
  ["🗑", "discard"],
];

function parseLogLine(text) {
  for (const [emoji, kind] of LOG_KIND_MAP) {
    if (text.startsWith(emoji)) {
      return { kind, icon: emoji, body: text.slice(emoji.length).trim() };
    }
  }
  return { kind: "default", icon: "•", body: text };
}

/* Wrap standalone numbers (incl. X/Y, ×N.N) in <strong> so damage / HP
   / multipliers pop visually without changing the log payload itself. */
function highlightLogBody(body) {
  const parts = body.split(/(×\d+(?:\.\d+)?|\d+(?:\/\d+)?)/g);
  return parts.map((part, i) =>
    /^(×|\d)/.test(part)
      ? <strong key={i} className="tcg-log-num">{part}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

function LogLine({ line, mySide }) {
  const { kind, icon, body } = parseLogLine(line.text);
  const sideCls = line.side === mySide ? "mine" : "opp";
  return (
    <div className={`tcg-log-line tcg-log-line--${sideCls} tcg-log-line--${kind}`}>
      <span className="tcg-log-icon" aria-hidden="true">{icon}</span>
      <span className="tcg-log-text">{highlightLogBody(body)}</span>
    </div>
  );
}

/* ============================================================
   COMBAT PREVIEW — floating overlay above a legal attack target.
   Reads the engine's predictCombat() so the badge can't lie:
   if the bar says -5 💀 the target really will die from that
   click. Pierce overflow and Rinato (Veil) saves are surfaced
   so trades are auditable without playing them out.
   ============================================================ */
/* Boils the prediction down to a single label + tone the player
   can read in one glance. The verdict is what matters mid-game;
   the raw damage numbers go in a smaller second row. The full
   multiplier breakdown stays in the combat log for post-mortem. */
function combatVerdict(p) {
  if (p.targetRevives) {
    return { icon: "👻", label: "NON UCCIDE", tone: "revive" };
  }
  if (p.targetDies && p.attackerDies) {
    return { icon: "⚔", label: "DOPPIA MORTE", tone: "trade" };
  }
  if (p.targetDies) {
    const tail = p.pierceDmg > 0 ? ` +${p.pierceDmg} 👑` : "";
    return { icon: "💥", label: `LO UCCIDI${tail}`, tone: "kill" };
  }
  if (p.attackerDies) {
    return { icon: "💔", label: "MUORI", tone: "death" };
  }
  return { icon: "🩸", label: "COLPISCI", tone: "hit" };
}

function CombatPreview({ prediction }) {
  if (!prediction || prediction.kind !== "creature") return null;
  const { damageToTarget, damageToAttacker } = prediction;
  const verdict = combatVerdict(prediction);
  // Damage to target is always shown; retaliation slides in next to it
  // when non-zero. The verdict word goes to the hover title so the pill
  // can stay one line.
  return (
    <div
      className={`tcg-combat-preview tcg-combat-preview--${verdict.tone}`}
      title={verdict.label}
      aria-label={`${verdict.label}: infliggi ${damageToTarget}${damageToAttacker > 0 ? `, subisci ${damageToAttacker}` : ""}`}
    >
      <span className="tcg-combat-preview-icon">{verdict.icon}</span>
      <span className="tcg-combat-preview-num">{damageToTarget}</span>
      {damageToAttacker > 0 && (
        <>
          <span className="tcg-combat-preview-sep">/</span>
          <span className="tcg-combat-preview-num tcg-combat-preview-num--self">{damageToAttacker}</span>
        </>
      )}
    </div>
  );
}

/* Detect a portrait viewport (innerWidth < innerHeight on a phone-sized screen).
   Used to auto-rotate the match stage 90deg via CSS so the game always shows
   in landscape regardless of orientation lock. Works even when CSS
   @media (orientation: ...) is unreliable. */
function useIsPortrait() {
  const compute = () => {
    if (typeof window === "undefined") return false;
    return window.innerHeight > window.innerWidth && window.innerWidth < 900;
  };
  const [isPortrait, setIsPortrait] = useState(compute);
  useEffect(() => {
    const recompute = () => setIsPortrait(compute());
    window.addEventListener("resize", recompute);
    window.addEventListener("orientationchange", recompute);
    // Some phones fire orientationchange before the viewport actually updates.
    const t = setTimeout(recompute, 400);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("orientationchange", recompute);
      clearTimeout(t);
    };
  }, []);
  return isPortrait;
}

/* ============================================================
   SIDE PREVIEW — Arena-style right panel: focused card + big phase button.
   Hover (desktop) or long-press / 🔍 (mobile) on any card sets the focused
   card. The big button is the primary "end your turn" action — replaces
   the small button in the action bar.
   ============================================================ */
function SidePreview({ focusedCardId, onClear, onOpenDetail, myTurn, onEndTurn }) {
  const def = focusedCardId ? TCG_CARDS[focusedCardId] : null;
  /* Build inline detail blocks so the user sees every mechanic and
     effect explanation WHILE pressing the card — without needing to
     release (which hides the preview) and tap a "Dettagli" button. */
  const cardType = def ? getCardType(def) : null;
  const isCreature = cardType === "creature";
  const mechs = def ? (def.mechanics || []) : [];
  const effectText = def && !isCreature ? describeEffect(def) : null;
  return (
    <aside
      className={`tcg-side-preview${def ? "" : " tcg-side-preview--empty"}`}
      aria-label="Pannello carta in focus e fine turno"
    >
      {def ? (
        <div className="tcg-side-preview-scroll">
          <div className="tcg-side-preview-card-wrap">
            <Card card={def} size="md" showTooltip={false} />
          </div>
          {effectText && (
            <div className="tcg-side-preview-effect">
              <span className="tcg-side-preview-effect-label">{TYPE_ICON[cardType]} Effetto</span>
              <span className="tcg-side-preview-effect-text">{effectText}</span>
            </div>
          )}
          {mechs.length > 0 && (
            <div className="tcg-side-preview-mechs">
              <span className="tcg-side-preview-mechs-label">⚡ Abilità</span>
              {mechs.map(k => {
                const m = TCG_MECHANICS[k];
                if (!m) return null;
                return (
                  <div key={k} className={`tcg-side-preview-mech tcg-side-preview-mech--${k}`}>
                    <div className="tcg-side-preview-mech-head">
                      <span className="tcg-side-preview-mech-icon" style={{ background: m.color }}>{m.icon}</span>
                      <strong className="tcg-side-preview-mech-name">{getMechLabel(def, k)}</strong>
                    </div>
                    <div className="tcg-side-preview-mech-rules">{m.rules}</div>
                  </div>
                );
              })}
            </div>
          )}
          {def.flavor && (
            <div className="tcg-side-preview-flavor">
              <span className="tcg-side-preview-flavor-quote">“</span>
              {def.flavor}
              <span className="tcg-side-preview-flavor-quote">”</span>
            </div>
          )}
        </div>
      ) : (
        <div className="tcg-side-preview-card-wrap">
          <div className="tcg-side-preview-empty-msg">
            Passa il puntatore o tieni premuto su una carta per vederla qui.
          </div>
        </div>
      )}
      <button
        type="button"
        className={`tcg-side-turn-btn${myTurn ? " tcg-side-turn-btn--my" : ""}`}
        onClick={onEndTurn}
        disabled={!myTurn}
        title={myTurn ? "Termina il tuo turno" : "Sta giocando l'avversario"}
      >
        <span className="tcg-side-turn-btn-label">
          {myTurn ? "Tocca a te" : "Avversario"}
        </span>
        <span className="tcg-side-turn-btn-main">
          {myTurn ? "⏭ Fine turno" : "⏳ Attendi"}
        </span>
      </button>
    </aside>
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
  const [pendingSpell, setPendingSpell] = useState(null); // { instId, def, targets }
  const [viewingCard, setViewingCard] = useState(null);   // { cardId } | null — opens CardDetailModal
  const [focusedCardId, setFocusedCardId] = useState(null); // cardId shown in the side preview panel
  const [showLog, setShowLog] = useState(false);          // log popup open?
  const matchRootRef = useRef(null);                       // root <div> of the match — used for hover delegation
  const [compliment, setCompliment] = useState("");
  const [attackSplash, setAttackSplash] = useState(null); // { attacker, defender, side, kind, key }
  const [spellSplash, setSpellSplash] = useState(null);   // { cardId, side, type, ts }
  const lastSpellTsRef = useRef(match.state?.lastSpell?.ts || 0);
  const [attackAnim, setAttackAnim] = useState(null);     // { attackerId, targetId, side, ts }
  const [floats, setFloats] = useState([]);               // [{ id, kind, target, side, instId?, amount }]
  const [muted, setMuted] = useState(isSfxMuted());
  const isPortrait = useIsPortrait();
  /* End-of-match summary: how many ✦ Punti Bestiario the player just earned
     (set by the awardPetPoints call in the win-detection effect below). */
  const [endReward, setEndReward] = useState(null);
  // { points: N, label: "...", reason?: "daily-cap"|"already-seen"|... }
  /* Discard mode: when on, clicking a hand card discards it instead of
     playing. Lets the player free a slot when the hand is full, instead
     of silently burning newly-drawn cards. */
  const [discardMode, setDiscardMode] = useState(false);
  /* Hand collapse: when it isn't your turn, the hand auto-collapses so
     the field gets the spotlight. The user can tap the hand strip to
     peek without ending the collapse — and as soon as the turn comes
     back to them, the hand expands automatically. */
  const [handCollapsed, setHandCollapsed] = useState(!myTurn);
  useEffect(() => {
    setHandCollapsed(!myTurn);
  }, [myTurn]);
  // Animation queue — events from the engine fire sequentially with a small
  // gap so each one is visible. Engine state still commits in one go to
  // Firestore; only the visible effects are paced.
  const floatQueueRef = useRef([]);
  const floatPumpRef  = useRef(null);
  const lastEventIdxRef = useRef((match.state?.events || []).length);
  const logRef = useRef(null);
  const lastLogLenRef = useRef((match.state?.log || []).length);
  const lastAttackTsRef = useRef(match.state?.lastAttack?.ts || 0);
  const wonRef = useRef(false);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSfxMuted(next);
    setBgmMuted(next);
    if (!next) primeSfx();
  };

  /* Lock body scroll AND hide the site navbar while a battle is on
     screen. The battle shell is position:fixed and fills the viewport;
     the white site nav (z-index 1000) showed through on some devices
     where stacking contexts intercept the z-index battle, and the
     in-battle "← Lobby" button is the back-to-hub affordance. */
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("tcg-battle-active");
    /* Kick off the chiptune BGM. Browsers won't let it actually play
       until the first user gesture lands, but `startBgm` is idempotent
       — once the user clicks any button, the suspended audio context
       resumes and the loop is heard. */
    setBgmMuted(isSfxMuted());
    startBgm();
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      document.body.classList.remove("tcg-battle-active");
      stopBgm();
    };
  }, []);

  /* Card animation — driven by state.lastAttack (written by the engine).
     When ts changes we set a transient animState that BoardCard reads to
     pick its lunge/shake class. Auto-clears after 500ms. */
  useEffect(() => {
    const la = state.lastAttack;
    if (!la || !la.ts || la.ts === lastAttackTsRef.current) return;
    lastAttackTsRef.current = la.ts;
    setAttackAnim({
      attackerId: la.attacker,
      targetId: la.target,    // null when face attack
      side: la.side,
      ts: la.ts,
    });
  }, [state.lastAttack?.ts]);

  useEffect(() => {
    if (!attackAnim) return;
    const t = setTimeout(() => setAttackAnim(null), 500);
    return () => clearTimeout(t);
  }, [attackAnim]);

  /* Attack splash + sound effects — driven by new log entries.
     The same delta scan picks up plays, attacks, deaths, etc. and fires
     a sound per event; the most recent attack also drives the splash. */
  useEffect(() => {
    const log = state.log || [];
    const newLines = log.slice(lastLogLenRef.current);
    lastLogLenRef.current = log.length;
    if (newLines.length === 0) return;

    // 1) Fire sounds for every new event (in order).
    for (const line of newLines) {
      const t = line.text || "";
      if      (t.startsWith("🪽"))  playSfx("flying");
      else if (t.startsWith("⚔"))   playSfx("attack");
      else if (t.startsWith("🎴"))  playSfx("play");
      else if (t.startsWith("💀"))  playSfx("death");
      else if (t.startsWith("💥"))  playSfx("cinder");
      else if (t.startsWith("🩸"))  playSfx("pierce");
      else if (t.startsWith("💞"))  playSfx("heal");
      else if (t.startsWith("👻"))  playSfx("veil");
      else if (t.startsWith("▶"))   playSfx("turn");
      // Win/lose handled separately so we only chime once.
    }

    // 2) Find the most recent attack-class line for the splash.
    for (let i = newLines.length - 1; i >= 0; i--) {
      const line = newLines[i];
      const t = line.text || "";
      if (t.startsWith("⚔") || t.startsWith("🪽")) {
        let kind = t.startsWith("🪽") ? "flying" : "ground";
        let attacker = null;
        let defender = null;
        // "⚔ <attacker> attacca <defender>."
        let m = t.match(/^[⚔🪽]\s*(.+?)\s+attacca\s+(.+?)[\.…]/u);
        if (m) {
          attacker = m[1].trim();
          defender = m[2].trim();
        } else {
          // "⚔ <attacker> colpisce direttamente per X danni!"
          // "🪽 <attacker> sorvola la linea nemica e colpisce per X danni!"
          m = t.match(/^[⚔🪽]\s*(.+?)\s+(?:colpisce|sorvola)/u);
          if (m) {
            attacker = m[1].trim();
            defender = "👑";
            kind = t.startsWith("🪽") ? "flying-face" : "face";
          }
        }
        if (attacker) {
          setAttackSplash({
            attacker,
            defender,
            side: line.side,
            kind,
            key: `${log.length}-${i}`,
          });
        }
        break;
      }
    }
  }, [state.log]);

  /* Float pipeline — watch state.events length and queue new ones for paced
     playback. Each event spawns a floating number; we run them sequentially
     with FLOAT_GAP_MS between starts so the player can read each hit. */
  const FLOAT_GAP_MS = 350;
  const FLOAT_LIFE_MS = 1100;
  useEffect(() => {
    const events = state.events || [];
    if (events.length < lastEventIdxRef.current) {
      // Undo/restore: rewind cursor without re-animating.
      lastEventIdxRef.current = events.length;
      return;
    }
    const newOnes = events.slice(lastEventIdxRef.current);
    lastEventIdxRef.current = events.length;
    if (newOnes.length === 0) return;
    floatQueueRef.current.push(...newOnes);
    if (floatPumpRef.current) return; // already running
    const tick = () => {
      const evt = floatQueueRef.current.shift();
      if (!evt) { floatPumpRef.current = null; return; }
      const id = Math.random().toString(36).slice(2, 9);
      setFloats(f => [...f, { id, ...evt }]);
      // Auto-remove after the CSS animation ends.
      setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), FLOAT_LIFE_MS);
      floatPumpRef.current = setTimeout(tick, FLOAT_GAP_MS);
    };
    tick();
  }, [state.events?.length]);

  /* Tidy timers on unmount so nothing fires into a stale component. */
  useEffect(() => {
    return () => {
      if (floatPumpRef.current) clearTimeout(floatPumpRef.current);
      floatPumpRef.current = null;
      floatQueueRef.current = [];
    };
  }, []);

  /* Fire win/lose chime once when the game ends — and award ✦ points
     (idempotent via resourceKey: match.id). The result populates the
     endReward modal so the player sees what they earned. */
  useEffect(() => {
    if (!state.winner || wonRef.current) return;
    wonRef.current = true;
    const isWin = state.winner === mySide;
    playSfx(isWin ? "win" : "lose");
    const source = isWin ? "tcg_match_win" : "tcg_match_play";
    const def = PET_POINT_SOURCES[source];
    awardPetPoints(uid, source, { resourceKey: match.id }).then((r) => {
      setEndReward({
        points: r?.awarded || 0,
        label:  def?.label || (isWin ? "Vittoria TCG" : "Sfida TCG"),
        reason: r?.reason || null,
        amount: def?.amount || 0,  // base reward shown when capped
      });
    });
  }, [state.winner, mySide, uid, match.id]);

  useEffect(() => {
    if (!attackSplash) return;
    const t = setTimeout(() => setAttackSplash(null), 1100);
    return () => clearTimeout(t);
  }, [attackSplash]);

  /* Spell / enchantment / counter cast splash — watch the engine's
     `lastSpell` write and trigger a centered card-cast animation.
     Enchantments and counters get a longer duration so the player has
     time to see what their opponent just cast. */
  useEffect(() => {
    const ls = state.lastSpell;
    if (!ls || !ls.ts || ls.ts === lastSpellTsRef.current) return;
    lastSpellTsRef.current = ls.ts;
    const def = TCG_CARDS[ls.cardId];
    if (!def) return;
    const type = getCardType(def);
    setSpellSplash({ cardId: ls.cardId, side: ls.side, type, ts: ls.ts });
  }, [state.lastSpell?.ts]);

  useEffect(() => {
    if (!spellSplash) return;
    // Enchantments + counters linger longer than regular spells (so the
    // opponent doesn't miss what just hit them).
    const dur = (spellSplash.type === "enchantment" || spellSplash.type === "counter") ? 2200 : 1500;
    const t = setTimeout(() => setSpellSplash(null), dur);
    return () => clearTimeout(t);
  }, [spellSplash]);

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

  /* Clear selected attacker / pending spell when not my turn */
  useEffect(() => {
    if (!myTurn) {
      setSelectedAttacker(null);
      setPendingSpell(null);
    }
  }, [myTurn]);

  /* Turn-clock tick. Re-render every second so the countdown in
     the header updates smoothly. The auto-skip effect below reads
     the same `state.turnExpiry` and triggers `autoSkipTurn` when
     the deadline passes. */
  const [, setTurnTick] = useState(0);
  useEffect(() => {
    if (state.winner) return undefined;
    const t = setInterval(() => setTurnTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, [state.winner]);

  const matchRef = doc(db, "tcg_matches", match.id);

  /* updateState writes the new state and optionally captures a snapshot
     of the previous state for one-step undo. End-turn and forfeit clear
     the snapshot so the opponent's turn can't be rolled back. */
  const updateState = async (newState, opts = {}) => {
    const { snapshotForUndo = false, statusOverride = null } = opts;
    const patch = { state: newState, updatedAt: serverTimestamp() };
    patch.prevState = snapshotForUndo ? state : null;
    if (statusOverride) patch.status = statusOverride;
    else if (newState.winner) patch.status = "ended";
    try {
      await updateDoc(matchRef, patch);
    } catch (err) {
      console.error("tcg update failed:", err);
      alert("Errore: " + err.message);
    }
  };

  /* Auto-skip on timeout. EITHER client can fire this — the spectator
     drives it if the active player is AFK; the active player drives it
     if they're online but stalled. The local ref guards against this
     client firing twice for the same turn (the in-flight Firestore
     write hasn't flipped activeSide yet). */
  const autoSkipFiredRef = useRef(null);
  useEffect(() => {
    autoSkipFiredRef.current = null;
  }, [state.activeSide, state.round]);
  useEffect(() => {
    if (state.winner) return undefined;
    if (!state.turnExpiry) return undefined;
    const check = async () => {
      if (Date.now() < state.turnExpiry) return;
      const turnKey = `${state.round}:${state.activeSide}`;
      if (autoSkipFiredRef.current === turnKey) return;
      autoSkipFiredRef.current = turnKey;
      try {
        const next = autoSkipTurn(state, state.activeSide);
        if (next !== state) await updateState(next);
      } catch (e) {
        console.error("tcg auto-skip failed:", e);
      }
    };
    check();
    const t = setInterval(check, 1000);
    return () => clearInterval(t);
    // Re-arm when the turn flips (new activeSide/round) so the next
    // turn gets its own deadline check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.turnExpiry, state.activeSide, state.round, state.winner]);

  const handleDiscardCard = async (instId) => {
    if (!myTurn || state.winner) return;
    const card = state.hand[mySide].find(c => c.instId === instId);
    if (!card) return;
    const def = TCG_CARDS[card.cardId];
    if (!window.confirm(`Scartare "${def?.name || card.cardId}"? Andrà al cimitero.`)) return;
    const next = discardCard(state, mySide, instId);
    await updateState(next, { snapshotForUndo: true });
    setDiscardMode(false);
  };

  const handlePlayCard = async (instId) => {
    // In discard mode any hand-card click discards instead of plays.
    if (discardMode) {
      await handleDiscardCard(instId);
      return;
    }
    if (!canPlayCard(state, mySide, instId)) return;
    const card = state.hand[mySide].find(c => c.instId === instId);
    const def = card ? TCG_CARDS[card.cardId] : null;
    if (!def) return;
    const type = getCardType(def);

    // Creature: just play. Spell with no target: cast immediately.
    if (type === "creature") {
      const next = playCard(state, mySide, instId);
      await updateState(next, { snapshotForUndo: true });
      return;
    }
    // Spell
    const need = def.effect?.target || "none";
    if (need === "none") {
      const next = playCard(state, mySide, instId, null);
      await updateState(next, { snapshotForUndo: true });
      return;
    }
    // Toggle: clicking the same spell again cancels pending mode
    if (pendingSpell?.instId === instId) {
      setPendingSpell(null);
      return;
    }
    // Enter target-picking mode (also drop any attacker selection)
    const targets = legalSpellTargets(state, mySide, instId);
    setSelectedAttacker(null);
    setPendingSpell({ instId, def, targets });
  };

  const handleSelectAttacker = (instId) => {
    if (!canAttack(state, mySide, instId)) return;
    // Selecting an attacker cancels any spell-target picking in progress
    setPendingSpell(null);
    setSelectedAttacker(instId === selectedAttacker ? null : instId);
  };

  const handleAttackTarget = async (targetInstId) => {
    if (!selectedAttacker) return;
    const next = attackWith(state, mySide, selectedAttacker, targetInstId);
    setSelectedAttacker(null);
    await updateState(next, { snapshotForUndo: !next.winner });
  };

  const handleSpellTarget = async (target) => {
    if (!pendingSpell) return;
    const next = playCard(state, mySide, pendingSpell.instId, target);
    setPendingSpell(null);
    await updateState(next, { snapshotForUndo: !next.winner });
  };

  const cancelPendingSpell = () => setPendingSpell(null);

  /* Restore the snapshot captured before the last action. Only valid
     during your own turn, before the game ends. */
  const canUndo = myTurn && !state.winner && !!match.prevState;
  const handleUndo = async () => {
    if (!canUndo) return;
    setSelectedAttacker(null);
    setAttackAnim(null);
    // Suppress re-animating an older attack that the restored state carries.
    lastAttackTsRef.current = match.prevState?.lastAttack?.ts || 0;
    await updateState(match.prevState, { snapshotForUndo: false });
  };

  const handleEndTurn = async () => {
    const next = endTurn(state, mySide);
    setSelectedAttacker(null);
    await updateState(next); // snapshot cleared — turn flips to opponent
  };

  const handleForfeit = async () => {
    if (!window.confirm("Sicuro di voler abbandonare? Perderai la partita.")) return;
    const next = forfeit(state, mySide);
    await updateState(next);
  };

  const targets = selectedAttacker
    ? legalAttackTargets(state, mySide, selectedAttacker)
    : { creatures: [], face: false };

  /* Helper: is bc.instId a legal target for the pending spell? */
  const isLegalSpellTarget = (sideOfCard, instId) => {
    if (!pendingSpell?.targets) return false;
    const t = pendingSpell.targets;
    if (t.kind === "none") return false;
    const list = t.creatures?.[sideOfCard];
    return Array.isArray(list) && list.includes(instId);
  };
  const isLegalSpellChampion = (champSide) => {
    if (!pendingSpell?.targets) return false;
    const champs = pendingSpell.targets.champions;
    return Array.isArray(champs) && champs.includes(champSide);
  };

  /* ──────────────────────────────────────────────────────────────
     DRAG AND DROP — pointer-events based, works on touch and mouse.
     Drag from hand → drop on play-zone (creature) or on a target
     (spell-with-target). Drag from your own creature → drop on
     enemy creature or champion to attack. Tap-to-play still works.
     ────────────────────────────────────────────────────────────── */
  const [dragInfo, setDragInfo] = useState(null); // { kind, instId, def, x, y }
  const dragGhostRef = useRef(null);
  const dragHoverElRef = useRef(null);
  const dragStartedRef = useRef(false);
  const justDraggedRef = useRef(false);
  const downStartRef = useRef(null);
  const stateRef = useRef(state);
  const updateStateRef = useRef(null);
  useEffect(() => { stateRef.current = state; });
  useEffect(() => { updateStateRef.current = updateState; });

  useEffect(() => {
    /* A desktop mouse click can twitch a few pixels between mousedown and
       mouseup. With a 6-px threshold those clicks were being misread as
       drags, which then suppressed the click via onClickCapture — the
       card appeared "unclickable" after a hover. 10 px is forgiving for
       a click while still feeling responsive to a real drag. */
    const THRESHOLD = 10;

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      const el = e.target?.closest?.("[data-tcg-draggable]");
      if (!el) return;
      const spec = el.getAttribute("data-tcg-draggable");
      if (!spec) return;
      const [kind, ...rest] = spec.split(":");
      const instId = rest.join(":");
      downStartRef.current = { x: e.clientX, y: e.clientY, kind, instId };
      dragStartedRef.current = false;
    }

    function onPointerMove(e) {
      const downStart = downStartRef.current;
      if (!downStart) return;
      if (!dragStartedRef.current) {
        if (Math.hypot(e.clientX - downStart.x, e.clientY - downStart.y) < THRESHOLD) return;
        // Begin drag — resolve card def from hand or board
        const s = stateRef.current;
        const fromHand  = s.hand[mySide].find(c => c.instId === downStart.instId);
        const fromBoard = s.board[mySide].find(c => c.instId === downStart.instId);
        const inst = fromHand || fromBoard;
        const def = inst ? TCG_CARDS[inst.cardId] : null;
        if (!def) { downStartRef.current = null; return; }
        dragStartedRef.current = true;
        // Ghost rides on the pointer — the CSS transform on
        // .tcg-drag-ghost positions the card so its body sits above
        // the pointer (so the player can see what they're dragging
        // and the finger doesn't cover the card).
        setDragInfo({ kind: downStart.kind, instId: downStart.instId, def, x: e.clientX, y: e.clientY });
      }
      if (dragGhostRef.current) {
        dragGhostRef.current.style.left = `${e.clientX}px`;
        dragGhostRef.current.style.top  = `${e.clientY}px`;
      }
      // Update hover drop zone
      const drop = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-tcg-drop]") || null;
      if (drop !== dragHoverElRef.current) {
        dragHoverElRef.current?.classList.remove("tcg-drop-hover");
        drop?.classList.add("tcg-drop-hover");
        dragHoverElRef.current = drop;
      }
    }

    function dispatchDrop(kind, instId, dropId) {
      const s = stateRef.current;
      if (!dropId) return;
      if (kind === "hand") {
        if (!canPlayCard(s, mySide, instId)) return;
        const card = s.hand[mySide].find(c => c.instId === instId);
        const def = card ? TCG_CARDS[card.cardId] : null;
        if (!def) return;
        const type = getCardType(def);
        if (type === "creature") {
          if (dropId === "play-zone" || dropId.startsWith(`creature:${mySide}:`) || dropId === `champion:${mySide}`) {
            const next = playCard(s, mySide, instId);
            updateStateRef.current?.(next, { snapshotForUndo: true });
          }
          return;
        }
        const need = def.effect?.target || "none";
        if (need === "none") {
          if (dropId === "play-zone" || dropId.startsWith("creature:") || dropId.startsWith("champion:")) {
            const next = playCard(s, mySide, instId, null);
            updateStateRef.current?.(next, { snapshotForUndo: true });
          }
          return;
        }
        const t = legalSpellTargets(s, mySide, instId);
        let target = null;
        if (dropId.startsWith("creature:")) {
          const parts = dropId.split(":");
          const side = parts[1];
          const tid  = parts.slice(2).join(":");
          if (t.creatures?.[side]?.includes(tid)) target = { kind: "creature", side, instId: tid };
        } else if (dropId.startsWith("champion:")) {
          const side = dropId.split(":")[1];
          if (t.champions?.includes(side)) target = { kind: "champion", side };
        }
        if (target) {
          const next = playCard(s, mySide, instId, target);
          updateStateRef.current?.(next, { snapshotForUndo: !next.winner });
        }
        return;
      }
      if (kind === "board") {
        if (!canAttack(s, mySide, instId)) return;
        const oSide2 = oppSide(mySide);
        const t = legalAttackTargets(s, mySide, instId);
        if (dropId === `champion:${oSide2}` && t.face) {
          const next = attackWith(s, mySide, instId, null);
          updateStateRef.current?.(next, { snapshotForUndo: !next.winner });
        } else if (dropId.startsWith(`creature:${oSide2}:`)) {
          const tid = dropId.split(":").slice(2).join(":");
          if (t.creatures.includes(tid)) {
            const next = attackWith(s, mySide, instId, tid);
            updateStateRef.current?.(next, { snapshotForUndo: !next.winner });
          }
        }
      }
    }

    function onPointerUp(e) {
      const downStart = downStartRef.current;
      if (!downStart) return;
      const wasDragging = dragStartedRef.current;
      const ds = downStart;
      downStartRef.current = null;
      dragStartedRef.current = false;
      if (!wasDragging) return;
      const drop = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-tcg-drop]") || null;
      const dropId = drop?.getAttribute("data-tcg-drop") || null;
      dragHoverElRef.current?.classList.remove("tcg-drop-hover");
      dragHoverElRef.current = null;
      justDraggedRef.current = true;
      // Reset on next macrotask — the synthetic click fires right after pointerup
      setTimeout(() => { justDraggedRef.current = false; }, 50);
      setDragInfo(null);
      dispatchDrop(ds.kind, ds.instId, dropId);
    }

    function onClickCapture(e) {
      if (justDraggedRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("click", onClickCapture, true);
      dragHoverElRef.current?.classList.remove("tcg-drop-hover");
      dragHoverElRef.current = null;
    };
    // The effect re-mounts only on side change; latest state/updateState are read via refs.
  }, [mySide]);

  /* Card focus tracking — the preview is a centered MTG-style popup
     that appears after the pointer rests on a card for ~1.5s. The
     delay prevents the popup from blocking drag interactions: by the
     time it would have appeared, the user has either committed to a
     drag (pointerdown cancels the timer) or actually wants a closer
     look. Long-press / right-click / 🔍 button paths bypass the delay
     via onInspect and still open the preview instantly. */
  useEffect(() => {
    const root = matchRootRef.current;
    if (!root) return;
    let hoverTimer = null;
    let pendingId = null;
    const cancelPending = () => {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      pendingId = null;
    };
    function onOver(e) {
      const el = e.target?.closest?.("[data-tcg-card-id]");
      if (!el) return;
      const id = el.getAttribute("data-tcg-card-id");
      if (!id || id === pendingId) return;
      cancelPending();
      pendingId = id;
      hoverTimer = setTimeout(() => {
        if (dragStartedRef.current) return;
        setFocusedCardId(id);
        hoverTimer = null;
      }, 1500);
    }
    function onOut(e) {
      const next = e.relatedTarget;
      if (!next || typeof next.closest !== "function") {
        cancelPending();
        setFocusedCardId(null);
        return;
      }
      // Moving between cards — re-arm timer for the next card via onOver.
      if (next.closest("[data-tcg-card-id]")) {
        cancelPending();
        setFocusedCardId(null);
        return;
      }
      cancelPending();
      setFocusedCardId(null);
    }
    // Any press on a card cancels the pending popup and hides it — so
    // the user can drag or tap without the popup getting in the way.
    function onDown() {
      cancelPending();
      setFocusedCardId(null);
    }
    root.addEventListener("pointerover", onOver);
    root.addEventListener("pointerout", onOut);
    root.addEventListener("pointerdown", onDown, true);
    return () => {
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerout", onOut);
      root.removeEventListener("pointerdown", onDown, true);
      cancelPending();
    };
  }, []);

  /* Per-card animation lookup. Returns null when the card isn't involved
     in the current lastAttack, otherwise the role + a ts that drives the
     CSS keyframe restart via `key`. */
  const getCardAnim = (instId) => {
    if (!attackAnim) return null;
    if (attackAnim.attackerId === instId) {
      return {
        role: attackAnim.side === mySide ? "attacker-up" : "attacker-down",
        ts: attackAnim.ts,
      };
    }
    if (attackAnim.targetId && attackAnim.targetId === instId) {
      return { role: "target", ts: attackAnim.ts };
    }
    return null;
  };

  /* End screen */
  if (state.winner) {
    const won = state.winner === mySide;
    const winnerName = won ? match[mySide].name : match[oSide].name;
    return (
      <div className="tcg-end">
        <div className={`tcg-end-card ${won ? "tcg-end-card--win" : "tcg-end-card--loss"}`}>
          <div className="tcg-end-icon">{won ? "🏆" : "💀"}</div>
          <h2 className="tcg-end-title">
            {won ? "VITTORIA!" : "SCONFITTA"}
          </h2>
          <div className="tcg-end-winner-row">
            👑 <strong>{winnerName}</strong> vince la sfida
          </div>
          {won && (
            <div className="tcg-end-compliment">
              <span className="tcg-end-compliment-quote">"</span>
              {compliment}
              <span className="tcg-end-compliment-quote">"</span>
            </div>
          )}
          <div className="tcg-end-reward">
            {endReward == null ? (
              <span className="tcg-end-reward-pending">Calcolo ricompensa…</span>
            ) : endReward.points > 0 ? (
              <>
                <span className="tcg-end-reward-icon">✦</span>
                <span className="tcg-end-reward-amount">+{endReward.points}</span>
                <span className="tcg-end-reward-label">Punti Bestiario</span>
                <span className="tcg-end-reward-source">({endReward.label})</span>
              </>
            ) : (
              <span className="tcg-end-reward-capped">
                {endReward.reason === "daily-cap"
                  ? `Tetto giornaliero raggiunto — niente ✦ extra oggi.`
                  : endReward.reason === "already-seen"
                  ? `Ricompensa già assegnata per questa partita.`
                  : `Nessun ✦ assegnato.`}
              </span>
            )}
          </div>
          <div className="tcg-end-summary">
            {match.challenger.name} <span className="tcg-end-vs">vs</span> {match.challenged.name}
          </div>
          <div className="tcg-end-log" ref={logRef}>
            {(state.log || []).slice(-20).map((line, i) => (
              <LogLine key={i} line={line} mySide={mySide} />
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
    <div ref={matchRootRef} className={`tcg-match tcg-match--arcane${isPortrait ? " tcg-match--portrait" : ""}`}>
      {/* Stage: in portrait this gets CSS-rotated 90deg so phones with
          orientation lock still see the game in landscape. The arcane
          background lives inside the stage so it rotates with it. */}
      <div className="tcg-match-stage">
      {/* Dark magical scene: drifting motes + arcane rune ring (pure CSS) */}
      <div className="tcg-arcane-bg" aria-hidden="true">
        <div className="tcg-arcane-runes" />
        <div className="tcg-arcane-motes" />
        <div className="tcg-arcane-glow" />
      </div>
      {attackSplash && (
        <div
          key={attackSplash.key}
          className={
            `tcg-attack-splash tcg-attack-splash--${attackSplash.kind}` +
            (attackSplash.side === mySide ? " tcg-attack-splash--mine" : " tcg-attack-splash--opp")
          }
          aria-hidden="true"
        >
          <div className="tcg-attack-splash-card">
            <div className="tcg-attack-splash-attacker">
              {attackSplash.kind.startsWith("flying") ? "🪽" : "⚔"} {attackSplash.attacker}
            </div>
            <div className="tcg-attack-splash-vs">
              <span className="tcg-attack-splash-clash">💥</span>
              <span className="tcg-attack-splash-spark tcg-attack-splash-spark--1">✦</span>
              <span className="tcg-attack-splash-spark tcg-attack-splash-spark--2">✦</span>
              <span className="tcg-attack-splash-spark tcg-attack-splash-spark--3">✦</span>
              <span className="tcg-attack-splash-spark tcg-attack-splash-spark--4">✦</span>
            </div>
            <div className="tcg-attack-splash-defender">
              {attackSplash.defender}
            </div>
          </div>
        </div>
      )}
      {spellSplash && (() => {
        const def = TCG_CARDS[spellSplash.cardId];
        if (!def) return null;
        const type = spellSplash.type;
        const isMine = spellSplash.side === mySide;
        return (
          <div
            key={spellSplash.ts}
            className={
              `tcg-spell-splash tcg-spell-splash--${type}` +
              ` tcg-spell-splash--el-${def.element}` +
              (isMine ? " tcg-spell-splash--mine" : " tcg-spell-splash--opp")
            }
            aria-hidden="true"
          >
            <div className="tcg-spell-splash-card">
              <div className="tcg-spell-splash-type-icon">
                {type === "enchantment" ? "🌟" : type === "counter" ? "🛡" : "📜"}
              </div>
              <div className="tcg-spell-splash-name">{def.name}</div>
              <div className="tcg-spell-splash-meta">
                <span className="tcg-spell-splash-type">
                  {type === "enchantment" ? "Aura" : type === "counter" ? "Contromagia" : "Incantesimo"}
                </span>
                <span className="tcg-spell-splash-elem">{ELEMENT_ICON[def.element]}</span>
              </div>
              <div className="tcg-spell-splash-cast">
                {isMine ? "TU LANCI" : "L'AVVERSARIO LANCIA"}
              </div>
              <span className="tcg-spell-splash-glow" aria-hidden="true" />
              <span className="tcg-spell-splash-ring" aria-hidden="true" />
            </div>
          </div>
        );
      })()}
      <header className="tcg-match-head">
        <button className="tcg-btn tcg-btn--ghost tcg-btn--tiny" onClick={onExit}>← Lobby</button>
        <div className="tcg-match-round">
          Turno {state.round} · {myTurn ? "🟢 Tocca a te" : "⏳ Avversario"}
          {state.turnExpiry && !state.winner && (() => {
            const msLeft = Math.max(0, state.turnExpiry - Date.now());
            const min = Math.floor(msLeft / 60000);
            const sec = Math.floor((msLeft % 60000) / 1000);
            const urgent = msLeft < 20000;
            return (
              <span className={`tcg-turn-timer${urgent ? " tcg-turn-timer--urgent" : ""}`} title="Tempo rimanente per agire">
                ⏱ {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
              </span>
            );
          })()}
        </div>
        <button
          className="tcg-btn tcg-btn--ghost tcg-btn--tiny tcg-btn--mute"
          onClick={toggleMute}
          title={muted ? "Riattiva l'audio" : "Silenzia"}
          aria-label={muted ? "Riattiva audio" : "Silenzia"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="tcg-btn tcg-btn--ghost tcg-btn--tiny tcg-btn--danger" onClick={handleForfeit}>
          🏳 Abbandona
        </button>
      </header>

      {/* Opponent zone */}
      <div className="tcg-zone tcg-zone--opp">
        <div data-tcg-drop={`champion:${oSide}`} className="tcg-drop-target tcg-drop-target--champion">
        <PlayerStrip
          side={oSide}
          name={match[oSide].name}
          hp={state.hp[oSide]}
          mana={state.mana[oSide]}
          crystals={state.crystals?.[oSide] || []}
          deckCount={state.deck[oSide].length}
          handCount={oppHand.length}
          opponent
          isActive={!myTurn}
          burn={state.burn?.[oSide] || 0}
          secretCount={state.secrets?.[oSide]?.length || 0}
          shield={state.dmgShield?.[oSide] || 0}
          regen={state.champRegen?.[oSide] || 0}
          floats={floats.filter(f => f.target === "champion" && f.side === oSide)}
        />
        </div>
        <div className="tcg-board tcg-board--opp">
          {oppBoard.length === 0 ? (
            <div className="tcg-board-empty">Campo vuoto</div>
          ) : oppBoard.map(bc => {
            const def = TCG_CARDS[bc.cardId];
            const isAttackLegal = !!selectedAttacker && targets.creatures.includes(bc.instId);
            const isSpellLegal  = isLegalSpellTarget(oSide, bc.instId);
            const onClick = isAttackLegal
              ? () => handleAttackTarget(bc.instId)
              : isSpellLegal
                ? () => handleSpellTarget({ kind: "creature", side: oSide, instId: bc.instId })
                : undefined;
            const isLegal = isAttackLegal || isSpellLegal;
            const prediction = isAttackLegal
              ? predictCombat(state, mySide, selectedAttacker, bc.instId)
              : null;
            return (
              <div key={bc.instId} className="tcg-board-slot" data-tcg-drop={`creature:${oSide}:${bc.instId}`}>
                <BoardCard
                  bc={bc}
                  def={def}
                  onClick={onClick}
                  disabled={!isLegal}
                  selected={isLegal}
                  status={bc.tapped ? "tapped" : null}
                  attackAnim={getCardAnim(bc.instId)}
                  onInspect={() => setFocusedCardId(bc.cardId)}
                  floats={floats.filter(f => f.target === "creature" && f.instId === bc.instId)}
                  dataCardId={bc.cardId}
                />
                {prediction && <CombatPreview prediction={prediction} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Center divider with face-attack / spell-face target */}
      <div className="tcg-divider">
        <div className="tcg-divider-line" />
        {pendingSpell && (
          <div className="tcg-spell-banner">
            <span className="tcg-spell-banner-icon">📜</span>
            <div className="tcg-spell-banner-body">
              <strong>{pendingSpell.def.name}</strong>
              <span> · Scegli {describeTargetNeed(pendingSpell.def)}.</span>
            </div>
            <button type="button" className="tcg-spell-banner-cancel" onClick={cancelPendingSpell}>
              ✕ Annulla
            </button>
          </div>
        )}
        {pendingSpell && isLegalSpellChampion(oSide) && (
          <button
            className="tcg-face-attack tcg-face-attack--spell"
            onClick={() => handleSpellTarget({ kind: "champion", side: oSide })}
            title="Lancia l'incantesimo sul campione avversario"
          >
            🎯 Lancia su {match[oSide].name}
          </button>
        )}
        {!pendingSpell && selectedAttacker && targets.face && (() => {
          const facePred = predictCombat(state, mySide, selectedAttacker, null);
          const hpBefore = facePred?.championHpBefore ?? 0;
          const hpAfter  = facePred?.championHpAfter  ?? 0;
          const burn     = facePred?.bruciatura ?? 0;
          const shieldAbsorb = facePred?.shieldAbsorb ?? 0;
          return (
            <button
              className="tcg-face-attack"
              onClick={() => handleAttackTarget(null)}
              title={
                `${match[oSide].name}: ${hpBefore} → ${hpAfter} PF` +
                (shieldAbsorb > 0 ? ` (🛡 −${shieldAbsorb})` : "") +
                (burn > 0 ? ` · 🔥 Bruciatura ${burn}` : "")
              }
            >
              🎯 Colpisci {match[oSide].name}
              <span className="tcg-face-attack-hp">
                ❤ {hpBefore} <span className="tcg-face-attack-arrow">→</span> <strong>{hpAfter}</strong>
                {hpAfter === 0 && <span className="tcg-face-attack-skull"> 💀</span>}
              </span>
              {burn > 0 && <span className="tcg-face-attack-burn">🔥 {burn}</span>}
            </button>
          );
        })()}
        {!pendingSpell && selectedAttacker && !targets.face && targets.creatures.length > 0 && (() => {
          // Distinguish "must hit a Bulwark first" from the new general
          // "lane is blocked" rule. The opp's reachable creatures with
          // Bulwark mean priority targeting; otherwise it's just defenders
          // in the way.
          const oppB = state.board[oSide];
          const reachableInst = new Set(targets.creatures);
          const reachableBulwarks = oppB.filter(c => reachableInst.has(c.instId) && (TCG_CARDS[c.cardId]?.mechanics || []).includes("bulwark"));
          if (reachableBulwarks.length > 0) {
            return <div className="tcg-divider-hint">🛡 Devi colpire prima un Baluardo!</div>;
          }
          return <div className="tcg-divider-hint">🛡 La difesa avversaria blocca il campione: abbattila prima!</div>;
        })()}
        <div className="tcg-divider-line" />
      </div>

      {/* My zone */}
      <div className="tcg-zone tcg-zone--mine">
        <div className="tcg-board tcg-board--mine" data-tcg-drop="play-zone">
          {myBoard.length === 0 ? (
            <div className="tcg-board-empty">Gioca una carta dalla mano</div>
          ) : myBoard.map(bc => {
            const def = TCG_CARDS[bc.cardId];
            const ready = canAttack(state, mySide, bc.instId);
            const isSelected = selectedAttacker === bc.instId;
            const isSpellLegal = isLegalSpellTarget(mySide, bc.instId);
            const onClick = isSpellLegal
              ? () => handleSpellTarget({ kind: "creature", side: mySide, instId: bc.instId })
              : ready
                ? () => handleSelectAttacker(bc.instId)
                : undefined;
            const status = bc.tapped ? "tapped" : (bc.sick ? "sick" : (ready ? "ready" : null));
            return (
              <BoardCard
                key={bc.instId}
                bc={bc}
                def={def}
                onClick={onClick}
                disabled={!onClick}
                selected={isSelected || isSpellLegal}
                status={status}
                attackAnim={getCardAnim(bc.instId)}
                onInspect={() => setFocusedCardId(bc.cardId)}
                floats={floats.filter(f => f.target === "creature" && f.instId === bc.instId)}
                dataDraggable={myTurn && ready ? `board:${bc.instId}` : undefined}
                dataDrop={`creature:${mySide}:${bc.instId}`}
                dataCardId={bc.cardId}
              />
            );
          })}
        </div>
        <div data-tcg-drop={`champion:${mySide}`} className="tcg-drop-target tcg-drop-target--champion">
        <PlayerStrip
          side={mySide}
          name={match[mySide].name}
          hp={state.hp[mySide]}
          mana={state.mana[mySide]}
          crystals={state.crystals?.[mySide] || []}
          crystalsPlayedThisTurn={state.crystalsPlayedThisTurn?.[mySide] || 0}
          deckCount={state.deck[mySide].length}
          handCount={myHand.length}
          isActive={myTurn}
          burn={state.burn?.[mySide] || 0}
          secretCount={state.secrets?.[mySide]?.length || 0}
          shield={state.dmgShield?.[mySide] || 0}
          regen={state.champRegen?.[mySide] || 0}
          ownSecrets={state.secrets?.[mySide] || []}
          floats={floats.filter(f => f.target === "champion" && f.side === mySide)}
        />
        </div>
      </div>

      {/* Hand */}
      <div className={`tcg-hand-wrap${handCollapsed ? " tcg-hand-wrap--collapsed" : ""}`}>
        <button
          type="button"
          className="tcg-hand-label"
          onClick={() => setHandCollapsed(c => !c)}
          aria-expanded={!handCollapsed}
          title={handCollapsed ? "Tocca per aprire la mano" : "Tocca per minimizzare"}
        >
          <span className="tcg-hand-label-toggle" aria-hidden="true">{handCollapsed ? "▲" : "▼"}</span>
          🎴 La tua mano · {myHand.length}/{MAX_HAND} carte
          {!myTurn && (
            <span className="tcg-hand-label-warn">
              {" "}· ⏳ <strong>Turno avversario</strong>
            </span>
          )}
          {myHand.length >= MAX_HAND && !discardMode && (
            <span className="tcg-hand-label-warn">
              {" "}· ⚠ <strong>Mano piena</strong>: le carte pescate verranno bruciate. Premi <strong>🗑 Scarta</strong> per liberare uno slot.
            </span>
          )}
          {discardMode && (
            <span className="tcg-hand-label-warn">
              {" "}· 🗑 <strong>Tocca una carta per scartarla</strong>
            </span>
          )}
          {pendingSpell && (
            <span className="tcg-hand-label-spell">
              {" "}· 📜 Castando <strong>{pendingSpell.def.name}</strong>
            </span>
          )}
        </button>
        <div className="tcg-hand">
          {myHand.length === 0 ? (
            <div className="tcg-board-empty">Mano vuota</div>
          ) : myHand.map(c => {
            const def = TCG_CARDS[c.cardId];
            const playable = canPlayCard(state, mySide, c.instId);
            const isPending = pendingSpell?.instId === c.instId;
            const isDragging = dragInfo?.kind === "hand" && dragInfo?.instId === c.instId;
            return (
              <Card
                key={c.instId}
                card={def}
                size="md"
                onClick={() => handlePlayCard(c.instId)}
                disabled={discardMode ? false : (!playable && !isPending)}
                selected={isPending || discardMode}
                className={
                  (isPending ? "tcg-card--pending-spell" : "") +
                  (discardMode ? " tcg-card--discard-target" : "") +
                  (isDragging ? " tcg-card--dragging" : "")
                }
                onInspect={() => setFocusedCardId(c.cardId)}
                dataDraggable={myTurn && playable && !discardMode ? `hand:${c.instId}` : undefined}
                dataCardId={c.cardId}
              />
            );
          })}
        </div>
      </div>

      {/* Side preview panel: focused card + big phase button (Arena-style) */}
      <SidePreview
        focusedCardId={focusedCardId}
        onClear={() => setFocusedCardId(null)}
        onOpenDetail={() => focusedCardId && setViewingCard({ cardId: focusedCardId })}
        myTurn={myTurn}
        onEndTurn={handleEndTurn}
      />

      {/* Action bar. The full log moved to a popup (📜 button); the bar
          now holds just three primary actions: Annulla / Log / Fine Turno.
          On portrait, the Fine Turno button is the primary end-turn UX;
          on desktop the side-preview's big button handles it and this one
          is hidden via CSS. */}
      <div className="tcg-action-bar">
        <div className="tcg-action-bar-buttons">
          <button
            type="button"
            className="tcg-btn tcg-btn--undo"
            onClick={handleUndo}
            disabled={!canUndo}
            title={canUndo ? "Annulla l'ultima azione" : "Niente da annullare"}
          >
            ↩ Annulla
          </button>
        </div>
        <button
          type="button"
          className={`tcg-action-log-btn tcg-action-log-btn--discard${discardMode ? " tcg-action-log-btn--active" : ""}`}
          onClick={() => setDiscardMode(m => !m)}
          disabled={!myTurn || myHand.length === 0}
          aria-pressed={discardMode}
          title={
            !myTurn
              ? "Solo durante il tuo turno"
              : discardMode
                ? "Annulla scarto"
                : myHand.length >= MAX_HAND
                  ? "Mano piena! Scarta una carta"
                  : "Scarta una carta dalla mano"
          }
        >
          🗑 {discardMode ? "Annulla" : "Scarta"}{myHand.length >= MAX_HAND ? " ⚠" : ""}
        </button>
        <button
          type="button"
          className="tcg-action-log-btn tcg-action-log-btn--log"
          onClick={() => setShowLog(true)}
          aria-label="Apri il registro della partita"
          title="Mostra cronologia mosse"
        >
          📜 Log
        </button>
        <button
          type="button"
          className={`tcg-action-turn-btn${myTurn ? " tcg-action-turn-btn--my" : ""}`}
          onClick={handleEndTurn}
          disabled={!myTurn}
          aria-label={myTurn ? "Termina il tuo turno" : "Sta giocando l'avversario"}
        >
          {myTurn ? "⏭ FINE TURNO" : "⏳ FINE TURNO"}
        </button>
      </div>

      {/* Log popup — opens on demand, closes on overlay click or × button.
          Lines render newest-first so the most recent move is right at the
          top without needing to scroll. */}
      {showLog && (
        <div
          className="tcg-overlay tcg-log-overlay"
          onClick={() => setShowLog(false)}
        >
          <div
            className="tcg-modal tcg-log-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tcg-log-modal-head">
              <span className="tcg-log-modal-title">📜 Cronologia partita</span>
              <button
                type="button"
                className="tcg-log-modal-close"
                onClick={() => setShowLog(false)}
                aria-label="Chiudi cronologia"
              >
                ✕
              </button>
            </div>
            <div className="tcg-log-modal-body" ref={logRef}>
              {(state.log || []).length === 0 ? (
                <div className="tcg-log-modal-empty">Nessuna mossa ancora.</div>
              ) : (
                state.log.slice().reverse().map((line, i) => (
                  <LogLine key={i} line={line} mySide={mySide} />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {viewingCard && (
        <CardDetailModal
          cardId={viewingCard.cardId}
          onClose={() => setViewingCard(null)}
        />
      )}
      </div>{/* /tcg-match-stage */}

      {dragInfo && (
        <div
          ref={dragGhostRef}
          className="tcg-drag-ghost"
          style={{ left: dragInfo.x, top: dragInfo.y }}
          aria-hidden="true"
        >
          <Card card={dragInfo.def} size="md" showTooltip={false} />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PLAYER STRIP — HP, mana, deck, hand counts
   ============================================================ */
function PlayerStrip({ side, name, hp, mana, crystals = [], crystalsPlayedThisTurn = 0, deckCount, handCount, opponent, isActive, burn = 0, secretCount = 0, shield = 0, regen = 0, ownSecrets = null, floats = [] }) {
  const hpPct = Math.max(0, Math.min(100, (hp / STARTING_HP) * 100));
  const secretsTip = ownSecrets && ownSecrets.length
    ? "Le tue Contromagie segrete:\n" + ownSecrets.map(s => `  • ${TCG_CARDS[s.cardId]?.name || s.cardId}`).join("\n")
    : (opponent ? `${secretCount} contromagi${secretCount === 1 ? "a" : "e"} segret${secretCount === 1 ? "a" : "e"} sul campo avversario` : "Nessuna contromagia segreta");
  return (
    <div className={`tcg-pstrip ${opponent ? "tcg-pstrip--opp" : "tcg-pstrip--mine"} ${isActive ? "tcg-pstrip--active" : ""}`}>
      {floats.length > 0 && (
        <div className="tcg-floats-layer tcg-floats-layer--champion" aria-hidden="true">
          {floats.map(f => (
            <span key={f.id} className={`tcg-float tcg-float--${f.kind}`}>
              {f.kind === "heal" ? `+${f.amount}` : `−${f.amount}`}
            </span>
          ))}
        </div>
      )}
      <div className="tcg-pstrip-name">
        {isActive && <span className="tcg-pstrip-dot" />}
        {opponent ? "👤" : "🎯"} {name}
        {burn > 0 && (
          <span className="tcg-pstrip-burn" title={`Bruciatura: 1 danno all'inizio dei prossimi ${burn} turni di ${name}`}>
            🔥 {burn}
          </span>
        )}
        {shield > 0 && (
          <span className="tcg-pstrip-shield" title={`Argine: assorbe i prossimi ${shield} danni in entrata`}>
            🛡 +{shield}
          </span>
        )}
        {regen > 0 && (
          <span className="tcg-pstrip-regen" title={`Aureola: ${name} recupera ${regen} PF all'inizio di ogni suo turno`}>
            👑 +{regen}/turno
          </span>
        )}
        {secretCount > 0 && (
          <span className="tcg-pstrip-secrets" title={secretsTip}>
            🛡 {secretCount} {secretCount === 1 ? "trappola" : "trappole"}
          </span>
        )}
      </div>
      <div className="tcg-pstrip-row">
        <div className="tcg-pstrip-hp">
          <div className="tcg-pstrip-hp-label">❤ {hp}/{STARTING_HP}</div>
          <div className="tcg-pstrip-hp-track">
            <div className="tcg-pstrip-hp-fill" style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <ElementalMana mana={mana} crystals={crystals} active={isActive} crystalPlayed={crystalsPlayedThisTurn > 0} isMine={!opponent} />
        <div className="tcg-pstrip-pile" title="Carte nel mazzo">📚 {deckCount}</div>
        <div className="tcg-pstrip-pile" title="Carte in mano">🃏 {handCount}</div>
      </div>
    </div>
  );
}

/* MTG-style per-element mana pool. Each element shows current/max,
   where "max" is the count of crystals of that element on the field.
   Hidden when there are no crystals of that element (clean strip).
   Empty state (turn 1) shows a hint that the player needs to play
   a Crystal card to generate mana. */
const TCG_ELEMENTS = ["fire", "water", "earth", "air", "light", "dark"];
const ELEMENT_PIP = {
  fire:  { icon: "🔥", color: "#dc2626" },
  water: { icon: "💧", color: "#1d4ed8" },
  earth: { icon: "🌿", color: "#15803d" },
  air:   { icon: "🌪", color: "#ea580c" },
  light: { icon: "✨", color: "#fbbf24" },
  dark:  { icon: "🌑", color: "#6b21a8" },
};
function ElementalMana({ mana, crystals = [], active, crystalPlayed = false, isMine = false }) {
  // Tally how many crystals of each element on the field (= max for that color).
  const max = { fire: 0, water: 0, earth: 0, air: 0, light: 0, dark: 0 };
  for (const el of crystals) if (max[el] !== undefined) max[el] += 1;
  const cur = mana || max; // fallback to max in case state is in flux
  const totalCrystals = crystals.length;
  return (
    <div
      className={`tcg-mana tcg-mana--elemental ${active ? "tcg-mana--active" : ""}`}
      title={`Cristalli sul campo: ${totalCrystals}${isMine ? ` · Cristalli giocati questo turno: ${crystalPlayed ? "1/1" : "0/1"}` : ""}`}
    >
      {totalCrystals === 0 ? (
        <span className="tcg-mana-empty">💎 Nessun cristallo</span>
      ) : (
        TCG_ELEMENTS.map(el => {
          if (max[el] === 0) return null;
          const c = cur[el] || 0;
          return (
            <span
              key={el}
              className={`tcg-mana-elpip tcg-mana-elpip--${el}`}
              style={{ "--pip": ELEMENT_PIP[el].color }}
              title={`${el}: ${c} / ${max[el]}`}
            >
              <span className="tcg-mana-elpip-icon">{ELEMENT_PIP[el].icon}</span>
              <span className="tcg-mana-elpip-num">
                <strong>{c}</strong>/{max[el]}
              </span>
            </span>
          );
        })
      )}
      {isMine && (
        <span
          className={`tcg-mana-cstcounter ${crystalPlayed ? "tcg-mana-cstcounter--used" : ""}`}
          title={crystalPlayed ? "Hai già giocato il cristallo di questo turno." : "Puoi ancora giocare 1 cristallo questo turno."}
        >
          💎 {crystalPlayed ? "1/1" : "0/1"}
        </span>
      )}
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
    if (filter === "creature" || filter === "spell" || filter === "enchantment" || filter === "counter") {
      return TCG_CARD_LIST.filter(c => getCardType(c) === filter);
    }
    return TCG_CARD_LIST.filter(c => c.element === filter || c.rarity === filter);
  }, [filter]);
  const creatureCount    = TCG_CARD_LIST.filter(c => getCardType(c) === "creature").length;
  const spellCount       = TCG_CARD_LIST.filter(c => getCardType(c) === "spell").length;
  const enchantmentCount = TCG_CARD_LIST.filter(c => getCardType(c) === "enchantment").length;
  const counterCount     = TCG_CARD_LIST.filter(c => getCardType(c) === "counter").length;

  return (
    <div className="tcg-codex">
      <p className="tcg-panel-sub tcg-codex-hint">
        💡 Clicca una carta per ingrandirla, leggere la descrizione e tutti i dettagli delle abilità.
      </p>
      <div className="tcg-codex-filters">
        <button className={`tcg-filter ${filter === "all" ? "tcg-filter--on" : ""}`} onClick={() => setFilter("all")}>
          Tutte ({TCG_CARD_LIST.length})
        </button>
        <button className={`tcg-filter tcg-filter--type-creature ${filter === "creature" ? "tcg-filter--on" : ""}`} onClick={() => setFilter("creature")}>
          🐲 Creature ({creatureCount})
        </button>
        <button className={`tcg-filter tcg-filter--type-spell ${filter === "spell" ? "tcg-filter--on" : ""}`} onClick={() => setFilter("spell")}>
          📜 Incantesimi ({spellCount})
        </button>
        <button className={`tcg-filter tcg-filter--type-enchantment ${filter === "enchantment" ? "tcg-filter--on" : ""}`} onClick={() => setFilter("enchantment")}>
          🌟 Aure ({enchantmentCount})
        </button>
        <button className={`tcg-filter tcg-filter--type-counter ${filter === "counter" ? "tcg-filter--on" : ""}`} onClick={() => setFilter("counter")}>
          🛡 Contromagie ({counterCount})
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
  const byElCost = (a, b) => (a.element + a.cost).localeCompare(b.element + b.cost);
  const spellCards       = TCG_CARD_LIST.filter(c => getCardType(c) === "spell").sort(byElCost);
  const enchantmentCards = TCG_CARD_LIST.filter(c => getCardType(c) === "enchantment").sort(byElCost);
  const counterCards     = TCG_CARD_LIST.filter(c => getCardType(c) === "counter").sort(byElCost);
  return (
    <div className="tcg-rules">
      <div className="tcg-panel">
        <h2 className="tcg-panel-title">⚔ Come si gioca</h2>
        <ul className="tcg-rules-list">
          <li>Ogni giocatore parte con <strong>{STARTING_HP} PF</strong>, una mano di 4 carte e un mazzo di {DECK_REQUIRED_SIZE}.</li>
          <li>Il mana è <strong>per elemento</strong>: per pagare le carte servono i colori giusti. Lo ottieni giocando <strong>💎 Cristalli</strong> — uno per turno — che producono +1 di mana del loro elemento ogni turno (stile "lands" di MTG). Le carte hanno un costo con pip colorate (es. <code>🔥🔥⚪</code>): le pip elementali si pagano solo con quel colore, la pip ⚪ con qualsiasi colore.</li>
          <li>A ogni turno ricarichi automaticamente tutto il mana che i tuoi cristalli producono, e peschi 1 carta. Non c'è un cap fisso: cresci finché giochi cristalli.</li>
          <li>Le carte sono di quattro tipi: <strong>🐲 Creature</strong> (vanno in campo, attaccano e difendono), <strong>📜 Incantesimi</strong> (effetto singolo, poi finiscono al cimitero), <strong>🌟 Aure</strong> (concedono keyword temporanee o effetti persistenti) e <strong>🛡 Contromagie</strong> (trappole segrete che si attivano nel turno dell'avversario).</li>
          <li>Le creature evocate hanno <em>sonno d'evocazione</em> e non possono attaccare lo stesso turno — a meno che non abbiano <strong>Furia</strong> o vengano risvegliate dall'affinità <strong>Brezza</strong>.</li>
          <li>In combattimento, una creatura attacca una creatura nemica (o il campione) e ognuna infligge i propri danni; le meccaniche (Affondo, Avanguardia, Letale…) cambiano l'ordine e la regola.</li>
          <li><strong>🛡 Difesa del campione</strong>: puoi colpire il campione avversario solo se la sua difesa è sgombra. Le regole di blocco sono:
            <ul>
              <li>Un attaccante <strong>a terra</strong> è bloccato da qualsiasi creatura nemica a terra (i volatili non lo intercettano).</li>
              <li>Un attaccante con <strong>Volo</strong> sorvola le creature normali e arriva diritto al campione… <em>a meno che</em> sul campo nemico non ci sia almeno una creatura con <strong>🛡 Baluardo</strong>: in quel caso il volatile DEVE colpire il Baluardo prima di raggiungere il campione.</li>
              <li><strong>Cacciatore</strong> permette a un attaccante a terra di colpire i volatili nemici, ma non sblocca il campione.</li>
            </ul>
          </li>
          <li>Vince chi porta a 0 i PF dell'avversario. Se finisci il mazzo, subisci 2 danni da affaticamento ad ogni pesca.</li>
        </ul>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">🜂 Affinità degli elementi (passive)</h2>
        <p className="tcg-panel-sub">
          Ogni volta che giochi una carta del suo elemento, scatta automaticamente l'affinità corrispondente — sia per le creature sia per gli incantesimi.
          Sono il vero "colore" del tuo mazzo: identità giocate.
        </p>
        <div className="tcg-aff-grid">
          {["fire","water","earth","air","light","dark"].map(el => {
            const a = TCG_AFFINITIES[el];
            return (
              <div key={el} className={`tcg-aff-card tcg-aff-card--${el}`}>
                <div className="tcg-aff-card-head">
                  <span className="tcg-aff-card-icon">{a.icon}</span>
                  <span>{a.name}</span>
                </div>
                <div className="tcg-aff-card-elem">{ELEMENT_ICON[el]} {ELEMENT_LABEL[el]}</div>
                <div className="tcg-aff-card-rules">{a.rules}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">🌟 Cerchio degli elementi</h2>
        <ElementWheelLegend />
        <p className="tcg-panel-sub">
          Quando un attacco (o un incantesimo a bersaglio singolo) è super-efficace contro l'elemento bersaglio, infligge <strong>×1.5</strong> danni.
          Quando è poco efficace, <strong>×0.5</strong>. Luce e Tenebra si combattono solo tra loro (×1.5 reciproco)
          e sono neutre contro gli altri elementi.
        </p>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">🎯 Leggere la partita</h2>
        <p className="tcg-panel-sub">
          Tutti i segnali visivi che vedi durante una sfida. Una volta che li riconosci, capire chi vince ogni scambio diventa
          immediato.
        </p>
        <ul className="tcg-rules-list">
          <li>
            <strong>Stat sulla carta</strong> — il riquadro in basso a destra è diviso in due metà: a sinistra l'<span style={{ background:"#dc2626",color:"#fff",padding:"1px 7px",fontWeight:900 }}>ATK</span> in rosso, a destra i <span style={{ background:"#15803d",color:"#fff",padding:"1px 7px",fontWeight:900 }}>PF</span> in verde. Quando la creatura è ferita la metà PF diventa <span style={{ background:"#ea580c",color:"#fff",padding:"1px 7px",fontWeight:900 }}>arancione</span> con un piccolo pulse, e accanto compare il massimo (es. <code>4/8</code>).
          </li>
          <li>
            <strong>Numeri volanti</strong> — ogni colpo o cura fa salire un numero sopra la carta o sul campione: <span style={{ color:"#dc2626", fontWeight:900 }}>−5</span> in rosso quando si subiscono danni, <span style={{ color:"#15803d", fontWeight:900 }}>+3</span> in verde quando si recuperano PF. I numeri si susseguono uno alla volta, così ogni hit è leggibile.
          </li>
          <li>
            <strong>Preview di combattimento</strong> — quando selezioni un attaccante, sopra ogni bersaglio legale compare una pillola colorata con un'icona-verdetto e i danni in gioco:
            <ul style={{ marginTop: 6, listStyle: "none", paddingLeft: 0 }}>
              <li>💥 <strong>LO UCCIDI</strong> — verde: lo uccidi, tu sopravvivi</li>
              <li>💔 <strong>MUORI</strong> — rosso: muori in rappresaglia</li>
              <li>⚔ <strong>DOPPIA MORTE</strong> — ambra: muoiono entrambi</li>
              <li>🩸 <strong>COLPISCI</strong> — blu: nessuno muore, entrambi si feriscono</li>
              <li>👻 <strong>NON UCCIDE</strong> — viola: Rinato salva il bersaglio a 1 PF</li>
            </ul>
            Il primo numero nella pillola è il danno inflitto, il secondo (dopo <code>/</code>) la rappresaglia subita. Sul pulsante "Colpisci il campione" vedi anche i PF prima → dopo dell'avversario.
          </li>
          <li>
            <strong>Ingrandire una carta</strong> — durante la partita puoi sempre vedere descrizioni complete delle abilità tenendo premuto sulla carta, facendo clic destro, oppure cliccando l'icona <strong>🔍</strong> in alto a sinistra. Funziona sulle carte in mano e sulle creature di entrambi gli schieramenti.
          </li>
          <li>
            <strong>Indicatori sul campione</strong> — nella barra del nome:
            <span title="Bruciatura" style={{ marginLeft: 6, background:"#1f1f1f", color:"#fde047", border:"2px solid #dc2626", padding:"1px 6px", fontWeight:900, fontSize:"0.8rem", textTransform:"uppercase" }}>🔥 N</span>{" "}
            turni di Bruciatura residui;
            <span title="Argine" style={{ marginLeft: 6, background:"#1d4ed8", color:"#fff", border:"2px solid #1e3a8a", padding:"1px 6px", fontWeight:900, fontSize:"0.8rem", textTransform:"uppercase" }}>🛡 +N</span>{" "}
            PF di Argine ancora da assorbire;
            <span title="Trappole" style={{ marginLeft: 6, background:"#1f1f1f", color:"#fef9c3", border:"2px solid #b45309", padding:"1px 6px", fontWeight:900, fontSize:"0.8rem", textTransform:"uppercase" }}>🛡 N TRAPPOLE</span>{" "}
            Contromagie segrete in attesa (passa il cursore sopra la tua per leggerle).
          </li>
          <li>
            <strong>Cristalli di Mana</strong> in fondo alla barra di ogni giocatore — i pieni sono il mana disponibile, gli spenti il massimo. A ogni turno cresce di +1 fino a 10.
          </li>
          <li>
            <strong>Registro</strong> in basso a destra — riporta ogni azione con un'icona iniziale. Ogni linea di danno mostra anche la matematica fra parentesi quadre: <code>[3 × ×1.5]</code> = base ATK × moltiplicatore elementale.
          </li>
        </ul>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">⚡ Le meccaniche</h2>
        <p className="tcg-panel-sub">
          Le abilità stampate sulle creature. Le ultime due — <strong>Bruciatura X</strong> e <strong>Linfa X</strong> — hanno un valore variabile sulla singola carta.
        </p>
        <div className="tcg-mechs-grid">
          {MECHANICS_ORDER.map(k => {
            const m = TCG_MECHANICS[k];
            return (
              <div key={k} className={`tcg-mech-card tcg-mech-card--${k}`}>
                <div className="tcg-mech-card-head">
                  <span className="tcg-mech-card-icon" style={{ background: m.color }}>{m.icon}</span>
                  <span className="tcg-mech-card-name">{m.name}{m.hasValue ? " X" : ""}</span>
                </div>
                <div className="tcg-mech-card-rules">{m.rules}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">📜 Incantesimi</h2>
        <p className="tcg-panel-sub">
          Carte d'effetto a uso singolo. Alcune chiedono di scegliere un bersaglio (creatura o campione): clicca la carta in mano per
          entrare in modalità mira, poi clicca il bersaglio. Altre risolvono subito (cure, AoE, draw, resurrezioni). Anche gli
          incantesimi attivano l'affinità del loro elemento.
        </p>
        <div className="tcg-spell-list">
          {spellCards.map(c => (
            <div key={c.id} className="tcg-spell-list-row">
              <strong>{ELEMENT_ICON[c.element]} {c.name}</strong>
              {" "}<em>· {c.cost} ◆ · {RARITY_LABEL[c.rarity]}</em>
              <br />
              {describeEffect(c)}
            </div>
          ))}
        </div>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">🌟 Aure (incantamenti)</h2>
        <p className="tcg-panel-sub">
          Le Aure si differenziano dagli Incantesimi: invece di un effetto secco, concedono <strong>keyword temporanee</strong>{" "}
          (come Volo o Cacciatore per 2 turni) o <strong>effetti persistenti sul campione</strong> (come una rigenerazione costante).
          La carta finisce al cimitero, ma il beneficio resta sulla creatura o sul campione finché non scade o viene Dissolto.
        </p>
        <div className="tcg-spell-list">
          {enchantmentCards.map(c => (
            <div key={c.id} className="tcg-spell-list-row tcg-spell-list-row--enchant">
              <strong>{ELEMENT_ICON[c.element]} {c.name}</strong>
              {" "}<em>· {c.cost} ◆ · {RARITY_LABEL[c.rarity]}</em>
              <br />
              {describeEffect(c)}
            </div>
          ))}
        </div>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">🛡 Contromagie (trappole segrete)</h2>
        <p className="tcg-panel-sub">
          Le Contromagie funzionano come <strong>trappole segrete</strong>. Le prepari nel tuo turno (la carta finisce a faccia
          coperta nella tua zona segreta) e si attivano <strong>automaticamente</strong> quando il loro innesco si verifica
          durante il turno dell'avversario. Dopo l'attivazione vanno al cimitero. L'avversario vede solo quante trappole hai
          preparato, non quali. Puoi avere al massimo cinque trappole attive per lato.
        </p>
        <div className="tcg-spell-list">
          {counterCards.map(c => (
            <div key={c.id} className="tcg-spell-list-row tcg-spell-list-row--counter">
              <strong>{ELEMENT_ICON[c.element]} {c.name}</strong>
              {" "}<em>· {c.cost} ◆ · {RARITY_LABEL[c.rarity]}</em>
              <br />
              {describeEffect(c)}
            </div>
          ))}
        </div>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">🃏 Tipi di carta</h2>
        <ul className="tcg-rules-list">
          <li><strong>🐲 Creatura</strong> — entra in campo, ha ATK e PF, può attaccare a partire dal turno successivo (o subito con Furia). Resta finché non viene distrutta. Difende il campione dalla sua corsia (terra/cielo).</li>
          <li><strong>📜 Incantesimo</strong> — niente ATK/PF, risolve un effetto e finisce al cimitero. Costa solo mana. Se ha un bersaglio, te lo chiede prima di lanciarlo.</li>
          <li><strong>🌟 Aura</strong> — come un incantesimo, ma il suo effetto è una keyword temporanea su una creatura o un beneficio persistente sul campione. La carta va al cimitero, l'effetto rimane.</li>
          <li><strong>🛡 Contromagia</strong> — trappola segreta: la prepari sul tuo turno e si attiva automaticamente quando il suo innesco scatta nel turno dell'avversario (subisci Bruciatura, l'avversario lancia magia, il campione sta per essere colpito, o l'avversario evoca una creatura).</li>
        </ul>
        <p className="tcg-panel-sub" style={{ marginTop: 12 }}>
          <strong>💡 Suggerimento</strong> — tieni premuto su una carta (o clic destro, o tocca <strong>🔍</strong>) per vedere descrizioni complete delle abilità in qualsiasi momento, anche durante la partita.
        </p>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">🛒 Bottega e Collezione</h2>
        <ul className="tcg-rules-list">
          <li>Al primo accesso ricevi un <strong>Pacchetto Iniziale gratuito</strong> di {DECK_REQUIRED_SIZE} carte mono-elemento (scegli l'elemento). Include {Math.round(DECK_REQUIRED_SIZE * 0.28)} cristalli per il mana.</li>
          <li>I forzieri elementali standard costano <strong>80 ✦</strong>. I forzieri di <strong>Luce</strong> e <strong>Tenebra</strong> costano <strong>200 ✦</strong> ma offrono il 5% di Leggendari.</li>
          <li>Ogni forziere contiene 8 carte, miste tra creature e incantesimi del suo elemento. Lo slot premio rolla rarità casuali fino al Leggendario.</li>
          <li>Nel pannello <strong>Collezione</strong> costruisci e salvi un mazzo da {DECK_REQUIRED_SIZE} carte tra quelle possedute. Le carte indesiderate possono essere <strong>distrutte</strong> per recuperare ✦ (3/8/20/50 per rarità).</li>
          <li>
            <strong>✨ Carte Brillanti</strong> — ogni carta acquistata in Bottega ha una probabilità del <strong>{(FOIL_RATE * 100).toFixed(1)}%</strong> di essere "brillante",
            una versione olografica rarissima e meravigliosa. Stesse statistiche, ma molto più preziosa: la distruzione restituisce <strong>4× ✦</strong>.
          </li>
        </ul>
      </div>

      <div className="tcg-panel">
        <h2 className="tcg-panel-title">✦ Come ottenere Punti Bestiario</h2>
        <p className="tcg-panel-sub">
          I Punti Bestiario sono la valuta che spendi in Bottega per comprare forzieri.
          Si guadagnano vivendo l'app: ogni azione ne dà una piccola quantità, con un tetto
          giornaliero per ciascuna fonte. Niente grinding — basta giocare ogni giorno e i
          punti si accumulano in modo costante.
        </p>
        <table className="tcg-points-table">
          <thead>
            <tr>
              <th>Fonte</th>
              <th style={{ textAlign: "right" }}>Ricompensa</th>
              <th style={{ textAlign: "right" }}>Tetto / giorno</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(PET_POINT_SOURCES).map(([key, def]) => (
              <tr key={key}>
                <td>{def.label}</td>
                <td style={{ textAlign: "right" }}><strong>+{def.amount} ✦</strong></td>
                <td style={{ textAlign: "right" }}>{def.dailyCap != null ? `${def.dailyCap}×` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tcg-panel-sub" style={{ marginTop: 10 }}>
          <strong>💡 Consigli</strong>:
          il login giornaliero da solo vale {PET_POINT_SOURCES.daily_login?.amount || 2} ✦ ogni giorno,
          la lettura dei riassunti fino a {(PET_POINT_SOURCES.summary_read?.amount || 2) * (PET_POINT_SOURCES.summary_read?.dailyCap || 10)} ✦,
          e una buona corsa nell'Arena può facilmente fruttare 15-20 ✦ tra round vinti e tornei.
          In poche settimane di gioco normale ti basta per più forzieri elementali.
        </p>
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
                {r === "rare"      && "Specialisti affidabili. Una meccanica di rilievo o effetto magico utile."}
                {r === "epic"      && "Bestie di rispetto e magie potenti. Più meccaniche combinate, costo medio-alto."}
                {r === "legendary" && "Le creature da copertina. Stat alte, più meccaniche, esemplari rarissimi."}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
