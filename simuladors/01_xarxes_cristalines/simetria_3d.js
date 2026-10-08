// Simulador — Grups puntuals dels 7 sistemes cristal·lins
//
// Cada sistema es representa per la seva cel·la convencional (un
// paral·lelepípede amb els paràmetres a,b,c,alpha,beta,gamma típics
// d'aquell sistema; l'hexagonal es dibuixa com a prisma hexagonal per
// ser reconeixible a ull) decorada amb un motiu asimètric (tetràedre
// escalè de 4 boles de colors) perquè cada operació sigui visible
// encara que la cel·la buida tingués aquella simetria per si sola.
//
// El lliscador interpola de la identitat (t=0) a l'operació completa
// (t=1): les rotacions pròpies (Cn, i la part rotacional de Sn)
// s'interpolen com a angle real (rotació rígida); les parts impròpies
// (sigma, i, i la reflexió de Sn) s'interpolen linealment component a
// component entre la matriu identitat i la matriu de l'operació —
// visualment el motiu es "aplana" i surt capgirat, la manera estàndard
// de representar aquestes operacions de manera contínua.

(function () {
  'use strict';

  const canvas = document.getElementById('canvas3d');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(480, 480);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfdfdfd);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(3.6, 2.6, 4.4);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  const deg2rad = d => d * Math.PI / 180;

  // ---------------------------------------------------------------
  // Matrius de les operacions de simetria (totes respecte de l'origen)
  // ---------------------------------------------------------------
  function rotationMatrix(axis, angleRad) {
    return new THREE.Matrix4().makeRotationAxis(axis.clone().normalize(), angleRad);
  }
  function reflectionMatrix(normal) {
    const n = normal.clone().normalize();
    const m = new THREE.Matrix4();
    m.set(
      1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.z, 0,
      -2 * n.x * n.y, 1 - 2 * n.y * n.y, -2 * n.y * n.z, 0,
      -2 * n.x * n.z, -2 * n.y * n.z, 1 - 2 * n.z * n.z, 0,
      0, 0, 0, 1
    );
    return m;
  }
  function lerpMatrices(A, B, t) {
    const ae = A.elements, be = B.elements, oe = new Array(16);
    for (let i = 0; i < 16; i++) oe[i] = ae[i] * (1 - t) + be[i] * t;
    return new THREE.Matrix4().fromArray(oe);
  }
  const I4 = new THREE.Matrix4();
  const INV4 = new THREE.Matrix4().makeScale(-1, -1, -1);

  function matrixAtT(op, t) {
    if (!op || op.kind === 'E') return new THREE.Matrix4();
    if (op.kind === 'C') return rotationMatrix(op.axis, deg2rad(op.angle) * t);
    if (op.kind === 'i') return lerpMatrices(I4, INV4, t);
    if (op.kind === 'sigma') return lerpMatrices(I4, reflectionMatrix(op.axis), t);
    if (op.kind === 'S') {
      const reflPart = lerpMatrices(I4, reflectionMatrix(op.axis), t);
      const rotPart = rotationMatrix(op.axis, deg2rad(op.angle) * t);
      return reflPart.multiply(rotPart);
    }
    return new THREE.Matrix4();
  }

  // ---------------------------------------------------------------
  // Motiu decoratiu: tetràedre escalè, 4 vèrtexs de colors diferents,
  // sense cap simetria pròpia.
  // ---------------------------------------------------------------
  const MOTIU_VERTEXS = [
    new THREE.Vector3(0.26, 0.09, 0.00),
    new THREE.Vector3(-0.04, 0.28, 0.10),
    new THREE.Vector3(-0.16, -0.07, 0.24),
    new THREE.Vector3(-0.09, -0.19, -0.19)
  ];
  const MOTIU_COLORS = [0xe74c3c, 0x27ae60, 0x2980b9, 0xf1c40f];
  const MOTIU_ARESTES = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

  function buildMotiu(offset, opacity, edgeColor) {
    const g = new THREE.Group();
    g.position.copy(offset);
    MOTIU_VERTEXS.forEach((v, i) => {
      const geo = new THREE.SphereGeometry(0.085, 14, 10);
      const mat = new THREE.MeshBasicMaterial({ color: MOTIU_COLORS[i], transparent: opacity < 1, opacity });
      const sph = new THREE.Mesh(geo, mat);
      sph.position.copy(v);
      g.add(sph);
    });
    MOTIU_ARESTES.forEach(([a, b]) => {
      const geo = new THREE.BufferGeometry().setFromPoints([MOTIU_VERTEXS[a], MOTIU_VERTEXS[b]]);
      const mat = new THREE.LineBasicMaterial({ color: edgeColor, transparent: opacity < 1, opacity });
      g.add(new THREE.Line(geo, mat));
    });
    return g;
  }

  // ---------------------------------------------------------------
  // Cel·la convencional: paral·lelepípede genèric a,b,c,alpha,beta,gamma
  // ---------------------------------------------------------------
  function cellVectors(a, b, c, alphaDeg, betaDeg, gammaDeg) {
    const alpha = deg2rad(alphaDeg), beta = deg2rad(betaDeg), gamma = deg2rad(gammaDeg);
    const v1 = new THREE.Vector3(a, 0, 0);
    const v2 = new THREE.Vector3(b * Math.cos(gamma), b * Math.sin(gamma), 0);
    const cx = c * Math.cos(beta);
    const cy = c * (Math.cos(alpha) - Math.cos(beta) * Math.cos(gamma)) / Math.sin(gamma);
    const rad2 = 1 - Math.cos(alpha) ** 2 - Math.cos(beta) ** 2 - Math.cos(gamma) ** 2
      + 2 * Math.cos(alpha) * Math.cos(beta) * Math.cos(gamma);
    const cz = c * Math.sqrt(Math.max(0, rad2)) / Math.sin(gamma);
    return { v1, v2, v3: new THREE.Vector3(cx, cy, cz) };
  }

  function parallelepipedVertices(v1, v2, v3) {
    const center = v1.clone().add(v2).add(v3).multiplyScalar(0.5);
    const verts = [];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
      verts.push(new THREE.Vector3()
        .addScaledVector(v1, i).addScaledVector(v2, j).addScaledVector(v3, k)
        .sub(center));
    }
    return verts; // index = i*4 + j*2 + k
  }
  function edgesLineSegments(pts, color) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: color !== 0x555555, opacity: color === 0x555555 ? 1 : 0.55 }));
  }
  function parallelepipedEdges(vertices, color) {
    const idx = (i, j, k) => i * 4 + j * 2 + k;
    const pts = [];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
      const p0 = vertices[idx(i, j, k)];
      if (i < 1) pts.push(p0, vertices[idx(i + 1, j, k)]);
      if (j < 1) pts.push(p0, vertices[idx(i, j + 1, k)]);
      if (k < 1) pts.push(p0, vertices[idx(i, j, k + 1)]);
    }
    return edgesLineSegments(pts, color);
  }

  function hexPrismVertices() {
    const r = 1.5, h = 1.3, verts = [];
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; verts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), h)); }
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; verts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), -h)); }
    return verts; // 0-5 top, 6-11 bottom
  }
  function hexPrismEdges(vertices, color) {
    const top = vertices.slice(0, 6), bot = vertices.slice(6, 12);
    const pts = [];
    for (let i = 0; i < 6; i++) pts.push(top[i], top[(i + 1) % 6]);
    for (let i = 0; i < 6; i++) pts.push(bot[i], bot[(i + 1) % 6]);
    for (let i = 0; i < 6; i++) pts.push(top[i], bot[i]);
    return edgesLineSegments(pts, color);
  }

  // ---------------------------------------------------------------
  // Comprovació numèrica: és `matrix` una simetria real d'aquesta
  // forma? Es transformen els vèrtexs i es comprova que el conjunt
  // transformat coincideix (com a conjunt, no ordenat) amb l'original.
  // ---------------------------------------------------------------
  const TOL = 0.02;
  function isSymmetry(matrix, vertices) {
    const used = new Array(vertices.length).fill(false);
    for (const v of vertices) {
      const tv = v.clone().applyMatrix4(matrix);
      let found = false;
      for (let i = 0; i < vertices.length; i++) {
        if (used[i]) continue;
        if (tv.distanceTo(vertices[i]) < TOL) { used[i] = true; found = true; break; }
      }
      if (!found) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------
  // Menú universal de 46 operacions candidates: els eixos/plans del
  // grup Oh (cub, 34) més la família de sis pròpia de l'hexagonal (C6,
  // C3-Z, S3, S6-Z i els C2/σ del pla XY a 30/60/120/150°, que cap
  // grup cúbic no té). S'aplica IGUAL a tots els sistemes; el que
  // canvia és quines d'aquestes són realment una simetria de cada
  // forma concreta (comprovat numèricament, no triat a mà).
  // ---------------------------------------------------------------
  function buildOperacionsUniversals() {
    const ax = V3(1, 0, 0), ay = V3(0, 1, 0), az = V3(0, 0, 1);
    const diags = [V3(1, 1, 1), V3(1, 1, -1), V3(1, -1, 1), V3(-1, 1, 1)];
    const faces = [V3(1, 1, 0), V3(1, -1, 0), V3(1, 0, 1), V3(1, 0, -1), V3(0, 1, 1), V3(0, 1, -1)];
    const ops = [{ label: 'E — identitat', kind: 'E' }];
    ['X', 'Y', 'Z'].forEach((n, i) => ops.push({ label: 'C4 — eix ' + n, kind: 'C', axis: [ax, ay, az][i], angle: 90 }));
    ['X', 'Y', 'Z'].forEach((n, i) => ops.push({ label: 'C2 — eix ' + n + ' (= C4²)', kind: 'C', axis: [ax, ay, az][i], angle: 180 }));
    diags.forEach((d, i) => ops.push({ label: 'C3 — diagonal (' + (i + 1) + '/4)', kind: 'C', axis: d, angle: 120 }));
    faces.forEach((f, i) => ops.push({ label: "C2' — diagonal de cara (" + (i + 1) + '/6)', kind: 'C', axis: f, angle: 180 }));
    ops.push({ label: 'i — inversió', kind: 'i' });
    ['X', 'Y', 'Z'].forEach((n, i) => ops.push({ label: 'S4 — eix ' + n, kind: 'S', axis: [ax, ay, az][i], angle: 90 }));
    diags.forEach((d, i) => ops.push({ label: 'S6 — diagonal (' + (i + 1) + '/4)', kind: 'S', axis: d, angle: 60 }));
    ['Z (pla XY)', 'X (pla YZ)', 'Y (pla XZ)'].forEach((n, i) => ops.push({ label: 'σh — ⊥ eix ' + n, kind: 'sigma', axis: [az, ax, ay][i] }));
    faces.forEach((f, i) => ops.push({ label: 'σd — diagonal de cara (' + (i + 1) + '/6)', kind: 'sigma', axis: f }));

    // --- família de sis (hexagonal): cap grup cúbic en té, però calen
    // per poder detectar de veritat les operacions de D6h ---
    const inPla = (deg) => V3(Math.cos(deg2rad(deg)), Math.sin(deg2rad(deg)), 0);
    ops.push({ label: 'C6 — eix Z', kind: 'C', axis: az, angle: 60 });
    ops.push({ label: 'C3 — eix Z (= C6²)', kind: 'C', axis: az, angle: 120 });
    [30, 60, 120, 150].forEach(a => ops.push({ label: 'C2 — pla XY a ' + a + '°', kind: 'C', axis: inPla(a), angle: 180 }));
    ops.push({ label: 'S3 — eix Z', kind: 'S', axis: az, angle: 120 });
    ops.push({ label: 'S6 — eix Z', kind: 'S', axis: az, angle: 60 });
    [30, 60, 120, 150].forEach(a => ops.push({ label: 'σ — vertical a ' + a + '° (conté Z)', kind: 'sigma', axis: inPla(a) }));

    return ops;
  }

  // ---------------------------------------------------------------
  // Definició dels 7 sistemes: només la seva cel·la convencional
  // (forma + vèrtexs + posició del motiu decoratiu). Les operacions ja
  // no es defineixen aquí — surten totes del menú universal de dalt,
  // comprovades numèricament contra els vèrtexs de cada forma.
  // ---------------------------------------------------------------
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
  const UNIVERSAL_OPS = buildOperacionsUniversals();

  function fromParallelepiped(v1, v2, v3, offsetFracs) {
    const vertices = parallelepipedVertices(v1, v2, v3);
    const center = v1.clone().add(v2).add(v3).multiplyScalar(0.5);
    const offset = v1.clone().multiplyScalar(offsetFracs[0])
      .add(v2.clone().multiplyScalar(offsetFracs[1]))
      .add(v3.clone().multiplyScalar(offsetFracs[2]))
      .sub(center);
    return { vertices, offset, cellFactory: (color) => parallelepipedEdges(vertices, color) };
  }

  function sistemaTriclinic() {
    const { v1, v2, v3 } = cellVectors(1.0, 1.25, 1.5, 75, 95, 110);
    return fromParallelepiped(v1, v2, v3, [0.28, 0.22, 0.18]);
  }
  function sistemaMonoclinic() {
    const { v1, v2, v3 } = cellVectors(1.0, 1.3, 1.6, 90, 105, 90);
    return fromParallelepiped(v1, v2, v3, [0.30, 0.22, 0.16]);
  }
  function sistemaOrthorhombic() {
    const { v1, v2, v3 } = cellVectors(1.0, 1.3, 1.7, 90, 90, 90);
    return fromParallelepiped(v1, v2, v3, [0.30, 0.24, 0.18]);
  }
  function sistemaTetragonal() {
    const { v1, v2, v3 } = cellVectors(1.2, 1.2, 1.8, 90, 90, 90);
    return fromParallelepiped(v1, v2, v3, [0.30, 0.22, 0.16]);
  }
  function sistemaTrigonal() {
    // El grup trigonal (D3d) té un eix C3 principal al llarg de v1+v2+v3.
    // Aquesta orientació és arbitrària de fàbrica; la girem rígidament
    // perquè aquest C3 coincideixi amb la diagonal (1,1,1) del menú
    // universal (i un dels seus C2, perpendiculars al C3, amb (1,-1,0),
    // que també hi és perpendicular) — així el menú universal detecta
    // realment les operacions d'aquest grup, no només E i i per atzar.
    let { v1, v2, v3 } = cellVectors(1.4, 1.4, 1.4, 100, 100, 100);
    const c3dir = v1.clone().add(v2).add(v3).normalize();
    const targetC3 = V3(1, 1, 1);
    const q1 = new THREE.Quaternion().setFromUnitVectors(c3dir, targetC3);
    v1 = v1.clone().applyQuaternion(q1); v2 = v2.clone().applyQuaternion(q1); v3 = v3.clone().applyQuaternion(q1);
    const c2dir = v1.clone().sub(v2).normalize();
    const targetC2 = V3(1, -1, 0);
    const q2 = new THREE.Quaternion().setFromUnitVectors(c2dir, targetC2);
    v1 = v1.clone().applyQuaternion(q2); v2 = v2.clone().applyQuaternion(q2); v3 = v3.clone().applyQuaternion(q2);
    return fromParallelepiped(v1, v2, v3, [0.30, 0.24, 0.18]);
  }
  function sistemaCubic() {
    const { v1, v2, v3 } = cellVectors(2.4, 2.4, 2.4, 90, 90, 90);
    return fromParallelepiped(v1, v2, v3, [0.24, 0.19, 0.15]);
  }
  function sistemaHexagonal() {
    const vertices = hexPrismVertices();
    const offset = new THREE.Vector3(0.55, 0.35, 0.30);
    return { vertices, offset, cellFactory: (color) => hexPrismEdges(vertices, color) };
  }

  const GRUPS = [
    { value: 'triclinic', label: 'Triclínic — Ci (ordre 2)', hint: 'a≠b≠c, cap angle de 90°. Pràcticament sense simetria: només la identitat i el centre d\'inversió.', build: sistemaTriclinic },
    { value: 'monoclinic', label: 'Monoclínic — C2h (ordre 4)', hint: 'a≠b≠c, un sol angle ≠90° (β). Un únic eix C2 (b) i el pla perpendicular.', build: sistemaMonoclinic },
    { value: 'orthorhombic', label: 'Ortoròmbic — D2h (ordre 8)', hint: 'a≠b≠c, tots els angles de 90°. Tres eixos C2 mutuament perpendiculars.', build: sistemaOrthorhombic },
    { value: 'tetragonal', label: 'Tetragonal — D4h (ordre 16)', hint: 'a=b≠c, tots els angles de 90°. Un eix C4 principal (c) i eixos C2 secundaris.', build: sistemaTetragonal },
    { value: 'trigonal', label: 'Trigonal (romboèdric) — D3d (ordre 12)', hint: 'a=b=c, els tres angles iguals i ≠90°. Un eix C3 principal.', build: sistemaTrigonal },
    { value: 'hexagonal', label: 'Hexagonal — D6h (ordre 24)', hint: 'a=b≠c, γ=120°. Un únic eix C6 —cap altre eix n\'és equivalent (Principi de Neumann).', build: sistemaHexagonal },
    { value: 'cubic', label: 'Cúbic — Oh (ordre 48)', hint: 'a=b=c, tots els angles de 90°. El grup puntual més simètric: 3 eixos C4, 4 eixos C3, 6 eixos C2\' equivalents.', build: sistemaCubic }
  ];

  // ---------------------------------------------------------------
  // Escena: instància original (opaca) + instància interpolada
  // (semitransparent) + indicador de l'element de simetria
  // ---------------------------------------------------------------
  let originalGroup = null, transformedGroup = null, elementGroup = new THREE.Group();
  scene.add(elementGroup);
  let currentData = null;
  let currentOp = null;

  function buildInstance(data, cellColor) {
    const g = new THREE.Group();
    g.matrixAutoUpdate = false;
    g.add(data.cellFactory(cellColor));
    const opacity = cellColor === 0x555555 ? 1 : 0.6;
    const edgeColor = cellColor === 0x555555 ? 0x888888 : 0xe67e22;
    g.add(buildMotiu(data.offset, opacity, edgeColor));
    return g;
  }

  function buildElementIndicator(op) {
    const g = new THREE.Group();
    if (!op || op.kind === 'E') return g;
    if (op.kind === 'C' || op.kind === 'S') {
      const pts = [op.axis.clone().multiplyScalar(-3.2), op.axis.clone().multiplyScalar(3.2)];
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2980b9 })));
    }
    if (op.kind === 'sigma' || op.kind === 'S') {
      const planeGeo = new THREE.PlaneGeometry(3.4, 3.4);
      const planeMat = new THREE.MeshBasicMaterial({ color: 0x8e44ad, transparent: true, opacity: 0.13, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(planeGeo, planeMat);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), op.axis.clone().normalize());
      g.add(mesh);
    }
    if (op.kind === 'i') {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshBasicMaterial({ color: 0x8e44ad })));
    }
    return g;
  }

  function rebuildElement() {
    scene.remove(elementGroup);
    elementGroup = chkElement.checked ? buildElementIndicator(currentOp) : new THREE.Group();
    scene.add(elementGroup);
  }

  function rebuildSystem(key) {
    if (originalGroup) scene.remove(originalGroup);
    if (transformedGroup) scene.remove(transformedGroup);
    const def = GRUPS.find(g => g.value === key);
    currentData = def.build();
    hintSistema.textContent = def.hint;

    originalGroup = buildInstance(currentData, 0x555555);
    transformedGroup = buildInstance(currentData, 0xe67e22);
    originalGroup.matrix.identity();
    transformedGroup.matrix.identity();
    scene.add(originalGroup, transformedGroup);

    // Es manté l'operació ja triada (si n'hi ha) perquè es pugui anar
    // canviant de grup i comparar si la mateixa operació hi és o no.
    const previousIndex = selOperacio.selectedIndex;

    selOperacio.innerHTML = '';
    const grups = { E: 'Identitat', C: 'Rotacions pròpies (Cn)', S: 'Roto-inversions (Sn)', sigma: 'Reflexions (σ)', i: 'Inversió' };
    const optgroups = {};
    let nValides = 0;
    UNIVERSAL_OPS.forEach((op, idx) => {
      const valida = isSymmetry(matrixAtT(op, 1), currentData.vertices);
      op._valida = valida; // memoritzat per aquest sistema (recalculat cada rebuildSystem)
      if (valida) nValides++;
      const gName = grups[op.kind];
      if (!optgroups[gName]) {
        optgroups[gName] = document.createElement('optgroup');
        optgroups[gName].label = gName;
        selOperacio.appendChild(optgroups[gName]);
      }
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = (valida ? '✓ ' : '✕ ') + op.label;
      opt.style.color = valida ? '#1a7d2e' : '#b23a3a';
      optgroups[gName].appendChild(opt);
    });
    resumValides.textContent = nValides + ' de ' + UNIVERSAL_OPS.length + ' operacions candidates SÓN una simetria d\'aquest cristall (en verd).';
    selOperacio.selectedIndex = (previousIndex >= 0 && previousIndex < UNIVERSAL_OPS.length) ? previousIndex : 0;

    // Recalcula l'operació seleccionada per a la forma nova, però sense
    // tocar el lliscador — així es pot comparar directament al mateix t.
    seleccionaOperacio();
    actualitzaT();
  }

  // Actualitza quina és l'operació activa (indicador i estat verd/vermell)
  // sense moure el lliscador — es fa servir tant en triar una operació
  // nova com en canviar de grup mantenint la mateixa operació.
  function seleccionaOperacio() {
    currentOp = UNIVERSAL_OPS[parseInt(selOperacio.value, 10) || 0];
    rebuildElement();
    if (!currentOp || currentOp.kind === 'E') {
      estatOperacio.textContent = '';
    } else if (currentOp._valida) {
      estatOperacio.textContent = '✓ És una operació de simetria d\'aquest cristall: a t=100% la caixa taronja torna a coincidir exactament amb la grisa (només el motiu delata el moviment).';
      estatOperacio.style.color = '#1a7d2e';
    } else {
      estatOperacio.textContent = '✕ NO és una simetria d\'aquest cristall: a t=100% la caixa taronja queda clarament desalineada de la grisa.';
      estatOperacio.style.color = '#b23a3a';
    }
  }

  // Només quan l'usuari tria una operació NOVA es reinicia el lliscador.
  function canviaOperacio() {
    seleccionaOperacio();
    sliderT.value = 0;
    actualitzaT();
  }

  function actualitzaT() {
    const t = parseFloat(sliderT.value);
    valT.textContent = Math.round(t * 100) + '%';
    transformedGroup.matrix.copy(matrixAtT(currentOp, t));
    if (currentOp && (currentOp.kind === 'C' || currentOp.kind === 'S')) {
      progresAngle.textContent = (currentOp.angle * t).toFixed(1) + '° de ' + currentOp.angle + '°';
    } else if (currentOp && currentOp.kind === 'i') {
      progresAngle.textContent = 'Escala de +1 (original) a −1 (invertit) en cada eix.';
    } else if (currentOp && currentOp.kind === 'sigma') {
      progresAngle.textContent = 'Aplana cap al pla mirall i en surt capgirat.';
    } else {
      progresAngle.textContent = '';
    }
  }

  // ---------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------
  const selGrup = document.getElementById('selGrup');
  const hintSistema = document.getElementById('hintSistema');
  const selOperacio = document.getElementById('selOperacio');
  const resumValides = document.getElementById('resumValides');
  const estatOperacio = document.getElementById('estatOperacio');
  const chkElement = document.getElementById('chkElement');
  const sliderT = document.getElementById('sliderT');
  const valT = document.getElementById('valT');
  const progresAngle = document.getElementById('progresAngle');

  GRUPS.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.value;
    opt.textContent = g.label;
    selGrup.appendChild(opt);
  });

  selGrup.addEventListener('change', () => rebuildSystem(selGrup.value));
  selOperacio.addEventListener('change', canviaOperacio);
  chkElement.addEventListener('change', rebuildElement);
  sliderT.addEventListener('input', actualitzaT);

  selGrup.value = GRUPS[6].value; // comença pel cúbic, el més familiar
  rebuildSystem(selGrup.value);

  // ---------------------------------------------------------------
  // Bucle de render
  // ---------------------------------------------------------------
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
})();
