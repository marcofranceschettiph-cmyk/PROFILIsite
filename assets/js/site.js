/* IANUA — script condiviso (nessuna dipendenza esterna)
   1. nav: solid / on-paper / si nasconde scendendo / menu mobile
   2. reveal al viewport (.rv, titoli a riga, immagini con "sipario", numeri che contano)
   3. hero "portale": scrub dei frame su canvas, con overlay guidati dal progresso
   4. manifesto: parole che si accendono con lo scroll
   5. spettacoli: carte a tutto schermo che si impilano, foto che si rivelano
   6. parallasse leggera (.cover img, [data-parallax])
   7. filo di matassa (.thread): si disegna con lo scroll, un capo scorre lungo il percorso
   9. form contatti
*/
(function () {
  'use strict';
  var html = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) html.classList.add('motion');
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var range = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var raf = [];            // funzioni chiamate ad ogni scroll/resize (rAF)
  var ticking = false;
  function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; raf.forEach(function (f) { f(); }); }); } }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  addEventListener('load', schedule);
  // I font arrivano da Google e possono finire dopo il load: il testo si reimpagina,
  // quindi parallasse e posizioni vanno ricalcolate anche a quel punto.
  if (document.fonts) document.fonts.addEventListener('loadingdone', schedule);

  /* ---------- 1. NAV ---------- */
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  var lastY = scrollY;
  if (nav) {
    raf.push(function () {
      var y = scrollY;
      var hold = html.classList.contains('portal-hold');
      if (hold) { nav.classList.remove('solid', 'hide'); }
      else {
        nav.classList.toggle('solid', y > 24);
        // si nasconde scendendo, riappare risalendo
        if (!document.body.classList.contains('menu-open')) nav.classList.toggle('hide', y > lastY + 4 && y > 240);
        if (y < lastY - 4 || y < 240) nav.classList.remove('hide');
      }
      lastY = y;
      // mondo sotto la barra: primo elemento (non nav/menu) al centro della barra
      var els = document.elementsFromPoint ? document.elementsFromPoint(innerWidth / 2, 30) : [];
      var world = 'dark';
      for (var k = 0; k < els.length; k++) {
        var el = els[k];
        if (nav.contains(el) || (menu && menu.contains(el))) continue;
        var w = el.closest ? el.closest('[data-world]') : null;
        if (w) { world = w.getAttribute('data-world'); break; }
      }
      nav.classList.toggle('on-paper', world === 'paper' && !document.body.classList.contains('menu-open'));
    });
  }
  if (burger && menu) {
    var setMenu = function (open) {
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', open);
      menu.setAttribute('aria-hidden', !open);
      if (open) { nav.classList.remove('on-paper', 'hide'); menu.querySelector('a').focus(); } else { burger.focus(); }
      schedule();
    };
    burger.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false); });
  }

  /* ---------- 2. REVEAL ---------- */
  // titoli: la riga sale da sotto una maschera
  document.querySelectorAll('.head h2, .page-hero h1, .contact h2, .cta-band h2, .fest-top h2, .article h2.sec, .bio h2').forEach(function (h) {
    if (h.closest('[data-words]')) return;
    var inner = document.createElement('span'); inner.className = 'ln-i';
    while (h.firstChild) inner.appendChild(h.firstChild);
    var outer = document.createElement('span'); outer.className = 'ln'; outer.appendChild(inner);
    h.appendChild(outer); h.classList.add('rv-ln');
  });
  // immagini: sipario dal basso + leggero zoom di assestamento
  document.querySelectorAll('.gallery > img').forEach(function (im) { var d = document.createElement('div'); d.className = 'rvimg'; im.parentNode.insertBefore(d, im); d.appendChild(im); });
  document.querySelectorAll('.person .ph, .bio .ph, .artist-ph, .sc-media figure, .gallery .wide').forEach(function (el) { el.classList.add('rvimg'); });
  var rv = document.querySelectorAll('.rv, .rv-ln, .rvimg, .facts');
  function countUp(el) {
    el.querySelectorAll('b').forEach(function (b) {
      var n = parseInt(b.textContent, 10); if (isNaN(n) || n > 999 || String(n) !== b.textContent.trim()) return;
      var t0 = performance.now(), dur = 1400;
      (function step(t) { var q = easeOut(clamp((t - t0) / dur, 0, 1)); b.textContent = Math.round(n * q); if (q < 1) requestAnimationFrame(step); })(t0);
    });
  }
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); if (en.target.classList.contains('facts')) countUp(en.target); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  } else { rv.forEach(function (el) { el.classList.add('in'); }); }

  // Dissolvenza: un contenitore [data-unfold] si rivela con una maschera a gradiente
  // che scende dall'alto al basso, in un movimento unico, quando il blocco entra in
  // vista. Il contenitore viene mascherato (.unfold-ready) solo qui, cosi' senza
  // script si legge tutto; .unfold-in fa partire la discesa. Le singole voci
  // (.unfold-item) non si animano una per una: la continuita' e' nel gradiente.
  // Finita la dissolvenza si toglie la maschera (un elemento mascherato in permanenza
  // perde l'antialiasing del testo su Safari) e si manda un resize: il filo rimisura
  // i suoi ancoraggi. Non conta la struttura: il contenitore puo' essere un ol, un div
  // o altro, e le voci sono tutti i discendenti con .unfold-item.
  (function () {
    var boxes = document.querySelectorAll('[data-unfold]'); if (!boxes.length) return;
    var DURATA = 1500; // 1320ms di dissolvenza (CSS) piu' un margine
    function voci(box) { return box.querySelectorAll('.unfold-item'); }
    function apri(box) {
      box.classList.add('unfold-in');
      setTimeout(function () {
        box.classList.remove('unfold-in'); box.classList.remove('unfold-ready');
        dispatchEvent(new Event('resize'));
      }, DURATA);
    }
    if (reduce || !('IntersectionObserver' in window)) { return; }
    var uo = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { uo.unobserve(en.target); apri(en.target); } });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    boxes.forEach(function (b) {
      // se in quel contenitore non c'e' nessuna voce da dispiegare non lo si nasconde:
      // meglio niente animazione che contenuto invisibile
      if (!voci(b).length) return;
      b.classList.add('unfold-ready'); uo.observe(b);
      // Rete di sicurezza: se l'osservatore non consegna mai (scheda aperta in
      // sottofondo, pagina mai messa in primo piano, browser che sospende le
      // notifiche) le voci resterebbero invisibili. Dopo 4 secondi si aprono
      // comunque, senza dissolvenza: meglio nessuna animazione che testo assente.
      // Il conto avanza solo mentre il contenitore e' davvero a schermo: un
      // contenitore ancora lontano sotto la piega non e' un guasto, e aprirlo in
      // anticipo brucia la dissolvenza prima che qualcuno possa vederla.
      var atteso = 0;
      var rete = setInterval(function () {
        var its = voci(b);
        if (!its.length || b.classList.contains('unfold-in')) { clearInterval(rete); return; }
        var r = b.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        atteso += 250; if (atteso < 4000) return;
        clearInterval(rete); uo.unobserve(b);
        b.classList.remove('unfold-ready');
        dispatchEvent(new Event('resize'));
      }, 250);
    });
  })();

  /* ---------- 3. HERO PORTALE ---------- */
  var portal = document.getElementById('portal');
  if (portal) {
    var COUNT = parseInt(portal.getAttribute('data-frames'), 10) || 128;
    // Ultimo fotogramma usato: dopo il 108 la luce si ritira e compare la foschia.
    var LAST = Math.min((parseInt(portal.getAttribute('data-last-frame'), 10) || COUNT) - 1, COUNT - 1);
    var FOCUS_X = parseFloat(portal.getAttribute('data-focus-x')) || 0.5; // dove sta la porta nel frame (0–1): viene portata al centro
    var SM = innerWidth <= 820;                       // telefono: fotogrammi piccoli, e uno ogni due
    var dir = 'assets/frames/' + (SM ? 'sm' : 'lg') + '/';
    var canvas = document.getElementById('portalCanvas'), ctx = canvas.getContext('2d', { alpha: false });
    var poster = document.getElementById('portalPoster');
    var title = document.getElementById('pTitle'), mid = document.getElementById('pMid'), flash = document.getElementById('pFlash'),
        end = document.getElementById('pEnd'), veil = document.getElementById('pVeil'), hint = document.getElementById('pHint'),
        bar = document.getElementById('pLoad'), stage = portal.querySelector('.stage'), glare = document.getElementById('pGlare'),
        skipBtn = document.getElementById('pSkip');
    var imgs = new Array(COUNT), loadedCount = 0, cur = -1, dpr = Math.min(devicePixelRatio || 1, 2);
    var target = 0, smooth = 0, animating = false;
    if (poster) poster.style.objectPosition = (FOCUS_X * 100) + '% 50%';

    var order = [], seen = {};
    // Su telefono si salta l'ultima passata: restano gli indici pari, cioe' un fotogramma
    // ogni due (f_001, f_003 ... f_125) invece di tutti e 128. Dove il fotogramma esatto
    // manca, nearest() mostra il piu' vicino gia' pronto, quindi lo scorrimento non salta.
    (SM ? [16, 8, 4, 2] : [16, 8, 4, 2, 1]).forEach(function (step) { for (var i = 0; i < COUNT; i += step) { if (!seen[i]) { seen[i] = 1; order.push(i); } } });
    // L'ultimo fotogramma e' quello su cui resta la chiusura: dev'esserci sempre. Prende il
    // posto del penultimo campionato, cosi' sul telefono i file scaricati restano 64.
    if (!seen[LAST]) {
      var sub = order.indexOf(LAST - 1);
      if (sub >= 0) order.splice(sub, 1);
      seen[LAST] = 1; order.push(LAST);
    }
    var CONC = 6, next = 0;
    function loadNext() {
      if (next >= order.length) return;
      var i = order[next++]; var im = new Image();
      im.onload = im.onerror = function () { loadedCount++; if (bar) { bar.style.transform = 'scaleX(' + (loadedCount / order.length) + ')'; if (loadedCount >= order.length) bar.classList.add('done'); } if (i === 0) { drawFrame(0); } else if (i === nearest(frameIndex(smooth))) { drawFrame(i); } loadNext(); };
      im.src = dir + 'f_' + String(i + 1).padStart(3, '0') + '.webp'; imgs[i] = im;
    }
    for (var c = 0; c < CONC; c++) loadNext();

    function ready(i) { var im = imgs[i]; return im && im.complete && im.naturalWidth > 0; }
    function nearest(i) {
      if (ready(i)) return i;
      for (var d = 1; d < COUNT; d++) { if (i - d >= 0 && ready(i - d)) return i - d; if (i + d < COUNT && ready(i + d)) return i + d; }
      return -1;
    }
    function size() { canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr); cur = -1; drawFrame(nearest(frameIndex(smooth))); }
    function drawFrame(i) {
      if (i < 0 || !ready(i)) return;
      var im = imgs[i], W = canvas.width, H = canvas.height, r = Math.max(W / im.naturalWidth, H / im.naturalHeight);
      var w = im.naturalWidth * r, h = im.naturalHeight * r;
      // cover-fit con punto focale: la porta (FOCUS_X) finisce al centro dello schermo, senza scoprire i bordi
      var x = clamp(W / 2 - FOCUS_X * w, W - w, 0);
      ctx.drawImage(im, x, (H - h) / 2, w, h); cur = i;
      if (poster && !poster.classList.contains('gone')) poster.classList.add('gone');
    }
    // La porta finisce presto; il resto dello scorrimento è la sosta sulla frase di chiusura.
    var VIDEO_END = 0.60;
    function frameIndex(p) { return Math.round(range(p, 0, VIDEO_END) * LAST); }
    function progress() {
      var rect = portal.getBoundingClientRect(), total = portal.offsetHeight - innerHeight;
      return total > 0 ? clamp(-rect.top / total, 0, 1) : 1;
    }
    function apply(p) {
      var i = nearest(frameIndex(p)); if (i !== cur) drawFrame(i);
      var t = 1 - range(p, 0, 0.12);
      title.style.opacity = t; title.style.transform = 'translateY(' + (-(1 - t) * 40) + 'px) scale(' + (1 - (1 - t) * 0.06) + ')';
      if (hint) hint.style.opacity = t;
      // La frase centrale vive nella fase buia, prima che la luce dilaghi: altrimenti
      // avorio su bianco non si legge.
      var m = Math.min(range(p, 0.14, 0.22), 1 - range(p, 0.30, 0.38));
      mid.style.opacity = m; mid.style.transform = 'translateY(' + ((1 - m) * 18) + 'px)';
      // il chiarore nasce dalla fessura molto prima del lampo, e si allarga: copre la
      // cascata del video e prepara il fondo su cui compare il logo di chiusura
      if (glare) {
        var gl = Math.min(range(p, 0.30, 0.52), 1 - range(p, 0.66, 0.80));
        glare.style.opacity = gl * 0.9;
        var sc = 1 + range(p, 0.30, 0.66) * 5.5;
        glare.style.transform = 'scale(' + sc.toFixed(2) + ')';
      }
      var f = range(p, 0.50, 0.66);
      flash.style.opacity = f; if (veil) veil.style.opacity = 1 - f;
      // Entra presto e poi resta ferma fino in fondo: c'è tempo per leggerla.
      var e = range(p, 0.64, 0.74);
      end.style.opacity = e; end.style.transform = 'translateY(' + ((1 - e) * 22) + 'px) scale(' + (0.96 + e * 0.04) + ')';
      stage.setAttribute('data-world', p > 0.62 ? 'paper' : 'dark');
      // Finché il logo di chiusura non è comparso, la barra in alto resta trasparente
      // e non si nasconde: altrimenti lampeggia a ogni micro-movimento dello scroll.
      var hold = p < 0.74;
      if (hold !== html.classList.contains('portal-hold')) html.classList.toggle('portal-hold', hold);
      if (hold && nav) nav.classList.remove('solid', 'hide');
      if (skipBtn) {
        var sk = (1 - range(p, 0.46, 0.62)) * 0.7;
        skipBtn.style.opacity = sk;
        skipBtn.style.pointerEvents = sk < 0.05 ? 'none' : 'auto';
        skipBtn.setAttribute('tabindex', sk < 0.05 ? '-1' : '0');
        skipBtn.setAttribute('aria-hidden', sk < 0.05 ? 'true' : 'false');
      }
    }
    function tick() {
      smooth = lerp(smooth, target, 0.16);
      if (Math.abs(smooth - target) < 0.0008) { smooth = target; animating = false; } else { requestAnimationFrame(tick); }
      apply(smooth);
    }
    if (reduce) {
      var im0 = new Image(); im0.onload = function () { imgs[COUNT - 1] = im0; target = smooth = 1; apply(1); }; im0.src = dir + 'f_' + String(COUNT).padStart(3, '0') + '.webp';
      size();
    } else {
      raf.push(function () { target = progress(); if (!animating) { animating = true; requestAnimationFrame(tick); } });
      addEventListener('resize', size); size(); schedule();
    }
    if (skipBtn) skipBtn.addEventListener('click', function (e) { e.preventDefault(); var to = document.querySelector(skipBtn.getAttribute('href')); if (to) to.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); });
  }

  /* ---------- 3b. PULVISCOLO DORATO ---------- */
  // Le scintille escono dalla fessura della porta e vengono verso chi guarda: ognuna ha
  // una profondità z che cala, così si ingrandisce e si accende avvicinandosi. È disegnato
  // qui e non nel video perché così la densità, il colore e la direzione sono nostri.
  (function () {
    var cv = document.getElementById('portalMotes');
    var portal = document.getElementById('portal');
    if (!cv || !portal || reduce) return;
    var ctx = cv.getContext('2d');
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var FOCUS = parseFloat(portal.getAttribute('data-focus-x')) || 0.5;
    var N = 300, motes = [], W = 0, H = 0, vis = 0;

    function fit() {
      W = cv.width = Math.round(innerWidth * dpr);
      H = cv.height = Math.round(innerHeight * dpr);
    }
    fit(); addEventListener('resize', fit);

    function nasci(m, primo) {
      // partono dalla fessura verticale al centro della porta
      // fessura stretta e distribuzione addensata verso il centro: la somma di due
      // numeri a caso dà una campana, quindi più granelli in mezzo che ai bordi
      m.x = 0.5 + ((Math.random() + Math.random()) / 2 - 0.5) * 0.030;
      m.y = 0.5 + ((Math.random() + Math.random()) / 2 - 0.5) * 0.78;
      m.z = primo ? 0.15 + Math.random() * 0.85 : 1;
      m.vz = 0.0016 + Math.random() * 0.0042;
      m.vx = (Math.random() - 0.5) * 0.0016;
      m.vy = (Math.random() - 0.5) * 0.0011 - 0.0004;
      m.r = 0.30 + Math.random() * 0.62;
      m.fase = Math.random() * 6.28;
      m.lampo = 0.5 + Math.random() * 2.2;   // velocità dello scintillio
    }
    for (var i = 0; i < N; i++) { motes.push({}); nasci(motes[i], true); }

    // Il disegno gira solo mentre le scintille si vedono: fuori dalla fase buia il ciclo
    // si ferma (prima continuava a ogni fotogramma per tutta la visita, pagina ferma compresa).
    var t = 0, running = false;
    function draw() {
      if (vis <= 0.01) { ctx.clearRect(0, 0, W, H); running = false; return; }
      requestAnimationFrame(draw);
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < N; i++) {
        var m = motes[i];
        m.z -= m.vz; m.x += m.vx / (m.z + .2); m.y += m.vy / (m.z + .2);
        if (m.z <= 0.05) { nasci(m, false); continue; }
        // prospettiva: più è vicina, più si allarga dal centro e cresce
        var k = Math.min(1 / (m.z + 0.34), 2.6);
        var px = (0.5 + (m.x - 0.5) * k * 0.9) * W;
        var py = (0.5 + (m.y - 0.5) * k * 0.9) * H;
        if (px < -60 || px > W + 60 || py < -60 || py > H + 60) continue;
        var scint = 0.55 + 0.45 * Math.sin(t * m.lampo + m.fase);
        var a = vis * scint * Math.min(1, (1 - m.z) * 1.6) * (m.z > 0.9 ? (1 - m.z) * 10 : 1);
        if (a <= 0.01) continue;
        var rr = m.r * k * dpr;
        // nucleo piccolo e nitido, alone stretto: una scintilla, non una pallina
        var g = ctx.createRadialGradient(px, py, 0, px, py, rr * 3);
        g.addColorStop(0, 'rgba(255,247,226,' + a.toFixed(3) + ')');
        g.addColorStop(0.22, 'rgba(240,205,140,' + (a * 0.55).toFixed(3) + ')');
        g.addColorStop(0.55, 'rgba(210,170,96,' + (a * 0.16).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(201,164,92,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, rr * 3, 0, 6.2832); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // Il pulviscolo vive solo mentre la fessura è aperta e il buio c'è ancora:
    // compare quando la lama di luce nasce, sparisce quando dilaga il bianco.
    raf.push(function () {
      var r = portal.getBoundingClientRect(), tot = portal.offsetHeight - innerHeight;
      var p = tot > 0 ? clamp(-r.top / tot, 0, 1) : 1;
      vis = Math.min(range(p, 0.005, 0.06), 1 - range(p, 0.46, 0.60));
      if (vis > 0.01 && !running) { running = true; requestAnimationFrame(draw); }
    });
  })();

  /* ---------- 4. MANIFESTO: parole ---------- */
  document.querySelectorAll('[data-words]').forEach(function (el) {
    var words = [];
    function wrap(node) {
      if (node.nodeType === 3) {
        var frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var s = document.createElement('span'); s.className = 'w'; s.textContent = part;
          if (node.parentNode && node.parentNode.tagName === 'EM') s.classList.add('acc');
          words.push(s); frag.appendChild(s);
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === 1) { Array.prototype.slice.call(node.childNodes).forEach(wrap); }
    }
    Array.prototype.slice.call(el.childNodes).forEach(wrap);
    if (reduce) { words.forEach(function (w) { w.classList.add('on'); }); return; }
    raf.push(function () {
      var r = el.getBoundingClientRect();
      var p = range(-(r.top - innerHeight * 0.78), 0, r.height + innerHeight * 0.30);
      var n = Math.round(p * words.length);
      words.forEach(function (w, k) { w.classList.toggle('on', k < n); });
    });
  });

  /* ---------- 5. SPETTACOLI: carte impilate ---------- */
  // Le carte si impilano anche su mobile. I nodi di ogni carta si cercano una volta sola,
  // non a ogni fotogramma di scroll.
  var cards = Array.prototype.map.call(document.querySelectorAll('.show-card'), function (card) {
    var figs = Array.prototype.slice.call(card.querySelectorAll('.sc-media figure'));
    return {
      el: card, inner: card.querySelector('.card'), figs: figs,
      imgs: figs.map(function (f) { return f.querySelector('img'); }),
      texts: Array.prototype.slice.call(card.querySelectorAll('.sc-text > *'))
    };
  });
  if (cards.length && !reduce) {
    raf.push(function () {
      var ih = innerHeight;
      // Prima si misurano tutte le carte, poi si scrive: alternare letture e scritture
      // costringe il browser a ricalcolare il layout a ogni carta.
      var tops = cards.map(function (c) { return c.el.getBoundingClientRect().top; });
      cards.forEach(function (c, k) {
        // ingresso: da quando il bordo alto entra dal basso a quando si aggancia in alto
        var enter = easeOut(range((ih - tops[k]) / ih, 0, 1));
        // parallasse interna alle foto mentre la carta è agganciata
        var par = clamp(-tops[k] / ih, -1, 1);
        c.figs.forEach(function (f, j) {
          var q = range(enter, 0.05 + j * 0.16, 0.6 + j * 0.16);
          f.style.setProperty('--reveal', q);
          if (c.imgs[j]) c.imgs[j].style.transform = 'translateY(' + (par * (4 + j * 3)) + '%) scale(' + (1 + (1 - q) * 0.12) + ')';
        });
        c.texts.forEach(function (t, j) {
          var q = range(enter, 0.25 + j * 0.06, 0.7 + j * 0.06);
          t.style.opacity = q; t.style.transform = 'translateY(' + ((1 - q) * 22) + 'px)';
        });
        // uscita: la carta seguente la copre; questa si ritrae e si spegne
        if (k + 1 < cards.length) {
          var cover = range((ih - tops[k + 1]) / ih, 0, 1);
          c.inner.style.transform = 'scale(' + (1 - cover * 0.06) + ') translateY(' + (-cover * 6) + 'vh)';
          c.inner.style.filter = 'brightness(' + (1 - cover * 0.55) + ')';
          c.inner.style.opacity = 1 - cover * 0.25;
        } else { c.inner.style.transform = ''; c.inner.style.filter = ''; c.inner.style.opacity = ''; }
      });
    });
  } else if (cards.length) {
    cards.forEach(function (c) { c.figs.forEach(function (f) { f.style.setProperty('--reveal', 1); }); });
  }

  /* ---------- 6. PARALLASSE ---------- */
  if (!reduce) {
    var pl = document.querySelectorAll('[data-parallax]');
    raf.push(function () {
      pl.forEach(function (im) {
        var r = im.getBoundingClientRect();
        var p = clamp((r.top + r.height / 2 - innerHeight / 2) / (innerHeight / 2 + r.height / 2), -1, 1);
        im.style.transform = 'translateY(' + (-p * 8) + '%)';
      });
    });
  }

  /* ---------- 7. FILO DI MATASSA ---------- */
  // Un filo passa per tutti gli ancoraggi (.thread [data-knot]) facendo un'asola tra uno e l'altro,
  // come il filo che esce da una matassa. Si disegna con lo scroll; un capo (pallino) scorre sul percorso.
  function catmull(pts) { // spline Catmull-Rom → path cubico
    if (pts.length < 2) return '';
    var d = 'M ' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ' C ' + c1[0].toFixed(1) + ' ' + c1[1].toFixed(1) + ', ' + c2[0].toFixed(1) + ' ' + c2[1].toFixed(1) + ', ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }
  // Numero stabile e ripetibile a partire da un indice: serve perché il filo non
  // cambi forma a ogni ridisegno, restando però diverso tratto per tratto.
  function rnd(n) { var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }

  // Il tratto fra due nodi. Quasi sempre un meandro morbido con ampiezza, numero di
  // ventri e lato sempre diversi; ogni tanto, dove c'è spazio, una vera asola larga.
  // Niente inversioni strette: sono quelle che producono spigoli.
  function weave(a, b, i, tight) {
    var out = [];
    var dx = b[0] - a[0], dy = b[1] - a[1], D = Math.hypot(dx, dy) || 1;
    var ux = dx / D, uy = dy / D, nx = -uy, ny = ux;
    function P(t, o) { return [a[0] + ux * D * t + nx * o, a[1] + uy * D * t + ny * o]; }
    var r1 = rnd(i * 3 + 1), r2 = rnd(i * 3 + 2), r3 = rnd(i * 3 + 3);
    var A = clamp(D * (tight ? 0.10 + r1 * 0.09 : 0.15 + r1 * 0.15), tight ? 10 : 24, tight ? 24 : 96);
    var s = r2 < 0.5 ? 1 : -1;
    if (!tight && D > 240 && r3 > 0.60) {
      out.push(P(0.26, s * A * 0.30), P(0.38, s * A * 1.35), P(0.55, s * A * 1.50),
               P(0.67, s * A * 0.40), P(0.58, -s * A * 0.42), P(0.45, -s * A * 0.26));
    } else {
      var n = 2 + Math.round(r3);              // due o tre ventri
      var ph = 0.10 + r2 * 0.16;               // sfasamento: mai la stessa onda
      for (var k = 1; k <= n; k++) {
        var t = (k - 0.5 + ph) / n;
        var soft = 1 - Math.abs(t - 0.5) * 0.6;   // più ampio in mezzo, spento agli estremi
        out.push(P(t, s * A * soft * (k % 2 ? 1 : -0.58)));
      }
    }
    return out;
  }

  // Il filo dei ritratti in home (data-giri). Non passa mai sui volti: dentro le foto resta
  // nella fascia bassa (sotto il 66% dell'altezza) e cambia riga scendendo nei margini
  // laterali, fuori da visi e testi, come un filo che va avanti e indietro. In ogni foto fa
  // una o due giravolte (cicloidi allungate, la cui curva più stretta è circa metà del raggio
  // del giro). I raccordi sono curve con le tangenti allineate e alla fine il tracciato viene
  // ricampionato a passo costante: così la spline che lo disegna non crea mai punte.
  function giri(th, knots) {
    var box = th.getBoundingClientRect();
    var ph = Array.prototype.map.call(knots, function (k, i) {
      var r = k.getBoundingClientRect();
      return { i: i, l: r.left - box.left, t: r.top - box.top, w: r.width, h: r.height };
    });
    var rows = [];
    ph.slice().sort(function (a, b) { return a.t - b.t || a.l - b.l; }).forEach(function (p) {
      var last = rows[rows.length - 1];
      if (last && Math.abs(last[0].t - p.t) < 12) last.push(p); else rows.push([p]);
    });
    var vw = document.documentElement.clientWidth;
    var laneL = -clamp(box.left * 0.5, 8, 28), laneR = box.width + clamp((vw - box.right) * 0.5, 8, 28);
    var poly = [], anchors = new Array(ph.length);
    function bez(p0, p1, p2, p3) {
      var n = Math.max(6, Math.ceil(Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) / 8));
      for (var j = 1; j <= n; j++) {
        var t = j / n, m = 1 - t;
        poly.push([m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
                   m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]]);
      }
    }
    function loops(p, d) {
      // le asole stanno nella fascia bassa della foto: 0.74 tiene fuori anche i ritratti
      // di profilo degli artisti esterni, che hanno il mento più in basso dei nostri
      var top = p.t + p.h * 0.74, bot = p.t + p.h - 6, R = Math.min((bot - top) / 2, 46);
      var n = p.i % 2 === 0 && p.w >= Math.max(R * 4.6, 220) ? 2 : 1;   // foto strette: un solo giro, più largo
      var s = p.i % 2 ? -1 : 1, out = [];              // una foto il giro sopra la linea, la seguente sotto
      for (var q = 0; q < n; q++) {
        var r = Math.min(R, p.w / (n + 1) * 0.46) * (0.92 + rnd(p.i * 7 + q * 3 + 1) * 0.08);
        var a = r * (r >= 42 ? 0.32 : r >= 34 ? 0.26 : r >= 30 ? 0.18 : 0.08);   // giri piccoli: avanzano meno, così la curva non si stringe (sotto 30 px: telefoni stretti a due colonne)
        var cx = p.l + p.w * (d > 0 ? (q + 1) / (n + 1) : (n - q) / (n + 1)) + (rnd(p.i * 11 + q) - 0.5) * p.w * 0.05;
        var cy = clamp((top + bot) / 2, top + r, bot - r);
        out.push({ cx: cx, cy: cy, r: r, a: a, s: s, d: d,
                   start: [cx - d * a * Math.PI, cy + s * r], end: [cx + d * a * Math.PI, cy + s * r] });
      }
      return out;
    }
    var prevEnd = null, prevDir = 0;
    rows.forEach(function (row, k) {
      var d = k % 2 ? -1 : 1;
      if (d < 0) row.reverse();
      row.forEach(function (p) {
        loops(p, d).forEach(function (L, q) {
          var S = L.start;
          if (!prevEnd) {
            var x0 = d > 0 ? laneL - 30 : laneR + 30, k0 = Math.abs(S[0] - x0) * 0.45;
            poly.push([x0, S[1]]);
            bez([x0, S[1]], [x0 + d * k0, S[1]], [S[0] - d * k0, S[1]], S);
          } else if (prevDir === d) {
            var kx = Math.abs(S[0] - prevEnd[0]) * 0.45;
            bez(prevEnd, [prevEnd[0] + d * kx, prevEnd[1]], [S[0] - d * kx, S[1]], S);
          } else {
            // cambio di riga: curva larga verso il margine, discesa diritta, curva larga verso la foto
            var lane = prevDir > 0 ? laneR : laneL, E = prevEnd, dy = S[1] - E[1];
            var c1 = Math.min(Math.abs(lane - E[0]), dy * 0.4), c2 = Math.min(Math.abs(lane - S[0]), dy * 0.4);
            var A = [lane, E[1] + c1], B = [lane, S[1] - c2];
            bez(E, [E[0] + prevDir * Math.abs(lane - E[0]) * 0.55, E[1]], [lane, A[1] - c1 * 0.55], A);
            bez(A, [lane, A[1] + (B[1] - A[1]) / 3], [lane, B[1] - (B[1] - A[1]) / 3], B);
            bez(B, [lane, B[1] + c2 * 0.55], [S[0] - d * Math.abs(lane - S[0]) * 0.55, S[1]], S);
          }
          for (var st = 1; st <= 48; st++) {
            var u = -Math.PI + st * Math.PI / 24;
            poly.push([L.cx + L.d * (L.a * u - L.r * Math.sin(u)), L.cy - L.s * L.r * Math.cos(u)]);
          }
          if (q === 0) anchors[p.i] = [L.cx, L.cy - L.s * L.r];
          prevEnd = L.end; prevDir = d;
        });
      });
    });
    var xe = prevDir > 0 ? laneR + 30 : laneL - 30, ke = Math.abs(xe - prevEnd[0]) * 0.45;
    bez(prevEnd, [prevEnd[0] + prevDir * ke, prevEnd[1]], [xe - prevDir * ke, prevEnd[1]], [xe, prevEnd[1]]);
    // ricampionamento a passo costante
    var pts = [poly[0]], STEP = 9, carry = 0;
    for (var i = 1; i < poly.length; i++) {
      var ax = poly[i - 1][0], ay = poly[i - 1][1], bx = poly[i][0], by = poly[i][1];
      var seg = Math.hypot(bx - ax, by - ay); if (!seg) continue;
      var pos = STEP - carry;
      while (pos <= seg) { pts.push([ax + (bx - ax) * pos / seg, ay + (by - ay) * pos / seg]); pos += STEP; }
      carry = seg - (pos - STEP);
    }
    pts.push(poly[poly.length - 1]);
    return { pts: pts, anchors: anchors };
  }

  document.querySelectorAll('.thread').forEach(function (th) {
    var svg = th.querySelector('svg'); if (!svg) return;
    var ghost = svg.querySelector('.ghost'), path = svg.querySelector('.line'), bead = svg.querySelector('.bead'), flow = svg.querySelector('.flow');
    // Senza il tracciato .line non c'è filo da disegnare: prima qui lo script si fermava
    // con un errore e il resto della pagina restava senza JavaScript.
    if (!path) return;
    var knots = th.querySelectorAll('[data-knot]'); if (!knots.length) return;
    var tight = th.hasAttribute('data-loop-tight'), aGiri = th.hasAttribute('data-giri');
    var L = 0, knotLen = [];
    function build() {
      var box = th.getBoundingClientRect(); var pts = [], anchors;
      if (aGiri) { var g = giri(th, knots); pts = g.pts; anchors = g.anchors; }
      else {
      anchors = Array.prototype.map.call(knots, function (k) {
        var r = k.getBoundingClientRect(); var side = (k.getAttribute('data-knot') || 'center');
        var x = r.left - box.left + (side === 'left' ? 12 : side === 'right' ? r.width - 12 : r.width / 2);
        var y = r.top - box.top + (side === 'bottom' ? r.height - 10 : side === 'top' ? 10
              : side === 'low' ? r.height * 0.78 : r.height / 2);
        return [x, y];
      });
      var vertical = anchors.length > 1 && Math.abs(anchors[1][1] - anchors[0][1]) > Math.abs(anchors[1][0] - anchors[0][0]);
      // inizio: entra da fuori
      var lead = tight ? 26 : 60;
      pts.push(vertical ? [anchors[0][0] - lead, -40] : [-lead, anchors[0][1] + 30]);
      anchors.forEach(function (a, i) {
        pts.push(a);
        var b = anchors[i + 1];
        if (b) weave(a, b, i, tight).forEach(function (q) { pts.push(q); });
      });
      var last = anchors[anchors.length - 1];
      pts.push(vertical ? [last[0] + (tight ? 20 : 40), box.height + 40] : [box.width + lead, last[1] - 30]);
      }
      svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      var d = catmull(pts); path.setAttribute('d', d); if (ghost) ghost.setAttribute('d', d); if (flow) flow.setAttribute('d', d);
      L = path.getTotalLength(); path.style.strokeDasharray = L + ' ' + L; path.style.strokeDashoffset = reduce ? 0 : L;
      // Dove cade ogni ancoraggio lungo il filo: serve per far correre il capo
      // fin lì quando il mouse (o il focus da tastiera) tocca quella persona o quella data.
      var samples = [], N = 300;
      for (var si = 0; si <= N; si++) { var st = L * si / N, sp = path.getPointAtLength(st); samples.push([sp.x, sp.y, st]); }
      knotLen = anchors.map(function (a) {
        var best = 0, bd = Infinity;
        for (var i = 0; i < samples.length; i++) {
          var dx = samples[i][0] - a[0], dy = samples[i][1] - a[1], d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = samples[i][2]; }
        }
        return best;
      });
      if (bead && reduce) { var pe = path.getPointAtLength(L); bead.setAttribute('cx', pe.x); bead.setAttribute('cy', pe.y); }
    }
    build(); addEventListener('resize', build); addEventListener('load', build);
    // stesso motivo: a font arrivati il testo cambia altezza e gli ancoraggi si spostano
    if (document.fonts) document.fonts.addEventListener('loadingdone', build);

    // Il filo è interattivo: passando sopra un artista o una data (col mouse o col
    // Tab), il capo del filo ci corre e la riga si accende. Uscendo, torna allo scroll.
    var items = Array.prototype.map.call(knots, function (k) {
      return (k.closest && k.closest('.ev, .person, .day')) || k;
    });
    var active = -1, kick = function () {};
    items.forEach(function (it, i) {
      if (!it) return;
      function on() { active = i; th.classList.add('is-lit'); it.classList.add('is-lit'); kick(); }
      function off() { if (active === i) { active = -1; th.classList.remove('is-lit'); } it.classList.remove('is-lit'); kick(); }
      it.addEventListener('pointerenter', on);
      it.addEventListener('pointerleave', off);
      it.addEventListener('focusin', on);
      it.addEventListener('focusout', off);
    });

    if (reduce) return;
    var drawn = 0, beadAt = 0, spinning = false;
    function frame() {
      var r = th.getBoundingClientRect();
      var p = range(-(r.top - innerHeight * 0.85), 0, r.height + innerHeight * 0.35);
      drawn = lerp(drawn, p, 0.25);
      var lit = active >= 0 && knotLen.length > active && L > 0;
      var shown = lit ? Math.max(drawn, knotLen[active] / L) : drawn;
      path.style.strokeDashoffset = L * (1 - shown);
      var target = lit ? knotLen[active] : L * drawn;
      beadAt = lerp(beadAt, target, lit ? 0.18 : 0.34);
      if (bead) {
        var pt = path.getPointAtLength(clamp(beadAt, 0, L));
        bead.setAttribute('cx', pt.x); bead.setAttribute('cy', pt.y);
        bead.setAttribute('r', lit ? 6.5 : 4);
        bead.style.opacity = (lit || (shown > 0.01 && shown < 0.995)) ? 1 : 0;
      }
    }
    raf.push(frame);
    // Lo scroll fa girare il motore un fotogramma alla volta; il passaggio del mouse
    // no, quindi qui ne apriamo uno nostro finché il capo del filo non è arrivato.
    function spin() {
      frame();
      if (active >= 0 || Math.abs(beadAt - L * drawn) > 0.5) requestAnimationFrame(spin);
      else spinning = false;
    }
    kick = function () { if (!spinning) { spinning = true; requestAnimationFrame(spin); } };
  });

  /* ---------- 7b. AGENDA: calendario, conto alla rovescia, filtri ---------- */
  var IANUA = { mail: 'ianuaeventi@gmail.com', tel: '+39 346 031 5409', ig: 'https://instagram.com/___ianua___',
                sito: 'https://collettivoianua.it/' };

  function icsFold(line) {           // lo standard vuole righe non piu' lunghe di 75 ottetti:
    var out = '', bytes = 0;         // si contano i byte UTF-8, una lettera accentata ne vale due
    Array.from(line).forEach(function (ch) {
      var c = ch.codePointAt(0), b = c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
      if (bytes + b > 73) { out += '\r\n '; bytes = 0; }
      out += ch; bytes += b;
    });
    return out;
  }
  function icsEsc(t) {
    return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  function ymd(iso) { return iso.replace(/-/g, ''); }
  function plusDay(iso) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

  function buildIcs(el) {
    var title = el.getAttribute('data-ev-title');
    var start = el.getAttribute('data-ev-start');
    var end = el.getAttribute('data-ev-end') || start;
    var place = el.getAttribute('data-ev-place') || '';
    var note = el.getAttribute('data-ev-note') || '';
    var page = el.getAttribute('data-ev-page');
    // Sempre il dominio pubblico, mai location.href: un .ics scaricato dall'anteprima
    // resterebbe con l'indirizzo di servizio dentro, e chi lo apre finirebbe li'.
    var url = new URL(page || '', IANUA.sito).href;
    var maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place);
    // La descrizione porta con sé tutto quello che serve a chi apre l'evento sul telefono.
    var desc = [note, '', 'Dove: ' + place, 'Mappa: ' + maps, '', 'IANUA — collettivo artistico',
                'Email: ' + IANUA.mail, 'Telefono: ' + IANUA.tel, 'Instagram: ' + IANUA.ig,
                'Programma: ' + url, 'Sito: ' + IANUA.sito].join('\n');
    var stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    var uid = ymd(start) + '-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '@ianua';
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IANUA//sito//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + ymd(start), 'DTEND;VALUE=DATE:' + ymd(plusDay(end)),
      'SUMMARY:' + icsEsc(title), 'LOCATION:' + icsEsc(place), 'URL:' + url,
      'DESCRIPTION:' + icsEsc(desc), 'END:VEVENT', 'END:VCALENDAR'];
    return L.map(icsFold).join('\r\n') + '\r\n';
  }

  document.querySelectorAll('[data-ics]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var el = btn.closest('[data-ev-start]'); if (!el) return;
      var blob = new Blob([buildIcs(el)], { type: 'text/calendar;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (el.getAttribute('data-ev-title') || 'ianua').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      var was = btn.textContent; btn.setAttribute('data-done', ''); btn.textContent = 'Aggiunto';
      setTimeout(function () { btn.removeAttribute('data-done'); btn.textContent = was; }, 2600);
    });
  });


  /* ---------- 7c. «Gli altri artisti»: quattro a caso a ogni visita ----------
     Nelle schede si vedevano sempre le stesse facce. Qui se ne pescano quattro
     fra gli artisti del festival che non sono del collettivo, saltando la scheda
     che si sta guardando. I quattro scritti nella pagina restano come rete di
     sicurezza: senza JavaScript si vedono quelli. */
  var ALTRI = [
    {s:"mattia-signorini",n:"Mattia Signorini",r:"Scrittura",t:"Romanziere, tradotto in mezzo mondo.",i:"mattia-signorini.webp",ss:"mattia-signorini_sm.webp 800w, mattia-signorini.webp 1280w",a:"Ritratto di Mattia Signorini",w:1280,h:1600},
    {s:"giorgia-roversi",n:"Giorgia Roversi",r:"Pittura",t:"Pittura dell'anatomia invisibile delle emozioni.",i:"giorgia-roversi.webp",ss:"giorgia-roversi_sm.webp 800w, giorgia-roversi.webp 906w",a:"Ritratto di Giorgia Roversi",w:906,h:1133},
    {s:"zentequerente",n:"Zentequerente",r:"Arti visive",t:"Disegno e segni raccolti: l'invisibile dentro il visibile.",i:"zentequerente.webp",ss:"zentequerente_sm.webp 800w, zentequerente.webp 1086w",a:"Ritratto di Zentequerente, di profilo",w:1086,h:1357},
    {s:"marcello-ubertone",n:"Marcello Ubertone",r:"Cantautorato",t:"Canzoni che raccontano storie, tra immaginazione e vita vera.",i:"marcello-ubertone.webp",ss:"marcello-ubertone_sm.webp 800w, marcello-ubertone.webp 1280w",a:"Ritratto di Ubertone, di profilo",w:1280,h:1600},
    {s:"anna-spazio-marangon",n:"Anna Spazio Marangon",r:"Arti visive · installazione",t:"Installazioni di fili e nodi, tra spazio e materia.",i:"anna-spazio-marangon.webp",ss:"anna-spazio-marangon_sm.webp 475w",a:"Ritratto di Anna Spazio Marangon, di profilo",w:475,h:593},
    {s:"enrico-buoso",n:"Enrico Buoso",r:"Musica e composizione",t:"Intrecci di note e reti di persone.",i:"enrico-buoso.webp",ss:"enrico-buoso_sm.webp 800w, enrico-buoso.webp 1148w",a:"Ritratto di Enrico Buoso",w:1148,h:1435},
    {s:"martino-prendini",n:"Martino Prendini",r:"Arti visive",t:"Esplora con i sensi quello che non si scopre in altro modo.",i:"martino-prendini.webp",ss:"martino-prendini_sm.webp 800w, martino-prendini.webp 1280w",a:"Ritratto di Martino Prendini",w:1280,h:1600},
    {s:"daniele-corrain",n:"Daniele Corrain",r:"Pittura e illustrazione",t:"Dipinge quello che gli passa per la testa, sporcandosi le mani.",i:"daniele-corrain.webp",ss:"daniele-corrain_sm.webp 800w, daniele-corrain.webp 1280w",a:"Ritratto di Daniele Corrain, di profilo",w:1280,h:1593},
    {s:"giulia-dal-pra",n:"Giulia Dal Prà",r:"Collage",t:"Ritaglia, accosta e ricompone quello che gli altri hanno smesso di guardare.",i:"giulia-dal-pra.webp",ss:"giulia-dal-pra_sm.webp 800w, giulia-dal-pra.webp 1280w",a:"Ritratto di Giulia Dal Prà",w:1280,h:1600},
    {s:"anna-randolo",n:"Anna Randolo",r:"Illustrazione · Unnyverso",t:"Dà colore e voce alle storie, soprattutto per i bambini.",i:"anna-randolo.webp",ss:"anna-randolo_sm.webp 800w, anna-randolo.webp 1280w",a:"Ritratto di Anna Randolo",w:1280,h:1600},
    {s:"caino",n:"CAINO",r:"Fotografia",t:"Fotografie che strappano e ricompongono le icone della pittura.",i:"caino.webp",ss:"caino_sm.webp 640w, caino.webp 1280w",a:"Logo di CAINO, bianco su fondo nero",w:1280,h:1600},
    {s:"filo",n:"FILO",r:"Cantautorato",t:"Cantautore, autore del disco «In cerca di un filo».",i:"filo.webp",ss:"filo_sm.webp 316w, filo.webp 396w",a:"Ritratto di FILO, di profilo",w:396,h:495},
    {s:"massimo-marchioro",n:"Massimo Marchioro",r:"Pittura",t:"Cerca nelle stanze più profonde, e le scale che portano in alto.",i:"massimo-marchioro.webp",ss:"massimo-marchioro_sm.webp 800w, massimo-marchioro.webp 1280w",a:"Ritratto di Massimo Marchioro, di profilo",w:1280,h:1600}
  ];

  (function () {
    var griglia = document.querySelector('[data-altri-artisti]');
    if (!griglia) return;
    var schede = griglia.querySelectorAll('.person');
    if (!schede.length) return;

    // la scheda aperta non si propone da sola
    var qui = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    var mazzo = ALTRI.filter(function (a) { return a.s !== qui; });

    // mescolata di Fisher-Yates: ogni ordine ha la stessa probabilita'
    for (var i = mazzo.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = mazzo[i]; mazzo[i] = mazzo[j]; mazzo[j] = t;
    }
    if (mazzo.length < schede.length) return;   // meno artisti che caselle: si lascia com'e'

    Array.prototype.forEach.call(schede, function (scheda, k) {
      var a = mazzo[k], img = scheda.querySelector('img');
      var h3 = scheda.querySelector('h3'), ruolo = scheda.querySelector('.role');
      var testo = scheda.querySelectorAll('figure > p');
      if (!img || !h3 || !ruolo) return;
      scheda.setAttribute('href', a.s + '.html');
      img.setAttribute('src', '../assets/img/' + a.i);
      img.setAttribute('srcset', a.ss.replace(/([a-z0-9_.-]+\.webp)/g, '../assets/img/$1'));
      img.setAttribute('alt', a.a);
      img.setAttribute('width', a.w); img.setAttribute('height', a.h);
      h3.textContent = a.n;
      ruolo.textContent = a.r;
      if (testo.length) testo[testo.length - 1].textContent = a.t;
    });
  })();

  document.querySelectorAll('[data-countdown]').forEach(function (el) {
    var d = new Date(el.getAttribute('data-countdown') + 'T00:00:00');
    var oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    var g = Math.round((d - oggi) / 86400000);
    el.textContent = g > 1 ? 'Mancano ' + g + ' giorni' : g === 1 ? 'È domani' : g === 0 ? 'È oggi' : 'Già passato';
  });

  // Conto alla rovescia del banner in home: giorni, ore, minuti e secondi. Le cifre
  // che cambiano scorrono (la vecchia esce in alto, la nuova entra dal basso); le altre
  // restano ferme. Il controllo gira a ogni fotogramma ma ridisegna solo quando cambia
  // il secondo, cosi' il numero non resta indietro e non salta. Il gruppo e' aria-hidden:
  // la data per esteso sta in un .sr-only accanto.
  document.querySelectorAll('[data-countdown-live]').forEach(function (el) {
    var meta = new Date(el.getAttribute('data-countdown-live'));
    var fineAttr = el.getAttribute('data-countdown-live-end');
    var fine = fineAttr ? new Date(fineAttr) : null;
    var box = el.parentNode;
    var lab = box ? box.querySelector('[data-countdown-live-label]') : null;
    var gruppi = null, ultimo = null;
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function cifraFerma(c, d) { c.s.className = 'pf-cd-s'; c.s.innerHTML = '<span>' + d + '</span>'; }
    function cifra(c, d) {
      if (c.v === d) return;
      var prima = c.v; c.v = d;
      clearTimeout(c.tm);
      if (reduce || prima == null) { cifraFerma(c, d); return; }
      c.s.className = 'pf-cd-s';
      c.s.innerHTML = '<span>' + prima + '</span><span>' + d + '</span>';
      void c.s.offsetHeight;                       // parte dalla posizione di riposo
      c.s.classList.add('is-go');
      c.tm = setTimeout(function () { cifraFerma(c, d); }, 480);
    }
    function numero(g, testo) {
      if (g.celle.length !== testo.length) {        // cambia il numero di cifre: si ricompone fermo
        g.n.textContent = ''; g.celle = [];
        for (var k = 0; k < testo.length; k++) {
          var d = document.createElement('span'); d.className = 'pf-cd-d';
          var st = document.createElement('span'); d.appendChild(st);
          g.n.appendChild(d); g.celle.push({ s: st, v: null });
        }
      }
      for (var i = 0; i < testo.length; i++) cifra(g.celle[i], testo.charAt(i));
    }
    function monta() {
      el.textContent = ''; el.classList.add('is-live');
      if (lab) lab.textContent = 'Mancano';
      gruppi = [['giorno', 'giorni'], ['ora', 'ore'], ['minuto', 'minuti'], ['secondo', 'secondi']].map(function (w) {
        var u = document.createElement('span'); u.className = 'pf-cd-u';
        var n = document.createElement('span'); n.className = 'pf-cd-n';
        var t = document.createElement('span'); t.className = 'pf-cd-w';
        u.appendChild(n); u.appendChild(t); el.appendChild(u); el.appendChild(document.createTextNode(' '));
        return { n: n, t: t, w: w, celle: [] };
      });
    }
    function finito(ora) {
      if (lab) lab.hidden = true;
      if (box) box.removeAttribute('aria-hidden');
      el.classList.remove('is-live'); gruppi = null;
      var t = (fine && ora < fine) ? 'Il festival è in corso' : 'Edizione 0 conclusa';
      if (el.textContent !== t) el.textContent = t;
      return !(fine && ora < fine);                 // true: non c'e' piu' niente da aggiornare
    }
    function scrivi(ora) {
      var ms = meta - ora;
      if (ms <= 0) return finito(ora);
      if (!gruppi) monta();
      var sec = Math.floor(ms / 1000);
      var v = [Math.floor(sec / 86400), Math.floor(sec / 3600) % 24, Math.floor(sec / 60) % 60, sec % 60];
      gruppi.forEach(function (g, i) {
        numero(g, i === 0 ? String(v[i]) : pad(v[i]));
        var w = v[i] === 1 ? g.w[0] : g.w[1];
        if (g.t.textContent !== w) g.t.textContent = w;
      });
      return false;
    }
    function giro() {
      var ora = new Date(), s = Math.floor(ora.getTime() / 1000);
      if (s !== ultimo) { ultimo = s; if (scrivi(ora)) return; }
      requestAnimationFrame(giro);
    }
    giro();
  });

  // Filtri per tipo. Compaiono solo quando in agenda c'è più di un tipo di evento:
  // con un solo appuntamento sarebbero un comando che non comanda niente.
  (function () {
    var box = document.querySelector('.ag-filters'); if (!box) return;
    var evs = [].slice.call(document.querySelectorAll('.ag-event[data-kind]'));
    var kinds = evs.map(function (e) { return e.getAttribute('data-kind'); })
                   .filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (kinds.length < 2) return;
    box.classList.add('on');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var k = b.getAttribute('data-filter');
      box.querySelectorAll('button').forEach(function (o) { o.setAttribute('aria-pressed', o === b); });
      evs.forEach(function (ev) { ev.hidden = !(k === 'tutto' || ev.getAttribute('data-kind') === k); });
      // il filo si ridisegna sugli eventi rimasti: è lui il riscontro visivo del filtro
      dispatchEvent(new Event('resize'));
    });
  })();

  /* ---------- 7c. FOTO A TUTTO SCHERMO ---------- */
  (function () {
    var zoomables = [].slice.call(document.querySelectorAll(
      '.sc-media img, .bio .ph img, .artist-ph img, .gallery img, .page-hero .bg'
    )).filter(function (im) { return !im.closest('a'); });
    if (!zoomables.length) return;

    var box = document.createElement('div');
    box.className = 'lightbox'; box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Fotografia ingrandita');
    box.innerHTML = '<button class="lb-close" type="button" aria-label="Chiudi">' +
      '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">' +
      '<path d="M3 3l16 16M19 3L3 19" stroke="currentColor" stroke-width="1.2"/></svg></button>' +
      '<figure class="lb-fig"><img alt=""><figcaption class="lb-credit" hidden></figcaption></figure>';
    document.body.appendChild(box);
    var big = box.querySelector('img'), cap = box.querySelector('.lb-credit'), last = null;

    function open(im) {
      last = im;
      big.src = im.currentSrc || im.src; big.alt = im.alt || '';
      // Il credito della foto (data-credit sulla foto o su un contenitore) si legge solo qui:
      // in home le schede restano pulite e il nome del fotografo compare a foto ingrandita.
      var c = im.closest('[data-credit]');
      cap.textContent = c ? c.getAttribute('data-credit') : ''; cap.hidden = !c;
      box.classList.add('on'); document.body.classList.add('menu-open');
      box.querySelector('.lb-close').focus();
    }
    function close() {
      box.classList.remove('on'); document.body.classList.remove('menu-open');
      if (last) { last.focus(); }
    }
    zoomables.forEach(function (im) {
      im.classList.add('zoomable');
      im.setAttribute('tabindex', '0');
      im.setAttribute('role', 'button');
      if (!im.getAttribute('aria-label')) im.setAttribute('aria-label', (im.alt || 'Fotografia') + ' — ingrandisci');
      im.addEventListener('click', function () { open(im); });
      im.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(im); } });
    });
    box.addEventListener('click', close);
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('on')) close(); });
  })();

  /* ---------- 9. FORM ---------- */
  var form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      var bad = false;
      form.querySelectorAll('.field').forEach(function (f) {
        var i = f.querySelector('input,textarea'); if (!i) return;
        var ok = i.checkValidity(); f.classList.toggle('invalid', !ok); if (!ok) bad = true;
      });
      if (bad) { e.preventDefault(); form.querySelector('.invalid input, .invalid textarea').focus(); return; }
      if (form.hasAttribute('data-netlify') && window.fetch) {
        e.preventDefault();
        var data = new FormData(form);
        fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() })
          .then(function (r) { if (!r.ok) throw 0; form.classList.add('sent'); form.querySelector('.ok').focus(); })
          .catch(function () {
            var to = form.getAttribute('data-mailto'); var body = 'Nome: ' + data.get('nome') + '\nEmail: ' + data.get('email') + '\n\n' + data.get('messaggio');
            location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('Contatto dal sito IANUA') + '&body=' + encodeURIComponent(body);
          });
      }
    });
    form.querySelectorAll('input,textarea').forEach(function (i) { i.addEventListener('input', function () { i.closest('.field').classList.remove('invalid'); }); });
  }

  schedule();
})();
