// ═══════════════════════════════════════════════════
//  Difracció de pols — de la cel·la unitat als pics
//  Base d'un sol àtom: la intensitat relativa és purament
//  la multiplicitat geomètrica (nombre de (hkl) equivalents
//  per simetria que cauen sobre el mateix d).
// ═══════════════════════════════════════════════════

const els = {
  sistema: document.getElementById('sistema'),
  centratge: document.getElementById('centratge'),
  sistemaHint: document.getElementById('sistemaHint'),
  a: document.getElementById('paramA'),
  b: document.getElementById('paramB'),
  c: document.getElementById('paramC'),
  alpha: document.getElementById('paramAlpha'),
  beta: document.getElementById('paramBeta'),
  gamma: document.getElementById('paramGamma'),
  lambda: document.getElementById('lambda'),
  hmax: document.getElementById('hmax'),
  canvas: document.getElementById('diffCanvas'),
  tooltip: document.getElementById('tooltip'),
  emptyState: document.getElementById('emptyState'),
  tbody: document.getElementById('peakTableBody'),
  btnDownload: document.getElementById('btnDownload')
};

// ── Sistemes cristal·logràfics: quins camps són "mestres" (editables),
//    quins es fixen a un valor constant, i quins es lliguen al valor
//    d'un altre camp mestre. Cada sistema porta uns valors per defecte
//    perquè en canviar de sistema la cel·la sempre sigui vàlida. ──
const SYSTEMS = {
  cubic:      { label:'Cúbic',                lenLink:{b:'a', c:'a'}, angLock:{alpha:90, beta:90, gamma:90},
                centrings:['P','I','F'], defaults:{a:4.00, b:4.00, c:4.00, alpha:90, beta:90, gamma:90},
                hint:'a = b = c, tots els angles 90°.' },
  tetragonal: { label:'Tetragonal',           lenLink:{b:'a'}, angLock:{alpha:90, beta:90, gamma:90},
                centrings:['P','I'], defaults:{a:4.00, b:4.00, c:6.00, alpha:90, beta:90, gamma:90},
                hint:'a = b ≠ c, tots els angles 90°.' },
  ortorombic: { label:'Ortoròmbic',           lenLink:{}, angLock:{alpha:90, beta:90, gamma:90},
                centrings:['P','I','F','C'], defaults:{a:4.00, b:5.00, c:6.00, alpha:90, beta:90, gamma:90},
                hint:'a, b, c independents; tots els angles 90°.' },
  hexagonal:  { label:'Hexagonal',            lenLink:{b:'a'}, angLock:{alpha:90, beta:90, gamma:120},
                centrings:['P'], defaults:{a:3.50, b:3.50, c:5.70, alpha:90, beta:90, gamma:120},
                hint:'a = b ≠ c, α = β = 90°, γ = 120°.' },
  trigonal:   { label:'Trigonal (rombohèdric)', lenLink:{b:'a', c:'a'}, angLock:{}, angLink:{beta:'alpha', gamma:'alpha'},
                centrings:['P'], defaults:{a:5.00, b:5.00, c:5.00, alpha:80, beta:80, gamma:80},
                hint:'a = b = c, α = β = γ ≠ 90° (eixos rombohèdrics).' },
  monoclinic: { label:'Monoclínic',           lenLink:{}, angLock:{alpha:90, gamma:90},
                centrings:['P','C'], defaults:{a:5.00, b:6.00, c:7.00, alpha:90, beta:100, gamma:90},
                hint:'a, b, c independents; α = γ = 90°, β lliure.' },
  triclinic:  { label:'Triclínic',            lenLink:{}, angLock:{},
                centrings:['P'], defaults:{a:5.00, b:6.00, c:7.00, alpha:80, beta:95, gamma:100},
                hint:'a, b, c i els tres angles, tots independents.' }
};

function mod2(n){ return ((n % 2) + 2) % 2; }

