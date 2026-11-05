/* =========================================================================
   demo-pane.js: shared shell for the interactive project exhibits.

   Markup contract (see projects/camdet.html):
     <section class="xp" id="interactive-demo" data-demo="camdet">
       <div class="xp-stage" data-xp-stage> poster <img> + [data-xp-start] </div>
       <div class="xp-panel" data-xp-panel hidden></div>
       <p class="xp-status" data-xp-status role="status"></p>
     </section>

   The poster and project text render immediately. "Explore demo" lazy-loads
   the shared Three.js bundle and demos/<name>.js, which exports
   mount({ T, stage, panel, say, reduced }) and returns { destroy }.
   One exhibit is active at a time; the colour widget and chat stay untouched.
   ========================================================================= */
const ROOT = new URL('./', import.meta.url).href;

function init(section) {
  const name = section.getAttribute('data-demo');
  const stage = section.querySelector('[data-xp-stage]');
  const panel = section.querySelector('[data-xp-panel]');
  const start = section.querySelector('[data-xp-start]');
  const statusEl = section.querySelector('[data-xp-status]');
  if (!name || !stage || !panel || !start) return;
  const say = (msg) => { if (statusEl) statusEl.textContent = msg; };
  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  let instance = null;

  start.addEventListener('click', async () => {
    if (instance) return;
    start.disabled = true;
    section.dataset.state = 'loading';
    say('Loading the demo…');
    try {
      const [T, mod] = await Promise.all([
        import(ROOT + 'assets/vendor/three-home.min.js'),
        import(ROOT + 'demos/' + encodeURIComponent(name) + '.js')
      ]);
      instance = mod.mount({ T, stage, panel, say, reducedMQ });
      section.dataset.state = 'ready';
      panel.hidden = false;
      const first = panel.querySelector('button, select, input');
      if (first) first.focus({ preventScroll: true });
    } catch (err) {
      section.dataset.state = 'unavailable';
      start.disabled = false;
      say('This demo could not start here (it needs WebGL 2). The project write-up below covers the same idea.');
    }
  });

  window.addEventListener('pagehide', (e) => {
    if (!e.persisted && instance && instance.destroy) instance.destroy();
  });
}

document.querySelectorAll('.xp[data-demo]').forEach(init);
