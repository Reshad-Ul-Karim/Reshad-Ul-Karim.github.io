/* =========================================================================
   demos/trace.js: step-through exhibit used by most project pages.

   The page supplies a JSON config:
     { "scenarios": [ { "label": "...", "result": "...",
                        "steps": [ { "label": "...", "detail": "...", "state": "ok" | "stop" } ] } ] }
   Each scenario is a short, authored walk through the project's documented
   pipeline. The 3D stage is a row of lit ceramic stations joined by a rail; a
   pulse travels to the active station, and a stopped scenario turns its
   station amber. The ordered list beside it is the readable version.
   ========================================================================= */
export function mount({ T, stage, panel, say, reducedMQ, config }) {
  const scenarios = (config && config.scenarios) || [];
  if (!scenarios.length) throw new Error('no scenarios');

  /* ---- Renderer, environment, lights ---------------------------------------- */
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.toneMapping = T.NeutralToneMapping;
  const canvas = renderer.domElement; canvas.setAttribute('aria-hidden', 'true');
  stage.querySelectorAll('.xp-poster, [data-xp-start]').forEach((el) => { el.hidden = true; });
  stage.appendChild(canvas);
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new T.RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  if (room.dispose) room.dispose();
  const camera = new T.PerspectiveCamera(32, 1.6, 0.1, 100);
  scene.add(new T.HemisphereLight('#ffffff', '#202325', 0.6));
  const key = new T.DirectionalLight('#ffffff', 1.4); key.position.set(-3, 5, 4); scene.add(key);
  const rim = new T.DirectionalLight('#8CF0D3', 1.6); rim.position.set(4, 2, -3); scene.add(rim);

  const css = () => getComputedStyle(document.documentElement);
  const colors = { accent: new T.Color(), hl: new T.Color(), decor: new T.Color(), base: new T.Color('#2a2d31') };
  function readColors() {
    const c = css();
    colors.accent.set(c.getPropertyValue('--primary').trim() || c.getPropertyValue('--primary-color').trim() || '#0B5D56');
    colors.hl.set(c.getPropertyValue('--hl').trim() || '#8CF0D3');
    colors.decor.set(c.getPropertyValue('--decor').trim() || '#D8B98B');
    rim.color.copy(colors.hl);
  }
  readColors();

  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };
  const puckGeo = keep(new T.CylinderGeometry(0.42, 0.46, 0.2, 48));
  const coreGeo = keep(new T.SphereGeometry(0.1, 24, 16));
  const baseMat = keep(new T.MeshPhysicalMaterial({ color: colors.base, roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const floor = new T.Mesh(keep(new T.PlaneGeometry(120, 120)), keep(new T.MeshStandardMaterial({ color: '#121316', roughness: 0.92 })));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.12; scene.add(floor);

  let stations = []; let rail = null; let pulse = null;
  const group = new T.Group(); scene.add(group);

  function build(sc) {
    stations.forEach((s) => { group.remove(s.mesh, s.core); s.mesh.material.dispose(); s.core.material.dispose(); });
    if (rail) { group.remove(rail); rail.geometry.dispose(); }
    stations = [];
    const n = sc.steps.length; const span = Math.min(7.2, 1.5 * (n - 1));
    const pts = [];
    sc.steps.forEach((st, i) => {
      const u = n === 1 ? 0.5 : i / (n - 1);
      const x = -span / 2 + u * span; const z = -Math.sin(u * Math.PI) * 0.9;
      const mesh = new T.Mesh(puckGeo, baseMat.clone()); mesh.position.set(x, 0, z); group.add(mesh);
      const core = new T.Mesh(coreGeo, new T.MeshBasicMaterial({ color: colors.hl, toneMapped: false, transparent: true, opacity: 0 }));
      core.position.set(x, 0.2, z); group.add(core);
      stations.push({ mesh, core, lit: 0, target: 0, stop: st.state === 'stop' });
      pts.push(new T.Vector3(x, 0.02, z));
    });
    if (pts.length > 1) {
      const curve = new T.CatmullRomCurve3(pts);
      const geo = new T.BufferGeometry().setFromPoints(curve.getPoints(120));
      rail = new T.LineSegments(geo, keep(new T.LineBasicMaterial({ color: colors.hl, transparent: true, opacity: 0.5 })));
      // LineSegments needs pairs: duplicate interior points
      const p = geo.attributes.position.array; const out = [];
      for (let i = 0; i < p.length / 3 - 1; i++) out.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], p[i * 3 + 3], p[i * 3 + 4], p[i * 3 + 5]);
      geo.setAttribute('position', new T.Float32BufferAttribute(out, 3));
      group.add(rail);
      rail.userData.curve = curve;
    }
    if (!pulse) { pulse = new T.Mesh(coreGeo, keep(new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }))); pulse.scale.setScalar(0.8); scene.add(pulse); }
    camera.position.set(0, 4.2, 5.6 + n * 0.25); camera.lookAt(0, -0.2, -0.6); // horizon stays above the frame
  }

  /* ---- UI ------------------------------------------------------------------------ */
  panel.innerHTML = `
    <div class="xp-group" role="group" aria-labelledby="xp-sc-l">
      <p class="xp-label" id="xp-sc-l">Scenario</p>
      <div class="xp-seg">${scenarios.map((s, i) => `<button type="button" data-sc="${i}" aria-pressed="${i === 0}">${s.label}</button>`).join('')}</div>
    </div>
    <div class="xp-actions">
      <button type="button" class="xp-btn" data-step>Step</button>
      <button type="button" class="xp-btn" data-run aria-pressed="false">Run</button>
      <button type="button" class="xp-btn xp-btn--ghost" data-reset>Reset</button>
    </div>
    <ol class="xp-steps" data-steps></ol>
    <p class="xp-explain" data-detail></p>`;
  const $ = (q) => panel.querySelector(q);
  const stepsEl = $('[data-steps]'); const detailEl = $('[data-detail]');
  const state = { sc: 0, i: -1, running: false, timer: 0, pulseU: 0, pulseTarget: 0 };

  function renderList() {
    const sc = scenarios[state.sc];
    stepsEl.innerHTML = sc.steps.map((st, i) => {
      const cls = i < state.i ? 'is-done' : i === state.i ? (st.state === 'stop' ? 'is-stop' : 'is-active') : '';
      return `<li class="${cls}"${i === state.i ? ' aria-current="step"' : ''}>${st.label}</li>`;
    }).join('');
    if (state.i < 0) detailEl.textContent = 'Choose Step or Run to walk through this scenario.';
    else {
      const st = sc.steps[state.i];
      detailEl.textContent = st.detail + (state.i === sc.steps.length - 1 || st.state === 'stop' ? ' ' + (sc.result || '') : '');
    }
  }
  function setScenario(k) {
    state.sc = k; state.i = -1; stopRun();
    panel.querySelectorAll('[data-sc]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.sc) === k)));
    build(scenarios[k]); renderList(); kick();
    say(`${scenarios[k].label}: ${scenarios[k].steps.length} steps.`);
  }
  function advance() {
    const sc = scenarios[state.sc];
    const last = state.i >= 0 && (sc.steps[state.i].state === 'stop' || state.i === sc.steps.length - 1);
    if (last) { stopRun(); return false; }
    state.i++;
    stations.forEach((s, i) => { s.target = i <= state.i ? 1 : 0; });
    state.pulseTarget = sc.steps.length === 1 ? 0 : state.i / (sc.steps.length - 1);
    renderList(); kick();
    const st = sc.steps[state.i];
    say(`Step ${state.i + 1} of ${sc.steps.length}: ${st.label}.${st.state === 'stop' ? ' The scenario stops here.' : ''}`);
    return true;
  }
  function stopRun() { state.running = false; clearInterval(state.timer); const b = $('[data-run]'); if (b) { b.setAttribute('aria-pressed', 'false'); b.textContent = 'Run'; } }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sc) setScenario(Number(b.dataset.sc));
    else if ('step' in b.dataset) { stopRun(); advance(); }
    else if ('run' in b.dataset) {
      if (state.running) { stopRun(); return; }
      state.running = true; b.setAttribute('aria-pressed', 'true'); b.textContent = 'Pause';
      if (!advance()) { setScenario(state.sc); advance(); }
      state.timer = setInterval(() => { if (!advance()) stopRun(); }, reducedMQ.matches ? 1600 : 1300);
    } else if ('reset' in b.dataset) { setScenario(state.sc); say('Reset to the start of the scenario.'); }
  });

  /* ---- Render loop (on demand) -------------------------------------------------- */
  let raf = 0; let W = 1; let H = 1; let last = 0; const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(t) {
    raf = 0; const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60; last = t;
    const k = reducedMQ.matches ? 1 : 1 - Math.exp(-dt * 6);
    let moving = false;
    const sc = scenarios[state.sc];
    stations.forEach((s, i) => {
      s.lit += (s.target - s.lit) * k; if (Math.abs(s.target - s.lit) > 0.002) moving = true;
      const isStop = s.stop && i === state.i;
      const col = isStop ? colors.decor : colors.hl;
      s.mesh.material.color.copy(colors.base).lerp(i === state.i ? (isStop ? colors.decor : colors.accent) : colors.base, s.lit * 0.9);
      s.mesh.position.y = s.lit * 0.12;
      s.core.material.color.copy(col); s.core.material.opacity = s.lit; s.core.position.y = 0.2 + s.lit * 0.12;
    });
    state.pulseU += (state.pulseTarget - state.pulseU) * k; if (Math.abs(state.pulseTarget - state.pulseU) > 0.001) moving = true;
    if (rail && pulse) { const p = rail.userData.curve.getPointAt(Math.max(0, Math.min(1, state.pulseU))); pulse.position.set(p.x, 0.18, p.z); pulse.visible = state.i >= 0; }
    mouse.x += (mouse.tx - mouse.x) * k; mouse.y += (mouse.ty - mouse.y) * k; if (Math.abs(mouse.tx - mouse.x) > 0.002) moving = true;
    group.rotation.y = mouse.x * 0.12; group.rotation.x = mouse.y * 0.05;
    renderer.render(scene, camera);
    if (moving && !reducedMQ.matches) kick(); else last = 0;
    void sc;
  }
  function onMove(e) {
    if (e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect();
    mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.ty = ((e.clientY - r.top) / r.height) * 2 - 1; kick();
  }
  function onLeave() { mouse.tx = 0; mouse.ty = 0; kick(); }
  stage.addEventListener('pointermove', onMove); stage.addEventListener('pointerleave', onLeave);

  function resize() {
    const b = stage.getBoundingClientRect(); W = Math.max(1, Math.round(b.width)); H = Math.max(1, Math.round(b.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix(); kick();
  }
  const ro = new ResizeObserver(resize); ro.observe(stage);
  const mo = new MutationObserver(() => { readColors(); kick(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'data-theme'] });

  setScenario(0);
  resize();
  return {
    destroy() {
      cancelAnimationFrame(raf); clearInterval(state.timer); ro.disconnect(); mo.disconnect();
      stage.removeEventListener('pointermove', onMove); stage.removeEventListener('pointerleave', onLeave);
      stations.forEach((s) => { s.mesh.material.dispose(); s.core.material.dispose(); });
      if (rail) rail.geometry.dispose();
      disposables.forEach((d) => d.dispose()); scene.environment.dispose(); pmrem.dispose(); renderer.dispose(); canvas.remove();
    }
  };
}
