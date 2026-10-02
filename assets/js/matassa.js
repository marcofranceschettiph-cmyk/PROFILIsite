/* ---------- PRO-FILI: la matassa dell'apertura ----------
   Prima dell'apertura c'e' un palco fisso (#matassa): mentre la pagina scorre, una
   matassa di lana grossa rossa gira su se stessa e si sfila in parte. Il capo libero
   scende ed esce dal fondo del palco nel punto in cui, subito sotto, l'apertura fa
   partire il filo colorato (window.pfFiloIngresso, scritto da site.js): li' la lana
   si assottiglia e diventa il filo a colori che prosegue nel sito.
   La matassa e' disegnata dal codice con three.js: una sola linea avvolta su se
   stessa, a tre capi ritorti, con la peluria in tre gusci e fibre sciolte.
   Si disegna solo mentre il palco e' a schermo. Con prefers-reduced-motion la
   matassa e' ferma e segue lo scorrimento senza inseguimento morbido. */
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

  // il capo libero: filo e gusci, ricostruiti a ogni fotogramma (sono corti)
  var capo = { filo: new THREE.Mesh(new THREE.BufferGeometry(), materialeFilo(1)), gusci: [] };
  scene.add(capo.filo);
  GUSCI.forEach(function (G) { var m = new THREE.Mesh(new THREE.BufferGeometry(), materialeGuscio(G, 1)); capo.gusci.push(m); scene.add(m); });

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
    var b = palco.getBoundingClientRect(), corsa = b.height - innerHeight;
    return Math.min(1, Math.max(0, -b.top / (corsa || 1)));
  }

  var punta = new THREE.Vector3(), tangente = new THREE.Vector3();
  function capoLibero(resta, tempo) {
    var u = resta / SEG;
    curva.getPointAt(u, punta); gruppo.localToWorld(punta);
    curva.getTangentAt(u, tangente).transformDirection(gruppo.matrixWorld);
    // esce dal fondo, nel punto dove l'apertura fa partire il filo colorato
    var fx = typeof window.pfFiloIngresso === 'number' ? window.pfFiloIngresso : (stretto() ? 0.9 : 0.72);
    var fondoY = -mezzaAltezza * 1.06;
    var xU = (fx * 2 - 1) * mezzaAltezza * camera.aspect;
    var ctrl = [
      punta.clone(),
      punta.clone().addScaledVector(tangente, 0.28),
      new THREE.Vector3((punta.x + xU) / 2 + 0.35 * camera.aspect, (punta.y + fondoY) / 2 + Math.sin(tempo * 0.7) * 0.05, 0.25),
      new THREE.Vector3(xU, fondoY + mezzaAltezza * 0.35, 0),
      new THREE.Vector3(xU, fondoY, 0)
    ];
    var c = new THREE.CatmullRomCurve3(ctrl), lung = c.getLength();
    var vecchie = [capo.filo.geometry].concat(capo.gusci.map(function (m) { return m.geometry; }));
    capo.filo.geometry = new THREE.TubeGeometry(c, 160, L.spessore, L.radiali, false);
    capo.gusci.forEach(function (m, i) { m.geometry = new THREE.TubeGeometry(c, 160, L.spessore * GUSCI[i].largo, RAD_GUSCIO, false); });
    vecchie.forEach(function (g) { g.dispose(); });
    var rt = lung / (L.spessore * L.torsione), rp = lung / (L.spessore * 3.2);
    capo.filo.material.map.repeat.set(rt, 1); capo.filo.material.bumpMap.repeat.set(rt, 1);
    capo.gusci.forEach(function (m) { m.material.map.repeat.set(rp, 1); });
  }

  var IND_FILO = L.radiali * 6, IND_GUSCIO = RAD_GUSCIO * 6;
  var p = progresso(), t0 = performance.now(), aSchermo = true, inCorsa = false;
  function disegna(ora) {
    inCorsa = false;
    if (!aSchermo) return;
    p += (progresso() - p) * (ridotto ? 1 : 0.14);
    var tempo = ridotto ? 0 : (ora - t0) / 1000;
    // si sfila il 38% del filo, tra il 5% e il 75% dello scorrimento del palco
    var sfila = Math.min(1, Math.max(0, (p - 0.05) / 0.7));
    sfila = 1 - Math.pow(1 - sfila, 1.6);
    var resta = Math.floor(SEG * (1 - sfila * 0.38));
    geoFilo.setDrawRange(0, resta * IND_FILO);
    geoGusci.forEach(function (g) { g.setDrawRange(0, resta * IND_GUSCIO); });
    geoFibre.setDrawRange(0, Math.floor(FIBRE * resta / SEG) * 2);
    // la matassa sta in alto, gira su se stessa e risale un poco mentre si alleggerisce
    gruppo.position.set(stretto() ? -0.15 : -0.6, mezzaAltezza * (stretto() ? 0.3 : 0.2) + p * 0.25, 0);
    gruppo.scale.setScalar(stretto() ? 0.82 : 1);
    gruppo.rotation.y = tempo * 0.16 + p * Math.PI * 3;
    gruppo.rotation.x = 0.3 + p * 0.8;
    gruppo.updateMatrixWorld(true);
    capoLibero(resta, tempo);
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
