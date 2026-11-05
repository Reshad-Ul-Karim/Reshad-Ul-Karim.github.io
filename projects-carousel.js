/* =========================================================================
   projects-carousel.js: the homepage projects carousel (index.html).

   The track is a native sideways scroller with scroll snap, so the browser
   scrolls it on the compositor and it never takes over the page scroll.
   This file only adds what native scrolling lacks:
   - prev / next buttons (one stop per press) and the arrow keys;
   - mouse drag on desktop: snap pauses while dragging, the release settles
     on the next stop in the drag direction, and a drag never opens a link;
   - pager dots that follow the scroll and jump to a stop.
   Stops are the card starts the track can actually reach, so the last few
   cards on a wide screen share the final stop.
   ========================================================================= */
(function () {
  'use strict';
  var track = document.getElementById('projects-track');
  if (!track) return;
  var cards = Array.prototype.slice.call(track.children);
  if (!cards.length) return;
  var prevBtn = document.querySelector('[data-carousel="prev"]');
  var nextBtn = document.querySelector('[data-carousel="next"]');
  var dotsEl = track.parentElement.querySelector('.carousel__dots');
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var behavior = function () { return reduceMQ.matches ? 'auto' : 'smooth'; };

  var stops = []; var dots = []; var current = -1;

  // Layout offsets (the track is position: relative), not rects: the block's
  // reveal transform would scale rects and put every stop off by a few pixels.
  function measure() {
    var pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
    var max = Math.max(0, track.scrollWidth - track.clientWidth);
    var next = [];
    cards.forEach(function (c) {
      var x = Math.round(Math.min(max, Math.max(0, c.offsetLeft - pad)));
      if (!next.length || x - next[next.length - 1] > 4) next.push(x);
    });
    stops = next;
    buildDots();
    sync();
  }

  function buildDots() {
    if (!dotsEl || dots.length === stops.length) return;
    dotsEl.textContent = '';
    dots = stops.map(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'carousel__dot';
      var h = cards[i] && cards[i].querySelector('h3');
      b.setAttribute('aria-label', 'Show ' + (h ? h.textContent.trim() : 'project ' + (i + 1)));
      b.addEventListener('click', function () { goTo(i); });
      dotsEl.appendChild(b);
      return b;
    });
    dotsEl.hidden = stops.length < 2;
    current = -1;
  }

  function nearest(x) {
    var best = 0;
    for (var i = 1; i < stops.length; i++) if (Math.abs(stops[i] - x) < Math.abs(stops[best] - x)) best = i;
    return best;
  }
  function goTo(i) {
    i = Math.max(0, Math.min(stops.length - 1, i));
    track.scrollTo({ left: stops[i], behavior: behavior() });
  }
  function step(dir) { goTo(nearest(track.scrollLeft) + dir); }

  function sync() {
    var x = track.scrollLeft; var max = track.scrollWidth - track.clientWidth;
    if (prevBtn) prevBtn.disabled = x <= 2;
    if (nextBtn) nextBtn.disabled = x >= max - 2;
    var i = nearest(x);
    if (i === current) return;
    current = i;
    dots.forEach(function (d, k) { if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
  }
  var ticking = false;
  track.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; sync(); });
  }, { passive: true });

  if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });
  track.addEventListener('keydown', function (e) {
    if (e.target !== track) return; // keys inside a card's links behave normally
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });

  /* ---- Mouse drag (touch and trackpads scroll natively) ----------------- */
  var drag = null; var swallow = false;
  track.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { id: e.pointerId, x0: e.clientX, left0: track.scrollLeft, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
  });
  track.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x0;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      track.classList.add('is-dragging'); // first: with snap on, scrollLeft writes snap straight back
      try { track.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
    }
    var dt = Math.max(1, e.timeStamp - drag.lastT);
    drag.v = (e.clientX - drag.lastX) / dt; drag.lastX = e.clientX; drag.lastT = e.timeStamp;
    track.scrollLeft = drag.left0 - dx;
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null;
    if (!d.moved) return;
    swallow = true; setTimeout(function () { swallow = false; }, 0);
    // Settle on the next stop the way the drag (or its fling) was heading.
    var x = track.scrollLeft; var dir = Math.abs(d.v) > 0.3 ? (d.v < 0 ? 1 : -1) : (x > d.left0 ? 1 : -1);
    var i = nearest(x);
    if (dir > 0 && stops[i] < x - 4) i++;
    if (dir < 0 && stops[i] > x + 4) i--;
    i = Math.max(0, Math.min(stops.length - 1, i));
    track.scrollTo({ left: stops[i], behavior: behavior() });
    // Snap comes back once the settle has finished, so it cannot cut it short.
    var restore = function () { track.classList.remove('is-dragging'); };
    if ('onscrollend' in track) track.addEventListener('scrollend', restore, { once: true });
    else setTimeout(restore, 700);
    if (Math.abs(stops[i] - x) < 2) restore();
  }
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('click', function (e) { if (swallow) { e.preventDefault(); e.stopPropagation(); } }, true);
  track.addEventListener('dragstart', function (e) { e.preventDefault(); });

  if (window.ResizeObserver) new ResizeObserver(measure).observe(track);
  else window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure);
  measure();
})();
