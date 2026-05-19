/* ============================================================
   CardView — one card, every context.
   variant: "hand" | "board" | "detail" | "mini" | "back"
   "detail" renders the big card + a lateral floating ability panel.
   ============================================================ */
import React, { useState, useRef } from "react";
import {
  cardArtUrl, cardBackUrl, costPips, TYPE_COLOR,
  ELEMENT_PIP, ELEMENT_LABEL, RARITY_COLOR, RARITY_LABEL, KEYWORDS,
} from "../../tcg/cards.js";

const TYPE_LINE = {
  creature: "Creatura",
  spell: "Incantesimo",
  artifact: "Manufatto",
  land: "Terra",
};

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
  faceDown = false,
  cover = null,
  attacking = false,
  blocking = false,
  dying = false,
  shake = false,
  instId = null,
  onClick,
  onInspect,
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
      style={{ "--type-col": TYPE_COLOR[card.type], "--rar": RARITY_COLOR[rarity] }}
      onClick={handleClick}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onContextMenu={(e) => {
        if (onInspect) {
          e.preventDefault();
          onInspect(card);
        }
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
          <span
            className="tcg-card__rar"
            style={{ background: RARITY_COLOR[rarity] }}
            title={RARITY_LABEL[rarity]}
          />
          {TYPE_LINE[card.type]} — {elLabel}
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

        {isCreature && (
          <div className={`tcg-card__pt ${hurt ? "is-hurt" : ""}`}>
            {power}/{toughness}
            {hurt ? <span className="tcg-card__pt-dmg"> (-{dmg})</span> : null}
          </div>
        )}
      </div>
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
          {RARITY_LABEL[rarity]} · {TYPE_LINE[card.type]} — {elLabel}
          {isCreature ? ` · ${power}/${toughness}` : ""}
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
