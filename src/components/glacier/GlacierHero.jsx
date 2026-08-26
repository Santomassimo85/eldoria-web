/* Tema "Ghiaccio e Acqua" — HERO STRUTTURALE condiviso.
   La FINESTRA ARTICA del mockup B: arco di ghiaccio con immagine,
   velo d'abisso, brina agli angoli e titolo inciso sulla lastra in
   basso; sotto la finestra tagline in corsivo + azioni a cristallo.
   Solo presentazione: nessuna logica. Stili: glacier.css (sez. 9). */
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
  return (
    <section id={id} className={`gl-hero ${className}`.trim()} aria-label={ariaLabel}>
      <div className="gl-finestra">
        {hint && <span className="gl-hint">❄ {hint}</span>}
        {image && (
          <img
            className="gl-finestra-img"
            src={image}
            alt={imgAlt}
            style={imgPos ? { objectPosition: imgPos } : undefined}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
        <div className="gl-finestra-velo" aria-hidden="true" />
        <div className="gl-finestra-brina" aria-hidden="true" />
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
