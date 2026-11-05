// Simulador — Einstein i Debye a l'espai de fases: oscil·ladors independents o correlacionats.
//
// Dues cadenes de N àtoms (plans (100) de coure, ones longitudinals, com al Tema 4) amb la
// mateixa energia per àtom ε:
//   · Einstein: cada àtom és un oscil·lador independent entre els veïns quiets,
//     M ü = −2C u, ω_E = √(2C/M), amb una fase pròpia (a l'atzar, amb llavor reproduïble).
//   · Debye: un sol mode normal de la cadena amb condicions periòdiques, q = 2πm/(Nd),
//     ω = 2√(C/M)|sin(qd/2)| (cadena exacta) o ω = v_s q (aproximació de Debye).
// El moviment és harmònic i es calcula exactament, sense integrar: a l'espai de fases escalat
// (x, p/Mω) cada àtom recorre una circumferència en sentit horari amb velocitat angular ω.
// Unitats internes: Å, ps (ω en rad/ps, de manera que ω/2π surt en THz) i meV.

(function () {
  'use strict';
  const { fmt, Plot } = Fon;
  const TAU = Fon.TAU;
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------
  // Constants i material
  // ---------------------------------------------------------------
  const U = 1.66053907e-27, MEV = 1.602176634e-22, KB = 1.380649e-23;
  const MAT = { M: 63.546, d: 1.8075, C: 60.7 };       // u, Å, N/m (Cu, ones L al llarg de [100])
  const MKG = MAT.M * U;
  const W0 = Math.sqrt(MAT.C / MKG) * 1e-12;           // √(C/M), rad/ps
  const WE = Math.SQRT2 * W0;                          // Einstein: l'àtom entre els dos veïns quiets
  const EPS_REF = 50;                                  // meV: fixa l'escala dels diagrames
  const NMAX = 80;
  const COL_E = '#b26a00', COL_D = '#1f6feb', INK = '#1a1d24', MUTED = '#6b7280';
  const RITME = (TAU / WE) / 2.5;                      // ps de simulació per segon real (un gir d'Einstein = 2.5 s)
  // amplitud (Å) d'un oscil·lador d'energia e (meV) i freqüència w (rad/ps)
  const amp = (e, w) => Math.sqrt(2 * e * MEV / MKG) / (w * 1e12) * 1e10;

  const state = {
    N: 16, eps: 25, m: 1, ona: 'viatgera', disp: 'cadena', ein: 'igual', llavor: 97,
    exag: 5, vel: 1, playing: true, uneix: true, orbites: true, colors: true, sel: 9
  };
  let t = 0;                                           // ps

  // ---------------------------------------------------------------
  // Atzar reproduïble (la llavor va a l'enllaç)
  // ---------------------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let r = Math.imul(a ^ a >>> 15, 1 | a);
      r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }
  let fasesE = [], pesE = [];
  function sorteja() {
    const r = mulberry32(Math.imul(state.llavor, 2654435761));
    fasesE = []; pesE = [];
    for (let n = 0; n < NMAX; n++) { fasesE.push(TAU * r()); pesE.push(-Math.log(1 - r())); }
  }

  // ---------------------------------------------------------------
  // Física
  // ---------------------------------------------------------------
  const maxM = () => Math.floor(state.N / 2);
  const nUn = () => Math.floor(state.N / 2);           // l'àtom que ho rep tot a «tota en un sol àtom»
  let mod = null;

  function calcula() {
    const N = state.N, m = state.m, eps = state.eps;
    // Einstein: amplitud de cada àtom
    const AE = new Array(N).fill(0);
    if (state.ein === 'igual') AE.fill(amp(eps, WE));
    else if (state.ein === 'termic') {
      let s = 0;
      for (let n = 0; n < N; n++) s += pesE[n];
      for (let n = 0; n < N; n++) AE[n] = amp(N * eps * pesE[n] / s, WE);
    } else AE[nUn()] = amp(N * eps, WE);
    // Debye: un mode
    const qd = TAU * m / N;
    const wD = state.disp === 'debye' ? qd * W0 : 2 * W0 * Math.sin(qd / 2);
    let AD;
    if (state.ona === 'viatgera') AD = amp(eps, wD);
    else {
      let S = 0;
      for (let n = 0; n < N; n++) S += Math.pow(Math.cos(qd * n), 2);
      AD = amp(N * eps / S, wD);
    }
    const maxAE = Math.max(...AE);
    mod = {
      N, m, qd, wD, AE, AD,
      RE: Math.max(1.2 * amp(EPS_REF, WE), 1.1 * maxAE),
      RD: Math.max(1.2 * amp(EPS_REF, wD), 1.1 * AD)
    };
    // exageració efectiva del dibuix, limitada per a cada cadena: que els àtoms d'Einstein
    // no toquin les parets, i que els de Debye no se superposin ni es desplacin més d'una cel·la
    // (amb m petit i la mateixa energia, l'amplitud de Debye pot ser molt més gran)
    mod.exE = maxAE > 0 ? Math.min(state.exag, 0.42 * MAT.d / maxAE) : state.exag;
    const rel = 2 * AD * Math.abs(Math.sin(qd / 2));
    mod.exD = Math.min(state.exag, 1.0 * MAT.d / AD, rel > 0 ? 0.7 * MAT.d / rel : Infinity);
    // colors
    const col = (n, c0) => state.colors ? 'hsl(' + Math.round(360 * n / N) + ',72%,45%)' : c0;
    mod.colE = []; mod.colD = [];
    for (let n = 0; n < N; n++) { mod.colE.push(col(n, COL_E)); mod.colD.push(col(n, COL_D)); }
    // correlacions (no depenen del temps: tots els punts giren junts)
    mod.CE = correlacio(posE); mod.CD = correlacio(posD);
  }

  // [x, p/Mω] (Å) de l'àtom n a l'instant tt (n pot ser no enter per a l'ona contínua de Debye)
  function posE(n, tt) {
    const th = fasesE[n] - WE * tt, a = mod.AE[n];
    return [a * Math.cos(th), a * Math.sin(th)];
  }
  function posD(n, tt) {
    if (state.ona === 'viatgera') {
      const th = mod.qd * n - mod.wD * tt;
      return [mod.AD * Math.cos(th), mod.AD * Math.sin(th)];
    }
    const a = mod.AD * Math.cos(mod.qd * n);
    return [a * Math.cos(mod.wD * tt), -a * Math.sin(mod.wD * tt)];
  }

  // C(k) = Σ (x_n x_{n+k} + p̃_n p̃_{n+k}) / Σ (x_n² + p̃_n²),   p̃ = p/Mω
  function correlacio(pos) {
    const N = mod.N, P = [];
    for (let n = 0; n < N; n++) P.push(pos(n, 0));
    let s0 = 0;
    P.forEach(q => { s0 += q[0] * q[0] + q[1] * q[1]; });
    const out = [];
    for (let k = 0; k <= Math.floor(N / 2); k++) {
      let s = 0;
      for (let n = 0; n < N; n++) { const a = P[n], b = P[(n + k) % N]; s += a[0] * b[0] + a[1] * b[1]; }
      out.push(s0 > 0 ? s / s0 : 0);
    }
    return out;
  }

  // ---------------------------------------------------------------
  // Les dues cadenes
  // ---------------------------------------------------------------
  const cC = $('canvasCadenes'), gC = cC.getContext('2d');
  const LAY = {
    x0: 40, x1: 848, hS: 38, sep: 213,
    E: { tit: 20, y: 66, strip: 150 },
    D: { tit: 234, y: 280, strip: 364 }
  };
  const espai = () => (LAY.x1 - LAY.x0) / mod.N;
  const lloc = n => LAY.x0 + (n + 0.5) * espai();

  // molla en zig-zag de xa a xb; el nombre de voltes depèn de la longitud de repòs L0
  function molla(g, xa, xb, y, L0, alpha) {
    const L = xb - xa, e = L0 > 0 ? (L - L0) / L0 : 0;
    g.strokeStyle = e > 0.04 ? 'rgba(214,39,40,' + Math.min(1, 0.4 + 2 * e) + ')'
      : e < -0.04 ? 'rgba(41,128,185,' + Math.min(1, 0.4 - 2 * e) + ')' : '#9aa8a0';
    g.lineWidth = 1.2; g.globalAlpha = alpha === undefined ? 1 : alpha;
    g.beginPath(); g.moveTo(xa, y);
    if (L0 > 8 && L > 2) {
      const nz = Math.max(4, Math.min(10, Math.round(L0 / 5))), am = Math.min(4.5, L0 / 4);
      for (let i = 1; i < nz; i++) g.lineTo(xa + L * i / nz, y + (i % 2 ? am : -am));
    }
    g.lineTo(xb, y); g.stroke(); g.globalAlpha = 1;
  }
  function anella(g, x, y, r, w) {
    g.strokeStyle = INK; g.lineWidth = w; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  }
  function titol(g, q, y) {
    const x0 = LAY.x0, N = mod.N;
    g.fillStyle = q === 'E' ? COL_E : COL_D;
    g.fillRect(x0, y - 9, 10, 10);
    g.font = 'bold 12px sans-serif'; g.textAlign = 'left'; g.fillStyle = INK;
    const nom = q === 'E' ? "Model d'Einstein" : 'Model de Debye';
    g.fillText(nom, x0 + 16, y);
    const w = g.measureText(nom).width;
    g.font = '12px sans-serif'; g.fillStyle = '#3c4250';
    const txt = q === 'E'
      ? '  ·  ' + N + ' oscil·ladors independents, tots amb ν_E = ' + fmt(WE / TAU, 2) + ' THz i cadascun amb la seva fase'
      : '  ·  un mode normal de tota la cadena: m = ' + mod.m + ', λ = ' + fmt(N / mod.m, 2) + ' d, ν = ' + fmt(mod.wD / TAU, 2) +
        ' THz, desfasament entre veïns qd = ' + fmt(360 * mod.m / N, 1) + '°';
    g.fillText(txt, x0 + 16 + w, y);
  }

  function dibuixaCadena(q) {
    const g = gC, N = mod.N, B = LAY[q], sp = espai(), y = B.y;
    const r = Math.max(2.2, Math.min(8, sp * 0.26)), k = (q === 'E' ? mod.exE : mod.exD) * sp / MAT.d;   // px per Å
    const pos = q === 'E' ? posE : posD, cols = q === 'E' ? mod.colE : mod.colD;
    const u = [], xa = [];
    for (let n = 0; n < N; n++) { u.push(pos(n, t)[0]); xa.push(lloc(n) + u[n] * k); }
    titol(g, q, B.tit);

    // posicions d'equilibri: marques sota la cadena
    g.strokeStyle = '#b9c3bd'; g.lineWidth = 1;
    for (let n = 0; n < N; n++) { g.beginPath(); g.moveTo(lloc(n), y + r + 3); g.lineTo(lloc(n), y + r + 8); g.stroke(); }

    const h = Math.max(9, r + 6);
    if (q === 'E') {
      // parets fixes entre cel·les i dues molles per àtom
      g.strokeStyle = '#8a958e'; g.lineWidth = 2;
      for (let n = 0; n <= N; n++) { const xw = LAY.x0 + n * sp; g.beginPath(); g.moveTo(xw, y - h); g.lineTo(xw, y + h); g.stroke(); }
      const L0 = sp / 2 - r - 1;
      for (let n = 0; n < N; n++) {
        molla(g, LAY.x0 + n * sp + 1, xa[n] - r, y, L0);
        molla(g, xa[n] + r, LAY.x0 + (n + 1) * sp - 1, y, L0);
      }
    } else {
      const L0 = sp - 2 * r;
      for (let n = 0; n < N - 1; n++) molla(g, xa[n] + r, xa[n + 1] - r, y, L0);
      // l'últim àtom unit al primer (condicions periòdiques): la molla surt per un costat i entra per l'altre
      g.save(); g.beginPath(); g.rect(LAY.x0 - 8, 0, LAY.x1 - LAY.x0 + 16, cC.height); g.clip();
      molla(g, xa[N - 1] + r, xa[0] + N * sp - r, y, L0, 0.45);
      molla(g, xa[N - 1] - N * sp + r, xa[0] - r, y, L0, 0.45);
      g.restore();
      g.fillStyle = MUTED; g.font = '10px sans-serif'; g.textAlign = 'right';
      g.fillText("↻ l'últim àtom està unit al primer", LAY.x1, y + r + 22);
    }
    for (let n = 0; n < N; n++) {
      g.beginPath(); g.arc(xa[n], y, r, 0, TAU); g.fillStyle = cols[n]; g.fill();
      g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke();
    }
    const s = state.sel;
    if (s >= 0 && s < N) {
      [(s + N - 1) % N, (s + 1) % N].forEach(j => anella(g, xa[j], y, r + 3, 1.2));
      anella(g, xa[s], y, r + 4, 2.4);
      g.fillStyle = INK; g.font = 'bold 11px sans-serif'; g.textAlign = 'center';
      g.fillText(String(s), xa[s], y - h - 4);
    }

    // desplaçament de cada àtom, en vertical
    const R = q === 'E' ? mod.RE : mod.RD, ks = LAY.hS / R, yb = B.strip;
    g.strokeStyle = '#e3e7e3'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(LAY.x0, yb); g.lineTo(LAY.x1, yb); g.stroke();
    g.fillStyle = MUTED; g.font = '10px sans-serif'; g.textAlign = 'left';
    g.fillText('desplaçament uₙ de cada àtom, dibuixat en vertical (escala ±' + fmt(R, 2) + ' Å)', LAY.x0, yb - LAY.hS - 6);
    if (q === 'D') {
      g.strokeStyle = 'rgba(31,111,235,0.35)'; g.lineWidth = 1.6; g.beginPath();
      for (let px = LAY.x0; px <= LAY.x1; px += 2) {
        const yy = yb - posD((px - LAY.x0) / sp - 0.5, t)[0] * ks;
        if (px === LAY.x0) g.moveTo(px, yy); else g.lineTo(px, yy);
      }
      g.stroke();
    }
    g.strokeStyle = 'rgba(60,66,80,0.45)'; g.lineWidth = 1; g.beginPath();
    for (let n = 0; n < N; n++) { const yy = yb - u[n] * ks; if (n) g.lineTo(lloc(n), yy); else g.moveTo(lloc(n), yy); }
    g.stroke();
    const rs = Math.max(2, Math.min(4, sp * 0.2));
    for (let n = 0; n < N; n++) { g.beginPath(); g.arc(lloc(n), yb - u[n] * ks, rs, 0, TAU); g.fillStyle = cols[n]; g.fill(); }
    if (s >= 0 && s < N) anella(g, lloc(s), yb - u[s] * ks, rs + 3, 1.8);
  }

  function dibuixaCadenes() {
    gC.clearRect(0, 0, cC.width, cC.height);
    dibuixaCadena('E');
    gC.strokeStyle = '#e3e7e3'; gC.lineWidth = 1;
    gC.beginPath(); gC.moveTo(10, LAY.sep); gC.lineTo(cC.width - 10, LAY.sep); gC.stroke();
    dibuixaCadena('D');
  }

  // ---------------------------------------------------------------
  // Espai de fases
  // ---------------------------------------------------------------
  const cFE = $('canvasFaseE'), cFD = $('canvasFaseD');
  const ultim = { E: null, D: null };                // punts i gràfica de l'últim dibuix (per als clics)

  function dibuixaFase(c, q) {
    const N = mod.N, R = q === 'E' ? mod.RE : mod.RD, pos = q === 'E' ? posE : posD;
    const w = q === 'E' ? WE : mod.wD, cols = q === 'E' ? mod.colE : mod.colD;
    const p = Plot(c, { xmin: -R, xmax: R, ymin: -R, ymax: R, m: { l: 50, r: 14, t: 14, b: 40 } });
    const g = p.g;
    p.clear();
    p.axes('x = uₙ (Å)', q === 'E' ? 'p / Mω_E (Å)' : 'p / Mω (Å)', { nx: 5, ny: 5 });
    p.vline(0, { col: '#9aa8a0', w: 1 });
    const P = [];
    for (let n = 0; n < N; n++) P.push(pos(n, t));
    ultim[q] = { p, P };

    p.clip();
    // òrbites
    if (state.orbites) {
      const radis = [];
      P.forEach(z => { const rr = Math.hypot(z[0], z[1]); if (rr > 1e-9 && !radis.some(x => Math.abs(x - rr) < 0.004 * R)) radis.push(rr); });
      g.strokeStyle = 'rgba(60,66,80,0.16)'; g.lineWidth = 1;
      radis.forEach(rr => { g.beginPath(); g.ellipse(p.X(0), p.Y(0), p.X(rr) - p.X(0), p.Y(0) - p.Y(rr), 0, 0, TAU); g.stroke(); });
    }
    // polígon que uneix cada àtom amb el següent (l'últim amb el primer)
    if (state.uneix) {
      g.strokeStyle = 'rgba(60,66,80,0.38)'; g.lineWidth = 1.1; g.beginPath();
      P.forEach((z, n) => { if (n) g.lineTo(p.X(z[0]), p.Y(z[1])); else g.moveTo(p.X(z[0]), p.Y(z[1])); });
      g.closePath(); g.stroke();
    }
    // cues: on era cada àtom fa un moment
    const cua = 0.14 * TAU / w, K = 10;
    g.lineCap = 'round'; g.lineWidth = 3;
    for (let n = 0; n < N; n++) {
      let a = P[n];
      if (Math.hypot(a[0], a[1]) < 1e-9) continue;
      g.strokeStyle = cols[n];
      for (let j = 1; j <= K; j++) {
        const b = pos(n, t - cua * j / K);
        g.globalAlpha = 0.5 * (1 - j / (K + 1));
        g.beginPath(); g.moveTo(p.X(a[0]), p.Y(a[1])); g.lineTo(p.X(b[0]), p.Y(b[1])); g.stroke();
        a = b;
      }
    }
    g.globalAlpha = 1; g.lineCap = 'butt';
    // àtom ressaltat i els seus veïns
    const s = state.sel, rp = N > 48 ? 4 : 5;
    let ve = [];
    if (s >= 0 && s < N) {
      ve = [(s + N - 1) % N, (s + 1) % N];
      g.strokeStyle = INK; g.lineWidth = 2;
      ve.forEach(j => { g.beginPath(); g.moveTo(p.X(P[s][0]), p.Y(P[s][1])); g.lineTo(p.X(P[j][0]), p.Y(P[j][1])); g.stroke(); });
    }
    // àtoms
    for (let n = 0; n < N; n++) {
      g.beginPath(); g.arc(p.X(P[n][0]), p.Y(P[n][1]), rp, 0, TAU);
      g.fillStyle = cols[n]; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke();
    }
    if (s >= 0 && s < N) {
      ve.forEach(j => anella(g, p.X(P[j][0]), p.Y(P[j][1]), rp + 3, 1.3));
      anella(g, p.X(P[s][0]), p.Y(P[s][1]), rp + 4, 2.4);
      // etiquetes; si diversos àtoms cauen al mateix lloc, una sola etiqueta amb tots els índexs
      g.font = 'bold 11px sans-serif'; g.fillStyle = INK; g.textAlign = 'center';
      const etiq = [];
      [s].concat(ve).sort((a, b) => a - b).forEach(j => {
        const z = P[j], rr = Math.hypot(z[0], z[1]), ux = rr > 1e-9 ? z[0] / rr : 0, uy = rr > 1e-9 ? z[1] / rr : 1;
        const x = p.X(z[0]) + 17 * ux, y = p.Y(z[1]) - 17 * uy + 4, e = etiq.find(o => Math.hypot(o.x - x, o.y - y) < 9);
        if (e) e.txt += ', ' + j; else etiq.push({ x, y, txt: String(j) });
      });
      etiq.forEach(o => g.fillText(o.txt, o.x, o.y));
    }
    p.unclip();
    // rètol
    g.font = '11px sans-serif'; g.fillStyle = MUTED; g.textAlign = 'left';
    g.fillText((q === 'E' ? 'tots amb ν_E = ' : 'ν = ') + fmt(w / TAU, 2) + ' THz · gir horari ↻', p.m.l + 6, p.m.t + 13);
    g.textAlign = 'right';
    g.fillText('t = ' + t.toFixed(2) + ' ps', c.width - p.m.r - 6, p.m.t + 13);
  }

  // ---------------------------------------------------------------
  // Correlació entre veïns: u_{n+1} en funció de u_n (un punt per a cada parell)
  // ---------------------------------------------------------------
  const cVE = $('canvasVeiE'), cVD = $('canvasVeiD');
  // coeficient de correlació de Pearson entre u_n i u_{n+1} (condicions periòdiques)
  function pearson(u) {
    const N = u.length, mu = u.reduce((s, x) => s + x, 0) / N;
    let sxy = 0, sxx = 0;
    for (let n = 0; n < N; n++) { const a = u[n] - mu, b = u[(n + 1) % N] - mu; sxy += a * b; sxx += a * a; }
    return sxx > 1e-14 ? sxy / sxx : NaN;
  }
  function dibuixaVeins(c, q) {
    const N = mod.N, R = q === 'E' ? mod.RE : mod.RD, pos = q === 'E' ? posE : posD;
    const w = q === 'E' ? WE : mod.wD, cols = q === 'E' ? mod.colE : mod.colD;
    const p = Plot(c, { xmin: -R, xmax: R, ymin: -R, ymax: R, m: { l: 50, r: 14, t: 14, b: 40 } });
    const g = p.g;
    p.clear();
    p.axes('uₙ, desplaçament de l\'àtom n (Å)', 'uₙ₊₁, desplaçament del següent (Å)', { nx: 5, ny: 5 });
    p.vline(0, { col: '#9aa8a0', w: 1 });
    p.pts([[-R, -R], [R, R]], { col: '#9aa8a0', w: 1, dash: [5, 4] });
    p.pts([[-R, R], [R, -R]], { col: '#9aa8a0', w: 1, dash: [5, 4] });
    p.text('en fase', -0.96 * R, -0.96 * R, { col: MUTED, font: '10px sans-serif', dx: 10, dy: 2 });
    p.text('en oposició', 0.96 * R, -0.96 * R, { col: MUTED, font: '10px sans-serif', align: 'right', dx: -10, dy: 2 });
    const u = [];
    for (let n = 0; n < N; n++) u.push(pos(n, t)[0]);
    const P = u.map((x, n) => [x, u[(n + 1) % N]]);
    ultim['V' + q] = { p, P };

    p.clip();
    // trajectòria de cada parell en un període: una el·lipse (Lissajous amb la mateixa freqüència)
    if (state.orbites) {
      const una = q === 'D' && state.ona === 'viatgera';      // totes les parelles fan la mateixa
      const per = TAU / w, K = 72;
      g.strokeStyle = una ? 'rgba(60,66,80,0.30)' : 'rgba(60,66,80,0.13)'; g.lineWidth = 1;
      for (let n = 0; n < (una ? 1 : N); n++) {
        g.beginPath();
        for (let j = 0; j <= K; j++) {
          const tt = per * j / K, x = p.X(pos(n, tt)[0]), y = p.Y(pos((n + 1) % N, tt)[0]);
          if (j) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
      }
    }
    // cues
    const cua = 0.14 * TAU / w, K = 10;
    g.lineCap = 'round'; g.lineWidth = 3;
    for (let n = 0; n < N; n++) {
      let a = P[n];
      g.strokeStyle = cols[n];
      for (let j = 1; j <= K; j++) {
        const tt = t - cua * j / K, b = [pos(n, tt)[0], pos((n + 1) % N, tt)[0]];
        g.globalAlpha = 0.5 * (1 - j / (K + 1));
        g.beginPath(); g.moveTo(p.X(a[0]), p.Y(a[1])); g.lineTo(p.X(b[0]), p.Y(b[1])); g.stroke();
        a = b;
      }
    }
    g.globalAlpha = 1; g.lineCap = 'butt';
    const rp = N > 48 ? 4 : 5;
    for (let n = 0; n < N; n++) {
      g.beginPath(); g.arc(p.X(P[n][0]), p.Y(P[n][1]), rp, 0, TAU);
      g.fillStyle = cols[n]; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke();
    }
    const s = state.sel;
    if (s >= 0 && s < N) {
      const x = p.X(P[s][0]), y = p.Y(P[s][1]);
      anella(g, x, y, rp + 4, 2.4);
      g.font = 'bold 11px sans-serif'; g.fillStyle = INK; g.textAlign = 'left';
      g.fillText('(' + s + ', ' + (s + 1) % N + ')', x + rp + 7, y - rp - 4);
    }
    p.unclip();
    const r = pearson(u);
    g.font = '11px sans-serif'; g.fillStyle = MUTED; g.textAlign = 'left';
    g.fillText('r = ' + (isFinite(r) ? fmt(r, 2) : '—') + ' en aquest instant', p.m.l + 6, p.m.t + 13);
    if (q === 'D') { g.textAlign = 'right'; g.fillText('cos qd = ' + fmt(Math.cos(mod.qd), 2), c.width - p.m.r - 6, p.m.t + 13); }
  }

  // ---------------------------------------------------------------
  // Correlació
  // ---------------------------------------------------------------
  const cK = $('canvasCorr');
  let hoverK = null, pK = null;
  function punts(g, p, arr, col) {
    arr.forEach(z => { g.beginPath(); g.arc(p.X(z[0]), p.Y(z[1]), 4.5, 0, TAU); g.fillStyle = col; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke(); });
  }
  function dibuixaCorr() {
    const N = mod.N, Km = Math.floor(N / 2);
    const p = Plot(cK, { xmin: -0.4, xmax: Km + 0.4, ymin: -1.15, ymax: 1.15, m: { l: 50, r: 14, t: 14, b: 40 } });
    const g = p.g;
    pK = p; p.clear();
    const st = Km <= 20 ? 1 : Km <= 40 ? 2 : 5, xt = [];
    for (let k = 0; k <= Km; k += st) xt.push(k);
    p.axes('distància entre els dos àtoms, k (en unitats de d)', 'C(k)', { xticks: xt, yticks: [-1, -0.5, 0, 0.5, 1] });
    // marge de l'atzar: ±2σ, σ = 1/√(2N)
    const sg = 2 / Math.sqrt(2 * N);
    g.fillStyle = 'rgba(60,66,80,0.10)';
    g.fillRect(p.X(0.5), p.Y(sg), p.X(Km + 0.4) - p.X(0.5), p.Y(-sg) - p.Y(sg));
    p.fn(k => Math.cos(mod.qd * k), { col: COL_D, w: 1.3, dash: [5, 4], alpha: 0.6 }, 0, Km);
    const ptE = mod.CE.map((c, k) => [k, c]), ptD = mod.CD.map((c, k) => [k, c]);
    p.pts(ptE, { col: COL_E, w: 1.2, alpha: 0.55 });
    p.pts(ptD, { col: COL_D, w: 1.2, alpha: 0.55 });
    p.clip(); punts(g, p, ptE, COL_E); punts(g, p, ptD, COL_D); p.unclip();
    if (hoverK !== null && hoverK <= Km) {
      p.vline(hoverK, { col: '#555', w: 1, dash: [3, 3] });
      const lin = ['k = ' + hoverK + ' (àtoms n i n + ' + hoverK + ')', 'Einstein: C = ' + fmt(mod.CE[hoverK], 3), 'Debye: C = ' + fmt(mod.CD[hoverK], 3)];
      g.font = '11px sans-serif';
      const wb = Math.max(...lin.map(l => g.measureText(l).width)) + 14, hb = lin.length * 15 + 8;
      let xb = p.X(hoverK) + 10;
      if (xb + wb > cK.width - p.m.r) xb = p.X(hoverK) - 10 - wb;
      const yb = p.m.t + 4;
      g.fillStyle = 'rgba(255,255,255,0.94)'; g.strokeStyle = '#c8d0cb'; g.lineWidth = 1;
      g.fillRect(xb, yb, wb, hb); g.strokeRect(xb, yb, wb, hb);
      g.textAlign = 'left';
      lin.forEach((l, i) => { g.fillStyle = INK; g.font = (i ? '' : 'bold ') + '11px sans-serif'; g.fillText(l, xb + 7, yb + 16 + i * 15); });
    }
  }
  cK.addEventListener('mousemove', ev => {
    if (!pK) return;
    const r = cK.getBoundingClientRect(), px = (ev.clientX - r.left) * cK.width / r.width;
    const k = Math.round(pK.invX(px));
    hoverK = k >= 0 && k <= Math.floor(mod.N / 2) ? k : null;
  });
  cK.addEventListener('mouseleave', () => { hoverK = null; });

  // ---------------------------------------------------------------
  // Clics: tria l'àtom ressaltat
  // ---------------------------------------------------------------
  const coords = (c, ev) => { const r = c.getBoundingClientRect(); return [(ev.clientX - r.left) * c.width / r.width, (ev.clientY - r.top) * c.height / r.height]; };
  const tria = n => { state.sel = state.sel === n ? -1 : n; render(); };
  cC.addEventListener('click', ev => {
    const [px] = coords(cC, ev), n = Math.floor((px - LAY.x0) / espai());
    if (n >= 0 && n < mod.N) tria(n);
  });
  [[cFE, 'E'], [cFD, 'D'], [cVE, 'VE'], [cVD, 'VD']].forEach(([c, q]) => c.addEventListener('click', ev => {
    const u = ultim[q]; if (!u) return;
    const [px, py] = coords(c, ev);
    let best = -1, dmin = 14;
    u.P.forEach((z, n) => { const dd = Math.hypot(u.p.X(z[0]) - px, u.p.Y(z[1]) - py); if (dd < dmin) { dmin = dd; best = n; } });
    if (best >= 0) tria(best);
  }));

  // ---------------------------------------------------------------
  // Fórmules, lectures i estat
  // ---------------------------------------------------------------
  function dibuixaText() {
    const N = mod.N, m = mod.m, nuE = WE / TAU, nuD = mod.wD / TAU, eps = state.eps;
    const graus = 360 * m / N;
    const AEig = amp(eps, WE);
    const rowsD = state.ona === 'viatgera'
      ? 'M\\ddot u_n=C\\,(u_{n+1}+u_{n-1}-2u_n)\\ \\Rightarrow\\ u_n(t)=A\\cos(qnd-\\omega t),\\qquad q=\\frac{2\\pi m}{Nd}'
      : 'M\\ddot u_n=C\\,(u_{n+1}+u_{n-1}-2u_n)\\ \\Rightarrow\\ u_n(t)=A\\cos(qnd)\\cos\\omega t,\\qquad q=\\frac{2\\pi m}{Nd}';
    const wTex = state.disp === 'cadena'
      ? '\\omega=2\\sqrt{\\frac CM}\\left|\\sin\\frac{qd}{2}\\right|\\ \\Rightarrow\\ \\nu=' + fmt(nuD, 3) + '\\ \\text{THz}\\qquad(q=' + fmt(2 * m / N, 3) + '\\,\\pi/d)'
      : '\\omega\\simeq v_s\\,q=d\\sqrt{\\frac CM}\\,q\\ \\Rightarrow\\ \\nu=' + fmt(nuD, 3) + '\\ \\text{THz}\\qquad(q=' + fmt(2 * m / N, 3) + '\\,\\pi/d)';
    Fon.formulas($('formules'), [
      { nom: "Einstein: oscil·ladors independents", tex: [
        'M\\ddot u_n=-2C\\,u_n\\ \\Rightarrow\\ u_n(t)=A_n\\cos(\\varphi_n-\\omega_E t),\\qquad \\omega_E=\\sqrt{\\frac{2C}{M}}\\ \\Rightarrow\\ \\nu_E=' + fmt(nuE, 2) + '\\ \\text{THz}'],
        nota: 'Cada àtom vibra com si els veïns estiguessin quiets. Les fases φₙ són independents: no hi ha cap equació que les lligui.' },
      { nom: 'Debye: un mode normal de la cadena', tex: [rowsD, wTex],
        nota: state.ona === 'viatgera'
          ? "La fase de l'àtom n és qnd − ωt: avança qd = 2πm/N = " + fmt(graus, 1) + "° d'un àtom al següent."
          : "Tots els àtoms van en fase o en oposició de fase, amb amplitud A cos(qnd): l'ona estacionària és la suma de dues ones viatgeres, q i −q." },
      { nom: 'Espai de fases', tex: [
        '\\left(x_n,\\ \\frac{p_n}{M\\omega}\\right)=A_n\\,(\\cos\\theta_n,\\ \\sin\\theta_n),\\qquad \\theta_n=\\varphi_n-\\omega_E t\\ \\ \\text{(Einstein)},\\qquad \\theta_n=qnd-\\omega t\\ \\ \\text{(Debye)}'],
        nota: "Dividint p per Mω, cada òrbita és una circumferència recorreguda en sentit horari amb velocitat angular ω: l'angle és la fase de l'àtom." },
      { nom: 'Energia', tex: [
        'E=\\sum_n\\tfrac12 M\\omega^2A_n^2=N\\varepsilon\\ \\Rightarrow\\ A=\\sqrt{\\frac{2\\varepsilon}{M\\omega^2}}:\\qquad A_E=' + fmt(AEig, 3) +
        '\\ \\text{Å},\\qquad A_{\\text{Debye}}=' + fmt(amp(eps, mod.wD), 3) + '\\ \\text{Å}'],
        nota: "Amb la mateixa energia, el mode de freqüència més baixa té més amplitud (A ∝ 1/ω). La de Debye és la de l'ona viatgera; l'estacionària té √2 vegades més amplitud als ventres." },
      { nom: "Correlació de posicions entre un àtom i el següent", tex: [
        'r=\\frac{\\sum_n(u_n-\\bar u)(u_{n+1}-\\bar u)}{\\sum_n(u_n-\\bar u)^2}',
        '\\text{Debye: } (u_n,\\,u_{n+1})=A\\,\\big(\\cos\\theta_n,\\ \\cos(\\theta_n+qd)\\big)\\ \\Rightarrow\\ r=\\cos qd=' + fmt(Math.cos(mod.qd), 3)],
        nota: "A Debye tots els parells de veïns recorren la mateixa el·lipse, inclinada sobre la diagonal (es tanca en una recta quan qd → 0). A Einstein cada parell té el seu desfasament i la seva el·lipse, i r fluctua al voltant de 0." },
      { nom: 'Correlació entre àtoms separats k posicions', tex: [
        'C(k)=\\frac{\\sum_n\\big(x_nx_{n+k}+p_np_{n+k}/M^2\\omega^2\\big)}{\\sum_n\\big(x_n^2+p_n^2/M^2\\omega^2\\big)}=\\frac{\\sum_n A_nA_{n+k}\\cos(\\theta_{n+k}-\\theta_n)}{\\sum_n A_n^2}',
        '\\text{Einstein: } C(k)\\approx 0\\ \\ \\big(\\pm 1/\\sqrt{2N}=\\pm' + fmt(1 / Math.sqrt(2 * N), 2) + '\\big),\\qquad \\text{Debye: } C(k)=\\cos(qkd)'],
        nota: 'No depèn del temps: a cada cadena tots els punts giren junts, i els desfasaments entre àtoms es conserven.' }
    ]);

    const AE = mod.AE;
    let ampE;
    if (state.ein === 'igual') ampE = fmt(AE[0], 3) + ' Å';
    else if (state.ein === 'termic') ampE = 'rms ' + fmt(Math.sqrt(AE.reduce((s, a) => s + a * a, 0) / N), 3) + ', màx ' + fmt(Math.max(...AE), 3) + ' Å';
    else ampE = fmt(AE[nUn()], 3) + ' Å (àtom ' + nUn() + ')';
    const Etot = N * eps;
    Fon.readout($('lectura'), [
      ['N', N + ' àtoms'],
      ['ε = E/N', fmt(eps, 1) + ' meV'],
      ['E total', Etot >= 1000 ? fmt(Etot / 1000, 3) + ' eV' : fmt(Etot, 1) + ' meV'],
      ['T amb kT = ε', fmt(eps * MEV / KB, 0) + ' K'],
      ['ν_E (Einstein)', fmt(nuE, 2) + ' THz'],
      ['mode de Debye', 'm = ' + m + ' de ' + maxM()],
      ['q', fmt(2 * m / N, 3) + ' π/d'],
      ['λ = Nd/m', fmt(N / m, 2) + ' d = ' + fmt(N / m * MAT.d, 1) + ' Å'],
      ['ν (Debye)', fmt(nuD, 2) + ' THz'],
      ['amplitud Einstein', ampE],
      ['amplitud Debye', fmt(mod.AD, 3) + ' Å'],
      ['desfasament veïns E', "a l'atzar"],
      ['desfasament veïns D', 'qd = ' + fmt(graus, 1) + '°'],
      ['C(1) Einstein', fmt(mod.CE[1], 2)],
      ['C(1) Debye', fmt(mod.CD[1], 2)],
      ['exageració Einstein', '×' + fmt(mod.exE, 2) + (mod.exE < state.exag - 1e-9 ? ' (limitada)' : '')],
      ['exageració Debye', '×' + fmt(mod.exD, 2) + (mod.exD < state.exag - 1e-9 ? ' (limitada)' : '')]
    ]);

    const est = $('estat');
    est.className = 'estat si';
    if (state.ein === 'un') est.textContent = "Un sol mode d'Einstein mou un sol àtom (el " + nUn() + '); la resta no es mouen. Un sol mode de Debye, amb la mateixa energia, mou tots els àtoms.';
    else if (2 * m === N) est.textContent = 'Vora de zona: cada àtom va en oposició de fase amb els veïns. C(1) = −1: correlació màxima, de signe negatiu.';
    else if (m === 1) est.textContent = "Mode de longitud d'ona més llarga: els veïns van gairebé en fase (desfasament 2π/N = " + fmt(graus, 1) + '°). Com més gran és N, més a prop són a l\'espai de fases.';
    else est.textContent = 'Cada àtom de Debye va desfasat qd = ' + fmt(graus, 1) + "° respecte de l'anterior: coneguda la fase d'un àtom, es coneixen les de tots.";

    $('notaEnergia').innerHTML = 'Energia total de cada cadena: E = Nε = ' + (Etot >= 1000 ? fmt(Etot / 1000, 3) + ' eV' : fmt(Etot, 1) + ' meV') +
      '. Clàssicament, cada oscil·lador té de mitjana una energia kT (equipartició): ε = ' + fmt(eps, 1) + ' meV correspon a T ≈ ' + fmt(eps * MEV / KB, 0) + ' K.';
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const setEin = Fon.optionGroup($('grupEin'), v => { state.ein = v; render(); });
  const setOna = Fon.optionGroup($('grupOna'), v => { state.ona = v; render(); });
  const setDisp = Fon.optionGroup($('grupDisp'), v => { state.disp = v; render(); });
  $('slN').addEventListener('input', () => { state.N = +$('slN').value; render(); });
  $('slEps').addEventListener('input', () => { state.eps = +$('slEps').value; render(); });
  $('slM').addEventListener('input', () => { state.m = +$('slM').value; render(); });
  document.querySelectorAll('[data-mq]').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.mq;
    state.m = v === 'max' ? maxM() : v === 'quart' ? Math.max(1, Math.round(state.N / 4)) : 1;
    render();
  }));
  $('btnSorteja').addEventListener('click', () => { state.llavor = 1 + Math.floor(Math.random() * 999999); sorteja(); render(); });
  $('btnPlay').addEventListener('click', () => { state.playing = !state.playing; render(); });
  $('slVel').addEventListener('input', () => { state.vel = +$('slVel').value; render(); });
  $('slExag').addEventListener('input', () => { state.exag = +$('slExag').value; render(); });
  $('chkUneix').addEventListener('change', () => { state.uneix = $('chkUneix').checked; render(); });
  $('chkOrbites').addEventListener('change', () => { state.orbites = $('chkOrbites').checked; render(); });
  $('chkColors').addEventListener('change', () => { state.colors = $('chkColors').checked; render(); });

  function render() {
    state.m = Math.max(1, Math.min(maxM(), state.m));
    if (state.sel >= state.N) state.sel = -1;
    $('slN').value = state.N; $('valN').textContent = String(state.N);
    $('slEps').value = state.eps; $('valEps').textContent = fmt(state.eps, 1) + ' meV';
    $('slM').max = maxM(); $('slM').value = state.m;
    $('valM').textContent = state.m + ' (q = ' + fmt(2 * state.m / state.N, 3) + ' π/d)';
    $('slVel').value = state.vel; $('valVel').textContent = '×' + fmt(state.vel, 2);
    $('slExag').value = state.exag; $('valExag').textContent = '×' + fmt(state.exag, 1);
    $('chkUneix').checked = state.uneix; $('chkOrbites').checked = state.orbites; $('chkColors').checked = state.colors;
    $('btnPlay').textContent = state.playing ? '❚❚ Atura l\'animació' : '▶ Engega l\'animació';
    setEin(state.ein); setOna(state.ona); setDisp(state.disp);
    calcula();
    dibuixaText();
    dibuixa();
  }
  function dibuixa() {
    dibuixaCadenes();
    dibuixaFase(cFE, 'E');
    dibuixaFase(cFD, 'D');
    dibuixaVeins(cVE, 'E');
    dibuixaVeins(cVD, 'D');
    dibuixaCorr();
  }
  let tAnt = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - tAnt) / 1000);
    tAnt = now;
    if (state.playing) t += dt * RITME * state.vel;
    dibuixa();
    requestAnimationFrame(loop);
  }

  Fon.linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams();
    p.set('N', state.N); p.set('eps', state.eps); p.set('m', state.m);
    if (state.ona !== 'viatgera') p.set('ona', state.ona);
    if (state.disp !== 'cadena') p.set('disp', state.disp);
    if (state.ein !== 'igual') p.set('ein', state.ein);
    p.set('llavor', state.llavor);
    if (state.exag !== 5) p.set('exag', state.exag);
    if (state.vel !== 1) p.set('vel', state.vel);
    if (!state.uneix) p.set('uneix', 0);
    if (!state.orbites) p.set('orbites', 0);
    if (!state.colors) p.set('colors', 0);
    p.set('sel', state.sel);
    if (!state.playing) p.set('atura', 1);
    return p;
  });
  (function fromURL() {
    const p = Fon.params();
    Fon.num(p, 'N', x => { state.N = Math.round(x); }, 4, NMAX);
    Fon.num(p, 'eps', x => { state.eps = x; }, 0.5, 200);
    Fon.num(p, 'm', x => { state.m = Math.round(x); }, 1, NMAX / 2);
    if (['viatgera', 'estacionaria'].includes(p.get('ona'))) state.ona = p.get('ona');
    if (['cadena', 'debye'].includes(p.get('disp'))) state.disp = p.get('disp');
    if (['igual', 'termic', 'un'].includes(p.get('ein'))) state.ein = p.get('ein');
    Fon.num(p, 'llavor', x => { state.llavor = Math.round(x); }, 0, 1e9);
    Fon.num(p, 'exag', x => { state.exag = x; }, 1, 20);
    Fon.num(p, 'vel', x => { state.vel = x; }, 0.1, 4);
    if (p.get('uneix') === '0') state.uneix = false;
    if (p.get('orbites') === '0') state.orbites = false;
    if (p.get('colors') === '0') state.colors = false;
    Fon.num(p, 'sel', x => { state.sel = Math.round(x); }, -1, NMAX - 1);
    if (p.get('atura') === '1') state.playing = false;
    sorteja();
    render();
    requestAnimationFrame(loop);
  })();
})();
