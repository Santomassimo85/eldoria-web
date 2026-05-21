/* DeckBuilder — build/save a 60-card deck from the collection.
   Basic lands are free & unlimited; other cards up to 4 / owned.

   2026-05-20 — Added: type/rarity filters, sort options, mana-curve
   chart, colour/type distribution, "auto class deck" shortcut. */
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

/* CMC buckets for the curve chart (0 / 1 / 2 / 3 / 4 / 5 / 6+) */
const CURVE_BUCKETS = [0, 1, 2, 3, 4, 5, 6];

const TYPE_OPTIONS = [
  { id: "all",       label: "Tipi tutti" },
  { id: "creature",  label: "Creatura", icon: "🐾" },
  { id: "sorcery",   label: "Magia",    icon: "📜" }, // spell, non instant
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
  const klass = profile?.starterClass || null;
  const myColors = klass ? classColors(klass) : [];

  const [cover, setCoverLocal] = useState(profile?.cover || (myColors[0] || "nature"));
  const pickCover = (c) => { setCoverLocal(c); onSetCover && onSetCover(c); };
  const initial =
    profile?.deck && validateDeck(profile.deck, collection).ok
      ? profile.deck.slice()
      : (klass ? buildClassDeck(myColors) : autoDeck(collection, null));

  const [deck, setDeck] = useState(initial);
  const [msg, setMsg] = useState("");
  // class filter: a Set of selected class keys. Empty = show all.
  // Multi-select so the player can browse cards across 2+ classes
  // when building a multi-class deck by hand.
  const [klassFilter, setKlassFilter] = useState(() => new Set());
  // class mix for auto-build: independent from the grid filter.
  const [mixSel, setMixSel] = useState(() => new Set());
  const [typeFilter, setTypeFilter] = useState("all");
  const [rarFilter, setRarFilter] = useState("all");
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

  /* Build a deck tailored for ANY class from the player's owned cards.
     The smart builder (autoClassDeck) prefers higher rarity, peaks at
     CMC 2-3 and balances creature/spell/artifact ratios. Lands are
     split between the class' 2 colours proportional to the chosen
     cards' coloured-mana demand. */
  const buildForClass = (k) => {
    setMsg("");
    if (!k) return;
    const next = autoClassDeck(collection, k);
    setDeck(next);
    const owned = next.filter((id) => {
      const c = getCard(id);
      return c && c.type !== "land";
    }).length;
    if (owned < 30) {
      setMsg(`ℹ️ Hai poche carte ${CLASS_LABEL[k]} nel collezionato: il builder ha completato col fallback. Apri pacchetti ${CLASS_LABEL[k]} nel Negozio.`);
    }
  };

  const toggleMix = (k) => {
    setMsg("");
    setMixSel((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };
  const buildMix = () => {
    setMsg("");
    const list = [...mixSel];
    if (list.length < 2) { setMsg("Seleziona almeno 2 classi per il mix."); return; }
    setDeck(autoMixDeck(collection, list));
  };
  const buildRandomMix = () => {
    setMsg("");
    // pick 2-3 random classes (60% chance 2, 40% chance 3)
    const n = Math.random() < 0.6 ? 2 : 3;
    const pool = CLASSES.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const pick = pool.slice(0, n);
    setMixSel(new Set(pick));
    setDeck(autoMixDeck(collection, pick));
    setMsg(`🎲 Mix casuale: ${pick.map((k) => CLASS_LABEL[k]).join(" + ")}`);
  };

  const clearDeck = () => { setMsg(""); setDeck([]); };
  const toggleKlassFilter = (k) => {
    setKlassFilter((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };
  const clearKlassFilter = () => setKlassFilter(new Set());

  const save = async () => {
    const res = await onSave(deck);
    if (res?.ok) setMsg("✅ Mazzo salvato.");
    else setMsg("⚠️ " + (res?.errors?.[0] || "Mazzo non valido."));
  };

  /* filtered + sorted card list shown in the collection grid */
  const owned = useMemo(() => {
    let list = POOL.filter((id) => (collection[id] || 0) > 0);
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
      // default cmc asc
      return (ca.cmc - cb.cmc) || ca.name.localeCompare(cb.name);
    };
    return list.sort(cmp);
  }, [collection, klassFilter, typeFilter, rarFilter, sortBy]);

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

      {klass && (
        <div className="tcg-deck__klass">
          <span className="tcg-deck__klass-ico">{CLASS_ICON[klass]}</span>
          <span className="tcg-deck__klass-name">
            <b>Classe: {CLASS_LABEL[klass]}</b>
          </span>
        </div>
      )}

      <div className="tcg-deck__tools">
        <span className="tcg-deck__autolbl">Auto-crea (1 classe):</span>
        {CLASSES.map((k) => {
          const isMine = k === klass;
          return (
            <button
              key={k}
              className={`tcg-chipbtn ${isMine ? "tcg-chipbtn--accent" : ""}`}
              onClick={() => buildForClass(k)}
              title={`Costruisci un mazzo ${CLASS_LABEL[k]}`}
            >
              {isMine ? "⭐ " : ""}{CLASS_ICON[k]} {CLASS_LABEL[k]}
            </button>
          );
        })}
        <span className="tcg-deck__autosep" aria-hidden="true">·</span>
        <button className="tcg-chipbtn tcg-chipbtn--danger" onClick={clearDeck}>🗑 Svuota</button>
      </div>

      <div className="tcg-deck__tools">
        <span className="tcg-deck__autolbl">Mix di classi (manuale):</span>
        {CLASSES.map((k) => (
          <button
            key={k}
            className={`tcg-chipbtn ${mixSel.has(k) ? "is-on" : ""}`}
            onClick={() => toggleMix(k)}
            title={`Includi ${CLASS_LABEL[k]} nel mix`}
          >
            {CLASS_ICON[k]} {CLASS_LABEL[k]}
          </button>
        ))}
        <button
          className="tcg-chipbtn tcg-chipbtn--accent"
          onClick={buildMix}
          disabled={mixSel.size < 2}
          title="Costruisci un mazzo combinando le classi selezionate"
        >
          🛠 Costruisci mix ({mixSel.size})
        </button>
        <span className="tcg-deck__autosep" aria-hidden="true">·</span>
        <button
          className="tcg-chipbtn"
          onClick={buildRandomMix}
          title="Scegli 2-3 classi a caso e costruisci il mix"
        >
          🎲 Mix casuale
        </button>
      </div>

      <div className="tcg-cover">
        <span className="tcg-deck__autolbl">Dorso del mazzo:</span>
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

      {msg && <p className="tcg-deck__msg">{msg}</p>}
      {!v.ok && deck.length > 0 && (
        <p className="tcg-deck__msg tcg-deck__msg--warn">{v.errors[0]}</p>
      )}

      <div className="tcg-deck__main">
        {/* ---- collection (click to add) ---- */}
        <div className="tcg-deck__col">
          <div className="tcg-deck__lands-strip">
            <span className="tcg-deck__sub">Terre base (illimitate)</span>
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

          {/* ── Filters ── */}
          <div className="tcg-deck__filters">
            <div className="tcg-coll__filters tcg-coll__filters--mini">
              <button
                className={`tcg-chipbtn ${klassFilter.size === 0 ? "is-on" : ""}`}
                onClick={clearKlassFilter}
                title="Mostra carte di tutte le classi"
              >Tutte</button>
              {CLASSES.map((k) => (
                <button
                  key={k}
                  className={`tcg-chipbtn ${klassFilter.has(k) ? "is-on" : ""}`}
                  onClick={() => toggleKlassFilter(k)}
                  title={`Filtra per ${CLASS_LABEL[k]} (puoi selezionarne più di una per il mix)`}
                >
                  {CLASS_ICON[k]} {CLASS_LABEL[k]}
                </button>
              ))}
            </div>
            <div className="tcg-coll__filters tcg-coll__filters--mini">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  className={`tcg-chipbtn ${typeFilter === t.id ? "is-on" : ""}`}
                  onClick={() => setTypeFilter(t.id)}
                  title={t.label}
                >
                  {t.icon ? t.icon + " " : ""}{t.label}
                </button>
              ))}
            </div>
            <div className="tcg-coll__filters tcg-coll__filters--mini">
              {RARITY_OPTIONS.map((r) => (
                <button
                  key={r}
                  className={`tcg-chipbtn ${rarFilter === r ? "is-on" : ""}`}
                  onClick={() => setRarFilter(r)}
                  style={r !== "all" ? { borderColor: RARITY_COLOR[r] } : undefined}
                  title={r === "all" ? "Tutte le rarità" : RARITY_LABEL[r]}
                >
                  {r === "all" ? "Rarità" : RARITY_LABEL[r]}
                </button>
              ))}
            </div>
            <div className="tcg-deck__sort">
              <label>
                Ordina:
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </label>
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
                    onInspect={setZoom}
                  />
                  <span className="tcg-grid__count">
                    {inDeck}/{Math.min(cap, collection[id])} · hai {collection[id]}
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
              {/* Mana curve bar chart */}
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

              {/* Colour distribution */}
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

              {/* Type distribution */}
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
            <p className="tcg-grid__empty">Mazzo vuoto. Usa "Auto-crea" o aggiungi carte.</p>
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
