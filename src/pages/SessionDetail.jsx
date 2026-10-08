import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { isAdminEmail } from "../utils/roles";
import { partyById } from "../data/parties";
import { loadSession } from "../utils/dmSessions";
import { withSessionRuntime } from "../utils/sessionRuntime";
import "./admin.css";
import SessionLorePopup from "../components/LorePopup";

// Master + co-master (Makenna): stesso elenco di roles.js, confronto senza maiuscole.
const isDmUser = isAdminEmail;

// Testo dei riquadri di riepilogo: una regola globale dà ai <p> un grigio
// scuro (illeggibile sul fondo scuro), quindi il colore va messo qui.
const SUM_STYLE = `.sessdet-sum{color:var(--osso,#ece5d6);line-height:1.6;white-space:pre-line;margin:0}`;

export default function SessionDetail() {
  const { party: partyParam, number } = useParams();
  const { currentUser } = useAuth();
  const party = partyById(partyParam);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          </header>

          {/* Summary di riferimento rapido (privato, per il DM) */}
          {session.summary && (session.summary.panoramica || session.summary.bottino || session.summary.ganciAperti) && (
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
          )}

          {/* HTML pieno della sessione, isolato in iframe. Gli script della
              sessione vengono sostituiti dal runtime dell'app (withSessionRuntime):
              tab/step, collassabili e timer funzionano anche se l'HTML generato
              è arrivato troncato senza il blocco <script> finale. */}
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
          <SessionLorePopup />
        </>
      )}
    </section>
  );
}
