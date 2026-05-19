/* DeckBuilder — build/save a 60-card deck from the collection.
   Basic lands are free & unlimited; other cards up to 4 / owned. */
import React, { useMemo, useState } from "react";
import CardView from "./CardView.jsx";
import CardZoom from "./CardZoom.jsx";
import {
  POOL, LANDS, getCard, ELEMENTS, ELEMENT_LABEL, ELEMENT_ICON, DECK_SIZE,
  COVERS, coverUrl,
} from "../../tcg/cards.js";
import {
  deckCounts, maxAllowed, autoDeck, validateDeck,
} from "../../tcg/collection.js";

export default function DeckBuilder({ profile, onSave, onSetCover, onBack }) {
  const collection = useMemo(() => profile?.collection || {}, [profile]);
  const [cover, setCoverLocal] = useState(profile?.cover || "air");
  const pickCover = (c) => { setCoverLocal(c); onSetCover && onSetCover(c); };
  const initial =
    profile?.deck && validateDeck(profile.deck, collection).ok
      ? profile.deck.slice()
      : autoDeck(collection, null);

  const [deck, setDeck] = useState(initial);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("all");
  const [zoom, setZoom] = useState(null);

  const counts = useMemo(() => deckCounts(deck), [deck]);
  const landTotal = useMemo(
    () => deck.filter((id) => getCard(id)?.type === "land").length,
    [deck]
  );
  const v = useMemo(() => validateDeck(deck, collection), [deck, collection]);

  const add = (id) => {
    setMsg("");
    if (deck.length >= DECK_SIZE) { setMsg(`Il mazzo è già di ${DECK_SIZE} carte.`); return; }
    if ((counts[id] || 0) >= maxAllowed(collection, id)) {
      setMsg(getCard(id).type === "land" ? "" : "Non hai altre copie disponibili.");
      if (getCard(id).type !== "land") return;
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

  const auto = (focus) => { setMsg(""); setDeck(autoDeck(collection, focus)); };
  const clearDeck = () => { setMsg(""); setDeck([]); };

  const save = async () => {
    const res = await onSave(deck);
    if (res?.ok) setMsg("✅ Mazzo salvato.");
    else setMsg("⚠️ " + (res?.errors?.[0] || "Mazzo non valido."));
  };

  const owned = POOL.filter(
    (id) => (collection[id] || 0) > 0 &&
      (filter === "all" || getCard(id).element === filter)
  ).sort((a, b) => getCard(a).cmc - getCard(b).cmc || getCard(a).name.localeCompare(getCard(b).name));

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
        <button
          className="tcg-btn tcg-btn--primary"
          onClick={save}
        >
          💾 Salva
        </button>
      </div>

      <div className="tcg-deck__tools">
        <span className="tcg-deck__autolbl">Auto-crea:</span>
        <button className="tcg-chipbtn" onClick={() => auto(null)}>Bilanciato</button>
        <button className="tcg-chipbtn" onClick={() => auto("random")}>Casuale</button>
        {ELEMENTS.map((el) => (
          <button key={el} className="tcg-chipbtn" onClick={() => auto(el)}>
            {ELEMENT_ICON[el]} {ELEMENT_LABEL[el]}
          </button>
        ))}
        <button className="tcg-chipbtn tcg-chipbtn--danger" onClick={clearDeck}>Svuota</button>
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

          <div className="tcg-coll__filters tcg-coll__filters--mini">
            <button
              className={`tcg-chipbtn ${filter === "all" ? "is-on" : ""}`}
              onClick={() => setFilter("all")}
            >Tutti</button>
            {ELEMENTS.map((el) => (
              <button
                key={el}
                className={`tcg-chipbtn ${filter === el ? "is-on" : ""}`}
                onClick={() => setFilter(el)}
              >{ELEMENT_ICON[el]}</button>
            ))}
          </div>

          <div className="tcg-grid tcg-grid--build">
            {owned.length === 0 && (
              <p className="tcg-grid__empty">Nessuna carta posseduta qui. Apri pacchetti nel Negozio.</p>
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

        {/* ---- current deck (click to remove) ---- */}
        <div className="tcg-deck__list">
          <span className="tcg-deck__sub">Mazzo — click per togliere</span>
          {grouped.length === 0 && (
            <p className="tcg-grid__empty">Mazzo vuoto. Usa “Auto-crea” o aggiungi carte.</p>
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
