import { useEffect, useRef, useState } from "react";

/* Tema G "Aurora del Nord": tre nastri d'aurora che danzano da soli
   (CSS), stelle che scintillano e neve finissima che cade (canvas).
   Tutto ambientale: nessuna interazione richiesta. Il layer sta SOTTO
   il <main> semitrasparente (z-index 0), così l'aurora filtra dal velo.
   Solo tema chiaro (le pagine di gioco scure hanno i loro FX);
   pointer-events:none, pausa a tab nascosta, niente particelle con
   prefers-reduced-motion. Stili in src/styles/aurora.css. */

const prefersReduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function AuroraOverlay() {
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
    let stars = [];
    let snow = [];
    let t = 0;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: W < 640 ? 55 : W < 1100 ? 85 : 120 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.5 + Math.random() * 1.1,
        ph: Math.random() * Math.PI * 2,
        s: 0.5 + Math.random(),
      }));
      snow = Array.from({ length: W < 640 ? 30 : W < 1100 ? 46 : 64 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.6 + Math.random() * 1.2,
        v: 0.25 + Math.random() * 0.5,
        ph: Math.random() * Math.PI * 2,
      }));
    };

    const tick = () => {
      if (!running) return;
      t++;
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        const a = 0.12 + 0.65 * Math.abs(Math.sin(t / 80 * s.s + s.ph));
        ctx.fillStyle = `rgba(238,242,255,${a.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const f of snow) {
        f.y += f.v;
        f.x += Math.sin(t / 90 + f.ph) * 0.3;
        if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; }
        ctx.fillStyle = "rgba(238,242,255,.45)";
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
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
    <div className="aur-fx" aria-hidden="true">
      <div className="aur-nastro n1" />
      <div className="aur-nastro n2" />
      <div className="aur-nastro n3" />
      {!reduced && <canvas ref={canvasRef} className="aur-canvas" />}
    </div>
  );
}
