// Simulador — La calor específica d'un cristall: ocupació de Planck, densitat d'estats,
// models d'Einstein i de Debye, llei T³ i Dulong-Petit.
//
// La densitat d'estats g(ν) de cada material (window.FON_DOS, dades_fonons.js) és per àtom,
// en modes per THz, amb ∫g dν = 3. Totes les calors específiques es calculen en unitats de 3R
// (per mol d'àtoms) i es passen a J/(mol K) o a J/(kg K) només per mostrar-les.

(function () {
  'use strict';
  const { fmt, sig, Plot } = Fon;
  const H = 6.62607015e-34, KB = 1.380649e-23, R = 8.314462618;
  const D = window.FON_DOS;
  const ORDRE = ['C', 'Si', 'Ge', 'Cu', 'Al', 'W', 'NaCl', 'Ar', 'cBN'];

  const state = { mat: 'C', T: 300, TD: 2230, TE: 1780, dos: true, deb: true, ein: true, escala: 'lin', unitat: 'mol' };

  // ---------------------------------------------------------------
  // Física
  // ---------------------------------------------------------------
  // calor específica d'un oscil·lador, en unitats de k: E(x) = x² eˣ/(eˣ − 1)²
  function E(x) {
    if (x < 1e-6) return 1;
    if (x > 700) return 0;
    const ex = Math.exp(-x);
    return x * x * ex / ((1 - ex) * (1 - ex));
  }
  // Planck
  const nPlanck = x => x > 700 ? 0 : 1 / Math.expm1(x);
  // Debye: C_V/3R = (3/x_D³) ∫₀^{x_D} x⁴eˣ/(eˣ − 1)² dx   (Simpson)
  function debye(xD) {
    if (xD < 1e-4) return 1;
    if (xD > 60) return 4 * Math.pow(Math.PI, 4) / (5 * xD * xD * xD);
    const n = 160, h = xD / n;
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const x = i * h, f = x < 1e-8 ? 0 : x * x * E(x);
      s += f * (i === 0 || i === n ? 1 : (i % 2 ? 4 : 2));
    }
    return 3 / (xD * xD * xD) * s * h / 3;
  }
  const mat = () => D[state.mat];
  const nuOf = (m, i) => (i + 0.5) * m.dnu;                    // centre de l'interval, THz
  const xOf = (nuTHz, T) => H * nuTHz * 1e12 / (KB * T);
  // Prop de ν = 0 el mostreig de la zona de Brillouin no resol la paràbola acústica: per sota de
  // νc ≈ 0.12 ν_D(so) es fa servir el límit exacte del mateix model, g = 9ν²/ν_D³, amb la Θ_D del so.
  function cvDOS(m, T) {
    const nuDel = KB * m.TDel / H / 1e12, ic = Math.max(1, Math.ceil(0.12 * nuDel / m.dnu)), nuc = ic * m.dnu;
    let s = 0;
    for (let i = ic; i < m.g.length; i++) s += m.g[i] * E(xOf(nuOf(m, i), T));
    s *= m.dnu;
    const A = 9 / Math.pow(nuDel, 3), n = 200, h = nuc / n;
    for (let j = 0; j < n; j++) { const nu = (j + 0.5) * h; s += A * nu * nu * E(xOf(nu, T)) * h; }
    return s / 3;
  }
  function fracActius(m, T) {
    const nuT = KB * T / H / 1e12;
    let s = 0;
    for (let i = 0; i < m.g.length; i++) if (nuOf(m, i) < nuT) s += m.g[i];
    return s * m.dnu / 3;
  }
  const cvDeb = T => debye(state.TD / T);
  const cvEin = T => E(state.TE / T);
  const TDcal = m => m.TD || m.TDel;

  // unitats: de C/3R a la unitat mostrada
  const unit = () => state.unitat === 'kg' ? 3 * R / (mat().M * 1e-3) : 3 * R;
  const unitTxt = () => state.unitat === 'kg' ? 'J/(kg K)' : 'J/(mol K)';

  // ---------------------------------------------------------------
  // Gràfiques
  // ---------------------------------------------------------------
  const cDOS = document.getElementById('canvasDOS'), cOc = document.getElementById('canvasOcup'), cCv = document.getElementById('canvasCv');
  const pDOS = Plot(cDOS, { m: { l: 50, r: 14, t: 16, b: 40 } });
  const pOc = Plot(cOc, { m: { l: 54, r: 14, t: 16, b: 40 }, logy: true });
  const pCv = Plot(cCv, { m: { l: 62, r: 16, t: 16, b: 42 } });

  function drawDOS() {
    const m = mat(), p = pDOS, T = state.T;
    const gmax = Math.max(...m.g);
    const nuD = KB * state.TD / H / 1e12, nuE = KB * state.TE / H / 1e12, nuT = KB * T / H / 1e12;
    p.xmin = 0; p.xmax = Math.max(m.numax, 0) * 1.1;
    p.ymin = 0; p.ymax = Math.min(Math.max(gmax, state.deb && nuD < p.xmax ? 9 / nuD : 0), 2.4 * gmax) * 1.12;
    p.clear(); p.axes('ν (THz)', 'g(ν)  (modes per àtom i per THz)', { nx: 6, ny: 5 });
    const g = p.g;
    p.clip();
    // histograma
    for (let i = 0; i < m.g.length; i++) {
      const x0 = p.X(i * m.dnu), x1 = p.X((i + 1) * m.dnu);
      if (state.dos) { g.fillStyle = '#c9d2cc'; g.fillRect(x0, p.Y(m.g[i]), Math.max(1, x1 - x0), p.Y(0) - p.Y(m.g[i])); }
      const a = m.g[i] * E(xOf(nuOf(m, i), T));
      g.fillStyle = 'rgba(0,150,57,0.75)'; g.fillRect(x0, p.Y(a), Math.max(1, x1 - x0), p.Y(0) - p.Y(a));
    }
    p.unclip();
    if (state.deb) {
      p.fn(nu => nu <= nuD ? 9 * nu * nu / (nuD * nuD * nuD) : NaN, { col: '#1f6feb', w: 2, dash: [6, 4] }, 0, Math.min(nuD, p.xmax));
      if (nuD < p.xmax) p.pts([[nuD, 9 / nuD], [nuD, 0]], { col: '#1f6feb', w: 1.5, dash: [6, 4] });
    }
    if (state.ein && nuE < p.xmax) {
      Fon.arrow(g, p.X(nuE), p.Y(0), p.X(nuE), p.Y(p.ymax * 0.93), '#b26a00', 2.5);
      const dreta = nuE > 0.6 * p.xmax;
      p.text('Einstein: 3 modes/àtom', nuE, p.ymax * 0.6, { col: '#b26a00', dx: dreta ? -6 : 6, align: dreta ? 'right' : 'left', font: '11px sans-serif' });
    }
    if (nuT < p.xmax) {
      p.vline(nuT, { col: '#b00020', w: 1.3, dash: [3, 3] });
      p.text('kT/h', nuT, p.ymax * 0.82, { col: '#b00020', dx: 4 });
    }
    const it = [];
    if (state.dos) it.push({ nom: 'g(ν) del cristall', col: '#c9d2cc', w: 8 });
    it.push({ nom: 'g(ν)·E(hν/kT): contribució a Cᵥ', col: 'rgba(0,150,57,0.75)', w: 8 });
    if (state.deb) it.push({ nom: 'Debye', col: '#1f6feb', dash: [6, 4] });
    p.legend(it);
  }

  function drawOcup() {
    const m = mat(), p = pOc, T = state.T;
    const nuT = KB * T / H / 1e12;
    p.xmin = 0; p.xmax = Math.max(m.numax, 0) * 1.1; p.ymin = 1e-4; p.ymax = 1e3;
    p.clear(); p.axes('ν (THz)', 'n (fonons per mode)', { nx: 6 });
    p.hline(1, { col: '#c9d2cc', w: 1 });
    p.fn(nu => KB * T / (H * nu * 1e12), { col: '#888', w: 1.6, dash: [5, 4] }, p.xmax * 1e-3, p.xmax);
    p.fn(nu => nPlanck(xOf(nu, T)), { col: '#009639', w: 2.4 }, p.xmax * 1e-3, p.xmax);
    if (nuT < p.xmax) { p.vline(nuT, { col: '#b00020', w: 1.3, dash: [3, 3] }); p.text('kT/h', nuT, 300, { col: '#b00020', dx: 4 }); }
    p.legend([{ nom: 'Planck: 1/(exp(hν/kT) − 1)', col: '#009639', w: 2.4 }, { nom: 'clàssic: kT/hν', col: '#888', dash: [5, 4] }]);
  }

  const LT0 = 0, LT1 = 3.5;
  const TT = [1, 3, 10, 30, 100, 300, 1000, 3000];
  function drawCv() {
    const m = mat(), p = pCv, u = unit(), log = state.escala === 'log';
    p.xmin = LT0; p.xmax = LT1; p.logy = log;
    if (log) { p.ymin = 1e-6 * u; p.ymax = 2 * u; } else { p.ymin = 0; p.ymax = 1.12 * u; }
    p.clear();
    p.axes('T (K)', 'Cᵥ  (' + unitTxt() + ')', { xticks: TT.map(Math.log10), xfmt: v => fmt(Math.pow(10, v), 0), ny: 6 });
    p.hline(u, { col: '#999', w: 1.2, dash: [2, 3] });
    p.text('Dulong-Petit: 3R', 2.0, u, { col: '#666', dy: -6, align: 'center' });
    const curve = f => p.fn(lt => f(Math.pow(10, lt)) * u, null, LT0, LT1);
    if (log && state.deb) p.fn(lt => 4 * Math.pow(Math.PI, 4) / 5 * Math.pow(Math.pow(10, lt) / state.TD, 3) * u, { col: '#1f6feb', w: 1, alpha: 0.5 }, LT0, LT1);
    if (state.ein) p.fn(lt => cvEin(Math.pow(10, lt)) * u, { col: '#b26a00', w: 2.2, dash: [2, 3] }, LT0, LT1);
    if (state.deb) p.fn(lt => cvDeb(Math.pow(10, lt)) * u, { col: '#1f6feb', w: 2.2, dash: [7, 4] }, LT0, LT1);
    if (state.dos) p.fn(lt => cvDOS(m, Math.pow(10, lt)) * u, { col: '#009639', w: 2.6 }, LT0, LT1);
    if (m.cp298) { p.dot(Math.log10(298), m.cp298 / (3 * R) * u, '#b00020', 4.5); p.text('Cₚ experimental (298 K)', Math.log10(298), m.cp298 / (3 * R) * u, { col: '#b00020', dx: 8, dy: 4 }); }
    p.vline(Math.log10(state.T), { col: '#b00020', w: 1.2, dash: [3, 3] });
    const it = [];
    if (state.dos) it.push({ nom: 'densitat d\'estats del cristall', col: '#009639', w: 2.6 });
    if (state.deb) it.push({ nom: 'Debye, ΘD = ' + fmt(state.TD, 0) + ' K', col: '#1f6feb', dash: [7, 4] });
    if (state.ein) it.push({ nom: 'Einstein, ΘE = ' + fmt(state.TE, 0) + ' K', col: '#b26a00', dash: [2, 3] });
    if (log && state.deb) it.push({ nom: 'llei T³', col: 'rgba(31,111,235,0.5)', w: 1 });
    p.legend(it, log ? { dy: 120 } : { left: true, dy: 18 });
  }

  // ---------------------------------------------------------------
  // Lectures i fórmules
  // ---------------------------------------------------------------
  function lectures() {
    const m = mat(), T = state.T, u = unit();
    const cD = cvDOS(m, T), cB = cvDeb(T), cE = cvEin(T), fr = fracActius(m, T);
    const rows = [
      ['material', m.nom],
      ['T', fmt(T, T < 10 ? 2 : 0) + ' K'],
      ['kT/h', sig(KB * T / H / 1e12, 3) + ' THz'],
      ['modes amb hν < kT', sig(100 * fr, 3) + ' %'],
      ['C<sub>V</sub>/3R, cristall', sig(cD, 3)],
      ['C<sub>V</sub>/3R, Debye', sig(cB, 3)],
      ['C<sub>V</sub>/3R, Einstein', sig(cE, 3)],
      ['C<sub>V</sub> del cristall', sig(cD * 3 * R, 3) + ' J/(mol K) · ' + sig(cD * 3 * R / (m.M * 1e-3), 3) + ' J/(kg K)'],
      ['Θ<sub>D</sub> calorimètrica', m.TD ? m.TD + ' K' : '—'],
      ['Θ<sub>D</sub> del so (model)', m.TDel + ' K']
    ];
    if (m.cp298) rows.push(['C<sub>p</sub> exp. a 298 K', m.cp298 + ' J/(mol K) = ' + sig(m.cp298 / (3 * R), 3) + '·3R']);
    Fon.readout(document.getElementById('lectura'), rows);
    const ref = TDcal(m);
    let est;
    if (T > 0.9 * ref) est = 'Règim clàssic (T ≳ ΘD): la majoria dels modes tenen hν ≲ kT i Cᵥ s\'acosta a 3R.';
    else if (T < ref / 15) est = 'Règim quàntic (T ≪ ΘD): només els modes acústics de freqüència baixa estan actius, i Cᵥ creix com T³.';
    else est = 'Règim intermedi: una part dels modes està congelada (hν > kT).';
    document.getElementById('estat').textContent = est;

    const lowT = T < ref / 15, highT = T > 0.9 * ref;
    Fon.formulas(document.getElementById('formules'), [
      { nom: 'Ocupació d\'un mode (Planck)', tex: ['\\langle n\\rangle=\\frac{1}{e^{h\\nu/k_BT}-1}'] },
      { nom: 'Calor específica d\'un mode', tex: ['C_{\\text{mode}}=k_B\\,E(x),\\qquad E(x)=\\frac{x^2e^x}{(e^x-1)^2},\\quad x=\\frac{h\\nu}{k_BT}'] },
      { nom: 'Cristall: suma sobre la densitat d\'estats', tex: ['\\frac{C_V}{3R}=\\frac13\\int_0^{\\nu_{\\max}}g(\\nu)\\,E\\!\\left(\\frac{h\\nu}{k_BT}\\right)d\\nu=' + sig(cD, 3)], actiu: state.dos },
      { nom: 'Einstein', tex: ['\\frac{C_V}{3R}=E\\!\\left(\\frac{\\Theta_E}{T}\\right)=' + sig(cE, 3)] },
      { nom: 'Debye', tex: ['\\frac{C_V}{3R}=3\\left(\\frac{T}{\\Theta_D}\\right)^3\\int_0^{\\Theta_D/T}\\frac{x^4e^x}{(e^x-1)^2}dx=' + sig(cB, 3)], actiu: !lowT && !highT },
      { nom: 'Límits', tex: ['T\\ll\\Theta_D:\\ \\frac{C_V}{3R}\\simeq\\frac{4\\pi^4}{5}\\left(\\frac{T}{\\Theta_D}\\right)^3\\qquad T\\gg\\Theta_D:\\ C_V\\to3R'], actiu: lowT || highT }
    ]);
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const lg = Math.log10;
  function setMat(k) {
    state.mat = k; const m = mat();
    state.TD = TDcal(m); state.TE = Math.round(0.8 * state.TD);
  }
  function sync() {
    $('selMat').value = state.mat;
    $('slT').value = lg(state.T); $('valT').textContent = fmt(state.T, state.T < 10 ? 2 : 0) + ' K';
    $('slTD').value = lg(state.TD); $('valTD').textContent = fmt(state.TD, 0) + ' K';
    $('slTE').value = lg(state.TE); $('valTE').textContent = fmt(state.TE, 0) + ' K';
    $('chkDOS').checked = state.dos; $('chkDeb').checked = state.deb; $('chkEin').checked = state.ein;
    setEsc(state.escala); setUni(state.unitat);
    const m = mat();
    $('notaMat').textContent = 'Densitat d\'estats: ' + m.model + '. Massa per àtom: ' + m.M + ' g/mol.';
  }
  function render() { sync(); drawDOS(); drawOcup(); drawCv(); lectures(); }

  $('selMat').innerHTML = ORDRE.map(k => '<option value="' + k + '">' + D[k].nom + '</option>').join('');
  $('selMat').addEventListener('change', () => { setMat($('selMat').value); render(); });
  $('slT').addEventListener('input', ev => { state.T = Math.pow(10, +ev.target.value); render(); });
  $('grupT').addEventListener('click', ev => { const b = ev.target.closest('[data-t]'); if (b) { state.T = +b.dataset.t; render(); } });
  $('slTD').addEventListener('input', ev => { state.TD = Math.pow(10, +ev.target.value); render(); });
  $('slTE').addEventListener('input', ev => { state.TE = Math.pow(10, +ev.target.value); render(); });
  $('grupTD').addEventListener('click', ev => { const b = ev.target.closest('[data-td]'); if (!b) return; state.TD = b.dataset.td === 'el' ? mat().TDel : TDcal(mat()); render(); });
  ['chkDOS', 'chkDeb', 'chkEin'].forEach(id => $(id).addEventListener('change', () => { state.dos = $('chkDOS').checked; state.deb = $('chkDeb').checked; state.ein = $('chkEin').checked; render(); }));
  const setEsc = Fon.optionGroup($('grupEscala'), v => { state.escala = v; render(); });
  const setUni = Fon.optionGroup($('grupUnitat'), v => { state.unitat = v; render(); });

  Fon.linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams();
    p.set('mat', state.mat); p.set('T', +state.T.toPrecision(4)); p.set('TD', Math.round(state.TD)); p.set('TE', Math.round(state.TE));
    if (state.escala !== 'lin') p.set('escala', state.escala);
    if (state.unitat !== 'mol') p.set('unitat', state.unitat);
    if (!state.dos) p.set('dos', 0); if (!state.deb) p.set('deb', 0); if (!state.ein) p.set('ein', 0);
    return p;
  });

  // paràmetres d'URL
  (function () {
    const p = Fon.params();
    if (D[p.get('mat')]) setMat(p.get('mat')); else setMat(state.mat);
    Fon.num(p, 'T', x => { state.T = x; }, 1, 3200);
    Fon.num(p, 'TD', x => { state.TD = x; }, 20, 3200);
    Fon.num(p, 'TE', x => { state.TE = x; }, 20, 3200);
    if (p.get('escala') === 'log') state.escala = 'log';
    if (p.get('unitat') === 'kg') state.unitat = 'kg';
    if (p.get('dos') === '0') state.dos = false;
    if (p.get('deb') === '0') state.deb = false;
    if (p.get('ein') === '0') state.ein = false;
  })();
  render();
})();
