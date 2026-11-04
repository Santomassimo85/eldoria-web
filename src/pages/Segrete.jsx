/* LE SEGRETE — story mode della Sala della Gloria (fase 1, 2026-11-04):
   lobby delle stanze. Si crea o si entra in un gruppo (1–4), ognuno sceglie
   la classe (livello di storia per classe, si azzera domenica 23:00 come
   l'Arena) e preme Avvia: quando l'hanno premuto tutti il dungeon parte.
   Il combattimento (motore sul server + IA dei nemici) arriva nella fase 3. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import { currentWeekKey, weekEndLabel } from "../data/arenaWeek";
import { arenaClassKey } from "../data/arenaClassSprites";
import {
  MAX_PARTY, ROOM_IDLE_MS, STORY_CLASSES, classInfo, storyLevelOf, mergeDungeons, roomMember, roomFull, allReady,
} from "../data/segrete";
import {
  createRoom, joinRoom, leaveRoom, kickMember, setMemberClass, setReady, forceStart, reopenRoom, deleteRoom,
} from "../utils/segreteRooms";
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
          <small>Lv {storyLevelOf(charData, c.key)}</small>
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
  const now = Date.now();
  const openRooms = rooms
    .filter((r) => r.status === "open" && r.id !== myRoom?.id)
    .sort((a, b) => tsMs(b.updatedAt) - tsMs(a.updatedAt));
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
      <Link to="/sala-della-gloria" className="sgr-back">← Sala della Gloria</Link>
      <header className="sgr-head">
        <p className="sgr-kicker">Storia · gruppi da 1 a {MAX_PARTY}</p>
        <h1 className="sgr-title">Le Segrete</h1>
        <p className="sgr-lead">Livelli e dungeon valgono fino a {weekEndLabel()}: poi si riparte tutti dal livello 1. Se il gruppo cade, si perde tutto.</p>
      </header>

      {err && <p className="sgr-err" role="alert">{err}</p>}

      {myRoom ? (
        <MyRoom room={myRoom} uid={uid} master={master} charData={charData} busy={busy} run={run}
          dungeon={dungeonOf(myRoom.type)} level={level} />
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
                  className={`sgr-dungeon${type === d.key ? " is-on" : ""}`} onClick={() => setType(d.key)}>
                  <span className="sgr-dungeon-ico" aria-hidden="true">{d.icon}</span>
                  <b>{d.name}</b>
                  {d.desc && <small>{d.desc}</small>}
                </button>
              ))}
            </div>
            <p className="sgr-label">La tua classe</p>
            <ClassPicker value={cls} onChange={setCls} charData={charData} />
            <button type="button" className="sgr-cta" disabled={busy || !cls}
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
                  <li key={r.id} className="sgr-room">
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
                      <button type="button" className="sgr-btn" disabled={busy || roomFull(r) || !cls}
                        onClick={() => run(() => joinRoom(r.id, uid, charData, cls, level(cls)))}>
                        {roomFull(r) ? "Pieno" : `Entra come ${classInfo(cls)?.it || "…"}`}
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

function MyRoom({ room, uid, master, charData, busy, run, dungeon, level }) {
  const me = roomMember(room, uid);
  const host = room.hostUid === uid;
  const slots = Array.from({ length: MAX_PARTY }, (_, i) => room.members[i] || null);
  const readyN = room.members.filter((m) => m.ready).length;

  if (room.status === "running") {
    return (
      <section className="sgr-block sgr-myroom is-running">
        <p className="sgr-kicker">Il tuo gruppo</p>
        <h2 className="sgr-h2">{room.name} <DungeonBadge d={dungeon} /></h2>
        <p className="sgr-run-title">🗝 Il gruppo è sceso nelle Segrete!</p>
        <p className="sgr-lead">Il combattimento contro i mostri del dungeon è in costruzione: arriva con la prossima fase. Per ora la stanza resta qui.</p>
        <p className="sgr-room-line">{room.members.map((m) => `${classInfo(m.cls)?.icon || ""} ${m.name} (Lv ${m.level})`).join(" · ")}</p>
        {(host || master) && (
          <button type="button" className="sgr-btn" disabled={busy} onClick={() => run(() => reopenRoom(room.id))}>↺ Torna alla stanza</button>
        )}
      </section>
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

      <div className="sgr-start">
        <button type="button" className={`sgr-cta${me?.ready ? " is-ready" : ""}`} disabled={busy}
          onClick={() => run(() => setReady(room.id, uid, !me?.ready))}>
          {me?.ready ? "✓ Pronto — annulla" : "▶ Avvia"}
        </button>
        <span className="sgr-start-n">{readyN}/{room.members.length} pronti{allReady(room) ? "" : room.members.length > 1 ? " · si parte quando premono tutti" : ""}</span>
      </div>

      <div className="sgr-room-actions">
        <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => run(() => leaveRoom(room.id, uid))}>Esci dal gruppo</button>
        {master && <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => run(() => forceStart(room.id))}>▶ Avvia comunque (Master)</button>}
      </div>
    </section>
  );
}
