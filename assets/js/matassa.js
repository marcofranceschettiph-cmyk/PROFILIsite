/* ---------- PRO-FILI: la matassa dell'apertura ----------
   Prima dell'apertura c'e' un palco fisso (#matassa) con una foto: una matassa di lana
   rossa e tre profili di carta nera. Mentre la pagina scorre, il filo di lana della foto
   ricompare pezzo per pezzo nell'ordine in cui si srotola: parte dalla matassa (che
   gira), lega il primo profilo, passa dietro la nuca, lega il secondo e il terzo ed
   esce di scena dal fondo del palco, mentre la pagina prosegue con l'apertura.
   Due tagli della foto (assets/img/matassa/): «largo» per gli schermi orizzontali,
   «stretto» per quelli verticali, dove la matassa e' avvicinata al primo profilo.
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
    largo:   { W: 1344, H: 776, palla: { x: 133, y: 92, r: 73 }, punta: 3 / 2594 },
    stretto: { W: 560,  H: 776, palla: { x: 98, y: 130, r: 73 }, punta: 3 / 2200 }
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
    Promise.all([carica(DIR + nome + '-base.webp'), carica(DIR + nome + '-filo.webp'), carica(DIR + nome + '-tempo.png')]).then(function (r) {
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
    // la matassa gira mentre si srotola
    cb.drawImage(scena.base, 0, 0);
    cb.save();
    cb.beginPath(); cb.arc(P.x, P.y, P.r, 0, Math.PI * 2); cb.clip();
    cb.translate(P.x, P.y); cb.rotate(-p * Math.PI * 1.6); cb.translate(-P.x, -P.y);
    cb.drawImage(scena.base, 0, 0);
    cb.restore();
    // il filo: tutto quello che e' gia' uscito, con un capo netto
    var od = scena.out.data, idx = scena.idx, a0 = scena.a0, tt = scena.tt, N = idx.length;
    var punta = T.punta, fine = p * (1 + punta);
    for (var j = 0; j < N; j++) {
      var f = (fine - tt[j]) / punta;
      od[idx[j]] = f >= 1 ? a0[j] : f <= 0 ? 0 : a0[j] * f;
    }
    cFilo.getContext('2d').putImageData(scena.out, 0, 0);
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
