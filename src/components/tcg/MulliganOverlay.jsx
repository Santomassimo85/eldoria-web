/* ============================================================
   MulliganOverlay — pre-match opening hand inspection.
   ------------------------------------------------------------
   Shown ONCE before the AI match starts: the player sees the
   6 cards drawn for them, and may RESHUFFLE up to 2 times
   (3 hands total seen) before committing. PvP skips this for
   now (the engine state lives in Firestore and the opponent
   would have to coordinate).
   ============================================================ */
import React from "react";
import CardView from "./CardView.jsx";
import { getCard } from "../../tcg/cards.js";

export default function MulliganOverlay({
  hand,                   // array of {instId, cardId}
  mulligansLeft,          // 2 → 1 → 0
  onReshuffle,
  onKeep,
}) {
  return (
    <div className="tcg-mulligan">
      <div className="tcg-mulligan__panel">
        <div className="tcg-mulligan__head">
          <h2 className="tcg-mulligan__title">La tua mano iniziale</h2>
          <p className="tcg-mulligan__sub">
            Puoi rimischiare il mazzo e pescare una nuova mano fino a{" "}
            <b>2 volte</b>. Se non sei soddisfatto, prova un altro miscuglio.
          </p>
        </div>

        <div className="tcg-mulligan__hand">
          {hand.map((h) => {
            const card = getCard(h.cardId);
            return (
              <div key={h.instId} className="tcg-mulligan__card">
                <CardView card={card} variant="hand" />
              </div>
            );
          })}
        </div>

        <div className="tcg-mulligan__actions">
          <button
            type="button"
            className="tcg-btn tcg-btn--ghost"
            onClick={onReshuffle}
            disabled={mulligansLeft <= 0}
            title={
              mulligansLeft > 0
                ? "Rimette la mano nel mazzo, lo rimescola e pesca 6 nuove carte."
                : "Hai esaurito i rimischi disponibili."
            }
          >
            🔄 Rimischia
            {mulligansLeft > 0 && (
              <span className="tcg-mulligan__count"> ({mulligansLeft} rimasti)</span>
            )}
          </button>
          <button
            type="button"
            className="tcg-btn tcg-btn--primary"
            onClick={onKeep}
          >
            Tieni la mano ▶
          </button>
        </div>
      </div>
    </div>
  );
}
