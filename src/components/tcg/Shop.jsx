/* Shop — one single-element pack per element (light/darkness pricier).
   Opening a pack shows 15 face-down cards; click each to flip it
   (nice 3D effect) or "Scopri tutte". */
import React, { useState } from "react";
import CardView from "./CardView.jsx";
import CardZoom from "./CardZoom.jsx";
import {
  getCard, ELEMENT_ICON, ELEMENT_PIP, RARITY_COLOR, RARITY_LABEL,
  RARITY_ORDER,
} from "../../tcg/cards.js";
import { PACKS, packRarityOdds } from "../../tcg/collection.js";

export default function Shop({ profile, onOpenPack, onBack }) {
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(null); // {cards:[id], packId}
  const [flipped, setFlipped] = useState(() => new Set());
  const [zoom, setZoom] = useState(null);
  const [msg, setMsg] = useState("");

  const coins = profile?.coins ?? 0;
  const cover = profile?.cover || "air";

  const buy = async (packId) => {
    if (busy) return;
    setBusy(true);
    setMsg("");
    const res = await onOpenPack(packId);
    if (res?.ok) {
      setRevealed({ packId, cards: res.cards });
      setFlipped(new Set());
    } else if (res?.reason === "coins") setMsg("Monete insufficienti.");
    else setMsg("Impossibile aprire il pacchetto.");
    setBusy(false);
  };

  const flip = (i) =>
    setFlipped((s) => {
      if (s.has(i)) return s;
      const n = new Set(s);
      n.add(i);
      return n;
    });
  const flipAll = () =>
    setRevealed((r) => {
      setFlipped(new Set(r.cards.map((_, i) => i)));
      return r;
    });

  if (revealed) {
    const allOpen = flipped.size >= revealed.cards.length;
    // pack cards show the BACK of the pack's own element
    const packEl =
      PACKS.find((p) => p.id === revealed.packId)?.element || cover;
    return (
      <div className="tcg-shop">
        <div className="tcg-doc__head">
          <button className="tcg-btn tcg-btn--ghost" onClick={() => setRevealed(null)}>
            ‹ Negozio
          </button>
          <h1 className="tcg-doc__title">Pacchetto aperto</h1>
          <span className="tcg-shop__coins">🪙 {coins}</span>
        </div>
        <div className="tcg-shop__body">
          <div className="tcg-reveal__bar">
            <span>Tocca le carte per scoprirle ({flipped.size}/{revealed.cards.length})</span>
            <div>
              {!allOpen && (
                <button className="tcg-btn tcg-btn--primary" onClick={flipAll}>
                  Scopri tutte
                </button>
              )}
              <button className="tcg-btn" onClick={() => setRevealed(null)}>
                Continua
              </button>
            </div>
          </div>
          <div className="tcg-reveal__grid">
            {revealed.cards.map((cd, i) => {
              const open = flipped.has(i);
              const c = getCard(cd.id);
              // a special pull → fun reveal effect (one per card)
              const fx = cd.foil
                ? "foil"
                : c.rarity === "legendary"
                ? "legendary"
                : c.rarity === "epic"
                ? "epic"
                : null;
              const fxIcon =
                fx === "foil" ? "✨" : fx === "legendary" ? "★" : "✦";
              return (
                <div
                  key={i}
                  className={`tcg-flip ${open ? "is-flipped" : ""}`}
                  onClick={() => (open ? setZoom(c) : flip(i))}
                  title={open ? "Ingrandisci" : "Scopri"}
                >
                  <div className="tcg-flip__inner">
                    <div className="tcg-flip__back">
                      <CardView variant="back" cover={packEl} />
                    </div>
                    <div className="tcg-flip__front">
                      <CardView card={c} variant="board" foil={cd.foil} />
                      {cd.foil && <span className="tcg-flip__foil">✨ FOIL</span>}
                      <span
                        className="tcg-flip__rar"
                        style={{ background: RARITY_COLOR[c.rarity] }}
                      >
                        {RARITY_LABEL[c.rarity]}
                      </span>
                      {open && fx && (
                        <div
                          className={`tcg-revfx tcg-revfx--${fx}`}
                          aria-hidden="true"
                        >
                          <span className="tcg-revfx__ring" />
                          <span className="tcg-revfx__ring tcg-revfx__ring--2" />
                          {[...Array(8)].map((_, k) => (
                            <span
                              key={k}
                              className="tcg-revfx__spark"
                              style={{ "--k": k }}
                            >
                              {fxIcon}
                            </span>
                          ))}
                          <span className="tcg-revfx__label">
                            {fx === "foil"
                              ? "✨ FOIL!"
                              : fx === "legendary"
                              ? "★ LEGGENDARIA!"
                              : "✦ EPICA!"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <CardZoom card={zoom} onClose={() => setZoom(null)} />
      </div>
    );
  }

  return (
    <div className="tcg-shop">
      <div className="tcg-doc__head">
        <button className="tcg-btn tcg-btn--ghost" onClick={onBack}>
          ‹ Indietro
        </button>
        <h1 className="tcg-doc__title">🏪 Negozio</h1>
        <span className="tcg-shop__coins">🪙 {coins}</span>
      </div>

      <div className="tcg-shop__body">
        {msg && <p className="tcg-shop__msg">{msg}</p>}
        <p className="tcg-shop__intro">
          Ogni pacchetto contiene <b>{PACKS[0].size} carte</b> di un{" "}
          <b>solo elemento</b>. Le probabilità di rarità sono <b>uguali per
          tutti i pacchetti</b> (i Premium hanno una chance di Leggendaria più
          bassa) e sono indicate su ogni pacchetto. Ogni carta ha una piccola
          probabilità di essere <b>✨ Foil</b>. Le monete si guadagnano in
          battaglia.
        </p>

        <div className="tcg-shop__grid">
          {PACKS.map((pk) => {
            const afford = coins >= pk.cost && !busy;
            return (
              <div
                key={pk.id}
                className={`tcg-packcard ${pk.premium ? "is-premium" : ""}`}
                style={{ "--pip": ELEMENT_PIP[pk.element] }}
              >
                <div className="tcg-packcard__art">{ELEMENT_ICON[pk.element]}</div>
                <div className="tcg-packcard__name">{pk.name}</div>
                {pk.premium && <div className="tcg-packcard__tag">Premium</div>}
                {(() => {
                  const odds = packRarityOdds(pk.id);
                  return (
                    <ul className="tcg-packcard__odds">
                      {RARITY_ORDER.filter((r) => odds[r] > 0).map((r) => (
                        <li key={r}>
                          <span
                            className="tcg-packcard__odot"
                            style={{ background: RARITY_COLOR[r] }}
                          />
                          <span className="tcg-packcard__olabel">
                            {RARITY_LABEL[r]}
                          </span>
                          <span className="tcg-packcard__opct">
                            {(odds[r] * 100).toFixed(1)}%
                          </span>
                        </li>
                      ))}
                      <li className="tcg-packcard__ofoil">
                        <span className="tcg-packcard__odot tcg-packcard__odot--foil" />
                        <span className="tcg-packcard__olabel">✨ Foil</span>
                        <span className="tcg-packcard__opct">
                          {(odds.foil * 100).toFixed(1)}%
                        </span>
                      </li>
                    </ul>
                  );
                })()}
                <button
                  className="tcg-btn tcg-btn--primary tcg-packcard__buy"
                  disabled={!afford}
                  onClick={() => buy(pk.id)}
                >
                  {busy ? "…" : `${pk.cost} 🪙`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
