/* ---------- PRO-FILI: la matassa dell'apertura ----------
   Prima dell'apertura c'e' un palco fisso (#matassa) con una foto: una matassa di lana
   rossa e tre profili di carta nera. Mentre la pagina scorre, il filo di lana della foto
   ricompare pezzo per pezzo nell'ordine in cui si srotola: parte dalla matassa (che
   gira), lega il primo profilo, passa dietro la nuca, lega il secondo e il terzo,
   scende e scorre via fuori scena a sinistra, mentre la pagina prosegue con l'apertura.
   Due tagli della foto, a doppia risoluzione (assets/img/matassa/): «largo» per gli schermi orizzontali,
   «stretto» per quelli verticali, piu' vicino, con la matassa spostata in alto a sinistra.
   Per ogni taglio tre immagini:
   - base.webp: la foto senza filo;
   - filo.webp: solo il filo, con la trasparenza;
   - tempo.png: per ogni pixel del filo, quando ricompare (0 = alla matassa, 1 = in
     fondo), in 16 bit: rosso = byte alto, verde = byte basso.
   Con prefers-reduced-motion il palco e' alto uno schermo e il filo e' gia' tutto. */
(function () {
  'use strict';
  var palco = document.getElementById('matassa');
  if (!palco) return;
  var cBase = document.getElementById('matassa-base');
  var cFilo = document.getElementById('matassa-filo');
  if (!cBase || !cFilo || !cBase.getContext) { palco.classList.add('senza-3d'); return; }
  var ridotto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var verticale = window.matchMedia ? matchMedia('(max-aspect-ratio: 1/1)') : null;

  // per ogni taglio: misure, la matassa (centro e raggio) e il capo (3 px su tutto il percorso)
  var TAGLI = {
    largo:   { W: 2688, H: 1428, palla: { x: 266, y: 184, r: 146 }, punta: 3 / 3285 },
    stretto: { W: 900,  H: 1428, palla: { x: 174, y: 160, r: 146 }, punta: 3 / 3000 }
  };
  var DIR = 'assets/img/matassa/';
  var scena = null;   // il taglio caricato: immagine di base, pixel del filo, tempi
  var ultimo = -1, visibile = true, attesa = false;

  function carica(src) {
    return new Promise(function (ok, ko) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = ko; i.src = src; });
  }
  function pixel(img, W, H) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, W, H).data;
  }

  function prepara() {
    var nome = verticale && verticale.matches ? 'stretto' : 'largo', T = TAGLI[nome];
    if (scena && scena.nome === nome) return;
    Promise.all([carica(DIR + nome + '-base.webp?v=6'), carica(DIR + nome + '-filo.webp?v=6'), carica(DIR + nome + '-tempo.png?v=6')]).then(function (r) {
      var fp = pixel(r[1], T.W, T.H), tp = pixel(r[2], T.W, T.H);
      cBase.width = cFilo.width = T.W; cBase.height = cFilo.height = T.H;
      var out = cFilo.getContext('2d').createImageData(T.W, T.H), od = out.data;
      // solo i pixel del filo: dove sono, quanto sono pieni, quando ricompaiono
      var idx = [], a0 = [], tt = [];
      for (var i = 0, n = T.W * T.H; i < n; i++) {
        var k = i * 4, a = fp[k + 3];
        if (!a) continue;
        od[k] = fp[k]; od[k + 1] = fp[k + 1]; od[k + 2] = fp[k + 2];
        idx.push(k + 3); a0.push(a); tt.push((tp[k] * 256 + tp[k + 1]) / 65535);
      }
      scena = { nome: nome, T: T, base: r[0], out: out, idx: idx, a0: a0, tt: tt };
      cBase.getContext('2d').drawImage(r[0], 0, 0);
      cFilo.getContext('2d').clearRect(0, 0, T.W, T.H);
      for (var z = 0; z < idx.length; z++) od[idx[z]] = 0;
      palco.setAttribute('data-taglio', nome);
      palco.classList.add('pronta');
      ultimo = -1;
      disegna();
    }, function () { if (!scena) palco.classList.add('senza-3d'); });
  }

  function progresso() {
    if (ridotto) return 1;
    var b = palco.getBoundingClientRect(), corsa = b.height - window.innerHeight;
    return corsa > 0 ? Math.min(1, Math.max(0, -b.top / corsa)) : 1;
  }
  function disegna() {
    if (!scena) return;
    var p = progresso();
    if (Math.abs(p - ultimo) < 0.0004) return;
    ultimo = p;
    var T = scena.T, P = T.palla, cb = cBase.getContext('2d');
    // la matassa gira mentre si srotola. Si ridisegna solo il riquadro della palla: prima la
    // foto ferma, poi la palla girata, che sfuma verso il bordo cosi' il cerchio non si vede
    var lato = Math.ceil(P.r * 2 + 4), x0 = Math.round(P.x - lato / 2), y0 = Math.round(P.y - lato / 2);
    var sx = Math.max(0, x0), sy = Math.max(0, y0);
    cb.drawImage(scena.base, sx, sy, lato - (sx - x0), lato - (sy - y0), sx, sy, lato - (sx - x0), lato - (sy - y0));
    var g = scena.giro || (scena.giro = document.createElement('canvas'));
    g.width = g.height = lato;
    var gc = g.getContext('2d');
    gc.translate(P.x - x0, P.y - y0); gc.rotate(-p * Math.PI * 1.6); gc.translate(-P.x, -P.y);
    gc.drawImage(scena.base, 0, 0);
    gc.setTransform(1, 0, 0, 1, 0, 0);
    gc.globalCompositeOperation = 'destination-in';
    var sf = gc.createRadialGradient(P.x - x0, P.y - y0, P.r * 0.8, P.x - x0, P.y - y0, P.r);
    sf.addColorStop(0, 'rgba(0,0,0,1)'); sf.addColorStop(1, 'rgba(0,0,0,0)');
    gc.fillStyle = sf; gc.fillRect(0, 0, lato, lato);
    gc.globalCompositeOperation = 'source-over';
    cb.drawImage(g, x0, y0);
    // il filo: tutto quello che e' gia' uscito, con un capo netto
    var od = scena.out.data, idx = scena.idx, a0 = scena.a0, tt = scena.tt, N = idx.length;
    var punta = T.punta, fine = p * (1 + punta);
    // si ridisegna solo il riquadro dei pixel che cambiano: la foto e' grande
    var x0 = T.W, y0 = T.H, x1 = -1, y1 = -1;
    for (var j = 0; j < N; j++) {
      var f = (fine - tt[j]) / punta;
      var a = f >= 1 ? a0[j] : f <= 0 ? 0 : a0[j] * f;
      if (od[idx[j]] === (a | 0)) continue;
      od[idx[j]] = a;
      var q = (idx[j] - 3) >> 2, x = q % T.W, y = (q - x) / T.W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 >= 0) cFilo.getContext('2d').putImageData(scena.out, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    palco.style.setProperty('--scorri', p < 0.04 ? 1 : 0);
  }
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
  if (verticale) {
    if (verticale.addEventListener) verticale.addEventListener('change', prepara);
    else if (verticale.addListener) verticale.addListener(prepara);
  }
  prepara();
})();
