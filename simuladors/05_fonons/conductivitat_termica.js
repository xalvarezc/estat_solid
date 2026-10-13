// Simulador — La conductivitat tèrmica d'un aïllant: K = ⅓ C v ℓ amb el recorregut lliure mitjà
// de cada fonó limitat per les vores, el desordre isotòpic i els xocs umklapp (regla de Matthiessen).
//
// Model de Debye amb una branca mitjana (window.FON_KAPPA, dades_fonons.js):
//   K = ⅓ ∫₀^{ω_D} C_ω v ℓ_ω dω,  C_ω = k_B E(ħω/k_BT)·3ω²/(2π²v³),  ℓ_ω = v τ_ω
//   1/τ = v/L + (Γ/4πnv³) ω⁴ + B ω² T e^{−Θ_D/bT},  b = 4
// Γ ve de les abundàncies isotòpiques naturals; B s'ha ajustat perquè K(300 K) sigui l'experimental
// en un cristall de 3 mm. Al diamant (Gef), Γ (isòtops + defectes) i b = 6.5 són efectius, ajustats al
// màxim mesurat del diamant natural IIa (≈ 12 000 W/(m K) a 70 K). v = k_BΘ_D/(ħ(6π²n)^{1/3}), la velocitat mitjana de Debye.

(function () {
  'use strict';
  const { fmt, sig, Plot } = Fon;
  const KB = 1.380649e-23, HB = 1.054571817e-34;
  const KM = window.FON_KAPPA;
  const ORDRE = ['Si', 'Ge', 'C', 'Al2O3', 'NaCl'];
  const L0 = 3e-3;                    // mostra de referència
  const NW = 360;                     // punts en ω

  const state = { mat: 'Si', T: 300, L: 3e-3, gf: 1, lim: true };

  function E(x) {
    if (x < 1e-6) return 1;
    if (x > 700) return 0;
    const ex = Math.exp(-x);
    return x * x * ex / ((1 - ex) * (1 - ex));
  }
  const mat = () => KM[state.mat];
  const vDeb = p => KB * p.TD / (HB * Math.cbrt(6 * Math.PI * Math.PI * p.n));

  // càlcul espectral; opt: {L, G, noB (sense vores), noUI (només vores)}
  function calc(p, T, opt) {
    const v = vDeb(p), wD = KB * p.TD / HB, dw = wD / NW;
    const A = opt.G / (4 * Math.PI * p.n * v * v * v);
    const uT = p.B * T * Math.exp(-p.TD / (p.b * T));
    let K = 0, C = 0;
    const out = opt.detall ? { nu: [], lB: [], lI: [], lU: [], l: [], k: [] } : null;
    for (let i = 0; i < NW; i++) {
      const w = (i + 0.5) * dw;
      const Cw = KB * E(HB * w / (KB * T)) * 3 * w * w / (2 * Math.PI * Math.PI * v * v * v);
      const rB = opt.noB ? 0 : v / opt.L;
      const rI = opt.noUI ? 0 : A * w * w * w * w;
      const rU = opt.noUI ? 0 : uT * w * w;
      const tau = 1 / (rB + rI + rU);
      const kw = Cw * v * v * tau / 3;
      K += kw * dw; C += Cw * dw;
      if (out) {
        out.nu.push(w / (2 * Math.PI) / 1e12);
        out.lB.push(opt.L); out.lI.push(rI > 0 ? v / rI : Infinity); out.lU.push(rU > 0 ? v / rU : Infinity);
        out.l.push(v * tau); out.k.push(kw);
      }
    }
    return { K, C, v, lbar: 3 * K / (C * v), d: out, dw };
  }
  const Gact = () => mat().Gam * state.gf;

  // ---------------------------------------------------------------
  // Gràfiques
  // ---------------------------------------------------------------
  const pK = Plot(document.getElementById('canvasK'), { m: { l: 64, r: 16, t: 16, b: 42 }, logy: true });
  const pM = Plot(document.getElementById('canvasMFP'), { m: { l: 58, r: 14, t: 16, b: 40 }, logy: true });
  const pA = Plot(document.getElementById('canvasAcc'), { m: { l: 50, r: 14, t: 16, b: 40 } });
  const TT = [1, 3, 10, 30, 100, 300, 1000];
  const lenTxt = x => x >= 1e-3 ? sig(x * 1e3, 3) + ' mm' : x >= 1e-6 ? sig(x * 1e6, 3) + ' µm' : sig(x * 1e9, 3) + ' nm';
  const lenTick = v => { const x = Math.pow(10, v); return x >= 1e-3 ? fmt(x * 1e3, 3) + ' mm' : x >= 1e-6 ? fmt(x * 1e6, 3) + ' µm' : fmt(x * 1e9, 3) + ' nm'; };

  function drawK() {
    const p = pK, m = mat();
    p.xmin = 0; p.xmax = 3; p.ymin = 0.1; p.ymax = 3e5;
    p.clear();
    p.axes('T (K)', 'K  (W/(m K))', { xticks: TT.map(Math.log10), xfmt: v => fmt(Math.pow(10, v), 0) });
    const cur = lt => calc(m, Math.pow(10, lt), { L: state.L, G: Gact() }).K;
    if (state.lim) {
      p.fn(lt => calc(m, Math.pow(10, lt), { L: state.L, G: Gact(), noUI: true }).K, { col: '#7a7a7a', w: 1.3, dash: [3, 3] }, 0, 3);
      p.fn(lt => calc(m, Math.pow(10, lt), { L: state.L, G: Gact(), noB: true }).K, { col: '#d9822b', w: 1.3, dash: [7, 4] }, 0, 3);
    }
    if (state.L !== L0 || Math.abs(state.gf - 1) > 1e-9) p.fn(lt => calc(m, Math.pow(10, lt), { L: L0, G: m.Gam }).K, { col: '#9aa8a0', w: 2 }, 0, 3);
    p.fn(cur, { col: '#009639', w: 2.8 }, 0, 3);
    p.dot(Math.log10(300), m.K300, '#b00020', 4.5);
    p.text('experimental: ' + m.K300 + ' W/(m K)', Math.log10(300), m.K300, { col: '#b00020', dx: 8, dy: -6 });
    if (m.pic) { p.dot(Math.log10(m.pic[0]), m.pic[1], '#b00020', 4.5); p.text(m.pic[2] + ': ≈ ' + m.pic[1] + ' a ' + m.pic[0] + ' K', Math.log10(m.pic[0]), m.pic[1], { col: '#b00020', dx: 8, dy: -6 }); }
    p.vline(Math.log10(state.T), { col: '#b00020', w: 1.2, dash: [3, 3] });
    const it = [{ nom: 'model: mostra i desordre triats', col: '#009639', w: 2.8 }];
    if (state.L !== L0 || Math.abs(state.gf - 1) > 1e-9) it.push({ nom: 'natural, cristall de 3 mm', col: '#9aa8a0', w: 2 });
    if (state.lim) { it.push({ nom: 'només vores (ℓ = L)', col: '#7a7a7a', w: 1.3, dash: [3, 3] }); it.push({ nom: 'sense vores (isòtops + umklapp)', col: '#d9822b', w: 1.3, dash: [7, 4] }); }
    p.legend(it);
  }

  let last = null;
  function drawMFP() {
    const p = pM, m = mat(), r = calc(m, state.T, { L: state.L, G: Gact(), detall: true }); last = r;
    const d = r.d, numax = d.nu[d.nu.length - 1] * (NW / (NW - 0.5));
    p.xmin = 0; p.xmax = numax; p.ymin = 1e-10; p.ymax = 1;
    p.clear();
    p.axes('ν (THz)', 'ℓ', { yfmt: v => lenTick(Math.log10(v)) });
    // ombra: contribució de cada freqüència a K (escala arbitrària, dibuixada a la franja de baix)
    const kmax = Math.max(...d.k), g = p.g;
    p.clip(); g.fillStyle = 'rgba(0,150,57,0.18)';
    for (let i = 0; i < d.nu.length; i++) {
      const y = Math.pow(10, -10 + 4 * d.k[i] / kmax);
      const x0 = p.X(d.nu[i] - numax / NW / 2), x1 = p.X(d.nu[i] + numax / NW / 2);
      g.fillRect(x0, p.Y(y), x1 - x0 + 0.5, p.Y(1e-10) - p.Y(y));
    }
    p.unclip();
    const ser = (arr, s) => p.pts(d.nu.map((nu, i) => [nu, Math.min(arr[i], 10)]), s);
    p.hline(state.L, { col: '#7a7a7a', w: 1.6, dash: [3, 3] });
    ser(d.lI, { col: '#8e44ad', w: 1.8, dash: [6, 3] });
    ser(d.lU, { col: '#d9822b', w: 1.8, dash: [6, 3] });
    ser(d.l, { col: '#009639', w: 2.6 });
    p.legend([{ nom: 'vores (L)', col: '#7a7a7a', dash: [3, 3] }, { nom: m.Gef ? 'isòtops i defectes' : 'isòtops', col: '#8e44ad', dash: [6, 3] }, { nom: 'umklapp', col: '#d9822b', dash: [6, 3] }, { nom: 'total', col: '#009639', w: 2.6 }]);
  }

  function drawAcc() {
    const p = pA, d = last.d;
    // parells (ℓ, contribució), ordenats per ℓ
    const pr = d.l.map((l, i) => [l, d.k[i]]).sort((a, b) => a[0] - b[0]);
    const tot = pr.reduce((s, q) => s + q[1], 0);
    let acc = 0; const pts = [];
    pr.forEach(q => { acc += q[1]; pts.push([Math.log10(q[0]), acc / tot]); });
    p.xmin = -9; p.xmax = -1; p.ymin = 0; p.ymax = 1.05;
    p.clear();
    p.axes('recorregut lliure mitjà ℓ', 'fracció acumulada de K', { xticks: [-9, -8, -7, -6, -5, -4, -3, -2], xfmt: lenTick, ny: 5 });
    p.pts([[p.xmin, 0]].concat(pts).concat([[p.xmax, 1]]), { col: '#009639', w: 2.6 });
    p.vline(Math.log10(state.L), { col: '#7a7a7a', w: 1.6, dash: [3, 3] });
    p.text('L', Math.log10(state.L), 0.08, { col: '#555', dx: 4 });
    p.vline(Math.log10(last.lbar), { col: '#b00020', w: 1.2, dash: [2, 3] });
    p.text('ℓ̄ = 3K/Cv', Math.log10(last.lbar), 0.95, { col: '#b00020', dx: 4 });
  }

  // fracció de K que porten els fonons amb ℓ > x
  function fracMesQue(x) {
    const d = last.d; let s = 0, t = 0;
    d.l.forEach((l, i) => { t += d.k[i]; if (l > x) s += d.k[i]; });
    return s / t;
  }
  // mitjana del recorregut, ponderada amb la contribució a K (mediana)
  function mediana() {
    const pr = last.d.l.map((l, i) => [l, last.d.k[i]]).sort((a, b) => a[0] - b[0]);
    const tot = pr.reduce((s, q) => s + q[1], 0); let acc = 0;
    for (const q of pr) { acc += q[1]; if (acc >= tot / 2) return q[0]; }
    return pr[pr.length - 1][0];
  }

  function lectures() {
    const m = mat(), r = last, T = state.T;
    // mecanisme dominant: el de més taxa, ponderat amb la contribució de cada freqüència
    const d = r.d; let sB = 0, sI = 0, sU = 0;
    d.k.forEach((k, i) => { sB += k / d.lB[i]; sI += k / d.lI[i]; sU += k / d.lU[i]; });
    const dom = sU >= sI && sU >= sB ? 'xocs umklapp entre fonons' : sI >= sB ? (m.Gef ? 'isòtops i defectes' : 'desordre isotòpic') : 'vores de la mostra';
    // màxim de la corba
    let Kmax = 0, Tmax = 0;
    for (let lt = 0; lt <= 3; lt += 0.01) { const K = calc(m, Math.pow(10, lt), { L: state.L, G: Gact() }).K; if (K > Kmax) { Kmax = K; Tmax = Math.pow(10, lt); } }
    Fon.readout(document.getElementById('lectura'), [
      ['material', m.nom],
      ['T', fmt(T, T < 10 ? 2 : 0) + ' K'],
      ['mida de la mostra L', lenTxt(state.L)],
      [m.Gef ? 'Γ efectiu (isòtops i defectes)' : 'Γ (desordre isotòpic)', sig(Gact(), 3) + (Math.abs(state.gf - 1) < 1e-9 ? ' (natural)' : '')],
      ['C (per volum)', sig(r.C / 1e6, 3) + ' MJ/(m³ K)'],
      ['v (Debye)', sig(r.v / 1000, 3) + ' km/s'],
      ['ℓ̄ = 3K/(Cv)', lenTxt(r.lbar)],
      ['mediana de ℓ (ponderada amb K)', lenTxt(mediana())],
      ['K del model', sig(r.K, 3) + ' W/(m K)'],
      ['K experimental (300 K)', m.K300 + ' W/(m K)'],
      ['fonons amb ℓ > 1 µm', sig(100 * fracMesQue(1e-6), 2) + ' % de K'],
      ['màxim de K(T)', sig(Kmax, 3) + ' W/(m K) a ' + fmt(Tmax, 0) + ' K'],
      ['mecanisme dominant', dom]
    ]);
    const Tp = Tmax;
    let est;
    if (T < 0.6 * Tp) est = 'Per sota del màxim: el recorregut el limiten les vores (ℓ ≈ L) i K ∝ C ∝ T³.';
    else if (T < 1.6 * Tp) est = 'Prop del màxim: els xocs umklapp ja s\'han congelat i el recorregut toca les vores de la mostra.';
    else est = 'Per sobre del màxim: els xocs umklapp entre fonons dominen; ℓ i K baixen quan puja la temperatura.';
    document.getElementById('estat').textContent = est;
    Fon.formulas(document.getElementById('formules'), [
      { nom: 'Teoria cinètica', tex: ['K=\\tfrac13\\,C\\,v\\,\\bar\\ell\\quad\\Rightarrow\\quad\\bar\\ell=\\frac{3K}{Cv}=' + (r.lbar >= 1e-6 ? sig(r.lbar * 1e6, 3) + '\\ \\mu\\text{m}' : sig(r.lbar * 1e9, 3) + '\\ \\text{nm}')], actiu: true },
      { nom: 'Regla de Matthiessen', tex: ['\\frac{1}{\\ell}=\\frac{1}{L}+\\frac{1}{\\ell_{\\text{isòtops}}}+\\frac{1}{\\ell_{\\text{umklapp}}}'] },
      { nom: 'Cada mecanisme', tex: ['\\ell_{\\text{isòtops}}=\\frac{4\\pi n v^4}{\\Gamma\\,\\omega^4}\\qquad \\ell_{\\text{umklapp}}=\\frac{v\\,e^{\\Theta_D/bT}}{B\\,\\omega^2\\,T}'] },
      { nom: 'Fonó a fonó', tex: ['K=\\frac13\\int_0^{\\omega_D}C_\\omega\\,v\\,\\ell_\\omega\\,d\\omega'] }
    ]);
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  function sync() {
    const m = mat();
    $('selMat').value = state.mat;
    $('slT').value = Math.log10(state.T); $('valT').textContent = fmt(state.T, state.T < 10 ? 2 : 0) + ' K';
    $('slL').value = Math.log10(state.L); $('valL').textContent = lenTxt(state.L);
    $('slG').value = Math.log10(state.gf); $('valG').textContent = sig(state.gf, 2);
    $('chkLim').checked = state.lim;
    $('btnPur').disabled = !m.Gpur; $('btnPur').textContent = m.Gpur ? 'isotòpicament pur (' + m.nomPur + ')' : 'isotòpicament pur (no disponible)';
    $('notaMat').innerHTML = 'Θ<sub>D</sub> = ' + m.TD + ' K · n = ' + sig(m.n / 1e28, 3) + '×10²⁸ àtoms/m³ · K(300 K) experimental = ' + m.K300 + ' W/(m K).' + (m.nota ? ' ' + m.nota : '');
  }
  function render() { sync(); drawK(); drawMFP(); drawAcc(); lectures(); }

  $('selMat').innerHTML = ORDRE.map(k => '<option value="' + k + '">' + KM[k].nom + '</option>').join('');
  $('selMat').addEventListener('change', () => { state.mat = $('selMat').value; state.gf = 1; render(); });
  $('slT').addEventListener('input', ev => { state.T = Math.pow(10, +ev.target.value); render(); });
  $('grupT').addEventListener('click', ev => { const b = ev.target.closest('[data-t]'); if (b) { state.T = +b.dataset.t; render(); } });
  $('slL').addEventListener('input', ev => { state.L = Math.pow(10, +ev.target.value); render(); });
  $('grupL').addEventListener('click', ev => { const b = ev.target.closest('[data-l]'); if (b) { state.L = +b.dataset.l; render(); } });
  $('slG').addEventListener('input', ev => { state.gf = Math.pow(10, +ev.target.value); render(); });
  $('grupG').addEventListener('click', ev => {
    const b = ev.target.closest('[data-g]'); if (!b || b.disabled) return;
    const m = mat();
    state.gf = b.dataset.g === 'nat' ? 1 : b.dataset.g === 'pur' ? m.Gpur / m.Gam : +b.dataset.g;
    render();
  });
  $('chkLim').addEventListener('change', () => { state.lim = $('chkLim').checked; render(); });

  Fon.linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams();
    p.set('mat', state.mat); p.set('T', +state.T.toPrecision(4)); p.set('L', +state.L.toPrecision(3));
    if (Math.abs(state.gf - 1) > 1e-9) p.set('G', +state.gf.toPrecision(3));
    if (!state.lim) p.set('lim', 0);
    return p;
  });

  (function () {
    const p = Fon.params();
    if (KM[p.get('mat')]) state.mat = p.get('mat');
    Fon.num(p, 'T', x => { state.T = x; }, 1, 1000);
    Fon.num(p, 'L', x => { state.L = x; }, 1e-8, 1e-2);
    Fon.num(p, 'G', x => { state.gf = x; }, 1e-3, 100);
    if (p.get('lim') === '0') state.lim = false;
  })();
  render();
})();
