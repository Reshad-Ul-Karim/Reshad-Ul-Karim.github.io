/* =========================================================================
   reveal-motion.js  —  owned by worker-reveal
   GSAP-driven reveal / scroll system. Replaces AOS fade-ups with directional
   "fly-in" entrances, clip-path wipes, one pinned cinematic scene, and gentle
   scroll-linked parallax depth.

   Loaded with `defer` AFTER script.js, so the DOM is ready and gsap,
   ScrollTrigger, Flip and window._lenis are available when this runs.

   Design rules baked in:
     - Fail-safe: nothing we animate can end up stuck invisible.
     - Mobile-first simplification via gsap.matchMedia (no x-overflow, no pin).
     - Respects prefers-reduced-motion: reduce  (skip all animation).
     - Neutralises AOS at init so it can't fight our reveals.
   ========================================================================= */
(function () {
    'use strict';

    var docEl = document.documentElement;

    /* ---- 0. Hard guards ---------------------------------------------------
       If GSAP isn't present, do NOTHING destructive and make sure everything
       is visible. We still neutralise AOS-left-behind inline styles so the
       page isn't stuck hidden. */
    var HAS_GSAP = typeof window.gsap !== 'undefined';
    var HAS_ST   = HAS_GSAP && typeof window.ScrollTrigger !== 'undefined';

    var REDUCED = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Mark <html> so reveal-motion.css can pre-hide the elements we will
       animate. We only do this when we actually intend to animate — i.e.
       GSAP present AND motion allowed. Otherwise elements stay visible. */
    var WILL_ANIMATE = HAS_GSAP && HAS_ST && !REDUCED;

    /* ---------------------------------------------------------------------
       AOS neutralisation. Runs in ALL paths (even no-gsap / reduced-motion)
       so AOS can never leave anything hidden.
       --------------------------------------------------------------------- */
    function collectAosTargets() {
        return Array.prototype.slice.call(document.querySelectorAll('[data-aos]'));
    }

    function neutralizeAOS(els) {
        els.forEach(function (el) {
            // Strip AOS hooks so AOS.init() / AOS.refresh() ignore them.
            el.removeAttribute('data-aos');
            el.removeAttribute('data-aos-delay');
            el.removeAttribute('data-aos-duration');
            el.removeAttribute('data-aos-easing');
            el.removeAttribute('data-aos-offset');
            el.removeAttribute('data-aos-anchor');
            el.removeAttribute('data-aos-anchor-placement');
            el.classList.remove('aos-init', 'aos-animate');
            // Clear inline styles AOS may have written.
            el.style.removeProperty('opacity');
            el.style.removeProperty('transform');
            el.style.removeProperty('transition');
            el.style.removeProperty('transition-delay');
            el.style.removeProperty('transition-duration');
        });
    }

    /* If AOS global exists, blunt it so a stray refresh can't re-hide. */
    function disableAOSLib() {
        try {
            if (typeof window.AOS !== 'undefined' && window.AOS) {
                if (typeof window.AOS.refresh === 'function') {
                    window.AOS.refresh = function () {};
                }
                if (typeof window.AOS.refreshHard === 'function') {
                    window.AOS.refreshHard = function () {};
                }
            }
        } catch (e) { /* no-op */ }
    }

    var aosTargets = collectAosTargets();
    neutralizeAOS(aosTargets);
    disableAOSLib();

    /* ---------------------------------------------------------------------
       NO-GSAP or REDUCED-MOTION path: ensure visibility, then bail.
       --------------------------------------------------------------------- */
    if (!WILL_ANIMATE) {
        // Everything stays at its natural, fully-visible state.
        docEl.classList.add('rm-reduced');
        return;
    }

    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;

    gsap.registerPlugin(ScrollTrigger);

    // Tell CSS it may pre-hide the elements we are about to manage.
    docEl.classList.add('rm-ready');

    /* ---------------------------------------------------------------------
       1. SETUP — sync ScrollTrigger to Lenis + gsap.ticker.
       Lenis already runs its own RAF in script.js; we just forward its scroll
       events to ScrollTrigger.update and let gsap.ticker drive lag smoothing.
       --------------------------------------------------------------------- */
    var lenis = window._lenis;
    if (lenis && typeof lenis.on === 'function') {
        // Single source of truth: forward Lenis scroll -> ScrollTrigger.update.
        // morph-motion.js deliberately does NOT also register this, so there is
        // exactly one updater (no double-update). (Boss review note #3.)
        lenis.on('scroll', ScrollTrigger.update);
    }
    // Lenis already RAFs itself in script.js, so we don't re-raf here.
    // Just disable lag smoothing so scrubbed scenes track the scroll precisely.
    gsap.ticker.lagSmoothing(0);

    /* Helper: collect elements (live, filtered to existing). */
    function $all(sel, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    }

    /* Tag an element as "managed/hidden" so CSS pre-hides it and the failsafe
       can find it. Returns the element for chaining. */
    function manage(el) {
        if (el) el.setAttribute('data-rm-hide', '');
        return el;
    }

    /* will-change discipline is handled inline per-tween/timeline via the
       `rm-animating` / `rm-anim-done` classes. (Timeline callbacks must not
       call .targets() — only tweens expose it — so we manage classes from the
       closure-scoped element instead. Boss review fix.) */

    /* A reusable "force visible" used by the failsafe + each tween's onComplete
       fallback so a misfire still resolves to a clean visible state. */
    function forceVisible(el) {
        if (!el) return;
        gsap.set(el, { clearProps: 'opacity,transform,clipPath,willChange' });
        el.style.opacity = '';
        el.style.transform = '';
        el.style.clipPath = '';
        el.classList.remove('rm-animating');
    }

    /* =====================================================================
       MAIN BUILD — wrapped in gsap.matchMedia for responsive variants.
       ===================================================================== */
    var mm = gsap.matchMedia();

    /* Shared selector sets ------------------------------------------------ */
    var SECTION_HEADERS = '.section-header';
    var GROUPS = [
        '.projects-grid .project-card',
        '.experience-grid .experience-card',
        '.cultural-grid .cultural-card',
        '.research-metrics .metric-card',
        '.research-areas-grid .research-area-card',
        '.cultural-stats .stat-card',
        '.experience-stats .stat-card',
        '.skills-container .skill-category-card',
        '.certifications-row .cert-card'
    ];
    var MEDIA = [
        '.gallery-item',
        '.project-image'
    ];

    /* ----------- DESKTOP / TABLET (>768px, motion ok) -------------------- */
    mm.add('(min-width: 769px)', function () {
        var perspective = 900;
        var built = [];

        /* Section headers: rise + clip wipe ------------------------------ */
        $all(SECTION_HEADERS).forEach(function (header) {
            var title = header.querySelector('.section-title') || header;
            var sub = header.querySelector('.section-subtitle');
            manage(header);
            header.classList.add('reveal-clip'); // clip-path start from CSS

            var tl = gsap.timeline({
                scrollTrigger: {
                    trigger: header,
                    start: 'top 85%',
                    once: true,
                    onLeaveBack: function () {}
                },
                defaults: { ease: 'expo.out' },
                onStart: function () { header.classList.add('rm-animating'); },
                onComplete: function () {
                    header.classList.remove('rm-animating');
                    header.classList.add('rm-anim-done');
                    header.classList.remove('reveal-clip');
                }
            });
            tl.fromTo(header,
                { y: 36, opacity: 0, clipPath: 'inset(0 100% 0 0)' },
                { y: 0, opacity: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.9 }
            );
            if (sub) {
                tl.fromTo(sub, { y: 18, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, '-=0.55');
            }
            built.push(tl.scrollTrigger);
        });

        /* Grouped cards: alternating directional fly-in with slight 3D ---- */
        GROUPS.forEach(function (sel) {
            var cards = $all(sel);
            if (!cards.length) return;
            var container = cards[0].parentElement;

            cards.forEach(manage);

            var st = ScrollTrigger.create({
                trigger: container,
                start: 'top 85%',
                once: true,
                onEnter: function () {
                    cards.forEach(function (card, i) {
                        var fromLeft = (i % 2 === 0);
                        var dirX = fromLeft ? -70 : 70;
                        var rotY = fromLeft ? -8 : 8;
                        gsap.fromTo(card,
                            {
                                x: dirX,
                                y: 40,
                                opacity: 0,
                                rotateX: 7,
                                rotateY: rotY,
                                transformPerspective: perspective,
                                transformOrigin: 'center center'
                            },
                            {
                                x: 0, y: 0, opacity: 1,
                                rotateX: 0, rotateY: 0,
                                duration: 0.85,
                                ease: 'power4.out',
                                delay: i * 0.08,
                                onStart: function () { card.classList.add('rm-animating'); },
                                onComplete: function () {
                                    card.classList.remove('rm-animating');
                                    forceVisible(card);
                                }
                            }
                        );
                    });
                }
            });
            built.push(st);
        });

        /* About section: banner-style fly-ins ----------------------------
           Sweep the About blocks in from alternating sides (the "banner"
           motion the redesign calls for): research statement from the left,
           profile card from the right, then the rest rise + fade. ---------- */
        (function aboutFlyIns() {
            var about = document.querySelector('#about');
            if (!about) return;
            var sweeps = [
                { el: about.querySelector('.research-statement'), x: -90, rot: -3 },
                { el: about.querySelector('.about-content .profile-card'), x: 90, rot: 3 }
            ];
            sweeps.forEach(function (item) {
                if (!item.el) return;
                manage(item.el);
                var st = ScrollTrigger.create({
                    trigger: item.el,
                    start: 'top 86%',
                    once: true,
                    onEnter: function () {
                        gsap.fromTo(item.el,
                            { x: item.x, opacity: 0, rotateZ: item.rot, transformPerspective: 900 },
                            {
                                x: 0, opacity: 1, rotateZ: 0,
                                duration: 1, ease: 'power4.out',
                                onStart: function () { item.el.classList.add('rm-animating'); },
                                onComplete: function () { item.el.classList.remove('rm-animating'); forceVisible(item.el); }
                            });
                    }
                });
                built.push(st);
            });
            // Stat items + section blocks: staggered rise.
            var risers = $all('.about .stat-item, .about .skills-header, .about .academic-actions');
            risers.forEach(function (el, i) {
                manage(el);
                var st = ScrollTrigger.create({
                    trigger: el, start: 'top 90%', once: true,
                    onEnter: function () {
                        gsap.fromTo(el, { y: 34, opacity: 0 },
                            { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', delay: (i % 4) * 0.06,
                              onComplete: function () { forceVisible(el); } });
                    }
                });
                built.push(st);
            });
        })();

        /* Media / images: clip-path inset wipe -------------------------- */
        MEDIA.forEach(function (sel) {
            $all(sel).forEach(function (el) {
                manage(el);
                el.classList.add('reveal-clip');
                var st = ScrollTrigger.create({
                    trigger: el,
                    start: 'top 88%',
                    once: true,
                    onEnter: function () {
                        gsap.fromTo(el,
                            { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
                            {
                                clipPath: 'inset(0 0% 0 0)',
                                duration: 0.8, ease: 'power3.inOut',
                                onComplete: function () {
                                    el.classList.remove('reveal-clip');
                                    forceVisible(el);
                                }
                            });
                    }
                });
                built.push(st);
            });
        });

        /* ----------------------------------------------------------------
           3. PUBLICATIONS  —  smooth per-item fly-ins (NO pin).
           The old version PINNED the timeline and scrubbed every publication
           in over ~1500px, which made the page feel jammed/stuck on the way
           down. Here each publication simply flies up + fades as it enters
           the viewport (once), so the page scrolls naturally and freely. ---- */
        var research = document.querySelector('#research');
        var timeline = research && research.querySelector('.publications-timeline');
        var pubs = timeline ? $all('.publication-item', timeline) : [];
        var progressEl = null;

        if (timeline && pubs.length) {
            var title = timeline.querySelector('.timeline-title');
            if (title) {
                manage(title);
                var tst = ScrollTrigger.create({
                    trigger: title, start: 'top 88%', once: true,
                    onEnter: function () {
                        gsap.fromTo(title, { y: 24, opacity: 0, scale: 0.94 },
                            { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: 'power3.out',
                              onComplete: function () { forceVisible(title); } });
                    }
                });
                built.push(tst);
            }

            pubs.forEach(function (p, i) {
                manage(p);
                var fromLeft = (i % 2 === 0);
                var st = ScrollTrigger.create({
                    trigger: p,
                    start: 'top 85%',
                    once: true,
                    onEnter: function () {
                        gsap.fromTo(p,
                            { y: 56, x: fromLeft ? -36 : 36, opacity: 0, scale: 0.97, transformPerspective: 1000 },
                            {
                                y: 0, x: 0, opacity: 1, scale: 1,
                                duration: 0.8, ease: 'power4.out',
                                onStart: function () { p.classList.add('rm-animating'); },
                                onComplete: function () { p.classList.remove('rm-animating'); forceVisible(p); }
                            });
                    }
                });
                built.push(st);
            });
        }

        /* ----------------------------------------------------------------
           4. SUBTLE SCROLL DEPTH (parallax) — NOT the hero inner wrappers.
           Move a few decorative / background layers gently for real depth.
           ---------------------------------------------------------------- */
        var parallaxTweens = [];
        function addParallax(sel, dist) {
            $all(sel).forEach(function (el) {
                var tw = gsap.to(el, {
                    y: dist,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: true,
                        invalidateOnRefresh: true
                    }
                });
                parallaxTweens.push(tw);
            });
        }
        // Research metric icons drift = depth cues.
        // (Hero blobs are owned by the mouse-parallax system — we skip them.)
        // NOTE: .section-divider parallax is intentionally NOT done here.
        // morph-motion.js owns the dividers (injects+scrubs an SVG path, sweep
        // and yPercent parallax on the inner SVG). Adding a competing transform
        // on the divider element here caused the two ScrollTriggers to fight,
        // producing jitter. Single-owner = clean. (Boss review fix #1.)
        addParallax('.research-overview .metric-icon', -24);
        addParallax('.about .education-card-modern', -20);

        /* CLEANUP for this matchMedia context (fires on resize past bp). */
        return function cleanup() {
            built.forEach(function (st) { if (st && st.kill) st.kill(); });
            parallaxTweens.forEach(function (t) {
                if (t && t.scrollTrigger) t.scrollTrigger.kill();
                if (t && t.kill) t.kill();
            });
            // Restore any pinned section so layout isn't left broken.
            if (progressEl && progressEl.parentNode) progressEl.parentNode.removeChild(progressEl);
            $all('[data-rm-hide]').forEach(forceVisible);
        };
    });

    /* ----------- MOBILE (<=768px) — drastically simplified --------------
       No pinning, no heavy 3D, no x-offset (prevents horizontal overflow).
       Opacity + small y only. Faster durations.
       -------------------------------------------------------------------- */
    mm.add('(max-width: 768px)', function () {
        var built = [];

        // Headers: simple rise + fade (no clip wipe to keep it cheap).
        $all(SECTION_HEADERS).forEach(function (header) {
            manage(header);
            var st = ScrollTrigger.create({
                trigger: header,
                start: 'top 90%',
                once: true,
                onEnter: function () {
                    gsap.fromTo(header,
                        { y: 24, opacity: 0 },
                        { y: 0, opacity: 1, duration: 0.55, ease: 'power2.out',
                          onComplete: function () { forceVisible(header); } });
                }
            });
            built.push(st);
        });

        // All grouped cards + banners + media: opacity + y, NO x-translate.
        var mobileSelectors = GROUPS.concat([
            '.featured-banner',
            '.publication-item',
            '.gallery-item',
            '.timeline-title'
        ]);
        mobileSelectors.forEach(function (sel) {
            $all(sel).forEach(function (el, i) {
                manage(el);
                var st = ScrollTrigger.create({
                    trigger: el,
                    start: 'top 92%',
                    once: true,
                    onEnter: function () {
                        gsap.fromTo(el,
                            { y: 28, opacity: 0 },
                            { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out',
                              onComplete: function () { forceVisible(el); } });
                    }
                });
                built.push(st);
            });
        });

        return function cleanup() {
            built.forEach(function (st) { if (st && st.kill) st.kill(); });
            $all('[data-rm-hide]').forEach(forceVisible);
        };
    });

    /* =====================================================================
       REFRESH discipline — content-visibility:auto sections + late images
       can throw off ScrollTrigger measurements. Refresh after load + images.
       ===================================================================== */
    function refresh() { try { ScrollTrigger.refresh(); } catch (e) {} }

    window.addEventListener('load', refresh);
    // After web fonts settle.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(refresh).catch(function () {});
    }
    // After each image (some are lazy / below the content-visibility fold).
    $all('img').forEach(function (img) {
        if (img.complete) return;
        img.addEventListener('load', refresh, { once: true });
        img.addEventListener('error', refresh, { once: true });
    });
    // A couple of delayed refreshes catch anything async.
    setTimeout(refresh, 600);
    setTimeout(refresh, 1500);

    /* =====================================================================
       FAIL-SAFE WATCHDOG
       Guarantee every managed element is visible well before the site's 3s
       safety timeout. If a ScrollTrigger above-the-fold somehow didn't fire
       (or the user never scrolls), we reveal in-viewport items quickly, and
       hard-reveal EVERYTHING at 2.2s as an absolute backstop.
       ===================================================================== */
    function revealIfInView() {
        var vh = window.innerHeight || docEl.clientHeight;
        $all('[data-rm-hide]').forEach(function (el) {
            // Skip elements still being driven by an active pin scrub.
            var r = el.getBoundingClientRect();
            if (r.top < vh && r.bottom > 0) {
                // Only auto-reveal if essentially hidden (avoid stomping a
                // mid-flight tween — those finish on their own).
                var cs = window.getComputedStyle(el);
                if (parseFloat(cs.opacity) < 0.05 && !el.classList.contains('rm-animating')) {
                    gsap.to(el, { opacity: 1, y: 0, x: 0, clipPath: 'inset(0 0% 0 0)',
                        duration: 0.4, ease: 'power2.out',
                        onComplete: function () { forceVisible(el); } });
                }
            }
        });
    }
    // Quick pass shortly after init for anything above the fold.
    setTimeout(revealIfInView, 700);

    /* ---------------------------------------------------------------------
       CONTINUOUS SAFETY NET (IntersectionObserver).
       The timed passes above only fire twice. If a reveal ScrollTrigger
       mis-measures (e.g. a section that was offscreen at refresh time) a
       managed element could otherwise stay hidden when the user scrolls to it
       LATER. This observer watches every managed element and, once it enters
       the viewport, gives the normal reveal a short grace period — then force-
       reveals if it's still hidden. Pinned/scrubbed items (inside .rm-pin-stage)
       are skipped so we don't stomp the cinematic scene.
       --------------------------------------------------------------------- */
    if ('IntersectionObserver' in window) {
        var safetyIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el = entry.target;
                // Don't touch scrub-driven items in the pinned scene.
                if (el.closest && el.closest('.rm-pin-stage')) {
                    safetyIO.unobserve(el);
                    return;
                }
                // Give ScrollTrigger's own onEnter a chance first.
                setTimeout(function () {
                    if (!el.hasAttribute('data-rm-hide')) { safetyIO.unobserve(el); return; }
                    if (el.classList.contains('rm-animating')) return;
                    var cs = window.getComputedStyle(el);
                    if (parseFloat(cs.opacity) < 0.05) {
                        gsap.to(el, {
                            opacity: 1, y: 0, x: 0, clipPath: 'inset(0 0% 0 0)',
                            duration: 0.45, ease: 'power2.out',
                            onComplete: function () { forceVisible(el); }
                        });
                    } else {
                        // Already visible via ScrollTrigger — stop watching.
                        forceVisible(el);
                    }
                    safetyIO.unobserve(el);
                }, 450);
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });

        // Observe after the build pass has tagged everything managed.
        setTimeout(function () {
            $all('[data-rm-hide]').forEach(function (el) {
                if (el.closest && el.closest('.rm-pin-stage')) return;
                safetyIO.observe(el);
            });
        }, 300);
    }

    // Absolute backstop: 1.8s -> force EVERYTHING visible (well under the 3s
    // site safety timeout). Adding `rm-failsafe` to <html> makes the CSS rule
    //   html.rm-failsafe [data-rm-hide]{opacity:1!important;...}
    // win over any GSAP inline style; we also clear inline props so computed
    // values resolve cleanly even mid-tween. Pinned (scrubbed) items are left
    // to their scrub — but their own onComplete/forceVisible still guarantees
    // they don't end up invisible.
    setTimeout(function () {
        docEl.classList.add('rm-failsafe');
        $all('[data-rm-hide]').forEach(function (el) {
            if (el.classList.contains('rm-animating')) return; // let live tween finish
            forceVisible(el);
            el.style.opacity = '1';
            el.style.clipPath = 'none';
        });
        // One more refresh so any layout shift from forced visibility settles.
        refresh();
    }, 1800);

    // Expose a tiny debug hook.
    window._revealMotion = {
        refresh: refresh,
        version: '1.0.0'
    };
})();
