/* LE SEGRETE · la lotta (fase 3, 2026-11-04)
   Legge dungeon_runs/{roomId} (lo scrive solo il server, callable segreteDo) e
   manda le azioni. Gruppo in basso a sinistra, mostri a destra sullo sfondo del
   dungeon; quando tocca a te scegli l'azione e (se serve) il bersaglio toccandolo.
   Chi non risponde per 10 minuti: chiunque del gruppo lo fa difendere (anche da solo). */
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { heroActionList, targetKind, AFK_MS } from "../data/segreteEngine";
import { classInfo } from "../data/segrete";
import { classSpriteDocId } from "../data/arenaClassSprites";
import { showD20Roll, preloadDice3D } from "../components/DiceRoll";
import { useFightMode } from "../utils/fightMode";
import { leaveRoom } from "../utils/segreteRooms";
import "./SegreteBattle.css";

let callable = null;
const segreteDo = (data) => { callable = callable || httpsCallable(functions, "segreteDo"); return callable(data).then((r) => r.data); };
const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function Fighter({ c, isTurn, selectable, picked, onPick, classSprite, flash }) {
  const dead = c.hp <= 0;
  const img = dead && c.deadImg ? c.deadImg : c.img || (c.side === "h" ? classSprite : "");
  const pct = Math.max(0, Math.round((100 * c.hp) / Math.max(1, c.maxHp)));
  const mirror = c.side === "f" ? c.facing !== "right" : true;
  return (
    <button type="button" className={`sgb-f sgb-f--${c.side}${dead ? " is-dead" : ""}${isTurn ? " is-turn" : ""}${selectable ? " is-pick" : ""}${picked ? " is-picked" : ""}`}
      disabled={!selectable} onClick={() => selectable && onPick(c.id)} aria-label={`${c.name}, ${c.hp} su ${c.maxHp} PF`}>
      {flash && <span key={flash.k} className={`sgb-pop sgb-pop--${flash.kind}`}>{flash.txt}</span>}
      <span className="sgb-sprite">
        {img ? <img src={img} alt="" className={mirror ? "mirror" : ""} draggable="false" />
          : <span className="sgb-emoji" aria-hidden="true">{c.side === "h" ? classInfo(c.cls)?.icon : c.icon || (c.role === "boss" ? "👑" : "👹")}</span>}
      </span>
      <span className="sgb-hud">
        <b>{c.name}</b>
        <span className="sgb-bar"><i style={{ width: `${pct}%` }} className={pct < 30 ? "low" : ""} /></span>
        <small>{dead ? (c.fled ? "fuggito" : "a terra") : `${c.hp}/${c.maxHp} PF · CA ${c.ac}`}{c.side === "h" ? ` · Lv ${c.level}` : ""}</small>
      </span>
    </button>
  );
}

