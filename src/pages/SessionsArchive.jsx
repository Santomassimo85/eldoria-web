import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { partyById, PARTIES } from "../data/parties";
import { ensureParties, loadSessions, deleteSession } from "../utils/dmSessions";
import "./admin.css";

// Solo master + co-master (strumento privato).
const DM_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];
const isDmUser = (email) => DM_EMAILS.includes(email);

export default function SessionsArchive() {
  const { party: partyParam } = useParams();
  const { currentUser } = useAuth();
  const party = partyById(partyParam);

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (e, s) => {
    // Il cestino vive dentro la card-Link: niente navigazione al dettaglio.
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
      setError(err.message || String(err));
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!isDmUser(currentUser?.email) || !party) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await ensureParties(); // seed idempotente della config party
        const list = await loadSessions(party.id);
        if (alive) setSessions(list);
      } catch (e) {
        if (alive) setError(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [currentUser, party]);

  if (!isDmUser(currentUser?.email)) {
    return <p style={{ textAlign: "center", paddingTop: 100 }}>Accesso negato: solo DM.</p>;
  }
  if (!party) {
    return (
      <section className="admin-summary-page" style={{ paddingTop: 80, textAlign: "center" }}>
        <p>Party sconosciuto: <strong>{partyParam}</strong>.</p>
        <p style={{ marginTop: 12 }}>
          {PARTIES.map((p) => (
            <Link key={p.id} to={`/sessions/${p.id.toLowerCase()}`} style={{ margin: "0 8px" }}>
              {p.id}
            </Link>
          ))}
        </p>
      </section>
    );
  }

  return (
    <section className="admin-summary-page sumadm">
      <Link to="/dm-admin" className="adm-back">← Console del Master</Link>

      <header className="sumadm-hero">
        <div className="sumadm-hero-titles">
          <span className="adm-eyebrow" style={{ color: party.color }}>📖 Archivio Sessioni · {party.world}</span>
          <h1 className="sumadm-title">{party.name}</h1>
          <p className="sumadm-sub">{party.characters.join(" · ")}</p>
        </div>
        <div className="sumadm-stats">
          <div className="sumadm-stat"><span>Sessioni</span><strong>{sessions.length}</strong></div>
        </div>
      </header>

      {/* Switch party */}
      <div className="sumadm-filter-tabs" style={{ marginBottom: 20 }}>
        {PARTIES.map((p) => (
          <Link
            key={p.id}
            to={`/sessions/${p.id.toLowerCase()}`}
            className={`sumadm-filter ${p.id === party.id ? "on" : ""}`}
            style={p.id === party.id
              ? { background: p.color, borderColor: p.color, color: "#fff" }
              : { borderColor: p.color, color: p.color }}
          >
            {p.id}
          </Link>
        ))}
      </div>

      {error && <div className="admin-status-err">❌ {error}</div>}

      {loading ? (
        <p className="sumadm-empty">Caricamento sessioni…</p>
      ) : sessions.length === 0 ? (
        <p className="sumadm-empty">
          Nessuna sessione archiviata per {party.id}. Generane una da{" "}
          <Link to="/dm/generate-session">/dm/generate-session</Link>.
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
                onClick={(e) => handleDelete(e, s)}
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
    </section>
  );
}
