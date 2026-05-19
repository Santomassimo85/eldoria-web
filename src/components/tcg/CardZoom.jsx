/* CardZoom — shared full-screen enlarged card view with the
   ability shown as a lateral floating panel. Used everywhere a
   card can be inspected (battle, deck builder, collection, shop). */
import React from "react";
import CardView from "./CardView.jsx";

export default function CardZoom({ card, onClose }) {
  if (!card) return null;
  return (
    <div className="tcg-inspect" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <CardView card={card} variant="detail" />
      </div>
      <button className="tcg-btn" onClick={onClose}>
        Chiudi
      </button>
    </div>
  );
}
