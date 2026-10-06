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
        if (w) {
          world = w.getAttribute('data-world');
          // sito del festival: la barra prende il colore della sezione che ha sotto
          if (document.body.classList.contains('carta')) nav.style.setProperty('--nav-bg', getComputedStyle(w).getPropertyValue('--bg').trim() || '#F4EDE1');
          break;
        }
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
  // Punti del tracciato a passo costante, calcolati leggendo le curve dalla stringa 'd'
  // (il motore la scrive come M seguito da curve cubiche C). Prima si chiamava
  // getPointAtLength ogni 3 px: circa 2500 chiamate, e ognuna ripercorre il tracciato
  // dall'inizio. Al caricamento della home occupava 12 secondi di CPU e bloccava la
  // pagina, animazione dell'apertura compresa. Cosi' e' una passata sola, in pochi ms.
  // Le lunghezze si riportano sulla lunghezza vera del browser (Ltot), perche' il
  // motore disegna il filo con lo stroke-dashoffset misurato su quella.
  function campiona(d, passo, Ltot) {
    var tk = (d || '').match(/[MC]|-?\d*\.?\d+(?:e-?\d+)?/g);
    if (!tk) return [];
    var fitti = [], lun = [0], x = 0, y = 0, i = 0, cmd = '';
    while (i < tk.length) {
      if (tk[i] === 'M' || tk[i] === 'C') { cmd = tk[i]; i++; continue; }
      if (cmd === 'M') { x = +tk[i]; y = +tk[i + 1]; i += 2; fitti.push([x, y]); cmd = 'C'; continue; }
      var x1 = +tk[i], y1 = +tk[i + 1], x2 = +tk[i + 2], y2 = +tk[i + 3], x3 = +tk[i + 4], y3 = +tk[i + 5];
      i += 6;
      if (!fitti.length) fitti.push([x, y]);
      for (var k = 1; k <= 10; k++) {
        var u = k / 10, m = 1 - u, a = m * m * m, b = 3 * m * m * u, c = 3 * m * u * u, e = u * u * u;
        var px = a * x + b * x1 + c * x2 + e * x3, py = a * y + b * y1 + c * y2 + e * y3;
        var q = fitti[fitti.length - 1];
        lun.push(lun[lun.length - 1] + Math.hypot(px - q[0], py - q[1]));
        fitti.push([px, py]);
      }
      x = x3; y = y3;
    }
    var tot = lun[lun.length - 1];
    if (!tot || fitti.length < 2) return [];
    var sc = Ltot / tot, out = [], j = 1;
    for (var s = 0; s <= Ltot + passo / 2; s += passo) {
      var sv = Math.min(s, Ltot) / sc;
      while (j < lun.length - 1 && lun[j] < sv) j++;
      var l0 = lun[j - 1], l1 = lun[j], f = l1 > l0 ? (sv - l0) / (l1 - l0) : 0;
      var A = fitti[j - 1], B = fitti[j];
      out.push([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, Math.min(s, Ltot)]);
    }
    return out;
  }
  window.pfCampiona = campiona;

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
    // Sito del festival: le corsie del cambio di riga si misurano sui bordi VERI dei ritratti,
    // non su quelli del contenitore. Nella griglia stretta del telefono le foto sporgono fuori
    // dal .thread, e una corsia calcolata sul contenitore cadeva dentro la foto: il filo
    // scendeva lungo il bordo e attraversava i volti dall'alto, 622 punti sopra la fascia
    // consentita. Il respiro che le corsie richiedono lo dà il CSS, col padding del .thread.
    if (document.body.classList.contains('carta') && ph.length) {
      var fl = Infinity, fr = -Infinity;
      ph.forEach(function (p) { if (p.l < fl) fl = p.l; if (p.l + p.w > fr) fr = p.l + p.w; });
      laneL = Math.min(laneL, fl - 12);
      laneR = Math.max(laneR, fr + 12);
    }
    var poly = [], anchors = new Array(ph.length);
    // Sito del festival (body.carta): ritratti di profilo con mento e collo bassi. Le asole
    // scendono dall'82% dell'altezza e possono sporgere di 7 px sotto la foto (il nome sta
    // 12 px più in basso); i giri piccoli avanzano appena, così restano anelli senza curve
    // strette; i cambi di riga escono dalla foto in orizzontale e girano nel margine.
    var carta = document.body.classList.contains('carta');
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
      // di profilo degli artisti esterni, che hanno il mento più in basso dei nostri.
      // Sul sito del festival quasi tutti i ritratti sono di profilo: all'82% l'anello
      // girava attorno al collo, sotto il mento, e sembrava una collana. 0.9 lo porta
      // sulle spalle. La fascia si assottiglia, quindi le asole scendono un po' più sotto
      // la foto (11 px invece di 7) per restare tonde senza arrivare al nome, che sta a 12.
      var top = p.t + p.h * (carta ? 0.88 : 0.74), bot = p.t + p.h + (carta ? 7 : -6), R = Math.min((bot - top) / 2, 46);
      var n = p.i % 2 === 0 && p.w >= Math.max(R * 4.6, 220) ? 2 : 1;   // foto strette: un solo giro, più largo
      var s = p.i % 2 ? -1 : 1, out = [];              // una foto il giro sopra la linea, la seguente sotto
      for (var q = 0; q < n; q++) {
        var r = Math.min(R, p.w / (n + 1) * 0.46) * (carta ? 0.97 + rnd(p.i * 7 + q * 3 + 1) * 0.03 : 0.92 + rnd(p.i * 7 + q * 3 + 1) * 0.08);
        var a = r * (r >= 42 ? 0.32 : r >= 34 ? 0.26 : r >= 30 ? 0.18 : carta ? 0.03 : 0.08);   // giri piccoli: avanzano meno, così la curva non si stringe (sotto 30 px: telefoni stretti a due colonne)
        var cx = p.l + p.w * (d > 0 ? (q + 1) / (n + 1) : (n - q) / (n + 1)) + (rnd(p.i * 11 + q) - 0.5) * p.w * 0.05;
        var cy = clamp((top + bot) / 2, top + r, bot - r);
        out.push({ cx: cx, cy: cy, r: r, a: a, s: s, d: d,
                   start: [cx - d * a * Math.PI, cy + s * r], end: [cx + d * a * Math.PI, cy + s * r] });
      }
      return out;
    }
    var prevEnd = null, prevDir = 0, prevBot = 0;
    // da che parte entra il filo: di solito da sinistra; data-giri-inizio="destra-telefono"
    // lo fa entrare da destra sugli schermi stretti (sotto i 640 px)
    var inizio = th.getAttribute('data-giri-inizio') === 'destra-telefono' && vw < 640 ? -1 : 1;
    rows.forEach(function (row, k) {
      var d = (k % 2 ? -1 : 1) * inizio;
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
          } else if (carta) {
            // cambio di riga: due archi di cerchio larghi quanto si puo', uniti da una discesa
            // nel margine. Lo spazio verso fuori arriva fino a 6 px dal bordo dello schermo;
            // l'arco puo' cominciare gia' sotto la foto, purche' scenda solo di qualche pixel
            // e resti sopra il nome (che sta 12 px sotto la foto). Non attraversa ne' volti ne' nomi.
            var ln = prevDir > 0 ? laneR : laneL, E0 = prevEnd, dyr = S[1] - E0[1];
            var bordo = ln - prevDir * 12;
            var fuori = prevDir > 0 ? vw - box.left - ln - 6 : ln + box.left - 6;
            var X = ln + prevDir * clamp(fuori, 0, 64) * (0.85 + rnd(k * 7 + 5) * 0.15);
            var lato = Math.abs(X - bordo);
            // il raggio piu' grande per cui, sul bordo della foto, l'arco scende al massimo di 'giu' px
            function raggio(giu) {
              for (var rg = Math.min(80, dyr / 2 - 4); rg > lato; rg -= 2) {
                var u = rg - lato; if (rg - Math.sqrt(rg * rg - u * u) <= giu) return rg;
              }
              return Math.max(8, Math.min(lato, dyr / 2 - 4));
            }
            var r1 = raggio(Math.max(0, prevBot + 9 - E0[1])), r2 = raggio(Math.max(0, S[1] - (p.t + p.h * 0.8)));
            var C1 = X - prevDir * r1, C2 = X - prevDir * r2, kq = 0.5523;
            var E1 = [C1, E0[1]], M1 = [X, E0[1] + r1], M2 = [X, S[1] - r2], S1 = [C2, S[1]];
            if (prevDir * (E1[0] - E0[0]) > 1) bez(E0, [E0[0] + (E1[0] - E0[0]) / 3, E0[1]], [E0[0] + (E1[0] - E0[0]) * 2 / 3, E0[1]], E1);
            else E1 = E0;
            bez(E1, [E1[0] + prevDir * r1 * kq, E1[1]], [X, M1[1] - r1 * kq], M1);
            if (M2[1] - M1[1] > 1) bez(M1, [X, M1[1] + (M2[1] - M1[1]) / 3], [X, M2[1] - (M2[1] - M1[1]) / 3], M2);
            var S1v = prevDir * (S1[0] - S[0]) > 1 ? S1 : S;
            bez(M2, [X, M2[1] + r2 * kq], [S1v[0] + prevDir * r2 * kq, S1v[1]], S1v);
            if (S1v !== S) bez(S1, [S1[0] + (S[0] - S1[0]) / 3, S[1]], [S1[0] + (S[0] - S1[0]) * 2 / 3, S[1]], S);
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
          prevEnd = L.end; prevDir = d; prevBot = p.t + p.h;
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
    var L = 0, knotLen = [], fitti = [];
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
      // punti fitti del tracciato, calcolati una volta per costruzione: servono agli
      // ancoraggi qui sotto e al capo che corre col filo a ogni fotogramma
      fitti = campiona(d, 4, L);
      var samples = fitti;
      knotLen = anchors.map(function (a) {
        var best = 0, bd = Infinity;
        for (var i = 0; i < samples.length; i++) {
          var dx = samples[i][0] - a[0], dy = samples[i][1] - a[1], d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = samples[i][2]; }
        }
        return best;
      });
      if (bead && reduce && fitti.length) { var pe = fitti[fitti.length - 1]; bead.setAttribute('cx', pe[0]); bead.setAttribute('cy', pe[1]); }
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
        // posizione del capo dai punti fitti: getPointAtLength a ogni fotogramma ripercorreva
        // tutto il tracciato, millisecondi rubati allo scorrimento
        var pt = fitti.length ? fitti[Math.min(fitti.length - 1, Math.max(0, Math.round(clamp(beadAt, 0, L) / 4)))] : null;
        if (pt) { bead.setAttribute('cx', pt[0]); bead.setAttribute('cy', pt[1]); }
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
  function ymd(iso) { return iso.slice(0, 10).replace(/-/g, ''); }
  function plusDay(iso) { var d = new Date(iso.slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

  /* Un appuntamento che dichiara anche l'ora (data-ev-start="2026-10-10T21:00") entra
     nel calendario come appuntamento vero, non come giornata intera. L'ora scritta
     nell'HTML e' sempre ora italiana, e nel file diventa UTC: cosi' chi ha il telefono
     su un altro fuso vede comunque l'ora giusta. L'accordo fra Roma e UTC lo si chiede
     al sistema invece di darlo per scontato, perche' a fine ottobre cambia con l'ora
     solare. Senza data-ev-fine l'appuntamento dura un'ora e mezza. */
  function minutiAvantiSuUtc(istante) {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    var p = {}; f.formatToParts(istante).forEach(function (x) { p[x.type] = x.value; });
    return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute) - istante.getTime()) / 60000;
  }
  function istanteItaliano(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || ''); if (!m) return null;
    var comeSeFosseUtc = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
    return new Date(comeSeFosseUtc - minutiAvantiSuUtc(new Date(comeSeFosseUtc)) * 60000);
  }
  function inUtc(d) { return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; }
  function righeQuando(start, end, fine) {
    var inizio = istanteItaliano(start);
    if (!inizio) return ['DTSTART;VALUE=DATE:' + ymd(start), 'DTEND;VALUE=DATE:' + ymd(plusDay(end))];
    var termine = istanteItaliano(fine) || new Date(inizio.getTime() + 90 * 60000);
    return ['DTSTART:' + inUtc(inizio), 'DTEND:' + inUtc(termine)];
  }

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
      'BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + stamp]
      .concat(righeQuando(start, end, el.getAttribute('data-ev-fine')))
      .concat(['SUMMARY:' + icsEsc(title), 'LOCATION:' + icsEsc(place), 'URL:' + url,
      'DESCRIPTION:' + icsEsc(desc), 'END:VEVENT', 'END:VCALENDAR']);
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
  // nel programma anche l'orario di ogni appuntamento lo aggiunge al calendario
  document.querySelectorAll('.app').forEach(function (app) {
    var ora = app.querySelector('.app-ora'), btn = app.querySelector('[data-ev-start] [data-ics]');
    if (!ora || !btn || !ora.querySelector('time')) return;
    ora.setAttribute('role', 'button');
    ora.setAttribute('tabindex', '0');
    ora.setAttribute('title', 'Aggiungi al calendario');
    ora.setAttribute('aria-label', 'Aggiungi al calendario: ' + (app.querySelector('.app-t') || ora).textContent.trim() + ', ' + ora.textContent.trim());
    ora.addEventListener('click', function () { btn.click(); });
    ora.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); } });
  });


  /* ---------- 7c. «Gli altri artisti»: quattro a caso a ogni visita ----------
     Nelle schede si vedevano sempre le stesse facce. Qui se ne pescano quattro
     fra gli artisti del festival che non sono del collettivo, saltando la scheda
     che si sta guardando. I quattro scritti nella pagina restano come rete di
     sicurezza: senza JavaScript si vedono quelli. */
  var ALTRI = [
    {s:"mattia-signorini",n:"Mattia Signorini",r:"Scrittura",t:"Romanziere, tradotto in mezzo mondo.",i:"mattia-signorini.webp",ss:"mattia-signorini_sm.webp 800w, mattia-signorini.webp 1280w",a:"Ritratto di Mattia Signorini",w:1280,h:1600},
    {s:"giorgia-roversi",n:"Giorgia Roversi",r:"Pittura",t:"Pittura dell'anatomia invisibile delle emozioni.",i:"giorgia-roversi-2.webp",ss:"giorgia-roversi-2_sm.webp 800w, giorgia-roversi-2.webp 1280w",a:"Ritratto di Giorgia Roversi, di profilo",w:1280,h:1600},
    {s:"zentequerente",n:"Zentequerente",r:"Arti visive",t:"Disegno e segni raccolti: l'invisibile dentro il visibile.",i:"zentequerente-2.webp",ss:"zentequerente-2_sm.webp 800w, zentequerente-2.webp 1280w",a:"Ritratto di Zentequerente, di profilo",w:1280,h:1600},
    {s:"marcello-ubertone",n:"Marcello Ubertone",r:"Cantautorato",t:"Canzoni che raccontano storie, tra immaginazione e vita vera.",i:"marcello-ubertone-2.webp",ss:"marcello-ubertone-2_sm.webp 800w, marcello-ubertone-2.webp 1280w",a:"Ritratto di Marcello Ubertone, di profilo",w:1280,h:1600},
    {s:"anna-spazio-marangon",n:"Anna Spazio Marangon",r:"Arti visive · installazione",t:"Installazioni di fili e nodi, tra spazio e materia.",i:"anna-spazio-marangon-2.webp",ss:"anna-spazio-marangon-2_sm.webp 800w, anna-spazio-marangon-2.webp 1280w",a:"Ritratto di Anna Spazio Marangon, di profilo",w:1280,h:1600},
    {s:"enrico-buoso",n:"Enrico Buoso",r:"Musica e composizione",t:"Intrecci di note e reti di persone.",i:"enrico-buoso-2.webp",ss:"enrico-buoso-2_sm.webp 800w, enrico-buoso-2.webp 1280w",a:"Ritratto di Enrico Buoso",w:1280,h:1600},
    {s:"martino-prendini",n:"Martino Prendini",r:"Arti visive",t:"Esplora con i sensi quello che non si scopre in altro modo.",i:"martino-prendini-2.webp",ss:"martino-prendini-2_sm.webp 800w, martino-prendini-2.webp 1280w",a:"Ritratto di Martino Prendini",w:1280,h:1600},
    {s:"daniele-corrain",n:"Daniele Corrain",r:"Pittura e illustrazione",t:"Dipinge quello che gli passa per la testa, sporcandosi le mani.",i:"daniele-corrain-2.webp",ss:"daniele-corrain-2_sm.webp 800w, daniele-corrain-2.webp 1280w",a:"Ritratto di Daniele Corrain, di profilo",w:1280,h:1600},
    {s:"giulia-dal-pra",n:"Giulia Dal Prà",r:"Collage",t:"Ritaglia, accosta e ricompone quello che gli altri hanno smesso di guardare.",i:"giulia-dal-pra.webp",ss:"giulia-dal-pra_sm.webp 800w, giulia-dal-pra.webp 1280w",a:"Ritratto di Giulia Dal Prà",w:1280,h:1600},
    {s:"anna-randolo",n:"Anna Randolo",r:"Illustrazione · Unnyverso",t:"Dà colore e voce alle storie, soprattutto per i bambini.",i:"anna-randolo-2.webp",ss:"anna-randolo-2_sm.webp 800w, anna-randolo-2.webp 1280w",a:"Ritratto di Anna Randolo",w:1280,h:1600},
    {s:"caino",n:"CAINO",r:"Fotografia",t:"Fotografie che strappano e ricompongono le icone della pittura.",i:"caino.webp",ss:"caino_sm.webp 640w, caino.webp 1280w",a:"Logo di CAINO, bianco su fondo nero",w:1280,h:1600},
    {s:"filo",n:"FILO",r:"Cantautorato",t:"Cantautore, autore del disco «In cerca di un filo».",i:"filo-2.webp",ss:"filo-2_sm.webp 800w, filo-2.webp 1280w",a:"Ritratto di FILO, di profilo",w:1280,h:1600},
    {s:"massimo-marchioro",n:"Massimo Marchioro",r:"Pittura",t:"Cerca nelle stanze più profonde e le scale che portano in alto.",i:"massimo-marchioro-2.webp",ss:"massimo-marchioro-2_sm.webp 800w, massimo-marchioro-2.webp 1280w",a:"Ritratto di Massimo Marchioro, di profilo",w:1280,h:1600},
    {s:"salvatore-passalacqua",n:"Salvatore Passalacqua",r:"Musica e arti visive · ETHA",t:"Strumenti acustici ed elettronica, tra il reale e il surreale.",i:"salvatore-passalacqua-2.webp",ss:"salvatore-passalacqua-2_sm.webp 800w, salvatore-passalacqua-2.webp 1280w",a:"Ritratto di Salvatore Passalacqua, di profilo",w:1280,h:1600},
    {s:"salsa-wasabbee",n:"salsa_wasabbee",r:"Fumetto e illustrazione",t:"Tavole in bianco e nero: sperimenta, si spaventa, si addormenta.",i:"salsa-wasabbee-2.webp",ss:"salsa-wasabbee-2_sm.webp 800w, salsa-wasabbee-2.webp 1280w",a:"Ritratto di salsa_wasabbee, di profilo",w:1280,h:1600},
    {s:"francesca-de-simone",n:"Francesca De Simone",r:"Poesia",t:"Fissa in pochi versi un sentire sconosciuto.",i:"francesca-de-simone-2.webp",ss:"francesca-de-simone-2_sm.webp 800w, francesca-de-simone-2.webp 1280w",a:"Ritratto di Francesca De Simone, di profilo, in bianco e nero",w:1280,h:1600},
    {s:"elia-pellegrini",n:"Elia Pellegrini",r:"Arti visive e 3D",t:"Luce, architettura e tempo, tra i rosoni gotici e il mondo onirico.",i:"elia-pellegrini-2.webp",ss:"elia-pellegrini-2_sm.webp 800w, elia-pellegrini-2.webp 1280w",a:"Ritratto di Elia Pellegrini, di profilo",w:1280,h:1600},
    {s:"alessandro-alfonsi",n:"Alessandro Alfonsi",r:"Musica e teatro",t:"Musica e parola, memoria e ascolto.",i:"alessandro-alfonsi-2.webp",ss:"alessandro-alfonsi-2_sm.webp 800w, alessandro-alfonsi-2.webp 1280w",a:"Ritratto di Alessandro Alfonsi, di profilo",w:1280,h:1600},
    {s:"irma-paulon",n:"Irma Paulon",r:"Arti visive e scultura",t:"Resina, legno, vetro e metallo: la dignità estetica della materia.",i:"irma-paulon-2.webp",ss:"irma-paulon-2_sm.webp 800w, irma-paulon-2.webp 1280w",a:"Irma Paulon di profilo, con le mani sulle radici di un albero sradicato",w:1280,h:1600},
    {s:"nihil",n:"NIHIL",r:"Musica e cantautorato",t:"Erede al trono di un regno senza terra, in viaggio con la musica.",i:"nihil-2.webp",ss:"nihil-2_sm.webp 800w, nihil-2.webp 1280w",a:"Ritratto di NIHIL di profilo, con il volto blu e la maschera di cristalli",w:1280,h:1600},
    {s:"andrea-fabbri",n:"Andrea Fabbri",r:"Pittura e tatuaggio",t:"Tatuaggio e pittura: trasformare l'ombra in emozione.",i:"andrea-fabbri-2.webp",ss:"andrea-fabbri-2_sm.webp 800w, andrea-fabbri-2.webp 1280w",a:"Andrea Fabbri di profilo mentre dipinge, con la tavolozza in mano",w:1280,h:1600}
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
      // Dove va il messaggio lo dice data-endpoint. Su Netlify era la radice del
      // sito, che raccoglieva i moduli da sola; altrove ci vuole un servizio che
      // li riceva. Senza endpoint si apre direttamente il programma di posta con
      // il messaggio già scritto: meglio di un modulo che dice «grazie» e non
      // manda niente a nessuno.
      e.preventDefault();
      var data = new FormData(form);
      var dove = form.getAttribute('data-endpoint');

      function perPosta() {
        var to = form.getAttribute('data-mailto');
        var corpo = 'Nome: ' + data.get('nome') + '\nEmail: ' + data.get('email') + '\n\n' + data.get('messaggio');
        location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('Contatto dal sito PRO-FILI Festival') + '&body=' + encodeURIComponent(corpo);
      }

      if (!dove || !window.fetch) { perPosta(); return; }
      fetch(dove, { method: 'POST', headers: { 'Accept': 'application/json' }, body: data })
        .then(function (r) { if (!r.ok) throw 0; form.classList.add('sent'); form.querySelector('.ok').focus(); })
        .catch(perPosta);
    });
    form.querySelectorAll('input,textarea').forEach(function (i) { i.addEventListener('input', function () { i.closest('.field').classList.remove('invalid'); }); });
  }

  schedule();
})();

