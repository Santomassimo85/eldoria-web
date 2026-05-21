/* ============================================================
   ClassPicker — pre-match CLASS + VIA selection.
   2026-05-21: l'identità di classe non è più fissa allo starter.
   Si rileva da SOLO il deck del giocatore (i colori delle carte
   non-terra). Mostra:
     • le classi BASE compatibili (almeno 1 colore nel mazzo)
     • le MULTICLASSI compatibili (tutti i 3 colori nel mazzo)
     • un avviso se il mazzo non copre NESSUNA classe (niente XP,
       slot, ultimate — la partita si gioca "in incolore").
   Il giocatore può anche scegliere di non avere classe (modalità
   senza bonus). Le vie disponibili dipendono dalla classe scelta
   (multiclasse → unione delle 4 vie delle classi sorgenti).
   Chiama onConfirm({ klass, via }) o onConfirm(null) per giocare
   senza classe.
   ============================================================ */
import React, { useMemo, useState } from "react";
import {
  CLASSES, CLASS_LABEL, CLASS_ICON, CLASS_VIE, CLASS_CASTER_TIER,
  MULTICLASSES, MULTICLASS_DEF, MULTICLASS_LABEL, MULTICLASS_ICON,
  isMulticlass, vieFor, casterTierFor,
  computeDeckColors, computeEligibleClasses,
} from "../../tcg/classes.js";
import {
  ELEMENT_PIP, ELEMENT_LABEL, ELEMENT_ICON, getCard,
} from "../../tcg/cards.js";

const TIER_LABEL = {
  full:    "Caster pieno",
  semi:    "Semi-caster",
  martial: "Marziale",
};

function ColorPip({ el }) {
  return (
    <span
      className="tcg-picker__color"
      style={{ background: ELEMENT_PIP[el] }}
      title={ELEMENT_LABEL[el]}
    >
      {ELEMENT_ICON[el]}
    </span>
  );
}

function classMeta(k) {
  if (isMulticlass(k)) {
    const m = MULTICLASS_DEF[k];
    return {
      label: MULTICLASS_LABEL[k],
      icon:  MULTICLASS_ICON[k],
      tier:  "mix",                // multi: tier varia con la via
      colors: m.elements,
      desc:  m.desc,
      isMulti: true,
    };
  }
  return {
    label: CLASS_LABEL[k],
    icon:  CLASS_ICON[k],
    tier:  CLASS_CASTER_TIER[k],
    colors: Object.values(CLASS_VIE[k]).map((v) => v.element),
    desc:  null,
    isMulti: false,
  };
}

export default function ClassPicker({ onConfirm, onBack, deck = null }) {
  const [klass, setKlass] = useState(null);
  const [via, setVia] = useState(null);

  /* Rileva i colori del mazzo e calcola le classi/multiclassi sbloccate. */
  const { colors, eligible } = useMemo(() => {
    const cols = computeDeckColors(deck, getCard);
    const elig = computeEligibleClasses(cols);
    return { colors: Array.from(cols), eligible: elig };
  }, [deck]);

  const noneEligible = !eligible.anyEligible;

  const vie = klass ? vieFor(klass) : null;
  const tier = klass && via ? casterTierFor(klass, via) : null;

  const reset = () => { setKlass(null); setVia(null); };

  const renderClassButton = (k) => {
    const meta = classMeta(k);
    return (
      <button
        key={k}
        type="button"
        className={`tcg-picker__class ${meta.isMulti ? "is-multi" : ""}`}
        onClick={() => { setKlass(k); setVia(null); }}
      >
        <div className="tcg-picker__class-ico">{meta.icon}</div>
        <div className="tcg-picker__class-name">{meta.label}</div>
        <div className="tcg-picker__class-tier">
          {meta.isMulti ? "Multiclasse" : TIER_LABEL[meta.tier]}
        </div>
        <div className="tcg-picker__class-colors">
          {meta.colors.map((el) => <ColorPip key={el} el={el} />)}
        </div>
        {meta.desc && (
          <div className="tcg-picker__class-desc">{meta.desc}</div>
        )}
      </button>
    );
  };

  return (
    <div className="tcg-picker">
      <div className="tcg-picker__head">
        <h2>
          {klass
            ? `Scegli la via — ${classMeta(klass).label}`
            : "Scegli la classe in base al tuo mazzo"}
        </h2>
        {onBack && (
          <button className="tcg-btn" type="button" onClick={onBack}>
            ‹ Indietro
          </button>
        )}
      </div>

      {!klass && (
        <>
          {/* Riassunto colori rilevati nel mazzo */}
          <div className="tcg-picker__deckcolors">
            <span className="tcg-picker__deckcolors-lbl">
              Colori del tuo mazzo:
            </span>
            {colors.length === 0 ? (
              <span className="tcg-picker__deckcolors-empty">— nessuno —</span>
            ) : (
              colors.map((el) => <ColorPip key={el} el={el} />)
            )}
          </div>

          {noneEligible ? (
            <div className="tcg-picker__warn">
              <h3>⚠️ Mazzo senza copertura di classe</h3>
              <p>
                Il tuo mazzo non contiene carte colorate sufficienti per
                sbloccare una classe. Puoi giocare comunque, ma{" "}
                <b>non avrai XP, spell slot né ultimate</b>.
              </p>
              <button
                type="button"
                className="tcg-btn tcg-btn--primary"
                onClick={() => onConfirm(null)}
              >
                Gioca senza classe
              </button>
            </div>
          ) : (
            <>
              {eligible.classes.length > 0 && (
                <>
                  <h3 className="tcg-picker__sect">Classi base</h3>
                  <div className="tcg-picker__classes">
                    {eligible.classes.map(renderClassButton)}
                  </div>
                </>
              )}

              {eligible.multiclasses.length > 0 && (
                <>
                  <h3 className="tcg-picker__sect">
                    Multiclassi <small>(richiedono tutti i 3 colori)</small>
                  </h3>
                  <div className="tcg-picker__classes">
                    {eligible.multiclasses.map(renderClassButton)}
                  </div>
                </>
              )}

              <div className="tcg-picker__skip">
                <button
                  type="button"
                  className="tcg-btn tcg-btn--ghost"
                  onClick={() => onConfirm(null)}
                  title="Niente XP, slot né ultimate"
                >
                  Gioca senza classe
                </button>
              </div>
            </>
          )}
        </>
      )}

      {klass && (
        <>
          <div className="tcg-picker__class-summary">
            <span className="tcg-picker__class-ico">{classMeta(klass).icon}</span>
            <b>{classMeta(klass).label}</b>
            {tier && (
              <span className="tcg-picker__class-tier">
                ({TIER_LABEL[tier]})
              </span>
            )}
            <button
              className="tcg-btn tcg-picker__retry"
              type="button"
              onClick={reset}
            >
              cambia
            </button>
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
