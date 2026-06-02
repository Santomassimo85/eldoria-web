// ─────────────────────────────────────────────────────────────────────────
// BossTactics — the real Firebase-backed tactical World Boss fight.
//
// Live battle state lives in `battle_state/current` (map + units + turn order).
// Players are spawned by the master from the live `characters` collection; each
// player rolls their own initiative, the master auto-rolls enemies, and the
// fight starts once everyone has rolled. On a hero's turn that player controls;
// on an enemy's turn the master controls. Actions come from each PG's real
// weapons + spells (features hidden). The battle log reuses world_boss_chat.
//
// Route: /boss-tactics  (top nav is hidden here for space)
// ─────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { db } from "../../firebase";
import {
  doc, setDoc, onSnapshot, collection, addDoc, serverTimestamp, runTransaction,
} from "firebase/firestore";
import { useAuth } from "../../AuthContext";
import IsoBoard from "./IsoBoard";
import BattleChat from "./BattleChat";
import { showD20Roll } from "../../components/DiceRoll";
import {
  computeBoardMetrics, computePaths, reconstructPath,
  manhattan, tilesWithinRange, tileAt, TERRAINS, DEFAULT_MOVE,
} from "./isoCore";
import {
  BATTLE_REF, BOSS_SYSTEM_UID, emptyBattle, defaultBattleMap,
  makePlayerUnit, makeBossUnit, makeMinionUnit,
  unitDone, sideAllDone, resetSide, txnBattle,
  PLAYER_PHASE_MS, ENEMY_PHASE_MS,
  rollDie, rollFormula, detectSpellIntent, actionRange, battleActions,
  spellAoE, aoeCells, SAVE_LABEL,
} from "./battleModel";
import "./BossTactics.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
// Human label for a phase window (so log text follows the real constant, even
// with the temporary 5-min test timers).
const fmtPhase = (ms) => (ms >= 3600000 ? `${Math.round(ms / 3600000)}h` : `${Math.round(ms / 60000)} min`);

