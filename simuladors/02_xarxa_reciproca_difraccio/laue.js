// ═══════════════════════════════════════════════════
//  Mètode de Laue (transmissió) — xarxa cúbica
//  k_f = k_i + G, |k_f| = |k_i| = 2π/λ, λ ∈ [λmin, λmax]
//  Projecció sobre una pel·lícula plana a distància D.
// ═══════════════════════════════════════════════════

const els = {
  a: document.getElementById('paramA'),
  zoneAxis: document.getElementById('zoneAxis'),
  lambdaMin: document.getElementById('lambdaMin'),
  lambdaMax: document.getElementById('lambdaMax'),
  detectorD: document.getElementById('detectorD'),
  hmax: document.getElementById('hmax'),
  filmCanvas: document.getElementById('filmCanvas'),
  tooltip: document.getElementById('tooltip'),
  spotCount: document.getElementById('spotCount')
};

// Matrius de rotació R (cristall → laboratori, amb l'eix de zona alineat
// amb +z, la direcció del feix): files = eixos del laboratori expressats
// en coordenades del cristall. Es calculen un cop, a mà, per a cada eix
// de zona (no cal una rotació general perquè només s'ofereixen aquests tres).
const S2 = Math.SQRT1_2, S3 = 1/Math.sqrt(3), S6 = 1/Math.sqrt(6);
const ZONE_MATRICES = {
  '100': [ [0,1,0], [0,0,1], [1,0,0] ],
  '110': [ [S2,-S2,0], [0,0,-1], [S2,S2,0] ],
  '111': [ [S2,-S2,0], [S6,S6,-2*S6], [S3,S3,S3] ]
};

function matVec(R, v){
  return [
    R[0][0]*v[0]+R[0][1]*v[1]+R[0][2]*v[2],
    R[1][0]*v[0]+R[1][1]*v[1]+R[1][2]*v[2],
    R[2][0]*v[0]+R[2][1]*v[1]+R[2][2]*v[2]
  ];
}

function computeSpots(){
  const a = parseFloat(els.a.value);
  const lambdaMin = parseFloat(els.lambdaMin.value);
  const lambdaMax = parseFloat(els.lambdaMax.value);
  const D = parseFloat(els.detectorD.value);
  const hmax = Math.round(parseFloat(els.hmax.value));
  const R = ZONE_MATRICES[els.zoneAxis.value];

  const gScale = 2*Math.PI/a;
  const spots = [];

  for (let h = -hmax; h <= hmax; h++){
    for (let k = -hmax; k <= hmax; k++){
      for (let l = -hmax; l <= hmax; l++){
        if (h === 0 && k === 0 && l === 0) continue;

        const G = matVec(R, [h*gScale, k*gScale, l*gScale]);
        const Gz = G[2];
        if (Gz >= -1e-9) continue; // cal G cap "enrere" perquè hi hagi transmissió endavant

        const Gmag2 = G[0]*G[0] + G[1]*G[1] + G[2]*G[2];
        const kMag = Gmag2 / (-2*Gz);
        const lambda = 2*Math.PI/kMag;
        if (lambda < lambdaMin || lambda > lambdaMax) continue;

        const kfz = kMag + Gz;
        if (kfz <= 1e-9) continue;

        const x = D * G[0]/kfz;
        const y = D * G[1]/kfz;
        const dSpacing = 2*Math.PI/Math.sqrt(Gmag2);

        spots.push({ h, k, l, x, y, lambda, d: dSpacing });
      }
    }
  }
  return spots;
}

// ═══════════════════════════════════════════════════
//  Dibuix
// ═══════════════════════════════════════════════════
let currentSpots = [];
let viewHalf = 3;

function fitCanvas(canvas){
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: rect.width, h: rect.height, ctx: ctx };
}

function draw(){
  const spots = computeSpots();
  const { w, h, ctx } = fitCanvas(els.filmCanvas);
  ctx.clearRect(0, 0, w, h);

  const cx = w/2, cy = h/2;

  let maxR = 0;
  spots.forEach(function(s){ maxR = Math.max(maxR, Math.abs(s.x), Math.abs(s.y)); });
  viewHalf = Math.max(0.5, maxR * 1.15);

  const scale = Math.min(w, h) / (2*viewHalf) * 0.92;

  // Reticle centrat (feix directe / beam-stop)
  ctx.strokeStyle = '#c8e6c9'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx-6, cy); ctx.lineTo(cx+6, cy);
  ctx.moveTo(cx, cy-6); ctx.lineTo(cx, cy+6);
  ctx.stroke();

  currentSpots = spots.map(function(s){
    const px = cx + s.x*scale;
    const py = cy - s.y*scale;
    const ord = Math.abs(s.h)+Math.abs(s.k)+Math.abs(s.l);
    const r = Math.max(1.6, 6.5 - 0.55*ord);
    return Object.assign({}, s, { px, py, r });
  });

  ctx.fillStyle = '#00722b';
  currentSpots.forEach(function(s){
    ctx.beginPath(); ctx.arc(s.px, s.py, s.r, 0, 2*Math.PI); ctx.fill();
  });

  els.spotCount.textContent = spots.length;
}

// ═══════════════════════════════════════════════════
//  Tooltip
// ═══════════════════════════════════════════════════
els.filmCanvas.addEventListener('mousemove', function(evt){
  const rect = els.filmCanvas.getBoundingClientRect();
  const mx = evt.clientX - rect.left, my = evt.clientY - rect.top;

  let nearest = null, nearestDist = 10;
  currentSpots.forEach(function(s){
    const dist = Math.hypot(s.px-mx, s.py-my);
    if (dist < nearestDist){ nearestDist = dist; nearest = s; }
  });

  if (nearest){
    els.tooltip.style.display = 'block';
    els.tooltip.style.left = nearest.px + 'px';
    els.tooltip.style.top = nearest.py + 'px';
    els.tooltip.innerHTML = '(' + [nearest.h,nearest.k,nearest.l].join(' ') + ')<br>' +
      'λ = ' + nearest.lambda.toFixed(3) + ' Å<br>' +
      'd = ' + nearest.d.toFixed(3) + ' Å';
  } else {
    els.tooltip.style.display = 'none';
  }
});
els.filmCanvas.addEventListener('mouseleave', function(){ els.tooltip.style.display = 'none'; });

window.addEventListener('resize', draw);
[els.a, els.zoneAxis, els.lambdaMin, els.lambdaMax, els.detectorD, els.hmax].forEach(function(inp){
  inp.addEventListener('input', draw);
  inp.addEventListener('change', draw);
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

draw();
