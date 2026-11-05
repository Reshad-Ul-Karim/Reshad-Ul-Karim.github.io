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
     4. Owns ALL of its own interactions — a deterministic domain filter
        (GSAP Flip when available, else plain show/hide), its own
        IntersectionObserver reveal, its own VanillaTilt.init, and its own
        YouTube/PDF modal wiring — because render.js injects cards
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
     3. PROJECTS index
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

  // Within a domain group: flagship desc -> weight desc -> date desc -> title.
  function sortProjects(list) {
    return list.slice().sort(function (a, b) {
      var fa = a.flagship ? 1 : 0, fb = b.flagship ? 1 : 0;
      if (fb - fa) return fb - fa;
      var wa = a.weight || 0, wb = b.weight || 0;
      if (wb - wa) return wb - wa;
      var da = a.date || '', db = b.date || '';
      if (da !== db) return db < da ? -1 : 1;         // date desc (ISO-ish string)
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }

  function projectMediaHTML(p) {
    var m = p.media || {};
    var icon = m.icon || 'fas fa-folder';
    var label = m.label || p.shortTitle || p.title || '';

    if (m.type === 'image' && m.src) {
      // Real thumbnail fills the image area; the FA placeholder is the fallback
      // (CSS hides it when .project-thumb is present; onerror restores it).
      return '' +
        '<img class="project-thumb" src="' + esc(asset(m.src)) + '" alt="' + esc(m.alt || label) + '"' +
        ' loading="lazy" decoding="async" onerror="this.remove()">' +
        '<div class="project-placeholder"><i class="' + esc(icon) + '"></i><span>' + esc(label) + '</span></div>';
    }
    if (m.type === 'youtube' && m.videoId) {
      var st = m.startTime ? ' data-start-time="' + esc(m.startTime) + '"' : '';
      return '' +
        '<div class="youtube-preview" data-video-id="' + esc(m.videoId) + '"' + st + '>' +
          '<img src="https://img.youtube.com/vi/' + esc(m.videoId) + '/maxresdefault.jpg" alt="' +
            esc(m.alt || (label + ' demo video')) + '" class="youtube-thumbnail" width="1280" height="720" loading="lazy" decoding="async">' +
          '<div class="youtube-play-button"><i class="fab fa-youtube"></i></div>' +
          '<div class="youtube-overlay"><span class="youtube-duration">' + esc(m.caption || 'Demo Video') + '</span></div>' +
        '</div>';
    }
    // default: icon placeholder
    return '<div class="project-placeholder"><i class="' + esc(icon) + '"></i><span>' + esc(label) + '</span></div>';
  }

  function projectLinksHTML(p) {
    var L = p.links || {};
    var out = [];
    if (L.github) out.push('<a href="' + esc(L.github) + '" class="project-link" target="_blank" rel="noopener noreferrer" aria-label="Source code"><i class="fab fa-github"></i></a>');
    if (L.live)   out.push('<a href="' + esc(L.live) + '" class="project-link" target="_blank" rel="noopener noreferrer" aria-label="Live site"><i class="fas fa-external-link-alt"></i></a>');
    if (L.paper)  out.push('<a href="' + esc(L.paper) + '" class="project-link" target="_blank" rel="noopener noreferrer" aria-label="Paper"><i class="fas fa-file-alt"></i></a>');
    if (L.poster) out.push('<a href="' + esc(asset(L.poster)) + '" class="project-link" target="_blank" rel="noopener noreferrer" aria-label="Poster"><i class="fas fa-image"></i></a>');
    if (L.youtube) {
      var st = L.youtubeStart ? ' data-start-time="' + esc(L.youtubeStart) + '"' : '';
      out.push('<button type="button" class="project-link youtube-modal-btn" data-video-id="' + esc(L.youtube) + '"' + st + ' aria-label="Watch demo"><i class="fab fa-youtube"></i></button>');
    }
    if (L.pdf) {
      out.push('<button type="button" class="project-link pdf-viewer-btn" data-pdf="' + esc(asset(L.pdf)) + '" data-title="' + esc(L.pdfTitle || p.title || 'Document') + '" aria-label="Open PDF"><i class="fas fa-file-pdf"></i></button>');
    }
    if (!out.length) return '';
    return '<div class="project-overlay"><div class="project-links">' + out.join('') + '</div></div>';
  }

  function projectBadgeHTML(p) {
    var b = p.badge || (p.status === 'ongoing' ? 'Ongoing' : '');
    if (!b) return '';
    return ' <span class="project-badge ongoing">' + esc(b) + '</span>';
  }

  function projectCtaHTML(p) {
    if (isReady(p)) {
      return '<a class="mp-view-link" href="' + detailHref(p.slug) + '">' +
        'Read more <i class="fas fa-arrow-right-long" aria-hidden="true"></i></a>';
    }
    return '<span class="mp-soon-badge" aria-label="Detail page coming soon">' +
      '<i class="fas fa-clock" aria-hidden="true"></i> Coming soon</span>';
  }

  function projectCardHTML(p) {
    var domains = (p.domains || []).join(' ');
    var tech = (p.techTags || p.tech || []).map(function (t) {
      return '<span class="tech-tag">' + esc(t) + '</span>';
    }).join('');
    var feats = (p.features || []).map(function (f) {
      return '<span class="feature">' + esc(f) + '</span>';
    }).join('');

    return '' +
      '<div class="project-card mp-reveal" data-slug="' + esc(p.slug) + '" data-domains="' + esc(domains) + '">' +
        '<div class="project-image">' +
          projectMediaHTML(p) +
          projectLinksHTML(p) +
          (tech ? '<div class="project-tech-stack">' + tech + '</div>' : '') +
        '</div>' +
        '<div class="project-content">' +
          '<h3>' + raw(p.title) + projectBadgeHTML(p) + '</h3>' +
          '<p>' + raw(p.description) + '</p>' +
          (feats ? '<div class="project-features">' + feats + '</div>' : '') +
          '<div class="mp-card-cta">' + projectCtaHTML(p) + '</div>' +
        '</div>' +
      '</div>';
  }

  function domainHeaderHTML(id, tax) {
    return '' +
      '<header class="mp-domain-header mp-reveal" data-domain="' + esc(id) + '">' +
        '<span class="mp-domain-icon"><i class="' + esc(tax.icon || 'fas fa-folder') + '"></i></span>' +
        '<div class="mp-domain-heading">' +
          '<h2 class="mp-domain-title">' + esc(tax.label || id) + '</h2>' +
          (tax.blurb ? '<p class="mp-domain-blurb">' + esc(tax.blurb) + '</p>' : '') +
        '</div>' +
      '</header>';
  }

  function renderProjects(container, taxonomy, projects) {
    var order = domainOrder(taxonomy);

    // Bucket each project under its PRIMARY domain (domains[0]). Unknown/empty
    // primaries fall into a synthetic "other" bucket appended last.
    var buckets = {};
    order.forEach(function (id) { buckets[id] = []; });
    var extras = [];
    projects.forEach(function (p) {
      var primary = (p.domains && p.domains[0]) || '';
      if (buckets[primary]) buckets[primary].push(p);
      else extras.push(p);
    });

    // Build ONE grid: full-width domain headers + their cards, in taxonomy
    // order. Filtering hides the headers and flattens into a single grid, so
    // secondary-domain matches surface without duplicating any card.
    var gridHTML = '';
    order.forEach(function (id) {
      var list = sortProjects(buckets[id]);
      if (!list.length) return;
      gridHTML += domainHeaderHTML(id, taxonomy[id]);
      gridHTML += list.map(projectCardHTML).join('');
    });
    if (extras.length) {
      gridHTML += domainHeaderHTML('other', { label: 'Other Work', icon: 'fas fa-folder', blurb: '' });
      gridHTML += sortProjects(extras).map(projectCardHTML).join('');
    }

    var grid = document.createElement('div');
    grid.className = 'projects-grid mp-grid';
    grid.innerHTML = gridHTML;
    container.innerHTML = '';
    container.appendChild(grid);

    // Filter bar: "All" + one chip per domain referenced by ANY project's
    // full domains[] (primary OR secondary), in taxonomy order — so a domain
    // that is only ever secondary (e.g. healthcare-ai for the assistive vision agent) still gets
    // a chip. Chip count = projects whose domains[] includes that id.
    var referenced = {};
    projects.forEach(function (p) {
      (p.domains || []).forEach(function (d) { if (d) referenced[d] = 1; });
    });
    var chipDomains = order.filter(function (id) { return referenced[id]; });
    Object.keys(referenced).forEach(function (id) {
      if (chipDomains.indexOf(id) === -1) chipDomains.push(id); // unknown domains last
    });
    buildFilterBar(container, taxonomy, chipDomains, projects, grid);

    // Own interactions.
    wireYouTube(grid);
    wirePDF();
    observeReveal(Array.prototype.slice.call(grid.querySelectorAll('.mp-reveal')));
  }

  function buildFilterBar(container, taxonomy, presentIds, projects, grid) {
    var mount = document.querySelector('[data-render="project-filters"], #project-filters');
    var bar = document.createElement('div');
    bar.className = 'mp-filters';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Filter projects by research domain');

    function countFor(id) {
      if (id === 'all') return projects.length;
      return projects.filter(function (p) {
        return (p.domains || []).indexOf(id) !== -1;
      }).length;
    }

    var chips = [];
    chips.push(chipHTML('all', 'All', '', countFor('all'), true));
    presentIds.forEach(function (id) {
      var t = taxonomy[id] || {};
      chips.push(chipHTML(id, t.label || id, t.icon || '', countFor(id), false));
    });
    bar.innerHTML = chips.join('');

    if (mount) mount.appendChild(bar);
    else container.parentNode.insertBefore(bar, container);

    bar.addEventListener('click', function (e) {
      var chip = e.target.closest('.mp-chip');
      if (!chip) return;
      var domain = chip.getAttribute('data-filter');
      bar.querySelectorAll('.mp-chip').forEach(function (c) {
        var on = c === chip;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      applyFilter(grid, domain);
    });
  }

  function chipHTML(id, label, icon, count, active) {
    return '<button type="button" class="mp-chip' + (active ? ' is-active' : '') +
      '" data-filter="' + esc(id) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
      (icon ? '<i class="' + esc(icon) + '" aria-hidden="true"></i> ' : '') +
      esc(label) + '<span class="mp-chip-count">' + count + '</span></button>';
  }

  // Filter: "all" restores the grouped view; a domain flattens to every card
  // whose data-domains includes it. GSAP Flip animates the reflow when present.
  function applyFilter(grid, domain) {
    var animated = Array.prototype.slice.call(
      grid.querySelectorAll('.project-card, .mp-domain-header')
    );
    var useFlip = !REDUCED && window.gsap && window.Flip;
    var state = useFlip ? window.Flip.getState(animated) : null;

    grid.querySelectorAll('.mp-domain-header').forEach(function (h) {
      h.classList.toggle('mp-hidden', domain !== 'all');
    });
    grid.querySelectorAll('.project-card').forEach(function (c) {
      if (domain === 'all') { c.classList.remove('mp-hidden'); return; }
      var d = (c.getAttribute('data-domains') || '').split(/\s+/);
      c.classList.toggle('mp-hidden', d.indexOf(domain) === -1);
    });

    if (useFlip) {
      window.Flip.from(state, {
        duration: 0.5,
        ease: 'power2.inOut',
        scale: true,
        absolute: true,
        onEnter: function (els) {
          return window.gsap.fromTo(els, { opacity: 0, scale: 0.85 },
            { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' });
        },
        onLeave: function (els) {
          return window.gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.3, ease: 'power2.in' });
        }
      });
    }
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

    // Copy-to-clipboard for DOI / citation buttons (delegated).
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy]');
      if (!btn) return;
      var text = btn.getAttribute('data-copy');
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      var span = btn.querySelector('span');
      if (span) {
        var prev = span.textContent;
        span.textContent = 'Copied!';
        setTimeout(function () { span.textContent = prev; }, 1400);
      }
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
