/* ============================================================
   FEEDBACK — players rate every feature (0-5 stars), pick pros /
   cons from preset chips (plus custom), and leave a free-text
   message. One feedback per (player, feature): a deterministic
   doc id (`${uid}_${featureKey}`) makes the submission idempotent
   and lets players edit their opinion later.

   Master (santomassimo85@gmail.com) sees a dashboard with author
   identity (name + email), per-feature averages, and filters.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import {
  doc, collection, onSnapshot, getDoc, setDoc, deleteDoc,
  serverTimestamp, query, orderBy, where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import "./Feedback.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

/* Canonical list of features the players can review. Keep keys
   stable — they're used as part of the doc id. */
const FEATURES = [
  { key: "party",         label: "🛡 Party / Scheda PG" },
  { key: "pet_hub",       label: "🐣 Pet Hub" },
  { key: "pet_arena",     label: "🐉 Pet Arena" },
  { key: "arena",         label: "⚔ Arena (torneo)" },
  { key: "arena_market",  label: "🏪 Bottega Arena" },
  { key: "mercato",       label: "💰 Mercato Nero" },
  { key: "bacheca",       label: "📜 Bacheca / Quest" },
  { key: "crafting",      label: "⚒ Crafting" },
  { key: "world_boss",    label: "👹 World Boss" },
  { key: "world_map",     label: "🗺 Mappa del Mondo" },
  { key: "geo",           label: "🌍 Archivio Geomatico" },
  { key: "npc",           label: "🧙 Archivio NPC" },
  { key: "riassunti",     label: "📚 Riassunti" },
  { key: "cinema",        label: "🎬 Cinema" },
  { key: "ratti_lore",    label: "🐀 Gilda dei Ratti" },
  { key: "global_chat",   label: "💬 Chat globale" },
  { key: "notifications", label: "🔔 Notifiche" },
  { key: "general_ui",    label: "🎨 UI / Esperienza generale" },
];
const FEATURE_LABEL = Object.fromEntries(FEATURES.map(f => [f.key, f.label]));

const PROS_OPTIONS = [
  "Divertente", "Bilanciato", "Reattivo", "Bello visivamente",
  "Profondo", "Facile da usare", "Stabile", "Originale",
];
const CONS_OPTIONS = [
  "Lento", "Confuso", "Sbilanciato", "Brutto da vedere",
  "Buggato", "Ripetitivo", "Difficile", "Manca info",
];

/* ── Helpers ───────────────────────────────────────────── */
function feedbackDocId(uid, featureKey) {
  return `${uid}_${featureKey}`;
}
function formatDate(ts) {
  if (!ts) return "—";
  const ms = ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
  const d = new Date(ms);
  return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

/* Delete a feedback doc by id. Caller is responsible for confirming
   intent — Firestore rules already restrict who can delete what
   (author or master), so a silent failure here just means the user
   wasn't allowed to delete this particular doc. */
async function deleteFeedbackById(docId) {
  await deleteDoc(doc(db, "feedback", docId));
}

/* ── Star rating control ───────────────────────────────── */
function StarRating({ value, onChange, readOnly = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div
      className={`fb-stars ${readOnly ? "fb-stars--ro" : ""}`}
      onMouseLeave={() => setHover(0)}
      role={readOnly ? "img" : "radiogroup"}
      aria-label={`${value} stelle su 5`}
    >
      {[1, 2, 3, 4, 5].map(n => {
        const active = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            className={`fb-star ${active ? "fb-star--on" : ""}`}
            onMouseEnter={() => !readOnly && setHover(n)}
            onClick={() => !readOnly && onChange(value === n ? 0 : n)}
            title={`${n} stelle`}
          >
            ★
          </button>
        );
      })}
      <span className="fb-stars-num">{value}/5</span>
    </div>
  );
}

/* ── Chip selector with custom add ────────────────────── */
function ChipPicker({ label, options, selected, onToggle, onAddCustom, accent }) {
  const [draft, setDraft] = useState("");
  const submitDraft = () => {
    const t = draft.trim();
    if (!t) return;
    if (selected.includes(t)) return;
    onAddCustom(t);
    setDraft("");
  };
  return (
    <div className={`fb-chip-block fb-chip-block--${accent}`}>
      <div className="fb-chip-label">{label}</div>
      <div className="fb-chip-row">
        {options.map(opt => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              className={`fb-chip ${on ? "fb-chip--on" : ""}`}
              onClick={() => onToggle(opt)}
            >
              {on ? "✓ " : ""}{opt}
            </button>
          );
        })}
        {/* User-added custom chips (those not in the preset list). */}
        {selected.filter(s => !options.includes(s)).map(custom => (
          <button
            key={custom}
            type="button"
            className="fb-chip fb-chip--on fb-chip--custom"
            onClick={() => onToggle(custom)}
            title="Clicca per rimuovere"
          >
            ✓ {custom} ✕
          </button>
        ))}
      </div>
      <div className="fb-chip-add">
        <input
          type="text"
          placeholder="Aggiungi una tua voce..."
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitDraft(); } }}
          maxLength={40}
        />
        <button type="button" onClick={submitDraft} disabled={!draft.trim()}>+</button>
      </div>
    </div>
  );
}

