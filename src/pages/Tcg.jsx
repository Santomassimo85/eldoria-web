/* ============================================================
   TCG — page orchestrator
   ------------------------------------------------------------
   Menu hub → Gioca (AI / Online) · Negozio · Mazzo ·
              Collezione · Manuale

   Per-user profile (coins / collection / deck) lives on
   characters/{uid}; the game screen is ALWAYS landscape.
   ============================================================ */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../AuthContext";
import { isTcgUnlockedFor } from "../tcg/access.js";
import { createGame } from "../tcg/engine.js";
import { buildClassDeck } from "../tcg/cards.js";
import { watchMatch, sideForUid } from "../tcg/net.js";
import {
  watchProfile, grantStarter, needsStarter, openPack, saveDeck,
  awardCoins, playableDeck, resetAllTcg, setCover, TCG_COINS,
} from "../tcg/collection.js";
import { primeSfx } from "../utils/tcgSfx.js";
import ModeSelect from "../components/tcg/ModeSelect.jsx";
import StarterSelect from "../components/tcg/StarterSelect.jsx";
import Lobby from "../components/tcg/Lobby.jsx";
import GameTable from "../components/tcg/GameTable.jsx";
import Shop from "../components/tcg/Shop.jsx";
import DeckBuilder from "../components/tcg/DeckBuilder.jsx";
import Collection from "../components/tcg/Collection.jsx";
import Manual from "../components/tcg/Manual.jsx";
import ClassPicker from "../components/tcg/ClassPicker.jsx";
import MulliganOverlay from "../components/tcg/MulliganOverlay.jsx";
import Tournament from "../components/tcg/Tournament.jsx";
import { CLASS_VIE, CLASSES, classColors } from "../tcg/classes.js";
import {
  watchTournament, reportMatchResult, isTournamentVisibleFor,
} from "../tcg/tournament.js";
import "./Tcg.css";

const MAX_MULLIGANS = 2;

const MASTER_EMAIL = "santomassimo85@gmail.com";

/* keeps a render crash inside the game from blanking the whole page —
   shows the error (so it can be reported) + a way back to the menu */
class GameBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    console.error("[TCG] render error:", err, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div className="tcg-locked">
          <h1>⚠️ Errore nella partita</h1>
          <p>Qualcosa è andato storto durante il caricamento del duello.</p>
          <pre
            style={{
              maxWidth: "90vw", overflow: "auto", fontSize: 12,
              opacity: 0.7, whiteSpace: "pre-wrap",
            }}
          >
            {String(this.state.err && this.state.err.message)}
          </pre>
          <button
            className="tcg-btn tcg-btn--primary"
            onClick={() => {
              this.setState({ err: null });
              this.props.onExit && this.props.onExit();
            }}
          >
            ‹ Torna al menu
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// True when the physical device is held in portrait on a phone-sized
// screen. We don't ask the user to rotate — instead the whole board is
// rotated 90° via CSS so the game is ALWAYS played in landscape.
function useIsPortrait() {
  const get = () =>
    typeof window !== "undefined" &&
    window.innerHeight > window.innerWidth &&
    window.innerWidth < 820;
  const [portrait, setPortrait] = useState(get);
  useEffect(() => {
    const on = () => setPortrait(get());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return portrait;
}

export default function Tcg() {
  const { currentUser } = useAuth();
  const isPortrait = useIsPortrait();

  const [pName, setPName] = useState(currentUser?.displayName || "Sfidante");
  const [profile, setProfile] = useState(null);

  // resolve a display name + load the per-user profile
  useEffect(() => {
    if (!currentUser?.uid) {
      setProfile(null);
      return;
    }
    let alive = true;
    const unsub = watchProfile(currentUser.uid, (p) => {
      if (alive) setProfile(p);
    });
    setPName(
      currentUser.displayName ||
        (currentUser.email ? currentUser.email.split("@")[0] : "Sfidante")
    );
    return () => {
      alive = false;
      unsub();
    };
  }, [currentUser]);

  const [screen, setScreen] = useState("menu");
  const [aiSeed, setAiSeed] = useState(0);
  // class + via the player picked for the upcoming / current AI match
  const [aiClass, setAiClass] = useState(null);
  // class + via the AI plays (randomised when the match starts)
  const [aiFoeClass, setAiFoeClass] = useState(null);
  // pre-match mulligan: player sees opening hand and may reshuffle up
  // to MAX_MULLIGANS times before committing (AI mode only)
  const [mulligansLeft, setMulligansLeft] = useState(MAX_MULLIGANS);
  const [mulliganDone, setMulliganDone] = useState(false);

  const [matchId, setMatchId] = useState(null);
  const [match, setMatch] = useState(null);
  const unsubRef = useRef(null);

  // global tournament state (live) — used to hide / show the menu tile
  // and to report match results from the pvp screen.
  const [tournament, setTournament] = useState(null);
  useEffect(() => watchTournament(setTournament), []);

  const stopWatch = () => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  };
  useEffect(() => () => stopWatch(), []);

  const aiState = useMemo(() => {
    if (screen !== "ai") return null;
    if (!aiFoeClass) return null; // waiting on the picker (aiClass may be null = no class)
    // Player's saved deck is the source of truth — they may mix any
    // colours they bought (no class restriction on the deck). Only the
    // AI opponent gets an auto-built class deck so the match is themed.
    const foeColors = classColors(aiFoeClass.klass);
    return createGame({
      p0Name: pName,
      p1Name: "Arconte (IA)",
      deck0: playableDeck(profile),
      deck1: buildClassDeck(foeColors, aiFoeClass.klass),
      p0Class: aiClass,           // può essere null: gioca senza bonus
      p1Class: aiFoeClass,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, aiSeed, aiClass, aiFoeClass]);

  const goMenu = () => {
    stopWatch();
    setMatch(null);
    setMatchId(null);
    setAiClass(null);
    setAiFoeClass(null);
    setMulligansLeft(MAX_MULLIGANS);
    setMulliganDone(false);
    setScreen("menu");
  };

  /* Reshuffle the AI opening hand: bumping aiSeed rebuilds aiState via
     the useMemo above (re-shuffles deck0/deck1 → re-draws 6 cards). */
  const reshuffleAi = () => {
    setMulligansLeft((n) => Math.max(0, n - 1));
    setAiSeed((n) => n + 1);
  };
  const keepHand = () => setMulliganDone(true);

  /* pick a random class+via for the AI opponent — different from the
     player's class so the match isn't a mirror. If the player went
     classless, the AI rolls any of the 5 base classes. */
  const rollAiFoe = (mineKlass) => {
    const others = CLASSES.filter((k) => k !== mineKlass);
    const k = others[Math.floor(Math.random() * others.length)];
    const vie = Object.keys(CLASS_VIE[k]);
    const v = vie[Math.floor(Math.random() * vie.length)];
    return { klass: k, via: v };
  };

  const confirmAiClass = (pick) => {
    primeSfx();
    // `pick` may be null when the player opts out (no class → no bonus)
    setAiClass(pick);
    setAiFoeClass(rollAiFoe(pick?.klass));
    // reset mulligan state at the start of every fresh AI match
    setMulligansLeft(MAX_MULLIGANS);
    setMulliganDone(false);
    setScreen("ai");
  };

  const awardFor = (mode, result) => {
    if (!currentUser?.uid) return;
    const table = TCG_COINS[mode] || TCG_COINS.ai;
    awardCoins(currentUser.uid, table[result] ?? 0).catch(() => {});
  };

  /* Quando finisce una partita PvP che appartiene al torneo, scrivi
     il vincitore nel bracket. Idempotente. */
  const pvpEndHook = (result) => {
    awardFor("pvp", result);
    if (!match || !match.tournament) return;
    if (result === "draw") return; // engine non emette draw, ma per sicurezza
    const meSide = sideForUid(match, currentUser?.uid);
    const winnerSide = result === "win" ? meSide : (meSide === "p0" ? "p1" : "p0");
    const winnerUid = winnerSide === "p0"
      ? match.challenger?.uid
      : match.challenged?.uid;
    if (matchId && winnerUid) {
      reportMatchResult(matchId, winnerUid).catch(() => {});
    }
  };

  const pickAi = () => { primeSfx(); setScreen("ai-pick"); };
  const pickPvp = () => { primeSfx(); setScreen("lobby"); };

  const enterMatch = (id) => {
    if (matchId === id) return;
    stopWatch();
    setMatchId(id);
    setScreen("pvp");
    unsubRef.current = watchMatch(id, (m) => {
      if (!m) {
        setMatch(null);
        setScreen("lobby");
        stopWatch();
        setMatchId(null);
        return;
      }
      setMatch(m);
    });
  };

  if (!isTcgUnlockedFor(currentUser?.email)) {
    return (
      <div className="tcg-page">
        <div className="tcg-locked">
          <h1>🎴 TCG</h1>
          <p>Questa sezione non è ancora disponibile per il tuo account.</p>
        </div>
      </div>
    );
  }

  const mySide = match ? sideForUid(match, currentUser?.uid) : null;
  const loggedIn = !!currentUser;
  const isMaster = currentUser?.email === MASTER_EMAIL;

  // wait for the persisted profile before deciding anything (no flash
  // of the starter screen on reload → never a "false reset")
  if (loggedIn && !profile) {
    return (
      <div className="tcg-page">
        <div className="tcg-table--loading">
          <div className="tcg-waiting__spinner" />
          <p>Caricamento profilo…</p>
        </div>
      </div>
    );
  }

  // one-time starter choice — only when truly never claimed
  if (loggedIn && needsStarter(profile)) {
    return (
      <div className="tcg-page">
        <StarterSelect
          onPick={(klass) => grantStarter(currentUser.uid, klass)}
        />
      </div>
    );
  }

  // FORCE landscape ONLY during an actual battle (vs AI or PvP). Every
  // other screen (menu, deck, collection, shop, manual, lobby) stays in
  // normal vertical orientation.
  // the actual battle goes full-bleed (covers the app menu); every
  // other screen keeps the global navbar visible on top.
  const inFight = screen === "ai" || screen === "pvp";
  const forceLandscape = isPortrait && inFight;

  return (
    <div
      className={`tcg-page${inFight ? " tcg-page--fight" : ""}${
        forceLandscape ? " tcg-page--force-landscape" : ""
      }`}
    >

      {screen === "menu" && (
        <ModeSelect
          loggedIn={loggedIn}
          isMaster={isMaster}
          coins={profile?.coins ?? 0}
          onPickAi={pickAi}
          onPickPvp={pickPvp}
          onShop={() => loggedIn && setScreen("shop")}
          onDeck={() => loggedIn && setScreen("deck")}
          onCollection={() => loggedIn && setScreen("collection")}
          onManual={() => setScreen("manual")}
          onTournament={() => {
            primeSfx();
            setScreen("tournament");
          }}
          tournamentVisible={isTournamentVisibleFor(tournament, isMaster)}
          tournamentStatus={tournament?.status || "closed"}
          onMasterReset={() => resetAllTcg()}
        />
      )}

      {screen === "tournament" && (
        <Tournament
          user={currentUser}
          name={pName}
          deck={playableDeck(profile)}
          cover={profile?.cover || "nature"}
          isMaster={isMaster}
          onBack={goMenu}
          onEnterMatch={(id) => enterMatch(id)}
        />
      )}

      {screen === "manual" && <Manual onBack={goMenu} />}

      {screen === "shop" && loggedIn && (
        <Shop
          profile={profile}
          onBack={goMenu}
          onOpenPack={(packId) => openPack(currentUser.uid, packId)}
        />
      )}

      {screen === "deck" && loggedIn && (
        <DeckBuilder
          profile={profile}
          onBack={goMenu}
          onSave={(deck) =>
            saveDeck(currentUser.uid, deck, profile?.collection || {})
          }
          onSetCover={(cover) => setCover(currentUser.uid, cover)}
        />
      )}

      {screen === "collection" && loggedIn && (
        <Collection profile={profile} onBack={goMenu} />
      )}

      {screen === "ai-pick" && (
        <ClassPicker
          onConfirm={confirmAiClass}
          onBack={goMenu}
          deck={playableDeck(profile)}
        />
      )}

      {screen === "ai" && aiState && !mulliganDone && (
        <MulliganOverlay
          hand={aiState.players.p0.hand}
          mulligansLeft={mulligansLeft}
          onReshuffle={reshuffleAi}
          onKeep={keepHand}
        />
      )}

      {screen === "ai" && aiState && mulliganDone && (
        <GameBoundary onExit={goMenu}>
          <GameTable
            key={`ai-${aiSeed}`}
            mode="ai"
            initialState={aiState}
            myCover={profile?.cover || "nature"}
            foeCover="darkness"
            onExit={goMenu}
            onRematch={() => {
              setMulligansLeft(MAX_MULLIGANS);
              setMulliganDone(false);
              setAiSeed((n) => n + 1);
            }}
            onGameEnd={(r) => awardFor("ai", r)}
          />
        </GameBoundary>
      )}

      {screen === "lobby" && loggedIn && (
        <Lobby
          user={currentUser}
          name={pName}
          deck={playableDeck(profile)}
          cover={profile?.cover || "nature"}
          onEnterMatch={enterMatch}
          onBack={goMenu}
        />
      )}

      {screen === "lobby" && !loggedIn && (
        <div className="tcg-locked">
          <h1>Accesso richiesto</h1>
          <p>Devi effettuare l'accesso per giocare online.</p>
          <button className="tcg-btn" onClick={goMenu}>‹ Indietro</button>
        </div>
      )}

      {screen === "pvp" && match && mySide && (
        <GameBoundary onExit={goMenu}>
          <GameTable
            mode="pvp"
            match={match}
            matchId={matchId}
            mySide={mySide}
            onExit={goMenu}
            onGameEnd={pvpEndHook}
          />
        </GameBoundary>
      )}

      {screen === "pvp" && (!match || !mySide) && (
        <div className="tcg-table tcg-table--loading">
          <div className="tcg-waiting__spinner" />
          <p>Connessione alla partita…</p>
        </div>
      )}
    </div>
  );
}
