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
import { currentWeekKey } from "../data/arenaWeek";
import { arenaClassKey } from "../data/arenaClassSprites";
import {
  MAX_PARTY, ROOM_IDLE_MS, DAILY_RUNS, DAILY_TOTAL, WEEKLY_RUNS, runsOf, clsStyle, romeDayKey, STORY_CLASSES, classInfo, storyLevelOf, heroOf, mergeDungeons, roomMember, roomFull, allReady,
} from "../data/segrete";
import {
  createRoom, joinRoom, leaveRoom, kickMember, setMemberClass, setReady, forceStart, reopenRoom, deleteRoom, invitePlayers, voteDungeon, chooseDungeon,
} from "../utils/segreteRooms";
import SegreteBattle from "./SegreteBattle";
import SegreteHero from "./SegreteHero";
import SegreteShop from "./SegreteShop";
import SegreteManual from "./SegreteManual";
import SegreteVoice from "./SegreteVoice";
import SegreteLog, { coinsToday, storyLogOf } from "./SegreteLog";
import { COIN_ICON, COIN_NAME, coinsOf } from "../data/segreteItems";
import { hpPending } from "../data/segreteKits";
import { HeroRoster, NewClassPicker, HeroNews, heroClasses, heroTodo } from "./SegreteRoster";
// eroe pronto a giocare: creato e con i PF tirati
const heroReady = (charData, cls) => { const h = heroOf(charData, cls); return !!h && hpPending(h) === 0; };
import "./Segrete.css";

const tsMs = (t) => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : 0);

/* Con quale eroe entri / crei il gruppo (tocco = va alla scheda Personaggi) */
function EnterAs({ charData, cls, onChange }) {
  const c = classInfo(cls);
  const h = heroOf(charData, cls);
  return (
    <p className="sgr-enteras" style={clsStyle(cls)}>
      Entri con: {c && h ? <b className="sgr-clsname">{c.icon} {c.it} Lv {storyLevelOf(charData, cls)}</b> : <b>nessun eroe pronto</b>}
      <button type="button" className="sgr-linkbtn" onClick={onChange}>cambia eroe →</button>
      {c && h && !heroReady(charData, cls) && <small> · prima tira i PF nella sua scheda</small>}
    </p>
  );
}

/* Scheda Personaggi: i tuoi eroi (con la scheda di quello scelto) + creare un eroe nuovo */
function HeroSections({ charData, cls, onSelect, disabled, inRoom }) {
  const has = !!heroOf(charData, cls);
  const detail = (
    <div id="sgr-hero-detail" style={clsStyle(cls)}>
      <SegreteHero cls={cls} charData={charData} />
    </div>
  );
  return (
    <>
      <section className="sgr-block" id="sgr-eroi">
        <h2 className="sgr-h2">🧝 I tuoi eroi <span className="sgr-count">{heroClasses(charData).length}/{STORY_CLASSES.length}</span></h2>
        <p className="sgr-hint">Un eroe per classe, resta tuo per sempre. Tocca un eroe per sceglierlo{inRoom ? " nel gruppo (toglie la tua spunta di Avvia)" : " per il prossimo gruppo"} e aprire qui sotto la sua scheda.</p>
        <HeroRoster charData={charData} value={cls} onSelect={onSelect} disabled={disabled} playingLabel={inRoom ? "nel gruppo" : "scelto"} />
        {has && detail}
      </section>
      <section className="sgr-block">
        <h2 className="sgr-h2">✚ Crea un eroe</h2>
        <NewClassPicker charData={charData} value={has ? null : cls} onSelect={onSelect} disabled={disabled} />
        {!has && cls && detail}
      </section>
    </>
  );
}

function DungeonBadge({ d }) {
  if (!d) return null;
  return <span className="sgr-dbadge"><span aria-hidden="true">{d.icon}</span> {d.name}</span>;
}