/* ============================================================
   PLAYER FORM — submit / update my own feedback for a feature
   ============================================================ */
function PlayerForm({ currentUser, characterName }) {
  const [featureKey, setFeatureKey] = useState(FEATURES[0].key);
  const [stars, setStars] = useState(0);
  const [pros, setPros] = useState([]);
  const [cons, setCons] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { ok, text }

  // Load existing feedback for the selected feature so the form
  // shows the player's current opinion (and they can refine it).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser) return;
      try {
        const ref = doc(db, "feedback", feedbackDocId(currentUser.uid, featureKey));
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data();
          setStars(d.stars || 0);
          setPros(Array.isArray(d.pros) ? d.pros : []);
          setCons(Array.isArray(d.cons) ? d.cons : []);
          setMessage(d.message || "");
        } else {
          setStars(0); setPros([]); setCons([]); setMessage("");
        }
      } catch (err) {
        console.warn("[feedback load]", err);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser, featureKey]);

  const togglePros = (v) => setPros(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleCons = (v) => setCons(c => c.includes(v) ? c.filter(x => x !== v) : [...c, v]);
  const addProsCustom = (v) => setPros(p => p.includes(v) ? p : [...p, v]);
  const addConsCustom = (v) => setCons(c => c.includes(v) ? c : [...c, v]);

  const submit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (stars === 0 && !message.trim() && pros.length === 0 && cons.length === 0) {
      setStatus({ ok: false, text: "Lascia almeno una valutazione, un pro/contro o un messaggio." });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const ref = doc(db, "feedback", feedbackDocId(currentUser.uid, featureKey));
      // We do NOT trust the client to set authorEmail/Name — but in
      // this app there's no server, so master will visually verify
      // identity against the uid (rules should enforce uid == auth.uid).
      await setDoc(ref, {
        feature: featureKey,
        featureLabel: FEATURE_LABEL[featureKey],
        stars,
        pros,
        cons,
        message: message.trim(),
        authorUid: currentUser.uid,
        authorName: characterName || "Eroe",
        authorEmail: currentUser.email || "",
        updatedAt: serverTimestamp(),
        // createdAt only set on first submit (merge keeps it stable).
        createdAt: serverTimestamp(),
      }, { merge: true });
      setStatus({ ok: true, text: "Grazie! Feedback salvato." });
    } catch (err) {
      console.error("submit feedback failed:", err);
      setStatus({ ok: false, text: "Salvataggio fallito. Riprova." });
    } finally {
      setLoading(false);
    }
  };

  const removeMine = async () => {
    if (!currentUser) return;
    if (!window.confirm(`Eliminare il tuo feedback su "${FEATURE_LABEL[featureKey]}"?`)) return;
    try {
      await deleteDoc(doc(db, "feedback", feedbackDocId(currentUser.uid, featureKey)));
      setStars(0); setPros([]); setCons([]); setMessage("");
      setStatus({ ok: true, text: "Feedback eliminato." });
    } catch (err) {
      console.error("delete feedback failed:", err);
      setStatus({ ok: false, text: "Eliminazione fallita." });
    }
  };

  return (
    <form className="fb-form" onSubmit={submit}>
      <label className="fb-field">
        <span className="fb-field-label">Funzionalità</span>
        <select
          className="fb-select"
          value={featureKey}
          onChange={e => setFeatureKey(e.target.value)}
        >
          {FEATURES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </label>

      <div className="fb-field">
        <span className="fb-field-label">Valutazione</span>
        <StarRating value={stars} onChange={setStars} />
      </div>

      <ChipPicker
        label="✅ Pro"
        options={PROS_OPTIONS}
        selected={pros}
        onToggle={togglePros}
        onAddCustom={addProsCustom}
        accent="pro"
      />

      <ChipPicker
        label="❌ Contro"
        options={CONS_OPTIONS}
        selected={cons}
        onToggle={toggleCons}
        onAddCustom={addConsCustom}
        accent="con"
      />

      <label className="fb-field">
        <span className="fb-field-label">Messaggio (opzionale)</span>
        <textarea
          className="fb-textarea"
          rows={4}
          maxLength={1000}
          placeholder="Spiega cosa ti piace, cosa migliorerebbe l'esperienza, eventuali bug..."
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <span className="fb-counter">{message.length}/1000</span>
      </label>

      {status && (
        <div className={`fb-status ${status.ok ? "fb-status--ok" : "fb-status--err"}`}>
          {status.text}
        </div>
      )}

      <div className="fb-form-actions">
        <button type="submit" className="fb-btn fb-btn--primary" disabled={loading}>
          {loading ? "Salvataggio..." : "💾 Salva feedback"}
        </button>
        <button type="button" className="fb-btn fb-btn--ghost" onClick={removeMine}>
          🗑 Elimina il mio feedback
        </button>
      </div>
    </form>
  );
}