/* ---------- PRO-FILI: home del festival ----------
   Conto alla rovescia (#conto) e tab dei giorni (#programma). Tutto parte da
   HTML che senza script resta leggibile: il conto mostra la data, i tre
   pannelli del programma restano visibili uno sotto l'altro. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function giorno(iso) { var p = iso.split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  var oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  // le date del festival stanno su #conto: le usa anche il programma qui sotto
  var conto = document.getElementById('conto');
  var da = conto ? giorno(conto.getAttribute('data-da')) : null;
  var a = conto ? giorno(conto.getAttribute('data-a')) : null;
  // Conto alla rovescia, lo stesso della fascia PRO-FILI sul sito di IANUA: giorni, ore,
  // minuti e secondi. Le cifre che cambiano scorrono (la vecchia esce in alto, la nuova
  // entra dal basso); le altre restano ferme. Il controllo gira a ogni fotogramma ma
  // ridisegna solo quando cambia il secondo. Il gruppo e' aria-hidden: la data per esteso
  // sta in un .sr-only accanto. Senza script resta scritto «Si apre 9 ottobre 2026».
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

  // Tab dei giorni, schema ARIA con attivazione automatica.
  var lista = document.querySelector('.gg-tabs');
  if (!lista) return;
  var tabs = Array.prototype.slice.call(lista.querySelectorAll('[role="tab"]'));
  var pann = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
  if (!tabs.length || pann.indexOf(null) !== -1) return;

  function scegli(i, fuoco) {
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      pann[k].hidden = !on;
      pann[k].classList.remove('gg-in');
    });
    if (!reduce) { void pann[i].offsetWidth; pann[i].classList.add('gg-in'); }
    if (fuoco) tabs[i].focus();
  }

  var primo = 0;
  if (da && a && oggi >= da && oggi <= a) primo = Math.min(Math.round((oggi - da) / 86400000), tabs.length - 1);
  pann.forEach(function (p) { p.tabIndex = 0; });
  lista.hidden = false;
  if (pann[0].parentNode) pann[0].parentNode.classList.add('gg-box--tabs');
  scegli(primo, false);
  pann[primo].classList.remove('gg-in');

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { scegli(i, false); });
    t.addEventListener('keydown', function (e) {
      var k = -1, last = tabs.length - 1;
      if (e.key === 'ArrowRight') k = i === last ? 0 : i + 1;
      else if (e.key === 'ArrowLeft') k = i === 0 ? last : i - 1;
      else if (e.key === 'Home') k = 0;
      else if (e.key === 'End') k = last;
      if (k < 0) return;
      e.preventDefault();
      scegli(k, true);
    });
  });
})();

/* ---------- PRO-FILI: filo a colori, tinte degli artisti, frecce ----------
   Il filo nasce nel rosso del logo e gira sulla ruota delle sei tinte: rosso, arancio,
   oro, verde, blu, viola. I colori sono distribuiti sulla LUNGHEZZA del tracciato,
   non su un asse dello spazio: con un gradiente dall'alto in basso la griglia, piu'
   larga che alta, restava tutta sui primi colori. Per questo il filo colorato e'
   fatto di tratti brevi (.filo-tratto), ognuno con il colore del suo punto medio lungo
   il percorso; .line resta il tracciato del motore (lunghezza, avanzamento con lo
   scroll, posizione del capo) ma non si vede. Ogni tratto mostra la parte di se' che
   il motore ha gia' disegnato: si legge lo stroke-dashoffset di .line. .flow copre
   tutto il percorso fin dall'inizio e resta neutro (CSS), altrimenti mostrerebbe i
   colori della fine prima che il filo ci arrivi.
   Fra una tinta e l'altra si sfuma in OKLCH, non in sRGB: in sRGB, fra tinte lontane,
   il colore di mezzo diventa grigio, e il filo si spegneva proprio nei passaggi.
   Il capo prende il colore del punto del tracciato in cui si trova, e ogni artista
   prende l'inchiostro della tinta del filo nel punto dove sta il suo ritratto.
   I colori si leggono dai token --f-* del CSS: stanno scritti in un posto solo.
   Il motore del filo resta quello sopra: qui si osserva soltanto quello che scrive
   (il tracciato 'd', il dashoffset e la posizione del capo), senza cicli propri.
   Da tastiera: un solo ritratto nel giro del Tab, le frecce passano al precedente
   e al successivo, Home ed End al primo e all'ultimo. Il focus fa tendere il filo
   come il mouse, perche' il motore ascolta gia' focusin. */
