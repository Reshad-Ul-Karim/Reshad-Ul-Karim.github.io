/* =====================================================================
   GLOBAL ACCENT THEME TOGGLE
   - Accent dimension (blue/red/orange) independent of dark/light.
   - Reads/writes localStorage['accent'], reflects html[data-accent].
   - Injects a glassmorphism palette control near the dark/light toggle.
   - Uses the View Transitions API for a smooth accent morph when
     supported; degrades to instant in Safari/Firefox & reduced-motion.
   Loaded with `defer` after script.js. Owns ONLY this file + accent-theme.css.
   ===================================================================== */
(function () {
  'use strict';

  /* Teal is the first-visit default on every page (data-accent-default). */
  var COLOURS = ['teal', 'mono', 'blue', 'violet', 'sky', 'emerald', 'red', 'orange'];
  /* Neutral themes exist only in dark mode: picking one switches to dark, and
     choosing light while one is active falls back to the last colour accent. */
  var NEUTRALS = ['onyx', 'graphite', 'slate', 'midnight', 'plum', 'stone', 'sand', 'sage'];
  var ACCENTS = COLOURS.concat(NEUTRALS);
  var STORAGE_KEY = 'accent';
  var COLOUR_KEY = 'accent-colour';
  var LABELS = {
    mono: 'Monochrome accent', teal: 'Teal accent', blue: 'Blue accent', violet: 'Violet accent', sky: 'Sky accent',
    emerald: 'Emerald accent', red: 'Red accent', orange: 'Orange accent',
    onyx: 'Onyx (dark only)', graphite: 'Graphite (dark only)', slate: 'Slate (dark only)', midnight: 'Midnight (dark only)',
    plum: 'Plum (dark only)', stone: 'Stone (dark only)', sand: 'Sand (dark only)', sage: 'Sage (dark only)'
  };
  function isNeutral(a) { return NEUTRALS.indexOf(a) !== -1; }

  /* ---- 1. Apply persisted accent ASAP (minimise flash) ----
     With nothing saved, a page can name its own default on <html
     data-accent-default="...">; every page uses teal. */
  function readAccent() {
    var saved;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { saved = null; }
    var fallback = document.documentElement.getAttribute('data-accent-default');
    if (ACCENTS.indexOf(fallback) === -1) fallback = 'teal';
    return ACCENTS.indexOf(saved) !== -1 ? saved : fallback;
  }

  var currentAccent = readAccent();
  document.documentElement.setAttribute('data-accent', currentAccent);

  function syncThemeIcon() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    Array.prototype.forEach.call(document.querySelectorAll('.theme-toggle'), function (btn) {
      var icon = btn.querySelector('i');
      if (icon) icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }
  function forceDark() {
    var html = document.documentElement;
    try { localStorage.setItem('theme', 'dark'); } catch (e) {}
    if (html.getAttribute('data-theme') !== 'dark') { html.setAttribute('data-theme', 'dark'); syncThemeIcon(); }
  }
  if (isNeutral(currentAccent)) forceDark();

  function prefersReducedMotion() {
    return window.matchMedia &&
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---- 2. Accent application with optional View Transition ---- */
  function applyAccent(accent) {
    if (isNeutral(accent)) forceDark();
    else { try { localStorage.setItem(COLOUR_KEY, accent); } catch (e) {} }
    document.documentElement.setAttribute('data-accent', accent);
    try { localStorage.setItem(STORAGE_KEY, accent); } catch (e) {}
    currentAccent = accent;
    updateActiveUI();
  }

  function setAccent(accent) {
    if (ACCENTS.indexOf(accent) === -1 || accent === currentAccent) {
      // still close the tray / update UI even on re-click
      updateActiveUI();
      return;
    }

    // View Transitions: feature-detect; skip animation under reduced-motion.
    if (typeof document.startViewTransition === 'function' && !prefersReducedMotion()) {
      try {
        document.startViewTransition(function () { applyAccent(accent); });
        return;
      } catch (e) {
        /* fall through to instant */
      }
    }
    applyAccent(accent);
  }

  /* ---- 3. Build the control ---- */
  var root, trigger, tray;
  var swatchEls = {};

  function buildUI() {
    root = document.createElement('div');
    root.id = 'accent-switcher';

    // Swatch tray
    tray = document.createElement('div');
    tray.className = 'accent-tray';
    tray.setAttribute('role', 'group');
    tray.setAttribute('aria-label', 'Accent color');

    var groups = {};
    [['colour', 'Colour accents', COLOURS], ['neutral', 'Neutral dark themes', NEUTRALS]].forEach(function (g) {
      var el = document.createElement('div');
      el.className = 'accent-group accent-group--' + g[0];
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', g[1]);
      g[2].forEach(function (a) { groups[a] = el; });
      tray.appendChild(el);
    });

    ACCENTS.forEach(function (accent) {
      var sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'accent-swatch';
      sw.setAttribute('data-swatch', accent);
      sw.setAttribute('aria-label', LABELS[accent]);
      sw.setAttribute('title', LABELS[accent]);
      sw.addEventListener('click', function (ev) {
        ev.stopPropagation();
        setAccent(accent);
      });
      swatchEls[accent] = sw;
      groups[accent].appendChild(sw);
    });

    // Trigger (palette) button
    trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'accent-trigger';
    trigger.innerHTML = '<i class="fas fa-palette" aria-hidden="true"></i>';
    trigger.setAttribute('aria-label', 'Choose accent color');
    trigger.setAttribute('title', 'Accent color');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', function (ev) {
      ev.stopPropagation();
      toggleOpen();
    });

    root.appendChild(tray);
    root.appendChild(trigger);
    document.body.appendChild(root);

    // Close when clicking elsewhere / pressing Escape.
    document.addEventListener('click', function (ev) {
      if (root.classList.contains('open') && !root.contains(ev.target)) {
        setOpen(false);
      }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && root.classList.contains('open')) {
        setOpen(false);
        trigger.focus();
      }
    });

    updateActiveUI();
  }

  function setOpen(open) {
    root.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      // focus the active swatch for keyboard users
      var active = swatchEls[currentAccent] || swatchEls[ACCENTS[0]];
      if (active) active.focus();
    }
  }

  function toggleOpen() {
    setOpen(!root.classList.contains('open'));
  }

  function updateActiveUI() {
    ACCENTS.forEach(function (accent) {
      var el = swatchEls[accent];
      if (!el) return;
      var isActive = accent === currentAccent;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  /* Light chosen while a neutral theme is active: return to the last colour accent. */
  function watchTheme() {
    new MutationObserver(function () {
      if (document.documentElement.getAttribute('data-theme') === 'light' && isNeutral(currentAccent)) {
        var back;
        try { back = localStorage.getItem(COLOUR_KEY); } catch (e) { back = null; }
        if (COLOURS.indexOf(back) === -1) back = document.documentElement.getAttribute('data-accent-default');
        if (COLOURS.indexOf(back) === -1) back = 'teal';
        applyAccent(back);
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ---- 4. Init ---- */
  function init() {
    if (document.getElementById('accent-switcher')) return;
    buildUI();
    watchTheme();
    if (isNeutral(currentAccent)) { forceDark(); syncThemeIcon(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
