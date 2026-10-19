// fourier_xarxa.js — sèrie de Fourier d'una funció periòdica: 1D (període a) i 2D (xarxa recíproca).
// Unitats: a = 1 (1D) i |a1| = 1 (2D).
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const VERD = '#009639', VERD_F = '#00722b', BLAU = '#1f6feb', TARONJA = '#d68910', VERMELL = '#c0392b', GRIS = '#8a9a90';
  const TAU = 2 * Math.PI;

  function prep(cv) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.font = '11px "Segoe UI", system-ui, sans-serif';
    return { c, w, h };
  }
  const fmt = (x, d = 2) => (Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x).toFixed(d);
  const cplx = (re, im) => fmt(re, 3) + (im < 0 ? ' − ' : ' + ') + fmt(Math.abs(im), 3) + 'i';
  function badge(el, ok, txtOk, txtNo) {
    el.className = 'badge ' + (ok ? 'constructiva' : 'destructiva');
    el.textContent = ok ? txtOk : txtNo;
  }

  // ═════════════════════════ PART 1: 1D ═════════════════════════
  const s1 = { f: 'gauss', sigma: 0.08, N: 4, nu: 1, snap: true, m: 1 };
  const M = 1024;           // mostres per cel·la per calcular els coeficients
  let coef1 = [];           // coef1[n] = [Re c_n, Im c_n] per a n = 0..30 (c_-n = conj c_n)

  function f1(x) {
    const u = x - Math.floor(x);
    const g = (x0, s) => { let v = 0; for (let j = -3; j <= 3; j++) { const d = x - x0 - j; v += Math.exp(-d * d / (2 * s * s)); } return v; };
    switch (s1.f) {
      case 'gauss': return g(0, s1.sigma);
      case 'base': return g(0, s1.sigma) + 0.6 * g(0.4, s1.sigma);
      case 'harm': return 0.5 + 0.6 * Math.cos(TAU * x) + 0.35 * Math.sin(2 * TAU * x) + 0.25 * Math.cos(3 * TAU * x);
      case 'quad': return u < 0.5 ? 1 : 0;
      case 'serra': return u;
    }
  }
  function calculaCoef1() {
    coef1 = [];
    const v = []; for (let j = 0; j < M; j++) v.push(f1((j + 0.5) / M));
    for (let n = 0; n <= 30; n++) {
      let re = 0, im = 0;
      for (let j = 0; j < M; j++) { const ph = -TAU * n * (j + 0.5) / M; re += v[j] * Math.cos(ph); im += v[j] * Math.sin(ph); }
      coef1.push([re / M, im / M]);
    }
  }
  // terme real de l'harmònic n (n i −n junts): 2 Re(c_n e^{i2πnx}); per a n = 0, c_0
  function terme(n, x) {
    const [re, im] = coef1[n];
    if (n === 0) return re;
    const ph = TAU * n * x;
    return 2 * (re * Math.cos(ph) - im * Math.sin(ph));
  }
  const suma1 = x => { let s = 0; for (let n = 0; n <= s1.N; n++) s += terme(n, x); return s; };

  const X0 = -1, X1 = 2;    // tres cel·les
  function eixX(c, w, x2p, y) {
    c.strokeStyle = '#ccc'; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    c.fillStyle = '#555';
    for (let m = Math.ceil(X0); m <= X1; m++) {
      const px = x2p(m);
      c.beginPath(); c.arc(px, y, 3.5, 0, TAU); c.fill();
      c.fillText(m === 0 ? '0' : m === 1 ? 'a' : m === -1 ? '−a' : m + 'a', px + 4, y + 13);
    }
  }
  function franges(c, h, x2p) {
    for (let m = Math.floor(X0); m < X1; m++) if (m % 2 === 0) {
      c.fillStyle = 'rgba(0,150,57,0.05)'; c.fillRect(x2p(m), 0, x2p(m + 1) - x2p(m), h);
    }
  }

  function dibuixa1a() {
    const { c, w, h } = prep($('cv1a'));
    const L = 34, R = 10, T = 12, B = 26;
    const x2p = x => L + (x - X0) / (X1 - X0) * (w - L - R);
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i <= 600; i++) { const x = X0 + (X1 - X0) * i / 600; const a = f1(x), b = suma1(x); mn = Math.min(mn, a, b); mx = Math.max(mx, a, b); }
    const pad = 0.08 * (mx - mn || 1); mn -= pad; mx += pad;
    const y2p = y => T + (mx - y) / (mx - mn) * (h - T - B);
    franges(c, h - B, x2p);
    eixX(c, w, x2p, y2p(Math.max(mn, Math.min(mx, 0))));
    const corba = (fn, color, lw) => { c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); for (let i = 0; i <= 900; i++) { const x = X0 + (X1 - X0) * i / 900; const p = [x2p(x), y2p(fn(x))]; i ? c.lineTo(...p) : c.moveTo(...p); } c.stroke(); };
    corba(f1, '#9aa7a0', 4);
    corba(suma1, VERD, 2);
    c.lineWidth = 1; c.fillStyle = VERD_F; c.fillText('suma amb |n| ≤ ' + s1.N, w - 130, T + 10);
  }

  function dibuixa1b() {
    const { c, w, h } = prep($('cv1b'));
    const nMax = Math.min(s1.N, 7), files = nMax + 1;
    const L = 104, R = 10, alt = h / files;
    const x2p = x => L + (x - X0) / (X1 - X0) * (w - L - R);
    franges(c, h, x2p);
    let amp = 0; for (let n = 1; n <= nMax; n++) amp = Math.max(amp, Math.hypot(...coef1[n]) * 2);
    amp = Math.max(amp, 1e-6);
    const nSel = Math.round(Math.abs(s1.nu));
    for (let n = 0; n <= nMax; n++) {
      const yc = alt * (n + 0.5);
      c.strokeStyle = '#eee'; c.beginPath(); c.moveTo(L, yc); c.lineTo(w - R, yc); c.stroke();
      c.fillStyle = n === nSel && s1.snap ? VERMELL : '#333';
      c.fillText(n === 0 ? 'n = 0 (mitjana)' : 'n = ' + n + ': període ' + (n === 1 ? 'a' : 'a/' + n), 4, yc + 4);
      if (n === 0) { c.fillStyle = '#666'; c.fillText('c₀ = ' + fmt(coef1[0][0], 3), L + 6, yc + 4); continue; }
      c.strokeStyle = n === nSel && s1.snap ? VERMELL : BLAU; c.lineWidth = n === nSel && s1.snap ? 2.2 : 1.5;
      c.beginPath();
      for (let i = 0; i <= 900; i++) { const x = X0 + (X1 - X0) * i / 900; const p = [x2p(x), yc - terme(n, x) / amp * alt * 0.42]; i ? c.lineTo(...p) : c.moveTo(...p); }
      c.stroke(); c.lineWidth = 1;
    }
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.setLineDash([3, 3]);
    for (let m = Math.ceil(X0); m <= X1; m++) { c.beginPath(); c.moveTo(x2p(m), 0); c.lineTo(x2p(m), h); c.stroke(); }
    c.setLineDash([]);
    if (s1.N > nMax) { c.fillStyle = '#666'; c.fillText('(es mostren fins a n = ' + nMax + ')', w - 160, h - 4); }
  }

  function dibuixa1c() {
    const { c, w, h } = prep($('cv1c'));
    const K = Math.max(6, s1.N + 1), L = 16, R = 16, B = 30, T = 10;
    const k2p = k => L + (k + K) / (2 * K) * (w - L - R);
    let mx = 0; for (let n = 0; n <= Math.min(K, 30); n++) mx = Math.max(mx, Math.hypot(...coef1[n]));
    const y0 = h - B, esc = (h - B - T) / (mx || 1);
    c.strokeStyle = '#999'; c.beginPath(); c.moveTo(L, y0); c.lineTo(w - R, y0); c.stroke();
    for (let n = -K; n <= K; n++) {
      const px = k2p(n), v = Math.hypot(...coef1[Math.min(Math.abs(n), 30)]), dins = Math.abs(n) <= s1.N;
      c.strokeStyle = '#bbb'; c.beginPath(); c.moveTo(px, y0); c.lineTo(px, y0 + 5); c.stroke();
      if (v > 1e-6) {
        c.strokeStyle = dins ? VERD : '#bbb'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(px, y0); c.lineTo(px, y0 - v * esc); c.stroke(); c.lineWidth = 1;
        c.fillStyle = dins ? VERD : '#bbb'; c.beginPath(); c.arc(px, y0 - v * esc, 3, 0, TAU); c.fill();
      }
      if (K <= 12 || n % 2 === 0) { c.fillStyle = '#555'; c.textAlign = 'center'; c.fillText(String(n), px, y0 + 16); }
    }
    c.textAlign = 'left'; c.fillStyle = '#555'; c.fillText('G / (2π/a)', w - 70, h - 2);
    const px = k2p(s1.nu);
    c.fillStyle = VERMELL; c.beginPath(); c.moveTo(px, y0 + 2); c.lineTo(px - 6, y0 + 12); c.lineTo(px + 6, y0 + 12); c.closePath(); c.fill();
  }

  function dibuixa1d() {
    const q = TAU * s1.nu;
    const { c, w, h } = prep($('cv1d'));
    const L = 34, R = 10, T = 10, B = 24;
    const x2p = x => L + (x - X0) / (X1 - X0) * (w - L - R);
    const y2p = y => T + (1.15 - y) / 2.3 * (h - T - B);
    franges(c, h - B, x2p);
    c.strokeStyle = '#ddd'; c.beginPath(); c.moveTo(L, y2p(0)); c.lineTo(w - R, y2p(0)); c.stroke();
    c.fillStyle = '#777'; c.fillText('1', 18, y2p(1) + 4); c.fillText('−1', 14, y2p(-1) + 4);
    c.strokeStyle = BLAU; c.lineWidth = 1.8; c.beginPath();
    for (let i = 0; i <= 900; i++) { const x = X0 + (X1 - X0) * i / 900; const p = [x2p(x), y2p(Math.cos(q * x))]; i ? c.lineTo(...p) : c.moveTo(...p); }
    c.stroke(); c.lineWidth = 1;
    for (let m = Math.ceil(X0); m <= X1; m++) {
      const v = Math.cos(q * m), px = x2p(m);
      c.fillStyle = m === s1.m ? VERMELL : '#333';
      c.beginPath(); c.arc(px, y2p(v), m === s1.m ? 5.5 : 4, 0, TAU); c.fill();
      c.fillStyle = '#555'; c.fillText(m === 0 ? '0' : m + 'a', px - 6, h - 6);
    }
    // cercle unitat amb els fasors e^{iqma}, m = -3..3
    const ce = prep($('cv1e')), cc = ce.c, R0 = Math.min(ce.w, ce.h) / 2 - 22, cx = ce.w / 2, cy = ce.h / 2;
    cc.strokeStyle = '#ccc'; cc.beginPath(); cc.arc(cx, cy, R0, 0, TAU); cc.stroke();
    cc.beginPath(); cc.moveTo(cx - R0 - 8, cy); cc.lineTo(cx + R0 + 8, cy); cc.moveTo(cx, cy - R0 - 8); cc.lineTo(cx, cy + R0 + 8); cc.stroke();
    cc.fillStyle = '#777'; cc.fillText('1', cx + R0 + 4, cy - 4); cc.fillText('Re', cx + R0 - 6, cy + 14); cc.fillText('Im', cx + 4, cy - R0 - 4);
    const totsA1 = Math.abs(s1.nu - Math.round(s1.nu)) < 1e-9;
    for (let m = -3; m <= 3; m++) {
      const ph = q * m, px = cx + R0 * Math.cos(ph), py = cy - R0 * Math.sin(ph);
      cc.strokeStyle = m === s1.m ? VERMELL : 'rgba(31,111,235,0.55)'; cc.lineWidth = m === s1.m ? 2.2 : 1.2;
      cc.beginPath(); cc.moveTo(cx, cy); cc.lineTo(px, py); cc.stroke();
      cc.fillStyle = m === s1.m ? VERMELL : BLAU; cc.beginPath(); cc.arc(px, py, 4, 0, TAU); cc.fill();
      if (!totsA1) { cc.fillStyle = '#333'; cc.fillText('m=' + m, cx + (R0 + 12) * Math.cos(ph) - 12, cy - (R0 + 12) * Math.sin(ph) + 4); }
    }
    if (totsA1) { cc.fillStyle = VERMELL; cc.fillText('tots els m', cx + R0 - 48, cy + 18); }
    cc.lineWidth = 1;
    // lectures
    const enter = Math.abs(s1.nu - Math.round(s1.nu)) < 1e-9;
    $('qa1').textContent = enter ? (Math.round(s1.nu) === 0 ? '0' : '2π · ' + Math.round(s1.nu)) : '2π · ' + fmt(s1.nu, 2);
    $('T1').textContent = s1.m === 0 ? '0' : s1.m === 1 ? 'a' : s1.m + 'a';
    $('eiqT1').textContent = cplx(Math.cos(q * s1.m), Math.sin(q * s1.m));
    badge($('badge1'), enter, 'q és de la xarxa recíproca: l\'ona té període a', 'q no és de la xarxa recíproca: exp(iqa) ≠ 1, no té període a');
  }

  function refresca1(recalcula) {
    if (recalcula) calculaCoef1();
    dibuixa1a(); dibuixa1b(); dibuixa1c(); dibuixa1d();
  }

  // ═════════════════════════ PART 2: 2D ═════════════════════════
  const s2 = { xarxa: 'hex', ratio: 1, gamma: 120, f: 'gauss', sigma: 0.12, N: 2, h: 1, k: 0, snap: true, n1: 1, n2: 1 };
  let a1, a2, b1, b2, Ac, base;   // geometria
  const PRESETS = { quad: [1, 90], rect: [1.4, 90], hex: [1, 120], obl: [1.25, 75] };

  function geometria() {
    const g = s2.gamma * Math.PI / 180;
    a1 = [1, 0]; a2 = [s2.ratio * Math.cos(g), s2.ratio * Math.sin(g)];
    const D = a1[0] * a2[1] - a1[1] * a2[0];
    Ac = Math.abs(D);
    b1 = [TAU * a2[1] / D, -TAU * a2[0] / D];
    b2 = [-TAU * a1[1] / D, TAU * a1[0] / D];
    // base en coordenades fraccionàries: [f1, f2, pes]
    base = s2.f === 'gauss' ? [[0, 0, 1]] : [[0, 0, 1], [1 / 3, 2 / 3, 0.7]];
  }
  const rec = (h, k) => [h * b1[0] + k * b2[0], h * b1[1] + k * b2[1]];
  const real = (u, v) => [u * a1[0] + v * a2[0], u * a1[1] + v * a2[1]];
  function coefG(h, k) {                 // c_G = (2πσ²/A_c) e^{-G²σ²/2} Σ_j w_j e^{-iG·d_j}
    const G = rec(h, k), G2 = G[0] * G[0] + G[1] * G[1], s = s2.sigma;
    const pref = TAU * s * s / Ac * Math.exp(-G2 * s * s / 2);
    let re = 0, im = 0;
    for (const [u, v, wj] of base) { const ph = -TAU * (h * u + k * v); re += wj * Math.cos(ph); im += wj * Math.sin(ph); }
    return [pref * re, pref * im];
  }

  // finestra de l'espai real: quadrat centrat a la cel·la 0
  const RW = 2.6;
  function finestraReal() { const c0 = real(0.5, 0.5); return { x0: c0[0] - RW / 2, y0: c0[1] - RW / 2, L: RW }; }

  function mapa(cv, valor, colorFn) {
    const { c, w, h } = prep(cv);
    const n = 150, img = c.createImageData(n, n), F = finestraReal();
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = F.x0 + F.L * (i + 0.5) / n, y = F.y0 + F.L * (1 - (j + 0.5) / n);
      const [r, g, b] = colorFn(valor(x, y)), p = 4 * (j * n + i);
      img.data[p] = r; img.data[p + 1] = g; img.data[p + 2] = b; img.data[p + 3] = 255;
    }
    const off = document.createElement('canvas'); off.width = n; off.height = n; off.getContext('2d').putImageData(img, 0, 0);
    c.imageSmoothingEnabled = true; c.drawImage(off, 0, 0, w, h);
    const r2p = (x, y) => [(x - F.x0) / F.L * w, h - (y - F.y0) / F.L * h];
    return { c, w, h, r2p };
  }
  const verdScale = v => { const t = Math.max(0, Math.min(1, v)); return [255 - t * 255, 255 - t * 105, 255 - t * 198]; };
  const divergent = v => { const t = Math.max(-1, Math.min(1, v)); return t > 0 ? [255, 255 - t * 190, 255 - t * 200] : [255 + t * 200, 255 + t * 145, 255]; };

  function xarxaSobre(o, opts = {}) {
    const { c, r2p } = o;
    for (let u = -4; u <= 5; u++) for (let v = -4; v <= 5; v++) {
      const [x, y] = real(u, v), [px, py] = r2p(x, y);
      if (px < -5 || py < -5 || px > o.w + 5 || py > o.h + 5) continue;
      c.fillStyle = opts.color ? opts.color(u, v) : '#222';
      c.beginPath(); c.arc(px, py, opts.r || 2.6, 0, TAU); c.fill();
      if (opts.vora) { c.strokeStyle = '#333'; c.lineWidth = 0.8; c.stroke(); }
    }
  }
  function fletxa(c, x0, y0, x1, y1, color, txt) {
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    const an = Math.atan2(y1 - y0, x1 - x0);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 9 * Math.cos(an - 0.4), y1 - 9 * Math.sin(an - 0.4)); c.lineTo(x1 - 9 * Math.cos(an + 0.4), y1 - 9 * Math.sin(an + 0.4)); c.closePath(); c.fill();
    c.lineWidth = 1; c.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    if (txt) c.fillText(txt, x1 + 4, y1 - 4);
    c.font = '11px "Segoe UI", system-ui, sans-serif';
  }

  function fExacta(x, y) {
    let v = 0; const s2s = 2 * s2.sigma * s2.sigma;
    for (const [u, w, pes] of base) {
      const d = real(u, w);
      for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
        const T = real(i, j), dx = x - T[0] - d[0], dy = y - T[1] - d[1], r2 = dx * dx + dy * dy;
        if (r2 < 9 * s2s) v += pes * Math.exp(-r2 / s2s);
      }
    }
    return v;
  }

  function dibuixa2ab() {
    const llista = [];
    for (let h = -s2.N; h <= s2.N; h++) for (let k = -s2.N; k <= s2.N; k++) llista.push([rec(h, k), coefG(h, k)]);
    $('nG2').textContent = llista.length;
    const suma = (x, y) => { let s = 0; for (const [G, [re, im]] of llista) { const ph = G[0] * x + G[1] * y; s += re * Math.cos(ph) - im * Math.sin(ph); } return s; };
    const vmax = Math.max(1, s2.f === 'base' ? 1.2 : 1);
    const cel = o => {      // cel·la i vectors primitius
      const { c, r2p } = o, p0 = r2p(0, 0), p1 = r2p(...a1), p2 = r2p(...a2), p3 = r2p(a1[0] + a2[0], a1[1] + a2[1]);
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(...p0); c.lineTo(...p1); c.lineTo(...p3); c.lineTo(...p2); c.closePath(); c.stroke(); c.setLineDash([]);
      fletxa(c, ...p0, ...p1, BLAU, 'a₁'); fletxa(c, ...p0, ...p2, BLAU, 'a₂');
    };
    const oa = mapa($('cv2a'), (x, y) => fExacta(x, y) / vmax, verdScale); xarxaSobre(oa, { r: 2 }); cel(oa);
    const ob = mapa($('cv2b'), (x, y) => suma(x, y) / vmax, verdScale); xarxaSobre(ob, { r: 2 }); cel(ob);
  }

  // espai recíproc: finestra quadrada centrada a l'origen
  let recEsc = null;
  function dibuixa2c() {
    const { c, w, h } = prep($('cv2c'));
    const Gmax = 3.3 * Math.max(Math.hypot(...b1), Math.hypot(...b2));
    const k2p = (x, y) => [w / 2 + x / Gmax * w / 2, h / 2 - y / Gmax * h / 2];
    recEsc = { Gmax, w, h };
    c.strokeStyle = '#eee'; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
    const c0 = Math.hypot(...coefG(0, 0)) || 1, rmax = 0.16 * w / 3.3;
    for (let hh = -6; hh <= 6; hh++) for (let kk = -6; kk <= 6; kk++) {
      const G = rec(hh, kk), [px, py] = k2p(...G);
      if (px < 0 || py < 0 || px > w || py > h) continue;
      const v = Math.hypot(...coefG(hh, kk)) / c0, r = Math.max(1.8, rmax * Math.sqrt(v));
      const dins = Math.abs(hh) <= s2.N && Math.abs(kk) <= s2.N;
      c.beginPath(); c.arc(px, py, r, 0, TAU);
      if (dins) { c.fillStyle = 'rgba(0,150,57,0.75)'; c.fill(); } else { c.strokeStyle = '#aaa'; c.stroke(); }
    }
    const o = k2p(0, 0);
    fletxa(c, ...o, ...k2p(...b1), TARONJA, 'b₁'); fletxa(c, ...o, ...k2p(...b2), TARONJA, 'b₂');
    const q = rec(s2.h, s2.k), [qx, qy] = k2p(...q);
    c.fillStyle = VERMELL; c.beginPath(); c.moveTo(qx, qy - 8); c.lineTo(qx - 7, qy + 5); c.lineTo(qx + 7, qy + 5); c.closePath(); c.fill();
    c.fillStyle = VERMELL; c.fillText('q', qx + 8, qy - 6);
  }

  function dibuixa2d() {
    const q = rec(s2.h, s2.k);
    const o = mapa($('cv2d'), (x, y) => Math.cos(q[0] * x + q[1] * y), divergent);
    xarxaSobre(o, { r: 4.2, vora: true, color: (u, v) => { const [r, g, b] = divergent(Math.cos(TAU * (s2.h * u + s2.k * v))); return 'rgb(' + r + ',' + g + ',' + b + ')'; } });
    const T = real(s2.n1, s2.n2), p0 = o.r2p(0, 0), pT = o.r2p(...T);
    if (s2.n1 || s2.n2) fletxa(o.c, ...p0, ...pT, '#111', 'T');
    o.c.strokeStyle = '#000'; o.c.lineWidth = 2.5; o.c.beginPath(); o.c.arc(...pT, 7, 0, TAU); o.c.stroke(); o.c.lineWidth = 1;
    // lectures
    const fase = s2.h * s2.n1 + s2.k * s2.n2, enter = Math.abs(s2.h - Math.round(s2.h)) < 1e-9 && Math.abs(s2.k - Math.round(s2.k)) < 1e-9;
    $('qT2').textContent = '2π · ' + (Math.abs(fase - Math.round(fase)) < 1e-9 ? String(Math.round(fase)) : fmt(fase, 2));
    $('eiqT2').textContent = cplx(Math.cos(TAU * fase), Math.sin(TAU * fase));
    badge($('badge2'), enter, 'q = G és de la xarxa recíproca: exp(iG·T) = 1 per a tots els T', 'q no és de la xarxa recíproca: l\'ona no té la periodicitat de la xarxa');
    const qn = Math.hypot(...q);
    $('d2').textContent = qn > 1e-9 ? fmt(TAU / qn, 3) : '∞';
  }

  function refresca2() {
    geometria();
    $('prodEscalars').textContent = 'Per a la xarxa d\'ara: a₁·b₁ = ' + fmt((a1[0] * b1[0] + a1[1] * b1[1]) / TAU, 3) + '·2π, a₁·b₂ = ' + fmt(a1[0] * b2[0] + a1[1] * b2[1], 3) +
      ', a₂·b₁ = ' + fmt(a2[0] * b1[0] + a2[1] * b1[1], 3) + ', a₂·b₂ = ' + fmt((a2[0] * b2[0] + a2[1] * b2[1]) / TAU, 3) + '·2π.';
    dibuixa2ab(); dibuixa2c(); dibuixa2d();
  }
  function refresca2Ona() { geometria(); dibuixa2c(); dibuixa2d(); }

  // ═════════════════════════ controls ═════════════════════════
  function slider(id, obj, clau, dec, cb) {
    const el = $(id), v = $(id + '_val');
    const posa = () => { obj[clau] = parseFloat(el.value); if (v) v.textContent = (+el.value).toFixed(dec); };
    el.addEventListener('input', () => { posa(); cb(); });
    posa();
    return el;
  }
  slider('sigma1', s1, 'sigma', 2, () => refresca1(true));
  slider('N1', s1, 'N', 0, () => refresca1(false));
  const elNu = slider('nu1', s1, 'nu', 2, () => refresca1(false));
  slider('m1', s1, 'm', 0, () => refresca1(false));
  $('f1').addEventListener('change', e => { s1.f = e.target.value; $('grupSigma1').style.display = (s1.f === 'gauss' || s1.f === 'base') ? '' : 'none'; refresca1(true); });
  $('snap1').addEventListener('change', e => {
    s1.snap = e.target.checked; elNu.step = s1.snap ? 1 : 0.01;
    if (s1.snap) { elNu.value = Math.round(+elNu.value); s1.nu = +elNu.value; $('nu1_val').textContent = s1.nu.toFixed(2); }
    refresca1(false);
  });

  slider('ratio2', s2, 'ratio', 2, refresca2);
  slider('gamma2', s2, 'gamma', 0, refresca2);
  slider('sigma2', s2, 'sigma', 2, refresca2);
  slider('N2', s2, 'N', 0, refresca2);
  const elH = slider('h2', s2, 'h', 0, refresca2Ona), elK = slider('k2', s2, 'k', 0, refresca2Ona);
  slider('n1_2', s2, 'n1', 0, refresca2Ona); slider('n2_2', s2, 'n2', 0, refresca2Ona);
  $('f2').addEventListener('change', e => { s2.f = e.target.value; refresca2(); });
  $('xarxa2').addEventListener('change', e => {
    s2.xarxa = e.target.value; const [r, g] = PRESETS[s2.xarxa];
    $('ratio2').value = r; $('gamma2').value = g; s2.ratio = r; s2.gamma = g;
    $('ratio2_val').textContent = r.toFixed(2); $('gamma2_val').textContent = g;
    refresca2();
  });
  function posaHK(h, k) {
    s2.h = h; s2.k = k; elH.value = h; elK.value = k;
    $('h2_val').textContent = s2.snap ? String(h) : h.toFixed(2); $('k2_val').textContent = s2.snap ? String(k) : k.toFixed(2);
  }
  $('snap2').addEventListener('change', e => {
    s2.snap = e.target.checked; elH.step = elK.step = s2.snap ? 1 : 0.01;
    if (s2.snap) posaHK(Math.round(s2.h), Math.round(s2.k));
    refresca2Ona();
  });
  [elH, elK].forEach(el => el.addEventListener('input', () => { $('h2_val').textContent = s2.snap ? String(s2.h) : s2.h.toFixed(2); $('k2_val').textContent = s2.snap ? String(s2.k) : s2.k.toFixed(2); }));
  $('cv2c').addEventListener('click', ev => {
    if (!recEsc) return;
    const r = ev.currentTarget.getBoundingClientRect(), { Gmax, w, h } = recEsc;
    const qx = ((ev.clientX - r.left) - w / 2) / (w / 2) * Gmax, qy = (h / 2 - (ev.clientY - r.top)) / (h / 2) * Gmax;
    // q = h b1 + k b2  ⇒  h = q·a1/2π, k = q·a2/2π
    let hh = (qx * a1[0] + qy * a1[1]) / TAU, kk = (qx * a2[0] + qy * a2[1]) / TAU;
    if (s2.snap) { hh = Math.round(hh); kk = Math.round(kk); } else { hh = Math.round(hh * 100) / 100; kk = Math.round(kk * 100) / 100; }
    posaHK(Math.max(-3, Math.min(3, hh)), Math.max(-3, Math.min(3, kk)));
    refresca2Ona();
  });

  // casella numèrica al costat de cada lliscador de l'ona de prova, per escriure valors fraccionaris
  function caixaNum(sl, snapEl) {
    const n = document.createElement('input');
    n.type = 'number'; n.className = 'num-input'; n.step = '0.01'; n.min = sl.min; n.max = sl.max; n.value = sl.value;
    n.style.marginTop = '4px';
    sl.insertAdjacentElement('afterend', n);
    sl.addEventListener('input', () => { n.value = (+sl.value).toFixed(2).replace(/\.00$/, ''); });
    n.addEventListener('change', () => {
      let v = parseFloat(n.value); if (isNaN(v)) return;
      v = Math.max(+sl.min, Math.min(+sl.max, v));
      if (v !== Math.round(v) && snapEl.checked) { snapEl.checked = false; snapEl.dispatchEvent(new Event('change')); }
      sl.value = v; sl.dispatchEvent(new Event('input'));
      n.value = (+sl.value).toFixed(2).replace(/\.00$/, '');
    });
    snapEl.addEventListener('change', () => { n.value = (+sl.value).toFixed(2).replace(/\.00$/, ''); });
  }
  caixaNum(elNu, $('snap1')); caixaNum(elH, $('snap2')); caixaNum(elK, $('snap2'));
  $('cv2c').addEventListener('click', () => [elH, elK].forEach(sl => sl.dispatchEvent(new Event('input'))));

  // targetes plegables (com a la resta de simuladors)
  // també les caixes dels gràfics i la de teoria: el títol fa de botó i la resta va a .card-body
  document.querySelectorAll('.card').forEach(card => {
    if (card.querySelector('.collapsible-title')) return;
    let tit = card.querySelector(':scope > .plot-title');
    if (!tit) { tit = document.createElement('p'); tit.className = 'plot-title'; tit.textContent = 'Teoria'; card.prepend(tit); }
    const cos = document.createElement('div'); cos.className = 'card-body';
    while (tit.nextSibling) cos.appendChild(tit.nextSibling);
    card.appendChild(cos);
    const txt = document.createElement('span'); while (tit.firstChild) txt.appendChild(tit.firstChild); tit.appendChild(txt);
    tit.classList.add('collapsible-title');
    const tri = document.createElement('span'); tri.className = 'card-tri'; tri.textContent = '▼'; tit.prepend(tri);
  });
  document.querySelectorAll('.collapsible-title').forEach(t => t.addEventListener('click', () => {
    const card = t.closest('.card'); card.classList.toggle('collapsed');
    const tri = t.querySelector('.card-tri'); if (tri) tri.textContent = card.classList.contains('collapsed') ? '▶' : '▼';
    window.dispatchEvent(new Event('resize'));       // els gràfics que tornen a ser visibles es redibuixen
  }));

  let espera = null;
  window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(() => { refresca1(false); refresca2(); }, 120); });
  refresca1(true);
  refresca2();
})();
