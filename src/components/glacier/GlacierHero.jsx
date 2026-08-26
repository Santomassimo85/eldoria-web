/* Tema G "Aurora del Nord" — HERO STRUTTURALE condiviso.
   Il PANORAMA del mockup G: immagine a tutta larghezza che respira
   (Ken Burns lento, ambientale), velo di notte, kicker alla menta e
   titolo Marcellus con filo d'aurora ancorati in basso; sotto,
   tagline in corsivo + CTA "faro". Nessuna interazione richiesta.
   NB: il file conserva il nome storico "GlacierHero" (e le classi
   gl-*) per non toccare i 20+ import delle pagine: il vestito è in
   aurora.css. Solo presentazione: nessuna logica applicativa. */
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
        {hint && <span className="gl-hint">{hint}</span>}
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