const TABS = [
  { key: "gruppi", icon: "⚔", label: "Gruppi" },
  { key: "eroi", icon: "🧝", label: "Personaggi" },
  { key: "bottega", icon: "🏪", label: "Bottega" },
  { key: "zaino", icon: "🎒", label: "Zaino" },
  { key: "manuale", icon: "📖", label: "Manuale" },
];
const TAB_KEY = "sgr_tab";
const readTab = () => { try { const t = localStorage.getItem(TAB_KEY); return TABS.some((x) => x.key === t) ? t : "gruppi"; } catch { return "gruppi"; } };

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
  const [tab, setTabState] = useState(readTab);
  const setTab = (t) => {
    setTabState(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* niente */ }
  };

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

  // eroe proposto: quello della classe dell'Arena se c'è, sennò il primo eroe creato
  useEffect(() => {
    if (cls || !charData) return;
    const arena = arenaClassKey(charData.arenaLastLoadout?.class) || arenaClassKey(charData.class);
    setCls((arena && heroOf(charData, arena) ? arena : heroClasses(charData)[0]?.key) || arena || STORY_CLASSES[0].key);
  }, [charData, cls]);

  const dungeons = useMemo(() => mergeDungeons(custom), [custom]);
  const dungeonOf = (key) => dungeons.find((d) => d.key === key) || { key, name: key, icon: "🗝" };
  const myRoom = rooms.find((r) => (r.memberIds || []).includes(uid)) || null;
  const meInRoom = myRoom ? roomMember(myRoom, uid) : null;
  const curCls = meInRoom?.cls || cls;
  const runs = runsOf(charData, curCls);
  const inFight = !!myRoom && (myRoom.status === "running" || myRoom.status === "done");
  const now = Date.now();
  const invitedTo = (r) => (r.invited || []).find((i) => i.uid === uid) || null;
  const openRooms = rooms
    .filter((r) => r.status === "open" && r.id !== myRoom?.id)
    .sort((a, b) => Number(invitedTo(b)) - Number(invitedTo(a)) || tsMs(b.updatedAt) - tsMs(a.updatedAt));
  const running = rooms.filter((r) => r.status === "running" && r.id !== myRoom?.id);
  const invites = openRooms.filter(invitedTo).length;
  const todoN = heroClasses(charData).filter((c) => heroTodo(heroOf(charData, c.key)).length).length;

  const run = async (fn) => {
    if (busy) return;
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr(e.message || "Qualcosa è andato storto."); }
    finally { setBusy(false); }
  };
  const level = (k) => storyLevelOf(charData, k);
  // scegliere un eroe: nel gruppo cambia l'eroe del gruppo, fuori lo prepara per il prossimo
  const pickHero = (k) => {
    if (myRoom && myRoom.status === "open" && meInRoom) {
      if (k !== meInRoom.cls) run(() => setMemberClass(myRoom.id, uid, k, level(k)));
    } else setCls(k);
    if (tab !== "eroi") setTab("eroi");
    setTimeout(() => document.getElementById("sgr-hero-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };

  if (!uid) {
    return (
      <section className="sgr-page">
        <header className="sgr-head"><h1 className="sgr-title">Le Segrete</h1></header>
        <p className="sgr-empty">Accedi per formare un gruppo e scendere nei dungeon.</p>
      </section>
    );
  }

  // chat vocale: stessa posizione (primo figlio, stessa key) nella stanza e in lotta, così non si scollega
  const voice = myRoom ? <SegreteVoice key={`voice-${myRoom.id}`} roomId={myRoom.id} uid={uid} name={meInRoom?.name || charData?.name || ""} members={myRoom.members || []} /> : null;

  if (inFight) {
    return (
      <section className="sgr-page">
        {voice}
        {err && <p className="sgr-err" role="alert">{err}</p>}
        <MyRoom room={myRoom} uid={uid} master={master} charData={charData} busy={busy} run={run}
          dungeon={dungeonOf(myRoom.type)} canRun />
      </section>
    );
  }

  const ci = classInfo(curCls);
  const curHero = heroOf(charData, curCls);
  const readyN = myRoom ? myRoom.members.filter((m) => m.ready).length : 0;
  const badge = { gruppi: invites || (myRoom ? "●" : 0), eroi: todoN };

  return (
    <section className="sgr-page">
      {voice}
      <Link to="/sala-della-gloria" className="sgr-back">← Sala della Gloria</Link>
      <header className="sgr-head">
        <h1 className="sgr-title">Le Segrete</h1>
        <p className="sgr-lead">Dungeon a gruppi da 1 a {MAX_PARTY}. Il tuo eroe cresce vincendo; se il gruppo cade, si perde il bottino.</p>
      </header>

      {/* Dove sei e con chi: sempre visibile */}
      <div className="sgr-status">
        <button type="button" className="sgr-st sgr-st--hero" style={clsStyle(curCls)} onClick={() => setTab("eroi")}>
          <span className="sgr-st-ico" aria-hidden="true">{ci?.icon || "?"}</span>
          <span className="sgr-st-txt"><small>Il tuo eroe</small><b>{ci && curHero ? `${ci.it} · Lv ${level(curCls)}` : "da creare"}</b></span>
        </button>
        <button type="button" className={`sgr-st${myRoom ? " is-live" : ""}`} onClick={() => setTab("gruppi")}>
          <span className="sgr-st-ico" aria-hidden="true">⚔</span>
          <span className="sgr-st-txt"><small>Gruppo</small><b>{myRoom ? `${myRoom.name} · ${readyN}/${myRoom.members.length} pronti` : invites ? `📨 ${invites} invit${invites === 1 ? "o" : "i"}` : "nessuno"}</b></span>
        </button>
        <div className="sgr-st">
          <span className="sgr-st-ico" aria-hidden="true">🗝</span>
          <span className="sgr-st-txt"><small>Dungeon oggi</small><b>{master ? "∞ (Master)" : `${runs.total}/${DAILY_TOTAL} · ${ci?.it || "classe"} ${runs.dayCount}/${DAILY_RUNS} · sett. ${runs.weekCount}/${WEEKLY_RUNS}`}</b></span>
        </div>
        <button type="button" className="sgr-st" onClick={() => setTab("zaino")}>
          <span className="sgr-st-ico" aria-hidden="true">{COIN_ICON}</span>
          <span className="sgr-st-txt"><small>{COIN_NAME}</small><b>{coinsOf(charData)}{coinsToday(charData) ? <span className="sgr-st-plus"> · +{coinsToday(charData)} oggi</span> : null}</b></span>
        </button>
      </div>

      <div className="sgr-tabs" id="sgr-tabs" role="navigation" aria-label="Sezioni delle Segrete">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`sgr-tab${tab === t.key ? " is-on" : ""}`} aria-current={tab === t.key ? "page" : undefined} onClick={() => setTab(t.key)}>
            <span className="sgr-tab-ico" aria-hidden="true">{t.icon}</span>
            <span className="sgr-tab-lbl">{t.label}</span>
            {!!badge[t.key] && <em className="sgr-tab-badge">{badge[t.key]}</em>}
          </button>
        ))}
      </div>

      {err && <p className="sgr-err" role="alert">{err}</p>}

      {tab === "gruppi" && (
        myRoom ? (
          <MyRoom room={myRoom} uid={uid} master={master} charData={charData} busy={busy} run={run}
            dungeon={dungeonOf(myRoom.type)} dungeons={dungeons} canRun={master || runs.canRun} onHeroes={() => setTab("eroi")} />
        ) : (
          <>
            <HeroNews charData={charData} onSelect={pickHero} />
            {!!openRooms.length && (
              <section className="sgr-block">
                <h2 className="sgr-h2">Entra in un gruppo <span className="sgr-count">{openRooms.length}</span></h2>
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
                            <li key={m.uid} style={clsStyle(m.cls)}><span className="sgr-clsdot" aria-hidden="true" />{classInfo(m.cls)?.icon} {m.name} <small>· <span className="sgr-clsname">{classInfo(m.cls)?.it}</span> Lv {m.level}{m.uid === r.hostUid ? " · capo" : ""}</small></li>
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
              </section>
            )}

            <section className="sgr-block">
              <h2 className="sgr-h2">Crea un gruppo</h2>
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
              <EnterAs charData={charData} cls={cls} onChange={() => setTab("eroi")} />
              <button type="button" className="sgr-cta" disabled={busy || !cls || !heroReady(charData, cls)}
                title={heroReady(charData, cls) ? "" : "Crea l'eroe e tira i PF prima"}
                onClick={() => run(() => createRoom(uid, charData, { name, type, cls, level: level(cls) }))}>
                Crea il gruppo
              </button>
              {!openRooms.length && <p className="sgr-hint">Nessun gruppo aperto ora: quando qualcuno ne crea uno, compare sopra questo riquadro.</p>}
            </section>
            {storyLogOf(charData).some((e) => e.day === romeDayKey()) && <SegreteLog charData={charData} />}

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
        )
      )}

      {tab === "eroi" && (
        <>
          <HeroNews charData={charData} onSelect={pickHero} />
          <HeroSections charData={charData} cls={curCls} onSelect={pickHero} disabled={busy} inRoom={!!myRoom} />
        </>
      )}
      {tab === "bottega" && <SegreteShop charData={charData} view="bottega" />}
      {tab === "zaino" && <><SegreteLog charData={charData} /><SegreteShop charData={charData} view="zaino" uid={uid} /></>}
      {tab === "manuale" && <SegreteManual />}
    </section>
  );
}

