/* StarterSelect — first-login one-time choice of a starter CLASS.
   Replaces the old element starter: you now pick a class, which
   determines your 2-colour identity. Shown ONLY when the persisted
   profile has no starter claimed, so reloading never re-asks. */
import React, { useState } from "react";
import {
  CLASSES, CLASS_LABEL, CLASS_ICON, CLASS_VIE, CLASS_CASTER_TIER, classColors,
} from "../../tcg/classes.js";
import { ELEMENT_LABEL, ELEMENT_ICON, ELEMENT_PIP } from "../../tcg/cards.js";

const BLURB = {
  mago:      "Caster pieno: spell, slot e controllo arcano.",
  guerriero: "Marziale: aggro fisico e creature pesanti.",
  chierico:  "Semi-caster: cure, ward, drain e sostegno.",
  ladro:     "Marziale veloce: burst, evasione, tempo.",
  druido:    "Semi-caster: natura, ramp e trasformazione.",
};

const TIER_LABEL = {
  full: "Caster pieno", semi: "Semi-caster", martial: "Marziale",
};

export default function StarterSelect({ onPick }) {
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState(null);

  const pick = async (k) => {
    if (busy) return;
    setBusy(true);
    setChosen(k);
    // onPick is wired to grantStarter(uid, classKey); a result of ok:false
    // bails out and lets the player try again.
    const res = await onPick(k);
    if (!res || res.ok === false) {
      setBusy(false);
      setChosen(null);
    }
    // on success the profile flips starterClaimed → this screen unmounts
  };

  return (
    <div className="tcg-starter">
      <div className="tcg-starter__head">
        <h1 className="tcg-title">Scegli il tuo mazzo iniziale</h1>
        <p className="tcg-subtitle">
          Ti diamo un mazzo a tema della classe scelta e qualche moneta.
          La classe <b>non è fissa per sempre</b>: a ogni partita verrà
          rilevata dai <b>colori del tuo mazzo</b>, e potrai cambiarla
          modificando le carte (o costruendone uno tutto tuo).
        </p>
      </div>

      <div className="tcg-starter__grid">
        {CLASSES.map((k) => {
          const colors = classColors(k);
          const primary = colors[0];
          return (
            <button
              key={k}
              className={`tcg-starter__card ${chosen === k ? "is-chosen" : ""}`}
              style={{ "--pip": ELEMENT_PIP[primary] }}
              disabled={busy}
              onClick={() => pick(k)}
            >
              <span className="tcg-starter__icon">{CLASS_ICON[k]}</span>
              <span className="tcg-starter__name">{CLASS_LABEL[k]}</span>
              <span className="tcg-starter__blurb">{BLURB[k]}</span>
              <span className="tcg-starter__tier">{TIER_LABEL[CLASS_CASTER_TIER[k]]}</span>
              <span className="tcg-starter__colors">
                {colors.map((el) => (
                  <span
                    key={el}
                    className="tcg-starter__cdot"
                    style={{ background: ELEMENT_PIP[el] }}
                    title={ELEMENT_LABEL[el]}
                  >
                    {ELEMENT_ICON[el]}
                  </span>
                ))}
              </span>
              <span className="tcg-starter__cta">
                {busy && chosen === k ? "Assegnazione…" : "Scegli"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
