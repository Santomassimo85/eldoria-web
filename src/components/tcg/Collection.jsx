/* Collection — owned cards & deck statistics */
import React, { useMemo, useState } from "react";
import CardView from "./CardView.jsx";
import CardZoom from "./CardZoom.jsx";
import {
  POOL, getCard, ELEMENTS, ELEMENT_LABEL, ELEMENT_ICON,
} from "../../tcg/cards.js";
import { deckCounts } from "../../tcg/collection.js";

export default function Collection({ profile, onBack }) {
  const collection = useMemo(() => profile?.collection || {}, [profile]);
  const deck = useMemo(() => profile?.deck || [], [profile]);
  const [filter, setFilter] = useState("all"); // all | <element>
  const [zoom, setZoom] = useState(null);

  const stats = useMemo(() => {
    let total = 0, unique = 0;
    const byEl = {}, byType = { creature: 0, spell: 0, artifact: 0 };
    for (const el of ELEMENTS) byEl[el] = 0;
    for (const id of POOL) {
      const n = collection[id] || 0;
      if (n <= 0) continue;
      const c = getCard(id);
      total += n;
      unique += 1;
      byEl[c.element] += n;
      if (byType[c.type] != null) byType[c.type] += n;
    }
    return { total, unique, byEl, byType };
  }, [collection]);

  const dc = deckCounts(deck);
  const curve = useMemo(() => {
    const m = [0, 0, 0, 0, 0, 0, 0]; // cmc 0..6+
    let lands = 0;
    for (const id of deck) {
      const c = getCard(id);
      if (!c) continue;
      if (c.type === "land") { lands += 1; continue; }
      m[Math.min(6, c.cmc)] += 1;
    }
    return { m, lands, max: Math.max(1, ...m) };
  }, [deck]);

  const owned = POOL.filter(
    (id) => (collection[id] || 0) > 0 &&
      (filter === "all" || getCard(id).element === filter)
  ).sort((a, b) => getCard(a).cmc - getCard(b).cmc);

  return (
    <div className="tcg-coll">
      <div className="tcg-doc__head">
        <button className="tcg-btn tcg-btn--ghost" onClick={onBack}>
          ‹ Indietro
        </button>
        <h1 className="tcg-doc__title">📚 Collezione</h1>
        <span className="tcg-shop__coins">🪙 {profile?.coins ?? 0}</span>
      </div>

      <div className="tcg-coll__stats">
        <div className="tcg-stat"><b>{stats.total}</b><span>carte totali</span></div>
        <div className="tcg-stat"><b>{stats.unique}/{POOL.length}</b><span>tipi diversi</span></div>
        <div className="tcg-stat"><b>{stats.byType.creature}</b><span>creature</span></div>
        <div className="tcg-stat"><b>{stats.byType.spell}</b><span>incantesimi</span></div>
        <div className="tcg-stat"><b>{stats.byType.artifact}</b><span>manufatti</span></div>
      </div>

      <div className="tcg-coll__deck">
        <h2>Mazzo attuale — {deck.length}/60 ({curve.lands} terre)</h2>
        <div className="tcg-curve">
          {curve.m.map((v, i) => (
            <div key={i} className="tcg-curve__col" title={`${v} carte da ${i}${i === 6 ? "+" : ""} mana`}>
              <span
                className="tcg-curve__bar"
                style={{ height: 6 + (v / curve.max) * 70 + "px" }}
              />
              <span className="tcg-curve__lbl">{i === 6 ? "6+" : i}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="tcg-coll__filters">
        <button
          className={`tcg-chipbtn ${filter === "all" ? "is-on" : ""}`}
          onClick={() => setFilter("all")}
        >
          Tutti
        </button>
        {ELEMENTS.map((el) => (
          <button
            key={el}
            className={`tcg-chipbtn ${filter === el ? "is-on" : ""}`}
            onClick={() => setFilter(el)}
          >
            {ELEMENT_ICON[el]} {ELEMENT_LABEL[el]} ({stats.byEl[el]})
          </button>
        ))}
      </div>

      <div className="tcg-grid">
        {owned.length === 0 && (
          <p className="tcg-grid__empty">Nessuna carta in questo filtro.</p>
        )}
        {owned.map((id) => (
          <div key={id} className="tcg-grid__cell">
            <button
              className="tcg-grid__zoom"
              title="Ingrandisci"
              onClick={() => setZoom(getCard(id))}
            >
              🔍
            </button>
            <CardView
              card={getCard(id)}
              variant="board"
              onInspect={setZoom}
              onClick={() => setZoom(getCard(id))}
            />
            <span className="tcg-grid__count">
              ×{collection[id]}{dc[id] ? ` · mazzo ${dc[id]}` : ""}
            </span>
          </div>
        ))}
      </div>
      <CardZoom card={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
