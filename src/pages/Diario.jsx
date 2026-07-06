/* ============================================================================
   DIARIO DI BORDO — diario collaborativo di gruppo.
   Ogni player, al login, viene assegnato AUTOMATICAMENTE al proprio party
   leggendo `characters/{uid}.name` e confrontandolo col roster (stessa fonte
   della Bacheca). Un player vede e scrive SOLO nel diario del suo gruppo.
   Il Master/co-master (nessun party) può sfogliare e annotare ogni gruppo.

   Collezione Firestore: `diary_notes`
     { party, authorUid, authorName, text, createdAt: serverTimestamp() }
   Isolamento per party = client-side (come dm_sessions): la query filtra
   `where("party","==", partyCorrente)` e la voce salva il party dell'autore.
   ============================================================================ */

import { useState, useEffect, useMemo } from "react";
import {
  collection, addDoc, deleteDoc, doc, getDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import useParallaxScroll from "../hooks/useParallaxScroll";
import AmbientFX from "../components/AmbientFX";
import "../styles/cinematic.css";
import "./Diario.css";

const MASTER_EMAIL   = "santomassimo85@gmail.com";
const COMASTER_EMAIL = "ripperti96@gmail.com";

/* ── Roster: unica fonte di verità (allineato a Bacheca.jsx) ─────────────── */
const PARTY_ROSTER = {
  AMEA: ["Tanagar", "Garroth Tel´Arion", "Caius Maxis-Richtofen"],
  LEAF: ["Soran", "Zethir Nightwhisper", "Aksel", "Dago"],
  ENOX: ["Makenna", "Temistocle Sottocolle Milo", "Alaric Voltasorte", "Lael"],
  LAC:  ["Horn", "Thinkle Muschioverde", "Cleofe"],
};

const PARTY_META = {
  AMEA: { label: "Gruppo AMEA", world: "Eldoria",             color: "#c0392b", rune: "ᛗ" },
  LEAF: { label: "Gruppo LEAF", world: "Nyxaris · Exanthia",  color: "#27ae60", rune: "ᛚ" },
  ENOX: { label: "Gruppo ENOX", world: "Eldoria · Ezhkie",    color: "#8e44ad", rune: "ᛖ" },
  LAC:  { label: "Gruppo LAC",  world: "Eldoria",             color: "#b8860b", rune: "ᛜ" },
};
const PARTY_ORDER = ["AMEA", "LEAF", "ENOX", "LAC"];

/* Normalizza nomi (accenti/apostrofi) per un match tollerante. */
const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[´'’`]/g, "")
    .trim();
const firstTok = (s) => norm(s).split(/\s+/)[0] || "";

const getPartyByCharName = (name) => {
  if (!name) return "Senza Gruppo";
  for (const [party, members] of Object.entries(PARTY_ROSTER)) {
    if (members.some((m) => norm(m) === norm(name))) return party;        // match pieno
  }
  for (const [party, members] of Object.entries(PARTY_ROSTER)) {
    if (members.some((m) => firstTok(m) === firstTok(name))) return party; // primo nome
  }
  return "Senza Gruppo";
};

/* Data leggibile da un Timestamp Firestore. */
const fmtDate = (ts) => {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric",
  });
};
const fmtTime = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";

