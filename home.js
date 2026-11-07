/* =========================================================================
   home.js: homepage interactions (index.html only).

   Everything here is progressive enhancement. With JavaScript off the page
   still has every link, the nav stays a plain list of links, videos open on
   YouTube, and the portrait is a normal image.

   Owns: nav disclosure + scrollspy, header surface tint, cursor ring, press
   feedback, the video and certificate dialogs, the contact form, the citation
   and data-driven counts, block reveals, research-card motifs and the awards
   highlight. The hero 3D lives in home-scene.js, the hero backdrop in
   hero-motion.js, the chat widget in assistant-widget.js.
   ========================================================================= */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fineMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
  var forcedMQ = window.matchMedia('(forced-colors: active)');
  var mobileNavMQ = window.matchMedia('(max-width: 900px)');

  /* ---- 0. Name reveal: characters come into focus one by one ------------- */
  var title = doc.querySelector('.hero__title');
  if (title && !reduceMQ.matches) {
    var label = title.textContent.replace(/\s+/g, ' ').trim();
    title.setAttribute('aria-label', label); // screen readers get the name as one word group
    var order = 0;
    Array.prototype.forEach.call(title.querySelectorAll(':scope > span'), function (line) {
      var text = line.textContent;
      line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < text.length; i++) {
        var ch = doc.createElement('span');
        ch.className = 'char';
        ch.textContent = text[i] === ' ' ? '\u00a0' : text[i];
        // Settle out of order, starting within ~1.2 s.
        ch.style.setProperty('--d', String(Math.round(200 + ((order * 37) % 11) * 95)));
        line.appendChild(ch);
        order++;
      }
    });
  }
  if (title) title.classList.add('is-split');

  /* ---- 1. Navigation: disclosure on narrow screens ---------------------- */
  var header = doc.querySelector('[data-header]');
  var nav = header && header.querySelector('.nav');
  var toggle = header && header.querySelector('[data-nav-toggle]');
  var panel = header && doc.getElementById('nav-links');

  function setOpen(open, opts) {
    if (!nav || !toggle) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.querySelector('.nav__toggle-label').textContent = open ? 'Close' : 'Menu';
    if (!open && opts && opts.returnFocus) toggle.focus();
  }

  if (nav && toggle && panel) {
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    // Escape closes; focus returns to the toggle if it was inside the menu.
    nav.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false, { returnFocus: nav.contains(doc.activeElement) });
      }
    });
    // Following a link closes the panel.
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    // A click or tap outside the bar closes it.
    doc.addEventListener('pointerdown', function (e) {
      if (nav.classList.contains('is-open') && !nav.contains(e.target)) setOpen(false);
    });
    // Leaving the narrow layout resets the state.
    mobileNavMQ.addEventListener('change', function () { setOpen(false); });
  }

  /* ---- 2. Scrollspy: aria-current on the section in view ----------------- */
  var navLinks = panel ? Array.prototype.slice.call(panel.querySelectorAll('a[href^="#"]')) : [];
  var linkFor = {};
  navLinks.forEach(function (a) { linkFor[a.getAttribute('href').slice(1)] = a; });
  // Sections without their own link (data-spy) light up the link they belong to.
  var spySections = Array.prototype.slice.call(doc.querySelectorAll('main section[id]')).filter(function (s) {
    return linkFor[s.getAttribute('data-spy') || s.id];
  });

  // Computed from positions on scroll (rAF-throttled) rather than from
  // intersection events, so a smooth scroll back to the top always clears it.
  // Section extents are cached (re-measured on resize and content changes):
  // reading layout on every scroll frame forced a style and layout pass.
  var pageMeasures = [];
  var remeasure = function () { pageMeasures.forEach(function (fn) { fn(); }); };
  if (window.ResizeObserver) { var mainEl = doc.querySelector('main'); if (mainEl) new ResizeObserver(remeasure).observe(mainEl); }
  window.addEventListener('load', remeasure);
  if (spySections.length) {
    var spyTicking = false;
    var current = null;
    var spans = [];
    var measureSpy = function () {
      var sy = window.scrollY;
      spans = spySections.map(function (s) { var r = s.getBoundingClientRect(); return [r.top + sy, r.bottom + sy]; });
    };
    pageMeasures.push(function () { measureSpy(); updateSpy(); });
    var updateSpy = function () {
      spyTicking = false;
      var line = window.scrollY + window.innerHeight * 0.4;
      var next = null;
      for (var i = 0; i < spans.length; i++) {
        if (spans[i][0] <= line && spans[i][1] > line) {
          next = spySections[i].getAttribute('data-spy') || spySections[i].id;
          break;
        }
      }
      if (next === current) return;
      current = next;
      navLinks.forEach(function (a) {
        if (a === linkFor[next]) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    };
    window.addEventListener('scroll', function () {
      if (!spyTicking) { spyTicking = true; requestAnimationFrame(updateSpy); }
    }, { passive: true });
    window.addEventListener('resize', function () { measureSpy(); updateSpy(); }, { passive: true });
    measureSpy();
    updateSpy();
  }

  /* ---- 3. Header tint follows the surface under it ----------------------- */
  var hero = doc.querySelector('[data-hero]');
  if (header && hero) {
    var surfaceTicking = false;
    var heroBottom = 0; var surface = '';
    var measureHero = function () { heroBottom = hero.getBoundingClientRect().bottom + window.scrollY; };
    var updateSurface = function () {
      surfaceTicking = false;
      var next = heroBottom - window.scrollY > 48 ? 'dark' : 'light';
      if (next !== surface) { surface = next; header.setAttribute('data-surface', next); } // a same-value write still restyles the header
    };
    pageMeasures.push(function () { measureHero(); updateSurface(); });
    window.addEventListener('scroll', function () {
      if (!surfaceTicking) { surfaceTicking = true; requestAnimationFrame(updateSurface); }
    }, { passive: true });
    window.addEventListener('resize', function () { measureHero(); updateSurface(); }, { passive: true });
    measureHero();
    updateSurface();
  }

  /* ---- 4. Press feedback: localized highlight at the pointer ------------- */
  doc.addEventListener('pointerdown', function (e) {
    var el = e.target.closest('.pressable');
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.style.setProperty('--press-x', (e.clientX - r.left) + 'px');
    el.style.setProperty('--press-y', (e.clientY - r.top) + 'px');
    el.classList.add('is-pressed');
    var release = function () {
      setTimeout(function () { el.classList.remove('is-pressed'); }, 140);
      el.removeEventListener('pointerup', release);
      el.removeEventListener('pointercancel', release);
      el.removeEventListener('pointerleave', release);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  }, { passive: true });

  /* ---- 5. Cursor: crisp SVG cursor + damped ring (fine pointers only) ----- */
  var ring = null;
  var ringState = { x: -100, y: -100, tx: -100, ty: -100, raf: 0 };

  function cursorAllowed() {
    return fineMQ.matches && !reduceMQ.matches && !forcedMQ.matches;
  }
  function ringFrame() {
    ringState.raf = 0;
    ringState.x += (ringState.tx - ringState.x) * 0.28;
    ringState.y += (ringState.ty - ringState.y) * 0.28;
    ring.style.transform = 'translate3d(' + ringState.x.toFixed(1) + 'px,' + ringState.y.toFixed(1) + 'px,0)';
    if (Math.abs(ringState.tx - ringState.x) > 0.1 || Math.abs(ringState.ty - ringState.y) > 0.1) {
      ringState.raf = requestAnimationFrame(ringFrame);
    }
  }
  function onCursorMove(e) {
    if (e.pointerType !== 'mouse') return;
    if (!ring.classList.contains('is-visible')) {
      ringState.x = e.clientX; ringState.y = e.clientY;
      ring.classList.add('is-visible');
    }
    ringState.tx = e.clientX; ringState.ty = e.clientY;
    var t = e.target;
    var action = t.closest && t.closest('a, button, summary, label[for], [role="button"]');
    var field = t.closest && t.closest('input, textarea, select');
    var text = !action && !field && t.closest && t.closest('p, h1, h2, h3, dd, dt, blockquote, figcaption');
    ring.classList.toggle('is-action', !!action);
    ring.classList.toggle('is-text', !!(text || field));
    ring.classList.toggle('on-dark', !!(t.closest && t.closest('[data-surface="dark"], .site-footer, .feature')));
    if (!ringState.raf) ringState.raf = requestAnimationFrame(ringFrame);
  }
  function onCursorDown() { ring.classList.add('is-down'); }
  function onCursorUp() { ring.classList.remove('is-down'); }
  function onCursorLeave() { ring.classList.remove('is-visible'); }

  function setupCursor() {
    var on = cursorAllowed();
    root.classList.toggle('has-cursor', fineMQ.matches && !forcedMQ.matches);
    if (on && !ring) {
      ring = doc.createElement('div');
      ring.className = 'cursor-ring';
      ring.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(ring);
      doc.addEventListener('pointermove', onCursorMove, { passive: true });
      doc.addEventListener('pointerdown', onCursorDown, { passive: true });
      doc.addEventListener('pointerup', onCursorUp, { passive: true });
      doc.documentElement.addEventListener('pointerleave', onCursorLeave);
    } else if (!on && ring) {
      doc.removeEventListener('pointermove', onCursorMove);
      doc.removeEventListener('pointerdown', onCursorDown);
      doc.removeEventListener('pointerup', onCursorUp);
      doc.documentElement.removeEventListener('pointerleave', onCursorLeave);
      cancelAnimationFrame(ringState.raf); ringState.raf = 0;
      ring.remove(); ring = null;
    }
  }
  setupCursor();
  [fineMQ, reduceMQ, forcedMQ].forEach(function (mq) { mq.addEventListener('change', setupCursor); });

  /* ---- 6. Video dialog: [data-video] links open an embedded player -------- */
  var dialog = doc.getElementById('video-dialog');
  var lastTrigger = null;
  if (dialog && typeof dialog.showModal === 'function') {
    var frame = dialog.querySelector('iframe');
    var titleEl = dialog.querySelector('.video-dialog__title');
    var closeVideo = function () { if (dialog.open) dialog.close(); };
    doc.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-video]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      lastTrigger = a;
      var id = encodeURIComponent(a.getAttribute('data-video'));
      var start = parseInt(a.getAttribute('data-start') || '0', 10) || 0;
      var label = a.getAttribute('data-video-title') || 'Video';
      titleEl.textContent = label;
      frame.title = label;
      frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&start=' + start;
      dialog.showModal();
    });
    dialog.querySelector('.video-dialog__close').addEventListener('click', closeVideo);
    dialog.addEventListener('click', function (e) { if (e.target === dialog) closeVideo(); });
    dialog.addEventListener('close', function () {
      frame.src = 'about:blank';
      if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
    });
  }

  /* ---- 7. Assistant shortcuts: open the chat widget's own button ---------- */
  doc.addEventListener('click', function (e) {
    var b = e.target.closest('[data-open-assistant]');
    if (!b) return;
    var fab = doc.getElementById('ask-reshad-fab');
    if (fab) { e.preventDefault(); fab.click(); }
    // No widget (blocked or failed): the button's href (#contact) still works.
  });

  /* ---- 8. Contact form: same endpoint as before (/api/book) --------------- */
  var form = doc.getElementById('contact-form');
  if (form) {
    var status = form.querySelector('[data-form-status]');
    var submit = form.querySelector('button[type="submit"]');
    var apiBase = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
      ? 'http://localhost:8000'
      : 'https://enterprise-ai-document-assistant-8baj.onrender.com';
    var say = function (msg, kind) {
      status.textContent = msg;
      status.classList.toggle('is-error', kind === 'error');
      status.classList.toggle('is-ok', kind === 'ok');
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(form));
      var problems = [];
      var mark = function (name, bad) {
        var el = form.elements[name];
        if (el) el.setAttribute('aria-invalid', bad ? 'true' : 'false');
        return bad;
      };
      if (mark('name', !data.name || data.name.trim().length < 2)) problems.push('a name (2+ characters)');
      if (mark('email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || ''))) problems.push('a valid email');
      if (mark('subject', !data.subject || data.subject.trim().length < 3)) problems.push('a subject (3+ characters)');
      if (mark('message', !data.message || data.message.trim().length < 10)) problems.push('a message (10+ characters)');
      if (problems.length) {
        say('Please add ' + problems.join(', ') + '.', 'error');
        var firstBad = form.querySelector('[aria-invalid="true"]');
        if (firstBad) firstBad.focus();
        return;
      }
      submit.disabled = true;
      var label = submit.querySelector('span');
      label.textContent = 'Sending…';
      say('Sending your message. The server can take a few seconds to wake up.');
      fetch(apiBase + '/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          purpose: '[' + data.subject + '] ' + data.message,
          website: data.website || ''
        })
      }).then(function (res) {
        if (!res.ok) throw new Error('status ' + res.status);
        say('Thanks, your message was sent. I will reply by email.', 'ok');
        form.reset();
      }).catch(function () {
        say('That did not go through. Please try again, or email reshad.sazid@gmail.com directly.', 'error');
      }).then(function () {
        submit.disabled = false;
        label.textContent = 'Send message';
      });
    });
  }

  /* ---- 9. Citation count: same-origin citations.json (updated daily) ------ */
  var citeEls = doc.querySelectorAll('[data-citations]');
  if (citeEls.length && window.fetch) {
    fetch('citations.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || typeof d.citations !== 'number' || d.citations < 0) return;
        Array.prototype.forEach.call(citeEls, function (el) { el.textContent = d.citations.toLocaleString(); });
      })
      .catch(function () {});
  }

  /* ---- 10. Footer year ----------------------------------------------------- */
  var year = doc.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---- 10b. Block reveals ---------------------------------------------------
         Blocks below the first screen rise in once (opacity + transform only)
         and are then left alone: nothing re-hides on the way back up, and
         blocks already on screen at load never animate. */
  if (!reduceMQ.matches && 'IntersectionObserver' in window) {
    var revealSel = '.section > .wrap > :not(ul, ol, .timeline-wrap, .about__layout, .awards__layout, .culture), .section > .wrap > :is(ul, ol) > li, .timeline > li, .about__layout > *, .awards__layout > *, .culture > *';
    var revealEls = Array.prototype.slice.call(doc.querySelectorAll(revealSel)).filter(function (el) { return !el.closest('.masthead'); });
    // The observer's first report says which blocks start below the screen
    // (only those are hidden), so set-up needs no layout reads of its own.
    var seen = new WeakSet();
    var revealIO = new IntersectionObserver(function (es) {
      es = es.filter(function (e) {
        if (seen.has(e.target)) return true;
        seen.add(e.target);
        if (!e.isIntersecting && e.boundingClientRect.top >= window.innerHeight) { e.target.classList.add('rv'); return false; }
        if (e.isIntersecting) revealIO.unobserve(e.target); // on screen at load: no entrance
        return false;
      });
      var batch = es.filter(function (e) { return e.isIntersecting; });
      batch.sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left; });
      batch.forEach(function (e, i) {
        var el = e.target;
        revealIO.unobserve(el);
        el.style.setProperty('--rv-i', String(Math.min(4, i)));
        el.classList.add('is-in');
        setTimeout(function () { el.classList.remove('rv', 'is-in'); el.style.removeProperty('--rv-i'); }, 1100 + i * 80);
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { revealIO.observe(el); });
  }

  /* ---- 10c. Research cards: one live motif at a time ------------------------
         Fine pointers: the hovered or focused card. Touch: the card most in
         view (one at a time). Others keep their still frame (home.css). */
  var caps = Array.prototype.slice.call(doc.querySelectorAll('.cap'));
  if (caps.length) {
    var activeCap = null;
    var setActive = function (cap) {
      if (cap === activeCap) return;
      if (activeCap) activeCap.classList.remove('is-active');
      activeCap = cap;
      if (cap) cap.classList.add('is-active');
    };
    caps.forEach(function (cap) {
      cap.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') setActive(cap); });
      cap.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && activeCap === cap) setActive(null); });
      cap.addEventListener('focusin', function () { setActive(cap); });
      cap.addEventListener('focusout', function (e) { if (!cap.contains(e.relatedTarget) && activeCap === cap) setActive(null); });
    });
    if ('IntersectionObserver' in window) {
      // Observed per card visual (cards can be taller than a phone screen).
      var ratios = new Map();
      var capIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) { ratios.set(e.target.closest('.cap'), e.isIntersecting ? e.intersectionRatio : 0); });
        if (fineMQ.matches) return;
        var best = null; var bestR = 0.55;
        ratios.forEach(function (r, cap) { if (r > bestR) { best = cap; bestR = r; } });
        setActive(best);
      }, { threshold: [0, 0.3, 0.55, 0.7, 0.85, 1] });
      caps.forEach(function (cap) { capIO.observe(cap.querySelector('.cap__visual') || cap); });
    }
  }

  /* ---- 10d. Awards: a highlight that follows the hovered or focused entry,
         and the timeline line drawn once when the section comes into view. */
  doc.querySelectorAll('.award-list').forEach(function (list) {
    var mark = doc.createElement('li');
    mark.className = 'award-list__mark';
    mark.setAttribute('aria-hidden', 'true');
    list.appendChild(mark);
    var show = function (item) {
      if (!item || item === mark) { list.classList.remove('has-mark'); return; }
      mark.style.transform = 'translateY(' + item.offsetTop + 'px)';
      mark.style.height = item.offsetHeight + 'px';
      list.classList.add('has-mark');
    };
    list.addEventListener('pointerover', function (e) { show(e.target.closest('.award')); });
    list.addEventListener('pointerleave', function () { show(null); });
    list.addEventListener('focusin', function (e) { show(e.target.closest('.award')); });
    list.addEventListener('focusout', function (e) { if (!list.contains(e.relatedTarget)) show(null); });
  });
  var awards = doc.getElementById('awards');
  if (awards) {
    if (!('IntersectionObserver' in window) || reduceMQ.matches) awards.classList.add('is-drawn');
    else {
      var drawIO = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { awards.classList.add('is-drawn'); drawIO.disconnect(); }
      }, { rootMargin: '0px 0px -15% 0px' });
      drawIO.observe(awards);
    }
  }

  /* ---- 10e. Certificate preview: loads the PDF only when asked, where the
         browser can show PDFs inline. Escape and the close button restore
         focus to the link; elsewhere the link opens the PDF in a new tab. */
  var certDialog = doc.getElementById('cert-dialog');
  if (certDialog && typeof certDialog.showModal === 'function' && navigator.pdfViewerEnabled) {
    var certFrame = certDialog.querySelector('iframe');
    var certTitle = certDialog.querySelector('.video-dialog__title');
    var certOpen = certDialog.querySelector('[data-cert-open]');
    var certTrigger = null;
    doc.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-cert-preview]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      certTrigger = a;
      var label = a.getAttribute('data-cert-title') || 'Certificate';
      certTitle.textContent = label;
      certFrame.title = label;
      certOpen.href = a.href;
      certFrame.src = a.href + '#view=FitH';
      certDialog.showModal();
    });
    certDialog.querySelector('.video-dialog__close').addEventListener('click', function () { certDialog.close(); });
    certDialog.addEventListener('click', function (e) { if (e.target === certDialog) certDialog.close(); });
    certDialog.addEventListener('close', function () {
      certFrame.src = 'about:blank';
      if (certTrigger) { certTrigger.focus(); certTrigger = null; }
    });
  }

  /* ---- 10f. Counts from the data files, so the page never drifts from them. */
  var countEls = doc.querySelectorAll('[data-count]');
  if (countEls.length && window.fetch) {
    var fill = function (kind, n) {
      Array.prototype.forEach.call(doc.querySelectorAll('[data-count="' + kind + '"]'), function (el) { el.textContent = String(n); });
    };
    var unique = function (list) {
      var seen = {};
      list.forEach(function (x) { if (x && x.slug) seen[x.slug] = 1; });
      return Object.keys(seen).length;
    };
    var countFrom = function (file, kind, keys) {
      fetch(file).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d) return;
        var list = Array.isArray(d) ? d : (keys.map(function (k) { return d[k]; }).filter(Array.isArray)[0] || []);
        if (kind === 'publications') list = list.filter(function (p) { return p.status !== 'upcoming'; });
        if (list.length) fill(kind, unique(list));
      }).catch(function () {});
    };
    var runCounts = function () {
      countFrom('data/projects.json', 'projects', ['projects', 'items']);
      countFrom('data/publications.json', 'publications', ['publications', 'items']);
    };
    if (doc.readyState === 'complete') runCounts(); else window.addEventListener('load', runCounts, { once: true });
  }

  /* ---- 11. Theme toggle: same control and key as script.js on the other
         pages (localStorage 'theme' -> html[data-theme]). This page defaults
         to dark grey when nothing is saved; the pre-paint script in <head>
         already applied it. -------------------------------------------------- */
  var themeBtn = doc.createElement('button');
  themeBtn.type = 'button';
  themeBtn.className = 'theme-toggle';
  themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
  function currentTheme() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function paintThemeIcon(theme) {
    var icon = themeBtn.querySelector('i');
    var dark = theme === 'dark';
    icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    themeBtn.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }
  var savedTheme = null;
  try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
  root.setAttribute('data-theme', savedTheme || 'dark');
  paintThemeIcon(currentTheme());
  themeBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    paintThemeIcon(next);
    themeBtn.classList.add('is-pressed');
    setTimeout(function () { themeBtn.classList.remove('is-pressed'); }, 150);
  });
  doc.body.appendChild(themeBtn);

  /* ---- 12. Keep the fixed widgets clear of the open mobile nav panel ------- */
  function rectsOverlap(a, b) {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  }
  function checkNavOverlap() {
    var open = nav && nav.classList.contains('is-open');
    var overlap = false;
    if (open) {
      var pr = panel.getBoundingClientRect();
      // The palette's collapsed tray is invisible, so only its trigger counts.
      ['#accent-switcher .accent-trigger', '.theme-toggle', '#ask-reshad-fab'].forEach(function (sel) {
        var el = doc.querySelector(sel);
        if (el && rectsOverlap(pr, el.getBoundingClientRect())) overlap = true;
      });
    }
    root.classList.toggle('nav-overlaps-fabs', overlap);
  }
  if (nav && toggle) {
    new MutationObserver(checkNavOverlap).observe(nav, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', checkNavOverlap, { passive: true });
  }
})();
