/* DeckBuilder — build/save a 60-card deck from the collection.
   Basic lands are free & unlimited; other cards up to 4 / owned.

   2026-05-21 — Unified class selection: the same multi-select drives
   the grid filter AND the auto-build (1 = single-class, 2+ = mix).
   Toolbar consolidated into one strip; lands moved next to the grid. */
import React, { useMemo, useState } from "react";
import CardView from "./CardView.jsx";
import CardZoom from "./CardZoom.jsx";
import {
  POOL, LANDS, getCard, ELEMENTS, ELEMENT_LABEL, ELEMENT_ICON, ELEMENT_PIP,
  DECK_SIZE, COVERS, coverUrl, RARITY_ORDER, RARITY_LABEL, RARITY_COLOR,
  buildClassDeck,
} from "../../tcg/cards.js";
import {
  deckCounts, maxAllowed, autoDeck, autoClassDeck, autoMixDeck, validateDeck,
} from "../../tcg/collection.js";
import {
  CLASSES, CLASS_LABEL, CLASS_ICON, classColors,
} from "../../tcg/classes.js";

/* one-liner playstyle hint per class — shown on the auto-build buttons'
   tooltip so the player understands what kind of deck they'll get. */
const CLASS_BLURB = {
  mago:      "Caster pieno: 46% creature, 46% spell, 23 terre, curva 2-4.",
  guerriero: "Aggro marziale: 72% creature di basso costo, 22 terre.",
  chierico:  "Semi-caster sostegno: 56% creature, 36% spell di cura, 24 terre.",
  ladro:     "Tempo: 58% creature evasive, 34% reazioni, 22 terre.",
  druido:    "Ramp: 62% creature massicce, 26 terre, curva 3-5.",
};

/* CMC buckets for the curve chart (0 / 1 / 2 / 3 / 4 / 5 / 6+) */
const CURVE_BUCKETS = [0, 1, 2, 3, 4, 5, 6];

const TYPE_OPTIONS = [
  { id: "all",       label: "Tutti", icon: "✦" },
  { id: "creature",  label: "Creatura", icon: "🐾" },
  { id: "sorcery",   label: "Magia",    icon: "📜" },
  { id: "instant",   label: "Reazione", icon: "⚡" },
  { id: "artifact",  label: "Manufatto", icon: "💠" },
];
const RARITY_OPTIONS = ["all", ...RARITY_ORDER];
const SORT_OPTIONS = [
  { id: "cmc",     label: "CMC ↑" },
  { id: "cmcDesc", label: "CMC ↓" },
  { id: "name",    label: "Nome A→Z" },
  { id: "rarity",  label: "Rarità ↑" },
];

/* Card's "card kind" for filtering — splits spells into sorcery/instant */
function cardKind(c) {
  if (c.type === "spell") return c.speed === "instant" ? "instant" : "sorcery";
  return c.type;
}

function matchType(card, typeFilter) {
  if (typeFilter === "all") return true;
  return cardKind(card) === typeFilter;
}

function matchRarity(card, rarFilter) {
  if (rarFilter === "all") return true;
  return card.rarity === rarFilter;
}

