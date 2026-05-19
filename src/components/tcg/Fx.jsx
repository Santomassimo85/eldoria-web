/* ============================================================
   Fx — presentational animation overlays driven by GameTable.
   ============================================================ */
import React from "react";
import { ELEMENT_FX } from "../../tcg/cards.js";

/* floating combat text: damage / heal numbers that rise & fade */
export function FloatingLayer({ floats }) {
  return (
    <div className="tcg-floats" aria-hidden="true">
      {floats.map((f) => (
        <span
          key={f.id}
          className={`tcg-float tcg-float--${f.tone}${
            f.big ? " tcg-float--big" : ""
          }`}
          style={{ left: f.x + "%", top: f.y + "%" }}
        >
          {f.text}
        </span>
      ))}
    </div>
  );
}

/* full-screen turn transition */
export function TurnBanner({ show, mine }) {
  if (!show) return null;
  return (
    <div className="tcg-turnbanner" key={show}>
      <div className={`tcg-turnbanner__txt ${mine ? "is-mine" : "is-foe"}`}>
        {mine ? "Il tuo turno" : "Turno avversario"}
      </div>
    </div>
  );
}

/* spell cast burst, coloured by element */
export function SpellBurst({ burst }) {
  if (!burst) return null;
  const c = ELEMENT_FX[burst.element] || ELEMENT_FX.arcane;
  return (
    <div
      className="tcg-spellburst"
      key={burst.id}
      style={{ "--glow": c.glow, "--spark": c.spark }}
    >
      <div className="tcg-spellburst__ring" />
      <div className="tcg-spellburst__core" />
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="tcg-spellburst__spark"
          style={{ "--a": (i * 36) + "deg" }}
        />
      ))}
    </div>
  );
}

/* win / lose / draw cinematic + match recap panel */
export function EndOverlay({
  result, onExit, onRematch,
  turns = null, coins = null, mode = null,
  myName = null, foeName = null, winnerName = null,
}) {
  if (!result) return null;
  const map = {
    win: { t: "VITTORIA", s: "Gli dèi cantano il tuo nome.", c: "win", icon: "🏆" },
    lose: { t: "SCONFITTA", s: "Le ombre reclamano il campo.", c: "lose", icon: "💀" },
    draw: { t: "PAREGGIO", s: "Entrambi gli eroi cadono insieme.", c: "draw", icon: "⚖️" },
  };
  const r = map[result] || map.draw;
  return (
    <div className={`tcg-end tcg-end--${r.c}`}>
      <div className="tcg-end__card">
        <div className="tcg-end__icon" aria-hidden="true">{r.icon}</div>
        <h2 className="tcg-end__title">{r.t}</h2>
        <p className="tcg-end__sub">{r.s}</p>

        <div className="tcg-end__recap">
          {winnerName && (
            <div className="tcg-end__row">
              <span>Vincitore</span><b>{winnerName}</b>
            </div>
          )}
          {turns != null && (
            <div className="tcg-end__row">
              <span>Durata</span><b>{turns} turni</b>
            </div>
          )}
          {(myName || foeName) && (
            <div className="tcg-end__row">
              <span>Sfida</span><b>{myName} vs {foeName}</b>
            </div>
          )}
          {mode && (
            <div className="tcg-end__row">
              <span>Modalità</span><b>{mode === "ai" ? "Contro l'IA" : "Online"}</b>
            </div>
          )}
          {coins != null && (
            <div className="tcg-end__row tcg-end__row--coins">
              <span>Monete</span><b>🪙 +{coins}</b>
            </div>
          )}
        </div>

        <div className="tcg-end__btns">
          {onRematch && (
            <button className="tcg-btn tcg-btn--primary" onClick={onRematch}>
              Rivincita
            </button>
          )}
          <button className="tcg-btn" onClick={onExit}>
            Esci
          </button>
        </div>
      </div>
    </div>
  );
}
