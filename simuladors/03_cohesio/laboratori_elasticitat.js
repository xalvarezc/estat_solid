// Laboratori d'elasticitat: un cristall 2D de milers d'àtoms, simulat en temps real.
// Xarxa triangular, enllaços entre primers veïns amb potencial de Morse (o harmònic):
//   V(s) = D (1 − e^(−α s))²,  s = r − a,  D = k/(2α²)  ⇒  V''(0) = k  (la corbatura de la corba de cohesió)
// Elasticitat 2D de la xarxa (teoria): λ = μ = √3 k/4,  E = 2k/√3,  ν = 1/3,  B = √3 k/2,
//   v_L = √(9/8) a√(k/m),  v_T = √(3/8) a√(k/m),  v_L/v_T = √3.
// Unitats reduïdes: a = 1, m = 1, k = 1.

(function () {
  'use strict';
  const { fmt, sig, Plot } = Coh;
  const TAU = Coh.TAU, SQ3 = Math.sqrt(3), HROW = SQ3 / 2;
  const TH = { lam: SQ3 / 4, mu: SQ3 / 4, E: 2 / SQ3, nu: 1 / 3, B: SQ3 / 2, vL: Math.sqrt(9 / 8), vT: Math.sqrt(3 / 8) };

  const state = {
    mode: 'traccio',            // traccio | cisalla | ones
    defecte: 'cap',             // cap | forat | esquerda
    mida: 6,                    // radi del forat o llargada de l'esquerda (a)
    model: 'morse', alpha: 6,
    eina: 'arrossega',          // arrossega | cop
    cop: 'radial',              // radial | vertical
    rate: 0.008, speed: 8, gamma: 0.08, colorRange: 0.04, cercles: true, color: 'enllac',
    loading: false
  };

  // ---------------------------------------------------------------
  // El cristall
  // ---------------------------------------------------------------
  let N = 0, X, Y, VX, VY, FX, FY, X0, Y0, FIX, ROW;
  let NB = 0, BI, BJ, ALIVE, STR;
  let rows, cols, H0, W0, disp, simT, broken, impacts, midRow, w0mid, anchor = -1;
  let curve, sigma, sigmaMax, epsAtMax, fractured, fracMsg;
  const history = [];

  function build() {
    const isW = state.mode === 'ones';
    cols = isW ? 66 : 38; rows = isW ? 76 : 54;
    const xs = [], ys = [], rws = [], idx = new Int32Array(rows * cols).fill(-1);
    const W = cols - 0.5, Hh = (rows - 1) * HROW, cxm = W / 2, cym = Hh / 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c + (r % 2) * 0.5, y = r * HROW;
      // defectes
      if (state.defecte === 'forat' && Math.hypot(x - cxm, y - cym) < state.mida) continue;
      if (state.defecte === 'esquerda' && Math.abs(y - cym) < 0.45 && x < state.mida) continue;
      idx[r * cols + c] = xs.length; xs.push(x); ys.push(y); rws.push(r);
    }
    N = xs.length;
    X = Float64Array.from(xs); Y = Float64Array.from(ys); X0 = Float64Array.from(xs); Y0 = Float64Array.from(ys);
    ROW = Int32Array.from(rws);
    VX = new Float64Array(N); VY = new Float64Array(N); FX = new Float64Array(N); FY = new Float64Array(N);
    FIX = new Uint8Array(N);
    if (!isW) for (let i = 0; i < N; i++) { if (ROW[i] <= 1) FIX[i] = 1; else if (ROW[i] >= rows - 2) FIX[i] = 2; }
    // a tracció les mordasses són lliscants (només fixen la y); un sol àtom de baix fixa la x
    anchor = -1;
    if (!isW) { let bd = Infinity; for (let i = 0; i < N; i++) if (ROW[i] === 0) { const d = Math.abs(X[i] - cxm); if (d < bd) { bd = d; anchor = i; } } }
    // enllaços entre primers veïns
    const bi = [], bj = [];
    const add = (r1, c1, r2, c2) => {
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) return;
      const a = idx[r1 * cols + c1], b = idx[r2 * cols + c2];
      if (a >= 0 && b >= 0) { bi.push(a); bj.push(b); }
    };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (idx[r * cols + c] < 0) continue;
      add(r, c, r, c + 1);
      if (r % 2 === 0) { add(r, c, r + 1, c - 1); add(r, c, r + 1, c); }
      else { add(r, c, r + 1, c); add(r, c, r + 1, c + 1); }
    }
    NB = bi.length; BI = Int32Array.from(bi); BJ = Int32Array.from(bj);
    ALIVE = new Uint8Array(NB).fill(1); STR = new Float64Array(NB);
    // geometria de referència
    H0 = (rows - 3) * HROW;             // entre la fila interior de cada mordassa
    W0 = cols;
    midRow = Math.floor(rows / 2) + (state.defecte === 'esquerda' ? 6 : 0);
    w0mid = rowWidth(midRow);
    disp = 0; simT = 0; broken = 0; nu1 = NaN; holdStart = null; holdDone = false; impacts = []; curve = []; sigma = 0; sigmaMax = 0; epsAtMax = 0; fractured = false; fracMsg = '';
    state.loading = false; updatePlayBtn();
  }
  function rowWidth(r) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < N; i++) if (ROW[i] === r) { lo = Math.min(lo, X[i]); hi = Math.max(hi, X[i]); }
    return hi - lo;
  }

  // ---------------------------------------------------------------
  // Dinàmica
  // ---------------------------------------------------------------
  let drag = null;   // {i, x, y}
  function forces() {
    FX.fill(0); FY.fill(0);
    const morse = state.model === 'morse', al = state.alpha, sCut = 3 * Math.LN2 / al;
    for (let b = 0; b < NB; b++) {
      if (!ALIVE[b]) continue;
      const i = BI[b], j = BJ[b], dx = X[j] - X[i], dy = Y[j] - Y[i], r = Math.sqrt(dx * dx + dy * dy), s = r - 1;
      STR[b] = s;
      let dV;
      if (morse) {
        if (s > sCut) { ALIVE[b] = 0; broken++; continue; }
        const e = Math.exp(-al * s); dV = e * (1 - e) / al;        // (k/α) e (1−e), amb k = 1
      } else dV = s;
      const f = dV / r;
      FX[i] += f * dx; FY[i] += f * dy; FX[j] -= f * dx; FY[j] -= f * dy;
    }
    if (drag) {
      const K = 0.6, i = drag.i;
      FX[i] += K * (drag.x - X[i]) - 0.6 * VX[i]; FY[i] += K * (drag.y - Y[i]) - 0.6 * VY[i];
    }
  }
  function step(dt) {
    // càrrega quasi estàtica: la mordassa superior avança i tot el cristall es deforma de manera afí
    // (cada àtom proporcionalment a la seva alçada); després els enllaços relaxen. Així no hi ha ones de xoc
    // ni fregament que falsegin la tensió mesurada.
    if (state.loading && state.mode !== 'ones' && !holding()) {
      const dd = state.rate * dt, y1 = HROW;
      disp += dd;
      for (let i = 0; i < N; i++) {
        if (FIX[i]) continue;
        let f = (Y0[i] - y1) / H0; f = f < 0 ? 0 : f > 1 ? 1 : f;
        if (state.mode === 'traccio') Y[i] += dd * f; else X[i] += dd * f;
      }
    }
    const tr = state.mode === 'traccio';
    for (let i = 0; i < N; i++) {
      if (!FIX[i]) continue;
      if (tr) {
        Y[i] = Y0[i] + (FIX[i] === 2 ? disp : 0); VY[i] = 0;
        if (i === anchor) { X[i] = X0[i]; VX[i] = 0; }
      } else {
        X[i] = X0[i] + (FIX[i] === 2 ? disp : 0); Y[i] = Y0[i]; VX[i] = VY[i] = 0;
      }
    }
    forces();
    const damp = 1 - (state.mode === 'ones' ? 0 : state.gamma) * dt;
    for (let i = 0; i < N; i++) {
      if (FIX[i]) {
        // mordassa lliscant: l'àtom es pot moure en x
        if (tr && i !== anchor) { VX[i] = (VX[i] + FX[i] * dt) * damp; X[i] += VX[i] * dt; }
        continue;
      }
      VX[i] = (VX[i] + FX[i] * dt) * damp; VY[i] = (VY[i] + FY[i] * dt) * damp;
      X[i] += VX[i] * dt; Y[i] += VY[i] * dt;
    }
    // tensió sobre la mordassa superior (reacció de les forces dels enllaços)
    if (state.mode !== 'ones') {
      let F = 0;
      for (let i = 0; i < N; i++) if (FIX[i] === 2) F += state.mode === 'traccio' ? FY[i] : FX[i];
      const s = -F / W0;
      sigma += 0.08 * (s - sigma);
    }
    simT += dt;
  }

  // ---------------------------------------------------------------
  // Mesures
  // ---------------------------------------------------------------
  const strain = () => disp / H0;
  function measureE() {
    const pts = curve.filter(p => p[0] > 0.001 && p[0] < 0.006);
    if (pts.length < 5) return NaN;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(([x, y]) => { sx += x; sy += y; sxx += x * x; sxy += x * y; });
    const n = pts.length;
    return (n * sxy - sx * sy) / (n * sxx - sx * sx);
  }
  // Poisson: es mesura a ε ≈ 1 %, encara en règim elàstic, i es congela
  // A ε = 1 % la càrrega s'atura un moment perquè el cristall relaxi lateralment, i aleshores es mesura ν.
  let nu1 = NaN, holdStart = null, holdDone = false;
  const HOLD = 160;
  const holding = () => holdStart !== null && !holdDone;
  function measureNu() {
    if (state.mode !== 'traccio' || state.defecte !== 'cap') return NaN;
    const e = strain();
    if (!holdDone && holdStart === null && e >= 0.01 && !broken) holdStart = simT;
    if (holding() && simT - holdStart > HOLD) { nu1 = -((rowWidth(midRow) - w0mid) / w0mid) / e; holdDone = true; }
    return nu1;
  }
  // concentració de tensió al costat del forat: deformació dels enllaços gairebé verticals a l'equador vs lluny
  function concentration() {
    if (state.mode !== 'traccio' || state.defecte !== 'forat' || strain() < 0.002) return NaN;
    const cx = (cols - 0.5) / 2, cy = (rows - 1) * HROW / 2, R = state.mida;
    let se = 0, ne = 0, sf = 0, nf = 0;
    for (let b = 0; b < NB; b++) {
      if (!ALIVE[b]) continue;
      const i = BI[b], j = BJ[b];
      if (Math.abs(Y0[j] - Y0[i]) < 0.5) continue;             // només els enllaços inclinats (±60°)
      const mx = (X0[i] + X0[j]) / 2 - cx, my = (Y0[i] + Y0[j]) / 2 - cy;
      if (Math.abs(my) < 1 && Math.abs(Math.abs(mx) - R) < 1.6) { se += STR[b]; ne++; }
      else if (Math.abs(my) > R + 8 && Math.abs(my) < R + 14 && Math.abs(mx) < 6) { sf += STR[b]; nf++; }
    }
    return ne && nf && sf > 0 ? (se / ne) / (sf / nf) : NaN;
  }

  // ---------------------------------------------------------------
  // Dibuix del cristall
  // ---------------------------------------------------------------
  const cv = document.getElementById('canvasCristall'), g = cv.getContext('2d');
  const NBUCK = 25;
  const PAL = (() => {
    const out = [];
    for (let k = 0; k < NBUCK; k++) {
      const t = k / (NBUCK - 1) * 2 - 1;        // −1 (comprimit) … +1 (estirat)
      let r, gg, b;
      if (t < 0) { const u = -t; r = 60 * (1 - u) + 30 * u; gg = 90 * (1 - u) + 170 * u; b = 80 * (1 - u) + 255 * u; }
      else { const u = t; r = 60 + 195 * u; gg = 90 + (u < 0.6 ? 60 * u : 36 + 180 * (u - 0.6)); b = 80 * (1 - u); }
      out.push('rgb(' + Math.round(r) + ',' + Math.round(gg) + ',' + Math.round(b) + ')');
    }
    return out;
  })();
  const PALV = (() => {
    const out = [];
    for (let k = 0; k < NBUCK; k++) {
      const u = k / (NBUCK - 1);
      const r = u < 0.5 ? 40 + 2 * u * 60 : 100 + (u - 0.5) * 2 * 155, gg = 40 + u * 215, b = u < 0.6 ? 50 + u * 60 : 86 + (u - 0.6) * 2.5 * 169;
      out.push('rgb(' + Math.round(r) + ',' + Math.round(gg) + ',' + Math.round(b) + ')');
    }
    return out;
  })();
  let view = null;
  function computeView() {
    const Wd = cols + 2, Hd = (rows - 1) * HROW + (state.mode === 'ones' ? 2 : 10);
    const sc = Math.min((cv.width - 20) / Wd, (cv.height - 20) / Hd);
    view = { sc, ox: (cv.width - sc * (cols - 0.5)) / 2,
      oy: state.mode === 'ones' ? cv.height - (cv.height - sc * (rows - 1) * HROW) / 2 : cv.height - 2.6 * sc - 8 };
  }
  const SX = x => view.ox + x * view.sc, SY = y => view.oy - y * view.sc;
  const WX = px => (px - view.ox) / view.sc, WY = py => (view.oy - py) / view.sc;
  function draw() {
    const W = cv.width, H = cv.height;
    g.fillStyle = '#0d1612'; g.fillRect(0, 0, W, H);
    const rng = state.colorRange;
    if (state.color === 'vel') {
      // enllaços tènues i àtoms acolorits per la velocitat: els fronts d'ona es veuen com anells
      g.strokeStyle = 'rgba(120,150,135,0.18)'; g.lineWidth = 1; g.beginPath();
      for (let b = 0; b < NB; b++) { if (!ALIVE[b]) continue; const i = BI[b], j = BJ[b]; g.moveTo(SX(X[i]), SY(Y[i])); g.lineTo(SX(X[j]), SY(Y[j])); }
      g.stroke();
      const vb = Array.from({ length: NBUCK }, () => []), vmax = rng * 2.5, rr = Math.max(1.5, view.sc * 0.42);
      for (let i = 0; i < N; i++) {
        let t = Math.hypot(VX[i], VY[i]) / vmax; if (t > 1) t = 1;
        if (t < 0.04) continue;
        vb[Math.round(t * (NBUCK - 1))].push(i);
      }
      vb.forEach((list, k) => { if (!list.length) return; g.fillStyle = PALV[k]; list.forEach(i => g.fillRect(SX(X[i]) - rr, SY(Y[i]) - rr, 2 * rr, 2 * rr)); });
    } else {
    const buckets = Array.from({ length: NBUCK }, () => []);
    for (let b = 0; b < NB; b++) {
      if (!ALIVE[b]) continue;
      let t = STR[b] / rng; t = t < -1 ? -1 : t > 1 ? 1 : t;
      buckets[Math.round((t + 1) / 2 * (NBUCK - 1))].push(b);
    }
    g.lineWidth = Math.max(1, view.sc * 0.22); g.lineCap = 'round';
    buckets.forEach((list, k) => {
      if (!list.length) return;
      g.strokeStyle = PAL[k]; g.beginPath();
      list.forEach(b => { const i = BI[b], j = BJ[b]; g.moveTo(SX(X[i]), SY(Y[i])); g.lineTo(SX(X[j]), SY(Y[j])); });
      g.stroke();
    });
    }
    // mordasses
    if (state.mode !== 'ones') {
      g.fillStyle = 'rgba(200,210,205,0.85)';
      for (let i = 0; i < N; i++) if (FIX[i]) { g.beginPath(); g.arc(SX(X[i]), SY(Y[i]), Math.max(1.5, view.sc * 0.28), 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(200,210,205,0.25)';
      const yTop = SY((rows - 1) * HROW + (state.mode === 'traccio' ? disp : 0)), yBot = SY(0);
      const xoff = state.mode === 'cisalla' ? disp * view.sc : 0;
      g.fillRect(SX(-0.8) + xoff, yTop - 2.2 * view.sc, (cols + 1.1) * view.sc, 1.6 * view.sc);
      g.fillRect(SX(-0.8), yBot + 0.6 * view.sc, (cols + 1.1) * view.sc, 1.6 * view.sc);
    }
    // fronts d'ona teòrics
    if (state.mode === 'ones' && state.cercles) {
      impacts.forEach(im => {
        const dt = simT - im.t;
        [[TH.vL, 'rgba(255,214,90,0.9)', 'P'], [TH.vT, 'rgba(120,200,255,0.9)', 'S']].forEach(([v, col, lab]) => {
          const R = v * dt;
          if (R > cols * 1.6) return;
          g.strokeStyle = col; g.lineWidth = 1.5; g.setLineDash([6, 5]);
          g.beginPath(); g.arc(SX(im.x), SY(im.y), R * view.sc, 0, TAU); g.stroke(); g.setLineDash([]);
          g.fillStyle = col; g.font = 'bold 12px sans-serif'; g.fillText(lab, SX(im.x) + R * view.sc * 0.71 + 4, SY(im.y) - R * view.sc * 0.71 - 4);
        });
      });
    }
    if (drag) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(SX(X[drag.i]), SY(Y[drag.i])); g.lineTo(SX(drag.x), SY(drag.y)); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(SX(drag.x), SY(drag.y), 4, 0, TAU); g.fill(); }
    // rètols
    g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillStyle = 'rgba(230,240,235,0.9)';
    g.fillText(N + ' àtoms · ' + (NB - broken) + ' enllaços' + (broken ? ' · ' + broken + ' trencats' : '') + ' · t = ' + fmt(simT, 0), 10, 18);
    if (fractured) { g.font = 'bold 26px sans-serif'; g.fillStyle = '#ff5a3c'; g.textAlign = 'center'; g.fillText(fracMsg, W / 2, 46); }
    // escala de colors
    const lx = W - 170, ly = H - 22;
    const vel = state.color === 'vel';
    for (let k = 0; k < NBUCK; k++) { g.fillStyle = (vel ? PALV : PAL)[k]; g.fillRect(lx + k * 6, ly, 6, 8); }
    g.fillStyle = 'rgba(230,240,235,0.85)'; g.font = '10px sans-serif'; g.textAlign = 'center';
    g.fillText(vel ? 'quiet' : 'comprimit', lx + 10, ly - 4); g.fillText(vel ? 'ràpid' : 'estirat', lx + NBUCK * 6 - 10, ly - 4);
    g.fillText(vel ? 'velocitat dels àtoms' : '±' + fmt(100 * rng, 1) + ' %', lx + NBUCK * 3, ly + 19);
  }

  // ---------------------------------------------------------------
  // Corba tensió-deformació
  // ---------------------------------------------------------------
  const cP = document.getElementById('canvasCorba');
  const pP = Plot(cP, { xmin: 0, xmax: 0.15, ymin: 0, ymax: 0.06, m: { l: 58, r: 14, t: 16, b: 40 } });
  function drawCurve() {
    const isT = state.mode === 'traccio', mod = isT ? TH.E : TH.mu;
    const emax = Math.max(0.03, ...curve.map(p => p[0])) * 1.15, smax = Math.max(0.02, ...curve.map(p => p[1]), mod * 0.02) * 1.2;
    Object.assign(pP, { xmax: emax, ymax: smax });
    pP.clear();
    if (state.mode === 'ones') {
      pP.g.fillStyle = '#555'; pP.g.font = '13px sans-serif'; pP.g.textAlign = 'center';
      pP.g.fillText('Al mode "cop de martell" no hi ha assaig: mira els fronts d\'ona.', cP.width / 2, cP.height / 2);
      return;
    }
    pP.axes(isT ? 'deformació ε = Δh/h₀' : 'deformació de cisallament γ = Δx/h₀', isT ? 'tensió σ (k/a)' : 'tensió de cisallament τ (k/a)');
    pP.fn(e => mod * e, { col: '#9aa8a0', w: 1.5, dash: [6, 4] });
    pP.pts(curve, { col: '#d62728', w: 2.2 });
    if (sigmaMax > 0 && broken > 0) { pP.dot(epsAtMax, sigmaMax, '#111', 5); pP.text('màxim: σ = ' + sig(sigmaMax, 3), epsAtMax, sigmaMax, { dx: 8, dy: -6, font: '11px sans-serif' }); }
    pP.legend([{ nom: 'mesurada a la simulació', col: '#d62728' }, { nom: isT ? 'teoria lineal: σ = E ε, E = 2k/√3' : 'teoria lineal: τ = μ γ, μ = √3 k/4', col: '#9aa8a0', dash: [6, 4] }], { left: true });
  }

  // ---------------------------------------------------------------
  // Fórmules, lectures, historial
  // ---------------------------------------------------------------
  let lastText = 0;
  function drawText(force) {
    const now = performance.now();
    if (!force && now - lastText < 250) return;
    lastText = now;
    const e = strain(), Em = measureE(), nu = measureNu(), kc = concentration();
    const isT = state.mode === 'traccio';
    const rows2 = [
      ['àtoms / enllaços', N + ' / ' + (NB - broken)],
      ['enllaços trencats', String(broken)]
    ];
    if (state.mode !== 'ones') {
      rows2.push([isT ? 'deformació ε' : 'cisallament γ', fmt(100 * e, 2) + ' %'], [isT ? 'tensió σ' : 'tensió τ', sig(sigma, 3) + ' k/a']);
      rows2.push([isT ? 'E mesurat (pendent inicial)' : 'μ mesurat', isFinite(Em) ? fmt(Em, 3) + '  (teoria ' + fmt(isT ? TH.E : TH.mu, 3) + ')' : '—']);
      if (isT) rows2.push(['ν mesurat a ε = 1 %', isFinite(nu) ? fmt(nu, 3) + '  (teoria 0.333)' : '—']);
      if (isFinite(kc)) rows2.push(['concentració al forat', '×' + fmt(kc, 2) + '  (placa infinita: ×3)']);
      if (sigmaMax > 0) rows2.push(['tensió màxima', sig(sigmaMax, 3) + ' k/a a ε = ' + fmt(100 * epsAtMax, 1) + ' %']);
    } else {
      rows2.push(['v_L teòrica', fmt(TH.vL, 3) + ' a√(k/m)'], ['v_T teòrica', fmt(TH.vT, 3) + ' a√(k/m)'], ['v_L / v_T', fmt(TH.vL / TH.vT, 3) + ' = √3']);
    }
    Coh.readout(document.getElementById('lectura'), rows2);
    const est = document.getElementById('estat');
    est.className = 'estat ' + (fractured ? 'no' : 'si');
    est.textContent = fractured ? fracMsg + ' La fractura ha començat on la tensió era més concentrada.'
      : state.mode === 'ones' ? (impacts.length ? 'Les ones P (groc) avancen √3 vegades més de pressa que les S (blau).' : 'Clica el cristall per donar-hi un cop.')
      : holding() ? 'Pausa a ε = 1 %: el cristall relaxa lateralment i es mesura ν…'
      : state.loading ? 'Estirant… mira com canvia el color dels enllaços.' : 'Prem "Comença l\'assaig" o arrossega àtoms amb el ratolí.';
  }
  function drawFormulas() {
    const al = state.alpha;
    Coh.formulas(document.getElementById('formules'), [
      { nom: 'De la corba de cohesió a la molla', tex: [
        state.model === 'morse'
          ? 'V(r)=D\\left(1-e^{-\\alpha(r-a)}\\right)^2,\\qquad k=V\'\'(a)=2D\\alpha^2,\\qquad F_{\\max}=\\frac{k}{4\\alpha}=' + fmt(1 / (4 * al), 4) + '\\,ka\\ \\text{a}\\ r=a+\\frac{\\ln2}{\\alpha}=' + fmt(1 + Math.LN2 / al, 3) + '\\,a'
          : 'V(r)=\\tfrac12k(r-a)^2\\qquad\\text{(harmònic: cap enllaç no es trenca)}'],
        nota: 'Cada enllaç és la corba de cohesió d\'un parell d\'àtoms. Prop del mínim és una molla de constant k = V″(a), la corbatura del Tema 3. Lluny del mínim, la força té un màxim i l\'enllaç es trenca.' },
      { nom: 'Elasticitat de la xarxa triangular (teoria)', actiu: state.mode !== 'ones', tex: [
        '\\lambda=\\mu=\\frac{\\sqrt3}{4}k=' + fmt(TH.mu, 4) + ',\\qquad E=\\frac{2k}{\\sqrt3}=' + fmt(TH.E, 4) + ',\\qquad \\nu=\\frac13,\\qquad B=\\lambda+\\mu=\\frac{\\sqrt3}{2}k'],
        nota: 'Constants en 2D (força per unitat de longitud). La xarxa triangular és isòtropa en el pla, i amb molles només entre primers veïns compleix λ = μ (relació de Cauchy), d\'on ν = 1/3. Ho pots comprovar a la taula de valors mentre l\'estires.' },
      { nom: 'Ones elàstiques (teoria)', actiu: state.mode === 'ones', tex: [
        'v_L=\\sqrt{\\frac{\\lambda+2\\mu}{\\rho}}=\\sqrt{\\tfrac98}\\,a\\sqrt{\\tfrac km}=' + fmt(TH.vL, 3) + ',\\qquad v_T=\\sqrt{\\frac{\\mu}{\\rho}}=\\sqrt{\\tfrac38}\\,a\\sqrt{\\tfrac km}=' + fmt(TH.vT, 3) + ',\\qquad \\frac{v_L}{v_T}=\\sqrt3'],
        nota: 'ρ = m/(√3a²/2) és la massa per unitat d\'àrea. Els cercles discontinus del mode "cop de martell" avancen exactament a aquestes velocitats: comprova que els fronts de la simulació hi coincideixen.' },
      { nom: 'Defectes', tex: ['\\sigma_{\\text{vora del forat}}\\simeq3\\,\\sigma_\\infty\\quad\\text{(Kirsch)},\\qquad \\sigma_{\\text{ruptura}}\\propto\\frac{1}{\\sqrt{L}}\\quad\\text{(Griffith)}'],
        nota: 'Un forat circular multiplica per 3 la tensió al seu costat; una esquerda de llargada L concentra la tensió a la seva punta, i com més llarga és, menys tensió cal per trencar el cristall.' }
    ]);
  }
  function drawHistory() {
    document.getElementById('histBody').innerHTML = history.length ? history.map((h, i) =>
      '<tr><td>' + (i + 1) + '</td><td class="esq">' + h.mode + '</td><td class="esq">' + h.def + '</td><td>' + sig(h.smax, 3) + '</td><td>' + fmt(100 * h.emax, 2) + ' %</td><td>' + (isFinite(h.E) ? fmt(h.E, 3) : '—') + '</td></tr>').join('')
      : '<tr><td colspan="6">Encara no hi ha cap assaig acabat. Estira el cristall fins que es trenqui.</td></tr>';
  }

  // ---------------------------------------------------------------
  // Bucle principal
  // ---------------------------------------------------------------
  function frame() {
    const dt = 0.08;
    for (let s = 0; s < state.speed; s++) step(dt);
    if (state.mode !== 'ones' && state.loading) {
      const e = strain();
      if (!curve.length || e - curve[curve.length - 1][0] > 0.0004) curve.push([e, sigma]);
      if (sigma > sigmaMax) { sigmaMax = sigma; epsAtMax = e; }
      if (!fractured && broken > 0 && sigmaMax > 0 && sigma < 0.25 * sigmaMax) {
        fractured = true; fracMsg = 'TRENCAT!'; state.loading = false; updatePlayBtn();
        history.push({ mode: state.mode === 'traccio' ? 'tracció' : 'cisallament', def: state.defecte === 'cap' ? 'cap' : (state.defecte === 'forat' ? 'forat R = ' : 'esquerda L = ') + (state.defecte === 'cap' ? '' : state.mida), smax: sigmaMax, emax: epsAtMax, E: measureE() });
        drawHistory();
      }
      if (strain() > 0.6) { state.loading = false; updatePlayBtn(); }
    }
    measureNu();
    draw(); drawCurve(); drawText(false);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------
  // Interacció amb el ratolí
  // ---------------------------------------------------------------
  function evPos(ev) { const r = cv.getBoundingClientRect(); return { x: WX((ev.clientX - r.left) * cv.width / r.width), y: WY((ev.clientY - r.top) * cv.height / r.height) }; }
  cv.addEventListener('mousedown', ev => {
    const p = evPos(ev);
    if (state.eina === 'cop') {
      const v0 = 0.25;
      for (let i = 0; i < N; i++) {
        if (FIX[i]) continue;
        const dx = X[i] - p.x, dy = Y[i] - p.y, r = Math.hypot(dx, dy);
        if (r > 2.2) continue;
        const w = Math.exp(-r * r / 1.5);
        if (state.cop === 'radial') { if (r > 1e-6) { VX[i] += v0 * w * dx / r; VY[i] += v0 * w * dy / r; } }
        else VY[i] -= v0 * w;
      }
      impacts.push({ x: p.x, y: p.y, t: simT });
      if (impacts.length > 3) impacts.shift();
      return;
    }
    let best = -1, bd = 3;
    for (let i = 0; i < N; i++) { if (FIX[i]) continue; const d = Math.hypot(X[i] - p.x, Y[i] - p.y); if (d < bd) { bd = d; best = i; } }
    if (best >= 0) drag = { i: best, x: p.x, y: p.y };
  });
  window.addEventListener('mousemove', ev => { if (drag) { const p = evPos(ev); drag.x = p.x; drag.y = p.y; } });
  window.addEventListener('mouseup', () => { drag = null; });

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  function updatePlayBtn() { const b = $('btnPlay'); if (b) { b.textContent = state.loading ? '❚❚ Atura la càrrega' : '▶ Comença l\'assaig'; b.disabled = state.mode === 'ones'; } }
  function rebuild() {
    build(); computeView(); syncUI(); drawFormulas(); drawText(true); drawHistory();
  }
  function syncUI() {
    $('blocCop').style.display = state.eina === 'cop' ? '' : 'none';
    $('slMida').disabled = state.defecte === 'cap';
    $('valMida').textContent = state.defecte === 'cap' ? '—' : state.mida + ' a';
    $('slAlpha').disabled = state.model !== 'morse';
    $('valAlpha').textContent = fmt(state.alpha, 1) + '  (trenca a ~' + fmt(100 * Math.LN2 / state.alpha, 0) + ' %)';
    $('valRate').textContent = fmt(state.rate, 3);
    $('valSpeed').textContent = '×' + state.speed;
    $('valColor').textContent = '±' + fmt(100 * state.colorRange, 1) + ' %';
    $('slColor').value = Math.log10(state.colorRange);
  }
  const setMode = Coh.optionGroup($('grupMode'), v => {
    state.mode = v;
    state.eina = v === 'ones' ? 'cop' : 'arrossega'; setEina(state.eina);
    state.colorRange = v === 'ones' ? 0.006 : 0.04;
    state.color = v === 'ones' ? 'vel' : 'enllac'; setColor(state.color);
    if (v === 'ones') { state.defecte = 'cap'; setDef('cap'); }
    rebuild();
  });
  const setDef = Coh.optionGroup($('grupDef'), v => { state.defecte = v; if (v === 'forat') state.mida = Math.min(state.mida, 10); rebuild(); });
  const setEina = Coh.optionGroup($('grupEina'), v => { state.eina = v; syncUI(); });
  const setCop = Coh.optionGroup($('grupCop'), v => { state.cop = v; });
  const setModel = Coh.optionGroup($('grupModel'), v => { state.model = v; rebuild(); });
  const setColor = Coh.optionGroup($('grupColor'), v => { state.color = v; });
  $('slMida').addEventListener('change', () => { state.mida = +$('slMida').value; rebuild(); });
  $('slMida').addEventListener('input', () => { $('valMida').textContent = $('slMida').value + ' a'; });
  $('slAlpha').addEventListener('change', () => { state.alpha = +$('slAlpha').value; rebuild(); });
  $('slAlpha').addEventListener('input', () => { state.alpha = +$('slAlpha').value; syncUI(); });
  $('slRate').addEventListener('input', () => { state.rate = +$('slRate').value; syncUI(); });
  $('slSpeed').addEventListener('input', () => { state.speed = +$('slSpeed').value; syncUI(); });
  $('slColor').addEventListener('input', () => { state.colorRange = Math.pow(10, +$('slColor').value); syncUI(); });
  $('chkCercles').addEventListener('change', () => { state.cercles = $('chkCercles').checked; });
  $('btnPlay').addEventListener('click', () => { if (fractured) return; state.loading = !state.loading; updatePlayBtn(); });
  $('btnReset').addEventListener('click', rebuild);

  Coh.linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams(); p.set('mode', state.mode); p.set('defecte', state.defecte);
    if (state.defecte !== 'cap') p.set('mida', state.mida);
    p.set('model', state.model); if (state.model === 'morse') p.set('alpha', state.alpha); return p;
  });
  (function fromURL() {
    const p = Coh.params();
    if (['traccio', 'cisalla', 'ones'].includes(p.get('mode'))) state.mode = p.get('mode');
    if (['cap', 'forat', 'esquerda'].includes(p.get('defecte'))) state.defecte = p.get('defecte');
    if (['morse', 'harmonic'].includes(p.get('model'))) state.model = p.get('model');
    Coh.num(p, 'mida', x => { state.mida = Math.round(x); }, 1, 20);
    Coh.num(p, 'alpha', x => { state.alpha = x; }, 2, 12);
    if (state.mode === 'ones') { state.eina = 'cop'; state.colorRange = 0.006; state.defecte = 'cap'; state.color = 'vel'; }
    setMode(state.mode); setDef(state.defecte); setEina(state.eina); setCop(state.cop); setModel(state.model); setColor(state.color);
    $('slMida').value = state.mida; $('slAlpha').value = state.alpha; $('slRate').value = state.rate; $('slSpeed').value = state.speed;
    rebuild();
    if (p.get('auto') === '1' && state.mode !== 'ones') { state.loading = true; updatePlayBtn(); }
    requestAnimationFrame(frame);
  })();
})();