(function () {
  'use strict';
  if (!document.body || !document.body.classList.contains('carta')) return;
  var NS = 'http://www.w3.org/2000/svg';
  var stile = getComputedStyle(document.body);
  var COL = ['rosso', 'arancio', 'oro', 'verde', 'blu', 'viola'].map(function (n) {
    return stile.getPropertyValue('--f-' + n).trim();
  });
  var ok = COL.every(function (c) { return /^#[0-9a-f]{6}$/i.test(c); });

  // sRGB <-> OKLCH (Bjorn Ottosson). Serve a sfumare le tinte senza passare dal grigio.
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function enc(c) { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, c)) * 255); }
  function hex2lch(h) {
    var r = lin(parseInt(h.slice(1, 3), 16)), g = lin(parseInt(h.slice(3, 5), 16)), b = lin(parseInt(h.slice(5, 7), 16));
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    var L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    var A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    var B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return [L, Math.sqrt(A * A + B * B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
  }
  function lch2rgb(L, C, H) {
    for (var k = 0; k < 40; k++) {   // se la tinta esce dallo spazio sRGB si abbassa il croma, non si taglia il canale
      var a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
      var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
      var m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
      var s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
      var r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
      var g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
      var bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
      if ((r >= -0.001 && r <= 1.001 && g >= -0.001 && g <= 1.001 && bb >= -0.001 && bb <= 1.001) || C <= 0.002) return [enc(r), enc(g), enc(bb)];
      C *= 0.95;
    }
    return [enc(r), enc(g), enc(bb)];
  }
  var LCH = ok ? COL.map(hex2lch) : [];
  // tinta alla posizione t (0-1) lungo il filo, in [L, C, H]. Le tonalita' della ruota
  // crescono sempre (29 -> 318), quindi la sfumatura va dritta senza tornare indietro.
  function lchAt(t) {
    t = Math.min(1, Math.max(0, t)) * (LCH.length - 1);
    var i = Math.min(Math.floor(t), LCH.length - 2), f = t - i, a = LCH[i], b = LCH[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  function colore(t) { var c = lchAt(t), v = lch2rgb(c[0], c[1], c[2]); return 'rgb(' + v.join(',') + ')'; }
  // la stessa tinta scurita per il testo: luminosita' 0.44 regge 4.5:1 sulla carta
  function inchiostro(t) { var c = lchAt(t), v = lch2rgb(0.44, Math.min(c[1], 0.13), c[2]); return 'rgb(' + v.join(',') + ')'; }
  if (ok) window.pfFilo = { colore: colore, inchiostro: inchiostro };

  // il campionatore veloce sta accanto al motore del filo (sezione 7): lo usano tutti e due
  var campiona = window.pfCampiona;
  document.querySelectorAll('.thread').forEach(function (th) {
    var svg = th.querySelector('svg'), line = svg && svg.querySelector('.line');
    if (line && ok) {
      var bead = svg.querySelector('.bead');
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'filo-tinte');
      line.parentNode.insertBefore(g, line.nextSibling);
      line.style.visibility = 'hidden';
      var tratti = [], campioni = [], L = 0, fatto = '';
      var costruisci = function () {
        if (!line.getAttribute('d')) return;
        try { L = line.getTotalLength(); } catch (e) { return; }
        while (g.firstChild) g.removeChild(g.firstChild);
        tratti = []; campioni = []; fatto = '';
        if (!L) return;
        var passo = 3, lung = Math.max(24, L / 160), s0 = 0;
        campioni = campiona(line.getAttribute('d'), passo, L);
        if (!campioni.length) return;
        while (s0 < L) {
          var s1 = Math.min(L, s0 + lung), d = '', n = 0;
          // i campioni sono ordinati e a passo costante: l'intervallo si trova per indice
          var i0 = Math.max(0, Math.floor((s0 - passo) / passo)), i1 = Math.min(campioni.length - 1, Math.ceil((s1 + passo) / passo));
          for (var ci = i0; ci <= i1; ci++) {
            var c = campioni[ci];
            if (c[2] >= s0 - passo && c[2] <= s1 + passo) { d += (n++ ? ' L ' : 'M ') + c[0].toFixed(1) + ' ' + c[1].toFixed(1); }
          }
          var el = document.createElementNS(NS, 'path');
          el.setAttribute('class', 'filo-tratto');
          el.setAttribute('d', d);
          el.style.stroke = colore(((s0 + s1) / 2) / L);
          g.appendChild(el);
          tratti.push({ el: el, s0: s0, s1: s1, len: 0, stato: '' });
          s0 = s1;
        }
        tratti.forEach(function (t) { t.len = t.el.getTotalLength(); });
        tingi(); mostra(); capo();
      };
      // ogni ritratto prende l'inchiostro della tinta del filo nel punto dove il filo lo
      // attraversa: passandoci sopra, il nome si accende dello stesso colore del filo.
      // Si ricalcola a ogni nuovo tracciato, quindi e' giusto a ogni larghezza.
      var tingi = function () {
        if (!campioni.length) return;
        var sr = svg.getBoundingClientRect(), vb = svg.viewBox && svg.viewBox.baseVal;
        var sx = vb && vb.width ? vb.width / sr.width : 1, sy = vb && vb.height ? vb.height / sr.height : 1;
        th.querySelectorAll('[data-knot]').forEach(function (k) {
          var p = k.closest('.person'); if (!p) return;
          var r = k.getBoundingClientRect();
          var x = (r.left + r.width / 2 - sr.left) * sx, y = (r.top + r.height / 2 - sr.top) * sy;
          var best = 0, bd = Infinity;
          for (var i = 0; i < campioni.length; i++) {
            var dx = campioni[i][0] - x, dy = campioni[i][1] - y, d2 = dx * dx + dy * dy;
            if (d2 < bd) { bd = d2; best = campioni[i][2]; }
          }
          p.style.setProperty('--tinta', inchiostro(best / L));
        });
      };
      // quanto filo ha disegnato il motore: L meno lo stroke-dashoffset di .line
      var mostra = function () {
        if (!tratti.length) return;
        var off = parseFloat(line.style.strokeDashoffset);
        var vis = isNaN(off) ? L : Math.max(0, Math.min(L, L - off));
        var chiave = vis.toFixed(1);
        if (chiave === fatto) return;
        fatto = chiave;
        tratti.forEach(function (t) {
          var qui = vis >= t.s1 ? 'tutto' : vis <= t.s0 ? 'niente' : 'parte';
          if (qui === 'parte') {
            var v = t.len * (vis - t.s0) / (t.s1 - t.s0);
            t.el.style.visibility = ''; t.el.style.strokeDasharray = v.toFixed(1) + ' ' + (t.len + 2).toFixed(1); t.el.style.strokeDashoffset = '0';
          } else if (qui !== t.stato) {
            t.el.style.visibility = qui === 'tutto' ? '' : 'hidden';
            t.el.style.strokeDasharray = ''; t.el.style.strokeDashoffset = '';
          }
          t.stato = qui;
        });
      };
      var capo = function () {
        if (!bead || !campioni.length) return;
        var x = parseFloat(bead.getAttribute('cx')), y = parseFloat(bead.getAttribute('cy'));
        if (isNaN(x) || isNaN(y)) return;
        var best = 0, bd = Infinity;
        for (var i = 0; i < campioni.length; i++) {
          var dx = campioni[i][0] - x, dy = campioni[i][1] - y, d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = campioni[i][2]; }
        }
        bead.style.fill = colore(best / L);
      };
      costruisci();
      if ('MutationObserver' in window) {
        new MutationObserver(function (m) {
          if (m.some(function (r) { return r.attributeName === 'd'; })) costruisci(); else mostra();
        }).observe(line, { attributes: true, attributeFilter: ['d', 'style'] });
        if (bead) new MutationObserver(capo).observe(bead, { attributes: true, attributeFilter: ['cx', 'cy'] });
      }
    }

    // roving tabindex sui ritratti legati al filo
    var gente = [];
    th.querySelectorAll('[data-knot]').forEach(function (k) {
      var p = k.closest('.person');
      if (p && p.matches('a[href]') && gente.indexOf(p) < 0) gente.push(p);
    });
    if (gente.length < 2) return;
    function giro(i) { gente.forEach(function (p, k) { p.tabIndex = k === i ? 0 : -1; }); }
    giro(0);
    gente.forEach(function (p, i) {
      p.addEventListener('focus', function () { giro(i); });
      p.addEventListener('keydown', function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        var k = -1, last = gente.length - 1;
        if (e.key === 'ArrowRight') k = Math.min(i + 1, last);
        else if (e.key === 'ArrowLeft') k = Math.max(i - 1, 0);
        else if (e.key === 'Home') k = 0;
        else if (e.key === 'End') k = last;
        if (k < 0) return;
        e.preventDefault();
        if (k !== i) gente[k].focus();
      });
    });
  });
})();

