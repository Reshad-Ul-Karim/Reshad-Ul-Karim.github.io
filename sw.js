/* =========================================================================
   sw.js: one-time loading. The first visit fills the cache; later visits and
   page-to-page navigation are served locally.

   - Pages (HTML): network first, so new deploys show at once; the cached copy
     is used when the network is slow (>3 s) or offline.
   - Versioned files (?v=...), vendor libraries and CDN fonts/icons: cache
     first. A new version is a new URL, so these never go stale.
   - Unversioned same-origin images, scripts and styles: served from cache,
     refreshed in the background (stale-while-revalidate).
   - Data (/data/*.json, citations.json), PDFs, the chat API and anything
     else cross-origin pass straight through.
   - After the first page has loaded and gone idle, the page asks for a warm-up:
     the projects and publications indexes and every stylesheet and script they
     reference are cached, so opening them later needs almost no network.
   Bump VERSION to drop every cache on the next visit.
   ========================================================================= */
const VERSION = 'v1';
const PAGES = 'pages-' + VERSION;
const STATIC = 'static-' + VERSION;
const IMAGES = 'images-' + VERSION;
const MAX_IMAGES = 80;
const WARM_PAGES = ['/', '/projects/', '/publications/'];
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [PAGES, STATIC, IMAGES];
    for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'warm') event.waitUntil(warm());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (CDN_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  if (req.mode === 'navigate') { event.respondWith(page(req)); return; }
  const path = url.pathname;
  if (path.startsWith('/data/') || path.endsWith('.json') || path.endsWith('.pdf') || path === '/sw.js') return;
  if (url.searchParams.has('v') || path.startsWith('/assets/vendor/')) { event.respondWith(cacheFirst(req, STATIC)); return; }
  if (req.destination === 'image') { event.respondWith(staleWhileRevalidate(req, IMAGES, event)); return; }
  if (req.destination === 'style' || req.destination === 'script' || req.destination === 'font') {
    event.respondWith(staleWhileRevalidate(req, STATIC, event));
  }
});

async function page(req) {
  const cache = await caches.open(PAGES);
  const network = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
    return (await cache.match(req, { ignoreSearch: true })) || network;
  } catch (e) {
    return (await cache.match(req, { ignoreSearch: true })) ||
      (await cache.match('/404.html')) ||
      new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, name, event) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const update = fetch(req).then(async (res) => {
    if (res.ok) {
      await cache.put(req, res.clone());
      if (name === IMAGES) await trim(cache, MAX_IMAGES);
    }
    return res;
  });
  if (hit) {
    event.waitUntil(update.catch(() => {}));
    return hit;
  }
  return update;
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function warm() {
  const pages = await caches.open(PAGES);
  const statics = await caches.open(STATIC);
  for (const path of WARM_PAGES) {
    try {
      const res = await fetch(path, { credentials: 'same-origin' });
      if (!res.ok) continue;
      const html = await res.clone().text();
      await pages.put(path, res);
      const base = new URL(path, self.location.origin);
      const refs = new Set();
      const re = /<(?:link[^>]+href|script[^>]+src)="([^"]+\.(?:css|js)(?:\?[^"]*)?)"/g;
      let m;
      while ((m = re.exec(html))) {
        const u = new URL(m[1], base);
        if (u.origin === self.location.origin || CDN_HOSTS.includes(u.hostname)) refs.add(u.href);
      }
      for (const href of refs) {
        if (await statics.match(href)) continue;
        try {
          const cross = new URL(href).origin !== self.location.origin;
          const r = await fetch(href, cross ? { mode: 'no-cors' } : {});
          if (r.ok || r.type === 'opaque') await statics.put(href, r);
        } catch (e) { /* skip one file, keep warming the rest */ }
      }
    } catch (e) { /* offline or blocked: try again on a later visit */ }
  }
}
