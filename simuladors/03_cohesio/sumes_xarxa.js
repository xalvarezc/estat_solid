// Simulador — Del parell al cristall: sumes de xarxa de Lennard-Jones.
// e(r) = ½ Σ_j V(p_j r) = 2ε[A12 (σ/r)^12 − A6 (σ/r)^6],  A_n = Σ_j p_j^(−n)  (p_j: distància / distància al veí més proper)
// r0 = (2A12/A6)^(1/6) σ,  e0 = −A6²/(2A12) ε,  B = e''(r0)/(9 g r0) = 4 ε A6² / (g A12 r0³)

(function () {
  'use strict';
  const { EVA3_GPA, fmt, sig, Plot } = Coh;
  const RC = 20;                       // radi de tall de la suma directa (unitats de distància a primers veïns)
  const COL = { pair: '#9aa8a0', cr: '#00722b', a6: '#2980b9', a12: '#d62728' };
  const SHELL_COLS = ['#d62728', '#e67e22', '#f1c40f', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#c0392b', '#d35400', '#7f8c8d', '#2c3e50', '#16a085'];
  const NOM_GAS = { Ne: 'neó', Ar: 'argó', Kr: 'criptó', Xe: 'xenó' };
  const GASOS = { Ne: { eps: 3.1, sig: 2.74 }, Ar: { eps: 10.4, sig: 3.40 }, Kr: { eps: 14.0, sig: 3.65 }, Xe: { eps: 20.0, sig: 3.98 } };

  const EST = {
    sc: { nom: 'Cúbica simple (SC)', g: 1 },
    bcc: { nom: 'BCC', g: 4 / (3 * Math.sqrt(3)) },
    fcc: { nom: 'FCC', g: 1 / Math.SQRT2 },
    hcp: { nom: 'HCP ideal (c/a = 1.633)', g: 1 / Math.SQRT2 }
  };
  const state = { est: 'fcc', k: 3, gas: 'Ar', rotY: 0.6, rotX: 0.35 };

  // ---------------------------------------------------------------
  // Posicions dels veïns (unitats: distància a primers veïns = 1)
  // ---------------------------------------------------------------
  function positions(est) {
    const out = [], L = Math.ceil(RC * 1.2) + 2;
    const push = (x, y, z) => { const p = Math.hypot(x, y, z); if (p > 1e-9 && p <= RC) out.push({ x, y, z, p }); };
    if (est === 'sc') {
      for (let i = -L; i <= L; i++) for (let j = -L; j <= L; j++) for (let k = -L; k <= L; k++) push(i, j, k);
    } else if (est === 'bcc') {
      const s = 2 / Math.sqrt(3);      // a = 2/√3 perquè la distància a primers veïns sigui 1
      for (let i = -L; i <= L; i++) for (let j = -L; j <= L; j++) for (let k = -L; k <= L; k++) {
        push(i * s, j * s, k * s); push((i + 0.5) * s, (j + 0.5) * s, (k + 0.5) * s);
      }
    } else if (est === 'fcc') {
      const s = 1 / Math.SQRT2;        // punts enters amb i+j+k parell, distància mínima √2
      for (let i = -2 * L; i <= 2 * L; i++) for (let j = -2 * L; j <= 2 * L; j++) for (let k = -2 * L; k <= 2 * L; k++)
        if (!((i + j + k) & 1)) push(i * s, j * s, k * s);
    } else {
      const c = Math.sqrt(8 / 3), h = Math.sqrt(3) / 2;
      for (let i = -L; i <= L; i++) for (let j = -L; j <= L; j++) for (let k = -L; k <= L; k++) {
        const x = i + 0.5 * j, y = h * j, z = c * k;
        push(x, y, z);
        push(x + 0.5, y + h / 3, z + c / 2);
      }
    }
    return out;
  }
  function analyse(est) {
    const P = positions(est), map = new Map();
    P.forEach(q => { const key = q.p.toFixed(6); if (!map.has(key)) map.set(key, { p: q.p, n: 0, pts: [] }); const e = map.get(key); e.n++; if (q.p < 4) e.pts.push(q); });
    const sh = [...map.values()].sort((a, b) => a.p - b.p);
    let s6 = 0, s12 = 0;
    sh.forEach(e => { s6 += e.n * Math.pow(e.p, -6); s12 += e.n * Math.pow(e.p, -12); e.A6 = s6; e.A12 = s12; });
    // cua contínua més enllà del tall: ∫ 4π r² ρ r^(−n) dr, amb ρ = 1/g àtoms per unitat de volum
    const rho = 1 / EST[est].g, tail = n => 4 * Math.PI * rho * Math.pow(RC, 3 - n) / (n - 3);
    return { sh, A6: s6 + tail(6), A12: s12 + tail(12) };
  }
  const cache = {};
  const data = est => cache[est] || (cache[est] = analyse(est));
  function derived(est) {
    const D = data(est), g = EST[est].g;
    const x0 = Math.pow(2 * D.A12 / D.A6, 1 / 6);                 // r0/σ
    const e0 = -D.A6 * D.A6 / (2 * D.A12);                         // e0/ε
    const Bred = 4 * D.A6 * D.A6 / (g * D.A12 * Math.pow(x0, 3));  // B σ³/ε
    return { A6: D.A6, A12: D.A12, z: D.sh[0].n, x0, e0, Bred, g };
  }

  // ---------------------------------------------------------------
  // Gràfica 1: parell i cristall
  // ---------------------------------------------------------------
  const cE = document.getElementById('canvasE');
  const pE = Plot(cE, { xmin: 0.85, xmax: 2.3, ymin: -10, ymax: 6, m: { l: 52, r: 14, t: 14, b: 40 } });
  function drawE() {
    const d = derived(state.est), A6 = d.A6, A12 = d.A12;
    pE.clear();
    pE.axes('r / σ', 'energia / ε');
    pE.fn(x => 4 * (Math.pow(x, -12) - Math.pow(x, -6)), { col: COL.pair, w: 2, dash: [6, 4] });
    pE.fn(x => 2 * (A12 * Math.pow(x, -12) - A6 * Math.pow(x, -6)), { col: COL.cr, w: 2.5 });
    pE.vline(Math.pow(2, 1 / 6), { col: COL.pair, w: 1, dash: [2, 3] });
    pE.vline(d.x0, { col: COL.cr, w: 1, dash: [2, 3] });
    pE.dot(Math.pow(2, 1 / 6), -1, COL.pair, 4);
    pE.dot(d.x0, d.e0, COL.cr, 5);
    pE.text('parell: R₀ = 1.122σ, −ε', Math.pow(2, 1 / 6), -1, { dx: 8, dy: -6, col: '#666', font: '10px sans-serif' });
    pE.text('cristall: r₀ = ' + fmt(d.x0, 3) + 'σ, ' + fmt(d.e0, 3) + 'ε', d.x0, d.e0, { dx: 8, dy: 14, col: COL.cr, font: '10px sans-serif' });
    pE.legend([{ nom: 'parell: V(R) = 4ε[(σ/R)¹² − (σ/R)⁶]', col: COL.pair, dash: [6, 4] }, { nom: 'cristall ' + EST[state.est].nom + ': e(r) per àtom', col: COL.cr, w: 2.5 }]);
  }

  // ---------------------------------------------------------------
  // Gràfica 2: convergència de les sumes
  // ---------------------------------------------------------------
  const cC = document.getElementById('canvasC');
  const pC = Plot(cC, { xmin: 0.8, xmax: 6, m: { l: 52, r: 14, t: 14, b: 40 } });
  function drawC() {
    const D = data(state.est), d = derived(state.est);
    Object.assign(pC, { ymin: 0, ymax: Math.ceil(d.A6 * 1.15 + 1) });
    pC.clear();
    pC.axes('radi fins on se suma (unitats de primers veïns)', 'suma parcial');
    const step = key => { const pts = [[0.8, 0]]; let prev = 0; D.sh.forEach(e => { if (e.p > 6.2) return; pts.push([e.p, prev], [e.p, e[key]]); prev = e[key]; }); pts.push([6.2, prev]); return pts; };
    pC.hline(d.A6, { col: COL.a6, w: 1, dash: [5, 4] });
    pC.hline(d.A12, { col: COL.a12, w: 1, dash: [5, 4] });
    pC.pts(step('A6'), { col: COL.a6, w: 2 });
    pC.pts(step('A12'), { col: COL.a12, w: 2 });
    const pk = D.sh[Math.min(state.k, D.sh.length) - 1].p;
    pC.vline(pk, { col: '#ff3b30', w: 1.5 });
    pC.text('A₆ = ' + fmt(d.A6, 5), 6, d.A6, { align: 'right', dy: -5, col: COL.a6 });
    pC.text('A₁₂ = ' + fmt(d.A12, 5), 6, d.A12, { align: 'right', dy: 13, col: COL.a12 });
    pC.legend([{ nom: 'A₁₂ = Σ p⁻¹²', col: COL.a12 }, { nom: 'A₆ = Σ p⁻⁶', col: COL.a6 }], { left: true, dy: 150 });
  }
  pC.onDrag(x => {
    const D = data(state.est);
    let k = D.sh.findIndex(e => e.p > x + 1e-6);
    if (k < 0) k = D.sh.length;
    setK(Math.max(1, k));
  });

  // ---------------------------------------------------------------
  // Vista 3D dels veïns inclosos
  // ---------------------------------------------------------------
  const c3 = document.getElementById('canvas3d'), g3 = c3.getContext('2d');
  function draw3d() {
    const W = c3.width, H = c3.height, D = data(state.est);
    g3.clearRect(0, 0, W, H);
    const k = Math.min(state.k, 12, D.sh.length), pmax = D.sh[k - 1].p;
    const sc = Math.min(W, H) / 2 / (pmax + 0.8) * 0.95;
    const cy = Math.cos(state.rotY), sy = Math.sin(state.rotY), cx = Math.cos(state.rotX), sx = Math.sin(state.rotX);
    const pts = [{ x: 0, y: 0, z: 0, s: -1 }];
    D.sh.slice(0, k).forEach((e, s) => e.pts.forEach(q => pts.push({ x: q.x, y: q.y, z: q.z, s })));
    const P = pts.map(q => {
      const x1 = cy * q.x + sy * q.y, y1 = -sy * q.x + cy * q.y;
      const z2 = cx * q.z - sx * y1, d2 = sx * q.z + cx * y1;
      return { X: W / 2 + x1 * sc, Y: H / 2 - z2 * sc, d: d2, s: q.s };
    }).sort((a, b) => a.d - b.d);
    const r = Math.max(3, Math.min(14, sc * 0.28));
    P.forEach(q => {
      const col = q.s < 0 ? '#111' : SHELL_COLS[q.s % SHELL_COLS.length];
      const grd = g3.createRadialGradient(q.X - r * 0.3, q.Y - r * 0.3, r * 0.1, q.X, q.Y, r);
      grd.addColorStop(0, '#fff'); grd.addColorStop(0.35, col); grd.addColorStop(1, col);
      g3.fillStyle = grd; g3.beginPath(); g3.arc(q.X, q.Y, r, 0, Coh.TAU); g3.fill();
    });
    g3.font = '11px sans-serif'; g3.fillStyle = '#555'; g3.textAlign = 'left';
    g3.fillText(k + (k === 1 ? ' capa' : ' capes') + ' · ' + D.sh.slice(0, k).reduce((s, e) => s + e.n, 0) + ' veïns', 8, H - 8);
  }
  let drag = null;
  c3.addEventListener('mousedown', ev => { drag = { x: ev.clientX, y: ev.clientY, ry: state.rotY, rx: state.rotX }; });
  window.addEventListener('mouseup', () => { drag = null; });
  window.addEventListener('mousemove', ev => {
    if (!drag) return;
    state.rotY = drag.ry + (ev.clientX - drag.x) * 0.01;
    state.rotX = Math.max(-1.5, Math.min(1.5, drag.rx + (ev.clientY - drag.y) * 0.01));
    draw3d();
  });

  // ---------------------------------------------------------------
  // Taules, fórmules i lectures
  // ---------------------------------------------------------------
  function drawText() {
    const D = data(state.est), d = derived(state.est), G = GASOS[state.gas], eps = G.eps / 1000;
    document.getElementById('capesBody').innerHTML = D.sh.slice(0, 14).map((e, i) => {
      const cls = i < state.k ? 'actual' : '';
      return '<tr class="' + cls + '" data-k="' + (i + 1) + '"><td><span class="punt" style="background:' + SHELL_COLS[i % SHELL_COLS.length] + '"></span>' + (i + 1) + '</td><td>' + fmt(e.p, 4) + '</td><td>' + e.n +
        '</td><td>' + fmt(e.n * Math.pow(e.p, -6), 4) + '</td><td>' + fmt(e.A6, 4) + '</td><td>' + fmt(e.n * Math.pow(e.p, -12), 5) + '</td><td>' + fmt(e.A12, 5) + '</td></tr>';
    }).join('');
    document.getElementById('estBody').innerHTML = Object.keys(EST).map(k => {
      const q = derived(k);
      return '<tr class="' + (k === state.est ? 'actual' : '') + '"><td class="esq">' + EST[k].nom + '</td><td>' + q.z + '</td><td>' + q.A12.toFixed(5) + '</td><td>' + q.A6.toFixed(5) +
        '</td><td>' + q.x0.toFixed(4) + '</td><td>' + q.e0.toFixed(4) + '</td><td>' + fmt(q.Bred, 1) + '</td></tr>';
    }).join('');
    const sigA = G.sig, r0 = d.x0 * sigA, B = d.Bred * eps / Math.pow(sigA, 3) * EVA3_GPA;
    Coh.formulas(document.getElementById('formules'), [
      { nom: 'Del parell al cristall', tex: ['e(r)=\\frac12\\sum_j V(p_jr)=2\\epsilon\\left[A_{12}\\left(\\frac{\\sigma}{r}\\right)^{12}-A_6\\left(\\frac{\\sigma}{r}\\right)^{6}\\right],\\qquad A_n=\\sum_j\\frac{1}{p_j^{\\,n}}'],
        nota: 'El ½ és perquè cada parell es compta dues vegades. A₁₂ i A₆ són números purs: només depenen de l\'estructura.' },
      { nom: EST[state.est].nom + ': sumes', actiu: true, tex: [
        'A_{12}=' + d.A12.toFixed(5) + '\\ (z=' + d.z + '\\ \\text{primers veïns}),\\qquad A_6=' + d.A6.toFixed(5)],
        nota: 'A₁₂ és gairebé el nombre de primers veïns: amb un exponent tan alt només compten ells. A₆ en rep una contribució notable de les capes següents. (Suma directa fins a ' + RC + ' veïns de distància, més una cua contínua per a la resta.)' },
      { nom: 'Mínim i rigidesa', tex: [
        'r_0=\\left(\\frac{2A_{12}}{A_6}\\right)^{1/6}\\sigma=' + d.x0.toFixed(4) + '\\,\\sigma,\\qquad e_0=-\\frac{A_6^2}{2A_{12}}\\,\\epsilon=' + d.e0.toFixed(4) + '\\,\\epsilon',
        'B=\\frac{e\'\'(r_0)}{9g\\,r_0}=\\frac{4A_6^2}{g\\,A_{12}}\\,\\frac{\\epsilon}{r_0^3}=' + fmt(d.Bred, 1) + '\\,\\frac{\\epsilon}{\\sigma^3},\\qquad g=' + fmt(d.g, 4)] },
      { nom: 'Amb les dades del ' + NOM_GAS[state.gas], tex: [
        '\\epsilon=' + G.eps + '\\ \\text{meV},\\qquad \\sigma=' + G.sig + '\\ \\text{Å}',
        'r_0=' + r0.toFixed(3) + '\\ \\text{Å},\\qquad E_{\\text{coh}}=' + fmt(-d.e0 * G.eps, 1) + '\\ \\text{meV/àtom},\\qquad B=' + sig(B, 3) + '\\ \\text{GPa}'] }
    ]);
    const cur = D.sh[state.k - 1];
    Coh.readout(document.getElementById('lectura'), [
      ['estructura', EST[state.est].nom], ['capes incloses', state.k + '  (fins a p = ' + fmt(cur.p, 3) + ')'],
      ['A₁₂ parcial', fmt(cur.A12, 5) + '  (' + fmt(100 * cur.A12 / d.A12, 2) + ' %)'],
      ['A₆ parcial', fmt(cur.A6, 4) + '  (' + fmt(100 * cur.A6 / d.A6, 1) + ' %)'],
      ['r₀ / σ', fmt(d.x0, 4)], ['e₀ / ε', fmt(d.e0, 4)]
    ]);
    const est = document.getElementById('estat');
    est.className = 'estat si';
    est.textContent = 'Amb ' + state.k + (state.k === 1 ? ' capa' : ' capes') + ', A₁₂ ja és al ' + fmt(100 * cur.A12 / d.A12, 1) + ' % del total i A₆ al ' + fmt(100 * cur.A6 / d.A6, 1) + ' %.';
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  function setK(k) { state.k = Math.max(1, Math.min(12, Math.round(k))); render(); }
  const setEstBtn = Coh.optionGroup($('grupEst'), v => { state.est = v; render(); });
  $('slK').addEventListener('input', () => setK(+$('slK').value));
  $('selGas').addEventListener('change', () => { state.gas = $('selGas').value; render(); });
  $('capesBody').addEventListener('click', ev => { const tr = ev.target.closest('tr[data-k]'); if (tr) setK(+tr.dataset.k); });
  function render() {
    $('slK').value = state.k; $('valK').textContent = state.k;
    drawE(); drawC(); draw3d(); drawText();
  }
  Coh.linkButton($('btnEnllac'), $('msgEnllac'), () => { const p = new URLSearchParams(); p.set('est', state.est); p.set('k', state.k); p.set('gas', state.gas); return p; });
  (function fromURL() {
    const p = Coh.params();
    if (EST[p.get('est')]) state.est = p.get('est');
    if (GASOS[p.get('gas')]) state.gas = p.get('gas');
    Coh.num(p, 'k', x => { state.k = Math.round(x); }, 1, 12);
    setEstBtn(state.est); $('selGas').value = state.gas;
    render();
  })();
})();
