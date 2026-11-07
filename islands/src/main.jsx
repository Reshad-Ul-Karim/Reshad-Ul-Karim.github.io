/* Homepage React islands (React Bits components).
   Each [data-island] placeholder in index.html holds static, working HTML;
   its component chunk loads only when needed and replaces or enhances it:
   - 'idle': after the page has loaded and gone idle (above the fold);
   - 'near': when the placeholder comes within ~600 px of the viewport;
   - 'visible': once a quarter of it is on screen (its intro is meant to be seen);
   - 'intent': on the first pointer, touch or scroll near it: until then it
     looks exactly like its static text, so its set-up cost waits for a reader.
   Islands that change their section's height mount at 'idle', before the
   reader scrolls, so anchors never move under a smooth scroll.
   An island whose allow() fails (device, preferences) keeps its static HTML. */
import { media } from './media.js';

const ISLANDS = {
  'gooey-nav': { when: 'idle', allow: () => media.desktop(), load: () => import('./islands/NavIsland.jsx') },
  'tech-text': { when: 'intent', load: () => import('./islands/NameIsland.jsx') },
  scanner: { when: 'idle', allow: () => !media.saveData(), load: () => import('./islands/ScannerIsland.jsx') },
  'splash-cursor': { when: 'idle', allow: () => media.fine() && !media.reduced() && !media.lite() && !media.saveData(), load: () => import('./islands/CursorIsland.jsx') },
  'profile-card': { when: 'visible', load: () => import('./islands/ProfileIsland.jsx') },
  'card-swap': { when: 'idle', load: () => import('./islands/ProjectsIsland.jsx') },
  'flying-button': { when: 'near', load: () => import('./islands/AssistantButtonIsland.jsx') }
};

// React itself loads with the first island, never during page load.
let runtime = null;
const react = () => (runtime ||= Promise.all([import('react'), import('react-dom/client')]));

// Mounting is queued: one island renders per idle slice, so several islands
// never add up to one long main-thread task.
const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
const queue = [];
let draining = false;
function drain() {
  const next = queue.shift();
  if (!next) { draining = false; return; }
  next();
  idle(drain, { timeout: 1000 });
}
function enqueue(job) {
  queue.push(job);
  if (!draining) { draining = true; idle(drain, { timeout: 1000 }); }
}

function mount(el, spec) {
  if (el.__island) return;
  el.__island = true;
  Promise.all([react(), spec.load()]).then(([[{ createElement }, { createRoot }], { default: Island }]) => enqueue(() => {
    createRoot(el).render(createElement(Island, { host: el }));
    el.setAttribute('data-island-ready', '');
  })).catch((err) => {
    el.__island = false;
    console.warn('[islands]', el.getAttribute('data-island'), err);
  });
}

function onIntent(el, go) {
  const area = el.closest('section') || el;
  const events = ['pointerover', 'touchstart', 'focusin'];
  const fire = () => { events.forEach((t) => area.removeEventListener(t, fire)); removeEventListener('scroll', fire); go(); };
  events.forEach((t) => area.addEventListener(t, fire, { passive: true, once: true }));
  addEventListener('scroll', fire, { passive: true, once: true });
}

function start() {
  const near = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        near.unobserve(e.target);
        mount(e.target, ISLANDS[e.target.getAttribute('data-island')]);
      });
    }, { rootMargin: '600px 0px' })
    : null;
  const seen = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        seen.unobserve(e.target);
        mount(e.target, ISLANDS[e.target.getAttribute('data-island')]);
      });
    }, { threshold: 0.25 })
    : null;
  document.querySelectorAll('[data-island]').forEach((el) => {
    const spec = ISLANDS[el.getAttribute('data-island')];
    if (!spec || (spec.allow && !spec.allow())) return;
    if (spec.when === 'near' && near) near.observe(el);
    else if (spec.when === 'visible' && seen) seen.observe(el);
    else if (spec.when === 'intent') onIntent(el, () => mount(el, spec));
    else mount(el, spec);
  });
}

if (document.readyState === 'complete') idle(start, { timeout: 2000 });
else addEventListener('load', () => idle(start, { timeout: 2000 }), { once: true });
