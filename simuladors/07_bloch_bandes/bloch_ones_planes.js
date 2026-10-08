// ═══════════════════════════════════════════════════
//  Colors
// ═══════════════════════════════════════════════════
var MODE_COLORS = [
  '#c0392b','#e67e22','#f39c12','#2980b9',
  '#8e44ad','#16a085','#27ae60','#d35400','#2c3e50'
];

// ═══════════════════════════════════════════════════
//  Estat global
// ═══════════════════════════════════════════════════
var state = { k_frac: 0.5, N: 5, band: 0 };
var view_mode = 'planes';   // 'planes' | 'bloch'
var selected_mode = null;   // n = -half..+half seleccionat al panell B (null = cap)

var N_HARM_MAX = 15;            // harmònics disponibles (independent de N)

// Amplituds dels harmònics: V_harm[n] per n=1..N_HARM_MAX
var V_harm = new Array(N_HARM_MAX + 1).fill(0);
V_harm[1] = 1.5;
var selected_harm  = 1;
var current_preset = 'cosinus';
var preset_scale   = 1.5;       // factor multiplicatiu global per als presets

// Variables computades
var G, k_actual, H_mat, eigen_vals, eigen_vecs;

// Cel·la de la matriu sota el cursor (per al hovering)
var matrix_hover = { i: -1, j: -1 };

// Estructura de bandes (precomputada)
var VP_NK = 200;                // punts k per al band structure
var bands_data = [];            // [b][ki] = E  (precalculat a compute())
var E_full_ymax = 300;          // rang Y complet de la paràbola (tots els modes)
var E_full_ymin = 0;            // rang Y inferior (pot ser < 0 si la banda 0 és negativa)
var E_shared_ymax = 50;         // rang Y de les 2 primeres bandes (calculat a compute())

// Viewport: finestra d'energia que es mostra a l'estructura de bandes
var viewport = {
  y_min: 0, y_max: -1,          // y_max=-1 → s'inicialitza al primer compute()
  drag: null,                   // null | 'body' | 'top' | 'bottom'
  drag_E0: 0, drag_vp0: null
};

// ═══════════════════════════════════════════════════
//  Funcions auxiliars
// ═══════════════════════════════════════════════════
function get_N_harm() { return Math.floor(state.N / 2); }

function getParams() {
  return {
    k_frac: parseFloat(document.getElementById('k_slider').value),
    N: state.N, band: state.band
  };
}

function V_fourier(delta_n) {
  var n = Math.abs(delta_n);
  // Límit físic: amb N ones planes, les diferències van fins a N-1
  if (n >= 1 && n <= state.N - 1 && n < V_harm.length) return V_harm[n] || 0;
  return 0;
}

// ═══════════════════════════════════════════════════
//  Presets
// ═══════════════════════════════════════════════════
function apply_preset(name, scale) {
  if (scale === undefined) scale = preset_scale;
  else preset_scale = scale;
  current_preset = name;
  for (var n = 1; n <= N_HARM_MAX; n++) V_harm[n] = 0;
  if (name === 'cosinus') {
    V_harm[1] = scale;
  } else if (name === 'pou_quadrat') {
    var w = 0.35;
    for (var n = 1; n <= N_HARM_MAX; n++)
      V_harm[n] = (2 * scale / (n * Math.PI)) * Math.sin(n * Math.PI * w);
  } else if (name === 'kronig_penney') {
    for (var n = 1; n <= N_HARM_MAX; n++) V_harm[n] = scale / n;
  } else if (name === 'triangular') {
    for (var n = 1; n <= N_HARM_MAX; n += 2)
      V_harm[n] = 8 * scale / (Math.PI * Math.PI * n * n);
  }
  selected_harm = Math.min(selected_harm, N_HARM_MAX);
  update_harm_slider_ui();
  update_preset_buttons(name);
  update_scale_ctrl_state();
}

function update_scale_ctrl_state() {
  var ctrl = document.getElementById('scale_ctrl');
  var sl   = document.getElementById('scale_slider');
  var active = !!current_preset;
  if (ctrl) ctrl.style.opacity = active ? '1' : '0.35';
  if (sl)   sl.disabled = !active;
}

function update_preset_buttons(active_name) {
  document.querySelectorAll('.preset-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.preset === active_name);
  });
}

function update_harm_slider_ui() {
  var n = selected_harm, v = V_harm[n] || 0;
  document.getElementById('harm_slider').value = v;
  document.getElementById('harm_val').textContent = v.toFixed(2);
  document.getElementById('harm_label').innerHTML = 'V<sub>' + n + '</sub>&thinsp;(n=' + n + ')';
}

// ═══════════════════════════════════════════════════
//  Jacobi
// ═══════════════════════════════════════════════════
function jacobi_eigen(A_in, n) {
  var A = A_in.slice();
  var V = new Array(n * n).fill(0);
  for (var i = 0; i < n; i++) V[i * n + i] = 1;
  for (var iter = 0; iter < 300 * n; iter++) {
    var p = 0, q = 1, amax = 0;
    for (var i = 0; i < n - 1; i++)
      for (var j = i + 1; j < n; j++)
        if (Math.abs(A[i * n + j]) > amax) { amax = Math.abs(A[i * n + j]); p = i; q = j; }
    if (amax < 1e-13) break;
    var app = A[p*n+p], aqq = A[q*n+q], apq = A[p*n+q];
    var theta = 0.5 * Math.atan2(2*apq, aqq - app);
    var c = Math.cos(theta), s = Math.sin(theta);
    var A2 = A.slice();
    A2[p*n+p] = c*c*app - 2*s*c*apq + s*s*aqq;
    A2[q*n+q] = s*s*app + 2*s*c*apq + c*c*aqq;
    A2[p*n+q] = A2[q*n+p] = 0;
    for (var r = 0; r < n; r++) {
      if (r !== p && r !== q) {
        var arp = A[r*n+p], arq = A[r*n+q];
        A2[r*n+p] = A2[p*n+r] = c*arp - s*arq;
        A2[r*n+q] = A2[q*n+r] = s*arp + c*arq;
      }
    }
    A = A2;
    for (var r = 0; r < n; r++) {
      var vrp = V[r*n+p], vrq = V[r*n+q];
      V[r*n+p] = c*vrp - s*vrq;
      V[r*n+q] = s*vrp + c*vrq;
    }
  }
  var vals = [], vecs = [];
  for (var i = 0; i < n; i++) {
    vals.push(A[i*n+i]);
    var col = []; for (var j = 0; j < n; j++) col.push(V[j*n+i]);
    vecs.push(col);
  }
  var idx = vals.map(function(_,i){return i;}).sort(function(a,b){return vals[a]-vals[b];});
  return { values: idx.map(function(i){return vals[i];}),
           vectors: idx.map(function(i){return vecs[i];}) };
}

// ═══════════════════════════════════════════════════
//  Càlcul principal
// ═══════════════════════════════════════════════════
function compute(p) {
  var a = 1;
  G = 2 * Math.PI / a;
  k_actual = p.k_frac * G / 2;
  var N = p.N, half = Math.floor(N / 2);

  // Hamiltonià al k actual
  H_mat = new Array(N * N).fill(0);
  for (var i = 0; i < N; i++) {
    var ni = i - half, q_i = k_actual + ni * G;
    for (var j = 0; j < N; j++) {
      var nj = j - half;
      H_mat[i*N+j] = (i === j) ? q_i*q_i : V_fourier(ni - nj);
    }
  }
  var res = jacobi_eigen(H_mat.slice(), N);
  eigen_vals = res.values;
  eigen_vecs = res.vectors.map(function(vec) {
    var max_abs = 0, sign = 1;
    vec.forEach(function(c) { if (Math.abs(c) > max_abs) { max_abs = Math.abs(c); sign = c < 0 ? -1 : 1; }});
    return vec.map(function(c) { return sign * c; });
  });

  // ── Rang Y complet (estable, basat en el mode més extern a k=G/2) ──
  var new_E_full = Math.pow((0.5 + half) * G, 2) * 1.35 + 1;

  // ── Rang Y compartit (bandes 0 i 1, calculat a k=0) ──
  var Hk0 = new Array(N * N).fill(0);
  for (var i = 0; i < N; i++) {
    var ni0 = i - half;
    for (var j = 0; j < N; j++)
      Hk0[i*N+j] = (i === j) ? Math.pow(ni0*G, 2) : V_fourier(ni0 - (j - half));
  }
  var rk0 = jacobi_eigen(Hk0, N);
  E_shared_ymax = rk0.values[Math.min(1, N-1)] * 1.25 + 0.5;

  // Inicialitzem o resetegem viewport si N ha canviat
  if (viewport.y_max < 0 || Math.abs(new_E_full - E_full_ymax) > 10) {
    viewport.y_min = 0;
    viewport.y_max = E_shared_ymax;
  }
  E_full_ymax = new_E_full;

  // ── Precomputa estructura de bandes per a tot k ∈ [0, G/2] ──
  bands_data = [];
  for (var b = 0; b < N; b++) bands_data.push([]);
  for (var ki = 0; ki <= VP_NK; ki++) {
    var kv = (ki / VP_NK) * G / 2;
    var Hi = new Array(N * N).fill(0);
    for (var ii = 0; ii < N; ii++) {
      var nii = ii - half;
      for (var jj = 0; jj < N; jj++)
        Hi[ii*N+jj] = (ii === jj) ? Math.pow(kv + nii*G, 2) : V_fourier(nii - (jj - half));
    }
    var ri = jacobi_eigen(Hi, N);
    for (var b = 0; b < N; b++) bands_data[b].push(ri.values[b]);
  }

  // ── Mínim de la banda 0 (ara bands_data ja existeix) ──
  var E0_min = Infinity;
  for (var ki = 0; ki <= VP_NK; ki++) E0_min = Math.min(E0_min, bands_data[0][ki]);
  var new_E_full_min = E0_min < 0 ? E0_min * 1.15 - 0.5 : 0;
  if (new_E_full_min < viewport.y_min) viewport.y_min = new_E_full_min;
  E_full_ymin = new_E_full_min;
}