export default function DeckBuilder({ profile, onSave, onSetCover, onBack }) {
  const collection = useMemo(() => profile?.collection || {}, [profile]);
  // foils[id] = how many foil copies the player owns of that card. The
  // total in `collection` includes the foils — owning 4 copies with 1
  // foil shows up as collection[id]=4 + foils[id]=1.
  const foils = useMemo(() => profile?.foils || {}, [profile]);
  const klass = profile?.starterClass || null;
  const myColors = klass ? classColors(klass) : [];

  const [cover, setCoverLocal] = useState(profile?.cover || (myColors[0] || "nature"));
  const pickCover = (c) => { setCoverLocal(c); onSetCover && onSetCover(c); };
  const initial =
    profile?.deck && validateDeck(profile.deck, collection).ok
      ? profile.deck.slice()
      : (klass ? buildClassDeck(myColors, klass) : autoDeck(collection, null));

  const [deck, setDeck] = useState(initial);
  const [msg, setMsg] = useState("");
  // ONE class selector — empty Set means "all classes". It drives BOTH
  // the grid filter and the auto-build: 0 selected = random, 1 = single
  // class deck, 2+ = mix. No more split between filter and mix state.
  const [klassFilter, setKlassFilter] = useState(() => new Set());
  const [typeFilter, setTypeFilter] = useState("all");
  const [rarFilter, setRarFilter] = useState("all");
  // when on, the grid shows ONLY cards the player owns at least one foil
  // copy of — useful for showing off / building a "premium" deck even
  // though the engine treats foil & regular copies as identical.
  const [foilOnly, setFoilOnly] = useState(false);
  const totalFoils = useMemo(
    () => Object.values(foils).reduce((n, x) => n + (x || 0), 0),
    [foils]
  );
  const [sortBy, setSortBy] = useState("cmc");
  const [zoom, setZoom] = useState(null);

  const counts = useMemo(() => deckCounts(deck), [deck]);
  const landTotal = useMemo(
    () => deck.filter((id) => getCard(id)?.type === "land").length,
    [deck]
  );
  const v = useMemo(() => validateDeck(deck, collection), [deck, collection]);

  /* deck statistics for the side panel */
  const stats = useMemo(() => {
    const curve = CURVE_BUCKETS.map(() => 0);
    const byEl = {}; for (const el of ELEMENTS) byEl[el] = 0;
    const byKind = { creature: 0, sorcery: 0, instant: 0, artifact: 0, land: 0 };
    let nonLand = 0;
    for (const id of deck) {
      const c = getCard(id);
      if (!c) continue;
      byKind[cardKind(c)] = (byKind[cardKind(c)] || 0) + 1;
      if (c.type === "land") {
        byEl[c.element] = (byEl[c.element] || 0) + 1;
        continue;
      }
      nonLand++;
      const idx = Math.min(c.cmc || 0, 6);
      curve[idx] += 1;
      if (c.element) byEl[c.element] = (byEl[c.element] || 0) + 1;
    }
    const curveMax = Math.max(1, ...curve);
    return { curve, curveMax, byEl, byKind, nonLand };
  }, [deck]);

  const add = (id) => {
    setMsg("");
    if (deck.length >= DECK_SIZE) { setMsg(`Il mazzo è già di ${DECK_SIZE} carte.`); return; }
    if ((counts[id] || 0) >= maxAllowed(collection, id)) {
      if (getCard(id).type !== "land") {
        setMsg("Non hai altre copie disponibili.");
        return;
      }
    }
    setDeck((d) => [...d, id]);
  };
  const removeOne = (id) => {
    setMsg("");
    setDeck((d) => {
      const i = d.lastIndexOf(id);
      if (i < 0) return d;
      const n = d.slice();
      n.splice(i, 1);
      return n;
    });
  };

  const toggleKlass = (k) => {
    setMsg("");
    setKlassFilter((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };
  const clearKlass = () => { setMsg(""); setKlassFilter(new Set()); };

  /* "Costruisci" — smart auto-build based on how many classes are selected:
       0 → random deck across the whole collection
       1 → single-class deck (autoClassDeck — rarity-weighted, curve 2-3)
       2+ → mix deck (autoMixDeck — merges the colours, ramps lands)        */
  const buildAuto = () => {
    setMsg("");
    const list = [...klassFilter];
    if (list.length === 0) {
      setDeck(autoDeck(collection, "random"));
      setMsg("🎲 Mazzo casuale costruito.");
      return;
    }
    if (list.length === 1) {
      const k = list[0];
      const next = autoClassDeck(collection, k);
      setDeck(next);
      const owned = next.filter((id) => {
        const c = getCard(id);
        return c && c.type !== "land";
      }).length;
      if (owned < 30) {
        setMsg(`ℹ️ Poche carte ${CLASS_LABEL[k]} nel collezionato: completato col fallback. Apri pacchetti ${CLASS_LABEL[k]} nel Negozio.`);
      } else {
        setMsg(`✓ Mazzo ${CLASS_LABEL[k]} costruito.`);
      }
      return;
    }
    setDeck(autoMixDeck(collection, list));
    setMsg(`🛠 Mix costruito: ${list.map((k) => CLASS_LABEL[k]).join(" + ")}.`);
  };

  /* Dedicated "create deck for class X" — independent of klassFilter.
     Always uses autoClassDeck (which reads CLASS_BUILD_PROFILE for
     type ratios / lands / curve), and also flips the filter to that
     class so the grid below highlights what's in the new deck. */
  const buildForClass = (k) => {
    setMsg("");
    const next = autoClassDeck(collection, k);
    setDeck(next);
    setKlassFilter(new Set([k]));
    const owned = next.filter((id) => {
      const c = getCard(id);
      return c && c.type !== "land";
    }).length;
    if (owned < 30) {
      setMsg(`ℹ️ Mazzo ${CLASS_LABEL[k]} costruito col fallback (poche carte di quei colori). Apri pacchetti ${CLASS_LABEL[k]} nel Negozio.`);
    } else {
      setMsg(`✓ Mazzo ${CLASS_LABEL[k]} ottimizzato (${CLASS_BLURB[k]}).`);
    }
  };

  const buildRandomMix = () => {
    setMsg("");
    const n = Math.random() < 0.6 ? 2 : 3;
    const pool = CLASSES.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const pick = pool.slice(0, n);
    setKlassFilter(new Set(pick));
    setDeck(autoMixDeck(collection, pick));
    setMsg(`🎲 Mix casuale: ${pick.map((k) => CLASS_LABEL[k]).join(" + ")}.`);
  };

  const clearDeck = () => { setMsg(""); setDeck([]); };

  const save = async () => {
    const res = await onSave(deck);
    if (res?.ok) setMsg("✅ Mazzo salvato.");
    else setMsg("⚠️ " + (res?.errors?.[0] || "Mazzo non valido."));
  };

  /* filtered + sorted card list shown in the collection grid */
  const owned = useMemo(() => {
    let list = POOL.filter((id) => (collection[id] || 0) > 0);
    if (foilOnly) list = list.filter((id) => (foils[id] || 0) > 0);
    if (klassFilter.size > 0) {
      const allowed = new Set();
      for (const k of klassFilter) for (const el of classColors(k)) allowed.add(el);
      list = list.filter((id) => allowed.has(getCard(id).element));
    }
    list = list.filter((id) => matchType(getCard(id), typeFilter));
    list = list.filter((id) => matchRarity(getCard(id), rarFilter));
    const cmp = (a, b) => {
      const ca = getCard(a), cb = getCard(b);
      if (sortBy === "name")   return ca.name.localeCompare(cb.name);
      if (sortBy === "rarity") return RARITY_ORDER.indexOf(ca.rarity) - RARITY_ORDER.indexOf(cb.rarity);
      if (sortBy === "cmcDesc") return (cb.cmc - ca.cmc) || ca.name.localeCompare(cb.name);
      return (ca.cmc - cb.cmc) || ca.name.localeCompare(cb.name);
    };
    return list.sort(cmp);
  }, [collection, foils, foilOnly, klassFilter, typeFilter, rarFilter, sortBy]);

  // deck list grouped, lands last, by cmc
  const grouped = useMemo(() => {
    const ids = [...new Set(deck)];
    return ids.sort((a, b) => {
      const ca = getCard(a), cb = getCard(b);
      const la = ca.type === "land" ? 1 : 0, lb = cb.type === "land" ? 1 : 0;
      if (la !== lb) return la - lb;
      return ca.cmc - cb.cmc || ca.name.localeCompare(cb.name);
    });
  }, [deck]);

  const buildLabel =
    klassFilter.size === 0
      ? "🎲 Costruisci casuale"
      : klassFilter.size === 1
      ? `🛠 Costruisci ${CLASS_LABEL[[...klassFilter][0]]}`
      : `🛠 Costruisci mix (${klassFilter.size})`;

  return (
    <div className="tcg-deck">
      <div className="tcg-doc__head">
        <button className="tcg-btn tcg-btn--ghost" onClick={onBack}>‹ Indietro</button>
        <h1 className="tcg-doc__title">
          🛠️ Mazzo&nbsp;
          <span className={deck.length === DECK_SIZE ? "is-ok" : "is-warn"}>
            {deck.length}/{DECK_SIZE}
          </span>
          <span className="tcg-deck__lands">· {landTotal} terre</span>
        </h1>
        <button className="tcg-btn tcg-btn--primary" onClick={save}>
          💾 Salva
        </button>
      </div>

      {/* ── unified toolbar: classes drive BOTH filter AND auto-build ── */}
      <div className="tcg-deck__bar">
        <div className="tcg-deck__bar-row">
          <span className="tcg-deck__barlbl">
            Classi{klass ? ` · la tua: ${CLASS_ICON[klass]} ${CLASS_LABEL[klass]}` : ""}
          </span>
          <button
            className={`tcg-chipbtn ${klassFilter.size === 0 ? "is-on" : ""}`}
            onClick={clearKlass}
            title="Mostra carte di tutte le classi"
          >Tutte</button>
          {CLASSES.map((k) => {
            const isMine = k === klass;
            return (
              <button
                key={k}
                className={`tcg-chipbtn ${klassFilter.has(k) ? "is-on" : ""} ${isMine ? "tcg-chipbtn--accent" : ""}`}
                onClick={() => toggleKlass(k)}
                title={`${CLASS_LABEL[k]} — clicca per filtrare e impostare l'auto-build (puoi selezionarne più di una per il mix)`}
              >
                {isMine ? "⭐ " : ""}{CLASS_ICON[k]} {CLASS_LABEL[k]}
              </button>
            );
          })}
          <span className="tcg-deck__autosep" aria-hidden="true">·</span>
          <button
            className="tcg-chipbtn tcg-chipbtn--accent"
            onClick={buildAuto}
            title="Costruisci automaticamente in base alle classi selezionate"
          >
            {buildLabel}
          </button>
          <button
            className="tcg-chipbtn"
            onClick={buildRandomMix}
            title="Scegli 2-3 classi a caso e costruisci il mix"
          >
            🎲 Mix casuale
          </button>
          <button className="tcg-chipbtn tcg-chipbtn--danger" onClick={clearDeck}>
            🗑 Svuota
          </button>
        </div>

        {/* ── Dedicated auto-build row: pick a class, get an optimised
            deck instantly. Uses the class build profiles in collection.js
            (CLASS_BUILD_PROFILE) so each class plays its own way. ── */}
        <div className="tcg-deck__bar-row tcg-deck__bar-row--build">
          <span className="tcg-deck__barlbl">🛠 Crea mazzo per</span>
          {CLASSES.map((k) => {
            const isMine = k === klass;
            return (
              <button
                key={`build-${k}`}
                className={`tcg-chipbtn tcg-chipbtn--build ${isMine ? "tcg-chipbtn--accent" : ""}`}
                onClick={() => buildForClass(k)}
                title={`${CLASS_LABEL[k]} — ${CLASS_BLURB[k]}`}
              >
                {isMine ? "⭐ " : ""}{CLASS_ICON[k]} {CLASS_LABEL[k]}
              </button>
            );
          })}
          <span className="tcg-deck__autosep" aria-hidden="true">·</span>
          <span className="tcg-deck__buildhint">
            Costruzione ottimizzata: curva, ratio creature/spell e numero di
            terre tarati allo stile della classe.
          </span>
        </div>

        <div className="tcg-deck__bar-row">
          <span className="tcg-deck__barlbl">Tipo</span>
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t.id}
              className={`tcg-chipbtn ${typeFilter === t.id ? "is-on" : ""}`}
              onClick={() => setTypeFilter(t.id)}
              title={t.label}
            >
              {t.icon} {t.label}
            </button>
          ))}
          <span className="tcg-deck__autosep" aria-hidden="true">·</span>
          <span className="tcg-deck__barlbl">Rarità</span>
          {RARITY_OPTIONS.map((r) => (
            <button
              key={r}
              className={`tcg-chipbtn ${rarFilter === r ? "is-on" : ""}`}
              onClick={() => setRarFilter(r)}
              style={r !== "all" ? { borderColor: RARITY_COLOR[r] } : undefined}
              title={r === "all" ? "Tutte le rarità" : RARITY_LABEL[r]}
            >
              {r === "all" ? "Tutte" : RARITY_LABEL[r]}
            </button>
          ))}
          {/* Foil toggle — only meaningful when the player actually has
              foils; disable & explain when they don't. The chip shows
              the foil-shimmer styling when active. */}
          <button
            className={`tcg-chipbtn tcg-chipbtn--foil ${foilOnly ? "is-on" : ""}`}
            onClick={() => setFoilOnly((v) => !v)}
            disabled={totalFoils === 0}
            title={
              totalFoils === 0
                ? "Non possiedi ancora carte foil. Aprine qualche pacchetto!"
                : foilOnly
                ? "Mostra di nuovo tutta la collezione"
                : `Mostra solo le carte di cui possiedi una versione foil (${totalFoils})`
            }
          >
            ✨ Foil{totalFoils > 0 ? ` (${totalFoils})` : ""}
          </button>
          <span className="tcg-deck__autosep" aria-hidden="true">·</span>
          <label className="tcg-deck__sortlbl">
            Ordina:
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <span className="tcg-deck__autosep" aria-hidden="true">·</span>
          <span className="tcg-deck__barlbl">Dorso</span>
          <div className="tcg-cover tcg-cover--inline">
            {COVERS.map((c) => (
              <button
                key={c}
                className={`tcg-cover__opt ${cover === c ? "is-on" : ""}`}
                title={ELEMENT_LABEL[c]}
                onClick={() => pickCover(c)}
              >
                <img src={coverUrl(c)} alt={ELEMENT_LABEL[c]} draggable={false} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {msg && <p className="tcg-deck__msg">{msg}</p>}
      {!v.ok && deck.length > 0 && (
        <p className="tcg-deck__msg tcg-deck__msg--warn">{v.errors[0]}</p>
      )}

      <div className="tcg-deck__main">
        {/* ---- collection (click to add) ---- */}
        <div className="tcg-deck__col">
          <div className="tcg-deck__lands-strip">
            <span className="tcg-deck__sub">Terre base (illimitate) — click per aggiungere</span>
            <div className="tcg-deck__landrow">
              {LANDS.map((l) => (
                <button
                  key={l.id}
                  className="tcg-landbtn"
                  onClick={() => add(l.id)}
                  title={`Aggiungi ${l.name}`}
                >
                  <CardView card={l} variant="land" />
                  <span className="tcg-landbtn__n">{counts[l.id] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="tcg-grid tcg-grid--build">
            {owned.length === 0 && (
              <p className="tcg-grid__empty">
                Nessuna carta corrisponde ai filtri. Apri pacchetti nel Negozio o
                allarga la ricerca.
              </p>
            )}
            {owned.map((id) => {
              const inDeck = counts[id] || 0;
              const cap = maxAllowed(collection, id);
              return (
                <div
                  key={id}
                  className={`tcg-grid__cell ${inDeck >= cap ? "is-maxed" : ""}`}
                  onClick={() => add(id)}
                  title="Click: aggiungi al mazzo"
                >
                  <button
                    className="tcg-grid__zoom"
                    title="Ingrandisci"
                    onClick={(e) => { e.stopPropagation(); setZoom(getCard(id)); }}
                  >
                    🔍
                  </button>
                  <CardView
                    card={getCard(id)}
                    variant="board"
                    foil={(foils[id] || 0) > 0}
                    onInspect={setZoom}
                  />
                  <span className="tcg-grid__count">
                    {inDeck}/{Math.min(cap, collection[id])} · hai {collection[id]}
                    {(foils[id] || 0) > 0 && (
                      <span className="tcg-grid__foilmark" title={`${foils[id]} foil`}>
                        {" "}✨{foils[id]}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- current deck (click to remove) + stats ---- */}
        <div className="tcg-deck__list">
          <span className="tcg-deck__sub">Mazzo — click per togliere</span>

          {/* ── Stats panel ── */}
          {deck.length > 0 && (
            <div className="tcg-deck__stats">
              <div className="tcg-curve">
                <div className="tcg-curve__title">Curva di mana</div>
                <div className="tcg-curve__row">
                  {CURVE_BUCKETS.map((k) => (
                    <div className="tcg-curve__col" key={k} title={`${stats.curve[k]} carte`}>
                      <div
                        className="tcg-curve__bar"
                        style={{
                          height:
                            (stats.curve[k] / stats.curveMax) * 100 + "%",
                        }}
                      />
                      <div className="tcg-curve__n">{stats.curve[k]}</div>
                      <div className="tcg-curve__lbl">
                        {k === 6 ? "6+" : k}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="tcg-dist">
                <div className="tcg-dist__title">Colori (con terre)</div>
                <div className="tcg-dist__row">
                  {ELEMENTS.map((el) => stats.byEl[el] > 0 && (
                    <span
                      key={el}
                      className="tcg-dist__chip"
                      style={{ "--pip": ELEMENT_PIP[el] }}
                    >
                      {ELEMENT_ICON[el]} {stats.byEl[el]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="tcg-dist">
                <div className="tcg-dist__title">Tipi</div>
                <div className="tcg-dist__row">
                  <span className="tcg-dist__chip">🐾 {stats.byKind.creature || 0}</span>
                  <span className="tcg-dist__chip">📜 {stats.byKind.sorcery || 0}</span>
                  <span className="tcg-dist__chip">⚡ {stats.byKind.instant || 0}</span>
                  <span className="tcg-dist__chip">💠 {stats.byKind.artifact || 0}</span>
                  <span className="tcg-dist__chip">⛰️ {stats.byKind.land || 0}</span>
                </div>
              </div>
            </div>
          )}

          {grouped.length === 0 && (
            <p className="tcg-grid__empty">Mazzo vuoto. Scegli classi e premi "Costruisci", oppure aggiungi carte.</p>
          )}
          {grouped.map((id) => {
            const c = getCard(id);
            return (
              <button
                key={id}
                className={`tcg-deckrow tcg-deckrow--${c.type}`}
                onClick={() => removeOne(id)}
              >
                <span className="tcg-deckrow__n">{counts[id]}×</span>
                <span className="tcg-deckrow__name">{c.name}</span>
                <span className="tcg-deckrow__cmc">
                  {c.type === "land" ? "⟳" : c.cmc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <CardZoom card={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