/* ---------- PRO-FILI: il programma sa che ora e' ----------
   Solo fra il primo e l'ultimo giorno del festival (#conto, data-da / data-a):
   - il tab del giorno di oggi prende .is-oggi e l'etichetta «oggi», i giorni gia'
     passati prendono .is-passato (i tab dichiarano data-giorno="AAAA-MM-GG");
   - ogni article.app con data-inizio="AAAA-MM-GGTHH:MM" (ora locale) prende .is-ora
     mentre e' in corso, .is-passato quando e' finito; il primo in arrivo prende
     .is-poi. La durata e' di 90 minuti se l'appuntamento non dichiara data-durata
     (in minuti). Per un orario nuovo basta aggiungere data-inizio nell'HTML.
   Fuori dalle date non si attiva niente. Durante il festival un solo timer punta al
   prossimo cambio (inizio, fine, mezzanotte): nessun controllo a vuoto. */
(function () {
  'use strict';
  var conto = document.getElementById('conto');
  if (!conto) return;
  function giorno(iso) { var p = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return p ? new Date(+p[1], p[2] - 1, +p[3]) : null; }
  function istante(iso) { var p = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || ''); return p ? new Date(+p[1], p[2] - 1, +p[3], +p[4], +p[5]) : null; }
  function dopo(d, giorni) { var x = new Date(d.getTime()); x.setDate(x.getDate() + giorni); return x; }
  var da = giorno(conto.getAttribute('data-da')), a = giorno(conto.getAttribute('data-a'));
  if (!da || !a) return;
  var fine = dopo(a, 1);                                  // mezzanotte dopo l'ultimo giorno
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.gg-tab[data-giorno]'));
  var apps = Array.prototype.slice.call(document.querySelectorAll('.app[data-inizio]'));
  if (!tabs.length && !apps.length) return;
  var timer = null;

  function pulisci() {
    tabs.forEach(function (t) {
      t.classList.remove('is-oggi', 'is-passato');
      var e = t.querySelector('.gg-oggi'); if (e) e.parentNode.removeChild(e);
    });
    apps.forEach(function (ap) {
      ap.classList.remove('is-ora', 'is-poi', 'is-passato'); ap.removeAttribute('aria-current');
      var e = ap.querySelector('.app-stato'); if (e) e.parentNode.removeChild(e);
    });
  }

  function aggiorna() {
    clearTimeout(timer); timer = null;
    var ora = new Date();
    pulisci();
    if (ora < da) {                                       // se l'apertura e' entro un giorno, ci si risveglia li'
      if (da - ora < 864e5) timer = setTimeout(aggiorna, da - ora + 1000);
      return;
    }
    if (ora >= fine) return;
    var oggi = new Date(ora.getFullYear(), ora.getMonth(), ora.getDate());
    var prossimo = Math.min(dopo(oggi, 1).getTime(), fine.getTime());
    tabs.forEach(function (t) {
      var d = giorno(t.getAttribute('data-giorno')); if (!d) return;
      if (d.getTime() === oggi.getTime()) {
        t.classList.add('is-oggi');
        var e = document.createElement('span'); e.className = 'gg-oggi'; e.textContent = 'oggi';
        t.appendChild(e);
      } else if (d < oggi) t.classList.add('is-passato');
    });
    var poi = null, inArrivo = [];
    apps.forEach(function (ap) {
      var s = istante(ap.getAttribute('data-inizio')); if (!s) return;
      var dur = parseInt(ap.getAttribute('data-durata'), 10);
      var e = new Date(s.getTime() + (dur > 0 ? dur : 90) * 60000);
      if (ora >= e) ap.classList.add('is-passato');
      else if (ora >= s) { ap.classList.add('is-ora'); ap.setAttribute('aria-current', 'time'); prossimo = Math.min(prossimo, e.getTime()); }
      else {
        inArrivo.push([ap, s.getTime()]);
        if (poi === null || s.getTime() < poi) poi = s.getTime();
        prossimo = Math.min(prossimo, s.getTime());
      }
    });
    inArrivo.forEach(function (x) { if (x[1] === poi) x[0].classList.add('is-poi'); });
    // l'appuntamento in corso e il prossimo si distinguevano solo col colore: ora hanno
    // anche un'etichetta scritta, accanto all'ora, come «oggi» sul giorno
    apps.forEach(function (ap) {
      var testo = ap.classList.contains('is-ora') ? 'in corso' : ap.classList.contains('is-poi') ? 'a seguire' : '';
      var ora2 = ap.querySelector('.app-ora');
      if (!testo || !ora2) return;
      var e = document.createElement('span'); e.className = 'app-stato'; e.textContent = testo;
      ora2.appendChild(e);
    });
    timer = setTimeout(aggiorna, Math.max(prossimo - ora.getTime(), 0) + 1000);
  }

  aggiorna();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) aggiorna(); });
})();