export default function BossTactics() {
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === MASTER_EMAIL;

  const [battle, setBattle] = useState(null);
  const [charData, setCharData] = useState(null);
  const [players, setPlayers] = useState([]);   // all characters (master setup)
  const [bosses, setBosses] = useState([]);
  const [minionLib, setMinionLib] = useState([]); // reusable minion templates
  const [savedMaps, setSavedMaps] = useState([]); // authored maps (battle_meta kind:map)
  const [selMapId, setSelMapId] = useState("");

  // setup selections (master)
  const [selPlayerIds, setSelPlayerIds] = useState([]);
  const [bossDex, setBossDex] = useState("0");
  const [minions, setMinions] = useState([]);    // [{name,hp,ac,dex,atkDice,atkBonus,atkRange}]
  const [bossMsg, setBossMsg] = useState("");

  // view
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [mode, setMode] = useState("idle");      // idle | move | act
  const [selAction, setSelAction] = useState(null);
  const [aimHover, setAimHover] = useState(null);     // {x,y} blast centre previewed on hover (AoE, desktop)
  const [aimCenter, setAimCenter] = useState(null);   // {x,y} blast centre CHOSEN (awaiting Conferma)
  const [selEnemyId, setSelEnemyId] = useState(null); // enemy the master is driving (enemies phase)
  const [busy, setBusy] = useState(false);
  const [animUnit, setAnimUnit] = useState(null); // local walk override {id,x,y}
  const [vfx, setVfx] = useState([]);             // transient pixel effects [{id,x,y,kind}]
  const prevHpRef = useRef({});                    // last-seen hp/dead per unit (for VFX diffing)
  const vfxIdRef = useRef(0);
  const lastAoeFxRef = useRef(null);               // last-applied battle.aoeFx id (dedupe dome spawns)
  const lastFxRef = useRef(null);                  // last-applied battle.fxEvent id (slash/arrow/buff…)
  const [showBar, setShowBar] = useState(false);  // top menu hidden by default, recalled via ☰
  const [rosterOpen, setRosterOpen] = useState(true); // turn/action counter panel (test aid)
  const [nowTs, setNowTs] = useState(() => Date.now()); // ticks each second for the turn timer
  const autoPassedRef = useRef(null);              // turnDeadline already auto-passed (dedupe)

  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const topbarRef = useRef(null);
  const menuFabRef = useRef(null);

  // Close the top menu when clicking anywhere outside it (but not on the ☰
  // button, whose own handler toggles it). Uses a document listener so it
  // doesn't depend on the board's transformed stacking context.
  useEffect(() => {
    if (!showBar) return;
    const onDown = (e) => {
      if (topbarRef.current?.contains(e.target)) return;
      if (menuFabRef.current?.contains(e.target)) return;
      setShowBar(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [showBar]);

  // ── Subscriptions ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(BATTLE_REF(), (snap) => setBattle(snap.exists() ? snap.data() : null));
    return () => unsub();
  }, []);
  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(doc(db, "characters", currentUser.uid), (snap) => setCharData(snap.data()));
  }, [currentUser]);
  // Loaded for ALL clients (not just master) so sprites/avatars can be resolved
  // locally instead of being embedded in the battle doc (which would blow past
  // Firestore's 1 MB document limit).
  useEffect(() => {
    return onSnapshot(collection(db, "characters"), (snap) =>
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);
  useEffect(() => {
    return onSnapshot(collection(db, "bosses"), (snap) =>
      setBosses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.isActive)));
  }, []);
  useEffect(() => {
    return onSnapshot(collection(db, "player_sprites"), (snap) =>
      setMinionLib(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);
  useEffect(() => {
    if (!isMaster) return;
    return onSnapshot(collection(db, "battle_meta"), (snap) =>
      setSavedMaps(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.kind === "map")));
  }, [isMaster]);

  const map = battle?.map || defaultBattleMap();
  const units = useMemo(() => battle?.units || [], [battle]);

  // Resolve a unit's images from the source collections (not stored in the doc).
  const spriteFor = useCallback((u) => {
    if (!u) return {};
    if (u.kind === "player") {
      const c = players.find((p) => p.id === u.uid);
      return { sprite: c?.spriteUrl || c?.image || null, deadSprite: c?.deadSpriteUrl || c?.spriteUrl || c?.image || null, avatar: c?.image || c?.spriteUrl || null };
    }
    if (u.kind === "boss") {
      const b = bosses.find((x) => x.id === u.bossId) || bosses[0];
      return { sprite: b?.imageUrl || null, deadSprite: b?.deadImageUrl || b?.imageUrl || null, avatar: b?.imageUrl || b?.image || null };
    }
    const t = minionLib.find((x) => x.id === u.tplId);
    return { sprite: t?.spriteUrl || null, deadSprite: t?.deadSpriteUrl || t?.spriteUrl || null, avatar: t?.spriteUrl || null };
  }, [players, bosses, minionLib]);

  // Rendered units: raw units enriched with images, plus the local walk override.
  const displayUnits = useMemo(
    () => units.map((u) => {
      const e = { ...u, ...spriteFor(u) };
      return animUnit && u.id === animUnit.id ? { ...e, x: animUnit.x, y: animUnit.y } : e;
    }),
    [units, animUnit, spriteFor]
  );
  const fightStarted = battle?.fightStarted === true;
  const phase = battle?.phase || "setup";
  const isOver = phase === "over";

  // Free-order model: during "players" each player controls THEIR own hero;
  // during "enemies" the master drives one enemy at a time. The single unit you
  // currently command is `controlledUnit` (aliased to activeUnit so the HUD,
  // highlights and action picker below keep working unchanged).
  const myHero = useMemo(
    () => units.find((u) => u.side === "hero" && u.uid === currentUser?.uid),
    [units, currentUser]
  );
  const controlledEnemy = useMemo(() => {
    if (!isMaster || phase !== "enemies") return null;
    const living = units.filter((u) => u.side === "enemy" && !u.dead);
    return living.find((u) => u.id === selEnemyId && !unitDone(u))
        || living.find((u) => !unitDone(u)) || null;
  }, [isMaster, phase, units, selEnemyId]);

  const controlledUnit = phase === "players" ? myHero : controlledEnemy;
  const canAct =
    fightStarted && !isOver && !busy && controlledUnit && !controlledUnit.dead &&
    !unitDone(controlledUnit) &&
    ((phase === "players" && controlledUnit.side === "hero" && controlledUnit.uid === currentUser?.uid) ||
     (phase === "enemies" && isMaster && controlledUnit.side === "enemy"));

  // Back-compat aliases so the rest of the component (HUD / highlights / action
  // picker) reads naturally without a sweeping rename.
  const activeUnit = controlledUnit;
  const isMyTurn = canAct;

  // actions available to whoever controls the active unit
  const myActions = useMemo(() => {
    if (!activeUnit) return [];
    if (activeUnit.side === "hero") return battleActions(charData);
    if (activeUnit.kind === "boss") {
      const boss = bosses.find((b) => b.id === activeUnit.bossId) || bosses[0];
      return (boss?.actions || []).filter((a) => a?.name);
    }
    return [{ name: activeUnit.atkName || "Attacco", category: "Armi", damage: activeUnit.atkDice, bonus: activeUnit.atkBonus, range: activeUnit.atkRange }];
  }, [activeUnit, charData, bosses]);

  // ── Camera (same machinery as the prototype) ─────────────────────────────
  const metrics = useMemo(() => computeBoardMetrics(map, rotation), [map, rotation]);
  const fit = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const s = Math.min((vp.clientWidth - 24) / metrics.boardW, (vp.clientHeight - 24) / metrics.boardH);
    const c = Math.max(0.2, Math.min(2, s));
    setScale(c);
    setPan({ x: (vp.clientWidth - metrics.boardW * c) / 2, y: (vp.clientHeight - metrics.boardH * c) / 2 });
  }, [metrics]);
  // Fit the camera ONCE when the board first appears, and on DELIBERATE view
  // changes (board rotation, window resize) — never on battle/unit updates, so a
  // player's zoom & pan are never yanked away after a move/attack. (battle?.map
  // is a fresh object on every Firestore snapshot, which is why the old `[fit]`
  // dependency refit the camera after every action.)
  const fitRef = useRef(fit);
  useEffect(() => { fitRef.current = fit; });
  const didFitRef = useRef(false);
  useEffect(() => {
    if (!battle?.active) { didFitRef.current = false; return; }
    if (didFitRef.current) return;
    didFitRef.current = true;
    fitRef.current();
  }, [battle?.active]);
  useEffect(() => {
    fitRef.current();                                 // refit on a deliberate rotate
    const onResize = () => fitRef.current();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [rotation]);

  const pinchDist = () => {
    const p = [...pointersRef.current.values()];
    return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  };
  const onPointerDown = (e) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) { pinchRef.current = { dist: pinchDist(), scale }; dragRef.current = null; return; }
    movedRef.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false, captured: false, pointerId: e.pointerId };
  };
  const onPointerMove = (e) => {
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const d = pinchDist();
      if (d > 0 && pinchRef.current.dist > 0) setScale(Math.max(0.2, Math.min(2.5, pinchRef.current.scale * (d / pinchRef.current.dist))));
      movedRef.current = true; return;
    }
    const d = dragRef.current; if (!d) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    // Generous tap slop: only treat it as a pan once the finger/cursor really
    // moves, otherwise small jitter during a tap was eating tile clicks.
    if (!d.moved && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) { d.moved = true; try { e.currentTarget.setPointerCapture(d.pointerId); d.captured = true; } catch { /* */ } }
    if (d.moved) setPan({ x: d.panX + dx, y: d.panY + dy });
  };
  const onPointerUp = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    const d = dragRef.current;
    movedRef.current = d?.moved || movedRef.current;
    if (d?.captured) { try { e.currentTarget.releasePointerCapture(d.pointerId); } catch { /* */ } }
    dragRef.current = null;
  };
  const zoom = (dir) => setScale((s) => Math.max(0.2, Math.min(2.5, s + dir * 0.15)));
  const rotate = () => setRotation((r) => (r + 1) % 4);

  // ── Highlights ──────────────────────────────────────────────────────────
  const highlights = useMemo(() => {
    const hl = {};
    // Always mark the viewer's OWN hero tile so each player can spot themselves,
    // even when it's not their phase. "selected" (below) overrides it on your turn.
    if (myHero && !myHero.dead) hl[`${myHero.x},${myHero.y}`] = "self";
    if (!activeUnit) return hl;
    hl[`${activeUnit.x},${activeUnit.y}`] = "selected";
    if (!isMyTurn) return hl;
    if (mode === "move" && !activeUnit.hasMoved) {
      const occ = new Set(units.filter((u) => !u.dead && u.id !== activeUnit.id).map((u) => `${u.x},${u.y}`));
      const { costs } = computePaths(map, activeUnit.x, activeUnit.y, activeUnit.move ?? DEFAULT_MOVE, occ);
      for (const k of costs.keys()) if (k !== `${activeUnit.x},${activeUnit.y}`) hl[k] = "move";
    } else if (mode === "act" && selAction) {
      const aoe = spellAoE(selAction);
      const r = selAction.range || actionRange(selAction);
      if (aoe) {
        // faint reachable-centre marks, plus the blast of the CHOSEN centre
        // (committed by a click) or the hover preview while still aiming.
        const self = `${activeUnit.x},${activeUnit.y}`;
        for (const k of tilesWithinRange(map, activeUnit.x, activeUnit.y, 1, r)) if (k !== self) hl[k] = "target";
        const aimC = aimCenter || aimHover;
        if (aimC && manhattan(activeUnit.x, activeUnit.y, aimC.x, aimC.y) <= r)
          for (const k of aoeCells(map, activeUnit, aimC.x, aimC.y, aoe)) hl[k] = "blast";
      } else {
        const intent = detectSpellIntent(selAction);
        const kind = intent === "heal" || intent === "buff" ? "heal" : "target";
        for (const k of tilesWithinRange(map, activeUnit.x, activeUnit.y, 1, r))
          if (k !== `${activeUnit.x},${activeUnit.y}`) hl[k] = kind;
      }
    }
    return hl;
  }, [activeUnit, isMyTurn, mode, selAction, aimHover, aimCenter, units, map, myHero]);

  // Bouncing "ping" arrows over units: always your own hero (to locate yourself),
  // plus — while you're aiming an action — every valid target in range.
  const pingIds = useMemo(() => {
    const s = new Set();
    if (myHero && !myHero.dead) s.add(myHero.id);
    if (isMyTurn && activeUnit) s.add(activeUnit.id); // the unit you're playing now (incl. master's enemy)
    if (isMyTurn && activeUnit && mode === "act" && selAction) {
      const aoe = spellAoE(selAction);
      const r = selAction.range || actionRange(selAction);
      if (aoe) {
        // ping everyone the blast would hit (friend AND foe) at the chosen/hovered centre
        const aimC = aimCenter || aimHover;
        if (aimC && manhattan(activeUnit.x, activeUnit.y, aimC.x, aimC.y) <= r) {
          const cells = aoeCells(map, activeUnit, aimC.x, aimC.y, aoe);
          for (const u of units) if (!u.dead && cells.has(`${u.x},${u.y}`)) s.add(u.id);
        }
      } else {
        const wantEnemy = ["attack", "debuff"].includes(detectSpellIntent(selAction));
        for (const u of units) {
          if (u.dead) continue;
          const isEnemyOf = u.side !== activeUnit.side;
          if (wantEnemy !== isEnemyOf) continue;
          if (manhattan(activeUnit.x, activeUnit.y, u.x, u.y) <= r) s.add(u.id);
        }
      }
    }
    return s;
  }, [myHero, isMyTurn, activeUnit, mode, selAction, aimHover, aimCenter, units, map]);

  // ── Firestore writers ─────────────────────────────────────────────────────
  const logChat = (entry) => addDoc(collection(db, "world_boss_chat"), { timestamp: serverTimestamp(), ...entry });
  // Atomically patch specific units by id. `updaters` maps id → (freshUnit, freshUnits)
  // → patch object. Runs in a transaction over FRESH state so concurrent writers
  // (free-order play) never clobber one another. Extra doc fields via `extra`.
  const patchUnits = (updaters, extra = {}) =>
    txnBattle(
      (us) => us.map((u) => (updaters[u.id] ? { ...u, ...updaters[u.id](u, us) } : u)),
      extra
    );

  // Stamp a point/cast effect onto the battle doc so every client plays it (see
  // the fxEvent pickup effect). `from` (optional) is the source tile for
  // projectiles (arrow/bolt), which fly from there to (x,y).
  const fxStamp = (kind, x, y, from = null) => (data) => ({
    fxEvent: {
      id: (data.fxEvent?.id || 0) + 1, kind, x, y,
      fromX: from?.x ?? null, fromY: from?.y ?? null,
    },
  });

  // ── Master: setup ─────────────────────────────────────────────────────────
  const spawnBattle = async () => {
    const boss = bosses[0];
    const chosenMap = savedMaps.find((x) => x.id === selMapId);
    const m = chosenMap ? { w: chosenMap.w, h: chosenMap.h, tiles: chosenMap.tiles.map((t) => ({ ...t })) } : defaultBattleMap();
    const chosen = players.filter((p) => selPlayerIds.includes(p.id));
    const u = [];
    // Use spawn points painted in the editor; fall back to a spaced auto-layout
    // (heroes left block, enemies right) when there aren't enough painted spots.
    const heroSpawns = m.tiles.filter((t) => t.spawn === "hero").map((t) => ({ x: t.x, y: t.y }));
    const enemySpawns = m.tiles.filter((t) => t.spawn === "enemy").map((t) => ({ x: t.x, y: t.y }));
    const heroAt = (i) => heroSpawns[i] || { x: 1 + (i % 3) * 2, y: 2 + Math.floor(i / 3) * 2 };
    const enemyAt = (i) => enemySpawns[i] || { x: (m.w - 2) - (i % 3) * 2, y: 2 + Math.floor(i / 3) * 2 };
    chosen.forEach((c, i) => { const p = heroAt(i); u.push(makePlayerUnit(c, c.id, p.x, p.y)); });
    let ei = 0;
    if (boss) { const p = enemyAt(ei++); u.push(makeBossUnit(boss, p.x, p.y, parseInt(bossDex) || 0)); }
    minions.forEach((spec, i) => { const p = enemyAt(ei++); u.push(makeMinionUnit(spec, i, p.x, p.y)); });
    await setDoc(BATTLE_REF(), { ...emptyBattle(), active: true, phase: "setup", map: m, units: u });
  };
  const endBattle = async () => {
    if (!window.confirm("Terminare e azzerare la battaglia?")) return;
    await setDoc(BATTLE_REF(), { ...emptyBattle(), active: false });
  };
  const postBossMsg = async () => {
    if (!bossMsg.trim()) return;
    await logChat({ type: "narrative", senderName: "Master", uid: BOSS_SYSTEM_UID, side: "enemy", content: bossMsg, isSystem: true });
    setBossMsg("");
  };
  const startFight = async () => {
    // Master kicks the fight straight into round 1 (heroes' phase). No initiative
    // wait — free-order play needs no turn order. Heroes act over the next 3h, in
    // any order; then the enemies' phase (1h, master-driven).
    await txnBattle((us) => resetSide(us, "hero"), {
      fightStarted: true, round: 1, phase: "players",
      phaseDeadline: Date.now() + PLAYER_PHASE_MS,
    });
    await logChat({ type: "narrative", senderName: "SISTEMA", uid: BOSS_SYSTEM_UID, isSystem: true,
      content: `⚔️ La battaglia ha inizio! Turno degli Eroi — avete ${fmtPhase(PLAYER_PHASE_MS)} per agire (in qualsiasi ordine).` });
  };

  // ── TEST ONLY: master forces which side plays now ─────────────────────────
  // Lets us drive turns by hand while playtesting instead of waiting for the
  // auto-advance / phase timer. Resets the chosen side's move+action flags and
  // restarts its phase window, exactly like a normal phase change.
  const forcePhase = async (incoming) => {
    const side = incoming === "players" ? "hero" : "enemy";
    const ms = incoming === "players" ? PLAYER_PHASE_MS : ENEMY_PHASE_MS;
    await txnBattle((us) => resetSide(us, side), {
      phase: incoming, phaseDeadline: Date.now() + ms,
    });
    autoPassedRef.current = null;          // re-arm the auto-advance for the new deadline
    setMode("idle"); setSelAction(null); setSelEnemyId(null);
    await logChat({ type: "narrative", senderName: "SISTEMA", uid: BOSS_SYSTEM_UID, isSystem: true,
      content: incoming === "players"
        ? "🛡️ (Test) Turno degli Eroi forzato dal Master."
        : "👹 (Test) Turno dei Nemici forzato dal Master." });
  };

  // ── Phase flow (Model A) ────────────────────────────────────────────────────
  // Try to advance the phase. Idempotent + transactional, so any client may call
  // it on completion and the timer may force it — only one commit wins:
  //  • players → enemies  when all living heroes are done (or forced by the 3h timer)
  //  • enemies → players  (next round) when all enemies are done (or the 1h timer)
  //  • either  → over      when one side is wiped out
  // Terrain hazard (lava/acid) is applied to the incoming side as its phase opens.
  const advancePhase = async (force = false, expectedDeadline = null) => {
    const res = await runTransaction(db, async (tx) => {
      const ref = BATTLE_REF();
      const snap = await tx.get(ref);
      if (!snap.exists()) return null;
      const d = snap.data();
      if (!d.fightStarted || d.phase === "over") return null;
      const us = d.units || [];
      const aliveHeroes = us.some((u) => u.side === "hero" && !u.dead);
      const aliveEnemies = us.some((u) => u.side === "enemy" && !u.dead);
      if (!aliveHeroes || !aliveEnemies) {
        tx.update(ref, { phase: "over" });
        return { over: aliveHeroes ? "heroes" : "enemies" };
      }
      // A TIME-FORCED advance must end the EXACT phase whose deadline expired.
      // Otherwise two clients firing at the deadline would chain: the first ends
      // players→enemies, the second (which only meant to end players) would find
      // the phase already enemies and instantly end enemies→players, skipping the
      // enemy turn. Guarding on the deadline makes the racing call a no-op.
      if (force && expectedDeadline != null && d.phaseDeadline !== expectedDeadline) return null;
      const incoming = d.phase === "players" ? "enemies" : "players";
      const ready = d.phase === "players" ? sideAllDone(us, "hero") : sideAllDone(us, "enemy");
      if (!force && !ready) return null;
      const side = incoming === "players" ? "hero" : "enemy";
      let next = resetSide(us, side);
      const hazards = [];
      next = next.map((u) => {
        if (u.side !== side || u.dead) return u;
        const terr = TERRAINS[tileAt(d.map, u.x, u.y)?.terrain];
        const dmg = terr?.turnDamage || 0;
        if (dmg <= 0) return u;
        const hp = Math.max(0, u.hp - dmg);
        hazards.push({ name: u.name, dmg, terr: terr.label, key: terr.key, dead: hp <= 0 });
        return { ...u, hp, dead: hp <= 0 };
      });
      const round = incoming === "players" ? (d.round || 1) + 1 : (d.round || 1);
      const ms = incoming === "players" ? PLAYER_PHASE_MS : ENEMY_PHASE_MS;
      tx.update(ref, { units: next, phase: incoming, round, phaseDeadline: Date.now() + ms });
      return { to: incoming, round, forced: force, hazards };
    });
    if (!res) return res;            // log OUTSIDE the txn (which may retry)
    if (res.over) {
      await logChat({ type: "narrative", senderName: "SISTEMA", uid: BOSS_SYSTEM_UID, isSystem: true,
        content: res.over === "heroes" ? "🏆 Vittoria degli Eroi!" : "💀 I nemici hanno prevalso!" });
      return res;
    }
    for (const h of res.hazards) {
      const icon = h.key === "lava" ? "🔥" : h.key === "acid" ? "🧪" : "☠";
      await logChat({ type: "narrative", senderName: h.name, uid: BOSS_SYSTEM_UID, isSystem: true,
        content: `${icon} ${h.name} subisce ${h.dmg} danni da ${h.terr}: −${h.dmg} HP${h.dead ? " · 💀" : ""}` });
    }
    await logChat({ type: "narrative", senderName: "SISTEMA", uid: BOSS_SYSTEM_UID, isSystem: true,
      content: res.to === "players"
        ? `🛡️ Round ${res.round} — turno degli Eroi (${fmtPhase(PLAYER_PHASE_MS)})${res.forced ? " · tempo nemici scaduto" : ""}`
        : `👹 Turno dei Nemici (${fmtPhase(ENEMY_PHASE_MS)})${res.forced ? " · tempo eroi scaduto" : ""}` });
    return res;
  };

  // Move the controlled unit to (x,y) atomically: re-checks inside the txn that
  // the tile is free of living units AND still reachable, so two players acting
  // at once can never land on the same tile. Throws "OCCUPIED" if taken meanwhile.
  const txnMove = (unitId, x, y) =>
    runTransaction(db, async (tx) => {
      const ref = BATTLE_REF();
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("no-battle");
      const d = snap.data();
      const us = d.units || [];
      const me = us.find((u) => u.id === unitId);
      if (!me || me.hasMoved || me.dead) throw new Error("STALE");
      if (us.some((u) => !u.dead && u.id !== unitId && u.x === x && u.y === y)) throw new Error("OCCUPIED");
      const occ = new Set(us.filter((u) => !u.dead && u.id !== unitId).map((u) => `${u.x},${u.y}`));
      const { costs } = computePaths(d.map, me.x, me.y, me.move ?? DEFAULT_MOVE, occ);
      if (!costs.has(`${x},${y}`)) throw new Error("OCCUPIED");
      tx.update(ref, { units: us.map((u) => (u.id === unitId ? { ...u, x, y, hasMoved: true } : u)) });
    });

  const endTurn = async () => {
    if (!canAct) return;
    const id = controlledUnit.id;
    setMode("idle"); setSelAction(null);
    await patchUnits({ [id]: () => ({ done: true }) });
    await advancePhase();
  };

  // ── Phase timer (heroes 3h / enemies 1h, then auto-advance) ────────────────
  const phaseDeadline = battle?.phaseDeadline || null;
  const remainingMs = phaseDeadline && fightStarted && !isOver ? Math.max(0, phaseDeadline - nowTs) : null;
  useEffect(() => {
    if (!fightStarted || isOver) return;
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [fightStarted, isOver]);
  useEffect(() => {
    if (!fightStarted || isOver || !phaseDeadline) return;
    if (autoPassedRef.current === phaseDeadline) return;
    if (nowTs < phaseDeadline) return;
    // The master drives the forced advance; any living hero is a fallback (+20s
    // grace) so the fight still progresses if the master is offline. The
    // transaction makes the flip idempotent regardless of who fires it.
    const driver = isMaster || (myHero && !myHero.dead && nowTs > phaseDeadline + 20000);
    if (!driver) return;
    autoPassedRef.current = phaseDeadline;
    setMode("idle"); setSelAction(null);
    advancePhase(true, phaseDeadline);   // only end THIS phase (deadline-guarded)
  }, [nowTs, phaseDeadline, fightStarted, isOver, isMaster, myHero]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pixel VFX, derived from HP deltas between snapshots ────────────────────
  // Spawns a rough Octopath-style burst on whoever took damage / was healed /
  // died, at their tile. Driven by shared state, so EVERY client sees it without
  // any extra Firestore writes. Each effect auto-clears after its animation.
  useEffect(() => {
    if (!fightStarted) { prevHpRef.current = {}; return; }
    const prev = prevHpRef.current;
    const next = {};
    const spawned = [];
    for (const u of units) {
      next[u.id] = { hp: u.hp, dead: u.dead };
      const p = prev[u.id];
      if (!p) continue;                                  // first sight → no effect
      if (u.dead && !p.dead) spawned.push({ kind: "death", x: u.x, y: u.y });
      else if (u.hp < p.hp) spawned.push({ kind: "hit", x: u.x, y: u.y });
      else if (u.hp > p.hp) spawned.push({ kind: "heal", x: u.x, y: u.y });
    }
    prevHpRef.current = next;
    if (!spawned.length) return;
    const items = spawned.map((s) => ({ ...s, id: ++vfxIdRef.current }));
    setVfx((v) => [...v, ...items]);
    const ids = new Set(items.map((i) => i.id));
    // Each batch removes ITSELF after the animation. (Not tied to the effect's
    // cleanup on purpose — that would cancel removal on the next snapshot and
    // leave stale pixels on screen.)
    setTimeout(() => setVfx((v) => v.filter((e) => !ids.has(e.id))), 700);
  }, [units, fightStarted]);

  // ── Area "dome" VFX, broadcast through the shared battle doc ───────────────
  // resolveAoE stamps battle.aoeFx = {id, cells, cx, cy, kind} when an area spell
  // fires. Every client picks the new id up here and grows a rough, translucent
  // pixel dome over the whole blast — so all players see the same Octopath-style
  // burst without per-client writes. The dome is slow (~1.8s) so nobody misses it.
  useEffect(() => {
    const fx = battle?.aoeFx;
    if (!fx || !fightStarted) return;
    // On first sight just record the id — don't replay an old blast on join.
    if (lastAoeFxRef.current === null) { lastAoeFxRef.current = fx.id; return; }
    if (lastAoeFxRef.current === fx.id) return;
    lastAoeFxRef.current = fx.id;
    const id = ++vfxIdRef.current;
    setVfx((v) => [...v, { id, kind: "dome", domeKind: fx.kind || "arcane", cells: fx.cells || [], cx: fx.cx, cy: fx.cy }]);
    setTimeout(() => setVfx((v) => v.filter((e) => e.id !== id)), 1900);
  }, [battle?.aoeFx?.id, fightStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Point/cast VFX (sword slash, arrow/bolt projectile, shield, buff/debuff) ─
  // Broadcast through battle.fxEvent (like the dome above) so EVERY client plays
  // the same effect without per-client writes. resolveAttack/Cond/SelfBuff stamp
  // a new {id, kind, x, y, fromX, fromY}; here each client renders it once.
  useEffect(() => {
    const fx = battle?.fxEvent;
    if (!fx || !fightStarted) return;
    if (lastFxRef.current === null) { lastFxRef.current = fx.id; return; } // don't replay on join
    if (lastFxRef.current === fx.id) return;
    lastFxRef.current = fx.id;
    const id = ++vfxIdRef.current;
    setVfx((v) => [...v, { id, kind: fx.kind, x: fx.x, y: fx.y, fromX: fx.fromX, fromY: fx.fromY }]);
    const dur = fx.kind === "arrow" || fx.kind === "bolt" ? 520 : fx.kind === "shield" ? 650 : 720;
    setTimeout(() => setVfx((v) => v.filter((e) => e.id !== id)), dur);
  }, [battle?.fxEvent?.id, fightStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Combat resolution ─────────────────────────────────────────────────────
  const resolveAttack = async (attacker, target, action) => {
    setBusy(true);
    // High-ground rule: a higher tile grants advantage vs a lower target,
    // a lower tile imposes disadvantage vs a higher target (any elevation gap).
    const aElev = tileAt(map, attacker.x, attacker.y)?.elevation || 0;
    const tElev = tileAt(map, target.x, target.y)?.elevation || 0;
    const heightCond = aElev > tElev ? "advantage" : aElev < tElev ? "disadvantage" : null;
    // Combine the attacker's buff/debuff with the height factor (D&D rule:
    // any advantage + any disadvantage cancel out to a normal roll).
    const hasAdv = attacker.cond === "advantage" || heightCond === "advantage";
    const hasDis = attacker.cond === "disadvantage" || heightCond === "disadvantage";
    const effCond = hasAdv && hasDis ? null : hasAdv ? "advantage" : hasDis ? "disadvantage" : null;
    // advantage/disadvantage (from buff/debuff or terrain height) → roll 2d20
    const d1 = rollDie(20);
    let d = d1, rollNote = `d20(${d1})`;
    if (effCond) {
      const d2 = rollDie(20);
      d = effCond === "advantage" ? Math.max(d1, d2) : Math.min(d1, d2);
      const src = heightCond ? (effCond === "advantage" ? "⬆vant·alto" : "⬇svan·basso") : (effCond === "advantage" ? "⬆vant" : "⬇svan");
      rollNote = `${src}[${d1},${d2}]→${d}`;
    }
    await showD20Roll(d, { label: `${attacker.name}: ${action.name}` });
    const bonus = parseInt(String(action.bonus ?? "").replace(/[^0-9-]/g, "")) || 0;
    const total = d + bonus, crit = d === 20;
    const formula = action.damage && action.damage !== "0" ? action.damage : (action.diceNum ? `${action.diceNum}${action.diceType || "d6"}` : "1d6");
    const entry = { type: "action", senderName: attacker.name, actionName: action.name, uid: attacker.uid || BOSS_SYSTEM_UID, side: attacker.side, category: action.category || "Attacco", hitRoll: `🎲 ${rollNote} +${bonus} = ${total} vs CA ${target.ac}` };
    const hit = crit || total >= target.ac;
    let dmg = 0;
    if (hit) { dmg = rollFormula(formula); if (crit) dmg *= 2; }
    let killed = false;
    // Visual: melee weapon → slash on the target; ranged weapon → arrow flying
    // from attacker to target; spell attack → magic bolt. Stamped in the SAME
    // write as the damage so the swing/shot and the hit burst land together for
    // every spectator (it plays on a miss too — you still swung/fired).
    const isWeapon = /armi|arma|weapon/.test((action.category || "").toLowerCase());
    const ranged = (action.range || actionRange(action)) > 1;
    const fxKind = isWeapon ? (ranged ? "arrow" : "slash") : "bolt";
    // Apply damage to FRESH state (patch by id) so simultaneous attacks on the
    // same target each subtract from the current HP instead of clobbering, and
    // the attacker's advantage/disadvantage is consumed after the roll.
    await txnBattle((us) => us.map((u) => {
      let n = u;
      if (hit && u.id === target.id) { const hp = Math.max(0, u.hp - dmg); killed = hp <= 0; n = { ...n, hp, dead: hp <= 0 }; }
      if (u.id === attacker.id) n = { ...n, hasActed: true, cond: null };
      return n;
    }), fxStamp(fxKind, target.x, target.y, ranged ? { x: attacker.x, y: attacker.y } : null));
    entry.damageRoll = hit ? `💥 ${dmg} danni a ${target.name}${crit ? " (CRITICO!)" : ""}${killed ? " · 💀" : ""}` : `🛡 Mancato!`;
    await logChat(entry);
    setBusy(false);
    await advancePhase();
  };

  const resolveHeal = async (caster, target, action) => {
    setBusy(true);
    const heal = rollFormula(action.damage && action.damage !== "0" ? action.damage : "1d8");
    await txnBattle((us) => us.map((u) => {
      let n = u;
      if (u.id === target.id) n = { ...n, hp: Math.min(n.maxHp, n.hp + heal) };
      if (u.id === caster.id) n = { ...n, hasActed: true };
      return n;
    }));
    await logChat({ type: "action", senderName: caster.name, actionName: `${action.name} (Cura)`, uid: caster.uid || BOSS_SYSTEM_UID, side: caster.side, category: action.category || "Incantesimo", damageRoll: `💚 +${heal} HP a ${target.name}` });
    setBusy(false);
    await advancePhase();
  };
  const resolveSelfBuff = async (caster, action) => {
    setBusy(true);
    await txnBattle((us) => us.map((u) => (u.id === caster.id ? { ...u, ac: u.ac + 2, hasActed: true } : u)),
      fxStamp("shield", caster.x, caster.y));
    await logChat({ type: "action", senderName: caster.name, actionName: `${action.name} (Difesa)`, uid: caster.uid || BOSS_SYSTEM_UID, side: caster.side, category: action.category || "Incantesimo", damageRoll: `🛡 +2 CA` });
    setBusy(false);
    await advancePhase();
  };
  const resolveCond = async (caster, target, action, cond) => {
    setBusy(true);
    await txnBattle((us) => us.map((u) => {
      let n = u;
      if (u.id === target.id) n = { ...n, cond };
      if (u.id === caster.id) n = { ...n, hasActed: true };
      return n;
    }), fxStamp(cond === "advantage" ? "buff" : "debuff", target.x, target.y));
    await logChat({ type: "action", senderName: caster.name, actionName: action.name, uid: caster.uid || BOSS_SYSTEM_UID, side: caster.side, category: action.category || "Incantesimo", damageRoll: cond === "advantage" ? `🌟 ${target.name}: vantaggio` : `🌑 ${target.name}: svantaggio` });
    setBusy(false);
    await advancePhase();
  };

  // Area damage (Fireball &c.): every living unit in the blast — friend AND foe —
  // rolls its own save (d20 + ability mod) vs the caster's spell DC. Fail = full
  // damage; success = half (or none). All applied in ONE transaction over fresh
  // state so concurrent writes can't clobber. (cx,cy) = aimed centre tile.
  const resolveAoE = async (caster, action, cx, cy, aoe) => {
    setBusy(true);
    const cells = aoeCells(map, caster, cx, cy, aoe);
    const formula = action.damage && action.damage !== "0" ? action.damage
      : (action.diceNum ? `${action.diceNum}${action.diceType || "d6"}` : "1d6");
    const dc = caster.spellDC ?? 13;
    // roll each victim's save + damage now; apply atomically below.
    const rolls = units
      .filter((u) => !u.dead && cells.has(`${u.x},${u.y}`))
      .map((v) => {
        const d20 = rollDie(20);
        const mod = v.abilities?.[aoe.save] ?? 0;
        const saved = d20 + mod >= dc;
        let dmg = rollFormula(formula);
        if (saved) dmg = aoe.half ? Math.floor(dmg / 2) : 0;
        return { id: v.id, name: v.name, side: v.side, d20, mod, saved, dmg, dead: dmg > 0 && v.hp - dmg <= 0 };
      });
    // Element tint for the dome (darkness for the boss's shadow blast, &c.).
    const fxText = `${action.name || ""} ${action.category || ""} ${action.dmgType || aoe.dmgType || ""}`.toLowerCase();
    const fxKind = /oscur|tenebr|ombra|\bdark|necro|\bmort|void|abiss|maledi/.test(fxText) ? "darkness"
      : /fuoco|fiamm|\bfire|infern|brucia|ustione|piromanz/.test(fxText) ? "fire"
      : /ghiacc|gelo|\bice|freddo|brina/.test(fxText) ? "frost"
      : "arcane";
    const cellArr = [...cells].map((k) => { const [x, y] = k.split(",").map(Number); return { x, y }; });
    // Apply damage AND publish the dome effect in the same atomic write, so the
    // blast and the HP changes land together for every spectator.
    await txnBattle((us) => us.map((u) => {
      const r = rolls.find((x) => x.id === u.id);
      let n = u;
      if (r && r.dmg > 0) { const hp = Math.max(0, u.hp - r.dmg); n = { ...n, hp, dead: hp <= 0 }; }
      if (u.id === caster.id) n = { ...n, hasActed: true, cond: null };
      return n;
    }), (data) => ({
      aoeFx: { id: (data.aoeFx?.id || 0) + 1, cells: cellArr, cx, cy, shape: aoe.shape, kind: fxKind },
    }));
    await logChat({
      type: "action", senderName: caster.name, actionName: action.name,
      uid: caster.uid || BOSS_SYSTEM_UID, side: caster.side, category: action.category || "Incantesimo",
      hitRoll: `✨ Area (${aoe.shape}) · CD ${dc} · TS ${SAVE_LABEL[aoe.save] || aoe.save.toUpperCase()}`,
      damageRoll: rolls.length
        ? rolls.map((r) => `${r.side === "enemy" ? "👹" : "🛡"}${r.name}: ${r.d20}${r.mod >= 0 ? "+" : ""}${r.mod} ${r.saved ? "✅" : "❌"} −${r.dmg}${r.dead ? " 💀" : ""}`).join("  ·  ")
        : "nessun bersaglio nell'area",
    });
    setBusy(false);
    await advancePhase();
  };

  // ── Board interaction ─────────────────────────────────────────────────────
  const onTileClick = async (x, y) => {
    if (movedRef.current) { movedRef.current = false; return; }
    if (!isMyTurn) return;
    if (mode === "move" && !activeUnit.hasMoved) {
      const cu = activeUnit;
      const occ = new Set(units.filter((u) => !u.dead && u.id !== cu.id).map((u) => `${u.x},${u.y}`));
      const { costs, prev } = computePaths(map, cu.x, cu.y, cu.move ?? DEFAULT_MOVE, occ);
      if (!costs.has(`${x},${y}`) || (x === cu.x && y === cu.y)) return;
      const path = reconstructPath(prev, cu.x, cu.y, x, y);
      if (!path) return;
      setBusy(true); setMode("idle");
      // walk the unit along the path locally, then persist the final tile via a
      // transaction that re-checks the tile is free + reachable (collision-safe).
      for (let i = 1; i < path.length; i++) { setAnimUnit({ id: cu.id, x: path[i].x, y: path[i].y }); await delay(110); }
      try {
        await txnMove(cu.id, x, y);
      } catch (e) {
        setAnimUnit(null); setBusy(false);
        if (e.message === "OCCUPIED")
          await logChat({ type: "narrative", senderName: "SISTEMA", uid: BOSS_SYSTEM_UID, isSystem: true,
            content: `⚠️ ${cu.name}: quella casella è stata occupata, scegline un'altra.` });
        return;
      }
      setAnimUnit(null); setBusy(false);
      await advancePhase();   // in case this completes the unit's move+action
    } else if (mode === "act" && selAction && !activeUnit.hasActed) {
      // AoE spell: this tile becomes the CHOSEN centre/direction — it does NOT
      // fire yet (the player reviews the highlight, then presses Conferma).
      // Sphere/square are range-gated; line/cone only need a direction.
      const aoe = spellAoE(selAction);
      if (!aoe) return;
      if (x === activeUnit.x && y === activeUnit.y) return;
      const dir = aoe.shape === "line" || aoe.shape === "cone";
      const r = selAction.range || actionRange(selAction);
      if (!dir && manhattan(activeUnit.x, activeUnit.y, x, y) > r) return;
      setAimCenter({ x, y });
    }
  };
  // Hover preview for AoE aiming (updates the blast highlight + target pings).
  const onTileHover = (x, y) => {
    if (isMyTurn && mode === "act" && selAction && spellAoE(selAction)) setAimHover({ x, y });
  };
  // Commit the chosen AoE centre (the "accept" step) — now it fires.
  const confirmAoE = async () => {
    const aoe = spellAoE(selAction);
    if (!isMyTurn || !aoe || !aimCenter || activeUnit.hasActed) return;
    const cu = activeUnit, act = selAction, c = aimCenter;
    setSelAction(null); setMode("idle"); setAimHover(null); setAimCenter(null);
    await resolveAoE(cu, act, c.x, c.y, aoe);
  };
  const onUnitClick = async (u) => {
    if (movedRef.current) { movedRef.current = false; return; }
    // Master, enemies phase, idle: click an enemy to pick which one to drive.
    if (isMaster && phase === "enemies" && mode === "idle" && u.side === "enemy" && !u.dead) {
      setSelEnemyId(u.id); return;
    }
    if (!isMyTurn || mode !== "act" || !selAction || activeUnit.hasActed) return;
    // AoE spell aimed at a unit → choose the blast centre on that unit's tile
    // (still requires Conferma; it does not fire on the click).
    const aoe = spellAoE(selAction);
    if (aoe) {
      if (u.x === activeUnit.x && u.y === activeUnit.y) return;
      const dir = aoe.shape === "line" || aoe.shape === "cone";
      const r = selAction.range || actionRange(selAction);
      if (!dir && manhattan(activeUnit.x, activeUnit.y, u.x, u.y) > r) return;
      setAimCenter({ x: u.x, y: u.y });
      return;
    }
    const r = selAction.range || actionRange(selAction);
    if (manhattan(activeUnit.x, activeUnit.y, u.x, u.y) > r) return;
    const intent = detectSpellIntent(selAction);
    const isEnemyOf = u.side !== activeUnit.side;
    if ((intent === "attack" || intent === "debuff") && isEnemyOf && !u.dead) {
      if (intent === "attack") await resolveAttack(activeUnit, u, selAction);
      else await resolveCond(activeUnit, u, selAction, "disadvantage");
      setSelAction(null); setMode("idle");
    } else if ((intent === "heal" || intent === "buff") && !isEnemyOf && !u.dead) {
      if (intent === "heal") await resolveHeal(activeUnit, u, selAction);
      else await resolveCond(activeUnit, u, selAction, "advantage");
      setSelAction(null); setMode("idle");
    }
  };

  const pickAction = (a) => {
    if (detectSpellIntent(a) === "self_buff") { resolveSelfBuff(activeUnit, a); setMode("idle"); return; }
    setSelAction(a); setMode("act"); setAimHover(null); setAimCenter(null);
  };

  // Classify an action so the HUD can colour/group it. Weapon attacks (red),
  // offensive spells (purple), healing (green), buffs (blue).
  const actionKind = (a) => {
    const isWeapon = /armi|arma|weapon/.test((a.category || "").toLowerCase());
    const intent = detectSpellIntent(a);
    if (isWeapon) return { group: "attack", cls: "k-attack", icon: "⚔" };
    if (intent === "attack" || intent === "debuff") return { group: "spell", cls: "k-spell", icon: "✨" };
    if (intent === "heal") return { group: "support", cls: "k-heal", icon: "💚" };
    return { group: "support", cls: "k-buff", icon: "🛡" }; // buff / self_buff
  };
  // Buckets in display order, each with a coloured section header.
  const ACTION_GROUPS = [
    { key: "attack", label: "⚔ Attacchi" },
    { key: "spell", label: "✨ Incantesimi" },
    { key: "support", label: "✚ Supporto" },
  ];
  const groupedActions = useMemo(() => {
    const g = { attack: [], spell: [], support: [] };
    for (const a of myActions) g[actionKind(a).group].push(a);
    return g;
  }, [myActions]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!currentUser) return <div className="bt-msg">Loggati per entrare nel fight.</div>;

  const myUnit = units.find((u) => u.side === "hero" && u.uid === currentUser.uid);
  const heroesAlive = units.filter((u) => u.side === "hero" && !u.dead);
  const heroesDone = heroesAlive.filter(unitDone).length;
  const enemiesAlive = units.filter((u) => u.side === "enemy" && !u.dead);
  const enemiesDone = enemiesAlive.filter(unitDone).length;
  // Short note for a hero who can't act right now, so they understand why.
  const myStatus = (!myUnit || !fightStarted || isOver) ? null
    : myUnit.dead ? "💀 Sei a terra."
    : phase === "enemies" ? "👹 Turno dei Nemici — attendi il Master."
    : unitDone(myUnit) ? "✅ Hai già agito in questo round."
    : null;

  return (
    <div className="tac-screen">
      {/* floating quick-controls — always above everything */}
      <button ref={menuFabRef} className="tac-fab tac-fab-menu" onClick={() => setShowBar((v) => !v)} title="Controlli / Master">⚙</button>
      {isMyTurn && (
        <button className="tac-fab tac-fab-end" onClick={endTurn} title="Fine turno">⏭ Fine</button>
      )}
      {remainingMs != null && (
        <div className={`tac-timer ${remainingMs <= 60000 ? "low" : ""}`} title="Tempo rimanente per il turno">
          ⏱ {String(Math.floor(remainingMs / 60000)).padStart(2, "0")}:{String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0")}
        </div>
      )}

      {showBar && (
        <div className="tac-topbar" ref={topbarRef}>
          <span className="tac-title">⚔ World Boss</span>
          <span className="tac-turninfo">
            {!battle?.active && "Nessuna battaglia attiva"}
            {battle?.active && !fightStarted && "⚔ Pronti — il Master avvia la battaglia"}
            {fightStarted && !isOver && (phase === "players"
              ? `Round ${battle.round} · 🛡️ Turno Eroi (${heroesDone}/${heroesAlive.length} hanno agito)${isMyTurn ? " — tocca a te" : ""}`
              : `Round ${battle.round} · 👹 Turno Nemici (${enemiesDone}/${enemiesAlive.length} giocati)${isMyTurn && activeUnit ? ` — ${activeUnit.name}` : ""}`)}
            {isOver && "🏁 Battaglia conclusa"}
          </span>
          <div className="tac-controls">
            <button onClick={() => zoom(+1)}>＋</button>
            <button onClick={() => zoom(-1)}>－</button>
            <button onClick={rotate} title="Ruota vista">⟳</button>
            <button onClick={fit}>Adatta</button>
            {isMaster && battle?.active && <button onClick={endBattle}>⛔</button>}
            <button onClick={() => setShowBar(false)} title="Chiudi">✖</button>
          </div>
          {/* TEST ONLY: master forces whose turn it is, by hand. */}
          {isMaster && fightStarted && !isOver && (
            <div className="tac-master-test">
              <span className="tac-master-test-label">🧪 Test turni:</span>
              <button className={phase === "players" ? "on" : ""} onClick={() => forcePhase("players")}>🛡️ Turno Eroi</button>
              <button className={phase === "enemies" ? "on" : ""} onClick={() => forcePhase("enemies")}>👹 Turno Nemici</button>
            </div>
          )}
        </div>
      )}

      {/* ── Action / turn counter (always visible during the fight): who has
          finished their round (✅) and who is still missing (⏳), per side. ── */}
      {fightStarted && !isOver && (
        <div className={`tac-roster ${rosterOpen ? "open" : ""}`}>
          <button className="tac-roster-toggle" onClick={() => setRosterOpen((v) => !v)}>
            {rosterOpen ? "▾" : "▸"} 🛡️ {heroesDone}/{heroesAlive.length} · 👹 {enemiesDone}/{enemiesAlive.length}
          </button>
          {rosterOpen && (
            <div className="tac-roster-body">
              <div className="tac-roster-sec">
                <span className="tac-roster-head hero">🛡️ Eroi — {heroesDone}/{heroesAlive.length} hanno agito</span>
                {heroesAlive.map((u) => (
                  <span key={u.id} className={`tac-roster-unit ${unitDone(u) ? "done" : "todo"}`}>
                    {unitDone(u) ? "✅" : "⏳"} {(u.name || "?").split(" ")[0]}
                  </span>
                ))}
              </div>
              <div className="tac-roster-sec">
                <span className="tac-roster-head enemy">👹 Nemici — {enemiesDone}/{enemiesAlive.length} giocati</span>
                {enemiesAlive.map((u) => (
                  <span key={u.id} className={`tac-roster-unit ${unitDone(u) ? "done" : "todo"}`}>
                    {unitDone(u) ? "✅" : "⏳"} {(u.name || "?").split(" ")[0]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div
        className="tac-viewport" ref={viewportRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
      >
        {battle?.active ? (
          <div className="tac-pan" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
            <IsoBoard map={map} units={displayUnits} highlights={highlights} pings={pingIds} vfx={vfx} scale={scale} rotation={rotation}
              onTileClick={onTileClick} onTileHover={onTileHover} onUnitClick={onUnitClick} />
          </div>
        ) : (
          <div className="bt-empty">{isMaster ? "Allestisci una battaglia qui sotto." : "⏳ In attesa che il Master avvii una battaglia…"}</div>
        )}

        {myStatus && (
          <div className="tac-status-note" style={{
            position: "absolute", left: "50%", bottom: 14, transform: "translateX(-50%)",
            background: "rgba(12,16,24,.82)", color: "#e8eefc", padding: "7px 14px",
            borderRadius: 999, fontSize: 13, fontWeight: 600, pointerEvents: "none",
            zIndex: 6, whiteSpace: "nowrap", boxShadow: "0 2px 10px rgba(0,0,0,.4)" }}>
            {myStatus}
          </div>
        )}
      </div>

      {/* ── Master setup panel ── */}
      {isMaster && !fightStarted && (
        <div className="bt-setup">
          {!battle?.active ? (
            <>
              <div className="bt-setup-row">
                <strong>Boss:</strong> {bosses[0]?.name || "⚠ nessun boss attivo (crealo in WorldBossAdmin)"}
                <label>DEX boss (iniziativa, max +5)
                  <input type="number" min={-5} max={5} value={bossDex}
                    onChange={(e) => setBossDex(String(Math.max(-5, Math.min(5, parseInt(e.target.value) || 0))))}
                    style={{ width: 50 }} />
                </label>
              </div>
              <div className="bt-setup-row">
                <strong>Mappa:</strong>
                <select value={selMapId} onChange={(e) => setSelMapId(e.target.value)}>
                  <option value="">Default (16×16)</option>
                  {savedMaps.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.w}×{m.h})</option>)}
                </select>
                <a href="/dm-admin/battle-maps" style={{ color: "#9bd0ff" }}>🗺 Editor mappe</a>
              </div>
              <div className="bt-setup-row"><strong>Eroi:</strong></div>
              <div className="bt-setup-players">
                {players.map((p) => (
                  <button key={p.id}
                    className={`bt-chip ${selPlayerIds.includes(p.id) ? "on" : ""}`}
                    onClick={() => setSelPlayerIds((s) => s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id])}>
                    {(p.name || "?").split(" ")[0]}
                  </button>
                ))}
              </div>
              <div className="bt-setup-row">
                <strong>Minion:</strong>
                {minionLib.length === 0
                  ? <span style={{ opacity: 0.6 }}>nessuno — caricali in <em>Admin → Sprite Personaggi</em></span>
                  : minionLib.map((t) => (
                    <button key={t.id} className="bt-chip" title={`HP ${t.hp} · CA ${t.ac} · DEX ${t.dex}`}
                      onClick={() => setMinions((m) => [...m, {
                        name: t.name, hp: t.hp, ac: t.ac, dex: t.dex,
                        atkName: t.atkName, atkDice: t.atkDice, atkBonus: t.atkBonus, atkRange: t.atkRange,
                        tplId: t.id, sprite: t.spriteUrl, deadSprite: t.deadSpriteUrl,
                      }])}>
                      ＋ {t.name}
                    </button>
                  ))}
              </div>
              {minions.length > 0 && (
                <div className="bt-setup-row">
                  {minions.map((m, i) => (
                    <span key={i} className="bt-minion">
                      {m.sprite && <img src={m.sprite} alt="" style={{ height: 20, imageRendering: "pixelated" }} />}
                      {m.name}
                      HP<input type="number" value={m.hp} onChange={(e) => setMinions((arr) => arr.map((x, j) => j === i ? { ...x, hp: +e.target.value } : x))} style={{ width: 44 }} />
                      DEX<input type="number" value={m.dex} onChange={(e) => setMinions((arr) => arr.map((x, j) => j === i ? { ...x, dex: +e.target.value } : x))} style={{ width: 38 }} />
                      <button onClick={() => setMinions((arr) => arr.filter((_, j) => j !== i))}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              <button className="bt-primary" disabled={!selPlayerIds.length} onClick={spawnBattle}>⚔ Allestisci battaglia</button>
            </>
          ) : (
            <>
              <div className="bt-setup-row">
                <input className="bt-bossmsg" value={bossMsg} onChange={(e) => setBossMsg(e.target.value)} placeholder="Descrivi come è apparso il boss…" />
                <button onClick={postBossMsg}>Invia in chat</button>
              </div>
              <div className="bt-setup-row">
                <span className="bt-init-status">
                  Avvii tu il fight: gli Eroi giocano in ordine libero (3h), poi tocca ai Nemici (1h).
                </span>
                <button className="bt-primary" onClick={startFight}>⚔ INIZIA</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Master enemy roster (enemies phase): one chip per living enemy so the
          master always sees WHO is being played, who's already done (✓), and can
          click to switch. Makes "each enemy gets its own move+action" obvious. ── */}
      {isMaster && fightStarted && !isOver && phase === "enemies" && (
        <div className="tac-enemybar">
          <span className="tac-enemybar-label">👹 Nemici da giocare:</span>
          {enemiesAlive.map((u) => (
            <button key={u.id}
              className={`tac-enemy-chip${controlledUnit?.id === u.id ? " active" : ""}${unitDone(u) ? " done" : ""}`}
              onClick={() => setSelEnemyId(u.id)}
              title={unitDone(u) ? "Ha già fatto movimento + azione" : "Clicca per controllarlo"}>
              {(u.name || "?").split(" ")[0]}{unitDone(u) ? " ✓" : ""}
            </button>
          ))}
        </div>
      )}

      {/* ── Action HUD (active controller): avatar + colour-grouped abilities.
          While moving or aiming an action the HUD collapses to a slim bar so the
          board stays visible; it re-expands once the move/action resolves. ── */}
      {isMyTurn && (() => {
        const aiming = mode === "act" && selAction;
        const collapsed = mode === "move" || aiming;
        const cancel = () => { setMode("idle"); setSelAction(null); setAimHover(null); setAimCenter(null); };

        // identity card (reused in both states). Portrait = the Foundry avatar
        // from the character sheet (live charData for the player you control),
        // falling back to the unit's stored avatar, then its pixel sprite.
        const resolved = spriteFor(activeUnit);
        const avatarSrc =
          (activeUnit.uid === currentUser?.uid ? charData?.image : null) ||
          resolved.avatar || resolved.sprite;
        const card = (
          <div className={`tac-hud-card side-${activeUnit.side}`}>
            {avatarSrc
              ? <img className="tac-hud-avatar" src={avatarSrc} alt={activeUnit.name} draggable={false} />
              : <div className="tac-hud-avatar placeholder">{(activeUnit.name || "?")[0].toUpperCase()}</div>}
            <div className="tac-hud-meta">
              <span className="tac-hud-name">{activeUnit.name}</span>
              <span className="tac-hud-stats">❤ {activeUnit.hp}/{activeUnit.maxHp} · 🛡 {activeUnit.ac}</span>
              {/* one move + one action per turn — clearly shown as used/available */}
              <span className="tac-hud-pips">
                <span className={`tac-pip ${activeUnit.hasMoved ? "used" : "ok"}`}>👟 {activeUnit.hasMoved ? "fatto" : "Movimento"}</span>
                <span className={`tac-pip ${activeUnit.hasActed ? "used" : "ok"}`}>⚔ {activeUnit.hasActed ? "fatto" : "Azione"}</span>
              </span>
            </div>
          </div>
        );

        if (collapsed) {
          const aoe = aiming ? spellAoE(selAction) : null;
          const dir = aoe && (aoe.shape === "line" || aoe.shape === "cone");
          const prompt = mode === "move"
            ? "👟 Scegli dove spostarti…"
            : aoe
              ? `${actionKind(selAction).icon} ${selAction.name} — ${aimCenter ? "conferma, o ri-scegli" : (dir ? "scegli la direzione…" : "scegli il centro dell'area…")}`
              : `${actionKind(selAction).icon} ${selAction.name} — scegli il bersaglio…`;
          return (
            <div className="tac-hud collapsed">
              {card}
              <span className="tac-hud-prompt">{prompt}</span>
              {aoe && (
                <button className="tac-act tac-confirm" onClick={confirmAoE} disabled={!aimCenter}>
                  ✅ Conferma
                </button>
              )}
              <button className="tac-act tac-cancel" onClick={cancel}>✖ Annulla</button>
            </div>
          );
        }

        return (
          <div className="tac-hud">
            {card}

            {/* movement */}
            <button className="tac-act k-move" disabled={activeUnit.hasMoved}
              onClick={() => { setMode("move"); setSelAction(null); }}>
              👟 Muovi {activeUnit.hasMoved ? "✓" : ""}
            </button>

            {/* abilities, split into coloured groups */}
            <div className="tac-hud-groups">
              {ACTION_GROUPS.map(({ key, label }) => groupedActions[key].length > 0 && (
                <div key={key} className={`tac-group g-${key}`}>
                  <span className="tac-group-label">{label}</span>
                  <div className="tac-group-btns">
                    {groupedActions[key].map((a, i) => {
                      const k = actionKind(a);
                      return (
                        <button key={i} disabled={activeUnit.hasActed}
                          className={`tac-act ${k.cls} ${selAction?.name === a.name ? "on" : ""}`}
                          title={a.description || a.name}
                          onClick={() => pickAction(a)}>
                          <span className="tac-act-icon">{k.icon}</span>
                          <span className="tac-act-name">{a.name}</span>
                          {activeUnit.hasActed && <span className="tac-act-done">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <BattleChat currentUser={currentUser} isMaster={isMaster} charData={charData} locked={battle?.active && !fightStarted && !isMaster} />
    </div>
  );
}
