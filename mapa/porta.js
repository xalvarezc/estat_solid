// porta.js — porta d'accés al mapa del curs: identificació amb NIU i desat del progrés
// al curs (Firestore per REST, claus a connexio_firebase.js). Si la connexió no està
// configurada o falla, el mapa funciona igualment i el progrés queda al navegador.
// La llista de NIUs autoritzats no es publica en clar: només els sha256 de "REDACTAT."+NIU.
(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Llista del curs (sha256 de "REDACTAT."+NIU)
  // ---------------------------------------------------------------
  const AUTORITZATS = new Set([
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
    'REDACTAT',
  ]);
  // docents (no compten a l'estadística del grup); qui veu el panell de seguiment
  const H_DOCENTS = new Set([
    'REDACTAT',
    'REDACTAT',
  ]);
  const H_PANELL = new Set(['REDACTAT']);

  const PREFIX = 'REDACTAT';                      // contrasenya = PREFIX + NIU
  const SAL = 'REDACTAT.';                        // hash = sha256(SAL + NIU)
  const CLAU_SESSIO = 'estatsolid.mapa.sessio';

  // ---------------------------------------------------------------
  // Connexió amb el Firestore del curs (REST, sense SDK)
  // ---------------------------------------------------------------
  const CFG = window.FIREBASE_CONFIG || null;
  const URL_DOCS = CFG && CFG.projectId && CFG.apiKey
    ? 'https://firestore.googleapis.com/v1/projects/' + CFG.projectId + '/databases/(default)/documents'
    : null;
  const urlDoc = niu => URL_DOCS + '/progres/' + niu + '?key=' + encodeURIComponent(CFG.apiKey);

  async function sha(text) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function desfesDoc(d) {                           // document REST → {niu, t, obj}
    const f = d.fields || {};
    let obj = null;
    try { obj = JSON.parse(f.dades.stringValue); } catch (err) { /* document estrany: s'ignora */ }
    return { niu: d.name.split('/').pop(), t: +((f.t || {}).integerValue || 0), obj };
  }

  async function llegeixRemot(niu) {
    if (!URL_DOCS) return null;
    const r = await fetch(urlDoc(niu));
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('lectura ' + r.status);
    return desfesDoc(await r.json()).obj;
  }

  async function llistaRemots() {                   // tots els progressos (panell docent)
    if (!URL_DOCS) return [];
    const tots = [];
    let seguent = '';
    do {
      const r = await fetch(URL_DOCS + '/progres?pageSize=300&key=' + encodeURIComponent(CFG.apiKey)
        + (seguent ? '&pageToken=' + encodeURIComponent(seguent) : ''));
      if (!r.ok) throw new Error('llista ' + r.status);
      const cos = await r.json();
      (cos.documents || []).forEach(d => tots.push(desfesDoc(d)));
      seguent = cos.nextPageToken || '';
    } while (seguent);
    return tots.filter(d => d.obj);
  }

  // Desat amb retard: molts clics seguits → una sola escriptura
  let SESSIO = null, tSync = null, pendent = null, enviant = false;
  async function envia(urgent) {
    if (!URL_DOCS || !pendent || enviant) return;
    const dades = pendent;
    pendent = null;
    enviant = true;
    estatDesat('desant');
    try {
      const cos = JSON.stringify({
        fields: {
          clau: { stringValue: SESSIO.clau },
          t: { integerValue: String(dades.t || Date.now()) },
          dades: { stringValue: JSON.stringify(dades) },
        },
      });
      const r = await fetch(urlDoc(SESSIO.niu), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: cos,
        keepalive: !!urgent && cos.length < 60000,  // el navegador rebutja keepalive amb cossos grans
      });
      if (!r.ok) throw new Error('escriptura ' + r.status);
      estatDesat('ok');
    } catch (err) {
      if (!pendent) pendent = dades;                // es reintentarà
      estatDesat('error');
      clearTimeout(tSync);
      tSync = setTimeout(envia, 6000);
    } finally {
      enviant = false;
    }
  }
  function sync(dades) {
    if (!URL_DOCS) return;
    pendent = dades;
    clearTimeout(tSync);
    tSync = setTimeout(envia, 1200);
  }
  window.addEventListener('pagehide', () => { if (pendent) { clearTimeout(tSync); envia(true); } });

  // ---------------------------------------------------------------
  // Indicador de desat a la capçalera
  // ---------------------------------------------------------------
  const TXT_DESAT = {
    local: ['·', 'Només en aquest navegador (la connexió del curs no està configurada)'],
    ok: ['✓ desat al curs', 'El teu progrés queda desat al curs amb el teu NIU'],
    okbuit: ['✓ connectat', 'Connectat: el progrés es desarà al curs amb el teu NIU'],
    desant: ['desant…', 'Desant el progrés al curs'],
    error: ['⚠ sense connexió', 'Ara mateix no es pot desar al curs: el progrés queda en aquest navegador i es tornarà a provar'],
  };
  let elDesat = null;
  function estatDesat(e) {
    if (!elDesat) return;
    elDesat.textContent = TXT_DESAT[e][0];
    elDesat.title = TXT_DESAT[e][1];
    elDesat.dataset.e = e;
  }

  function carrega(src) {
    return new Promise((fes, falla) => {
      const sc = document.createElement('script');
      sc.src = src;
      sc.onload = fes;
      sc.onerror = falla;
      document.body.append(sc);
    });
  }

  // ---------------------------------------------------------------
  // Entrada: sessió recordada o formulari
  // ---------------------------------------------------------------
  async function entra(niu) {
    const hash = await sha(SAL + niu);
    SESSIO = window.SESSIO = {
      niu,
      clau: PREFIX + niu,
      docent: H_DOCENTS.has(hash),
      panell: H_PANELL.has(hash),
      inicial: null,
      sync,
      llistaRemots,
      esDocent: async n => H_DOCENTS.has(await sha(SAL + n)),
      surt() {
        try { localStorage.removeItem(CLAU_SESSIO); } catch (err) { /* res */ }
        location.reload();
      },
    };

    // barra de sessió a la capçalera
    const nav = document.querySelector('.cap-nav');
    if (nav) {
      elDesat = document.createElement('span');
      elDesat.className = 'cap-desat';
      const qui = document.createElement('span');
      qui.className = 'cap-niu';
      qui.textContent = niu + (SESSIO.docent ? ' · docent' : '');
      const surt = document.createElement('button');
      surt.type = 'button';
      surt.className = 'cap-surt';
      surt.textContent = 'Surt';
      surt.title = 'Tanca la sessió en aquest navegador';
      surt.addEventListener('click', SESSIO.surt);
      nav.append(elDesat, qui, surt);
    }

    if (URL_DOCS) {
      try {
        SESSIO.inicial = await llegeixRemot(niu);
        estatDesat(SESSIO.inicial ? 'ok' : 'okbuit');
      } catch (err) {
        estatDesat('error');
      }
    } else {
      estatDesat('local');
    }

    const porta = document.getElementById('porta');
    if (porta) porta.remove();
    document.body.classList.remove('porta-tancada');

    await carrega('mapa.js');
    if (SESSIO.panell) await carrega('panell_docent.js');
  }

  async function identifica(niu, contrasenya) {
    niu = (niu || '').trim();
    if (!/^[0-9]{6,8}$/.test(niu)) return 'El NIU són només xifres, sense espais ni lletres.';
    if ((contrasenya || '').trim() !== PREFIX + niu) return 'Contrasenya incorrecta.';
    if (!AUTORITZATS.has(await sha(SAL + niu))) return 'Aquest NIU no és a la llista del curs. Si hi hauries de ser, escriu al professor.';
    try { localStorage.setItem(CLAU_SESSIO, niu); } catch (err) { /* sessió no recordada */ }
    await entra(niu);
    return '';
  }

  function formulari() {
    const porta = document.getElementById('porta');
    const form = document.getElementById('portaForm');
    const error = document.getElementById('portaError');
    porta.hidden = false;
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const b = form.querySelector('button[type="submit"]');
      b.disabled = true;
      error.textContent = '';
      let txt;
      try {
        txt = await identifica(form.niu.value, form.contrasenya.value);
      } catch (err) {
        txt = 'No s\'ha pogut comprovar l\'accés (potser el navegador és massa antic o no hi ha xarxa). Torna-ho a provar.';
      }
      if (txt) {
        error.textContent = txt;
        b.disabled = false;
        form.contrasenya.focus();
      }
    });
    form.niu.focus();
  }

  (async function inici() {
    let recordat = '';
    try { recordat = localStorage.getItem(CLAU_SESSIO) || ''; } catch (err) { /* res */ }
    if (recordat && AUTORITZATS.has(await sha(SAL + recordat))) {
      entra(recordat);
    } else {
      formulari();
    }
  })();
})();
