import { Link, useLocation } from "react-router-dom";
import "./PageTabs.css";

// ── Pagine sorelle unite sotto una sola voce di menu (2026-10-27) ───────────
// Due pagine che parlano della stessa cosa (la Mappa e i Luoghi, l'Officina e
// il suo manuale…) restano due rotte, ma in cima hanno la stessa barra di
// schede: si passa dall'una all'altra senza tornare al menu, e il menu ne
// mostra una sola. I vecchi indirizzi continuano a funzionare: sono le schede.
// Il <div role="tablist"> si veste da solo con le rune del Covo (covo.css):
// MAI un <nav>, che shell.css trasforma nel drawer.
export const PAGE_GROUPS = {
  atlante: { label: "L'Atlante", tabs: [
    { to: "/world-map", label: "Mappa" },
    { to: "/Geo", label: "Luoghi" },
  ]},
  cronache: { label: "Le Cronache", tabs: [
    { to: "/riassunti", label: "Riassunti" },
    { to: "/diario", label: "Diario di Bordo" },
  ]},
  officina: { label: "L'Officina", tabs: [
    { to: "/officina", label: "Il banco" },
    { to: "/crafting", label: "Il manuale" },
  ]},
  mercato: { label: "Il Mercato Nero", tabs: [
    { to: "/mercato", label: "Il banco" },
    { to: "/ratti-lore", label: "La Gilda dei Ratti" },
  ]},
};

export default function PageTabs({ group, children }) {
  const { pathname } = useLocation();
  const g = PAGE_GROUPS[group];
  if (!g) return children;
  return (
    <>
      <div className="page-tabs" role="tablist" aria-label={g.label}>
        {g.tabs.map((t) => {
          const on = pathname === t.to;
          return (
            <Link key={t.to} to={t.to} role="tab" aria-selected={on} className={on ? "active" : ""}>
              {t.label}
            </Link>
          );
        })}
      </div>
      {children}
    </>
  );
}
