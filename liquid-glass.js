/* =========================================================================
   liquid-glass.js: Apple-style liquid glass for navigation and controls.

   Glass is reserved for things that float or act: the nav bar, buttons, the
   chapter rail and the theme/accent widgets. Reading surfaces (cards, tiles,
   timelines, project and publication cards) are satin panels in CSS instead,
   so long text never sits on a blurred, highlighted backdrop.

   For each glass size a lens map is built (the Glass Surface recipe, see
   mapURL): an SVG filter bends the backdrop most at the rim and splits its
   red, green and blue channels by slightly different amounts (dispersion).

   Chromium with a fine pointer applies it through backdrop-filter: url(#...).
   Everything else gets the same frosted tint, rim and highlight
   (liquid-glass.css); the choice is made once at load and never changes
   mid-visit. Controls get a slow jelly wobble with a soft blur ripple on
   hover and a mild glitch on press; on touch screens a press and a control's
   arrival in view add a shine, a glint and a brief frost pulse. Reduced motion
   turns the wobble and glitch off; reduced transparency and forced colours
   make every surface solid (CSS).
   ========================================================================= */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fineMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
  var lessGlass = window.matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active)');

  var SELECTOR = [
    // homepage
    '.nav', '.btn', '.icon-btn', '.tilt-toggle', '.xp-start',
    // other pages
    '.navbar .nav-container', '.btn-primary', '.btn-secondary', '.action-btn', '.detail-link', '.detail-back',
    // chapter rail (chapter-scroll.js)
    '.chapters', '.chapters__drop',
    // theme widgets
    '.theme-toggle', '#accent-switcher .accent-trigger', '#accent-switcher .accent-tray'
  ].join(',');

  // Touch screens skip refraction: at phone sizes the bent rim barely shows,
  // and the displacement filter is the costliest per-frame effect on mobile
  // GPUs. The lite tier (perf-tier.js) never refracts either.
  var canRefract = (function () {
    if (root.classList.contains('perf-lite')) return false;
    try { return fineMQ.matches && CSS.supports('backdrop-filter', 'url(#a)') && /Chrome|Chromium|Edg\//.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent); } catch (e) { return false; }
  })();

  // One hidden <svg> hosts every filter; filters are shared by size bucket.
  var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  var defs = doc.createElementNS(svg.namespaceURI, 'defs');
  svg.appendChild(defs);
  var cache = {}; var count = 0;

  /* Lens map and filter chain adapted from React Bits' Glass Surface
     (reactbits.dev/components/glass-surface; MIT + Commons Clause,
     Copyright (c) 2026 David Haz). The map is a small SVG: a horizontal red
     ramp and a vertical blue ramp (difference-blended) give every point a
     displacement direction, and a soft, almost neutral panel inset from the
     edge keeps the centre calm, so the backdrop bends most at the rim. The
     backdrop is displaced three times at slightly different strengths for a
     red/green/blue split. Built as a string: no canvas, no worker. */
  var GS = { distortion: -180, offsets: [0, 10, 20], borderWidth: 0.07, brightness: 50, opacity: 0.93, blur: 11 };
  var mapN = 0;
  function mapURL(w, h, r, k) {
    var n = ++mapN; var edge = Math.min(w, h) * (GS.borderWidth * 0.5);
    var blur = Math.max(4, GS.blur * k);
    var svgText = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg"><defs>' +
      '<linearGradient id="r' + n + '" x1="100%" y1="0%" x2="0%" y2="0%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/></linearGradient>' +
      '<linearGradient id="b' + n + '" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/></linearGradient>' +
      '<filter id="s' + n + '" filterUnits="userSpaceOnUse" x="0" y="0" width="' + w + '" height="' + h + '" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="' + blur + '"/></filter></defs>' +
      '<rect width="' + w + '" height="' + h + '" fill="black"/>' +
      '<rect width="' + w + '" height="' + h + '" rx="' + r + '" fill="url(#r' + n + ')"/>' +
      '<rect width="' + w + '" height="' + h + '" rx="' + r + '" fill="url(#b' + n + ')" style="mix-blend-mode:difference"/>' +
      '<rect x="' + edge + '" y="' + edge + '" width="' + (w - edge * 2) + '" height="' + (h - edge * 2) + '" rx="' + r + '" fill="hsl(0 0% ' + GS.brightness + '% / ' + GS.opacity + ')" filter="url(#s' + n + ')"/></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svgText);
  }

  // The SVG map is swapped for a PNG of itself once the browser is idle, so
  // the filter samples a cached bitmap instead of re-rendering vector art.
  function rasterise(feImage, w, h) {
    var run = function () {
      var img = new Image();
      img.onload = function () {
        try {
          var c = doc.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          c.toBlob(function (blob) { if (blob) feImage.setAttribute('href', URL.createObjectURL(blob)); }, 'image/png');
        } catch (e) { /* keep the SVG map */ }
      };
      img.src = feImage.getAttribute('href');
    };
    (window.requestIdleCallback || function (fn) { return setTimeout(fn, 200); })(run, { timeout: 2000 });
  }

  function filterFor(w, h, r) {
    var bw = Math.round(w / 8) * 8; var bh = Math.round(h / 8) * 8; var br = Math.round(r);
    var key = bw + 'x' + bh + 'r' + br;
    if (cache[key]) return cache[key];
    var id = 'lg-' + (++count);
    // Glass Surface is tuned for ~200 x 80 panels; small controls bend less.
    var k = Math.max(0.3, Math.min(1, Math.min(bw, bh) / 80));
    var scales = GS.offsets.map(function (o) { return (GS.distortion + o) * k; });
    var ns = svg.namespaceURI;
    var f = doc.createElementNS(ns, 'filter');
    f.setAttribute('id', id); f.setAttribute('x', '0%'); f.setAttribute('y', '0%'); f.setAttribute('width', '100%'); f.setAttribute('height', '100%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    var chan = function (scale, row, res) {
      return '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + scale.toFixed(1) + '" xChannelSelector="R" yChannelSelector="G" result="d' + res + '"/>' +
        '<feColorMatrix in="d' + res + '" type="matrix" values="' + row + '" result="' + res + '"/>';
    };
    f.innerHTML =
      '<feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" href="' + mapURL(bw, bh, br, k) + '"/>' +
      chan(scales[0], '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0', 'red') +
      chan(scales[1], '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0', 'green') +
      chan(scales[2], '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0', 'blue') +
      '<feBlend in="red" in2="green" mode="screen" result="rg"/><feBlend in="rg" in2="blue" mode="screen"/>';
    defs.appendChild(f);
    rasterise(f.querySelector('feImage'), bw, bh);
    return (cache[key] = { id: id, el: f, scales: scales });
  }
  function useFilter(el, f) {
    el.style.setProperty('--lg-filter', 'url(#' + f.id + ')');
    el.classList.add('lg--refract');
  }

  // Positioning comes from CSS (:where(.lg) { position: relative }, which any
  // fixed or absolute rule overrides). The corner radius is read only where a
  // lens map will be drawn, so phones never force a style pass here.
  function apply(el, radius) {
    el.__lg = true;
    el.__lgRad = radius;
    el.classList.add('lg');
    if (!el.querySelector(':scope > .lg-sheen')) {
      var sheen = doc.createElement('span'); sheen.className = 'lg-sheen'; sheen.setAttribute('aria-hidden', 'true');
      var split = doc.createElement('span'); split.className = 'lg-split'; // RGB edge for glitch and glint (CSS)
      sheen.appendChild(split);
      el.appendChild(sheen); // last child, so :first-child styles on the content keep working
    }
  }
  var toUse = []; var useRaf = 0;
  function refit(el, w, h) {
    if (!canRefract || lessGlass.matches) { el.style.removeProperty('--lg-filter'); el.classList.remove('lg--refract'); return; }
    if (!el.__lgNear) return; // frosted until it nears the viewport: fewer live filters
    if (w == null) { var r = el.getBoundingClientRect(); w = r.width; h = r.height; }
    if (w < 8 || h < 8) return;
    var f = filterFor(w, h, Math.min(el.__lgRad || 0, h / 2));
    el.__lgFilter = f;
    toUse.push(el);
    if (!useRaf) useRaf = requestAnimationFrame(function () {
      useRaf = 0;
      toUse.splice(0).forEach(function (x) { useFilter(x, x.__lgFilter); });
    });
  }

  var ro = window.ResizeObserver ? new ResizeObserver(function (entries) {
    entries.forEach(function (e) {
      var b = e.borderBoxSize && e.borderBoxSize[0];
      var w = b ? b.inlineSize : e.target.offsetWidth; var h = b ? b.blockSize : e.target.offsetHeight;
      e.target.__lgSize = [w, h];
      refit(e.target, w, h);
    });
  }) : null;
  var nearIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target; var s = el.__lgSize;
      el.__lgNear = true;
      refit(el, s ? s[0] : e.boundingClientRect.width, s ? s[1] : e.boundingClientRect.height);
      nearIO.unobserve(el);
    });
  }, { rootMargin: '600px 0px' }) : null;
  // Scroll speed for the highlight (chapter-scroll.js calls window.__lgScrollV).
  // Written only on glass that is on screen: on <html> it restyled the page.
  var onScreen = new Set(); var scrollV = '0';
  var viewIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { onScreen.add(e.target); if (e.target.__sv !== scrollV) { e.target.__sv = scrollV; e.target.style.setProperty('--scroll-v', scrollV); } }
      else onScreen.delete(e.target);
    });
  }) : null;
  window.__lgScrollV = function (v) {
    scrollV = String(v);
    onScreen.forEach(function (el) { if (el.__sv !== scrollV) { el.__sv = scrollV; el.style.setProperty('--scroll-v', scrollV); } });
  };
  function scan() {
    var fresh = Array.prototype.filter.call(doc.querySelectorAll(SELECTOR), function (el) { return !el.__lg; });
    if (!fresh.length) return;
    var radii = fresh.map(function (el) { return canRefract ? parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 : 0; });
    fresh.forEach(function (el, i) {
      if (!nearIO) el.__lgNear = true;
      apply(el, radii[i]);
      if (canRefract && ro) ro.observe(el); // sizes and proximity only matter for lens maps
      if (canRefract && nearIO) nearIO.observe(el);
      if (glintIO) glintIO.observe(el);
      if (viewIO) viewIO.observe(el);
    });
  }

  /* Cursor-following specular highlight */
  doc.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var el = e.target.closest && e.target.closest('.lg');
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.style.setProperty('--lx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    el.style.setProperty('--ly', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  }, { passive: true });

  /* Liquid wobble, mild glitch and blur. Only small controls react with motion:
     reading cards stay still so their links are easy to hit. */
  var CONTROL = 'a, button, .btn, .icon-btn, .tilt-toggle, .theme-toggle, .accent-trigger, .action-btn, .btn-primary, .btn-secondary, .detail-link, .detail-back';
  function moves(el) { return !reduceMQ.matches && el.matches(CONTROL); }
  function wobble(el, strong) {
    if (!moves(el) || !el.animate) return;
    var r = el.getBoundingClientRect();
    var a = Math.min(0.03, 6 / Math.max(40, Math.min(r.width, r.height) * 2.2)) * (strong ? 1.3 : 1);
    var s = function (k) { return 'scale(' + (1 + a * k).toFixed(4) + ',' + (1 - a * k).toFixed(4) + ')'; };
    el.animate([
      { transform: 'scale(1, 1)', offset: 0 },
      { transform: s(1), offset: 0.2 },
      { transform: s(-0.6), offset: 0.42 },
      { transform: s(0.3), offset: 0.64 },
      { transform: s(-0.12), offset: 0.84 },
      { transform: 'scale(1, 1)', offset: 1 }
    ], { duration: strong ? 1200 : 1000, easing: 'ease-in-out', composite: 'add' });
  }
  function glitch(el, strong) {
    if (!moves(el)) return;
    var cls = strong ? 'lg-glitch' : 'lg-ripple';
    if (el.classList.contains('lg-glitch') || el.classList.contains('lg-ripple')) { el.classList.remove('lg-glitch', 'lg-ripple'); void el.offsetWidth; } // restart only if running
    el.classList.add(cls);
    var f = el.__lgFilter;
    if (f && strong) lensPulse(f);
    setTimeout(function () { el.classList.remove(cls); }, strong ? 520 : 720);
  }
  // Press: the lens bends harder, then eases back (120 ms rise, 520 ms settle).
  function lensPulse(f) {
    var maps = f.el.querySelectorAll('feDisplacementMap');
    var t0 = performance.now(); f.pulse = t0;
    (function step(now) {
      if (f.pulse !== t0) return; // a newer press took over
      var t = now - t0;
      var a = t < 120 ? 0.7 * (t / 120) : 0.7 * Math.pow(Math.max(0, 1 - (t - 120) / 520), 3);
      Array.prototype.forEach.call(maps, function (m, i) { m.setAttribute('scale', (f.scales[i] * (1 + a)).toFixed(2)); });
      if (t < 640) requestAnimationFrame(step);
    })(t0);
  }
  function settle(el) { el.style.removeProperty('--lx'); el.style.removeProperty('--ly'); }
  var lastHover = null;
  doc.addEventListener('pointerover', function (e) {
    if (!fineMQ.matches) return;
    var el = e.target.closest && e.target.closest('.lg');
    if (lastHover && lastHover !== el && !lastHover.contains(e.target)) settle(lastHover);
    if (el && el !== lastHover && !el.contains(e.relatedTarget)) { wobble(el, false); glitch(el, false); }
    lastHover = el;
  }, { passive: true });
  doc.documentElement.addEventListener('pointerleave', function () { if (lastHover) settle(lastHover); lastHover = null; });
  function play(el, cls, ms) {
    if (el.classList.contains(cls)) { el.classList.remove(cls); void el.offsetWidth; } // a reflow restarts it; skipped when idle
    el.classList.add(cls);
    clearTimeout(el['__t' + cls]);
    el['__t' + cls] = setTimeout(function () { el.classList.remove(cls); }, ms);
  }
  doc.addEventListener('pointerdown', function (e) {
    var el = e.target.closest && e.target.closest('.lg');
    if (!el) return;
    if (e.pointerType !== 'mouse') {
      // Touch: the highlight jumps to the finger, then drifts home on release.
      var r = el.getBoundingClientRect();
      el.style.setProperty('--lx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      el.style.setProperty('--ly', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      if (!reduceMQ.matches) play(el, 'lg-shine', 1400);
    }
    wobble(el, true);
    glitch(el, true);
  }, { passive: true });
  ['pointerup', 'pointercancel'].forEach(function (type) {
    doc.addEventListener(type, function (e) {
      if (e.pointerType === 'mouse') return;
      var el = e.target.closest && e.target.closest('.lg');
      if (el) setTimeout(function () { settle(el); }, 500);
    }, { passive: true });
  });

  /* Touch screens have no hover, so glass answers to scrolling instead: a
     control gliding into view catches a shine sweep and a brief glint, once
     per entry. The hero name glitches once after its reveal, and on tap. */
  var glintIO = null;
  if (!fineMQ.matches && !reduceMQ.matches && 'IntersectionObserver' in window) {
    glintIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var el = e.target;
        if (!e.isIntersecting) { el.__glinted = false; return; }
        if (el.__glinted) return;
        el.__glinted = true;
        play(el, 'lg-shine', 1400);
        play(el, 'lg-glint', 900);
      });
    }, { rootMargin: '-18% 0px -18% 0px' });
  }
  var title = doc.querySelector('.hero__title');
  if (title && !fineMQ.matches && !reduceMQ.matches) {
    setTimeout(function () { play(title, 'lg-name-glitch', 560); }, 2900);
    title.addEventListener('pointerdown', function () { play(title, 'lg-name-glitch', 560); }, { passive: true });
  }

  function start() {
    doc.body.appendChild(svg);
    root.classList.add(canRefract ? 'lg-refract' : 'lg-frost');
    scan();
    // Widgets and some page parts are injected after load (palette, theme toggle, chat).
    var pending = false;
    var relevant = function (n) { return n.nodeType === 1 && (n.matches(SELECTOR) || !!n.querySelector(SELECTOR)); };
    new MutationObserver(function (records) {
      if (pending) return;
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (relevant(added[j])) { pending = true; requestAnimationFrame(function () { pending = false; scan(); }); return; }
        }
      }
    }).observe(doc.body, { childList: true, subtree: true });
    lessGlass.addEventListener('change', function () { Array.prototype.forEach.call(doc.querySelectorAll('.lg'), function (el) { refit(el); }); });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