// ═══════════════════════════════════════════════════
//  GRÀFIC A: Selector d'harmònics
// ═══════════════════════════════════════════════════
function draw_harmonic_selector(canvas) {
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  var n_max = N_HARM_MAX;          // tots els harmònics disponibles
  var n_mat = state.N - 1;        // fins aquí entren a la matriu H (límit físic)

  var pad = { l: 28, r: 8, t: 30, b: 26 };
  var pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  var barStep = pw / n_max, barW = Math.max(3, barStep * 0.52);

  // Escala Y
  var max_v = 0;
  for (var n = 1; n <= n_max; n++) max_v = Math.max(max_v, Math.abs(V_harm[n] || 0));
  if (max_v < 0.01) max_v = 1;
  var has_neg = false;
  for (var n = 1; n <= n_max; n++) if ((V_harm[n] || 0) < 0) { has_neg = true; break; }
  var y_zero  = has_neg ? pad.t + ph * 0.5 : pad.t + ph;
  var scale_y = has_neg ? ph * 0.42 / max_v : ph * 0.85 / max_v;
  function vToY(v) { return y_zero - v * scale_y; }

  // Fons zona activa a H (lleuger verd)
  if (n_mat > 0) {
    ctx.fillStyle = 'rgba(0,150,57,0.05)';
    ctx.fillRect(pad.l, pad.t, barStep * n_mat, ph);
  }

  // Eixos
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ph);
  ctx.lineTo(pad.l + pw, pad.t + ph); ctx.stroke();

  if (has_neg) {
    ctx.strokeStyle = '#ddd'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pad.l, y_zero); ctx.lineTo(pad.l + pw, y_zero); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Línia divisòria H | V(x)
  if (n_mat > 0 && n_mat < n_max) {
    var x_div = pad.l + barStep * n_mat;
    ctx.strokeStyle = 'rgba(80,80,80,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x_div, pad.t - 2); ctx.lineTo(x_div, pad.t + ph); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Etiquetes de zona (al marge superior)
  ctx.font = '7px Arial'; ctx.textAlign = 'center';
  if (n_mat > 0) {
    ctx.fillStyle = 'rgba(0,114,43,0.7)';
    ctx.fillText('← en H →', pad.l + barStep * n_mat / 2, pad.t - 3);
  }
  if (n_mat < n_max) {
    ctx.fillStyle = 'rgba(100,100,100,0.6)';
    var x_mid_right = pad.l + barStep * n_mat + (pw - barStep * n_mat) / 2;
    ctx.fillText('← sols V(x) →', x_mid_right, pad.t - 3);
  }

  // Barres
  for (var n = 1; n <= n_max; n++) {
    var v = V_harm[n] || 0;
    var is_sel = (n === selected_harm);
    var in_mat = (n <= n_mat);
    var bx = pad.l + barStep * (n - 0.5) - barW / 2;
    var bh = Math.abs(v) * scale_y;
    var by = v >= 0 ? vToY(v) : y_zero;

    ctx.fillStyle  = is_sel ? '#e67e22' : (in_mat ? '#2980b9' : '#95a5a6');
    ctx.globalAlpha = is_sel ? 1.0 : (in_mat ? 0.65 : 0.40);
    ctx.fillRect(bx, by, barW, bh);
    ctx.globalAlpha = 1;

    if (is_sel) {
      ctx.strokeStyle = '#d35400'; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx - 1, Math.min(by, y_zero) - 1, barW + 2, bh + 2);
    }

    // Número (eix x)
    ctx.fillStyle   = is_sel ? '#d35400' : (in_mat ? '#444' : '#999');
    ctx.font        = is_sel ? 'bold 7px Arial' : '7px Arial';
    ctx.textAlign   = 'center';
    ctx.fillText(n, bx + barW / 2, pad.t + ph + 14);

    // Valor (damunt de la barra)
    if (Math.abs(v) > 0.05) {
      var lbl_y = v >= 0 ? Math.max(vToY(v) - 2, pad.t + 10) : y_zero + bh + 10;
      ctx.fillStyle = is_sel ? '#d35400' : (in_mat ? '#333' : '#888');
      ctx.font = '7px Arial';
      ctx.fillText(v.toFixed(1), bx + barW / 2, lbl_y);
    }
  }
}

