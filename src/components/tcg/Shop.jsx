/* Shop — one single-element pack per element (light/darkness pricier).
   Opening a pack shows 15 face-down cards; click each to flip it
   (nice 3D effect) or "Identifica tutte" (also a floating FAB so the
   action stays reachable on phones where the bar scrolls off). */
import React, { useState } from "react";
import { createPortal } from "react-dom";
import CardView from "./CardView.jsx";
import CardZoom from "./CardZoom.jsx";
import {
  getCard, ELEMENT_ICON, ELEMENT_PIP, RARITY_COLOR, RARITY_LABEL,
  RARITY_ORDER,
} from "../../tcg/cards.js";
import { PACKS } from "../../tcg/collection.js";

/* Returns the kind of celebration ("foil" / "legendary" / "epic") for
   a flipped pack card, or null if nothing special. Mirrors the inline
   per-card flash logic so the centred popup uses the same priorities. */
function bigKind(cd, card) {
  if (!card) return null;
  if (cd.foil) return "foil";
  if (card.rarity === "legendary") return "legendary";
  if (card.rarity === "epic") return "epic";
  return null;
}
const KIND_LABEL = { foil: "✨ FOIL!", legendary: "★ LEGGENDARIA!", epic: "✦ EPICA!" };

export default function Shop({ profile, onOpenPack, onBack }) {
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(null); // {cards:[id], packId}
  const [flipped, setFlipped] = useState(() => new Set());
  const [zoom, setZoom] = useState(null);
  const [msg, setMsg] = useState("");
  // Big centred reveal popup for the juicy pulls (epic+/legendary/foil).
  // Queued so multiple specials don't overlap when "Identifica tutte" is used.
  // Dismissed by tapping the card; no auto-dismiss.
  const [bigQueue, setBigQueue] = useState([]);

  const coins = profile?.coins ?? 0;
  const cover = profile?.cover || "nature";

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

  /* Queue a centred popup if this flip uncovers something special. */
  const maybeQueueBig = (cd) => {
    const card = getCard(cd.id);
    const kind = bigKind(cd, card);
    if (!kind) return;
    setBigQueue((q) => [...q, { card, kind, foil: cd.foil }]);
  };

  const flip = (i) =>
    setFlipped((s) => {
      if (s.has(i)) return s;
      const n = new Set(s);
      n.add(i);
      // queue the big popup outside the state-setter (avoid React warning)
      setTimeout(() => {
        if (revealed && revealed.cards && revealed.cards[i]) {
          maybeQueueBig(revealed.cards[i]);
        }
      }, 0);
      return n;
    });
  const flipAll = () =>
    setRevealed((r) => {
      if (!r) return r;
      setFlipped(new Set(r.cards.map((_, i) => i)));
      // chain the big popups for each special card in display order
      setTimeout(() => {
        const specials = r.cards
          .map((cd) => ({ cd, card: getCard(cd.id) }))
          .filter(({ cd, card }) => !!bigKind(cd, card))
          .map(({ cd, card }) => ({ card, kind: bigKind(cd, card), foil: cd.foil }));
        if (specials.length) setBigQueue((q) => [...q, ...specials]);
      }, 0);
      return r;
    });

  /* No auto-dismiss: the popup stays open with the card fully visible
     until the user taps it. Multiple specials queue up and are dismissed
     one at a time. */
  const dismissBig = () => {
    setBigQueue((q) => q.slice(1));
  };

  if (revealed) {
    const allOpen = flipped.size >= revealed.cards.length;
    // pack cards show the BACK of the pack's primary colour (class
    // packs are dual-colour but the first colour drives the card-back)
    const pk = PACKS.find((p) => p.id === revealed.packId);
    const packEl = (pk?.colors && pk.colors[0]) || pk?.element || cover;
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
                  Identifica tutte
                </button>
              )}
              <button className="tcg-btn" onClick={() => setRevealed(null)}>
                Continua
              </button>
            </div>
          </div>
          {!allOpen && (
            <button
              className="tcg-reveal__fab"
              onClick={flipAll}
              aria-label="Identifica tutte le carte"
              title="Identifica tutte"
            >
              <span className="tcg-reveal__fab-ico" aria-hidden="true">✨</span>
              <span className="tcg-reveal__fab-txt">Identifica tutte</span>
            </button>
          )}
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
        {/* Big centred celebration popup — fires when a flipped card is
            epic+/legendary/foil. Portals out of the shop tree so it
            sits above everything (incl. CardZoom). Click anywhere on
            the overlay to dismiss; auto-dismisses after ~2.4s. */}
        {bigQueue.length > 0 && createPortal(
          <BigReveal entry={bigQueue[0]} onDismiss={dismissBig} />,
          document.body
        )}
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
          I <b>Pacchetti di Classe</b> contengono carte dei <b>due colori</b>{" "}
          della classe scelta (es. Mago = Fuoco + Natura, Guerriero = Fuoco +
          Luce, Chierico = Luce + Tenebre, Ladro = Tenebre + Acqua, Druido =
          Natura + Acqua). Ogni carta ha una piccola chance di essere{" "}
          <b>✨ Foil</b>.
        </p>

        <div className="tcg-shop__grid">
          {PACKS.map((pk) => {
            const afford = coins >= pk.cost && !busy;
            const cols = pk.colors || (pk.element ? [pk.element] : []);
            const primary = cols[0];
            const isClass = pk.kind === "class";
            return (
              <div
                key={pk.id}
                className={`tcg-packcard ${pk.premium ? "is-premium" : ""} ${
                  isClass ? "is-class" : ""
                }`}
                style={{ "--pip": ELEMENT_PIP[primary] || "#888" }}
              >
                <div className="tcg-packcard__art">
                  {isClass ? pk.icon : ELEMENT_ICON[primary]}
                </div>
                <div className="tcg-packcard__name">{pk.name}</div>
                {isClass && (
                  <div className="tcg-packcard__colors">
                    {cols.map((el) => (
                      <span
                        key={el}
                        className="tcg-packcard__cdot"
                        style={{ background: ELEMENT_PIP[el] }}
                        title={el}
                      >
                        {ELEMENT_ICON[el]}
                      </span>
                    ))}
                  </div>
                )}
                {pk.premium && <div className="tcg-packcard__tag">Premium</div>}
                {(() => {
                  // Qualitative drop hints — we no longer expose raw
                  // probabilities to players. Each rarity gets a short
                  // "possibilità di trovare …" descriptor that pairs
                  // with the coloured rarity dot.
                  const ODDS_HINT = {
                    common:    "ne trovi sempre",
                    uncommon:  "spesso presenti",
                    rare:      "occasionali",
                    epic:      "rare",
                    legendary: "se sei fortunato",
                  };
                  return (
                    <ul className="tcg-packcard__odds">
                      <li className="tcg-packcard__oheader">
                        Possibilità di trovare:
                      </li>
                      {RARITY_ORDER.map((r) => (
                        <li key={r}>
                          <span
                            className="tcg-packcard__odot"
                            style={{ background: RARITY_COLOR[r] }}
                          />
                          <span className="tcg-packcard__olabel">
                            {RARITY_LABEL[r]}
                          </span>
                          <span className="tcg-packcard__ohint">
                            {ODDS_HINT[r]}
                          </span>
                        </li>
                      ))}
                      <li className="tcg-packcard__ofoil">
                        <span className="tcg-packcard__odot tcg-packcard__odot--foil" />
                        <span className="tcg-packcard__olabel">✨ Foil</span>
                        <span className="tcg-packcard__ohint">
                          tocco di fortuna
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

/* ============================================================
   BigReveal — centred celebration popup for a juicy pull.
   Mounts with a "kind" class (foil/legendary/epic) so CSS can
   theme the glow + label. Click to dismiss early.
   ============================================================ */
function BigReveal({ entry, onDismiss }) {
  if (!entry) return null;
  const { card, kind, foil } = entry;
  return (
    <div
      className={`tcg-bigrev tcg-bigrev--${kind}`}
      onClick={onDismiss}
      role="presentation"
    >
      {/* 12 orbiting sparkles around the card */}
      {Array.from({ length: 12 }).map((_, k) => (
        <span
          key={k}
          className="tcg-bigrev__spark"
          style={{ "--k": k }}
          aria-hidden="true"
        >
          {kind === "foil" ? "✨" : kind === "legendary" ? "★" : "✦"}
        </span>
      ))}
      <span className="tcg-bigrev__ring" aria-hidden="true" />
      <span className="tcg-bigrev__ring tcg-bigrev__ring--2" aria-hidden="true" />

      <div className="tcg-bigrev__hint">tocca la carta per continuare</div>

      {/* Tap target is the CARD itself — the surrounding backdrop also
          dismisses (so a misclick still works), but the card stops the
          ripple to feel like an intentional gesture, not "I clicked
          outside". */}
      <button
        type="button"
        className="tcg-bigrev__card"
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        aria-label={`Chiudi: ${card.name}`}
      >
        <CardView card={card} variant="board" foil={foil} />
      </button>

      <div className="tcg-bigrev__label">{KIND_LABEL[kind]}</div>
      <div className="tcg-bigrev__sub">{card.name}</div>
    </div>
  );
}
