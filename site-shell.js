/*!
 * site-shell.js — Blocking shared-chrome injector for MyWebsite subpages
 * (project detail pages + the projects/publications index pages).
 * See docs/MULTIPAGE_PLAN.md §4b.
 *
 * WHAT IT DOES
 *   Injects the shared "page chrome" that lives verbatim in index.html so every
 *   subpage carries only its own unique content. Two placeholder divs are filled:
 *     #shell-chrome  -> grain SVG + grain overlay, custom cursor + dot,
 *                       scroll-progress ring, and <nav class="navbar" id="navbar">.
 *     #shell-footer  -> <footer class="footer"> + the three modal shells
 *                       (#youtube-modal, #image-modal, #pdf-modal).
 *   The nav logo + 8 nav links are re-pointed at "<base>index.html#section" so they
 *   navigate back to the single-pager from one level deep (/projects/, /publications/).
 *
 * SELF-LOCATING (rename-proof, depth-independent, works on file://):
 *   The site root is derived once from THIS script's own URL:
 *     base = document.currentScript.src.replace(/site-shell\.js.*$/, '')
 *   captured synchronously at top-level (document.currentScript is only valid during
 *   the initial synchronous execution — never reference it from a later callback).
 *
 * ============================ HARD CONTRACT ============================
 *   1. This script MUST stay BLOCKING — no `defer`, no `async`. It runs during
 *      HTML parse so #shell-chrome (the navbar, cursor, grain, ring that
 *      script.js queries) exists BEFORE any consumer runs.
 *   2. It MUST be placed BEFORE <script src="../script.js">. script.js's init
 *      (initNavigation / initCustomCursor / initYouTubeModal / initPDFViewer /
 *      initImageModal / initScrollProgressRing) runs on DOMContentLoaded and
 *      *queries* — never creates — these elements. Because this file is parsed
 *      first, its DOMContentLoaded handler is registered first and therefore
 *      runs first, so #shell-footer's modals exist before script.js looks for
 *      them. Deferring or moving this script silently breaks nav/cursor/modals.
 *   3. This file injects ONLY. It must not query or mutate any other page.
 *
 * OMITTED on purpose (single-pager-only chrome — see plan §4c):
 *   #floating-nav (hardcoded to the 8 single-pager sections; initFloatingNav()
 *   early-returns when absent) and #particles-js (dead code; library never loaded).
 * =====================================================================
 */