// ═══════════════════════════════════════════════════
//  GRÀFIC 0: Potencial V(x)
// ═══════════════════════════════════════════════════
function draw_potential(canvas) {
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  var n_max = N_HARM_MAX, n_cells = 5, a = 1, x_max = n_cells*a, n_pts = 600;
  var xs=[], v_total=[], v_parts=[];
  for (var n=1;n<=n_max;n++) v_parts.push([]);
  var v_max=0, v_min=0;
  for (var j=0;j<=n_pts;j++){
    var x=j*x_max/n_pts, vtot=0;
    for (var n=1;n<=n_max;n++){
      var vn=(V_harm[n]||0)*Math.cos(n*G*x);
      v_parts[n-1].push(vn); vtot+=vn;
    }
    xs.push(x); v_total.push(vtot);
    if(vtot>v_max) v_max=vtot; if(vtot<v_min) v_min=vtot;
  }
  var range=Math.max(Math.abs(v_max),Math.abs(v_min),0.05);
  var pad={l:38,r:14,t:8,b:24}, pw=W-pad.l-pad.r, ph=H-pad.t-pad.b;
  function xpx(x){return pad.l+x/x_max*pw;}
  function vpy(v){return pad.t+ph*0.5-v/range*ph*0.44;}
  for(var c=0;c<=n_cells;c++){ctx.strokeStyle='rgba(0,150,57,0.10)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xpx(c*a),pad.t);ctx.lineTo(xpx(c*a),pad.t+ph);ctx.stroke();}
  ctx.strokeStyle='#e0e0e0';ctx.lineWidth=0.8;ctx.beginPath();ctx.moveTo(pad.l,vpy(0));ctx.lineTo(pad.l+pw,vpy(0));ctx.stroke();
  for(var n=1;n<=n_max;n++){
    var is_sel=(n===selected_harm), vn_arr=v_parts[n-1];
    ctx.strokeStyle=is_sel?'#e67e22':'rgba(150,150,150,0.40)';
    ctx.lineWidth=is_sel?1.8:0.9;
    if(!is_sel) ctx.setLineDash([4,3]);
    ctx.beginPath();
    for(var j=0;j<=n_pts;j++){var x2=xpx(xs[j]),y2=vpy(vn_arr[j]);if(j===0)ctx.moveTo(x2,y2);else ctx.lineTo(x2,y2);}
    ctx.stroke();ctx.setLineDash([]);
  }
  ctx.beginPath();ctx.moveTo(xpx(xs[0]),vpy(0));
  for(var j=0;j<=n_pts;j++) ctx.lineTo(xpx(xs[j]),vpy(v_total[j]));
  ctx.lineTo(xpx(xs[n_pts]),vpy(0));ctx.closePath();
  ctx.fillStyle='rgba(142,68,173,0.10)';ctx.fill();
  ctx.strokeStyle='#8e44ad';ctx.lineWidth=2.2;
  ctx.beginPath();
  for(var j=0;j<=n_pts;j++){var x2=xpx(xs[j]),y2=vpy(v_total[j]);if(j===0)ctx.moveTo(x2,y2);else ctx.lineTo(x2,y2);}
  ctx.stroke();
  ctx.fillStyle='#8e44ad';ctx.font='bold 10px Arial';ctx.textAlign='left';ctx.fillText('V(x)',pad.l+3,pad.t+12);
  ctx.fillStyle='#aaa';ctx.font='8px Arial';ctx.textAlign='right';
  ctx.fillText('+'+range.toFixed(1),pad.l-3,vpy(range*0.9)+4);
  ctx.fillText((-range).toFixed(1),pad.l-3,vpy(-range*0.9)+4);
  ctx.fillStyle='#888';ctx.font='9px Arial';ctx.textAlign='center';
  for(var c=0;c<=n_cells;c++) ctx.fillText(c+'a',xpx(c*a),pad.t+ph+14);
}

// ═══════════════════════════════════════════════════
//  GRÀFIC 1: Paràbola E(q) = q²  (rang complet)
// ═══════════════════════════════════════════════════
function draw_parabola(canvas, p, band) {
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  var N = p.N, half = Math.floor(N / 2);
  var q_vals = [], E_free = [];
  for (var i = 0; i < N; i++) {
    var q = k_actual + (i - half) * G;
    q_vals.push(q); E_free.push(q*q);
  }

  var q_span = (half + 1.2) * G;
  var q_min = -q_span, q_max = q_span;
  var E_max_plot = E_full_ymax;
  var E_min_plot = E_full_ymin;
  var E_range = E_max_plot - E_min_plot;

  var pad = { l:48, r:20, t:22, b:36 };
  var pw = W-pad.l-pad.r, ph = H-pad.t-pad.b;

  function qx(q) { return pad.l + (q-q_min)/(q_max-q_min)*pw; }
  function Ey(E) { return pad.t + ph - (E - E_min_plot) / E_range * ph; }
  function E_from_y(y_px) { return E_min_plot + (pad.t + ph - y_px) / ph * E_range; }

  // ── Eixos ──
  ctx.strokeStyle='#bbb';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(pad.l,pad.t);ctx.lineTo(pad.l,pad.t+ph);ctx.lineTo(pad.l+pw,pad.t+ph);ctx.stroke();

  // Línia q=0
  var x0=qx(0);
  if(x0>pad.l&&x0<pad.l+pw){ctx.strokeStyle='#ddd';ctx.setLineDash([3,3]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,pad.t);ctx.lineTo(x0,pad.t+ph);ctx.stroke();ctx.setLineDash([]);}

  // Línia de referència E=0 quan el rang inclou valors negatius
  if (E_min_plot < 0) {
    var y0 = Ey(0);
    ctx.strokeStyle='#aaa';ctx.lineWidth=1;ctx.setLineDash([5,3]);
    ctx.beginPath();ctx.moveTo(pad.l,y0);ctx.lineTo(pad.l+pw,y0);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#999';ctx.font='8px Arial';ctx.textAlign='left';
    ctx.fillText('E=0',pad.l+2,y0-2);
  }

  // Ticks eix Y
  ctx.font='8px Arial';ctx.textAlign='right';ctx.fillStyle='#bbb';
  var n_ticks_y = 5;
  for (var t=0;t<=n_ticks_y;t++){
    var Et = E_min_plot + t/n_ticks_y * E_range;
    var yt = Ey(Et);
    ctx.strokeStyle='#f0f0f0';ctx.lineWidth=0.5;
    ctx.beginPath();ctx.moveTo(pad.l,yt);ctx.lineTo(pad.l+pw,yt);ctx.stroke();
    ctx.strokeStyle='#bbb';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad.l-3,yt);ctx.lineTo(pad.l,yt);ctx.stroke();
    ctx.fillStyle='#bbb';ctx.fillText(Et.toFixed(0),pad.l-5,yt+3);
  }

  // Paràbola
  ctx.strokeStyle='#009639';ctx.lineWidth=2.0;
  ctx.beginPath();var started=false;
  for(var j=0;j<=400;j++){
    var q_j=q_min+j*(q_max-q_min)/400, E_j=q_j*q_j;
    var x_j=qx(q_j),y_j=Ey(E_j);
    if(y_j<pad.t||y_j>pad.t+ph){started=false;continue;}
    if(!started){ctx.moveTo(x_j,y_j);started=true;}else ctx.lineTo(x_j,y_j);
  }
  ctx.stroke();

  // Línies d'acoblament
  var coeffs = eigen_vecs[band] || new Array(N).fill(1/Math.sqrt(N));
  for(var i=0;i<N;i++){
    for(var j=i+1;j<N;j++){
      var ni_i=i-half, ni_j=j-half;
      var vij=V_fourier(ni_i-ni_j);
      if(Math.abs(vij)<1e-10) continue;
      var dE=Math.abs(E_free[i]-E_free[j]);
      var mixing=Math.min(1,Math.abs(vij)/(dE+1e-3));
      var alpha=0.15+0.75*mixing;
      ctx.strokeStyle='rgba(180,60,30,'+alpha.toFixed(2)+')';
      ctx.lineWidth=1+3*mixing; ctx.setLineDash([5,3]);
      ctx.beginPath();ctx.moveTo(qx(q_vals[i]),Ey(E_free[i]));ctx.lineTo(qx(q_vals[j]),Ey(E_free[j]));ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Línia vertical al k actual
  ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=1;ctx.setLineDash([3,3]);
  ctx.beginPath();ctx.moveTo(qx(k_actual),pad.t);ctx.lineTo(qx(k_actual),pad.t+ph);ctx.stroke();ctx.setLineDash([]);

  // Nivells propis
  if(eigen_vals){
    eigen_vals.forEach(function(ev,bi){
      if(ev<0||ev>E_max_plot) return;
      var ey=Ey(ev);
      ctx.strokeStyle=bi===band?'rgba(0,114,43,0.45)':'rgba(0,0,0,0.08)';
      ctx.lineWidth=bi===band?2:1;ctx.setLineDash([2,4]);
      ctx.beginPath();ctx.moveTo(pad.l,ey);ctx.lineTo(pad.l+pw,ey);ctx.stroke();ctx.setLineDash([]);
      if(bi===band){ctx.fillStyle='#00722b';ctx.font='bold 9px Arial';ctx.textAlign='left';ctx.fillText('E'+bi+'='+ev.toFixed(2),pad.l+3,ey-3);}
    });
  }

  // ── Rectangle de viewport (arrossegable) ──
  var vy_top = Math.max(pad.t,   Ey(viewport.y_max));
  var vy_bot = Math.min(pad.t+ph, Ey(viewport.y_min));
  var HANDLE = 6;

  // Àrea interna
  ctx.fillStyle = 'rgba(0,150,57,0.07)';
  ctx.fillRect(pad.l, vy_top, pw, vy_bot - vy_top);

  // Vora i bandes de resize
  ctx.strokeStyle = 'rgba(0,150,57,0.65)'; ctx.lineWidth = 1.5; ctx.setLineDash([6,4]);
  ctx.strokeRect(pad.l, vy_top, pw, vy_bot - vy_top);
  ctx.setLineDash([]);

  // Bandes de resize (top i bottom)
  ctx.fillStyle = 'rgba(0,150,57,0.25)';
  ctx.fillRect(pad.l, vy_top, pw, HANDLE);
  ctx.fillRect(pad.l, vy_bot - HANDLE, pw, HANDLE);

  // Icones de fletxa als handles
  ctx.fillStyle = 'rgba(0,114,43,0.7)';
  ctx.font = '9px Arial'; ctx.textAlign = 'center';
  ctx.fillText('▲▼', pad.l + pw/2, vy_top + HANDLE - 1);
  ctx.fillText('▲▼', pad.l + pw/2, vy_bot - 1);

  // Etiqueta amb el rang visible
  var label_y = (vy_top + vy_bot) / 2;
  if (vy_bot - vy_top > 20) {
    ctx.fillStyle = 'rgba(0,114,43,0.55)'; ctx.font = '8px Arial'; ctx.textAlign = 'center';
    ctx.fillText(viewport.y_min.toFixed(1)+' – '+viewport.y_max.toFixed(1), pad.l+pw/2, label_y+3);
  }

  // Punts de color (ones planes)
  var weights = coeffs.map(function(c){return c*c;});
  for(var i=0;i<N;i++){
    var col=MODE_COLORS[i%MODE_COLORS.length];
    var n_i=i-half;
    var lbl=n_i===0?'k':(n_i>0?'k+'+n_i+'G':'k'+n_i+'G');

    if(E_free[i]>E_max_plot){
      // Indicador de mode fora del rang
      var arr_x=qx(q_vals[i]);
      if(arr_x>=pad.l&&arr_x<=pad.l+pw){
        ctx.fillStyle=col;
        ctx.beginPath();ctx.moveTo(arr_x-5,pad.t+9);ctx.lineTo(arr_x+5,pad.t+9);ctx.lineTo(arr_x,pad.t+1);ctx.closePath();ctx.fill();
        ctx.fillStyle=col;ctx.font='7px Arial';ctx.textAlign='center';ctx.fillText(lbl,arr_x,pad.t+18);
      }
      continue;
    }

    var x=qx(q_vals[i]),y=Ey(E_free[i]);
    var r_base=7+14*weights[i];
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,r_base,0,2*Math.PI);ctx.fill();
    ctx.strokeStyle='white';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,r_base,0,2*Math.PI);ctx.stroke();
    ctx.fillStyle=r_base>14?'white':'#333';ctx.font='bold 8px Arial';ctx.textAlign='center';ctx.fillText(lbl,x,y+3);
    ctx.fillStyle=col;ctx.font='9px Arial';ctx.fillText(E_free[i].toFixed(1),x,y-r_base-3);
  }

  // Etiquetes eixos
  ctx.fillStyle='#444';ctx.font='11px Arial';ctx.textAlign='center';
  ctx.fillText('q',pad.l+pw/2,H-5);
  ctx.save();ctx.translate(13,pad.t+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText('E = q²',0,0);ctx.restore();
}

// ═══════════════════════════════════════════════════
//  GRÀFIC 2: Estructura de bandes (usa viewport)
// ═══════════════════════════════════════════════════
function draw_bands(canvas, p, band) {
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (!bands_data || bands_data.length === 0) return;

  var N = p.N, half = Math.floor(N / 2);
  var n_k = VP_NK;
  var y_min = viewport.y_min, y_max = viewport.y_max;
  if (y_max <= y_min) return;

  var pad = { l:46, r:18, t:22, b:36 };
  var pw = W-pad.l-pad.r, ph = H-pad.t-pad.b;

  function kpx(ki) { return pad.l + ki/n_k * pw; }
  function Ey(E)   { return pad.t + ph - (E-y_min)/(y_max-y_min)*ph; }

  // Grid i eixos
  ctx.strokeStyle='#bbb';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(pad.l,pad.t);ctx.lineTo(pad.l,pad.t+ph);ctx.lineTo(pad.l+pw,pad.t+ph);ctx.stroke();

  // Línia de referència E=0 quan el viewport inclou valors negatius
  if (y_min < 0 && y_max > 0) {
    var y0 = Ey(0);
    ctx.strokeStyle='#bbb';ctx.lineWidth=1;ctx.setLineDash([5,3]);
    ctx.beginPath();ctx.moveTo(pad.l,y0);ctx.lineTo(pad.l+pw,y0);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#aaa';ctx.font='8px Arial';ctx.textAlign='right';
    ctx.fillText('0',pad.l-3,y0+3);
  }

  for(var t=0;t<=5;t++){
    var Et=y_min+t/5*(y_max-y_min),yt=Ey(Et);
    ctx.strokeStyle='#ececec';ctx.lineWidth=0.5;
    ctx.beginPath();ctx.moveTo(pad.l,yt);ctx.lineTo(pad.l+pw,yt);ctx.stroke();
    ctx.strokeStyle='#bbb';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad.l-3,yt);ctx.lineTo(pad.l,yt);ctx.stroke();
    ctx.fillStyle='#999';ctx.font='8px Arial';ctx.textAlign='right';
    ctx.fillText(Et.toFixed(1),pad.l-5,yt+3);
  }

  // Electrons lliures (puntejat)
  ctx.setLineDash([3,4]);ctx.lineWidth=1.2;
  for(var i=0;i<N;i++){
    var ni_i=i-half;
    ctx.strokeStyle=MODE_COLORS[i%MODE_COLORS.length];ctx.globalAlpha=0.35;
    ctx.beginPath();var started=false;
    for(var ki=0;ki<=n_k;ki++){
      var k_i=(ki/n_k)*G/2, E_fr=Math.pow(k_i+ni_i*G,2);
      if(E_fr<y_min||E_fr>y_max){started=false;continue;}
      var x=kpx(ki),y=Ey(E_fr);
      if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);ctx.globalAlpha=1;

  // Bandes reals (de bands_data)
  for(var b=0;b<N;b++){
    var is_sel=(b===band);
    ctx.strokeStyle=is_sel?'#00722b':'rgba(0,114,43,0.28)';
    ctx.lineWidth=is_sel?2.5:1.2;
    ctx.beginPath();var started=false;
    for(var ki=0;ki<=n_k;ki++){
      var E=bands_data[b][ki];
      if(E<y_min||E>y_max){started=false;continue;}
      var x=kpx(ki),y=Ey(E);
      if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }

  // Anotació del gap
  if(N>=2){
    var E0bz=bands_data[0][n_k], E1bz=bands_data[1][n_k], gap=E1bz-E0bz;
    if(E0bz>=y_min&&E1bz<=y_max&&gap>0.01){
      var xbz=kpx(n_k),y0=Ey(E0bz),y1=Ey(E1bz);
      ctx.strokeStyle='#c0392b';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(xbz+4,y1);ctx.lineTo(xbz+9,y1);ctx.lineTo(xbz+9,y0);ctx.lineTo(xbz+4,y0);ctx.stroke();
      ctx.fillStyle='#c0392b';ctx.font='bold 7px Arial';ctx.textAlign='left';
      ctx.fillText('Δ='+gap.toFixed(2),xbz+11,(y0+y1)/2+3);
    }
  }

  // Línia k actual + punt banda seleccionada
  var cur_x=kpx(p.k_frac*n_k);
  ctx.strokeStyle='rgba(0,0,0,0.20)';ctx.lineWidth=1;ctx.setLineDash([3,3]);
  ctx.beginPath();ctx.moveTo(cur_x,pad.t);ctx.lineTo(cur_x,pad.t+ph);ctx.stroke();ctx.setLineDash([]);
  if(eigen_vals&&eigen_vals[band]!==undefined){
    var E_cur=eigen_vals[band];
    if(E_cur>=y_min&&E_cur<=y_max){ctx.fillStyle='#00722b';ctx.beginPath();ctx.arc(cur_x,Ey(E_cur),5,0,2*Math.PI);ctx.fill();}
  }

  // Etiquetes
  ctx.fillStyle='#555';ctx.font='11px Arial';ctx.textAlign='center';ctx.fillText('k',pad.l+pw/2,H-5);
  ctx.fillStyle='#999';ctx.font='8px Arial';
  ctx.fillText('0',pad.l,pad.t+ph+14);ctx.fillText('G/2',pad.l+pw,pad.t+ph+14);
  ctx.save();ctx.translate(12,pad.t+ph/2);ctx.rotate(-Math.PI/2);
  ctx.fillStyle='#555';ctx.font='11px Arial';ctx.fillText('E',0,0);ctx.restore();
}

// ═══════════════════════════════════════════════════
//  GRÀFIC 3: Funció d'ona (dos modes: ones planes i descomposició Bloch)
// ═══════════════════════════════════════════════════
function draw_wavefunction(canvas, p, band) {
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  var N=p.N, half=Math.floor(N/2), n_cells=5, a=1, x_max=n_cells*a, n_pts=800;
  var coeffs=eigen_vecs[band]||new Array(N).fill(1/Math.sqrt(N));
  var q_vals=[];
  for(var i=0;i<N;i++) q_vals.push(k_actual+(i-half)*G);

  // Precomputa ψ(x) i u_k(x) = Σ c_n e^{inGx}  (|u_k| = |ψ| ja que |e^{ikx}|=1)
  var c_max=0;
  for(var i=0;i<N;i++) c_max=Math.max(c_max, Math.abs(coeffs[i]));

  var xs=[],re_arr=[],abs2_arr=[],re_uk_arr=[],abs_uk_arr=[],amp_max=0;
  for(var j=0;j<=n_pts;j++){
    var x=j*x_max/n_pts, re=0, im=0, re_uk=0, im_uk=0;
    for(var i=0;i<N;i++){
      var ni=i-half;
      re    += coeffs[i]*Math.cos(q_vals[i]*x);
      im    += coeffs[i]*Math.sin(q_vals[i]*x);
      re_uk += coeffs[i]*Math.cos(ni*G*x);
      im_uk += coeffs[i]*Math.sin(ni*G*x);
    }
    var abs_uk=Math.sqrt(re_uk*re_uk+im_uk*im_uk);
    xs.push(x); re_arr.push(re); abs2_arr.push(re*re+im*im);
    re_uk_arr.push(re_uk); abs_uk_arr.push(abs_uk);
    amp_max=Math.max(amp_max, Math.abs(re), abs_uk);
  }
  amp_max=Math.max(amp_max, c_max);   // perquè les línies c_n càpiguen a escala
  if(amp_max<1e-6) amp_max=1;

  var pad={l:38,r:14,t:10,b:28}, pw=W-pad.l-pad.r;
  var ph_re=Math.round((H-pad.t-pad.b-10)*0.55), ph_abs2=(H-pad.t-pad.b-10)-ph_re;
  var y_re_mid=pad.t+ph_re/2, y_abs2_top=pad.t+ph_re+10;
  function xpx(x){return pad.l+x/x_max*pw;}
  function repy(v){return y_re_mid-v/amp_max*(ph_re/2*0.88);}
  function a2py(v){return y_abs2_top+ph_abs2-v/(amp_max*amp_max)*ph_abs2*0.88;}

  // Separadors de cel·la
  for(var c=0;c<=n_cells;c++){
    ctx.strokeStyle='rgba(0,150,57,0.12)';ctx.lineWidth=1;
    var cxc=xpx(c*a);
    ctx.beginPath();ctx.moveTo(cxc,pad.t);ctx.lineTo(cxc,pad.t+ph_re+10+ph_abs2);ctx.stroke();
  }

  if(view_mode==='planes'){
    // ── Vista ones planes: ψ = Σ c_n e^{iq_n x}, q_n = k+nG (mateixos modes que panel C) ──
    var van_sel = (selected_mode !== null);
    for(var i=0;i<N;i++){
      var ni=i-half, hl=(van_sel && ni===selected_mode);
      var col = MODE_COLORS[i%MODE_COLORS.length];   // sempre el color original (= panel C i F)
      // Halo darrere del mode ressaltat
      if(hl){
        ctx.strokeStyle=col; ctx.globalAlpha=0.25; ctx.lineWidth=7;
        ctx.beginPath();
        for(var j=0;j<=n_pts;j++){
          var re_i=coeffs[i]*Math.cos(q_vals[i]*xs[j]);
          var cxj=xpx(xs[j]),cyj=repy(re_i);
          if(j===0) ctx.moveTo(cxj,cyj); else ctx.lineTo(cxj,cyj);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = col;
      ctx.globalAlpha = van_sel ? (hl ? 1.0 : 0.18) : 0.55;
      ctx.lineWidth   = hl ? 2.5 : 0.9;
      ctx.beginPath();
      for(var j=0;j<=n_pts;j++){
        var re_i = coeffs[i]*Math.cos(q_vals[i]*xs[j]);   // c_n·cos(q_n·x)
        var cxj=xpx(xs[j]), cyj=repy(re_i);
        if(j===0) ctx.moveTo(cxj,cyj); else ctx.lineTo(cxj,cyj);
      }
      ctx.stroke(); ctx.globalAlpha=1;
    }
    ctx.strokeStyle='#009639';ctx.lineWidth=2.2;
    ctx.beginPath();
    for(var j=0;j<=n_pts;j++){
      var cxj=xpx(xs[j]),cyj=repy(re_arr[j]);   // Re(ψ) = suma total
      if(j===0) ctx.moveTo(cxj,cyj); else ctx.lineTo(cxj,cyj);
    }
    ctx.stroke();
    ctx.strokeStyle='#ddd';ctx.lineWidth=0.8;
    ctx.beginPath();ctx.moveTo(pad.l,y_re_mid);ctx.lineTo(pad.l+pw,y_re_mid);ctx.stroke();
    ctx.fillStyle='#009639';ctx.font='bold 10px Arial';ctx.textAlign='left';
    ctx.fillText('Re(ψ)',pad.l+3,pad.t+10);

  } else {
    // ── Vista descomposició Bloch: ±|u_k|, Re(u_k), Re(ψ) ──
    // Re(e^{ikx}) = cos(kx) — ona plana de l'electró lliure  (taronja)
    ctx.strokeStyle='#e67e22';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);
    ctx.beginPath();
    for(var j=0;j<=n_pts;j++){
      var cxj=xpx(xs[j]),cyj=repy(Math.cos(k_actual*xs[j]));
      if(j===0) ctx.moveTo(cxj,cyj); else ctx.lineTo(cxj,cyj);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Re(u_k(x))  (blau)
    ctx.strokeStyle='#2980b9';ctx.lineWidth=1.8;
    ctx.beginPath();
    for(var j=0;j<=n_pts;j++){
      var cxj=xpx(xs[j]),cyj=repy(re_uk_arr[j]);
      if(j===0) ctx.moveTo(cxj,cyj); else ctx.lineTo(cxj,cyj);
    }
    ctx.stroke();
    // Re(ψ)  (verd gruixut)
    ctx.strokeStyle='#009639';ctx.lineWidth=2.2;
    ctx.beginPath();
    for(var j=0;j<=n_pts;j++){
      var cxj=xpx(xs[j]),cyj=repy(re_arr[j]);
      if(j===0) ctx.moveTo(cxj,cyj); else ctx.lineTo(cxj,cyj);
    }
    ctx.stroke();
    ctx.strokeStyle='#ddd';ctx.lineWidth=0.8;
    ctx.beginPath();ctx.moveTo(pad.l,y_re_mid);ctx.lineTo(pad.l+pw,y_re_mid);ctx.stroke();
    // Etiqueta mínima al canvas (llegenda completa al plot-desc HTML)
    ctx.fillStyle='#009639';ctx.font='bold 10px Arial';ctx.textAlign='left';
    ctx.fillText('Re(ψ)',pad.l+3,pad.t+10);
  }

  // |ψ|² (comuna a les dues vistes; en Bloch mode = |u_k|²)
  ctx.beginPath();ctx.moveTo(xpx(xs[0]),a2py(0));
  for(var j=0;j<=n_pts;j++) ctx.lineTo(xpx(xs[j]),a2py(abs2_arr[j]));
  ctx.lineTo(xpx(xs[n_pts]),a2py(0));ctx.closePath();
  ctx.fillStyle='rgba(0,150,57,0.18)';ctx.fill();
  ctx.strokeStyle='#009639';ctx.lineWidth=1.8;ctx.stroke();
  ctx.fillStyle='#009639';ctx.font='bold 10px Arial';ctx.textAlign='left';
  ctx.fillText(view_mode==='bloch'?'|u_k|² = |ψ|²':'|ψ|²', pad.l+3, y_abs2_top+12);

  ctx.fillStyle='#555';ctx.font='10px Arial';ctx.textAlign='center';
  for(var c=0;c<=n_cells;c++) ctx.fillText(c+'a',xpx(c*a),H-5);
}

// ═══════════════════════════════════════════════════
//  GRÀFIC 4: Matriu
// ═══════════════════════════════════════════════════
function draw_matrix(canvas, p, band) {
  var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  var N = p.N, half = Math.floor(N / 2);
  var pad = { l: 28, r: 8, t: 28, b: 8 };
  var pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  var cell = Math.min(pw, ph) / N;

  var d_max = 0, od_max = 0;
  for (var i = 0; i < N; i++) {
    d_max = Math.max(d_max, Math.abs(H_mat[i * N + i]));
    for (var j = 0; j < N; j++)
      if (i !== j) od_max = Math.max(od_max, Math.abs(H_mat[i * N + j]));
  }
  if (d_max  < 1e-9) d_max  = 1;
  if (od_max < 1e-9) od_max = 1;

  var coeffs  = eigen_vecs[band] || new Array(N).fill(1 / Math.sqrt(N));
  var weights = coeffs.map(function(c) { return c * c; });

  // Ressaltat de fila i columna sota el cursor
  var hi = matrix_hover.i, hj = matrix_hover.j;
  if (hi >= 0 && hi < N && hj >= 0 && hj < N) {
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(pad.l,          pad.t + hi * cell, pw,   cell);   // fila
    ctx.fillRect(pad.l + hj * cell, pad.t,          cell, ph);     // columna
  }

  // Cel·les
  for (var i = 0; i < N; i++) {
    for (var j = 0; j < N; j++) {
      var val = H_mat[i * N + j];
      var cx = pad.l + j * cell, cy = pad.t + i * cell;
      var r, g, b;
      if (i === j) {
        var t = val / d_max;
        r = Math.round(230 - 180*t); g = Math.round(245 - 100*t); b = Math.round(230 - 200*t);
      } else if (Math.abs(val) > 1e-10) {
        var t = Math.abs(val) / od_max;
        r = 245; g = Math.round(160 + 50*t); b = 60;
      } else {
        r = 248; g = 248; b = 248;
      }
      var hl = Math.max(weights[i], weights[j]);
      if (hl > 0.05) {
        r = Math.round(r*(1-0.2*hl) + 0  *0.2*hl);
        g = Math.round(g*(1-0.2*hl) + 122*0.2*hl);
        b = Math.round(b*(1-0.2*hl) + 51 *0.2*hl);
      }
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fillRect(cx, cy, cell - 1, cell - 1);

      // Valor numèric (si la cel·la és prou gran)
      if (cell > 20) {
        ctx.fillStyle = ((r + g + b) / 3 > 160) ? '#333' : '#fff';
        ctx.font = cell > 35 ? '9px Arial' : '7px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(val.toFixed(1), cx + cell/2 - 0.5, cy + cell/2 + 3.5);
      }
    }
  }

  // Borde fort sobre la cel·la sota el cursor
  if (hi >= 0 && hi < N && hj >= 0 && hj < N) {
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.strokeRect(pad.l + hj*cell + 1, pad.t + hi*cell + 1, cell - 2, cell - 2);
  }

  // Etiquetes de files i columnes
  for (var i = 0; i < N; i++) {
    var n = i - half, lbl = n === 0 ? 'k' : (n > 0 ? '+'+n+'G' : n+'G');
    ctx.fillStyle = MODE_COLORS[i % MODE_COLORS.length];
    ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
    ctx.fillText(lbl, pad.l + (i + 0.5)*cell, pad.t - 5);
    ctx.save();
    ctx.translate(pad.l - 5, pad.t + (i + 0.5)*cell);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(lbl, 0, 3.5);
    ctx.restore();
  }
}

// Actualitza el panell d'informació de la matriu
function update_matrix_info(i, j) {
  var div = document.getElementById('matrix_info');
  if (!div || !H_mat || i < 0) { if (div) div.innerHTML = ''; return; }
  var N = state.N, half = Math.floor(N / 2);
  var ni = i - half, nj = j - half;
  var val = H_mat[i * N + j];
  function lbl(n) { return n === 0 ? 'k' : (n > 0 ? 'k+' + n + 'G' : 'k' + n + 'G'); }
  var html;
  if (i === j) {
    html = '<strong>H[' + lbl(ni) + ']</strong> = (k' + (ni >= 0 ? '+' : '') + ni + 'G)² = <strong>' +
           val.toFixed(3) + '</strong>' +
           '&ensp;<span style="color:#888">energia cinètica mode n=' + ni + '</span>';
  } else {
    var dn = Math.abs(ni - nj);
    var active = Math.abs(val) > 1e-10;
    html = '<strong>H[' + lbl(ni) + ', ' + lbl(nj) + ']</strong> = V<sub>' + dn + '</sub> = <strong>' +
           val.toFixed(3) + '</strong>';
    if (!active) html += ' &ensp;<span style="color:#aaa">(harmònic inactiu)</span>';
    else         html += ' &ensp;<span style="color:#888">acoblament |Δn|=' + dn + '</span>';
  }
  div.innerHTML = html;
}

// ═══════════════════════════════════════════════════
//  GRÀFIC 5: Pesos
// ═══════════════════════════════════════════════════
function draw_weights(canvas, p, band) {
  var ctx=canvas.getContext('2d'), W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  var N=p.N, half=Math.floor(N/2);
  var coeffs=eigen_vecs[band]||new Array(N).fill(1/Math.sqrt(N));
  var weights=coeffs.map(function(c){return c*c;});
  var pad={l:34,r:10,t:12,b:24}, pw=W-pad.l-pad.r, ph=H-pad.t-pad.b;
  var barStep=pw/N, barW=barStep*0.55;
  ctx.strokeStyle='#bbb';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,pad.t);ctx.lineTo(pad.l,pad.t+ph);ctx.lineTo(pad.l+pw,pad.t+ph);ctx.stroke();
  for(var i=0;i<N;i++){
    var barH=weights[i]*ph*0.92, bx=pad.l+barStep*(i+0.5)-barW/2, by=pad.t+ph-barH;
    ctx.fillStyle=MODE_COLORS[i%MODE_COLORS.length];ctx.fillRect(bx,by,barW,barH);
    var n=i-half,lbl=n===0?'k':(n>0?'+'+n+'G':n+'G');
    ctx.fillStyle='#444';ctx.font='8px Arial';ctx.textAlign='center';ctx.fillText(lbl,bx+barW/2,pad.t+ph+13);
    if(weights[i]>0.02){ctx.fillStyle='#555';ctx.font='8px Arial';ctx.fillText(weights[i].toFixed(2),bx+barW/2,Math.max(by-2,pad.t+10));}
  }
  var y_half=pad.t+ph-0.5*ph*0.92;
  ctx.strokeStyle='rgba(0,0,0,0.18)';ctx.lineWidth=1;ctx.setLineDash([3,3]);
  ctx.beginPath();ctx.moveTo(pad.l,y_half);ctx.lineTo(pad.l+pw,y_half);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#bbb';ctx.font='7px Arial';ctx.textAlign='right';ctx.fillText('0.5',pad.l-3,y_half+3);
  ctx.save();ctx.translate(11,pad.t+ph/2);ctx.rotate(-Math.PI/2);ctx.fillStyle='#555';ctx.font='9px Arial';ctx.textAlign='center';ctx.fillText('|cₙ|²',0,0);ctx.restore();
}

// ═══════════════════════════════════════════════════
//  Redibuix ràpid (viewport drag, sense recompute)
// ═══════════════════════════════════════════════════
function redraw_viewport() {
  var p = getParams();
  draw_parabola(document.getElementById('parabolaCanvas'), p, state.band);
  draw_bands(   document.getElementById('bandCanvas'),     p, state.band);
}

// ═══════════════════════════════════════════════════
//  Redibuix complet
// ═══════════════════════════════════════════════════
function redraw() {
  var p = getParams();
  compute(p);
  draw_harmonic_selector(document.getElementById('harmonicCanvas'));
  draw_potential(        document.getElementById('potentialCanvas'));
  draw_parabola(         document.getElementById('parabolaCanvas'),     p, state.band);
  draw_bands(            document.getElementById('bandCanvas'),         p, state.band);
  draw_wavefunction(     document.getElementById('wavefunctionCanvas'), p, state.band);
  draw_matrix(           document.getElementById('matrixCanvas'),       p, state.band);
  draw_weights(          document.getElementById('weightsCanvas'),      p, state.band);
  update_energy_display();
}

function rebuild_mode_buttons(N) {
  var row = document.getElementById('mode_sel_row');
  if (!row) return;
  row.innerHTML = '';
  var half = Math.floor(N / 2);
  for (var n = -half; n <= half; n++) {
    (function(nn) {
      var btn = document.createElement('button');
      btn.className = 'n-btn' + (nn === selected_mode ? ' active' : '');
      btn.textContent = nn === 0 ? 'k' : (nn > 0 ? '+' + nn + 'G' : nn + 'G');
      btn.addEventListener('click', function() {
        selected_mode = (selected_mode === nn) ? null : nn;
        rebuild_mode_buttons(state.N);
        update_wf_desc();
        draw_wavefunction(document.getElementById('wavefunctionCanvas'), getParams(), state.band);
      });
      row.appendChild(btn);
    })(n);
  }
  row.style.display = (view_mode === 'planes') ? '' : 'none';
}

function rebuild_band_buttons(N) {
  var row=document.getElementById('band_row'); row.innerHTML='';
  for(var b=0;b<N;b++){
    var btn=document.createElement('button');
    btn.className='band-btn'+(b===state.band?' active':'');
    btn.textContent=b; btn.dataset.band=b;
    btn.addEventListener('click',(function(bb){return function(){
      state.band=bb;
      document.querySelectorAll('.band-btn').forEach(function(el){el.classList.remove('active');});
      this.classList.add('active'); redraw();
    };})(b));
    row.appendChild(btn);
  }
}

function update_energy_display() {
  var div=document.getElementById('energy_display');
  if(!eigen_vals){div.textContent='—';return;}
  div.innerHTML=eigen_vals.map(function(e,i){
    var s=i===state.band?'font-weight:700;color:#00722b;':'';
    return '<span style="'+s+'">E<sub>'+i+'</sub>='+e.toFixed(3)+'</span>';
  }).join('&nbsp; ');
}

// ═══════════════════════════════════════════════════
//  Interacció arrossegament del viewport (paràbola)
// ═══════════════════════════════════════════════════
(function() {
  var canvas = document.getElementById('parabolaCanvas');
  var PAD_T = 22, PAD_B = 36, PAD_L = 48;
  var HANDLE_PX = 7;
  var MIN_FRAC   = 0.04;   // mínim rang com a fracció de E_full_ymax

  function get_ph() { return canvas.height - PAD_T - PAD_B; }

  function E_to_y(E) {
    return PAD_T + get_ph() - (E - E_full_ymin) / (E_full_ymax - E_full_ymin) * get_ph();
  }
  function y_to_E(y_px) {
    return E_full_ymin + (PAD_T + get_ph() - y_px) / get_ph() * (E_full_ymax - E_full_ymin);
  }
  function mouse_y_px(e) {
    var rect = canvas.getBoundingClientRect();
    return (e.clientY - rect.top) * (canvas.height / rect.height);
  }
  function hit_test(y_px) {
    var yt = E_to_y(viewport.y_max);
    var yb = E_to_y(viewport.y_min);
    if (Math.abs(y_px - yt) <= HANDLE_PX) return 'top';
    if (Math.abs(y_px - yb) <= HANDLE_PX) return 'bottom';
    if (y_px > yt && y_px < yb) return 'body';
    return null;
  }

  canvas.addEventListener('mousedown', function(e) {
    var my = mouse_y_px(e);
    var hit = hit_test(my);
    if (!hit) return;
    viewport.drag    = hit;
    viewport.drag_E0 = y_to_E(my);
    viewport.drag_vp0 = { y_min: viewport.y_min, y_max: viewport.y_max };
    e.preventDefault();
  });

  window.addEventListener('mousemove', function(e) {
    // Cursor hover (fins i tot sense drag)
    var rect = canvas.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom) {
      var my = mouse_y_px(e);
      var hit = hit_test(my);
      canvas.style.cursor = (hit === 'body') ? 'ns-resize' : (hit ? 'row-resize' : 'default');
    }

    if (!viewport.drag) return;

    var my = mouse_y_px(e);
    var dE = y_to_E(my) - viewport.drag_E0;
    var min_range = (E_full_ymax - E_full_ymin) * MIN_FRAC;

    if (viewport.drag === 'body') {
      var new_min = viewport.drag_vp0.y_min + dE;
      var new_max = viewport.drag_vp0.y_max + dE;
      if (new_min < E_full_ymin) { new_max -= (new_min - E_full_ymin); new_min = E_full_ymin; }
      if (new_max > E_full_ymax) { new_min -= (new_max - E_full_ymax); new_max = E_full_ymax; }
      viewport.y_min = Math.max(E_full_ymin, new_min);
      viewport.y_max = Math.min(E_full_ymax, new_max);
    } else if (viewport.drag === 'top') {
      viewport.y_max = Math.min(E_full_ymax,
                        Math.max(viewport.y_min + min_range,
                                 viewport.drag_vp0.y_max + dE));
    } else if (viewport.drag === 'bottom') {
      viewport.y_min = Math.max(E_full_ymin,
                        Math.min(viewport.y_max - min_range,
                                 viewport.drag_vp0.y_min + dE));
    }

    redraw_viewport();
    e.preventDefault();
  });

  window.addEventListener('mouseup', function() {
    viewport.drag = null;
  });
})();

// ═══════════════════════════════════════════════════
//  Event listeners
// ═══════════════════════════════════════════════════

// k slider
(function(){
  var sl=document.getElementById('k_slider'),dv=document.getElementById('k_val');
  sl.addEventListener('input',function(){dv.textContent=parseFloat(sl.value).toFixed(2);redraw();});
})();

// Slider d'harmònic individual
document.getElementById('harm_slider').addEventListener('input', function() {
  V_harm[selected_harm] = parseFloat(this.value);
  document.getElementById('harm_val').textContent = parseFloat(this.value).toFixed(2);
  current_preset = null; update_preset_buttons(null); update_scale_ctrl_state();
  redraw();
});

// Slider d'escala global del preset
document.getElementById('scale_slider').addEventListener('input', function() {
  preset_scale = parseFloat(this.value);
  document.getElementById('scale_val').textContent = preset_scale.toFixed(2);
  if (current_preset) { apply_preset(current_preset); redraw(); }
});

// Click al canvas d'harmònics
(function(){
  var hcanvas=document.getElementById('harmonicCanvas');
  hcanvas.style.cursor='pointer';
  hcanvas.addEventListener('click',function(e){
    var rect=this.getBoundingClientRect();
    var x=(e.clientX-rect.left)*(this.width/rect.width);
    var n_max=N_HARM_MAX;
    var pad_l=28,pad_r=8,pw=this.width-pad_l-pad_r,barStep=pw/n_max;
    var clicked_n=Math.floor((x-pad_l)/barStep)+1;
    if(clicked_n>=1&&clicked_n<=n_max){
      selected_harm=clicked_n; update_harm_slider_ui();
      // Cross-panel: selecciona automàticament el mode n al panell B (si està dins la matriu)
      if(view_mode==='planes' && clicked_n<=Math.floor(state.N/2)){
        selected_mode=clicked_n; rebuild_mode_buttons(state.N);
      }
      redraw();
    }
  });
})();

// Presets
document.querySelectorAll('.preset-btn').forEach(function(btn){
  btn.addEventListener('click',function(){apply_preset(this.dataset.preset);redraw();});
});

// Botons N (restringit a #n_row per no interferir amb .nh-btn que també té classe n-btn)
document.querySelectorAll('#n_row .n-btn').forEach(function(btn){
  btn.addEventListener('click',function(){
    var newN=parseInt(this.dataset.n);
    document.querySelectorAll('#n_row .n-btn').forEach(function(b){b.classList.remove('active');});
    this.classList.add('active');
    state.N=newN; if(state.band>=newN) state.band=0;
    selected_harm=Math.min(selected_harm,N_HARM_MAX);
    var new_half=Math.floor(newN/2);
    if(selected_mode!==null && Math.abs(selected_mode)>new_half) selected_mode=null;
    if(current_preset) apply_preset(current_preset);
    rebuild_band_buttons(newN);
    rebuild_mode_buttons(newN);
    update_wf_desc();
    redraw();
  });
});

// Botons N_HARM_MAX
document.querySelectorAll('.nh-btn').forEach(function(btn){
  btn.addEventListener('click', function(){
    var nh = parseInt(this.dataset.nh);
    document.querySelectorAll('.nh-btn').forEach(function(b){ b.classList.remove('active'); });
    this.classList.add('active');
    while (V_harm.length <= nh) V_harm.push(0);
    N_HARM_MAX = nh;
    if (selected_harm > N_HARM_MAX) { selected_harm = N_HARM_MAX; update_harm_slider_ui(); }
    if (current_preset) apply_preset(current_preset);
    else redraw();
  });
});

// Hovering sobre la matriu
(function(){
  var mcanvas = document.getElementById('matrixCanvas');
  mcanvas.style.cursor = 'crosshair';
  mcanvas.addEventListener('mousemove', function(e){
    if (!H_mat) return;
    var rect = this.getBoundingClientRect();
    var mx = (e.clientX - rect.left) * (this.width  / rect.width);
    var my = (e.clientY - rect.top)  * (this.height / rect.height);
    var N = state.N, pad = {l:28, r:8, t:28, b:8};
    var cell = Math.min(this.width-pad.l-pad.r, this.height-pad.t-pad.b) / N;
    var j = Math.floor((mx - pad.l) / cell);
    var i = Math.floor((my - pad.t) / cell);
    if (i >= 0 && i < N && j >= 0 && j < N) {
      if (matrix_hover.i !== i || matrix_hover.j !== j) {
        matrix_hover.i = i; matrix_hover.j = j;
        draw_matrix(mcanvas, getParams(), state.band);
        update_matrix_info(i, j);
      }
    } else if (matrix_hover.i >= 0) {
      matrix_hover.i = -1; matrix_hover.j = -1;
      draw_matrix(mcanvas, getParams(), state.band);
      update_matrix_info(-1, -1);
    }
  });
  mcanvas.addEventListener('mouseleave', function(){
    if (matrix_hover.i >= 0) {
      matrix_hover.i = -1; matrix_hover.j = -1;
      draw_matrix(mcanvas, getParams(), state.band);
      update_matrix_info(-1, -1);
    }
  });
})();

// ═══════════════════════════════════════════════════
//  Títols de gràfic plegables
// ═══════════════════════════════════════════════════
document.querySelectorAll('.collapsible-title').forEach(function(title) {
  title.addEventListener('click', function() {
    var card = this.closest('.card');
    var tri  = this.querySelector('.plot-tri');
    card.classList.toggle('collapsed');
    tri.textContent = card.classList.contains('collapsed') ? '▶' : '▼';
  });
});

// ═══════════════════════════════════════════════════
//  Activitats guiades
// ═══════════════════════════════════════════════════
var ACTIVITY_SETS = [
  {
    name: 'Gap en un potencial cosinus',
    desc: 'Com s\'obre un gap de banda al límit de zona de Brillouin.',
    steps: [
      {
        title: 'Pas 1 de 5 — Punt de degeneració',
        instruction: 'Posa <strong>k/(G/2) = 1</strong> (slider al màxim) i assegura\'t que el preset és <strong>Cosinus</strong> amb <strong>Escala = 0</strong>. Observa la paràbola i el gràfic de bandes.',
        observe: 'Els dos modes centrals de la paràbola (n=0 i n=−1) estan a la mateixa alçada. Les dues branques de bandes es toquen a k=G/2: és una degeneració. Sense potencial, els electrons lliures no distingeixen entre elles.'
      },
      {
        title: 'Pas 2 de 5 — Obrir el gap',
        instruction: 'Augmenta lentament l\'<strong>Escala</strong> del potencial fins a 5. Observa el gràfic de bandes mentre ho fas.',
        observe: 'El gap s\'obre a k=G/2. L\'anotació Δ mesura la seva amplada. Comprova que Δ ≈ 2·Escala: el potencial cosinus trenca la degeneració per exactament el doble del seu coeficient.'
      },
      {
        title: 'Pas 3 de 5 — Ona de la banda inferior',
        instruction: 'Mantén k=G/2 i selecciona la <strong>Banda 0</strong> (botó "0"). Mira la gràfica |&#x3C8;|&#xB2; a la secció inferior central.',
        observe: 'La densitat |&#x3C8;|&#xB2; s\'acumula a les posicions atòmiques (coincidint amb els màxims del potencial cosinus). L\'electró viu on el potencial és més atractiu → energia mínima.'
      },
      {
        title: 'Pas 4 de 5 — Ona de la banda superior',
        instruction: 'Selecciona ara la <strong>Banda 1</strong>. Compara la distribució de |&#x3C8;|&#xB2; amb el pas anterior.',
        observe: 'La densitat |&#x3C8;|&#xB2; s\'acumula entre àtoms, evitant les posicions atòmiques. L\'electró viu on el potencial és menys atractiu → energia més alta. Aquí rau l\'origen físic del gap.'
      },
      {
        title: 'Pas 5 de 5 — Connexió amb la matriu',
        instruction: 'Mira la <strong>matriu H</strong> i passa el cursor per les cel·les de color taronja per veure els seus valors.',
        observe: 'Amb un potencial cosinus pur (V₁ ≠ 0, resta = 0), només els elements amb |Δn|=1 són actius. Exactament aquests dos elements connecten els modes degenerats n=0 i n=−1 i originen el gap de 2V₁.'
      }
    ]
  },
  {
    name: 'Modes i acoblaments',
    desc: 'Per quins modes connecta la matriu H i per què només els separats per G.',
    steps: [
      {
        title: 'Pas 1 de 3 — Els N modes de la base',
        instruction: 'Posa <strong>N = 5</strong>, preset <strong>Cosinus</strong> amb <strong>Escala = 0</strong> i <strong>k/(G/2) = 0.5</strong>. Observa el panel C (paràbola). Compta els punts de colors i llegeix les seves etiquetes.',
        observe: 'Apareixen 5 punts de colors a la paràbola E(q) = q², cadascun en una posició q<sub>n</sub> = k + nG per a n = −2, −1, 0, +1, +2. Aquests N modes d\'ona plana formen la base sobre la qual la matriu H treballa. A la matriu H (panel E) veus una matriu 5×5 amb únicament la diagonal activa (energia cinètica).'
      },
      {
        title: 'Pas 2 de 3 — La matriu H connecta modes separats per G',
        instruction: 'Augmenta l\'<strong>Escala del cosinus fins a 3</strong> (V<sub>1</sub> ≠ 0). Observa la matriu H (panel E): quines cel·les s\'activen? Passa el cursor per sobre per llegir els valors. Fixa\'t en quins parells de punts del panel C queden connectats.',
        observe: 'Amb un potencial cosinus pur (V<sub>1</sub> ≠ 0, resta = 0), s\'activa únicament la primera diagonal: H[n, n±1] = V<sub>1</sub>. Això connecta parells de modes del panel C que difereixen exactament en ±G. En general, V<sub>m</sub> connecta modes separats en m·G: un potencial amb V<sub>2</sub> ≠ 0 connectaria la segona diagonal.'
      },
      {
        title: 'Pas 3 de 3 — Pou quadrat: més harmònics, més diagonals actives',
        instruction: 'Tria el preset <strong>Pou quadrat</strong> i observa la matriu H. Compta quantes diagonals estan actives. Augmenta N fins a <strong>9</strong> i repeteix l\'observació.',
        observe: 'El pou quadrat té V<sub>1</sub>, V<sub>2</sub>, V<sub>3</sub>,… tots no nuls, de manera que múltiples diagonals de H s\'activen. Cada diagonal m-èsima correspon a un vector de la xarxa recíproca mG i connecta tots els parells de modes separats en mG. Com més harmònics té el potencial, més modes queden acoblats entre si.'
      }
    ]
  },
  {
    name: 'Bandes i pesos dels modes',
    desc: 'Com el potencial barreja les ones planes i quin mode domina cada banda.',
    steps: [
      {
        title: 'Pas 1 de 3 — Sense potencial: cada banda és una ona plana pura',
        instruction: 'Posa <strong>Escala = 0</strong>, <strong>k/(G/2) = 0.5</strong>, <strong>N = 5</strong>. Selecciona les bandes 0, 1, 2, 3, 4 successivament amb els botons. Per a cada banda observa el panel F (pesos |c<sub>n</sub>|²) i el panel B (ones planes).',
        observe: 'Sense potencial, cada banda té un únic mode amb pes |c<sub>n</sub>|² = 1 i la resta zero: és una ona plana pura e<sup>iq<sub>n</sub>x</sup>. La banda 0 correspon al mode de menor energia cinètica, la banda 1 al segon, etc. Al panel B veus una sola línia de color.'
      },
      {
        title: 'Pas 2 de 3 — El potencial barreja els modes',
        instruction: 'Selecciona la <strong>banda 0</strong> i <strong>k/(G/2) = 0.5</strong>. Augmenta lentament l\'<strong>Escala del cosinus de 0 a 5</strong>. Observa com evolucionen els pesos (panel F) i les línies del panel B (ones planes).',
        observe: 'El potencial barreja els modes: el mode central (k, groguenc) perd pes progressivament mentre els modes veïns (+1G, −1G) en guanyen. La funció d\'ona deixa de ser una ona plana pura i es converteix en una combinació lineal: l\'estat de Bloch. Al panel B es veu com les línies dels modes veïns creixen.'
      },
      {
        title: 'Pas 3 de 3 — Potencial ric en harmònics → més modes actius',
        instruction: 'Canvia al preset <strong>Pou quadrat</strong> amb Escala = 2. Compara els pesos (panel F) amb els del cosinus. Ara augmenta N fins a <strong>9</strong> i observa com canvien els pesos i el panel B.',
        observe: 'El pou quadrat té V<sub>1</sub>, V<sub>2</sub>, V<sub>3</sub>,… tots no nuls, per tant barreja molts modes alhora. Amb N = 9, fins a 9 modes participen en la combinació lineal. Com més ric és el potencial en harmònics, més modes contribueixen a l\'estat de Bloch i més complex és el perfil de |ψ|².'
      }
    ]
  }
];

var act_set  = 0;
var act_step = 0;

function act_show_menu() {
  document.getElementById('act_menu').style.display  = '';
  document.getElementById('act_steps').style.display = 'none';
  // Dots buits mentre estem al menú
  document.getElementById('activity_dots').innerHTML = '';
  // Construeix la llista del menú
  var list = document.getElementById('act_menu_list');
  list.innerHTML = '';
  ACTIVITY_SETS.forEach(function(s, si) {
    var item = document.createElement('div');
    item.style.cssText = 'padding:8px 10px;margin-bottom:6px;border-radius:5px;cursor:pointer;' +
      'background:rgba(0,150,57,0.07);border:1px solid rgba(0,150,57,0.18);' +
      'transition:background 0.15s;';
    item.innerHTML = '<strong style="font-size:0.85rem;">' + s.name + '</strong>' +
      (s.desc ? '<p style="font-size:0.75rem;color:var(--muted);margin:2px 0 0;">' + s.desc + '</p>' : '');
    item.addEventListener('mouseenter', function(){ this.style.background='rgba(0,150,57,0.15)'; });
    item.addEventListener('mouseleave', function(){ this.style.background='rgba(0,150,57,0.07)'; });
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      act_set = si; act_step = 0;
      act_render();
      document.getElementById('act_menu').style.display  = 'none';
      document.getElementById('act_steps').style.display = '';
    });
    list.appendChild(item);
  });
}

