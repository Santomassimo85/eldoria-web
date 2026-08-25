import { useEffect, useRef, useState } from "react";

/* Tema B "Ghiaccio e Acqua": neve che cade sull'abisso, raggi di luce
   che filtrano dall'alto e — feature — a ogni tocco onde concentriche
   con cristalli di brina che crescono dal punto. Solo tema chiaro (le
   pagine di gioco scure hanno i loro FX); pointer-events:none, pausa a
   tab nascosta, niente particelle con prefers-reduced-motion.
   Stili in src/styles/glacier.css. */

const prefersReduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function FrostOverlay() {
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
    let flakes = [];
    const rings = [];
    const shards = [];

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = W < 640 ? 34 : W < 1100 ? 54 : 78;
      flakes = Array.from({ length: count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.7 + Math.random() * 1.7,
        v: 0.25 + Math.random() * 0.6,
        ph: Math.random() * Math.PI * 2,
      }));
    };

    // Feature: onde + cristalli dal punto di tocco (mai bloccante:
    // il canvas è pointer-events:none, ascoltiamo sulla window).
    const onTap = (e) => {
      if (e.clientX == null) return;
      rings.push({ x: e.clientX, y: e.clientY, rr: 4, max: 220 });
      if (rings.length > 8) rings.shift();
      for (let i = 0; i < 6; i++) {
        shards.push({
          x: e.clientX,
          y: e.clientY,
          an: Math.random() * Math.PI * 2,
          len: 0,
          max: 12 + Math.random() * 20,
          life: 80,
        });
      }
    };

    const tick = (t) => {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);

      // neve
      for (const f of flakes) {
        f.y += f.v;
        f.x += Math.sin(t / 900 + f.ph) * 0.35;
        if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; }
        const a = 0.25 + 0.55 * Math.abs(Math.sin(t / 1100 + f.ph));
        ctx.fillStyle = `rgba(232, 247, 253, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // onde del tocco
      for (let i = rings.length - 1; i >= 0; i--) {
        const g = rings[i];
        g.rr += 2.2;
        const a = Math.max(0, 1 - g.rr / g.max);
        if (a <= 0) { rings.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(111, 208, 238, ${(a * 0.8).toFixed(2)})`;
        ctx.lineWidth = 2.2 * a + 0.5;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // cristalli di brina
      for (let i = shards.length - 1; i >= 0; i--) {
        const c = shards[i];
        c.len = Math.min(c.max, c.len + 1.1);
        c.life -= 1;
        if (c.life <= 0) { shards.splice(i, 1); continue; }
        const a = Math.min(1, c.life / 36);
        ctx.strokeStyle = `rgba(191, 230, 245, ${(a * 0.85).toFixed(2)})`;
        ctx.lineWidth = 1.3;
        const ex = c.x + Math.cos(c.an) * c.len;
        const ey = c.y + Math.sin(c.an) * c.len;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(ex, ey);
        const bx = c.x + Math.cos(c.an) * c.len * 0.6;
        const by = c.y + Math.sin(c.an) * c.len * 0.6;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(c.an + 0.9) * 5, by + Math.sin(c.an + 0.9) * 5);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(c.an - 0.9) * 5, by + Math.sin(c.an - 0.9) * 5);
        ctx.stroke();
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
    window.addEventListener("pointerdown", onTap, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onTap);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, reduced]);

  if (!enabled) return null;
  return (
    <div className="frost-fx" aria-hidden="true">
      <div className="frost-ray" style={{ left: "14%" }} />
      <div className="frost-ray r2" style={{ left: "52%" }} />
      <div className="frost-ray r3" style={{ left: "80%" }} />
      {!reduced && <canvas ref={canvasRef} className="frost-canvas" />}
    </div>
  );
}
