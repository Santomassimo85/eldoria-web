import { useEffect, useRef, useState } from "react";

/* Prototipo J "Il Nesso": il VUOTO tra i mondi. Tre nebulose che
   respirano (CSS) e un WARP di stelle che scivolano via dal centro
   (canvas). Tutto ambientale: nessuna interazione richiesta. Il layer
   sta SOTTO il <main> (z-index 0). Solo tema chiaro (le pagine di gioco
   scure hanno i loro FX); pointer-events:none, pausa a tab nascosta,
   niente stelle con prefers-reduced-motion. Stili in styles/nesso.css. */

const prefersReduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function NessoOverlay() {
  const canvasRef = useRef(null);
  const [enabled, setEnabled] = useState(
    () => !document.body.classList.contains("theme-dark")
  );
  const [reduced, setReduced] = useState(prefersReduced);

  // Segue body.theme-dark (App lo aggiorna al cambio rotta).
  useEffect(() => {
    const update = () =>
      setEnabled(!document.body.classList.contains("theme-dark"));
    const mo = new MutationObserver(update);
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    update();
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!enabled || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let raf = 0;
    let running = true;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let stars = [];

    // una stella nasce vicino al centro e scivola verso il bordo
    const nasce = (sparse) => ({
      a: Math.random() * Math.PI * 2,
      d: sparse ? Math.random() * W * 0.5 : 20 + Math.random() * 60,
      v: 0.2 + Math.random() * 0.6,
      r: 0.4 + Math.random(),
    });

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: W < 600 ? 60 : W < 1100 ? 90 : 120 }, () => nasce(true));
    };

    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        s.d += s.v * (s.d / 140);
        const x = W / 2 + Math.cos(s.a) * s.d;
        const y = H / 2 + Math.sin(s.a) * s.d;
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) {
          Object.assign(s, nasce(false));
          continue;
        }
        const al = Math.min(0.8, s.d / 300);
        ctx.fillStyle = `rgba(237,234,255,${al.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      running = !document.hidden;
      if (running) raf = requestAnimationFrame(tick);
      else cancelAnimationFrame(raf);
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, reduced]);

  if (!enabled) return null;
  return (
    <div className="nesso-fx" aria-hidden="true">
      <div className="nesso-nebula n1" />
      <div className="nesso-nebula n2" />
      <div className="nesso-nebula n3" />
      {!reduced && <canvas ref={canvasRef} className="nesso-warp" />}
    </div>
  );
}
