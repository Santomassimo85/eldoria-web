import { useEffect, useRef, useState } from "react";

/* Tema C "Draghi · Il Covo": un drago attraversa il cielo del covo e il
   tesoro luccica sul fondo (scintille d'oro, rosso drago e squama con
   bagliori a croce). Solo tema chiaro (le pagine di gioco scure hanno i
   loro FX); pointer-events:none, pausa a tab nascosta, niente particelle
   con prefers-reduced-motion. Stili in src/styles/drake.css. */

const prefersReduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function DrakeOverlay() {
  const canvasRef = useRef(null);
  const [enabled, setEnabled] = useState(
    () => !document.body.classList.contains("theme-dark")
  );
  const [reduced, setReduced] = useState(prefersReduced);

  // Segue body.theme-dark (App lo aggiorna al cambio rotta): nessuna
  // seconda lista di rotte da tenere allineata.
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
    let gems = [];
    let t = 0;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = W < 640 ? 22 : W < 1100 ? 32 : 44;
      gems = Array.from({ length: count }, () => ({
        x: Math.random() * W,
        y: H * 0.8 + Math.random() * H * 0.19,
        ph: Math.random() * Math.PI * 2,
        s: 0.4 + Math.random() * 0.8,
        c: Math.random() < 0.7
          ? "227,170,60"
          : Math.random() < 0.5
            ? "192,58,42"
            : "46,154,90",
      }));
    };

    const tick = () => {
      if (!running) return;
      t++;
      ctx.clearRect(0, 0, W, H);
      for (const g of gems) {
        const a = Math.max(0, Math.sin(t / 50 * g.s + g.ph));
        ctx.fillStyle = `rgba(${g.c},${(a * 0.9).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 1.5 + a, 0, Math.PI * 2);
        ctx.fill();
        // bagliore a croce quando la gemma prende luce
        if (a > 0.92) {
          ctx.strokeStyle = `rgba(255,240,200,${((a - 0.9) * 6).toFixed(2)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(g.x - 6, g.y);
          ctx.lineTo(g.x + 6, g.y);
          ctx.moveTo(g.x, g.y - 6);
          ctx.lineTo(g.x, g.y + 6);
          ctx.stroke();
        }
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
    <div className="drake-fx" aria-hidden="true">
      {!reduced && <span className="drake-dragon">🐉</span>}
      {!reduced && <canvas ref={canvasRef} className="drake-canvas" />}
    </div>
  );
}
