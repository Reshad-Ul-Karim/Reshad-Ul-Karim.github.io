/* =========================================================================
   home-scene.js: page-wide real-time 3D for the homepage (one renderer).

   One fixed, viewport-sized, pointer-transparent canvas (.gl-canvas) sits
   above page content and below the nav, colour widget, theme toggle and chat.
   It draws only inside [data-gl] "windows": empty layout slots with a static
   fallback in the DOM. Each window owns a small scene and camera and is drawn
   with scissor + viewport bounds; the camera is fitted to the window's full
   size and clipped with setViewOffset, so a half-visible window never
   distorts (see threejs.org/manual "multiple scenes").

   Chapters share one material and motion vocabulary: a ceramic ribbon that
   frames the portrait (hero), opens into an arc (about), becomes small glazed
   forms (expertise), a rail with lit milestones (experience), a frame for the
   featured project and live media planes (projects), a prism (awards) and a
   small knot signature (footer).

   Rendering is on demand: frames run while scroll, pointer, focus, resize, a
   theme change or an easing value needs them, then stop. Hidden tabs pause.
   Colours come from the same switchers as the rest of the site: CSS tokens
   driven by html[data-accent] (accent-theme.js) and html[data-theme] (theme
   toggle). A change eases over 380 ms, or applies at once with reduced motion.

   Fallbacks: no WebGL 2, forced colours, Save-Data, a load failure or a lost
   context all leave the static DOM in place. Reduced motion keeps the 3D but
   holds every chapter in its settled pose.
   ========================================================================= */

const root = document.documentElement;
const canvasHost = document.querySelector('.gl-canvas');
const masthead = document.querySelector('[data-hero]');
const portraitImg = masthead && masthead.querySelector('.hero__portrait');

const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
const forcedMQ = window.matchMedia('(forced-colors: active)');

function shouldSkip() {
  if (!canvasHost || root.dataset.gl) return true; // initialise at most once
  if (forcedMQ.matches) return true;
  const conn = navigator.connection;
  return !!(conn && conn.saveData);
}

function whenIdle(fn) {
  const run = () => ('requestIdleCallback' in window
    ? window.requestIdleCallback(fn, { timeout: 1500 })
    : window.setTimeout(fn, 200));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

// The first-visit preloader (index.html) listens for these: 'gl:progress'
// (0..1) while windows are built and compiled, 'gl:primed' when the 3D is
// ready to show without stalls, or has given up and left the static DOM.
const announce = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));
const pause = () => new Promise((r) => setTimeout(r, 0)); // let input, CSS animations and the loader through

// Studio reflections: a low-resolution local copy of Poly Haven's
// "Studio Small 03" (CC0, Greg Zaal), fetched alongside the library.
const ENV_URL = new URL('./assets/env/studio_small_03_1k.jpg', import.meta.url).href;
function loadImage(url) {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(() => img);
}

if (!shouldSkip()) {
  root.dataset.gl = 'pending';
  const start = () => {
    Promise.all([import('./assets/vendor/three-home.min.js?v=186.1-2'), loadImage(ENV_URL).catch(() => null)])
      .then(([T, envImg]) => createEngine(T, envImg))
      .catch(() => { root.dataset.gl = 'failed'; announce('gl:primed'); });
  };
  // Behind the preloader there is nothing to compete with, so start as soon as
  // the preloader has painted (rAF runs before that paint, the timeout after).
  if (root.classList.contains('is-preloading')) requestAnimationFrame(() => setTimeout(start, 0));
  else whenIdle(start);
} else {
  announce('gl:primed');
}

/* ------------------------------------------------------------------------ */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const smooth = (t) => t * t * (3 - 2 * t);

