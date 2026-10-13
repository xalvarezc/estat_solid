// Simulador — La cadena monoatòmica: modes normals, relació de dispersió,
// zona de Brillouin, velocitat de fase i de grup, constants de força.
//
// Tot es calcula en unitats reduïdes: x = q·d (radians), ω̃ = ω/√(C₁/M).
//   ω̃²(x) = Σ_p 2 c_p (1 − cos p x),   c_p = C_p / C₁   (c₁ = 1)
// Si hi ha un material, ω = ω̃·√(C₁/M) i v = ṽ·d·√(C₁/M) es mostren en THz i km/s.

(function () {
  'use strict';
  const { fmt, sig, Plot } = Din;
  const TAU = Din.TAU;
  const U = 1.66054e-27;          // kg

  // d: distància entre plans (Å); C: molla efectiva entre plans veïns, per àtom (N/m)
  // Les C surten de C = M v_s²/d² amb v_s = √(C11/ρ) (ones L) o √(C44/ρ) (ones T), Tema 3.
  const MAT = {
    CuL: { nom: 'Coure, ones L al llarg de [100]', M: 63.546, d: 1.8075, C: 60.7, vista: 'L' },
    CuT: { nom: 'Coure, ones T al llarg de [100]', M: 63.546, d: 1.8075, C: 27.2, vista: 'T' },
    AlL: { nom: 'Alumini, ones L al llarg de [100]', M: 26.982, d: 2.025, C: 43.4, vista: 'L' },
    red: { nom: 'Unitats reduïdes (M = C = d = 1)', M: 1, d: 1, C: 1, reduit: true, vista: 'L' }
  };
  const state = {
    mat: 'CuL', M: 63.546, d: 1.8075, C: 60.7, reduit: false,
    x: 0.3 * Math.PI, vista: 'L', exag: 1, playing: true,
    c2: 0, c3: 0, finita: false, N: 12, alias: true, so: true
  };

  // ---------------------------------------------------------------
  // Física (unitats reduïdes)
  // ---------------------------------------------------------------
  const cps = () => [1, state.c2, state.c3];
  const w2 = x => cps().reduce((s, c, i) => s + 2 * c * (1 - Math.cos((i + 1) * x)), 0);
  const w = x => Math.sqrt(Math.max(0, w2(x)));
  const dw2 = x => cps().reduce((s, c, i) => s + 2 * c * (i + 1) * Math.sin((i + 1) * x), 0);
  const vs = () => Math.sqrt(Math.max(0, cps().reduce((s, c, i) => s + c * (i + 1) * (i + 1), 0)));
  const vg = x => { const ww = w(x); return ww > 1e-6 ? dw2(x) / (2 * ww) : vs() * (x >= 0 ? 1 : -1); };
  const vf = x => Math.abs(x) > 1e-6 ? w(x) / x : vs();
  const reduceX = x => x - TAU * Math.round(x / TAU);          // a (−π, π]
  const estable = () => { for (let x = 0; x <= Math.PI; x += 0.01) if (w2(x) < -1e-9) return false; return true; };
  let wmax = 2;
  function calcWmax() { wmax = 0; for (let x = 0; x <= Math.PI; x += 0.005) wmax = Math.max(wmax, w(x)); if (wmax < 1e-6) wmax = 1; }

  // escales físiques
  const omega0 = () => state.reduit ? 1 : Math.sqrt(state.C / (state.M * U));           // rad/s
  const wScale = () => state.reduit ? 1 : omega0() / TAU / 1e12;                       // → THz
  const vScale = () => state.reduit ? 1 : state.d * 1e-10 * omega0() / 1000;           // → km/s
  const wU = () => state.reduit ? '√(C/M)' : 'THz';
  const vU = () => state.reduit ? 'd√(C/M)' : 'km/s';

  // integral de Fourier: c_p = −(1/2π) ∫_{−π}^{π} ω̃²(x) cos(p x) dx  (Simpson)
  function cpFourier(p) {
    const n = 400, h = TAU / n;
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const x = -Math.PI + i * h, f = w2(x) * Math.cos(p * x);
      s += f * (i === 0 || i === n ? 1 : (i % 2 ? 4 : 2));
    }
    return -(s * h / 3) / TAU;
  }

  // ---------------------------------------------------------------
  // La cadena
  // ---------------------------------------------------------------
  const cC = document.getElementById('canvasCadena'), gC = cC.getContext('2d');
  let t0 = performance.now(), tau = 0;
  const NAT = 21;
  function molla(x1, y1, x2, y2, col, w0) {
    const n = 8, L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, amp = 5;
    gC.strokeStyle = col; gC.lineWidth = w0 || 1.2; gC.beginPath(); gC.moveTo(x1, y1);
    for (let i = 1; i < n; i++) {
      const t = i / n, px = x1 + ux * L * t, py = y1 + uy * L * t, s = (i % 2 ? 1 : -1) * amp;
      gC.lineTo(px - uy * s, py + ux * s);
    }
    gC.lineTo(x2, y2); gC.stroke();
  }
  function drawChain() {
    const W = cC.width, H = cC.height;
    gC.clearRect(0, 0, W, H);
    const sp = 34, x0 = (W - sp * (NAT - 1)) / 2, yAt = state.vista === 'L' ? 78 : 95, yOna = state.vista === 'L' ? 190 : 95;
    const A = 11 * state.exag, x = state.x, wt = w(x) * tau;
    const u = n => A * Math.cos(x * n - wt);
    const xAlias = x - TAU * Math.sign(x || 1);
    // posicions d'equilibri
    gC.fillStyle = '#c9d2cc';
    for (let n = 0; n < NAT; n++) { gC.beginPath(); gC.arc(x0 + n * sp, yAt, 2, 0, TAU); gC.fill(); }
    // ona contínua i ona equivalent
    const ona = (xx, col, dash) => {
      gC.strokeStyle = col; gC.lineWidth = 1.6; gC.setLineDash(dash || []); gC.beginPath();
      for (let px = x0 - sp; px <= x0 + sp * NAT; px += 1.5) {
        const n = (px - x0) / sp, y = yOna - A * Math.cos(xx * n - wt);
        if (px === x0 - sp) gC.moveTo(px, y); else gC.lineTo(px, y);
      }
      gC.stroke(); gC.setLineDash([]);
    };
    if (state.vista === 'L') { gC.strokeStyle = '#e5e9e6'; gC.beginPath(); gC.moveTo(x0 - sp, yOna); gC.lineTo(x0 + sp * NAT, yOna); gC.stroke(); }
    if (state.alias) ona(xAlias, '#d62728', [6, 4]);
    ona(x, '#00722b');
    // molles i àtoms
    const pos = [];
    for (let n = 0; n < NAT; n++) pos.push(state.vista === 'L' ? [x0 + n * sp + u(n), yAt] : [x0 + n * sp, yAt - u(n)]);
    for (let n = 0; n < NAT - 1; n++) {
      const L = Math.hypot(pos[n + 1][0] - pos[n][0], pos[n + 1][1] - pos[n][1]), e = (L - sp) / sp;
      const col = e > 0.02 ? 'rgba(214,39,40,' + Math.min(1, 0.35 + 6 * e) + ')' : e < -0.02 ? 'rgba(41,128,185,' + Math.min(1, 0.35 - 6 * e) + ')' : '#9aa8a0';
      molla(pos[n][0], pos[n][1], pos[n + 1][0], pos[n + 1][1], col);
    }
    for (let n = 0; n < NAT; n++) {
      gC.fillStyle = '#1f7a3f'; gC.beginPath(); gC.arc(pos[n][0], pos[n][1], 7, 0, TAU); gC.fill();
      gC.strokeStyle = '#0d4d26'; gC.lineWidth = 1; gC.stroke();
    }
    // punts mostrejats sobre l'ona (vista L: la corba de sota)
    if (state.vista === 'L') {
      gC.fillStyle = '#00722b';
      for (let n = 0; n < NAT; n++) { gC.beginPath(); gC.arc(x0 + n * sp, yOna - u(n), 3, 0, TAU); gC.fill(); }
      gC.fillStyle = '#555'; gC.font = '11px sans-serif'; gC.textAlign = 'left';
      gC.fillText('desplaçament uₙ de cada àtom, dibuixat verticalment', x0, yOna + A + 18);
    }
    // longitud d'ona
    const xr = Math.abs(x), lam = xr > 1e-6 ? TAU / xr * sp : 0;
    if (lam > 0 && lam < sp * (NAT - 1)) {
      const yl = state.vista === 'L' ? 24 : 24, xa = x0 + 2 * sp;
      gC.strokeStyle = '#555'; gC.lineWidth = 1; gC.beginPath(); gC.moveTo(xa, yl); gC.lineTo(xa + lam, yl); gC.stroke();
      gC.beginPath(); gC.moveTo(xa, yl - 4); gC.lineTo(xa, yl + 4); gC.moveTo(xa + lam, yl - 4); gC.lineTo(xa + lam, yl + 4); gC.stroke();
      gC.fillStyle = '#555'; gC.font = '11px sans-serif'; gC.textAlign = 'center';
      gC.fillText('λ = 2π/q = ' + fmt(TAU / xr, 2) + ' d', xa + lam / 2, yl - 7);
    }
    gC.fillStyle = '#555'; gC.font = '11px sans-serif'; gC.textAlign = 'right';
    gC.fillText((state.vista === 'L' ? 'ona longitudinal' : 'ona transversal') + ' · q = ' + fmt(x / Math.PI, 2) + ' π/d', W - 8, 14);
    // d
    gC.textAlign = 'center'; gC.fillStyle = '#777';
    const yd = state.vista === 'L' ? yAt + 22 : yAt + 18 + A;
    gC.beginPath(); gC.moveTo(x0, yd); gC.lineTo(x0 + sp, yd); gC.strokeStyle = '#999'; gC.stroke();
    gC.fillText('d', x0 + sp / 2, yd + 12);
  }
  function loop(now) {
    if (state.playing) tau += (now - t0) / 1000 * 2.2;
    t0 = now;
    drawChain();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------
  // Relació de dispersió
  // ---------------------------------------------------------------
  const cD = document.getElementById('canvasDisp');
  function drawDisp() {
    const sc = wScale();
    const p = Plot(cD, { xmin: -3, xmax: 3, ymin: 0, ymax: 1.12 * wmax * sc, m: { l: 56, r: 12, t: 16, b: 40 } });
    p.clear();
    // primera zona
    const g = p.g;
    g.fillStyle = 'rgba(0,150,57,0.08)'; g.fillRect(p.X(-1), p.m.t, p.X(1) - p.X(-1), cD.height - p.m.t - p.m.b);
    p.axes('q (π/d)', 'ω (' + wU() + ')', { xticks: [-3, -2, -1, 0, 1, 2, 3], xfmt: v => v === 0 ? '0' : (v === 1 ? 'π/d' : v === -1 ? '−π/d' : v + 'π/d') });
    if (state.so) p.fn(x => vs() * Math.abs(x * Math.PI) * sc, { col: '#999', dash: [4, 3], w: 1.3 }, -1, 1);
    p.fn(x => w(x * Math.PI) * sc, { col: '#00722b', w: 2.2 });
    p.vline(-1, { col: '#00722b', w: 1, dash: [3, 3], alpha: 0.6 }); p.vline(1, { col: '#00722b', w: 1, dash: [3, 3], alpha: 0.6 });
    if (state.finita) {
      const N = state.N, pts = [];
      for (let m = -Math.floor((N - 1) / 2); m <= Math.floor(N / 2); m++) { const xx = TAU * m / N; pts.push([xx / Math.PI, w(xx) * sc]); }
      p.dots(pts, '#1F6FEB', 3.5);
    }
    const x = state.x;
    if (state.alias) { const xa = x - TAU * Math.sign(x || 1); p.clip(); g.strokeStyle = '#d62728'; g.lineWidth = 2; g.beginPath(); g.arc(p.X(xa / Math.PI), p.Y(w(xa) * sc), 5.5, 0, TAU); g.stroke(); p.unclip(); }
    p.dot(x / Math.PI, w(x) * sc, '#d62728', 5.5);
    const items = [{ nom: 'ω(q)', col: '#00722b', w: 2.2 }];
    if (state.so) items.push({ nom: 'so, ω = vₛ|q|', col: '#999', dash: [4, 3] });
    if (state.finita) items.push({ nom: 'N = ' + state.N + ' modes permesos', col: '#1F6FEB', w: 3 });
    p.legend(items, { left: true });
    p.text('1a zona de Brillouin', 0, 1.05 * wmax * sc, { align: 'center', col: '#1f7a3f', font: '10px sans-serif' });
  }

  // ---------------------------------------------------------------
  // Velocitats
  // ---------------------------------------------------------------
  const cV = document.getElementById('canvasVel');
  function drawVel() {
    const sc = vScale();
    let ymin = 0, ymax = 0;
    for (let x = 0.001; x <= Math.PI; x += 0.01) { ymin = Math.min(ymin, vg(x), vf(x)); ymax = Math.max(ymax, vg(x), vf(x)); }
    ymax = Math.max(ymax, vs()) * 1.15 * sc; ymin = ymin * 1.15 * sc;
    const p = Plot(cV, { xmin: 0, xmax: 1, ymin: ymin, ymax: ymax, m: { l: 56, r: 12, t: 16, b: 40 } });
    p.clear();
    p.axes('q (π/d)', 'velocitat (' + vU() + ')', { xticks: [0, 0.25, 0.5, 0.75, 1], xfmt: v => v === 0 ? '0' : v === 1 ? 'π/d' : v + 'π/d' });
    p.hline(vs() * sc, { col: '#999', dash: [4, 3], w: 1.2 });
    p.fn(x => vf(x * Math.PI) * sc, { col: '#2980b9', w: 2.2 }, 0.002, 1);
    p.fn(x => vg(x * Math.PI) * sc, { col: '#d62728', w: 2.2 }, 0.002, 1);
    const xr = Math.abs(reduceX(state.x));
    p.vline(xr / Math.PI, { col: '#555', w: 1, dash: [3, 3] });
    p.dot(xr / Math.PI, vf(xr) * sc, '#2980b9', 5); p.dot(xr / Math.PI, vg(xr) * sc, '#d62728', 5);
    p.legend([{ nom: 'de fase, ω/q', col: '#2980b9' }, { nom: 'de grup, dω/dq', col: '#d62728' }, { nom: 'del so, d√(C/M)', col: '#999', dash: [4, 3] }]);
  }

  // ---------------------------------------------------------------
  // Fórmules, taula i lectures
  // ---------------------------------------------------------------
  function drawText() {
    const sc = wScale(), vsc = vScale(), x = state.x, xr = reduceX(x);
    const nomes1 = Math.abs(state.c2) < 1e-9 && Math.abs(state.c3) < 1e-9;
    const wn = v => fmt(v * sc, 3) + '\\ \\text{' + wU() + '}';
    const vn = v => fmt(v * vsc, 3) + '\\ \\text{' + vU() + '}';
    const rows = [
      { nom: 'Equació de moviment i ona plana', tex: [
        'M\\ddot u_n=C\\,(u_{n+1}+u_{n-1}-2u_n),\\qquad u_n=A\\,e^{i(qnd-\\omega t)}'] },
      { nom: 'Relació de dispersió (primers veïns)', actiu: nomes1, tex: [
        '\\omega^2(q)=\\frac{2C}{M}(1-\\cos qd)=\\frac{4C}{M}\\sin^2\\frac{qd}{2},\\qquad \\omega_{\\max}=2\\sqrt{\\frac CM}=' + wn(2),
        'v_s=d\\sqrt{\\frac CM}=' + vn(1) + ',\\qquad v_g=\\frac{d\\omega}{dq}=v_s\\cos\\frac{qd}{2}'],
        nota: 'La corba té període 2π/d: q i q + 2π/d donen els mateixos desplaçaments uₙ, perquè e^{i(q+2π/d)nd} = e^{iqnd}.' },
      { nom: 'Amb molles fins als tercers veïns', actiu: !nomes1, tex: [
        '\\omega^2(q)=\\frac{2}{M}\\sum_{p=1}^{3}C_p\\,(1-\\cos pqd),\\qquad v_s=d\\sqrt{\\frac{1}{M}\\sum_p p^2C_p}=' + vn(vs()),
        'C_p=-\\frac{Md}{2\\pi}\\int_{-\\pi/d}^{\\pi/d}\\omega^2(q)\\cos(pqd)\\,dq'] },
      { nom: 'En aquest punt', actiu: true, tex: [
        'q=' + fmt(x / Math.PI, 3) + '\\,\\pi/d' + (Math.abs(xr - x) > 1e-9 ? '\\ \\equiv\\ ' + fmt(xr / Math.PI, 3) + '\\,\\pi/d\\ \\text{(1a zona)}' : '') +
        ',\\qquad \\omega=' + wn(w(x)) + ',\\qquad v_\\varphi=' + vn(Math.abs(vf(xr))) + ',\\qquad v_g=' + vn(vg(xr))] }
    ];
    if (state.finita) rows.push({ nom: 'Cadena finita amb condicions periòdiques (Born–von Kármán)', tex: [
      'u_{n+N}=u_n\\ \\Rightarrow\\ e^{iqNd}=1\\ \\Rightarrow\\ q_m=\\frac{2\\pi}{Nd}\\,m,\\qquad m=-\\tfrac N2+1,\\dots,\\tfrac N2\\quad(N=' + state.N + '\\ \\text{modes})'] });
    Din.formulas(document.getElementById('formules'), rows);

    const cpsImp = cps();
    document.getElementById('cpBody').innerHTML = [1, 2, 3, 4].map(p =>
      '<tr><td class="esq">' + p + '</td><td>' + fmt(p <= 3 ? cpsImp[p - 1] : 0, 3) + '</td><td>' + fmt(cpFourier(p), 3) + '</td></tr>').join('');

    const m = MAT[state.mat];
    const lect = [['material', m ? m.nom : 'personalitzat']];
    if (!state.reduit) lect.push(['M, d, C', fmt(state.M, 2) + ' u, ' + fmt(state.d, 3) + ' Å, ' + fmt(state.C, 1) + ' N/m']);
    lect.push(['q', fmt(x / Math.PI, 3) + ' π/d' + (state.reduit ? '' : ' = ' + fmt(x / state.d, 3) + ' Å⁻¹')]);
    lect.push(['q a la 1a zona', fmt(xr / Math.PI, 3) + ' π/d']);
    lect.push(['λ = 2π/q', Math.abs(x) > 1e-6 ? fmt(TAU / Math.abs(x), 2) + ' d' : '∞']);
    lect.push([state.reduit ? 'ω' : 'ν = ω/2π', fmt(w(x) * sc, 3) + ' ' + wU()]);
    lect.push([state.reduit ? 'ω_max' : 'ν_max', fmt(wmax * sc, 3) + ' ' + wU()]);
    lect.push(['v_φ', fmt(Math.abs(vf(xr)) * vsc, 3) + ' ' + vU()]);
    lect.push(['v_g', fmt(vg(xr) * vsc, 3) + ' ' + vU()]);
    lect.push(['v_s', fmt(vs() * vsc, 3) + ' ' + vU()]);
    if (state.finita) lect.push(['modes a la zona', String(state.N)]);
    Din.readout(document.getElementById('lectura'), lect);

    const est = document.getElementById('estat');
    if (!estable()) { est.className = 'estat no'; est.textContent = 'Cadena inestable: amb aquestes constants ω² és negatiu en algun q (la xarxa es deformaria sola).'; }
    else if (Math.abs(Math.abs(xr) - Math.PI) < 0.02) { est.className = 'estat si'; est.textContent = 'Vora de zona: els veïns vibren en oposició de fase, v_g = 0, ona estacionària.'; }
    else if (Math.abs(xr - x) > 1e-9) { est.className = 'estat no'; est.textContent = 'q és fora de la primera zona: els àtoms es mouen exactament igual que amb q = ' + fmt(xr / Math.PI, 2) + ' π/d.'; }
    else if (Math.abs(xr) < 0.25) { est.className = 'estat si'; est.textContent = 'Règim acústic: ω ≈ v_s q, el punt és sobre la recta del so.'; }
    else { est.className = 'estat si'; est.textContent = 'Dins de la primera zona: ω creix més a poc a poc que v_s q (dispersió).'; }
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const SL = [['M', 'M (u)', 1, 250, 0.1], ['d', 'd (Å)', 0.5, 6, 0.005], ['C', 'C (N/m)', 1, 500, 0.1]];
  $('sliders').innerHTML = SL.map(([k, lab, lo, hi, st]) =>
    '<div class="control-group"><label class="control-label" for="s_' + k + '">' + lab + ' <span class="val" id="v_' + k + '"></span></label>' +
    '<input type="range" class="slider" id="s_' + k + '" min="' + lo + '" max="' + hi + '" step="' + st + '"></div>').join('');
  SL.forEach(([k]) => $('s_' + k).addEventListener('input', ev => { state[k] = +ev.target.value; state.mat = ''; state.reduit = false; $('selMat').value = ''; render(); }));
  $('selMat').innerHTML = Object.entries(MAT).map(([k, m]) => '<option value="' + k + '">' + m.nom + '</option>').join('') + '<option value="" disabled>Personalitzat</option>';
  function loadMat(k) { const m = MAT[k]; if (!m) return; state.mat = k; state.M = m.M; state.d = m.d; state.C = m.C; state.reduit = !!m.reduit; state.vista = m.vista || state.vista; }
  $('selMat').addEventListener('change', () => { loadMat($('selMat').value); render(); });
  $('slQ').addEventListener('input', () => { state.x = +$('slQ').value * Math.PI; render(); });
  document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { state.x = +b.dataset.q * Math.PI; render(); }));
  const setVista = Din.optionGroup($('grupVista'), v => { state.vista = v; render(); });
  $('slExag').addEventListener('input', () => { state.exag = +$('slExag').value; render(); });
  $('btnPlay').addEventListener('click', () => { state.playing = !state.playing; $('btnPlay').textContent = state.playing ? '❚❚ Atura l\'animació' : '▶ Engega l\'animació'; });
  $('slC2').addEventListener('input', () => { state.c2 = +$('slC2').value; render(); });
  $('slC3').addEventListener('input', () => { state.c3 = +$('slC3').value; render(); });
  $('btnNomes1').addEventListener('click', () => { state.c2 = 0; state.c3 = 0; render(); });
  $('chkFinita').addEventListener('change', () => { state.finita = $('chkFinita').checked; render(); });
  $('slN').addEventListener('input', () => { state.N = +$('slN').value; render(); });
  $('chkAlias').addEventListener('change', () => { state.alias = $('chkAlias').checked; render(); });
  $('chkSo').addEventListener('change', () => { state.so = $('chkSo').checked; render(); });

  function render() {
    SL.forEach(([k]) => { $('s_' + k).value = state[k]; $('v_' + k).textContent = fmt(state[k], 3); $('s_' + k).disabled = state.reduit; });
    $('slQ').value = state.x / Math.PI; $('valQ').textContent = fmt(state.x / Math.PI, 2) + ' π/d';
    $('slExag').value = state.exag; $('valExag').textContent = '×' + fmt(state.exag, 2);
    $('slC2').value = state.c2; $('valC2').textContent = fmt(state.c2, 2);
    $('slC3').value = state.c3; $('valC3').textContent = fmt(state.c3, 2);
    $('chkFinita').checked = state.finita; $('slN').value = state.N; $('valN').textContent = String(state.N); $('slN').disabled = !state.finita;
    $('chkAlias').checked = state.alias; $('chkSo').checked = state.so;
    setVista(state.vista);
    calcWmax();
    drawDisp(); drawVel(); drawText(); drawChain();
  }
  Din.linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams();
    if (state.mat) p.set('mat', state.mat); else ['M', 'd', 'C'].forEach(k => p.set(k, state[k]));
    p.set('q', +(state.x / Math.PI).toFixed(3)); p.set('vista', state.vista);
    if (state.c2) p.set('C2', state.c2); if (state.c3) p.set('C3', state.c3);
    if (state.finita) { p.set('finita', 1); p.set('N', state.N); }
    if (!state.alias) p.set('alias', 0); if (!state.so) p.set('so', 0);
    if (state.exag !== 1) p.set('exag', state.exag);
    return p;
  });
  (function fromURL() {
    const p = Din.params();
    loadMat(MAT[p.get('mat')] ? p.get('mat') : 'CuL');
    let custom = false;
    ['M', 'd', 'C'].forEach(k => Din.num(p, k, x => { state[k] = x; custom = true; }, 0.001));
    if (custom) { state.mat = ''; state.reduit = false; }
    $('selMat').value = state.mat;
    Din.num(p, 'q', x => { state.x = x * Math.PI; }, -3, 3);
    if (p.get('vista') === 'L' || p.get('vista') === 'T') state.vista = p.get('vista');
    Din.num(p, 'C2', x => { state.c2 = x; }, -0.4, 1);
    Din.num(p, 'C3', x => { state.c3 = x; }, -0.4, 0.6);
    if (p.get('finita') === '1') state.finita = true;
    Din.num(p, 'N', x => { state.N = Math.round(x); }, 4, 40);
    if (p.get('alias') === '0') state.alias = false;
    if (p.get('so') === '0') state.so = false;
    Din.num(p, 'exag', x => { state.exag = x; }, 0.2, 2);
    if (p.get('atura') === '1') state.playing = false;
    render();
    requestAnimationFrame(loop);
  })();
})();
