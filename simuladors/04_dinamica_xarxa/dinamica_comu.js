// Utilitats compartides pels simuladors del Tema 4 (Dinàmica de xarxa). Còpia de 03_cohesio/cohesio_comu.js amb el nom global Din.
// Gràfiques senzilles sobre canvas, fórmules amb KaTeX, lectures i enllaços.

window.Din = (function () {
  'use strict';

  const TAU = 2 * Math.PI;
  const KE2 = 14.3996;            // e²/4πε₀ en eV·Å
  const EVA3_GPA = 160.2177;      // 1 eV/Å³ en GPa
  const HARTREE_EV = 27.2114, BOHR_A = 0.529177;

  // ---- format de nombres ----
  function fmt(x, n) {
    if (!isFinite(x)) return '—';
    if (n === undefined) n = 3;
    const r = Math.round(x);
    if (Math.abs(x - r) < 1e-9 && Math.abs(r) < 1e6) return String(r);
    return String(+x.toFixed(n));
  }
  // xifres significatives
  function sig(x, n) {
    if (!isFinite(x)) return '—';
    if (Math.abs(x) < 1e-12) return '0';
    return String(+x.toPrecision(n === undefined ? 3 : n));
  }

  // ---- KaTeX ----
  function tex(s) {
    if (window.katex) return window.katex.renderToString(s, { displayMode: true, throwOnError: false });
    return '<code>' + s.replace(/</g, '&lt;') + '</code>';
  }
  // rows: [{nom, tex:[...], nota, actiu}]
  function formulas(el, rows) {
    el.innerHTML = rows.map(r => '<div class="formula' + (r.actiu ? ' actiu' : '') + '"><div class="formula-nom">' + r.nom + '</div>' +
      (r.tex || []).map(tex).join('') + (r.nota ? '<div class="formula-nota">' + r.nota + '</div>' : '') + '</div>').join('');
  }
  // rows: [[etiqueta, valor], …]
  function readout(el, rows) {
    el.innerHTML = rows.map(r => '<div class="fila"><span class="etiqueta">' + r[0] + '</span><span class="valor">' + r[1] + '</span></div>').join('');
  }

  // ---- ticks "bonics" ----
  function niceStep(range, n) {
    const raw = range / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }
  function ticks(min, max, n) {
    const st = niceStep(max - min, n || 5), out = [];
    for (let v = Math.ceil(min / st - 1e-9) * st; v <= max + 1e-9 * st; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v);
    return out;
  }
  const tickLabel = v => String(+v.toPrecision(6));

  // ---- gràfica 2D ----
  function Plot(canvas, o) {
    const g = canvas.getContext('2d');
    const p = Object.assign({ xmin: 0, xmax: 1, ymin: 0, ymax: 1, logy: false }, o);
    p.g = g; p.canvas = canvas;
    p.m = Object.assign({ l: 54, r: 14, t: 14, b: 40 }, o.m || {});
    const W = () => canvas.width, H = () => canvas.height;
    p.X = x => p.m.l + (x - p.xmin) / (p.xmax - p.xmin) * (W() - p.m.l - p.m.r);
    p.Y = y => {
      const t = p.logy ? (Math.log10(Math.max(y, 1e-300)) - Math.log10(p.ymin)) / (Math.log10(p.ymax) - Math.log10(p.ymin))
        : (y - p.ymin) / (p.ymax - p.ymin);
      return H() - p.m.b - t * (H() - p.m.t - p.m.b);
    };
    p.invX = px => p.xmin + (px - p.m.l) / (W() - p.m.l - p.m.r) * (p.xmax - p.xmin);
    p.invY = py => p.ymin + (H() - p.m.b - py) / (H() - p.m.t - p.m.b) * (p.ymax - p.ymin);
    p.clear = () => g.clearRect(0, 0, W(), H());
    p.clip = () => { g.save(); g.beginPath(); g.rect(p.m.l, p.m.t, W() - p.m.l - p.m.r, H() - p.m.t - p.m.b); g.clip(); };
    p.unclip = () => g.restore();

    p.axes = (xlabel, ylabel, opt) => {
      opt = opt || {};
      const x0 = p.m.l, x1 = W() - p.m.r, y0 = H() - p.m.b, y1 = p.m.t;
      g.font = '10px sans-serif'; g.lineWidth = 1;
      // graella i marques
      const xt = opt.xticks || ticks(p.xmin, p.xmax, opt.nx || 6);
      const yt = opt.yticks || (p.logy ? (() => { const a = []; for (let e = Math.ceil(Math.log10(p.ymin)); e <= Math.log10(p.ymax); e++) a.push(Math.pow(10, e)); return a; })()
        : ticks(p.ymin, p.ymax, opt.ny || 5));
      g.strokeStyle = '#edf1ee';
      xt.forEach(v => { const x = p.X(v); g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); });
      yt.forEach(v => { const y = p.Y(v); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); });
      // zero
      if (!p.logy && p.ymin < 0 && p.ymax > 0) { g.strokeStyle = '#9aa8a0'; g.beginPath(); g.moveTo(x0, p.Y(0)); g.lineTo(x1, p.Y(0)); g.stroke(); }
      g.strokeStyle = '#999';
      g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0); g.lineTo(x1, y0); g.stroke();
      g.fillStyle = '#555'; g.textAlign = 'center';
      xt.forEach(v => g.fillText(opt.xfmt ? opt.xfmt(v) : tickLabel(v), p.X(v), y0 + 13));
      g.textAlign = 'right';
      yt.forEach(v => g.fillText(opt.yfmt ? opt.yfmt(v) : (p.logy ? sig(v, 2) : tickLabel(v)), x0 - 4, p.Y(v) + 3));
      g.textAlign = 'center';
      if (xlabel) g.fillText(xlabel, (x0 + x1) / 2, H() - 6);
      if (ylabel) { g.save(); g.translate(12, (y0 + y1) / 2); g.rotate(-Math.PI / 2); g.fillText(ylabel, 0, 0); g.restore(); }
    };

    const style = s => {
      s = s || {};
      g.strokeStyle = s.col || '#00722b'; g.lineWidth = s.w || 2; g.setLineDash(s.dash || []);
      g.globalAlpha = s.alpha === undefined ? 1 : s.alpha;
    };
    const unstyle = () => { g.setLineDash([]); g.globalAlpha = 1; };
    // corba y = f(x), mostrejada cada mig píxel; talla els trams fora de rang
    p.fn = (f, s, x0, x1) => {
      x0 = x0 === undefined ? p.xmin : Math.max(p.xmin, x0);
      x1 = x1 === undefined ? p.xmax : Math.min(p.xmax, x1);
      const n = Math.max(2, Math.ceil(Math.abs(p.X(x1) - p.X(x0)) * 2));
      p.clip(); style(s); g.beginPath();
      let pen = false;
      const lim = (p.ymax - p.ymin) * 20;
      for (let i = 0; i <= n; i++) {
        const x = x0 + (x1 - x0) * i / n, y = f(x);
        if (!isFinite(y) || (!p.logy && Math.abs(y) > Math.abs(p.ymax) + lim) || (p.logy && y <= 0)) { pen = false; continue; }
        const px = p.X(x), py = p.Y(y);
        if (pen) g.lineTo(px, py); else { g.moveTo(px, py); pen = true; }
      }
      g.stroke(); unstyle(); p.unclip();
    };
    p.pts = (arr, s) => {
      p.clip(); style(s); g.beginPath();
      arr.forEach((q, i) => { const px = p.X(q[0]), py = p.Y(q[1]); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
      g.stroke(); unstyle(); p.unclip();
    };
    p.dots = (arr, col, r) => {
      p.clip(); g.fillStyle = col || '#00722b';
      arr.forEach(q => { g.beginPath(); g.arc(p.X(q[0]), p.Y(q[1]), r || 2.5, 0, TAU); g.fill(); });
      p.unclip();
    };
    p.dot = (x, y, col, r) => p.dots([[x, y]], col, r);
    p.vline = (x, s) => { p.clip(); style(s); g.beginPath(); g.moveTo(p.X(x), p.m.t); g.lineTo(p.X(x), H() - p.m.b); g.stroke(); unstyle(); p.unclip(); };
    p.hline = (y, s) => { p.clip(); style(s); g.beginPath(); g.moveTo(p.m.l, p.Y(y)); g.lineTo(W() - p.m.r, p.Y(y)); g.stroke(); unstyle(); p.unclip(); };
    p.text = (t, x, y, o2) => {
      o2 = o2 || {};
      g.font = o2.font || '11px sans-serif'; g.fillStyle = o2.col || '#333'; g.textAlign = o2.align || 'left';
      g.fillText(t, p.X(x) + (o2.dx || 0), p.Y(y) + (o2.dy || 0));
    };
    // llegenda a dalt a la dreta: [{nom, col, dash, w}]
    p.legend = (items, o2) => {
      o2 = o2 || {};
      g.font = '11px sans-serif'; g.textAlign = 'left';
      const wmax = Math.max(...items.map(it => g.measureText(it.nom).width));
      const x = o2.left ? p.m.l + 10 : W() - p.m.r - wmax - 34, y0 = p.m.t + 10 + (o2.dy || 0);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(x - 4, y0 - 9, wmax + 34, items.length * 15 + 4);
      items.forEach((it, i) => {
        const y = y0 + i * 15;
        g.strokeStyle = it.col; g.lineWidth = it.w || 2; g.setLineDash(it.dash || []);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20, y); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#333'; g.fillText(it.nom, x + 25, y + 4);
      });
    };
    // arrossegar sobre la gràfica: cb(x, y) en coordenades de dades
    p.onDrag = cb => {
      let on = false;
      const ev2 = ev => {
        const r = canvas.getBoundingClientRect();
        const px = (ev.clientX - r.left) * canvas.width / r.width, py = (ev.clientY - r.top) * canvas.height / r.height;
        cb(p.invX(px), p.invY(py), px, py);
      };
      canvas.addEventListener('mousedown', ev => { on = true; ev2(ev); });
      window.addEventListener('mousemove', ev => { if (on) ev2(ev); });
      window.addEventListener('mouseup', () => { on = false; });
    };
    return p;
  }

  // ---- fletxa ----
  function arrow(g, x0, y0, x1, y1, col, width) {
    const ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = width || 2;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    if (len > 4) {
      const hl = Math.min(9, len * 0.4);
      g.beginPath(); g.moveTo(x1, y1);
      g.lineTo(x1 - hl * Math.cos(ang - 0.4), y1 - hl * Math.sin(ang - 0.4));
      g.lineTo(x1 - hl * Math.cos(ang + 0.4), y1 - hl * Math.sin(ang + 0.4));
      g.closePath(); g.fill();
    }
  }

  // ---- paràmetres d'URL ----
  const params = () => new URLSearchParams(location.search);
  function num(p, k, f, lo, hi) {
    if (!p.has(k)) return;
    const x = +p.get(k);
    if (isFinite(x) && (lo === undefined || x >= lo) && (hi === undefined || x <= hi)) f(x);
  }
  // botó "Copia l'enllaç": build() ha de retornar un URLSearchParams
  function linkButton(btn, msg, build) {
    btn.addEventListener('click', () => {
      const url = location.origin + location.pathname + '?' + build().toString().replace(/%2C/g, ',');
      const ok = () => { msg.textContent = 'Enllaç copiat.'; setTimeout(() => { msg.textContent = ''; }, 2500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, () => prompt('Enllaç:', url));
      else prompt('Enllaç:', url);
    });
  }

  // grup de botons d'opció: <div class="grup-btn"><button data-v="…">
  function optionGroup(el, onChange) {
    const set = v => el.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('actiu', b.dataset.v === v));
    el.addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (b) { set(b.dataset.v); onChange(b.dataset.v); } });
    return set;
  }

  return { TAU, KE2, EVA3_GPA, HARTREE_EV, BOHR_A, fmt, sig, tex, formulas, readout, ticks, Plot, arrow, params, num, linkButton, optionGroup };
})();
