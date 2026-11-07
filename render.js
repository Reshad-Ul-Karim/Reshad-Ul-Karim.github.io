/* =========================================================================
   render.js  —  INDEX-page JSON renderer for the multi-page build.
   Owner: Foundation/render. Plan refs: MULTIPAGE_PLAN.md §3d, §6.

   WHAT IT DOES
   ------------
   Runs ONLY on the two JSON-driven index pages (projects/index.html and
   publications/index.html). It:
     1. Locates its own data directory from its <script> URL (rename-proof,
        works on file:// and under /MyWebsite/).
     2. Fetches ../data/taxonomy.json plus the relevant collection file
        (projects.json OR publications.json), chosen by which container the
        page exposes.
     3. Renders the SAME .project-card / .publication-item markup the single-
        pager uses, so the existing CSS styles it for free.
     4. Owns ALL of its own interactions — the projects explorer (search,
        area filter, views, URL state), its own IntersectionObserver reveal
        for publications, and its own YouTube/PDF modal wiring — because
        render.js injects cards
        ASYNCHRONOUSLY, AFTER the shared modules (projects-motion.js /
        reveal-motion.js / script.js) have already scanned the DOM at boot.
        Never rely on those boot-time scans (see plan §6).

   CONTAINERS IT LOOKS FOR (either explicit data-attr or the plan's ids):
     • projects      -> [data-render="projects"]      or  #domain-groups
     • publications  -> [data-render="publications"]  or  #publication-groups
     • filter mount  -> [data-render="project-filters"] or #project-filters
                        (optional; if absent, the bar is inserted before the grid)

   detailStatus gate: only "ready" items get a real detail link (<slug>.html,
   a sibling of the index page). Anything else ("stub" / "coming-soon") renders
   a muted "Coming soon" badge and NEVER a dead link.
   ========================================================================= */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     0. Self-locating data base — derived from this script's own URL.
     Captured synchronously at parse so document.currentScript is valid even
     when the tag is not deferred; falls back to a tag-scan (deferred case)
     and finally to a baseURI-relative guess.
     --------------------------------------------------------------------- */
  var SCRIPT_BASE = (function () {
    var cs = document.currentScript;
    if (cs && cs.src) return cs.src.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
    var tags = document.getElementsByTagName('script');
    for (var i = tags.length - 1; i >= 0; i--) {
      if (tags[i].src && /render\.js/.test(tags[i].src)) {
        return tags[i].src.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
      }
    }
    try { return new URL('../', document.baseURI).href; } catch (e) { return '../'; }
  })();

  function dataURL(name) { return SCRIPT_BASE + 'data/' + name; }

  // Resolve a repo-relative asset path (e.g. "assets/papers/x.pdf") against the
  // site root so it works from a subfolder page (/projects/, /publications/).
  // Absolute URLs / data: / anchors / root-absolute paths pass through untouched.
  function asset(p) {
    if (!p) return p;
    if (/^(https?:|data:|mailto:|tel:|#|\/\/|\/)/i.test(p)) return p;
    return SCRIPT_BASE + p;
  }

  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ----------------------------------------------------------------------
     1. Tiny helpers
     --------------------------------------------------------------------- */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // Escape a string for safe insertion into an HTML attribute / text node.
  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Author-supplied rich text (descriptions/contributions) is trusted HTML.
  function raw(s) { return s == null ? '' : String(s); }

  function unwrap(data, keys) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      for (var i = 0; i < keys.length; i++) {
        if (Array.isArray(data[keys[i]])) return data[keys[i]];
      }
    }
    return [];
  }

  function getJSON(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.json();
    });
  }

  function isReady(item) { return item && item.detailStatus === 'ready'; }

  // Detail pages are siblings of the index page → link is just "<slug>.html".
  function detailHref(slug) { return encodeURIComponent(slug) + '.html'; }

  /* ----------------------------------------------------------------------
     2. Shared interaction wiring (self-contained; immune to boot race)
     --------------------------------------------------------------------- */

  // Open the shell-injected YouTube modal directly (mirrors script.js logic)
  // so injected previews/buttons work without depending on boot-time binding.
  function openYouTube(videoId, startTime) {
    var modal = document.getElementById('youtube-modal');
    var iframe = document.getElementById('youtube-iframe');
    if (!modal || !iframe || !videoId) return;
    iframe.src = 'https://www.youtube.com/embed/' + encodeURIComponent(videoId) +
      '?autoplay=1&start=' + (parseInt(startTime, 10) || 0) + '&rel=0&modestbranding=1';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    iframe.style.opacity = '0';
    iframe.onload = function () { iframe.style.opacity = '1'; };
  }

  // One delegated click handler per injected container covers every YouTube
  // trigger we emit (.youtube-modal-btn, .youtube-preview, .media-preview).
  function wireYouTube(container) {
    container.addEventListener('click', function (e) {
      var t = e.target.closest('.youtube-modal-btn, .youtube-preview, .media-preview');
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      openYouTube(t.getAttribute('data-video-id'), t.getAttribute('data-start-time'));
    });
  }

  // PDF buttons are wired by script.js's globally-exposed re-scanner.
  function wirePDF() {
    if (typeof window.initPDFButtons === 'function') window.initPDFButtons();
  }

  // Own reveal: add .mp-in as elements enter view. Reduced-motion / no-IO =>
  // reveal immediately. A backstop timer guarantees nothing stays hidden.
  function revealAll(els) {
    for (var i = 0; i < els.length; i++) els[i].classList.add('mp-in');
  }
  function observeReveal(els) {
    if (!els.length) return;
    if (REDUCED || !('IntersectionObserver' in window)) { revealAll(els); return; }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('mp-in');
          obs.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
    // Absolute backstop — reveal any stragglers after 2s.
    setTimeout(function () { revealAll(els); }, 2000);
  }

  /* ----------------------------------------------------------------------
     3. PROJECTS index: search, area filter, featured row, grid or by-area view
     ----------------------------------------------------------------------
     State lives in the URL (?q=&area=&view=): choosing an area or a view adds
     a history entry, typing replaces it, so Back steps through filters.
     Counts are unique projects. A project can sit in several areas, so area
     counts add up to more than the total (the toolbar says so). The default
     view shows the flagship projects once, in "Featured", and every other
     project once in the grid below; any search or filter shows one flat list.
     --------------------------------------------------------------------- */
  function initProjects(container) {
    Promise.all([
      getJSON(dataURL('taxonomy.json')),
      getJSON(dataURL('projects.json'))
    ]).then(function (res) {
      var taxonomy = (res[0] && res[0].domains) || {};
      var projects = unwrap(res[1], ['projects', 'items', 'data']);
      renderProjects(container, taxonomy, projects);
    }).catch(function (err) {
      console.error('[render.js] projects render failed:', err);
      container.setAttribute('data-render-error', '1');
    });
  }

  // Deterministic ordering — domains by taxonomy.order.
  function domainOrder(taxonomy) {
    return Object.keys(taxonomy).sort(function (a, b) {
      return (taxonomy[a].order || 99) - (taxonomy[b].order || 99);
    });
  }

  // Flagship desc -> weight desc -> date desc -> title.
  function sortProjects(list) {
    return list.slice().sort(function (a, b) {
      var fa = a.flagship ? 1 : 0, fb = b.flagship ? 1 : 0;
      if (fb - fa) return fb - fa;
      var wa = a.weight || 0, wb = b.weight || 0;
      if (wb - wa) return wb - wa;
      var da = a.date || '', db = b.date || '';
      if (da !== db) return db < da ? -1 : 1;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }

  function stripTags(s) { return String(s || '').replace(/<[^>]*>/g, ''); }
  function areaLabel(taxonomy, id) { return (taxonomy[id] && taxonomy[id].label) || id; }

  function cardImage(src) {
    // tools/make_card_thumbs.py writes <name>-640w.webp next to every card image.
    var thumb = src.replace(/\.[a-z0-9]+$/i, '') + '-640w.webp';
    return { src: asset(thumb), srcset: asset(thumb) + ' 640w, ' + asset(src) + ' 1400w' };
  }

  function projectMediaHTML(p, sizes) {
    var m = p.media || {};
    var label = m.label || p.shortTitle || p.title || '';
    if (m.type === 'image' && m.src) {
      var im = cardImage(m.src);
      return '<img src="' + esc(im.src) + '" srcset="' + esc(im.srcset) + '" sizes="' + sizes + '" alt="" loading="lazy" decoding="async">';
    }
    if (m.type === 'youtube' && m.videoId) {
      return '<img src="https://img.youtube.com/vi/' + esc(m.videoId) + '/maxresdefault.jpg" alt="" loading="lazy" decoding="async">' +
        '<span class="px-flag"><i class="fas fa-play" aria-hidden="true"></i>Video</span>';
    }
    return '<span class="px-placeholder"><i class="' + esc(m.icon || 'fas fa-diagram-project') + '" aria-hidden="true"></i><span>' + esc(label) + '</span></span>';
  }

  function projectActionsHTML(p) {
    var L = p.links || {};
    var out = [];
    var icon = function (href, cls, label) {
      return '<a class="px-icon" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(label) + ' (opens in a new tab)" title="' + esc(label) + '"><i class="' + cls + '" aria-hidden="true"></i></a>';
    };
    if (L.youtube) {
      var st = L.youtubeStart ? ' data-start-time="' + esc(L.youtubeStart) + '"' : '';
      out.push('<button type="button" class="px-icon youtube-modal-btn" data-video-id="' + esc(L.youtube) + '"' + st + ' aria-label="Watch the demo video" title="Watch demo"><i class="fab fa-youtube" aria-hidden="true"></i></button>');
    }
    if (L.live) out.push(icon(L.live, 'fas fa-arrow-up-right-from-square', 'Live site'));
    if (L.github) out.push(icon(L.github, 'fab fa-github', 'Source code'));
    if (L.paper) out.push(icon(L.paper, 'fas fa-file-lines', 'Paper'));
    if (L.poster) out.push(icon(asset(L.poster), 'fas fa-image', 'Poster'));
    if (L.pdf) {
      out.push('<button type="button" class="px-icon pdf-viewer-btn" data-pdf="' + esc(asset(L.pdf)) + '" data-title="' + esc(L.pdfTitle || p.title || 'Document') + '" aria-label="Open the report (PDF)" title="Report (PDF)"><i class="fas fa-file-pdf" aria-hidden="true"></i></button>');
    }
    var cta = isReady(p)
      ? '<a class="px-cta" href="' + detailHref(p.slug) + '">Read case study<i class="fas fa-arrow-right" aria-hidden="true"></i></a>'
      : '<span class="px-soon"><i class="fas fa-clock" aria-hidden="true"></i>Write-up coming soon</span>';
    return '<div class="px-card__actions">' + cta + (out.length ? '<span class="px-icons">' + out.join('') + '</span>' : '') + '</div>';
  }

  function statusHTML(p) {
    var st = p.status === 'ongoing' ? 'Ongoing' : p.status === 'completed' ? 'Completed' : '';
    var out = st ? '<span class="px-status is-' + esc(p.status) + '">' + st + '</span>' : '';
    if (p.badge && p.badge !== st) out += '<span class="px-badge">' + esc(p.badge) + '</span>';
    return out;
  }

  function projectCardHTML(p, taxonomy, opts) {
    var primary = (p.domains || [])[0];
    var year = String(p.date || '').slice(0, 4);
    var tags = (p.techTags || []).slice(0, 3).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    var summary = (p.seo && p.seo.description) || stripTags(p.description);
    var href = isReady(p) ? detailHref(p.slug) : null;
    var media = projectMediaHTML(p, opts.sizes);
    return '' +
      '<article class="px-card' + (opts.featured ? ' px-card--featured' : '') + '" data-slug="' + esc(p.slug) + '">' +
        (href ? '<a class="px-card__media" href="' + href + '" tabindex="-1" aria-hidden="true">' + media + '</a>'
              : '<div class="px-card__media">' + media + '</div>') +
        '<div class="px-card__body">' +
          '<p class="px-card__meta">' + statusHTML(p) + (opts.markFeatured && p.flagship ? '<span class="px-badge is-featured">Featured</span>' : '') + '</p>' +
          '<h3 class="px-card__title">' + (href ? '<a href="' + href + '">' + raw(p.title) + '</a>' : raw(p.title)) + '</h3>' +
          '<p class="px-card__area">' + (year ? '<span>' + esc(year) + '</span>' : '') + (primary ? '<span>' + esc(areaLabel(taxonomy, primary)) + '</span>' : '') + '</p>' +
          '<p class="px-card__desc">' + esc(summary) + '</p>' +
          (tags ? '<ul class="px-tags" aria-label="Methods and tools">' + tags + '</ul>' : '') +
          projectActionsHTML(p) +
        '</div>' +
      '</article>';
  }

  function projectRowHTML(p, taxonomy) {
    var year = String(p.date || '').slice(0, 4);
    var summary = (p.seo && p.seo.description) || stripTags(p.description);
    var href = isReady(p) ? detailHref(p.slug) : null;
    return '' +
      '<li class="px-row" data-slug="' + esc(p.slug) + '">' +
        '<span class="px-row__media" aria-hidden="true">' + projectMediaHTML(p, '120px') + '</span>' +
        '<div class="px-row__body">' +
          '<p class="px-card__meta">' + statusHTML(p) + (year ? '<span class="px-row__year">' + esc(year) + '</span>' : '') + '</p>' +
          '<h3 class="px-card__title">' + (href ? '<a href="' + href + '">' + raw(p.title) + '</a>' : raw(p.title)) + '</h3>' +
          '<p class="px-card__desc">' + esc(summary) + '</p>' +
        '</div>' +
      '</li>';
  }

  function renderProjects(container, taxonomy, projects) {
    var order = domainOrder(taxonomy);
    var byId = {};
    projects.forEach(function (p) { if (p && p.slug) byId[p.slug] = p; });
    var all = sortProjects(Object.keys(byId).map(function (k) { return byId[k]; }));
    var total = all.length;
    // Areas that any project references (primary or secondary), in taxonomy order.
    var referenced = {};
    all.forEach(function (p) { (p.domains || []).forEach(function (d) { if (d) referenced[d] = 1; }); });
    var areas = order.filter(function (id) { return referenced[id]; });
    Object.keys(referenced).forEach(function (id) { if (areas.indexOf(id) === -1) areas.push(id); });

    var index = {};
    all.forEach(function (p) {
      index[p.slug] = [p.title, p.shortTitle, p.seo && p.seo.description, stripTags(p.description)]
        .concat(p.techTags || [], p.features || [], p.skills || [], (p.domains || []).map(function (d) { return areaLabel(taxonomy, d); }))
        .join(' ').toLowerCase();
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-count="projects"]'), function (el) { el.textContent = String(total); });

    /* ---- Toolbar ---- */
    var mount = document.querySelector('[data-render="project-filters"], #project-filters') || container;
    var bar = document.createElement('div');
    bar.className = 'px-toolbar';
    bar.innerHTML = '' +
      '<div class="px-toolbar__row">' +
        '<label class="px-search"><i class="fas fa-magnifying-glass" aria-hidden="true"></i><span class="visually-hidden">Search projects</span>' +
          '<input type="search" name="q" placeholder="Search projects, methods or tools" autocomplete="off" aria-controls="px-results"></label>' +
        '<label class="px-select"><span class="visually-hidden">Research area</span><select name="area" aria-controls="px-results"></select></label>' +
        '<div class="px-view" role="group" aria-label="Layout">' +
          '<button type="button" data-view="grid" aria-pressed="true"><i class="fas fa-table-cells-large" aria-hidden="true"></i>Grid</button>' +
          '<button type="button" data-view="areas" aria-pressed="false"><i class="fas fa-list" aria-hidden="true"></i>By area</button>' +
        '</div>' +
      '</div>' +
      '<div class="px-areas" role="group" aria-label="Filter by research area"></div>' +
      '<div class="px-toolbar__foot"><p class="px-status-line" role="status" aria-live="polite"></p>' +
        '<button type="button" class="px-reset" hidden>Clear filters</button>' +
        '<p class="px-note">A project can belong to several areas, so area counts add up to more than ' + total + '.</p></div>';
    mount.appendChild(bar);
    var input = bar.querySelector('input');
    var select = bar.querySelector('select');
    var chipsEl = bar.querySelector('.px-areas');
    var statusEl = bar.querySelector('.px-status-line');
    var resetBtn = bar.querySelector('.px-reset');
    var viewBtns = Array.prototype.slice.call(bar.querySelectorAll('[data-view]'));

    var results = document.createElement('div');
    results.id = 'px-results';
    results.className = 'px-results';
    container.innerHTML = '';
    container.appendChild(results);

    /* ---- State <-> URL ---- */
    var state = { q: '', area: 'all', view: 'grid' };
    function readURL() {
      var sp = new URLSearchParams(window.location.search);
      var area = sp.get('area') || 'all';
      state = {
        q: (sp.get('q') || '').slice(0, 80),
        area: area === 'all' || areas.indexOf(area) !== -1 ? area : 'all',
        view: sp.get('view') === 'areas' ? 'areas' : 'grid'
      };
    }
    function writeURL(push) {
      var sp = new URLSearchParams();
      if (state.q) sp.set('q', state.q);
      if (state.area !== 'all') sp.set('area', state.area);
      if (state.view !== 'grid') sp.set('view', state.view);
      var qs = sp.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      if (push) history.pushState(state, '', url); else history.replaceState(state, '', url);
    }

    function matches(p, q) {
      if (!q) return true;
      var hay = index[p.slug];
      return q.split(/\s+/).every(function (t) { return !t || hay.indexOf(t) !== -1; });
    }
    function inArea(p, area) { return area === 'all' || (p.domains || []).indexOf(area) !== -1; }

    /* ---- Render ---- */
    var GRID_SIZES = '(max-width: 680px) 92vw, (max-width: 1100px) 46vw, 360px';
    var FEAT_SIZES = '(max-width: 680px) 92vw, (max-width: 1100px) 46vw, 560px';
    function render() {
      var q = state.q.trim().toLowerCase();
      var hits = all.filter(function (p) { return matches(p, q); });
      var shown = hits.filter(function (p) { return inArea(p, state.area); });

      // Controls
      input.value = state.q;
      var countFor = function (id) { return id === 'all' ? hits.length : hits.filter(function (p) { return inArea(p, id); }).length; };
      var opts = [['all', 'All areas']].concat(areas.map(function (id) { return [id, areaLabel(taxonomy, id)]; }));
      chipsEl.innerHTML = opts.map(function (o) {
        var on = o[0] === state.area; var n = countFor(o[0]);
        return '<button type="button" class="px-chip" data-area="' + esc(o[0]) + '" aria-pressed="' + on + '"' + (n || on ? '' : ' data-empty') + '>' +
          esc(o[0] === 'all' ? 'All' : o[1]) + '<span class="px-chip__n">' + n + '</span></button>';
      }).join('');
      select.innerHTML = opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (o[0] === state.area ? ' selected' : '') + '>' + esc(o[1]) + ' (' + countFor(o[0]) + ')</option>';
      }).join('');
      viewBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === state.view)); });
      var filtered = !!q || state.area !== 'all';
      resetBtn.hidden = !filtered;
      var where = state.area !== 'all' ? ' in ' + areaLabel(taxonomy, state.area) : '';
      var what = q ? ' matching \u201c' + state.q.trim() + '\u201d' : '';
      statusEl.textContent = filtered
        ? shown.length + ' of ' + total + ' projects' + where + what
        : total + ' projects';

      // Results
      var html = '';
      if (!shown.length) {
        html = '<div class="px-empty"><p class="px-empty__title">No projects' + esc(where + what) + '.</p>' +
          '<p>Try a broader word (for example \u201cvision\u201d, \u201cLLM\u201d or \u201crobot\u201d), or clear the filters.</p>' +
          '<button type="button" class="px-reset-inline">Clear search and filters</button></div>';
      } else if (state.view === 'areas') {
        var groups = state.area !== 'all' ? [state.area] : areas;
        groups.forEach(function (id) {
          var list = state.area !== 'all'
            ? shown
            : shown.filter(function (p) { return ((p.domains || [])[0] || '') === id; }); // each project once, under its primary area
          if (!list.length) return;
          var tax = taxonomy[id] || {};
          html += '<section class="px-group" aria-labelledby="px-g-' + esc(id) + '">' +
            '<header class="px-group__head"><h2 class="px-h2" id="px-g-' + esc(id) + '">' + esc(tax.label || id) + '<span class="px-h2__n">' + list.length + '</span></h2>' +
            (tax.blurb ? '<p>' + esc(tax.blurb) + '</p>' : '') + '</header>' +
            '<ol class="px-rows">' + list.map(function (p) { return projectRowHTML(p, taxonomy); }).join('') + '</ol></section>';
        });
      } else if (!filtered) {
        var featured = shown.filter(function (p) { return p.flagship; });
        var rest = shown.filter(function (p) { return !p.flagship; });
        if (featured.length) {
          html += '<section class="px-section" aria-labelledby="px-featured"><h2 class="px-h2" id="px-featured">Featured<span class="px-h2__n">' + featured.length + '</span></h2>' +
            '<div class="px-grid px-grid--featured">' + featured.map(function (p) { return projectCardHTML(p, taxonomy, { featured: true, sizes: FEAT_SIZES }); }).join('') + '</div></section>';
        }
        html += '<section class="px-section" aria-labelledby="px-more"><h2 class="px-h2" id="px-more">' + (featured.length ? 'More projects' : 'All projects') + '<span class="px-h2__n">' + rest.length + '</span></h2>' +
          '<div class="px-grid">' + rest.map(function (p) { return projectCardHTML(p, taxonomy, { sizes: GRID_SIZES }); }).join('') + '</div></section>';
      } else {
        html = '<section class="px-section" aria-label="Results"><div class="px-grid">' +
          shown.map(function (p) { return projectCardHTML(p, taxonomy, { sizes: GRID_SIZES, markFeatured: true }); }).join('') + '</div></section>';
      }
      results.innerHTML = html;
      wirePDF();
    }

    function set(patch, push) {
      Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
      writeURL(push);
      render();
    }
    var typing = 0;
    input.addEventListener('input', function () {
      var v = input.value.slice(0, 80);
      clearTimeout(typing);
      typing = setTimeout(function () { set({ q: v }, false); }, 140);
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape' && input.value) { input.value = ''; set({ q: '' }, false); } });
    select.addEventListener('change', function () { set({ area: select.value }, true); });
    chipsEl.addEventListener('click', function (e) {
      var c = e.target.closest('.px-chip'); if (!c) return;
      set({ area: c.getAttribute('data-area') }, true);
      var again = chipsEl.querySelector('[data-area="' + c.getAttribute('data-area') + '"]');
      if (again) again.focus();
    });
    bar.querySelector('.px-view').addEventListener('click', function (e) {
      var b = e.target.closest('[data-view]'); if (!b) return;
      set({ view: b.getAttribute('data-view') }, true);
      var again = bar.querySelector('[data-view="' + b.getAttribute('data-view') + '"]');
      if (again) again.focus();
    });
    function clearAll() { set({ q: '', area: 'all' }, true); input.focus(); }
    resetBtn.addEventListener('click', clearAll);
    results.addEventListener('click', function (e) { if (e.target.closest('.px-reset-inline')) clearAll(); });
    window.addEventListener('popstate', function () { readURL(); render(); });

    wireYouTube(results);
    readURL();
    writeURL(false);
    render();
  }

  /* ----------------------------------------------------------------------
     4. PUBLICATIONS index
     --------------------------------------------------------------------- */
  function initPublications(container) {
    getJSON(dataURL('publications.json')).then(function (data) {
      var pubs = unwrap(data, ['publications', 'items', 'data']);
      renderPublications(container, pubs);
    }).catch(function (err) {
      console.error('[render.js] publications render failed:', err);
      container.setAttribute('data-render-error', '1');
    });
  }

  var PUB_GROUPS = [
    { key: 'journal',    title: 'Journal articles' },
    { key: 'conference', title: 'Conference papers' },
    { key: 'upcoming',   title: 'Upcoming' }
  ];

  function pubGroupKey(p) {
    if (p.status === 'upcoming') return 'upcoming';
    return p.type === 'journal' ? 'journal' : 'conference';
  }

  function sortPubs(list) {
    return list.slice().sort(function (a, b) {
      var fa = a.status === 'featured' ? 1 : 0, fb = b.status === 'featured' ? 1 : 0;
      if (fb - fa) return fb - fa;
      var da = a.date || '', db = b.date || '';
      if (da !== db) return db < da ? -1 : 1;    // date desc
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }

  // Liquid-glass glyph tile from assets/glyphs.svg (see glyphs.css).
  function glyph(name, clear) {
    return '<svg class="gi' + (clear ? ' gi--clear' : '') + '" aria-hidden="true"><use href="' +
      asset('assets/glyphs.svg') + '#g-' + name + '"/></svg>';
  }

  function pubVenueHTML(p) {
    var v = p.venue || {};
    var qual = v.qualifier || v.location || '';
    return '<p class="pub-venue">' + glyph('doc', true) + '<span><strong>' + esc(v.name || '') + '</strong>' +
      (qual ? '<span class="pub-venue__qual">' + esc(qual) + '</span>' : '') + '</span></p>';
  }

  function pubTalkHTML(p) {
    var m = p.media || {};
    if (m.type !== 'youtube' || !m.videoId) return '';
    var st = m.startTime ? ' data-start-time="' + esc(m.startTime) + '"' : '';
    return '' +
      '<button type="button" class="pub-talk media-preview" data-video-id="' + esc(m.videoId) + '"' + st +
        ' aria-label="Watch the talk: ' + esc(p.title) + '">' +
        '<img src="https://img.youtube.com/vi/' + esc(m.videoId) + '/mqdefault.jpg" alt="" width="320" height="180" loading="lazy" decoding="async">' +
        '<span class="pub-talk__play">' + glyph('play') + '</span>' +
        '<span class="pub-talk__cap">' + esc(m.caption || 'Research talk') + '</span>' +
      '</button>';
  }

  function pubTagsHTML(p) {
    var tags = (p.tags || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    return tags ? '<ul class="pub-tags" aria-label="Topics">' + tags + '</ul>' : '';
  }

  function pubActionsHTML(p) {
    var out = [];
    var L = p.links || {};
    if (p.status === 'upcoming') {
      out.push('<span class="ph-btn is-muted" aria-disabled="true">' + glyph('spark', true) + '<span>' + esc(p.upcomingLabel || 'Paper pending') + '</span></span>');
    } else if (p.url || p.doi) {
      var url = p.url || ('https://doi.org/' + p.doi);
      out.push('<a href="' + esc(url) + '" class="ph-btn is-primary" target="_blank" rel="noopener noreferrer">' +
        glyph('external') + '<span>' + esc(p.readLabel || 'Read paper') + '</span></a>');
    }
    if (isReady(p)) out.push('<a href="' + detailHref(p.slug) + '" class="ph-btn">' + glyph('eye', true) + '<span>Details</span></a>');
    if (p.pdf) {
      out.push('<button type="button" class="ph-btn pdf-viewer-btn" data-pdf="' + esc(asset(p.pdf)) +
        '" data-title="' + esc(p.pdfTitle || p.title || 'Paper') + '">' + glyph('pdf', true) + '<span>PDF</span></button>');
    }
    var m = p.media || {};
    if (m.type === 'youtube' && m.videoId) {
      out.push('<button type="button" class="ph-btn youtube-modal-btn" data-video-id="' + esc(m.videoId) + '">' + glyph('play', true) + '<span>Talk</span></button>');
    }
    if (L.github || p.code) {
      out.push('<a href="' + esc(L.github || p.code) + '" class="ph-btn" target="_blank" rel="noopener noreferrer">' + glyph('github', true) + '<span>Code</span></a>');
    }
    var cite = p.doi || (p.citation && p.citation.apa);
    if (cite) {
      out.push('<button type="button" class="ph-btn" data-copy="' + esc(cite) + '">' + glyph('link', true) +
        '<span>' + (p.doi ? 'Copy DOI' : 'Copy citation') + '</span></button>');
    }
    return out.length ? '<div class="pub-actions">' + out.join('') + '</div>' : '';
  }

  function publicationItemHTML(p) {
    var mod = p.status === 'featured' ? ' is-featured' : p.status === 'upcoming' ? ' is-upcoming' : '';
    var first = /first/i.test(p.authorRole || '');
    if (first) mod += ' is-first';
    var year = String(p.date || '').slice(0, 4);
    var title = isReady(p) ? '<a href="' + detailHref(p.slug) + '">' + raw(p.title) + '</a>' : raw(p.title);
    var chips = '<span class="ph-chip' + (first ? ' is-primary' : '') + '">' + esc(p.authorRole || 'Author') + '</span>' +
      (p.status === 'upcoming' ? '<span class="ph-status ph-status--ongoing"><span class="ph-status__dot" aria-hidden="true"></span>To be presented</span>' : '') +
      '<span class="pub-date">' + esc(p.dateDisplay || p.date || '') + '</span>';
    return '' +
      '<article class="pub-card mp-reveal' + mod + '" data-slug="' + esc(p.slug) + '">' +
        '<div class="pub-card__rail" aria-hidden="true"><span class="pub-year">' + esc(year) + '</span>' +
          '<span class="pub-kind">' + (p.type === 'journal' ? 'Journal' : 'Conference') + '</span></div>' +
        '<div class="pub-card__body">' +
          '<div class="pub-meta">' + chips + '</div>' +
          '<h3 class="pub-title">' + title + '</h3>' +
          (p.authorsShort ? '<p class="pub-authors">' + raw(p.authorsShort) + '</p>' : '') +
          pubVenueHTML(p) +
          (p.contribution ? '<p class="pub-summary">' + raw(p.contribution) + '</p>' : '') +
          pubTagsHTML(p) +
          pubActionsHTML(p) +
        '</div>' +
        pubTalkHTML(p) +
      '</article>';
  }

  var PUB_GROUP_GLYPH = { journal: 'doc', conference: 'nodes', upcoming: 'spark' };

  function renderPublications(container, pubs) {
    var byGroup = { journal: [], conference: [], upcoming: [] };
    pubs.forEach(function (p) { byGroup[pubGroupKey(p)].push(p); });

    var firstAuthor = pubs.filter(function (p) { return /first/i.test(p.authorRole || ''); }).length;
    var html = '<ul class="pub-stats mp-reveal" aria-label="At a glance">' +
      '<li><strong>' + pubs.length + '</strong><span>peer-reviewed papers</span></li>' +
      '<li><strong>' + byGroup.journal.length + '</strong><span>journal</span></li>' +
      '<li><strong>' + (byGroup.conference.length + byGroup.upcoming.length) + '</strong><span>conference</span></li>' +
      (firstAuthor ? '<li><strong>' + firstAuthor + '</strong><span>first-author</span></li>' : '') +
      '</ul>';
    PUB_GROUPS.forEach(function (g) {
      var list = sortPubs(byGroup[g.key]);
      if (!list.length) return;
      html += '' +
        '<section class="pub-group" data-group="' + g.key + '" aria-labelledby="pub-g-' + g.key + '">' +
          '<header class="pub-group__head mp-reveal"><h2 class="ph-h2" id="pub-g-' + g.key + '">' + glyph(PUB_GROUP_GLYPH[g.key]) +
            esc(g.title) + '<span class="pub-count">' + list.length + '</span></h2></header>' +
          '<div class="pub-list">' + list.map(publicationItemHTML).join('') + '</div>' +
        '</section>';
    });

    container.innerHTML = html;

    // Copy-to-clipboard for DOI / citation buttons (delegated). The result is
    // announced in a polite live region as well as on the button.
    var live = document.createElement('p');
    live.className = 'visually-hidden';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    container.appendChild(live);
    function legacyCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
    }
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy]');
      if (!btn) return;
      var text = btn.getAttribute('data-copy');
      var span = btn.querySelector('span');
      var prev = span ? (span.getAttribute('data-label') || span.textContent) : '';
      if (span) span.setAttribute('data-label', prev);
      var copy = navigator.clipboard && window.isSecureContext
        ? navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); })
        : legacyCopy(text);
      copy.then(function () {
        if (span) span.textContent = 'Copied';
        live.textContent = (/doi/i.test(prev) ? 'DOI' : 'Citation') + ' copied to the clipboard.';
      }, function () {
        if (span) span.textContent = 'Copy failed';
        live.textContent = 'Could not copy. The text is: ' + text;
      }).then(function () {
        clearTimeout(btn.__copyT);
        btn.__copyT = setTimeout(function () { if (span) span.textContent = prev; }, 1800);
      });
    });

    wireYouTube(container);
    wirePDF();
    observeReveal(Array.prototype.slice.call(container.querySelectorAll('.mp-reveal')));
  }

  /* ----------------------------------------------------------------------
     5. Boot
     --------------------------------------------------------------------- */
  ready(function () {
    var projEl = document.querySelector('[data-render="projects"], #domain-groups');
    var pubEl = document.querySelector('[data-render="publications"], #publication-groups');
    if (projEl) initProjects(projEl);
    if (pubEl) initPublications(pubEl);
  });
})();
