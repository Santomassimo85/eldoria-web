/* Tema C "Draghi · Il Covo" — HERO STRUTTURALE condiviso.
   IL COVO BUIO del mockup C: cornice del tesoro con angoli d'oro,
   immagine spenta che la TORCIA rivela seguendo dito/cursore (doppia
   immagine + mask radiale + fiamma), velo caldo in basso e titolo
   d'oro fuso con kicker rosso; sotto, tagline in corsivo + CTA tesoro.
   NB: il file conserva il nome storico "GlacierHero" (e le classi gl-*)
   per non toccare i 20+ import delle pagine: il vestito è in drake.css.
   Solo presentazione: nessuna logica applicativa. */
import { useRef } from "react";

export default function GlacierHero({
  id,
  className = "",
  image,
  imgAlt = "",
  imgPos,
  hint,
  eyebrow,
  title,
  seal,
  tagline,
  actions,
  children,
  ariaLabel,
}) {
  const covoRef = useRef(null);

  // La torcia segue il puntatore: aggiorna --tx/--ty sul contenitore
  // (pura presentazione; la mask e la fiamma leggono le variabili).
  const muovi = (e) => {
    const el = covoRef.current;
    if (!el || e.clientX == null) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--tx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(2)}%`);
    el.style.setProperty("--ty", `${(((e.clientY - r.top) / r.height) * 100).toFixed(2)}%`);
  };

  const imgStyle = imgPos ? { objectPosition: imgPos } : undefined;
  return (
    <section id={id} className={`gl-hero ${className}`.trim()} aria-label={ariaLabel}>
      <div
        className="gl-finestra"
        ref={covoRef}
        onPointerMove={image ? muovi : undefined}
        onPointerDown={image ? muovi : undefined}
      >
        {hint && <span className="gl-hint">{hint}</span>}
        {image && (
          <img
            className="gl-finestra-img"
            src={image}
            alt={imgAlt}
            style={imgStyle}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
        {image && (
          <img
            className="gl-covo-chiaro"
            src={image}
            alt=""
            aria-hidden="true"
            style={imgStyle}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
        {image && <div className="gl-torcia-luce" aria-hidden="true" />}
        {image && <div className="gl-fiamma" aria-hidden="true" />}
        <div className="gl-finestra-velo" aria-hidden="true" />
        <div className="gl-lastra-titolo">
          {seal && <span className="gl-seal">{seal}</span>}
          {eyebrow && <div className="gl-eyebrow">{eyebrow}</div>}
          <h1 className="gl-title">{title}</h1>
        </div>
      </div>
      {(tagline || actions || children) && (
        <div className="gl-sotto">
          {tagline && <p className="gl-tagline">{tagline}</p>}
          {actions && <div className="gl-actions">{actions}</div>}
          {children}
        </div>
      )}
    </section>
  );
}
