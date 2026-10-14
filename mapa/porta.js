// porta.js — porta d'accés al mapa del curs: identificació amb NIU i contrasenya, i desat del
// progrés al curs (bústia PHP al servidor, URL a connexio_servidor.js). Tota la comprovació
// (NIU de la llista, contrasenya, docent o no) la fa el servidor: aquest codi és públic i no porta
// cap llista ni cap pista de la contrasenya inicial. La contrasenya inicial només serveix per
// posar-ne una de pròpia la primera vegada. Si la connexió no està configurada, el mapa
// funciona només amb el navegador.
(function () {
  'use strict';

  const CLAU_SESSIO = 'estatsolid.mapa.sessio';

  // ---------------------------------------------------------------
  // Connexió amb la bústia del curs (PHP a edatdepietrix.uab.cat)
  // window.MAPA_API el defineix connexio_servidor.js; si no hi és, mode només-navegador.
  // ---------------------------------------------------------------
  const API = window.MAPA_API ? window.MAPA_API.replace(/\/?$/, '/') : null;

  async function crida(endpoint, cos, urgent) {
    const text = JSON.stringify(cos);
    // Content-Type "text/plain" = petició simple: el navegador no fa preflight CORS.
    const r = await fetch(API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: text,
      keepalive: !!urgent && text.length < 60000,   // el navegador rebutja keepalive amb cossos grans
    });
    let j = null;
    try { j = await r.json(); } catch (err) { j = null; }
    if (!r.ok) throw new Error('HTTP ' + r.status + (j && j.err ? ' ' + j.err : ''));
    if (!j || !j.ok) throw new Error((j && j.err) || 'error');
    return j;
  }

  const DOCENTS = new Set();                          // NIUs docents, segons el servidor (panell)
  async function llistaRemots(niu, clau) {          // tots els progressos (panell docent)
    if (!API) return [];
    const j = await crida('llegeix.php', { niu, clau, tots: 1 });
    (j.alumnes || []).forEach(a => { if (a.docent) DOCENTS.add(a.niu); });
    return (j.alumnes || []).map(a => ({ niu: a.niu, obj: a.dades, t: (a.dades && a.dades.t) || 0 }));
  }

  // Verifica NIU i contrasenya al servidor (i de passada en treu el progrés desat).
  // estat: 'ok', 'local' (sense servidor configurat), 'canvi' (contrasenya inicial: cal posar-ne
  // una de pròpia), 'niu' (no és a la llista), 'dolenta', 'bloquejat' o 'nopuc' (sense connexió).
  async function verificaClau(niu, clau) {
    if (!API) return { estat: 'local', dades: null };
    try {
      const j = await crida('llegeix.php', { niu, clau });
      return { estat: 'ok', dades: j.dades || null, docent: !!j.docent, panell: !!j.panell };
    } catch (err) {
      const m = err.message;
      if (/\b428\b/.test(m)) return { estat: 'canvi', dades: null };
      if (/\b429\b/.test(m)) return { estat: 'bloquejat', dades: null };
      if (/\b403\b/.test(m)) return { estat: /\bniu\b/.test(m) ? 'niu' : 'dolenta', dades: null };
      return { estat: 'nopuc', dades: null };
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
    if (o && typeof o === 'object' && o.niu && o.clau) return { niu: String(o.niu), clau: String(o.clau) };
    return null;                                         // formats antics: cal tornar a entrar
  }

  // ---------------------------------------------------------------
  // Utilitats de DOM i indicador de desat
  // ---------------------------------------------------------------
  function el(tag, props, ...fills) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      if (k === 'class') e.className = props[k];
      else if (k === 'text') e.textContent = props[k];
      else if (k === 'html') e.innerHTML = props[k];    // només per a icones SVG d'aquest fitxer
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), props[k]);
      else if (props[k] != null) e.setAttribute(k, props[k]);
    }
    fills.forEach(f => { if (f != null) e.append(f.nodeType ? f : document.createTextNode(String(f))); });
    return e;
  }

  const TXT_DESAT = {
    local: ['Només en aquest navegador', 'La connexió del curs no està configurada: el progrés queda en aquest navegador'],
    ok: ['✓ Desat al curs', 'El teu progrés queda desat al curs amb el teu NIU'],
    okbuit: ['✓ Connectat', 'Connectat: el progrés es desarà al curs amb el teu NIU'],
    desant: ['Desant…', 'Desant el progrés al curs'],
    error: ['⚠ Sense connexió', 'Ara mateix no es pot desar al curs: el progrés queda en aquest navegador i es tornarà a provar'],
  };
  let elDesat = null, elDot = null;
  function estatDesat(e) {
    if (elDot) { elDot.dataset.e = e; elDot.title = TXT_DESAT[e][1]; }
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
  // Diàlegs de contrasenya: canvi des del menú, i la primera vegada (amb la contrasenya inicial)
  // ---------------------------------------------------------------
  function missatgeErrorClau(m) {
    if (/nova_defecte/.test(m)) return 'La contrasenya nova no pot ser la inicial.';
    if (/\b403\b/.test(m)) return 'La contrasenya actual no és correcta.';
    if (/\b429\b/.test(m)) return 'Massa intents fallits: el compte està bloquejat durant 15 minuts.';
    return 'No s\'ha pogut canviar la contrasenya. Torna-ho a provar.';
  }

  function primeraClau(niu, inicial) {
    if (document.getElementById('modalClau')) return;
    const nova = el('input', { type: 'password', autocomplete: 'new-password', minlength: '6', required: 'required' });
    const repeteix = el('input', { type: 'password', autocomplete: 'new-password', minlength: '6', required: 'required' });
    const err = el('p', { class: 'modal-error', role: 'alert' });
    const desa = el('button', { type: 'submit' }, 'Desa i entra');
    const cancella = el('button', { type: 'button', class: 'modal-sec' }, 'Cancel·la');
    const form = el('form', { autocomplete: 'off' },
      el('label', null, 'Contrasenya nova (mínim 6 caràcters)', nova),
      el('label', null, 'Repeteix la contrasenya nova', repeteix),
      err,
      el('div', { class: 'modal-botons' }, cancella, desa));
    const fons = el('div', { class: 'modal-fons', id: 'modalClau' },
      el('div', { class: 'modal-caixa' },
        el('h2', null, 'Posa una contrasenya pròpia'),
        el('p', { class: 'modal-nota' }, 'És la primera vegada que entres: la contrasenya inicial només serveix per triar-ne una de pròpia. Si l\'oblides, el professor te la pot restablir.'),
        form));
    function tanca() { fons.remove(); }
    cancella.addEventListener('click', tanca);
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      err.textContent = '';
      if (nova.value.length < 6) { err.textContent = 'La contrasenya nova ha de tenir almenys 6 caràcters.'; return; }
      if (nova.value !== repeteix.value) { err.textContent = 'Les dues contrasenyes no coincideixen.'; return; }
      desa.disabled = true;
      try {
        await crida('canvia_clau.php', { niu, clau: inicial, nova: nova.value });
        const v = await verificaClau(niu, nova.value);
        if (v.estat !== 'ok') throw new Error(v.estat);
        tanca();
        recorda(niu, nova.value);
        await entra(niu, nova.value, v);
      } catch (e2) {
        err.textContent = missatgeErrorClau(e2.message);
        desa.disabled = false;
      }
    });
    document.body.append(fons);
    nova.focus();
  }

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
        err.textContent = missatgeErrorClau(e2.message);
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
  async function entra(niu, clau, v) {                // v: resultat de verificaClau
    const inicial = v.dades, online = v.estat === 'ok';
    SESSIO = window.SESSIO = {
      niu,
      clau,
      docent: !!v.docent,
      panell: !!v.panell,
      inicial: inicial || null,
      sync,
      llistaRemots: () => llistaRemots(SESSIO.niu, SESSIO.clau),
      canviaClau,
      resetClau: altre => crida('canvia_clau.php', { niu: SESSIO.niu, clau: SESSIO.clau, reset_niu: altre }),
      esDocent: async n => DOCENTS.has(n),
      surt() { oblida(); location.reload(); },
    };

    // menú de sessió a la capçalera (un sol botó desplegable)
    const nav = document.querySelector('.cap-nav');
    if (nav) {
      elDot = el('span', { class: 'cap-dot', 'aria-hidden': 'true' });
      const toggle = el('button', {
        type: 'button', class: 'cap-compte', 'aria-haspopup': 'true', 'aria-expanded': 'false',
        title: 'La teva sessió',
      }, elDot, el('span', { class: 'cap-compte-niu', text: niu }),
        el('span', { class: 'cap-chevron', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' }));

      elDesat = el('div', { class: 'cap-menu-estat' });
      const itClau = el('button', { type: 'button', class: 'cap-menu-item', role: 'menuitem' }, 'Canvia la contrasenya');
      const itSurt = el('button', { type: 'button', class: 'cap-menu-item cap-menu-surt', role: 'menuitem' }, 'Tanca la sessió');
      const menu = el('div', { class: 'cap-menu', role: 'menu', hidden: 'hidden' },
        el('div', { class: 'cap-menu-cap', text: 'NIU ' + niu + (SESSIO.docent ? ' · docent' : '') }),
        elDesat, itClau, itSurt);

      const cont = el('div', { class: 'cap-compte-cont' }, toggle, menu);
      function obre(estat) { menu.hidden = !estat; toggle.setAttribute('aria-expanded', estat ? 'true' : 'false'); }
      toggle.addEventListener('click', ev => { ev.stopPropagation(); obre(menu.hidden); });
      document.addEventListener('click', ev => { if (!cont.contains(ev.target)) obre(false); });
      document.addEventListener('keydown', ev => { if (ev.key === 'Escape') obre(false); });
      itClau.addEventListener('click', () => { obre(false); obreCanviClau(); });
      itSurt.addEventListener('click', SESSIO.surt);
      nav.append(cont);
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
    const clau = (contrasenya || '').trim();
    const v = await verificaClau(niu, clau);
    if (v.estat === 'niu') return 'Aquest NIU no és a la llista del curs. Si hi hauries de ser, escriu al professor.';
    if (v.estat === 'dolenta') return 'Contrasenya incorrecta.';
    if (v.estat === 'bloquejat') return 'Massa intents fallits: aquest NIU està bloquejat durant 15 minuts. Torna-ho a provar més tard o escriu al professor.';
    if (v.estat === 'nopuc') return 'Ara no es pot verificar la contrasenya (sense connexió amb el curs). Torna-ho a provar d\'aquí a una estona.';
    if (v.estat === 'canvi') { primeraClau(niu, clau); return ''; }
    recorda(niu, clau);
    await entra(niu, clau, v);
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
    if (rec) {
      const v = await verificaClau(rec.niu, rec.clau);
      // sense connexió: s'entra igualment (en aquest navegador ja s'havia verificat) i es desarà quan torni
      if (v.estat === 'ok' || v.estat === 'local' || v.estat === 'nopuc') { await entra(rec.niu, rec.clau, v); return; }
      if (v.estat !== 'bloquejat') oblida();          // contrasenya canviada en un altre lloc, o restablerta
    }
    formulari();
  })();
})();
