/* ---------- PRO-FILI: la matassa dell'apertura ----------
   Prima dell'apertura c'e' un palco fisso (#matassa) con una foto: una matassa di lana
   rossa e tre profili di carta nera. Mentre la pagina scorre, il filo di lana della foto
   ricompare pezzo per pezzo nell'ordine in cui si srotola: parte dalla matassa (che
   gira), lega il primo profilo, passa dietro la nuca, lega il secondo e il terzo ed
   esce dal fondo del palco. Li' sotto l'apertura fa partire il filo colorato, dallo
   stesso punto e con lo stesso spessore (window.pfFiloUscita, window.pfLanaPx).
   Le tre immagini (assets/img/matassa/):
   - base.webp: la foto senza filo;
   - filo.webp: solo il filo, con la trasparenza;
   - tempo.png: per ogni pixel del filo, quando ricompare (0 = alla matassa, 1 = in
     fondo), in 16 bit: rosso = byte alto, verde = byte basso.
   Con prefers-reduced-motion il palco e' alto uno schermo e il filo e' gia' tutto. */
(function () {
  'use strict';
  var palco = document.getElementById('matassa');
  if (!palco) return;
  var tela = palco.querySelector('.matassa-tela');
  var cBase = document.getElementById('matassa-base');
  var cFilo = document.getElementById('matassa-filo');
  if (!tela || !cBase || !cFilo || !cBase.getContext) { palco.classList.add('senza-3d'); return; }
  var ridotto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 1344, H = 752;                    // pixel della foto
  var PALLA = { x: 133, y: 68, r: 73 };     // la matassa: centro e raggio
  var USCITA = { x: 672, largo: 16 };       // dove il filo tocca il fondo della foto
  var PUNTA = 3 / 2594;                     // il capo: 3 px di sfumatura su tutto il percorso
  var DIR = 'assets/img/matassa/';

  // Al telefono la foto e' piu' larga dello schermo e scorre di lato seguendo il capo
  // del filo, come una telecamera; alla fine il capo e' al centro, sopra l'uscita.
  var scia = null;   // dove si trova il capo (x nella foto) lungo il percorso, 0-1
  function sposta(x, s, vw, tw) { return Math.min(0, Math.max(vw - tw, vw / 2 - x * s)); }

  // dove esce il filo, in frazione della larghezza della pagina, e quanto e' spesso
  function misura() {
    var vw = document.documentElement.clientWidth, tw = tela.offsetWidth, s = tw / W;
    var sx = tw > vw + 1 ? sposta(USCITA.x, s, vw, tw) : tela.offsetLeft;
    window.pfFiloUscita = (sx + USCITA.x * s) / vw;
    var px = USCITA.largo * s;
    if (Math.abs((window.pfLanaPx || 0) - px) >= 0.5) {
      window.pfLanaPx = px;
      window.dispatchEvent(new Event('pf-lana'));
    }
  }
  misura();
  window.addEventListener('resize', misura);

  function carica(src) {
    return new Promise(function (ok, ko) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = ko; i.src = src; });
  }
  function pixel(img) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, W, H).data;
  }

  Promise.all([carica(DIR + 'base.webp'), carica(DIR + 'filo.webp'), carica(DIR + 'tempo.png')]).then(function (r) {
    var base = r[0], fp = pixel(r[1]), tp = pixel(r[2]);
    var cb = cBase.getContext('2d'), cf = cFilo.getContext('2d');
    var out = cf.createImageData(W, H), od = out.data;
    // solo i pixel del filo: dove sono, quanto sono pieni, quando ricompaiono
    var idx = [], a0 = [], tt = [];
    for (var i = 0, n = W * H; i < n; i++) {
      var k = i * 4, a = fp[k + 3];
      if (!a) continue;
      od[k] = fp[k]; od[k + 1] = fp[k + 1]; od[k + 2] = fp[k + 2];
      idx.push(k + 3); a0.push(a); tt.push((tp[k] * 256 + tp[k + 1]) / 65535);
    }
    var N = idx.length, ultimo = -1, visibile = true;

    // la scia del capo: la x media dei pixel che ricompaiono in ogni tratto del percorso,
    // riempita dove il filo passa dietro le teste e ammorbidita
    var B = 240, sx = new Float32Array(B), sn = new Float32Array(B);
    for (var q = 0; q < N; q++) {
      var b0 = Math.min(B - 1, Math.floor(tt[q] * B));
      sx[b0] += ((idx[q] - 3) / 4) % W; sn[b0]++;
    }
    var grezza = [], prima = -1;
    for (var b1 = 0; b1 < B; b1++) {
      if (sn[b1]) {
        grezza[b1] = sx[b1] / sn[b1];
        if (prima >= 0) for (var g = prima + 1; g < b1; g++) grezza[g] = grezza[prima] + (grezza[b1] - grezza[prima]) * (g - prima) / (b1 - prima);
        else for (var g2 = 0; g2 < b1; g2++) grezza[g2] = grezza[b1];
        prima = b1;
      }
    }
    for (var b2 = prima + 1; b2 < B; b2++) grezza[b2] = grezza[prima];
    scia = [];
    for (var b3 = 0; b3 < B; b3++) {
      var tot = 0, cnt = 0;
      for (var d = -14; d <= 14; d++) { var e = Math.min(B - 1, Math.max(0, b3 + d)); tot += grezza[e]; cnt++; }
      scia.push(tot / cnt);
    }
    scia[B - 1] = USCITA.x;

    function progresso() {
      if (ridotto) return 1;
      var b = palco.getBoundingClientRect(), corsa = b.height - window.innerHeight;
      return corsa > 0 ? Math.min(1, Math.max(0, -b.top / corsa)) : 1;
    }
    function disegna() {
      var p = progresso();
      if (Math.abs(p - ultimo) < 0.0004) return;
      ultimo = p;
      // la matassa gira mentre si srotola
      cb.drawImage(base, 0, 0);
      cb.save();
      cb.beginPath(); cb.arc(PALLA.x, PALLA.y, PALLA.r, 0, Math.PI * 2); cb.clip();
      cb.translate(PALLA.x, PALLA.y); cb.rotate(-p * Math.PI * 1.6); cb.translate(-PALLA.x, -PALLA.y);
      cb.drawImage(base, 0, 0);
      cb.restore();
      // il filo: tutto quello che e' gia' uscito, con un capo netto
      var T = p * (1 + PUNTA);
      for (var j = 0; j < N; j++) {
        var f = (T - tt[j]) / PUNTA;
        od[idx[j]] = f >= 1 ? a0[j] : f <= 0 ? 0 : a0[j] * f;
      }
      cf.putImageData(out, 0, 0);
      var vw = document.documentElement.clientWidth, tw = tela.offsetWidth;
      if (tw > vw + 1) {
        var u = p * (scia.length - 1), i0 = Math.floor(u), i1 = Math.min(scia.length - 1, i0 + 1);
        var x = scia[i0] + (scia[i1] - scia[i0]) * (u - i0);
        if (p > 0.9) x += (USCITA.x - x) * (p - 0.9) / 0.1;   // in fondo il capo va dritto all'uscita
        tela.style.transform = 'translateX(' + sposta(x, tw / W, vw, tw).toFixed(1) + 'px)';
      } else tela.style.transform = '';
      palco.style.setProperty('--scorri', p < 0.04 ? 1 : 0);
    }
    var attesa = false;
    function suScroll() {
      if (attesa || !visibile) return;
      attesa = true;
      requestAnimationFrame(function () { attesa = false; disegna(); });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (v) { visibile = v[0].isIntersecting; if (visibile) suScroll(); }).observe(palco);
    }
    window.addEventListener('scroll', suScroll, { passive: true });
    window.addEventListener('resize', suScroll);
    palco.classList.add('pronta');
    disegna();
  }, function () { palco.classList.add('senza-3d'); });
})();
