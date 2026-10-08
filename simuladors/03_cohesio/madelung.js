// Simulador — La constant de Madelung: l'ordre de la suma importa.
// M = Σ_j ±1/p_j (+ per als ions de càrrega oposada), p_j en unitats de la distància entre veïns.
// Dues maneres de sumar: per capes esfèriques (ordre "natural", no convergeix en 3D)
// i per blocs neutres d'Evjen (ions de la frontera amb pes 1/2, 1/4, 1/8), que convergeix.

(function () {
  'use strict';
  const { KE2, fmt, sig, Plot } = Coh;
  const EXACT = { '1d': 2 * Math.LN2, nacl: 1.747565, cscl: 1.762675 };
  const NOM = { '1d': 'cadena iònica 1D', nacl: 'NaCl', cscl: 'CsCl' };
  const COL = { pos: '#2980b9', neg: '#d62728', sph: '#e67e22', evj: '#00722b', exact: '#555' };
  const RMAX = 10;

  const state = { est: 'nacl', R: 3, metode: 'evjen', m: 8, r0: 2.820 };

  // ---------------------------------------------------------------
  // Sumes
  // ---------------------------------------------------------------
  // capes esfèriques: [{p, n, signe, acumulat}]
  function shells(est) {
    if (est === '1d') {
      const out = []; let s = 0;
      for (let n = 1; n <= 60; n++) { const t = 2 * (n % 2 ? 1 : -1) / n; s += t; out.push({ p: n, count: 2, sgn: n % 2 ? 1 : -1, acc: s }); }
      return out;
    }
    const map = new Map(), L = RMAX + 2;
    if (est === 'nacl') {
      for (let i = -L; i <= L; i++) for (let j = -L; j <= L; j++) for (let k = -L; k <= L; k++) {
        const N = i * i + j * j + k * k;
        if (!N || N > RMAX * RMAX) continue;
        const sgn = (i + j + k) % 2 ? 1 : -1;            // +: càrrega oposada (atracció)
        if (!map.has(N)) map.set(N, { p: Math.sqrt(N), count: 0, sum: 0 });
        const e = map.get(N); e.count++; e.sum += sgn / Math.sqrt(N);
      }
    } else {
      const d0 = Math.sqrt(3) / 2;                        // distància Cs–Cl en unitats de a
      for (let i = -L; i <= L; i++) for (let j = -L; j <= L; j++) for (let k = -L; k <= L; k++) {
        // Cs (mateixa càrrega) als enters, Cl (oposada) als semienters
        [[i, j, k, -1], [i + 0.5, j + 0.5, k + 0.5, 1]].forEach(([x, y, z, sgn]) => {
          const d2 = x * x + y * y + z * z;
          if (d2 < 1e-9) return;
          const p = Math.sqrt(d2) / d0;
          if (p > RMAX) return;
          const key = Math.round(4 * d2);
          if (!map.has(key)) map.set(key, { p, count: 0, sum: 0 });
          const e = map.get(key); e.count++; e.sum += sgn / p;
        });
      }
    }
    const out = [...map.values()].sort((a, b) => a.p - b.p);
    let s = 0;
    out.forEach(e => { s += e.sum; e.acc = s; e.sgn = Math.sign(e.sum); });
    return out;
  }

  // blocs neutres d'Evjen: [{n, Rnn (radi en unitats de r0), acc}]
  function evjen(est) {
    const out = [];
    if (est === '1d') {
      let s = 0;
      for (let n = 1; n <= 60; n++) {
        const t = 2 * (n % 2 ? 1 : -1) / n;
        out.push({ n, R: n, acc: s + t / 2 });        // els dos ions de la vora, amb pes 1/2
        s += t;
      }
      return out;
    }
    const nmax = est === 'nacl' ? RMAX : Math.floor(RMAX * Math.sqrt(3) / 2);
    for (let n = 1; n <= nmax; n++) {
      let M = 0;
      const w = c => (Math.abs(Math.abs(c) - n) < 1e-9 ? 0.5 : 1);
      if (est === 'nacl') {
        for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
          if (!i && !j && !k) continue;
          const sgn = (i + j + k) % 2 ? 1 : -1;
          M += sgn * w(i) * w(j) * w(k) / Math.sqrt(i * i + j * j + k * k);
        }
        out.push({ n, R: n, acc: M });
      } else {
        // CsCl: un cub amb les cares fetes només de Cs (A) i un amb les cares fetes només de Cl (B).
        // Tots dos són neutres, però tenen Σq r² ≠ 0 (de signe oposat) i convergeixen a valors
        // desplaçats en ± la mateixa constant. La mitjana elimina aquest desplaçament.
        const d0 = Math.sqrt(3) / 2, h = n + 0.5;
        const wB = c => (Math.abs(Math.abs(c) - h) < 1e-9 ? 0.5 : 1);
        let A = 0, B = 0;
        for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
          if (i || j || k) {
            const p = Math.sqrt(i * i + j * j + k * k) / d0;
            A -= w(i) * w(j) * w(k) / p;
            B -= 1 / p;
          }
          if (i < n && j < n && k < n) { const x = i + 0.5, y = j + 0.5, z = k + 0.5; A += 1 / (Math.sqrt(x * x + y * y + z * z) / d0); }
        }
        for (let i = -n - 1; i <= n; i++) for (let j = -n - 1; j <= n; j++) for (let k = -n - 1; k <= n; k++) {
          const x = i + 0.5, y = j + 0.5, z = k + 0.5;
          B += wB(x) * wB(y) * wB(z) / (Math.sqrt(x * x + y * y + z * z) / d0);
        }
        out.push({ n, R: n / d0, acc: (A + B) / 2, A, B });
      }
    }
    return out;
  }

  const cache = {};
  function data(est) {
    if (!cache[est]) cache[est] = { sh: shells(est), ev: evjen(est) };
    return cache[est];
  }
  // valor de cada mètode per al radi actual
  function current() {
    const D = data(state.est);
    const shIn = D.sh.filter(e => e.p <= state.R + 1e-9);
    const evIn = D.ev.filter(e => e.R <= state.R + 1e-9);
    return { sh: shIn.length ? shIn[shIn.length - 1] : null, nsh: shIn.length, ev: evIn.length ? evIn[evIn.length - 1] : null };
  }

  // ---------------------------------------------------------------
  // Gràfica de les sumes parcials
  // ---------------------------------------------------------------
  const cS = document.getElementById('canvasSum');
  const pS = Plot(cS, { m: { l: 50, r: 14, t: 14, b: 40 } });
  function drawSum() {
    const D = data(state.est), M = EXACT[state.est], is1 = state.est === '1d';
    const xmax = is1 ? 40 : RMAX;
    Object.assign(pS, { xmin: 0, xmax, ymin: is1 ? 0.9 : -3.5, ymax: is1 ? 2.1 : 10.5 });
    pS.clear();
    pS.axes(is1 ? 'nombre de parells de veïns sumats, N' : 'radi de la regió sumada (en unitats de r₀)', 'suma parcial de M');
    pS.hline(M, { col: COL.exact, w: 1.5, dash: [6, 4] });
    pS.text('M = ' + M.toFixed(4), xmax, M, { align: 'right', dx: -4, dy: -6, col: COL.exact });
    // capes: funció esglaonada
    const sh = D.sh.filter(e => e.p <= xmax);
    const st = [[0, 0]];
    sh.forEach((e, i) => { st.push([e.p, i ? sh[i - 1].acc : 0]); st.push([e.p, e.acc]); });
    st.push([xmax, sh[sh.length - 1].acc]);
    pS.pts(st, { col: COL.sph, w: 1.3, alpha: 0.8 });
    pS.dots(sh.map(e => [e.p, e.acc]), COL.sph, 2.5);
    const ev = D.ev.filter(e => e.R <= xmax);
    pS.pts(ev.map(e => [e.R, e.acc]), { col: COL.evj, w: 1.5 });
    pS.dots(ev.map(e => [e.R, e.acc]), COL.evj, 3.5);
    pS.vline(state.R, { col: '#ff3b30', w: 1.5 });
    pS.legend([{ nom: is1 ? 'sumant terme a terme' : 'per capes esfèriques', col: COL.sph }, { nom: is1 ? 'amb els dos ions de la vora a ½' : 'per blocs neutres (Evjen)', col: COL.evj }, { nom: 'valor exacte', col: COL.exact, dash: [6, 4] }]);
  }
  pS.onDrag(x => setR(x));

  // ---------------------------------------------------------------
  // Vista de la xarxa i de la regió sumada
  // ---------------------------------------------------------------
  const cL = document.getElementById('canvasLat'), gL = cL.getContext('2d');
  function drawLat() {
    const W = cL.width, H = cL.height, cx = W / 2, cy = H / 2;
    gL.clearRect(0, 0, W, H);
    const evj = state.metode === 'evjen';
    if (state.est === '1d') {
      const N = Math.min(40, Math.floor(state.R)), show = Math.max(N + 1, 8), sc = (W - 30) / (2 * show);
      const y = cy;
      gL.strokeStyle = '#ccc'; gL.beginPath(); gL.moveTo(10, y); gL.lineTo(W - 10, y); gL.stroke();
      for (let i = -show; i <= show; i++) {
        const x = cx + i * sc, sgn = i % 2 ? -1 : 1, inside = Math.abs(i) <= N;
        const w = !inside ? 0 : (evj && Math.abs(i) === N && i ? 0.5 : 1);
        drawIon(gL, x, y, Math.max(3, Math.min(11, sc * 0.38)), sgn, i === 0 ? 1 : w, i === 0);
      }
      gL.fillStyle = '#555'; gL.font = '11px sans-serif'; gL.textAlign = 'center';
      gL.fillText(evj ? 'Ions sumats; els dos de la vora pesen ½' : 'Ions sumats fins a N = ' + N, cx, y + 40);
      return;
    }
    // pla z = 0 (NaCl) o projecció de la cel·la (CsCl)
    const L = Math.ceil(RMAX) + 1, sc = (Math.min(W, H) / 2 - 10) / (RMAX + 0.6);
    const isN = state.est === 'nacl', d0 = isN ? 1 : Math.sqrt(3) / 2;   // distància a veí més proper (unitats de la graella)
    const Rg = state.R * d0;                                             // radi en unitats de la graella
    const n = isN ? Math.floor(state.R + 1e-9) : Math.floor(state.R * d0 + 1e-9);
    // regió sumada
    gL.fillStyle = 'rgba(0,150,57,0.07)'; gL.strokeStyle = evj ? COL.evj : COL.sph; gL.lineWidth = 2; gL.setLineDash([6, 4]);
    if (evj) { if (n >= 1) { gL.fillRect(cx - n * sc, cy - n * sc, 2 * n * sc, 2 * n * sc); gL.strokeRect(cx - n * sc, cy - n * sc, 2 * n * sc, 2 * n * sc); } }
    else { gL.beginPath(); gL.arc(cx, cy, Rg * sc, 0, Coh.TAU); gL.fill(); gL.stroke(); }
    gL.setLineDash([]);
    const r = Math.max(2, Math.min(7, sc * 0.3));
    const wf = c => (Math.abs(Math.abs(c) - n) < 1e-9 ? 0.5 : (Math.abs(c) < n ? 1 : 0));
    for (let i = -L; i <= L; i++) for (let j = -L; j <= L; j++) {
      const ions = isN ? [[i, j, (i + j) % 2 ? -1 : 1]] : [[i, j, 1], [i + 0.5, j + 0.5, -1]];
      ions.forEach(([x, y, sgn]) => {
        if (Math.abs(x) > RMAX + 0.5 || Math.abs(y) > RMAX + 0.5) return;
        let w;
        if (evj) {
          if (isN) w = wf(x) * wf(y);
          else w = sgn > 0 ? wf(x) * wf(y) : (Math.abs(x) < n && Math.abs(y) < n ? 1 : 0);
          if (n < 1) w = 0;
        } else w = Math.hypot(x, y, isN ? 0 : 0) <= Rg + 1e-9 ? 1 : 0;
        drawIon(gL, cx + x * sc, cy - y * sc, sgn > 0 ? r : r * 0.8, sgn, (!x && !y) ? 1 : w, !x && !y);
      });
    }
    gL.fillStyle = '#555'; gL.font = '11px sans-serif'; gL.textAlign = 'left';
    gL.fillText(isN ? 'Pla z = 0 del NaCl' : 'CsCl projectat sobre una cara del cub (els Cl són a mitja alçada)', 8, 16);
    if (evj) gL.fillText('Pesos a la vora: cares ½, arestes ¼, vèrtexs ⅛ (aquí, ½ i ¼)', 8, H - 8);
  }
  function drawIon(g, x, y, r, sgn, w, ref) {
    const col = sgn > 0 ? COL.pos : COL.neg;
    g.globalAlpha = w > 0 ? (w === 1 ? 1 : w === 0.5 ? 0.55 : 0.3) : 0.12;
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Coh.TAU); g.fill();
    g.globalAlpha = 1;
    if (ref) { g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 3, 0, Coh.TAU); g.stroke(); }
    if (w > 0 && w < 1 && r > 4) { g.fillStyle = '#fff'; g.font = 'bold ' + Math.round(r * 1.1) + 'px sans-serif'; g.textAlign = 'center'; g.fillText(w === 0.5 ? '½' : '¼', x, y + r * 0.4); }
  }

  // ---------------------------------------------------------------
  // Fórmules, lectures i taula de capes
  // ---------------------------------------------------------------
  const formEl = document.getElementById('formules'), lectEl = document.getElementById('lectura'), estatEl = document.getElementById('estat');
  function drawText() {
    const c = current(), M = EXACT[state.est], is1 = state.est === '1d';
    const Msh = c.sh ? c.sh.acc : 0, Mev = c.ev ? c.ev.acc : NaN;
    const rows = [{ nom: 'Constant de Madelung', tex: ['M=\\sum_{j\\neq i}\\frac{\\pm1}{p_j},\\qquad U_i=-\\frac{kq^2}{r}\\,M'],
      nota: 'Signe + per als ions de càrrega oposada a l\'ió de referència (en negre), − per als de la mateixa. p_j és la distància en unitats de la distància entre veïns, r.' }];
    if (is1) rows.push({ nom: 'Cadena 1D', actiu: true, tex: ['M_{1D}=2\\left[1-\\frac12+\\frac13-\\frac14+\\cdots\\right]=2\\ln2=1.3863',
      'S_{' + c.nsh + '}=' + fmt(Msh, 4) + ',\\qquad S_{' + c.nsh + '}-2\\ln2=' + sig(Msh - M, 2)],
      nota: 'L\'error decreix com 1/N: calen un miler de termes per tenir tres xifres. Amb els dos ions de la vora a pes ½, la mateixa suma dona ' + fmt(Mev, 4) + '.' });
    else rows.push({ nom: NOM[state.est] + ': dues maneres de sumar el mateix', actiu: true, tex: [
      'M_{\\text{capes}}(R=' + fmt(state.R, 2) + ')=' + fmt(Msh, 4) + ',\\qquad M_{\\text{Evjen}}=' + (isFinite(Mev) ? fmt(Mev, 4) : '\\text{---}') + ',\\qquad M_{\\text{exacte}}=' + M.toFixed(4)],
      nota: 'La sèrie només és condicionalment convergent: el resultat depèn de l\'ordre dels termes. Sumant per capes, cada capa té una càrrega neta que no es compensa, i les sumes parcials salten sense estabilitzar-se. Els blocs d\'Evjen són neutres (les càrregues de la vora es reparteixen entre blocs veïns) i convergeixen ràpidament.' });
    if (state.est === 'cscl' && c.ev) rows.push({ nom: 'CsCl: ser neutre no n\'hi ha prou', tex: [
      'M_{\\text{cares de Cs}}=' + fmt(c.ev.A, 4) + ',\\qquad M_{\\text{cares de Cl}}=' + fmt(c.ev.B, 4) + ',\\qquad \\tfrac12\\left(M_{\\text{Cs}}+M_{\\text{Cl}}\\right)=' + fmt(c.ev.acc, 4)],
      nota: 'Al CsCl, un cub neutre té totes les cares fetes d\'un sol tipus d\'ió, i just a sota una capa de l\'altre: és una doble capa de càrrega que desplaça el potencial al centre en una constant. Amb cares de Cs el resultat convergeix a 3.12; amb cares de Cl, a 0.40. Els dos desplaçaments són iguals i de signe contrari, i la mitjana dona el valor correcte. Al NaCl no passa perquè cada cara té càrregues alternades.' });
    if (state.est === 'nacl') {
      const U = -KE2 * M / state.r0 * (1 - 1 / state.m);
      rows.push({ nom: 'Què en fem: l\'energia de cohesió', tex: [
        'U(r_0)=-\\frac{kq^2M}{r_0}\\left(1-\\frac1m\\right)=-\\frac{14.40\\cdot' + M.toFixed(4) + '}{' + state.r0 + '}\\left(1-\\frac1{' + state.m + '}\\right)=' + fmt(U, 2) + '\\ \\text{eV per parell}'],
        nota: 'Amb r₀ i m del NaCl dels apunts (r₀ = 2.820 Å, m = 8). Calcular l\'energia de cohesió d\'un cristall iònic és, essencialment, calcular M.' });
    }
    Coh.formulas(formEl, rows);
    const err = Math.abs(Mev - M);
    Coh.readout(lectEl, [['estructura', NOM[state.est]], ['radi sumat R', fmt(state.R, 2) + ' r₀'],
      [is1 ? 'terme a terme' : 'per capes', fmt(Msh, 4)], [is1 ? 'amb la vora a ½' : 'per blocs d\'Evjen', isFinite(Mev) ? fmt(Mev, 4) : '—'], ['exacte', M.toFixed(4)]]);
    estatEl.className = 'estat ' + (err < 0.01 ? 'si' : 'no');
    estatEl.textContent = !isFinite(Mev) ? 'Augmenta el radi per tenir el primer bloc neutre.'
      : err < 0.01 ? 'El mètode d\'Evjen ja és a menys d\'un 1 % del valor exacte.' : 'Encara lluny del valor exacte: augmenta el radi.';
    // taula de capes
    const D = data(state.est);
    document.getElementById('taulaBody').innerHTML = D.sh.slice(0, is1 ? 20 : 24).map((e, i) => {
      const inside = e.p <= state.R + 1e-9;
      return '<tr class="' + (inside ? 'actual' : '') + '"><td>' + (i + 1) + '</td><td>' + fmt(e.p, 4) + '</td><td>' + e.count + '</td><td>' + (e.sgn > 0 ? 'oposada (+)' : 'igual (−)') +
        '</td><td>' + (e.sgn > 0 ? '+' : '') + fmt(is1 ? e.sgn * 2 / e.p : e.sum, 4) + '</td><td>' + fmt(e.acc, 4) + '</td></tr>';
    }).join('');
  }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  function setR(x) {
    const is1 = state.est === '1d';
    state.R = Math.max(1, Math.min(is1 ? 40 : RMAX, x));
    if (is1) state.R = Math.round(state.R);
    render();
  }
  const setEstBtn = Coh.optionGroup($('grupEst'), v => { state.est = v; state.R = v === '1d' ? 6 : 3; render(); });
  const setMetBtn = Coh.optionGroup($('grupMet'), v => { state.metode = v; render(); });
  $('slR').addEventListener('input', () => setR(+$('slR').value));
  let anim = null;
  $('btnAnim').addEventListener('click', () => {
    if (anim) { cancelAnimationFrame(anim); anim = null; $('btnAnim').textContent = '▶ Fes créixer la regió'; return; }
    const is1 = state.est === '1d', Rm = is1 ? 40 : RMAX, t0 = performance.now(), T = 8000;
    $('btnAnim').textContent = '■ Atura';
    const step = now => {
      const f = Math.min(1, (now - t0) / T);
      setR(1 + (Rm - 1) * f);
      if (f < 1) anim = requestAnimationFrame(step); else { anim = null; $('btnAnim').textContent = '▶ Fes créixer la regió'; }
    };
    anim = requestAnimationFrame(step);
  });
  function render() {
    const is1 = state.est === '1d';
    $('slR').max = is1 ? 40 : RMAX; $('slR').step = is1 ? 1 : 0.01; $('slR').value = state.R;
    $('valR').textContent = is1 ? 'N = ' + state.R : fmt(state.R, 2) + ' r₀';
    $('lblR').firstChild.textContent = is1 ? 'Parells de veïns sumats ' : 'Radi de la regió sumada ';
    drawSum(); drawLat(); drawText();
  }

  Coh.linkButton($('btnEnllac'), $('msgEnllac'), () => {
    const p = new URLSearchParams(); p.set('est', state.est); p.set('R', fmt(state.R, 2)); p.set('metode', state.metode); return p;
  });
  (function fromURL() {
    const p = Coh.params();
    if (EXACT[p.get('est')]) state.est = p.get('est');
    if (['evjen', 'esferes'].includes(p.get('metode'))) state.metode = p.get('metode');
    state.R = state.est === '1d' ? 6 : 3;
    Coh.num(p, 'R', x => { state.R = x; }, 1, 40);
    setEstBtn(state.est); setMetBtn(state.metode);
    render();
  })();
})();
