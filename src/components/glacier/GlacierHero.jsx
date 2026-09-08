/* "R · Il Covo del Drago" (2026-09-08): il varco è diventato L'OCCHIO del
   drago — l'immagine della pagina è l'iride, segue il cursore e si dilata
   sulle schede (CovoOverlay), le palpebre sbattono (covo.css §11).
   Prototipo J "Il Nesso" — HERO STRUTTURALE condiviso = IL VARCO.
   Un portale ESAGONALE con l'immagine che respira (Ken Burns lento) e un
   bordo di luce ciano→viola→magenta; sotto (a destra su desktop) la
   testata: sigillo, kicker ciano, titolo Cinzel a gradiente, tagline e
   CTA. Tutto ambientale: nessuna interazione richiesta.
   NB: il file conserva il nome storico "GlacierHero" (e le classi gl-*)
   per non toccare i 20+ import delle pagine: il vestito è in nesso.css.
   Solo presentazione: nessuna logica applicativa. */
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
      {/* il portale: clip-path esagonale → il titolo vive FUORI, nel corpo */}
      <div className="gl-finestra-wrap occhio-wrap" aria-hidden="true">
        <div className={`gl-finestra${image ? "" : " gl-finestra--vuota"}`}>
          <span className="vene" />
          {image && (
            <img
              className="gl-finestra-img"
              src={image}
              alt={imgAlt}
              style={imgPos ? { objectPosition: imgPos } : undefined}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          )}
          <span className="fibre covo-iride" />
          <div className="gl-finestra-velo covo-iride" />
          <span className="lucido" />
        </div>
        {hint && <span className="gl-hint occhio-nota">{hint}</span>}
      </div>
      <div className="gl-hero-body">
        <div className="gl-lastra-titolo">
          {seal && <span className="gl-seal">{seal}</span>}
          {eyebrow && <div className="gl-eyebrow">{eyebrow}</div>}
          <h1 className="gl-title">{title}</h1>
        </div>
        {(tagline || actions || children) && (
          <div className="gl-sotto">
            {tagline && <p className="gl-tagline">{tagline}</p>}
            {actions && <div className="gl-actions">{actions}</div>}
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
