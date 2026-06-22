// src/pages/Concilio.jsx
// "Il Concilio" — sala dove i servitori AI di Eldoria rendono conto.
// Mostra ogni agente, il suo stato, le sue statistiche e il DIARIO dal vivo
// (azioni e ragionamenti), e permette di interagirci. Solo per il Master.

import { useState, useEffect, useMemo } from "react";
import { httpsCallable } from "firebase/functions";
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, setDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { db, functions } from "../firebase";
import { AGENTS, KIND_META } from "../data/agentsRegistry";
import "./Concilio.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

const LEVEL_META = {
  info:    { icon: "•",  c: "#6a5b41" },
  reason:  { icon: "🧠", c: "#3a4a7c" },
  action:  { icon: "⚡", c: "#7c560f" },
  success: { icon: "✔", c: "#1c5a4a" },
  error:   { icon: "✖", c: "#8a261c" },
};

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  return new Date(ts);
}

function relTime(date) {
  if (!date) return "—";
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "ora";
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d} g fa`;
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function clockTime(date) {
  if (!date) return "";
  return date.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Concilio() {
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === MASTER_EMAIL;

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [counters, setCounters] = useState({}); // { agentId: { total, byDay, lastAt, lastText } }
  const [scribaCfg, setScribaCfg] = useState({ enabled: true });
  const [editions, setEditions] = useState([]);
  const [selected, setSelected] = useState(null); // agent id
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Sottoscrizioni live ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isMaster) return;
    const unsubLogs = onSnapshot(
      query(collection(db, "agent_logs"), orderBy("ts", "desc"), limit(250)),
      (snap) => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data(), date: tsToDate(d.data().ts) }))),
      () => {}
    );
    const unsubStats = onSnapshot(doc(db, "agent_stats", "global"),
      (s) => setStats(s.exists() ? s.data() : null), () => {});
    const unsubCounters = onSnapshot(collection(db, "agent_counters"),
      (snap) => { const m = {}; snap.forEach(d => { m[d.id] = d.data(); }); setCounters(m); }, () => {});
    const unsubCfg = onSnapshot(doc(db, "settings", "scriba"),
      (s) => { if (s.exists()) setScribaCfg(s.data()); }, () => {});
    const unsubNews = onSnapshot(
      query(collection(db, "newsletters"), orderBy("createdAt", "desc"), limit(20)),
      (snap) => setEditions(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}
    );
    return () => { unsubLogs(); unsubStats(); unsubCounters(); unsubCfg(); unsubNews(); };
  }, [isMaster]);

  // Helpers contatori: oggi e ultimi 7 giorni (dai bucket byDay).
  function todayKey() { return new Date().toISOString().slice(0, 10); }
  function countToday(id) { return counters[id]?.byDay?.[todayKey()] || 0; }
  function last7(id) {
    const by = counters[id]?.byDay || {};
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      out.push({ d, n: by[d] || 0 });
    }
    return out;
  }

  // ── Dati derivati per agente ───────────────────────────────────────────────
  const byAgent = useMemo(() => {
    const map = {};
    for (const a of AGENTS) map[a.id] = [];
    for (const l of logs) { if (map[l.agent]) map[l.agent].push(l); }
    return map;
  }, [logs]);

  function statusOf(agent) {
    const mine = byAgent[agent.id] || [];
    const last = mine[0];
    // errore recente (ultimi 6 log) → in errore
    if (mine.slice(0, 6).some(l => l.level === "error")) return { dot: "err", label: "Problema recente" };
    if (agent.id === "scriba") {
      if (scribaCfg.enabled === false) return { dot: "off", label: "In pausa" };
      const pending = editions.find(e => e.status === "draft" || e.status === "approved");
      if (pending) return { dot: "work", label: `Bozza N. ${pending.number} in attesa` };
    }
    if (agent.kind === "sync") return { dot: "idle", label: "Sul tuo PC" };
    if (last) return { dot: "ok", label: "Attivo" };
    return { dot: "idle", label: "In attesa" };
  }

  // ── Trigger Lo Scriba ──────────────────────────────────────────────────────
  async function scribaGenerate() {
    setBusy(true); setToast(null);
    try {
      const fn = httpsCallable(functions, "scribaPreview");
      await fn({ days: scribaCfg.intervalDays || 10 });
      setToast({ t: "ok", m: "Anteprima in generazione: arriverà nella tua mail. Segui il diario qui sotto." });
    } catch (e) {
      setToast({ t: "err", m: "Errore: " + (e.message || e) });
    } finally { setBusy(false); }
  }

  async function scribaToggle() {
    setBusy(true);
    try {
      await setDoc(doc(db, "settings", "scriba"), { enabled: !(scribaCfg.enabled !== false) }, { merge: true });
    } catch (e) {
      setToast({ t: "err", m: "Errore: " + (e.message || e) });
    } finally { setBusy(false); }
  }

  if (!isMaster) {
    return (
      <div className="conc-locked">
        <div className="conc-orb">🜂</div>
        <h1>Il Concilio</h1>
        <p>Questa sala è riservata al Maestro del Concilio.</p>
      </div>
    );
  }

  const sel = selected ? AGENTS.find(a => a.id === selected) : null;
  const selLogs = sel ? (byAgent[sel.id] || []) : [];

  return (
    <div className="conc">
      {/* MASTHEAD */}
      <header className="conc-head">
        <div className="conc-eyebrow">✦ Sala dei Servitori Arcani</div>
        <h1>Il Concilio</h1>
        <p className="conc-sub">
          I tuoi agenti AI: cosa sanno fare, cosa stanno facendo e cosa hanno fatto.
        </p>
        <div className="conc-legend">
          {Object.entries(KIND_META).map(([k, m]) => (
            <span key={k} className="conc-legend-item" style={{ "--c": m.c, "--bg": m.bg }}>
              <i /> {m.label} · <em>{m.desc}</em>
            </span>
          ))}
        </div>
      </header>

      {toast && <div className={"conc-toast " + toast.t} onClick={() => setToast(null)}>{toast.m}</div>}

      {/* GRIGLIA AGENTI */}
      <div className="conc-grid">
        {AGENTS.map(a => {
          const km = KIND_META[a.kind];
          const st = statusOf(a);
          const mine = byAgent[a.id] || [];
          const last = mine[0];
          return (
            <button key={a.id} className="conc-card" onClick={() => setSelected(a.id)}>
              <div className="conc-card-top">
                <span className="conc-sigillo">{a.sigillo}</span>
                <span className={"conc-dot " + st.dot} title={st.label} />
              </div>
              <h3>{a.nome}</h3>
              <span className="conc-kind" style={{ "--c": km.c, "--bg": km.bg }}>{km.label}</span>
              <p className="conc-card-sum">{a.sommario}</p>
              <div className="conc-card-nums">
                <span><b>{counters[a.id]?.total || 0}</b> finora</span>
                <span><b>{countToday(a.id)}</b> oggi</span>
              </div>
              <div className="conc-card-foot">
                <span className="conc-status">{st.label}</span>
                <span className="conc-when">{last ? relTime(last.date) : "—"}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* FEED GLOBALE */}
      <section className="conc-feed">
        <h2>Cronaca del Concilio</h2>
        {logs.length === 0 && (
          <p className="conc-empty">
            Ancora nessuna attività registrata. Appena un agente lavora (l'Oracolo risponde,
            Lo Scriba scrive un numero…) le sue azioni e i suoi ragionamenti compaiono qui.
          </p>
        )}
        <ul className="conc-log">
          {logs.slice(0, 60).map(l => {
            const a = AGENTS.find(x => x.id === l.agent);
            const lm = LEVEL_META[l.level] || LEVEL_META.info;
            return (
              <li key={l.id}>
                <span className="conc-log-ag" title={a?.nome || l.agent}>{a?.sigillo || "•"}</span>
                <span className="conc-log-lvl" style={{ color: lm.c }}>{lm.icon}</span>
                <span className="conc-log-txt">{l.text}</span>
                <span className="conc-log-time">{relTime(l.date)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* DOSSIER */}
      {sel && (
        <div className="conc-overlay" onClick={() => setSelected(null)}>
          <div className="conc-modal" onClick={e => e.stopPropagation()}>
            <button className="conc-close" onClick={() => setSelected(null)}>✕</button>

            <div className="conc-modal-head">
              <span className="conc-sigillo big">{sel.sigillo}</span>
              <div>
                <h2>{sel.nome}</h2>
                <div className="conc-modal-tags">
                  <span className="conc-kind" style={{ "--c": KIND_META[sel.kind].c, "--bg": KIND_META[sel.kind].bg }}>
                    {KIND_META[sel.kind].label}
                  </span>
                  <span className="conc-motore">⚙ {sel.motore}</span>
                  <code>{sel.file}</code>
                </div>
              </div>
            </div>

            <p className="conc-modal-desc">{sel.cosaFa}</p>

            {/* Statistiche (contatori aggregati) */}
            {sel.kind !== "sync" && (
              <>
                <div className="conc-stats">
                  <div><b>{counters[sel.id]?.total || 0}</b><span>generate finora</span></div>
                  <div><b>{countToday(sel.id)}</b><span>oggi</span></div>
                  {sel.id === "oracolo"
                    ? <div><b>{Object.keys(stats?.perUser || {}).length}</b><span>giocatori l'hanno usato</span></div>
                    : <div><b>{relTime(tsToDate(counters[sel.id]?.lastAt))}</b><span>ultima volta</span></div>}
                </div>

                {/* ultimi 7 giorni */}
                {(counters[sel.id]?.total || 0) > 0 && (
                  <div className="conc-spark">
                    <span className="conc-spark-cap">Ultimi 7 giorni</span>
                    <div className="conc-spark-bars">
                      {(() => { const days = last7(sel.id); const max = Math.max(1, ...days.map(d => d.n));
                        return days.map(d => (
                          <div key={d.d} className="conc-spark-col" title={`${d.d}: ${d.n}`}>
                            <i style={{ height: `${Math.round((d.n / max) * 100)}%` }} />
                            <small>{d.d.slice(8)}</small>
                          </div>
                        )); })()}
                    </div>
                  </div>
                )}

                {counters[sel.id]?.lastText && (
                  <div className="conc-last">
                    <span>Ultima cosa generata</span>
                    <p>{counters[sel.id].lastText}</p>
                  </div>
                )}
              </>
            )}

            {/* Pannello Lo Scriba */}
            {sel.id === "scriba" && (
              <div className="conc-scriba">
                <div className="conc-scriba-row">
                  <span className={"conc-pill " + (scribaCfg.enabled !== false ? "on" : "off")}>
                    {scribaCfg.enabled !== false ? "● Automatismo attivo" : "○ In pausa"}
                  </span>
                  {editions[0] && (
                    <span className="conc-scriba-last">
                      Ultimo: N. {editions[0].number} ({editions[0].status})
                    </span>
                  )}
                </div>
                <div className="conc-scriba-btns">
                  <button disabled={busy} onClick={scribaGenerate}>📜 Genera anteprima ora</button>
                  <button disabled={busy} className="ghost" onClick={scribaToggle}>
                    {scribaCfg.enabled !== false ? "⏸ Metti in pausa" : "▶ Riattiva"}
                  </button>
                  <Link to="/dm-admin/scriba" className="conc-link-btn">Pannello completo →</Link>
                </div>
                {editions.length > 0 && (
                  <ul className="conc-editions">
                    {editions.slice(0, 6).map(e => (
                      <li key={e.id}>
                        <b>N. {e.number}</b>
                        <span className={"conc-ed-st st-" + (e.status || "draft")}>{e.status}</span>
                        <span className="conc-ed-date">{clockTime(tsToDate(e.createdAt))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Interazione generica */}
            {sel.interagisci?.tipo === "chat" && (
              <Link to={sel.interagisci.to} className="conc-cta">💬 {sel.interagisci.label}</Link>
            )}
            {sel.interagisci?.tipo === "link" && (
              <Link to={sel.interagisci.to} className="conc-cta">{sel.interagisci.label} →</Link>
            )}
            {sel.interagisci?.tipo === "info" && (
              <div className="conc-info">{sel.interagisci.testo}</div>
            )}

            {/* DIARIO */}
            <h4 className="conc-diary-title">Diario — azioni e ragionamenti</h4>
            {selLogs.length === 0 ? (
              <p className="conc-empty small">Nessuna azione registrata finora per questo agente.</p>
            ) : (
              <ul className="conc-diary">
                {selLogs.slice(0, 80).map(l => {
                  const lm = LEVEL_META[l.level] || LEVEL_META.info;
                  return (
                    <li key={l.id}>
                      <span className="conc-diary-lvl" style={{ color: lm.c }}>{lm.icon}</span>
                      <span className="conc-diary-txt">{l.text}</span>
                      <span className="conc-diary-time">{clockTime(l.date)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
