// src/pages/Tarocchi.jsx
//
// "Alaric, l'oracolo bendato" — lettura dei Tarocchi (Arcani Maggiori).
//
// ACCESSO E FLUSSO
//   • Privilegiati (pagina completa = il banco di lettura): il PG Alaric,
//     il Master e il co-master (ripperti). Solo loro voltano le carte.
//   • Gli altri giocatori possono SOLO "richiedere" una lettura: la richiesta
//     manda una notifica push UNICAMENTE ad Alaric. Alaric esegue la lettura
//     e invia il responso al richiedente, che riceve a sua volta una push e
//     può tornare qui a leggerlo (o chiederne un'altra).
//   • Limite: massimo UNA richiesta al giorno per giocatore.
//   • I responsi restano sempre visibili (cronologia) al richiedente, ad
//     Alaric e ai Master.
//
// Carte "vere": dorso + figura con flip. Finché le immagini
// (/assets/tarocchi/back.png e 0..21.png) mancano si usa un placeholder.

import { useState, useEffect, useCallback } from "react";
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, doc,
  getDoc, getDocs, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { notifyUser } from "../utils/notify";
import {
  ARCANI, ARCANO_BY_N, CARD_BACK_SRC, cardFaceSrc, STESE,
  ORACLE_MASTER_EMAIL, ORACLE_COMASTER_EMAIL, isAlaricName, ALARIC_PORTRAIT,
} from "../data/tarocchi";
import useParallaxScroll from "../hooks/useParallaxScroll";
import AmbientFX from "../components/AmbientFX";
import "../styles/cinematic.css";
import "./Tarocchi.css";

const HERO_IMAGE = "/assets/arcano.png";