(function () {
    'use strict';

    // --- Derive the site root from this script's own URL (see header). --------
    var self = document.currentScript;
    var base = (self && self.src ? self.src : '').replace(/site-shell\.js.*$/, '');

    // --- Nav model: [href-relative-to-base, label]. Research + Projects point at
    //     the dedicated multi-page index pages; the rest deep-link back into the
    //     single-pager sections. ------------------------------------------------
    var NAV = [
        ['index.html#home', 'Home'],
        ['index.html#about', 'About'],
        ['index.html#experience', 'Experience'],
        ['publications/', 'Research'],
        ['projects/', 'Projects'],
        ['index.html#awards', 'Awards'],
        ['index.html#cultural', 'Cultural'],
        ['index.html#contact', 'Contact']
    ];
    var navLinksHtml = NAV.map(function (n) {
        return '<a href="' + base + n[0] + '" class="nav-link">' + n[1] + '</a>';
    }).join('\n                ');

    // --- #shell-chrome: grain + cursor + scroll ring + navbar -----------------
    // Markup copied verbatim from index.html (grain L97-103, cursor L106-107,
    // ring L110-116, navbar L122-143). Only the nav hrefs are rewritten to the
    // absolute "<base>index.html#..." form so back-nav works from one level deep.
    var CHROME_HTML = [
        '<!-- SVG Grain Filter -->',
        '<svg class="grain-svg" xmlns="http://www.w3.org/2000/svg">',
        '    <filter id="grain-filter" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">',
        '        <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" result="noise"/>',
        '        <feColorMatrix type="saturate" values="0" in="noise"/>',
        '    </filter>',
        '</svg>',
        '<div class="grain-overlay" aria-hidden="true"></div>',
        '',
        '<!-- Custom Cursor -->',
        '<div class="custom-cursor" id="custom-cursor"></div>',
        '<div class="cursor-dot" id="cursor-dot"></div>',
        '',
        '<!-- Scroll Progress Ring -->',
        '<div class="scroll-progress-ring" id="scroll-progress-ring">',
        '    <svg width="48" height="48" viewBox="0 0 48 48">',
        '        <circle class="spr-bg" cx="24" cy="24" r="20"/>',
        '        <circle class="spr-fill" id="spr-fill" cx="24" cy="24" r="20"/>',
        '    </svg>',
        '    <i class="fas fa-chevron-up spr-icon" id="spr-icon"></i>',
        '</div>',
        '',
        '<!-- Navigation -->',
        '<nav class="navbar" id="navbar">',
        '    <div class="nav-container">',
        '        <div class="nav-logo">',
        '            <a href="' + base + 'index.html#home">RUK</a>',
        '        </div>',
        '        <div class="nav-menu" id="nav-menu">',
        '            ' + navLinksHtml,
        '        </div>',
        '        <div class="hamburger" id="hamburger">',
        '            <span></span>',
        '            <span></span>',
        '            <span></span>',
        '        </div>',
        '    </div>',
        '</nav>'
    ].join('\n');

    // --- #shell-footer: footer + the three modal shells -----------------------
    // Footer copied verbatim from index.html L2654-2668 (its resume/GitHub/
    // LinkedIn links are absolute or root-relative-safe as authored — kept as-is
    // for byte-for-byte parity with the single-pager). Modals copied verbatim
    // from index.html: #youtube-modal L2541-2548, #image-modal L2551-2580,
    // #pdf-modal L2583-2619. script.js queries these by id; they must exist
    // before its DOMContentLoaded init (see contract).
    var FOOTER_HTML = [
        '<!-- Footer -->',
        '<footer class="footer">',
        '    <div class="container">',
        '        <div class="footer-content">',
        '            <p>&copy; 2025 Reshad Ul Karim. All rights reserved.</p>',
        '            <p>AI &amp; Computer Vision Researcher &mdash; Explainable AI, multimodal learning &amp; assistive perception. Seeking PhD &amp; research opportunities.</p>',
        '            <p class="footer-links">',
        '                <a href="' + base + 'assets/papers/Reshad_Ul_Karim_Resume.pdf" download="Reshad_Ul_Karim_Resume.pdf">Download CV</a>',
        '                <span aria-hidden="true">&middot;</span>',
        '                <a href="https://github.com/Reshad-Ul-Karim" target="_blank" rel="noopener noreferrer">GitHub</a>',
        '                <span aria-hidden="true">&middot;</span>',
        '                <a href="https://www.linkedin.com/in/reshad-ul-karim" target="_blank" rel="noopener noreferrer">LinkedIn</a>',
        '            </p>',
        '        </div>',
        '    </div>',
        '</footer>',
        '',
        '<!-- YouTube Video Modal -->',
        '<div id="youtube-modal" class="youtube-modal">',
        '    <div class="youtube-modal-content">',
        '        <button class="youtube-modal-close">&times;</button>',
        '        <div class="youtube-video-container">',
        '            <iframe id="youtube-iframe" src="" frameborder="0" allowfullscreen></iframe>',
        '        </div>',
        '    </div>',
        '</div>',
        '',
        '<!-- Image Preview Modal -->',
        '<div id="image-modal" class="image-modal">',
        '    <div class="image-modal-content">',
        '        <button class="image-modal-close">&times;</button>',
        '        <div class="image-modal-header">',
        '            <h3 id="image-title">Image Preview</h3>',
        '            <div class="image-controls">',
        '                <button id="image-zoom-out" class="image-control-btn" title="Zoom Out">',
        '                    <i class="fas fa-search-minus"></i>',
        '                </button>',
        '                <span id="image-zoom-level">100%</span>',
        '                <button id="image-zoom-in" class="image-control-btn" title="Zoom In">',
        '                    <i class="fas fa-search-plus"></i>',
        '                </button>',
        '                <button id="image-fullscreen" class="image-control-btn" title="Fullscreen">',
        '                    <i class="fas fa-expand"></i>',
        '                </button>',
        '                <button id="image-download" class="image-control-btn" title="Download Image">',
        '                    <i class="fas fa-download"></i>',
        '                </button>',
        '            </div>',
        '        </div>',
        '        <div class="image-viewer-container">',
        '            <div id="image-loading" class="image-loading">',
        '                <div class="image-spinner"></div>',
        '                <p>Loading image...</p>',
        '            </div>',
        '            <img id="modal-image" src="" alt="Image preview" class="modal-image">',
        '        </div>',
        '    </div>',
        '</div>',
        '',
        '<!-- PDF Viewer Modal -->',
        '<div id="pdf-modal" class="pdf-modal">',
        '    <div class="pdf-modal-content">',
        '        <div class="pdf-modal-header">',
        '            <h3 id="pdf-title">Research Paper</h3>',
        '            <div class="pdf-controls">',
        '                <button id="pdf-prev" class="pdf-control-btn" title="Previous Page">',
        '                    <i class="fas fa-chevron-left"></i>',
        '                </button>',
        '                <span id="pdf-page-info">1 / 1</span>',
        '                <button id="pdf-next" class="pdf-control-btn" title="Next Page">',
        '                    <i class="fas fa-chevron-right"></i>',
        '                </button>',
        '                <button id="pdf-zoom-out" class="pdf-control-btn" title="Zoom Out">',
        '                    <i class="fas fa-search-minus"></i>',
        '                </button>',
        '                <span id="pdf-zoom-level">100%</span>',
        '                <button id="pdf-zoom-in" class="pdf-control-btn" title="Zoom In">',
        '                    <i class="fas fa-search-plus"></i>',
        '                </button>',
        '                <button id="pdf-fullscreen" class="pdf-control-btn" title="Fullscreen">',
        '                    <i class="fas fa-expand"></i>',
        '                </button>',
        '                <button id="pdf-download" class="pdf-control-btn" title="Download PDF">',
        '                    <i class="fas fa-download"></i>',
        '                </button>',
        '            </div>',
        '            <button class="pdf-modal-close">&times;</button>',
        '        </div>',
        '        <div class="pdf-viewer-container">',
        '            <div id="pdf-loading" class="pdf-loading">',
        '                <div class="pdf-spinner"></div>',
        '                <p>Loading PDF...</p>',
        '            </div>',
        '            <canvas id="pdf-canvas"></canvas>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('\n');

    // --- Fill helper (idempotent). --------------------------------------------
    function fill(id, html) {
        var el = document.getElementById(id);
        if (!el) return false;
        if (el.getAttribute('data-shell-filled') !== null) return true;
        el.innerHTML = html;
        el.setAttribute('data-shell-filled', '');
        return true;
    }

    // #shell-chrome is parsed just before this blocking script, so it exists NOW
    // and is filled synchronously — the navbar/cursor/grain/ring are live before
    // the deferred motion modules and before script.js run.
    var chromeFilled = fill('shell-chrome', CHROME_HTML);

    // #shell-footer comes AFTER this script in the document, so it is not parsed
    // yet. Fill it on DOMContentLoaded; because this script is parsed before
    // script.js, this handler is registered — and therefore runs — before
    // script.js's own DOMContentLoaded init, so the modals exist when it queries
    // them. (Also re-runs the chrome fill in the defensive case where the script
    // was placed unusually early and #shell-chrome had not yet been parsed.)
    var footerFilled = fill('shell-footer', FOOTER_HTML);
    if (!chromeFilled || !footerFilled) {
        document.addEventListener('DOMContentLoaded', function () {
            fill('shell-chrome', CHROME_HTML);
            fill('shell-footer', FOOTER_HTML);
        });
    }
})();
