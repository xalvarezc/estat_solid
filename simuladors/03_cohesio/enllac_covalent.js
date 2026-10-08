// Simulador — L'enllaç covalent mínim: l'ió molecular H₂⁺ en el model LCAO.
// ψ± = (φA ± φB)/√(2(1 ± S)),  E± = (H_AA ± H_AB)/(1 ± S)
// Integrals exactes per a orbitals 1s (unitats atòmiques: R en bohr, energia en hartree):
//   S = e^(−R)(1 + R + R²/3)
//   J = ∫φA²/r_B = [1 − (1 + R)e^(−2R)]/R      K = ∫φAφB/r_A = (1 + R)e^(−R)
//   H_AA = E_1s − J + 1/R,                      H_AB = S(E_1s + 1/R) − K

(function () {
  'use strict';
  const { HARTREE_EV: HA, BOHR_A: A0, fmt, sig, Plot } = Coh;
  const E1S = -0.5;
  const COL = { b: '#00722b', a: '#d62728', s: '#9aa8a0', haa: '#8e44ad' };
  const state = { R: 1.32, mapa: 'dif_b' };      // R en Å

  // ---------------------------------------------------------------
  // Física
  // ---------------------------------------------------------------
  function ints(Ra) {
    const R = Ra / A0, eR = Math.exp(-R);
    const S = eR * (1 + R + R * R / 3);
    const J = (1 - (1 + R) * Math.exp(-2 * R)) / R;
    const K = (1 + R) * eR;
    const HAA = E1S - J + 1 / R, HAB = S * (E1S + 1 / R) - K;
    const Ep = (HAA + HAB) / (1 + S), Em = (HAA - HAB) / (1 - S);
    return { R, S, J, K, HAA, HAB, Ep, Em };
  }
  // energies relatives a H(1s) + H⁺ separats, en eV
  const dE = (Ra, which) => { const I = ints(Ra); return ((which === '+' ? I.Ep : which === '-' ? I.Em : I.HAA) - E1S) * HA; };

  // mínim de la corba enllaçant (cerca de la secció àuria)
  const minPlus = (() => {
    let a = 0.6, b = 3.0;
    const g = (Math.sqrt(5) - 1) / 2;
    for (let i = 0; i < 80; i++) { const c = b - g * (b - a), d = a + g * (b - a); if (dE(c, '+') < dE(d, '+')) b = d; else a = c; }
    const R = (a + b) / 2; return { R, E: dE(R, '+') };
  })();
  const EXACT = { R: 1.06, E: -2.79 };

  // densitats en unitats atòmiques (a0⁻³), nuclis a z = ±R/2 sobre l'eix
  function dens(x, z, Ra) {
    const I = ints(Ra), h = I.R / 2;
    const rA = Math.hypot(x, z + h), rB = Math.hypot(x, z - h);
    const fA = Math.exp(-rA) / Math.sqrt(Math.PI), fB = Math.exp(-rB) / Math.sqrt(Math.PI);
    return { p: (fA + fB) * (fA + fB) / (2 * (1 + I.S)), m: (fA - fB) * (fA - fB) / (2 * (1 - I.S)), s: (fA * fA + fB * fB) / 2 };
  }

  // ---------------------------------------------------------------
  // Gràfica 1: corbes d'energia
  // ---------------------------------------------------------------
  const cE = document.getElementById('canvasE');
  const pE = Plot(cE, { xmin: 0.3, xmax: 4.5, ymin: -3.5, ymax: 6, m: { l: 50, r: 14, t: 14, b: 40 } });
  function drawE() {
    pE.clear();
    pE.axes('distància entre protons R (Å)', 'E − E(H 1s) (eV)');
    pE.fn(R => dE(R, 'h'), { col: COL.haa, w: 1.5, dash: [5, 4] });
    pE.fn(R => dE(R, '-'), { col: COL.a, w: 2.5 });
    pE.fn(R => dE(R, '+'), { col: COL.b, w: 2.5 });
    pE.dot(minPlus.R, minPlus.E, COL.b, 4);
    pE.text('mínim LCAO: ' + fmt(minPlus.R, 2) + ' Å, ' + fmt(minPlus.E, 2) + ' eV', minPlus.R, minPlus.E, { dx: 8, dy: 14, col: COL.b, font: '10px sans-serif' });
    pE.dot(EXACT.R, EXACT.E, '#111', 4);
    pE.text('exacte: 1.06 Å, −2.79 eV', EXACT.R, EXACT.E, { dx: 8, dy: 4, col: '#111', font: '10px sans-serif' });
    pE.vline(state.R, { col: '#ff3b30', w: 1.5 });
    pE.legend([{ nom: 'E₋ antienllaçant', col: COL.a, w: 2.5 }, { nom: 'H_AA (sense bescanvi)', col: COL.haa, dash: [5, 4] }, { nom: 'E₊ enllaçant', col: COL.b, w: 2.5 }]);
  }
  pE.onDrag(x => setR(x));

  // ---------------------------------------------------------------
  // Gràfica 2: densitat al llarg de l'eix
  // ---------------------------------------------------------------
  const cZ = document.getElementById('canvasZ');
  const pZ = Plot(cZ, { xmin: -3, xmax: 3, ymin: 0, ymax: 0.6, m: { l: 50, r: 14, t: 14, b: 40 } });
  function drawZ() {
    const h = state.R / 2;
    const dn = dens(0, -h / A0, state.R), ymax = Math.max(dn.p, dn.m, dn.s) * 1.12;
    Object.assign(pZ, { ymax: Math.min(0.75, Math.max(0.2, ymax)) });
    pZ.clear();
    pZ.axes('posició al llarg de l\'eix z (Å)', '|ψ|² (a₀⁻³)');
    pZ.fn(z => dens(0, z / A0, state.R).s, { col: COL.s, w: 1.5, dash: [5, 4] });
    pZ.fn(z => dens(0, z / A0, state.R).m, { col: COL.a, w: 2.2 });
    pZ.fn(z => dens(0, z / A0, state.R).p, { col: COL.b, w: 2.5 });
    [-h, h].forEach(z => pZ.vline(z, { col: '#111', w: 1, dash: [2, 3] }));
    pZ.text('A', -h, pZ.ymax, { dx: -10, dy: 12, col: '#111', font: 'bold 11px sans-serif' });
    pZ.text('B', h, pZ.ymax, { dx: 4, dy: 12, col: '#111', font: 'bold 11px sans-serif' });
    pZ.legend([{ nom: '|ψ₊|² enllaçant', col: COL.b, w: 2.5 }, { nom: '|ψ₋|² antienllaçant', col: COL.a }, { nom: '(|φA|² + |φB|²)/2 sense interferència', col: COL.s, dash: [5, 4] }]);
  }

  // ---------------------------------------------------------------
  // Mapa 2D de la densitat
  // ---------------------------------------------------------------
  const cM = document.getElementById('canvasMap'), gM = cM.getContext('2d');
  function drawMap() {
    const W = cM.width, H = cM.height, img = gM.createImageData(W, H), ext = 3.2;   // Å, mig ample horitzontal
    const sc = W / (2 * ext), dif = state.mapa.startsWith('dif');
    let vmax = 0;
    const vals = new Float32Array(W * H);
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const z = (px - W / 2) / sc / A0, x = (H / 2 - py) / sc / A0, d = dens(x, z, state.R);
      const v = state.mapa === 'b' ? d.p : state.mapa === 'a' ? d.m : state.mapa === 'dif_b' ? d.p - d.s : d.m - d.s;
      vals[py * W + px] = v; vmax = Math.max(vmax, Math.abs(v));
    }
    for (let i = 0; i < W * H; i++) {
      const t = vals[i] / vmax;
      let r, g, b;
      if (dif) {              // divergent: blau negatiu, blanc zero, vermell positiu
        const u = Math.sign(t) * Math.pow(Math.abs(t), 0.6);
        if (u >= 0) { r = 255; g = 255 * (1 - u); b = 255 * (1 - u); } else { r = 255 * (1 + u); g = 255 * (1 + u * 0.6); b = 255; }
      } else {
        const u = Math.pow(Math.max(0, t), 0.45);
        r = 255 * (1 - u * 0.9); g = 255 * (1 - u * 0.45); b = 255 * (1 - u * 0.8);
      }
      img.data[4 * i] = r; img.data[4 * i + 1] = g; img.data[4 * i + 2] = b; img.data[4 * i + 3] = 255;
    }
    gM.putImageData(img, 0, 0);
    const h = state.R / 2;
    [-h, h].forEach((z, i) => { gM.fillStyle = '#111'; gM.beginPath(); gM.arc(W / 2 + z * sc, H / 2, 4, 0, Coh.TAU); gM.fill(); gM.font = 'bold 12px sans-serif'; gM.fillText(i ? 'B' : 'A', W / 2 + z * sc - 4, H / 2 - 9); });
    gM.fillStyle = '#333'; gM.font = '11px sans-serif'; gM.textAlign = 'left';
    gM.fillText({ b: '|ψ₊|²', a: '|ψ₋|²', dif_b: '|ψ₊|² − sense interferència (vermell: hi ha més càrrega)', dif_a: '|ψ₋|² − sense interferència (blau: hi ha menys càrrega)' }[state.mapa], 8, 15);
    // escala
    gM.fillText('1 Å', 12, H - 14); gM.strokeStyle = '#333'; gM.lineWidth = 2; gM.beginPath(); gM.moveTo(10, H - 8); gM.lineTo(10 + sc, H - 8); gM.stroke();
  }

  // ---------------------------------------------------------------
  // Diagrama de nivells
  // ---------------------------------------------------------------
  const cN = document.getElementById('canvasNiv'), gN = cN.getContext('2d');
  function drawLevels() {
    const W = cN.width, H = cN.height, I = ints(state.R);
    gN.clearRect(0, 0, W, H);
    const lev = [['H(1s) aïllat', 0, '#555'], ['H_AA', (I.HAA - E1S) * HA, COL.haa], ['E₊', (I.Ep - E1S) * HA, COL.b], ['E₋', (I.Em - E1S) * HA, COL.a]];
    const lo = Math.min(-3.5, ...lev.map(l => l[1])) - 0.3, hi = Math.max(3, ...lev.map(l => l[1])) + 0.3;
    const Y = e => H - 22 - (e - lo) / (hi - lo) * (H - 40);
    gN.strokeStyle = '#ddd'; gN.beginPath(); gN.moveTo(60, Y(0)); gN.lineTo(W - 10, Y(0)); gN.stroke();
    const x0 = 70, x1 = 150, x2 = W - 90, x3 = W - 20;
    const line = (xa, xb, e, col, lab, left) => {
      gN.strokeStyle = col; gN.lineWidth = 3; gN.beginPath(); gN.moveTo(xa, Y(e)); gN.lineTo(xb, Y(e)); gN.stroke();
      gN.fillStyle = col; gN.font = '11px sans-serif';
      if (left) { gN.textAlign = 'center'; gN.fillText(lab + ' ' + fmt(e, 2) + ' eV', (xa + xb) / 2, Y(e) + 15); }
      else { gN.textAlign = 'left'; gN.fillText(lab + ' ' + fmt(e, 2) + ' eV', xb + 4, Y(e) + 4); }
    };
    line(x0 - 50, x1 - 50, 0, '#555', 'àtom aïllat', true);
    line((x0 + x2) / 2 - 40, (x0 + x2) / 2 + 10, lev[1][1], COL.haa, 'H_AA', true);
    line(x2 - 30, x3 - 60, lev[2][1], COL.b, 'E₊');
    line(x2 - 30, x3 - 60, lev[3][1], COL.a, 'E₋');
    gN.strokeStyle = '#bbb'; gN.lineWidth = 1; gN.setLineDash([3, 3]);
    [lev[2][1], lev[3][1]].forEach(e => { gN.beginPath(); gN.moveTo((x0 + x2) / 2 + 10, Y(lev[1][1])); gN.lineTo(x2 - 30, Y(e)); gN.stroke(); });
    gN.setLineDash([]);
    gN.fillStyle = '#555'; gN.font = '11px sans-serif'; gN.textAlign = 'left';
    gN.fillText('Energies a R = ' + fmt(state.R, 2) + ' Å, respecte de H(1s) + H⁺ separats', 8, 14);
  }

  // ---------------------------------------------------------------
  // Fórmules i lectures
  // ---------------------------------------------------------------
  function drawText() {
    const I = ints(state.R), d = dens(0, 0, state.R);
    const ev = x => fmt(x * HA, 3);
    Coh.formulas(document.getElementById('formules'), [
      { nom: 'Combinació lineal d\'orbitals atòmics (LCAO)', tex: [
        '\\psi_\\pm=\\frac{\\phi_A\\pm\\phi_B}{\\sqrt{2(1\\pm S)}},\\qquad E_\\pm=\\frac{H_{AA}\\pm H_{AB}}{1\\pm S}'],
        nota: 'φA i φB són els orbitals 1s de l\'hidrogen centrats a cada protó. És el càlcul dels apunts, ara amb els valors numèrics de les integrals.' },
      { nom: 'Integrals per a R = ' + fmt(state.R, 3) + ' Å = ' + fmt(I.R, 3) + ' a₀', actiu: true, tex: [
        'S=e^{-R}\\left(1+R+\\tfrac{R^2}{3}\\right)=' + fmt(I.S, 4) + ',\\qquad J=\\frac{1-(1+R)e^{-2R}}{R}=' + fmt(I.J, 4) + ',\\qquad K=(1+R)\\,e^{-R}=' + fmt(I.K, 4),
        'H_{AA}=E_{1s}-J+\\frac1R=' + fmt(I.HAA, 4) + '\\ E_h,\\qquad H_{AB}=S\\left(E_{1s}+\\frac1R\\right)-K=' + fmt(I.HAB, 4) + '\\ E_h'],
        nota: 'En unitats atòmiques (R en bohr, energies en hartree, 1 E_h = 27.21 eV). S és el solapament; J, l\'atracció clàssica entre el núvol de A i el protó B; K, la integral de bescanvi, que no té anàleg clàssic.' },
      { nom: 'Els dos estats', tex: [
        'E_+-E_{1s}=' + ev(I.Ep - E1S) + '\\ \\text{eV},\\qquad H_{AA}-E_{1s}=' + ev(I.HAA - E1S) + '\\ \\text{eV},\\qquad E_--E_{1s}=' + ev(I.Em - E1S) + '\\ \\text{eV}'],
        nota: 'Sempre E₊ < H_AA < E₋: la combinació simètrica és enllaçant i l\'antisimètrica, antienllaçant. El mínim de E₊ (' + fmt(minPlus.E, 2) + ' eV a ' + fmt(minPlus.R, 2) + ' Å) és l\'energia d\'enllaç del model; l\'exacta és −2.79 eV a 1.06 Å.' },
      { nom: 'Densitat al punt mitjà', tex: [
        '\\frac{|\\psi_+(0)|^2}{\\tfrac12(|\\phi_A|^2+|\\phi_B|^2)}=\\frac{2}{1+S}=' + fmt(d.p / d.s, 3) + ',\\qquad |\\psi_-(0)|^2=0'],
        nota: 'Interferència constructiva entre els protons a l\'estat enllaçant, i destructiva (un node) a l\'antienllaçant.' }
    ]);
    Coh.readout(document.getElementById('lectura'), [
      ['R', fmt(state.R, 3) + ' Å = ' + fmt(I.R, 3) + ' a₀'], ['solapament S', fmt(I.S, 4)],
      ['E₊ − E(1s)', ev(I.Ep - E1S) + ' eV'], ['E₋ − E(1s)', ev(I.Em - E1S) + ' eV'], ['separació E₋ − E₊', ev(I.Em - I.Ep) + ' eV']
    ]);
    const est = document.getElementById('estat'), bound = I.Ep < E1S;
    est.className = 'estat ' + (bound ? 'si' : 'no');
    est.textContent = bound ? 'L\'estat enllaçant té menys energia que H + H⁺ separats: la molècula està lligada.' : 'A aquesta distància ni tan sols l\'estat enllaçant està lligat: domina la repulsió entre protons.';
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  function setR(x) { state.R = Math.max(0.3, Math.min(4.5, x)); render(); }
  $('slR').addEventListener('input', () => setR(+$('slR').value));
  $('btnMin').addEventListener('click', () => setR(+minPlus.R.toFixed(3)));
  const setMapBtn = Coh.optionGroup($('grupMapa'), v => { state.mapa = v; render(); });
  function render() {
    $('slR').value = state.R; $('valR').textContent = fmt(state.R, 2) + ' Å';
    drawE(); drawZ(); drawMap(); drawLevels(); drawText();
  }
  Coh.linkButton($('btnEnllac'), $('msgEnllac'), () => { const p = new URLSearchParams(); p.set('R', fmt(state.R, 3)); p.set('mapa', state.mapa); return p; });
  (function fromURL() {
    const p = Coh.params();
    Coh.num(p, 'R', x => { state.R = x; }, 0.3, 4.5);
    if (['b', 'a', 'dif_b', 'dif_a'].includes(p.get('mapa'))) state.mapa = p.get('mapa');
    setMapBtn(state.mapa);
    render();
  })();
})();
