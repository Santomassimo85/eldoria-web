// La modale/drawer dell'Arena (portal).
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.
import { useEffect } from "react";
import { createPortal } from "react-dom";

/* FIX: P5b/P5c/P5d — reusable modal portal */
export function ArenaModal({ open, onClose, title, children, variant = "modal", className = "", inlineTarget = null }) {
  const isInline = variant === "combat" && !!inlineTarget;
  useEffect(() => {
    if (!open || isInline) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, isInline]);

  if (!open) return null;
  // Scontro INLINE nel palco dell'hub: niente overlay, niente header — il
  // combattimento sboccia sotto le carte VS (stesso markup, stessa logica).
  if (isInline) {
    return createPortal(
      <div className={`arena-combat-dialog arena-combat-inline${className ? ` ${className}` : ""}`} role="region" aria-label={title}>
        <div className="arena-modal-body">{children}</div>
      </div>,
      inlineTarget
    );
  }
  const overlayClass =
    variant === "drawer" ? "arena-drawer-overlay"
    : variant === "combat" ? "arena-combat-overlay"
    : "arena-modal-overlay";
  const dialogClass =
    variant === "drawer" ? "arena-drawer-dialog"
    : variant === "combat" ? "arena-combat-dialog"
    : "arena-modal-dialog";
  return createPortal(
    <div className={overlayClass} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`${dialogClass}${className ? ` ${className}` : ""}`} onClick={(e) => e.stopPropagation()}>
        {variant === "combat" && (
          <div className="arena-combat-fx" aria-hidden="true">
            <span className="acfx-pulse" />
            <span className="acfx-scan" />
            <span className="acfx-ember e1" /><span className="acfx-ember e2" /><span className="acfx-ember e3" />
            <span className="acfx-ember e4" /><span className="acfx-ember e5" /><span className="acfx-ember e6" />
            <span className="acfx-ember e7" /><span className="acfx-ember e8" />
          </div>
        )}
        {variant === "drawer" && <span className="arena-drawer-handle" aria-hidden="true" />}
        <header className="arena-modal-header">
          <h3 className="arena-modal-title">{title}</h3>
          <button type="button" className="arena-modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </header>
        <div className="arena-modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
