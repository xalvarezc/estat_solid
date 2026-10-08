// ═══════════════════════════════════════════════════
//  Condició de Bragg — interferència entre dos plans
//  Δ = 2d sinθ ; δ = (2π/λ)Δ ; I ∝ cos²(δ/2)
// ═══════════════════════════════════════════════════

const els = {
  d: document.getElementById('paramD'),
  dVal: document.getElementById('paramD_val'),
  lambda: document.getElementById('paramLambda'),
  lambdaVal: document.getElementById('paramLambda_val'),
  theta: document.getElementById('paramTheta'),
  thetaVal: document.getElementById('paramTheta_val'),
  btnPlay: document.getElementById('btnPlay'),
  diagramCanvas: document.getElementById('diagramCanvas'),
  waveCanvas: document.getElementById('waveCanvas'),
  intensityCanvas: document.getElementById('intensityCanvas'),
  deltaPath: document.getElementById('deltaPath'),
  deltaOverLambda: document.getElementById('deltaOverLambda'),
  ampReadout: document.getElementById('ampReadout'),
  verdictBadge: document.getElementById('verdictBadge')
};

let playing = false;
let playDir = 1;

function fitCanvas(canvas){
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: rect.width, h: rect.height, ctx: ctx };
}

function current(){
  return {
    d: parseFloat(els.d.value),
    lambda: parseFloat(els.lambda.value),
    thetaDeg: parseFloat(els.theta.value)
  };
}

function deltaPathFor(d, thetaDeg){
  return 2 * d * Math.sin(thetaDeg * Math.PI / 180);
}

