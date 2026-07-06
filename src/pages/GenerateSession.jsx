import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { PARTIES, partyById, charactersOf } from "../data/parties";
import { loadPartyContext, streamGenerateSession, saveSession, readPartyRecap } from "../utils/dmSessions";
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

  const [partyId, setPartyId] = useState("AMEA");
  const party = partyById(partyId);

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

  const [recap, setRecap] = useState(null); // [{ sessionNumber, title, bullets }]
  const [recapBusy, setRecapBusy] = useState(false);
  const [recapErr, setRecapErr] = useState("");

  const chars = useMemo(() => charactersOf(partyId), [partyId]);

  const pickParty = (id) => {
    setPartyId(id);
    setInvolved(charactersOf(id)); // di default tutti i PG del gruppo
    setGenerated(null);
    setStatus("");
    setRecap(null);
    setRecapErr("");
  };

  const handleReadRecap = async () => {
    if (recapBusy) return;
    setRecapBusy(true);
    setRecapErr("");
    setRecap(null);
    try {
      const r = await readPartyRecap(party.id);
      if (r.length === 0) setRecapErr("Nessun riassunto registrato per questo gruppo.");
      else setRecap(r);
    } catch (err) {
      setRecapErr(err.message || String(err));
    } finally {
      setRecapBusy(false);
    }
  };

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
      // Contesto narrativo [B].
      const ctx = await loadPartyContext(party.id);

      setStatus("✍️ Genero la sessione (streaming)…");
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

  // Il co-master non ha accesso alla Console del Master (/dm-admin): per lui il
  // back-link torna alla home invece di finire su una pagina "Accesso negato".
  const isPrimaryMaster = currentUser?.email === "santomassimo85@gmail.com";
  const backTo = isPrimaryMaster ? "/dm-admin" : "/";
  const backLabel = isPrimaryMaster ? "← Console del Master" : "← Torna alla home";

  return (
    <section className="admin-summary-page sumadm">
      <Link to={backTo} className="adm-back">{backLabel}</Link>

      <header className="sumadm-hero">
        <div className="sumadm-hero-titles">
          <span className="adm-eyebrow">🎲 Strumento DM · privato</span>
          <h1 className="sumadm-title">Generatore di Sessioni</h1>
          <p className="sumadm-sub">Genera la prep di una sessione nello stile delle Cronache, per party.</p>
        </div>
      </header>

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

      {/* Leggi i riassunti del gruppo → bullet cronologici */}
      <div className="sumadm-recap">
        <div className="sumadm-recap-head">
          <div>
            <strong>📖 Cosa è successo finora · {party.name}</strong>
            <small> — bullet point delle sessioni passate, in ordine cronologico</small>
          </div>
          <button type="button" className="sumadm-btn ghost" onClick={handleReadRecap} disabled={recapBusy}>
            {recapBusy ? "⏳ Leggo i riassunti…" : recap ? "🔄 Rileggi" : "📖 Leggi"}
          </button>
        </div>

        {recapErr && <p className="sumadm-recap-empty">{recapErr}</p>}

        {recap && recap.length > 0 && (
          <ol className="sumadm-recap-list">
            {recap.map((it, i) => (
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
    </section>
  );
}
