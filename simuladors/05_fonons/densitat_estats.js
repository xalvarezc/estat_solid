// Simulador del Tema 5: comptar quadres a l'espai q. La densitat d'estats en 1D, 2D i 3D.
// Unitats: a = 1 (distància entre àtoms veïns) i ω₁ = 2√(C/M) = 1, de manera que v_s = ω₁a/2 = 1/2.
// Una sola branca (model escalar). Condicions de contorn periòdiques: q = (2π/L) m, L = N a, amb N senar
// perquè els quadres centrats als punts permesos omplin exactament la zona de Brillouin [−π/a, π/a]^d.
(function () {
  'use strict';
  const { fmt, sig, formulas, readout, Plot, params, num, linkButton, optionGroup } = window.Fon;
  const PI = Math.PI, TAU = 2 * PI;
  const INK = '#1a1a1a', GRIS = '#5d6b63';

  const MODEL = {
    einstein: { nom: 'Einstein', col: '#b26a00', rgb: [178, 106, 0] },
    debye: { nom: 'Debye', col: '#1f6feb', rgb: [31, 111, 235] },
    xarxa: { nom: 'Xarxa', col: '#00722b', rgb: [0, 114, 43] },
    lliure: { nom: 'Partícula lliure', col: '#8e3fa8', rgb: [142, 63, 168] },
  };
  const ORDRE = ['einstein', 'debye', 'xarxa', 'lliure'];
  const rgba = (m, a) => 'rgba(' + MODEL[m].rgb.join(',') + ',' + a + ')';
  // text al canvas amb subíndexs del tipus q_D o q_{xy}
  function txt(g, s, x, y, o) {
    o = o || {};
    const f = o.mida || 11, pes = o.pes ? o.pes + ' ' : '', parts = [], re = /_(\{[^}]*\}|.)/g;
    let last = 0, mm;
    while ((mm = re.exec(s))) { if (mm.index > last) parts.push([s.slice(last, mm.index), 0]); parts.push([mm[1].replace(/[{}]/g, ''), 1]); last = re.lastIndex; }
    if (last < s.length) parts.push([s.slice(last), 0]);
    const fN = pes + f + 'px sans-serif', fS = pes + Math.round(f * 0.78) + 'px sans-serif';
    let w = 0;
    parts.forEach(p => { g.font = p[1] ? fS : fN; p.push(g.measureText(p[0]).width); w += p[2]; });
    let xx = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    if (o.fons) { g.fillStyle = o.fons; g.fillRect(xx - 2, y - f + 1, w + 4, f + 5); }
    g.textAlign = 'left'; g.fillStyle = o.col || '#333';
    parts.forEach(p => { g.font = p[1] ? fS : fN; g.fillText(p[0], xx, y + (p[1] ? f * 0.3 : 0)); xx += p[2]; });
    return w;
  }

  // Quadres per costat que es poden triar (senars)
  const LLISTA_N = {
    1: [3, 5, 7, 9, 11, 15, 21, 25, 31, 41, 51, 61, 75, 101, 151, 201, 301, 401, 601, 801, 1001],
    2: [3, 5, 7, 9, 11, 13, 15, 17, 21, 25, 31, 35, 41, 51, 61, 75, 101, 121, 151],
    3: [3, 5, 7, 9, 11, 13, 15, 17, 21, 25, 31, 35, 41, 45],
  };

  // ---------------------------------------------------------------
  // Física
  // ---------------------------------------------------------------
  const VS = 0.5;                                                     // v_s = ω₁a/2
  const qD = d => d === 1 ? PI : d === 2 ? 2 * Math.sqrt(PI) : Math.cbrt(6 * PI * PI);  // (L/2π)^d V_d(q_D) = N^d
  const wE = d => Math.sqrt(d / 2);                                   // √(2dC/M) en unitats de ω₁
  const isotrop = m => m === 'debye' || m === 'lliure';
  const wMax = (m, d) => isotrop(m) ? VS * qD(d) : Math.sqrt(d);
  const Vd = (d, q) => d === 1 ? 2 * q : d === 2 ? PI * q * q : 4 / 3 * PI * q * q * q;
  const Sd = (d, q) => d === 1 ? 2 : d === 2 ? TAU * q : 4 * PI * q * q;
  // models isòtrops: Debye ω = v_s q; lliure ω = v_s q²/q_D (acaba a la mateixa ω_D)
  const wIso = (m, d, q) => m === 'debye' ? VS * q : VS * q * q / qD(d);
  const qIso = (m, d, w) => m === 'debye' ? w / VS : Math.sqrt(Math.max(0, w) * qD(d) / VS);
  const vgIso = (m, d, q) => m === 'debye' ? VS : 2 * VS * q / qD(d);

  // ω en un punt de l'espai q (NaN fora de la regió on hi ha modes)
  function wPunt(m, d, x, y, z) {
    if (isotrop(m)) { const r = Math.sqrt(x * x + y * y + z * z); return r > qD(d) + 1e-9 ? NaN : wIso(m, d, r); }
    if (Math.abs(x) > PI + 1e-9 || Math.abs(y) > PI + 1e-9 || Math.abs(z) > PI + 1e-9) return NaN;
    if (m === 'einstein') return wE(d);
    const a = Math.sin(x / 2), b = Math.sin(y / 2), c = Math.sin(z / 2);
    return Math.sqrt(a * a + b * b + c * c);
  }
  // en 1D, la |q| de cada freqüència (models monòtons)
  const q1D = (m, w) => m === 'xarxa' ? 2 * Math.asin(Math.min(1, Math.max(0, w))) : Math.min(qIso(m, 1, w), qD(1));

  // Densitat d'estats contínua de la xarxa, en funció de E = ω²/ω₁² (fracció de modes per unitat de E)
  const agm = (a, b) => { for (let i = 0; i < 40 && Math.abs(a - b) > 1e-14 * a; i++) { const t = (a + b) / 2; b = Math.sqrt(a * b); a = t; } return a; };
  const rho2 = E => (E <= 0 || E >= 2) ? 0 : 1 / (PI * agm(1, Math.abs(1 - E)));   // = (2/π²) K(k)
  let T2 = null, T3 = null;
  function taula2() {
    if (T2) return T2;
    const n = 20000, F = new Float64Array(n + 1);
    for (let i = 1; i <= n; i++) F[i] = F[i - 1] + rho2(2 * (i - 0.5) / n) * 2 / n;
    for (let i = 1; i <= n; i++) F[i] /= F[n];
    return (T2 = { n, F });
  }
  function F2(E) {
    if (E <= 0) return 0; if (E >= 2) return 1;
    const T = taula2(), f = E / 2 * T.n, i = Math.floor(f);
    return T.F[i] + (T.F[i + 1] - T.F[i]) * (f - i);
  }
  // 3D: E = s₁ + s₂ + s₃ → F₃(E) = ⟨F₂(E − sin²(θ/2))⟩ amb θ uniforme a [0, π]
  function taula3() {
    if (T3) return T3;
    const n = 1500, nt = 1600, F = new Float64Array(n + 1), st = new Float64Array(nt), r = new Float64Array(n + 1);
    for (let k = 0; k < nt; k++) { const t = Math.sin(PI * (k + 0.5) / nt / 2); st[k] = t * t; }
    for (let i = 0; i <= n; i++) { const E = 3 * i / n; let s = 0; for (let k = 0; k < nt; k++) s += F2(E - st[k]); F[i] = s / nt; }
    for (let i = 0; i <= n; i++) { const a = Math.max(0, i - 1), b = Math.min(n, i + 1); r[i] = (F[b] - F[a]) / ((b - a) * 3 / n); }
    return (T3 = { n, F, r });
  }
  function interp3(arr, E) { const T = taula3(), f = E / 3 * T.n, i = Math.min(T.n - 1, Math.floor(f)); return arr[i] + (arr[i + 1] - arr[i]) * (f - i); }
  function Fxarxa(d, E) {
    if (E <= 0) return 0;
    if (d === 1) return E >= 1 ? 1 : 2 / PI * Math.asin(Math.sqrt(E));
    if (d === 2) return F2(E);
    return E >= 3 ? 1 : interp3(taula3().F, E);
  }
  function rhoXarxa(d, E) {
    if (E <= 0 || E >= d) return 0;
    if (d === 1) return 1 / (PI * Math.sqrt(E * (1 - E)));
    if (d === 2) return rho2(E);
    return interp3(taula3().r, E);
  }
  // nombre de modes amb freqüència < w segons el càlcul continu
  function Ncont(m, d, N, w) {
    if (w <= 0) return 0;
    if (m === 'einstein') return w > wE(d) ? Math.pow(N, d) : 0;
    if (m === 'xarxa') return Math.pow(N, d) * Fxarxa(d, w * w);
    return Math.pow(N / TAU, d) * Vd(d, Math.min(qIso(m, d, w), qD(d)));
  }
  // g(ω): modes per unitat de ω (Einstein: delta, a part)
  function gcont(m, d, N, w) {
    if (w <= 0 || m === 'einstein') return 0;
    if (m === 'xarxa') return Math.pow(N, d) * rhoXarxa(d, w * w) * 2 * w;
    const q = qIso(m, d, w);
    return q > qD(d) ? 0 : Math.pow(N / TAU, d) * Sd(d, q) / vgIso(m, d, q);
  }

  // ---------------------------------------------------------------
  // Estat
  // ---------------------------------------------------------------
  const state = { d: 2, disp: 'debye', N: 25, w: 0.55, dw: 0.08, comp: false, talla: true, yaw: 0.62, pitch: 0.42 };
  const nAprop = (d, N) => LLISTA_N[d].reduce((b, x) => Math.abs(x - N) < Math.abs(b - N) ? x : b, LLISTA_N[d][0]);

  // tots els modes de la regió (zona de Brillouin o esfera de Debye)
  let dades = null;
  function construeix() {
    const d = state.d, m = state.disp, N = state.N, D = TAU / N, iso = isotrop(m), qd = qD(d);
    const M = iso ? Math.floor(qd / D + 1e-9) : (N - 1) / 2, n1 = 2 * M + 1, cap = Math.pow(n1, d);
    const mx = new Int16Array(cap), my = new Int16Array(cap), mz = new Int16Array(cap), w = new Float64Array(cap), qa = new Float64Array(cap);
    const s2 = new Float64Array(n1);
    for (let i = 0; i < n1; i++) { const t = Math.sin((i - M) * D / 2); s2[i] = t * t; }
    const z1 = d === 3 ? 2 * M : M, y1 = d >= 2 ? 2 * M : M, z0 = d === 3 ? 0 : M, y0 = d >= 2 ? 0 : M;
    let n = 0;
    for (let iz = z0; iz <= z1; iz++) for (let iy = y0; iy <= y1; iy++) for (let ix = 0; ix < n1; ix++) {
      const a = ix - M, b = iy - M, c = iz - M, q = Math.sqrt(a * a + b * b + c * c) * D;
      let om;
      if (iso) { if (q > qd + 1e-9) continue; om = wIso(m, d, q); }
      else if (m === 'einstein') om = wE(d);
      else om = Math.sqrt(s2[ix] + s2[iy] + s2[iz]);
      mx[n] = a; my[n] = b; mz[n] = c; w[n] = om; qa[n] = q; n++;
    }
    dades = { d, m, N, D, M, n, mx, my, mz, w, qa, wmax: wMax(m, d), bin: new Int32Array(n) };
  }
  // histograma amb capses de gruix dω i la previsió contínua de cada capsa
  let hist = null;
  function histograma() {
    const dd = dades, dw = state.dw * dd.wmax, nb = Math.floor(dd.wmax / dw + 1e-9) + 1;
    const h = new Float64Array(nb), e = new Float64Array(nb);
    for (let i = 0; i < dd.n; i++) { const k = Math.min(nb - 1, Math.floor(dd.w[i] / dw + 1e-9)); dd.bin[i] = k; h[k]++; }
    for (let k = 0; k < nb; k++) e[k] = Ncont(dd.m, dd.d, dd.N, (k + 1) * dw) - Ncont(dd.m, dd.d, dd.N, k * dw);
    hist = { dw, nb, h, e };
  }
  let kSel = 0, closca = [];
  function triaCloscaActual() {
    kSel = Math.min(hist.nb - 1, Math.floor(state.w * dades.wmax / hist.dw + 1e-9));
    closca = [];
    for (let i = 0; i < dades.n; i++) if (dades.bin[i] === kSel) closca.push(i);
  }
  const limitsW = () => [kSel * hist.dw, (kSel + 1) * hist.dw];
  // interval de |q| de la closca (models isòtrops i xarxa 1D); null si no té sentit
  function intervalQ() {
    const m = state.disp, d = state.d;
    if (m === 'einstein' || (m === 'xarxa' && d > 1)) return null;
    const [w0, w1] = limitsW(), ext = isotrop(m) ? qD(d) : PI;
    const qa = d === 1 ? q1D(m, w0) : Math.min(qIso(m, d, w0), ext), qb = d === 1 ? q1D(m, w1) : Math.min(qIso(m, d, w1), ext);
    return [qa, qb];
  }

  // ---------------------------------------------------------------
  // Elements
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const cQ = $('canvasQ'), cDisp = $('canvasDisp'), cG = $('canvasG');
  const ui = {
    slQ: $('slQ'), valQ: $('valQ'), notaQ: $('notaQ'), slW: $('slW'), valW: $('valW'), slDW: $('slDW'), valDW: $('valDW'),
    notaDisp: $('notaDisp'), chkComp: $('chkComp'), chkTalla: $('chkTalla'), filaTalla: $('filaTalla'),
    titQ: $('titQ'), infoQ: $('infoQ'), descQ: $('descQ'), llegDisp: $('llegDisp'), descDisp: $('descDisp'), llegG: $('llegG'),
    lectura: $('lectura'), estat: $('estat'), formules: $('formules'),
  };

  // ---------------------------------------------------------------
  // Espai q, 1D
  // ---------------------------------------------------------------
  let geo1 = null;
  function dibuixaQ1() {
    const g = cQ.getContext('2d'), W = cQ.width, H = cQ.height, m = state.disp, dd = dades, D = dd.D;
    const ext = isotrop(m) ? qD(1) : PI, Q = ext * 1.04, x0 = 24, x1 = W - 24;
    const sc = (x1 - x0) / (2 * Q), X = q => x0 + (q + Q) * sc, cp = D * sc;
    const yA = 112, hA = 40;
    geo1 = { X, sc, Q, x0, yA, hA };
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.font = 'bold 12px sans-serif'; g.fillStyle = INK; g.textAlign = 'left';
    g.fillText('Tota la zona: ' + dd.n + ' quadres de costat 2π/L', x0, 34);
    // quadres
    for (let i = 0; i < dd.n; i++) {
      g.fillStyle = dd.bin[i] === kSel ? rgba(m, 0.6) : '#e9efeb';
      g.fillRect(X(dd.mx[i] * D - D / 2), yA - hA / 2, cp, hA);
    }
    // la closca contínua
    const [w0, w1] = limitsW(), iv = intervalQ(), trossos = [];
    if (m === 'einstein') { if (wE(1) >= w0 && wE(1) < w1) trossos.push([-ext, ext]); }
    else if (iv && iv[0] < ext) { if (iv[0] <= 1e-12) trossos.push([-iv[1], iv[1]]); else trossos.push([-iv[1], -iv[0]], [iv[0], iv[1]]); }
    g.fillStyle = rgba(m, 0.16);
    trossos.forEach(t => g.fillRect(X(t[0]), yA - hA / 2 - 14, X(t[1]) - X(t[0]), hA + 28));
    g.strokeStyle = MODEL[m].col; g.lineWidth = 1.4;
    trossos.forEach(t => t.forEach(q => { if (Math.abs(q) < ext - 1e-9) { g.beginPath(); g.moveTo(X(q), yA - hA / 2 - 14); g.lineTo(X(q), yA + hA / 2 + 14); g.stroke(); } }));
    // separacions i punts
    if (cp >= 3) {
      g.strokeStyle = cp >= 10 ? '#bfcac3' : '#d3dbd6'; g.lineWidth = 0.8; g.beginPath();
      for (let j = -dd.M; j <= dd.M + 1; j++) { const x = X((j - 0.5) * D); g.moveTo(x, yA - hA / 2); g.lineTo(x, yA + hA / 2); }
      g.stroke();
    }
    if (cp >= 7) for (let i = 0; i < dd.n; i++) {
      g.fillStyle = dd.bin[i] === kSel ? INK : '#8d9a92';
      g.beginPath(); g.arc(X(dd.mx[i] * D), yA, Math.min(2.5, cp / 6), 0, TAU); g.fill();
    }
    g.setLineDash([5, 4]); g.strokeStyle = GRIS; g.lineWidth = 1.2;
    g.strokeRect(X(-ext), yA - hA / 2, X(ext) - X(-ext), hA); g.setLineDash([]);
    // eix
    g.font = '11px sans-serif'; g.fillStyle = '#555'; g.textAlign = 'center';
    [[-ext, '−π/a'], [0, '0'], [ext, 'π/a']].forEach(([q, t]) => g.fillText(t, X(q), yA + hA / 2 + 30));
    g.fillText('q', x1 + 10, yA + 4);

    // ampliació del tros de +q
    const yB = 318, hB = 64;
    if (m === 'einstein') {
      const dins = trossos.length > 0;
      txt(g, 'Relació de dispersió plana: totes les q tenen ω = ω_E.', W / 2, yB - 14, { mida: 12, col: INK, align: 'center' });
      g.font = '12px sans-serif'; g.fillStyle = INK; g.textAlign = 'center';
      g.fillText(dins ? 'Aquesta closca conté tota la zona: ' + dd.n + ' quadres.' : 'Aquesta closca no en conté cap: mou ω fins a ω_E.', W / 2, yB + 8);
      return;
    }
    if (!iv || iv[0] >= ext) {
      g.font = '12px sans-serif'; g.fillStyle = INK; g.textAlign = 'center';
      g.fillText('Per sobre de la freqüència màxima no hi ha cap mode.', W / 2, yB);
      return;
    }
    const za = Math.max(0, iv[0]), zb = iv[1], pad = Math.max(1.3 * D, 0.35 * (zb - za)), L0 = za - pad, L1 = zb + pad;
    const Z = (x1 - x0) / (L1 - L0), XZ = q => x0 + (q - L0) * Z, cz = D * Z;
    g.save(); g.beginPath(); g.rect(x0, yB - hB / 2 - 40, x1 - x0, hB + 90); g.clip();
    let nMes = 0;
    for (let j = Math.floor(L0 / D) - 1; j <= Math.ceil(L1 / D) + 1; j++) {
      if (Math.abs(j) > dd.M) continue;
      const dins = dd.bin[j + dd.M] === kSel;
      if (dins && j > 0) nMes++;
      g.fillStyle = dins ? rgba(m, 0.6) : '#e9efeb';
      g.fillRect(XZ(j * D - D / 2), yB - hB / 2, cz, hB);
      g.strokeStyle = '#bfcac3'; g.lineWidth = 1; g.strokeRect(XZ(j * D - D / 2), yB - hB / 2, cz, hB);
      g.fillStyle = dins ? INK : '#8d9a92'; g.beginPath(); g.arc(XZ(j * D), yB, 3, 0, TAU); g.fill();
    }
    g.fillStyle = rgba(m, 0.16); g.fillRect(XZ(za), yB - hB / 2 - 16, XZ(zb) - XZ(za), hB + 32);
    g.strokeStyle = MODEL[m].col; g.lineWidth = 1.6;
    [za, zb].forEach(q => { g.beginPath(); g.moveTo(XZ(q), yB - hB / 2 - 16); g.lineTo(XZ(q), yB + hB / 2 + 16); g.stroke(); });
    if (dd.M * D + D / 2 < L1) { g.setLineDash([5, 4]); g.strokeStyle = GRIS; g.beginPath(); g.moveTo(XZ(ext), yB - hB / 2 - 10); g.lineTo(XZ(ext), yB + hB / 2 + 10); g.stroke(); g.setLineDash([]); }
    g.restore();
    // cotes: dq a dalt, 2π/L a baix
    const cota = (xa, xb, y, txt, col) => {
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(xa, y); g.lineTo(xb, y); g.moveTo(xa, y - 4); g.lineTo(xa, y + 4); g.moveTo(xb, y - 4); g.lineTo(xb, y + 4); g.stroke();
      g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText(txt, (xa + xb) / 2, y - 6);
    };
    cota(XZ(za), XZ(zb), yB - hB / 2 - 24, 'dq = ' + fmt(zb - za, 3) + '/a', MODEL[m].col);
    const j0 = Math.ceil(L0 / D + 0.5);
    cota(XZ(j0 * D - D / 2), XZ(j0 * D + D / 2), yB + hB / 2 + 30, '2π/L', GRIS);
    // línies d'ampliació
    g.setLineDash([3, 3]); g.strokeStyle = '#9aa8a0'; g.lineWidth = 1; g.beginPath();
    g.moveTo(X(L0), yA + hA / 2 + 36); g.lineTo(x0, yB - hB / 2 - 44);
    g.moveTo(X(L1), yA + hA / 2 + 36); g.lineTo(x1, yB - hB / 2 - 44); g.stroke(); g.setLineDash([]);
    g.font = '11px sans-serif'; g.fillStyle = '#555'; g.textAlign = 'left';
    g.fillText('Ampliació del tros de +q', x0, yB - hB / 2 - 48);
    // recompte del tros
    const prev1 = (zb - za) / D;
    g.font = '12px sans-serif'; g.fillStyle = INK; g.textAlign = 'center';
    g.fillText('En aquest tros: ' + nMes + ' quadres. Gruix/costat: dq/(2π/L) = ' + fmt(prev1, 2), W / 2, yB + hB / 2 + 62);
    g.fillText(za > 0 ? "L'altre tros, a −q, en té els mateixos: la closca 1D mesura 2dq." : 'Prop de q = 0 els dos trossos s’ajunten en un de sol.', W / 2, yB + hB / 2 + 80);
  }

  // ---------------------------------------------------------------
  // Espai q, 2D
  // ---------------------------------------------------------------
  let campKey = '', camp = null, campG = null, capaB = null;
  const NG = 220;
  function geomQ2() {
    const ext = isotrop(state.disp) ? qD(2) : PI, Q = ext * 1.07, s = (cQ.width / 2) / Q;
    return { ext, Q, s, cx: cQ.width / 2, cy: cQ.height / 2 };
  }
  function preparaCamp(G) {
    const key = state.disp;
    if (key === campKey) return;
    campKey = key;
    const W = cQ.width, H = cQ.height, m = state.disp;
    camp = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) camp[j * W + i] = wPunt(m, 2, (i + 0.5 - G.cx) / G.s, -(j + 0.5 - G.cy) / G.s, 0);
    campG = null;
    if (m === 'xarxa') {   // per als contorns, sense tallar a la zona (el dibuix es retalla després)
      campG = new Float64Array((NG + 1) * (NG + 1));
      for (let j = 0; j <= NG; j++) for (let i = 0; i <= NG; i++) {
        const a = Math.sin((-G.Q + 2 * G.Q * i / NG) / 2), b = Math.sin((-G.Q + 2 * G.Q * j / NG) / 2);
        campG[j * (NG + 1) + i] = Math.sqrt(a * a + b * b);
      }
    }
  }
  function capaBanda(w0, w1, m) {
    const W = cQ.width, H = cQ.height;
    if (!capaB) { capaB = document.createElement('canvas'); capaB.width = W; capaB.height = H; }
    const gb = capaB.getContext('2d'), img = gb.createImageData(W, H), dat = img.data, [r, gg, b] = MODEL[m].rgb;
    for (let k = 0; k < camp.length; k++) {
      const w = camp[k];
      if (w >= w0 && w < w1) { const o = 4 * k; dat[o] = r; dat[o + 1] = gg; dat[o + 2] = b; dat[o + 3] = 44; }
    }
    gb.putImageData(img, 0, 0);
    return capaB;
  }
  // corbes de nivell (marching squares) sobre campG
  function contorn(g, lev, toPx) {
    const n = NG, F = campG, n1 = n + 1;
    g.beginPath();
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = F[j * n1 + i] - lev, b = F[j * n1 + i + 1] - lev, c = F[(j + 1) * n1 + i + 1] - lev, d = F[(j + 1) * n1 + i] - lev;
      const p = [];
      if ((a < 0) !== (b < 0)) p.push(i + a / (a - b), j);
      if ((b < 0) !== (c < 0)) p.push(i + 1, j + b / (b - c));
      if ((c < 0) !== (d < 0)) p.push(i + 1 - c / (c - d), j + 1);
      if ((d < 0) !== (a < 0)) p.push(i, j + 1 - d / (d - a));
      for (let k = 0; k + 3 < p.length; k += 4) {
        const A = toPx(p[k], p[k + 1]), B = toPx(p[k + 2], p[k + 3]);
        g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
      }
    }
    g.stroke();
  }
  function dibuixaQ2() {
    const g = cQ.getContext('2d'), W = cQ.width, H = cQ.height, G = geomQ2(), m = state.disp, dd = dades, iso = isotrop(m);
    preparaCamp(G);
    const X = q => G.cx + q * G.s, Y = q => G.cy - q * G.s, D = dd.D, cp = D * G.s, [w0, w1] = limitsW();
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e9efeb';
    for (let i = 0; i < dd.n; i++) if (dd.bin[i] !== kSel) g.fillRect(X(dd.mx[i] * D - D / 2), Y(dd.my[i] * D + D / 2), cp, cp);
    g.fillStyle = rgba(m, 0.58);
    closca.forEach(i => g.fillRect(X(dd.mx[i] * D - D / 2), Y(dd.my[i] * D + D / 2), cp, cp));
    g.drawImage(capaBanda(w0, w1, m), 0, 0);
    // graella
    if (cp >= 4) {
      g.strokeStyle = cp >= 10 ? '#c3cec7' : '#d6dfd9'; g.lineWidth = cp >= 10 ? 0.8 : 0.5; g.beginPath();
      const jm = Math.ceil(G.Q / D + 0.5);
      for (let j = -jm; j <= jm; j++) { const x = X((j + 0.5) * D), y = Y((j + 0.5) * D); g.moveTo(x, 0); g.lineTo(x, H); g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();
    }
    if (cp >= 9) {
      const r = Math.min(2.2, cp / 8);
      for (let i = 0; i < dd.n; i++) {
        g.fillStyle = dd.bin[i] === kSel ? INK : '#93a198';
        g.beginPath(); g.arc(X(dd.mx[i] * D), Y(dd.my[i] * D), r, 0, TAU); g.fill();
      }
    }
    // vores de la closca
    g.strokeStyle = MODEL[m].col; g.lineWidth = 1.7;
    if (iso) [w0, w1].forEach(w => { const q = qIso(m, 2, w); if (q > 0 && q <= qD(2) + 1e-9) { g.beginPath(); g.arc(G.cx, G.cy, q * G.s, 0, TAU); g.stroke(); } });
    else if (m === 'xarxa') {
      g.save(); g.beginPath(); g.rect(X(-PI), Y(PI), TAU * G.s, TAU * G.s); g.clip();
      const toPx = (i, j) => [X(-G.Q + 2 * G.Q * i / NG), Y(-G.Q + 2 * G.Q * j / NG)];
      contorn(g, w0, toPx); if (w1 < Math.SQRT2) contorn(g, w1, toPx);
      g.restore();
    }
    // zona de Brillouin i cercle de Debye
    g.setLineDash([6, 4]); g.strokeStyle = GRIS; g.lineWidth = 1.3;
    g.strokeRect(X(-PI), Y(PI), TAU * G.s, TAU * G.s);
    if (iso) { g.strokeStyle = MODEL[m].col; g.beginPath(); g.arc(G.cx, G.cy, qD(2) * G.s, 0, TAU); g.stroke(); }
    g.setLineDash([]);
    // eixos i etiquetes
    g.strokeStyle = 'rgba(60,70,64,0.45)'; g.lineWidth = 1; g.beginPath();
    g.moveTo(4, G.cy); g.lineTo(W - 4, G.cy); g.moveTo(G.cx, 4); g.lineTo(G.cx, H - 4); g.stroke();
    const etiqueta = (t, x, y, al) => txt(g, t, x, y, { align: al, fons: 'rgba(255,255,255,0.85)' });
    etiqueta('q_x', W - 6, G.cy - 6, 'right'); etiqueta('q_y', G.cx + 6, 14);
    etiqueta('π/a', X(PI) - 3, G.cy + 15, 'right'); etiqueta('−π/a', X(-PI) + 3, G.cy + 15);
    if (iso) { const a = -0.62; etiqueta('q_D', G.cx + qD(2) * G.s * Math.cos(a) + 4, G.cy - qD(2) * G.s * Math.sin(a) + 12); }
    // cota d'un quadre
    const yC = iso ? G.cy + qD(2) * G.s + 9 : Y(-PI) + 8, xa = iso ? X(-D / 2) : X(-PI), xb = xa + cp;
    g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(xa, yC); g.lineTo(xb, yC); g.moveTo(xa, yC - 3); g.lineTo(xa, yC + 3); g.moveTo(xb, yC - 3); g.lineTo(xb, yC + 3); g.stroke();
    g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText('2π/L', xb + 5, yC + 4);
  }

  // ---------------------------------------------------------------
  // Espai q, 3D (projecció ortogràfica; arrossegant es gira)
  // ---------------------------------------------------------------
  function vista() {
    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw), ce = Math.cos(state.pitch), se = Math.sin(state.pitch);
    // (x, y, z) → [dreta, amunt, profunditat (positiva = lluny)]
    return (x, y, z) => { const x1 = x * cy - y * sy, y1 = x * sy + y * cy; return [x1, z * ce + y1 * se, y1 * ce - z * se]; };
  }
  const LLUM = (() => { const v = [-0.45, 0.7, -0.55], n = Math.hypot(...v); return v.map(x => x / n); })();
  function colorCara(m, t) {
    const c = MODEL[m].rgb.map(x => { const fosc = x * 0.6, clar = x + (255 - x) * 0.55; return Math.round(fosc + (clar - fosc) * t); });
    return 'rgb(' + c.join(',') + ')';
  }
  function dibuixaQ3() {
    const g = cQ.getContext('2d'), W = cQ.width, H = cQ.height, m = state.disp, dd = dades, D = dd.D, iso = isotrop(m);
    const ext = iso ? qD(3) : PI, R = iso ? ext * 1.06 : ext * Math.sqrt(3) * 1.02, s = (W / 2 - 6) / R, cx = W / 2, cy = H / 2;
    const P = vista(), h = D / 2, cp = D * s;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    // la zona (cub) per darrere
    const arestes = () => {
      if (iso) return;
      g.setLineDash([5, 4]); g.strokeStyle = 'rgba(93,107,99,0.75)'; g.lineWidth = 1.1; g.beginPath();
      for (let a = 0; a < 3; a++) for (const sb of [-1, 1]) for (const sc of [-1, 1]) {
        const u = [0, 0, 0], v = [0, 0, 0]; const b = (a + 1) % 3, c = (a + 2) % 3;
        u[a] = -PI; v[a] = PI; u[b] = v[b] = sb * PI; u[c] = v[c] = sc * PI;
        const A = P(...u), B = P(...v);
        g.moveTo(cx + A[0] * s, cy - A[1] * s); g.lineTo(cx + B[0] * s, cy - B[1] * s);
      }
      g.stroke(); g.setLineDash([]);
    };
    // els cubs de la closca, de lluny a prop
    const L = [];
    for (const i of closca) {
      const p = P(dd.mx[i] * D, dd.my[i] * D, dd.mz[i] * D);
      if (state.talla && p[2] < -1e-9) continue;
      L.push(p);
    }
    L.sort((a, b) => b[2] - a[2]);
    if (iso) {
      g.setLineDash([6, 4]); g.strokeStyle = MODEL[m].col; g.lineWidth = 1.2;
      g.beginPath(); g.arc(cx, cy, qD(3) * s, 0, TAU); g.stroke(); g.setLineDash([]);
    }
    if (cp >= 3.2 && L.length <= 20000) {
      const cares = [];
      for (let a = 0; a < 3; a++) for (const sg of [1, -1]) {
        const n = [0, 0, 0]; n[a] = sg; const nv = P(...n);
        if (nv[2] > -1e-6) continue;
        const b = (a + 1) % 3, c = (a + 2) % 3, off = [];
        for (const [sb, sc] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
          const v = [0, 0, 0]; v[a] = sg * h; v[b] = sb * h; v[c] = sc * h;
          const pv = P(...v); off.push([pv[0] * s, -pv[1] * s]);
        }
        const lum = Math.max(0, nv[0] * LLUM[0] + nv[1] * LLUM[1] + nv[2] * LLUM[2]);
        cares.push({ off, col: colorCara(m, 0.2 + 0.8 * lum) });
      }
      const vora = cp >= 7;
      g.lineWidth = 0.6; g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineJoin = 'round';
      for (const p of L) {
        const X0 = cx + p[0] * s, Y0 = cy - p[1] * s;
        for (const f of cares) {
          const o = f.off;
          g.beginPath(); g.moveTo(X0 + o[0][0], Y0 + o[0][1]); g.lineTo(X0 + o[1][0], Y0 + o[1][1]); g.lineTo(X0 + o[2][0], Y0 + o[2][1]); g.lineTo(X0 + o[3][0], Y0 + o[3][1]); g.closePath();
          g.fillStyle = f.col; g.fill(); if (vora) g.stroke();
        }
      }
    } else {
      const ps = Math.max(1.6, cp), cols = [];
      for (let k = 0; k < 8; k++) cols.push(colorCara(m, 0.25 + 0.6 * (1 - k / 7)));
      const dm = R;
      for (const p of L) {
        const k = Math.max(0, Math.min(7, Math.round((p[2] + dm) / (2 * dm) * 7)));
        g.fillStyle = cols[k]; g.fillRect(cx + p[0] * s - ps / 2, cy - p[1] * s - ps / 2, ps, ps);
      }
    }
    arestes();
    // contorns de les esferes q i q + dq
    if (iso) {
      const [w0, w1] = limitsW();
      g.strokeStyle = MODEL[m].col; g.lineWidth = 1.5;
      [w0, w1].forEach(w => { const q = qIso(m, 3, w); if (q > 0 && q <= qD(3) + 1e-9) { g.beginPath(); g.arc(cx, cy, q * s, 0, TAU); g.stroke(); } });
    }
    // eixos
    const ox = 40, oy = H - 40;
    [['q_x', [1, 0, 0]], ['q_y', [0, 1, 0]], ['q_z', [0, 0, 1]]].forEach(([t, e]) => {
      const p = P(...e);
      window.Fon.arrow(g, ox, oy, ox + p[0] * 26, oy - p[1] * 26, '#555', 1.3);
      txt(g, t, ox + p[0] * 38, oy - p[1] * 38 + 4, { align: 'center' });
    });
    g.font = '11px sans-serif'; g.fillStyle = '#6b7a71'; g.textAlign = 'right';
    g.fillText('arrossega per girar', W - 8, H - 10);
  }

  // ---------------------------------------------------------------
  // Relació de dispersió
  // ---------------------------------------------------------------
  let pDisp = null, capaN = null, capaNKey = '';
  const wEix = () => { let w = wMax(state.disp, state.d); if (state.comp) ORDRE.forEach(o => { w = Math.max(w, wMax(o, state.d)); }); return w; };
  const qEixModel = (m, d) => isotrop(m) ? qD(d) * 1.12 : Math.sqrt(d) * PI;
  const qEix = () => { let q = qEixModel(state.disp, state.d); if (state.comp) ORDRE.forEach(o => { q = Math.max(q, qEixModel(o, state.d)); }); return q; };
  const DIRS = { 1: [[1, 0, 0, '']], 2: [[1, 0, 0, '[10] → X'], [1, 1, 0, '[11] → M']], 3: [[1, 0, 0, '[100] → X'], [1, 1, 0, '[110] → M'], [1, 1, 1, '[111] → R']] };
  const DASH = [[], [7, 4], [2, 3]];
  const wDir = (dir, q) => { const n = Math.hypot(dir[0], dir[1], dir[2]); return wPunt('xarxa', 3, q * dir[0] / n, q * dir[1] / n, q * dir[2] / n); };
  function capaNuvol(p) {
    const key = clauDades + '|' + p.xmax + '|' + p.ymax;
    if (key === capaNKey) return capaN;
    capaNKey = key;
    const W = cDisp.width, H = cDisp.height, dd = dades, cnt = new Float32Array(W * H);
    if (!capaN) { capaN = document.createElement('canvas'); capaN.width = W; capaN.height = H; }
    for (let i = 0; i < dd.n; i++) {
      const x = Math.round(p.X(dd.qa[i] / PI)), y = Math.round(p.Y(dd.w[i]));
      if (x >= 0 && x < W && y >= 0 && y < H) cnt[y * W + x]++;
    }
    const gc = capaN.getContext('2d'), img = gc.createImageData(W, H), a = img.data;
    for (let k = 0; k < cnt.length; k++) if (cnt[k] > 0) {
      const o = 4 * k; a[o] = 105; a[o + 1] = 120; a[o + 2] = 112; a[o + 3] = Math.min(235, 110 + 40 * Math.log(cnt[k]));
    }
    gc.putImageData(img, 0, 0);
    return capaN;
  }
  function corbaModel(p, m, d, estil) {
    if (m === 'einstein') { p.fn(() => wE(d), estil, 0, Math.sqrt(d)); return; }
    if (isotrop(m)) {
      p.fn(x => wIso(m, d, x * PI), estil, 0, qD(d) / PI);
      p.fn(x => wIso(m, d, x * PI), Object.assign({}, estil, { w: 1, dash: [3, 4], alpha: 0.45 }), qD(d) / PI, p.xmax);
      return;
    }
    DIRS[d].forEach((dir, j) => p.fn(x => wDir(dir, x * PI), Object.assign({}, estil, { dash: estil.dash || DASH[j] }), 0, Math.hypot(dir[0], dir[1], dir[2])));
  }
  function dibuixaDisp() {
    const d = state.d, m = state.disp, dd = dades, g = cDisp.getContext('2d'), W = cDisp.width, H = cDisp.height;
    const p = Plot(cDisp, { xmin: 0, xmax: qEix() / PI, ymin: 0, ymax: wEix() * 1.08, m: { l: 46, r: 14, t: 14, b: 40 } });
    pDisp = p;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    p.axes('|q| (unitats de π/a)', 'ω (unitats de ω₁)');
    const [w0, w1] = limitsW(), x0 = p.m.l, x1 = W - p.m.r;
    // franja dω
    p.clip();
    g.fillStyle = rgba(m, 0.14); g.fillRect(x0, p.Y(w1), x1 - x0, p.Y(w0) - p.Y(w1));
    g.strokeStyle = rgba(m, 0.55); g.lineWidth = 1; g.beginPath();
    g.moveTo(x0, p.Y(w0)); g.lineTo(x1, p.Y(w0)); g.moveTo(x0, p.Y(w1)); g.lineTo(x1, p.Y(w1)); g.stroke();
    // franja dq
    const iv = intervalQ();
    if (iv && iv[1] > iv[0]) { g.fillStyle = rgba(m, 0.12); g.fillRect(p.X(iv[0] / PI), p.Y(w1), p.X(iv[1] / PI) - p.X(iv[0] / PI), p.Y(0) - p.Y(w1)); }
    p.unclip();
    // corbes (altres models a sota) i, a sobre, els modes: núvol gris i els de la closca
    if (state.comp) ORDRE.forEach(o => { if (o !== m) corbaModel(p, o, d, { col: MODEL[o].col, w: 1.5, alpha: 0.55, dash: [5, 4] }); });
    corbaModel(p, m, d, { col: MODEL[m].col, w: 2.2 });
    g.drawImage(capaNuvol(p), 0, 0);
    p.clip();
    g.fillStyle = MODEL[m].col;
    const vist = new Set();
    for (const i of closca) {
      const x = Math.round(p.X(dd.qa[i] / PI)), y = Math.round(p.Y(dd.w[i])), k = y * W + x;
      if (vist.has(k)) continue; vist.add(k);
      g.fillRect(x - 2, y - 2, 4, 4);
    }
    p.unclip();
    // etiquetes
    g.font = '11px sans-serif'; g.fillStyle = INK;
    if (isotrop(m)) {
      p.vline(qD(d) / PI, { col: GRIS, w: 1, dash: [2, 3] });
      txt(g, 'q_D', p.X(qD(d) / PI) + 4, p.m.t + 12, { fons: 'rgba(255,255,255,0.85)' });
    } else if (m === 'xarxa' && d > 1) {
      DIRS[d].forEach(dir => {
        const L = Math.hypot(dir[0], dir[1], dir[2]), x = p.X(L), y = p.Y(wDir(dir, L * PI));
        g.font = '11px sans-serif'; g.fillStyle = INK;
        if (x + 70 < W - p.m.r) { g.textAlign = 'left'; g.fillText(dir[3], x + 5, y + 16); }
        else { g.textAlign = 'right'; g.fillText(dir[3], x - 2, y - 7); }
      });
    }
    g.textAlign = 'left'; g.fillStyle = MODEL[m].col; g.font = 'bold 11px sans-serif';
    g.fillText('dω', x1 - 22, (p.Y(w0) + p.Y(w1)) / 2 + 4);
    if (iv && iv[1] > iv[0]) { g.textAlign = 'center'; g.fillText('dq', (p.X(iv[0] / PI) + p.X(iv[1] / PI)) / 2, p.Y(0) - 5); }
  }

  // ---------------------------------------------------------------
  // Histograma g(ω)
  // ---------------------------------------------------------------
  let pG = null, hoverK = -1;
  function dibuixaG() {
    const d = state.d, m = state.disp, N = state.N, Hs = hist, dw = Hs.dw, g = cG.getContext('2d'), W = cG.width, H = cG.height;
    let ymax = 0;
    for (let k = 0; k < Hs.nb; k++) ymax = Math.max(ymax, Hs.h[k], Hs.e[k]);
    const p = Plot(cG, { xmin: 0, xmax: wEix() * 1.04, ymin: 0, ymax: ymax * 1.15 || 1, m: { l: 58, r: 14, t: 16, b: 40 } });
    pG = p;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    p.axes('ω (unitats de ω₁ = 2√(C/M))', 'quadres a la closca');
    p.clip();
    for (let k = 0; k < Hs.nb; k++) {
      if (!Hs.h[k]) continue;
      const xa = p.X(k * dw), xb = p.X((k + 1) * dw), gap = xb - xa > 6 ? 1 : 0;
      g.fillStyle = k === kSel ? rgba(m, 0.8) : k === hoverK ? '#a9b8af' : '#cbd5cf';
      g.fillRect(xa + gap, p.Y(Hs.h[k]), xb - xa - 2 * gap, p.Y(0) - p.Y(Hs.h[k]));
    }
    p.unclip();
    // previsions contínues
    const fletxa = (o, estil) => {
      const x = p.X(wE(d)), yTop = p.m.t + 6;
      g.save(); g.globalAlpha = estil.alpha || 1; g.setLineDash(estil.dash || []);
      window.Fon.arrow(g, x, p.Y(0), x, yTop, MODEL[o].col, estil.w || 2); g.restore();
      txt(g, 'N' + ['', '', '²', '³'][d] + ' δ(ω − ω_E)', x + 6, p.Y(p.ymax * 0.45), { col: MODEL[o].col, fons: 'rgba(255,255,255,0.85)' });
    };
    if (state.comp) ORDRE.forEach(o => {
      if (o === m) return;
      const e = { col: MODEL[o].col, w: 1.5, dash: [5, 4], alpha: 0.6 };
      if (o === 'einstein') fletxa(o, e); else p.fn(w => gcont(o, d, N, w) * dw, e);
    });
    if (m === 'einstein') fletxa(m, { w: 2 }); else p.fn(w => gcont(m, d, N, w) * dw, { col: MODEL[m].col, w: 2.2 });
    // rètol de la barra triada o sota el ratolí
    const k = hoverK >= 0 ? hoverK : kSel;
    if (k >= 0 && k < Hs.nb) {
      const lin = ['ω entre ' + fmt(k * dw, 3) + ' i ' + fmt((k + 1) * dw, 3) + ' ω₁', 'quadres comptats: ' + Hs.h[k], 'previsió contínua: ' + fmt(Hs.e[k], 1)];
      g.font = '11px sans-serif';
      const wb = Math.max(...lin.map(l => g.measureText(l).width)) + 14, hb = lin.length * 15 + 8;
      const xk = p.X((k + 0.5) * dw);
      let xb = xk + 12; if (xb + wb > W - p.m.r) xb = xk - 12 - wb;
      const yb = p.m.t + 4;
      g.fillStyle = 'rgba(255,255,255,0.94)'; g.strokeStyle = '#c8d0cb'; g.lineWidth = 1;
      g.fillRect(xb, yb, wb, hb); g.strokeRect(xb, yb, wb, hb);
      g.textAlign = 'left';
      lin.forEach((l, i) => { g.fillStyle = INK; g.font = (i ? '' : 'bold ') + '11px sans-serif'; g.fillText(l, xb + 7, yb + 16 + i * 15); });
    }
  }

  // ---------------------------------------------------------------
  // Textos
  // ---------------------------------------------------------------
  const NOTA = {
    einstein: 'Cada àtom oscil·la sol, lligat als veïns quiets: ω<sub>E</sub> = √(2dC/M) per a tot q. La relació de dispersió és plana (v<sub>g</sub> = 0).',
    debye: 'Ona de so per a tot q, ω = v<sub>s</sub>q, amb la v<sub>s</sub> = ω₁a/2 de la cadena. Els modes es tallen a l\'esfera de Debye, que té tants quadres com la zona.',
    xarxa: 'Molles entre veïns propers: ω² = ω₁² Σ sin²(q<sub>i</sub>a/2), amb ω₁ = 2√(C/M). Comença com el so i s\'aplana a la vora de la zona.',
    lliure: 'ω ∝ q², com l\'energia d\'un electró lliure (Tema 6). Mateix tall que Debye, i acaba a la mateixa ω<sub>D</sub>.',
  };
  function textFormules() {
    const d = state.d, m = state.disp;
    const S = ['', '2', '2\\pi q', '4\\pi q^2'][d];
    const pre = d === 1 ? '\\frac{L}{2\\pi}' : '\\left(\\frac{L}{2\\pi}\\right)^{' + d + '}';
    const notaCloscaD = [
      '',
      'En 1D la closca són dos trossos de gruix dq, a +q i a −q: la seva mida, 2dq, no depèn de q.',
      'En 2D la closca és un anell de perímetre 2πq i gruix dq.',
      'En 3D la closca és una capa esfèrica de superfície 4πq² i gruix dq.',
    ][d];
    const files = [
      { nom: 'Els quadres', tex: [String.raw`\vec q=\frac{2\pi}{L}\,(m_1,\dots,m_d),\qquad\text{costat }\frac{2\pi}{L}=\frac{2\pi}{Na}\qquad\Longrightarrow\qquad\left(\frac{L}{2\pi}\right)^{d}\text{ quadres per unitat de volum de l'espai }q`],
        nota: 'A la zona de Brillouin, de costat 2π/a, hi caben N quadres per costat: N<sup>d</sup> modes, un per àtom (per branca).' },
      { nom: 'Quadres dins la closca (' + d + 'D)', tex: ['dN=' + pre + '\\,' + S + '\\,dq'], nota: notaCloscaD + ' Només és exacte si la closca conté molts quadres.' },
      { nom: 'La relació de dispersió fixa el gruix', tex: [String.raw`dq=\frac{d\omega}{v_g},\quad v_g=\frac{d\omega}{dq}\qquad\Longrightarrow\qquad g(\omega)=\frac{dN}{d\omega}=` + pre + '\\,\\frac{' + S + '}{v_g(q)}'] },
    ];
    let t, nota;
    if (m === 'einstein') {
      t = [String.raw`\omega(\vec q)=\omega_E=\sqrt{\frac{${2 * d}C}{M}}=${fmt(wE(d), 3)}\,\omega_1,\quad v_g=0\qquad\Longrightarrow\qquad g(\omega)=N^{${d}}\,\delta(\omega-\omega_E)`];
      nota = 'Totes les q tenen la mateixa freqüència: la closca que conté ω<sub>E</sub> conté tota la zona, i les altres, cap quadre.';
    } else if (m === 'debye') {
      const res = [String.raw`g(\omega)=\frac{L}{\pi v_s}`, String.raw`g(\omega)=\frac{A\,\omega}{2\pi v_s^2}`, String.raw`g(\omega)=\frac{V\omega^2}{2\pi^2v_s^3}`][d - 1];
      const qdTex = [String.raw`q_D=\frac{\pi}{a}`, String.raw`\pi q_D^2=\left(\frac{2\pi}{a}\right)^2\ \Rightarrow\ q_D=\frac{2\sqrt\pi}{a}`, String.raw`\frac{4\pi}{3}q_D^3=\left(\frac{2\pi}{a}\right)^3\ \Rightarrow\ q_D=\frac{(6\pi^2)^{1/3}}{a}`][d - 1];
      t = [String.raw`\omega=v_sq\qquad\Longrightarrow\qquad ` + res + String.raw`\quad(\omega\le\omega_D=v_sq_D)`, qdTex];
      nota = 'El tall q<sub>D</sub> fa que hi hagi N<sup>d</sup> modes: la regió de Debye té la mateixa mida que la zona de Brillouin. Aquí q<sub>D</sub> = ' + fmt(qD(d), 3) + '/a i ω<sub>D</sub> = ' + fmt(wMax(m, d), 3) + ' ω₁.';
    } else if (m === 'xarxa') {
      const res = [String.raw`g(\omega)=\frac{2N}{\pi}\,\frac{1}{\sqrt{\omega_1^2-\omega^2}}`,
        String.raw`g(\omega)=\frac{4N^2\omega}{\pi^2\omega_1^2}\,K\!\left(\sqrt{1-\left(1-\omega^2/\omega_1^2\right)^2}\right)`,
        String.raw`g(\omega)=\frac{V}{(2\pi)^3}\oint\frac{dS}{|\nabla_{\vec q}\,\omega|}`][d - 1];
      t = [String.raw`\omega^2=\omega_1^2\sum_{i=1}^{${d}}\sin^2\frac{q_ia}{2},\qquad\omega_1=2\sqrt{C/M}`, res];
      nota = ['Divergeix a ω₁, la vora de zona, on v<sub>g</sub> = 0.',
        'K és la integral el·líptica completa de primera espècie. Divergeix (logarítmicament) a ω = ω₁, quan la corba d\'isofreqüència toca els punts X: és una singularitat de van Hove.',
        'No té forma tancada; la corba del simulador es calcula numèricament. Té canvis bruscos de pendent (singularitats de van Hove) a ω₁ i √2 ω₁, quan la superfície d\'isofreqüència toca els punts X i M.'][d - 1];
    } else {
      const res = [String.raw`g(\omega)=\frac{L}{2\pi\sqrt{\alpha\,\omega}}\ \propto\ \omega^{-1/2}`, String.raw`g(\omega)=\frac{A}{4\pi\alpha}\quad\text{(constant)}`, String.raw`g(\omega)=\frac{V\sqrt{\omega}}{4\pi^2\alpha^{3/2}}\ \propto\ \omega^{1/2}`][d - 1];
      t = [String.raw`\omega=\alpha q^2,\quad v_g=2\alpha q\qquad\Longrightarrow\qquad ` + res];
      nota = 'Aquí α = v<sub>s</sub>/q<sub>D</sub>, perquè acabi a la mateixa ω<sub>D</sub> que Debye. És la forma de l\'energia d\'un electró lliure, ε = ħ²q²/2m (Tema 6).';
    }
    files.push({ nom: 'Aquest model: ' + MODEL[m].nom, tex: t, nota });
    formulas(ui.formules, files);
  }

  function dibuixaText() {
    const d = state.d, m = state.disp, dd = dades, D = dd.D, [w0, w1] = limitsW(), n = closca.length, e = hist.e[kSel], iv = intervalQ();
    const rows = [
      ['Quadres per costat, N', String(state.N)],
      ['Costat del quadre, 2π/L', fmt(D, 4) + ' /a'],
      ['Modes (quadres) de la regió', String(dd.n)],
      ['Closca: ω (ω₁)', fmt(w0, 3) + ' – ' + fmt(w1, 3)],
    ];
    if (iv) rows.push(['Closca: |q| (1/a)', fmt(iv[0], 3) + ' – ' + fmt(iv[1], 3)], ['Gruix dq / costat del quadre', fmt((iv[1] - iv[0]) / D, 2)]);
    rows.push(['Quadres dins la closca', String(n)], ['Previsió contínua', fmt(e, 1)], ['Recompte / previsió', e > 0.05 ? fmt(n / e, 3) : '—'], ['g(ω) ≈ recompte/dω', sig(n / hist.dw, 3) + ' /ω₁']);
    readout(ui.lectura, rows);
    let msg, ok = false;
    if (m === 'einstein') { msg = n ? 'Tota la zona és dins d\'aquesta closca: els ' + n + ' modes tenen la mateixa freqüència.' : 'Cap quadre: tots els modes són a ω_E = ' + fmt(wE(d), 3) + ' ω₁.'; ok = true; }
    else if (e < 0.5 && n === 0) { msg = 'Per sobre de la freqüència màxima: no hi ha cap mode.'; ok = true; }
    else if (iv && (iv[1] - iv[0]) < 0.75 * D) msg = 'La closca és més prima que un quadre (dq < 2π/L): el recompte salta d\'una closca a la següent. Fes els quadres més petits o la closca més gruixuda.';
    else if (e < 8) msg = 'Hi caben pocs quadres: el recompte encara és irregular. Fes els quadres més petits.';
    else {
      const err = Math.abs(n / e - 1) * 100;
      if (err < 8) { msg = 'Recompte i previsió contínua coincideixen en un ' + fmt(100 - err, 0) + '%: els quadres ja són prou petits.'; ok = true; }
      else msg = 'El recompte difereix un ' + fmt(err, 0) + '% de la previsió: els quadres de la vora, mig dins i mig fora, encara pesen.';
    }
    ui.estat.textContent = msg; ui.estat.className = 'estat ' + (ok ? 'si' : 'no');

    ui.titQ.textContent = ['', "1D: la zona i la closca (dos trossos)", '2D: quadres dins la closca', '3D: cubs dins la closca'][d];
    ui.infoQ.innerHTML = '<b>' + n + '</b> quadres dins la closca · previsió contínua <b>' + fmt(e, 1) + '</b>' + (d === 3 && state.talla ? ' · se\'n dibuixa la meitat del darrere' : '');
    ui.descQ.textContent = [
      '',
      'A dalt, tota la zona; a baix, ampliat, el tros de la closca a +q. Cada quadre és un mode; els de color tenen el punt central dins la closca (franja de color).',
      'Cada quadre gris és un mode permès; els de color tenen el punt central dins la closca (la franja entre les dues corbes). El quadrat discontinu és la zona de Brillouin' + (isotrop(m) ? '; el cercle discontinu, el de Debye, de la mateixa àrea.' : '.'),
      'Cubs de costat 2π/L amb el punt central dins la closca. ' + (isotrop(m) ? 'Els cercles són el contorn de les esferes q i q + dq, i el discontinu, l\'esfera de Debye.' : 'El cub discontinu és la zona de Brillouin.'),
    ][d];
    ui.descDisp.textContent = 'Cada punt gris és un mode (un quadre), dibuixat a la seva |q| i la seva ω; els de color són els de la closca. La franja horitzontal és l\'interval [ω, ω + dω]' +
      (iv ? '; la vertical, el gruix dq que li correspon, dq = dω/v_g. On la corba és plana, dq és gran.' :
        m === 'einstein' ? '. La recta és plana: totes les q hi cauen alhora.' : '. La xarxa no és isòtropa: cada direcció talla la franja amb un gruix diferent.');
    const col = MODEL[m].col;
    ui.llegDisp.innerHTML = '<span><i class="quadre" style="background:#7d8c83"></i>un punt per mode</span><span><i class="quadre" style="background:' + col + '"></i>modes de la closca</span>' +
      '<span><i class="ratlla" style="border-color:' + col + '"></i>ω(q)' + (m === 'xarxa' && d > 1 ? ' per direccions' : '') + '</span><span><i class="franja" style="background:' + rgba(m, 0.2) + '"></i>dω' + (iv ? ' i dq' : '') + '</span>';
    let lg = '<span><i class="quadre" style="background:#cbd5cf"></i>quadres comptats a cada closca</span><span><i class="quadre" style="background:' + rgba(m, 0.8) + '"></i>la closca dibuixada</span>' +
      '<span><i class="ratlla" style="border-color:' + col + '"></i>previsió contínua g(ω)·dω (' + MODEL[m].nom + ')</span>';
    if (state.comp) ORDRE.forEach(o => { if (o !== m) lg += '<span><i class="discont" style="border-color:' + MODEL[o].col + '"></i>' + MODEL[o].nom + '</span>'; });
    ui.llegG.innerHTML = lg;
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  // amb Einstein, la closca salta a la que conté ω_E
  const centraEinstein = () => {
    if (state.disp !== 'einstein') return;
    const wm = wMax('einstein', state.d), dw = state.dw * wm;
    state.w = Math.min(0.999, (Math.floor(wE(state.d) / dw + 1e-9) + 0.5) * dw / wm);
  };
  const setDim = optionGroup($('grupDim'), v => { state.d = +v; state.N = nAprop(state.d, state.N); centraEinstein(); sincronitza(); demana(); });
  const setDisp = optionGroup($('grupDisp'), v => { state.disp = v; centraEinstein(); sincronitza(); demana(); });
  function sincronitza() {
    const L = LLISTA_N[state.d];
    ui.slQ.max = L.length - 1; ui.slQ.value = L.length - 1 - L.indexOf(state.N);
    ui.slW.value = state.w; ui.slDW.value = state.dw;
    ui.chkComp.checked = state.comp; ui.chkTalla.checked = state.talla;
    ui.filaTalla.hidden = state.d !== 3;
    cQ.classList.toggle('gira', state.d === 3);
    setDim(String(state.d)); setDisp(state.disp);
    ui.notaDisp.innerHTML = NOTA[state.disp];
  }
  function etiquetes() {
    const D = TAU / state.N, wm = wMax(state.disp, state.d), [w0, w1] = limitsW();
    ui.valQ.textContent = fmt(D, 3) + '/a';
    ui.notaQ.innerHTML = 'N = ' + state.N + ' quadres per costat, L = ' + state.N + 'a: ' + Math.pow(state.N, state.d).toLocaleString('ca') + ' modes a la zona' +
      (state.d > 1 ? ' (N<sup>' + state.d + '</sup>)' : '') + '. Quadres petits volen dir un cristall gran.';
    ui.valW.textContent = fmt(w0, 3) + '–' + fmt(w1, 3) + ' ω₁';
    ui.valDW.textContent = fmt(state.dw * wm, 3) + ' ω₁';
  }
  ui.slQ.addEventListener('input', () => { const L = LLISTA_N[state.d]; state.N = L[L.length - 1 - +ui.slQ.value]; demana(); });
  ui.slW.addEventListener('input', () => { state.w = +ui.slW.value; demana(); });
  ui.slDW.addEventListener('input', () => { state.dw = +ui.slDW.value; demana(); });
  ui.chkComp.addEventListener('change', () => { state.comp = ui.chkComp.checked; demana(); });
  ui.chkTalla.addEventListener('change', () => { state.talla = ui.chkTalla.checked; demana(); });

  const coords = (c, ev) => { const r = c.getBoundingClientRect(); return [(ev.clientX - r.left) * c.width / r.width, (ev.clientY - r.top) * c.height / r.height]; };
  const posaW = w => { if (!isFinite(w)) return; state.w = Math.max(0, Math.min(0.999, w / wMax(state.disp, state.d))); ui.slW.value = state.w; demana(); };
  // espai q: tria ω (1D, 2D) o gira (3D)
  let arr = null;
  function triaQ(x, y) {
    if (state.d === 2) { const G = geomQ2(); posaW(wPunt(state.disp, 2, (x - G.cx) / G.s, -(y - G.cy) / G.s, 0)); }
    else if (state.d === 1 && geo1 && Math.abs(y - geo1.yA) < geo1.hA) posaW(wPunt(state.disp, 1, (x - geo1.x0) / geo1.sc - geo1.Q, 0, 0));
  }
  cQ.addEventListener('pointerdown', ev => { cQ.setPointerCapture(ev.pointerId); const [x, y] = coords(cQ, ev); arr = [x, y]; if (state.d < 3) triaQ(x, y); });
  cQ.addEventListener('pointermove', ev => {
    if (!arr) return;
    const [x, y] = coords(cQ, ev);
    if (state.d === 3) { state.yaw += (x - arr[0]) * 0.01; state.pitch = Math.max(-1.45, Math.min(1.45, state.pitch + (y - arr[1]) * 0.01)); arr = [x, y]; demana(); }
    else triaQ(x, y);
  });
  const deixa = () => { arr = null; };
  cQ.addEventListener('pointerup', deixa); cQ.addEventListener('pointercancel', deixa);
  // relació de dispersió: tria ω
  let arrD = false;
  const triaD = ev => { if (!pDisp) return; const [, y] = coords(cDisp, ev); posaW(pDisp.invY(y)); };
  cDisp.addEventListener('pointerdown', ev => { cDisp.setPointerCapture(ev.pointerId); arrD = true; triaD(ev); });
  cDisp.addEventListener('pointermove', ev => { if (arrD) triaD(ev); });
  cDisp.addEventListener('pointerup', () => { arrD = false; }); cDisp.addEventListener('pointercancel', () => { arrD = false; });
  // histograma: rètol i clic
  const binDe = ev => { if (!pG) return -1; const [x] = coords(cG, ev), k = Math.floor(pG.invX(x) / hist.dw); return k >= 0 && k < hist.nb ? k : -1; };
  cG.addEventListener('pointermove', ev => { const k = binDe(ev); if (k !== hoverK) { hoverK = k; demana(); } });
  cG.addEventListener('pointerleave', () => { hoverK = -1; demana(); });
  cG.addEventListener('click', ev => { const k = binDe(ev); if (k >= 0) posaW((k + 0.5) * hist.dw); });

  linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams();
    p.set('d', state.d); p.set('disp', state.disp); p.set('N', state.N); p.set('w', state.w); p.set('dw', state.dw);
    if (state.comp) p.set('comp', 1);
    if (!state.talla) p.set('talla', 0);
    if (state.d === 3) { p.set('yaw', +state.yaw.toFixed(2)); p.set('pitch', +state.pitch.toFixed(2)); }
    return p;
  });
  (function llegeixURL() {
    const p = params();
    num(p, 'd', v => { state.d = Math.round(v); }, 1, 3);
    if (p.has('disp') && MODEL[p.get('disp')]) state.disp = p.get('disp');
    num(p, 'N', v => { state.N = v; }, 1, 2000);
    state.N = nAprop(state.d, state.N);
    num(p, 'w', v => { state.w = Math.min(0.999, v); }, 0, 1);
    num(p, 'dw', v => { state.dw = v; }, 0.01, 0.25);
    num(p, 'comp', v => { state.comp = v > 0; });
    num(p, 'talla', v => { state.talla = v > 0; });
    num(p, 'yaw', v => { state.yaw = v; }, -100, 100);
    num(p, 'pitch', v => { state.pitch = v; }, -1.45, 1.45);
  })();

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  let clauDades = '', clauHist = '', pendent = false;
  function render() {
    const k1 = state.d + '|' + state.disp + '|' + state.N;
    if (k1 !== clauDades) { construeix(); clauDades = k1; clauHist = ''; }
    const k2 = k1 + '|' + state.dw;
    if (k2 !== clauHist) { histograma(); clauHist = k2; }
    triaCloscaActual();
    etiquetes();
    if (state.d === 1) dibuixaQ1(); else if (state.d === 2) dibuixaQ2(); else dibuixaQ3();
    dibuixaDisp();
    dibuixaG();
    dibuixaText();
  }
  let clauForm = '';
  function demana() {
    if (pendent) return;
    pendent = true;
    requestAnimationFrame(() => {
      pendent = false; render();
      const kf = state.d + state.disp;
      if (kf !== clauForm) { clauForm = kf; textFormules(); }
    });
  }
  sincronitza();
  render();
  textFormules(); clauForm = state.d + state.disp;
})();
