// Simulador — La matriu dinàmica en tres dimensions.
//
// Cristall cúbic amb r àtoms per cel·la (r = 1 o 2) i molles centrals k₁ (primers veïns)
// i k₂ (segons veïns). Per a un parell d'àtoms units per d, la constant de força és
// Φ = −k d̂d̂ᵀ, i la matriu dinàmica (3r × 3r, hermítica)
//   D_{κα,κ'β}(q) = (1/√(MκMκ')) [ δ_{κκ'} Σ_b k_b d̂_α d̂_β  −  Σ_{b: κ→κ'} k_b d̂_α d̂_β e^{iq·d_b} ]
// Els valors propis són ω². Es diagonalitza amb Jacobi sobre la matriu real 6r × 6r
// [[Re, −Im], [Im, Re]], que té els mateixos valors propis per duplicat.
// Unitats: M en kg, k en N/m, q en 2π/a, d en a → ω en rad/s, es mostra ν = ω/2π en THz.

(function () {
  'use strict';
  const { fmt, sig, Plot } = Din;
  const TAU = Din.TAU;
  const U = 1.66054e-27;
  const COL_L = [214, 39, 40], COL_T = [41, 128, 185];

  const PRIM = {
    sc: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    bcc: [[-0.5, 0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, -0.5]],
    fcc: [[0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]]
  };
  const EST = {
    sc: { nom: 'Cúbica simple (1 àtom)', lat: 'sc', base: [[0, 0, 0]], mat: 'sc' },
    bcc: { nom: 'BCC (1 àtom)', lat: 'bcc', base: [[0, 0, 0]], mat: 'W' },
    fcc: { nom: 'FCC (1 àtom)', lat: 'fcc', base: [[0, 0, 0]], mat: 'Cu' },
    cscl: { nom: 'Clorur de cesi (2 àtoms)', lat: 'sc', base: [[0, 0, 0], [0.5, 0.5, 0.5]], mat: 'CsCl' },
    nacl: { nom: 'Clorur de sodi (2 àtoms)', lat: 'fcc', base: [[0, 0, 0], [0.5, 0, 0]], mat: 'NaCl' },
    diamant: { nom: 'Diamant / blenda (2 àtoms)', lat: 'fcc', base: [[0, 0, 0], [0.25, 0.25, 0.25]], mat: 'C' }
  };
  // camins a la zona de Brillouin, en unitats de 2π/a
  const CAMI = {
    sc: [['Γ', [0, 0, 0]], ['X', [0.5, 0, 0]], ['M', [0.5, 0.5, 0]], ['Γ', [0, 0, 0]], ['R', [0.5, 0.5, 0.5]]],
    bcc: [['Γ', [0, 0, 0]], ['H', [1, 0, 0]], ['N', [0.5, 0.5, 0]], ['Γ', [0, 0, 0]], ['P', [0.5, 0.5, 0.5]], ['H', [1, 0, 0]]],
    fcc: [['Γ', [0, 0, 0]], ['X', [1, 0, 0]], ['W', [1, 0.5, 0]], ['L', [0.5, 0.5, 0.5]], ['Γ', [0, 0, 0]], ['K', [0.75, 0.75, 0]]]
  };
  // k₁ i k₂ ajustats a C₄₄ i a (C₁₁ − C₁₂)/2 (metalls), a C₁₁ i C₄₄ (NaCl) o a ν_opt(Γ) i C₄₄ (diamant, Si)
  const MAT = {
    Cu: { nom: 'Coure', est: 'fcc', M1: 63.546, M2: 63.546, a: 3.615, k1: 27.3, k2: 0, exp: { C11: 168.4, C12: 121.4, C44: 75.4 }, nota: 'k₁ = C₄₄·a. Amb només primers veïns, C₁₁ = 2k₁/a i C₁₂ = C₄₄ = k₁/a.' },
    Al: { nom: 'Alumini', est: 'fcc', M1: 26.982, M2: 26.982, a: 4.05, k1: 11.5, k2: 1.9, exp: { C11: 108.2, C12: 61.3, C44: 28.5 }, nota: 'k₁ i k₂ ajustats a C₄₄ i a (C₁₁ − C₁₂)/2.' },
    W: { nom: 'Tungstè', est: 'bcc', M1: 183.84, M2: 183.84, a: 3.165, k1: 76.0, k2: 50.6, exp: { C11: 523, C12: 203, C44: 160 }, nota: 'k₁ i k₂ ajustats a C₄₄ i a (C₁₁ − C₁₂)/2. A la BCC calen els segons veïns (a distància a) perquè el cristall sigui estable.' },
    Fe: { nom: 'Ferro α', est: 'bcc', M1: 55.845, M2: 55.845, a: 2.866, k1: 50.3, k2: 13.6, exp: { C11: 230, C12: 135, C44: 117 }, nota: 'k₁ i k₂ ajustats a C₄₄ i a (C₁₁ − C₁₂)/2.' },
    NaCl: { nom: 'Clorur de sodi', est: 'nacl', M1: 22.99, M2: 35.45, a: 5.64, k1: 6.63, k2: 3.61, exp: { C11: 49.1, C12: 12.8, C44: 12.8 }, nota: 'k₁ (Na–Cl) i k₂ (Cl–Cl i Na–Na, a a/√2) ajustats a C₁₁ i C₄₄. El model no té forces de Coulomb de llarg abast: no separa els òptics L i T.' },
    CsCl: { nom: 'Clorur de cesi', est: 'cscl', M1: 132.905, M2: 35.45, a: 4.123, k1: 8, k2: 2, nota: 'Valors de k orientatius.' },
    C: { nom: 'Diamant', est: 'diamant', M1: 12.011, M2: 12.011, a: 3.567, k1: 470, k2: 103, exp: { C11: 1079, C12: 124, C44: 578 }, nota: 'k₁ ajustada a ν_opt(Γ) = 39.9 THz (Raman) i k₂ a C₄₄. Les molles centrals no descriuen bé un enllaç covalent (que resisteix la flexió): C₁₁ i C₁₂ surten massa grans.' },
    Si: { nom: 'Silici', est: 'diamant', M1: 28.085, M2: 28.085, a: 5.431, k1: 166, k2: 21.6, exp: { C11: 165.7, C12: 63.9, C44: 79.6 }, nota: 'k₁ ajustada a ν_opt(Γ) = 15.5 THz (Raman) i k₂ a C₄₄.' },
    sc: { nom: 'Genèric cúbic simple', est: 'sc', M1: 50, M2: 50, a: 3, k1: 30, k2: 10, nota: 'Cap element cristal·litza en cúbica simple (només el poloni): valors orientatius.' }
  };
  const state = { est: 'fcc', mat: 'Cu', M1: 63.546, M2: 63.546, a: 3.615, k1: 27.3, k2: 0, s: 0.25, nomes100: false, car: true, dibK2: true, molles: true, rot: [0.5, -0.6] };

  // ---------------------------------------------------------------
  // Geometria: veïns i molles
  // ---------------------------------------------------------------
  let BONDS = [], R = 1, VPRIM = 1, SHELL = [1, 1];
  const norm = v => Math.hypot(v[0], v[1], v[2]);
  const det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  function geometria() {
    const e = EST[state.est], P = PRIM[e.lat], base = e.base;
    R = base.length; VPRIM = Math.abs(det3(P));
    const L = [];
    for (let k = 0; k < R; k++) for (let kp = 0; kp < R; kp++)
      for (let n1 = -3; n1 <= 3; n1++) for (let n2 = -3; n2 <= 3; n2++) for (let n3 = -3; n3 <= 3; n3++) {
        const d = [0, 1, 2].map(i => n1 * P[0][i] + n2 * P[1][i] + n3 * P[2][i] + base[kp][i] - base[k][i]);
        const r = norm(d);
        if (r > 1e-9) L.push({ k, kp, d, r });
      }
    const rs = [...new Set(L.map(b => +b.r.toFixed(6)))].sort((a, b) => a - b);
    SHELL = [rs[0], rs[1]];
    BONDS = [];
    L.forEach(b => {
      const s = Math.abs(b.r - rs[0]) < 1e-6 ? 1 : Math.abs(b.r - rs[1]) < 1e-6 ? 2 : 0;
      if (s) BONDS.push({ k: b.k, kp: b.kp, d: b.d, s, dh: b.d.map(x => x / b.r) });
    });
  }
  const masses = () => R === 1 ? [state.M1 * U] : [state.M1 * U, state.M2 * U];
  const rho = () => masses().reduce((a, b) => a + b, 0) / (VPRIM * Math.pow(state.a * 1e-10, 3));

  // ---------------------------------------------------------------
  // Àlgebra: Jacobi per a matrius simètriques reals, i hermítiques via [[Re,−Im],[Im,Re]]
  // ---------------------------------------------------------------
  function jacobi(A) {
    const n = A.length, a = A.map(r => r.slice()), V = [];
    for (let i = 0; i < n; i++) { V.push(new Array(n).fill(0)); V[i][i] = 1; }
    let scale = 1e-300; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) scale = Math.max(scale, Math.abs(a[i][j]));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
      if (off < 1e-28 * scale * scale) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15 * scale) continue;
        const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
        for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = [...Array(n).keys()].sort((i, j) => a[i][i] - a[j][j]);
    return { val: idx.map(i => a[i][i]), vec: idx.map(i => V.map(r => r[i])) };
  }
  function eigHerm(Re, Im) {
    const n = Re.length, A = [];
    for (let i = 0; i < 2 * n; i++) A.push(new Array(2 * n).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { A[i][j] = Re[i][j]; A[i + n][j + n] = Re[i][j]; A[i][j + n] = -Im[i][j]; A[i + n][j] = Im[i][j]; }
    const e = jacobi(A), val = [], vec = [];
    for (let k = 0; k < 2 * n; k += 2) {
      val.push(e.val[k]);
      const v = e.vec[k], re = v.slice(0, n), im = v.slice(n);
      const nn = Math.sqrt(re.reduce((s, x, i) => s + x * x + im[i] * im[i], 0)) || 1;
      vec.push({ re: re.map(x => x / nn), im: im.map(x => x / nn) });
    }
    return { val, vec };
  }

  // ---------------------------------------------------------------
  // Matriu dinàmica
  // ---------------------------------------------------------------
  function buildD(qv) {
    const n = 3 * R, M = masses(), Re = [], Im = [];
    for (let i = 0; i < n; i++) { Re.push(new Array(n).fill(0)); Im.push(new Array(n).fill(0)); }
    for (const b of BONDS) {
      const k = b.s === 1 ? state.k1 : state.k2;
      if (!k) continue;
      const ph = TAU * (qv[0] * b.d[0] + qv[1] * b.d[1] + qv[2] * b.d[2]), c = Math.cos(ph), s = Math.sin(ph), m = 1 / Math.sqrt(M[b.k] * M[b.kp]);
      for (let al = 0; al < 3; al++) for (let be = 0; be < 3; be++) {
        const v = k * b.dh[al] * b.dh[be];
        Re[3 * b.k + al][3 * b.k + be] += v / M[b.k];
        Re[3 * b.k + al][3 * b.kp + be] -= v * c * m;
        Im[3 * b.k + al][3 * b.kp + be] -= v * s * m;
      }
    }
    return { Re, Im };
  }
  const nuOf = w2 => Math.sign(w2) * Math.sqrt(Math.abs(w2)) / TAU / 1e12;
  // caràcters d'un vector propi: fracció longitudinal, fracció del centre de masses, amplituds per àtom
  function caracter(v, qh) {
    const M = masses();
    let L = 0, cmR = [0, 0, 0], cmI = [0, 0, 0], amp = [];
    for (let k = 0; k < R; k++) {
      let dr = 0, di = 0, a2 = 0;
      for (let al = 0; al < 3; al++) {
        dr += v.re[3 * k + al] * qh[al]; di += v.im[3 * k + al] * qh[al];
        a2 += v.re[3 * k + al] ** 2 + v.im[3 * k + al] ** 2;
        cmR[al] += Math.sqrt(M[k]) * v.re[3 * k + al]; cmI[al] += Math.sqrt(M[k]) * v.im[3 * k + al];
      }
      L += dr * dr + di * di;
      amp.push(Math.sqrt(a2) / Math.sqrt(M[k]));
    }
    const Mt = M.reduce((a, b) => a + b, 0);
    const cm = (cmR[0] ** 2 + cmR[1] ** 2 + cmR[2] ** 2 + cmI[0] ** 2 + cmI[1] ** 2 + cmI[2] ** 2) / Mt;
    return { L, cm, amp };
  }
  function modes(qv, qh) {
    const { Re, Im } = buildD(qv), e = eigHerm(Re, Im);
    return e.val.map((w2, i) => Object.assign({ w2, nu: nuOf(w2) }, caracter(e.vec[i], qh)));
  }

  // ---------------------------------------------------------------
  // Camí i bandes
  // ---------------------------------------------------------------
  let CAM = [], SEG = [], TOTAL = 1, BANDES = [], NUMAX = 1, NUMIN = 0;
  function cami() {
    const c = CAMI[EST[state.est].lat];
    CAM = state.nomes100 ? [c[0], c[1]] : c;
    SEG = []; TOTAL = 0;
    for (let i = 0; i < CAM.length - 1; i++) {
      const a = CAM[i][1], b = CAM[i + 1][1], len = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      SEG.push({ s0: TOTAL, len, a, b, dir: [0, 1, 2].map(j => (b[j] - a[j]) / len) });
      TOTAL += len;
    }
  }
  function qDeS(s) {   // s ∈ [0,1] del camí → {q, qh}
    if (state.qFix) { const q = state.qFix, nq = norm(q); return { q, qh: nq > 1e-9 ? q.map(x => x / nq) : [1, 0, 0], t: s * TOTAL }; }
    const t = s * TOTAL;
    let seg = SEG[SEG.length - 1];
    for (const g of SEG) if (t <= g.s0 + g.len + 1e-12) { seg = g; break; }
    const u = Math.min(1, Math.max(0, (t - seg.s0) / seg.len));
    const q = [0, 1, 2].map(j => seg.a[j] + u * (seg.b[j] - seg.a[j]));
    const nq = norm(q);
    return { q, qh: nq > 1e-9 ? q.map(x => x / nq) : seg.dir, t };
  }
  function bandes() {
    BANDES = []; NUMAX = 0; NUMIN = 0;
    const NP = state.nomes100 ? 120 : 300;
    for (const g of SEG) {
      const np = Math.max(16, Math.round(NP * g.len / TOTAL));
      for (let i = 0; i <= np; i++) {
        const u = i / np, q = [0, 1, 2].map(j => g.a[j] + u * (g.b[j] - g.a[j])), nq = norm(q);
        const qh = nq > 1e-9 ? q.map(x => x / nq) : g.dir;
        const m = modes(q, qh);
        BANDES.push({ t: g.s0 + u * g.len, m });
        m.forEach(x => { NUMAX = Math.max(NUMAX, x.nu); NUMIN = Math.min(NUMIN, x.nu); });
      }
    }
    if (NUMAX < 1e-6) NUMAX = 1;
  }

  // ---------------------------------------------------------------
  // Dibuix de les bandes
  // ---------------------------------------------------------------
  const cB = document.getElementById('canvasBandes');
  const mix = f => 'rgb(' + COL_T.map((c, i) => Math.round(c + (COL_L[i] - c) * f)).join(',') + ')';
  function drawBandes() {
    const p = Plot(cB, { xmin: 0, xmax: TOTAL, ymin: Math.min(0, NUMIN * 1.05), ymax: NUMAX * 1.08, m: { l: 50, r: 14, t: 14, b: 32 } });
    p.clear();
    const ticks = [], labels = {};
    CAM.forEach((c, i) => { const t = i < SEG.length ? SEG[i].s0 : TOTAL; ticks.push(t); labels[+t.toFixed(9)] = c[0]; });
    p.axes('', 'ν (THz)', { xticks: ticks, xfmt: v => labels[+v.toFixed(9)] || '' });
    ticks.forEach(t => p.vline(t, { col: '#bbb', w: 1 }));
    p.clip();
    const g = p.g; g.lineWidth = 2.2; g.lineCap = 'round';
    for (let j = 0; j < 3 * R; j++) {
      for (let i = 1; i < BANDES.length; i++) {
        const A = BANDES[i - 1], B = BANDES[i];
        if (B.t < A.t) continue;   // salt entre segments (mateix t) es dibuixa igual
        g.strokeStyle = state.car ? mix((A.m[j].L + B.m[j].L) / 2) : (j < 3 ? '#2980b9' : '#d62728');
        g.beginPath(); g.moveTo(p.X(A.t), p.Y(A.m[j].nu)); g.lineTo(p.X(B.t), p.Y(B.m[j].nu)); g.stroke();
      }
    }
    p.unclip();
    const { t } = qDeS(state.s);
    p.vline(t, { col: '#333', w: 1, dash: [3, 3] });
    const cur = modesActuals();
    cur.forEach(m => p.dot(t, m.nu, state.car ? mix(m.L) : '#333', 5));
    if (state.car) p.legend([{ nom: 'longitudinal', col: mix(1), w: 2.2 }, { nom: 'transversal', col: mix(0), w: 2.2 }], { left: true });
    else p.legend([{ nom: 'acústiques', col: '#2980b9', w: 2.2 }, { nom: 'òptiques', col: '#d62728', w: 2.2 }], { left: true });
    g.fillStyle = '#555'; g.font = '11px sans-serif'; g.textAlign = 'right';
    g.fillText((MAT[state.mat] ? MAT[state.mat].nom : EST[state.est].nom) + ' · ' + (3 * R) + ' branques (' + 3 + ' acústiques + ' + (3 * R - 3) + ' òptiques)', cB.width - 16, 14);
    // clic → s
    if (!cB.__drag) {
      cB.__drag = true;
      p.onDrag((x) => { state.s = Math.min(1, Math.max(0, x / TOTAL)); render(false); });
      cB.style.cursor = 'crosshair';
    }
  }
  let cacheS = null, cacheM = null;
  function modesActuals() {
    if (cacheS === state.s && cacheM) return cacheM;
    const { q, qh } = qDeS(state.s); cacheS = state.s; cacheM = modes(q, qh); return cacheM;
  }

  // ---------------------------------------------------------------
  // La matriu
  // ---------------------------------------------------------------
  const cM = document.getElementById('canvasMatriu'), gM = cM.getContext('2d');
  function drawMatriu() {
    const W = cM.width, H = cM.height;
    gM.clearRect(0, 0, W, H);
    const { q } = qDeS(state.s), { Re, Im } = buildD(q), n = 3 * R, sc = 1 / (TAU * 1e12) ** 2;
    const x0 = 44, y0 = 40, cell = (W - x0 - 10) / n;
    let vmax = 1e-30; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) vmax = Math.max(vmax, Math.abs(Re[i][j]), Math.abs(Im[i][j]));
    const lab = i => (R > 1 ? (Math.floor(i / 3) + 1) : '') + 'xyz'[i % 3];
    gM.font = '11px sans-serif'; gM.fillStyle = '#555'; gM.textAlign = 'center';
    for (let i = 0; i < n; i++) { gM.fillText(lab(i), x0 + cell * (i + 0.5), y0 - 6); gM.textAlign = 'right'; gM.fillText(lab(i), x0 - 6, y0 + cell * (i + 0.5) + 4); gM.textAlign = 'center'; }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = Re[i][j] / vmax, w = Im[i][j] / vmax;
      gM.fillStyle = v >= 0 ? 'rgba(214,39,40,' + (0.08 + 0.75 * Math.abs(v)) + ')' : 'rgba(41,128,185,' + (0.08 + 0.75 * Math.abs(v)) + ')';
      if (Math.abs(v) < 1e-6 && Math.abs(w) < 1e-6) gM.fillStyle = '#f4f6f4';
      gM.fillRect(x0 + cell * j, y0 + cell * i, cell - 1, cell - 1);
      gM.fillStyle = Math.abs(v) > 0.45 ? '#fff' : '#222'; gM.font = (n > 3 ? '10px' : '13px') + ' sans-serif';
      gM.fillText(Math.abs(v) < 1e-6 ? '0' : sig(Re[i][j] * sc, 3), x0 + cell * (j + 0.5), y0 + cell * (i + 0.5) + (Math.abs(w) > 1e-6 ? -2 : 4));
      if (Math.abs(w) > 1e-6) { gM.font = (n > 3 ? '9px' : '11px') + ' sans-serif'; gM.fillText((Im[i][j] >= 0 ? '+' : '−') + sig(Math.abs(Im[i][j]) * sc, 2) + 'i', x0 + cell * (j + 0.5), y0 + cell * (i + 0.5) + 10); }
    }
    gM.fillStyle = '#555'; gM.font = '11px sans-serif'; gM.textAlign = 'left';
    gM.fillText('D(q) en (2π·THz)²,  q = (' + q.map(x => fmt(x, 2)).join(', ') + ') 2π/a', 8, H - 8);
  }

  // ---------------------------------------------------------------
  // La cel·la
  // ---------------------------------------------------------------
  const cC = document.getElementById('canvasCella'), gC = cC.getContext('2d');
  function atomsCella() {
    const e = EST[state.est], P = PRIM[e.lat], out = [];
    for (let k = 0; k < R; k++) for (let n1 = -2; n1 <= 2; n1++) for (let n2 = -2; n2 <= 2; n2++) for (let n3 = -2; n3 <= 2; n3++) {
      const r = [0, 1, 2].map(i => n1 * P[0][i] + n2 * P[1][i] + n3 * P[2][i] + e.base[k][i]);
      if (r.every(x => x > -1e-6 && x < 1 + 1e-6)) out.push({ k, r });
    }
    return out;
  }
  function drawCella() {
    const W = cC.width, H = cC.height;
    gC.clearRect(0, 0, W, H);
    const [ax, ay] = state.rot, ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay);
    const S = 150, cx = W / 2, cy = H / 2 + 6;
    const proj = r => {
      const x = r[0] - 0.5, y = r[1] - 0.5, z = r[2] - 0.5;
      const x1 = cb * x + sb * z, z1 = -sb * x + cb * z;
      const y2 = ca * y - sa * z1, z2 = sa * y + ca * z1;
      return { X: cx + S * x1, Y: cy - S * y2, Z: z2 };
    };
    // aresta de la cel·la
    const V = []; for (let i = 0; i < 8; i++) V.push([i & 1, (i >> 1) & 1, (i >> 2) & 1]);
    gC.strokeStyle = '#bbb'; gC.lineWidth = 1;
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if ([0, 1, 2].reduce((s, k) => s + Math.abs(V[i][k] - V[j][k]), 0) === 1) { const a = proj(V[i]), b = proj(V[j]); gC.beginPath(); gC.moveTo(a.X, a.Y); gC.lineTo(b.X, b.Y); gC.stroke(); }
    const at = atomsCella();
    // molles k₁ entre àtoms de la cel·la
    if (state.molles) {
      const d1 = SHELL[0];
      gC.strokeStyle = '#7a8a80'; gC.lineWidth = 1.6;
      for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
        const d = norm([at[i].r[0] - at[j].r[0], at[i].r[1] - at[j].r[1], at[i].r[2] - at[j].r[2]]);
        if (Math.abs(d - d1) < 1e-6) { const a = proj(at[i].r), b = proj(at[j].r); gC.beginPath(); gC.moveTo(a.X, a.Y); gC.lineTo(b.X, b.Y); gC.stroke(); }
      }
    }
    // molles k₂ des de l'àtom més proper al centre
    let ref = at[0], best = 9;
    at.forEach(a => { const d = norm([a.r[0] - 0.5, a.r[1] - 0.5, a.r[2] - 0.5]); if (d < best) { best = d; ref = a; } });
    const fantasma = [];
    if (state.molles && state.dibK2 && state.k2 > 0) {
      gC.strokeStyle = '#d9822b'; gC.lineWidth = 1.2; gC.setLineDash([4, 3]);
      BONDS.filter(b => b.s === 2 && b.k === ref.k).forEach(b => {
        const r2 = [0, 1, 2].map(i => ref.r[i] + b.d[i]), a = proj(ref.r), c = proj(r2);
        gC.beginPath(); gC.moveTo(a.X, a.Y); gC.lineTo(c.X, c.Y); gC.stroke();
        if (!r2.every(x => x > -1e-6 && x < 1 + 1e-6)) fantasma.push({ k: b.kp, r: r2, fant: true });
      });
      gC.setLineDash([]);
    }
    // àtoms, de darrere a davant
    const tots = at.concat(fantasma).map(a => Object.assign({ p: proj(a.r) }, a)).sort((a, b) => a.p.Z - b.p.Z);
    tots.forEach(a => {
      const r = (a.k === 0 ? 9 : 7) * (1 + 0.25 * a.p.Z);
      gC.fillStyle = a.fant ? 'rgba(200,200,200,0.5)' : (a.k === 0 ? '#1f7a3f' : '#d9822b');
      gC.beginPath(); gC.arc(a.p.X, a.p.Y, r, 0, TAU); gC.fill();
      if (!a.fant) { gC.strokeStyle = 'rgba(0,0,0,0.25)'; gC.lineWidth = 1; gC.stroke(); }
    });
    gC.fillStyle = '#555'; gC.font = '11px sans-serif'; gC.textAlign = 'left';
    if (state.molles) {
      gC.fillText(EST[state.est].nom + ' · primers veïns a ' + fmt(SHELL[0] * state.a, 3) + ' Å, segons a ' + fmt(SHELL[1] * state.a, 3) + ' Å', 8, 14);
      gC.fillText('àtom 1 (verd, M₁)' + (R > 1 ? ' · àtom 2 (taronja, M₂)' : ''), 8, H - 8);
    } else {
      gC.fillText(EST[state.est].nom.replace(/ \(.*/, '') + (R > 1 ? ' · base de 2 àtoms (verd i taronja)' : ''), 8, H - 8);
    }
  }
  (function dragCella() {
    let on = false, last = null;
    cC.addEventListener('mousedown', ev => { on = true; last = [ev.clientX, ev.clientY]; });
    window.addEventListener('mousemove', ev => { if (!on) return; state.rot[1] += (ev.clientX - last[0]) * 0.01; state.rot[0] += (ev.clientY - last[1]) * 0.01; last = [ev.clientX, ev.clientY]; drawCella(); });
    window.addEventListener('mouseup', () => { on = false; });
  })();

  // ---------------------------------------------------------------
  // Constants elàstiques del model
  // ---------------------------------------------------------------
  function elastiques() {
    const eps = 1e-4, a = state.a * 1e-10, qsi = TAU * eps / a, r = rho();
    const m100 = modes([eps, 0, 0], [1, 0, 0]);
    const vT = Math.sqrt(Math.max(0, m100[0].w2)) / qsi, vL = Math.sqrt(Math.max(0, m100[2].w2)) / qsi;
    const C11 = r * vL * vL, C44 = r * vT * vT;
    const qh = [1 / Math.SQRT2, 1 / Math.SQRT2, 0];
    const { Re, Im } = buildD([eps / Math.SQRT2, eps / Math.SQRT2, 0]), e = eigHerm(Re, Im);
    let vTi = 0;
    for (let i = 0; i < 3; i++) {
      let ez = 0, eq = 0;
      for (let k = 0; k < R; k++) {
        ez += e.vec[i].re[3 * k + 2] ** 2 + e.vec[i].im[3 * k + 2] ** 2;
        const dr = e.vec[i].re[3 * k] * qh[0] + e.vec[i].re[3 * k + 1] * qh[1], di = e.vec[i].im[3 * k] * qh[0] + e.vec[i].im[3 * k + 1] * qh[1];
        eq += dr * dr + di * di;
      }
      if (ez < 0.5 && eq < 0.5) vTi = Math.sqrt(Math.max(0, e.val[i])) / qsi;
    }
    const C12 = C11 - 2 * r * vTi * vTi;
    return { vL, vT, C11: C11 / 1e9, C12: C12 / 1e9, C44: C44 / 1e9, rho: r };
  }

  // ---------------------------------------------------------------
  // Fórmules, taula i lectures
  // ---------------------------------------------------------------
  function drawText() {
    const el = elastiques(), m = MAT[state.mat], cur = modesActuals(), { q, qh } = qDeS(state.s);
    const Mkg = masses()[0];
    const rows = [
      { nom: 'Matriu dinàmica (r àtoms per cel·la, 3r × 3r)', tex: [
        'D_{\\kappa\\alpha,\\kappa\'\\beta}(\\mathbf q)=\\frac{1}{\\sqrt{M_\\kappa M_{\\kappa\'}}}\\sum_{\\mathbf R}\\Phi_{\\kappa\\alpha,\\kappa\'\\beta}(\\mathbf R)\\,e^{i\\mathbf q\\cdot(\\mathbf R+\\boldsymbol\\tau_{\\kappa\'}-\\boldsymbol\\tau_\\kappa)},\\qquad D(\\mathbf q)\\,\\mathbf e=\\omega^2\\,\\mathbf e'] },
      { nom: 'Molles centrals', tex: [
        '\\Phi_{\\alpha\\beta}(\\text{parell a distància } \\mathbf d)=-k\\,\\hat d_\\alpha\\hat d_\\beta,\\qquad \\Phi_{\\kappa\\alpha,\\kappa\\beta}(\\mathbf 0)=\\sum_{\\text{veïns}}k\\,\\hat d_\\alpha\\hat d_\\beta\\ \\ \\text{(regla de suma acústica)}'] },
      { nom: 'Nombre de branques', actiu: true, tex: [
        '3r=' + (3 * R) + ':\\quad 3\\ \\text{acústiques}\\ (\\omega\\to0\\ \\text{a}\\ \\Gamma)\\ +\\ 3(r-1)=' + (3 * R - 3) + '\\ \\text{òptiques}'] },
      { nom: 'Del pendent a Γ a les constants elàstiques (Tema 3)', tex: [
        'C_{11}=\\rho v_L^2[100]=' + fmt(el.C11, 0) + ',\\quad C_{44}=\\rho v_T^2[100]=' + fmt(el.C44, 0) + ',\\quad \\tfrac12(C_{11}-C_{12})=\\rho v_{T\'}^2[110]\\ \\Rightarrow\\ C_{12}=' + fmt(el.C12, 0) + '\\ \\text{GPa}' + (m && m.exp ? '\\quad(\\text{exp.: }' + m.exp.C11 + ',\\ ' + m.exp.C44 + ',\\ ' + m.exp.C12 + ')' : '')],
        nota: 'Amb molles centrals, C₁₂ = C₄₄ sempre (relació de Cauchy).' }
    ];
    if (state.est === 'fcc' && state.k2 === 0) rows.push({ nom: 'FCC amb primers veïns, direcció [100] (analític)', tex: [
      '\\omega_L^2=\\frac{8k_1}{M}\\sin^2\\frac{qa}{4},\\qquad \\omega_T^2=\\frac{4k_1}{M}\\sin^2\\frac{qa}{4}\\ \\Rightarrow\\ \\nu_L(X)=' + fmt(Math.sqrt(8 * state.k1 / Mkg) / TAU / 1e12, 2) + ',\\ \\nu_T(X)=' + fmt(Math.sqrt(4 * state.k1 / Mkg) / TAU / 1e12, 2) + '\\ \\text{THz}',
      'C_{11}=\\frac{2k_1}{a},\\qquad C_{12}=C_{44}=\\frac{k_1}{a}'] });
    Din.formulas(document.getElementById('formules'), rows);

    document.getElementById('modesBody').innerHTML = cur.map((x, i) => {
      const tip = x.L > 0.9 ? 'L' : x.L < 0.1 ? 'T' : 'mixt';
      return '<tr><td class="esq">' + (i + 1) + (i < 3 ? ' (acústica)' : ' (òptica)') + '</td><td>' + fmt(x.nu, 3) + '</td><td>' + tip + '</td><td>' + fmt(x.L, 2) + '</td><td>' + fmt(x.cm, 2) + '</td><td>' +
        (R > 1 ? fmt(x.amp[0] / Math.max(x.amp[0], x.amp[1]), 2) + ' : ' + fmt(x.amp[1] / Math.max(x.amp[0], x.amp[1]), 2) : '—') + '</td></tr>';
    }).join('');

    const lect = [['estructura', EST[state.est].nom], ['material', m ? m.nom : 'personalitzat']];
    lect.push(['àtoms per cel·la', String(R)]);
    lect.push(['branques', (3 * R) + ' = 3 ac. + ' + (3 * R - 3) + ' òpt.']);
    lect.push(['q', '(' + q.map(x => fmt(x, 2)).join(', ') + ') 2π/a']);
    lect.push(['ρ', fmt(el.rho, 0) + ' kg/m³']);
    lect.push(['v_L, v_T [100]', fmt(el.vL / 1000, 2) + ', ' + fmt(el.vT / 1000, 2) + ' km/s']);
    lect.push(['C₁₁, C₁₂, C₄₄', fmt(el.C11, 0) + ', ' + fmt(el.C12, 0) + ', ' + fmt(el.C44, 0) + ' GPa']);
    if (m && m.exp) lect.push(['experimentals', m.exp.C11 + ', ' + m.exp.C12 + ', ' + m.exp.C44 + ' GPa']);
    lect.push(['ν_max', fmt(NUMAX, 2) + ' THz']);
    if (R > 1) lect.push(['ν òptica a Γ', fmt(modes([1e-6, 0, 0], [1, 0, 0])[3].nu, 2) + ' THz']);
    Din.readout(document.getElementById('lectura'), lect);
    document.getElementById('notaMat').textContent = m ? m.nota : '';
    const est = document.getElementById('estat');
    if (NUMIN < -1e-3) { est.className = 'estat no'; est.textContent = 'Inestable: hi ha ω² negatives. La xarxa es deformaria espontàniament amb aquestes molles.'; }
    else if (el.vT < 1) { est.className = 'estat no'; est.textContent = 'Les ones transversals [100] tenen velocitat zero: amb aquestes molles, cisallar el cristall no costa res. Cal k₂ (segons veïns).'; }
    else { est.className = 'estat si'; est.textContent = 'Cristall estable: ' + (3 * R) + ' branques, totes amb ω² ≥ 0.'; }
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const SL = [['M1', 'M₁ (u)', 1, 250, 0.1], ['M2', 'M₂ (u)', 1, 250, 0.1], ['a', 'a (Å)', 2, 7, 0.005], ['k1', 'k₁ (N/m)', 0, 600, 0.1], ['k2', 'k₂ (N/m)', 0, 200, 0.1]];
  $('sliders').innerHTML = SL.map(([k, lab, lo, hi, st]) =>
    '<div class="control-group"><label class="control-label" for="s_' + k + '">' + lab + ' <span class="val" id="v_' + k + '"></span></label>' +
    '<input type="range" class="slider" id="s_' + k + '" min="' + lo + '" max="' + hi + '" step="' + st + '"></div>').join('');
  SL.forEach(([k]) => $('s_' + k).addEventListener('input', ev => { state[k] = +ev.target.value; state.mat = ''; $('selMat').value = ''; render(true); }));
  $('selEst').innerHTML = Object.entries(EST).map(([k, e]) => '<option value="' + k + '">' + e.nom + '</option>').join('');
  $('selMat').innerHTML = Object.entries(MAT).map(([k, m]) => '<option value="' + k + '">' + m.nom + ' (' + EST[m.est].nom.split(' (')[0] + ')</option>').join('') + '<option value="" disabled>Personalitzat</option>';
  function loadMat(k) { const m = MAT[k]; if (!m) return; state.mat = k; state.est = m.est; Object.assign(state, { M1: m.M1, M2: m.M2, a: m.a, k1: m.k1, k2: m.k2 }); }
  $('selEst').addEventListener('change', () => { loadMat(EST[$('selEst').value].mat); state.est = $('selEst').value; render(true); });
  $('selMat').addEventListener('change', () => { loadMat($('selMat').value); render(true); });
  $('slS').addEventListener('input', () => { state.s = +$('slS').value; render(false); });
  $('chkNomes100').addEventListener('change', () => { state.nomes100 = $('chkNomes100').checked; render(true); });
  $('chkCar').addEventListener('change', () => { state.car = $('chkCar').checked; render(false); });
  $('chkK2').addEventListener('change', () => { state.dibK2 = $('chkK2').checked; drawCella(); });
  $('grupPunts').addEventListener('click', ev => { const b = ev.target.closest('[data-s]'); if (b) { state.s = +b.dataset.s; render(false); } });

  function render(tot) {
    SL.forEach(([k]) => { $('s_' + k).value = state[k]; $('v_' + k).textContent = fmt(state[k], 2); });
    $('s_M2').disabled = R === 1 && !tot;
    $('selEst').value = state.est; $('selMat').value = state.mat;
    $('chkNomes100').checked = state.nomes100; $('chkCar').checked = state.car; $('chkK2').checked = state.dibK2;
    if (tot) {
      geometria(); cami(); bandes(); cacheS = null;
      $('s_M2').disabled = R === 1;
      $('grupPunts').innerHTML = CAM.map((c, i) => '<button type="button" class="btn-opcio" data-s="' + ((i < SEG.length ? SEG[i].s0 : TOTAL) / TOTAL).toFixed(4) + '">' + c[0] + '</button>').join('');
    }
    cacheS = null;
    $('slS').value = state.s; $('valS').textContent = fmt(state.s, 2);
    drawBandes(); drawMatriu(); drawCella(); drawText();
  }
  Din.linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams();
    p.set('est', state.est);
    if (state.mat) p.set('mat', state.mat); else ['M1', 'M2', 'a', 'k1', 'k2'].forEach(k => p.set(k, state[k]));
    p.set('s', +state.s.toFixed(3));
    if (state.nomes100) p.set('nomes100', 1); if (!state.car) p.set('car', 0);
    return p;
  });
  (function fromURL() {
    const p = Din.params();
    if (EST[p.get('est')]) { state.est = p.get('est'); loadMat(EST[state.est].mat); }
    if (MAT[p.get('mat')]) loadMat(p.get('mat'));
    let custom = false;
    ['M1', 'M2', 'a', 'k1', 'k2'].forEach(k => Din.num(p, k, x => { state[k] = x; custom = true; }, 0));
    if (custom) state.mat = '';
    Din.num(p, 's', x => { state.s = x; }, 0, 1);
    // ?qfix=qx,qy,qz (en 2π/a): avalua la matriu i els modes en un q arbitrari, fora del camí
    if (p.has('qfix')) { const v = p.get('qfix').split(',').map(Number); if (v.length === 3 && v.every(isFinite)) state.qFix = v; }
    if (p.get('nomes100') === '1') state.nomes100 = true;
    if (p.get('car') === '0') state.car = false;
    if (p.get('molles') === '0') state.molles = false;
    if (!state.molles) { const t = cC.parentElement.querySelector('.plot-title'); if (t) t.textContent = 'La cel·la'; }
    render(true);
  })();
})();
