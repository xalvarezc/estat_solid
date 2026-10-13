// Simulador — La cadena diatòmica: branques acústica i òptica, buit de freqüències.
//
// Cel·la de longitud a amb dos àtoms (M₁ a na, M₂ a na + a/2), molles C (dins la cel·la)
// i D (entre cel·les). Amb x = q·a:
//   (M₁ω² − C − D)(M₂ω² − C − D) = C² + D² + 2CD cos x
// Es treballa amb els nombres tal com es donen (u, N/m, Å) i es converteix al final.

(function () {
  'use strict';
  const { fmt, sig, Plot } = Din;
  const TAU = Din.TAU;
  const U = 1.66054e-27;
  const COL = { ac: '#2980b9', opt: '#d62728', at1: '#1f7a3f', at2: '#d9822b' };

  const MAT = {
    gen: { nom: 'Genèric (M₂ = 2M₁, C = D)', M1: 1, M2: 2, C: 1, D: 1, a: 1, reduit: true, nota: 'Unitats reduïdes: masses en M₁, molles en C, longituds en a.' },
    ig: { nom: 'Masses iguals, molles alternes (D = C/2)', M1: 1, M2: 1, C: 1, D: 0.5, a: 1, reduit: true, nota: 'Una cadena de "molècules": l\'enllaç dins de la cel·la és més fort que entre cel·les.' },
    NaCl: { nom: 'NaCl al llarg de [100] (model)', M1: 22.99, M2: 35.45, C: 11.0, D: 11.0, a: 5.64, reduit: false, nota: 'Plans alterns de Na⁺ i Cl⁻ separats a/2 = 2.82 Å. C ajustada perquè ν_opt(0) = 4.9 THz, la freqüència d\'absorció infraroja del NaCl. El model ignora les forces de Coulomb de llarg abast.' }
  };
  const state = {
    mat: 'gen', M1: 1, M2: 2, C: 1, D: 1, a: 1, reduit: true,
    x: 0.4 * Math.PI, branca: 'ac', vista: 'L', exag: 1, playing: true,
    buit: 'masses', plegada: false, so: true
  };

  // ---------------------------------------------------------------
  // Física
  // ---------------------------------------------------------------
  const mf = () => state.reduit ? 1 : U;
  // ω² de les dues branques per a x = q a, amb paràmetres explícits
  function w2pair(x, M1, M2, C, D) {
    const S = C + D, P = C * C + D * D + 2 * C * D * Math.cos(x);
    const b = S * (M1 + M2), disc = Math.max(0, b * b - 4 * M1 * M2 * (S * S - P));
    return [(b - Math.sqrt(disc)) / (2 * M1 * M2), (b + Math.sqrt(disc)) / (2 * M1 * M2)];
  }
  const w2 = x => w2pair(x, state.M1 * mf(), state.M2 * mf(), state.C, state.D);
  const wb = (x, br) => Math.sqrt(Math.max(0, w2(x)[br === 'ac' ? 0 : 1]));
  const vs = () => state.a * 1e-10 * Math.sqrt(state.C * state.D / ((state.C + state.D) * (state.M1 + state.M2) * mf()));   // m/s (si reduït: a=1, unitats pròpies)
  const vsRed = () => state.a * Math.sqrt(state.C * state.D / ((state.C + state.D) * (state.M1 + state.M2)));
  // ω de la recta del so, ω = v_s q, en funció de x = q a (unitats de ω de la resta del simulador)
  const wso = x => Math.sqrt(state.C * state.D / ((state.C + state.D) * (state.M1 + state.M2) * mf())) * Math.abs(x);
  // vector propi (u₁, u₂) complex per a la branca br en x: desplaçaments reals de cada àtom
  function vec(x, br) {
    const M1 = state.M1 * mf(), M2 = state.M2 * mf(), C = state.C, D = state.D;
    const om2 = w2(x)[br === 'ac' ? 0 : 1];
    // matriu dinàmica (pesada amb masses): H11 = (C+D)/M1, H12 = −(C + D e^{−ix})/√(M1M2)
    const H11 = (C + D) / M1, H22 = (C + D) / M2;
    const h12r = -(C + D * Math.cos(x)) / Math.sqrt(M1 * M2), h12i = -(-D * Math.sin(x)) / Math.sqrt(M1 * M2);   // H12 = −(C + D e^{−ix})/√
    const m12 = Math.hypot(h12r, h12i);
    let e1r, e1i, e2r, e2i;
    if (m12 > 1e-9 * (H11 + H22)) {
      // (H11 − ω²) e1 + H12 e2 = 0  →  e2 = (ω² − H11) e1 / H12
      e1r = 1; e1i = 0;
      const nr = om2 - H11, d2 = m12 * m12;
      e2r = nr * h12r / d2; e2i = -nr * h12i / d2;      // nr / H12 = nr·conj(H12)/|H12|²
    } else if (Math.abs(om2 - H11) < Math.abs(om2 - H22)) { e1r = 1; e1i = 0; e2r = 0; e2i = 0; }
    else { e1r = 0; e1i = 0; e2r = 1; e2i = 0; }
    // desplaçaments u = e/√M
    const u1r = e1r / Math.sqrt(M1), u1i = e1i / Math.sqrt(M1), u2r = e2r / Math.sqrt(M2), u2i = e2i / Math.sqrt(M2);
    const nrm = Math.max(Math.hypot(u1r, u1i), Math.hypot(u2r, u2i)) || 1;
    return { u1: [u1r / nrm, u1i / nrm], u2: [u2r / nrm, u2i / nrm], om2 };
  }
  // fase relativa (graus) amb la convenció de posició: l'àtom 2 és a na + a/2
  function faseRel(x, br) {
    const v = vec(x, br);
    const ph = Math.atan2(v.u2[1], v.u2[0]) - Math.atan2(v.u1[1], v.u1[0]) - x / 2;
    let d = ((ph * 180 / Math.PI) % 360 + 540) % 360 - 180;
    return Math.abs(d);
  }
  // escales
  const wScale = () => state.reduit ? 1 : 1 / TAU / 1e12;     // rad/s → THz
  const wU = () => state.reduit ? '√(C/M₁)' : 'THz';
  const vU = () => state.reduit ? 'a√(C/M₁)' : 'km/s';
  const vDisp = () => state.reduit ? vsRed() : vs() / 1000;
  let wmax = 2;
  function calcWmax() { wmax = Math.sqrt(Math.max(w2(0)[1], w2(Math.PI)[1])) || 1; }
  // valors a la vora de zona i buit
  function vora() { const w = w2(Math.PI); return [Math.sqrt(Math.max(0, w[0])), Math.sqrt(Math.max(0, w[1]))]; }
  function buit() {
    let maxAc = 0, minOpt = Infinity;
    for (let x = 0; x <= Math.PI + 1e-9; x += Math.PI / 200) { const w = w2(x); maxAc = Math.max(maxAc, w[0]); minOpt = Math.min(minOpt, w[1]); }
    return [Math.sqrt(maxAc), Math.sqrt(Math.max(0, minOpt))];
  }

  // ---------------------------------------------------------------
  // La cadena
  // ---------------------------------------------------------------
  const cC = document.getElementById('canvasCadena'), gC = cC.getContext('2d');
  let t0 = performance.now(), tau = 0;
  const NCEL = 10;
  function molla(x1, y1, x2, y2, col, w0) {
    const n = 8, L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, amp = 5;
    gC.strokeStyle = col; gC.lineWidth = w0; gC.beginPath(); gC.moveTo(x1, y1);
    for (let i = 1; i < n; i++) { const t = i / n, s = (i % 2 ? 1 : -1) * amp; gC.lineTo(x1 + ux * L * t - uy * s, y1 + uy * L * t + ux * s); }
    gC.lineTo(x2, y2); gC.stroke();
  }
  function drawChain() {
    const W = cC.width, H = cC.height;
    gC.clearRect(0, 0, W, H);
    const sp = 68, x0 = (W - sp * NCEL + sp / 2) / 2, yAt = 105;
    const v = vec(state.x, state.branca), x = state.x;
    const om = Math.sqrt(Math.max(0, v.om2)) / (state.reduit ? 1 : Math.sqrt(state.C / (state.M1 * U)));   // en unitats de √(C/M₁) per a l'animació
    const A = 12 * state.exag, wt = om * tau;
    const re = (u, n) => u[0] * Math.cos(x * n - wt) - u[1] * Math.sin(x * n - wt);
    const r1 = 7, r2 = Math.min(13, Math.max(5, 7 * Math.cbrt(state.M2 / state.M1)));
    const wC = 1 + 1.6 * state.C / Math.max(state.C, state.D), wD = 1 + 1.6 * state.D / Math.max(state.C, state.D);
    // posicions d'equilibri
    gC.fillStyle = '#c9d2cc';
    for (let n = 0; n < NCEL; n++) { gC.beginPath(); gC.arc(x0 + n * sp, yAt, 2, 0, TAU); gC.fill(); gC.beginPath(); gC.arc(x0 + n * sp + sp / 2, yAt, 2, 0, TAU); gC.fill(); }
    // posicions
    const pos = [];
    for (let n = 0; n < NCEL; n++) {
      const u1 = A * re(v.u1, n), u2 = A * re(v.u2, n);
      pos.push(state.vista === 'L' ? [[x0 + n * sp + u1, yAt], [x0 + n * sp + sp / 2 + u2, yAt]] : [[x0 + n * sp, yAt - u1], [x0 + n * sp + sp / 2, yAt - u2]]);
    }
    // molles
    for (let n = 0; n < NCEL; n++) {
      molla(pos[n][0][0], pos[n][0][1], pos[n][1][0], pos[n][1][1], '#9aa8a0', wC);
      if (n < NCEL - 1) molla(pos[n][1][0], pos[n][1][1], pos[n + 1][0][0], pos[n + 1][0][1], '#9aa8a0', wD);
    }
    // centres de masses
    for (let n = 0; n < NCEL; n++) {
      const cx = (state.M1 * pos[n][0][0] + state.M2 * pos[n][1][0]) / (state.M1 + state.M2), cy = (state.M1 * pos[n][0][1] + state.M2 * pos[n][1][1]) / (state.M1 + state.M2);
      gC.fillStyle = '#8a8f8c'; gC.beginPath(); gC.moveTo(cx, cy + 22); gC.lineTo(cx - 5, cy + 30); gC.lineTo(cx + 5, cy + 30); gC.closePath(); gC.fill();
    }
    // àtoms
    for (let n = 0; n < NCEL; n++) {
      gC.fillStyle = COL.at1; gC.beginPath(); gC.arc(pos[n][0][0], pos[n][0][1], r1, 0, TAU); gC.fill();
      gC.fillStyle = COL.at2; gC.beginPath(); gC.arc(pos[n][1][0], pos[n][1][1], r2, 0, TAU); gC.fill();
    }
    // llegenda
    gC.font = '11px sans-serif'; gC.fillStyle = '#555'; gC.textAlign = 'left';
    gC.fillText((state.branca === 'ac' ? 'branca acústica' : 'branca òptica') + ' · q = ' + fmt(x / Math.PI, 2) + ' π/a · ' + (state.vista === 'L' ? 'longitudinal' : 'transversal'), 8, 14);
    gC.fillStyle = COL.at1; gC.beginPath(); gC.arc(14, H - 34, 5, 0, TAU); gC.fill();
    gC.fillStyle = '#555'; gC.fillText('àtom 1, M₁ = ' + fmt(state.M1, 2) + (state.reduit ? '' : ' u') + ' · molla C = ' + fmt(state.C, 2), 24, H - 30);
    gC.fillStyle = COL.at2; gC.beginPath(); gC.arc(14, H - 14, 6, 0, TAU); gC.fill();
    gC.fillStyle = '#555'; gC.fillText('àtom 2, M₂ = ' + fmt(state.M2, 2) + (state.reduit ? '' : ' u') + ' · molla D = ' + fmt(state.D, 2), 24, H - 10);
    // a
    gC.strokeStyle = '#999'; gC.beginPath(); gC.moveTo(x0, yAt + 40); gC.lineTo(x0 + sp, yAt + 40); gC.stroke();
    gC.textAlign = 'center'; gC.fillStyle = '#777'; gC.fillText('a', x0 + sp / 2, yAt + 52);
    const fr = faseRel(state.x, state.branca);
    gC.textAlign = 'right'; gC.fillStyle = '#555';
    gC.fillText('fase relativa dels dos àtoms: ' + fmt(fr, 0) + '°  (' + (fr < 30 ? 'en fase' : fr > 150 ? 'en oposició' : 'intermèdia') + ')', W - 8, 14);
  }
  function loop(now) {
    if (state.playing) tau += (now - t0) / 1000 * 2.2;
    t0 = now;
    drawChain();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------
  // Dispersió
  // ---------------------------------------------------------------
  const cD = document.getElementById('canvasDisp');
  function drawDisp() {
    const sc = wScale();
    const p = Plot(cD, { xmin: -2, xmax: 2, ymin: 0, ymax: 1.12 * wmax * sc, m: { l: 56, r: 12, t: 16, b: 40 } });
    p.clear();
    const g = p.g;
    g.fillStyle = 'rgba(0,150,57,0.08)'; g.fillRect(p.X(-1), p.m.t, p.X(1) - p.X(-1), cD.height - p.m.t - p.m.b);
    const [bAc, bOpt] = buit();
    if (bOpt > bAc) { g.fillStyle = 'rgba(120,120,120,0.18)'; g.fillRect(p.m.l, p.Y(bOpt * sc), cD.width - p.m.l - p.m.r, p.Y(bAc * sc) - p.Y(bOpt * sc)); }
    p.axes('q (π/a)', 'ω (' + wU() + ')', { xticks: [-2, -1, 0, 1, 2], xfmt: v => v === 0 ? '0' : (v === 1 ? 'π/a' : v === -1 ? '−π/a' : v + 'π/a') });
    if (state.so) p.fn(x => wso(x * Math.PI) * sc, { col: '#999', dash: [4, 3], w: 1.3 }, -1, 1);
    if (state.plegada) p.fn(x => 2 * Math.sqrt(state.C / (state.M1 * mf())) * Math.abs(Math.sin(x * Math.PI / 4)) * sc, { col: '#555', dash: [2, 3], w: 1.4 });
    p.fn(x => wb(x * Math.PI, 'ac') * sc, { col: COL.ac, w: 2.2 });
    p.fn(x => wb(x * Math.PI, 'opt') * sc, { col: COL.opt, w: 2.2 });
    p.vline(-1, { col: '#00722b', w: 1, dash: [3, 3], alpha: 0.6 }); p.vline(1, { col: '#00722b', w: 1, dash: [3, 3], alpha: 0.6 });
    p.dot(state.x / Math.PI, wb(state.x, state.branca) * sc, state.branca === 'ac' ? COL.ac : COL.opt, 5.5);
    const items = [{ nom: 'òptica', col: COL.opt, w: 2.2 }, { nom: 'acústica', col: COL.ac, w: 2.2 }];
    if (state.so) items.push({ nom: 'so', col: '#999', dash: [4, 3] });
    if (state.plegada) items.push({ nom: 'monoatòmica, pas a/2', col: '#555', dash: [2, 3] });
    p.legend(items, { left: true });
    if (bOpt > bAc) p.text('buit', 1.9, (bAc + bOpt) / 2 * sc, { align: 'right', col: '#555', dy: 4 });
  }

  // ---------------------------------------------------------------
  // Amplituds
  // ---------------------------------------------------------------
  const cA = document.getElementById('canvasAmpl');
  function drawAmpl() {
    const p = Plot(cA, { xmin: 0, xmax: 1, ymin: 0, ymax: 1.12, m: { l: 56, r: 12, t: 16, b: 40 } });
    p.clear();
    p.axes('q (π/a)', 'amplitud normalitzada', { xticks: [0, 0.25, 0.5, 0.75, 1], xfmt: v => v === 0 ? '0' : v === 1 ? 'π/a' : v + 'π/a', yticks: [0, 0.5, 1] });
    const norm = (x, br) => { const v = vec(x, br); const a1 = Math.hypot(v.u1[0], v.u1[1]), a2 = Math.hypot(v.u2[0], v.u2[1]), n = Math.hypot(a1, a2) || 1; return [a1 / n, a2 / n]; };
    const altra = state.branca === 'ac' ? 'opt' : 'ac';
    p.fn(x => norm(x * Math.PI, altra)[0], { col: COL.at1, dash: [4, 3], w: 1.4 }, 0, 0.999);
    p.fn(x => norm(x * Math.PI, altra)[1], { col: COL.at2, dash: [4, 3], w: 1.4 }, 0, 0.999);
    p.fn(x => norm(x * Math.PI, state.branca)[0], { col: COL.at1, w: 2.4 }, 0, 0.999);
    p.fn(x => norm(x * Math.PI, state.branca)[1], { col: COL.at2, w: 2.4 }, 0, 0.999);
    const xr = Math.abs(state.x - TAU * Math.round(state.x / TAU)), nn = norm(xr, state.branca);
    p.vline(xr / Math.PI, { col: '#555', w: 1, dash: [3, 3] });
    p.dot(xr / Math.PI, nn[0], COL.at1, 5); p.dot(xr / Math.PI, nn[1], COL.at2, 5);
    p.legend([{ nom: 'àtom 1 (M₁)', col: COL.at1, w: 2.4 }, { nom: 'àtom 2 (M₂)', col: COL.at2, w: 2.4 }, { nom: 'l\'altra branca', col: '#888', dash: [4, 3] }], { left: true });
    p.text((state.branca === 'ac' ? 'branca acústica' : 'branca òptica') + ' · fase relativa a q = 0: ' + fmt(faseRel(0.001, state.branca), 0) + '°', 0.99, 0.05, { align: 'right', col: '#555', font: '10px sans-serif' });
  }

  // ---------------------------------------------------------------
  // El buit
  // ---------------------------------------------------------------
  const cG = document.getElementById('canvasGap');
  function drawGap() {
    const sc = wScale(), M1 = state.M1 * mf(), M2 = state.M2 * mf(), C = state.C, D = state.D;
    const masses = state.buit === 'masses';
    // família d'un paràmetre: masses (C=D=C actual, M1 fix, r = M2/M1 ∈ [1,5]) o molles (M = M1, C fix, s = D/C ∈ [0,1])
    const edges = r => masses ? w2pair(Math.PI, M1, r * M1, C, C) : w2pair(Math.PI, M1, M1, C, r * C);
    const top = r => masses ? Math.sqrt(2 * C * (1 / M1 + 1 / (r * M1))) : Math.sqrt(2 * (C + r * C) / M1);
    const xmin = masses ? 1 : 0, xmax = masses ? 5 : 1;
    const ymax = 1.1 * Math.max(top(masses ? 1 : 1), top(masses ? 5 : 0)) * sc;
    const p = Plot(cG, { xmin, xmax, ymin: 0, ymax, m: { l: 56, r: 12, t: 16, b: 40 } });
    p.clear();
    // buit ombrejat
    p.clip(); const g = p.g; g.fillStyle = 'rgba(120,120,120,0.18)'; g.beginPath();
    const n = 120, pts1 = [], pts2 = [];
    for (let i = 0; i <= n; i++) { const r = xmin + (xmax - xmin) * i / n, e = edges(r); pts1.push([r, Math.sqrt(e[0]) * sc]); pts2.push([r, Math.sqrt(e[1]) * sc]); }
    pts1.forEach((q, i) => { if (i) g.lineTo(p.X(q[0]), p.Y(q[1])); else g.moveTo(p.X(q[0]), p.Y(q[1])); });
    pts2.slice().reverse().forEach(q => g.lineTo(p.X(q[0]), p.Y(q[1])));
    g.closePath(); g.fill(); p.unclip();
    p.axes(masses ? 'M₂ / M₁  (amb C = D)' : 'D / C  (amb M₁ = M₂)', 'ω (' + wU() + ')');
    p.pts(pts1, { col: COL.ac, w: 2.2 }); p.pts(pts2, { col: COL.opt, w: 2.2 });
    p.fn(r => top(r) * sc, { col: COL.opt, dash: [4, 3], w: 1.6 });
    // punt actual (només si la família passa per la configuració actual)
    const rAct = masses ? state.M2 / state.M1 : state.D / state.C;
    const enFam = masses ? Math.abs(state.C - state.D) < 1e-9 : Math.abs(state.M1 - state.M2) < 1e-9;
    if (enFam && rAct >= xmin && rAct <= xmax) { const e = edges(rAct); p.vline(rAct, { col: '#555', w: 1, dash: [3, 3] }); p.dot(rAct, Math.sqrt(e[0]) * sc, COL.ac, 5); p.dot(rAct, Math.sqrt(e[1]) * sc, COL.opt, 5); p.dot(rAct, top(rAct) * sc, COL.opt, 4); }
    p.legend([{ nom: 'òptica a q = 0', col: COL.opt, dash: [4, 3] }, { nom: 'òptica a la vora', col: COL.opt, w: 2.2 }, { nom: 'acústica a la vora', col: COL.ac, w: 2.2 }]);
    if (!enFam) p.text('(la configuració actual no és d\'aquesta família)', (xmin + xmax) / 2, ymax * 0.05, { align: 'center', col: '#888', font: '10px sans-serif' });
  }

  // ---------------------------------------------------------------
  // Fórmules i lectures
  // ---------------------------------------------------------------
  function drawText() {
    const sc = wScale(), x = state.x, M1 = state.M1, M2 = state.M2, C = state.C, D = state.D;
    const un = '\\ \\text{' + wU() + '}';
    const [vAc, vOpt] = vora(), [bAc, bOpt] = buit();
    const wopt0 = Math.sqrt((C + D) * (1 / (M1 * mf()) + 1 / (M2 * mf())));
    const igual = Math.abs(C - D) < 1e-9;
    Din.formulas(document.getElementById('formules'), [
      { nom: 'Equacions de moviment', tex: [
        'M_1\\ddot u_{n,1}=-C(u_{n,1}-u_{n,2})-D(u_{n,1}-u_{n-1,2})',
        'M_2\\ddot u_{n,2}=-C(u_{n,2}-u_{n,1})-D(u_{n,2}-u_{n+1,1})'] },
      { nom: 'Ona plana i determinant', tex: [
        'u_{n,\\kappa}=U_\\kappa e^{i(qna-\\omega t)}\\ \\Rightarrow\\ \\begin{pmatrix}M_1\\omega^2-C-D & -(C+De^{-iqa})\\\\ -(C+De^{iqa}) & M_2\\omega^2-C-D\\end{pmatrix}\\!\\begin{pmatrix}U_1\\\\U_2\\end{pmatrix}=0',
        '(M_1\\omega^2-C-D)(M_2\\omega^2-C-D)=C^2+D^2+2CD\\cos qa'] },
      { nom: igual ? 'Les dues branques (C = D)' : 'Les dues branques', actiu: true, tex: igual ? [
        '\\omega^2_{\\pm}=C\\Big(\\frac1{M_1}+\\frac1{M_2}\\Big)\\pm C\\sqrt{\\Big(\\frac1{M_1}+\\frac1{M_2}\\Big)^2-\\frac{4\\sin^2(qa/2)}{M_1M_2}}',
        '\\text{vora de zona: }\\ \\omega^2=\\frac{2C}{M_1}=' + fmt(Math.sqrt(2 * C / (M1 * mf())) * sc, 3) + '^2,\\quad \\omega^2=\\frac{2C}{M_2}=' + fmt(Math.sqrt(2 * C / (M2 * mf())) * sc, 3) + '^2' + un] : [
        '\\omega^2_{\\pm}=\\frac{(C+D)(M_1+M_2)\\pm\\sqrt{(C+D)^2(M_1+M_2)^2-4M_1M_2\\,[(C+D)^2-C^2-D^2-2CD\\cos qa]}}{2M_1M_2}',
        '\\text{vora de zona: }\\ (M_1\\omega^2-C-D)(M_2\\omega^2-C-D)=(C-D)^2\\ \\Rightarrow\\ \\omega=' + fmt(vAc * sc, 3) + ',\\ ' + fmt(vOpt * sc, 3) + un] },
      { nom: 'Límits a q → 0', tex: [
        '\\omega_{\\text{ac}}\\simeq v_s|q|,\\quad v_s=a\\sqrt{\\frac{CD}{(C+D)(M_1+M_2)}}=' + fmt(vDisp(), 3) + '\\ \\text{' + vU() + '}',
        '\\omega_{\\text{opt}}^2(0)=(C+D)\\Big(\\frac1{M_1}+\\frac1{M_2}\\Big)=(' + fmt(wopt0 * sc, 3) + ')^2' + un],
        nota: 'A l\'acústica, U₂/U₁ → 1 (tota la cel·la es mou junta); a l\'òptica, U₂/U₁ → −M₁/M₂ (centre de masses quiet).' },
      { nom: 'El buit', tex: [
        '\\omega_{\\text{ac}}^{\\max}=' + fmt(bAc * sc, 3) + ',\\qquad \\omega_{\\text{opt}}^{\\min}=' + fmt(bOpt * sc, 3) + ',\\qquad \\text{buit}=' + fmt((bOpt - bAc) * sc, 3) + un] }
    ]);
    const v = vec(x, state.branca), a1 = Math.hypot(v.u1[0], v.u1[1]), a2 = Math.hypot(v.u2[0], v.u2[1]), fr = faseRel(x, state.branca);
    const m = MAT[state.mat];
    const lect = [['cadena', m ? m.nom : 'personalitzada']];
    lect.push(['M₁, M₂', fmt(M1, 2) + ', ' + fmt(M2, 2) + (state.reduit ? '' : ' u')]);
    lect.push(['C, D', fmt(C, 2) + ', ' + fmt(D, 2) + (state.reduit ? '' : ' N/m')]);
    lect.push(['q', fmt(x / Math.PI, 3) + ' π/a']);
    lect.push(['branca', state.branca === 'ac' ? 'acústica' : 'òptica']);
    lect.push([state.reduit ? 'ω' : 'ν', fmt(wb(x, state.branca) * sc, 3) + ' ' + wU()]);
    lect.push(['|u₂| / |u₁|', a1 > 1e-6 ? fmt(a2 / a1, 3) : '∞']);
    lect.push(['fase relativa', fmt(fr, 0) + '°']);
    lect.push([state.reduit ? 'ω_opt(0)' : 'ν_opt(0)', fmt(wopt0 * sc, 3) + ' ' + wU()]);
    lect.push(['vora: ac, opt', fmt(vAc * sc, 3) + ', ' + fmt(vOpt * sc, 3) + ' ' + wU()]);
    lect.push(['buit', fmt((bOpt - bAc) * sc, 3) + ' ' + wU()]);
    lect.push(['v_s', fmt(vDisp(), 3) + ' ' + vU()]);
    Din.readout(document.getElementById('lectura'), lect);
    const est = document.getElementById('estat');
    const xr = Math.abs(x - TAU * Math.round(x / TAU));
    if (bOpt - bAc < 1e-6 * bOpt) { est.className = 'estat si'; est.textContent = 'Sense buit: els dos àtoms de la cel·la són indistingibles i la cel·la "veritable" és la meitat.'; }
    else if (Math.abs(xr - Math.PI) < 0.02) { est.className = 'estat si'; est.textContent = 'Vora de zona: ' + (a1 < 1e-3 ? 'l\'àtom 1 es queda quiet; només vibra la subxarxa 2.' : a2 < 1e-3 ? 'l\'àtom 2 es queda quiet; només vibra la subxarxa 1.' : 'les dues subxarxes gairebé es desacoblen.'); }
    else if (state.branca === 'opt' && xr < 0.2) { est.className = 'estat no'; est.textContent = 'Mode òptic de longitud d\'ona llarga: els dos àtoms en oposició de fase, centre de masses quiet. Si tenen càrrega oposada, és un dipol oscil·lant: absorció infraroja.'; }
    else if (state.branca === 'ac' && xr < 0.2) { est.className = 'estat si'; est.textContent = 'Mode acústic de longitud d\'ona llarga: la cel·la sencera es mou en bloc. És el so.'; }
    else { est.className = 'estat si'; est.textContent = 'Buit de freqüències de ' + fmt((bOpt - bAc) * sc, 3) + ' ' + wU() + ' entre les dues branques.'; }
    document.getElementById('notaMat').textContent = m ? m.nota : '';
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const SL = [['M1', 'M₁', 0.2, 150, 0.01], ['M2', 'M₂', 0.2, 150, 0.01], ['C', 'C', 0.1, 100, 0.01], ['D', 'D', 0.1, 100, 0.01], ['a', 'a (Å)', 0.5, 8, 0.01]];
  $('sliders').innerHTML = SL.map(([k, lab, lo, hi, st]) =>
    '<div class="control-group"><label class="control-label" for="s_' + k + '">' + lab + ' <span class="val" id="v_' + k + '"></span></label>' +
    '<input type="range" class="slider" id="s_' + k + '" min="' + lo + '" max="' + hi + '" step="' + st + '"></div>').join('');
  SL.forEach(([k]) => $('s_' + k).addEventListener('input', ev => { state[k] = +ev.target.value; state.mat = ''; $('selMat').value = ''; render(); }));
  $('selMat').innerHTML = Object.entries(MAT).map(([k, m]) => '<option value="' + k + '">' + m.nom + '</option>').join('') + '<option value="" disabled>Personalitzada</option>';
  function loadMat(k) { const m = MAT[k]; if (!m) return; state.mat = k; Object.assign(state, { M1: m.M1, M2: m.M2, C: m.C, D: m.D, a: m.a, reduit: m.reduit }); }
  $('selMat').addEventListener('change', () => { loadMat($('selMat').value); render(); });
  $('slQ').addEventListener('input', () => { state.x = +$('slQ').value * Math.PI; render(); });
  document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { state.x = +b.dataset.q * Math.PI; render(); }));
  const setBranca = Din.optionGroup($('grupBranca'), v => { state.branca = v; render(); });
  const setVista = Din.optionGroup($('grupVista'), v => { state.vista = v; render(); });
  const setBuit = Din.optionGroup($('grupBuit'), v => { state.buit = v; render(); });
  $('slExag').addEventListener('input', () => { state.exag = +$('slExag').value; render(); });
  $('btnPlay').addEventListener('click', () => { state.playing = !state.playing; $('btnPlay').textContent = state.playing ? '❚❚ Atura l\'animació' : '▶ Engega l\'animació'; });
  $('chkPlegada').addEventListener('change', () => { state.plegada = $('chkPlegada').checked; render(); });
  $('chkSo').addEventListener('change', () => { state.so = $('chkSo').checked; render(); });

  function render() {
    SL.forEach(([k]) => { $('s_' + k).value = state[k]; $('v_' + k).textContent = fmt(state[k], 2) + (state.reduit ? '' : (k === 'a' ? '' : k[0] === 'M' ? ' u' : ' N/m')); });
    $('s_a').disabled = state.reduit;
    $('slQ').value = state.x / Math.PI; $('valQ').textContent = fmt(state.x / Math.PI, 2) + ' π/a';
    $('slExag').value = state.exag; $('valExag').textContent = '×' + fmt(state.exag, 2);
    $('chkPlegada').checked = state.plegada; $('chkSo').checked = state.so;
    setBranca(state.branca); setVista(state.vista); setBuit(state.buit);
    calcWmax();
    drawDisp(); drawAmpl(); drawGap(); drawText(); drawChain();
  }
  Din.linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams();
    if (state.mat) p.set('mat', state.mat); else ['M1', 'M2', 'C', 'D', 'a'].forEach(k => p.set(k, state[k]));
    p.set('q', +(state.x / Math.PI).toFixed(3)); p.set('branca', state.branca); p.set('vista', state.vista); p.set('buit', state.buit);
    if (state.plegada) p.set('plegada', 1); if (!state.so) p.set('so', 0);
    if (state.exag !== 1) p.set('exag', state.exag);
    return p;
  });
  (function fromURL() {
    const p = Din.params();
    loadMat(MAT[p.get('mat')] ? p.get('mat') : 'gen');
    let custom = false;
    ['M1', 'M2', 'C', 'D', 'a'].forEach(k => Din.num(p, k, x => { state[k] = x; custom = true; }, 0.001));
    if (custom) { state.mat = ''; state.reduit = p.get('unitats') !== 'si'; }   // ?unitats=si: M en u, C en N/m, a en Å
    $('selMat').value = state.mat;
    Din.num(p, 'q', x => { state.x = x * Math.PI; }, -2, 2);
    if (p.get('branca') === 'ac' || p.get('branca') === 'opt') state.branca = p.get('branca');
    if (p.get('vista') === 'L' || p.get('vista') === 'T') state.vista = p.get('vista');
    if (p.get('buit') === 'masses' || p.get('buit') === 'molles') state.buit = p.get('buit');
    if (p.get('plegada') === '1') state.plegada = true;
    if (p.get('so') === '0') state.so = false;
    Din.num(p, 'exag', x => { state.exag = x; }, 0.2, 2);
    if (p.get('atura') === '1') state.playing = false;
    render();
    requestAnimationFrame(loop);
  })();
})();
