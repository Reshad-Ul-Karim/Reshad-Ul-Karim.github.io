/* =========================================================================
   perf-tier.js: picks a rendering tier once, before first paint.

   html.perf-lite marks devices where the costly enhancements are skipped: no
   SVG refraction or backdrop blur on secondary glass, lighter hero geometry
   and a smaller 3D pixel budget (liquid-glass.css/.js, home-scene.js). The
   layout, colours and glass recipe are the same on every tier, so the lite
   page looks finished, not like a different site.

   Lite when any of these hold (no single hint decides on its own):
   - Save-Data, or prefers-reduced-data;
   - 2 GB of memory or less, or 2 CPU cores or less;
   - 4 GB or less AND 4 cores or less;
   - a touch device with 4 GB or less;
   - no memory figure (Firefox) and 4 cores or less.
   The tier never changes during a visit: a mid-scroll switch is exactly the
   visible pop this replaces. The old runtime downgrade's saved flag is cleared.
   Loaded synchronously and early in <head>; it only sets a class on <html>.
   ========================================================================= */
(function () {
  'use strict';
  var root = document.documentElement;
  var nav = navigator;
  var conn = nav.connection || {};
  var cores = nav.hardwareConcurrency || 8;
  var mem = nav.deviceMemory || 8;
  var lessData = !!conn.saveData;
  try { lessData = lessData || matchMedia('(prefers-reduced-data: reduce)').matches; } catch (e) {}
  var lite = lessData || mem <= 2 || cores <= 2 || (mem <= 4 && cores <= 4);
  // Phones and tablets with 4 GB or less. Where memory is not reported (Firefox,
  // Safari), 4 real cores or fewer; Safari is left out because it reports 4
  // for every device under 8 cores.
  var coarse = false;
  try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e) {}
  var apple = /Safari/.test(nav.userAgent) && !/Chrome|Chromium|Android/.test(nav.userAgent);
  if (!lite && coarse && nav.deviceMemory && mem <= 4) lite = true;
  if (!lite && !nav.deviceMemory && !apple && cores <= 4) lite = true;
  root.setAttribute('data-tier-why', lite ? (lessData ? 'save-data' : 'mem ' + (nav.deviceMemory || '?') + ' / cores ' + cores) : '');
  try { localStorage.removeItem('perf-tier'); } catch (e) {}
  if (lite) root.classList.add('perf-lite');
  window.__perfLite = function () { return root.classList.contains('perf-lite'); };
})();
