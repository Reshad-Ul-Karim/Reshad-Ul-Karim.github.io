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

  var ACCENTS = ['blue', 'red', 'orange', 'mono'];
  var STORAGE_KEY = 'accent';
  var LABELS = { blue: 'Blue accent', red: 'Red accent', orange: 'Orange accent', mono: 'Monochrome accent' };

  /* ---- 1. Apply persisted accent ASAP (minimise flash) ---- */
  function readAccent() {
    var saved;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { saved = null; }
    return ACCENTS.indexOf(saved) !== -1 ? saved : 'blue';
  }

  var currentAccent = readAccent();
  document.documentElement.setAttribute('data-accent', currentAccent);

  function prefersReducedMotion() {
    return window.matchMedia &&
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---- 2. Accent application with optional View Transition ---- */
  function applyAccent(accent) {
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
      tray.appendChild(sw);
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
      var active = swatchEls[currentAccent] || swatchEls.blue;
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

  /* ---- 4. Init ---- */
  function init() {
    if (document.getElementById('accent-switcher')) return;
    buildUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
