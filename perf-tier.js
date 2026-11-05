/* =========================================================================
   perf-tier.js: picks a rendering tier before anything else runs.

   Low-end devices get html.perf-lite: frosted glass without SVG refraction,
   lighter blur, static decorations, a lighter 3D path and no chapter morphs
   (liquid-glass.css/.js, home-scene.js, chapter-scroll.js, home.css read it).
   - At load: 4 or fewer CPU cores, 4 GB or less memory, or Save-Data.
   - While scrolling: if a device that started on the full tier keeps missing
     frames (a quarter of them over 25 ms across ~1.5 s of scrolling), it
     switches to lite once and announces 'perf:lite' so live effects downgrade.
   Loaded synchronously and early in <head>; it does no DOM work besides the
   class on <html>.
   ========================================================================= */
(function () {
  'use strict';
  var root = document.documentElement;
  var nav = navigator;
  var conn = nav.connection || {};
  var low = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) ||
    (nav.deviceMemory && nav.deviceMemory <= 4) || !!conn.saveData;
  // A runtime downgrade is remembered for a week, then the device is re-tested
  // (a fast machine that was busy once should not stay on lite for good).
  var WEEK = 7 * 864e5;
  try {
    var saved = /^lite:(\d+)$/.exec(localStorage.getItem('perf-tier') || '');
    if (saved && Date.now() - +saved[1] < WEEK) low = true;
    else localStorage.removeItem('perf-tier');
  } catch (e) {}

  function goLite() {
    if (root.classList.contains('perf-lite')) return;
    root.classList.add('perf-lite');
    try { localStorage.setItem('perf-tier', 'lite:' + Date.now()); } catch (e) {}
    document.dispatchEvent(new CustomEvent('perf:lite'));
  }
  window.__perfLite = function () { return root.classList.contains('perf-lite'); };
  if (low) { root.classList.add('perf-lite'); return; }

  // Runtime check: sample frame times only while the page is being scrolled,
  // starting a few seconds after load so start-up work is not counted.
  var armed = false; var scrolling = 0; var last = 0; var frames = 0; var slow = 0; var raf = 0;
  function tick(t) {
    raf = 0;
    if (last) { frames++; if (t - last > 25) slow++; }
    last = t;
    if (frames >= 90) {
      if (slow / frames > 0.25) { goLite(); return; }
      frames = 0; slow = 0;
    }
    if (performance.now() - scrolling < 200) raf = requestAnimationFrame(tick);
    else last = 0;
  }
  function onScroll() {
    if (!armed || document.hidden) return;
    scrolling = performance.now();
    if (!raf) raf = requestAnimationFrame(tick);
  }
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('load', function () { setTimeout(function () { armed = true; }, 3000); });
})();
