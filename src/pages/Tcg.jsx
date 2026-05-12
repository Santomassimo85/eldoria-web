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
  initMatchState, playCard, attackWith, endTurn, forfeit,
  canPlayCard, canAttack, legalAttackTargets, legalSpellTargets, predictCombat, oppSide,
  STARTING_HP, DECK_REQUIRED_SIZE,
  isValidDeck, ownsDeck, deckCount, autoBuildDeckFromCollection, buildFilteredDeck,
  resolveDeckForMatch,
} from "../utils/tcg";
import { playSfx, setSfxMuted, isSfxMuted, primeSfx } from "../utils/tcgSfx";
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
                <span className="tcg-detail-stat-val">{c.cost}</span>
                <span className="tcg-detail-stat-label">Mana</span>
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
      alert("Servono almeno 20 carte nella collezione per generare un mazzo.");
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
        alert("Servono almeno 20 carte nella collezione per generare un mazzo.");
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
              per un mazzo "puro" (richiede 20 carte che corrispondano).
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
  if (!onInspect) {
    return { start: undefined, cancel: undefined, guardClick: (h) => h, onContext: undefined };
  }
  const start = (e) => {
    // Ignore middle/right clicks here — right-click is handled by onContextMenu
    if (e.type === "mousedown" && e.button !== 0) return;
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onInspect();
    }, ms);
  };
  const cancel = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
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
  return { start, cancel, guardClick, onContext };
}

/* ============================================================
   CARD — full MTG-style card visual
   ============================================================ */
