// Runtime canonico per l'HTML delle sessioni generate (Generatore Sessioni DM).
//
// L'HTML prodotto dal modello può arrivare troncato dal cap di max_tokens e
// perdere il blocco <script> finale del template: i widget (tab/step,
// collassabili, timer) restano visibili ma morti. Qui gli script della
// sessione vengono RIMOSSI e sostituiti da un runtime iniettato dall'app,
// così l'interattività funziona sempre — anche sulle sessioni già salvate.
//
// Il runtime copre il contratto dei widget del template di riferimento
// (reference_sessions/sessione_20.html): .tab-btn[data-tab] / .tab-content,
// .collapsible-header, .timer-widget con .timer-display[data-duration] e
// .timer-btn[data-action].

const RUNTIME_SCRIPT = `
<script>
(function () {
  function init() {
    // ── Tab / step ───────────────────────────────────────────────────────
    var tabBtns = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
    var isLive = function (btn) {
      var t = btn.getAttribute('data-tab');
      return !!(t && document.getElementById(t));
    };
    tabBtns.forEach(function (btn) {
      // Tab senza pannello (HTML troncato dalla generazione): disattivato e
      // segnalato, così si vede che manca la sezione — non che "non funziona".
      if (!isLive(btn)) {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
        btn.title = 'Sezione mancante: la generazione si è interrotta prima di scriverla.';
        return;
      }
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-tab');
        if (!target) return;
        document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
        document.querySelectorAll('.tab-btn[data-tab="' + target + '"]').forEach(function (b) { b.classList.add('active'); });
        var pane = document.getElementById(target);
        if (pane) pane.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    // Se nessun pannello è attivo (HTML troncato prima dello stato iniziale),
    // attiva il primo tab che ha davvero un pannello.
    if (tabBtns.length && !document.querySelector('.tab-content.active')) {
      var firstLive = tabBtns.filter(isLive)[0];
      if (firstLive) {
        firstLive.classList.add('active');
        document.getElementById(firstLive.getAttribute('data-tab')).classList.add('active');
      }
    }
    console.log('[session-runtime] attivo — tab: ' + tabBtns.length +
      ', pannelli presenti: ' + tabBtns.filter(isLive).length);
    // Segnale verso la pagina ospite (diagnosi: l'iframe è sandboxed e il suo
    // console non è leggibile da fuori).
    try {
      parent.postMessage({
        type: 'session-runtime-ready',
        tabs: tabBtns.length,
        panes: tabBtns.filter(isLive).length,
      }, '*');
    } catch (e) { /* noop */ }

    // ── Collassabili ─────────────────────────────────────────────────────
    document.querySelectorAll('.collapsible-header').forEach(function (header) {
      header.addEventListener('click', function () {
        if (header.parentElement) header.parentElement.classList.toggle('open');
      });
    });

    // ── Timer per atto ───────────────────────────────────────────────────
    document.querySelectorAll('.timer-widget').forEach(function (widget) {
      var display = widget.querySelector('.timer-display');
      if (!display) return;
      var duration = parseInt(display.getAttribute('data-duration'), 10);
      if (!isFinite(duration) || duration <= 0) duration = 2700;
      var remaining = duration;
      var interval = null;
      var baseColor = display.style.color || '';
      function format(s) {
        var m = Math.floor(s / 60), sec = s % 60;
        return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
      }
      function update() {
        display.textContent = format(Math.max(remaining, 0));
        if (remaining <= 60) display.style.color = '#f5d77a';
        if (remaining <= 30) display.style.color = '#b8434a';
        if (remaining <= 0) { clearInterval(interval); interval = null; }
      }
      display.textContent = format(remaining);
      widget.querySelectorAll('.timer-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var action = btn.getAttribute('data-action');
          if (action === 'start' && !interval) {
            interval = setInterval(function () { remaining--; update(); }, 1000);
          } else if (action === 'pause') {
            clearInterval(interval); interval = null;
          } else if (action === 'reset') {
            clearInterval(interval); interval = null;
            remaining = duration;
            display.style.color = baseColor;
            display.textContent = format(remaining);
          }
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</` + `script>`;

// Controllo di completezza di una sessione generata: ogni bottone tab
// (data-tab) deve avere il suo pannello (id corrispondente) e il documento
// deve chiudersi. Usato per avvisare PRIMA di salvare un HTML troncato.
export function sessionCompleteness(html) {
  const h = String(html || "");
  const ids = new Set([...h.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
  const tabs = [...new Set([...h.matchAll(/\bdata-tab=["']([^"']+)["']/g)].map((m) => m[1]))];
  const panes = tabs.filter((t) => ids.has(t));
  return {
    tabs: tabs.length,
    panes: panes.length,
    complete: tabs.length > 0 && panes.length === tabs.length && /<\/html>/i.test(h),
  };
}

// Prepara l'HTML della sessione per l'iframe: via gli script originali
// (completi O troncati a fine file), dentro il runtime dell'app.
export function withSessionRuntime(html) {
  let h = String(html || "");
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  h = h.replace(/<script\b[\s\S]*$/i, ""); // script troncato senza chiusura
  // HTML troncato a metà tag o commento (es. "<!", "<div cl"): il parser lo
  // tratterebbe come bogus comment / attribute soup e INGOIEREBBE il tag
  // <script> del runtime, che non verrebbe mai eseguito. Via il frammento.
  h = h.replace(/<[^>]*$/, "");
  return h + RUNTIME_SCRIPT;
}
