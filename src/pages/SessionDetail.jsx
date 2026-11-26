import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { isAdminEmail } from "../utils/roles";
import { partyById } from "../data/parties";
import { editSessionWithAi, loadSession, saveSession } from "../utils/dmSessions";
import { withSessionRuntime } from "../utils/sessionRuntime";
import "./admin.css";
import SessionLorePopup from "../components/LorePopup";

// Master + co-master (Makenna): stesso elenco di roles.js, confronto senza maiuscole.
const isDmUser = isAdminEmail;

// Testo dei riquadri di riepilogo: una regola globale dà ai <p> un grigio
// scuro (illeggibile sul fondo scuro), quindi il colore va messo qui.
const SUM_STYLE = `
.sessdet-sum{color:var(--osso,#ece5d6);line-height:1.6;white-space:pre-line;margin:0}
.sessdet-toolbar{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
.sessdet-toolbar .sumadm-btn.primary{flex:0 0 auto;color:#141016;font-weight:700}
.sessdet-toolbar .sumadm-btn.ghost{background:rgba(255,255,255,0.06);color:var(--osso,#ece5d6);border:1px solid rgba(var(--oro-rgb),0.45)}
.sessdet-toolbar .sumadm-btn.ghost:hover:not(:disabled){background:rgba(var(--oro-rgb),0.16);border-color:rgba(var(--oro-rgb),0.8)}
.sessdet-input{width:100%;background:rgba(15,12,18,0.85);color:var(--osso,#ece5d6);border:1px solid rgba(var(--oro-rgb),0.38);border-radius:6px;padding:9px 12px;font-family:inherit;font-size:0.92rem;line-height:1.5;box-sizing:border-box}
.sessdet-input:focus{outline:none;border-color:rgba(var(--oro-rgb),0.85)}
`;

