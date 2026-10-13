// panell_docent.js — seguiment estadístic del grup. Només es carrega (des de porta.js)
// quan la sessió és del docent amb accés al panell. Llegeix tots els progressos desats
// a la bústia del curs i en treu mitjanes; els docents no compten a l'estadística.
(function () {
  'use strict';
  const S = window.SESSIO;
  if (!S || !S.panell) return;

  const N_ALUMNES = 22;                             // matriculats a la llista del curs

  // índex pla de conceptes i línies, a partir de les mateixes dades que el mapa
  const LINIES = MAPA.linies.filter(l => l.id !== 'T');
  const CONCEPTES = [];
  MAPA.linies.forEach(l => l.estacions.forEach(e => e.conceptes.forEach(c =>
    CONCEPTES.push({ id: c.id, nom: c.nom, linia: l, tema: e.tema }))));
  const TOTAL = CONCEPTES.length;
  const PER_LINIA = {};
  LINIES.forEach(l => { PER_LINIA[l.id] = CONCEPTES.filter(c => c.linia === l); });
  const N_EX = (window.EXERCICIS || []).length;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const pc = x => Math.round(100 * x) + '%';
  const dataCurta = t => t
    ? new Date(t).toLocaleDateString('ca', { day: '2-digit', month: '2-digit' }) + ' '
      + new Date(t).toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' })
    : '—';

  // ---------------------------------------------------------------
  // Secció a la pàgina, abans de «La teva situació»
  // ---------------------------------------------------------------
  const seccio = el('section', 'panell');
  const cap = el('div', 'pan-cap');
  cap.append(el('h2', null, 'Seguiment del grup'));
  const boto = el('button', null, 'Actualitza');
  boto.type = 'button';
  cap.append(boto);
  const cos = el('div', 'pan-cos');
  seccio.append(cap, cos, el('p', 'pan-peu',
    'Visible només amb la sessió de docent. Les mitjanes es calculen sobre els alumnes que han entrat almenys un cop; els docents no hi compten.'));
  const situacio = document.getElementById('situacio');
  situacio.parentNode.insertBefore(seccio, situacio);

  function fila(taula, tag, cels, clss) {
    const tr = el('tr');
    cels.forEach((c, i) => {
      const td = el(tag, clss && clss[i]);
      if (c != null && c.nodeType) td.append(c); else td.textContent = c;
      tr.append(td);
    });
    taula.append(tr);
    return tr;
  }

  async function calcula() {
    boto.disabled = true;
    cos.textContent = 'Llegint els progressos desats…';
    let docs;
    try {
      docs = await S.llistaRemots();
    } catch (err) {
      cos.textContent = 'No s\'han pogut llegir les dades (connexió no configurada o sense xarxa).';
      boto.disabled = false;
      return;
    }
    const alumnes = [];
    for (const d of docs) if (!(await S.esDocent(d.niu))) alumnes.push(d);

    cos.textContent = '';
    if (!alumnes.length) {
      cos.append(el('p', 'pan-buit', 'Encara cap alumne no ha desat progrés al curs.'));
      boto.disabled = false;
      return;
    }

    // resum per alumne
    const files = alumnes.map(d => {
      const e = d.obj.e || {}, n = d.obj.n || {}, x = d.obj.x || {};
      const r = { niu: d.niu, t: d.t || d.obj.t || 0, ok: 0, dubte: 0, perdut: 0, ex: Object.keys(x).length, notes: Object.keys(n).length, e };
      for (const id in e) if (r[e[id]] != null) r[e[id]]++;
      return r;
    });
    const mitjana = f => files.reduce((s, r) => s + f(r), 0) / files.length;

    // resum general
    const res = el('div', 'pan-resum');
    [[files.length + ' de ' + N_ALUMNES, 'alumnes hi han desat progrés'],
     [pc(mitjana(r => r.ok / TOTAL)), 'dels ' + TOTAL + ' conceptes entesos, en mitjana'],
     [mitjana(r => r.dubte).toFixed(1), 'conceptes amb dubtes per alumne'],
     [mitjana(r => r.perdut).toFixed(1), 'conceptes «m\'he perdut» per alumne'],
     [mitjana(r => r.ex).toFixed(1) + (N_EX ? ' de ' + N_EX : ''), 'exercicis fets per alumne'],
    ].forEach(([gran, petit]) => {
      const c = el('div', 'pan-xifra');
      c.append(el('strong', null, gran), el('span', null, petit));
      res.append(c);
    });
    cos.append(res);

    // mitjana per línia argumental
    const tl = el('table', 'pan-taula');
    fila(tl, 'th', ['Línia', 'Entesos (mitjana)', 'Amb dubtes', 'Perduts'], []);
    LINIES.forEach(l => {
      const cs = PER_LINIA[l.id];
      const mOk = mitjana(r => cs.filter(c => r.e[c.id] === 'ok').length / cs.length);
      const nDubte = files.filter(r => cs.some(c => r.e[c.id] === 'dubte')).length;
      const nPerdut = files.filter(r => cs.some(c => r.e[c.id] === 'perdut')).length;
      const nom = el('span', 'pan-linia', l.nom);
      nom.style.setProperty('--c', l.color);
      fila(tl, 'td', [nom, pc(mOk), nDubte + ' alumnes', nPerdut + ' alumnes'], []);
    });
    const b1 = el('details', 'pan-bloc');
    b1.append(el('summary', null, 'Per línia argumental'), tl);
    b1.open = true;
    cos.append(b1);

    // conceptes que més costen
    const problema = CONCEPTES.map(c => ({
      c,
      dubte: files.filter(r => r.e[c.id] === 'dubte').length,
      perdut: files.filter(r => r.e[c.id] === 'perdut').length,
    })).filter(p => p.dubte + p.perdut)
      .sort((a, b) => (2 * b.perdut + b.dubte) - (2 * a.perdut + a.dubte))
      .slice(0, 10);
    if (problema.length) {
      const tp = el('table', 'pan-taula');
      fila(tp, 'th', ['Concepte', 'Línia', '«M\'he perdut»', 'Amb dubtes'], []);
      problema.forEach(p => fila(tp, 'td', [p.c.nom, p.c.linia.curt || p.c.linia.nom, p.perdut, p.dubte], []));
      const b2 = el('details', 'pan-bloc');
      b2.append(el('summary', null, 'Conceptes que més costen (per preparar la classe)'), tp);
      b2.open = true;
      cos.append(b2);
    }

    // detall per alumne
    const ta = el('table', 'pan-taula');
    fila(ta, 'th', ['NIU', 'Entesos', 'Dubtes', 'Perduts', 'Exercicis', 'Notes escrites', 'Últim desat', 'Contrasenya'], []);
    files.sort((a, b) => b.ok - a.ok).forEach(r => {
      const bReset = el('button', 'pan-reset', 'Restableix');
      bReset.type = 'button';
      bReset.title = 'Torna la contrasenya d\'aquest alumne a la de defecte';
      bReset.addEventListener('click', async () => {
        if (!confirm('Restablir la contrasenya de ' + r.niu + ' a la de defecte (REDACTAT' + r.niu + ')?\nL\'alumne hi podrà tornar a entrar amb aquesta.')) return;
        bReset.disabled = true; bReset.textContent = '…';
        try { await S.resetClau(r.niu); bReset.textContent = 'Restablerta'; }
        catch (e) { bReset.textContent = 'Error'; bReset.disabled = false; }
      });
      fila(ta, 'td', [r.niu, r.ok + ' (' + pc(r.ok / TOTAL) + ')', r.dubte, r.perdut, r.ex, r.notes, dataCurta(r.t), bReset], []);
    });
    const b3 = el('details', 'pan-bloc');
    b3.append(el('summary', null, 'Detall per alumne (' + files.length + ')'), ta);
    cos.append(b3);

    boto.disabled = false;
  }

  boto.addEventListener('click', calcula);
  calcula();
})();
