import { useEffect, useRef, useState } from "react";

/* "R · IL COVO DEL DRAGO" — la PELLE del drago sotto tutto il sito.
   Due canvas fissi (z-index -1, sotto <main>):
     · #pelle  → le squame (statiche, ridipinte a resize / cambio respiro)
     · #soffio → il respiro: alone che pulsa, squame accese vicino al cursore,
                 braci che salgono (Fuoco) o cristalli che scendono (Gelo)
   Più i gesti globali del covo (delegati sul documento, nessuna pagina toccata):
     · l'IRIDE (.gl-finestra-img / .covo-iride) segue il cursore e si dilata
       sulle schede;
     · il TIRO: ogni scheda (.nx-pannello--tap, .cine-card, .ch-card,
       .deity-card, .gl-vetrata, .admin-card, .tacca, [data-tiro]) al passaggio
       tira un d20 iniettato (.tiro) — 20 = critico, 1 = fumble; al CLICK
       (anche touch) prima tira, poi il click prosegue (apre/naviga);
     · la SCIA: fiamme o schegge di gelo seguono mouse e dito e illuminano
       la pelle sotto di sé.
   Il colore lo detta html[data-soffio] (Fuoco/Gelo) o body.covo-admin
   (Arcano): letto dai token --el-rgb. Pausa a tab nascosta, niente
   particelle con prefers-reduced-motion. Sulle pagine di gioco
   (body.theme-dark) il layer è spento: hanno i propri FX. */

const prefersReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const TIRO_SEL = ".nx-pannello--tap, .cine-card, .ch-card, .deity-card, .gl-vetrata:not(.gl-vetrata--band), .admin-card, .tacca, .porta, [data-tiro]";
const DILATA_SEL = TIRO_SEL + ", .nesso-orbe, .gl-cta, .cta, .cine-btn, .ch-btn";

function elRgb() {
  const v = getComputedStyle(document.body).getPropertyValue("--el-rgb").trim();
  const p = v.split(",").map(Number);
  return p.length === 3 && p.every((n) => !Number.isNaN(n)) ? p : [255, 122, 26];
}

