/* LE SEGRETE — story mode della Sala della Gloria (fase 1, 2026-11-04):
   lobby delle stanze. Si crea o si entra in un gruppo (1–4), ognuno sceglie
   la classe (livello di storia per classe, si azzera domenica 23:00 come
   l'Arena) e preme Avvia: quando l'hanno premuto tutti il dungeon parte.
   Il combattimento (motore sul server + IA dei nemici) arriva nella fase 3. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import { isHiddenChar } from "../data/hiddenPlayers";
import { currentWeekKey, weekEndLabel } from "../data/arenaWeek";
import { arenaClassKey } from "../data/arenaClassSprites";
import {
  MAX_PARTY, ROOM_IDLE_MS, DAILY_RUNS, WEEKLY_RUNS, RUN_COUNTS_AFTER, runsOf, STORY_CLASSES, classInfo, storyLevelOf, heroOf, mergeDungeons, roomMember, roomFull, allReady,
} from "../data/segrete";
import {
  createRoom, joinRoom, leaveRoom, kickMember, setMemberClass, setReady, forceStart, reopenRoom, deleteRoom, invitePlayers,
} from "../utils/segreteRooms";
import SegreteBattle from "./SegreteBattle";
import SegreteHero from "./SegreteHero";
import { hpPending } from "../data/segreteKits";
// eroe pronto a giocare: creato e con i PF tirati
const heroReady = (charData, cls) => { const h = heroOf(charData, cls); return !!h && hpPending(h) === 0; };
import "./Segrete.css";

const tsMs = (t) => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : 0);

function ClassPicker({ value, onChange, charData, disabled }) {
  return (
    <div className="sgr-classes" role="radiogroup" aria-label="Classe">
      {STORY_CLASSES.map((c) => (
        <button key={c.key} type="button" role="radio" aria-checked={value === c.key} disabled={disabled}
          className={`sgr-class${value === c.key ? " is-on" : ""}`} onClick={() => onChange(c.key)}>
          <span aria-hidden="true">{c.icon}</span>
          <b>{c.it}</b>
          <small>{heroOf(charData, c.key) ? `Lv ${storyLevelOf(charData, c.key)}` : "da creare"}</small>
          {heroOf(charData, c.key) && !runsOf(charData, c.key).canRun && <small className="sgr-class-done">{runsOf(charData, c.key).weekCount >= WEEKLY_RUNS ? "✓ settimana fatta" : "✓ fatto oggi"}</small>}
        </button>
      ))}
    </div>
  );
}

function DungeonBadge({ d }) {
  if (!d) return null;
  return <span className="sgr-dbadge"><span aria-hidden="true">{d.icon}</span> {d.name}</span>;
}

export default function Segrete() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const master = isMainMaster(currentUser?.email);
  const week = currentWeekKey();

  const [charData, setCharData] = useState(null);
  const [custom, setCustom] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cls, setCls] = useState(null);
  const [type, setType] = useState("segrete");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(doc(db, "characters", uid), (s) => setCharData(s.exists() ? s.data() : null), () => {});
  }, [uid]);
  useEffect(() => onSnapshot(collection(db, "dungeon_types"), (s) => setCustom(s.docs.map((d) => ({ key: d.id, ...d.data() }))), () => setCustom([])), []);
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(query(collection(db, "dungeon_rooms"), where("weekKey", "==", week)),
      (s) => setRooms(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setErr(e.message));
  }, [uid, week]);

  // classe proposta: quella dell'ultimo assetto dell'Arena, altrimenti la prima
  useEffect(() => {
    if (cls || !charData) return;
    setCls(arenaClassKey(charData.arenaLastLoadout?.class) || arenaClassKey(charData.class) || STORY_CLASSES[0].key);
  }, [charData, cls]);

  const dungeons = useMemo(() => mergeDungeons(custom), [custom]);
  const dungeonOf = (key) => dungeons.find((d) => d.key === key) || { key, name: key, icon: "🗝" };
  const myRoom = rooms.find((r) => (r.memberIds || []).includes(uid)) || null;
  const runCls = myRoom?.members?.find((m) => m.uid === uid)?.cls || cls;
  const runs = runsOf(charData, runCls);
  const inFight = !!myRoom && (myRoom.status === "running" || myRoom.status === "done");
  const now = Date.now();
  const invitedTo = (r) => (r.invited || []).find((i) => i.uid === uid) || null;
  const openRooms = rooms
    .filter((r) => r.status === "open" && r.id !== myRoom?.id)
    .sort((a, b) => Number(invitedTo(b)) - Number(invitedTo(a)) || tsMs(b.updatedAt) - tsMs(a.updatedAt));
  const running = rooms.filter((r) => r.status === "running" && r.id !== myRoom?.id);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr(e.message || "Qualcosa è andato storto."); }
    finally { setBusy(false); }
  };
  const level = (k) => storyLevelOf(charData, k);

  if (!uid) {
    return (
      <section className="sgr-page">
        <header className="sgr-head"><h1 className="sgr-title">Le Segrete</h1></header>
        <p className="sgr-empty">Accedi per formare un gruppo e scendere nei dungeon.</p>
      </section>
    );
  }

  return (
    <section className="sgr-page">
      {!inFight && (
        <>
      <Link to="/sala-della-gloria" className="sgr-back">← Sala della Gloria</Link>
      <header className="sgr-head">
        <p className="sgr-kicker">Storia · gruppi da 1 a {MAX_PARTY}</p>
        <h1 className="sgr-title">Le Segrete</h1>
        <p className="sgr-lead">Ogni classe ha il suo eroe, che resta tuo e cresce di livello vincendo i dungeon. I dungeon della settimana si contano fino a {weekEndLabel()}. Se il gruppo cade, si perde tutto.</p>
        <p className="sgr-runs">🗝 Dungeon {runCls ? `col ${classInfo(runCls)?.it}` : ""}: oggi <b>{runs.dayCount}/{DAILY_RUNS}</b> · questa settimana <b>{runs.weekCount}/{WEEKLY_RUNS}</b>{master ? " · tu sei il Master: nessun limite" : !runs.canRun ? (runs.weekCount >= WEEKLY_RUNS ? " · finiti per questa classe: prova un'altra classe" : " · fatto oggi con questa classe: puoi usarne un'altra") : ""}
          <br /><small>Il limite vale per classe. Un dungeon conta solo dopo aver ripulito {RUN_COUNTS_AFTER} sale (o vinto): se cadete prima, potete riprovare.</small></p>
      </header>

        </>
      )}
      {err && <p className="sgr-err" role="alert">{err}</p>}

      {myRoom ? (
        <MyRoom room={myRoom} uid={uid} master={master} charData={charData} busy={busy} run={run}
          dungeon={dungeonOf(myRoom.type)} level={level} canRun={master || runs.canRun} />
      ) : (
        <>
          <section className="sgr-block">
            <h2 className="sgr-h2">Forma un gruppo</h2>
            <label className="sgr-label" htmlFor="sgr-name">Nome del gruppo</label>
            <input id="sgr-name" className="sgr-input" value={name} maxLength={40}
              placeholder={`Gruppo di ${charData?.name || "…"}`} onChange={(e) => setName(e.target.value)} />
            <p className="sgr-label">Dove scendete</p>
            <div className="sgr-dungeons" role="radiogroup" aria-label="Dungeon">
              {dungeons.map((d) => (
                <button key={d.key} type="button" role="radio" aria-checked={type === d.key}
                  className={`sgr-dungeon${type === d.key ? " is-on" : ""}${d.backgrounds?.[0] ? " has-bg" : ""}`} onClick={() => setType(d.key)}
                  style={d.backgrounds?.[0] ? { backgroundImage: `linear-gradient(180deg, rgba(10,8,14,.35), rgba(10,8,14,.92)), url(${d.backgrounds[0]})` } : undefined}>
                  <span className="sgr-dungeon-ico" aria-hidden="true">{d.icon}</span>
                  <b>{d.name}</b>
                  {d.desc && <small>{d.desc}</small>}
                </button>
              ))}
            </div>
            <p className="sgr-label">La tua classe</p>
            <ClassPicker value={cls} onChange={setCls} charData={charData} />
            <SegreteHero cls={cls} charData={charData} />
            <button type="button" className="sgr-cta" disabled={busy || !cls || !heroReady(charData, cls)}
              title={heroReady(charData, cls) ? "" : "Crea l'eroe e tira i PF prima"}
              onClick={() => run(() => createRoom(uid, charData, { name, type, cls, level: level(cls) }))}>
              Crea il gruppo
            </button>
          </section>

          <section className="sgr-block">
            <h2 className="sgr-h2">Gruppi che cercano compagni <span className="sgr-count">{openRooms.length}</span></h2>
            {!openRooms.length && <p className="sgr-empty">Nessun gruppo aperto. Creane uno: gli altri lo vedranno qui.</p>}
            <ul className="sgr-rooms">
              {openRooms.map((r) => {
                const idle = now - tsMs(r.updatedAt) > ROOM_IDLE_MS;
                return (
                  <li key={r.id} className={`sgr-room${invitedTo(r) ? " is-invited" : ""}`}>
                    {invitedTo(r) && <p className="sgr-invited">📨 {invitedTo(r).by || "Il gruppo"} ti ha invitato!</p>}
                    <div className="sgr-room-top">
                      <b className="sgr-room-name">{r.name}</b>
                      <DungeonBadge d={dungeonOf(r.type)} />
                      <span className="sgr-room-n">{r.members.length}/{MAX_PARTY}</span>
                    </div>
                    <ul className="sgr-room-members">
                      {r.members.map((m) => (
                        <li key={m.uid}>{classInfo(m.cls)?.icon} {m.name} <small>· {classInfo(m.cls)?.it} Lv {m.level}{m.uid === r.hostUid ? " · capo" : ""}</small></li>
                      ))}
                    </ul>
                    <div className="sgr-room-actions">
                      <button type="button" className="sgr-btn" disabled={busy || roomFull(r) || !cls || !heroReady(charData, cls)}
                        onClick={() => run(() => joinRoom(r.id, uid, charData, cls, level(cls)))}>
                        {roomFull(r) ? "Pieno" : !heroOf(charData, cls) ? "Crea prima l'eroe" : !heroReady(charData, cls) ? "Tira prima i PF" : `Entra come ${classInfo(cls)?.it || "…"} Lv ${level(cls)}`}
                      </button>
                      {(master || idle) && (
                        <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy}
                          onClick={() => run(() => deleteRoom(r.id))}>{master ? "🗑 Sciogli" : "🗑 Sciogli (fermo da ore)"}</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {!!openRooms.length && <p className="sgr-hint">Entri con la classe scelta sopra, in «La tua classe».</p>}
          </section>

          {!!running.length && (
            <section className="sgr-block">
              <h2 className="sgr-h2">Nelle Segrete adesso <span className="sgr-count">{running.length}</span></h2>
              <ul className="sgr-rooms">
                {running.map((r) => (
                  <li key={r.id} className="sgr-room is-running">
                    <div className="sgr-room-top">
                      <b className="sgr-room-name">{r.name}</b>
                      <DungeonBadge d={dungeonOf(r.type)} />
                    </div>
                    <p className="sgr-room-line">{r.members.map((m) => `${classInfo(m.cls)?.icon || ""} ${m.name}`).join(" · ")}</p>
                    {master && (
                      <div className="sgr-room-actions">
                        <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => run(() => reopenRoom(r.id))}>↺ Riporta in stanza</button>
                        <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => run(() => deleteRoom(r.id))}>🗑 Sciogli</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}

function MyRoom({ room, uid, master, charData, busy, run, dungeon, level, canRun }) {
  const me = roomMember(room, uid);
  const host = room.hostUid === uid;
  const slots = Array.from({ length: MAX_PARTY }, (_, i) => room.members[i] || null);
  const readyN = room.members.filter((m) => m.ready).length;

  if (room.status === "running" || room.status === "done") {
    return (
      <>
        <SegreteBattle room={room} uid={uid} />
        {master && (
          <div className="sgr-room-actions">
            <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => run(() => reopenRoom(room.id))}>↺ Riporta in stanza (Master)</button>
          </div>
        )}
      </>
    );
  }

  return (
    <section className="sgr-block sgr-myroom">
      <p className="sgr-kicker">Il tuo gruppo</p>
      <h2 className="sgr-h2">{room.name} <DungeonBadge d={dungeon} /></h2>
      {dungeon?.desc && <p className="sgr-hint">{dungeon.desc}</p>}

      <ol className="sgr-slots">
        {slots.map((m, i) => (
          <li key={m?.uid || `vuoto-${i}`} className={`sgr-slot${m ? "" : " is-empty"}${m?.ready ? " is-ready" : ""}`}>
            {m ? (
              <>
                <span className="sgr-slot-ico" aria-hidden="true">{classInfo(m.cls)?.icon}</span>
                <span className="sgr-slot-main">
                  <b>{m.name}{m.uid === room.hostUid && <em className="sgr-tag">capo</em>}</b>
                  <small>{classInfo(m.cls)?.it} · Lv {m.level}</small>
                </span>
                <span className={`sgr-slot-state${m.ready ? " is-on" : ""}`}>{m.ready ? "✓ Pronto" : "In attesa"}</span>
                {(host || master) && m.uid !== uid && (
                  <button type="button" className="sgr-x" disabled={busy} aria-label={`Togli ${m.name}`} title="Togli dal gruppo"
                    onClick={() => run(() => kickMember(room.id, uid, m.uid, master))}>✕</button>
                )}
              </>
            ) : (
              <span className="sgr-slot-free">Posto libero</span>
            )}
          </li>
        ))}
      </ol>

      <p className="sgr-label">La tua classe</p>
      <ClassPicker value={me?.cls} charData={charData} disabled={busy}
        onChange={(k) => k !== me?.cls && run(() => setMemberClass(room.id, uid, k, level(k)))} />
      <SegreteHero cls={me?.cls} charData={charData} />

      {room.blocked && <p className="sgr-err" role="alert">⛔ Non si può partire: {room.blocked}.</p>}
      {!canRun && <p className="sgr-err">⛔ Con {classInfo(me?.cls)?.it || "questa classe"} hai già fatto {runsOf(charData, me?.cls).weekCount >= WEEKLY_RUNS ? `i ${WEEKLY_RUNS} dungeon della settimana` : "il dungeon di oggi"}: scegli un'altra classe qui sopra per partire.</p>}
      <div className="sgr-start">
        <button type="button" className={`sgr-cta${me?.ready ? " is-ready" : ""}`} disabled={busy || (!me?.ready && (!canRun || !heroReady(charData, me?.cls)))}
          onClick={() => run(() => setReady(room.id, uid, !me?.ready))}>
          {me?.ready ? "✓ Pronto — annulla" : "▶ Avvia"}
        </button>
        <span className="sgr-start-n">{readyN}/{room.members.length} pronti{allReady(room) ? "" : room.members.length > 1 ? " · si parte quando premono tutti" : ""}</span>
      </div>

      {room.members.length < MAX_PARTY && <InvitePanel room={room} uid={uid} myName={me?.name || charData?.name} busy={busy} run={run} />}

      <div className="sgr-room-actions">
        <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => run(() => leaveRoom(room.id, uid))}>Esci dal gruppo</button>
        {master && <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => run(() => forceStart(room.id))}>▶ Avvia comunque (Master)</button>}
      </div>
    </section>
  );
}

/* Invita giocatori (2026-11-04): elenco dei personaggi attivi (non nascosti, non già
   nel gruppo), si spuntano e parte una notifica a ognuno. */
