// Simulador — Polaritzabilitat d'un àtom: el núvol electrònic lligat al nucli per una molla.
// Equilibri: eE = Cx  ⇒  x = eE/C,  μ = ex = (e²/C) E = αE.
// Unitats dels apunts: E en V/Å (aleshores eE en eV/Å), kα en Å³, C = ke²/(kα) en eV/Å².
// El núvol (càrrega −e) es desplaça en sentit contrari a E; el dipol (de − a +) apunta com E.

(function () {
  'use strict';
  const { fmt, sig, Plot, KE2 } = Coh;
  const TAU = Coh.TAU;
  const HB2M = 7.62;              // ħ²/m_e en eV·Å²
  const EA_DEBYE = 4.803;         // 1 e·Å en debye
  const EMAX = 3;                 // V/Å
  const ATOM = {
    He: { nom: 'heli', ka: 0.205 },
    Ne: { nom: 'neó', ka: 0.396 },
    Ar: { nom: 'argó', ka: 1.64 },
    Kr: { nom: 'criptó', ka: 2.48 },
    Xe: { nom: 'xenó', ka: 4.04 }
  };
  const COL = { nucli: '#00722b', nuvol: '214,39,40', camp: '#1F6FEB', mu: '#006B3F', molla: '#555' };
  const state = { atom: 'Ar', E: 1.5, theta: 0, exag: 1, molla: true, net: false };   // net: sense indicacions d'interacció (imatges per al PDF)

  // ---------------------------------------------------------------
  // Física
  // ---------------------------------------------------------------
  const A = () => ATOM[state.atom];
  const Cof = a => KE2 / a.ka;                       // eV/Å²
  const xOf = (a, E) => E / Cof(a);                  // Å
  const radi = a => Math.cbrt(a.ka);                 // mida de l'àtom ≈ (kα)^(1/3)
  const hw0 = a => Math.sqrt(Cof(a) * HB2M);         // eV
  // V/Å → V/m, en notació científica
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function vm(E) {
    if (E === 0) return '0 V/m';
    const v = E * 1e10, e = Math.floor(Math.log10(v));
    return fmt(v / Math.pow(10, e), 2) + '×10' + String(e).split('').map(c => SUP[+c]).join('') + ' V/m';
  }

  // ---------------------------------------------------------------
  // L'àtom dins del camp
  // ---------------------------------------------------------------
  const cP = document.getElementById('canvasPol'), g = cP.getContext('2d');
  const SC = 78;                                     // px per Å
  const centre = () => ({ x: cP.width * 0.44, y: cP.height * 0.53 });
  const anc = () => ({ x: cP.width - 70, y: 68 });   // origen de la fletxa del camp
  const RMAX = 52;                                   // px de la fletxa a |E| = EMAX

  function molla(x0, y0, x1, y1) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 10) return;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, n = 8, amp = 5;
    g.strokeStyle = COL.molla; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x0, y0);
    const a = 4, b = L - 4;
    g.lineTo(x0 + ux * a, y0 + uy * a);
    for (let i = 1; i < 2 * n; i++) {
      const t = a + (b - a) * i / (2 * n), s = (i % 2 ? 1 : -1) * amp;
      g.lineTo(x0 + ux * t - uy * s, y0 + uy * t + ux * s);
    }
    g.lineTo(x0 + ux * b, y0 + uy * b); g.lineTo(x1, y1); g.stroke();
  }

  function drawPol() {
    const W = cP.width, H = cP.height, a = A(), c = centre();
    const F = n => (state.net ? Math.round(n * 1.7) : n) + 'px';   // lletra més gran a les imatges per imprimir
    const ex = Math.cos(state.theta * Math.PI / 180), ey = -Math.sin(state.theta * Math.PI / 180);   // y de pantalla cap avall
    const x = xOf(a, state.E), d = x * state.exag * SC;
    const cx = c.x - ex * d, cy = c.y - ey * d;        // el núvol va en sentit contrari al camp
    g.clearRect(0, 0, W, H);

    // camp de fons
    if (state.E > 0.005) {
      const L = 10 + 14 * Math.sqrt(state.E / EMAX), al = 0.18 + 0.25 * state.E / EMAX;
      g.globalAlpha = al;
      for (let gx = 28; gx < W; gx += 56) for (let gy = 28; gy < H; gy += 56)
        Coh.arrow(g, gx - ex * L / 2, gy - ey * L / 2, gx + ex * L / 2, gy + ey * L / 2, COL.camp, 1.4);
      g.globalAlpha = 1;
    }

    // mida de l'àtom (sense camp)
    const R = radi(a) * SC;
    g.setLineDash([3, 4]); g.strokeStyle = '#bbb'; g.lineWidth = 1;
    g.beginPath(); g.arc(c.x, c.y, R, 0, TAU); g.stroke(); g.setLineDash([]);

    // núvol electrònic
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.35);
    grd.addColorStop(0, 'rgba(' + COL.nuvol + ',0.55)');
    grd.addColorStop(0.55, 'rgba(' + COL.nuvol + ',0.28)');
    grd.addColorStop(1, 'rgba(' + COL.nuvol + ',0)');
    g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, R * 1.35, 0, TAU); g.fill();

    // molla i centre del núvol
    if (state.molla) molla(c.x, c.y, cx, cy);
    if (d > 3) { g.fillStyle = 'rgb(' + COL.nuvol + ')'; g.beginPath(); g.arc(cx, cy, 4, 0, TAU); g.fill(); }

    // nucli
    g.fillStyle = COL.nucli; g.beginPath(); g.arc(c.x, c.y, 6.5, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText('+', c.x, c.y + 3.5);

    // dipol induït: de la càrrega negativa (núvol) a la positiva (nucli), desplaçat al costat
    if (d > 6) {
      const off = 16, px = -ey, py = ex;                 // just al costat de la molla
      const x0 = cx + px * off, y0 = cy + py * off, x1 = c.x + px * off, y1 = c.y + py * off;
      Coh.arrow(g, x0, y0, x1, y1, COL.mu, 3);
      g.fillStyle = COL.mu; g.font = 'bold ' + F(13) + ' serif'; g.textAlign = 'center';
      g.fillText('μ', (x0 + x1) / 2 + px * (state.net ? 22 : 14), (y0 + y1) / 2 + py * (state.net ? 22 : 14) + 5);
    }

    // fletxa del camp (arrossegable)
    const o = anc();
    g.setLineDash([3, 3]); g.strokeStyle = 'rgba(31,111,235,0.35)'; g.lineWidth = 1;
    g.beginPath(); g.arc(o.x, o.y, RMAX, 0, TAU); g.stroke(); g.setLineDash([]);
    const len = RMAX * state.E / EMAX;
    if (len > 2) Coh.arrow(g, o.x, o.y, o.x + ex * len, o.y + ey * len, COL.camp, 3.5);
    g.fillStyle = COL.camp; g.beginPath(); g.arc(o.x + ex * len, o.y + ey * len, 5, 0, TAU); g.fill();
    g.font = 'bold ' + F(13) + ' serif'; g.textAlign = 'center'; g.fillText('E', o.x, o.y + RMAX + (state.net ? 24 : 16));
    if (!state.net) { g.font = '10px sans-serif'; g.fillStyle = '#777'; g.fillText('arrossega', o.x, o.y + RMAX + 28); }

    // textos
    g.textAlign = 'left'; g.font = F(11) + ' sans-serif'; g.fillStyle = '#333';
    g.fillText(a.nom[0].toUpperCase() + a.nom.slice(1) + ' · kα = ' + a.ka + ' Å³', 10, state.net ? 22 : 18);
    if (state.exag > 1) { g.fillStyle = '#b23a3a'; g.fillText('desplaçament exagerat ×' + state.exag, 10, state.net ? 46 : 34); }
    g.fillStyle = '#333';
    g.fillText('|E| = ' + fmt(state.E, 2) + ' V/Å   ·   x = ' + fmt(x, 3) + ' Å   ·   μ = ' + fmt(x * EA_DEBYE, 2) + ' D', 10, H - 12);
    // escala
    g.strokeStyle = '#333'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W - 14 - SC, H - 30); g.lineTo(W - 14, H - 30); g.stroke();
    g.textAlign = 'center'; g.fillText('1 Å', W - 14 - SC / 2, H - (state.net ? 40 : 36));
  }

  // arrossegar la fletxa del camp
  (function () {
    let on = false;
    const pos = ev => {
      const r = cP.getBoundingClientRect(), t = ev.touches ? ev.touches[0] : ev;
      return { x: (t.clientX - r.left) * cP.width / r.width, y: (t.clientY - r.top) * cP.height / r.height };
    };
    const set = ev => {
      const p = pos(ev), o = anc(), dx = p.x - o.x, dy = p.y - o.y;
      state.E = Math.min(EMAX, Math.hypot(dx, dy) / RMAX * EMAX);
      if (state.E < 0.03) state.E = 0;
      state.theta = Math.round(Math.atan2(-dy, dx) * 180 / Math.PI);
      render();
    };
    const near = ev => { const p = pos(ev), o = anc(); return Math.hypot(p.x - o.x, p.y - o.y) < RMAX + 30; };
    cP.addEventListener('mousedown', ev => { if (near(ev)) { on = true; set(ev); } });
    window.addEventListener('mousemove', ev => { if (on) set(ev); });
    window.addEventListener('mouseup', () => { on = false; });
    cP.addEventListener('touchstart', ev => { if (near(ev)) { on = true; set(ev); ev.preventDefault(); } }, { passive: false });
    cP.addEventListener('touchmove', ev => { if (on) { set(ev); ev.preventDefault(); } }, { passive: false });
    cP.addEventListener('touchend', () => { on = false; });
  })();

  // ---------------------------------------------------------------
  // μ en funció de |E|
  // ---------------------------------------------------------------
  const cM = document.getElementById('canvasMu');
  const pM = Plot(cM, { xmin: 0, xmax: EMAX, ymin: 0, ymax: 4.5, m: { l: 50, r: 14, t: 14, b: 40 } });
  function drawMu() {
    pM.clear();
    pM.axes('|E| (V/Å)', 'dipol induït μ (D)');
    Object.keys(ATOM).forEach(k => {
      if (k === state.atom) return;
      const a = ATOM[k];
      pM.fn(E => xOf(a, E) * EA_DEBYE, { col: '#c8cfca', w: 1.5 });
      const Ef = Math.min(EMAX, 4.3 / (xOf(a, 1) * EA_DEBYE));
      pM.text(k, Ef, xOf(a, Ef) * EA_DEBYE, { dx: -14, dy: -4, col: '#999', font: '10px sans-serif' });
    });
    const a = A();
    pM.fn(E => xOf(a, E) * EA_DEBYE, { col: COL.mu, w: 2.5 });
    pM.vline(state.E, { col: '#ff3b30', w: 1.2, dash: [3, 3] });
    pM.dot(state.E, xOf(a, state.E) * EA_DEBYE, COL.mu, 5);
    pM.legend([{ nom: 'μ = αE, ' + a.nom, col: COL.mu, w: 2.5 }, { nom: 'altres gasos nobles', col: '#c8cfca' }], { left: true });
  }
  pM.onDrag(E => { state.E = Math.max(0, Math.min(EMAX, E)); render(); });

  // ---------------------------------------------------------------
  // Fórmules i lectures
  // ---------------------------------------------------------------
  function drawText() {
    const a = A(), C = Cof(a), x = xOf(a, state.E), mu = x;
    Coh.formulas(document.getElementById('formules'), [
      { nom: 'Equilibri del núvol', tex: ['eE=Cx\\quad\\Longrightarrow\\quad x=\\frac{eE}{C}'],
        nota: 'La força del camp sobre el núvol (−e) és −eE: el núvol es desplaça en sentit contrari al camp, i la molla l\'atura.' },
      { nom: 'Constant de la molla', tex: ['C=\\frac{ke^2}{k\\alpha}=\\frac{14.40\\ \\text{eV\\,Å}}{' + a.ka + '\\ \\text{Å}^3}=' + sig(C, 3) + '\\ \\text{eV/Å}^2'],
        nota: 'Una polaritzabilitat gran vol dir una molla tova: α = e²/C.' },
      { nom: 'Dipol induït', actiu: true, tex: [
        '\\mu=ex=\\frac{e^2}{C}\\,E=\\alpha E',
        'x=\\frac{' + fmt(state.E, 2) + '\\ \\text{eV/Å}}{' + sig(C, 3) + '\\ \\text{eV/Å}^2}=' + fmt(x, 3) + '\\ \\text{Å},\\qquad \\mu=' + fmt(mu, 3) + '\\ e\\,\\text{Å}=' + fmt(mu * EA_DEBYE, 2) + '\\ \\text{D}'],
        nota: 'El dipol va de la càrrega negativa a la positiva: apunta en el sentit del camp.' },
      { nom: 'Freqüència pròpia del model', tex: ['\\hbar\\omega_0=\\hbar\\sqrt{\\frac{C}{m}}=\\sqrt{' + sig(C, 3) + '\\times' + HB2M + '}\\ \\text{eV}=' + fmt(hw0(a), 1) + '\\ \\text{eV}'],
        nota: 'Uns quants eV, l\'ordre de les energies d\'excitació de l\'àtom, com diuen els apunts.' }
    ]);
    const frac = x / radi(a);
    Coh.readout(document.getElementById('lectura'), [
      ['àtom', a.nom], ['kα', a.ka + ' Å³'], ['C = ke²/kα', sig(C, 3) + ' eV/Å²'],
      ['|E|', fmt(state.E, 2) + ' V/Å = ' + vm(state.E)], ['direcció del camp', state.theta + '°'],
      ['desplaçament x', fmt(x, 3) + ' Å'], ['x / mida de l\'àtom', fmt(100 * frac, 1) + ' %'],
      ['μ = αE', fmt(mu, 3) + ' e·Å = ' + fmt(mu * EA_DEBYE, 2) + ' D'], ['ħω₀ (model)', fmt(hw0(a), 1) + ' eV']
    ]);
    const est = document.getElementById('estat');
    const ok = frac < 0.25;
    est.className = 'estat ' + (ok ? 'si' : 'no');
    est.textContent = state.E === 0 ? 'Sense camp, el núvol és centrat sobre el nucli: cap dipol.'
      : ok ? 'Desplaçament petit comparat amb l\'àtom: la resposta és lineal, μ = αE.'
        : 'El desplaçament ja és una fracció gran de l\'àtom: en un àtom real, la resposta deixaria de ser lineal (i un camp així l\'acabaria ionitzant).';
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  $('selAtom').addEventListener('change', () => { state.atom = $('selAtom').value; render(); });
  $('slE').addEventListener('input', () => { state.E = +$('slE').value; render(); });
  $('slTheta').addEventListener('input', () => { state.theta = +$('slTheta').value; render(); });
  $('slExag').addEventListener('input', () => { state.exag = +$('slExag').value; render(); });
  $('chkMolla').addEventListener('change', () => { state.molla = $('chkMolla').checked; render(); });
  function render() {
    $('selAtom').value = state.atom;
    $('slE').value = state.E; $('valE').textContent = fmt(state.E, 2) + ' V/Å';
    $('slTheta').value = state.theta; $('valTheta').textContent = state.theta + '°';
    $('slExag').value = state.exag; $('valExag').textContent = '×' + state.exag;
    $('chkMolla').checked = state.molla;
    drawPol(); drawMu(); drawText();
  }
  Coh.linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams(); p.set('atom', state.atom); p.set('E', fmt(state.E, 2)); p.set('theta', state.theta);
    if (state.exag > 1) p.set('exag', state.exag); if (!state.molla) p.set('molla', 0); return p;
  });
  (function fromURL() {
    const p = Coh.params();
    if (ATOM[p.get('atom')]) state.atom = p.get('atom');
    Coh.num(p, 'E', x => { state.E = x; }, 0, EMAX);
    Coh.num(p, 'theta', x => { state.theta = Math.round(x); }, -180, 360);
    Coh.num(p, 'exag', x => { state.exag = Math.round(x); }, 1, 10);
    Coh.num(p, 'molla', x => { state.molla = x !== 0; }, 0, 1);
    state.net = p.has('net');
    render();
  })();
})();
