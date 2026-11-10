/* LE SEGRETE — story mode della Sala della Gloria (fase 1, 2026-11-04):
   lobby delle stanze. Si crea o si entra in un gruppo (1–4), ognuno sceglie
   l'eroe (permanente, per classe; la domenica non si azzera niente) e preme Avvia:
   Il combattimento (motore sul server + IA dei nemici) arriva nella fase 3. */
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import { isHiddenChar } from "../data/hiddenPlayers";
import { arenaClassKey } from "../data/arenaClassSprites";
import {
  CRAWLER_PUBLIC, MAX_PARTY, companyLines, ROOM_IDLE_MS, DAILY_RUNS, DIFFICULTIES, diffOf, runsOf, clsStyle, STORY_CLASSES, classInfo, storyLevelOf, heroOf, mergeDungeons, roomMember, roomFull, allReady,
} from "../data/segrete";
import {
  createRoom, joinRoom, leaveRoom, kickMember, setMemberClass, setReady, forceStart, reopenRoom, deleteRoom, invitePlayers, chooseDungeon, chooseDifficulty,
} from "../utils/segreteRooms";
import SegreteDungeonInfo from "./SegreteDungeonInfo";
import SegreteBattle from "./SegreteBattle";
const SegreteCrawler = lazy(() => import("./SegreteCrawler"));
import SegreteHero from "./SegreteHero";
import SegreteShop from "./SegreteShop";
import SegreteManual from "./SegreteManual";
import SegreteLog, { coinsToday } from "./SegreteLog";
import { COIN_ICON, COIN_NAME, coinsOf } from "../data/segreteItems";
import { hpPending, armorChosen } from "../data/segreteKits";
import { HeroAccordion, HeroQuickPick, NewClassPicker, HeroNews, heroClasses, heroTodo } from "./SegreteRoster";
// eroe pronto a giocare: creato e con i PF tirati
const heroReady = (charData, cls) => { const h = heroOf(charData, cls); return !!h && hpPending(h) === 0; };
import { SgIcon } from "../components/GameIcon";
import { DIFF_TONE } from "../data/segreteIcons";
import { useSegreteItems } from "../utils/segreteItemsLive";
import "./Segrete.css";

const tsMs = (t) => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : 0);

/* Scheda Personaggi (2026-11-06, rifatta): eroi a fisarmonica (una scheda aperta alla
   volta, sotto la sua riga) + "Crea un eroe" richiudibile con le classi libere. */
