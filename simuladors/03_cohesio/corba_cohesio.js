// Simulador — La corba de cohesió i el mòdul de compressibilitat.
// Tres models dels apunts del Tema 3, amb la mateixa fórmula final B = e''(r0)/(9 g r0):
//   Lennard-Jones FCC:  e(r) = 2ε[A12 (σ/r)^12 − A6 (σ/r)^6],                      g = 1/√2
//   iònic (per ió):     e(r) = ½[−k q² M / r + C / r^m],  C = k q² M r0^(m−1)/m,       g = 1 (NaCl), 4/(3√3) (CsCl)
//   covalent:           e(r) = −A/r^n + C/r^m,  A = m|e0| r0^n/(m−n),  C = (n/m) A r0^(m−n), g = 8/(3√3) (diamant)

(function () {
  'use strict';
  const { KE2, EVA3_GPA, fmt, sig, Plot } = Coh;
  const A12 = 12.13188, A6 = 14.45392;
  const COL = { e: '#00722b', at: '#2980b9', rep: '#d62728', par: '#e67e22', cur: '#ff3b30', F: '#8e44ad' };
  // ?lectura=corba (apunts web, secció 1): r0, E_coh, e''(r0) i la força F = −de/dr al punt; sense pressió ni B
  const NOMES_CORBA = Coh.params().get('lectura') === 'corba';

  // ---------------------------------------------------------------
  // Materials (dades dels apunts del Tema 3 i de Kittel, cap. 3)
  // ---------------------------------------------------------------
  const MAT = {
    lj: [
      { id: 'Ne', eps: 3.1, sig: 2.74, Bexp: 1.1, r0exp: 3.13, Eexp: 0.020 },
      { id: 'Ar', eps: 10.4, sig: 3.40, Bexp: 2.7, r0exp: 3.75, Eexp: 0.080 },
      { id: 'Kr', eps: 14.0, sig: 3.65, Bexp: 3.5, r0exp: 3.99, Eexp: 0.116 },
      { id: 'Xe', eps: 20.0, sig: 3.98, Bexp: 3.6, r0exp: 4.33, Eexp: 0.170 }
    ],
    ion: [
      { id: 'NaCl', est: 'nacl', r0: 2.820, m: 8, q: 1, Bexp: 24, Eexp: 7.9 },
      { id: 'KCl', est: 'nacl', r0: 3.147, m: 9, q: 1, Bexp: 17.4, Eexp: 7.4 },
      { id: 'LiF', est: 'nacl', r0: 2.014, m: 6, q: 1, Bexp: 67, Eexp: 10.7 },
      { id: 'CsCl', est: 'cscl', r0: 3.571, m: 10.5, q: 1, Bexp: 18.2, Eexp: 6.8 }
    ],
    cov: [
      { id: 'C (diamant)', r0: 1.545, e0: 7.37, n: 4, m: 5, Bexp: 443, Eexp: 7.37 },
      { id: 'Si', r0: 2.352, e0: 4.63, n: 4, m: 5, Bexp: 98, Eexp: 4.63 },
      { id: 'Ge', r0: 2.450, e0: 3.85, n: 4, m: 5, Bexp: 75, Eexp: 3.85 }
    ]
  };
  const EST = {
    nacl: { nom: 'NaCl', M: 1.7476, g: 1, aOf: r => 2 * r, aTxt: 'a = 2r_0' },
    cscl: { nom: 'CsCl', M: 1.7627, g: 4 / (3 * Math.sqrt(3)), aOf: r => 2 * r / Math.sqrt(3), aTxt: 'a = 2r_0/\\sqrt3' }
  };
  const MODEL_NOM = { lj: 'Lennard-Jones (gasos nobles, FCC)', ion: 'Iònic (Madelung)', cov: 'Covalent (estructura diamant)' };

  const state = {
    model: 'lj', mat: 'Ar',
    lj: { eps: 10.4, sig: 3.40 },
    ion: { est: 'nacl', r0: 2.820, m: 8, q: 1 },
    cov: { r0: 1.545, e0: 7.37, n: 4, m: 5 },
    x: 1.0, parab: true, comp: true
  };

  // ---------------------------------------------------------------
  // Física: per a cada model, e(r), components, r0, e0, e''(r0), g
  // ---------------------------------------------------------------
  function model(mo, P) {
    if (mo === 'lj') {
      const eps = P.eps / 1000, s = P.sig;
      const att = r => -2 * eps * A6 * Math.pow(s / r, 6), rep = r => 2 * eps * A12 * Math.pow(s / r, 12);
      const r0 = Math.pow(2 * A12 / A6, 1 / 6) * s, e0 = -A6 * A6 / (2 * A12) * eps;
      const e2 = 36 * eps * A6 * A6 / (A12 * r0 * r0), g = 1 / Math.SQRT2;
      return { e: r => att(r) + rep(r), att, rep, r0, e0, e2, g, a: Math.SQRT2 * r0, unit: 'per àtom' };
    }
    if (mo === 'ion') {
      const E = EST[P.est], kq2M = KE2 * P.q * P.q * E.M, r0 = P.r0, m = P.m;
      const C = kq2M * Math.pow(r0, m - 1) / m;
      const att = r => -0.5 * kq2M / r, rep = r => 0.5 * C / Math.pow(r, m);
      const e0 = -kq2M / (2 * r0) * (1 - 1 / m), e2 = kq2M * (m - 1) / (2 * r0 * r0 * r0);
      return { e: r => att(r) + rep(r), att, rep, r0, e0, e2, g: E.g, a: E.aOf(r0), unit: 'per ió', kq2M, C };
    }
    const { r0, n, m } = P, e0a = P.e0;
    const A = m * e0a * Math.pow(r0, n) / (m - n), C = n / m * A * Math.pow(r0, m - n);
    const att = r => -A / Math.pow(r, n), rep = r => C / Math.pow(r, m);
    return { e: r => att(r) + rep(r), att, rep, r0, e0: -e0a, e2: n * m * e0a / (r0 * r0), g: 8 / (3 * Math.sqrt(3)), a: 4 * r0 / Math.sqrt(3), unit: 'per àtom', A, C };
  }
  const Bof = M => M.e2 / (9 * M.g * M.r0) * EVA3_GPA;               // GPa
  const deriv = (f, r) => (f(r * (1 + 1e-5)) - f(r * (1 - 1e-5))) / (2e-5 * r);
  const pressure = (M, r) => -deriv(M.e, r) / (3 * M.g * r * r) * EVA3_GPA;   // P = −de/dv, v = g r³

  const cur = () => model(state.model, state[state.model]);
  const matObj = () => MAT[state.model].find(x => x.id === state.mat);

  // ---------------------------------------------------------------
  // Gràfica 1: e(r)
  // ---------------------------------------------------------------
  const cR = document.getElementById('canvasR');
  const pR = Plot(cR, { m: { l: 58, r: 14, t: 14, b: 40 } });
  // Eixos fixos per a cada mecanisme (hi caben tots els materials de la família i la corba actual),
  // perquè els pous d'una mateixa família es puguin comparar a ull. En canviar de mecanisme,
  // l'escala canvia amb un zoom animat i una etiqueta en diu el factor.
  const paramsDe = (mo, m) => mo === 'lj' ? { eps: m.eps, sig: m.sig }
    : mo === 'ion' ? { est: m.est, r0: m.r0, m: m.m, q: m.q } : { r0: m.r0, e0: m.e0, n: m.n, m: m.m };
  const familia = mo => MAT[mo].map(m => ({ id: m.id, M: model(mo, paramsDe(mo, m)) }));
  function eixosDe(mo, M) {
    const Ms = familia(mo).map(f => f.M).concat(M ? [M] : []);
    const r0s = Ms.map(m => m.r0), e0min = Math.min(...Ms.map(m => m.e0));
    return { xmin: 0.78 * Math.min(...r0s), xmax: 2.0 * Math.max(...r0s), ymin: 1.35 * e0min, ymax: -1.0 * e0min };
  }
  let eixos = null, anim = null, modelAnt = null, rafPendent = false;
  function eixosAra(M) {
    const T = eixosDe(state.model, M);
    if (eixos && modelAnt && modelAnt !== state.model) anim = { de: eixos, t0: performance.now() };
    modelAnt = state.model;
    if (!anim) return T;
    const de = anim.de, s = Math.min(1, (performance.now() - anim.t0) / 600);
    const k = s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) * (1 - s);
    // interpolació geomètrica: les escales difereixen en ordres de magnitud
    const geo = c => Math.sign(T[c]) * Math.exp((1 - k) * Math.log(Math.abs(de[c])) + k * Math.log(Math.abs(T[c])));
    if (s < 1) {
      if (!rafPendent) { rafPendent = true; requestAnimationFrame(() => { rafPendent = false; drawR(); }); }
    } else anim = null;
    return { xmin: geo('xmin'), xmax: geo('xmax'), ymin: geo('ymin'), ymax: geo('ymax') };
  }

  function drawR() {
    const M = cur(), r0 = M.r0, e0 = M.e0, r = state.x * r0;
    eixos = eixosAra(M);
    Object.assign(pR, eixos);
    pR.clear();
    pR.axes('r (Å): distància entre veïns més propers', 'e(r) (eV ' + M.unit + ')');
    // la resta de materials de la família, en gris
    familia(state.model).forEach(f => {
      if (f.id === state.mat) return;
      pR.fn(f.M.e, { col: '#b8bec8', w: 1.5 });
      pR.text(f.id, f.M.r0, f.M.e0, { dy: 14, align: 'center', col: '#8a919c', font: '10px sans-serif' });
    });
    if (state.model !== 'lj') {
      const f = Math.round(eixosDe(state.model).ymin / eixosDe('lj').ymin);
      pR.text('eix vertical ×' + f + ' respecte de vdW', pR.xmin, pR.ymax, { dx: 8, dy: 14, col: '#8a919c', font: 'italic 11px sans-serif' });
    }
    if (state.comp) {
      pR.fn(M.att, { col: COL.at, w: 1.5, dash: [5, 4] });
      pR.fn(M.rep, { col: COL.rep, w: 1.5, dash: [5, 4] });
    }
    if (state.parab) pR.fn(x => e0 + 0.5 * M.e2 * (x - r0) * (x - r0), { col: COL.par, w: 2, dash: [7, 4] }, 0.82 * r0, 1.25 * r0);
    pR.fn(M.e, { col: COL.e, w: 2.5 });
    pR.vline(r0, { col: '#9aa8a0', w: 1, dash: [2, 3] });
    pR.text('r₀ = ' + fmt(r0, 3) + ' Å', r0, pR.ymin, { dx: 4, dy: -6, col: '#555', font: '10px sans-serif' });
    pR.text('e₀ = ' + sig(e0, 3) + ' eV', r0, e0, { dx: 8, dy: 14, col: '#555', font: '10px sans-serif' });
    // tangent i punt actual
    const er = M.e(r), sl = deriv(M.e, r);
    pR.fn(x => er + sl * (x - r), { col: COL.cur, w: 1, alpha: 0.6 }, r - 0.12 * r0, r + 0.12 * r0);
    if (NOMES_CORBA && Math.abs(state.x - 1) > 1e-3) {
      // força sobre l'àtom, F = −de/dr: sempre cap a l'equilibri
      const Fref = Math.abs(deriv(M.e, 0.95 * r0)), L = Math.max(12, 70 * Math.min(1, Math.abs(sl) / Fref));
      const x0 = pR.X(r), y0 = pR.Y(er), dir = sl > 0 ? -1 : 1;
      Coh.arrow(pR.g, x0, y0, x0 + dir * L, y0, COL.F, 2.5);
      pR.text('F', r, er, { dx: dir * L / 2 - 4, dy: -8, col: COL.F, font: 'bold 12px sans-serif' });
    }
    pR.dot(r, er, COL.cur, 6);
    const items = [{ nom: 'e(r)', col: COL.e, w: 2.5 }];
    if (state.comp) items.push({ nom: 'atracció', col: COL.at, dash: [5, 4] }, { nom: 'repulsió', col: COL.rep, dash: [5, 4] });
    if (state.parab) items.push({ nom: 'paràbola al mínim', col: COL.par, dash: [7, 4] });
    pR.legend(items);
  }
  pR.onDrag(x => { const M = cur(); setX(x / M.r0); });

  // ---------------------------------------------------------------
  // Gràfica 2: e(v), la definició de B
  // ---------------------------------------------------------------
  const cV = document.getElementById('canvasV');
  const pV = Plot(cV, { m: { l: 58, r: 14, t: 14, b: 40 } });
  function drawV() {
    const M = cur(), v0 = M.g * Math.pow(M.r0, 3), e0 = M.e0, B = Bof(M) / EVA3_GPA;
    const eV = v => M.e(Math.cbrt(v / M.g));
    Object.assign(pV, { xmin: 0.6 * v0, xmax: 1.9 * v0, ymin: 1.15 * e0, ymax: 0.25 * -e0 });
    pV.clear();
    pV.axes('v (Å³ ' + (state.model === 'ion' ? 'per ió' : 'per àtom') + ')', 'e(v) (eV)');
    if (state.parab) pV.fn(v => e0 + B / (2 * v0) * (v - v0) * (v - v0), { col: COL.par, w: 2, dash: [7, 4] }, 0.65 * v0, 1.45 * v0);
    pV.fn(eV, { col: COL.e, w: 2.5 });
    pV.vline(v0, { col: '#9aa8a0', w: 1, dash: [2, 3] });
    const r = state.x * M.r0, v = M.g * r * r * r, ev = M.e(r), sl = -pressure(M, r) / EVA3_GPA;
    pV.fn(x => ev + sl * (x - v), { col: COL.cur, w: 1.5 }, v - 0.25 * v0, v + 0.25 * v0);
    pV.dot(v, ev, COL.cur, 6);
    pV.text('pendent = −P', v, ev, { dx: 10, dy: -10, col: COL.cur, font: '11px sans-serif' });
    pV.legend([{ nom: 'e(v)', col: COL.e, w: 2.5 }, { nom: 'e₀ + B(v−v₀)²/2v₀', col: COL.par, dash: [7, 4] }, { nom: 'tangent: P = −de/dv', col: COL.cur, w: 1.5 }]);
  }
  pV.onDrag(v => { const M = cur(); setX(Math.cbrt(v / M.g) / M.r0); });

  // ---------------------------------------------------------------
  // Gràfica 3: rigidesa de tots els materials (escala logarítmica)
  // ---------------------------------------------------------------
  const cB = document.getElementById('canvasB'), gB = cB.getContext('2d');
  function allMaterials() {
    const out = [];
    ['lj', 'ion', 'cov'].forEach(mo => MAT[mo].forEach(m => {
      const P = mo === 'lj' ? { eps: m.eps, sig: m.sig } : mo === 'ion' ? { est: m.est, r0: m.r0, m: m.m, q: m.q } : { r0: m.r0, e0: m.e0, n: m.n, m: m.m };
      out.push({ mo, id: m.id, Bp: Bof(model(mo, P)), Bexp: m.Bexp });
    }));
    return out;
  }
  function drawB() {
    const W = cB.width, H = cB.height, L = allMaterials();
    gB.clearRect(0, 0, W, H);
    const ml = 92, mr = 34, mt = 8, mb = 30, lo = 0.5, hi = 1000;
    const X = b => ml + (Math.log10(b) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * (W - ml - mr);
    const rowH = (H - mt - mb) / L.length;
    // eix
    gB.font = '10px sans-serif'; gB.textAlign = 'center';
    [1, 10, 100, 1000].forEach(b => {
      gB.strokeStyle = '#edf1ee'; gB.beginPath(); gB.moveTo(X(b), mt); gB.lineTo(X(b), H - mb); gB.stroke();
      gB.fillStyle = '#555'; gB.fillText(b + ' GPa', X(b), H - mb + 13);
    });
    gB.fillText('mòdul de compressibilitat B (escala logarítmica)', (ml + W - mr) / 2, H - 4);
    const colMo = { lj: '#2980b9', ion: '#8e44ad', cov: '#00722b' };
    // el material actual, amb els paràmetres actuals dels controls
    const Bnow = Bof(cur());
    L.forEach((it, i) => {
      const y = mt + i * rowH + rowH / 2, isCur = it.mo === state.model && it.id === state.mat;
      if (isCur) { gB.fillStyle = 'rgba(0,150,57,0.08)'; gB.fillRect(0, y - rowH / 2, W, rowH); }
      gB.fillStyle = colMo[it.mo]; gB.textAlign = 'right'; gB.font = (isCur ? 'bold ' : '') + '11px sans-serif';
      gB.fillText(it.id, ml - 6, y + 4);
      const Bp = isCur ? Bnow : it.Bp;
      gB.globalAlpha = 0.75; gB.fillRect(X(lo), y - rowH * 0.28, X(Math.max(lo, Bp)) - X(lo), rowH * 0.56); gB.globalAlpha = 1;
      gB.strokeStyle = '#111'; gB.lineWidth = 2;
      gB.beginPath(); gB.moveTo(X(it.Bexp), y - rowH * 0.42); gB.lineTo(X(it.Bexp), y + rowH * 0.42); gB.stroke();
    });
  }

  // ---------------------------------------------------------------
  // Fórmules i lectures
  // ---------------------------------------------------------------
  const formEl = document.getElementById('formules'), lectEl = document.getElementById('lectura');
  function drawText() {
    const M = cur(), B = Bof(M), mt = matObj(), r = state.x * M.r0, P = pressure(M, r);
    const v0 = M.g * Math.pow(M.r0, 3), dv = Math.pow(state.x, 3) - 1;
    const rows = [];
    if (state.model === 'lj') {
      const p = state.lj;
      rows.push({ nom: 'Corba de cohesió (Lennard-Jones, FCC)', tex: [
        'e(r)=2\\epsilon\\left[A_{12}\\left(\\frac{\\sigma}{r}\\right)^{12}-A_6\\left(\\frac{\\sigma}{r}\\right)^{6}\\right],\\qquad A_{12}=12.132,\\ A_6=14.454',
        '\\epsilon=' + fmt(p.eps, 2) + '\\ \\text{meV},\\quad \\sigma=' + fmt(p.sig, 3) + '\\ \\text{Å}'],
        nota: 'Energia per àtom. ε i σ es mesuren al gas; aquí no s\'ajusta res al sòlid.' });
      rows.push({ nom: 'Mínim', tex: [
        'r_0=\\left(\\frac{2A_{12}}{A_6}\\right)^{1/6}\\sigma=1.090\\,\\sigma=' + fmt(M.r0, 3) + '\\ \\text{Å},\\qquad e_0=-\\frac{A_6^2}{2A_{12}}\\,\\epsilon=-8.61\\,\\epsilon=' + sig(M.e0 * 1000, 3) + '\\ \\text{meV}'] });
      rows.push({ nom: 'Mòdul de compressibilitat', actiu: true, tex: [
        "e''(r_0)=\\frac{36\\,\\epsilon A_6^2}{A_{12}r_0^2}=" + sig(M.e2, 3) + "\\ \\text{eV/Å}^2,\\qquad g=\\frac{1}{\\sqrt2}",
        "B=\\frac{e''(r_0)}{9g\\,r_0}=75\\,\\frac{\\epsilon}{\\sigma^3}=" + sig(B / EVA3_GPA, 3) + "\\ \\text{eV/Å}^3=" + sig(B, 3) + "\\ \\text{GPa}"] });
    } else if (state.model === 'ion') {
      const p = state.ion, E = EST[p.est];
      rows.push({ nom: 'Corba de cohesió (iònic, estructura ' + E.nom + ')', tex: [
        'e(r)=\\frac12\\left[-\\frac{kq^2M}{r}+\\frac{C}{r^m}\\right],\\qquad C=\\frac{kq^2M}{m}\\,r_0^{\\,m-1}',
        'q=' + p.q + 'e,\\quad M=' + E.M + ',\\quad m=' + fmt(p.m, 1) + ',\\quad r_0=' + fmt(p.r0, 3) + '\\ \\text{Å},\\quad ke^2=14.40\\ \\text{eV}\\cdot\\text{Å}'],
        nota: 'Energia per ió, la meitat de l\'energia per parell U(r). C s\'elimina imposant el mínim a la r₀ observada.' });
      rows.push({ nom: 'Energia de cohesió', tex: [
        'U(r_0)=2e_0=-\\frac{kq^2M}{r_0}\\left(1-\\frac1m\\right)=' + sig(2 * M.e0, 3) + '\\ \\text{eV per parell}'] });
      rows.push({ nom: 'Mòdul de compressibilitat', actiu: true, tex: [
        "e''(r_0)=\\frac{kq^2M\\,(m-1)}{2r_0^3}=" + sig(M.e2, 3) + "\\ \\text{eV/Å}^2,\\qquad g=" + (p.est === 'nacl' ? '1' : '\\frac{4}{3\\sqrt3}'),
        "B=\\frac{e''(r_0)}{9g\\,r_0}" + (p.est === 'nacl' ? "=\\frac{(m-1)\\,M\\,kq^2}{18\\,r_0^4}" : '') + "=" + sig(B / EVA3_GPA, 3) + "\\ \\text{eV/Å}^3=" + sig(B, 3) + "\\ \\text{GPa}"],
        nota: 'L\'energia depèn de m només a través de (1 − 1/m), però B és proporcional a (m − 1). Per això B serveix per mesurar m.' });
    } else {
      const p = state.cov;
      rows.push({ nom: 'Corba de cohesió (covalent, estructura diamant)', tex: [
        'e(r)=-\\frac{A}{r^n}+\\frac{C}{r^m},\\qquad \\frac{A}{r_0^n}=\\frac{m|e_0|}{m-n},\\quad C=\\frac nm\\,A\\,r_0^{\\,m-n}',
        'n=' + fmt(p.n, 1) + ',\\quad m=' + fmt(p.m, 1) + ',\\quad |e_0|=' + fmt(p.e0, 2) + '\\ \\text{eV},\\quad r_0=' + fmt(p.r0, 3) + '\\ \\text{Å}'],
        nota: 'Forma fenomenològica: els exponents no surten de primers principis. n = 4 i m = 5 són els valors típics dels apunts.' });
      rows.push({ nom: 'Mòdul de compressibilitat', actiu: true, tex: [
        "e''(r_0)=\\frac{n\\,m\\,|e_0|}{r_0^2}=" + sig(M.e2, 3) + "\\ \\text{eV/Å}^2,\\qquad g=\\frac{8}{3\\sqrt3}",
        "B=\\frac{e''(r_0)}{9g\\,r_0}=\\frac{n\\,m\\,|e_0|}{8\\sqrt3\\,r_0^3}=" + sig(B / EVA3_GPA, 3) + "\\ \\text{eV/Å}^3=" + sig(B, 3) + "\\ \\text{GPa}"] });
    }
    rows.push({ nom: 'Pressió al punt vermell', tex: [
      "P=-\\frac{de}{dv}=-\\frac{1}{3g\\,r^2}\\frac{de}{dr}=" + sig(P, 3) + "\\ \\text{GPa},\\qquad \\frac{\\Delta v}{v_0}=" + fmt(100 * dv, 1) + "\\,\\%"
        + (Math.abs(dv) > 1e-4 ? ",\\qquad -B\\,\\frac{\\Delta v}{v_0}=" + sig(-B * dv, 3) + "\\ \\text{GPa}" : '')],
      nota: 'Per a deformacions petites, P ≈ −B Δv/v₀: és la definició de B. Si et separes molt del mínim, la paràbola ja no descriu la corba i les dues xifres deixen de coincidir.' });
    Coh.formulas(formEl, rows);

    const fila_r0 = ['r₀ (Å)', fmt(M.r0, 3) + (mt && mt.r0exp ? '  (exp. ' + mt.r0exp + ')' : '')];
    const fila_E = ['E_coh', state.model === 'ion' ? sig(-2 * M.e0, 3) + ' eV/parell' + (mt ? '  (exp. ' + mt.Eexp + ')' : '')
      : state.model === 'lj' ? sig(-M.e0 * 1000, 3) + ' meV/àtom' + (mt ? '  (exp. ' + Math.round(mt.Eexp * 1000) + ')' : '')
      : sig(-M.e0, 3) + ' eV/àtom'];
    if (NOMES_CORBA) {
      const F = -deriv(M.e, r), dr = r - M.r0;
      Coh.readout(lectEl, [fila_r0, fila_E, ['e″(r₀)', sig(M.e2, 3) + ' eV/Å² ' + M.unit],
        ['r', fmt(r, 3) + ' Å  (' + (dr >= 0 ? '+' : '') + fmt(100 * (state.x - 1), 1) + ' %)'],
        ['F = −de/dr', (Math.abs(dr) < 1e-6 ? '0' : sig(F, 3)) + ' eV/Å'],
        ['−e″(r₀) Δr', (Math.abs(dr) < 1e-6 ? '0' : sig(-M.e2 * dr, 3)) + ' eV/Å']]);
      return;
    }
    Coh.readout(lectEl, [
      fila_r0,
      ['a (Å)', fmt(M.a, 3)],
      fila_E,
      ['B predit', sig(B, 3) + ' GPa'],
      ['B experimental', mt ? mt.Bexp + ' GPa' : '—'],
      ['r actual', fmt(r, 3) + ' Å  (' + fmt(100 * (state.x - 1), 1) + ' %)'],
      ['pressió P', sig(P, 3) + ' GPa']
    ]);
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const SLIDERS = {
    lj: [['eps', 'ε (meV)', 1, 30, 0.1], ['sig', 'σ (Å)', 2.0, 5.0, 0.01]],
    ion: [['r0', 'r₀ (Å)', 1.8, 4.0, 0.001], ['m', 'exponent de repulsió m', 4, 14, 0.5], ['q', 'càrrega dels ions q (e)', 1, 3, 1]],
    cov: [['r0', 'r₀ (Å)', 1.2, 3.0, 0.001], ['e0', '|e₀| (eV/àtom)', 1, 10, 0.01], ['n', 'exponent d\'atracció n', 1, 8, 0.5], ['m', 'exponent de repulsió m', 2, 12, 0.5]]
  };
  function buildControls() {
    const mo = state.model;
    $('selMat').innerHTML = MAT[mo].map(m => '<option value="' + m.id + '">' + m.id + '</option>').join('') + '<option value="" disabled>Personalitzat</option>';
    $('selMat').value = state.mat || '';
    $('blocEst').style.display = mo === 'ion' ? '' : 'none';
    $('sliders').innerHTML = SLIDERS[mo].map(([k, lab, lo, hi, st]) =>
      '<div class="control-group"><label class="control-label" for="s_' + k + '">' + lab + ' <span class="val" id="v_' + k + '"></span></label>' +
      '<input type="range" class="slider" id="s_' + k + '" min="' + lo + '" max="' + hi + '" step="' + st + '"></div>').join('');
    SLIDERS[mo].forEach(([k]) => $('s_' + k).addEventListener('input', ev => {
      state[mo][k] = +ev.target.value;
      if (mo === 'cov' && state.cov.m <= state.cov.n + 0.4) state.cov.m = state.cov.n + 0.5;
      state.mat = ''; $('selMat').value = '';
      render();
    }));
  }
  function syncControls() {
    const mo = state.model;
    SLIDERS[mo].forEach(([k]) => { $('s_' + k).value = state[mo][k]; $('v_' + k).textContent = fmt(state[mo][k], 3); });
    if (mo === 'ion') $('selEst').value = state.ion.est;
    $('slX').value = state.x; $('valX').textContent = fmt(100 * (state.x - 1), 1) + ' %';
  }
  function loadMat(id) {
    const m = MAT[state.model].find(x => x.id === id);
    if (!m) return;
    state.mat = id;
    if (state.model === 'lj') Object.assign(state.lj, { eps: m.eps, sig: m.sig });
    if (state.model === 'ion') Object.assign(state.ion, { est: m.est, r0: m.r0, m: m.m, q: m.q });
    if (state.model === 'cov') Object.assign(state.cov, { r0: m.r0, e0: m.e0, n: m.n, m: m.m });
  }
  const setModelBtn = Coh.optionGroup($('grupModel'), v => { state.model = v; buildControls(); loadMat(MAT[v][0].id); $('selMat').value = state.mat; state.x = 1; render(); });
  $('selMat').addEventListener('change', () => { loadMat($('selMat').value); state.x = 1; render(); });
  $('selEst').addEventListener('change', () => { state.ion.est = $('selEst').value; state.mat = ''; $('selMat').value = ''; render(); });
  function setX(x) { state.x = Math.max(0.8, Math.min(1.6, x)); render(); }
  $('slX').addEventListener('input', () => setX(+$('slX').value));
  $('btnEq').addEventListener('click', () => setX(1));
  $('chkParab').addEventListener('change', () => { state.parab = $('chkParab').checked; render(); });
  $('chkComp').addEventListener('change', () => { state.comp = $('chkComp').checked; render(); });

  function render() { syncControls(); drawR(); drawV(); drawB(); drawText(); }

  // URL: ?model=ion&mat=NaCl  o bé  ?model=cov&r0=1.6&e0=7&n=4&m=5&x=0.95
  Coh.linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams();
    p.set('model', state.model);
    if (state.mat) p.set('mat', state.mat);
    else Object.entries(state[state.model]).forEach(([k, v]) => p.set(k, v));
    if (state.x !== 1) p.set('x', fmt(state.x, 3));
    return p;
  });
  (function fromURL() {
    const p = Coh.params();
    if (MAT[p.get('model')]) state.model = p.get('model');
    setModelBtn(state.model);
    buildControls();
    loadMat(p.get('mat') || MAT[state.model][state.model === 'lj' ? 1 : 0].id);
    const P = state[state.model];
    let custom = false;
    Object.keys(P).forEach(k => { if (k !== 'est') Coh.num(p, k, x => { P[k] = x; custom = true; }); });
    if (state.model === 'ion' && EST[p.get('est')]) { state.ion.est = p.get('est'); custom = true; }
    if (custom) state.mat = '';
    $('selMat').value = state.mat;
    Coh.num(p, 'x', x => { state.x = x; }, 0.8, 1.6);
    render();
  })();
})();