/* ---------- PRO-FILI: il filo dell'apertura ----------
   Il primo sguardo sul sito: un filo esce dal logo, fa due giri di matassa nello spazio
   vuoto accanto al titolo passando per tutte e sei le tinte, e scende fino al bordo
   basso dell'apertura, come se continuasse nella pagina. Si disegna una volta sola,
   all'apertura: una maschera scopre i tratti colorati in 2,8 secondi con un'uscita
   morbida, e il capo del filo corre davanti prendendo il colore del punto in cui si
   trova. Con prefers-reduced-motion il filo e' gia' disegnato e il capo sta in fondo.
   Il tracciato si calcola sulle misure vere dei testi dell'apertura e si controlla
   punto per punto: se una parte cadrebbe su un testo (al telefono accanto al titolo
   non c'e' posto), il filo passa invece nella fascia libera sotto il conto alla
   rovescia, con un giro solo. Ricalcolato quando cambia la larghezza, senza ripartire. */
(function () {
  'use strict';
  var hero = document.getElementById('soglia');
  if (!hero || !window.pfFilo || !document.body.classList.contains('carta')) return;
  // con la matassa in apertura (assets/js/matassa.js) il filo e' gia' la lana: qui niente
  // filo colorato, che riparte piu' giu' con gli artisti
  if (document.getElementById('matassa')) return;
  var NS = 'http://www.w3.org/2000/svg';
  var ridotto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DUR = 2800, RIT = 450, animato = false;
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'soglia-filo');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  hero.insertBefore(svg, hero.firstChild);

  // ingombro VERO di un elemento: l'unione delle sue righe di testo e dei suoi figli.
  // La riga dei dati, i tasti e il conto alla rovescia sono blocchi larghi tutta la
  // colonna anche dove non c'e' niente: col loro riquadro lo spazio libero sembrava pieno.
  function box(el) {
    if (!el || el.hidden) return null;
    var h = hero.getBoundingClientRect(), rg = document.createRange();
    rg.selectNodeContents(el);
    var rs = Array.prototype.filter.call(rg.getClientRects(), function (r) { return r.width > 0 && r.height > 0; });
    if (!rs.length) { var r0 = el.getBoundingClientRect(); if (!r0.width) return null; rs = [r0]; }
    var l = Infinity, tp = Infinity, rt = -Infinity, bt = -Infinity;
    rs.forEach(function (r) { l = Math.min(l, r.left); tp = Math.min(tp, r.top); rt = Math.max(rt, r.right); bt = Math.max(bt, r.bottom); });
    return { l: l - h.left, t: tp - h.top, r: rt - h.left, b: bt - h.top, w: rt - l, h: bt - tp };
  }
  function bez(out, p0, p1, p2, p3) {
    var n = Math.max(8, Math.ceil(Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) / 6));
    for (var j = 1; j <= n; j++) {
      var t = j / n, m = 1 - t;
      out.push([m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
                m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]]);
    }
  }
  // un giro di matassa: cicloide allungata, stessa forma dei giri sui ritratti
  // s = 1 il giro parte dal basso, s = -1 dall'alto
  function giro(out, cx, cy, r, a, s) {
    for (var st = 0; st <= 48; st++) {
      var u = -Math.PI + st * Math.PI / 24;
      out.push([cx + (a * u - r * Math.sin(u)), cy - s * r * Math.cos(u)]);
    }
  }
  function tocca(pts, rects) {
    for (var i = 0; i < pts.length; i += 2) {
      for (var k = 0; k < rects.length; k++) {
        var q = rects[k];
        if (pts[i][0] > q.l - 18 && pts[i][0] < q.r + 18 && pts[i][1] > q.t - 14 && pts[i][1] < q.b + 14) return true;
      }
    }
    return false;
  }

  function tracciato() {
    var W = hero.clientWidth, H = hero.clientHeight;
    var logo = box(hero.querySelector('.pf-logo')), h1 = box(hero.querySelector('h1')),
        sub = box(hero.querySelector('.sub')), meta = box(hero.querySelector('.meta')),
        az = box(hero.querySelector('.ag-actions')), conto = box(document.getElementById('conto'));
    var testi = [logo, h1, sub, meta, az, conto].filter(Boolean);
    var nav = document.querySelector('.nav'), navH = nav ? nav.offsetHeight : 64;
    var pts = null;
    // 1) accanto al titolo, nello spazio vuoto a destra: esce dal logo alla sua altezza,
    //    entra nel primo giro dall'alto (cosi' resta sopra il titolo), poi il secondo giro
    //    piu' in basso e la discesa fino al bordo dell'apertura
    if (logo && h1) {
      // Un giro di raggio r e avanzamento 0.34r occupa in larghezza 2.14r (dal punto
      // d'ingresso a quello d'uscita), alto 2r. I due giri stanno quasi alla stessa altezza,
      // il secondo un po' piu' basso e staccato di 0.6R: il raccordo scende di mezzo raggio
      // su uno spazio piu' largo, senza angoli. Spazio che serve: 4.45R + 70 di discesa.
      var x0 = Math.max(logo.r, h1.r, sub ? sub.r : 0) + 64, lim = W - 28;
      var R = Math.min(88, (lim - x0 - 70) / 4.45);
      if (R >= 40) {
        pts = [];
        var r2 = R * 0.8, a1 = R * 0.34, a2 = r2 * 0.34;
        // 0.39: l'altezza della linea che nel logo unisce «Pro» e «fili», col suo nodo
        var y0 = logo.t + logo.h * 0.39, start = [logo.r + 12, y0];
        var c1 = [x0 + 1.07 * R, y0 + R], c2 = [c1[0] + 1.07 * R + 0.6 * R + 1.07 * r2, c1[1] + R * 0.3];
        var s1 = [c1[0] - a1 * Math.PI, c1[1] - R], e1 = [c1[0] + a1 * Math.PI, c1[1] - R];
        var s2 = [c2[0] - a2 * Math.PI, c2[1] - r2], e2 = [c2[0] + a2 * Math.PI, c2[1] - r2];
        var giu = [Math.min(lim, e2[0] + 64), H + 4], dx = s1[0] - start[0], gap = s2[0] - e1[0];
        pts.push(start);
        // dal logo al primo giro il filo pende appena, come un filo teso a mano
        bez(pts, start, [start[0] + dx * 0.3, y0 + Math.min(26, dx * 0.05)], [s1[0] - dx * 0.35, y0], s1);
        giro(pts, c1[0], c1[1], R, a1, -1);
        bez(pts, e1, [e1[0] + gap * 0.55, e1[1]], [s2[0] - gap * 0.55, s2[1]], s2);
        giro(pts, c2[0], c2[1], r2, a2, -1);
        bez(pts, e2, [e2[0] + (giu[0] - e2[0]) * 0.9, e2[1]], [giu[0], e2[1] + (giu[1] - e2[1]) * 0.25], giu);
        if (tocca(pts.slice(4), testi.filter(function (q) { return q !== logo; }))) pts = null;
      }
    }
    // una fascia orizzontale da bordo a bordo con un giro solo, fra y1 e y2
    function fascia(y1, y2) {
      var y = (y1 + y2) / 2, rr = Math.min(30, (y2 - y1) / 2 - 16);
      if (rr < 12) return null;
      var cx = W * 0.64, aa = rr * 0.34, ps = cx - aa * Math.PI, pe = cx + aa * Math.PI, q = [[-8, y - rr]];
      bez(q, [-8, y - rr], [W * 0.28, y - rr], [ps - 50, y + rr], [ps, y + rr]);
      giro(q, cx, y, rr, aa, 1);
      bez(q, [pe, y + rr], [pe + 50, y + rr], [W * 0.84, y - rr], [W + 8, y - rr]);
      return tocca(q, testi) ? null : q;
    }
    // 2) ripiego: sotto il conto alla rovescia (o sotto l'ultimo testo)
    if (!pts) { var sotto = conto || az || meta || sub || h1; if (sotto) pts = fascia(sotto.b, H); }
    // 3) al telefono sotto non c'e' posto: sopra il logo, sotto la barra
    if (!pts && logo) pts = fascia(navH, logo.t);
    if (!pts) return null;
    // ricampionamento a passo costante
    var out = [pts[0]], STEP = 4, carry = 0;
    for (var i = 1; i < pts.length; i++) {
      var ax = pts[i - 1][0], ay = pts[i - 1][1], bx = pts[i][0], by = pts[i][1];
      var seg = Math.hypot(bx - ax, by - ay); if (!seg) continue;
      var pos = STEP - carry;
      while (pos <= seg) { out.push([ax + (bx - ax) * pos / seg, ay + (by - ay) * pos / seg]); pos += STEP; }
      carry = seg - (pos - STEP);
    }
    return out;
  }

  var uid = 'soglia-mask-' + Math.random().toString(36).slice(2, 7);
  function disegna(conAnimazione) {
    var pts = tracciato();
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!pts || pts.length < 4) { svg.style.display = 'none'; return; }
    svg.style.display = '';
    var W = hero.clientWidth, H = hero.clientHeight;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var d = 'M ' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L ');
    var defs = document.createElementNS(NS, 'defs'), mask = document.createElementNS(NS, 'mask');
    mask.setAttribute('id', uid); mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('x', '-20'); mask.setAttribute('y', '-20'); mask.setAttribute('width', W + 40); mask.setAttribute('height', H + 40);
    var mp = document.createElementNS(NS, 'path');
    mp.setAttribute('d', d); mp.setAttribute('class', 'soglia-maschera');
    mask.appendChild(mp); defs.appendChild(mask); svg.appendChild(defs);
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('mask', 'url(#' + uid + ')');
    // tratti colorati: ogni ~10 px una tinta nuova, sovrapposti di un punto per non lasciare fessure
    var n = pts.length, passo = 3;
    for (var i = 0; i < n - 1; i += passo) {
      var seg = pts.slice(i, Math.min(n, i + passo + 1));
      var el = document.createElementNS(NS, 'path');
      el.setAttribute('d', 'M ' + seg.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L '));
      el.setAttribute('class', 'soglia-tratto');
      el.style.stroke = window.pfFilo.colore((i + passo / 2) / (n - 1));
      g.appendChild(el);
    }
    svg.appendChild(g);
    var capo = document.createElementNS(NS, 'circle');
    capo.setAttribute('class', 'soglia-capo'); capo.setAttribute('r', '5');
    svg.appendChild(capo);
    var L = mp.getTotalLength();
    mp.style.strokeDasharray = L + ' ' + (L + 10);
    function metti(p) {   // p: quanta parte del filo e' disegnata, 0-1
      mp.style.strokeDashoffset = (L * (1 - p)).toFixed(1);
      var q = pts[Math.min(pts.length - 1, Math.round(p * (pts.length - 1)))];   // i punti sono a passo costante
      capo.setAttribute('cx', q[0].toFixed(1)); capo.setAttribute('cy', q[1].toFixed(1));
      capo.style.fill = window.pfFilo.colore(p);
      capo.style.opacity = p > 0.002 ? '1' : '0';
    }
    if (!conAnimazione || ridotto) { metti(1); return; }
    metti(0);
    // Il tempo si accumula fotogramma per fotogramma, con un massimo di 50 ms per passo:
    // se il browser si ferma (caricamento, scheda in secondo piano) l'animazione riprende
    // da dove era. Col tempo dell'orologio saltava direttamente al filo finito.
    var tempo = 0, prima = null;
    function ease(x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); }   // uscita esponenziale
    function passo2(ts) {
      if (prima !== null) tempo += Math.min(50, ts - prima);
      prima = ts;
      var x = (tempo - RIT) / DUR;
      if (x < 0) { requestAnimationFrame(passo2); return; }
      metti(Math.min(1, ease(Math.min(1, x)) / ease(1)));
      if (x < 1) requestAnimationFrame(passo2);
    }
    requestAnimationFrame(passo2);
  }

  function parti() {
    if (animato) return;
    animato = true;
    disegna(true);
  }
  // si aspettano i caratteri: prima le misure dei testi non sono quelle vere
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(parti); else window.addEventListener('load', parti);
  setTimeout(parti, 1500);
  var lw = window.innerWidth, tmo = null;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lw) return;   // al telefono la barra degli indirizzi cambia l'altezza: non si ridisegna
    lw = window.innerWidth;
    clearTimeout(tmo);
    tmo = setTimeout(function () { disegna(false); }, 180);
  });
})();


