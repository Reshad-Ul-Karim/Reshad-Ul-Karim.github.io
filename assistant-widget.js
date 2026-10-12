/* =====================================================================
   ASK RESHAD — AI portfolio assistant widget
   - Talks to the persona corpus of the enterprise-AI-document-assistant
     service (POST {API_BASE}/api/ask, corpus:"persona"). See
     docs/AI_ASSISTANT_PLAN.md secs.4-6.
   - Page-aware: resolves "this"/"here" on a project/publication page by
     sending { kind, slug, title } derived from the URL (sec.5.1).
   - Never auto-opens. One-time tooltip, then silent until clicked.
   - Transcript persists per-tab via sessionStorage so a "Read more" click
     mid-conversation doesn't lose context.
   - Theme-aware for free: consumes the site's existing CSS custom
     properties (--primary-color, --bg-primary, etc.) and [data-theme]
     toggle -- no separate dark-mode logic needed here.
   Loaded on every page (index.html directly; subpages via the same
   <script> tag pattern used for accent-theme.js). Owns ONLY this file +
   assistant-widget.css.
   ===================================================================== */
(function () {
  'use strict';

  // Local dev: if the SITE itself is being served from localhost, talk to a locally-run
  // copy of the API instead of the deployed one -- lets `python -m uvicorn src.api.main:app`
  // + a static file server prove the whole flow works before anything is deployed.
  var API_BASE = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    ? 'http://localhost:8000'
    : 'https://enterprise-ai-document-assistant-8baj.onrender.com';
  var SS_TRANSCRIPT_KEY = 'askReshad.transcript';
  var LS_TOOLTIP_KEY = 'askReshad.tooltipSeen';
  var MAX_HISTORY_TURNS = 6;
  var COLD_START_HINT_MS = 4000;

  // --- Self-locate the site root, exactly like site-shell.js does, so links
  //     to /projects/<slug>.html work whether this loads from index.html or
  //     from one level deep. ------------------------------------------------
  var selfScript = document.currentScript;
  var BASE = (selfScript && selfScript.src ? selfScript.src : '').replace(/assistant-widget\.js.*$/, '');

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ---- 1. Page context: which page is the visitor standing on? -----------
  function pageContext() {
    var path = window.location.pathname;
    var m = path.match(/\/(projects|publications)\/([a-z0-9-]+)\.html$/);
    if (m) return { kind: m[1].slice(0, -1), slug: m[2], title: document.title };
    if (/\/(projects|publications)\/?(index\.html)?$/.test(path) && /\/(projects|publications)\//.test(path)) {
      return { kind: 'index', title: document.title };
    }
    return { kind: 'home', title: document.title };
  }

  // Questions about the page being read, offered on project and publication pages.
  var CHIPS = {
    project: [
      'What was hardest about this?',
      'What tech does it use?',
      'What else is like this?'
    ],
    publication: [
      'Explain this paper simply',
      'What was his contribution?'
    ]
  };

  // Who is visiting, picked once at the start (or inferred from what they ask). It tailors the
  // first reply, the suggested questions and the links offered. Keys match BK_OFFERS.
  var ROLE_PICKS = [
    { role: 'hire', label: "I'm hiring" },
    { role: 'academic', label: "I'm a researcher or professor" },
    { role: 'project', label: 'I have a project in mind' },
    { role: 'general', label: 'Just looking around' }
  ];
  // Only claims the site itself makes. The pick is stored as a turn, so the model also sees it.
  var ROLE_REPLIES = {
    hire: "Thanks. Reshad is an AI/ML engineer and researcher, and his site says he's open to AI/ML roles. His CV and projects are a quick way in, or ask me anything.",
    academic: 'Thanks. Reshad is looking for PhD and research opportunities. I can walk you through his publications and research projects.',
    project: "Thanks. Tell me what you're working on, or start with what he has built and how.",
    general: 'Welcome. Here are a few good places to start.'
  };
  // Suggested next questions, shown above the input after every answer (never one already asked).
  var FOLLOW_UPS = {
    hire: ['Does he have production LLM experience?', "What's his tech stack?", 'What kind of roles is he looking for?', "What's the most complex system he has built?", 'How can I reach him?'],
    academic: ["What's his strongest research work?", 'What are his research interests?', 'What has he published?', 'How can I reach him?'],
    project: ['What has he built end to end?', 'Does he have production LLM experience?', "What's his tech stack?", 'How can I reach him?'],
    general: ['Give me a quick intro to Reshad', "What's his strongest research work?", 'Show me a computer-vision project', 'Does he have production LLM experience?']
  };
  var AFTER_BOOKING = ['Brief me on Reshad before the call'];

  // ---- 2. Slug -> kind lookup, so citations link to the right page --------
  // Fetched once, lazily, so opening the widget never costs a request nobody
  // asked for. A citation whose doc_id isn't in either set (the resume, or
  // site-home) gets a non-link label instead of a guessed URL.
  var slugKind = null; // { [slug]: 'projects' | 'publications' }
  var slugKindPromise = null;

  function loadSlugKinds() {
    if (slugKindPromise) return slugKindPromise;
    slugKindPromise = Promise.all([
      fetch(BASE + 'data/projects.json').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      fetch(BASE + 'data/publications.json').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    ]).then(function (results) {
      var map = {};
      (results[0] || []).forEach(function (p) { map[p.slug] = 'projects'; });
      (results[1] || []).forEach(function (p) { map[p.slug] = 'publications'; });
      slugKind = map;
      return map;
    });
    return slugKindPromise;
  }

  // ---- 3. Transcript persistence (sessionStorage; see header) -------------
  function loadTranscript() {
    try {
      var raw = sessionStorage.getItem(SS_TRANSCRIPT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveTranscript(turns) {
    try {
      sessionStorage.setItem(SS_TRANSCRIPT_KEY, JSON.stringify(turns.slice(-MAX_HISTORY_TURNS)));
    } catch (e) { /* storage unavailable or full -- history just resets, not fatal */ }
  }

  // ---- 3b. Who is visiting ----------------------------------------------------------------
  // Per tab: the role, name and email the visitor has given, so nothing is asked twice. In this
  // browser only (localStorage, 30 days): role, what to call them (from the form) and when they
  // last sent a request, for a "welcome back". Never sent anywhere; the clear button forgets it.
  var SS_VISITOR_KEY = 'askReshad.visitor';
  var SS_ASKED_KEY = 'askReshad.asked';
  var SS_PICKED_KEY = 'askReshad.pickedAt';
  var LS_VISITOR_KEY = 'askReshad.returning';
  var RETURN_DAYS = 30;
  var REQUEST_QUIET_DAYS = 14;
  var isReturn = false; // a visitor this browser remembers, seen again in a new tab

  function readStore(store, key, fallback) {
    try { var v = JSON.parse(window[store].getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function writeStore(store, key, value) {
    try { window[store].setItem(key, JSON.stringify(value)); } catch (e) { /* not fatal */ }
  }

  function visitor() { return readStore('sessionStorage', SS_VISITOR_KEY, {}); }
  function returningVisitor() {
    var r = readStore('localStorage', LS_VISITOR_KEY, {});
    return r.seenAt && Date.now() - Date.parse(r.seenAt) < RETURN_DAYS * 864e5 ? r : {};
  }
  function rememberVisitor(patch) {
    var v = visitor();
    Object.keys(patch).forEach(function (k) { if (patch[k]) v[k] = patch[k]; });
    writeStore('sessionStorage', SS_VISITOR_KEY, v);
    if (!v.role && !v.formName) return;
    var r = returningVisitor(); // the long-lived copy stays small: no email, no full name
    if (v.role) r.role = v.role;
    if (v.formName) r.name = bkGreetName(v.formName);
    if (patch.requestedAt) r.requestedAt = patch.requestedAt;
    r.seenAt = new Date().toISOString();
    writeStore('localStorage', LS_VISITOR_KEY, r);
  }
  function recentRequest() {
    var r = returningVisitor();
    return !!r.requestedAt && Date.now() - Date.parse(r.requestedAt) < REQUEST_QUIET_DAYS * 864e5;
  }
  function seedReturningVisitor() {
    var v = visitor(), r = returningVisitor();
    if (Object.keys(v).length || !(r.role || r.name)) return;
    isReturn = true;
    writeStore('sessionStorage', SS_VISITOR_KEY, { role: r.role, formName: r.name });
    if (recentRequest()) ssSet(SS_OFFERS_KEY, String(MAX_OFFERS)); // already asked to meet: don't offer again
  }
  function forgetVisitor() {
    [SS_VISITOR_KEY, SS_ASKED_KEY, SS_PICKED_KEY, SS_DECLINED_KEY, SS_OFFERS_KEY].forEach(function (k) {
      try { sessionStorage.removeItem(k); } catch (e) { /* not fatal */ }
    });
    try { localStorage.removeItem(LS_VISITOR_KEY); } catch (e) { /* not fatal */ }
    isReturn = false;
  }

  function noteAsked(q) { writeStore('sessionStorage', SS_ASKED_KEY, askedList().concat(bkNorm(q)).slice(-40)); }
  function askedList() { var a = readStore('sessionStorage', SS_ASKED_KEY, []); return Array.isArray(a) ? a : []; }
  function wasAsked(q) { return askedList().indexOf(bkNorm(q)) > -1; }

  // ---- 4. DOM construction -------------------------------------------------
  var fab, panel, messagesEl, formEl, inputEl, chipsEl, sendBtn;
  var isOpen = false;
  var lastFocused = null;

  function buildFab() {
    fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'ask-reshad-fab';
    fab.className = 'ask-fab';
    fab.innerHTML = '<i class="fas fa-robot" aria-hidden="true"></i>';
    fab.setAttribute('aria-label', "Ask Reshad's AI assistant");
    fab.setAttribute('aria-haspopup', 'dialog');
    fab.setAttribute('aria-expanded', 'false');
    document.body.appendChild(fab);

    applyStoredPosition();
    initDrag();
    initHoverPopover();
  }

  // ---- Drag + snap-to-side -------------------------------------------------
  var LS_POSITION_KEY = 'askReshad.position'; // { side: 'left'|'right', bottom: px }
  var DRAG_THRESHOLD = 6;
  var fabSide = 'right';

  function loadStoredPosition() {
    try {
      var raw = localStorage.getItem(LS_POSITION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveStoredPosition(pos) {
    try { localStorage.setItem(LS_POSITION_KEY, JSON.stringify(pos)); } catch (e) {}
  }

  function clampBottom(bottom) {
    var min = 12;
    var max = window.innerHeight - fab.offsetHeight - 12;
    return Math.max(min, Math.min(max, bottom));
  }

  // Other fixed controls the FAB must not land on top of when dropped -- the scroll-progress
  // ring on the left (bottom:88px, 48px tall), and the theme-toggle + accent-switcher stack
  // on the right (bottom:20-84px and 84-134px). Bands are approximate on purpose (with
  // margin) since exact pixel-matching isn't the point, just not visually overlapping.
  var EXCLUSION_ZONES = {
    left: [[68, 148]],
    right: [[64, 214]]
  };

  function resolveBottom(side, bottom) {
    var zones = EXCLUSION_ZONES[side] || [];
    for (var i = 0; i < zones.length; i++) {
      var lo = zones[i][0], hi = zones[i][1];
      if (bottom > lo - 12 && bottom < hi + 12) {
        var toBelow = Math.abs(bottom - (lo - 16));
        var toAbove = Math.abs(bottom - (hi + 16));
        bottom = toBelow < toAbove ? Math.max(12, lo - 16) : hi + 16;
      }
    }
    return clampBottom(bottom);
  }

  function applySide(side, bottom) {
    fabSide = side;
    fab.classList.toggle('ask-fab--left', side === 'left');
    fab.style.left = side === 'left' ? '20px' : '';
    fab.style.right = side === 'left' ? '' : '20px';
    if (bottom != null) fab.style.bottom = clampBottom(bottom) + 'px';
    if (panel) panel.classList.toggle('ask-panel--left', side === 'left');
    var tip = document.querySelector('.ask-fab-tooltip');
    if (tip) tip.classList.toggle('ask-fab-tooltip--left', side === 'left');
  }

  function applyStoredPosition() {
    var pos = loadStoredPosition();
    if (pos) applySide(pos.side, resolveBottom(pos.side, pos.bottom));
  }

  function initDrag() {
    var dragging = false;
    var justDragged = false;
    var startX, startY, startBottom;

    fab.addEventListener('pointerdown', function (ev) {
      if (ev.button != null && ev.button !== 0) return; // left click / primary touch only
      dragging = false;
      startX = ev.clientX;
      startY = ev.clientY;
      startBottom = window.innerHeight - fab.getBoundingClientRect().bottom;
      fab.setPointerCapture(ev.pointerId);
    });

    fab.addEventListener('pointermove', function (ev) {
      if (startX == null) return;
      var dx = ev.clientX - startX;
      var dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        justDragged = true;
        fab.classList.add('ask-fab--dragging');
        hideHoverPopover();
      }
      // Free-follow the pointer vertically (and briefly horizontally) while dragging; the
      // snap back to a side happens on release, not live, so it doesn't fight the drag.
      fab.style.bottom = clampBottom(startBottom - dy) + 'px';
      var followX = ev.clientX < window.innerWidth / 2;
      fab.style.left = followX ? Math.max(12, ev.clientX - fab.offsetWidth / 2) + 'px' : '';
      fab.style.right = followX ? '' : Math.max(12, window.innerWidth - ev.clientX - fab.offsetWidth / 2) + 'px';
    });

    function endDrag(ev) {
      if (startX == null) return;
      startX = null;
      if (!dragging) return;
      dragging = false;
      fab.classList.remove('ask-fab--dragging');
      var side = ev.clientX < window.innerWidth / 2 ? 'left' : 'right';
      var bottom = resolveBottom(side, window.innerHeight - fab.getBoundingClientRect().bottom);
      applySide(side, bottom);
      saveStoredPosition({ side: side, bottom: bottom });
      window.setTimeout(function () { justDragged = false; }, 50);
    }

    fab.addEventListener('pointerup', endDrag);
    fab.addEventListener('pointercancel', endDrag);

    fab.addEventListener('click', function (ev) {
      if (justDragged) { ev.preventDefault(); return; }
      dismissTooltip();
      hideHoverPopover();
      setOpen(!isOpen);
    });

    window.addEventListener('resize', function () {
      fab.style.bottom = clampBottom(parseFloat(fab.style.bottom) || 20) + 'px';
    });
  }

  function buildTooltip() {
    var seen;
    try { seen = localStorage.getItem(LS_TOOLTIP_KEY); } catch (e) { seen = '1'; }
    if (seen) return;
    var tip = document.createElement('div');
    tip.className = 'ask-fab-tooltip' + (fabSide === 'left' ? ' ask-fab-tooltip--left' : '');
    tip.textContent = 'Ask me about Reshad';
    tip.setAttribute('role', 'status');
    document.body.appendChild(tip);
    window.setTimeout(function () {
      tip.classList.add('ask-fab-tooltip--visible');
    }, 800);
    window.setTimeout(dismissTooltip, 8000);
  }

  function dismissTooltip() {
    try { localStorage.setItem(LS_TOOLTIP_KEY, '1'); } catch (e) {}
    var tip = document.querySelector('.ask-fab-tooltip');
    if (tip && tip.parentNode) tip.parentNode.removeChild(tip);
  }

  // ---- Hover popover: a rotating hint, every hover (not one-time like the tooltip above) --
  // "It's an intelligent assistant" -- hovering should feel a little alive, not just show a
  // static label once and go silent forever after.
  var HOVER_HINTS = [
    '🧠 Ask about his strongest research',
    '⚡ Try: "What did he use in the assistive vision agent?"',
    '🔍 I only answer from his real CV & projects',
    '💬 Ask if he’s free for a call',
    '🎯 Try: "Does he have production LLM experience?"'
  ];

  function initHoverPopover() {
    fab.addEventListener('pointerenter', function () {
      if (isOpen) return;
      var seen;
      try { seen = localStorage.getItem(LS_TOOLTIP_KEY); } catch (e) { seen = '1'; }
      if (!seen) return; // let the one-time onboarding tooltip have the floor first
      showHoverPopover(HOVER_HINTS[Math.floor(Math.random() * HOVER_HINTS.length)]);
    });
    fab.addEventListener('pointerleave', hideHoverPopover);
  }

  var hoverPopoverEl = null;

  function showHoverPopover(text) {
    hideHoverPopover();
    hoverPopoverEl = document.createElement('div');
    hoverPopoverEl.className = 'ask-fab-tooltip ask-hover-popover' + (fabSide === 'left' ? ' ask-fab-tooltip--left' : '');
    hoverPopoverEl.textContent = text;
    document.body.appendChild(hoverPopoverEl);
    requestAnimationFrame(function () {
      if (hoverPopoverEl) hoverPopoverEl.classList.add('ask-fab-tooltip--visible');
    });
  }

  function hideHoverPopover() {
    if (hoverPopoverEl && hoverPopoverEl.parentNode) hoverPopoverEl.parentNode.removeChild(hoverPopoverEl);
    hoverPopoverEl = null;
  }

  function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'ask-reshad-panel';
    panel.className = 'ask-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', "Ask Reshad's AI assistant");
    panel.hidden = true;

    var header = document.createElement('div');
    header.className = 'ask-panel-header';
    header.innerHTML =
      '<div class="ask-panel-heading">' +
      '<span class="ask-panel-title">Ask Reshad</span>' +
      '</div>';
    var headerActions = document.createElement('div');
    headerActions.className = 'ask-panel-actions';

    // The transcript persists per-TAB (sessionStorage) until the tab closes, by design --
    // navigating to a project page mid-conversation shouldn't lose context. That means nothing
    // resets it automatically on its own; this is the manual reset for "start over".
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'ask-panel-clear';
    clearBtn.innerHTML = '<i class="fas fa-rotate-left" aria-hidden="true"></i>';
    clearBtn.setAttribute('aria-label', 'Clear conversation');
    clearBtn.setAttribute('title', 'Clear conversation');
    clearBtn.addEventListener('click', function () {
      saveTranscript([]);
      forgetVisitor();
      messagesEl.innerHTML = '';
      renderWelcome();
    });
    headerActions.appendChild(clearBtn);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ask-panel-close';
    closeBtn.innerHTML = '<i class="fas fa-xmark" aria-hidden="true"></i>';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', function () { setOpen(false); });
    headerActions.appendChild(closeBtn);

    header.appendChild(headerActions);

    messagesEl = document.createElement('div');
    messagesEl.className = 'ask-messages';
    messagesEl.setAttribute('role', 'log');
    messagesEl.setAttribute('aria-live', 'polite');
    messagesEl.setAttribute('aria-relevant', 'additions');

    chipsEl = document.createElement('div');
    chipsEl.className = 'ask-chips';
    chipsEl.setAttribute('role', 'group');
    chipsEl.hidden = true;

    formEl = document.createElement('form');
    formEl.className = 'ask-form';
    inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'ask-input';
    inputEl.placeholder = 'Ask about his work…';
    inputEl.maxLength = 1000;
    inputEl.setAttribute('aria-label', 'Your question');
    sendBtn = document.createElement('button');
    sendBtn.type = 'submit';
    sendBtn.className = 'ask-send';
    sendBtn.innerHTML = '<i class="fas fa-arrow-up" aria-hidden="true"></i>';
    sendBtn.setAttribute('aria-label', 'Send');
    formEl.appendChild(inputEl);
    formEl.appendChild(sendBtn);
    formEl.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var q = inputEl.value.trim();
      if (!q) return;
      inputEl.value = '';
      handleAsk(q);
    });

    panel.appendChild(header);
    panel.appendChild(messagesEl);
    panel.appendChild(chipsEl);
    panel.appendChild(formEl);
    document.body.appendChild(panel);

    panel.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        setOpen(false);
        return;
      }
      if (ev.key === 'Tab') trapFocus(ev);
    });
  }

  function trapFocus(ev) {
    var focusable = panel.querySelectorAll(
      'button, input, [href], textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  function setOpen(open) {
    isOpen = open;
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
    if (open) {
      lastFocused = document.activeElement;
      panel.classList.add('ask-panel--open');
      if (!messagesEl.children.length) renderWelcome();
      window.setTimeout(function () { inputEl.focus(); }, prefersReducedMotion() ? 0 : 150);
    } else {
      panel.classList.remove('ask-panel--open');
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }
  }

  // ---- 5. Rendering --------------------------------------------------------
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // The row of buttons above the input: who-are-you picks at the start, suggested questions
  // after every answer. Hidden while an answer is on its way or a form needs filling in.
  function renderChipButtons(items, label) {
    chipsEl.innerHTML = '';
    chipsEl.setAttribute('aria-label', label);
    items.forEach(function (it) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ask-chip';
      chip.textContent = it.label;
      chip.addEventListener('click', it.run);
      chipsEl.appendChild(chip);
    });
    chipsEl.hidden = !items.length;
  }

  function showSuggestions(list) {
    renderChipButtons((list || []).map(function (q) {
      return { label: q, run: function () { handleAsk(q); } };
    }), 'Suggested questions');
  }

  // Up to three: `first` (if not asked yet), the project or paper the answer cited, then the
  // questions for this page and for this kind of visitor.
  function nextSuggestions(citations, first) {
    var ctx = pageContext();
    var out = (first || []).filter(function (q) { return !wasAsked(q); });
    (citations || []).some(function (c) {
      if (!slugKind || !slugKind[c.doc_id] || c.doc_id === ctx.slug || !c.doc_title) return false;
      var q = 'Tell me more about ' + bkShortTitle(c.doc_title);
      if (wasAsked(q)) return false;
      out.push(q);
      return true;
    });
    var pool = (CHIPS[ctx.kind] || []).concat(FOLLOW_UPS[visitor().role] || FOLLOW_UPS.general);
    pool.forEach(function (q) {
      if (out.length < 3 && !wasAsked(q) && out.indexOf(q) < 0) out.push(q);
    });
    return out.slice(0, 3);
  }

  function welcomeText() {
    var ctx = pageContext(), r = returningVisitor();
    var hello = isReturn ? 'Welcome back' + (r.name ? ', ' + r.name : '') + '.' : "Hi, I'm Reshad's assistant.";
    if (ctx.kind === 'project') {
      return hello + " You're looking at " + bkShortTitle(ctx.title) + '. Ask me how it works, what was hard about it, or what else he has built like it.';
    }
    if (ctx.kind === 'publication') {
      return hello + " You're reading " + bkShortTitle(ctx.title) + '. I can explain it simply or tell you what his part in it was.';
    }
    if (isReturn) {
      return hello + (recentRequest()
        ? ' Your request from ' + bkDay(r.requestedAt) + ' is with Reshad, and he will follow up by email. What else would you like to know?'
        : ' What would you like to know today?');
    }
    return hello + ' I can answer questions about his research, projects and experience, point you to his CV, or help you set up a call with him.' +
      (visitor().role ? '' : ' What brings you here?');
  }

  // Not stored: it is rebuilt whenever the chat is empty, so it always matches the page.
  function renderWelcome() {
    renderMessage('assistant', welcomeText(), null);
    var ctx = pageContext();
    if (CHIPS[ctx.kind]) showSuggestions(nextSuggestions());
    else if (!visitor().role) {
      renderChipButtons(ROLE_PICKS.map(function (p) {
        return { label: p.label, run: function () { pickRole(p); } };
      }), 'Tell the assistant who you are');
    } else showSuggestions(nextSuggestions());
  }

  function pickRole(p) {
    chipsEl.hidden = true;
    renderMessage('user', p.label, null);
    rememberVisitor({ role: p.role });
    var text = ROLE_REPLIES[p.role];
    var row = renderMessage('assistant', text, null);
    var links = (BK_OFFERS[p.role] || BK_OFFERS.general).links;
    if (links.length) {
      var wrap = document.createElement('div');
      wrap.className = 'ask-offer-actions';
      appendLinks(wrap, links);
      row.appendChild(wrap);
      scrollToBottom();
    }
    recordTurn(p.label, text);
    showSuggestions(nextSuggestions());
  }

  function citationHref(citation) {
    if (!slugKind) return null;
    var kind = slugKind[citation.doc_id];
    if (kind === 'projects') return BASE + 'projects/' + citation.doc_id + '.html';
    if (kind === 'publications') return BASE + 'publications/' + citation.doc_id + '.html';
    return null;
  }

  function citationLabel(citation) {
    if (citation.doc_kind === 'resume') {
      return citation.section_title ? 'Résumé — ' + citation.section_title : 'Résumé';
    }
    if (citation.doc_id === 'site-home') {
      return citation.section_title ? 'reshadulkarim.me — ' + citation.section_title : 'reshadulkarim.me';
    }
    if (citation.section_title) return citation.doc_title + ' — ' + citation.section_title;
    return citation.doc_title + ' — p.' + citation.printed_page;
  }

  function renderCitations(container, citations) {
    if (!citations || !citations.length) return;
    var wrap = document.createElement('div');
    wrap.className = 'ask-citations';
    citations.forEach(function (c) {
      var href = citationHref(c);
      var el = document.createElement(href ? 'a' : 'span');
      el.className = 'ask-citation-chip';
      el.textContent = citationLabel(c);
      if (href) {
        el.href = href;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      }
      wrap.appendChild(el);
    });
    container.appendChild(wrap);
    // Citation destinations depend on data/projects.json + data/publications.json,
    // which are not loaded until the first answer needs them -- backfill hrefs once
    // that resolves, since it's plausible the map arrives after this render.
    loadSlugKinds().then(function () {
      Array.prototype.forEach.call(wrap.children, function (el, i) {
        var href = citationHref(citations[i]);
        if (href && el.tagName === 'SPAN') {
          var a = document.createElement('a');
          a.className = el.className;
          a.textContent = el.textContent;
          a.href = href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          wrap.replaceChild(a, el);
        }
      });
    });
  }

  // ---- 5b. Booking intent (deterministic, runs BEFORE any /api/ask call) -------------------
  // The widget must never push a meeting on someone who has not asked for one. Messages fall
  // into three groups:
  //   request -- an explicit ask to meet, talk or schedule ("can we meet on monday", "please
  //              set up a meeting with him"). The form opens at once, because that is exactly
  //              what the visitor asked for. Nothing is sent until they press Send.
  //   offer   -- availability, contact, hiring or collaboration questions ("is he free?", "how
  //              can I contact him", "I want to hire him"). These may only want information,
  //              so the visitor gets a short answer with the right links (CV, projects,
  //              publications, contact) and an OPTIONAL "send a request" button.
  //   (none)  -- everything else goes to the model.
  // A visitor who says no is not asked again, offers are capped per session, and an explicit
  // request is always honoured. (Showing the form used to depend on the model ending its
  // answer with <<BOOK>> in exactly the right form, and a first fix that treated every
  // availability or contact question as a meeting request was too eager.)
  // BEGIN booking-intent (pure functions; no DOM -- exercised by an offline test harness)
  var BK_FULL_DAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  var BK_ABBR_DAYS = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
  var BK_MONTHS3 = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  var BK_DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var BK_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var BK_OWNER_TZ = 'Asia/Dhaka';
  var BK_MON_PAT = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  var BK_DM_RE = new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + BK_MON_PAT + '\\b(?:,?\\s*(20\\d{2}))?');
  var BK_MD_RE = new RegExp('\\b' + BK_MON_PAT + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(20\\d{2}))?');
  var BK_DAY_RE = /\b(?:(next|this|coming|upcoming|on)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)\b/;
  var BK_TIME_RE = /\b(?:today|tonight|tomorrow|this\s+(?:morning|afternoon|evening|week|weekend)|next\s+week|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)|\d{1,2}:\d{2}|noon|midnight)(?![a-z])/;
  var BK_EXCLUDE_RE = /\bmeet(?:s|ing)?\s+(?:(?:all|the|these|those|his|our|their|any|your|client|clients|customer|customers|user|users|project|business|stakeholder|stakeholders)\s+){0,3}(?:requirements?|expectations?|criteria|standards?|deadlines?|needs|demands?|goals?|targets?|conditions)\b|\bcall\s*(?:stack|back|graph|site|center|centre)\b|\bcallbacks?\b|\b(?:function|api|system)\s+calls?\b/;
  var BK_MONTH_WORD_RE = /^(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)$/;
  var BK_NAME_STOP_RE = /^(?:a|an|the|interested|looking|hoping|wondering|here|trying|not|just|very|so|from|working|writing|reaching|contacting|currently|also|available|free|sorry|happy|keen|excited|curious|calling|asking|new|your|his|my|at|with|in|on|for|to|and|or|but|that|this)$/i;

  function bkNorm(s) {
    return String(s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  }

  // Strong verbs mean "meeting" by themselves; talk/speak/chat/call/connect are too common
  // in ordinary questions ("can we talk about his projects?") unless tied to him or a time.
  function bkVerbOk(verb, t) {
    if (/^(?:meet|schedule|book|set\s*up|setup|arrange|interview|hire|contact|reach|catch\s*up)$/.test(verb)) return true;
    return /\b(?:him|reshad)\b/.test(t) || BK_TIME_RE.test(t) ||
      /\b(?:in person|face to face|on a call|video call|zoom|google meet|teams call|over coffee)\b/.test(t);
  }

  // Verbs that mean "a meeting" outright. connect / hire / contact / reach / interview are
  // softer: the visitor may want a link or an address, not a meeting.
  var BK_REQUEST_VERB_RE = /^(?:meet|talk|speak|chat|call|catch\s*up|sync|schedule|book|set\s*up|setup|arrange)$/;

  // 'request' | 'offer' | '' -- see the header above.
  function classifyBookingIntent(text) {
    var t = bkNorm(text), m;
    if (!t || t.length > 600) return ''; // a pasted essay is not a scheduling request
    if (BK_EXCLUDE_RE.test(t)) return '';
    // ---- explicit requests: act on them
    if (/\b(?:set\s*up|setup|arrange|schedule|book|organi[sz]e|fix|plan)\b[^.?!]{0,40}\b(?:meeting|meet|call|chat|appointment|interview|conversation|catch\s*up|session|talk)\b/.test(t)) return 'request';
    m = t.match(/\b(?:can|could|may|might|would|will|shall)\b[^.?!]{0,30}\b(meet|talk|speak|chat|call|connect|catch\s*up|sync)\b/);
    if (m && bkVerbOk(m[1], t)) return BK_REQUEST_VERB_RE.test(m[1]) ? 'request' : 'offer';
    m = t.match(/\b(?:i|we)\b[^.?!]{0,25}\b(?:want|wanted|would like|d like|need|hope|wish|love|plan)\b[^.?!]{0,12}\bto\b[^.?!]{0,10}\b(meet|talk|speak|chat|call|connect|schedule|book|set\s*up|arrange|interview|hire|contact|reach)\b/);
    if (m && bkVerbOk(m[1], t)) return BK_REQUEST_VERB_RE.test(m[1]) ? 'request' : 'offer';
    m = t.match(/\bwanna\b[^.?!]{0,10}\b(meet|talk|speak|chat|call|connect|schedule|book|set\s*up|arrange|interview|hire|contact|reach)\b/);
    if (m && bkVerbOk(m[1], t)) return BK_REQUEST_VERB_RE.test(m[1]) ? 'request' : 'offer';
    if (/\b(?:call|ring|phone)\s+me\b|\bappointment\b/.test(t)) return 'request';
    if (/\b(?:meeting|call|appointment|interview|chat|conversation|catch\s*up|session)\b[^.?!]{0,12}\bwith\s+(?:him|reshad|you)\b/.test(t)) return 'request';
    // ---- softer signals: answer and offer, do not act
    if (/\b(?:is|are|will|would|could|can)\b[^.?!]{0,12}\b(?:he|reshad|you)\b[^.?!]{0,20}\b(?:free|available|around|in town|reachable)\b/.test(t)) return 'offer';
    if (/\b(?:his|your)\s+(?:availability|calendar|free time)\b/.test(t)) return 'offer';
    if (/\b(?:free|available)\s+(?:on|at|this|next|tomorrow|today|tonight)\b/.test(t)) return 'offer';
    if (/\b(?:contact|reach|reach out to|get in touch with|hire|interview|message|email)\s+(?:him|reshad)\b/.test(t)) return 'offer';
    if (/\bget in touch\b/.test(t)) return 'offer';
    // "what is his email?" -- the model only has the resume, which carries no contact details.
    if (/\b(?:his|reshad'?s|your)\s+(?:e-?mail(?:\s+address)?|phone(?:\s+number)?|mobile|whatsapp|linkedin|contact\s+(?:info\w*|details?))(?=\s*(?:[?.!,;]|$)|\s+(?:please|pls|for|so|and|or|to|if)\b)/.test(t)) return 'offer';
    if (/\b(?:work(?:ing)?|collaborat\w*|partner\w*)\s+with\s+(?:him|reshad)\b/.test(t)) return 'offer';
    return '';
  }

  // Who is asking? Picks the answer and the links that help them most.
  function bkVisitorKind(text) {
    var t = bkNorm(text);
    if (/\b(?:phd|ph\.d|supervis\w*|professor|advisor|admissions?|lab|research group|collaborat\w*|papers?|publications?)\b/.test(t)) return 'academic';
    if (/\b(?:hire|hiring|recruit\w*|jobs?|roles?|positions?|openings?|vacanc\w*|opportunit\w*|intern(?:ship)?|full[- ]?time|employ\w*)\b/.test(t)) return 'hire';
    if (/\b(?:freelanc\w*|contract|consult\w*|gig|startup|project for|build (?:us|me|a))\b/.test(t)) return 'project';
    if (/\b(?:contact|reach|e-?mail|get in touch|linkedin|phone|number|address)\b/.test(t)) return 'contact';
    return 'general';
  }

  // Typed answers to an offer, so "yes please" works as well as the button.
  function bkIsAffirmative(text) {
    var t = bkNorm(text);
    return t.length <= 40 && !/thank/.test(t) && /^(?:yes|yeah|yep|yup|sure|please|go ahead|do it|set it up|send it|why not|let'?s do it)\b/.test(t);
  }
  function bkIsNegative(text) {
    var t = bkNorm(text);
    return t.length <= 40 && /^(?:no|nope|nah|not now|not yet|maybe later|no thanks|no thank you|i'?m good|i am good)\b/.test(t);
  }

  function bkAddDays(now, n) {
    var d = new Date(Date.UTC(now.y, now.m, now.d + n));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), rel: '' };
  }
  function bkValidDate(y, m, d) {
    var x = new Date(Date.UTC(y, m, d));
    return x.getUTCFullYear() === y && x.getUTCMonth() === m && x.getUTCDate() === d;
  }

  // Clock times. Explicit am/pm or 24h are exact. A bare "at 8" is exact only when the
  // message names a part of the day ("tomorrow evening at 8"); otherwise it is kept as typed
  // and flagged, never guessed -- the visitor sees the field and can correct it.
  function bkParseTime(t) {
    var m = t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/);
    if (m) {
      var h = parseInt(m[1], 10), mi = m[2] ? parseInt(m[2], 10) : 0, pm = m[3].charAt(0) === 'p';
      if (h >= 1 && h <= 12 && mi <= 59) return { h: (h % 12) + (pm ? 12 : 0), mi: mi, exact: true };
    }
    m = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (m) return { h: parseInt(m[1], 10), mi: parseInt(m[2], 10), exact: true };
    if (/\bnoon\b/.test(t)) return { h: 12, mi: 0, exact: true };
    if (/\bmidnight\b/.test(t)) return { h: 0, mi: 0, exact: true };
    m = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?(?![\d:])(?!\s*(?:a|p)\.?m)/);
    if (m) {
      var hh = parseInt(m[1], 10), mm = m[2] ? parseInt(m[2], 10) : 0;
      if (hh >= 1 && hh <= 12 && mm <= 59) {
        var q = t.match(/\b(morning|afternoon|evening|tonight|night)\b/);
        if (q) return { h: (hh % 12) + (q[1] === 'morning' ? 0 : 12), mi: mm, exact: true };
        return { h: hh, mi: mm, exact: false };
      }
    }
    return null;
  }

  // Dates, resolved against the VISITOR's current date. A weekday name means the nearest
  // upcoming one; if it is that weekday today it means next week, unless the message gives a
  // time that is still ahead today. "next monday" and "monday" resolve the same way.
  function bkParseDate(t, now, time) {
    var m = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/), i;
    if (m && bkValidDate(+m[1], +m[2] - 1, +m[3])) return { y: +m[1], m: +m[2] - 1, d: +m[3], rel: '' };
    var dayNum, monName, yearNum;
    m = t.match(BK_DM_RE);
    if (m) { dayNum = +m[1]; monName = m[2]; yearNum = m[3]; }
    else {
      m = t.match(BK_MD_RE);
      if (m) { monName = m[1]; dayNum = +m[2]; yearNum = m[3]; }
    }
    if (m && monName) {
      var mo = BK_MONTHS3[monName.slice(0, 3)], y = yearNum ? +yearNum : now.y;
      if (!yearNum && (mo < now.m || (mo === now.m && dayNum < now.d))) y += 1;
      if (bkValidDate(y, mo, dayNum)) return { y: y, m: mo, d: dayNum, rel: '' };
    }
    if (/\bday after tomorrow\b/.test(t)) { i = bkAddDays(now, 2); i.rel = 'Day after tomorrow'; return i; }
    if (/\btomorrow\b/.test(t)) { i = bkAddDays(now, 1); i.rel = 'Tomorrow'; return i; }
    if (/\b(?:today|tonight)\b/.test(t)) { i = bkAddDays(now, 0); i.rel = /\btonight\b/.test(t) ? 'Tonight' : 'Today'; return i; }
    m = t.match(BK_DAY_RE);
    if (m) {
      var word = m[2], prefix = m[1], dow = BK_FULL_DAYS[word];
      if (dow === undefined && (prefix || !/^(?:sun|mon|wed|sat)$/.test(word))) dow = BK_ABBR_DAYS[word];
      if (dow !== undefined) {
        var delta = (dow - now.dow + 7) % 7;
        if (delta === 0 && !(time && time.exact && time.h * 60 + time.mi > now.h * 60 + now.mi)) delta = 7;
        return bkAddDays(now, delta);
      }
    }
    return null;
  }

  // Offset of `tz` at a UTC instant, in minutes (Intl only; no library, no network).
  function bkTzOffsetMinutes(utcMs, tz) {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var p = {};
    f.formatToParts(new Date(utcMs)).forEach(function (x) { p[x.type] = x.value; });
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - utcMs) / 60000);
  }
  // Wall-clock time in `tz` -> UTC ms. Two passes so a DST boundary lands correctly.
  function bkWallToUtc(y, m, d, h, mi, tz) {
    var guess = Date.UTC(y, m, d, h, mi), off = bkTzOffsetMinutes(guess, tz), utc = guess - off * 60000;
    var off2 = bkTzOffsetMinutes(utc, tz);
    return off2 === off ? utc : guess - off2 * 60000;
  }
  function bkClock(h, mi) {
    return (h % 12 === 0 ? 12 : h % 12) + ':' + (mi < 10 ? '0' : '') + mi + ' ' + (h >= 12 ? 'PM' : 'AM');
  }
  function bkOwnerTimeNote(date, time, tz) {
    try {
      if (!date || !time || !time.exact || !tz || tz === BK_OWNER_TZ || typeof Intl === 'undefined') return '';
      var utc = bkWallToUtc(date.y, date.m, date.d, time.h, time.mi, tz), p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: BK_OWNER_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
        .formatToParts(new Date(utc)).forEach(function (x) { p[x.type] = x.value; });
      return p.weekday + ' ' + p.day + ' ' + p.month + ', ' + p.hour + ':' + p.minute + ' ' + String(p.dayPeriod || '').toUpperCase();
    } catch (e) { return ''; }
  }

  function bkExtractName(text) {
    var s = String(text || '');
    var m = s.match(/\bmy name(?: is|'s|’s)\s+([A-Za-z][A-Za-z'’.-]*(?:\s+[A-Za-z][A-Za-z'’.-]*){0,2})/i) ||
      s.match(/\b(?:I['’]m|I am|this is)\s+([A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*){0,2})/);
    if (!m) return '';
    var words = m[1].replace(/[.,;:!?]+$/, '').split(/\s+/), out = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i].toLowerCase().replace(/[^a-z]/g, '');
      // stop at filler ("my name is Sara and I...") and never treat a weekday/month as a name
      if (BK_NAME_STOP_RE.test(words[i]) || BK_FULL_DAYS[w] !== undefined || BK_MONTH_WORD_RE.test(w)) break;
      out.push(words[i]);
    }
    return out.join(' ').replace(/[.,;:!?]+$/, '').slice(0, 120);
  }

  // The reason for the request, only when the visitor actually gave one ("...to discuss a PhD
  // position"). Echoing "can we meet on monday" into the purpose field would tell Reshad
  // nothing, so otherwise it stays empty and the visitor writes a line.
  function bkExtractTopic(text) {
    var m = String(text || '').match(/\b(?:about|regarding|concerning|to discuss|discussing|discuss)\s+(.{3,200})$/i);
    return m ? m[1].replace(/[\s.?!,;:]+$/, '').slice(0, 2000) : '';
  }

  // `now` is the visitor's current wall-clock { y, m (0-11), d, dow, h, mi }; `tz` their IANA zone.
  function extractBooking(text, now, tz) {
    var raw = String(text || ''), t = bkNorm(raw);
    var em = raw.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
    var time = bkParseTime(t), date = bkParseDate(t, now, time);
    var dayText = '', timeText = '', qual = t.match(/\b(morning|afternoon|evening)\b/);
    if (date) {
      var dow = new Date(Date.UTC(date.y, date.m, date.d)).getUTCDay();
      var dl = BK_DAY_LABELS[dow] + ' ' + date.d + ' ' + BK_MONTH_LABELS[date.m] + ' ' + date.y;
      dayText = date.rel ? date.rel + ' (' + dl + ')' : dl;
    } else if (/\bweekend\b/.test(t)) {
      dayText = /\bnext\b/.test(t) ? 'Next weekend' : 'This weekend';
    }
    if (time) {
      timeText = time.exact ? bkClock(time.h, time.mi)
        : time.h + (time.mi ? ':' + (time.mi < 10 ? '0' : '') + time.mi : '') + ' (AM/PM not specified)';
    } else if (qual) {
      timeText = qual[1];
    }
    var when = [dayText, timeText].filter(Boolean).join(', ');
    if (when && tz) {
      var note = bkOwnerTimeNote(date, time, tz);
      when += tz === BK_OWNER_TZ ? ' (Dhaka time)'
        : ' (visitor time zone: ' + tz + (note ? '; = ' + note + ' Dhaka' : '') + ')';
    }
    return {
      name: bkExtractName(raw),
      email: em ? em[0] : '',
      purpose: bkExtractTopic(raw),
      preferredTimes: when.slice(0, 300)
    };
  }

  // While a request form is open, a short message that only adds a day/time, an email or a
  // name is an update to that form, not a question for the model ("thursday 6pm works", "I'm
  // Sara, sara@x.com"). Questions ("what did he do on monday?") still go to the model.
  function bkIsFormUpdate(text, now) {
    var raw = String(text || '');
    if (raw.length > 300) return false;
    var t = bkNorm(raw);
    if (/\b(?:what|how(?!\s+about)|why|which|who|whom|whose|where|tell me|explain|describe|show|does|did)\b/.test(t)) return false;
    var time = bkParseTime(t);
    return !!(time || bkParseDate(t, now, time) ||
      /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/.test(raw) || bkExtractName(raw));
  }

  // Scheduling services a booking link may point to. The host must be followed by "/", so
  // look-alikes such as https://cal.com.evil.com/ or https://cal.com@evil.com/ are rejected.
  var BK_BOOKING_URL_RE = /^https:\/\/(?:calendar\.google\.com|calendar\.app\.google|(?:www\.)?cal\.com|calendly\.com)\//;
  var BK_PREFILL_URL_RE = /^https:\/\/(?:(?:www\.)?cal\.com|calendly\.com)\//;
  function bkIsBookingUrl(url) { return typeof url === 'string' && BK_BOOKING_URL_RE.test(url); }

  // Hand the booking page what the visitor already told the assistant, so they only choose a
  // slot. Cal.com and Calendly take name and email as query parameters (Cal.com also notes); a
  // Google booking page takes none, so its link is returned untouched.
  function bkBookingLink(url, details) {
    if (!bkIsBookingUrl(url) || !BK_PREFILL_URL_RE.test(url) || !details) return url;
    var parts = [];
    function add(key, value) { if (value) parts.push(key + '=' + encodeURIComponent(value)); }
    add('name', details.name);
    add('email', details.email);
    if (/^https:\/\/(?:www\.)?cal\.com\//.test(url)) {
      add('notes', [details.purpose, details.preferredTimes ? 'Preferred time: ' + details.preferredTimes : ''].filter(Boolean).join('\n'));
    }
    return parts.length ? url + (url.indexOf('?') > -1 ? '&' : '?') + parts.join('&') : url;
  }

  // The model sometimes points at something that is not there ("use the booking link below:")
  // while the widget, which owns every button and link, attached nothing. True for an answer
  // that ends on a colon or names a link/button/form "below".
  function bkDanglingRef(text) {
    var t = String(text || '').trim();
    return /:\s*$/.test(t) ||
      /\b(?:links?|buttons?|forms?|cards?|calendar|booking(?:\s+\w+)?)\s+(?:is\s+|are\s+)?(?:right\s+|just\s+)?below\b/i.test(t);
  }

  // "CAMDet — Camera-Agnostic Metric 3D Detection — Reshad Ul Karim" -> "CAMDet": the name a
  // person would say, for greetings and "Tell me more about ..." suggestions.
  function bkShortTitle(title) {
    var s = String(title || '').split(/\s+[—–|]\s+|:\s/)[0].trim();
    return s.length > 48 ? s.slice(0, 45).replace(/\s+\S*$/, '') + '…' : s;
  }

  // What to call someone: "Sara Ahmed" -> "Sara", but "Prof. Lena Ortiz" -> "Prof. Ortiz".
  function bkGreetName(name) {
    var words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    var m = words[0].match(/^(dr|prof|professor|mr|mrs|ms|miss|mx|sir|dame)\.?$/i);
    if (!m) return words[0];
    if (words.length < 2) return words[0].replace(/\.$/, '');
    var title = /^professor$/i.test(m[1]) ? 'Professor' : m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() + (/^(sir|dame|miss)$/i.test(m[1]) ? '' : '.');
    return title + ' ' + words[words.length - 1];
  }
  // END booking-intent

  function bkNowParts() {
    var d = new Date();
    return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), dow: d.getDay(), h: d.getHours(), mi: d.getMinutes() };
  }
  function bkVisitorTz() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  }
  function bkDay(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (e) { return 'earlier'; }
  }

  // What the visitor said in this message, topped up with the name and email they gave earlier
  // in the chat, so the form and the booking page never ask twice.
  function bookingDetails(question) {
    var d = extractBooking(question, bkNowParts(), bkVisitorTz()), v = visitor();
    if (!d.name && v.name) d.name = v.name;
    if (!d.email && v.email) d.email = v.email;
    return d;
  }

  // <<BOOK>> from the model is stripped from the displayed text and rendered as a card,
  // never left as literal text a visitor would see (see persona.md). The model does not
  // always write it bare at the very end -- it has wrapped it in backticks or quotes, which
  // used to defeat an end-anchored match -- so find it anywhere and swallow stray quote marks.
  var BOOK_MARKER_TEST_RE = /<<\s*BOOK\s*>>/i;
  var BOOK_MARKER_ANY_RE = /[`'"‘’“”]*<<\s*BOOK\s*>>[`'"‘’“”]*/gi;
  function stripBookMarker(text) {
    return String(text).replace(BOOK_MARKER_ANY_RE, '').replace(/[ \t]+\n/g, '\n').trim();
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // The model writes real markdown (persona.md never tells it not to) -- **bold**,
  // occasional links, inline `code`. Rendering it as literal asterisks was the bug; this is
  // deliberately a small, fixed allow-list of patterns over ESCAPED text, not a markdown
  // library, since the only content ever passed through it is our own server's answer text.
  function renderMarkdown(text) {
    var html = escapeHtml(text);
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    return html
      .split(/\n{2,}/)
      .map(function (para) { return '<p>' + para.replace(/\n/g, '<br>') + '</p>'; })
      .join('');
  }

  // opts (live messages only, never a transcript restore):
  //   { booking: details } -- the visitor asked to meet: show the form, pre-filled
  //   { question }         -- a model reply. If it carries <<BOOK>>, honour it as a FORM only
  //                           when the visitor really asked to meet; otherwise offer once,
  //                           and never after a "no" (the model must not push a meeting).
  function renderMessage(role, text, citations, opts) {
    var row = document.createElement('div');
    row.className = 'ask-message ask-message--' + role;
    var bubble = document.createElement('div');
    bubble.className = 'ask-bubble';

    var marker = role === 'assistant' && BOOK_MARKER_TEST_RE.test(text);
    var clean = role === 'assistant' ? stripBookMarker(text) : text;
    if (role === 'assistant') {
      bubble.innerHTML = renderMarkdown(clean);
    } else {
      bubble.textContent = clean;
    }
    row.appendChild(bubble);

    if (role === 'assistant') renderCitations(row, citations);
    var card = null, offerFor = '';
    if (role === 'assistant' && opts && opts.booking) {
      card = openOrBuildCard(opts.booking);
    } else if (marker && opts && opts.question) {
      if (classifyBookingIntent(opts.question) === 'request') {
        card = openOrBuildCard(bookingDetails(opts.question));
      } else if (canOffer()) {
        offerFor = opts.question;
      }
    }
    if (card) row.appendChild(card);

    messagesEl.appendChild(row);
    scrollToBottom();
    if (card && opts) {
      // A card taller than the panel would otherwise open scrolled to its bottom, with the
      // fields the visitor must fill (and the focused box) out of sight above.
      var rr = row.getBoundingClientRect(), mr = messagesEl.getBoundingClientRect();
      if (rr.height > mr.height) messagesEl.scrollTop += rr.top - mr.top - 8;
      focusBookingCard(card);
    }
    if (offerFor) attachOffer(row, offerFor);
    else if (role === 'assistant' && opts && opts.question && !card && bkDanglingRef(clean)) {
      // The answer says "see the link below" but no offer was attached (offers capped, or the
      // visitor said no): give it the real links rather than leave it pointing at nothing.
      row.appendChild(buildPassiveLinks(opts.question));
      scrollToBottom();
    }
    return row;
  }

  function renderTyping() {
    var row = document.createElement('div');
    row.className = 'ask-message ask-message--assistant ask-message--typing';
    row.innerHTML =
      '<div class="ask-bubble ask-typing-wrap">' +
      '<div class="ask-typing-dots"><span></span><span></span><span></span></div>' +
      '</div>';
    messagesEl.appendChild(row);
    scrollToBottom();
    return row;
  }

  // ---- 6. Booking card (see docs/AI_ASSISTANT_PLAN.md sec.6) ---------------
  function bookingField(card, name) { return card.querySelector('[name="' + name + '"]'); }

  // Fill from extracted details. A new time always replaces the old one; name, email and
  // purpose only fill an empty field, so nothing the visitor typed is overwritten.
  function fillBookingCard(card, v) {
    if (!v) return;
    var map = { name: v.name, email: v.email, purpose: v.purpose };
    Object.keys(map).forEach(function (k) {
      var el = bookingField(card, k);
      if (el && map[k] && !el.value.trim()) el.value = map[k];
    });
    if (v.preferredTimes) bookingField(card, 'preferred_times').value = v.preferredTimes;
  }

  function focusBookingCard(card) {
    var order = ['name', 'email', 'purpose'];
    for (var i = 0; i < order.length; i++) {
      var el = bookingField(card, order[i]);
      if (el && !el.value.trim()) {
        try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
        return;
      }
    }
  }

  // One open form at a time: refill it and move it under the newest message (appendChild moves
  // an existing node), so it is never left scrolled out of sight above.
  function openBookingCard() {
    var open = messagesEl.querySelectorAll('.ask-booking-card[data-open="1"]');
    return open.length ? open[open.length - 1] : null;
  }
  function openOrBuildCard(details) {
    var card = openBookingCard();
    if (card) fillBookingCard(card, details); else card = buildBookingCard(details);
    return card;
  }
  // Is the open form still part of the live conversation (one of the last few messages)?
  function recentOpenCard() {
    var card = openBookingCard();
    if (!card) return null;
    var row = card.parentNode, kids = messagesEl.children;
    return Array.prototype.indexOf.call(kids, row) >= kids.length - 5 ? card : null;
  }

  function buildBookingCard(initial) {
    var card = document.createElement('form');
    card.className = 'ask-booking-card';
    card.setAttribute('data-open', '1'); // still unsent: a later request refills it, not a second card
    card.innerHTML =
      '<p class="ask-booking-title">Send Reshad a request</p>' +
      '<p class="ask-booking-hint">Add what you would like to discuss and check the details. Nothing is sent until you press Send. Your last few messages here go with it for context, and Reshad will follow up by email.</p>' +
      '<label>Name<input type="text" name="name" required></label>' +
      '<label>Email<input type="email" name="email" required></label>' +
      '<label>What would you like to talk about?<textarea name="purpose" rows="2" required placeholder="For example: a role, a research collaboration, a question about a project"></textarea></label>' +
      '<label>Preferred times (optional)<input type="text" name="preferred_times"></label>' +
      // Honeypot: real visitors never see or fill this (see CSS); a bot filling every
      // field on the form will fill this one too.
      '<label class="ask-booking-honeypot" aria-hidden="true">Leave blank<input type="text" name="website" tabindex="-1" autocomplete="off"></label>' +
      '<div class="ask-booking-actions">' +
      '<button type="submit" class="ask-booking-submit">Send</button>' +
      '<button type="button" class="ask-booking-dismiss">Not now</button>' +
      '</div>' +
      '<p class="ask-booking-status" aria-live="polite"></p>';
    fillBookingCard(card, initial);

    card.querySelector('.ask-booking-dismiss').addEventListener('click', function () {
      ssSet(SS_DECLINED_KEY, '1'); // they said no: no more soft offers this session
      if (card.parentNode) card.parentNode.removeChild(card);
      sayNoProblem();
    });

    card.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var status = card.querySelector('.ask-booking-status');
      var submitBtn = card.querySelector('.ask-booking-submit');
      var payload = {
        name: card.name.value.trim(),
        email: card.email.value.trim(),
        purpose: card.purpose.value.trim(),
        preferred_times: card.preferred_times.value.trim(),
        website: card.website.value, // honeypot
        page: pageContext(),
        recent_history: loadTranscript().slice(-3).map(function (t) { return { question: t.question, answer: t.answer }; })
      };
      submitBtn.disabled = true;
      status.textContent = 'Sending…';
      // The API sleeps when idle (free tier); say so instead of looking frozen.
      var wakeTimer = window.setTimeout(function () {
        status.textContent = 'Waking up the assistant — this can take a bit…';
      }, COLD_START_HINT_MS);
      fetch(API_BASE + '/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        window.clearTimeout(wakeTimer);
        if (!res.ok) throw new Error('bad status');
        status.textContent = "Sent — Reshad will follow up by email.";
        card.removeAttribute('data-open');
        ssSet(SS_OFFERS_KEY, String(MAX_OFFERS)); // done: no further offers this session
        card.querySelectorAll('input, textarea, button').forEach(function (el) { el.disabled = true; });
        afterRequestSent(payload);
      }).catch(function () {
        window.clearTimeout(wakeTimer);
        submitBtn.disabled = false;
        status.textContent = 'Something went wrong — try again, or email him directly.';
      });
    });
    return card;
  }

  // ---- 6b. Soft offers: answer first, ask second ---------------------------------------
  var SS_DECLINED_KEY = 'askReshad.declinedBooking';
  var SS_OFFERS_KEY = 'askReshad.offersShown';
  var MAX_OFFERS = 2;
  var BK_CV_PATH = 'assets/papers/Reshad_Ul_Karim_Resume.pdf';
  var activeOffer = null; // { wrap, row, details } -- the offer a typed "yes" or "no" answers

  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* not fatal */ } }
  function offersShown() { return parseInt(ssGet(SS_OFFERS_KEY) || '0', 10) || 0; }
  function canOffer() { return ssGet(SS_DECLINED_KEY) !== '1' && offersShown() < MAX_OFFERS; }

  // Wording stays true without the buttons, because only the text survives a reload. Nothing
  // here claims availability, and every answer points at something the visitor can use now.
  var BK_OFFERS = {
    hire: {
      text: "Reshad's site says he's open to AI/ML roles. His CV and projects are the quickest way to see if there's a fit, and if you'd like to talk with him, just say so and I'll pass on a request.",
      links: [{ label: 'Download CV', path: BK_CV_PATH, download: true }, { label: 'See projects', hash: '#projects' }],
      ask: 'Send him a request'
    },
    academic: {
      text: "Reshad is looking for PhD and research opportunities, and his publications and research projects are on this site. If you'd like to reach him, just say so and I'll pass on a message.",
      links: [{ label: 'See publications', hash: '#research' }, { label: 'Download CV', path: BK_CV_PATH, download: true }],
      ask: 'Send him a message'
    },
    project: {
      text: "I can't speak for his availability on projects, but his work is on this site. If you'd like to discuss something with him, just say so and I'll pass on a message.",
      links: [{ label: 'See projects', hash: '#projects' }],
      ask: 'Send him a message'
    },
    contact: {
      text: "His email and profiles are in the Contact section of this page. If you'd rather, just say so and I'll pass a message to him.",
      links: [{ label: 'Open Contact section', hash: '#contact' }],
      ask: 'Send him a message'
    },
    general: {
      text: "I can't see Reshad's calendar, so I can't say when he's free. If you'd like to talk with him, just say so and I'll pass on a request, and he'll follow up by email.",
      links: [],
      ask: 'Send him a request'
    }
  };

  // ---- 6c. Booking page (a Google Calendar appointment schedule) --------------------------
  // data/booking.json holds { "url": "<booking page link>" }. Empty means "not set up yet" and
  // everything behaves as before (the request form only). Once set, visitors can pick an open
  // slot on Reshad's real calendar and the scheduling service (Cal.com, Calendly or a Google
  // booking page) books it and emails both sides. Only those hosts are accepted, so a bad edit
  // can never point visitors elsewhere.
  var bookingUrl = '';

  function revealBookingLinks() {
    if (!bookingUrl) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-booking-link]'), function (a) {
      a.href = bookingUrl;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-booking-item]'), function (el) {
      el.hidden = false;
    });
  }

  function loadBookingConfig() {
    return fetch(BASE + 'data/booking.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (cfg && bkIsBookingUrl(cfg.url)) bookingUrl = cfg.url;
        revealBookingLinks();
      })
      .catch(function () { /* optional file: its absence is the normal "not set up" state */ });
  }

  // Appended to an answer when a booking page exists. It is a markdown link, so it is part of
  // the stored text and still works after a reload, when the buttons are gone.
  function bookingSentence() {
    return bookingUrl
      ? ' You can also [pick an open time on his calendar](' + bookingUrl + '); you will both get a calendar invitation.'
      : '';
  }

  function homeHref(hash) { return pageContext().kind === 'home' ? hash : BASE + 'index.html' + hash; }

  function declineOffer(offer) {
    ssSet(SS_DECLINED_KEY, '1');
    if (offer.wrap.parentNode) offer.wrap.parentNode.removeChild(offer.wrap);
    activeOffer = null;
  }
  function acceptOffer(offer) {
    if (offer.wrap.parentNode) offer.wrap.parentNode.removeChild(offer.wrap);
    activeOffer = null;
    var card = openOrBuildCard(offer.details);
    offer.row.appendChild(card);
    scrollToBottom();
    focusBookingCard(card);
  }

  function buildPickLink(details) {
    var pick = document.createElement('a');
    pick.className = 'ask-offer-btn ask-offer-btn--primary';
    pick.textContent = 'Pick a time';
    pick.href = bkBookingLink(bookingUrl, details);
    pick.target = '_blank';
    pick.rel = 'noopener noreferrer';
    return pick;
  }

  // Links only -- no "send a request" / "no thanks" buttons, so it never counts as an offer and
  // is safe after the visitor declined one.
  function buildPassiveLinks(question) {
    var wrap = document.createElement('div');
    wrap.className = 'ask-offer-actions';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Ways to reach Reshad');
    if (bookingUrl) wrap.appendChild(buildPickLink(bookingDetails(question)));
    var contact = document.createElement('a');
    contact.className = 'ask-offer-btn' + (bookingUrl ? '' : ' ask-offer-btn--primary');
    contact.textContent = 'Open Contact section';
    contact.href = homeHref('#contact');
    wrap.appendChild(contact);
    return wrap;
  }

  function buildOfferActions(def, details, row) {
    var wrap = document.createElement('div');
    wrap.className = 'ask-offer-actions';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Next steps');
    if (bookingUrl) wrap.appendChild(buildPickLink(details));
    appendLinks(wrap, def.links);
    var yes = document.createElement('button');
    yes.type = 'button';
    // With a booking page, picking a time is the main action and the request is the fallback.
    yes.className = 'ask-offer-btn' + (bookingUrl ? '' : ' ask-offer-btn--primary');
    yes.textContent = bookingUrl && def.ask === 'Send him a request' ? 'Send a request instead' : def.ask;
    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'ask-offer-btn';
    no.textContent = 'No thanks';
    var offer = { wrap: wrap, row: row, details: details };
    yes.addEventListener('click', function () { acceptOffer(offer); });
    no.addEventListener('click', function () {
      declineOffer(offer);
      sayNoProblem();
    });
    wrap.appendChild(yes);
    wrap.appendChild(no);
    activeOffer = offer;
    return wrap;
  }

  function appendLinks(wrap, links) {
    links.forEach(function (l) {
      var a = document.createElement('a');
      a.className = 'ask-offer-btn';
      a.textContent = l.label;
      a.href = l.path ? BASE + l.path : homeHref(l.hash);
      if (l.download) a.setAttribute('download', '');
      wrap.appendChild(a);
    });
  }

  function sayNoProblem() {
    renderMessage('assistant', 'No problem. Ask me anything about his work.', null);
    showSuggestions(nextSuggestions());
  }

  // ---- 6d. After a meeting is arranged: say what happens next, then keep helping ------------
  // A turn the visitor did not type (a sent form, a visit to the booking page). Stored so it
  // survives a reload and the model knows about it, but shown without a user bubble.
  function recordNote(question, answer) {
    var transcript = loadTranscript();
    transcript.push({ question: question, answer: answer, note: true });
    saveTranscript(transcript);
  }

  function afterRequestSent(p) {
    rememberVisitor({ name: p.name, email: p.email, formName: p.name, requestedAt: new Date().toISOString() });
    var plain = function (s) { return String(s).replace(/[\[\]*`_]/g, ''); }; // visitor text, not markdown
    var head = 'All set, ' + plain(bkGreetName(p.name)) + '. Your request is with Reshad.\n\n**Topic:** ' + plain(p.purpose) +
      (p.preferred_times ? '\n**Preferred time:** ' + plain(p.preferred_times) : '');
    var tail = 'In the meantime I can brief you on his background or walk you through any of his work.';
    // The email is shown so a typo can be caught, but kept out of the stored copy (which is sent
    // back to the model with later questions).
    renderMessage('assistant', head + '\n\nNothing is booked yet: he will reply to ' + plain(p.email) + ' to agree a time. ' + tail, null);
    recordNote('I sent Reshad a meeting request.', head + '\n\nNothing is booked yet: he will reply by email to agree a time. ' + tail);
    showSuggestions(nextSuggestions(null, AFTER_BOOKING));
  }

  // "Pick a time" opens the booking page in a new tab, so the chat cannot see whether a slot
  // was booked. When the visitor comes back to this tab, say what to expect either way.
  function watchBookingPageVisits() {
    messagesEl.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
      if (a && bookingUrl && a.href.indexOf(bookingUrl) === 0) ssSet(SS_PICKED_KEY, String(Date.now()));
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      var since = Date.now() - (parseInt(ssGet(SS_PICKED_KEY) || '0', 10) || 0);
      if (since < 15000 || since > 3 * 3600000) return; // too quick to have booked, or long ago
      ssSet(SS_PICKED_KEY, '');
      var text = 'If you booked a time, the confirmation email has the date, time and video link, and Reshad gets the same invitation. Anything you would like to know before the call?';
      renderMessage('assistant', text, null);
      recordNote('I opened his booking page.', text);
      ssSet(SS_OFFERS_KEY, String(MAX_OFFERS)); // they have the calendar: no more offers
      showSuggestions(nextSuggestions(null, AFTER_BOOKING));
    });
  }

  // An offer is "live" while its buttons are still on screen and near the end of the chat,
  // so a typed "yes" or "no" answers it and an old, scrolled-away one is ignored.
  function liveOffer() {
    if (!activeOffer || !activeOffer.wrap.parentNode) return null;
    var kids = messagesEl.children;
    return Array.prototype.indexOf.call(kids, activeOffer.row) >= kids.length - 4 ? activeOffer : null;
  }

  // Attach the buttons to an existing assistant message (the model's own reply).
  function attachOffer(row, question) {
    var def = BK_OFFERS[bkVisitorKind(question)] || BK_OFFERS.general;
    row.appendChild(buildOfferActions(def, bookingDetails(question), row));
    noteOfferShown();
    scrollToBottom();
  }
  function noteOfferShown() { ssSet(SS_OFFERS_KEY, String(offersShown() + 1)); }

  function recordTurn(question, answer) {
    var transcript = loadTranscript();
    transcript.push({ question: question, answer: answer });
    saveTranscript(transcript);
  }

  // The visitor asked to meet: open the form, pre-filled, and say plainly what it does.
  function handleBookingRequest(question) {
    var details = bookingDetails(question);
    if (bookingUrl && !openBookingCard()) {
      // The visitor asked to meet and Reshad has a booking page: real open slots beat a form
      // that waits for a reply. The request form stays one tap away as the fallback.
      var pickText = "I can't confirm a time for Reshad myself, but you can [pick an open slot on his calendar](" +
        bookingUrl + ') and you will both get a calendar invitation.';
      var pickRow = renderMessage('assistant', pickText, null);
      pickRow.appendChild(buildOfferActions({ links: [], ask: 'Send him a request' }, details, pickRow));
      scrollToBottom();
      recordTurn(question, pickText);
      return;
    }
    // Stored with the transcript, so both wordings must stay true after a reload, when the
    // card is gone.
    var text = openBookingCard()
      ? "I've updated your request to Reshad with those details."
      : "I can't see Reshad's calendar or confirm a time, but I can pass your request on to him if you'd like.";
    renderMessage('assistant', text, null, { booking: details });
    recordTurn(question, text);
  }

  // A softer signal: answer with something useful, offer the request, do not open a form.
  function handleBookingOffer(question) {
    var def = BK_OFFERS[bkVisitorKind(question)] || BK_OFFERS.general;
    var text = def.text + bookingSentence();
    var row = renderMessage('assistant', text, null);
    row.appendChild(buildOfferActions(def, bookingDetails(question), row));
    noteOfferShown();
    scrollToBottom();
    recordTurn(question, text);
  }

  // "How can I reach him?" has one true answer, so it is answered here and never by the model,
  // even after offers were declined or capped. The model's wording varied, and once sent a
  // visitor to a "booking link below" that was never attached. No request/"no thanks" buttons.
  function handleContactInfo(question) {
    var text = 'His email and profiles are in the Contact section of this page.' + bookingSentence();
    var row = renderMessage('assistant', text, null);
    row.appendChild(buildPassiveLinks(question));
    scrollToBottom();
    recordTurn(question, text);
    showSuggestions(nextSuggestions());
  }

  // Keep what the visitor tells us about themselves (name, email, why they're here), so later
  // replies, suggestions and the booking form use it instead of asking again.
  function learnFromMessage(question) {
    var said = extractBooking(question, bkNowParts(), bkVisitorTz());
    var patch = { name: said.name, email: said.email };
    var kind = bkVisitorKind(question);
    var role = visitor().role; // a stated reason beats "just looking"
    if ((!role || role === 'general') && (kind === 'hire' || kind === 'academic' || kind === 'project')) patch.role = kind;
    rememberVisitor(patch);
  }

  // Appended NEXT TO the dots, not instead of them -- the animation is the whole point of a
  // loading state, and losing it the moment a wait gets long is backwards.
  function setTypingLabel(typingRow, text) {
    var wrap = typingRow.querySelector('.ask-typing-wrap');
    if (!wrap) return;
    var label = wrap.querySelector('.ask-cold-start-label');
    if (!label) {
      label = document.createElement('div');
      label.className = 'ask-cold-start-label';
      wrap.appendChild(label);
    }
    label.textContent = text;
  }

  // One automatic retry when the model is briefly busy (Mistral's free tier rate-limits even at
  // low traffic, and the same question works a few seconds later) or the API is unreachable, so
  // a passing hiccup never reaches the visitor. Once only: retrying a rate limit in a loop feeds
  // the limit it is waiting out. Waits what the API says (retry_after_s), within 2-12 s.
  var RETRY_STATUSES = { 429: true, 502: true, 503: true, 504: true };
  function postAsk(body) {
    return fetch(API_BASE + '/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (res.ok) return res.json();
      return res.json().catch(function () { return {}; }).then(function (b) {
        var err = new Error('bad status ' + res.status);
        err.retryable = !!RETRY_STATUSES[res.status];
        err.waitS = b && b.error && b.error.retry_after_s;
        throw err;
      });
    });
  }
  function askWithRetry(body, onRetry) {
    return postAsk(body).catch(function (err) {
      if (!err.retryable && !(err instanceof TypeError)) throw err; // TypeError: network failure
      onRetry();
      var waitMs = Math.min(Math.max((Number(err.waitS) || 3) * 1000, 2000), 12000);
      return new Promise(function (resolve) { window.setTimeout(resolve, waitMs); })
        .then(function () { return postAsk(body); });
    });
  }

  // ---- 7. Ask -> POST /api/ask ---------------------------------------------
  function handleAsk(question) {
    chipsEl.hidden = true;
    renderMessage('user', question, null);
    noteAsked(question);
    learnFromMessage(question);
    // A request to meet him goes straight to the booking form -- no model call (section 5b).
    // Booking (section 5b): act only on what the visitor actually asked for.
    var pending = liveOffer();
    if (pending && bkIsAffirmative(question)) {
      acceptOffer(pending);
      recordTurn(question, "Okay, I can pass your request on to him.");
      return;
    }
    if (pending && bkIsNegative(question)) {
      declineOffer(pending);
      sayNoProblem();
      recordTurn(question, 'No problem. Ask me anything about his work.');
      return;
    }
    var level = classifyBookingIntent(question);
    if (level === 'request' || (recentOpenCard() && bkIsFormUpdate(question, bkNowParts()))) {
      handleBookingRequest(question);
      return;
    }
    if (level === 'offer' && canOffer()) {
      handleBookingOffer(question);
      return;
    }
    if (level === 'offer' && bkVisitorKind(question) === 'contact') {
      handleContactInfo(question);
      return;
    }
    var transcript = loadTranscript();

    var typingRow = renderTyping();
    var coldStartTimer = window.setTimeout(function () {
      setTypingLabel(typingRow, 'Waking up the assistant — first request can take a bit…');
    }, COLD_START_HINT_MS);

    askWithRetry({
      question: question,
      corpus: 'persona',
      page: pageContext(),
      history: transcript.map(function (t) { return { question: t.question, answer: t.answer }; })
    }, function () {
      window.clearTimeout(coldStartTimer);
      setTypingLabel(typingRow, 'Busy for a moment — trying again…');
    })
      .then(function (data) {
        window.clearTimeout(coldStartTimer);
        typingRow.parentNode.removeChild(typingRow);
        var row = renderMessage('assistant', data.answer, data.citations, { question: question });
        // A form or an offer is the next step when one was attached; otherwise suggest questions.
        if (!row.querySelector('.ask-booking-card, .ask-offer-actions button')) showSuggestions(nextSuggestions(data.citations));
        // Stored (and later emailed via /api/book's recent_history, and sent back as history
        // on the NEXT ask) with the <<BOOK>> marker stripped -- it's UI instruction syntax,
        // not part of the answer, and leaking it into a booking email read by an actual
        // human is a real, visible bug, not a cosmetic one. Same regex the display path uses.
        transcript.push({ question: question, answer: stripBookMarker(data.answer) });
        saveTranscript(transcript);
      })
      .catch(function () {
        window.clearTimeout(coldStartTimer);
        typingRow.parentNode.removeChild(typingRow);
        renderMessage(
          'assistant',
          "Having trouble reaching the assistant right now. Try again in a moment, or reach Reshad directly.",
          null
        );
        renderChipButtons([{ label: 'Try again', run: function () { handleAsk(question); } }], 'Suggested questions');
      });
  }

  function restoreTranscript() {
    var transcript = loadTranscript();
    transcript.forEach(function (turn) {
      if (!turn.note) renderMessage('user', turn.question, null);
      // citations aren't persisted; re-shown minus chips. The question is passed so an answer
      // that points at a link "below" gets its links back after a reload.
      renderMessage('assistant', turn.answer, null, { question: turn.question });
    });
    if (transcript.length) showSuggestions(nextSuggestions());
  }

  // ---- 8. Init --------------------------------------------------------------
  function init() {
    if (document.getElementById('ask-reshad-fab')) return;
    buildFab();
    buildPanel();
    watchBookingPageVisits();
    seedReturningVisitor();
    restoreTranscript();
    buildTooltip();
    loadSlugKinds();
    loadBookingConfig();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
