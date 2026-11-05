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
   - --scroll-v on <html>, which the liquid-glass highlight follows.
   The projects carousel is its own native scroller (projects-carousel.js).
   Reduced motion: no glides, settles or morphs; the rail still works.
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


  /* ---- Engine state ------------------------------------------------------ */
  var tops = [];
  var f = 0;
  var active = -1;
  var lastSy = win.scrollY;
  var lastDir = 0;
  var lastT = performance.now();
  var vel = 0;
  var sc = 1; var sv = 0; // droplet stretch (spring)
  var gap = 28;
  var glide = null;
  var drag = null;
  var intent = false; var touching = false; var lastInput = 0;
  var scrollV = 0;
  var morphCache = [];
  var morphEls = sections.map(function (s, k) {
    if (k === 0) return null;
    var card = doc.createElement('span'); card.className = 'cs-card'; card.setAttribute('aria-hidden', 'true');
    s.appendChild(card); // last, so :first-child rules on chapter content are unaffected
    return { wrap: s.querySelector(':scope > .wrap'), card: card };
  });

  var spans = []; var maxS = 0;
  function measure() {
    var sy = win.scrollY;
    maxS = root.scrollHeight - win.innerHeight;
    spans = sections.map(function (s) { var r = s.getBoundingClientRect(); return [r.top + sy, r.bottom + sy]; });
    if (list.firstElementChild) gap = list.firstElementChild.offsetHeight || gap;
  }
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
    // Settles only ever continue the way the reader was going. Snapping to the
    // nearest stop pulled every mouse-wheel notch (~100 px, then a pause) back
    // to where it started, so chapter starts felt stuck.
    var best = null;
    tops.forEach(function (t) {
      if (lastDir > 0 && t < sy - 3) return;
      if (lastDir < 0 && t > sy + 3) return;
      if (best === null || Math.abs(t - sy) < Math.abs(best - sy)) best = t;
    });
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
    var sy = win.scrollY; var vh = win.innerHeight; var max = maxS;
    var motion = !reduceMQ.matches;

    // Reads: page offsets cached by measure() (sections are never transformed,
    // only their .wrap), so no layout is read during the scroll itself.
    if (!spans.length) measure();
    tops = spans.map(function (s, i) { return clamp(s[0] - margins[i], 0, max); });
    // Lite tier (perf-tier.js): chapters stay put; no per-frame morph writes.
    var rects = motion && !root.classList.contains('perf-lite') ? spans.map(function (s) { return { top: s[0] - sy, bottom: s[1] - sy }; }) : null;

    // Position along the chapters, as a fractional index
    var i = 0;
    while (i < n - 1 && sy >= tops[i + 1] - 1) i++;
    var span = i < n - 1 ? tops[i + 1] - tops[i] : 0;
    f = i + (span > 0 ? clamp((sy - tops[i]) / span, 0, 1) : 0);
    var cur = clamp(Math.round(f), 0, n - 1);

    // Velocity and the droplet's watery stretch
    var dt = Math.max(1, now - lastT);
    if (!glide && Math.abs(sy - lastSy) > 0.5) lastDir = sy > lastSy ? 1 : -1;
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
    if (sq !== scrollV) {
      scrollV = sq;
      if (win.__lgScrollV) win.__lgScrollV(sq); else root.style.setProperty('--scroll-v', String(sq));
    }

    // Writes: chapter morphs (inline transform/opacity on two elements only)
    if (rects) {
      rects.forEach(function (r, k) {
        if (k === 0) return;
        var e = clamp((vh - r.top) / (vh * 0.75), 0, 1);
        var l = clamp((vh * 0.35 - r.bottom) / (vh * 0.35), 0, 1);
        var key = e.toFixed(3) + '|' + l.toFixed(3);
        if (morphCache[k] === key) return;
        morphCache[k] = key;
        var m = morphEls[k];
        // Always a 3D transform, settled or not: dropping it would tear down the
        // chapter's GPU layer and repaint the whole chapter when it moves again.
        if (m.wrap) m.wrap.style.transform = 'translate3d(0,' + ((1 - e) * 7).toFixed(3) + 'vh,0) scale(' + (1 - (1 - e) * 0.05 - l * 0.035).toFixed(4) + ')';
        var o = (1 - e) * (1 - l);
        m.card.style.opacity = o > 0.001 ? o.toFixed(3) : '';
        m.card.style.transform = o > 0.001 ? 'scaleX(' + (1 + e * 0.136).toFixed(4) + ')' : '';
      });
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


  /* ---- Layout changes ---------------------------------------------------- */
  var relayout = function () {
    measureMargins(); measure(); morphCache = [];
    if (reduceMQ.matches || root.classList.contains('perf-lite')) morphEls.forEach(function (m) { if (!m) return; if (m.wrap) m.wrap.style.transform = ''; m.card.style.opacity = ''; m.card.style.transform = ''; });
    kick();
  };
  win.addEventListener('resize', relayout, { passive: true });
  win.addEventListener('load', relayout);
  reduceMQ.addEventListener('change', relayout);
  doc.addEventListener('perf:lite', relayout);
  var mainEl = doc.querySelector('main');
  if (win.ResizeObserver && mainEl) new ResizeObserver(function () { measure(); morphCache = []; kick(); }).observe(mainEl);
  relayout();
})();
