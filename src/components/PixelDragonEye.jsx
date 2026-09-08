/* L'OCCHIO DEL DRAGO IN PIXEL ART (2026-09-08)
   Un canvas 96×88 disegnato pixel per pixel in JS e scalato senza sfocatura
   (image-rendering: pixelated). Niente immagini: squame blu a placche
   (celle di Voronoi + bande di luce dal bordo), fessura a mandorla nera,
   iride ambra a tratteggio ordinato (Bayer 4×4), pupilla a lama che SEGUE
   IL CURSORE e si DILATA sulle schede (CovoOverlay scrive --dil sullo
   <span class="pupilla"> nascosto), palpebre che sbattono ogni tanto.
   Solo presentazione: nessuna logica applicativa. */
import { useEffect, useRef } from "react";

const W = 96, H = 88;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// iride: dal bordo scuro (0) al cuore giallo (7)
const IRIDE = ["#2e0f04", "#6b2606", "#a4440a", "#d2700f", "#ee9a14", "#f8bd22", "#ffd84a", "#ffee8c"].map(hex);
// pelle: dal filo di luce sul bordo (0) verso l'ombra (5)
const PELLE = ["#5a78ff", "#3352e6", "#2238b4", "#172a84", "#111d5e", "#0b1340"].map(hex);
const BIANCO = [255, 255, 255], LUCE = [214, 224, 255], NERO = [0, 0, 0];
const FONDO = [5, 7, 15], FONDO2 = [12, 16, 44];

const hash = (x, y) => {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

// geometria dell'apertura: mandorla inclinata, tonda in alto a sinistra e a punta in basso a destra
const CX = 52, CY = 47, TH = (38 * Math.PI) / 180, COS = Math.cos(TH), SIN = Math.sin(TH);
const L = 50, A = 22;
const mezzaAltezza = (t) => {
  let s, base;
  if (t < -0.3) { s = (t + 0.3) / 0.7; base = 1 - s * s; return base <= 0 ? 0 : A * Math.sqrt(base); }
  s = (t + 0.3) / 1.3; base = 1 - s * s; return base <= 0 ? 0 : A * Math.pow(base, 0.72);
};
// iride: centro a riposo, raggio
const IX = CX - 0.22 * L * COS, IY = CY - 0.22 * L * SIN, R = 27;
const PHI = (8 * Math.PI) / 180, SP = Math.sin(PHI), CP = Math.cos(PHI);   // inclinazione della lama
const HR = (28 * Math.PI) / 180, SH = Math.sin(HR), CH = Math.cos(HR);     // inclinazione del riflesso

// le placche delle squame (Voronoi) sono statiche: calcolate una volta sola
function placche() {
  const S = 10, cols = Math.ceil(W / S) + 2, rows = Math.ceil(H / S) + 2;
  const seeds = [];
  for (let j = -1; j < rows; j++) for (let i = -1; i < cols; i++) {
    seeds.push({ i, j, x: i * S + hash(i, j) * S * 0.85, y: j * S + hash(j + 7, i + 3) * S * 0.85, k: hash(i + 11, j + 5) });
  }
  const jit = new Float32Array(W * H), edge = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ci = Math.floor(x / S), cj = Math.floor(y / S);
    let d1 = 1e9, d2 = 1e9, k = 0;
    for (const s of seeds) {
      if (Math.abs(s.i - ci) > 1 || Math.abs(s.j - cj) > 1) continue;
      const d = (s.x - x - 0.5) ** 2 + (s.y - y - 0.5) ** 2;
      if (d < d1) { d2 = d1; d1 = d; k = s.k; } else if (d < d2) d2 = d;
    }
    jit[y * W + x] = k;
    edge[y * W + x] = Math.sqrt(d2) - Math.sqrt(d1) < 1.25 ? 1 : 0;
  }
  return { jit, edge };
}

