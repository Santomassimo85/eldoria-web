/* ============================================================
   CardView — one card, every context.
   variant: "hand" | "board" | "detail" | "mini" | "back"
   "detail" renders the big card + a lateral floating ability panel.
   ============================================================ */
import React, { useState, useRef } from "react";
import {
  cardArtUrl, cardBackUrl, costPips, TYPE_COLOR,
  ELEMENT_PIP, ELEMENT_LABEL, RARITY_COLOR, RARITY_LABEL, KEYWORDS,
  DICE_STATS, statDiceLabel,
} from "../../tcg/cards.js";

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
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) {
  const pressTimer = useRef(null);
  const longFired = useRef(false);

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

  const isCreature = card.type === "creature";
  const power = creature ? creature.power : card.power;
  const toughness = creature ? creature.toughness : card.toughness;
  // in play → rolled numbers; not in play → the dice notation
  const ptText =
    creature || !DICE_STATS || !isCreature
      ? `${power}/${toughness}`
      : `${statDiceLabel(card.power, card.cmc)}/${statDiceLabel(
          card.toughness,
          card.cmc
        )}`;
  const dmg = creature ? creature.damage : 0;
  const hurt = dmg > 0;
  const keywords = kwList(card);
  const rarity = card.rarity || "common";

  const startPress = () => {
    if (!onInspect) return;
    longFired.current = false;
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      longFired.current = true;
      onInspect(card);
    }, 420);
  };
  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
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
    if (onClick) onClick(e);
  };

  const cls = [
    "tcg-card",
    `tcg-card--${variant}`,
    `tcg-card--${card.type}`,
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
      className={cls}
      data-inst={instId || undefined}
      style={{
        "--type-col": TYPE_COLOR[card.type],
        "--rar": RARITY_COLOR[rarity],
        "--el-col": ELEMENT_PIP[card.element] || "#8a6a23",
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
          <ManaCost card={card} />
        </div>

        <Art card={card} />

        <div className="tcg-card__type">
          <span className="tcg-card__tico" title={typeMeta(card).label}>
            {typeMeta(card).icon}
          </span>
          {elLabel}
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
            {hurt ? <span className="tcg-card__pt-dmg"> (-{dmg})</span> : null}
          </div>
        )}
      </div>
      {/* board: stat plate lives OUTSIDE the (overflow:hidden) frame so it
          can float just below the card without being clipped */}
      {isCreature && variant === "board" && (
        <div className={`tcg-card__pt tcg-card__pt--board ${hurt ? "is-hurt" : ""}`}>
          {ptText}
          {hurt ? <span className="tcg-card__pt-dmg"> (-{dmg})</span> : null}
        </div>
      )}
      <span
        className={`tcg-card__rarc is-${rarity}`}
        style={{ "--rc": RARITY_COLOR[rarity] }}
        title={RARITY_LABEL[rarity]}
        aria-hidden="true"
      />
      {foil && <span className="tcg-card__foil" aria-hidden="true" />}
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
