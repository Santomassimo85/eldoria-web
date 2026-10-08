import React, { useEffect, useMemo, useState } from "react";
import { isAdminEmail } from "../utils/roles";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { PARTIES, partyById, charactersOf } from "../data/parties";
import { loadSessionContext, requestSessionDraft, streamGenerateSession, saveSession, readPartyRecap, loadWorldReference, ensureParties, loadSessions, deleteSession, loadLoreRegistry, linkifySessionHtml, saveAutosave, loadAutosave, clearAutosave } from "../utils/dmSessions";
import { pickWorld, trimRecapsForDraft, trimRecapsForSession } from "../utils/sessionWorld";
import { withSessionRuntime, sessionCompleteness } from "../utils/sessionRuntime";
import "./admin.css";
import "./GenerateSession.css";
import SessionLorePopup from "../components/LorePopup";

// Master + co-master (Makenna): stesso elenco di roles.js, confronto senza maiuscole.
const isDmUser = isAdminEmail;

const DURATIONS = ["2h", "2.30h", "3h", "3.30h", "4h"];

function toRoman(num) {
  const n = parseInt(num, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  const map = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let r = "", x = n;
  for (const [v, s] of map) while (x >= v) { r += s; x -= v; }
  return r;
}

// Cosa ha letto il generatore, in breve (per la riga sotto il form).
const infoOf = (ctx) => ({
  recaps: ctx.recaps.length,
  lastTitle: ctx.recaps[ctx.recaps.length - 1]?.title || "",
  preps: ctx.preps.length,
});

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

  // ── Bozza: prima la scaletta, poi (se il DM accetta) la sessione completa ──
  const [draft, setDraft] = useState(null);          // scaletta proposta (JSON)
  const [draftBusy, setDraftBusy] = useState(false);
  const [redoOpen, setRedoOpen] = useState(false);   // riquadro "Rifai" con le indicazioni
  const [draftTips, setDraftTips] = useState("");
  const [ctxInfo, setCtxInfo] = useState(null);      // { recaps, lastTitle, preps } = cosa ha letto
  const [autosave, setAutosave] = useState(null);    // bozza/sessione generata e non ancora salvata

  const chars = useMemo(() => charactersOf(partyId), [partyId]);

  // Bozza/sessione generata e non salvata di questo gruppo (salvataggio automatico).
  useEffect(() => {
    if (tab !== "nuova" || !isDmUser(currentUser?.email) || !party) return;
    let alive = true;
    loadAutosave(party.id).then((a) => { if (alive) setAutosave(a); }).catch(() => {});
    return () => { alive = false; };
  }, [tab, partyId, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cosa salvare in automatico: il form + bozza + sessione generata.
  const autosaveNow = (patch) => {
    const data = { sessionNumber: Number(sessionNumber) || 0, durata, focus, note, suggestedTitle, involved, draft: null, generated: null, ...patch };
    setAutosave(data);
    saveAutosave(party.id, data).catch((e) => console.warn("[autosave]", e));
  };

  const restoreAutosave = () => {
    const a = autosave;
    if (!a) return;
    if (a.sessionNumber) setSessionNumber(String(a.sessionNumber));
    if (a.durata) setDurata(a.durata);
    setFocus(a.focus || "");
    setNote(a.note || "");
    setSuggestedTitle(a.suggestedTitle || "");
    if (Array.isArray(a.involved) && a.involved.length) setInvolved(a.involved);
    setDraft(a.draft || null);
    setGenerated(a.generated || null);
    setStatus(a.generated ? "↩ Sessione ripresa dal salvataggio automatico: controlla e salva." : "↩ Bozza ripresa dal salvataggio automatico.");
  };

  const discardAutosave = async () => {
    if (!window.confirm("Scartare definitivamente la bozza/sessione non salvata?")) return;
    await clearAutosave(party.id).catch(() => {});
    setAutosave(null);
  };

  // Scheda "nuova": legge subito i riassunti del gruppo per dire cosa vede il
  // generatore e proporre il numero della prossima sessione (riassunti + 1).
  useEffect(() => {
    if (tab !== "nuova" || !isDmUser(currentUser?.email) || !party) return;
    let alive = true;
    loadSessionContext(party.id).then((ctx) => {
      if (!alive) return;
      setCtxInfo(infoOf(ctx));
      setSessionNumber((cur) => cur || String(Math.max(ctx.recaps.length, ctx.lastPrepNumber) + 1));
    }).catch(() => {});
    return () => { alive = false; };
  }, [tab, partyId, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setDraft(null);
    setRedoOpen(false);
    setDraftTips("");
    setCtxInfo(null);
    setSessionNumber(""); // lo ripropone l'effetto, dai riassunti del nuovo gruppo
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

  // Contesto riletto a OGNI richiesta: riassunti veri + prep + mondo.
  // Contesto riletto a OGNI richiesta, ma SNELLO (pochi token):
  //  - bozza: ultimi 3 riassunti per esteso, 5 in breve, i vecchi solo titolo;
  //  - sessione: la bozza approvata ha già la continuità → solo l'ultimo riassunto;
  //  - mondo: per intero solo luoghi/NPC citati, gli altri solo come nomi.
  const collectPayload = async (mode = "draft", extraText = "") => {
    const [ctx, world] = await Promise.all([loadSessionContext(party.id), loadWorldReference()]);
    setCtxInfo(infoOf(ctx));
    // Fili scelti dai chip "Fili della campagna": vanno reintrodotti in modo sensato.
    const resumeThreads = (recap?.topics || [])
      .filter((t) => selectedTopics.includes(t.label))
      .map((t) => ({ label: t.label, note: t.note }));
    const lastRecap = ctx.recaps[ctx.recaps.length - 1]?.text || "";
    const relevant = [focus, note, suggestedTitle, involved.join(" "), resumeThreads.map((t) => `${t.label} ${t.note || ""}`).join(" "), lastRecap, extraText].join("\n");
    const isSession = mode === "session";
    return {
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
      recaps: isSession ? trimRecapsForSession(ctx.recaps) : trimRecapsForDraft(ctx.recaps),
      preps: isSession ? [] : ctx.preps.slice(-3),
      lastPrepText: isSession ? "" : ctx.lastPrepText,
      resumeThreads,
      ...pickWorld(world, relevant),
    };
  };

  const fmtUsage = (u) => (u && (u.input || u.output) ? ` · ${(u.input || 0).toLocaleString("it-IT")} token letti, ${(u.output || 0).toLocaleString("it-IT")} scritti` : "");

  // 1) Bozza: la scaletta di come vuole scrivere la sessione.
  //    Con `tips` è un "Rifai": riceve la bozza scartata + le indicazioni.
  const handleDraft = async (e, tips) => {
    e?.preventDefault?.();
    if (busy || draftBusy) return;
    if (!sessionNumber) { setStatus("❌ Inserisci il numero della sessione."); return; }
    if (!focus.trim()) { setStatus("❌ Scrivi il focus: cosa deve succedere."); return; }
    const previous = tips != null ? draft : null;
    setDraftBusy(true);
    setGenerated(null);
    setStatus("📚 Rileggo i riassunti del gruppo…");
    try {
      const payload = await collectPayload("draft", previous ? JSON.stringify(previous) : "");
      setStatus(previous ? "✍️ Rifaccio la bozza con le tue indicazioni…" : "✍️ Preparo la bozza… (di solito meno di un minuto)");
      const { draft: d, usage } = await requestSessionDraft({
        ...payload,
        ...(previous ? { previousDraft: previous, draftFeedback: tips } : {}),
      });
      setDraft(d);
      autosaveNow({ draft: d });
      setRedoOpen(false);
      setDraftTips("");
      setStatus(`📝 Bozza pronta: accettala, rifalla o chiudila${fmtUsage(usage)}.`);
    } catch (err) {
      setStatus(`❌ Bozza non riuscita: ${err.message || err}`);
    } finally {
      setDraftBusy(false);
    }
  };

  const closeDraft = () => {
    setDraft(null); setRedoOpen(false); setDraftTips(""); setStatus("");
    clearAutosave(party.id).catch(() => {}); setAutosave(null);
  };

  // 2) Sessione completa, sulla bozza approvata.
  const handleGenerate = async () => {
    if (busy || !draft) return;
    setBusy(true);
    setGenerated(null);
    setProgress(0);
    setStatus("📚 Rileggo i riassunti del gruppo…");
    try {
      const [payload, registry] = await Promise.all([
        collectPayload("session", JSON.stringify(draft)),
        loadLoreRegistry().catch(() => null),
      ]);
      setStatus("✍️ Scrivo la sessione dalla bozza approvata… di solito 1–2 minuti, attendi senza ricaricare.");
      const result = await streamGenerateSession({ ...payload, approvedDraft: draft }, (_chunk, full) => setProgress(full.length));
      if (!result.html || !result.html.includes("<")) throw new Error("Output non valido (nessun HTML).");
      // Nomi di PG, NPC e luoghi → link colorati alle loro schede (gratis: niente token).
      result.html = linkifySessionHtml(result.html, registry);
      setGenerated(result);
      autosaveNow({ draft, generated: { html: result.html, summary: result.summary || null, warning: result.warning || "" } });
      const comp = sessionCompleteness(result.html);
      if (!comp.complete || result.warning) {
        setStatus(`⚠️ Generazione probabilmente TRONCATA${result.warning ? ` — ${result.warning}` : ""}. Meglio rigenerare, magari con durata più corta.`);
      } else {
        setStatus(`✅ Sessione scritta. Controlla l'anteprima e salva${fmtUsage(result.usage)}.`);
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
        title: suggestedTitle || draft?.titolo || generated.summary?.titolo || `Sessione ${toRoman(sessionNumber)}`,
        htmlContent: generated.html,
        summary: generated.summary,
        durata,
      });
      await clearAutosave(party.id).catch(() => {}); // salvata davvero: il salvataggio automatico non serve più
      navigate(`/sessions/${party.id.toLowerCase()}/${Number(sessionNumber)}`);
    } catch (err) {
      setStatus(`❌ Salvataggio fallito: ${err.message || err}`);
      setSaving(false);
    }
  };

  if (!isDmUser(currentUser?.email)) {
    return <p style={{ textAlign: "center", paddingTop: 100 }}>Accesso negato: solo DM.</p>;
  }

  // Il co-master non ha accesso alla Console del Master (/dm-admin): per lui il
  // back-link torna alla home invece di finire su una pagina "Accesso negato".
  const isPrimaryMaster = isAdminEmail(currentUser?.email);
  const backTo = isPrimaryMaster ? "/dm-admin" : "/";
  const backLabel = isPrimaryMaster ? "← Console del Master" : "← Torna alla home";

  return (
    <section className="admin-summary-page sumadm">
      <Link to={backTo} className="adm-back">{backLabel}</Link>

      <header className="sumadm-hero">
        <div className="sumadm-hero-titles">
          <span className="adm-eyebrow">🎲 Strumento DM · privato</span>
          <h1 className="sumadm-title">Generatore di Sessioni</h1>
          <p className="sumadm-sub">Genera la prep di una sessione nello stile delle Cronache, e sfoglia l'archivio — per party.</p>
        </div>
      </header>

      {/* Schede: Nuova sessione · Archivio — due "lame" del Covo, grandi e col sottotitolo.
          Bottoni con aria-pressed (NON role="tab": covo.css ci metterebbe le rune). */}
      <div className="gs-modes" role="group" aria-label="Nuova sessione o archivio">
        <button type="button" className={`gs-mode${tab === "nuova" ? " on" : ""}`} aria-pressed={tab === "nuova"} onClick={() => setTab("nuova")}>
          <span className="gs-mode-icon" aria-hidden="true">✒</span>
          <span className="gs-mode-text">
            <span className="gs-mode-title">Nuova sessione</span>
            <span className="gs-mode-sub">Bozza → sessione, dai riassunti del gruppo</span>
          </span>
        </button>
        <button type="button" className={`gs-mode${tab === "archivio" ? " on" : ""}`} aria-pressed={tab === "archivio"} onClick={() => setTab("archivio")}>
          <span className="gs-mode-icon" aria-hidden="true">📜</span>
          <span className="gs-mode-text">
            <span className="gs-mode-title">Archivio{sessions.length > 0 && tab === "archivio" ? ` · ${sessions.length}` : ""}</span>
            <span className="gs-mode-sub">Le sessioni salvate di {party.id}</span>
          </span>
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

      {/* Salvataggio automatico: bozza/sessione generata e non ancora salvata */}
      {autosave && (autosave.draft || autosave.generated) && !draft && !generated && (
        <div className="gs-autosave">
          <span>
            💾 C'è {autosave.generated ? "una sessione generata" : "una bozza"} non salvata di {party.id}
            {autosave.draft?.titolo ? <>: <b>«{autosave.draft.titolo}»</b></> : null}
            {autosave.sessionNumber ? ` · Sessione ${autosave.sessionNumber}` : ""}
            {autosave.savedAt?.toDate ? ` · ${autosave.savedAt.toDate().toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}` : ""}
          </span>
          <span className="gs-autosave-actions">
            <button type="button" className="sumadm-btn primary" onClick={restoreAutosave}>↩ Riprendi</button>
            <button type="button" className="sumadm-btn ghost" onClick={discardAutosave}>Scarta</button>
          </span>
        </div>
      )}

      {status && (
        <div className={status.startsWith("✅") ? "admin-status-ok" : status.startsWith("❌") ? "admin-status-err" : "admin-status-ok"}>
          {status}{busy && progress ? ` (${progress.toLocaleString()} caratteri)` : ""}
        </div>
      )}

      <div className="sumadm-workshop">
        {/* FORM */}
        <section className="sumadm-card">
          <div className="sumadm-card-head"><h2>✨ Nuova sessione · {party.name}</h2></div>
          <form onSubmit={handleDraft} className="sumadm-form">
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

            {ctxInfo && (
              <p className="gs-ctx-info">
                📚 Legge {ctxInfo.recaps} riassunt{ctxInfo.recaps === 1 ? "o" : "i"} di {party.id}
                {ctxInfo.lastTitle ? <> · ultimo: <b>«{ctxInfo.lastTitle}»</b></> : null}
                {ctxInfo.preps ? ` · ${ctxInfo.preps} prep precedent${ctxInfo.preps === 1 ? "e" : "i"}` : ""} — più luoghi e NPC dell'Atlante. Li rilegge a ogni richiesta.
              </p>
            )}

            <div className="sumadm-actions">
              <button type="submit" disabled={busy || draftBusy} className="sumadm-btn primary">
                {draftBusy ? "⏳ Preparo la bozza…" : draft ? "📝 Nuova bozza da capo" : "📝 Proponi la bozza"}
              </button>
            </div>
            <small className="gs-flow-hint">Prima ti propone la scaletta: la sessione completa la scrive solo quando la accetti.</small>
          </form>
        </section>

        {/* ANTEPRIMA */}
        <aside className="sumadm-preview">
          <div className="sumadm-card-head">
            <h2>👁 Anteprima</h2>
            {generated && <small>Sessione {toRoman(sessionNumber)} · {party.id}</small>}
          </div>
          {!generated && draft ? (
            <DraftCard
              draft={draft}
              party={party}
              busy={busy}
              draftBusy={draftBusy}
              redoOpen={redoOpen}
              setRedoOpen={setRedoOpen}
              tips={draftTips}
              setTips={setDraftTips}
              onAccept={handleGenerate}
              onRedo={() => handleDraft(null, draftTips.trim())}
              onClose={closeDraft}
            />
          ) : !generated ? (
            <p className="sumadm-empty">
              {draftBusy ? "Sto preparando la bozza…" : "Qui comparirà la bozza: la scaletta di come vuole scrivere la sessione. Poi, se la accetti, l'anteprima della sessione."}
            </p>
          ) : (
            <>
              <iframe
                title="Anteprima sessione"
                srcDoc={withSessionRuntime(generated.html)}
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                style={{ width: "100%", height: "70vh", border: "1px solid rgba(var(--oro-rgb),0.4)", borderRadius: 12, background: "#050807" }}
              />
              <div className="sumadm-actions" style={{ marginTop: 14 }}>
                <button className="sumadm-btn primary" onClick={handleSave} disabled={saving}>
                  {saving ? "💾 Salvo…" : "💾 Salva sessione"}
                </button>
                <button className="sumadm-btn ghost" onClick={() => setGenerated(null)} disabled={saving}>
                  {draft ? "↩ Torna alla bozza" : "Scarta"}
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
      {/* Clic sui link di PG/NPC/luoghi nell'anteprima → popup qui, senza cambiare pagina */}
      <SessionLorePopup />
    </section>
  );
}

// ── Bozza della sessione: scaletta + Accetta / Rifai (con indicazioni) / Chiudi ──
function DraftCard({ draft, party, busy, draftBusy, redoOpen, setRedoOpen, tips, setTips, onAccept, onRedo, onClose }) {
  const atti = Array.isArray(draft.atti) ? draft.atti : [];
  const fili = (Array.isArray(draft.fili) ? draft.fili : []).filter((f) => f && (f.filo || f.come));
  const dubbi = (Array.isArray(draft.dubbi) ? draft.dubbi : []).filter(Boolean);
  const locked = busy || draftBusy;
  return (
    <div className="gs-draft" style={{ "--party-color": party.color }}>
      <span className="gs-draft-kicker">📝 Bozza · come vuole scriverla</span>
      <h3 className="gs-draft-title">{draft.titolo || "Senza titolo"}</h3>
      {draft.sottotitolo && <p className="gs-draft-sub">{draft.sottotitolo}</p>}
      {draft.logline && <p className="gs-draft-logline">{draft.logline}</p>}
      {draft.ripartenza && (
        <p className="gs-draft-row"><b>↪ Si riparte da</b> {draft.ripartenza}</p>
      )}

      <ol className="gs-draft-acts">
        {atti.map((a, i) => (
          <li key={i} className="gs-draft-act">
            <div className="gs-draft-act-head">
              <span className="gs-draft-act-n">Atto {i + 1}</span>
              <strong>{a.titolo}</strong>
              {a.luogo && <span className="gs-draft-place">📍 {a.luogo}</span>}
            </div>
            {a.sintesi && <p>{a.sintesi}</p>}
            {Array.isArray(a.scene) && a.scene.filter(Boolean).length > 0 && (
              <ul>{a.scene.filter(Boolean).map((sc, j) => <li key={j}>{sc}</li>)}</ul>
            )}
            {a.scontro && <p className="gs-draft-fight">⚔ {a.scontro}</p>}
            {Array.isArray(a.npc) && a.npc.filter(Boolean).length > 0 && (
              <p className="gs-draft-npc">👤 {a.npc.filter(Boolean).join(" · ")}</p>
            )}
          </li>
        ))}
      </ol>

      {fili.length > 0 && (
        <div className="gs-draft-block">
          <b>🧵 Fili ripresi</b>
          <ul>{fili.map((f, i) => <li key={i}><b>{f.filo}</b>{f.come ? ` — ${f.come}` : ""}</li>)}</ul>
        </div>
      )}
      {draft.colpoDiScena && <p className="gs-draft-row"><b>⚡ Colpo di scena</b> {draft.colpoDiScena}</p>}
      {draft.bottino && <p className="gs-draft-row"><b>💰 Bottino</b> {draft.bottino}</p>}
      {draft.finale && <p className="gs-draft-row"><b>🎬 Finale</b> {draft.finale}</p>}
      {dubbi.length > 0 && (
        <div className="gs-draft-block gs-draft-questions">
          <b>❓ Domande per te</b>
          <ul>{dubbi.map((q, i) => <li key={i}>{q}</li>)}</ul>
          <small>Rispondi con "Rifai" e scrivi le risposte nelle indicazioni.</small>
        </div>
      )}

      {redoOpen && (
        <div className="gs-draft-redo">
          <label htmlFor="gs-tips">Cosa cambiare? (opzionale)</label>
          <textarea
            id="gs-tips"
            className="admin-field-textarea"
            rows="4"
            value={tips}
            onChange={(e) => setTips(e.target.value)}
            placeholder="Es. niente combattimento nell'atto 2, fai tornare il Corvo prima, il finale più cupo…"
            autoFocus
          />
        </div>
      )}

      <div className="gs-draft-actions">
        {!redoOpen ? (<>
          <button type="button" className="sumadm-btn primary" onClick={onAccept} disabled={locked}>
            {busy ? "⏳ Scrivo la sessione…" : "✅ Accetta e scrivi la sessione"}
          </button>
          <button type="button" className="sumadm-btn ghost" onClick={() => setRedoOpen(true)} disabled={locked}>🔁 Rifai</button>
          <button type="button" className="sumadm-btn ghost" onClick={onClose} disabled={locked}>✖ Chiudi</button>
        </>) : (<>
          <button type="button" className="sumadm-btn primary" onClick={onRedo} disabled={locked}>
            {draftBusy ? "⏳ Rifaccio…" : tips.trim() ? "🔁 Rifai con queste indicazioni" : "🔁 Rifai (taglio diverso)"}
          </button>
          <button type="button" className="sumadm-btn ghost" onClick={() => setRedoOpen(false)} disabled={locked}>Annulla</button>
        </>)}
      </div>
    </div>
  );
}
