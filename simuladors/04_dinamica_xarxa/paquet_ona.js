// paquet_ona.js — paquet d'ona en una cadena: velocitat de fase ω/k i velocitat de grup Δω/Δk ≈ dω/dk.
// Unitats: a = 1, ω_m = 1. Els vectors d'ona dels controls van en unitats de π/a.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const VERD = '#009639', BLAU = '#1f6feb', VERMELL = '#c0392b', GRIS = '#888';
  const TAU = 2 * Math.PI;

  // ---------- relacions de dispersió ----------
  const C = 1 / 3, M1 = 1, M2 = 2, SM = 1 / M1 + 1 / M2;       // diatòmica: ω_òptica(0) = 1
  const diat = (k, s) => Math.sqrt(Math.max(0, C * SM + s * C * Math.sqrt(Math.max(0, SM * SM - 4 * Math.sin(k / 2) ** 2 / (M1 * M2)))));
  const DISP = {
    mono: k => Math.abs(Math.sin(k / 2)),
    ac: k => diat(k, -1),
    op: k => diat(k, +1),
    lin: k => 0.5 * Math.abs(k),
  };
  const ALTRA = { ac: 'op', op: 'ac' };

  const s = { disp: 'mono', tipus: 'gauss', k0: 0.4, dk: 0.06, atoms: true, vel: 1, t: 0, play: true };
  let comp = [], W = 160, X0 = -40, tmax = 100, vf = 0, vg = 0, vdd = 0, vEnv = 0, xt = null;

  const w = k => DISP[s.disp](k);
  const dwdk = k => (w(k + 1e-4) - w(k - 1e-4)) / 2e-4;

  function prepara() {
    const k0 = s.k0 * Math.PI, dk = s.dk * Math.PI, w0 = w(k0);
    vf = w0 / k0; vg = dwdk(k0); vdd = (w(k0 + dk / 2) - w(k0 - dk / 2)) / dk;
    vEnv = s.tipus === 'dues' ? vdd : vg;
    comp = [];
    if (s.tipus === 'dues') { comp.push([k0 - dk / 2, w(k0 - dk / 2), 0.5], [k0 + dk / 2, w(k0 + dk / 2), 0.5]); }
    else {
      const n = 81;
      let suma = 0;
      for (let j = 0; j < n; j++) { const k = k0 + dk * 3.5 * (2 * j / (n - 1) - 1), A = Math.exp(-((k - k0) ** 2) / (2 * dk * dk)); comp.push([k, w(k), A]); suma += A; }
      comp.forEach(c => { c[2] /= suma; });
    }
    // finestra: unes quantes amplades del paquet, i el temps que triga a sortir-ne
    const dx = s.tipus === 'dues' ? TAU / dk : 1 / dk;
    W = Math.max(120, Math.min(1500, (s.tipus === 'dues' ? 2.2 : 10) * dx));
    X0 = vEnv >= 0 ? -0.25 * W : -0.75 * W;
    tmax = 0.55 * W / Math.max(Math.abs(vEnv), 0.03 * W / 100);
    $('vf').textContent = vf.toFixed(3);
    $('vdd').textContent = vdd.toFixed(3);
    $('vg').textContent = vg.toFixed(3);
    $('dx').textContent = s.tipus === 'dues' ? '— (batecs, període ' + (TAU / dk).toFixed(0) + ' a)' : (1 / dk).toFixed(1);
    calculaXT();
  }

  function camp(x, t) {           // [Re, |·|] de Σ A e^{i(kx − ωt)}
    let re = 0, im = 0;
    for (const [k, om, A] of comp) { const ph = k * x - om * t; re += A * Math.cos(ph); im += A * Math.sin(ph); }
    return [re, Math.hypot(re, im)];
  }

  function prep(cv) {
    const dpr = window.devicePixelRatio || 1, ww = cv.clientWidth, hh = cv.clientHeight;
    cv.width = Math.round(ww * dpr); cv.height = Math.round(hh * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, ww, hh);
    c.font = '11px "Segoe UI", system-ui, sans-serif';
    return { c, w: ww, h: hh };
  }

  // ---------- relació de dispersió ----------
  function dibuixaDisp() {
    const { c, w: ww, h } = prep($('cvDisp'));
    const L = 44, R = 14, T = 12, B = 30;
    let ymax = 0; for (let i = 0; i <= 200; i++) ymax = Math.max(ymax, w(Math.PI * i / 200), ALTRA[s.disp] ? DISP[ALTRA[s.disp]](Math.PI * i / 200) : 0);
    ymax *= 1.12;
    const k2p = k => L + k / Math.PI * (ww - L - R), w2p = om => h - B - om / ymax * (h - T - B);
    const k0 = s.k0 * Math.PI, dk = s.dk * Math.PI, w0 = w(k0);
    // franja Δk
    c.fillStyle = 'rgba(0,150,57,0.10)';
    c.fillRect(k2p(Math.max(0, k0 - dk / 2)), T, k2p(Math.min(Math.PI, k0 + dk / 2)) - k2p(Math.max(0, k0 - dk / 2)), h - T - B);
    // eixos
    c.strokeStyle = '#999'; c.beginPath(); c.moveTo(L, T); c.lineTo(L, h - B); c.lineTo(ww - R, h - B); c.stroke();
    c.fillStyle = '#555';
    [0, 0.25, 0.5, 0.75, 1].forEach(v => { c.fillText(v === 1 ? 'π/a' : v === 0 ? '0' : v + 'π/a', k2p(v * Math.PI) - 10, h - B + 14); });
    c.fillText('k', ww - R - 6, h - B - 6); c.fillText('ω/ω_m', 4, T + 8);
    for (let v = 0.25; v < ymax; v += 0.25) { c.fillText(v.toFixed(2), 8, w2p(v) + 4); c.strokeStyle = '#f0f0f0'; c.beginPath(); c.moveTo(L, w2p(v)); c.lineTo(ww - R, w2p(v)); c.stroke(); }
    // corbes
    const corba = (f, color, lw) => { c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); for (let i = 0; i <= 300; i++) { const k = Math.PI * i / 300, p = [k2p(k), w2p(f(k))]; i ? c.lineTo(...p) : c.moveTo(...p); } c.stroke(); c.lineWidth = 1; };
    if (ALTRA[s.disp]) corba(DISP[ALTRA[s.disp]], '#ccc', 1.5);
    corba(w, '#333', 2.2);
    c.save(); c.beginPath(); c.rect(L, T, ww - L - R, h - T - B); c.clip();
    const recta = (ka, oa, kb, ob, color, dash) => {
      const m = (ob - oa) / (kb - ka), kL = 0, kR = Math.PI;
      c.strokeStyle = color; c.lineWidth = 1.8; c.setLineDash(dash || []);
      c.beginPath(); c.moveTo(k2p(kL), w2p(oa + m * (kL - ka))); c.lineTo(k2p(kR), w2p(oa + m * (kR - ka))); c.stroke();
      c.setLineDash([]); c.lineWidth = 1;
    };
    recta(0, 0, k0, w0, VERMELL);
    recta(k0 - dk / 2, w(k0 - dk / 2), k0 + dk / 2, w(k0 + dk / 2), VERD, [6, 4]);
    recta(k0, w0, k0 + 1e-4, w0 + vg * 1e-4, BLAU, [2, 3]);
    c.restore();
    [[k0 - dk / 2, VERD], [k0 + dk / 2, VERD], [k0, VERMELL]].forEach(([k, col]) => { c.fillStyle = col; c.beginPath(); c.arc(k2p(k), w2p(w(k)), 4, 0, TAU); c.fill(); });
    c.fillStyle = '#333'; c.fillText('k₀', k2p(k0) - 4, h - B + 26 > h ? h - 2 : h - B + 26);
  }

  // ---------- el paquet ----------
  function dibuixaOna() {
    const { c, w: ww, h } = prep($('cvOna'));
    const L = 10, R = 10, T = 12, B = 22, t = s.t;
    const x2p = x => L + (x - X0) / W * (ww - L - R), y2p = y => T + (1.1 - y) / 2.2 * (h - T - B);
    c.strokeStyle = '#eee'; c.beginPath(); c.moveTo(L, y2p(0)); c.lineTo(ww - R, y2p(0)); c.stroke();
    c.fillStyle = '#777';
    const pas = W > 600 ? 100 : W > 250 ? 50 : 20;
    for (let x = Math.ceil(X0 / pas) * pas; x <= X0 + W; x += pas) c.fillText(x + 'a', x2p(x) - 8, h - 6);
    const N = Math.min(1600, Math.round((ww - L - R) * 1.5));
    const re = [], ab = [];
    for (let i = 0; i <= N; i++) { const [r, a] = camp(X0 + W * i / N, t); re.push(r); ab.push(a); }
    const tracar = (arr, sg, color, lw, dash) => { c.strokeStyle = color; c.lineWidth = lw; c.setLineDash(dash || []); c.beginPath(); for (let i = 0; i <= N; i++) { const p = [x2p(X0 + W * i / N), y2p(sg * arr[i])]; i ? c.lineTo(...p) : c.moveTo(...p); } c.stroke(); c.setLineDash([]); c.lineWidth = 1; };
    tracar(ab, 1, GRIS, 1.4, [5, 4]); tracar(ab, -1, GRIS, 1.4, [5, 4]);
    tracar(re, 1, s.atoms ? 'rgba(31,111,235,0.35)' : BLAU, s.atoms ? 1.2 : 1.8);
    if (s.atoms && W <= 400) {
      for (let n = Math.ceil(X0); n <= X0 + W; n++) { const [r] = camp(n, t); c.fillStyle = BLAU; c.beginPath(); c.arc(x2p(n), y2p(r), W > 200 ? 1.8 : 2.6, 0, TAU); c.fill(); }
    }
    // centre del paquet i una cresta propera
    const k0 = s.k0 * Math.PI, w0 = w(k0), xe = vEnv * t;
    const lam = TAU / k0, x0c = w0 * t / k0;                     // crestes: k0 x − ω0 t = 2π m
    const m = Math.round((xe - x0c) / lam), xc = x0c + m * lam;
    c.fillStyle = VERD; const pe = x2p(xe);
    c.beginPath(); c.moveTo(pe, y2p(1.08)); c.lineTo(pe - 7, y2p(1.08) - 10); c.lineTo(pe + 7, y2p(1.08) - 10); c.closePath(); c.fill();
    const [rc] = camp(xc, t);
    c.fillStyle = VERMELL; c.beginPath(); c.arc(x2p(xc), y2p(rc), 5.5, 0, TAU); c.fill();
    $('tval').textContent = t.toFixed(0);
  }

  // ---------- diagrama x–t ----------
  function calculaXT() {
    const nx = 320, nt = 110, img = new ImageData(nx, nt);
    for (let j = 0; j < nt; j++) {
      const t = tmax * (1 - (j + 0.5) / nt);
      for (let i = 0; i < nx; i++) {
        const [r] = camp(X0 + W * (i + 0.5) / nx, t), v = Math.max(-1, Math.min(1, r * 1.6)), p = 4 * (j * nx + i);
        if (v > 0) { img.data[p] = 255; img.data[p + 1] = 255 - v * 190; img.data[p + 2] = 255 - v * 200; }
        else { img.data[p] = 255 + v * 200; img.data[p + 1] = 255 + v * 145; img.data[p + 2] = 255; }
        img.data[p + 3] = 255;
      }
    }
    const off = document.createElement('canvas'); off.width = nx; off.height = nt; off.getContext('2d').putImageData(img, 0, 0);
    xt = off;
  }
  function dibuixaXT() {
    const { c, w: ww, h } = prep($('cvXT'));
    const L = 10, R = 10, T = 8, B = 20;
    if (xt) { c.imageSmoothingEnabled = true; c.drawImage(xt, L, T, ww - L - R, h - T - B); }
    const x2p = x => L + (x - X0) / W * (ww - L - R), t2p = t => T + (1 - t / tmax) * (h - T - B);
    c.save(); c.beginPath(); c.rect(L, T, ww - L - R, h - T - B); c.clip();
    const k0 = s.k0 * Math.PI;
    const linia = (v, x0, color) => { c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); c.moveTo(x2p(x0), t2p(0)); c.lineTo(x2p(x0 + v * tmax), t2p(tmax)); c.stroke(); c.lineWidth = 1; };
    linia(vf, 0, VERMELL); linia(vEnv, 0, VERD);
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(L, t2p(s.t)); c.lineTo(ww - R, t2p(s.t)); c.stroke(); c.setLineDash([]);
    c.restore();
    c.fillStyle = '#555'; c.fillText('t = 0', ww - R - 34, h - B - 4); c.fillText('x →', ww - R - 22, h - 4); c.fillText('↑ t', L + 2, T + 12);
  }

  // ---------- bucle ----------
  let darrer = null;
  function frame(ts) {
    if (darrer !== null && s.play) {
      const k0 = s.k0 * Math.PI, w0 = w(k0);
      const dtMax = Math.PI / (4 * Math.max(w0, 1e-3));                       // crestes sense efecte estroboscòpic
      const dtCreu = 0.55 * W / (Math.max(Math.abs(vEnv), Math.abs(vf), 0.02) * 900);
      s.t += Math.min(dtMax, dtCreu) * s.vel * Math.min(3, (ts - darrer) / 16.7);
      if (s.t > tmax) s.t = 0;
    }
    darrer = ts;
    dibuixaOna(); dibuixaXT();
    requestAnimationFrame(frame);
  }

  // ---------- controls ----------
  function slider(id, clau, dec, cb) {
    const el = $(id), v = $(id + '_val');
    const posa = () => { s[clau] = parseFloat(el.value); v.textContent = (+el.value).toFixed(dec); };
    el.addEventListener('input', () => { posa(); cb && cb(); });
    posa();
  }
  const canvi = () => { s.t = 0; prepara(); dibuixaDisp(); };
  slider('k0', 'k0', 2, canvi);
  slider('dk', 'dk', 3, canvi);
  slider('vel', 'vel', 1);
  $('disp').addEventListener('change', e => { s.disp = e.target.value; canvi(); });
  $('tipus').addEventListener('change', e => { s.tipus = e.target.value; canvi(); });
  $('atoms').addEventListener('change', e => { s.atoms = e.target.checked; });
  $('play').addEventListener('click', () => { s.play = !s.play; $('play').textContent = s.play ? '⏸ Pausa' : '▶ Continua'; });
  $('reinicia').addEventListener('click', () => { s.t = 0; });

  // totes les caixes es poden plegar (també els gràfics i la teoria)
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
    dibuixaDisp();
  }));
  window.addEventListener('resize', dibuixaDisp);

  prepara(); dibuixaDisp();
  requestAnimationFrame(frame);
})();
