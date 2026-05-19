/* Shop — one single-element pack per element (light/darkness pricier).
   Opening a pack shows 15 face-down cards; click each to flip it
   (nice 3D effect) or "Scopri tutte". */
import React, { useState } from "react";
import CardView from "./CardView.jsx";
import CardZoom from "./CardZoom.jsx";
import { getCard, ELEMENT_ICON, ELEMENT_PIP, RARITY_COLOR, RARITY_LABEL } from "../../tcg/cards.js";
import { PACKS } from "../../tcg/collection.js";

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
            {revealed.cards.map((id, i) => {
              const open = flipped.has(i);
              const c = getCard(id);
              return (
                <div
                  key={i}
                  className={`tcg-flip ${open ? "is-flipped" : ""}`}
                  onClick={() => (open ? setZoom(c) : flip(i))}
                  title={open ? "Ingrandisci" : "Scopri"}
                >
                  <div className="tcg-flip__inner">
                    <div className="tcg-flip__back">
                      <CardView variant="back" cover={cover} />
                    </div>
                    <div className="tcg-flip__front">
                      <CardView card={c} variant="board" />
                      <span
                        className="tcg-flip__rar"
                        style={{ background: RARITY_COLOR[c.rarity] }}
                      >
                        {RARITY_LABEL[c.rarity]}
                      </span>
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
          <b>solo elemento</b>, con rarità casuale (più alta è la rarità, più
          è difficile). Le monete si guadagnano in battaglia.
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
