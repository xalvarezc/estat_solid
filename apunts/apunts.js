// apunts.js — fórmules (KaTeX) i simuladors incrustats de la web d'apunts.
(function () {
  'use strict';

  // ---- fórmules ----
  function formules() {
    if (!window.renderMathInElement) return;
    renderMathInElement(document.body, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,
      strict: false,
      trust: false,
    });
  }

  // ---- simuladors incrustats ----
  // Cada .sim-incrustat porta data-src. L'iframe es crea quan el bloc s'acosta
  // a la pantalla, i se li diu si és visible perquè aturi les animacions.
  const iframes = new Map();   // contentWindow -> iframe

  function crea(div) {
    const f = document.createElement('iframe');
    f.src = div.dataset.src;
    f.title = 'Simulació';
    f.setAttribute('scrolling', 'no');
    f.addEventListener('load', () => {
      iframes.set(f.contentWindow, f);
      div.classList.add('carregat');
      avisa(f, true);
    });
    div.appendChild(f);
    div.iframe = f;
  }

  function avisa(f, visible) {
    try { f.contentWindow.postMessage({ tipus: 'visible', visible }, '*'); } catch (e) { /* encara no carregat */ }
  }

  window.addEventListener('message', ev => {
    const d = ev.data;
    if (!d || d.tipus !== 'alcada') return;
    const f = iframes.get(ev.source) ||
      [...document.querySelectorAll('.sim-incrustat iframe')].find(x => x.contentWindow === ev.source);
    if (!f) return;
    iframes.set(ev.source, f);
    f.style.height = d.h + 'px';
    f.parentElement.style.minHeight = '0';
  });

  function simuladors() {
    const divs = document.querySelectorAll('.sim-incrustat');
    if (!('IntersectionObserver' in window)) { divs.forEach(crea); return; }
    const aprop = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !e.target.iframe) { crea(e.target); aprop.unobserve(e.target); }
      });
    }, { rootMargin: '800px 0px' });
    const visible = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.target.iframe) avisa(e.target.iframe, e.isIntersecting); });
    }, { rootMargin: '100px 0px' });
    divs.forEach(d => { aprop.observe(d); visible.observe(d); });
  }

  // ---- índex: secció actual ----
  function indexActiu() {
    const links = [...document.querySelectorAll('.lateral a')];
    const caps = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    if (!caps.length || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(() => {
      let actual = caps[0];
      for (const h of caps) if (h.getBoundingClientRect().top < 120) actual = h;
      links.forEach(a => a.classList.toggle('actiu', a.getAttribute('href') === '#' + actual.id));
    }, { rootMargin: '0px 0px -70% 0px' });
    caps.forEach(h => obs.observe(h));
  }

  document.addEventListener('DOMContentLoaded', () => {
    formules();
    simuladors();
    indexActiu();
  });
})();
