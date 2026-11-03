// Fight dell'Arena a tutto schermo (2026-11-03): il campo (`.cv-field`) deve finire
// esattamente in fondo allo schermo, così le azioni (che stanno in fondo al campo)
// si vedono sempre. Sopra il campo ci sono cose di altezza variabile (barra del
// timer, "I tuoi fight" del Master) e i telefoni hanno altezze diverse: invece di
// un'altezza fissa in CSS si misura lo spazio che resta e si scrive in --cvp-h.
import { useEffect } from "react";

const MIN_H = 360; // sotto questa altezza il campo non sta: si scorre

export function fitFightField() {
  if (!document.body.classList.contains("in-fight")) return;
  const dialog = document.querySelector(".arena-combat-dialog");
  if (!dialog) return;
  const dRect = dialog.getBoundingClientRect();
  const viewH = Math.min(dialog.clientHeight || dRect.height, window.visualViewport?.height || window.innerHeight);
  dialog.querySelectorAll(".cv-field").forEach((field) => {
    // distanza dall'inizio del contenuto del popup, indipendente da quanto si è scorso
    const top = field.getBoundingClientRect().top - dRect.top + dialog.scrollTop;
    const h = Math.max(MIN_H, Math.floor(viewH - top));
    const val = `${h}px`;
    if (field.style.getPropertyValue("--cvp-h") !== val) field.style.setProperty("--cvp-h", val, "important");
  });
}

export function useFitFightField(active) {
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fitFightField);
    };
    schedule();
    const t = setTimeout(schedule, 300); // dopo che il popup ha finito di montarsi
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    // il campo si rimonta cambiando fight, la barra sopra cambia altezza: si rimisura
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      mo.disconnect();
      document.querySelectorAll(".cv-field").forEach((f) => f.style.removeProperty("--cvp-h"));
    };
  }, [active]);
}