function HeroSections({ charData, cls, onUse, disabled, inRoom, focus }) {
  const [open, setOpen] = useState(null);
  // dagli avvisi ("scegli l'armatura"…): apre la scheda di quell'eroe e scorre all'equipaggiamento
  useEffect(() => {
    if (!focus?.cls) return undefined;
    setOpen(focus.cls);
    const t = setTimeout(() => document.getElementById(`sgh-gear-${focus.cls}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
    return () => clearTimeout(t);
  }, [focus]);
  const [newCls, setNewCls] = useState(null);
  const free = STORY_CLASSES.filter((c) => !heroOf(charData, c.key));
  const n = heroClasses(charData).length;
  return (
    <>
      <section className="sgr-block" id="sgr-eroi">
        <h2 className="sgr-h2">🧝 I tuoi eroi <span className="sgr-count">{n}/{STORY_CLASSES.length}</span></h2>
        {!!n && <p className="sgr-hint">Tocca un eroe per aprire la sua scheda. Un eroe per classe, resta tuo per sempre.</p>}
        <HeroAccordion charData={charData} value={cls} open={open} onOpen={setOpen} onUse={onUse} disabled={disabled} inRoom={inRoom}
          renderDetail={(k) => <SegreteHero cls={k} charData={charData} />} />
      </section>
      {!!free.length && (
        <details className="sgr-block sgr-fold" open={!n}>
          <summary className="sgr-h2">✚ Crea un eroe <span className="sgr-count">{free.length} classi libere</span></summary>
          <NewClassPicker charData={charData} value={newCls} onSelect={(k) => setNewCls(newCls === k ? null : k)} disabled={disabled} />
          {newCls && !heroOf(charData, newCls) && (
            <div className="sgr-newhero" style={clsStyle(newCls)}><SegreteHero cls={newCls} charData={charData} /></div>
          )}
        </details>
      )}
    </>
  );
}

function DungeonBadge({ d, diff }) {
  if (!d) return null;
  const D = diff ? diffOf(diff) : null;
  return <span className="sgr-dbadge"><SgIcon kind="dungeon" of={d} /> {d.name}{D && D.rank > 0 ? <em className={`sgr-diffbadge sgr-diffbadge--${D.key}`}><SgIcon kind="diff" of={D} color={DIFF_TONE[D.key]} /> {D.name}</em> : null}</span>;
}

/* Difficoltà (2026-11-06): Facile (di sempre) · Medio (Lv 8+) · Leggenda (Lv 12+). `levels` =
   livelli degli eroi del gruppo: chi non arriva al minimo viene nominato sotto. */
function DifficultyPicker({ value, onPick, disabled, levels = [], readOnly }) {
  const D = diffOf(value);
  const low = levels.filter((l) => l.level < D.minLevel);
  return (
    <div className="sgr-diff">
      <p className="sgr-label">Difficoltà {readOnly ? <small>· la sceglie il capo</small> : null}</p>
      <div className="sgr-dpick" role="radiogroup" aria-label="Difficoltà">
        {DIFFICULTIES.map((d) => (
          <button key={d.key} type="button" role="radio" aria-checked={D.key === d.key} disabled={disabled || (readOnly && D.key !== d.key)}
            className={`sgr-dpick-b sgr-diff-b sgr-diff-b--${d.key}${D.key === d.key ? " is-on" : ""}`}
            onClick={() => !readOnly && D.key !== d.key && onPick(d.key)}>
            <SgIcon kind="diff" of={d} color={DIFF_TONE[d.key]} /> {d.name}{d.minLevel > 1 ? <small> · Lv {d.minLevel}+</small> : null}
          </button>
        ))}
      </div>
      <p className="sgr-hint">{D.desc}</p>
      {!!low.length && <p className="sgr-err">⛔ Per {D.name} serve il livello {D.minLevel}: {low.map((l) => `${l.name} è Lv ${l.level}`).join(", ")}. Il gruppo non potrà partire.</p>}
    </div>
  );
}

const TABS = [
  { key: "gruppi", icon: "⚔", label: "Gruppi" },
  { key: "eroi", icon: "🧝", label: "Personaggi" },
  { key: "bottega", icon: "🏪", label: "Bottega" },
  { key: "zaino", icon: "🎒", label: "Zaino" },
  { key: "storico", icon: "📜", label: "Storico" },
  { key: "manuale", icon: "📖", label: "Manuale" },
];
const TAB_KEY = "sgr_tab";
const readTab = () => { try { const t = localStorage.getItem(TAB_KEY); return TABS.some((x) => x.key === t) ? t : "gruppi"; } catch { return "gruppi"; } };

export default function Segrete() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const master = isMainMaster(currentUser?.email);
  useSegreteItems(); // oggetti creati dal Master: uniti a ITEMS, la pagina si ridisegna quando cambiano

  const [charData, setCharData] = useState(null);
  const [custom, setCustom] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cls, setCls] = useState(null);
  const [type, setType] = useState("segrete");
  const [diff, setDiff] = useState("facile");
  const [name, setName] = useState("");
  const [tab, setTabState] = useState(readTab);
  const [focus, setFocus] = useState(null);
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
    // tutte le stanze (dal 2026-11-06 la domenica non si cancellano più): le vecchie si nascondono sotto
    return onSnapshot(collection(db, "dungeon_rooms"),
      (s) => setRooms(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setErr(e.message));
  }, [uid]);

  // eroe proposto: quello della classe dell'Arena se c'è, sennò il primo eroe creato
  useEffect(() => {
    if (cls || !charData) return;
    const arena = arenaClassKey(charData.arenaLastLoadout?.class) || arenaClassKey(charData.class);
    setCls((arena && heroOf(charData, arena) ? arena : heroClasses(charData)[0]?.key) || arena || STORY_CLASSES[0].key);
  }, [charData, cls]);

  const dungeons = useMemo(() => mergeDungeons(custom), [custom]);
  useEffect(() => {
    if (!dungeons.some((d) => d.key === type)) setType(dungeons[0]?.key || "");
  }, [dungeons, type]);
  const dungeonOf = (key) => dungeons.find((d) => d.key === key) || { key, name: key, icon: "🗝" };
  const myRoom = rooms.find((r) => (r.memberIds || []).includes(uid)) || null;
  const meInRoom = myRoom ? roomMember(myRoom, uid) : null;
  const curCls = meInRoom?.cls || cls;
  const runs = runsOf(charData, curCls);
  const inFight = !!myRoom && (myRoom.status === "running" || myRoom.status === "done");
  const now = Date.now();
  const invitedTo = (r) => (r.invited || []).find((i) => i.uid === uid) || null;
  const fresh = (r, ms) => Date.now() - tsMs(r.updatedAt || r.createdAt) < ms;
  const openRooms = rooms
    .filter((r) => r.status === "open" && dungeons.some((d) => d.key === r.type) && r.id !== myRoom?.id && (fresh(r, 2 * 864e5) || invitedTo(r) || master))
    .sort((a, b) => Number(invitedTo(b)) - Number(invitedTo(a)) || tsMs(b.updatedAt) - tsMs(a.updatedAt));
  const running = rooms.filter((r) => r.status === "running" && r.id !== myRoom?.id && (fresh(r, 6 * 36e5) || master));
  const invites = openRooms.filter(invitedTo).length;
  const todoN = heroClasses(charData).filter((c) => heroTodo(heroOf(charData, c.key), c.key).length).length;

  const run = async (fn) => {
    if (busy) return;
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr(e.message || "Qualcosa è andato storto."); }
    finally { setBusy(false); }
  };
  const level = (k) => storyLevelOf(charData, k);
  // usare un eroe: nel gruppo cambia l'eroe del gruppo, fuori lo prepara per il prossimo (senza cambiare scheda)
  const chooseHero = (k) => {
    if (myRoom && myRoom.status === "open" && meInRoom) {
      if (k !== meInRoom.cls) run(() => setMemberClass(myRoom.id, uid, k, level(k)));
    } else setCls(k);
  };
  // dagli avvisi "eroi da sistemare": va nella scheda Personaggi
  const pickHero = (k) => { chooseHero(k); setTab("eroi"); setFocus({ cls: k, at: Date.now() }); };

  if (!uid) {
    return (
      <section className="sgr-page">
        <header className="sgr-head"><h1 className="sgr-title">Le Segrete</h1></header>
        <p className="sgr-empty">Accedi per formare un gruppo e scendere nei dungeon.</p>
      </section>
    );
  }

  if (inFight) {
    return (
      <section className="sgr-page">
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
      <Link to="/sala-della-gloria" className="sgr-back">← Sala della Gloria</Link>
      <header className="sgr-head">
        <h1 className="sgr-title">Le Segrete</h1>
        <p className="sgr-lead">Dungeon a gruppi da 1 a {MAX_PARTY}. Il tuo eroe cresce vincendo; se il gruppo cade, si perde il bottino.</p>
      </header>

      {/* Dove sei e con chi: sempre visibile */}
      <div className="sgr-status">
        <button type="button" className="sgr-st sgr-st--hero" style={clsStyle(curCls)} onClick={() => setTab("eroi")}>
          <SgIcon kind="cls" of={curCls} fallback={ci?.icon || "?"} size="md" color="var(--cls)" className="sgr-st-ico" />
          <span className="sgr-st-txt"><small>Il tuo eroe</small><b>{ci && curHero ? `${ci.it} · Lv ${level(curCls)}` : "da creare"}</b></span>
        </button>
        <button type="button" className={`sgr-st${myRoom ? " is-live" : ""}`} onClick={() => setTab("gruppi")}>
          <SgIcon kind="ui" of="gruppi" fallback="⚔" size="md" className="sgr-st-ico" />
          <span className="sgr-st-txt"><small>Gruppo</small><b>{myRoom ? `${myRoom.name} · ${readyN}/${myRoom.members.length} pronti` : invites ? `📨 ${invites} invit${invites === 1 ? "o" : "i"}` : "nessuno"}</b></span>
        </button>
        <div className="sgr-st">
          <SgIcon kind="ui" of="key" fallback="🗝" size="md" className="sgr-st-ico" />
          <span className="sgr-st-txt"><small>Dungeon oggi</small><b>{master ? "∞ (Master)" : `${ci?.it || "classe"} ${runs.dayCount}/${DAILY_RUNS}`}</b></span>
        </div>
        <button type="button" className="sgr-st" onClick={() => setTab("zaino")}>
          <SgIcon kind="ui" of="coin" fallback={COIN_ICON} size="md" color="#f2c14e" className="sgr-st-ico" />
          <span className="sgr-st-txt"><small>{COIN_NAME}</small><b>{coinsOf(charData)}{coinsToday(charData) ? <span className="sgr-st-plus"> · +{coinsToday(charData)} oggi</span> : null}</b></span>
        </button>
      </div>

      <div className="sgr-tabs" id="sgr-tabs" role="navigation" aria-label="Sezioni delle Segrete">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`sgr-tab${tab === t.key ? " is-on" : ""}`} aria-current={tab === t.key ? "page" : undefined} onClick={() => setTab(t.key)}>
            <SgIcon kind="ui" of={t.key} fallback={t.icon} className="sgr-tab-ico" />
            <span className="sgr-tab-lbl">{t.label}</span>
            {!!badge[t.key] && <em className="sgr-tab-badge">{badge[t.key]}</em>}
          </button>
        ))}
      </div>

      {err && <p className="sgr-err" role="alert">{err}</p>}

      {tab === "gruppi" && (
        myRoom ? (
          <MyRoom room={myRoom} uid={uid} master={master} charData={charData} busy={busy} run={run}
            dungeon={dungeonOf(myRoom.type)} dungeons={dungeons} canRun={master || runs.canRun} onHeroes={() => setTab("eroi")} onPick={chooseHero} onFix={pickHero} />
        ) : (
          <>
            <HeroNews charData={charData} onSelect={pickHero} />
            {!!openRooms.length && (
              <section className="sgr-block">
                <h2 className="sgr-h2">Entra in un gruppo <span className="sgr-count">{openRooms.length}</span></h2>
                <HeroQuickPick charData={charData} value={cls} onPick={setCls} disabled={busy} onManage={() => setTab("eroi")} />
                <ul className="sgr-rooms">
                  {openRooms.map((r) => {
                    const idle = now - tsMs(r.updatedAt) > ROOM_IDLE_MS;
                    return (
                      <li key={r.id} className={`sgr-room${invitedTo(r) ? " is-invited" : ""}`}>
                        {invitedTo(r) && <p className="sgr-invited">📨 {invitedTo(r).by || "Il gruppo"} ti ha invitato!</p>}
                        <div className="sgr-room-top">
                          <b className="sgr-room-name">{r.name}</b>
                          <DungeonBadge d={dungeonOf(r.type)} diff={r.difficulty} />
                          <span className="sgr-room-n">{r.members.length}/{MAX_PARTY}</span>
                        </div>
                        <ul className="sgr-room-members">
                          {r.members.map((m) => (
                            <li key={m.uid} style={clsStyle(m.cls)}><span className="sgr-clsdot" aria-hidden="true" /><SgIcon kind="cls" of={m.cls} fallback={classInfo(m.cls)?.icon} color="var(--cls)" /> {m.name} <small>· <span className="sgr-clsname">{classInfo(m.cls)?.it}</span> Lv {m.level}{m.uid === r.hostUid ? " · capo" : ""}</small></li>
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

            <details className="sgr-block sgr-fold" open={!openRooms.length}>
              <summary className="sgr-h2">✚ Crea un gruppo</summary>
              <HeroQuickPick charData={charData} value={cls} onPick={setCls} disabled={busy} onManage={() => setTab("eroi")} />
              <p className="sgr-label">Dove scendete</p>
              {!dungeons.length && <p className="sgr-hint">Nessun dungeon attivo. Il Master può attivarli dall’admin delle Segrete.</p>}
              <div className="sgr-dpick" role="radiogroup" aria-label="Dungeon">
                {dungeons.map((d) => (
                  <button key={d.key} type="button" role="radio" aria-checked={type === d.key}
                    className={`sgr-dpick-b${type === d.key ? " is-on" : ""}`} onClick={() => setType(d.key)}>
                    <SgIcon kind="dungeon" of={d} /> {d.name}
                  </button>
                ))}
              </div>
              {(() => { const d = dungeonOf(type); return d.desc ? <p className="sgr-dpick-desc" style={d.backgrounds?.[0] ? { backgroundImage: `linear-gradient(90deg, rgba(10,8,14,.94) 40%, rgba(10,8,14,.55)), url(${d.backgrounds[0]})` } : undefined}>{d.icon} <b>{d.name}</b> · {d.desc}</p> : null; })()}
              <DifficultyPicker value={diff} onPick={setDiff} disabled={busy} levels={cls && heroOf(charData, cls) ? [{ name: classInfo(cls)?.it || "Il tuo eroe", level: level(cls) }] : []} />
              <SegreteDungeonInfo dungeon={dungeonOf(type)} diff={diff} />
              <label className="sgr-label" htmlFor="sgr-name">Nome del gruppo <small>(facoltativo)</small></label>
              <input id="sgr-name" className="sgr-input" value={name} maxLength={40}
                placeholder={`Gruppo di ${charData?.name || "…"}`} onChange={(e) => setName(e.target.value)} />
              <button type="button" className="sgr-cta" disabled={busy || !type || !dungeons.length || !cls || !heroReady(charData, cls)}
                title={heroReady(charData, cls) ? "" : "Crea l'eroe e tira i PF prima"}
                onClick={() => run(() => createRoom(uid, charData, { name, type, cls, level: level(cls), difficulty: diff }))}>
                Crea il gruppo
              </button>
            </details>

            {!!running.length && (
              <details className="sgr-block sgr-fold">
                <summary className="sgr-h2">Nelle Segrete adesso <span className="sgr-count">{running.length}</span></summary>
                <ul className="sgr-rooms">
                  {running.map((r) => (
                    <li key={r.id} className="sgr-room is-running">
                      <div className="sgr-room-top">
                        <b className="sgr-room-name">{r.name}</b>
                        <DungeonBadge d={dungeonOf(r.type)} diff={r.difficulty} />
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
              </details>
            )}
          </>
        )
      )}

      {tab === "eroi" && (
        <>
          <HeroNews charData={charData} onSelect={pickHero} />
          <HeroSections charData={charData} cls={curCls} onUse={chooseHero} disabled={busy} inRoom={!!myRoom} focus={focus} />
        </>
      )}
      {tab === "bottega" && <SegreteShop charData={charData} view="bottega" />}
      {tab === "zaino" && <SegreteShop charData={charData} view="zaino" uid={uid} />}
      {tab === "storico" && <SegreteLog charData={charData} />}
      {tab === "manuale" && <SegreteManual />}
    </section>
  );
}

/* Cambio dungeon (2026-11-06, tolto il voto): solo il capo (o il Master) sceglie, gli altri lo vedono e basta */
function DungeonSwitch({ room, uid, master, busy, run, dungeons }) {
  if (room.hostUid !== uid && !master) return null;
  return (
    <div className="sgr-dswitch">
      <p className="sgr-label">Dungeon <small>· sei il capo: puoi cambiarlo</small></p>
      <div className="sgr-dpick" role="radiogroup" aria-label="Dungeon del gruppo">
        {dungeons.map((d) => (
          <button key={d.key} type="button" role="radio" aria-checked={room.type === d.key} disabled={busy}
            className={`sgr-dpick-b${room.type === d.key ? " is-on" : ""}`}
            onClick={() => room.type !== d.key && run(() => chooseDungeon(room.id, uid, d.key, master))}><SgIcon kind="dungeon" of={d} /> {d.name}</button>
        ))}
      </div>
    </div>
  );
}

const CRAWLER_KEY = "sgr_crawler";
const readCrawler = () => { try { return localStorage.getItem(CRAWLER_KEY) !== "0"; } catch { return true; } };
/* la lotta (2026-11-07): con CRAWLER_PUBLIC tutti vedono quella in prima persona, senza scelta.
   La classica (SegreteBattle) resta nel codice, messa da parte: la può richiamare solo il Master. */
function BattleView({ room, uid, master, onReopen, busy }) {
  const [pref, setPref] = useState(readCrawler);
  const can = master || CRAWLER_PUBLIC;
  const on = can && (master ? pref : true);
  const flip = () => { const v = !pref; setPref(v); try { localStorage.setItem(CRAWLER_KEY, v ? "1" : "0"); } catch { /* niente */ } };
  const reopen = master && <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={onReopen}>↺ Riporta in stanza (Master)</button>;
  if (on) {
    return (
      <Suspense fallback={<div className="sgb-loading"><p>🗝 Le porte delle Segrete si aprono…</p></div>}>
        <SegreteCrawler room={room} uid={uid} tools={master ? <div className="cw-tools"><button type="button" onClick={flip}>🖼 Vista classica (solo Master)</button>{reopen}</div> : null} />
      </Suspense>
    );
  }
  return (
    <>
      <SegreteBattle room={room} uid={uid} />
      {master && (
        <div className="sgr-room-actions">
          {can && <button type="button" className="sgr-btn sgr-btn--ghost" onClick={flip}>🎮 Passa alla prima persona</button>}
          {reopen}
        </div>
      )}
    </>
  );
}

function MyRoom({ room, uid, master, charData, busy, run, dungeon, dungeons = [], canRun, onHeroes, onPick, onFix }) {
  const me = roomMember(room, uid);
  const host = room.hostUid === uid;
  const slots = Array.from({ length: MAX_PARTY }, (_, i) => room.members[i] || null);
  const readyN = room.members.filter((m) => m.ready).length;
  const dungeonActive = dungeons.some((d) => d.key === room.type);

  if (room.status === "running" || room.status === "done") {
    return (
      <BattleView room={room} uid={uid} master={master} busy={busy} onReopen={() => run(() => reopenRoom(room.id))} />
    );
  }

  return (
    <section className="sgr-block sgr-myroom">
      <p className="sgr-kicker">Il tuo gruppo</p>
      <h2 className="sgr-h2">{room.name} <DungeonBadge d={dungeon} diff={room.difficulty} /></h2>
      {dungeon?.desc && <p className="sgr-hint">{dungeon.desc}</p>}
      {room.result && <p className="sgr-hint">Ultimo dungeon: {room.result === "won" ? "🏆 vinto" : "☠ perso"}.</p>}

      <ol className="sgr-slots">
        {slots.map((m, i) => (
          <li key={m?.uid || `vuoto-${i}`} className={`sgr-slot${m ? "" : " is-empty"}${m?.ready ? " is-ready" : ""}`} style={m ? clsStyle(m.cls) : undefined}>
            {m ? (
              <>
                <SgIcon kind="cls" of={m.cls} fallback={classInfo(m.cls)?.icon} frame size="md" color="var(--cls)" className="sgr-slot-ico" />
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

      {!!dungeons.length && <DungeonSwitch room={room} uid={uid} master={master} busy={busy} run={run} dungeons={dungeons} />}
      <DifficultyPicker value={room.difficulty} readOnly={!host && !master} disabled={busy}
        levels={master ? room.members.filter((m) => m.uid !== uid) : room.members}
        onPick={(k) => run(() => chooseDifficulty(room.id, uid, k, master))} />
      <SegreteDungeonInfo dungeon={dungeon} diff={room.difficulty || "facile"} />

      <HeroQuickPick charData={charData} value={me?.cls} onPick={onPick} disabled={busy} onManage={onHeroes} label="Il tuo eroe nel gruppo" />

      {me && heroOf(charData, me.cls) && !armorChosen(me.cls, heroOf(charData, me.cls)) && (
        <button type="button" className="sgr-gear-alert" onClick={() => onFix?.(me.cls)}>⚠ Il tuo {classInfo(me.cls)?.it} non ha ancora scelto l'armatura (ora usa quella di base). <b>Sistemala →</b></button>
      )}
      <p className={`sgr-company${room.members.length > 1 ? " is-on" : ""}`}>
        {room.members.length > 1
          ? <>🤝 <b>Compagnia ×{room.members.length}</b>: {companyLines(room.members.length).join(" · ")}.{room.members.length < MAX_PARTY ? ` In ${room.members.length + 1}: ${companyLines(room.members.length + 1).join(" · ")}.` : ""}</>
          : <>🤝 Da soli niente bonus. <b>In 2</b>: {companyLines(2).join(" · ")} — e cresce fino a {MAX_PARTY}. Invita qualcuno!</>}
      </p>
      {!dungeonActive && <p className="sgr-err">Questo dungeon è disattivato. Il capo deve sceglierne uno attivo per partire.</p>}
      {room.blocked && <p className="sgr-err" role="alert">⛔ Non si può partire: {room.blocked}.</p>}
      {!canRun && (
        <p className="sgr-helper">🤝 Con {classInfo(me?.cls)?.it || "questa classe"} hai già fatto i {DAILY_RUNS} dungeon di oggi: puoi entrare lo stesso <b>come aiuto</b> (giochi per il gruppo, ma niente PE, monete né bottino per te; con un altro eroe invece prendi i premi).</p>
      )}
      <div className="sgr-start">
        <button type="button" className={`sgr-cta${me?.ready ? " is-ready" : ""}`} disabled={busy || (!me?.ready && (!dungeonActive || !heroReady(charData, me?.cls)))}
          onClick={() => run(() => setReady(room.id, uid, !me?.ready))}>
          {me?.ready ? "✓ Pronto — annulla" : canRun ? "▶ Avvia" : "▶ Avvia come aiuto"}
        </button>
        <span className="sgr-start-n">{readyN}/{room.members.length} pronti{allReady(room) ? "" : room.members.length > 1 ? " · si parte quando premono tutti" : ""}</span>
      </div>

      {room.members.length < MAX_PARTY && <InvitePanel room={room} uid={uid} myName={me?.name || charData?.name} busy={busy} run={run} />}

      <div className="sgr-room-actions">
        <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => run(() => leaveRoom(room.id, uid))}>Esci dal gruppo</button>
        {master && <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy || !dungeonActive} onClick={() => run(() => forceStart(room.id))}>▶ Avvia comunque (Master)</button>}
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
