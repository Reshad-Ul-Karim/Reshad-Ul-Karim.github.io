/* =========================================================================
   three-extra.js  —  SITE-WIDE Three.js enhancements (lazy, accent-aware,
   mobile/reduced-motion safe). Companion to three-scene.js (the hero blob).

   WHAT THIS ADDS
   --------------
   1) A single FIXED, full-viewport WebGL BACKDROP behind ALL content: a cheap
      fullscreen-quad fragment shader (flowing aurora / fbm-noise field) whose
      colors track the live accent CSS vars and whose flow offset is driven by
      page scroll progress (Lenis -> ScrollTrigger, with a rAF fallback). Gives
      every section a subtle living backdrop. Rendered at 0.5x and CSS-scaled up
      (mix-blend-mode in CSS keeps it readable on light + dark themes).

   2) Per-section WebGL ACCENTS on #projects and #research: a small, slow shader
      motif (soft metaball / contour glow) that fades in when the section scrolls
      into view (IntersectionObserver-gated) and PAUSES rendering when offscreen.
      Complements — never fights — the existing GSAP section reveals.

   HARD CONSTRAINTS (all enforced below)
   -------------------------------------
   - REUSES the already-loaded global THREE (from three-scene.js's CDN tag).
     We POLL for window.THREE; we never inject a second three.js.
   - WebGL feature-detected; any failure -> silent no-op.
   - DPR capped (backdrop 1.0 + 0.5x internal scale; sections capped 1.5).
   - Render loops PAUSE when offscreen (IntersectionObserver) and when the tab
     is hidden (visibilitychange).
   - DISABLED entirely on (max-width:768px) or (hover:none)&(pointer:coarse).
   - prefers-reduced-motion:reduce -> render ONE static frame, no loops, no
     scroll-driven animation.
   - All canvases are pointer-events:none (CSS), behind content (z-index 0),
     sized from clientWidth so they can NEVER cause horizontal overflow.
   - Recolors live on html[data-accent]/[data-theme] change (MutationObserver).
   - Disposes/tears down cleanly when resized into the mobile breakpoint.
   ========================================================================= */

