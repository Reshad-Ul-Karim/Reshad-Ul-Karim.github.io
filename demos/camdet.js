/* =========================================================================
   demos/camdet.js: "Same scene, different camera" (Geometry simulation).

   One vehicle at a fixed distance, two cameras at the same pose with
   different focal lengths. The overview shows both frustums; the inset shows
   what the selected camera sees. The 2D box is projected from the vehicle's
   3D box every frame, so switching cameras visibly changes its pixel size
   while metric depth and object size stay fixed.

   Every number comes from the displayed geometry. None of it is CAMDet
   model output; the page says so next to the readout.
   ========================================================================= */
const IMG_W = 1280; const IMG_H = 800; // nominal sensor image for the pixel readout
const SENSOR_H = 24; // mm, full-frame height: vertical FOV = 2 * atan(12 / f)
const CAMS = { A: { f: 24, label: 'Camera A' }, B: { f: 50, label: 'Camera B' } };
const CAR = { x: 0, z: -12, len: 4.4, wid: 1.8, hgt: 1.5 };
const CAM_POS = [0, 1.5, 0];

const fovFor = (f) => (2 * Math.atan(SENSOR_H / 2 / f) * 180) / Math.PI;

export function mount({ T, stage, panel, say, reducedMQ }) {
  /* ---- Renderer + DOM layers ---------------------------------------------- */
  const renderer = new T.WebGLRenderer({ antialias: true }); // throws without WebGL 2 -> shell fallback
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  stage.querySelectorAll('.xp-poster, [data-xp-start]').forEach((el) => { el.hidden = true; });
  stage.appendChild(canvas);
  const inset = document.createElement('div');
  inset.className = 'xp-inset';
  inset.setAttribute('aria-hidden', 'true');
  inset.innerHTML = '<span class="xp-inset-label"></span><span class="xp-box2d"><span class="xp-depth"></span></span>';
  stage.appendChild(inset);
  const insetLabel = inset.querySelector('.xp-inset-label');
  const box2d = inset.querySelector('.xp-box2d');
  const depthTag = inset.querySelector('.xp-depth');

  /* ---- Scene ---------------------------------------------------------------- */
  const scene = new T.Scene();
  const css = () => getComputedStyle(document.documentElement);
  const accent = new T.Color(); const stageBg = new T.Color('#122121');
  const readAccent = () => accent.set(css().getPropertyValue('--primary-color').trim() || '#0B5D56');
  readAccent();
  scene.background = stageBg;
  scene.add(new T.HemisphereLight('#dfe9e6', '#1a2322', 0.9));
  const sun = new T.DirectionalLight('#ffffff', 1.6); sun.position.set(-6, 10, 6); scene.add(sun);

  const disposables = [];
  const std = (o) => { const m = new T.MeshStandardMaterial(o); disposables.push(m); return m; };
  const box = (w, h, d, mat, x, y, z) => {
    const g = new T.BoxGeometry(w, h, d); disposables.push(g);
    const m = new T.Mesh(g, mat); m.position.set(x, y, z); scene.add(m); return m;
  };
  box(60, 0.02, 80, std({ color: '#33403e', roughness: 1 }), 0, -0.01, -20); // ground
  box(7, 0.02, 80, std({ color: '#1c2525', roughness: 0.9 }), 0, 0.0, -20); // road
  const dash = std({ color: '#cfd8d5', roughness: 0.6 });
  for (let z = -2; z > -40; z -= 4) box(0.14, 0.03, 1.8, dash, 0, 0.01, z);
  [-3.4, 3.4].forEach((x) => box(0.12, 0.03, 80, dash, x, 0.01, -20));

  // The vehicle (simple original geometry) in the accent colour.
  const paint = std({ color: accent, metalness: 0.35, roughness: 0.35, emissive: '#000000' });
  const glassMat = std({ color: '#0e1515', metalness: 0.2, roughness: 0.15 });
  const tyre = std({ color: '#111111', roughness: 0.8 });
  const car = new T.Group(); car.position.set(CAR.x, 0, CAR.z); scene.add(car);
  const add = (geo, mat, x, y, z, rz = 0) => { disposables.push(geo); const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; car.add(m); return m; };
  add(new T.BoxGeometry(CAR.wid, 0.7, CAR.len), paint, 0, 0.6, 0);
  add(new T.BoxGeometry(CAR.wid * 0.88, 0.62, CAR.len * 0.5), glassMat, 0, 1.2, 0.15);
  const wheel = new T.CylinderGeometry(0.36, 0.36, 0.26, 20);
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => add(wheel, tyre, sx * (CAR.wid / 2), 0.36, sz * CAR.len * 0.32, Math.PI / 2));

  // 3D box around the vehicle (the detector's 3D output, here exact geometry).
  const boxGeo = new T.EdgesGeometry(new T.BoxGeometry(CAR.wid + 0.1, CAR.hgt + 0.05, CAR.len + 0.1));
  const lineMat = new T.LineBasicMaterial({ color: '#8CF0D3' });
  disposables.push(boxGeo, lineMat);
  const box3d = new T.LineSegments(boxGeo, lineMat);
  box3d.position.set(CAR.x, (CAR.hgt + 0.05) / 2, CAR.z);
  scene.add(box3d);
  const corners = [];
  for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) {
    corners.push(new T.Vector3(CAR.x + sx * (CAR.wid + 0.1) / 2, sy * (CAR.hgt + 0.05), CAR.z + sz * (CAR.len + 0.1) / 2));
  }

  // Two cameras, same pose, different focal lengths.
  const target = new T.Vector3(CAR.x, 0.9, CAR.z);
  const cams = {};
  Object.keys(CAMS).forEach((k) => {
    const c = new T.PerspectiveCamera(fovFor(CAMS[k].f), IMG_W / IMG_H, 0.1, 200);
    c.position.set(...CAM_POS); c.lookAt(target); c.updateMatrixWorld(); c.updateProjectionMatrix();
    cams[k] = c;
  });
  box(0.5, 0.32, 0.36, std({ color: '#d9d4ca', roughness: 0.4 }), CAM_POS[0], CAM_POS[1], CAM_POS[2] + 0.2); // rig

  // Frustum outlines to 16 m.
  const frustumMats = {};
  const frustums = {};
  Object.keys(cams).forEach((k) => {
    const c = cams[k].clone(); c.far = 16; c.updateProjectionMatrix(); c.updateMatrixWorld();
    const o = new T.Vector3(...CAM_POS);
    const far = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new T.Vector3(x, y, 1).unproject(c));
    const pts = [];
    far.forEach((p, i) => { pts.push(o, p, p, far[(i + 1) % 4]); });
    const g = new T.BufferGeometry().setFromPoints(pts);
    const m = new T.LineBasicMaterial({ color: '#8CF0D3', transparent: true, opacity: 0.35 });
    disposables.push(g, m);
    frustums[k] = new T.LineSegments(g, m); frustumMats[k] = m; scene.add(frustums[k]);
  });
  // Depth: camera to object centre along the optical axis.
  const depthGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(...CAM_POS), new T.Vector3(CAR.x, 0.9, CAR.z)]);
  const depthMat = new T.LineBasicMaterial({ color: '#D8B98B' });
  disposables.push(depthGeo, depthMat);
  const depthLine = new T.LineSegments(depthGeo, depthMat); scene.add(depthLine);

  const overview = new T.PerspectiveCamera(38, 1.6, 0.1, 400);
  overview.position.set(11, 7.5, 4.5); overview.lookAt(0, 1, -7);
  const view = new T.PerspectiveCamera(fovFor(CAMS.A.f), IMG_W / IMG_H, 0.1, 200);

  /* ---- State + controls (HTML is the readable version of the scene) -------- */
  const state = { cam: 'A', fov: fovFor(CAMS.A.f), show: { box2d: true, depth: true, box3d: true }, linked: false };
  const depthM = new T.Vector3(...CAM_POS).distanceTo(new T.Vector3(CAR.x, 0.9, CAR.z));
  panel.innerHTML = `
    <div class="xp-group" role="group" aria-labelledby="xp-cam-l">
      <p class="xp-label" id="xp-cam-l">Camera</p>
      <div class="xp-seg">
        <button type="button" data-cam="A" aria-pressed="true">A · 24 mm</button>
        <button type="button" data-cam="B" aria-pressed="false">B · 50 mm</button>
      </div>
    </div>
    <div class="xp-group" role="group" aria-labelledby="xp-show-l">
      <p class="xp-label" id="xp-show-l">Show</p>
      <div class="xp-seg">
        <button type="button" data-show="box2d" aria-pressed="true">2D box</button>
        <button type="button" data-show="depth" aria-pressed="true">Depth</button>
        <button type="button" data-show="box3d" aria-pressed="true">3D box</button>
      </div>
    </div>
    <div class="xp-actions">
      <button type="button" class="xp-btn" data-link aria-pressed="false">Select the vehicle</button>
      <button type="button" class="xp-btn xp-btn--ghost" data-reset>Reset</button>
    </div>
    <dl class="xp-readout">
      <div><dt>Focal length</dt><dd data-r="f"></dd></div>
      <div><dt>Box in the image</dt><dd data-r="px"></dd></div>
      <div><dt>Metric depth</dt><dd data-r="depth"></dd></div>
      <div><dt>Object size</dt><dd>${CAR.len} × ${CAR.wid} × ${CAR.hgt} m · unchanged</dd></div>
    </dl>
    <p class="xp-explain">Same car, same distance, different pixels. A detector tuned to one lens learns the wrong link between how big something looks and how far away it is. CAMDet conditions on the camera's intrinsics so one model holds up across both.</p>`;
  const $ = (sel) => panel.querySelector(sel);

  function setCam(k) {
    state.cam = k;
    panel.querySelectorAll('[data-cam]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cam === k)));
    animateFov(fovFor(CAMS[k].f));
  }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cam) setCam(b.dataset.cam);
    else if (b.dataset.show) {
      const k = b.dataset.show; state.show[k] = !state.show[k];
      b.setAttribute('aria-pressed', String(state.show[k])); render();
    } else if ('link' in b.dataset) {
      state.linked = !state.linked; b.setAttribute('aria-pressed', String(state.linked)); render();
    } else if ('reset' in b.dataset) {
      Object.assign(state.show, { box2d: true, depth: true, box3d: true }); state.linked = false;
      panel.querySelectorAll('[data-show]').forEach((x) => x.setAttribute('aria-pressed', 'true'));
      $('[data-link]').setAttribute('aria-pressed', 'false');
      setCam('A'); say('Reset to Camera A with every view on.');
    }
  });

  let anim = 0;
  function animateFov(to) {
    cancelAnimationFrame(anim);
    if (reducedMQ.matches) { state.fov = to; render(); return; }
    const from = state.fov; const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 380); const e = 1 - Math.pow(1 - k, 3);
      state.fov = from + (to - from) * e; render();
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  /* ---- Projection: the 2D box comes from the 3D box, every frame ----------- */
  const v = new T.Vector3();
  function project() {
    view.fov = state.fov; view.position.set(...CAM_POS); view.lookAt(target);
    view.updateProjectionMatrix(); view.updateMatrixWorld();
    let x0 = 1; let y0 = 1; let x1 = -1; let y1 = -1;
    corners.forEach((c) => { v.copy(c).project(view); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); });
    return { x0, y0, x1, y1, w: ((x1 - x0) / 2) * IMG_W, h: ((y1 - y0) / 2) * IMG_H };
  }

  /* ---- Render (on demand) -------------------------------------------------- */
  let W = 1; let H = 1; let lastPx = 0;
  function layoutInset() {
    const narrow = W < 560;
    const iw = Math.round(narrow ? W * 0.62 : Math.min(W * 0.44, 440)); const ih = Math.round(iw / (IMG_W / IMG_H));
    return { x: W - iw - 12, y: H - ih - 12, w: iw, h: ih };
  }
  function render() {
    const p = project();
    const r = layoutInset();
    const linked = state.linked;
    paint.emissive.set(linked ? accent : '#000000'); paint.emissiveIntensity = linked ? 0.35 : 0;
    box3d.visible = state.show.box3d; depthLine.visible = state.show.depth;
    lineMat.linewidth = 1;
    Object.keys(frustumMats).forEach((k) => { frustumMats[k].opacity = k === state.cam ? 0.95 : 0.22; });
    // overview
    renderer.setScissorTest(true);
    overview.aspect = W / H; overview.updateProjectionMatrix();
    renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H);
    renderer.render(scene, overview);
    // inset: what the selected camera sees
    const fr = frustums.A.visible; frustums.A.visible = false; frustums.B.visible = false;
    renderer.setViewport(r.x, 12, r.w, r.h); renderer.setScissor(r.x, 12, r.w, r.h);
    renderer.render(scene, view);
    frustums.A.visible = fr; frustums.B.visible = fr;
    renderer.setScissorTest(false);
    // DOM overlays (crisp labels; hidden from assistive tech, the readout carries the values)
    Object.assign(inset.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    inset.classList.toggle('is-linked', linked);
    insetLabel.textContent = CAMS[state.cam].label + ' view';
    box2d.hidden = !state.show.box2d;
    Object.assign(box2d.style, {
      left: ((p.x0 + 1) / 2) * r.w + 'px', top: ((1 - p.y1) / 2) * r.h + 'px',
      width: ((p.x1 - p.x0) / 2) * r.w + 'px', height: ((p.y1 - p.y0) / 2) * r.h + 'px'
    });
    depthTag.hidden = !state.show.depth;
    depthTag.textContent = depthM.toFixed(1) + ' m';
    // readout
    const f = CAMS[state.cam].f;
    $('[data-r="f"]').textContent = `${f} mm · vertical field of view ${Math.round(fovFor(f))}°`;
    $('[data-r="px"]').textContent = `${Math.round(p.w)} × ${Math.round(p.h)} px of ${IMG_W} × ${IMG_H}`;
    $('[data-r="depth"]').textContent = `${depthM.toFixed(1)} m · unchanged`;
    const px = Math.round(p.w * p.h);
    if (lastPx && Math.abs(px - lastPx) > 50 && Math.abs(state.fov - fovFor(f)) < 0.01) {
      const ratio = px > lastPx ? px / lastPx : lastPx / px;
      say(`${CAMS[state.cam].label}: the car covers ${ratio.toFixed(1)}× ${px > lastPx ? 'more' : 'less'} of the image. Depth is still ${depthM.toFixed(1)} m.`);
    }
    if (Math.abs(state.fov - fovFor(f)) < 0.01) lastPx = px;
  }

  function resize() {
    const b = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(b.width)); H = Math.max(1, Math.round(b.height));
    const coarse = !window.matchMedia('(pointer: fine)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5));
    renderer.setSize(W, H, false);
    render();
  }
  const ro = new ResizeObserver(resize); ro.observe(stage);

  // Follow the site's colour widget (html[data-accent]) and theme.
  const mo = new MutationObserver(() => { readAccent(); paint.color.copy(accent); render(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'data-theme'] });

  resize();
  say('Camera A is selected. Switch to Camera B and watch the 2D box grow while depth stays the same.');

  return {
    destroy() {
      cancelAnimationFrame(anim); ro.disconnect(); mo.disconnect();
      disposables.forEach((d) => d.dispose()); renderer.dispose(); canvas.remove(); inset.remove();
    }
  };
}
