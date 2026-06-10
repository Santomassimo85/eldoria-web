/* ============================================================
   CardView — one card, every context.
   variant: "hand" | "board" | "detail" | "mini" | "back"
   "detail" renders the big card + a lateral floating ability panel.
   ============================================================ */
import React, { useState, useRef, useEffect } from "react";

/* Le reazioni che escono dal popover (long-press). Coppia emoji + titolo,
   così sui desktop in hover si capisce la "vibe" senza essere il giocatore
   già pratico del gioco. Mantenute brevi per stare comode in landscape. */
const CARD_REACTIONS = [
  { e: "😂", t: "Che ridere!" },
  { e: "🔥", t: "Che mossa!" },
  { e: "👏", t: "Ben giocato" },
  { e: "😱", t: "Oh no…" },
  { e: "💀", t: "Sei morto" },
  { e: "👑", t: "Rispetto" },
];

/* Due soglie di press distinte: la reazione emoji esce presto (hold breve),
   l'ingrandimento della carta più tardi (hold lungo). Così reagire è rapido
   e aprire la carta richiede di tenere premuto un attimo in più. */
const REACT_MS = 300;
const ZOOM_MS = 650;
import {
  cardArtUrl, cardBackUrl, costPips, TYPE_COLOR,
  ELEMENT_PIP, ELEMENT_LABEL, RARITY_COLOR, RARITY_LABEL, KEYWORDS,
  DICE_STATS, statDiceLabel, expansionOf,
} from "../../tcg/cards.js";
import { spellSlotTier } from "../../tcg/classes.js";

/* small icon + label per card type (instants split out from sorceries) */
function typeMeta(card) {
  if (card.type === "creature") return { icon: "🐾", label: "Creatura" };
  if (card.type === "artifact") return { icon: "💠", label: "Manufatto" };
  if (card.type === "land") return { icon: "⛰️", label: "Terra" };
  if (card.type === "spell")
    return card.speed === "instant"
      ? { icon: "⚡", label: "Istantaneo" }
      : { icon: "📜", label: "Magia" };
  return { icon: "✦", label: card.type };
}

function ManaCost({ card }) {
  if (card.type === "land")
    return <span className="tcg-card__cost tcg-card__cost--land">⟳</span>;
  const pips = costPips(card.cost);
  if (!pips.length) return null;
  return (
    <span className="tcg-cost">
      {pips.map((p, i) =>
        p.el === "generic" ? (
          <span key={i} className="tcg-pip tcg-pip--generic">{p.n}</span>
        ) : (
          Array.from({ length: p.n }).map((_, j) => (
            <span
              key={i + "-" + j}
              className="tcg-pip tcg-pip--col"
              style={{ "--pip": ELEMENT_PIP[p.el] }}
              title={ELEMENT_LABEL[p.el]}
            />
          ))
        )
      )}
    </span>
  );
}

