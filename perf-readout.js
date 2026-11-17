/* =========================================================================
   perf-readout.js: on-device diagnostics, loaded only with ?perf in the URL.

   Shows which rendering path this device got and why: tier, 3D state and
   quality rung, GPU name, motion preferences, canvas count and live frame
   times. Tap the panel to copy the readout.
   ========================================================================= */
(function () {
  'use strict';
  var root = document.documentElement;
  var box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;margin:0;padding:10px 12px;max-width:min(92vw,420px);' +
    'font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#d7fff4;background:rgba(8,12,14,0.92);border:1px solid #3de0b8;' +
    'border-radius:10px;white-space:pre-wrap;cursor:pointer';
  var gpu = 'unknown';
  try {
    var gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) gpu = 'no WebGL';
    else {
      var info = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    }
  } catch (e) { gpu = 'error'; }
  var mq = function (q) { try { return matchMedia(q).matches; } catch (e) { return false; } };
  var times = []; var last = 0; var worst = 0;
  function tick(t) {
    if (last) { var d = t - last; times.push(d); if (times.length > 120) times.shift(); if (d > worst) worst = d; }
    last = t;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  function text() {
    var s = times.slice().sort(function (a, b) { return a - b; });
    var p50 = s.length ? s[Math.floor(s.length / 2)] : 0;
    var p95 = s.length ? s[Math.floor(s.length * 0.95)] : 0;
    var slow = times.filter(function (d) { return d > 25; }).length;
    return [
      'tier        ' + (root.classList.contains('perf-lite') ? 'lite (' + (root.getAttribute('data-tier-why') || '') + ')' : 'full'),
      '3D          ' + (root.dataset.gl || 'not started') + (root.dataset.glWhy ? ' (' + root.dataset.glWhy + ')' : '') + ', rung ' + (root.dataset.glRung || '0'),
      'GPU         ' + gpu,
      'glass       ' + (root.classList.contains('lg-refract') ? 'refraction' : 'frosted') + ', ' + document.querySelectorAll('.lg--refract').length + ' lenses',
      'motion      ' + (mq('(prefers-reduced-motion: reduce)') ? 'REDUCED by system' : 'normal') + (root.classList.contains('motion-paused') ? ', PAUSED by toggle' : ''),
      'pointer     ' + (mq('(hover: hover) and (pointer: fine)') ? 'fine' : 'coarse'),
      'cores/mem   ' + (navigator.hardwareConcurrency || '?') + ' / ' + (navigator.deviceMemory || '?') + ' GB',
      'screen      ' + innerWidth + 'x' + innerHeight + ' @' + (window.devicePixelRatio || 1).toFixed(2),
      'canvases    ' + document.querySelectorAll('canvas').length,
      'islands     ' + Array.prototype.map.call(document.querySelectorAll('[data-island-ready]'), function (e) { return e.getAttribute('data-island'); }).join(', '),
      'frame ms    p50 ' + p50.toFixed(1) + '  p95 ' + p95.toFixed(1) + '  worst ' + worst.toFixed(0),
      'slow frames ' + slow + ' of last ' + times.length,
      '(tap to copy)'
    ].join('\n');
  }
  box.addEventListener('click', function () { try { navigator.clipboard.writeText(text()); box.style.borderColor = '#fff'; } catch (e) {} });
  setInterval(function () { box.textContent = text(); }, 500);
  (document.body || root).appendChild(box);
})();
