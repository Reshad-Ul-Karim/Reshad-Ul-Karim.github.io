/* =========================================================================
   chapter-scroll.js: the homepage's chapter scroller (index.html only).

   One small scroll loop drives:
   - a liquid-glass chapter rail (left edge on wide screens, a bottom pill on
     phones). Its droplet glides between chapters and stretches with speed,
     then wobbles back like water. Click a chapter, drag the droplet, or use
     the arrows to travel;
   - --scroll-v, which the liquid-glass highlight follows.
   Scrolling stays native: links and arrows use the browser's own smooth
   scrolling (instant with reduced motion), and nothing moves the page after
   the reader stops. Only the rail is written to per frame.
   ========================================================================= */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var win = window;
  var reduceMQ = win.matchMedia('(prefers-reduced-motion: reduce)');
  var LABELS = { home: 'Intro', about: 'About', expertise: 'Expertise', experience: 'Experience', projects: 'Projects', research: 'Research', awards: 'Awards', cultural: 'Culture', contact: 'Contact' };

  var sections = Array.prototype.filter.call(doc.querySelectorAll('main > section[id]'), function (s) { return LABELS[s.id]; });
  if (sections.length < 2) return;
  var n = sections.length;
  root.classList.add('cs-on');

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function marginOf(el) { return parseFloat(getComputedStyle(el).scrollMarginTop) || 0; }
  var margins = [];
  // Every section shares the [id] scroll-margin rule, so one read covers them all.
  function measureMargins() { var m = marginOf(sections[1] || sections[0]); margins = sections.map(function (s, i) { return i === 0 ? 0 : m; }); }
  measureMargins();

  /* ---- Rail ------------------------------------------------------------- */
  var arrow = '<svg class="icon icon--stroke" aria-hidden="true"><use href="#i-arrow-right"/></svg>';
  var rail = doc.createElement('nav');
  rail.className = 'chapters';
  rail.setAttribute('aria-label', 'Chapters');
  var html = '<button type="button" class="chapters__step chapters__step--prev" data-step="-1" aria-label="Previous chapter">' + arrow + '</button>' +
    '<div class="chapters__rail"><span class="chapters__line" aria-hidden="true"><span class="chapters__fill"></span></span>' +
    '<span class="chapters__drop" aria-hidden="true"></span><ol class="chapters__list">';
  sections.forEach(function (s, i) {
    html += '<li><a class="chapters__dot" href="#' + s.id + '" data-i="' + i + '"><span class="chapters__label">' + LABELS[s.id] + '</span></a></li>';
  });
  html += '</ol></div><p class="chapters__now" aria-hidden="true"><span class="chapters__name"></span><span class="chapters__count"></span></p>' +
    '<button type="button" class="chapters__step chapters__step--next" data-step="1" aria-label="Next chapter">' + arrow + '</button>';
  rail.innerHTML = html;
  doc.body.appendChild(rail);
  var railEl = rail.querySelector('.chapters__rail');
  var list = rail.querySelector('.chapters__list');
  var drop = rail.querySelector('.chapters__drop');
  var fill = rail.querySelector('.chapters__fill');
  var dots = Array.prototype.slice.call(rail.querySelectorAll('.chapters__dot'));
  var nameEl = rail.querySelector('.chapters__name');
  var countEl = rail.querySelector('.chapters__count');


  /* ---- Engine state ------------------------------------------------------ */
  var tops = [];
  var f = 0;
  var active = -1;
  var lastSy = win.scrollY;
  var lastT = performance.now();
  var vel = 0;
  var sc = 1; var sv = 0; // droplet stretch (spring)
  var gap = 28;
  var drag = null;
  var scrollV = 0;

  var spans = []; var maxS = 0;
  function measure() {
    var sy = win.scrollY;
    maxS = root.scrollHeight - win.innerHeight;
    spans = sections.map(function (s) { var r = s.getBoundingClientRect(); return [r.top + sy, r.bottom + sy]; });
    if (list.firstElementChild) gap = list.firstElementChild.offsetHeight || gap;
  }
  function maxScroll() { return root.scrollHeight - win.innerHeight; }

  function goChapter(i) {
    i = clamp(i, 0, n - 1);
    var y = tops[i] != null ? tops[i] : sections[i].getBoundingClientRect().top + win.scrollY - margins[i];
    win.scrollTo({ top: clamp(Math.round(y), 0, maxScroll()), behavior: reduceMQ.matches ? 'auto' : 'smooth' });
  }

  /* ---- The loop: reads first, then writes --------------------------------- */
  var ticking = false;
  function kick() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  function frame(now) {
    ticking = false;
    var busy = false;
    var sy = win.scrollY; var vh = win.innerHeight; var max = maxS;

    // Reads: page offsets cached by measure(), so no layout is read during the
    // scroll itself.
    if (!spans.length) measure();
    tops = spans.map(function (s, i) { return clamp(s[0] - margins[i], 0, max); });

    // Position along the chapters, as a fractional index
    var i = 0;
    while (i < n - 1 && sy >= tops[i + 1] - 1) i++;
    var span = i < n - 1 ? tops[i + 1] - tops[i] : 0;
    f = i + (span > 0 ? clamp((sy - tops[i]) / span, 0, 1) : 0);
    var cur = clamp(Math.round(f), 0, n - 1);

    // Velocity and the droplet's watery stretch
    var dt = Math.max(1, now - lastT);
    var v = (sy - lastSy) / dt; lastSy = sy; lastT = now;
    vel += (v - vel) * 0.22;
    if (Math.abs(vel) < 0.003) vel = 0; else busy = true;
    var st = 1 + Math.min(Math.abs(vel) * 0.45, 1.3);
    sv = (sv + (st - sc) * 0.14) * 0.8; sc += sv;
    if (Math.abs(sv) > 0.0006 || Math.abs(st - sc) > 0.002) busy = true;

    // Writes: rail
    drop.style.transform = 'translate3d(-50%,' + (f * gap).toFixed(1) + 'px,0) scale(' + (1 / Math.sqrt(sc)).toFixed(3) + ',' + sc.toFixed(3) + ')';
    fill.style.transform = 'scaleY(' + (n > 1 ? f / (n - 1) : 0).toFixed(4) + ')';
    rail.style.setProperty('--cs-p', (n > 1 ? f / (n - 1) : 0).toFixed(4));
    rail.classList.toggle('is-awake', sy > vh * 0.35);
    if (cur !== active) {
      if (active >= 0) {
        if (drop.classList.contains('lg-ripple')) { drop.classList.remove('lg-ripple'); void drop.offsetWidth; }
        drop.classList.add('lg-ripple');
        setTimeout(function () { drop.classList.remove('lg-ripple'); }, 720);
      }
      active = cur;
      dots.forEach(function (d, k) { if (k === cur) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      nameEl.textContent = LABELS[sections[cur].id];
      countEl.textContent = (cur + 1) + ' / ' + n;
      doc.dispatchEvent(new CustomEvent('chapterchange', { detail: { index: cur, id: sections[cur].id } }));
    }

    // Writes: liquid-glass highlight follows the speed
    // Coarse steps: each change restyles the page and repaints every visible sheen.
    var sq = Math.round(clamp(vel / 2.5, -1, 1) * 20) / 20;
    if (sq !== scrollV) {
      scrollV = sq;
      if (win.__lgScrollV) win.__lgScrollV(sq); else root.style.setProperty('--scroll-v', String(sq));
    }

    if (busy) kick();
  }

  /* ---- Input ------------------------------------------------------------- */
  win.addEventListener('scroll', kick, { passive: true });

  // In-page links use native smooth scrolling. A far target is reached by an
  // instant jump to just short of it first, so the page is not dragged through
  // every chapter in between; focus then moves to the target as a link would.
  doc.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-open-assistant')) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    var target = id && doc.getElementById(id);
    if (!target) return;
    e.preventDefault();
    var y = clamp(Math.round(target.getBoundingClientRect().top + win.scrollY - marginOf(target)), 0, maxScroll());
    var d = y - win.scrollY; var vh = win.innerHeight;
    if (!reduceMQ.matches && Math.abs(d) > vh * 2.2) win.scrollTo({ top: y - (d > 0 ? 1 : -1) * vh * 1.1, behavior: 'auto' });
    win.scrollTo({ top: y, behavior: reduceMQ.matches ? 'auto' : 'smooth' });
    if (history.pushState) history.pushState(null, '', '#' + id);
    if (!target.hasAttribute('tabindex') && !target.matches('a, button, input, textarea, select')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  // Arrows: previous / next chapter from where the reader is now.
  rail.addEventListener('click', function (e) {
    var b = e.target.closest('[data-step]');
    if (!b) return;
    var dir = +b.getAttribute('data-step');
    goChapter(dir > 0 ? Math.floor(f + 0.02) + 1 : Math.ceil(f - 0.02) - 1);
  });
  list.addEventListener('keydown', function (e) {
    var k = dots.indexOf(doc.activeElement);
    if (k < 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      dots[clamp(k + (e.key === 'ArrowDown' ? 1 : -1), 0, n - 1)].focus();
    }
  });

  // Drag the droplet (or anywhere on the rail) to scrub; release settles on a chapter.
  function scrub(y) {
    var lr = list.getBoundingClientRect();
    var g = clamp((y - lr.top - gap / 2) / gap, 0, n - 1);
    var k = Math.min(n - 2, Math.floor(g));
    win.scrollTo(0, Math.round(tops[k] + (g - k) * (tops[k + 1] - tops[k])));
  }
  railEl.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    drag = { id: e.pointerId, y0: e.clientY, moved: false };
  });
  railEl.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.abs(e.clientY - drag.y0) < 5) return;
      drag.moved = true;
      railEl.setPointerCapture(e.pointerId);
      rail.classList.add('is-dragging');
    }
    e.preventDefault();
    scrub(e.clientY);
  });
  var swallowClick = false;
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var moved = drag.moved; drag = null;
    rail.classList.remove('is-dragging');
    if (!moved) return;
    swallowClick = true; setTimeout(function () { swallowClick = false; }, 60);
    goChapter(Math.round(f));
  }
  win.addEventListener('pointerup', endDrag, true);
  win.addEventListener('pointercancel', endDrag, true);
  // A drag that ends over a dot must not also follow its link.
  railEl.addEventListener('click', function (e) { if (swallowClick) { e.preventDefault(); e.stopPropagation(); } }, true);


  /* ---- Layout changes ---------------------------------------------------- */
  var relayout = function () { measureMargins(); measure(); kick(); };
  win.addEventListener('resize', relayout, { passive: true });
  win.addEventListener('load', relayout);
  var mainEl = doc.querySelector('main');
  if (win.ResizeObserver && mainEl) new ResizeObserver(function () { measure(); kick(); }).observe(mainEl);
  relayout();
})();
