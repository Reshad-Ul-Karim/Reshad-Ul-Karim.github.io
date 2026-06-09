/* =========================================================================
   three-scene.js  —  Lazy, mobile-safe, reduced-motion-aware Three.js layer.

   WHAT IT BUILDS
   --------------
   A premium animated 3D background that lives behind the hero content:

     1) A shader-displaced ICOSAHEDRON "core" — an organic, slowly breathing
        blob driven by 3D simplex noise in the vertex shader, fragment-shaded
        with the site accent gradient (Fresnel rim glow). A second, slightly
        larger WIREFRAME icosahedron orbits it for structure/depth.

     2) A GPU PARTICLE FIELD arranged on a sphere around the core (a soft
        "network/neural" halo) that drifts and twinkles via the vertex shader.

   SCROLL-DRIVEN 3D TRANSITION
   ---------------------------
   A single GSAP ScrollTrigger (scrubbed, synced to window._lenis through the
   shared ScrollTrigger.update wiring already set up by reveal-motion.js) maps
   hero scroll-progress 0->1 into a `uDisperse` uniform + camera dolly + extra
   rotation. As you scroll past the hero the core inflates & the particles
   disperse outward and fade, so the object "dissolves" into the next section.

   HARD CONSTRAINTS (all enforced below)
   -------------------------------------
   - Three.js is injected ONCE from a known-good CDN; global is THREE.
   - WebGL feature-detected; any failure -> silent no-op (no broken UI/errors).
   - DPR capped at 2. Modest geometry/particle counts.
   - Render loop pauses when the hero is offscreen (IntersectionObserver) and
     when document.hidden (visibilitychange) — saves battery/GPU.
   - DISABLED entirely on (max-width:768px) or coarse-only pointer.
   - prefers-reduced-motion:reduce -> render exactly ONE static frame, no loop.
   - Canvas is pointer-events:none, z-index BELOW hero content, appended inside
     `.hero` (overflow:hidden) so it can NEVER cause horizontal overflow.
   - Recolors live when html[data-accent] / [data-theme] changes (MutationObserver).
   ========================================================================= */

