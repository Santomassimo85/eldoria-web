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
  doc, setDoc, updateDoc, onSnapshot, collection, addDoc, serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../../AuthContext";
import IsoBoard from "./IsoBoard";
import BattleChat from "./BattleChat";
import { showD20Roll } from "../../components/DiceRoll";
import {
  computeBoardMetrics, computePaths, reconstructPath, rotateCoord,
  manhattan, tilesWithinRange, tileAt, TERRAINS, DEFAULT_MOVE,
} from "./isoCore";
import {
  BATTLE_REF, BOSS_SYSTEM_UID, emptyBattle, defaultBattleMap,
  makePlayerUnit, makeBossUnit, makeMinionUnit,
  allRolled, computeTurnOrder, nextAliveIdx,
  rollDie, rollFormula, detectSpellIntent, actionRange, battleActions,
} from "./battleModel";
import "./BossTactics.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const [busy, setBusy] = useState(false);
  const [animUnit, setAnimUnit] = useState(null); // local walk override {id,x,y}

  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);

  // ── Subscriptions ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(BATTLE_REF(), (snap) => setBattle(snap.exists() ? snap.data() : null));
    return () => unsub();
  }, []);
  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(doc(db, "characters", currentUser.uid), (snap) => setCharData(snap.data()));
  }, [currentUser]);
  useEffect(() => {
    if (!isMaster) return;
    return onSnapshot(collection(db, "characters"), (snap) =>
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [isMaster]);
  useEffect(() => {
    return onSnapshot(collection(db, "bosses"), (snap) =>
      setBosses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.isActive)));
  }, []);
  useEffect(() => {
    if (!isMaster) return;
    return onSnapshot(collection(db, "player_sprites"), (snap) =>
      setMinionLib(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [isMaster]);
  useEffect(() => {
    if (!isMaster) return;
    return onSnapshot(collection(db, "battle_meta"), (snap) =>
      setSavedMaps(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.kind === "map")));
  }, [isMaster]);

  const map = battle?.map || defaultBattleMap();
  const units = useMemo(() => battle?.units || [], [battle]);
  // Local walk animation: override the moving unit's rendered position.
  const displayUnits = useMemo(
    () => (animUnit ? units.map((u) => (u.id === animUnit.id ? { ...u, x: animUnit.x, y: animUnit.y } : u)) : units),
    [units, animUnit]
  );
  const fightStarted = battle?.fightStarted === true;
  const phase = battle?.phase || "setup";
  const order = battle?.turnOrder || [];
  const activeIdx = battle?.activeIdx ?? 0;
  const activeUnit = fightStarted ? units.find((u) => u.id === order[activeIdx]) : null;
  const isOver = phase === "over";

  const isMyTurn =
    fightStarted && !isOver && activeUnit && !busy &&
    ((activeUnit.side === "hero" && activeUnit.uid === currentUser?.uid) ||
     (activeUnit.side === "enemy" && isMaster));

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
  useEffect(() => { fit(); }, [fit]);

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
    if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) { d.moved = true; try { e.currentTarget.setPointerCapture(d.pointerId); d.captured = true; } catch { /* */ } }
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
    if (!activeUnit) return hl;
    hl[`${activeUnit.x},${activeUnit.y}`] = "selected";
    if (!isMyTurn) return hl;
    if (mode === "move" && !activeUnit.hasMoved) {
      const occ = new Set(units.filter((u) => !u.dead && u.id !== activeUnit.id).map((u) => `${u.x},${u.y}`));
      const { costs } = computePaths(map, activeUnit.x, activeUnit.y, activeUnit.move ?? DEFAULT_MOVE, occ);
      for (const k of costs.keys()) if (k !== `${activeUnit.x},${activeUnit.y}`) hl[k] = "move";
    } else if (mode === "act" && selAction) {
      const intent = detectSpellIntent(selAction);
      const kind = intent === "heal" || intent === "buff" ? "heal" : "target";
      const r = selAction.range || actionRange(selAction);
      for (const k of tilesWithinRange(map, activeUnit.x, activeUnit.y, 1, r))
        if (k !== `${activeUnit.x},${activeUnit.y}`) hl[k] = kind;
    }
    return hl;
  }, [activeUnit, isMyTurn, mode, selAction, units, map]);

  // ── Firestore writers ─────────────────────────────────────────────────────
  const writeUnits = (next, extra = {}) => updateDoc(BATTLE_REF(), { units: next, ...extra });
  const logChat = (entry) => addDoc(collection(db, "world_boss_chat"), { timestamp: serverTimestamp(), ...entry });

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
  const rollEnemyInitiative = async () => {
    setBusy(true);
    let next = units.slice();
    for (const u of units.filter((x) => x.side === "enemy" && typeof x.initiative !== "number")) {
      const d = rollDie(20);
      await showD20Roll(d, { label: `${u.name} (DES +${u.dex})` });
      next = next.map((x) => (x.id === u.id ? { ...x, initiative: d + (u.dex || 0) } : x));
      await writeUnits(next);
    }
    setBusy(false);
  };
  const postBossMsg = async () => {
    if (!bossMsg.trim()) return;
    await logChat({ type: "narrative", senderName: "Master", uid: BOSS_SYSTEM_UID, content: bossMsg, isSystem: true });
    setBossMsg("");
  };
  const startFight = async () => {
    if (!allRolled(units)) return;
    const ord = computeTurnOrder(units);
    const first = units.find((u) => u.id === ord[0]);
    await updateDoc(BATTLE_REF(), {
      fightStarted: true, turnOrder: ord, activeIdx: 0, round: 1,
      phase: first?.side === "hero" ? "players" : "enemies",
    });
    await logChat({ type: "narrative", senderName: "SISTEMA", uid: BOSS_SYSTEM_UID, isSystem: true,
      content: "⚔️ La battaglia ha inizio! Ordine: " + ord.map((id) => units.find((u) => u.id === id)?.name).join(" → ") });
  };

  // ── Player: roll own initiative ───────────────────────────────────────────
  const rollMyInitiative = async () => {
    const u = units.find((x) => x.side === "hero" && x.uid === currentUser?.uid);
    if (!u || typeof u.initiative === "number") return;
    setBusy(true);
    const d = rollDie(20);
    await showD20Roll(d, { label: `${u.name} (DES +${u.dex})` });
    await writeUnits(units.map((x) => (x.id === u.id ? { ...x, initiative: d + (u.dex || 0) } : x)));
    setBusy(false);
  };

  // ── Turn flow ─────────────────────────────────────────────────────────────
  const advanceTurn = async (curUnits) => {
    const alive = curUnits.filter((u) => !u.dead);
    if (!alive.some((u) => u.side === "hero") || !alive.some((u) => u.side === "enemy")) {
      await updateDoc(BATTLE_REF(), { phase: "over" });
      await logChat({ type: "narrative", senderName: "SISTEMA", uid: BOSS_SYSTEM_UID, isSystem: true,
        content: alive.some((u) => u.side === "hero") ? "🏆 Vittoria degli Eroi!" : "💀 I nemici hanno prevalso!" });
      return;
    }
    let idx = nextAliveIdx(order, curUnits, activeIdx);
    let round = (battle?.round || 1) + (idx <= activeIdx ? 1 : 0);
    // hazard damage (lava/acid/…) at the start of the next unit's turn
    let next = curUnits.map((u) => ({ ...u, ...(u.id === order[idx] ? { hasMoved: false, hasActed: false } : {}) }));
    const nu = next.find((u) => u.id === order[idx]);
    const terr = TERRAINS[tileAt(map, nu.x, nu.y)?.terrain];
    const dmg = terr?.turnDamage || 0;
    if (dmg > 0 && !nu.dead) {
      const hp = Math.max(0, nu.hp - dmg);
      next = next.map((u) => (u.id === nu.id ? { ...u, hp, dead: hp <= 0 } : u));
      const icon = terr.key === "lava" ? "🔥" : terr.key === "acid" ? "🧪" : "☠";
      await logChat({ type: "narrative", senderName: nu.name, uid: BOSS_SYSTEM_UID, isSystem: true, content: `${icon} ${nu.name} subisce ${dmg} danni da ${terr.label}: −${dmg} HP${hp <= 0 ? " · 💀" : ""}` });
    }
    await writeUnits(next, { activeIdx: idx, round, phase: (next.find((u) => u.id === order[idx])?.side === "hero") ? "players" : "enemies" });
  };
  const endTurn = () => { if (isMyTurn) { setMode("idle"); setSelAction(null); advanceTurn(units); } };

  // ── Combat resolution ─────────────────────────────────────────────────────
  const resolveAttack = async (attacker, target, action) => {
    setBusy(true);
    // advantage/disadvantage from a buff/debuff on the attacker → roll 2d20
    const d1 = rollDie(20);
    let d = d1, rollNote = `d20(${d1})`;
    if (attacker.cond === "advantage" || attacker.cond === "disadvantage") {
      const d2 = rollDie(20);
      d = attacker.cond === "advantage" ? Math.max(d1, d2) : Math.min(d1, d2);
      rollNote = `${attacker.cond === "advantage" ? "⬆vant" : "⬇svan"}[${d1},${d2}]→${d}`;
    }
    await showD20Roll(d, { label: `${attacker.name}: ${action.name}` });
    const bonus = parseInt(String(action.bonus ?? "").replace(/[^0-9-]/g, "")) || 0;
    const total = d + bonus, crit = d === 20;
    const formula = action.damage && action.damage !== "0" ? action.damage : (action.diceNum ? `${action.diceNum}${action.diceType || "d6"}` : "1d6");
    let next = units;
    const entry = { type: "action", senderName: attacker.name, actionName: action.name, uid: attacker.uid || BOSS_SYSTEM_UID, category: action.category || "Attacco", hitRoll: `🎲 ${rollNote} +${bonus} = ${total} vs CA ${target.ac}` };
    if (crit || total >= target.ac) {
      let dmg = rollFormula(formula); if (crit) dmg *= 2;
      const dead = target.hp - dmg <= 0;
      next = units.map((u) => (u.id === target.id ? { ...u, hp: Math.max(0, u.hp - dmg), dead } : u));
      entry.damageRoll = `💥 ${dmg} danni a ${target.name}${crit ? " (CRITICO!)" : ""}${dead ? " · 💀" : ""}`;
    } else entry.damageRoll = `🛡 Mancato!`;
    // consume the attacker's advantage/disadvantage after this roll
    next = next.map((u) => (u.id === attacker.id ? { ...u, hasActed: true, cond: null } : u));
    await writeUnits(next);
    await logChat(entry);
    setBusy(false);
  };

  const resolveHeal = async (caster, target, action) => {
    setBusy(true);
    const heal = rollFormula(action.damage && action.damage !== "0" ? action.damage : "1d8");
    const next = units
      .map((u) => (u.id === target.id ? { ...u, hp: Math.min(u.maxHp, u.hp + heal) } : u))
      .map((u) => (u.id === caster.id ? { ...u, hasActed: true } : u));
    await writeUnits(next);
    await logChat({ type: "action", senderName: caster.name, actionName: `${action.name} (Cura)`, uid: caster.uid || BOSS_SYSTEM_UID, category: action.category || "Incantesimo", damageRoll: `💚 +${heal} HP a ${target.name}` });
    setBusy(false);
  };
  const resolveSelfBuff = async (caster, action) => {
    setBusy(true);
    const next = units.map((u) => (u.id === caster.id ? { ...u, ac: u.ac + 2, hasActed: true } : u));
    await writeUnits(next);
    await logChat({ type: "action", senderName: caster.name, actionName: `${action.name} (Difesa)`, uid: caster.uid || BOSS_SYSTEM_UID, category: action.category || "Incantesimo", damageRoll: `🛡 +2 CA` });
    setBusy(false);
  };
  const resolveCond = async (caster, target, action, cond) => {
    setBusy(true);
    const next = units
      .map((u) => (u.id === target.id ? { ...u, cond } : u))
      .map((u) => (u.id === caster.id ? { ...u, hasActed: true } : u));
    await writeUnits(next);
    await logChat({ type: "action", senderName: caster.name, actionName: action.name, uid: caster.uid || BOSS_SYSTEM_UID, category: action.category || "Incantesimo", damageRoll: cond === "advantage" ? `🌟 ${target.name}: vantaggio` : `🌑 ${target.name}: svantaggio` });
    setBusy(false);
  };

  // ── Board interaction ─────────────────────────────────────────────────────
  const onTileClick = async (x, y) => {
    if (movedRef.current) { movedRef.current = false; return; }
    if (!isMyTurn) return;
    if (mode === "move" && !activeUnit.hasMoved) {
      const occ = new Set(units.filter((u) => !u.dead && u.id !== activeUnit.id).map((u) => `${u.x},${u.y}`));
      const { costs, prev } = computePaths(map, activeUnit.x, activeUnit.y, activeUnit.move ?? DEFAULT_MOVE, occ);
      if (!costs.has(`${x},${y}`) || (x === activeUnit.x && y === activeUnit.y)) return;
      const path = reconstructPath(prev, activeUnit.x, activeUnit.y, x, y);
      if (!path) return;
      setBusy(true); setMode("idle");
      // walk the unit along the path locally, then persist the final tile
      for (let i = 1; i < path.length; i++) { setAnimUnit({ id: activeUnit.id, x: path[i].x, y: path[i].y }); await delay(110); }
      await writeUnits(units.map((u) => (u.id === activeUnit.id ? { ...u, x, y, hasMoved: true } : u)));
      setAnimUnit(null); setBusy(false);
    }
  };
  const onUnitClick = async (u) => {
    if (movedRef.current) { movedRef.current = false; return; }
    if (!isMyTurn || mode !== "act" || !selAction || activeUnit.hasActed) return;
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
    setSelAction(a); setMode("act");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!currentUser) return <div className="bt-msg">Loggati per entrare nel fight.</div>;

  const myUnit = units.find((u) => u.side === "hero" && u.uid === currentUser.uid);
  const needMyRoll = battle?.active && !fightStarted && myUnit && typeof myUnit.initiative !== "number";

  return (
    <div className="tac-screen">
      <div className="tac-topbar">
        <span className="tac-title">⚔ World Boss — Tactics</span>
        <span className="tac-turninfo">
          {!battle?.active && "Nessuna battaglia attiva"}
          {battle?.active && !fightStarted && "🎲 Fase iniziativa"}
          {fightStarted && !isOver && activeUnit && `Round ${battle.round} · ${activeUnit.name}${activeUnit.side === "enemy" ? " 👹" : ""}${isMyTurn ? " — tocca a te" : ""}`}
          {isOver && "🏁 Battaglia conclusa"}
        </span>
        <div className="tac-controls">
          <button onClick={() => zoom(+1)}>＋</button>
          <button onClick={() => zoom(-1)}>－</button>
          <button onClick={rotate} title="Ruota vista">⟳</button>
          <button onClick={fit}>Adatta</button>
          {isMaster && battle?.active && <button onClick={endBattle}>⛔</button>}
        </div>
      </div>

      <div
        className="tac-viewport" ref={viewportRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
      >
        {battle?.active ? (
          <div className="tac-pan" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
            <IsoBoard map={map} units={displayUnits} highlights={highlights} scale={scale} rotation={rotation}
              onTileClick={onTileClick} onUnitClick={onUnitClick} />
          </div>
        ) : (
          <div className="bt-empty">{isMaster ? "Allestisci una battaglia qui sotto." : "⏳ In attesa che il Master avvii una battaglia…"}</div>
        )}

        {needMyRoll && (
          <div className="tac-overlay">
            <button className="tac-big-btn" onClick={rollMyInitiative} disabled={busy}>🎲 Tira la tua Iniziativa</button>
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
                        sprite: t.spriteUrl, deadSprite: t.deadSpriteUrl,
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
                <button onClick={rollEnemyInitiative} disabled={busy}>🎲 Iniziativa nemici</button>
                <span className="bt-init-status">
                  {units.filter((u) => typeof u.initiative === "number").length}/{units.length} hanno tirato
                </span>
                <button className="bt-primary" disabled={!allRolled(units)} onClick={startFight}>⚔ INIZIA</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Action bar (active controller) ── */}
      {isMyTurn && (
        <div className="tac-actionbar">
          <button disabled={activeUnit.hasMoved} className={mode === "move" ? "on" : ""}
            onClick={() => { setMode(mode === "move" ? "idle" : "move"); setSelAction(null); }}>
            👟 Muovi {activeUnit.hasMoved ? "✓" : ""}
          </button>
          {myActions.map((a, i) => (
            <button key={i} disabled={activeUnit.hasActed}
              className={selAction?.name === a.name ? "on" : ""} onClick={() => pickAction(a)}>
              {detectSpellIntent(a) === "heal" ? "💚" : detectSpellIntent(a) === "self_buff" ? "🛡" : "⚔"} {a.name} {activeUnit.hasActed ? "✓" : ""}
            </button>
          ))}
          <button className="tac-end" onClick={endTurn}>⏭ Fine turno</button>
        </div>
      )}

      <BattleChat currentUser={currentUser} isMaster={isMaster} charData={charData} locked={battle?.active && !fightStarted && !isMaster} />
    </div>
  );
}