function InvitePanel({ room, uid, myName, busy, run }) {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState(null);
  const [sel, setSel] = useState([]);
  const [done, setDone] = useState("");
  useEffect(() => {
    if (!open || players) return;
    getDocs(collection(db, "characters")).then((s) => {
      setPlayers(s.docs.map((d) => ({ uid: d.id, ...d.data() }))
        .filter((c) => c.name && !isHiddenChar({ id: c.uid, name: c.name }) && c.uid !== uid && !String(c.name).toLowerCase().includes("master"))
        .sort((a, b) => String(a.name).localeCompare(b.name)));
    }).catch(() => setPlayers([]));
  }, [open, players, uid]);
  const invited = new Set((room.invited || []).map((i) => i.uid));
  const list = (players || []).filter((p) => !(room.memberIds || []).includes(p.uid));
  const free = MAX_PARTY - room.members.length;
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const send = () => run(async () => {
    const targets = list.filter((p) => sel.includes(p.uid)).map((p) => ({ uid: p.uid, name: p.name }));
    const n = await invitePlayers(room.id, uid, myName, targets);
    setSel([]); setDone(`📨 ${n === 1 ? "Invito mandato" : `${n} inviti mandati`}: riceveranno una notifica.`);
  });
  return (
    <div className="sgr-invite">
      <button type="button" className="sgr-btn sgr-btn--ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        📨 Invita giocatori {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="sgr-invite-box">
          <p className="sgr-hint">Posti liberi: {free}. Scegli chi invitare: riceve una notifica e trova il gruppo in cima alla lista.</p>
          {!players && <p className="sgr-hint">Carico i giocatori…</p>}
          <div className="sgr-invite-list">
            {list.map((p) => (
              <label key={p.uid} className={`sgr-invite-p${sel.includes(p.uid) ? " is-on" : ""}`}>
                <input type="checkbox" checked={sel.includes(p.uid)} onChange={() => toggle(p.uid)} />
                <span>{p.name}</span>
                {invited.has(p.uid) && <small>✓ già invitato</small>}
              </label>
            ))}
          </div>
          {done && <p className="sgr-hint">{done}</p>}
          <button type="button" className="sgr-btn" disabled={busy || !sel.length} onClick={send}>📨 Invita {sel.length ? `(${sel.length})` : ""}</button>
        </div>
      )}
    </div>
  );
}
