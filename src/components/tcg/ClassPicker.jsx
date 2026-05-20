/* ============================================================
   ClassPicker — pre-match SUBCLASS selection.
   Class identity is fixed by the player's starter (chosen once,
   for life). At match start you only pick which of your class' 2
   vie (subclasses) you want to follow — that drives the level-up
   path. If `lockedClass` is omitted (e.g. a brand-new dev profile
   without a starter yet) we fall back to the old two-stage flow
   so the screen is never a dead end.
   Calls onConfirm({ klass, via }).
   ============================================================ */
import React, { useState } from "react";
import {
  CLASSES, CLASS_LABEL, CLASS_ICON, CLASS_VIE, CLASS_CASTER_TIER,
} from "../../tcg/classes.js";
import { ELEMENT_PIP, ELEMENT_LABEL, ELEMENT_ICON } from "../../tcg/cards.js";

const TIER_LABEL = {
  full:    "Caster pieno",
  semi:    "Semi-caster",
  martial: "Marziale",
};

export default function ClassPicker({ onConfirm, onBack, lockedClass = null }) {
  // When the player already has a class (starter), skip stage 1 and
  // jump straight to via selection. They cannot change class here.
  const [klass, setKlass] = useState(lockedClass || null);
  const [via, setVia] = useState(null);

  const vie = klass ? CLASS_VIE[klass] : null;
  const tier = klass ? CLASS_CASTER_TIER[klass] : null;
  const classLocked = !!lockedClass;

  const reset = () => {
    if (classLocked) return;
    setKlass(null);
    setVia(null);
  };

  return (
    <div className="tcg-picker">
      <div className="tcg-picker__head">
        <h2>
          {klass
            ? (classLocked
                ? `Scegli la via — ${CLASS_LABEL[klass]}`
                : "Scegli la tua via")
            : "Scegli la tua classe"}
        </h2>
        {onBack && (
          <button className="tcg-btn" type="button" onClick={onBack}>
            ‹ Indietro
          </button>
        )}
      </div>

      {!klass && !classLocked && (
        <div className="tcg-picker__classes">
          {CLASSES.map((k) => {
            const v = CLASS_VIE[k];
            const colors = Object.values(v).map((x) => x.element);
            return (
              <button
                key={k}
                type="button"
                className="tcg-picker__class"
                onClick={() => setKlass(k)}
              >
                <div className="tcg-picker__class-ico">{CLASS_ICON[k]}</div>
                <div className="tcg-picker__class-name">{CLASS_LABEL[k]}</div>
                <div className="tcg-picker__class-tier">
                  {TIER_LABEL[CLASS_CASTER_TIER[k]]}
                </div>
                <div className="tcg-picker__class-colors">
                  {colors.map((el) => (
                    <span
                      key={el}
                      className="tcg-picker__color"
                      style={{ background: ELEMENT_PIP[el] }}
                      title={ELEMENT_LABEL[el]}
                    >
                      {ELEMENT_ICON[el]}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {klass && (
        <>
          <div className="tcg-picker__class-summary">
            <span className="tcg-picker__class-ico">{CLASS_ICON[klass]}</span>
            <b>{CLASS_LABEL[klass]}</b>
            <span className="tcg-picker__class-tier">
              ({TIER_LABEL[tier]})
            </span>
            {classLocked ? (
              <span className="tcg-picker__locked" title="La classe è fissata dallo starter">
                🔒 Classe fissata
              </span>
            ) : (
              <button
                className="tcg-btn tcg-picker__retry"
                type="button"
                onClick={reset}
              >
                cambia
              </button>
            )}
          </div>

          <div className="tcg-picker__vie">
            {Object.entries(vie).map(([viaKey, viaDef]) => (
              <button
                key={viaKey}
                type="button"
                className={`tcg-picker__via ${via === viaKey ? "is-sel" : ""}`}
                style={{ "--el": ELEMENT_PIP[viaDef.element] }}
                onClick={() => setVia(viaKey)}
              >
                <div className="tcg-picker__via-el">
                  {ELEMENT_ICON[viaDef.element]} {ELEMENT_LABEL[viaDef.element]}
                </div>
                <div className="tcg-picker__via-label">{viaDef.label}</div>
                <div className="tcg-picker__via-dnd">{viaDef.dnd}</div>
              </button>
            ))}
          </div>

          <div className="tcg-picker__actions">
            <button
              type="button"
              className="tcg-btn tcg-btn--primary"
              disabled={!via}
              onClick={() => via && onConfirm({ klass, via })}
            >
              Inizia partita
            </button>
          </div>
        </>
      )}
    </div>
  );
}
