/* =========================================================================
   section-three.js  —  Distinct, lightweight Three.js accents per section.

   GOAL
   ----
   Give each major section its own small 3D motif (a torus-knot for About, a
   DNA helix for Research, a point-globe for Contact, etc.) that lives as a
   subtle background accent behind the section content.

   PERFORMANCE MODEL (this is the whole point)
   -------------------------------------------
   - Each section's renderer is created LAZILY the first time it nears the
     viewport (generous IntersectionObserver rootMargin), never up front.
   - A SINGLE master rAF loop drives every live instance, and only renders the
     ones currently intersecting the viewport. Offscreen sections cost nothing.
   - The whole loop sleeps while the tab is hidden (visibilitychange).
   - Motifs use cheap MeshBasic wireframes / Points + additive blending — no
     per-section shader compiles, low vertex counts, DPR capped.
   - Disabled on (max-width:768px) and coarse-only pointers; CSS gradient
     fallback fills the slot. prefers-reduced-motion -> one static frame.
   - Recolors live when the accent / theme changes (MutationObserver), exactly
     like the hero layer, so all 3D stays harmonized with the site palette.
   ========================================================================= */

(function () {
  'use strict';

  if (window.__sectionThreeInit) return;
  window.__sectionThreeInit = true;

  var THREE_CDN =
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

  var mq = function (q) {
    return window.matchMedia ? window.matchMedia(q) : { matches: false };
  };
  var mqReduced = mq('(prefers-reduced-motion: reduce)');
  var mqSmall = mq('(max-width: 768px)');
  var mqCoarse = mq('(hover: none) and (pointer: coarse)');

  // Mobile / touch devices still render the accents, at a lighter quality tier
  // (lower DPR cap). We do NOT bail.
  var isMobile = mqSmall.matches || mqCoarse.matches;

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

  /* ---- Which section gets which motif. `side` offsets the object so it sits
          to one edge and never fights the text for readability. ------------ */
  var SECTIONS = [
    { id: 'about',      kind: 'torusKnot', side:  1 },
    { id: 'experience', kind: 'stream',    side: -1 },
    { id: 'research',   kind: 'helix',     side:  1 },
    { id: 'projects',   kind: 'crystals',  side: -1 },
    { id: 'awards',     kind: 'octahedron',side:  1 },
    { id: 'cultural',   kind: 'wave',      side: -1 },
    { id: 'contact',    kind: 'globe',     side:  1 }
  ];

  /* ----------------------------------------------------------------------
     Load Three.js once (reuse the hero's tag if present), then build.
     --------------------------------------------------------------------- */
  function loadThree(cb) {
    if (window.THREE) { cb(); return; }
    var existing = document.querySelector('script[data-three-cdn]');
    if (existing) {
      existing.addEventListener('load', function () { if (window.THREE) cb(); });
      existing.addEventListener('error', function () {});
      return;
    }
    var s = document.createElement('script');
    s.src = THREE_CDN;
    s.async = true;
    s.setAttribute('data-three-cdn', '1');
    s.addEventListener('load', function () { if (window.THREE) cb(); });
    s.addEventListener('error', function () {});
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { loadThree(start); });
  } else {
    loadThree(start);
  }

  /* ----------------------------------------------------------------------
     Color helpers — harmonize with the live CSS accent system.
     --------------------------------------------------------------------- */
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
    return v || fallback;
  }
  function readAccents(THREE) {
    return {
      primary: new THREE.Color(cssVar('--primary-color', '#6366f1')),
      secondary: new THREE.Color(cssVar('--secondary-color', '#ec4899')),
      accent: new THREE.Color(cssVar('--accent-color', '#06b6d4'))
    };
  }

  /* ======================================================================
     MOTIF BUILDERS — each returns { group, update(t) }.
     Kept intentionally cheap: wireframes & Points, additive blending.
     ====================================================================== */
  var Motifs = {
    /* About — an organic wireframe torus knot, slowly tumbling. */
    torusKnot: function (THREE, a) {
      var g = new THREE.Group();
      var geo = new THREE.TorusKnotGeometry(1.15, 0.34, 120, 14);
      var mat = new THREE.MeshBasicMaterial({
        color: a.primary.clone(), wireframe: true, transparent: true,
        opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false
      });
      var knot = new THREE.Mesh(geo, mat);
      g.add(knot);
      var glowGeo = new THREE.IcosahedronGeometry(0.55, 1);
      var glowMat = new THREE.MeshBasicMaterial({
        color: a.secondary.clone(), wireframe: true, transparent: true,
        opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false
      });
      g.add(new THREE.Mesh(glowGeo, glowMat));
      g._mats = [mat, glowMat];
      g._geos = [geo, glowGeo];
      return {
        group: g,
        recolor: function (c) { mat.color.copy(c.primary); glowMat.color.copy(c.secondary); },
        update: function (t) {
          knot.rotation.x = t * 0.18;
          knot.rotation.y = t * 0.26;
          g.children[1].rotation.y = -t * 0.4;
        }
      };
    },

    /* Experience — a flowing ribbon of particles (a "timeline stream"). */
    stream: function (THREE, a) {
      var g = new THREE.Group();
      var N = 340;
      var pos = new Float32Array(N * 3);
      var seed = new Float32Array(N);
      for (var i = 0; i < N; i++) {
        var u = i / N;
        pos[i * 3]     = (u - 0.5) * 7.0;
        pos[i * 3 + 1] = Math.sin(u * Math.PI * 4) * 0.9;
        pos[i * 3 + 2] = Math.cos(u * Math.PI * 3) * 0.9;
        seed[i] = Math.random();
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var mat = new THREE.PointsMaterial({
        color: a.accent.clone(), size: 0.09, transparent: true,
        opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
        sizeAttenuation: true
      });
      var pts = new THREE.Points(geo, mat);
      g.add(pts);
      g._mats = [mat]; g._geos = [geo];
      return {
        group: g,
        recolor: function (c) { mat.color.copy(c.accent); },
        update: function (t) {
          var p = geo.attributes.position.array;
          for (var i = 0; i < N; i++) {
            var u = i / N;
            p[i * 3 + 1] = Math.sin(u * Math.PI * 4 + t * 1.2) * 0.9;
            p[i * 3 + 2] = Math.cos(u * Math.PI * 3 + t * 0.9) * 0.9;
          }
          geo.attributes.position.needsUpdate = true;
          g.rotation.y = Math.sin(t * 0.15) * 0.25;
        }
      };
    },

    /* Research — a DNA double helix (two point strands + connecting rungs). */
    helix: function (THREE, a) {
      var g = new THREE.Group();
      var turns = 3.2, perTurn = 26, N = Math.floor(turns * perTurn);
      var H = 5.4, R = 1.05;
      var sA = new Float32Array(N * 3), sB = new Float32Array(N * 3);
      var rung = [];
      for (var i = 0; i < N; i++) {
        var ang = (i / perTurn) * Math.PI * 2;
        var y = (i / (N - 1) - 0.5) * H;
        sA[i * 3] = Math.cos(ang) * R;     sA[i * 3 + 1] = y; sA[i * 3 + 2] = Math.sin(ang) * R;
        sB[i * 3] = Math.cos(ang + Math.PI) * R; sB[i * 3 + 1] = y; sB[i * 3 + 2] = Math.sin(ang + Math.PI) * R;
        if (i % 2 === 0) {
          rung.push(sA[i * 3], sA[i * 3 + 1], sA[i * 3 + 2], sB[i * 3], sB[i * 3 + 1], sB[i * 3 + 2]);
        }
      }
      function strand(arr, col) {
        var ge = new THREE.BufferGeometry();
        ge.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        var m = new THREE.PointsMaterial({
          color: col.clone(), size: 0.16, transparent: true, opacity: 0.9,
          blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
        });
        g.add(new THREE.Points(ge, m));
        return { ge: ge, m: m };
      }
      var a1 = strand(sA, a.primary), a2 = strand(sB, a.secondary);
      var rge = new THREE.BufferGeometry();
      rge.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rung), 3));
      var rmat = new THREE.LineBasicMaterial({
        color: a.accent.clone(), transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      g.add(new THREE.LineSegments(rge, rmat));
      g._mats = [a1.m, a2.m, rmat]; g._geos = [a1.ge, a2.ge, rge];
      return {
        group: g,
        recolor: function (c) { a1.m.color.copy(c.primary); a2.m.color.copy(c.secondary); rmat.color.copy(c.accent); },
        update: function (t) { g.rotation.y = t * 0.4; }
      };
    },

    /* Projects — a small constellation of low-poly wireframe crystals. */
    crystals: function (THREE, a) {
      var g = new THREE.Group();
      var defs = [
        { r: 1.0, x: -1.6, y: 0.6, z: 0, c: a.primary },
        { r: 0.7, x: 1.4, y: -0.4, z: -0.5, c: a.secondary },
        { r: 0.55, x: 0.4, y: 1.1, z: 0.4, c: a.accent },
        { r: 0.8, x: 0.2, y: -1.2, z: 0.2, c: a.primary },
        { r: 0.45, x: 1.9, y: 0.9, z: -0.3, c: a.accent }
      ];
      var mats = [], geos = [], meshes = [];
      defs.forEach(function (d, i) {
        var ge = new THREE.IcosahedronGeometry(d.r, 0);
        var m = new THREE.MeshBasicMaterial({
          color: d.c.clone(), wireframe: true, transparent: true,
          opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false
        });
        var mesh = new THREE.Mesh(ge, m);
        mesh.position.set(d.x, d.y, d.z);
        mesh._spin = 0.1 + i * 0.05;
        g.add(mesh); mats.push(m); geos.push(ge); meshes.push(mesh);
      });
      g._mats = mats; g._geos = geos;
      return {
        group: g,
        recolor: function (c) {
          var cols = [c.primary, c.secondary, c.accent, c.primary, c.accent];
          mats.forEach(function (m, i) { m.color.copy(cols[i]); });
        },
        update: function (t) {
          meshes.forEach(function (m) {
            m.rotation.x = t * m._spin; m.rotation.y = t * m._spin * 1.3;
          });
          g.rotation.y = Math.sin(t * 0.12) * 0.3;
        }
      };
    },

    /* Awards — a faceted octahedron "trophy crystal" with an orbiting ring. */
    octahedron: function (THREE, a) {
      var g = new THREE.Group();
      var geo = new THREE.OctahedronGeometry(1.5, 0);
      var mat = new THREE.MeshBasicMaterial({
        color: a.secondary.clone(), wireframe: true, transparent: true,
        opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false
      });
      var oct = new THREE.Mesh(geo, mat);
      g.add(oct);
      var ringGeo = new THREE.TorusGeometry(2.1, 0.02, 8, 80);
      var ringMat = new THREE.MeshBasicMaterial({
        color: a.accent.clone(), transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      var ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.4;
      g.add(ring);
      g._mats = [mat, ringMat]; g._geos = [geo, ringGeo];
      return {
        group: g,
        recolor: function (c) { mat.color.copy(c.secondary); ringMat.color.copy(c.accent); },
        update: function (t) {
          oct.rotation.y = t * 0.5; oct.rotation.x = Math.sin(t * 0.4) * 0.3;
          ring.rotation.z = t * 0.3;
        }
      };
    },

    /* Cultural — an undulating grid of points (a calm "soundwave" field). */
    wave: function (THREE, a) {
      var g = new THREE.Group();
      var SX = 26, SY = 26, N = SX * SY;
      var pos = new Float32Array(N * 3);
      var base = new Float32Array(N * 2);
      var k = 0;
      for (var x = 0; x < SX; x++) {
        for (var y = 0; y < SY; y++) {
          var px = (x / (SX - 1) - 0.5) * 6.4;
          var py = (y / (SY - 1) - 0.5) * 6.4;
          pos[k * 3] = px; pos[k * 3 + 1] = 0; pos[k * 3 + 2] = py;
          base[k * 2] = px; base[k * 2 + 1] = py;
          k++;
        }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var mat = new THREE.PointsMaterial({
        color: a.accent.clone(), size: 0.07, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
      });
      g.add(new THREE.Points(geo, mat));
      g.rotation.x = -0.9;
      g._mats = [mat]; g._geos = [geo];
      return {
        group: g,
        recolor: function (c) { mat.color.copy(c.accent); },
        update: function (t) {
          var p = geo.attributes.position.array;
          for (var i = 0; i < N; i++) {
            var bx = base[i * 2], by = base[i * 2 + 1];
            var d = Math.sqrt(bx * bx + by * by);
            p[i * 3 + 1] = Math.sin(d * 1.1 - t * 1.6) * 0.55;
          }
          geo.attributes.position.needsUpdate = true;
          g.rotation.z = Math.sin(t * 0.1) * 0.15;
        }
      };
    },

    /* Contact — a rotating globe of points (a "network/reach" sphere). */
    globe: function (THREE, a) {
      var g = new THREE.Group();
      var N = 520, R = 2.0;
      var pos = new Float32Array(N * 3);
      for (var i = 0; i < N; i++) {
        var phi = Math.acos(1 - 2 * (i + 0.5) / N);
        var th = Math.PI * (1 + Math.sqrt(5)) * i;
        pos[i * 3] = Math.sin(phi) * Math.cos(th) * R;
        pos[i * 3 + 1] = Math.sin(phi) * Math.sin(th) * R;
        pos[i * 3 + 2] = Math.cos(phi) * R;
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var mat = new THREE.PointsMaterial({
        color: a.primary.clone(), size: 0.07, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
      });
      g.add(new THREE.Points(geo, mat));
      var shellGeo = new THREE.IcosahedronGeometry(R * 1.02, 1);
      var shellMat = new THREE.MeshBasicMaterial({
        color: a.accent.clone(), wireframe: true, transparent: true,
        opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false
      });
      g.add(new THREE.Mesh(shellGeo, shellMat));
      g._mats = [mat, shellMat]; g._geos = [geo, shellGeo];
      return {
        group: g,
        recolor: function (c) { mat.color.copy(c.primary); shellMat.color.copy(c.accent); },
        update: function (t) { g.rotation.y = t * 0.18; g.rotation.x = Math.sin(t * 0.1) * 0.2; }
      };
    }
  };

  /* ======================================================================
     INSTANCE — one per section. Created lazily near-viewport.
     ====================================================================== */
  function makeInstance(THREE, cfg, mount) {
    var reduced = mqReduced.matches;
    var accents = readAccents(THREE);

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch (e) { return null; }
    var DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75);
    renderer.setPixelRatio(DPR);

    function size() {
      var r = mount.getBoundingClientRect();
      return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
    }
    var dim = size();
    renderer.setSize(dim.w, dim.h, false);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, dim.w / dim.h, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    var motif = Motifs[cfg.kind](THREE, accents);
    // Offset to one side so content stays readable; nudge toward viewer a touch.
    motif.group.position.x = cfg.side * 1.4;
    scene.add(motif.group);

    var inst = {
      cfg: cfg, mount: mount, renderer: renderer, scene: scene, camera: camera,
      motif: motif, visible: false, reduced: reduced, destroyed: false,
      recolor: function () {
        var a = readAccents(THREE);
        if (motif.recolor) motif.recolor(a);
      },
      resize: function () {
        var d = size();
        camera.aspect = d.w / d.h; camera.updateProjectionMatrix();
        renderer.setSize(d.w, d.h, false);
      },
      renderStatic: function () {
        if (motif.update) motif.update(0.8);
        renderer.render(scene, camera);
        mount.classList.add('is-ready');
      },
      destroy: function () {
        if (inst.destroyed) return;
        inst.destroyed = true;
        (motif.group._geos || []).forEach(function (g) { try { g.dispose(); } catch (e) {} });
        (motif.group._mats || []).forEach(function (m) { try { m.dispose(); } catch (e) {} });
        try { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } catch (e) {}
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
    requestAnimationFrame(function () { mount.classList.add('is-ready'); });
    return inst;
  }

  /* ======================================================================
     CONTROLLER — lazy create, single master loop, lifecycle.
     ====================================================================== */
  function start() {
    var THREE = window.THREE;
    if (!THREE) return;
    var reduced = mqReduced.matches;

    var instances = [];      // live instances (keyed off mount)
    var pageVisible = !document.hidden;
    var running = false;
    var clock = new THREE.Clock();

    // Build mount + register each present section.
    var pending = [];        // { cfg, section, mount, inst:null }
    SECTIONS.forEach(function (cfg) {
      var section = document.getElementById(cfg.id);
      if (!section) return;
      var mount = section.querySelector('.section-3d');
      if (!mount) {
        mount = document.createElement('div');
        mount.className = 'section-3d';
        mount.setAttribute('aria-hidden', 'true');
        // Insert as first child so it paints behind the content.
        section.insertBefore(mount, section.firstChild);
      }
      mount.classList.add(cfg.side > 0 ? 'section-3d--right' : 'section-3d--left');
      pending.push({ cfg: cfg, section: section, mount: mount, inst: null });
    });
    if (!pending.length) return;

    // Lazily create the renderer when a section gets close; flag visibility
    // so the master loop knows what to draw.
    var nearObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var rec = e.target.__rec;
        if (!rec) return;
        if (e.isIntersecting && !rec.inst) {
          rec.inst = makeInstance(THREE, rec.cfg, rec.mount);
          if (rec.inst) {
            instances.push(rec.inst);
            // Apply any visibility the view-observer already reported.
            rec.inst.visible = !!rec._wantVisible;
            if (reduced) { rec.inst.renderStatic(); }
            else { startLoop(); }
          }
        }
      });
    }, { rootMargin: '300px 0px 300px 0px', threshold: 0.01 });

    var viewObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var rec = e.target.__rec;
        if (!rec || !rec.inst) {
          // Mark intent; the near-observer will have created it shortly.
          if (rec) rec._wantVisible = e.isIntersecting;
          return;
        }
        rec.inst.visible = e.isIntersecting;
      });
      if (!reduced) startLoop();
    }, { threshold: 0.01 });

    pending.forEach(function (rec) {
      rec.mount.__rec = rec;
      nearObs.observe(rec.mount);
      viewObs.observe(rec.mount);
    });

    document.addEventListener('visibilitychange', function () {
      pageVisible = !document.hidden;
      if (pageVisible && !reduced) startLoop();
    });

    var resizeRAF = null;
    window.addEventListener('resize', function () {
      if (resizeRAF) return;
      resizeRAF = requestAnimationFrame(function () {
        resizeRAF = null;
        instances.forEach(function (i) { i.resize(); if (reduced) i.renderStatic(); });
      });
    }, { passive: true });

    // Recolor every live instance when the palette changes.
    var themeObs = new MutationObserver(function () {
      instances.forEach(function (i) { i.recolor(); if (reduced) i.renderStatic(); });
    });
    themeObs.observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-accent', 'data-theme', 'style', 'class']
    });

    function anyVisible() {
      for (var i = 0; i < instances.length; i++) {
        if (instances[i].visible && !instances[i].destroyed) return true;
      }
      return false;
    }

    function frame() {
      if (!running) return;
      if (!pageVisible || !anyVisible()) { running = false; return; }
      var t = clock.getElapsedTime();
      for (var i = 0; i < instances.length; i++) {
        var inst = instances[i];
        if (inst.visible && !inst.destroyed) {
          if (inst.motif.update) inst.motif.update(t);
          inst.renderer.render(inst.scene, inst.camera);
        }
      }
      requestAnimationFrame(frame);
    }

    function startLoop() {
      if (reduced || running || !pageVisible || !anyVisible()) return;
      running = true;
      requestAnimationFrame(frame);
    }
  }
})();
