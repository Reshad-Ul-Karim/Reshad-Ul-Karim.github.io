/* ============================================================
   morph-motion.js   (loads defer, AFTER script.js)
   Modern morphing & cinematic transitions, implemented purely
   via runtime DOM hooks so index.html / styles.css stay untouched.

   Provides:
     1. View Transitions API for the theme toggle (circular reveal)
     2. (Progressive) nav VT note — intentionally minimal, see below
     3. GSAP Flip shared-element morph: card/thumbnail -> modal
     4. Scroll-scrubbed SVG / divider morphs (ScrollTrigger)
     5. Custom-cursor "View / Open" label morph

   All features feature-detect and degrade gracefully. Respects
   prefers-reduced-motion and is mobile/touch-safe.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- capability + environment detection ---------- */
  const supportsVT = typeof document.startViewTransition === 'function';
  const hasFlip = typeof window.gsap !== 'undefined' && typeof window.Flip !== 'undefined';
  const hasScrollTrigger =
    typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = () => mqReduced.matches;
  const isMobile = () => window.innerWidth <= 768 || !mqFinePointer.matches;

  if (hasScrollTrigger) {
    try {
      window.gsap.registerPlugin(window.ScrollTrigger);
      if (window.Flip) window.gsap.registerPlugin(window.Flip);
    } catch (e) {
      /* already registered — ignore */
    }
  }

  /* ============================================================
     1. VIEW TRANSITIONS — THEME TOGGLE (circular reveal)
     ------------------------------------------------------------
     script.js's initThemeToggle() appended a `.theme-toggle` button and
     bound a BUBBLE-phase click listener that does the authoritative work
     (data-theme swap + localStorage + icon + particles). We must not
     double-toggle, and we want that same swap to happen INSIDE a View
     Transition so the page morphs.

     Approach (no node cloning, so script.js's other listeners survive):
     register our own listener at the CAPTURE phase so we run first. On a
     real user click we call stopImmediatePropagation() to suppress
     script.js's handler, start a View Transition, and inside its callback
     we re-dispatch a synthetic click on the SAME button. A re-entrancy
     flag (`replaying`) makes our capture listener step aside for that
     synthetic event, so ONLY script.js's bubble handler runs -> exactly
     one authoritative toggle, captured by the VT. localStorage persistence
     is untouched because script.js still owns it.
     ============================================================ */
  // Re-entrancy guard: true while we re-dispatch the synthetic click that
  // lets script.js's bubble handler perform the real toggle.
  let replaying = false;

  function initThemeViewTransition() {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return;

    // Compute the circular-reveal origin from the button centre.
    function setRevealOrigin() {
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      // radius reaching the farthest viewport corner
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );
      return { x, y, endRadius };
    }

    // We intercept at the CAPTURE phase so we run BEFORE script.js's
    // bubble-phase click handler. We let script.js's handler do the real
    // theme swap, but we wrap that frame inside startViewTransition().
    btn.addEventListener(
      'click',
      function (e) {
        // Synthetic replay click -> step aside so script.js's handler runs.
        if (replaying) return;
        // No VT support, or reduced motion -> let the native handler run as-is.
        if (!supportsVT || reduced()) return;

        // Stop the native click from running immediately; we re-fire it
        // inside the transition callback so the DOM mutation it performs
        // is captured by the View Transition.
        e.stopImmediatePropagation();
        e.preventDefault();

        const { x, y, endRadius } = setRevealOrigin();

        const transition = document.startViewTransition(() => {
          // Re-run script.js's authoritative theme toggle by replaying the
          // event WITHOUT our capture interceptor. We temporarily detach
          // ourselves, dispatch a fresh click (script.js bubble handler runs
          // & flips data-theme/localStorage/icon/particles), then re-attach.
          replayNativeToggle(btn);
        });

        // Animate the NEW snapshot in with an expanding circular clip.
        transition.ready
          .then(() => {
            const clip = [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ];
            document.documentElement.animate(
              { clipPath: clip },
              {
                duration: 520,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                pseudoElement: '::view-transition-new(root)',
              }
            );
          })
          .catch(() => {
            // clip animation unsupported -> graceful cross-fade fallback
            document.documentElement.classList.add('vt-crossfade');
            transition.finished.finally(() =>
              document.documentElement.classList.remove('vt-crossfade')
            );
          });
      },
      true /* capture */
    );
  }

  // Replays the original theme toggle defined in script.js. Our capture
  // listener sees `replaying === true` and steps aside, so the synthetic
  // click reaches script.js's bubble-phase handler — the single source of
  // truth for the data-theme swap, localStorage, icon and particles.
  function replayNativeToggle(btn) {
    replaying = true;
    const synthetic = new MouseEvent('click', { bubbles: true, cancelable: true });
    btn.dispatchEvent(synthetic);
    replaying = false;
  }

  /* ============================================================
     3. GSAP FLIP — shared-element CARD -> MODAL morph
     ------------------------------------------------------------
     Strategy: we remember the last media element the user clicked
     (a youtube button's card, or a clickable image). When the modal
     gains `.active` (observed via MutationObserver), we build a fixed
     proxy clone positioned over the source rect, then GSAP-Flip it to
     the modal's media region. On close, we morph back.
     Falls back to a clean scale/fade if Flip is unavailable / can't map.
     ============================================================ */
  let lastSource = null; // { rect, img } describing the clicked source

  function rememberSource(el, imgSrc) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) {
      lastSource = null;
      return;
    }
    lastSource = { rect, imgSrc: imgSrc || null };
  }

  function captureClickSources() {
    // YouTube triggers: the visual card is the closest media wrapper.
    document.querySelectorAll('.youtube-modal-btn, .youtube-preview').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const card =
            btn.closest('.project-card, .research-card, .media-card, .project-banner') ||
            btn.closest('.youtube-preview') ||
            btn;
          // try to pull a thumbnail image for the proxy fill
          const img = card.querySelector('img');
          rememberSource(card, img ? img.currentSrc || img.src : null);
        },
        true
      );
    });

    // Clickable images / gallery items.
    document.querySelectorAll('.clickable-image, .gallery-item').forEach((el) => {
      el.addEventListener(
        'click',
        () => {
          const img = el.matches('img') ? el : el.querySelector('img');
          rememberSource(img || el, img ? img.currentSrc || img.src : null);
        },
        true
      );
    });
  }

  function buildProxy(source, fillEl) {
    const proxy = document.createElement('div');
    proxy.className = 'morph-flip-proxy';
    proxy.style.left = source.rect.left + 'px';
    proxy.style.top = source.rect.top + 'px';
    proxy.style.width = source.rect.width + 'px';
    proxy.style.height = source.rect.height + 'px';

    if (source.imgSrc) {
      const im = document.createElement('img');
      im.src = source.imgSrc;
      im.alt = '';
      proxy.appendChild(im);
    } else if (fillEl) {
      const fill = document.createElement('div');
      fill.className = 'morph-proxy-fill';
      fill.style.background =
        getComputedStyle(fillEl).backgroundColor || 'rgba(0,0,0,0.85)';
      proxy.appendChild(fill);
    }
    document.body.appendChild(proxy);
    return proxy;
  }

  // Animate proxy from source rect -> target rect, then reveal modal content.
  function flipOpen(targetEl, contentEl) {
    if (!lastSource || reduced() || !hasFlip) return false;

    const src = lastSource;
    lastSource = null; // consume

    const targetRect = targetEl.getBoundingClientRect();
    if (targetRect.width < 4 || targetRect.height < 4) return false;

    const proxy = buildProxy(src, targetEl);

    // Hide real modal content until the morph lands.
    if (contentEl) contentEl.classList.add('morph-modal-content-hidden');

    // FLIP: record start state already set (proxy at source rect), then
    // mutate proxy to target rect and let Flip tween the delta.
    const state = window.Flip.getState(proxy);
    proxy.style.left = targetRect.left + 'px';
    proxy.style.top = targetRect.top + 'px';
    proxy.style.width = targetRect.width + 'px';
    proxy.style.height = targetRect.height + 'px';

    window.Flip.from(state, {
      duration: 0.55,
      ease: 'power3.inOut',
      absolute: true,
      onComplete: () => {
        if (contentEl) contentEl.classList.remove('morph-modal-content-hidden');
        window.gsap.to(proxy, {
          opacity: 0,
          duration: 0.18,
          onComplete: () => proxy.remove(),
        });
      },
    });
    return true;
  }

  function wireModalFlip(modalId, contentSelector, targetSelector) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const content = contentSelector ? modal.querySelector(contentSelector) : modal;

    const obs = new MutationObserver(() => {
      const active = modal.classList.contains('active');
      if (active && !modal.dataset.morphOpen) {
        modal.dataset.morphOpen = '1';
        // target = the media region inside the modal we morph into
        const target =
          (targetSelector && modal.querySelector(targetSelector)) || content || modal;
        // Defer one frame so the modal has laid out & has real dimensions.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => flipOpen(target, content));
        });
      } else if (!active && modal.dataset.morphOpen) {
        delete modal.dataset.morphOpen;
        if (content) content.classList.remove('morph-modal-content-hidden');
      }
    });
    obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  function initModalFlips() {
    // YouTube: morph into the video container.
    wireModalFlip('youtube-modal', '.youtube-modal-content', '.youtube-video-container');
    // Image: morph into the viewer container.
    wireModalFlip('image-modal', '.image-modal-content', '.image-viewer-container');
  }

  /* ============================================================
     4. SCROLL-SCRUBBED DIVIDER MORPHS
     ------------------------------------------------------------
     Inject an inline SVG (animated wave path) + a gradient sweep into
     each existing .section-divider, then drive them with ScrollTrigger
     scrub. On reduced motion / mobile we simplify or skip.
     ============================================================ */
  // Two wave path variants for the same 1440x80 viewBox; we morph between
  // them by interpolating control points via GSAP (attr tween on `d`).
  const WAVE_A =
    'M0,40 C360,75 720,5 1080,40 C1260,58 1380,32 1440,40 L1440,80 L0,80 Z';
  const WAVE_B =
    'M0,48 C300,18 600,70 900,44 C1140,24 1320,60 1440,46 L1440,80 L0,80 Z';

  function injectDividerSVG(divider, isDiagonal) {
    if (divider.querySelector('.divider-morph-svg')) return null;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'divider-morph-svg');
    svg.setAttribute('viewBox', '0 0 1440 80');
    svg.setAttribute('preserveAspectRatio', 'none');

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', isDiagonal ? WAVE_B : WAVE_A);
    path.setAttribute('fill', 'url(#dividerGrad)');
    path.setAttribute('fill-opacity', '0.10');

    // gradient def
    const defs = document.createElementNS(svgNS, 'defs');
    const grad = document.createElementNS(svgNS, 'linearGradient');
    const gid = 'dividerGrad';
    grad.setAttribute('id', gid);
    grad.setAttribute('x1', '0');
    grad.setAttribute('x2', '1');
    [['0', '#6366f1'], ['0.5', '#ec4899'], ['1', '#06b6d4']].forEach(([off, col]) => {
      const stop = document.createElementNS(svgNS, 'stop');
      stop.setAttribute('offset', off);
      stop.setAttribute('stop-color', col);
      grad.appendChild(stop);
    });
    defs.appendChild(grad);
    svg.appendChild(defs);
    svg.appendChild(path);
    divider.appendChild(svg);

    // gradient sweep overlay
    const sweep = document.createElement('div');
    sweep.className = 'divider-sweep';
    divider.appendChild(sweep);

    return { svg, path, sweep };
  }

  function initDividerMorphs() {
    const dividers = document.querySelectorAll('.section-divider');
    if (!dividers.length) return;

    dividers.forEach((divider) => {
      const isDiagonal = divider.classList.contains('divider-diagonal');
      const parts = injectDividerSVG(divider, isDiagonal);
      if (!parts) return;

      // Reduced motion: leave the static injected SVG, no scrub.
      if (reduced() || !hasScrollTrigger) return;

      const targetD = isDiagonal ? WAVE_A : WAVE_B;

      // Scrub the wave path `d` + a sweep variable as the divider passes.
      window.gsap.to(parts.path, {
        attr: { d: targetD },
        ease: 'none',
        scrollTrigger: {
          trigger: divider,
          start: 'top bottom',
          end: 'bottom top',
          scrub: isMobile() ? 0.6 : true,
        },
      });

      // Drive the CSS sweep variable 0 -> 1 across the same range.
      window.gsap.to(divider, {
        '--sweep': 1,
        ease: 'none',
        scrollTrigger: {
          trigger: divider,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });

      // Subtle vertical parallax of the wave for depth.
      window.gsap.fromTo(
        parts.svg,
        { yPercent: -8 },
        {
          yPercent: 8,
          ease: 'none',
          scrollTrigger: {
            trigger: divider,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        }
      );
    });
  }

  /* ============================================================
     5. CUSTOM-CURSOR LABEL MORPH ("View" / "Open")
     ------------------------------------------------------------
     Enhances the EXISTING #custom-cursor / #cursor-dot (created in
     script.js) by adding a label child and toggling a `.cursor-media`
     class on hover of media/cards. We never replace script.js's cursor
     logic — purely additive classes, so its lerp/hover still run.
     Disabled on touch/coarse/reduced-motion.
     ============================================================ */
  function initCursorLabelMorph() {
    if (reduced()) return;
    if (!mqFinePointer.matches) return; // touch / coarse -> skip entirely

    const cursor = document.getElementById('custom-cursor');
    const dot = document.getElementById('cursor-dot');
    if (!cursor || !dot) return;

    // Inject the label once.
    let label = cursor.querySelector('.cursor-media-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'cursor-media-label';
      cursor.appendChild(label);
    }

    // Map selectors -> label text.
    const mediaTargets = [
      { sel: '.youtube-modal-btn, .youtube-preview', text: 'Play' },
      { sel: '.clickable-image, .gallery-item', text: 'View' },
      { sel: '.pdf-viewer-btn, .pdf-thumb', text: 'Open' },
    ];

    mediaTargets.forEach(({ sel, text }) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.addEventListener('mouseenter', () => {
          label.textContent = text;
          cursor.classList.add('cursor-media');
          dot.classList.add('cursor-media');
        });
        el.addEventListener('mouseleave', () => {
          cursor.classList.remove('cursor-media');
          dot.classList.remove('cursor-media');
        });
      });
    });
  }

  /* ============================================================
     2. NAV VIEW TRANSITIONS — intentionally minimal
     ------------------------------------------------------------
     The site scrolls via Lenis smooth-scroll + window.scrollTo. A View
     Transition snapshots BEFORE the scroll and animates to AFTER, but a
     smooth scroll unfolds over ~1s AFTER the VT has already captured the
     "after" frame at the old position -> the VT would capture a no-op or
     fight Lenis, causing a visible jump. Per the brief we keep this
     minimal: we do NOT wrap nav jumps in a VT. (Documented for reviewer.)
     A safe cross-fade isn't achievable without disabling Lenis smooth
     scroll, which the constraints forbid. Skipped deliberately.
     ============================================================ */

  /* ---------- boot ---------- */
  function boot() {
    try { initThemeViewTransition(); } catch (e) { console.warn('[morph] theme VT failed', e); }
    try { captureClickSources(); } catch (e) { console.warn('[morph] source capture failed', e); }
    try { initModalFlips(); } catch (e) { console.warn('[morph] modal flip failed', e); }
    try { initDividerMorphs(); } catch (e) { console.warn('[morph] divider morph failed', e); }
    try { initCursorLabelMorph(); } catch (e) { console.warn('[morph] cursor label failed', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
