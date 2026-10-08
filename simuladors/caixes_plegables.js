// Caixes plegables per als simuladors.
// - Cada caixa (targeta de controls o bloc de gràfica) es plega clicant-ne el títol.
// - Els panells laterals es poden amagar sencers, i queden fixos (sticky) en fer scroll.
// - L'estat es recorda per a cada pàgina (localStorage, si està disponible).
// Ús: incloure caixes_plegables.css i aquest fitxer al final del <body>.
// Una caixa amb l'atribut data-plegada surt plegada la primera vegada.
// A l'URL, ?obre=id1,id2 desplega (i ?plega=id1,id2 plega) les caixes amb aquests id.
// Els selectors es poden canviar amb window.CAIXES_PLEGABLES = { caixes: [...], panells: [...] }
// abans de carregar el fitxer.

(function () {
  'use strict';

  const cfg = Object.assign({
    // [selector de la caixa, selector del títol dins la caixa]
    caixes: [['.card', '.card-title'], ['.bloc-canvas', '.plot-title']],
    // [selector del panell, nom que es mostra quan està amagat]
    panells: [['.controls-panel', 'Controls'], ['.right-panel', 'Informació']]
  }, window.CAIXES_PLEGABLES || {});

  const PREFIX = 'plegables:' + location.pathname + ':';
  function llegeix(k) { try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } }
  function desa(k, v) { try { localStorage.setItem(PREFIX + k, v); } catch (e) { /* sense emmagatzematge */ } }

  const llistaURL = k => (new URLSearchParams(location.search).get(k) || '').split(',').filter(Boolean);
  const obreURL = llistaURL('obre'), plegaURL = llistaURL('plega');

  const avisaCanvi = () => window.dispatchEvent(new Event('resize'));

  // ---- Caixes ----
  const totesLesCaixes = [];
  cfg.caixes.forEach(([selCaixa, selTitol]) => {
    document.querySelectorAll(selCaixa).forEach(caixa => {
      const titol = caixa.querySelector(':scope > ' + selTitol);
      if (!titol) return;
      const clau = 'c:' + titol.textContent.trim();
      caixa.classList.add('plegable');
      titol.classList.add('titol-plegable');
      titol.setAttribute('role', 'button');
      titol.setAttribute('tabindex', '0');
      const fixa = plegada => {
        caixa.classList.toggle('plegada', plegada);
        titol.setAttribute('aria-expanded', String(!plegada));
        titol.title = plegada ? 'Clica per desplegar' : 'Clica per plegar';
      };
      const desat = llegeix(clau);
      fixa(desat === null ? caixa.hasAttribute('data-plegada') : desat === '1');
      if (caixa.id && obreURL.includes(caixa.id)) fixa(false);
      if (caixa.id && plegaURL.includes(caixa.id)) fixa(true);
      const commuta = () => { const p = !caixa.classList.contains('plegada'); fixa(p); desa(clau, p ? '1' : '0'); avisaCanvi(); };
      titol.addEventListener('click', ev => {
        if (ev.target.closest('a, input, select, button')) return;
        commuta();
      });
      titol.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); commuta(); }
      });
      totesLesCaixes.push({ fixa, clau, caixa });
    });
  });

  // ---- Panells laterals ----
  const totsElsPanells = [];
  cfg.panells.forEach(([sel, nom], i) => {
    const panell = document.querySelector(sel);
    if (!panell) return;
    const clau = 'p' + i;
    panell.classList.add('panell-plegable');
    const boto = document.createElement('button');
    boto.type = 'button';
    boto.className = 'boto-panell';
    panell.insertBefore(boto, panell.firstChild);
    const fixa = amagat => {
      panell.classList.toggle('amagat', amagat);
      boto.textContent = amagat ? nom : 'Amaga el panell';
      boto.setAttribute('aria-expanded', String(!amagat));
      boto.title = amagat ? 'Mostra el panell ' + nom.toLowerCase() : 'Amaga aquest panell per deixar més lloc a les gràfiques';
    };
    fixa(llegeix(clau) === '1');
    boto.addEventListener('click', () => {
      const a = !panell.classList.contains('amagat');
      fixa(a); desa(clau, a ? '1' : '0'); avisaCanvi();
    });
    totsElsPanells.push({ fixa, clau });
  });

  // ---- Barra general: plegar / desplegar-ho tot ----
  const barra = document.createElement('div');
  barra.className = 'barra-plegables';
  barra.innerHTML =
    '<span>Clica el títol de qualsevol caixa per plegar-la o desplegar-la.</span>' +
    '<button type="button" data-accio="obre">Desplega-ho tot</button>' +
    '<button type="button" data-accio="plega-graf">Plega totes les gràfiques</button>';
  const main = document.querySelector('.main-content');
  if (main) main.parentNode.insertBefore(barra, main);
  barra.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.accio === 'obre') {
      totesLesCaixes.forEach(c => { c.fixa(false); desa(c.clau, '0'); });
      totsElsPanells.forEach(p => { p.fixa(false); desa(p.clau, '0'); });
    } else {
      totesLesCaixes.filter(c => c.caixa.matches('.bloc-canvas'))
        .forEach(c => { c.fixa(true); desa(c.clau, '1'); });
    }
    avisaCanvi();
  });
})();
