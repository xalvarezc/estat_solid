// Simulador — Forces de London: dos oscil·ladors de Drude acoblats.
// H1 ≃ −(2ke²/R³) x1 x2.  Modes: ω_s = ω0 √(1 − y), ω_a = ω0 √(1 + y),  y = 2ke²/(C R³) = 2kα/R³.
// Estat fonamental: U = ½ħω0 (√(1 − y) + √(1 + y)),  ΔU = U − ħω0 ≃ −(ħω0/8) y² = −A/R⁶,  A = ½ħω0 (kα)².

(function () {
  'use strict';
  const { fmt, sig, Plot } = Coh;
  const TAU = Coh.TAU;
  const GAS = {
    Ne: { nom: 'neó', ka: 0.396, hw: 16.8, eps: 3.1, sig: 2.74, r0: 3.13 },
    Ar: { nom: 'argó', ka: 1.64, hw: 11.8, eps: 10.4, sig: 3.40, r0: 3.76 },
    Kr: { nom: 'criptó', ka: 2.48, hw: 10.0, eps: 14.0, sig: 3.65, r0: 4.01 },
    Xe: { nom: 'xenó', ka: 4.04, hw: 8.4, eps: 20.0, sig: 3.98, r0: 4.35 }
  };
  const COL = { ex: '#00722b', lon: '#e67e22', lj: '#2980b9', ljf: '#9aa8a0', s: '#00722b', a: '#d62728' };
  const state = { gas: 'Ar', R: 3.76, exag: 1, playing: true };

  // ---------------------------------------------------------------
  // Física (energies en eV, distàncies en Å)
  // ---------------------------------------------------------------
  const P = () => GAS[state.gas];
  const yOf = R => 2 * P().ka / Math.pow(R, 3);
  const dUexact = R => { const y = yOf(R); return y >= 1 ? NaN : 0.5 * P().hw * (Math.sqrt(1 - y) + Math.sqrt(1 + y)) - P().hw; };
  const Acoef = () => 0.5 * P().hw * P().ka * P().ka;
  const dUlondon = R => -Acoef() / Math.pow(R, 6);
  const ALJ = () => 4 * P().eps / 1000 * Math.pow(P().sig, 6);
  const ljAtt = R => -ALJ() / Math.pow(R, 6);
  const ljFull = R => 4 * P().eps / 1000 * (Math.pow(P().sig / R, 12) - Math.pow(P().sig / R, 6));
  const Rmin = () => Math.cbrt(2 * P().ka) * 1.08;

  // ---------------------------------------------------------------
  // Gràfica 1: energia d'interacció
  // ---------------------------------------------------------------
  const cU = document.getElementById('canvasU');
  const pU = Plot(cU, { xmin: 2.5, xmax: 8, m: { l: 56, r: 14, t: 14, b: 40 } });
  function drawU() {
    const g = P(), lo = Math.min(ljAtt(g.r0 * 0.85), dUexact(g.r0 * 0.85)) * 1000;
    Object.assign(pU, { xmin: Math.max(Rmin(), 0.6 * g.sig), xmax: 2.3 * g.sig, ymin: lo * 1.1, ymax: -lo * 0.5 });
    pU.clear();
    pU.axes('distància entre els àtoms R (Å)', 'energia d\'interacció (meV)');
    pU.fn(R => ljFull(R) * 1000, { col: COL.ljf, w: 1.5, dash: [3, 3] });
    pU.fn(R => ljAtt(R) * 1000, { col: COL.lj, w: 2, dash: [6, 4] });
    pU.fn(R => dUlondon(R) * 1000, { col: COL.lon, w: 2, dash: [6, 4] });
    pU.fn(R => dUexact(R) * 1000, { col: COL.ex, w: 2.5 });
    pU.vline(g.r0, { col: '#999', w: 1, dash: [2, 3] });
    pU.text('sòlid: R = ' + g.r0 + ' Å', g.r0, pU.ymin, { dx: 4, dy: -6, col: '#777', font: '10px sans-serif' });
    pU.vline(state.R, { col: '#ff3b30', w: 1.5 });
    pU.dot(state.R, dUexact(state.R) * 1000, COL.ex, 5);
    pU.legend([{ nom: 'model: ½ħω₀(√(1−y)+√(1+y)) − ħω₀', col: COL.ex, w: 2.5 }, { nom: 'London: −A/R⁶', col: COL.lon, dash: [6, 4] },
      { nom: 'atracció ajustada: −4εσ⁶/R⁶', col: COL.lj, dash: [6, 4] }, { nom: 'Lennard-Jones complet', col: COL.ljf, dash: [3, 3] }]);
  }
  pU.onDrag(x => setR(x));

  // ---------------------------------------------------------------
  // Gràfica 2: freqüències dels modes
  // ---------------------------------------------------------------
  const cW = document.getElementById('canvasW');
  const pW = Plot(cW, { xmin: 1.5, xmax: 8, ymin: 0, ymax: 1.5, m: { l: 50, r: 14, t: 14, b: 40 } });
  function drawW() {
    Object.assign(pW, { xmin: Rmin() * 0.98, xmax: 2.3 * P().sig });
    pW.clear();
    pW.axes('R (Å)', 'ω / ω₀');
    pW.hline(1, { col: '#999', w: 1, dash: [4, 4] });
    pW.fn(R => Math.sqrt(1 + yOf(R)), { col: COL.a, w: 2.2 });
    pW.fn(R => { const y = yOf(R); return y < 1 ? Math.sqrt(1 - y) : NaN; }, { col: COL.s, w: 2.2 });
    pW.vline(state.R, { col: '#ff3b30', w: 1.5 });
    pW.legend([{ nom: 'ω_a: antisimètric (més rígid)', col: COL.a }, { nom: 'ω_s: simètric (més tou)', col: COL.s }]);
  }
  pW.onDrag(x => setR(x));

  // ---------------------------------------------------------------
  // Estat fonamental: mostres de (x1, x2) i els dos àtoms
  // ---------------------------------------------------------------
  const cS = document.getElementById('canvasS'), gS = cS.getContext('2d');
  const cA = document.getElementById('canvasAt'), gA = cA.getContext('2d');
  let samples = [], last = null;
  const yEff = () => Math.min(0.95, yOf(state.R) * state.exag);
  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
  function sample() {
    const y = yEff(), ss = Math.sqrt(0.5 / Math.sqrt(1 - y)), sa = Math.sqrt(0.5 / Math.sqrt(1 + y));
    const xs = ss * gauss(), xa = sa * gauss();
    return [(xs + xa) / Math.SQRT2, (xs - xa) / Math.SQRT2];   // en unitats de ℓ = √(ħ/mω₀)
  }
  function corrTheory() { const y = yEff(), vs = 0.5 / Math.sqrt(1 - y), va = 0.5 / Math.sqrt(1 + y); return (vs - va) / (vs + va); }
  function corrSamples() {
    if (samples.length < 20) return NaN;
    let a = 0, b = 0, c = 0;
    samples.forEach(([x1, x2]) => { a += x1 * x2; b += x1 * x1; c += x2 * x2; });
    return a / Math.sqrt(b * c);
  }
  function drawS() {
    const W = cS.width, H = cS.height, cx = W / 2, cy = H / 2, sc = Math.min(W, H) / 2 / 2.6;
    gS.clearRect(0, 0, W, H);
    // contorns de |ψ0|²
    const y = yEff(), ws = Math.sqrt(1 - y), wa = Math.sqrt(1 + y);
    gS.strokeStyle = '#ccc'; gS.beginPath(); gS.moveTo(cx - W / 2, cy); gS.lineTo(cx + W / 2, cy); gS.moveTo(cx, 0); gS.lineTo(cx, H); gS.stroke();
    // eixos dels modes normals: x_s al llarg de x₁ = x₂, x_a al llarg de x₁ = −x₂
    const L = 2.35 * sc / Math.SQRT2;
    [[1, COL.s, 'xₛ'], [-1, COL.a, 'xₐ']].forEach(([sg, col, nom]) => {
      gS.setLineDash([6, 4]); gS.strokeStyle = col; gS.lineWidth = 1.3;
      gS.beginPath(); gS.moveTo(cx - L, cy + sg * L); gS.lineTo(cx + L, cy - sg * L); gS.stroke();
      gS.setLineDash([]);
      Coh.arrow(gS, cx + 0.8 * L, cy - sg * 0.8 * L, cx + L, cy - sg * L, col, 1.6);
      gS.fillStyle = col; gS.font = 'bold 13px sans-serif'; gS.textAlign = 'left';
      gS.fillText(nom, cx + L + 5, cy - sg * L + 5);
    });
    [0.5, 1, 1.5].forEach(k => {
      // |ψ|² ∝ exp(−ws xs² − wa xa²): el·lipse de semieixos k/√ws (diagonal) i k/√wa (antidiagonal)
      gS.strokeStyle = 'rgba(0,114,43,0.55)'; gS.lineWidth = 1.2;
      gS.beginPath(); gS.ellipse(cx, cy, k / Math.sqrt(ws) * sc, k / Math.sqrt(wa) * sc, -Math.PI / 4, 0, TAU); gS.stroke();
    });
    gS.fillStyle = 'rgba(214,39,40,0.45)';
    samples.forEach(([x1, x2]) => { gS.beginPath(); gS.arc(cx + x1 * sc, cy - x2 * sc, 2, 0, TAU); gS.fill(); });
    if (last) { gS.fillStyle = '#d62728'; gS.beginPath(); gS.arc(cx + last[0] * sc, cy - last[1] * sc, 5, 0, TAU); gS.fill(); }
    gS.fillStyle = '#555'; gS.font = '11px sans-serif'; gS.textAlign = 'left';
    gS.fillText('x₁', W - 18, cy - 5); gS.fillText('x₂', cx + 5, 12);
    gS.fillText('correlació mesurada: ' + (isFinite(corrSamples()) ? fmt(corrSamples(), 3) : '—') + ' · teòrica: ' + fmt(corrTheory(), 3), 8, H - 8);
    if (state.exag > 1) { gS.fillStyle = '#b23a3a'; gS.fillText('acoblament exagerat ×' + state.exag, 8, 14); }
  }
  function drawAtoms() {
    const W = cA.width, H = cA.height, cy = H / 2, d = W * 0.45, x1n = W / 2 - d / 2, x2n = W / 2 + d / 2, sc = 22;
    gA.clearRect(0, 0, W, H);
    const [x1, x2] = last || [0, 0];
    [[x1n, x1], [x2n, x2]].forEach(([xn, xe]) => {
      const xc = xn + xe * sc;
      const grd = gA.createRadialGradient(xc, cy, 2, xc, cy, 46);
      grd.addColorStop(0, 'rgba(214,39,40,0.5)'); grd.addColorStop(1, 'rgba(214,39,40,0)');
      gA.fillStyle = grd; gA.beginPath(); gA.arc(xc, cy, 46, 0, TAU); gA.fill();
      gA.fillStyle = '#00722b'; gA.beginPath(); gA.arc(xn, cy, 5, 0, TAU); gA.fill();
      if (Math.abs(xe) > 0.05) Coh.arrow(gA, xn, cy - 34, xn + xe * sc * 1.6, cy - 34, '#111', 2);
    });
    gA.fillStyle = '#555'; gA.font = '11px sans-serif'; gA.textAlign = 'center';
    gA.fillText('nucli 1', x1n, cy + 62); gA.fillText('nucli 2', x2n, cy + 62);
    gA.fillText('fletxes: dipols instantanis (desplaçament del núvol)', W / 2, 16);
    const same = last && x1 * x2 > 0;
    gA.fillStyle = same ? '#1a7d2e' : '#b23a3a';
    gA.fillText(last ? (same ? 'ara mateix, en el mateix sentit: s\'atrauen' : 'ara mateix, en sentits oposats: es repel·leixen') : '', W / 2, H - 8);
  }
  let tick = 0;
  function loop() {
    if (state.playing && ++tick % 6 === 0) {
      last = sample(); samples.push(last);
      if (samples.length > 1500) samples.shift();
      drawS(); drawAtoms();
    }
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------
  // Fórmules i lectures
  // ---------------------------------------------------------------
  function drawText() {
    const g = P(), R = state.R, y = yOf(R), ex = dUexact(R), lon = dUlondon(R);
    Coh.formulas(document.getElementById('formules'), [
      { nom: 'Acoblament dipol-dipol', tex: ['H_1\\simeq-\\frac{2ke^2}{R^3}\\,x_1x_2,\\qquad y\\equiv\\frac{2ke^2}{CR^3}=\\frac{2k\\alpha}{R^3}=\\frac{2\\cdot' + g.ka + '}{' + fmt(R, 2) + '^3}=' + sig(y, 3)],
        nota: 'kα és la polaritzabilitat expressada com un volum (' + g.ka + ' Å³ per al ' + g.nom + ').' },
      { nom: 'Modes normals', tex: ['\\omega_s=\\omega_0\\sqrt{1-y}=' + fmt(Math.sqrt(1 - y), 4) + '\\,\\omega_0,\\qquad \\omega_a=\\omega_0\\sqrt{1+y}=' + fmt(Math.sqrt(1 + y), 4) + '\\,\\omega_0'],
        nota: 'Clàssicament, en repòs, l\'energia mínima continua sent zero: l\'acoblament no fa res si els dipols no fluctuen.' },
      { nom: 'Energia de punt zero', actiu: true, tex: [
        '\\Delta U=\\tfrac12\\hbar\\omega_0\\left(\\sqrt{1-y}+\\sqrt{1+y}\\right)-\\hbar\\omega_0=' + sig(ex * 1000, 3) + '\\ \\text{meV}',
        '\\simeq-\\frac{\\hbar\\omega_0}{8}\\,y^2=-\\frac{A}{R^6},\\qquad A=\\tfrac12\\hbar\\omega_0(k\\alpha)^2=\\tfrac12\\cdot' + g.hw + '\\cdot' + g.ka + '^2=' + sig(Acoef(), 3) + '\\ \\text{eV}\\cdot\\text{Å}^6\\ \\Rightarrow\\ ' + sig(lon * 1000, 3) + '\\ \\text{meV}'],
        nota: 'L\'atracció neix de l\'energia de punt zero, ½ħω: és proporcional a ħ i és purament quàntica.' },
      { nom: 'Comparació amb el valor ajustat a l\'experiment', tex: [
        'A_{\\text{LJ}}=4\\epsilon\\sigma^6=4\\cdot' + fmt(g.eps / 1000, 4) + '\\cdot' + g.sig + '^6=' + sig(ALJ(), 3) + '\\ \\text{eV}\\cdot\\text{Å}^6,\\qquad \\frac{A_{\\text{LJ}}}{A}=' + fmt(ALJ() / Acoef(), 2)],
        nota: 'Un model unidimensional d\'un sol electró dona l\'ordre de magnitud: el coeficient real és unes ' + Math.round(ALJ() / Acoef()) + ' vegades més gran.' }
    ]);
    Coh.readout(document.getElementById('lectura'), [
      ['gas', g.nom], ['R', fmt(R, 2) + ' Å'], ['y = 2kα/R³', sig(y, 3)],
      ['ΔU (model)', sig(ex * 1000, 3) + ' meV'], ['−A/R⁶', sig(lon * 1000, 3) + ' meV'], ['LJ complet', sig(ljFull(R) * 1000, 3) + ' meV']
    ]);
    const est = document.getElementById('estat');
    est.className = 'estat ' + (R > 0.8 * g.sig ? 'si' : 'no');
    est.textContent = R > 0.8 * g.sig ? 'Atracció de desenes de meV o menys: mil vegades més feble que un enllaç químic.'
      : 'A aquesta distància els núvols electrònics se solapen: domina la repulsió de Pauli, que aquest model no inclou.';
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  function setR(x) { state.R = Math.max(Rmin(), Math.min(2.3 * P().sig, x)); samples = []; render(); }
  $('selGas').addEventListener('change', () => { state.gas = $('selGas').value; state.R = P().r0; samples = []; render(); });
  $('slR').addEventListener('input', () => setR(+$('slR').value));
  $('slExag').addEventListener('input', () => { state.exag = +$('slExag').value; samples = []; render(); });
  $('btnReset').addEventListener('click', () => { samples = []; render(); });
  $('btnPlay').addEventListener('click', () => { state.playing = !state.playing; $('btnPlay').textContent = state.playing ? '❚❚ Atura les mostres' : '▶ Continua'; });
  function render() {
    $('slR').min = fmt(Rmin(), 2); $('slR').max = fmt(2.3 * P().sig, 2);
    $('slR').value = state.R; $('valR').textContent = fmt(state.R, 2) + ' Å';
    $('slExag').value = state.exag; $('valExag').textContent = '×' + state.exag;
    drawU(); drawW(); drawS(); drawAtoms(); drawText();
  }
  Coh.linkButton($('btnEnllac'), $('msgEnllac'), () => { const p = new URLSearchParams(); p.set('gas', state.gas); p.set('R', fmt(state.R, 2)); if (state.exag > 1) p.set('exag', state.exag); return p; });
  (function fromURL() {
    const p = Coh.params();
    if (GAS[p.get('gas')]) state.gas = p.get('gas');
    state.R = P().r0;
    Coh.num(p, 'R', x => { state.R = x; }, 1, 12);
    Coh.num(p, 'exag', x => { state.exag = Math.round(x); }, 1, 20);
    $('selGas').value = state.gas;
    render();
    requestAnimationFrame(loop);
  })();
})();
