/* StarterSelect — first-login one-time choice of a starter element.
   Shown ONLY when the persisted profile has no starter claimed, so
   reloading / reopening never re-asks. */
import React, { useState } from "react";
import {
  ELEMENT_LABEL, ELEMENT_ICON, ELEMENT_PIP,
} from "../../tcg/cards.js";
import { STARTER_ELEMENTS } from "../../tcg/collection.js";

const BLURB = {
  fire: "Aggressivo: creature rapide e danni diretti.",
  water: "Controllo: creature resistenti e gelo.",
  air: "Versatile: rimozione, pescata e potenziamenti.",
  nature: "Schiere: tante creature e corpo a corpo.",
};

export default function StarterSelect({ onPick }) {
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState(null);

  const pick = async (el) => {
    if (busy) return;
    setBusy(true);
    setChosen(el);
    const res = await onPick(el);
    if (!res || res.ok === false) {
      setBusy(false);
      setChosen(null);
    }
    // on success the profile flips starterClaimed → this screen unmounts
  };

  return (
    <div className="tcg-starter">
      <div className="tcg-starter__head">
        <h1 className="tcg-title">Scegli il tuo elemento</h1>
        <p className="tcg-subtitle">
          Una scelta sola, per sempre. Riceverai un mazzo iniziale e delle
          monete. ({ELEMENT_LABEL.darkness} e {ELEMENT_LABEL.light} si
          sbloccano nel Negozio.)
        </p>
      </div>

      <div className="tcg-starter__grid">
        {STARTER_ELEMENTS.map((el) => (
          <button
            key={el}
            className={`tcg-starter__card ${chosen === el ? "is-chosen" : ""}`}
            style={{ "--pip": ELEMENT_PIP[el] }}
            disabled={busy}
            onClick={() => pick(el)}
          >
            <span className="tcg-starter__icon">{ELEMENT_ICON[el]}</span>
            <span className="tcg-starter__name">{ELEMENT_LABEL[el]}</span>
            <span className="tcg-starter__blurb">{BLURB[el]}</span>
            <span className="tcg-starter__cta">
              {busy && chosen === el ? "Assegnazione…" : "Scegli"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
