/* Tema "Ghiaccio e Acqua" — VETRATA PANORAMICA condivisa (mockup B).
   Lastra 16/9 con immagine, velo d'abisso da sinistra, titolo +
   sottotitolo + sigillo di gelo, riflesso animato sul vetro.
   Renderizza <Link> se riceve `to`, <a> se `href`, <button> se solo
   `onClick`, altrimenti <article>. Nessuna logica propria. */
import { Link } from "react-router-dom";

export default function Vetrata({
  img,
  imgPos,
  title,
  sub,
  sigillo,
  to,
  href,
  onClick,
  target,
  rel,
  className = "",
  children,
}) {
  const inner = (
    <>
      {img && (
        <img
          className="gl-vetrata-img"
          src={img}
          alt=""
          loading="lazy"
          style={imgPos ? { objectPosition: imgPos } : undefined}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      )}
      <div className="gl-vetrata-velo" aria-hidden="true" />
      <div className="gl-vetrata-riq">
        {title && <h3 className="gl-vetrata-title">{title}</h3>}
        {sub && <p className="gl-vetrata-sub">{sub}</p>}
        {sigillo && <span className="gl-seal">{sigillo}</span>}
        {children}
      </div>
    </>
  );
  const cls = `gl-vetrata ${className}`.trim();
  if (to) return <Link className={cls} to={to} onClick={onClick}>{inner}</Link>;
  if (href) {
    return (
      <a className={cls} href={href} onClick={onClick} target={target} rel={rel}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <article className={cls}>{inner}</article>;
}
