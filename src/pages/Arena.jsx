import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { db } from "../firebase";
import { doc, getDoc, getDocs, onSnapshot, updateDoc, deleteDoc, arrayUnion, arrayRemove, addDoc, collection, serverTimestamp, runTransaction, increment, query, where, writeBatch } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { showD20Roll, DICE_SKINS, setDiceSkin, preloadDice3D } from "../components/DiceRoll";
import DieIcon from "../components/DieIcon";
import TimerDisplay from "../components/TimerDisplay";
import { VfxLayer } from "./WorldBossVfx";   // effetti pixel del World Boss (forma + elemento), condivisi con l'Arena
import { awardPetPoints } from "../utils/pet";
import { getSubclassDef, subclassToMount } from "../data/arenaSubclasses";
import ArenaSubclassOffer from "../components/ArenaSubclassOffer";
import { currentWeekKey, ARENA_TOURNAMENT_BONUS } from "../data/arenaWeek";
import { serverClockOffset } from "../data/serverClock";
import { auditArenaMatch } from "../utils/arenaIntegrity";
import { saveChronicle, chronicleId } from "../utils/arenaChronicle";
import ArenaChronicles, { HpTrace } from "./ArenaChronicles";
import { DAMAGE_TYPE_MAP, MALUS_TYPE_MAP } from "../data/arenaDamageTypes";
import "./Arena.css";
import "./ArenaHero.css";
import "./ArenaBill.css";
import "./ArenaNessoViste.css";   // viste interne (join/loadout/libera/bracket/albo/regole/master) nel Nesso
import "./ArenaPalcoFight.css";   // scontro INLINE nel palco dell'hub + palette Nesso del combat
import "./ArenaCovo.css";         // "R · Il Covo del Drago": stessa struttura, pelle del covo
import "./ArenaLizza.css";        // "Entra in Lizza" leggibile: passi, classi con icona, righe compatte, mobile
import "./ArenaLanista.css";      // Registro del Lanista (vista master) leggibile: iscritti in cima, due leve, pieghe, mobile (per ULTIMO)
import "./ArenaScontro.css";       // scontro leggibile: cronaca a paragrafi, su PC sotto il campo (per ULTIMO)
import { ArenaModal } from "./arena/ArenaModal";
import { ArenaGestaView, CLASS_ICONS, CLASS_IT, FunArenaClassStats, HallOfChampions, TournamentClassStats, classColor } from "./arena/ArenaStats";
import { BET_MATCH_AMOUNTS, BET_MATCH_MULT, BET_TOURNAMENT_AMOUNTS, BET_TOURNAMENT_MULT, BettingPanel } from "./arena/BettingPanel";
import { MasterTitleEditor } from "./arena/MasterEditors";
import { AI_BOT_PREFIX, makeAiSnapshotAndPlayer } from "./arena/arenaAi";
import { ARTIFICER_CONSTRUCTS, RANGER_PETS, WARLOCK_DEMONS } from "./arena/arenaClassActions";
import { ARENA_ARCHETYPE_BY_CLASS, ARENA_EXPIRY_GRACE_MS, ARENA_INITIATIVE_DURATION, ARENA_SHOP_DURATION, ARENA_TURN_DURATION, FUN_MATCH_PRUNE_GRACE_MS, MASTER_ALT_MAX, MASTER_RESERVE_SLOTS, SAVED_ARENA_SLOTS, arenaNow, isAwaitingReady, isMasterAltId, masterEntryIds, matchSig, reloadoutBlockReason, setArenaClockOffset, withReadyCheck } from "./arena/arenaCore";
import { ARENA_ARMORS, ARENA_KITE_MAX, GOOD_STATUS_CLS, IS_TWO_HANDED_MELEE, PLAYER_HAS_RANGED_WEAPON, WEAPON_IS_RANGED, WILD_SHAPES, getDisplayAc, resolveMonkUnarmed, resolveWeaponRider, targetAcNow } from "./arena/arenaGear";
import { ARENA_ITEMS, applySlotLoss, describeMarketPurchase, formatPrizeConfig, prizeTierToStr, resolveMarketGear, scrollSlotLossFor, trimSpellsToLimits } from "./arena/arenaMarketGear";
import { finalizeArenaMatch, processWsKnockouts } from "./arena/arenaMatchFlow";
import { ARENA_KEY_STATS, ARENA_TITLES, FIGHT_RESULT_DELAY_MS, SAVE_LABEL, SORC_SLOTS_MAX, STAT_DESCS, actionElement, applyDefenderDamageMods, applyMarketEffects, applyTypedDamage, beastRageDamageBonus, clearDebuffs, clericBlessedDice, consumeInvisibility, countDebuffs, defenderRetaliate, defenderSaveMod, disadvTag, displayLog, divineStrikeBonus, dotResistMult, effectsHaveEnemyTarget, elementalOnHitStatus, frenzyExhausted, getAidBonusForClass, getAsiPoints, getCharTitles, getClassKey, getFighterStatuses, getHpDice, getLoadoutConfig, getMagicDetectBonusForClass, getMaxActionsPerTurn, getProficiencyBonus, getSnapLevel, getSnapTitles, getSpellAttackBonus, getSpellCast, getSpellMod, getSpellSaveDC, getSpellcastingAbility, getSubclassEffect, getTitleHitBonus, heavyElemAttackAdv, infusionWeaponBonus, isArtificerClass, isBarbarianClass, isBardClass, isFighterClass, isHeavyArmor, isMonkClass, isNoArmor, isPaladinClass, isRangerClass, isRogueClass, isSaveDamageSpell, isSorcererClass, isStormSpell, isWarlockClass, isWizardClass, kiStrikesBypass, logPubText, migrateArenaSnapshots, migrateMatchRageUses, ownedSubclassKey, parseSpellSaveAbility, physicalFallbackType, rageDamageBonus, readActiveBonus, readAidDmgBonus, readSaveFaithBonus, readSpellSlots, readSpellUsesLeft, readStealthAdvTurns, readStealthAnyTurns, readStealthDisadvTurns, recklessRaging, renderLogWithDice, rollDmg, savedCharMissing, scaleActionForLevel, selectableSubclasses, sneakAttackDice, spellMechanicTag, spellResistMult, spendSpellUse, subclassCritThreshold, subclassDamageDice, subclassFirstStrike, subclassForesightDisadv, subclassRangedHit, tickEagleEnd, usesSharedSpellSlots } from "./arena/arenaRules";
import { ARENA_FX_OFFENSIVE, classifyArenaVfx, normalizeArenaFx, withArenaFx } from "./arena/arenaVfx";
export { WIZARD_SPELLS, SORCERER_SPELLS, WARLOCK_SPELLS, DRUID_SPELLS, CLERIC_SPELLS, BARD_SPELLS, PALADIN_SPELLS, RANGER_SPELLS } from "./arena/arenaSpells";
export { ARTIFICER_SPELLS } from "./arena/arenaClassActions";

export default function Arena() {
  const { currentUser: authUser } = useAuth();
  // Il Master può avere più PG nel torneo: `actAs` = quale sta giocando adesso.
  // Tutto il combattimento ragiona su currentUser.uid, quindi qui lo si "veste"
  // col PG scelto; le schede (characters/…) usano sempre authUser.uid.
  const [actAs, setActAs] = useState(null);
  const canActAs = authUser?.email === "santomassimo85@gmail.com";
  const currentUser = useMemo(
    () => (authUser && canActAs && actAs && actAs !== authUser.uid ? { ...authUser, uid: actAs } : authUser),
    [authUser, canActAs, actAs],
  );
  const [arenaMeta, setArenaMeta]             = useState(null);
  const [prizeText, setPrizeText]             = useState("");
  // Premi strutturati: Corone (mercato nero = platinum), Monete Arena, e
  // vantaggi sessioni live (testo, NON distribuito in automatico). Tre fasce.
  const [prizeConfig, setPrizeConfig]         = useState({
    first:       { crowns: "", coins: "", perks: "" },
    second:      { crowns: "", coins: "", perks: "" },
    participant: { crowns: "", coins: "", perks: "" },
  });
  const [selectedTargets, setSelectedTargets] = useState({});
  const [tournamentHistoryRaw, setTournamentHistory] = useState([]);
  // Nomi ATTUALI dei personaggi (uid → nome). Lo storico salva il nome che il PG
  // aveva il giorno del torneo: chi poi ha cambiato nome (es. "Recluta" → Caius)
  // restava col nome vecchio in classifica e albo. Si legge una volta sola.
  const [liveNames, setLiveNames] = useState({});
  const [profileLookup, setProfileLookup]     = useState({});

  // Loadout — "idle" | "class-select" | "stat-assign" | "rolling" | "selecting"
  const [loadoutPhase, setLoadoutPhase]     = useState("idle");
  const [charPreview, setCharPreview]       = useState(null);
  // Personaggi d'Arena salvati dal giocatore (4 slot): build completo pronto da
  // ripescare all'iscrizione al torneo. Caricati dalla scheda in openLoadoutPicker.
  const [savedArenaChars, setSavedArenaChars] = useState(() => Array(SAVED_ARENA_SLOTS).fill(null));
  // Ultimo assetto confermato (iscrizione, cambio d'assetto, sfida): resta sulla
  // scheda anche dopo il reset settimanale, pronto da riusare con un tocco.
  const [lastArenaLoadout, setLastArenaLoadout] = useState(null);
  // PG salvato SELEZIONATO (uno solo): `characters.arenaSavedActive` = indice dello slot.
  // Si sceglie con un tocco sulla carta e si usa per torneo e Sfide Libere.
  const [activeSavedSlot, setActiveSavedSlot] = useState(null);
  // Slot riserva del Master attualmente in creazione (0..3) o null se non in modalità riserva.
  const [reserveSlotTarget, setReserveSlotTarget] = useState(null);
  const [pendingStats, setPendingStats]     = useState({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
  const [pendingWeapons, setPendingWeapons] = useState([]);
  const [pendingSpells, setPendingSpells]   = useState([]);
  const [pendingSkills, setPendingSkills]   = useState([]);
  const [pendingArmor, setPendingArmor]     = useState(null);
  const [pendingShield, setPendingShield]   = useState(null); // null | "legno" | "metallo"
  const [pendingPet, setPendingPet]         = useState(null); // ranger only — "wolf" | "spider" | "eagle" | "drago"
  const [pendingDemon, setPendingDemon]     = useState(null); // warlock only — "mephit" | "succubus" | "demon"
  const [pendingConstruct, setPendingConstruct] = useState(null); // artificer only — "golem" | "snake"
  const [showWildPicker, setShowWildPicker] = useState(false);
  const [showLayOfHandsPicker, setShowLayOfHandsPicker] = useState(false);
  const [layOfHandsAmt, setLayOfHandsAmt] = useState(1);
  const [showFontePicker, setShowFontePicker] = useState(false);
  const [, setFonteSelected] = useState([]);
  const [showRecuperoPicker, setShowRecuperoPicker] = useState(false);
  const [recuperoLv1Selected, setRecuperoLv1Selected] = useState([]);
  const [recuperoLv2Selected, setRecuperoLv2Selected] = useState([]);
  const [pendingItemCounts, setPendingItemCounts] = useState({ pozione_cura: 0, bomba: 0, pozione_veleno: 0 });
  // Titolo "indossato" scelto in autonomia all'iscrizione al torneo (uno solo). null = nessuno.
  const [pendingTitle, setPendingTitle] = useState(null);
  // Sottoclasse scelta nel loadout del torneo (null = classe base). Vale solo se
  // comprata in Bottega questa settimana per la classe in uso (ownedSubclassKey).
  const [pendingSubclass, setPendingSubclass] = useState(null);
  // Acquisti della Bottega settimanale che il giocatore SCEGLIE di equipaggiare
  // per questo torneo: { [itemId]: true }. Default vuoto = niente equipaggiato
  // (quel che compri resta a magazzino finché non decidi di indossarlo).
  const [pendingMarketSel, setPendingMarketSel] = useState({});
  const [loadoutTab, setLoadoutTab] = useState("weapons"); // tab attivo nella fase di equipaggiamento
  // ── REDESIGN: hub a riquadri + viste a fuoco (niente più lungo scroll) ──
  // "hub" = landing bento · poi una vista per sezione.
  const [arenaView, setArenaView] = useState("hub"); // hub | join | bracket | libera | albo | regole | master

  const [combatModalOpen, setCombatModalOpen] = useState(false);
  // Slot del PALCO (hub): quando è montato, lo scontro si apre QUI, sotto le
  // carte VS, invece che in una modale a tutto schermo.
  const [palcoSlot, setPalcoSlot] = useState(null);
  // ── COMBAT REDESIGN: arena immersiva — dock azioni a schede + cronaca a cassetto ──
  const [combatDock, setCombatDock] = useState("attacchi"); // attacchi | magie | abilita | oggetti
  const [abilitaSub, setAbilitaSub] = useState("skill"); // sotto-tab dentro "abilita": skill | pet (Ranger)
  const [combatStatsOpen, setCombatStatsOpen] = useState(false); // sezione [3] stat collassabile
  const [combatLogExpanded, setCombatLogExpanded] = useState(false); // cronaca a schermo intero (mobile)
  const [combatTab, setCombatTab] = useState("live"); // live (in corso) | history (ultimi 10 conclusi)
  // ── VFX pixelati sulle card dei combattenti (riuso effetti World Boss) ──
  const [vfxMessages, setVfxMessages] = useState([]);
  const vfxSeenRef     = useRef(new Set());   // id già processati (no doppioni)
  const vfxBaselineRef = useRef(new Set());   // matchId già "azzerati" (no replay della cronologia)
  // Popup di fine combattimento (vittoria/sconfitta). null = nessun popup.
  const [fightResult, setFightResult] = useState(null);
  const fightResultSeenRef = useRef(null);
  const fightResultTimerRef = useRef(null);
  const snapMigrationRef = useRef(false);   // migrazione del Barbaro scritta una volta per sessione
  /* FIX: P5b/P5c/P5d — modal/drawer state */
  const [bracketModalOpen, setBracketModalOpen] = useState(false);
  const [bettingDrawerOpen, setBettingDrawerOpen] = useState(false);
  // Skin del dado scelta dal giocatore (persistita in localStorage per-utente).
  const [dicePickerOpen, setDicePickerOpen] = useState(false);
  const [diceSkinId, setDiceSkinId] = useState("classic");
  const [titlesModalOpen, setTitlesModalOpen] = useState(false);
  const [statsTournModalOpen, setStatsTournModalOpen] = useState(false);
  const [statsFunModalOpen, setStatsFunModalOpen] = useState(false);

  // Dado 3D scaricato subito: il primo tiro parte senza attese.
  useEffect(() => { preloadDice3D(); }, []);

  // Carica la skin del dado salvata per questo utente e la rende attiva.
  useEffect(() => {
    if (!currentUser?.uid) return;
    let saved = "classic";
    try { saved = localStorage.getItem(`eldoria_dice_skin_${currentUser.uid}`) || "classic"; } catch { /* storage off */ }
    if (!DICE_SKINS.some((s) => s.id === saved)) saved = "classic";
    setDiceSkin(saved);
    setDiceSkinId(saved);
  }, [currentUser?.uid]);

  // Cambia skin: persiste, attiva e mostra un tiro di anteprima (valore neutro così
  // si vede la skin e non il colore di critico/fallimento).
  // Anteprime 3D dei colori nel menu "I Tuoi Dadi" (si disegnano all'apertura).
  const [diceSkinPics, setDiceSkinPics] = useState({});
  useEffect(() => {
    if (!dicePickerOpen || Object.keys(diceSkinPics).length) return;
    let alive = true;
    import("../components/dice3d").then((m) => {
      if (!alive || !m.canUse3D()) return;
      const pics = {};
      DICE_SKINS.forEach((s) => { try { pics[s.id] = m.previewDie(s.id, 160); } catch { /* resta l'esagono */ } });
      setDiceSkinPics(pics);
    }).catch(() => {});
    return () => { alive = false; };
  }, [dicePickerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChangeDiceSkin = (id) => {
    setDiceSkin(id);
    setDiceSkinId(id);
    try { if (currentUser?.uid) localStorage.setItem(`eldoria_dice_skin_${currentUser.uid}`, id); } catch { /* storage off */ }
    const previewVal = 2 + Math.floor(Math.random() * 18); // 2..19
    const label = DICE_SKINS.find((s) => s.id === id)?.label || "";
    showD20Roll(previewVal, { label: `Anteprima · ${label}` });
  };

  /* FIX: P5d — count placed bets for FAB badge */
  const [userBetsCount, setUserBetsCount] = useState(0);
  useEffect(() => {
    if (!currentUser) { setUserBetsCount(0); return; }
    const qBets = query(
      collection(db, "arena_bets"),
      where("uid", "==", currentUser.uid),
      where("status", "==", "pending")
    );
    return onSnapshot(qBets, snap => setUserBetsCount(snap.size));
  }, [currentUser]);

  // Tick ogni secondo per aggiornare i timer in-render
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Reazioni simpatiche in combattimento (cooldown 20s per giocatore) ──
  const [reactCooldownUntil, setReactCooldownUntil] = useState(0);
  const [reactPickerMatch, setReactPickerMatch] = useState(null);
  const REACT_COOLDOWN_MS = 20000;
  const REACT_SHOW_MS = 2800; // durata a schermo dell'emoji (≈ animazione CSS)
  const ARENA_REACTIONS = ["😂", "🔥", "👏", "😱", "💀", "👑", "🤡", "🫡", "😎", "🤝"];

  // Reazioni mostrate LOCALMENTE: la visibilità parte dall'ARRIVO sul proprio client
  // (timer locale), NON dall'orologio del mittente. Così lo skew tra i due orologi non
  // può "mangiare" la finestra e ENTRAMBI i giocatori la vedono per l'intera durata.
  const [liveReacts, setLiveReacts] = useState([]);
  const seenReactIdsRef = useRef(new Set());
  const reactInitRef = useRef(false);
  useEffect(() => {
    const list = arenaMeta?.reactions || [];
    // Al primo caricamento non riprodurre le reazioni già presenti nel documento.
    if (!reactInitRef.current) {
      reactInitRef.current = true;
      list.forEach(r => r.id && seenReactIdsRef.current.add(r.id));
      return;
    }
    const now = Date.now();
    const fresh = list.filter(r => r.id && !seenReactIdsRef.current.has(r.id) && (now - (r.ts || 0)) < 10000);
    if (fresh.length === 0) return;
    fresh.forEach(r => {
      seenReactIdsRef.current.add(r.id);
      setTimeout(() => setLiveReacts(prev => prev.filter(x => x.id !== r.id)), REACT_SHOW_MS);
    });
    setLiveReacts(prev => [...prev, ...fresh.map(r => ({ id: r.id, matchId: r.matchId, uid: r.uid, emoji: r.emoji }))]);
  }, [arenaMeta?.reactions]);
  const sendArenaReaction = async (matchId, emoji) => {
    if (!currentUser) return;
    const now = Date.now();
    if (now < reactCooldownUntil) return;
    setReactCooldownUntil(now + REACT_COOLDOWN_MS);
    setReactPickerMatch(null);
    const myName =
      (arenaMetaRef.current?.matches || [])
        .find(m => m.matchId === matchId)?.players
        ?.find(p => p.id === currentUser.uid)?.name
      || arenaMetaRef.current?.characterSnapshots?.[currentUser.uid]?.name
      || "Sfidante";
    const entry = { id: `${currentUser.uid}-${now}`, matchId, uid: currentUser.uid, name: myName, emoji, ts: now };
    try {
      const prev = (arenaMetaRef.current?.reactions || []).filter(r => now - (r.ts || 0) < 12000);
      await updateDoc(doc(db, "arena_meta", "global"), { reactions: [...prev, entry] });
    } catch (e) {
      console.error("Errore invio reazione arena:", e);
      setReactCooldownUntil(0); // se fallisce, sblocca subito
    }
  };

  // Parallax hero: aggiorna CSS variable --arena-scroll su scroll, senza re-render.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      document.documentElement.style.setProperty("--arena-scroll", String(window.scrollY));
      raf = 0;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      document.documentElement.style.removeProperty("--arena-scroll");
    };
  }, []);

  // ── Active-fight UX: detect the user's current match so we can hoist it
  // to the top, auto-scroll into it, and float a "your turn" pulse when
  // the user scrolls away from the fight. ─────────────────────────────────
  const myActiveMatchId = useMemo(() => {
    if (!currentUser || !arenaMeta?.matches?.length) return null;
    const phaseInCombat = arenaMeta.phase === "combat";
    const m = arenaMeta.matches.find(mm =>
      ((mm.kind === "fun") || phaseInCombat) &&
      mm.players?.some(p => p.id === currentUser.uid) &&
      mm.status !== "open" &&
      mm.status !== "finished"
    );
    return m?.matchId || null;
  }, [arenaMeta, currentUser]);

  // PG del Master con un fight vivo (iniziativa, «Iniziamo» o turni): servono al
  // selettore in cima al combattimento. Per i giocatori resta vuoto.
  const masterFights = useMemo(() => {
    if (!canActAs || !authUser || !arenaMeta?.matches?.length) return [];
    const phaseInCombat = arenaMeta.phase === "combat";
    const live = arenaMeta.matches.filter(mm =>
      ((mm.kind === "fun") || phaseInCombat) && mm.status !== "open" && mm.status !== "finished");
    return masterEntryIds(authUser.uid).flatMap((id) => {
      const m = live.find(mm => mm.players?.some(p => p.id === id));
      if (!m) return [];
      const me = m.players.find(p => p.id === id);
      const opp = m.players.find(p => p.id !== id);
      const state = m.turn === id && m.status !== "initiative" ? "turn"
        : isAwaitingReady(m) ? (m.ready?.[id] ? "wait" : "ready")
        : m.status === "initiative" ? (me?.init ? "wait" : "init")
        : "wait";
      return [{ id, matchId: m.matchId, name: me?.name || arenaMeta.characterSnapshots?.[id]?.name || "PG", opp: opp?.name || "?", state }];
    });
  }, [canActAs, authUser, arenaMeta]);

  // Se il PG che il Master sta giocando non ha più un fight vivo, passa da solo a
  // uno che ce l'ha (prima a quello di cui è il turno).
  useEffect(() => {
    if (!canActAs || !authUser) return;
    const curId = actAs || authUser.uid;
    if (!masterFights.length || masterFights.some(f => f.id === curId)) return;
    const next = masterFights.find(f => f.state === "turn") || masterFights[0];
    setActAs(next.id === authUser.uid ? null : next.id);
  }, [masterFights, actAs, canActAs, authUser]);

  const isMyTurnInActive = useMemo(() => {
    if (!myActiveMatchId || !currentUser) return false;
    const m = arenaMeta?.matches?.find(mm => mm.matchId === myActiveMatchId);
    return !!(m && m.turn === currentUser.uid);
  }, [arenaMeta, myActiveMatchId, currentUser]);

  // Quando apro il combat: parto sul tab "in corso" se ho una sfida viva,
  // altrimenti vado dritto allo "Storico" (così non resta vuoto).
  useEffect(() => {
    if (!combatModalOpen) return;
    const hasLive = (arenaMeta.matches || []).some(m =>
      ((m.kind === "fun") || arenaMeta.phase === "combat") &&
      m.players?.some(p => p.id === currentUser?.uid) &&
      m.status !== "open" && m.status !== "finished");
    setCombatTab(hasLive ? "live" : "history");
  }, [combatModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Driver VFX: osserva i log dei miei match e fa partire l'effetto pixelato
  // sulla card del bersaglio quando arriva una NUOVA voce d'attacco/cura. Alla
  // prima osservazione di un match azzera la cronologia (niente replay). ──
  useEffect(() => {
    const matches = arenaMeta?.matches || [];
    const mine = matches.filter(m => m.players?.some(p => p.id === currentUser?.uid));
    const fresh = [];
    for (const m of mine) {
      const logs = m.logs || [];
      const baselined = vfxBaselineRef.current.has(m.matchId);
      const key = (id) => `arena-fx:${m.matchId}:${id}`;
      const lastObjLog = [...logs].reverse().find(l => l && typeof l === "object" && l.ts);
      for (const entry of logs) {
        if (!entry || typeof entry !== "object" || !entry.ts) continue;
        const fx = classifyArenaVfx(entry);
        if (!fx) continue;
        const id = `${m.matchId}:${entry.ts}`;
        if (vfxSeenRef.current.has(id)) continue;
        vfxSeenRef.current.add(id);
        if (!baselined) continue; // cronologia pre-apertura: marca come vista ma non animare
        const offensive = ARENA_FX_OFFENSIVE.has(fx.kind);
        let targetId = entry.defId;
        if (!targetId) targetId = offensive ? m.players.find(p => p.id !== entry.attId)?.id : entry.attId;
        if (!targetId) continue;
        // Caduto: ultimo colpo della riga più recente e bersaglio a 0 PF → schizzo finale.
        const tgt = m.players.find(p => p.id === targetId);
        const killed = offensive && !fx.miss && entry === lastObjLog && !!tgt && (tgt.hp ?? 1) <= 0;
        fresh.push({
          id, effect: fx.kind, effectEl: fx.el,
          effectTargets: [key(targetId)],
          ...(offensive && entry.attId ? { effectFrom: key(entry.attId) } : {}),
          ...(fx.miss ? { effectMissTargets: [key(targetId)] } : {}),
          ...(killed ? { effectKill: [key(targetId)] } : {}),
        });
      }
      // Effetti dal campo parallelo lastFx (pet/demoni/costrutti/cure/IA)
      const lf = m.lastFx;
      if (lf && lf.id) {
        const lfId = `lf:${m.matchId}:${lf.id}`;
        if (!vfxSeenRef.current.has(lfId)) {
          vfxSeenRef.current.add(lfId);
          const fx = normalizeArenaFx(lf.effect);
          if (baselined && lf.targetId && fx) {
            const offensive = ARENA_FX_OFFENSIVE.has(fx.kind);
            const tgt = m.players.find(p => p.id === lf.targetId);
            const killed = offensive && !fx.miss && !!tgt && (tgt.hp ?? 1) <= 0 && m.status === "finished";
            fresh.push({
              id: lfId, effect: fx.kind, effectEl: fx.el,
              effectTargets: [key(lf.targetId)],
              ...(offensive && lf.fromId ? { effectFrom: key(lf.fromId) } : {}),
              ...(fx.miss ? { effectMissTargets: [key(lf.targetId)] } : {}),
              ...(killed ? { effectKill: [key(lf.targetId)] } : {}),
            });
          }
        }
      }
      if (!baselined) vfxBaselineRef.current.add(m.matchId);
    }
    if (fresh.length) setVfxMessages(prev => [...prev.slice(-40), ...fresh]);
  }, [arenaMeta?.matches, currentUser?.uid]);

  // Auto-scroll into the fight the first time a new active match appears.
  const lastScrolledMatchRef = useRef(null);
  useEffect(() => {
    if (!myActiveMatchId) { lastScrolledMatchRef.current = null; return; }
    if (lastScrolledMatchRef.current === myActiveMatchId) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById("arena-my-match");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        lastScrolledMatchRef.current = myActiveMatchId;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [myActiveMatchId]);

  // Hide the floating pulse when the match is comfortably in view.
  const [, setMatchInView] = useState(false);
  useEffect(() => {
    if (!myActiveMatchId) { setMatchInView(false); return; }
    if (typeof IntersectionObserver === "undefined") return;
    let cancelled = false;
    let observer = null;
    const trySetup = () => {
      if (cancelled) return;
      const el = document.getElementById("arena-my-match");
      if (!el) { requestAnimationFrame(trySetup); return; }
      observer = new IntersectionObserver(
        ([entry]) => setMatchInView(entry.isIntersecting),
        { rootMargin: "-20% 0px -55% 0px" }
      );
      observer.observe(el);
    };
    trySetup();
    return () => { cancelled = true; observer?.disconnect(); };
  }, [myActiveMatchId]);

  // Guardia anti–doppio click: impedisce che due attacchi/skill partano sulla stessa
  // istantanea di arenaMeta prima che updateDoc sia stato confermato da Firestore.
  // Senza, online (latenza > local) si possono accumulare clic che partono da uno
  // stato stantio e l'azione "non succede nulla" agli occhi dell'utente.
  const actionInFlightRef = useRef(false);
  // Firma dell'ultima versione di ogni match scritta da QUESTO client (vedi commitArenaMatches).
  const ownMatchSigRef = useRef({});

  // Scarto fra l'orologio del dispositivo e quello del server (vedi arenaNow).
  useEffect(() => {
    let alive = true;
    serverClockOffset()
      .then(o => { if (alive && Math.abs(o) < 7 * 24 * 3600 * 1000) setArenaClockOffset(o); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);


  // ── Commit transazionale dei match ────────────────────────────────────────
  // BUG storico (lost update): ogni azione scriveva l'INTERO array `matches`
  // ricalcolato dall'istantanea locale (`arenaMeta`) con
  // `updateDoc(..., { matches })`. Con più match simultanei (torneo), oppure
  // giocatore + IA, oppure due azioni ravvicinate, una scrittura sovrascriveva
  // le modifiche di un'altra partita da uno stato più vecchio: il giocatore
  // vedeva il danno a schermo e poi — dopo qualche secondo o un refresh —
  // l'azione "spariva".
  // FIX: scriviamo dentro una transazione che RILEGGE lo stato fresco da
  // Firestore e rimpiazza SOLO i match che questa azione ha realmente
  // toccato (aggiunti/modificati/rimossi), preservando le modifiche concorrenti
  // agli altri match. `extraFields` per eventuali campi top-level (es. fine torneo).
  // baseOverride: i match da cui l'azione è stata costruita, quando NON sono
  // quelli di questo render (l'IA parte da arenaMetaRef, più recente).
  const commitArenaMatches = async (nextMatches, extraFields = null, baseOverride = null) => {
    const ref = doc(db, "arena_meta", "global");
    const base = baseOverride || arenaMeta?.matches || [];
    const baseById = new Map(base.map(m => [m.matchId, m]));
    const baseStr = new Map(base.map(m => [m.matchId, JSON.stringify(m)]));
    // Integrità: ogni variazione di PF finisce in cronaca (traccia ❤ sulla voce
    // dell'azione, o una riga apposta se l'azione non ne ha scritte), i PF NaN
    // tornano al valore di prima, e chi va a 0 chiude il match / perde il turno.
    const closedHere = [];
    nextMatches = nextMatches.map(m => {
      const bm = baseById.get(m.matchId);
      if (!bm || bm === m || baseStr.get(m.matchId) === JSON.stringify(m)) return m;
      const audited = auditArenaMatch(bm, m);
      const fin = finalizeArenaMatch(audited);
      if (fin.status === "finished" && m.status !== "finished" && bm.status !== "finished") closedHere.push(fin);
      return fin;
    });
    const nextById = new Map(nextMatches.map(m => [m.matchId, m]));
    // match aggiunti o modificati da QUESTA azione rispetto alla base locale.
    // (I match non toccati vengono restituiti per riferimento dai vari .map,
    //  quindi il confronto sul contenuto li riconosce come invariati.)
    const changedIds = new Set();
    for (const m of nextMatches) {
      const bs = baseStr.get(m.matchId);
      if (bs === undefined || bs !== JSON.stringify(m)) changedIds.add(m.matchId);
    }
    // match rimossi da QUESTA azione (presenti nella base, assenti ora).
    const removedIds = new Set();
    for (const m of base) if (!nextById.has(m.matchId)) removedIds.add(m.matchId);

    let merged = nextMatches;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return; // niente doc: non ricreiamo nulla (come prima)
      const fresh = snap.data().matches || [];
      const freshIds = new Set(fresh.map(m => m.matchId));
      // Controllo di concorrenza: un match che questa azione modifica deve essere
      // sul server com'era quando l'azione è partita (o come l'ha lasciato la
      // NOSTRA commit precedente). Se nel frattempo è andato avanti — azione da
      // un'altra scheda/dispositivo, turno già passato — l'azione si annulla:
      // prima la versione locale vecchia sovrascriveva quella nuova, e con due
      // schede si poteva agire due volte o ritentare un tiro andato male.
      for (const fm of fresh) {
        if (!changedIds.has(fm.matchId)) continue;
        const bm = baseById.get(fm.matchId);
        if (!bm) continue;
        const fs_ = matchSig(fm);
        if (fs_ !== matchSig(bm) && fs_ !== ownMatchSigRef.current[fm.matchId]) {
          throw new Error("arena-stale");
        }
      }
      const result = [];
      // 1) match già sul server: la nostra versione se l'abbiamo toccato,
      //    altrimenti la versione FRESCA (preserva modifiche concorrenti);
      //    saltati quelli che questa azione ha rimosso.
      for (const fm of fresh) {
        if (removedIds.has(fm.matchId)) continue;
        result.push(changedIds.has(fm.matchId) ? nextById.get(fm.matchId) : fm);
      }
      // 2) match nuovi creati da questa azione (non ancora sul server).
      for (const m of nextMatches) {
        if (!freshIds.has(m.matchId)) result.push(m);
      }
      merged = result;
      tx.update(ref, { matches: result, ...(extraFields || {}) });
    }).catch((e) => {
      if (e.message === "arena-stale") {
        alert("⚠ Lo scontro è già andato avanti (azione da un'altra scheda o turno passato): questa azione è annullata.");
      }
      throw e;
    });
    for (const id of changedIds) {
      const m = nextById.get(id);
      if (m) ownMatchSigRef.current[id] = matchSig(m);
    }
    // Allinea subito lo stato locale al risultato autorevole, così un'azione
    // immediatamente successiva parte da una base coerente (l'onSnapshot
    // confermerà lo stesso valore poco dopo).
    setArenaMeta(prev => (prev ? { ...prev, matches: merged, ...(extraFields || {}) } : prev));
    // Match chiusi dalla rete di sicurezza (non dall'azione): ricompense/scommesse
    // come per una chiusura normale (le funzioni guardano lo stato di prima).
    if (closedHere.length) {
      try {
        await awardRoundCoins(closedHere);
        await resolveBetsForFinishedMatches(closedHere);
        await recordMatchHistory(closedHere);
      } catch (e) { console.error("[arena] chiusura automatica:", e); }
    }
    // Se questa commit ha completato un round di torneo, apre in automatico la
    // finestra di acquisti (salta se la commit era la chiusura del torneo).
    if (!extraFields?.phase && !extraFields?.tournamentWinner) {
      try { await maybeOpenShoppingWindow(merged); } catch (e) { console.error("[arena] shopping window:", e); }
    }
  };

  // Master join setup
  const [masterJoinSetup, setMasterJoinSetup] = useState(false);
  // PG già pronto scelto dal Master per entrare: { kind: "reserve" | "saved", i } (uno solo).
  const [masterPick, setMasterPick] = useState(null);
  const [masterJoinName, setMasterJoinName]   = useState("");
  const [masterJoinClass, setMasterJoinClass] = useState("");
  const [equipSelections, setEquipSelections] = useState({});

  // ── Arena Libera (Fun) ────────────────────────────────────────────────────
  // Loadout context: "tournament" (default) o "fun" (sfida libera).
  // funAcceptMatchId: null se sto creando una sfida, matchId se sto accettando.
  // aiMatchPending: true se il loadout sta preparando una sfida contro l'IA.
  const [loadoutContext, setLoadoutContext] = useState("tournament");
  // reloadoutMode: il partecipante sta ri-equipaggiando durante la finestra di
  // shopping (classe/caratteristiche/HP bloccati; cambia solo equip + acquisti).
  const [reloadoutMode, setReloadoutMode] = useState(false);
  // Popup "puoi aggiornare l'assetto": chiavi già chiuse in questa visita.
  const [reloadNudgeOff, setReloadNudgeOff] = useState({});
  const [funAcceptMatchId, setFunAcceptMatchId] = useState(null);
  const [aiMatchPending, setAiMatchPending] = useState(false);

  // In DEV `?vista=player` mostra la pagina come la vede un giocatore (stesso doc characters).
  const devPlayerView = import.meta.env.DEV && new URLSearchParams(window.location.search).get("vista") === "player";
  const isMaster = currentUser?.email === "santomassimo85@gmail.com" && !devPlayerView;

  // ── Cronache: ogni match concluso si salva per intero in arena_chronicles,
  // così resta rileggibile anche quando sparisce da arena_meta. Lo salva chi ha
  // combattuto (o il Master, che vede tutto): il primo che arriva, una volta sola.
  const chronicleDoneRef = useRef(new Set());
  useEffect(() => {
    if (!currentUser || !arenaMeta?.matches) return;
    const snaps = arenaMeta.characterSnapshots || {};
    for (const m of arenaMeta.matches) {
      if (m.status !== "finished" || !m.matchId || (m.players || []).length < 2) continue;
      if (!isMaster && !m.players.some(p => p.id === currentUser.uid)) continue;
      const cid = chronicleId(m);
      if (chronicleDoneRef.current.has(cid)) continue;
      chronicleDoneRef.current.add(cid);
      saveChronicle(m, snaps).catch(e => {
        chronicleDoneRef.current.delete(cid);
        console.warn("[arena] cronaca non salvata:", e);
      });
    }
  }, [arenaMeta?.matches, arenaMeta?.characterSnapshots, currentUser, isMaster]);

  // ── My arena buffs (sblocchi acquistati in Bottega) — usato per gating classi/buff anche prima della loadout. ──
  const [myArenaBuffs, setMyArenaBuffs] = useState({});
  const [myArenaWeekly, setMyArenaWeekly] = useState(null);
  useEffect(() => {
    if (!authUser) return;
    return onSnapshot(doc(db, "characters", authUser.uid), snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setMyArenaBuffs(d.arenaBuffs || {});
      // PG salvati sempre aggiornati: servono già all'ingresso (prima del loadout).
      setSavedArenaChars(Array.from({ length: SAVED_ARENA_SLOTS }, (_, i) => (Array.isArray(d.arenaSavedChars) ? (d.arenaSavedChars[i] ?? null) : null)));
      setActiveSavedSlot(Number.isInteger(d.arenaSavedActive) ? d.arenaSavedActive : null);
      setLastArenaLoadout(d.arenaLastLoadout?.class ? d.arenaLastLoadout : null);
      setMyArenaWeekly(d.arenaWeekly || null);
    });
  }, [authUser]);


  // ── Monete Arena ──────────────────────────────────────────────────────────
  const awardArenaCoins = async (uid, amount) => {
    try {
      await updateDoc(doc(db, "characters", uid), { arenaCoins: increment(amount) });
    } catch { /* NPC o doc mancante: ignora */ }
  };

  // Corone del mercato nero (campo `platinum`).
  const awardCrowns = async (uid, amount) => {
    if (!amount) return;
    try {
      await updateDoc(doc(db, "characters", uid), { platinum: increment(amount) });
    } catch { /* NPC o doc mancante: ignora */ }
  };

  // Distribuzione automatica dei premi a fine torneo: 1° posto, 2° posto e
  // partecipanti ricevono Corone + Monete Arena; i vantaggi live restano un
  // testo informativo (li applica il Master a mano). Gira una sola volta,
  // dentro sendChampionNotification (l'incoronazione avviene una sola volta).
  const distributeArenaPrizes = async (winnerId, matchesOverride) => {
    const cfg = arenaMeta?.prizeConfig;
    if (!cfg) return;
    const matches = matchesOverride || arenaMeta?.matches || [];
    const finalM = matches.find(m => m.kind === "final" && m.winner);
    const runnerUpId = (finalM?.players || []).map(p => p.id).find(id => id && id !== winnerId) || null;
    const participants = (arenaMeta?.participants || []).filter(Boolean);
    const targets = [...new Set([winnerId, runnerUpId, ...participants].filter(Boolean))];
    const bucketOf = (uid) => uid === winnerId ? "first" : uid === runnerUpId ? "second" : "participant";
    const placeLabel = { first: "1° posto", second: "2° posto", participant: "partecipazione" };
    for (const uid of targets) {
      if (isAiId(uid) || isMasterAltId(uid)) continue;   // i PG-bot di riserva non ricevono premi
      const tier = cfg[bucketOf(uid)] || {};
      const crowns = Math.max(0, parseInt(tier.crowns, 10) || 0);
      const coins  = Math.max(0, parseInt(tier.coins, 10) || 0);
      const perks  = (tier.perks || "").trim();
      if (crowns) await awardCrowns(uid, crowns);
      if (coins)  await awardArenaCoins(uid, coins);
      const gained = [];
      if (crowns) gained.push(`👑 ${crowns} Corone`);
      if (coins)  gained.push(`🪙 ${coins} Monete Arena`);
      if (perks)  gained.push(`🎁 ${perks}`);
      if (!gained.length) continue;
      await addDoc(collection(db, "notifications"), {
        userId: uid, read: false, timestamp: serverTimestamp(),
        title: "🏆 Premi dell'Arena",
        message: `Ricompensa Arena (${placeLabel[bucketOf(uid)]}): ${gained.join(" · ")}.${perks ? " I vantaggi per le sessioni live te li applicherà il Master." : ""}`,
      });
    }
  };

  // Ricompense Monete Arena assegnate LIVE a fine di ogni round di torneo, così i
  // player possono spenderle alla Bottega prima del round successivo. Gira una sola
  // volta per match (guardia justFinished, dal client che chiude il round).
  //   • 5 MA per fight concluso (anche a chi perde)
  //   • +10 al vincitore del round
  //   • +5 se vince con >70% HP  ·  +3 se vince con >40% HP  (si sommano)
  //   • +5 se vince in meno di 8 attacchi (attacchi del vincitore)
  //   • +4 a chiunque (vincitore o perdente) abbia resistito ≥2 volte a un colpo
  const awardRoundCoins = async (updatedMatches) => {
    for (const m of updatedMatches) {
      const prev = arenaMeta?.matches?.find(x => x.matchId === m.matchId);
      const justFinished = m.status === "finished" && prev?.status !== "finished";
      if (m.kind === "fun") {
        // 🐣 pet system: +1 point for completing an Arena Libera fight (capped 5/day)
        if (justFinished) {
          for (const p of (m.players || [])) {
            if (p?.id) awardPetPoints(p.id, "arena_libera", { resourceKey: m.matchId });
          }
        }
        continue; // Arena Libera / Sfida IA: nessuna ricompensa MA
      }
      if (!justFinished || !m.winner) continue;

      const players = (m.players || []).filter(p => p?.id);
      const winner  = players.find(p => p.id === m.winner);
      const winnerMaxHp = winner?.maxHp || 1;
      const winnerHpPct = (winner?.hp ?? 0) / winnerMaxHp;
      const winnerAttacks = winner?.attacksMade ?? 0;

      for (const p of players) {
        if (isAiId(p.id) || isMasterAltId(p.id)) continue;             // i PG-bot di riserva non guadagnano Monete Arena
        const isWinner = p.id === m.winner;
        let coins = 5;                          // fight concluso (anche se perde)
        const bits = ["+5 fight concluso"];
        if (isWinner) {
          coins += 10; bits.push("+10 round vinto");
          if (winnerHpPct > 0.70) { coins += 5; bits.push("+5 oltre 70% HP"); }
          if (winnerHpPct > 0.40) { coins += 3; bits.push("+3 oltre 40% HP"); }
          if (winnerAttacks < 8)  { coins += 5; bits.push("+5 vittoria lampo (<8 attacchi)"); }
        }
        if ((p.resistProcs ?? 0) >= 2) { coins += 4; bits.push("+4 resistenze (×2 colpi)"); }
        await awardArenaCoins(p.id, coins);
        await addDoc(collection(db, "notifications"), {
          userId: p.id, read: false, timestamp: serverTimestamp(),
          title: isWinner ? "🏆 Round vinto — Monete Arena" : "⚔️ Round concluso — Monete Arena",
          message: `🪙 ${bits.join(" · ")} = ${coins} Monete Arena. Spendile alla Bottega prima del prossimo round!`,
        });
      }
      // 🐣 pet system: +3 points to the winner of a tournament round (mai ai bot)
      if (!isAiId(m.winner) && !isMasterAltId(m.winner)) awardPetPoints(m.winner, "arena_round", { resourceKey: m.matchId });
    }
  };

  // ── Bet resolution ─────────────────────────────────────────────────────────
  const resolveMatchBets = async (matchId, winnerId) => {
    const q = query(collection(db, "arena_bets"), where("matchId", "==", matchId), where("status", "==", "pending"));
    let snap;
    try { snap = await getDocs(q); } catch { return; }
    for (const betDoc of snap.docs) {
      const bet = betDoc.data();
      if (bet.targetUid === winnerId) {
        const payout = bet.amount * bet.multiplier;
        await updateDoc(doc(db, "characters", bet.uid), { arenaCoins: increment(payout) });
        await addDoc(collection(db, "notifications"), {
          userId: bet.uid, read: false, timestamp: serverTimestamp(),
          title: "🎰 Scommessa vinta!",
          message: `Hai scommesso su ${bet.targetName} e hai vinto il fight! Guadagni ${payout} Monete Arena.`,
        });
        await updateDoc(betDoc.ref, { status: "won", payout });
      } else {
        await updateDoc(betDoc.ref, { status: "lost" });
      }
    }
  };

  const resolveTournamentBets = async (winnerId, winnerName) => {
    const q = query(collection(db, "arena_bets"), where("matchId", "==", "tournament"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    for (const betDoc of snap.docs) {
      const bet = betDoc.data();
      if (bet.targetUid === winnerId) {
        const payout = bet.amount * bet.multiplier;
        await updateDoc(doc(db, "characters", bet.uid), { arenaCoins: increment(payout) });
        await addDoc(collection(db, "notifications"), {
          userId: bet.uid, read: false, timestamp: serverTimestamp(),
          title: "🏆 Scommessa sul torneo vinta!",
          message: `${winnerName} ha vinto il torneo! La tua scommessa ti frutta ${payout} Monete Arena.`,
        });
        await updateDoc(betDoc.ref, { status: "won", payout });
      } else {
        await updateDoc(betDoc.ref, { status: "lost" });
      }
    }
  };

  const archiveTournament = async (winnerId, snapshotsOverride, participantsOverride, matchesOverride) => {
    const snaps = snapshotsOverride || arenaMeta?.characterSnapshots || {};
    const ids   = participantsOverride || arenaMeta?.participants || [];
    const matches = matchesOverride || arenaMeta?.matches || [];
    const wins = {}, losses = {};
    matches.forEach(m => {
      if (m.status !== "finished" || !m.winner) return;
      (m.players || []).forEach(p => {
        if (p.id === m.winner) wins[p.id] = (wins[p.id] || 0) + 1;
        else losses[p.id] = (losses[p.id] || 0) + 1;
      });
    });
    const participants = ids
      .map(uid => ({
        uid,
        name:  snaps[uid]?.name  || "",
        class: (snaps[uid]?.class || "").toLowerCase().trim(),
        matchWins:   wins[uid]   || 0,
        matchLosses: losses[uid] || 0,
      }))
      .filter(p => p.class);
    if (participants.length === 0) return;
    const winnerSnap = snaps[winnerId] || {};
    const winnerClass = (winnerSnap.class || "").toLowerCase().trim();
    // 2° classificato = l'altro finalista.
    const finalM = matches.find(m => m.kind === "final" && m.winner);
    const runnerUpId = (finalM?.players || []).map(p => p.id).find(id => id && id !== winnerId) || null;
    const runnerUpSnap = runnerUpId ? (snaps[runnerUpId] || {}) : {};
    // Numero torneo progressivo (1-based) e premi configurati per posizione.
    const tournamentNumber = (tournamentHistory?.length || 0) + 1;
    const prizeConfig = arenaMeta?.prizeConfig || null;
    try {
      await addDoc(collection(db, "arena_tournament_history"), {
        ts: serverTimestamp(),
        tournamentNumber,
        winnerId: winnerId || null,
        winnerName: winnerSnap.name || null,
        winnerImage: winnerSnap.image || null,
        winnerClass: winnerClass || null,
        runnerUpId,
        runnerUpName: runnerUpSnap.name || null,
        runnerUpClass: (runnerUpSnap.class || "").toLowerCase().trim() || null,
        prizeConfig,
        participants,
      });
    } catch (e) {
      console.error("archiveTournament error:", e);
    }
  };

  const refundAllBets = async () => {
    const q = query(collection(db, "arena_bets"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    for (const betDoc of snap.docs) {
      const bet = betDoc.data();
      await updateDoc(doc(db, "characters", bet.uid), { arenaCoins: increment(bet.amount) });
      await addDoc(collection(db, "notifications"), {
        userId: bet.uid, read: false, timestamp: serverTimestamp(),
        title: "↩ Scommessa rimborsata",
        message: `L'arena è stata chiusa prima della fine. Ti vengono restituite ${bet.amount} Monete Arena.`,
      });
      await updateDoc(betDoc.ref, { status: "refunded" });
    }
  };

  const resolveBetsForFinishedMatches = async (updatedMatches) => {
    for (const m of updatedMatches) {
      if (m.kind === "fun") continue; // Arena Libera: nessuna scommessa
      const prev = arenaMeta?.matches?.find(x => x.matchId === m.matchId);
      if (m.status === "finished" && prev?.status !== "finished" && m.winner)
        await resolveMatchBets(m.matchId, m.winner);
    }
  };

  const recordMatchHistory = async (updatedMatches) => {
    const newEntries = [];
    for (const m of updatedMatches) {
      if (m.kind === "fun") continue; // Arena Libera: niente storico/statistiche
      const prev = arenaMeta?.matches?.find(x => x.matchId === m.matchId);
      if (m.status === "finished" && prev?.status !== "finished" && m.winner) {
        for (const p of m.players) {
          newEntries.push({ uid: p.id, result: p.id === m.winner ? "W" : "L", matchId: m.matchId, ts: new Date().toISOString() });
        }
      }
    }
    if (newEntries.length === 0) return;
    const existing = arenaMeta?.matchHistory || [];
    await updateDoc(doc(db, "arena_meta", "global"), { matchHistory: [...existing, ...newEntries] });
  };

  useEffect(() => {
    const ref = doc(db, "arena_meta", "global");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const raw = snap.data();
        // Barbaro ribilanciato (2026-10-28): snapshot vecchi → abilità nuove.
        const migSnaps = migrateArenaSnapshots(raw.characterSnapshots);
        const data = migSnaps === raw.characterSnapshots ? raw : { ...raw, characterSnapshots: migSnaps };
        setArenaMeta(data);
        // …e la correzione si SCRIVE nel database, una volta: finché restava solo in
        // lettura, un'app aperta da prima dell'aggiornamento costruiva i match (e
        // giocava) col Barbaro vecchio (Lael vs Temistocle, 2026-10-28).
        if ((migSnaps !== raw.characterSnapshots || migrateMatchRageUses(raw.matches) !== raw.matches) && !snapMigrationRef.current) {
          snapMigrationRef.current = true;
          runTransaction(db, async (tx) => {
            const cur = (await tx.get(ref)).data() || {};
            const snaps = migrateArenaSnapshots(cur.characterSnapshots);
            const matches = migrateMatchRageUses(cur.matches);
            const patch = {};
            if (snaps !== cur.characterSnapshots) {
              Object.keys(snaps).forEach((uid) => {
                if (snaps[uid] !== cur.characterSnapshots[uid]) patch[`characterSnapshots.${uid}.selectedActions`] = snaps[uid].selectedActions;
              });
            }
            if (matches !== cur.matches) patch.matches = matches;
            if (Object.keys(patch).length) tx.update(ref, patch);
          }).catch((e) => { snapMigrationRef.current = false; console.warn("[arena] migrazione snapshot", e); });
        }
        if (isMaster) {
          setPrizeText(data.prizes || "");
          const pc = data.prizeConfig || {};
          setPrizeConfig({
            first:       prizeTierToStr(pc.first),
            second:      prizeTierToStr(pc.second),
            participant: prizeTierToStr(pc.participant),
          });
        }
      }
      /* Niente auto-setDoc: se il doc è temporaneamente assente (race con
         cache offline o emulator restart) NON ricreiamo nulla per non
         sovrascrivere i dati reali. L'inizializzazione avviene solo via
         pulsante Reset del Master. */
    });
    return () => unsub();
  }, [isMaster]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "arena_tournament_history"), (snap) => {
      setTournamentHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let alive = true;
    getDocs(collection(db, "characters")).then(snap => {
      if (!alive) return;
      const map = {};
      snap.docs.forEach(d => { const n = d.data()?.name; if (n) map[d.id] = n; });
      setLiveNames(map);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Storico con i nomi riallineati al personaggio di oggi (per uid); se il PG non
  // esiste più resta il nome archiviato.
  const tournamentHistory = useMemo(() => {
    const nameOf = (uid, fallback) => (uid && liveNames[uid]) || fallback || null;
    return tournamentHistoryRaw.map(t => ({
      ...t,
      winnerName:   nameOf(t.winnerId, t.winnerName),
      runnerUpName: nameOf(t.runnerUpId, t.runnerUpName),
      participants: (t.participants || []).map(p => p?.uid ? { ...p, name: nameOf(p.uid, p.name) } : p),
    }));
  }, [tournamentHistoryRaw, liveNames]);

  const championsRaw = useMemo(() => {
    const map = {};
    for (const t of tournamentHistory) {
      const uid = t.winnerId;
      if (!uid) continue;
      const prev = map[uid];
      const tsMs = t.ts?.toMillis ? t.ts.toMillis() : 0;
      if (!prev) {
        map[uid] = {
          uid,
          name:  t.winnerName  || null,
          class: t.winnerClass || null,
          image: t.winnerImage || null,
          wins:  1,
          lastWonAt: tsMs,
          entryIds: [t.id],
        };
      } else {
        prev.wins++;
        prev.entryIds.push(t.id);
        if (tsMs > prev.lastWonAt) {
          prev.lastWonAt = tsMs;
          prev.name  = t.winnerName  || prev.name;
          prev.class = t.winnerClass || prev.class;
          prev.image = t.winnerImage || prev.image;
        }
      }
    }
    return Object.values(map).sort((a, b) => b.wins - a.wins || b.lastWonAt - a.lastWonAt);
  }, [tournamentHistory]);

  // Lazy-fetch character profile for champions whose archived entry lacks name/image
  useEffect(() => {
    const missing = championsRaw
      .filter(c => (!c.name || !c.image) && !(c.uid in profileLookup))
      .map(c => c.uid);
    const lastChampUid = arenaMeta?.lastChampion?.uid;
    if (lastChampUid && !(lastChampUid in profileLookup)) missing.push(lastChampUid);
    const unique = [...new Set(missing)];
    if (unique.length === 0) return;
    (async () => {
      const updates = {};
      for (const uid of unique) {
        try {
          const snap = await getDoc(doc(db, "characters", uid));
          updates[uid] = snap.exists() ? { name: snap.data().name || null, image: snap.data().image || null } : { name: null, image: null };
        } catch {
          updates[uid] = { name: null, image: null };
        }
      }
      setProfileLookup(prev => ({ ...prev, ...updates }));
    })();
  }, [championsRaw, arenaMeta?.lastChampion?.uid, profileLookup]);

  const champions = useMemo(() =>
    championsRaw.map(c => ({
      ...c,
      name:  c.name  || profileLookup[c.uid]?.name  || null,
      image: c.image || profileLookup[c.uid]?.image || null,
    }))
  , [championsRaw, profileLookup]);

  // Classifica generale a punti: vittoria +3, 2° posto +2, partecipazione +1.
  // Visibile a tutti; sommata su tutti i tornei archiviati.
  const arenaLeaderboard = useMemo(() => {
    const map = {};
    const bump = (uid, name, pts) => {
      if (!uid) return;
      if (!map[uid]) map[uid] = { uid, name: name || null, points: 0, wins: 0, seconds: 0, plays: 0 };
      map[uid].points += pts;
      if (name && !map[uid].name) map[uid].name = name;
    };
    for (const t of tournamentHistory) {
      const winner = t.winnerId, runnerUp = t.runnerUpId;
      (t.participants || []).forEach(p => {
        if (!p?.uid) return;
        if (p.uid.startsWith(AI_BOT_PREFIX) || isMasterAltId(p.uid)) return;   // i PG-bot di riserva non entrano in classifica
        if (p.uid === winner)        { bump(p.uid, p.name, 3); map[p.uid].wins++; }
        else if (p.uid === runnerUp) { bump(p.uid, p.name, 2); map[p.uid].seconds++; }
        else                         { bump(p.uid, p.name, 1); }
        map[p.uid].plays++;
      });
      // Vincitore/2° non sempre presenti in participants (safety); mai i bot.
      if (winner && !winner.startsWith(AI_BOT_PREFIX) && !isMasterAltId(winner) && !(t.participants || []).some(p => p.uid === winner)) { bump(winner, t.winnerName, 3); map[winner].wins++; map[winner].plays++; }
      if (runnerUp && !runnerUp.startsWith(AI_BOT_PREFIX) && !isMasterAltId(runnerUp) && !(t.participants || []).some(p => p.uid === runnerUp)) { bump(runnerUp, t.runnerUpName, 2); map[runnerUp].seconds++; map[runnerUp].plays++; }
    }
    return Object.values(map)
      .map(e => ({ ...e, name: e.name || profileLookup[e.uid]?.name || null }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins);
  }, [tournamentHistory, profileLookup]);

  const mostRecentChampion = useMemo(() => {
    const enrich = (champ) => champ ? {
      ...champ,
      name:  liveNames[champ.uid] || champ.name || profileLookup[champ.uid]?.name || null,
      image: champ.image || profileLookup[champ.uid]?.image || null,
    } : null;
    if (arenaMeta?.lastChampion?.uid) return enrich(arenaMeta.lastChampion);
    if (!tournamentHistory.length) return null;
    const sorted = [...tournamentHistory].sort((a, b) => {
      const at = a.ts?.toMillis ? a.ts.toMillis() : 0;
      const bt = b.ts?.toMillis ? b.ts.toMillis() : 0;
      return bt - at;
    });
    const latest = sorted.find(t => t.winnerId);
    if (!latest) return null;
    return enrich({
      uid:    latest.winnerId,
      name:   latest.winnerName  || null,
      class:  latest.winnerClass || null,
      image:  latest.winnerImage || null,
      prizes: "",
      wonAt:  latest.ts?.toDate?.()?.toISOString?.() || null,
    });
  }, [arenaMeta?.lastChampion, tournamentHistory, profileLookup, liveNames]);

  // ── Auto-registra i match finiti in matchHistory (transazione idempotente) ──
  const syncMatchHistory = useCallback(async () => {
    if (!arenaMeta?.matches) return 0;
    const matches = arenaMeta.matches;
    try {
      const metaRef = doc(db, "arena_meta", "global");
      let addedCount = 0;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(metaRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const existing = data.matchHistory || [];
        const existingIds = new Set(existing.map(e => e.matchId));
        const toAdd = [];
        for (const m of matches) {
          if (m.kind === "fun") continue; // Arena Libera: niente storico
          if (m.status !== "finished" || !m.winner) continue;
          if (existingIds.has(m.matchId)) continue;
          for (const p of m.players) {
            toAdd.push({
              uid: p.id,
              result: p.id === m.winner ? "W" : "L",
              matchId: m.matchId,
              ts: new Date().toISOString(),
            });
          }
          existingIds.add(m.matchId);
        }
        if (toAdd.length === 0) return;
        addedCount = toAdd.length;
        tx.update(metaRef, { matchHistory: [...existing, ...toAdd] });
      });
      return addedCount;
    } catch (e) {
      console.error("syncMatchHistory error:", e);
      return -1;
    }
  }, [arenaMeta?.matches]);

  useEffect(() => {
    if (!isMaster || !arenaMeta?.matches) return;
    const processed = new Set((arenaMeta.matchHistory || []).map(e => e.matchId));
    const hasUnrecorded = arenaMeta.matches.some(
      m => m.kind !== "fun" && m.status === "finished" && m.winner && !processed.has(m.matchId)
    );
    if (!hasUnrecorded) return;
    syncMatchHistory();
  }, [isMaster, arenaMeta?.matches, arenaMeta?.matchHistory, syncMatchHistory]);

  // ── Archive finished fun matches in funMatchHistory (master) ──────────────
  // Permette di tenere statistiche delle Sfide Libere anche quando i match
  // vengono rimossi da arena_meta.matches.
  useEffect(() => {
    if (!isMaster || !arenaMeta?.matches) return;
    const archived = new Set((arenaMeta.funMatchHistory || []).map(e => e.matchId));
    const toArchive = arenaMeta.matches.filter(m =>
      m.kind === "fun" &&
      m.status === "finished" &&
      m.players?.length >= 2 &&
      !archived.has(m.matchId)
    );
    if (toArchive.length === 0) return;
    const snaps = arenaMeta.characterSnapshots || {};
    const additions = toArchive.map(m => {
      const winnerP = (m.players || []).find(p => p.id === m.winner);
      const loserP  = (m.players || []).find(p => p.id !== m.winner);
      const wClass = (winnerP?.class || snaps[winnerP?.id]?.class || "").toLowerCase().trim() || null;
      const lClass = (loserP?.class  || snaps[loserP?.id]?.class  || "").toLowerCase().trim() || null;
      return {
        matchId: m.matchId,
        winnerId: m.winner || null,
        winnerClass: wClass,
        loserClass:  lClass,
        ts: new Date().toISOString(),
      };
    });
    updateDoc(doc(db, "arena_meta", "global"), {
      funMatchHistory: [...(arenaMeta.funMatchHistory || []), ...additions],
    }).catch(e => console.error("funMatchHistory archive error:", e));
  }, [isMaster, arenaMeta?.matches, arenaMeta?.funMatchHistory, arenaMeta?.characterSnapshots]);

  // ── Auto-pulizia: rimuove dalle `matches` live le Sfide Libere finite e già
  // archiviate da un po' (finestra di grazia), così il doc arena_meta non si
  // gonfia all'infinito. NB: i vincitori restano in funMatchHistory / matchHistory
  // / lastChampion / arena_tournament_history — qui non si tocca nulla di quello.
  useEffect(() => {
    if (!isMaster || !arenaMeta?.matches) return;
    const archivedTs = new Map((arenaMeta.funMatchHistory || []).map(e => [e.matchId, e.ts]));
    const now = Date.now();
    const staleIds = new Set(
      arenaMeta.matches
        .filter(m =>
          m.kind === "fun" &&
          m.status === "finished" &&
          archivedTs.has(m.matchId) &&
          (now - new Date(archivedTs.get(m.matchId)).getTime()) > FUN_MATCH_PRUNE_GRACE_MS
        )
        .map(m => m.matchId)
    );
    if (staleIds.size === 0) return;
    const kept = arenaMeta.matches.filter(m => !staleIds.has(m.matchId));
    commitArenaMatches(kept)
      .catch(e => console.error("prune fun matches error:", e));
  }, [isMaster, arenaMeta?.matches, arenaMeta?.funMatchHistory]);

  // ── Popup fine combattimento: appena un match a cui partecipo si conclude
  // con un vincitore, mostra "Hai Vinto!" (in grande) oppure "Hai Perso" con
  // chi ha vinto. Al primo caricamento i match già finiti sono marcati come
  // "visti" così il popup non riappare per scontri vecchi dopo un refresh.
  useEffect(() => {
    if (!currentUser || !arenaMeta?.matches) return;
    const mine = arenaMeta.matches.filter(m =>
      m.status === "finished" && m.winner && m.players?.some(p => p.id === currentUser.uid)
    );
    if (fightResultSeenRef.current === null) {
      fightResultSeenRef.current = new Set(mine.map(m => m.matchId));
      return;
    }
    const fresh = mine.find(m => !fightResultSeenRef.current.has(m.matchId));
    if (!fresh) return;
    fightResultSeenRef.current.add(fresh.matchId);
    const winnerP    = fresh.players.find(p => p.id === fresh.winner);
    const winnerSnap = (arenaMeta.characterSnapshots || {})[fresh.winner] || {};
    // Il colpo decisivo: l'ultima voce che porta qualcuno a 0 PF (traccia `hp`),
    // altrimenti l'ultima voce vera (niente "🏆 … È IL VINCITORE!" né righe d'audit).
    const logs = fresh.logs || [];
    const isTrophy = (l) => typeof l === "string" && l.startsWith("🏆");
    const isAudit  = (l) => l && typeof l === "object" && l.audit;
    let finalLog = null;
    for (let i = logs.length - 1; i >= 0 && !finalLog; i--) {
      const hp = logs[i] && typeof logs[i] === "object" ? logs[i].hp : null;
      if (hp && Object.values(hp).some(v => Array.isArray(v) && v[1] <= 0 && v[0] > 0)) finalLog = logs[i];
    }
    if (!finalLog) finalLog = [...logs].reverse().find(l => l && !isTrophy(l) && !isAudit(l)) || null;
    const result = {
      won:         fresh.winner === currentUser.uid,
      winnerName:  winnerP?.name || winnerSnap.name || "Sfidante",
      winnerImage: winnerSnap.image || null,
      winnerClass: winnerP?.class || winnerSnap.class || "",
      finalLog,
      players:     fresh.players,
    };
    // Prima si vede il colpo (dado, effetto, PF a zero), POI il popup.
    clearTimeout(fightResultTimerRef.current);
    fightResultTimerRef.current = setTimeout(() => setFightResult(result), FIGHT_RESULT_DELAY_MS);
  }, [arenaMeta?.matches, arenaMeta?.characterSnapshots, currentUser]);
  useEffect(() => () => clearTimeout(fightResultTimerRef.current), []);

  // ── STEP 1: carica personaggio → class-select ────────────────────────────
  const openLoadoutPicker = async () => {
    const charSnap = await getDoc(doc(db, "characters", authUser.uid));
    if (!charSnap.exists()) {
      alert("Non hai ancora una scheda personaggio! Creala nella sezione 'Scheda Personaggio'.");
      return;
    }
    const d = charSnap.data();
    const ownedTitles = getCharTitles(d);
    // Slot dei PG salvati (max 2): mostrati nella scelta classe per un caricamento rapido.
    setSavedArenaChars(Array.from({ length: SAVED_ARENA_SLOTS }, (_, i) => (Array.isArray(d.arenaSavedChars) ? (d.arenaSavedChars[i] ?? null) : null)));
    // Pre-seleziono il titolo solo se ne possiede esattamente uno (zero attrito);
    // con più titoli la scelta resta esplicita.
    setPendingTitle(ownedTitles.length === 1 ? ownedTitles[0] : null);
    setCharPreview({
      name:        d.name  || "Avventuriero",
      image:       d.image || null,
      class:       "",
      stats:       { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      arenaBuffs:  d.arenaBuffs  || {},
      arenaTitles: ownedTitles,
      // Riforma Bottega settimanale: i livelli non si comprano più — tutti i
      // personaggi sono base Lv.3 (classLevels vuoto → ogni lettura fa `?? 3`).
      classLevels: {},
      arenaSubclass: d.arenaSubclass || {},
      arenaWeekly: d.arenaWeekly || null,
      rolledHp:    null,
      hpRerollCount: 0,
    });
    setPendingStats({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
    setPendingWeapons([]);
    setPendingSpells([]);
    setPendingSkills([]);
    setPendingMarketSel({}); // Bottega: niente equipaggiato finché il player non sceglie
    setPendingSubclass(null);
    // Default: torneo. Le funzioni fun (openFunCreate/openFunAccept) sovrascrivono dopo questo.
    setLoadoutContext("tournament");
    setFunAcceptMatchId(null);
    setLoadoutPhase("class-select");
    setArenaView("join");
  };

  // ── PG salvati (2 slot) ─────────────────────────────────────────────────────
  // Il build salvato contiene classe + caratteristiche + HP tirato + loadout base
  // (armi, magie, abilità, armatura, scudo, oggetti, pet/demone/costrutto, titolo).
  // NON include gli acquisti della Bottega (settimanali, si riscelgono ogni torneo).
  const buildSavedCharPayload = () => JSON.parse(JSON.stringify({
    label:     `${charPreview.name || "PG"} · ${charPreview.class}`,
    name:      charPreview.name || "",   // serve al Master: i suoi PG hanno nomi propri
    savedAt:   new Date().toISOString(),
    class:     charPreview.class,
    stats:     { ...charPreview.stats },
    rolledHp:  charPreview.rolledHp,
    weapons:   pendingWeapons || [],
    spells:    pendingSpells || [],
    skills:    pendingSkills || [],
    armor:     pendingArmor || null,
    shield:    pendingShield || null,
    itemCounts: { ...pendingItemCounts },
    pet:       pendingPet || null,
    demon:     pendingDemon || null,
    construct: pendingConstruct || null,
    title:     pendingTitle || null,
  }));

  // Memorizza l'assetto appena confermato come "ultimo assetto" (con la Bottega
  // della settimana e la sottoclasse: valgono finché la settimana è la stessa).
  const rememberLastLoadout = (marketSel, subclassKey) => {
    if (!currentUser || !charPreview?.class || loadoutContext === "reserve") return;
    const last = {
      ...buildSavedCharPayload(),
      label: `${charPreview.name || "PG"} · ${charPreview.class}`,
      marketSel: loadoutContext === "tournament" ? [...(marketSel || [])] : [],
      subclass: subclassKey || null,
      weekKey: currentWeekKey(),
    };
    updateDoc(doc(db, "characters", authUser.uid), { arenaLastLoadout: last })
      .catch((e) => console.error("rememberLastLoadout", e));
  };

  const saveArenaCharToSlot = async (slot) => {
    if (!charPreview?.class || !charPreview?.rolledHp) { alert("Completa prima il personaggio (classe, caratteristiche e HP)."); return; }
    const missing = savedCharMissing(buildSavedCharPayload());
    if (missing.length) { alert(`Prima di salvarlo completa l'equipaggiamento di classe: manca ${missing.map((m) => m.label).join(", ")}.\n(Gli acquisti della Bottega non si salvano: si riscelgono a ogni torneo.)`); return; }
    const next = Array.from({ length: SAVED_ARENA_SLOTS }, (_, i) => savedArenaChars[i] ?? null);
    if (next[slot] && !window.confirm(`Sovrascrivere lo slot ${slot + 1} (${next[slot].label})?`)) return;
    next[slot] = buildSavedCharPayload();
    try {
      await updateDoc(doc(db, "characters", authUser.uid), { arenaSavedChars: next, arenaSavedActive: slot });
      setSavedArenaChars(next);
      setActiveSavedSlot(slot);
      alert(`✅ Personaggio salvato nello slot ${slot + 1} e selezionato.`);
    } catch (e) { console.error("saveArenaCharToSlot", e); alert("Salvataggio non riuscito."); }
  };

  const deleteSavedArenaChar = async (slot) => {
    const sc = savedArenaChars[slot];
    if (!sc || !window.confirm(`Eliminare il PG salvato nello slot ${slot + 1} (${sc.label})?`)) return;
    const next = Array.from({ length: SAVED_ARENA_SLOTS }, (_, i) => savedArenaChars[i] ?? null);
    next[slot] = null;
    const wasActive = activeSavedSlot === slot;
    try {
      await updateDoc(doc(db, "characters", authUser.uid), wasActive ? { arenaSavedChars: next, arenaSavedActive: null } : { arenaSavedChars: next });
      setSavedArenaChars(next);
      if (wasActive) setActiveSavedSlot(null);
    } catch (e) { console.error("deleteSavedArenaChar", e); }
  };

  // Seleziona UN PG salvato (tocco sulla carta). Lo stato locale cambia subito,
  // la scheda si aggiorna in background.
  const selectSavedArenaChar = (slot) => {
    if (!savedArenaChars[slot]) return;
    setActiveSavedSlot(slot);
    updateDoc(doc(db, "characters", authUser.uid), { arenaSavedActive: slot }).catch((e) => console.error("selectSavedArenaChar", e));
  };

  // Dall'ingresso del torneo: apre il loadout e ci carica dentro il PG selezionato
  // (si arriva dritti alla revisione: resta da scegliere solo la Bottega).
  const joinWithSavedChar = async (slot) => {
    const sc = savedArenaChars[slot];
    if (!sc) return;
    setMasterJoinSetup(false);
    await openLoadoutPicker();
    await loadSavedArenaChar(slot, sc);
  };

  const joinWithLastLoadout = async () => {
    if (!lastArenaLoadout) return;
    setMasterJoinSetup(false);
    await openLoadoutPicker();
    await loadSavedArenaChar(null, lastArenaLoadout);
  };
  // Riquadro "ultimo assetto usato": sempre disponibile, sopra i PG salvati.
  const renderLastLoadout = ({ useLabel, onUse }) => {
    const ll = lastArenaLoadout;
    if (!ll) return null;
    const miss = savedCharMissing(ll);
    const nMk = (ll.marketSel || []).length;
    return (
      <div className="saved-chars-block saved-last">
        <div className="hp-roll-title">↺ Ultimo assetto usato</div>
        <div className="saved-char-card saved-char-pick is-selected" style={{ "--cls": classColor(ll.class) }}>
          <div className="saved-char-slot">{ll.savedAt ? new Date(ll.savedAt).toLocaleDateString("it-IT", { day: "numeric", month: "short" }) : "Ultimo"}</div>
          <div className="saved-char-name">{ll.label}</div>
          <div className="saved-char-meta">❤ {ll.rolledHp} HP{nMk && ll.weekKey === currentWeekKey() ? ` · 🛒 ${nMk} della Bottega` : ""}</div>
          {miss.length > 0 && <div className="saved-char-warn">⚠ Da completare: {miss.map((m) => m.label).join(", ")}</div>}
        </div>
        <button className="btn-join saved-char-use" onClick={onUse}>{useLabel}</button>
      </div>
    );
  };

  // Elenco dei PG salvati a selezione singola + CTA "usa questo".
  const renderSavedPicker = ({ useLabel, onUse, hint }) => {
    const sel = savedArenaChars[activeSavedSlot] ? activeSavedSlot : null;
    const selSc = sel != null ? savedArenaChars[sel] : null;
    return (
      <div className="saved-chars-block">
        <div className="hp-roll-title">💾 I tuoi PG salvati</div>
        <div className="saved-chars-grid" role="radiogroup" aria-label="PG salvati">
          {Array.from({ length: SAVED_ARENA_SLOTS }, (_, i) => i).map(i => {
            const sc = savedArenaChars[i];
            if (!sc) return <div key={i} className="saved-char-card saved-char-empty">Slot {i + 1}<span>vuoto</span></div>;
            const miss = savedCharMissing(sc);
            const on = sel === i;
            return (
              <div key={i} className={`saved-char-card saved-char-pick${on ? " is-selected" : ""}`}
                style={{ "--cls": classColor(sc.class) }}
                role="radio" aria-checked={on} tabIndex={0}
                onClick={() => selectSavedArenaChar(i)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSavedArenaChar(i); } }}>
                <div className="saved-char-slot">{on ? "✓ Selezionato" : `Slot ${i + 1}`}</div>
                <div className="saved-char-name">{sc.label}</div>
                <div className="saved-char-meta">❤ {sc.rolledHp} HP</div>
                {miss.length > 0 && (
                  <div className="saved-char-warn" title="Salvato prima di finire l'equipaggiamento: caricalo e completalo, poi risalvalo">⚠ Da completare: {miss.map((m) => m.label).join(", ")}</div>
                )}
                <div className="saved-char-actions">
                  <button className="saved-char-del" title="Elimina" onClick={(e) => { e.stopPropagation(); deleteSavedArenaChar(i); }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn-join saved-char-use" disabled={!selSc} onClick={() => onUse(sel)}>
          {selSc ? `${useLabel} · ${selSc.label}` : "Tocca un PG per selezionarlo"}
        </button>
        {hint && <div className="saved-chars-hint">{hint}</div>}
      </div>
    );
  };

  // Carica un PG salvato: identità (nome/immagine/buff/titoli/Bottega) sempre dalla
  // scheda attuale; build (classe/stat/HP/loadout) dallo slot. Salta la creazione.
  const loadSavedArenaChar = async (slot, scArg) => {
    const sc = scArg || savedArenaChars[slot];
    if (!sc) return;
    let base = {};
    try { const cs = await getDoc(doc(db, "characters", authUser.uid)); if (cs.exists()) base = cs.data(); } catch { /* ignore */ }
    const ownedTitles = getCharTitles(base);
    // Il Master entra coi nomi dei suoi PG (non con quello della sua scheda);
    // i salvataggi senza `name` lo ricavano dall'etichetta "Nome · Classe".
    const masterName = isMaster ? (sc.name || String(sc.label || "").split(" · ")[0] || "").trim() : "";
    setCharPreview({
      name:        masterName || base.name || "Avventuriero",
      image:       isMaster ? null : (base.image || null),
      class:       sc.class,
      stats:       { ...(sc.stats || {}) },
      arenaBuffs:  base.arenaBuffs || {},
      arenaTitles: ownedTitles,
      classLevels: {},
      arenaSubclass: base.arenaSubclass || {},
      arenaWeekly: base.arenaWeekly || null,
      rolledHp:    sc.rolledHp ?? null,
      hpRerollCount: 99,   // HP salvato: niente re-roll
    });
    setPendingStats({ ...(sc.stats || {}) });
    setPendingWeapons(sc.weapons || []);
    setPendingSpells(sc.spells || []);
    setPendingSkills(sc.skills || []);
    setPendingArmor(sc.armor || null);
    setPendingShield(sc.shield || null);
    setPendingItemCounts({ pozione_cura: 0, bomba: 0, pozione_veleno: 0, ...(sc.itemCounts || {}) });
    setPendingPet(sc.pet || null);
    setPendingDemon(sc.demon || null);
    setPendingConstruct(sc.construct || null);
    setPendingTitle((sc.title && ownedTitles.includes(sc.title)) ? sc.title : null);
    // Bottega e sottoclasse: si rimettono solo se l'assetto è di QUESTA settimana
    // e gli acquisti ci sono ancora (i PG salvati a mano non li hanno: si riscelgono).
    const sameWeek = sc.weekKey && sc.weekKey === currentWeekKey()
      && base.arenaWeekly?.weekKey === currentWeekKey();
    const ownedIds = new Set(sameWeek ? (base.arenaWeekly.purchases || []).map((pu) => pu.itemId) : []);
    const selInit = {};
    (sc.marketSel || []).forEach((id) => { if (ownedIds.has(id)) selInit[id] = true; });
    setPendingMarketSel(selInit);
    setPendingSubclass(sameWeek && sc.subclass ? sc.subclass : null);
    // Il contesto resta quello da cui si è partiti: caricare un PG salvato dentro
    // una Sfida Libera (anche accettandola) non deve iscrivere al torneo.
    setLoadoutContext((c) => (c === "fun" ? "fun" : "tournament"));
    setReloadoutMode(false);
    // Salvataggio vecchio incompleto: si apre dritto sulla scheda che manca.
    setLoadoutTab(savedCharMissing(sc)[0]?.tab || "weapons");
    setLoadoutPhase("selecting");
  };

  // ── PG di Riserva del Master (4 slot) ───────────────────────────────────────
  // Bot completi pronti a entrare quando gli iscritti sono dispari. Vengono creati
  // con lo stesso flusso di loadout dei giocatori (classe → stat → HP → equip), poi
  // salvati come snapshot IA-ready in arena_meta.masterReserves.
  const masterReserves = arenaMeta?.masterReserves || [];

  // Apre il flusso di creazione loadout in modalità "riserva" per lo slot indicato.
  const openReserveCreate = async (slot) => {
    await openLoadoutPicker();               // imposta lo stato base + context "tournament"
    setLoadoutContext("reserve");            // sovrascrive: siamo in creazione riserva
    setReserveSlotTarget(slot);
    // Il bot non usa titoli/Bottega: nome generico, portrait vuoto (lo si rinomina al salvataggio).
    setCharPreview(prev => prev ? { ...prev, name: "🎭 Campione di Riserva", image: null, arenaTitles: [] } : prev);
    setPendingTitle(null);
  };

  // Costruisce lo snapshot IA-ready dal loadout corrente (senza acquisti Bottega:
  // i bot non fanno shopping). Rispecchia la costruzione snapshot di confirmJoin.
  const buildReserveSnapshot = (name) => {
    const cls = (charPreview.class || "").toLowerCase();
    const config = getLoadoutConfig(charPreview.class, charPreview.classLevels?.[getClassKey(charPreview.class)]);
    const dexMod = charPreview.stats.dex ?? 0;
    const conMod = charPreview.stats.con ?? 0;
    const shieldBonus = pendingShield ? 2 : 0;
    const armorBuffBonus = charPreview.arenaBuffs?.armorBonus ? 1 : 0;
    const unarmoredBonus = pendingArmor?.unarmoredStat ? (charPreview.stats[pendingArmor.unarmoredStat] ?? 0) : conMod;
    const finalAc = pendingArmor.unarmoredDefense
      ? (pendingArmor.unarmoredMaxStat
          ? 10 + Math.max(conMod, dexMod) + shieldBonus + armorBuffBonus
          : 10 + dexMod + unarmoredBonus + shieldBonus + armorBuffBonus)
      : pendingArmor.baseAc + Math.max(0, Math.min(dexMod, pendingArmor.maxDex)) + shieldBonus + armorBuffBonus;
    const chaScore  = charPreview.stats.cha ?? 0;
    const charLevel = charPreview.classLevels?.[getClassKey(charPreview.class)] ?? 3;
    const petAction       = (isRangerClass(cls) && pendingPet && RANGER_PETS[pendingPet]) ? RANGER_PETS[pendingPet].action : null;
    const demonAction     = (isWarlockClass(cls) && pendingDemon && WARLOCK_DEMONS[pendingDemon]) ? WARLOCK_DEMONS[pendingDemon].action : null;
    const constructAction = (isArtificerClass(cls) && pendingConstruct && ARTIFICER_CONSTRUCTS[pendingConstruct]) ? ARTIFICER_CONSTRUCTS[pendingConstruct].action : null;
    const finalActions = [
      ...pendingWeapons, ...pendingSpells, ...pendingSkills,
      ...config.autoActions
        .filter(a => !a.requiresBuff || ((charPreview.arenaBuffs || {})[a.requiresBuff] ?? 0) > 0)
        .map(a => scaleActionForLevel(a, charLevel, chaScore)),
      ...(petAction ? [petAction] : []),
      ...(demonAction ? [demonAction] : []),
      ...(constructAction ? [constructAction] : []),
    ];
    const selectedItemKeys = Object.entries(pendingItemCounts)
      .flatMap(([k, n]) => Array(n).fill(k))
      .filter(k => !ARENA_ITEMS.find(i => i.key === k)?.shopOnly);
    return JSON.parse(JSON.stringify({
      name,
      image:           null,
      class:           charPreview.class,
      classLevels:     charPreview.classLevels || {},
      subclass:        null,
      stats:           { ...charPreview.stats, maxHp: charPreview.rolledHp, ac: finalAc },
      selectedActions: finalActions,
      hasWildShape:    config.hasWildShape,
      hasShield:       pendingShield,
      selectedArmor:   pendingArmor,
      selectedItemKeys,
      arenaBuffs:      {},
      titles:          [],
      selectedPet:     petAction ? pendingPet : null,
      selectedDemon:   demonAction ? pendingDemon : null,
      selectedConstruct: constructAction ? pendingConstruct : null,
      marketConsumables: [],
      marketResist:    {},
      isAi:            true,
      aiArchetype:     ARENA_ARCHETYPE_BY_CLASS[cls] || "fighter-plate",
      label:           `${name} · ${charPreview.class}`,
      rolledHp:        charPreview.rolledHp,
    }));
  };

  const saveReserveToSlot = async () => {
    if (reserveSlotTarget == null) return;
    if (!charPreview?.class || !charPreview?.rolledHp || !pendingArmor) {
      alert("Completa prima il PG (classe, caratteristiche, HP e un'armatura).");
      return;
    }
    const totalItems = Object.values(pendingItemCounts).reduce((a, b) => a + b, 0);
    if (totalItems < 1) { alert("Serve almeno un oggetto."); return; }
    const defName = charPreview.name && charPreview.name !== "🎭 Campione di Riserva" ? charPreview.name : `Riserva ${reserveSlotTarget + 1}`;
    const name = (window.prompt("Nome del PG di Riserva (bot):", defName) || defName).trim();
    const next = Array.from({ length: MASTER_RESERVE_SLOTS }, (_, i) => masterReserves[i] ?? null);
    next[reserveSlotTarget] = buildReserveSnapshot(name);
    try {
      await updateDoc(doc(db, "arena_meta", "global"), { masterReserves: next });
      alert(`✅ PG di Riserva salvato nello slot ${reserveSlotTarget + 1}.`);
      setReserveSlotTarget(null);
      cancelLoadout();
    } catch (e) { console.error("saveReserveToSlot", e); alert("Salvataggio non riuscito."); }
  };

  // Il Master entra nel torneo con un PG di Riserva: lo snapshot del bot viene
  // riaperto nel loadout (armi/magie/abilità ricavate dalle azioni salvate per
  // nome; le automatiche di classe e i compagni si ricostruiscono da soli),
  // così si rivede, si sceglie la Bottega e si conferma come un'iscrizione normale.
  const enterWithReserve = async (slot) => {
    const r = masterReserves[slot];
    if (!r) return;
    setMasterJoinSetup(false);
    await openLoadoutPicker();
    let base = {};
    try { const cs = await getDoc(doc(db, "characters", authUser.uid)); if (cs.exists()) base = cs.data(); } catch { /* ignore */ }
    const config = getLoadoutConfig(r.class, undefined);
    const acts = r.selectedActions || [];
    const pickFrom = (opts) => {
      const names = new Set((opts || []).map((o) => o.name));
      return acts.filter((a) => names.has(a.name));
    };
    const { maxHp, ac: _ac, ...stats } = r.stats || {};
    const itemCounts = { pozione_cura: 0, bomba: 0, pozione_veleno: 0 };
    (r.selectedItemKeys || []).forEach((k) => { itemCounts[k] = (itemCounts[k] || 0) + 1; });
    setCharPreview({
      name:        r.name || `Riserva ${slot + 1}`,
      image:       null,
      class:       r.class,
      stats:       { ...stats },
      arenaBuffs:  base.arenaBuffs || {},
      arenaTitles: getCharTitles(base),
      classLevels: {},
      arenaSubclass: base.arenaSubclass || {},
      arenaWeekly: base.arenaWeekly || null,
      rolledHp:    r.rolledHp ?? maxHp ?? null,
      hpRerollCount: 99,
    });
    setPendingStats({ ...stats });
    setPendingWeapons(pickFrom(config?.weaponOptions));
    setPendingSpells(pickFrom(config?.spellOptions));
    setPendingSkills(pickFrom(config?.skillOptions));
    setPendingArmor(r.selectedArmor || null);
    setPendingShield(!!r.hasShield);
    setPendingItemCounts(itemCounts);
    setPendingPet(r.selectedPet || null);
    setPendingDemon(r.selectedDemon || null);
    setPendingConstruct(r.selectedConstruct || null);
    setPendingTitle(null);
    setPendingMarketSel({});
    setLoadoutContext("tournament");
    setReloadoutMode(false);
    setLoadoutTab("weapons");
    setLoadoutPhase("selecting");
  };

  const deleteReserve = async (slot) => {
    const r = masterReserves[slot];
    if (!r || !window.confirm(`Eliminare il PG di Riserva nello slot ${slot + 1} (${r.label || r.name})?`)) return;
    const next = Array.from({ length: MASTER_RESERVE_SLOTS }, (_, i) => masterReserves[i] ?? null);
    next[slot] = null;
    try {
      await updateDoc(doc(db, "arena_meta", "global"), { masterReserves: next });
    } catch (e) { console.error("deleteReserve", e); }
  };

  // Ri-equipaggiamento durante la finestra di shopping (torneo in corso).
  // Classe, caratteristiche e HP restano BLOCCATI dal torneo: si ripescano
  // dallo snapshot esistente; si possono ricomprare/riequipaggiare armi, magie,
  // oggetti e acquisti della Bottega per il round successivo.
  const openReloadout = async () => {
    const snap = arenaMeta?.characterSnapshots?.[currentUser.uid];
    if (!snap) { alert("Non risulti iscritto al torneo in corso."); return; }
    if (reloadoutBlockReason(arenaMeta, currentUser.uid) === "fighting") { alert("Il tuo match è in corso: potrai cambiare assetto a fine fight."); return; }
    setCombatModalOpen(false);
    let arenaWeekly = null, ownedTitles = [];
    try {
      const cs = await getDoc(doc(db, "characters", authUser.uid));
      if (cs.exists()) { const d = cs.data(); arenaWeekly = d.arenaWeekly || null; ownedTitles = getCharTitles(d); }
    } catch { /* ignore */ }
    setCharPreview({
      name: snap.name, image: snap.image || null,
      class: snap.class,
      stats: { ...(snap.stats || {}) },     // caratteristiche bloccate
      arenaBuffs: snap.arenaBuffs || {},
      arenaTitles: ownedTitles,
      classLevels: snap.classLevels || {},
      arenaSubclass: {},
      arenaWeekly,
      rolledHp: snap.stats?.maxHp ?? null,   // HP bloccato dal torneo
      hpRerollCount: 99,
    });
    // L'assetto SALVATO si riapre già compilato (armi, magie, armatura, oggetti,
    // compagno, Bottega): si cambia solo quello che si vuole. Le opzioni si
    // ripescano per nome dalle azioni dello snapshot, come per le riserve.
    const cfg = getLoadoutConfig(snap.class, snap.classLevels?.[getClassKey(snap.class)]);
    const actNames = new Set((snap.selectedActions || []).map(a => a.name));
    const pickFrom = (opts) => (opts || []).filter(o => actNames.has(o.name));
    const itemCounts = { pozione_cura: 0, bomba: 0, pozione_veleno: 0 };
    (snap.selectedItemKeys || []).forEach(k => { itemCounts[k] = (itemCounts[k] || 0) + 1; });
    const owned = (arenaWeekly && arenaWeekly.weekKey === currentWeekKey()) ? (arenaWeekly.purchases || []) : [];
    const savedSel = Array.isArray(snap.loadoutMarketSel)
      ? new Set(snap.loadoutMarketSel)
      : new Set(owned.filter(pu => {   // snapshot di prima: si ricava da quello che aveva addosso
          if (actNames.has(pu.name)) return true;
          if ((snap.marketConsumables || []).some(c => c.key === `mk_${pu.itemId}`)) return true;
          if (pu.category === "armor") return !snap.selectedArmor;
          const res = Object.keys(pu.payload?.resist || {});
          return pu.category === "item" && res.length > 0 && res.every(t => snap.marketResist?.[t]);
        }).map(pu => pu.itemId));
    const marketSelInit = {};
    owned.forEach(pu => { if (savedSel.has(pu.itemId)) marketSelInit[pu.itemId] = true; });
    setPendingStats({ ...(snap.stats || {}) });
    setPendingWeapons(pickFrom(cfg?.weaponOptions));
    setPendingSpells(pickFrom(cfg?.spellOptions));
    setPendingSkills(pickFrom(cfg?.skillOptions));
    setPendingArmor(snap.selectedArmor || null);
    setPendingShield(snap.hasShield || null);
    setPendingItemCounts(itemCounts);
    setPendingMarketSel(marketSelInit);
    setPendingTitle((snap.titles && snap.titles[0]) || null);
    setPendingPet(snap.selectedPet || null);
    setPendingDemon(snap.selectedDemon || null);
    setPendingConstruct(snap.selectedConstruct || null);
    // Sottoclasse: resta quella dell'assetto; se l'ha comprata dopo e non l'ha
    // rifiutata gliela proponiamo già accesa. Può spegnerla.
    setPendingSubclass(snap.subclass || (snap.subclassDeclined ? null : ownedSubclassKey(arenaWeekly, snap.class)));
    setLoadoutTab("weapons");
    setLoadoutContext("tournament");
    setReloadoutMode(true);
    setLoadoutPhase("selecting");
    setArenaView("join");
  };

  // ── STEP 3: tira HP (+CON per dado) ──────────────────────────────────────
  const rollHp = () => {
    const { count, sides } = getHpDice(charPreview.class, charPreview.classLevels);
    const conMod = charPreview.stats.con ?? 0;
    let total = 0;
    for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
    total += conMod * count;
    setCharPreview(prev => ({ ...prev, rolledHp: Math.max(1, total), hpRerollCount: (prev.hpRerollCount || 0) + 1 }));
  };

  // ── STEP 3: conferma iscrizione ───────────────────────────────────────────
  const confirmJoin = async () => {
    const rawConfig = getLoadoutConfig(charPreview.class, charPreview.classLevels?.[getClassKey(charPreview.class)]);

    // ── Bottega settimanale: gli acquisti valgono SOLO nei tornei (le Sfide
    // Libere e i match AI restano col kit base, come i titoli) e SOLO se il
    // giocatore li ha scelti nel loadout (default: nessuno equipaggiato). ──
    const marketSel  = new Set(Object.keys(pendingMarketSel).filter(k => pendingMarketSel[k]));
    const marketGear = loadoutContext === "tournament" ? resolveMarketGear(charPreview.arenaWeekly, marketSel) : null;
    const marketHasWeapon = (marketGear?.actions || []).some(a => a.type === "weapon");
    const marketFixedAc = marketGear?.fixedAc ?? null;   // armatura Bottega = CA fissa
    // Spell scroll equipaggiati (solo torneo): tolgono spell slot di classe.
    const scrollLoss = loadoutContext === "tournament"
      ? scrollSlotLossFor(charPreview.arenaWeekly?.purchases, marketSel) : {};
    const config = applySlotLoss(rawConfig, scrollLoss);

    // Basta almeno un'arma per proseguire (il massimo — es. 2 — è un tetto, non un obbligo:
    // un'arma a due mani è esclusiva e ne occupa una sola). Anche un'arma comprata conta.
    if (config.maxWeapons > 0 && pendingWeapons.length < 1 && !marketHasWeapon) return;
    if (pendingSpells.length  < config.maxSpells)  return;
    if (!charPreview.rolledHp) return;
    if (!pendingArmor && marketFixedAc == null) return; // serve un'armatura (base o Bottega)
    // Gli oggetti comprati alla Bottega contano come oggetti (occupano gli slot):
    // valgono anche per il minimo "almeno 1 oggetto".
    const marketItemCount = loadoutContext === "tournament"
      ? (charPreview.arenaWeekly?.purchases || []).filter(p => marketSel.has(p.itemId) && p.category === "item").length
      : 0;
    const totalItemsJoin = Object.values(pendingItemCounts).reduce((a, b) => a + b, 0) + marketItemCount;
    if (totalItemsJoin < 1) return;

    // Calcolo CA finale: base + DES (cappato) + scudo; se senza armatura (barbaro): 10+DES+COS
    const dexMod    = charPreview.stats.dex ?? 0;
    const conMod    = charPreview.stats.con ?? 0;
    const shieldBonus = pendingShield ? 2 : 0;
    const armorBuffBonus = charPreview.arenaBuffs?.armorBonus ? 1 : 0;
    // Sottoclassi RITIRATE con la riforma Bottega settimanale: il kit base è la
    // sola classe Lv.3, ogni bonus arriva dagli acquisti in vetrina. Forzare
    // null qui spegne tutti gli effetti (getSubclassEffect legge snap.subclass).
    // Sottoclassi della Bottega (2026-10-10): valgono solo nei tornei e solo se
    // comprate questa settimana per QUESTA classe.
    const subclassKey = (pendingSubclass && selectableSubclasses(loadoutContext, charPreview.arenaWeekly, charPreview.class)
      .some(o => o.key === pendingSubclass)) ? pendingSubclass : null;
    const subclassDef = subclassKey ? getSubclassDef(getClassKey(charPreview.class), subclassKey) : null;
    const subclassCa  = subclassDef?.effect?.ca || 0;
    // Armatura della Bottega: CA FISSA al posto dell'armatura base (niente DES,
    // scudo o buff di armatura). La sottoclasse invece è una passiva del PG e si
    // somma SEMPRE (prima con l'armatura della Bottega il suo +1 spariva).
    const unarmoredBonus = pendingArmor?.unarmoredStat ? (charPreview.stats[pendingArmor.unarmoredStat] ?? 0) : conMod;
    const finalAc   = subclassCa + (marketGear?.acBonus || 0) + (marketFixedAc != null
      ? marketFixedAc
      : (pendingArmor.unarmoredDefense
        ? pendingArmor.unarmoredMaxStat
          ? 10 + Math.max(conMod, dexMod) + shieldBonus + armorBuffBonus
          : 10 + dexMod + unarmoredBonus + shieldBonus + armorBuffBonus
        : pendingArmor.baseAc + Math.max(0, Math.min(dexMod, pendingArmor.maxDex)) + shieldBonus + armorBuffBonus));

    const chaScore = charPreview.stats.cha ?? 0;
    const cls = (charPreview.class || "").toLowerCase();
    const petAction = (isRangerClass(cls) && pendingPet && RANGER_PETS[pendingPet]) ? RANGER_PETS[pendingPet].action : null;
    const demonAction = (isWarlockClass(cls) && pendingDemon && WARLOCK_DEMONS[pendingDemon]) ? WARLOCK_DEMONS[pendingDemon].action : null;
    const constructAction = (isArtificerClass(cls) && pendingConstruct && ARTIFICER_CONSTRUCTS[pendingConstruct]) ? ARTIFICER_CONSTRUCTS[pendingConstruct].action : null;
    // Scaling per livello di cariche/danno delle abilità automatiche (Smite,
    // Attacco Furtivo, Marchio, Carica, Disarmare, Turbine, Concentrazione…):
    // senza questo chi compra i livelli paga potenziamenti pubblicizzati nel
    // mercato che non arrivavano mai. Vedi scaleActionForLevel.
    const charLevel = charPreview.classLevels?.[getClassKey(charPreview.class)] ?? 3;
    const finalActions = [
      ...pendingWeapons, ...pendingSpells, ...pendingSkills,
      ...config.autoActions
        .filter(a => !a.requiresBuff || ((charPreview.arenaBuffs || {})[a.requiresBuff] ?? 0) > 0)
        .map(a => scaleActionForLevel(a, charLevel, chaScore)),
      ...(petAction ? [petAction] : []),
      ...(demonAction ? [demonAction] : []),
      ...(constructAction ? [constructAction] : []),
    ];
    // Abilità della sottoclasse (passive descrittive + azioni attive).
    (subclassDef?.actions || []).forEach(a => {
      if (!finalActions.some(b => b.name === a.name)) finalActions.push({ ...a, fromSubclass: true });
    });
    // Azioni della Bottega settimanale (spell/armi/buff/pet acquistati): niente
    // doppioni per nome (una spell già selezionata non viene aggiunta due volte).
    (marketGear?.actions || []).forEach(a => {
      if (!finalActions.some(b => b.name === a.name)) finalActions.push(a);
    });
    const selectedItemKeys = Object.entries(pendingItemCounts)
      .flatMap(([k, n]) => Array(n).fill(k))
      .filter(k => !ARENA_ITEMS.find(i => i.key === k)?.shopOnly);
    const snapshot = {
      name:            charPreview.name,
      image:           charPreview.image,
      class:           charPreview.class,
      classLevels:     charPreview.classLevels || {},
      subclass:        subclassKey,
      subclassName:    subclassDef?.name || null,
      subclassIcon:    subclassDef?.icon || null,
      // CA che la sottoclasse ha sommato davvero (anche sopra l'armatura della Bottega)
      subclassAc:      subclassCa,
      // Sottoclasse posseduta ma spenta di proposito al loadout: ArenaSubclassOffer
      // non chiede più di equipaggiarla (resta sceglibile nelle pause Bottega).
      subclassDeclined: (!subclassKey && ownedSubclassKey(charPreview.arenaWeekly, charPreview.class)) || null,
      stats:           { ...charPreview.stats, maxHp: charPreview.rolledHp, ac: finalAc },
      selectedActions: finalActions,
      hasWildShape:    config.hasWildShape,
      hasShield:       pendingShield,
      selectedArmor:   pendingArmor,
      selectedItemKeys,
      arenaBuffs:      charPreview.arenaBuffs || {},
      // Un solo titolo "indossato", scelto dal giocatore all'iscrizione al torneo.
      // Nelle Sfide Libere i titoli non danno bonus (sono solo per il torneo).
      titles:          (loadoutContext === "tournament" && pendingTitle) ? [pendingTitle] : [],
      selectedPet:     petAction ? pendingPet : null,
      selectedDemon:   demonAction ? pendingDemon : null,
      selectedConstruct: constructAction ? pendingConstruct : null,
      // Consumabili della Bottega settimanale (solo torneo): definizioni portate
      // nello snapshot così il fight li risolve senza dipendere dal catalogo.
      marketConsumables: marketGear?.consumables || [],
      // Resistenze per tipo di danno (armature/oggetti della Bottega, solo torneo):
      // { [tipoDanno]: "resist" | "immune" | "vuln" }. Lette in applyTypedDamage.
      marketResist: marketGear?.resist || {},
      // Spine dell'armatura della Bottega (dadi di ritorno a chi colpisce in mischia).
      marketRetaliate: marketGear?.retaliate || null,
      // Acquisti della Bottega scelti (solo torneo): il ri-equipaggiamento li
      // ripropone già accesi, così l'assetto resta quello dell'ultima volta.
      loadoutMarketSel: loadoutContext === "tournament" ? [...marketSel] : [],
      // Acquisti già visti al momento del salvataggio: il popup avvisa solo dei NUOVI.
      loadoutSeenIds: loadoutContext === "tournament" && charPreview.arenaWeekly?.weekKey === currentWeekKey()
        ? (charPreview.arenaWeekly.purchases || []).map(pu => pu.itemId) : [],
    };

    // ── Branch: ri-equipaggiamento tra i round (torneo in corso) ───────────
    // Aggiorna lo snapshot del partecipante: i round successivi si costruiscono
    // da lì, quindi il nuovo assetto vale da solo per tutti i prossimi match.
    // Ricostruisce anche il suo posto nel round in coda e nel match del round
    // già uscito ma non ancora partito (in attesa di «Iniziamo»).
    if (reloadoutMode) {
      try {
        await runTransaction(db, async (tx) => {
          const ref = doc(db, "arena_meta", "global");
          const s = await tx.get(ref);
          if (!s.exists()) return;
          const d = s.data();
          const uid = currentUser.uid;
          if (reloadoutBlockReason(d, uid)) throw new Error("arena-reloadout-locked");
          const mergedSnaps = { ...(d.characterSnapshots || {}), [uid]: snapshot };
          const swapMe = (m) => ({ ...m, players: m.players.map(p => p.id === uid ? buildPlayerForMatch(uid, mergedSnaps) : p) });
          const isMine = (m) => (m.players || []).some(p => p.id === uid);
          const updates = { [`characterSnapshots.${uid}`]: snapshot };
          if (Array.isArray(d.pendingNextMatches) && d.pendingNextMatches.length) {
            updates.pendingNextMatches = d.pendingNextMatches.map(m => isMine(m) ? swapMe(m) : m);
          }
          const ms = d.matches || [];
          if (ms.some(m => m.kind !== "fun" && isMine(m) && isAwaitingReady(m))) {
            updates.matches = ms.map(m => (m.kind !== "fun" && isMine(m) && isAwaitingReady(m)) ? swapMe(m) : m);
          }
          tx.update(ref, updates);
        });
      } catch (e) {
        if (e?.message === "arena-reloadout-locked") alert("⚠ Il tuo match è già iniziato: il nuovo assetto si potrà montare dopo il fight.");
        else { console.error("Errore ri-equipaggiamento:", e); alert("⚠ Non sono riuscito a salvare l'assetto. Riprova."); }
        return;
      }
      rememberLastLoadout(marketSel, subclassKey);
      cancelLoadout();
      return;
    }

    // ── Branch: Arena Libera (Sfida) ──────────────────────────────────────
    if (loadoutContext === "fun") {
      // Bug-guard: un partecipante al torneo non può creare/accettare sfide libere,
      // perché la registrazione fun sovrascriverebbe characterSnapshots[uid] e
      // cambierebbe la sua classe nei prossimi round del torneo.
      const inTournament =
        (arenaMeta?.participants || []).includes(currentUser.uid) ||
        (arenaMeta?.matches || []).some(
          m => m.kind !== "fun" && m.status !== "finished" &&
               (m.players || []).some(p => p.id === currentUser.uid)
        );
      if (inTournament) {
        alert("⚠ Sei iscritto a un torneo in corso. Non puoi creare o accettare Sfide Libere finché il torneo non termina (non puoi cambiare classe a torneo iniziato).");
        cancelLoadout();
        return;
      }
      const baseHp = snapshot.stats.maxHp;
      const itemUses = {};
      (snapshot.selectedItemKeys || []).forEach(k => { itemUses[k] = (itemUses[k] || 0) + 1; });
      const shopPotions = snapshot.arenaBuffs?.healingPotions ?? 0;
      if (shopPotions > 0) itemUses["pozione_cura_media"] = shopPotions;
      const layOfHandsPool = isPaladinClass((snapshot.class || "").toLowerCase()) ? Math.floor(baseHp / 3) : 0;
      // class embedded così le statistiche fun sopravvivono all'overwrite di characterSnapshots
      const playerObj = {
        id: currentUser.uid,
        name: snapshot.name || "?",
        class: (snapshot.class || "").toLowerCase().trim(),
        hp: baseHp, maxHp: baseHp, init: 0,
        itemUsesLeft: itemUses,
        layOfHandsPool,
      };

      if (aiMatchPending) {
        // ── SFIDA L'IA: crea un match già pronto al lancio (initiative).
        const matchId = `FUN_AI_${Date.now()}_${currentUser.uid}`;
        const { aiUid, snapshot: aiSnap, playerObj: aiPlayerObj, archetype } = makeAiSnapshotAndPlayer(matchId);
        const newMatch = withReadyCheck({
          matchId,
          kind: "fun",
          ai: true,
          aiOwnerId: currentUser.uid,
          aiId: aiUid,
          aiArchetype: archetype,
          challengerId: currentUser.uid,
          opponentId: aiUid,
          players: [playerObj, aiPlayerObj],
          status: "initiative",
          turn: null,
          turnExpiry: new Date(arenaNow() + ARENA_INITIATIVE_DURATION).toISOString(),
          logs: [
            `🛡 ${snapshot.name || "?"} sfida ${aiSnap.name} — Hard Mode AI.`,
            `⚡ Tirate iniziativa.`,
          ],
          winner: null,
          participantsAwarded: [],
          isFFA: false,
          createdAt: new Date().toISOString(),
        });
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: [...(arenaMeta.matches || []), newMatch],
          [`characterSnapshots.${currentUser.uid}`]: snapshot,
          [`characterSnapshots.${aiUid}`]: aiSnap,
        });
        cancelLoadout();
        return;
      }

      if (funAcceptMatchId) {
        // ACCETTA sfida esistente: aggiungo come secondo giocatore + parte iniziativa.
        const targetMatch = (arenaMeta.matches || []).find(m => m.matchId === funAcceptMatchId);
        if (!targetMatch || targetMatch.status !== "open") {
          alert("⚠ La sfida non è più disponibile.");
          cancelLoadout();
          return;
        }
        const updatedMatches = (arenaMeta.matches || []).map(m => {
          if (m.matchId !== funAcceptMatchId) return m;
          return withReadyCheck({
            ...m,
            opponentId: currentUser.uid,
            players: [...(m.players || []), playerObj],
            status: "initiative",
            turn: null,
            turnExpiry: null,
            logs: [...(m.logs || []), `⚔ ${snapshot.name || "?"} accetta la sfida!`],
          });
        });
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: updatedMatches,
          [`characterSnapshots.${currentUser.uid}`]: snapshot,
        });
      } else {
        // CREA nuova sfida aperta.
        const newMatch = {
          matchId: `FUN_${Date.now()}_${currentUser.uid}`,
          kind: "fun",
          challengerId: currentUser.uid,
          opponentId: null,
          players: [playerObj],
          status: "open",
          turn: null,
          turnExpiry: null,
          logs: [`🛡 ${snapshot.name || "?"} ha aperto una Sfida Libera. In attesa di un avversario…`],
          winner: null,
          participantsAwarded: [],
          isFFA: false,
          createdAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: [...(arenaMeta.matches || []), newMatch],
          [`characterSnapshots.${currentUser.uid}`]: snapshot,
        });
      }
      cancelLoadout();
      return;
    }

    // (Le fasce di livello non esistono più: tutti combattono base Lv.3.)
    if (arenaMeta?.championsOnly) {
      const isChampion = tournamentHistory.some(t => t.winnerId === currentUser.uid);
      if (!isChampion) {
        alert("⚠ Questo è un torneo Solo Campioni: solo chi ha già vinto un torneo può iscriversi.");
        return;
      }
    }

    // Iscrizione in TRANSAZIONE: un account = un posto. Prima bastava avere il
    // form aperto (altra scheda, o approvazione del Master arrivata durante il
    // loadout) per finire sia fra gli iscritti sia di nuovo in lista d'attesa,
    // riscrivendo anche lo snapshot già approvato (Lael, 2026-10-04).
    // Il Master può iscrivere più PG (per riempire il torneo quando manca gente):
    // ognuno prende il primo posto libero fra "<uid>", "<uid>__ALT2", "<uid>__ALT3"…
    let entryId = currentUser.uid;
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "arena_meta", "global");
        const cur = (await tx.get(ref)).data() || {};
        if (cur.phase && cur.phase !== "registration") throw new Error("registration-closed");
        if (isMaster) {
          const taken = new Set([...(cur.participants || []), ...(cur.waitingList || [])]);
          entryId = masterEntryIds(authUser.uid).find((id) => !taken.has(id));
          if (!entryId) throw new Error("master-full");
        } else if ((cur.participants || []).includes(currentUser.uid)) throw new Error("already-registered");
        tx.update(ref, {
          waitingList: arrayUnion(entryId),
          [`characterSnapshots.${entryId}`]: snapshot,
        });
      });
    } catch (e) {
      if (e.message === "master-full") alert(`⚠ Hai già ${MASTER_ALT_MAX} PG iscritti: è il massimo.`);
      else if (e.message === "already-registered") alert("⚠ Sei già iscritto a questo torneo: non puoi iscriverti una seconda volta.");
      else if (e.message === "registration-closed") alert("⚠ Le iscrizioni al torneo sono chiuse.");
      else alert("⚠ Iscrizione non riuscita: " + e.message);
      cancelLoadout();
      return;
    }
    rememberLastLoadout(marketSel, subclassKey);
    cancelLoadout();
  };

  const cancelLoadout = () => {
    setLoadoutPhase("idle");
    setCharPreview(null);
    setPendingStats({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
    setPendingWeapons([]);
    setPendingSpells([]);
    setPendingSkills([]);
    setPendingArmor(null);
    setPendingShield(null);
    setPendingPet(null);
    setPendingDemon(null);
    setPendingConstruct(null);
    setPendingItemCounts({ pozione_cura: 0, bomba: 0, pozione_veleno: 0 });
    setPendingTitle(null);
    setLoadoutTab("weapons");
    setLoadoutContext("tournament");
    setReloadoutMode(false);
    setFunAcceptMatchId(null);
    setAiMatchPending(false);
    setReserveSlotTarget(null);
    setArenaView("hub");
  };

  // ── ARENA LIBERA: open/cancel/abandon ─────────────────────────────────────
  // L'Arena Libera è sempre disponibile, anche per chi è iscritto al torneo.
  const openFunCreate = async () => {
    await openLoadoutPicker();
    // Sovrascrivo il default "tournament" impostato da openLoadoutPicker.
    setLoadoutContext("fun");
    setFunAcceptMatchId(null);
    setAiMatchPending(false);
  };

  // Solo-vs-AI: stesso loadout della Sfida Libera, ma genera un avversario
  // gestito dal client. L'IA prende decisioni di combattimento sul tuo
  // browser quando è il suo turno.
  const openAiCreate = async () => {
    await openLoadoutPicker();
    setLoadoutContext("fun");
    setFunAcceptMatchId(null);
    setAiMatchPending(true);
  };

  const openFunAccept = async (matchId) => {
    const target = (arenaMeta?.matches || []).find(m => m.matchId === matchId);
    if (!target || target.status !== "open") { alert("Sfida non più disponibile."); return; }
    if (target.challengerId === currentUser?.uid) { alert("Non puoi accettare la tua stessa sfida."); return; }
    await openLoadoutPicker();
    setLoadoutContext("fun");
    setFunAcceptMatchId(matchId);
  };

  /* Auto-scroll to the loadout panel when it opens for an Arena Libera
     create/accept. Without this, players get stuck staring at the
     unchanged screen because the panel renders far below the fold.
     We only scroll on the *initial* open (idle → class-select) so the
     view doesn't jump every time the user advances a step. */
  const prevLoadoutPhaseRef = useRef("idle");
  useEffect(() => {
    const prev = prevLoadoutPhaseRef.current;
    prevLoadoutPhaseRef.current = loadoutPhase;
    if (loadoutContext !== "fun") return;
    if (!(prev === "idle" && loadoutPhase !== "idle")) return;
    // Wait two frames so the panel is mounted + painted before scrolling.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = document.getElementById("arena-loadout");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [loadoutPhase, loadoutContext]);

  const cancelFunChallenge = async (matchId) => {
    const m = (arenaMeta?.matches || []).find(x => x.matchId === matchId);
    if (!m || m.kind !== "fun" || m.status !== "open") return;
    if (m.challengerId !== currentUser?.uid && !isMaster) return;
    const updatedMatches = (arenaMeta.matches || []).filter(x => x.matchId !== matchId);
    await commitArenaMatches(updatedMatches);
  };

  const abandonFunMatch = async (matchId) => {
    const m = (arenaMeta?.matches || []).find(x => x.matchId === matchId);
    if (!m || m.kind !== "fun" || m.status === "finished") return;
    if (!m.players?.some(p => p.id === currentUser?.uid) && !isMaster) return;
    if (!window.confirm("Abbandonare la sfida?")) return;
    const opponent = (m.players || []).find(p => p.id !== currentUser?.uid);
    const meName = (m.players || []).find(p => p.id === currentUser?.uid)?.name || "?";
    const winnerId = opponent?.id || null;
    const updatedMatches = (arenaMeta.matches || []).map(x => {
      if (x.matchId !== matchId) return x;
      return {
        ...x,
        status: "finished",
        winner: winnerId,
        logs: [...(x.logs || []), `🏳 ${meName} ha abbandonato la sfida.${opponent ? ` 🛡 ${opponent.name} vince.` : ""}`],
      };
    });
    await commitArenaMatches(updatedMatches);
  };

  const removeFunMatch = async (matchId) => {
    const m = (arenaMeta?.matches || []).find(x => x.matchId === matchId);
    if (!m || m.kind !== "fun" || m.status !== "finished") return;
    if (!m.players?.some(p => p.id === currentUser?.uid) && !isMaster) return;
    const updatedMatches = (arenaMeta.matches || []).filter(x => x.matchId !== matchId);
    await commitArenaMatches(updatedMatches);
  };

  const toggleWeapon = (item, maxWeapons) => {
    setPendingWeapons(prev => {
      const already = prev.find(a => a.name === item.name);
      if (already) return prev.filter(a => a.name !== item.name);
      // Arma a due mani da mischia: esclusiva, sostituisce tutta la selezione.
      if (IS_TWO_HANDED_MELEE(item)) return [item];
      if (item.twoHanded) {
        // Arma a due mani a distanza (arco/balestra): al massimo una due mani; può
        // convivere con armi a una mano, occupando uno slot. Scarta eventuali altre due mani.
        const oneHanded = prev.filter(a => !a.twoHanded);
        return [item, ...oneHanded.slice(0, Math.max(0, maxWeapons - 1))];
      }
      // Arma a una mano: non può convivere con una due mani da mischia (esclusiva).
      const base = prev.filter(a => !IS_TWO_HANDED_MELEE(a));
      if (base.length >= maxWeapons) return maxWeapons === 1 ? [item] : base;
      return [...base, item];
    });
  };

  const toggleSpell = (item, spellLimits) => {
    const lvl = item.level ?? 0;
    setPendingSpells(prev => {
      const already = prev.find(a => a.name === item.name);
      if (already) return prev.filter(a => a.name !== item.name);
      const countAtLevel = prev.filter(a => (a.level ?? 0) === lvl).length;
      const limit = spellLimits?.[lvl] ?? 0;
      if (countAtLevel >= limit) return prev;
      // Warlock mixed-slot budget: max 2 non-cantrip spells regardless of level
      if (lvl > 0 && spellLimits?.nonCantripMax != null) {
        const nonCantripCount = prev.filter(a => (a.level ?? 0) > 0).length;
        if (nonCantripCount >= spellLimits.nonCantripMax) return prev;
      }
      return [...prev, item];
    });
  };

  const toggleSkill = (item, maxSkills) => {
    setPendingSkills(prev => {
      const already = prev.find(a => a.name === item.name);
      if (already) return prev.filter(a => a.name !== item.name);
      if (prev.length >= maxSkills) return maxSkills === 1 ? [item] : prev;
      return [...prev, item];
    });
  };

  // ── MASTER join helpers ────────────────────────────────────────────────────
  const MASTER_JOIN_CLASSES_BASE = ["Fighter","Barbarian","Paladin","Ranger","Monk","Rogue","Wizard","Sorcerer","Warlock","Druid","Cleric","Bard"];
  const MASTER_JOIN_CLASSES = (() => {
    const base = MASTER_JOIN_CLASSES_BASE.slice();
    // Sblocca Artefice solo se il giocatore corrente lo ha acquistato in Bottega (vale anche per il master).
    const buffs = charPreview?.arenaBuffs ?? myArenaBuffs ?? {};
    if ((buffs.classArtificer ?? 0) > 0) base.push("Artificer");
    return base;
  })();

  // ── Genera un PG d'Arena completo e casuale (classe, stat, HP, armi,
  //    incantesimi, armatura, scudo, oggetto, pet/demone/costrutto) e porta
  //    direttamente alla fase di revisione "selecting". ──
  const autoGeneratePg = () => {
    if (!charPreview) return;
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

    // Niente più fasce di livello: tutte le classi sono base Lv.3 e ammesse.
    const classPool = MASTER_JOIN_CLASSES.length ? MASTER_JOIN_CLASSES : MASTER_JOIN_CLASSES_BASE;
    const cls = rnd(classPool);
    const clsLower = (cls || "").toLowerCase();
    const clsLevel = charPreview.classLevels?.[getClassKey(cls)];
    const config = getLoadoutConfig(cls, clsLevel);

    // stat: 10 punti base + punti caratteristica (ASI) maturati, cap (3 + ASI) per stat
    const asiBonus = getAsiPoints(getClassKey(cls), clsLevel);
    const statCap = 3 + asiBonus;
    const stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const keys = Object.keys(stats);
    let rem = 10 + asiBonus, guard = 0;
    while (rem > 0 && guard++ < 500) {
      const k = rnd(keys);
      if (stats[k] < statCap) { stats[k]++; rem--; }
      else if (keys.every(kk => stats[kk] >= statCap)) break;
    }

    // HP
    const { count, sides } = getHpDice(cls, charPreview.classLevels);
    let hp = 0;
    for (let i = 0; i < count; i++) hp += Math.floor(Math.random() * sides) + 1;
    hp = Math.max(1, hp + (stats.con || 0) * count);

    // armi — una due mani da mischia è esclusiva; una due mani a distanza tollera 1 arma a una mano
    let weapons = shuffle(config.weaponOptions).slice(0, config.maxWeapons);
    if (weapons.some(IS_TWO_HANDED_MELEE)) {
      weapons = [weapons.find(IS_TWO_HANDED_MELEE)];
    } else if (weapons.filter(w => w.twoHanded).length > 1) {
      // niente due archi/balestre insieme: tieni una sola arma a due mani + il resto a una mano
      const first2H = weapons.find(w => w.twoHanded);
      weapons = [first2H, ...weapons.filter(w => !w.twoHanded)].slice(0, config.maxWeapons);
    }
    const has2H = weapons.some(w => w.twoHanded);

    // incantesimi (rispetta i limiti per livello; il tier 3 è ammesso solo se il
    // limite di classe/livello lo consente — Mago/Stregone dal Lv5)
    const spells = [];
    const limits = config.spellLimits || {};
    for (const sp of shuffle(config.spellOptions)) {
      if (spells.length >= config.maxSpells) break;
      const lvl = sp.level ?? 0;
      const atLvl = spells.filter(s => (s.level ?? 0) === lvl).length;
      if (atLvl >= (limits[lvl] ?? 0)) continue;
      spells.push(sp);
    }

    // armatura
    const armorList = ARENA_ARMORS[config.armorCategory] || [];
    const armor = armorList.length ? rnd(armorList) : null;

    // scudo (se idoneo e nessuna arma a due mani)
    let shield = null;
    if (config.canHaveShield && !has2H) {
      const opts = config.canHaveShield === "wood" ? ["legno", null] : ["legno", "metallo", null];
      shield = rnd(opts);
    }

    // oggetto: 1 a caso (esclusi quelli solo-bottega)
    const itemCounts = { pozione_cura: 0, bomba: 0, pozione_veleno: 0 };
    const itemPool = ARENA_ITEMS.filter(i => !i.shopOnly && itemCounts[i.key] !== undefined);
    if (itemPool.length) itemCounts[rnd(itemPool).key] = 1;

    // pet / demone / costrutto se richiesti dalla classe
    let pet = null, demon = null, construct = null;
    if (isRangerClass(clsLower)) {
      const buffs = charPreview.arenaBuffs || {};
      const pets = Object.values(RANGER_PETS).filter(p => !p.requiresBuff || (buffs[p.requiresBuff] ?? 0) > 0);
      pet = pets.length ? rnd(pets).key : null;
    }
    if (isWarlockClass(clsLower))   demon = rnd(Object.values(WARLOCK_DEMONS)).key;
    if (isArtificerClass(clsLower)) construct = rnd(Object.values(ARTIFICER_CONSTRUCTS)).key;

    setCharPreview(prev => ({ ...prev, class: cls, stats, rolledHp: hp, hpRerollCount: 0 }));
    setPendingStats(stats);
    setPendingWeapons(weapons);
    setPendingSpells(spells);
    setPendingSkills([]);
    setPendingArmor(armor);
    setPendingShield(shield);
    setPendingItemCounts(itemCounts);
    setPendingPet(pet);
    setPendingDemon(demon);
    setPendingConstruct(construct);
    setLoadoutPhase("selecting");
  };

  const startMasterLoadout = async () => {
    if (!masterJoinName.trim() || !masterJoinClass) return;
    let arenaBuffs = {};
    let arenaSubclass = {};
    let arenaWeekly = null;
    // Riforma Bottega settimanale: livelli non più acquistabili → tutti Lv.3.
    const classLevels = {};
    try {
      const charSnap = await getDoc(doc(db, "characters", authUser.uid));
      if (charSnap.exists()) {
        const d = charSnap.data();
        arenaBuffs = d.arenaBuffs || {};
        arenaSubclass = d.arenaSubclass || {};
        arenaWeekly = d.arenaWeekly || null;
      }
    } catch { /* ignore */ }
    setCharPreview({
      name:        masterJoinName.trim(),
      image:       null,
      class:       masterJoinClass,
      stats:       { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      classLevels,
      arenaBuffs,
      arenaSubclass,
      arenaWeekly,
      rolledHp:    null,
      hpRerollCount: 0,
    });
    setPendingStats({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
    setPendingWeapons([]);
    setPendingSpells([]);
    setPendingSkills([]);
    setPendingArmor(null);
    setPendingShield(null);
    setMasterJoinSetup(false);
    // Passa per la fase "Caratteristiche" come i giocatori (budget 10 + punti ASI),
    // invece di assegnare stat preimpostate e saltare la distribuzione dei punti.
    setLoadoutPhase("stat-assign");
    setArenaView("join");
  };

  // ── MASTER helpers ─────────────────────────────────────────────────────────
  const setPrizeField = (tier, field, val) =>
    setPrizeConfig(prev => ({ ...prev, [tier]: { ...prev[tier], [field]: val } }));

  const savePrizes = async () => {
    const toNum = (t) => ({
      crowns: Math.max(0, parseInt(t.crowns, 10) || 0),
      coins:  Math.max(0, parseInt(t.coins, 10) || 0),
      perks:  (t.perks || "").trim(),
    });
    await updateDoc(doc(db, "arena_meta", "global"), {
      prizes: prizeText,
      prizeConfig: {
        first:       toNum(prizeConfig.first),
        second:      toNum(prizeConfig.second),
        participant: toNum(prizeConfig.participant),
      },
    });
  };

  const approveParticipant = async (uid) => {
    await updateDoc(doc(db, "arena_meta", "global"), {
      waitingList:  arrayRemove(uid),
      participants: arrayUnion(uid),
    });
  };

  const benchParticipant = async (uid) => {
    await updateDoc(doc(db, "arena_meta", "global"), {
      participants: arrayRemove(uid),
      waitingList:  arrayUnion(uid),
    });
  };

  const benchAllParticipants = async () => {
    const ps = arenaMeta.participants || [];
    if (ps.length === 0) return;
    const merged = Array.from(new Set([...(arenaMeta.waitingList || []), ...ps]));
    await updateDoc(doc(db, "arena_meta", "global"), {
      participants: [],
      waitingList:  merged,
    });
  };

  const clearWaitingList = async () => {
    if ((arenaMeta.waitingList || []).length === 0) return;
    if (!window.confirm("Svuotare la lista d'attesa? Le iscrizioni in attesa verranno rimosse.")) return;
    const waitingIds  = arenaMeta.waitingList || [];
    const participants = new Set(arenaMeta.participants || []);
    const funUids = new Set();
    (arenaMeta.matches || []).filter(m => m.kind === "fun").forEach(m =>
      (m.players || []).forEach(p => funUids.add(p.id))
    );
    const snaps = { ...(arenaMeta.characterSnapshots || {}) };
    let snapsChanged = false;
    waitingIds.forEach(uid => {
      if (!participants.has(uid) && !funUids.has(uid) && snaps[uid]) {
        delete snaps[uid];
        snapsChanged = true;
      }
    });
    const updates = { waitingList: [] };
    if (snapsChanged) updates.characterSnapshots = snaps;
    await updateDoc(doc(db, "arena_meta", "global"), updates);
  };

  // ── Round-robin helpers ────────────────────────────────────────────────────
  // Circle method: for N ids returns rounds[][pair] schedule. Adds a bye when N is odd.
  const roundRobinSchedule = (ids) => {
    const players = [...ids];
    if (players.length < 2) return [];
    if (players.length % 2 === 1) players.push(null);
    const n = players.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = players[i];
        const b = players[n - 1 - i];
        if (a && b) pairs.push([a, b]);
      }
      rounds.push(pairs);
      // rotate, keeping first fixed
      const fixed = players[0];
      const rest  = players.slice(1);
      rest.unshift(rest.pop());
      players.length = 0;
      players.push(fixed, ...rest);
    }
    return rounds;
  };

  const buildPlayerForMatch = (id, snapshots) => {
    const snap = snapshots[id] || {};
    // I PF dei livelli sono già nel tiro dadi (getHpDice scala col livello),
    // quindi NON sommiamo più arenaHpBonus: evita il doppio conteggio.
    const startHp  = snap.stats?.maxHp ?? 70;
    const itemUses = {};
    (snap.selectedItemKeys || []).forEach(k => { itemUses[k] = (itemUses[k] || 0) + 1; });
    const shopPotions = snap.arenaBuffs?.healingPotions ?? 0;
    if (shopPotions > 0) itemUses["pozione_cura_media"] = shopPotions;
    // Consumabili della Bottega settimanale (presenti solo negli snapshot torneo).
    (snap.marketConsumables || []).forEach(c => { itemUses[c.key] = Math.max(1, c.uses ?? 1); });
    const lockedClass = (snap.class || "").toLowerCase().trim();
    const layOfHandsPool = isPaladinClass(lockedClass) ? Math.floor(startHp / 3) : 0;
    // Embed `class` so the tournament class is locked at match-build time and
    // cannot be silently changed by later writes to characterSnapshots.
    return { id, name: snap.name || "Sconosciuto", class: lockedClass, hp: startHp, maxHp: startHp, init: 0, itemUsesLeft: itemUses, layOfHandsPool };
  };

  // Riconosce i PG-bot (riserve del Master o IA delle Sfide) dal prefisso dell'id.
  const isAiId = (id) => typeof id === "string" && id.startsWith(AI_BOT_PREFIX);

  // Se un match contiene un PG-bot (snapshot.isAi o id AI), lo marca con i campi
  // ai/aiId/aiOwnerId così il watcher IA — in mano al Master — ne pilota il turno
  // automaticamente, esattamente come per le Sfide contro l'IA.
  const withAiFlags = (match, snapshots) => {
    const aiP = (match.players || []).find(p => snapshots[p.id]?.isAi || isAiId(p.id));
    if (!aiP) return match;
    return {
      ...match,
      ai: true,
      aiId: aiP.id,
      aiOwnerId: arenaMeta?.masterUid || currentUser?.uid,
      aiArchetype: snapshots[aiP.id]?.aiArchetype || "fighter-plate",
    };
  };

  const buildGroupRoundMatches = (group, round, snapshots) => {
    const ids = group === "A" ? (arenaMeta.groupA || []) : (arenaMeta.groupB || []);
    const schedule = roundRobinSchedule(ids);
    const pairs = schedule[round - 1] || [];
    return pairs.map((pair, idx) => withReadyCheck(withAiFlags({
      matchId: `G${group}_R${round}_M${idx}`,
      kind: "group",
      group,
      players: pair.map(id => buildPlayerForMatch(id, snapshots)),
      status: "initiative", turn: null, turnExpiry: new Date(arenaNow() + ARENA_INITIATIVE_DURATION).toISOString(),
      logs:   ["⚔️ Il match ha inizio!"], winner: null, participantsAwarded: [],
      isFFA:  false,
    }, snapshots)));
  };

  const buildFinalMatch = (winnerA, winnerB, snapshots) => withReadyCheck(withAiFlags({
    matchId: "FINAL_M0",
    kind: "final",
    group: null,
    players: [buildPlayerForMatch(winnerA, snapshots), buildPlayerForMatch(winnerB, snapshots)],
    status: "initiative", turn: null, turnExpiry: new Date(arenaNow() + ARENA_INITIATIVE_DURATION).toISOString(),
    logs:   ["🏆 La Finale ha inizio!"], winner: null, participantsAwarded: [],
    isFFA:  false,
  }, snapshots));

  const computeGroupStandings = (group, matches) => {
    const ids = group === "A" ? (arenaMeta.groupA || []) : (arenaMeta.groupB || []);
    const wins = {}, losses = {};
    const h2h = {}; // h2h[a][b] = winnerId
    matches.forEach(m => {
      if (m.kind !== "group" || m.group !== group) return;
      if (m.status !== "finished" || !m.winner) return;
      (m.players || []).forEach(p => {
        if (p.id === m.winner) wins[p.id] = (wins[p.id] || 0) + 1;
        else losses[p.id] = (losses[p.id] || 0) + 1;
      });
      if (m.players?.length === 2) {
        const [a, b] = m.players.map(p => p.id);
        h2h[a] = h2h[a] || {}; h2h[b] = h2h[b] || {};
        h2h[a][b] = m.winner; h2h[b][a] = m.winner;
      }
    });
    const standings = ids.map(uid => ({
      uid,
      wins:   wins[uid]   || 0,
      losses: losses[uid] || 0,
    }));
    standings.sort((p, q) => {
      if (q.wins !== p.wins) return q.wins - p.wins;
      // tiebreak: head-to-head winner
      const w = h2h[p.uid]?.[q.uid];
      if (w === p.uid) return -1;
      if (w === q.uid) return 1;
      return 0;
    });
    return standings;
  };

  const groupRoundsTotal = () => {
    const a = roundRobinSchedule(arenaMeta.groupA || []).length;
    const b = roundRobinSchedule(arenaMeta.groupB || []).length;
    return Math.max(a, b);
  };

  // ── Finestre di acquisto tra i round ─────────────────────────────────────
  // Pre-calcola i match del round successivo a partire dallo stato corrente,
  // così l'avanzamento automatico (Cloud Function) è solo uno spostamento dati.
  // Restituisce { matches, round } oppure null se non c'è un round successivo.
  const computePendingRound = (matches, cr) => {
    const totalGroupRounds = groupRoundsTotal();
    const snapshots = arenaMeta?.characterSnapshots || {};
    const finalExists = (matches || []).some(m => m.kind === "final");
    if (cr < totalGroupRounds) {
      const next = cr + 1;
      const more = [
        ...buildGroupRoundMatches("A", next, snapshots),
        ...buildGroupRoundMatches("B", next, snapshots),
      ];
      if (more.length === 0) return null;
      return { matches: more, round: next };
    }
    if (finalExists) return null;
    const standA = computeGroupStandings("A", matches);
    const standB = computeGroupStandings("B", matches);
    const winnerA = standA[0]?.uid, winnerB = standB[0]?.uid;
    if (!winnerA || !winnerB) return null;
    return { matches: [buildFinalMatch(winnerA, winnerB, snapshots)], round: cr };
  };

  // Apre la finestra di shopping SE la commit ha appena completato il round
  // corrente (tutti i match di gruppo del round finiti) e c'è un round dopo.
  const maybeOpenShoppingWindow = async (matches) => {
    const meta = arenaMeta;
    if (!meta) return;
    if (meta.phase !== "combat") return;          // solo durante un torneo attivo
    if (meta.tournamentWinner) return;
    if (meta.pendingNextMatches) return;          // già in shopping/pending
    const cr = meta.currentRound || 1;
    const roundGroup = (matches || []).filter(m => m.kind === "group" && typeof m.matchId === "string" && m.matchId.includes(`_R${cr}_`));
    if (roundGroup.length === 0) return;
    if (!roundGroup.every(m => m.status === "finished")) return;
    const pending = computePendingRound(matches, cr);
    if (!pending || pending.matches.length === 0) return;
    const existingIds = new Set((matches || []).map(m => m.matchId));
    if (pending.matches.some(m => existingIds.has(m.matchId))) return;

    const shopEndsAt = new Date(Date.now() + ARENA_SHOP_DURATION).toISOString();
    await updateDoc(doc(db, "arena_meta", "global"), {
      phase: "shopping",
      shopEndsAt,
      pendingNextMatches: pending.matches,
      pendingNextRound: pending.round,
    });
    // Avvisa i partecipanti che possono spendere le Monete Arena.
    const parts = (meta.participants || []).filter(Boolean);
    for (const uid of parts) {
      try {
        await addDoc(collection(db, "notifications"), {
          userId: uid, read: false, timestamp: serverTimestamp(),
          title: "🛒 Bottega Arena aperta",
          message: "Hai 1 ora per acquistare al Mercato Arena prima del prossimo round. Spendi le tue Monete Arena!",
          // solo campanella: il push lo manda pushOnArenaUpdate (evita il doppio push)
          silent: true,
        });
      } catch { /* uid senza doc: ignora */ }
    }
  };

  // Promuove il round in coda (spostamento dati, con lock a transazione così
  // client e Cloud Function non creano doppioni). Idempotente: se la fase non è
  // più "shopping" non fa nulla.
  const commitPendingPromotion = async () => {
    const ref = doc(db, "arena_meta", "global");
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.phase !== "shopping") return;
      const pending = Array.isArray(d.pendingNextMatches) ? d.pendingNextMatches : [];
      const existing = Array.isArray(d.matches) ? d.matches : [];
      const existingIds = new Set(existing.map(m => m.matchId));
      const toAdd = pending.filter(m => !existingIds.has(m.matchId));
      tx.update(ref, {
        matches: [...existing, ...toAdd],
        currentRound: d.pendingNextRound || (d.currentRound || 1) + 1,
        phase: "combat",
        shopEndsAt: null,
        pendingNextMatches: null,
        pendingNextRound: null,
      });
    });
  };

  // Override MANUALE del Master ("avanza ora", salta l'attesa dell'ora).
  const promotePendingRoundNow = async () => {
    if (!(arenaMeta?.pendingNextMatches?.length)) return advanceRound();
    await commitPendingPromotion();
  };

  // Auto-avanzamento lato client: quando l'ora di shopping scade, il primo
  // client con l'Arena aperta promuove il round (la Cloud Function fa lo stesso
  // come rete di sicurezza; la transazione impedisce doppioni).
  useEffect(() => {
    if (arenaMeta?.phase !== "shopping" || !arenaMeta?.shopEndsAt) return;
    const endMs = new Date(arenaMeta.shopEndsAt).getTime();
    const tick = () => {
      if (Date.now() >= endMs) commitPendingPromotion().catch(e => console.error("[arena] auto-promote:", e));
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [arenaMeta?.phase, arenaMeta?.shopEndsAt]);

  const startTournament = async () => {
    if ((arenaMeta.participants || []).length < 2) return alert("Minimo 2 partecipanti!");

    // ── Numero dispari → pesca un PG di Riserva del Master e inseriscilo ──────
    // Il bot combatte pilotato dal motore IA (di proprietà del Master). Se non
    // ci sono riserve configurate si procede come prima (qualcuno salta un turno).
    let participants = [...arenaMeta.participants];
    const baseSnaps = arenaMeta.characterSnapshots || {};
    const injected = {}; // { [botId]: snapshot } da scrivere in characterSnapshots
    if (participants.length % 2 === 1) {
      const reserves = (arenaMeta.masterReserves || []).filter(Boolean);
      if (reserves.length) {
        const pick = reserves[Math.floor(Math.random() * reserves.length)];
        const botId = `${AI_BOT_PREFIX}RESERVE_${Date.now()}`;
        injected[botId] = pick;
        participants.push(botId);
      } else {
        const go = window.confirm("Il numero di iscritti è DISPARI e non hai creato PG di Riserva: qualcuno salterà dei turni (bye). Vuoi procedere lo stesso?\n\n(Annulla = torna indietro e crea un PG di Riserva nel pannello Master.)");
        if (!go) return;
      }
    }

    const snapshots = { ...baseSnaps, ...injected };
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    const groupA = shuffled.slice(0, half);
    const groupB = shuffled.slice(half);
    const existingFun = (arenaMeta.matches || []).filter(m => m.kind === "fun");
    // Generate round 1 group matches (need groupA/groupB temporarily applied to local ref)
    const scheduleA = roundRobinSchedule(groupA);
    const scheduleB = roundRobinSchedule(groupB);
    const r1Matches = [];
    (scheduleA[0] || []).forEach((pair, idx) => {
      r1Matches.push(withReadyCheck(withAiFlags({
        matchId: `GA_R1_M${idx}`, kind: "group", group: "A",
        players: pair.map(id => buildPlayerForMatch(id, snapshots)),
        status: "initiative", turn: null, turnExpiry: new Date(arenaNow() + ARENA_INITIATIVE_DURATION).toISOString(),
        logs: ["⚔️ Il match ha inizio!"], winner: null, participantsAwarded: [], isFFA: false,
      }, snapshots)));
    });
    (scheduleB[0] || []).forEach((pair, idx) => {
      r1Matches.push(withReadyCheck(withAiFlags({
        matchId: `GB_R1_M${idx}`, kind: "group", group: "B",
        players: pair.map(id => buildPlayerForMatch(id, snapshots)),
        status: "initiative", turn: null, turnExpiry: new Date(arenaNow() + ARENA_INITIATIVE_DURATION).toISOString(),
        logs: ["⚔️ Il match ha inizio!"], winner: null, participantsAwarded: [], isFFA: false,
      }, snapshots)));
    });
    // Edge case: a group with a single player has no matches in round 1; if both groups generated nothing,
    // jump straight to the final between the two lone players.
    let initialMatches = [...existingFun, ...r1Matches];
    if (r1Matches.length === 0 && groupA.length === 1 && groupB.length === 1) {
      initialMatches = [...existingFun, buildFinalMatch(groupA[0], groupB[0], snapshots)];
    }
    // Snapshot dei bot iniettati → characterSnapshots (per il fight e le schede).
    const snapWrites = {};
    Object.entries(injected).forEach(([botId, snap]) => { snapWrites[`characterSnapshots.${botId}`] = snap; });
    // Tornei della settimana (2026-10-09): `weekTournaments = {weekKey, count}`
    // contato in transazione, così un doppio clic non avvia (né paga) due volte.
    // Dal 2° torneo della settimana in poi: +ARENA_TOURNAMENT_BONUS Monete a TUTTI
    // (si sommano a quelle che hanno). Si azzera domenica alle 23:00 (arenaSundayReset).
    const wk = currentWeekKey();
    let nth = 0;
    try {
      nth = await runTransaction(db, async (tx) => {
        const ref = doc(db, "arena_meta", "global");
        const cur = (await tx.get(ref)).data() || {};
        if (cur.phase === "combat") throw new Error("già avviato");
        const n = (cur.weekTournaments?.weekKey === wk ? (cur.weekTournaments.count || 0) : 0) + 1;
        tx.update(ref, {
          matches: initialMatches, phase: "combat", currentRound: 1, tournamentWinner: null,
          groupA, groupB,
          participants,               // include l'eventuale bot di riserva iniettato
          masterUid: currentUser.uid, // chi pilota i PG-bot durante il torneo
          weekTournaments: { weekKey: wk, count: n },
          ...snapWrites,
        });
        return n;
      });
    } catch (e) {
      if (e.message === "già avviato") return alert("Il torneo è già stato avviato.");
      throw e;
    }
    if (nth >= 2) {
      try {
        const snap = await getDocs(collection(db, "characters"));
        let batch = writeBatch(db), n = 0;
        for (const d of snap.docs) {
          batch.update(d.ref, { arenaCoins: increment(ARENA_TOURNAMENT_BONUS) });
          if (++n % 450 === 0) { await batch.commit(); batch = writeBatch(db); }
        }
        if (n % 450) await batch.commit();
        alert(`Torneo n. ${nth} della settimana: +${ARENA_TOURNAMENT_BONUS} Monete Arena a ${n} personaggi.`);
      } catch (e) {
        console.error("bonus torneo:", e);
        alert(`Torneo avviato, ma il bonus di ${ARENA_TOURNAMENT_BONUS} Monete non è stato dato a tutti: usa "Dai monete a tutti" nella Bottega. (${e.message})`);
      }
    }
  };

  const advanceRound = async () => {
    const cr = arenaMeta.currentRound || 1;
    const snapshots = arenaMeta.characterSnapshots || {};
    const totalGroupRounds = groupRoundsTotal();
    const finalExists = (arenaMeta.matches || []).some(m => m.kind === "final");
    const groupA = arenaMeta.groupA || [];
    const groupB = arenaMeta.groupB || [];

    /* Diagnostic context — the tournament was silently halting at the
       round → final boundary with no UI feedback. Log + alert any
       reason we bail so the master can see why nothing happened. */
    const ctx = { cr, totalGroupRounds, finalExists, groupA: groupA.length, groupB: groupB.length };
    console.log("[arena] advanceRound", ctx);

    try {
      if (cr < totalGroupRounds) {
        const next = cr + 1;
        const matches = arenaMeta.matches || [];
        const more = [
          ...buildGroupRoundMatches("A", next, snapshots),
          ...buildGroupRoundMatches("B", next, snapshots),
        ];
        if (more.length === 0) {
          console.warn("[arena] advanceRound: no matches generated for round", next, ctx);
          alert(`Errore: nessun match generato per il Round ${next}.\nGirone A: ${groupA.length} giocatori · Girone B: ${groupB.length} giocatori.\nControlla che entrambi i gironi abbiano almeno 2 giocatori.`);
          return;
        }
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: [...matches, ...more], currentRound: next,
        });
        console.log("[arena] advanceRound: generated", more.length, "matches for round", next);
        return;
      }

      if (finalExists) {
        console.log("[arena] advanceRound: final already exists, nothing to do");
        return;
      }

      const standA = computeGroupStandings("A", arenaMeta.matches || []);
      const standB = computeGroupStandings("B", arenaMeta.matches || []);
      const winnerA = standA[0]?.uid;
      const winnerB = standB[0]?.uid;
      console.log("[arena] advanceRound: standings A:", standA, "B:", standB);
      if (!winnerA || !winnerB) {
        console.warn("[arena] advanceRound: missing winners", { winnerA, winnerB, standA, standB });
        alert(`Errore: impossibile determinare i vincitori dei gironi.\nGirone A: ${standA.length} classifiche · Girone B: ${standB.length} classifiche.\nProbabilmente uno dei gironi non ha partecipanti.`);
        return;
      }
      const finalMatch = buildFinalMatch(winnerA, winnerB, snapshots);
      await updateDoc(doc(db, "arena_meta", "global"), {
        matches: [...(arenaMeta.matches || []), finalMatch],
      });
      console.log("[arena] advanceRound: final generated", winnerA, "vs", winnerB);
    } catch (e) {
      console.error("[arena] advanceRound failed:", e);
      alert(`Errore durante l'avanzamento del torneo: ${e?.message || e}`);
    }
  };

  const sendChampionNotification = async (winnerId, winnerName, prizes, matchesOverride) => {
    const prizeMsg = prizes ? `Il tuo premio: ${prizes}` : "Che il tuo valore sia ricordato nelle cronache di Exanthia!";
    await addDoc(collection(db, "notifications"), {
      userId: winnerId,
      title:  "🏆 Campione dell'Arena!",
      message: `${winnerName}, hai trionfato nell'Arena dei Campioni! ${prizeMsg}`,
      read: false, timestamp: serverTimestamp(),
    });
    await awardArenaCoins(winnerId, 30);
    await distributeArenaPrizes(winnerId, matchesOverride);
    await resolveTournamentBets(winnerId, winnerName);
    await archiveTournament(winnerId, undefined, undefined, matchesOverride);
    const winnerSnap = (arenaMeta?.characterSnapshots || {})[winnerId] || {};
    await updateDoc(doc(db, "arena_meta", "global"), {
      lastChampion: {
        uid:     winnerId,
        name:    winnerSnap.name  || winnerName || "Campione",
        class:   winnerSnap.class || null,
        image:   winnerSnap.image || null,
        prizes:  prizes || "",
        wonAt:   new Date().toISOString(),
      },
    });
  };

  // Ritorna la finale SOLO se QUESTA modifica l'ha appena conclusa (transizione
  // not-finished → finished sullo stesso match) e non è già stato dichiarato un
  // campione. Evita di rinviare la notifica al vincitore di un torneo precedente
  // la cui finale è ancora presente in `arena_meta.matches` (qualsiasi attacco,
  // anche in una Sfida Libera, la ritroverebbe altrimenti). null = non inviare.
  const finalJustConcluded = (updatedMatches) => {
    if (arenaMeta?.tournamentWinner) return null;
    const prevById = new Map((arenaMeta?.matches || []).map(m => [m.matchId, m]));
    // tra le finali concluse, prendi quella che NON era già conclusa prima d'ora
    // (così l'ordine in `matches` non conta e una vecchia finale non sopprime
    //  la notifica legittima di quella nuova).
    return (updatedMatches || []).find(m => {
      if (m.kind !== "final" || m.status !== "finished" || !m.winner) return false;
      const prev = prevById.get(m.matchId);
      return !(prev && prev.status === "finished");
    }) || null;
  };

  // ── COMBAT ─────────────────────────────────────────────────────────────────
  const advanceTurn = (players, matchObj) => {
    const currentIndex = matchObj.players.findIndex(p => p.id === currentUser.uid);
    let nextIndex = (currentIndex + 1) % players.length;
    while (players[nextIndex]?.hp <= 0) nextIndex = (nextIndex + 1) % players.length;
    return players[nextIndex].id;
  };

  // Sollecito del Master: un match fermo da troppo → una notifica (campanella + push)
  // a ogni giocatore vero del match, con quello che manca a LUI (Iniziamo, iniziativa,
  // il suo turno) o, se tocca all'altro, solo che il match è fermo.
  const [matchNudges, setMatchNudges] = useState({});
  const nudgeStalledMatch = async (m) => {
    if (!isMaster || !m) return;
    const humans = (m.players || []).filter(p => !isAiId(p.id) && !isMasterAltId(p.id));
    if (!humans.length) return alert("In questo match non ci sono giocatori da avvisare.");
    const vs = (m.players || []).map(p => p.name || "?").join(" vs ");
    const turnName = m.players?.find(p => p.id === m.turn)?.name || "il tuo avversario";
    const todo = (p) => {
      if (isAwaitingReady(m)) return m.ready?.[p.id] ? "Aspettiamo che anche l'avversario prema «Iniziamo»." : "Entra in Arena e premi «✋ Iniziamo».";
      if (m.status === "initiative") return p.init > 0 ? "Manca ancora il tiro d'iniziativa dell'avversario." : "Entra in Arena e tira l'iniziativa.";
      if (m.turn === p.id) return "Tocca a te: entra in Arena e fai la tua mossa.";
      return `Tocca a ${turnName}: il match aspetta la sua mossa.`;
    };
    try {
      const batch = writeBatch(db);
      humans.forEach((p) => {
        batch.set(doc(collection(db, "notifications")), {
          userId: p.id, read: false, timestamp: serverTimestamp(),
          title: "⏳ Il tuo match in Arena è fermo",
          message: `${vs} è fermo da parecchio. ${todo(p)}`,
        });
      });
      await batch.commit();
      setMatchNudges((prev) => ({ ...prev, [m.matchId]: Date.now() }));
    } catch (e) {
      console.error("nudgeStalledMatch:", e);
      alert("Avviso non inviato: " + (e.message || e));
    }
  };
  const nudgeButton = (m) => isMaster && (
    <button type="button" className="btn-init" style={{ marginLeft: "0.5rem", padding: "0.15rem 0.6rem", fontSize: "0.72rem" }}
      onClick={() => nudgeStalledMatch(m)} title="Manda ai giocatori del match una notifica: il match è fermo">
      {matchNudges[m.matchId]
        ? `🔔 Avvisati alle ${new Date(matchNudges[m.matchId]).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`
        : "🔔 Sollecita"}
    </button>
  );

  // "Iniziamo": transazione sul match fresco, così le due conferme quasi
  // simultanee si sommano invece di sovrascriversi. `force` = il Master avvia
  // il match anche se qualcuno non ha confermato.
  const confirmReady = async (matchId, { force = false } = {}) => {
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "arena_meta", "global");
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const matches = snap.data().matches || [];
        const m = matches.find(x => x.matchId === matchId);
        if (!m || !isAwaitingReady(m)) return;
        const isPlayer = (m.players || []).some(p => p.id === currentUser.uid);
        if (!force && !isPlayer) return;
        const ready = { ...(m.ready || {}) };
        const logs = [...(m.logs || [])];
        if (force) {
          m.players.forEach(p => { ready[p.id] = true; });
          logs.push("▶ Il Master avvia il match.");
        } else {
          if (ready[currentUser.uid]) return;
          ready[currentUser.uid] = true;
          const me = m.players.find(p => p.id === currentUser.uid);
          logs.push(`✋ ${me?.name || "?"} è pronto.`);
        }
        const allReady = m.players.every(p => ready[p.id]);
        if (allReady) logs.push("⚔ Si comincia! Tirate iniziativa.");
        const next = {
          ...m, ready, logs,
          readyCheck: !allReady,
          turnExpiry: allReady ? new Date(arenaNow() + ARENA_INITIATIVE_DURATION).toISOString() : null,
          ...(allReady ? { readyAt: new Date(arenaNow()).toISOString() } : {}),
        };
        tx.update(ref, { matches: matches.map(x => x.matchId === matchId ? next : x) });
      });
    } catch (e) {
      console.error("Errore conferma Iniziamo:", e);
      alert("⚠ Non sono riuscito a confermare. Riprova.");
    }
  };

  const rollInit = async (matchId) => {
    if (isAwaitingReady(arenaMeta.matches?.find(m => m.matchId === matchId))) return;
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const dex    = mySnap?.stats?.dex ?? 0;
    const _initCls = (mySnap?.class || "").toLowerCase();
    // Vantaggio iniziativa: Ladro (agilità) o Barbaro Lv7 (Istinto Selvaggio).
    const hasAdv = isRogueClass(_initCls) || (isBarbarianClass(_initCls) && getSnapLevel(mySnap) >= 7);
    const d20a   = Math.floor(Math.random() * 20) + 1;
    const d20b   = hasAdv ? Math.floor(Math.random() * 20) + 1 : 0;
    const d20    = hasAdv ? Math.max(d20a, d20b) : d20a;
    const noArmorInit = isNoArmor(mySnap) ? 1 : 0; // Senza armatura → +1 iniziativa
    const roll   = d20 + dex + noArmorInit;
    await showD20Roll(d20, { label: "Iniziativa" });
    const advTag = `${hasAdv ? ` 🌟vant.[${d20a},${d20b}]` : ""}${noArmorInit ? " +1 senz'armatura" : ""}`;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, init: roll } : p
      );
      const allRolled = updatedPlayers.every(p => p.init > 0);
      const sorted    = [...updatedPlayers].sort((a, b) => b.init - a.init);
      return {
        ...m, players: updatedPlayers,
        status:     allRolled ? "active" : "initiative",
        turn:       allRolled ? sorted[0].id : null,
        turnExpiry: allRolled ? new Date(arenaNow() + ARENA_TURN_DURATION).toISOString() : (m.turnExpiry || new Date(arenaNow() + ARENA_INITIATIVE_DURATION).toISOString()),
        fightStartAt: allRolled ? new Date().toISOString() : (m.fightStartAt || null),
        logs:   [...m.logs, `🎲 ${mySnap?.name ?? "?"} tira iniziativa: ${roll}${advTag}`],
      };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── AI auto-actor ────────────────────────────────────────────────────────
  // Drives an AI opponent (Sfida l'IA): rolls initiative + takes a weapon
  // attack on its turn. Runs only on the AI match owner's client so a single
  // browser controls the bot. Reads latest arenaMeta via a ref to avoid
  // acting on stale state captured by setTimeout closures.
  const arenaMetaRef = useRef(null);
  useEffect(() => { arenaMetaRef.current = arenaMeta; }, [arenaMeta]);
  const aiInFlightRef = useRef({});

  const aiRollInitiative = async (matchId) => {
    const meta = arenaMetaRef.current;
    if (!meta) return;
    const m = meta.matches?.find(mm => mm.matchId === matchId);
    if (!m || m.status !== "initiative") return;
    const aiId = m.aiId;
    const aiSnap = meta.characterSnapshots?.[aiId];
    if (!aiSnap || !aiId) return;
    const aiPlayer = m.players?.find(p => p.id === aiId);
    if (!aiPlayer || aiPlayer.init > 0) return;
    const dex = aiSnap.stats?.dex ?? 0;
    // Barbaro Lv7 · Istinto Selvaggio: vantaggio all'iniziativa (anche per l'IA).
    const _aiInitAdv = isBarbarianClass((aiSnap.class || "").toLowerCase()) && getSnapLevel(aiSnap) >= 7;
    const d20a = Math.floor(Math.random() * 20) + 1;
    const d20b = _aiInitAdv ? Math.floor(Math.random() * 20) + 1 : 0;
    const d20 = _aiInitAdv ? Math.max(d20a, d20b) : d20a;
    const noArmorInit = isNoArmor(aiSnap) ? 1 : 0; // Senza armatura → +1 iniziativa
    const roll = d20 + dex + noArmorInit;
    const updatedMatches = meta.matches.map(x => {
      if (x.matchId !== matchId) return x;
      const updatedPlayers = x.players.map(p =>
        p.id === aiId ? { ...p, init: roll } : p
      );
      const allRolled = updatedPlayers.every(p => p.init > 0);
      const sorted    = [...updatedPlayers].sort((a, b) => b.init - a.init);
      return {
        ...x,
        players:     updatedPlayers,
        status:      allRolled ? "active" : "initiative",
        turn:        allRolled ? sorted[0].id : null,
        turnExpiry:  allRolled
          ? new Date(arenaNow() + ARENA_TURN_DURATION).toISOString()
          : (x.turnExpiry || new Date(arenaNow() + ARENA_INITIATIVE_DURATION).toISOString()),
        fightStartAt: allRolled ? new Date().toISOString() : (x.fightStartAt || null),
        logs: [...x.logs, `🎲 ${aiSnap.name} tira iniziativa: ${roll}`],
      };
    });
    await commitArenaMatches(updatedMatches, null, meta.matches);
  };

  // Master AI turn handler — chains heal → first-turn buff → attack → Action
  // Surge. Returns control to the human only when the AI exhausts all its
  // action economy for the turn. Driven by the useEffect, which re-fires this
  // each time the AI still has actions left and the match state changed.
  const aiTakeAction = async (matchId) => {
    const meta = arenaMetaRef.current;
    if (!meta) return;
    const m = meta.matches?.find(mm => mm.matchId === matchId);
    if (!m || m.status !== "active") return;
    const aiId = m.aiId;
    if (!aiId || m.turn !== aiId) return;
    const aiSnap = meta.characterSnapshots?.[aiId];
    const aiPlayer = m.players.find(p => p.id === aiId);
    const target = m.players.find(p => p.id !== aiId && p.hp > 0);
    if (!aiSnap || !aiPlayer || aiPlayer.hp <= 0 || !target) return;
    const targetSnap = meta.characterSnapshots?.[target.id];
    if (!targetSnap) return;

    const aiName = aiSnap.name || "Avversario";

    // ── PHASE 0 — Resolve any pending TS the AI owes BEFORE acting ──────────
    // The AI is a fully-fledged player: when the human lands a control
    // spell, save-vs-poison, etc., the AI must roll its own TS (visible
    // d20 popup, same flow the human goes through). Pass → clear and act
    // normally. Fail → apply the consequence and end the AI's turn.
    if (aiPlayer.pendingControlSave) {
      const isCorona = aiPlayer.pendingControlSave === "corona_pazzia";
      const ctrlAbility = aiPlayer.pendingControlSaveAbility || "wis";
      const ctrlDC      = aiPlayer.pendingControlDC || 13;
      const ctrlMod     = aiSnap.stats?.[ctrlAbility] ?? 0;
      const saveBuffActive = (aiPlayer.saveBuffAttacks ?? 0) > 0;
      const saveBuffBonus  = saveBuffActive ? (aiPlayer.saveBuffBonus ?? 0) : 0;
      const d20 = Math.floor(Math.random() * 20) + 1;
      const lbl = SAVE_LABEL[ctrlAbility] || ctrlAbility.toUpperCase();
      await showD20Roll(d20, { label: `${aiName} tira il proprio TS · ${lbl}` });
      const total = d20 + ctrlMod + saveBuffBonus;
      const pass  = total >= ctrlDC;
      const sign  = ctrlMod >= 0 ? "+" : "";
      const buffTag = saveBuffBonus > 0 ? `+${saveBuffBonus}🛡` : "";
      const tsLabel = isCorona ? "Corona della Pazzia" : "Controllo";
      const expiry  = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();

      let resultLog;
      const passTurnAfter = !pass; // fail → end AI turn (skip / corona)

      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const players = x.players.map(p => {
          if (p.id !== aiId) return p;
          const up = { ...p };
          // Decrement save-buff counter if it contributed.
          if (saveBuffActive) {
            const newAtk = Math.max(0, (p.saveBuffAttacks ?? 0) - 1);
            up.saveBuffAttacks = newAtk;
            if (newAtk === 0) up.saveBuffBonus = 0;
          }
          if (pass) {
            delete up.pendingControlSave;
            delete up.pendingControlDC;
            delete up.pendingControlSaveAbility;
            up.controlLostTurns = 0;
            resultLog = `🌀 ${aiName} TS ${lbl} ${tsLabel}: ${d20}${sign}${ctrlMod}${buffTag}=${total} vs CD ${ctrlDC} → ✅ PASSA — si libera e agisce.`;
          } else if (isCorona) {
            // Corona: self-damage with equipped weapon, no recurring TS.
            const equipped = p.equippedWeaponNames?.[0];
            const weapon = (aiSnap.selectedActions || []).find(a => a.name === equipped && a.type === "weapon");
            const { total: selfDmg, rolls: selfRolls } = rollDmg(weapon?.damage || "1d6");
            up.hp = Math.max(0, (up.hp ?? 0) - selfDmg);
            delete up.pendingControlSave;
            delete up.pendingControlDC;
            delete up.pendingControlSaveAbility;
            resultLog = `🌀 ${aiName} TS ${lbl} ${tsLabel}: ${d20}${sign}${ctrlMod}${buffTag}=${total} vs CD ${ctrlDC} → ❌ FALLISCE — attacca sé stesso con ${weapon?.icon || "⚔"} ${equipped || "arma"}: ${selfDmg} danni [🎲${selfRolls}].`;
          } else {
            // Regular control fail: burn one budget turn, keep TS armed if budget remains.
            const remaining = Math.max(0, (p.controlLostTurns ?? 2) - 1);
            up.controlLostTurns = remaining;
            up.multiActionsUsed = 0;
            up.turnWeaponsUsed = [];
            up.turnSkillUsed = false;
            up.bonusActionUsed = false;
            if (remaining > 0) {
              resultLog = `🌀 ${aiName} TS ${lbl} ${tsLabel}: ${d20}${sign}${ctrlMod}${buffTag}=${total} vs CD ${ctrlDC} → ❌ FALLISCE — turno saltato (${remaining} rimanenti).`;
            } else {
              delete up.pendingControlSave;
              delete up.pendingControlDC;
              delete up.pendingControlSaveAbility;
              resultLog = `🌀 ${aiName} TS ${lbl} ${tsLabel}: ${d20}${sign}${ctrlMod}${buffTag}=${total} vs CD ${ctrlDC} → ❌ FALLISCE — turno saltato, effetto esaurito.`;
            }
          }
          return up;
        });
        const next = passTurnAfter
          ? { turn: target.id, turnExpiry: expiry }
          : {};
        return { ...x, players, logs: [...x.logs, resultLog], ...next };
      });
      await commitArenaMatches(updatedMatches, null, meta.matches);
      return; // on pass, the watcher re-fires with pendingControlSave cleared
    }

    if (aiPlayer.pendingSaveDot) {
      const dot     = aiPlayer.pendingSaveDot;
      const ability = dot.ability || "con";
      const dc      = dot.dc || 13;
      const mod     = defenderSaveMod(aiSnap, ability);
      const saveBuffActive = (aiPlayer.saveBuffAttacks ?? 0) > 0;
      const saveBuffBonus  = saveBuffActive ? (aiPlayer.saveBuffBonus ?? 0) : 0;
      // Armatura pesante → TS a svantaggio contro spell fulmine/tuono.
      const _elemDisadv = isHeavyArmor(aiSnap) && ["fulmine", "tuono"].includes(dot.element);
      const _d20a = Math.floor(Math.random() * 20) + 1;
      const _d20b = _elemDisadv ? Math.floor(Math.random() * 20) + 1 : 0;
      const d20 = _elemDisadv ? Math.min(_d20a, _d20b) : _d20a;
      const lbl = SAVE_LABEL[ability] || ability.toUpperCase();
      await showD20Roll(d20, { label: `${aiName} tira il proprio TS · ${lbl}` });
      const total = d20 + mod + saveBuffBonus;
      const pass  = total >= dc;
      const sign  = mod >= 0 ? "+" : "";
      const buffTag = saveBuffBonus > 0 ? `+${saveBuffBonus}🛡` : "";
      const dotName = dot.name || "Veleno";
      const dotIcon = dot.icon || "🤢";

      const resultLog = pass
        ? `${dotIcon} ${aiName} TS ${lbl} (${dotName}): ${d20}${sign}${mod}${buffTag}=${total} vs CD ${dc} → ✅ PASSA — resiste!`
        : `${dotIcon} ${aiName} TS ${lbl} (${dotName}): ${d20}${sign}${mod}${buffTag}=${total} vs CD ${dc} → ❌ FALLISCE — Avvelenato! ${dot.dice || "2d6"} a inizio turno per ${dot.turns ?? 3} turni.`;

      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const players = x.players.map(p => {
          if (p.id !== aiId) return p;
          const up = { ...p };
          delete up.pendingSaveDot;
          if (saveBuffActive) {
            const newAtk = Math.max(0, (p.saveBuffAttacks ?? 0) - 1);
            up.saveBuffAttacks = newAtk;
            if (newAtk === 0) up.saveBuffBonus = 0;
          }
          if (!pass) {
            up.poisonDoT = true;
            up.poisonDoTTurns = dot.turns ?? 3;
            up.poisonDoTDice  = dot.dice  ?? "2d6";
            up.poisonDoTSourceLabel = dotName;
            up.poisonDoTIcon = dotIcon;
          }
          return up;
        });
        return { ...x, players, logs: [...x.logs, resultLog] };
      });
      await commitArenaMatches(updatedMatches, null, meta.matches);
      return; // watcher will re-fire; AI then acts (or ticks poison) next time
    }

    // Apply a pending poisonDoT tick at the very start of the AI's turn —
    // mirrors the human flow where the poison hits on turn entry.
    if (aiPlayer.poisonDoT && (aiPlayer.poisonResolvedTurnToken || "") !== (m.turnExpiry || "")) {
      const dice = aiPlayer.poisonDoTDice || "1d6";
      const { total: poisonRawDmg, rolls: poisonRolls } = rollDmg(dice);
      const poisonDmg = Math.round(poisonRawDmg * dotResistMult(aiSnap, aiPlayer));
      const sourceLabel = aiPlayer.poisonDoTSourceLabel || "veleno";
      const icon = aiPlayer.poisonDoTIcon || "☠";
      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const rawPlayers = x.players.map(p => {
          if (p.id !== aiId) return p;
          const remaining = Math.max(0, (p.poisonDoTTurns ?? 1) - 1);
          const stillAfflicted = remaining > 0;
          return {
            ...p,
            hp: Math.max(0, (p.hp ?? 0) - poisonDmg),
            poisonDoT: stillAfflicted,
            poisonDoTTurns: remaining,
            poisonResolvedTurnToken: x.turnExpiry || "",
            ...(stillAfflicted ? {} : {
              poisonDoTDice: null, poisonDoTSourceLabel: null, poisonDoTIcon: null,
            }),
          };
        });
        const log = `${icon} ${aiName} subisce il ${sourceLabel}: ${poisonDmg} danni [🎲${dice}=${poisonRolls}]!`;
        // If poison kills the AI, end the match.
        const meAfter = rawPlayers.find(p => p.id === aiId);
        if ((meAfter?.hp ?? 0) <= 0) {
          const alive = rawPlayers.filter(p => p.hp > 0);
          if (alive.length === 1) {
            return { ...x, players: rawPlayers, status: "finished", winner: alive[0].id, logs: [...x.logs, log, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
          }
        }
        return { ...x, players: rawPlayers, logs: [...x.logs, log] };
      });
      await commitArenaMatches(updatedMatches, null, meta.matches);
      return; // watcher re-fires; AI then takes its action
    }

    // Apply pending bleedDoT tick (sanguinamento da Triboli) — stack indipendente dal veleno.
    if (aiPlayer.bleedDoT && (aiPlayer.bleedResolvedTurnToken || "") !== (m.turnExpiry || "")) {
      const dice = aiPlayer.bleedDoTDice || "1d6";
      const { total: bleedDmg, rolls: bleedRolls } = rollDmg(dice);
      const sourceLabel = aiPlayer.bleedDoTSourceLabel || "sanguinamento";
      const icon = aiPlayer.bleedDoTIcon || "🩸";
      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const rawPlayers = x.players.map(p => {
          if (p.id !== aiId) return p;
          const remaining = Math.max(0, (p.bleedDoTTurns ?? 1) - 1);
          const stillAfflicted = remaining > 0;
          return {
            ...p,
            hp: Math.max(0, (p.hp ?? 0) - bleedDmg),
            bleedDoT: stillAfflicted,
            bleedDoTTurns: remaining,
            bleedResolvedTurnToken: x.turnExpiry || "",
            ...(stillAfflicted ? {} : {
              bleedDoTDice: null, bleedDoTSourceLabel: null, bleedDoTIcon: null,
            }),
          };
        });
        const log = `${icon} ${aiName} subisce il ${sourceLabel}: ${bleedDmg} danni [🎲${dice}=${bleedRolls}]!`;
        const meAfter = rawPlayers.find(p => p.id === aiId);
        if ((meAfter?.hp ?? 0) <= 0) {
          const alive = rawPlayers.filter(p => p.hp > 0);
          if (alive.length === 1) {
            return { ...x, players: rawPlayers, status: "finished", winner: alive[0].id, logs: [...x.logs, log, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
          }
        }
        return { ...x, players: rawPlayers, logs: [...x.logs, log] };
      });
      await commitArenaMatches(updatedMatches, null, meta.matches);
      return;
    }

    // ── Control budget burning down without a pending save (rare edge case) ──
    if ((aiPlayer.controlLostTurns ?? 0) > 0 && !aiPlayer.pendingControlSave) {
      const remaining = Math.max(0, (aiPlayer.controlLostTurns ?? 0) - 1);
      const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const players = x.players.map(p =>
          p.id === aiId
            ? { ...p, controlLostTurns: remaining, multiActionsUsed: 0, frenzyAttackPending: false, mightyStrikePending: false, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false }
            : p
        );
        return { ...x, players, turn: target.id, turnExpiry: expiry, logs: [...x.logs, `🌀 ${aiName} è sotto controllo: turno saltato (${remaining} rimanenti).`] };
      });
      await commitArenaMatches(updatedMatches, null, meta.matches);
      return;
    }

    const cls    = (aiSnap.class || "").toLowerCase();
    const maxHp  = aiSnap.stats?.maxHp ?? aiPlayer.maxHp ?? 70;
    const hpPct  = aiPlayer.hp / maxHp;
    const usedSoFar = aiPlayer.multiActionsUsed ?? 0;
    const isFirstAttackThisTurn = usedSoFar === 0;
    const tsNow  = new Date().toISOString();

    // ── FREE-ITEM PHASE: heal when hurting (uses a Pozione di Cura), then
    //    keep going with an attack. Gli oggetti sono azione gratuita: non
    //    consumano azione né bonus action, ma uno solo per turno. ──
    if (
      isFirstAttackThisTurn &&
      hpPct < 0.35 &&
      (aiPlayer.itemUsesLeft?.pozione_cura ?? 0) > 0 &&
      !aiPlayer.itemUsedThisTurn
    ) {
      const { total: heal, rolls: healRolls } = rollDmg("2d12");
      const newHp = Math.min(maxHp, aiPlayer.hp + heal);
      const healLog = {
        pub: `🧪 ${aiSnap.name} usa Pozione di Cura [🎲${healRolls}=${heal}] — recupera ${heal} HP (${newHp} HP) · azione gratuita`,
        ts: tsNow,
      };
      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const players = x.players.map(p => {
          if (p.id !== aiId) return p;
          const newUses = { ...(p.itemUsesLeft || {}), pozione_cura: Math.max(0, (p.itemUsesLeft?.pozione_cura ?? 0) - 1) };
          return { ...p, hp: newHp, itemUsesLeft: newUses, itemUsedThisTurn: true };
        });
        return { ...x, players, logs: [...x.logs, healLog] };
      });
      await commitArenaMatches(withArenaFx(updatedMatches, matchId, "heal", aiId), null, meta.matches);
      return; // next tick of the useEffect will trigger the attack
    }

    // Pre-attack buff state to set on the AI's own player object (rage,
    // hunter's mark, smite-style flags). Triggered on the first attack of
    // the fight to mirror how human players burn their bonus action.
    const buffPatch = {};
    let preLog = null;
    if (isFirstAttackThisTurn && (aiPlayer.aiBuffActivated !== true)) {
      // Durate e effetti IDENTICI alle abilità dei giocatori (Furia: +2 danni/3t;
      // Marchio del Cacciatore: +3 AL COLPIRE/3t). Niente buff inventati.
      if (cls.includes("barbar") && !aiPlayer.rageTurns) {
        buffPatch.rageTurns = 3;
        buffPatch.aiBuffActivated = true;
        preLog = { pub: `🔥 ${aiSnap.name} entra in Furia! (+2 danni e riduzione danni subiti per 3 turni)`, ts: tsNow };
      } else if ((cls.includes("ranger") || cls.includes("cacciat")) && !aiPlayer.hunterMarkTurns) {
        buffPatch.hunterMarkTurns = 3;
        buffPatch.aiBuffActivated = true;
        preLog = { pub: `🎯 ${aiSnap.name} marca ${target.name}! (+3 al colpire per 3 turni)`, ts: tsNow };
      } else if (cls.includes("paladin") || cls.includes("fighter")) {
        // Paladino/Guerriero: nessun buff fittizio (il Paladino NON ha un'aura
        // "+colpire"). Attaccano; il Guerriero tiene lo Scatto d'Azione per dopo.
        buffPatch.aiBuffActivated = true;
      }
    }

    // ── SPELL PHASE — cast a spell if it scores higher than the best weapon ──
    // Mirrors how a competent caster plays: trucchetti for chip damage,
    // lv1+ slots for control/burst, self-buffs early. We score every
    // available spell and the best weapon swing, then commit to the
    // highest. Spells that target the human (control/save_dot/damage)
    // produce the same pendingSave bookkeeping as the human casting them.
    const _ALL_ACTIONS = aiSnap.selectedActions || [];
    const _allSpells = _ALL_ACTIONS.filter(a => a.type === "spell");
    if (_allSpells.length > 0) {
      const _usesLeftMap = aiPlayer.actionUsesLeft || {};
      const _hasUses = (a) => (_usesLeftMap[a.name] ?? a.maxUses ?? 999) > 0;
      const _avg = (formula) => {
        const mtx = /^(\d+)d(\d+)/.exec(formula || "");
        if (!mtx) return 0;
        return parseInt(mtx[1], 10) * (parseInt(mtx[2], 10) + 1) / 2;
      };

      const _castAbility = getSpellcastingAbility(cls);
      const _spellMod    = aiSnap.stats?.[_castAbility] ?? 0;
      const _spellDC     = 8 + getProficiencyBonus(aiSnap) + _spellMod;
      const _tgtMP       = m.players.find(p => p.id === target.id);
      const _tgtCtrl     = !!_tgtMP?.pendingControlSave || (_tgtMP?.controlLostTurns ?? 0) > 0;
      const _tgtPoison   = !!_tgtMP?.pendingSaveDot || !!_tgtMP?.poisonDoT;
      // Heuristic fail-chance: assumes the target's TS mod ≈ 0 (good enough
      // for scoring; the real roll happens at resolution time).
      const _failChance  = Math.max(0.15, Math.min(0.9, (_spellDC - 10) / 20));

      const _candidates = [];
      for (const sp of _allSpells) {
        if (!_hasUses(sp)) continue;
        if (sp.special === "shield_buff") {
          if ((aiPlayer.shieldSkillTurns ?? 0) === 0 && hpPct < 0.85) {
            _candidates.push({ kind: "shield_buff", spell: sp, score: 7 });
          }
        } else if (sp.special === "save_buff") {
          if ((aiPlayer.saveBuffAttacks ?? 0) === 0) {
            _candidates.push({ kind: "save_buff", spell: sp, score: 6 });
          }
        } else if (sp.special === "heal" || ((sp.info || "").toLowerCase().includes("cura") && (sp.damage || "—") !== "—")) {
          if (hpPct < 0.55) _candidates.push({ kind: "heal", spell: sp, score: 12 });
        } else if (sp.special === "control") {
          if (!_tgtCtrl) _candidates.push({ kind: "control", spell: sp, score: 14 * _failChance + 4 });
        } else if (sp.special === "save_dot") {
          if (!_tgtPoison) {
            const dotAvg = _avg(sp.saveDotDamage || "2d6") * (sp.saveDotTurns ?? 3);
            _candidates.push({ kind: "save_dot", spell: sp, score: dotAvg * _failChance });
          }
        } else if (isSaveDamageSpell(sp)) {
          // Danno atteso in base alla meccanica reale dell'incantesimo:
          //  auto = sempre · attacco ≈ 65% · TS dimezza = pieno se fallisce + metà se supera · TS annulla = solo se fallisce.
          const dmgAvg = _avg(sp.damage) + _spellMod;
          const { cast: _cm } = getSpellCast(sp);
          const expected = _cm === "auto"      ? dmgAvg
                         : _cm === "attack"    ? dmgAvg * 0.65
                         : _cm === "save_half" ? dmgAvg * (0.5 + 0.5 * _failChance)
                         :                       dmgAvg * _failChance;
          _candidates.push({ kind: "save_damage", spell: sp, score: expected });
        }
      }

      // Weapon baseline (best avg damage + stat mod)
      const _weaponsList = _ALL_ACTIONS.filter(a => a.type === "weapon");
      const _bestWpn = _weaponsList.slice().sort((a, b) => _avg(b.damage) - _avg(a.damage))[0];
      const _weaponBaseline = _bestWpn ? _avg(_bestWpn.damage) + (aiSnap.stats?.[_bestWpn.statKey || "str"] ?? 0) : 0;
      // Caster bias — a wizard/cleric/etc. should lean on spells.
      const _isCaster = (
        cls.includes("mago") || cls.includes("wizard") ||
        cls.includes("strego") || cls.includes("sorcerer") ||
        cls.includes("warlock") ||
        cls.includes("cleric") || cls.includes("chierico") ||
        cls.includes("druid") || cls.includes("druido") ||
        cls.includes("bard") || cls.includes("bardo")
      );
      const _casterBias = _isCaster ? 3 : 0;

      const _picked = _candidates.sort((a, b) => b.score - a.score)[0];

      if (_picked && (_picked.score + _casterBias) > _weaponBaseline) {
        const sp = _picked.spell;
        const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();

        let logMsg;
        let dmgToTarget = 0;
        let aiPatch = {};
        let healFxTargetId = null; // se valorizzato → VFX cura pixelata su quel player
        let spellElemNote = null;  // Bruciatura/Congelato da magia elementale dell'IA
        const targetPatch = {};

        if (_picked.kind === "shield_buff") {
          const turns = sp.shieldBuffTurns ?? 3;
          const bonus = sp.shieldBuffBonus ?? 1;
          aiPatch = { shieldSkillTurns: turns, shieldSkillBonus: bonus };
          logMsg = `${sp.icon || "🛡"} ${aiName} lancia ${sp.name} — +${bonus} CA per ${turns} turni.`;
        } else if (_picked.kind === "save_buff") {
          const atk = sp.tsAttacks ?? 3;
          const bonus = sp.tsBonus ?? 3;
          aiPatch = { saveBuffAttacks: atk, saveBuffBonus: bonus };
          logMsg = `${sp.icon || "🔰"} ${aiName} lancia ${sp.name} — +${bonus} ai prossimi ${atk} TS.`;
        } else if (_picked.kind === "heal") {
          const { total: hDice, rolls: hRolls } = rollDmg(clericBlessedDice(sp.damage || "2d8", aiSnap));
          const healAmt = Math.max(1, hDice + _spellMod);
          const newHp = Math.min(maxHp, aiPlayer.hp + healAmt);
          aiPatch = { hp: newHp };
          healFxTargetId = aiId;
          const modPart = _spellMod !== 0 ? `${_spellMod >= 0 ? "+" : ""}${_spellMod}` : "";
          logMsg = `${sp.icon || "💚"} ${aiName} lancia ${sp.name} — cura sé stesso di ${healAmt} HP [🎲${hRolls}${modPart}].`;
        } else if (_picked.kind === "control") {
          const saveAbility = parseSpellSaveAbility(sp);
          targetPatch.pendingControlSave = true;
          targetPatch.pendingControlDC = _spellDC;
          targetPatch.pendingControlSaveAbility = saveAbility;
          targetPatch.controlLostTurns = 2;
          logMsg = `${sp.icon || "🌀"} ${aiName} lancia ${sp.name} su ${target.name} → TS ${SAVE_LABEL[saveAbility]} (CD ${_spellDC}) richiesto!`;
        } else if (_picked.kind === "save_dot") {
          const saveAbility = sp.saveDotAbility || "con";
          const dotDC = sp.saveDotDC ?? _spellDC;
          targetPatch.pendingSaveDot = {
            ability: saveAbility,
            dc: dotDC,
            dice: sp.saveDotDamage || "2d6",
            turns: sp.saveDotTurns ?? 3,
            name: sp.name,
            icon: sp.icon,
            element: actionElement(sp),
          };
          logMsg = `${sp.icon || "🤢"} ${aiName} lancia ${sp.name} su ${target.name} → TS ${SAVE_LABEL[saveAbility]} (CD ${dotDC}) richiesto!`;
        } else if (_picked.kind === "save_damage") {
          // Meccanica ufficiale D&D 5e per nome: attack / save_half / save_negate / auto.
          // CD/bonus al colpire dalla classe dell'IA; il TS umano è nella stat dello spell.
          const { cast: castMode, save: saveAbil } = getSpellCast(sp);
          const tgtSaveBuff = (_tgtMP?.saveBuffAttacks ?? 0) > 0 ? (_tgtMP?.saveBuffBonus ?? 0) : 0;
          const tgtFaith    = readSaveFaithBonus(_tgtMP);
          let connected = false, halfDamage = false, critHit = false, outLog = "";
          if (castMode === "auto") {
            connected = true; outLog = "colpisce automaticamente";
          } else if (castMode === "attack") {
            const spellHit = getSpellAttackBonus(aiSnap);
            const targetAc = targetAcNow(_tgtMP, targetSnap);
            // Armatura pesante vs fulmine/tuono → l'attaccante tira a vantaggio.
            const _advAI = heavyElemAttackAdv(sp, targetSnap);
            const _r1 = Math.floor(Math.random() * 20) + 1;
            const _r2 = _advAI ? Math.floor(Math.random() * 20) + 1 : 0;
            const d20 = _advAI ? Math.max(_r1, _r2) : _r1;
            await showD20Roll(d20, { label: `${aiName} tira per colpire · ${sp.name}${_advAI ? " (vantaggio)" : ""}` });
            const totalHit = d20 + spellHit;
            // Niente critico sugli incantesimi: nat 20 colpisce, nat 1 manca, ma danni mai raddoppiati.
            connected = d20 === 20 || (d20 !== 1 && totalHit >= targetAc);
            outLog = connected
              ? `colpisce [d20 ${d20}+${spellHit}=${totalHit} vs CA ${targetAc}]`
              : `manca [d20 ${d20}+${spellHit}=${totalHit} vs CA ${targetAc}]`;
          } else {
            const defMod = defenderSaveMod(targetSnap, saveAbil);
            const d20 = Math.floor(Math.random() * 20) + 1;
            // Etichetta esplicita: è la spell DELL'IA, il bersaglio tira il TS
            // (prima "TS COS · Spell" sembrava legato all'azione precedente del player).
            await showD20Roll(d20, { label: `${aiName} lancia ${sp.name} → ${target.name} tira il TS ${SAVE_LABEL[saveAbil]}` });
            const tsTotal = d20 + defMod + tgtSaveBuff + tgtFaith;
            const saved = tsTotal >= _spellDC;
            connected  = !saved || castMode === "save_half";
            halfDamage = saved && castMode === "save_half";
            const buffBits = `${tgtSaveBuff > 0 ? `+${tgtSaveBuff}🛡` : ""}${tgtFaith > 0 ? `+${tgtFaith}✝` : ""}`;
            outLog = saved
              ? `supera il TS ${SAVE_LABEL[saveAbil]} [${tsTotal}${buffBits} ≥ CD ${_spellDC}] — ${castMode === "save_half" ? "danni dimezzati" : "nessun danno"}`
              : `fallisce il TS ${SAVE_LABEL[saveAbil]} [${tsTotal}${buffBits} < CD ${_spellDC}]`;
            if (tgtSaveBuff > 0) {
              const newAtk = Math.max(0, (_tgtMP?.saveBuffAttacks ?? 0) - 1);
              targetPatch.saveBuffAttacks = newAtk;
              if (newAtk === 0) targetPatch.saveBuffBonus = 0;
            }
          }
          let { total: dmg } = connected ? rollDmg(clericBlessedDice(sp.damage, aiSnap)) : { total: 0 };
          if (critHit && connected) dmg += rollDmg(clericBlessedDice(sp.damage, aiSnap)).total; // crit: dadi raddoppiati
          const _aiSubSpell = connected ? (getSubclassEffect(aiSnap).spellDmg || 0) + subclassDamageDice(aiSnap, true).bonus : 0;
          let raw = connected ? Math.max(0, dmg + _spellMod + _aiSubSpell) : 0;
          if (halfDamage) raw = Math.floor(raw / 2);
          // Difese del bersaglio contro la magia (Elusione, sottoclassi, Furia).
          const _rawTyped = Math.round(raw * spellResistMult(sp, targetSnap));
          dmgToTarget = _rawTyped > 0 ? applyDefenderDamageMods(_rawTyped, targetSnap, _tgtMP, true) : 0;
          // Regole elementali base: magia di fuoco/ghiaccio dell'IA → Bruciatura/Congelato.
          const _spellElem = elementalOnHitStatus(sp, true, targetSnap, _tgtMP, dmgToTarget, connected);
          Object.assign(targetPatch, _spellElem.patch);
          if (_spellElem.note) spellElemNote = `${target.name} — ${_spellElem.note}`;
          logMsg = connected
            ? `✨ ${aiName} → ${sp.icon || "✨"} ${sp.name}: ${outLog} su ${target.name} — ${dmgToTarget} danni.`
            : `✨ ${aiName} → ${sp.name}: ${outLog} su ${target.name} — nessun danno.`;
        }

        // Multi-action logic — only damage spells get the multi-action
        // privilege (rogue/monk double-tap). Control/save_dot/heal/buff
        // always end the AI's turn, matching the human handlers.
        const baseMax = (cls.includes("monk") || cls.includes("monaco") || cls.includes("rogue") || cls.includes("ladr")) ? 2 : 1;
        const effectiveMax = baseMax + ((aiPlayer.actionSurgeActive ? 1 : 0));
        const isDamageSpell = _picked.kind === "save_damage";
        const stayingThisTurn = isDamageSpell && (usedSoFar + 1) < effectiveMax;
        const newMultiUsed = stayingThisTurn ? (usedSoFar + 1) : 0;
        const passTurnAfterSpell = !stayingThisTurn;

        let spellAbsorbedLog = null;
        const updatedMatches = meta.matches.map(x => {
          if (x.matchId !== matchId) return x;
          const rawPlayers = x.players.map(p => {
            if (p.id === target.id) {
              // Monk's "Assorbire Danni" also catches save-based damage spells.
              if (p.absorbDamageNext && dmgToTarget > 0) {
                const tgtMaxHp = targetSnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
                const heal = Math.floor(dmgToTarget * 0.8);
                spellAbsorbedLog = `🌀 ${p.name} assorbe il colpo e si cura di ${heal} HP!`;
                return {
                  ...p,
                  hp: Math.min(tgtMaxHp, (p.hp ?? 0) + heal),
                  absorbDamageNext: false,
                  ...targetPatch,
                  ...consumeInvisibility(p),
                  stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1),
                };
              }
              const newHp = Math.max(0, (p.hp ?? 0) - dmgToTarget);
              return {
                ...p,
                hp: newHp,
                ...targetPatch,
                ...consumeInvisibility(p),
                stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1),
              };
            }
            if (p.id === aiId) {
              const newUses = {
                ...(p.actionUsesLeft || {}),
                [sp.name]: Math.max(0, ((p.actionUsesLeft?.[sp.name]) ?? sp.maxUses ?? 1) - 1),
              };
              const turnEndPatch = stayingThisTurn ? {} : {
                rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), frenzyAttackPending: false, mightyStrikePending: false, ...(frenzyExhausted(p) ? { frenzySpent: false } : {}),
                hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1),
                shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1),
                concentrationTurns: Math.max(0, (p.concentrationTurns ?? 0) - 1),
                pattoTurns: Math.max(0, (p.pattoTurns ?? 0) - 1),
                armorForgeTurns: Math.max(0, (p.armorForgeTurns ?? 0) - 1),
                selfAdvTurns: Math.max(0, (p.selfAdvTurns ?? 0) - 1),
                ...tickEagleEnd(p),
                aidBuff: false,
                bonusActionUsed: false, itemUsedThisTurn: false,
                actionSurgeActive: false,
                multiActionsUsed: 0,
              };
              return {
                ...p,
                ...aiPatch,
                actionUsesLeft: newUses,
                multiActionsUsed: newMultiUsed,
                aiAttacksMade: (p.aiAttacksMade ?? 0) + 1,
                aiBuffActivated: true,
                ...turnEndPatch,
              };
            }
            return p;
          });

          const alive = rawPlayers.filter(pp => pp.hp > 0);
          const logs = [...x.logs, logMsg];
          if (spellAbsorbedLog) logs.push(spellAbsorbedLog);
          if (spellElemNote) logs.push(spellElemNote);
          if (alive.length === 1) {
            logs.push(`🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`);
            return { ...x, players: rawPlayers, status: "finished", winner: alive[0].id, logs };
          }
          if (passTurnAfterSpell) {
            const human = rawPlayers.find(pp => pp.id !== aiId);
            return { ...x, players: rawPlayers, turn: human.id, turnExpiry: expiry, logs };
          }
          return { ...x, players: rawPlayers, logs };
        });

        // VFX pixelato per le spell AI: cura sull'AI, altrimenti bolt arcano/elementale
        // sul bersaglio (elemento dedotto dal testo del log).
        let aiSpellFx = null;
        if (healFxTargetId) {
          aiSpellFx = { effect: "heal", targetId: healFxTargetId };
        } else if (target?.id && (dmgToTarget > 0 || _picked.kind === "control" || _picked.kind === "save_dot")) {
          aiSpellFx = { effect: classifyArenaVfx({ pub: logMsg }) || "magic", targetId: target.id };
        }
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: aiSpellFx
            ? withArenaFx(updatedMatches, matchId, aiSpellFx.effect, aiSpellFx.targetId, aiId)
            : updatedMatches,
        });
        return; // spell consumed the action; watcher re-fires if multi-action
      }
    }

    // ── ATTACK PHASE ──
    const weapons = (aiSnap.selectedActions || []).filter(a => a.type === "weapon");
    // 🔩 Arma incandescente (Riscaldare Arma / Disarmare): sono bloccate SOLO le
    // armi arroventate al momento del blocco (quelle equipaggiate allora). Senza
    // elenco (match legacy) sono bloccate tutte. L'IA può ripiegare su un'arma
    // diversa non arroventata; se non ne ha, passa il turno (vedi sotto).
    const _aiLockTurns = aiPlayer.weaponLockTurns ?? 0;
    const _aiLockNames = aiPlayer.weaponLockNames;
    const _isWpnLocked = (w) => _aiLockTurns > 0 &&
      (!_aiLockNames || _aiLockNames.length === 0 ? true : _aiLockNames.includes(w.name));
    const availableWeapons = weapons.filter(w => !_isWpnLocked(w));

    // Nessun'arma utilizzabile (incandescenza totale o build senza armi) e nessun
    // incantesimo lanciato in questo tick → l'IA passa il turno (scelta sua) e fa
    // scalare i timer a round, incluso il blocco arma: ogni turno saltato conta.
    // Senza questo ramo il turno restava incastrato sull'IA o il debuff non scalava.
    if (availableWeapons.length === 0) {
      const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
      const lockedOut = _aiLockTurns > 0 && weapons.length > 0;
      const passLog = lockedOut
        ? `🔩 ${aiName} ha l'arma incandescente e non può attaccare — passa il turno.`
        : `⏭ ${aiName} non ha attacchi disponibili — passa il turno.`;
      const updatedMatches = meta.matches.map(x => {
        if (x.matchId !== matchId) return x;
        const players = x.players.map(p => {
          if (p.id !== aiId) return p;
          return {
            ...p,
            multiActionsUsed: 0,
            turnWeaponsUsed: [],
            turnSkillUsed: false,
            bonusActionUsed: false,
            itemUsedThisTurn: false,
            actionSurgeActive: false,
            ...tickEagleEnd(p),
            ...consumeInvisibility(p),
            rageTurns:        Math.max(0, (p.rageTurns ?? 0) - 1),
            shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1),
            hunterMarkTurns:  Math.max(0, (p.hunterMarkTurns ?? 0) - 1),
            concentrationTurns: Math.max(0, (p.concentrationTurns ?? 0) - 1),
            armorForgeTurns:  Math.max(0, (p.armorForgeTurns ?? 0) - 1),
            selfAdvTurns:     Math.max(0, (p.selfAdvTurns ?? 0) - 1),
            stealthAdvTurns:  Math.max(0, readStealthAdvTurns(p) - 1),
            attackDisadvantageTurns: Math.max(0, (p.attackDisadvantageTurns ?? 0) - 1),
            weaponLockTurns:  Math.max(0, (p.weaponLockTurns ?? 0) - 1),
          };
        });
        return { ...x, players, turn: target.id, turnExpiry: expiry, logs: [...x.logs, passLog] };
      });
      await commitArenaMatches(updatedMatches, null, meta.matches);
      return;
    }

    const avgDmg = (formula) => {
      const mtx = /^(\d+)d(\d+)/.exec(formula || "");
      if (!mtx) return 0;
      return parseInt(mtx[1], 10) * (parseInt(mtx[2], 10) + 1) / 2;
    };
    const sortedWeapons = availableWeapons.slice().sort((a, b) => avgDmg(b.damage) - avgDmg(a.damage));
    // Rogue/Monk multi-action: rotate through weapons. Single-weapon classes
    // just always use the best. Si ruota solo sulle armi NON arroventate.
    let chosen = (availableWeapons.length > 1 && (cls.includes("rogue") || cls.includes("ladr") || cls.includes("monk") || cls.includes("monaco")))
      ? availableWeapons[usedSoFar % availableWeapons.length]
      : sortedWeapons[0];
    // Monaco a mani nude: 1° colpo Pugno (2d4+DES), 2° colpo Calcio (1d4+FOR).
    if (chosen?.unarmedMonk) chosen = resolveMonkUnarmed(chosen, usedSoFar, aiSnap?.arenaBuffs);

    const armorPenalty   = aiSnap.selectedArmor?.hitPenalty ?? 0;
    const statKey        = chosen.statKey || "str";
    const statMod        = aiSnap.stats?.[statKey] ?? 0;
    // Apply pre-buffs to the bonus picture too.
    const effRageTurns       = (buffPatch.rageTurns ?? aiPlayer.rageTurns ?? 0) > 0;
    const effHunterMark      = (buffPatch.hunterMarkTurns ?? aiPlayer.hunterMarkTurns ?? 0) > 0;
    const effAidBonus        = readActiveBonus(buffPatch.aidBuff ?? aiPlayer.aidBuff, 4);
    const rageDmgBonus       = effRageTurns ? rageDamageBonus(getSnapLevel(aiSnap)) : 0;
    const hunterMarkHitBonus = effHunterMark ? 3 : 0;   // Marchio = +3 AL COLPIRE (come il player)
    // Fighter: crit on 19+ (Critico Migliorato).
    const isFighter   = cls.includes("fighter") || cls.includes("guerr");
    const critThresh  = subclassCritThreshold(aiSnap, isFighter ? 19 : 20);

    // Roll attack — fighter rerolls 1s (Presenza Possente).
    // Vantaggio/svantaggio: stessa regola del giocatore. Si annullano se entrambi presenti.
    const tgtMatchPlayer  = m.players.find(p => p.id === target.id);
    const aiEagleActive   = (aiPlayer.eagleDebuffTurns ?? 0) > 0;
    // DISTANZA: l'IA che attacca in mischia mentre è lontana, contro un bersaglio che
    // impugna un'arma a distanza, tira a svantaggio (e più sotto chiude la distanza).
    const aiWpnRanged       = WEAPON_IS_RANGED(chosen);
    const aiTgtHasRanged    = PLAYER_HAS_RANGED_WEAPON(tgtMatchPlayer, targetSnap);
    const aiFarNow          = !m.distanceClosed;
    const aiMeleeFarDisadv  = !aiWpnRanged && aiFarNow && aiTgtHasRanged;
    // Tiro in arretramento IA (kiting): spara indietreggiando → svantaggio + 1 carica.
    const aiWillKite        = aiWpnRanged && !aiFarNow && !aiTgtHasRanged && (aiPlayer.kiteChargesUsed ?? 0) < ARENA_KITE_MAX;
    const aiFS            = subclassFirstStrike(aiSnap, false, tgtMatchPlayer, targetSnap); // Ladro "assassino" / Monaco "ombra" (IA)
    const aiHasAdvantage  = readStealthAdvTurns(aiPlayer) > 0 || (aiPlayer.selfAdvTurns ?? 0) > 0 || aiFS.adv || heavyElemAttackAdv(chosen, targetSnap);
    // Barbaro Lv7 · Istinto Selvaggio: in Furia gli attacchi ignorano lo svantaggio (anche l'IA).
    const _aiRagingNoDisadv = isBarbarianClass(cls) && getSnapLevel(aiSnap) >= 7 && effRageTurns;
    const aiHasDisadvantage = _aiRagingNoDisadv ? false : (readStealthDisadvTurns(tgtMatchPlayer) > 0 || aiEagleActive || (aiPlayer.attackDisadvantageTurns ?? 0) > 0 || aiMeleeFarDisadv || aiWillKite || subclassForesightDisadv(targetSnap, tgtMatchPlayer));
    let d20a = Math.floor(Math.random() * 20) + 1;
    if (d20a === 1 && isFighter) d20a = Math.floor(Math.random() * 20) + 1;
    let d20b = (aiHasAdvantage || aiHasDisadvantage) ? Math.floor(Math.random() * 20) + 1 : 0;
    if (d20b === 1 && isFighter && (aiHasAdvantage || aiHasDisadvantage)) d20b = Math.floor(Math.random() * 20) + 1;
    const d20 = aiHasAdvantage && !aiHasDisadvantage ? Math.max(d20a, d20b)
              : aiHasDisadvantage && !aiHasAdvantage ? Math.min(d20a, d20b)
              : d20a;
    const targetAc = targetAcNow(tgtMatchPlayer, targetSnap);

    const aiJackBonus = isBardClass(cls) && getSnapLevel(aiSnap) >= 2 ? 1 : 0; // Bardo · Tuttofare (Lv2): +1 al colpire
    const aiRangedHitBonus = subclassRangedHit(aiSnap, chosen, false); // Sottoclasse "tiratore"/"arco" (IA)
    const hitTotal = d20 + (chosen.hitBonus || 0) + statMod + armorPenalty + effAidBonus + hunterMarkHitBonus + aiJackBonus + aiRangedHitBonus;
    const aiLandsAssassinate = aiFS.crit && hitTotal >= targetAc; // Assassinare (IA)
    const isCrit   = d20 >= critThresh || aiLandsAssassinate;
    const isHit    = hitTotal >= targetAc || isCrit;

    let damage = 0;
    let damageRolls = "0";
    if (isHit) {
      const aiRerollMax = (IS_TWO_HANDED_MELEE(chosen) && getSubclassEffect(aiSnap).twoHandReroll) ? 2 : 0; // Arma Grande (IA)
      const { total, rolls } = rollDmg(chosen.damage, { rerollMax: aiRerollMax });
      const critMult = isCrit ? 2 : 1;
      const aiSubclassDmg = getSubclassEffect(aiSnap).weaponDmg || 0;
      const aiSubBonus = subclassDamageDice(aiSnap, false).bonus; // Sottoclasse (Fase 2): dado bonus arma (Artigliere) — solo attacchi con arma dell'IA
      const aiBeastRageBonus = beastRageDamageBonus(aiSnap, { ...aiPlayer, ...buffPatch }); // Furia Bestiale (Lv3)
      const aiDivineStrike = divineStrikeBonus(aiSnap, false); // Chierico Lv8 · Colpo Divino: +1d8 radiante
      const raw = (total + statMod + rageDmgBonus + aiSubclassDmg + aiBeastRageBonus) * critMult + aiDivineStrike + aiSubBonus;
      // Bottega: componenti elementali dell'arma IA + resistenze del bersaglio.
      const aiTyped = applyTypedDamage(raw, chosen, critMult, targetSnap, false, physicalFallbackType(chosen, aiSnap, aiPlayer));
      damage = applyDefenderDamageMods(aiTyped.total, targetSnap, tgtMatchPlayer, false);
      damageRolls = rolls;
    }

    const critTag = isCrit ? " ★CRITICO★" : "";
    const aidPart = effAidBonus ? ` +${effAidBonus} aiuto` : "";
    const ragePart= rageDmgBonus ? ` +${rageDmgBonus} furia` : "";
    const hmHitPart = hunterMarkHitBonus ? ` +${hunterMarkHitBonus} 🎯marchio` : "";
    const aiAdvTag = aiHasAdvantage && !aiHasDisadvantage ? ` 🌟vant.[${d20a},${d20b}]`
                   : aiHasDisadvantage && !aiHasAdvantage ? ` 🌑svant.[${d20a},${d20b}]`
                   : (aiHasAdvantage && aiHasDisadvantage) ? ` ⚖️ vant.+svant. annullati` : "";
    const breakdown = `d20=${d20}${aiAdvTag}+hit${chosen.hitBonus || 0}${statMod >= 0 ? "+" : ""}${statMod} ${statKey.toUpperCase()}${armorPenalty < 0 ? ` ${armorPenalty} arm.` : ""}${aidPart}${hmHitPart}=${hitTotal} vs CA ${targetAc}`;
    const attackLog = {
      pub: isHit
        ? `💥 ${aiSnap.name} colpisce ${target.name} con ${chosen.name}${critTag} — ${damage} danni`
        : `🛡️ ${aiSnap.name} manca ${target.name} con ${chosen.name} (${hitTotal} vs CA ${targetAc})`,
      att: isHit
        ? `💥 Colpisci ${target.name} con ${chosen.name} [${breakdown}]${critTag} → 🎲${damageRolls}${statMod !== 0 ? `${statMod >= 0 ? "+" : ""}${statMod}` : ""}${ragePart}${isCrit ? " ×2" : ""} = ${damage} danni`
        : `🛡️ Manchi ${target.name} con ${chosen.name} [${breakdown}]`,
      def: isHit
        ? `⚔️ ${aiSnap.name} ti colpisce con ${chosen.name}${critTag} — ${damage} danni`
        : `🛡️ ${aiSnap.name} ti ha mancato con ${chosen.name}`,
      ts: tsNow, attId: aiId, defId: target.id,
    };

    // ── ACTION SURGE decision (Fighter only) — fires once per match, on the
    //    first attack of any turn while bloodied (<70%) or whenever the AI
    //    has missed badly. Gives +1 action this turn. ──
    const wantsSurge =
      isFighter &&
      !aiPlayer.aiSurgeUsed &&
      isFirstAttackThisTurn &&
      (hpPct < 0.70 || (!isHit && Math.random() < 0.5));
    const surgePatch = wantsSurge ? { actionSurgeActive: true, aiSurgeUsed: true } : {};
    if (wantsSurge) {
      preLog = { pub: `⚡ ${aiSnap.name} attiva Scatto d'Azione! (azione extra questo turno)`, ts: tsNow };
    }

    // Multi-action arithmetic mirrors the existing player flow at line ~3070:
    // staying-this-turn iff (used+1) < maxActions. Action Surge bumps cap.
    // Stessa fonte dei giocatori (include l'Attacco Extra di Lv5 se l'IA è di livello).
    const baseMaxActions = getMaxActionsPerTurn(aiSnap, null);
    const effectiveMaxActions = baseMaxActions + (surgePatch.actionSurgeActive ? 1 : 0) + (aiPlayer.actionSurgeActive ? 1 : 0);
    const stayingThisTurn = (usedSoFar + 1) < effectiveMaxActions;

    // ── DISTANZA: chiusura (melee) o kiting (ranged) dopo l'attacco dell'IA ──
    let aiDistancePatch = {};
    let aiKiteInc = false;
    let aiDistanceLog = null;
    if (!aiWpnRanged && aiFarNow && aiTgtHasRanged) {
      aiDistancePatch = { distanceClosed: true };
      aiDistanceLog = `⚔️ ${aiSnap.name} carica, chiude la distanza e ingaggia ${target.name} in mischia.`;
    } else if (aiWillKite) {
      aiDistancePatch = { distanceClosed: false };
      aiKiteInc = true;
      const _left = ARENA_KITE_MAX - (aiPlayer.kiteChargesUsed ?? 0) - 1;
      aiDistanceLog = `🏹 ${aiSnap.name} spara indietreggiando e riapre la distanza da ${target.name} (${_left} ${_left === 1 ? "carica" : "cariche"} rimaste).`;
    }

    // Sottoclasse (Fase 2) · Ritorsione: se l'IA colpisce in MISCHIA un giocatore con una
    //   sottoclasse difensiva (Tempesta/Battaglia) e il giocatore sopravvive, l'IA subisce danni.
    const _aiDefRetaliate = defenderRetaliate(targetSnap);
    // Bilanciamento: la ritorsione scatta solo sul PRIMO attacco del turno (max 1/turno).
    const aiRetaliateDmg = (isHit && !aiWpnRanged && chosen.type === "weapon" && isFirstAttackThisTurn && _aiDefRetaliate.retaliate && ((tgtMatchPlayer?.hp ?? 0) - damage) > 0)
      ? rollDmg(_aiDefRetaliate.retaliate).total : 0;
    const aiRetaliateLog = aiRetaliateDmg > 0
      ? `${_aiDefRetaliate.retaliateLabel || "⚡ Ritorsione"} — ${target.name} colpisce di rimando ${aiSnap.name} per ${aiRetaliateDmg} danni!`
      : null;
    // Monaco · Mano Aperta (IA): colpendo in mischia, il prossimo attacco del bersaglio è a svantaggio.
    const aiStaggerApplies = isHit && !aiWpnRanged && chosen.type === "weapon" && !!getSubclassEffect(aiSnap).staggerOnHit;
    const aiStaggerLog = aiStaggerApplies ? `✊ ${aiSnap.name} sbilancia ${target.name}: il suo prossimo attacco è a svantaggio!` : null;
    // Arma della Bottega dell'IA con effetti all'impatto (malus al giocatore / bonus a sé).
    const _aiOnHit = (isHit && damage > 0 && Array.isArray(chosen.onHit) && chosen.onHit.length)
      ? applyMarketEffects(chosen.onHit, aiPlayer, tgtMatchPlayer, true, damage)
      : { selfPatch: {}, enemyPatch: {}, selfHeal: 0, enemyDmg: 0, logs: [] };
    const aiOnHitLog = _aiOnHit.logs.length ? `⚔️ ${chosen.name} all'impatto → ${_aiOnHit.logs.join(" · ")}` : null;

    let absorbedLog = null;
    const updatedMatches = meta.matches.map(x => {
      if (x.matchId !== matchId) return x;
      const rawPlayers = x.players.map(p => {
        if (p.id === target.id) {
          // Monk's "Assorbire Danni": next damage taken is converted into a 50% heal.
          if (p.absorbDamageNext && damage > 0) {
            const tgtMaxHp = targetSnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
            const heal = Math.floor(damage * 0.8);
            absorbedLog = `🌀 ${p.name} assorbe il colpo e si cura di ${heal} HP!`;
            return {
              ...p,
              hp: Math.min(tgtMaxHp, (p.hp ?? 0) + heal),
              absorbDamageNext: false,
              ...consumeInvisibility(p),
              ...(aiStaggerApplies ? { attackDisadvantageTurns: Math.max(p.attackDisadvantageTurns ?? 0, 1), ...disadvTag("Sbilanciato", "💫") } : {}),
              stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1),
            };
          }
          return {
            ...p,
            hp: Math.max(0, (p.hp ?? 0) - damage - _aiOnHit.enemyDmg),
            ...consumeInvisibility(p),
            ...(aiStaggerApplies ? { attackDisadvantageTurns: Math.max(p.attackDisadvantageTurns ?? 0, 1) } : {}),
            ..._aiOnHit.enemyPatch,
            stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1),
          };
        }
        if (p.id === aiId) {
          const newMultiUsed = stayingThisTurn ? (usedSoFar + 1) : 0;
          // End-of-turn buff decays mirror the human flow.
          const turnEndPatch = stayingThisTurn ? {} : {
            rageTurns:       Math.max(0, (p.rageTurns ?? 0) - 1),
            hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1),
            shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1),
            concentrationTurns: Math.max(0, (p.concentrationTurns ?? 0) - 1),
            pattoTurns: Math.max(0, (p.pattoTurns ?? 0) - 1),
            armorForgeTurns: Math.max(0, (p.armorForgeTurns ?? 0) - 1),
            selfAdvTurns: Math.max(0, (p.selfAdvTurns ?? 0) - 1),
            weaponLockTurns: Math.max(0, (p.weaponLockTurns ?? 0) - 1),
            ...tickEagleEnd(p),
            aidBuff:         false,
            bonusActionUsed: false, itemUsedThisTurn: false,
            actionSurgeActive: false,
            multiActionsUsed: 0,
          };
          // Use up aidBuff after the swing it powered.
          const consumedAid = effAidBonus ? { aidBuff: false } : {};
          const _aiMax = aiSnap?.stats?.maxHp ?? p.maxHp ?? (p.hp ?? 0);
          const _aiBaseHp = aiRetaliateDmg > 0 ? Math.max(0, (p.hp ?? 0) - aiRetaliateDmg) : (p.hp ?? 0);
          const _aiFinalHp = _aiOnHit.selfHeal > 0 ? Math.min(_aiMax, _aiBaseHp + _aiOnHit.selfHeal) : _aiBaseHp;
          return {
            ...p,
            ...buffPatch,
            ...surgePatch,
            ...consumedAid,
            multiActionsUsed: newMultiUsed,
            aiAttacksMade: (p.aiAttacksMade ?? 0) + 1,
            ...(aiKiteInc ? { kiteChargesUsed: (p.kiteChargesUsed ?? 0) + 1 } : {}),
            ...turnEndPatch,
            ..._aiOnHit.selfPatch,
            ...((aiRetaliateDmg > 0 || _aiOnHit.selfHeal > 0) ? { hp: _aiFinalHp } : {}),
          };
        }
        return p;
      });
      const alive = rawPlayers.filter(pp => pp.hp > 0);
      const logs  = [...x.logs];
      if (preLog) logs.push(preLog);
      logs.push(attackLog);
      if (absorbedLog) logs.push(absorbedLog);
      if (aiRetaliateLog) logs.push(aiRetaliateLog);
      if (aiStaggerLog) logs.push(aiStaggerLog);
      if (aiOnHitLog) logs.push(aiOnHitLog);
      if (aiDistanceLog) logs.push(aiDistanceLog);
      if (alive.length === 1) {
        logs.push(`🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`);
        return { ...x, players: rawPlayers, status: "finished", winner: alive[0].id, ...aiDistancePatch, logs };
      }
      if (stayingThisTurn) {
        return { ...x, players: rawPlayers, ...aiDistancePatch, logs };
      }
      const human = rawPlayers.find(pp => pp.id !== aiId);
      return {
        ...x,
        players: rawPlayers,
        turn: human.id,
        turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString(),
        ...aiDistancePatch,
        logs,
      };
    });
    await commitArenaMatches(updatedMatches, null, meta.matches);
  };

  // ── Guardiano dell'IA (Sfide Libere vs IA) — gira SOLO sul client di aiOwnerId ──
  // Robusto per costruzione:
  //  (1) un BATTITO ogni 1,5 s (più un risveglio a ogni snapshot) rilegge lo stato
  //      più recente da arenaMetaRef e programma iniziativa/azione se mancano;
  //  (2) i timer già programmati NON vengono cancellati dagli aggiornamenti di
  //      arena_meta (prima ogni snapshot — anche di altri match, scommesse, presenze —
  //      azzerava i timer lasciando acceso il segnalino "in corso": IA ferma finché
  //      non cambiava qualcosa, e all'iniziativa non cambiava mai nulla);
  //  (3) un'azione appesa oltre 25 s libera da sola il segnalino; gli errori sono
  //      catturati e il battito successivo riprova;
  //  (4) dopo un'azione il segnalino resta acceso 400 ms in più, così lo snapshot
  //      Firestore arriva prima del prossimo battito (niente doppia azione).
  // I PG-bot di RISERVA del torneo (kind group/final) sono guidati lato server dalla
  // Cloud Function `arenaBotTurns`, che dal 2026-09-17 fa anche da rete di sicurezza
  // per le Sfide all'IA quando questo browser è chiuso (idle ≥ 90 s).
  const aiTickRef = useRef(null);
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const inflight = aiInFlightRef.current; // key → { t: timer | null, at: ms }
    const STUCK_MS = 25000;
    const tick = () => {
      const meta = arenaMetaRef.current;
      if (!meta?.matches) return;
      const now = Date.now();
      for (const [k, v] of Object.entries(inflight)) {
        if (now - v.at > STUCK_MS) { if (v.t) clearTimeout(v.t); delete inflight[k]; }
      }
      for (const m of meta.matches) {
        if (m?.ai !== true || m.kind !== "fun" || m.aiOwnerId !== uid) continue;
        if (m.status !== "initiative" && m.status !== "active") continue;
        if (isAwaitingReady(m)) continue; // l'umano non ha ancora premuto "Iniziamo"
        const aiId = m.aiId;
        const aiPlayer = m.players?.find(p => p.id === aiId);
        if (!aiPlayer) continue;
        let key = null, run = null, delay = 0;
        if (m.status === "initiative" && !(aiPlayer.init > 0)) {
          key = `${m.matchId}:init`;
          run = () => aiRollInitiative(m.matchId);
          delay = 700 + Math.random() * 600;
        } else if (m.status === "active" && m.turn === aiId && aiPlayer.hp > 0) {
          // Status in sospeso (veleno / sanguinamento / controllo / TS) → tick rapido;
          // il ritardo scenico è riservato alla vera azione.
          const token = m.turnExpiry || "";
          const resolvingStatus =
            !!aiPlayer.pendingControlSave ||
            !!aiPlayer.pendingSaveDot ||
            (aiPlayer.poisonDoT && (aiPlayer.poisonResolvedTurnToken || "") !== token) ||
            (aiPlayer.bleedDoT  && (aiPlayer.bleedResolvedTurnToken  || "") !== token) ||
            ((aiPlayer.controlLostTurns ?? 0) > 0 && !aiPlayer.pendingControlSave);
          key = `${m.matchId}:turn`;
          run = () => aiTakeAction(m.matchId);
          delay = resolvingStatus
            ? 250 + Math.random() * 200
            : (aiPlayer.multiActionsUsed ?? 0) === 0
              ? 1200 + Math.random() * 900   // prima azione: pausa scenica
              : 600 + Math.random() * 400;   // azioni successive (ladro/monaco/scatto): più svelte
        }
        if (!key || inflight[key]) continue;
        const entry = { t: null, at: now };
        inflight[key] = entry;
        entry.t = setTimeout(async () => {
          entry.t = null;
          try { await run(); }
          catch (e) { console.warn("IA Arena, azione fallita (riprovo al prossimo battito):", e); }
          finally { setTimeout(() => { if (inflight[key] === entry) delete inflight[key]; }, 400); }
        }, delay);
      }
    };
    aiTickRef.current = tick;
    tick();
    const iv = setInterval(tick, 1500);
    return () => { clearInterval(iv); aiTickRef.current = null; }; // i timer in corso restano: rileggono lo stato da arenaMetaRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);
  // Risveglio immediato a ogni snapshot (il battito resta la rete di sicurezza).
  useEffect(() => { aiTickRef.current?.(); }, [arenaMeta]);

  // Helper: il match è bloccato dal pulsante Pausa? Le sfide libere (kind="fun") restano libere.
  const isMatchPausedForAction = (matchId) => {
    if (!arenaMeta?.timerPaused) return false;
    const m = arenaMeta.matches?.find(x => x.matchId === matchId);
    if (!m) return false;
    return m.kind !== "fun";
  };

  const handleAttack = async (matchId, targetId, action) => {
    if (actionInFlightRef.current) return; // anti–doppio click: l'azione precedente non è ancora confermata
    if (isMatchPausedForAction(matchId)) {
      alert("⏸ L'arena è in pausa. Non puoi agire finché il Master non riprende il match.");
      return;
    }
    actionInFlightRef.current = true;
    try {
      await _runAttack(matchId, targetId, action);
    } finally {
      actionInFlightRef.current = false;
    }
  };

  const _runAttack = async (matchId, targetId, action) => {
    const snapshots    = arenaMeta.characterSnapshots || {};
    const attackerSnap = snapshots[currentUser.uid];
    const defenderSnap = snapshots[targetId];
    const attName = attackerSnap?.name || "?";
    const defName = defenderSnap?.name || "?";

    // 🔩 Riscaldare Arma — blocca SOLO l'arma arroventata (quella equipaggiata al momento
    // del blocco). Un'arma diversa, non equipaggiata allora, può essere impugnata e usata.
    const _myMatchEarly = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
    if (action.type === "weapon" && (_myMatchEarly?.weaponLockTurns ?? 0) > 0) {
      const _lockNames = _myMatchEarly?.weaponLockNames;
      // Senza elenco (match legacy) blocca tutte le armi; altrimenti solo quelle arroventate.
      const _thisLocked = !_lockNames || _lockNames.length === 0 ? true : _lockNames.includes(action.name);
      if (_thisLocked) {
        alert(`🔩 ${action.name} è incandescente! Cambia su un'altra arma per ${_myMatchEarly.weaponLockTurns} turno/i.`);
        return;
      }
    }

    // 🗡 Ladro — struttura del turno: 1 attacco mano1 + 1 attacco mano2 + 1 abilità
    // (Attacco Furtivo o Triboli) + 1 bonus action. Ogni arma una sola volta a turno;
    // una sola abilità a turno. Furtività resta libera (non occupa slot).
    if (isRogueClass((attackerSnap?.class || "").toLowerCase())) {
      const _skillSlot = action.special === "sneak_attack" || action.special === "triboli";
      if (action.type === "weapon" && (_myMatchEarly?.turnWeaponsUsed || []).includes(action.name)) {
        alert("🗡 Hai già attaccato con quest'arma questo turno. Usa l'altra mano o un'abilità.");
        return;
      }
      if (_skillSlot && _myMatchEarly?.turnSkillUsed) {
        alert("🗡 Hai già usato un'abilità (Attacco Furtivo o Triboli) questo turno.");
        return;
      }
    }

    // 1 moneta al primo attacco del giocatore in questo match (escluse Sfide Libere)
    const _currentMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const _alreadyAwarded = (_currentMatch?.participantsAwarded || []).includes(currentUser.uid);
    // Le Monete Arena si assegnano ora a FINE round (awardRoundCoins), non al primo turno.

    // Penalità ai tiri per colpire basata sull'armatura dell'attaccante
    const armorPenalty = attackerSnap?.selectedArmor?.hitPenalty ?? 0;

    // ── Smite Divino (attacca con arma equipaggiata + 2d8 bonus) ────────
    if (action.special === "smite") {
      const mySnap = attackerSnap;
      const myName = attName;
      const myMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
      const equippedNames = myMatchPlayer?.equippedWeaponNames || [];
      const allWeapons = (mySnap?.selectedActions || []).filter(a => a.type === "weapon");
      const weaponAction = allWeapons.find(a => equippedNames.includes(a.name)) || allWeapons[0];
      if (!weaponAction) { alert("⚡ Smite Divino richiede un'arma equipaggiata: equipaggia un'arma e riprova."); return; }

      const defMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === targetId);
      const targetAc = targetAcNow(defMatchPlayer, defenderSnap);
      const smiteStrMod = attackerSnap?.stats?.str ?? 0;
      const smiteMdAtk = myMatchPlayer?.magicDetectAttacks ?? 0;
      const smiteAidBonus = smiteMdAtk > 0
        ? readActiveBonus(myMatchPlayer?.magicDetectActive, 0)
        : readActiveBonus(myMatchPlayer?.aidBuff, 4);
      const d20 = Math.floor(Math.random() * 20) + 1;
      await showD20Roll(d20, { label: "Smite Divino" });
      const totalHit = d20 + (weaponAction.hitBonus || 0) + smiteStrMod + armorPenalty + smiteAidBonus;
      const isHit = totalHit >= targetAc;
      const isCrit = d20 === 20;
      const critMult = isCrit ? 2 : 1;

      const { total: wDmg, rolls: wRolls } = isHit ? rollDmg(weaponAction.damage) : { total: 0, rolls: "" };
      const { total: sDmg, rolls: sRolls } = isHit ? rollDmg(action.damage || "2d8") : { total: 0, rolls: "" };
      const rawSmiteDmg = (wDmg + sDmg + smiteStrMod + readAidDmgBonus(myMatchPlayer)) * critMult;
      const _smRider = isHit ? resolveWeaponRider(rawSmiteDmg, weaponAction, mySnap, myMatchPlayer, defenderSnap, defMatchPlayer, critMult) : { damage: 0, onHit: { selfPatch: {}, enemyPatch: {}, selfHeal: 0, enemyDmg: 0, logs: [] }, tag: "" };
      const totalDmg = _smRider.damage;

      const smiteExpiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
      const hitStr = isHit ? `COLPISCE` : `MANCA`;
      const strPart = smiteStrMod !== 0 ? `+${smiteStrMod} FOR` : "";
      const aidPart = smiteAidBonus ? ` +${smiteAidBonus} Aiuto` : "";
      const hitInfo = `d20(${d20})+${weaponAction.hitBonus}${strPart}+arm(${armorPenalty})${aidPart}=${totalHit} vs CA ${targetAc}`;
      const log = {
        pub: `⚡ ${myName} → Smite Divino su ${defName}: ${hitStr}${isHit ? ` per ${totalDmg} danni${isCrit ? " CRITICO!" : ""}` : ""}`,
        att: `⚡ Smite Divino su ${defName}: ${hitStr} [${hitInfo}]${isHit ? ` → arma🎲${wRolls}+smite🎲${sRolls}${_smRider.tag}=${totalDmg}${isCrit ? " CRITICO!" : ""}` : ""}`,
        def: `⚡ ${myName} ti colpisce con Smite Divino: ${hitStr}${isHit ? ` per ${totalDmg} danni${isCrit ? " CRITICO!" : ""}` : ""}`,
        ts: new Date().toISOString(),
        attId: currentUser.uid, defId: targetId,
      };
      // DISTANZA: uno Smite in mischia mentre si è lontani chiude la distanza.
      const _smiteFar = !arenaMeta.matches.find(mm => mm.matchId === matchId)?.distanceClosed;
      const _smiteClosePatch = (_smiteFar && !WEAPON_IS_RANGED(weaponAction) && PLAYER_HAS_RANGED_WEAPON(defMatchPlayer, defenderSnap)) ? { distanceClosed: true } : {};
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const rawPlayers = m.players.map(p => {
          if (p.id === targetId && isHit) return { ...p, hp: Math.max(0, (p.hp ?? 0) - totalDmg - _smRider.onHit.enemyDmg), ..._smRider.onHit.enemyPatch };
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 1)) - 1) };
            if (_smRider.onHit.selfHeal > 0 || Object.keys(_smRider.onHit.selfPatch).length) {
              const _mx = mySnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
              p = { ...p, ..._smRider.onHit.selfPatch, hp: Math.min(_mx, (p.hp ?? 0) + _smRider.onHit.selfHeal) };
            }
            const prevMdAtk = p.magicDetectAttacks ?? (p.magicDetectActive ? 1 : 0);
            const newMdAtk  = Math.max(0, prevMdAtk - 1);
            const newMd     = newMdAtk > 0 ? p.magicDetectActive : false;
            return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), frenzyAttackPending: false, mightyStrikePending: false, ...(frenzyExhausted(p) ? { frenzySpent: false } : {}), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), ...tickEagleEnd(p), defensiveBonus: 0, aidBuff: false, bonusActionUsed: false, itemUsedThisTurn: false, magicDetectActive: newMd, magicDetectAttacks: newMdAtk, actionUsesLeft: newUses };
          }
          return p;
        });
        const { players, extraLogs } = processWsKnockouts(rawPlayers);
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        const alive = players.filter(p => p.hp > 0);
        if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, participantsAwarded: pa, ..._smiteClosePatch, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
        return { ...m, players, turn: advanceTurn(players, m), turnExpiry: smiteExpiry, participantsAwarded: pa, ..._smiteClosePatch, logs: [...m.logs, log, ...extraLogs] };
      });
      await commitArenaMatches(updatedMatches);
      return;
    }

    // ── Attacco Furtivo (Rogue) — arma equipaggiata + 1d6 ────────────
    if (action.special === "sneak_attack") {
      const myMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
      const equippedNames = myMatchPlayer?.equippedWeaponNames || [];
      const allWeapons = (attackerSnap?.selectedActions || []).filter(a => a.type === "weapon");
      const weaponAction = allWeapons.find(a => equippedNames.includes(a.name)) || allWeapons[0];
      if (!weaponAction) return;

      const defMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === targetId);
      const targetAc = targetAcNow(defMatchPlayer, defenderSnap);
      const dexMod = attackerSnap?.stats?.dex ?? 0;
      const sneakMdAtk = myMatchPlayer?.magicDetectAttacks ?? 0;
      const aidBonus = sneakMdAtk > 0
        ? readActiveBonus(myMatchPlayer?.magicDetectActive, 0)
        : readActiveBonus(myMatchPlayer?.aidBuff, 4);
      // Furtività dà vantaggio su TUTTI gli attacchi del Ladro (Attacco Furtivo incluso).
      // Svantaggio: stealth del bersaglio, accecato dall'aquila, o svantaggio agli attacchi (Triboli/Oscurità).
      const sneakEagleActive     = (myMatchPlayer?.eagleDebuffTurns ?? 0) > 0;
      // DISTANZA: se l'Attacco Furtivo usa un'arma da mischia mentre si è lontani e il
      // bersaglio impugna un'arma a distanza → svantaggio (e più sotto chiude la distanza).
      const sneakWpnRanged       = WEAPON_IS_RANGED(weaponAction);
      const sneakDefRanged       = PLAYER_HAS_RANGED_WEAPON(defMatchPlayer, defenderSnap);
      const sneakFar             = !arenaMeta.matches.find(mm => mm.matchId === matchId)?.distanceClosed;
      const sneakMeleeFarDisadv  = !sneakWpnRanged && sneakFar && sneakDefRanged;
      // Sottoclasse · Assassino/Predatore/Ombra: apertura contro un nemico a PF pieni.
      const sneakFirstStrike     = subclassFirstStrike(attackerSnap, false, defMatchPlayer, defenderSnap);
      const sneakHasAdvantage    = readStealthAdvTurns(myMatchPlayer) > 0 || (myMatchPlayer?.selfAdvTurns ?? 0) > 0 || sneakFirstStrike.adv;
      const sneakHasDisadvantage = readStealthDisadvTurns(defMatchPlayer) > 0 || sneakEagleActive || (myMatchPlayer?.attackDisadvantageTurns ?? 0) > 0 || sneakMeleeFarDisadv;
      const sneakD20a = Math.floor(Math.random() * 20) + 1;
      const sneakD20b = (sneakHasAdvantage || sneakHasDisadvantage) ? Math.floor(Math.random() * 20) + 1 : 0;
      // Vantaggio + svantaggio si annullano (regola D&D 5e).
      const d20 = sneakHasAdvantage && !sneakHasDisadvantage ? Math.max(sneakD20a, sneakD20b)
                : sneakHasDisadvantage && !sneakHasAdvantage ? Math.min(sneakD20a, sneakD20b)
                : sneakD20a;
      await showD20Roll(d20, { label: "Attacco Furtivo" });
      const totalHit = d20 + (weaponAction.hitBonus || 0) + dexMod + armorPenalty + aidBonus;
      const isHit = totalHit >= targetAc || d20 === 20;
      // Critico: 20 naturale (o la soglia della sottoclasse) oppure Assassinare a segno.
      const isCrit = d20 >= subclassCritThreshold(attackerSnap, 20) || (sneakFirstStrike.crit && isHit);
      const critMult = isCrit ? 2 : 1;

      const sneakDiceStr = sneakAttackDice(getSnapLevel(attackerSnap));
      const { total: wDmg, rolls: wRolls } = isHit ? rollDmg(weaponAction.damage) : { total: 0, rolls: "" };
      const { total: sneakDmg, rolls: sneakRolls } = isHit ? rollDmg(sneakDiceStr) : { total: 0, rolls: "" };
      // Sneak Attack: weapon dice + 1d6 sneak dice + DEX mod (no hardcoded +3;
      // weapon formulas no longer have a baked ability mod since the
      // double-count fix).
      const rawSneakDmg = (wDmg + sneakDmg + dexMod) * critMult;
      const _snRider = isHit ? resolveWeaponRider(rawSneakDmg, weaponAction, attackerSnap, myMatchPlayer, defenderSnap, defMatchPlayer, critMult) : { damage: 0, onHit: { selfPatch: {}, enemyPatch: {}, selfHeal: 0, enemyDmg: 0, logs: [] }, tag: "" };
      const totalDmg = _snRider.damage;

      const sneakExpiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
      const critTag = isCrit ? " ★CRITICO★" : "";
      const dexPart = dexMod !== 0 ? `+${dexMod} DES` : "";
      const aidPart = aidBonus ? ` +${aidBonus} Aiuto` : "";
      const sneakAdvTag = sneakHasAdvantage && !sneakHasDisadvantage ? ` 🌟vant.[${sneakD20a},${sneakD20b}]`
                        : sneakHasDisadvantage && !sneakHasAdvantage ? ` 🌑svant.[${sneakD20a},${sneakD20b}]`
                        : "";
      const hitStr = `🎲d20=${d20}${critTag}${sneakAdvTag} +${weaponAction.hitBonus} hit ${dexPart}${aidPart}${armorPenalty < 0 ? ` ${armorPenalty} arm.` : ""} = ${totalHit} vs CA ${targetAc}`;
      const log = {
        pub: isHit
          ? `🗡 ${attName} colpisce ${defName} con Attacco Furtivo${critTag} (${totalHit} vs CA ${targetAc}) [🎲${wRolls}+furtivo 🎲${sneakRolls}+${dexMod} DES = ${totalDmg}] — ${totalDmg} danni`
          : `🛡️ ${attName} manca ${defName} con Attacco Furtivo (${totalHit} vs CA ${targetAc})`,
        att: isHit
          ? `🗡 Colpisci ${defName} con Attacco Furtivo [${hitStr}] [arma 🎲${wRolls} + furtivo 🎲${sneakRolls} +${dexMod} DES${_snRider.tag} = ${totalDmg}] — ${totalDmg} danni`
          : `🛡️ Manchi ${defName} con Attacco Furtivo [${hitStr}]`,
        def: isHit
          ? `🗡 ${attName} ti ha colpito con Attacco Furtivo${critTag} — ${totalDmg} danni`
          : `🛡️ ${attName} ti ha mancato con Attacco Furtivo`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };

      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const rawPlayers = m.players.map(p => {
          if (p.id === targetId) return { ...p, hp: isHit ? Math.max(0, (p.hp ?? 0) - totalDmg - _snRider.onHit.enemyDmg) : p.hp, ...(isHit ? _snRider.onHit.enemyPatch : {}), stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1) };
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 3)) - 1) };
            if (_snRider.onHit.selfHeal > 0 || Object.keys(_snRider.onHit.selfPatch).length) {
              const _mx = attackerSnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
              p = { ...p, ..._snRider.onHit.selfPatch, hp: Math.min(_mx, (p.hp ?? 0) + _snRider.onHit.selfHeal) };
            }
            const prevMdAtk = p.magicDetectAttacks ?? (p.magicDetectActive ? 1 : 0);
            const newMdAtk  = Math.max(0, prevMdAtk - 1);
            const newMd     = newMdAtk > 0 ? p.magicDetectActive : false;
            // Timer turn-based: NON decrementati qui — solo a fine turno (turnEndDecays).
            return { ...p, defensiveBonus: 0, aidBuff: false, bonusActionUsed: false, itemUsedThisTurn: false, magicDetectActive: newMd, magicDetectAttacks: newMdAtk, stealthAdvTurns: Math.max(0, readStealthAdvTurns(p) - 1), actionUsesLeft: newUses };
          }
          return p;
        });
        const { players, extraLogs } = processWsKnockouts(rawPlayers);
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        const _sneakClosePatch = sneakMeleeFarDisadv ? { distanceClosed: true } : {};
        const alive = players.filter(p => p.hp > 0);
        if (alive.length === 1) {
          return { ...m, players, status: "finished", winner: alive[0].id, participantsAwarded: pa, ..._sneakClosePatch, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
        }
        // Multi-azione (Monaco x2, Ladro x2): non avanza il turno finché restano azioni.
        const me = m.players.find(p => p.id === currentUser.uid);
        const maxActions = getMaxActionsPerTurn(attackerSnap, me);
        const usedSoFar = me?.multiActionsUsed ?? 0;
        const multiWillStay = (usedSoFar + 1) < maxActions;
        const newMultiUsed = multiWillStay ? usedSoFar + 1 : 0;
        const preservedBonusUsed = !!me?.bonusActionUsed;
        const preservedItemUsed  = !!me?.itemUsedThisTurn;
        const turnEndDecaysSneak = multiWillStay ? {} : {
          attackDisadvantageTurns: Math.max(0, (me?.attackDisadvantageTurns ?? 0) - 1),
          weaponLockTurns: Math.max(0, (me?.weaponLockTurns ?? 0) - 1),
          shieldSkillTurns: Math.max(0, (me?.shieldSkillTurns ?? 0) - 1),
          rageTurns: Math.max(0, (me?.rageTurns ?? 0) - 1), frenzyAttackPending: false, mightyStrikePending: false, ...(frenzyExhausted(me) ? { frenzySpent: false } : {}),
          hunterMarkTurns: Math.max(0, (me?.hunterMarkTurns ?? 0) - 1),
          concentrationTurns: Math.max(0, (me?.concentrationTurns ?? 0) - 1),
          pattoTurns: Math.max(0, (me?.pattoTurns ?? 0) - 1),
          armorForgeTurns: Math.max(0, (me?.armorForgeTurns ?? 0) - 1),
          selfAdvTurns: Math.max(0, (me?.selfAdvTurns ?? 0) - 1),
          ...tickEagleEnd(me || {}),
        };
        const playersWithMultiState = players.map(p =>
          p.id === currentUser.uid
            ? { ...p,
                multiActionsUsed: newMultiUsed,
                turnSkillUsed:     multiWillStay ? true : false,
                turnWeaponsUsed:   multiWillStay ? (me?.turnWeaponsUsed || []) : [],
                bonusActionUsed:   multiWillStay ? !!preservedBonusUsed   : false,
                itemUsedThisTurn:  multiWillStay ? !!preservedItemUsed    : false,
                extraTurnActive:   multiWillStay ? !!p.extraTurnActive    : false,
                actionSurgeActive: multiWillStay ? !!p.actionSurgeActive  : false,
                ...turnEndDecaysSneak }
            : p
        );
        const nextTurn = multiWillStay ? currentUser.uid : advanceTurn(playersWithMultiState, m);
        // Multi-azione: NON rigenerare turnExpiry se il turno resta al giocatore,
      // così i DoT (veleno/sanguinamento/fuoco) ticcano UNA volta per turno, non per attacco.
      return { ...m, players: playersWithMultiState, turn: nextTurn, turnExpiry: multiWillStay ? (m.turnExpiry || sneakExpiry) : sneakExpiry, participantsAwarded: pa, ..._sneakClosePatch, logs: [...m.logs, log, ...extraLogs] };
      });
      await commitArenaMatches(updatedMatches);
      return;
    }

    // ── Furtività (Rogue) — buff puro, nessun attacco ────────────────
    if (action.special === "stealth") {
      const log = {
        pub: `🌑 ${attName} entra in Furtività — vantaggio ai prossimi 2 attacchi`,
        att: `🌑 Entri in Furtività — i tuoi prossimi 2 attacchi hanno vantaggio`,
        def: `🌑 ${attName} è scivolato nell'ombra...`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };
      const stealthExpiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const me = m.players.find(p => p.id === currentUser.uid);
        // Furtività = azione gratuita: non avanza il turno né consuma uno slot
        // multi-azione del Ladro. bonusActionUsed resta quello che era.
        const preservedBonusUsed = !!me?.bonusActionUsed;
        const players = m.players.map(p => {
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
            return { ...p, stealthAdvTurns: 2, stealthDisadvTurns: 0, stealthTurns: 0, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), frenzyAttackPending: false, mightyStrikePending: false, ...(frenzyExhausted(p) ? { frenzySpent: false } : {}), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), defensiveBonus: 0, aidBuff: false, bonusActionUsed: preservedBonusUsed, actionUsesLeft: newUses, multiActionsUsed: me?.multiActionsUsed ?? 0 };
          }
          return p;
        });
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        return { ...m, players, turnExpiry: stealthExpiry, participantsAwarded: pa, logs: [...m.logs, log] };
      });
      await commitArenaMatches(updatedMatches);
      return;
    }

    // ── Triboli (Rogue): TS DES dell'avversario (CD 8 + competenza + DES del
    //    ladro). Fallito → svantaggio + sanguinamento 1d6/turno per 3 turni.
    //    Riuscito → solo 1 turno (al prossimo turno). ──────────────────────────
    if (action.special === "triboli") {
      const bleedDice  = action.bleedDice || "1d6";
      const saveDC     = 8 + getProficiencyBonus(attackerSnap) + (attackerSnap?.stats?.dex ?? 0);
      const tgtDexMod  = defenderSnap?.stats?.dex ?? 0;
      const d20        = Math.floor(Math.random() * 20) + 1;
      await showD20Roll(d20, { label: `TS · DES · ${defName}` });
      const saveTotal  = d20 + tgtDexMod;
      const savePass   = saveTotal >= saveDC;
      const sign       = tgtDexMod >= 0 ? "+" : "";
      const turns      = savePass ? 1 : 2;
      const bleedTurns = savePass ? 1 : 2;
      const tnLbl      = `${turns} turn${turns === 1 ? "o" : "i"}`;
      const tsTag      = `TS DES ${d20}${sign}${tgtDexMod}=${saveTotal} vs CD ${saveDC} → ${savePass ? "✅ SUPERA" : "❌ FALLISCE"}`;
      const log = {
        pub: `🪤 ${attName} sparge Triboli su ${defName} — ${tsTag}: svantaggio + sanguinamento ${bleedDice}/turno per ${tnLbl}.`,
        att: `🪤 Spargi Triboli su ${defName} — ${tsTag}: svantaggio + sanguinamento ${bleedDice}/turno per ${tnLbl}.`,
        def: `🪤 Sei trafitto dai Triboli — ${tsTag}: svantaggio e sanguinamento ${bleedDice}/turno per ${tnLbl}.`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };
      const triboliExpiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id === targetId) return {
            ...p,
            attackDisadvantageTurns: Math.max(p.attackDisadvantageTurns ?? 0, turns),
            ...disadvTag("Triboli", "🪤"),
            bleedDoT: true,
            bleedDoTTurns: Math.max(p.bleedDoTTurns ?? 0, bleedTurns),
            bleedDoTDice: bleedDice,
            bleedDoTSourceLabel: "sanguinamento",
            bleedDoTNoun: "sanguinante",
            bleedDoTIcon: "🩸",
          };
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = action.maxUses !== undefined
              ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) }
              : uses;
            // Timer turn-based gestiti in turnEndDecaysTriboli (sotto), non qui.
            return { ...p, defensiveBonus: 0, actionUsesLeft: newUses };
          }
          return p;
        });
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        // Triboli = slot abilità del Ladro: non termina il turno finché restano
        // azioni (mano1/mano2). Una sola abilità a turno (turnSkillUsed).
        const me = m.players.find(p => p.id === currentUser.uid);
        const maxActions = getMaxActionsPerTurn(attackerSnap, me);
        const usedSoFar = me?.multiActionsUsed ?? 0;
        const multiWillStay = (usedSoFar + 1) < maxActions;
        const newMultiUsed = multiWillStay ? usedSoFar + 1 : 0;
        const preservedBonusUsed = !!me?.bonusActionUsed;
        const preservedItemUsed  = !!me?.itemUsedThisTurn;
        const turnEndDecaysTriboli = multiWillStay ? {} : {
          attackDisadvantageTurns: Math.max(0, (me?.attackDisadvantageTurns ?? 0) - 1),
          weaponLockTurns: Math.max(0, (me?.weaponLockTurns ?? 0) - 1),
          shieldSkillTurns: Math.max(0, (me?.shieldSkillTurns ?? 0) - 1),
          rageTurns: Math.max(0, (me?.rageTurns ?? 0) - 1), frenzyAttackPending: false, mightyStrikePending: false, ...(frenzyExhausted(me) ? { frenzySpent: false } : {}),
          hunterMarkTurns: Math.max(0, (me?.hunterMarkTurns ?? 0) - 1),
          concentrationTurns: Math.max(0, (me?.concentrationTurns ?? 0) - 1),
          pattoTurns: Math.max(0, (me?.pattoTurns ?? 0) - 1),
          armorForgeTurns: Math.max(0, (me?.armorForgeTurns ?? 0) - 1),
          selfAdvTurns: Math.max(0, (me?.selfAdvTurns ?? 0) - 1),
          ...tickEagleEnd(me || {}),
        };
        const playersWithMultiState = updatedPlayers.map(p =>
          p.id === currentUser.uid
            ? { ...p,
                multiActionsUsed: newMultiUsed,
                turnSkillUsed:     multiWillStay ? true : false,
                turnWeaponsUsed:   multiWillStay ? (me?.turnWeaponsUsed || []) : [],
                bonusActionUsed:   multiWillStay ? !!preservedBonusUsed   : false,
                itemUsedThisTurn:  multiWillStay ? !!preservedItemUsed    : false,
                extraTurnActive:   multiWillStay ? !!p.extraTurnActive    : false,
                actionSurgeActive: multiWillStay ? !!p.actionSurgeActive  : false,
                ...turnEndDecaysTriboli }
            : p
        );
        const nextTurn = multiWillStay ? currentUser.uid : advanceTurn(playersWithMultiState, m);
        return { ...m, players: playersWithMultiState, turn: nextTurn, turnExpiry: multiWillStay ? (m.turnExpiry || triboliExpiry) : triboliExpiry, participantsAwarded: pa, logs: [...m.logs, log] };
      });
      await commitArenaMatches(updatedMatches);
      return;
    }

    // ── Ragnatela (intrappola · TS FOR CD 13 OGNI turno per liberarsi) ────
    if (action.special === "web") {
      const saveAbility = action.saveAbility || "str";
      const saveDC = action.saveDC ?? 13;
      const log = {
        pub: `🕸 ${attName} lancia Ragnatela su ${defName} — intrappolato! TS ${SAVE_LABEL[saveAbility]} (CD ${saveDC}) ogni turno per liberarsi.`,
        att: `🕸 Lanci la Ragnatela su ${defName} — dovrà superare un TS ${SAVE_LABEL[saveAbility]} (CD ${saveDC}) ogni turno per liberarsi.`,
        def: `🕸 Sei avvolto dalla Ragnatela — TS ${SAVE_LABEL[saveAbility]} (CD ${saveDC}) ogni turno per liberarti.`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };
      const webExpiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id === targetId) return {
            ...p,
            pendingControlSave: true,
            pendingControlDC: saveDC,
            pendingControlSaveAbility: saveAbility,
            controlLostTurns: 2,
          };
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = action.maxUses !== undefined
              ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) }
              : uses;
            return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), ...tickEagleEnd(p), defensiveBonus: 0, actionUsesLeft: newUses };
          }
          return p;
        });
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: webExpiry, participantsAwarded: pa, logs: [...m.logs, log] };
      });
      await commitArenaMatches(updatedMatches);
      return;
    }

    // ── Veleno (damage + CON save) ────────────────────────────────────
    if (action.special === "poison") {
      const { total: damage, rolls: poisonDiceRolls } = rollDmg(action.damage);
      const dmgNote = ` [🎲${poisonDiceRolls}=${damage}]`;
      const log = {
        pub: `☠ ${attName} usa Veleno su ${defName}${dmgNote} — ${damage} danni + TS COS (CD 15)`,
        att: `☠ Usi Veleno su ${defName}${dmgNote} — ${damage} danni + TS COS (CD 15)`,
        def: `☠ ${attName} ti ha colpito con Veleno${dmgNote} — ${damage} danni! Devi superare un TS COS (CD 15)`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };
      const poisonExpiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
      let updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const rawPlayers = m.players.map(p => {
          if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - damage), pendingConSave: true };
          if (p.id === currentUser.uid) return { ...p, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), ...tickEagleEnd(p), defensiveBonus: 0 };
          return p;
        });
        const { players: updatedPlayers, extraLogs } = processWsKnockouts(rawPlayers);
        const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
        const alive = updatedPlayers.filter(p => p.hp > 0);
        if (alive.length === 1) {
          return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
            participantsAwarded: pa, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
        }
        return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: poisonExpiry, participantsAwarded: pa, logs: [...m.logs, log, ...extraLogs] };
      });
      const finalM = finalJustConcluded(updatedMatches);
      if (finalM) {
        const champSnap = snapshots[finalM.winner] || {};
        await sendChampionNotification(finalM.winner, champSnap.name || "Campione", arenaMeta?.prizes || "", updatedMatches);
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: updatedMatches, tournamentWinner: finalM.winner, phase: "finished",
        });
        // 🐣 pet system: tournament champion bonus
        awardPetPoints(finalM.winner, "arena_tournament", { resourceKey: finalM.matchId });
        return;
      }
      await commitArenaMatches(updatedMatches);
      return;
    }

    // ── Incantesimo a danno → TS al posto del tiro per colpire ───────
    if (isSaveDamageSpell(action)) { await handleSpellSave(matchId, targetId, action); return; }

    // ── Attacco normale ───────────────────────────────────────────────
    const attackerMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
    // Monaco a mani nude: 1° colpo Pugno (2d4+DES), 2° colpo Calcio (1d4+FOR).
    if (action.unarmedMonk) action = resolveMonkUnarmed(action, attackerMatchPlayer?.multiActionsUsed ?? 0, attackerSnap?.arenaBuffs);
    // Class lock: prefer the class embedded on the match player (locked at match build),
    // fall back to characterSnapshots only for legacy matches without an embedded class.
    const attackerClassLower = (attackerMatchPlayer?.class || arenaMeta.characterSnapshots?.[currentUser.uid]?.class || "").toLowerCase();
    const isSpellAction = action.type === "spell";
    const spellcastKey  = isSpellAction ? getSpellcastingAbility(attackerClassLower) : null;
    const statMod  = action.statKey
      ? (attackerSnap?.stats?.[action.statKey] ?? 0)
      : isSpellAction
      ? (attackerSnap?.stats?.[spellcastKey] ?? 0)
      : 0;
    const weaponBuff = !isSpellAction && (attackerSnap?.arenaBuffs?.weaponBonus ? 1 : 0);
    const aidBonus           = readActiveBonus(attackerMatchPlayer?.aidBuff, 4);
    const rageDmgBonus       = !isSpellAction && (attackerMatchPlayer?.rageTurns ?? 0) > 0 ? rageDamageBonus(getSnapLevel(attackerSnap)) : 0;
    const concentrationDmg   = (attackerMatchPlayer?.concentrationTurns ?? 0) > 0 ? 2 : 0;
    const bardInspirationActive = !!attackerMatchPlayer?.bardicInspirationActive;
    const { total: inspirationBonus, rolls: inspirationRolls } = bardInspirationActive ? rollDmg("1d6") : { total: 0, rolls: "" };
    const magicDetectBonus   = readActiveBonus(attackerMatchPlayer?.magicDetectActive, 3);
    const hunterMarkBonus    = (attackerMatchPlayer?.hunterMarkTurns ?? 0) > 0 ? 3 : 0;
    const eagleActive        = (attackerMatchPlayer?.eagleDebuffTurns ?? 0) > 0;
    const blindDebuffPenalty = (attackerMatchPlayer?.blindDebuff || eagleActive) ? -3 : 0;
    const isBlindDebuff      = action.special === "blind_debuff";
    const attackerTitles     = getSnapTitles(attackerSnap);
    const titleHitCtx        = { classLower: attackerClassLower, isSpellAction, wildShapeForm: attackerMatchPlayer?.wildShape || null, actionDamageType: action?.damageType || null };
    const titleHitBonus      = attackerTitles.reduce((sum, k) => sum + getTitleHitBonus({ titleKey: k, ...titleHitCtx }), 0);
    const jackOfAllTradesBonus = isBardClass(attackerClassLower) && getSnapLevel(attackerSnap) >= 2 ? 1 : 0; // Bardo · Tuttofare (Lv2): +1 al colpire
    const recklessHitBonus   = recklessRaging(attackerSnap, attackerMatchPlayer) ? 2 : 0;          // Barbaro · Attacco Irruento (Lv2): +2 al colpire in Furia
    const infusionHitBonus   = !isSpellAction ? infusionWeaponBonus(attackerSnap) : 0;             // Artefice · Infusione (Lv2): +1 al colpire con arma
    const subclassRangedHitBonus = subclassRangedHit(attackerSnap, action, isSpellAction);          // Sottoclasse · Guerriero "tiratore" / Ranger "arco": +colpire a distanza
    const passiveHitBonus    = recklessHitBonus + infusionHitBonus + subclassRangedHitBonus;
    const kiBypass           = kiStrikesBypass(attackerSnap, isSpellAction);                       // Monaco · Colpi Ki (Lv6)
    const defMatchPlayer     = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === targetId);
    const _firstStrike       = subclassFirstStrike(attackerSnap, isSpellAction, defMatchPlayer, defenderSnap); // Ladro "assassino" / Monaco "ombra": apertura vs bersaglio a PF pieni
    const hasAdvantage       = readStealthAdvTurns(attackerMatchPlayer) > 0 || (attackerMatchPlayer?.selfAdvTurns ?? 0) > 0 || !!attackerMatchPlayer?.mightyStrikePending || _firstStrike.adv || heavyElemAttackAdv(action, defenderSnap);
    // Scudo + incantesimo da DANNO con tiro per colpire → il lanciatore tira a SVANTAGGIO.
    const casterShieldSpellDisadv = isSpellAction && !!attackerSnap?.hasShield && !!(action.damage && action.damage !== "—");
    // DISTANZA: attacco in mischia mentre si è lontani, contro un avversario che
    // impugna un'arma a distanza → svantaggio (chiudi sotto tiro).
    const defHasRangedWpn    = PLAYER_HAS_RANGED_WEAPON(defMatchPlayer, defenderSnap);
    const isMeleeWeaponAtk   = action.type === "weapon" && !WEAPON_IS_RANGED(action);
    const meleeFarDisadv     = isMeleeWeaponAtk && !_currentMatch?.distanceClosed && defHasRangedWpn;
    const _isRangedWpnAtk    = action.type === "weapon" && WEAPON_IS_RANGED(action);
    // Tiro in arretramento (kiting): spari da vicino mentre indietreggi → SVANTAGGIO
    // e consumi 1 carica (finché ne restano). Riapre la distanza (vedi blocco DISTANZA).
    const _willKite          = _isRangedWpnAtk && !!_currentMatch?.distanceClosed && !defHasRangedWpn
                                 && (attackerMatchPlayer?.kiteChargesUsed ?? 0) < ARENA_KITE_MAX;
    // Barbaro Lv7 · Istinto Selvaggio: in Furia i tuoi attacchi ignorano lo svantaggio.
    const _ragingNoDisadv = isBarbarianClass(attackerClassLower) && getSnapLevel(attackerSnap) >= 7 && (attackerMatchPlayer?.rageTurns ?? 0) > 0;
    // Berserker · Frenesia: il prossimo attacco con l'arma è il colpo in più (solo dado + mod.).
    const frenzyPlain = !isSpellAction && action.type === "weapon" && !!attackerMatchPlayer?.frenzyAttackPending;
    const hasDisadvantage    = _ragingNoDisadv ? false : (frenzyExhausted(attackerMatchPlayer) || readStealthDisadvTurns(defMatchPlayer) > 0 || eagleActive || (attackerMatchPlayer?.attackDisadvantageTurns ?? 0) > 0 || casterShieldSpellDisadv || meleeFarDisadv || _willKite || subclassForesightDisadv(defenderSnap, defMatchPlayer));
    const isFighter = isFighterClass(attackerClassLower);
    // Variabili condivise col blocco di finalizzazione più sotto: l'attacco normale
    // (else) e la Raffica Letale a più frecce (if) le riempiono entrambi.
    let damage, isHit, golemHalved = false, log, _hitResisted = false;
    if (action.multiHit) {
      // ── RAFFICA LETALE: N frecce, ognuna col proprio tiro per colpire e danno ──
      const arrows = action.multiHit;
      const perDie = action.perHitDamage || "1d8";
      const aidDmgBonus2      = readAidDmgBonus(attackerMatchPlayer);
      const defAC2 = targetAcNow(defMatchPlayer, defenderSnap);
      const critTh2 = subclassCritThreshold(attackerSnap, isFighter ? 19 : 20);
      let total = 0; let anyHit = false; const tags = [];
      for (let i = 0; i < arrows; i++) {
        let r1 = Math.floor(Math.random() * 20) + 1;
        if (r1 === 1 && isFighter) r1 = Math.floor(Math.random() * 20) + 1;
        const r2 = (hasAdvantage || hasDisadvantage) ? Math.floor(Math.random() * 20) + 1 : 0;
        const rd = hasAdvantage && !hasDisadvantage ? Math.max(r1, r2)
                 : hasDisadvantage && !hasAdvantage ? Math.min(r1, r2) : r1;
        await showD20Roll(rd, { label: `${action.icon || "🏹"} ${action.name} — ${action.special === "turbine_lame" ? "Colpo" : "Freccia"} ${i + 1}/${arrows}` });
        const aCrit = rd >= critTh2;
        const aHitTotal = rd + (action.hitBonus || 0) + statMod + armorPenalty + weaponBuff + aidBonus + inspirationBonus + magicDetectBonus + hunterMarkBonus + blindDebuffPenalty + titleHitBonus + jackOfAllTradesBonus + passiveHitBonus;
        const aHit = aHitTotal >= defAC2 || aCrit;
        if (aHit) {
          anyHit = true;
          const { total: ad } = rollDmg(perDie);
          const arrowDmg = (ad + statMod + weaponBuff + rageDmgBonus + concentrationDmg + aidDmgBonus2) * (aCrit ? 2 : 1);
          total += arrowDmg;
          tags.push(`🎯${rd}${aCrit ? "★" : ""}=${arrowDmg}`); // un tag per colpo: si vede quanti vanno a segno
        } else {
          tags.push(`✗${rd}`);
        }
      }
      const volleyTyped = applyTypedDamage(total, action, 1, defenderSnap, false);
      _hitResisted = volleyTyped.resisted;
      const reduced = applyDefenderDamageMods(volleyTyped.total, defenderSnap, defMatchPlayer, false);
      golemHalved = anyHit && !!defMatchPlayer?.nextHitHalved && reduced > 0;
      damage = golemHalved ? Math.floor(reduced / 2) : reduced;
      isHit  = anyHit;
      const volleyTag = `[${tags.join(" · ")}] vs CA ${defAC2}`;
      // Turbine di Lame (Barbaro) usa lo stesso giro a più colpi: parole da mischia, non frecce.
      const _ic = action.icon || "🏹";
      const _hits = action.special === "turbine_lame" ? "tutti i colpi" : "tutte le frecce";
      log = {
        pub: anyHit
          ? `${_ic} ${attName} scatena ${action.name} su ${defName} — ${volleyTag} — ${damage} danni`
          : `🛡️ ${attName} scatena ${action.name} ma ${defName} schiva ${_hits} ${volleyTag}`,
        att: anyHit
          ? `${_ic} Scateni ${action.name} su ${defName} — ${volleyTag} — ${damage} danni`
          : `🛡️ ${defName} schiva ${_hits} di ${action.name} ${volleyTag}`,
        def: anyHit
          ? `${_ic} ${attName} ti colpisce con ${action.name} — ${volleyTag} — ${damage} danni`
          : `🛡️ Schivi ${_hits} di ${action.name} di ${attName} ${volleyTag}`,
        attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
      };
    } else {
    let d20a = Math.floor(Math.random() * 20) + 1;
    if (d20a === 1 && isFighter) d20a = Math.floor(Math.random() * 20) + 1; // Presenza Possente: ritira l'1
    let d20b = (hasAdvantage || hasDisadvantage) ? Math.floor(Math.random() * 20) + 1 : 0;
    if (d20b === 1 && isFighter && (hasAdvantage || hasDisadvantage)) d20b = Math.floor(Math.random() * 20) + 1;
    const d20      = hasAdvantage && !hasDisadvantage ? Math.max(d20a, d20b)
                   : hasDisadvantage && !hasAdvantage ? Math.min(d20a, d20b)
                   : d20a;
    await showD20Roll(d20, { label: `${isSpellAction ? action.name : `Attacco · ${action.name}`}${casterShieldSpellDisadv ? " — a SVANTAGGIO (tuo scudo)" : meleeFarDisadv ? " — a SVANTAGGIO (chiudi la distanza)" : _willKite ? " — a SVANTAGGIO (spari arretrando)" : ""}` });
    const hitTotal = d20 + (action.hitBonus || 0) + statMod + armorPenalty + weaponBuff + aidBonus + inspirationBonus + magicDetectBonus + hunterMarkBonus + blindDebuffPenalty + titleHitBonus + jackOfAllTradesBonus + passiveHitBonus;
    const defAC    = targetAcNow(defMatchPlayer, defenderSnap);
    const critThreshold = subclassCritThreshold(attackerSnap, isFighter ? 19 : 20); // Critico Migliorato: 19-20 per il guerriero (18 per il Campione)
    // Ladro · Assassinare: un colpo a segno contro un bersaglio a PF pieni è un critico.
    const landsAssassinate = _firstStrike.crit && hitTotal >= defAC;
    const isCrit   = d20 >= critThreshold || landsAssassinate; // nat 20 (o 19 per fighter), o Assassinare
    isHit    = hitTotal >= defAC || isCrit;
    // Paladino · Arma Grande: reroll dei risultati 1-2 sui dadi di un'arma a due mani da mischia.
    const weaponRerollMax = (!isSpellAction && IS_TWO_HANDED_MELEE(action) && getSubclassEffect(attackerSnap).twoHandReroll) ? 2 : 0;
    const { total: baseDmg, rolls: diceRolls } = isHit ? rollDmg(isSpellAction ? clericBlessedDice(action.damage, attackerSnap) : action.damage, { rerollMax: weaponRerollMax }) : { total: 0, rolls: "0" };
    // Critico spells: doppio danno
    const critMult = isCrit ? 2 : 1;
    // Weapon poison bonus
    const weaponPoisoned = !!attackerMatchPlayer?.weaponPoisoned;
    const { total: poisonBonusDmg, rolls: poisonRolls } = isHit && weaponPoisoned ? rollDmg("1d12") : { total: 0, rolls: "" };
    // Patto Demoniaco (Warlock): +1d12 ai danni delle spell che colpiscono per 3 turni dopo l'attivazione.
    const pattoActive = (attackerMatchPlayer?.pattoTurns ?? 0) > 0;
    const { total: pattoBonusDmg, rolls: pattoRolls } = isHit && isSpellAction && pattoActive ? rollDmg("1d12") : { total: 0, rolls: "" };
    // Signore della Tempesta (titolo): +1d6 danni da fulmine sulle spell di fulmine/gelo/acqua.
    const stormTitleOn = isHit && isSpellAction && attackerTitles.includes("signoreTempesta") && isStormSpell(action);
    const { total: stormBonusDmg, rolls: stormRolls } = stormTitleOn ? rollDmg("1d6") : { total: 0, rolls: "" };
    // Le spell che fanno danno usano il mod del caster (INT/SAG/CAR), come le armi col loro statKey.
    const spellDealsDmg  = isSpellAction && (action.damage && action.damage !== "—");
    const dmgStatMod     = !isSpellAction ? statMod : (spellDealsDmg ? statMod : 0);
    const aidDmgBonus    = readAidDmgBonus(attackerMatchPlayer); // Aiuto: +X al danno
    const subclassEff = getSubclassEffect(attackerSnap);
    const subclassDmg = isSpellAction ? (subclassEff.spellDmg || 0) : (subclassEff.weaponDmg || 0);
    // Sottoclasse (Fase 2): dado bonus ai danni (Artigliere/Alchimista) + Ondata Selvaggia.
    const { bonus: subclassBonusDmg, tag: subclassBonusTag } = (isHit && !isBlindDebuff) ? subclassDamageDice(attackerSnap, isSpellAction) : { bonus: 0, tag: "" };
    // Barbaro Lv3 · Furia Bestiale: +1 danno per ogni 25% di PF mancanti mentre è in Furia.
    const beastRageBonus = !isSpellAction ? beastRageDamageBonus(attackerSnap, attackerMatchPlayer) : 0;
    // Chierico Lv8 · Colpo Divino: +1d8 radiante ai colpi con arma (fuori dal moltiplicatore critico).
    const divineStrikeDmg = (isHit && !isBlindDebuff) ? divineStrikeBonus(attackerSnap, isSpellAction) : 0;
    // Artefice Lv2 · Infusione: +1 al danno con arma.
    const infusionDmg = !isSpellAction ? infusionWeaponBonus(attackerSnap) : 0;
    // Berserker · Frenesia: il colpo in più conta solo dado + modificatore (niente bonus).
    const rawDamage = (isHit && !isBlindDebuff)
      ? (frenzyPlain
          ? (baseDmg + dmgStatMod) * critMult
          : (baseDmg + dmgStatMod + weaponBuff + rageDmgBonus + concentrationDmg + aidDmgBonus + subclassDmg + beastRageBonus + infusionDmg) * critMult + poisonBonusDmg + pattoBonusDmg + stormBonusDmg + divineStrikeDmg + subclassBonusDmg)
      : 0;
    // Furia del Barbaro: dimezza i danni subiti da armi e skill (non da incantesimi).
    // Monaco · Colpi Ki (Lv6): i colpi in mischia ignorano le riduzioni ai danni fisici (kiBypass).
    // Bottega: componenti di danno elementali dell'arma + resistenze del bersaglio.
    const typedDmg = applyTypedDamage(rawDamage, action, critMult, defenderSnap, isSpellAction,
      isSpellAction ? null : physicalFallbackType(action, attackerSnap, attackerMatchPlayer));
    _hitResisted = typedDmg.resisted;
    const rageReducedDamage = applyDefenderDamageMods(typedDmg.total, defenderSnap, defMatchPlayer, isSpellAction, kiBypass);
    // Golem dell'Artefice: il prossimo colpo ricevuto dalla vittima è dimezzato.
    golemHalved = isHit && !!defMatchPlayer?.nextHitHalved && rageReducedDamage > 0;
    damage = golemHalved ? Math.floor(rageReducedDamage / 2) : rageReducedDamage;

    // Log breakdown
    const statPart       = !isSpellAction && action.statKey ? ` ${statMod >= 0 ? "+" : ""}${statMod} ${action.statKey.toUpperCase()}` : '';
    const spellModPart   = isSpellAction && spellcastKey ? ` ${statMod >= 0 ? "+" : ""}${statMod} ${spellcastKey.toUpperCase()}` : '';
    const dmgModPart     = (dmgStatMod !== 0) ? ` ${dmgStatMod >= 0 ? "+" : ""}${dmgStatMod} ${(action.statKey || spellcastKey || "").toUpperCase()}` : '';
    const aidPart        = aidBonus > 0 ? ` +${aidBonus} Aiuto` : '';
    const penPart        = armorPenalty < 0 ? ` ${armorPenalty} arm.` : '';
    const critTag        = isCrit ? " ★CRITICO★" : "";
    const poisonTag      = poisonBonusDmg > 0 ? ` | veleno 🎲${poisonRolls}=${poisonBonusDmg}` : "";
    const pattoTag       = pattoBonusDmg > 0 ? ` | 🩸patto 🎲${pattoRolls}=${pattoBonusDmg}` : "";
    const stormTag       = stormBonusDmg > 0 ? ` | ⚡tempesta 🎲${stormRolls}=${stormBonusDmg}` : "";
    const rageTag        = frenzyPlain ? " | 🩸frenesia (solo dado + mod.)" : rageDmgBonus > 0 ? ` | furia +${rageDmgBonus}` : "";
    const concentrationTag = concentrationDmg > 0 ? ` | 🧘conc. +${concentrationDmg}` : "";
    const inspirationTag = inspirationBonus > 0 ? ` +ispirazione 🎵🎲${inspirationRolls}=${inspirationBonus}` : "";
    const magicDetTag    = magicDetectBonus > 0 ? ` +${magicDetectBonus} 🔮det.` : "";
    const advantageTag   = hasAdvantage && !hasDisadvantage ? ` 🌟vant.[${d20a},${d20b}]`
                         : hasDisadvantage && !hasAdvantage ? ` 🌑svant.[${d20a},${d20b}]`
                         : "";
    const hunterMarkTag  = hunterMarkBonus > 0 ? ` +3 🎯marchio` : "";
    const blindPenTag    = blindDebuffPenalty < 0 ? ` ${blindDebuffPenalty} 🙈acc.` : "";
    const titleTag       = titleHitBonus > 0
      ? ` +${titleHitBonus} ${attackerTitles.filter(k => getTitleHitBonus({ titleKey: k, ...titleHitCtx }) > 0).map(k => ARENA_TITLES[k]?.icon || "♛").join("")}titolo`
      : "";
    const critDmgNote    = isCrit ? ` ×2` : "";
    const subclassBonusTagStr = subclassBonusTag ? ` | ${subclassBonusTag}` : "";
    // Bottega: componenti elementali dell'arma applicati (con marcatore se resistiti).
    const elementalTag   = (typedDmg.parts || [])
      .map(pt => ` | ${DAMAGE_TYPE_MAP[pt.type]?.icon || "✦"}${DAMAGE_TYPE_MAP[pt.type]?.label || pt.type} ${pt.resisted ? `${pt.raw}→` : ""}${pt.amount}`)
      .join("");
    const dmgBreakdown   = (isHit && !isBlindDebuff)
      ? ` [danni: 🎲${diceRolls}${dmgModPart}${critDmgNote}${poisonTag}${pattoTag}${stormTag}${rageTag}${concentrationTag}${subclassBonusTagStr}${elementalTag} = ${damage}]`
      : "";
    const hitBreakdown = `🎲d20=${d20}${critTag}${advantageTag} +${action.hitBonus} hit${statPart}${spellModPart}${penPart}${aidPart}${inspirationTag}${magicDetTag}${hunterMarkTag}${blindPenTag}${titleTag} = ${hitTotal} vs CA ${defAC}`;
    log = {
      pub: isHit
        ? (isBlindDebuff
            ? `🙈 ${attName} accieca ${defName}! (−3 ai tiri per colpire per 1 turno)`
            : `💥 ${attName} colpisce ${defName} con ${action.name}${critTag} (${hitTotal} vs CA ${defAC})${dmgBreakdown} — ${damage} danni`)
        : `🛡️ ${attName} manca ${defName} con ${action.name} (${hitTotal} vs CA ${defAC})`,
      att: isHit
        ? (isBlindDebuff
            ? `🙈 Acceci ${defName}! [${hitBreakdown}] — −3 ai tiri per colpire`
            : `💥 Colpisci ${defName} con ${action.name} [${hitBreakdown}]${dmgBreakdown} — ${damage} danni`)
        : `🛡️ Manchi ${defName} con ${action.name} [${hitBreakdown}]`,
      def: isHit
        ? (isBlindDebuff
            ? `🙈 ${attName} ti ha accecato! −3 ai tuoi tiri per colpire per 1 turno`
            : `⚔️ ${attName} ti ha colpito con ${action.name}${critTag}${dmgBreakdown} — ${damage} danni`)
        : `🛡️ ${attName} ti ha mancato con ${action.name}`,
      attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
    };
    } // ── fine attacco normale (else di action.multiHit) ──

    // ── DISTANZA: chiusura (melee, Carica) o kiting (ranged, Tiro in arretramento) ──
    const _wasClosed   = !!_currentMatch?.distanceClosed;
    let _distancePatch = {};   // patch a livello di match
    let _kiteInc = false;      // consuma 1 carica di kiting sull'attaccante
    let _distanceLog = null;
    if (isMeleeWeaponAtk && !_wasClosed && defHasRangedWpn) {
      _distancePatch = { distanceClosed: true };
      _distanceLog = `⚔️ ${attName} carica, chiude la distanza e ingaggia ${defName} in mischia.`;
    } else if (_willKite) {
      // Tiro in arretramento: il tiro (già a svantaggio) riapre la distanza e consuma 1 carica.
      _distancePatch = { distanceClosed: false };
      _kiteInc = true;
      const _left = ARENA_KITE_MAX - (attackerMatchPlayer?.kiteChargesUsed ?? 0) - 1;
      _distanceLog = `🏹 ${attName} spara indietreggiando e riapre la distanza da ${defName} (${_left} ${_left === 1 ? "carica" : "cariche"} rimaste).`;
    }

    // Sottoclasse (Fase 2) · Ritorsione (Chierico Tempesta 2d8, Artefice Battaglia 1d4):
    //   chi colpisce in MISCHIA un difensore con questo effetto subisce danni di ritorno,
    //   ma solo se il difensore SOPRAVVIVE al colpo (così si evita il KO reciproco/stallo).
    const _defRetaliate = defenderRetaliate(defenderSnap);
    // Bilanciamento: la ritorsione scatta solo sul PRIMO attacco del turno (max 1/turno).
    const _isFirstHitOfTurn = (attackerMatchPlayer?.multiActionsUsed ?? 0) === 0;
    const retaliateDmg = (isHit && isMeleeWeaponAtk && _isFirstHitOfTurn && _defRetaliate.retaliate && ((defMatchPlayer?.hp ?? 0) - damage) > 0)
      ? rollDmg(_defRetaliate.retaliate).total : 0;
    const retaliateLog = retaliateDmg > 0
      ? `${_defRetaliate.retaliateLabel || "⚡ Ritorsione"} — ${defName} colpisce di rimando ${attName} per ${retaliateDmg} danni!`
      : null;
    // Monaco · Mano Aperta: colpendo in mischia, il prossimo attacco del nemico è a svantaggio.
    const staggerApplies = isHit && isMeleeWeaponAtk && !!getSubclassEffect(attackerSnap).staggerOnHit;
    const staggerLog = staggerApplies ? `✊ ${attName} sbilancia ${defName}: il suo prossimo attacco è a svantaggio!` : null;
    // Regole elementali base: fuoco → Bruciatura (pelle/forma animale), freddo → Congelato.
    const _elemStatus = elementalOnHitStatus(action, isSpellAction, defenderSnap, defMatchPlayer, damage, isHit);
    const elementalLog = _elemStatus.note ? `${defName} — ${_elemStatus.note}` : null;
    // Arma della Bottega con effetti all'impatto (malus al nemico / bonus a te, con % propria).
    const _onHit = (isHit && damage > 0 && !isSpellAction && Array.isArray(action.onHit) && action.onHit.length)
      ? applyMarketEffects(action.onHit, attackerMatchPlayer, defMatchPlayer, true, damage)
      : { selfPatch: {}, enemyPatch: {}, selfHeal: 0, enemyDmg: 0, logs: [] };
    const onHitLog = _onHit.logs.length ? `⚔️ ${action.name} all'impatto → ${_onHit.logs.join(" · ")}` : null;

    const newTurnExpiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    let absorbedLog = null;
    let updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const rawPlayers = m.players.map(p => {
        if (p.id === targetId) {
          // nextHitHalved: una volta consumato dal colpo che ha ricevuto il dimezzamento, lo togliamo.
          const golemConsumed = golemHalved ? { nextHitHalved: false } : {};
          // Monaco · Mano Aperta: svantaggio al prossimo attacco del bersaglio.
          const staggerPatch = staggerApplies ? { attackDisadvantageTurns: Math.max(p.attackDisadvantageTurns ?? 0, 1), ...disadvTag("Sbilanciato", "💫") } : {};
          if (p.absorbDamageNext && damage > 0) {
            const tgtSnap = (arenaMeta.characterSnapshots || {})[targetId] || {};
            const maxHp = tgtSnap.stats?.maxHp ?? p.maxHp ?? p.hp;
            const heal  = Math.floor(damage * 0.8);
            absorbedLog = `🌀 ${p.name} assorbe il colpo e si cura di ${heal} HP!`;
            return { ...p, hp: Math.min(maxHp, p.hp + heal), absorbDamageNext: false, blindDebuff: isBlindDebuff && isHit ? true : (p.blindDebuff ?? false), ...consumeInvisibility(p), ...golemConsumed, ...staggerPatch, ..._elemStatus.patch, stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1) };
          }
          return { ...p, hp: Math.max(0, p.hp - damage - _onHit.enemyDmg), blindDebuff: isBlindDebuff && isHit ? true : (p.blindDebuff ?? false), ...consumeInvisibility(p), ...golemConsumed, ...staggerPatch, ..._elemStatus.patch, ..._onHit.enemyPatch, resistProcs: (p.resistProcs ?? 0) + (isHit && _hitResisted ? 1 : 0), stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1) };
        }
        if (p.id === currentUser.uid) {
          // Magic-detect counter: scala 1 per attacco. Si svuota (spegne il buff) solo a contatore=0.
          const prevMdAtk = p.magicDetectAttacks ?? (p.magicDetectActive ? 1 : 0);
          const newMdAtk  = Math.max(0, prevMdAtk - 1);
          const newMd     = newMdAtk > 0 ? p.magicDetectActive : false;
          // Attacco Poderoso: SET di selfAdvTurns (buff appena attivato).
          // Il tick "−1 per turno" è gestito in turnEndDecays.
          const selfAdvPatch = action.grantsAdvTurns ? { selfAdvTurns: action.grantsAdvTurns } : {};
          // Timer turn-based (Furia/Hunter Mark/Scudo/Patto/Forgia/Concentr/Aquila):
          // NON decrementati qui — si decrementano a fine turno (turnEndDecays).
          const up = { ...p, ...(frenzyPlain ? { frenzyAttackPending: false } : {}), mightyStrikePending: false, defensiveBonus: 0, weaponPoisoned: false, aidBuff: false, bonusActionUsed: false, itemUsedThisTurn: false, bardicInspirationActive: false, magicDetectActive: newMd, magicDetectAttacks: newMdAtk, attacksMade: (p.attacksMade ?? 0) + 1, ...consumeInvisibility(p), stealthAdvTurns: Math.max(0, readStealthAdvTurns(p) - 1), ...selfAdvPatch };
          // Bonus/cura all'impatto dell'arma della Bottega (a chi la impugna).
          if (_onHit.selfHeal > 0 || Object.keys(_onHit.selfPatch).length) {
            Object.assign(up, _onHit.selfPatch);
            if (_onHit.selfHeal > 0) {
              const _atkMax = (arenaMeta.characterSnapshots?.[currentUser.uid]?.stats?.maxHp) ?? p.maxHp ?? (up.hp ?? p.hp);
              up.hp = Math.min(_atkMax, (up.hp ?? p.hp) + _onHit.selfHeal);
            }
          }
          if (action.maxUses !== undefined) {
            const prev = p.actionUsesLeft ?? {};
            up.actionUsesLeft = { ...prev, [action.name]: Math.max(0, (prev[action.name] ?? action.maxUses) - 1) };
          }
          if (_kiteInc) up.kiteChargesUsed = (p.kiteChargesUsed ?? 0) + 1;
          // Ritorsione della sottoclasse difensiva (Ira della Tempesta / Difensore d'Acciaio).
          if (retaliateDmg > 0) up.hp = Math.max(0, (up.hp ?? p.hp) - retaliateDmg);
          return up;
        }
        return { ...p, ...consumeInvisibility(p) };
      });
      const { players: updatedPlayers, extraLogs } = processWsKnockouts(rawPlayers);
      const newParticipantsAwarded = _alreadyAwarded
        ? (m.participantsAwarded || [])
        : [...(m.participantsAwarded || []), currentUser.uid];
      const allLogs = [...m.logs, log, ...extraLogs, ...(absorbedLog ? [absorbedLog] : []), ...(retaliateLog ? [retaliateLog] : []), ...(staggerLog ? [staggerLog] : []), ...(elementalLog ? [elementalLog] : []), ...(onHitLog ? [onHitLog] : []), ...(_distanceLog ? [_distanceLog] : [])];
      const alive = updatedPlayers.filter(p => p.hp > 0);
      if (alive.length === 1) {
        return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
          participantsAwarded: newParticipantsAwarded, ..._distancePatch,
          logs: [...allLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      }
      // Multi-azione (Monaco x2, Ladro x2, Scatto d'Azione +1): non avanza il turno finché restano azioni.
      const meBefore = m.players.find(p => p.id === currentUser.uid);
      const maxActions = getMaxActionsPerTurn(attackerSnap, meBefore);
      const usedSoFar = meBefore?.multiActionsUsed ?? 0;
      const stayingThisTurn = (usedSoFar + 1) < maxActions;
      const newMultiUsed = stayingThisTurn ? usedSoFar + 1 : 0;
      // bonusActionUsed / itemUsedThisTurn devono persistere per l'intero turno del giocatore:
      // si resettano solo quando il turno avanza davvero.
      const preservedBonusUsed = !!meBefore?.bonusActionUsed;
      const preservedItemUsed  = !!meBefore?.itemUsedThisTurn;
      // Timer "per N turni": decrementati SOLO a fine turno (non per ogni multi-azione).
      const turnEndDecays = stayingThisTurn ? {} : {
        attackDisadvantageTurns: Math.max(0, (meBefore?.attackDisadvantageTurns ?? 0) - 1),
        weaponLockTurns: Math.max(0, (meBefore?.weaponLockTurns ?? 0) - 1),
        shieldSkillTurns: Math.max(0, (meBefore?.shieldSkillTurns ?? 0) - 1),
        rageTurns: Math.max(0, (meBefore?.rageTurns ?? 0) - 1), frenzyAttackPending: false, mightyStrikePending: false, ...(frenzyExhausted(meBefore) ? { frenzySpent: false } : {}),
        hunterMarkTurns: Math.max(0, (meBefore?.hunterMarkTurns ?? 0) - 1),
        concentrationTurns: Math.max(0, (meBefore?.concentrationTurns ?? 0) - 1),
        pattoTurns: Math.max(0, (meBefore?.pattoTurns ?? 0) - 1),
        armorForgeTurns: Math.max(0, (meBefore?.armorForgeTurns ?? 0) - 1),
        selfAdvTurns: action.grantsAdvTurns ? action.grantsAdvTurns : Math.max(0, (meBefore?.selfAdvTurns ?? 0) - 1),
        ...tickEagleEnd(meBefore || {}),
      };
      // 🗡 Ladro: traccia le armi usate nel turno (ogni mano una sola volta).
      const _rogueAtt = isRogueClass((attackerSnap?.class || "").toLowerCase());
      const _accWeaponsUsed = (_rogueAtt && action.type === "weapon")
        ? [ ...((meBefore?.turnWeaponsUsed) || []), action.name ]
        : ((meBefore?.turnWeaponsUsed) || []);
      const playersWithMultiState = updatedPlayers.map(p =>
        p.id === currentUser.uid
          ? { ...p,
              multiActionsUsed: newMultiUsed,
              turnWeaponsUsed:   stayingThisTurn ? _accWeaponsUsed : [],
              turnSkillUsed:     stayingThisTurn ? !!meBefore?.turnSkillUsed : false,
              bonusActionUsed:   stayingThisTurn ? !!preservedBonusUsed   : false,
              itemUsedThisTurn:  stayingThisTurn ? !!preservedItemUsed    : false,
              extraTurnActive:   stayingThisTurn ? !!p.extraTurnActive    : false,
              actionSurgeActive: stayingThisTurn ? !!p.actionSurgeActive  : false,
              ...turnEndDecays }
          : p
      );
      const nextTurn = stayingThisTurn ? currentUser.uid : advanceTurn(playersWithMultiState, m);
      // Multi-azione: turnExpiry stabile se il turno resta al giocatore → i DoT ticcano 1/turno.
      return { ...m, players: playersWithMultiState, turn: nextTurn, turnExpiry: stayingThisTurn ? (m.turnExpiry || newTurnExpiry) : newTurnExpiry, participantsAwarded: newParticipantsAwarded, ..._distancePatch, logs: allLogs };
    });

    await awardRoundCoins(updatedMatches);
    await resolveBetsForFinishedMatches(updatedMatches);
    await recordMatchHistory(updatedMatches);
    const finalM = finalJustConcluded(updatedMatches);
    if (finalM) {
      const champSnap = snapshots[finalM.winner] || {};
      await sendChampionNotification(finalM.winner, champSnap.name || "Campione", arenaMeta?.prizes || "", updatedMatches);
      await updateDoc(doc(db, "arena_meta", "global"), {
        matches: updatedMatches, tournamentWinner: finalM.winner, phase: "finished",
      });
      return;
    }
    await commitArenaMatches(updatedMatches);
  };

  // ── DISTANZA: AVVICÌNATI (melee chiude la distanza; usa il turno) ──────────
  // Sostituisce le armi da mischia quando sei "sotto tiro" (lontano vs avversario
  // con arma a distanza e tu senza). Chiude la distanza: dal turno dopo attacchi
  // in mischia normalmente. Vedi la meccanica implicita in _runAttack/aiTakeAction.
  const handleMoveClose = async (matchId) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const log = { pub: `⚔️ ${myName} chiude la distanza e ingaggia in mischia.`, attId: currentUser.uid, ts: new Date().toISOString() };
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, ...tickEagleEnd(p), defensiveBonus: 0 } : p
      );
      return { ...m, players: updatedPlayers, distanceClosed: true, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // NB: il "kiting" non è più un'azione a sé (Allontànati): è fuso nel tiro a
  // distanza quando sei in mischia (vedi _runAttack/aiTakeAction → "Tiro in
  // arretramento"): il tiro è a svantaggio e consuma 1 carica (max ARENA_KITE_MAX).

  // ── SCUDO (skill caster) ──────────────────────────────────────────────────
  const handleShieldSkill = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "?";
    const bonus = action?.shieldBuffBonus ?? 3;
    const turns = action?.shieldBuffTurns ?? 3;
    const spellName = action?.name || "Scudo";
    const log = { pub: `🛡 ${myName} lancia ${spellName}! (+${bonus} CA per ${turns} turni)`, attId: currentUser.uid, ts: new Date().toISOString() };
    const shieldExpiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        return { ...p, shieldSkillTurns: turns, shieldSkillBonus: bonus, defensiveBonus: 0, ...tickEagleEnd(p), ...spendSpellUse(p, mySnap, action) };
      });
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: shieldExpiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── SCUDO DELLA FEDE (save_faith) — +X a TUTTI i TS per N turni ─────────────
  const handleSaveFaith = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const bonus  = action?.saveFaithBonus ?? 2;
    const turns  = action?.saveFaithTurns ?? 2;
    const spellName = action?.name || "Scudo della Fede";
    const log = { pub: `🛡 ${myName} lancia ${spellName}! (+${bonus} a TUTTI i tiri salvezza per ${turns} turni)`, attId: currentUser.uid, ts: new Date().toISOString() };
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = action?.maxUses !== undefined
          ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) }
          : uses;
        // tickEagleEnd PRIMA, poi set: il buff non viene scalato sul turno di lancio.
        return { ...p, ...tickEagleEnd(p), saveFaithTurns: turns, saveFaithBonus: bonus, defensiveBonus: 0, actionUsesLeft: newUses };
      });
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── AIUTO (dmg_buff) — +X al danno di ogni attacco per N turni ──────────────
  const handleDmgBuff = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const bonus  = action?.aidDmgBonus ?? 1;
    const turns  = action?.aidDmgTurns ?? 2;
    const spellName = action?.name || "Aiuto";
    const log = { pub: `🤝 ${myName} lancia ${spellName}! (+${bonus} al danno per ${turns} turni)`, attId: currentUser.uid, ts: new Date().toISOString() };
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = action?.maxUses !== undefined
          ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) }
          : uses;
        return { ...p, ...tickEagleEnd(p), aidDmgTurns: turns, aidDmgBonus: bonus, defensiveBonus: 0, actionUsesLeft: newUses };
      });
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── SECONDO RESPIRO (Fighter) ─────────────────────────────────────────────
  const handleSecondWind = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Guerriero";
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const { total: healAmt, rolls: healRolls } = rollDmg("1d12");
    const totalHeal = healAmt + 5;
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const maxHp = mySnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, hp: Math.min(maxHp, p.hp + totalHeal), shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), frenzyAttackPending: false, mightyStrikePending: false, ...(frenzyExhausted(p) ? { frenzySpent: false } : {}), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), ...tickEagleEnd(p), defensiveBonus: 0, aidBuff: false, bonusActionUsed: false, itemUsedThisTurn: false, actionUsesLeft: newUses };
      });
      const log = { pub: `💨 ${myName} usa Secondo Respiro! Cura 🎲${healRolls}+5=${totalHeal} HP`, attId: currentUser.uid, ts: new Date().toISOString() };
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── SCATTO D'AZIONE (Fighter) ─────────────────────────────────────────────
  const handleActionSurge = async (matchId, action) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    try {
      const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Guerriero";
      const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
      const me = myMatch?.players.find(p => p.id === currentUser.uid);
      if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
      const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id !== currentUser.uid) return p;
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, actionSurgeActive: true, bonusActionUsed: true, actionUsesLeft: newUses };
        });
        const log = { pub: `⚡ ${myName} attiva ${action.name}! Guadagna un'azione extra.`, attId: currentUser.uid, ts: new Date().toISOString() };
        // Turn stays on current player → NON rigenerare turnExpiry (i DoT ticcano 1/turno).
        return { ...m, players: updatedPlayers, turn: currentUser.uid, turnExpiry: m.turnExpiry || expiry, logs: [...m.logs, log] };
      });
      await commitArenaMatches(updatedMatches);
    } finally {
      actionInFlightRef.current = false;
    }
  };

  // ── INDIVIDUAZIONE DEL MAGICO / Guida / Aiuto / Luci Fatate / Benedire / Passo Spedito ──
  // Bonus a numero di attacchi (counter): action.buffBonus + action.buffAttacks
  const handleMagicDetect = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "Bardo";
    const bonusVal = action.buffBonus ?? getMagicDetectBonusForClass((mySnap?.class || "").toLowerCase());
    const attacksVal = action.buffAttacks ?? 1;
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, magicDetectActive: bonusVal, magicDetectAttacks: attacksVal, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const turnsTxt = attacksVal === 1 ? "prossimo attacco" : `prossimi ${attacksVal} attacchi`;
      const log = { pub: `🔮 ${myName} invoca ${action.name}! (+${bonusVal} ai ${turnsTxt})`, attId: currentUser.uid, ts: new Date().toISOString() };
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── CONCENTRAZIONE (Monk · Bonus Action: +2 danni per 2 turni) ────────────
  const handleConcentrate = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Monaco";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, concentrationTurns: 2, bonusActionUsed: true, actionUsesLeft: newUses };
      });
      const log = { pub: `🧘 ${myName} si concentra! +2 danni per 2 turni (bonus action)`, attId: currentUser.uid, ts: new Date().toISOString() };
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── CURA KI (Monk · Bonus Action: cura 1d8+SAG HP) ────────────────────────
  const handleKiHealing = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Monaco";
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const wisMod = mySnap?.stats?.wis ?? 0;
    const { total: healAmt, rolls: healRolls } = rollDmg(action.damage || "1d8");
    const totalHeal = Math.max(1, healAmt + wisMod);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const maxHp = mySnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, hp: Math.min(maxHp, p.hp + totalHeal), bonusActionUsed: true, actionUsesLeft: newUses };
      });
      const sign = wisMod >= 0 ? "+" : "";
      const log = { pub: `🧘 ${myName} canalizza il Ki! Cura 🎲${healRolls}${sign}${wisMod} SAG = ${totalHeal} HP (bonus action)`, attId: currentUser.uid, ts: new Date().toISOString() };
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── ASSORBIRE DANNI (Monk · Bonus Action: prossimo danno → cura 80%, 1 carica) ──────
  // Il nemico vede solo una posa marziale generica per non perdere l'incentivo ad attaccare.
  const handleAbsorbDamage = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Monaco";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const log = {
      pub: `🧘 ${myName} chiude gli occhi e respira profondamente.`,
      att: `🌀 Ti prepari ad assorbire il prossimo colpo (curi l'80% del danno subito · bonus action)`,
      attId: currentUser.uid, ts: new Date().toISOString(),
    };
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, absorbDamageNext: true, bonusActionUsed: true, actionUsesLeft: newUses };
      });
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── INVISIBILITÀ (il nemico non può attaccare il prossimo turno) ──────────
  const handleInvisibility = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "Bardo";
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const duration = action.invisibilityDuration ?? 1;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        return { ...p, invisible: true, invisibilityTurns: duration, ...tickEagleEnd(p), ...spendSpellUse(p, mySnap, action) };
      });
      const turnsLog = duration > 1 ? `${duration} turni` : "il prossimo turno";
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, `👻 ${myName} svanisce nell'ombra! Il nemico non può attaccare per ${turnsLog}.`] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── ISPIRAZIONE BARDICA (Bonus Action) ─────────────────────────────────────
  const handleBardicInspiration = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Bardo";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, bardicInspirationActive: true, bonusActionUsed: true, actionUsesLeft: newUses };
      });
      const log = `🎵 ${myName} si ispira! +1d6 al prossimo tiro per colpire (bonus action).`;
      // Bonus action: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── FURIA (Barbarian · Bonus Action) ───────────────────────────────────────
  const handleRage = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "Barbaro";
    const rageBon = rageDamageBonus(getSnapLevel(mySnap));
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    if (frenzyExhausted(me)) { alert("🥵 Sei sfinito dalla Frenesia: niente Furia per questo turno."); return; }
    const log = `🔥 ${myName} entra in Furia! (+${rageBon} danno armi per 3 turni · bonus action)`;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, rageTurns: 3, rageBonus: rageBon, bonusActionUsed: true, actionUsesLeft: newUses };
      });
      // Bonus action: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── FRENESIA (Barbaro Berserker · Bonus Action, solo in Furia) ─────────────
  // Concede un attacco con l'arma in più in questo turno: il prossimo colpo d'arma
  // conta solo dado + mod. (frenzyAttackPending). A Furia finita: sfinito (frenzySpent).
  const handleFrenzy = async (matchId, action) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    try {
      const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Barbaro";
      const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
      const me = myMatch?.players.find(p => p.id === currentUser.uid);
      if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
      if ((me?.rageTurns ?? 0) <= 0) { alert("🩸 La Frenesia si scatena solo in Furia."); return; }
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id !== currentUser.uid) return p;
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, frenzyAttackPending: true, frenzySpent: true, bonusActionUsed: true, actionUsesLeft: newUses };
        });
        const log = { pub: `🩸 ${myName} entra in Frenesia! Un attacco in più questo turno (a fine Furia sarà sfinito).`, attId: currentUser.uid, ts: new Date().toISOString() };
        // Bonus action: il turno NON avanza.
        return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
      });
      await commitArenaMatches(updatedMatches);
    } finally {
      actionInFlightRef.current = false;
    }
  };

  // ── ATTACCO PODEROSO (Barbaro · Bonus Action) ─────────────────────────────
  // Vantaggio al prossimo attacco di QUESTO turno (mightyStrikePending): si spende
  // al primo attacco e, se non attacchi, si spegne a fine turno. Il turno NON avanza.
  const handleMightyStrike = async (matchId, action) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    try {
      const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Barbaro";
      const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
      const me = myMatch?.players.find(p => p.id === currentUser.uid);
      if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id !== currentUser.uid) return p;
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, mightyStrikePending: true, bonusActionUsed: true, actionUsesLeft: newUses };
        });
        const log = { pub: `💪 ${myName} carica un Attacco Poderoso! Vantaggio al prossimo attacco di questo turno.`, attId: currentUser.uid, ts: new Date().toISOString() };
        return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
      });
      await commitArenaMatches(updatedMatches);
    } finally {
      actionInFlightRef.current = false;
    }
  };

  // ── MARCHIO DEL CACCIATORE (Ranger · BONUS ACTION) ────────────────────────
  const handleHunterMark = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Ranger";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const log = `🎯 ${myName} segna il bersaglio con ${action.name === "Marchio del Cacciatore" ? "il Marchio del Cacciatore" : action.name}! (+3 ai tiri per colpire per 3 turni · bonus action)`;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, hunterMarkTurns: 3, bonusActionUsed: true, actionUsesLeft: newUses };
      });
      // Bonus action: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── COMPAGNI ANIMALI (Ranger) ─────────────────────────────────────────────
  const handlePetWolf = async (matchId, targetId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "Ranger";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const { total: rawDmg, rolls } = rollDmg(action.damage);
    const targetSnapPre = arenaMeta.characterSnapshots?.[targetId];
    const targetMatchPre = myMatch?.players.find(p => p.id === targetId);
    const dmg = applyDefenderDamageMods(rawDmg, targetSnapPre, targetMatchPre, false);
    const targetName = targetSnapPre?.name || "?";
    // ── TS contro sanguinamento (CD = 8 + competenza + SAG del ranger) ──
    const bleedDice = action.bleedDice || "1d4";
    const bleedTurns = action.bleedTurns ?? 2;
    const saveAbility = action.bleedSaveAbility || "con";
    const saveDC = getSpellSaveDC(mySnap);
    const tgtMod = defenderSaveMod(targetSnapPre, saveAbility);
    const d20 = Math.floor(Math.random() * 20) + 1;
    await showD20Roll(d20, { label: `TS · ${SAVE_LABEL[saveAbility]} · ${targetName}` });
    const saveTotal = d20 + tgtMod;
    const savePass = saveTotal >= saveDC;
    const sign = tgtMod >= 0 ? "+" : "";
    const tsTag = `TS ${SAVE_LABEL[saveAbility]} ${d20}${sign}${tgtMod}=${saveTotal} vs CD ${saveDC} → ${savePass ? "✅ SUPERA" : "❌ FALLISCE — 🩸 sanguinamento " + bleedDice + "/turno x" + bleedTurns}`;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, bonusActionUsed: true, actionUsesLeft: newUses };
        }
        if (p.id === targetId) {
          const bled = !savePass ? {
            bleedDoT: true,
            bleedDoTTurns: Math.max(p.bleedDoTTurns ?? 0, bleedTurns),
            bleedDoTDice: bleedDice,
            bleedDoTSourceLabel: "morso del lupo",
            bleedDoTNoun: "sanguinante",
            bleedDoTIcon: "🩸",
          } : {};
          return { ...p, hp: Math.max(0, p.hp - dmg), ...bled };
        }
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `🐺 Il lupo di ${myName} morde ${targetName} 🎲(${rolls})=${dmg} danni! · ${tsTag} · bonus action`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      // Bonus action: il turno NON avanza.
      return { ...m, players, logs: [...m.logs, log, ...extraLogs] };
    });
    await commitArenaMatches(withArenaFx(updatedMatches, matchId, "slash", targetId));
  };

  const handlePetSpider = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Ranger";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const targetSnap = arenaMeta.characterSnapshots?.[targetId];
    const targetName = targetSnap?.name || "?";
    const saveAbility = action.saveAbility || "str";
    const saveDC = action.saveDC ?? 13;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, bonusActionUsed: true, actionUsesLeft: newUses };
        }
        if (p.id === targetId) return {
          ...p,
          pendingControlSave: true,
          pendingControlDC: saveDC,
          pendingControlSaveAbility: saveAbility,
          controlLostTurns: 2,
          poisonDoT: true,
          poisonDoTTurns: Math.max(p.poisonDoTTurns ?? 0, 2),
          poisonDoTDice: "1d4",
          poisonDoTSourceLabel: "veleno del ragno",
          poisonDoTIcon: "🕷",
        };
        return p;
      });
      const log = `🕷 Il ragno di ${myName} morde e intrappola ${targetName} — veleno 🕷 1d4 a inizio turno per 2 turni · TS ${SAVE_LABEL[saveAbility]} (CD ${saveDC}) ogni turno per liberarsi. · bonus action`;
      // Bonus action: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await commitArenaMatches(withArenaFx(updatedMatches, matchId, "poison", targetId));
  };

  const handlePetEagle = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Ranger";
    const _eagleMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = _eagleMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const { total: rawDmg, rolls } = rollDmg(action.damage);
    const dmg = applyDefenderDamageMods(rawDmg, arenaMeta.characterSnapshots?.[targetId], _eagleMatch?.players.find(p => p.id === targetId), false);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, bonusActionUsed: true, actionUsesLeft: newUses };
        }
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - dmg), blindDebuff: true, eagleDebuffTurns: 3 };
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `🦅 L'aquila di ${myName} si avventa su ${targetName}! 🎲(${rolls})=${dmg} danni · accecato + svantaggio per 3 turni. · bonus action`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      // Bonus action: il turno NON avanza.
      return { ...m, players, logs: [...m.logs, log, ...extraLogs] };
    });
    await commitArenaMatches(withArenaFx(updatedMatches, matchId, "ranged", targetId));
  };

  // ── DRAGO DI SMERALDO (Ranger unique) — auto-hit + cura caster ──────────
  const handlePetDrago = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Ranger";
    const _dragoMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = _dragoMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const { total: rawDmg, rolls } = rollDmg(action.damage);
    const dmg = applyDefenderDamageMods(rawDmg, arenaMeta.characterSnapshots?.[targetId], _dragoMatch?.players.find(p => p.id === targetId), false);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, bonusActionUsed: true, actionUsesLeft: newUses };
        }
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - dmg) };
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `🐉 Il Draghetto di Smeraldo di ${myName} colpisce ${targetName} 🎲(${rolls})=${dmg} danni! · bonus action`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      // Bonus action: il turno NON avanza.
      return { ...m, players, logs: [...m.logs, log, ...extraLogs] };
    });
    await commitArenaMatches(withArenaFx(updatedMatches, matchId, "fire", targetId));
  };

  // ── PET DELLA BOTTEGA SETTIMANALE (market) — bonus action generica ────────
  // Definito dai dati del catalogo: danno (auto-hit o tiro per colpire contro
  // la CA effettiva) oppure cura sul padrone. Stesso pattern dei pet Ranger:
  // consuma la bonus action, il turno NON avanza.
  const handleMarketPet = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const _mkMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = _mkMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const isHeal = action.petEffect === "heal";
    if (!isHeal && !targetId) return;

    if (isHeal) {
      const { total: heal, rolls } = rollDmg(action.damage || "2d6");
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id !== currentUser.uid) return p;
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          const maxHp = (arenaMeta.characterSnapshots?.[currentUser.uid]?.stats?.maxHp) ?? p.maxHp ?? p.hp;
          return { ...p, hp: Math.min(maxHp, (p.hp || 0) + heal), bonusActionUsed: true, actionUsesLeft: newUses };
        });
        const log = `${action.icon} ${action.name} di ${myName} lo cura 🎲(${rolls})=${heal} HP! · bonus action`;
        // Bonus action: il turno NON avanza.
        return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
      });
      await commitArenaMatches(updatedMatches);
      return;
    }

    // Danno: eventuale tiro per colpire contro la CA effettiva del bersaglio.
    const targetSnap   = arenaMeta.characterSnapshots?.[targetId];
    const targetPlayer = _mkMatch?.players.find(p => p.id === targetId);
    let missed = false, d20 = 0;
    if (!action.autoHit) {
      d20 = Math.floor(Math.random() * 20) + 1;
      const targetAc = targetAcNow(targetPlayer, targetSnap);
      missed = (d20 + (action.hitBonus || 0)) < targetAc;
    }
    const { total: rawDmg, rolls } = rollDmg(action.damage || "2d6");
    const dmg = missed ? 0 : applyDefenderDamageMods(rawDmg, targetSnap, targetPlayer, false);
    // Effetti all'impatto del pet della Bottega (malus al nemico / bonus al padrone, con %).
    const _petOnHit = (!missed && dmg > 0 && Array.isArray(action.onHit) && action.onHit.length)
      ? applyMarketEffects(action.onHit, me, targetPlayer, true, dmg)
      : { selfPatch: {}, enemyPatch: {}, selfHeal: 0, enemyDmg: 0, logs: [] };
    const petOnHitLog = _petOnHit.logs.length ? `${action.icon} ${action.name} all'impatto → ${_petOnHit.logs.join(" · ")}` : null;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetName = targetSnap?.name || "?";
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          let hp = p.hp;
          if (_petOnHit.selfHeal > 0) {
            const mx = (arenaMeta.characterSnapshots?.[currentUser.uid]?.stats?.maxHp) ?? p.maxHp ?? p.hp;
            hp = Math.min(mx, (p.hp || 0) + _petOnHit.selfHeal);
          }
          return { ...p, hp, ..._petOnHit.selfPatch, bonusActionUsed: true, actionUsesLeft: newUses };
        }
        if (p.id === targetId && !missed) return { ...p, hp: Math.max(0, p.hp - dmg - _petOnHit.enemyDmg), ..._petOnHit.enemyPatch };
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = missed
        ? `${action.icon} ${action.name} di ${myName} manca ${targetName} (🎲${d20}+${action.hitBonus || 0}) · bonus action`
        : `${action.icon} ${action.name} di ${myName} colpisce ${targetName} 🎲(${rolls})=${dmg} danni! · bonus action`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...(petOnHitLog ? [petOnHitLog] : []), ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      // Bonus action: il turno NON avanza.
      return { ...m, players, logs: [...m.logs, log, ...(petOnHitLog ? [petOnHitLog] : []), ...extraLogs] };
    });
    await commitArenaMatches(missed ? updatedMatches : withArenaFx(updatedMatches, matchId, "slash", targetId));
  };

  // ── DEMONI EVOCATI (Warlock) ─────────────────────────────────────────────
  const handleDemonMephit = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Warlock";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const burnTurns = action.burnTurns ?? 3;
    const burnDice  = action.burnDice  ?? "1d8+2";
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const updatedPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, bonusActionUsed: true, actionUsesLeft: newUses };
        }
        if (p.id === targetId) return {
          ...p,
          poisonDoT: true,
          poisonDoTTurns: burnTurns,
          poisonDoTDice: burnDice,
          poisonDoTNoun: "in fiamme",
          poisonDoTSourceLabel: "fuoco",
          poisonDoTIcon: "🔥",
        };
        return p;
      });
      const log = `🔥 Il Mephit di ${myName} brucia ${targetName}! Subirà ${burnDice} fuoco a inizio turno per ${burnTurns} turni. · bonus action`;
      // Bonus action: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    await commitArenaMatches(withArenaFx(updatedMatches, matchId, "fire", targetId));
  };

  // ── COLPO STORDENTE (Monaco · Lv5) — TS COS o il nemico salta 1 turno ───────
  const handleStunStrike = async (matchId, targetId, action) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    try {
      const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
      const myName = mySnap?.name || "Monaco";
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const saveAbility = action.saveAbility || "con";
      const saveDC = 8 + getProficiencyBonus(mySnap) + (mySnap?.stats?.dex ?? 0);
      const defMod = defenderSaveMod(targetSnap, saveAbility);
      const d20 = Math.floor(Math.random() * 20) + 1;
      await showD20Roll(d20, { label: `TS ${SAVE_LABEL[saveAbility]} · ${action.name}` });
      const tsTotal = d20 + defMod;
      const saved = tsTotal >= saveDC;
      const updatedMatches = arenaMeta.matches.map(m => {
        if (m.matchId !== matchId) return m;
        const updatedPlayers = m.players.map(p => {
          if (p.id === currentUser.uid) {
            const uses = p.actionUsesLeft || {};
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
            return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses };
          }
          if (p.id === targetId && !saved) return { ...p, controlLostTurns: Math.max(p.controlLostTurns ?? 0, 1) };
          return p;
        });
        const log = saved
          ? `💫 ${myName} tenta un Colpo Stordente su ${targetName} (TS ${SAVE_LABEL[saveAbility]} ${tsTotal} ≥ ${saveDC}) — resiste!`
          : `💫 ${myName} stordisce ${targetName} con un Colpo Stordente (TS ${SAVE_LABEL[saveAbility]} ${tsTotal} < ${saveDC}) — salta 1 turno!`;
        return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log] };
      });
      await commitArenaMatches(withArenaFx(updatedMatches, matchId, "magic", targetId));
    } finally {
      actionInFlightRef.current = false;
    }
  };

  const handleDemonSuccubus = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Warlock";
    const targetSnap = arenaMeta.characterSnapshots?.[targetId];
    const targetName = targetSnap?.name || "?";
    const saveAbility = action.saveAbility || "cha";
    const saveDC = action.saveDC ?? 13;
    const defMod = defenderSaveMod(targetSnap, saveAbility);
    const d20 = Math.floor(Math.random() * 20) + 1;
    await showD20Roll(d20, { label: `TS ${SAVE_LABEL[saveAbility]} · ${action.name}` });
    const tsTotal = d20 + defMod;
    const saved = tsTotal >= saveDC;
    const lostTurns      = saved ? 1 : 3;
    const disadvantageT  = saved ? 2 : 3;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses };
        }
        if (p.id === targetId) return {
          ...p,
          controlLostTurns: lostTurns,
          attackDisadvantageTurns: Math.max(p.attackDisadvantageTurns ?? 0, disadvantageT),
          ...disadvTag("Ammaliato", "💋"),
        };
        return p;
      });
      const log = saved
        ? `💋 La Succubus di ${myName} ammalia ${targetName} (TS ${SAVE_LABEL[saveAbility]} ${tsTotal} ≥ ${saveDC}) — salta 1 turno · svantaggio per 2 turni.`
        : `💋 La Succubus di ${myName} ammalia ${targetName} (TS ${SAVE_LABEL[saveAbility]} ${tsTotal} < ${saveDC}) — salta 3 turni · svantaggio per 3 turni.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log] };
    });
    await commitArenaMatches(withArenaFx(updatedMatches, matchId, "magic", targetId));
  };

  const handleDemonGreater = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Warlock";
    const { total: rawDmg, rolls } = rollDmg(action.damage);
    const _demonMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const dmg = applyDefenderDamageMods(rawDmg, arenaMeta.characterSnapshots?.[targetId], _demonMatch?.players.find(p => p.id === targetId), false);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          const maxHp = p.maxHp || p.hp;
          return { ...p, hp: Math.min(maxHp, p.hp + dmg), ...tickEagleEnd(p), actionUsesLeft: newUses };
        }
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - dmg) };
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `👹 Il Demone di ${myName} drena ${targetName} 🎲(${rolls})=${dmg} PF e ridona al padrone gli stessi ${dmg} PF!`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log, ...extraLogs] };
    });
    await commitArenaMatches(withArenaFx(updatedMatches, matchId, "magic", targetId));
  };

  // ── COSTRUTTI (Artefice) ─────────────────────────────────────────────────
  const handleConstructGolem = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Artefice";
    const { total: rawDmg, rolls } = rollDmg(action.damage);
    const _golemMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const dmg = applyDefenderDamageMods(rawDmg, arenaMeta.characterSnapshots?.[targetId], _golemMatch?.players.find(p => p.id === targetId), false);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          // Imposta la difesa: il prossimo colpo subìto è dimezzato.
          return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses, nextHitHalved: true };
        }
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - dmg) };
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `🤖 Il Golem di ${myName} colpisce ${targetName} 🎲(${rolls})=${dmg} danni · prossimo colpo subìto sarà dimezzato.`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log, ...extraLogs] };
    });
    await commitArenaMatches(withArenaFx(updatedMatches, matchId, "slash", targetId));
  };

  const handleConstructSnake = async (matchId, targetId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Artefice";
    const { total: rawDmg, rolls } = rollDmg(action.damage);
    const _snakeMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const dmg = applyDefenderDamageMods(rawDmg, arenaMeta.characterSnapshots?.[targetId], _snakeMatch?.players.find(p => p.id === targetId), false);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const targetSnap = arenaMeta.characterSnapshots?.[targetId];
      const targetName = targetSnap?.name || "?";
      const rawPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
          return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses };
        }
        if (p.id === targetId) return { ...p, hp: Math.max(0, p.hp - dmg), poisonDoT: true, poisonDoTTurns: 2 };
        return p;
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `🐍 Il Serpente di ${myName} morde ${targetName} 🎲(${rolls})=${dmg} danni · veleno 1d6 per 2 turni.`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log, ...extraLogs] };
    });
    await commitArenaMatches(withArenaFx(updatedMatches, matchId, "poison", targetId));
  };

  // ── FORGIA ARMATURA (Artefice) — +2 CA per 2 turni ─────────────────────────
  const handleArmorForge = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Artefice";
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, armorForgeTurns: 2, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, `🛠 ${myName} forgia un'armatura sul campo! +2 CA per 2 turni.`] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── FONTE DI MAGIA (Sorcerer) — recupera 2 SLOT condivisi (Lv1/Lv2 a scelta) ──
  const handleFonteConfirm = async (matchId, fonteAction, addLv1, addLv2) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Stregone";
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = { ...(p.actionUsesLeft || {}) };
        // Scala la carica della Fonte di Magia
        uses[fonteAction.name] = Math.max(0, (uses[fonteAction.name] ?? fonteAction.maxUses) - 1);
        // Recupera gli slot condivisi (cap al massimo del pool)
        const slots = { ...(p.spellSlots || {}) };
        slots[1] = Math.min(SORC_SLOTS_MAX, (slots[1] ?? SORC_SLOTS_MAX) + addLv1);
        slots[2] = Math.min(SORC_SLOTS_MAX, (slots[2] ?? SORC_SLOTS_MAX) + addLv2);
        return { ...p, ...tickEagleEnd(p), actionUsesLeft: uses, spellSlots: slots };
      });
      const bits = [];
      if (addLv1 > 0) bits.push(`+${addLv1} slot Lv1`);
      if (addLv2 > 0) bits.push(`+${addLv2} slot Lv2`);
      const log = `🔮 ${myName} attinge alla Fonte di Magia! Recupera ${bits.join(" e ")}.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
    setShowFontePicker(false);
    setFonteSelected([]);
  };

  // ── ASTUZIA MAGICA (Warlock) — salta turno, ripristina tutti gli slot ──────
  // ── PATTO DEMONIACO (Warlock) ─────────────────────────────────────────────
  // Sacrifica 1d4 PF e attiva pattoTurns=3. Mentre pattoTurns > 0, ogni
  // spell che colpisce aggiunge 1d12 ai danni (vedi spell damage path).
  const handlePattoDemoniaco = async (matchId, action) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Warlock";
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const { total: selfDmg, rolls: selfRolls } = rollDmg("1d4");
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const rawPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) };
        return { ...p, hp: Math.max(0, p.hp - selfDmg), pattoTurns: 3, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `🩸 ${myName} stringe un Patto Demoniaco · sacrifica 🎲(${selfRolls})=${selfDmg} PF · per 3 turni le sue spell che colpiscono fanno +1d12 danni!`;
      const alive = players.filter(p => p.hp > 0);
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: expiry, logs: [...m.logs, log, ...extraLogs] };
    });
    await commitArenaMatches(updatedMatches);
  };

  const handleMagicalCunning = async (matchId, cunningAction) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Oscuro Cultore";
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = { ...(p.actionUsesLeft || {}) };
        // Consume the Magical Cunning charge
        uses[cunningAction.name] = Math.max(0, (uses[cunningAction.name] ?? cunningAction.maxUses) - 1);
        // Restore +1 charge to each spell slot (capped at its maxUses)
        (mySnap?.selectedActions || []).forEach(a => {
          if (a.maxUses && a.level > 0) {
            const cur = uses[a.name] ?? a.maxUses;
            uses[a.name] = Math.min(a.maxUses, cur + 1);
          }
        });
        return { ...p, ...tickEagleEnd(p), actionUsesLeft: uses };
      });
      const log = `🌀 ${myName} usa Astuzia Magica! Salta il turno e ripristina 1 carica a ogni slot magia.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── RECUPERO ARCANO (Wizard) — ripristina 2 slot lv1 + 1 slot lv2 ──────────
  const handleRecuperoArcano = async (matchId, recuperoAction, lv1Names, lv2Names) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Mago";
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = { ...(p.actionUsesLeft || {}) };
        uses[recuperoAction.name] = Math.max(0, (uses[recuperoAction.name] ?? recuperoAction.maxUses) - 1);
        [...lv1Names, ...lv2Names].forEach(spellName => {
          const spell = (mySnap?.selectedActions || []).find(a => a.name === spellName);
          if (spell?.maxUses) uses[spellName] = Math.min(spell.maxUses, (uses[spellName] ?? spell.maxUses) + 1);
        });
        return { ...p, ...tickEagleEnd(p), actionUsesLeft: uses };
      });
      const restored = [...lv1Names, ...lv2Names].join(", ");
      const log = `📖 ${myName} usa Recupero Arcano! Ripristina: ${restored}`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
    setShowRecuperoPicker(false);
    setRecuperoLv1Selected([]);
    setRecuperoLv2Selected([]);
  };

  // ── POISON DOT — applica DoT una volta per turno (dado/flavor configurabili) ──
  const handleResolvePoisonDoT = async (matchId) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    const turnTokenAtClick = myMatch?.turnExpiry || "";
    // Già risolto in questo stesso turno: non riapplicare.
    if (me?.poisonResolvedTurnToken && me.poisonResolvedTurnToken === turnTokenAtClick) return;
    const dice = me?.poisonDoTDice || "1d6";
    const sourceLabel = me?.poisonDoTSourceLabel || "veleno";
    const icon = me?.poisonDoTIcon || "☠";
    const { total: poisonRawDmg, rolls: poisonRolls } = rollDmg(dice);
    const poisonDmg = Math.round(poisonRawDmg * dotResistMult(arenaMeta.characterSnapshots?.[currentUser.uid], me));
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const rawPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const remainingDoT = Math.max(0, (p.poisonDoTTurns ?? 1) - 1);
        const stillAfflicted = remainingDoT > 0;
        const patch = {
          ...p,
          hp: Math.max(0, (p.hp ?? 0) - poisonDmg),
          poisonDoT: stillAfflicted,
          poisonDoTTurns: remainingDoT,
          poisonResolvedTurnToken: m.turnExpiry || "",
        };
        if (!stillAfflicted) {
          patch.poisonDoTDice = null;
          patch.poisonDoTNoun = null;
          patch.poisonDoTSourceLabel = null;
          patch.poisonDoTIcon = null;
        }
        return patch;
      });
      const { players: updatedPlayers, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `${icon} ${myName} subisce il ${sourceLabel}: ${poisonDmg} danni [🎲${dice}=${poisonRolls}]!`;
      // Morte da DoT: se il danno periodico abbatte il giocatore a inizio turno,
      // chiudi il match (o passa il turno in FFA) come fa un attacco normale.
      const meAfter = updatedPlayers.find(p => p.id === currentUser.uid);
      if (meAfter && meAfter.hp <= 0) {
        const alive = updatedPlayers.filter(p => p.hp > 0);
        if (alive.length === 1)
          return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
        return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log, ...extraLogs] };
      }
      return { ...m, players: updatedPlayers, logs: [...m.logs, log, ...extraLogs] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── BLEED DOT — sanguinamento (Triboli del Ladro). Stack indipendente dal veleno. ──
  const handleResolveBleedDoT = async (matchId) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    const turnTokenAtClick = myMatch?.turnExpiry || "";
    if (me?.bleedResolvedTurnToken && me.bleedResolvedTurnToken === turnTokenAtClick) return;
    const dice = me?.bleedDoTDice || "1d6";
    const sourceLabel = me?.bleedDoTSourceLabel || "sanguinamento";
    const icon = me?.bleedDoTIcon || "🩸";
    const { total: bleedDmg, rolls: bleedRolls } = rollDmg(dice);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const rawPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const remaining = Math.max(0, (p.bleedDoTTurns ?? 1) - 1);
        const stillAfflicted = remaining > 0;
        const patch = {
          ...p,
          hp: Math.max(0, (p.hp ?? 0) - bleedDmg),
          bleedDoT: stillAfflicted,
          bleedDoTTurns: remaining,
          bleedResolvedTurnToken: m.turnExpiry || "",
        };
        if (!stillAfflicted) {
          patch.bleedDoTDice = null;
          patch.bleedDoTNoun = null;
          patch.bleedDoTSourceLabel = null;
          patch.bleedDoTIcon = null;
        }
        return patch;
      });
      const { players: updatedPlayers, extraLogs } = processWsKnockouts(rawPlayers);
      const log = `${icon} ${myName} subisce il ${sourceLabel}: ${bleedDmg} danni [🎲${dice}=${bleedRolls}]!`;
      // Morte da DoT: se il sanguinamento abbatte il giocatore a inizio turno,
      // chiudi il match (o passa il turno in FFA) come fa un attacco normale.
      const meAfter = updatedPlayers.find(p => p.id === currentUser.uid);
      if (meAfter && meAfter.hp <= 0) {
        const alive = updatedPlayers.filter(p => p.hp > 0);
        if (alive.length === 1)
          return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id, logs: [...m.logs, log, ...extraLogs, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
        return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log, ...extraLogs] };
      }
      return { ...m, players: updatedPlayers, logs: [...m.logs, log, ...extraLogs] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── AUTO-RISOLUZIONE DOT (veleno / sanguinamento) ──────────────────────────
  // Niente più click manuale su "Subisci danno": quando è il mio turno e ho un
  // DoT in sospeso, il danno si applica da solo (come fa già l'IA). Poison e
  // bleed sono stack indipendenti: ne risolviamo uno per render, l'effetto
  // ri-scatta dopo la scrittura e risolve il successivo. Gli handler sono
  // idempotenti sul turn-token, quindi una doppia chiamata è innocua.
  const dotAutoRef = useRef({});
  useEffect(() => {
    if (!arenaMeta?.matches || !currentUser?.uid) return;
    for (const m of arenaMeta.matches) {
      if (m.status !== "active" || m.turn !== currentUser.uid) continue;
      const me = m.players?.find(p => p.id === currentUser.uid);
      if (!me || me.hp <= 0) continue;
      const token = m.turnExpiry || "";
      const poisonPending = me.poisonDoT && (me.poisonResolvedTurnToken || "") !== token;
      const bleedPending  = me.bleedDoT && (me.bleedResolvedTurnToken  || "") !== token;
      if (poisonPending) {
        const k = `${m.matchId}:poison:${token}`;
        if (!dotAutoRef.current[k]) {
          dotAutoRef.current[k] = true;
          handleResolvePoisonDoT(m.matchId).catch(() => { delete dotAutoRef.current[k]; });
        }
      } else if (bleedPending) {
        const k = `${m.matchId}:bleed:${token}`;
        if (!dotAutoRef.current[k]) {
          dotAutoRef.current[k] = true;
          handleResolveBleedDoT(m.matchId).catch(() => { delete dotAutoRef.current[k]; });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaMeta, currentUser]);

  // ── LAY OF HANDS — Bonus Action: cura senza terminare il turno ─────────────
  const handleLayOfHands = async (matchId, healAmt) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Paladino";
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const maxHp = p.maxHp || p.hp;
        const newHp = Math.min(maxHp, (p.hp || 0) + healAmt);
        const newPool = Math.max(0, (p.layOfHandsPool ?? 0) - healAmt);
        return { ...p, hp: newHp, layOfHandsPool: newPool, bonusActionUsed: true };
      });
      const log = `🙏 ${myName} usa Lay of Hands → cura sé stesso di ${healAmt} HP · bonus action`;
      // Bonus action: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, log] };
    });
    setShowLayOfHandsPicker(false);
    await commitArenaMatches(withArenaFx(updatedMatches, matchId, "heal", currentUser.uid));
  };

  // ── AID BUFF (Aiuto) — +4 di default, +2 per Chierico/Paladino ──────────────
  const handleAidBuff = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "Paladino";
    const bonusVal = getAidBonusForClass((mySnap?.class || "").toLowerCase());
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 1)) - 1) };
        return { ...p, aidBuff: bonusVal, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const log = `🤝 ${myName} si concentra — +${bonusVal} al prossimo tiro per colpire!`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── SAVE BUFF (Assorbire Elementi) — +N ai prossimi M tiri salvezza ──────
  const handleSaveBuff = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "?";
    const bonus = action.tsBonus ?? 3;
    const attacks = action.tsAttacks ?? 3;
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = action.maxUses !== undefined ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) } : uses;
        return { ...p, saveBuffBonus: bonus, saveBuffAttacks: attacks, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const log = `🔰 ${myName} invoca ${action.name}! +${bonus} ai prossimi ${attacks} TS.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── WEAPON LOCK (Riscaldare Arma) — il nemico non può attaccare con armi per N turni ─
  const handleWeaponLock = async (matchId, targetId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "?";
    const turns = action.weaponLockTurns ?? 2;
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        // Si arroventa SOLO l'arma attualmente equipaggiata: il bersaglio può cambiare
        // su un'altra arma non equipaggiata (es. arma a 2 mani riposta) e usarla.
        if (p.id === targetId) return { ...p, weaponLockTurns: turns, weaponLockNames: p.equippedWeaponNames || [] };
        if (p.id === currentUser.uid) {
          const uses = p.actionUsesLeft || {};
          const newUses = action.maxUses !== undefined ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) } : uses;
          return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses };
        }
        return p;
      });
      const targetName = (arenaMeta.characterSnapshots || {})[targetId]?.name || "?";
      const log = `🔩 ${myName} arroventa l'arma di ${targetName}! Per ${turns} turni non può usarla.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── SELF ADVANTAGE (Benedire) — vantaggio ai propri attacchi per N turni ────
  const handleSelfAdvantage = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "?";
    const turns = action.advantageTurns ?? 2;
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = action.maxUses !== undefined
          ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) }
          : uses;
        return { ...p, selfAdvTurns: turns, ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const log = `✨ ${myName} invoca ${action.name}! Vantaggio ai prossimi ${turns} attacchi.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── DISADVANTAGE ENEMY (Nebbia / Oscurità) — svantaggio agli attacchi del nemico ────
  const handleDisadvEnemy = async (matchId, targetId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "?";
    const turns = action.disadvantageTurns ?? 3;
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id === targetId) return { ...p, attackDisadvantageTurns: turns, ...disadvTag(action.name || "Svantaggio", action.icon || "🌫") };
        if (p.id === currentUser.uid) {
          return { ...p, ...tickEagleEnd(p), ...spendSpellUse(p, mySnap, action) };
        }
        return p;
      });
      const targetName = (arenaMeta.characterSnapshots || {})[targetId]?.name || "?";
      const log = `🌫 ${myName} oscura ${targetName}! Svantaggio ai suoi tiri per colpire per ${turns} turni.`;
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── EXTRA TURN (Passo Spedito) — la prossima volta che agisci hai 2 azioni ─
  const handleExtraTurn = async (matchId, action) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName = mySnap?.name || "?";
    const isBonus = !!action.bonusAction;
    if (isBonus) {
      const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
      const me = myMatch?.players.find(p => p.id === currentUser.uid);
      if (me?.bonusActionUsed) { alert("⚠ Hai già usato una bonus action questo turno."); return; }
    }
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const uses = p.actionUsesLeft || {};
        const newUses = action.maxUses !== undefined ? { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) } : uses;
        return { ...p, extraTurnActive: true, ...(isBonus ? { bonusActionUsed: true } : {}), ...tickEagleEnd(p), actionUsesLeft: newUses };
      });
      const log = { pub: `💨 ${myName} si prepara a un Passo Spedito: il prossimo turno avrà 2 azioni!${isBonus ? " · bonus action" : ""}`, attId: currentUser.uid, ts: new Date().toISOString() };
      // Bonus action: il turno NON avanza. Altrimenti consuma l'azione.
      return isBonus
        ? { ...m, players: updatedPlayers, logs: [...m.logs, log] }
        : { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── SAVE DOT (Raggio Avvelenato) — TS COS o subisci 2d6/turno per 3 turni ─
  const handleSaveDotSpell = async (matchId, targetId, action) => {
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const myName = mySnap?.name || "?";
    // saveDotStat: CD sulla caratteristica dell'abilità (es. veleno dell'Assassino su DES)
    const dc = action.saveDotDC ?? (action.saveDotStat ? 8 + getProficiencyBonus(mySnap) + (mySnap?.stats?.[action.saveDotStat] ?? 0) : getSpellSaveDC(mySnap));
    const ability = action.saveDotAbility || "con";
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    await runTransaction(db, async (tx) => {
      const ref  = doc(db, "arena_meta", "global");
      const snap = await tx.get(ref);
      const data = snap.data();
      const matches = (data.matches || []).map(m => {
        if (m.matchId !== matchId) return m;
        const targetSnap = arenaMeta.characterSnapshots?.[targetId];
        const targetName = targetSnap?.name || "?";
        const players = m.players.map(p => {
          if (p.id === currentUser.uid) {
            const uses = (p.actionUsesLeft || {});
            const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 1)) - 1) };
            return { ...p, ...tickEagleEnd(p), actionUsesLeft: newUses };
          }
          if (p.id === targetId) return { ...p, pendingSaveDot: { ability, dc, dice: action.saveDotDamage || "2d6", turns: action.saveDotTurns ?? 3, name: action.name, icon: action.icon, element: actionElement(action) } };
          return p;
        });
        const nextIndex = (m.players.findIndex(p => p.id === m.turn) + 1) % m.players.length;
        const log = `${myName} lancia ${action.icon || "🤢"} ${action.name} su ${targetName} → TS ${SAVE_LABEL[ability]} (CD ${dc}) richiesto!`;
        return { ...m, players, turn: m.players[nextIndex].id, turnExpiry: expiry, logs: [...m.logs, log] };
      });
      tx.update(ref, { matches: withArenaFx(matches, matchId, "poison", targetId) });
    });
  };

  // ── SKIP TURN (bersaglio invisibile, non puoi attaccare) ────────────────────
  const handleSkipForcedTurn = async (matchId, reason = "invisible") => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "?";
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const players = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, multiActionsUsed: 0, frenzyAttackPending: false, mightyStrikePending: false, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false, ...tickEagleEnd(p) } : p
      );
      const log = reason === "invisible"
        ? `👻 ${myName} non riesce a colpire un bersaglio invisibile e salta il turno.`
        : `⏭ ${myName} salta il turno.`;
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── Salta turno perché sotto controllo (TS controllo fallito) ────────────
  const skipControlTurn = async (matchId) => {
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Avventuriero";
      const meBefore = m.players.find(p => p.id === currentUser.uid);
      const remaining = Math.max(0, (meBefore?.controlLostTurns ?? 0) - 1);
      const players = m.players.map(p =>
        p.id === currentUser.uid
          ? { ...p, controlLostTurns: remaining, multiActionsUsed: 0, frenzyAttackPending: false, mightyStrikePending: false, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false, ...tickEagleEnd(p) }
          : p
      );
      const log = `🌀 ${myName} è sotto controllo e perde il turno (${remaining} turni rimanenti).`;
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: expiry, logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── Termina turno volontariamente (Monaco/Ladro doppie armi: salta le azioni rimanenti) ─
  const endMultiActionTurn = async (matchId) => {
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const players = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, multiActionsUsed: 0, frenzyAttackPending: false, mightyStrikePending: false, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false, ...tickEagleEnd(p) } : p
      );
      const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Avventuriero";
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: expiry, logs: [...m.logs, `⏭ ${myName} termina il turno volontariamente.`] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── Salta turno (qualsiasi giocatore, qualsiasi tipo di arena) ──────────────
  // Avanza il turno e fa scalare i timer basati su round (rage, shield, marchio, ecc.).
  // I buff "al prossimo attacco" (magic_detect, aiuto, veleno) restano intatti perché non hai attaccato.
  const handleSkipTurn = async (matchId) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Avventuriero";
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const players = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        return {
          ...p,
          multiActionsUsed: 0,
          turnWeaponsUsed: [],
          turnSkillUsed: false,
          bonusActionUsed: false, itemUsedThisTurn: false,
          defensiveBonus: 0,
          actionSurgeActive: false,
          bardicInspirationActive: false,
          extraTurnActive: false,
          ...tickEagleEnd(p),
          ...consumeInvisibility(p),
          rageTurns: Math.max(0, (p.rageTurns ?? 0) - 1), frenzyAttackPending: false, mightyStrikePending: false, ...(frenzyExhausted(p) ? { frenzySpent: false } : {}),
          shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1),
          hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1),
          concentrationTurns: Math.max(0, (p.concentrationTurns ?? 0) - 1),
          armorForgeTurns: Math.max(0, (p.armorForgeTurns ?? 0) - 1),
          selfAdvTurns: Math.max(0, (p.selfAdvTurns ?? 0) - 1),
          stealthAdvTurns: Math.max(0, readStealthAdvTurns(p) - 1),
          attackDisadvantageTurns: Math.max(0, (p.attackDisadvantageTurns ?? 0) - 1),
          weaponLockTurns: Math.max(0, (p.weaponLockTurns ?? 0) - 1),
        };
      });
      return { ...m, players, turn: advanceTurn(players, m), turnExpiry: expiry, logs: [...m.logs, `⏭ ${myName} salta il turno.`] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── WILD SHAPE ─────────────────────────────────────────────────────────────
  // La trasformazione NON consuma il turno: il druido può trasformarsi e poi
  // attaccare nello stesso turno. Il ritorno volontario invece passa il turno.
  const handleWildShape = async (matchId, formKey) => {
    const myMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
    const wsUsesLeft = myMatchPlayer?.wildShapeUsesLeft ?? 1;
    if (wsUsesLeft <= 0) return;
    const form = WILD_SHAPES[formKey];
    const { count, sides } = form.hpDice;
    // HP della forma = tiro vero del dado (countdsides), non massimo teorico.
    const { total: rolledHp, rolls: hpRolls } = rollDmg(`${count}d${sides}`);
    let newHp = Math.max(1, rolledHp);
    // Titolo "Gufo Bianco": +1d12 HP extra quando ti trasformi in bestia.
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    let gufoNote = "";
    if (getSnapTitles(mySnap).includes("gufoBianco")) {
      const { total: bonusHp, rolls: bonusRolls } = rollDmg("1d12");
      newHp += bonusHp;
      gufoNote = ` +🦉Gufo Bianco 1d12=${bonusRolls}`;
    }
    const myName = mySnap?.name || "Druido";
    const newUsesLeft = wsUsesLeft - 1;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const me = m.players.find(p => p.id === currentUser.uid);
      const preHp    = me?.hp    ?? 0;
      const preMaxHp = me?.maxHp ?? preHp;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid ? { ...p, hp: newHp, maxHp: newHp, wildShape: formKey, preWildShapeHp: preHp, preWildShapeMaxHp: preMaxHp, wildShapeUsesLeft: newUsesLeft, ...tickEagleEnd(p) } : p
      );
      return { ...m, players: updatedPlayers,
        logs: [...m.logs, `🐾 ${myName} si trasforma in ${form.icon} ${form.name}! [🎲${count}d${sides}=${hpRolls}${gufoNote}] → ${newHp} HP [Usi rimasti: ${newUsesLeft}/1]`] };
    });
    setShowWildPicker(false);
    await commitArenaMatches(updatedMatches);
  };

  // Ritornare alla forma umana è l'azione del turno: dopo il ritorno il turno passa.
  const revertWildShape = async (matchId) => {
    const myName = (arenaMeta.characterSnapshots || {})[currentUser.uid]?.name || "Druido";
    const expiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const myPData = m.players.find(p => p.id === currentUser.uid);
      const restoredHp    = myPData?.preWildShapeHp    ?? myPData?.hp    ?? 0;
      const restoredMaxHp = myPData?.preWildShapeMaxHp ?? myPData?.maxHp ?? restoredHp;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid
          ? { ...p, hp: restoredHp, maxHp: restoredMaxHp, wildShape: null, preWildShapeHp: null, preWildShapeMaxHp: null, multiActionsUsed: 0, frenzyAttackPending: false, mightyStrikePending: false, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false, ...tickEagleEnd(p) }
          : p
      );
      return { ...m, players: updatedPlayers, turn: advanceTurn(updatedPlayers, m), turnExpiry: expiry,
        logs: [...m.logs, `🧙 ${myName} ritorna alla forma originale (${restoredHp} HP)`] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── CURE ──────────────────────────────────────────────────────────────────
  const handleHealSpell = async (matchId, action) => {
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const myName = mySnap?.name || "?";
    // Colpo Benedetto (Chierico Lv5): +1 dado alla cura.
    const { total: healDice, rolls: healRolls } = rollDmg(clericBlessedDice(action.damage, mySnap));
    const useOverride = !!action.healModStat;
    const spellMod = useOverride
      ? (mySnap?.stats?.[action.healModStat] ?? 0)
      : getSpellMod(mySnap);
    const healAmt  = Math.max(1, healDice + spellMod);
    const modKey   = useOverride
      ? action.healModStat.toUpperCase()
      : getSpellcastingAbility((mySnap?.class || "").toLowerCase()).toUpperCase();
    const modPart  = spellMod !== 0 ? ` ${spellMod >= 0 ? "+" : ""}${spellMod} ${modKey}` : "";
    const healExpiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    await runTransaction(db, async (tx) => {
      const ref  = doc(db, "arena_meta", "global");
      const snap = await tx.get(ref);
      const data = snap.data();
      const matches = (data.matches || []).map(m => {
        if (m.matchId !== matchId) return m;
        let cleansedCount = 0;
        const players = m.players.map(p => {
          if (p.id !== currentUser.uid) return p;
          const maxHp  = p.maxHp || p.hp;
          const newHp  = Math.min(maxHp, (p.hp || 0) + healAmt);
          const uses   = (p.actionUsesLeft || {});
          const newUses = { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? (action.maxUses || 1)) - 1) };
          // Ristorare: oltre a curare, rimuove tutte le condizioni negative.
          const cleansePatch = action.cleansesStatuses ? clearDebuffs(p) : {};
          if (action.cleansesStatuses) cleansedCount = countDebuffs(p);
          return { ...p, hp: newHp, ...tickEagleEnd(p), ...cleansePatch, actionUsesLeft: newUses };
        });
        const nextIndex = (m.players.findIndex(p => p.id === m.turn) + 1) % m.players.length;
        const cleanseTag = action.cleansesStatuses
          ? (cleansedCount > 0 ? ` e rimuove ${cleansedCount} condizione/i negativa/e` : " (nessuna condizione da rimuovere)")
          : "";
        const log = `${myName} lancia ${action.icon} ${action.name} → cura sé stesso di ${healAmt} HP 🎲(${healRolls}${modPart})${cleanseTag}`;
        return { ...m, players, turn: m.players[nextIndex].id, turnExpiry: healExpiry, logs: [...m.logs, log] };
      });
      tx.update(ref, { matches: withArenaFx(matches, matchId, "heal", currentUser.uid) });
    });
  };

  // ── INCANTESIMO A DANNO via TS ─────────────────────────────────────────────
  // Sostituisce il tiro per colpire degli incantesimi: il bersaglio tira d20 + mod
  // nella stessa abilità di lancio del caster (INT/SAG/CAR a seconda della classe).
  // Pass = nessun danno · Fail = danno pieno (dado + spell mod del caster).
  const handleSpellSave = async (matchId, targetId, action) => {
    const snapshots    = arenaMeta.characterSnapshots || {};
    const attackerSnap = snapshots[currentUser.uid];
    const defenderSnap = snapshots[targetId];
    const attackerTitles = getSnapTitles(attackerSnap);
    const attName = attackerSnap?.name || "?";
    const defName = defenderSnap?.name || "?";

    // 1 moneta al primo attacco del giocatore in questo match (escluse Sfide Libere)
    const _currentMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const _alreadyAwarded = (_currentMatch?.participantsAwarded || []).includes(currentUser.uid);
    // Le Monete Arena si assegnano ora a FINE round (awardRoundCoins), non al primo turno.

    // ── Meccanica ufficiale D&D 5e per nome: attack / save_half / save_negate / auto ──
    // La CD dei TS dipende dalla classe del lanciatore; il bonus al colpire degli
    // attacchi a incantesimo = competenza + mod da incantatore; il TS è nella stat dello spell.
    const { cast: castMode, save: saveAbil } = getSpellCast(action);
    // Spell scroll della Bottega: si lancia con la caratteristica scelta dal Master (castStat → statKey).
    const castAbility = (action.isScroll && action.statKey) ? action.statKey : getSpellcastingAbility((attackerSnap?.class || "").toLowerCase());
    const casterMod   = attackerSnap?.stats?.[castAbility] ?? 0;
    const dc          = 8 + getProficiencyBonus(attackerSnap) + casterMod;
    const defMatchPlayer      = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === targetId);
    const attackerMatchPlayer = arenaMeta.matches.find(m => m.matchId === matchId)?.players.find(p => p.id === currentUser.uid);
    const saveBuffBonus  = (defMatchPlayer?.saveBuffAttacks ?? 0) > 0 ? (defMatchPlayer?.saveBuffBonus ?? 0) : 0;
    const saveFaithBonus = readSaveFaithBonus(defMatchPlayer); // Scudo della Fede del bersaglio
    const rolledSave = castMode === "save_half" || castMode === "save_negate";
    // Rintocco Funebre: 1d12 se il nemico è già ferito.
    const targetMaxHp = defenderSnap?.stats?.maxHp ?? defMatchPlayer?.maxHp ?? defMatchPlayer?.hp ?? 0;
    const targetCurHp = defMatchPlayer?.hp ?? 0;
    const targetIsHurt = targetMaxHp > 0 && targetCurHp < targetMaxHp;
    // Colpo Benedetto (Chierico Lv5): +1 dado al danno degli incantesimi.
    const dmgFormula  = clericBlessedDice((action.damageWhenHurt && targetIsHurt) ? action.damageWhenHurt : action.damage, attackerSnap);
    const jackOfAllTradesBonus = isBardClass((attackerSnap?.class || "").toLowerCase()) && getSnapLevel(attackerSnap) >= 2 ? 1 : 0; // Bardo · Tuttofare
    const concentrationDmg = (attackerMatchPlayer?.concentrationTurns ?? 0) > 0 ? 2 : 0;
    const aidDmgBonus = readAidDmgBonus(attackerMatchPlayer); // Aiuto: +X al danno

    let connected = false, halfDamage = false, critHit = false, sorcererCrit = false, outcomeLog = "";
    let casterHitPatch = {};
    if (castMode === "auto") {
      // Dardo Incantato / Magic Missile: colpisce sempre, nessun tiro.
      connected = true;
      outcomeLog = "colpisce automaticamente";
    } else if (castMode === "attack") {
      // Tiro per colpire dell'incantatore vs CA del bersaglio.
      const spellHit = getProficiencyBonus(attackerSnap) + casterMod; // = getSpellAttackBonus, ma con la caratteristica dello scroll
      const mdAtk = attackerMatchPlayer?.magicDetectAttacks ?? 0;
      const aidHit = mdAtk > 0 ? readActiveBonus(attackerMatchPlayer?.magicDetectActive, 0) : readActiveBonus(attackerMatchPlayer?.aidBuff, 4);
      const targetAc = targetAcNow(defMatchPlayer, defenderSnap);
      const d20 = Math.floor(Math.random() * 20) + 1;
      await showD20Roll(d20, { label: `${attName} tira per colpire · ${action.name}` });
      const totalHit = d20 + spellHit + aidHit + jackOfAllTradesBonus;
      // Gli incantesimi NON fanno critico: nat 20 colpisce sempre, nat 1 manca, ma niente danni raddoppiati.
      connected = d20 === 20 || (d20 !== 1 && totalHit >= targetAc);
      // Stregoneria Innata (spell-attack): d20 naturale 17+ che colpisce → danno +50%.
      sorcererCrit = connected && isSorcererClass((attackerSnap?.class || "").toLowerCase()) && d20 >= 17;
      const aidPart = aidHit ? `+${aidHit}` : "";
      outcomeLog = connected
        ? `colpisce [d20 ${d20}+${spellHit}${aidPart}=${totalHit} vs CA ${targetAc}]`
        : `manca [d20 ${d20}+${spellHit}${aidPart}=${totalHit} vs CA ${targetAc}]`;
      if (mdAtk > 0) {
        const newMdAtk = Math.max(0, mdAtk - 1);
        casterHitPatch = { magicDetectAttacks: newMdAtk, magicDetectActive: newMdAtk > 0 ? attackerMatchPlayer?.magicDetectActive : false };
      }
    } else {
      // save_half / save_negate: il bersaglio tira il TS nella stat dell'incantesimo.
      const defMod = defenderSaveMod(defenderSnap, saveAbil);
      const casterHasShield = !!attackerSnap?.hasShield; // scudo del caster → bersaglio salva a VANTAGGIO
      let d20 = Math.floor(Math.random() * 20) + 1;
      if (casterHasShield) { const d20b = Math.floor(Math.random() * 20) + 1; d20 = Math.max(d20, d20b); }
      await showD20Roll(d20, { label: `${defName} tira il TS ${SAVE_LABEL[saveAbil]}${casterHasShield ? " a VANTAGGIO" : ""} · ${action.name}` });
      const tsTotal = d20 + defMod + saveBuffBonus + saveFaithBonus;
      const saved = tsTotal >= dc;
      // Stregoneria Innata: nemico tira ≤7 sul d20 (e fallisce il TS) → danno +50%.
      sorcererCrit = !saved && isSorcererClass((attackerSnap?.class || "").toLowerCase()) && d20 <= 7;
      connected  = !saved || castMode === "save_half";
      halfDamage = saved && castMode === "save_half";
      const buffBits = `${saveBuffBonus > 0 ? `+${saveBuffBonus}🛡` : ""}${saveFaithBonus > 0 ? `+${saveFaithBonus}✝` : ""}`;
      outcomeLog = saved
        ? `supera il TS ${SAVE_LABEL[saveAbil]} [${tsTotal}${buffBits} ≥ CD ${dc}] — ${castMode === "save_half" ? "danni dimezzati" : "nessun danno"}`
        : `fallisce il TS ${SAVE_LABEL[saveAbil]} [${tsTotal}${buffBits} < CD ${dc}]`;
    }

    // ── Danno ──
    let { total: dmgDice, rolls: diceRolls } = connected ? rollDmg(dmgFormula) : { total: 0, rolls: "0" };
    if (critHit && connected) { const ex = rollDmg(dmgFormula); dmgDice += ex.total; diceRolls = `${diceRolls}+${ex.rolls}`; } // crit: dadi raddoppiati
    // Signore della Tempesta (titolo): +1d6 danni da fulmine sulle spell di fulmine/gelo/acqua.
    const stormTitleOn = connected && attackerTitles.includes("signoreTempesta") && isStormSpell(action);
    const { total: stormBonusDmg, rolls: stormRolls } = stormTitleOn ? rollDmg("1d6") : { total: 0, rolls: "" };
    // Sottoclasse: +danno agli incantesimi, dado extra (Artigliere), Ondata Selvaggia.
    // Prima questo percorso (quasi tutti gli incantesimi a danno) li ignorava.
    const subSpellDmg = connected ? (getSubclassEffect(attackerSnap).spellDmg || 0) : 0;
    const { bonus: subSpellDice, tag: subSpellTag } = connected ? subclassDamageDice(attackerSnap, true) : { bonus: 0, tag: "" };
    let rawDmg = connected ? Math.max(0, dmgDice + casterMod + concentrationDmg + aidDmgBonus + stormBonusDmg + subSpellDmg + subSpellDice) : 0;
    if (halfDamage)  rawDmg = Math.floor(rawDmg / 2);
    if (sorcererCrit) rawDmg = Math.floor(rawDmg * 1.5);
    // Difese del bersaglio contro la magia (Elusione, Abiurazione/Immondo −25%,
    // Orso in Furia, Furia −25%…): prima non scattavano mai sugli incantesimi a TS.
    const _spResMult = spellResistMult(action, defenderSnap); // resistenze/immunità/vulnerabilità della Bottega
    const _rawTyped  = Math.round(rawDmg * _spResMult);
    const damage = _rawTyped > 0 ? applyDefenderDamageMods(_rawTyped, defenderSnap, defMatchPlayer, true) : 0;
    const resistTag = (_spResMult === 0 ? " | 🛡immune" : _spResMult > 1 ? " | 💥vulnerabile" : "") + (damage < rawDmg && _spResMult !== 0 ? ` | 🛡difese −${rawDmg - damage}` : "");
    const saves  = damage <= 0; // "nessun danno subìto" per il blocco a valle (assorbi/HP)
    // Tocco Vampirico: cura il caster su danno inflitto.
    const { total: vampHeal, rolls: vampRolls } = (connected && action.vampiric && damage > 0) ? rollDmg(action.vampiricHeal || "1d8") : { total: 0, rolls: "" };
    const modSign = casterMod >= 0 ? "+" : "";
    const concentrationTag = concentrationDmg > 0 ? ` | 🧘conc. +${concentrationDmg}` : "";
    const sorceryTag = sorcererCrit ? " | 🌟Stregoneria Innata +50%" : "";
    // Riga dedicata in chat quando la passiva scatta (oltre al tag nel danno).
    const innataLogArr = sorcererCrit && damage > 0
      ? [`🌟 STREGONERIA INNATA! La magia ribolle nelle vene di ${attName}: ${action.name} infligge +50% danni!`]
      : [];
    const hurtTag    = (action.damageWhenHurt && targetIsHurt) ? ` | 🩸ferito (${dmgFormula})` : "";
    const halfTag    = halfDamage ? " | ½ TS" : "";
    const stormTag   = stormBonusDmg > 0 ? ` | ⚡tempesta 🎲${stormRolls}=${stormBonusDmg}` : "";
    const vampTag    = vampHeal > 0 ? ` | 🩸cura ${vampHeal} HP [🎲${vampRolls}]` : "";
    const subTag     = (subSpellDmg > 0 ? ` | 🎓+${subSpellDmg}` : "") + (subSpellTag ? ` | 🎓${subSpellTag}` : "");
    const dmgTail    = damage > 0 ? ` 🎲(${diceRolls})${modSign}${casterMod} ${castAbility.toUpperCase()}${concentrationTag}${sorceryTag}${hurtTag}${stormTag}${subTag}${halfTag}${resistTag} = ${damage} danni${vampTag}` : "";
    const log = {
      pub: connected
        ? `✨ ${attName} → ${action.name}: ${outcomeLog} su ${defName}${dmgTail}`
        : `✨ ${attName} → ${action.name}: ${outcomeLog} su ${defName} — nessun danno.`,
      att: connected
        ? `✨ ${action.name}: ${outcomeLog} su ${defName}${dmgTail}`
        : `✨ ${action.name}: ${outcomeLog} su ${defName} — nessun danno.`,
      def: connected
        ? `✨ ${attName} ti colpisce con ${action.name}: ${outcomeLog}${dmgTail}`
        : `✨ Eviti ${action.name} di ${attName}: ${outcomeLog}.`,
      attId: currentUser.uid, defId: targetId, ts: new Date().toISOString(),
    };

    const newTurnExpiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    let spellAbsorbedLog = null;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const rawPlayers = m.players.map(p => {
        if (p.id === targetId) {
          // Save buff (Assorbire Elementi): scala il counter solo se c'è stato un vero TS.
          const decSaveBuff = (p.saveBuffAttacks ?? 0) > 0 && rolledSave;
          const newSaveAtk  = decSaveBuff ? Math.max(0, (p.saveBuffAttacks ?? 0) - 1) : (p.saveBuffAttacks ?? 0);
          const newSaveBon  = newSaveAtk > 0 ? p.saveBuffBonus : 0;
          const baseSavePatch = decSaveBuff ? { saveBuffAttacks: newSaveAtk, saveBuffBonus: newSaveBon } : {};
          if (saves) return { ...p, ...consumeInvisibility(p), stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1), ...baseSavePatch };
          if (p.absorbDamageNext && damage > 0) {
            const tgtMaxHp = defenderSnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
            const heal = Math.floor(damage * 0.8);
            spellAbsorbedLog = `🌀 ${p.name} assorbe il colpo e si cura di ${heal} HP!`;
            return { ...p, hp: Math.min(tgtMaxHp, p.hp + heal), absorbDamageNext: false, ...consumeInvisibility(p), stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1), ...baseSavePatch };
          }
          return { ...p, hp: Math.max(0, p.hp - damage), ...consumeInvisibility(p), stealthDisadvTurns: Math.max(0, readStealthDisadvTurns(p) - 1), ...baseSavePatch };
        }
        if (p.id === currentUser.uid) {
          // Consumo: slot condivisi per lo Stregone, usi per-spell altrimenti.
          const usePatch = spendSpellUse(p, attackerSnap, action);
          // Tocco Vampirico: cura il caster.
          const myMaxHp = attackerSnap?.stats?.maxHp ?? p.maxHp ?? p.hp;
          const healedHp = vampHeal > 0 ? Math.min(myMaxHp, (p.hp ?? 0) + vampHeal) : (p.hp ?? 0);
          // Timer turn-based gestiti in turnEndDecaysSpell (sotto), non qui.
          return { ...p, hp: healedHp, defensiveBonus: 0, weaponPoisoned: false, aidBuff: false, bonusActionUsed: false, itemUsedThisTurn: false, bardicInspirationActive: false, ...casterHitPatch, ...consumeInvisibility(p), stealthAdvTurns: Math.max(0, readStealthAdvTurns(p) - 1), ...usePatch };
        }
        return { ...p, ...consumeInvisibility(p) };
      });
      const { players, extraLogs } = processWsKnockouts(rawPlayers);
      const pa = _alreadyAwarded ? (m.participantsAwarded || []) : [...(m.participantsAwarded || []), currentUser.uid];
      const alive = players.filter(p => p.hp > 0);
      const absorbLogArr = spellAbsorbedLog ? [spellAbsorbedLog] : [];
      if (alive.length === 1) return { ...m, players, status: "finished", winner: alive[0].id, participantsAwarded: pa, logs: [...m.logs, log, ...innataLogArr, ...extraLogs, ...absorbLogArr, `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      // Multi-azione: Monaco x2, Ladro x2, +1 se Passo Spedito attivo.
      const meBefore = m.players.find(p => p.id === currentUser.uid);
      const maxActions = getMaxActionsPerTurn(attackerSnap, meBefore);
      const usedSoFar = meBefore?.multiActionsUsed ?? 0;
      const multiWillStay = (usedSoFar + 1) < maxActions;
      const newMultiUsed = multiWillStay ? usedSoFar + 1 : 0;
      const preservedBonusUsed = !!meBefore?.bonusActionUsed;
      const preservedItemUsed  = !!meBefore?.itemUsedThisTurn;
      const turnEndDecaysSpell = multiWillStay ? {} : {
        attackDisadvantageTurns: Math.max(0, (meBefore?.attackDisadvantageTurns ?? 0) - 1),
        weaponLockTurns: Math.max(0, (meBefore?.weaponLockTurns ?? 0) - 1),
        shieldSkillTurns: Math.max(0, (meBefore?.shieldSkillTurns ?? 0) - 1),
        rageTurns: Math.max(0, (meBefore?.rageTurns ?? 0) - 1), frenzyAttackPending: false, mightyStrikePending: false, ...(frenzyExhausted(meBefore) ? { frenzySpent: false } : {}),
        hunterMarkTurns: Math.max(0, (meBefore?.hunterMarkTurns ?? 0) - 1),
        concentrationTurns: Math.max(0, (meBefore?.concentrationTurns ?? 0) - 1),
        pattoTurns: Math.max(0, (meBefore?.pattoTurns ?? 0) - 1),
        armorForgeTurns: Math.max(0, (meBefore?.armorForgeTurns ?? 0) - 1),
        selfAdvTurns: Math.max(0, (meBefore?.selfAdvTurns ?? 0) - 1),
        ...tickEagleEnd(meBefore || {}),
      };
      const playersWithMultiState = players.map(p =>
        p.id === currentUser.uid
          ? { ...p,
              multiActionsUsed: newMultiUsed,
              bonusActionUsed:   multiWillStay ? !!preservedBonusUsed   : false,
              itemUsedThisTurn:  multiWillStay ? !!preservedItemUsed    : false,
              extraTurnActive:   multiWillStay ? !!p.extraTurnActive    : false,
              actionSurgeActive: multiWillStay ? !!p.actionSurgeActive  : false,
              ...turnEndDecaysSpell }
          : p
      );
      const nextTurn = multiWillStay ? currentUser.uid : advanceTurn(playersWithMultiState, m);
      return { ...m, players: playersWithMultiState, turn: nextTurn, turnExpiry: multiWillStay ? (m.turnExpiry || newTurnExpiry) : newTurnExpiry, participantsAwarded: pa, logs: [...m.logs, log, ...innataLogArr, ...extraLogs, ...absorbLogArr] };
    });

    await awardRoundCoins(updatedMatches);
    await resolveBetsForFinishedMatches(updatedMatches);
    await recordMatchHistory(updatedMatches);
    const finalM = finalJustConcluded(updatedMatches);
    if (finalM) {
      const champSnap = snapshots[finalM.winner] || {};
      await sendChampionNotification(finalM.winner, champSnap.name || "Campione", arenaMeta?.prizes || "", updatedMatches);
      await commitArenaMatches(updatedMatches, { tournamentWinner: finalM.winner, phase: "finished" });
      return;
    }
    await commitArenaMatches(updatedMatches);
  };

  // ── CONTROLLO ─────────────────────────────────────────────────────────────
  const handleControlSpell = async (matchId, targetId, action) => {
    const mySnap = arenaMeta.characterSnapshots?.[currentUser.uid];
    const myName = mySnap?.name || "?";
    const ctrlExpiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
    const ctrlDC      = getSpellSaveDC(mySnap);
    const saveAbility = parseSpellSaveAbility(action);
    await runTransaction(db, async (tx) => {
      const ref  = doc(db, "arena_meta", "global");
      const snap = await tx.get(ref);
      const data = snap.data();
      const matches = (data.matches || []).map(m => {
        if (m.matchId !== matchId) return m;
        const targetSnap = arenaMeta.characterSnapshots?.[targetId];
        const targetName = targetSnap?.name || "?";
        const players = m.players.map(p => {
          if (p.id === currentUser.uid) {
            return { ...p, ...tickEagleEnd(p), ...spendSpellUse(p, mySnap, action) };
          }
          if (p.id === targetId) {
            const isCoronaSpell = action.special === "corona_pazzia";
            return {
              ...p,
              pendingControlSave: isCoronaSpell ? "corona_pazzia" : true,
              pendingControlDC: ctrlDC,
              pendingControlSaveAbility: saveAbility,
              // Non-corona control: arm a 2-turn budget so the target re-rolls each turn until they save or it expires.
              ...(isCoronaSpell ? {} : { controlLostTurns: 2 }),
            };
          }
          return p;
        });
        const nextIndex = (m.players.findIndex(p => p.id === m.turn) + 1) % m.players.length;
        const log = `${myName} lancia ${action.icon} ${action.name} su ${targetName} → TS ${SAVE_LABEL[saveAbility]} (CD ${ctrlDC}) richiesto!`;
        return { ...m, players, turn: m.players[nextIndex].id, turnExpiry: ctrlExpiry, logs: [...m.logs, log] };
      });
      tx.update(ref, { matches: withArenaFx(matches, matchId, "magic", targetId) });
    });
  };

  // ── TIRI SALVEZZA ──────────────────────────────────────────────────────────
  const rollSavingThrow = async (matchId, saveType, context) => {
    const mySnap = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const isControl = context === "control_spell" || context === "corona_pazzia";
    const isSaveDot = context === "save_dot";
    // Per il TS controllo, usa l'abilità memorizzata sul player (es. SAG/COS/FOR) e la CD del caster.
    const myMatch  = arenaMeta.matches?.find(m => m.matchId === matchId);
    const myPlayer = myMatch?.players?.find(p => p.id === currentUser.uid);
    const ctrlAbility = isControl ? (myPlayer?.pendingControlSaveAbility || saveType || "wis") : saveType;
    const ctrlDC      = isControl ? (myPlayer?.pendingControlDC || 13) : null;
    const dotAbility  = isSaveDot ? (myPlayer?.pendingSaveDot?.ability || saveType || "con") : null;
    const dotDC       = isSaveDot ? (myPlayer?.pendingSaveDot?.dc || 13) : null;
    const effectiveAbility = isControl ? ctrlAbility : isSaveDot ? dotAbility : saveType;
    const saveBuffActive = (myPlayer?.saveBuffAttacks ?? 0) > 0;
    const saveBuffBonus  = saveBuffActive ? (myPlayer?.saveBuffBonus ?? 0) : 0;
    const saveFaithBonus = readSaveFaithBonus(myPlayer); // Scudo della Fede: +X a TUTTI i TS
    // Armatura pesante → TS a svantaggio contro spell fulmine/tuono (percorso TS-DoT).
    const _elemDisadv = isSaveDot && isHeavyArmor(mySnap) && ["fulmine", "tuono"].includes(myPlayer?.pendingSaveDot?.element);
    const _d20a = Math.floor(Math.random() * 20) + 1;
    const _d20b = _elemDisadv ? Math.floor(Math.random() * 20) + 1 : 0;
    const d20 = _elemDisadv ? Math.min(_d20a, _d20b) : _d20a;
    await showD20Roll(d20, { label: `TS · ${SAVE_LABEL[effectiveAbility] || (effectiveAbility || "").toUpperCase()}${_elemDisadv ? " (svantaggio · armatura pesante)" : ""}` });
    const mod = mySnap?.stats?.[effectiveAbility] ?? 0;
    const dc  = isControl ? ctrlDC : isSaveDot ? dotDC : 15;
    const total = d20 + mod + saveBuffBonus + saveFaithBonus;
    const pass = total >= dc;
    const buffSign = `${saveBuffBonus > 0 ? `+${saveBuffBonus}🛡` : ""}${saveFaithBonus > 0 ? `+${saveFaithBonus}✝` : ""}`;
    const myName = mySnap?.name || "?";
    const modSign = mod >= 0 ? "+" : "";
    let logMsg = isControl
      ? `🌀 ${myName} — TS ${SAVE_LABEL[ctrlAbility] || ctrlAbility.toUpperCase()} (Controllo): ${d20}${modSign}${mod}${buffSign}=${total} (CD ${dc}) → ${pass ? "✅ PASSA" : "❌ FALLISCE"}`
      : isSaveDot
      ? `🤢 ${myName} — TS ${SAVE_LABEL[dotAbility] || dotAbility.toUpperCase()} (${myPlayer?.pendingSaveDot?.name || "Veleno"}): ${d20}${modSign}${mod}${buffSign}=${total} (CD ${dc}) → ${pass ? "✅ PASSA" : "❌ FALLISCE"}`
      : `🎲 ${myName} — TS ${SAVE_LABEL[saveType] || saveType.toUpperCase()}: ${d20}${modSign}${mod}${buffSign}=${total} (CD ${dc}) → ${pass ? "✅ PASSA" : "❌ FALLISCE"}`;

    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      let extraTurn = {};

      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        const up = { ...p };
        // Save-buff scala il counter (se ha contribuito a questo TS).
        if (saveBuffActive) {
          const newAtk = Math.max(0, (p.saveBuffAttacks ?? 0) - 1);
          up.saveBuffAttacks = newAtk;
          if (newAtk === 0) up.saveBuffBonus = 0;
        }
        if (context === "save_dot") {
          const dot = p.pendingSaveDot;
          delete up.pendingSaveDot;
          if (!pass && dot) {
            up.poisonDoT = true;
            up.poisonDoTTurns = dot.turns ?? 3;
            up.poisonDoTDice  = dot.dice  ?? "2d6";
            logMsg += ` — Avvelenato! Subirà ${up.poisonDoTDice} a inizio turno per ${up.poisonDoTTurns} turni.`;
          } else {
            logMsg += " — Resiste al veleno!";
          }
        }
        if (context === "con_poison") {
          delete up.pendingConSave;
          if (!pass) {
            const { total: poisonDmg, rolls: pRolls } = rollDmg("2d6");
            up.hp = Math.max(0, (up.hp ?? 0) - poisonDmg);
            logMsg += ` — Avvelenato! Subisce ${poisonDmg} danni da veleno [🎲${pRolls}].`;
          }
        }
        if (context === "dex_web") {
          delete up.pendingDexSave;
          if (!pass) { up.entangled = true; logMsg += " — Intrappolato nella ragnatela!"; }
          else logMsg += " — Ha schivato la ragnatela!";
        }
        if (context === "str_escape") {
          if (pass) { delete up.entangled; logMsg += " — Si è liberato!"; }
          else logMsg += " — Ancora intrappolato!";
          const currentIndex = m.players.findIndex(pl => pl.id === currentUser.uid);
          let nextIndex = (currentIndex + 1) % m.players.length;
          while (m.players[nextIndex]?.hp <= 0) nextIndex = (nextIndex + 1) % m.players.length;
          extraTurn = { turn: m.players[nextIndex].id, turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString() };
        }
        if (context === "control_spell" || context === "corona_pazzia") {
          const isCorona = p.pendingControlSave === "corona_pazzia" || context === "corona_pazzia";
          if (pass) {
            // Free: clear all control state and let the player act this turn.
            delete up.pendingControlSave;
            delete up.pendingControlDC;
            delete up.pendingControlSaveAbility;
            up.controlLostTurns = 0;
            logMsg += " — Passa! Si libera dal controllo e può agire normalmente.";
          } else if (isCorona) {
            // Corona della Pazzia: one-shot self-damage, no recurring TS.
            const mySnap2 = (arenaMeta.characterSnapshots || {})[currentUser.uid];
            const equippedName = p.equippedWeaponNames?.[0];
            const weapon = (mySnap2?.selectedActions || []).find(a => a.name === equippedName && a.type === "weapon");
            const dmgFormula = weapon?.damage || "1d6";
            const { total: selfDmg, rolls: selfRolls } = rollDmg(dmgFormula);
            up.hp = Math.max(0, (up.hp ?? 0) - selfDmg);
            delete up.pendingControlSave;
            delete up.pendingControlDC;
            delete up.pendingControlSaveAbility;
            logMsg += ` — Fallisce! Attacca sé stesso con ${weapon?.icon || "⚔"} ${equippedName || "arma"}: ${selfDmg} danni [🎲${selfRolls}]!`;
            const currentIndex = m.players.findIndex(pl => pl.id === currentUser.uid);
            let nextIndex = (currentIndex + 1) % m.players.length;
            while (m.players[nextIndex]?.hp <= 0) nextIndex = (nextIndex + 1) % m.players.length;
            extraTurn = { turn: m.players[nextIndex].id, turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString() };
          } else {
            // Regular control spell: burn one turn of the control budget, auto-skip, re-roll TS next turn until pass or budget exhausted.
            const remaining = Math.max(0, (p.controlLostTurns ?? 2) - 1);
            up.controlLostTurns = remaining;
            if (remaining > 0) {
              // Keep TS armed for next turn.
              logMsg += ` — Fallisce! Turno saltato — ${remaining} turno/i di controllo rimasti (TS al prossimo turno).`;
            } else {
              delete up.pendingControlSave;
              delete up.pendingControlDC;
              delete up.pendingControlSaveAbility;
              logMsg += " — Fallisce! Turno saltato — l'effetto si esaurisce.";
            }
            const currentIndex = m.players.findIndex(pl => pl.id === currentUser.uid);
            let nextIndex = (currentIndex + 1) % m.players.length;
            while (m.players[nextIndex]?.hp <= 0) nextIndex = (nextIndex + 1) % m.players.length;
            extraTurn = { turn: m.players[nextIndex].id, turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString() };
          }
        }
        return up;
      });

      return { ...m, players: updatedPlayers, logs: [...m.logs, logMsg], ...extraTurn };
    });

    await commitArenaMatches(updatedMatches);
  };

  // ── EQUIPAGGIAMENTO ARMI ──────────────────────────────────────────────────
  // Equip iniziale (azione gratuita all'inizio del primo turno)
  const handleEquipWeapons = async (matchId, weaponNames) => {
    const allActions = (arenaMeta.characterSnapshots?.[currentUser.uid]?.selectedActions || []);
    const hasTwoHanded = weaponNames.some(n => allActions.find(a => a.name === n)?.twoHanded);
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p =>
        p.id === currentUser.uid
          ? { ...p, equippedWeaponNames: weaponNames, shieldSuppressed: hasTwoHanded }
          : p
      );
      return { ...m, players: updatedPlayers };
    });
    await commitArenaMatches(updatedMatches);
  };

  // Cambio arma durante il combat (costa il turno)
  const handleSwitchWeapon = async (matchId, weaponName) => {
    const mySnap   = arenaMeta.characterSnapshots?.[currentUser.uid];
    const action   = mySnap?.selectedActions?.find(a => a.name === weaponName);
    const is2H     = action?.twoHanded || false;
    const myName   = mySnap?.name || "?";
    const log      = `🔄 ${myName} cambia arma → ${action?.icon || ""} ${weaponName} — turno speso`;
    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;
      const updatedPlayers = m.players.map(p => {
        if (p.id !== currentUser.uid) return p;
        // Il cambio arma spende il turno: scala i timer a round (incluso il
        // blocco arma, via tickEagleEnd) così il debuff viene contato anche
        // quando si ripiega su un'arma non arroventata.
        return { ...p, equippedWeaponNames: [weaponName], shieldSuppressed: is2H, shieldSkillTurns: Math.max(0, (p.shieldSkillTurns ?? 0) - 1), ...tickEagleEnd(p) };
      });
      const currentIndex = m.players.findIndex(p => p.id === currentUser.uid);
      let nextIndex = (currentIndex + 1) % m.players.length;
      while (updatedPlayers[nextIndex]?.hp <= 0) nextIndex = (nextIndex + 1) % m.players.length;
      return { ...m, players: updatedPlayers, turn: updatedPlayers[nextIndex].id, turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString(), logs: [...m.logs, log] };
    });
    await commitArenaMatches(updatedMatches);
  };

  // ── ITEMS — azione gratuita: non consuma azione né bonus action, ma 1 sola per turno ──
  const useItem = async (matchId, itemKey, targetId) => {
    const mySnapItems = (arenaMeta.characterSnapshots || {})[currentUser.uid];
    const myName  = mySnapItems?.name || "?";
    // Oggetti base + consumabili della Bottega settimanale (chiavi "mk_…").
    const marketItem = (mySnapItems?.marketConsumables || []).find(i => i.key === itemKey) || null;
    const item    = ARENA_ITEMS.find(i => i.key === itemKey) || marketItem;
    if (!item) return;
    const myMatch = arenaMeta.matches.find(m => m.matchId === matchId);
    const me = myMatch?.players.find(p => p.id === currentUser.uid);
    if (me?.itemUsedThisTurn) { alert("⚠ Hai già usato un oggetto questo turno."); return; }

    // Consumabile MULTI-EFFETTO della Bottega (nuovo schema `effects`): i tiri di
    // cura/danno si risolvono UNA volta qui, così self e nemico restano coerenti.
    const enemyName = myMatch?.players.find(p => p.id === targetId)?.name || "il nemico";
    const meMaxHp   = (arenaMeta.characterSnapshots?.[currentUser.uid]?.stats?.maxHp) ?? me?.maxHp ?? 70;
    const composite = marketItem?.effects
      ? applyMarketEffects(marketItem.effects, me, myMatch?.players.find(p => p.id === targetId), false)
      : null;
    // Azione gratuita: dopo l'oggetto attacchi ancora e a fine turno i contatori
    // scalano di 1. Senza compenso "+1 CA per 2 turni" copriva un solo attacco nemico.
    if (composite) {
      const sp = composite.selfPatch;
      if (sp.shieldSkillTurns) sp.shieldSkillTurns += 1;
      if (sp.saveFaithTurns) sp.saveFaithTurns += 1;
    }

    const updatedMatches = arenaMeta.matches.map(m => {
      if (m.matchId !== matchId) return m;

      // Decrement item use
      const myP = m.players.find(p => p.id === currentUser.uid);
      const curUses = myP?.itemUsesLeft?.[itemKey] ?? 0;
      if (curUses <= 0) return m;

      const _itemTs = new Date().toISOString();
      let log = null;
      const updatedPlayers = m.players.map(p => {
        if (p.id === currentUser.uid) {
          const newUses = { ...(p.itemUsesLeft || {}), [itemKey]: Math.max(0, curUses - 1) };
          if (itemKey === "pozione_cura") {
            const { total: heal, rolls: healRolls } = rollDmg("2d12");
            const maxHp = (arenaMeta.characterSnapshots?.[currentUser.uid]?.stats?.maxHp) ?? p.maxHp ?? 70;
            const newHp = Math.min(maxHp, (p.hp || 0) + heal);
            log = { pub: `🧪 ${myName} usa Pozione di Cura [🎲${healRolls}=${heal}] — recupera ${heal} HP (${newHp} HP) · azione gratuita`, ts: _itemTs };
            return { ...p, hp: newHp, itemUsesLeft: newUses, itemUsedThisTurn: true };
          }
          // Consumabile-cura della Bottega settimanale: stesso schema della pozione.
          if (marketItem && marketItem.effect === "heal") {
            const { total: heal, rolls: healRolls } = rollDmg(marketItem.dice || "2d8");
            const maxHp = (arenaMeta.characterSnapshots?.[currentUser.uid]?.stats?.maxHp) ?? p.maxHp ?? 70;
            const newHp = Math.min(maxHp, (p.hp || 0) + heal);
            log = { pub: `${marketItem.icon} ${myName} usa ${marketItem.name} [🎲${healRolls}=${heal}] — recupera ${heal} HP (${newHp} HP) · azione gratuita`, ts: _itemTs };
            return { ...p, hp: newHp, itemUsesLeft: newUses, itemUsedThisTurn: true };
          }
          if (itemKey === "pozione_veleno") {
            return { ...p, itemUsesLeft: newUses, itemUsedThisTurn: true };
          }
          // Consumabile MULTI-EFFETTO: cura + bonus su di sé (danno/malus sul nemico sotto).
          if (composite) {
            const newHp = Math.min(meMaxHp, (p.hp || 0) + composite.selfHeal);
            const tgtPart = effectsHaveEnemyTarget(marketItem.effects) ? ` su ${enemyName}` : "";
            log = { pub: `${marketItem.icon} ${myName} usa ${marketItem.name}${tgtPart} — ${composite.logs.join(" · ")} · azione gratuita`, ts: _itemTs };
            return { ...p, hp: newHp, ...composite.selfPatch, itemUsesLeft: newUses, itemUsedThisTurn: true };
          }
          return { ...p, itemUsesLeft: newUses, itemUsedThisTurn: true };
        }
        // Consumabile MULTI-EFFETTO: danno + malus sul nemico.
        if (composite && p.id === targetId) {
          return { ...p, hp: Math.max(0, p.hp - composite.enemyDmg), ...composite.enemyPatch };
        }
        if (itemKey === "bomba" && p.id === targetId) {
          const { total: dmg, rolls: bombRolls } = rollDmg("2d6");
          log = { pub: `💣 ${myName} lancia una Bomba su ${p.name} [🎲${bombRolls}=${dmg}] — ${dmg} danni! · azione gratuita`, ts: _itemTs };
          return { ...p, hp: Math.max(0, p.hp - dmg) };
        }
        // Consumabile-danno della Bottega settimanale: stesso schema della bomba.
        if (marketItem && marketItem.effect === "damage" && p.id === targetId) {
          const { total: dmg, rolls: mkRolls } = rollDmg(marketItem.dice || "2d6");
          log = { pub: `${marketItem.icon} ${myName} usa ${marketItem.name} su ${p.name} [🎲${mkRolls}=${dmg}] — ${dmg} danni! · azione gratuita`, ts: _itemTs };
          return { ...p, hp: Math.max(0, p.hp - dmg) };
        }
        // Consumabile-MALUS della Bottega settimanale: infligge uno svantaggio al bersaglio.
        if (marketItem && marketItem.effect === "malus" && p.id === targetId) {
          const mt    = marketItem.malusType || "disadvantage";
          const turns = Math.max(1, marketItem.malusTurns || 2);
          const dice  = marketItem.malusDice || "1d6";
          const meta  = MALUS_TYPE_MAP[mt] || MALUS_TYPE_MAP.disadvantage;
          let patch = {};
          if (mt === "disadvantage") {
            patch = { attackDisadvantageTurns: Math.max(p.attackDisadvantageTurns ?? 0, turns), ...disadvTag("Svantaggio") };
          } else if (mt === "freeze") {
            patch = { attackDisadvantageTurns: Math.max(p.attackDisadvantageTurns ?? 0, 1), ...disadvTag("Congelato", "🧊", "is-frost") };
          } else if (mt === "bleed") {
            patch = { bleedDoT: true, bleedDoTTurns: Math.max(p.bleedDoTTurns ?? 0, turns), bleedDoTDice: dice, bleedDoTSourceLabel: "sanguinamento", bleedDoTNoun: "sanguinante", bleedDoTIcon: "🩸" };
          } else if (mt === "poison") {
            patch = { poisonDoT: true, poisonDoTTurns: Math.max(p.poisonDoTTurns ?? 0, turns), poisonDoTDice: dice, poisonDoTSourceLabel: "veleno", poisonDoTNoun: "avvelenato", poisonDoTIcon: "☠" };
          } else if (mt === "burn") {
            patch = { poisonDoT: true, poisonDoTTurns: Math.max(p.poisonDoTTurns ?? 0, turns), poisonDoTDice: dice, poisonDoTSourceLabel: "bruciatura", poisonDoTNoun: "in fiamme", poisonDoTIcon: "🔥" };
          }
          const dicePart  = meta.needsDice  ? ` ${dice}/turno` : "";
          const turnsPart = meta.needsTurns ? ` per ${turns} turni` : "";
          log = { pub: `${marketItem.icon} ${myName} usa ${marketItem.name} su ${p.name} — ${meta.icon} ${meta.label}${dicePart}${turnsPart}! · azione gratuita`, ts: _itemTs };
          return { ...p, ...patch };
        }
        if (itemKey === "pozione_veleno" && p.id === targetId) {
          log = { pub: `☠ ${myName} lancia Pozione di Veleno su ${p.name} — subirà 1d6 veleno al prossimo turno! · azione gratuita`, ts: _itemTs };
          return { ...p, poisonDoT: true };
        }
        return p;
      });

      const alive = updatedPlayers.filter(p => p.hp > 0);
      if (alive.length === 1) {
        return { ...m, players: updatedPlayers, status: "finished", winner: alive[0].id,
          logs: [...m.logs, ...(log ? [log] : []), `🏆 ${alive[0].name.toUpperCase()} È IL VINCITORE!`] };
      }
      // Azione gratuita: il turno NON avanza.
      return { ...m, players: updatedPlayers, logs: [...m.logs, ...(log ? [log] : [])] };
    });

    // Check tournament end
    await awardRoundCoins(updatedMatches);
    await resolveBetsForFinishedMatches(updatedMatches);
    await recordMatchHistory(updatedMatches);
    const finalM = finalJustConcluded(updatedMatches);
    if (finalM) {
      const champSnap = (arenaMeta.characterSnapshots || {})[finalM.winner] || {};
      await sendChampionNotification(finalM.winner, champSnap.name || "Campione", arenaMeta?.prizes || "", updatedMatches);
      await commitArenaMatches(updatedMatches, { tournamentWinner: finalM.winner, phase: "finished" });
      return;
    }
    await commitArenaMatches(updatedMatches);
  };

  // ── AUTO-PASS / AUTO-INIT (timer scaduto) ──────────────────────────────────
  const lastAutoPassFireRef = useRef(0);

  const handleArenaAutoPass = useCallback(async () => {
    if (!arenaMeta?.matches) return;
    const now = arenaNow() - ARENA_EXPIRY_GRACE_MS; // ora del server, con margine

    const expiredInitMatch = arenaMeta.matches.find(m => {
      if (m.status !== "initiative" || !m.turnExpiry) return false;
      return now >= new Date(m.turnExpiry).getTime();
    });
    const expiredActiveMatch = arenaMeta.matches.find(m => {
      if (m.status !== "active" || !m.turn || !m.turnExpiry) return false;
      return now >= new Date(m.turnExpiry).getTime();
    });
    if (!expiredInitMatch && !expiredActiveMatch) return;

    let autoClosed = [];
    try {
      const metaRef = doc(db, "arena_meta", "global");
      await runTransaction(db, async (transaction) => {
        autoClosed = [];
        const snap = await transaction.get(metaRef);
        if (!snap.exists()) return;
        const data = snap.data();

        // ── Iniziativa scaduta → auto-tiro ──────────────────────────────────
        if (expiredInitMatch) {
          const match = data.matches?.find(m => m.matchId === expiredInitMatch.matchId);
          if (!match || match.status !== "initiative" || !match.turnExpiry) return;
          if (arenaNow() - ARENA_EXPIRY_GRACE_MS < new Date(match.turnExpiry).getTime()) return;
          if (data.timerPaused && match.kind !== "fun") return; // torneo in pausa: niente timeout
          const snapshots = data.characterSnapshots || {};
          const newLogs = [...match.logs];
          const updatedPlayers = match.players.map(p => {
            if (p.init > 0) return p;
            const dex = snapshots[p.id]?.stats?.dex ?? 0;
            const hasAdv = isRogueClass((snapshots[p.id]?.class || "").toLowerCase());
            const d20a = Math.floor(Math.random() * 20) + 1;
            const d20b = hasAdv ? Math.floor(Math.random() * 20) + 1 : 0;
            const d20 = hasAdv ? Math.max(d20a, d20b) : d20a;
            const noArmorInit = isNoArmor(snapshots[p.id]) ? 1 : 0; // Senza armatura → +1 iniziativa
            const roll = d20 + dex + noArmorInit;
            const advTag = `${hasAdv ? ` 🌟vant.[${d20a},${d20b}]` : ""}${noArmorInit ? " +1 senz'armatura" : ""}`;
            newLogs.push(`🎲 ${snapshots[p.id]?.name || p.name} tira iniziativa (automatico): ${roll}${advTag}`);
            return { ...p, init: roll };
          });
          const allRolled = updatedPlayers.every(p => p.init > 0);
          const sorted = [...updatedPlayers].sort((a, b) => b.init - a.init);
          const updatedMatch = {
            ...match, players: updatedPlayers,
            status: allRolled ? "active" : "initiative",
            turn: allRolled ? sorted[0].id : null,
            turnExpiry: new Date(arenaNow() + ARENA_TURN_DURATION).toISOString(),
            fightStartAt: allRolled ? new Date().toISOString() : (match.fightStartAt || null),
            logs: newLogs,
          };
          const updatedMatches = data.matches.map(m => m.matchId === match.matchId ? updatedMatch : m);
          transaction.update(metaRef, { matches: updatedMatches });
          return;
        }

        // ── Turno attivo scaduto → si passa il turno ─────────────────────────
        const match = data.matches?.find(m => m.matchId === expiredActiveMatch.matchId);
        if (!match || match.status !== "active" || !match.turn || !match.turnExpiry) return;
        if (arenaNow() - ARENA_EXPIRY_GRACE_MS < new Date(match.turnExpiry).getTime()) return;
        if (data.timerPaused && match.kind !== "fun") return; // torneo in pausa: niente timeout
        if (match.lastAutoPassAt && Date.now() - new Date(match.lastAutoPassAt).getTime() < 10000) return;

        const currentTurnId = match.turn;
        const currentPlayerObj = match.players.find(p => p.id === currentTurnId);
        if (!currentPlayerObj) return;
        const alivePlayers = match.players.filter(p => p.hp > 0);
        const currentIdx = alivePlayers.findIndex(p => p.id === currentTurnId);
        const nextIdx = (currentIdx + 1) % alivePlayers.length;
        const nextTurnId = alivePlayers[nextIdx]?.id || null;

        const newLogs2 = [...match.logs];
        // Auto-roll any pending saving throws for the current player
        const hasPendingDex = currentPlayerObj.pendingDexSave;
        const hasPendingCon = currentPlayerObj.pendingConSave;
        const hasPendingCtrl = currentPlayerObj.pendingControlSave;
        const hasPoisonDoT = currentPlayerObj.poisonDoT;

        const updatedPlayers = match.players.map(p => {
          if (p.id !== currentTurnId) return p;
          // Sotto controllo: il timer scade → decrementa il contatore invece di applicare la posizione difensiva.
          const wasControlled = (p.controlLostTurns ?? 0) > 0;
          let up = wasControlled
            ? { ...p, controlLostTurns: Math.max(0, (p.controlLostTurns ?? 0) - 1), actionSurgeActive: false, bardicInspirationActive: false, extraTurnActive: false, ...tickEagleEnd(p), ...consumeInvisibility(p), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), attackDisadvantageTurns: Math.max(0, (p.attackDisadvantageTurns ?? 0) - 1), weaponLockTurns: Math.max(0, (p.weaponLockTurns ?? 0) - 1), multiActionsUsed: 0, frenzyAttackPending: false, mightyStrikePending: false, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false }
            : { ...p, defensiveBonus: 0, actionSurgeActive: false, bardicInspirationActive: false, extraTurnActive: false, ...tickEagleEnd(p), ...consumeInvisibility(p), hunterMarkTurns: Math.max(0, (p.hunterMarkTurns ?? 0) - 1), attackDisadvantageTurns: Math.max(0, (p.attackDisadvantageTurns ?? 0) - 1), weaponLockTurns: Math.max(0, (p.weaponLockTurns ?? 0) - 1), multiActionsUsed: 0, frenzyAttackPending: false, mightyStrikePending: false, turnWeaponsUsed: [], turnSkillUsed: false, bonusActionUsed: false, itemUsedThisTurn: false };
          if (wasControlled && !hasPendingCtrl) newLogs2.push(`🌀 ${p.name} è sotto controllo: turno saltato (${up.controlLostTurns} rimanenti).`);
          const autoSaveFaith = readSaveFaithBonus(p); // Scudo della Fede (letto da p, pre-tick)
          const autoFaithSign = autoSaveFaith > 0 ? `+${autoSaveFaith}✝` : "";
          if (hasPendingDex) {
            const d20 = Math.floor(Math.random() * 20) + 1;
            const mod = data.characterSnapshots?.[p.id]?.stats?.dex ?? 0;
            const total = d20 + mod + autoSaveFaith;
            const pass = total >= 15;
            newLogs2.push(`🎲 ${p.name} TS DES automatico: ${d20}+${mod}${autoFaithSign}=${total} vs CD 15 → ${pass ? "✅ PASSA" : "❌ FALLISCE — Intrappolato!"}`);
            delete up.pendingDexSave;
            if (!pass) up.entangled = true;
          }
          if (hasPendingCon) {
            const d20 = Math.floor(Math.random() * 20) + 1;
            const mod = data.characterSnapshots?.[p.id]?.stats?.con ?? 0;
            const total = d20 + mod + autoSaveFaith;
            const pass = total >= 15;
            // Prima i 2d6 si toglievano in SILENZIO (la riga diceva solo "Avvelenato!").
            const { total: conDmg, rolls: conRolls } = pass ? { total: 0, rolls: "" } : rollDmg("2d6");
            if (!pass) up.hp = Math.max(0, (up.hp ?? 0) - conDmg);
            newLogs2.push(`🎲 ${p.name} TS COS automatico: ${d20}+${mod}${autoFaithSign}=${total} vs CD 15 → ${pass ? "✅ PASSA" : `❌ FALLISCE — Avvelenato! Subisce ${conDmg} danni da veleno [🎲${conRolls}].`}`);
            delete up.pendingConSave;
          }
          if (hasPoisonDoT && (p.poisonResolvedTurnToken || "") !== (match.turnExpiry || "")) {
            const dice = p.poisonDoTDice || "1d6";
            const poisonDmgAuto = Math.round(rollDmg(dice).total * dotResistMult(arenaMeta.characterSnapshots?.[p.id], p));
            up.hp = Math.max(0, (up.hp ?? 0) - poisonDmgAuto);
            const remaining = Math.max(0, (p.poisonDoTTurns ?? 1) - 1);
            up.poisonDoT = remaining > 0;
            up.poisonDoTTurns = remaining;
            up.poisonResolvedTurnToken = match.turnExpiry || "";
            if (remaining === 0) up.poisonDoTDice = null;
            newLogs2.push(`☠ ${p.name} subisce il veleno automaticamente: ${poisonDmgAuto} danni [${dice}]!`);
          }
          if (p.bleedDoT && (p.bleedResolvedTurnToken || "") !== (match.turnExpiry || "")) {
            const dice = p.bleedDoTDice || "1d6";
            const { total: bleedDmgAuto } = rollDmg(dice);
            up.hp = Math.max(0, (up.hp ?? 0) - bleedDmgAuto);
            const remaining = Math.max(0, (p.bleedDoTTurns ?? 1) - 1);
            up.bleedDoT = remaining > 0;
            up.bleedDoTTurns = remaining;
            up.bleedResolvedTurnToken = match.turnExpiry || "";
            if (remaining === 0) up.bleedDoTDice = null;
            newLogs2.push(`🩸 ${p.name} subisce il sanguinamento automaticamente: ${bleedDmgAuto} danni [${dice}]!`);
          }
          if (hasPendingCtrl) {
            const d20 = Math.floor(Math.random() * 20) + 1;
            const ctrlAbility = p.pendingControlSaveAbility || "wis";
            const ctrlMod = data.characterSnapshots?.[p.id]?.stats?.[ctrlAbility] ?? 0;
            const ctrlDC  = p.pendingControlDC || 13;
            const total   = d20 + ctrlMod + autoSaveFaith;
            const pass    = total >= ctrlDC;
            const sign    = ctrlMod >= 0 ? "+" : "";
            const lbl     = SAVE_LABEL[ctrlAbility] || ctrlAbility.toUpperCase();
            const isCorona = p.pendingControlSave === "corona_pazzia";
            if (pass) {
              // Free on auto-roll: clear all control state.
              delete up.pendingControlSave;
              delete up.pendingControlDC;
              delete up.pendingControlSaveAbility;
              up.controlLostTurns = 0;
              newLogs2.push(`🌀 ${p.name} TS ${lbl} Controllo automatico: ${d20}${sign}${ctrlMod}=${total} vs CD ${ctrlDC} → ✅ PASSA — Si libera!`);
            } else if (isCorona) {
              // Corona: one-shot self-damage, no recurring TS.
              const snapForAuto = data?.characterSnapshots?.[p.id];
              const equippedNameAuto = p.equippedWeaponNames?.[0];
              const weaponAuto = (snapForAuto?.selectedActions || []).find(a => a.name === equippedNameAuto && a.type === "weapon");
              const { total: selfDmgAuto } = rollDmg(weaponAuto?.damage || "1d6");
              up.hp = Math.max(0, (up.hp ?? 0) - selfDmgAuto);
              delete up.pendingControlSave;
              delete up.pendingControlDC;
              delete up.pendingControlSaveAbility;
              newLogs2.push(`🌀 ${p.name} TS ${lbl} Corona della Pazzia automatico: ${d20}${sign}${ctrlMod}=${total} vs CD ${ctrlDC} → ❌ FALLISCE — Attacca sé stesso: ${selfDmgAuto} danni!`);
            } else {
              // Regular control fail on auto-roll: burn one budget turn, keep TS armed if budget remains.
              const remaining = Math.max(0, (p.controlLostTurns ?? 2) - 1);
              up.controlLostTurns = remaining;
              if (remaining > 0) {
                newLogs2.push(`🌀 ${p.name} TS ${lbl} Controllo automatico: ${d20}${sign}${ctrlMod}=${total} vs CD ${ctrlDC} → ❌ FALLISCE — Turno saltato (${remaining} rimanenti, nuovo TS al prossimo turno).`);
              } else {
                delete up.pendingControlSave;
                delete up.pendingControlDC;
                delete up.pendingControlSaveAbility;
                newLogs2.push(`🌀 ${p.name} TS ${lbl} Controllo automatico: ${d20}${sign}${ctrlMod}=${total} vs CD ${ctrlDC} → ❌ FALLISCE — Turno saltato, effetto esaurito.`);
              }
            }
          }
          return up;
        });
        // ── Tempo scaduto: si passa SOLO il turno (2026-10-19) ─────────────
        // Prima partiva un attacco automatico con l'arma: ora chi non agisce
        // non colpisce nessuno, il turno va semplicemente all'avversario.
        newLogs2.push(`⏰ ${currentPlayerObj.name} non ha agito in tempo — turno passato.`);

        const newExpiry = new Date(arenaNow() + ARENA_TURN_DURATION).toISOString();
        // Traccia dei PF in cronaca + chiusura se qualcuno è andato a 0 (prima il
        // match restava "attivo" con un morto e il turno poteva finire a lui).
        const updatedMatch = finalizeArenaMatch(auditArenaMatch(match, {
          ...match, players: updatedPlayers, turn: nextTurnId,
          turnExpiry: newExpiry, lastAutoPassAt: new Date().toISOString(),
          logs: newLogs2,
        }));
        if (updatedMatch.status === "finished") autoClosed = [updatedMatch];
        const updatedMatches = data.matches.map(m => m.matchId === expiredActiveMatch.matchId ? updatedMatch : m);
        transaction.update(metaRef, { matches: updatedMatches });
      });
      if (autoClosed.length) {
        await awardRoundCoins(autoClosed);
        await resolveBetsForFinishedMatches(autoClosed);
        await recordMatchHistory(autoClosed);
      }
    } catch (e) {
      console.error("Errore auto-pass arena:", e);
    }
  }, [arenaMeta]);

  useEffect(() => {
    if (!arenaMeta) return;
    // Attiva auto-pass se torneo in corso O se ci sono sfide libere in corso.
    const hasFunInProgress = (arenaMeta.matches || []).some(m =>
      m.kind === "fun" && (m.status === "initiative" || m.status === "active")
    );
    if (arenaMeta.phase !== "combat" && !hasFunInProgress) return;
    const interval = setInterval(() => {
      if (arenaMeta?.timerPaused) return;
      const now = arenaNow() - ARENA_EXPIRY_GRACE_MS;
      const hasExpiredInit = arenaMeta.matches?.some(m => {
        if (m.status !== "initiative" || !m.turnExpiry) return false;
        return now >= new Date(m.turnExpiry).getTime();
      });
      const hasExpiredActive = arenaMeta.matches?.some(m => {
        if (m.status !== "active" || !m.turn || !m.turnExpiry) return false;
        return now >= new Date(m.turnExpiry).getTime();
      });
      if ((hasExpiredInit || hasExpiredActive) && now - lastAutoPassFireRef.current > 10000) {
        lastAutoPassFireRef.current = now;
        handleArenaAutoPass();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [arenaMeta, handleArenaAutoPass]);

  // ── Pause/Resume timers (Master only) ──────────────────────────────────────
  const pauseArenaTimers = async () => {
    await updateDoc(doc(db, "arena_meta", "global"), {
      timerPaused: true,
      pausedAt: new Date().toISOString(),
      nightAutoPaused: false,
    });
  };

  const resumeArenaTimers = async () => {
    if (!arenaMeta?.pausedAt) return;
    const elapsed = Date.now() - new Date(arenaMeta.pausedAt).getTime();
    const updatedMatches = (arenaMeta.matches || []).map(m => {
      if (m.status === "finished") return m;
      // Le sfide libere (training) non sono mai congelate → non shiftiamo i loro timer.
      if (m.kind === "fun") return m;
      return {
        ...m,
        turnExpiry: m.turnExpiry
          ? new Date(new Date(m.turnExpiry).getTime() + elapsed).toISOString()
          : m.turnExpiry ?? null,
        fightStartAt: m.fightStartAt
          ? new Date(new Date(m.fightStartAt).getTime() + elapsed).toISOString()
          : m.fightStartAt ?? null,
      };
    });
    await updateDoc(doc(db, "arena_meta", "global"), {
      timerPaused: false,
      pausedAt: null,
      nightAutoPaused: false,
      matches: updatedMatches,
    });
  };

  // Pausa/ripresa timer torneo: gestione manuale via pulsante Master (no auto-night).

  // ── RENDER ─────────────────────────────────────────────────────────────────
  if (!arenaMeta) return <div className="arena-loading">Ingresso nell'Arena...</div>;

  const snapshots        = arenaMeta.characterSnapshots || {};
  const timerRef         = arenaMeta.timerPaused && arenaMeta.pausedAt
    ? new Date(arenaMeta.pausedAt).getTime()
    : Date.now();
  const isRegistered     = arenaMeta.participants?.includes(currentUser?.uid);
  // PG del Master iscritti (in gara o in attesa): uno per id "<uid>", "<uid>__ALT2"…
  const myEntryIds = isMaster && authUser
    ? masterEntryIds(authUser.uid).filter((id) => (arenaMeta.participants || []).includes(id) || (arenaMeta.waitingList || []).includes(id))
    : [];
  const isPending        = arenaMeta.waitingList?.includes(currentUser?.uid);
  const tournamentMatches = (arenaMeta.matches || []).filter(m => m.kind !== "fun");
  const funMatches        = (arenaMeta.matches || []).filter(m => m.kind === "fun");
  const allMatchesDone   = tournamentMatches.length > 0 && tournamentMatches.every(m => m.status === "finished");
  const finalMatch       = tournamentMatches.find(m => m.kind === "final");
  const finalFinished    = !!(finalMatch && finalMatch.status === "finished" && finalMatch.winner);
  const totalGroupRounds = groupRoundsTotal();
  const cr               = arenaMeta.currentRound || 1;
  const moreGroupRoundsToPlay = cr < totalGroupRounds;
  const canAdvanceRound  = isMaster && arenaMeta.phase === "combat" && allMatchesDone && !finalMatch && (arenaMeta.groupA?.length || 0) >= 1 && (arenaMeta.groupB?.length || 0) >= 1;
  const advanceLabel     = moreGroupRoundsToPlay ? `⚔ Round ${cr + 1}` : "🏆 Genera Finale";
  const canDeclareChampion = isMaster && arenaMeta.phase === "combat" && finalFinished && !arenaMeta.tournamentWinner;

  const declareTournamentChampion = async () => {
    if (!canDeclareChampion) return;
    const championId = finalMatch.winner;
    const champSnap = snapshots[championId] || {};
    try {
      await sendChampionNotification(championId, champSnap.name || "Campione", arenaMeta?.prizes || "");
      await updateDoc(doc(db, "arena_meta", "global"), {
        tournamentWinner: championId, phase: "finished",
      });
    } catch (e) {
      console.error("declareTournamentChampion error:", e);
    }
  };

  const masterForceWinner = async (matchId, winnerId) => {
    if (!isMaster) return;
    const match = arenaMeta.matches?.find(m => m.matchId === matchId);
    if (!match || match.status === "finished") return;
    const winnerP = match.players.find(p => p.id === winnerId);
    if (!winnerP) return;
    const winnerName = winnerP.name || snapshots[winnerId]?.name || "?";
    if (!window.confirm(`Dichiarare ${winnerName} vincitore di questo match?`)) return;

    const updatedMatch = {
      ...match,
      status: "finished",
      winner: winnerId,
      logs: [...(match.logs || []), `♛ Master: ${winnerName.toUpperCase()} dichiarato vincitore!`],
    };
    const updatedMatches = (arenaMeta.matches || []).map(m => m.matchId === matchId ? updatedMatch : m);

    try {
      await awardRoundCoins(updatedMatches);
      await resolveBetsForFinishedMatches(updatedMatches);
      await recordMatchHistory(updatedMatches);

      const finalM = finalJustConcluded(updatedMatches);
      if (finalM) {
        const champSnap = snapshots[finalM.winner] || {};
        await sendChampionNotification(finalM.winner, champSnap.name || "Campione", arenaMeta?.prizes || "", updatedMatches);
        await updateDoc(doc(db, "arena_meta", "global"), {
          matches: updatedMatches, tournamentWinner: finalM.winner, phase: "finished",
        });
        // 🐣 pet system: tournament champion bonus
        awardPetPoints(finalM.winner, "arena_tournament", { resourceKey: finalM.matchId });
        return;
      }
      await commitArenaMatches(updatedMatches);
    } catch (e) {
      console.error("masterForceWinner error:", e);
    }
  };

  const liveTournament = (() => {
    if (!arenaMeta || arenaMeta.phase === "finished") return null;
    const ids = arenaMeta.participants || [];
    const matches = (arenaMeta.matches || []).filter(m => m.kind !== "fun");
    const wins = {}, losses = {};
    matches.forEach(m => {
      if (m.status !== "finished" || !m.winner) return;
      (m.players || []).forEach(p => {
        if (p.id === m.winner) wins[p.id] = (wins[p.id] || 0) + 1;
        else losses[p.id] = (losses[p.id] || 0) + 1;
      });
    });
    const participants = ids
      .map(uid => ({
        uid,
        name:  snapshots[uid]?.name  || "",
        class: (snapshots[uid]?.class || "").toLowerCase().trim(),
        matchWins:   wins[uid]   || 0,
        matchLosses: losses[uid] || 0,
      }))
      .filter(p => p.class);
    if (participants.length === 0) return null;
    return { winnerId: null, participants, phase: arenaMeta.phase };
  })();

  // Pieghe del Registro del Lanista: aperte su desktop, chiuse sul telefono (solo markup).
  const lanAperto = !(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 760px)").matches);

  return (
    <div className={`arena-page${myActiveMatchId ? " arena-page--focus" : ""}${arenaView === "join" ? " arena-page--lizza" : arenaView === "master" ? " arena-page--lanista" : ""}`}>

      {/* ── VFX pixelati (stile World Boss isometrico): overlay sopra le card ── */}
      <VfxLayer messages={vfxMessages} />

      {/* ── Floating Fight Button — sempre visibile durante un match attivo.
            Più epico quando è il tuo turno (pulsa rosso). ── */}
      {myActiveMatchId && (() => {
        const m = arenaMeta?.matches?.find(mm => mm.matchId === myActiveMatchId);
        if (!m) return null;
        const opp = m.players?.find(p => p.id !== currentUser.uid);
        const oppFirst = (opp?.name || "").split(" ")[0] || "avversario";
        const subLabel = isMyTurnInActive
          ? "Tocca per agire"
          : isAwaitingReady(m)
            ? (m.ready?.[currentUser.uid] ? `Aspetti ${oppFirst}` : "Premi «Iniziamo»")
          : m.status === "initiative"
            ? "Tira iniziativa"
            : `Turno di ${oppFirst}`;
        return (
          <button
            type="button"
            className={`arena-fight-icon${isMyTurnInActive || masterFights.some(f => f.state === "turn") ? " arena-fight-icon--your-turn" : ""}`}
            onClick={() => setCombatModalOpen(true)}
            aria-label={isMyTurnInActive ? "È il tuo turno — apri il combat" : "Sfida in corso — apri il combat"}
            title={isMyTurnInActive ? `È il tuo turno · ${subLabel}` : `Sfida in corso · ${subLabel}`}
          >
            ⚔
          </button>
        );
      })()}

      {/* Sottoclasse comprata e non ancora montata: "equipaggiarla subito?" */}
      {currentUser && <ArenaSubclassOffer arenaMeta={arenaMeta} uid={currentUser.uid} arenaWeekly={myArenaWeekly} />}

      {/* Popup "aggiorna l'assetto": nuovi acquisti della Bottega non ancora
          equipaggiati, o pausa Bottega appena aperta. Solo a chi può cambiarlo. */}
      {currentUser && arenaView !== "join" && !reloadoutBlockReason(arenaMeta, currentUser.uid)
        && !subclassToMount(arenaMeta, currentUser.uid, myArenaWeekly, currentWeekKey()) && (() => {
        const snap = arenaMeta.characterSnapshots[currentUser.uid];
        // In pausa Bottega solo a chi gioca il prossimo round (non agli esclusi dalla finale).
        if (arenaMeta.phase === "shopping" && Array.isArray(arenaMeta.pendingNextMatches)
          && !arenaMeta.pendingNextMatches.some(m => (m.players || []).some(p => p.id === currentUser.uid))) return null;
        const owned = myArenaWeekly?.weekKey === currentWeekKey() ? (myArenaWeekly.purchases || []) : [];
        const actNames = new Set((snap.selectedActions || []).map(a => a.name));
        const seen = new Set(Array.isArray(snap.loadoutSeenIds) ? snap.loadoutSeenIds
          : Array.isArray(snap.loadoutMarketSel) ? snap.loadoutMarketSel
          : owned.filter(pu => actNames.has(pu.name)).map(pu => pu.itemId));
        const fresh = owned.filter(pu => !seen.has(pu.itemId));
        const key = fresh.length
          ? `buy:${fresh.map(pu => pu.itemId).sort().join(",")}`
          : arenaMeta.phase === "shopping" ? `shop:${arenaMeta.shopEndsAt || ""}` : null;
        if (!key || reloadNudgeOff[key]) return null;
        try { if (sessionStorage.getItem(`arena_reload_nudge_${key}`)) return null; } catch { /* storage bloccato */ }
        const close = () => {
          try { sessionStorage.setItem(`arena_reload_nudge_${key}`, "1"); } catch { /* ignora */ }
          setReloadNudgeOff(prev => ({ ...prev, [key]: true }));
        };
        return (
          <div className="aso-velo" role="dialog" aria-modal="true" aria-labelledby="reload-nudge-titolo">
            <div className="aso-box">
              <span className="aso-kicker">{arenaMeta.phase === "shopping" ? "Pausa Bottega" : "Tra un round e l'altro"}</span>
              <h3 id="reload-nudge-titolo" className="aso-titolo">⚙ Puoi aggiornare il tuo assetto</h3>
              {fresh.length > 0 ? (
                <>
                  <p className="aso-desc">Hai comprato in Bottega {fresh.length === 1 ? "un oggetto che non hai" : `${fresh.length} oggetti che non hai`} ancora equipaggiato:</p>
                  <ul className="aso-lista">
                    {fresh.map(pu => (
                      <li key={pu.itemId}><span aria-hidden="true">{pu.icon || "🎁"}</span> <b>{pu.name}</b> — {describeMarketPurchase(pu)}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="aso-desc">Il round è finito: prima del prossimo puoi cambiare armi, incantesimi, armatura, compagno, oggetti e montare gli acquisti della Bottega.</p>
              )}
              <p className="aso-domanda">L'assetto che salvi resta per tutti i prossimi round del torneo.</p>
              <div className="aso-azioni">
                <button type="button" className="aso-si" onClick={() => { close(); openReloadout(); }}>⚙ Aggiorna l'assetto</button>
                {arenaMeta.phase === "shopping" && <a className="aso-no" href="/arena-bottega" onClick={close} style={{ textAlign: "center", textDecoration: "none" }}>🛍 Prima vado in Bottega</a>}
                <button type="button" className="aso-dopo" onClick={close}>Più tardi</button>
              </div>
              <p className="aso-nota">Classe, caratteristiche e PF restano quelli dell'iscrizione. Il pulsante "⚙ Assetto" resta in basso finché non combatti.</p>
            </div>
          </div>
        );
      })()}

      {/* ── Richiamo FLOTTANTE Pausa Bottega — sempre visibile per i partecipanti,
            in qualunque vista dell'Arena, finché la finestra di shopping è aperta.
            Apre direttamente il ri-equipaggiamento (classe/stat/HP bloccati). ── */}
      {!myActiveMatchId && currentUser && arenaView !== "join"
        && !reloadoutBlockReason(arenaMeta, currentUser.uid) && (
        <button
          type="button"
          className="arena-shop-fab"
          onClick={openReloadout}
          aria-label="Pausa Bottega — aggiorna il tuo assetto per il prossimo round"
          title="Pausa Bottega — aggiorna il tuo assetto"
        >
          <span className="arena-shop-fab-ico" aria-hidden="true">⚙</span>
          <span className="arena-shop-fab-body">
            <span className="arena-shop-fab-title">{arenaMeta.phase === "shopping" ? "Pausa Bottega" : "⚙ Assetto"}</span>
            {arenaMeta.phase === "shopping"
              ? <span className="arena-shop-fab-sub">Aggiorna assetto · <TimerDisplay expiryDate={arenaMeta.shopEndsAt} /></span>
              : <span className="arena-shop-fab-sub">Cambia equip per il prossimo match</span>}
          </span>
        </button>
      )}

      {/* ════════════════════════════════════════════════════════════
          ARENA REDESIGN 2 — "Locandina del Colosseo".
          Struttura a manifesto: masthead asimmetrico con tabellone
          delle quote, poi il PROGRAMMA DELLA SERATA a righe numerate
          (niente più griglia di card). Le viste interne restano.
          ════════════════════════════════════════════════════════════ */}

      {/* Masthead a manifesto: brand a sinistra, tabellone a destra */}
      <header className="arena-bill-mast" id="arena-hero-top">
        <div className="abm-brand">
          <span className="abm-eyebrow">Cronache di Exanthia · Grande Colosseo</span>
          <h1 className="abm-title">Arena <br />dei Campioni</h1>
          <p className="abm-tag">Nessun livello, nessun archetipo: solo la tua classe, l'astuzia e il bottino della settimana.</p>
        </div>
        <div className="abm-board" role="status" aria-label="Stato dell'Arena">
          <div className="abm-board-row abm-board-phase">
            {arenaMeta.phase === "registration" && <span className="arune-pill open">● Iscrizioni aperte</span>}
            {arenaMeta.phase === "combat" && <span className="arune-pill combat">● {finalMatch ? "Finale" : `Round ${arenaMeta.currentRound || 1}`}</span>}
            {arenaMeta.phase === "finished" && <span className="arune-pill finished">● Concluso</span>}
            {arenaMeta.timerPaused && <span className="arune-pill paused" title="Timer in pausa">⏸ In pausa</span>}
          </div>
          <div className="abm-board-row"><span className="abm-board-lab">Sfidanti</span><span className="abm-board-dots" aria-hidden="true" /><span className="abm-board-val">{arenaMeta.participants?.length || 0}</span></div>
          <div className="abm-board-row"><span className="abm-board-lab">Campioni</span><span className="abm-board-dots" aria-hidden="true" /><span className="abm-board-val">{champions.length}</span></div>
          {arenaMeta.championsOnly && arenaMeta.phase !== "finished" && (
            <div className="abm-board-row abm-board-warn"><span className="abm-board-lab">♛ Solo Campioni</span></div>
          )}
          {arenaMeta.prizes && arenaMeta.prizes.trim() && (
            <div className="abm-board-row abm-board-prize"><span className="abm-board-lab">🏆 In palio</span><span className="abm-board-prizetxt">{arenaMeta.prizes}</span></div>
          )}
        </div>
      </header>

      {/* Pulsante FISSO sempre visibile fuori dall'hub: torna all'Hub + risali in cima */}
      {arenaView !== "hub" && (
        <button
          type="button"
          className="arena-hub-fab"
          onClick={() => { setArenaView("hub"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          aria-label="Torna all'Hub"
          title="Torna all'Hub"
        >
          <span className="arena-hub-fab-arrow" aria-hidden="true">‹</span>
          <span className="arena-hub-fab-label">Hub</span>
        </button>
      )}

      {/* ════════ PROGRAMMA DELLA SERATA — landing a manifesto ════════ */}
      {arenaView === "hub" && (() => {
        const hasBracket = (arenaMeta.phase === "combat" || arenaMeta.phase === "finished") && tournamentMatches.length > 0;
        const hasMyActive = currentUser && (arenaMeta.matches || []).some(m =>
          ((m.kind === "fun") || arenaMeta.phase === "combat") &&
          m.players?.some(p => p.id === currentUser?.uid) && m.status !== "open");
        const showBet = !!currentUser;
        const betSub = arenaMeta.phase === "combat"
          ? "Punta le tue Monete Arena sui fight non ancora iniziati"
          : "Si apre col torneo: punta Monete Arena sui fight";
        // Voci del programma: numerale romano + titolo + nota, come una locandina.
        const program = [
          {
            key: "join", title: "Entra in Lizza",
            sub: arenaMeta.phase === "registration" ? (isRegistered ? "Sei iscritto ✓" : isPending ? "In attesa di approvazione…" : "Crea il tuo campione — classi base Lv.3") : "Iscrizioni chiuse · prova l'Arena Libera",
            onClick: () => {
              if (arenaMeta.phase === "registration") { if (!isMaster) openLoadoutPicker(); else setArenaView("master"); }
              else setArenaView("libera");
            },
          },
          {
            key: "bracket", title: "Tabellone",
            sub: hasBracket ? "Segui gli scontri live" : "Nessun torneo in corso",
            disabled: !hasBracket,
            onClick: () => { if (hasBracket) { setArenaView("bracket"); setBracketModalOpen(true); } },
          },
          {
            key: "bottega", title: "Bottega Settimanale",
            sub: "Armi, incantesimi, oggetti e pet · fino a domenica",
            href: "/arena-bottega",
          },
          { key: "libera", title: "Arena Libera", sub: "Sfide 1v1 d'allenamento, senza bonus della Bottega", onClick: () => setArenaView("libera") },
          { key: "gesta", title: "Le Mie Gesta", sub: "Classi giocate, vittorie e statistiche nel tempo", onClick: () => setArenaView("gesta") },
          { key: "cronache", title: "Cronache dei Match", sub: "Rileggi i tuoi ultimi scontri riga per riga", onClick: () => setArenaView("cronache") },
          { key: "albo", title: "Albo dei Campioni", sub: `${champions.length} ${champions.length === 1 ? "eroe" : "eroi"} nella leggenda`, onClick: () => setArenaView("albo") },
          { key: "regole", title: "Regole & Classi", sub: "Come funziona l'Arena", onClick: () => setArenaView("regole") },
          { key: "dadi", title: "I Tuoi Dadi", sub: `${DICE_SKINS.find((s) => s.id === diceSkinId)?.label || "Oro Antico"} · cambia colore`, onClick: () => setDicePickerOpen(true) },
          ...(showBet ? [{ key: "bet", title: "Scommesse", sub: betSub, onClick: () => setBettingDrawerOpen(true) }] : []),
          ...(isMaster ? [{ key: "master", title: "Pannello Master", sub: "Gestisci l'Arena", onClick: () => setArenaView("master") }] : []),
        ];
        const ICO = { join: "⚔", cronache: "🗞", bracket: "🏟", bottega: "🛍", libera: "🥊", gesta: "📜", albo: "👑", regole: "📖", dadi: "🎲", bet: "💰", master: "🛠" };
        return (
          <div className="arena-bill">
            {/* ══ PALCO VS (prototipo J "Il Nesso"): lo scontro in corso —
                  il tuo, oppure il primo attivo del torneo — con VS pulsante
                  e fulmine; se l'arena è vuota, due sagome in attesa. ══ */}
            {(() => {
              const snaps = arenaMeta?.characterSnapshots || {};
              const all = arenaMeta.matches || [];
              const live = all.find(m => m.matchId === myActiveMatchId)
                || all.find(m => ((m.kind === "fun") || arenaMeta.phase === "combat") && m.status !== "open" && m.status !== "finished");
              const P = (i) => live?.players?.[i];
              const vite = (p) => {
                const n = 5;
                const on = p?.maxHp ? Math.round(n * Math.max(0, Math.min(1, (p.hp ?? p.maxHp) / p.maxHp))) : n;
                return Array.from({ length: n }, (_, k) => <i key={k} className={k < on ? "" : "giu"} />);
              };
              const glad = (p, side) => (
                <div className={`gladiatore gladiatore--${side}${p ? "" : " gladiatore--vuoto"}`}>
                  {p && snaps[p.id]?.image
                    ? <img src={snaps[p.id].image} alt="" />
                    : <div className="gladiatore-sil" aria-hidden="true">{p ? "⚔" : "?"}</div>}
                  <div className="vite" aria-hidden="true">{vite(p)}</div>
                  <div className="nome">{p ? `${p.name}${p.class ? " · " + p.class : ""}` : "In attesa"}</div>
                </div>
              );
              const palcoLive = combatModalOpen && !!palcoSlot;
              return (
                <section className={`vs-palco-wrap${palcoLive ? " vs-palco-wrap--live" : ""}${live ? "" : " vs-palco-wrap--vuoto"}`} aria-label="Palco dello scontro">
                  <div className="vs-palco">
                    {glad(P(0), "sx")}
                    <span className="vs" aria-hidden="true">VS</span>
                    <span className="fulmine" aria-hidden="true" />
                    {glad(P(1), "dx")}
                  </div>
                  {/* Lo SCONTRO sboccia qui (portal della modale combat, vedi ArenaModal.inlineTarget) */}
                  <div className="palco-scontro" ref={setPalcoSlot} />
                  <div className="vs-azione">
                    {hasMyActive ? (
                      <button
                        type="button"
                        className={`nx-btn nx-btn--rosso${isMyTurnInActive && !palcoLive ? " nx-btn--turno" : ""}${palcoLive ? " nx-btn--chiudi" : ""}`}
                        onClick={() => {
                          if (palcoLive) { setCombatModalOpen(false); return; }
                          setCombatModalOpen(true);
                          requestAnimationFrame(() => palcoSlot?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
                        }}
                      >
                        {palcoLive ? "✕ Chiudi lo scontro" : isMyTurnInActive ? "⚔ È il tuo turno — entra nello scontro" : "⚔ Entra nello scontro"}
                      </button>
                    ) : live && hasBracket ? (
                      <button type="button" className="nx-btn" onClick={() => { setArenaView("bracket"); setBracketModalOpen(true); }}>🏟 Guarda il tabellone</button>
                    ) : (
                      <p className="vs-attesa">
                        {arenaMeta.phase === "registration"
                          ? "Le iscrizioni sono aperte: il Colosseo attende il tuo campione."
                          : "Nessuno scontro in corso: l'Arena Libera è sempre aperta."}
                      </p>
                    )}
                  </div>
                </section>
              );
            })()}

            {/* PAUSA BOTTEGA — finestra di acquisti tra un round e l'altro */}
            {arenaMeta.phase === "shopping" && (
              <div className="arena-shop-banner arena-shop-banner--pulse">
                <div className="arena-shop-banner-head">
                  <span className="arena-shop-banner-tag">🛒 Pausa Bottega — riequipaggiati!</span>
                  <TimerDisplay expiryDate={arenaMeta.shopEndsAt} />
                </div>
                <p className="arena-shop-banner-txt">
                  Round completato. Prima del prossimo round puoi <strong>comprare al Mercato</strong> e poi
                  {" "}<strong>cambiare armi, incantesimi, armatura, pet e oggetti</strong>. Il round parte da solo allo scadere del tempo.
                </p>
                <div className="arena-shop-banner-actions">
                  {(arenaMeta.participants || []).includes(currentUser?.uid) && (
                    <button type="button" className="arena-shop-btn arena-shop-btn--primary" onClick={openReloadout}>⚙ Aggiorna il mio assetto</button>
                  )}
                  <a className="arena-shop-btn" href="/arena-bottega">🛍 Vai al Mercato</a>
                  {isMaster && (
                    <button type="button" className="arena-shop-btn arena-shop-btn--master" onClick={promotePendingRoundNow}>⏭ Avanza ora</button>
                  )}
                </div>
              </div>
            )}

            {/* Programma della serata (Covo, 2026-09-09): DUE pesi, non dieci
                piastrelle uguali. Le 4 voci che portano a GIOCARE (lizza,
                tabellone, bottega, libera) restano piastrelle con la nota; le
                altre (gesta, albo, regole, dadi, scommesse, master) sono una
                fila di targhette a una riga sotto la rubrica "Altro".
                NB: <div role="navigation">, NON <nav> — shell.css trasforma ogni
                <nav> nel drawer di sito. */}
            {(() => {
              const PRIMARIE = ["join", "bracket", "bottega", "libera"];
              const primari = program.filter((r) => PRIMARIE.includes(r.key));
              const minori = program.filter((r) => !PRIMARIE.includes(r.key));
              const voce = (row, compatta) => {
                const cls = `pozione${compatta ? " pozione--minore" : ""}${row.disabled ? " pozione--off" : ""}`;
                const inner = (<>
                  <span className="ico" aria-hidden="true">{ICO[row.key] || "✦"}</span>
                  <h4>{row.title}</h4>
                  {!compatta && <div className="sub">{row.sub}</div>}
                </>);
                if (row.href) return <a key={row.key} className={cls} href={row.href} title={compatta ? row.sub : undefined}>{inner}</a>;
                return (
                  <button key={row.key} type="button" className={cls} disabled={row.disabled} onClick={row.onClick} title={compatta ? row.sub : undefined}>
                    {inner}
                  </button>
                );
              };
              return (<>
                <div className="sezione-t"><h2>Programma della Serata</h2><i aria-hidden="true" /></div>
                <div role="navigation" className="arena-portali" aria-label="Programma dell'Arena">
                  {primari.map((row) => voce(row, false))}
                </div>
                {minori.length > 0 && (
                  <div role="navigation" className="arena-portali arena-portali--minori" aria-label="Altre voci dell'Arena">
                    <span className="arena-portali-lab">Altro</span>
                    {minori.map((row) => voce(row, true))}
                  </div>
                )}
              </>);
            })()}

            {/* La SCALA: classifica generale a punti dei tornei (già calcolata) */}
            {arenaLeaderboard.length > 0 && (<>
              <div className="sezione-t"><h2>Classifica dei Tornei</h2><i aria-hidden="true" /></div>
              <div className="scala">
                {arenaLeaderboard.slice(0, 5).map((e, i) => (
                  <div key={e.uid} className="grado">
                    <span className="orb">{i + 1}</span>
                    <b>{e.name || "Eroe"}</b>
                    <span>{e.points} {e.points === 1 ? "punto" : "punti"}</span>
                  </div>
                ))}
              </div>
            </>)}
          </div>
        );
      })()}

      {/* ── VISTA REGOLE & CLASSI ── */}
      {arenaView === "regole" && (
      <div id="arena-info-anchor" className="arena-info-section arena-info-section--view">
        <div className="nx-testata">
          <span className="nx-kicker">Codice del Colosseo</span>
          <h2 className="nx-titolo">Regole &amp; Classi</h2>
          <p className="nx-sotto">Come si entra, come si combatte, come si vince. Tutto il regolamento dell'Arena in un solo codice.</p>
        </div>
        {(
          <div className="arena-info-body">

            <h3 className="arena-info-title">⚔ Come funziona l'Arena</h3>
            <ul className="arena-info-list">
              <li>Il Master apre le iscrizioni e approva i partecipanti uno per uno.</li>
              <li>Ogni combattente <strong>crea un personaggio da zero</strong> solo per l'Arena: sceglie classe, distribuisce i punti caratteristica, sceglie armi, armatura, oggetti e tira i propri HP.</li>
              <li>I match si giocano in modalità asincrona a turni. Il vincitore di ogni match avanza al round successivo fino al campione finale.</li>
              <li>Oltre al torneo è sempre attiva la <strong>Sfida Libera</strong>: 1v1 amichevoli senza ricompense, utili per allenarti.</li>
            </ul>

            <h3 className="arena-info-title">🛍 Bottega Settimanale</h3>
            <div className="arena-info-example">
              <p>Tutti combattono con le <strong>classi base al Livello 3</strong>: non esistono livelli da comprare né archetipi. L'unico vantaggio si conquista alla <strong>Bottega Settimanale</strong>, dove il Master mette in vendita <strong>oggetti, incantesimi, armi, armature e pet</strong>.</p>
              <p>Ciò che compri vale <strong>dal momento dell'acquisto fino a domenica alle 23:00</strong>, anche da un torneo all'altro; alle 23:00 di domenica si azzerano acquisti, iscrizioni e torneo, le Monete tornano a 60 e la vetrina si rinnova. Dal <strong>secondo torneo della settimana</strong> in poi, a ogni inizio torneo tutti ricevono <strong>+20 Monete</strong> (si sommano a quelle che hai). I potenziamenti funzionano <strong>solo nei tornei</strong>: nelle Sfide Libere e contro l'IA si combatte alla pari, col solo kit base.</p>
              <p>In fight: gli <strong>oggetti</strong> sono azioni gratuite (1/turno), le <strong>spell</strong> comprate si aggiungono alle tue azioni con le loro cariche, <strong>armi e armature</strong> si sommano a equipaggiamento e CA, i <strong>pet</strong> agiscono come azione bonus con usi limitati.</p>
            </div>

            <h3 className="arena-info-title">⏱ Timer e turni</h3>
            <div className="arena-info-example">
              <p><strong>Iniziamo:</strong> prima di ogni fight entrambi i giocatori devono premere <strong>✋ Iniziamo</strong>. Finché non l'hanno fatto tutti e due il match non parte e non corre nessun timer.</p>
              <p><strong>Iniziativa:</strong> ogni giocatore ha <strong>5 minuti</strong> per tirare la propria iniziativa (d20 + DES; il Ladro tira con vantaggio, chi combatte <strong>senza armatura</strong> ottiene <strong>+1</strong>). Allo scadere il sistema tira automaticamente al posto tuo.</p>
              <p><strong>Turno di azione:</strong> ogni giocatore ha <strong>5 minuti</strong> per agire nel proprio turno. Se il tempo scade, il turno <strong>passa all'avversario</strong> senza nessun attacco automatico.</p>
              <p><strong>Pausa:</strong> solo il Master può sospendere i timer con il pulsante "⏸ Pausa Timer". Alla ripresa i turn-expiry vengono shiftati in avanti del tempo trascorso, così nessuno viene penalizzato.</p>
            </div>

            <h3 className="arena-info-title">🧙 Creazione del Personaggio</h3>
            <div className="arena-info-example">
              <p><strong>1. Classe:</strong> scegli tra le 12 classi (vedi elenco sotto), tutte <strong>base Livello 3</strong>. Ogni classe ha le proprie armi consentite, abilità di classe automatiche, eventuali slot magia e armatura permessa.</p>
              <p><strong>2. Caratteristiche:</strong> distribuisci i punti stat (FOR, DES, COS, INT, SAG, CAR). I modificatori si applicano a tiri per colpire, danni, salvezze e CA delle armature leggere/medie.</p>
              <p><strong>3. Equipaggiamento:</strong> scegli armi, armatura, scudo (se la classe lo permette) e oggetti consumabili. Le restrizioni dipendono dalla classe.</p>
              <p><strong>4. HP:</strong> tutte le classi tirano <strong>7d10 + COS×7</strong>. Hai un numero limitato di reroll.</p>
              <p><strong>Nota:</strong> il personaggio Arena è separato dalla tua scheda principale e non influenza la campagna.</p>
            </div>

            <h3 className="arena-info-title">🎲 Come si combatte — attacchi e armi</h3>
            <div className="arena-info-example">
              <p><strong>Attacco con arma:</strong> d20 + bonus arma + FOR (mischia) o DES (distanza/finezza) vs CA del bersaglio. Se il totale è ≥ CA colpisci: danno dell'arma + modificatore. <em>Critico</em> su 20 naturale: dadi del danno ×2.</p>
              <p><strong>Attacchi per turno:</strong> <strong>Monaco e Ladro</strong> attaccano <strong>2 volte</strong> a turno; le altre classi attaccano <strong>1 volta</strong> (più eventuali bonus action). Scatto d'Azione (Guerriero) e Passo Spedito (Ranger) concedono un'azione extra.</p>
              <p><strong>Combattere a due armi (Ladro):</strong> il Ladro colpisce una volta <strong>per mano</strong>, quindi servono <strong>due armi diverse equipaggiate</strong> — la stessa arma non può essere usata due volte nello stesso turno.</p>
              <p><strong>Cambio arma:</strong> impugnare un'arma <strong>non</strong> equipaggiata <strong>costa il turno</strong>; dal turno dopo puoi attaccare con la nuova arma. Le armi a due mani disattivano lo scudo.</p>
              <p><strong>Arma incandescente</strong> (Riscaldare Arma / Disarmare): arroventa <strong>solo l'arma attualmente equipaggiata</strong> del bersaglio per alcuni turni. Se hai un'altra arma riposta puoi impugnarla e combattere comunque.</p>
              <p><strong>Azione bonus:</strong> molte abilità di classe (Furia, Marchio, Lay of Hands, Cura Ki, Ispirazione Bardica…) sono <strong>bonus action</strong>: puoi usarle nello stesso turno di un attacco. Anche usare un <strong>oggetto</strong> (pozioni, bomba) è un'<strong>azione gratuita</strong> e non consuma l'attacco.</p>
              <p><strong>Armature:</strong> le pesanti hanno CA fissa alta ma penalità ai tiri per colpire. Le leggere/medie sommano DES (con cap) alla CA base; alcune classi usano una difesa senz'armatura (Monaco 10+DES+SAG, Barbaro 10+DES+COS). <strong>Ogni tipo di armatura ha ora resistenze e debolezze elementali</strong> — vedi la sezione dedicata più sotto.</p>
              <p className="arena-info-shield-note">
                <span className="arena-info-shield-badge">🛡 SCUDI — NUOVE REGOLE</span>
                Lo scudo ora dà <strong>+1 CA</strong> (prima +2). <strong>MA</strong> ingombra il lanciatore: se un <strong>caster impugna uno scudo</strong>, i suoi <strong>incantesimi da DANNO</strong> sono ostacolati — tira <strong>a svantaggio</strong> i colpi a tiro-per-colpire, e i bersagli tirano il <strong>Tiro Salvezza con vantaggio</strong>. Gli incantesimi di <em>controllo</em> non sono toccati.
              </p>
              <p><strong>Esempio:</strong> Fighter (FOR +3) con Spada Lunga (1d8). d20=14 → 14+3+3=20 vs CA 16 → <em>colpo!</em> Danno: 1d8=5 → 5+3 = <strong>8</strong>.</p>
            </div>

            <h3 className="arena-info-title">✨ Incantesimi e Tiri Salvezza (TS)</h3>
            <div className="arena-info-example">
              <p><strong>CD del Tiro Salvezza:</strong> <strong>8 + competenza + caratteristica da incantatore</strong> del lanciatore. La caratteristica dipende dalla classe: <strong>INT</strong> (Mago), <strong>SAG</strong> (Chierico, Druido, Ranger), <strong>CAR</strong> (Bardo, Paladino, Stregone, Warlock).</p>
              <p><strong>Quale TS tira il bersaglio:</strong> dipende dall'<em>incantesimo</em>, non dal lanciatore — <strong>DES</strong> per fuoco/fulmine/freddo/tuono/radiante, <strong>COS</strong> per veleno/necrotico, ecc. Il bersaglio tira d20 + il proprio modificatore in quella caratteristica contro la CD.</p>
              <p><strong>Gli incantesimi a danno funzionano in 4 modi:</strong></p>
              <ul className="arena-info-list">
                <li><strong>🎯 Tiro per colpire</strong> — il caster tira d20 + competenza + caratteristica vs CA (come un'arma); 20 naturale = dadi ×2. <em>Es.: Dardo di Fuoco, Raggio Rovente, Infliggi Ferite, Tocco Vampirico.</em></li>
                <li><strong>TS dimezza i danni</strong> — il bersaglio tira il TS: fallisce = danno pieno, <strong>supera = metà danni</strong>. <em>Es.: Palla di Fuoco, Fulmine, Mani Brucianti, Frantumare.</em></li>
                <li><strong>TS annulla i danni</strong> — fallisce = danno pieno, supera = <strong>nessun danno</strong>. <em>Es.: Spruzzo Velenoso, Fiamma Sacra, Rintocco Funebre.</em></li>
                <li><strong>✨ Colpisce sempre</strong> — nessun tiro. <em>Es.: Dardo Incantato (3d4 automatici).</em></li>
              </ul>
              <p><strong>Controllo</strong> (Sonno, Blocca Persone, Charme…): il bersaglio tira il TS indicato o <strong>perde 2 turni</strong>, con un nuovo tiro a ogni turno per liberarsi. <strong>Veleno/effetti nel tempo:</strong> TS a inizio turno per ridurre i danni continuati.</p>
              <p><strong>Difese contro i TS:</strong> <em>Assorbire Elementi</em> dà +3 ai prossimi 3 TS; <em>Scudo della Fede</em> (chierico &amp; affini) dà <strong>+2 a TUTTI i TS per 2 turni</strong>. <strong>Aiuto</strong>: +1 al danno per 2 turni.</p>
            </div>

            <h3 className="arena-info-title">🔥❄ Resistenze &amp; Debolezze Elementali</h3>
            <div className="arena-info-example">
              <p>Il tipo di armatura non è più solo una questione di CA: reagisce alle magie elementali. Queste regole valgono <strong>in tutti i fight</strong> (tornei, Sfide Libere e contro l'IA).</p>
              <ul className="arena-info-list">
                <li><strong>⚡ Senza armatura → +1 iniziativa.</strong> Chi combatte senza armatura è più reattivo e tira l'iniziativa con un bonus di +1.</li>
                <li><strong>🛡 Armatura pesante → debole a fulmine e tuono.</strong> Contro le magie di <strong>fulmine/tuono</strong>, chi ti attacca tira <strong>per colpire con vantaggio</strong> e tu tiri i <strong>Tiri Salvezza con svantaggio</strong>. Il metallo attira e conduce la scarica.</li>
                <li><strong>🔥 Fuoco su armatura leggera/di pelle o forma animale → Bruciatura.</strong> Se indossi un'<strong>armatura leggera</strong> (cuoio, tunica) o sei un druido in <strong>Forma Selvaggia</strong> e subisci danni da una <strong>magia di fuoco</strong>, hai il <strong>25%</strong> di prendere <strong>Bruciatura</strong>: prendi fuoco e subisci <strong>1d4 danni a inizio turno per 2 turni</strong>.</li>
                <li><strong>🧊 Freddo → Congelato.</strong> Chiunque subisca danni da una <strong>magia di ghiaccio</strong> ha il <strong>25%</strong> di restare <strong>Congelato</strong>: <strong>svantaggio al prossimo tiro per colpire</strong>.</li>
              </ul>
              <p>Bruciatura e Congelato si curano come gli altri effetti nel tempo (es. <em>Ristorare Inferiore</em>). Ogni stato attivo è mostrato con il proprio <strong>badge dedicato</strong> sulla card del combattente, così capisci sempre cosa hai addosso.</p>
              <p><strong>Bottega — Oggetti Malus:</strong> tra i consumabili il Master può mettere in vendita <strong>oggetti malus</strong>, che come una Bomba sono azioni gratuite ma invece del danno infliggono al nemico uno svantaggio a scelta: <strong>svantaggio ai tiri per colpire, sanguinamento, veleno, Bruciatura o Congelato</strong>.</p>
            </div>

            <h3 className="arena-info-title">🛡 Le 12 Classi</h3>
            <div className="arena-info-example">
              <p><strong>Guerriero (Fighter)</strong> — Armi semplici e marziali, 2 armi equipaggiabili, armatura pesante + scudo. <em>Skill:</em> Secondo Respiro (cura), Scatto d'Azione (azione extra), Carica (2d6+FOR), Disarmare (blocca armi 3T), Presenza Possente + Critico Migliorato (passive).</p>
              <p><strong>Barbaro (Barbarian)</strong> — Armi semplici e marziali, 2 armi, armatura leggera/media o nessuna + scudo. <em>Skill:</em> Furia (+2 danni, di più ai livelli alti, e riduzione danni 3T · 2 cariche), Turbine di Lame (2 attacchi, ognuno col suo tiro: 1d6+FOR a colpo), Attacco Poderoso (azione bonus: vantaggio al prossimo attacco del turno).</p>
              <p><strong>Paladino (Paladin)</strong> — Armi marziali, 2 armi, armatura pesante + scudo. Spell paladino. <em>Skill:</em> Smite Divino (arma +2d8, 2 cariche), Imposizione delle Mani (pozza di cura = HP/3, scegli quanti curare).</p>
              <p><strong>Cacciatore (Ranger)</strong> — Armi ranger, 2 armi, armatura leggera/media + scudo. Spell ranger. <em>Skill:</em> Marchio del Cacciatore (+3 ai TPC per 3 turni, bonus action).</p>
              <p><strong>Monaco (Monk)</strong> — Solo mani nude (nessun'arma da scegliere), 2 attacchi a turno: 1° Pugno (2d4+DES), 2° Calcio (1d4+FOR). Nessuna armatura (CA = 10 + DES + SAG), no scudo. <em>Skill:</em> Carica di Pugni (2 colpi 2d6+DES), Concentrazione (+2 danno 2T), Assorbire Danni (80% del prossimo danno si converte in cura · 1 carica), Cura Ki (1d8+SAG).</p>
              <p><strong>Ladro (Rogue)</strong> — Armi ladro, 2 armi, armatura leggera, no scudo. Vantaggio all'iniziativa. <em>Skill:</em> Attacco Furtivo (arma +1d6+DES, 3 cariche), Furtività (vantaggio sui prossimi 2 attacchi), Triboli (TS DES avversario: fallito → svantaggio + 1d6 sanguinamento/turno per 2T; riuscito → solo 1T).</p>
              <p><strong>Mago (Wizard)</strong> — Armi semplici, 1 arma, abito da mago (no armatura, no scudo). Slot magia ampi. <em>Skill:</em> Recupero Arcano (ripristina 2 slot lv1 + 1 slot lv2).</p>
              <p><strong>Stregone (Sorcerer)</strong> — Armi semplici, 1 arma, no armatura, no scudo. <strong>Slot in stile D&D:</strong> trucchetti <strong>illimitati</strong>; <strong>4 slot di Livello 1</strong> e <strong>4 slot di Livello 2</strong> condivisi fra tutte le spell di quel livello (4 lanci totali per livello, con qualunque combinazione). <em>Skill:</em> Stregoneria Innata (passiva: se il nemico tira ≤7 sul TS contro le tue spell, o se tiri 17+ naturale con uno spell-attack, i danni aumentano del 50%), Fonte di Magia (recupera 2 slot a scelta · 2 cariche).</p>
              <p><strong>Warlock</strong> — Armi semplici, 1 arma, armatura leggera, no scudo. <em>Skill:</em> Magical Cunning (salta turno → +1 carica a ogni slot, 2 cariche), Patto Demoniaco (sacrifica 1d4 HP → +1d12 alle spell per 3T).</p>
              <p><strong>Druido (Druid)</strong> — Armi druido, 1 arma, armatura druidica + scudo di legno. Spell druido. <em>Skill:</em> Forma Selvaggia (Wild Shape, trasformazione con HP propri). <strong>Orso</strong>: attacco multiplo naturale — <strong>2 attacchi</strong> a turno (morso + artiglio). <strong>Lupo</strong>: ogni colpo ha il <strong>20%</strong> di causare <strong>sanguinamento</strong> (1d4/turno per 2 turni).</p>
              <p><strong>Chierico (Cleric)</strong> — Armi cleric, 1 arma, armatura leggera/media + scudo. Slot magia (cura, buff, danni divini). <em>Spell chiave:</em> Scudo della Fede (+2 a TUTTI i TS per 2T), Aiuto (+1 al danno per 2T).</p>
              <p><strong>Bardo (Bard)</strong> — Armi bardo, 1 arma, armatura leggera, no scudo. Spell bardo. <em>Skill:</em> Ispirazione Bardica (+1d6 al prossimo TPC alleato, cariche = CAR, bonus action).</p>
            </div>

            <h3 className="arena-info-title">🧪 Oggetti Consumabili</h3>
            <ul className="arena-info-list">
              <li><strong>🧪 Pozione di Cura</strong> — 2d12 HP, consuma il turno.</li>
              <li><strong>💣 Bomba</strong> — 2d6 danni al bersaglio, consuma il turno.</li>
              <li><strong>☠ Pozione di Veleno</strong> — applica 1d6 veleno al bersaglio per il turno successivo.</li>
              <li>Gli oggetti comprati alla <strong>Bottega Settimanale</strong> compaiono nello zaino nei fight di torneo, con i loro usi, in tutti i tornei della settimana fino a domenica alle 23:00.</li>
            </ul>

            <h3 className="arena-info-title">🪙 Monete Arena (MA)</h3>
            <ul className="arena-info-list">
              <li><strong>+5 MA</strong> per ogni fight di torneo concluso, anche se perdi.</li>
              <li><strong>+10 MA</strong> per ogni round vinto.</li>
              <li><strong>+5 MA</strong> se vinci con oltre il 70% degli HP e <strong>+3 MA</strong> se vinci con oltre il 40% (si sommano: chi chiude sopra il 70% prende entrambi).</li>
              <li><strong>+5 MA</strong> se chiudi il round in meno di 8 attacchi.</li>
              <li><strong>+4 MA</strong> se durante il round una tua resistenza scatta almeno 2 volte (anche di striscio).</li>
              <li><strong>+30 MA</strong> se vinci il torneo (in aggiunta ai premi dei round).</li>
              <li>Le Monete arrivano <strong>subito a fine round</strong>: spendile alla <strong>Bottega Settimanale</strong> (oggetti, incantesimi, armi, armature e pet validi fino a domenica sera, solo nei tornei) prima del round successivo.</li>
            </ul>

            <h3 className="arena-info-title">💰 Sistema Scommesse</h3>
            <div className="arena-info-example">
              <p>Durante il torneo puoi scommettere le tue <strong>Monete Arena (MA)</strong> sui combattenti usando il pannello Scommesse — anche se non hai partecipato all'arena.</p>
              <p><strong>Scommessa su un match:</strong> scegli il vincitore di un singolo fight — puntata da <strong>{BET_MATCH_AMOUNTS.join(", ")} MA</strong>, se azzecchi ricevi <strong>×{BET_MATCH_MULT}</strong> la puntata.</p>
              <p><strong>Scommessa sul torneo:</strong> scegli chi vincerà l&apos;intero torneo. Puntata da {BET_TOURNAMENT_AMOUNTS.join(", ")} MA → se azzecchi, ricevi <strong>×{BET_TOURNAMENT_MULT}</strong> la puntata.</p>
              <p>Puoi piazzare <strong>una sola scommessa per match</strong> e una sola sul vincitore finale; chi combatte può puntare solo su sé stesso. Le MA vengono scalate subito e la vincita arriva appena il fight (o il torneo) finisce: sono <strong>Monete Arena da spendere alla Bottega</strong>. Domenica alle 23:00 si azzera tutto: le scommesse ancora aperte si annullano e le monete tornano a 60.</p>
              <p><strong>Attenzione:</strong> si scommette solo sui fight <strong>non ancora iniziati</strong> (finché i combattenti non hanno dato «Iniziamo»). La scommessa sul vincitore del torneo è disponibile <strong>solo durante il Round 1</strong>.</p>
            </div>

          </div>
        )}
      </div>
      )}

      {/* ── VISTA ALBO: campione attuale + Sala dei Campioni ── */}
      {arenaView === "gesta" && (
        <ArenaGestaView
          tournamentHistory={tournamentHistory}
          currentUid={currentUser?.uid}
          isMaster={isMaster}
        />
      )}

      {arenaView === "cronache" && currentUser && (
        <ArenaChronicles
          currentUid={currentUser.uid}
          isMaster={isMaster}
          renderText={(l, uid) => renderLogWithDice(displayLog(l, uid))}
        />
      )}

      {arenaView === "albo" && (<>
      <div className="nx-testata">
        <span className="nx-kicker">Sala dei Campioni</span>
        <h2 className="nx-titolo">Albo dei Campioni</h2>
        <p className="nx-sotto">Chi ha vinto un torneo resta inciso qui: campioni, classifica generale a punti e storico delle edizioni.</p>
      </div>
      {/* CHAMPION BANNER */}
      {arenaMeta.phase === "finished" && arenaMeta.tournamentWinner && (
        <div className="champion-banner">
          <div className="champion-crown">♛</div>
          <div className="champion-label">Campione dell'Arena</div>
          <div className="champion-name">{snapshots[arenaMeta.tournamentWinner]?.name || "Campione"}</div>
          {arenaMeta.prizes && <div className="champion-prize">Premio: {arenaMeta.prizes}</div>}
        </div>
      )}
      {arenaMeta.phase !== "finished" && !arenaMeta.tournamentWinner && mostRecentChampion?.uid && (
        <div className="champion-banner last-champion">
          <div className="champion-crown">♛</div>
          <div className="champion-label">Ultimo Campione</div>
          <div className="champion-name">
            {mostRecentChampion.image && (
              <img src={mostRecentChampion.image} alt="" className="last-champion-avatar" />
            )}
            {mostRecentChampion.name || "Campione"}
            {mostRecentChampion.class && <span className="last-champion-class"> · {mostRecentChampion.class}</span>}
          </div>
          {mostRecentChampion.prizes && <div className="champion-prize">Premio: {mostRecentChampion.prizes}</div>}
        </div>
      )}

      {champions.length > 0 && (
        <HallOfChampions
          champions={champions}
          isMaster={isMaster}
          onRemove={async (uid) => {
            const champ = champions.find(c => c.uid === uid);
            if (!champ) return;
            if (!window.confirm(`Rimuovere ${champ.name || "questo campione"} dalla Sala dei Campioni? Verranno eliminate ${champ.wins} vittorie.`)) return;
            for (const id of champ.entryIds) {
              try { await deleteDoc(doc(db, "arena_tournament_history", id)); }
              catch (e) { console.error("delete champion entry:", e); }
            }
          }}
        />
      )}

      {/* CLASSIFICA GENERALE A PUNTI (visibile a tutti) */}
      {arenaLeaderboard.length > 0 && (
        <div className="arena-leaderboard" style={{ marginTop: 24 }}>
          <h3 className="arena-info-title">🏅 Classifica Generale <small style={{ fontWeight: 400 }}>(vittoria +3 · 2° posto +2 · partecipazione +1)</small></h3>
          <ol className="arena-lead-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {arenaLeaderboard.map((e, i) => (
              <li key={e.uid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: e.uid === currentUser?.uid ? "rgba(var(--el-rgb),0.18)" : "rgba(255,255,255,0.04)", marginBottom: 6 }}>
                <span style={{ width: 26, textAlign: "center", fontWeight: 700, opacity: 0.8 }}>{i + 1}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{e.name || "—"}</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>🏆 {e.wins} · 🥈 {e.seconds} · 🎟 {e.plays}</span>
                <span style={{ fontWeight: 800, minWidth: 54, textAlign: "right" }}>{e.points} pt</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* STORICO TORNEI NUMERATI (solo Master) */}
      {isMaster && tournamentHistory.length > 0 && (
        <div className="arena-tourney-log" style={{ marginTop: 24 }}>
          <h3 className="arena-info-title">📜 Storico Tornei <small style={{ fontWeight: 400 }}>(dettaglio premi)</small></h3>
          {[...tournamentHistory]
            .sort((a, b) => (b.tournamentNumber || 0) - (a.tournamentNumber || 0) || ((b.ts?.toMillis?.() || 0) - (a.ts?.toMillis?.() || 0)))
            .map(t => (
              <div key={t.id} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", marginBottom: 8 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>Torneo #{t.tournamentNumber || "?"}</div>
                <div>🥇 1°: <strong>{t.winnerName || "—"}</strong>{t.winnerClass ? ` · ${t.winnerClass}` : ""}</div>
                <div>🥈 2°: {t.runnerUpName || "—"}{t.runnerUpClass ? ` · ${t.runnerUpClass}` : ""}</div>
                <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>👥 {(t.participants || []).map(p => p.name).filter(Boolean).join(", ") || "—"}</div>
                {formatPrizeConfig(t.prizeConfig) && <div style={{ fontSize: "0.85rem", marginTop: 2 }}>🎁 {formatPrizeConfig(t.prizeConfig)}</div>}
              </div>
            ))}
        </div>
      )}
      </>)}

      {/* ── VISTA MASTER: pannello del Master + strumenti ── */}
      {arenaView === "master" && isMaster && (
        <div id="arena-master-panel" className="master-panel">
          <div className="master-mast">
            <span className="master-mast-eyebrow">Registro del Lanista</span>
            <h3 className="master-panel-title"><span className="master-crown">♛</span> Pannello del Master</h3>
          </div>

          {/* ── ISCRITTI (2026-09-09): prima cosa in pagina — approvati, in attesa, opzione
                "solo campioni" e i tastini di gestione. Solo markup riordinato. ── */}
          <section className="lan-blocco lan-iscritti" aria-label="Iscritti">
          <div className="master-sections">
            <div className="master-col">
              <p className="col-label">Approvati ({arenaMeta.participants?.length || 0})</p>
              {arenaMeta.participants?.length === 0 && <p className="empty-note">Nessuno ancora approvato.</p>}
              {arenaMeta.participants?.map(uid => {
                const titles = getSnapTitles(snapshots[uid]);
                return (
                  <div key={uid} className="participant-tag participant-title-row">
                    <span className="p-dot approved" />
                    <span className="p-name">{snapshots[uid]?.name || uid}</span>
                    {snapshots[uid]?.class && <span className="p-class">{snapshots[uid].class}{snapshots[uid].subclassName ? ` · ${snapshots[uid].subclassIcon || ""} ${snapshots[uid].subclassName}` : ""}</span>}
                    {titles.map(key => ARENA_TITLES[key] && (
                      <span key={key} className="p-title-badge" title={ARENA_TITLES[key].short}>
                        {ARENA_TITLES[key].icon} {ARENA_TITLES[key].name}
                      </span>
                    ))}
                    {arenaMeta.phase === "registration" && (
                      <button className="btn-bench-one" onClick={() => benchParticipant(uid)} title="Sposta in attesa">
                        ↩
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="master-col">
              <p className="col-label">In Attesa ({arenaMeta.waitingList?.length || 0})</p>
              {arenaMeta.waitingList?.length === 0 && <p className="empty-note">Nessuna richiesta.</p>}
              {arenaMeta.waitingList?.map(uid => (
                <div key={uid} className="approval-row">
                  <span className="p-dot pending" />
                  <span className="p-name">{snapshots[uid]?.name || uid}</span>
                  <button className="btn-approve" onClick={() => approveParticipant(uid)}>✓ Ammetti</button>
                </div>
              ))}
            </div>
          </div>
          {arenaMeta.phase === "registration" && (
            <div className="prize-editor">
              <p className="col-label">♛ Opzioni Iscrizioni</p>
              <label className="champions-only-toggle">
                <input
                  type="checkbox"
                  checked={!!arenaMeta.championsOnly}
                  onChange={async (e) => {
                    const enabling = e.target.checked;
                    await updateDoc(doc(db, "arena_meta", "global"), { championsOnly: enabling });
                    if (enabling && champions.length > 0) {
                      const sendInvites = window.confirm(
                        `Inviare un invito ai ${champions.length} campioni della Sala?`
                      );
                      if (sendInvites) {
                        for (const c of champions) {
                          try {
                            await addDoc(collection(db, "notifications"), {
                              userId: c.uid,
                              read: false,
                              timestamp: serverTimestamp(),
                              title: "♛ Arena dei Campioni — Iscrizioni Aperte",
                              message: `Solo i Campioni possono entrare. Hai già vinto ${c.wins} ${c.wins === 1 ? "torneo" : "tornei"}: dimostra ancora il tuo valore!`,
                            });
                          } catch (err) { console.error("champion invite:", err); }
                        }
                        alert(`✔ Inviati ${champions.length} inviti.`);
                      }
                    }
                  }}
                />
                <span>♛ Solo Campioni — solo chi ha già vinto un torneo può iscriversi</span>
              </label>
            </div>
          )}
          <div className="master-action-group">
            <span className="master-group-label">👥 Gestione iscritti &amp; partite</span>
            <div className="master-actions">
            {(arenaMeta.participants?.length || 0) > 0 && (
              <button className="btn-bench-all" onClick={benchAllParticipants} title="Sposta tutti i partecipanti nella lista d'attesa">
                ↩ Tutti in attesa
              </button>
            )}
            {(arenaMeta.waitingList?.length || 0) > 0 && (
              <button className="btn-clear-waiting" onClick={clearWaitingList} title="Svuota la lista d'attesa">
                🗑 Svuota attesa
              </button>
            )}
            {(() => {
              const archivedIds = new Set((arenaMeta.funMatchHistory || []).map(e => e.matchId));
              const prunable = (arenaMeta.matches || []).filter(
                m => m.kind === "fun" && m.status === "finished" && archivedIds.has(m.matchId)
              );
              if (prunable.length === 0) return null;
              return (
                <button
                  className="btn-clear-waiting"
                  title="Rimuove dalle partite live le Sfide Libere finite e già archiviate (i vincitori restano nello storico)"
                  onClick={async () => {
                    if (!window.confirm(`Pulire ${prunable.length} sfida/e libera/e finite dall'arena? I vincitori restano nello storico.`)) return;
                    const prunableIds = new Set(prunable.map(m => m.matchId));
                    const kept = (arenaMeta.matches || []).filter(m => !prunableIds.has(m.matchId));
                    await commitArenaMatches(kept);
                  }}
                >
                  🧹 Pulisci partite finite ({prunable.length})
                </button>
              );
            })()}
            </div>
          </div>
          </section>

          {/* ── LE DUE LEVE: entra / dai inizio (e avanza round, timer) ── */}
          <div className="master-toolbar">
          <div className="master-action-group">
            <span className="master-group-label">⚔ Flusso del torneo</span>
            <div className="master-actions">
            {arenaMeta.phase === "registration" && myEntryIds.length < MASTER_ALT_MAX && (
              <button className="btn-master-join" onClick={() => { setMasterJoinSetup(v => !v); setMasterJoinName(""); setMasterJoinClass(""); }}>
                {myEntryIds.length ? "＋ Iscrivi un altro PG" : "🗡 Entra nell'Arena"}
              </button>
            )}
            {myEntryIds.length > 0 && arenaMeta.phase === "registration" && (
              <div className="master-join-status">
                {(() => {
                  const inPlay = myEntryIds.filter((id) => (arenaMeta.participants || []).includes(id)).length;
                  const waiting = myEntryIds.length - inPlay;
                  return `✔ ${myEntryIds.length} PG del Master${inPlay ? ` · ${inPlay} ammessi` : ""}${waiting ? ` · ${waiting} da ammettere (lista d'attesa)` : ""}`;
                })()}
              </div>
            )}
            {arenaMeta.phase === "registration" && (
              <button className="btn-start-tournament" onClick={startTournament}
                disabled={!arenaMeta.participants || arenaMeta.participants.length < 2}>
                ⚔ Dai inizio all'Arena
              </button>
            )}
            {canAdvanceRound && (
              <button className="btn-advance-round" onClick={advanceRound}>
                {advanceLabel}
              </button>
            )}
            {canDeclareChampion && (
              <button className="btn-advance-round" onClick={declareTournamentChampion}>
                🏆 Dichiara Campione
              </button>
            )}
            {arenaMeta.phase === "combat" && (
              arenaMeta.timerPaused ? (
                <button className="btn-timer-play" onClick={resumeArenaTimers}>
                  ▶ Riprendi Timer
                </button>
              ) : (
                <button className="btn-timer-pause" onClick={pauseArenaTimers}>
                  ⏸ Pausa Timer
                </button>
              )
            )}
            </div>
          </div>
          </div>

          {masterJoinSetup && arenaMeta.phase === "registration" && (
            <div className="master-join-setup">
              {(() => {
                const ready = [
                  ...masterReserves.map((r, i) => r && { kind: "reserve", i, name: r.name, cls: r.class, hp: r.rolledHp ?? r.stats?.maxHp, ac: r.stats?.ac, tag: `Riserva ${i + 1}` }),
                  ...savedArenaChars.map((sc, i) => sc && { kind: "saved", i, name: sc.name || String(sc.label || "").split(" · ")[0], cls: sc.class, hp: sc.rolledHp, ac: null, tag: `Salvato ${i + 1}` }),
                ].filter(Boolean);
                if (!ready.length) return null;
                const cur = ready.find((x) => masterPick && x.kind === masterPick.kind && x.i === masterPick.i) || null;
                return (
                  <div className="saved-chars-block master-ready">
                    <h4 className="master-join-setup-title">Entra con un PG già pronto</h4>
                    <div className="saved-chars-grid" role="radiogroup" aria-label="PG pronti">
                      {ready.map((x) => {
                        const on = cur === x;
                        return (
                          <div key={`${x.kind}${x.i}`} className={`saved-char-card saved-char-pick${on ? " is-selected" : ""}`}
                            style={{ "--cls": classColor(x.cls) }}
                            role="radio" aria-checked={on} tabIndex={0}
                            onClick={() => setMasterPick({ kind: x.kind, i: x.i })}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMasterPick({ kind: x.kind, i: x.i }); } }}>
                            <div className="saved-char-slot">{on ? "✓ Selezionato" : x.tag}</div>
                            <div className="saved-char-name">{x.name}</div>
                            <div className="saved-char-meta"><span className="saved-char-cls">{CLASS_ICONS[(x.cls || "").toLowerCase()] || "✦"} {CLASS_IT[x.cls] || x.cls}</span> · ❤ {x.hp}{x.ac ? ` · 🛡 ${x.ac}` : ""}</div>
                          </div>
                        );
                      })}
                    </div>
                    <button className="btn-join saved-char-use" disabled={!cur}
                      onClick={() => (cur.kind === "reserve" ? enterWithReserve(cur.i) : joinWithSavedChar(cur.i))}>
                      {cur ? `⚔ Entra con ${cur.name}` : "Tocca un PG per selezionarlo"}
                    </button>
                  </div>
                );
              })()}
              <h4 className="master-join-setup-title">…oppure crea un personaggio nuovo</h4>
              <input
                className="master-join-input"
                placeholder="Nome personaggio…"
                value={masterJoinName}
                onChange={e => setMasterJoinName(e.target.value)}
                maxLength={30}
              />
              <select
                className="master-join-select"
                value={masterJoinClass}
                onChange={e => setMasterJoinClass(e.target.value)}
              >
                <option value="">— Scegli Classe —</option>
                {MASTER_JOIN_CLASSES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="master-join-setup-actions">
                <button className="btn-cancel-loadout" onClick={() => setMasterJoinSetup(false)}>Annulla</button>
                <button className="btn-auto-generate" onClick={() => {
                  const RANDOM_NAMES = ["Caelus", "Selene Vale", "Thorin Vex", "Lyra Sangueforte", "Argus Nera-Lama", "Kael Ombravento", "Mira Spaccaossa", "Borin Hammerstein", "Vesper Ombracorvo", "Auron Ferrosaldo", "Nyx Velocelama", "Roric Cuoredrago", "Sylas Forgiatuono", "Elara Ventoluce", "Garrick Pugnoreale"];
                  const randName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
                  const randClass = MASTER_JOIN_CLASSES[Math.floor(Math.random() * MASTER_JOIN_CLASSES.length)];
                  setMasterJoinName(randName);
                  setMasterJoinClass(randClass);
                }} title="Riempie nome e classe casuali">
                  🎲 Genera
                </button>
                <button className="btn-join" onClick={startMasterLoadout} disabled={!masterJoinName.trim() || !masterJoinClass}>
                  Continua →
                </button>
              </div>
            </div>
          )}

          {/* ── RISERVE, RICOMPENSA, PERICOLO: pieghe richiudibili (aperte su desktop,
                chiuse sul telefono; la zona pericolo è sempre chiusa) ── */}
          {arenaMeta.phase === "registration" && (
            <details className="reserve-panel lan-piega" open={lanAperto}>
              <summary className="lan-piega-testa"><span className="lan-piega-ico" aria-hidden="true">🎭</span><span className="lan-piega-tit">PG di Riserva</span><span className="lan-piega-sub">{masterReserves.filter(Boolean).length}/{MASTER_RESERVE_SLOTS} · bot per gli iscritti dispari</span></summary>
              <div className="reserve-slots-grid">
                {Array.from({ length: MASTER_RESERVE_SLOTS }, (_, i) => i).map(i => {
                  const r = masterReserves[i];
                  if (r) {
                    return (
                      <div key={i} className={`reserve-slot reserve-slot--filled reserve-slot--${i}`} style={{ "--rc": classColor(r.class), "--cls": classColor(r.class) }}>
                        <div className="reserve-slot-idx">Riserva {i + 1}</div>
                        <div className="reserve-slot-name">{r.name}</div>
                        <div className="reserve-slot-meta"><span className="saved-char-cls">{CLASS_ICONS[(r.class || "").toLowerCase()] || "✦"} {CLASS_IT[r.class] || r.class}</span> · ❤ {r.rolledHp ?? r.stats?.maxHp} · 🛡 {r.stats?.ac}</div>
                        <div className="reserve-slot-actions">
                          <button className="reserve-slot-recreate" onClick={() => openReserveCreate(i)}>Ricrea</button>
                          <button className="reserve-slot-del" title="Elimina" onClick={() => deleteReserve(i)}>🗑</button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <button key={i} className={`reserve-slot reserve-slot--empty reserve-slot--${i}`} onClick={() => openReserveCreate(i)}>
                      <span className="reserve-slot-plus">＋</span>
                      <span className="reserve-slot-idx">Crea Riserva {i + 1}</span>
                    </button>
                  );
                })}
              </div>
            </details>
          )}

          <details className="lan-piega lan-premi" open={lanAperto}>
            <summary className="lan-piega-testa">
              <span className="lan-piega-ico" aria-hidden="true">🏆</span>
              <span className="lan-piega-tit">Ricompensa della prossima Arena</span>
              {formatPrizeConfig(arenaMeta.prizeConfig)
                ? <span className="lan-piega-sub">{formatPrizeConfig(arenaMeta.prizeConfig)}</span>
                : <span className="lan-piega-sub">nessun premio impostato</span>}
            </summary>
          <div className="arena-reward-editor">
            <textarea
              className="arena-reward-textarea"
              rows={2}
              placeholder="Nota generale sulla ricompensa (facoltativa, la vedono tutti nell'hub)…"
              value={prizeText}
              onChange={e => setPrizeText(e.target.value)}
            />
            {/* ── Premi strutturati per fascia (distribuiti in automatico a fine Arena, tranne i vantaggi live) ── */}
            <div className="arena-prize-tiers">
              {[
                { key: "first",       label: "🥇 1° posto" },
                { key: "second",      label: "🥈 2° posto" },
                { key: "participant", label: "🎟 Partecipanti" },
              ].map(t => (
                <div key={t.key} className="arena-prize-tier">
                  <div className="arena-prize-tier-label">{t.label}</div>
                  <div className="arena-prize-tier-fields">
                    <label className="arena-prize-field">
                      <span>👑 Corone</span>
                      <input type="number" min={0} inputMode="numeric"
                        value={prizeConfig[t.key].crowns}
                        onChange={e => setPrizeField(t.key, "crowns", e.target.value)} />
                    </label>
                    <label className="arena-prize-field">
                      <span>🪙 Monete Arena</span>
                      <input type="number" min={0} inputMode="numeric"
                        value={prizeConfig[t.key].coins}
                        onChange={e => setPrizeField(t.key, "coins", e.target.value)} />
                    </label>
                    <label className="arena-prize-field arena-prize-field--wide">
                      <span>🎁 Vantaggi sessioni live (a mano)</span>
                      <input type="text"
                        placeholder="es. un favore dal DM, +1 tiro fortuna…"
                        value={prizeConfig[t.key].perks}
                        onChange={e => setPrizeField(t.key, "perks", e.target.value)} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <p className="arena-reward-hint">
              Corone e Monete Arena vengono <strong>assegnate in automatico a fine Arena</strong> (1°, 2° e partecipanti).
              I <strong>vantaggi sessioni live</strong> sono solo un promemoria: li applichi tu.
            </p>
            <button className="arena-reward-save" onClick={savePrizes}>💾 Salva premi</button>
            {formatPrizeConfig(arenaMeta.prizeConfig) && (
              <p className="arena-reward-current">Premi impostati: <strong>{formatPrizeConfig(arenaMeta.prizeConfig)}</strong></p>
            )}
            {arenaMeta.prizes && arenaMeta.prizes.trim() && (
              <p className="arena-reward-current">Nota: <strong>{arenaMeta.prizes}</strong></p>
            )}
          </div>
          </details>

          <details className="lan-piega lan-pericolo">
            <summary className="lan-piega-testa">
              <span className="lan-piega-ico" aria-hidden="true">⚠</span>
              <span className="lan-piega-tit">Zona pericolo</span>
              <span className="lan-piega-sub">azioni irreversibili</span>
            </summary>
          <div className="master-action-group master-danger-group">
            <div className="master-actions master-reset-zone">
            <button className="btn-reset" onClick={async () => {
              const inCombat = arenaMeta.phase === "combat";
              const inFinished = arenaMeta.phase === "finished";
              const partCount = (arenaMeta.participants?.length || 0);
              const warn = inCombat
                ? `Sei sicuro di voler resettare? Il torneo è IN CORSO con ${partCount} partecipanti. Tutto andrà perso (match, bracket, scommesse rimborsate).`
                : inFinished
                ? "Sei sicuro di voler resettare? Il torneo è concluso ma azzererai bracket, partecipanti e storico match dell'arena meta."
                : `Sei sicuro di voler resettare l'arena? (${partCount} iscritti verranno rimossi)`;
              if (!window.confirm(warn)) return;
              if (inCombat && !window.confirm("CONFERMA FINALE: stai per cancellare un torneo in corso. Procedere?")) return;
              await refundAllBets();
              const preservedFun = (arenaMeta.matches || []).filter(m => m.kind === "fun");
              // Conserva gli snapshot dei giocatori in fun match attive E quelli ancora in lista d'attesa,
              // così che il reset non costringa i waitlistati a re-iscriversi.
              const keepUids = new Set(arenaMeta.waitingList || []);
              preservedFun.forEach(m => (m.players || []).forEach(p => keepUids.add(p.id)));
              const allSnaps = arenaMeta.characterSnapshots || {};
              const preservedSnaps = {};
              keepUids.forEach(uid => { if (allSnaps[uid]) preservedSnaps[uid] = allSnaps[uid]; });
              await updateDoc(doc(db, "arena_meta", "global"), {
                phase: "registration", prizes: arenaMeta.prizes || "",
                participants: [], matches: preservedFun,
                characterSnapshots: preservedSnaps, tournamentWinner: null,
                currentRound: 1, matchHistory: [],
                groupA: [], groupB: [],
                championsOnly: arenaMeta.championsOnly || false,
                // waitingList intenzionalmente NON azzerata: usa "Svuota attesa" per pulirla.
              });
            }}>↺ Reset torneo</button>

            <button className="btn-reset btn-reset--wipe" onClick={async () => {
              if (!window.confirm("Azzerare i TITOLI VINTI di TUTTI i personaggi? Operazione irreversibile.")) return;
              try {
                const snap = await getDocs(collection(db, "characters"));
                const targets = snap.docs.filter(d => (d.data().arenaTitles?.length) || d.data().arenaTitle);
                for (const d of targets) {
                  await updateDoc(doc(db, "characters", d.id), { arenaTitles: [], arenaTitle: null });
                }
                // Pulisce anche i titoli indossati negli snapshot del torneo in corso.
                const snaps = arenaMeta.characterSnapshots || {};
                const metaPatch = {};
                Object.keys(snaps).forEach(uid => {
                  if ((snaps[uid]?.titles?.length) || snaps[uid]?.title) {
                    metaPatch[`characterSnapshots.${uid}.titles`] = [];
                    metaPatch[`characterSnapshots.${uid}.title`] = null;
                  }
                });
                if (Object.keys(metaPatch).length) await updateDoc(doc(db, "arena_meta", "global"), metaPatch);
                alert(`Titoli vinti azzerati per ${targets.length} personagg${targets.length === 1 ? "io" : "i"}.`);
              } catch (e) { console.error("clear titles:", e); alert("Errore azzeramento titoli: " + e.message); }
            }}>🏷 Azzera titoli vinti (tutti)</button>

            <button className="btn-reset btn-reset--wipe" onClick={async () => {
              if (!window.confirm("Azzerare gli ACQUISTI della Bottega di TUTTI i giocatori (arenaWeekly)? Operazione irreversibile.")) return;
              try {
                const snap = await getDocs(collection(db, "characters"));
                const targets = snap.docs.filter(d => d.data().arenaWeekly);
                for (const d of targets) {
                  await updateDoc(doc(db, "characters", d.id), { arenaWeekly: null });
                }
                alert(`Acquisti Bottega azzerati per ${targets.length} giocator${targets.length === 1 ? "e" : "i"}.`);
              } catch (e) { console.error("clear purchases:", e); alert("Errore azzeramento acquisti: " + e.message); }
            }}>🧹 Azzera acquisti Bottega (tutti)</button>

            <button className="btn-reset btn-reset--wipe" onClick={async () => {
              if (!window.confirm("Azzerare TUTTI i vincitori dell'Arena? La Sala dei Campioni e i contatori vittorie tornano a zero. Operazione irreversibile.")) return;
              try {
                const snap = await getDocs(collection(db, "arena_tournament_history"));
                for (const d of snap.docs) { await deleteDoc(doc(db, "arena_tournament_history", d.id)); }
                if (arenaMeta.tournamentWinner) {
                  await updateDoc(doc(db, "arena_meta", "global"), { tournamentWinner: null });
                }
                alert(`Azzerati ${snap.docs.length} record di vittoria dell'Arena.`);
              } catch (e) { console.error("clear winners:", e); alert("Errore azzeramento vincitori: " + e.message); }
            }}>🏆 Azzera vincitori Arena (tutti)</button>
            </div>
          </div>
          </details>
        </div>
      )}

      {/* FIX: P5c — collapsible master panels become trigger buttons + modals */}
      {arenaView === "master" && isMaster && (
        <div className="arena-modal-trigger-row">
          <button
            type="button"
            className="arena-modal-trigger"
            onClick={() => setTitlesModalOpen(true)}
          >
            <span className="arena-modal-trigger-icon">✦</span>
            <span className="arena-modal-trigger-text">
              <span className="arena-modal-trigger-title">Titoli d'Arena</span>
              <span className="arena-modal-trigger-sub">Permanenti — gestisci titoli</span>
            </span>
          </button>
          <button
            type="button"
            className="arena-modal-trigger"
            onClick={() => setStatsTournModalOpen(true)}
          >
            <span className="arena-modal-trigger-icon">★</span>
            <span className="arena-modal-trigger-text">
              <span className="arena-modal-trigger-title">Statistiche Torneo</span>
              <span className="arena-modal-trigger-sub">Classi · Tornei archiviati</span>
            </span>
          </button>
          <button
            type="button"
            className="arena-modal-trigger"
            onClick={() => setStatsFunModalOpen(true)}
          >
            <span className="arena-modal-trigger-icon">⚜</span>
            <span className="arena-modal-trigger-text">
              <span className="arena-modal-trigger-title">Statistiche Arena Libera</span>
              <span className="arena-modal-trigger-sub">Sfide concluse</span>
            </span>
          </button>
        </div>
      )}
      <ArenaModal
        open={titlesModalOpen}
        onClose={() => setTitlesModalOpen(false)}
        title="♛ Titoli d'Arena — Permanenti"
      >
        <MasterTitleEditor forceOpen snapshots={snapshots} />
      </ArenaModal>
      <ArenaModal
        open={statsTournModalOpen}
        onClose={() => setStatsTournModalOpen(false)}
        title="📊 Statistiche Classi — Torneo"
      >
        <TournamentClassStats liveTournament={liveTournament} onSync={syncMatchHistory} forceOpen />
      </ArenaModal>
      <ArenaModal
        open={statsFunModalOpen}
        onClose={() => setStatsFunModalOpen(false)}
        title="⚔ Statistiche Classi — Arena Libera"
      >
        <FunArenaClassStats
          funHistory={arenaMeta.funMatchHistory || []}
          currentMatches={arenaMeta.matches || []}
          isMaster={isMaster}
          onReset={async () => {
            await updateDoc(doc(db, "arena_meta", "global"), { funMatchHistory: [] });
          }}
          forceOpen
        />
      </ArenaModal>

      {/* ── VISTA JOIN: creazione personaggio / iscrizione ── */}
      {arenaView === "join" && (
        (arenaMeta.phase === "registration" && (!isMaster || loadoutPhase !== "idle")) ||
        (loadoutContext === "fun" && loadoutPhase !== "idle") ||
        // Ri-equipaggiamento tra i round: la fase è "shopping"/"combat", non "registration".
        (reloadoutMode && loadoutPhase === "selecting")
      ) && (
        <div id="arena-loadout" className={`join-zone ${loadoutContext === "fun" ? "join-zone-fun" : ""}`}>

          {loadoutContext === "fun" && (
            <div className={`fun-loadout-banner${aiMatchPending ? " fun-loadout-banner-ai" : ""}`}>
              {aiMatchPending
                ? "🤖 Stai preparando una Sfida contro l'IA — Hard Mode. L'avversario sarà generato al lancio."
                : (funAcceptMatchId
                    ? "🛡 Stai accettando una Sfida Libera — nessuna ricompensa, solo per il gusto del combattimento"
                    : "🛡 Stai creando una Sfida Libera — nessuna ricompensa, solo per il gusto del combattimento")}
            </div>
          )}

          {/* ── I PASSI (2026-09-09): stepper sempre visibile sopra la fase,
                così si sa dove si è e quanto manca. Solo markup + CSS. ── */}
          {loadoutPhase !== "idle" && (() => {
            const passi = [["class-select", "Classe"], ["stat-assign", "Caratteristiche"], ["rolling", "Punti Vita"], ["selecting", "Equipaggio"]];
            const idx = passi.findIndex(([k]) => k === loadoutPhase);
            return (
              <ol className="lizza-passi" aria-label="Passi dell'iscrizione">
                {passi.map(([k, lab], i) => (
                  <li key={k} className={`lizza-passo${i < idx ? " fatto" : i === idx ? " attivo" : ""}`} aria-current={i === idx ? "step" : undefined}>
                    <span className="n">{i < idx ? "✓" : i + 1}</span><span className="lab">{lab}</span>
                  </li>
                ))}
              </ol>
            );
          })()}

          {/* ── Fase CLASS-SELECT: scelta classe ── */}
          {loadoutPhase === "class-select" && charPreview && (
            <div className="hp-roll-panel">
              <div className="loadout-char-preview" style={{ justifyContent: "center", marginBottom: 20 }}>
                {charPreview.image && (
                  <img src={charPreview.image} alt={charPreview.name} className="loadout-avatar" />
                )}
                <div>
                  <div className="loadout-char-name">{charPreview.name}</div>
                  <div className="loadout-char-class">Scegli la tua classe</div>
                </div>
              </div>
              {loadoutContext === "reserve" && (
                <div className="reserve-create-banner">
                  🎭 Stai creando un <strong>PG di Riserva</strong> (Slot {(reserveSlotTarget ?? 0) + 1}) — un bot che entrerà automaticamente quando gli iscritti sono in numero dispari.
                </div>
              )}
              {loadoutContext !== "reserve" && renderLastLoadout({
                useLabel: "↺ Usa l'ultimo assetto",
                onUse: () => loadSavedArenaChar(null, lastArenaLoadout),
              })}
              {loadoutContext !== "reserve" && savedArenaChars.some(Boolean) && renderSavedPicker({
                useLabel: "⚔ Usa",
                onUse: (i) => loadSavedArenaChar(i),
                hint: "…oppure crea un nuovo personaggio scegliendo la classe qui sotto.",
              })}
              {/* Titolo + scorciatoia "Genera a caso" sulla stessa riga: la via veloce è a portata di pollice */}
              <div className="lizza-classe-testa">
                <div className="hp-roll-title">Classe</div>
                <button className="btn-join btn-auto-pg" onClick={autoGeneratePg} title="Crea un personaggio completo e casuale, pronto da rivedere">
                  ⚡ Genera a caso
                </button>
              </div>
              <div className="class-select-grid">
                {MASTER_JOIN_CLASSES.map(cls => (
                  <button
                    key={cls}
                    className="class-select-btn"
                    title={cls}
                    onClick={() => {
                      setCharPreview(prev => ({ ...prev, class: cls }));
                      // Torneo: accesa di default quella comprata. Sfide libere: si parte dalla base.
                      setPendingSubclass(loadoutContext === "tournament" ? ownedSubclassKey(charPreview.arenaWeekly, cls) : null);
                      setPendingStats({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
                      setLoadoutPhase("stat-assign");
                    }}
                  >
                    <span className="lizza-classe-ico" aria-hidden="true">{CLASS_ICONS[cls.toLowerCase()] || "✦"}</span>
                    <span className="lizza-classe-nome">{CLASS_IT[cls] || cls}</span>
                  </button>
                ))}
              </div>
              {/* ── SOTTOCLASSI: sfide libere = tutte sbloccate; torneo = quelle comprate in Bottega ── */}
              {(() => {
                const subTiles = MASTER_JOIN_CLASSES.flatMap(cls =>
                  selectableSubclasses(loadoutContext, charPreview.arenaWeekly, cls).map(o => ({ cls, o })));
                if (!subTiles.length) return null;
                return (<>
                  <div className="lizza-classe-testa lizza-sotto-testa">
                    <div className="hp-roll-title">🎓 Sottoclassi</div>
                    <span className="lizza-sotto-nota">{loadoutContext === "fun" ? "Nelle Sfide Libere sono tutte sbloccate" : "Comprate in Bottega questa settimana"}</span>
                  </div>
                  <div className="class-select-grid lizza-sotto-grid">
                    {subTiles.map(({ cls, o }) => (
                      <button
                        key={`${cls}-${o.key}`}
                        className="class-select-btn lizza-sotto-btn"
                        title={`${o.name} · ${o.desc}`}
                        onClick={() => {
                          setCharPreview(prev => ({ ...prev, class: cls }));
                          setPendingSubclass(o.key);
                          setPendingStats({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
                          setLoadoutPhase("stat-assign");
                        }}
                      >
                        <span className="lizza-classe-ico" aria-hidden="true">{o.icon}</span>
                        <span className="lizza-classe-nome">{o.name}</span>
                        <span className="lizza-sotto-base">{CLASS_ICONS[cls.toLowerCase()] || "✦"} {CLASS_IT[cls] || cls}</span>
                      </button>
                    ))}
                  </div>
                </>);
              })()}
              <button className="btn-cancel-loadout" style={{ marginTop: 18 }} onClick={cancelLoadout}>
                Annulla
              </button>
            </div>
          )}

          {/* ── Fase STAT-ASSIGN: distribuzione punti ── */}
          {loadoutPhase === "stat-assign" && charPreview && (() => {
            const classKey = getClassKey(charPreview.class);
            const asiBonus = getAsiPoints(classKey, charPreview.classLevels?.[classKey]);
            const STAT_BUDGET = 10 + asiBonus;   // 10 base + punti caratteristica (ASI) maturati coi livelli
            const STAT_CAP = 3 + asiBonus;        // cap per stat: +3 base, esteso dai punti ASI
            const spent = Object.values(pendingStats).reduce((a, b) => a + b, 0);
            const remaining = STAT_BUDGET - spent;
            const STAT_LABELS = [["str","FOR"],["dex","DES"],["con","COS"],["int","INT"],["wis","SAG"],["cha","CAR"]];
            const keyStats = ARENA_KEY_STATS[classKey] || [];
            return (
              <div className="hp-roll-panel">
                <div className="loadout-char-preview" style={{ justifyContent: "center", marginBottom: 20 }}>
                  {charPreview.image && (
                    <img src={charPreview.image} alt={charPreview.name} className="loadout-avatar" />
                  )}
                  <div>
                    <div className="loadout-char-name">{charPreview.name}</div>
                    <div className="loadout-char-class">{charPreview.class}{(() => { const d = pendingSubclass && getSubclassDef(getClassKey(charPreview.class), pendingSubclass); return d ? ` · ${d.icon} ${d.name}` : ""; })()}</div>
                  </div>
                </div>
                <div className="hp-roll-title">Caratteristiche</div>
                <div className="stat-budget-badge">{remaining > 0 ? `${remaining} punti da assegnare` : "✓ Punti assegnati"}</div>
                {asiBonus > 0 && (
                  <div className="stat-assign-hint">🎯 <strong>+{asiBonus} punti caratteristica</strong> dai livelli di {charPreview.class} (cap +{STAT_CAP} per caratteristica).</div>
                )}
                <div className="stat-assign-hint">⭐ In <strong>verde</strong> le caratteristiche consigliate per la classe <strong>{charPreview.class}</strong>.</div>
                <div className="stat-assign-grid">
                  {STAT_LABELS.map(([key, label]) => {
                    const isKey = keyStats.includes(key);
                    return (
                      <div key={key} className={`stat-assign-row${isKey ? " stat-key" : ""}`}>
                        <span className="stat-assign-label">
                          {label}
                          {isKey && <span className="stat-key-tag">⭐ consigliata</span>}
                        </span>
                        <div className="stat-assign-controls">
                          <button
                            className="stat-adj-btn"
                            onClick={() => setPendingStats(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }))}
                            disabled={pendingStats[key] <= 0}
                          >−</button>
                          <span className="stat-assign-val">{pendingStats[key] >= 0 ? "+" : ""}{pendingStats[key]}</span>
                          <button
                            className="stat-adj-btn"
                            onClick={() => setPendingStats(prev => ({ ...prev, [key]: Math.min(STAT_CAP, prev[key] + 1) }))}
                            disabled={pendingStats[key] >= STAT_CAP || remaining <= 0}
                          >+</button>
                        </div>
                        <div className="stat-assign-desc">{STAT_DESCS[key]}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="hp-roll-buttons">
                  <button className="btn-cancel-loadout" onClick={() => setLoadoutPhase("class-select")}>← Classe</button>
                  <button className="btn-auto-generate" onClick={() => {
                    /* Scelta AI: distribuzione mirata per la classe.
                       Priorità: stat chiave della classe → COS (sopravvivenza) → il resto.
                       Ogni stat è cappata a STAT_CAP, budget = 10 + punti ASI. */
                    const stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
                    let rem = STAT_BUDGET;
                    const seen = new Set();
                    const priority = [...keyStats, "con", "dex", "str", "wis", "cha", "int"]
                      .filter(k => (seen.has(k) ? false : seen.add(k)));
                    for (const k of priority) {
                      while (rem > 0 && stats[k] < STAT_CAP) { stats[k]++; rem--; }
                      if (rem === 0) break;
                    }
                    setPendingStats(stats);
                  }} title="L'AI assegna le caratteristiche in modo ottimale per la classe">
                    🤖 Scelta AI
                  </button>
                  <button className="btn-auto-generate" onClick={() => {
                    /* distribuisci il budget (10 + ASI) random tra 6 stat, cap a STAT_CAP */
                    const stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
                    let remaining = STAT_BUDGET;
                    const keys = Object.keys(stats);
                    while (remaining > 0) {
                      const k = keys[Math.floor(Math.random() * keys.length)];
                      if (stats[k] < STAT_CAP) { stats[k]++; remaining--; }
                      else if (keys.every(kk => stats[kk] >= STAT_CAP)) break;
                    }
                    setPendingStats(stats);
                  }} title="Distribuisce 10 punti casuali">
                    🎲 Random
                  </button>
                  <button
                    className="btn-join"
                    disabled={remaining !== 0}
                    onClick={() => {
                      setCharPreview(prev => ({ ...prev, stats: { ...pendingStats } }));
                      setLoadoutPhase("rolling");
                    }}
                  >
                    {remaining > 0 ? `Mancano ${remaining} punti` : remaining < 0 ? "Troppi punti" : "Continua →"}
                  </button>
                </div>
                <button className="btn-cancel-loadout" style={{ marginTop: 12 }} onClick={cancelLoadout}>
                  Annulla
                </button>
              </div>
            );
          })()}

          {/* ── Fase ROLLING: tiro HP ── */}
          {loadoutPhase === "rolling" && charPreview && (() => {
            const { count, sides } = getHpDice(charPreview.class, charPreview.classLevels);
            return (
              <div className="hp-roll-panel">
                <div className="loadout-char-preview" style={{ justifyContent: "center", marginBottom: 20 }}>
                  {charPreview.image && (
                    <img src={charPreview.image} alt={charPreview.name} className="loadout-avatar" />
                  )}
                  <div>
                    <div className="loadout-char-name">{charPreview.name}</div>
                    <div className="loadout-char-class">{charPreview.class}{(() => { const d = pendingSubclass && getSubclassDef(getClassKey(charPreview.class), pendingSubclass); return d ? ` · ${d.icon} ${d.name}` : ""; })()}</div>
                  </div>
                </div>

                <div className="hp-roll-title">Punti Vita</div>
                <div className="hp-dice-formula">{count}d{sides}{charPreview.stats.con > 0 ? ` + ${charPreview.stats.con * count} (COS)` : ""}</div>

                {!charPreview.rolledHp ? (
                  <button className="btn-roll-hp" onClick={rollHp}>
                    🎲 Tira {count}d{sides}
                  </button>
                ) : (
                  <div className="hp-roll-result-wrap">
                    <div className="hp-rolled-result">
                      <span className="hp-result-number">{charPreview.rolledHp}</span>
                      <span className="hp-result-label">punti vita</span>
                    </div>
                    <div className="hp-roll-buttons">
                      <button className="btn-reroll" onClick={rollHp} disabled={(charPreview.hpRerollCount || 0) >= 2}>↺ Ritira {(charPreview.hpRerollCount || 0) >= 2 ? "(esaurito)" : `(${2 - (charPreview.hpRerollCount || 0)} rimanenti)`}</button>
                      <button className="btn-join" onClick={() => { setLoadoutTab("weapons"); setLoadoutPhase("selecting"); }}>
                        Continua →
                      </button>
                    </div>
                  </div>
                )}
                <button className="btn-cancel-loadout" style={{ marginTop: 18 }} onClick={cancelLoadout}>
                  Annulla
                </button>
              </div>
            );
          })()}

          {/* ── Fase SELECTING: equipaggiamento ── */}
          {loadoutPhase === "selecting" && charPreview && (() => {
            const rawConfig    = getLoadoutConfig(charPreview.class, charPreview.classLevels?.[getClassKey(charPreview.class)]);
            // Bottega settimanale (solo torneo): acquisti disponibili, raggruppati
            // per categoria e mostrati come opzioni OPT-IN nella tab pertinente
            // (armi→Armi, spell→Magie, oggetti→Oggetti, armature→Difesa, pet→Oggetti).
            const weeklyPurchases = (loadoutContext === "tournament"
              && charPreview.arenaWeekly?.weekKey === currentWeekKey())
              ? (charPreview.arenaWeekly.purchases || []) : [];
            const marketByCat  = { weapon: [], spell: [], item: [], armor: [], pet: [] };
            weeklyPurchases.forEach(p => { if (marketByCat[p.category]) marketByCat[p.category].push(p); });
            const marketSel     = new Set(Object.keys(pendingMarketSel).filter(k => pendingMarketSel[k]));
            // Spell slot persi dagli scroll EQUIPAGGIATI → limiti spell di classe effettivi.
            const scrollLoss   = scrollSlotLossFor(weeklyPurchases, pendingMarketSel);
            const config       = applySlotLoss(rawConfig, scrollLoss);
            const marketGear    = loadoutContext === "tournament" ? resolveMarketGear(charPreview.arenaWeekly, marketSel) : null;
            // ── Conteggio COMBINATO: gli acquisti della Bottega EQUIPAGGIATI contano come
            // armi/oggetti VERI (occupano gli slot, rispettano le regole due-mani), NON in
            // aggiunta al kit di classe. Vedi marketPickBlocked + toggleMarketWeapon. ──
            const _mw2HMelee = (pu) => !!pu.payload?.twoHanded && !pu.payload?.ranged;
            const _selMarketWeapons = marketByCat.weapon.filter(pu => pendingMarketSel[pu.itemId]);
            const _selMarketItems   = marketByCat.item.filter(pu => pendingMarketSel[pu.itemId]);
            const totalWeapons    = pendingWeapons.length + _selMarketWeapons.length;
            const has2HMelee_all  = pendingWeapons.some(IS_TWO_HANDED_MELEE) || _selMarketWeapons.some(_mw2HMelee);
            const hasAny2H_all    = pendingWeapons.some(w => w.twoHanded)     || _selMarketWeapons.some(pu => !!pu.payload?.twoHanded);
            const classItemsCount = Object.values(pendingItemCounts).reduce((a, b) => a + b, 0);
            const totalItemsAll   = classItemsCount + _selMarketItems.length;
            // Un acquisto è BLOCCATO (non selezionabile) se violerebbe gli slot: armi oltre
            // il massimo / seconda arma a due mani / terzo oggetto. null = selezionabile.
            const marketPickBlocked = (pu) => {
              if (pendingMarketSel[pu.itemId]) return null; // deselezionare è sempre ok
              if (pu.category === "weapon") {
                if (_mw2HMelee(pu)) return null;            // 2H mischia: sostituisce tutto
                if (has2HMelee_all) return "Hai già un'arma a due mani da mischia";
                if (pu.payload?.twoHanded) return hasAny2H_all ? "Una sola arma a due mani" : (totalWeapons >= config.maxWeapons ? "Slot armi pieni" : null);
                return totalWeapons >= config.maxWeapons ? "Slot armi pieni" : null;
              }
              if (pu.category === "item") return totalItemsAll >= 2 ? "Hai già 2 oggetti" : null;
              return null;
            };
            // Card opt-in della Bottega (colore viola) per una categoria: riusata in ogni tab.
            const toggleMarket = (id) => setPendingMarketSel(prev => ({ ...prev, [id]: !prev[id] }));
            // Arma della Bottega: conta come arma vera. Una 2H da mischia è esclusiva →
            // azzera le armi di classe e le altre armi comprate.
            const toggleMarketWeapon = (pu) => {
              const turningOn = !pendingMarketSel[pu.itemId];
              if (turningOn && _mw2HMelee(pu)) {
                setPendingWeapons([]);
                setPendingMarketSel(prev => {
                  const next = { ...prev };
                  marketByCat.weapon.forEach(w => { next[w.itemId] = false; });
                  next[pu.itemId] = true;
                  return next;
                });
                return;
              }
              toggleMarket(pu.itemId);
            };
            // Toggle di uno SCROLL: dopo aver cambiato la selezione, ricalcola gli slot
            // persi e taglia le spell di classe in eccesso (limiti = base ridotti).
            const toggleMarketScroll = (pu) => {
              const nextSel = { ...pendingMarketSel, [pu.itemId]: !pendingMarketSel[pu.itemId] };
              const loss = scrollSlotLossFor(weeklyPurchases, nextSel);
              const newLimits = applySlotLoss(rawConfig, loss).spellLimits;
              setPendingSpells(spells => trimSpellsToLimits(spells, newLimits));
              setPendingMarketSel(nextSel);
            };
            // Armatura della Bottega: CA fissa ed ESCLUSIVA (una sola, e disattiva
            // le armature base). Equipaggiarla libera l'armatura base e lo scudo.
            const marketFixedAc = marketGear?.fixedAc ?? null;
            const hasMarketArmor = marketFixedAc != null;
            const toggleMarketArmor = (pu) => {
              const turningOn = !pendingMarketSel[pu.itemId];
              setPendingMarketSel(prev => {
                const next = { ...prev };
                marketByCat.armor.forEach(a => { next[a.itemId] = false; }); // esclusività
                next[pu.itemId] = turningOn;
                return next;
              });
              if (turningOn) { setPendingArmor(null); setPendingShield(null); }
            };
            const renderMarketCards = (cat, title, verb) => {
              const list = marketByCat[cat] || [];
              if (!list.length) return null;
              const isScrollCat = cat === "spell";
              return (
                <>
                  <div className="loadout-section-title loadout-market-head" style={{ marginTop: 16 }}>🛒 {title}</div>
                  <div className="loadout-section-hint">{isScrollCat
                    ? <>Spell scroll comprati — <strong>tocca per equipaggiarlo</strong>. Attenzione: ogni scroll può <strong>togliere spell slot di classe</strong> (indicato sulla carta).</>
                    : <>Acquisti della settimana — <strong>tocca per {verb}</strong> (facoltativo, in aggiunta al kit di classe). Le carte <strong>viola</strong> sono le tue della Bottega.</>}
                  </div>
                  <div className="loadout-grid">
                    {list.map(pu => {
                      const isSel = !!pendingMarketSel[pu.itemId];
                      const qty = pu.qty || 1;
                      // Requisito di caratteristica (solo scroll): il punteggio del
                      // player in quella stat deve essere ≥ al minimo richiesto.
                      const reqStat = isScrollCat ? pu.payload?.castStat : null;
                      const reqMin  = isScrollCat ? (pu.payload?.castStatMin || 0) : 0;
                      const playerStatVal = reqStat ? (charPreview.stats?.[reqStat] ?? 0) : 0;
                      const statLocked = reqMin > 0 && !isSel && playerStatVal < reqMin;
                      // Blocco per slot (armi/oggetti): non selezionabile se sfora i limiti.
                      const slotBlock  = marketPickBlocked(pu);
                      const locked     = statLocked || (!isSel && !!slotBlock);
                      const onPick = () => {
                        if (locked) return;
                        if (isScrollCat) toggleMarketScroll(pu);
                        else if (pu.category === "weapon") toggleMarketWeapon(pu);
                        else toggleMarket(pu.itemId);
                      };
                      return (
                        <button
                          key={pu.itemId}
                          type="button"
                          disabled={locked}
                          className={`loadout-item market-pick ${isSel ? "selected" : ""} ${locked ? "disabled" : ""}`}
                          onClick={onPick}
                        >
                          <span className="loadout-item-icon">{pu.icon}</span>
                          <span className="loadout-item-name">{pu.name}{qty > 1 ? ` ×${qty}` : ""}</span>
                          <span className="loadout-item-damage">{describeMarketPurchase(pu)}</span>
                          <span className="loadout-item-info">{statLocked
                            ? `🔒 Richiede ${SAVE_LABEL[reqStat] || (reqStat || "").toUpperCase()} ≥ ${reqMin} (tu ${playerStatVal >= 0 ? "+" : ""}${playerStatVal})`
                            : (!isSel && slotBlock) ? `🔒 ${slotBlock}`
                            : isSel ? "✓ Equipaggiato" : "Tocca per usarlo"}</span>
                          {isSel && <span className="loadout-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            };
            const isRanger     = isRangerClass((charPreview.class || "").toLowerCase());
            const isWarlock    = isWarlockClass((charPreview.class || "").toLowerCase());
            const isArtificer  = isArtificerClass((charPreview.class || "").toLowerCase());
            const petReady     = !isRanger || !!pendingPet;
            const demonReady   = !isWarlock || !!pendingDemon;
            const constructReady = !isArtificer || !!pendingConstruct;
            // Serve almeno un'arma; il massimo (config.maxWeapons) è un tetto COMBINATO
            // (armi di classe + armi comprate equipaggiate). Gli oggetti comprati contano
            // negli stessi 2 slot degli oggetti (totalItemsAll).
            const weaponsLeft  = totalWeapons >= 1 ? 0 : 1;
            const spellsLeft   = config.maxSpells  - pendingSpells.length;
            const armorReady   = !!pendingArmor || hasMarketArmor;
            const totalItems   = totalItemsAll;
            const isReady      = weaponsLeft === 0 && totalWeapons <= config.maxWeapons && spellsLeft === 0 && armorReady && totalItems >= 1 && totalItems <= 2 && petReady && demonReady && constructReady;
            const btnParts     = [];
            if (weaponsLeft > 0) btnParts.push(`${weaponsLeft} arm${weaponsLeft === 1 ? "a" : "i"}`);
            if (spellsLeft  > 0) btnParts.push(`${spellsLeft} incantesim${spellsLeft === 1 ? "o" : "i"}`);
            if (!armorReady)     btnParts.push("1 armatura");
            if (totalItems < 1)  btnParts.push("1 oggetto");
            if (!petReady)       btnParts.push("1 compagno animale");
            if (!demonReady)     btnParts.push("1 demone");
            if (!constructReady) btnParts.push("1 costrutto");

            // Calcolo CA anteprima
            const dexMod   = charPreview.stats.dex ?? 0;
            const conMod   = charPreview.stats.con ?? 0;
            // Armatura market = CA fissa (ignora DES) + 1 dello scudo; altrimenti calcolo normale.
            // Sottoclasse posseduta per questa classe (solo torneo) e quella accesa ora.
            const subOptions   = selectableSubclasses(loadoutContext, charPreview.arenaWeekly, charPreview.class);
            const activeSubDef = subOptions.find(o => o.key === pendingSubclass) || null;
            const previewAc = hasMarketArmor
              ? marketFixedAc + (pendingShield ? 1 : 0)
              : (pendingArmor
                ? pendingArmor.unarmoredDefense
                  ? pendingArmor.unarmoredMaxStat
                    ? 10 + Math.max(dexMod, conMod) + (pendingShield ? 1 : 0)
                    : 10 + dexMod + (pendingArmor.unarmoredStat ? (charPreview.stats[pendingArmor.unarmoredStat] ?? 0) : conMod) + (pendingShield ? 1 : 0)
                  : pendingArmor.baseAc + Math.max(0, Math.min(dexMod, pendingArmor.maxDex)) + (pendingShield ? 1 : 0)
                : charPreview.stats.ac) + (hasMarketArmor || pendingArmor ? (activeSubDef?.effect?.ca || 0) : 0);

            // Scudo disabilitato se c'è un'arma a 2 mani selezionata (di classe o comprata)
            const has2HWeapon  = hasAny2H_all;
            const shieldLocked = has2HWeapon;

            // ── Struttura a TAB: una categoria per scheda, niente scroll infinito ──
            // La tab Magie appare anche se la classe non è caster ma ha spell comprate in Bottega.
            const hasMagic     = config.spellOptions.length > 0 || (config.skillOptions?.length > 0) || marketByCat.spell.length > 0;
            const hasCompanion = isRanger || isWarlock || isArtificer;
            const companionMeta = isRanger
              ? { icon: "🐾", label: "Compagno", done: petReady }
              : isWarlock
              ? { icon: "👁", label: "Demone", done: demonReady }
              : { icon: "🤖", label: "Costrutto", done: constructReady };
            // Titolo: scelta in autonomia, solo all'iscrizione al torneo e solo se ne possiede.
            const ownedTitles  = (charPreview.arenaTitles || []).filter(k => ARENA_TITLES[k]);
            const showTitleTab = loadoutContext === "tournament" && ownedTitles.length > 0;
            const LOADOUT_TABS = [
              { key: "weapons", icon: "⚔", label: config.maxWeapons === 1 ? "Arma" : "Armi", count: `${totalWeapons}/${config.maxWeapons}`, done: weaponsLeft === 0 },
              ...(hasMagic ? [{ key: "magic", icon: "✨", label: (config.spellOptions.length > 0 || marketByCat.spell.length > 0) ? "Magie" : "Abilità", count: config.spellOptions.length > 0 ? `${pendingSpells.length}/${config.maxSpells}` : null, done: spellsLeft === 0 }] : []),
              { key: "armor", icon: "🛡", label: "Difesa", count: (pendingArmor || hasMarketArmor) ? "✓" : null, done: armorReady },
              ...(hasCompanion ? [{ key: "companion", icon: companionMeta.icon, label: companionMeta.label, count: companionMeta.done ? "✓" : null, done: companionMeta.done }] : []),
              { key: "items", icon: "🎒", label: "Oggetti", count: `${totalItems}/2`, done: totalItems >= 1 },
              ...(showTitleTab ? [{ key: "title", icon: "♛", label: "Titolo", count: pendingTitle ? "✓" : null, done: true }] : []),
            ];
            const activeTab = LOADOUT_TABS.some(t => t.key === loadoutTab) ? loadoutTab : LOADOUT_TABS[0].key;
            const firstIncompleteTab = (LOADOUT_TABS.find(t => !t.done) || LOADOUT_TABS[0]).key;
            const footerBtnText = isReady
              ? (reloadoutMode ? "✓ Conferma nuovo assetto" : "✓ Invia Iscrizione")
              : activeTab === firstIncompleteTab
              ? `Mancano: ${btnParts.join(" + ")}`
              : "Vai alla sezione mancante →";

            return (
              <div className={`loadout-panel loadout-panel--tabbed${reloadoutMode ? " loadout-panel--reloadout" : ""}`}>
                {/* ── Banner RI-EQUIPAGGIAMENTO: chiarisce cosa è bloccato e cosa no ── */}
                {reloadoutMode && (
                  <div className="reloadout-banner">
                    <div className="reloadout-banner-head">
                      <span className="reloadout-banner-tag">⚙ Ri-equipaggiamento tra i round</span>
                      {arenaMeta?.shopEndsAt && <TimerDisplay expiryDate={arenaMeta.shopEndsAt} />}
                    </div>
                    <p className="reloadout-banner-txt">
                      Prepara l'assetto per il <strong>prossimo round</strong>. Cambia pure
                      {" "}<strong>armi, incantesimi, armatura, compagno e oggetti</strong> — e attiva i nuovi acquisti della Bottega.
                      Trovi già selezionato il tuo assetto attuale: cambia solo quello che vuoi. Quello che confermi
                      {" "}<strong>resta per tutti i prossimi round</strong>.
                    </p>
                    <p className="reloadout-banner-lock">
                      🔒 Restano bloccati dal torneo: <strong>classe</strong>, <strong>caratteristiche</strong> e <strong>HP</strong>. Non puoi cambiare classe a torneo iniziato.
                    </p>
                  </div>
                )}
                {/* Anteprima personaggio — intestazione verticale a tutta larghezza */}
                <div className="loadout-char-preview loadout-char-preview--top">
                  {charPreview.image && (
                    <img src={charPreview.image} alt={charPreview.name} className="loadout-avatar" />
                  )}
                  <div>
                    <div className="loadout-char-name">{charPreview.name}</div>
                    <div className="loadout-char-class">{charPreview.class}{activeSubDef ? ` · ${activeSubDef.icon} ${activeSubDef.name}` : ""}</div>
                    <div className="loadout-char-stats">
                      ❤ <strong>{charPreview.rolledHp}</strong> HP · 🛡 CA <strong className={activeSubDef?.effect?.ca && (hasMarketArmor || pendingArmor) ? "stat-buff" : undefined} title={activeSubDef?.effect?.ca && (hasMarketArmor || pendingArmor) ? `+${activeSubDef.effect.ca} da ${activeSubDef.name}` : undefined}>{previewAc}{activeSubDef?.effect?.ca && (hasMarketArmor || pendingArmor) ? ` (+${activeSubDef.effect.ca})` : ""}</strong>
                      {[["str","FOR"],["dex","DES"],["con","COS"],["int","INT"],["wis","SAG"],["cha","CAR"]].map(([k,lbl]) => {
                        const v = charPreview.stats[k] ?? 0;
                        return <span key={k}> · {lbl} {v >= 0 ? "+" : ""}{v}</span>;
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Sottoclasse della Bottega: base o archetipo (solo torneo) ── */}
                {subOptions.length > 0 && (
                  <div className="loadout-subclass">
                    <div className="loadout-subclass-t">{loadoutContext === "fun" ? "🎓 Sottoclasse · nelle Sfide Libere sono tutte sbloccate" : "🎓 Sottoclasse della settimana"}</div>
                    <div className="loadout-subclass-scelte">
                      <button type="button" aria-pressed={!activeSubDef}
                        className={`loadout-subclass-btn${!activeSubDef ? " is-on" : ""}`}
                        onClick={() => setPendingSubclass(null)}>
                        <span className="loadout-subclass-ico" aria-hidden="true">{CLASS_ICONS[(charPreview.class || "").toLowerCase()] || "✦"}</span>
                        <span><b>{CLASS_IT[charPreview.class] || charPreview.class} base</b><small>Il kit di classe, senza archetipo.</small></span>
                      </button>
                      {subOptions.map(o => (
                        <button key={o.key} type="button" aria-pressed={activeSubDef?.key === o.key}
                          className={`loadout-subclass-btn${activeSubDef?.key === o.key ? " is-on" : ""}`}
                          onClick={() => setPendingSubclass(o.key)}>
                          <span className="loadout-subclass-ico" aria-hidden="true">{o.icon}</span>
                          <span><b>{o.name}</b><small>{o.desc}</small></span>
                        </button>
                      ))}
                    </div>
                    {activeSubDef && (
                      <ul className="loadout-subclass-azioni">
                        {activeSubDef.actions.map(a => (
                          <li key={a.name}><span aria-hidden="true">{a.icon}</span> <b>{a.name}</b> — {a.info}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* ── Barra TAB: naviga tra le categorie senza scorrere ── */}
                <div className="loadout-tabs" role="tablist">
                  {LOADOUT_TABS.map(t => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === t.key}
                      className={`loadout-tab ${activeTab === t.key ? "active" : ""} ${t.done ? "done" : ""}`}
                      onClick={() => setLoadoutTab(t.key)}
                    >
                      <span className="loadout-tab-icon">{t.icon}</span>
                      <span className="loadout-tab-label">{t.label}</span>
                      {t.count && <span className="loadout-tab-count">{t.count}</span>}
                      <span className="loadout-tab-status">{t.done ? "✓" : "•"}</span>
                    </button>
                  ))}
                </div>

                {/* ── Corpo del tab attivo ── */}
                <div className="loadout-tab-body">

                {/* Sezione Armi */}
                {activeTab === "weapons" && (<>
                <div className="loadout-section-title">
                  ⚔ {config.maxWeapons === 1 ? "Arma" : "Armi"} — {totalWeapons}/{config.maxWeapons}
                </div>
                <div className="loadout-section-hint">✨ In <strong>verde</strong> le armi più adatte alla classe (usano la sua caratteristica principale).{config.maxWeapons > 1 && <> Basta <strong>almeno un'arma</strong> per proseguire (massimo {config.maxWeapons}, <strong>incluse le armi comprate</strong>). Un'arma <strong>a due mani da mischia</strong> occupa entrambe le mani (è l'unica impugnabile); una <strong>a distanza</strong> (arco/balestra) può essere affiancata da una sola arma a una mano.</>}</div>
                <div className="loadout-grid">
                  {(() => {
                    const keyStats = ARENA_KEY_STATS[getClassKey(charPreview.class)] || [];
                    return config.weaponOptions.map(item => {
                      const isSelected = pendingWeapons.some(a => a.name === item.name);
                      const is2HMeleeItem = IS_TWO_HANDED_MELEE(item);
                      // 2H mischia: sempre selezionabile (sostituisce tutto). Altrimenti blocca
                      // se c'è una 2H mischia, una seconda 2H, o gli slot COMBINATI sono pieni.
                      const isDisabled = !isSelected && !is2HMeleeItem && (
                        has2HMelee_all
                        || (item.twoHanded ? hasAny2H_all
                                           : totalWeapons >= config.maxWeapons)
                      );
                      const isOptimal = !!item.statKey && keyStats.includes(item.statKey);
                      return (
                      <button
                        key={item.name}
                        className={`loadout-item weapon ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""} ${isOptimal ? "optimal" : ""}`}
                        onClick={() => {
                          if (isDisabled) return;
                          // 2H mischia: esclusiva anche verso le armi comprate → azzerale.
                          if (is2HMeleeItem && !isSelected) {
                            setPendingMarketSel(prev => {
                              const next = { ...prev };
                              marketByCat.weapon.forEach(pu => { next[pu.itemId] = false; });
                              return next;
                            });
                          }
                          toggleWeapon(item, config.maxWeapons);
                        }}
                      >
                        {isOptimal && <span className="loadout-optimal-tag" title="Arma adatta alla classe">★</span>}
                        <span className="loadout-item-icon">{item.icon}</span>
                        <span className="loadout-item-name">{item.name}</span>
                        <span className="loadout-item-damage">
                          {item.damage}{item.statKey ? ` +${item.statKey.toUpperCase()}` : ""}
                        </span>
                        {item.damageType && <span className={`loadout-item-dmgtype dt-${item.damageType}`}>{item.damageType}</span>}
                        {item.twoHanded && <span className="loadout-item-info">2 mani</span>}
                        {item.info && !item.twoHanded && <span className="loadout-item-info">{item.info}</span>}
                        {isSelected && <span className="loadout-check">✓</span>}
                      </button>
                      );
                    });
                  })()}
                </div>
                {renderMarketCards("weapon", "Armi della Bottega", "impugnarla")}
                </>)}

                {/* ── TAB MAGIE: Incantesimi + Abilità ── */}
                {activeTab === "magic" && (<>
                {Object.keys(scrollLoss).length > 0 && config.spellOptions.length > 0 && (
                  <div className="loadout-market-penalty">
                    📜 Scroll equipaggiati: stai rinunciando a {Object.entries(scrollLoss).filter(([, n]) => n > 0)
                      .map(([l, n]) => `${n} slot di Livello ${l}`).join(" · ")}.
                    Gli incantesimi di <strong>classe</strong> selezionabili qui sotto sono già aggiornati.
                  </div>
                )}
                {/* Sezione Incantesimi — raggruppati per livello */}
                {config.spellOptions.length > 0 && (() => {
                  const LEVEL_LABELS = { 0: "Trucchetti", 1: "Livello 1", 2: "Livello 2", 3: "Livello 3", 4: "Livello 4", 5: "Livello 5", 6: "Livello 6", 7: "Livello 7", 8: "Livello 8", 9: "Livello 9" };
                  const presentLevels = [...new Set(config.spellOptions.map(s => s.level ?? 0))].sort((a, b) => a - b);
                  return (
                    <>
                      <div className="loadout-section-title">
                        ✨ Incantesimi — {pendingSpells.length}/{config.maxSpells}
                      </div>
                      {presentLevels.map(lvl => {
                        const spellsOfLevel = config.spellOptions.filter(s => (s.level ?? 0) === lvl);
                        const limit = config.spellLimits?.[lvl] ?? 0;
                        // Tier 3+ resta bloccato finché il livello non ne concede il limite (Mago/Stregone dal Lv5).
                        const isLocked = lvl >= 3 && limit <= 0;
                        const selectedAtLevel = pendingSpells.filter(s => (s.level ?? 0) === lvl).length;
                        return (
                          <div key={lvl} className={`spell-level-group lv${lvl}${isLocked ? " locked-level" : ""}`}>
                            <div className="spell-level-header">
                              {isLocked
                                ? <><span className="spell-level-lock">🔒</span>{LEVEL_LABELS[lvl]} <span className="spell-level-locked-note">— Si sblocca al Lv.5</span></>
                                : lvl > 0 && config.spellLimits?.nonCantripMax != null
                                  ? <><span className={`spell-level-badge lv${lvl}`}>{LEVEL_LABELS[lvl]}</span><span className="spell-level-count">{pendingSpells.filter(s => (s.level ?? 0) > 0).length}/{config.spellLimits.nonCantripMax} slot totali</span></>
                                  : <><span className={`spell-level-badge lv${lvl}`}>{LEVEL_LABELS[lvl]}</span><span className="spell-level-count">{selectedAtLevel}/{limit}</span></>
                              }
                            </div>
                            <div className="loadout-grid">
                              {spellsOfLevel.map(item => {
                                const isSelected = pendingSpells.some(a => a.name === item.name);
                                const atLevelLimit = !isSelected && selectedAtLevel >= limit;
                                const nonCantripBudgetFull = !isSelected && lvl > 0 && config.spellLimits?.nonCantripMax != null
                                  && pendingSpells.filter(s => (s.level ?? 0) > 0).length >= config.spellLimits.nonCantripMax;
                                const isDisabled = isLocked || atLevelLimit || nonCantripBudgetFull;
                                return (
                                  <button
                                    key={item.name}
                                    className={`loadout-item spell lv${item.level ?? 0} ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""} ${isLocked ? "spell-locked" : ""}`}
                                    onClick={() => toggleSpell(item, config.spellLimits)}
                                  >
                                    {isLocked && <span className="loadout-lock-icon">🔒</span>}
                                    <span className="loadout-item-icon">{item.icon}</span>
                                    <span className="loadout-item-name">{item.name}</span>
                                    <span className="loadout-item-damage">{item.damage}</span>
                                    {!isLocked && usesSharedSpellSlots(charPreview)
                                      ? <span className="spell-uses-tag">{(item.level ?? 0) === 0 ? "∞ illimitato" : `${SORC_SLOTS_MAX} slot condivisi`}</span>
                                      : item.maxUses && !isLocked && <span className="spell-uses-tag">{item.maxUses} usi</span>}
                                    {item.info && <span className="loadout-item-info">{item.info}</span>}
                                    {isSaveDamageSpell(item) && <span className="loadout-item-info">{spellMechanicTag(item)}</span>}
                                    {isSelected && <span className="loadout-check">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}

                {/* Sezione Abilità (Scudo caster) */}
                {config.skillOptions?.length > 0 && (
                  <>
                    <div className="loadout-section-title">
                      ⚡ Abilità — {pendingSkills.length}/{config.maxSkills} <span className="loadout-optional">(opzionale)</span>
                    </div>
                    <div className="loadout-grid">
                      {config.skillOptions.map(item => {
                        const isSelected = pendingSkills.some(a => a.name === item.name);
                        return (
                          <button
                            key={item.name}
                            className={`loadout-item spell ${isSelected ? "selected" : ""}`}
                            onClick={() => toggleSkill(item, config.maxSkills)}
                          >
                            <span className="loadout-item-icon">{item.icon}</span>
                            <span className="loadout-item-name">{item.name}</span>
                            <span className="loadout-item-damage">{item.info}</span>
                            {isSelected && <span className="loadout-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                {renderMarketCards("spell", "Incantesimi della Bottega", "lanciarlo")}
                </>)}

                {/* Abilità automatiche (Smite Paladino) — incluse nel tab Armi */}
                {activeTab === "weapons" && config.autoActions.filter(a => !a.requiresBuff || ((charPreview.arenaBuffs || {})[a.requiresBuff] ?? 0) > 0).length > 0 && (
                  <div className="loadout-auto-block">
                    <div className="loadout-section-title">⚡ Abilità Speciali (incluse automaticamente)</div>
                    {config.autoActions.filter(a => !a.requiresBuff || ((charPreview.arenaBuffs || {})[a.requiresBuff] ?? 0) > 0).map(a => (
                      <div key={a.name} className="loadout-auto-tag">
                        <span className="loadout-auto-icon">{a.icon}</span>
                        <span className="loadout-auto-name">{a.name}</span>
                        <span className="loadout-auto-dmg">{a.damage}{a.statKey ? ` +${a.statKey.toUpperCase()}` : ""}</span>
                        {a.info && <span className="loadout-auto-info">{a.info}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── TAB DIFESA: Armatura + Scudo + Forma Selvatica ── */}
                {activeTab === "armor" && (<>
                {/* ── Sezione Armatura ── */}
                <div className="loadout-section-title">
                  🛡 Armatura — {hasMarketArmor ? "✓ Armatura della Bottega (CA fissa)" : pendingArmor ? `✓ ${pendingArmor.name}` : "nessuna selezionata"}
                </div>
                {hasMarketArmor && (
                  <div className="loadout-section-hint">Hai equipaggiato un'<strong>armatura della Bottega</strong> (CA fissa): le armature base sono disattivate. Deselezionala qui sotto per riabilitarle.</div>
                )}
                <div className="loadout-grid armor-grid">
                  {(ARENA_ARMORS[config.armorCategory] || []).map(armor => {
                    const isSelected = pendingArmor?.name === armor.name;
                    const dex = charPreview.stats.dex ?? 0;
                    const con = charPreview.stats.con ?? 0;
                    const dexContrib = Math.max(0, Math.min(dex, armor.maxDex));
                    const acPreview = armor.unarmoredDefense
                      ? armor.unarmoredMaxStat ? 10 + Math.max(dex, con) : 10 + dex + (armor.unarmoredStat ? (charPreview.stats[armor.unarmoredStat] ?? 0) : con)
                      : armor.baseAc + dexContrib;
                    const hasHitPenalty = armor.hitPenalty < 0;
                    // Nota elementale (resistenze/debolezze) coerente col motore.
                    const elemNote = armor.maxDex === 0
                      ? { t: "⚡ debole a fulmine/tuono", c: "weak" }
                      : armor.unarmoredDefense
                      ? { t: "⚡ +1 iniziativa", c: "good" }
                      : armor.maxDex === 99
                      ? { t: "🔥 rischio Bruciatura", c: "weak" }
                      : null;
                    return (
                      <button
                        key={armor.name}
                        disabled={hasMarketArmor}
                        title={armor.info}
                        className={`loadout-item armor ${isSelected ? "selected" : ""} ${hasMarketArmor ? "disabled" : ""}`}
                        onClick={() => { setPendingArmor(armor); if (shieldLocked) setPendingShield(null); }}
                      >
                        <span className="loadout-item-icon">{armor.icon}</span>
                        <span className="loadout-item-name">{armor.name}</span>
                        <span className="loadout-item-damage">
                          CA {acPreview}
                          {armor.maxDex === 0
                            ? <span className="armor-no-dex"> (no DES)</span>
                            : armor.maxDex < 99
                            ? <span className="armor-dex-cap"> (+DES max {armor.maxDex})</span>
                            : <span className="armor-dex-cap"> (+DES {dex >= 0 ? "+" : ""}{dex})</span>}
                        </span>
                        {hasHitPenalty && (
                          <span className="armor-hit-penalty">⚔ attacco {armor.hitPenalty}</span>
                        )}
                        {elemNote && (
                          <span className={`armor-elem-note armor-elem-${elemNote.c}`}>{elemNote.t}</span>
                        )}
                        {isSelected && <span className="loadout-check">✓</span>}
                      </button>
                    );
                  })}
                </div>

                {/* ── Scudo (classi idonee) ── */}
                {config.canHaveShield && (
                  <div className="loadout-shield-row">
                    {/* Scudo di Legno — disponibile a tutte le classi con scudo */}
                    <button
                      className={`loadout-shield-btn ${pendingShield === "legno" ? "selected" : ""} ${shieldLocked ? "disabled" : ""}`}
                      onClick={() => { if (!shieldLocked) setPendingShield(v => v === "legno" ? null : "legno"); }}
                      disabled={shieldLocked}
                    >
                      🪵 Scudo di Legno {pendingShield === "legno" ? "✓ (+1 CA)" : "— +1 CA"}
                    </button>
                    {/* Scudo di Metallo — non disponibile per il Druido */}
                    {config.canHaveShield !== "wood" && (
                      <button
                        className={`loadout-shield-btn ${pendingShield === "metallo" ? "selected" : ""} ${shieldLocked ? "disabled" : ""}`}
                        onClick={() => { if (!shieldLocked) setPendingShield(v => v === "metallo" ? null : "metallo"); }}
                        disabled={shieldLocked}
                      >
                        🛡 Scudo di Metallo {pendingShield === "metallo" ? "✓ (+1 CA)" : "— +1 CA"}
                      </button>
                    )}
                    {shieldLocked && <small className="shield-locked-note">incompatibile — arma a 2 mani</small>}
                  </div>
                )}
                {config.canHaveShield && (
                  <p className="shield-caster-warning">
                    ⚠ <strong>Caster:</strong> con lo scudo i tuoi <strong>incantesimi da danno</strong> sono ostacolati — tiri <strong>a svantaggio</strong> e i nemici fanno il <strong>TS a vantaggio</strong> (controllo escluso).
                  </p>
                )}

                {/* Forma Selvatica (Druid) */}
                {config.hasWildShape && (
                  <div className="loadout-wild-note">
                    🐾 Avrai accesso alla <strong>Forma Selvatica</strong> durante il combattimento.
                  </div>
                )}
                {marketByCat.armor.length > 0 && (<>
                  <div className="loadout-section-title loadout-market-head" style={{ marginTop: 16 }}>🛒 Armature della Bottega</div>
                  <div className="loadout-section-hint">Hanno una <strong>CA fissa</strong> e <strong>sostituiscono</strong> l'armatura base (che si disattiva). Una sola alla volta.</div>
                  <div className="loadout-grid armor-grid">
                    {marketByCat.armor.map(pu => {
                      const isSel = !!pendingMarketSel[pu.itemId];
                      const fx = pu.payload?.acFixed ?? pu.payload?.acBonus ?? 0;
                      return (
                        <button
                          key={pu.itemId}
                          type="button"
                          className={`loadout-item armor market-pick ${isSel ? "selected" : ""}`}
                          onClick={() => toggleMarketArmor(pu)}
                        >
                          <span className="loadout-item-icon">{pu.icon}</span>
                          <span className="loadout-item-name">{pu.name}</span>
                          <span className="loadout-item-damage">CA <strong>{fx}</strong> fissa</span>
                          <span className="loadout-item-info">{isSel ? "✓ Indossata" : "Tocca per indossarla"}</span>
                          {isSel && <span className="loadout-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </>)}
                </>)}

                {/* ── TAB ALLEATO: Compagno / Demone / Costrutto ── */}
                {activeTab === "companion" && (<>
                {/* Compagno Animale (Ranger) */}
                {isRanger && (() => {
                  const ownedBuffs = charPreview.arenaBuffs || {};
                  const availablePets = Object.values(RANGER_PETS).filter(pet => !pet.requiresBuff || (ownedBuffs[pet.requiresBuff] ?? 0) > 0);
                  return (
                    <>
                      <div className="loadout-section-title">
                        🐾 Compagno Animale — {pendingPet ? "1/1" : "0/1"}
                      </div>
                      <div className="loadout-grid">
                        {availablePets.map(pet => {
                          const isSelected = pendingPet === pet.key;
                          return (
                            <button
                              key={pet.key}
                              className={`loadout-item ${isSelected ? "selected" : ""}`}
                              onClick={() => setPendingPet(isSelected ? null : pet.key)}
                            >
                              <span className="loadout-item-icon">{pet.icon}</span>
                              <span className="loadout-item-name">{pet.name}</span>
                              <span className="loadout-item-info">{pet.info}</span>
                              {isSelected && <span className="loadout-check">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

                {/* Demone Evocato (Warlock) */}
                {isWarlock && (
                  <>
                    <div className="loadout-section-title">
                      👁 Demone Evocato — {pendingDemon ? "1/1" : "0/1"}
                    </div>
                    <div className="loadout-grid">
                      {Object.values(WARLOCK_DEMONS).map(demon => {
                        const isSelected = pendingDemon === demon.key;
                        return (
                          <button
                            key={demon.key}
                            className={`loadout-item ${isSelected ? "selected" : ""}`}
                            onClick={() => setPendingDemon(isSelected ? null : demon.key)}
                          >
                            <span className="loadout-item-icon">{demon.icon}</span>
                            <span className="loadout-item-name">{demon.name}</span>
                            <span className="loadout-item-info">{demon.info}</span>
                            {isSelected && <span className="loadout-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Costrutto (Artefice) */}
                {isArtificerClass((charPreview.class || "").toLowerCase()) && (
                  <>
                    <div className="loadout-section-title">
                      🤖 Costrutto — {pendingConstruct ? "1/1" : "0/1"}
                    </div>
                    <div className="loadout-grid">
                      {Object.values(ARTIFICER_CONSTRUCTS).map(c => {
                        const isSelected = pendingConstruct === c.key;
                        return (
                          <button
                            key={c.key}
                            className={`loadout-item ${isSelected ? "selected" : ""}`}
                            onClick={() => setPendingConstruct(isSelected ? null : c.key)}
                          >
                            <span className="loadout-item-icon">{c.icon}</span>
                            <span className="loadout-item-name">{c.name}</span>
                            <span className="loadout-item-info">{c.info}</span>
                            {isSelected && <span className="loadout-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                </>)}

                {/* ── TAB OGGETTI ── */}
                {activeTab === "items" && (<>
                {/* ── Sezione Oggetti ── */}
                {(() => {
                  // Totale COMBINATO: oggetti di classe + oggetti comprati equipaggiati (max 2).
                  const totalItems = totalItemsAll;
                  return (
                    <>
                      <div className="loadout-section-title">
                        🎒 Oggetti — {totalItems}/2 <span className="loadout-optional">(fino a 2, inclusi quelli comprati)</span>
                      </div>
                      <div className="loadout-grid">
                        {ARENA_ITEMS.filter(item => !item.shopOnly).map(item => {
                          const count = pendingItemCounts[item.key] || 0;
                          const canAdd = totalItems < 2;
                          return (
                            <div key={item.key} className={`loadout-item item-slot ${count > 0 ? "selected" : ""} ${!canAdd && count === 0 ? "disabled" : ""}`}>
                              <span className="loadout-item-icon">{item.icon}</span>
                              <span className="loadout-item-name">{item.name}</span>
                              <span className="loadout-item-damage">{item.info}</span>
                              <div className="item-counter-row">
                                <button className="item-counter-btn" disabled={count === 0}
                                  onClick={() => setPendingItemCounts(prev => ({ ...prev, [item.key]: Math.max(0, (prev[item.key] || 0) - 1) }))}>−</button>
                                <span className="item-counter-val">{count}</span>
                                <button className="item-counter-btn" disabled={!canAdd}
                                  onClick={() => setPendingItemCounts(prev => ({ ...prev, [item.key]: Math.min(2, (prev[item.key] || 0) + 1) }))}>+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

                {renderMarketCards("item", "Oggetti della Bottega", "usarlo")}
                {renderMarketCards("pet", "Pet della Bottega", "evocarlo")}

                {/* Preview selezione */}
                {(pendingWeapons.length > 0 || pendingSpells.length > 0) && (
                  <div className="loadout-selected-preview">
                    {[...pendingWeapons, ...pendingSpells].map(a => (
                      <span key={a.name} className="loadout-selected-tag">
                        {a.icon} {a.name}
                      </span>
                    ))}
                  </div>
                )}
                </>)}

                {/* ── TAB TITOLO: scegli (uno solo) il titolo da indossare ── */}
                {activeTab === "title" && showTitleTab && (<>
                  <div className="loadout-section-title">
                    ♛ Titolo — {pendingTitle ? "1/1" : "0/1"} <span className="loadout-optional">(facoltativo · uno solo)</span>
                  </div>
                  <p className="loadout-title-hint">
                    Indossa un solo titolo: il bonus si attiva in combattimento quando ne ricorrono le condizioni.
                  </p>
                  <div className="loadout-grid">
                    {/* Opzione "nessun titolo" */}
                    <button
                      type="button"
                      className={`loadout-item title-opt ${!pendingTitle ? "selected" : ""}`}
                      onClick={() => setPendingTitle(null)}
                    >
                      <span className="loadout-item-icon">🚫</span>
                      <span className="loadout-item-name">Nessun titolo</span>
                      <span className="loadout-item-info">Nessun bonus</span>
                      {!pendingTitle && <span className="loadout-check">✓</span>}
                    </button>
                    {ownedTitles.map(key => {
                      const t = ARENA_TITLES[key];
                      const isSelected = pendingTitle === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`loadout-item title-opt ${isSelected ? "selected" : ""}`}
                          onClick={() => setPendingTitle(isSelected ? null : key)}
                        >
                          <span className="loadout-item-icon">{t.icon}</span>
                          <span className="loadout-item-name">{t.name}</span>
                          <span className="loadout-item-damage title-bonus">{t.short}</span>
                          {isSelected && <span className="loadout-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </>)}

                </div>{/* /loadout-tab-body */}

                {(loadoutContext === "tournament" || loadoutContext === "fun") && !reloadoutMode && (() => {
                  const saveMissing = savedCharMissing(buildSavedCharPayload());
                  return (
                    <div className="loadout-save-row">
                      <span className="loadout-save-label">💾 Salva questo PG (per tornei e Sfide Libere):</span>
                      {Array.from({ length: SAVED_ARENA_SLOTS }, (_, i) => i).map(i => (
                        <button key={i} type="button" className="btn-save-slot" disabled={saveMissing.length > 0}
                          title={saveMissing.length ? `Completa prima: ${saveMissing.map((m) => m.label).join(", ")}` : `Salva nello slot ${i + 1}`}
                          onClick={() => saveArenaCharToSlot(i)}>
                          Slot {i + 1}{savedArenaChars[i] ? " ✎" : ""}
                        </button>
                      ))}
                      {saveMissing.length > 0 && (
                        <span className="loadout-save-hint">Si salva quando è completo: manca {saveMissing.map((m) => m.label).join(", ")} (la Bottega non conta, si risceglie a ogni torneo).</span>
                      )}
                    </div>
                  );
                })()}

                {/* ── Footer fisso: annulla + azione intelligente ── */}
                <div className="loadout-actions loadout-actions--sticky">
                  <button className="btn-cancel-loadout" onClick={cancelLoadout}>Annulla</button>
                  <button
                    className={`btn-join ${isReady ? "" : "btn-join--incomplete"}`}
                    onClick={() => {
                      if (!isReady) { setLoadoutTab(firstIncompleteTab); return; }
                      if (loadoutContext === "reserve") saveReserveToSlot();
                      else confirmJoin();
                    }}
                  >
                    {loadoutContext === "reserve"
                      ? (isReady ? `🎭 Salva Riserva (Slot ${(reserveSlotTarget ?? 0) + 1})` : footerBtnText)
                      : footerBtnText}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── Vista idle: join / pending / registered ── */}
          {loadoutPhase === "idle" && !isMaster && (
            <div className="join-zone-inner">
              <div className="join-icon">⚔</div>
              <h2 className="join-title">Entra nell'Arena</h2>

              {(arenaMeta.prizes || formatPrizeConfig(arenaMeta.prizeConfig)) && (
                <div className="prize-display">
                  <div className="prize-display-label">🏆 Premi in Palio</div>
                  {formatPrizeConfig(arenaMeta.prizeConfig) && (
                    <div className="prize-display-text">{formatPrizeConfig(arenaMeta.prizeConfig)}</div>
                  )}
                  {arenaMeta.prizes && <div className="prize-display-text">{arenaMeta.prizes}</div>}
                </div>
              )}


              <p className="join-sub">
                {isRegistered
                  ? "Sei stato accettato. Preparati al combattimento."
                  : isPending
                  ? "La tua richiesta è stata inviata. Attendi l'approvazione del Master."
                  : "Scegli il tuo equipaggiamento e sfida i tuoi avversari."}
              </p>

              {!isRegistered && !isPending && (() => {
                const userIsChampion = tournamentHistory.some(t => t.winnerId === currentUser?.uid);
                const lockedOut = arenaMeta.championsOnly && !userIsChampion;
                return (
                  <>
                    {arenaMeta.championsOnly && (
                      <div className={`champions-only-badge${lockedOut ? " locked" : ""}`}>
                        ♛ Solo Campioni — {lockedOut
                          ? "non puoi iscriverti, devi prima vincere un torneo"
                          : "sei un Campione: puoi iscriverti"}
                      </div>
                    )}
                    {!lockedOut && renderLastLoadout({
                      useLabel: "↺ Iscriviti con l'ultimo assetto",
                      onUse: joinWithLastLoadout,
                    })}
                    {!lockedOut && savedArenaChars.some(Boolean) && renderSavedPicker({
                      useLabel: "⚔ Iscriviti con",
                      onUse: joinWithSavedChar,
                      hint: "Si apre il PG già pronto: scegli la Bottega della settimana e conferma.",
                    })}
                    <button className={`btn-join${savedArenaChars.some(Boolean) ? " btn-join--secondario" : ""}`} onClick={openLoadoutPicker} disabled={lockedOut}>
                      {savedArenaChars.some(Boolean) ? "＋ Crea un nuovo Personaggio" : "⚔ Crea il tuo Personaggio"}
                    </button>
                  </>
                );
              })()}
              {isPending && (
                <button className="btn-join pending" disabled>⏳ In attesa di approvazione…</button>
              )}
              {isRegistered && (
                <div className="registered-badge">✔ Iscrizione confermata</div>
              )}

              {(isRegistered || isPending) && snapshots[currentUser?.uid]?.selectedActions && (
                <div className="my-loadout-preview">
                  <div className="my-loadout-label">Il tuo equipaggiamento:</div>
                  {getSnapTitles(snapshots[currentUser.uid]).filter(k => ARENA_TITLES[k]).map(k => (
                    <span key={k} className="loadout-selected-tag loadout-title-tag" title={ARENA_TITLES[k].short}>
                      ♛ {ARENA_TITLES[k].icon} {ARENA_TITLES[k].name} <em>{ARENA_TITLES[k].short}</em>
                    </span>
                  ))}
                  {snapshots[currentUser.uid].selectedActions.map(a => (
                    <span key={a.name} className="loadout-selected-tag">
                      {a.icon} {a.name} <em>{a.damage}{a.statKey ? ` +${a.statKey.toUpperCase()}` : ""}</em>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── VISTA ARENA LIBERA (Fun) ── */}
      {arenaView === "libera" && currentUser && (() => {
        const openChallenges = funMatches.filter(m => m.status === "open" && !m.ai);
        const ongoingFun = funMatches.filter(m => m.status === "initiative" || m.status === "active");
        const myActiveFun = ongoingFun.find(m => m.players?.some(p => p.id === currentUser.uid));
        // AI matches are private to the owner — hide them from other players' lobby.
        const otherActiveFun = ongoingFun.filter(m => !m.players?.some(p => p.id === currentUser.uid) && !m.ai);
        const myFinishedFun = funMatches
          .filter(m => m.status === "finished" && m.players?.some(p => p.id === currentUser.uid))
          .slice(-3);
        return (
          <>
            <div className="fun-arena-section" id="arena-training">
              <div className="fun-arena-header">
                <span className="fun-arena-icon">⚔</span>
                <div className="fun-arena-title-block">
                  <h3 className="fun-arena-title">Arena Libera <span className="fun-arena-title-tag">Allenamento</span></h3>
                <p className="fun-arena-subtitle">
                  Sfide 1v1 senza ricompense. Stesso regolamento del torneo, solo per il gusto di combattere.
                </p>
              </div>
              {ongoingFun.length > 0 && (
                <span className="fun-arena-live-badge" title={`${ongoingFun.length} sfida/e in corso`}>
                  🔴 {ongoingFun.length} in corso
                </span>
              )}
              {!myActiveFun && (
                <div className="fun-arena-create-row">
                  <button className="btn-fun-create" onClick={openFunCreate}>
                    ⚔ Crea Sfida
                  </button>
                  <button
                    className="btn-fun-create btn-fun-ai"
                    onClick={openAiCreate}
                    title="Combatti contro un avversario IA in modalità difficile"
                  >
                    🤖 Sfida l'IA
                    <span className="btn-fun-ai-tag">Hard</span>
                  </button>
                </div>
              )}
            </div>

            {otherActiveFun.length > 0 && (
              <div className="fun-arena-lobby">
                <div className="fun-arena-lobby-title">Sfide in corso</div>
                {otherActiveFun.map(m => {
                  const [pa, pb] = m.players || [];
                  const aSnap = snapshots[pa?.id] || {};
                  const bSnap = snapshots[pb?.id] || {};
                  const turnName = m.players?.find(p => p.id === m.turn)?.name;
                  return (
                    <div key={m.matchId} className="fun-challenge-row fun-challenge-row--live">
                      <div className="fun-challenge-info">
                        <span className="fun-challenge-name">
                          {pa?.name || "?"}{aSnap.class ? ` (${aSnap.class})` : ""} <span className="fun-challenge-vs">VS</span> {pb?.name || "?"}{bSnap.class ? ` (${bSnap.class})` : ""}
                        </span>
                        <span className="fun-challenge-hp">
                          {isAwaitingReady(m) ? "✋ In attesa di «Iniziamo»" : m.status === "initiative" ? "⚡ Iniziativa" : `⚔ Turno di ${turnName || "?"}`}
                          {" · "}HP {pa?.hp ?? "?"} / {pb?.hp ?? "?"}
                          {nudgeButton(m)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {openChallenges.length > 0 && (
              <div className="fun-arena-lobby">
                <div className="fun-arena-lobby-title">Sfide aperte</div>
                {openChallenges.map(m => {
                  const challenger = m.players?.[0];
                  const cSnap = snapshots[challenger?.id] || {};
                  const isMine = m.challengerId === currentUser.uid;
                  return (
                    <div key={m.matchId} className="fun-challenge-row">
                      {cSnap.image && <img src={cSnap.image} alt="" className="fun-challenge-avatar" />}
                      <div className="fun-challenge-info">
                        <span className="fun-challenge-name">{challenger?.name || "?"}</span>
                        {cSnap.class && <span className="fun-challenge-class">{cSnap.class}</span>}
                        <span className="fun-challenge-hp">{challenger?.maxHp ?? "?"} HP · CA {cSnap.stats?.ac ?? "?"}</span>
                      </div>
                      {isMine ? (
                        <button className="btn-fun-cancel" onClick={() => cancelFunChallenge(m.matchId)}>
                          ✕ Annulla
                        </button>
                      ) : (
                        <button className="btn-fun-accept" onClick={() => openFunAccept(m.matchId)} disabled={!!myActiveFun}>
                          {myActiveFun ? "Hai già una sfida in corso" : "⚔ Accetta"}
                        </button>
                      )}
                      {isMaster && !isMine && (
                        <button className="btn-fun-cancel" onClick={() => cancelFunChallenge(m.matchId)}>♛ Rimuovi</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {myFinishedFun.length > 0 && (
              <div className="fun-arena-history">
                <div className="fun-arena-history-title">Le tue ultime sfide</div>
                {myFinishedFun.slice().reverse().map(m => {
                  const opp = m.players?.find(p => p.id !== currentUser.uid);
                  const won = m.winner === currentUser.uid;
                  const draw = !m.winner;
                  return (
                    <div key={m.matchId} className={`fun-history-row ${draw ? "draw" : won ? "win" : "lose"}`}>
                      <span className="fun-history-result">
                        {draw ? "🤝 Annullata" : won ? `🛡 Hai vinto contro ${opp?.name || "?"}` : `💀 Sconfitto da ${opp?.name || "?"}`}
                      </span>
                      <button className="btn-fun-remove" onClick={() => removeFunMatch(m.matchId)} title="Rimuovi dalla lista">×</button>
                    </div>
                  );
                })}
              </div>
            )}

            {openChallenges.length === 0 && !myActiveFun && otherActiveFun.length === 0 && myFinishedFun.length === 0 && (
              <div className="fun-arena-empty">Nessuna sfida aperta. Sii il primo a lanciarne una!</div>
            )}
            </div>
          </>
        );
      })()}

      {/* ── VISTA TABELLONE DEL CAMPIONATO ── */}
      <span id="arena-bracket-anchor" aria-hidden="true" />
      {arenaView === "bracket" && (arenaMeta.phase === "combat" || arenaMeta.phase === "finished") && tournamentMatches.length > 0 && (() => {
        // ── TABELLONE redesign: righe piatte, niente bordi/cornici ──
        const renderMatchCard = (m) => {
          const isMyMatch = m.players.some(p => p.id === currentUser?.uid);

          // Match concluso → riga singola e pulita: 👑 vincitore · perdente
          if (m.status === "finished") {
            const winner = m.players.find(p => p.id === m.winner);
            const losers = m.players.filter(p => p.id !== m.winner);
            const myRole = isMyMatch ? (m.winner === currentUser?.uid ? "win" : "loss") : null;
            return (
              <div key={m.matchId} className={`tb-result${myRole ? ` ${myRole}` : ""}`}>
                <span className="tb-result-crown" aria-hidden="true">👑</span>
                <span className="tb-result-winner">{winner?.name || "?"}</span>
                <span className="tb-result-sep">batte</span>
                <span className="tb-result-loser">{losers.map(l => l.name).join(", ") || "—"}</span>
              </div>
            );
          }

          // Match in corso / iniziativa / in attesa → pannello live piatto
          return (
            <div key={m.matchId} className={`tb-live ${m.status}${isMyMatch ? " mine" : ""}`}>
              <div className="tb-live-status">
                {isAwaitingReady(m) ? "✋ In attesa di «Iniziamo»" : m.status === "initiative" ? "⚡ Iniziativa" : m.status === "active" ? "⚔ In corso" : "🕓 In attesa"}
                {isAwaitingReady(m) && isMaster && (
                  <button type="button" className="btn-init" style={{ marginLeft: "0.5rem", padding: "0.15rem 0.6rem", fontSize: "0.72rem" }}
                    onClick={() => confirmReady(m.matchId, { force: true })} title="Avvia il match anche se non hanno confermato">
                    ▶ Avvia
                  </button>
                )}
                {nudgeButton(m)}
              </div>
              {m.players.map((p) => {
                const char = snapshots[p.id] || { stats: { maxHp: 70 } };
                const maxHp = char.stats?.maxHp ?? 70;
                const hpPct = Math.max(0, Math.min(100, (p.hp / maxHp) * 100));
                const isActive = m.turn === p.id && m.status === "active";
                return (
                  <div key={p.id} className={`tb-fighter${isActive ? " active" : ""}`}>
                    {char.image
                      ? <img src={char.image} className="tb-fighter-ava" alt="" />
                      : <div className="tb-fighter-ava tb-fighter-ava--ph" aria-hidden="true">⚔</div>}
                    <div className="tb-fighter-body">
                      <div className="tb-fighter-line">
                        <span className="tb-fighter-name">{p.name}</span>
                        {char.class && <span className="tb-fighter-class">{char.class}</span>}
                        <span className="tb-fighter-hp">
                          {isActive ? <span className="tb-fighter-turn" title="Turno in corso">● turno</span> : `${p.hp} HP`}
                        </span>
                      </div>
                      <div className="tb-hp-track"><div className="tb-hp-fill" style={{ width: `${hpPct}%` }} /></div>
                    </div>
                  </div>
                );
              })}
              {m.logs?.length > 0 && m.status === "active" && (
                <div className="tb-live-log">{renderLogWithDice(logPubText(m.logs[m.logs.length - 1]))}</div>
              )}
              {isMaster && (
                <div className="tb-force">
                  <span className="tb-force-label">♛ Forza vincitore</span>
                  {m.players.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="tb-force-btn"
                      onClick={() => masterForceWinner(m.matchId, p.id)}
                      title={`Dichiara ${p.name} vincitore di questo match`}
                    >
                      👑 {(p.name || "?").split(" ")[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        };

        const renderGroupColumn = (groupKey) => {
          const groupIds = groupKey === "A" ? (arenaMeta.groupA || []) : (arenaMeta.groupB || []);
          if (groupIds.length === 0) return null;
          const groupMatches = tournamentMatches.filter(m => m.kind === "group" && m.group === groupKey);
          const byRound = {};
          groupMatches.forEach(m => {
            const r = parseInt((m.matchId.match(/_R(\d+)_/) || [, 1])[1]);
            (byRound[r] = byRound[r] || []).push(m);
          });
          const rounds = Object.entries(byRound).sort(([a], [b]) => a - b);
          const standings = computeGroupStandings(groupKey, tournamentMatches);
          const medals = ["🥇", "🥈", "🥉"];
          return (
            <section className={`tb-group tb-group--${groupKey.toLowerCase()}`} key={groupKey}>
              <header className="tb-group-head">
                <span className="tb-group-name">Girone {groupKey}</span>
                <span className="tb-group-count">{groupIds.length} {groupIds.length === 1 ? "giocatore" : "giocatori"}</span>
              </header>

              {/* Classifica — lista piatta, niente tabella/bordi */}
              <div className="tb-standings">
                {standings.map((s, i) => {
                  const snap = snapshots[s.uid] || {};
                  return (
                    <div key={s.uid} className={`tb-rank${i === 0 ? " leader" : ""}`}>
                      <span className="tb-rank-pos">{medals[i] || i + 1}</span>
                      {snap.image
                        ? <img src={snap.image} className="tb-rank-ava" alt="" />
                        : <div className="tb-rank-ava tb-rank-ava--ph" aria-hidden="true">⚔</div>}
                      <span className="tb-rank-name">{snap.name || "?"}</span>
                      <span className="tb-rank-record">
                        <span className="tb-rank-w">{s.wins}V</span>
                        <span className="tb-rank-l">{s.losses}S</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Incontri — round in verticale, match come righe piatte */}
              <div className="tb-rounds">
                {rounds.map(([round, rMatches]) => (
                  <div key={round} className="tb-round">
                    <div className="tb-round-label">Round {round}</div>
                    <div className="tb-round-matches">{rMatches.map(renderMatchCard)}</div>
                  </div>
                ))}
                {rounds.length === 0 && (
                  <div className="tb-empty">Nessun incontro in questo girone.</div>
                )}
              </div>
            </section>
          );
        };

        const finalM = tournamentMatches.find(m => m.kind === "final");

        /* FIX: P5b — compact summary card per girone (just the standings) */
        const renderGroupSummary = (groupKey) => {
          const groupIds = groupKey === "A" ? (arenaMeta.groupA || []) : (arenaMeta.groupB || []);
          if (groupIds.length === 0) return null;
          const standings = computeGroupStandings(groupKey, tournamentMatches);
          return (
            <div key={groupKey} className="bracket-summary-card">
              <h4 className="bracket-summary-card-title">⚜ Girone {groupKey}</h4>
              <table className="bracket-standings">
                <thead>
                  <tr><th>#</th><th>Giocatore</th><th>V</th><th>S</th></tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => {
                    const snap = snapshots[s.uid] || {};
                    return (
                      <tr key={s.uid} className={i === 0 ? "leader" : ""}>
                        <td>{i + 1}</td>
                        <td>
                          {snap.image && <img src={snap.image} className="standings-avatar" alt="" />}
                          {snap.name || "?"}
                        </td>
                        <td>{s.wins}</td>
                        <td>{s.losses}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        };

        return (
          <>
            {/* FIX: P5b — inline trigger row + standings summary */}
            <div className="bracket-open-row" id="arena-bracket">
              <div className="bracket-open-row-info">
                <h3 className="bracket-open-row-title">⚔ Tabellone — Riepilogo</h3>
                {arenaMeta.phase === "combat" && !finalM && (
                  <span className="bracket-round-badge">Round {arenaMeta.currentRound}</span>
                )}
                {finalM && <span className="bracket-round-badge final-badge">Finale</span>}
              </div>
              <button type="button" className="btn-bracket-open" onClick={() => setBracketModalOpen(true)}>
                📊 Apri Tabellone
              </button>
            </div>
            <div className="bracket-summary-grid">
              {renderGroupSummary("A")}
              {renderGroupSummary("B")}
            </div>

            {/* FIX: P5b — full bracket lives inside modal */}
            <ArenaModal
              open={bracketModalOpen}
              onClose={() => { setBracketModalOpen(false); setArenaView("hub"); }}
              title="⚔ Tabellone del Campionato"
              className="tb-modal"
            >
              <div className="tb-board">
                <div className="tb-board-top">
                  {arenaMeta.phase === "combat" && !finalM && <span className="tb-now">Round {arenaMeta.currentRound}</span>}
                  {finalM && <span className="tb-now tb-now--final">🏆 Finale</span>}
                </div>
                <div className="tb-groups">
                  {renderGroupColumn("A")}
                  {renderGroupColumn("B")}
                </div>
                {finalM && (
                  <div className="tb-final">
                    <div className="tb-final-head">🏆 Finale di Campionato</div>
                    {renderMatchCard(finalM)}
                  </div>
                )}
              </div>
            </ArenaModal>
          </>
        );
      })()}

      {/* FIX: P5d — Betting moved to floating drawer (FAB-triggered).
          Inline render is suppressed by CSS; the FAB and drawer below replace it. */}
      {currentUser && (
        <>
          {arenaMeta.phase === "combat" && !bettingDrawerOpen && <button
            type="button"
            className="arena-bet-fab"
            onClick={() => setBettingDrawerOpen(true)}
            aria-label="Apri pannello scommesse"
          >
            <span className="arena-bet-fab-icon">🎲</span>
            <span>Scommetti</span>
            {userBetsCount > 0 && (
              <span className="arena-bet-fab-badge">{userBetsCount}</span>
            )}
          </button>}
          <ArenaModal
            open={bettingDrawerOpen}
            onClose={() => setBettingDrawerOpen(false)}
            title="🎲 Scommesse Arena"
            variant="drawer"
          >
            <BettingPanel
              arenaMeta={arenaMeta}
              snapshots={snapshots}
              currentUser={authUser}
              isMaster={isMaster}
            />
          </ArenaModal>
        </>
      )}

      {/* ── MENU "I TUOI DADI" — scelta skin del d20 ── */}
      <ArenaModal
        open={dicePickerOpen}
        onClose={() => setDicePickerOpen(false)}
        title="🎲 I Tuoi Dadi"
        className="dice-picker-modal"
      >
        <p className="dice-picker-intro">
          Scegli l'aspetto del tuo d20. La skin resta attiva finché non la cambi.
          Critico (20) e fallimento (1) restano sempre in oro e rosso.
        </p>
        <div className="dice-picker-section-label">Colori base</div>
        <div className="dice-picker-grid">
          {DICE_SKINS.filter((s) => s.kind === "base").map((s) => (
            <button
              key={s.id}
              type="button"
              className={`dice-skin-card${diceSkinId === s.id ? " is-active" : ""}`}
              onClick={() => handleChangeDiceSkin(s.id)}
            >
              {diceSkinPics[s.id]
                ? <img className="dice-swatch-3d" src={diceSkinPics[s.id]} alt="" aria-hidden="true" />
                : <span className={`dice-swatch skin-${s.id}`} aria-hidden="true" />}
              <span className="dice-skin-name">{s.label}</span>
              {diceSkinId === s.id && <span className="dice-skin-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
        <div className="dice-picker-section-label">Speciali ✦</div>
        <div className="dice-picker-grid">
          {DICE_SKINS.filter((s) => s.kind === "special").map((s) => (
            <button
              key={s.id}
              type="button"
              className={`dice-skin-card is-special${diceSkinId === s.id ? " is-active" : ""}`}
              onClick={() => handleChangeDiceSkin(s.id)}
            >
              {diceSkinPics[s.id]
                ? <img className="dice-swatch-3d" src={diceSkinPics[s.id]} alt="" aria-hidden="true" />
                : <span className={`dice-swatch skin-${s.id}`} aria-hidden="true" />}
              <span className="dice-skin-name">{s.label}</span>
              {s.desc && <span className="dice-skin-desc">{s.desc}</span>}
              {diceSkinId === s.id && <span className="dice-skin-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </ArenaModal>

      {/* ── POPUP FINE COMBATTIMENTO (vittoria / sconfitta) ── */}
      {fightResult && createPortal(
        <div
          className={`fight-result-overlay ${fightResult.won ? "is-win" : "is-lose"}`}
          onClick={() => setFightResult(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="fight-result-card" onClick={(e) => e.stopPropagation()}>
            {fightResult.won ? (
              <>
                <div className="fight-result-emblem win">🏆</div>
                <div className="fight-result-title win">HAI VINTO!</div>
                {fightResult.winnerImage && (
                  <img className="fight-result-avatar" src={fightResult.winnerImage} alt="" />
                )}
                <div className="fight-result-champ-name">{fightResult.winnerName}</div>
                <div className="fight-result-sub">Gloria nell'Arena di Eldoria</div>
              </>
            ) : (
              <>
                <div className="fight-result-emblem lose">💀</div>
                <div className="fight-result-title lose">Hai Perso</div>
                <div className="fight-result-winner">
                  {fightResult.winnerImage && (
                    <img className="fight-result-winner-img" src={fightResult.winnerImage} alt="" />
                  )}
                  <div className="fight-result-winner-text">
                    <span className="fight-result-winner-label">Ha vinto</span>
                    <span className="fight-result-winner-name">{fightResult.winnerName}</span>
                    {fightResult.winnerClass && (
                      <span className="fight-result-winner-class">{fightResult.winnerClass}</span>
                    )}
                  </div>
                </div>
              </>
            )}
            {fightResult.finalLog && (
              <div className="fight-result-blow">
                <span className="fight-result-blow-label">⚔ Il colpo decisivo</span>
                <p className="fight-result-blow-text">
                  {renderLogWithDice(displayLog(fightResult.finalLog, currentUser?.uid))}
                </p>
                <HpTrace entry={fightResult.finalLog} players={fightResult.players} />
              </div>
            )}
            <button className="fight-result-close" onClick={() => setFightResult(null)}>
              Continua
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── COMBAT MODAL (popup attivato dal floating fight button) ──
          Match in cui sono coinvolto: torneo (in combat) e sfide libere accettate.
          Tab "In corso" = match vivi · Tab "Storico" = ultimi 10 conclusi (sola lettura). */}
      {(() => {
        const myMatches = (arenaMeta.matches || []).filter(m =>
          ((m.kind === "fun") || arenaMeta.phase === "combat") &&
          m.players?.some(p => p.id === currentUser?.uid) &&
          m.status !== "open"
        );
        if (myMatches.length === 0) return null;
        const liveMatches = myMatches.filter(m => m.status !== "finished");
        const matchTs = (m) => (m.logs || []).reduce(
          (mx, l) => (l && typeof l === "object" && l.ts) ? Math.max(mx, new Date(l.ts).getTime()) : mx, 0);
        const finishedMatches = myMatches
          .filter(m => m.status === "finished")
          .sort((a, b) => matchTs(b) - matchTs(a))
          .slice(0, 10);
        return (
        <ArenaModal
          open={combatModalOpen}
          onClose={() => setCombatModalOpen(false)}
          title={isMyTurnInActive ? "⚔ È il tuo turno" : "🛡 Il tuo combattimento"}
          variant="combat"
          inlineTarget={arenaView === "hub" ? palcoSlot : null}
        >
        <div className="matches-container" id="arena-my-match">
          <div className="my-arena-banner">
            <span className="my-arena-banner-deco">⚔</span>
            <div className="my-arena-banner-text">
              <span className="my-arena-banner-eyebrow">La Tua Arena</span>
              <span className="my-arena-banner-title">Il Tuo Campo di Battaglia</span>
            </div>
            <span className="my-arena-banner-deco">⚔</span>
          </div>

          {/* Master con più PG in gara: sceglie quale fight giocare adesso. */}
          {masterFights.length > 1 && (
            <div className="master-fight-switch" role="group" aria-label="I tuoi fight">
              <span className="master-fight-switch-label">I tuoi fight</span>
              <div className="master-fight-switch-row">
                {masterFights.map((f) => {
                  const on = f.id === (actAs || authUser?.uid);
                  const tag = { turn: "⚔ tocca a te", ready: "✋ premi Iniziamo", init: "🎲 tira iniziativa", wait: "⏳ aspetti" }[f.state];
                  return (
                    <button key={f.id} type="button" aria-pressed={on}
                      className={`master-fight-chip${on ? " is-on" : ""}${f.state === "turn" || f.state === "ready" || f.state === "init" ? " is-hot" : ""}`}
                      onClick={() => setActAs(f.id === authUser?.uid ? null : f.id)}>
                      <span className="master-fight-chip-name">{f.name}</span>
                      <span className="master-fight-chip-vs">vs {f.opp}</span>
                      <span className="master-fight-chip-tag">{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab: in corso ↔ storico */}
          <div className="combat-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={combatTab === "live"}
              className={`combat-tab${combatTab === "live" ? " active" : ""}`}
              onClick={() => setCombatTab("live")}
            >
              ⚔ In corso{liveMatches.length > 0 ? ` · ${liveMatches.length}` : ""}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={combatTab === "history"}
              className={`combat-tab${combatTab === "history" ? " active" : ""}`}
              onClick={() => setCombatTab("history")}
            >
              📜 Storico{finishedMatches.length > 0 ? ` · ${finishedMatches.length}` : ""}
            </button>
            {/* La top bar con la ✕ esiste solo nelle card dei match vivi:
                qui serve un'uscita quando sei nello Storico o senza match in corso. */}
            {(combatTab === "history" || liveMatches.length === 0) && (
              <button type="button" className="combat-tabs-close" onClick={() => setCombatModalOpen(false)} aria-label="Chiudi" title="Chiudi">✕</button>
            )}
          </div>

          {/* ════════ STORICO — ultimi 10 fight conclusi (sola lettura) ════════ */}
          {combatTab === "history" && (
            <button type="button" className="combat-empty-link" onClick={() => { setCombatModalOpen(false); setArenaView("cronache"); }}>
              🗞 Tutte le cronache salvate (ultimi 8 match) →
            </button>
          )}
          {combatTab === "history" && (
            finishedMatches.length === 0 ? (
              <div className="combat-empty">📜 Nessun combattimento concluso, per ora.</div>
            ) : (
              <div className="combat-hist-list">
                {finishedMatches.map(m => {
                  const when = matchTs(m);
                  const whenStr = when
                    ? `${new Date(when).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })} · ${new Date(when).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`
                    : null;
                  const kindLabel = m.kind === "fun" ? "⚔ Sfida libera"
                    : m.kind === "final" ? "🏆 Finale"
                    : "🏟 Torneo";
                  return (
                    <div key={m.matchId} className="combat-hist-card">
                      <div className="chc-head">
                        <span className="chc-kind">{kindLabel}</span>
                        {whenStr && <span className="chc-when">{whenStr}</span>}
                        {m.kind === "fun" && (
                          <button type="button" className="chc-remove" onClick={() => removeFunMatch(m.matchId)} title="Rimuovi dallo storico" aria-label="Rimuovi dallo storico">🗑</button>
                        )}
                      </div>
                      <div className="chc-fighters">
                        {m.players.map((p, idx) => {
                          const char = snapshots[p.id] || {};
                          const won  = m.winner === p.id;
                          return (
                            <React.Fragment key={p.id}>
                              {idx > 0 && <span className="chc-vs">VS</span>}
                              <div className={`chc-fighter${won ? " chc-won" : ""}${p.id === currentUser?.uid ? " chc-me" : ""}`}>
                                {char.image
                                  ? <img src={char.image} alt="" className="chc-ava" />
                                  : <div className="chc-ava chc-ava-ph">⚔</div>}
                                <span className="chc-name">{won ? "👑 " : ""}{p.name}</span>
                                {char.class && <span className="chc-class">{char.class}{char.subclassName ? ` · ${char.subclassIcon || ""} ${char.subclassName}` : ""}</span>}
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                      <details className="chc-log">
                        <summary className="chc-log-sum">
                          📜 Cronaca · {(m.logs || []).length} {(m.logs || []).length === 1 ? "evento" : "eventi"}
                        </summary>
                        <div className="chc-log-scroll">
                          {[...(m.logs || [])].reverse().map((l, i) => {
                            const text = displayLog(l, currentUser?.uid);
                            const ts = l && typeof l === "object" && l.ts
                              ? new Date(l.ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                              : null;
                            return (
                              <p key={i} className="chc-log-entry">
                                {ts && <span className="log-ts">{ts}</span>}
                                {renderLogWithDice(text)}
                                <HpTrace entry={l} players={m.players} />
                              </p>
                            );
                          })}
                          {(m.logs || []).length === 0 && (
                            <p className="match-log-empty">— Nessun evento registrato —</p>
                          )}
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ════════ IN CORSO — match vivi (interattivi) ════════ */}
          {combatTab === "live" && liveMatches.length === 0 && (
            <div className="combat-empty">
              ✅ Nessuna sfida in corso.
              {finishedMatches.length > 0 && (
                <button type="button" className="combat-empty-link" onClick={() => setCombatTab("history")}>
                  Guarda lo Storico →
                </button>
              )}
            </div>
          )}
          {combatTab === "live" && liveMatches.map(m => {
            const myPlayer       = m.players.find(p => p.id === currentUser?.uid);
            const isMyMatch      = !!myPlayer;
            const isMyTurn       = m.turn === currentUser?.uid;
            const isFFA          = m.players.length >= 3;
            const mySnap         = snapshots[currentUser?.uid];
            const myActions      = mySnap?.selectedActions || [];
            const aliveOpponents = m.players.filter(p => p.id !== currentUser?.uid && p.hp > 0);
            const chosenTargetId = isFFA
              ? (selectedTargets[m.matchId] || aliveOpponents[0]?.id || null)
              : aliveOpponents[0]?.id || null;
            const wildShapeForm  = myPlayer?.wildShape   || null;
            const isEntangled    = !!myPlayer?.entangled;
            const pendingDexSave = !!myPlayer?.pendingDexSave;
            const pendingConSave = !!myPlayer?.pendingConSave;
            const pendingControlSave = !!myPlayer?.pendingControlSave;
            const pendingPoisonDoT = !!myPlayer?.poisonDoT && (myPlayer?.poisonResolvedTurnToken || "") !== (m.turnExpiry || "");
            const pendingBleedDoT  = !!myPlayer?.bleedDoT && (myPlayer?.bleedResolvedTurnToken || "") !== (m.turnExpiry || "");
            const pendingSaveDot = !!myPlayer?.pendingSaveDot;
            const isControlLost  = (myPlayer?.controlLostTurns ?? 0) > 0;
            const hasPendingSave = pendingDexSave || pendingConSave || pendingControlSave || pendingPoisonDoT || pendingBleedDoT || pendingSaveDot || isControlLost;
            const currentActions = wildShapeForm
              ? (WILD_SHAPES[wildShapeForm]?.actions || [])
              : myActions;
            // Scheda "Magie" nascosta se il personaggio non ha incantesimi (non occupa spazio).
            const hasSpells = currentActions.some(a => a.type === "spell");
            // Scheda attiva effettiva: se "magie" è nascosta ricado su "attacchi".
            const dock = (combatDock === "magie" && !hasSpells) ? "attacchi" : combatDock;

            // Sistema impugnatura armi
            const myWeaponActions  = myActions.filter(a => a.type === "weapon");
            const needsEquip       = !wildShapeForm && myPlayer?.equippedWeaponNames == null && myWeaponActions.length > 0;
            const equippedNames    = myPlayer?.equippedWeaponNames ?? [];
            // Selezioni pending equip (per pannello iniziale)
            const rawEquipSel      = equipSelections[m.matchId];
            const currentEquipSel  = rawEquipSel !== undefined ? rawEquipSel : [];
            const equipHas2H       = currentEquipSel.some(n => myWeaponActions.find(w => w.name === n)?.twoHanded);
            const isMatchPaused    = arenaMeta.timerPaused && m.kind !== "fun" && m.status !== "finished";

            return (
              <div key={m.matchId} className={`match-card ${m.status === "finished" ? "finished" : ""} ${m.kind === "fun" ? "match-fun" : ""} ${isMatchPaused ? "match-paused" : ""} ${combatLogExpanded ? "cv-logmode" : ""}`}>

                {isMatchPaused && (
                  <div className="match-pause-banner">
                    <span className="match-pause-flag">⛔</span>
                    <div className="match-pause-text">
                      <div className="match-pause-title">ARENA IN PAUSA</div>
                      <div className="match-pause-sub">
                        Il Master ha messo in pausa il match. Nessuna azione disponibile fino alla ripresa.
                      </div>
                    </div>
                    <span className="match-pause-flag">⛔</span>
                  </div>
                )}

                {/* ── [1] BARRA TOP FISSA ── */}
                <div className="cv-topbar">
                  <span className="cv-turn-badge">
                    {m.kind === "fun" ? "⚔ Sfida"
                      : m.kind === "final" ? "🏆 Finale"
                      : `⚔ Round ${arenaMeta.currentRound}`}
                  </span>
                  <div className="cv-timer-wrap">
                    {m.turnExpiry ? (() => {
                      const msLeft = Math.max(0, new Date(m.turnExpiry).getTime() - timerRef);
                      const h = Math.floor(msLeft / 3600000);
                      const min = Math.floor((msLeft % 3600000) / 60000);
                      const sec = Math.floor((msLeft % 60000) / 1000);
                      const fmt = h > 0
                        ? `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
                        : `${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
                      const urgent = msLeft < 30000;
                      return <span className={`cv-timer${urgent ? " urgent" : ""}`}>{fmt}</span>;
                    })() : <span className="cv-timer">--:--</span>}
                    <span className="cv-timer-label">
                      {isAwaitingReady(m) ? "✋ In attesa di «Iniziamo»"
                        : m.status === "initiative" ? "⚡ Iniziativa"
                        : m.status === "finished" ? "Concluso"
                        : `Turno di ${(m.players.find(p => p.id === m.turn)?.name || "—").split(" ")[0]}`}
                    </span>
                  </div>
                  <div className="cv-topbar-actions">
                    {m.kind === "fun" && m.status !== "finished" && (
                      <button type="button" className="cv-abandon" onClick={() => abandonFunMatch(m.matchId)} title="Abbandona la sfida" aria-label="Abbandona la sfida">🏳</button>
                    )}
                    {m.kind === "fun" && m.status === "finished" && (
                      <button type="button" className="cv-abandon" onClick={() => removeFunMatch(m.matchId)} title="Chiudi e rimuovi" aria-label="Chiudi e rimuovi">🗑</button>
                    )}
                    <button type="button" className="cv-close" onClick={() => setCombatModalOpen(false)} aria-label="Chiudi">✕</button>
                  </div>
                </div>

                {/* Fighters — [2] ZONA SCONTRO: TU a sinistra, avversario a destra */}
                <div className="fighters-row">
                  {(isFFA ? m.players : [...m.players].sort((a, b) => (a.id === currentUser?.uid ? -1 : b.id === currentUser?.uid ? 1 : 0))).map((p, idx) => {
                    const char     = snapshots[p.id] || { stats: { maxHp: 70, ac: 10 } };
                    const isDead   = p.hp <= 0;
                    const isActive = m.turn === p.id;
                    const hpPct    = Math.max(0, (p.hp / (char.stats?.maxHp ?? 70)) * 100);
                    const hpColor  = hpPct > 60 ? "#00FF88" : hpPct > 30 ? "#FFD700" : "#FF3355";
                    const fLvl     = Object.values(char.classLevels || {}).reduce((a, b) => a + (b || 0), 0) || 1;
                    // Sotto controllo (Sonno/Paura/Blocca/Charme/Ragnatela…) → aura viola pixelata
                    const isControlled = !isDead && ((p.controlLostTurns ?? 0) > 0 || !!p.pendingControlSave || !!p.entangled);

                    return (
                      <React.Fragment key={p.id}>
                        {idx > 0 && (
                          <div className="vs-divider">
                            <span className="cv-vs-core">{isFFA ? "·" : "VS"}</span>
                            <span className="cv-orbit o1" aria-hidden="true" />
                            <span className="cv-orbit o2" aria-hidden="true" />
                            <span className="cv-orbit o3" aria-hidden="true" />
                            {!isFFA && m.status !== "finished" && m.players.some(pl => PLAYER_HAS_RANGED_WEAPON(pl, snapshots[pl.id])) && (
                              <span
                                title={m.distanceClosed ? "Combattenti in mischia: gli attacchi ravvicinati sono normali." : "Combattenti a distanza: chi attacca in mischia tira a svantaggio finché non chiude la distanza."}
                                style={{ marginTop: "0.4rem", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.02em", whiteSpace: "nowrap", padding: "0.12rem 0.45rem", borderRadius: "999px", color: "#fff", background: m.distanceClosed ? "rgba(200,70,55,0.9)" : "rgba(146,64,14,0.9)", boxShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
                              >
                                {m.distanceClosed ? "⚔ Mischia" : "🏹 Distanza"}
                              </span>
                            )}
                          </div>
                        )}
                        <div className={`fighter-card ${p.id === currentUser?.uid ? "side-you" : "side-foe"} ${isActive ? "active-turn" : (!isDead && m.status === "active" ? "waiting" : "")} ${isDead ? "defeated" : ""}`}>
                          {isActive && !isDead && <div className="turn-indicator">Il tuo turno</div>}
                          {isDead && <div className="defeated-banner">Sconfitto</div>}

                          <div className="fighter-name">{p.name}</div>
                          {char.class && <div className="fighter-class">{char.class}{char.subclassName ? ` · ${char.subclassIcon || ""} ${char.subclassName}` : ""}</div>}
                          {getSnapTitles(char).map(key => ARENA_TITLES[key] && (
                            <div key={key} className="fighter-title-badge" title={ARENA_TITLES[key].short}>
                              {ARENA_TITLES[key].icon} {ARENA_TITLES[key].name}
                            </div>
                          ))}
                          {char.image ? (
                            <div className={`cv-avatar-wrap${isControlled ? " is-controlled" : ""}`} style={{ "--hp": `${hpPct}%`, "--hpcol": hpColor }} data-vfx-target={`arena-fx:${m.matchId}:${p.id}`}>
                              <span className="cv-hp-ring" aria-hidden="true" />
                              <img src={char.image} alt={p.name} className="fighter-avatar" />
                              {isControlled && <span className="cv-control-aura" aria-hidden="true" />}
                            </div>
                          ) : (
                            <div className={`cv-noavatar${isControlled ? " is-controlled" : ""}`} aria-hidden="true" data-vfx-target={`arena-fx:${m.matchId}:${p.id}`}>
                              {CLASS_ICONS[(char.class || "").toLowerCase()] || CLASS_ICONS[char.class] || "⚔"}
                              {isControlled && <span className="cv-control-aura" aria-hidden="true" />}
                            </div>
                          )}
                          {char.image ? (
                            <span className="cv-hp-text" style={{ color: hpColor }}>{p.hp}<small>/{char.stats?.maxHp ?? 70}</small></span>
                          ) : (
                            <div className="hp-bar-wrap">
                              <div className="hp-bar-bg">
                                <div className="hp-bar-fill" style={{ width: `${hpPct}%`, background: hpColor }} />
                              </div>
                              <span className="hp-label">{p.hp} / {char.stats?.maxHp ?? 70} HP</span>
                            </div>
                          )}

                          {/* 3 mini-stat: CA · Init · Livello */}
                          <div className="fighter-ministats">
                            {(() => {
                              if (char?.stats?.ac == null && !p.wildShape) return <span className="ministat" title="Classe Armatura">🛡 ?</span>;
                              const _ac = getDisplayAc(p, char);
                              const tone = _ac.ac > _ac.base ? " is-buff" : _ac.ac < _ac.base ? " is-malus" : "";
                              return (
                                <span className={`ministat ministat--ac${tone}`}
                                  title={`Classe Armatura ${_ac.ac}${_ac.parts.length ? ` (base ${_ac.base} · ${_ac.parts.join(" · ")})` : ""}`}>
                                  🛡 {_ac.ac}{_ac.ac !== _ac.base && <small> {_ac.ac > _ac.base ? "▲" : "▼"}</small>}
                                </span>
                              );
                            })()}
                            <span className="ministat" title="Iniziativa">⚡ {p.init > 0 ? p.init : "—"}</span>
                            <span className="ministat" title="Livello">⭐ {fLvl}</span>
                          </div>

                          {/* Cariche di arretramento (kiting): sparare da vicino arretrando è a svantaggio e consuma 1 carica */}
                          {!isDead && m.status === "active" && PLAYER_HAS_RANGED_WEAPON(p, char) && (ARENA_KITE_MAX - (p.kiteChargesUsed ?? 0)) > 0 && (
                            <div
                              className="fighter-kite"
                              title={`Tiratore: da vicino puoi sparare arretrando (tiro a svantaggio, riapre la distanza). Cariche di arretramento rimaste: ${ARENA_KITE_MAX - (p.kiteChargesUsed ?? 0)}.`}
                              style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--el-2)", marginTop: "0.15rem" }}
                            >
                              🏹 Arretramento ×{ARENA_KITE_MAX - (p.kiteChargesUsed ?? 0)}
                            </div>
                          )}

                          {(() => {
                            const statuses = getFighterStatuses(p);
                            if (!statuses.length) return null;
                            return (
                              <div className="fighter-statuses">
                                {statuses.map(s => (
                                  <div key={s.key} className={`fighter-status ${s.cls} ${GOOD_STATUS_CLS.has(s.cls) ? "is-good" : "is-bad"}`} title={s.tip}>
                                    <span className="fighter-status-ico">{s.icon}</span>
                                    <span className="fighter-status-txt">{s.text}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}

                          {isAwaitingReady(m) && (
                            p.id === currentUser?.uid && isMyMatch && !m.ready?.[p.id] ? (
                              <>
                                <button className="btn-init" onClick={() => confirmReady(m.matchId)}>
                                  ✋ Iniziamo
                                </button>
                                {m.kind !== "fun" && (
                                  <button type="button" className="btn-init" style={{ marginTop: "0.35rem", background: "var(--roccia-3)", color: "var(--osso)", border: "1px solid rgba(var(--el-rgb),.6)" }}
                                    onClick={openReloadout}>
                                    ⚙ Cambia equipaggiamento
                                  </button>
                                )}
                              </>
                            ) : (
                              <div className="arena-ready-chip" style={{ fontSize: "0.72rem", fontWeight: 700, marginTop: "0.3rem", color: m.ready?.[p.id] ? "var(--el-2)" : "var(--osso-2)", opacity: m.ready?.[p.id] ? 1 : 0.75 }}>
                                {m.ready?.[p.id] ? "✓ Pronto" : "⏳ Deve ancora premere «Iniziamo»"}
                              </div>
                            )
                          )}

                          {isMyMatch && m.status === "initiative" && !isAwaitingReady(m) && p.id === currentUser?.uid && p.init === 0 && (
                            <button className="btn-init" onClick={() => rollInit(m.matchId)}>
                              🎲 Tira Iniziativa
                            </button>
                          )}

                          {/* reazioni fluttuanti sopra questo combattente (timer locale: entrambi le vedono) */}
                          {liveReacts
                            .filter(r => r.matchId === m.matchId && r.uid === p.id)
                            .map(r => (
                              <span key={r.id} className="arena-fight-react" aria-hidden="true">{r.emoji}</span>
                            ))}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* ── [3] STAT DETTAGLIATI (collassabile) ── */}
                {mySnap?.stats && (
                  <div className="cv-stats">
                    <button type="button" className="cv-stats-toggle" onClick={() => setCombatStatsOpen(v => !v)} aria-expanded={combatStatsOpen}>
                      {combatStatsOpen ? "▾" : "▸"} Statistiche
                    </button>
                    {combatStatsOpen && (
                      <div className="cv-stats-pills">
                        {[["str","FOR","Forza"],["dex","DES","Destrezza"],["con","COS","Costituzione"],["int","INT","Intelligenza"],["wis","SAG","Saggezza"],["cha","CAR","Carisma"]].map(([k,lbl,full]) => {
                          const v = mySnap.stats[k] ?? 0;
                          return <span key={k} className="cv-stat-pill" title={`${full}: ${v >= 0 ? "+" : ""}${v}`}>{lbl} <strong>{v >= 0 ? "+" : ""}{v}</strong></span>;
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Barra reazioni — i due sfidanti possono inviare emoji (cooldown 20s) */}
                {isMyMatch && m.status !== "finished" && (() => {
                  const onCd = Date.now() < reactCooldownUntil;
                  const cdLeft = Math.max(0, Math.ceil((reactCooldownUntil - Date.now()) / 1000));
                  const open = reactPickerMatch === m.matchId;
                  return (
                    <div className="arena-react-bar">
                      <button
                        type="button"
                        className={`arena-react-toggle${onCd ? " is-cd" : ""}`}
                        onClick={() => { if (!onCd) setReactPickerMatch(open ? null : m.matchId); }}
                        disabled={onCd}
                        title={onCd ? `Aspetta ${cdLeft}s prima di reagire di nuovo` : "Invia una reazione"}
                      >
                        {onCd ? `⏳ ${cdLeft}s` : "😄 Reagisci"}
                      </button>
                      {open && !onCd && (
                        <div className="arena-react-row" role="menu" aria-label="Reazioni">
                          {ARENA_REACTIONS.map(e => (
                            <button
                              key={e}
                              type="button"
                              className="arena-react-emo"
                              onClick={() => sendArenaReaction(m.matchId, e)}
                              aria-label={`Reagisci con ${e}`}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Action panel */}
                {isMyMatch && isMyTurn && m.status === "active" && (
                  <div className="action-panel">
                    {isFFA && (
                      <div className="target-selector-row">
                        <span className="target-selector-label">Bersaglio:</span>
                        {aliveOpponents.map(t => (
                          <button
                            key={t.id}
                            className={`btn-target ${chosenTargetId === t.id ? "selected" : ""}`}
                            onClick={() => setSelectedTargets(prev => ({ ...prev, [m.matchId]: t.id }))}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {!isFFA && chosenTargetId && (
                      <div className="target-1v1-label">
                        Attacchi: <strong>{m.players.find(p => p.id === chosenTargetId)?.name}</strong>
                      </div>
                    )}

                    {/* ── DOCK: schede categoria azioni (solo nello stato normale di scelta) ── */}
                    {!needsEquip && !hasPendingSave && !isEntangled && !showWildPicker && (
                      <div className="combat-dock-tabs" role="tablist">
                        {[
                          ["attacchi","⚔","Attacchi"],
                          ...(hasSpells ? [["magie","✨","Magie"]] : []),
                          ["abilita","⭐","Abilità"],
                          ["oggetti","🧪","Oggetti"],
                        ].map(([key,ico,lab]) => (
                          <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={dock === key}
                            className={`cdt-tab${dock === key ? " active" : ""}`}
                            onClick={() => setCombatDock(key)}
                          >
                            <span className="cdt-ico" aria-hidden="true">{ico}</span>
                            <span className="cdt-lab">{lab}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* ── Wild Shape: pulsante selezione ── */}
                    {dock === "abilita" && (<>
                    {/* — abilità speciali di classe (Forma Selvatica, Lay of Hands, Fonte, ecc.) — */}
                    {mySnap?.hasWildShape && !wildShapeForm && !showWildPicker && !hasPendingSave && !isEntangled && (() => {
                      const wsLeft = myPlayer?.wildShapeUsesLeft ?? 1;
                      return (
                        <div className="wild-shape-bar">
                          {wsLeft > 0 ? (
                            <button className="btn-wild-shape" onClick={() => setShowWildPicker(true)}>
                              🐾 Forma Selvatica <span className="action-uses-badge">{wsLeft}/1</span>
                            </button>
                          ) : (
                            <div className="btn-wild-shape exhausted">🐾 Forma Selvatica — Esaurita</div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Lay of Hands ── */}
                    {(() => {
                      const mySnap = snapshots[currentUser?.uid];
                      const isPaladino = isPaladinClass((mySnap?.class || "").toLowerCase());
                      if (!isPaladino) return null;
                      const pool = myPlayer?.layOfHandsPool ?? 0;
                      const myHp = myPlayer?.hp ?? 0;
                      const maxHp = myPlayer?.maxHp ?? 0;
                      const maxHeal = Math.min(pool, maxHp - myHp);
                      if (showLayOfHandsPicker) {
                        return (
                          <div className="lay-of-hands-picker">
                            <div className="loh-title">🙏 Lay of Hands — Pozza: {pool} HP</div>
                            <div className="loh-controls">
                              <button className="stat-adj-btn" onClick={() => setLayOfHandsAmt(a => Math.max(1, a - 1))} disabled={layOfHandsAmt <= 1}>−</button>
                              <span className="loh-amount">{layOfHandsAmt} HP</span>
                              <button className="stat-adj-btn" onClick={() => setLayOfHandsAmt(a => Math.min(maxHeal, a + 1))} disabled={layOfHandsAmt >= maxHeal}>+</button>
                            </div>
                            <div className="loh-buttons">
                              <button className="btn-cancel-wild" onClick={() => setShowLayOfHandsPicker(false)}>Annulla</button>
                              <button className="btn-join" style={{ padding: "6px 18px", fontSize: "0.88rem" }}
                                onClick={() => handleLayOfHands(m.matchId, layOfHandsAmt)}
                                disabled={layOfHandsAmt < 1 || maxHeal <= 0}>
                                Cura {layOfHandsAmt} HP
                              </button>
                            </div>
                          </div>
                        );
                      }
                      if (pool <= 0) {
                        return <div className="btn-wild-shape exhausted">🙏 Lay of Hands — Pozza esaurita</div>;
                      }
                      const bonusBlocked = !!myPlayer?.bonusActionUsed;
                      return (
                        <button className="btn-wild-shape" onClick={() => { setLayOfHandsAmt(Math.min(1, maxHeal)); setShowLayOfHandsPicker(true); }}
                          disabled={maxHeal <= 0 || bonusBlocked}
                          title={bonusBlocked ? "Bonus action già usata questo turno" : "Bonus action · cura dalla pozza"}>
                          🙏 Lay of Hands <span className="ws-uses-tag">Bonus · Pozza: {pool} HP{bonusBlocked ? " · ⏳" : ""}</span>
                        </button>
                      );
                    })()}

                    {/* ── Fonte di Magia (Sorcerer) ── */}
                    {(() => {
                      const mySnap = snapshots[currentUser?.uid];
                      const isStregone = isSorcererClass((mySnap?.class || "").toLowerCase());
                      if (!isStregone) return null;
                      const fonteAction = (mySnap?.selectedActions || []).find(a => a.special === "fonte_di_magia");
                      if (!fonteAction) return null;
                      const usesLeft = myPlayer?.actionUsesLeft?.[fonteAction.name] ?? fonteAction.maxUses;
                      const noUses = usesLeft <= 0;
                      if (showFontePicker) {
                        const slot1 = readSpellSlots(myPlayer, 1);
                        const slot2 = readSpellSlots(myPlayer, 2);
                        const fonteOpts = [
                          { l1: 2, l2: 0, label: "+2 slot Lv1" },
                          { l1: 1, l2: 1, label: "+1 Lv1 · +1 Lv2" },
                          { l1: 0, l2: 2, label: "+2 slot Lv2" },
                        ];
                        return (
                          <div className="lay-of-hands-picker">
                            <div className="loh-title">🔮 Fonte di Magia — Recupera 2 slot (hai Lv1 {slot1}/{SORC_SLOTS_MAX} · Lv2 {slot2}/{SORC_SLOTS_MAX})</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "8px 0" }}>
                              {fonteOpts.map(o => {
                                // l'opzione è inutile se i pool interessati sono già pieni
                                const effective = Math.min(o.l1, SORC_SLOTS_MAX - slot1) + Math.min(o.l2, SORC_SLOTS_MAX - slot2);
                                return (
                                  <button key={o.label}
                                    className="equip-weapon-btn"
                                    disabled={effective <= 0}
                                    onClick={() => handleFonteConfirm(m.matchId, fonteAction, o.l1, o.l2)}>
                                    {o.label}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="loh-buttons">
                              <button className="btn-cancel-wild" onClick={() => { setShowFontePicker(false); setFonteSelected([]); }}>Annulla</button>
                            </div>
                          </div>
                        );
                      }
                      if (noUses) {
                        return <div className="btn-wild-shape exhausted">🔮 Fonte di Magia — Cariche esaurite</div>;
                      }
                      return (
                        <button className="btn-wild-shape" onClick={() => { setShowFontePicker(true); setFonteSelected([]); }}>
                          🔮 Fonte di Magia <span className="ws-uses-tag">{usesLeft}/{fonteAction.maxUses} cariche</span>
                        </button>
                      );
                    })()}

                    {/* ── Astuzia Magica (Warlock) ── */}
                    {(() => {
                      const mySnap = snapshots[currentUser?.uid];
                      const isWarlock = isWarlockClass((mySnap?.class || "").toLowerCase());
                      if (!isWarlock) return null;
                      const cunningAction = (mySnap?.selectedActions || []).find(a => a.special === "magical_cunning");
                      if (!cunningAction) return null;
                      const usesLeft = myPlayer?.actionUsesLeft?.[cunningAction.name] ?? cunningAction.maxUses;
                      const noUses = usesLeft <= 0;
                      if (noUses) return <div className="btn-wild-shape exhausted">🌀 Astuzia Magica — Esaurita</div>;
                      return (
                        <button className="btn-wild-shape" onClick={() => handleMagicalCunning(m.matchId, cunningAction)}>
                          🌀 Astuzia Magica <span className="ws-uses-tag">{usesLeft}/{cunningAction.maxUses} uso</span>
                        </button>
                      );
                    })()}

                    {/* ── Patto Demoniaco (Warlock) ── */}
                    {(() => {
                      const mySnap = snapshots[currentUser?.uid];
                      const isWarlock = isWarlockClass((mySnap?.class || "").toLowerCase());
                      if (!isWarlock) return null;
                      const pattoAction = (mySnap?.selectedActions || []).find(a => a.special === "patto_demoniaco");
                      if (!pattoAction) return null;
                      const usesLeft = myPlayer?.actionUsesLeft?.[pattoAction.name] ?? pattoAction.maxUses;
                      const noUses = usesLeft <= 0;
                      const pattoT = myPlayer?.pattoTurns ?? 0;
                      if (pattoT > 0) {
                        return <div className="btn-wild-shape" style={{ background: "#7c2d12", color: "#fef9c3" }}>🩸 Patto Attivo · +1d12 spell · {pattoT}t</div>;
                      }
                      if (noUses) return <div className="btn-wild-shape exhausted">🩸 Patto Demoniaco — Esaurito</div>;
                      return (
                        <button
                          className="btn-wild-shape"
                          title="Sacrifica 1d4 PF · per 3 turni le tue spell che colpiscono fanno +1d12 danni"
                          onClick={() => handlePattoDemoniaco(m.matchId, pattoAction)}
                        >
                          🩸 Patto Demoniaco <span className="ws-uses-tag">{usesLeft}/{pattoAction.maxUses} uso</span>
                        </button>
                      );
                    })()}

                    {/* ── Recupero Arcano (Wizard) ── */}
                    {(() => {
                      const mySnap = snapshots[currentUser?.uid];
                      const isMago = isWizardClass((mySnap?.class || "").toLowerCase());
                      if (!isMago) return null;
                      const recuperoAction = (mySnap?.selectedActions || []).find(a => a.special === "recupero_arcano");
                      if (!recuperoAction) return null;
                      const usesLeft = myPlayer?.actionUsesLeft?.[recuperoAction.name] ?? recuperoAction.maxUses;
                      const noUses = usesLeft <= 0;
                      const allSpells = mySnap?.selectedActions || [];
                      const deplLv1 = allSpells.filter(a => a.maxUses && (a.level ?? 0) === 1 && (myPlayer?.actionUsesLeft?.[a.name] ?? a.maxUses) < a.maxUses);
                      const deplLv2 = allSpells.filter(a => a.maxUses && (a.level ?? 0) === 2 && (myPlayer?.actionUsesLeft?.[a.name] ?? a.maxUses) < a.maxUses);
                      if (showRecuperoPicker) {
                        return (
                          <div className="lay-of-hands-picker">
                            <div className="loh-title">📖 Recupero Arcano — Scegli fino a 2 slot Lv1 e 1 slot Lv2</div>
                            <div style={{ marginBottom: "6px", fontSize: "0.82rem", opacity: 0.8 }}>Lv1 ({recuperoLv1Selected.length}/2):</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                              {deplLv1.length === 0
                                ? <span style={{ opacity: 0.5, fontSize: "0.82rem" }}>Nessun slot lv1 esaurito</span>
                                : deplLv1.map(sp => {
                                    const cur = myPlayer?.actionUsesLeft?.[sp.name] ?? sp.maxUses;
                                    const isSel = recuperoLv1Selected.includes(sp.name);
                                    return (
                                      <button key={sp.name} className={`equip-weapon-btn ${isSel ? "sel" : ""}`}
                                        disabled={!isSel && recuperoLv1Selected.length >= 2}
                                        onClick={() => setRecuperoLv1Selected(prev => isSel ? prev.filter(n => n !== sp.name) : [...prev, sp.name])}>
                                        {sp.icon} {sp.name} ({cur}/{sp.maxUses})
                                      </button>
                                    );
                                  })}
                            </div>
                            <div style={{ marginBottom: "6px", fontSize: "0.82rem", opacity: 0.8 }}>Lv2 ({recuperoLv2Selected.length}/1):</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                              {deplLv2.length === 0
                                ? <span style={{ opacity: 0.5, fontSize: "0.82rem" }}>Nessun slot lv2 esaurito</span>
                                : deplLv2.map(sp => {
                                    const cur = myPlayer?.actionUsesLeft?.[sp.name] ?? sp.maxUses;
                                    const isSel = recuperoLv2Selected.includes(sp.name);
                                    return (
                                      <button key={sp.name} className={`equip-weapon-btn ${isSel ? "sel" : ""}`}
                                        disabled={!isSel && recuperoLv2Selected.length >= 1}
                                        onClick={() => setRecuperoLv2Selected(prev => isSel ? prev.filter(n => n !== sp.name) : [...prev, sp.name])}>
                                        {sp.icon} {sp.name} ({cur}/{sp.maxUses})
                                      </button>
                                    );
                                  })}
                            </div>
                            <div className="loh-buttons">
                              <button className="btn-cancel-wild" onClick={() => { setShowRecuperoPicker(false); setRecuperoLv1Selected([]); setRecuperoLv2Selected([]); }}>Annulla</button>
                              <button className="btn-join" style={{ padding: "6px 18px", fontSize: "0.88rem" }}
                                disabled={recuperoLv1Selected.length === 0 && recuperoLv2Selected.length === 0}
                                onClick={() => handleRecuperoArcano(m.matchId, recuperoAction, recuperoLv1Selected, recuperoLv2Selected)}>
                                Ripristina
                              </button>
                            </div>
                          </div>
                        );
                      }
                      if (noUses) return <div className="btn-wild-shape exhausted">📖 Recupero Arcano — Esaurito</div>;
                      return (
                        <button className="btn-wild-shape" onClick={() => { setShowRecuperoPicker(true); setRecuperoLv1Selected([]); setRecuperoLv2Selected([]); }}>
                          📖 Recupero Arcano <span className="ws-uses-tag">{usesLeft}/{recuperoAction.maxUses} uso</span>
                        </button>
                      );
                    })()}
                    </>)}

                    {/* ── Wild Shape: picker animali ── */}
                    {showWildPicker && !wildShapeForm && (
                      <div className="wild-picker">
                        <div className="wild-picker-title">Scegli la Forma Selvatica</div>
                        <div className="wild-picker-forms">
                          {Object.entries(WILD_SHAPES).map(([key, form]) => (
                            <button key={key} className="btn-wild-form" onClick={() => handleWildShape(m.matchId, key)}>
                              <span className="wild-form-icon">{form.icon}</span>
                              <span className="wild-form-name">{form.name}</span>
                              <span className="wild-form-hp">{form.hpDice.count}d{form.hpDice.sides} HP</span>
                              <div className="wild-form-actions">
                                {form.actions.map(a => (
                                  <span key={a.name} className="wild-form-action-tag">
                                    {a.icon} {a.name} {a.damage !== "—" ? a.damage : ""}
                                    {a.statKey ? ` +${a.statKey.toUpperCase()}` : ""}
                                    {a.special === "web" ? " (TS FOR ogni turno)" : ""}
                                    {a.special === "poison" ? " (TS COS)" : ""}
                                    {a.special === "save_dot" ? ` (TS COS · ${a.saveDotDamage || "1d8"}/turno)` : ""}
                                  </span>
                                ))}
                              </div>
                            </button>
                          ))}
                        </div>
                        <button className="btn-cancel-wild" onClick={() => setShowWildPicker(false)}>
                          ✕ Annulla
                        </button>
                      </div>
                    )}

                    {/* ── Wild Shape attiva ── */}
                    {wildShapeForm && (
                      <div className="wild-shape-active-bar">
                        <span className="wild-active-label">
                          {WILD_SHAPES[wildShapeForm]?.icon} {WILD_SHAPES[wildShapeForm]?.name}
                        </span>
                        <button className="btn-revert-wild" onClick={() => revertWildShape(m.matchId)}>
                          ↩ Forma Originale
                        </button>
                      </div>
                    )}

                    {/* ── Tiro Salvezza DEX (ragnatela) ── */}
                    {pendingDexSave && (
                      <div className="save-block dex">
                        <p className="save-block-label">🕸 Tiro Salvezza su DES per evitare la ragnatela! (CD 15)</p>
                        <button className="btn-saving-throw" onClick={() => rollSavingThrow(m.matchId, "dex", "dex_web")}>
                          🎲 TS Destrezza
                        </button>
                      </div>
                    )}

                    {/* ── Tiro Salvezza CON (veleno) ── */}
                    {!pendingDexSave && pendingConSave && (
                      <div className="save-block con">
                        <p className="save-block-label">☠ Tiro Salvezza su COS contro il Veleno! (CD 15)</p>
                        <button className="btn-saving-throw" onClick={() => rollSavingThrow(m.matchId, "con", "con_poison")}>
                          🎲 TS Costituzione
                        </button>
                      </div>
                    )}

                    {/* ── Tiro Salvezza Controllo (spell di controllo) ── */}
                    {!pendingDexSave && !pendingConSave && pendingControlSave && (() => {
                      const ctrlAbilityUI = myPlayer?.pendingControlSaveAbility || "wis";
                      const ctrlDcUI      = myPlayer?.pendingControlDC || 13;
                      const ctrlLblUI     = SAVE_LABEL[ctrlAbilityUI] || ctrlAbilityUI.toUpperCase();
                      const ctrlRemaining = myPlayer?.controlLostTurns ?? 0;
                      const isCoronaUI    = pendingControlSave === "corona_pazzia";
                      return (
                        <div className="save-block control control-vivid">
                          <p className="save-block-label">
                            {isCoronaUI
                              ? `🌀 Corona della Pazzia! TS ${ctrlLblUI} (CD ${ctrlDcUI}) — se fallisci attacchi te stesso!`
                              : `🌀 Sotto Controllo! TS ${ctrlLblUI} (CD ${ctrlDcUI}) ogni turno — passa per liberarti, fallisci e perdi il turno${ctrlRemaining > 0 ? ` (${ctrlRemaining} turno/i rimanenti)` : ""}.`}
                          </p>
                          <button className="btn-saving-throw btn-ts-vivid" onClick={() => rollSavingThrow(m.matchId, ctrlAbilityUI, isCoronaUI ? "corona_pazzia" : "control_spell")}>
                            🎲 TS {ctrlLblUI}
                          </button>
                        </div>
                      );
                    })()}

                    {/* ── DoT (Veleno / Fuoco / …) — risolvi prima di agire ── */}
                    {!pendingDexSave && !pendingConSave && !pendingControlSave && !pendingSaveDot && pendingPoisonDoT && (() => {
                      const dotIcon   = myPlayer?.poisonDoTIcon || "☠";
                      const dotNoun   = myPlayer?.poisonDoTNoun || "avvelenato";
                      const dotSource = myPlayer?.poisonDoTSourceLabel || "veleno";
                      return (
                        <div className="save-block con">
                          <p className="save-block-label">{dotIcon} Sei {dotNoun}! Subisci {myPlayer?.poisonDoTDice || "1d6"} danni da {dotSource} ({myPlayer?.poisonDoTTurns ?? 1} turno/i rimanenti).</p>
                          <span className="dot-auto-note">⏳ Danno applicato automaticamente…</span>
                        </div>
                      );
                    })()}

                    {/* ── Bleed DoT (Triboli del Ladro) — stack indipendente dal veleno ── */}
                    {!pendingDexSave && !pendingConSave && !pendingControlSave && !pendingSaveDot && !pendingPoisonDoT && pendingBleedDoT && (() => {
                      const dotIcon   = myPlayer?.bleedDoTIcon || "🩸";
                      const dotNoun   = myPlayer?.bleedDoTNoun || "sanguinante";
                      const dotSource = myPlayer?.bleedDoTSourceLabel || "sanguinamento";
                      return (
                        <div className="save-block con">
                          <p className="save-block-label">{dotIcon} Sei {dotNoun}! Subisci {myPlayer?.bleedDoTDice || "1d6"} danni da {dotSource} ({myPlayer?.bleedDoTTurns ?? 1} turno/i rimanenti).</p>
                          <span className="dot-auto-note">⏳ Danno applicato automaticamente…</span>
                        </div>
                      );
                    })()}

                    {/* ── TS Save-DOT (Raggio Avvelenato) ── */}
                    {!pendingDexSave && !pendingConSave && !pendingControlSave && pendingSaveDot && (() => {
                      const sdAbility = myPlayer?.pendingSaveDot?.ability || "con";
                      const sdDC      = myPlayer?.pendingSaveDot?.dc || 13;
                      const sdName    = myPlayer?.pendingSaveDot?.name || "Veleno";
                      const sdDice    = myPlayer?.pendingSaveDot?.dice || "2d6";
                      const sdTurns   = myPlayer?.pendingSaveDot?.turns ?? 3;
                      const sdLbl     = SAVE_LABEL[sdAbility] || sdAbility.toUpperCase();
                      return (
                        <div className="save-block con">
                          <p className="save-block-label">🤢 {sdName}! TS {sdLbl} (CD {sdDC}) — se fallisci subisci {sdDice} ad inizio turno per {sdTurns} turni.</p>
                          <button className="btn-saving-throw" onClick={() => rollSavingThrow(m.matchId, sdAbility, "save_dot")}>
                            🎲 TS {sdLbl}
                          </button>
                        </div>
                      );
                    })()}

                    {/* ── Tiro Salvezza FOR (liberarsi dalla ragnatela) ── */}
                    {isEntangled && !hasPendingSave && (
                      <div className="save-block str">
                        <p className="save-block-label">🕸 Sei intrappolato nella ragnatela! TS FOR per liberarti (CD 15) — il turno passa.</p>
                        <button className="btn-saving-throw" onClick={() => rollSavingThrow(m.matchId, "str", "str_escape")}>
                          🎲 TS Forza (Liberarsi)
                        </button>
                      </div>
                    )}

                    {isControlLost && !pendingControlSave && isMyTurn && (
                      <div className="save-block control-lost">
                        <p className="save-block-label">🌀 Sei sotto controllo! Salti il turno · {(myPlayer?.controlLostTurns ?? 0)} turno/i rimanenti dopo questo.</p>
                        <button className="btn-saving-throw" onClick={() => skipControlTurn(m.matchId)}>
                          ⏭ Salta Turno
                        </button>
                      </div>
                    )}

                    {/* ── Salta turno se il bersaglio è invisibile ── */}
                    {isMyTurn && !hasPendingSave && !isEntangled && !needsEquip && (() => {
                      const tgt = m.players.find(p => p.id === chosenTargetId);
                      if (!tgt?.invisible) return null;
                      return (
                        <div className="save-block control-lost">
                          <p className="save-block-label">👻 {tgt.name} è invisibile — non puoi colpirlo. Salta il turno.</p>
                          <button className="btn-saving-throw" onClick={() => handleSkipForcedTurn(m.matchId, "invisible")}>
                            ⏭ Salta Turno
                          </button>
                        </div>
                      );
                    })()}

                    {/* ── Pannello equip iniziale (gratuito, primo turno) ── */}
                    {needsEquip && !hasPendingSave && !isEntangled && !showWildPicker && (
                      <div className="equip-panel">
                        <div className="equip-panel-title">⚔ Scegli le armi da impugnare</div>
                        <div className="equip-panel-weapons">
                          {myWeaponActions.map(w => {
                            const isSel = currentEquipSel.includes(w.name);
                            return (
                              <button
                                key={w.name}
                                className={`equip-weapon-btn ${isSel ? "sel" : ""}`}
                                onClick={() => {
                                  setEquipSelections(prev => {
                                    const cur = prev[m.matchId] !== undefined ? prev[m.matchId] : [];
                                    if (isSel) return { ...prev, [m.matchId]: cur.filter(n => n !== w.name) };
                                    const wpn = (n) => myWeaponActions.find(x => x.name === n);
                                    // 2H da mischia: esclusiva — solo quest'arma
                                    if (IS_TWO_HANDED_MELEE(w)) return { ...prev, [m.matchId]: [w.name] };
                                    // 2H a distanza: una sola 2H; convive con le armi a una mano
                                    if (w.twoHanded) {
                                      const oneHanded = cur.filter(n => !wpn(n)?.twoHanded);
                                      return { ...prev, [m.matchId]: [w.name, ...oneHanded] };
                                    }
                                    // 1H: rimuove una eventuale 2H da mischia, poi aggiunge
                                    const noMelee2H = cur.filter(n => !IS_TWO_HANDED_MELEE(wpn(n)));
                                    return { ...prev, [m.matchId]: [...noMelee2H, w.name] };
                                  });
                                }}
                              >
                                {w.icon} {w.name}
                                {w.twoHanded && <span className="equip-2h-tag">2 mani</span>}
                                {isSel && " ✓"}
                              </button>
                            );
                          })}
                        </div>
                        {mySnap?.hasShield && !equipHas2H && (
                          <p className="equip-shield-note">
                            {mySnap.hasShield === "legno" ? "🪵 Scudo di Legno" : "🛡 Scudo di Metallo"} attivo (+2 CA)
                          </p>
                        )}
                        {equipHas2H && mySnap?.hasShield && (
                          <p className="equip-shield-note locked">
                            {mySnap.hasShield === "legno" ? "🪵 Scudo di Legno" : "🛡 Scudo di Metallo"} non disponibile con arma a 2 mani
                          </p>
                        )}
                        <button
                          className="btn-confirm-equip"
                          onClick={() => handleEquipWeapons(m.matchId, currentEquipSel)}
                          disabled={currentEquipSel.length === 0}
                        >
                          ✓ Conferma Impugnatura
                        </button>
                      </div>
                    )}

                    {/* ── Pulsanti attacco ── */}
                    {!needsEquip && !hasPendingSave && !isEntangled && !showWildPicker && (
                      chosenTargetId ? (() => {
                        const targetMatchPlayer = m.players.find(p => p.id === chosenTargetId);
                        const targetMaxHp = Math.max(1, targetMatchPlayer?.maxHp ?? snapshots[chosenTargetId]?.stats?.maxHp ?? 70);
                        const targetHpPct = targetMatchPlayer ? (targetMatchPlayer.hp / targetMaxHp) * 100 : 100;
                        // ── Raggruppa azioni per categoria ────────────────────
                        const isRangedWeapon = (a) => a.ranged === true || a.icon === "🏹" || ["Arco","Balestra","Fionda","Giavellotto","Dardo"].some(k => a.name.includes(k));
                        const meleeActions  = currentActions.filter(a => a.type === "weapon" && !isRangedWeapon(a));
                        const rangedActions = currentActions.filter(a => a.type === "weapon" && isRangedWeapon(a));
                        // ── DISTANZA: le armi restano sempre giocabili; la distanza aggiunge scelte ──
                        // mustClose: sei a distanza, l'avversario ti tiene sotto tiro (ha arma a
                        //   distanza) e tu no → puoi CARICARE (attacchi in mischia a svantaggio e
                        //   chiudi) oppure AVVICINARTI (chiudi senza attaccare, opzione sicura).
                        // canKite: sei in mischia, hai un'arma a distanza, l'avversario no e ti
                        //   restano cariche → i tuoi tiri diventano "in arretramento": fai danno a
                        //   SVANTAGGIO, riapri la distanza e consumi 1 carica (max ARENA_KITE_MAX).
                        const _oppSnap          = snapshots[chosenTargetId];
                        const _iThreatenRanged  = PLAYER_HAS_RANGED_WEAPON(myPlayer, mySnap);
                        const _oppThreatRanged  = PLAYER_HAS_RANGED_WEAPON(targetMatchPlayer, _oppSnap);
                        const _distFar          = !m.distanceClosed;
                        const _kiteLeft         = ARENA_KITE_MAX - (myPlayer?.kiteChargesUsed ?? 0);
                        const mustClose         = _distFar && _oppThreatRanged && !_iThreatenRanged;
                        const canKite           = !_distFar && _iThreatenRanged && !_oppThreatRanged && _kiteLeft > 0;
                        const allSkillActions = currentActions.filter(a => (a.type === "skill" || a.type === "passive") && !(action => action.special === "deathblow" && targetHpPct > 20)(a));
                        // Il Ranger ha un compagno: le sue azioni (pet_*) vanno in una sotto-tab dedicata.
                        const isPetAction   = (a) => typeof a.special === "string" && a.special.startsWith("pet_");
                        const petActions    = allSkillActions.filter(isPetAction);
                        const skillActions  = allSkillActions.filter(a => !isPetAction(a));
                        const hasPet        = petActions.length > 0;
                        // Se non c'è pet, la sotto-tab attiva ricade sempre su "skill".
                        const abSub = (abilitaSub === "pet" && hasPet) ? "pet" : "skill";
                        const spellGroups   = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => ({
                          lvl,
                          spells: currentActions.filter(a => a.type === "spell" && a.level === lvl),
                        })).filter(g => g.spells.length > 0);
                        const LEVEL_LABELS = { 0: "Trucchetti", 1: "Livello 1", 2: "Livello 2", 3: "Livello 3", 4: "Livello 4", 5: "Livello 5", 6: "Livello 6", 7: "Livello 7", 8: "Livello 8", 9: "Livello 9" };

                        const renderActionBtn = (action) => {
                          if (action.type === "passive") {
                            return (
                              <div key={action.name} className="btn-action passive" title={action.info}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">Passiva</span>
                              </div>
                            );
                          }
                          if (action.special === "fonte_di_magia") return null; // rendered in outer block
                          if (action.special === "magical_cunning") return null; // rendered in outer block
                          if (action.special === "patto_demoniaco") return null; // rendered in outer block
                          if (action.special === "recupero_arcano") return null; // rendered in outer block
                          if (action.special === "deathblow" && targetHpPct > 20) return null;
                          const isDeathblow = action.special === "deathblow";
                          if (action.special === "heal") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            return (
                              <button key={action.name} className={`btn-action spell heal ${noUses ? "no-uses" : ""}`}
                                disabled={noUses} title={noUses ? "Usi esauriti" : `${action.name} — cura ${action.damage} HP`}
                                onClick={() => !noUses && handleHealSpell(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `+${action.damage} HP`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "control" || action.special === "corona_pazzia") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const _casterSnap = arenaMeta.characterSnapshots?.[currentUser.uid];
                            const _dc      = getSpellSaveDC(_casterSnap);
                            const _ability = SAVE_LABEL[parseSpellSaveAbility(action)] || "SAG";
                            return (
                              <button key={action.name} className={`btn-action spell control ${noUses ? "no-uses" : ""}`}
                                disabled={noUses || !chosenTargetId} title={noUses ? "Usi esauriti" : `${action.name} — TS ${_ability} (CD ${_dc}) o perdi 2 turni`}
                                onClick={() => !noUses && chosenTargetId && handleControlSpell(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `TS ${_ability} CD ${_dc}`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "bardic_inspiration") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.bardicInspirationActive;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed && !alreadyActive ? "Bonus action già usata questo turno" : alreadyActive ? "Già attiva" : noUses ? "Cariche esaurite" : "Bonus action · +1d6 al prossimo tiro per colpire"}
                                onClick={() => !blocked && handleBardicInspiration(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attiva" : baUsed ? "⚡ Usata" : noUses ? "Esaurita" : "+1d6 hit"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "magic_detect") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.magicDetectActive;
                            const mdBonusVal  = action.buffBonus  ?? getMagicDetectBonusForClass(mySnap?.class || "");
                            const mdAttacks   = action.buffAttacks ?? 1;
                            const atkLeft     = myPlayer?.magicDetectAttacks ?? (alreadyActive ? 1 : 0);
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? `Attivo (${atkLeft} attacchi rimanenti)` : noUses ? "Cariche esaurite" : `+${mdBonusVal} ai prossimi ${mdAttacks} attacchi`}
                                onClick={() => !noUses && !alreadyActive && handleMagicDetect(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${atkLeft}x` : noUses ? "Esaurito" : `+${mdBonusVal} hit · ${mdAttacks}x`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "concentrate_buff") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = (myPlayer?.concentrationTurns ?? 0) > 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed && !alreadyActive ? "Bonus action già usata questo turno" : alreadyActive ? `Concentrazione attiva (${myPlayer.concentrationTurns} turni)` : noUses ? "Cariche esaurite" : "Bonus action · +2 danni per 2 turni"}
                                onClick={() => !blocked && handleConcentrate(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.concentrationTurns} turni` : baUsed ? "⚡ Usata" : noUses ? "Esaurita" : "+2 dmg · 2 turni"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "absorb_damage") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.absorbDamageNext;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed && !alreadyActive ? "Bonus action già usata questo turno" : alreadyActive ? "Pronto ad assorbire il prossimo colpo" : noUses ? "Cariche esaurite" : "Bonus action · il prossimo danno subito ti cura dell'80%"}
                                onClick={() => !blocked && handleAbsorbDamage(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Pronto" : baUsed ? "⚡ Usata" : noUses ? "Esaurita" : "Cura 80% prossimo colpo"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "ki_healing") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed ? "Bonus action già usata questo turno" : noUses ? "Cariche esaurite" : "Bonus action · cura 1d8+SAG HP"}
                                onClick={() => !blocked && handleKiHealing(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{baUsed ? "⚡ Usata" : noUses ? "Esaurita" : "1d8+SAG cura"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "pet_market") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const isHealPet = action.petEffect === "heal";
                            const blocked = noUses || baUsed || (!isHealPet && !chosenTargetId);
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed ? "Bonus action già usata questo turno" : noUses ? "Cariche esaurite" : action.info}
                                onClick={() => !blocked && handleMarketPet(m.matchId, isHealPet ? null : chosenTargetId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{baUsed ? "⚡ Usata" : noUses ? "Esaurito" : isHealPet ? `💚 ${action.damage}` : `${action.damage}${action.autoHit ? " auto" : ""}`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "pet_wolf") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || baUsed || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed ? "Bonus action già usata questo turno" : noUses ? "Cariche esaurite" : "Bonus action · 1d8+3 danni"}
                                onClick={() => !blocked && handlePetWolf(m.matchId, chosenTargetId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{baUsed ? "⚡ Usata" : noUses ? "Esaurita" : action.damage}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "pet_spider") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "TS FOR (CD 13): fallisce 2t · supera 1t"}
                                onClick={() => !blocked && handlePetSpider(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurita" : "TS FOR · 1-2t"}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "pet_eagle") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "1d4 + accecato + svantaggio per 3 turni"}
                                onClick={() => !blocked && handlePetEagle(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurita" : `${action.damage} + 🙈`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "pet_drago") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "2d6 danni auto-hit"}
                                onClick={() => !blocked && handlePetDrago(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurita" : `${action.damage}`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "demon_mephit") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || baUsed || !chosenTargetId;
                            const burnDice = action.burnDice ?? "1d8+2";
                            const burnT    = action.burnTurns ?? 3;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed ? "Bonus action già usata questo turno" : noUses ? "Cariche esaurite" : `Bonus action · brucia: ${burnDice} fuoco per ${burnT} turni`}
                                onClick={() => !blocked && handleDemonMephit(m.matchId, chosenTargetId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{baUsed ? "⚡ Usata" : noUses ? "Esaurita" : `🔥 ${burnDice}×${burnT}t`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "stun_strike") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "TS COS o il nemico salta 1 turno"}
                                onClick={() => !blocked && handleStunStrike(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurita" : "TS COS · stun 1t"}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "demon_succubus") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "TS CAR (CD 13): fallisce 3t+svant.3t · supera 1t+svant.2t"}
                                onClick={() => !blocked && handleDemonSuccubus(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurita" : "TS CAR · 1-3t + 🌑"}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "demon_greater") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "Drena 2d12 PF · cura il warlock per la stessa quantità"}
                                onClick={() => !blocked && handleDemonGreater(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `${action.damage} ↺💚`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "construct_golem") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "1d8+3 · prossimo colpo subìto dimezzato"}
                                onClick={() => !blocked && handleConstructGolem(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `${action.damage} 🛡½`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "construct_snake") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : "1d6+3 + 1d6 veleno per 2 turni"}
                                onClick={() => !blocked && handleConstructSnake(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `${action.damage} ☠`}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "armor_forge") {
                            const usesLeft = (myPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses);
                            const noUses = usesLeft <= 0;
                            const alreadyActive = (myPlayer?.armorForgeTurns ?? 0) > 0;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? `Forgia attiva (${myPlayer.armorForgeTurns} turni)` : noUses ? "Cariche esaurite" : "+2 CA per 2 turni"}
                                onClick={() => !noUses && !alreadyActive && handleArmorForge(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.armorForgeTurns}t` : noUses ? "Esaurito" : "+2 CA · 2t"}</span>
                                <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              </button>
                            );
                          }
                          if (action.special === "invisibility") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.invisible;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? "Già invisibile" : noUses ? "Usi esauriti" : `Il nemico non può attaccarti per ${action.invisibilityDuration ?? 1} turn${(action.invisibilityDuration ?? 1) === 1 ? "o" : "i"}`}
                                onClick={() => !noUses && !alreadyActive && handleInvisibility(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attiva" : noUses ? "Esaurita" : "1 turno"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "second_wind") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            return (
                              <button key={action.name}
                                className={`btn-action skill ${noUses ? "no-uses" : ""}`}
                                disabled={noUses}
                                title={noUses ? "Usi esauriti" : "Cura 1d10+5 HP"}
                                onClick={() => !noUses && handleSecondWind(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">1d10+5 cura</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "action_surge") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.actionSurgeActive;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed && !alreadyActive ? "Bonus action già usata questo turno" : alreadyActive ? "Già attivo" : noUses ? "Usi esauriti" : "Bonus action · azione extra questo turno"}
                                onClick={() => !blocked && handleActionSurge(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attivo" : baUsed ? "⚡ Usata" : noUses ? "Esaurito" : "+1 azione"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "rage") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = (myPlayer?.rageTurns ?? 0) > 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed && !alreadyActive ? "Bonus action già usata questo turno" : alreadyActive ? "Furia già attiva" : noUses ? "Cariche esaurite" : `Bonus action · +${rageDamageBonus(getSnapLevel(mySnap))} danno armi per 3 turni`}
                                onClick={() => !blocked && handleRage(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.rageTurns} turni` : baUsed ? "⚡ Usata" : noUses ? "Esaurita" : `+${rageDamageBonus(getSnapLevel(mySnap))} danno · 3 turni`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "mighty_strike") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.mightyStrikePending;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={alreadyActive ? "Attacco Poderoso pronto: attacca ora" : noUses ? "Cariche esaurite" : baUsed ? "Bonus action già usata questo turno" : "Bonus action · vantaggio al prossimo attacco di questo turno"}
                                onClick={() => !blocked && handleMightyStrike(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ vantaggio" : noUses ? "Esaurito" : baUsed ? "⚡ Usata" : "🌟 vant. 1 attacco"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "frenzy") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.frenzyAttackPending;
                            const notRaging = (myPlayer?.rageTurns ?? 0) <= 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed || notRaging;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={alreadyActive ? "Frenesia attiva: attacca con l'arma" : noUses ? "Cariche esaurite" : notRaging ? "Solo in Furia" : baUsed ? "Bonus action già usata questo turno" : "Bonus action · un attacco con l'arma in più (dado + FOR) · a fine Furia svantaggio per 1 turno"}
                                onClick={() => !blocked && handleFrenzy(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ +1 attacco" : noUses ? "Esaurita" : notRaging ? "Solo in Furia" : baUsed ? "⚡ Usata" : "+1 attacco"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "hunter_mark") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = (myPlayer?.hunterMarkTurns ?? 0) > 0;
                            const baUsed = !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baUsed;
                            return (
                              <button key={action.name}
                                className={`btn-action skill bonus-action ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baUsed && !alreadyActive ? "Bonus action già usata questo turno" : alreadyActive ? "Marchio già attivo" : noUses ? "Cariche esaurite" : "Bonus action · +3 ai tiri per colpire per 3 turni"}
                                onClick={() => !blocked && handleHunterMark(m.matchId, action)}>
                                <span className="bonus-action-tag">⚡ Bonus</span>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.hunterMarkTurns} turni` : baUsed ? "⚡ Usata" : noUses ? "Esaurito" : "+3 hit · 3 turni"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "weapon_lock") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action spell ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : `Arroventa l'arma equipaggiata del nemico per ${action.weaponLockTurns ?? 2} turni (potrà cambiare su un'altra arma)`}
                                onClick={() => !blocked && handleWeaponLock(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `🔒 armi · ${action.weaponLockTurns ?? 2}t`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "disadvantage_enemy") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            return (
                              <button key={action.name}
                                className={`btn-action spell ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : `Svantaggio agli attacchi del nemico per ${action.disadvantageTurns ?? 3} turni`}
                                onClick={() => !blocked && handleDisadvEnemy(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `🌑 svant. · ${action.disadvantageTurns ?? 3}t`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "self_advantage") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = (myPlayer?.selfAdvTurns ?? 0) > 0;
                            const advTurns = action.advantageTurns ?? 2;
                            return (
                              <button key={action.name}
                                className={`btn-action spell ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? `Già attivo (${myPlayer.selfAdvTurns} turni rimanenti)` : noUses ? "Cariche esaurite" : `Vantaggio ai prossimi ${advTurns} attacchi`}
                                onClick={() => !noUses && !alreadyActive && handleSelfAdvantage(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.selfAdvTurns}t` : noUses ? "Esaurito" : `🌟 vant. · ${advTurns}t`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "extra_turn") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.extraTurnActive;
                            const baBlocked = !!action.bonusAction && !!myPlayer?.bonusActionUsed;
                            const blocked = noUses || alreadyActive || baBlocked;
                            return (
                              <button key={action.name}
                                className={`btn-action spell ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={baBlocked ? "Bonus action già usata questo turno" : alreadyActive ? "Già attivo" : noUses ? "Cariche esaurite" : "Bonus action · doppio turno il prossimo turno"}
                                onClick={() => !blocked && handleExtraTurn(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attivo" : baBlocked ? "BA usata" : noUses ? "Esaurito" : "+1 azione"}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "save_buff") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = (myPlayer?.saveBuffAttacks ?? 0) > 0;
                            return (
                              <button key={action.name}
                                className={`btn-action spell ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? `Attivo (${myPlayer.saveBuffAttacks} TS rimanenti)` : noUses ? "Cariche esaurite" : `+${action.tsBonus ?? 3} ai prossimi ${action.tsAttacks ?? 3} TS`}
                                onClick={() => !noUses && !alreadyActive && handleSaveBuff(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? `✓ ${myPlayer.saveBuffAttacks} TS` : noUses ? "Esaurito" : `+${action.tsBonus ?? 3} TS · ${action.tsAttacks ?? 3}x`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "save_dot") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const blocked = noUses || !chosenTargetId;
                            const _casterSnap = arenaMeta.characterSnapshots?.[currentUser.uid];
                            const _dc      = action.saveDotDC ?? getSpellSaveDC(_casterSnap);
                            const _ability = SAVE_LABEL[action.saveDotAbility || "con"];
                            return (
                              <button key={action.name}
                                className={`btn-action spell ${blocked ? "no-uses" : ""}`}
                                disabled={blocked}
                                title={noUses ? "Cariche esaurite" : `${action.saveDotDamage || "2d6"} a inizio turno · TS ${_ability} CD ${_dc}`}
                                onClick={() => !blocked && handleSaveDotSpell(m.matchId, chosenTargetId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `TS ${_ability} · ${action.saveDotDamage || "2d6"}/turno`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "shield_buff") {
                            const sbBonus = action.shieldBuffBonus ?? 3;
                            const sbTurns = action.shieldBuffTurns ?? 3;
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            return (
                              <button key={action.name} className={`btn-action skill ${noUses ? "no-uses" : ""}`}
                                disabled={noUses}
                                title={noUses ? "Cariche esaurite" : `+${sbBonus} CA per ${sbTurns} turni`}
                                onClick={() => !noUses && handleShieldSkill(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : `+${sbBonus} CA · ${sbTurns}t`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "save_faith") {
                            const sfBonus = action.saveFaithBonus ?? 2;
                            const sfTurns = action.saveFaithTurns ?? 2;
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const active = (myPlayer?.saveFaithTurns ?? 0) > 0;
                            return (
                              <button key={action.name} className={`btn-action skill ${noUses ? "no-uses" : ""}`}
                                disabled={noUses}
                                title={noUses ? "Cariche esaurite" : `+${sfBonus} a TUTTI i tiri salvezza per ${sfTurns} turni`}
                                onClick={() => !noUses && handleSaveFaith(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : active ? `🛡 +${sfBonus} TS · ${myPlayer?.saveFaithTurns}t` : `+${sfBonus} TS · ${sfTurns}t`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "dmg_buff") {
                            const dbBonus = action.aidDmgBonus ?? 1;
                            const dbTurns = action.aidDmgTurns ?? 2;
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const active = (myPlayer?.aidDmgTurns ?? 0) > 0;
                            return (
                              <button key={action.name} className={`btn-action skill ${noUses ? "no-uses" : ""}`}
                                disabled={noUses}
                                title={noUses ? "Cariche esaurite" : `+${dbBonus} al danno per ${dbTurns} turni`}
                                onClick={() => !noUses && handleDmgBuff(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{noUses ? "Esaurito" : active ? `⚔ +${dbBonus} dmg · ${myPlayer?.aidDmgTurns}t` : `+${dbBonus} dmg · ${dbTurns}t`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "aid_buff") {
                            const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                            const noUses = usesLeft !== null && usesLeft <= 0;
                            const alreadyActive = !!myPlayer?.aidBuff;
                            const aidBonusVal = getAidBonusForClass(mySnap?.class || "");
                            return (
                              <button key={action.name} className={`btn-action skill ${noUses || alreadyActive ? "no-uses" : ""}`}
                                disabled={noUses || alreadyActive}
                                title={alreadyActive ? "Già attivo" : noUses ? "Usi esauriti" : `+${aidBonusVal} al prossimo tiro per colpire`}
                                onClick={() => !noUses && !alreadyActive && handleAidBuff(m.matchId, action)}>
                                <span className="action-icon">{action.icon}</span>
                                <span className="action-name">{action.name}</span>
                                <span className="action-dice">{alreadyActive ? "✓ Attivo" : noUses ? "Esaurito" : `+${aidBonusVal} hit`}</span>
                                {usesLeft !== null && <span className={`action-uses-badge ${noUses ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>}
                              </button>
                            );
                          }
                          if (action.special === "lay_of_hands") {
                            return null; // rendered separately outside renderActionBtn
                          }
                          const usesLeft = readSpellUsesLeft(myPlayer, mySnap, action);
                          const noUsesLeft = usesLeft !== null && usesLeft <= 0;
                          const isWeapon   = action.type === "weapon";
                          const isEquipped = !isWeapon || wildShapeForm || equippedNames.includes(action.name);
                          const targetIsInvisible = m.players.find(p => p.id === chosenTargetId)?.invisible ?? false;
                          const isOffensive = action.special !== "heal" && action.special !== "shield_buff" && action.special !== "aid_buff" && action.special !== "save_faith" && action.special !== "dmg_buff";
                          const disabledByInvis = targetIsInvisible && isOffensive && isEquipped;
                          const stealthTurnsLeft = action.special === "stealth" ? readStealthAnyTurns(myPlayer) : 0;
                          const isStealthActive = stealthTurnsLeft > 0;
                          // 🗡 Ladro: una sola arma per mano e una sola abilità (Furtivo/Triboli) a turno.
                          const isRogueMe = isRogueClass((mySnap?.class || "").toLowerCase());
                          const handUsedThisTurn = isRogueMe && isWeapon && isEquipped && (myPlayer?.turnWeaponsUsed || []).includes(action.name);
                          const skillSlotUsed = isRogueMe && (action.special === "sneak_attack" || action.special === "triboli") && !!myPlayer?.turnSkillUsed;
                          const rogueBlocked = handUsedThisTurn || skillSlotUsed;
                          // 🔩 Arma arroventata: bloccata SOLO se è quella equipaggiata al momento del blocco.
                          // Un'arma non equipaggiata resta cliccabile (switch) e poi usabile.
                          const wLockNames = myPlayer?.weaponLockNames;
                          const isWeaponLocked = (myPlayer?.weaponLockTurns ?? 0) > 0 && isWeapon && isEquipped
                            && (!wLockNames || wLockNames.length === 0 ? true : wLockNames.includes(action.name));
                          // 🥋 Monaco a mani nude: l'etichetta mostra il colpo del momento
                          // (Pugno al 1° attacco, Calcio al 2°), pur restando "Mani nude" come arma.
                          const monkDisp = action.unarmedMonk
                            ? resolveMonkUnarmed(action, myPlayer?.multiActionsUsed ?? 0, mySnap?.arenaBuffs)
                            : null;
                          const dispName = monkDisp?.name ?? action.name;
                          const dispIcon = monkDisp?.icon ?? action.icon;
                          const dispDmg  = monkDisp?.damage ?? action.damage;
                          const dispStat = monkDisp?.statKey ?? action.statKey;
                          // ✨ Incantesimo a danno: il bersaglio salva nella caratteristica dello spell.
                          const _isDmgSpell  = isSaveDamageSpell(action);
                          const _spellCast   = _isDmgSpell ? getSpellCast(action) : null;
                          const _dmgSpellTs  = _spellCast ? SAVE_LABEL[_spellCast.save] : null;
                          const _dmgSpellDc  = _isDmgSpell ? getSpellSaveDC(mySnap) : null;
                          const _spellAtkBon = _isDmgSpell ? getSpellAttackBonus(mySnap) : null;
                          // Etichetta breve della meccanica per il bottone.
                          const _spellMechLabel = _spellCast
                            ? (_spellCast.cast === "attack"      ? `🎯 +${_spellAtkBon} colpire`
                             : _spellCast.cast === "auto"        ? "✨ colpisce sempre"
                             : _spellCast.cast === "save_half"   ? `TS ${_dmgSpellTs} CD ${_dmgSpellDc} · ½`
                             :                                     `TS ${_dmgSpellTs} CD ${_dmgSpellDc}`)
                            : null;
                          return (
                            <button
                              key={action.name}
                              className={`btn-action ${action.type} ${isWeapon && !wildShapeForm ? (isEquipped ? "equipped" : "unequipped") : ""} ${noUsesLeft || disabledByInvis || isStealthActive || rogueBlocked || isWeaponLocked ? "no-uses" : ""} ${isDeathblow ? "deathblow-ready" : ""} ${action.special === "smite" && !noUsesLeft ? "smite-active" : ""} ${isStealthActive ? "stealth-active" : ""}`}
                              disabled={noUsesLeft || disabledByInvis || isStealthActive || rogueBlocked || isWeaponLocked}
                              title={isStealthActive
                                ? `🌑 Furtività attiva — ${stealthTurnsLeft} turno/i rimasti`
                                : isWeaponLocked
                                ? `🔩 ${action.name} è incandescente — cambia su un'altra arma (${myPlayer?.weaponLockTurns ?? 0} turno/i)`
                                : handUsedThisTurn
                                ? "🗡 Arma già usata questo turno — usa l'altra mano"
                                : skillSlotUsed
                                ? "🗡 Abilità già usata questo turno (1 tra Attacco Furtivo / Triboli)"
                                : noUsesLeft
                                ? `${action.name} — Usi esauriti`
                                : disabledByInvis ? "👻 Bersaglio invisibile — solo guarigione disponibile"
                                : action.special === "web" ? "Ragnatela — intrappola: TS FOR (CD 13) ogni turno per liberarsi"
                                : action.special === "triboli" ? "Triboli — TS DES avversario: fallito → svantaggio + sanguinamento 1d6/turno 2 turni; riuscito → solo 1 turno"
                                : action.special === "poison" ? `Veleno — ${action.damage} danni + TS COS`
                                : action.special === "deathblow" ? `Colpo Mortale — ${action.damage} +DES (solo ≤20% HP)`
                                : action.special === "stealth" ? `Furtività — vantaggio ai tuoi prossimi 2 attacchi`
                                : !isEquipped ? "Clicca per impugnare (spende il turno)"
                                : _isDmgSpell ? (_spellCast.cast === "attack" ? `${dispDmg} danni · tiro per colpire +${_spellAtkBon} vs CA`
                                                 : _spellCast.cast === "auto" ? `${dispDmg} danni · colpisce automaticamente`
                                                 : _spellCast.cast === "save_half" ? `${dispDmg} danni · TS ${_dmgSpellTs} (CD ${_dmgSpellDc}): supera = metà danni`
                                                 : `${dispDmg} danni · TS ${_dmgSpellTs} (CD ${_dmgSpellDc}): supera = nessun danno`)
                                : `+${action.hitBonus}${dispStat ? ` +${dispStat.toUpperCase()}` : ""} | ${dispDmg}${dispStat ? ` +${dispStat.toUpperCase()}` : ""}`}
                              onClick={() => {
                                if (noUsesLeft || disabledByInvis || isStealthActive || rogueBlocked || isWeaponLocked) return;
                                isEquipped
                                  ? handleAttack(m.matchId, chosenTargetId, action)
                                  : handleSwitchWeapon(m.matchId, action.name);
                              }}
                            >
                              <span className="action-icon">{dispIcon}</span>
                              <span className="action-name">{dispName}</span>
                              <span className="action-dice">
                                {isStealthActive ? `🌑 ${stealthTurnsLeft}t attiva`
                                  : isWeaponLocked ? "🔩 Incandescente"
                                  : handUsedThisTurn ? "✓ Usata"
                                  : skillSlotUsed ? "✓ Abilità usata"
                                  : noUsesLeft ? "Esaurito"
                                  : disabledByInvis ? "👻 Invisibile"
                                  : !isEquipped ? "🔄 Cambia"
                                  : action.special === "web" ? "🕸 Intrappola"
                                  : action.special === "triboli" ? "🎲 TS DES · 🩸 svant."
                                  : action.special === "poison" ? `${action.damage} +TS COS`
                                  : _isDmgSpell ? `${dispDmg} · ${_spellMechLabel}`
                                  : `${dispDmg}${dispStat ? ` +${dispStat.toUpperCase()}` : ""}`}
                              </span>
                              {usesLeft !== null && (
                                <span className={`action-uses-badge ${noUsesLeft ? "empty" : ""}`}>{usesLeft}/{action.maxUses}</span>
                              )}
                            </button>
                          );
                        };

                        return (
                          <div className="action-groups">
                            {dock === "attacchi" && meleeActions.length > 0 && (
                              <div className="action-group">
                                <div className={`action-group-label melee${mustClose ? " danger" : ""}`}>
                                  {mustClose ? "⚔ Carica — a svantaggio" : "⚔ Mischia"}
                                </div>
                                {mustClose && (
                                  <div className="action-group-hint">Sei sotto tiro: attaccare in mischia ora è a svantaggio, ma chiude la distanza. Oppure avvicìnati (sotto) senza attaccare.</div>
                                )}
                                <div className="action-buttons">{meleeActions.map(renderActionBtn)}</div>
                              </div>
                            )}
                            {dock === "attacchi" && mustClose && (
                              <div className="action-group">
                                <div className="action-group-label melee">🏃 Manovra</div>
                                <div className="action-buttons">
                                  <button
                                    className="btn-action move-close"
                                    title="Chiudi la distanza senza attaccare: eviti lo svantaggio e dal turno seguente colpisci normalmente. (usa il turno)"
                                    onClick={() => handleMoveClose(m.matchId)}
                                  >
                                    <span className="action-icon">🏃</span>
                                    <span className="action-name">Avvicìnati</span>
                                    <span className="action-dice">Chiudi, niente danno</span>
                                  </button>
                                </div>
                              </div>
                            )}
                            {dock === "attacchi" && rangedActions.length > 0 && (
                              <div className="action-group">
                                <div className={`action-group-label ranged${canKite ? " kite" : ""}`}>
                                  {canKite ? `🏹 Tiro in arretramento ×${_kiteLeft}` : "🏹 Distanza"}
                                </div>
                                {canKite && (
                                  <div className="action-group-hint">Spari a <strong>svantaggio</strong> e riapri la distanza (l'avversario dovrà inseguirti). Ti restano <strong>{_kiteLeft}</strong> {_kiteLeft === 1 ? "carica" : "cariche"} di arretramento.</div>
                                )}
                                <div className="action-buttons">{rangedActions.map(renderActionBtn)}</div>
                              </div>
                            )}
                            {dock === "attacchi" && meleeActions.length === 0 && rangedActions.length === 0 && (
                              <div className="combat-dock-empty">Nessuna arma disponibile.</div>
                            )}
                            {dock === "magie" && spellGroups.map(({ lvl, spells }) => (
                              <div key={lvl} className="action-group">
                                <div className={`action-group-label spell-lv${lvl}`}>
                                  {lvl === 0 ? "✨" : "🔮"} {LEVEL_LABELS[lvl]}
                                  {usesSharedSpellSlots(mySnap) && (
                                    lvl === 0
                                      ? <span style={{ opacity: 0.85 }}> · ∞</span>
                                      : <span style={{ opacity: 0.85 }}> · {readSpellSlots(myPlayer, lvl)}/{SORC_SLOTS_MAX} slot</span>
                                  )}
                                </div>
                                <div className="action-buttons">{spells.map(renderActionBtn)}</div>
                              </div>
                            ))}
                            {dock === "magie" && spellGroups.length === 0 && (
                              <div className="combat-dock-empty">Nessun incantesimo disponibile.</div>
                            )}
                            {dock === "abilita" && hasPet && (
                              <div className="abilita-subtabs" role="tablist">
                                <button
                                  type="button" role="tab" aria-selected={abSub === "skill"}
                                  className={`abilita-subtab${abSub === "skill" ? " active" : ""}`}
                                  onClick={() => setAbilitaSub("skill")}
                                >⚡ Abilità</button>
                                <button
                                  type="button" role="tab" aria-selected={abSub === "pet"}
                                  className={`abilita-subtab${abSub === "pet" ? " active" : ""}`}
                                  onClick={() => setAbilitaSub("pet")}
                                >🐾 Compagno</button>
                              </div>
                            )}
                            {dock === "abilita" && abSub === "skill" && skillActions.length > 0 && (
                              <div className="action-group">
                                <div className="action-group-label skill">⚡ Abilità</div>
                                <div className="action-buttons">{skillActions.map(renderActionBtn)}</div>
                              </div>
                            )}
                            {dock === "abilita" && abSub === "skill" && skillActions.length === 0 && (
                              <div className="combat-dock-empty">Nessuna abilità disponibile.</div>
                            )}
                            {dock === "abilita" && abSub === "pet" && hasPet && (
                              <div className="action-group">
                                <div className="action-group-label skill">🐾 Compagno</div>
                                <div className="action-buttons">{petActions.map(renderActionBtn)}</div>
                              </div>
                            )}
                          </div>
                        );
                      })() : (
                        <div className="no-target-msg">Nessun bersaglio disponibile.</div>
                      )
                    )}

                    {/* ── Indicatore multi-azione (Monaco x3, Ladro x3) ── */}
                    {!hasPendingSave && (() => {
                      const maxActs = getMaxActionsPerTurn(mySnap, myPlayer);
                      if (maxActs <= 1) return null;
                      const used = myPlayer?.multiActionsUsed ?? 0;
                      const isMonk = isMonkClass((mySnap?.class || "").toLowerCase());
                      const label = isMonk ? "🥋 Stile Monaco" : "🗡 Doppie Lame";
                      const canEndEarly = used >= 1;
                      return (
                        <div className="dual-action-row">
                          <span className="dual-action-label">
                            {label} · Azione {used + 1} / {maxActs}
                          </span>
                          {canEndEarly && (
                            <button
                              className="btn-end-dual-turn"
                              onClick={() => endMultiActionTurn(m.matchId)}
                              title="Salta le azioni rimanenti e termina il turno"
                            >
                              ⏭ Termina Turno
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Salta turno (disponibile per tutti, in qualsiasi arena) ── */}
                    {!hasPendingSave && (myPlayer?.multiActionsUsed ?? 0) === 0 && (
                      <div className="dual-action-row">
                        <button
                          className="btn-end-dual-turn"
                          onClick={() => handleSkipTurn(m.matchId)}
                          title="Passa il turno senza fare nulla"
                        >
                          ⏭ Salta Turno
                        </button>
                      </div>
                    )}

                    {/* ── Oggetti (Azione Gratuita · 1/turno) — scheda "Oggetti" del dock ── */}
                    {dock === "oggetti" && !needsEquip && !hasPendingSave && !isEntangled && !showWildPicker && (() => {
                      const myItemKeys = arenaMeta.characterSnapshots?.[currentUser?.uid]?.selectedItemKeys || [];
                      // Consumabili della Bottega settimanale (solo snapshot torneo).
                      const myMarketItems = arenaMeta.characterSnapshots?.[currentUser?.uid]?.marketConsumables || [];
                      if (myItemKeys.length === 0 && myMarketItems.length === 0) return <div className="combat-dock-empty">Nessun oggetto nello zaino.</div>;
                      const myItemUsesLeft = myPlayer?.itemUsesLeft || {};
                      const itemCountsInSnap = {};
                      myItemKeys.forEach(k => { itemCountsInSnap[k] = (itemCountsInSnap[k] || 0) + 1; });
                      const itemUsed = !!myPlayer?.itemUsedThisTurn;
                      return (
                        <div className="items-row">
                          {Object.entries(itemCountsInSnap).map(([key]) => {
                            const item   = ARENA_ITEMS.find(i => i.key === key);
                            if (!item) return null;
                            const uses   = myItemUsesLeft[key] ?? 0;
                            const total  = itemCountsInSnap[key];
                            const needsTarget = key === "bomba" || key === "pozione_veleno";
                            const disabled    = uses <= 0 || (needsTarget && !chosenTargetId) || itemUsed;
                            const titleStr = itemUsed ? "Oggetto già usato questo turno" : `${item.info} · azione gratuita (1/turno)`;
                            return (
                              <button key={key}
                                className={`btn-item bonus-action ${uses <= 0 || itemUsed ? "no-uses" : ""}`}
                                disabled={disabled}
                                title={titleStr}
                                onClick={() => useItem(m.matchId, key, needsTarget ? chosenTargetId : null)}>
                                <span className="bonus-action-tag">🆓 Gratis</span>
                                <span className="item-icon">{item.icon}</span>
                                <span className="item-name">{item.name}</span>
                                <span className="item-uses">{itemUsed ? "⏳" : `${uses}/${total}`}</span>
                              </button>
                            );
                          })}
                          {myMarketItems.map(item => {
                            const uses  = myItemUsesLeft[item.key] ?? (item.uses ?? 0);
                            const total = item.uses ?? 1;
                            const needsTarget = item.needsTarget ?? (item.effect === "damage" || item.effect === "malus");
                            const disabled    = uses <= 0 || (needsTarget && !chosenTargetId) || itemUsed;
                            const titleStr = itemUsed ? "Oggetto già usato questo turno" : `${item.info} · azione gratuita (1/turno)`;
                            return (
                              <button key={item.key}
                                className={`btn-item bonus-action ${uses <= 0 || itemUsed ? "no-uses" : ""}`}
                                disabled={disabled}
                                title={titleStr}
                                onClick={() => useItem(m.matchId, item.key, needsTarget ? chosenTargetId : null)}>
                                <span className="bonus-action-tag">🆓 Gratis</span>
                                <span className="item-icon">{item.icon}</span>
                                <span className="item-name">{item.name}</span>
                                <span className="item-uses">{itemUsed ? "⏳" : `${uses}/${total}`}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className={`match-log${combatLogExpanded ? " cv-log-expanded" : ""}`}>
                  <button type="button" className="match-log-head" onClick={() => setCombatLogExpanded(v => !v)} aria-expanded={combatLogExpanded} title={combatLogExpanded ? "Riduci la cronaca" : "Ingrandisci la cronaca"}>
                    <span className="match-log-icon" aria-hidden="true">📜</span>
                    <span className="match-log-title">Cronaca dello Scontro</span>
                    <span className="match-log-count">{(m.logs || []).length} {(m.logs || []).length === 1 ? "evento" : "eventi"}</span>
                    <span className="cv-log-expand-ico" aria-hidden="true">{combatLogExpanded ? "▾" : "▴"}</span>
                  </button>
                  <div className="match-log-scroll">
                    {[...(m.logs || [])].reverse().map((l, i) => {
                      const text = displayLog(l, currentUser?.uid);
                      const isLatest = i === 0;
                      const isAttLog = typeof l === 'object' && l.attId === currentUser?.uid;
                      const isDefLog = typeof l === 'object' && l.defId === currentUser?.uid;
                      // Danno-su-turno automatico (veleno / sanguinamento): sfondo vivido.
                      const isDotLog = typeof text === 'string' && text.includes("subisce il");
                      const ts = typeof l === 'object' && l.ts
                        ? new Date(l.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : null;
                      return (
                        <p key={i} className={`log-entry ${isLatest ? "latest" : ""} ${isAttLog ? "log-attacker" : ""} ${isDefLog ? "log-defender" : ""} ${isDotLog ? "log-dot" : ""}`}>
                          {ts && <span className="log-ts">{ts}</span>}
                          {renderLogWithDice(text)}
                          <HpTrace entry={l} players={m.players} />
                        </p>
                      );
                    })}
                    {(m.logs || []).length === 0 && (
                      <p className="match-log-empty">— Il combattimento non è ancora iniziato —</p>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
        </ArenaModal>
        );
      })()}

    </div>
  );
}