async function createEngine(T, envImg) {
  const LITE = !fineMQ.matches || window.innerWidth < 768; // cheaper path for phones/tablets
  let reduced = reduceMQ.matches;

  /* ---- Renderer ---------------------------------------------------------- */
  let renderer;
  try {
    // At 1.5x+ density the canvas already supersamples, so MSAA would only add
    // ~4x colour memory. 'default' power keeps dual-GPU laptops off the discrete
    // GPU (no switch-over hitch, no battery drain) for a scene this light.
    renderer = new T.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 1.5, alpha: true, powerPreference: 'default' });
  } catch (e) {
    root.dataset.gl = 'unsupported';
    announce('gl:primed');
    return;
  }
  announce('gl:progress', 0.08);
  await pause();
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  // The error check reads shader logs on a program's first use: a synchronous
  // GPU round trip that waits for every queued compile (100-300 ms per chapter).
  renderer.debug.checkShaderErrors = false;
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true; // the hero glass is drawn as a back half and a front half
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  canvas.tabIndex = -1;
  canvasHost.appendChild(canvas);

  // The studio photo is the environment; RoomEnvironment is only the fallback
  // when it failed to load, so the page pays for one PMREM bake, not two.
  const pmrem = new T.PMREMGenerator(renderer);
  let envTex = null;
  function makeEnvironment() {
    if (envImg) {
      const t = new T.Texture(envImg);
      t.mapping = T.EquirectangularReflectionMapping;
      t.colorSpace = T.SRGBColorSpace;
      t.needsUpdate = true;
      const out = pmrem.fromEquirectangular(t).texture;
      t.dispose();
      return out;
    }
    const room = new T.RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    if (room.dispose) room.dispose();
    return rt.texture;
  }
  envTex = makeEnvironment();
  announce('gl:progress', 0.16);
  await pause();

  /* ---- Palette: CSS tokens -> eased colours ------------------------------- */
  const NAMES = ['hl', 'decor', 'primary', 'hero', 'glow', 'porcelain', 'glaze', 'frost', 'glass', 'key', 'sky', 'ground'];
  const cur = {}; const from = {}; const to = {};
  NAMES.forEach((n) => { cur[n] = new T.Color(); from[n] = new T.Color(); to[n] = new T.Color(); });
  let paletteT = 1;

  function readTargets(out) {
    const cs = getComputedStyle(root);
    const get = (n) => cs.getPropertyValue(n).trim();
    const dark = root.getAttribute('data-theme') === 'dark';
    out.hl.set(get('--hl') || '#8CF0D3');
    out.decor.set(get('--decor') || '#D8B98B');
    out.primary.set(get('--primary') || '#0B5D56');
    out.hero.set(get('--hero') || '#102525');
    out.glow.set('rgb(' + (get('--glow-rgb') || '48, 128, 116') + ')');
    out.porcelain.set(dark ? '#CFCBC2' : '#DCD7CD');
    if (dark) out.glaze.copy(out.hl).lerp(new T.Color('#16171A'), 0.18);
    else out.glaze.copy(out.primary);
    out.frost.set(dark ? '#2B3735' : '#FFFFFF').lerp(out.hl, dark ? 0.12 : 0.32);
    out.glass.set('#F4FBF8').lerp(out.hl, 0.22); // tinted with the accent chosen in the colour widget
    out.key.set('#FFFFFF').lerp(out.decor, 0.16);
    out.sky.set(dark ? '#6F7D7A' : '#FFFFFF');
    out.ground.copy(out.hero);
  }
  readTargets(cur);

  /* ---- Shared materials --------------------------------------------------- */
  const Mat = LITE ? T.MeshStandardMaterial : T.MeshPhysicalMaterial;
  const physical = (extra) => (LITE ? {} : extra);
  const porcelain = new Mat({
    color: cur.porcelain, roughness: 0.38, metalness: 0.02, envMap: envTex, envMapIntensity: 0.75,
    side: T.DoubleSide,
    ...physical({ clearcoat: 0.75, clearcoatRoughness: 0.16, sheen: 0.7, sheenRoughness: 0.45, sheenColor: cur.hl.clone() })
  });
  const glaze = new Mat({
    color: cur.glaze, roughness: 0.22, metalness: 0.06, envMap: envTex, envMapIntensity: 1.15,
    side: T.DoubleSide,
    ...physical({ clearcoat: 1.0, clearcoatRoughness: 0.08 })
  });
  const glazeFlat = new Mat({
    color: cur.glaze, roughness: 0.18, metalness: 0.08, envMap: envTex, envMapIntensity: 1.3, flatShading: true,
    ...physical({ clearcoat: 1.0, clearcoatRoughness: 0.05 })
  });
  const frost = new Mat({
    color: cur.frost, roughness: 0.12, metalness: 0, envMap: envTex, envMapIntensity: 0.9,
    transparent: true, opacity: 0.5, depthWrite: false, side: T.DoubleSide,
    ...physical({ clearcoat: 1.0, clearcoatRoughness: 0.1 })
  });
  // Glass for the hero frame: clearcoat + iridescence picks up the studio
  // reflections; the highlight comes from a light that follows cursor or tilt.
  const glassFront = new Mat({
    color: cur.glass, roughness: 0.06, metalness: 0, envMap: envTex, envMapIntensity: 1.7,
    transparent: true, opacity: 0.86, depthWrite: false, side: T.DoubleSide,
    clippingPlanes: [new T.Plane(new T.Vector3(0, 0, 1), 0)], // keep z >= 0 (in front of the portrait)
    ...physical({ clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.35, iridescenceIOR: 1.3, sheen: 0.4, sheenRoughness: 0.3, sheenColor: cur.hl.clone() })
  });
  const glassBack = glassFront.clone();
  glassBack.clippingPlanes = [new T.Plane(new T.Vector3(0, 0, -1), 0)]; // keep z <= 0 (behind it)
  const coreMat = new T.MeshBasicMaterial({ color: cur.hl, toneMapped: false });
  const coreDecorMat = new T.MeshBasicMaterial({ color: cur.decor, toneMapped: false });
  const MATERIALS = [porcelain, glaze, glazeFlat, frost, glassFront, glassBack, coreMat, coreDecorMat];

  // Images decode off the main thread where ImageBitmap options are reliable
  // (the same browser test GLTFLoader uses); elsewhere TextureLoader.
  const ua = navigator.userAgent;
  const safariV = /^((?!chrome|android).)*safari/i.test(ua) ? +((ua.match(/Version\/(\d+)/) || [])[1] || 0) : -1;
  const firefoxV = +((ua.match(/Firefox\/(\d+)/) || [])[1] || -1);
  const BITMAPS = typeof createImageBitmap === 'function' && !!T.Texture &&
    !(safariV >= 0 && safariV < 17) && !(firefoxV >= 0 && firefoxV < 98);
  function loadTexture(url, maxW, onLoad, onError) {
    if (!BITMAPS) return new T.TextureLoader().load(url, onLoad, undefined, onError);
    const tex = new T.Texture();
    tex.flipY = false; // flipped while decoding instead; WebGL ignores flipY for bitmaps
    fetch(url, { mode: 'cors', credentials: 'same-origin' })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); return res.blob(); })
      .then((blob) => createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none' }))
      .then((bmp) => {
        if (!maxW || bmp.width <= maxW) return bmp;
        const h = Math.round((bmp.height * maxW) / bmp.width);
        return createImageBitmap(bmp, { resizeWidth: maxW, resizeHeight: h, resizeQuality: 'high', premultiplyAlpha: 'none' })
          .then((small) => { bmp.close(); return small; });
      })
      .then((bmp) => { tex.image = bmp; tex.needsUpdate = true; onLoad(tex); })
      .catch(onError);
    return tex;
  }

  const lights = [];
  function addLights(scene) {
    const hemi = new T.HemisphereLight(cur.sky, cur.ground, 0.55);
    const key = new T.DirectionalLight(cur.key, 1.7);
    key.position.set(-0.8, 1.1, 1.3);
    const rim = new T.DirectionalLight(cur.hl, 1.5);
    rim.position.set(1.1, 0.35, -0.7);
    scene.add(hemi, key, rim);
    const set = { hemi, key, rim };
    lights.push(set);
    return set;
  }

  const shaderUniformSinks = []; // functions that push palette into shader uniforms

  function applyPalette() {
    porcelain.color.copy(cur.porcelain);
    [glassFront, glassBack].forEach((g) => { g.color.copy(cur.glass); if (g.sheenColor) g.sheenColor.copy(cur.hl); });
    if (porcelain.sheenColor) porcelain.sheenColor.copy(cur.hl);
    glaze.color.copy(cur.glaze);
    glazeFlat.color.copy(cur.glaze);
    frost.color.copy(cur.frost);
    coreMat.color.copy(cur.hl);
    coreDecorMat.color.copy(cur.decor);
    lights.forEach((l) => {
      l.hemi.color.copy(cur.sky); l.hemi.groundColor.copy(cur.ground);
      l.key.color.copy(cur.key); l.rim.color.copy(cur.hl);
    });
    shaderUniformSinks.forEach((fn) => fn());
  }

  function onThemeChange() {
    NAMES.forEach((n) => from[n].copy(cur[n]));
    readTargets(to);
    paletteT = reduced ? 1 : 0;
    if (reduced) { NAMES.forEach((n) => cur[n].copy(to[n])); applyPalette(); }
    requestRender();
  }
  const themeObserver = new MutationObserver(onThemeChange);
  themeObserver.observe(root, { attributes: true, attributeFilter: ['data-accent', 'data-theme'] });

  /* ---- Geometry helpers --------------------------------------------------- */
  // A ribbon: a flat, rounded cross-section swept along a curve with a twist.
  function ribbonGeometry(curve, o) {
    const segs = o.segments; const ring = o.ring || (LITE ? 8 : 10);
    const frames = curve.computeFrenetFrames(segs, !!o.closed);
    const P = new T.Vector3(); const n = new T.Vector3(); const b = new T.Vector3(); const v = new T.Vector3();
    const pos = new Float32Array((segs + 1) * ring * 3);
    let k = 0;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      curve.getPointAt(u, P);
      const N = frames.normals[i]; const B = frames.binormals[i];
      const a = o.twist ? o.twist(u) : 0;
      const ca = Math.cos(a); const sa = Math.sin(a);
      n.copy(N).multiplyScalar(ca).addScaledVector(B, sa);
      b.copy(B).multiplyScalar(ca).addScaledVector(N, -sa);
      const hw = (o.width * (o.widthAt ? o.widthAt(u) : 1)) / 2; const ht = o.thickness / 2;
      for (let j = 0; j < ring; j++) {
        const t = (j / ring) * Math.PI * 2; const c = Math.cos(t); const s = Math.sin(t);
        const ex = Math.sign(c) * Math.pow(Math.abs(c), 0.55); const ey = Math.sign(s) * Math.pow(Math.abs(s), 0.55);
        v.copy(P).addScaledVector(n, ex * hw).addScaledVector(b, ey * ht);
        pos[k++] = v.x; pos[k++] = v.y; pos[k++] = v.z;
      }
    }
    const idx = [];
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < ring; j++) {
        const a = i * ring + j; const b2 = i * ring + ((j + 1) % ring);
        const c = (i + 1) * ring + j; const d = (i + 1) * ring + ((j + 1) % ring);
        idx.push(a, c, b2, b2, c, d);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.userData.count = idx.length;
    return g;
  }
  function reveal(mesh, t) { // draw a ribbon from its start up to t (0..1)
    const total = mesh.geometry.userData.count || 0;
    mesh.geometry.setDrawRange(0, Math.max(0, Math.floor((total * clamp(t)) / 6) * 6));
  }
  class Trefoil extends T.Curve {
    constructor(s) { super(); this.s = s; }
    getPoint(t, target = new T.Vector3()) {
      const a = t * Math.PI * 2;
      return target.set(Math.sin(a) + 2 * Math.sin(2 * a), Math.cos(a) - 2 * Math.cos(2 * a), -Math.sin(3 * a)).multiplyScalar(this.s);
    }
  }
  function roundedRect(w, h, r) {
    const s = new T.Shape(); const x = -w / 2; const y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return new T.ShapeGeometry(s, 6);
  }
  const shared = {
    sphere: new T.SphereGeometry(1, LITE ? 24 : 40, LITE ? 16 : 28),
    cyl: new T.CylinderGeometry(1, 1, 1, 24, 1),
    hex: new T.CylinderGeometry(1, 1, 1, 6, 1),
    box: new T.BoxGeometry(1, 1, 1),
    torus: new T.TorusGeometry(1, 0.07, 12, 64),
    plane: new T.PlaneGeometry(1, 1),
    planeHi: new T.PlaneGeometry(1, 1, 32, 20)
  };
  const disposables = []; // per-view geometries/materials/textures created later

  // Shared soft contact shadow / glow quad (premultiplied radial falloff).
  const blobVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  function blobMaterial(colorRef, strength) {
    const m = new T.ShaderMaterial({
      transparent: true, premultipliedAlpha: true, depthWrite: false,
      uniforms: { uColor: { value: colorRef.clone() }, uA: { value: strength }, uOpacity: { value: 1 } },
      vertexShader: blobVS,
      fragmentShader: 'uniform vec3 uColor; uniform float uA; uniform float uOpacity; varying vec2 vUv;' +
        'void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2) * uA * uOpacity;' +
        ' gl_FragColor = vec4(uColor * a, a); }'
    });
    disposables.push(m);
    return m;
  }

  /* ---- Views ---------------------------------------------------------------- */
  const FOV = 30; const TAN = Math.tan((FOV * Math.PI) / 360);
  const views = [];
  let vw = 1; let vh = 1;

  function baseView(el, kind) {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(FOV, 1, 1, 20000);
    const v = { el, kind, scene, camera, w: 0, h: 0, dist: 1000, rect: null, shown: false, ready: true, lights: addLights(scene) };
    v.fit = (w, h) => {
      v.w = w; v.h = h;
      v.dist = h / 2 / TAN; // z = 0 plane: 1 unit == 1 CSS px of the window
      camera.near = Math.max(1, v.dist * 0.2);
      camera.far = v.dist * 4 + 2000;
      camera.position.set(0, 0, v.dist);
      camera.lookAt(0, 0, 0);
      if (v.layout) v.layout(w, h);
    };
    views.push(v);
    return v;
  }

  // Compile a window's programs off the main thread (KHR_parallel_shader_compile)
  // and upload its textures one per task, so its first frame does neither.
  const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];
  const uploaded = new WeakSet();
  async function prepare(v) {
    if (v.disabled) return;
    if (renderer.compileAsync) await renderer.compileAsync(v.scene, v.camera).catch(() => {});
    const texs = new Set();
    v.scene.traverse((o) => {
      [].concat(o.material || []).forEach((m) => {
        TEX_KEYS.forEach((k) => { if (m[k]) texs.add(m[k]); });
        if (m.uniforms) Object.values(m.uniforms).forEach((u) => { if (u.value && u.value.isTexture) texs.add(u.value); });
      });
    });
    for (const t of texs) {
      if (uploaded.has(t) || !t.image) continue;
      uploaded.add(t);
      renderer.initTexture(t);
      await pause();
    }
    // One draw into an empty scissor box creates whatever compile() cannot
    // foresee (buffers, extra passes); the next frame resets viewport and scissor.
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, 1, 1);
    renderer.setScissor(0, 0, 0, 0);
    renderer.render(v.scene, v.camera);
    requestRender(); // a draw marks the canvas for presentation: repaint it fully before that
  }
  // A window whose texture or model just arrived is drawn only once prepared.
  function goLive(v, relayout) {
    if (relayout) v.layout(v.w, v.h);
    prepare(v).then(() => { v.ready = true; requestRender(); });
  }
  const damp = (c, t, dt, k = 7) => c + (t - c) * (1 - Math.exp(-dt * k));
  const settled = (a, b) => Math.abs(a - b) < 1e-3;
  function enterOf(r, start = 0.95, span = 0.55) { return clamp((vh * start - r.top) / (vh * span)); }

  const pointer = { x: -1e4, y: -1e4, fine: fineMQ.matches };
  const tilt = { on: false, got: false, x: 0, y: 0, base: null };
  const inside = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

  /* Hero: portrait inside a ring of glass shards ------------------------------
     Trionn-style: shards assemble on load, scatter as the hero scrolls away,
     glint and throw electric arcs when the cursor touches them, and blast
     apart on press-and-hold (reassembling on release). One explode value
     combines scroll, intro and blast, so every state reverses smoothly. */
  function ribbonChunks(curve, o, n) {
    const segs = o.segments; const ring = o.ring || (LITE ? 8 : 10);
    const frames = curve.computeFrenetFrames(segs, true);
    const P = new T.Vector3(); const nn = new T.Vector3(); const b = new T.Vector3(); const q = new T.Vector3();
    const rings = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs; curve.getPointAt(u, P);
      const a = o.twist(u); const ca = Math.cos(a); const sa = Math.sin(a);
      nn.copy(frames.normals[i]).multiplyScalar(ca).addScaledVector(frames.binormals[i], sa);
      b.copy(frames.binormals[i]).multiplyScalar(ca).addScaledVector(frames.normals[i], -sa);
      const hw = (o.width * o.widthAt(u)) / 2; const ht = o.thickness / 2; const r = [];
      for (let j = 0; j < ring; j++) {
        const t = (j / ring) * Math.PI * 2; const c = Math.cos(t); const s = Math.sin(t);
        q.copy(P).addScaledVector(nn, Math.sign(c) * Math.pow(Math.abs(c), 0.55) * hw).addScaledVector(b, Math.sign(s) * Math.pow(Math.abs(s), 0.55) * ht);
        r.push(q.x, q.y, q.z);
      }
      rings.push(r);
    }
    const out = []; const per = segs / n;
    for (let k = 0; k < n; k++) {
      const i0 = Math.round(k * per); const i1 = Math.round((k + 1) * per);
      const center = new T.Vector3(); let cnt = 0;
      for (let i = i0; i <= i1; i++) for (let j = 0; j < ring; j++) { center.x += rings[i][j * 3]; center.y += rings[i][j * 3 + 1]; center.z += rings[i][j * 3 + 2]; cnt++; }
      center.multiplyScalar(1 / cnt);
      const pos = []; const idx = [];
      for (let i = i0; i <= i1; i++) for (let j = 0; j < ring; j++) pos.push(rings[i][j * 3] - center.x, rings[i][j * 3 + 1] - center.y, rings[i][j * 3 + 2] - center.z);
      for (let i = 0; i < i1 - i0; i++) for (let j = 0; j < ring; j++) {
        const a = i * ring + j; const b2 = i * ring + ((j + 1) % ring); const c = (i + 1) * ring + j; const d = (i + 1) * ring + ((j + 1) % ring);
        idx.push(a, c, b2, b2, c, d);
      }
      // close both ends so a flying shard reads as a solid piece of glass
      const capA = []; const capB = [];
      for (let j = 1; j < ring - 1; j++) { capA.push(0, j + 1, j); const o2 = (i1 - i0) * ring; capB.push(o2, o2 + j, o2 + j + 1); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setIndex(idx.concat(capA, capB));
      g.computeVertexNormals();
      out.push({ geo: g, center });
    }
    return out;
  }

  // Synthesised sound (Web Audio), off until the visitor turns it on.
  const sfx = (() => {
    let ctx = null; let on = false; let hum = null; let noiseBuf = null;
    const btn = document.querySelector('[data-sound-toggle]');
    const ensure = () => {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
      if (ctx.state === 'suspended') ctx.resume();
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return ctx;
    };
    const tone = (type, f0, f1, dur, vol) => {
      const c = ensure(); if (!c) return; const t = c.currentTime;
      const o = c.createOscillator(); const g = c.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    };
    const noise = (dur, type, f0, f1, vol) => {
      const c = ensure(); if (!c) return; const t = c.currentTime;
      const s = c.createBufferSource(); s.buffer = noiseBuf;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(c.destination); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    };
    const api = {
      get on() { return on; },
      beep() { if (on) tone('sine', 1320, 990, 0.09, 0.035); },
      crackle() { if (on) noise(0.11, 'highpass', 3200, 6000, 0.05); },
      blast() { if (on) { noise(0.7, 'lowpass', 1400, 90, 0.16); tone('sine', 90, 40, 0.5, 0.12); } },
      join() { if (on) { tone('triangle', 520, 780, 0.16, 0.04); } },
      charge(level) {
        if (!on || !ensure()) return;
        if (!hum) {
          const o = ctx.createOscillator(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
          o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0;
          o.connect(f).connect(g).connect(ctx.destination); o.start(); hum = { o, g };
        }
        hum.o.frequency.setTargetAtTime(70 + level * 260, ctx.currentTime, 0.05);
        hum.g.gain.setTargetAtTime(level * 0.035, ctx.currentTime, 0.05);
      },
      stopCharge() { if (hum) { hum.g.gain.setTargetAtTime(0, ctx.currentTime, 0.06); const h = hum; hum = null; setTimeout(() => { try { h.o.stop(); } catch (e) {} }, 400); } }
    };
    if (btn) {
      btn.hidden = !!reduced; // the effects it voices are off with reduced motion
      btn.addEventListener('click', () => {
        on = !on; if (on) ensure();
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.querySelector('span').textContent = on ? 'Sound on' : 'Sound off';
        if (on) api.join();
      });
    }
    return api;
  })();

  function heroView(el) {
    if (!portraitImg) return;
    const v = baseView(el, 'hero');
    v.ready = false;
    v.clipEl = masthead; // never draw past the hero's own edge
    const stageEl = masthead.querySelector('[data-hero-stage]') || el;
    const state = { px: 0, py: 0, lx: 0, ly: 0, s: 0, intro: 0, introStart: 0, charge: 0, blast: 0, hold: false, holdT: 0,
      vib: 0, jolt: 0, hovered: -1, burstLeft: 0, cooldown: 0, blasted: false };
    const pickCam = new T.PerspectiveCamera(FOV, 1, 1, 20000);
    const ray = new T.Raycaster();
    const ndc = new T.Vector2();

    const glowMat = blobMaterial(cur.glow, 0.55);
    const glow = new T.Mesh(shared.plane, glowMat);
    glow.renderOrder = 0;
    const ring = new T.Group();
    let shards = []; let R = 100;
    const portraitUniforms = {
      map: { value: null }, uLight: { value: new T.Vector2(-0.006, 0.004) },
      uRim: { value: cur.hl.clone() }, uOpacity: { value: 1 }
    };
    const portraitMat = new T.ShaderMaterial({
      transparent: true, depthTest: true, depthWrite: false, uniforms: portraitUniforms,
      vertexShader: blobVS,
      fragmentShader: `uniform sampler2D map; uniform vec2 uLight; uniform vec3 uRim; uniform float uOpacity; varying vec2 vUv;
        void main(){
          vec4 c = texture2D(map, vUv);
          float lit = 0.5 * (texture2D(map, vUv + uLight).a + texture2D(map, vUv + uLight * 0.5).a);
          float rim = clamp(c.a - lit, 0.0, 1.0) * c.a;
          gl_FragColor = vec4(c.rgb + uRim * rim * 0.3, c.a * uOpacity);
          #include <colorspace_fragment>
        }`
    });
    disposables.push(portraitMat);
    const portrait = new T.Mesh(shared.plane, portraitMat);
    portrait.renderOrder = 2;

    // Dust at a few depths for parallax.
    const DUST = LITE ? 14 : 28;
    const dustGeo = new T.BufferGeometry();
    const dustMat = new T.ShaderMaterial({
      transparent: true, premultipliedAlpha: true, depthWrite: false,
      uniforms: { uDist: { value: 1000 }, uPR: { value: 1 }, uOpacity: { value: 0 }, uA: { value: cur.hl.clone() }, uB: { value: cur.decor.clone() } },
      vertexShader: `attribute float aSize; attribute float aTone; attribute float aAlpha; uniform float uDist; uniform float uPR;
        varying float vTone; varying float vAlpha;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPR * (uDist / -mv.z); vTone = aTone; vAlpha = aAlpha; }`,
      fragmentShader: `uniform float uOpacity; uniform vec3 uA; uniform vec3 uB; varying float vTone; varying float vAlpha;
        void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.2, d) * vAlpha * uOpacity;
          gl_FragColor = vec4(mix(uA, uB, vTone) * a, a); }`
    });
    disposables.push(dustMat, dustGeo);
    const dust = new T.Points(dustGeo, dustMat);
    dust.renderOrder = 1;

    // Electric arcs: a small pool of glowing strips (no post-processing bloom).
    const BOLT_PTS = 14; const BOLTS = 10;
    const boltMat = new T.ShaderMaterial({
      transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
      uniforms: { uCore: { value: new T.Color('#ffffff') }, uGlow: { value: cur.hl.clone() } },
      vertexShader: 'attribute float aSide; attribute float aLife; varying float vSide; varying float vLife; void main(){ vSide = aSide; vLife = aLife; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCore; uniform vec3 uGlow; varying float vSide; varying float vLife; void main(){ float d = abs(vSide); float core = smoothstep(0.3, 0.0, d); float glo = smoothstep(1.0, 0.0, d) * 0.6; float a = clamp(core + glo, 0.0, 1.0) * vLife; gl_FragColor = vec4(mix(uGlow, uCore, core) * a, a); }'
    });
    disposables.push(boltMat);
    const bolts = [];
    for (let i = 0; i < BOLTS; i++) {
      const g = new T.BufferGeometry();
      const side = new Float32Array(BOLT_PTS * 2); for (let k = 0; k < BOLT_PTS; k++) { side[k * 2] = -1; side[k * 2 + 1] = 1; }
      const idx = []; for (let k = 0; k < BOLT_PTS - 1; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(BOLT_PTS * 6), 3));
      g.setAttribute('aSide', new T.Float32BufferAttribute(side, 1));
      g.setAttribute('aLife', new T.Float32BufferAttribute(new Float32Array(BOLT_PTS * 2), 1));
      g.setIndex(idx);
      const m = new T.Mesh(g, boltMat); m.renderOrder = 5; m.visible = false; m.frustumCulled = false;
      ring.add(m); disposables.push(g);
      bolts.push({ m, a: -1, b: -1, t: 0, life: 0 });
    }
    const tA = new T.Vector3(); const tB = new T.Vector3();
    function spawnBolt(a, b, life) {
      if (a < 0 || b < 0 || a === b) return;
      const bo = bolts.find((x) => x.t <= 0); if (!bo) return;
      Object.assign(bo, { a, b, t: life, life }); bo.m.visible = true;
    }
    function drawBolt(bo) {
      const pa = shards[bo.a].back.position; const pb = shards[bo.b].back.position;
      const pos = bo.m.geometry.attributes.position.array; const lifeA = bo.m.geometry.attributes.aLife.array;
      const dx = pb.x - pa.x; const dy = pb.y - pa.y; const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len; const ny = dx / len; const w = 3.2; const k = bo.t / bo.life;
      for (let i = 0; i < BOLT_PTS; i++) {
        const u = i / (BOLT_PTS - 1); const env = Math.sin(Math.PI * u);
        const off = (i === 0 || i === BOLT_PTS - 1) ? 0 : (Math.random() - 0.5) * len * 0.22 * env;
        tA.lerpVectors(pa, pb, u); tA.x += nx * off; tA.y += ny * off;
        pos.set([tA.x - nx * w, tA.y - ny * w, tA.z, tA.x + nx * w, tA.y + ny * w, tA.z], i * 6);
        lifeA[i * 2] = lifeA[i * 2 + 1] = k;
      }
      bo.m.geometry.attributes.position.needsUpdate = true; bo.m.geometry.attributes.aLife.needsUpdate = true;
    }
    function zap(from, count) {
      for (let i = 0; i < count; i++) {
        const step = 2 + Math.floor(Math.random() * 4);
        const to = (from + (Math.random() < 0.5 ? step : -step) + shards.length) % shards.length;
        spawnBolt(from, to, 0.12 + Math.random() * 0.1);
      }
      sfx.crackle();
    }

    v.scene.add(glow, ring, portrait, dust);

    shaderUniformSinks.push(() => {
      glowMat.uniforms.uColor.value.copy(cur.glow);
      portraitUniforms.uRim.value.copy(cur.hl);
      dustMat.uniforms.uA.value.copy(cur.hl);
      dustMat.uniforms.uB.value.copy(cur.decor);
      boltMat.uniforms.uGlow.value.copy(cur.hl);
    });

    const tex = loadTexture(portraitImg.currentSrc || portraitImg.src, 0, () => {
      goLive(v, !shards.length); // the shards do not depend on the image; keep any already built
    }, () => { v.disabled = true; });
    tex.colorSpace = T.SRGBColorSpace;
    tex.minFilter = T.LinearMipmapLinearFilter;
    tex.magFilter = T.LinearFilter;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    portraitUniforms.map.value = tex;
    disposables.push(tex);

    let pbox = { cx: 0, cy: 0, w: 1, h: 1 };
    v.layout = (w, h) => {
      const wr = el.getBoundingClientRect(); const pr = portraitImg.getBoundingClientRect();
      if (!pr.width) return;
      const cx = pr.left - wr.left + pr.width / 2 - w / 2;
      const cy = -(pr.top - wr.top + pr.height / 2 - h / 2);
      pbox = { cx, cy, w: pr.width, h: pr.height };
      portrait.scale.set(pr.width, pr.height, 1);
      portrait.position.set(cx, cy, 0);
      glow.scale.set(pr.width * 2.6, pr.height * 1.5, 1);
      glow.position.set(cx, cy + pr.height * 0.12, -520);

      // The loop hugs the shoulders and crosses the chest.
      const room = Math.min(cx + w / 2, w / 2 - cx) - 14;
      R = Math.max(60, Math.min(pr.width * 0.6, room));
      const pts = [];
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        pts.push(new T.Vector3(R * Math.cos(a), -R * 0.24 * Math.sin(a) + R * 0.05 * Math.sin(2 * a + 0.8), R * Math.sin(a)));
      }
      shards.forEach((sh) => { ring.remove(sh.back, sh.front); sh.back.geometry.dispose(); });
      shards = [];
      const width = clamp(R * 0.085, 10, 34);
      let seed = 11; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      ribbonChunks(new T.CatmullRomCurve3(pts, true, 'centripetal'), {
        segments: LITE ? 144 : 240, width, thickness: Math.max(2, width * 0.13),
        twist: (u) => u * Math.PI * 3, widthAt: (u) => 0.72 + 0.28 * Math.sin(u * Math.PI * 4 + 0.6)
      }, LITE ? 18 : 30).forEach(({ geo, center }, i) => {
        // Back half before the portrait, front half after it: the face shows through the glass in front.
        const back = new T.Mesh(geo, glassBack); back.renderOrder = 1; back.userData.i = i;
        const front = new T.Mesh(geo, glassFront); front.renderOrder = 3; front.userData.i = i;
        back.position.copy(center); front.position.copy(center);
        ring.add(back, front);
        const dir = new T.Vector3(center.x, 0, center.z).normalize()
          .add(new T.Vector3((rand() - 0.5) * 0.6, (rand() - 0.35) * 1.3, (rand() - 0.5) * 0.9)).normalize();
        const axis = new T.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
        shards.push({ back, front, center, dir, axis, spin: 0.5 + rand() * 1.5, delay: rand() * 0.35, flash: 0 });
      });
      ring.position.set(cx, cy - pr.height * 0.2, 0);
      ring.rotation.set(0, 0, -0.1);

      let s2 = 7; const r2 = () => ((s2 = (s2 * 16807) % 2147483647) / 2147483647);
      const p = []; const sz = []; const tn = []; const al = [];
      for (let i = 0; i < DUST; i++) {
        const x = cx + (r2() - 0.5) * pr.width * 1.7; const y = cy + (r2() - 0.5) * pr.height * 1.05; const z = -380 + r2() * 520;
        if (Math.abs(x - cx) < pr.width * 0.26 && Math.abs(y - (cy + pr.height * 0.16)) < pr.height * 0.24) { i--; continue; }
        p.push(x, y, z); sz.push(1.6 + r2() * 2.6); tn.push(r2() < 0.3 ? 1 : 0); al.push(0.2 + r2() * 0.4);
      }
      dustGeo.setAttribute('position', new T.Float32BufferAttribute(p, 3));
      dustGeo.setAttribute('aSize', new T.Float32BufferAttribute(sz, 1));
      dustGeo.setAttribute('aTone', new T.Float32BufferAttribute(tn, 1));
      dustGeo.setAttribute('aAlpha', new T.Float32BufferAttribute(al, 1));
      dustGeo.computeBoundingSphere();
      dustMat.uniforms.uDist.value = v.dist;
    };

    // Press and hold the portrait: charge (nearby UI trembles), then blast.
    // A drag cancels it so touch scrolling is never blocked.
    const vibEls = [document.querySelector('.site-header .nav'), masthead.querySelector('.hero__title'), masthead.querySelector('.hero__status')].filter(Boolean);
    let down = null;
    function onDown(e) {
      if (reduced || (e.pointerType === 'mouse' && e.button !== 0)) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      state.hold = true; state.holdT = 0; requestRender();
    }
    function onMove(e) { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) release(true); }
    function release(cancelled) {
      if (!down) return;
      const quick = performance.now() - down.t < 260;
      down = null; state.hold = false; sfx.stopCharge();
      if (!cancelled && quick && shards.length) { state.jolt = 1; zap(Math.floor(Math.random() * shards.length), 3); sfx.beep(); }
      if (state.blasted) { state.blasted = false; sfx.join(); }
      requestRender();
    }
    const onUp = () => release(false); const onCancel = () => release(true);
    stageEl.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => { if (v.w) v.layout(v.w, v.h); requestRender(); });
      ro.observe(portraitImg);
      v.cleanup = () => {
        ro.disconnect();
        stageEl.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        sfx.stopCharge();
      };
    }

    v.update = (dt, now, r) => {
      if (!v.ready) return false;
      const mr = masthead.getBoundingClientRect();
      let tpx = 0; let tpy = 0;
      const pointerIn = pointer.fine && !reduced && inside(mr, pointer.x, pointer.y);
      if (pointerIn) {
        tpx = clamp(((pointer.x - mr.left) / mr.width) * 2 - 1, -1, 1);
        tpy = clamp(((pointer.y - mr.top) / mr.height) * 2 - 1, -1, 1);
      }
      const ts = reduced ? 0 : clamp(-mr.top / Math.max(1, mr.height));
      let tlx = tpx; let tly = tpy;
      if (!pointer.fine && !reduced) {
        if (tilt.on) { tlx = tilt.x; tly = tilt.y; tpx = tilt.x; tpy = tilt.y * 0.8; } else { tlx = Math.sin(ts * Math.PI * 1.4) * 0.8; tly = -0.2 + ts * 0.6; }
      }
      if (reduced) { tlx = -0.35; tly = -0.2; }
      if (reduced) { Object.assign(state, { intro: 1, px: 0, py: 0, s: 0, lx: tlx, ly: tly, blast: 0, vib: 0, jolt: 0 }); } else {
        if (!state.introStart && !root.classList.contains('is-preloading')) state.introStart = now; // assemble as the preloader leaves
        state.intro = state.introStart ? clamp((now - state.introStart) / 3000) : 0;
        // Scroll is not damped: the portrait must move and fade in step with the page.
        state.px = damp(state.px, tpx, dt); state.py = damp(state.py, tpy, dt); state.s = ts;
        state.lx = damp(state.lx, tlx, dt, 4); state.ly = damp(state.ly, tly, dt, 4);
        // hold -> charge (0.5 s) -> blast; release eases back
        if (state.hold) {
          state.holdT += dt; state.vib = Math.min(1, state.holdT / 0.5);
          sfx.charge(state.vib);
          if (state.holdT >= 0.5) {
            if (!state.blasted) { state.blasted = true; sfx.stopCharge(); sfx.blast(); for (let i = 0; i < 6; i++) zap(Math.floor(Math.random() * shards.length), 1); }
            state.vib *= 0.88; state.blast = Math.min(1, state.blast + dt * 2.4);
          }
        } else {
          state.vib = Math.max(0, state.vib - dt * 4); state.blast = Math.max(0, state.blast - dt * 1.6);
        }
        state.jolt = Math.max(0, state.jolt - dt * 5);
      }
      // nearby UI trembles while charging, then settles with an ease
      vibEls.forEach((elx) => {
        if (state.vib > 0.01 && state.hold) {
          elx.style.transition = 'none';
          elx.style.transform = `translate(${((Math.random() - 0.5) * 3 * state.vib).toFixed(2)}px, ${((Math.random() - 0.5) * 2 * state.vib).toFixed(2)}px)`;
        } else if (elx.style.transform) {
          elx.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          elx.style.transform = '';
        }
      });

      // Hover: raycast against the real shard geometry; a new shard glints and throws arcs.
      let hit = -1;
      if (pointerIn && shards.length && state.intro >= 1 && state.blast < 0.05) {
        pickCam.copy(v.camera); pickCam.clearViewOffset(); pickCam.aspect = v.w / v.h; pickCam.updateProjectionMatrix();
        const r0 = el.getBoundingClientRect();
        ndc.set(((pointer.x - r0.left) / r0.width) * 2 - 1, -((pointer.y - r0.top) / r0.height) * 2 + 1);
        ray.setFromCamera(ndc, pickCam);
        const hits = ray.intersectObjects(shards.map((sh) => sh.front).concat(shards.map((sh) => sh.back)), false);
        if (hits.length) hit = hits[0].object.userData.i;
      }
      if (hit !== state.hovered) {
        if (hit >= 0) { shards[hit].flash = 1; state.charge = 1; state.burstLeft = 5 + Math.floor(Math.random() * 2); sfx.beep(); }
        state.hovered = hit;
      }
      state.cooldown -= dt;
      if (hit >= 0 && state.burstLeft > 0 && state.cooldown <= 0) {
        zap(hit, Math.random() > 0.5 ? 1 : 2); state.burstLeft--; state.cooldown = 0.04 + Math.random() * 0.06;
      }
      state.charge *= Math.exp(-dt * 3.2); if (state.charge < 0.002) state.charge = 0;

      const c = state.charge;
      // The whole scene fades out over the first ~half of the hero's scroll; fully
      // faded, the view is skipped (v.skip) so it costs nothing further down.
      const fade = 1 - smooth(clamp((state.s - 0.12) / 0.4));
      v.skip = fade < 0.002;
      [glassFront, glassBack].forEach((g) => {
        g.envMapIntensity = 1.7 + c * 1.5 + state.vib * 0.8;
        if ('clearcoatRoughness' in g) g.clearcoatRoughness = Math.max(0.005, 0.03 - c * 0.02);
        g.opacity = (0.86 + c * 0.1) * fade;
      });
      portraitUniforms.uOpacity.value = fade;

      const ti = state.intro;
      const e = ti * ti * ti * (ti * (ti * 6 - 15) + 10); // smootherstep: no snap at either end
      const { px, py, s, lx, ly } = state;
      // One explode value for intro (assembling), scroll (scattering) and blast.
      const scrollEx = smooth(clamp((s - 0.06) / 0.55));
      const ex = Math.max(1 - e, scrollEx, state.blast);
      const par = tilt.on ? 30 : 18; // phones get a stronger, obvious parallax from tilt
      v.camera.position.set(px * par - (1 - e) * 44, -py * 12 + s * 34, v.dist * (1 + 0.07 * (1 - e) + s * 0.12));
      v.camera.lookAt(0, s * 10, 0);
      portrait.rotation.set(py * 0.008, px * 0.018, 0);
      portrait.position.y = pbox.cy + s * 6;
      portraitUniforms.uLight.value.set(-0.005 - lx * 0.004, 0.004 + ly * 0.003);
      ring.rotation.y = lx * (tilt.on ? 0.42 : 0.2) + s * 0.3;
      ring.rotation.x = -ly * (tilt.on ? 0.22 : 0.1) + s * 0.1;
      let busy = false;
      shards.forEach((sh) => {
        const a = smooth(clamp(ex * 1.25 - sh.delay * (1 - ex) - sh.delay * 0.4));
        const lift = sh.flash * 7 + state.jolt * 6 * (0.5 + sh.delay);
        tB.copy(sh.dir).multiplyScalar(a * R * 1.15 + lift);
        sh.back.position.copy(sh.center).add(tB);
        sh.back.quaternion.setFromAxisAngle(sh.axis, a * Math.PI * sh.spin + state.vib * 0.05 * Math.sin(now * 0.05 + sh.delay * 40));
        sh.front.position.copy(sh.back.position); sh.front.quaternion.copy(sh.back.quaternion);
        sh.flash *= Math.exp(-dt * 4); if (sh.flash < 0.003) sh.flash = 0; else busy = true;
      });
      bolts.forEach((bo) => { if (bo.t > 0) { bo.t -= dt; if (bo.t > 0) { drawBolt(bo); busy = true; } else bo.m.visible = false; } });

      v.lights.rim.position.set(lx * 1.5, 0.45 - ly * 0.9, 0.95);
      v.lights.rim.intensity = 2.2 + c * 1.6 + state.blast * 1.2;
      glowMat.uniforms.uOpacity.value = e * fade;
      dustMat.uniforms.uOpacity.value = e * fade;
      dustMat.uniforms.uPR.value = renderer.getPixelRatio();
      return busy || state.hold || state.intro < 1 || state.blast > 0 || state.vib > 0 || state.jolt > 0 || state.charge > 0 ||
        !settled(state.px, tpx) || !settled(state.py, tpy) || !settled(state.s, ts) || !settled(state.lx, tlx) || !settled(state.ly, tly);
    };
    v.onShown = () => masthead.classList.add('scene-ready');
    v.onHidden = () => masthead.classList.remove('scene-ready');
  }

  /* About: the loop opens into a wide arc while two frosted planes separate - */
  function aboutView(el) {
    const v = baseView(el, 'about');
    const state = { e: 0 };
    const group = new T.Group();
    let arc = null;
    const planeA = new T.Mesh(shared.plane, frost);
    const planeB = new T.Mesh(shared.plane, frost);
    let geoA = null; let geoB = null;
    v.scene.add(group, planeA, planeB);
    v.layout = (w, h) => {
      if (arc) { group.remove(arc); arc.geometry.dispose(); }
      const pts = [
        [-0.47, -0.4, -40], [-0.32, 0.06, 30], [-0.1, 0.34, 70], [0.14, 0.32, 30], [0.33, 0.04, -30], [0.48, -0.38, -70]
      ].map(([x, y, z]) => new T.Vector3(x * w, y * h, z));
      const width = clamp(h * 0.12, 12, 30);
      arc = new T.Mesh(ribbonGeometry(new T.CatmullRomCurve3(pts, false, 'centripetal'), {
        segments: LITE ? 110 : 180, width, thickness: Math.max(2, width * 0.14), twist: (u) => u * Math.PI * 2.5,
        widthAt: (u) => 0.55 + 0.45 * Math.sin(u * Math.PI)
      }), glaze);
      group.add(arc);
      if (geoA) { geoA.dispose(); geoB.dispose(); }
      geoA = roundedRect(w * 0.26, h * 0.62, 18); geoB = roundedRect(w * 0.2, h * 0.48, 16);
      planeA.geometry = geoA; planeB.geometry = geoB;
    };
    v.update = (dt, now, r) => {
      const t = reduced ? 1 : smooth(enterOf(r, 1.0, 0.6));
      state.e = reduced ? 1 : damp(state.e, t, dt, 6);
      const e = state.e; const w = v.w; const h = v.h;
      group.scale.set(0.42 + 0.58 * e, 0.8 + 0.2 * e, 1);
      group.rotation.set(0.1 * (1 - e), 0.9 * (1 - e) + 0.08, -0.3 * (1 - e));
      if (arc) reveal(arc, 0.15 + 0.85 * e);
      planeA.position.set(-w * 0.2, h * 0.02, -60 - 150 * e);
      planeA.rotation.set(0, 0.3 - 0.12 * e, 0.02);
      planeB.position.set(w * 0.22, -h * 0.08, 20 + 90 * e);
      planeB.rotation.set(0, -0.28 + 0.1 * e, -0.03);
      frost.opacity = 0.5 + 0.2 * e;
      return !settled(state.e, t);
    };
  }

  /* Expertise + awards: high-quality PBR models (Poly Haven, CC0) ----------- */
  const gltfLoader = new T.GLTFLoader();
  const MODEL_ROOT = new URL('./assets/models/', import.meta.url).href;
  function modelView(el, opts) {
    const v = baseView(el, 'model');
    v.ready = false;
    const card = el.closest(opts.cardSel) || el;
    const section = el.closest('section') || el;
    const pivot = new T.Group(); const spin = new T.Group(); pivot.add(spin); v.scene.add(pivot);
    const shadow = new T.Mesh(shared.plane, blobMaterial(new T.Color(0, 0, 0), 0.34));
    shadow.rotation.x = -Math.PI / 2; v.scene.add(shadow);
    v.scene.environment = envTex;
    let model = null; let radius = 1; let bottom = 0;
    v.near = () => {
      if (v.loading) return; v.loading = true;
      gltfLoader.load(MODEL_ROOT + opts.model + '/' + opts.model + '.gltf', (g) => {
        model = g.scene;
        model.traverse((o) => {
          if (!o.isMesh) return;
          disposables.push(o.geometry);
          [].concat(o.material).forEach((m) => {
            m.envMapIntensity = opts.env || 1.1; disposables.push(m);
            ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach((k) => { if (m[k]) { m[k].anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); disposables.push(m[k]); } });
          });
        });
        const box = new T.Box3().setFromObject(model);
        const size = box.getSize(new T.Vector3()); const c = box.getCenter(new T.Vector3());
        model.position.sub(c);
        radius = Math.max(size.x, size.y, size.z) / 2; bottom = -size.y / 2;
        spin.add(model);
        goLive(v, true);
      }, undefined, () => { v.disabled = true; });
    };
    v.layout = (w, h) => {
      if (!model) return;
      const k = (Math.min(w * 0.8, h) * (opts.fit || 0.4)) / radius;
      pivot.scale.setScalar(k);
      shadow.scale.set(radius * k * 3, radius * k * 3, 1);
      shadow.position.y = bottom * k - 3;
    };
    const state = { e: 0, hx: 0, hy: 0, p: 0 };
    v.update = (dt, now, r) => {
      if (!v.ready) return false;
      const te = reduced ? 1 : smooth(enterOf(r, 1.0, 0.5));
      let thx = 0; let thy = 0;
      if (!reduced) {
        if (pointer.fine) {
          const cr = card.getBoundingClientRect();
          if (inside(cr, pointer.x, pointer.y)) { thx = clamp(((pointer.x - cr.left) / cr.width) * 2 - 1, -1, 1); thy = clamp(((pointer.y - cr.top) / cr.height) * 2 - 1, -1, 1); }
        } else if (tilt.on) { thx = tilt.x; thy = tilt.y; }
      }
      let tp = 0;
      if (opts.scrollTurn) {
        const sr = section.getBoundingClientRect();
        tp = reduced ? 0.15 : clamp((vh * 0.6 - sr.top) / Math.max(1, sr.height - vh * 0.4));
      }
      if (reduced) Object.assign(state, { e: 1, hx: 0, hy: 0, p: tp }); else {
        state.e = damp(state.e, te, dt, 5); state.hx = damp(state.hx, thx, dt, 6); state.hy = damp(state.hy, thy, dt, 6); state.p = damp(state.p, tp, dt, 5);
      }
      spin.rotation.y = (opts.yaw || 0.55) - (1 - state.e) * 1.6 + state.hx * 0.6 + state.p * Math.PI * 1.6;
      spin.rotation.x = (opts.pitch || 0.12) + state.hy * 0.22;
      pivot.position.y = (1 - state.e) * -18;
      const sweep = (1 - state.e) * Math.PI + state.hx * 0.7 + state.p * Math.PI * 2;
      v.lights.rim.position.set(Math.cos(sweep) * 1.3, 0.6, Math.sin(sweep) * 1.2);
      v.lights.rim.intensity = 1.8;
      return !settled(state.e, te) || !settled(state.hx, thx) || !settled(state.hy, thy) || !settled(state.p, tp);
    };
  }

  /* Experience: a twisted rail with milestone markers ---------------------- */
  function railView(el) {
    const v = baseView(el, 'rail');
    const wrap = el.parentElement;
    const items = Array.prototype.slice.call(wrap.querySelectorAll('.tl'));
    const group = new T.Group();
    let rail = null;
    const markers = items.map((item) => {
      const m = new T.Group();
      const disc = new T.Mesh(shared.cyl, glaze); disc.rotation.x = Math.PI / 2;
      const core = new T.Mesh(shared.sphere, item.classList.contains('is-featured') ? coreDecorMat : coreMat);
      m.add(disc, core); group.add(m);
      return { item, m, disc, core, lit: 0, y: 0 };
    });
    v.scene.add(group);
    v.layout = (w, h) => {
      if (rail) { group.remove(rail); rail.geometry.dispose(); }
      const top = h / 2 - 30; const bottom = -h / 2 + 30;
      const pts = []; const n = Math.max(6, Math.round(h / 180));
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        pts.push(new T.Vector3(Math.sin(u * Math.PI * 5) * 3, lerp(top, bottom, u), Math.cos(u * Math.PI * 3) * 5));
      }
      rail = new T.Mesh(ribbonGeometry(new T.CatmullRomCurve3(pts, false, 'centripetal'), {
        segments: Math.min(LITE ? 160 : 320, Math.round(h / 8)), width: 8, thickness: 2.4, twist: (u) => u * Math.PI * (h / 140)
      }), glaze);
      group.add(rail);
      const wr = el.getBoundingClientRect();
      markers.forEach((mk) => {
        const dot = mk.item.querySelector('.tl__rail');
        const dr = dot ? dot.getBoundingClientRect() : mk.item.getBoundingClientRect();
        // Centre of the CSS marker (::after), so the 3D marker lands exactly on it.
        const after = dot ? getComputedStyle(dot, '::after') : null;
        const offset = after ? (parseFloat(after.top) || 26) + (parseFloat(after.height) || 12) / 2 : 32;
        const yPx = (dr.top - wr.top) + offset;
        mk.y = h / 2 - yPx;
        mk.disc.scale.set(8, 4, 8);
        mk.core.scale.setScalar(3.4);
      });
    };
    let phase = 0;
    v.update = (dt, now, r) => {
      let moving = false;
      markers.forEach((mk) => {
        const ir = mk.item.getBoundingClientRect();
        const t = reduced ? 1 : (ir.top < vh * 0.72 ? 1 : 0);
        mk.lit = reduced ? t : damp(mk.lit, t, dt, 6);
        if (!settled(mk.lit, t)) moving = true;
        mk.m.position.set(0, mk.y, 6 + mk.lit * 10);
        mk.core.position.z = 3 + mk.lit * 2;
        mk.core.scale.setScalar(2 + mk.lit * 2.2);
        mk.disc.scale.set(7 + mk.lit * 2, 4, 7 + mk.lit * 2);
      });
      const tp = reduced ? 0 : clamp((vh * 0.5 - r.top) / Math.max(1, r.height));
      phase = reduced ? 0 : damp(phase, tp, dt, 6);
      group.rotation.y = phase * 1.4 - 0.3;
      if (!settled(phase, tp)) moving = true;
      return moving;
    };
  }

  /* Projects: image planes with cover-fit, reveal bend and pointer bulge ---- */
  const mediaVS = `uniform float uReveal; uniform float uHover; uniform vec2 uMouse; uniform float uBend; varying vec2 vUv;
    void main(){ vUv = uv; vec3 p = position;
      p.z -= (1.0 - uReveal) * uBend * sin(uv.x * 3.14159);
      float d = distance(uv, uMouse); p.z += uHover * 22.0 * exp(-d * d * 9.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
  const mediaFS = `uniform sampler2D map; uniform vec4 uCover; uniform float uReveal; uniform float uHover; uniform vec2 uMouse;
    uniform vec3 uFade; uniform vec2 uFadeDir; uniform float uFadeOn; uniform vec4 uWin; uniform vec4 uRad; varying vec2 vUv;
    // Rounded corners of the card that holds this window (tl, tr, br, bl), in framebuffer px.
    float cornerMask(){
      vec2 p = gl_FragCoord.xy - uWin.xy; vec2 s = uWin.zw;
      float r = p.x < s.x * 0.5 ? (p.y > s.y * 0.5 ? uRad.x : uRad.w) : (p.y > s.y * 0.5 ? uRad.y : uRad.z);
      vec2 q = abs(p - s * 0.5) - (s * 0.5 - vec2(r));
      float d = length(max(q, 0.0)) - r;
      return clamp(0.5 - d, 0.0, 1.0);
    }
    void main(){ vec2 uv = vUv * uCover.xy + uCover.zw;
      float k = (1.0 - uReveal) * 0.008;
      vec3 c = vec3(texture2D(map, uv + vec2(k, 0.0)).r, texture2D(map, uv).g, texture2D(map, uv - vec2(k, 0.0)).b);
      float sheen = smoothstep(0.35, 0.0, distance(vUv, uMouse)) * uHover * 0.18;
      c += sheen;
      c = mix(c, c * 1.06, uHover);
      float f = clamp(dot(vUv, uFadeDir) - (uFadeDir.x + uFadeDir.y) * 0.55, 0.0, 1.0) / 0.45;
      c = mix(c, uFade, smoothstep(0.0, 1.0, f) * 0.92 * uFadeOn);
      float m = cornerMask();
      if (m <= 0.0) discard;
      gl_FragColor = vec4(c * m, m);
      #include <colorspace_fragment>
    }`;
  function mediaView(el, opts) {
    const img = el.querySelector('img');
    if (!img) return;
    const v = baseView(el, opts.kind);
    v.ready = false;
    const card = el.closest(opts.cardSel) || el;
    const uniforms = {
      map: { value: null }, uCover: { value: new T.Vector4(1, 1, 0, 0) }, uReveal: { value: 0 }, uHover: { value: 0 },
      uMouse: { value: new T.Vector2(0.5, 0.5) }, uBend: { value: opts.bend || 90 },
      uFade: { value: cur.hero.clone() }, uFadeDir: { value: new T.Vector2(1, 0) }, uFadeOn: { value: opts.fade ? 1 : 0 },
      uWin: { value: new T.Vector4() }, uRad: { value: new T.Vector4() }
    };
    const mat = new T.ShaderMaterial({ uniforms, vertexShader: mediaVS, fragmentShader: mediaFS, transparent: true, premultipliedAlpha: true });
    // Window position in framebuffer px, refreshed every frame before drawing.
    v.beforeRender = (r) => {
      const pr = renderer.getPixelRatio();
      uniforms.uWin.value.set(r.left * pr, (vh - r.bottom) * pr, r.width * pr, r.height * pr);
      const cs = getComputedStyle(card);
      const er = el.getBoundingClientRect(); const crr = card.getBoundingClientRect();
      const near = (a, b) => Math.abs(a - b) < 2;
      const rad = (prop, edgeA, edgeB) => (edgeA && edgeB ? (parseFloat(cs[prop]) || 0) * pr : 0);
      uniforms.uRad.value.set(
        rad('borderTopLeftRadius', near(er.top, crr.top), near(er.left, crr.left)),
        rad('borderTopRightRadius', near(er.top, crr.top), near(er.right, crr.right)),
        rad('borderBottomRightRadius', near(er.bottom, crr.bottom), near(er.right, crr.right)),
        rad('borderBottomLeftRadius', near(er.bottom, crr.bottom), near(er.left, crr.left))
      );
    };
    disposables.push(mat);
    const plane = new T.Mesh(shared.planeHi, mat);
    const group = new T.Group(); group.add(plane);
    let frame = null;
    if (opts.frame) {
      frame = new T.Group();
      for (let i = 0; i < 4; i++) frame.add(new T.Mesh(shared.box, glaze));
      group.add(frame);
    }
    v.scene.add(group);
    if (opts.fade) shaderUniformSinks.push(() => uniforms.uFade.value.copy(cur.hero));
    let tex = null; let aspect = 1;
    const load = () => {
      if (tex) return;
      // No larger than the window needs at the capped pixel ratio (the plane overfills ~10%).
      const ew = el.getBoundingClientRect().width;
      const maxW = ew ? Math.min(2048, Math.max(512, Math.ceil(ew * Math.min(2, window.devicePixelRatio || 1) * 1.15))) : 1280;
      tex = loadTexture(img.currentSrc || img.src, maxW, (t) => {
        aspect = t.image.width / t.image.height; goLive(v, true);
      }, () => { v.disabled = true; }); // e.g. a host without CORS: keep the <img>
      tex.colorSpace = T.SRGBColorSpace;
      tex.minFilter = T.LinearMipmapLinearFilter;
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      uniforms.map.value = tex;
      disposables.push(tex);
    };
    v.near = load; // the engine calls this when the window comes within ~1 viewport
    v.layout = (w, h) => {
      const inset = opts.frame ? 0.84 : 1.08; // the grid plane overfills so a tilt never shows an edge
      const pw = w * inset; const ph = h * (opts.frame ? 0.8 : 1.08);
      plane.scale.set(pw, ph, 1);
      const pa = pw / ph;
      if (aspect > pa) uniforms.uCover.value.set(pa / aspect, 1, (1 - pa / aspect) / 2, 0);
      else uniforms.uCover.value.set(1, aspect / pa, 0, (1 - aspect / pa) / 2);
      if (frame) {
        const t = Math.max(5, w * 0.012); const d = 10;
        const parts = frame.children;
        parts[0].scale.set(pw + t * 2, t, d); parts[0].position.set(0, ph / 2 + t / 2, 4);
        parts[1].scale.set(pw + t * 2, t, d); parts[1].position.set(0, -ph / 2 - t / 2, 4);
        parts[2].scale.set(t, ph, d); parts[2].position.set(-pw / 2 - t / 2, 0, 4);
        parts[3].scale.set(t, ph, d); parts[3].position.set(pw / 2 + t / 2, 0, 4);
      }
      // The featured card fades its image into the card: right edge (wide) or bottom (stacked).
      if (opts.fade) {
        if (w > h * 1.1) uniforms.uFadeDir.value.set(1, 0);
        else uniforms.uFadeDir.value.set(0, -1);
      }
    };
    const state = { rev: 0, hov: 0, mx: 0.5, my: 0.5, tx: 0, ty: 0 };
    v.update = (dt, now, r) => {
      if (!v.ready) return false;
      const tr = reduced ? 1 : (r.top < vh * 0.9 && r.bottom > vh * 0.05 ? 1 : 0);
      let th = 0; let tmx = state.mx; let tmy = state.my; let ttx = 0; let tty = 0;
      const focused = card.contains(document.activeElement) && document.activeElement !== document.body;
      if (!reduced) {
        if (pointer.fine) {
          const cr = card.getBoundingClientRect();
          if (inside(cr, pointer.x, pointer.y)) {
            th = 1;
            tmx = clamp((pointer.x - r.left) / r.width); tmy = clamp(1 - (pointer.y - r.top) / r.height);
            ttx = (tmx - 0.5) * 2; tty = (tmy - 0.5) * 2;
          }
        } else if (tilt.on) {
          ttx = tilt.x; tty = tilt.y; // tilt drives the same highlight on phones
        } else {
          // Touch: depth follows scroll position instead of a pointer.
          const p = clamp((vh - r.top) / (vh + r.height));
          tty = (0.5 - p) * 1.6;
        }
        if (focused && !th) { th = 1; tmx = 0.5; tmy = 0.5; }
      }
      if (reduced) Object.assign(state, { rev: 1, hov: 0, tx: 0, ty: 0 }); else {
        state.rev = damp(state.rev, tr, dt, 4); state.hov = damp(state.hov, th, dt, 8);
        state.mx = damp(state.mx, tmx, dt, 10); state.my = damp(state.my, tmy, dt, 10);
        state.tx = damp(state.tx, ttx, dt, 7); state.ty = damp(state.ty, tty, dt, 7);
      }
      uniforms.uReveal.value = state.rev; uniforms.uHover.value = state.hov * (opts.frame ? 0.6 : 1);
      uniforms.uMouse.value.set(state.mx, state.my);
      const base = opts.frame ? -0.14 : 0;
      if (opts.frame) v.lights.rim.position.set(state.tx * 1.4, 0.5 + state.ty * 0.7, 0.9);
      group.rotation.set(-state.ty * (opts.frame ? 0.06 : 0.05) + (1 - state.rev) * 0.12, base + state.tx * (opts.frame ? 0.1 : 0.06) + (opts.frame ? (1 - state.rev) * 0.25 : 0), 0);
      if (opts.frame) group.position.z = (1 - state.rev) * -60 + state.hov * 10;
      else { group.position.z = state.hov * 6; group.scale.setScalar(1 + (1 - state.rev) * 0.06); } // grid planes always cover their window
      return !settled(state.rev, tr) || !settled(state.hov, th) || !settled(state.mx, tmx) || !settled(state.my, tmy) ||
        !settled(state.tx, ttx) || !settled(state.ty, tty);
    };
    v.onShown = () => el.classList.add('is-gl');
    v.onHidden = () => el.classList.remove('is-gl');
  }

  /* Footer: the ribbon resolves into a small knot that catches a light ------ */
  function signatureView(el) {
    const v = baseView(el, 'signature');
    const g = new T.Group(); v.scene.add(g);
    let knot = null;
    v.layout = (w) => {
      if (knot) { g.remove(knot); knot.geometry.dispose(); }
      const s = w / 72 * 8.2;
      knot = new T.Mesh(ribbonGeometry(new Trefoil(s), {
        closed: true, segments: LITE ? 120 : 200, width: s * 0.75, thickness: s * 0.16, twist: (u) => u * Math.PI * 6
      }), porcelain);
      g.add(knot);
    };
    const state = { e: 0, sweep: 1, sweepStart: 0 };
    v.trigger = () => { if (!reduced) { state.sweep = 0; state.sweepStart = 0; requestRender(); } };
    v.update = (dt, now, r) => {
      const te = reduced ? 1 : smooth(enterOf(r, 1.0, 0.35));
      state.e = reduced ? 1 : damp(state.e, te, dt, 4);
      if (state.e > 0.6 && !state.entered) { state.entered = true; v.trigger(); }
      if (state.sweep < 1) {
        if (!state.sweepStart) state.sweepStart = now;
        state.sweep = clamp((now - state.sweepStart) / 900);
      }
      const a = -1.2 + easeOut(state.sweep) * 2.4;
      v.lights.rim.position.set(Math.sin(a) * 1.3, 0.6, Math.cos(a));
      v.lights.rim.intensity = 1.5 + Math.sin(state.sweep * Math.PI) * 2.2;
      g.rotation.set(0.35, (1 - state.e) * -1.4 + 0.3, 0);
      return !settled(state.e, te) || state.sweep < 1;
    };
    document.querySelectorAll('.site-footer a').forEach((a) => {
      a.addEventListener('pointerenter', v.trigger);
      a.addEventListener('focus', v.trigger);
    });
  }

  /* ---- Create views from the DOM ----------------------------------------- */
  document.querySelectorAll('[data-gl]').forEach((el) => {
    const k = el.getAttribute('data-gl');
    if (k === 'hero') heroView(el);
    else if (k === 'about') aboutView(el);
    else if (k === 'model') modelView(el, { model: el.getAttribute('data-model'), cardSel: '.cap, .awards__grid', scrollTurn: el.hasAttribute('data-scroll-turn'), fit: parseFloat(el.getAttribute('data-fit')) || 0.4, yaw: parseFloat(el.getAttribute('data-yaw')) || 0.55 });
    else if (k === 'rail') railView(el);
    else if (k === 'feature') mediaView(el, { kind: 'feature', cardSel: '.feature', frame: true, fade: true, bend: 120 });
    else if (k === 'media') mediaView(el, { kind: 'media', cardSel: '.project', bend: 70 });
    else if (k === 'signature') signatureView(el);
  });
  applyPalette();

  // Load project textures only when their window approaches the viewport.
  const nearIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const v = views.find((x) => x.el === en.target);
      if (v && v.near) v.near();
      nearIO.unobserve(en.target);
    });
  }, { rootMargin: '900px 0px' });
  views.forEach((v) => { if (v.near) nearIO.observe(v.el); });

  /* ---- Optional tilt effects (phones): permission from a button tap ------- */
  const tiltBtn = document.querySelector('[data-tilt-toggle]');
  const tiltStatus = document.querySelector('[data-tilt-status]');
  function tiltSay(msg) { if (tiltStatus) tiltStatus.textContent = msg; }
  function onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    tilt.got = true;
    const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    let x = e.gamma; let y = e.beta;
    if (angle === 90) { x = e.beta; y = -e.gamma; } else if (angle === -90 || angle === 270) { x = -e.beta; y = e.gamma; }
    if (!tilt.base) tilt.base = { x, y }; // relative to how the phone is held when enabled
    tilt.base.x += (x - tilt.base.x) * 0.006; tilt.base.y += (y - tilt.base.y) * 0.006; // slowly re-centre
    tilt.x = clamp((x - tilt.base.x) / 18, -1, 1);
    tilt.y = clamp((y - tilt.base.y) / 18, -1, 1);
    requestRender();
  }
  function setTiltUi(on) {
    if (!tiltBtn) return;
    tiltBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    tiltBtn.querySelector('span').textContent = on ? 'Tilt effects on' : 'Enable tilt effects';
  }
  function stopTilt() {
    window.removeEventListener('deviceorientation', onOrient);
    Object.assign(tilt, { on: false, got: false, x: 0, y: 0, base: null });
    setTiltUi(false); requestRender();
  }
  async function toggleTilt() {
    if (tilt.on) { stopTilt(); tiltSay(''); return; }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission(); // iOS: needs HTTPS and this tap
        if (res !== 'granted') { tiltSay('Motion access was not allowed. Scrolling still moves the light.'); return; }
      }
    } catch (err) { tiltSay('Tilt is not available here. Scrolling still moves the light.'); return; }
    window.addEventListener('deviceorientation', onOrient, { passive: true });
    tilt.on = true; setTiltUi(true); tiltSay('Tilt your phone to move the light.');
    setTimeout(() => { if (tilt.on && !tilt.got) { stopTilt(); tiltSay('No motion sensor found. Scrolling still moves the light.'); } }, 1600);
  }
  function syncTiltOffer() {
    if (!tiltBtn) return;
    const offer = 'DeviceOrientationEvent' in window && !fineMQ.matches && !reduceMQ.matches;
    tiltBtn.hidden = !offer;
    if (!offer && tilt.on) stopTilt();
  }
  if (tiltBtn) { tiltBtn.addEventListener('click', toggleTilt); syncTiltOffer(); }

  /* ---- Canvas size: viewport, capped density and pixel budget -------------- */
  let sized = '';
  function resize() {
    vw = canvas.clientWidth || window.innerWidth;
    vh = canvas.clientHeight || window.innerHeight;
    const cap = 2;
    const budget = LITE ? 2.2e6 : 4.4e6; // sharp on retina phones and laptops; windows are small
    const dpr = Math.min(window.devicePixelRatio || 1, cap, Math.sqrt(budget / Math.max(1, vw * vh)));
    const key = vw + 'x' + vh + '@' + dpr;
    if (key !== sized) { // the observer's first call repeats the initial size: keep what prime() built
      if (sized) views.forEach((v) => { v.w = 0; }); // re-fit on the next frame
      sized = key;
      renderer.setPixelRatio(dpr);
      renderer.setSize(vw, vh, false);
    }
    requestRender();
  }
  const canvasRO = new ResizeObserver(resize);
  canvasRO.observe(canvasHost);

  /* ---- Single render scheduler --------------------------------------------- */
  let raf = 0; let lastT = 0; let glShown = false; let anchoredAt = -1; let canvasEmpty = false;
  // Frame governor: when 3D frames cost more than ~7 ms of main thread (slow
  // phones and laptops), they are drawn every other display frame while the
  // page is scrolling. The canvas is anchored to the page, so a skipped frame
  // scrolls along with it; the page itself keeps the full frame rate.
  let cost = 0; let lastScrollT = 0; let tick = 0;
  function requestRender() {
    if (raf || document.hidden || contextLost) return;
    raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = 0;
    const every = cost > 14 ? 3 : cost > 7 ? 2 : 1; // over ~14 ms: every third frame
    if (every > 1 && now - lastScrollT < 150 && (++tick % every) !== 0) { raf = requestAnimationFrame(frame); return; }
    const t0 = performance.now();
    frameWork(now);
    cost += (performance.now() - t0 - cost) * 0.1;
  }
  function frameWork(now) {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 1 / 60;
    lastT = now;
    let moving = false;

    if (paletteT < 1) {
      paletteT = Math.min(1, paletteT + dt / 0.38);
      const k = smooth(paletteT);
      NAMES.forEach((n) => cur[n].lerpColors(from[n], to[n], k));
      applyPalette();
      moving = moving || paletteT < 1;
    }

    // The canvas is anchored to the page at the scroll offset it was drawn for
    // (not position: fixed), so when the compositor scrolls ahead of the next
    // frame, the last frame scrolls with the page instead of sticking on screen.
    // Near the bottom it stops at the end of the document (top = sy - off).
    const pr = window.devicePixelRatio || 1;
    const sy = Math.round(window.scrollY * pr) / pr; // whole device pixels: no resampling blur
    const top = Math.max(0, Math.min(sy, document.body.getBoundingClientRect().bottom + sy - vh));
    const off = sy - top;
    if (top !== anchoredAt) { anchoredAt = top; canvasHost.style.transform = 'translate3d(0,' + top + 'px,0)'; }
    let drawn = 0; let cleared = false;
    const clearOnce = () => {
      if (cleared) return; cleared = true;
      renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
    };
    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      if (v.disabled) continue;
      const r = v.el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < -off || r.top > vh - off || r.right < 0 || r.left > vw) continue;
      if (Math.abs(r.width - v.w) > 0.5 || Math.abs(r.height - v.h) > 0.5) v.fit(r.width, r.height);
      if (v.near && !v.ready) v.near();
      if (v.update(dt, now, r)) moving = true;
      if (!v.ready || v.skip) continue;
      let x0 = Math.max(0, r.left); let y0 = Math.max(-off, r.top);
      let x1 = Math.min(vw, r.right); let y1 = Math.min(vh - off, r.bottom);
      if (v.clipEl) {
        const c = v.clipEl.getBoundingClientRect();
        x0 = Math.max(x0, c.left); y0 = Math.max(y0, c.top); x1 = Math.min(x1, c.right); y1 = Math.min(y1, c.bottom);
      }
      if (x1 - x0 < 1 || y1 - y0 < 1) continue;
      const cam = v.camera;
      cam.aspect = r.width / r.height;
      cam.setViewOffset(r.width, r.height, x0 - r.left, y0 - r.top, x1 - x0, y1 - y0);
      if (v.beforeRender) v.beforeRender(r);
      clearOnce();
      renderer.setViewport(x0, vh - off - y1, x1 - x0, y1 - y0);
      renderer.setScissor(x0, vh - off - y1, x1 - x0, y1 - y0);
      renderer.render(v.scene, cam);
      drawn++;
      if (!v.shown) { v.shown = true; if (v.onShown) v.onShown(); else v.el.classList.add('is-gl'); }
    }
    // An empty canvas is still a full-screen layer the GPU blends every frame.
    const empty = drawn === 0;
    if (empty !== canvasEmpty) { if (empty) clearOnce(); canvasEmpty = empty; canvasHost.style.visibility = empty ? 'hidden' : ''; }
    if (!glShown) { glShown = true; root.classList.add('gl-ready'); root.dataset.gl = 'ready'; }
    if (moving && !reduced) requestRender();
    else lastT = 0;
  }

  /* ---- Inputs ------------------------------------------------------------- */
  const INTERACTIVE = '.masthead, .feature, .project, .cap';
  let pointerInside = false;
  function onPointerMove(e) {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    pointer.x = e.clientX; pointer.y = e.clientY;
    const now = !!(e.target.closest && e.target.closest(INTERACTIVE));
    if (now || pointerInside) requestRender(); // render once more on the way out so it eases back
    pointerInside = now;
  }
  function onPointerLeave() { pointer.x = -1e4; pointer.y = -1e4; requestRender(); }
  const onScroll = () => { lastScrollT = performance.now(); requestRender(); };
  const onFocus = () => requestRender();
  function onVisibility() {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; lastT = 0; } else requestRender();
  }
  function onReduce() { reduced = reduceMQ.matches; syncTiltOffer(); requestRender(); }
  function onFine() { pointer.fine = fineMQ.matches; syncTiltOffer(); }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  document.addEventListener('focusin', onFocus);
  document.addEventListener('focusout', onFocus);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('preloader:done', onFocus); // start the hero intro
  reduceMQ.addEventListener('change', onReduce);
  fineMQ.addEventListener('change', onFine);

  /* ---- Context loss: static DOM takes over; recover at most once ---------- */
  let contextLost = false; let restores = 0;
  function hideAll() {
    root.classList.remove('gl-ready');
    views.forEach((v) => { v.shown = false; if (v.onHidden) v.onHidden(); else v.el.classList.remove('is-gl'); });
    glShown = false;
  }
  function onLost(e) {
    e.preventDefault();
    contextLost = true;
    cancelAnimationFrame(raf); raf = 0;
    hideAll();
  }
  function onRestored() {
    contextLost = false;
    if (restores++ >= 1) { destroy(); root.dataset.gl = 'failed'; return; }
    envTex = makeEnvironment(); // render-target content does not survive a lost context
    MATERIALS.forEach((m) => { if ('envMap' in m && m.envMap !== undefined && m !== coreMat && m !== coreDecorMat) { m.envMap = envTex; m.needsUpdate = true; } });
    views.forEach((v) => { v.w = 0; });
    requestRender();
  }
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  /* ---- Teardown ------------------------------------------------------------ */
  function destroy() {
    cancelAnimationFrame(raf); raf = 0;
    hideAll();
    window.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    document.removeEventListener('focusin', onFocus);
    document.removeEventListener('focusout', onFocus);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('preloader:done', onFocus);
    reduceMQ.removeEventListener('change', onReduce);
    fineMQ.removeEventListener('change', onFine);
    themeObserver.disconnect();
    if (tilt.on) stopTilt();
    if (tiltBtn) { tiltBtn.removeEventListener('click', toggleTilt); tiltBtn.hidden = true; }
    nearIO.disconnect();
    canvasRO.disconnect();
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    views.forEach((v) => {
      if (v.cleanup) v.cleanup();
      v.scene.traverse((o) => {
        if (o.geometry && !Object.values(shared).includes(o.geometry)) o.geometry.dispose();
      });
    });
    Object.values(shared).forEach((g) => g.dispose());
    disposables.forEach((d) => d.dispose());
    MATERIALS.forEach((m) => m.dispose());
    if (envTex) envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
    canvas.remove();
    delete root.dataset.gl;
  }
  window.addEventListener('pagehide', (e) => { if (!e.persisted) destroy(); });

  resize();
  prime();

  /* ---- Warm-up: every window is built, compiled and uploaded before it is
     seen, one piece per task, so scrolling into a chapter never stalls. ---- */
  async function prime() {
    const t0 = performance.now();
    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      const r = v.el.getBoundingClientRect();
      if (!v.w && r.width >= 2 && r.height >= 2) v.fit(r.width, r.height); // ribbons and shards are built here
      announce('gl:progress', 0.16 + 0.34 * ((i + 1) / views.length));
      await pause();
    }
    // Desktop fetches every texture and model now; phones keep loading them
    // as their window approaches, to save data (each is still prepared first).
    if (!LITE) views.forEach((v) => { if (v.near) v.near(); });
    for (const v of views) if (v.ready) await prepare(v);
    const pending = (v) => !v.ready && !v.disabled && !(LITE && v.near);
    while (views.some(pending) && performance.now() - t0 < 8000) {
      announce('gl:progress', 0.5 + 0.5 * (views.filter((v) => !pending(v)).length / views.length));
      await new Promise((r) => setTimeout(r, 80));
    }
    announce('gl:progress', 1);
    announce('gl:primed');
    requestRender();
  }
}
