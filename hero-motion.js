/* =========================================================================
   hero-motion.js: the hero's Pause motion control (index.html only).

   Saved in localStorage 'motion' ('paused') and applied before first paint by
   index.html (html.motion-paused). Announced as 'motionchange', which the
   React islands listen to (Scanner background, name sweep, project autoplay);
   home.css stops the research-card motifs. Hidden with reduced motion, where
   nothing moves to begin with.
   ========================================================================= */
(function () {
  'use strict';
  var root = document.documentElement;
  var toggle = document.querySelector('[data-motion-toggle]');
  if (!toggle) return;
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  function paused() { return root.classList.contains('motion-paused'); }
  function sync() {
    toggle.hidden = reduceMQ.matches;
    var p = paused();
    toggle.querySelector('span').textContent = p ? 'Resume motion' : 'Pause motion';
    toggle.querySelector('use').setAttribute('href', p ? '#i-play' : '#i-pause');
  }
  toggle.addEventListener('click', function () {
    var p = !paused();
    root.classList.toggle('motion-paused', p);
    try { if (p) localStorage.setItem('motion', 'paused'); else localStorage.removeItem('motion'); } catch (e) {}
    sync();
    document.dispatchEvent(new CustomEvent('motionchange', { detail: { paused: p } }));
  });
  reduceMQ.addEventListener('change', sync);
  sync();
})();