function selectionRule(centering, h, k, l){
  if (centering === 'P') return true;
  if (centering === 'I') return mod2(h + k + l) === 0;
  if (centering === 'F') return mod2(h) === mod2(k) && mod2(k) === mod2(l);
  if (centering === 'C') return mod2(h + k) === 0;
  return true;
}

function cross(u, v){
  return [ u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0] ];
}
function dot(u, v){ return u[0]*v[0] + u[1]*v[1] + u[2]*v[2]; }
function scale(v, s){ return [v[0]*s, v[1]*s, v[2]*s]; }

function buildDirectVectors(a, b, c, alphaDeg, betaDeg, gammaDeg){
  const alpha = alphaDeg * Math.PI / 180;
  const beta  = betaDeg  * Math.PI / 180;
  const gamma = gammaDeg * Math.PI / 180;

  const a1 = [a, 0, 0];
  const a2 = [b * Math.cos(gamma), b * Math.sin(gamma), 0];

  const cx = c * Math.cos(beta);
  const cy = c * (Math.cos(alpha) - Math.cos(beta) * Math.cos(gamma)) / Math.sin(gamma);
  const czSq = 1 - Math.cos(alpha)**2 - Math.cos(beta)**2 - Math.cos(gamma)**2
               + 2 * Math.cos(alpha) * Math.cos(beta) * Math.cos(gamma);
  const cz = c * Math.sqrt(Math.max(0, czSq)) / Math.sin(gamma);
  const a3 = [cx, cy, cz];

  return [a1, a2, a3];
}

function reciprocalVectors(a1, a2, a3){
  const V = dot(a1, cross(a2, a3));
  const b1 = scale(cross(a2, a3), 2 * Math.PI / V);
  const b2 = scale(cross(a3, a1), 2 * Math.PI / V);
  const b3 = scale(cross(a1, a2), 2 * Math.PI / V);
  return [b1, b2, b3];
}

// Puntuació per triar quin (hkl) d'un grup equivalent es mostra a la
// taula — purament cosmètic, prioritza índexs positius.
function repScore(h, k, l){ return h*1e6 + k*1e3 + l; }

function computePattern(){
  const a = parseFloat(els.a.value), b = parseFloat(els.b.value), c = parseFloat(els.c.value);
  const alpha = parseFloat(els.alpha.value), beta = parseFloat(els.beta.value), gamma = parseFloat(els.gamma.value);
  const lambda = parseFloat(els.lambda.value);
  const hmax = Math.round(parseFloat(els.hmax.value));
  const centering = els.centratge.value;

  const [a1, a2, a3] = buildDirectVectors(a, b, c, alpha, beta, gamma);
  const [b1, b2, b3] = reciprocalVectors(a1, a2, a3);

  const byD = new Map();

  for (let h = -hmax; h <= hmax; h++){
    for (let k = -hmax; k <= hmax; k++){
      for (let l = -hmax; l <= hmax; l++){
        if (h === 0 && k === 0 && l === 0) continue;
        if (!selectionRule(centering, h, k, l)) continue;

        const Gx = h*b1[0] + k*b2[0] + l*b3[0];
        const Gy = h*b1[1] + k*b2[1] + l*b3[1];
        const Gz = h*b1[2] + k*b2[2] + l*b3[2];
        const Gmag = Math.sqrt(Gx*Gx + Gy*Gy + Gz*Gz);
        if (Gmag <= 0) continue;
        const d = 2 * Math.PI / Gmag;

        const sinTheta = lambda / (2 * d);
        if (sinTheta > 1) continue;
        const twoTheta = 2 * Math.asin(sinTheta) * 180 / Math.PI;

        const key = d.toFixed(5);
        if (byD.has(key)){
          const entry = byD.get(key);
          entry.count++;
          if (repScore(h,k,l) > repScore(...entry.rep)) entry.rep = [h,k,l];
        } else {
          byD.set(key, { d, twoTheta, count: 1, rep: [h,k,l] });
        }
      }
    }
  }

  return Array.from(byD.values()).sort((p, q) => p.twoTheta - q.twoTheta);
}