/* ── utility ─────────────────────────────────────────────────────────────── */
function tsToMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime();
}
function sameLocalDay(ts) {
  const ms = tsToMs(ts);
  if (!ms) return false;
  const d = new Date(ms), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function fmtDate(ts) {
  const ms = tsToMs(ts);
  if (!ms) return "";
  return new Date(ms).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Estrae `count` Arcani distinti, ciascuno con orientamento casuale.
function pescaTiro(count) {
  const mazzo = [...ARCANI];
  for (let i = mazzo.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mazzo[i], mazzo[j]] = [mazzo[j], mazzo[i]];
  }
  return mazzo.slice(0, count).map((carta) => ({ ...carta, rovesciata: Math.random() < 0.5 }));
}

// Costruisce la stringa-responso da un tiro + stesa.
function buildResponso(tiro, stesa) {
  return tiro
    .map((c, i) => {
      const ruolo = stesa.ruoli[i] || `Carta ${i + 1}`;
      const orient = c.rovesciata ? "Rovescio" : "Dritto";
      const senso = c.rovesciata ? c.rovescio : c.dritto;
      return `${ruolo}: ${c.nome} (${orient}) — ${senso}`;
    })
    .join("\n");
}

/* ── Carta animata (flip dorso → figura) ─────────────────────────────────── */
function Carta({ carta, ruolo, rivelata, indice }) {
  const [imgFace, setImgFace] = useState(true);
  const [imgBack, setImgBack] = useState(true);
  const orient = carta.rovesciata ? "Rovescio" : "Dritto";
  const senso = carta.rovesciata ? carta.rovescio : carta.dritto;

  return (
    <figure className="taro-slot" style={{ "--reveal-delay": `${indice * 160}ms` }}>
      {ruolo && <span className="taro-role">{ruolo}</span>}
      <div className={`taro-card${rivelata ? " is-revealed" : ""}`}>
        <div className="taro-card-inner">
          <div className="taro-face taro-face--back">
            {imgBack ? (
              <img src={CARD_BACK_SRC} alt="" onError={() => setImgBack(false)} />
            ) : (
              <div className="taro-placeholder taro-placeholder--back" aria-hidden="true">
                <span className="taro-ph-star">✦</span>
              </div>
            )}
          </div>
          <div className={`taro-face taro-face--front${carta.rovesciata ? " is-reversed" : ""}`}>
            {imgFace ? (
              <img src={cardFaceSrc(carta.n)} alt={carta.nome} onError={() => setImgFace(false)} />
            ) : (
              <div className="taro-placeholder taro-placeholder--front" aria-hidden="true">
                <span className="taro-ph-glifo">{carta.glifo}</span>
                <span className="taro-ph-simbolo">{carta.simbolo}</span>
                <span className="taro-ph-nome">{carta.nome}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {rivelata && (
        <figcaption className="taro-caption">
          <span className="taro-cap-nome">{carta.nome}</span>
          <span className={`taro-cap-orient taro-cap-orient--${carta.rovesciata ? "rov" : "dir"}`}>{orient}</span>
          <span className="taro-cap-senso">{senso}</span>
        </figcaption>
      )}
    </figure>
  );
}

/* ── Mini-carta statica (cronologia) ─────────────────────────────────────── */
function MiniArcano({ n, rovesciata, ruolo }) {
  const a = ARCANO_BY_N[n];
  const [img, setImg] = useState(true);
  if (!a) return null;
  const senso = rovesciata ? a.rovescio : a.dritto;
  return (
    <div className="taro-mini">
      {ruolo && <span className="taro-mini-role">{ruolo}</span>}
      <div className={`taro-mini-fig${rovesciata ? " is-reversed" : ""}`}>
        {img ? (
          <img src={cardFaceSrc(n)} alt={a.nome} onError={() => setImg(false)} />
        ) : (
          <div className="taro-mini-ph"><span>{a.glifo}</span><b>{a.simbolo}</b></div>
        )}
      </div>
      <span className="taro-mini-nome">{a.nome}</span>
      <span className={`taro-cap-orient taro-cap-orient--${rovesciata ? "rov" : "dir"}`}>
        {rovesciata ? "Rovescio" : "Dritto"}
      </span>
      <span className="taro-mini-senso">{senso}</span>
    </div>
  );
}

/* ── Vista di un responso salvato ────────────────────────────────────────── */
function ResponsoSalvato({ reading, showRequester }) {
  const ruoli = (STESE[reading.num] || {}).ruoli || [];
  return (
    <article className="taro-hist-card">
      <header className="taro-hist-head">
        <div>
          {showRequester && <span className="taro-hist-who">Per {reading.requesterName || "Anonimo"}</span>}
          <span className="taro-hist-title">{reading.steseTitolo || "Lettura"}</span>
        </div>
        <span className="taro-hist-date">{fmtDate(reading.answeredAt || reading.createdAt)}</span>
      </header>
      {reading.question ? <p className="taro-hist-q">«{reading.question}»</p> : null}
      <div className="taro-mini-row">
        {(reading.cards || []).map((c, i) => (
          <MiniArcano key={`${c.n}-${i}`} n={c.n} rovesciata={c.rovesciata} ruolo={ruoli[i] || `Carta ${i + 1}`} />
        ))}
      </div>
      {reading.answeredByName && (
        <footer className="taro-hist-foot">Lettura voltata da <strong>{reading.answeredByName}</strong></footer>
      )}
    </article>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function Tarocchi() {
  useParallaxScroll();
  const { currentUser } = useAuth();

  // Ruoli
  const [myName, setMyName] = useState("");
  const [alaricUid, setAlaricUid] = useState(null);
  const [roleReady, setRoleReady] = useState(false);

  const email = currentUser?.email || "";
  const isMaster = email === ORACLE_MASTER_EMAIL;
  const isComaster = email === ORACLE_COMASTER_EMAIL;
  const isAlaric = isAlaricName(myName);
  const privileged = isMaster || isComaster || isAlaric;

  // Risolve nome del PG corrente + uid di Alaric (per la push).
  useEffect(() => {
    if (!currentUser) { setRoleReady(true); return; }
    let alive = true;
    (async () => {
      try {
        const me = await getDoc(doc(db, "characters", currentUser.uid));
        if (alive && me.exists()) setMyName(me.data().name || "");
      } catch { /* ignora */ }
      try {
        const all = await getDocs(collection(db, "characters"));
        const al = all.docs.find((d) => isAlaricName(d.data().name));
        if (alive && al) setAlaricUid(al.id);
      } catch { /* ignora */ }
      if (alive) setRoleReady(true);
    })();
    return () => { alive = false; };
  }, [currentUser]);

  // Cronologia letture (privilegiati: tutte; altri: solo le proprie).
  const [readings, setReadings] = useState([]);
  useEffect(() => {
    if (!currentUser || !roleReady) return;
    const q = privileged
      ? query(collection(db, "oracle_readings"))
      : query(collection(db, "oracle_readings"), where("requesterUid", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => tsToMs(b.createdAt) - tsToMs(a.createdAt));
      setReadings(arr);
    }, () => { /* permessi/offline: ignora */ });
    return () => unsub();
  }, [currentUser, roleReady, privileged]);

  // ── Stato richiedente ──────────────────────────────────────────────────
  const [question, setQuestion] = useState("");
  const myReadings = readings.filter((r) => r.requesterUid === currentUser?.uid);
  const myPending = myReadings.find((r) => r.status === "pending");
  const requestedToday = myReadings.some((r) => sameLocalDay(r.createdAt));
  const canRequest = !myPending && !requestedToday;

  const richiediLettura = useCallback(async () => {
    if (!currentUser || !canRequest) return;
    try {
      await addDoc(collection(db, "oracle_readings"), {
        requesterUid: currentUser.uid,
        requesterName: myName || currentUser.email || "Anonimo",
        status: "pending",
        question: question.trim(),
        cards: [], responso: "", num: 0, steseTitolo: "",
        createdAt: serverTimestamp(), answeredAt: null, answeredByName: "",
      });
      if (alaricUid) {
        notifyUser(
          alaricUid,
          "🔮 Nuova richiesta all'Oracolo",
          `${myName || "Un viandante"} chiede una lettura ad Alaric, l'oracolo bendato.`
        );
      }
      setQuestion("");
    } catch (e) {
      console.warn("[oracolo] richiesta fallita:", e);
    }
  }, [currentUser, canRequest, myName, question, alaricUid]);

  // ── Stato oracolo (banco di lettura) ────────────────────────────────────
  const [num, setNum] = useState(3);
  const [tiro, setTiro] = useState(null);
  const [rivelate, setRivelate] = useState(false);
  const [copiato, setCopiato] = useState(false);
  const [activeReq, setActiveReq] = useState(null); // richiesta che si sta evadendo
  const [inviato, setInviato] = useState(false);
  const stesa = STESE[num] || STESE[3];

  const estrai = useCallback(() => {
    setRivelate(false); setCopiato(false); setInviato(false);
    setTiro(pescaTiro(num));
    requestAnimationFrame(() => setTimeout(() => setRivelate(true), 120));
  }, [num]);

  const responso = tiro ? buildResponso(tiro, stesa) : "";

  const copiaResponso = async () => {
    try { await navigator.clipboard.writeText(responso); setCopiato(true); setTimeout(() => setCopiato(false), 2200); }
    catch { /* clipboard non disponibile */ }
  };

  const pendingReqs = readings.filter((r) => r.status === "pending");

  const apriRichiesta = (req) => {
    setActiveReq(req); setTiro(null); setRivelate(false); setInviato(false);
    document.getElementById("taro-banco")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const inviaResponso = useCallback(async () => {
    if (!activeReq || !tiro) return;
    try {
      await updateDoc(doc(db, "oracle_readings", activeReq.id), {
        status: "answered",
        cards: tiro.map((c) => ({ n: c.n, rovesciata: c.rovesciata })),
        responso,
        num,
        steseTitolo: stesa.titolo,
        answeredAt: serverTimestamp(),
        answeredByName: myName || "L'Oracolo",
      });
      notifyUser(
        activeReq.requesterUid,
        "🔮 Il tuo responso è pronto",
        `${myName || "Alaric"} ha voltato le carte per te. Apri l'Oracolo per scoprire il responso.`
      );
      setInviato(true);
      setActiveReq(null);
    } catch (e) {
      console.warn("[oracolo] invio responso fallito:", e);
    }
  }, [activeReq, tiro, responso, num, stesa.titolo, myName]);

  /* ── HERO (sempre presente) ─────────────────────────────────────────── */
  const Hero = (
    <section className="taro-hero" aria-label="Alaric, l'oracolo bendato">
      <div className="taro-hero-media" aria-hidden="true">
        <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      </div>
      <div className="taro-hero-wash" aria-hidden="true" />
      <div className="taro-hero-plate">
        <figure className="taro-hero-portrait">
          <img src={ALARIC_PORTRAIT} alt="Alaric Voltasorte" onError={(e) => { e.currentTarget.closest(".taro-hero-portrait").style.display = "none"; }} />
          <span className="taro-hero-blind" aria-hidden="true" />
        </figure>
        <div className="taro-hero-text">
          <span className="taro-hero-seal">✦ Arcani Maggiori</span>
          <h1 className="taro-hero-title">Alaric,<br />l'oracolo bendato</h1>
          <p className="taro-hero-tagline">
            Gli occhi velati non vedono il mondo, ma leggono il destino. Poni la tua
            domanda e lascia che le lame parlino.
          </p>
        </div>
      </div>
    </section>
  );

  /* ── Non loggato ───────────────────────────────────────────────────── */
  if (!currentUser && roleReady) {
    return (
      <section className="cine-page taro-page cine-compact" style={{ "--cine-accent": "#6f44c9", "--cine-accent-2": "#8a63dd" }}>
        <AmbientFX variant="cosmos" />
        {Hero}
        <section className="taro-section">
          <div className="taro-empty"><span className="taro-empty-glifo">✦</span>
            <p>Accedi per consultare Alaric, l'oracolo bendato.</p>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="cine-page taro-page cine-compact" style={{ "--cine-accent": "#6f44c9", "--cine-accent-2": "#8a63dd" }}>
      <AmbientFX variant="cosmos" />
      {Hero}

      {/* ════════ VISTA ORACOLO (Alaric / Master / co-master) ════════ */}
      {privileged ? (
        <>
          {/* Richieste in attesa */}
          <section className="taro-section" aria-label="Richieste in attesa">
            <header className="taro-sec-head">
              <span className="taro-sec-eyebrow">Il velo dell'Oracolo</span>
              <h2 className="taro-sec-title">Richieste in attesa</h2>
              <p className="taro-sec-lead">
                {pendingReqs.length === 0
                  ? "Nessun viandante attende un responso, per ora."
                  : `${pendingReqs.length} ${pendingReqs.length === 1 ? "anima attende" : "anime attendono"} che tu volti le carte.`}
              </p>
            </header>
            {pendingReqs.length > 0 && (
              <ul className="taro-queue">
                {pendingReqs.map((r) => (
                  <li key={r.id} className={`taro-queue-item${activeReq?.id === r.id ? " is-active" : ""}`}>
                    <div className="taro-queue-info">
                      <span className="taro-queue-name">{r.requesterName || "Anonimo"}</span>
                      <span className="taro-queue-date">{fmtDate(r.createdAt)}</span>
                      {r.question ? <p className="taro-queue-q">«{r.question}»</p> : <p className="taro-queue-q taro-queue-q--none">Nessuna domanda scritta.</p>}
                    </div>
                    <button type="button" className="taro-draw taro-draw--sm" onClick={() => apriRichiesta(r)}>
                      ✦ Leggi per {(r.requesterName || "lui").split(" ")[0]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Banco di lettura */}
          <section id="taro-banco" className="taro-section" aria-label="Banco di lettura">
            <header className="taro-sec-head">
              <span className="taro-sec-eyebrow">Il Tavolo · {stesa.titolo}</span>
              <h2 className="taro-sec-title">{activeReq ? `Lettura per ${activeReq.requesterName}` : "Lettura libera"}</h2>
              <p className="taro-sec-lead">
                {activeReq
                  ? "Volta le carte, poi invia il responso al richiedente."
                  : "Estrai per te, oppure scegli una richiesta qui sopra per rispondere."}
              </p>
            </header>

            {activeReq && (
              <div className="taro-active-banner">
                Stai leggendo per <strong>{activeReq.requesterName}</strong>
                {activeReq.question ? <em> · «{activeReq.question}»</em> : null}
                <button type="button" className="taro-active-x" onClick={() => setActiveReq(null)} aria-label="Annulla">✕</button>
              </div>
            )}

            <div className="taro-controls">
              <div className="taro-count" role="group" aria-label="Quante carte estrarre">
                {[1, 2, 3, 4, 5].map((k) => (
                  <button key={k} type="button" className={`taro-count-btn${num === k ? " is-active" : ""}`} onClick={() => setNum(k)} aria-pressed={num === k}>{k}</button>
                ))}
              </div>
              <button type="button" className="taro-draw" onClick={estrai}>{tiro ? "↻ Estrai di nuovo" : "✦ Estrai le Carte"}</button>
            </div>

            {!tiro ? (
              <div className="taro-empty"><span className="taro-empty-glifo">✦</span><p>Il mazzo è coperto. Estrai per voltare le carte.</p></div>
            ) : (
              <>
                <div className={`taro-spread taro-spread--${num}`}>
                  {tiro.map((c, i) => (
                    <Carta key={`${c.n}-${i}`} carta={c} ruolo={stesa.ruoli[i] || `Carta ${i + 1}`} rivelata={rivelate} indice={i} />
                  ))}
                </div>

                {rivelate && (
                  <div className="taro-responso">
                    <div className="taro-responso-head">
                      <h3>Il responso dell'Oracolo</h3>
                      <div className="taro-responso-actions">
                        <button type="button" className="taro-copy" onClick={copiaResponso}>{copiato ? "✓ Copiato" : "⧉ Copia"}</button>
                        {activeReq && (
                          <button type="button" className="taro-send" onClick={inviaResponso}>
                            ➤ Invia a {activeReq.requesterName.split(" ")[0]}
                          </button>
                        )}
                      </div>
                    </div>
                    <ol className="taro-responso-list">
                      {tiro.map((c, i) => (
                        <li key={`r-${c.n}-${i}`}>
                          <span className="taro-responso-role">{stesa.ruoli[i] || `Carta ${i + 1}`}</span>
                          <span className="taro-responso-card">{c.nome}<em className={c.rovesciata ? "rov" : "dir"}>{c.rovesciata ? " · Rovescio" : " · Dritto"}</em></span>
                          <span className="taro-responso-senso">{c.rovesciata ? c.rovescio : c.dritto}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
            {inviato && <p className="taro-sent-ok">✓ Responso inviato. Il richiedente è stato avvisato.</p>}
          </section>

          {/* Cronologia completa */}
          <section className="taro-section" aria-label="Cronologia">
            <header className="taro-sec-head">
              <span className="taro-sec-eyebrow">Archivio</span>
              <h2 className="taro-sec-title">Cronologia delle letture</h2>
            </header>
            {readings.filter((r) => r.status === "answered").length === 0 ? (
              <div className="taro-empty"><p>Ancora nessun responso registrato.</p></div>
            ) : (
              <div className="taro-hist">
                {readings.filter((r) => r.status === "answered").map((r) => (
                  <ResponsoSalvato key={r.id} reading={r} showRequester />
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        /* ════════ VISTA RICHIEDENTE (altri giocatori) ════════ */
        <>
          <section className="taro-section" aria-label="Richiedi una lettura">
            <header className="taro-sec-head">
              <span className="taro-sec-eyebrow">Il velo dell'Oracolo</span>
              <h2 className="taro-sec-title">Richiedi una lettura</h2>
              <p className="taro-sec-lead">
                Non sei tu a voltare le carte: è <strong>Alaric, l'oracolo bendato</strong>.
                Invia la tua richiesta e attendi il suo responso. <em>Una sola richiesta al giorno.</em>
              </p>
            </header>

            <div className="taro-request">
              <textarea
                className="taro-q-input"
                placeholder="La tua domanda all'Oracolo (facoltativa)…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={280}
                rows={3}
              />
              {myPending ? (
                <p className="taro-req-state taro-req-state--wait">⏳ La tua richiesta è in attesa: Alaric sta per voltare le carte.</p>
              ) : !canRequest ? (
                <p className="taro-req-state taro-req-state--limit">🌙 Hai già interrogato l'Oracolo oggi. Torna domani per una nuova lettura.</p>
              ) : null}
              <button type="button" className="taro-draw" onClick={richiediLettura} disabled={!canRequest}>
                ✦ Richiedi il responso ad Alaric
              </button>
            </div>
          </section>

          <section className="taro-section" aria-label="Le tue letture">
            <header className="taro-sec-head">
              <span className="taro-sec-eyebrow">Archivio</span>
              <h2 className="taro-sec-title">Le tue letture</h2>
            </header>
            {myReadings.filter((r) => r.status === "answered").length === 0 ? (
              <div className="taro-empty"><span className="taro-empty-glifo">✦</span><p>Non hai ancora ricevuto un responso.</p></div>
            ) : (
              <div className="taro-hist">
                {myReadings.filter((r) => r.status === "answered").map((r) => (
                  <ResponsoSalvato key={r.id} reading={r} showRequester={false} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