export default function SegreteBattle({ room, uid }) {
  useFightMode(true);
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [chosen, setChosen] = useState(null); // azione che aspetta il bersaglio
  const [logOpen, setLogOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [sprites, setSprites] = useState({});
  const [flashes, setFlashes] = useState({});
  const initAsked = useRef("");
  const seenSeq = useRef(0);
  const timeoutAsked = useRef("");

  useEffect(() => { preloadDice3D(); }, []);
  useEffect(() => onSnapshot(doc(db, "dungeon_runs", room.id), (s) => setRun(s.exists() ? s.data() : null), (e) => setErr(e.message)), [room.id]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // la partita non c'è (o è di un avvio precedente): la crea il server
  const startKey = room.startedAt?.toMillis ? room.startedAt.toMillis() : 0;
  useEffect(() => {
    if (room.status !== "running") return;
    if (run && run.startKey === startKey) return;
    const k = `${room.id}:${startKey}`;
    if (initAsked.current === k) return;
    initAsked.current = k;
    segreteDo({ op: "init", roomId: room.id }).catch((e) => setErr(e.message));
  }, [room.id, room.status, run, startKey]);

  // sprite di classe degli eroi senza immagine
  const clsList = useMemo(() => [...new Set((run?.heroes || []).map((h) => h.cls))].join(","), [run?.heroes]);
  useEffect(() => {
    clsList.split(",").filter(Boolean).forEach((cls) => {
      if (sprites[cls] !== undefined) return;
      getDoc(doc(db, "arena_meta", classSpriteDocId(cls))).then((s) => setSprites((m) => ({ ...m, [cls]: s.exists() ? s.data().image || "" : "" }))).catch(() => {});
    });
  }, [clsList]); // eslint-disable-line react-hooks/exhaustive-deps

  // numeri che saltano sui colpiti per le righe nuove
  useEffect(() => {
    if (!run?.log?.length) return;
    const last = run.log[run.log.length - 1].i;
    if (!seenSeq.current) { seenSeq.current = last; return; }
    const fresh = run.log.filter((l) => l.i > seenSeq.current);
    seenSeq.current = last;
    const next = {};
    fresh.forEach((l) => (l.targets || []).forEach((id) => {
      const kind = l.kind === "heal" ? "heal" : l.kind === "miss" ? "miss" : l.kind === "buff" || l.kind === "debuff" ? "buff" : "hit";
      next[id] = { k: `${l.i}-${id}`, kind, txt: kind === "miss" ? "mancato" : kind === "heal" ? "💚" : kind === "buff" ? "✨" : l.dmg ? `−${l.dmg}` : "💥" };
    }));
    if (Object.keys(next).length) {
      setFlashes(next);
      const t = setTimeout(() => setFlashes({}), 1400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [run?.log]);

  const cur = run && run.status === "fight" ? [...run.heroes, ...run.foes].find((c) => c.id === run.order[run.turn]) : null;
  const me = run?.heroes.find((h) => h.uid === uid) || null;
  const myTurn = !!(cur && cur.side === "h" && cur.uid === uid);
  const afkLeft = cur && cur.side === "h" ? AFK_MS - (now - (run.turnAt || now)) : null;

  // tempo scaduto: chiunque del gruppo fa difendere chi è sparito (una volta per turno)
  useEffect(() => {
    if (!cur || cur.side !== "h" || cur.uid === uid || afkLeft == null || afkLeft > 0) return;
    const k = `${run.seq}:${cur.id}`;
    if (timeoutAsked.current === k) return;
    timeoutAsked.current = k;
    segreteDo({ op: "timeout", roomId: room.id }).catch(() => {});
  }, [afkLeft, cur, uid, run?.seq, room.id]);

  useEffect(() => { if (!myTurn) setChosen(null); }, [myTurn]);

  const send = async (data) => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await segreteDo({ roomId: room.id, ...data });
      if (r?.ev?.roll?.nat) showD20Roll(r.ev.roll.nat, { label: "Il tuo tiro", dice: r.ev.roll.dice.length > 1 ? r.ev.roll.dice.map((v) => ({ value: v, dim: v !== r.ev.roll.nat })) : undefined });
    } catch (e) { setErr(e.message || "Azione non riuscita."); }
    finally { setBusy(false); setChosen(null); }
  };
  const pickAction = (a) => {
    const tk = targetKind(a);
    if (!tk) return send({ op: "act", actionId: a.id });
    setChosen(a);
  };
  const pickTarget = (id) => chosen && send({ op: "act", actionId: chosen.id, targetId: id });
  const flee = () => window.confirm("Abbandonare il dungeon? Il tuo eroe fugge e non prenderà premi.") && send({ op: "flee" });

  if (!run || run.startKey !== startKey) {
    return <div className="sgb-loading">{err ? <p className="sgb-err">{err}</p> : <p>🗝 Le porte delle Segrete si aprono…</p>}</div>;
  }

  const tk = chosen ? targetKind(chosen) : null;
  const last = run.log[run.log.length - 1];
  const acts = me ? heroActionList(me) : [];

  return (
    <div className="sgb">
      <div className="sgb-top">
        <span className="sgb-where">{run.dungeonIcon} {run.dungeonName} · {run.boss ? "👑 Sala del boss" : `Sala ${run.floor}/${run.floors}`} · round {run.round}</span>
        {run.status === "fight" && me && me.hp > 0 && <button type="button" className="sgb-flee" onClick={flee}>🏃 Abbandona</button>}
      </div>
      <button type="button" className="sgb-log" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen}>
        <span className="sgb-log-text" key={last?.i}>{last?.txt}</span>
        <span className="sgb-log-n">{logOpen ? "▴" : "▾"}</span>
      </button>
      {logOpen && (
        <ol className="sgb-log-list">
          {[...run.log].reverse().map((l) => <li key={l.i} className={`k-${l.kind || ""}`}>{l.txt}</li>)}
        </ol>
      )}

      <div className={`sgb-field${run.bg ? " has-bg" : ""}`} style={run.bg ? { backgroundImage: `url(${run.bg})` } : undefined}>
        <div className="sgb-foes">
          {run.foes.map((f) => (
            <Fighter key={f.id} c={f} isTurn={cur?.id === f.id} flash={flashes[f.id]}
              selectable={!!(tk === "foe" && f.hp > 0)} onPick={pickTarget} />
          ))}
        </div>
        <div className="sgb-heroes">
          {run.heroes.map((h) => (
            <Fighter key={h.id} c={h} isTurn={cur?.id === h.id} flash={flashes[h.id]} classSprite={sprites[h.cls]}
              selectable={!!(tk === "ally" && !h.fled && (h.hp > 0 || chosen?.kind === "heal"))} onPick={pickTarget} />
          ))}
        </div>
      </div>

      <div className="sgb-panel">
        {err && <p className="sgb-err" role="alert">{err}</p>}
        {run.status === "fight" && (myTurn ? (
          chosen ? (
            <div className="sgb-pickmsg">
              <span>{chosen.icon} <b>{chosen.name}</b>: tocca {tk === "foe" ? "un nemico" : "un alleato"} sul campo.</span>
              <button type="button" className="sgb-btn sgb-btn--ghost" onClick={() => setChosen(null)}>Annulla</button>
            </div>
          ) : (
            <>
              <p className="sgb-turn">⚔ Tocca a te{afkLeft != null ? ` · ${fmtLeft(afkLeft)}` : ""}</p>
              <div className="sgb-acts">
                {acts.map((a) => (
                  <button key={a.id} type="button" className={`sgb-act k-${a.kind}`} disabled={busy || (a.left != null && a.left <= 0)} onClick={() => pickAction(a)}>
                    <span className="sgb-act-ico" aria-hidden="true">{a.icon}</span>
                    <span className="sgb-act-name">{a.name}</span>
                    <span className="sgb-act-info">{a.info || actInfo(a, me.level)}</span>
                    {a.left != null && <span className="sgb-act-uses">{a.left}/{a.uses}</span>}
                  </button>
                ))}
              </div>
            </>
          )
        ) : (
          <p className="sgb-turn sgb-turn--wait">
            {cur?.side === "h" ? <>⏳ Tocca a <b>{cur.name}</b>{afkLeft != null ? ` · ${afkLeft > 0 ? `si difende da solo tra ${fmtLeft(afkLeft)}` : "lo faccio difendere…"}` : ""}</> : "👹 I mostri si muovono…"}
            {me && me.hp <= 0 && " · sei a terra: un alleato può curarti"}
          </p>
        ))}
        {run.status === "cleared" && (
          <div className="sgb-end">
            <p>✅ Sala ripulita! Breve riposo: +30% PF, chi è a terra si rialza, incantesimi ricaricati.</p>
            <button type="button" className="sgb-btn" disabled={busy} onClick={() => send({ op: "next" })}>{run.floor >= run.floors ? "👑 Affronta il boss" : "🚪 Prosegui alla prossima sala"}</button>
          </div>
        )}
        {(run.status === "won" || run.status === "lost") && (
          <div className="sgb-end">
            <p className="sgb-result">{run.status === "won" ? `🏆 Vittoria! ${run.dungeonName} è vostro.` : "☠ Sconfitta. Le Segrete vi hanno inghiottito: tutto è perduto."}</p>
            {(run.levelUps || []).map((l) => <p key={l.uid}>⬆ {l.name}: {classInfo(l.cls)?.it} Lv {l.from} → <b>Lv {l.to}</b></p>)}
            {run.status === "won" && !!run.corone && <p>🪙 +{run.corone} Corone a ogni eroe rimasto fino alla fine.</p>}
            {run.loot && (
              <p className="sgb-loot">{run.loot.img && <img src={run.loot.img} alt="" />}
                <span>🎁 Nel forziere del boss: <b>{run.loot.name}</b>, va a <b>{run.loot.winner}</b>{run.loot.uid === uid ? " (a te!)" : ""}. Arriverà nella scheda su Foundry.</span></p>
            )}
            <button type="button" className="sgb-btn" disabled={busy} onClick={() => leaveRoom(room.id, uid).catch((e) => setErr(e.message))}>Torna alla lobby</button>
          </div>
        )}
      </div>
    </div>
  );
}

function actInfo(a, lv) {
  if (a.kind === "defend") return "+4 CA fino al tuo turno";
  if (a.kind === "heal") return a.flat ? `cura ${lv * 5}` : `cura ${a.dice}${a.plusMod ? "+mod" : ""}`;
  if (a.kind === "heal_all") return `cura tutti ${a.dice}+mod`;
  if (a.kind === "buff") return a.buff === "ac" ? `+${a.value} CA · ${a.turns}t` : a.buff === "adv" ? `vantaggio · ${a.turns}t` : `+${a.value} danni · ${a.turns}t`;
  if (a.kind === "save") return `${a.dice} · TS ${a.save.toUpperCase()}${a.area ? " · tutti" : ""}`;
  if (a.kind === "missile") return `${a.dice}+${a.flat || 0} · colpisce sempre`;
  return `${a.dice}${a.kind === "weapon" ? "+mod" : ""}`;
}
