// incrustat.js — mode "incrustat" comú a tots els simuladors.
//
// Quan l'URL porta ?incrustat=1, el simulador es mostra dins d'una altra
// pàgina (els apunts web): s'amaga la capçalera, la introducció, el peu i
// tots els panells, i només queden visibles els elements de ?mostra=id1,id2…
// (un canvas mostra el seu bloc amb títol; un slider, la seva etiqueta).
// La resta de paràmetres de l'URL els llegeix el mateix simulador com sempre.
//
// A més:
//  - comunica l'alçada a la pàgina pare (postMessage {tipus:'alcada', h});
//  - atura requestAnimationFrame quan la pàgina pare diu que no és visible
//    ({tipus:'visible', visible:false}), perquè n'hi pot haver molts alhora.
//
// S'ha de carregar al <head>, abans dels scripts del simulador.
(function () {
  'use strict';
  const p = new URLSearchParams(location.search);
  if (!p.has('incrustat')) return;
  document.documentElement.classList.add('incrustat');
  // ?costat=1: gràfiques a l'esquerra, controls i lectures en una columna a la dreta
  if (p.has('costat')) document.documentElement.classList.add('inc-costat');

  // ---- pausa de les animacions quan no es veuen ----
  let pausat = false, cua = [];
  const raf0 = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => {
    if (pausat) { cua.push(cb); return 0; }
    return raf0(cb);
  };
  window.addEventListener('message', ev => {
    if (ev.source !== window.parent || !ev.data || ev.data.tipus !== 'visible') return;
    pausat = !ev.data.visible;
    if (!pausat && cua.length) { const c = cua; cua = []; c.forEach(cb => raf0(cb)); }
  });

  // ---- què es mostra ----
  function contenidor(el) {
    if (el.tagName === 'CANVAS') return el.closest('.bloc-canvas') || el;
    if (el.matches('input, select')) return el.closest('.control-group') || el;
    if (el.tagName === 'TBODY') return el.closest('.card') || el.closest('table') || el;
    return el;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const ids = (p.get('mostra') || '').split(',').map(s => s.trim()).filter(Boolean);
    const panells = '.fila-canvas, .center-panel, .controls-panel, .right-panel';
    ids.forEach((id, k) => {
      const el = document.getElementById(id);
      if (!el) { console.warn('incrustat: no existeix #' + id); return; }
      const c = contenidor(el);
      c.classList.add('inc-mostra');
      for (let a = c.parentElement; a && a !== document.body; a = a.parentElement) a.classList.add('inc-cami');
      // l'ordre de ?mostra és l'ordre en pantalla
      let item = c;
      while (item.parentElement && item.parentElement !== document.body && item.parentElement.tagName !== 'MAIN' &&
             !item.parentElement.matches(panells)) item = item.parentElement;
      if (item.style.order === '' || +item.style.order > k) item.style.order = k;
    });

    // res plegat (caixes_plegables.js pot haver recordat caixes plegades)
    document.querySelectorAll('.plegada, .amagat').forEach(e => e.classList.remove('plegada', 'amagat'));

    // cap enllaç cap a fora del simulador
    document.querySelectorAll('.inc-mostra a[href]').forEach(a => a.removeAttribute('href'));

    const envia = () => {
      const h = Math.ceil(document.documentElement.getBoundingClientRect().height);
      window.parent.postMessage({ tipus: 'alcada', h }, '*');
    };
    if (window.ResizeObserver) new ResizeObserver(envia).observe(document.body);
    window.addEventListener('load', envia);
    envia();
  });
})();