// ═══════════════════════════════════════════════════
//  Diagrama geomètric
// ═══════════════════════════════════════════════════
function drawDiagram(){
  const { d, lambda, thetaDeg } = current();
  const thetaRad = thetaDeg * Math.PI / 180;
  const { w, h, ctx } = fitCanvas(els.diagramCanvas);
  ctx.clearRect(0, 0, w, h);

  const dPix = Math.min(120, Math.max(34, d * 20));
  const L = Math.min(150, w * 0.30);
  const cx = w / 2;
  // Els dos rajos incidents i els dos reflectits pugen sempre cap amunt de
  // P i Q (independentment de θ) i, com més s'acosta θ a 90°, més amunt
  // arriben (fins a ~L px). Cal prou marge per sobre perquè no es tallin;
  // com a màxim, però, sense fer baixar el segon pla per sota del canvas.
  const y1 = Math.min(h - dPix - 15, Math.max(L + 12, h * 0.32));

  const P = { x: cx, y: y1 };
  const Q = { x: cx, y: y1 + dPix };
  const u = { x: Math.cos(thetaRad), y: Math.sin(thetaRad) };   // direcció incident
  const v = { x: Math.cos(thetaRad), y: -Math.sin(thetaRad) };  // direcció reflectida

  function pt(base, dir, s){ return { x: base.x + dir.x*s, y: base.y + dir.y*s }; }
  function line(a, b, style){
    ctx.save();
    Object.assign(ctx, style);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  }
  function arrowHead(at, dir, color){
    const size = 6;
    const ang = Math.atan2(dir.y, dir.x);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
    ctx.lineTo(at.x - size*Math.cos(ang - 0.4), at.y - size*Math.sin(ang - 0.4));
    ctx.lineTo(at.x - size*Math.cos(ang + 0.4), at.y - size*Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Plans (amb petits àtoms)
  ctx.strokeStyle = '#00722b'; ctx.lineWidth = 2;
  [y1, y1+dPix].forEach(function(y){
    ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(w-16, y); ctx.stroke();
  });
  ctx.fillStyle = '#00722b';
  for (let x = 30; x < w-20; x += 34){
    ctx.beginPath(); ctx.arc(x, y1, 3.2, 0, 2*Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y1+dPix, 3.2, 0, 2*Math.PI); ctx.fill();
  }

  // Indicador d'espaiat d, a l'esquerra
  const xd = 26;
  ctx.strokeStyle = '#4a6352'; ctx.lineWidth = 1;
  line({x:xd,y:y1}, {x:xd,y:y1+dPix}, {strokeStyle:'#4a6352', lineWidth:1});
  ctx.fillStyle = '#4a6352'; ctx.font = '11px Segoe UI, Arial, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('d', xd+4, y1 + dPix/2 + 4);

  // Rajos 1 i 2 (incident + reflectit, mateix color per a cada raig sencer,
  // igual que a la gràfica d'interferència de sota: raig 1 blau, raig 2
  // taronja) — guia fina + ona animada a sobre. Perquè comparar fases tingui
  // sentit físic, els dos rajos han de començar sobre un mateix front d'ona
  // (pla ⟂ a u) i acabar sobre un mateix front d'ona de sortida (pla ⟂ a v)
  // — no n'hi ha prou amb la mateixa longitud d'arc.
  const RAY1_COLOR = '#2c6fbb', RAY2_COLOR = '#e07b1a';

  function dot2(p, q){ return p.x*q.x + p.y*q.y; }
  function perpUnit(dir){ return { x:-dir.y, y:dir.x }; }
  function vec(a, b){ return { x:b.x-a.x, y:b.y-a.y }; }

  const inc1Start = pt(P, u, -L);
  const t2in = dot2(vec(Q, inc1Start), u);
  const inc2Start = pt(Q, u, t2in);

  const refl1End = pt(P, v, L);
  const t2out = dot2(vec(Q, refl1End), v);
  const refl2End = pt(Q, v, t2out);

  line(inc1Start, P, {strokeStyle:'#cfe0f2', lineWidth:1});
  line(inc2Start, Q, {strokeStyle:'#fbe1c6', lineWidth:1});
  line(P, refl1End, {strokeStyle:'#cfe0f2', lineWidth:1});
  line(Q, refl2End, {strokeStyle:'#fbe1c6', lineWidth:1});
  arrowHead(P, u, RAY1_COLOR); arrowHead(Q, u, RAY2_COLOR);
  arrowHead(refl1End, v, RAY1_COLOR); arrowHead(refl2End, v, RAY2_COLOR);

  // Fronts d'ona de referència (perpendiculars a u i a v): aquí, i només
  // aquí, té sentit comparar si les dues ones van en fase o no. Color
  // neutre perquè no es confonguin amb el color dels rajos.
  function drawWavefront(p1, p2, dir, color, label){
    const perp = perpUnit(dir);
    const s2 = dot2(vec(p1, p2), perp);
    const sMin = Math.min(0, s2) - 16, sMax = Math.max(0, s2) + 16;
    const a = pt(p1, perp, sMin), b = pt(p1, perp, sMax);
    ctx.save();
    ctx.setLineDash([2,4]); ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = color; ctx.font = '9px Segoe UI, Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, (a.x+b.x)/2, Math.min(a.y,b.y) - 5);
  }
  drawWavefront(inc1Start, inc2Start, u, '#888', "front d'ona incident");
  drawWavefront(refl1End, refl2End, v, '#888', "front d'ona emergent");

  // Ona transportada sobre cada trajectòria: la fase de cada punt és la
  // fase real del camí òptic recorregut (mateixa referència de front d'ona
  // per als dos rajos), de manera que la diferència de fase visual entre
  // el raig 1 i el raig 2 reflectits és exactament la que dona Δ = 2d sinθ.
  const scalePxPerA = 20; // mateixa escala amb què es dibuixa d (dPix = d·20, retallat)
  const lambdaPix = Math.max(4, lambda * scalePxPerA);
  const kWave = 2*Math.PI/lambdaPix;
  const omegaWave = 2*Math.PI*0.5;
  const ampWave = 7;

  function wavyLine(start, dir, lengthPx, phaseAtStart, color){
    const perp = perpUnit(dir);
    ctx.beginPath();
    for (let s = 0; s <= lengthPx; s += 2){
      const bx = start.x + dir.x*s, by = start.y + dir.y*s;
      const off = ampWave * Math.sin(phaseAtStart + kWave*s - omegaWave*waveT);
      const X = bx + perp.x*off, Y = by + perp.y*off;
      if (s === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  }

  const len2in = Math.hypot(Q.x-inc2Start.x, Q.y-inc2Start.y);
  const len2out = Math.hypot(refl2End.x-Q.x, refl2End.y-Q.y);

  wavyLine(inc1Start, u, L, kWave*dot2(inc1Start, u), RAY1_COLOR);
  wavyLine(inc2Start, u, len2in, kWave*dot2(inc2Start, u), RAY2_COLOR);
  wavyLine(P, v, L, kWave*dot2(P, u), RAY1_COLOR);
  wavyLine(Q, v, len2out, kWave*dot2(Q, u), RAY2_COLOR);

  // Construcció geomètrica: A (a l'incident 2) i B (al reflectit 2)
  const dsin = dPix * Math.sin(thetaRad);
  const A = pt(Q, u, -dsin);
  const B = pt(Q, v, dsin);

  ctx.setLineDash([3,3]);
  line(P, A, {strokeStyle:'#888', lineWidth:1});
  line(P, B, {strokeStyle:'#888', lineWidth:1});
  ctx.setLineDash([]);

  line(A, Q, {strokeStyle:'#e07b1a', lineWidth:3});
  line(Q, B, {strokeStyle:'#e07b1a', lineWidth:3});

  // Etiquetes desplaçades perpendicularment a cada segment (no en un eix
  // fix), perquè quedin sempre allunyades de la línia taronja sigui quin
  // sigui l'angle θ, en lloc de solapar-s'hi.
  const LABEL_OFF = 11;
  const perpU = perpUnit(u), perpV = perpUnit(v);
  const midAQ = pt(A, vec(A, Q), 0.5);
  const midQB = pt(Q, vec(Q, B), 0.5);
  const labelAQ = pt(midAQ, perpU, LABEL_OFF);
  const labelQB = pt(midQB, perpV, LABEL_OFF);

  ctx.fillStyle = '#e07b1a'; ctx.font = 'bold 10px Segoe UI, Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('d·sinθ', labelAQ.x, labelAQ.y);
  ctx.fillText('d·sinθ', labelQB.x, labelQB.y);
  ctx.textBaseline = 'alphabetic';

  // Punts P, Q, A, B
  ctx.fillStyle = '#1a1a1a';
  [P,Q].forEach(function(pp){ ctx.beginPath(); ctx.arc(pp.x, pp.y, 2.6, 0, 2*Math.PI); ctx.fill(); });

  // Arc de l'angle θ a P (respecte el pla)
  ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(P.x, P.y, 26, Math.PI, Math.PI + thetaRad, false);
  ctx.stroke();
  ctx.fillStyle = '#666'; ctx.font = '11px Segoe UI, Arial, sans-serif'; ctx.textAlign = 'left';
  const midAng = Math.PI + thetaRad/2;
  ctx.fillText('θ', P.x + 30*Math.cos(midAng), P.y + 30*Math.sin(midAng) + 3);

  const delta = deltaPathFor(d, thetaDeg);
  els.deltaPath.textContent = delta.toFixed(3);
  els.deltaOverLambda.textContent = (delta/lambda).toFixed(3) + ' λ';
}

// ═══════════════════════════════════════════════════
//  Ones reflectides (animació temporal)
// ═══════════════════════════════════════════════════
let waveT = 0;
function drawWave(dtSec){
  waveT += dtSec;
  const { d, lambda, thetaDeg } = current();
  const delta = (2*Math.PI/lambda) * deltaPathFor(d, thetaDeg);

  const { w, h, ctx } = fitCanvas(els.waveCanvas);
  ctx.clearRect(0, 0, w, h);

  const kx = 2*Math.PI*2.2 / w;   // nombre d'ona "de dibuix" (arbitrari, només visual)
  const omega = 2*Math.PI*0.5;    // freqüència temporal "de dibuix"
  const A0 = h*0.11;
  const yTop = h*0.28, yBot = h*0.72;

  function plot(baseline, phaseExtra, color, dash, amp){
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2){
      const y = baseline - amp*Math.cos(kx*x - omega*waveT - phaseExtra);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    if (dash) ctx.setLineDash(dash); else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = '#c8e6c9'; ctx.lineWidth = 1;
  [yTop, yBot].forEach(function(y){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); });

  plot(yTop, 0, '#2c6fbb', null, A0);
  plot(yTop, delta, '#e07b1a', [5,3], A0);

  // Suma de les dues ones: 2A0cos(δ/2)·cos(kx−ωt−δ/2) (identitat suma-a-producte).
  // L'amplitud pot sortir negativa: això és el propi senyal matemàtic de l'oposició de fase.
  const sumAmpSigned = 2*A0*Math.cos(delta/2);
  plot(yBot, delta/2, '#009639', null, sumAmpSigned);

  ctx.fillStyle = '#4a6352'; ctx.font = '10px Segoe UI, Arial, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('raig 1 i raig 2 reflectits', 6, yTop - A0 - 6);
  ctx.fillText('suma', 6, Math.max(10, yBot - Math.abs(sumAmpSigned) - 6));

  const relAmp = Math.abs(Math.cos(delta/2)); // 0..1, fracció de l'amplitud màxima 2A0
  els.ampReadout.textContent = (2*relAmp).toFixed(2);
  const badge = els.verdictBadge;
  badge.classList.remove('constructiva','destructiva','parcial');
  if (relAmp > 0.9){ badge.classList.add('constructiva'); badge.textContent = 'CONSTRUCTIVA'; }
  else if (relAmp < 0.1){ badge.classList.add('destructiva'); badge.textContent = 'DESTRUCTIVA'; }
  else { badge.classList.add('parcial'); badge.textContent = 'PARCIAL (' + Math.round(relAmp*100) + '%)'; }
}

// ═══════════════════════════════════════════════════
//  Intensitat vs θ (corba completa + angles de Bragg)
// ═══════════════════════════════════════════════════
function drawIntensity(){
  const { d, lambda, thetaDeg } = current();
  const { w, h, ctx } = fitCanvas(els.intensityCanvas);
  ctx.clearRect(0, 0, w, h);

  const padL = 30, padR = 10, padT = 10, padB = 20;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const thMin = 0, thMax = 90;

  function xOf(th){ return padL + (th - thMin)/(thMax - thMin) * plotW; }
  function intensityAt(th){
    const delta = (2*Math.PI/lambda) * deltaPathFor(d, th);
    return Math.cos(delta/2) ** 2;
  }

  ctx.strokeStyle = '#c8e6c9'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT); ctx.lineTo(padL, padT+plotH); ctx.lineTo(padL+plotW, padT+plotH);
  ctx.stroke();
  ctx.fillStyle = '#4a6352'; ctx.font = '10px Segoe UI, Arial, sans-serif'; ctx.textAlign = 'center';
  for (let t = 0; t <= 90; t += 30){
    const x = xOf(t);
    ctx.beginPath(); ctx.moveTo(x, padT+plotH); ctx.lineTo(x, padT+plotH+4); ctx.strokeStyle='#c8e6c9'; ctx.stroke();
    ctx.fillText(t + '°', x, padT+plotH+14);
  }

  // Angles de Bragg (n=1,2,3...)
  ctx.setLineDash([4,3]);
  ctx.strokeStyle = '#e07b1a';
  for (let n = 1; n <= 6; n++){
    const s = n*lambda/(2*d);
    if (s > 1) break;
    const thN = Math.asin(s) * 180/Math.PI;
    const x = xOf(thN);
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT+plotH); ctx.stroke();
    ctx.fillStyle = '#e07b1a'; ctx.font = '9px Segoe UI, Arial, sans-serif';
    ctx.fillText('n='+n, x, padT+9);
  }
  ctx.setLineDash([]);

  // Corba d'intensitat
  ctx.strokeStyle = '#009639'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let px = 0; px <= plotW; px++){
    const th = thMin + px/plotW*(thMax-thMin);
    const I = intensityAt(th);
    const y = padT + plotH - I*plotH;
    if (px === 0) ctx.moveTo(padL+px, y); else ctx.lineTo(padL+px, y);
  }
  ctx.stroke();

  // Marcador de la θ actual
  const xCur = xOf(thetaDeg);
  const yCur = padT + plotH - intensityAt(thetaDeg)*plotH;
  ctx.strokeStyle = '#1a1a1a'; ctx.setLineDash([2,2]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(xCur, padT); ctx.lineTo(xCur, padT+plotH); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(xCur, yCur, 4, 0, 2*Math.PI); ctx.fill();
}

// ═══════════════════════════════════════════════════
//  Bucle d'animació i control d'events
// ═══════════════════════════════════════════════════
function redrawStatic(){
  drawDiagram();
  drawIntensity();
}

let lastFrame = null;
function loop(ts){
  if (lastFrame === null) lastFrame = ts;
  const dt = Math.min(0.05, (ts - lastFrame)/1000);
  lastFrame = ts;

  if (playing){
    let th = parseFloat(els.theta.value);
    th += playDir * dt * 12; // graus/segon
    if (th >= 89.5){ th = 89.5; playDir = -1; }
    if (th <= 0.5){ th = 0.5; playDir = 1; }
    els.theta.value = th.toFixed(1);
    els.thetaVal.textContent = th.toFixed(1);
    drawIntensity();
  }

  // L'ona s'ha de veure viatjant sobre les trajectòries sempre, encara que
  // θ estigui aturada — per això drawDiagram() es crida a cada frame.
  drawWave(dt);
  drawDiagram();
  requestAnimationFrame(loop);
}

function onParamChange(){
  els.dVal.textContent = parseFloat(els.d.value).toFixed(2);
  els.lambdaVal.textContent = parseFloat(els.lambda.value).toFixed(2);
  els.thetaVal.textContent = parseFloat(els.theta.value).toFixed(1);
  redrawStatic();
  // Redibuixa també l'ona i el badge de seguida (dt=0, no avança l'animació):
  // si no, l'amplitud/veredicte només es refresca al següent frame de rAF.
  drawWave(0);
}

[els.d, els.lambda, els.theta].forEach(function(inp){
  inp.addEventListener('input', onParamChange);
});

els.btnPlay.addEventListener('click', function(){
  playing = !playing;
  els.btnPlay.classList.toggle('playing', playing);
  els.btnPlay.textContent = playing ? '⏸ Atura l\'escaneig' : '▶ Escaneja l\'angle automàticament';
});
els.theta.addEventListener('mousedown', function(){
  if (playing){ playing = false; els.btnPlay.classList.remove('playing'); els.btnPlay.textContent = '▶ Escaneja l\'angle automàticament'; }
});

window.addEventListener('resize', redrawStatic);

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

onParamChange();
requestAnimationFrame(loop);