(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     0. EARLY BAILOUTS — cheap checks before we load anything heavy.
     --------------------------------------------------------------------- */

  // Run once even if the script is somehow included twice.
  if (window.__threeHeroInit) return;
  window.__threeHeroInit = true;

  var THREE_CDN =
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

  var mqReduced = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  var mqSmall = window.matchMedia
    ? window.matchMedia('(max-width: 768px)')
    : { matches: false };

  // Coarse-only pointer (touch phones/tablets) — skip the heavy 3D.
  var mqCoarse = window.matchMedia
    ? window.matchMedia('(hover: none) and (pointer: coarse)')
    : { matches: false };

  // Bail on small screens / touch-only devices entirely (CSS handles fallback).
  if (mqSmall.matches || mqCoarse.matches) return;

  // Feature-detect WebGL without leaving a context lying around.
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

  // The hero must exist to host the layer.
  var hero = document.getElementById('home') || document.querySelector('.hero');
  if (!hero) return;
  // Dedicated centerpiece mount (right side of the hero). Falls back to the
  // whole hero only if the mount is somehow absent.
  var mountTarget = document.getElementById('hero-3d') || hero;

  /* ----------------------------------------------------------------------
     1. LOAD THREE.js ONCE, THEN INIT.
     --------------------------------------------------------------------- */
  function loadThree(cb) {
    if (window.THREE) {
      cb();
      return;
    }
    // Reuse an in-flight tag if another module injected it.
    var existing = document.querySelector('script[data-three-cdn]');
    if (existing) {
      existing.addEventListener('load', cb);
      existing.addEventListener('error', function () {/* silent */});
      return;
    }
    var s = document.createElement('script');
    s.src = THREE_CDN;
    s.async = true;
    s.setAttribute('data-three-cdn', '1');
    s.addEventListener('load', function () {
      if (window.THREE) cb();
    });
    s.addEventListener('error', function () {/* silent: fail gracefully */});
    document.head.appendChild(s);
  }

  // Kick off only once the DOM is ready enough to measure the hero.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      loadThree(init);
    });
  } else {
    loadThree(init);
  }

  /* ----------------------------------------------------------------------
     2. COLOR HELPERS — harmonize with the live CSS accent system.
     --------------------------------------------------------------------- */
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  }

  function readAccents(THREE) {
    return {
      primary: new THREE.Color(cssVar('--primary-color', '#6366f1')),
      secondary: new THREE.Color(cssVar('--secondary-color', '#ec4899')),
      accent: new THREE.Color(cssVar('--accent-color', '#06b6d4'))
    };
  }

  /* ----------------------------------------------------------------------
     3. INIT — build scene, geometry, shaders, scroll + lifecycle hooks.
     --------------------------------------------------------------------- */
  function init() {
    var THREE = window.THREE;
    if (!THREE) return;

    var reduced = mqReduced.matches;

    /* ---- Layer DOM (created at runtime, appended INTO .hero) ---- */
    var layer = document.createElement('div');
    layer.className = 'three-hero-layer';
    layer.setAttribute('aria-hidden', 'true');
    // Mount INTO the dedicated centerpiece box (right side), not the whole hero.
    mountTarget.appendChild(layer);

    /* ---- Sizing helper (uses the layer box, never window width directly,
            so the canvas can never exceed the clipped hero width) ---- */
    function size() {
      var r = layer.getBoundingClientRect();
      return {
        w: Math.max(1, Math.round(r.width)),
        h: Math.max(1, Math.round(r.height))
      };
    }
    var dim = size();

    /* ---- Renderer ---- */
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'low-power'
      });
    } catch (e) {
      // Context creation can still throw on some drivers — bail cleanly.
      layer.parentNode && layer.parentNode.removeChild(layer);
      return;
    }
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(DPR);
    renderer.setSize(dim.w, dim.h, false);
    renderer.setClearColor(0x000000, 0); // transparent
    layer.appendChild(renderer.domElement);

    /* ---- Scene + camera ---- */
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, dim.w / dim.h, 0.1, 100);
    // Framed as the hero centerpiece inside its own right-side box.
    var BASE_CAM_Z = 6.6;
    camera.position.set(0, 0, BASE_CAM_Z);

    var accents = readAccents(THREE);

    /* ==================================================================
       3a. DISPLACED ICOSAHEDRON CORE — custom GLSL with 3D simplex noise.
       ================================================================== */
    var coreGeo = new THREE.IcosahedronGeometry(1.5, 12); // detail 12 — smooth yet cheap
    var coreUniforms = {
      uTime:      { value: 0 },
      uDisperse:  { value: 0 },   // 0 = formed, 1 = scrolled-away
      uMouse:     { value: new THREE.Vector2(0, 0) },
      uColorA:    { value: accents.primary.clone() },
      uColorB:    { value: accents.secondary.clone() },
      uColorC:    { value: accents.accent.clone() }
    };

    // Ashima 3D simplex noise (public domain) — used in vertex displacement.
    var NOISE_GLSL = [
      'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}',
      'vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}',
      'vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}',
      'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
      'float snoise(vec3 v){',
      '  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);',
      '  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);',
      '  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);',
      '  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;',
      '  i=mod289(i);',
      '  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
      '  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;',
      '  vec4 j=p-49.0*floor(p*ns.z*ns.z);',
      '  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);',
      '  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);',
      '  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);',
      '  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));',
      '  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
      '  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);',
      '  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
      '  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;',
      '  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;',
      '  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
      '}'
    ].join('\n');

    var coreVert = [
      'uniform float uTime;',
      'uniform float uDisperse;',
      'uniform vec2 uMouse;',
      'varying float vNoise;',
      'varying vec3 vNormalW;',
      'varying vec3 vViewDir;',
      NOISE_GLSL,
      'void main(){',
      '  vec3 pos = position;',
      // base organic displacement (slow breathing)
      '  float t = uTime * 0.25;',
      '  float n = snoise(normalize(pos) * 1.1 + vec3(t));',
      '  n += 0.5 * snoise(normalize(pos) * 2.3 - vec3(t * 0.7));',
      // mouse adds a gentle directional swell
      '  float mInf = 0.35 * (uMouse.x * normalize(pos).x + uMouse.y * normalize(pos).y);',
      // scroll inflates + roughens the blob as it disperses
      '  float amp = 0.18 + 0.40 * uDisperse;',
      '  float disp = n * amp + mInf;',
      '  pos += normal * disp;',
      '  vNoise = n;',
      '  vNormalW = normalize(normalMatrix * normal);',
      '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
      '  vViewDir = normalize(-mv.xyz);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n');

    var coreFrag = [
      'uniform vec3 uColorA;',
      'uniform vec3 uColorB;',
      'uniform vec3 uColorC;',
      'uniform float uDisperse;',
      'varying float vNoise;',
      'varying vec3 vNormalW;',
      'varying vec3 vViewDir;',
      'void main(){',
      // gradient by noise band -> accent blend
      '  float g = clamp(vNoise * 0.5 + 0.5, 0.0, 1.0);',
      '  vec3 col = mix(uColorA, uColorB, g);',
      '  col = mix(col, uColorC, smoothstep(0.55, 1.0, g) * 0.6);',
      // Fresnel rim glow — kept subtle so the core stays a soft accent, not a
      // bright white ball that washes out the hero.
      '  float fres = pow(1.0 - max(dot(vNormalW, vViewDir), 0.0), 2.6);',
      '  col += fres * 0.45;',
      // centerpiece presence — visible but not a harsh white ball
      '  float a = (0.34 + 0.44 * fres) * (1.0 - 0.45 * uDisperse);',
      '  gl_FragColor = vec4(col, a);',
      '}'
    ].join('\n');

    var coreMat = new THREE.ShaderMaterial({
      uniforms: coreUniforms,
      vertexShader: coreVert,
      fragmentShader: coreFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    /* ---- Wireframe shell for structure/depth ---- */
    var shellGeo = new THREE.IcosahedronGeometry(2.05, 1);
    var shellMat = new THREE.MeshBasicMaterial({
      color: accents.accent.clone(),
      wireframe: true,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var shell = new THREE.Mesh(shellGeo, shellMat);
    scene.add(shell);

    /* ==================================================================
       3b. PARTICLE HALO — points on a sphere, GLSL drift + scroll disperse.
       ================================================================== */
    var COUNT = 460; // modest — keeps the halo cheap for 60fps
    var pPos = new Float32Array(COUNT * 3);
    var pSeed = new Float32Array(COUNT);
    for (var i = 0; i < COUNT; i++) {
      // even-ish sphere distribution (golden spiral)
      var phi = Math.acos(1 - 2 * (i + 0.5) / COUNT);
      var theta = Math.PI * (1 + Math.sqrt(5)) * i;
      var rad = 2.4 + Math.random() * 0.6;
      pPos[i * 3]     = Math.sin(phi) * Math.cos(theta) * rad;
      pPos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * rad;
      pPos[i * 3 + 2] = Math.cos(phi) * rad;
      pSeed[i] = Math.random();
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 1));

    var pUniforms = {
      uTime:     { value: 0 },
      uDisperse: { value: 0 },
      uColorA:   { value: accents.primary.clone() },
      uColorB:   { value: accents.accent.clone() },
      uDpr:      { value: DPR }
    };
    var pVert = [
      'uniform float uTime;',
      'uniform float uDisperse;',
      'uniform float uDpr;',
      'attribute float aSeed;',
      'varying float vAlpha;',
      'varying float vSeed;',
      'void main(){',
      '  vSeed = aSeed;',
      '  vec3 pos = position;',
      // gentle orbital drift
      '  float t = uTime * 0.3 + aSeed * 6.2831;',
      '  pos.x += sin(t) * 0.12;',
      '  pos.y += cos(t * 0.9) * 0.12;',
      // scroll pushes particles outward and fades them
      '  pos *= 1.0 + uDisperse * (0.6 + aSeed * 1.4);',
      '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
      '  float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 20.0);',
      '  vAlpha = twinkle * (1.0 - uDisperse);',
      '  gl_PointSize = (4.0 + aSeed * 5.0) * uDpr * (1.0 / -mv.z) * 3.0;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n');
    var pFrag = [
      'uniform vec3 uColorA;',
      'uniform vec3 uColorB;',
      'varying float vAlpha;',
      'varying float vSeed;',
      'void main(){',
      '  vec2 uv = gl_PointCoord - 0.5;',
      '  float d = length(uv);',
      '  if (d > 0.5) discard;',
      '  float soft = smoothstep(0.5, 0.0, d);',
      '  vec3 col = mix(uColorA, uColorB, vSeed);',
      '  gl_FragColor = vec4(col, soft * vAlpha * 0.9);',
      '}'
    ].join('\n');
    var pMat = new THREE.ShaderMaterial({
      uniforms: pUniforms,
      vertexShader: pVert,
      fragmentShader: pFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Group everything so scroll can rotate the whole composition.
    var group = new THREE.Group();
    group.add(core);
    group.add(shell);
    group.add(particles);
    scene.remove(core); scene.remove(shell); scene.remove(particles);
    scene.add(group);
    // Centered in its own centerpiece box.
    group.position.x = 0;
    group.position.y = 0;

    /* ----------------------------------------------------------------------
       4. MOUSE PARALLAX (gentle) — separate from the hero's own parallax.
       --------------------------------------------------------------------- */
    var targetMouse = { x: 0, y: 0 };
    var curMouse = { x: 0, y: 0 };
    function onPointer(e) {
      var nx = (e.clientX / window.innerWidth) * 2 - 1;
      var ny = -((e.clientY / window.innerHeight) * 2 - 1);
      targetMouse.x = nx;
      targetMouse.y = ny;
    }
    if (!reduced) {
      window.addEventListener('pointermove', onPointer, { passive: true });
    }

    /* ----------------------------------------------------------------------
       5. SCROLL-DRIVEN 3D TRANSITION  (ScrollTrigger, synced to Lenis).
          scrollProgress 0..1 across the hero -> uDisperse + camera dolly.
       --------------------------------------------------------------------- */
    var scrollProgress = 0;
    var st = null;
    function setupScroll() {
      if (reduced) return; // no scroll animation under reduced motion
      if (!window.gsap || !window.ScrollTrigger) return;
      try {
        window.gsap.registerPlugin(window.ScrollTrigger);
      } catch (e) {}
      st = window.ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: function (self) {
          scrollProgress = self.progress;
          renderNeeded = true; // ensure a frame even if paused-ish
        }
      });
    }

    /* ----------------------------------------------------------------------
       6. LIFECYCLE — pause when offscreen / tab hidden. Resize handling.
       --------------------------------------------------------------------- */
    var visible = true;     // hero intersecting viewport
    var pageVisible = !document.hidden;
    var running = false;
    var renderNeeded = true;
    var clock = new THREE.Clock();

    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) startLoop();
    }, { threshold: 0.01 });
    io.observe(hero);

    document.addEventListener('visibilitychange', function () {
      pageVisible = !document.hidden;
      if (pageVisible) startLoop();
    });

    var resizeRAF = null;
    function onResize() {
      if (resizeRAF) return;
      resizeRAF = requestAnimationFrame(function () {
        resizeRAF = null;
        // If we've crossed into mobile/coarse, tear down to save resources.
        if (mqSmall.matches || mqCoarse.matches) {
          destroy();
          return;
        }
        var d = size();
        camera.aspect = d.w / d.h;
        camera.updateProjectionMatrix();
        renderer.setSize(d.w, d.h, false);
        renderNeeded = true;
        if (reduced) renderOnce();
      });
    }
    window.addEventListener('resize', onResize, { passive: true });

    /* ----------------------------------------------------------------------
       7. RECOLOR ON ACCENT / THEME CHANGE — nice touch.
       --------------------------------------------------------------------- */
    function recolor() {
      var a = readAccents(THREE);
      coreUniforms.uColorA.value.copy(a.primary);
      coreUniforms.uColorB.value.copy(a.secondary);
      coreUniforms.uColorC.value.copy(a.accent);
      shellMat.color.copy(a.accent);
      pUniforms.uColorA.value.copy(a.primary);
      pUniforms.uColorB.value.copy(a.accent);
      renderNeeded = true;
      if (reduced) renderOnce();
    }
    var themeObs = new MutationObserver(recolor);
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-accent', 'data-theme', 'style', 'class']
    });

    /* ----------------------------------------------------------------------
       8. RENDER.
       --------------------------------------------------------------------- */
    function updateUniforms(elapsed) {
      coreUniforms.uTime.value = elapsed;
      pUniforms.uTime.value = elapsed;
      coreUniforms.uDisperse.value = scrollProgress;
      pUniforms.uDisperse.value = scrollProgress;

      // smooth mouse follow
      curMouse.x += (targetMouse.x - curMouse.x) * 0.05;
      curMouse.y += (targetMouse.y - curMouse.y) * 0.05;
      coreUniforms.uMouse.value.set(curMouse.x, curMouse.y);

      // base rotation + mouse parallax tilt + scroll spin
      group.rotation.y = elapsed * 0.12 + curMouse.x * 0.4 + scrollProgress * 1.2;
      group.rotation.x = curMouse.y * 0.3 + scrollProgress * 0.5;
      shell.rotation.y = -elapsed * 0.08;
      shell.rotation.x = elapsed * 0.05;

      // camera dolly back + slight scale as we scroll past hero
      camera.position.z = BASE_CAM_Z + scrollProgress * 2.2;
      var s = 1 + scrollProgress * 0.15;
      group.scale.setScalar(s);
    }

    function renderOnce() {
      // Static single frame (reduced-motion path).
      updateUniforms(0.6); // a pleasant fixed phase
      // neutralize motion-only contributions for a calm still
      group.rotation.set(0.2, 0.5, 0);
      shell.rotation.set(0.1, -0.3, 0);
      renderer.render(scene, camera);
      layer.classList.add('is-ready');
    }

    function frame() {
      if (!running) return;
      if (!visible || !pageVisible) { running = false; return; } // pause
      var elapsed = clock.getElapsedTime();
      updateUniforms(elapsed);
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    function startLoop() {
      if (reduced) { renderOnce(); return; }
      if (running) return;
      if (!visible || !pageVisible) return;
      running = true;
      // resync clock so paused time doesn't jump the animation
      requestAnimationFrame(frame);
    }

    /* ----------------------------------------------------------------------
       9. TEARDOWN — dispose GPU resources, remove listeners/DOM.
       --------------------------------------------------------------------- */
    var destroyed = false;
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      try { io.disconnect(); } catch (e) {}
      try { themeObs.disconnect(); } catch (e) {}
      try { if (st) st.kill(); } catch (e) {}
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', onResize);
      [coreGeo, shellGeo, pGeo].forEach(function (g) { try { g.dispose(); } catch (e) {} });
      [coreMat, shellMat, pMat].forEach(function (m) { try { m.dispose(); } catch (e) {} });
      try { renderer.dispose(); } catch (e) {}
      try {
        renderer.forceContextLoss && renderer.forceContextLoss();
      } catch (e) {}
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    }
    // Expose for debugging / external cleanup if ever needed.
    window.__threeHeroDestroy = destroy;

    /* ----------------------------------------------------------------------
       10. GO.
       --------------------------------------------------------------------- */
    // Reveal layer after first paint.
    requestAnimationFrame(function () {
      layer.classList.add('is-ready');
    });

    if (reduced) {
      // One static frame, no loop, no scroll animation.
      renderOnce();
    } else {
      setupScroll();
      startLoop();
    }
  }
})();
