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

import { isDmUser } from "../utils/dmAccess";

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

// ── Tesoreria: consumo token e spesa API Claude (Admin API Anthropic) ───────
const fmtTok = (n) => {
  if (!n) return "0";
  if (n >= 1e6) return (n / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 1 }) + " M";
  if (n >= 1000) return Math.round(n / 1000).toLocaleString("it-IT") + " k";
  return n.toLocaleString("it-IT");
};
const fmtUsd = (cents) =>
  "$ " + ((cents || 0) / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortModel = (m) => String(m).replace(/^claude-/, "").replace(/-\d{8}$/, "");

// Colori serie (validati per contrasto e daltonismo su fondo pergamena):
// input = blu, output = ambra; la spesa (una sola serie) usa il bronzo del tema.
const C_IN = "#3b6ea5";
const C_OUT = "#c47d1f";

// Componenti di spesa (cosa, esattamente, costa) — colori validati sul tema.
const COMP_META = [
  { key: "output",     label: "Output",         desc: "il testo che il modello scrive — la voce più cara (output ≈ 5× l'input)", c: C_OUT },
  { key: "input",      label: "Input (nuovo)",  desc: "i token del prompt non ancora in cache", c: C_IN },
  { key: "cacheWrite", label: "Scrittura cache", desc: "salvare il contesto per riusarlo (una tantum, ~1,25–2× l'input)", c: "#6a8f4f" },
  { key: "cacheRead",  label: "Lettura cache",   desc: "contesto riletto dalla cache — ~10× più economico dell'input", c: "#9a86c4" },
];

function TesoreriaClaude() {
  const [state, setState] = useState({ status: "loading" });
  const [win, setWin] = useState(7); // finestra attiva: 7 o 30 giorni

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/claude-usage");
        const j = await r.json();
        if (!alive) return;
        if (j.error) setState({ status: "error", msg: j.error });
        else if (j.configured === false) setState({ status: "unconfigured" });
        else setState({ status: "ok", data: j });
      } catch (e) {
        if (alive) setState({ status: "error", msg: e.message || String(e) });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state.status === "loading") {
    return <section className="conc-tes"><h2>🪙 La Tesoreria</h2><p className="conc-empty">Consulto i registri di Anthropic…</p></section>;
  }
  if (state.status === "unconfigured") {
    return (
      <section className="conc-tes">
        <h2>🪙 La Tesoreria</h2>
        <div className="conc-tes-setup">
          <p><b>Chiave Admin mancante.</b> Per vedere token e spesa delle chiamate API serve una <em>Admin API key</em> di Anthropic (diversa dalla chiave normale):</p>
          <ol>
            <li>Nel <a href="https://platform.claude.com/settings/admin-keys" target="_blank" rel="noreferrer">Claude Console → Settings → Admin keys</a> crea una chiave <code>sk-ant-admin01-…</code>. Serve un account con <b>Organizzazione</b> (Console → Settings → Organization): per gli account individuali l'Admin API non è disponibile.</li>
            <li>Su Vercel aggiungi la variabile d'ambiente <code>ANTHROPIC_ADMIN_KEY</code> con quella chiave e rideploya.</li>
          </ol>
        </div>
      </section>
    );
  }
  if (state.status === "error") {
    return (
      <section className="conc-tes">
        <h2>🪙 La Tesoreria</h2>
        <p className="conc-empty">Registri non raggiungibili: {state.msg}. {window.location.hostname === "localhost" ? "In locale l'endpoint /api non gira: guarda la pagina deployata su Vercel." : ""}</p>
      </section>
    );
  }

  const { days, totals } = state.data;
  const today = new Date().toISOString().slice(0, 10);
  const dToday = days.find((d) => d.date === today);

  // ── Finestra scelta (7 o 30 giorni): tutto è ricalcolato dai giorni ─────────
  const wdays = days.slice(-win);
  const winLabel = win === 7 ? "7 giorni" : "30 giorni";
  const blankComp = () => ({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
  const agg = wdays.reduce((a, d) => {
    a.tokensIn += d.tokensIn || 0;
    a.tokensOut += d.tokensOut || 0;
    a.cacheRead += d.cacheRead || 0;
    a.costCents += d.costCents || 0;
    if (d.comp) for (const k of Object.keys(a.comp)) a.comp[k] += d.comp[k] || 0;
    for (const [m, t] of Object.entries(d.models || {})) {
      if (!a.byModel[m]) a.byModel[m] = { in: 0, out: 0, cacheRead: 0, cache5m: 0, cache1h: 0, estCents: 0 };
      const x = a.byModel[m];
      x.in += t.in || 0; x.out += t.out || 0; x.cacheRead += t.cacheRead || 0;
      x.cache5m += t.cache5m || 0; x.cache1h += t.cache1h || 0; x.estCents += t.estCents || 0;
    }
    return a;
  }, { tokensIn: 0, tokensOut: 0, cacheRead: 0, costCents: 0, comp: blankComp(), byModel: {} });

  const maxCost = Math.max(1, ...wdays.map((d) => d.costCents || 0));
  const maxTok = Math.max(1, ...wdays.map((d) => (d.tokensIn || 0) + (d.tokensOut || 0)));
  const models = Object.entries(agg.byModel)
    .map(([m, t]) => ({ m, tok: t.in + t.out + t.cache5m + t.cache1h, ...t }))
    .sort((a, b) => b.estCents - a.estCents);
  const maxModelCents = Math.max(1, ...models.map((x) => x.estCents));

  const compTotal = COMP_META.reduce((s, c) => s + (agg.comp[c.key] || 0), 0) || 1;
  const pct = (v) => Math.round((v / compTotal) * 100);
  const compRows = COMP_META
    .map((c) => ({ ...c, cents: agg.comp[c.key] || 0 }))
    .sort((a, b) => b.cents - a.cents);
  const dateStep = win === 7 ? 1 : 5; // etichette asse: ogni giorno (7gg) o ogni 5 (30gg)

  return (
    <section className="conc-tes">
      <div className="conc-tes-toprow">
        <h2>🪙 La Tesoreria</h2>
        <div className="conc-tes-winsel" role="tablist" aria-label="Periodo">
          <button role="tab" aria-selected={win === 7}  className={win === 7 ? "on" : ""}  onClick={() => setWin(7)}>7 giorni</button>
          <button role="tab" aria-selected={win === 30} className={win === 30 ? "on" : ""} onClick={() => setWin(30)}>30 giorni</button>
        </div>
      </div>
      <p className="conc-tes-sub">Token e spesa delle chiamate API Claude — dai registri ufficiali Anthropic (ritardo ~5 minuti).</p>

      {/* Contatori del periodo scelto + oggi */}
      <div className="conc-tes-tiles">
        <div className="conc-tes-tile">
          <b>{fmtUsd(agg.costCents)}</b>
          <span>spesa {winLabel}{totals.costEstimated ? " (stima)" : ""}</span>
        </div>
        <div className="conc-tes-tile">
          <b>{fmtTok(agg.tokensIn + agg.tokensOut)}</b>
          <span>token {winLabel}</span>
        </div>
        <div className="conc-tes-tile">
          <b>{fmtUsd(dToday?.costCents)}</b>
          <span>spesa oggi</span>
        </div>
        <div className="conc-tes-tile">
          <b>{fmtTok((dToday?.tokensIn || 0) + (dToday?.tokensOut || 0))}</b>
          <span>token oggi</span>
        </div>
      </div>

      {/* COSA consuma i soldi: ripartizione per componente */}
      <div className="conc-tes-comp">
        <h3>Cosa consuma i soldi ({winLabel})</h3>
        <div className="conc-tes-compbar" title="Ripartizione stimata della spesa">
          {compRows.filter((c) => c.cents > 0).map((c) => (
            <i key={c.key} style={{ width: `${pct(c.cents)}%`, background: c.c }}
              title={`${c.label}: ${fmtUsd(c.cents)} (${pct(c.cents)}%)`} />
          ))}
        </div>
        <ul className="conc-tes-complist">
          {compRows.map((c) => (
            <li key={c.key}>
              <span className="conc-tes-compdot" style={{ background: c.c }} />
              <span className="conc-tes-compname">{c.label}</span>
              <span className="conc-tes-compdesc">{c.desc}</span>
              <b>{fmtUsd(c.cents)}</b>
              <span className="conc-tes-comppct">{pct(c.cents)}%</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="conc-tes-charts">
        {/* Spesa giornaliera */}
        <div className="conc-tes-chart">
          <h3>Spesa giornaliera (USD)</h3>
          <div className="conc-tes-bars">
            {wdays.map((d, i) => (
              <div key={d.date} className="conc-tes-col"
                title={`${d.date} — ${fmtUsd(d.costCents)}`}>
                <div className="conc-tes-stack">
                  <i style={{ height: `${Math.round(((d.costCents || 0) / maxCost) * 100)}%`, background: "var(--gold-deep)" }} />
                </div>
                <small>{i % dateStep === 0 || i === wdays.length - 1 ? d.date.slice(8) : ""}</small>
              </div>
            ))}
          </div>
        </div>

        {/* Token giornalieri: input + output impilati */}
        <div className="conc-tes-chart">
          <h3>Token al giorno</h3>
          <div className="conc-tes-legend">
            <span><i style={{ background: C_IN }} /> Input (incl. scrittura cache)</span>
            <span><i style={{ background: C_OUT }} /> Output</span>
          </div>
          <div className="conc-tes-bars">
            {wdays.map((d, i) => (
              <div key={d.date} className="conc-tes-col"
                title={`${d.date} — input ${fmtTok(d.tokensIn)} · output ${fmtTok(d.tokensOut)} · cache letta ${fmtTok(d.cacheRead)}`}>
                <div className="conc-tes-stack">
                  <i style={{ height: `${Math.round(((d.tokensOut || 0) / maxTok) * 100)}%`, background: C_OUT }} />
                  <i style={{ height: `${Math.round(((d.tokensIn || 0) / maxTok) * 100)}%`, background: C_IN }} />
                </div>
                <small>{i % dateStep === 0 || i === wdays.length - 1 ? d.date.slice(8) : ""}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ripartizione per modello */}
      {models.length > 0 && (
        <div className="conc-tes-models">
          <h3>Per modello ({winLabel})</h3>
          {models.map((x) => (
            <div key={x.m} className="conc-tes-model"
              title={`input ${fmtTok(x.in)} · output ${fmtTok(x.out)} · cache letta ${fmtTok(x.cacheRead)}`}>
              <code>{shortModel(x.m)}</code>
              <div className="conc-tes-model-bar">
                <i style={{ width: `${Math.max(2, Math.round((x.estCents / maxModelCents) * 100))}%` }} />
              </div>
              <span>{fmtTok(x.tok + x.cacheRead)} tok · ~{fmtUsd(x.estCents)}</span>
            </div>
          ))}
          <p className="conc-tes-note">
            La ripartizione per componente e per modello è stimata dal listino sui token consumati; il totale di spesa
            {totals.costEstimated ? " è anch'esso una stima (cost report non disponibile)." : " viene invece dal report di fatturazione Anthropic."}
          </p>
        </div>
      )}
    </section>
  );
}

export default function Concilio() {
  const { currentUser } = useAuth();
  const isMaster = isDmUser(currentUser?.email);

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

      {/* TESORERIA — token & spesa API Claude */}
      <TesoreriaClaude />

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
