import SegreteIdentity from "../components/SegreteIdentity";
import SegreteXp from "../components/SegreteXp";
import { RACES, hasRace } from "../data/segreteRaces";
/* LE SEGRETE — story mode della Sala della Gloria (fase 1, 2026-11-04):
   lobby delle stanze. Si crea o si entra in un gruppo (1–4), ognuno sceglie
   l'eroe (permanente, per classe; la domenica non si azzera niente) e preme Avvia:
   Il combattimento (motore sul server + IA dei nemici) arriva nella fase 3. */
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { collection, doc, getDocs, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import { isHiddenChar } from "../data/hiddenPlayers";
import { arenaClassKey } from "../data/arenaClassSprites";
import {
  MAX_PARTY, companyLines, ROOM_IDLE_MS, DAILY_RUNS, DIFFICULTIES, diffOf, runsOf, clsStyle, STORY_CLASSES, classInfo, storyLevelOf, heroOf, mergeDungeons, roomMember, roomFull, allReady,
  TOWER_KEY, TOWER_WEEKLY_FREE, isTowerDungeon, towerStatusOf,
} from "../data/segrete";
import { currentWeekKey } from "../data/arenaWeek";
import {
  createRoom, joinRoom, leaveRoom, kickMember, addFakeNpc, removeFakeNpc, setMemberClass, setReady, forceStart, reopenRoom, deleteRoom, invitePlayers, chooseDungeon, chooseDifficulty,
} from "../utils/segreteRooms";
import SegreteDungeonInfo from "./SegreteDungeonInfo";
import { dungeonProfile } from "../data/segreteProfiles";
const SegreteCrawler = lazy(() => import("./SegreteCrawler"));
import SegreteHero from "./SegreteHero";
import SegreteShop from "./SegreteShop";
import SegreteManual from "./SegreteManual";
import SegreteLog, { coinsToday } from "./SegreteLog";
import { COIN_ICON, COIN_NAME, coinsOf, TOWER_REWARD_TIERS, TOWER_GEAR_IDS, itemOf } from "../data/segreteItems";
import { hpPending, armorChosen } from "../data/segreteKits";
import { heroIdentity, subclassName } from "../utils/segreteIdentity";
import { HeroAccordion, HeroQuickPick, NewClassPicker, HeroNews, heroClasses, heroTodo } from "./SegreteRoster";
// eroe pronto a giocare: creato e con i PF tirati
const heroReady = (charData, cls) => { const h = heroOf(charData, cls); return !!h && hasRace(h) && hpPending(h) === 0; };
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
  if (d.isTower || isTowerDungeon(d.key)) {
    return <span className="sgr-dbadge"><SgIcon kind="dungeon" of={d} /> {d.name} <em className="sgr-diffbadge sgr-diffbadge--leggenda">100 Piani</em></span>;
  }
  const D = diff ? diffOf(diff) : null;
  return <span className="sgr-dbadge"><SgIcon kind="dungeon" of={d} /> {d.name}{D && D.rank > 0 ? <em className={`sgr-diffbadge sgr-diffbadge--${D.key}`}><SgIcon kind="diff" of={D} color={DIFF_TONE[D.key]} /> {D.name}</em> : null}</span>;
}

