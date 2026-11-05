/* =========================================================================
   chapter-scroll.js: the homepage's chapter scroller (index.html only).

   One scroll loop drives everything that moves with the page:
   - a liquid-glass chapter rail (left edge on wide screens, a bottom pill on
     phones). Its droplet glides between chapters and stretches with speed,
     then wobbles back like water. Click a chapter, drag the droplet, or use
     the arrows to travel;
   - eased glides for every in-page link, and a gentle settle that aligns a
     chapter when a scroll stops close to its start;
   - chapter morphs: each chapter arrives as a floating glass card that opens
     into the page and recedes a little as it leaves (--ce / --cl);
   - the projects carousel: pinned on wide screens so the page scroll moves the
     cards sideways and settles card by card; a native swipe carousel elsewhere;
   - --scroll-v on <html>, which the liquid-glass highlight follows.
   Reduced motion: no glides, settles, morphs or pinning; the rail still works.
   ========================================================================= */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var win = window;
  var reduceMQ = win.matchMedia('(prefers-reduced-motion: reduce)');
  var pinMQ = win.matchMedia('(min-width: 960px) and (min-height: 560px) and (hover: hover) and (pointer: fine)');
  var LABELS = { home: 'Intro', about: 'About', expertise: 'Expertise', experience: 'Experience', projects: 'Projects', research: 'Research', awards: 'Awards', cultural: 'Culture', contact: 'Contact' };

  var sections = Array.prototype.filter.call(doc.querySelectorAll('main > section[id]'), function (s) { return LABELS[s.id]; });
  if (sections.length < 2) return;
  var n = sections.length;
  root.style.scrollBehavior = 'auto'; // glides are eased here; CSS smooth scrolling would fight them
  root.classList.add('cs-on');

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function marginOf(el) { return parseFloat(getComputedStyle(el).scrollMarginTop) || 0; }
  var margins = [];
  function measureMargins() { margins = sections.map(function (s, i) { return i === 0 ? 0 : marginOf(s); }); }
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
  var projectsDot = dots[sections.map(function (s) { return s.id; }).indexOf('projects')];

  /* ---- Carousel (pinned on wide screens) --------------------------------- */
  var pin = doc.querySelector('[data-pin]');
  var sticky = pin && pin.querySelector('.projects-pin__sticky');
  var track = doc.getElementById('projects-track');
  var bar = pin && pin.querySelector('.projects-pin__bar > span');
  var cards = track ? Array.prototype.slice.call(track.children) : [];
  var prevBtn = doc.querySelector('[data-carousel="prev"]');
  var nextBtn = doc.querySelector('[data-carousel="next"]');
  var P = { on: false, shift: 0, step: 0, top: 0, start: 0, p: 0, lefts: [], widths: [], trackL: 0, trackR: 0 };

  function measurePin() {
    if (!pin || !track || cards.length < 2) return;
    var want = pinMQ.matches && !reduceMQ.matches;
    root.classList.toggle('cs-pin', want);
    P.on = want;
    track.style.transform = '';
    if (!want) {
      pin.style.height = ''; sticky.style.top = '';
      cards.forEach(function (c) { c.style.removeProperty('--cv'); });
      return;
    }
    // Layout offsets (the track is positioned in pin mode), so the cards' depth
    // scale never skews the numbers.
    var tr = track.getBoundingClientRect();
    var pad = parseFloat(getComputedStyle(track).paddingRight) || 0;
    var last = cards[cards.length - 1];
    P.lefts = cards.map(function (c) { return c.offsetLeft; });
    P.widths = cards.map(function (c) { return c.offsetWidth; });
    P.shift = Math.max(0, last.offsetLeft + last.offsetWidth + pad - track.clientWidth);
    P.step = cards[1].offsetLeft - cards[0].offsetLeft;
    P.trackL = tr.left; P.trackR = tr.left + track.clientWidth;
    var head = (doc.querySelector('[data-header]') || { getBoundingClientRect: function () { return { bottom: 64 }; } }).getBoundingClientRect().bottom + 16;
    var sh = sticky.offsetHeight;
    P.top = Math.round(Math.max(head, (win.innerHeight - sh) / 2));
    sticky.style.top = P.top + 'px';
    pin.style.height = Math.round(sh + P.shift) + 'px';
  }

  /* ---- Engine state ------------------------------------------------------ */
  var tops = [];
  var f = 0;
  var active = -1;
  var lastSy = win.scrollY;
  var lastT = performance.now();
  var vel = 0;
  var sc = 1; var sv = 0; // droplet stretch (spring)
  var gap = 28;
  var glide = null;
  var drag = null;
  var intent = false; var touching = false; var lastInput = 0;
  var scrollV = 0;
  var morphCache = [];

  function maxScroll() { return root.scrollHeight - win.innerHeight; }

  function glideTo(y, dur, done) {
    y = clamp(Math.round(y), 0, maxScroll());
    if (reduceMQ.matches) { win.scrollTo(0, y); if (done) done(); return; }
    var from = win.scrollY; var d = y - from;
    if (Math.abs(d) < 2) { if (done) done(); return; }
    // Far targets: jump to 1.2 screens short, then glide in. Flying through every
    // chapter in between meant drawing (and revealing) all of them at speed.
    var far = win.innerHeight * 2.2;
    if (Math.abs(d) > far) {
      from = y - (d > 0 ? 1 : -1) * win.innerHeight * 1.2;
      win.scrollTo(0, Math.round(from)); d = y - from;
    }
    glide = { from: from, d: d, t0: performance.now(), dur: dur || clamp(420 + Math.sqrt(Math.abs(d)) * 14, 520, 1000), done: done };
    kick();
  }
  function goChapter(i, done) {
    i = clamp(i, 0, n - 1);
    glideTo(tops[i] != null ? tops[i] : sections[i].getBoundingClientRect().top + win.scrollY - margins[i], 0, done);
  }

  function settle() {
    var sy = win.scrollY; var vh = win.innerHeight;
    if (doc.activeElement && doc.activeElement.matches && doc.activeElement.matches('input, textarea, select')) return;
    var sel = win.getSelection && win.getSelection();
    if (sel && String(sel).length) return;
    if (P.on && P.shift > 0 && sy > P.start - 4 && sy < P.start + P.shift + 4) {
      var k = Math.round((sy - P.start) / P.step);
      var t = clamp(P.start + k * P.step, P.start, P.start + P.shift);
      if (Math.abs(t - sy) > 3) glideTo(t, 560);
      return;
    }
    var best = null;
    tops.forEach(function (t) { if (best === null || Math.abs(t - sy) < Math.abs(best - sy)) best = t; });
    if (best !== null && Math.abs(best - sy) < vh * 0.16 && Math.abs(best - sy) > 3) glideTo(best, 600);
  }

  /* ---- The loop: reads first, then writes --------------------------------- */
  var ticking = false;
  function kick() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  function frame(now) {
    ticking = false;
    var busy = false;
    if (glide) {
      var t = clamp((now - glide.t0) / glide.dur, 0, 1);
      win.scrollTo(0, Math.round(glide.from + glide.d * ease(t)));
      if (t >= 1) { var dn = glide.done; glide = null; if (dn) dn(); } else busy = true;
    }
    var sy = win.scrollY; var vh = win.innerHeight; var max = maxScroll();
    var motion = !reduceMQ.matches;

    // Reads
    tops = sections.map(function (s, i) { return clamp(s.getBoundingClientRect().top + sy - margins[i], 0, max); });
    var rects = motion ? sections.map(function (s) { return s.getBoundingClientRect(); }) : null;
    if (P.on) P.start = pin.getBoundingClientRect().top + sy - P.top;
    if (list.firstElementChild) gap = list.firstElementChild.offsetHeight || gap;

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
        drop.classList.remove('lg-ripple'); void drop.offsetWidth; drop.classList.add('lg-ripple');
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
    if (sq !== scrollV) { scrollV = sq; root.style.setProperty('--scroll-v', String(sq)); }

    // Writes: chapter morphs
    if (rects) {
      rects.forEach(function (r, k) {
        if (k === 0) return;
        var e = clamp((vh - r.top) / (vh * 0.75), 0, 1);
        var l = clamp((vh * 0.35 - r.bottom) / (vh * 0.35), 0, 1);
        var key = e.toFixed(3) + '|' + l.toFixed(3);
        if (morphCache[k] === key) return;
        morphCache[k] = key;
        sections[k].style.setProperty('--ce', e.toFixed(3));
        sections[k].style.setProperty('--cl', l.toFixed(3));
      });
    }

    // Writes: pinned carousel
    if (P.on && P.shift > 0) {
      var p = clamp((sy - P.start) / P.shift, 0, 1);
      P.p = p;
      var x = p * P.shift;
      track.style.transform = 'translate3d(' + (-x).toFixed(1) + 'px,0,0)';
      if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      var L = P.trackL - 24; var R = P.trackR + 24;
      cards.forEach(function (c, k) {
        var left = P.trackL + P.lefts[k] - x; var w = P.widths[k];
        c.style.setProperty('--cv', clamp(Math.min(left + w - L, R - left) / w, 0, 1).toFixed(3));
      });
      var inPin = sy > P.start - 2 && sy < P.start + P.shift + 2;
      if (projectsDot) { projectsDot.classList.toggle('is-carousel', inPin); projectsDot.style.setProperty('--pin', p.toFixed(3)); }
      syncCarouselBtns();
    }

    // Settle once the user's own scroll comes to rest
    if (intent) {
      if (!glide && !drag && !touching && now - lastInput > 170 && Math.abs(vel) < 0.03) { intent = false; if (motion) settle(); }
      else busy = true;
    }
    if (busy) kick();
  }

  /* ---- Input ------------------------------------------------------------- */
  win.addEventListener('scroll', kick, { passive: true });
  function userInput() { glide = null; intent = true; lastInput = performance.now(); kick(); }
  win.addEventListener('wheel', userInput, { passive: true });
  win.addEventListener('touchstart', function () { touching = true; glide = null; }, { passive: true });
  win.addEventListener('touchend', function () { touching = false; userInput(); }, { passive: true });
  win.addEventListener('touchcancel', function () { touching = false; }, { passive: true });
  win.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (/^(PageUp|PageDown|ArrowUp|ArrowDown|Home|End| )$/.test(e.key)) userInput();
  });

  // In-page links glide; focus lands on the target afterwards.
  doc.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    var target = id && doc.getElementById(id);
    if (!target) return;
    e.preventDefault();
    var k = sections.indexOf(target);
    var y = k === 0 ? 0 : target.getBoundingClientRect().top + win.scrollY - marginOf(target);
    if (history.pushState) history.pushState(null, '', '#' + id);
    glideTo(y, 0, function () {
      if (!target.hasAttribute('tabindex') && !target.matches('a, button, input, textarea, select')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
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
      drag.moved = true; glide = null;
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

  /* ---- Carousel controls ------------------------------------------------- */
  function syncCarouselBtns() {
    var atStart; var atEnd;
    if (P.on) { atStart = P.p <= 0.005; atEnd = P.p >= 0.995; }
    else if (track) { atStart = track.scrollLeft <= 2; atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2; }
    if (prevBtn) prevBtn.disabled = !!atStart;
    if (nextBtn) nextBtn.disabled = !!atEnd;
  }
  function carousel(dir) {
    if (P.on && P.shift > 0) {
      var k = Math.round((P.p * P.shift) / P.step) + dir;
      glideTo(clamp(P.start + k * P.step, P.start, P.start + P.shift), 640);
      return;
    }
    var w = cards[0] ? cards[0].getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0) : track.clientWidth;
    track.scrollBy({ left: dir * w, behavior: reduceMQ.matches ? 'auto' : 'smooth' });
  }
  if (track) {
    if (prevBtn) prevBtn.addEventListener('click', function () { carousel(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { carousel(1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); carousel(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); carousel(-1); }
    });
    track.addEventListener('scroll', syncCarouselBtns, { passive: true });
  }

  /* ---- Layout changes ---------------------------------------------------- */
  var relayout = function () { measureMargins(); measurePin(); morphCache = []; syncCarouselBtns(); kick(); };
  win.addEventListener('resize', relayout, { passive: true });
  win.addEventListener('load', relayout);
  pinMQ.addEventListener('change', relayout);
  reduceMQ.addEventListener('change', relayout);
  if (win.ResizeObserver && sticky) new ResizeObserver(function () { if (!glide) { measurePin(); kick(); } }).observe(sticky);
  relayout();
})();
