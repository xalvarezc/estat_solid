// Simulador — Einstein i Debye a l'espai de fases: oscil·ladors independents o correlacionats.
//
// Dues cadenes de N àtoms (plans (100) de coure, ones longitudinals, com al Tema 4) amb la
// mateixa energia per àtom ε:
//   · Einstein: cada àtom és un oscil·lador independent entre els veïns quiets,
//     M ü = −2C u, ω_E = √(2C/M).
//   · Debye: un sol mode normal de la cadena amb condicions periòdiques, q = 2πm/(Nd),
//     ω = 2√(C/M)|sin(qd/2)| (cadena exacta) o ω = v_s q (aproximació de Debye).
//
// Descripció clàssica: el moviment és harmònic i es calcula exactament, sense integrar. A l'espai
// de fases escalat (x, p/Mω) cada àtom recorre una circumferència en sentit horari.
//
// Descripció quàntica (només el mode triat: la resta de modes de Debye no hi són):
//   · Estat estacionari: l'energia entra en quàntums sencers ħω. Einstein: Ψ = Π_j ψ_{n_j}(u_j).
//     Debye: u_j = √(2/N)(Q_c cos qjd + Q_s sin qjd). L'ona viatgera amb n fonons té
//     |Ψ(Q_c, Q_s)|² ∝ ρ^{2n} e^{−ρ²/x₀²}; l'estacionària és el mode real Q_c a |n⟩ (u_j = e_j Q).
//     Res no es mou: es mostren els núvols de probabilitat, mesures simultànies de totes les
//     posicions (mostres de |Ψ|²), la distribució de Husimi d'un àtom i la probabilitat conjunta
//     de dos veïns.
//   · Estat coherent: les mitjanes fan exactament el moviment clàssic, amb el núvol del punt zero.
// Unitats internes: Å, ps (ω en rad/ps, de manera que ω/2π surt en THz) i meV.