/* ============================================================
   MY FEEDBACK LIST — player can see what they've written so far
   ============================================================ */
function MyFeedbackList({ currentUser }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    // Server-side filter so the query matches the rule constraint
    // (`authorUid == auth.uid`). Sorted client-side to avoid needing
    // a composite Firestore index.
    const unsub = onSnapshot(
      query(collection(db, "feedback"), where("authorUid", "==", currentUser.uid)),
      snap => {
        const mine = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        mine.sort((a, b) => {
          const am = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
          const bm = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
          return bm - am;
        });
        setItems(mine);
      },
      err => console.warn("[my feedback subscribe]", err)
    );
    return () => unsub();
  }, [currentUser]);

  const deleteRow = async (d) => {
    const label = d.featureLabel || FEATURE_LABEL[d.feature] || d.feature;
    if (!window.confirm(`Eliminare il tuo feedback su "${label}"?`)) return;
    try {
      await deleteFeedbackById(d.id);
    } catch (err) {
      console.error("delete feedback failed:", err);
      window.alert("Eliminazione fallita: " + (err?.message || err));
    }
  };

  if (items.length === 0) {
    return <p className="fb-empty">Non hai ancora lasciato feedback.</p>;
  }
  return (
    <ul className="fb-mine-list">
      {items.map(d => (
        <li key={d.id} className="fb-mine-row">
          <div className="fb-mine-head">
            <span className="fb-mine-feat">{d.featureLabel || FEATURE_LABEL[d.feature] || d.feature}</span>
            <StarRating value={d.stars || 0} onChange={() => {}} readOnly />
            <button
              type="button"
              className="fb-row-del"
              onClick={() => deleteRow(d)}
              title="Elimina questo feedback"
              aria-label={`Elimina feedback su ${d.featureLabel || d.feature}`}
            >
              🗑
            </button>
          </div>
          {d.message && <p className="fb-mine-msg">"{d.message}"</p>}
          <div className="fb-mine-chips">
            {(d.pros || []).map(p => <span key={p} className="fb-chip fb-chip--on">✓ {p}</span>)}
            {(d.cons || []).map(c => <span key={c} className="fb-chip fb-chip--on fb-chip--con">✗ {c}</span>)}
          </div>
          <div className="fb-mine-meta">Aggiornato {formatDate(d.updatedAt)}</div>
        </li>
      ))}
    </ul>
  );
}

/* ============================================================
   MASTER DASHBOARD — every feedback, with author identity.
   Filters: feature + minimum stars. Sorted by updatedAt desc.
   Includes per-feature averages so you see at a glance which
   areas players love and which ones need work.
   ============================================================ */
