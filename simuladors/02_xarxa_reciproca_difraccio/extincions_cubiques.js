// Simulador — de la cúbica simple a BCC, FCC i diamant: pics que desapareixen.
// Mateixa cel·la cúbica convencional per a totes les estructures, G = (2π/a)(h,k,l).
// Convencions dels apunts del Tema 2: S = Σ f_j e^{−iG·c_j} = Σ f_j e^{−2πi(hx_j+ky_j+lz_j)}.
// Els àtoms dels vèrtexs pesen f = 1; els àtoms afegits pesen w (0 = no hi són, 1 = iguals).

(function () {
  'use strict';

  const TAU = 2 * Math.PI;
  const COL = { base: '#2980b9', centre: '#e67e22', cares: '#e67e22', diamant: '#8e44ad' };
  const COL_MAIN = '#00722b', COL_GHOST = '#9aa8a0', COL_OFF = '#c0392b', COL_PRIM = '#1f5fa8';
  const TTH_MIN = 10;

  const STRUCT = {
    sc:  { nom: 'Cúbica simple (SC)', curt: 'SC', grups: [] },
    bcc: { nom: 'Cúbica centrada al cos (BCC)', curt: 'BCC', grups: ['centre'] },
    fcc: { nom: 'Cúbica centrada a les cares (FCC)', curt: 'FCC', grups: ['cares'] },
    dia: { nom: 'Diamant', curt: 'Diamant', grups: ['cares', 'diamant'] }
  };
  const ORDRE = ['sc', 'bcc', 'fcc', 'dia'];
  const GRUP_POS = {
    centre: 'àtom del centre del cub, (½,½,½)',
    cares: 'àtoms del centre de les cares',
    diamant: 'còpia desplaçada (¼,¼,¼)'
  };
  const GRUP_NOM = {
    centre: 'Centre del cub: f<sub>centre</sub> / f<sub>vèrtex</sub>',
    cares: 'Centre de les cares: f<sub>cara</sub> / f<sub>vèrtex</sub>',
    diamant: 'Còpia (¼,¼,¼): f<sub>còpia</sub> / f<sub>FCC</sub>'
  };
  const simbHTML = g => state.est === 'dia' ? (g === 'cares' ? 'w<sub>c</sub>' : 'w<sub>d</sub>') : 'w';

  const state = {
    est: 'fcc', w: { centre: 1, cares: 1, diamant: 1 },
    a: 3.36, lambda: 1.5406, tthMax: 140, alcada: 'S', fase: false,
    sel: [1, 0, 0], rotY: -0.55, rotX: 0.32
  };

  // ---------------------------------------------------------------
  // Física
  // ---------------------------------------------------------------
  const FCC4 = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]];

  // Base de la cel·la convencional per a una estructura i uns pesos
  function basis(est, w) {
    const at = [{ p: [0, 0, 0], w: 1, g: 'base' }];
    if (est === 'bcc') at.push({ p: [0.5, 0.5, 0.5], w: w.centre, g: 'centre' });
    if (est === 'fcc' || est === 'dia') FCC4.slice(1).forEach(p => at.push({ p, w: w.cares, g: 'cares' }));
    if (est === 'dia') {
      at.slice(0, 4).forEach(a0 => at.push({ p: a0.p.map(x => x + 0.25), w: a0.w * w.diamant, g: 'diamant' }));
    }
    return at;
  }
  const FULL = { centre: 1, cares: 1, diamant: 1 };

  function Shkl(h, k, l, at) {
    let re = 0, im = 0;
    for (const a of at) {
      const ph = -TAU * (h * a.p[0] + k * a.p[1] + l * a.p[2]);
      re += a.w * Math.cos(ph); im += a.w * Math.sin(ph);
    }
    return { re, im };
  }
  const sumW = at => at.reduce((s, a) => s + a.w, 0);

  // Famílies {h,k,l} (h ≥ k ≥ l ≥ 0) i tots els seus membres amb signes i permutacions
  function families(Nmax) {
    const out = [];
    const hm = Math.floor(Math.sqrt(Nmax));
    for (let h = 0; h <= hm; h++) for (let k = 0; k <= h; k++) for (let l = 0; l <= k; l++) {
      const N = h * h + k * k + l * l;
      if (N === 0 || N > Nmax) continue;
      const mem = new Set();
      const perms = [[h, k, l], [h, l, k], [k, h, l], [k, l, h], [l, h, k], [l, k, h]];
      for (const p of perms) for (let s = 0; s < 8; s++) {
        const q = [p[0] * (s & 1 ? -1 : 1), p[1] * (s & 2 ? -1 : 1), p[2] * (s & 4 ? -1 : 1)];
        mem.add(q.join(','));
      }
      out.push({ hkl: [h, k, l], N, members: [...mem].map(x => x.split(',').map(Number)) });
    }
    out.sort((a, b) => a.N - b.N || b.hkl[0] - a.hkl[0]);
    return out;
  }

  let famCache = null, famKey = null;
  function getFamilies() {
    const sMax = Math.sin(state.tthMax / 2 * Math.PI / 180);
    const Nmax = Math.floor(Math.pow(2 * state.a * sMax / state.lambda, 2) + 1e-9);
    const key = Nmax;
    if (key !== famKey) { famCache = families(Nmax); famKey = key; }
    return famCache;
  }

  // Intensitats normalitzades de cada família per a una estructura i uns pesos
  //   iS  = |S|²/(Σf)² mitjà sobre la família (1 = com la SC)
  //   iMS = multiplicitat × iS
  function pattern(est, w) {
    const at = basis(est, w), W = sumW(at);
    return getFamilies().map(f => {
      const d = state.a / Math.sqrt(f.N);
      const s = state.lambda / (2 * d);
      const tth = 2 * Math.asin(Math.min(1, s)) * 180 / Math.PI;
      let sum = 0;
      for (const m of f.members) { const S = Shkl(m[0], m[1], m[2], at); sum += S.re * S.re + S.im * S.im; }
      const iS = sum / (f.members.length * W * W);
      return { f, d, s, tth, m: f.members.length, iS, iMS: f.members.length * iS };
    }).filter(p => p.s <= 1 && p.tth >= TTH_MIN);
  }

  // Pics agrupats per h²+k²+l² (mateix 2θ): p. ex. (221)/(300)
  function peaksByN(pat) {
    const map = new Map();
    for (const p of pat) {
      if (!map.has(p.f.N)) map.set(p.f.N, { N: p.f.N, tth: p.tth, list: [] });
      map.get(p.f.N).list.push(p);
    }
    const mMax = Math.max(1, ...pat.map(p => p.m));
    return [...map.values()].map(g => {
      const mTot = g.list.reduce((s, p) => s + p.m, 0);
      const ms = g.list.reduce((s, p) => s + p.iMS, 0);
      return Object.assign(g, {
        hS: ms / mTot,                 // |S|² mitjà (només interferència)
        hMS: ms / mMax,                // multiplicitat × |S|², relatiu a la família més gran
        ghostMS: mTot / mMax,
        label: g.list.map(p => '(' + p.f.hkl.join('') + ')').join('/')
      });
    });
  }
  const heightOf = g => state.alcada === 'S' ? g.hS : g.hMS;
  const ghostOf = g => state.alcada === 'S' ? 1 : g.ghostMS;
  const isOff = h => h < 1e-6;

  // ---------------------------------------------------------------
  // Quina és de debò la xarxa de Bravais?
  // Un àtom afegit només genera una translació nova si és idèntic al del vèrtex (f₂/f₁ = 1).
  // ---------------------------------------------------------------
  const ONE = x => x >= 0.9999;
  function bravais() {
    const w = state.w, n = basis(state.est, w).filter(a => a.w > 1e-4).length;
    const scText = n === 1 ? 'Cúbica simple, 1 àtom per cel·la'
      : 'Cúbica simple amb una base de ' + n + ' àtoms';
    if (state.est === 'bcc') {
      if (ONE(w.centre)) return { tipus: 'bcc', text: 'BCC: l\'àtom del centre és idèntic al del vèrtex', t: [0.5, 0.5, 0.5], ok: true };
      return { tipus: 'sc', text: n === 1 ? scText : scText + ' diferents (tipus CsCl, o llautó β ordenat)', t: [0.5, 0.5, 0.5], ok: false };
    }
    if (state.est === 'fcc' || state.est === 'dia') {
      if (!ONE(w.cares)) {
        const extra = state.est === 'fcc' && n > 1 ? ' diferents (tipus Cu₃Au ordenat)' : '';
        return { tipus: 'sc', text: scText + extra, t: [0.5, 0.5, 0], ok: false };
      }
      if (state.est === 'fcc' || w.diamant < 1e-4) return { tipus: 'fcc', text: 'FCC: els àtoms de les cares són idèntics al del vèrtex', t: [0.5, 0.5, 0], ok: true };
      return { tipus: 'fcc', t: [0.5, 0.5, 0], ok: true,
        text: ONE(w.diamant) ? 'FCC amb una base de 2 àtoms idèntics (diamant)'
          : 'FCC amb una base de 2 àtoms diferents (blenda de zinc, com el GaAs)' };
    }
    return { tipus: 'sc', text: scText, t: null, ok: true };
  }

  // Cel·les primitives (convenció dels apunts)
  const PRIM = {
    bcc: {
      a: ['\\tfrac a2(-1,1,1)', '\\tfrac a2(1,-1,1)', '\\tfrac a2(1,1,-1)'],
      b: ['\\tfrac{2\\pi}a(0,1,1)', '\\tfrac{2\\pi}a(1,0,1)', '\\tfrac{2\\pi}a(1,1,0)'],
      toCub: (h, k, l) => [k + l, h + l, h + k],
      fromCub: (h, k, l) => [(-h + k + l) / 2, (h - k + l) / 2, (h + k - l) / 2],
      texG: "\\tfrac{2\\pi}{a}\\,(k'+l',\\;h'+l',\\;h'+k')",
      texInv: "h'=\\tfrac{-h+k+l}{2},\\quad k'=\\tfrac{h-k+l}{2},\\quad l'=\\tfrac{h+k-l}{2}",
      cond: 'h+k+l parell', nConv: 2, recip: 'FCC'
    },
    fcc: {
      a: ['\\tfrac a2(0,1,1)', '\\tfrac a2(1,0,1)', '\\tfrac a2(1,1,0)'],
      b: ['\\tfrac{2\\pi}a(-1,1,1)', '\\tfrac{2\\pi}a(1,-1,1)', '\\tfrac{2\\pi}a(1,1,-1)'],
      toCub: (h, k, l) => [-h + k + l, h - k + l, h + k - l],
      fromCub: (h, k, l) => [(k + l) / 2, (h + l) / 2, (h + k) / 2],
      texG: "\\tfrac{2\\pi}{a}\\,(-h'+k'+l',\\;h'-k'+l',\\;h'+k'-l')",
      texInv: "h'=\\tfrac{k+l}{2},\\quad k'=\\tfrac{h+l}{2},\\quad l'=\\tfrac{h+k}{2}",
      cond: 'h, k, l tots parells o tots senars', nConv: 4, recip: 'BCC'
    }
  };
  // la base de la cel·la primitiva: 1 àtom, o 2 al diamant (0 i a/4(1,1,1))
  const primHasCopy = () => state.est === 'dia' && state.w.diamant > 1e-4;
  function Sprim(hp, kp, lp) {
    if (!primHasCopy()) return { re: 1, im: 0 };
    const ph = -Math.PI / 2 * (hp + kp + lp);            // G·c₁ = π(h'+k'+l')/2
    return { re: 1 + state.w.diamant * Math.cos(ph), im: state.w.diamant * Math.sin(ph) };
  }
  // Pics que dona la cel·la primitiva: recorrem els (h',k',l') enters, sense passar per la cel·la cúbica
  // Tots els G = h'b₁+k'b₂+l'b₃ agrupats per |G|², del més curt al més llarg.
  // Dins de cada grup, primer els índexs sense signes negatius i més petits: (1,0,0), (0,1,0)…
  function primitiveVectors(tipus) {
    const P = PRIM[tipus], fam = getFamilies();
    const Nmax = fam.length ? Math.max(...fam.map(f => f.N)) : 0;
    const M = Math.ceil(Math.sqrt(Nmax)) + 1, map = new Map();
    for (let hp = -M; hp <= M; hp++) for (let kp = -M; kp <= M; kp++) for (let lp = -M; lp <= M; lp++) {
      const c = P.toCub(hp, kp, lp), N = c[0] * c[0] + c[1] * c[1] + c[2] * c[2];
      if (N === 0 || N > Nmax) continue;
      if (!map.has(N)) map.set(N, []);
      map.get(N).push([hp, kp, lp]);
    }
    const neg = v => v.filter(x => x < 0).length, abs = v => v.reduce((a, x) => a + Math.abs(x), 0);
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([N, vecs]) => {
      vecs.sort((u, v) => neg(u) - neg(v) || abs(u) - abs(v) || v[0] - u[0] || v[1] - u[1] || v[2] - u[2]);
      return { N, vecs };
    });
  }
  // "b₂ + b₃", "2b₁ − b₃"…
  function bExpand(v) {
    const SUB = ['₁', '₂', '₃'];
    let out = '';
    v.forEach((c, i) => {
      if (!c) return;
      const t = (Math.abs(c) === 1 ? '' : Math.abs(c)) + 'b' + SUB[i];
      out += out ? (c < 0 ? ' − ' : ' + ') + t : (c < 0 ? '−' : '') + t;
    });
    return out || '0';
  }

  function primitivePeaks(tipus) {
    const P = PRIM[tipus], fam = getFamilies();
    const Nmax = fam.length ? Math.max(...fam.map(f => f.N)) : 0;
    const M = Math.ceil(Math.sqrt(Nmax)) + 1, out = new Map();
    for (let hp = -M; hp <= M; hp++) for (let kp = -M; kp <= M; kp++) for (let lp = -M; lp <= M; lp++) {
      const c = P.toCub(hp, kp, lp), N = c[0] * c[0] + c[1] * c[1] + c[2] * c[2];
      if (N === 0 || N > Nmax) continue;
      const S = Sprim(hp, kp, lp), S2 = S.re * S.re + S.im * S.im;
      const prev = out.get(N);
      if (!prev || S2 > prev.S2) out.set(N, { S2, S, hkl: [hp, kp, lp] });
    }
    return out;
  }

  // ---------------------------------------------------------------
  // Utilitats de dibuix
  // ---------------------------------------------------------------
  function arrow(g, x0, y0, x1, y1, col, width) {
    const ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = width || 2;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    if (len > 4) {
      const hl = Math.min(9, len * 0.35);
      g.beginPath(); g.moveTo(x1, y1);
      g.lineTo(x1 - hl * Math.cos(ang - 0.4), y1 - hl * Math.sin(ang - 0.4));
      g.lineTo(x1 - hl * Math.cos(ang + 0.4), y1 - hl * Math.sin(ang + 0.4));
      g.closePath(); g.fill();
    }
  }
  function hueColor(phase, alpha) {
    const h = (phase % TAU + TAU) % TAU / TAU * 360;
    return 'hsla(' + h.toFixed(0) + ',80%,45%,' + alpha + ')';
  }
  const selKey = () => state.sel.join(',');
  const famOfSel = pat => pat.find(p => p.f.hkl.join(',') === selKey());

  // ---------------------------------------------------------------
  // Cel·la 3D
  // ---------------------------------------------------------------
  const cCell = document.getElementById('canvasCell'), gCell = cCell.getContext('2d');

  function displayAtoms(at) {
    const out = [], seen = new Set(), eps = 1e-6;
    for (const a of at) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const p = [a.p[0] + i, a.p[1] + j, a.p[2] + k];
      if (p.some(x => x < -eps || x > 1 + eps)) continue;
      const key = p.map(x => x.toFixed(3)).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ p, w: a.w, g: a.g });
    }
    return out;
  }

  function drawCell() {
    const W = cCell.width, H = cCell.height;
    gCell.clearRect(0, 0, W, H);
    const cy = Math.cos(state.rotY), sy = Math.sin(state.rotY), cx = Math.cos(state.rotX), sx = Math.sin(state.rotX);
    const sc = W * 0.5;
    const proj = p => {
      const x = p[0] - 0.5, y = p[2] - 0.5, z = p[1] - 0.5;   // l'eix z del cristall cap amunt
      const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
      const y2 = cx * y - sx * z1, z2 = sx * y + cx * z1;
      return { x: W / 2 + x1 * sc, y: H / 2 - y2 * sc, z: z2 };
    };
    // arestes del cub
    const V = [];
    for (let i = 0; i < 8; i++) V.push([i & 1, (i >> 1) & 1, (i >> 2) & 1]);
    gCell.strokeStyle = 'rgba(0,114,43,0.45)'; gCell.lineWidth = 1;
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      const dsum = V[i].reduce((s, x, n) => s + Math.abs(x - V[j][n]), 0);
      if (dsum !== 1) continue;
      const a = proj(V[i]), b = proj(V[j]);
      gCell.beginPath(); gCell.moveTo(a.x, a.y); gCell.lineTo(b.x, b.y); gCell.stroke();
    }
    const at = basis(state.est, state.w);
    const disp = displayAtoms(at).map(a => Object.assign(a, { P: proj(a.p) }));

    // enllaços tetraèdrics del diamant
    if (state.est === 'dia' && state.w.diamant > 0) {
      const dB = Math.sqrt(3) / 4;
      gCell.strokeStyle = 'rgba(142,68,173,' + (0.15 + 0.5 * state.w.diamant) + ')'; gCell.lineWidth = 2;
      disp.filter(a => a.g === 'diamant').forEach(a => disp.forEach(b => {
        if (b.g === 'diamant') return;
        const d = Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
        if (Math.abs(d - dB) < 1e-3) { gCell.beginPath(); gCell.moveTo(a.P.x, a.P.y); gCell.lineTo(b.P.x, b.P.y); gCell.stroke(); }
      }));
    }

    disp.sort((a, b) => a.P.z - b.P.z);
    const [h, k, l] = state.sel;
    for (const a of disp) {
      const r = sc * 0.075 * (a.g === 'base' ? 1 : 0.45 + 0.55 * a.w);
      const alpha = a.g === 'base' ? 1 : 0.2 + 0.8 * a.w;
      if (a.w < 1e-3) {
        gCell.strokeStyle = COL[a.g]; gCell.lineWidth = 1; gCell.setLineDash([3, 3]);
        gCell.beginPath(); gCell.arc(a.P.x, a.P.y, sc * 0.05, 0, TAU); gCell.stroke(); gCell.setLineDash([]);
        continue;
      }
      let c0, c1;
      if (state.fase) {
        const ph = -TAU * (h * a.p[0] + k * a.p[1] + l * a.p[2]);
        c0 = hueColor(ph, alpha); c1 = hueColor(ph, alpha * 0.55);
      } else {
        c0 = COL[a.g]; c1 = COL[a.g];
      }
      const grd = gCell.createRadialGradient(a.P.x - r * 0.35, a.P.y - r * 0.35, r * 0.1, a.P.x, a.P.y, r);
      grd.addColorStop(0, 'rgba(255,255,255,' + (0.85 * alpha) + ')');
      grd.addColorStop(0.35, c0);
      grd.addColorStop(1, c1);
      gCell.globalAlpha = state.fase ? 1 : alpha;
      gCell.fillStyle = grd;
      gCell.beginPath(); gCell.arc(a.P.x, a.P.y, r, 0, TAU); gCell.fill();
      gCell.globalAlpha = 1;
    }
    const br = bravais();
    if (br.t) {
      const o = proj([0, 0, 0]), e = proj(br.t), col = br.ok ? '#1a7d2e' : '#b23a3a';
      gCell.setLineDash([6, 4]);
      arrow(gCell, o.x, o.y, e.x, e.y, col, 2.5);
      gCell.setLineDash([]);
      gCell.font = 'bold 12px sans-serif'; gCell.fillStyle = col; gCell.textAlign = 'left';
      const tt = 't = (' + br.t.map(x => x === 0.5 ? '½' : x).join(',') + ')a ' + (br.ok ? '✓' : '✗');
      gCell.fillText(tt, 8, 18);
      gCell.font = '11px sans-serif';
      gCell.fillText(br.ok ? 'porta cada àtom sobre un d\'idèntic: és una translació'
                           : 'porta el vèrtex sobre un àtom diferent: no és una translació', 8, 33);
    }
    gCell.fillStyle = '#555'; gCell.font = '11px sans-serif'; gCell.textAlign = 'left';
    gCell.fillText(br.text + (state.fase ? '   ·   color = fase a (' + state.sel.join(' ') + ')' : ''), 8, H - 8);
  }

  let dragCell = null;
  cCell.addEventListener('mousedown', ev => { dragCell = { x: ev.clientX, y: ev.clientY, ry: state.rotY, rx: state.rotX }; });
  window.addEventListener('mouseup', () => { dragCell = null; });
  window.addEventListener('mousemove', ev => {
    if (!dragCell) return;
    state.rotY = dragCell.ry + (ev.clientX - dragCell.x) * 0.01;
    state.rotX = Math.max(-1.4, Math.min(1.4, dragCell.rx + (ev.clientY - dragCell.y) * 0.01));
    drawCell();
  });

  // ---------------------------------------------------------------
  // Fletxes de S per a la reflexió triada
  // ---------------------------------------------------------------
  const cPh = document.getElementById('canvasPhasor'), gPh = cPh.getContext('2d');
  function drawPhasor() {
    const W = cPh.width, H = cPh.height;
    gPh.clearRect(0, 0, W, H);
    gPh.strokeStyle = '#d5dcd7'; gPh.lineWidth = 1;
    gPh.beginPath(); gPh.moveTo(0, H / 2); gPh.lineTo(W, H / 2); gPh.moveTo(W / 2, 0); gPh.lineTo(W / 2, H); gPh.stroke();
    gPh.fillStyle = '#8a9a90'; gPh.font = '10px sans-serif'; gPh.textAlign = 'left';
    gPh.fillText('Re', W - 18, H / 2 - 4); gPh.fillText('Im', W / 2 + 4, 11);
    const at = basis(state.est, state.w);
    const Wmax = sumW(basis(state.est, FULL));
    const sc = (Math.min(W, H) / 2 - 16) / Wmax;
    gPh.strokeStyle = '#c8d3cc'; gPh.setLineDash([3, 3]);
    gPh.beginPath(); gPh.arc(W / 2, H / 2, Wmax * sc, 0, TAU); gPh.stroke(); gPh.setLineDash([]);
    const [h, k, l] = state.sel;
    let re = 0, im = 0;
    at.forEach((a, j) => {
      if (a.w < 1e-4) return;
      const ph = -TAU * (h * a.p[0] + k * a.p[1] + l * a.p[2]);
      const nr = re + a.w * Math.cos(ph), ni = im + a.w * Math.sin(ph);
      arrow(gPh, W / 2 + re * sc, H / 2 - im * sc, W / 2 + nr * sc, H / 2 - ni * sc, COL[a.g], j === 0 ? 6 : 3);
      re = nr; im = ni;
    });
    if (Math.hypot(re, im) > 1e-6) arrow(gPh, W / 2, H / 2, W / 2 + re * sc, H / 2 - im * sc, '#111', 1.5);
    else { gPh.fillStyle = '#111'; gPh.beginPath(); gPh.arc(W / 2, H / 2, 3, 0, TAU); gPh.fill(); }
    gPh.fillStyle = '#333'; gPh.font = '11px sans-serif';
    gPh.fillText('(' + state.sel.join(' ') + ')   |S| = ' + Math.hypot(re, im).toFixed(2) + '   (Σf = ' + fmt(sumW(at)) + ')', 6, H - 7);
  }

  // ---------------------------------------------------------------
  // Patró de pols i comparació
  // ---------------------------------------------------------------
  const cPat = document.getElementById('canvasPattern'), gPat = cPat.getContext('2d');
  const cCmp = document.getElementById('canvasCompare'), gCmp = cCmp.getContext('2d');
  const PM = { l: 46, r: 14, t: 44, b: 34 };
  const xOf = (tth, W) => PM.l + (tth - TTH_MIN) / (state.tthMax - TTH_MIN) * (W - PM.l - PM.r);
  const tthOf = (x, W) => TTH_MIN + (x - PM.l) / (W - PM.l - PM.r) * (state.tthMax - TTH_MIN);
  const SIG = 0.22;   // amplada dels pics (graus de 2θ)

  function xAxis(g, W, y) {
    g.strokeStyle = '#999'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(PM.l, y); g.lineTo(W - PM.r, y); g.stroke();
    g.fillStyle = '#555'; g.font = '10px sans-serif'; g.textAlign = 'center';
    for (let t = 20; t <= state.tthMax; t += 20) {
      const x = xOf(t, W);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 4); g.stroke();
      g.fillText(t + '°', x, y + 14);
    }
  }

  // col·loca etiquetes sense que se superposin (fins a 3 files)
  function placeLabels(g, items, yTop) {
    const rows = [-Infinity, -Infinity, -Infinity];
    g.font = '10px sans-serif'; g.textAlign = 'center';
    for (const it of items) {
      const w = g.measureText(it.text).width + 4;
      let r = rows.findIndex(end => end < it.x - w / 2);
      if (r < 0) r = rows.indexOf(Math.min(...rows));
      rows[r] = it.x + w / 2;
      it.y = yTop + 11 * r;
    }
  }

  function drawPattern() {
    const W = cPat.width, H = cPat.height;
    gPat.clearRect(0, 0, W, H);
    const pat = pattern(state.est, state.w), sc = pattern('sc', FULL);
    const G = peaksByN(pat), Gsc = peaksByN(sc);
    const y0 = H - PM.b, yT = PM.t;
    const Y = v => y0 - v * (y0 - yT) * 0.92;
    const sel = famOfSel(pat);

    // fantasma SC
    gPat.strokeStyle = COL_GHOST; gPat.lineWidth = 1; gPat.setLineDash([4, 3]);
    Gsc.forEach(g => { const x = xOf(g.tth, W); gPat.beginPath(); gPat.moveTo(x, y0); gPat.lineTo(x, Y(ghostOf(g))); gPat.stroke(); });
    gPat.setLineDash([]);

    // pic seleccionat
    if (sel) {
      const x = xOf(sel.tth, W);
      gPat.fillStyle = 'rgba(255,59,48,0.10)';
      gPat.fillRect(x - 6, yT - 4, 12, y0 - yT + 4);
    }

    // corba (suma de gaussianes)
    gPat.strokeStyle = COL_MAIN; gPat.lineWidth = 1.8;
    gPat.beginPath();
    for (let px = PM.l; px <= W - PM.r; px += 0.5) {
      const t = tthOf(px, W);
      let v = 0;
      for (const g of G) { const d = (t - g.tth) / SIG; if (Math.abs(d) < 6) v += heightOf(g) * Math.exp(-0.5 * d * d); }
      if (px === PM.l) gPat.moveTo(px, Y(v)); else gPat.lineTo(px, Y(v));
    }
    gPat.stroke();

    // etiquetes
    const items = G.map(g => ({ g, x: xOf(g.tth, W), text: g.label, off: isOff(heightOf(g)) }));
    placeLabels(gPat, items, 12);
    items.forEach(it => {
      const hgt = heightOf(it.g);
      gPat.fillStyle = it.off ? COL_OFF : '#333';
      gPat.globalAlpha = it.off ? 0.75 : 0.35 + 0.65 * Math.min(1, hgt / Math.max(1e-9, ghostOf(it.g)));
      gPat.fillText(it.text, it.x, it.y);
      if (it.off) {
        const w = gPat.measureText(it.text).width;
        gPat.strokeStyle = COL_OFF; gPat.lineWidth = 1;
        gPat.beginPath(); gPat.moveTo(it.x - w / 2, it.y - 3); gPat.lineTo(it.x + w / 2, it.y - 3); gPat.stroke();
        gPat.font = 'bold 11px sans-serif'; gPat.fillText('×', it.x, y0 - 3); gPat.font = '10px sans-serif';
      }
      gPat.globalAlpha = 1;
    });

    const br = bravais();
    if (br.tipus !== 'sc') {
      const pp = primitivePeaks(br.tipus);
      gPat.fillStyle = COL_PRIM;
      G.forEach(g => {
        const q = pp.get(g.N);
        if (!q || q.S2 < 1e-12) return;
        const x = xOf(g.tth, W);
        gPat.beginPath(); gPat.moveTo(x - 5, yT - 1); gPat.lineTo(x + 5, yT - 1); gPat.lineTo(x, yT + 7); gPat.closePath(); gPat.fill();
      });
    }
    document.getElementById('llegPrim').style.display = br.tipus !== 'sc' ? '' : 'none';

    xAxis(gPat, W, y0);
    gPat.fillStyle = '#555'; gPat.textAlign = 'center'; gPat.font = '10px sans-serif';
    gPat.fillText('2θ   (λ = ' + state.lambda + ' Å, a = ' + state.a + ' Å)', (PM.l + W - PM.r) / 2, H - 4);
    gPat.save(); gPat.translate(12, (yT + y0) / 2); gPat.rotate(-Math.PI / 2);
    gPat.fillText(state.alcada === 'S' ? '|S|² / (Σf)²' : 'multiplicitat × |S|² / (Σf)²', 0, 0); gPat.restore();

  }

  const CMP_ROW = 62;
  function drawCompare() {
    const W = cCmp.width, H = cCmp.height;
    gCmp.clearRect(0, 0, W, H);
    const sc = peaksByN(pattern('sc', FULL));
    const top = 34;
    // línies verticals a cada pic SC i etiquetes a dalt
    const items = sc.map(g => ({ g, x: xOf(g.tth, W), text: g.label }));
    placeLabels(gCmp, items, 10);
    items.forEach(it => {
      gCmp.strokeStyle = '#e3e9e5'; gCmp.lineWidth = 1;
      gCmp.beginPath(); gCmp.moveTo(it.x, top - 4); gCmp.lineTo(it.x, top + CMP_ROW * 4); gCmp.stroke();
    });
    const selNs = new Set(pattern('sc', FULL).filter(p => p.f.hkl.join(',') === selKey()).map(p => p.f.N));
    ORDRE.forEach((est, r) => {
      const yb = top + CMP_ROW * (r + 1) - 8, yh = CMP_ROW - 18;
      if (est === state.est) { gCmp.fillStyle = 'rgba(0,150,57,0.07)'; gCmp.fillRect(PM.l - 40, yb - yh - 6, W - PM.l - PM.r + 40, CMP_ROW - 2); }
      gCmp.fillStyle = est === state.est ? COL_MAIN : '#555';
      gCmp.font = (est === state.est ? 'bold ' : '') + '11px sans-serif'; gCmp.textAlign = 'right';
      gCmp.fillText(STRUCT[est].curt, PM.l - 4, yb - 4);
      gCmp.strokeStyle = '#bbb'; gCmp.lineWidth = 1;
      gCmp.beginPath(); gCmp.moveTo(PM.l, yb); gCmp.lineTo(W - PM.r, yb); gCmp.stroke();
      peaksByN(pattern(est, FULL)).forEach(g => {
        const x = xOf(g.tth, W), hgt = heightOf(g);
        if (isOff(heightOf(g))) {
          gCmp.fillStyle = COL_OFF; gCmp.font = 'bold 11px sans-serif'; gCmp.textAlign = 'center';
          gCmp.fillText('×', x, yb - 2);
        } else {
          gCmp.strokeStyle = selNs.has(g.N) ? '#ff3b30' : COL_MAIN; gCmp.lineWidth = selNs.has(g.N) ? 3 : 2.5;
          gCmp.beginPath(); gCmp.moveTo(x, yb); gCmp.lineTo(x, yb - Math.max(2, hgt * yh)); gCmp.stroke();
        }
      });
    });
    xAxis(gCmp, W, top + CMP_ROW * 4 + 2);
  }

  function pickPeak(canvas, ev, extraRow) {
    const rect = canvas.getBoundingClientRect();
    const px = (ev.clientX - rect.left) * canvas.width / rect.width;
    const py = (ev.clientY - rect.top) * canvas.height / rect.height;
    if (extraRow && px < PM.l) {
      const r = Math.floor((py - 34) / CMP_ROW);
      if (r >= 0 && r < 4) { setStructure(ORDRE[r]); return; }
    }
    const G = peaksByN(pattern('sc', FULL));
    let best = null, bd = 12;
    G.forEach(g => { const d = Math.abs(xOf(g.tth, canvas.width) - px); if (d < bd) { bd = d; best = g; } });
    if (best) { state.sel = best.list[0].f.hkl.slice(); render(); }
  }
  cPat.addEventListener('click', ev => pickPeak(cPat, ev, false));
  cCmp.addEventListener('click', ev => pickPeak(cCmp, ev, true));

  // ---------------------------------------------------------------
  // Taula de reflexions
  // ---------------------------------------------------------------
  const tbody = document.getElementById('taulaBody');
  function fmt(x, n) {
    const r = Math.round(x);
    if (Math.abs(x - r) < 1e-9) return String(r);
    return String(+x.toFixed(n === undefined ? 2 : n));
  }
  function fmtC(re, im) {
    if (Math.abs(re) < 1e-9) re = 0;
    if (Math.abs(im) < 1e-9) im = 0;
    if (im === 0) return fmt(re);
    const is = Math.abs(im) === 1 ? 'i' : fmt(Math.abs(im)) + 'i';
    if (re === 0) return (im < 0 ? '−' : '') + is;
    return fmt(re) + (im < 0 ? ' − ' : ' + ') + is;
  }

  function drawTable() {
    const pat = pattern(state.est, state.w);
    const at = basis(state.est, state.w);
    const first = pat.find(p => !isOff(p.iS));
    tbody.innerHTML = pat.map(p => {
      const [h, k, l] = p.f.hkl;
      const S = Shkl(h, k, l, at);
      const off = isOff(p.iS), weak = !off && p.iS < 0.999;
      const cls = (off ? 'prohibida' : weak ? 'debil' : '') + (p.f.hkl.join(',') === selKey() ? ' sel' : '');
      const estat = off ? 'prohibida' : weak ? 'més feble' : 'permesa';
      const ratio = off || !first ? '' : fmt(p.f.N / first.f.N, 4);
      return '<tr class="' + cls + '" data-hkl="' + p.f.hkl.join(',') + '">' +
        '<td>(' + h + ' ' + k + ' ' + l + ')</td><td>' + p.f.N + '</td><td>' + p.d.toFixed(4) + '</td>' +
        '<td>' + p.s.toFixed(4) + '</td><td>' + p.tth.toFixed(2) + '</td><td>' + p.m + '</td>' +
        '<td>' + fmtC(S.re, S.im) + '</td><td>' + (p.iS).toFixed(3) + '</td><td>' + ratio + '</td><td>' + estat + '</td></tr>';
    }).join('');
    scrollToSel(tbody.closest('.taula-wrap'), 'conv');
  }
  tbody.addEventListener('click', ev => {
    const tr = ev.target.closest('tr');
    if (!tr) return;
    state.sel = tr.dataset.hkl.split(',').map(Number);
    render();
  });

  // ---------------------------------------------------------------
  // Expressions analítiques per a la reflexió triada
  // ---------------------------------------------------------------
  const formules = document.getElementById('formules');
  function tex(s) {
    if (window.katex) return window.katex.renderToString(s, { displayMode: true, throwOnError: false });
    return '<code>' + s.replace(/</g, '&lt;') + '</code>';
  }
  const pm1 = n => ((n % 2) + 2) % 2 === 0 ? '(+1)' : '(-1)';
  const val = n => ((n % 2) + 2) % 2 === 0 ? 1 : -1;
  function negI(n) {                 // e^{−iπn/2} = (−i)^n
    const m = ((n % 4) + 4) % 4;
    return [{ re: 1, im: 0 }, { re: 0, im: -1 }, { re: -1, im: 0 }, { re: 0, im: 1 }][m];
  }
  const texC = (re, im) => fmtC(re, im).replace(/−/g, '-');

  function drawFormulas() {
    const [h, k, l] = state.sel, N = h * h + k * k + l * l;
    const d = state.a / Math.sqrt(N), s = state.lambda / (2 * d);
    const tth = s <= 1 ? 2 * Math.asin(s) * 180 / Math.PI : NaN;
    const at = basis(state.est, state.w), S = Shkl(h, k, l, at);
    const rows = [];
    rows.push({
      nom: 'Posició del pic',
      tex: ['\\vec G_{hkl}=\\frac{2\\pi}{a}(h,k,l),\\qquad d_{hkl}=\\frac{a}{\\sqrt{h^2+k^2+l^2}}=\\frac{' + state.a + '}{\\sqrt{' + N + '}}=' + d.toFixed(4) + '\\ \\text{Å}',
            '\\sin\\theta=\\frac{\\lambda}{2d}=' + s.toFixed(4) + (isNaN(tth) ? '' : '\\quad\\Rightarrow\\quad 2\\theta=' + tth.toFixed(2) + '^\\circ')],
      nota: 'La posició només depèn de la cel·la cúbica: és la mateixa per a les quatre estructures. El que canvia és si el pic hi és o no.'
    });
    let gen, num;
    const w = state.w;
    if (state.est === 'sc') {
      gen = 'S_{hkl}=f\\,e^{0}=1';
      num = 'S_{' + h + k + l + '}=1';
    } else if (state.est === 'bcc') {
      gen = 'S_{hkl}=1+w\\,e^{-i\\pi(h+k+l)}=1+w\\,(-1)^{h+k+l}';
      num = 'S_{' + h + k + l + '}=1+' + fmt(w.centre) + '\\cdot' + pm1(h + k + l) + '=' + texC(S.re, S.im);
    } else {
      const fccA = 1 + w.cares * (val(k + l) + val(h + l) + val(h + k));
      const genF = '1+w_c\\left[(-1)^{k+l}+(-1)^{h+l}+(-1)^{h+k}\\right]';
      const numF = '1+' + fmt(w.cares) + '\\left[' + pm1(k + l) + '+' + pm1(h + l) + '+' + pm1(h + k) + '\\right]';
      if (state.est === 'fcc') {
        gen = 'S_{hkl}=' + genF.replace(/w_c/g, 'w');
        num = 'S_{' + h + k + l + '}=' + numF + '=' + texC(S.re, S.im);
      } else {
        const B = negI(h + k + l);
        const Bw = { re: 1 + w.diamant * B.re, im: w.diamant * B.im };
        gen = 'S_{hkl}=\\Big(' + genF + '\\Big)\\Big(1+w_d\\,e^{-i\\pi(h+k+l)/2}\\Big)';
        num = 'S_{' + h + k + l + '}=\\Big(' + numF + '\\Big)\\Big(1+' + fmt(w.diamant) + '\\cdot(' + texC(B.re, B.im) + ')\\Big)=' +
              fmt(fccA) + '\\cdot(' + texC(Bw.re, Bw.im) + ')=' + texC(S.re, S.im);
      }
    }
    const pos = at.filter(a => a.g !== 'base').length
      ? 'Àtoms de la base: el vèrtex c₀ = (0,0,0) amb f = 1 i ' +
        STRUCT[state.est].grups.map(g => GRUP_POS[g] + ' amb f = ' + simbHTML(g) + ' = ' + fmt(state.w[g])).join(', ') + '.' +
        (state.est === 'dia' ? ' Cada àtom de la còpia pesa w<sub>d</sub> vegades el de l\'àtom FCC que copia; per això S es factoritza.' : '')
      : 'Un sol àtom a la cel·la, al vèrtex: S = 1 per a tots els (hkl).';
    rows.push({
      nom: 'Factor d\'estructura',
      tex: ['S_{hkl}=\\sum_j f_j\\,e^{-i\\vec G\\cdot\\vec c_j}=\\sum_j f_j\\,e^{-2\\pi i(hx_j+ky_j+lz_j)}', gen, num],
      nota: pos + ' Les presentacions escriuen e<sup>+iG·c</sup>: només canvia el signe de la fase, |S| és el mateix.'
    });
    const I = (S.re * S.re + S.im * S.im) / Math.pow(sumW(at), 2);
    rows.push({
      nom: 'Intensitat',
      tex: ['\\frac{|S_{' + h + k + l + '}|^2}{(\\sum_j f_j)^2}=' + I.toFixed(3)],
      nota: REGLA[state.est]
    });
    formules.innerHTML = rows.map(r => '<div class="formula"><div class="formula-nom">' + r.nom + '</div>' +
      r.tex.map(tex).join('') + '<div class="formula-nota">' + r.nota + '</div></div>').join('');
  }

  const primBox = document.getElementById('primitiva');
  const badge = document.getElementById('bravais');
  function drawPrimitive() {
    const br = bravais();
    badge.className = 'bravais ' + br.tipus;
    badge.innerHTML = '<span class="bravais-et">Xarxa de Bravais</span>' + br.text;
    if (br.tipus === 'sc') {
      primBox.innerHTML = '<p class="hint">' + (state.est === 'sc'
        ? 'La cel·la cúbica simple ja és primitiva: el càlcul de dalt és l\'únic que hi ha.'
        : 'Els àtoms afegits no són idèntics als del vèrtex, de manera que la xarxa de Bravais és cúbica simple i la cel·la cúbica ja és la primitiva. ' +
          'Posa ' + (state.est === 'bcc' ? 'f<sub>centre</sub>/f<sub>vèrtex</sub>' : 'f<sub>cara</sub>/f<sub>vèrtex</sub>') +
          ' = 1 i aquí apareixerà el mateix càlcul fet amb la cel·la primitiva de la ' + (state.est === 'bcc' ? 'BCC' : 'FCC') + '.') + '</p>';
      return;
    }
    const P = PRIM[br.tipus], copy = primHasCopy(), wd = state.w.diamant;
    const nomX = br.tipus === 'bcc' ? 'BCC' : 'FCC';
    const rows = [];
    rows.push({
      nom: 'Cel·la primitiva de la ' + nomX,
      tex: ['\\vec a_1=' + P.a[0] + ',\\quad \\vec a_2=' + P.a[1] + ',\\quad \\vec a_3=' + P.a[2],
            '\\vec b_1=' + P.b[0] + ',\\quad \\vec b_2=' + P.b[1] + ',\\quad \\vec b_3=' + P.b[2],
            "\\vec G=h'\\vec b_1+k'\\vec b_2+l'\\vec b_3=" + P.texG + ",\\qquad h',k',l'\\in\\mathbb Z"],
      nota: 'La xarxa recíproca de la ' + nomX + ' és ' + P.recip + '. Cada (h\',k\',l\') enter dona un G, sense excepcions: ' +
        (copy ? 'la base primitiva té 2 àtoms, a 0 i a a/4(1,1,1), i encara cal un factor d\'estructura.' : 'amb un sol àtom per cel·la primitiva, S = 1 per a tots ells i no s\'anul·la res.')
    });
    const S = copy ? "S'=1+w_d\\,e^{-i\\vec G\\cdot\\frac a4(1,1,1)}=1+w_d\\,e^{-i\\pi(h'+k'+l')/2}" : "S'=1";
    rows.push({
      nom: 'Factor d\'estructura de la cel·la primitiva',
      tex: [S, "S_{hkl}^{\\,\\text{conv}}=" + P.nConv + "\\,S'"],
      nota: 'La cel·la convencional conté ' + P.nConv + ' nusos de la xarxa ' + nomX + ', i per això el seu S és ' + P.nConv + ' vegades el de la primitiva ' +
        '(vegeu la idea clau dels apunts "Convencional amb factor d\'estructura, o primitiva sense").'
    });
    // la reflexió triada, vista des de la cel·la primitiva
    const [h, k, l] = state.sel, q = P.fromCub(h, k, l), isInt = q.every(Number.isInteger);
    const qt = q.map(x => fmt(x)).join(',');
    let sub, nota;
    if (isInt) {
      const Sp = Sprim(q[0], q[1], q[2]), Sc = Shkl(h, k, l, basis(state.est, state.w));
      sub = "(h',k',l')=(" + qt + ")\\quad\\Rightarrow\\quad S'=" + texC(Sp.re, Sp.im) +
            ",\\qquad S_{" + h + k + l + "}^{\\,\\text{conv}}=" + P.nConv + '\\cdot(' + texC(Sp.re, Sp.im) + ')=' + texC(Sc.re, Sc.im);
      nota = 'El G de (' + h + ' ' + k + ' ' + l + ') és un vector de la xarxa recíproca primitiva. ' +
        (Sp.re * Sp.re + Sp.im * Sp.im < 1e-12 ? 'Pic absent, però aquí pel factor d\'estructura de la base de 2 àtoms del diamant.' : 'Hi ha pic, com amb la cel·la convencional.');
    } else {
      sub = "(h',k',l')=(" + qt + ')\\quad\\text{no són enters}';
      nota = 'Condició: ' + P.cond + '. El G de (' + h + ' ' + k + ' ' + l + ') no pertany a la xarxa recíproca de la ' + nomX +
        ': no hi ha pic, i no cal cap factor d\'estructura per treure\'l. Amb la cel·la convencional, en canvi, el mateix pic desapareix perquè S = 0.';
    }
    rows.push({ nom: 'La reflexió triada des de la cel·la primitiva', tex: [P.texInv, sub], nota });

    // vectors primitius, del més curt al més llarg, enllaçats amb la taula de reflexions
    const selN = state.sel.reduce((a, x) => a + x * x, 0);
    const nb = x => String(x).replace(/-/g, '−');
    const trip = v => '(' + v.map(nb).join(' ') + ')';
    const groups = primitiveVectors(br.tipus);
    let selIdx = -1;
    const vt = groups.map((g, i) => {
      const v0 = g.vecs[0], c0 = P.toCub(v0[0], v0[1], v0[2]);
      // famílies cúbiques d'aquest mòdul (normalment una; p. ex. {411}/{330} en comparteixen)
      const fams = [...new Set(g.vecs.map(v => P.toCub(v[0], v[1], v[2]).map(Math.abs).sort((x, y) => y - x).join(',')))]
        .map(f => f.split(',').map(Number)).sort((u, w) => w[0] - u[0] || w[1] - u[1]);
      const d = state.a / Math.sqrt(g.N), sn = state.lambda / (2 * d);
      const tth = sn <= 1 ? (2 * Math.asin(sn) * 180 / Math.PI).toFixed(2) : '—';
      const Sp = Sprim(v0[0], v0[1], v0[2]), off = Sp.re * Sp.re + Sp.im * Sp.im < 1e-12;
      const sel = g.N === selN;
      if (sel) selIdx = i;
      const eq = g.vecs.length > 1
        ? '<details' + (openEq.has(g.N) ? ' open' : '') + '><summary data-n="' + g.N + '">+' + (g.vecs.length - 1) + ' equivalents</summary>' +
          '<div class="equiv">' + g.vecs.slice(1).map(trip).join(' ') + '</div></details>' : '';
      return '<tr class="' + (off ? 'prohibida' : '') + (sel ? ' sel' : '') + '" data-sel="' + fams[0].join(',') + '">' +
        '<td>' + (i + 1) + '</td><td class="ex"><b>' + trip(v0) + '</b>' + eq + '</td>' +
        '<td>G = ' + bExpand(v0) + ' = (2π/a)(' + c0.map(nb).join(',') + ')</td>' +
        '<td>' + fams.map(f => '{' + f.join('') + '}').join('/') + '</td>' +
        '<td>√' + g.N + '</td><td>' + d.toFixed(4) + '</td><td>' + tth + '</td>' +
        (copy ? '<td>' + fmtC(Sp.re, Sp.im) + '</td>' : '') + '</tr>';
    }).join('');

    // la llista primitiva dona exactament els pics permesos de la cel·la convencional?
    const convN = new Set(pattern(state.est, state.w).filter(q => !isOff(q.iS)).map(q => q.f.N));
    const primN = new Set(groups.filter(g => { const S0 = Sprim(g.vecs[0][0], g.vecs[0][1], g.vecs[0][2]); return S0.re * S0.re + S0.im * S0.im > 1e-12; }).map(g => g.N));
    const iguals = convN.size === primN.size && [...convN].every(n => primN.has(n));
    const hs = '(' + state.sel.join(' ') + ')';
    const msgSel = selIdx >= 0
      ? '▶ El pic triat, ' + hs + ', és la fila ' + (selIdx + 1) + ' d\'aquesta llista' +
        (primN.has(selN) ? '.' : ', però S′ = 0: la base de 2 àtoms del diamant l\'anul·la.')
      : '▶ El pic triat, ' + hs + ', no hi és: el seu G no pertany a la xarxa recíproca de la ' + nomX + '. Amb la cel·la cúbica desapareix perquè S = 0.';

    const vtBox = '<div class="formula"><div class="formula-nom">Vectors de la xarxa recíproca primitiva, del més curt al més llarg</div>' +
      '<div class="formula-nota" style="margin-bottom:4px;">Aquí partim dels índexs primitius (h′,k′,l′), no dels cúbics. A cada fila hi ha el vector més senzill; ' +
      'al desplegable, els altres del mateix mòdul. La columna {hkl} diu a quin pic de la cel·la cúbica correspon. Clica una fila per triar-ne el pic.</div>' +
      '<div class="taula-wrap" style="max-height:260px"><table class="taula taula-prim taula-vec"><thead><tr><th>#</th><th>(h′ k′ l′)</th>' +
      '<th>G = h′b₁ + k′b₂ + l′b₃</th><th>{hkl} cúbic</th><th>|G| / (2π/a)</th><th>d (Å)</th><th>2θ (°)</th>' + (copy ? '<th>S′</th>' : '') +
      '</tr></thead><tbody>' + vt + '</tbody></table></div>' +
      '<div class="estat ' + (selIdx >= 0 && primN.has(selN) ? 'si' : 'no') + '">' + msgSel + '</div>' +
      '<div class="formula-nota">' + (iguals ? '✓ Aquesta llista dona exactament els pics permesos de la taula de reflexions' : '✗ Aquesta llista no coincideix amb la taula de reflexions') +
      (copy ? ' (les files ratllades tenen S′ = 0 per la base de 2 àtoms del diamant)' : '') + '. Són els ▼ blaus del patró de pols.</div></div>';

    // reconstruïm el bloc sense perdre la posició de l'scroll de la taula
    const oldWrap = primBox.querySelector('.taula-wrap');
    const oldScroll = oldWrap ? oldWrap.scrollTop : 0;
    primBox.innerHTML = rows.map(r => '<div class="formula"><div class="formula-nom">' + r.nom + '</div>' +
      r.tex.map(tex).join('') + '<div class="formula-nota">' + r.nota + '</div></div>').join('') + vtBox;
    const wrap = primBox.querySelector('.taula-wrap');
    wrap.scrollTop = oldScroll;
    scrollToSel(wrap, 'prim');
  }

  // desplegables d'equivalents i selecció des de la taula primitiva
  const openEq = new Set();
  primBox.addEventListener('click', ev => {
    const sm = ev.target.closest('summary');
    if (sm) {
      ev.preventDefault();
      const n = +sm.dataset.n;
      if (openEq.has(n)) openEq.delete(n); else openEq.add(n);
      render();
      return;
    }
    if (ev.target.closest('.equiv')) return;
    const tr = ev.target.closest('tr[data-sel]');
    if (tr) { state.sel = tr.dataset.sel.split(',').map(Number); render(); }
  });

  // porta la fila triada a la vista, però només quan canvia la selecció (no en moure un control)
  const lastScrolled = {};
  function scrollToSel(wrap, id) {
    const key = selKey() + '|' + state.est;
    if (lastScrolled[id] === key) return;
    lastScrolled[id] = key;
    const tr = wrap.querySelector('tr.sel');
    if (!tr) return;
    const top = tr.offsetTop, h = wrap.clientHeight;
    if (top < wrap.scrollTop + 30 || top > wrap.scrollTop + h - 30) wrap.scrollTop = Math.max(0, top - h / 2);
  }

  const REGLA = {
    sc: 'SC: tots els (hkl) són permesos. Fixa\'t que h²+k²+l² mai val 7, 15, 23, 28… (no són suma de tres quadrats).',
    bcc: 'BCC (w = 1): S = 2 si h+k+l és parell i S = 0 si és senar.',
    fcc: 'FCC (w = 1): S = 4 si h, k, l són tots parells o tots senars, i S = 0 si la paritat és mixta.',
    dia: 'Diamant (w<sub>c</sub> = w<sub>d</sub> = 1): a més de la regla FCC, S = 0 quan h, k, l són tots parells amb h+k+l = 4n+2, com (200) i (222). Els tots senars queden amb |S|² a la meitat.'
  };

  // ---------------------------------------------------------------
  // Lectura de la reflexió triada
  // ---------------------------------------------------------------
  const lectura = document.getElementById('lectura'), estatSel = document.getElementById('estatSel');
  function drawReadout() {
    const pat = pattern(state.est, state.w), p = famOfSel(pat);
    const [h, k, l] = state.sel;
    if (!p) { lectura.innerHTML = ''; estatSel.textContent = 'Aquesta reflexió queda fora del rang de 2θ.'; estatSel.className = 'estat no'; return; }
    const S = Shkl(h, k, l, basis(state.est, state.w));
    const rows = [['(h k l)', '(' + h + ' ' + k + ' ' + l + ')'], ['h² + k² + l²', p.f.N], ['d (Å)', p.d.toFixed(4)],
      ['2θ', p.tth.toFixed(2) + '°'], ['multiplicitat', p.m], ['S', fmtC(S.re, S.im)], ['|S|² / (Σf)²', p.iS.toFixed(3)]];
    lectura.innerHTML = rows.map(r => '<div class="fila"><span class="etiqueta">' + r[0] + '</span><span class="valor">' + r[1] + '</span></div>').join('');
    const off = isOff(p.iS);
    estatSel.className = 'estat ' + (off ? 'no' : 'si');
    estatSel.textContent = off ? 'Prohibida: les fletxes de S sumen zero i el pic desapareix.'
      : p.iS < 0.999 ? 'Permesa, però més feble que a la SC: les fletxes no estan totes alineades.'
      : 'Permesa: totes les fletxes de S apunten en la mateixa direcció.';
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const blocPesos = $('blocPesos');

  function buildWeightSliders() {
    const grups = STRUCT[state.est].grups;
    blocPesos.innerHTML = grups.length ? grups.map(g =>
      '<div class="control-group"><label class="control-label" for="w_' + g + '"><span><span class="punt" style="background:' + COL[g] + '"></span>' +
      GRUP_NOM[g] + '</span><span class="val" id="v_' + g + '">' + state.w[g].toFixed(2) + '</span></label>' +
      '<input type="range" class="slider" id="w_' + g + '" min="0" max="1" step="0.01" value="' + state.w[g] + '"></div>').join('')
      : '<p class="hint">La cúbica simple és el punt de partida: un sol àtom per cel·la i tots els pics.</p>';
    grups.forEach(g => $('w_' + g).addEventListener('input', ev => {
      state.w[g] = +ev.target.value; $('v_' + g).textContent = state.w[g].toFixed(2); render();
    }));
    $('btnPlay').disabled = !grups.length;
  }
  function syncWeights() {
    STRUCT[state.est].grups.forEach(g => { $('w_' + g).value = state.w[g]; $('v_' + g).textContent = state.w[g].toFixed(2); });
  }

  function setStructure(est) {
    stopAnim();
    state.est = est;
    document.querySelectorAll('.btn-est').forEach(b => b.classList.toggle('actiu', b.dataset.est === est));
    buildWeightSliders();
    render();
  }
  document.querySelectorAll('.btn-est').forEach(b => b.addEventListener('click', () => setStructure(b.dataset.est)));

  // animació: els àtoms afegits "apareixen" un grup darrere l'altre
  let anim = null;
  function stopAnim() { if (anim) { cancelAnimationFrame(anim.id); anim = null; $('btnPlay').textContent = '▶ Reprodueix el camí des de la SC'; } }
  $('btnPlay').addEventListener('click', () => {
    if (anim) { stopAnim(); return; }
    const grups = STRUCT[state.est].grups;
    grups.forEach(g => { state.w[g] = 0; });
    const T = 2600, t0 = performance.now();
    $('btnPlay').textContent = '■ Atura';
    const step = now => {
      const t = (now - t0) / T;
      grups.forEach((g, i) => { state.w[g] = Math.max(0, Math.min(1, t - i)); });
      syncWeights(); render();
      if (t < grups.length) anim.id = requestAnimationFrame(step); else stopAnim();
    };
    anim = { id: requestAnimationFrame(step) };
  });

  $('inA').addEventListener('change', () => { const x = +$('inA').value; if (x > 0.5 && x < 20) state.a = x; $('inA').value = state.a; render(); });
  $('inLambda').addEventListener('change', () => { const x = +$('inLambda').value; if (x > 0.1 && x < 5) state.lambda = x; $('inLambda').value = state.lambda; render(); });
  $('selAlcada').addEventListener('change', () => { state.alcada = $('selAlcada').value; render(); });
  $('chkFase').addEventListener('change', () => { state.fase = $('chkFase').checked; render(); });

  function render() {
    drawCell(); drawPhasor(); drawPattern(); drawCompare(); drawTable(); drawFormulas(); drawPrimitive(); drawReadout();
  }

  // ---------------------------------------------------------------
  // Configuració des de l'URL i còpia de l'enllaç
  //   ?est=fcc&wc=0.5&sel=1,0,0&a=3.36&alcada=S&fase=1   (w per a BCC, wc i wd per a FCC/diamant)
  // ---------------------------------------------------------------
  function fromURL() {
    const p = new URLSearchParams(location.search);
    if (STRUCT[p.get('est')]) state.est = p.get('est');
    const num = (k, f) => { if (p.has(k) && isFinite(+p.get(k))) f(+p.get(k)); };
    const cl = x => Math.max(0, Math.min(1, x));
    num('w', x => { state.w.centre = cl(x); });
    num('wc', x => { state.w.cares = cl(x); });
    num('wd', x => { state.w.diamant = cl(x); });
    num('a', x => { if (x > 0.5 && x < 20) state.a = x; });
    num('lambda', x => { if (x > 0.1 && x < 5) state.lambda = x; });
    if (p.get('alcada') === 'mS') state.alcada = 'mS';
    if (p.has('fase')) state.fase = p.get('fase') !== '0';
    if (p.has('sel')) {
      const s = p.get('sel').split(',').map(Number);
      if (s.length === 3 && s.every(Number.isInteger) && s.some(x => x)) state.sel = s;
    }
    $('inA').value = state.a; $('inLambda').value = state.lambda;
    $('selAlcada').value = state.alcada; $('chkFase').checked = state.fase;
    setStructure(state.est);
  }
  $('btnEnllac').addEventListener('click', () => {
    const p = new URLSearchParams();
    p.set('est', state.est);
    if (state.est === 'bcc') p.set('w', state.w.centre);
    if (state.est === 'fcc' || state.est === 'dia') p.set('wc', state.w.cares);
    if (state.est === 'dia') p.set('wd', state.w.diamant);
    p.set('sel', state.sel.join(','));
    p.set('a', state.a);
    if (state.lambda !== 1.5406) p.set('lambda', state.lambda);
    if (state.alcada !== 'S') p.set('alcada', state.alcada);
    if (state.fase) p.set('fase', 1);
    const url = location.origin + location.pathname + '?' + p.toString().replace(/%2C/g, ',');
    const msg = $('msgEnllac');
    const ok = () => { msg.textContent = 'Enllaç copiat.'; setTimeout(() => { msg.textContent = ''; }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, () => prompt('Enllaç:', url));
    else prompt('Enllaç:', url);
  });

  fromURL();
})();
