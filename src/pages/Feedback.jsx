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
  doc, collection, onSnapshot, getDoc, setDoc, updateDoc, deleteDoc,
  addDoc, serverTimestamp, query, orderBy, where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import "../styles/cinematic.css";
import "./Feedback.css";
import useParallaxScroll from "../hooks/useParallaxScroll";
import GlacierHero from "../components/glacier/GlacierHero";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const HERO_IMAGE = "/assets/PhotoStory/GruppoENOX/milo1.png";

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

/* Master writes (or clears) a reply on a feedback doc and pushes a
   notification to the author. Pulling the notify into the same call
   keeps the two writes co-located so it's obvious which feedback the
   notification refers to.

   Passing `replyText = ""` clears the reply and skips the notification
   — useful when the master wants to retract a draft they typed by
   mistake without spamming the player. */
async function saveMasterReply(feedback, replyText, masterUser) {
  const trimmed = (replyText || "").trim();
  await updateDoc(doc(db, "feedback", feedback.id), {
    masterReply: trimmed,
    masterReplyAt: trimmed ? serverTimestamp() : null,
    masterReplyBy: trimmed ? (masterUser?.uid || null) : null,
  });
  if (!trimmed) return;
  if (!feedback.authorUid) return;
  // Notification body — capped so a long master reply doesn't blow up
  // the notification card. The full text is always available on the
  // feedback page itself.
  const featureLabel = feedback.featureLabel || FEATURE_LABEL[feedback.feature] || feedback.feature;
  const preview = trimmed.length > 220 ? trimmed.slice(0, 217) + "…" : trimmed;
  const titlePrefix = feedback.bug ? "🐛 Risposta del Master al tuo bug" : "💬 Risposta del Master al tuo feedback";
  await addDoc(collection(db, "notifications"), {
    userId: feedback.authorUid,
    read: false,
    timestamp: serverTimestamp(),
    title: titlePrefix,
    message: `[${featureLabel}] ${preview}`,
  });
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
  const [bug, setBug] = useState("");
  const [loadedFeedback, setLoadedFeedback] = useState(null);
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
          setBug(d.bug || "");
          setLoadedFeedback({ id: snap.id, ...d });
        } else {
          setStars(0); setPros([]); setCons([]); setMessage(""); setBug("");
          setLoadedFeedback(null);
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
    const bugTrim = bug.trim();
    const msgTrim = message.trim();
    if (stars === 0 && !msgTrim && !bugTrim && pros.length === 0 && cons.length === 0) {
      setStatus({ ok: false, text: "Lascia almeno una valutazione, un pro/contro, un messaggio o un bug." });
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
        message: msgTrim,
        bug: bugTrim,                 // quick bug report (separate from message)
        hasBug: bugTrim.length > 0,   // flag for fast filtering in master dashboard
        authorUid: currentUser.uid,
        authorName: characterName || "Eroe",
        authorEmail: currentUser.email || "",
        updatedAt: serverTimestamp(),
        // createdAt only set on first submit (merge keeps it stable).
        createdAt: serverTimestamp(),
      }, { merge: true });
      setStatus({ ok: true, text: bugTrim ? "Grazie! Feedback e bug salvati." : "Grazie! Feedback salvato." });
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
      setStars(0); setPros([]); setCons([]); setMessage(""); setBug("");
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

      {/* If the master has already replied to this feature, surface
          that reply at the top of the form so the player sees it
          before deciding what to edit. */}
      <MasterReplyBlock feedback={loadedFeedback} />

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
          placeholder="Spiega cosa ti piace, cosa migliorerebbe l'esperienza..."
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <span className="fb-counter">{message.length}/1000</span>
      </label>

      {/* Quick bug field — separate from the regular message so the Master
          can filter / triage at a glance. Players use this when they just
          want to flag "qualcosa è rotto" without writing a full review. */}
      <label className="fb-field fb-field--bug">
        <span className="fb-field-label fb-field-label--bug">
          🐛 Bug · qualcosa da controllare/correggere?
        </span>
        <textarea
          className="fb-textarea fb-textarea--bug"
          rows={2}
          maxLength={500}
          placeholder="Descrivi velocemente: cosa hai fatto, cosa è successo, cosa ti aspettavi."
          value={bug}
          onChange={e => setBug(e.target.value)}
        />
        <span className="fb-counter">{bug.length}/500</span>
      </label>

      {status && (
        <div className={`fb-status ${status.ok ? "fb-status--ok" : "fb-status--err"}`}>
          {status.text}
        </div>
      )}

      <div className="fb-form-actions">
        <button type="submit" className="gl-cta fb-btn fb-btn--primary" disabled={loading}>
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
    <ul className="nx-griglia nx-griglia--larga fb-mine-list">
      {items.map(d => (
        <li key={d.id} className="nx-pannello fb-mine-row">
          <div className="fb-mine-head">
            <span className="nx-nome fb-mine-feat">{d.featureLabel || FEATURE_LABEL[d.feature] || d.feature}</span>
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
          {d.bug && (
            <p className="fb-bug-block">
              <span className="fb-bug-tag">🐛 BUG</span>
              <span className="fb-bug-text">{d.bug}</span>
            </p>
          )}
          <div className="fb-mine-chips">
            {(d.pros || []).map(p => <span key={p} className="fb-chip fb-chip--on">✓ {p}</span>)}
            {(d.cons || []).map(c => <span key={c} className="fb-chip fb-chip--on fb-chip--con">✗ {c}</span>)}
          </div>
          <MasterReplyBlock feedback={d} />
          <div className="fb-mine-meta">Aggiornato {formatDate(d.updatedAt)}</div>
        </li>
      ))}
    </ul>
  );
}

