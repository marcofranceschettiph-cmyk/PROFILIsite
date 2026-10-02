/* ---------- PRO-FILI: la matassa dell'apertura ----------
   Prima dell'apertura c'e' un palco fisso (#matassa): mentre la pagina scorre, una
   matassa di lana grossa rossa gira su se stessa, si sfila in parte e si allontana nel
   fondo. Il capo libero avanza come un serpente e disegna nell'aria tre profili
   stilizzati, che a loro volta si allontanano; poi torna verso chi guarda ed esce dal
   fondo del palco nel punto in cui, subito sotto, l'apertura fa partire il filo colorato (window.pfFiloIngresso, scritto da site.js): li' la lana
   si assottiglia e diventa il filo a colori che prosegue nel sito.
   La matassa e' disegnata dal codice con three.js: una sola linea avvolta su se
   stessa, a tre capi ritorti, con la peluria in tre gusci e fibre sciolte.
   Si disegna solo mentre il palco e' a schermo. Con prefers-reduced-motion il palco
   e' alto uno schermo e mostra ferma la scena finale: profili disegnati, filo che esce. */
(function () {
  'use strict';
  var palco = document.getElementById('matassa');
  var tela = document.getElementById('matassa-tela');
  if (!palco || !tela || !window.THREE) { if (palco) palco.classList.add('senza-3d'); return; }
  var ridotto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // lana grossa: spessore del filo, giri attorno alla matassa, capi ritorti,
  // una torsione ogni 5,5 spessori
  var L = { spessore: 0.046, giri: 120, passi: 52, capi: 3, torsione: 5.5, radiali: 9 };
  // la peluria a gusci: ogni guscio e' un tubo piu' largo che mostra solo le fibre
  // piu' lunghe di una certa altezza; dentro e' piu' scuro, in punta piu' chiaro
  var GUSCI = [
    { largo: 1.16, soglia: 0.15, tinta: 0.88 },
    { largo: 1.34, soglia: 0.45, tinta: 0.98 },
    { largo: 1.55, soglia: 0.75, tinta: 1.06 }
  ];
  var RAD_GUSCIO = 5, CARTA = 0xF4EDE1;

  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true }); }
  catch (e) { palco.classList.add('senza-3d'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(CARTA, 1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xfff3e6, 0x8a5a4c, 0.95));
  var luce = new THREE.DirectionalLight(0xfff8f0, 1.05);
  luce.position.set(-3, 4, 5); scene.add(luce);
  var radente = new THREE.DirectionalLight(0xffe0cc, 0.55);
  radente.position.set(5, 1, -2); scene.add(radente);

  function generatore(seme) {
    return function () { seme = (seme * 16807) % 2147483647; return (seme - 1) / 2147483646; };
  }

  // trama: capi ritorti in fasce oblique, con fibre e chiazze irregolari (colore e rilievo)
  function trama() {
    var W = 256, H = 64, caso = generatore(3);
    var c = document.createElement('canvas'), b = document.createElement('canvas');
    c.width = b.width = W; c.height = b.height = H;
    var g = c.getContext('2d'), gb = b.getContext('2d');
    var img = g.createImageData(W, H), imgb = gb.createImageData(W, H);
    var fibre = new Float32Array(W * 8);
    for (var i = 0; i < fibre.length; i++) fibre[i] = caso();
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var t = (x / W + y / H) * L.capi, f = t - Math.floor(t);
        var cresta = Math.pow(Math.sin(f * Math.PI), 0.6);
        var fib = fibre[Math.floor((x / W + y / H) * W * 8 + y * 13) % fibre.length];
        var fib2 = fibre[(x * 7 + y * 31) % fibre.length];
        var v = cresta * 0.62 + fib * 0.26 + fib2 * 0.12;
        var k = (y * W + x) * 4;
        img.data[k] = 78 + v * 96; img.data[k + 1] = 24 + v * 40; img.data[k + 2] = 20 + v * 34; img.data[k + 3] = 255;
        imgb.data[k] = imgb.data[k + 1] = imgb.data[k + 2] = v * 255; imgb.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0); gb.putImageData(imgb, 0, 0);
    var tc = new THREE.CanvasTexture(c), tb = new THREE.CanvasTexture(b);
    [tc, tb].forEach(function (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; });
    tc.encoding = THREE.sRGBEncoding;
    return { colore: tc, rilievo: tb };
  }
  // peluria: l'alfa di ogni punto e' l'altezza della fibra che parte da li'. Pochi punti
  // grandi: a distanza i punti piccoli si confondono in una crosta compatta.
  function peluria() {
    var W = 48, H = 12, caso = generatore(11);
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), img = g.createImageData(W, H);
    for (var i = 0; i < W * H; i++) {
      var k = i * 4, alto = caso() < 0.22 ? Math.pow(caso(), 0.8) : 0, chiaro = 0.85 + caso() * 0.3;
      img.data[k] = 176 * chiaro; img.data[k + 1] = 70 * chiaro; img.data[k + 2] = 58 * chiaro;
      img.data[k + 3] = alto * 255;
    }
    g.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  }
  var TEX = trama(), TEX_PELI = peluria();
  function texCopia(t, rx) { var n = t.clone(); n.needsUpdate = true; n.repeat.set(rx, 1); return n; }
  function materialeFilo(rx) {
    return new THREE.MeshStandardMaterial({
      map: texCopia(TEX.colore, rx), bumpMap: texCopia(TEX.rilievo, rx),
      bumpScale: L.spessore * 1.4, roughness: 1, metalness: 0
    });
  }
  function materialeGuscio(G, rx) {
    return new THREE.MeshStandardMaterial({
      map: texCopia(TEX_PELI, rx), alphaTest: G.soglia, roughness: 1, metalness: 0,
      side: THREE.DoubleSide, color: new THREE.Color(G.tinta, G.tinta, G.tinta)
    });
  }

  // La matassa: una sola linea che si avvolge. A ogni giro sceglie un asse a caso
  // perpendicolare alla direzione in cui si trova e gira attorno a quello, cosi' i giri
  // si incrociano. Il raggio cresce verso l'esterno: srotolando dalla fine si toglie
  // sempre lo strato di fuori.
  var gruppo = new THREE.Group(); scene.add(gruppo);
  var caso = generatore(7);
  var punti = [], d = new THREE.Vector3(0, 0, 1), asse = new THREE.Vector3(), q = new THREE.Quaternion();
  var totale = L.giri * L.passi;
  for (var gi = 0; gi < L.giri; gi++) {
    var r = new THREE.Vector3(caso() - .5, caso() - .5, caso() - .5);
    asse.crossVectors(d, r).normalize();
    q.setFromAxisAngle(asse, Math.PI * (1.6 + caso() * 0.6) / L.passi);
    for (var s = 0; s < L.passi; s++) {
      var k = gi * L.passi + s;
      d.applyQuaternion(q).normalize();
      punti.push(d.clone().multiplyScalar(0.5 + 0.5 * Math.pow(k / totale, 0.45)));
    }
  }
  var curva = new THREE.CatmullRomCurve3(punti);
  curva.arcLengthDivisions = punti.length * 2;
  var SEG = punti.length - 1;
  var lunghezza = curva.getLength();
  var geoFilo = new THREE.TubeGeometry(curva, SEG, L.spessore, L.radiali, false);
  gruppo.add(new THREE.Mesh(geoFilo, materialeFilo(lunghezza / (L.spessore * L.torsione))));
  var geoGusci = GUSCI.map(function (G) {
    var geo = new THREE.TubeGeometry(curva, SEG, L.spessore * G.largo, RAD_GUSCIO, false);
    gruppo.add(new THREE.Mesh(geo, materialeGuscio(G, lunghezza / (L.spessore * 3.2))));
    return geo;
  });

  // fibre sciolte: segmenti corti che escono dal filo, nell'ordine del filo,
  // cosi' spariscono con lui quando si sfila
  var FIBRE = Math.floor(SEG * 1.3);
  var pos = new Float32Array(FIBRE * 6), col = new Float32Array(FIBRE * 6);
  var P = new THREE.Vector3(), T = new THREE.Vector3(), n = new THREE.Vector3(), e = new THREE.Vector3();
  for (var i = 0; i < FIBRE; i++) {
    var u = i / FIBRE;
    curva.getPointAt(u, P); curva.getTangentAt(u, T);
    n.set(caso() - .5, caso() - .5, caso() - .5);
    n.addScaledVector(T, -n.dot(T)).normalize();
    var a = P.clone().addScaledVector(n, L.spessore * (0.8 + caso() * 0.4));
    e.copy(n).multiplyScalar(0.8).addScaledVector(T, (caso() - .5) * 1.2)
      .add(new THREE.Vector3(caso() - .5, caso() - .5, caso() - .5).multiplyScalar(0.6)).normalize();
    var b = a.clone().addScaledVector(e, L.spessore * (0.7 + Math.pow(caso(), 2.5) * 1.8));
    pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    var c1 = 0.8 + caso() * 0.2, c2 = 0.9 + caso() * 0.2;
    col.set([0.5 * c1, 0.16 * c1, 0.12 * c1, 0.68 * c2, 0.28 * c2, 0.22 * c2], i * 6);
  }
  var geoFibre = new THREE.BufferGeometry();
  geoFibre.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geoFibre.setAttribute('color', new THREE.BufferAttribute(col, 3));
  gruppo.add(new THREE.LineSegments(geoFibre, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5 })));

  // il serpente: il capo libero, ricostruito a ogni fotogramma solo per il tratto gia'
  // uscito. Filo e un guscio di peluria: tre gusci su un tubo che cambia a ogni
  // fotogramma costerebbero troppo al telefono.
  var GUSCIO_S = GUSCI[1];
  var serpe = {
    filo: new THREE.Mesh(new THREE.BufferGeometry(), materialeFilo(1)),
    peli: new THREE.Mesh(new THREE.BufferGeometry(), materialeGuscio(GUSCIO_S, 1))
  };
  scene.add(serpe.filo); scene.add(serpe.peli);
  // la nebbia color carta: quello che si allontana sbiadisce nel fondo
  scene.fog = new THREE.Fog(CARTA, 10, 26);

  // Tre profili stilizzati, in una scatola 100 x 140, rivolti a destra, nell'ordine in
  // cui li percorre il filo: entra dalla gola, sale su mento, labbra, naso e fronte,
  // gira sulla testa, scende dalla nuca ed esce dal collo. Cosi' non taglia mai il viso.
  // Il secondo ha la crocchia e il terzo il naso piu' lungo.
  var PROFILI = [
    [[58, 140], [58, 130, 57, 122, 58, 114], [62, 110, 70, 110, 76, 106], [80, 102, 81, 96, 79, 90],
     [84, 86, 84, 80, 80, 74], [85, 72, 89, 70, 92, 66], [86, 58, 80, 52, 78, 44],
     [80, 30, 76, 15, 62, 12], [40, 8, 14, 24, 12, 52], [10, 76, 16, 96, 28, 106], [32, 116, 30, 128, 30, 140]],
    [[58, 140], [58, 130, 57, 122, 58, 115], [62, 111, 70, 111, 75, 107], [79, 103, 80, 97, 78, 91],
     [83, 87, 83, 81, 79, 75], [83, 73, 86, 71, 88, 68], [83, 60, 81, 54, 79, 46],
     [81, 32, 78, 18, 64, 15], [44, 10, 22, 18, 16, 34], [4, 28, -2, 46, 8, 52],
     [18, 58, 24, 46, 16, 40], [10, 62, 16, 94, 28, 106], [32, 116, 30, 128, 30, 140]],
    [[58, 140], [58, 130, 57, 123, 58, 116], [62, 112, 70, 112, 75, 108], [80, 104, 81, 98, 79, 92],
     [84, 88, 84, 82, 81, 76], [87, 74, 92, 72, 97, 69], [90, 60, 81, 52, 79, 42],
     [81, 26, 76, 8, 60, 6], [36, 2, 10, 20, 9, 50], [8, 76, 15, 96, 27, 106], [31, 116, 30, 128, 30, 140]]
  ];
  function bez3(out, a, b, c, d, n) {
    for (var j = 1; j <= n; j++) {
      var t = j / n, m = 1 - t;
      out.push(new THREE.Vector3(
        m * m * m * a.x + 3 * m * m * t * b.x + 3 * m * t * t * c.x + t * t * t * d.x,
        m * m * m * a.y + 3 * m * m * t * b.y + 3 * m * t * t * c.y + t * t * t * d.y,
        m * m * m * a.z + 3 * m * m * t * b.z + 3 * m * t * t * c.z + t * t * t * d.z));
    }
  }
  // un profilo nello spazio: centro, scala, verso (1 a destra, -1 a sinistra)
  function profilo(out, def, cx, cy, cz, sc, verso) {
    function V(x, y) { return new THREE.Vector3(cx + (x - 50) * sc * verso, cy - (y - 70) * sc, cz); }
    var cur = V(def[0][0], def[0][1]);
    for (var i = 1; i < def.length; i++) {
      var c = def[i], fine = V(c[4], c[5]);
      bez3(out, cur, V(c[0], c[1]), V(c[2], c[3]), fine, 10);
      cur = fine;
    }
    return cur;
  }

  var punta = new THREE.Vector3(), tangente = new THREE.Vector3();
  // il tracciato completo del serpente, in coordinate del mondo, per l'avanzamento p
  function tracciatoSerpe(resta, p, tempo) {
    var u = resta / SEG;
    curva.getPointAt(u, punta); gruppo.localToWorld(punta);
    curva.getTangentAt(u, tangente).transformDirection(gruppo.matrixWorld);
    var Hh = mezzaAltezza, Wh = mezzaAltezza * camera.aspect;
    var sc = Hh * (stretto() ? 0.36 : 0.56) / 140;
    // i profili stanno a profondita' diverse e, mentre il filo avanza, si allontanano
    // il primo davanti e a destra, il secondo piu' in fondo a sinistra, il terzo lontano
    // in alto al centro: cosi' non si coprono fra loro e non stanno dietro la matassa
    var via = p * 4;
    // al telefono lo schermo e' stretto e alto: i profili stanno uno sopra l'altro,
    // il primo in basso e vicino, l'ultimo in alto e lontano
    var posti = stretto() ? [
      [-Wh * 0.32, -Hh * 0.38, 0.4 - via, 1],
      [Wh * 0.34, -Hh * 0.02, -3 - via, -1],
      [-Wh * 0.22, Hh * 0.3, -7 - via, 1]
    ] : [
      [Wh * 0.42, -Hh * 0.06, 0.4 - via, 1],
      [-Wh * 0.4, Hh * 0.04, -3 - via, -1],
      [Wh * 0.08, Hh * 0.36, -7 - via, 1]
    ];
    var pts = [punta.clone()], cur = punta.clone(), giu = new THREE.Vector3(0, -sc * 70, 0);
    posti.forEach(function (q, i) {
      var def = PROFILI[i];
      var ingresso = new THREE.Vector3(q[0] + (def[0][0] - 50) * sc * q[3], q[1] - (def[0][1] - 70) * sc, q[2]);
      // il raccordo arriva alla gola girando dal lato della nuca, mai davanti al viso
      var nuca = new THREE.Vector3(-q[3] * sc * 80, 0, 0);
      var primo = i === 0 ? cur.clone().addScaledVector(tangente, 0.45).add(nuca) : cur.clone().add(giu).add(nuca);
      bez3(pts, cur, primo, ingresso.clone().add(giu).add(giu).add(nuca), ingresso, 24);
      cur = profilo(pts, def, q[0], q[1], q[2], sc, q[3]);
    });
    // la discesa: dall'ultimo profilo il filo torna verso chi guarda ed esce dal fondo,
    // nel punto dove l'apertura fa partire il filo colorato
    var fx = typeof window.pfFiloIngresso === 'number' ? window.pfFiloIngresso : (stretto() ? 0.9 : 0.72);
    // la discesa passa lungo il bordo destro, fuori dai profili, e arriva all'uscita
    var uscita = new THREE.Vector3((fx * 2 - 1) * Wh, -Hh * 1.08, 0);
    var bordo = new THREE.Vector3(Wh * 0.9, -Hh * 0.2, -1);
    bez3(pts, cur, cur.clone().sub(giu), new THREE.Vector3(Wh * 0.95, Hh * 0.85, -4), bordo, 30);
    bez3(pts, bordo, new THREE.Vector3(Wh * 0.88, -Hh * 0.6, 0), new THREE.Vector3(uscita.x, uscita.y + Hh * 0.35, 0), uscita, 30);
    // il serpente ondeggia appena, un'onda che corre lungo il filo
    if (!ridotto) for (var k = 1; k < pts.length - 1; k++) pts[k].y += Math.sin(k * 0.09 - tempo * 2.2) * 0.012;
    return pts;
  }

  function serpente(resta, p, quanto, tempo) {
    var pts = tracciatoSerpe(resta, p, tempo);
    // si taglia il tracciato alla lunghezza gia' uscita
    var lun = [0];
    for (var i = 1; i < pts.length; i++) lun.push(lun[i - 1] + pts[i].distanceTo(pts[i - 1]));
    var tot = lun[lun.length - 1], fino = Math.max(0.05, tot * quanto), vis = [pts[0]];
    for (i = 1; i < pts.length; i++) {
      if (lun[i] <= fino) { vis.push(pts[i]); continue; }
      var f = (fino - lun[i - 1]) / (lun[i] - lun[i - 1]);
      vis.push(pts[i - 1].clone().lerp(pts[i], f));
      break;
    }
    if (vis.length < 2) vis.push(pts[0].clone().addScaledVector(tangente, 0.02));
    var c = new THREE.CatmullRomCurve3(vis), segm = Math.min(700, Math.max(8, vis.length));
    var vecchie = [serpe.filo.geometry, serpe.peli.geometry];
    serpe.filo.geometry = new THREE.TubeGeometry(c, segm, L.spessore, L.radiali, false);
    serpe.peli.geometry = new THREE.TubeGeometry(c, segm, L.spessore * GUSCIO_S.largo, RAD_GUSCIO, false);
    vecchie.forEach(function (g) { g.dispose(); });
    var rt = fino / (L.spessore * L.torsione), rp = fino / (L.spessore * 3.2);
    serpe.filo.material.map.repeat.set(rt, 1); serpe.filo.material.bumpMap.repeat.set(rt, 1);
    serpe.peli.material.map.repeat.set(rp, 1);
  }

  // inquadratura
  var mezzaAltezza = 1, altezzaPx = 1;
  function stretto() { return camera.aspect < 0.8; }
  function misura() {
    var w = tela.clientWidth, h = tela.clientHeight;
    if (!w || !h) return;
    altezzaPx = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 0, stretto() ? 8.6 : 7.6);
    camera.updateProjectionMatrix();
    mezzaAltezza = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // spessore della lana in pixel sul fondo del palco: l'apertura parte da qui
    window.pfLanaPx = (L.spessore * 2) * (altezzaPx / (2 * mezzaAltezza));
    window.dispatchEvent(new Event('pf-lana'));
  }

  function progresso() {
    // movimento ridotto: il palco e' alto uno schermo e mostra la scena finale, ferma
    if (ridotto) return 1;
    var b = palco.getBoundingClientRect(), corsa = b.height - innerHeight;
    return Math.min(1, Math.max(0, -b.top / (corsa || 1)));
  }

  var IND_FILO = L.radiali * 6, IND_GUSCIO = RAD_GUSCIO * 6;
  var p = progresso(), t0 = performance.now(), aSchermo = true, inCorsa = false;
  function disegna(ora) {
    inCorsa = false;
    if (!aSchermo) return;
    p += (progresso() - p) * (ridotto ? 1 : 0.14);
    var tempo = ridotto ? 0 : (ora - t0) / 1000;
    // quanto filo e' uscito: cresce per quasi tutto il palco, con un avvio e un arrivo morbidi
    var x = Math.min(1, Math.max(0, (p - 0.06) / 0.86)), quanto = x * x * (3 - 2 * x);
    var resta = Math.floor(SEG * (1 - quanto * 0.3));
    geoFilo.setDrawRange(0, resta * IND_FILO);
    geoGusci.forEach(function (g) { g.setDrawRange(0, resta * IND_GUSCIO); });
    geoFibre.setDrawRange(0, Math.floor(FIBRE * resta / SEG) * 2);
    // la matassa parte in alto, gira su se stessa e intanto si allontana nel fondo
    // la matassa: all'inizio in primo piano, poi si allontana verso l'alto a sinistra
    var Wh = mezzaAltezza * camera.aspect;
    gruppo.position.set(stretto() ? -0.15 - p * Wh * 0.3 : -0.6 - p * Wh * 0.35, mezzaAltezza * (stretto() ? 0.3 : 0.2) + p * mezzaAltezza * 0.45, -p * 13);
    gruppo.scale.setScalar(stretto() ? 0.82 : 1);
    gruppo.rotation.y = tempo * 0.16 + p * Math.PI * 3;
    gruppo.rotation.x = 0.3 + p * 0.8;
    gruppo.updateMatrixWorld(true);
    serpente(resta, p, quanto, tempo);
    renderer.render(scene, camera);
    palco.style.setProperty('--scorri', p > 0.03 ? '0' : '1');
    giro();
  }
  function giro() { if (!inCorsa && aSchermo) { inCorsa = true; requestAnimationFrame(disegna); } }

  // si disegna solo mentre il palco e' a schermo
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (voci) {
      aSchermo = voci[0].isIntersecting;
      if (aSchermo) giro();
    }).observe(palco);
  }
  addEventListener('resize', function () { misura(); giro(); });
  addEventListener('pf-ingresso', giro);
  misura();
  giro();
})();