export default function Diario() {
  const { currentUser } = useAuth();
  const isMaster =
    currentUser?.email === MASTER_EMAIL || currentUser?.email === COMASTER_EMAIL;
  useParallaxScroll();

  const [charName, setCharName]     = useState("");
  const [ownParty, setOwnParty]     = useState("");     // party derivato dal PG
  const [viewParty, setViewParty]   = useState("");     // party attualmente in vista
  const [ready, setReady]           = useState(false);  // profilo caricato
  const [notes, setNotes]           = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [text, setText]             = useState("");
  const [saving, setSaving]         = useState(false);

  /* 1) Ricava il party del giocatore dal suo personaggio. */
  useEffect(() => {
    if (!currentUser) { setReady(true); return; }
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "characters", currentUser.uid));
        const name = snap.exists() ? (snap.data().name || "") : "";
        const party = getPartyByCharName(name);
        if (!alive) return;
        setCharName(name);
        setOwnParty(party);
        // il player parte sul PROPRIO gruppo; il master sul primo disponibile
        setViewParty(party !== "Senza Gruppo" ? party : PARTY_ORDER[0]);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [currentUser]);

  /* 2) Ascolta le voci del gruppo in vista. */
  useEffect(() => {
    if (!viewParty || viewParty === "Senza Gruppo") { setNotes([]); setLoadingNotes(false); return; }
    setLoadingNotes(true);
    const q = query(
      collection(db, "diary_notes"),
      where("party", "==", viewParty),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingNotes(false);
    }, () => setLoadingNotes(false));
    return () => unsub();
  }, [viewParty]);

  /* Chi può scrivere nel gruppo in vista? Il membro nel proprio gruppo, o il master ovunque. */
  const canPost = isMaster || (ownParty !== "Senza Gruppo" && ownParty === viewParty);
  const meta = PARTY_META[viewParty] || null;

  const addNote = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || !canPost || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "diary_notes"), {
        party: viewParty,
        authorUid: currentUser.uid,
        authorName: charName || (isMaster ? "Il Master" : "Eroe"),
        text: body.slice(0, 4000),
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (err) {
      console.error("[Diario] addNote", err);
      alert("Non è stato possibile salvare la voce. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async (note) => {
    const canDelete = isMaster || note.authorUid === currentUser?.uid;
    if (!canDelete) return;
    if (!window.confirm("Eliminare questa voce dal diario?")) return;
    try {
      await deleteDoc(doc(db, "diary_notes", note.id));
    } catch (err) {
      console.error("[Diario] removeNote", err);
    }
  };

  /* Voci raggruppate per giorno (per righello data nel diario). */
  const groups = useMemo(() => {
    const out = [];
    let cur = null;
    for (const n of notes) {
      const key = n.createdAt?.toDate ? n.createdAt.toDate().toDateString() : "pending";
      if (!cur || cur.key !== key) { cur = { key, label: fmtDate(n.createdAt), items: [] }; out.push(cur); }
      cur.items.push(n);
    }
    return out;
  }, [notes]);

  /* ── Stati di guardia ─────────────────────────────────────────────────── */
  if (!currentUser) {
    return (
      <section className="diario-page cine-page cine-compact">
        <div className="diario-gate">
          <span className="diario-gate-rune" aria-hidden="true">ᛒ</span>
          <h1>Diario di Bordo</h1>
          <p>Accedi con il tuo eroe per aprire il diario del tuo gruppo.</p>
        </div>
      </section>
    );
  }
  if (ready && !isMaster && ownParty === "Senza Gruppo") {
    return (
      <section className="diario-page cine-page cine-compact">
        <div className="diario-gate">
          <span className="diario-gate-rune" aria-hidden="true">ᛒ</span>
          <h1>Diario di Bordo</h1>
          <p>Il tuo personaggio non risulta assegnato a un gruppo, quindi non c'è ancora
             un diario da aprire. Chiedi al Master di inserirti in un party.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="diario-page cine-page cine-compact"
      style={{ "--cine-accent": meta?.color || "#a9781a" }}
    >
      <AmbientFX variant="leaves" />

      {/* ── Intestazione ─────────────────────────────────────────────── */}
      <header className="diario-hero">
        <p className="diario-eyebrow"><span aria-hidden="true">ᛒ</span> Cronache del gruppo</p>
        <h1 className="diario-title">Diario di Bordo</h1>
        {meta && (
          <p className="diario-sub">
            <span className="diario-seal" style={{ background: meta.color }}>{meta.rune}</span>
            {meta.label} · <em>{meta.world}</em>
          </p>
        )}
        {!isMaster && (
          <p className="diario-note-hint">
            Stai scrivendo nel diario del <strong>tuo</strong> gruppo. Ogni voce riporta chi l'ha
            annotata e quando.
          </p>
        )}
      </header>

      {/* ── Selettore gruppi: solo Master/co-master ──────────────────── */}
      {isMaster && (
        <div className="diario-tabs" role="tablist" aria-label="Gruppi">
          {PARTY_ORDER.map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={viewParty === p}
              className={"diario-tab" + (viewParty === p ? " is-active" : "")}
              style={{ "--tab-color": PARTY_META[p].color }}
              onClick={() => setViewParty(p)}
            >
              <span className="diario-tab-rune" aria-hidden="true">{PARTY_META[p].rune}</span>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* ── Composizione voce ────────────────────────────────────────── */}
      {canPost ? (
        <form className="diario-compose" onSubmit={addNote}>
          <textarea
            className="diario-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Annota un evento, un indizio, una decisione del gruppo…"
            rows={3}
            maxLength={4000}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") addNote(e);
            }}
          />
          <div className="diario-compose-foot">
            <span className="diario-signature">✍ {charName || (isMaster ? "Il Master" : "Eroe")}</span>
            <button type="submit" className="diario-add" disabled={!text.trim() || saving}>
              {saving ? "Salvo…" : "＋ Aggiungi al diario"}
            </button>
          </div>
        </form>
      ) : (
        <p className="diario-readonly">
          Puoi consultare questo diario, ma solo i membri del gruppo possono aggiungere voci.
        </p>
      )}

      {/* ── Elenco voci ──────────────────────────────────────────────── */}
      <div className="diario-ledger">
        {loadingNotes ? (
          <p className="diario-empty">Apro il diario…</p>
        ) : groups.length === 0 ? (
          <p className="diario-empty">
            Il diario è ancora bianco. Sii il primo a scrivere una riga di storia.
          </p>
        ) : (
          groups.map((g) => (
            <div className="diario-day" key={g.key}>
              <div className="diario-day-rule"><span>{g.label}</span></div>
              <ul className="diario-entries">
                {g.items.map((n) => {
                  const canDelete = isMaster || n.authorUid === currentUser?.uid;
                  return (
                    <li className="diario-entry" key={n.id}>
                      <span className="diario-avatar" aria-hidden="true">
                        {(n.authorName || "?").trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="diario-entry-body">
                        <div className="diario-entry-head">
                          <span className="diario-author">{n.authorName || "Anonimo"}</span>
                          <span className="diario-when">
                            {fmtTime(n.createdAt) || "in salvataggio…"}
                          </span>
                          {canDelete && (
                            <button
                              type="button"
                              className="diario-del"
                              onClick={() => removeNote(n)}
                              aria-label="Elimina voce"
                              title="Elimina voce"
                            >×</button>
                          )}
                        </div>
                        <p className="diario-text">{n.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