function Card({ card, size = "md", onClick, disabled, selected, className = "", showTooltip = true, foil = false, onInspect }) {
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
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
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
      onClick={lp.guardClick(onClick)}
      onMouseDown={lp.start}
      onMouseUp={lp.cancel}
      onMouseLeave={lp.cancel}
      onTouchStart={lp.start}
      onTouchEnd={lp.cancel}
      onTouchCancel={lp.cancel}
      onContextMenu={lp.onContext}
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
function BoardCard({ bc, def, size = "sm", onClick, disabled, selected, status, attackAnim, onInspect, floats = [] }) {
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
  const Tag = onClick ? "button" : "div";
  // attackAnim shape: { role: "attacker-up" | "attacker-down" | "target", ts: number }
  const animCls = attackAnim
    ? ` tcg-board-card--anim-${attackAnim.role}`
    : "";
  return (
    <Tag
      type={onClick ? "button" : undefined}
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
      onClick={lp.guardClick(onClick)}
      onMouseDown={lp.start}
      onMouseUp={lp.cancel}
      onMouseLeave={lp.cancel}
      onTouchStart={lp.start}
      onTouchEnd={lp.cancel}
      onTouchCancel={lp.cancel}
      onContextMenu={lp.onContext}
      disabled={disabled}
      title={tip}
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
        <span className="tcg-card-cost">{def.cost}</span>
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
      {status === "sick" && <div className="tcg-board-tag">😴 sonnolento</div>}
      {status === "tapped" && <div className="tcg-board-tag">✓ usato</div>}
      {bc.revived && <div className="tcg-board-tag tcg-board-tag--revived">👻 rinato</div>}
    </Tag>
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
  const [compliment, setCompliment] = useState("");
  const [attackSplash, setAttackSplash] = useState(null); // { attacker, defender, side, kind, key }
  const [attackAnim, setAttackAnim] = useState(null);     // { attackerId, targetId, side, ts }
  const [floats, setFloats] = useState([]);               // [{ id, kind, target, side, instId?, amount }]
  const [muted, setMuted] = useState(isSfxMuted());
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
    if (!next) primeSfx();
  };

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

  /* Fire win/lose chime once when the game ends. */
  useEffect(() => {
    if (!state.winner || wonRef.current) return;
    wonRef.current = true;
    playSfx(state.winner === mySide ? "win" : "lose");
  }, [state.winner, mySide]);

  useEffect(() => {
    if (!attackSplash) return;
    const t = setTimeout(() => setAttackSplash(null), 1100);
    return () => clearTimeout(t);
  }, [attackSplash]);

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

  const handlePlayCard = async (instId) => {
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
    <div className="tcg-match">
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
      <header className="tcg-match-head">
        <button className="tcg-btn tcg-btn--ghost tcg-btn--tiny" onClick={onExit}>← Lobby</button>
        <div className="tcg-match-round">
          Turno {state.round} · {myTurn ? "🟢 Tocca a te" : "⏳ Avversario"}
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
          burn={state.burn?.[oSide] || 0}
          secretCount={state.secrets?.[oSide]?.length || 0}
          shield={state.dmgShield?.[oSide] || 0}
          floats={floats.filter(f => f.target === "champion" && f.side === oSide)}
        />
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
              <div key={bc.instId} className="tcg-board-slot">
                <BoardCard
                  bc={bc}
                  def={def}
                  onClick={onClick}
                  disabled={!isLegal}
                  selected={isLegal}
                  status={bc.tapped ? "tapped" : null}
                  attackAnim={getCardAnim(bc.instId)}
                  onInspect={() => setViewingCard({ cardId: bc.cardId })}
                  floats={floats.filter(f => f.target === "creature" && f.instId === bc.instId)}
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
        <div className="tcg-board tcg-board--mine">
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
                onInspect={() => setViewingCard({ cardId: bc.cardId })}
                floats={floats.filter(f => f.target === "creature" && f.instId === bc.instId)}
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
          burn={state.burn?.[mySide] || 0}
          secretCount={state.secrets?.[mySide]?.length || 0}
          shield={state.dmgShield?.[mySide] || 0}
          ownSecrets={state.secrets?.[mySide] || []}
          floats={floats.filter(f => f.target === "champion" && f.side === mySide)}
        />
      </div>

      {/* Hand */}
      <div className="tcg-hand-wrap">
        <div className="tcg-hand-label">
          🎴 La tua mano · {myHand.length} carte
          {pendingSpell && (
            <span className="tcg-hand-label-spell">
              {" "}· 📜 Castando <strong>{pendingSpell.def.name}</strong>
            </span>
          )}
        </div>
        <div className="tcg-hand">
          {myHand.length === 0 ? (
            <div className="tcg-board-empty">Mano vuota</div>
          ) : myHand.map(c => {
            const def = TCG_CARDS[c.cardId];
            const playable = canPlayCard(state, mySide, c.instId);
            const isPending = pendingSpell?.instId === c.instId;
            return (
              <Card
                key={c.instId}
                card={def}
                size="md"
                onClick={() => handlePlayCard(c.instId)}
                disabled={!playable && !isPending}
                selected={isPending}
                className={isPending ? "tcg-card--pending-spell" : ""}
                onInspect={() => setViewingCard({ cardId: c.cardId })}
              />
            );
          })}
        </div>
      </div>

      {/* Action bar + log */}
      <div className="tcg-action-bar">
        <div className="tcg-action-bar-buttons">
          <button
            type="button"
            className="tcg-btn tcg-btn--end"
            onClick={handleEndTurn}
            disabled={!myTurn}
          >
            ⏭ Fine turno
          </button>
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
        <div className="tcg-log" ref={logRef}>
          {(state.log || []).slice(-7).map((line, i) => (
            <LogLine key={i} line={line} mySide={mySide} />
          ))}
        </div>
      </div>

      {viewingCard && (
        <CardDetailModal
          cardId={viewingCard.cardId}
          onClose={() => setViewingCard(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
   PLAYER STRIP — HP, mana, deck, hand counts
   ============================================================ */
function PlayerStrip({ side, name, hp, mana, maxMana, deckCount, handCount, opponent, isActive, burn = 0, secretCount = 0, shield = 0, ownSecrets = null, floats = [] }) {
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
        <ManaCrystals current={mana} max={maxMana} active={isActive} />
        <div className="tcg-pstrip-pile" title="Carte nel mazzo">📚 {deckCount}</div>
        <div className="tcg-pstrip-pile" title="Carte in mano">🃏 {handCount}</div>
      </div>
    </div>
  );
}

/* Hearthstone-style mana crystal row. Each crystal is a diamond:
   full → glowing cyan gem with pulse; empty → dim slot. We always
   render at least one slot so the rail is visible from turn 0. */
function ManaCrystals({ current, max, active }) {
  const slots = Math.max(1, max);
  return (
    <div
      className={`tcg-mana ${active ? "tcg-mana--active" : ""}`}
      title={`Mana ${current} / ${max}`}
    >
      <div className="tcg-mana-num">
        <span className="tcg-mana-num-icon">🔮</span>
        <span className="tcg-mana-num-cur">{current}</span>
        <span className="tcg-mana-num-sep">/</span>
        <span className="tcg-mana-num-max">{max}</span>
      </div>
      <div className="tcg-mana-rail">
        {Array.from({ length: slots }, (_, i) => (
          <span
            key={i}
            className={
              "tcg-mana-crystal " +
              (i < current ? "tcg-mana-crystal--full" : "tcg-mana-crystal--empty")
            }
            aria-hidden="true"
          />
        ))}
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
          <li>A ogni turno il giocatore attivo guadagna <strong>+1 di Mana massimo</strong> (fino a 10) e ricarica tutto il mana, poi pesca 1 carta.</li>
          <li>Le carte sono di quattro tipi: <strong>🐲 Creature</strong> (vanno in campo, attaccano e difendono), <strong>📜 Incantesimi</strong> (effetto singolo, poi finiscono al cimitero), <strong>🌟 Aure</strong> (concedono keyword temporanee o effetti persistenti) e <strong>🛡 Contromagie</strong> (trappole segrete che si attivano nel turno dell'avversario).</li>
          <li>Le creature evocate hanno <em>sonno d'evocazione</em> e non possono attaccare lo stesso turno — a meno che non abbiano <strong>Furia</strong> o vengano risvegliate dall'affinità <strong>Brezza</strong>.</li>
          <li>In combattimento, una creatura attacca una creatura nemica (o il campione) e ognuna infligge i propri danni; le meccaniche (Affondo, Avanguardia, Letale…) cambiano l'ordine e la regola.</li>
          <li><strong>🛡 Difesa del campione</strong>: puoi colpire il campione avversario solo se la sua difesa è sgombra. Una creatura a terra blocca tutte le altre creature a terra; una creatura con <strong>Volo</strong> blocca solo altri volatili. <strong>Volo</strong> sorvola i difensori a terra; <strong>Cacciatore</strong> permette invece di colpire i volatili dal suolo, ma non garantisce il sorvolo della difesa.</li>
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
          <li>Al primo accesso ricevi un <strong>Pacchetto Iniziale gratuito</strong> di 20 carte (scegli l'elemento).</li>
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
