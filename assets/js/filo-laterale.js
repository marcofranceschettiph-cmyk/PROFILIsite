/* ---------- PRO-FILI: il filo sul bordo sinistro ----------
   Il filo della matassa non sparisce: esce dal fondo del palco, entra da sinistra e scende
   lungo il bordo sinistro per tutto il sito mentre la pagina scorre (il capo, tondo, sta
   poco sotto la meta' dello schermo). A ogni cucitura il filo si dirama: un ramo si stacca,
   piega verso destra e attraversa la pagina dividendo le sezioni; l'altro continua a scendere
   lungo il bordo fino in fondo al sito.
   Tutto e' disegnato con la lana vera (assets/img/matassa/lana.webp, una striscia di filo
   dritto che si ripete senza giunture) stesa a fettine lungo i percorsi. I canvas stanno
   dentro la pagina (uno strato alto quanto il documento), non fissi sullo schermo: cosi'
   scorrono insieme al contenuto e non tremano mentre si scorre. Il filo verticale e'
   prestampato a tegole, ogni ramo su un suo canvas; durante lo scroll si ridisegnano solo
   i pezzi che il capo sta scoprendo.
   Con prefers-reduced-motion il filo e' gia' tutto steso. */
(function () {
  'use strict';
  var cuciture = Array.prototype.slice.call(document.querySelectorAll('.cucitura'));
  if (!document.createElement('canvas').getContext) return;
  var ridotto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PIENO = 19;            // righe della striscia occupate dal filo (sotto c'e' la sua ombra)
  var TEGOLA = 600;          // altezza (px CSS) delle tegole del filo verticale
  var lana = new Image();

  var strato = document.createElement('div');
  strato.className = 'filo-strato';
  strato.setAttribute('aria-hidden', 'true');
  document.body.appendChild(strato);

  // numeri casuali ripetibili: ogni ramo ha sempre la sua onda
  function caso(seme) { return function () { seme = (seme * 16807) % 2147483647; return (seme - 1) / 2147483646; }; }

  var G = null;              // geometria corrente (si rifa' quando cambia la pagina)
  var attesa = false;

  function misure() {
    var vw = document.documentElement.clientWidth, dpr = Math.min(2, window.devicePixelRatio || 1);
    var stretto = vw < 640;
    return {
      vw: vw, vh: window.innerHeight, dpr: dpr,
      spesso: stretto ? 9 : 12,               // spessore del filo (px CSS)
      xr: stretto ? 8 : 24,                   // dove corre il filo verticale
      // l'altezza del contenuto (non scrollHeight: lo strato del filo, alto quanto la pagina, la falserebbe)
      fine: document.body.getBoundingClientRect().height - 6
    };
  }

  // x del filo verticale alla quota y del documento: un'onda lenta, non un righello
  function xBordo(m, y) { return m.xr + 2.2 * Math.sin(y / 170) + 1.3 * Math.sin(y / 61 + 1.7); }

  function bez(p0, p1, p2, p3, u) {
    var a = (1 - u) * (1 - u) * (1 - u), b = 3 * (1 - u) * (1 - u) * u, c = 3 * (1 - u) * u * u, d = u * u * u;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  }
  // punti a passo ~1 px lungo una sequenza di tratti
  function ricampiona(pts) {
    var out = [pts[0]], acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var a = out[out.length - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      acc += d;
      if (acc >= 1) { out.push(b); acc = 0; }
    }
    return out;
  }

  // stende la lana lungo i punti (coordinate gia' nel canvas, px CSS * dpr): u e' la colonna della striscia
  function stendi(c, pts, m, u0, scala) {
    var spesso = m.spesso * m.dpr, kr = spesso / PIENO, passo = 1 / (2 * kr);
    var L = lana.naturalWidth, Hs = lana.naturalHeight, u = u0 || 0;
    for (var i = 1; i < pts.length; i++) {
      var px = pts[i - 1][0] * scala, py = pts[i - 1][1] * scala, nx = pts[i][0] * scala, ny = pts[i][1] * scala;
      var d = Math.hypot(nx - px, ny - py);
      if (!d) continue;
      var co = (nx - px) / d, si = (ny - py) / d;
      c.setTransform(co, si, -si, co, px, py);
      var v = u % L;
      c.drawImage(lana, Math.min(L - passo * d, v), 0, passo * d, Hs, -0.3, -Hs * kr / 2, d + 0.6, Hs * kr);
      u += passo * d;
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    return u;
  }

  function costruisci() {
    var m = misure();
    var sy = window.scrollY || window.pageYOffset;
    // da dove parte il filo verticale: dal fondo della matassa, entrando da sinistra; altrimenti dall'alto
    var palco = document.getElementById('matassa'), y0, entrata;
    if (palco) {
      var bp = palco.getBoundingClientRect();
      y0 = bp.bottom + sy - 40;
      entrata = [];
      for (var k = 0; k <= 60; k++) entrata.push(bez([-30, y0 - 70], [m.xr * 0.6, y0 - 60], [xBordo(m, y0 + 70), y0 + 10], [xBordo(m, y0 + 90), y0 + 90], k / 60));
      y0 += 90;
    } else {
      y0 = 0; entrata = [[xBordo(m, -10), -10]];
    }
    var bordo = entrata.slice();
    for (var y = Math.ceil(y0); y <= m.fine; y++) bordo.push([xBordo(m, y), y]);
    bordo = ricampiona(bordo);
    // per ogni punto: quota e colonna di lana (cosi' le tegole combaciano)
    var spesso = m.spesso * m.dpr, passo = 1 / (2 * spesso / PIENO);
    var uB = [0];
    for (var i = 1; i < bordo.length; i++) uB.push(uB[i - 1] + passo * m.dpr * Math.hypot(bordo[i][0] - bordo[i - 1][0], bordo[i][1] - bordo[i - 1][1]));

    // i rami: uno per cucitura, dal filo verticale verso destra
    var rami = cuciture.map(function (el, i) {
      var b = el.getBoundingClientRect();
      var yc = (el.classList.contains('cucitura--dentro') ? b.top + b.height / 2 : b.top) + sy;
      var r = caso(7919 * (i + 3));
      var A = 9 + r() * 10, lam = (0.5 + r() * 0.5) * Math.max(m.vw, 700), fase = r() * Math.PI * 2, pend = (r() - 0.5) * 20;
      function yw(x) { return yc + A * Math.sin(2 * Math.PI * x / lam + fase) + pend * (x / m.vw - 0.5); }
      var F = m.vw < 640 ? 70 : 95;                       // il ramo si stacca un po' piu' su
      var xj = m.xr + (m.vw < 640 ? 70 : 120);              // e si unisce all'onda qui
      var p0 = [xBordo(m, yc - F), yc - F];
      var dy = (yw(xj + 1) - yw(xj - 1)) / 2, n = Math.hypot(1, dy);
      var q = [xj, yw(xj)], t = [1 / n, dy / n];
      var pts = [];
      for (var k = 0; k <= 80; k++) pts.push(bez(p0, [p0[0], p0[1] + (q[1] - p0[1]) * 0.55], [q[0] - t[0] * (xj - m.xr) * 0.45, q[1] - t[1] * (xj - m.xr) * 0.45], q, k / 80));
      for (var x = xj + 1; x <= m.vw + 30; x++) pts.push([x, yw(x)]);
      pts = ricampiona(pts);
      var top = Math.min(p0[1], yc - A - 30) - m.spesso, bot = yc + A + Math.abs(pend) + 30;
      return { pts: pts, top: top, h: bot - top, yf: p0[1], c: null };
    });
    strato.innerHTML = '';
    strato.style.height = Math.ceil(m.fine + 6) + 'px';
    var top = strato.getBoundingClientRect().top + sy;        // lo strato parte dall'alto del documento
    G = { m: m, bordo: bordo, uB: uB, y0: bordo[0][1], tegole: {}, rami: rami, chiave: '', top: top };
  }

  // la tegola k del filo verticale (sorgente prestampata): le quote da k*TEGOLA a (k+1)*TEGOLA
  function sorgenteTegola(k) {
    var m = G.m, X0 = -40, Wt = m.xr + 50;
    var t = document.createElement('canvas');
    t.width = Math.ceil(Wt * m.dpr); t.height = Math.ceil(TEGOLA * m.dpr);
    var c = t.getContext('2d'), a = k * TEGOLA - 20, b = (k + 1) * TEGOLA + 20, pts = [], u0 = null;
    for (var i = 0; i < G.bordo.length; i++) {
      var p = G.bordo[i];
      if (p[1] < a || p[1] > b) continue;
      if (u0 === null) u0 = G.uB[i];
      pts.push([p[0] - X0, p[1] - k * TEGOLA]);
    }
    if (pts.length > 1) stendi(c, pts, m, u0, m.dpr);
    t.X0 = X0; t.Wt = Wt;
    return t;
  }
  // il canvas visibile di una tegola, dentro lo strato della pagina
  function tegola(k) {
    var t = G.tegole[k];
    if (t) return t;
    var src = sorgenteTegola(k), m = G.m;
    var v = document.createElement('canvas');
    v.className = 'filo-tegola';
    v.width = src.width; v.height = src.height;
    v.style.cssText = 'left:' + src.X0 + 'px;top:' + (k * TEGOLA - G.top) + 'px;width:' + src.Wt + 'px;height:' + TEGOLA + 'px';
    strato.appendChild(v);
    t = G.tegole[k] = { src: src, v: v, fino: -1 };
    return t;
  }
  function ramo(r) {
    if (r.v) return r;
    var m = G.m, c = document.createElement('canvas');
    c.width = Math.ceil((m.vw + 40) * m.dpr); c.height = Math.ceil(r.h * m.dpr);
    var pts = r.pts.map(function (p) { return [p[0], p[1] - r.top]; });
    stendi(c.getContext('2d'), pts, m, 37, m.dpr);
    var v = document.createElement('canvas');
    v.className = 'filo-ramo';
    v.width = c.width; v.height = c.height;
    v.style.cssText = 'left:0;top:' + (r.top - G.top) + 'px;width:' + (m.vw + 40) + 'px;height:' + r.h + 'px';
    strato.appendChild(v);
    r.c = c; r.v = v; r.p = -1;
    return r;
  }
  // y del ramo all'ascissa x (i punti avanzano sempre verso destra)
  function yRamo(r, x) {
    var p = r.pts, lo = 0, hi = p.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (p[mid][0] < x) lo = mid; else hi = mid; }
    return p[hi][1];
  }

  function disegna() {
    attesa = false;
    if (!G || !lana.naturalWidth) return;
    var m = G.m, dpr = m.dpr;
    var sy = window.scrollY || window.pageYOffset;
    // il capo del filo, in quote del documento: poco sotto la meta' dello schermo; nell'ultimo
    // schermo scende fino a toccare il fondo del sito
    var maxS = Math.max(1, m.fine + 6 - m.vh), coda = Math.min(1, Math.max(0, (sy - (maxS - m.vh)) / m.vh));
    var capo = ridotto ? Infinity : sy + m.vh * (0.62 + 0.38 * coda * coda) + coda * 10;
    capo = Math.round(capo * 2) / 2;
    var R = m.spesso / 2 + 1;

    // i rami: si srotolano verso destra quando il capo passa dal punto in cui si staccano;
    // si ridisegnano solo se l'avanzamento e' cambiato
    G.rami.forEach(function (r) {
      if (r.top > sy + 2 * m.vh || r.top + r.h < sy - m.vh) return;
      var p = ridotto ? 1 : Math.min(1, Math.max(0, (capo - r.yf) / (m.vh * 0.45)));
      p = Math.round(p * 1000) / 1000;
      ramo(r);
      if (p === r.p) return;
      r.p = p;
      var c = r.v.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, r.v.width, r.v.height);
      if (p <= 0) return;
      if (p >= 1) { c.drawImage(r.c, 0, 0); return; }
      var x0 = r.pts[0][0], xc = x0 + p * (m.vw + 30 - x0);
      c.save();
      c.beginPath();
      c.rect(0, 0, xc * dpr, r.h * dpr);
      var yc = (yRamo(r, xc) - r.top) * dpr;
      c.moveTo((xc + R) * dpr, yc);
      c.arc(xc * dpr, yc, R * dpr, 0, Math.PI * 2);
      c.clip();
      c.drawImage(r.c, 0, 0);
      c.restore();
    });

    // il filo verticale, fino al capo (tondo): ogni tegola si ridisegna solo se il capo ci passa
    var a = Math.max(G.y0 - 100, sy - m.vh), b = Math.min(sy + 2 * m.vh, m.fine);
    for (var k = Math.max(0, Math.floor(a / TEGOLA)); k * TEGOLA <= b; k++) {
      var t = tegola(k), y0 = k * TEGOLA, y1 = y0 + TEGOLA;
      var fino = Math.max(y0, Math.min(y1 + R + 2, capo));      // fin dove e' scoperta
      if (fino === t.fino) continue;
      t.fino = fino;
      var c = t.v.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, t.v.width, t.v.height);
      if (capo <= y0 - R) continue;
      c.save();
      c.beginPath();
      c.rect(0, 0, t.v.width, (Math.min(capo, y1) - y0) * dpr);
      if (capo < y1 + R && capo > G.y0) {
        var xc = xBordo(m, capo) - t.src.X0;
        c.moveTo((xc + R) * dpr, (capo - y0) * dpr);
        c.arc(xc * dpr, (capo - y0) * dpr, R * dpr, 0, Math.PI * 2);
      }
      c.clip();
      c.drawImage(t.src, 0, 0);
      c.restore();
    }
    // via le tegole lontane (memoria)
    Object.keys(G.tegole).forEach(function (j) {
      if (j * TEGOLA > sy + 4 * m.vh || (+j + 1) * TEGOLA < sy - 3 * m.vh) { strato.removeChild(G.tegole[j].v); delete G.tegole[j]; }
    });
  }
  function chiedi() { if (!attesa) { attesa = true; requestAnimationFrame(disegna); } }

  // la pagina cambia altezza mentre arrivano immagini e caratteri: si rifa' la geometria
  function rifai() {
    var m = misure(), chiave = m.vw + 'x' + m.fine + 'x' + m.dpr;
    if (G && G.chiave === chiave) return;
    costruisci(); G.chiave = chiave; chiedi();
  }
  lana.onload = function () {
    rifai();
    window.addEventListener('scroll', chiedi, { passive: true });
    window.addEventListener('resize', function () { rifai(); chiedi(); });
    window.addEventListener('load', rifai);
    if ('ResizeObserver' in window) new ResizeObserver(function () { rifai(); }).observe(document.body);
  };
  var qui = (document.currentScript && document.currentScript.src) || '';
  lana.src = qui ? qui.replace(/js\/filo-laterale\.js.*$/, 'img/matassa/lana.webp') : 'assets/img/matassa/lana.webp';
})();
