// porta.js — porta d'accés al mapa del curs: identificació amb NIU i contrasenya, i desat del
// progrés al curs (bústia PHP al servidor, URL a connexio_servidor.js). La contrasenya es
// verifica al servidor: per defecte és "REDACTAT"+NIU, però cada usuari se la pot canviar
// (es desa com a hash al servidor). Si la connexió no està configurada o falla, el mapa
// funciona igualment amb la contrasenya per defecte i el progrés queda al navegador.
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

  const PREFIX = 'REDACTAT';                      // contrasenya per defecte = PREFIX + NIU
  const SAL = 'REDACTAT.';                        // hash = sha256(SAL + NIU)
  const CLAU_SESSIO = 'estatsolid.mapa.sessio';

  // ---------------------------------------------------------------
  // Connexió amb la bústia del curs (PHP a edatdepietrix.uab.cat)
  // window.MAPA_API el defineix connexio_servidor.js; si no hi és, mode només-navegador.
  // ---------------------------------------------------------------
  const API = window.MAPA_API ? window.MAPA_API.replace(/\/?$/, '/') : null;

  async function sha(text) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  }

  async function crida(endpoint, cos, urgent) {
    const text = JSON.stringify(cos);
    // Content-Type "text/plain" = petició simple: el navegador no fa preflight CORS.
    const r = await fetch(API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: text,
      keepalive: !!urgent && text.length < 60000,   // el navegador rebutja keepalive amb cossos grans
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (!j.ok) throw new Error(j.err || 'error');
    return j;
  }

  async function llistaRemots(niu, clau) {          // tots els progressos (panell docent)
    if (!API) return [];
    const j = await crida('llegeix.php', { niu, clau, tots: 1 });
    return (j.alumnes || []).map(a => ({ niu: a.niu, obj: a.dades, t: (a.dades && a.dades.t) || 0 }));
  }

  // Verifica la contrasenya contra el servidor (i de passada en treu el progrés desat).
  // Retorna estat: 'ok' (servidor), 'oklocal' (sense servidor, contrasenya per defecte),
  // 'dolenta' (contrasenya incorrecta) o 'nopuc' (no es pot verificar ara mateix).
  async function verificaClau(niu, clau) {
    if (!API) return { estat: clau === PREFIX + niu ? 'oklocal' : 'dolenta', dades: null };
    try {
      const j = await crida('llegeix.php', { niu, clau });
      return { estat: 'ok', dades: j.dades || null };
    } catch (err) {
      if (/\b403\b/.test(err.message)) return { estat: 'dolenta', dades: null };
      // error de xarxa: no es pot verificar → només val la de defecte, en mode local
      return { estat: clau === PREFIX + niu ? 'oklocal' : 'nopuc', dades: null };
    }
  }

  async function canviaClau(actual, nova) {
    const j = await crida('canvia_clau.php', { niu: SESSIO.niu, clau: actual, nova });
    SESSIO.clau = nova;
    recorda(SESSIO.niu, nova);
    return j;
  }

  // Desat amb retard: molts clics seguits → una sola escriptura
  let SESSIO = null, tSync = null, pendent = null, enviant = false;
  async function envia(urgent) {
    if (!API || !pendent || enviant) return;
    const dades = pendent;
    pendent = null;
    enviant = true;
    estatDesat('desant');
    try {
      await crida('desa.php', { niu: SESSIO.niu, clau: SESSIO.clau, dades }, urgent);
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
    if (!API) return;
    pendent = dades;
    clearTimeout(tSync);
    tSync = setTimeout(envia, 1200);
  }
  window.addEventListener('pagehide', () => { if (pendent) { clearTimeout(tSync); envia(true); } });

  // ---------------------------------------------------------------
  // Sessió recordada en aquest navegador: {niu, clau}
  // ---------------------------------------------------------------
  function recorda(niu, clau) {
    try { localStorage.setItem(CLAU_SESSIO, JSON.stringify({ niu, clau })); } catch (err) { /* res */ }
  }
  function oblida() {
    try { localStorage.removeItem(CLAU_SESSIO); } catch (err) { /* res */ }
  }
  function llegeixRecord() {
    let r = null;
    try { r = localStorage.getItem(CLAU_SESSIO); } catch (err) { return null; }
    if (!r) return null;
    let o = null;
    try { o = JSON.parse(r); } catch (err) { o = null; }
    if (o && typeof o === 'object' && o.niu) {          // format nou: {niu, clau}
      return { niu: String(o.niu), clau: o.clau || (PREFIX + String(o.niu)) };
    }
    const niu = String(r).replace(/[^0-9]/g, '');       // format antic: el text és el NIU
    return niu ? { niu, clau: PREFIX + niu } : null;
  }

  // ---------------------------------------------------------------
  // Utilitats de DOM i indicador de desat
  // ---------------------------------------------------------------
  function el(tag, props, ...fills) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      if (k === 'class') e.className = props[k];
      else if (k === 'text') e.textContent = props[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), props[k]);
      else if (props[k] != null) e.setAttribute(k, props[k]);
    }
    fills.forEach(f => { if (f != null) e.append(f.nodeType ? f : document.createTextNode(String(f))); });
    return e;
  }

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
  // Diàleg de canvi de contrasenya
  // ---------------------------------------------------------------
  function obreCanviClau() {
    if (document.getElementById('modalClau')) return;
    const actual = el('input', { type: 'password', autocomplete: 'current-password', required: 'required' });
    const nova = el('input', { type: 'password', autocomplete: 'new-password', minlength: '6', required: 'required' });
    const repeteix = el('input', { type: 'password', autocomplete: 'new-password', minlength: '6', required: 'required' });
    const err = el('p', { class: 'modal-error', role: 'alert' });
    const desa = el('button', { type: 'submit' }, 'Desa la contrasenya');
    const cancella = el('button', { type: 'button', class: 'modal-sec' }, 'Cancel·la');

    const form = el('form', { autocomplete: 'off' },
      el('label', null, 'Contrasenya actual', actual),
      el('label', null, 'Contrasenya nova (mínim 6 caràcters)', nova),
      el('label', null, 'Repeteix la contrasenya nova', repeteix),
      err,
      el('div', { class: 'modal-botons' }, cancella, desa));

    const fons = el('div', { class: 'modal-fons', id: 'modalClau' },
      el('div', { class: 'modal-caixa' },
        el('h2', null, 'Canvia la contrasenya'),
        el('p', { class: 'modal-nota' }, 'Si l\'oblides, hauràs de demanar al professor que la restableixi.'),
        form));

    function tanca() { fons.remove(); }
    cancella.addEventListener('click', tanca);
    fons.addEventListener('click', ev => { if (ev.target === fons) tanca(); });
    document.addEventListener('keydown', function esc(ev) {
      if (ev.key === 'Escape' && document.getElementById('modalClau')) { tanca(); document.removeEventListener('keydown', esc); }
    });

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      err.textContent = '';
      if (nova.value.length < 6) { err.textContent = 'La contrasenya nova ha de tenir almenys 6 caràcters.'; return; }
      if (nova.value !== repeteix.value) { err.textContent = 'Les dues contrasenyes noves no coincideixen.'; return; }
      desa.disabled = true;
      try {
        await canviaClau(actual.value, nova.value);
        tanca();
        estatDesat(API ? 'ok' : 'local');
        missatgeCapcalera('Contrasenya canviada.');
      } catch (e2) {
        err.textContent = /\b403\b/.test(e2.message)
          ? 'La contrasenya actual no és correcta.'
          : 'No s\'ha pogut canviar la contrasenya. Torna-ho a provar.';
        desa.disabled = false;
      }
    });

    document.body.append(fons);
    actual.focus();
  }

  let tMis = null;
  function missatgeCapcalera(text) {
    if (!elDesat) return;
    elDesat.textContent = text;
    elDesat.dataset.e = 'ok';
    clearTimeout(tMis);
    tMis = setTimeout(() => estatDesat(API ? 'ok' : 'local'), 4000);
  }

  // ---------------------------------------------------------------
  // Entrada
  // ---------------------------------------------------------------
  async function entra(niu, clau, inicial, online) {
    const hash = await sha(SAL + niu);
    SESSIO = window.SESSIO = {
      niu,
      clau,
      docent: H_DOCENTS.has(hash),
      panell: H_PANELL.has(hash),
      inicial: inicial || null,
      sync,
      llistaRemots: () => llistaRemots(SESSIO.niu, SESSIO.clau),
      canviaClau,
      resetClau: altre => crida('canvia_clau.php', { niu: SESSIO.niu, clau: SESSIO.clau, reset_niu: altre }),
      esDocent: async n => H_DOCENTS.has(await sha(SAL + n)),
      surt() { oblida(); location.reload(); },
    };

    // barra de sessió a la capçalera
    const nav = document.querySelector('.cap-nav');
    if (nav) {
      elDesat = el('span', { class: 'cap-desat' });
      const qui = el('span', { class: 'cap-niu', text: niu + (SESSIO.docent ? ' · docent' : '') });
      const btnClau = el('button', { type: 'button', class: 'cap-clau', title: 'Canvia la teva contrasenya', onclick: obreCanviClau }, 'Contrasenya');
      const surt = el('button', { type: 'button', class: 'cap-surt', title: 'Tanca la sessió en aquest navegador', onclick: SESSIO.surt }, 'Surt');
      nav.append(elDesat, qui, btnClau, surt);
    }
    estatDesat(!API ? 'local' : online ? (inicial ? 'ok' : 'okbuit') : 'error');

    const porta = document.getElementById('porta');
    if (porta) porta.remove();
    document.body.classList.remove('porta-tancada');

    await carrega('mapa.js');
    if (SESSIO.panell) await carrega('panell_docent.js');
  }

  async function identifica(niu, contrasenya) {
    niu = (niu || '').trim();
    if (!/^[0-9]{6,8}$/.test(niu)) return 'El NIU són només xifres, sense espais ni lletres.';
    if (!AUTORITZATS.has(await sha(SAL + niu))) return 'Aquest NIU no és a la llista del curs. Si hi hauries de ser, escriu al professor.';
    const clau = (contrasenya || '').trim();
    const v = await verificaClau(niu, clau);
    if (v.estat === 'dolenta') return 'Contrasenya incorrecta.';
    if (v.estat === 'nopuc') return 'Ara no es pot verificar la contrasenya (sense connexió amb el curs). Torna-ho a provar d\'aquí a una estona.';
    recorda(niu, clau);
    await entra(niu, clau, v.dades, v.estat === 'ok');
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
    const rec = llegeixRecord();
    if (rec && AUTORITZATS.has(await sha(SAL + rec.niu))) {
      const v = await verificaClau(rec.niu, rec.clau);
      if (v.estat === 'ok' || v.estat === 'oklocal') { await entra(rec.niu, rec.clau, v.dades, v.estat === 'ok'); return; }
      if (v.estat === 'dolenta') oblida();            // la contrasenya s'ha canviat en un altre lloc
    }
    formulari();
  })();
})();
