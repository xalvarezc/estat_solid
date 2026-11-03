// Taulell del taller de vídeos.
//
// Pàgina estàtica: totes les dades són les issues i els fitxers del repositori privat
// xalvarezc/taller_videos, que es llegeixen i s'escriuen amb l'API de GitHub i el token
// (fine-grained, només per a aquest repositori) que el professor enganxa a la porta.
// Qui fa la feina és Claude Code amb /taller (vegeu CLAUDE.md del repositori): aquesta
// pàgina només posa i treu etiquetes, escriu comentaris i edita esquema_video.md.
(function () {
  'use strict';
  const REPO = 'xalvarezc/taller_videos';
  const API = 'https://api.github.com';
  const CLAU = 'taller_token';

  const FASES = [
    { id: 'proposta',   titol: 'Propostes' },
    { id: 'acceptat',   titol: 'Acceptats' },
    { id: 'documentat', titol: 'Documentats' },
    { id: 'presentat',  titol: 'Presentats' },
    { id: 'llest',      titol: 'Llestos per gravar' },
  ];
  const FEINES = { explora: 'a la cua: propostes', documenta: 'a la cua: documentar',
                   presenta: 'a la cua: presentació', revisa: 'a la cua: canvis' };
  const ETIQUETES = {
    'fase:proposta': 'c5def5', 'fase:acceptat': 'bfe5bf', 'fase:documentat': '8fd19e',
    'fase:presentat': '4caf50', 'fase:llest': '00843d', 'fase:descartat': 'cccccc',
    'feina:explora': 'f9d0a0', 'feina:documenta': 'f9d0a0', 'feina:presenta': 'f9d0a0',
    'feina:revisa': 'f9d0a0', 'treballant': 'e0a040', 'peticio': '1f5fa8',
  };
  for (let t = 1; t <= 8; t++) ETIQUETES['tema:' + t] = 'e3f2e8';

  const $ = id => document.getElementById(id);
  let token = '';
  let issues = [];
  let arbre = null;          // fitxers del repositori (git tree), es carrega quan cal

  // ---------- emmagatzematge del token ----------
  function llegeixToken() { try { return localStorage.getItem(CLAU) || ''; } catch (e) { return token; } }
  function desaToken(t) { token = t; try { t ? localStorage.setItem(CLAU, t) : localStorage.removeItem(CLAU); } catch (e) {} }

  // ---------- API ----------
  async function api(cami, opcions = {}) {
    const r = await fetch(API + cami, {
      ...opcions,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
                 'X-GitHub-Api-Version': '2022-11-28', ...(opcions.headers || {}) },
    });
    if (!r.ok) {
      let msg = r.status + ' ' + r.statusText;
      try { const j = await r.json(); if (j.message) msg += ': ' + j.message; } catch (e) {}
      const err = new Error(msg); err.status = r.status; throw err;
    }
    if (r.status === 204) return null;
    return opcions.cru ? r : r.json();
  }
  const json = (metode, cos) => ({ method: metode, body: JSON.stringify(cos), headers: { 'Content-Type': 'application/json' } });

  async function carregaIssues() {
    const tot = [];
    for (let p = 1; p <= 5; p++) {
      const pag = await api(`/repos/${REPO}/issues?state=all&per_page=100&page=${p}`);
      tot.push(...pag.filter(i => !i.pull_request));
      if (pag.length < 100) break;
    }
    issues = tot;
  }

  async function asseguraEtiquetes() {
    const hi = new Set((await api(`/repos/${REPO}/labels?per_page=100`)).map(l => l.name));
    for (const [nom, color] of Object.entries(ETIQUETES)) {
      if (!hi.has(nom)) await api(`/repos/${REPO}/labels`, json('POST', { name: nom, color }));
    }
  }

  // ---------- utilitats ----------
  const noms = i => i.labels.map(l => l.name);
  const fase = i => (noms(i).find(n => n.startsWith('fase:')) || '').slice(5);
  const tema = i => (noms(i).find(n => n.startsWith('tema:')) || '').slice(5);
  const feina = i => (noms(i).find(n => n.startsWith('feina:')) || '').slice(6);
  const esPeticio = i => noms(i).includes('peticio');
  function el(tag, attrs = {}, ...fills) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'onclick') e.addEventListener('click', v);
      else if (k === 'class') e.className = v;
      else if (v !== undefined && v !== null) e.setAttribute(k, v);
    }
    for (const f of fills) if (f !== null && f !== undefined) e.append(f.nodeType ? f : document.createTextNode(f));
    return e;
  }
  function markdown(text) {
    const div = el('div', { class: 'cos' });
    div.innerHTML = DOMPurify.sanitize(marked.parse(text || ''));
    div.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
    return div;
  }
  function quan(data) {
    const d = new Date(data);
    return d.toLocaleString('ca', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function ganxo(i) {
    const m = /\*\*Ganxo:\*\*\s*(.+)/.exec(i.body || '');
    return m ? m[1].trim() : (i.body || '').split('\n').find(l => l.trim()) || '';
  }

  async function posaEtiquetes(i, treu, posa) {
    const nou = new Set(noms(i));
    treu.forEach(n => { for (const x of [...nou]) if (n.endsWith('*') ? x.startsWith(n.slice(0, -1)) : x === n) nou.delete(x); });
    posa.forEach(n => nou.add(n));
    const r = await api(`/repos/${REPO}/issues/${i.number}/labels`, json('PUT', { labels: [...nou] }));
    i.labels = r;
  }
  const comenta = (i, text) => api(`/repos/${REPO}/issues/${i.number}/comments`, json('POST', { body: text }));

  // Envolta una acció: desactiva el botó, mostra l'error si n'hi ha i redibuixa
  function accio(fn) {
    return async ev => {
      const b = ev && ev.currentTarget; if (b) b.disabled = true;
      try { await fn(); dibuixa(); }
      catch (e) { alert('No s\'ha pogut fer: ' + e.message); }
      finally { if (b) b.disabled = false; }
    };
  }

  // ---------- diàleg ----------
  function obreDialeg(titol, ...contingut) {
    $('dlgTitol').textContent = titol;
    const cos = $('dlgCos'); cos.replaceChildren(...contingut);
    $('dlg').showModal();
    return cos;
  }
  const tancaDialeg = () => $('dlg').close();

  function demanaText(titol, etiqueta, opcional) {
    return new Promise(resol => {
      const ta = el('textarea', { rows: 6, placeholder: opcional ? '(opcional)' : '' });
      const f = el('form', {}, el('label', {}, etiqueta, ta),
        el('div', { class: 'botons' }, el('button', { class: 'primari' }, 'D\'acord'),
          el('button', { type: 'button', onclick: () => { tancaDialeg(); resol(null); } }, 'Cancel·la')));
      f.addEventListener('submit', e => { e.preventDefault();
        if (!opcional && !ta.value.trim()) return; tancaDialeg(); resol(ta.value.trim()); });
      obreDialeg(titol, f); ta.focus();
      $('dlg').addEventListener('close', () => resol(null), { once: true });
    });
  }

  // ---------- accions de les targetes ----------
  const accepta = i => accio(async () => posaEtiquetes(i, ['fase:*', 'feina:*'], ['fase:acceptat', 'feina:documenta']));
  const presenta = i => accio(async () => posaEtiquetes(i, ['feina:*'], ['feina:presenta']));
  const documenta = i => accio(async () => posaEtiquetes(i, ['feina:*'], ['feina:documenta']));
  const llest = i => accio(async () => posaEtiquetes(i, ['fase:*'], ['fase:llest']));
  const torna = (i, f) => accio(async () => posaEtiquetes(i, ['fase:*'], ['fase:' + f]));
  const descarta = i => accio(async () => {
    const motiu = await demanaText('Descarta #' + i.number, 'Per què el descartes? L\'explorador ho tindrà en compte.', true);
    if (motiu === null) return;
    if (motiu) await comenta(i, '**Descartat:** ' + motiu);
    await posaEtiquetes(i, ['fase:*', 'feina:*'], ['fase:descartat']);
    Object.assign(i, await api(`/repos/${REPO}/issues/${i.number}`, json('PATCH', { state: 'closed', state_reason: 'not_planned' })));
  });
  const recupera = i => accio(async () => {
    await posaEtiquetes(i, ['fase:*'], ['fase:proposta']);
    Object.assign(i, await api(`/repos/${REPO}/issues/${i.number}`, json('PATCH', { state: 'open' })));
  });
  const canvis = i => accio(async () => {
    const text = await demanaText('Canvis a #' + i.number, 'Què cal canviar? L\'agent de la fase actual ho refarà.', false);
    if (!text) return;
    await comenta(i, '**Canvis demanats:** ' + text);
    await posaEtiquetes(i, ['feina:*'], ['feina:revisa']);
  });

  // ---------- fitxers ----------
  async function carregaArbre(forca) {
    if (arbre && !forca) return arbre;
    const t = await api(`/repos/${REPO}/git/trees/main?recursive=1`);
    arbre = t.tree.filter(x => x.type === 'blob').map(x => x.path);
    return arbre;
  }
  const carpetaDe = (i, fitxers) => {
    const pref = 'temes/' + String(i.number).padStart(3, '0') + '_';
    const f = fitxers.find(p => p.startsWith(pref));
    return f ? f.split('/').slice(0, 2).join('/') : null;
  };
  async function descarrega(cami) {
    const r = await api(`/repos/${REPO}/contents/${cami.split('/').map(encodeURIComponent).join('/')}`,
      { headers: { Accept: 'application/vnd.github.raw+json' }, cru: true });
    return r.blob();
  }
  async function mostraFitxer(cami, on) {
    on.replaceChildren(el('p', { class: 'nota' }, 'Carregant ' + cami + '…'));
    const blob = await descarrega(cami);
    const ext = cami.split('.').pop().toLowerCase();
    const tipus = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' }[ext];
    if (tipus) {
      const url = URL.createObjectURL(new Blob([blob], { type: tipus }));
      if (ext === 'pdf') {
        on.replaceChildren(el('p', {}, el('a', { href: url, target: '_blank' }, 'Obre ' + cami.split('/').pop()),
          ' · ', el('a', { href: url, download: cami.split('/').pop() }, 'descarrega')));
        window.open(url, '_blank');
      } else on.replaceChildren(el('img', { src: url, alt: cami }));
      return;
    }
    const text = await blob.text();
    on.replaceChildren(ext === 'md' ? markdown(text) : el('pre', {}, text));
  }
  const fitxers = i => accio(async () => {
    const tots = await carregaArbre(true);
    const carpeta = carpetaDe(i, tots);
    if (!carpeta) { obreDialeg('#' + i.number + ' · fitxers', el('p', {}, 'Encara no hi ha carpeta per a aquest tema.')); return; }
    const vista = el('div', { class: 'fitxer-vista' });
    const llista = el('ul', { class: 'fitxers' });
    let dirAnt = '';
    const ordre = p => (/\/(dossier|guio|presentacio|objectes|resposta_classe|proposta)\./.test(p) ? '0' : '1') + p;
    tots.filter(p => p.startsWith(carpeta + '/') && !p.endsWith('.gitkeep'))
      .sort((a, b) => ordre(a).localeCompare(ordre(b)))
      .forEach(p => {
        const rel = p.slice(carpeta.length + 1);
        const dir = rel.includes('/') ? rel.split('/')[0] : '';
        if (dir !== dirAnt) { llista.append(el('li', { class: 'dir' }, dir + '/')); dirAnt = dir; }
        llista.append(el('li', {}, el('button', { onclick: () => mostraFitxer(p, vista).catch(e => vista.replaceChildren(el('p', { class: 'error' }, e.message))) }, rel)));
      });
    obreDialeg(carpeta, llista, vista);
    const dossier = tots.find(p => p === carpeta + '/dossier.md') || tots.find(p => p === carpeta + '/proposta.md');
    if (dossier) mostraFitxer(dossier, vista);
  });

  async function historial(i, on) {
    const cs = await api(`/repos/${REPO}/issues/${i.number}/comments?per_page=100`);
    on.replaceChildren(...(cs.length ? cs.map(c => el('div', { class: 'comentari' },
      el('div', { class: 'qui' }, quan(c.created_at)), markdown(c.body))) : [el('p', { class: 'nota' }, 'Sense comentaris.')]));
  }

  // ---------- dibuix ----------
  function targeta(i) {
    const f = fase(i), fe = feina(i), t = tema(i);
    const xips = el('div', { class: 'xips' });
    if (t) xips.append(el('span', { class: 'xip tema' }, 'Tema ' + t));
    if (noms(i).includes('treballant')) xips.append(el('span', { class: 'xip treballant' }, 'treballant…'));
    else if (fe) xips.append(el('span', { class: 'xip cua' }, FEINES[fe] || fe));
    const botons = el('div', { class: 'botons' });
    const ocupat = !!fe;
    const b = (text, fn, cls) => { const x = el('button', { class: cls || '', onclick: fn }, text); x.disabled = ocupat && fn !== null && cls !== 'sempre'; return x; };
    if (f === 'proposta') botons.append(b('Accepta', accepta(i), 'primari'), b('Descarta', descarta(i), 'perill'), b('Canvia-la', canvis(i)));
    if (f === 'acceptat') botons.append(b('Documenta', documenta(i)), b('Fitxers', fitxers(i), 'sempre'));
    if (f === 'documentat') botons.append(b('Fes la presentació', presenta(i), 'primari'), b('Demana canvis', canvis(i)), b('Fitxers', fitxers(i), 'sempre'));
    if (f === 'presentat') botons.append(b('Llest', llest(i), 'primari'), b('Demana canvis', canvis(i)), b('Fitxers', fitxers(i), 'sempre'));
    if (f === 'llest') botons.append(b('Fitxers', fitxers(i), 'sempre'), b('Torna a presentat', torna(i, 'presentat')));
    if (f === 'descartat') botons.append(b('Recupera', recupera(i)));

    const mes = el('details', { class: 'mes' }, el('summary', {}, 'detalls i historial'));
    let carregat = false;
    mes.addEventListener('toggle', () => {
      if (!mes.open || carregat) return; carregat = true;
      const com = el('div', { class: 'comentaris' }, el('p', { class: 'nota' }, 'Carregant…'));
      mes.append(markdown(i.body), com);
      historial(i, com).catch(e => com.replaceChildren(el('p', { class: 'error' }, e.message)));
    });
    return el('article', { class: 'targeta' },
      el('h3', {}, el('span', { class: 'num' }, '#' + i.number), i.title),
      xips, el('div', { class: 'resum' }, ganxo(i)), botons, mes);
  }

  function dibuixa() {
    const obertes = issues.filter(i => !esPeticio(i));
    const cols = $('columnes'); cols.replaceChildren();
    for (const F of FASES) {
      const aquestes = obertes.filter(i => fase(i) === F.id).sort((a, b) => b.number - a.number);
      const col = el('section', { class: 'columna' }, el('h2', {}, F.titol, el('span', {}, String(aquestes.length))));
      if (!aquestes.length) col.append(el('div', { class: 'buida' }, F.id === 'proposta' ? 'Cap proposta. Demana\'n de noves.' : '—'));
      aquestes.forEach(i => col.append(targeta(i)));
      cols.append(col);
    }
    const pet = $('peticions'); pet.replaceChildren();
    issues.filter(i => esPeticio(i) && i.state === 'open').forEach(i => pet.append(el('div', { class: 'peticio' },
      noms(i).includes('treballant') ? '🔎 Buscant propostes: ' : '⏳ A la cua: ', i.title.replace(/^Explora:\s*/, ''))));
    const desc = $('descartats');
    desc.hidden = !$('vDescartats').checked;
    desc.replaceChildren(el('h2', {}, 'Descartats'), ...issues.filter(i => fase(i) === 'descartat').map(targeta));
  }

  async function refresca() {
    $('estat').textContent = 'Carregant…';
    await carregaIssues();
    dibuixa();
    let ultim = '';
    try { const c = await api(`/repos/${REPO}/commits?per_page=1`); ultim = ' · última feina desada: ' + quan(c[0].commit.author.date); } catch (e) {}
    const cua = issues.filter(i => i.state === 'open' && feina(i)).length;
    $('estat').textContent = `${cua ? cua + ' a la cua' : 'Cua buida'} · actualitzat ${quan(new Date())}${ultim}. ` +
      'La feina la fa Claude Code amb /taller a l\'ordinador.';
  }

  // ---------- peticions i esquema ----------
  function demanaPropostes() {
    const enfoc = el('input', { placeholder: 'p. ex. fenòmens de cuina, materials del mòbil, superconductivitat…' });
    const selTema = el('select', {}, el('option', { value: '' }, 'qualsevol'),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map(t => el('option', { value: t }, 'Tema ' + t)));
    const quantes = el('input', { type: 'number', min: 1, max: 15, value: 8 });
    const f = el('form', {},
      el('label', {}, 'Enfocament (opcional)', enfoc),
      el('label', {}, 'Tema del curs', selTema),
      el('label', {}, 'Quantes propostes', quantes),
      el('div', { class: 'botons' }, el('button', { class: 'primari' }, 'Envia a la cua')));
    f.addEventListener('submit', ev => ev.preventDefault());
    f.addEventListener('submit', accio(async () => {
      const e = enfoc.value.trim(), t = selTema.value, n = Math.max(1, Math.min(15, +quantes.value || 8));
      const cos = `**Enfocament:** ${e || 'lliure'}\n\n**Tema del curs:** ${t ? 'Tema ' + t : 'qualsevol'}\n\n**Quantes propostes:** ${n}`;
      await api(`/repos/${REPO}/issues`, json('POST', {
        title: 'Explora: ' + (e || (t ? 'Tema ' + t : 'temes variats')), body: cos, labels: ['peticio', 'feina:explora'] }));
      tancaDialeg(); await carregaIssues();
    }));
    obreDialeg('Demana propostes noves', f); enfoc.focus();
  }

  const b64 = s => { const bytes = new TextEncoder().encode(s); let bin = ''; bytes.forEach(x => bin += String.fromCharCode(x)); return btoa(bin); };
  const deB64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), c => c.charCodeAt(0)));
  async function esquema() {
    const cos = obreDialeg('Esquema del vídeo', el('p', { class: 'nota' }, 'Carregant…'));
    const f = await api(`/repos/${REPO}/contents/esquema_video.md`);
    const ta = el('textarea', { rows: 24 }); ta.value = deB64(f.content);
    const vista = el('div', { class: 'fitxer-vista' });
    const form = el('form', {},
      el('p', { class: 'nota' }, 'El presentador llegeix aquest fitxer cada vegada que fa una presentació.'),
      ta, el('div', { class: 'botons' }, el('button', { class: 'primari' }, 'Desa'),
        el('button', { type: 'button', onclick: () => vista.replaceChildren(markdown(ta.value)) }, 'Previsualitza')), vista);
    form.addEventListener('submit', ev => { ev.preventDefault(); });
    form.addEventListener('submit', accio(async () => {
      await api(`/repos/${REPO}/contents/esquema_video.md`, json('PUT', {
        message: 'Esquema del vídeo editat des del taulell', content: b64(ta.value), sha: f.sha }));
      tancaDialeg();
    }));
    cos.replaceChildren(form);
  }

  // ---------- inici ----------
  async function entra() {
    try {
      await api(`/repos/${REPO}`);
    } catch (e) {
      $('porta').hidden = false; $('taulell').hidden = true; $('accions').hidden = true;
      $('errPorta').textContent = e.status === 401 ? 'Token no vàlid.' : e.status === 404 ? 'Aquest token no té accés al repositori.' : e.message;
      return;
    }
    $('porta').hidden = true; $('taulell').hidden = false; $('accions').hidden = false;
    try { await asseguraEtiquetes(); } catch (e) { console.warn('etiquetes:', e.message); }
    await refresca().catch(e => { $('estat').textContent = 'Error: ' + e.message; });
  }

  $('fToken').addEventListener('submit', ev => { ev.preventDefault(); desaToken($('token').value.trim()); $('token').value = ''; entra(); });
  $('bSurt').addEventListener('click', () => { desaToken(''); location.reload(); });
  $('bRefresca').addEventListener('click', accio(refresca));
  $('bPropostes').addEventListener('click', demanaPropostes);
  $('bEsquema').addEventListener('click', () => esquema().catch(e => alert(e.message)));
  $('vDescartats').addEventListener('change', dibuixa);
  setInterval(() => { if (token && !document.hidden && !$('dlg').open) refresca().catch(() => {}); }, 60000);

  token = llegeixToken();
  if (token) entra(); else $('porta').hidden = false;
})();
