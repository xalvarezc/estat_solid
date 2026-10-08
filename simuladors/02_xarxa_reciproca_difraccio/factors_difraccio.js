// Simulador — F(Δk) = L(Δk)·S(Δk) en un cristall 2D.
// Convencions dels apunts del Tema 2: Δk = k' − k, fase e^{−iΔk·r},
// nusos T = n1 a1 + n2 a2 amb n_i = 0..N−1, àtoms gaussians 2D
// (f = Z e^{−σ²q²/2}). Unitats: |a1| = a = 1.

(function () {
  'use strict';

  const TAU = 2 * Math.PI;
  const COL_ATOM = ['#2980b9', '#e67e22'];
  const COL_CUT = '#ff9f1a';

  const state = {
    lattice: 'square', ratio: 1, gamma: 90, N: 6,
    two: false, x2: 0.5, y2: 0.5,
    Z1: 10, s1: 0.08, Z2: 10, s2: 0.08,
    term: 'F', log: true, phase: false,
    c1: 1, c2: 0,           // Δk en coordenades de la base recíproca
    cutMode: 'G', cutH: 1, cutK: 0, cutLog: false,
    d1: 1, d2: 0            // direcció del tall: Δk = ξ (d1 b1 + d2 b2)
  };

  const PRESETS = {
    sq1:      { lattice: 'square', ratio: 1,   gamma: 90, two: false, Z1: 10, s1: 0.08 },
    sqc_eq:   { lattice: 'square', ratio: 1,   gamma: 90, two: true, x2: 0.5, y2: 0.5, Z1: 10, s1: 0.08, Z2: 10, s2: 0.08 },
    sqc_diff: { lattice: 'square', ratio: 1,   gamma: 90, two: true, x2: 0.5, y2: 0.5, Z1: 18, s1: 0.10, Z2: 10, s2: 0.07 },
    hex2:     { lattice: 'hex',    ratio: 1,   gamma: 60, two: true, x2: 1 / 3, y2: 1 / 3, Z1: 6, s1: 0.08, Z2: 6, s2: 0.08 },
    rect1:    { lattice: 'rect',   ratio: 1.5, gamma: 90, two: false, Z1: 10, s1: 0.08 }
  };

  // ---------------------------------------------------------------
  // Física
  // ---------------------------------------------------------------
  function vectors() {
    const g = state.gamma * Math.PI / 180;
    const a1 = { x: 1, y: 0 };
    const a2 = { x: state.ratio * Math.cos(g), y: state.ratio * Math.sin(g) };
    const A = a1.x * a2.y - a1.y * a2.x;
    const b1 = { x: TAU * a2.y / A, y: -TAU * a2.x / A };
    const b2 = { x: -TAU * a1.y / A, y: TAU * a1.x / A };
    return { a1, a2, b1, b2 };
  }

  function atoms(v) {
    const list = [{ fx: 0, fy: 0, Z: state.Z1, s: state.s1, col: COL_ATOM[0] }];
    if (state.two) list.push({ fx: state.x2, fy: state.y2, Z: state.Z2, s: state.s2, col: COL_ATOM[1] });
    list.forEach(at => {
      at.x = at.fx * v.a1.x + at.fy * v.a2.x;
      at.y = at.fx * v.a1.y + at.fy * v.a2.y;
    });
    return list;
  }

  const formFactor = (q, at) => at.Z * Math.exp(-0.5 * at.s * at.s * q * q);

  function ratio1D(x, N) {
    const s = Math.sin(x / 2);
    if (Math.abs(s) < 1e-9) return N * N;
    const r = Math.sin(N * x / 2) / s;
    return r * r;
  }

  function Lsq(dx, dy, v) {
    const x1 = dx * v.a1.x + dy * v.a1.y;
    const x2 = dx * v.a2.x + dy * v.a2.y;
    return ratio1D(x1, state.N) * ratio1D(x2, state.N);
  }

  function Scomplex(dx, dy, ats) {
    const q = Math.hypot(dx, dy);
    let re = 0, im = 0;
    for (const at of ats) {
      const f = formFactor(q, at);
      const ph = -(dx * at.x + dy * at.y);
      re += f * Math.cos(ph);
      im += f * Math.sin(ph);
    }
    return { re, im };
  }

  function dkCartesian(v) {
    return { x: state.c1 * v.b1.x + state.c2 * v.b2.x, y: state.c1 * v.b1.y + state.c2 * v.b2.y };
  }

  function kmax(v) {
    return 3.3 * Math.max(Math.hypot(v.b1.x, v.b1.y), Math.hypot(v.b2.x, v.b2.y));
  }

  // Tall per l'origen: Δk = ξ (d1 b1 + d2 b2), de manera que Δk·a1 = 2πξ d1 i Δk·a2 = 2πξ d2
  function cutDir(v) {
    return { x: state.d1 * v.b1.x + state.d2 * v.b2.x, y: state.d1 * v.b1.y + state.d2 * v.b2.y };
  }
  // ξ on la línia surt del mapa
  function cutXiMax(v, d) {
    return kmax(v) / Math.max(Math.abs(d.x), Math.abs(d.y));
  }
  // ξ del Δk triat si és sobre la línia (si no, null)
  function xiOnCut() {
    const n2 = state.d1 * state.d1 + state.d2 * state.d2;
    const xi = (state.c1 * state.d1 + state.c2 * state.d2) / n2;
    const off = Math.hypot(state.c1 - xi * state.d1, state.c2 - xi * state.d2);
    return off < 0.01 ? xi : null;
  }

  // ---------------------------------------------------------------
  // Mapa de Δk
  // ---------------------------------------------------------------
  const cMap = document.getElementById('canvasMap');
  const gMap = cMap.getContext('2d');
  const VIRIDIS = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];

  function colormap(t) {
    t = Math.min(1, Math.max(0, t));
    const x = t * (VIRIDIS.length - 1);
    const i = Math.min(VIRIDIS.length - 2, Math.floor(x));
    const u = x - i;
    const a = VIRIDIS[i], b = VIRIDIS[i + 1];
    return [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1]), a[2] + u * (b[2] - a[2])];
  }

  function termValue(dx, dy, v, ats) {
    if (state.term === 'L') return Lsq(dx, dy, v);
    if (state.term === 'f') return formFactor(Math.hypot(dx, dy), ats[0]);
    const S = Scomplex(dx, dy, ats);
    const S2 = S.re * S.re + S.im * S.im;
    if (state.term === 'S') return S2;
    return Lsq(dx, dy, v) * S2;
  }

  function pxToDk(px, py, km) {
    return { x: (px / cMap.width * 2 - 1) * km, y: (1 - py / cMap.height * 2) * km };
  }
  function dkToPx(dx, dy, km) {
    return { x: (dx / km + 1) / 2 * cMap.width, y: (1 - dy / km) / 2 * cMap.height };
  }

  let mapCacheKey = null, mapCacheImg = null;

  function drawMap(v, ats) {
    const W = cMap.width, H = cMap.height, km = kmax(v);
    const key = JSON.stringify([state.lattice, state.ratio, state.gamma, state.N, state.two, state.x2, state.y2,
      state.Z1, state.s1, state.Z2, state.s2, state.term, state.log]);
    if (key !== mapCacheKey) {
      const vals = new Float32Array(W * H);
      let vmax = 0;
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const dk = pxToDk(px + 0.5, py + 0.5, km);
          const val = termValue(dk.x, dk.y, v, ats);
          vals[py * W + px] = val;
          if (val > vmax) vmax = val;
        }
      }
      const img = gMap.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        let t = vmax > 0 ? vals[i] / vmax : 0;
        if (state.log) t = 1 + Math.log10(Math.max(t, 1e-4)) / 4;
        const c = colormap(t);
        img.data[4 * i] = c[0]; img.data[4 * i + 1] = c[1]; img.data[4 * i + 2] = c[2]; img.data[4 * i + 3] = 255;
      }
      mapCacheKey = key;
      mapCacheImg = img;
    }
    gMap.putImageData(mapCacheImg, 0, 0);

    // vectors G
    const bmin = Math.min(Math.hypot(v.b1.x, v.b1.y), Math.hypot(v.b2.x, v.b2.y));
    const Hm = Math.ceil(km / bmin * 1.6) + 1;
    gMap.lineWidth = 1;
    gMap.font = '9px sans-serif';
    gMap.textAlign = 'left';
    for (let h = -Hm; h <= Hm; h++) {
      for (let k = -Hm; k <= Hm; k++) {
        const gx = h * v.b1.x + k * v.b2.x, gy = h * v.b1.y + k * v.b2.y;
        if (Math.abs(gx) > km || Math.abs(gy) > km) continue;
        const p = dkToPx(gx, gy, km);
        gMap.strokeStyle = 'rgba(255,255,255,0.85)';
        gMap.beginPath(); gMap.arc(p.x, p.y, 4, 0, TAU); gMap.stroke();
        if (Math.abs(h) <= 2 && Math.abs(k) <= 2) {
          gMap.fillStyle = 'rgba(255,255,255,0.9)';
          gMap.fillText(h + ',' + k, p.x + 5, p.y - 4);
        }
      }
    }
    // línia del tall, per l'origen
    const d = cutDir(v), xm = cutXiMax(v, d);
    const pa = dkToPx(-xm * d.x, -xm * d.y, km), pb = dkToPx(xm * d.x, xm * d.y, km);
    gMap.strokeStyle = COL_CUT;
    gMap.lineWidth = 2;
    gMap.setLineDash([7, 5]);
    gMap.beginPath(); gMap.moveTo(pa.x, pa.y); gMap.lineTo(pb.x, pb.y); gMap.stroke();
    gMap.setLineDash([]);
    const po = dkToPx(0, 0, km), p1 = dkToPx(d.x, d.y, km);
    arrow(gMap, po, p1, COL_CUT, 'ξ', 2);

    // Δk triat
    const dk = dkCartesian(v);
    const p = dkToPx(dk.x, dk.y, km);
    gMap.strokeStyle = '#ff3b30';
    gMap.lineWidth = 2;
    gMap.beginPath();
    gMap.moveTo(p.x - 8, p.y); gMap.lineTo(p.x + 8, p.y);
    gMap.moveTo(p.x, p.y - 8); gMap.lineTo(p.x, p.y + 8);
    gMap.stroke();
  }

  // ---------------------------------------------------------------
  // Espai real
  // ---------------------------------------------------------------
  const cReal = document.getElementById('canvasReal');
  const gReal = cReal.getContext('2d');

  function hueColor(phase, alpha) {
    let h = (phase % TAU + TAU) % TAU / TAU * 360;
    return 'hsla(' + h.toFixed(0) + ',80%,45%,' + alpha + ')';
  }

  function drawReal(v, ats) {
    const W = cReal.width, H = cReal.height, N = state.N;
    gReal.clearRect(0, 0, W, H);
    const pts = [];
    for (let n1 = 0; n1 < N; n1++) for (let n2 = 0; n2 < N; n2++) {
      const tx = n1 * v.a1.x + n2 * v.a2.x, ty = n1 * v.a1.y + n2 * v.a2.y;
      ats.forEach((at, j) => pts.push({ x: tx + at.x, y: ty + at.y, at, j }));
    }
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const q of pts) { xmin = Math.min(xmin, q.x); xmax = Math.max(xmax, q.x); ymin = Math.min(ymin, q.y); ymax = Math.max(ymax, q.y); }
    const pad = 0.6;
    xmin -= pad; xmax += pad; ymin -= pad; ymax += pad;
    const sc = Math.min(W / (xmax - xmin), H / (ymax - ymin));
    const ox = (W - sc * (xmax - xmin)) / 2, oy = (H - sc * (ymax - ymin)) / 2;
    const toPx = (x, y) => ({ x: ox + (x - xmin) * sc, y: H - (oy + (y - ymin) * sc) });

    // cel·la de l'origen
    const c0 = toPx(0, 0), c1 = toPx(v.a1.x, v.a1.y), c2 = toPx(v.a1.x + v.a2.x, v.a1.y + v.a2.y), c3 = toPx(v.a2.x, v.a2.y);
    gReal.fillStyle = 'rgba(0,150,57,0.07)';
    gReal.strokeStyle = 'rgba(0,114,43,0.5)';
    gReal.lineWidth = 1;
    gReal.beginPath(); gReal.moveTo(c0.x, c0.y); gReal.lineTo(c1.x, c1.y); gReal.lineTo(c2.x, c2.y); gReal.lineTo(c3.x, c3.y); gReal.closePath();
    gReal.fill(); gReal.stroke();

    const dk = dkCartesian(v);
    for (const q of pts) {
      const P = toPx(q.x, q.y);
      const ph = -(dk.x * q.x + dk.y * q.y);
      const base = state.phase ? null : q.at.col;
      if (q.at.s <= 0.001) {
        gReal.fillStyle = state.phase ? hueColor(ph, 1) : base;
        gReal.beginPath(); gReal.arc(P.x, P.y, 3, 0, TAU); gReal.fill();
        continue;
      }
      const r = Math.max(3, 2.2 * q.at.s * sc);
      const grd = gReal.createRadialGradient(P.x, P.y, 0, P.x, P.y, r);
      if (state.phase) {
        grd.addColorStop(0, hueColor(ph, 0.95));
        grd.addColorStop(1, hueColor(ph, 0));
      } else {
        grd.addColorStop(0, base);
        grd.addColorStop(1, base + '00');
      }
      gReal.fillStyle = grd;
      gReal.beginPath(); gReal.arc(P.x, P.y, r, 0, TAU); gReal.fill();
    }

    arrow(gReal, c0, c1, '#c0392b', 'a₁');
    arrow(gReal, c0, c3, '#c0392b', 'a₂');
  }

  function arrow(g, p0, p1, col, label, width) {
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = width || 2;
    g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
    if (len > 4) {
      const hl = Math.min(9, len * 0.35);
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p1.x - hl * Math.cos(ang - 0.4), p1.y - hl * Math.sin(ang - 0.4));
      g.lineTo(p1.x - hl * Math.cos(ang + 0.4), p1.y - hl * Math.sin(ang + 0.4));
      g.closePath(); g.fill();
    }
    if (label) {
      g.font = 'bold 12px sans-serif';
      g.fillText(label, p1.x + 4, p1.y - 4);
    }
  }

  // ---------------------------------------------------------------
  // Diagrames de fasors
  // ---------------------------------------------------------------
  function axesComplex(g, W, H) {
    g.clearRect(0, 0, W, H);
    g.strokeStyle = '#d5dcd7'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
    g.fillStyle = '#8a9a90'; g.font = '10px sans-serif';
    g.fillText('Re', W - 18, H / 2 - 4);
    g.fillText('Im', W / 2 + 4, 11);
  }

  const cL = document.getElementById('canvasL'), gL = cL.getContext('2d');
  function drawL(v) {
    const W = cL.width, H = cL.height, N = state.N;
    axesComplex(gL, W, H);
    const dk = dkCartesian(v);
    const x1 = dk.x * v.a1.x + dk.y * v.a1.y;
    const x2 = dk.x * v.a2.x + dk.y * v.a2.y;
    const chain = [{ re: 0, im: 0 }];
    let re = 0, im = 0;
    for (let n2 = 0; n2 < N; n2++) for (let n1 = 0; n1 < N; n1++) {
      const ph = -(n1 * x1 + n2 * x2);
      re += Math.cos(ph); im += Math.sin(ph);
      chain.push({ re, im });
    }
    let ext = 1e-6;
    for (const z of chain) ext = Math.max(ext, Math.abs(z.re), Math.abs(z.im));
    const sc = (W / 2 - 14) / ext;
    const P = z => ({ x: W / 2 + z.re * sc, y: H / 2 - z.im * sc });
    gL.strokeStyle = 'rgba(0,150,57,0.8)'; gL.lineWidth = 1;
    gL.beginPath();
    chain.forEach((z, i) => { const p = P(z); if (i === 0) gL.moveTo(p.x, p.y); else gL.lineTo(p.x, p.y); });
    gL.stroke();
    arrow(gL, P(chain[0]), P({ re, im }), '#111', null, 2.5);
    const mod = Math.hypot(re, im);
    gL.fillStyle = '#333'; gL.font = '11px sans-serif';
    gL.fillText('|L| = ' + mod.toFixed(1) + '   (N² = ' + N * N + ')', 6, H - 7);
  }

  const cS = document.getElementById('canvasS'), gS = cS.getContext('2d');
  function drawS(v, ats) {
    const W = cS.width, H = cS.height;
    axesComplex(gS, W, H);
    const Zsum = ats.reduce((s, a) => s + a.Z, 0);
    const sc = (W / 2 - 14) / Zsum;
    const P = z => ({ x: W / 2 + z.re * sc, y: H / 2 - z.im * sc });
    gS.strokeStyle = '#c8d3cc'; gS.setLineDash([3, 3]);
    gS.beginPath(); gS.arc(W / 2, H / 2, Zsum * sc, 0, TAU); gS.stroke();
    gS.setLineDash([]);
    const dk = dkCartesian(v);
    const q = Math.hypot(dk.x, dk.y);
    let z = { re: 0, im: 0 };
    ats.forEach((at, j) => {
      const f = formFactor(q, at);
      const ph = -(dk.x * at.x + dk.y * at.y);
      const zn = { re: z.re + f * Math.cos(ph), im: z.im + f * Math.sin(ph) };
      // la primera fletxa més gruixuda: si la segona hi torna a sobre (S = 0), es veuen totes dues
      arrow(gS, P(z), P(zn), at.col, null, j === 0 ? 6 : 2.5);
      z = zn;
    });
    arrow(gS, P({ re: 0, im: 0 }), P(z), '#111', null, 1.5);
    gS.fillStyle = '#333'; gS.font = '11px sans-serif';
    gS.fillText('|S| = ' + Math.hypot(z.re, z.im).toFixed(2) + '   (ΣZ = ' + Zsum + ')', 6, H - 7);
  }

  // ---------------------------------------------------------------
  // Tall per l'origen: gràfica 1D i expressions analítiques
  // ---------------------------------------------------------------
  const cCut = document.getElementById('canvasCut'), gCut = cCut.getContext('2d');
  const CUT_M = { l: 46, r: 12, t: 16, b: 44 };
  const COL_MAIN = '#00722b', COL_ENV = '#8a9a90';

  // Corbes del tall per a la magnitud triada. Cada corba dona un valor t ∈ [0,1] (normalitzat a 'ymax').
  function cutCurves(ats) {
    const N4 = Math.pow(state.N, 4);
    const Zsum = ats.reduce((s, a) => s + a.Z, 0);
    const S2n = (dx, dy) => { const S = Scomplex(dx, dy, ats); return (S.re * S.re + S.im * S.im) / (Zsum * Zsum); };
    if (state.term === 'L') {
      return { ylabel: '|L|² / N⁴', ymax: 1,
        curves: [{ nom: '|L|² / N⁴', col: COL_MAIN, w: 2, fn: (dx, dy, v) => Lsq(dx, dy, v) / N4 }] };
    }
    if (state.term === 'f') {
      // factor de forma en unitats absolutes (fins a Z), un per a cada àtom
      const Zmax = Math.max(...ats.map(a => a.Z));
      return { ylabel: 'factor de forma f', ymax: Zmax,
        curves: ats.map((at, j) => ({ nom: 'f' + (j ? '₂' : '₁') + '  (Z = ' + at.Z + ')', col: at.col,
          w: j ? 2 : 4, dash: j ? [6, 4] : null, fn: (dx, dy) => formFactor(Math.hypot(dx, dy), at) / Zmax })) };
    }
    if (state.term === 'S') {
      return { ylabel: '|S|² / (ΣZ)²', ymax: 1, curves: [
        { nom: '(Σⱼ fⱼ)² / (ΣZ)²', col: COL_ENV, w: 1.5, dash: [5, 4], env: true, fn: (dx, dy) => {
          const q = Math.hypot(dx, dy), fs = ats.reduce((s, a) => s + formFactor(q, a), 0) / Zsum; return fs * fs; } },
        { nom: '|S|² / (ΣZ)²', col: COL_MAIN, w: 2, fn: S2n }] };
    }
    return { ylabel: '|F|² / (N⁴ (ΣZ)²)', ymax: 1, curves: [
      { nom: '|S|² / (ΣZ)²', col: COL_ENV, w: 1.5, dash: [5, 4], env: true, fn: S2n },
      { nom: '|F|² / (N⁴ (ΣZ)²)', col: COL_MAIN, w: 2, fn: (dx, dy, v) => Lsq(dx, dy, v) / N4 * S2n(dx, dy) }] };
  }

  function drawCut(v, ats) {
    const W = cCut.width, H = cCut.height, m = CUT_M;
    gCut.clearRect(0, 0, W, H);
    const d = cutDir(v), xm = cutXiMax(v, d);
    const X = xi => m.l + (xi + xm) / (2 * xm) * (W - m.l - m.r);
    const tr = t => state.cutLog ? Math.max(0, 1 + Math.log10(Math.max(t, 1e-4)) / 4) : t;
    const Y = t => H - m.b - tr(t) * (H - m.t - m.b);
    const intDir = Number.isInteger(state.d1) && Number.isInteger(state.d2);
    const cc = cutCurves(ats);

    // graella i eixos
    gCut.font = '10px sans-serif';
    gCut.textAlign = 'center';
    for (let i = Math.ceil(-xm); i <= Math.floor(xm); i++) {
      const x = X(i);
      gCut.strokeStyle = i === 0 ? '#b8c4bc' : '#e6ece8'; gCut.lineWidth = 1;
      gCut.beginPath(); gCut.moveTo(x, m.t); gCut.lineTo(x, H - m.b); gCut.stroke();
      gCut.fillStyle = '#555';
      gCut.fillText(String(i), x, H - m.b + 12);
      if (intDir) {
        gCut.fillStyle = '#b36b00';
        gCut.fillText('(' + i * state.d1 + ',' + i * state.d2 + ')', x, H - m.b + 23);
      }
    }
    gCut.strokeStyle = '#999';
    gCut.beginPath(); gCut.moveTo(m.l, m.t); gCut.lineTo(m.l, H - m.b); gCut.lineTo(W - m.r, H - m.b); gCut.stroke();
    gCut.fillStyle = '#555';
    gCut.fillText('ξ     (Δk = ξ·(h b₁ + k b₂)' + (intDir ? ';  en taronja, el G(h,k) de cada ξ enter)' : ')'),
      (m.l + W - m.r) / 2, H - 5);
    gCut.textAlign = 'right';
    const ym = cc.ymax, yn = x => fmt(x);
    const yt = state.cutLog
      ? [[1, yn(ym)], [1e-2, (ym === 1 ? '' : yn(ym) + '·') + '10⁻²'], [1e-4, (ym === 1 ? '' : yn(ym) + '·') + '10⁻⁴']]
      : [[1, yn(ym)], [0.5, yn(ym / 2)], [0, '0']];
    yt.forEach(([t, s]) => gCut.fillText(s, m.l - 4, Y(t) + 4));
    gCut.save();
    gCut.translate(12, (m.t + H - m.b) / 2); gCut.rotate(-Math.PI / 2);
    gCut.textAlign = 'center';
    gCut.fillText(cc.ylabel, 0, 0);
    gCut.restore();

    // corbes: mostreig que inclou exactament els ξ enters (on són els pics)
    const sub = Math.max(100, Math.ceil(3 * W / (2 * xm)));
    gCut.save();
    gCut.beginPath(); gCut.rect(m.l, m.t - 2, W - m.l - m.r, H - m.t - m.b + 2); gCut.clip();
    cc.curves.forEach(c => {
      gCut.strokeStyle = c.col; gCut.lineWidth = c.w; gCut.setLineDash(c.dash || []);
      gCut.beginPath();
      let first = true;
      for (let i = Math.ceil(-xm * sub); i <= Math.floor(xm * sub); i++) {
        const xi = i / sub, y = Y(c.fn(xi * d.x, xi * d.y, v));
        if (first) { gCut.moveTo(X(xi), y); first = false; } else gCut.lineTo(X(xi), y);
      }
      gCut.stroke();
    });
    gCut.setLineDash([]);
    gCut.restore();

    // llegenda (la corba principal primer)
    gCut.textAlign = 'left'; gCut.font = '11px sans-serif';
    const lx = W - m.r - 190;
    cc.curves.slice().sort((a, b) => (a.env ? 1 : 0) - (b.env ? 1 : 0)).forEach((c, i) => {
      const ly = m.t + 4 + 15 * i;
      gCut.strokeStyle = c.col; gCut.lineWidth = Math.min(c.w, 3); gCut.setLineDash(c.dash || []);
      gCut.beginPath(); gCut.moveTo(lx, ly); gCut.lineTo(lx + 20, ly); gCut.stroke();
      gCut.setLineDash([]);
      gCut.fillStyle = '#333'; gCut.fillText(c.nom, lx + 25, ly + 4);
    });

    // Δk triat, si és sobre la línia
    const xi0 = xiOnCut();
    if (xi0 !== null && Math.abs(xi0) <= xm) {
      gCut.strokeStyle = '#ff3b30'; gCut.lineWidth = 1.5;
      gCut.beginPath(); gCut.moveTo(X(xi0), m.t); gCut.lineTo(X(xi0), H - m.b); gCut.stroke();
      cc.curves.filter(c => !c.env).forEach(c => {
        gCut.fillStyle = cc.curves.length > 1 && state.term === 'f' ? c.col : '#ff3b30';
        gCut.beginPath(); gCut.arc(X(xi0), Y(c.fn(xi0 * d.x, xi0 * d.y, v)), 4, 0, TAU); gCut.fill();
      });
    }
  }

  // format dels nombres dins les fórmules
  function fmt(x) {
    const r = Math.round(x);
    if (Math.abs(x - r) < 1e-9) return String(r);
    return String(+x.toFixed(2));
  }
  function piCoef(c) {        // c·π com a text TeX (fraccions senzilles com a p/q)
    const s = fmt(c);
    if (s === '1') return '\\pi';
    if (s === '-1') return '-\\pi';
    if (!Number.isInteger(+s)) {
      for (let q = 2; q <= 6; q++) {
        const p = Math.round(c * q);
        if (Math.abs(c * q - p) < 1e-6) {
          return (p < 0 ? '-' : '') + '\\tfrac{' + (Math.abs(p) === 1 ? '' : Math.abs(p)) + '\\pi}{' + q + '}';
        }
      }
    }
    return s + '\\pi';
  }
  function tex(s) {
    if (window.katex) return window.katex.renderToString(s, { displayMode: true, throwOnError: false });
    return '<code>' + s.replace(/</g, '&lt;') + '</code>';
  }

  const formulesTall = document.getElementById('formulesTall');
  const xiTall = document.getElementById('xiTall');
  let formCacheKey = null;

  function drawFormulas(v, ats) {
    const xi0 = xiOnCut();
    xiTall.textContent = xi0 === null
      ? 'El Δk triat (creu vermella) no és sobre la línia del tall.'
      : 'El Δk triat és sobre la línia, a ξ = ' + xi0.toFixed(3) + '.';

    const key = JSON.stringify([state.d1, state.d2, state.N, state.term, state.two, state.x2, state.y2,
      state.Z1, state.s1, state.Z2, state.s2, state.lattice, state.ratio, state.gamma]);
    if (key === formCacheKey) return;
    formCacheKey = key;

    const N = state.N, h = state.d1, k = state.d2;
    const intDir = Number.isInteger(h) && Number.isInteger(k);
    const d = cutDir(v), dnorm = Math.hypot(d.x, d.y);
    const dot = c => (Math.abs(c) < 1e-9 ? '0' : piCoef(2 * c) + '\\xi');
    const rows = [];

    // paràmetre de la línia
    rows.push({
      id: 'linia',
      nom: 'La línia',
      tex: [
        '\\Delta\\vec k=\\xi\\,(h\\,\\vec b_1+k\\,\\vec b_2),\\qquad (h,k)=(' + fmt(h) + ',' + fmt(k) + ')',
        '\\Delta\\vec k\\cdot\\vec a_1=2\\pi\\xi h=' + dot(h) + ',\\qquad \\Delta\\vec k\\cdot\\vec a_2=2\\pi\\xi k=' + dot(k) +
          ',\\qquad |\\Delta\\vec k|=' + (dnorm / TAU).toFixed(3) + '\\,\\tfrac{2\\pi}{a}\\,|\\xi|'
      ],
      nota: 'Fem servir que b<sub>i</sub>·a<sub>j</sub> = 2π δ<sub>ij</sub>.' +
        (intDir ? ' Com que h i k són enters, a cada ξ = m enter Δk = G(mh, mk) és un vector de la xarxa recíproca.'
                : ' h i k no són enters: fora de l\'origen, la línia no passa per cap vector G.')
    });

    // suma sobre la xarxa
    const fac = c => (Math.abs(c) < 1e-9 ? null
      : '\\frac{\\sin^2(' + piCoef(N * Math.abs(c)) + '\\xi)}{\\sin^2(' + piCoef(Math.abs(c)) + '\\xi)}');
    const facs = [fac(h), fac(k)];
    const nZero = facs.filter(x => x === null).length;
    const Lline = (nZero ? N + '^2\\,' : '') + facs.filter(x => x !== null).join('\\,');
    rows.push({
      id: 'L',
      nom: 'Suma sobre la xarxa',
      tex: [
        '|L|^2=\\frac{\\sin^2(N\\,\\Delta\\vec k\\cdot\\vec a_1/2)}{\\sin^2(\\Delta\\vec k\\cdot\\vec a_1/2)}\\;' +
          '\\frac{\\sin^2(N\\,\\Delta\\vec k\\cdot\\vec a_2/2)}{\\sin^2(\\Delta\\vec k\\cdot\\vec a_2/2)}',
        '|L(\\xi)|^2=' + Lline + '\\qquad (N=' + N + ')'
      ],
      nota: 'Cada factor és el |L(q)|² = sin²(Nqa/2)/sin²(qa/2) de la cadena dels apunts, amb qa → Δk·a<sub>i</sub>. ' +
        'El màxim, quan ξh i ξk són enters, és N²·N² = ' + Math.pow(N, 4) + '.' +
        (nZero ? ' El factor N² surt de la direcció on Δk·a<sub>i</sub> = 0: allà tots els termes valen 1.' : '')
    });

    // factor d'estructura
    let Sline;
    if (ats.length === 1) {
      Sline = ['S(\\xi)=f_1,\\qquad |S(\\xi)|^2=f_1^2'];
    } else {
      const ph = h * state.x2 + k * state.y2;
      if (Math.abs(ph) < 1e-9) {
        Sline = ['S(\\xi)=f_1+f_2,\\qquad |S(\\xi)|^2=(f_1+f_2)^2'];
      } else {
        const arg = piCoef(2 * ph) + '\\xi';
        Sline = ['S(\\xi)=f_1+f_2\\,e^{-i\\,' + arg + '}',
                 '|S(\\xi)|^2=f_1^2+f_2^2+2f_1f_2\\cos(' + arg + ')'];
      }
    }
    const pos = ats.length === 1 ? 'r₁ = 0.' :
      'r₁ = 0 i r₂ = ' + fmt(state.x2) + ' a₁ + ' + fmt(state.y2) + ' a₂.';
    rows.push({
      id: 'S',
      nom: 'Factor d\'estructura',
      tex: ['S=\\sum_j f_j\\,e^{-i\\Delta\\vec k\\cdot\\vec r_j}=\\sum_j f_j\\,e^{-2\\pi i\\,\\xi\\,(hx_j+ky_j)}'].concat(Sline),
      nota: 'Posicions: ' + pos + (intDir
        ? ' A ξ = m enter és el S<sub>hk</sub> = Σ<sub>j</sub> f<sub>j</sub> e<sup>−2πi(hx<sub>j</sub>+ky<sub>j</sub>)</sup> dels apunts, amb (h,k) → (mh, mk).'
        : '')
    });

    // factor de forma
    const fexpr = (at, j) => {
      const c = at.s * at.s * dnorm * dnorm / 2;
      return 'f_' + j + '(\\xi)=' + at.Z + (at.s <= 0 ? '' : '\\,e^{-' + (+c.toPrecision(3)) + '\\,\\xi^2}');
    };
    rows.push({
      id: 'f',
      nom: 'Factor de forma',
      tex: ['f_j=Z_j\\,e^{-\\sigma_j^2|\\Delta\\vec k|^2/2}',
            ats.map((at, i) => fexpr(at, i + 1)).join(',\\qquad ')],
      nota: 'Model d\'àtom gaussià (σ en unitats de a). No depèn de la direcció del tall, només de |Δk|. Amb σ = 0, f = Z.'
    });

    // intensitat
    rows.push({
      id: 'F',
      nom: 'Intensitat',
      tex: ['|F(\\xi)|^2=|L(\\xi)|^2\\,|S(\\xi)|^2' +
            (intDir ? ',\\qquad |F(\\xi=m)|^2=N^4\\,|S_{mh,mk}|^2=' + Math.pow(N, 4) + '\\,|S_{mh,mk}|^2' : '')],
      nota: 'Als pics, L és el nombre total de nusos, N² (N en cada direcció), i |F|² = N⁴|S(G)|²: és la I ∝ N²|S(G)|² dels apunts, on allà N compta tots els nusos.'
    });

    formulesTall.innerHTML = rows.map(r =>
      '<div class="formula' + (r.id === state.term ? ' actiu' : '') + '">' +
      '<div class="formula-nom">' + r.nom + (r.id === state.term ? ' <span class="representat">← representat a la gràfica</span>' : '') + '</div>' +
      r.tex.map(tex).join('') +
      '<div class="formula-nota">' + r.nota + '</div></div>').join('');
  }

  // ---------------------------------------------------------------
  // Lectura numèrica
  // ---------------------------------------------------------------
  const lectura = document.getElementById('lectura');
  const estatG = document.getElementById('estatG');
  function drawReadout(v, ats) {
    const dk = dkCartesian(v);
    const q = Math.hypot(dk.x, dk.y);
    const N = state.N;
    const L2 = Lsq(dk.x, dk.y, v);
    const S = Scomplex(dk.x, dk.y, ats);
    const S2 = S.re * S.re + S.im * S.im;
    const Zsum = ats.reduce((s, a) => s + a.Z, 0);
    const rows = [
      ['Δk (2π/a)', '(' + (dk.x / TAU).toFixed(3) + ', ' + (dk.y / TAU).toFixed(3) + ')'],
      ['Δk en base (b₁, b₂)', '(' + state.c1.toFixed(3) + ', ' + state.c2.toFixed(3) + ')'],
      ['|L|² / N⁴', (L2 / Math.pow(N, 4)).toFixed(4)],
      ['|S|', Math.sqrt(S2).toFixed(3)],
      ['f₁', formFactor(q, ats[0]).toFixed(3)]
    ];
    if (ats.length > 1) rows.push(['f₂', formFactor(q, ats[1]).toFixed(3)]);
    rows.push(['|F|² / (N⁴ (ΣZ)²)', (L2 * S2 / (Math.pow(N, 4) * Zsum * Zsum)).toFixed(4)]);
    lectura.innerHTML = rows.map(r => '<div class="fila"><span class="etiqueta">' + r[0] + '</span><span class="valor">' + r[1] + '</span></div>').join('');
    const h = Math.round(state.c1), k = Math.round(state.c2);
    const esG = Math.abs(state.c1 - h) < 0.02 && Math.abs(state.c2 - k) < 0.02;
    if (esG) {
      const prohibida = S2 < 1e-6 * Zsum * Zsum;
      estatG.className = 'estat-G ' + (prohibida ? 'no' : 'si');
      estatG.textContent = 'Δk = G(' + h + ',' + k + '): condició de Laue satisfeta, L = N². ' +
        (prohibida ? 'Però S = 0: reflexió prohibida.' : 'Hi ha pic.');
    } else {
      estatG.className = 'estat-G no';
      estatG.textContent = 'Δk no és cap vector de la xarxa recíproca: les fases de L s\'anul·len.';
    }
  }

  // ---------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const ui = {
    preset: $('selPreset'), xarxa: $('selXarxa'), ratio: $('slRatio'), gamma: $('slGamma'), N: $('slN'),
    Z1: $('slZ1'), S1: $('slS1'), dos: $('chkDos'), bloc2: $('blocAtom2'),
    X2: $('slX2'), Y2: $('slY2'), Z2: $('slZ2'), S2: $('slS2'),
    terme: $('selTerme'), log: $('chkLog'), fase: $('chkFase'),
    h: $('inH'), k: $('inK'), anar: $('btnAnarG'), snap: $('btnSnap'),
    cutMode: $('selCutMode'), cutH: $('inCutH'), cutK: $('inCutK'), cutHK: $('blocCutHK'), cutLog: $('chkCutLog')
  };

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }

  // Direcció del tall a partir de (h,k) enters, reduïts pel seu mcd
  function setDirFromHK() {
    let h = Math.round(+ui.cutH.value || 0), k = Math.round(+ui.cutK.value || 0);
    if (h === 0 && k === 0) h = 1;
    const g = gcd(h, k);
    state.cutH = h / g; state.cutK = k / g;
    ui.cutH.value = state.cutH; ui.cutK.value = state.cutK;
    state.d1 = state.cutH; state.d2 = state.cutK;
  }
  // Direcció del tall que passa pel Δk triat
  function setDirFromDk() {
    const c1 = state.c1, c2 = state.c2, mx = Math.max(Math.abs(c1), Math.abs(c2));
    if (mx < 1e-3) return;
    const r1 = Math.round(c1), r2 = Math.round(c2);
    if (Math.abs(c1 - r1) < 0.02 && Math.abs(c2 - r2) < 0.02) {
      const g = gcd(r1, r2);
      state.d1 = r1 / g; state.d2 = r2 / g;
    } else {
      state.d1 = c1 / mx; state.d2 = c2 / mx;
    }
  }
  function dkChanged() { if (state.cutMode === 'dk') setDirFromDk(); render(); }

  function syncUI() {
    ui.xarxa.value = state.lattice;
    ui.ratio.value = state.ratio; ui.gamma.value = state.gamma; ui.N.value = state.N;
    ui.Z1.value = state.Z1; ui.S1.value = state.s1;
    ui.dos.checked = state.two;
    ui.X2.value = state.x2; ui.Y2.value = state.y2; ui.Z2.value = state.Z2; ui.S2.value = state.s2;
    ui.bloc2.style.display = state.two ? '' : 'none';
    ui.ratio.disabled = !(state.lattice === 'rect' || state.lattice === 'obl');
    ui.gamma.disabled = state.lattice !== 'obl';
    $('valRatio').textContent = (+state.ratio).toFixed(2);
    $('valGamma').textContent = Math.round(state.gamma) + '°';
    $('valN').textContent = state.N;
    $('valZ1').textContent = state.Z1; $('valS1').textContent = (+state.s1).toFixed(2);
    $('valX2').textContent = (+state.x2).toFixed(2); $('valY2').textContent = (+state.y2).toFixed(2);
    $('valZ2').textContent = state.Z2; $('valS2').textContent = (+state.s2).toFixed(2);
    ui.cutMode.value = state.cutMode;
    ui.cutHK.style.display = state.cutMode === 'G' ? '' : 'none';
    ui.cutLog.checked = state.cutLog;
  }

  function render() {
    const v = vectors();
    const ats = atoms(v);
    drawMap(v, ats);
    drawReal(v, ats);
    drawL(v);
    drawS(v, ats);
    drawCut(v, ats);
    drawFormulas(v, ats);
    drawReadout(v, ats);
  }

  function setLattice(type) {
    state.lattice = type;
    if (type === 'square') { state.ratio = 1; state.gamma = 90; }
    if (type === 'rect') { state.gamma = 90; if (state.ratio === 1) state.ratio = 1.5; }
    if (type === 'hex') { state.ratio = 1; state.gamma = 60; }
  }

  function applyPreset(name) {
    const p = PRESETS[name];
    Object.assign(state, { two: false, x2: 0.5, y2: 0.5, Z2: 10, s2: 0.08 }, p);
    state.c1 = 1; state.c2 = 0;
    ui.h.value = 1; ui.k.value = 0;
    if (state.cutMode === 'dk') setDirFromDk();
    syncUI(); render();
  }

  function manual() { ui.preset.value = 'custom'; syncUI(); render(); }

  ui.preset.addEventListener('change', () => applyPreset(ui.preset.value));
  ui.xarxa.addEventListener('change', () => { setLattice(ui.xarxa.value); manual(); });
  ui.ratio.addEventListener('input', () => { state.ratio = +ui.ratio.value; manual(); });
  ui.gamma.addEventListener('input', () => { state.gamma = +ui.gamma.value; manual(); });
  ui.N.addEventListener('input', () => { state.N = +ui.N.value; syncUI(); render(); });
  ui.Z1.addEventListener('input', () => { state.Z1 = +ui.Z1.value; manual(); });
  ui.S1.addEventListener('input', () => { state.s1 = +ui.S1.value; manual(); });
  ui.dos.addEventListener('change', () => { state.two = ui.dos.checked; manual(); });
  ui.X2.addEventListener('input', () => { state.x2 = +ui.X2.value; manual(); });
  ui.Y2.addEventListener('input', () => { state.y2 = +ui.Y2.value; manual(); });
  ui.Z2.addEventListener('input', () => { state.Z2 = +ui.Z2.value; manual(); });
  ui.S2.addEventListener('input', () => { state.s2 = +ui.S2.value; manual(); });
  ui.terme.addEventListener('change', () => { state.term = ui.terme.value; render(); });
  ui.log.addEventListener('change', () => { state.log = ui.log.checked; render(); });
  ui.fase.addEventListener('change', () => { state.phase = ui.fase.checked; render(); });
  ui.anar.addEventListener('click', () => {
    state.c1 = Math.round(+ui.h.value || 0); state.c2 = Math.round(+ui.k.value || 0); dkChanged();
  });
  ui.snap.addEventListener('click', () => {
    state.c1 = Math.round(state.c1); state.c2 = Math.round(state.c2);
    ui.h.value = state.c1; ui.k.value = state.c2; dkChanged();
  });
  ui.cutMode.addEventListener('change', () => {
    state.cutMode = ui.cutMode.value;
    if (state.cutMode === 'dk') setDirFromDk(); else setDirFromHK();
    syncUI(); render();
  });
  ui.cutH.addEventListener('change', () => { setDirFromHK(); render(); });
  ui.cutK.addEventListener('change', () => { setDirFromHK(); render(); });
  ui.cutLog.addEventListener('change', () => { state.cutLog = ui.cutLog.checked; render(); });

  // Triar Δk clicant o arrossegant sobre el mapa
  let dragging = false;
  function pickFromEvent(ev) {
    const rect = cMap.getBoundingClientRect();
    const px = (ev.clientX - rect.left) * cMap.width / rect.width;
    const py = (ev.clientY - rect.top) * cMap.height / rect.height;
    const v = vectors();
    const dk = pxToDk(px, py, kmax(v));
    state.c1 = (dk.x * v.a1.x + dk.y * v.a1.y) / TAU;
    state.c2 = (dk.x * v.a2.x + dk.y * v.a2.y) / TAU;
    dkChanged();
  }
  cMap.addEventListener('mousedown', ev => { dragging = true; pickFromEvent(ev); });
  window.addEventListener('mouseup', () => { dragging = false; });
  cMap.addEventListener('mousemove', ev => { if (dragging) pickFromEvent(ev); });

  // Triar Δk sobre la línia clicant o arrossegant a la gràfica del tall
  let draggingCut = false;
  function pickFromCut(ev) {
    const rect = cCut.getBoundingClientRect();
    const px = (ev.clientX - rect.left) * cCut.width / rect.width;
    const v = vectors(), xm = cutXiMax(v, cutDir(v));
    const u = (px - CUT_M.l) / (cCut.width - CUT_M.l - CUT_M.r);
    const xi = Math.max(-xm, Math.min(xm, (2 * u - 1) * xm));
    state.c1 = xi * state.d1; state.c2 = xi * state.d2;
    render();
  }
  cCut.addEventListener('mousedown', ev => { draggingCut = true; pickFromCut(ev); });
  window.addEventListener('mouseup', () => { draggingCut = false; });
  cCut.addEventListener('mousemove', ev => { if (draggingCut) pickFromCut(ev); });

  // ---------------------------------------------------------------
  // Configuració des de l'URL (per als enllaços dels apunts) i còpia de l'enllaç
  //   ?preset=sqc_eq&terme=S&tall=1,1&dk=1,0&N=6&log=0&tallLog=1&fase=1
  //   també Z1, s1, Z2, s2, x2, y2 (i tall=dk: la línia passa pel Δk triat)
  // ---------------------------------------------------------------
  function fromURL() {
    const p = new URLSearchParams(location.search);
    applyPreset(PRESETS[p.get('preset')] ? p.get('preset') : 'sq1');
    let custom = false;
    const num = (k, set) => { if (p.has(k) && isFinite(+p.get(k))) set(+p.get(k)); };
    num('N', x => { state.N = Math.max(1, Math.min(20, Math.round(x))); });
    [['Z1', 'Z1'], ['s1', 's1'], ['Z2', 'Z2'], ['s2', 's2'], ['x2', 'x2'], ['y2', 'y2']].forEach(([k, key]) =>
      num(k, x => { state[key] = x; custom = true; if (k.endsWith('2')) state.two = true; }));
    if (['F', 'L', 'S', 'f'].includes(p.get('terme'))) state.term = p.get('terme');
    if (p.has('log')) state.log = p.get('log') !== '0';
    if (p.has('tallLog')) state.cutLog = p.get('tallLog') !== '0';
    if (p.has('fase')) state.phase = p.get('fase') !== '0';
    if (p.has('dk')) {
      const c = p.get('dk').split(',').map(Number);
      if (c.length === 2 && c.every(isFinite)) { state.c1 = c[0]; state.c2 = c[1]; }
    }
    const tall = p.get('tall');
    if (tall === 'dk') { state.cutMode = 'dk'; setDirFromDk(); }
    else if (tall) {
      const hk = tall.split(',').map(Number);
      if (hk.length === 2 && hk.every(isFinite)) { ui.cutH.value = hk[0]; ui.cutK.value = hk[1]; setDirFromHK(); }
    }
    if (custom) ui.preset.value = 'custom';
    ui.terme.value = state.term; ui.log.checked = state.log; ui.fase.checked = state.phase;
    ui.h.value = Math.round(state.c1); ui.k.value = Math.round(state.c2);
    syncUI(); render();
  }

  function currentURL() {
    const p = new URLSearchParams();
    const r = x => String(+(+x).toFixed(3));
    if (ui.preset.value !== 'custom') p.set('preset', ui.preset.value);
    else {
      p.set('preset', 'sq1');
      p.set('Z1', state.Z1); p.set('s1', r(state.s1));
      if (state.two) { p.set('x2', r(state.x2)); p.set('y2', r(state.y2)); p.set('Z2', state.Z2); p.set('s2', r(state.s2)); }
    }
    p.set('N', state.N);
    p.set('terme', state.term);
    p.set('log', state.log ? 1 : 0);
    p.set('tall', state.cutMode === 'dk' ? 'dk' : state.cutH + ',' + state.cutK);
    if (state.cutLog) p.set('tallLog', 1);
    if (state.phase) p.set('fase', 1);
    p.set('dk', r(state.c1) + ',' + r(state.c2));
    return location.origin + location.pathname + '?' + p.toString().replace(/%2C/g, ',');
  }
  $('btnEnllac').addEventListener('click', () => {
    const url = currentURL(), msg = $('msgEnllac');
    const ok = () => { msg.textContent = 'Enllaç copiat.'; setTimeout(() => { msg.textContent = ''; }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, () => prompt('Enllaç:', url));
    else prompt('Enllaç:', url);
  });

  fromURL();
})();
