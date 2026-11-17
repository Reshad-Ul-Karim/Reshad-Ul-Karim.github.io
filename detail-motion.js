/* =========================================================================
   detail-motion.js: motion and wayfinding for the project detail pages.

   - reading progress bar under the navigation;
   - hero entrance (title words, chips, cover) and a pointer tilt on the cover;
   - sections rise in as they arrive; "By the numbers" counts up to the
     figures already printed on the page; tech tags cascade;
   - "On this page" rail beside the sections on wide screens;
   - the story gets a Play control (walks the beats for you), a caption with
     the current beat, and a pulse on each beat change;
   - previous / next project cards from data/projects.json.

   Nothing here runs at idle: every animation is finite or driven by scroll or
   the pointer. Reduced motion keeps the wayfinding and drops the movement.
   Content is never hidden without this script (html.dm gates the start states).
   ========================================================================= */
(function () {
  'use strict';
  var doc = document; var root = doc.documentElement;
  var page = doc.querySelector('.ph-page');
  if (!page) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var lite = root.classList.contains('perf-lite');
  var hasIO = 'IntersectionObserver' in window;
  var el = function (tag, cls, html) { var n = doc.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---- Reading progress ---------------------------------------------------- */
  var bar = el('div', 'dm-progress'); bar.setAttribute('aria-hidden', 'true');
  bar.appendChild(el('span'));
  doc.body.appendChild(bar);
  var fill = bar.firstChild; var ticking = false;
  function progress() {
    ticking = false;
    var max = Math.max(1, root.scrollHeight - window.innerHeight);
    fill.style.transform = 'scaleX(' + Math.min(1, Math.max(0, window.scrollY / max)).toFixed(4) + ')';
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(progress); } }, { passive: true });
  progress();

  /* ---- Hero entrance --------------------------------------------------------- */
  var title = page.querySelector('.ph-title');
  if (!reduced && hasIO) {
    root.classList.add('dm');
    if (title && !title.querySelector('.dm-word')) {
      var words = title.textContent.trim().split(/\s+/);
      title.setAttribute('aria-label', title.textContent.trim());
      title.innerHTML = words.map(function (w, i) {
        return '<span class="dm-word" aria-hidden="true" style="--i:' + i + '"><span>' + esc(w) + '</span></span>';
      }).join(' ');
    }
    Array.prototype.forEach.call(page.querySelectorAll('.ph-hero__meta > *, .ph-actions > *'), function (n, i) { n.style.setProperty('--i', i); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('dm-in'); }); });
    setTimeout(function () { root.classList.add('dm-in'); }, 1200); // fail-safe: never leave the hero hidden
  }

  /* ---- Cover tilt (mouse only) --------------------------------------------- */
  var cover = page.querySelector('.ph-hero__cover');
  if (cover && fine && !reduced && !lite) {
    var tx = 0; var ty = 0; var cx = 0; var cy = 0; var traf = 0;
    var tiltFrame = function () {
      cx += (tx - cx) * 0.14; cy += (ty - cy) * 0.14;
      cover.style.setProperty('--dm-rx', (-cy * 5).toFixed(2) + 'deg');
      cover.style.setProperty('--dm-ry', (cx * 6).toFixed(2) + 'deg');
      cover.style.setProperty('--dm-gx', (50 + cx * 40).toFixed(1) + '%');
      cover.style.setProperty('--dm-gy', (50 + cy * 40).toFixed(1) + '%');
      traf = Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(tiltFrame) : 0;
    };
    var aim = function (x, y) { tx = x; ty = y; if (!traf) traf = requestAnimationFrame(tiltFrame); };
    cover.addEventListener('pointermove', function (e) {
      var r = cover.getBoundingClientRect();
      cover.classList.add('is-tilting');
      aim(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    });
    cover.addEventListener('pointerleave', function () { cover.classList.remove('is-tilting'); aim(0, 0); });
  }

  /* ---- Sections: reveal, count-up, tag cascade -------------------------------- */
  var sections = Array.prototype.slice.call(page.querySelectorAll('.detail-body > .ph-section'));
  function countUp(node) {
    var raw = node.textContent; var m = raw.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
    if (!m) return;
    var target = parseFloat(m[2].replace(/,/g, '')); if (!isFinite(target)) return;
    var decimals = (m[2].split('.')[1] || '').length; var commas = m[2].indexOf(',') >= 0;
    var fmt = function (v) {
      var s = v.toFixed(decimals);
      if (commas) { var parts = s.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = parts.join('.'); }
      return m[1] + s + m[3];
    };
    node.style.minWidth = node.getBoundingClientRect().width + 'px';
    var t0 = 0; var dur = 1300;
    var step = function (now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / dur); var e = 1 - Math.pow(1 - k, 4);
      node.textContent = k < 1 ? fmt(target * e) : raw; // always ends on the printed figure
      if (k < 1) requestAnimationFrame(step);
    };
    node.textContent = fmt(0);
    requestAnimationFrame(step);
  }
  Array.prototype.forEach.call(page.querySelectorAll('.detail-tags .tech-tag, .detail-metrics .detail-metric, .detail-prose li'), function (n) {
    var i = Array.prototype.indexOf.call(n.parentNode.children, n);
    n.style.setProperty('--i', Math.min(i, 14));
  });
  if (!reduced && hasIO) {
    var seen = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        seen.unobserve(e.target);
        e.target.classList.add('is-in');
        Array.prototype.forEach.call(e.target.querySelectorAll('.detail-metric-num'), countUp);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 }); // threshold 0: a section taller than the screen still counts
    sections.forEach(function (s) { seen.observe(s); });
    var related0 = page.querySelector('.ph-related'); if (related0) seen.observe(related0);
  } else {
    sections.forEach(function (s) { s.classList.add('is-in'); });
  }

  /* ---- "On this page" rail ---------------------------------------------------- */
  var body = page.querySelector('.detail-body');
  if (body && sections.length >= 3) {
    var rail = el('nav', 'dm-toc'); rail.setAttribute('aria-label', 'On this page');
    var list = el('ol');
    rail.appendChild(el('p', 'dm-toc__title', 'On this page'));
    rail.appendChild(list);
    var story = page.querySelector('.story');
    var targets = (story ? [story] : []).concat(sections);
    var links = targets.map(function (s, i) {
      if (!s.id) s.id = 'sec-' + i;
      var h = s.querySelector('.ph-h2 span') || s.querySelector('.ph-h2');
      var li = el('li'); var a = el('a', null, esc(s === story ? 'Visual story' : (h ? h.textContent : 'Section')));
      a.href = '#' + s.id; li.appendChild(a); list.appendChild(li);
      return a;
    });
    rail.style.setProperty('--n', sections.length + 2);
    body.insertBefore(rail, body.firstChild);
    body.classList.add('has-toc');
    if (hasIO) {
      var current = -1;
      var spy = new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.target.__dmOn = e.isIntersecting; });
        var idx = -1;
        for (var i = 0; i < targets.length; i++) if (targets[i].__dmOn) { idx = i; break; }
        if (idx < 0 || idx === current) return;
        current = idx;
        links.forEach(function (a, i) { if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      }, { rootMargin: '-30% 0px -55% 0px' });
      targets.forEach(function (t) { spy.observe(t); });
    }
  }

  /* ---- Story: play control, caption, beat pulse ------------------------------- */
  var storySec = page.querySelector('.story[data-story]');
  if (storySec) {
    var stage = storySec.querySelector('.story__stage');
    var beats = Array.prototype.slice.call(storySec.querySelectorAll('.story__beat'));
    var head = storySec.querySelector('.ph-head');
    if (stage && beats.length) {
      var cap = el('div', 'dm-caption'); cap.setAttribute('aria-hidden', 'true');
      var capNum = el('span', 'dm-caption__num'); var capText = el('span', 'dm-caption__text');
      cap.appendChild(capNum); cap.appendChild(capText); stage.appendChild(cap);
      var track = el('div', 'dm-track'); track.setAttribute('aria-hidden', 'true'); var trackFill = el('span'); track.appendChild(trackFill); stage.appendChild(track);
      var shown = -1;
      var sync = function () {
        var idx = -1;
        for (var i = 0; i < beats.length; i++) if (beats[i].classList.contains('is-active')) { idx = i; break; }
        if (idx < 0 || idx === shown) return;
        shown = idx;
        var h3 = beats[idx].querySelector('h3');
        capNum.textContent = (idx + 1 < 10 ? '0' : '') + (idx + 1) + ' / ' + (beats.length < 10 ? '0' : '') + beats.length;
        capText.textContent = h3 ? h3.textContent : '';
        trackFill.style.transform = 'scaleX(' + ((idx + 1) / beats.length).toFixed(4) + ')';
        stage.setAttribute('data-tone', beats[idx].getAttribute('data-tone') || '');
        if (!reduced) { stage.classList.remove('is-pulse'); void stage.offsetWidth; stage.classList.add('is-pulse'); }
      };
      new MutationObserver(sync).observe(storySec.querySelector('.story__beats'), { attributes: true, attributeFilter: ['class'], subtree: true });
      sync();

      if (head && !reduced) {
        var play = el('button', 'ph-btn dm-play', '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path class="dm-play__go" d="M8 5.5v13l11-6.5z" fill="currentColor"/><path class="dm-play__stop" d="M7 6h3.5v12H7zM13.5 6H17v12h-3.5z" fill="currentColor"/></svg><span>Play the story</span>');
        play.type = 'button';
        head.appendChild(play);
        var timer = 0; var at = 0;
        var label = play.querySelector('span');
        var stop = function () {
          if (!timer) return;
          clearTimeout(timer); timer = 0;
          play.classList.remove('is-playing'); label.textContent = 'Play the story';
          ['wheel', 'touchstart', 'keydown'].forEach(function (t) { window.removeEventListener(t, stop); });
        };
        var go = function () {
          if (at >= beats.length) { stop(); return; }
          var r = beats[at].getBoundingClientRect(); var sr = stage.getBoundingClientRect();
          var stacked = sr.width > storySec.getBoundingClientRect().width * 0.8;
          // Same anchor story.js reads: mid-screen beside the stage, or the gap below a pinned stage.
          var anchor = stacked ? Math.min(window.innerHeight * 0.82, sr.height + 78 + (window.innerHeight - sr.height - 78) * 0.45) : window.innerHeight * 0.5;
          window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - anchor, behavior: 'smooth' });
          at++;
          timer = setTimeout(go, 2800);
        };
        play.addEventListener('click', function () {
          if (timer) { stop(); return; }
          at = shown >= beats.length - 1 ? 0 : Math.max(0, shown);
          play.classList.add('is-playing'); label.textContent = 'Stop';
          ['wheel', 'touchstart', 'keydown'].forEach(function (t) { window.addEventListener(t, stop, { passive: true }); });
          timer = setTimeout(go, 10);
        });
      }
    }
  }

  /* ---- Previous / next project ------------------------------------------------- */
  var related = page.querySelector('.ph-related');
  var slug = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  if (related && slug && window.fetch) {
    fetch('../data/projects.json').then(function (r) { return r.ok ? r.json() : []; }).then(function (items) {
      if (!items || !items.length) return;
      var i = -1; items.forEach(function (p, k) { if (p.slug === slug) i = k; });
      if (i < 0 || items.length < 3) return;
      var wrap = el('div', 'dm-next');
      [[items[(i - 1 + items.length) % items.length], 'Previous project', 'prev'], [items[(i + 1) % items.length], 'Next project', 'next']].forEach(function (d) {
        var p = d[0]; if (!p || !p.slug) return;
        var a = el('a', 'dm-next__card dm-next__card--' + d[2]);
        a.href = p.slug + '.html';
        var src = p.media && p.media.type === 'image' && p.media.src ? '../' + p.media.src : '';
        a.innerHTML = (src ? '<span class="dm-next__img"><img alt="" loading="lazy" decoding="async" src="' + esc(src) + '"></span>' : '') +
          '<span class="dm-next__body"><span class="dm-next__kicker">' + d[1] + '</span><span class="dm-next__title">' + esc(p.shortTitle || p.title || p.slug) + '</span></span>';
        var img = a.querySelector('img');
        if (!img) a.classList.add('no-img');
        else img.addEventListener('error', function () { a.classList.add('no-img'); img.parentNode.remove(); });
        wrap.appendChild(a);
      });
      related.insertBefore(wrap, related.firstChild);
    }).catch(function () {});
  }
})();