export default function CovoOverlay() {
  const pelleRef = useRef(null);
  const soffioRef = useRef(null);
  const acceso = () => !document.body.classList.contains("theme-dark") || document.body.classList.contains("covo-arena");
  const [enabled, setEnabled] = useState(acceso);
  const [reduced, setReduced] = useState(prefersReduced);

  // segue body.theme-dark (App lo aggiorna al cambio rotta)
  useEffect(() => {
    const update = () => setEnabled(acceso());
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

  /* ── la pelle e il soffio ── */
  useEffect(() => {
    if (!enabled) return;
    const pelle = pelleRef.current, soff = soffioRef.current;
    if (!pelle || !soff) return;
    const pc = pelle.getContext("2d"), sc = soff.getContext("2d");
    let W = 0, H = 0, dpr = 1, squame = [], fase = 0, raf = 0, running = true;
    const mouse = { x: -9999, y: -9999, vivo: false };
    const particelle = [];
    const scia = []; // la SCIA: fiamme (Fuoco) o schegge di ghiaccio (Gelo) che seguono mouse e dito
    let ultimo = { x: -9999, y: -9999 };
    const nasceScia = (x, y, vx, vy) => {
      const gelo = soffio() === "gelo";
      return { x: x + (Math.random() - .5) * 6, y: y + (Math.random() - .5) * 6, vx: vx * .15 + (Math.random() - .5) * .6, vy: (gelo ? .6 : -1.2) + vy * .15 + (Math.random() - .5) * .5, r: 2 + Math.random() * (gelo ? 3 : 5), vita: 1, rot: Math.random() * Math.PI, spin: (Math.random() - .5) * .08 };
    };
    const tocca = (x, y) => {
      const dx = x - ultimo.x, dy = y - ultimo.y;
      const vel = ultimo.x < -1000 ? 0 : Math.min(40, Math.hypot(dx, dy));
      mouse.x = x; mouse.y = y; mouse.vivo = true;
      if (!reduced) { const n = 1 + Math.floor(vel / 6); for (let i = 0; i < n && scia.length < 160; i++) scia.push(nasceScia(x - dx * (i / n), y - dy * (i / n), dx, dy)); }
      ultimo = { x, y };
    };
    let rgb = elRgb();
    const soffio = () => document.documentElement.dataset.soffio || "fuoco";

    const dipingiPelle = () => {
      const [R, G, B] = rgb;
      pc.setTransform(dpr, 0, 0, dpr, 0, 0);
      pc.clearRect(0, 0, W, H);
      pc.fillStyle = "#0b0a0d"; pc.fillRect(0, 0, W, H);
      for (const q of squame) {
        const r = 26 * q.s;
        const g = pc.createRadialGradient(q.x, q.y - r * .4, 2, q.x, q.y, r);
        g.addColorStop(0, "#1e1b23"); g.addColorStop(.7, "#121016"); g.addColorStop(1, "#0b0a0d");
        pc.fillStyle = g;
        pc.beginPath(); pc.arc(q.x, q.y, r, 0, Math.PI * 2); pc.fill();
        pc.strokeStyle = `rgba(${R},${G},${B},.08)`; pc.lineWidth = 1;
        pc.beginPath(); pc.arc(q.x, q.y, r - .5, Math.PI * 1.15, Math.PI * 1.85, false); pc.stroke();
      }
    };
    const misura = () => {
      W = window.innerWidth; H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      pelle.width = soff.width = Math.round(W * dpr);
      pelle.height = soff.height = Math.round(H * dpr);
      sc.setTransform(dpr, 0, 0, dpr, 0, 0);
      squame = [];
      const r = 26, dy = r * .78;
      for (let row = -1, y = 0; y < H + r; row++, y += dy)
        for (let x = (row % 2 ? 0 : r); x < W + r; x += r * 2) squame.push({ x, y, s: .9 + Math.random() * .2 });
      dipingiPelle();
    };
    const nasce = () => {
      const fuoco = soffio() !== "gelo";
      return { x: Math.random() * W, y: fuoco ? H + 10 : -10, vx: (Math.random() - .5) * .35, vy: fuoco ? -(.4 + Math.random() * .9) : (.25 + Math.random() * .6), r: fuoco ? 1 + Math.random() * 2.2 : 1.2 + Math.random() * 2.6, vita: 1, rot: Math.random() * Math.PI, spin: (Math.random() - .5) * .03 };
    };
    const frame = () => {
      if (!running) return;
      fase += .012;
      sc.clearRect(0, 0, W, H);
      const [R, G, B] = rgb;
      const alone = sc.createRadialGradient(W * .5, H * .25, 0, W * .5, H * .25, Math.max(W, H) * .55);
      const a = .05 + .03 * Math.sin(fase);
      alone.addColorStop(0, `rgba(${R},${G},${B},${a.toFixed(3)})`); alone.addColorStop(1, "rgba(0,0,0,0)");
      sc.fillStyle = alone; sc.fillRect(0, 0, W, H);
      if (mouse.x > -100) {
        /* la luce sotto il dito/mouse: illumina la pelle */
        const luce = sc.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 220);
        luce.addColorStop(0, `rgba(${R},${G},${B},${mouse.vivo ? .28 : .12})`); luce.addColorStop(.5, `rgba(${R},${G},${B},.06)`); luce.addColorStop(1, "rgba(0,0,0,0)");
        sc.fillStyle = luce; sc.beginPath(); sc.arc(mouse.x, mouse.y, 220, 0, Math.PI * 2); sc.fill();
        for (const q of squame) {
          const d = Math.hypot(q.x - mouse.x, q.y - mouse.y);
          if (d < 180) {
            const k = 1 - d / 180;
            sc.strokeStyle = `rgba(${R},${G},${B},${(.75 * k).toFixed(3)})`; sc.lineWidth = 1.4;
            sc.beginPath(); sc.arc(q.x, q.y, 26 * q.s - 1, Math.PI * 1.1, Math.PI * 1.9); sc.stroke();
          }
        }
      }
      /* la scia */
      if (scia.length) {
        const gelo = soffio() === "gelo";
        for (let i = scia.length - 1; i >= 0; i--) {
          const f = scia[i];
          f.x += f.vx + Math.sin(fase * 6 + f.y * .05) * .4; f.y += f.vy; f.vy -= gelo ? -.01 : .04; f.vita -= .028; f.rot += f.spin;
          if (f.vita <= 0) { scia.splice(i, 1); continue; }
          sc.globalAlpha = Math.max(0, f.vita);
          if (!gelo) {
            const g = sc.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (1 + (1 - f.vita)));
            g.addColorStop(0, `rgba(255,240,200,${(.9 * f.vita).toFixed(2)})`); g.addColorStop(.35, `rgba(${R},${G},${B},.85)`); g.addColorStop(1, "rgba(0,0,0,0)");
            sc.fillStyle = g; sc.beginPath(); sc.arc(f.x, f.y, f.r * (1 + (1 - f.vita)), 0, Math.PI * 2); sc.fill();
          } else {
            sc.strokeStyle = `rgba(${R},${G},${B},.95)`; sc.lineWidth = 1.2; sc.shadowColor = `rgb(${R},${G},${B})`; sc.shadowBlur = 8;
            sc.save(); sc.translate(f.x, f.y); sc.rotate(f.rot);
            for (let k = 0; k < 3; k++) { sc.beginPath(); sc.moveTo(-f.r * 1.6, 0); sc.lineTo(f.r * 1.6, 0); sc.stroke(); sc.rotate(Math.PI / 3); }
            sc.restore(); sc.shadowBlur = 0;
          }
          sc.globalAlpha = 1;
        }
      }
      if (!reduced) {
        const max = W < 600 ? 40 : 90;
        if (particelle.length < max && Math.random() < .5) particelle.push(nasce());
        const gelo = soffio() === "gelo";
        for (let i = particelle.length - 1; i >= 0; i--) {
          const p = particelle[i];
          p.x += p.vx + Math.sin(fase * 3 + p.y * .01) * .25; p.y += p.vy; p.vita -= .0035; p.rot += p.spin;
          if (p.vita <= 0 || p.y < -20 || p.y > H + 20) { particelle.splice(i, 1); continue; }
          sc.globalAlpha = Math.min(1, p.vita * 1.4);
          if (!gelo) {
            sc.fillStyle = `rgba(${R},${G},${B},1)`; sc.shadowColor = `rgb(${R},${G},${B})`; sc.shadowBlur = 8;
            sc.beginPath(); sc.arc(p.x, p.y, p.r, 0, Math.PI * 2); sc.fill();
          } else {
            sc.strokeStyle = `rgba(${R},${G},${B},.9)`; sc.lineWidth = 1; sc.shadowColor = `rgb(${R},${G},${B})`; sc.shadowBlur = 6;
            sc.save(); sc.translate(p.x, p.y); sc.rotate(p.rot);
            for (let k = 0; k < 3; k++) { sc.beginPath(); sc.moveTo(-p.r * 2, 0); sc.lineTo(p.r * 2, 0); sc.stroke(); sc.rotate(Math.PI / 3); }
            sc.restore();
          }
          sc.shadowBlur = 0; sc.globalAlpha = 1;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    const onMove = (e) => tocca(e.clientX, e.clientY);
    const onTouch = (e) => { const t = e.touches[0]; if (t) tocca(t.clientX, t.clientY); };
    let spegni = 0;
    const onTouchEnd = () => { mouse.vivo = false; ultimo = { x: -9999, y: -9999 }; clearTimeout(spegni); spegni = setTimeout(() => { mouse.x = -9999; mouse.y = -9999; }, 1200); };
    const onVisibility = () => { running = !document.hidden; if (running) raf = requestAnimationFrame(frame); else cancelAnimationFrame(raf); };
    // cambio respiro (Fuoco/Gelo/Arcano): rileggi il colore, svuota le particelle, ridipingi
    const ricolora = () => { rgb = elRgb(); particelle.length = 0; dipingiPelle(); };
    const moHtml = new MutationObserver(ricolora);
    moHtml.observe(document.documentElement, { attributes: true, attributeFilter: ["data-soffio"] });
    const moBody = new MutationObserver(ricolora);
    moBody.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    misura();
    window.addEventListener("resize", misura);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);
    return () => {
      running = false; cancelAnimationFrame(raf); clearTimeout(spegni);
      window.removeEventListener("resize", misura);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      document.removeEventListener("visibilitychange", onVisibility);
      moHtml.disconnect(); moBody.disconnect();
    };
  }, [enabled, reduced]);

  /* ── i gesti del covo: iride che segue, schede che tirano ── */
  useEffect(() => {
    const canHover = window.matchMedia("(hover: hover)").matches;
    // iride
    const onMove = (e) => {
      const iridi = document.querySelectorAll(".gl-finestra-img, .covo-iride");
      if (!iridi.length) return;
      for (const ir of iridi) {
        const occhio = ir.parentElement;
        const r = occhio.getBoundingClientRect();
        if (r.width === 0) continue;
        const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
        const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
        ir.style.transform = `translate(calc(-50% + ${(dx * 70).toFixed(1)}px), calc(-50% + ${(dy * 26).toFixed(1)}px))`;
      }
    };
    const setDil = (on) => {
      document.querySelectorAll(".gl-finestra-velo, .pupilla").forEach((p) => {
        if (on) p.style.setProperty("--dil", p.classList.contains("pupilla") ? "34%" : "18%");
        else p.style.removeProperty("--dil");
      });
    };
    // il tiro
    const rolling = new WeakSet();
    const tira = (card, poi) => {
      if (rolling.has(card)) { if (poi) setTimeout(poi, 650); return; }
      rolling.add(card);
      let dado = card.querySelector(":scope > .tiro");
      let esito = card.querySelector(":scope > .esito");
      if (!dado) {
        dado = document.createElement("span");
        dado.className = "tiro";
        dado.setAttribute("aria-hidden", "true");
        dado.innerHTML = '<svg viewBox="0 0 100 100"><path d="M50 4 92 28v44L50 96 8 72V28z"/></svg><b>–</b>';
        card.appendChild(dado);
        esito = document.createElement("span");
        esito.className = "esito";
        esito.setAttribute("aria-hidden", "true");
        card.appendChild(esito);
      }
      const n = dado.querySelector("b");
      card.classList.remove("covo-crit", "covo-fumble");
      dado.className = "tiro rotola";
      let t = 0;
      const iv = setInterval(() => {
        n.textContent = 1 + Math.floor(Math.random() * 20);
        if (++t > 9) {
          clearInterval(iv);
          const v = 1 + Math.floor(Math.random() * 20);
          n.textContent = v;
          rolling.delete(card);
          if (v === 20) { dado.classList.add("crit"); card.classList.add("covo-crit"); esito.textContent = "critico!"; }
          else if (v === 1) { dado.classList.add("fumble"); card.classList.add("covo-fumble"); esito.textContent = "fumble"; }
          else { dado.classList.add("ok"); esito.textContent = ""; }
          if (poi) setTimeout(poi, 140);
        }
      }, 50);
    };
    /* CLICK: su una scheda (o su un link/bottone dentro di essa) prima si tira il
       dado, POI il click prosegue (rilanciato sullo stesso bersaglio, stessi
       modificatori). Campi di input e click già rilanciati passano subito. */
    const SALTA = "input, select, textarea, label, [contenteditable], .tiro, .esito";
    const onClickCapture = (e) => {
      if (!e.isTrusted) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest(SALTA)) return;
      const card = t.closest(TIRO_SEL);
      if (!card) return;
      e.preventDefault(); e.stopPropagation();
      const init = { bubbles: true, cancelable: true, composed: true, view: window, detail: e.detail, button: e.button, buttons: e.buttons,
        clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey };
      tira(card, () => { if (t.isConnected) t.dispatchEvent(new MouseEvent("click", init)); });
    };
    document.addEventListener("click", onClickCapture, true);
    const onOver = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const card = t.closest(TIRO_SEL);
      if (card && !card.contains(e.relatedTarget)) tira(card);
      if (t.closest(DILATA_SEL)) setDil(true);
    };
    const onOut = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const el = t.closest(DILATA_SEL);
      if (el && !el.contains(e.relatedTarget)) setDil(false);
    };
    if (canHover) {
      window.addEventListener("mousemove", onMove, { passive: true });
      document.addEventListener("mouseover", onOver);
      document.addEventListener("mouseout", onOut);
    }
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  if (!enabled) return null;
  return (
    <div className="covo-fx" aria-hidden="true">
      <canvas ref={pelleRef} className="covo-pelle" />
      <canvas ref={soffioRef} className="covo-soffio" />
      <div className="covo-velo" />
    </div>
  );
}
