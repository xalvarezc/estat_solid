// Taulell del taller de vídeos.
//
// Pàgina estàtica: totes les dades són les issues i els fitxers del repositori privat
// xalvarezc/taller_videos, que es llegeixen i s'escriuen amb l'API de GitHub i el token
// (fine-grained, només per a aquest repositori) que el professor enganxa a la porta.
// La feina la fa Claude Code a l'ordinador del professor: el vigilant (eines/vigila_cua.sh) mira
// la cua cada minut, llança /taller quan hi ha feina i publica el seu estat a la issue «Estat del
// treballador» (etiqueta «estat»), que aquí es mostra al panell. Els interruptors del panell són
// etiquetes d'aquella issue («pausa», «atura»); els topalls són al fitxer config_taller.json.
(function () {
  'use strict';
  const REPO = 'xalvarezc/taller_videos';
  const API = 'https://api.github.com';
  const CLAU = 'taller_token';
  const MIDES = [15, 17, 19, 21];   // mides de lletra (px) del control A− / A+

  const SECCIONS = [
    { id: 'idea',       titol: 'Idees triades',      buida: 'Cap. Tria idees de la llista d\'una petició.' },
    { id: 'proposta',   titol: 'Propostes',          buida: 'Cap proposta. Demana idees noves.' },
    { id: 'acceptat',   titol: 'Acceptats',          buida: '—' },
    { id: 'documentat', titol: 'Documentats',        buida: '—' },
    { id: 'presentat',  titol: 'Presentats',         buida: '—' },
    { id: 'llest',      titol: 'Llestos per gravar', buida: '—' },
  ];
  const FEINES = { explora: 'a la cua: idees', proposa: 'a la cua: desenvolupar', documenta: 'a la cua: documentar',
                   presenta: 'a la cua: presentació', revisa: 'a la cua: canvis' };
  const ETIQUETES = {
    'fase:idees': 'dbe9f7', 'fase:idea': 'e8d9f7', 'fase:proposta': 'c5def5', 'fase:acceptat': 'bfe5bf',
    'fase:documentat': '8fd19e', 'fase:presentat': '4caf50', 'fase:llest': '00843d', 'fase:descartat': 'cccccc',
    'feina:explora': 'f9d0a0', 'feina:proposa': 'f9d0a0', 'feina:documenta': 'f9d0a0', 'feina:presenta': 'f9d0a0',
    'feina:revisa': 'f9d0a0', 'treballant': 'e0a040', 'peticio': '1f5fa8',
    'estat': '6a737d', 'pausa': 'd93f0b', 'atura': 'b60205',
  };
  for (let t = 1; t <= 8; t++) ETIQUETES['tema:' + t] = 'e3f2e8';

  const $ = id => document.getElementById(id);
  // Qualsevol error de JavaScript es mostra a la pàgina (en lloc de deixar-la en blanc).
  function avisa(text) {
    let b = $('avis');
    if (!b) { b = document.createElement('div'); b.id = 'avis'; b.className = 'avis'; document.querySelector('main').prepend(b); }
    b.textContent = text;
  }
  window.addEventListener('error', e => avisa('Error a la pàgina: ' + e.message + ' (línia ' + e.lineno + '). Recarrega-la del tot (Ctrl+Maj+R).'));
  window.addEventListener('unhandledrejection', e => avisa('Error: ' + ((e.reason && e.reason.message) || e.reason) + '. Recarrega la pàgina.'));
  let token = '';
  let issues = [];
  let arbre = null;                // fitxers del repositori (git tree), es carrega quan cal
  let signatura = '';              // estat de les issues l'últim cop que s'ha dibuixat: si no canvia, no es redibuixa
  const detallsOberts = new Set(); // targetes i llistes d'idees obertes: es mantenen obertes en refrescar
  let mostraDescartats = false;

  // ---------- emmagatzematge del navegador ----------
  const desa = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const llegeix = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  function llegeixToken() { return llegeix(CLAU, token); }
  function desaToken(t) { token = t; desa(CLAU, t || null); }
  const plegades = new Set((() => { try { return JSON.parse(llegeix('taller_plegades', '[]')); } catch (e) { return []; } })());
  let lletra = Math.min(MIDES.length - 1, Math.max(0, +llegeix('taller_lletra', 1) || 0));

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
  const enc = cami => cami.split('/').map(encodeURIComponent).join('/');

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
  const esEstat = i => noms(i).includes('estat');
  const treballant = i => noms(i).includes('treballant');
  function el(tag, attrs = {}, ...fills) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'onclick') e.addEventListener('click', v);
      else if (k === 'class') e.className = v;
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    for (const f of fills) if (f !== null && f !== undefined && f !== false) e.append(f.nodeType ? f : document.createTextNode(f));
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
  const minutsDes = iso => Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  function durada(min) {
    if (min < 1) return 'menys d\'un minut';
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60);
    if (h < 48) return h + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : '');
    return Math.floor(h / 24) + ' dies';
  }
  const k = n => !n ? '0' : n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' M' : n >= 1e3 ? Math.round(n / 1e3) + ' k' : String(n);
  function ganxo(i) {
    const m = /\*\*(?:Ganxo|Idea):\*\*\s*(.+)/.exec(i.body || '');
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
      let fet = false;
      const acaba = v => { if (fet) return; fet = true; tancaDialeg(); resol(v); };
      const ta = el('textarea', { rows: 6, placeholder: opcional ? '(opcional)' : '' });
      const f = el('form', {}, el('label', {}, etiqueta, ta),
        el('div', { class: 'botons' }, el('button', { class: 'primari' }, 'D\'acord'),
          el('button', { type: 'button', onclick: () => acaba(null) }, 'Cancel·la')));
      f.addEventListener('submit', e => { e.preventDefault(); if (!opcional && !ta.value.trim()) return; acaba(ta.value.trim()); });
      obreDialeg(titol, f); ta.focus();
      $('dlg').addEventListener('close', () => { if (!fet) { fet = true; resol(null); } }, { once: true });
    });
  }

  // Diàleg amb indicacions opcionals per a l'agent i un o més botons d'acció. Retorna { valor, text } o null.
  function demanaIndicacions(titol, explicacio, botons) {
    return new Promise(resol => {
      let fet = false;
      const acaba = v => { if (fet) return; fet = true; tancaDialeg(); resol(v); };
      const ta = el('textarea', { rows: 5, placeholder: '(opcional) p. ex. centra\'t en…, fes servir aquest objecte…, evita…' });
      const f = el('form', {}, el('label', {}, explicacio, ta),
        el('div', { class: 'botons' },
          ...botons.map(b => el('button', { type: 'button', class: b.primari ? 'primari' : '',
            onclick: () => acaba({ valor: b.valor, text: ta.value.trim() }) }, b.text)),
          el('button', { type: 'button', onclick: () => acaba(null) }, 'Cancel·la')));
      f.addEventListener('submit', e => e.preventDefault());
      obreDialeg(titol, f); ta.focus();
      $('dlg').addEventListener('close', () => { if (!fet) { fet = true; resol(null); } }, { once: true });
    });
  }

  // ---------- accions de les targetes ----------
  // Les indicacions es desen com a comentari; l'agent les llegeix abans de començar.
  const INDICA_DOC = 'Indicacions per al documentalista (opcional). Les llegirà abans de començar.';
  const INDICA_PRE = 'Indicacions per al presentador (opcional). Les llegirà abans de començar.';
  const accepta = i => accio(async () => {
    const r = await demanaIndicacions('Accepta #' + i.number, INDICA_DOC,
      [{ text: 'Accepta i documenta', valor: 'documenta', primari: true }, { text: 'Només accepta', valor: 'accepta' }]);
    if (!r) return;
    if (r.text) await comenta(i, '**Indicacions per al documentalista:** ' + r.text);
    await posaEtiquetes(i, ['fase:*', 'feina:*'], r.valor === 'documenta' ? ['fase:acceptat', 'feina:documenta'] : ['fase:acceptat']);
  });
  const documenta = i => accio(async () => {
    const r = await demanaIndicacions('Documenta #' + i.number, INDICA_DOC, [{ text: 'Documenta', valor: 'si', primari: true }]);
    if (!r) return;
    if (r.text) await comenta(i, '**Indicacions per al documentalista:** ' + r.text);
    await posaEtiquetes(i, ['feina:*'], ['feina:documenta']);
  });
  const presenta = i => accio(async () => {
    const r = await demanaIndicacions('Presentació de #' + i.number, INDICA_PRE, [{ text: 'Fes la presentació', valor: 'si', primari: true }]);
    if (!r) return;
    if (r.text) await comenta(i, '**Indicacions per al presentador:** ' + r.text);
    await posaEtiquetes(i, ['feina:*'], ['feina:presenta']);
  });
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
    const r = await api(`/repos/${REPO}/contents/${enc(cami)}`, { headers: { Accept: 'application/vnd.github.raw+json' }, cru: true });
    return r.blob();
  }
  const EDITABLE = /\.(md|tex|txt|py|csv|json)$/i;
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
    const cap = el('div', { class: 'fitxer-cap' }, el('span', { class: 'nota' }, cami),
      EDITABLE.test(cami) ? el('button', { onclick: () => editaFitxer(cami, on).catch(e => on.replaceChildren(el('p', { class: 'error' }, e.message))) }, '✎ Edita') : null);
    on.replaceChildren(cap, ext === 'md' ? markdown(text) : el('pre', {}, text));
  }
  // Edició directa d'un fitxer de text: es desa com a commit al repositori.
  async function editaFitxer(cami, on) {
    on.replaceChildren(el('p', { class: 'nota' }, 'Carregant…'));
    const f = await api(`/repos/${REPO}/contents/${enc(cami)}`);
    const ta = el('textarea', { rows: 20 }); ta.value = deB64(f.content);
    const form = el('form', {},
      el('p', { class: 'nota' }, 'Edites ' + cami + '. Es desa al repositori; els agents partiran d\'aquesta versió.' +
        (/\.tex$/i.test(cami) ? ' El PDF no es regenera fins que demanis canvis o una presentació nova.' : '')),
      ta, el('div', { class: 'botons' }, el('button', { class: 'primari' }, 'Desa'),
        el('button', { type: 'button', onclick: () => mostraFitxer(cami, on) }, 'Cancel·la')));
    form.addEventListener('submit', ev => ev.preventDefault());
    form.addEventListener('submit', accio(async () => {
      await api(`/repos/${REPO}/contents/${enc(cami)}`, json('PUT', {
        message: cami.split('/').pop() + ' editat des del taulell', content: b64(ta.value), sha: f.sha }));
      await mostraFitxer(cami, on);
    }));
    on.replaceChildren(form);
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

  // ---------- el treballador: estat, panell, topalls ----------
  function estatTreballador() {
    const i = issues.find(x => esEstat(x) && x.state === 'open');
    if (!i) return null;
    const m = /<!-- estat\n([\s\S]*?)\n-->/.exec(i.body || '');
    let dades = null;
    try { dades = m ? JSON.parse(m[1]) : null; } catch (e) {}
    return { issue: i, dades, pausa: noms(i).includes('pausa'), atura: noms(i).includes('atura') };
  }
  const xifra = (v, t) => el('div', { class: 'xifra' }, el('b', {}, String(v)), el('span', {}, t));

  function dibuixaPanell() {
    const p = $('panell'); p.replaceChildren();
    const e = estatTreballador();
    const d = e && e.dades;
    const cua = issues.filter(i => i.state === 'open' && !esEstat(i) && feina(i));
    const vist = d ? minutsDes(d.vist) : null;
    let classe, titol, detall;
    if (!d) {
      classe = 'apagat'; titol = 'Vigilant no engegat';
      detall = 'Encara no ha publicat cap estat. A l\'ordinador cal instal·lar el cron (vegeu el README del repositori).';
    } else if (vist > 10) {
      classe = 'apagat'; titol = 'Sense senyal del vigilant';
      detall = `No s'ha vist des de fa ${durada(vist)}: l'ordinador és apagat o el cron no corre. La cua s'atendrà quan torni.`;
    } else if (e.pausa) {
      classe = 'pausa'; titol = 'En pausa';
      detall = 'No comença cap feina nova' + (d.estat === 'treballant' ? '; acaba la que té en marxa' : '') + '.' + (d.nota ? ' ' + d.nota : '');
    } else if (d.estat === 'treballant' && d.feina) {
      classe = 'treballant'; titol = 'Treballant';
      detall = d.feina.issues.map(n => '#' + n).join(', ') + ' · des de fa ' + durada(minutsDes(d.feina.inici)) + (d.feina.ara ? ' · ' + d.feina.ara : '');
    } else {
      classe = 'lliure'; titol = cua.length ? 'En espera' : 'Lliure';
      detall = (cua.length ? `${cua.length} a la cua: comença en menys d'un minut.` : 'Cua buida.') + (d.nota ? ' ' + d.nota : '');
    }
    const avui = d && d.avui;
    const xifres = el('div', { class: 'xifres' },
      xifra(cua.length, 'a la cua'),
      xifra(avui ? `${avui.feines} / ${avui.limit}` : '—', 'feines avui'),
      xifra(avui ? k(avui.tokens_nous) : '—', 'tokens nous avui'),
      xifra(avui ? avui.cost_usd.toFixed(2) + ' $' : '—', 'equivalent API avui'));
    const botons = el('div', { class: 'botons' });
    if (e) {
      botons.append(el('button', { class: e.pausa ? 'primari' : '',
        onclick: accio(async () => posaEtiquetes(e.issue, e.pausa ? ['pausa'] : [], e.pausa ? [] : ['pausa'])) }, e.pausa ? '▶ Reprèn' : '⏸ Pausa'));
      if (d && d.estat === 'treballant') botons.append(el('button', { class: 'perill', disabled: e.atura,
        onclick: accio(async () => posaEtiquetes(e.issue, [], ['atura'])) }, e.atura ? '⏹ Aturant…' : '⏹ Atura'));
    }
    botons.append(el('button', { onclick: () => configuracio().catch(x => alert(x.message)) }, '⚙ Topalls'));
    if (d && d.ultimes && d.ultimes.length) botons.append(el('button', { onclick: () => registre(d) }, '📋 Registre'));
    p.append(el('div', { class: 'panell ' + classe },
      el('div', { class: 'semafor' }),
      el('div', { class: 'panell-text' },
        el('div', { class: 'panell-titol' }, titol, d ? el('span', { class: 'vist' }, ' · vist fa ' + durada(vist)) : null),
        el('div', { class: 'panell-detall' }, detall)),
      xifres, botons));
  }

  async function configuracio() {
    const cos = obreDialeg('Topalls del vigilant', el('p', { class: 'nota' }, 'Carregant…'));
    const f = await api(`/repos/${REPO}/contents/config_taller.json`);
    const cfg = JSON.parse(deB64(f.content));
    const camp = (clau, text, min, max) => { const i = el('input', { type: 'number', min, max, value: cfg[clau] }); return [el('label', {}, text, i), i]; };
    const [l1, i1] = camp('max_per_passada', 'Feines alhora en una passada', 1, 6);
    const [l2, i2] = camp('max_feines_dia', 'Feines al dia (s\'esperen a l\'endemà si se supera)', 1, 40);
    const [l3, i3] = camp('max_minuts_passada', 'Minuts com a màxim per passada (després s\'atura)', 10, 240);
    const form = el('form', {},
      el('p', { class: 'nota' }, 'El vigilant els llegeix abans de cada passada. Avui, desenvolupar una proposta ha costat uns 25–30 k tokens nous; una documentació en costarà més.'),
      l1, l2, l3, el('div', { class: 'botons' }, el('button', { class: 'primari' }, 'Desa')));
    form.addEventListener('submit', ev => ev.preventDefault());
    form.addEventListener('submit', accio(async () => {
      const nou = { max_per_passada: +i1.value || 1, max_feines_dia: +i2.value || 1, max_minuts_passada: +i3.value || 30 };
      await api(`/repos/${REPO}/contents/config_taller.json`, json('PUT', {
        message: 'Topalls editats des del taulell', content: b64(JSON.stringify(nou, null, 2) + '\n'), sha: f.sha }));
      tancaDialeg();
    }));
    cos.replaceChildren(form);
  }

  const RESULTATS = { ok: '✅ fet', error: '⚠️ error', aturat: '⏹ aturat', temps: '⏱ temps esgotat' };
  function registre(d) {
    const t = el('table', {}, el('tr', {}, ...['Inici', 'Issues', 'Min', 'Tokens nous', 'Escrits', 'Cost (API)', 'Resultat'].map(x => el('th', {}, x))));
    for (const r of d.ultimes) t.append(el('tr', {},
      el('td', {}, r.inici ? quan(r.inici) : '?'), el('td', {}, (r.issues || []).map(n => '#' + n).join(', ')),
      el('td', {}, r.minuts == null ? '—' : String(r.minuts)), el('td', {}, k(r.tokens_nous)), el('td', {}, k(r.sortida)),
      el('td', {}, r.cost_usd == null ? '—' : r.cost_usd.toFixed(2) + ' $'),
      el('td', {}, (RESULTATS[r.resultat] || r.resultat || '') + (r.nota ? ' — ' + r.nota : ''))));
    obreDialeg('Últimes passades', el('p', { class: 'nota' }, 'Tokens nous: entrada que no és a la memòria cau, més el que escriu. El cost és l\'equivalent en API (es paga amb la subscripció).'), t);
  }

  // ---------- peticions i idees ----------
  // Format de cada idea al comentari de l'explorador:
  //   1. **Títol** — una línia. `tema:5` `casolà` `risc:cap`
  const RE_IDEA = /^\s*(\d+)[.)]\s+\*\*(.+?)\*\*\s*[—–-]+\s*(.*)$/;
  function parseIdees(text) {
    const out = [];
    for (const l of (text || '').split('\n')) {
      const m = RE_IDEA.exec(l); if (!m) continue;
      const tags = [...m[3].matchAll(/`([^`]+)`/g)].map(x => x[1].trim());   // poden ser a qualsevol lloc de la línia
      out.push({ num: +m[1], titol: m[2].trim(), linia: m[3].replace(/`[^`]+`/g, '').replace(/\s+/g, ' ').trim(),
        tema: (tags.find(t => /^tema:\d/.test(t)) || '').slice(5),
        risc: (tags.find(t => /^risc:/.test(t)) || '').slice(5),
        com: tags.find(t => !/^(tema|risc):/.test(t)) || '' });
    }
    return out;
  }
  const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  async function llistaIdees(i, on) {
    on.replaceChildren(el('p', { class: 'nota' }, 'Carregant…'));
    const cs = await api(`/repos/${REPO}/issues/${i.number}/comments?per_page=100`);
    const c = [...cs].reverse().find(x => /###\s*Idees/.test(x.body || ''));
    const idees = c ? parseIdees(c.body) : [];
    if (!idees.length) { on.replaceChildren(el('p', { class: 'nota' }, 'Encara no hi ha la llista d\'idees.')); return; }
    const existents = new Map(issues.filter(x => !esPeticio(x) && !esEstat(x)).map(x => [norm(x.title), x]));
    const caselles = [];
    const ul = el('ul', { class: 'idees' });
    const bDesenv = el('button', { class: 'primari' }, 'Desenvolupa les marcades');
    const actualitza = () => { const n = caselles.filter(([cb]) => cb.checked).length;
      bDesenv.textContent = n ? `Desenvolupa ${n} ${n === 1 ? 'idea' : 'idees'}` : 'Desenvolupa les marcades'; bDesenv.disabled = !n; };
    for (const id of idees) {
      const ex = existents.get(norm(id.titol));
      const cb = el('input', { type: 'checkbox', disabled: !!ex });
      cb.addEventListener('change', actualitza);
      caselles.push([cb, id]);
      ul.append(el('li', { class: ex ? 'feta' : '' }, el('label', {}, cb,
        el('span', { class: 'idea-titol' }, id.titol),
        el('span', { class: 'idea-linia' }, id.linia),
        el('span', { class: 'xips' },
          id.tema ? el('span', { class: 'xip tema' }, 'Tema ' + id.tema) : null,
          id.com ? el('span', { class: 'xip' }, id.com) : null,
          id.risc && id.risc !== 'cap' ? el('span', { class: 'xip risc' }, 'risc ' + id.risc) : null,
          ex ? el('span', { class: 'xip cua' }, 'ja és #' + ex.number + (fase(ex) ? ' · ' + fase(ex) : '')) : null))));
    }
    actualitza();
    bDesenv.addEventListener('click', accio(async () => {
      for (const [cb, id] of caselles) {
        if (!cb.checked) continue;
        const cos = `**Idea:** ${id.linia}\n\n**Tema del curs:** ${id.tema || '?'}\n\n**Com es faria:** ${id.com || '?'} · **Risc d'espòiler:** ${id.risc || '?'}\n\n**Petició:** #${i.number}`;
        await api(`/repos/${REPO}/issues`, json('POST', { title: id.titol, body: cos,
          labels: ['fase:idea', 'feina:proposa', ...(id.tema ? ['tema:' + id.tema] : [])] }));
      }
      await carregaIssues();
    }));
    const bTanca = el('button', { onclick: accio(async () => {
      Object.assign(i, await api(`/repos/${REPO}/issues/${i.number}`, json('PATCH', { state: 'closed', state_reason: 'completed' })));
    }) }, 'Tanca la llista');
    on.replaceChildren(el('p', { class: 'nota' }, idees.length + ' idees. Marca les que vulguis: l\'explorador en farà la proposta amb enllaços comprovats, i et sortiran a «Propostes».'),
      ul, el('div', { class: 'botons' }, bDesenv, bTanca));
  }

  function dibuixaPeticions() {
    const pet = $('peticions'); pet.replaceChildren();
    issues.filter(i => esPeticio(i) && i.state === 'open').sort((a, b) => b.number - a.number).forEach(i => {
      const nom = i.title.replace(/^Explora:\s*/, '');
      if (fase(i) === 'idees' && !feina(i)) {
        const clau = 'p' + i.number;
        const det = el('details', { class: 'peticio idees' }, el('summary', {}, '💡 Idees per triar: ' + nom, el('span', { class: 'num' }, ' #' + i.number)));
        const cos = el('div', { class: 'idees-cos' }); det.append(cos);
        let carregat = false;
        const carrega = () => { if (carregat) return; carregat = true; llistaIdees(i, cos).catch(e => cos.replaceChildren(el('p', { class: 'error' }, e.message))); };
        det.addEventListener('toggle', () => { if (det.open) { detallsOberts.add(clau); carrega(); } else detallsOberts.delete(clau); });
        if (detallsOberts.has(clau)) { det.open = true; carrega(); }
        pet.append(det);
      } else {
        pet.append(el('div', { class: 'peticio' }, treballant(i) ? '🔎 Buscant idees: ' : '⏳ A la cua: ', nom));
      }
    });
  }

  function demanaIdees() {
    const enfoc = el('input', { placeholder: 'p. ex. fenòmens de cuina, materials del mòbil, superconductivitat…' });
    const selTema = el('select', {}, el('option', { value: '' }, 'qualsevol'),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map(t => el('option', { value: t }, 'Tema ' + t)));
    const quantes = el('input', { type: 'number', min: 5, max: 40, value: 20 });
    const f = el('form', {},
      el('p', { class: 'nota' }, 'L\'explorador fa una llista barata d\'idees (sense obrir enllaços). Després tu tries quines es desenvolupen.'),
      el('label', {}, 'Enfocament (opcional)', enfoc),
      el('label', {}, 'Tema del curs', selTema),
      el('label', {}, 'Quantes idees', quantes),
      el('div', { class: 'botons' }, el('button', { class: 'primari' }, 'Envia a la cua')));
    f.addEventListener('submit', ev => ev.preventDefault());
    f.addEventListener('submit', accio(async () => {
      const e = enfoc.value.trim(), t = selTema.value, n = Math.max(5, Math.min(40, +quantes.value || 20));
      const cos = `**Enfocament:** ${e || 'lliure'}\n\n**Tema del curs:** ${t ? 'Tema ' + t : 'qualsevol'}\n\n**Quantes idees:** ${n}`;
      await api(`/repos/${REPO}/issues`, json('POST', {
        title: 'Explora: ' + (e || (t ? 'Tema ' + t : 'temes variats')), body: cos, labels: ['peticio', 'feina:explora'] }));
      tancaDialeg(); await carregaIssues();
    }));
    obreDialeg('Demana idees noves', f); enfoc.focus();
  }

  // ---------- targetes i seccions ----------
  function targeta(i) {
    const f = fase(i), fe = feina(i), t = tema(i);
    const xips = el('div', { class: 'xips' });
    if (t) xips.append(el('span', { class: 'xip tema' }, 'Tema ' + t));
    if (treballant(i)) xips.append(el('span', { class: 'xip treballant' }, 'treballant…'));
    else if (fe) xips.append(el('span', { class: 'xip cua' }, FEINES[fe] || fe));
    const botons = el('div', { class: 'botons' });
    const ocupat = !!fe;
    const b = (text, fn, cls) => { const x = el('button', { class: cls || '', onclick: fn }, text); x.disabled = ocupat && cls !== 'sempre'; return x; };
    if (f === 'idea') botons.append(b('Descarta', descarta(i), 'perill'));
    if (f === 'proposta') botons.append(b('Accepta', accepta(i), 'primari'), b('Descarta', descarta(i), 'perill'), b('Canvia-la', canvis(i)));
    if (f === 'acceptat') botons.append(b('Documenta', documenta(i), 'primari'), b('Fitxers', fitxers(i), 'sempre'));
    if (f === 'documentat') botons.append(b('Fes la presentació', presenta(i), 'primari'), b('Demana canvis', canvis(i)), b('Fitxers', fitxers(i), 'sempre'));
    if (f === 'presentat') botons.append(b('Llest', llest(i), 'primari'), b('Demana canvis', canvis(i)), b('Fitxers', fitxers(i), 'sempre'));
    if (f === 'llest') botons.append(b('Fitxers', fitxers(i), 'sempre'), b('Torna a presentat', torna(i, 'presentat')));
    if (f === 'descartat') botons.append(b('Recupera', recupera(i)));

    const mes = el('details', { class: 'mes' }, el('summary', {}, 'detalls i historial'));
    let carregat = false;
    const carrega = () => {
      if (carregat) return; carregat = true;
      const com = el('div', { class: 'comentaris' }, el('p', { class: 'nota' }, 'Carregant…'));
      mes.append(markdown(i.body), com);
      historial(i, com).catch(e => com.replaceChildren(el('p', { class: 'error' }, e.message)));
    };
    mes.addEventListener('toggle', () => { if (mes.open) { detallsOberts.add(i.number); carrega(); } else detallsOberts.delete(i.number); });
    if (detallsOberts.has(i.number)) { mes.open = true; carrega(); }
    return el('article', { class: 'targeta' },
      el('h3', {}, el('span', { class: 'num' }, '#' + i.number), i.title),
      xips, el('div', { class: 'resum' }, ganxo(i)), botons, mes);
  }

  function dibuixa() {
    const temes = issues.filter(i => !esPeticio(i) && !esEstat(i));
    const cols = $('columnes'); cols.replaceChildren();
    const salts = $('salts'); salts.replaceChildren();
    for (const F of SECCIONS) {
      const aquestes = temes.filter(i => fase(i) === F.id).sort((a, b) => b.number - a.number);
      const enCua = aquestes.filter(i => feina(i)).length;
      // Cada secció es pot plegar fent clic al títol; es recorda en aquest navegador.
      const col = el('details', { class: 'columna', id: 'sec-' + F.id },
        el('summary', { title: 'Plega o desplega' }, el('h2', {}, F.titol,
          el('span', {}, (enCua ? enCua + ' a la cua · ' : '') + aquestes.length))));
      col.open = !plegades.has(F.id);
      col.addEventListener('toggle', () => { col.open ? plegades.delete(F.id) : plegades.add(F.id); desa('taller_plegades', JSON.stringify([...plegades])); });
      if (!aquestes.length) col.append(el('div', { class: 'buida' }, F.buida));
      aquestes.forEach(i => col.append(targeta(i)));
      cols.append(col);
      // Accés directe: obre la secció i hi va.
      salts.append(el('button', { class: 'salt' + (aquestes.length ? '' : ' buit'),
        onclick: () => { col.open = true; col.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
        F.titol, el('b', {}, String(aquestes.length))));
    }
    dibuixaPeticions();
    const desc = $('descartats');
    desc.hidden = !mostraDescartats;
    desc.replaceChildren(el('h2', {}, 'Descartats'), ...issues.filter(i => fase(i) === 'descartat').map(targeta));
    dibuixaPanell();
  }

  // Només redibuixa si les issues han canviat (així no es mou res mentre llegeixes); el panell, sempre.
  async function refresca() {
    await carregaIssues();
    const sig = JSON.stringify(issues.filter(i => !esEstat(i)).map(i => [i.number, i.updated_at, i.state, noms(i).join()]));
    if (sig !== signatura) { signatura = sig; dibuixa(); } else dibuixaPanell();
    $('estat').textContent = 'Actualitzat ' + quan(new Date()) + '. Es torna a carregar cada minut.';
  }

  // ---------- esquema, menú, lletra ----------
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
  function menu() {
    obreDialeg('Més', el('div', { class: 'menu' },
      el('button', { onclick: () => { tancaDialeg(); esquema().catch(e => alert(e.message)); } }, '📝 Esquema del vídeo'),
      el('button', { onclick: () => { tancaDialeg(); configuracio().catch(e => alert(e.message)); } }, '⚙ Topalls del vigilant'),
      el('button', { onclick: () => { mostraDescartats = !mostraDescartats; tancaDialeg(); dibuixa(); } }, (mostraDescartats ? '🙈 Amaga' : '👁 Mostra') + ' els descartats'),
      el('button', { onclick: () => window.open('https://github.com/' + REPO + '/issues', '_blank') }, '🐙 Obre les issues a GitHub'),
      el('button', { class: 'perill', onclick: () => { desaToken(''); location.reload(); } }, 'Surt (esborra el token)')));
  }
  function aplicaLletra() {
    document.documentElement.style.fontSize = MIDES[lletra] + 'px';
    $('bMenys').disabled = lletra === 0; $('bMes').disabled = lletra === MIDES.length - 1;
    desa('taller_lletra', String(lletra));
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
    $('panell').replaceChildren(el('div', { class: 'panell apagat' }, el('div', { class: 'semafor' }),
      el('div', { class: 'panell-text' }, el('div', { class: 'panell-titol' }, 'Carregant…'), el('div', { class: 'panell-detall' }, 'Llegint les issues del repositori.'))));
    try { await asseguraEtiquetes(); } catch (e) { console.warn('etiquetes:', e.message); }
    try { await refresca(); }
    catch (e) { avisa('No s\'ha pogut carregar el taulell: ' + e.message + '. Prova de recarregar la pàgina (Ctrl+Maj+R).'); console.error(e); }
  }

  $('fToken').addEventListener('submit', ev => { ev.preventDefault(); desaToken($('token').value.trim()); $('token').value = ''; entra(); });
  $('bRefresca').addEventListener('click', accio(refresca));
  $('bIdees').addEventListener('click', demanaIdees);
  $('bMenu').addEventListener('click', menu);
  $('bMenys').addEventListener('click', () => { lletra = Math.max(0, lletra - 1); aplicaLletra(); });
  $('bMes').addEventListener('click', () => { lletra = Math.min(MIDES.length - 1, lletra + 1); aplicaLletra(); });
  setInterval(() => { if (token && !document.hidden && !$('dlg').open) refresca().catch(() => {}); }, 60000);

  aplicaLletra();
  token = llegeixToken();
  if (token) entra(); else $('porta').hidden = false;
})();