export default function SessionDetail() {
  const { party: partyParam, number } = useParams();
  const { currentUser } = useAuth();
  const party = partyById(partyParam);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modifica con AI
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState(null);

  // Modifica manuale diretta (visuale via designMode o HTML grezzo)
  const [editing, setEditing] = useState(false);
  const [rawHtmlMode, setRawHtmlMode] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDurata, setDraftDurata] = useState("");
  const [draftSummary, setDraftSummary] = useState({ panoramica: "", bottino: "", ganciAperti: "" });
  const [draftHtml, setDraftHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [editError, setEditError] = useState("");
  const editIframeRef = useRef(null);

  useEffect(() => {
    if (!isDmUser(currentUser?.email) || !party) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const s = await loadSession(party.id, number);
        if (alive) setSession(s);
      } catch (e) {
        if (alive) setError(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [currentUser, party, number]);

  if (!isDmUser(currentUser?.email)) {
    return <p style={{ textAlign: "center", paddingTop: 100 }}>Accesso negato: solo DM.</p>;
  }
  if (!party) {
    return <p style={{ textAlign: "center", paddingTop: 100 }}>Party sconosciuto: {partyParam}.</p>;
  }

  const archiveUrl = `/sessions/${party.id.toLowerCase()}`;

  const enterManualEdit = () => {
    if (!session) return;
    setDraftTitle(session.title || "");
    setDraftDurata(session.durata || "");
    setDraftSummary({
      panoramica: session.summary?.panoramica || "",
      bottino: session.summary?.bottino || "",
      ganciAperti: session.summary?.ganciAperti || "",
    });
    setDraftHtml(session.htmlContent || "");
    setRawHtmlMode(false);
    setEditError("");
    setNotice("");
    setEditing(true);
  };

  const readVisualIframeHtml = () => {
    const doc = editIframeRef.current?.contentDocument;
    if (!doc) return draftHtml;
    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  };

  const toggleHtmlMode = () => {
    if (!rawHtmlMode) {
      setDraftHtml(readVisualIframeHtml());
      setRawHtmlMode(true);
    } else {
      setRawHtmlMode(false);
    }
  };

  const handleSaveManual = async () => {
    if (!session || saving) return;
    setSaving(true);
    setEditError("");
    setNotice("");
    try {
      const nextHtml = rawHtmlMode ? draftHtml : readVisualIframeHtml();
      const next = {
        ...session,
        title: draftTitle.trim(),
        durata: draftDurata.trim(),
        summary: draftSummary,
        htmlContent: nextHtml,
      };
      await saveSession({
        party: party.id,
        sessionNumber: session.sessionNumber,
        title: next.title,
        htmlContent: next.htmlContent,
        summary: next.summary,
        durata: next.durata,
      });
      setSession(next);
      setEditing(false);
      setNotice("✅ Modifiche salvate.");
    } catch (e) {
      setEditError(e.message || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const handleAiEdit = async (e) => {
    e.preventDefault();
    if (!session || aiBusy || !aiPrompt.trim()) return;
    setAiBusy(true);
    setEditError("");
    setNotice("");
    const prev = {
      title: session.title || "",
      durata: session.durata || "",
      summary: session.summary || { panoramica: "", bottino: "", ganciAperti: "" },
      htmlContent: session.htmlContent || "",
    };
    try {
      const res = await editSessionWithAi({
        party: party.id,
        world: party.world || "",
        closingChronicle: party.closingChronicle || "Cronache",
        sessionNumber: session.sessionNumber,
        durata: session.durata || "",
        currentHtml: session.htmlContent || "",
        currentSummary: session.summary || {},
        editPrompt: aiPrompt.trim(),
      });
      const nextTitle = res.title || session.title || "";
      const nextSummary = {
        panoramica: res.summary?.panoramica ?? session.summary?.panoramica ?? "",
        bottino: res.summary?.bottino ?? session.summary?.bottino ?? "",
        ganciAperti: res.summary?.ganciAperti ?? session.summary?.ganciAperti ?? "",
      };
      await saveSession({
        party: party.id,
        sessionNumber: session.sessionNumber,
        title: nextTitle,
        htmlContent: res.html,
        summary: nextSummary,
        durata: session.durata || "",
      });
      setUndoSnapshot(prev);
      setSession((cur) => ({
        ...cur,
        title: nextTitle,
        summary: nextSummary,
        htmlContent: res.html,
      }));
      if (editing) {
        setDraftTitle(nextTitle);
        setDraftSummary(nextSummary);
        setDraftHtml(res.html);
      }
      setAiPrompt("");
      setNotice(res.warning ? `⚠ Modifica AI salvata (${res.warning})` : "✅ Modifica AI applicata e salvata.");
    } catch (err) {
      setEditError(err.message || "Errore durante la modifica con AI.");
    } finally {
      setAiBusy(false);
    }
  };

  const handleUndoAi = async () => {
    if (!session || !undoSnapshot || saving) return;
    setSaving(true);
    setEditError("");
    try {
      await saveSession({
        party: party.id,
        sessionNumber: session.sessionNumber,
        title: undoSnapshot.title,
        htmlContent: undoSnapshot.htmlContent,
        summary: undoSnapshot.summary,
        durata: undoSnapshot.durata,
      });
      setSession((cur) => ({ ...cur, ...undoSnapshot }));
      setUndoSnapshot(null);
      setNotice("↩ Ripristinata la versione precedente.");
    } catch (err) {
      setEditError(err.message || "Errore nel ripristino.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-summary-page sumadm">
      <style>{SUM_STYLE}</style>
      <Link to={archiveUrl} className="adm-back">← Archivio {party.id}</Link>

      {loading ? (
        <p className="sumadm-empty">Caricamento sessione…</p>
      ) : error ? (
        <div className="admin-status-err">❌ {error}</div>
      ) : !session ? (
        <p className="sumadm-empty">
          Sessione #{number} non trovata per {party.id}.{" "}
          <Link to={archiveUrl}>Torna all'archivio</Link>.
        </p>
      ) : (
        <>
          <header className="sumadm-hero">
            <div className="sumadm-hero-titles">
              <span className="adm-eyebrow" style={{ color: party.color }}>
                {party.name} · Sessione #{session.sessionNumber}
              </span>
              <h1 className="sumadm-title">{session.title || "(senza titolo)"}</h1>
              {session.durata && <p className="sumadm-sub">Durata prevista: {session.durata}</p>}
            </div>
            <div className="sessdet-toolbar">
              <button
                type="button"
                className={`sumadm-btn ${aiOpen ? "primary" : "ghost"}`}
                onClick={() => setAiOpen((v) => !v)}
              >
                ✨ {aiOpen ? "Chiudi AI" : "Modifica con AI"}
              </button>
              {!editing ? (
                <button type="button" className="sumadm-btn ghost" onClick={enterManualEdit}>
                  ✏️ Modifica a mano
                </button>
              ) : (
                <>
                  <button type="button" className="sumadm-btn primary" onClick={handleSaveManual} disabled={saving}>
                    {saving ? "Salvataggio…" : "💾 Salva modifiche"}
                  </button>
                  <button type="button" className="sumadm-btn ghost" onClick={toggleHtmlMode} disabled={saving}>
                    {rawHtmlMode ? "👁 Editor visuale" : "⟨/⟩ Codice HTML"}
                  </button>
                  <button type="button" className="sumadm-btn ghost" onClick={() => setEditing(false)} disabled={saving}>
                    Annulla
                  </button>
                </>
              )}
              {undoSnapshot && (
                <button type="button" className="sumadm-btn ghost" onClick={handleUndoAi} disabled={saving || aiBusy}>
                  ↩ Ripristina prima dell'AI
                </button>
              )}
            </div>
          </header>

          {notice && <div className="admin-status-ok" style={{ marginBottom: 14 }}>{notice}</div>}
          {editError && <div className="admin-status-err" style={{ marginBottom: 14 }}>❌ {editError}</div>}

          {/* Pannello Modifica con AI */}
          {aiOpen && (
            <form onSubmit={handleAiEdit} className="sumadm-card" style={{ marginBottom: 20 }}>
              <div className="sumadm-card-head">
                <h2>✨ Modifica questa sessione con l'AI</h2>
              </div>
              <p style={{ margin: "0 0 10px", color: "var(--osso, #ece5d6)", opacity: 0.85, fontSize: "0.9rem" }}>
                Scrivi cosa vuoi cambiare, aggiungere o togliere: l'AI aggiornerà la sessione mantenendo il resto invariato.
              </p>
              <textarea
                className="sessdet-input"
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Es. Nell'Atto II aggiungi un'imboscata di 3 assassini sul ponte, cambia il bottino finale con 150 mo e una pergamena di Palla di Fuoco..."
                disabled={aiBusy}
                style={{ marginBottom: 10 }}
              />
              <div className="sessdet-toolbar" style={{ marginTop: 0 }}>
                <button type="submit" className="sumadm-btn primary" disabled={aiBusy || !aiPrompt.trim()}>
                  {aiBusy ? "✨ Modifica in corso…" : "✨ Applica modifiche AI"}
                </button>
              </div>
            </form>
          )}

          {/* Campi testata + riepilogo in modifica manuale, oppure vista normale */}
          {editing ? (
            <div className="sumadm-card" style={{ marginBottom: 20 }}>
              <div className="sumadm-card-head">
                <h2>✏️ Modifica diretta</h2>
              </div>
              <div className="sumadm-row3" style={{ gridTemplateColumns: "2fr 1fr", marginBottom: 12 }}>
                <div className="sumadm-field">
                  <label>Titolo</label>
                  <input className="sessdet-input" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
                </div>
                <div className="sumadm-field">
                  <label>Durata prevista</label>
                  <input className="sessdet-input" value={draftDurata} onChange={(e) => setDraftDurata(e.target.value)} placeholder="es. 3h" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
                <div className="sumadm-field">
                  <label>📋 Panoramica</label>
                  <textarea className="sessdet-input" rows={3} value={draftSummary.panoramica} onChange={(e) => setDraftSummary((s) => ({ ...s, panoramica: e.target.value }))} />
                </div>
                <div className="sumadm-field">
                  <label>💰 Bottino</label>
                  <textarea className="sessdet-input" rows={3} value={draftSummary.bottino} onChange={(e) => setDraftSummary((s) => ({ ...s, bottino: e.target.value }))} />
                </div>
                <div className="sumadm-field">
                  <label>🪝 Ganci aperti</label>
                  <textarea className="sessdet-input" rows={3} value={draftSummary.ganciAperti} onChange={(e) => setDraftSummary((s) => ({ ...s, ganciAperti: e.target.value }))} />
                </div>
              </div>
              <p style={{ margin: "12px 0 0", color: "var(--osso, #ece5d6)", opacity: 0.85, fontSize: "0.85rem" }}>
                {rawHtmlMode
                  ? "Stai modificando il codice HTML grezzo della sessione."
                  : "Clicca direttamente sul testo della sessione qui sotto per scrivere o modificare qualsiasi parte, poi premi «Salva modifiche»."}
              </p>
            </div>
          ) : (
            session.summary && (session.summary.panoramica || session.summary.bottino || session.summary.ganciAperti) && (
              <div className="sumadm-workshop" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16, marginBottom: 24 }}>
                {session.summary.panoramica && (
                  <div className="sumadm-card"><div className="sumadm-card-head"><h2>📋 Panoramica</h2></div><p className="sessdet-sum">{session.summary.panoramica}</p></div>
                )}
                {session.summary.bottino && (
                  <div className="sumadm-card"><div className="sumadm-card-head"><h2>💰 Bottino</h2></div><p className="sessdet-sum">{session.summary.bottino}</p></div>
                )}
                {session.summary.ganciAperti && (
                  <div className="sumadm-card"><div className="sumadm-card-head"><h2>🪝 Ganci aperti</h2></div><p className="sessdet-sum">{session.summary.ganciAperti}</p></div>
                )}
              </div>
            )
          )}

          {editing ? (
            rawHtmlMode ? (
              <textarea
                className="sessdet-input"
                value={draftHtml}
                onChange={(e) => setDraftHtml(e.target.value)}
                style={{ height: "75vh", fontFamily: "monospace", fontSize: "0.85rem" }}
              />
            ) : (
              <iframe
                ref={editIframeRef}
                title={`Editor Sessione ${session.sessionNumber} — ${party.id}`}
                srcDoc={draftHtml || "<p>Nessun contenuto.</p>"}
                sandbox="allow-same-origin allow-scripts"
                onLoad={() => {
                  const doc = editIframeRef.current?.contentDocument;
                  if (doc) {
                    doc.designMode = "on";
                    if (doc.body) doc.body.spellcheck = true;
                  }
                }}
                style={{
                  width: "100%",
                  height: "85vh",
                  border: "2px solid rgba(var(--oro-rgb),0.85)",
                  borderRadius: 12,
                  background: "#050807",
                }}
              />
            )
          ) : (
            <iframe
              title={`Sessione ${session.sessionNumber} — ${party.id}`}
              srcDoc={withSessionRuntime(session.htmlContent || "<p>Nessun contenuto.</p>")}
              sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
              style={{
                width: "100%",
                height: "85vh",
                border: "1px solid rgba(var(--oro-rgb),0.4)",
                borderRadius: 12,
                background: "#050807",
              }}
            />
          )}
          <SessionLorePopup />
        </>
      )}
    </section>
  );
}