function disegna(img, plac, st) {
  const px = img.data;
  const c = st.c;                                  // chiusura palpebre 0..1
  const ix = IX + Math.round(st.ox), iy = IY + Math.round(st.oy);
  const wmax = 3.2 + st.dil * 4.2;                 // larghezza della lama
  const Hs = R * 0.78;
  const hx = ix + 3, hy = iy - 10;                 // il riflesso
  let p = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 4) {
    const fx = x + 0.5, fy = y + 0.5;
    const dx = fx - CX, dy = fy - CY;
    const u = dx * COS + dy * SIN, v = -dx * SIN + dy * COS;
    const t = u / L;
    const hh = mezzaAltezza(t) * (1 - c);
    const av = Math.abs(v);
    let col;
    if (hh > 0 && av < hh) {
      // dentro la fessura: nero, poi l'iride
      col = NERO;
      const ex = fx - ix, ey = fy - iy;
      const d = Math.hypot(ex, ey);
      if (d < R) {
        if (d > R - 1.6) col = IRIDE[0];
        else {
          let s = 1 - d / R;
          s += 0.25 * (-(ex / R) * 0.7 - (ey / R) * 0.45);            // luce da in alto a sinistra
          s += 0.045 * Math.sin(Math.atan2(ey, ex) * 13 + d * 0.4);   // le fibre
          const val = s * 7.6 + (BAYER[(x & 3) + (y & 3) * 4] / 16 - 0.5) * 0.85;
          col = IRIDE[Math.max(0, Math.min(7, Math.floor(val)))];
        }
        // la pupilla: lama quasi verticale, larga in alto e affilata in basso
        const qx = ex - 2, qy = ey;
        const along = qx * SP + qy * CP, across = qx * CP - qy * SP;
        if (Math.abs(along) < Hs) {
          const k = along / Hs;
          const w = wmax * Math.pow(1 - k * k, 0.6) * (1 - 0.3 * k);
          const aa = Math.abs(across);
          if (aa < w) col = NERO;
          else if (aa < w + 1 && w > 0.4) col = IRIDE[1];
        }
        // il riflesso: mezzaluna bianca in alto a destra + una scintilla
        const rx = fx - hx, ry = fy - hy;
        const a = rx * CH + ry * SH, b = -rx * SH + ry * CH;
        if ((a * a) / (5.5 * 5.5) + (b * b) / (2.4 * 2.4) < 1) col = BIANCO;
        else if (Math.hypot(fx - (ix + 7), fy - (iy - 1)) < 1.2) col = BIANCO;
      }
    } else {
      // la pelle: bande di luce dal bordo della fessura, a placche
      const dist = Math.max(av - hh, 0) + Math.max(Math.abs(u) - L, 0) * 0.8;
      const i = y * W + x;
      const dd = dist + (plac.jit[i] - 0.5) * 5;
      let idx = dd < 1.6 ? 0 : dd < 4.5 ? 1 : dd < 9 ? 2 : dd < 15 ? 3 : dd < 22 ? 4 : dd < 30 ? 5 : -1;
      if (idx < 0) {
        col = ((x + (y & 2 ? 2 : 0)) & 3) === 0 && (y & 1) === 0 ? FONDO2 : FONDO;
      } else {
        const e = plac.edge[i];
        if (e && idx < 5) idx += 1;                                   // la fessura tra le placche
        col = PELLE[idx];
        const hz = hash(x, y);
        if (dist < 2.2 && v < 0 && hz < 0.09) col = BIANCO;          // scintille sul bordo della palpebra
        else if (e && idx <= 3 && hz > 0.955) col = LUCE;            // riflessi sulle placche
      }
    }
    px[p] = col[0]; px[p + 1] = col[1]; px[p + 2] = col[2]; px[p + 3] = 255;
  }
}

export default function PixelDragonEye() {
  const cvRef = useRef(null);
  const dilRef = useRef(null);
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: false });
    const img = ctx.createImageData(W, H);
    const plac = placche();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const st = { ox: 0, oy: 0, tx: 0, ty: 0, dil: 0, tdil: 0, c: 0 };
    let raf = 0, visible = true, lastPointer = 0, blinkAt = performance.now() + 2800, blinkT0 = -1, wanderAt = 0;
    let lastKey = "";

    const frame = (now) => {
      raf = 0;
      // palpebre
      if (!reduced) {
        if (blinkT0 < 0 && now >= blinkAt) blinkT0 = now;
        if (blinkT0 >= 0) {
          const k = (now - blinkT0) / 260;
          if (k >= 1) { blinkT0 = -1; st.c = 0; blinkAt = now + 4200 + Math.random() * 4200; }
          else st.c = Math.sin(k * Math.PI);
        }
        // senza cursore lo sguardo vaga
        if (now - lastPointer > 4000 && now >= wanderAt) {
          st.tx = (Math.random() * 2 - 1) * 4; st.ty = (Math.random() * 2 - 1) * 2.5;
          wanderAt = now + 2500 + Math.random() * 3000;
        }
      }
      st.ox += (st.tx - st.ox) * 0.18; st.oy += (st.ty - st.oy) * 0.18;
      st.dil += (st.tdil - st.dil) * 0.2;
      const key = `${Math.round(st.ox)}|${Math.round(st.oy)}|${st.dil.toFixed(2)}|${st.c.toFixed(2)}`;
      if (key !== lastKey) { lastKey = key; disegna(img, plac, st); ctx.putImageData(img, 0, 0); }
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };

    const onMove = (e) => {
      const r = cv.getBoundingClientRect();
      if (!r.width) return;
      lastPointer = performance.now();
      const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      st.tx = Math.max(-6, Math.min(6, dx * 14));
      st.ty = Math.max(-4, Math.min(4, dy * 10));
      wake();
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    // dilatazione: CovoOverlay scrive --dil sullo span .pupilla nascosto
    const dil = dilRef.current;
    const mo = new MutationObserver(() => { st.tdil = dil.style.getPropertyValue("--dil") ? 1 : 0; wake(); });
    if (dil) mo.observe(dil, { attributes: true, attributeFilter: ["style"] });

    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; wake(); });
    io.observe(cv);
    const onVis = () => wake();
    document.addEventListener("visibilitychange", onVis);
    // primo fotogramma SUBITO (anche a scheda nascosta, dove il rAF non scatta)
    disegna(img, plac, st); ctx.putImageData(img, 0, 0); lastKey = "0|0|0.00|0.00";
    wake();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      mo.disconnect(); io.disconnect();
    };
  }, []);

  return (
    <div className="occhio occhio--pixel">
      <canvas ref={cvRef} width={W} height={H} aria-hidden="true" />
      <span ref={dilRef} className="pupilla" hidden />
    </div>
  );
}
