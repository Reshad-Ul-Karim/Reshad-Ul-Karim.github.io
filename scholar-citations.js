/* =========================================================================
   scholar-citations.js
   Shows a LIVE Google Scholar citation count on the Academic Profiles button.

   Strategy (Scholar has no public API + blocks cross-origin browser requests):
     1. Read citations.json (same-origin, always works) — kept fresh DAILY by a
        scheduled GitHub Action (.github/workflows/update-scholar-citations.yml).
        This is the reliable source and renders instantly.
     2. Show a cached value from localStorage immediately (no flash on repeat
        visits).
     3. Best-effort LIVE refresh in the background via public CORS proxies that
        fetch the Scholar profile HTML and parse "Cited by N". This often works
        from a real browser; if a proxy is down or Scholar CAPTCHAs, we fail
        silently and keep the JSON/cached value.

   If no real number is available, the count badge stays hidden and the button
   simply links to the Scholar profile.
   ========================================================================= */
(function () {
    'use strict';

    var SCHOLAR_ID = '2ssVmugAAAAJ';
    var SCHOLAR_URL = 'https://scholar.google.com/citations?user=' + SCHOLAR_ID + '&hl=en';
    var LS_KEY = 'scholarCitations';

    var wrap = document.getElementById('scholar-citations');
    var countEl = document.getElementById('scholar-count');
    if (!wrap || !countEl) return;

    function setCount(n, when) {
        if (n === null || n === undefined || isNaN(n)) return;
        n = parseInt(n, 10);
        if (n < 0) return;
        countEl.textContent = n.toLocaleString();
        wrap.classList.add('has-count');
        if (when) {
            try {
                wrap.setAttribute('title', 'Google Scholar citations · updated ' + when);
            } catch (e) {}
        }
    }

    /* 1) Instant: cached value from a previous visit. */
    try {
        var cached = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
        if (cached && typeof cached.citations === 'number') {
            setCount(cached.citations, cached.updated ? timeAgo(cached.updated) : null);
        }
    } catch (e) {}

    /* 2) Same-origin JSON (kept fresh by the daily GitHub Action). */
    fetch('citations.json?cb=' + Date.now())
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
            if (data && typeof data.citations === 'number' && data.citations >= 0) {
                setCount(data.citations, data.updated ? timeAgo(data.updated) : null);
                cache(data.citations, data.updated);
            }
        })
        .catch(function () {});

    /* 3) Best-effort live refresh via CORS proxies (non-blocking). */
    liveRefresh();

    function liveRefresh() {
        var proxies = [
            'https://corsproxy.io/?url=' + encodeURIComponent(SCHOLAR_URL),
            'https://api.allorigins.win/raw?url=' + encodeURIComponent(SCHOLAR_URL),
            'https://thingproxy.freeboard.io/fetch/' + SCHOLAR_URL
        ];
        var i = 0;
        (function next() {
            if (i >= proxies.length) return;
            var url = proxies[i++];
            fetchWithTimeout(url, 7000)
                .then(function (r) { return r && r.ok ? r.text() : null; })
                .then(function (html) {
                    if (!html) { next(); return; }
                    var n = parseCitations(html);
                    if (n !== null) {
                        setCount(n, 'just now');
                        cache(n, new Date().toISOString());
                    } else {
                        next();
                    }
                })
                .catch(function () { next(); });
        })();
    }

    /* Parse "Cited by N" / the citations table from a Scholar profile page. */
    function parseCitations(html) {
        // The profile stats table: first <td class="gsc_rsb_std"> is total citations.
        var m = html.match(/gsc_rsb_std[^>]*>\s*([\d,]+)\s*</);
        if (m) return parseInt(m[1].replace(/,/g, ''), 10);
        // Fallback: "Cited by N"
        m = html.match(/[Cc]ited by\s*([\d,]+)/);
        if (m) return parseInt(m[1].replace(/,/g, ''), 10);
        return null;
    }

    function fetchWithTimeout(url, ms) {
        if (typeof AbortController === 'undefined') return fetch(url);
        var ctrl = new AbortController();
        var t = setTimeout(function () { ctrl.abort(); }, ms);
        return fetch(url, { signal: ctrl.signal }).then(function (r) {
            clearTimeout(t); return r;
        });
    }

    function cache(n, updated) {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify({ citations: n, updated: updated || new Date().toISOString() }));
        } catch (e) {}
    }

    function timeAgo(iso) {
        try {
            var then = new Date(iso).getTime();
            var diff = Date.now() - then;
            var d = Math.floor(diff / 86400000);
            if (d > 0) return d + (d === 1 ? ' day ago' : ' days ago');
            var h = Math.floor(diff / 3600000);
            if (h > 0) return h + 'h ago';
            return 'today';
        } catch (e) { return ''; }
    }
})();
