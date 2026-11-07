/* "Peso" dei colpi (2026-11-05), comune a pet, World Boss, Segrete e Arena:
   chi incassa lampeggia bianco a scatti e arretra, il campo trema sui colpi forti,
   chi lancia una magia si gonfia e si illumina. Tutto con WAAPI a scatti (old style). */
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// scossa a scatti del campo
export function shake(el, px = 5, ms = 300) {
  if (!el?.animate || reduced()) return;
  const k = [];
  for (let i = 0; i <= 6; i++) {
    const f = 1 - i / 6;
    k.push({ transform: i === 6 ? "none" : `translate(${Math.round((i % 2 ? -1 : 1) * px * f)}px, ${Math.round(((i % 3) - 1) * px * 0.6 * f)}px)` });
  }
  el.animate(k, { duration: ms, easing: "steps(1, end)", composite: "add" });
}
// chi incassa: lampo bianco e un passo indietro (dir = verso in cui arretra, -1/0/1)
export function recoil(el, dir = 0, crit = false) {
  if (!el?.animate) return;
  const back = reduced() ? 0 : (crit ? 14 : 8) * dir;
  el.animate([
    { transform: "translateX(0)", filter: "none" },
    { transform: `translateX(${back}px)`, filter: "brightness(4) saturate(0)" },
    { transform: `translateX(${back * 0.7}px)`, filter: "none" },
    { transform: `translateX(${back * 0.4}px)`, filter: "brightness(3) saturate(0)" },
    { transform: "translateX(0)", filter: "none" },
  ], { duration: crit ? 360 : 260, easing: "steps(4, end)", composite: "add" });
}
// chi lancia una magia
export function castPose(el) {
  if (!el?.animate || reduced()) return;
  el.animate([
    { transform: "scale(1)", filter: "none" },
    { transform: "scale(1.06, .94)", filter: "brightness(1.6) drop-shadow(0 0 6px #fff)" },
    { transform: "scale(.97, 1.04) translateY(-4px)", filter: "brightness(1.3)" },
    { transform: "scale(1)", filter: "none" },
  ], { duration: 320, easing: "steps(3, end)", composite: "add" });
}
// il "campo" che contiene uno sprite (per la scossa)
export const stageOf = (el) => el?.closest?.(".rpg-battle-scene, .sgb-field, .cw-stage, .cv-field, .al-field, .pd-field") || null;
