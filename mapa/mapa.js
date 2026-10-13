// mapa.js — mapa del curs: construeix les línies desplegables i la vista general a partir
// de mapa_dades.js, desa el progrés de l'alumne al seu navegador (localStorage) i calcula
// què queda afectat quan l'alumne marca que s'ha perdut en un concepte.
(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Rutes: en local la pàgina és a web_mapa/; publicada, a mapa/
  // ---------------------------------------------------------------
  const LOCAL = /\/web_mapa\//.test(location.pathname);
  const RUTA = LOCAL
    ? { portada: '../web_portada/index.html', apunts: '../web_apunts/', sims: '../web_simuladors/' }
    : { portada: '../', apunts: '../apunts/', sims: '../simuladors/' };
  document.querySelectorAll('[data-ruta]').forEach(el => {
    const [clau, resta] = el.dataset.ruta.split('|');
    const url = RUTA[clau] + (resta || '');
    if (el.tagName === 'IMG') el.src = url; else el.href = url;
  });

  // ---------------------------------------------------------------
  // Dades: índexs, dependències i conceptes clau
  // ---------------------------------------------------------------
  const LINIES = MAPA.linies;
  const C = {}, ORDRE = [];
  LINIES.forEach(l => l.estacions.forEach(e => {
    e.linia = l;
    e.conceptes.forEach(c => {
      c.linia = l; c.estacio = e;
      c.cal = c.cal || []; c.veure = c.veure || []; c.sims = c.sims || [];
      C[c.id] = c; ORDRE.push(c);
    });
  }));
  ORDRE.forEach(c => c.cal.concat(c.veure).forEach(r => {
    if (!C[r]) console.warn('mapa: referència desconeguda', c.id, '→', r);
  }));
  ORDRE.forEach(c => { c.cal = c.cal.filter(r => C[r]); c.veure = c.veure.filter(r => C[r]); });

  // Exercicis (mapa_exercicis.js, generat a partir dels fulls) i quins conceptes practiquen
  const EX = {};
  (window.EXERCICIS || []).forEach(e => { EX[e.num] = e; });
  ORDRE.forEach(c => {
    c.ex = (c.ex || []).filter(n => { if (!EX[n]) console.warn('mapa: exercici desconegut', c.id, n); return !!EX[n]; });
  });
  const EX_MAPA = [...new Set([].concat(...ORDRE.map(c => c.ex)))];
  const exDeLinia = l => [...new Set([].concat(...l.estacions.map(e => [].concat(...e.conceptes.map(c => c.ex)))))];

  const DEP = {};                       // id → conceptes que el tenen com a prerequisit directe
  ORDRE.forEach(c => { DEP[c.id] = []; });
  ORDRE.forEach(c => c.cal.forEach(r => DEP[r].push(c.id)));
  const AVALL = {};                     // id → tots els conceptes que en depenen (transitivament)
  ORDRE.forEach(c => {
    const vist = new Set(), pila = [c.id];
    while (pila.length) DEP[pila.pop()].forEach(d => { if (!vist.has(d)) { vist.add(d); pila.push(d); } });
    AVALL[c.id] = vist;
  });
  // concepte clau: dels que tenen més conceptes posteriors que en depenen (aprox. els 12 primers)
  const pesos = ORDRE.map(c => AVALL[c.id].size).sort((a, b) => b - a);
  const LLINDAR_CLAU = Math.max(8, pesos[11] || 8);
  const CLAU = new Set(ORDRE.filter(c => AVALL[c.id].size >= LLINDAR_CLAU).map(c => c.id));

  const NOMS_ESTAT = { ok: 'L\'entenc', dubte: 'Dubtes', perdut: 'M\'he perdut' };
  const ICONA_ESTAT = { ok: '✓', dubte: '?', perdut: '!' };
  const COLOR = { ok: '#2F855A', parcial: '#9AD0B0', dubte: '#E0A526', perdut: '#C53030', afectat: '#DD6B20' };
  const nomTema = t => (t === '00' ? 'Repàs' : 'Tema ' + (+t));

  // ---------------------------------------------------------------
  // Progrés de l'alumne (només en aquest navegador)
  // ---------------------------------------------------------------
  const CLAU_DESA = 'estatsolid.mapa.v1';
  let estat = { e: {}, n: {}, x: {}, h: [] };   // e: estat de cada concepte · n: notes · x: exercicis fets · h: historial

  function adopta(o) {                  // valida un objecte desat i el converteix en l'estat
    const e = {}, n = {}, x = {}, h = [];
    const entradaEx = id => typeof id === 'string' && id.slice(0, 3) === 'ex:' && !!EX[id.slice(3)];
    if (o && typeof o === 'object') {
      if (o.x && typeof o.x === 'object') for (const k in o.x) if (EX[k] && o.x[k]) x[k] = 1;
      if (o.e && typeof o.e === 'object') for (const id in o.e) if (C[id] && NOMS_ESTAT[o.e[id]]) e[id] = o.e[id];
      if (o.n && typeof o.n === 'object') for (const id in o.n) if (C[id] && typeof o.n[id] === 'string' && o.n[id].trim()) n[id] = o.n[id].slice(0, 5000);
      if (Array.isArray(o.h)) o.h.forEach(r => {
        if (!Array.isArray(r)) return;
        if (C[r[1]]) h.push([+r[0] || 0, r[1], NOMS_ESTAT[r[2]] ? r[2] : '', NOMS_ESTAT[r[3]] ? r[3] : '']);
        else if (entradaEx(r[1])) h.push([+r[0] || 0, r[1], r[2] === 'fet' ? 'fet' : '', r[3] === 'fet' ? 'fet' : '']);
      });
    }
    estat = { e, n, x, h: h.slice(-500) };
  }
  function llegeix() {
    try { const t = localStorage.getItem(CLAU_DESA); if (t) adopta(JSON.parse(t)); } catch (err) { /* sense accés: es comença de zero */ }
  }
  let avisatDesa = false;
  function desa() {
    try {
      localStorage.setItem(CLAU_DESA, JSON.stringify({ v: 1, e: estat.e, n: estat.n, x: estat.x, h: estat.h }));
    } catch (err) {
      if (!avisatDesa) {
        avisatDesa = true;
        missatge('Aquest navegador no deixa desar el progrés (potser és una finestra privada). Fes servir «Desa una còpia» per no perdre\'l.');
      }
    }
  }
  function marca(id, nou) {
    const vell = estat.e[id] || '';
    if (nou === vell) nou = '';                         // tornar a clicar desmarca
    if (nou) estat.e[id] = nou; else delete estat.e[id];
    estat.h.push([Date.now(), id, vell, nou]);
    if (estat.h.length > 500) estat.h.shift();
    desa();
    actualitza();
  }

  function marcaEx(num) {
    const fet = !estat.x[num];
    if (fet) estat.x[num] = 1; else delete estat.x[num];
    estat.h.push([Date.now(), 'ex:' + num, fet ? '' : 'fet', fet ? 'fet' : '']);
    if (estat.h.length > 500) estat.h.shift();
    desa();
    actualitza();
  }

  // ---------------------------------------------------------------
  // Utilitats de DOM
  // ---------------------------------------------------------------
  function h(tag, props, ...fills) {
    const el = document.createElement(tag);
    posa(el, props, fills);
    return el;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, props, ...fills) {
    const el = document.createElementNS(SVGNS, tag);
    posa(el, props, fills);
    return el;
  }
  function posa(el, props, fills) {
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;          // només per a les icones SVG d'aquest fitxer
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    fills.flat().forEach(f => { if (f != null && f !== false) el.append(f.nodeType ? f : document.createTextNode(String(f))); });
  }
  function llista(noms) {
    if (noms.length < 2) return noms.join('');
    return noms.slice(0, -1).join(', ') + ' i ' + noms[noms.length - 1];
  }
  function partir(text, max) {                // talla un text en línies de com a molt max caràcters
    const out = [];
    text.split(' ').forEach(p => {
      const ult = out[out.length - 1];
      if (ult && (ult + ' ' + p).length <= max) out[out.length - 1] = ult + ' ' + p; else out.push(p);
    });
    return out;
  }
  let tMissatge;
  function missatge(text) {
    const el = document.getElementById('missatge');
    el.textContent = text;
    clearTimeout(tMissatge);
    tMissatge = setTimeout(() => { el.textContent = ''; }, 7000);
  }
  const ICONA = {
    fletxa: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    llibre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5C4.7 20 4 19.3 4 18.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/></svg>',
    sim: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 17c3-9 6-9 9 0s6 9 9 0"/></svg>'
  };

  // Noms dels simuladors: es llegeixen de temes.js, el mateix fitxer que fa servir l'índex de simuladors
  const SIMNOM = {};
  const nomSim = sim => (SIMNOM[sim] || sim.split('/').pop().replace(/\.html$/, '').replace(/_/g, ' ')).split(/[:—]/)[0].trim();
  (function carregaTemes() {
    const sc = document.createElement('script');
    sc.src = RUTA.sims + 'temes.js';
    sc.onload = () => {
      try {
        (window.TEMES || []).forEach(t => (t.simuladors || []).forEach(x => { SIMNOM[x.href] = x.nom; }));
        document.querySelectorAll('a[data-sim]').forEach(a => { a.lastChild.textContent = 'Simulador: ' + nomSim(a.dataset.sim); });
      } catch (err) { /* es queden els noms de fitxer */ }
    };
    document.head.append(sc);
  })();

  // ---------------------------------------------------------------
  // Construcció de les línies desplegables
  // ---------------------------------------------------------------
  const ELEM = {}, EST_EL = {}, LIN_EL = {};
  const arrel = document.getElementById('linies');

  function xip(id) {
    const c = C[id];
    return h('button', {
      type: 'button', class: 'xip', 'data-id': id, style: '--c:' + c.linia.color,
      title: c.linia.nom + ' · ' + nomTema(c.estacio.tema), onclick: () => navega(id)
    }, h('span', { class: 'p ' + (estat.e[id] || '') }), c.nom);
  }

  function enllacos(c) {
    const box = h('div', { class: 'c-enllacos' });
    const t = c.estacio.tema, carpeta = APUNTS_WEB[t];
    if (carpeta && c.ap) {
      box.append(h('a', { href: RUTA.apunts + carpeta + '/#' + c.ap, html: ICONA.llibre }, 'Apunts · ' + nomTema(t) + ', §' + c.sec));
    } else if (c.sec) {
      box.append(h('span', { class: 'sense' }, 'Apunts del ' + nomTema(t) + ', §' + c.sec + ' (versió web en preparació)'));
    } else if (t !== '00') {
      box.append(h('span', { class: 'sense' }, 'Encara no és als apunts'));
    } else {
      box.append(h('span', { class: 'sense' }, 'Repàs de cursos anteriors'));
    }
    if (c.ref) box.append(h('span', { class: 'sense' }, c.ref));
    c.sims.forEach(sim => box.append(h('a', { href: RUTA.sims + sim, 'data-sim': sim, html: ICONA.sim }, 'Simulador: ' + nomSim(sim))));
    return box;
  }

  function llistaEx(nums, temaConcepte) {
    return h('ul', { class: 'ex-llista' }, nums.map(num => {
      const e = EX[num];
      const titol = 'Exercici ' + num + ' · ' + e.titol;
      return h('li', { class: 'ex-fila' },
        h('button', {
          type: 'button', class: 'ex-fet', 'data-ex': num, 'aria-pressed': estat.x[num] ? 'true' : 'false',
          title: 'Marca l\'exercici ' + num + ' com a fet', onclick: () => marcaEx(num)
        }, '✓ Fet'),
        e.web ? h('a', { href: RUTA.apunts + e.web }, titol) : h('span', null, titol),
        e.tema !== temaConcepte ? h('span', { class: 'ex-tema', text: '(full del ' + nomTema(e.tema) + ')' }) : null);
    }));
  }

  function construeixDetall(c) {
    const E = ELEM[c.id], d = E.detall;
    d.append(h('p', { class: 'c-desc', text: c.desc }));
    if (c.cal.length) d.append(h('div', { class: 'c-rel' }, h('span', { class: 'et', text: 'Cal haver entès abans' }), c.cal.map(xip)));
    if (DEP[c.id].length) d.append(h('div', { class: 'c-rel' }, h('span', { class: 'et', text: 'Hi recolzen' }), DEP[c.id].map(xip)));
    if (c.veure.length) d.append(h('div', { class: 'c-rel' }, h('span', { class: 'et', text: 'Relacionat' }), c.veure.map(xip)));
    d.append(enllacos(c));
    if (c.ex.length) d.append(h('div', { class: 'c-rel' }, h('span', { class: 'et', text: 'Per practicar-ho' }), llistaEx(c.ex, c.estacio.tema)));
    const ta = h('textarea', { rows: 2, placeholder: 'Què no t\'acaba de quadrar? Què vols preguntar a classe?' });
    ta.value = estat.n[c.id] || '';
    let t;
    ta.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (ta.value.trim()) estat.n[c.id] = ta.value.slice(0, 5000); else delete estat.n[c.id];
        desa();
      }, 400);
    });
    d.append(h('label', { class: 'c-nota' }, h('span', { text: 'Les meves notes (només en aquest navegador)' }), ta));
    E.ta = ta;
    E.construit = true;
  }

  function obreConcepte(id, obre) {
    const E = ELEM[id];
    if (obre && !E.construit) construeixDetall(C[id]);
    E.detall.hidden = !obre;
    E.obre.setAttribute('aria-expanded', obre ? 'true' : 'false');
    E.li.classList.toggle('obert', obre);
  }

  function construeixConcepte(c) {
    const obre = h('button', { type: 'button', class: 'c-obre', 'aria-expanded': 'false', 'aria-controls': 'd-' + c.id },
      h('span', { class: 'fletxa', html: ICONA.fletxa }),
      h('span', { class: 'c-nom', text: c.nom }),
      CLAU.has(c.id) ? h('span', { class: 'c-clau', title: 'Concepte clau: ' + AVALL[c.id].size + ' conceptes posteriors en depenen', text: '★' }) : null,
      c.ex.length ? h('span', { class: 'c-nex', 'data-id': c.id }) : null);
    const botons = h('div', { class: 'c-botons', role: 'group', 'aria-label': 'El meu estat: ' + c.nom },
      ['ok', 'dubte', 'perdut'].map(e => h('button', {
        type: 'button', 'data-e': e, 'aria-pressed': 'false', title: NOMS_ESTAT[e], onclick: () => marca(c.id, e)
      }, h('span', { class: 'ic', text: ICONA_ESTAT[e] }), h('span', { class: 'txt', text: NOMS_ESTAT[e] }))));
    const avis = h('div', { class: 'c-avis', hidden: true });
    const detall = h('div', { class: 'c-detall', id: 'd-' + c.id, hidden: true });
    const li = h('li', { class: 'concepte', id: 'c-' + c.id }, h('div', { class: 'c-fila' }, obre, botons), avis, detall);
    obre.addEventListener('click', () => obreConcepte(c.id, !li.classList.contains('obert')));
    ELEM[c.id] = { li, obre, botons, avis, detall, construit: false, ta: null };
    return li;
  }

  LINIES.forEach(l => {
    const ol = h('ol', { class: 'estacions' });
    l.estacions.forEach(e => {
      const punt = h('span', { class: 'e-punt', 'aria-hidden': 'true' });
      const minis = h('span', { class: 'e-minis', 'aria-hidden': 'true' }, e.conceptes.map(c => h('span', { 'data-id': c.id })));
      const det = h('details', { class: 'estacio', id: 'e-' + e.id },
        h('summary', null, punt,
          h('span', null, h('span', { class: 'e-nom', text: e.nom }), ' ', h('span', { class: 'e-tema', text: '· ' + nomTema(e.tema) })),
          minis),
        h('ul', { class: 'conceptes' }, e.conceptes.map(construeixConcepte)));
      ol.append(h('li', null, det));
      EST_EL[e.id] = { det, punt, minis };
    });
    const estatTxt = h('span', { class: 'l-estat' }), barra = h('span', { class: 'barra', 'aria-hidden': 'true' });
    const det = h('details', { class: 'linia', id: 'l-' + l.id, style: '--c:' + l.color },
      h('summary', null,
        h('span', { class: 'fletxa', html: ICONA.fletxa }),
        h('span', null, h('span', { class: 'l-temes', text: l.temes }), h('br'), h('span', { class: 'l-nom', text: l.nom })),
        h('span', { class: 'l-dreta' }, estatTxt, barra)),
      h('p', { class: 'l-desc', text: l.desc }),
      ol);
    arrel.append(det);
    LIN_EL[l.id] = { det, estatTxt, barra };
  });

  // ---------------------------------------------------------------
  // Estat derivat
  // ---------------------------------------------------------------
  function calcula() {
    const perduts = ORDRE.filter(c => estat.e[c.id] === 'perdut').map(c => c.id);
    const afectat = {};                 // id → conceptes perduts dels quals depèn
    perduts.forEach(p => AVALL[p].forEach(id => {
      if (estat.e[id] !== 'perdut') (afectat[id] = afectat[id] || []).push(p);
    }));
    return { perduts, afectat };
  }

  function agregat(conceptes, afectat) {
    const a = { total: conceptes.length, ok: 0, dubte: 0, perdut: 0, afectat: 0 };
    conceptes.forEach(c => {
      const e = estat.e[c.id];
      if (e) a[e]++;
      if (afectat[c.id]) a.afectat++;
    });
    a.cls = a.perdut ? 'perdut' : a.dubte ? 'dubte' : a.ok === a.total ? 'ok' : a.ok ? 'parcial' : '';
    a.icona = a.perdut ? '!' : a.dubte ? '?' : a.ok === a.total ? '✓' : '';
    return a;
  }

  function estatLinia(l, afectat) {
    const tots = [].concat(...l.estacions.map(e => e.conceptes));
    const a = agregat(tots, afectat);
    const perdut = tots.find(c => estat.e[c.id] === 'perdut');
    if (perdut) return { a, cls: 'perdut', txt: 'Encallada a «' + perdut.nom + '»' };
    if (a.afectat) {
      const origen = new Set();
      tots.forEach(c => (afectat[c.id] || []).forEach(p => origen.add(C[p].linia.curt)));
      return { a, cls: 'afectat', txt: 'Depèn d\'on t\'has perdut a ' + llista([...origen]) };
    }
    if (a.dubte) return { a, cls: 'dubte', txt: a.dubte === 1 ? 'Amb un dubte' : 'Amb ' + a.dubte + ' dubtes' };
    if (a.ok === a.total) return { a, cls: 'ok', txt: 'Al dia: tot entès' };
    if (a.ok) return { a, cls: '', txt: a.ok + ' de ' + a.total + ' conceptes entesos' };
    return { a, cls: '', txt: 'Encara per marcar' };
  }

  function barraDe(a, el) {
    el.textContent = '';
    ['ok', 'dubte', 'perdut'].forEach(k => {
      if (a[k]) el.append(h('span', { class: 'b-' + k, style: 'width:' + (100 * a[k] / a.total) + '%' }));
    });
    return el;
  }

  // ---------------------------------------------------------------
  // Actualització de tota la pàgina
  // ---------------------------------------------------------------
  function actualitza() {
    const { perduts, afectat } = calcula();

    ORDRE.forEach(c => {
      const E = ELEM[c.id], e = estat.e[c.id] || '';
      E.li.classList.remove('ok', 'dubte', 'perdut');
      if (e) E.li.classList.add(e);
      E.botons.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.e === e ? 'true' : 'false'));
      const af = afectat[c.id];
      if (af) {
        E.avis.hidden = false;
        E.avis.textContent = '⚠ Depèn de ' + llista(af.map(p => '«' + C[p].nom + '»')) + ', on has marcat que t\'has perdut.';
      } else {
        E.avis.hidden = true;
      }
      E.li.classList.toggle('febla', e === 'dubte' || e === 'perdut' || !!af);
    });
    document.querySelectorAll('.xip[data-id]').forEach(x => { x.querySelector('.p').className = 'p ' + (estat.e[x.dataset.id] || ''); });
    document.querySelectorAll('.ex-fet[data-ex]').forEach(b => b.setAttribute('aria-pressed', estat.x[b.dataset.ex] ? 'true' : 'false'));
    document.querySelectorAll('.c-nex[data-id]').forEach(el => {
      const ex = C[el.dataset.id].ex, fets = ex.filter(n => estat.x[n]).length;
      el.textContent = fets + '/' + ex.length + ' ex.';
      el.title = fets + ' de ' + ex.length + ' exercicis fets';
      el.classList.toggle('tots', fets === ex.length);
    });

    LINIES.forEach(l => {
      let liniaFebla = false;
      l.estacions.forEach(e => {
        const a = agregat(e.conceptes, afectat), el = EST_EL[e.id];
        el.punt.className = 'e-punt ' + a.cls + (a.afectat ? ' afectat' : '');
        el.punt.textContent = a.icona;
        el.minis.querySelectorAll('span').forEach(m => {
          m.className = (estat.e[m.dataset.id] || '') + (afectat[m.dataset.id] ? ' afectat' : '');
        });
        const febla = e.conceptes.some(c => ELEM[c.id].li.classList.contains('febla'));
        el.det.classList.toggle('te-febla', febla);
        liniaFebla = liniaFebla || febla;
      });
      const st = estatLinia(l, afectat), el = LIN_EL[l.id];
      el.estatTxt.className = 'l-estat ' + st.cls;
      el.estatTxt.textContent = st.txt;
      barraDe(st.a, el.barra);
      el.det.classList.toggle('te-febla', liniaFebla);
    });

    dibuixaVista(afectat);
    situacio(perduts, afectat);
    historial();
  }

  // ---------------------------------------------------------------
  // «La teva situació»
  // ---------------------------------------------------------------
  function situacio(perduts, afectat) {
    const cos = document.getElementById('sitCos');
    cos.textContent = '';
    const a = agregat(ORDRE, afectat), marcats = a.ok + a.dubte + a.perdut;

    if (!marcats) {
      cos.append(h('p', { class: 'sit-buit' },
        'Encara no has marcat cap concepte. Obre una línia, més avall, i marca els conceptes que ja heu treballat a classe. Aquí veuràs on ets, on t\'has encallat i què pots continuar seguint.'));
    } else {
      const parts = [];
      if (a.ok) parts.push(a.ok + (a.ok === 1 ? ' l\'entens' : ' els entens'));
      if (a.dubte) parts.push('en ' + a.dubte + ' tens dubtes');
      if (a.perdut) parts.push('en ' + a.perdut + ' t\'has perdut');
      cos.append(h('p', { class: 'sit-resum' }, 'Has marcat ' + marcats + ' dels ' + a.total + ' conceptes del curs: ' + llista(parts) + '.'));
      cos.append(barraDe(a, h('div', { class: 'barra', 'aria-hidden': 'true' })));
    }
    const nFets = EX_MAPA.filter(n => estat.x[n]).length;
    if (nFets) cos.append(h('p', { class: 'sit-resum sit-ex' }, 'Exercicis fets: ' + nFets + ' dels ' + EX_MAPA.length + ' dels fulls.'));

    cos.append(h('ul', { class: 'sit-linies' }, LINIES.filter(l => l.id !== 'T').map(l => {
      const st = estatLinia(l, afectat);
      const ex = exDeLinia(l), fets = ex.filter(n => estat.x[n]).length;
      return h('li', { style: '--c:' + l.color },
        h('span', { class: 'nom', text: l.nom }),
        h('span', { class: 'estat-txt ' + st.cls, text: st.txt }),
        ex.length ? h('span', { class: 'ex-txt', text: fets + ' de ' + ex.length + ' exercicis fets' }) : null);
    })));

    if (perduts.length) {
      const bloc = h('div', { class: 'sit-bloc' }, h('h3', { text: perduts.length === 1 ? 'On t\'has perdut' : 'On t\'has perdut (' + perduts.length + ' punts)' }));
      perduts.forEach(p => {
        const c = C[p], av = AVALL[p];
        const linies = [...new Set([...av].map(id => C[id].linia.curt))];
        const caixa = h('div', { class: 'sit-perdut' }, h('div', { class: 'titol' }, xip(p)));
        caixa.append(h('p', null, av.size
          ? (av.size === 1 ? 'En depèn 1 concepte posterior, de ' : 'En depenen ' + av.size + ' conceptes posteriors, de ') + llista(linies) + '.'
          : 'Cap altre concepte del curs en depèn: pots continuar endavant mentre el treballes.'));
        const pendents = c.cal.filter(r => estat.e[r] !== 'ok');
        if (pendents.length) {
          caixa.append(h('p', null, 'Abans de tornar-hi, repassa:'), h('div', null, pendents.map(xip)));
        } else if (c.cal.length) {
          caixa.append(h('p', null, 'Els conceptes previs els tens marcats com a entesos: el problema és en aquest pas. És un bon punt per preguntar a classe o a tutoria.'));
        } else {
          caixa.append(h('p', null, 'No depèn de cap altre concepte del curs: és un bon punt per preguntar a classe o a tutoria.'));
        }
        if (c.ex.length) caixa.append(h('p', null, 'Per practicar-ho:'), llistaEx(c.ex, c.estacio.tema));
        bloc.append(caixa);
      });
      const lliures = LINIES.filter(l => l.id !== 'T' && !l.estacions.some(e => e.conceptes.some(c => estat.e[c.id] === 'perdut' || afectat[c.id])));
      bloc.append(h('p', { class: 'sit-seguir' }, lliures.length
        ? 'Pots continuar sense problema per ' + llista(lliures.map(l => '«' + l.nom + '»')) + ': no depenen de cap punt on t\'hagis perdut.'
        : 'Ara mateix totes les línies depenen d\'algun punt on t\'has perdut: comença per desencallar-te.'));
      cos.append(bloc);
    }

    const dubtes = ORDRE.filter(c => estat.e[c.id] === 'dubte');
    if (dubtes.length) {
      cos.append(h('div', { class: 'sit-bloc' },
        h('h3', { text: 'Tens dubtes a' }),
        h('div', null, dubtes.map(c => xip(c.id))),
        h('p', { class: 'sit-seguir' }, 'Apunta a les notes de cada concepte què no et quadra i porta-ho a classe o a tutoria.')));
    }
  }

  function historial() {
    const ol = document.getElementById('historialLlista');
    ol.textContent = '';
    const ult = estat.h.slice(-30).reverse();
    document.querySelector('#historial summary').textContent = 'El meu historial' + (estat.h.length ? ' (' + estat.h.length + (estat.h.length === 1 ? ' canvi)' : ' canvis)') : '');
    if (!ult.length) { ol.append(h('li', { text: 'Encara no has marcat res.' })); return; }
    const nomE = e => (e ? NOMS_ESTAT[e] : 'sense marcar');
    ult.forEach(([t, id, de, a]) => {
      const d = new Date(t);
      const data = d.toLocaleDateString('ca', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' });
      const txt = id.slice(0, 3) === 'ex:'
        ? 'Exercici ' + id.slice(3) + ': ' + (a === 'fet' ? 'fet' : 'desmarcat')
        : C[id].nom + ': ' + nomE(de) + ' → ' + nomE(a);
      ol.append(h('li', null, h('span', { class: 'data', text: data }), txt));
    });
  }

  // ---------------------------------------------------------------
  // Vista general (SVG)
  // ---------------------------------------------------------------
  const vista = document.getElementById('vistaMapa');
  function dibuixaVista(afectat) {
    const X0 = 184, DX = 84, Y0 = 60, DY = 100, R = 13;
    const maxE = Math.max(...LINIES.map(l => l.estacions.length));
    const W = X0 + (maxE - 1) * DX + 56, H = Y0 + (LINIES.length - 1) * DY + 60;
    const pos = {};
    LINIES.forEach((l, i) => l.estacions.forEach((e, j) => { pos[e.id] = { x: X0 + j * DX, y: Y0 + i * DY }; }));

    const svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': 'Vista general de les línies argumentals del curs' });

    // correspondències: una estació necessita un concepte d'una altra línia
    const parelles = new Map();
    ORDRE.forEach(c => c.cal.forEach(r => {
      const a = C[r].estacio, b = c.estacio;
      if (a.linia !== b.linia) parelles.set(a.id + '>' + b.id, [a, b]);
    }));
    const gT = s('g', { 'aria-hidden': 'true' });
    parelles.forEach(([a, b]) => {
      const pa = pos[a.id], pb = pos[b.id], ym = (pa.y + pb.y) / 2;
      gT.append(s('path', { class: 'transf', 'data-a': a.id, 'data-b': b.id, d: 'M' + pa.x + ',' + pa.y + ' C' + pa.x + ',' + ym + ' ' + pb.x + ',' + ym + ' ' + pb.x + ',' + pb.y }));
    });
    svg.append(gT);

    const ressalta = (id, on) => gT.querySelectorAll('[data-a="' + id + '"],[data-b="' + id + '"]').forEach(p => p.classList.toggle('actiu', on));

    LINIES.forEach((l, i) => {
      const y = Y0 + i * DY, xs = l.estacions.map(e => pos[e.id].x);
      const tots = [].concat(...l.estacions.map(e => e.conceptes)), al = agregat(tots, afectat);
      const nom = partir(l.nom, 19);
      const tNom = s('text', { x: 14, y: y - 4 - (nom.length - 1) * 8, class: 'v-linia', fill: l.color });
      nom.forEach((tros, k) => tNom.append(s('tspan', { x: 14, dy: k ? 16 : 0, text: tros })));
      svg.append(tNom);
      svg.append(s('text', { x: 14, y: y + 10 + (nom.length - 1) * 8, class: 'v-recompte', text: al.ok + ' de ' + al.total + ' entesos' }));
      svg.append(s('line', { x1: xs[0], y1: y, x2: xs[xs.length - 1], y2: y, stroke: l.color, 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.9 }));

      let temaAnt = null;
      l.estacions.forEach(e => {
        if (e.tema !== temaAnt) {
          temaAnt = e.tema;
          svg.append(s('text', { x: pos[e.id].x, y: y - R - 12, 'text-anchor': 'middle', class: 'v-tema', text: nomTema(e.tema) }));
        }
      });

      l.estacions.forEach(e => {
        const p = pos[e.id], a = agregat(e.conceptes, afectat);
        const estatTxt = a.perdut ? 'hi ha punts on t\'has perdut' : a.dubte ? 'hi tens dubtes' : a.ok === a.total ? 'tot entès'
          : a.ok ? a.ok + ' de ' + a.total + ' conceptes entesos' : 'per marcar';
        const g = s('g', { class: 'est', tabindex: 0, role: 'button', 'aria-label': e.nom + ', ' + nomTema(e.tema) + ': ' + estatTxt + (a.afectat ? ', depèn d\'un punt on t\'has perdut' : '') });
        if (a.afectat) g.append(s('circle', { cx: p.x, cy: p.y, r: R + 6, fill: 'none', stroke: COLOR.afectat, 'stroke-width': 2.5, 'stroke-dasharray': '4 3' }));
        g.append(s('circle', { class: 'cercle', cx: p.x, cy: p.y, r: R, fill: COLOR[a.cls] || '#FFFFFF', stroke: l.color, 'stroke-width': 3.5 }));
        if (a.icona) g.append(s('text', { x: p.x, y: p.y + 4.5, 'text-anchor': 'middle', class: 'v-icona', fill: a.cls === 'dubte' ? '#3A2A05' : '#FFFFFF', text: a.icona }));
        const tl = s('text', { x: p.x, y: p.y + R + 17, 'text-anchor': 'middle', class: 'v-est' });
        partir(e.curt, 13).forEach((tros, k) => tl.append(s('tspan', { x: p.x, dy: k ? 13 : 0, text: tros })));
        g.append(tl, s('title', { text: e.nom + ' (' + nomTema(e.tema) + ')' }));
        g.addEventListener('click', () => navegaEstacio(e.id));
        g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); navegaEstacio(e.id); } });
        g.addEventListener('mouseenter', () => ressalta(e.id, true));
        g.addEventListener('mouseleave', () => ressalta(e.id, false));
        g.addEventListener('focus', () => ressalta(e.id, true));
        g.addEventListener('blur', () => ressalta(e.id, false));
        svg.append(g);
      });
    });

    vista.textContent = '';
    vista.append(svg);
  }

  // ---------------------------------------------------------------
  // Navegació
  // ---------------------------------------------------------------
  function flash(el) {
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1600);
  }
  function navega(id) {
    const c = C[id];
    if (!c) return;
    if (arrel.classList.contains('nomes-febles') && !ELEM[id].li.classList.contains('febla')) posaFebles(false);
    LIN_EL[c.linia.id].det.open = true;
    EST_EL[c.estacio.id].det.open = true;
    obreConcepte(id, true);
    const li = ELEM[id].li;
    li.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flash(li);
    ELEM[id].obre.focus({ preventScroll: true });
    try { history.replaceState(null, '', '#c-' + id); } catch (err) { /* sense historial */ }
  }
  function navegaEstacio(eid) {
    const e = MAPA.linies.flatMap(l => l.estacions).find(x => x.id === eid);
    if (!e) return;
    if (arrel.classList.contains('nomes-febles') && !EST_EL[eid].det.classList.contains('te-febla')) posaFebles(false);
    LIN_EL[e.linia.id].det.open = true;
    const det = EST_EL[eid].det;
    det.open = true;
    det.scrollIntoView({ behavior: 'smooth', block: 'start' });
    det.querySelector('summary').focus({ preventScroll: true });
    try { history.replaceState(null, '', '#e-' + eid); } catch (err) { /* sense historial */ }
  }

  // ---------------------------------------------------------------
  // Eines
  // ---------------------------------------------------------------
  const btnFebles = document.getElementById('btnFebles');
  function posaFebles(on) {
    arrel.classList.toggle('nomes-febles', on);
    btnFebles.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) {
      const n = ORDRE.filter(c => ELEM[c.id].li.classList.contains('febla')).length;
      if (!n) {
        missatge('No tens cap concepte amb dubtes ni on t\'hagis perdut.');
        arrel.classList.remove('nomes-febles');
        btnFebles.setAttribute('aria-pressed', 'false');
        return;
      }
      LINIES.forEach(l => { if (LIN_EL[l.id].det.classList.contains('te-febla')) LIN_EL[l.id].det.open = true; });
      Object.values(EST_EL).forEach(el => { if (el.det.classList.contains('te-febla')) el.det.open = true; });
    }
  }
  btnFebles.addEventListener('click', () => posaFebles(btnFebles.getAttribute('aria-pressed') !== 'true'));
  document.getElementById('btnObre').addEventListener('click', () => {
    Object.values(LIN_EL).forEach(el => { el.det.open = true; });
    Object.values(EST_EL).forEach(el => { el.det.open = true; });
  });
  document.getElementById('btnTanca').addEventListener('click', () => {
    Object.values(LIN_EL).forEach(el => { el.det.open = false; });
    Object.values(EST_EL).forEach(el => { el.det.open = false; });
    ORDRE.forEach(c => obreConcepte(c.id, false));
  });

  function refrescaNotes() {
    ORDRE.forEach(c => { const E = ELEM[c.id]; if (E.ta) E.ta.value = estat.n[c.id] || ''; });
  }

  const avui = () => new Date().toISOString().slice(0, 10);
  document.getElementById('btnDesa').addEventListener('click', () => {
    const dades = JSON.stringify({ app: 'mapa-estat-solid', v: 1, desat: new Date().toISOString(), e: estat.e, n: estat.n, x: estat.x, h: estat.h }, null, 1);
    const url = URL.createObjectURL(new Blob([dades], { type: 'application/json' }));
    const a = h('a', { href: url, download: 'mapa_estat_solid_' + avui() + '.json' });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    missatge('Còpia desada. Per recuperar-la en un altre ordinador o navegador, fes servir «Recupera una còpia».');
  });
  const fitxer = document.getElementById('fitxerCopia');
  document.getElementById('btnRecupera').addEventListener('click', () => fitxer.click());
  fitxer.addEventListener('change', () => {
    const f = fitxer.files && fitxer.files[0];
    fitxer.value = '';
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () => {
      let o;
      try { o = JSON.parse(lector.result); } catch (err) { o = null; }
      if (!o || o.app !== 'mapa-estat-solid') { missatge('Aquest fitxer no és una còpia del mapa del curs.'); return; }
      if ((Object.keys(estat.e).length || Object.keys(estat.x).length) && !confirm('Vols substituir el progrés que tens ara en aquest navegador pel de la còpia?')) return;
      adopta(o);
      desa();
      refrescaNotes();
      actualitza();
      missatge('Còpia recuperada: ' + Object.keys(estat.e).length + ' conceptes marcats.');
    };
    lector.readAsText(f);
  });
  document.getElementById('btnEsborra').addEventListener('click', () => {
    if (!confirm('Segur que vols esborrar tot el teu progrés, les notes i l\'historial d\'aquest navegador? No es pot desfer.')) return;
    estat = { e: {}, n: {}, x: {}, h: [] };
    desa();
    refrescaNotes();
    actualitza();
    missatge('Progrés esborrat.');
  });

  // si l'alumne té el mapa obert en dues pestanyes, es mantenen iguals
  window.addEventListener('storage', ev => {
    if (ev.key !== CLAU_DESA) return;
    llegeix();
    refrescaNotes();
    actualitza();
  });

  // ---------------------------------------------------------------
  // Inici
  // ---------------------------------------------------------------
  llegeix();
  actualitza();
  const ancora = decodeURIComponent(location.hash.slice(1));
  if (ancora.startsWith('c-') && C[ancora.slice(2)]) navega(ancora.slice(2));
  else if (ancora.startsWith('e-') && EST_EL[ancora.slice(2)]) navegaEstacio(ancora.slice(2));
  else if (ancora.startsWith('l-') && LIN_EL[ancora.slice(2)]) { LIN_EL[ancora.slice(2)].det.open = true; LIN_EL[ancora.slice(2)].det.scrollIntoView(); }
})();