function act_render() {
  var steps = ACTIVITY_SETS[act_set].steps;
  var t = steps[act_step];
  document.getElementById('act_title').innerHTML       = t.title;
  document.getElementById('act_instruction').innerHTML = t.instruction;
  document.getElementById('act_observe').innerHTML     = t.observe;
  document.getElementById('act_observe').style.display = 'none';
  document.getElementById('act_reveal').textContent    = 'Mostra l\'observació esperada ▸';

  document.getElementById('act_prev').disabled = (act_step === 0);
  var btn_next = document.getElementById('act_next');
  btn_next.textContent = (act_step === steps.length - 1) ? 'Finalitzar' : 'Següent →';

  var dots = document.getElementById('activity_dots');
  dots.innerHTML = '';
  steps.forEach(function(_, i) {
    var d = document.createElement('span');
    d.className = 'activity-dot' + (i === act_step ? ' active' : '');
    dots.appendChild(d);
  });
}

(function() {
  var body    = document.getElementById('activity_body');
  var toggle  = document.getElementById('activity_toggle');
  var reveal  = document.getElementById('act_reveal');
  var observe = document.getElementById('act_observe');
  var is_open = false;

  document.getElementById('activity_header').addEventListener('click', function() {
    is_open = !is_open;
    body.style.display = is_open ? 'block' : 'none';
    toggle.textContent = (is_open ? '▼' : '▶') + ' Activitats';
    if (is_open) act_show_menu();
  });

  document.getElementById('act_back').addEventListener('click', function(e) {
    e.stopPropagation();
    act_show_menu();
  });

  reveal.addEventListener('click', function(e) {
    e.stopPropagation();
    var visible = observe.style.display === 'block';
    observe.style.display = visible ? 'none' : 'block';
    reveal.textContent    = visible ? 'Mostra l\'observació esperada ▸' : 'Amaga l\'observació ▾';
  });

  document.getElementById('act_prev').addEventListener('click', function(e) {
    e.stopPropagation();
    if (act_step > 0) { act_step--; act_render(); }
  });

  document.getElementById('act_next').addEventListener('click', function(e) {
    e.stopPropagation();
    var steps = ACTIVITY_SETS[act_set].steps;
    if (act_step < steps.length - 1) {
      act_step++; act_render();
    } else {
      // Finalitzar: tornar al menú
      act_step = 0;
      act_show_menu();
    }
  });

  act_show_menu();
})();