// ═══════════════════════════════════════════════════
//  Sistema / centratge / paràmetres lligats
// ═══════════════════════════════════════════════════
function applySystem(){
  const sys = SYSTEMS[els.sistema.value];

  // Centratges vàlids
  els.centratge.innerHTML = '';
  sys.centrings.forEach(function(c){
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c + ' (' + {P:'primitiu', I:'centrat al cos', F:'centrat a les cares', C:'centrat a bases'}[c] + ')';
    els.centratge.appendChild(opt);
  });

  els.sistemaHint.textContent = sys.hint;

  // Valors per defecte en canviar de sistema
  els.a.value = sys.defaults.a;
  els.b.value = sys.defaults.b;
  els.c.value = sys.defaults.c;
  els.alpha.value = sys.defaults.alpha;
  els.beta.value = sys.defaults.beta;
  els.gamma.value = sys.defaults.gamma;

  // Longituds: b i/o c lligades a a
  [els.b, els.c].forEach(function(inp){ inp.disabled = false; });
  Object.keys(sys.lenLink || {}).forEach(function(field){
    els[field].disabled = true;
  });

  // Angles: fixats o lliures
  [els.alpha, els.beta, els.gamma].forEach(function(inp){ inp.disabled = false; });
  Object.keys(sys.angLock || {}).forEach(function(field){
    els[field].disabled = true;
  });
  Object.keys(sys.angLink || {}).forEach(function(field){
    els[field].disabled = true;
  });

  syncLinkedFields();
  redraw();
}

function syncLinkedFields(){
  const sys = SYSTEMS[els.sistema.value];
  Object.keys(sys.lenLink || {}).forEach(function(field){
    els[field].value = els[sys.lenLink[field]].value;
  });
  Object.keys(sys.angLock || {}).forEach(function(field){
    els[field].value = sys.angLock[field];
  });
  Object.keys(sys.angLink || {}).forEach(function(field){
    els[field].value = els[sys.angLink[field]].value;
  });
}

els.a.addEventListener('input', function(){ syncLinkedFields(); redraw(); });
els.alpha.addEventListener('input', function(){ syncLinkedFields(); redraw(); });
[els.b, els.c, els.beta, els.gamma, els.lambda, els.hmax, els.centratge].forEach(function(inp){
  inp.addEventListener('input', redraw);
  inp.addEventListener('change', redraw);
});
els.sistema.addEventListener('change', applySystem);

// ═══════════════════════════════════════════════════
//  Gràfic (canvas responsiu) + taula + tooltip
// ═══════════════════════════════════════════════════
let currentPeaks = [];
let plotArea = { x0: 0, x1: 0, w: 0 };
const X_MIN = 0, X_MAX = 180;

function fitCanvas(canvas){
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: rect.width, h: rect.height, ctx: ctx };
}

function drawChart(peaks){
  const { w, h, ctx } = fitCanvas(els.canvas);
  ctx.clearRect(0, 0, w, h);

  const padL = 34, padR = 12, padT = 10, padB = 26;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  plotArea = { x0: padL, x1: padL + plotW, w: plotW };

  // Eixos
  ctx.strokeStyle = '#c8e6c9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  // Marques de l'eix X cada 20°
  ctx.fillStyle = '#4a6352';
  ctx.font = '10px Segoe UI, Arial, sans-serif';
  ctx.textAlign = 'center';
  for (let t = X_MIN; t <= X_MAX; t += 20){
    const x = padL + (t - X_MIN) / (X_MAX - X_MIN) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, padT + plotH);
    ctx.lineTo(x, padT + plotH + 4);
    ctx.strokeStyle = '#c8e6c9';
    ctx.stroke();
    ctx.fillText(t.toString(), x, padT + plotH + 15);
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillText('2θ (°)', padL + plotW / 2, h - 2);
  ctx.restore();

  if (!peaks.length){
    els.emptyState.style.display = 'block';
    currentPeaks = [];
    return;
  }
  els.emptyState.style.display = 'none';

  const maxCount = Math.max.apply(null, peaks.map(function(p){ return p.count; }));
  currentPeaks = peaks.map(function(p){
    const x = padL + (p.twoTheta - X_MIN) / (X_MAX - X_MIN) * plotW;
    const barH = (p.count / maxCount) * (plotH - 6);
    return Object.assign({}, p, { x: x, barH: barH });
  });

  ctx.strokeStyle = '#009639';
  ctx.lineWidth = 2;
  currentPeaks.forEach(function(p){
    ctx.beginPath();
    ctx.moveTo(p.x, padT + plotH);
    ctx.lineTo(p.x, padT + plotH - p.barH);
    ctx.stroke();
  });
}