/* ── MasterReplyForm ─────────────────────────────────────
   Inline reply editor shown under each feedback in the master
   dashboard. Pre-fills the existing reply if there is one so the
   master can edit / clear instead of overwriting. Pushes a
   notification to the author on save (handled by saveMasterReply). */
function MasterReplyForm({ feedback, masterUser }) {
  const [text, setText] = useState(feedback.masterReply || "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // If a fresh snapshot for this feedback arrives (e.g. someone else
  // editing in another tab), keep the textarea in sync with the doc.
  useEffect(() => {
    if (!open) setText(feedback.masterReply || "");
  }, [feedback.masterReply, open]);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await saveMasterReply(feedback, text, masterUser);
      setOpen(false);
    } catch (e) {
      console.error("master reply save failed:", e);
      setErr(e?.message || "Errore.");
    } finally {
      setBusy(false);
    }
  };
  const clear = async () => {
    if (!feedback.masterReply) { setText(""); setOpen(false); return; }
    if (!window.confirm("Cancellare la risposta del Master? Il giocatore non riceverà un'altra notifica.")) return;
    setBusy(true); setErr(null);
    try {
      await saveMasterReply(feedback, "", masterUser);
      setText("");
      setOpen(false);
    } catch (e) {
      console.error("master reply clear failed:", e);
      setErr(e?.message || "Errore.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className={`fb-reply-toggle ${feedback.masterReply ? "fb-reply-toggle--has" : ""}`}
        onClick={() => setOpen(true)}
      >
        {feedback.masterReply ? "✏ Modifica risposta del Master" : "💬 Rispondi"}
      </button>
    );
  }
  return (
    <div className="fb-reply-edit">
      <textarea
        className="fb-textarea fb-textarea--reply"
        rows={3}
        maxLength={1000}
        placeholder="Scrivi la tua risposta. Il giocatore riceverà una notifica."
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <div className="fb-reply-edit-actions">
        <button
          type="button"
          className="fb-btn fb-btn--primary"
          onClick={save}
          disabled={busy || (text.trim() === (feedback.masterReply || "").trim())}
        >
          {busy ? "Invio..." : (feedback.masterReply ? "💾 Aggiorna + notifica" : "📨 Invia + notifica")}
        </button>
        {feedback.masterReply && (
          <button
            type="button"
            className="fb-btn fb-btn--ghost"
            onClick={clear}
            disabled={busy}
          >
            🗑 Cancella risposta
          </button>
        )}
        <button
          type="button"
          className="fb-btn fb-btn--ghost"
          onClick={() => { setOpen(false); setText(feedback.masterReply || ""); }}
          disabled={busy}
        >
          ✕ Annulla
        </button>
      </div>
      {err && <div className="fb-status fb-status--err">{err}</div>}
    </div>
  );
}