/* Prossimo dungeon (2026-11-05): ognuno vota (tocco sulla carta), il capo sceglie quale avviare */
function DungeonVote({ room, uid, master, busy, run, dungeons }) {
  const host = room.hostUid === uid || master;
  const votesOf = (k) => room.members.filter((m) => m.vote === k);
  const myVote = room.members.find((m) => m.uid === uid)?.vote || null;
  const top = Math.max(0, ...dungeons.map((d) => votesOf(d.key).length));
  return (
    <div className="sgr-vote">
      <p className="sgr-label">Prossimo dungeon <small>· tocca per votare{host ? " · tu sei il capo: scegli quale avviare" : " · lo sceglie il capo"}</small></p>
      <div className="sgr-vote-grid">
        {dungeons.map((d) => {
          const v = votesOf(d.key);
          const on = room.type === d.key;
          return (
            <div key={d.key} className={`sgr-vote-card${on ? " is-chosen" : ""}${myVote === d.key ? " is-mine" : ""}${v.length && v.length === top ? " is-top" : ""}`}
              style={d.backgrounds?.[0] ? { backgroundImage: `linear-gradient(180deg, rgba(10,8,14,.45), rgba(10,8,14,.94)), url(${d.backgrounds[0]})` } : undefined}>
              <button type="button" className="sgr-vote-main" disabled={busy} aria-pressed={myVote === d.key} onClick={() => run(() => voteDungeon(room.id, uid, d.key))}>
                <span className="sgr-vote-top"><span aria-hidden="true">{d.icon}</span> <b>{d.name}</b>{on && <em className="sgr-vote-chosen">✓ scelto</em>}</span>
                <span className="sgr-vote-who">
                  {v.length ? v.map((m) => <i key={m.uid} style={clsStyle(m.cls)} title={m.name}>{classInfo(m.cls)?.icon} {m.name}</i>) : <small>nessun voto</small>}
                </span>
                <span className="sgr-vote-act">{myVote === d.key ? "✓ il tuo voto" : "🗳 vota"}</span>
              </button>
              {host && !on && <button type="button" className="sgr-btn sgr-vote-pick" disabled={busy} onClick={() => run(() => chooseDungeon(room.id, uid, d.key, master))}>👑 Avvia questo</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MyRoom({ room, uid, master, charData, busy, run, dungeon, dungeons = [], canRun, onHeroes }) {
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
      {room.result && <p className="sgr-hint">Ultimo dungeon: {room.result === "won" ? "🏆 vinto" : "☠ perso"}.</p>}

      <ol className="sgr-slots">
        {slots.map((m, i) => (
          <li key={m?.uid || `vuoto-${i}`} className={`sgr-slot${m ? "" : " is-empty"}${m?.ready ? " is-ready" : ""}`} style={m ? clsStyle(m.cls) : undefined}>
            {m ? (
              <>
                <span className="sgr-slot-ico" aria-hidden="true">{classInfo(m.cls)?.icon}</span>
                <span className="sgr-slot-main">
                  <b>{m.name}{m.uid === room.hostUid && <em className="sgr-tag">capo</em>}</b>
                  <small><span className="sgr-clsname">{classInfo(m.cls)?.it}</span> · Lv {m.level}</small>
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

      {!!dungeons.length && <DungeonVote room={room} uid={uid} master={master} busy={busy} run={run} dungeons={dungeons} />}

      <EnterAs charData={charData} cls={me?.cls} onChange={onHeroes} />

      {room.blocked && <p className="sgr-err" role="alert">⛔ Non si può partire: {room.blocked}.</p>}
      {!canRun && (
        <p className="sgr-helper">🤝 {runsOf(charData, me?.cls).totalFull
          ? `Hai già finito ${DAILY_TOTAL} dungeon oggi`
          : `Con ${classInfo(me?.cls)?.it || "questa classe"} hai già fatto ${runsOf(charData, me?.cls).weekCount >= WEEKLY_RUNS ? `i ${WEEKLY_RUNS} dungeon della settimana` : "il dungeon di oggi"}`}: puoi entrare lo stesso <b>come aiuto</b> (giochi per il gruppo, ma niente PE, monete né bottino per te{runsOf(charData, me?.cls).totalFull ? "" : "; con un altro eroe invece prendi i premi"}).</p>
      )}
      <div className="sgr-start">
        <button type="button" className={`sgr-cta${me?.ready ? " is-ready" : ""}`} disabled={busy || (!me?.ready && !heroReady(charData, me?.cls))}
          onClick={() => run(() => setReady(room.id, uid, !me?.ready))}>
          {me?.ready ? "✓ Pronto — annulla" : canRun ? "▶ Avvia" : "▶ Avvia come aiuto"}
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