function fmtHkl(rep){ return rep.join(' '); }

function renderTable(peaks){
  els.tbody.innerHTML = '';
  peaks.forEach(function(p, i){
    const tr = document.createElement('tr');
    tr.dataset.idx = i;
    tr.innerHTML =
      '<td class="mono">' + fmtHkl(p.rep) + '</td>' +
      '<td class="mono">' + p.d.toFixed(4) + '</td>' +
      '<td class="mono">' + p.twoTheta.toFixed(3) + '</td>' +
      '<td>' + p.count + '</td>';
    els.tbody.appendChild(tr);
  });
}

function redraw(){
  const peaks = computePattern();
  drawChart(peaks);
  renderTable(peaks);
  lastPeaks = peaks;
}
let lastPeaks = [];

// Tooltip / ratolí sobre el gràfic
els.canvas.addEventListener('mousemove', function(evt){
  const rect = els.canvas.getBoundingClientRect();
  const mx = evt.clientX - rect.left;

  let nearest = null, nearestDist = 8; // llindar en px
  currentPeaks.forEach(function(p, i){
    const dist = Math.abs(p.x - mx);
    if (dist < nearestDist){ nearestDist = dist; nearest = { p: p, i: i }; }
  });

  document.querySelectorAll('#peakTableBody tr').forEach(function(tr){ tr.classList.remove('highlight'); });

  if (nearest){
    const p = nearest.p;
    els.tooltip.style.display = 'block';
    els.tooltip.style.left = p.x + 'px';
    els.tooltip.style.top = (rect.height - p.barH) + 'px';
    els.tooltip.innerHTML = '(' + fmtHkl(p.rep) + ')<br>d = ' + p.d.toFixed(4) + ' Å<br>2θ = ' + p.twoTheta.toFixed(3) + '°<br>mult. = ' + p.count;
    const tr = els.tbody.children[nearest.i];
    if (tr){ tr.classList.add('highlight'); tr.scrollIntoView({ block: 'nearest' }); }
  } else {
    els.tooltip.style.display = 'none';
  }
});
els.canvas.addEventListener('mouseleave', function(){
  els.tooltip.style.display = 'none';
  document.querySelectorAll('#peakTableBody tr').forEach(function(tr){ tr.classList.remove('highlight'); });
});

window.addEventListener('resize', function(){ drawChart(lastPeaks); });

// CSV
els.btnDownload.addEventListener('click', function(){
  if (!lastPeaks.length) return;
  let csv = 'h,k,l,d_A,2theta_deg,multiplicitat\n';
  lastPeaks.forEach(function(p){
    csv += p.rep.join(',') + ',' + p.d.toFixed(5) + ',' + p.twoTheta.toFixed(4) + ',' + p.count + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'difraccio_pols.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// ═══════════════════════════════════════════════════
//  Targetes de controls plegables
// ═══════════════════════════════════════════════════
document.querySelectorAll('.collapsible-title').forEach(function(title) {
  title.addEventListener('click', function() {
    const card = this.closest('.card');
    const tri  = this.querySelector('.card-tri');
    card.classList.toggle('collapsed');
    tri.textContent = card.classList.contains('collapsed') ? '▶' : '▼';
  });
});

applySystem();