/* Read-only reply block — shown on the player side when the master
   has answered. The styling matches the master accent so the player
   immediately recognizes it as coming from the DM. */
function MasterReplyBlock({ feedback }) {
  if (!feedback?.masterReply) return null;
  return (
    <div className="fb-reply-block">
      <div className="fb-reply-block-head">
        <span className="fb-reply-tag">💬 Master</span>
        <span className="fb-reply-when">{formatDate(feedback.masterReplyAt)}</span>
      </div>
      <p className="fb-reply-text">{feedback.masterReply}</p>
    </div>
  );
}

/* ============================================================
   MASTER DASHBOARD — every feedback, with author identity.
   Filters: feature + minimum stars. Sorted by updatedAt desc.
   Includes per-feature averages so you see at a glance which
   areas players love and which ones need work.
   ============================================================ */
function MasterDashboard({ masterUser }) {
  const [items, setItems] = useState([]);
  const [filterFeat, setFilterFeat] = useState("all");
  const [minStars, setMinStars] = useState(0);
  const [onlyBugs, setOnlyBugs] = useState(false);

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
    for (const f of FEATURES) out[f.key] = { count: 0, sum: 0, rated: 0, bugs: 0 };
    for (const d of items) {
      const s = out[d.feature];
      if (!s) continue;
      s.count++;
      if (typeof d.stars === "number" && d.stars > 0) {
        s.sum += d.stars; s.rated++;
      }
      // Count anything with a non-empty bug field, regardless of the
      // legacy `hasBug` flag (older docs may not have it set).
      if (typeof d.bug === "string" && d.bug.trim().length > 0) s.bugs++;
    }
    return out;
  }, [items]);

  const totalBugs = useMemo(
    () => items.reduce((n, d) => n + (typeof d.bug === "string" && d.bug.trim() ? 1 : 0), 0),
    [items]
  );

  const visible = useMemo(() => {
    return items.filter(d => {
      if (filterFeat !== "all" && d.feature !== filterFeat) return false;
      if ((d.stars || 0) < minStars) return false;
      if (onlyBugs && !(typeof d.bug === "string" && d.bug.trim())) return false;
      return true;
    });
  }, [items, filterFeat, minStars, onlyBugs]);

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
      <div className="gl-sezlabel">📊 Dashboard Master · panoramica</div>

      <div className="fb-stats-grid">
        {FEATURES.map(f => {
          const s = stats[f.key];
          const avg = s.rated > 0 ? (s.sum / s.rated).toFixed(2) : "—";
          return (
            <div
              key={f.key}
              className={`nx-pannello fb-stat-card ${s.bugs > 0 ? "fb-stat-card--bug" : ""}`}
            >
              <div className="fb-stat-feat">{f.label}</div>
              <div className="fb-stat-row">
                <span className="fb-stat-avg">{avg}{s.rated > 0 ? " ★" : ""}</span>
                <span className="fb-stat-count">{s.count} feedback</span>
              </div>
              {s.bugs > 0 && (
                <button
                  type="button"
                  className="fb-stat-bug"
                  onClick={() => { setFilterFeat(f.key); setOnlyBugs(true); }}
                  title="Filtra solo i bug di questa funzionalità"
                >
                  🐛 {s.bugs} bug
                </button>
              )}
            </div>
          );
        })}
      </div>

      {totalBugs > 0 && (
        <div className="fb-bug-banner">
          🐛 <strong>{totalBugs}</strong> segnalazion{totalBugs === 1 ? "e" : "i"} bug aperte.
          {!onlyBugs && (
            <button
              type="button"
              className="fb-bug-banner-btn"
              onClick={() => { setOnlyBugs(true); setFilterFeat("all"); }}
            >
              Mostrale tutte →
            </button>
          )}
        </div>
      )}

      <div className="gl-sezlabel">📜 Tutti i feedback</div>

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
        <label className="fb-filter-bug">
          <input
            type="checkbox"
            checked={onlyBugs}
            onChange={e => setOnlyBugs(e.target.checked)}
          />
          🐛 Solo bug
        </label>
        <span className="fb-filter-count">{visible.length} risultati</span>
      </div>

      {visible.length === 0 ? (
        <p className="fb-empty">Nessun feedback corrisponde ai filtri.</p>
      ) : (
        <ul className="nx-griglia nx-griglia--larga fb-list">
          {visible.map(d => (
            <li key={d.id} className="nx-pannello fb-row">
              <div className="fb-row-head">
                <span className="nx-nome fb-row-feat">{d.featureLabel || FEATURE_LABEL[d.feature] || d.feature}</span>
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
              {d.bug && (
                <p className="fb-bug-block">
                  <span className="fb-bug-tag">🐛 BUG</span>
                  <span className="fb-bug-text">{d.bug}</span>
                </p>
              )}
              {d.message && <p className="fb-row-msg">"{d.message}"</p>}
              {(d.pros?.length > 0 || d.cons?.length > 0) && (
                <div className="fb-row-chips">
                  {(d.pros || []).map(p => <span key={p} className="fb-chip fb-chip--on">✓ {p}</span>)}
                  {(d.cons || []).map(c => <span key={c} className="fb-chip fb-chip--on fb-chip--con">✗ {c}</span>)}
                </div>
              )}
              <div className="fb-row-meta">Aggiornato {formatDate(d.updatedAt)} · Creato {formatDate(d.createdAt)}</div>
              <MasterReplyBlock feedback={d} />
              <MasterReplyForm feedback={d} masterUser={masterUser} />
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
  useParallaxScroll();
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
      <section className="cine-page fb-page" style={{ "--cine-accent": "#8b5cf6", "--cine-accent-2": "#c4b5fd" }}>
        <div className="fb-locked-wrap nx-testata">
          <span className="nx-kicker">La tua voce conta</span>
          <h1 className="nx-titolo fb-title">Feedback</h1>
          <p className="nx-pannello fb-locked">Accedi per lasciare un feedback.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="cine-page fb-page" style={{ "--cine-accent": "#8b5cf6", "--cine-accent-2": "#c4b5fd" }}>
      {/* ── VARCO (prototipo J): Milo nel portale esagonale ── */}
      <GlacierHero
        className="fb-glhero"
        ariaLabel="Feedback"
        image={HERO_IMAGE}
        eyebrow="La tua voce conta"
        title="Feedback"
        tagline="Valuta ogni funzionalità, scegli pro e contro, lascia un messaggio. Puoi modificare il tuo feedback quando vuoi."
      />

      <div className="fb-body">
        <section className="fb-sezione">
          <div className="gl-sezlabel">📝 Lascia il tuo feedback</div>
          <div className="nx-pannello fb-panel">
            <PlayerForm currentUser={currentUser} characterName={characterName} />
          </div>
        </section>

        <section className="fb-sezione">
          <div className="gl-sezlabel">📌 I tuoi feedback</div>
          <MyFeedbackList currentUser={currentUser} />
        </section>

        {isMaster && (
          <section className="fb-sezione fb-sezione--master">
            <MasterDashboard masterUser={currentUser} />
          </section>
        )}
      </div>
    </section>
  );
}
