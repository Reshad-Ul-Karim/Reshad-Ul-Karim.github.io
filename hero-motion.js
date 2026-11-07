/* =========================================================================
   hero-motion.js: the hero backdrop (index.html only).

   Layers (markup in .hero__backdrop): the motion loop (.hero__media, poster
   painted by CSS, <video> on top once it plays) and contour accents (SVG).
   - Scroll: as the hero leaves, the loop drifts up and zooms in slightly and
     the contours move faster (depth), while the loop gains a little emphasis.
     Native scrolling only; nothing is pinned.
   - Pointer: a small, bounded parallax on fine pointers. Touch uses scroll.
   - Video: one decoder at most. Its source (size and codec) is chosen once,
     after the page has loaded and gone idle. It plays only while the hero is
     on screen, the tab is visible and motion is allowed; otherwise it pauses
     on its current frame. Save-Data, reduced data and reduced motion keep the
     poster, which is the loop's own first frame.
   - Pause motion: a hero button, saved in localStorage 'motion' ('paused'),
     applied before first paint by index.html (html.motion-paused). It also
     stops the research-card motifs (home.css).
   Transforms are written only while the hero is on screen.
   ========================================================================= */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var hero = doc.querySelector('[data-hero]');
  var media = hero && hero.querySelector('[data-hero-media]');
  if (!hero || !media) return;
  var video = media.querySelector('video');
  var contours = hero.querySelector('[data-hero-contours]');
  var toggle = hero.querySelector('[data-motion-toggle]');
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fineMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
  var dataMQ = window.matchMedia('(prefers-reduced-data: reduce)');
  var conn = navigator.connection || {};

  function paused() { return root.classList.contains('motion-paused'); }
  function still() { return reduceMQ.matches || paused(); }
  function videoAllowed() { return !still() && !conn.saveData && !dataMQ.matches; }

  /* ---- Pause motion control ---------------------------------------------- */
  function syncToggle() {
    if (!toggle) return;
    toggle.hidden = reduceMQ.matches; // nothing moves to pause
    var p = paused();
    toggle.querySelector('span').textContent = p ? 'Resume motion' : 'Pause motion';
    toggle.querySelector('use').setAttribute('href', p ? '#i-play' : '#i-pause');
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      var p = !paused();
      root.classList.toggle('motion-paused', p);
      try { if (p) localStorage.setItem('motion', 'paused'); else localStorage.removeItem('motion'); } catch (e) {}
      syncToggle();
      update();
      doc.dispatchEvent(new CustomEvent('motionchange', { detail: { paused: p } }));
    });
  }
  syncToggle();

  /* ---- Video lifecycle ----------------------------------------------------- */
  var onScreen = true; var sourced = false; var failed = false; var ready = false;
  function pickSource() {
    if (sourced || failed || !video) return;
    sourced = true;
    // Phones and small tablets get the 640 px loop: it sits at low opacity
    // behind the portrait, so its softness never shows.
    var size = Math.min(window.innerWidth, screen.width || window.innerWidth) > 900 ? '1280' : '640';
    var webm = video.canPlayType('video/webm; codecs="vp9"');
    var tpl = video.getAttribute(webm ? 'data-src-webm' : 'data-src-mp4');
    if (!tpl) { failed = true; return; }
    video.addEventListener('playing', function () { media.classList.add('is-playing'); }, { once: true });
    video.addEventListener('error', function () { failed = true; media.classList.remove('is-playing'); });
    video.preload = 'auto';
    video.src = tpl.replace('{w}', size);
  }
  function update() {
    if (!video || failed) return;
    var play = ready && onScreen && !doc.hidden && videoAllowed();
    if (play) {
      pickSource();
      if (video.paused) {
        var pr = video.play();
        if (pr && pr.catch) pr.catch(function () { /* autoplay refused: the poster stays */ });
      }
    } else if (!video.paused) {
      video.pause();
    }
  }
  function whenIdle(fn) {
    var go = function () { (window.requestIdleCallback || function (f) { return setTimeout(f, 300); })(fn, { timeout: 2500 }); };
    if (doc.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
  }
  whenIdle(function () { ready = true; update(); });
  doc.addEventListener('visibilitychange', update);
  reduceMQ.addEventListener('change', function () { syncToggle(); update(); schedule(); });

  /* ---- Scroll + pointer composition --------------------------------------- */
  var px = 0; var py = 0; var tx = 0; var ty = 0; var raf = 0;
  var heroTop = 0; var heroH = 1;
  function measure() {
    var r = hero.getBoundingClientRect();
    heroTop = r.top + window.scrollY; heroH = Math.max(1, r.height);
  }
  function frame() {
    raf = 0;
    var p = Math.min(1, Math.max(0, (window.scrollY - heroTop) / heroH));
    var calm = still();
    if (calm) { px = 0; py = 0; } else { px += (tx - px) * 0.12; py += (ty - py) * 0.12; }
    if (calm) p = 0;
    media.style.transform = 'translate3d(' + (px * -14).toFixed(2) + 'px,' + (p * -70 + py * -8).toFixed(2) + 'px,0) scale(' + (1.04 + p * 0.1).toFixed(4) + ')';
    media.style.setProperty('--hero-motion-boost', (p * 0.5).toFixed(3));
    if (contours) contours.style.transform = 'translate3d(' + (px * -26).toFixed(2) + 'px,' + (p * -130 + py * -14).toFixed(2) + 'px,0)';
    if (!calm && (Math.abs(tx - px) > 0.002 || Math.abs(ty - py) > 0.002)) raf = requestAnimationFrame(frame);
  }
  function schedule() { if (!raf && onScreen) raf = requestAnimationFrame(frame); }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', function () { measure(); schedule(); }, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(function () { measure(); schedule(); }).observe(hero);
  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || !fineMQ.matches) return;
    var r = hero.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    schedule();
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; schedule(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      onScreen = es[es.length - 1].isIntersecting;
      update();
      schedule();
    }).observe(hero);
  }
  measure();
  schedule();
})();