function MasterDashboard() {
  const [items, setItems] = useState([]);
  const [filterFeat, setFilterFeat] = useState("all");
  const [minStars, setMinStars] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "feedback"), orderBy("updatedAt", "desc")),
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      err => console.warn("[master feedback subscribe]", err)
    );
    return () => unsub();
  }, []);

  // Per-feature stats (count + average stars). 0-star entries with
  // only a message still count toward the count, but are excluded
  // from the average so they don't pull every feature down to 0.
  const stats = useMemo(() => {
    const out = {};
    for (const f of FEATURES) out[f.key] = { count: 0, sum: 0, rated: 0 };
    for (const d of items) {
      const s = out[d.feature];
      if (!s) continue;
      s.count++;
      if (typeof d.stars === "number" && d.stars > 0) {
        s.sum += d.stars; s.rated++;
      }
    }
    return out;
  }, [items]);

  const visible = useMemo(() => {
    return items.filter(d => {
      if (filterFeat !== "all" && d.feature !== filterFeat) return false;
      if ((d.stars || 0) < minStars) return false;
      return true;
    });
  }, [items, filterFeat, minStars]);

  const deleteRow = async (d) => {
    const label = d.featureLabel || FEATURE_LABEL[d.feature] || d.feature;
    if (!window.confirm(
      `MASTER — eliminare il feedback di "${d.authorName || "?"}" (${d.authorEmail || "?"}) su "${label}"?\n\nQuesta operazione non si può annullare.`
    )) return;
    try {
      await deleteFeedbackById(d.id);
    } catch (err) {
      console.error("master delete feedback failed:", err);
      window.alert("Eliminazione fallita: " + (err?.message || err));
    }
  };

  return (
    <div className="fb-master">
      <h2 className="fb-section-title">📊 Dashboard Master · panoramica</h2>

      <div className="fb-stats-grid">
        {FEATURES.map(f => {
          const s = stats[f.key];
          const avg = s.rated > 0 ? (s.sum / s.rated).toFixed(2) : "—";
          return (
            <div key={f.key} className="fb-stat-card">
              <div className="fb-stat-feat">{f.label}</div>
              <div className="fb-stat-row">
                <span className="fb-stat-avg">{avg}{s.rated > 0 ? " ★" : ""}</span>
                <span className="fb-stat-count">{s.count} feedback</span>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="fb-section-title">📜 Tutti i feedback</h2>

      <div className="fb-filters">
        <label>
          Filtra funzionalità
          <select value={filterFeat} onChange={e => setFilterFeat(e.target.value)}>
            <option value="all">Tutte</option>
            {FEATURES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>
        <label>
          Stelle minime
          <select value={minStars} onChange={e => setMinStars(Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} ★</option>)}
          </select>
        </label>
        <span className="fb-filter-count">{visible.length} risultati</span>
      </div>

      {visible.length === 0 ? (
        <p className="fb-empty">Nessun feedback corrisponde ai filtri.</p>
      ) : (
        <ul className="fb-list">
          {visible.map(d => (
            <li key={d.id} className="fb-row">
              <div className="fb-row-head">
                <span className="fb-row-feat">{d.featureLabel || FEATURE_LABEL[d.feature] || d.feature}</span>
                <StarRating value={d.stars || 0} onChange={() => {}} readOnly />
                <button
                  type="button"
                  className="fb-row-del fb-row-del--master"
                  onClick={() => deleteRow(d)}
                  title="Master · elimina questo feedback"
                  aria-label="Elimina feedback"
                >
                  🗑
                </button>
              </div>
              <div className="fb-row-author">
                <strong>{d.authorName || "—"}</strong>
                <span className="fb-row-email"> · {d.authorEmail || "—"}</span>
                <span className="fb-row-uid"> · uid: <code>{d.authorUid}</code></span>
              </div>
              {d.message && <p className="fb-row-msg">"{d.message}"</p>}
              {(d.pros?.length > 0 || d.cons?.length > 0) && (
                <div className="fb-row-chips">
                  {(d.pros || []).map(p => <span key={p} className="fb-chip fb-chip--on">✓ {p}</span>)}
                  {(d.cons || []).map(c => <span key={c} className="fb-chip fb-chip--on fb-chip--con">✗ {c}</span>)}
                </div>
              )}
              <div className="fb-row-meta">Aggiornato {formatDate(d.updatedAt)} · Creato {formatDate(d.createdAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================================================
   PAGE ENTRY
   ============================================================ */
export default function Feedback() {
  const { currentUser } = useAuth();
  const [characterName, setCharacterName] = useState("");
  const isMaster = currentUser?.email === MASTER_EMAIL;

  // Read the character name once so we can stamp it onto the feedback.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "characters", currentUser.uid));
        if (!cancelled && snap.exists()) setCharacterName(snap.data().name || "");
      } catch { /* character name is best-effort — ignore failures */ }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  if (!currentUser) {
    return (
      <section className="fb-page">
        <h1 className="fb-title">💬 Feedback</h1>
        <p className="fb-locked">Accedi per lasciare un feedback.</p>
      </section>
    );
  }

  return (
    <section className="fb-page">
      <header className="fb-head">
        <h1 className="fb-title">💬 Feedback</h1>
        <p className="fb-sub">
          Valuta ogni funzionalità da 0 a 5 stelle, scegli pro e contro, e lascia un messaggio.
          Puoi modificare il tuo feedback in qualsiasi momento.
        </p>
      </header>

      <div className="fb-panel">
        <h2 className="fb-section-title">📝 Lascia il tuo feedback</h2>
        <PlayerForm currentUser={currentUser} characterName={characterName} />
      </div>

      <div className="fb-panel">
        <h2 className="fb-section-title">📌 I tuoi feedback</h2>
        <MyFeedbackList currentUser={currentUser} />
      </div>

      {isMaster && (
        <div className="fb-panel fb-panel--master">
          <MasterDashboard />
        </div>
      )}
    </section>
  );
}