// ═══════════════════════════════════════════════════
//  Toggle vista panell B
// ═══════════════════════════════════════════════════
function update_wf_desc() {
  var fml = document.getElementById('wf_formula');
  if (fml) {
    if (view_mode === 'planes') {
      fml.innerHTML =
        '&psi;<sub>k</sub>(x) = <span style="font-size:1.1em">&sum;</span><sub>n</sub> c<sub>n</sub> ' +
        'e<sup>i(k+nG)x</sup>';
    } else {
      fml.innerHTML =
        '&psi;<sub>k</sub>(x) = e<sup>ikx</sup> &thinsp;&middot;&thinsp; u<sub>k</sub>(x)' +
        '&emsp;amb&emsp;' +
        'u<sub>k</sub>(x) = <span style="font-size:1.1em">&sum;</span><sub>n</sub> c<sub>n</sub> ' +
        'e<sup>inGx</sup>';
    }
  }
  var el = document.getElementById('wf_desc');
  if (!el) return;
  if (view_mode === 'planes') {
    el.innerHTML = 'Línies de colors: c<sub>n</sub>&thinsp;cos(q<sub>n</sub>x) — mateixos modes que el panel C. ' +
      'Mode <strong>n=0</strong>: c<sub>0</sub>&thinsp;cos(kx) — l\'ona plana central. ' +
      'Clica un botó de mode per ressaltar-lo. ' +
      '<span style="color:#009639;font-weight:700">Verd gruixut</span>: Re(&psi;) = &sum;&thinsp;c<sub>n</sub>&thinsp;cos(q<sub>n</sub>x). ' +
      '&Agrave;rea: |&psi;|².';
  } else {
    el.innerHTML = '<span style="color:#e67e22;font-weight:700">Taronja puntejat</span>: ' +
      'Re(e<sup>ikx</sup>) = cos(kx) — ona plana de l\'electró lliure. ' +
      '<span style="color:#2980b9;font-weight:700">Blau</span>: Re(u<sub>k</sub>(x)) — part peri&ograve;dica (constant = 1 quan V = 0). ' +
      '<span style="color:#009639;font-weight:700">Verd gruixut</span>: Re(&psi;) = Re(e<sup>ikx</sup>&thinsp;u<sub>k</sub>). ' +
      'Quan V&nbsp;=&nbsp;0: la corba taronja i la verda coincideixen exactament.';
  }
}

document.querySelectorAll('[data-view]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    view_mode = this.dataset.view;
    document.querySelectorAll('[data-view]').forEach(function(b) { b.classList.remove('active'); });
    this.classList.add('active');
    rebuild_mode_buttons(state.N);   // mostra/amaga la fila de modes
    update_wf_desc();
    draw_wavefunction(document.getElementById('wavefunctionCanvas'), getParams(), state.band);
  });
});

// ═══════════════════════════════════════════════════
//  Arrencada
// ═══════════════════════════════════════════════════
rebuild_band_buttons(state.N);
rebuild_mode_buttons(state.N);
apply_preset('cosinus', preset_scale);   // inicialitza i posa scale_ctrl en estat actiu
update_wf_desc();
redraw();
