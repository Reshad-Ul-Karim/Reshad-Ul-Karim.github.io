/* =========================================================================
   projects-motion.js  —  Motion-graphic layer for the Projects area.

   Loaded with `defer` AFTER reveal-motion.js, so gsap, ScrollTrigger and
   window._lenis are ready and the Lenis->ScrollTrigger.update bridge already
   exists (reveal-motion.js owns it — we never re-wire scrolling here).

   Pieces (each independently guarded, each a graceful no-op if unsupported):
     1) FLAGSHIP REEL  — desktop + motion-ok only: pin the reel and scrub the
        track horizontally (mirrors the publications pin recipe). On mobile /
        reduced-motion the CSS leaves the panels stacked vertically.
     2) COUNT-UP       — metric numbers animate when the reel scrolls in
        (IntersectionObserver, works in both layouts).
     3) CUSTOM CURSOR  — a follower that morphs to a "View/Watch/Code" pill over
        [data-cursor] media. Fine-pointer + motion-ok only.
     4) MAGNETIC       — [data-magnetic] buttons lean toward the pointer.
   ========================================================================= */
(function () {
  'use strict';

  if (window.__projectsMotionInit) return;
  window.__projectsMotionInit = true;

  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };
  var REDUCED = mq('(prefers-reduced-motion: reduce)').matches;
  var FINE = mq('(hover: hover) and (pointer: fine)').matches;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  ready(function () {
    buildReel();
    buildCountUp();
    buildCursor();
    buildMagnetic();
  });

  /* ======================================================================
     1. FLAGSHIP REEL — horizontal pinned scrub (desktop, motion-ok).
     ====================================================================== */
  function buildReel() {
    var reel = document.querySelector('.flagship-reel');
    if (!reel) return;
    if (!window.gsap || !window.ScrollTrigger || REDUCED) return; // CSS keeps it stacked

    var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
    try { gsap.registerPlugin(ScrollTrigger); } catch (e) {}

    var mm = gsap.matchMedia();
    mm.add('(min-width: 992px) and (prefers-reduced-motion: no-preference)', function () {
      var track = reel.querySelector('.flagship-track');
      var panels = gsap.utils.toArray('.flagship-panel', track);
      if (!track || panels.length < 2) return;

      reel.classList.add('is-horizontal');

      // Build progress dots once.
      var prog = reel.querySelector('.flagship-progress');
      var dots = [];
      if (prog && !prog.children.length) {
        panels.forEach(function () {
          var d = document.createElement('span');
          prog.appendChild(d); dots.push(d);
        });
      } else if (prog) {
        dots = gsap.utils.toArray('span', prog);
      }
      if (dots[0]) dots[0].classList.add('is-active');

      var distance = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };

      var tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: reel,
          start: 'top top',
          end: function () { return '+=' + distance(); },
          pin: true,
          pinSpacing: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: function (self) {
            if (!dots.length) return;
            var idx = Math.round(self.progress * (panels.length - 1));
            for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('is-active', i === idx);
          }
        }
      });

      // Main horizontal travel.
      tl.to(track, { x: function () { return -distance(); } }, 0);

      // Subtle per-panel media parallax across the whole scrub.
      panels.forEach(function (p) {
        var img = p.querySelector('.flagship-media img');
        if (img) tl.fromTo(img, { x: -28 }, { x: 28 }, 0);
      });

      // Recalc once thumbnails finish loading (their height affects layout).
      var imgs = reel.querySelectorAll('img');
      imgs.forEach(function (im) {
        if (!im.complete) im.addEventListener('load', function () { ScrollTrigger.refresh(); }, { once: true });
      });

      return function () {
        // Cleanup when leaving the desktop breakpoint.
        reel.classList.remove('is-horizontal');
        gsap.set(track, { clearProps: 'transform' });
        gsap.utils.toArray('.flagship-media img', reel).forEach(function (im) {
          gsap.set(im, { clearProps: 'transform' });
        });
      };
    });
  }

  /* ======================================================================
     2. COUNT-UP — animate [data-countup] numbers when they scroll in.
     ====================================================================== */
  function buildCountUp() {
    var nums = document.querySelectorAll('[data-countup]');
    if (!nums.length) return;

    if (REDUCED || !('IntersectionObserver' in window)) {
      // Just show final values.
      nums.forEach(function (el) { el.textContent = format(el); });
      return;
    }

    function format(el, val) {
      var target = parseFloat(el.getAttribute('data-countup')) || 0;
      var v = (val === undefined) ? target : val;
      var decimals = (String(target).split('.')[1] || '').length;
      return (el.getAttribute('data-prefix') || '') + v.toFixed(decimals) + (el.getAttribute('data-suffix') || '');
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        var target = parseFloat(el.getAttribute('data-countup')) || 0;
        var dur = 1300, start = null;
        function step(ts) {
          if (start === null) start = ts;
          var p = Math.min(1, (ts - start) / dur);
          // easeOutCubic
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = format(el, target * eased);
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = format(el, target);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });

    nums.forEach(function (el) { el.textContent = format(el, 0); io.observe(el); });

    // expose for the reduced path's format use
    buildCountUp.format = format;
  }

  /* ======================================================================
     3. CUSTOM CURSOR — follower that morphs over [data-cursor].
     ====================================================================== */
  function buildCursor() {
    if (!FINE || REDUCED) return;
    if (document.querySelector('.mg-cursor')) return;

    var cursor = document.createElement('div');
    cursor.className = 'mg-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    var label = document.createElement('span');
    label.className = 'mg-cursor-label';
    cursor.appendChild(label);
    document.body.appendChild(cursor);

    var tx = window.innerWidth / 2, ty = window.innerHeight / 2;
    var cx = tx, cy = ty, shown = false, running = false;

    function loop() {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      cursor.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0) translate(-50%,-50%)';
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
        requestAnimationFrame(loop);
      } else { running = false; }
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (!shown) { shown = true; cursor.classList.add('is-visible'); }
      kick();
    }, { passive: true });

    window.addEventListener('pointerout', function (e) {
      if (!e.relatedTarget && !e.toElement) { cursor.classList.remove('is-visible'); shown = false; }
    });

    // Hover targets: anything with [data-cursor] shows its label as a pill.
    document.querySelectorAll('[data-cursor]').forEach(function (el) {
      el.addEventListener('pointerenter', function () {
        label.textContent = el.getAttribute('data-cursor') || 'View';
        cursor.classList.add('is-active');
      });
      el.addEventListener('pointerleave', function () {
        cursor.classList.remove('is-active');
      });
    });
  }

  /* ======================================================================
     4. MAGNETIC — [data-magnetic] elements lean toward the pointer.
     ====================================================================== */
  function buildMagnetic() {
    if (!FINE || REDUCED) return;
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-magnetic')) || 0.3;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var mx = e.clientX - (r.left + r.width / 2);
        var my = e.clientY - (r.top + r.height / 2);
        el.style.transition = 'transform 0.08s linear';
        el.style.transform = 'translate(' + (mx * strength).toFixed(1) + 'px,' + (my * strength).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () {
        el.style.transition = 'transform 0.35s cubic-bezier(0.22,1,0.36,1)';
        el.style.transform = '';
      });
    });
  }
})();