(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     0. EARLY BAILOUTS.
     --------------------------------------------------------------------- */
  if (window.__threeExtraInit) return;
  window.__threeExtraInit = true;

  var mq = function (q) {
    return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () {} };
  };
  var mqReduced = mq('(prefers-reduced-motion: reduce)');
  var mqSmall = mq('(max-width: 768px)');
  var mqCoarse = mq('(hover: none) and (pointer: coarse)');

  // Bail on small / touch-only devices entirely (CSS also hides any canvas).
  if (mqSmall.matches || mqCoarse.matches) return;

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl'))
      );
    } catch (e) {
      return false;
    }
  }
  if (!hasWebGL()) return;

  var REDUCED = mqReduced.matches;

  /* ----------------------------------------------------------------------
     1. WAIT FOR THE ALREADY-LOADED THREE (do NOT load a second copy).
        three-scene.js injects three.js r128; we just poll for the global.
     --------------------------------------------------------------------- */
  function whenThree(cb) {
    if (window.THREE) { cb(window.THREE); return; }
    var tries = 0;
    var MAX = 200; // ~20s at 100ms — generous, then give up silently
    var id = setInterval(function () {
      if (window.THREE) {
        clearInterval(id);
        cb(window.THREE);
      } else if (++tries > MAX) {
        clearInterval(id);
        // THREE never showed up — fail silently, no broken UI.
      }
    }, 100);
    // Also opportunistically hook the existing CDN tag's load event.
    var tag = document.querySelector('script[data-three-cdn]');
    if (tag) {
      tag.addEventListener('load', function () {
        if (window.THREE) { clearInterval(id); cb(window.THREE); }
      });
    }
  }

  function boot() {
    whenThree(function (THREE) {
      try {
        new SiteBackdrop(THREE);
        new SectionFx(THREE, 'projects');
        new SectionFx(THREE, 'research');
      } catch (e) {
        // Never let a WebGL hiccup break the page.
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ----------------------------------------------------------------------
     2. SHARED HELPERS — accent colors + global scroll progress.
     --------------------------------------------------------------------- */
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function readAccents(THREE) {
    return {
      primary: new THREE.Color(cssVar('--primary-color', '#6366f1')),
      secondary: new THREE.Color(cssVar('--secondary-color', '#ec4899')),
      accent: new THREE.Color(cssVar('--accent-color', '#06b6d4'))
    };
  }
  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  // A single shared, throttled scroll-progress value (0..1 down the page),
  // fed by ScrollTrigger if present, else a passive scroll listener. Consumers
  // read ScrollState.progress each frame — cheap, no per-consumer listeners.
  var ScrollState = (function () {
    var state = { progress: 0 };
    function computeFromWindow() {
      var doc = document.documentElement;
      var max = (doc.scrollHeight - doc.clientHeight) || 1;
      state.progress = Math.min(1, Math.max(0, window.scrollY / max));
    }
    if (!REDUCED) {
      // Prefer ScrollTrigger (already synced to Lenis by reveal-motion.js).
      if (window.gsap && window.ScrollTrigger) {
        try { window.gsap.registerPlugin(window.ScrollTrigger); } catch (e) {}
        window.ScrollTrigger.create({
          start: 0,
          end: 'max',
          onUpdate: function (self) { state.progress = self.progress; }
        });
      } else {
        window.addEventListener('scroll', computeFromWindow, { passive: true });
        computeFromWindow();
      }
    }
    return state;
  })();

  /* ----------------------------------------------------------------------
     3. SITE-WIDE BACKDROP — fullscreen fragment-shader aurora.
        One quad, one ShaderMaterial. Rendered at 0.5x internal scale.
     --------------------------------------------------------------------- */
  function SiteBackdrop(THREE) {
    var self = this;

    var layer = document.createElement('div');
    layer.className = 'tx-backdrop';
    layer.setAttribute('aria-hidden', 'true');
    // First element in <body> so it's under everything in paint order too.
    document.body.insertBefore(layer, document.body.firstChild);

    // Size from the layer box (clientWidth), never window — no overflow.
    function size() {
      return {
        w: Math.max(1, layer.clientWidth || document.documentElement.clientWidth),
        h: Math.max(1, layer.clientHeight || window.innerHeight)
      };
    }
    var dim = size();

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
    } catch (e) {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      return;
    }
    // Backdrop is a smooth gradient field — half-res is plenty and very cheap.
    var RENDER_SCALE = 0.5;
    renderer.setPixelRatio(1); // keep raw; we control resolution via setSize
    renderer.setSize(Math.round(dim.w * RENDER_SCALE), Math.round(dim.h * RENDER_SCALE), false);
    renderer.setClearColor(0x000000, 0);
    // CSS scales the low-res buffer up to fill the viewport.
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    layer.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    var accents = readAccents(THREE);
    var uniforms = {
      uTime:     { value: 0 },
      uScroll:   { value: 0 },
      uRes:      { value: new THREE.Vector2(dim.w, dim.h) },
      uColorA:   { value: accents.primary.clone() },
      uColorB:   { value: accents.secondary.clone() },
      uColorC:   { value: accents.accent.clone() },
      uDark:     { value: isDark() ? 1.0 : 0.0 }
    };

    var vert = [
      'varying vec2 vUv;',
      'void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }'
    ].join('\n');

    // Cheap value-noise fbm aurora. No textures, few octaves -> very light.
    var frag = [
      'precision mediump float;',
      'varying vec2 vUv;',
      'uniform float uTime;',
      'uniform float uScroll;',
      'uniform vec2 uRes;',
      'uniform vec3 uColorA;',
      'uniform vec3 uColorB;',
      'uniform vec3 uColorC;',
      'uniform float uDark;',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }',
      'float noise(vec2 p){',
      '  vec2 i = floor(p); vec2 f = fract(p);',
      '  vec2 u = f*f*(3.0-2.0*f);',
      '  float a = hash(i);',
      '  float b = hash(i+vec2(1.0,0.0));',
      '  float c = hash(i+vec2(0.0,1.0));',
      '  float d = hash(i+vec2(1.0,1.0));',
      '  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);',
      '}',
      'float fbm(vec2 p){',
      '  float v = 0.0; float amp = 0.5;',
      '  for(int i=0;i<4;i++){ v += amp*noise(p); p *= 2.02; amp *= 0.5; }',
      '  return v;',
      '}',
      'void main(){',
      // aspect-correct uv centered around scroll-shifted field
      '  vec2 uv = vUv;',
      '  uv.x *= uRes.x / max(uRes.y, 1.0);',
      '  float t = uTime * 0.04;',
      // scroll advances the field vertically -> backdrop "flows" as you scroll
      '  vec2 p = uv * 2.2 + vec2(0.0, uScroll * 2.5);',
      '  float n1 = fbm(p + vec2(t, -t*0.7));',
      '  float n2 = fbm(p * 1.7 - vec2(t*0.6, t));',
      '  float band = fbm(p*0.8 + n1*1.2 + vec2(0.0, t*0.5));',
      // blend the three accent colors across the noise field
      '  vec3 col = mix(uColorA, uColorB, smoothstep(0.2, 0.8, n1));',
      '  col = mix(col, uColorC, smoothstep(0.35, 0.95, n2));',
      // soft aurora ribbons',
      '  float ribbon = smoothstep(0.45, 0.62, band) * (1.0 - smoothstep(0.62, 0.82, band));',
      '  col += uColorC * ribbon * 0.6;',
      // intensity: keep it dim. dark theme can take a touch more light.
      '  float intensity = (uDark > 0.5) ? 0.55 : 0.85;',
      '  float vignette = smoothstep(1.25, 0.1, length(vUv - 0.5));',
      '  col *= intensity * (0.55 + 0.45 * (n1*0.6 + band*0.4)) * (0.6 + 0.4*vignette);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');

    var mat = new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false });
    var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(quad);

    /* ---- lifecycle ---- */
    var running = false;
    var pageVisible = !document.hidden;
    var clock = new THREE.Clock();

    function render() {
      uniforms.uScroll.value = ScrollState.progress;
      renderer.render(scene, camera);
    }
    function frame() {
      if (!running) return;
      if (!pageVisible) { running = false; return; }
      uniforms.uTime.value = clock.getElapsedTime();
      render();
      requestAnimationFrame(frame);
    }
    function start() {
      if (REDUCED) { renderStatic(); return; }
      if (running || !pageVisible) return;
      running = true;
      requestAnimationFrame(frame);
    }
    function renderStatic() {
      uniforms.uTime.value = 6.0; // pleasant fixed phase
      render();
      layer.classList.add('is-ready');
    }

    document.addEventListener('visibilitychange', function () {
      pageVisible = !document.hidden;
      if (pageVisible && !REDUCED) start();
    });

    var resizeRAF = null;
    function onResize() {
      if (resizeRAF) return;
      resizeRAF = requestAnimationFrame(function () {
        resizeRAF = null;
        if (mqSmall.matches || mqCoarse.matches) { destroy(); return; }
        var d = size();
        uniforms.uRes.value.set(d.w, d.h);
        renderer.setSize(Math.round(d.w * RENDER_SCALE), Math.round(d.h * RENDER_SCALE), false);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        if (REDUCED) renderStatic();
      });
    }
    window.addEventListener('resize', onResize, { passive: true });

    function recolor() {
      var a = readAccents(THREE);
      uniforms.uColorA.value.copy(a.primary);
      uniforms.uColorB.value.copy(a.secondary);
      uniforms.uColorC.value.copy(a.accent);
      uniforms.uDark.value = isDark() ? 1.0 : 0.0;
      if (REDUCED) renderStatic();
    }
    var themeObs = new MutationObserver(recolor);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'data-theme'] });

    var destroyed = false;
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      try { themeObs.disconnect(); } catch (e) {}
      window.removeEventListener('resize', onResize);
      try { quad.geometry.dispose(); } catch (e) {}
      try { mat.dispose(); } catch (e) {}
      try { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } catch (e) {}
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }
    self.destroy = destroy;

    requestAnimationFrame(function () { layer.classList.add('is-ready'); });
    if (REDUCED) renderStatic(); else start();
  }

  /* ----------------------------------------------------------------------
     4. PER-SECTION ACCENT — soft metaball / contour glow shader, IO-gated.
        Only renders while its section is visible; pauses otherwise.
     --------------------------------------------------------------------- */
  function SectionFx(THREE, sectionId) {
    var section = document.getElementById(sectionId);
    if (!section) return;
    var self = this;

    // Ensure the section can host an absolutely-positioned layer.
    var cs = getComputedStyle(section);
    if (cs.position === 'static') section.style.position = 'relative';

    var layer = document.createElement('div');
    layer.className = 'tx-section-fx';
    layer.setAttribute('aria-hidden', 'true');
    section.insertBefore(layer, section.firstChild);

    function size() {
      return {
        w: Math.max(1, layer.clientWidth || section.clientWidth),
        h: Math.max(1, layer.clientHeight || section.clientHeight)
      };
    }
    var dim = size();

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
    } catch (e) {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      return;
    }
    var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    var RENDER_SCALE = 0.6; // section accents are blurry blobs — half-ish res fine
    renderer.setPixelRatio(1);
    renderer.setSize(Math.round(dim.w * RENDER_SCALE * DPR), Math.round(dim.h * RENDER_SCALE * DPR), false);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    layer.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    var accents = readAccents(THREE);
    var uniforms = {
      uTime:   { value: 0 },
      uRes:    { value: new THREE.Vector2(dim.w, dim.h) },
      uColorA: { value: accents.primary.clone() },
      uColorB: { value: accents.accent.clone() },
      uDark:   { value: isDark() ? 1.0 : 0.0 }
    };

    var vert = [
      'varying vec2 vUv;',
      'void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }'
    ].join('\n');

    // A few drifting soft metaballs -> contour glow. Very cheap (no loops > 3).
    var frag = [
      'precision mediump float;',
      'varying vec2 vUv;',
      'uniform float uTime;',
      'uniform vec2 uRes;',
      'uniform vec3 uColorA;',
      'uniform vec3 uColorB;',
      'uniform float uDark;',
      'float ball(vec2 uv, vec2 c, float r){ return r / (length(uv - c) + 0.001); }',
      'void main(){',
      '  vec2 uv = vUv;',
      '  uv.x *= uRes.x / max(uRes.y, 1.0);',
      '  float t = uTime * 0.25;',
      '  float ar = uRes.x / max(uRes.y, 1.0);',
      '  vec2 c1 = vec2(ar*0.30 + 0.15*sin(t),       0.65 + 0.12*cos(t*0.8));',
      '  vec2 c2 = vec2(ar*0.70 + 0.18*cos(t*0.7),   0.30 + 0.14*sin(t*1.1));',
      '  vec2 c3 = vec2(ar*0.50 + 0.20*sin(t*0.5),   0.50 + 0.10*cos(t*0.6));',
      '  float f = ball(uv,c1,0.16) + ball(uv,c2,0.14) + ball(uv,c3,0.12);',
      '  float field = smoothstep(0.9, 1.9, f);',
      '  float edge = smoothstep(0.9, 1.1, f) * (1.0 - smoothstep(1.1, 1.5, f));',
      '  vec3 col = mix(uColorA, uColorB, clamp(f*0.4, 0.0, 1.0));',
      '  float a = field * ((uDark > 0.5) ? 0.16 : 0.12) + edge * 0.10;',
      '  gl_FragColor = vec4(col, a);',
      '}'
    ].join('\n');

    var mat = new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthTest: false, depthWrite: false });
    var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(quad);

    /* ---- lifecycle: only render while section is on-screen ---- */
    var visible = false;
    var pageVisible = !document.hidden;
    var running = false;
    var clock = new THREE.Clock();

    function render() { renderer.render(scene, camera); }
    function frame() {
      if (!running) return;
      if (!visible || !pageVisible) { running = false; return; }
      uniforms.uTime.value = clock.getElapsedTime();
      render();
      requestAnimationFrame(frame);
    }
    function start() {
      if (REDUCED) { renderStatic(); return; }
      if (running || !visible || !pageVisible) return;
      running = true;
      requestAnimationFrame(frame);
    }
    function renderStatic() {
      uniforms.uTime.value = 3.0;
      render();
      layer.classList.add('is-ready');
    }

    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) {
        layer.classList.add('is-ready');
        if (!REDUCED) start();
        else renderStatic();
      }
    }, { threshold: 0.01 });
    io.observe(section);

    document.addEventListener('visibilitychange', function () {
      pageVisible = !document.hidden;
      if (pageVisible && visible && !REDUCED) start();
    });

    var resizeRAF = null;
    function onResize() {
      if (resizeRAF) return;
      resizeRAF = requestAnimationFrame(function () {
        resizeRAF = null;
        if (mqSmall.matches || mqCoarse.matches) { destroy(); return; }
        var d = size();
        uniforms.uRes.value.set(d.w, d.h);
        renderer.setSize(Math.round(d.w * RENDER_SCALE * DPR), Math.round(d.h * RENDER_SCALE * DPR), false);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        if (REDUCED && visible) renderStatic();
      });
    }
    window.addEventListener('resize', onResize, { passive: true });

    function recolor() {
      var a = readAccents(THREE);
      uniforms.uColorA.value.copy(a.primary);
      uniforms.uColorB.value.copy(a.accent);
      uniforms.uDark.value = isDark() ? 1.0 : 0.0;
      if (REDUCED && visible) renderStatic();
    }
    var themeObs = new MutationObserver(recolor);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'data-theme'] });

    var destroyed = false;
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      try { io.disconnect(); } catch (e) {}
      try { themeObs.disconnect(); } catch (e) {}
      window.removeEventListener('resize', onResize);
      try { quad.geometry.dispose(); } catch (e) {}
      try { mat.dispose(); } catch (e) {}
      try { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } catch (e) {}
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }
    self.destroy = destroy;
  }
})();
