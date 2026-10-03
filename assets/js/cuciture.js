/* ---------- PRO-FILI: le cuciture ----------
   Fra una sezione e l'altra (e fra artisti, ospiti e organizzatori) lo stesso filo di
   lana della matassa attraversa la pagina da un bordo all'altro dello schermo, una volta
   da sinistra a destra e la volta dopo da destra a sinistra: si srotola mentre la
   cucitura sale nello schermo. La prima parte da sinistra, dove esce il filo della matassa.
   Il filo e' disegnato su un canvas con la lana vera della foto (assets/img/matassa/lana.webp:
   una striscia di filo dritto, lungo il filo in orizzontale, 2 righe per pixel di
   traverso), stesa a fettine lungo un'onda diversa per ogni cucitura.
   Con prefers-reduced-motion il filo e' gia' tutto. */
(function () {
  'use strict';
  var cuciture = Array.prototype.slice.call(document.querySelectorAll('.cucitura'));
  if (!cuciture.length || !document.createElement('canvas').getContext) return;
  var ridotto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ALTO = 100;         // altezza del canvas (px CSS): il filo ondeggia qui dentro
  var PIENO = 30;         // righe della striscia occupate dal filo
  var GIUNTA = 24, MARGINE = 3;   // le tegole della striscia si sfumano l'una nell'altra
  var lana = new Image();

  // numeri casuali ripetibili: ogni cucitura ha sempre la sua onda
  function caso(seme) { return function () { seme = (seme * 16807) % 2147483647; return (seme - 1) / 2147483646; }; }

  var stato = cuciture.map(function (el, i) {
    var c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    el.appendChild(c);
    var r = caso(7919 * (i + 3));
    return {
      el: el, c: c, larga: 0, vicino: false,
      verso: i % 2 ? 'sx' : 'dx',              // dx: entra da sinistra e va a destra
      ampiezza: 11 + r() * 12, onda: 0.5 + r() * 0.5, fase: r() * Math.PI * 2,
      pendenza: (r() - 0.5) * 24
    };
  });

  function stendi(s) {
    var w = s.el.clientWidth;
    if (!w || !lana.naturalWidth) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    s.larga = w;
    s.c.width = Math.round(w * dpr); s.c.height = Math.round(ALTO * dpr);
    var ctx = s.c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s.c.width, s.c.height);
    var spesso = (w < 640 ? 10 : 13) * dpr;            // spessore del filo sullo schermo
    var kr = spesso / PIENO;                          // una riga della striscia, in px
    var passo = 1 / (2 * kr);                         // colonne della striscia per px di filo
    var L = lana.naturalWidth, Hs = lana.naturalHeight, P = L - GIUNTA - 2 * MARGINE;
    var lambda = s.onda * Math.max(w, 700) * dpr, A = s.ampiezza * dpr, mezzo = ALTO * dpr / 2;
    function y(x) { return mezzo + A * Math.sin(2 * Math.PI * x / lambda + s.fase) + s.pendenza * dpr * (x / (w * dpr) - 0.5); }
    var x = -30 * dpr, fine = (w + 30) * dpr, u = 0, px = x, py = y(x);
    while (x < fine) {
      // un passo di 1 px lungo il filo
      var dx = 1, nx, ny, d;
      for (var k = 0; k < 3; k++) { nx = px + dx; ny = y(nx); d = Math.hypot(nx - px, ny - py); dx /= d; }
      nx = px + dx; ny = y(nx);
      var ang = Math.atan2(ny - py, nx - px), co = Math.cos(ang), si = Math.sin(ang);
      ctx.setTransform(co, si, -si, co, px, py);
      var t = Math.floor(u / P), v = u - t * P + MARGINE;
      if (t > 0 && v - MARGINE < GIUNTA) {
        ctx.globalAlpha = 1;
        ctx.drawImage(lana, Math.min(L - 1, v + P), 0, passo, Hs, -0.2, -Hs * kr / 2, 1.6, Hs * kr);
        ctx.globalAlpha = (v - MARGINE) / GIUNTA;
      } else ctx.globalAlpha = 1;
      ctx.drawImage(lana, Math.min(L - 1, v), 0, passo, Hs, -0.2, -Hs * kr / 2, 1.6, Hs * kr);
      u += passo; px = nx; py = ny; x = nx;
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function svela(s) {
    var p = 1;
    if (!ridotto) {
      var b = s.el.getBoundingClientRect(), vh = window.innerHeight;
      p = Math.min(1, Math.max(0, (vh * 0.95 - b.top) / (vh * 0.55)));
    }
    var resto = ((1 - p) * 100).toFixed(2) + '%';
    var clip = s.verso === 'dx' ? 'inset(0 ' + resto + ' 0 0)' : 'inset(0 0 0 ' + resto + ')';
    if (s.clip !== clip) { s.clip = clip; s.c.style.clipPath = s.c.style.webkitClipPath = clip; }
  }

  var attesa = false;
  function aggiorna() {
    attesa = false;
    stato.forEach(function (s) {
      if (!s.vicino) return;
      if (s.larga !== s.el.clientWidth) stendi(s);
      svela(s);
    });
  }
  function chiedi() { if (!attesa) { attesa = true; requestAnimationFrame(aggiorna); } }

  lana.onload = function () {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (voci) {
        voci.forEach(function (v) {
          var s = stato[cuciture.indexOf(v.target)];
          s.vicino = v.isIntersecting;
        });
        chiedi();
      }, { rootMargin: '100% 0px 100% 0px' });
      stato.forEach(function (s) { io.observe(s.el); });
    } else stato.forEach(function (s) { s.vicino = true; });
    window.addEventListener('scroll', chiedi, { passive: true });
    window.addEventListener('resize', chiedi);
    chiedi();
  };
  lana.src = 'assets/img/matassa/lana.webp';
})();