function Art({ card }) {
  const [err, setErr] = useState(false);
  const url = cardArtUrl(card);
  if (url && !err) {
    return (
      <img
        className="tcg-card__img"
        src={url}
        alt={card.name}
        draggable={false}
        loading="lazy"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div
      className="tcg-card__img tcg-card__img--ph"
      style={{ "--ph": TYPE_COLOR[card.type] }}
    >
      <span className="tcg-card__ph-icon">{card.icon || "✦"}</span>
    </div>
  );
}

const kwList = (card) =>
  card && card.type === "creature" && Array.isArray(card.keywords)
    ? card.keywords.filter((k) => KEYWORDS[k])
    : [];

export default function CardView({
  card,
  variant = "hand",
  creature = null,
  selected = false,
  playable = false,
  targetable = false,
  discard = false,
  foil = false,
  faceDown = false,
  cover = null,
  attacking = false,
  blocking = false,
  dying = false,
  shake = false,
  instId = null,
  onClick,
  onInspect,
  onReact,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) {
  const reactTimer = useRef(null);
  const zoomTimer = useRef(null);
  const longFired = useRef(false);
  // popover di reazioni: se `onReact` è passato, il long-press apre questo
  // menù invece dell'inspect (l'inspect resta accessibile col bottone 🔍).
  const [reactOpen, setReactOpen] = useState(false);
  const cardRef = useRef(null);

  // chiudi il picker se l'utente clicca fuori dalla carta (lo stop
  // sul carta-click avviene già nel render del popover stesso)
  useEffect(() => {
    if (!reactOpen) return;
    const onDoc = (e) => {
      if (!cardRef.current) return;
      if (!cardRef.current.contains(e.target)) setReactOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [reactOpen]);

  if (variant === "back" || faceDown) {
    return (
      <div className="tcg-card tcg-card--back" aria-hidden="true" onClick={onClick}>
        <img
          className="tcg-card__back-img"
          src={cardBackUrl(cover || card?.element)}
          alt=""
          draggable={false}
        />
      </div>
    );
  }

  // A card id that no longer resolves (removed/renamed in a rework, or a
  // stale saved deck/collection) must NOT crash the whole table — render a
  // neutral placeholder instead so the match keeps going.
  if (!card) {
    return (
      <div
        className={`tcg-card tcg-card--${variant} tcg-card--missing`}
        data-inst={instId || undefined}
        onClick={onClick}
        role="button"
        tabIndex={0}
      >
        <div className="tcg-card__frame">
          <span className="tcg-card__name">Carta sconosciuta</span>
          <span className="tcg-card__ph-icon" aria-hidden="true">❔</span>
        </div>
      </div>
    );
  }

  const isCreature = card.type === "creature";
  const power = creature ? creature.power : card.power;
  const toughness = creature ? creature.toughness : card.toughness;
  const dmg = creature ? creature.damage : 0;
  const hurt = dmg > 0;
  // in play → show LIVE HP (toughness - damage), not the formula.
  // not in play → show the dice notation, since stats aren't rolled yet.
  const liveT = creature && isCreature ? Math.max(0, toughness - dmg) : toughness;
  const ptText =
    creature || !DICE_STATS || !isCreature
      ? `${power}/${liveT}`
      : `${statDiceLabel(card.power, card.cmc)}/${statDiceLabel(
          card.toughness,
          card.cmc
        )}`;
  const keywords = kwList(card);
  const rarity = card.rarity || "common";
  const expSet = expansionOf(card);
  const isBicolor = !!card.element2 && card.element2 !== card.element;

  const startPress = () => {
    if (!onInspect && !onReact) return;
    longFired.current = false;
    // hold breve → anello di reazioni (solo se la carta è "reagibile", es. le
    // creature del nemico). Tenendo premuto oltre → zoom della carta.
    if (onReact) {
      reactTimer.current = setTimeout(() => {
        reactTimer.current = null;
        longFired.current = true;
        setReactOpen(true);
      }, REACT_MS);
    }
    if (onInspect) {
      zoomTimer.current = setTimeout(() => {
        zoomTimer.current = null;
        longFired.current = true;
        setReactOpen(false);
        onInspect(card);
      }, ZOOM_MS);
    }
  };
  const endPress = () => {
    if (reactTimer.current) { clearTimeout(reactTimer.current); reactTimer.current = null; }
    if (zoomTimer.current) { clearTimeout(zoomTimer.current); zoomTimer.current = null; }
  };
  const handleDragStart = (e) => {
    endPress(); // a drag must never fire the long-press inspect
    if (onDragStart) onDragStart(e);
  };
  const handleClick = (e) => {
    if (longFired.current) {
      longFired.current = false;
      return;
    }
    // un tap normale su una carta che ha il picker aperto lo chiude e basta
    if (reactOpen) {
      setReactOpen(false);
      return;
    }
    if (onClick) onClick(e);
  };
  const pickReaction = (emoji) => (e) => {
    e.stopPropagation();
    setReactOpen(false);
    if (onReact) onReact(emoji);
  };
  const openInspectFromPicker = (e) => {
    e.stopPropagation();
    setReactOpen(false);
    if (onInspect) onInspect(card);
  };

  const cls = [
    "tcg-card",
    `tcg-card--${variant}`,
    `tcg-card--${card.type}`,
    isBicolor && "tcg-card--bicolor",
    expSet && "tcg-card--exp",
    selected && "is-selected",
    playable && "is-playable",
    targetable && "is-targetable",
    discard && "is-discard",
    foil && "is-foil",
    attacking && "is-attacking",
    blocking && "is-blocking",
    dying && "is-dying",
    shake && "is-shake",
    creature && creature.tapped && "is-tapped",
    creature && creature.sick && "is-sick",
  ]
    .filter(Boolean)
    .join(" ");

  const elLabel = ELEMENT_LABEL[card.element] || card.element;

  const cardEl = (
    <div
      ref={cardRef}
      className={cls}
      data-inst={instId || undefined}
      style={{
        "--type-col": TYPE_COLOR[card.type],
        "--rar": RARITY_COLOR[rarity],
        "--el-col": ELEMENT_PIP[card.element] || "#8a6a23",
        "--el-col2": ELEMENT_PIP[card.element2] || ELEMENT_PIP[card.element] || "#8a6a23",
      }}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={handleClick}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onContextMenu={(e) => {
        // never let the OS/browser copy-paste / image callout appear
        e.preventDefault();
        if (onInspect) onInspect(card);
      }}
      role="button"
      tabIndex={0}
    >
      <div className="tcg-card__frame">
        <div className="tcg-card__top">
          <span className="tcg-card__name">{card.name}</span>
          {/* on the battlefield the cost floats ABOVE the card (see below),
              so the header is freed for the full card name */}
          {variant !== "board" && <ManaCost card={card} />}
        </div>

        <Art card={card} />

        <div className="tcg-card__type">
          <span className="tcg-card__tico" title={typeMeta(card).label}>
            {typeMeta(card).icon}
          </span>
          {elLabel}
          {/* Spell slot tier badge — only on spells (creatures/artifacts/
              lands don't use slots). Helps the player understand WHY a
              card may be unplayable even when mana is available. */}
          {card.type === "spell" && (
            <span
              className={`tcg-card__slot tcg-card__slot--lv${spellSlotTier(card.cmc || 0)}`}
              title={`Richiede uno spell slot di tier ${spellSlotTier(card.cmc || 0)}`}
            >
              S{spellSlotTier(card.cmc || 0)}
            </span>
          )}
        </div>

        {keywords.length > 0 && (
          <div className="tcg-card__kw">
            {keywords.map((k) => (
              <span key={k} className="tcg-card__kwchip" title={KEYWORDS[k].desc}>
                {KEYWORDS[k].label}
              </span>
            ))}
          </div>
        )}

        {(card.text || card.flavor) && (
          <div className="tcg-card__text">
            {card.text ? <span className="tcg-card__rule">{card.text}</span> : null}
            {card.flavor ? (
              <span className="tcg-card__flavor">{card.flavor}</span>
            ) : null}
          </div>
        )}

        {/* non-board: stat plate stays inside the frame (bottom corner) */}
        {isCreature && variant !== "board" && (
          <div className={`tcg-card__pt ${hurt ? "is-hurt" : ""}`}>
            {ptText}
          </div>
        )}
      </div>
      {/* board: stat plate lives OUTSIDE the (overflow:hidden) frame so it
          can float just below the card without being clipped */}
      {isCreature && variant === "board" && (
        <div
          key={`pt-${liveT}`}
          className={`tcg-card__pt tcg-card__pt--board ${hurt ? "is-hurt" : ""}`}
        >
          {ptText}
        </div>
      )}
      {/* board: mana cost floats ABOVE the card (mirrors the P/T plate),
          so the in-frame header has the whole width for the card name */}
      {variant === "board" && (
        <div className="tcg-card__manaplate" aria-hidden="true">
          <ManaCost card={card} />
        </div>
      )}
      <span
        className={`tcg-card__rarc is-${rarity}`}
        style={{ "--rc": RARITY_COLOR[rarity] }}
        title={RARITY_LABEL[rarity]}
        aria-hidden="true"
      />
      {expSet && (
        <span
          className="tcg-card__exp-seal"
          title={expSet.name}
          aria-label={expSet.name}
        >
          {expSet.symbol}
        </span>
      )}
      {foil && <span className="tcg-card__foil" aria-hidden="true" />}
      {reactOpen && (
        <div
          className="tcg-react-ring"
          role="menu"
          aria-label="Reazioni"
          style={{ "--n": CARD_REACTIONS.length + (onInspect ? 1 : 0) }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {CARD_REACTIONS.map((r, i) => (
            <button
              key={r.e}
              type="button"
              className="tcg-react-ring__btn"
              title={r.t}
              style={{ "--i": i }}
              onClick={pickReaction(r.e)}
            >
              <span className="tcg-react-ring__emo">{r.e}</span>
            </button>
          ))}
          {onInspect && (
            <button
              type="button"
              className="tcg-react-ring__btn tcg-react-ring__btn--zoom"
              title="Ingrandisci"
              style={{ "--i": CARD_REACTIONS.length }}
              onClick={openInspectFromPicker}
            >
              <span className="tcg-react-ring__emo">🔍</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (variant !== "detail") return cardEl;

  // enlarged view: card + lateral floating ability panel (readable)
  return (
    <div className="tcg-detailwrap">
      {cardEl}
      <aside className="tcg-aside">
        <h3 className="tcg-aside__name">{card.name}</h3>
        <div className="tcg-aside__meta">
          <span
            className="tcg-card__rar"
            style={{ background: RARITY_COLOR[rarity] }}
          />
          {RARITY_LABEL[rarity]} · {typeMeta(card).icon}{" "}
          {typeMeta(card).label} — {elLabel}
          {isCreature ? ` · ${ptText}` : ""}
        </div>
        {keywords.length > 0 && (
          <div className="tcg-aside__kw">
            {keywords.map((k) => (
              <div key={k} className="tcg-aside__kwrow">
                <b>{KEYWORDS[k].label}</b>
                <span>{KEYWORDS[k].desc}</span>
              </div>
            ))}
          </div>
        )}
        {card.text && <p className="tcg-aside__rule">{card.text}</p>}
        {card.flavor && <p className="tcg-aside__flavor">{card.flavor}</p>}
      </aside>
    </div>
  );
}
