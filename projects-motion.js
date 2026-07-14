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
    buildFilter();
    buildVideoHover();
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
          scrub: 1,            // higher scrub = smoother catch-up to the scroll
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
     5. CATEGORY FILTER — chips + GSAP Flip reorder of the projects grid.
     ====================================================================== */
  function buildFilter() {
    var grid = document.querySelector('.projects-grid');
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.project-card'));
    if (cards.length < 4) return;

    var CATS = [
      { id: 'genai', label: 'Generative AI & LLMs', kw: ['llm', 'rope', 'rlhf', 'agentic', 'reward', 'policy', 'embedding', 'dinov2', 'pretrain', 'pre-train'] },
      { id: 'cv', label: 'Computer Vision', kw: ['vision', 'yolo', 'segformer', 'mediapipe', 'vit', 'transformer', 'vlm', 'ocr', 'gesture', 'detection', 'image'] },
      { id: 'robotics', label: 'Robotics & IoT', kw: ['robot', 'rover', 'aruco', 'arduino', 'iot', 'esp32', 'gps', 'terrain', 'wearable', 'sensor'] },
      { id: 'health', label: 'Healthcare', kw: ['health', 'medical', 'sleep', 'stroke', 'autism', 'telemedicine', 'fall', 'clinical', 'weheal', 'impaired', 'assistive'] },
      { id: 'ml', label: 'ML & XAI', kw: ['shap', 'lime', 'xai', 'explainable', 'machine learning', 'classification', 'prediction', 'data analysis', 'nlp', 'lstm'] },
      { id: 'systems', label: 'Systems & Apps', kw: ['php', 'mysql', 'mern', 'database', 'hub', 'game', 'opengl', 'c++', 'platform', 'ajax', 'web'] }
    ];

    var counts = {};
    cards.forEach(function (card) {
      var text = (card.textContent || '').toLowerCase();
      var cats = [];
      CATS.forEach(function (c) {
        if (c.kw.some(function (k) { return text.indexOf(k) >= 0; })) cats.push(c.id);
      });
      if (!cats.length) cats.push('systems');
      card.dataset.cat = cats.join(' ');
      cats.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    });

    var bar = document.createElement('div');
    bar.className = 'project-filters';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Filter projects by category');
    var chips = [];
    function makeChip(id, lbl, count) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'project-filter' + (id === 'all' ? ' is-active' : '');
      b.setAttribute('data-filter', id);
      b.innerHTML = lbl + (count != null ? ' <span class="pf-count">' + count + '</span>' : '');
      b.addEventListener('click', function () {
        applyFilter(id);
        chips.forEach(function (c) { c.classList.toggle('is-active', c === b); });
      });
      chips.push(b); bar.appendChild(b);
    }
    makeChip('all', 'All', cards.length);
    CATS.forEach(function (c) { if (counts[c.id]) makeChip(c.id, c.label, counts[c.id]); });
    grid.parentNode.insertBefore(bar, grid);

    var HAS_FLIP = !!(window.gsap && window.Flip);
    if (HAS_FLIP) { try { window.gsap.registerPlugin(window.Flip); } catch (e) {} }

    function unhide() {
      cards.forEach(function (c) {
        c.removeAttribute('data-rm-hide');
        if (window.gsap) window.gsap.set(c, { clearProps: 'opacity,transform,visibility' });
        c.style.opacity = ''; c.style.transform = '';
      });
    }

    function applyFilter(cat) {
      unhide();
      var state = HAS_FLIP ? window.Flip.getState(cards) : null;
      cards.forEach(function (c) {
        var show = cat === 'all' || (' ' + (c.dataset.cat || '') + ' ').indexOf(' ' + cat + ' ') >= 0;
        c.style.display = show ? '' : 'none';
      });
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      if (!HAS_FLIP || REDUCED) return;
      window.Flip.from(state, {
        duration: 0.55, ease: 'power2.inOut', scale: true, absolute: true,
        onEnter: function (els) { return window.gsap.fromTo(els, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }); },
        onLeave: function (els) { return window.gsap.to(els, { opacity: 0, scale: 0.8, duration: 0.3, ease: 'power2.in' }); }
      });
    }
  }

  /* ======================================================================
     6. VIDEO-ON-HOVER — muted looping preview over YouTube thumbnails.
     ====================================================================== */
  function buildVideoHover() {
    if (!FINE || REDUCED) return;
    var previews = document.querySelectorAll('.youtube-preview[data-video-id]');
    if (!previews.length) return;
    var active = null, timer = null;

    function clearActive() {
      if (!active) return;
      var f = active.querySelector('.yt-hover-frame');
      if (f && f.parentNode) f.parentNode.removeChild(f);
      active.classList.remove('is-previewing');
      active = null;
    }

    previews.forEach(function (p) {
      p.addEventListener('pointerenter', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (p === active) return;
        timer = setTimeout(function () {
          clearActive();
          var id = p.getAttribute('data-video-id');
          var start = p.getAttribute('data-start-time') || 0;
          var f = document.createElement('iframe');
          f.className = 'yt-hover-frame';
          f.setAttribute('allow', 'autoplay; encrypted-media');
          f.setAttribute('loading', 'lazy');
          f.setAttribute('tabindex', '-1');
          f.src = 'https://www.youtube.com/embed/' + id +
            '?autoplay=1&mute=1&loop=1&playlist=' + id +
            '&controls=0&modestbranding=1&playsinline=1&rel=0&start=' + start;
          p.appendChild(f);
          p.classList.add('is-previewing');
          requestAnimationFrame(function () { f.classList.add('is-in'); });
          active = p;
        }, 240);
      });
      p.addEventListener('pointerleave', function () {
        if (timer) { clearTimeout(timer); timer = null; }
        if (p === active) clearActive();
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
