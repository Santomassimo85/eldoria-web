/* Collection — full card catalogue, grouped by colour.
   Shows EVERY existing card (POOL): owned cards display the player's
   copy count; missing cards are greyed out with ✕. Filters by tipo /
   rarità / classe / sottoclasse + search + possedute/mancanti toggle. */
import React, { useMemo, useState } from "react";
import CardView from "./CardView.jsx";
import CardZoom from "./CardZoom.jsx";
import {
  POOL, getCard, ELEMENTS, ELEMENT_LABEL, ELEMENT_ICON, ELEMENT_PIP,
  RARITY_ORDER, RARITY_LABEL, RARITY_COLOR,
} from "../../tcg/cards.js";
import {
  CLASSES, CLASS_LABEL, CLASS_ICON, CLASS_VIE, classColors,
} from "../../tcg/classes.js";

const TYPE_OPTIONS = [
  { id: "creature", label: "Creature",   icon: "🐾" },
  { id: "spell",    label: "Magie",      icon: "📜" },
  { id: "artifact", label: "Manufatti",  icon: "💠" },
];

export default function Collection({ profile, onBack }) {
  const collection = useMemo(() => profile?.collection || {}, [profile]);
  const foils = useMemo(() => profile?.foils || {}, [profile]);
  const [zoom, setZoom] = useState(null);

  // filter state
  const [query, setQuery]   = useState("");
  const [fType, setFType]   = useState("all");          // all | creature | spell | artifact
  const [fRar, setFRar]     = useState("all");          // all | common | uncommon | rare | epic | legendary
  const [fKlass, setFKlass] = useState("all");          // all | mago | guerriero | …
  const [fVia, setFVia]     = useState("all");          // all | <via-id of selected class>
  const [fOwn, setFOwn]     = useState("all");          // all | owned | missing

  // when class changes, reset its sub-class
  const onPickClass = (k) => {
    setFKlass(k);
    setFVia("all");
  };

  // build (filtered, sorted) pool ONCE
  const filteredIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    const classElements = fKlass === "all" ? null : new Set(classColors(fKlass));
    const viaElement = (fKlass !== "all" && fVia !== "all")
      ? CLASS_VIE[fKlass]?.[fVia]?.element
      : null;

    return POOL.filter((id) => {
      const c = getCard(id);
      if (!c) return false;
      if (fType !== "all" && c.type !== fType) return false;
      if (fRar  !== "all" && c.rarity !== fRar) return false;
      if (classElements && !classElements.has(c.element)) return false;
      if (viaElement && c.element !== viaElement) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      const owned = (collection[id] || 0) > 0;
      if (fOwn === "owned"   && !owned) return false;
      if (fOwn === "missing" &&  owned) return false;
      return true;
    });
  }, [query, fType, fRar, fKlass, fVia, fOwn, collection]);

  // group by element (color sections), each sorted by cmc then rarity
  const groups = useMemo(() => {
    const m = {};
    for (const el of ELEMENTS) m[el] = [];
    for (const id of filteredIds) {
      const c = getCard(id);
      m[c.element]?.push(id);
    }
    const rOrder = Object.fromEntries(RARITY_ORDER.map((r, i) => [r, i]));
    for (const el of ELEMENTS) {
      m[el].sort((a, b) => {
        const A = getCard(a), B = getCard(b);
        return (A.cmc - B.cmc)
            || ((rOrder[A.rarity] ?? 0) - (rOrder[B.rarity] ?? 0))
            || A.name.localeCompare(B.name);
      });
    }
    return m;
  }, [filteredIds]);

  // per-element ownership (owned uniques / total uniques) on the
  // UNFILTERED pool, so the player always sees the full picture.
  const elStats = useMemo(() => {
    const out = {};
    for (const el of ELEMENTS) out[el] = { owned: 0, total: 0, copies: 0 };
    for (const id of POOL) {
      const c = getCard(id);
      const n = collection[id] || 0;
      const s = out[c.element];
      if (!s) continue;
      s.total += 1;
      if (n > 0) s.owned += 1;
      s.copies += n;
    }
    return out;
  }, [collection]);

  // per-rarity ownership — owned uniques / total uniques per tier.
  // Lets the player see progress on the harder-to-pull rarities.
  const rarStats = useMemo(() => {
    const out = {};
    for (const r of RARITY_ORDER) out[r] = { owned: 0, total: 0 };
    for (const id of POOL) {
      const c = getCard(id);
      const r = c.rarity;
      const s = out[r];
      if (!s) continue;
      s.total += 1;
      if ((collection[id] || 0) > 0) s.owned += 1;
    }
    return out;
  }, [collection]);

  // grand totals (unfiltered)
  const totals = useMemo(() => {
    let copies = 0, uniques = 0;
    for (const id of POOL) {
      const n = collection[id] || 0;
      copies += n;
      if (n > 0) uniques += 1;
    }
    return { copies, uniques, pool: POOL.length };
  }, [collection]);

  const vie = fKlass !== "all" ? CLASS_VIE[fKlass] : null;

  return (
    <div className="tcg-coll">
      <div className="tcg-doc__head">
        <button className="tcg-btn tcg-btn--ghost" onClick={onBack}>
          ‹ Indietro
        </button>
        <h1 className="tcg-doc__title">📚 Collezione</h1>
        <span className="tcg-shop__coins">🪙 {profile?.coins ?? 0}</span>
      </div>

      {/* ── top stats: grand totals + per-element progress ───────── */}
      <div className="tcg-coll__stats">
        <div className="tcg-stat">
          <b>{totals.uniques}/{totals.pool}</b>
          <span>tipi diversi</span>
        </div>
        <div className="tcg-stat">
          <b>{totals.copies}</b>
          <span>carte totali</span>
        </div>
        {ELEMENTS.map((el) => {
          const s = elStats[el];
          const complete = s.owned === s.total;
          return (
            <div
              key={el}
              className={`tcg-stat tcg-stat--el ${complete ? "is-complete" : ""}`}
              style={{ borderColor: complete ? "var(--gold)" : undefined }}
              title={`${ELEMENT_LABEL[el]} — ${s.copies} copie totali`}
            >
              <b style={{ fontSize: 18 }}>
                {ELEMENT_ICON[el]} {s.owned}/{s.total}
              </b>
              <span>{ELEMENT_LABEL[el]}</span>
            </div>
          );
        })}
      </div>

      {/* ── per-rarity progress (uniques owned per tier) ──────────── */}
      <div className="tcg-coll__rarbar">
        <span className="tcg-coll__rarbar-lbl">Per rarità:</span>
        {RARITY_ORDER.map((r) => {
          const s = rarStats[r];
          const complete = s.total > 0 && s.owned === s.total;
          return (
            <div
              key={r}
              className={`tcg-coll__rarpip ${complete ? "is-complete" : ""}`}
              style={{ "--rar": RARITY_COLOR[r] }}
              title={`${RARITY_LABEL[r]} — ${s.owned} possedute su ${s.total}`}
            >
              <span className="tcg-coll__rardot" />
              <b>{s.owned}/{s.total}</b>
              <small>{RARITY_LABEL[r]}</small>
            </div>
          );
        })}
      </div>

      {/* ── filters ─────────────────────────────────────────────── */}
      <div className="tcg-coll__filterbar">
        <input
          type="search"
          className="tcg-coll__search"
          placeholder="🔍 Cerca per nome…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="tcg-coll__filtgroup">
          <span className="tcg-coll__filtlbl">Possedute</span>
          {[
            { id: "all",     label: "Tutte" },
            { id: "owned",   label: "Le mie" },
            { id: "missing", label: "Mancanti" },
          ].map((o) => (
            <button
              key={o.id}
              className={`tcg-chipbtn ${fOwn === o.id ? "is-on" : ""}`}
              onClick={() => setFOwn(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="tcg-coll__filtgroup">
          <span className="tcg-coll__filtlbl">Tipo</span>
          <button
            className={`tcg-chipbtn ${fType === "all" ? "is-on" : ""}`}
            onClick={() => setFType("all")}
          >
            Tutti
          </button>
          {TYPE_OPTIONS.map((o) => (
            <button
              key={o.id}
              className={`tcg-chipbtn ${fType === o.id ? "is-on" : ""}`}
              onClick={() => setFType(o.id)}
            >
              {o.icon} {o.label}
            </button>
          ))}
        </div>

        <div className="tcg-coll__filtgroup">
          <span className="tcg-coll__filtlbl">Rarità</span>
          <button
            className={`tcg-chipbtn ${fRar === "all" ? "is-on" : ""}`}
            onClick={() => setFRar("all")}
          >
            Tutte
          </button>
          {RARITY_ORDER.map((r) => (
            <button
              key={r}
              className={`tcg-chipbtn ${fRar === r ? "is-on" : ""}`}
              onClick={() => setFRar(r)}
              style={fRar === r
                ? undefined
                : { borderColor: RARITY_COLOR[r], color: RARITY_COLOR[r] }}
            >
              {RARITY_LABEL[r]}
            </button>
          ))}
        </div>

        <div className="tcg-coll__filtgroup">
          <span className="tcg-coll__filtlbl">Classe</span>
          <button
            className={`tcg-chipbtn ${fKlass === "all" ? "is-on" : ""}`}
            onClick={() => onPickClass("all")}
          >
            Tutte
          </button>
          {CLASSES.map((k) => (
            <button
              key={k}
              className={`tcg-chipbtn ${fKlass === k ? "is-on" : ""}`}
              onClick={() => onPickClass(k)}
              title={classColors(k).map((el) => ELEMENT_LABEL[el]).join(" + ")}
            >
              {CLASS_ICON[k]} {CLASS_LABEL[k]}
            </button>
          ))}
        </div>

        {vie && (
          <div className="tcg-coll__filtgroup">
            <span className="tcg-coll__filtlbl">Sottoclasse</span>
            <button
              className={`tcg-chipbtn ${fVia === "all" ? "is-on" : ""}`}
              onClick={() => setFVia("all")}
            >
              Tutte
            </button>
            {Object.entries(vie).map(([id, v]) => (
              <button
                key={id}
                className={`tcg-chipbtn ${fVia === id ? "is-on" : ""}`}
                onClick={() => setFVia(id)}
                title={`${v.dnd} — ${ELEMENT_LABEL[v.element]}`}
              >
                {ELEMENT_ICON[v.element]} {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── colour sections ─────────────────────────────────────── */}
      {ELEMENTS.every((el) => groups[el].length === 0) && (
        <p className="tcg-grid__empty">
          Nessuna carta corrisponde ai filtri selezionati.
        </p>
      )}

      {ELEMENTS.map((el) => {
        const ids = groups[el];
        if (!ids.length) return null;
        const ownedHere = ids.reduce(
          (n, id) => n + ((collection[id] || 0) > 0 ? 1 : 0), 0
        );
        return (
          <section key={el} className="tcg-coll__section">
            <h2
              className="tcg-coll__sectionhead"
              style={{ borderColor: ELEMENT_PIP[el], color: ELEMENT_PIP[el] }}
            >
              <span style={{ fontSize: 22 }}>{ELEMENT_ICON[el]}</span>
              <span>{ELEMENT_LABEL[el]}</span>
              <span className="tcg-coll__sectioncnt">
                {ownedHere}/{ids.length} possedute
              </span>
            </h2>

            <div className="tcg-grid">
              {ids.map((id) => {
                const card = getCard(id);
                const n = collection[id] || 0;
                const owned = n > 0;
                return (
                  <div
                    key={id}
                    className={`tcg-grid__cell ${owned ? "" : "is-missing"}`}
                  >
                    <button
                      className="tcg-grid__zoom"
                      title="Ingrandisci"
                      onClick={() => setZoom(card)}
                    >
                      🔍
                    </button>
                    <CardView
                      card={card}
                      variant="board"
                      foil={(foils[id] || 0) > 0}
                      onInspect={setZoom}
                      onClick={() => setZoom(card)}
                    />
                    <span className="tcg-grid__count">
                      {owned ? `×${n}` : "✕ mancante"}
                      {foils[id] ? ` · ✨${foils[id]}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <CardZoom card={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