(function () {
  'use strict';
  const { fmt, Plot } = Fon;
  const TAU = Fon.TAU;
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------
  // Constants i material
  // ---------------------------------------------------------------
  const U = 1.66053907e-27, MEV = 1.602176634e-22, KB = 1.380649e-23, HBAR = 1.054571817e-34;
  const HBAR_MEVPS = 0.6582119569;                     // ħ en meV·ps
  const MAT = { M: 63.546, d: 1.8075, C: 60.7 };       // u, Å, N/m (Cu, ones L al llarg de [100])
  const MKG = MAT.M * U;
  const W0 = Math.sqrt(MAT.C / MKG) * 1e-12;           // √(C/M), rad/ps
  const WE = Math.SQRT2 * W0;                          // Einstein: l'àtom entre els dos veïns quiets
  const EPS_REF = 50;                                  // meV: fixa l'escala dels diagrames
  const NMAX = 80;
  const COL_E = '#b26a00', COL_D = '#1f6feb', INK = '#1a1d24', MUTED = '#6b7280';
  const RGB = { E: [178, 106, 0], D: [31, 111, 235] };
  const RITME = (TAU / WE) / 2.5;                      // ps de simulació per segon real (un gir d'Einstein = 2.5 s)
  // amplitud clàssica (Å) d'un oscil·lador d'energia e (meV) i freqüència w (rad/ps)
  const amp = (e, w) => Math.sqrt(2 * e * MEV / MKG) / (w * 1e12) * 1e10;
  // longitud del punt zero, x₀ = √(ħ/Mω) (Å): a l'estat fonamental ⟨x²⟩ = x₀²/2
  const longZero = w => Math.sqrt(HBAR / (MKG * w * 1e12)) * 1e10;

  const state = {
    N: 16, eps: 25, m: 1, ona: 'viatgera', disp: 'cadena', ein: 'igual', llavor: 97,
    exag: 5, vel: 1, playing: true, uneix: true, orbites: true, colors: true, sel: 9,
    quant: false, estat: 'fock', auto: true, acum: false
  };
  let t = 0;                                           // ps
  const fock = () => state.quant && state.estat === 'fock';
  const coherent = () => state.quant && state.estat === 'coherent';

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
  // Física clàssica
  // ---------------------------------------------------------------
  const maxM = () => Math.floor(state.N / 2);
  const nUn = () => Math.floor(state.N / 2);           // l'àtom que ho rep tot a «tota en un sol àtom»
  const jSel = () => state.sel >= 0 && state.sel < state.N ? state.sel : 0;
  let mod = null;

  function color(q, n, a) {
    if (state.colors) return 'hsla(' + Math.round(360 * n / mod.N) + ',72%,45%,' + a + ')';
    const c = RGB[q];
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

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
    mod.exD = Math.min(state.exag, AD > 0 ? MAT.d / AD : Infinity, rel > 0 ? 0.7 * MAT.d / rel : Infinity);
    mod.colE = []; mod.colD = [];
    for (let n = 0; n < N; n++) { mod.colE.push(color('E', n, 1)); mod.colD.push(color('D', n, 1)); }
    // correlacions (no depenen del temps: tots els punts giren junts)
    mod.CE = correlacio(posE); mod.CD = correlacio(posD);
  }

  // [x, p/Mω] (Å) clàssics de l'àtom n a l'instant tt (n pot ser no enter per a l'ona contínua de Debye)
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
      out.push(s0 > 0 ? s / s0 : NaN);
    }
    return out;
  }
  // C(k) d'una sola configuració de posicions (una mesura)
  function correlacioPosicions(u) {
    const N = u.length, out = [];
    let s0 = 0;
    for (let n = 0; n < N; n++) s0 += u[n] * u[n];
    for (let k = 0; k <= Math.floor(N / 2); k++) {
      let s = 0;
      for (let n = 0; n < N; n++) s += u[n] * u[(n + k) % N];
      out.push(s0 > 0 ? s / s0 : NaN);
    }
    return out;
  }
  // coeficient de correlació de Pearson entre u_n i u_{n+1} (condicions periòdiques)
  function pearson(u) {
    const N = u.length, mu = u.reduce((s, x) => s + x, 0) / N;
    let sxy = 0, sxx = 0;
    for (let n = 0; n < N; n++) { const a = u[n] - mu, b = u[(n + 1) % N] - mu; sxy += a * b; sxx += a * a; }
    return sxx > 1e-14 ? sxy / sxx : NaN;
  }

  // ---------------------------------------------------------------
  // Física quàntica
  // ---------------------------------------------------------------
  const NEXACTE = 400;                                 // fins aquí, funcions d'Hermite exactes
  const lnF = [0];                                     // ln k!
  function lnFact(k) { while (lnF.length <= k) lnF.push(lnF[lnF.length - 1] + Math.log(lnF.length)); return lnF[k]; }
  // atzar de les mesures (no cal que sigui reproduïble)
  function normal() { let u = 0; while (u === 0) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * Math.random()); }
  function gamma(k) {                                  // Marsaglia–Tsang, k ≥ 1
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do { x = normal(); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  // Densitat de probabilitat d'una coordenada adimensional ξ = x/x₀, en una taula:
  //   'F': |ψ_n(ξ)|², un oscil·lador en l'estat estacionari n (⟨ξ²⟩ = n + ½);
  //   'B': Σ_k B(k; n, ½)|ψ_k(ξ)|², un àtom d'una ona viatgera amb n fonons (el fonó és
  //        a tota la cadena i, vist des d'un sol àtom, és una barreja binomial de nivells).
  const taules = new Map();
  function taula(tipus, n) {
    const clau = tipus + n;
    if (taules.has(clau)) return taules.get(clau);
    if (taules.size > 80) taules.clear();
    const a2 = tipus === 'F' ? 2 * n + 1 : n + 1;      // amplitud clàssica equivalent, al quadrat
    const L = Math.sqrt(a2) + 6;
    const exacte = n <= NEXACTE;
    const h = exacte ? Math.min(0.05, 0.35 / Math.sqrt(a2)) : 0.05;
    const np = Math.ceil(2 * L / h) + 1, dx = 2 * L / (np - 1);
    const xs = new Float64Array(np), ds = new Float64Array(np);
    if (exacte) {
      const w = new Float64Array(n + 1);
      if (tipus === 'F') w[n] = 1;
      else for (let k = 0; k <= n; k++) w[k] = Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k) - n * Math.LN2);
      const lq = 0.5 * Math.log(Math.PI), BIG = 1e150, LBIG = Math.log(BIG);
      for (let i = 0; i < np; i++) {
        const x = -L + i * dx;
        xs[i] = x;
        // recurrència de les funcions d'Hermite, sense el factor π^{-1/4}e^{-ξ²/2} i reescalant
        let a = 1, b = 0, ls = 0, s = 0;
        for (let k = 0; ; k++) {
          if (w[k] > 1e-300 && a !== 0) s += w[k] * Math.exp(2 * (Math.log(Math.abs(a)) + ls) - x * x - lq);
          if (k === n) break;
          const c = Math.sqrt(2 / (k + 1)) * x * a - Math.sqrt(k / (k + 1)) * b;
          b = a; a = c;
          if (Math.abs(a) > BIG) { a /= BIG; b /= BIG; ls += LBIG; }
        }
        ds[i] = s;
      }
    } else {
      // n molt gran: la distribució clàssica (arcsinus) suavitzada amb l'amplada del punt zero
      const A2 = a2, raw = new Float64Array(np);
      for (let i = 0; i < np; i++) { const x = -L + i * dx; xs[i] = x; const z = A2 - x * x; raw[i] = z > dx * dx ? 1 / Math.sqrt(z) : 0; }
      const sg = 0.6, mk = Math.ceil(3 * sg / dx), ker = [];
      for (let j = -mk; j <= mk; j++) ker.push(Math.exp(-0.5 * Math.pow(j * dx / sg, 2)));
      for (let i = 0; i < np; i++) {
        let s = 0;
        for (let j = -mk; j <= mk; j++) { const ii = i + j; if (ii >= 0 && ii < np) s += raw[ii] * ker[j + mk]; }
        ds[i] = s;
      }
    }
    let tot = 0;
    for (let i = 0; i < np; i++) tot += ds[i];
    const cdf = new Float64Array(np);
    let acc = 0, mx = 0;
    for (let i = 0; i < np; i++) { ds[i] /= tot * dx; acc += ds[i] * dx; cdf[i] = acc; if (ds[i] > mx) mx = ds[i]; }
    const T = { xs, ds, cdf, L, dx, mx };
    taules.set(clau, T);
    return T;
  }
  function densitat(T, x) {
    const f = (x + T.L) / T.dx, i = Math.floor(f);
    if (i < 0 || i >= T.xs.length - 1) return 0;
    return T.ds[i] + (T.ds[i + 1] - T.ds[i]) * (f - i);
  }
  function mostra(T) {
    const c = T.cdf, u = Math.random() * c[c.length - 1];
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (c[mid] < u) lo = mid; else hi = mid; }
    const f = (u - c[lo]) / Math.max(1e-300, c[hi] - c[lo]);
    return T.xs[lo] + T.dx * Math.min(1, Math.max(0, f));
  }

  // com es reparteixen els quàntums d'Einstein entre els àtoms (reproduïble amb la llavor)
  function repartiment(nTot) {
    const N = state.N, n = new Array(N).fill(0);
    const r = mulberry32(Math.imul(state.llavor ^ 0x5bd1e995, 2246822519));
    if (state.ein === 'un') n[nUn()] = nTot;
    else if (state.ein === 'igual') {
      const b = Math.floor(nTot / N), ord = [];
      for (let j = 0; j < N; j++) ord.push(j);
      for (let j = N - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [ord[j], ord[k]] = [ord[k], ord[j]]; }
      n.fill(b);
      for (let i = 0; i < nTot - b * N; i++) n[ord[i]]++;
    } else {
      // equilibri tèrmic a energia fixada: totes les maneres de repartir els nTot quàntums
      // entre els N àtoms són igual de probables (N − 1 separadors entre nTot + N − 1 llocs)
      const M = nTot + N - 1, llocs = [];
      for (let i = 0; i < M; i++) llocs.push(i);
      for (let i = 0; i < N - 1; i++) { const k = i + Math.floor(r() * (M - i)); [llocs[i], llocs[k]] = [llocs[k], llocs[i]]; }
      const sep = llocs.slice(0, N - 1).sort((a, b) => a - b);
      let ant = -1;
      sep.forEach((s, j) => { n[j] = s - ant - 1; ant = s; });
      n[N - 1] = M - 1 - ant;
    }
    return n;
  }

  let qm = null;
  function calculaQ() {
    const N = state.N, m = state.m, E = N * state.eps;
    const hwE = HBAR_MEVPS * WE, hwD = HBAR_MEVPS * mod.wD;
    const x0E = longZero(WE), x0D = longZero(mod.wD), kN = Math.sqrt(2 / N);
    const real = state.ona === 'estacionaria' || 2 * m === N;   // un sol mode real (amb nodes)
    const e = [];
    for (let j = 0; j < N; j++) e.push(2 * m === N ? Math.cos(Math.PI * j) / Math.sqrt(N) : kN * Math.cos(mod.qd * j));
    const q = { hwE, hwD, x0E, x0D, kN, real, e, E };
    let ampE, ampD;
    if (state.estat === 'fock') {
      q.nTotE = Math.floor(E / hwE + 1e-9); q.restE = E - q.nTotE * hwE;
      q.nE = repartiment(q.nTotE);
      q.nD = Math.floor(E / hwD + 1e-9); q.restD = E - q.nD * hwD;
      q.tD = taula(real ? 'F' : 'B', q.nD);
      q.sD = real ? e.map(v => Math.abs(v) * x0D) : new Array(N).fill(kN * x0D);   // Å per unitat de ξ
      const nMax = Math.max(...q.nE);
      ampE = x0E * Math.sqrt(2 * nMax + 1);
      ampD = Math.max(...q.sD) * Math.sqrt(real ? 2 * q.nD + 1 : q.nD + 1);
      // escala ajustada a l'estat (amb poques excitacions els núvols serien massa petits a l'escala clàssica)
      q.RE = 1.05 * (ampE + 2.2 * x0E);
      q.RD = 1.05 * (ampD + 2.2 * Math.max(...q.sD));
    } else {
      // coherent: les mitjanes són les clàssiques; desviació del punt zero en x (i en p/Mω)
      q.wE = x0E / Math.SQRT2;
      q.wD = real ? e.map(v => Math.abs(v) * x0D / Math.SQRT2) : new Array(N).fill(kN * x0D / Math.SQRT2);
      ampE = Math.max(...mod.AE) + 2 * q.wE;
      ampD = mod.AD + 2 * Math.max(...q.wD);
      q.RE = Math.max(mod.RE, 1.1 * (Math.max(...mod.AE) + 3 * q.wE));
      q.RD = Math.max(mod.RD, 1.1 * (mod.AD + 3 * Math.max(...q.wD)));
    }
    q.exE = Math.min(state.exag, 0.42 * MAT.d / ampE);
    const rel = 2 * ampD * Math.abs(Math.sin(mod.qd / 2));
    q.exD = Math.min(state.exag, MAT.d / ampD, rel > 0 ? 0.7 * MAT.d / rel : Infinity);
    qm = q;
  }

  // ---- mesures: mostres de |Ψ|² (posicions de tots els àtoms alhora) ----
  let mesures = [], tMesura = 0;
  let brut = true;                                    // cal tornar a dibuixar (quan res no es mou)
  function mesura() {
    if (!fock() || !qm) return;
    const N = state.N, E = new Float64Array(N), D = new Float64Array(N);
    for (let j = 0; j < N; j++) E[j] = qm.x0E * mostra(taula('F', qm.nE[j]));
    if (qm.real) {
      const xi = mostra(qm.tD);
      for (let j = 0; j < N; j++) D[j] = qm.e[j] * qm.x0D * xi;
    } else {
      const rho = Math.sqrt(gamma(qm.nD + 1)), ph = TAU * Math.random();
      const xc = rho * Math.cos(ph), xs = rho * Math.sin(ph), s = qm.kN * qm.x0D;
      for (let j = 0; j < N; j++) D[j] = s * (xc * Math.cos(mod.qd * j) + xs * Math.sin(mod.qd * j));
    }
    mesures.push({ E, D });
    if (mesures.length > 60) mesures.shift();
    tMesura = performance.now();
    brut = true;
  }
  const darrera = () => mesures.length ? mesures[mesures.length - 1] : null;

  // ---- mapes de calor (estat estacionari) ----
  const G = 120;
  // fnLog(x, y) → ln de la densitat (sense normalitzar); retorna un canvas G×G en el color del model
  function mapaCalor(R, q, fnLog) {
    const cv = document.createElement('canvas');
    cv.width = G; cv.height = G;
    const g = cv.getContext('2d'), im = g.createImageData(G, G), v = new Float64Array(G * G), c = RGB[q];
    let mx = -Infinity;
    for (let iy = 0; iy < G; iy++) for (let ix = 0; ix < G; ix++) {
      const x = -R + (ix + 0.5) * 2 * R / G, y = R - (iy + 0.5) * 2 * R / G, l = fnLog(x, y);
      v[iy * G + ix] = l;
      if (l > mx) mx = l;
    }
    for (let i = 0; i < G * G; i++) {
      const a = isFinite(mx) ? Math.exp(v[i] - mx) : 0;
      im.data[4 * i] = c[0]; im.data[4 * i + 1] = c[1]; im.data[4 * i + 2] = c[2];
      im.data[4 * i + 3] = Math.round(235 * Math.pow(a, 0.85));
    }
    g.putImageData(im, 0, 0);
    return cv;
  }
  // distribució de Husimi de l'àtom j: barreja de nivells k amb pesos w (en ln), escala s (Å)
  function nivellsAtom(q, j) {
    if (q === 'E') return { s: qm.x0E, ks: [qm.nE[j]], lw: [0] };
    if (qm.real) return { s: qm.sD[j], ks: [qm.nD], lw: [0] };
    const n = qm.nD, sd = Math.sqrt(n) / 2, k0 = Math.max(0, Math.floor(n / 2 - 7 * sd - 3)), k1 = Math.min(n, Math.ceil(n / 2 + 7 * sd + 3));
    const ks = [], lw = [];
    for (let k = k0; k <= k1; k++) { ks.push(k); lw.push(lnFact(n) - lnFact(k) - lnFact(n - k) - n * Math.LN2); }
    return { s: qm.sD[j], ks, lw };
  }
  function mapaHusimi(q, j) {
    const { s, ks, lw } = nivellsAtom(q, j);
    if (!(s > 1e-9)) return null;
    // té simetria de rotació: es calcula en funció de |α|² en una taula i després s'interpola
    const R = rang(q), a2max = R * R / (s * s), NR = 800, lf = ks.map(k => lnFact(k)), tab = new Float64Array(NR + 1);
    for (let i = 0; i <= NR; i++) {
      const a2 = a2max * i / NR, la = Math.log(a2 + 1e-300);
      let mx = -Infinity;
      for (let k = 0; k < ks.length; k++) { const l = lw[k] - a2 + ks[k] * la - lf[k]; if (l > mx) mx = l; }
      let sum = 0;
      for (let k = 0; k < ks.length; k++) sum += Math.exp(lw[k] - a2 + ks[k] * la - lf[k] - mx);
      tab[i] = mx + Math.log(sum);
    }
    return mapaCalor(R, q, (x, y) => {
      const f = (x * x + y * y) / (2 * s * s) / a2max * NR, i = Math.floor(f);
      return i >= NR ? tab[NR] : tab[i] + (tab[i + 1] - tab[i]) * (f - i);
    });
  }
  // probabilitat conjunta P(u_j, u_{j+1})
  function mapaVeinsE(j) {
    const T1 = taula('F', qm.nE[j]), T2 = taula('F', qm.nE[(j + 1) % state.N]), s = qm.x0E;
    return mapaCalor(rang('E'), 'E', (x, y) => Math.log(densitat(T1, x / s)) + Math.log(densitat(T2, y / s)));
  }
  function mapaVeinsD() {
    if (qm.real) return null;                           // una recta: es dibuixa a part
    const c = Math.cos(mod.qd), sn = Math.sin(mod.qd), sc = qm.kN * qm.x0D, n = qm.nD;
    return mapaCalor(rang('D'), 'D', (x, y) => {
      const u = x / sc, v = y / sc, r2 = (u * u - 2 * u * v * c + v * v) / (sn * sn);
      return (n > 0 ? n * Math.log(r2 + 1e-300) : 0) - r2;
    });
  }
  // capa dels núvols de probabilitat de les cadenes (estàtica en un estat estacionari)
  function nuvol(q, j) {
    return q === 'E' ? { T: taula('F', qm.nE[j]), s: qm.x0E } : { T: qm.tD, s: qm.sD[j] };
  }
  function capaNuvols() {
    const cv = document.createElement('canvas');
    cv.width = cC.width; cv.height = cC.height;
    const g = cv.getContext('2d'), N = mod.N, sp = espai(), r = radiAtom();
    ['E', 'D'].forEach(q => {
      const B = LAY[q], ks = LAY.hS / rang(q), kpx = exag(q) * sp / MAT.d, wc = Math.max(2, sp * 0.55);
      for (let j = 0; j < N; j++) {
        const { T, s } = nuvol(q, j);
        if (!(s > 1e-9)) continue;
        const W = Math.min(3 * sp, T.L * s * kpx);
        for (let dx = -Math.floor(W); dx <= W; dx++) {
          const a = densitat(T, dx / kpx / s) / T.mx;
          if (a < 0.02) continue;
          g.fillStyle = color(q, j, 0.42 * a);
          g.fillRect(lloc(j) + dx - 0.5, B.y - r - 2, 1, 2 * r + 4);
        }
        for (let py = -LAY.hS - 6; py <= LAY.hS + 6; py++) {
          const a = densitat(T, py / ks / s) / T.mx;
          if (a < 0.02) continue;
          g.fillStyle = color(q, j, 0.5 * a);
          g.fillRect(lloc(j) - wc / 2, B.strip - py - 0.5, wc, 1);
        }
      }
    });
    return cv;
  }

  // escales i exageració segons la descripció
  const rang = q => state.quant ? (q === 'E' ? qm.RE : qm.RD) : (q === 'E' ? mod.RE : mod.RD);
  const exag = q => state.quant ? (q === 'E' ? qm.exE : qm.exD) : (q === 'E' ? mod.exE : mod.exD);

  // Les taques dels diagrames es pinten en una capa a 1/3 de resolució i després s'amplien:
  // són suaus, no es nota, i rasteritzar-les costa nou vegades menys.
  const BAIXA = 3, capesBaixes = new Map();
  function capaBaixa(c) {
    let cv = capesBaixes.get(c);
    if (!cv) { cv = document.createElement('canvas'); cv.width = Math.ceil(c.width / BAIXA); cv.height = Math.ceil(c.height / BAIXA); capesBaixes.set(c, cv); }
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(1 / BAIXA, 0, 0, 1 / BAIXA, 0, 0);
    return g;
  }
  function posaCapaBaixa(p) {
    const cv = capesBaixes.get(p.canvas), g = p.g;
    g.save(); g.imageSmoothingEnabled = true; g.drawImage(cv, 0, 0, p.canvas.width, p.canvas.height); g.restore();
  }
  // opacitat de cada taca: com més àtoms, més transparent (perquè, superposades, no saturin)
  const aTaca = () => Math.max(0.12, Math.min(0.45, 4 / mod.N));
  // taca gaussiana de desviacions sx, sy (px) al llarg d'eixos girats un angle ang
  // (el degradat és en coordenades locals, i per tant el mateix serveix per a totes les taques
  // d'un color: es guarda, i es buida a cada render)
  const degradats = new Map();
  function taca(g, cx, cy, sx, sy, ang, q, j, a0) {
    sx = Math.max(sx, 0.7); sy = Math.max(sy, 0.7);
    const clau = q + j + '|' + a0;
    let gr = degradats.get(g) && degradats.get(g).get(clau);
    if (!gr) {
      gr = g.createRadialGradient(0, 0, 0, 0, 0, 2.3);
      // perfil gaussià: alfa ∝ exp(−r²/2), amb r en desviacions
      [[0, 1], [0.75, 0.75], [1.5, 0.32], [2.0, 0.13], [2.3, 0]].forEach(([r, a]) => gr.addColorStop(r / 2.3, color(q, j, a0 * a)));
      if (!degradats.has(g)) degradats.set(g, new Map());
      degradats.get(g).set(clau, gr);
    }
    g.save(); g.translate(cx, cy); g.rotate(ang); g.scale(sx, sy);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 2.3, 0, TAU); g.fill();
    g.restore();
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
  const radiAtom = () => Math.max(2.2, Math.min(8, espai() * 0.26));
  let capa = null;                                    // núvols (estat estacionari)

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
    let txt;
    if (fock()) {
      txt = q === 'E'
        ? (qm.nTotE === 0 ? "  ·  cap quàntum: ħω_E = " + fmt(qm.hwE, 1) + " meV és més que l'energia disponible; tots els àtoms a l'estat fonamental"
          : '  ·  ' + qm.nTotE + (qm.nTotE === 1 ? ' quàntum' : ' quàntums') + ' de ħω_E = ' + fmt(qm.hwE, 1) + ' meV, cadascun en un àtom concret')
        : (qm.nD === 0 ? "  ·  un mode (m = " + mod.m + ") sense fonons: només el punt zero, ħω/2 = " + fmt(qm.hwD / 2, 2) + ' meV'
          : '  ·  un mode: m = ' + mod.m + ', ' + qm.nD + (qm.nD === 1 ? ' fonó' : ' fonons') + ' de ħω = ' + fmt(qm.hwD, 2) + ' meV, compartits per tota la cadena');
    } else {
      txt = q === 'E'
        ? '  ·  ' + N + ' oscil·ladors independents, tots amb ν_E = ' + fmt(WE / TAU, 2) + ' THz i cadascun amb la seva fase'
        : '  ·  un mode normal de tota la cadena: m = ' + mod.m + ', λ = ' + fmt(N / mod.m, 2) + ' d, ν = ' + fmt(mod.wD / TAU, 2) +
          ' THz, desfasament entre veïns qd = ' + fmt(360 * mod.m / N, 1) + '°';
    }
    g.fillText(txt, x0 + 16 + w, y);
  }

  function dibuixaCadena(q) {
    const g = gC, N = mod.N, B = LAY[q], sp = espai(), y = B.y, r = radiAtom();
    const k = exag(q) * sp / MAT.d;                   // px per Å
    const pos = q === 'E' ? posE : posD, cols = q === 'E' ? mod.colE : mod.colD;
    // desplaçaments que es dibuixen: clàssics, mitjanes (coherent) o l'última mesura (estacionari)
    const u = [], xa = [];
    const ult = darrera();
    for (let n = 0; n < N; n++) {
      u.push(fock() ? (ult ? ult[q][n] : 0) : pos(n, t)[0]);
      xa.push(lloc(n) + u[n] * k);
    }
    titol(g, q, B.tit);

    // posicions d'equilibri: marques sota la cadena
    g.strokeStyle = '#b9c3bd'; g.lineWidth = 1;
    for (let n = 0; n < N; n++) { g.beginPath(); g.moveTo(lloc(n), y + r + 3); g.lineTo(lloc(n), y + r + 8); g.stroke(); }

    // núvols que es mouen (estat coherent)
    const R = rang(q), ks = LAY.hS / R, yb = B.strip;
    if (coherent()) {
      for (let n = 0; n < N; n++) {
        const w = q === 'E' ? qm.wE : qm.wD[n];
        taca(g, xa[n], y, w * k, r * 0.8, 0, q, n, 0.5);
        taca(g, lloc(n), yb - u[n] * ks, Math.max(1.5, sp * 0.22), w * ks, 0, q, n, 0.55);
      }
    }

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
    const rA = coherent() ? Math.max(2, r * 0.55) : r;
    for (let n = 0; n < N; n++) {
      g.beginPath(); g.arc(xa[n], y, rA, 0, TAU); g.fillStyle = cols[n]; g.fill();
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
    g.strokeStyle = '#e3e7e3'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(LAY.x0, yb); g.lineTo(LAY.x1, yb); g.stroke();
    g.fillStyle = MUTED; g.font = '10px sans-serif'; g.textAlign = 'left';
    const etq = fock() ? 'núvol de probabilitat del desplaçament uₙ de cada àtom i, en punts, l\'última mesura'
      : coherent() ? 'desplaçament uₙ de cada àtom: mitjana (punt) i núvol del punt zero'
        : 'desplaçament uₙ de cada àtom, dibuixat en vertical';
    g.fillText(etq + ' (escala ±' + fmt(R, 2) + ' Å)', LAY.x0, yb - LAY.hS - 6);
    if (q === 'D' && !fock()) {
      g.strokeStyle = 'rgba(31,111,235,0.35)'; g.lineWidth = 1.6; g.beginPath();
      for (let px = LAY.x0; px <= LAY.x1; px += 2) {
        const yy = yb - posD((px - LAY.x0) / sp - 0.5, t)[0] * ks;
        if (px === LAY.x0) g.moveTo(px, yy); else g.lineTo(px, yy);
      }
      g.stroke();
    }
    const rs = Math.max(2, Math.min(4, sp * 0.2));
    if (fock() && state.acum) {
      mesures.slice(0, -1).forEach(ms => {
        for (let n = 0; n < N; n++) { g.beginPath(); g.arc(lloc(n), yb - ms[q][n] * ks, 1.4, 0, TAU); g.fillStyle = color(q, n, 0.35); g.fill(); }
      });
    }
    if (fock() && !ult) return;
    g.strokeStyle = 'rgba(60,66,80,0.45)'; g.lineWidth = 1; g.beginPath();
    for (let n = 0; n < N; n++) { const yy = yb - u[n] * ks; if (n) g.lineTo(lloc(n), yy); else g.moveTo(lloc(n), yy); }
    g.stroke();
    for (let n = 0; n < N; n++) {
      g.beginPath(); g.arc(lloc(n), yb - u[n] * ks, rs, 0, TAU); g.fillStyle = cols[n]; g.fill();
      if (fock()) { g.lineWidth = 1; g.strokeStyle = '#fff'; g.stroke(); }
    }
    if (s >= 0 && s < N) anella(g, lloc(s), yb - u[s] * ks, rs + 3, 1.8);
  }

  function dibuixaCadenes() {
    gC.clearRect(0, 0, cC.width, cC.height);
    if (fock() && capa) gC.drawImage(capa, 0, 0);
    dibuixaCadena('E');
    gC.strokeStyle = '#e3e7e3'; gC.lineWidth = 1;
    gC.beginPath(); gC.moveTo(10, LAY.sep); gC.lineTo(cC.width - 10, LAY.sep); gC.stroke();
    dibuixaCadena('D');
  }

  // ---------------------------------------------------------------
  // Espai de fases
  // ---------------------------------------------------------------
  const cFE = $('canvasFaseE'), cFD = $('canvasFaseD');
  const ultim = { E: null, D: null, VE: null, VD: null };   // punts i gràfica de l'últim dibuix (per als clics)
  const MARGE = { l: 50, r: 14, t: 14, b: 40 };
  function posaMapa(p, img) {
    const g = p.g;
    g.save(); g.imageSmoothingEnabled = true;
    g.drawImage(img, p.X(p.xmin), p.Y(p.ymax), p.X(p.xmax) - p.X(p.xmin), p.Y(p.ymin) - p.Y(p.ymax));
    g.restore();
  }
  function etiquetes(g, p, P, llista) {
    // si diversos àtoms cauen al mateix lloc, una sola etiqueta amb tots els índexs
    g.font = 'bold 11px sans-serif'; g.fillStyle = INK; g.textAlign = 'center';
    const etiq = [];
    llista.slice().sort((a, b) => a - b).forEach(j => {
      const z = P[j], rr = Math.hypot(z[0], z[1]), ux = rr > 1e-12 ? z[0] / rr : 0, uy = rr > 1e-12 ? z[1] / rr : 1;
      const x = p.X(z[0]) + 17 * ux, y = p.Y(z[1]) - 17 * uy + 4, e = etiq.find(o => Math.hypot(o.x - x, o.y - y) < 9);
      if (e) e.txt += ', ' + j; else etiq.push({ x, y, txt: String(j) });
    });
    etiq.forEach(o => g.fillText(o.txt, o.x, o.y));
  }

  function dibuixaFase(c, q) {
    const N = mod.N, R = rang(q), pos = q === 'E' ? posE : posD;
    const w = q === 'E' ? WE : mod.wD, cols = q === 'E' ? mod.colE : mod.colD;
    const p = Plot(c, { xmin: -R, xmax: R, ymin: -R, ymax: R, m: MARGE });
    const g = p.g;
    p.clear();
    p.axes('x = uₙ (Å)', q === 'E' ? 'p / Mω_E (Å)' : 'p / Mω (Å)', { nx: 5, ny: 5 });
    p.vline(0, { col: '#9aa8a0', w: 1 });

    if (fock()) { dibuixaFaseFock(p, q); ultim[q] = null; return; }

    const P = [];
    for (let n = 0; n < N; n++) P.push(pos(n, t));
    ultim[q] = { p, P };
    p.clip();
    if (state.orbites) {
      const radis = [];
      P.forEach(z => { const rr = Math.hypot(z[0], z[1]); if (rr > 1e-9 && !radis.some(x => Math.abs(x - rr) < 0.004 * R)) radis.push(rr); });
      g.strokeStyle = 'rgba(60,66,80,0.16)'; g.lineWidth = 1;
      radis.forEach(rr => { g.beginPath(); g.ellipse(p.X(0), p.Y(0), p.X(rr) - p.X(0), p.Y(0) - p.Y(rr), 0, 0, TAU); g.stroke(); });
    }
    if (state.uneix) {
      g.strokeStyle = 'rgba(60,66,80,0.38)'; g.lineWidth = 1.1; g.beginPath();
      P.forEach((z, n) => { if (n) g.lineTo(p.X(z[0]), p.Y(z[1])); else g.moveTo(p.X(z[0]), p.Y(z[1])); });
      g.closePath(); g.stroke();
    }
    const pxA = p.X(1) - p.X(0);                      // px per Å
    if (coherent()) {
      // núvols del punt zero (distribució de Husimi d'un estat coherent: gaussiana de desviació √2·Δx)
      const gb = capaBaixa(c);
      for (let n = 0; n < N; n++) {
        const s = (q === 'E' ? qm.wE : qm.wD[n]) * Math.SQRT2 * pxA;
        taca(gb, p.X(P[n][0]), p.Y(P[n][1]), s, s, 0, q, n, aTaca());
      }
      posaCapaBaixa(p);
    } else {
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
    }
    const s = state.sel, rp = coherent() ? 3 : N > 48 ? 4 : 5;
    let ve = [];
    if (s >= 0 && s < N) {
      ve = [(s + N - 1) % N, (s + 1) % N];
      g.strokeStyle = INK; g.lineWidth = 2;
      ve.forEach(j => { g.beginPath(); g.moveTo(p.X(P[s][0]), p.Y(P[s][1])); g.lineTo(p.X(P[j][0]), p.Y(P[j][1])); g.stroke(); });
    }
    for (let n = 0; n < N; n++) {
      g.beginPath(); g.arc(p.X(P[n][0]), p.Y(P[n][1]), rp, 0, TAU);
      g.fillStyle = cols[n]; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke();
    }
    if (s >= 0 && s < N) {
      ve.forEach(j => anella(g, p.X(P[j][0]), p.Y(P[j][1]), rp + 3, 1.3));
      anella(g, p.X(P[s][0]), p.Y(P[s][1]), rp + 4, 2.4);
      etiquetes(g, p, P, [s].concat(ve));
    }
    p.unclip();
    g.font = '11px sans-serif'; g.fillStyle = MUTED; g.textAlign = 'left';
    g.fillText((q === 'E' ? 'tots amb ν_E = ' : 'ν = ') + fmt(w / TAU, 2) + ' THz · gir horari ↻', p.m.l + 6, p.m.t + 13);
    g.textAlign = 'right';
    g.fillText('t = ' + t.toFixed(2) + ' ps', c.width - p.m.r - 6, p.m.t + 13);
  }

  // estat estacionari: distribució de Husimi de l'àtom ressaltat (un anell sense fase)
  function dibuixaFaseFock(p, q) {
    const g = p.g, j = jSel(), mapa = qm.mapaFase[q];
    const { s, ks } = nivellsAtom(q, j);
    p.clip();
    if (mapa) posaMapa(p, mapa);
    // l'òrbita clàssica amb la mateixa energia mitjana
    const nm = q === 'E' ? qm.nE[j] : qm.real ? qm.nD : qm.nD / 2, rc = s * Math.sqrt(2 * nm);
    if (rc > 0 && mapa) {
      g.strokeStyle = 'rgba(26,29,36,0.55)'; g.lineWidth = 1.2; g.setLineDash([5, 4]);
      g.beginPath(); g.ellipse(p.X(0), p.Y(0), p.X(rc) - p.X(0), p.Y(0) - p.Y(rc), 0, 0, TAU); g.stroke(); g.setLineDash([]);
    }
    p.unclip();
    g.font = '11px sans-serif'; g.fillStyle = MUTED; g.textAlign = 'left';
    let txt;
    if (!mapa) txt = "l'àtom " + j + ' és en un node del mode: no es mou';
    else if (q === 'E') txt = "àtom " + j + ': ' + (qm.nE[j] === 0 ? "estat fonamental, una taca sense fase" : qm.nE[j] + (qm.nE[j] === 1 ? ' quàntum' : ' quàntums') + ' · anell = fase indefinida');
    else if (qm.nD === 0) txt = "àtom " + j + " · el mode és a l'estat fonamental";
    else if (qm.real) txt = "àtom " + j + ' · el mode té ' + qm.nD + (qm.nD === 1 ? ' fonó' : ' fonons');
    else txt = "àtom " + j + ' · ' + qm.nD + (qm.nD === 1 ? ' fonó' : ' fonons') + ' a tota la cadena';
    g.fillText(txt, p.m.l + 6, p.m.t + 13);
    if (mapa && ks.length) {
      g.fillText('- - - òrbita clàssica amb la mateixa energia', p.m.l + 6, p.canvas.height - p.m.b - 8);
    }
  }

  // ---------------------------------------------------------------
  // Cada àtom contra el següent: u_{n+1} en funció de u_n
  // ---------------------------------------------------------------
  const cVE = $('canvasVeiE'), cVD = $('canvasVeiD');
  function dibuixaVeins(c, q) {
    const N = mod.N, R = rang(q), pos = q === 'E' ? posE : posD;
    const w = q === 'E' ? WE : mod.wD, cols = q === 'E' ? mod.colE : mod.colD;
    const p = Plot(c, { xmin: -R, xmax: R, ymin: -R, ymax: R, m: MARGE });
    const g = p.g;
    p.clear();
    p.axes('uₙ, desplaçament de l\'àtom n (Å)', 'uₙ₊₁, desplaçament del següent (Å)', { nx: 5, ny: 5 });
    p.vline(0, { col: '#9aa8a0', w: 1 });
    p.pts([[-R, -R], [R, R]], { col: '#9aa8a0', w: 1, dash: [5, 4] });
    p.pts([[-R, R], [R, -R]], { col: '#9aa8a0', w: 1, dash: [5, 4] });
    p.text('en fase', -0.96 * R, -0.96 * R, { col: MUTED, font: '10px sans-serif', dx: 10, dy: 2 });
    p.text('en oposició', 0.96 * R, -0.96 * R, { col: MUTED, font: '10px sans-serif', align: 'right', dx: -10, dy: 2 });
    if (fock()) { dibuixaVeinsFock(p, q); return; }

    const u = [];
    for (let n = 0; n < N; n++) u.push(pos(n, t)[0]);
    const P = u.map((x, n) => [x, u[(n + 1) % N]]);
    ultim['V' + q] = { p, P };
    p.clip();
    // trajectòria de cada parell en un període: una el·lipse (Lissajous amb la mateixa freqüència)
    if (state.orbites) {
      const una = q === 'D' && state.ona === 'viatgera';      // totes les parelles fan la mateixa
      const per = TAU / w, K = N > 32 ? 36 : 72;
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
    const pxA = p.X(1) - p.X(0);
    if (coherent()) {
      // núvol conjunt del punt zero: independent a Einstein, inclinat (correlacionat) a Debye
      const gb = capaBaixa(c);
      for (let n = 0; n < N; n++) {
        const X = p.X(P[n][0]), Y = p.Y(P[n][1]);
        if (q === 'E') taca(gb, X, Y, qm.wE * pxA, qm.wE * pxA, 0, q, n, aTaca());
        else if (!qm.real) {
          const c0 = Math.cos(mod.qd), sg = qm.wD[0] * pxA;
          taca(gb, X, Y, sg * Math.sqrt(Math.max(0, 1 + c0)), sg * Math.sqrt(Math.max(0, 1 - c0)), -Math.PI / 4, q, n, aTaca());
        } else {
          const e1 = qm.e[n], e2 = qm.e[(n + 1) % N], le = Math.hypot(e1, e2);
          taca(gb, X, Y, le * qm.x0D / Math.SQRT2 * pxA, 0.7 * BAIXA, -Math.atan2(e2, e1), q, n, 0.5);
        }
      }
      posaCapaBaixa(p);
    } else {
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
    }
    const rp = coherent() ? 3 : N > 48 ? 4 : 5;
    for (let n = 0; n < N; n++) {
      g.beginPath(); g.arc(p.X(P[n][0]), p.Y(P[n][1]), rp, 0, TAU);
      g.fillStyle = cols[n]; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke();
    }
    marcaParell(g, p, P, rp);
    p.unclip();
    const r = pearson(u);
    g.font = '11px sans-serif'; g.fillStyle = MUTED; g.textAlign = 'left';
    g.fillText((coherent() ? 'r de les mitjanes = ' : 'r = ') + (isFinite(r) ? fmt(r, 2) : '—') + ' en aquest instant', p.m.l + 6, p.m.t + 13);
    if (q === 'D') { g.textAlign = 'right'; g.fillText('cos qd = ' + fmt(Math.cos(mod.qd), 2), c.width - p.m.r - 6, p.m.t + 13); }
  }
  function marcaParell(g, p, P, rp) {
    const s = state.sel, N = mod.N;
    if (s < 0 || s >= N) return;
    const x = p.X(P[s][0]), y = p.Y(P[s][1]);
    anella(g, x, y, rp + 4, 2.4);
    g.font = 'bold 11px sans-serif'; g.fillStyle = INK; g.textAlign = 'left';
    g.fillText('(' + s + ', ' + (s + 1) % N + ')', x + rp + 7, y - rp - 4);
  }

  // estat estacionari: probabilitat conjunta del parell ressaltat i les mesures de tots els parells
  function dibuixaVeinsFock(p, q) {
    const g = p.g, N = mod.N, j = jSel(), mapa = qm.mapaVei[q];
    p.clip();
    if (mapa) posaMapa(p, mapa);
    else if (q === 'D') {
      // mode real: tota la probabilitat és sobre la recta (u_j, u_{j+1}) = x₀ ξ (e_j, e_{j+1})
      const T = qm.tD, e1 = qm.e[j], e2 = qm.e[(j + 1) % N], c = RGB.D;
      g.lineWidth = 4; g.lineCap = 'round';
      const npt = 300;
      for (let i = 0; i < npt; i++) {
        const xa = -T.L + 2 * T.L * i / npt, xb = -T.L + 2 * T.L * (i + 1) / npt, a = densitat(T, (xa + xb) / 2) / T.mx;
        if (a < 0.01) continue;
        g.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.9 * Math.pow(a, 0.85)) + ')';
        g.beginPath(); g.moveTo(p.X(xa * qm.x0D * e1), p.Y(xa * qm.x0D * e2)); g.lineTo(p.X(xb * qm.x0D * e1), p.Y(xb * qm.x0D * e2)); g.stroke();
      }
      g.lineCap = 'butt';
    }
    // mesures
    if (state.acum) {
      mesures.slice(0, -1).forEach(ms => {
        const u = ms[q];
        for (let n = 0; n < N; n++) { g.beginPath(); g.arc(p.X(u[n]), p.Y(u[(n + 1) % N]), 1.6, 0, TAU); g.fillStyle = color(q, n, 0.4); g.fill(); }
      });
    }
    const ult = darrera();
    let P = null;
    if (ult) {
      const u = ult[q];
      P = Array.from(u, (x, n) => [x, u[(n + 1) % N]]);
      const rp = N > 48 ? 3.5 : 4.5;
      P.forEach((z, n) => {
        g.beginPath(); g.arc(p.X(z[0]), p.Y(z[1]), rp, 0, TAU);
        g.fillStyle = mod['col' + q][n]; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke();
      });
      marcaParell(g, p, P, rp);
    }
    ultim['V' + q] = P ? { p, P } : null;
    p.unclip();
    g.font = '11px sans-serif'; g.fillStyle = MUTED; g.textAlign = 'left';
    const rEsp = q === 'E' ? 0 : Math.cos(mod.qd), rM = ult ? pearson(Array.from(ult[q])) : NaN;
    g.fillText('⟨r⟩ = ' + fmt(rEsp, 2) + (q === 'D' ? ' = cos qd' : '') + ' · r de l\'última mesura = ' + (isFinite(rM) ? fmt(rM, 2) : '—'), p.m.l + 6, p.m.t + 13);
    const sub = n => String(n).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);
    g.fillText('color: P(u' + sub(j) + ', u' + sub((j + 1) % N) + ') · punts: mesures', p.m.l + 6, p.m.t + 28);
  }

  // ---------------------------------------------------------------
  // Correlació
  // ---------------------------------------------------------------
  const cK = $('canvasCorr');
  let hoverK = null, pK = null;
  function punts(g, p, arr, col, buit) {
    arr.forEach(z => {
      if (!isFinite(z[1])) return;
      g.beginPath(); g.arc(p.X(z[0]), p.Y(z[1]), buit ? 6.5 : 4.5, 0, TAU);
      if (buit) { g.lineWidth = 1.5; g.strokeStyle = col; g.stroke(); }
      else { g.fillStyle = col; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke(); }
    });
  }
  // valors de C(k) segons la descripció
  function dadesCorr() {
    const N = mod.N, Km = Math.floor(N / 2), cosD = [];
    for (let k = 0; k <= Km; k++) cosD.push(Math.cos(mod.qd * k));
    if (!state.quant) return { E: mod.CE, D: mod.CD };
    if (fock()) {
      const ult = darrera();
      return {
        E: cosD.map((c, k) => k ? 0 : 1), D: cosD,
        Em: ult ? correlacioPosicions(Array.from(ult.E)) : null, Dm: ult ? correlacioPosicions(Array.from(ult.D)) : null
      };
    }
    // coherent: ⟨u_j u_{j+k} + p̃_j p̃_{j+k}⟩ = producte de mitjanes + punt zero (només k = 0 a Einstein)
    const P = [];
    for (let n = 0; n < N; n++) P.push(posE(n, 0));
    let s0 = 0;
    P.forEach(z => { s0 += z[0] * z[0] + z[1] * z[1] + 2 * qm.wE * qm.wE; });
    const E = [];
    for (let k = 0; k <= Km; k++) {
      let s = 0;
      for (let n = 0; n < N; n++) { const a = P[n], b = P[(n + k) % N]; s += a[0] * b[0] + a[1] * b[1]; }
      E.push(k ? s / s0 : 1);
    }
    return { E, D: cosD };
  }
  function dibuixaCorr() {
    const N = mod.N, Km = Math.floor(N / 2), dd = dadesCorr();
    const p = Plot(cK, { xmin: -0.4, xmax: Km + 0.4, ymin: -1.15, ymax: 1.15, m: MARGE });
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
    const ptE = dd.E.map((c, k) => [k, c]), ptD = dd.D.map((c, k) => [k, c]);
    p.pts(ptE.filter(z => isFinite(z[1])), { col: COL_E, w: 1.2, alpha: 0.55 });
    p.pts(ptD.filter(z => isFinite(z[1])), { col: COL_D, w: 1.2, alpha: 0.55 });
    p.clip();
    if (dd.Em) { punts(g, p, dd.Em.map((c, k) => [k, c]), COL_E, true); punts(g, p, dd.Dm.map((c, k) => [k, c]), COL_D, true); }
    punts(g, p, ptE, COL_E); punts(g, p, ptD, COL_D);
    p.unclip();
    if (hoverK !== null && hoverK <= Km) {
      p.vline(hoverK, { col: '#555', w: 1, dash: [3, 3] });
      const lin = ['k = ' + hoverK + ' (àtoms n i n + ' + hoverK + ')', 'Einstein: C = ' + fmt(dd.E[hoverK], 3), 'Debye: C = ' + fmt(dd.D[hoverK], 3)];
      if (dd.Em) lin.push('última mesura: ' + fmt(dd.Em[hoverK], 2) + ' i ' + fmt(dd.Dm[hoverK], 2));
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
    const k = Math.round(pK.invX(px)), h = k >= 0 && k <= Math.floor(mod.N / 2) ? k : null;
    if (h !== hoverK) { hoverK = h; brut = true; }
  });
  cK.addEventListener('mouseleave', () => { hoverK = null; brut = true; });

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
  // Textos: títols, fórmules, lectures i estat
  // ---------------------------------------------------------------
  const IDS_TEXT = ['titCad', 'titFaseE', 'titFaseD', 'titVeiE', 'titVeiD', 'descCad', 'descFaseE', 'descFaseD', 'descVeiE', 'descVeiD', 'descCorr'];
  const TEXT_CLASSIC = {};
  IDS_TEXT.forEach(id => { TEXT_CLASSIC[id] = $(id).innerHTML; });
  const TEXT_FOCK = {
    titCad: 'Les dues cadenes: núvols de probabilitat i mesures',
    titFaseE: "Espai de fases d'un àtom: Einstein",
    titFaseD: "Espai de fases d'un àtom: Debye",
    titVeiE: 'Probabilitat conjunta de dos veïns: Einstein',
    titVeiD: 'Probabilitat conjunta de dos veïns: Debye',
    descCad: "En un estat estacionari res no es mou: cada àtom té un núvol de probabilitat que no canvia amb el temps (la franja de color, a la cadena i a la gràfica de desplaçaments). Els punts són una mesura de la posició de tots els àtoms alhora; cada mesura és un sorteig nou de |Ψ|², no un instant posterior. A Einstein cada mesura és soroll. A Debye cada mesura és una ona del mode, amb una amplitud i una fase a l'atzar.",
    descFaseE: "Distribució de Husimi de l'àtom ressaltat: la probabilitat de trobar-lo a prop de (x, p), amb la resolució mínima que permet el principi d'incertesa. En un estat estacionari és un anell: la fase no està definida. La línia discontínua és l'òrbita clàssica amb la mateixa energia.",
    descFaseD: "El mateix per a un àtom de la cadena de Debye: també és un anell sense fase. Mirant un sol àtom, els dos models no es distingeixen. La correlació no és en cap àtom: és entre àtoms.",
    descVeiE: "En color, la densitat de probabilitat P(u<sub>j</sub>, u<sub>j+1</sub>) del parell ressaltat; en punts, l'última mesura de tots els parells. És el producte de les dues distribucions individuals: saber on és un àtom no diu res de l'altre, i ⟨r⟩ = 0.",
    descVeiD: "A Debye la probabilitat conjunta no és un producte. En l'ona viatgera és un anell el·líptic inclinat; en l'estacionària, una recta. Totes les mesures hi cauen a sobre, i ⟨r⟩ = cos qd fins i tot amb zero fonons: el punt zero d'un mode també està correlacionat.",
    descCorr: "Valors esperats quàntics (punts plens). A Einstein, C(k) = 0 exactament: en un estat estacionari no hi ha ni tan sols fases a l'atzar. A Debye, cos(qkd), com en el cas clàssic. Els cercles buits són el que dona l'última mesura: a Einstein queda dins del marge de l'atzar; a Debye cau exactament sobre cos(qkd). Passa el ratolí per sobre per llegir els valors."
  };
  const TEXT_COHERENT = {
    titCad: 'Les dues cadenes: estat coherent',
    titFaseE: 'Espai de fases: Einstein, estat coherent',
    titFaseD: 'Espai de fases: Debye, estat coherent',
    titVeiE: 'Cada àtom contra el següent: Einstein, estat coherent',
    titVeiD: 'Cada àtom contra el següent: Debye, estat coherent',
    descCad: "Un estat coherent és una superposició d'estats amb diferent nombre de quàntums. La posició mitjana de cada àtom fa exactament el moviment clàssic, i al voltant hi ha el núvol del punt zero, que no canvia de mida.",
    descFaseE: "Cada àtom és una taca (la distribució de Husimi d'un estat coherent) que segueix l'òrbita clàssica. La mida de la taca només depèn de ħ, M i ω: com més energia, més petita és comparada amb l'òrbita. És el límit clàssic.",
    descFaseD: "El mateix per al mode de Debye. Les taques dels àtoms de Debye són més petites perquè el punt zero d'un mode es reparteix entre els N àtoms.",
    descVeiE: "Les mitjanes dels parells recorren les mateixes el·lipses que en el cas clàssic. Les taques del punt zero són rodones: les fluctuacions de dos àtoms d'Einstein són independents.",
    descVeiD: "Les taques de Debye estan inclinades sobre la diagonal: les fluctuacions del punt zero de dos veïns també estan correlacionades, amb el mateix cos qd que el moviment.",
    descCorr: "C(k) de l'estat coherent. A Einstein queda una mica per sota del valor clàssic, perquè el punt zero de cada àtom hi suma soroll independent. A Debye és cos(qkd), com en el cas clàssic. Passa el ratolí per sobre per llegir els valors."
  };
  function posaTextos() {
    const T = !state.quant ? TEXT_CLASSIC : fock() ? TEXT_FOCK : TEXT_COHERENT;
    IDS_TEXT.forEach(id => { if ($(id).innerHTML !== T[id]) $(id).innerHTML = T[id]; });
  }

  const energia = x => x >= 1000 ? fmt(x / 1000, 3) + ' eV' : fmt(x, 1) + ' meV';

  function dibuixaText() {
    const N = mod.N, m = mod.m, nuE = WE / TAU, nuD = mod.wD / TAU, eps = state.eps;
    const graus = 360 * m / N, Etot = N * eps;
    posaTextos();
    if (state.quant) { dibuixaTextQ(); return; }
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
    Fon.readout($('lectura'), [
      ['N', N + ' àtoms'],
      ['ε = E/N', fmt(eps, 1) + ' meV'],
      ['E total', energia(Etot)],
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
    if (state.eps === 0) est.textContent = 'Sense energia, clàssicament no es mou res. Passa a la descripció quàntica per veure el punt zero.';
    else if (state.ein === 'un') est.textContent = "Un sol mode d'Einstein mou un sol àtom (el " + nUn() + '); la resta no es mouen. Un sol mode de Debye, amb la mateixa energia, mou tots els àtoms.';
    else if (2 * m === N) est.textContent = 'Vora de zona: cada àtom va en oposició de fase amb els veïns. C(1) = −1: correlació màxima, de signe negatiu.';
    else if (m === 1) est.textContent = "Mode de longitud d'ona més llarga: els veïns van gairebé en fase (desfasament 2π/N = " + fmt(graus, 1) + '°). Com més gran és N, més a prop són a l\'espai de fases.';
    else est.textContent = 'Cada àtom de Debye va desfasat qd = ' + fmt(graus, 1) + "° respecte de l'anterior: coneguda la fase d'un àtom, es coneixen les de tots.";

    $('notaEnergia').innerHTML = 'Energia total de cada cadena: E = Nε = ' + energia(Etot) +
      '. Clàssicament, cada oscil·lador té de mitjana una energia kT (equipartició): ε = ' + fmt(eps, 1) + ' meV correspon a T ≈ ' + fmt(eps * MEV / KB, 0) + ' K.';
  }

  function dibuixaTextQ() {
    const N = mod.N, m = mod.m, eps = state.eps, Etot = N * eps, q = qm, cq = Math.cos(mod.qd);
    const sDat = q.kN * q.x0D;
    const filaZero = { nom: 'Mida del punt zero', tex: [
      'x_0=\\sqrt{\\frac{\\hbar}{M\\omega}}:\\qquad \\text{Einstein: }\\ x_0=' + fmt(q.x0E, 3) + '\\ \\text{Å},\\qquad \\text{Debye, per àtom: }\\ \\sqrt{\\tfrac{2}{N}}\\,x_0=' + fmt(sDat, 3) + '\\ \\text{Å}'],
      nota: "El punt zero d'un mode de Debye es reparteix entre els N àtoms: cada àtom només en rep una part petita." };
    if (fock()) {
      const rowsD = q.real
        ? 'u_j=e_j\\,Q,\\quad e_j=\\sqrt{\\tfrac{2}{N}}\\cos qjd,\\qquad |\\Psi(Q)|^2=|\\psi_n(Q)|^2\\quad(n=' + q.nD + ')'
        : 'u_j=\\sqrt{\\tfrac{2}{N}}\\big(Q_c\\cos qjd+Q_s\\sin qjd\\big),\\qquad |\\Psi(Q_c,Q_s)|^2\\propto\\rho^{2n}e^{-\\rho^2/x_0^2},\\quad \\rho^2=Q_c^2+Q_s^2\\quad(n=' + q.nD + ')';
      Fon.formulas($('formules'), [
        { nom: 'Quantització', tex: [
          'E_n=\\left(n+\\tfrac12\\right)\\hbar\\omega:\\qquad \\hbar\\omega_E=' + fmt(q.hwE, 2) + '\\ \\text{meV},\\qquad \\hbar\\omega(q)=' + fmt(q.hwD, 2) + '\\ \\text{meV}',
          'E=N\\varepsilon=' + fmt(Etot, 1) + '\\ \\text{meV}\\ \\Rightarrow\\ n_{\\text{Einstein}}=' + q.nTotE + '\\ \\ (\\text{sobren } ' + fmt(q.restE, 1) + '\\ \\text{meV}),\\qquad n_{\\text{Debye}}=' + q.nD + '\\ \\ (\\text{sobren } ' + fmt(q.restD, 1) + '\\ \\text{meV})'],
          nota: "Cada model només pot absorbir quàntums sencers del seu ħω. L'energia que no arriba a un quàntum no hi entra." },
        { nom: "Einstein: la funció d'ona és un producte", tex: [
          '\\Psi(u_1,\\dots,u_N)=\\prod_j\\psi_{n_j}(u_j)\\ \\Rightarrow\\ P(u_j,u_{j+1})=|\\psi_{n_j}(u_j)|^2\\,|\\psi_{n_{j+1}}(u_{j+1})|^2'],
          nota: 'La probabilitat conjunta és el producte de les individuals: els àtoms són independents i ⟨u_j u_{j+k}⟩ = 0.' },
        { nom: 'Debye: un mode, totes les posicions', tex: [rowsD],
          nota: q.real
            ? "Cada mesura dona un valor de Q i, per tant, la mateixa forma e_j a tota la cadena amb una amplitud a l'atzar. Als nodes (e_j = 0) l'àtom no es mou."
            : "Cada mesura dona un parell (Q_c, Q_s) i, per tant, una sinusoide de vector q a tota la cadena. L'amplitud i la fase surten a l'atzar, però el desfasament entre veïns sempre és qd." },
        filaZero,
        { nom: 'Correlació', tex: [
          q.real
            ? '\\langle u_ju_{j+k}\\rangle_{\\text{Einstein}}=0,\\qquad \\langle u_ju_{j+k}\\rangle_{\\text{Debye}}=e_je_{j+k}\\left(n+\\tfrac12\\right)x_0^2\\ \\Rightarrow\\ C(k)=\\cos(qkd)'
            : '\\langle u_ju_{j+k}\\rangle_{\\text{Einstein}}=0,\\qquad \\langle u_ju_{j+k}\\rangle_{\\text{Debye}}=(n+1)\\,\\frac{x_0^2}{N}\\cos(qkd)\\ \\Rightarrow\\ C(k)=\\cos(qkd)'],
          nota: "També amb n = 0: el punt zero d'un mode ja està correlacionat. Aquí només hi ha el mode triat; el punt zero de tots els modes junts dona una correlació diferent." }
      ]);
      const nMax = Math.max(...q.nE), nMin = Math.min(...q.nE);
      Fon.readout($('lectura'), [
        ['N', N + ' àtoms'],
        ['E = Nε', energia(Etot)],
        ['ħω_E (Einstein)', fmt(q.hwE, 2) + ' meV'],
        ['quàntums Einstein', String(q.nTotE)],
        ['  per àtom', nMin === nMax ? String(nMin) : 'de ' + nMin + ' a ' + nMax],
        ['  energia que sobra', fmt(q.restE, 1) + ' meV'],
        ['ħω (Debye, m = ' + m + ')', fmt(q.hwD, 2) + ' meV'],
        ['fonons al mode', String(q.nD)],
        ['  energia que sobra', fmt(q.restD, 1) + ' meV'],
        ['x₀ Einstein', fmt(q.x0E, 3) + ' Å'],
        ['√(2/N)·x₀ Debye', fmt(sDat, 3) + ' Å'],
        ['⟨r⟩ veïns Einstein', '0'],
        ['⟨r⟩ veïns Debye', fmt(cq, 3)],
        ['mesures fetes', String(mesures.length) + (mesures.length >= 60 ? ' (es guarden les 60 últimes)' : '')]
      ]);
      const est = $('estat');
      est.className = 'estat si';
      if (q.nTotE === 0 && q.nD === 0) est.textContent = "Cap dels dos models pot absorbir un quàntum: tots dos són a l'estat fonamental. Tot i així, el punt zero del mode de Debye està correlacionat i el d'Einstein no.";
      else if (q.nTotE === 0) est.textContent = "Einstein no pot absorbir cap quàntum (ħω_E = " + fmt(q.hwE, 1) + ' meV és més que E = ' + fmt(Etot, 1) + " meV) i es queda a l'estat fonamental. El mode de Debye, amb quàntums de " + fmt(q.hwD, 1) + ' meV, n\'absorbeix ' + q.nD + '.';
      else if (q.nD === 0) est.textContent = "El mode de Debye no pot absorbir cap fonó (ħω = " + fmt(q.hwD, 1) + " meV) i es queda a l'estat fonamental; continua correlacionat.";
      else est.textContent = 'Estats estacionaris: res no es mou. La correlació no és en cap àtom sol: és a la probabilitat conjunta i a les mesures.';
      $('notaEnergia').innerHTML = 'Energia total de cada cadena: E = Nε = ' + energia(Etot) + '. Cada model només n\'agafa quàntums sencers: Einstein, de ' + fmt(q.hwE, 1) + ' meV; el mode de Debye, de ' + fmt(q.hwD, 2) + ' meV.';
    } else {
      const nE = Etot / q.hwE, nD = Etot / q.hwD;
      Fon.formulas($('formules'), [
        { nom: 'Estat coherent', tex: [
          '\\langle u_j\\rangle(t)=u_j^{\\text{clàssic}}(t),\\qquad \\Delta u_j=\\frac{x_0}{\\sqrt2}\\ \\ \\text{(Einstein)},\\qquad \\Delta u_j=\\sqrt{\\tfrac{2}{N}}\\,\\frac{x_0}{\\sqrt2}\\ \\ \\text{(Debye)}'],
          nota: "La mitjana fa exactament el moviment clàssic, i la mida del núvol no canvia amb el temps ni amb l'energia." },
        { nom: 'Energia', tex: [
          '\\langle n\\rangle=\\frac{E}{\\hbar\\omega}:\\qquad \\langle n\\rangle_{\\text{Einstein}}=' + fmt(nE, 2) + '\\ \\text{(en total)},\\qquad \\langle n\\rangle_{\\text{Debye}}=' + fmt(nD, 2) + ',\\qquad \\Delta n=\\sqrt{\\langle n\\rangle}'],
          nota: "En un estat coherent l'energia no està fixada: el nombre de quàntums fluctua. Per això el núvol es pot moure." },
        filaZero,
        { nom: 'Correlació', tex: [
          '\\text{Einstein: } C(k)=\\frac{\\sum_j A_jA_{j+k}\\cos(\\varphi_{j+k}-\\varphi_j)}{\\sum_j\\left(A_j^2+x_0^2\\right)},\\qquad \\text{Debye: } C(k)=\\cos(qkd)'],
          nota: 'A Debye, el punt zero del mode té la mateixa correlació que el moviment.' }
      ]);
      Fon.readout($('lectura'), [
        ['N', N + ' àtoms'],
        ['E = Nε', energia(Etot)],
        ['⟨n⟩ Einstein (total)', fmt(nE, 2)],
        ['⟨n⟩ mode de Debye', fmt(nD, 2)],
        ['amplitud clàssica E', fmt(Math.max(...mod.AE), 3) + ' Å'],
        ['Δu Einstein', fmt(q.wE, 3) + ' Å'],
        ['amplitud clàssica D', fmt(mod.AD, 3) + ' Å'],
        ['Δu Debye (màx.)', fmt(Math.max(...q.wD), 3) + ' Å'],
        ['⟨r⟩ veïns Debye', fmt(cq, 3)]
      ]);
      const est = $('estat');
      est.className = 'estat si';
      const rel = Math.max(...mod.AE) / q.wE;
      est.textContent = rel < 1.5 ? "Amb tan poca energia, el núvol és tan gran com l'òrbita: el moviment quasi no es veu. Puja l'energia per arribar al límit clàssic."
        : "Estat coherent: els núvols segueixen les trajectòries clàssiques. Amb més energia, el núvol es fa petit comparat amb l'òrbita.";
      $('notaEnergia').innerHTML = 'Energia total de cada cadena: E = Nε = ' + energia(Etot) + '. En un estat coherent l\'energia mitjana pot prendre qualsevol valor.';
    }
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const setMode = Fon.optionGroup($('grupMode'), v => { state.quant = v === 'quantic'; render(); });
  const setEstat = Fon.optionGroup($('grupEstat'), v => { state.estat = v; render(); });
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
  $('btnMesura').addEventListener('click', () => { mesura(); dibuixaText(); });
  $('chkAuto').addEventListener('change', () => { state.auto = $('chkAuto').checked; });
  $('chkAcum').addEventListener('change', () => { state.acum = $('chkAcum').checked; brut = true; });

  let clauFis = '', clauCapa = '';
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
    $('chkAuto').checked = state.auto; $('chkAcum').checked = state.acum;
    $('btnPlay').textContent = state.playing ? '❚❚ Atura l\'animació' : '▶ Engega l\'animació';
    setMode(state.quant ? 'quantic' : 'classic'); setEstat(state.estat);
    setEin(state.ein); setOna(state.ona); setDisp(state.disp);
    $('cardQuantic').hidden = !state.quant;
    $('blocMesures').hidden = !fock();
    $('notaCoherent').hidden = !coherent();
    $('llegMesura').hidden = !fock();
    $('notaMode').textContent = state.quant
      ? "L'energia entra en quàntums ħω. Tria un estat estacionari (res no es mou) o un de coherent (el pont amb el clàssic)."
      : 'Els àtoms són punts que es mouen seguint les lleis de Newton.';
    calcula();
    degradats.clear();
    if (state.quant) {
      calculaQ();
      // si canvia la física, les mesures d'abans ja no valen
      const clau = [state.N, state.eps, state.m, state.ona, state.disp, state.ein, state.llavor, state.estat].join('|');
      if (clau !== clauFis) { clauFis = clau; mesures = []; if (fock()) mesura(); }
      if (fock()) {
        qm.mapaFase = { E: mapaHusimi('E', jSel()), D: mapaHusimi('D', jSel()) };
        qm.mapaVei = { E: mapaVeinsE(jSel()), D: mapaVeinsD() };
        const cc = clau + '|' + state.exag + '|' + state.colors;
        if (cc !== clauCapa || !capa) { clauCapa = cc; capa = capaNuvols(); }
      }
    } else { clauFis = ''; }
    dibuixaText();
    dibuixa();
  }
  function dibuixa() {
    brut = false;
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
    if (fock()) {
      if (state.playing && state.auto && now - tMesura > 1000 / state.vel) { mesura(); dibuixaText(); }
    } else if (state.playing) { t += dt * RITME * state.vel; brut = true; }
    if (brut) dibuixa();
    requestAnimationFrame(loop);
  }

  Fon.linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams();
    if (state.quant) { p.set('desc', 'quantica'); p.set('estat', state.estat); }
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
    if (!state.auto) p.set('auto', 0);
    if (state.acum) p.set('acum', 1);
    p.set('sel', state.sel);
    if (!state.playing) p.set('atura', 1);
    return p;
  });
  (function fromURL() {
    const p = Fon.params();
    if (p.get('desc') === 'quantica') state.quant = true;
    if (['fock', 'coherent'].includes(p.get('estat'))) state.estat = p.get('estat');
    Fon.num(p, 'N', x => { state.N = Math.round(x); }, 4, NMAX);
    Fon.num(p, 'eps', x => { state.eps = x; }, 0, 200);
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
    if (p.get('auto') === '0') state.auto = false;
    if (p.get('acum') === '1') state.acum = true;
    Fon.num(p, 'sel', x => { state.sel = Math.round(x); }, -1, NMAX - 1);
    if (p.get('atura') === '1') state.playing = false;
    sorteja();
    render();
    requestAnimationFrame(loop);
  })();
})();
