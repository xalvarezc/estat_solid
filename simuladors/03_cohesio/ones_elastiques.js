// Simulador — Elasticitat d'un cristall cúbic: llei de Hooke i ones elàstiques.
// Matriu de Voigt cúbica (C11, C12, C44). Ones planes de direcció n: equació de Christoffel
//   ρ v² e = Γ e,  Γ_ik = Σ_jl C_ijkl n_j n_l
//   Γ_xx = C11 nx² + C44 (ny² + nz²),  Γ_xy = (C12 + C44) nx ny,  i cíclicament.

(function () {
  'use strict';
  const { fmt, sig, Plot } = Coh;
  const TAU = Coh.TAU;
  const COL_MODE = ['#d62728', '#2980b9', '#00722b'];

  const MAT = {
    diamant: { nom: 'Diamant', C11: 1079, C12: 124, C44: 578, rho: 3515 },
    Si: { nom: 'Silici', C11: 165.7, C12: 63.9, C44: 79.6, rho: 2329 },
    Ge: { nom: 'Germani', C11: 128.5, C12: 48.3, C44: 66.8, rho: 5323 },
    Cu: { nom: 'Coure', C11: 168.4, C12: 121.4, C44: 75.4, rho: 8960 },
    Al: { nom: 'Alumini', C11: 108.2, C12: 61.3, C44: 28.5, rho: 2700 },
    W: { nom: 'Tungstè', C11: 523, C12: 203, C44: 160, rho: 19250 },
    NaCl: { nom: 'NaCl', C11: 49.1, C12: 12.8, C44: 12.8, rho: 2165 }
  };
  const state = {
    mat: 'diamant', C11: 1079, C12: 124, C44: 578, rho: 3515,
    theta: 0, mode: 0, def: 'uni', eps: 0.01, L: 5, playing: true
  };

  // ---------------------------------------------------------------
  // Àlgebra: valors i vectors propis d'una matriu simètrica 3×3 (Jacobi)
  // ---------------------------------------------------------------
  function eigSym(A) {
    const a = A.map(r => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let it = 0; it < 50; it++) {
      let p = 0, q = 1, m = Math.abs(a[0][1]);
      if (Math.abs(a[0][2]) > m) { p = 0; q = 2; m = Math.abs(a[0][2]); }
      if (Math.abs(a[1][2]) > m) { p = 1; q = 2; m = Math.abs(a[1][2]); }
      if (m < 1e-12) break;
      const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
    return [0, 1, 2].map(i => ({ val: a[i][i], vec: [V[0][i], V[1][i], V[2][i]] })).sort((x, y) => y.val - x.val);
  }
  // les tres ones en la direcció n (km/s), ordenades de la més ràpida a la més lenta
  function waves(n) {
    const { C11, C12, C44, rho } = state, [x, y, z] = n;
    const G = [
      [C11 * x * x + C44 * (y * y + z * z), (C12 + C44) * x * y, (C12 + C44) * x * z],
      [(C12 + C44) * x * y, C11 * y * y + C44 * (x * x + z * z), (C12 + C44) * y * z],
      [(C12 + C44) * x * z, (C12 + C44) * y * z, C11 * z * z + C44 * (x * x + y * y)]
    ];
    return eigSym(G).map(e => {
      const v = Math.sqrt(Math.max(0, e.val) * 1e9 / rho) / 1000;     // GPa → Pa, m/s → km/s
      const par = Math.abs(e.vec[0] * x + e.vec[1] * y + e.vec[2] * z);
      return { v, e: e.vec, par };
    });
  }
  const dirOf = th => [Math.cos(th * Math.PI / 180), Math.sin(th * Math.PI / 180), 0];
  const modeName = w => w.par > 0.999 ? 'longitudinal' : w.par < 0.001 ? 'transversal' : w.par > 0.5 ? 'quasi-longitudinal' : 'quasi-transversal';

  function moduli() {
    const { C11, C12, C44 } = state;
    return { B: (C11 + 2 * C12) / 3, G: C44, nu: C12 / (C11 + C12), E: (C11 - C12) * (C11 + 2 * C12) / (C11 + C12), A: 2 * C44 / (C11 - C12) };
  }

  // ---------------------------------------------------------------
  // Diagrama polar de les velocitats al pla (001)
  // ---------------------------------------------------------------
  const cP = document.getElementById('canvasPolar'), gP = cP.getContext('2d');
  function drawPolar() {
    const W = cP.width, H = cP.height, cx = W / 2, cy = H / 2 + 6;
    gP.clearRect(0, 0, W, H);
    const curves = [[], [], []];
    let vmax = 0;
    for (let t = 0; t <= 360; t += 2) { const ws = waves(dirOf(t)); ws.forEach((w, i) => { curves[i].push([t, w.v]); vmax = Math.max(vmax, w.v); }); }
    const R = Math.min(W, H) / 2 - 26, sc = R / (vmax * 1.05);
    // cercles de referència
    gP.strokeStyle = '#edf1ee'; gP.fillStyle = '#888'; gP.font = '10px sans-serif'; gP.textAlign = 'left';
    const st = Coh.ticks(0, vmax, 4).filter(v => v > 0);
    st.forEach(v => { gP.beginPath(); gP.arc(cx, cy, v * sc, 0, TAU); gP.stroke(); gP.fillText(v + ' km/s', cx + 3, cy - v * sc - 2); });
    gP.strokeStyle = '#ccc';
    gP.beginPath(); gP.moveTo(cx - R, cy); gP.lineTo(cx + R, cy); gP.moveTo(cx, cy - R); gP.lineTo(cx, cy + R); gP.stroke();
    gP.fillStyle = '#555'; gP.textAlign = 'center';
    gP.fillText('[100]', cx + R + 2, cy - 4); gP.fillText('[010]', cx, cy - R - 6);
    gP.fillText('[110]', cx + R * 0.74, cy - R * 0.74);
    curves.forEach((cv, i) => {
      gP.strokeStyle = COL_MODE[i]; gP.lineWidth = i === state.mode ? 3 : 1.6;
      gP.beginPath();
      cv.forEach(([t, v], j) => { const a = t * Math.PI / 180, x = cx + v * sc * Math.cos(a), y = cy - v * sc * Math.sin(a); if (j) gP.lineTo(x, y); else gP.moveTo(x, y); });
      gP.stroke();
    });
    // direcció actual
    const a = state.theta * Math.PI / 180;
    Coh.arrow(gP, cx, cy, cx + R * Math.cos(a), cy - R * Math.sin(a), '#111', 1.5);
    const ws = waves(dirOf(state.theta));
    ws.forEach((w, i) => { gP.fillStyle = COL_MODE[i]; gP.beginPath(); gP.arc(cx + w.v * sc * Math.cos(a), cy - w.v * sc * Math.sin(a), 4.5, 0, TAU); gP.fill(); });
    gP.fillStyle = '#555'; gP.textAlign = 'left'; gP.font = '11px sans-serif';
    gP.fillText('Velocitat del so segons la direcció, al pla (001)', 8, 14);
  }
  (function dragPolar() {
    let on = false;
    const set = ev => {
      const r = cP.getBoundingClientRect(), x = (ev.clientX - r.left) * cP.width / r.width - cP.width / 2, y = cP.height / 2 + 6 - (ev.clientY - r.top) * cP.height / r.height;
      state.theta = Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
      render();
    };
    cP.addEventListener('mousedown', ev => { on = true; set(ev); });
    window.addEventListener('mousemove', ev => { if (on) set(ev); });
    window.addEventListener('mouseup', () => { on = false; });
  })();

  // ---------------------------------------------------------------
  // Animació de l'ona sobre la xarxa (pla (001))
  // ---------------------------------------------------------------
  const cW = document.getElementById('canvasOna'), gW = cW.getContext('2d');
  let t0 = performance.now(), tAnim = 0;
  function drawWave() {
    const W = cW.width, H = cW.height;
    gW.clearRect(0, 0, W, H);
    const ws = waves(dirOf(state.theta)), w = ws[state.mode], n = dirOf(state.theta);
    const N = 15, sp = Math.min(W, H - 56) / (N + 1), ox = (W - sp * (N - 1)) / 2, oy = 22 + (H - 56 - sp * (N - 1)) / 2;
    const lam = 7 * sp, k = TAU / lam, omega = 2.2 * w.v / ws[0].v * 2;   // els modes lents oscil·len més a poc a poc
    const amp = 0.32 * sp;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x0 = ox + i * sp, y0 = oy + (N - 1 - j) * sp;
      const ph = k * (n[0] * i * sp + n[1] * j * sp) - omega * tAnim;
      const s = Math.sin(ph);
      const x = x0 + amp * w.e[0] * s, y = y0 - amp * w.e[1] * s, z = w.e[2] * s;
      gW.fillStyle = Math.abs(w.e[2]) > 0.05 ? (z > 0 ? 'rgba(214,39,40,' + (0.35 + 0.65 * Math.abs(z)) + ')' : 'rgba(41,128,185,' + (0.35 + 0.65 * Math.abs(z)) + ')') : '#2c3e50';
      gW.beginPath(); gW.arc(x, y, 4 + (Math.abs(w.e[2]) > 0.05 ? 2 * z : 0), 0, TAU); gW.fill();
    }
    // vectors n i e
    const cx = 24, cy = H - 16;
    Coh.arrow(gW, cx, cy, cx + 26 * n[0], cy - 26 * n[1], '#111', 2);
    gW.fillStyle = '#111'; gW.font = '11px sans-serif'; gW.textAlign = 'left';
    gW.fillText('n: propagació', cx + 30, cy + 4);
    const inPlane = Math.hypot(w.e[0], w.e[1]);
    if (inPlane > 0.05) Coh.arrow(gW, cx + 130, cy, cx + 130 + 26 * w.e[0], cy - 26 * w.e[1], COL_MODE[state.mode], 2);
    gW.fillStyle = COL_MODE[state.mode];
    gW.fillText(inPlane > 0.05 ? 'e: desplaçament' : 'e: perpendicular al pla', cx + (inPlane > 0.05 ? 160 : 130), cy + 4);
    gW.fillStyle = '#555';
    gW.fillText(modeName(w) + ' · v = ' + fmt(w.v, 2) + ' km/s', 8, 14);
  }
  function loop(now) {
    if (state.playing) tAnim += (now - t0) / 1000;
    t0 = now;
    drawWave();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------
  // Deformació d'un cub i llei de Hooke
  // ---------------------------------------------------------------
  const cD = document.getElementById('canvasDef'), gD = cD.getContext('2d');
  function strain() {
    const e = state.eps, { C11, C12 } = state, nu = C12 / (C11 + C12);
    // vector de Voigt [ε1..ε6] (ε4..ε6 són els canvis d'angle complets)
    if (state.def === 'uni') return [e, 0, 0, 0, 0, 0];
    if (state.def === 'poisson') return [e, -nu * e, -nu * e, 0, 0, 0];
    if (state.def === 'vol') return [e / 3, e / 3, e / 3, 0, 0, 0];
    return [0, 0, 0, 0, 0, e];
  }
  function stress(eps) {
    const { C11, C12, C44 } = state;
    return [C11 * eps[0] + C12 * (eps[1] + eps[2]), C11 * eps[1] + C12 * (eps[0] + eps[2]), C11 * eps[2] + C12 * (eps[0] + eps[1]), C44 * eps[3], C44 * eps[4], C44 * eps[5]];
  }
  function drawDef() {
    const W = cD.width, H = cD.height;
    gD.clearRect(0, 0, W, H);
    const e = strain(), mag = 0.25 / Math.max(1e-6, Math.abs(state.eps));   // exagerem la deformació perquè es vegi
    const S = 110, ox = W / 2 - S * 0.65, oy = H / 2 + S * 0.55;
    const proj = (x, y, z) => ({ X: ox + S * (x + 0.4 * z), Y: oy - S * (y + 0.4 * z) });
    const def = (x, y, z) => {
      const f = Math.min(mag, 25);
      return [x * (1 + f * e[0]) + f * e[5] * y, y * (1 + f * e[1]), z * (1 + f * e[2])];
    };
    const V = []; for (let i = 0; i < 8; i++) V.push([i & 1, (i >> 1) & 1, (i >> 2) & 1]);
    const edges = []; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if ([0, 1, 2].reduce((s, k) => s + Math.abs(V[i][k] - V[j][k]), 0) === 1) edges.push([i, j]);
    const drawCube = (f, col, w, dash) => {
      gD.strokeStyle = col; gD.lineWidth = w; gD.setLineDash(dash || []);
      edges.forEach(([i, j]) => { const a = proj(...f(...V[i])), b = proj(...f(...V[j])); gD.beginPath(); gD.moveTo(a.X, a.Y); gD.lineTo(b.X, b.Y); gD.stroke(); });
      gD.setLineDash([]);
    };
    drawCube((x, y, z) => [x, y, z], '#00722b', 1.5, [5, 4]);
    drawCube(def, '#d62728', 2.2);
    gD.fillStyle = '#555'; gD.font = '11px sans-serif'; gD.textAlign = 'left';
    gD.fillText('verd: cub original · vermell: deformat (exagerat ×' + fmt(Math.min(mag, 25), 0) + ')', 8, 14);
    ['x', 'y', 'z'].forEach((lab, k) => { const a = proj(0, 0, 0), b = proj(k === 0 ? 1.35 : 0, k === 1 ? 1.35 : 0, k === 2 ? 1.35 : 0); Coh.arrow(gD, a.X, a.Y, b.X, b.Y, '#999', 1); gD.fillStyle = '#777'; gD.fillText(lab, b.X + 3, b.Y); });
  }

  // ---------------------------------------------------------------
  // Fórmules, taules i lectures
  // ---------------------------------------------------------------
  const vtxt = x => fmt(x, 2) + ' km/s';
  function drawText() {
    const { C11, C12, C44, rho } = state, M = moduli();
    const ws = waves(dirOf(state.theta)), w = ws[state.mode];
    const r = v => Math.sqrt(v * 1e9 / rho) / 1000;
    const dirs = [
      { d: '[100]', L: r(C11), T1: r(C44), T2: r(C44), fL: 'C_{11}', fT: 'C_{44}', fT2: 'C_{44}' },
      { d: '[110]', L: r((C11 + C12 + 2 * C44) / 2), T1: r(C44), T2: r((C11 - C12) / 2), fL: '\\tfrac12(C_{11}+C_{12}+2C_{44})', fT: 'C_{44}', fT2: '\\tfrac12(C_{11}-C_{12})' },
      { d: '[111]', L: r((C11 + 2 * C12 + 4 * C44) / 3), T1: r((C11 - C12 + C44) / 3), T2: r((C11 - C12 + C44) / 3), fL: '\\tfrac13(C_{11}+2C_{12}+4C_{44})', fT: '\\tfrac13(C_{11}-C_{12}+C_{44})', fT2: '\\tfrac13(C_{11}-C_{12}+C_{44})' }
    ];
    document.getElementById('dirBody').innerHTML = dirs.map(d =>
      '<tr><td class="esq">' + d.d + '</td><td>' + vtxt(d.L) + '</td><td>' + vtxt(d.T1) + '</td><td>' + vtxt(d.T2) + '</td><td>' + fmt(state.L / d.L, 3) + ' µs</td><td>' + fmt(state.L / d.T1, 3) + ' µs</td></tr>').join('');
    const eps = strain(), sg = stress(eps), U = 0.5 * sg.reduce((s, x, i) => s + x * eps[i], 0);   // GPa (= GJ/m³)
    const defNom = { uni: 'Allargament uniaxial amb els costats subjectats', poisson: 'Allargament uniaxial amb els costats lliures', vol: 'Dilatació uniforme', cis: 'Cisallament pur al pla xy' }[state.def];
    Coh.formulas(document.getElementById('formules'), [
      { nom: 'Llei de Hooke cúbica', tex: [
        '\\sigma_1=C_{11}\\varepsilon_1+C_{12}(\\varepsilon_2+\\varepsilon_3),\\qquad \\sigma_4=C_{44}\\,\\varepsilon_4,\\qquad U=\\tfrac12\\sum_{ij}C_{ij}\\varepsilon_i\\varepsilon_j',
        'C_{11}=' + fmt(C11, 1) + ',\\quad C_{12}=' + fmt(C12, 1) + ',\\quad C_{44}=' + fmt(C44, 1) + '\\ \\text{GPa}'] },
      { nom: defNom, actiu: true, tex: [
        '\\varepsilon=(' + eps.map(x => fmt(x, 4)).join(',\\,') + ')',
        '\\sigma=(' + sg.map(x => sig(x, 3)).join(',\\,') + ')\\ \\text{GPa},\\qquad U=' + sig(U * 1000, 3) + '\\ \\text{MJ/m}^3'],
        nota: state.def === 'uni' ? 'Amb els costats subjectats, estirar en x fa aparèixer σ₂ = σ₃ = C₁₂ε: el material empeny les parets.'
          : state.def === 'poisson' ? 'Si els costats són lliures (σ₂ = σ₃ = 0), el material s\'estreny: ε⊥ = −ν ε, amb ν = C₁₂/(C₁₁ + C₁₂).'
          : state.def === 'vol' ? 'Dilatació uniforme: σ₁ = σ₂ = σ₃ = B Δ, amb Δ = ΔV/V. És la mateixa B de la corba de cohesió.'
          : 'Cisallament: només hi ha σ₆ = C₄₄ γ. El volum no canvia.' },
      { nom: 'Mòduls macroscòpics', tex: [
        'B=\\frac{C_{11}+2C_{12}}{3}=' + fmt(M.B, 1) + ',\\quad G=C_{44}=' + fmt(M.G, 1) + ',\\quad E=\\frac{(C_{11}-C_{12})(C_{11}+2C_{12})}{C_{11}+C_{12}}=' + fmt(M.E, 0) + '\\ \\text{GPa},\\quad \\nu=\\frac{C_{12}}{C_{11}+C_{12}}=' + fmt(M.nu, 3),
        'A=\\frac{2C_{44}}{C_{11}-C_{12}}=' + fmt(M.A, 2) + '\\quad(A=1:\\ \\text{isòtrop})'] },
      { nom: 'Ones en la direcció [100]', tex: [
        'v_L=\\sqrt{\\frac{C_{11}}{\\rho}}=' + fmt(dirs[0].L, 2) + '\\ \\text{km/s},\\qquad v_T=\\sqrt{\\frac{C_{44}}{\\rho}}=' + fmt(dirs[0].T1, 2) + '\\ \\text{km/s},\\qquad \\rho=' + rho + '\\ \\text{kg/m}^3'],
        nota: 'A l\'inrevés, C₁₁ = ρ v_L² i C₄₄ = ρ v_T²: mesurant el temps de vol de dos polsos a través d\'un gruix conegut s\'obtenen dues constants elàstiques. C₁₂ cal treure-la de la direcció [110].' },
      { nom: 'Direcció qualsevol: equació de Christoffel', tex: [
        '\\rho v^2\\,e_i=\\sum_k\\Gamma_{ik}\\,e_k,\\qquad \\Gamma_{xx}=C_{11}n_x^2+C_{44}(n_y^2+n_z^2),\\quad \\Gamma_{xy}=(C_{12}+C_{44})\\,n_xn_y,\\ \\dots'],
        nota: 'Per a cada direcció n hi ha tres ones, amb velocitats i polaritzacions e diferents. Només en direccions de simetria, com [100], [110] i [111], són purament longitudinals o transversals.' }
    ]);
    Coh.readout(document.getElementById('lectura'), [
      ['material', MAT[state.mat] ? MAT[state.mat].nom : 'personalitzat'],
      ['direcció n', '(' + dirOf(state.theta).slice(0, 2).map(x => fmt(x, 3)).join(', ') + ', 0)'],
      ['mode', modeName(w)],
      ['v', vtxt(w.v)],
      ['e·n', fmt(w.par, 3)],
      ['anisotropia A', fmt(M.A, 2)]
    ]);
    const est = document.getElementById('estat');
    const dA = Math.abs(M.A - 1);
    est.className = 'estat ' + (dA < 0.3 ? 'si' : 'no');
    est.textContent = dA < 0.03 ? 'Isòtrop: les velocitats no depenen de la direcció (les corbes polars són cercles).'
      : dA < 0.3 ? 'Gairebé isòtrop: les velocitats depenen poc de la direcció.'
      : 'Anisòtrop: les velocitats depenen molt de la direcció (mira el diagrama polar).';
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const SL = [['C11', 'C₁₁ (GPa)', 10, 1200, 0.1], ['C12', 'C₁₂ (GPa)', 0, 600, 0.1], ['C44', 'C₄₄ (GPa)', 5, 700, 0.1], ['rho', 'ρ (kg/m³)', 1000, 20000, 5]];
  $('sliders').innerHTML = SL.map(([k, lab, lo, hi, st]) =>
    '<div class="control-group"><label class="control-label" for="s_' + k + '">' + lab + ' <span class="val" id="v_' + k + '"></span></label>' +
    '<input type="range" class="slider" id="s_' + k + '" min="' + lo + '" max="' + hi + '" step="' + st + '"></div>').join('');
  SL.forEach(([k]) => $('s_' + k).addEventListener('input', ev => {
    state[k] = +ev.target.value;
    if (k !== 'rho' && $('chkIso').checked) state.C44 = Math.max(5, (state.C11 - state.C12) / 2);
    state.mat = ''; $('selMat').value = ''; render();
  }));
  $('selMat').innerHTML = Object.entries(MAT).map(([k, m]) => '<option value="' + k + '">' + m.nom + '</option>').join('') + '<option value="" disabled>Personalitzat</option>';
  function loadMat(k) { const m = MAT[k]; if (!m) return; state.mat = k; Object.assign(state, { C11: m.C11, C12: m.C12, C44: m.C44, rho: m.rho }); $('chkIso').checked = false; }
  $('selMat').addEventListener('change', () => { loadMat($('selMat').value); render(); });
  $('chkIso').addEventListener('change', () => { if ($('chkIso').checked) { state.C44 = Math.max(5, (state.C11 - state.C12) / 2); state.mat = ''; $('selMat').value = ''; } render(); });
  $('slTheta').addEventListener('input', () => { state.theta = +$('slTheta').value; render(); });
  document.querySelectorAll('[data-th]').forEach(b => b.addEventListener('click', () => { state.theta = +b.dataset.th; render(); }));
  const setModeBtn = Coh.optionGroup($('grupMode'), v => { state.mode = +v; render(); });
  const setDefBtn = Coh.optionGroup($('grupDef'), v => { state.def = v; render(); });
  $('slEps').addEventListener('input', () => { state.eps = +$('slEps').value; render(); });
  $('inL').addEventListener('change', () => { const x = +$('inL').value; if (x > 0) state.L = x; $('inL').value = state.L; render(); });
  $('btnPlay').addEventListener('click', () => { state.playing = !state.playing; $('btnPlay').textContent = state.playing ? '❚❚ Atura l\'ona' : '▶ Engega l\'ona'; });

  function render() {
    SL.forEach(([k]) => { $('s_' + k).value = state[k]; $('v_' + k).textContent = fmt(state[k], 1); });
    $('slTheta').value = state.theta; $('valTheta').textContent = state.theta + '°';
    $('slEps').value = state.eps; $('valEps').textContent = fmt(100 * state.eps, 2) + ' %';
    setModeBtn(String(state.mode)); setDefBtn(state.def);
    const ws = waves(dirOf(state.theta));
    document.querySelectorAll('#grupMode [data-v]').forEach(b => { const w = ws[+b.dataset.v]; b.textContent = ['1a', '2a', '3a'][+b.dataset.v] + ': ' + fmt(w.v, 1) + ' km/s'; });
    drawPolar(); drawDef(); drawText();
  }
  Coh.linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams();
    if (state.mat) p.set('mat', state.mat); else ['C11', 'C12', 'C44', 'rho'].forEach(k => p.set(k, state[k]));
    p.set('theta', state.theta); p.set('mode', state.mode); p.set('def', state.def); return p;
  });
  (function fromURL() {
    const p = Coh.params();
    loadMat(MAT[p.get('mat')] ? p.get('mat') : 'diamant');
    let custom = false;
    ['C11', 'C12', 'C44', 'rho'].forEach(k => Coh.num(p, k, x => { state[k] = x; custom = true; }, 0));
    if (custom) state.mat = '';
    $('selMat').value = state.mat;
    Coh.num(p, 'theta', x => { state.theta = Math.round(x) % 360; }, 0, 360);
    Coh.num(p, 'mode', x => { state.mode = Math.round(x); }, 0, 2);
    if (['uni', 'poisson', 'vol', 'cis'].includes(p.get('def'))) state.def = p.get('def');
    render();
    requestAnimationFrame(loop);
  })();
})();