/* ─────────────────────────────────────────────────────────────────────────────
   Locandina del programma.
   Il tasto e' gia' nell'HTML ma parte nascosto: qui si cerca il file e, se
   c'e' davvero, si accende. Per pubblicarla basta caricare il file in
   assets/locandina/ con nome programma.pdf oppure programma.jpg.
   Nessuna modifica al codice. Finche' il file manca non si vede niente,
   cosi' non resta in pagina un collegamento rotto.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var box = document.getElementById('locandina');
  if (!box || !window.fetch) return;
  var base = box.getAttribute('data-loc-base') || 'assets/locandina/';
  var nomi = ['programma.pdf', 'programma.jpg'];   // due tentativi, non di piu': ogni file assente e' un 404 in console

  function accendi(url) {
    var apri = document.getElementById('loc-apri');
    if (!apri) return;
    apri.href = url;
    box.hidden = false;
  }

  (function prova(i) {
    if (i >= nomi.length) return;                       // nessuna locandina: il tasto resta invisibile
    var url = base + nomi[i];
    fetch(url, { method: 'HEAD' }).then(function (r) {
      // la pagina di errore di Netlify torna 404, ma un file assente servito
      // come HTML non deve mai accendere il tasto: si controlla anche il tipo
      var tipo = r.headers.get('content-type') || '';
      if (r.ok && tipo.indexOf('text/html') === -1) accendi(url);
      else prova(i + 1);
    }).catch(function () { prova(i + 1); });
  })(0);
})();