function TowerInfoBox({ charData, isHost = true, master = false }) {
  const ts = towerStatusOf(charData);
  const curTier = ts.floor > 0 ? TOWER_REWARD_TIERS.find((t) => ts.floor >= t.min && ts.floor <= t.max) : null;
  return (
    <div className="sgr-diff" style={{ border: "1px solid rgba(196, 132, 252, .35)", background: "rgba(38, 22, 58, .35)", borderRadius: 10, padding: "10px 12px", margin: "8px 0" }}>
      <p className="sgr-label" style={{ color: "#e9d5ff", marginBottom: 4 }}>
        🗼 <b>La Torre di Vethrik</b> · 100 Piani Mutevoli <small>(Guardiano ogni 5 piani)</small>
      </p>
      <p className="sgr-hint" style={{ margin: "4px 0" }}>
        Ogni piano si auto-genera con stanze, regole ambientali e nemici sempre diversi, diventando sempre più impegnativo dal Piano 1 al Piano 100. Ogni piano superato conferisce subito <b>PE</b> al tuo eroe; i <b>premi unici di Vethrik</b> vengono consegnati ogni <b>domenica alle 23:00</b> in base al piano registrato!
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", fontSize: ".88rem", margin: "8px 0", padding: "6px 10px", background: "rgba(0,0,0,.28)", borderRadius: 8 }}>
        <span>📍 <b>Piano registrato (questa settimana):</b> <b style={{ color: ts.floor > 0 ? "#ffd56a" : "#aaa" }}>{ts.floor > 0 ? `Piano ${ts.floor}/100` : "Nessuno (0/100)"}</b></span>
        <span>🏆 <b>Record assoluto:</b> Piano {ts.allTimeBest}/100</span>
        <span>🗝 <b>Sigilli settimanali gratuiti:</b> {master ? "∞" : `${ts.freeLeft}/${TOWER_WEEKLY_FREE}`}</span>
        <span>🎒 <b>Sigilli nello zaino:</b> {ts.bagKeys}</span>
      </div>
      {curTier && (
        <p className="sgr-hint" style={{ color: "#ffd56a", margin: "4px 0" }}>
          🎁 <b>Premio garantito domenica ore 23:00 ({curTier.name}, Piano {ts.floor}):</b> {COIN_ICON} {curTier.coinsBase + ts.floor * curTier.coinsPerFloor} {COIN_NAME} · {curTier.desc}
        </p>
      )}
      {ts.floor > 0 && (
        <p className="sgr-err" style={{ background: "rgba(245, 158, 11, .14)", borderColor: "rgba(245, 158, 11, .45)", color: "#fde68a", margin: "6px 0" }}>
          ⚠ <b>Attenzione (Regola del Rischio):</b> hai già registrato il <b>Piano {ts.floor}/100</b> questa settimana! Se avvii una nuova scalata ripartirai dal Piano 1 e <b>il nuovo risultato sostituirà il Piano {ts.floor}</b> (anche se dovessi fermarti a un piano più basso). Se vuoi conservare il Piano {ts.floor} per i premi di domenica alle 23:00, non avviare una nuova scalata!
        </p>
      )}
      {isHost && !master && !ts.canOpen && (
        <p className="sgr-err" style={{ margin: "6px 0" }}>
          ⛔ Hai terminato i 3 Sigilli gratuiti della settimana e non hai <b>Sigilli della Torre di Vethrik</b> nello zaino (acquistabili in Bottega o droppabili nei dungeon a Medio e Leggenda).
        </p>
      )}
      <p className="sgr-hint" style={{ fontSize: ".8rem", margin: "4px 0" }}>
        💡 <b>In gruppo (1–4 eroi):</b> solo il <b>Capo del gruppo</b> consuma 1 Sigillo della Torre per aprire il portale a tutta la compagnia.
      </p>
      {ts.lastReward?.floor > 0 && (
        <p className="sgr-hint" style={{ color: "#a7f3d0", fontSize: ".82rem", margin: "4px 0" }}>
          ✨ <b>Ultimo premio domenicale ricevuto (Piano {ts.lastReward.floor} · {ts.lastReward.tierName}):</b> +{ts.lastReward.coins} {COIN_NAME}{ts.lastReward.itemNames?.length ? ` · ${ts.lastReward.itemNames.join(", ")}` : ""}
        </p>
      )}
      <details style={{ marginTop: 6, fontSize: ".83rem" }}>
        <summary style={{ cursor: "pointer", color: "#d8b4fe", fontWeight: 600 }}>📜 Tabella Premi Unici della Torre (Domenica ore 23:00)</summary>
        <ul style={{ margin: "6px 0 4px", paddingLeft: 18, lineHeight: 1.5 }}>
          {TOWER_REWARD_TIERS.map((t) => (
            <li key={t.min} style={{ color: ts.floor >= t.min && ts.floor <= t.max ? "#ffd56a" : undefined }}>
              <b>Piani {t.min === t.max ? t.min : `${t.min}–${t.max}`} ({t.name}):</b> {COIN_ICON} {t.coinsBase + t.min * t.coinsPerFloor}–{t.coinsBase + t.max * t.coinsPerFloor} {COIN_NAME} + {t.desc}
            </li>
          ))}
        </ul>
        <p style={{ margin: "4px 0 0", opacity: 0.88 }}>
          🗡 <b>Reliquie Uniche di Vethrik (+2, mai in Bottega né nei dungeon normali):</b> {TOWER_GEAR_IDS.map((id) => itemOf(id)?.name).filter(Boolean).join(" · ")}.
        </p>
      </details>
    </div>
  );
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

const SEGRETE_TABS = [
  { key: "gruppi", icon: "⚔", label: "Gruppi" },
  { key: "eroi", icon: "🧝", label: "Personaggi" },
  { key: "bottega", icon: "🏪", label: "Bottega" },
  { key: "zaino", icon: "🎒", label: "Zaino" },
  { key: "storico", icon: "📜", label: "Storico" },
  { key: "manuale", icon: "📖", label: "Manuale" },
];
const TORRE_TABS = [
  { key: "torre", icon: "🗼", label: "Scalata" },
  { key: "premi", icon: "🎁", label: "Premi & Reliquie" },
  { key: "eroi", icon: "🧝", label: "Personaggi" },
  { key: "zaino", icon: "🎒", label: "Zaino" },
  { key: "bottega", icon: "🏪", label: "Bottega" },
  { key: "storico", icon: "📜", label: "Storico Torre" },
];
const readTab = (isTowerMode, initialTab) => {
  const tabs = isTowerMode ? TORRE_TABS : SEGRETE_TABS;
  const def = isTowerMode ? "torre" : "gruppi";
  const storageKey = isTowerMode ? "torre_vethrik_tab" : "sgr_tab";
  if (initialTab && tabs.some((x) => x.key === initialTab)) return initialTab;
  try {
    const t = localStorage.getItem(storageKey);
    return tabs.some((x) => x.key === t) ? t : def;
  } catch {
    return def;
  }
};

function TowerRewardsPanel({ charData }) {
  const ts = towerStatusOf(charData);
  const curTier = ts.floor > 0 ? TOWER_REWARD_TIERS.find((t) => ts.floor >= t.min && ts.floor <= t.max) : null;
  return (
    <>
      <section className="sgr-block">
        <h2 className="sgr-h2">🎁 Premi Settimanali della Torre (Domenica ore 23:00)</h2>
        <p className="sgr-hint">
          Ogni domenica alle <b>23:00</b> la Torre di Vethrik si resetta al Piano 0, rigenera i 3 Sigilli settimanali gratuiti e consegna automaticamente nello zaino delle Segrete i premi del <b>piano registrato</b> durante la settimana.
        </p>
        {curTier ? (
          <div style={{ margin: "10px 0", padding: "10px 14px", borderRadius: 10, background: "rgba(255, 213, 106, .1)", border: "1px solid rgba(255, 213, 106, .35)" }}>
            <b style={{ color: "#ffd56a" }}>📍 Il tuo premio garantito attuale (Piano {ts.floor}/100 · {curTier.name}):</b>
            <p className="sgr-hint" style={{ margin: "4px 0 0", color: "#fff3c4" }}>
              {COIN_ICON} <b>{curTier.coinsBase + ts.floor * curTier.coinsPerFloor} {COIN_NAME}</b> + {curTier.desc}
            </p>
          </div>
        ) : (
          <p className="sgr-hint" style={{ color: "#cbd5e1" }}>
            Non hai ancora registrato un piano questa settimana (0/100). Supera almeno il Piano 1 per assicurarti i premi di domenica alle 23:00!
          </p>
        )}
        <ul className="sgr-rooms" style={{ marginTop: 10 }}>
          {TOWER_REWARD_TIERS.map((t) => {
            const active = ts.floor >= t.min && ts.floor <= t.max;
            return (
              <li key={t.min} className="sgr-room" style={active ? { borderColor: "rgba(255, 213, 106, .6)", background: "rgba(255, 213, 106, .08)" } : undefined}>
                <div className="sgr-room-top">
                  <b className="sgr-room-name" style={active ? { color: "#ffd56a" } : undefined}>
                    🗼 Piani {t.min === t.max ? t.min : `${t.min}–${t.max}`} · {t.name}
                  </b>
                  {active && <span className="sgr-tag">Il tuo grado attuale</span>}
                </div>
                <p className="sgr-hint" style={{ margin: "4px 0 0" }}>
                  {COIN_ICON} <b>{t.coinsBase + t.min * t.coinsPerFloor}–{t.coinsBase + t.max * t.coinsPerFloor} {COIN_NAME}</b> · {t.desc}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="sgr-block">
        <h2 className="sgr-h2">🗡 Reliquie Uniche di Vethrik (+2)</h2>
        <p className="sgr-hint">
          Questi equipaggiamenti leggendari ed essenze arcane si ottengono <b>esclusivamente</b> dai premi domenicali della Torre di Vethrik (dal Piano 25 in su) e non compaiono mai in Bottega né nei dungeon normali. Si equipaggiano sui tuoi eroi delle Segrete!
        </p>
        <ul className="sgr-rooms" style={{ marginTop: 10 }}>
          {["essenza_vethrik", "lacrima_vethrik", ...TOWER_GEAR_IDS].map((id) => {
            const it = itemOf(id);
            if (!it) return null;
            return (
              <li key={id} className="sgr-room">
                <div className="sgr-room-top">
                  <b className="sgr-room-name"><SgIcon kind="item" of={it} fallback={it.icon} /> {it.name}</b>
                  <span className="sgr-room-n">{it.kind === "weapon" ? "Arma +2" : it.kind === "armor" ? "Armatura +2" : it.kind === "shield" ? "Scudo +2" : "Consumabile Unico"}</span>
                </div>
                <p className="sgr-hint" style={{ margin: "4px 0 0" }}>{it.desc}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

export default function Segrete({ mode = "segrete", initialTab = null }) {
  const location = useLocation();
  const isTowerPage = mode === "torre" || location.pathname === "/torre-di-vethrik";
  const activeTabs = isTowerPage ? TORRE_TABS : SEGRETE_TABS;
  const storageKey = isTowerPage ? "torre_vethrik_tab" : "sgr_tab";
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
  const [tab, setTabState] = useState(() => readTab(isTowerPage, initialTab));
  const [focus, setFocus] = useState(null);
  const setTab = (t) => {
    setTabState(t);
    try { localStorage.setItem(storageKey, t); } catch { /* niente */ }
  };

  useEffect(() => {
    if (!activeTabs.some((x) => x.key === tab)) {
      setTabState(isTowerPage ? "torre" : "gruppi");
    }
  }, [isTowerPage, activeTabs, tab]);

  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(doc(db, "characters", uid), (s) => setCharData(s.exists() ? s.data() : null), () => {});
  }, [uid]);
  // Se la settimana precedente della Torre di Vethrik ha un piano registrato non ancora riscattato, riscattalo automaticamente.
  useEffect(() => {
    const st = charData?.storyTower;
    const wk = currentWeekKey();
    if (!uid || !st || !st.weekKey || st.weekKey === wk || st.rewardedWeek === st.weekKey || !(Number(st.floor) > 0)) return;
    httpsCallable(functions, "segreteDo")({ op: "towerClaimWeekly" }).catch(() => {});
  }, [uid, charData?.storyTower?.weekKey, charData?.storyTower?.floor, charData?.storyTower?.rewardedWeek]);
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
  const normalDungeons = useMemo(() => dungeons.filter((d) => !isTowerDungeon(d.key)), [dungeons]);
  useEffect(() => {
    if (!normalDungeons.some((d) => d.key === type)) setType(normalDungeons[0]?.key || "");
  }, [normalDungeons, type]);
  const dungeonOf = (key) => dungeons.find((d) => d.key === key) || { key, name: key, icon: "🗝" };
  const allMyRoom = rooms.find((r) => (r.memberIds || []).includes(uid)) || null;
  const myRoom = allMyRoom && (isTowerPage ? isTowerDungeon(allMyRoom.type) : !isTowerDungeon(allMyRoom.type)) ? allMyRoom : null;
  const otherSectionRoom = allMyRoom && !myRoom ? allMyRoom : null;
  const meInRoom = myRoom ? roomMember(myRoom, uid) : null;
  // Refresh existing groups when a hero gains levels or changes active subclass.
  useEffect(() => {
    if (!charData || !meInRoom || myRoom.status !== "open") return;
    const h = heroOf(charData, meInRoom.cls);
    if (!h) return;
    const name = subclassName(meInRoom.cls, h);
    const lv = storyLevelOf(charData, meInRoom.cls);
    if ((meInRoom.subName || "") === name && meInRoom.subclass !== undefined && meInRoom.level === lv) return;
    setMemberClass(myRoom.id, uid, meInRoom.cls, lv, charData).catch((e) => setErr(e.message));
  }, [charData, myRoom, meInRoom, uid]);
  const curCls = meInRoom?.cls || cls;
  const runs = runsOf(charData, curCls);
  const inFight = !!myRoom && (myRoom.status === "running" || myRoom.status === "done");
  const now = Date.now();
  const invitedTo = (r) => (r.invited || []).find((i) => i.uid === uid) || null;
  const fresh = (r, ms) => Date.now() - tsMs(r.updatedAt || r.createdAt) < ms;
  const openRooms = rooms
    .filter((r) => r.status === "open" && dungeons.some((d) => d.key === r.type) && r.id !== myRoom?.id && (fresh(r, 2 * 864e5) || invitedTo(r) || master))
    .sort((a, b) => Number(invitedTo(b)) - Number(invitedTo(a)) || tsMs(b.updatedAt) - tsMs(a.updatedAt));
  const openNormalRooms = openRooms.filter((r) => !isTowerDungeon(r.type));
  const openTowerRooms = openRooms.filter((r) => isTowerDungeon(r.type));
  const running = rooms.filter((r) => r.status === "running" && r.id !== myRoom?.id && (fresh(r, 6 * 36e5) || master));
  const runningNormalRooms = running.filter((r) => !isTowerDungeon(r.type));
  const runningTowerRooms = running.filter((r) => isTowerDungeon(r.type));
  const normalInvites = openNormalRooms.filter(invitedTo).length;
  const towerInvites = openTowerRooms.filter(invitedTo).length;
  const sectionInvites = isTowerPage ? towerInvites : normalInvites;
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
      if (k !== meInRoom.cls) run(() => setMemberClass(myRoom.id, uid, k, level(k), charData));
    } else setCls(k);
  };
  // dagli avvisi "eroi da sistemare": va nella scheda Personaggi
  const pickHero = (k) => { chooseHero(k); setTab("eroi"); setFocus({ cls: k, at: Date.now() }); };

  if (!uid) {
    return (
      <section className="sgr-page">
        <header className="sgr-head"><h1 className="sgr-title">{isTowerPage ? "🗼 La Torre di Vethrik" : "Le Segrete"}</h1></header>
        <p className="sgr-empty">Accedi per formare un gruppo e affrontare {isTowerPage ? "la Torre di Vethrik" : "i dungeon"}.</p>
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
  const badge = {
    gruppi: normalInvites || (myRoom ? "●" : 0),
    torre: towerInvites || (myRoom ? "●" : 0),
    eroi: todoN,
  };
  const tsStatus = towerStatusOf(charData);

  return (
    <section className="sgr-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Link to="/sala-della-gloria" className="sgr-back">← Sala della Gloria</Link>
        <Link to={isTowerPage ? "/segrete" : "/torre-di-vethrik"} className="sgr-back">
          {isTowerPage ? "🗝 Vai alle Segrete →" : "🗼 Vai alla Torre di Vethrik →"}
        </Link>
      </div>
      <header className="sgr-head">
        <h1 className="sgr-title">{isTowerPage ? "🗼 La Torre di Vethrik" : "Le Segrete"}</h1>
        <p className="sgr-lead">
          {isTowerPage
            ? `100 piani mutevoli per gruppi da 1 a ${MAX_PARTY}, collegati ai tuoi eroi e al tuo zaino delle Segrete. Ogni piano dà PE subito e la domenica alle 23:00 assegna i Premi Unici.`
            : `Dungeon a gruppi da 1 a ${MAX_PARTY}. Il tuo eroe cresce vincendo; se il gruppo cade, si perde il bottino.`}
        </p>
      </header>

      {otherSectionRoom && (
        <div className="sgh-pending" role="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span>
            {isTowerPage
              ? <>Sei attualmente nel gruppo <b>«{otherSectionRoom.name}»</b> nelle Segrete.</>
              : <>Sei attualmente nella scalata <b>«{otherSectionRoom.name}»</b> nella Torre di Vethrik.</>}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <Link to={isTowerPage ? "/segrete" : "/torre-di-vethrik"} className="sgr-btn">
              {isTowerPage ? "🗝 Apri nelle Segrete" : "🗼 Apri nella Torre"}
            </Link>
            {otherSectionRoom.status === "open" && (
              <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => run(() => leaveRoom(otherSectionRoom.id, uid))}>
                Esci da quel gruppo
              </button>
            )}
          </span>
        </div>
      )}

      {curHero && !hasRace(curHero) && <div className="sgh-pending" role="alert">Scegli la razza del tuo eroe prima di giocare. <button type="button" className="sgr-btn" onClick={() => pickHero(curCls)}>Scegli razza</button></div>}
      {/* Dove sei e con chi: sempre visibile */}
      <div className="sgr-status">
        <button type="button" className="sgr-st sgr-st--hero" style={clsStyle(curCls)} onClick={() => setTab("eroi")}>
          <SgIcon kind="cls" of={curCls} fallback={ci?.icon || "?"} size="md" color="var(--cls)" className="sgr-st-ico" />
          <span className="sgr-st-txt"><small>Il tuo eroe</small><b>{ci && curHero ? <><SegreteIdentity cls={curCls} hero={curHero} /> · Lv {level(curCls)}</> : "da creare"}</b>{curHero && <SegreteXp hero={curHero} />}</span>
        </button>
        <button type="button" className={`sgr-st${myRoom ? " is-live" : ""}`} onClick={() => setTab(isTowerPage ? "torre" : "gruppi")}>
          <SgIcon kind="ui" of={isTowerPage ? "torre" : "gruppi"} fallback={isTowerPage ? "🗼" : "⚔"} size="md" className="sgr-st-ico" />
          <span className="sgr-st-txt"><small>{isTowerPage ? "Scalata" : "Gruppo"}</small><b>{myRoom ? `${myRoom.name} · ${readyN}/${myRoom.members.length} pronti` : sectionInvites ? `📨 ${sectionInvites} invit${sectionInvites === 1 ? "o" : "i"}` : "nessuno"}</b></span>
        </button>
        {isTowerPage ? (
          <button type="button" className="sgr-st" onClick={() => setTab("premi")}>
            <SgIcon kind="ui" of="torre" fallback="🗼" size="md" className="sgr-st-ico" />
            <span className="sgr-st-txt"><small>Piano & Sigilli</small><b>{tsStatus.floor > 0 ? `Piano ${tsStatus.floor}/100` : "0/100"} · 🗝 {master ? "∞" : `${tsStatus.freeLeft}/${TOWER_WEEKLY_FREE}`}{tsStatus.bagKeys ? `+${tsStatus.bagKeys}` : ""}</b></span>
          </button>
        ) : (
          <div className="sgr-st">
            <SgIcon kind="ui" of="key" fallback="🗝" size="md" className="sgr-st-ico" />
            <span className="sgr-st-txt"><small>Dungeon oggi</small><b>{master ? "∞ (Master)" : `${ci?.it || "classe"} ${runs.dayCount}/${DAILY_RUNS}`}</b></span>
          </div>
        )}
        <button type="button" className="sgr-st" onClick={() => setTab("zaino")}>
          <SgIcon kind="ui" of="coin" fallback={COIN_ICON} size="md" color="#f2c14e" className="sgr-st-ico" />
          <span className="sgr-st-txt"><small>{COIN_NAME}</small><b>{coinsOf(charData)}{coinsToday(charData) ? <span className="sgr-st-plus"> · +{coinsToday(charData)} oggi</span> : null}</b></span>
        </button>
      </div>

      <div className="sgr-tabs" id="sgr-tabs" role="navigation" aria-label={isTowerPage ? "Sezioni della Torre di Vethrik" : "Sezioni delle Segrete"}>
        {activeTabs.map((t) => (
          <button key={t.key} type="button" className={`sgr-tab${tab === t.key ? " is-on" : ""}`} aria-current={tab === t.key ? "page" : undefined} onClick={() => setTab(t.key)}>
            <SgIcon kind="ui" of={t.key} fallback={t.icon} className="sgr-tab-ico" />
            <span className="sgr-tab-lbl">{t.label}</span>
            {!!badge[t.key] && <em className="sgr-tab-badge">{badge[t.key]}</em>}
          </button>
        ))}
      </div>

      {err && <p className="sgr-err" role="alert">{err}</p>}

      {!isTowerPage && tab === "gruppi" && (
        myRoom ? (
          <MyRoom room={myRoom} uid={uid} master={master} charData={charData} busy={busy} run={run}
            dungeon={dungeonOf(myRoom.type)} dungeons={normalDungeons} canRun={master || runs.canRun} onHeroes={() => setTab("eroi")} onPick={chooseHero} onFix={pickHero} />
        ) : (
          <>
            <HeroNews charData={charData} onSelect={pickHero} />
            {!!openNormalRooms.length && (
              <section className="sgr-block">
                <h2 className="sgr-h2">Entra in un gruppo <span className="sgr-count">{openNormalRooms.length}</span></h2>
                <HeroQuickPick charData={charData} value={cls} onPick={setCls} disabled={busy} onManage={() => setTab("eroi")} />
                <ul className="sgr-rooms">
                  {openNormalRooms.map((r) => {
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
                            <li key={m.uid} style={clsStyle(m.cls)}><span className="sgr-clsdot" aria-hidden="true" /><SgIcon kind="cls" of={m.cls} fallback={classInfo(m.cls)?.icon} color="var(--cls)" /> {m.name} <small>· <span className="sgr-clsname"><SegreteIdentity cls={m.cls} hero={m} /></span> Lv {m.level}{m.uid === r.hostUid ? " · capo" : ""}</small></li>
                          ))}
                        </ul>
                        <div className="sgr-room-actions">
                          <button type="button" className="sgr-btn" disabled={busy || !!otherSectionRoom || roomFull(r) || !cls || !heroReady(charData, cls)}
                            onClick={() => run(() => joinRoom(r.id, uid, charData, cls, level(cls)))}>
                            {otherSectionRoom ? "Esci prima dal gruppo della Torre" : roomFull(r) ? "Pieno" : !heroOf(charData, cls) ? "Crea prima l'eroe" : !hasRace(heroOf(charData, cls)) ? "Scegli prima la razza" : !heroReady(charData, cls) ? "Tira prima i PF" : <>Entra come <SegreteIdentity cls={cls} hero={heroOf(charData, cls)} /> Lv {level(cls)}</>}
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

            <details className="sgr-block sgr-fold" open={!openNormalRooms.length}>
              <summary className="sgr-h2">✚ Crea un gruppo</summary>
              <HeroQuickPick charData={charData} value={cls} onPick={setCls} disabled={busy} onManage={() => setTab("eroi")} />
              <p className="sgr-label">Dove scendete</p>
              {!normalDungeons.length && <p className="sgr-hint">Nessun dungeon attivo. Il Master può attivarli dall’admin delle Segrete.</p>}
              <div className="sgr-dpick" role="radiogroup" aria-label="Dungeon">
                {normalDungeons.map((d) => (
                  <button key={d.key} type="button" role="radio" aria-checked={type === d.key}
                    className={`sgr-dpick-b${type === d.key ? " is-on" : ""}`} onClick={() => setType(d.key)}>
                    <SgIcon kind="dungeon" of={d} /> {d.name}
                  </button>
                ))}
              </div>
              {(() => { const d = dungeonOf(type), p = dungeonProfile(d); return <>
                {d.desc && <p className="sgr-dpick-desc">{d.icon} <b>{d.name}</b> · {d.desc}</p>}
                <p className="sgr-dpick-desc"><b>{p.name}</b> · PE ×{p.xp} · Monete Antiche ×{p.coins}. {p.desc}</p>
              </>; })()}
              <DifficultyPicker value={diff} onPick={setDiff} disabled={busy} levels={cls && heroOf(charData, cls) ? [{ name: heroIdentity(cls, heroOf(charData, cls)), level: level(cls) }] : []} />
              <SegreteDungeonInfo dungeon={dungeonOf(type)} diff={diff} />
              <label className="sgr-label" htmlFor="sgr-name">Nome del gruppo <small>(facoltativo)</small></label>
              <input id="sgr-name" className="sgr-input" value={name} maxLength={40}
                placeholder={`Gruppo di ${charData?.name || "…"}`} onChange={(e) => setName(e.target.value)} />
              <button type="button" className="sgr-cta" disabled={busy || !!otherSectionRoom || !type || !normalDungeons.length || !cls || !heroReady(charData, cls)}
                title={heroReady(charData, cls) ? "" : "Crea l'eroe e tira i PF prima"}
                onClick={() => run(() => createRoom(uid, charData, { name, type, cls, level: level(cls), difficulty: diff }))}>
                {otherSectionRoom ? "Esci prima dal gruppo della Torre" : "Crea il gruppo"}
              </button>
            </details>

            {!!runningNormalRooms.length && (
              <details className="sgr-block sgr-fold">
                <summary className="sgr-h2">Nelle Segrete adesso <span className="sgr-count">{runningNormalRooms.length}</span></summary>
                <ul className="sgr-rooms">
                  {runningNormalRooms.map((r) => (
                    <li key={r.id} className="sgr-room is-running">
                      <div className="sgr-room-top">
                        <b className="sgr-room-name">{r.name}</b>
                        <DungeonBadge d={dungeonOf(r.type)} diff={r.difficulty} />
                      </div>
                      <p className="sgr-room-line">{r.members.map((m, i) => <span key={m.uid}>{i > 0 && " · "}{m.name} (<SegreteIdentity cls={m.cls} hero={m} />)</span>)}</p>
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

      {isTowerPage && tab === "torre" && (
        myRoom ? (
          <MyRoom room={myRoom} uid={uid} master={master} charData={charData} busy={busy} run={run}
            dungeon={dungeonOf(myRoom.type)} dungeons={[]} canRun={master || runs.canRun} onHeroes={() => setTab("eroi")} onPick={chooseHero} onFix={pickHero} />
        ) : (
          <>
            <HeroNews charData={charData} onSelect={pickHero} />
            <section className="sgr-block">
              <TowerInfoBox charData={charData} isHost master={master} />
            </section>

            {!!openTowerRooms.length && (
              <section className="sgr-block">
                <h2 className="sgr-h2">🗼 Entra in una scalata della Torre <span className="sgr-count">{openTowerRooms.length}</span></h2>
                <HeroQuickPick charData={charData} value={cls} onPick={setCls} disabled={busy} onManage={() => setTab("eroi")} />
                <ul className="sgr-rooms">
                  {openTowerRooms.map((r) => {
                    const idle = now - tsMs(r.updatedAt) > ROOM_IDLE_MS;
                    return (
                      <li key={r.id} className={`sgr-room${invitedTo(r) ? " is-invited" : ""}`}>
                        {invitedTo(r) && <p className="sgr-invited">📨 {invitedTo(r).by || "Il gruppo"} ti ha invitato nella Torre!</p>}
                        <div className="sgr-room-top">
                          <b className="sgr-room-name">{r.name}</b>
                          <DungeonBadge d={dungeonOf(r.type)} diff={r.difficulty} />
                          <span className="sgr-room-n">{r.members.length}/{MAX_PARTY}</span>
                        </div>
                        <ul className="sgr-room-members">
                          {r.members.map((m) => (
                            <li key={m.uid} style={clsStyle(m.cls)}><span className="sgr-clsdot" aria-hidden="true" /><SgIcon kind="cls" of={m.cls} fallback={classInfo(m.cls)?.icon} color="var(--cls)" /> {m.name} <small>· <span className="sgr-clsname"><SegreteIdentity cls={m.cls} hero={m} /></span> Lv {m.level}{m.uid === r.hostUid ? " · capo" : ""}</small></li>
                          ))}
                        </ul>
                        <div className="sgr-room-actions">
                          <button type="button" className="sgr-btn" disabled={busy || !!otherSectionRoom || roomFull(r) || !cls || !heroReady(charData, cls)}
                            onClick={() => run(() => joinRoom(r.id, uid, charData, cls, level(cls)))}>
                            {otherSectionRoom ? "Esci prima dal gruppo delle Segrete" : roomFull(r) ? "Pieno" : !heroOf(charData, cls) ? "Crea prima l'eroe" : !hasRace(heroOf(charData, cls)) ? "Scegli prima la razza" : !heroReady(charData, cls) ? "Tira prima i PF" : <>Entra come <SegreteIdentity cls={cls} hero={heroOf(charData, cls)} /> Lv {level(cls)}</>}
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

            <details className="sgr-block sgr-fold" open={!openTowerRooms.length}>
              <summary className="sgr-h2">🗼 Crea un gruppo per la Torre di Vethrik</summary>
              <HeroQuickPick charData={charData} value={cls} onPick={setCls} disabled={busy} onManage={() => setTab("eroi")} />
              <label className="sgr-label" htmlFor="sgr-tower-name">Nome della spedizione <small>(facoltativo)</small></label>
              <input id="sgr-tower-name" className="sgr-input" value={name} maxLength={40}
                placeholder={`Scalata di ${charData?.name || "…"}`} onChange={(e) => setName(e.target.value)} />
              <button type="button" className="sgr-cta" disabled={busy || !!otherSectionRoom || !cls || !heroReady(charData, cls) || (!master && !tsStatus.canOpen)}
                title={heroReady(charData, cls) ? "" : "Crea l'eroe e tira i PF prima"}
                onClick={() => run(() => createRoom(uid, charData, { name: name || `Scalata di ${charData?.name || "…"}`, type: TOWER_KEY, cls, level: level(cls), difficulty: "facile" }))}>
                {otherSectionRoom ? "Esci prima dal gruppo delle Segrete" : "🗼 Crea gruppo per la Torre di Vethrik"}
              </button>
            </details>

            {!!runningTowerRooms.length && (
              <details className="sgr-block sgr-fold">
                <summary className="sgr-h2">Nella Torre di Vethrik adesso <span className="sgr-count">{runningTowerRooms.length}</span></summary>
                <ul className="sgr-rooms">
                  {runningTowerRooms.map((r) => (
                    <li key={r.id} className="sgr-room is-running">
                      <div className="sgr-room-top">
                        <b className="sgr-room-name">{r.name}</b>
                        <DungeonBadge d={dungeonOf(r.type)} diff={r.difficulty} />
                      </div>
                      <p className="sgr-room-line">{r.members.map((m, i) => <span key={m.uid}>{i > 0 && " · "}{m.name} (<SegreteIdentity cls={m.cls} hero={m} />)</span>)}</p>
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

      {isTowerPage && tab === "premi" && <TowerRewardsPanel charData={charData} />}

      {tab === "eroi" && (
        <>
          <HeroNews charData={charData} onSelect={pickHero} />
          <HeroSections charData={charData} cls={curCls} onUse={chooseHero} disabled={busy} inRoom={!!myRoom} focus={focus} />
        </>
      )}
      {tab === "bottega" && <SegreteShop charData={charData} view="bottega" />}
      {tab === "zaino" && <SegreteShop charData={charData} view="zaino" uid={uid} />}
      {tab === "storico" && <SegreteLog charData={charData} mode={isTowerPage ? "torre" : "segrete"} />}
      {!isTowerPage && tab === "manuale" && <SegreteManual />}
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

// La lotta usa sempre la vista in prima persona.
function BattleView({ room, uid, master, onReopen, busy, charData }) {
  return (
    <Suspense fallback={<div className="sgb-loading"><p>🗝 Le porte delle Segrete si aprono…</p></div>}>
      <SegreteCrawler room={room} uid={uid} charData={charData} tools={master ? <div className="cw-tools">
        <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={onReopen}>↺ Riporta in stanza (Master)</button>
      </div> : null} />
    </Suspense>
  );
}

function MyRoom({ room, uid, master, charData, busy, run, dungeon, dungeons = [], canRun, onHeroes, onPick, onFix }) {
  const me = roomMember(room, uid);
  const host = room.hostUid === uid;
  const fakeMembers = room.fakeMembers || [];
  const allMembers = [...room.members, ...fakeMembers];
  const slots = Array.from({ length: MAX_PARTY }, (_, i) => allMembers[i] || null);
  const readyN = allMembers.filter((m) => m.ready).length;
  const dungeonActive = isTowerDungeon(room.type) || dungeons.some((d) => d.key === room.type);

  if (room.status === "running" || room.status === "done") {
    return (
      <BattleView room={room} uid={uid} charData={charData} master={master} busy={busy} onReopen={() => run(() => reopenRoom(room.id))} />
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
                  <b>{m.name}{m.uid === room.hostUid && <em className="sgr-tag">capo</em>}{m.fake && <em className="sgr-tag">NPC</em>}</b>
                  <small><span className="sgr-clsname"><SegreteIdentity cls={m.cls} hero={m} /></span>{m.race && RACES[m.race]?.name ? ` · ${RACES[m.race].name}` : ""} · Lv {m.level}</small>
                </span>
                <span className={`sgr-slot-state${m.ready ? " is-on" : ""}`}>{m.ready ? "✓ Pronto" : "In attesa"}</span>
                {(host || master) && m.uid !== uid && (
                  <button type="button" className="sgr-x" disabled={busy} aria-label={`Togli ${m.name}`} title="Togli dal gruppo"
                    onClick={() => run(() => (m.fake ? removeFakeNpc(room.id, uid, m.uid, master) : kickMember(room.id, uid, m.uid, master)))}>✕</button>
                )}
              </>
            ) : (
              (host || master) ? (
                <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy}
                  onClick={() => run(() => addFakeNpc(room.id, uid, master))}>
                  + 🤖 Aggiungi NPC casuale
                </button>
              ) : (
                <span className="sgr-slot-free">Posto libero</span>
              )
            )}
          </li>
        ))}
      </ol>

      {!!dungeons.length && <DungeonSwitch room={room} uid={uid} master={master} busy={busy} run={run} dungeons={dungeons} />}
      {isTowerDungeon(room.type) ? (
        <TowerInfoBox charData={charData} isHost={host} master={master} />
      ) : (
        <>
          <DifficultyPicker value={room.difficulty} readOnly={!host && !master} disabled={busy}
            levels={master ? room.members.filter((m) => m.uid !== uid) : room.members}
            onPick={(k) => run(() => chooseDifficulty(room.id, uid, k, master))} />
          <SegreteDungeonInfo dungeon={dungeon} diff={room.difficulty || "facile"} partySize={room.members.length} />
        </>
      )}

      <HeroQuickPick charData={charData} value={me?.cls} onPick={onPick} disabled={busy} onManage={onHeroes} label="Il tuo eroe nel gruppo" />

      {me && heroOf(charData, me.cls) && !armorChosen(me.cls, heroOf(charData, me.cls)) && (
        <button type="button" className="sgr-gear-alert" onClick={() => onFix?.(me.cls)}>⚠ Il tuo <SegreteIdentity cls={me.cls} hero={heroOf(charData, me.cls)} /> non ha ancora scelto l'armatura (ora usa quella di base). <b>Sistemala →</b></button>
      )}
      <p className={`sgr-company${room.members.length > 1 ? " is-on" : ""}`}>
        {room.members.length > 1
          ? <>🤝 <b>Compagnia ×{room.members.length}</b>: {companyLines(room.members.length).join(" · ")}.{room.members.length < MAX_PARTY ? ` In ${room.members.length + 1}: ${companyLines(room.members.length + 1).join(" · ")}.` : ""}</>
          : <>🤝 Da soli niente bonus. <b>In 2</b>: {companyLines(2).join(" · ")} — e cresce fino a {MAX_PARTY}. Invita qualcuno!</>}
      </p>
      {!dungeonActive && <p className="sgr-err">Questo dungeon è disattivato. Il capo deve sceglierne uno attivo per partire.</p>}
      {room.blocked && <p className="sgr-err" role="alert">⛔ Non si può partire: {room.blocked}.</p>}
      {!canRun && !isTowerDungeon(room.type) && (
        <p className="sgr-helper">🤝 Con {me ? <SegreteIdentity cls={me.cls} hero={me} /> : "questa classe"} hai già fatto i {DAILY_RUNS} dungeon di oggi: puoi entrare lo stesso <b>come aiuto</b> (giochi per il gruppo, ma niente PE, monete né bottino per te; con un altro eroe invece prendi i premi).</p>
      )}
      <div className="sgr-start">
        <button type="button" className={`sgr-cta${me?.ready ? " is-ready" : ""}`} disabled={busy || (!me?.ready && (!dungeonActive || !heroReady(charData, me?.cls) || (isTowerDungeon(room.type) && host && !master && !towerStatusOf(charData).canOpen)))}
          onClick={() => {
            if (!me?.ready && isTowerDungeon(room.type)) {
              const ts = towerStatusOf(charData);
              if (ts.floor > 0 && !window.confirm(`Hai già registrato il Piano ${ts.floor}/100 questa settimana!\n\nSe entri di nuovo nella Torre ripartirai dal Piano 1 e il nuovo risultato SOSTITUIRÀ il Piano ${ts.floor} (anche se più basso) per i premi di domenica alle 23:00.\n\nVuoi davvero procedere?`)) {
                return;
              }
            }
            run(() => setReady(room.id, uid, !me?.ready));
          }}>
          {me?.ready ? "✓ Pronto — annulla" : isTowerDungeon(room.type) ? "🗼 Avvia Scalata" : canRun ? "▶ Avvia" : "▶ Avvia come aiuto"}
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
