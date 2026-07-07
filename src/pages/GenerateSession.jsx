import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { PARTIES, partyById, charactersOf } from "../data/parties";
import { loadPartyContext, streamGenerateSession, saveSession, readPartyRecap, loadWorldReference, ensureParties, loadSessions, deleteSession } from "../utils/dmSessions";
import { withSessionRuntime, sessionCompleteness } from "../utils/sessionRuntime";
import "./admin.css";

const DM_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];
const isDmUser = (email) => DM_EMAILS.includes(email);

const DURATIONS = ["2h", "2.30h", "3h", "3.30h", "4h"];

function toRoman(num) {
  const n = parseInt(num, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  const map = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let r = "", x = n;
  for (const [v, s] of map) while (x >= v) { r += s; x -= v; }
  return r;
}

export default function GenerateSession() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  // La stessa pagina serve sia /dm/generate-session (tab "nuova") sia
  // /sessions/:party (tab "archivio"): l'archivio è una scheda, non una pagina a sé.
  const { party: partyParam } = useParams();
  const initialParty = partyById(partyParam || "AMEA")?.id || "AMEA";

  const [tab, setTab] = useState(partyParam ? "archivio" : "nuova"); // "nuova" | "archivio"
  const [partyId, setPartyId] = useState(initialParty);
  const party = partyById(partyId);

  // ── Archivio sessioni generate (ex SessionsArchive) ──
  const [sessions, setSessions] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const [sessionNumber, setSessionNumber] = useState("");
  const [suggestedTitle, setSuggestedTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [durata, setDurata] = useState("3h");
  const [note, setNote] = useState("");
  const [involved, setInvolved] = useState(() => charactersOf("AMEA"));

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [generated, setGenerated] = useState(null); // { html, summary }
  const [saving, setSaving] = useState(false);

  const [recap, setRecap] = useState(null); // { recent: [...], topics: [...] }
  const [recapBusy, setRecapBusy] = useState(false);
  const [recapErr, setRecapErr] = useState("");
  const [selectedTopics, setSelectedTopics] = useState([]); // etichette dei fili da riprendere

  const chars = useMemo(() => charactersOf(partyId), [partyId]);

  // Carica l'archivio quando la scheda "Archivio" è attiva o cambia party.
  useEffect(() => {
    if (tab !== "archivio" || !isDmUser(currentUser?.email) || !party) return;
    let alive = true;
    (async () => {
      setArchiveLoading(true);
      setArchiveError("");
      try {
        await ensureParties(); // seed idempotente della config party
        const list = await loadSessions(party.id);
        if (alive) setSessions(list);
      } catch (e) {
        if (alive) setArchiveError(e.message || String(e));
      } finally {
        if (alive) setArchiveLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tab, partyId, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteSession = async (e, s) => {
    e.preventDefault();
    e.stopPropagation();
    if (deletingId) return;
    const ok = window.confirm(
      `Eliminare definitivamente la Sessione #${s.sessionNumber}` +
      `${s.title ? ` — "${s.title}"` : ""} di ${party.id}?`
    );
    if (!ok) return;
    setDeletingId(s.id);
    try {
      await deleteSession(party.id, s.sessionNumber);
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
    } catch (err) {
      setArchiveError(err.message || String(err));
    } finally {
      setDeletingId(null);
    }
  };

  const pickParty = (id) => {
    setPartyId(id);
    setInvolved(charactersOf(id)); // di default tutti i PG del gruppo
    setGenerated(null);
    setStatus("");
    setRecap(null);
    setRecapErr("");
    setSelectedTopics([]);
  };

  const handleReadRecap = async () => {
    if (recapBusy) return;
    setRecapBusy(true);
    setRecapErr("");
    setRecap(null);
    setSelectedTopics([]);
    try {
      const r = await readPartyRecap(party.id);
      if (r.recent.length === 0 && r.topics.length === 0) {
        setRecapErr("Nessun riassunto registrato per questo gruppo.");
      } else {
        setRecap(r);
      }
    } catch (err) {
      setRecapErr(err.message || String(err));
    } finally {
      setRecapBusy(false);
    }
  };

  const toggleTopic = (label) =>
    setSelectedTopics((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const toggleChar = (name) =>
    setInvolved((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!sessionNumber) { setStatus("❌ Inserisci il numero della sessione."); return; }
    setBusy(true);
    setGenerated(null);
    setProgress(0);
    setStatus("📚 Raccolgo il contesto del party…");
    try {
      // Template grafico [A] — caricato solo qui (chunk separato).
      const templateHtml = (await import("../../reference_sessions/sessione_20.html?raw")).default;
      // Contesto narrativo [B] + riferimento mondo [C] (città + NPC esistenti).
      const [ctx, world] = await Promise.all([
        loadPartyContext(party.id),
        loadWorldReference(),
      ]);

      setStatus("✍️ Genero la sessione… può richiedere 1–3 minuti, attendi senza ricaricare.");
      const payload = {
        party: party.id,
        world: party.world,
        groupCharacters: party.characters,
        closingChronicle: party.closingChronicle,
        sessionNumber: Number(sessionNumber),
        suggestedTitle,
        focus,
        involvedCharacters: involved,
        durata,
        note,
        templateHtml,
        pastSummaries: ctx.pastSummaries,
        lastSessionHtml: ctx.lastSessionHtml,
        // Fili scelti dai chip "Fili della campagna": vanno reintrodotti in modo sensato.
        resumeThreads: (recap?.topics || [])
          .filter((t) => selectedTopics.includes(t.label))
          .map((t) => ({ label: t.label, note: t.note })),
        // [C] Mondo esistente: città (Geo) + NPC per riuso e precisione.
        worldCities: world.cities,
        worldNpcs: world.npcs,
      };

      const result = await streamGenerateSession(payload, (_chunk, full) => setProgress(full.length));
      if (!result.html || !result.html.includes("<")) throw new Error("Output non valido (nessun HTML).");
      setGenerated(result);
      const comp = sessionCompleteness(result.html);
      if (!comp.complete) {
        setStatus(`⚠️ Generazione probabilmente TRONCATA (${comp.panes}/${comp.tabs || "?"} sezioni con contenuto). Meglio rigenerare, magari con durata più corta.`);
      } else {
        setStatus("✅ Sessione generata. Controlla l'anteprima e salva.");
      }
    } catch (err) {
      setStatus(`❌ ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!generated || saving) return;
    setSaving(true);
    try {
      await saveSession({
        party: party.id,
        sessionNumber: Number(sessionNumber),
        title: suggestedTitle || generated.summary?.titolo || `Sessione ${toRoman(sessionNumber)}`,
        htmlContent: generated.html,
        summary: generated.summary,
        durata,
      });
      navigate(`/sessions/${party.id.toLowerCase()}/${Number(sessionNumber)}`);
    } catch (err) {
      setStatus(`❌ Salvataggio fallito: ${err.message || err}`);
      setSaving(false);
    }
  };

  if (!isDmUser(currentUser?.email)) {
    return <p style={{ textAlign: "center", paddingTop: 100 }}>Accesso negato: solo DM.</p>;
  }

  return (
    <section className="admin-summary-page sumadm">
      <Link to="/dm-admin/strumenti" className="adm-back">← Strumenti DM</Link>

      <header className="sumadm-hero">
        <div className="sumadm-hero-titles">
          <span className="adm-eyebrow">🎲 Strumento DM · privato</span>
          <h1 className="sumadm-title">Generatore di Sessioni</h1>
          <p className="sumadm-sub">Genera la prep di una sessione nello stile delle Cronache, e sfoglia l'archivio — per party.</p>
        </div>
      </header>

      {/* Schede: Nuova sessione · Archivio */}
      <div className="sumadm-filter-tabs" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className={`sumadm-filter ${tab === "nuova" ? "on" : ""}`}
          onClick={() => setTab("nuova")}
          style={tab === "nuova" ? { background: "#8a6212", borderColor: "#8a6212", color: "#fff" } : { borderColor: "#8a6212", color: "#8a6212" }}
        >
          ✨ Nuova sessione
        </button>
        <button
          type="button"
          className={`sumadm-filter ${tab === "archivio" ? "on" : ""}`}
          onClick={() => setTab("archivio")}
          style={tab === "archivio" ? { background: "#8a6212", borderColor: "#8a6212", color: "#fff" } : { borderColor: "#8a6212", color: "#8a6212" }}
        >
          📖 Archivio {sessions.length > 0 && tab === "archivio" ? `(${sessions.length})` : ""}
        </button>
      </div>

      {/* Selettore party */}
      <div className="sumadm-filter-tabs" style={{ marginBottom: 18 }}>
        {PARTIES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`sumadm-filter ${p.id === partyId ? "on" : ""}`}
            onClick={() => pickParty(p.id)}
            style={p.id === partyId
              ? { background: p.color, borderColor: p.color, color: "#fff" }
              : { borderColor: p.color, color: p.color }}
          >
            {p.id} · {p.world}
          </button>
        ))}
      </div>

      {tab === "nuova" && (<>
      {/* Leggi i riassunti del gruppo → fast recap + fili cliccabili */}
      <div className="sumadm-recap">
        <div className="sumadm-recap-head">
          <div>
            <strong>📖 Cosa è successo finora · {party.name}</strong>
            <small> — recap veloce delle ultime 3 sessioni + fili da riprendere</small>
          </div>
          <button type="button" className="sumadm-btn ghost" onClick={handleReadRecap} disabled={recapBusy}>
            {recapBusy ? "⏳ Leggo i riassunti…" : recap ? "🔄 Rileggi" : "📖 Leggi"}
          </button>
        </div>

        {recapErr && <p className="sumadm-recap-empty">{recapErr}</p>}

        {recap && recap.recent.length > 0 && (
          <ol className="sumadm-recap-list">
            {recap.recent.map((it, i) => (
              <li key={`${it.sessionNumber ?? i}`} className="sumadm-recap-item">
                <div className="sumadm-recap-sess">
                  Sessione {it.sessionNumber ?? "?"}{it.title ? ` · ${it.title}` : ""}
                </div>
                <ul>
                  {it.bullets.map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        )}

        {recap && recap.topics.length > 0 && (
          <div className="sumadm-topics">
            <div className="sumadm-topics-lead">
              🧵 <strong>Fili della campagna</strong> — clicca quelli che vuoi far tornare in questa sessione
            </div>
            <div className="sumadm-topics-chips">
              {recap.topics.map((t) => {
                const on = selectedTopics.includes(t.label);
                return (
                  <button
                    key={t.label}
                    type="button"
                    title={t.note || ""}
                    className={`sumadm-chip ${on ? "on" : ""}`}
                    onClick={() => toggleTopic(t.label)}
                    style={on ? { background: party.color, borderColor: party.color, color: "#fff" } : { borderColor: party.color, color: party.color }}
                  >
                    {on ? "✓ " : ""}{t.label}
                  </button>
                );
              })}
            </div>
            {selectedTopics.length > 0 && (
              <p className="sumadm-topics-hint">
                {selectedTopics.length} filo/i verranno reintrodotti nella sessione generata.
              </p>
            )}
          </div>
        )}
      </div>

      {status && (
        <div className={status.startsWith("✅") ? "admin-status-ok" : status.startsWith("❌") ? "admin-status-err" : "admin-status-ok"}>
          {status}{busy && progress ? ` (${progress.toLocaleString()} caratteri)` : ""}
        </div>
      )}

      <div className="sumadm-workshop">
        {/* FORM */}
        <section className="sumadm-card">
          <div className="sumadm-card-head"><h2>✨ Nuova sessione · {party.name}</h2></div>
          <form onSubmit={handleGenerate} className="sumadm-form">
            <div className="sumadm-row3">
              <div className="sumadm-field">
                <label>Numero sessione {sessionNumber && <small>({toRoman(sessionNumber)})</small>}</label>
                <input className="admin-field-input" type="number" min="1" value={sessionNumber}
                  onChange={(e) => setSessionNumber(e.target.value)} placeholder="21" required />
              </div>
              <div className="sumadm-field">
                <label>Durata prevista</label>
                <select className="admin-field-select" value={durata} onChange={(e) => setDurata(e.target.value)}>
                  {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="sumadm-field">
                <label>Titolo suggerito (opz.)</label>
                <input className="admin-field-input" value={suggestedTitle}
                  onChange={(e) => setSuggestedTitle(e.target.value)} placeholder="(lo sceglie Claude se vuoto)" />
              </div>
            </div>

            <div className="sumadm-field">
              <label>Personaggi coinvolti</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {chars.map((c) => (
                  <label key={c} className={`sumadm-filter ${involved.includes(c) ? "on" : ""}`}
                    style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                      ...(involved.includes(c) ? { background: party.color, borderColor: party.color, color: "#fff" } : { borderColor: party.color, color: party.color }) }}>
                    <input type="checkbox" checked={involved.includes(c)} onChange={() => toggleChar(c)} style={{ accentColor: party.color }} />
                    {c}
                  </label>
                ))}
              </div>
            </div>

            <div className="sumadm-field">
              <label>Focus della sessione — cosa deve succedere</label>
              <textarea className="admin-field-textarea" rows="6" value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="Es. Il party raggiunge Tirrendale e cerca il sigillo nella vecchia torre del fiume…" required />
            </div>

            <div className="sumadm-field">
              <label>Note aggiuntive (opz.)</label>
              <textarea className="admin-field-textarea" rows="3" value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Vincoli, NPC da includere, tono, combattimenti voluti…" />
            </div>

            <div className="sumadm-actions">
              <button type="submit" disabled={busy} className="sumadm-btn primary">
                {busy ? "⏳ Genero…" : "🪄 Genera sessione"}
              </button>
            </div>
          </form>
        </section>

        {/* ANTEPRIMA */}
        <aside className="sumadm-preview">
          <div className="sumadm-card-head">
            <h2>👁 Anteprima</h2>
            {generated && <small>Sessione {toRoman(sessionNumber)} · {party.id}</small>}
          </div>
          {!generated ? (
            <p className="sumadm-empty">
              {busy ? "Generazione in corso…" : "L'anteprima della sessione apparirà qui dopo la generazione."}
            </p>
          ) : (
            <>
              <iframe
                title="Anteprima sessione"
                srcDoc={withSessionRuntime(generated.html)}
                sandbox="allow-scripts allow-popups"
                style={{ width: "100%", height: "70vh", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 12, background: "#050807" }}
              />
              <div className="sumadm-actions" style={{ marginTop: 14 }}>
                <button className="sumadm-btn primary" onClick={handleSave} disabled={saving}>
                  {saving ? "💾 Salvo…" : "💾 Salva sessione"}
                </button>
                <button className="sumadm-btn ghost" onClick={() => setGenerated(null)} disabled={saving}>
                  Scarta
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
      </>)}

      {/* ── ARCHIVIO — sessioni generate del gruppo selezionato ── */}
      {tab === "archivio" && (
        <>
          {archiveError && <div className="admin-status-err">❌ {archiveError}</div>}
          {archiveLoading ? (
            <p className="sumadm-empty">Caricamento sessioni…</p>
          ) : sessions.length === 0 ? (
            <p className="sumadm-empty">
              Nessuna sessione archiviata per {party.id}. Generane una dalla scheda{" "}
              <button type="button" className="sumadm-btn ghost" onClick={() => setTab("nuova")}>✨ Nuova sessione</button>.
            </p>
          ) : (
            <div className="sumadm-grid">
              {sessions.map((s) => (
                <Link
                  key={s.id}
                  to={`/sessions/${party.id.toLowerCase()}/${s.sessionNumber}`}
                  className="sumadm-item"
                  style={{ "--party-color": party.color, textDecoration: "none", position: "relative" }}
                >
                  <button
                    type="button"
                    title={`Elimina Sessione #${s.sessionNumber}`}
                    aria-label={`Elimina Sessione #${s.sessionNumber}`}
                    onClick={(e) => handleDeleteSession(e, s)}
                    disabled={deletingId === s.id}
                    style={{
                      position: "absolute", top: 10, right: 10, zIndex: 2,
                      background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.18)",
                      borderRadius: 8, padding: "4px 8px", cursor: "pointer",
                      fontSize: "0.9rem", lineHeight: 1,
                      opacity: deletingId === s.id ? 0.5 : 1,
                    }}
                  >
                    {deletingId === s.id ? "…" : "🗑"}
                  </button>
                  <div className="sumadm-item-body">
                    <span className="sumadm-item-order">#{s.sessionNumber}</span>
                    <h4 className="sumadm-item-title">{s.title || "(senza titolo)"}</h4>
                    {s.summary?.panoramica && (
                      <p className="sumadm-item-snippet">
                        {String(s.summary.panoramica).slice(0, 120)}
                        {String(s.summary.panoramica).length > 120 ? "…" : ""}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
