/* =========================================================================
   liquid-glass.js: Apple-style liquid glass for cards, buttons and controls.

   For each glass element a displacement map is drawn for its exact size and
   corner radius: zero in the flat centre, rising only inside a thin bezel,
   pointing along the edge normal. An SVG filter displaces the backdrop's
   red, green and blue channels by slightly different amounts (dispersion),
   so the rainbow split appears only where the "glass" curves.

   Chromium applies it through backdrop-filter: url(#...). Other browsers get
   frosted blur + saturation + the same rim and cursor highlight. Controls
   get a slow jelly wobble with a soft blur on hover and a mild glitch on
   press; reading cards never move. Reduced
   motion turns the wobble and glitch off; reduced transparency and forced
   colours make every surface solid (CSS).
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
    '.nav', '.btn', '.icon-btn', '.tilt-toggle', '.tile', '.cap', '.tl__body', '.project', '.form',
    '.culture__item', '.honor.is-featured', '.xp-panel', '.xp-start',
    // other pages
    '.navbar .nav-container', '.project-card', '.publication-item', '.detail-metric',
    '.btn-primary', '.btn-secondary', '.action-btn', '.detail-link', '.detail-back',
    // chapter rail (chapter-scroll.js)
    '.chapters', '.chapters__drop',
    // theme widgets
    '.theme-toggle', '#accent-switcher .accent-trigger', '#accent-switcher .accent-tray'
  ].join(',');

  var canRefract = (function () {
    try { return CSS.supports('backdrop-filter', 'url(#a)') && /Chrome|Chromium|Edg\//.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent); } catch (e) { return false; }
  })();

  // One hidden <svg> hosts every filter; filters are shared by size bucket.
  var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  var defs = doc.createElementNS(svg.namespaceURI, 'defs');
  svg.appendChild(defs);
  var cache = {}; var count = 0;

  function mapURL(w, h, r, bezel) {
    var s = 0.5; // half resolution is plenty for a smooth lens profile
    var W = Math.max(8, Math.round(w * s)); var H = Math.max(8, Math.round(h * s));
    var c = doc.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d'); var img = ctx.createImageData(W, H); var d = img.data;
    var rr = Math.min(r * s, W / 2, H / 2); var b = Math.max(2, bezel * s);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var px = x + 0.5 - W / 2; var py = y + 0.5 - H / 2;
        var qx = Math.abs(px) - (W / 2 - rr); var qy = Math.abs(py) - (H / 2 - rr);
        var ox = Math.max(qx, 0); var oy = Math.max(qy, 0);
        var sdf = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - rr; // < 0 inside
        var dist = -sdf; var R = 128; var G = 128;
        if (dist >= 0 && dist < b) {
          var t = 1 - dist / b; var mag = t * t * (3 - 2 * t); // convex bezel, flat centre
          var nx; var ny;
          if (qx > 0 && qy > 0) { var l = Math.sqrt(qx * qx + qy * qy) || 1; nx = (qx / l) * Math.sign(px); ny = (qy / l) * Math.sign(py); }
          else if (qx > qy) { nx = Math.sign(px); ny = 0; } else { nx = 0; ny = Math.sign(py); }
          R = 128 - 127 * nx * mag; G = 128 - 127 * ny * mag; // bend toward the centre
        }
        var i = (y * W + x) * 4; d[i] = R; d[i + 1] = G; d[i + 2] = 128; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  function filterFor(w, h, r) {
    var bw = Math.round(w / 8) * 8; var bh = Math.round(h / 8) * 8; var br = Math.round(r);
    var key = bw + 'x' + bh + 'r' + br;
    if (cache[key]) return cache[key];
    var id = 'lg-' + (++count);
    var bezel = Math.min(24, Math.max(8, Math.min(bw, bh) * 0.22));
    var strength = Math.min(46, Math.max(14, Math.min(bw, bh) * 0.32));
    var ns = svg.namespaceURI;
    var f = doc.createElementNS(ns, 'filter');
    f.setAttribute('id', id); f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', '100%'); f.setAttribute('height', '100%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML =
      '<feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="blur"/>' +
      '<feImage href="' + mapURL(bw, bh, br, bezel) + '" x="0" y="0" width="' + bw + '" height="' + bh + '" preserveAspectRatio="none" result="map"/>' +
      '<feDisplacementMap in="blur" in2="map" scale="' + strength + '" xChannelSelector="R" yChannelSelector="G" result="dr"/>' +
      '<feColorMatrix in="dr" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>' +
      '<feDisplacementMap in="blur" in2="map" scale="' + (strength * 0.88) + '" xChannelSelector="R" yChannelSelector="G" result="dg"/>' +
      '<feColorMatrix in="dg" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>' +
      '<feDisplacementMap in="blur" in2="map" scale="' + (strength * 0.76) + '" xChannelSelector="R" yChannelSelector="G" result="db"/>' +
      '<feColorMatrix in="db" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/>' +
      '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>';
    defs.appendChild(f);
    cache[key] = { id: id, el: f, strength: strength };
    return cache[key];
  }

  function apply(el) {
    if (el.__lg) return;
    el.__lg = true;
    el.classList.add('lg');
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; // anchor the sheen
    if (!el.querySelector(':scope > .lg-sheen')) {
      var sheen = doc.createElement('span'); sheen.className = 'lg-sheen'; sheen.setAttribute('aria-hidden', 'true');
      el.appendChild(sheen); // last child, so :first-child styles on the content keep working
    }
    refit(el);
  }
  function refit(el) {
    if (!canRefract || lessGlass.matches) { el.style.removeProperty('--lg-filter'); el.classList.remove('lg--refract'); return; }
    var r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    var rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    var f = filterFor(r.width, r.height, Math.min(rad, r.height / 2));
    el.style.setProperty('--lg-filter', 'url(#' + f.id + ')');
    el.__lgFilter = f;
    el.classList.add('lg--refract');
  }

  var ro = window.ResizeObserver ? new ResizeObserver(function (entries) { entries.forEach(function (e) { refit(e.target); }); }) : null;
  function scan() {
    Array.prototype.forEach.call(doc.querySelectorAll(SELECTOR), function (el) {
      if (el.__lg) return;
      apply(el);
      if (ro) ro.observe(el);
      if (glintIO) glintIO.observe(el);
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
  var STILL = '.project, .project-card, .publication-item, .tile, .cap, .tl__body, .form, .culture__item, .xp-panel, .detail-metric, .honor';
  function moves(el) { return !reduceMQ.matches && el.matches(CONTROL) && !el.matches(STILL); }
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
    el.classList.remove('lg-glitch', 'lg-ripple'); void el.offsetWidth; el.classList.add(cls);
    var f = el.__lgFilter;
    if (f && strong) {
      var maps = f.el.querySelectorAll('feDisplacementMap');
      Array.prototype.forEach.call(maps, function (m, i) { m.setAttribute('scale', String(f.strength * (1.7 - i * 0.2))); });
      setTimeout(function () { Array.prototype.forEach.call(maps, function (m, i) { m.setAttribute('scale', String(f.strength * (1 - i * 0.12))); }); }, 320);
    }
    setTimeout(function () { el.classList.remove(cls); }, strong ? 520 : 720);
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
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
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
      if (!moves(el) && !reduceMQ.matches) play(el, 'lg-ripple', 720); // cards: blur ripple, no movement
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

  /* Touch screens have no hover, so glass answers to scrolling instead: a card
     gliding into view catches a shine sweep and a brief focus glint, once per
     entry. The hero name glitches once after its reveal, and again on tap. */
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
    var title = doc.querySelector('.hero__title');
    if (title) {
      setTimeout(function () { play(title, 'lg-name-glitch', 560); }, 1900);
      title.addEventListener('pointerdown', function () { play(title, 'lg-name-glitch', 560); }, { passive: true });
    }
  }

  /* While the page scrolls, refracting glass falls back to plain blur: the SVG
     displacement filter is re-run for every frame the backdrop moves, which
     halves the frame rate. Refraction returns as soon as scrolling settles. */
  if (canRefract) {
    var scrollT = 0;
    window.addEventListener('scroll', function () {
      if (!scrollT) root.classList.add('lg-scrolling');
      clearTimeout(scrollT);
      scrollT = setTimeout(function () { scrollT = 0; root.classList.remove('lg-scrolling'); }, 160);
    }, { passive: true });
  }

  function start() {
    doc.body.appendChild(svg);
    root.classList.add(canRefract ? 'lg-refract' : 'lg-frost');
    scan();
    // Widgets and some page parts are injected after load (palette, theme toggle, chat, render.js).
    var pending = false;
    new MutationObserver(function () { if (!pending) { pending = true; requestAnimationFrame(function () { pending = false; scan(); }); } }).observe(doc.body, { childList: true, subtree: true });
    lessGlass.addEventListener('change', function () { Array.prototype.forEach.call(doc.querySelectorAll('.lg'), refit); });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
