// Simulador — condició de Laue en 2D: un monocristall que gira i un detector que gira.
// λ fixa: |k| = |k'| = 2π/λ. Hi ha pic quan Δk = k' − k coincideix amb un G del cristall girat.
// Girar el cristall 360° fa que cada G recorri una circumferència de radi |G|; on talla la
// circumferència de l'observador (la d'Ewald) hi ha un anell de pols, a 2θ = 2 arcsin(|G|/2k).

(function () {
  'use strict';

  const TAU = 2 * Math.PI, DEG = Math.PI / 180;
  const COL_K = '#2980b9', COL_KP = '#e67e22', COL_DK = '#d62728', COL_G = '#00722b', COL_ORB = '#9aa8a0', COL_HIT = '#ff3b30';
  const NPHI = 360, NTTH = 721;                    // φ en passos d'1°, 2θ de −180° a 180° en passos de 0.5°

  const state = {
    lat: 'square', a: 3.0, ratio: 1.4, lambda: 1.5406, N: 20,
    phi: 20, tth: 40,
    orbits: true, ewald: true, planes: true, acumula: true
  };

  // ---------------------------------------------------------------
  // Física
  // ---------------------------------------------------------------
  const kmod = () => TAU / state.lambda;
  const sigma = () => 0.45 * TAU / (state.N * state.a);   // amplada del pic (lòbul central de sin²(Nx)/sin²x)

  function lattice() {
    const a = state.a;
    let a1, a2;
    if (state.lat === 'rect') { a1 = { x: a, y: 0 }; a2 = { x: 0, y: a * state.ratio }; }
    else if (state.lat === 'hex') { a1 = { x: a, y: 0 }; a2 = { x: a / 2, y: a * Math.sqrt(3) / 2 }; }
    else { a1 = { x: a, y: 0 }; a2 = { x: 0, y: a }; }
    const A = a1.x * a2.y - a1.y * a2.x;
    const b1 = { x: TAU * a2.y / A, y: -TAU * a2.x / A }, b2 = { x: -TAU * a1.y / A, y: TAU * a1.x / A };
    return { a1, a2, b1, b2 };
  }

  // vectors G (sense girar) fins a una mica més enllà de 2k
  let Gcache = null, Gkey = null;
  function Gs() {
    const key = [state.lat, state.a, state.ratio, state.lambda].join('|');
    if (key === Gkey) return Gcache;
    const L = lattice(), Gmax = 2.15 * kmod();
    const bmin = Math.min(Math.hypot(L.b1.x, L.b1.y), Math.hypot(L.b2.x, L.b2.y));
    const M = Math.ceil(Gmax / bmin * 1.3) + 1, out = [];
    for (let h = -M; h <= M; h++) for (let k = -M; k <= M; k++) {
      if (!h && !k) continue;
      const x = h * L.b1.x + k * L.b2.x, y = h * L.b1.y + k * L.b2.y, g = Math.hypot(x, y);
      if (g <= Gmax) out.push({ h, k, x, y, g });
    }
    Gcache = out; Gkey = key;
    return out;
  }
  const rot = (p, phi) => { const c = Math.cos(phi), s = Math.sin(phi); return { x: c * p.x - s * p.y, y: s * p.x + c * p.y }; };

  // Δk per a un angle d'observació 2θ (k incident al llarg de +x)
  function dk(tthDeg) {
    const k = kmod(), t = tthDeg * DEG;
    return { x: k * Math.cos(t) - k, y: k * Math.sin(t) };
  }

  // intensitat (normalitzada: 1 = condició de Laue exacta) i el G que més hi contribueix
  function intensity(phiDeg, tthDeg) {
    const D = dk(tthDeg), s2 = 2 * sigma() * sigma(), c = Math.cos(phiDeg * DEG), s = Math.sin(phiDeg * DEG);
    let I = 0, best = null, bestI = 0;
    for (const G of Gs()) {
      const gx = c * G.x - s * G.y, gy = s * G.x + c * G.y;
      const d2 = (D.x - gx) * (D.x - gx) + (D.y - gy) * (D.y - gy);
      if (d2 > 25 * s2) continue;
      const v = Math.exp(-d2 / s2);
      I += v;
      if (v > bestI) { bestI = v; best = G; }
    }
    return { I, best, bestI };
  }

  // anells de pols: un per a cada |G| diferent que la circumferència de l'observador pot tallar
  function rings() {
    const k = kmod(), map = new Map();
    for (const G of Gs()) {
      if (G.g > 2 * k) continue;
      const key = G.g.toFixed(4);
      if (!map.has(key)) map.set(key, { g: G.g, list: [] });
      map.get(key).list.push(G);
    }
    return [...map.values()].sort((u, v) => u.g - v.g).map(r => {
      const tth = 2 * Math.asin(r.g / (2 * k)) / DEG;
      // representant: índexs no negatius i petits
      const rep = r.list.slice().sort((u, v) => (u.h < 0) + (u.k < 0) - (v.h < 0) - (v.k < 0) || Math.abs(u.h) + Math.abs(u.k) - Math.abs(v.h) - Math.abs(v.k) || v.h - u.h)[0];
      return { g: r.g, d: TAU / r.g, tth, m: r.list.length, rep };
    });
  }

  // ---------------------------------------------------------------
  // Patró acumulat mentre el cristall gira
  // ---------------------------------------------------------------
  let acc = new Float32Array(NTTH), visited = new Uint8Array(NPHI), lastPhiBin = null;
  const tthOfBin = i => -180 + i * 0.5;
  function resetAcc() { acc = new Float32Array(NTTH); visited = new Uint8Array(NPHI); lastPhiBin = null; markPhi(state.phi); }
  function addPhiBin(b) {
    if (visited[b]) return;
    visited[b] = 1;
    for (let i = 0; i < NTTH; i++) acc[i] += intensity(b + 0.5, tthOfBin(i)).I;
  }
  // registra totes les orientacions travessades des de l'última (pel camí més curt)
  function markPhi(phi) {
    if (!state.acumula) return;
    const b = ((Math.floor(phi) % NPHI) + NPHI) % NPHI;
    if (lastPhiBin === null) { addPhiBin(b); lastPhiBin = b; return; }
    let d = b - lastPhiBin;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    const st = Math.sign(d);
    for (let j = 1; j <= Math.abs(d); j++) addPhiBin(((lastPhiBin + st * j) % NPHI + NPHI) % NPHI);
    addPhiBin(b);
    lastPhiBin = b;
  }
  const coverage = () => visited.reduce((s, v) => s + v, 0) / NPHI;

  // ---------------------------------------------------------------
  // Utilitats de dibuix
  // ---------------------------------------------------------------
  function arrow(g, x0, y0, x1, y1, col, width, label) {
    const ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = width || 2;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    if (len > 4) {
      const hl = Math.min(11, len * 0.35);
      g.beginPath(); g.moveTo(x1, y1);
      g.lineTo(x1 - hl * Math.cos(ang - 0.38), y1 - hl * Math.sin(ang - 0.38));
      g.lineTo(x1 - hl * Math.cos(ang + 0.38), y1 - hl * Math.sin(ang + 0.38));
      g.closePath(); g.fill();
    }
    if (label) {
      g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nx = -Math.sin(ang), ny = Math.cos(ang);
      g.fillText(label, mx + nx * 13, my + ny * 13 + 4);
    }
  }
  const fmt = (x, n) => String(+x.toFixed(n === undefined ? 2 : n));
  const norm360 = x => ((x % 360) + 360) % 360;
  const norm180 = x => { x = norm360(x); return x > 180 ? x - 360 : x; };
  const famLabel = G => '(' + G.h + ' ' + G.k + ')';

  // ---------------------------------------------------------------
  // Panell 1: el laboratori (espai real)
  // ---------------------------------------------------------------
  const cLab = document.getElementById('canvasLab'), gLab = cLab.getContext('2d');
  const labGeom = () => { const W = cLab.width, H = cLab.height; return { W, H, cx: W / 2, cy: H / 2, R: Math.min(W, H) * 0.40, Rc: Math.min(W, H) * 0.16 }; };

  function drawLab() {
    const { W, H, cx, cy, R, Rc } = labGeom();
    gLab.clearRect(0, 0, W, H);
    const cur = intensity(state.phi, state.tth), hit = cur.bestI > 0.5;

    // circumferència de l'observador, pintada amb el patró acumulat (com una pel·lícula de pols)
    const amax = Math.max(1e-9, ...acc);
    gLab.lineWidth = 9;
    for (let i = 0; i < NTTH - 1; i++) {
      const t0 = tthOfBin(i) * DEG, t1 = tthOfBin(i + 1) * DEG, v = Math.min(1, acc[i] / amax);
      gLab.strokeStyle = 'rgba(' + Math.round(40 + 215 * v) + ',' + Math.round(60 + 120 * v * v) + ',' + Math.round(70 * (1 - v)) + ',' + (0.12 + 0.88 * v) + ')';
      gLab.beginPath(); gLab.arc(cx, cy, R, -t1, -t0); gLab.stroke();
    }
    gLab.strokeStyle = 'rgba(230,126,34,0.7)'; gLab.lineWidth = 1; gLab.setLineDash([5, 4]);
    gLab.beginPath(); gLab.arc(cx, cy, R, 0, TAU); gLab.stroke(); gLab.setLineDash([]);

    // feix incident i transmès
    arrow(gLab, 8, cy, cx - Rc - 4, cy, COL_K, 3, 'k');
    gLab.strokeStyle = 'rgba(41,128,185,0.25)'; gLab.lineWidth = 2;
    gLab.beginPath(); gLab.moveTo(cx + Rc, cy); gLab.lineTo(W - 4, cy); gLab.stroke();

    // cristall girat
    const L = lattice(), sc = Rc / (3.2 * state.a);
    const A1 = rot(L.a1, state.phi * DEG), A2 = rot(L.a2, state.phi * DEG);
    gLab.save();
    gLab.beginPath(); gLab.arc(cx, cy, Rc, 0, TAU); gLab.clip();
    gLab.fillStyle = 'rgba(0,150,57,0.06)'; gLab.fillRect(cx - Rc, cy - Rc, 2 * Rc, 2 * Rc);
    // plans de Bragg del G que compleix la condició
    if (hit && state.planes) {
      const G = rot(cur.best, state.phi * DEG), g = Math.hypot(G.x, G.y), d = TAU / g;
      const ux = G.x / g, uy = G.y / g;
      gLab.strokeStyle = 'rgba(255,59,48,0.55)'; gLab.lineWidth = 1.5;
      for (let n = -12; n <= 12; n++) {
        const px = cx + n * d * ux * sc, py = cy - n * d * uy * sc;
        gLab.beginPath(); gLab.moveTo(px - uy * 3 * Rc, py - ux * 3 * Rc); gLab.lineTo(px + uy * 3 * Rc, py + ux * 3 * Rc); gLab.stroke();
      }
    }
    gLab.fillStyle = '#2980b9';
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
      const x = cx + (i * A1.x + j * A2.x) * sc, y = cy - (i * A1.y + j * A2.y) * sc;
      if (Math.hypot(x - cx, y - cy) > Rc) continue;
      gLab.beginPath(); gLab.arc(x, y, 2.6, 0, TAU); gLab.fill();
    }
    gLab.restore();
    gLab.strokeStyle = 'rgba(0,114,43,0.6)'; gLab.lineWidth = 1.5;
    gLab.beginPath(); gLab.arc(cx, cy, Rc, 0, TAU); gLab.stroke();
    // marca d'orientació del cristall
    const mx = cx + Math.cos(state.phi * DEG) * (Rc + 9), my = cy - Math.sin(state.phi * DEG) * (Rc + 9);
    gLab.fillStyle = COL_G; gLab.beginPath(); gLab.arc(mx, my, 4, 0, TAU); gLab.fill();
    gLab.font = '11px sans-serif'; gLab.textAlign = 'center';
    gLab.fillText('φ = ' + fmt(state.phi, 0) + '°', cx, cy + Rc + 24);

    // feix difractat i detector
    const t = state.tth * DEG, dx = cx + R * Math.cos(t), dy = cy - R * Math.sin(t);
    gLab.strokeStyle = hit ? COL_HIT : 'rgba(230,126,34,0.55)'; gLab.lineWidth = hit ? 3 : 1.5;
    gLab.setLineDash(hit ? [] : [6, 5]);
    gLab.beginPath(); gLab.moveTo(cx + Rc * Math.cos(t), cy - Rc * Math.sin(t)); gLab.lineTo(dx, dy); gLab.stroke();
    gLab.setLineDash([]);
    gLab.save(); gLab.translate(dx, dy); gLab.rotate(-t);
    gLab.fillStyle = hit ? COL_HIT : '#555';
    gLab.fillRect(-5, -13, 10, 26);
    if (hit) { gLab.shadowColor = COL_HIT; gLab.shadowBlur = 18; gLab.fillRect(-5, -13, 10, 26); }
    gLab.restore();
    // angle 2θ
    gLab.strokeStyle = '#555'; gLab.lineWidth = 1;
    gLab.beginPath(); gLab.arc(cx, cy, Rc + 30, -Math.max(0, t), -Math.min(0, t)); gLab.stroke();
    gLab.fillStyle = '#333'; gLab.font = '12px sans-serif';
    const lt = t / 2;
    gLab.fillText('2θ = ' + fmt(state.tth, 1) + '°', cx + (Rc + 52) * Math.cos(lt), cy - (Rc + 52) * Math.sin(lt) + 4);
    gLab.textAlign = 'left'; gLab.font = '11px sans-serif'; gLab.fillStyle = '#555';
    gLab.fillText('Circumferència de l\'observador (detector)', 8, 16);
    gLab.fillText(hit ? 'PIC: ' + famLabel(cur.best) + ' compleix la condició de Laue' : 'Cap pic en aquesta posició', 8, H - 10);
  }

  // ---------------------------------------------------------------
  // Panell 2: espai recíproc (construcció d'Ewald)
  // ---------------------------------------------------------------
  const cRec = document.getElementById('canvasRec'), gRec = cRec.getContext('2d');
  function recGeom() {
    const W = cRec.width, H = cRec.height, k = kmod();
    const s = (Math.min(W, H) / 2 - 12) / (2.1 * k);
    const ox = W / 2, oy = H / 2;
    return { W, H, k, s, ox, oy, P: p => ({ x: ox + p.x * s, y: oy - p.y * s }) };
  }

  function drawRec() {
    const { W, H, k, s, ox, oy, P } = recGeom();
    gRec.clearRect(0, 0, W, H);
    const phi = state.phi * DEG, cur = intensity(state.phi, state.tth), hit = cur.bestI > 0.5;
    const C = P({ x: -k, y: 0 });

    // circumferències de gir dels G (radi |G| al voltant de l'origen O)
    const R = rings();
    if (state.orbits) {
      gRec.strokeStyle = COL_ORB; gRec.lineWidth = 1; gRec.setLineDash([3, 4]);
      R.forEach(r => { gRec.beginPath(); gRec.arc(ox, oy, r.g * s, 0, TAU); gRec.stroke(); });
      gRec.setLineDash([]);
    }
    // circumferència de l'observador (Ewald): centre C, radi k, passa per O
    if (state.ewald) {
      gRec.strokeStyle = COL_KP; gRec.lineWidth = 2; gRec.setLineDash([7, 4]);
      gRec.beginPath(); gRec.arc(C.x, C.y, k * s, 0, TAU); gRec.stroke(); gRec.setLineDash([]);
      // on es tallen: hi pot haver pic de pols (a ±2θ)
      if (state.orbits) {
        gRec.fillStyle = COL_KP;
        R.forEach(r => [1, -1].forEach(sg => {
          const p = P(dk(sg * r.tth));
          gRec.beginPath(); gRec.arc(p.x, p.y, 3.5, 0, TAU); gRec.fill();
        }));
      }
    }

    // punts de la xarxa recíproca, girats amb el cristall
    for (const G of Gs()) {
      const q = P(rot(G, phi));
      if (q.x < -5 || q.x > W + 5 || q.y < -5 || q.y > H + 5) continue;
      const isHit = hit && G === cur.best;
      gRec.fillStyle = isHit ? COL_HIT : COL_G;
      if (isHit) { gRec.save(); gRec.shadowColor = COL_HIT; gRec.shadowBlur = 16; }
      gRec.beginPath(); gRec.arc(q.x, q.y, isHit ? 6.5 : 3.6, 0, TAU); gRec.fill();
      if (isHit) gRec.restore();
      if (Math.abs(G.h) <= 1 && Math.abs(G.k) <= 1 || isHit) {
        gRec.font = '9px sans-serif'; gRec.textAlign = 'left'; gRec.fillStyle = isHit ? COL_HIT : 'rgba(0,114,43,0.8)';
        gRec.fillText(G.h + ',' + G.k, q.x + 5, q.y - 4);
      }
    }
    // l'origen O
    gRec.fillStyle = '#111'; gRec.beginPath(); gRec.arc(ox, oy, 4, 0, TAU); gRec.fill();
    gRec.font = 'bold 12px sans-serif'; gRec.textAlign = 'left'; gRec.fillText('O', ox + 6, oy + 15);
    gRec.fillStyle = '#555'; gRec.beginPath(); gRec.arc(C.x, C.y, 3, 0, TAU); gRec.fill();
    gRec.fillText('C', C.x - 14, C.y + 15);

    // k, k' i Δk
    const D = dk(state.tth), T = P(D);
    arrow(gRec, C.x, C.y, ox, oy, COL_K, 2.5, 'k');
    arrow(gRec, C.x, C.y, T.x, T.y, COL_KP, 2.5, "k'");
    arrow(gRec, ox, oy, T.x, T.y, COL_DK, 2.5, 'Δk');
    gRec.strokeStyle = '#777'; gRec.lineWidth = 1;
    const t = state.tth * DEG;
    gRec.beginPath(); gRec.arc(C.x, C.y, 26, -Math.max(0, t), -Math.min(0, t)); gRec.stroke();
    gRec.fillStyle = '#333'; gRec.font = '11px sans-serif'; gRec.textAlign = 'center';
    gRec.fillText('2θ', C.x + 40 * Math.cos(t / 2), C.y - 40 * Math.sin(t / 2) + 4);

    gRec.textAlign = 'left'; gRec.fillStyle = '#555'; gRec.font = '11px sans-serif';
    gRec.fillText(hit ? 'Δk = G' + famLabel(cur.best) + ': condició de Laue' : 'Δk no coincideix amb cap G', 8, H - 10);
  }

  // ---------------------------------------------------------------
  // Patró de pols: acumulat i orientació actual
  // ---------------------------------------------------------------
  const cPat = document.getElementById('canvasPat'), gPat = cPat.getContext('2d');
  const PM = { l: 40, r: 12, t: 34, b: 34 };
  const xT = (t, W) => PM.l + (t + 180) / 360 * (W - PM.l - PM.r);
  const tX = (x, W) => -180 + (x - PM.l) / (W - PM.l - PM.r) * 360;

  function drawPattern() {
    const W = cPat.width, H = cPat.height, y0 = H - PM.b, yT = PM.t;
    gPat.clearRect(0, 0, W, H);
    const Y = v => y0 - v * (y0 - yT);
    // anells (posicions teòriques)
    const R = rings();
    gPat.font = '9px sans-serif'; gPat.textAlign = 'center';
    const marks = [];
    R.forEach(r => [1, -1].forEach(sg => marks.push({ x: xT(sg * r.tth, W), text: '(' + r.rep.h + r.rep.k + ')' })));
    marks.sort((u, v) => u.x - v.x);
    const rowEnd = [-Infinity, -Infinity];
    marks.forEach(mk => {
      gPat.strokeStyle = 'rgba(230,126,34,0.35)'; gPat.lineWidth = 1; gPat.setLineDash([3, 3]);
      gPat.beginPath(); gPat.moveTo(mk.x, yT); gPat.lineTo(mk.x, y0); gPat.stroke(); gPat.setLineDash([]);
      const w = gPat.measureText(mk.text).width + 3;
      const row = rowEnd[0] < mk.x - w / 2 ? 0 : rowEnd[1] < mk.x - w / 2 ? 1 : (rowEnd[0] < rowEnd[1] ? 0 : 1);
      rowEnd[row] = mk.x + w / 2;
      gPat.fillStyle = '#b36b00'; gPat.fillText(mk.text, mk.x, yT - 15 + 10 * row);
    });
    // acumulat
    const amax = Math.max(1e-9, ...acc);
    gPat.fillStyle = 'rgba(0,114,43,0.18)'; gPat.strokeStyle = '#00722b'; gPat.lineWidth = 1.6;
    gPat.beginPath(); gPat.moveTo(xT(-180, W), y0);
    for (let i = 0; i < NTTH; i++) gPat.lineTo(xT(tthOfBin(i), W), Y(acc[i] / amax));
    gPat.lineTo(xT(180, W), y0); gPat.closePath(); gPat.fill(); gPat.stroke();
    // orientació actual
    gPat.strokeStyle = '#d62728'; gPat.lineWidth = 1.2;
    gPat.beginPath();
    for (let i = 0; i < NTTH; i++) {
      const v = Math.min(1, intensity(state.phi, tthOfBin(i)).I), x = xT(tthOfBin(i), W);
      if (i === 0) gPat.moveTo(x, Y(v)); else gPat.lineTo(x, Y(v));
    }
    gPat.stroke();
    // detector
    const xd = xT(state.tth, W);
    gPat.strokeStyle = '#333'; gPat.lineWidth = 1.5;
    gPat.beginPath(); gPat.moveTo(xd, yT); gPat.lineTo(xd, y0); gPat.stroke();
    gPat.fillStyle = '#333'; gPat.beginPath(); gPat.moveTo(xd - 5, y0 + 1); gPat.lineTo(xd + 5, y0 + 1); gPat.lineTo(xd, y0 - 7); gPat.closePath(); gPat.fill();
    // eix
    gPat.strokeStyle = '#999'; gPat.lineWidth = 1;
    gPat.beginPath(); gPat.moveTo(PM.l, y0); gPat.lineTo(W - PM.r, y0); gPat.stroke();
    gPat.fillStyle = '#555'; gPat.font = '10px sans-serif'; gPat.textAlign = 'center';
    for (let t = -180; t <= 180; t += 30) { const x = xT(t, W); gPat.fillText(t + '°', x, y0 + 13); }
    gPat.fillText('2θ (angle de l\'observador)', (PM.l + W - PM.r) / 2, H - 5);
    gPat.save(); gPat.translate(12, (yT + y0) / 2); gPat.rotate(-Math.PI / 2); gPat.fillText('intensitat', 0, 0); gPat.restore();
    document.getElementById('cobertura').textContent = Math.round(coverage() * 100) + '%';
  }
  cPat.addEventListener('click', ev => {
    const r = cPat.getBoundingClientRect(), x = (ev.clientX - r.left) * cPat.width / r.width;
    setTth(Math.max(-180, Math.min(180, tX(x, cPat.width))));
  });

  // ---------------------------------------------------------------
  // Taula d'anells i fórmules
  // ---------------------------------------------------------------
  const ringBody = document.getElementById('ringBody');
  function drawRings() {
    const R = rings();
    ringBody.innerHTML = R.map((r, i) => {
      const near = Math.abs(Math.abs(state.tth) - r.tth) < 0.6;
      return '<tr class="' + (near ? 'sel' : '') + '" data-tth="' + r.tth + '"><td>' + (i + 1) + '</td><td>(' + r.rep.h + ' ' + r.rep.k + ')</td><td>' + r.m +
        '</td><td>' + r.g.toFixed(3) + '</td><td>' + r.d.toFixed(3) + '</td><td>' + r.tth.toFixed(2) + '</td></tr>';
    }).join('') || '<tr><td colspan="6">Cap |G| és menor que 2k: augmenta a o redueix λ.</td></tr>';
  }
  ringBody.addEventListener('click', ev => {
    const tr = ev.target.closest('tr[data-tth]');
    if (tr) setTth(+tr.dataset.tth * (state.tth < 0 ? -1 : 1));
  });

  const formules = document.getElementById('formules');
  function tex(s) {
    if (window.katex) return window.katex.renderToString(s, { displayMode: true, throwOnError: false });
    return '<code>' + s.replace(/</g, '&lt;') + '</code>';
  }
  function drawFormulas() {
    const k = kmod(), D = dk(state.tth), cur = intensity(state.phi, state.tth), hit = cur.bestI > 0.5;
    const th = state.tth / 2;
    const rows = [];
    rows.push({
      nom: 'Condició de Laue',
      tex: ["\\Delta\\vec k=\\vec k^{\\,\\prime}-\\vec k=\\vec G,\\qquad |\\vec k^{\\,\\prime}|=|\\vec k|=\\frac{2\\pi}{\\lambda}=" + k.toFixed(3) + "\\ \\text{Å}^{-1}"],
      nota: 'k′ comença al centre C i la seva punta recorre la circumferència de l\'observador. Δk va de l\'origen O fins a aquesta punta.'
    });
    let txt = "|\\Delta\\vec k|=2k\\sin\\theta=2\\cdot" + k.toFixed(3) + "\\cdot\\sin(" + fmt(th, 2) + "^\\circ)=" + Math.hypot(D.x, D.y).toFixed(3) + "\\ \\text{Å}^{-1}";
    let nota = 'Ara mateix Δk no coincideix amb cap vector de la xarxa recíproca del cristall girat.';
    if (hit) {
      const G = cur.best;
      txt += ",\\qquad |\\vec G_{" + G.h + G.k + "}|=" + G.g.toFixed(3) + "\\ \\text{Å}^{-1}";
      nota = 'La punta de k′ cau sobre G(' + G.h + ',' + G.k + '): hi ha pic. És el mateix que la llei de Bragg amb d = 2π/|G| = ' + (TAU / G.g).toFixed(3) + ' Å.';
    }
    rows.push({ nom: 'Ara mateix (φ = ' + fmt(state.phi, 0) + '°, 2θ = ' + fmt(state.tth, 1) + '°)', tex: [txt], nota });
    rows.push({
      nom: 'Pols: girar el cristall 360°',
      tex: ["|\\vec G|=2k\\sin\\theta\\quad\\Longleftrightarrow\\quad 2\\theta=2\\arcsin\\frac{\\lambda|\\vec G|}{4\\pi}=2\\arcsin\\frac{\\lambda}{2d}\\quad\\Longleftrightarrow\\quad 2d\\sin\\theta=\\lambda"],
      nota: 'En girar, cada G recorre una circumferència de radi |G| al voltant d\'O. Si |G| < 2k, talla la de l\'observador en dos punts, a ±2θ: aquests són els anells de pols. Si |G| > 2k, no la talla mai i el pic no es pot veure.'
    });
    formules.innerHTML = rows.map(r => '<div class="formula"><div class="formula-nom">' + r.nom + '</div>' +
      r.tex.map(tex).join('') + '<div class="formula-nota">' + r.nota + '</div></div>').join('');
  }

  const lectura = document.getElementById('lectura'), estat = document.getElementById('estat');
  function drawReadout() {
    const k = kmod(), D = dk(state.tth), cur = intensity(state.phi, state.tth), hit = cur.bestI > 0.5;
    const rows = [['φ (cristall)', fmt(state.phi, 1) + '°'], ['2θ (observador)', fmt(state.tth, 1) + '°'],
      ['|k| = 2π/λ', k.toFixed(3) + ' Å⁻¹'], ['|Δk|', Math.hypot(D.x, D.y).toFixed(3) + ' Å⁻¹'],
      ['intensitat', Math.min(1, cur.I).toFixed(3)], ['orientacions girades', Math.round(coverage() * 100) + '%']];
    lectura.innerHTML = rows.map(r => '<div class="fila"><span class="etiqueta">' + r[0] + '</span><span class="valor">' + r[1] + '</span></div>').join('');
    estat.className = 'estat ' + (hit ? 'si' : 'no');
    estat.textContent = hit ? 'Pic: Δk = G' + famLabel(cur.best) + '. La punta de k′ toca un punt de la xarxa recíproca.'
      : 'Sense pic: gira el cristall o l\'observador fins que la punta de k′ toqui un G.';
  }

  // ---------------------------------------------------------------
  // Controls i interacció
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  function render() { drawLab(); drawRec(); drawPattern(); drawRings(); drawFormulas(); drawReadout(); syncUI(); }
  function syncUI() {
    $('slPhi').value = state.phi; $('valPhi').textContent = fmt(state.phi, 0) + '°';
    $('slTth').value = state.tth; $('valTth').textContent = fmt(state.tth, 1) + '°';
    $('slN').value = state.N; $('valN').textContent = state.N;
    $('blocRatio').style.display = state.lat === 'rect' ? '' : 'none';
  }
  function setPhi(p) { state.phi = norm360(p); markPhi(state.phi); render(); }
  function setTth(t) { state.tth = Math.max(-180, Math.min(180, t)); render(); }

  $('slPhi').addEventListener('input', () => setPhi(+$('slPhi').value));
  $('slTth').addEventListener('input', () => setTth(+$('slTth').value));
  $('slN').addEventListener('input', () => { state.N = +$('slN').value; resetAcc(); render(); });
  $('selLat').addEventListener('change', () => { state.lat = $('selLat').value; resetAcc(); render(); });
  $('inA').addEventListener('change', () => { const x = +$('inA').value; if (x > 0.5 && x < 20) state.a = x; $('inA').value = state.a; resetAcc(); render(); });
  $('inRatio').addEventListener('change', () => { const x = +$('inRatio').value; if (x > 0.3 && x < 4) state.ratio = x; $('inRatio').value = state.ratio; resetAcc(); render(); });
  $('inLambda').addEventListener('change', () => { const x = +$('inLambda').value; if (x > 0.1 && x < 10) state.lambda = x; $('inLambda').value = state.lambda; resetAcc(); render(); });
  $('chkOrb').addEventListener('change', () => { state.orbits = $('chkOrb').checked; render(); });
  $('chkEwald').addEventListener('change', () => { state.ewald = $('chkEwald').checked; render(); });
  $('chkPlanes').addEventListener('change', () => { state.planes = $('chkPlanes').checked; render(); });
  $('chkAcc').addEventListener('change', () => { state.acumula = $('chkAcc').checked; lastPhiBin = null; markPhi(state.phi); render(); });
  $('btnReset').addEventListener('click', () => { resetAcc(); render(); });

  // animacions: girar el cristall 360° o escombrar l'angle de l'observador
  let anim = null;
  function stopAnim() {
    if (!anim) return;
    cancelAnimationFrame(anim.id); anim = null;
    $('btnGira').textContent = '▶ Gira el cristall 360° (pols)'; $('btnEscombra').textContent = '▶ Escombra 2θ de −180° a 180°';
  }
  $('btnGira').addEventListener('click', () => {
    if (anim) { stopAnim(); return; }
    const start = state.phi, t0 = performance.now(), T = 9000;
    $('btnGira').textContent = '■ Atura';
    const step = now => {
      const f = Math.min(1, (now - t0) / T);
      setPhi(start + 360 * f);
      if (f < 1) anim.id = requestAnimationFrame(step); else stopAnim();
    };
    anim = { id: requestAnimationFrame(step) };
  });
  $('btnEscombra').addEventListener('click', () => {
    if (anim) { stopAnim(); return; }
    const t0 = performance.now(), T = 7000;
    $('btnEscombra').textContent = '■ Atura';
    const step = now => {
      const f = Math.min(1, (now - t0) / T);
      setTth(-180 + 360 * f);
      if (f < 1) anim.id = requestAnimationFrame(step); else stopAnim();
    };
    anim = { id: requestAnimationFrame(step) };
  });

  // arrossegar: el detector (sobre la seva circumferència) o el cristall (a l'interior)
  function pt(canvas, ev) {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * canvas.width / r.width, y: (ev.clientY - r.top) * canvas.height / r.height };
  }
  let drag = null;
  cLab.addEventListener('mousedown', ev => {
    const p = pt(cLab, ev), { cx, cy, R } = labGeom(), r = Math.hypot(p.x - cx, p.y - cy);
    const ang = Math.atan2(cy - p.y, p.x - cx) / DEG;
    drag = Math.abs(r - R) < 22 ? { what: 'tth', c: cLab, cx, cy } : { what: 'phi', c: cLab, cx, cy, a0: ang, phi0: state.phi };
    move(ev);
  });
  cRec.addEventListener('mousedown', ev => {
    const p = pt(cRec, ev), G = recGeom(), C = G.P({ x: -G.k, y: 0 });
    const r = Math.hypot(p.x - C.x, p.y - C.y);
    if (Math.abs(r - G.k * G.s) < 14) drag = { what: 'tth', c: cRec, cx: C.x, cy: C.y };
    else drag = { what: 'phi', c: cRec, cx: G.ox, cy: G.oy, a0: Math.atan2(G.oy - p.y, p.x - G.ox) / DEG, phi0: state.phi };
    move(ev);
  });
  function move(ev) {
    if (!drag) return;
    const p = pt(drag.c, ev), ang = Math.atan2(drag.cy - p.y, p.x - drag.cx) / DEG;
    if (drag.what === 'tth') setTth(norm180(ang));
    else setPhi(drag.phi0 + norm180(ang - drag.a0));
  }
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', () => { if (drag && drag.what === 'phi') { drag.phi0 = state.phi; } drag = null; });

  // ---------------------------------------------------------------
  // Configuració des de l'URL: ?lat=hex&a=3&lambda=1.54&N=20&phi=20&tth=40
  // ---------------------------------------------------------------
  (function fromURL() {
    const p = new URLSearchParams(location.search);
    if (['square', 'rect', 'hex'].includes(p.get('lat'))) state.lat = p.get('lat');
    const num = (k, f) => { if (p.has(k) && isFinite(+p.get(k))) f(+p.get(k)); };
    num('a', x => { if (x > 0.5 && x < 20) state.a = x; });
    num('ratio', x => { if (x > 0.3 && x < 4) state.ratio = x; });
    num('lambda', x => { if (x > 0.1 && x < 10) state.lambda = x; });
    num('N', x => { state.N = Math.max(5, Math.min(60, Math.round(x))); });
    num('phi', x => { state.phi = norm360(x); });
    num('tth', x => { state.tth = Math.max(-180, Math.min(180, x)); });
    $('selLat').value = state.lat; $('inA').value = state.a; $('inRatio').value = state.ratio; $('inLambda').value = state.lambda;
  })();
  resetAcc();
  render();
})();
