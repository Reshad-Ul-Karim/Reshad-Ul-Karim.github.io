/* =========================================================================
   story.js: scroll-told visual stories for the project pages.

   Markup (generated into each project page):
     <section class="story" data-story="<slug>">
       <div class="story__stage"><canvas class="story__canvas"></canvas>
         <img class="story__poster"> <div class="story__dots"></div></div>
       <ol class="story__beats"><li class="story__beat">…</li>…</ol>
     </section>

   The stage stays pinned while the beats scroll past it. Scroll position maps
   to a continuous beat value p (0 … beats-1), eased so the scene flows like
   liquid between beats. Each project's scene (story-scenes.js) is a pure
   drawing function draw(k, p, t) on a 1000 x 625 virtual canvas; k is the
   kit below. No controls: it is a story, not a game. Reduced motion snaps
   to whole beats and freezes ambient motion. The beat text is the readable
   version of every scene.
   ========================================================================= */
(function () {
  'use strict';
  var scenes = window.StoryScenes || {};
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var W = 1000; var H = 625;

  function clamp(v, a, b) { return v < (a || 0) ? (a || 0) : v > (b == null ? 1 : b) ? (b == null ? 1 : b) : v; }
  function smooth(x) { x = clamp(x); return x * x * (3 - 2 * x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hexA(c, a) {
    if (c.indexOf('rgb') === 0) return c.replace(/rgba?\(([^)]+)\)/, function (_, v) { var p = v.split(',').slice(0, 3).join(','); return 'rgba(' + p + ',' + a + ')'; });
    var h = c.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  var GLYPHS = {
    shield: 'M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z',
    cloud: 'M7 18.5h10.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.6 9.1 4.7 4.7 0 0 0 7 18.5z',
    speaker: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
    check: 'm5 12.5 4.5 4.5L19 7.5',
    cross: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
    lock: 'M6.5 11h11v9h-11zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    db: 'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3',
    person: 'M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5',
    phone: 'M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3zM11 18h2',
    camera: 'M4 8.5h3l1.5-2h7l1.5 2h3v10H4zM12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    pin: 'M12 21s-6.5-5.8-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.2-6.5 11-6.5 11zM12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z',
    bolt: 'M13 3 5.5 13.5H12L11 21l7.5-10.5H12z',
    doc: 'M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5zM14 3.5v5h5M9 13h6M9 16.5h4',
    chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
    wifi: 'M3.5 9.5a12 12 0 0 1 17 0M6.5 12.5a7.8 7.8 0 0 1 11 0M9.5 15.5a3.5 3.5 0 0 1 5 0M12 19h.01',
    heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z',
    mic: 'M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3zM6 11.5a6 6 0 0 0 12 0M12 17.5V21',
    card: 'M3.5 6.5h17v11h-17zM3.5 10h17M6.5 14.5h4',
    video: 'M3.5 7h11v10h-11zM14.5 10.5l6-3.5v10l-6-3.5z',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3.5V7M16 3.5V7',
    search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
    eye: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
    star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'
  };
  var pathCache = {};
  function glyphPath(name) { return pathCache[name] || (pathCache[name] = new Path2D(GLYPHS[name] || GLYPHS.star)); }

  function makeKit(ctx) {
    var k = { W: W, H: H, c: ctx, clamp: clamp, smooth: smooth, lerp: lerp, a: hexA, p: 0, t: 0, n: 1, fs: 1 };
    k.palette = function () {
      var cs = getComputedStyle(document.documentElement);
      var v = function (name, fb) { return (cs.getPropertyValue(name) || '').trim() || fb; };
      k.hl = v('--hl', '#8CF0D3'); k.decor = v('--decor', '#D8B98B');
      k.ink = v('--ink', '#ECEDEE'); k.ink2 = v('--ink-2', '#A8ACB1');
      k.warn = '#F5B94A'; k.bad = '#FF7A7A'; k.cool = '#7CB8FF';
      k.dark = document.documentElement.getAttribute('data-theme') !== 'light';
      k.font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    };
    /* Beat timing: b(i) rises 0 -> 1 as the story arrives at beat i;
       gone(i) rises 0 -> 1 as it moves on past beat i. */
    k.b = function (i) { return i <= 0 ? 1 : smooth(k.p - i + 1); };
    k.gone = function (i) { return smooth(k.p - i); };
    k.seg = function (a, b) { return smooth((k.p - a) / (b - a)); };
    k.only = function (i) { return k.b(i) * (1 - k.gone(i)); };
    k.rnd = function (seed) { var s = seed || 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

    k.alpha = function (a, fn) { ctx.save(); ctx.globalAlpha *= clamp(a); fn(); ctx.restore(); };
    k.rr = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    };
    // Liquid-glass panel: translucent body, top sheen, lit rim, soft lift shadow.
    k.glass = function (x, y, w, h, r, o) {
      o = o || {}; var a = o.alpha == null ? 1 : o.alpha; if (a <= 0.001) return;
      ctx.save(); ctx.globalAlpha *= a;
      if (o.lift !== false) { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; }
      k.rr(x, y, w, h, r);
      var g = ctx.createLinearGradient(x, y, x, y + h);
      var tint = o.tint || (k.dark ? '#ffffff' : '#ffffff');
      g.addColorStop(0, hexA(tint, k.dark ? 0.13 : 0.75)); g.addColorStop(1, hexA(tint, k.dark ? 0.04 : 0.45));
      ctx.fillStyle = g; ctx.fill();
      ctx.shadowColor = 'transparent';
      if (o.glow) { ctx.fillStyle = hexA(o.glow, 0.16 * (o.glowA == null ? 1 : o.glowA)); ctx.fill(); }
      var rim = ctx.createLinearGradient(x, y, x + w, y + h);
      rim.addColorStop(0, 'rgba(255,255,255,0.55)'); rim.addColorStop(0.4, 'rgba(255,255,255,0.06)'); rim.addColorStop(1, 'rgba(255,255,255,0.22)');
      ctx.strokeStyle = o.stroke || rim; ctx.lineWidth = o.lw || 1.2; ctx.stroke();
      var sh = ctx.createRadialGradient(x + w * 0.3, y, 0, x + w * 0.3, y, Math.max(w, h) * 0.7);
      sh.addColorStop(0, 'rgba(255,255,255,0.14)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh; ctx.fill();
      ctx.restore();
    };
    k.text = function (s, x, y, o) {
      o = o || {}; var a = o.alpha == null ? 1 : o.alpha; if (a <= 0.001) return;
      ctx.save(); ctx.globalAlpha *= a;
      var size = o.size || 16; if (size < 18) size = Math.min(18, size * k.fs);
      ctx.font = (o.weight || 500) + ' ' + size + 'px ' + (o.mono ? '"JetBrains Mono", ui-monospace, monospace' : k.font);
      ctx.fillStyle = o.color || k.ink; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle';
      ctx.fillText(s, x, y); ctx.restore();
    };
    k.line = function (pts, o) {
      o = o || {}; var a = o.alpha == null ? 1 : o.alpha; if (a <= 0.001 || pts.length < 2) return;
      ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = o.color || k.ink2; ctx.lineWidth = o.width || 2;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (o.dash) { ctx.setLineDash(o.dash); ctx.lineDashOffset = o.offset || 0; }
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      if (o.close) ctx.closePath();
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      ctx.stroke(); ctx.restore();
    };
    // A connection with pulses travelling along it; amount draws it in.
    k.flow = function (x1, y1, x2, y2, o) {
      o = o || {}; var amt = o.amount == null ? 1 : o.amount; if (amt <= 0.001) return;
      var xe = lerp(x1, x2, amt); var ye = lerp(y1, y2, amt);
      var col = o.color || k.hl;
      k.line([[x1, y1], [xe, ye]], { color: hexA(col, 0.35), width: o.width || 2, alpha: o.alpha });
      var cnt = o.count || 3;
      for (var i = 0; i < cnt; i++) {
        var u = ((k.t * (o.speed || 0.5) + i / cnt) % 1) * amt;
        k.dot(lerp(x1, x2, u), lerp(y1, y2, u), o.r || 3.5, col, (o.alpha == null ? 1 : o.alpha) * (1 - Math.abs(u / Math.max(amt, 0.001) - 0.5) * 0.8), 10);
      }
    };
    k.dot = function (x, y, r, color, a, glow) {
      if (a != null && a <= 0.001) return;
      ctx.save(); ctx.globalAlpha *= (a == null ? 1 : a);
      if (glow) { ctx.shadowColor = color || k.hl; ctx.shadowBlur = glow; }
      ctx.fillStyle = color || k.hl; ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    };
    k.ring = function (x, y, r, frac, o) {
      o = o || {}; var a = o.alpha == null ? 1 : o.alpha; if (a <= 0.001) return;
      ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round'; ctx.lineWidth = o.width || 8;
      ctx.strokeStyle = o.track || hexA(k.ink, 0.1); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      if (frac > 0.001) {
        ctx.strokeStyle = o.color || k.hl; ctx.shadowColor = o.color || k.hl; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(frac)); ctx.stroke();
      }
      ctx.restore();
    };
    // Detection box with corner ticks and an optional tag.
    k.bbox = function (x, y, w, h, o) {
      o = o || {}; var a = o.alpha == null ? 1 : o.alpha; if (a <= 0.001) return;
      var col = o.color || k.hl; var c = Math.min(16, w / 4, h / 4);
      ctx.save(); ctx.globalAlpha *= a;
      ctx.strokeStyle = hexA(col, 0.45); ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
      [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(function (q) {
        ctx.moveTo(q[0] + q[2] * c, q[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0], q[1] + q[3] * c);
      });
      ctx.stroke();
      if (o.label) {
        ctx.font = '600 13px ' + k.font; var tw = ctx.measureText(o.label).width + 14;
        ctx.fillStyle = col; k.rr(x, y - 22, tw, 20, 6); ctx.fill();
        ctx.fillStyle = '#0b1514'; ctx.textBaseline = 'middle'; ctx.fillText(o.label, x + 7, y - 12);
      }
      ctx.restore();
    };
    k.wave = function (x, y, w, h, fn, o) {
      o = o || {}; var upto = o.upto == null ? 1 : o.upto; if (upto <= 0.001) return;
      var pts = []; var steps = o.steps || 160;
      for (var i = 0; i <= steps * upto; i++) { var u = i / steps; pts.push([x + u * w, y - fn(u) * h / 2]); }
      k.line(pts, { color: o.color || k.hl, width: o.width || 2.2, alpha: o.alpha });
    };
    k.bars = function (x, y, w, h, vals, o) {
      o = o || {}; var n = vals.length; var gap = o.gap == null ? 10 : o.gap; var a = o.alpha == null ? 1 : o.alpha;
      var bw = (w - gap * (n - 1)) / n;
      for (var i = 0; i < n; i++) {
        var v = clamp(vals[i]) * (o.grow == null ? 1 : o.grow); var col = (o.colors && o.colors[i]) || o.color || k.hl;
        k.alpha(a, function () {
          ctx.fillStyle = hexA(k.ink, 0.06); k.rr(x + i * (bw + gap), y, bw, h, 6); ctx.fill();
          var g = ctx.createLinearGradient(0, y + h - v * h, 0, y + h); g.addColorStop(0, col); g.addColorStop(1, hexA(col, 0.35));
          ctx.fillStyle = g; k.rr(x + i * (bw + gap), y + h - v * h, bw, Math.max(2, v * h), 6); ctx.fill();
        });
        if (o.labels) k.text(o.labels[i], x + i * (bw + gap) + bw / 2, y + h + 16, { size: 12, color: k.ink2, align: 'center', alpha: a });
      }
    };
    // Horizontal contribution bars (explanations).
    k.hbars = function (x, y, w, rows, o) {
      o = o || {}; var a = o.alpha == null ? 1 : o.alpha; var rh = o.rh || 26;
      rows.forEach(function (r, i) {
        var yy = y + i * (rh + 8); var v = clamp(Math.abs(r[1])) * (o.grow == null ? 1 : o.grow);
        var col = r[1] < 0 ? (o.neg || k.cool) : (o.pos || k.hl);
        k.text(r[0], x - 10, yy + rh / 2, { size: 13, color: k.ink2, align: 'right', alpha: a });
        k.alpha(a, function () {
          ctx.fillStyle = hexA(k.ink, 0.06); k.rr(x, yy, w, rh, 7); ctx.fill();
          ctx.fillStyle = col; k.rr(x, yy, Math.max(4, v * w), rh, 7); ctx.fill();
        });
      });
    };
    k.glyph = function (name, x, y, s, o) {
      o = o || {}; var a = o.alpha == null ? 1 : o.alpha; if (a <= 0.001) return;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x - s / 2, y - s / 2); ctx.scale(s / 24, s / 24);
      ctx.lineWidth = (o.width || 1.9); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(glyphPath(name)); }
      ctx.strokeStyle = o.color || k.ink; ctx.stroke(glyphPath(name)); ctx.restore();
    };
    // iOS-style glass tile with a glyph: the visual atom of most scenes.
    k.tile = function (name, x, y, s, o) {
      o = o || {}; var a = o.alpha == null ? 1 : o.alpha; if (a <= 0.001) return;
      var col = o.color || k.hl; var on = o.on == null ? 1 : o.on;
      ctx.save(); ctx.globalAlpha *= a;
      if (on > 0.01) { ctx.shadowColor = hexA(col, 0.7 * on); ctx.shadowBlur = 22 * on; }
      k.rr(x - s / 2, y - s / 2, s, s, s * 0.3);
      var g = ctx.createLinearGradient(x, y - s / 2, x, y + s / 2);
      g.addColorStop(0, hexA(col, 0.25 + 0.7 * on)); g.addColorStop(1, hexA(col, 0.08 + 0.42 * on));
      ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
      var sh = ctx.createRadialGradient(x - s * 0.2, y - s * 0.55, 0, x - s * 0.2, y - s * 0.55, s * 0.9);
      sh.addColorStop(0, 'rgba(255,255,255,0.55)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
      k.glyph(name, x, y, s * 0.52, { color: on > 0.5 ? '#0b1514' : k.ink, alpha: a, width: 2 });
      if (o.label) k.text(o.label, x, y + s / 2 + 16, { size: o.labelSize || 13, color: on > 0.5 ? k.ink : k.ink2, align: 'center', alpha: a, weight: 600 });
    };
    k.bubble = function (x, y, w, h, s, o) {
      o = o || {}; var a = o.alpha == null ? 1 : o.alpha; if (a <= 0.001) return;
      k.glass(x, y, w, h, 18, { alpha: a, glow: o.color || k.hl, glowA: 0.8 });
      k.line([[x + 26, y + h - 1], [x + 18, y + h + 14], [x + 42, y + h - 1]], { color: 'rgba(255,255,255,0.3)', width: 1, alpha: a, fill: hexA(o.color || k.hl, k.dark ? 0.12 : 0.3) });
      k.text(s, x + w / 2, y + h / 2, { size: o.size || 17, align: 'center', weight: 600, alpha: a, color: o.ink || k.ink });
    };
    k.particles = function (seed, count, x, y, w, h, o) {
      o = o || {}; var r = k.rnd(seed);
      for (var i = 0; i < count; i++) {
        var px = x + r() * w; var py = y + r() * h; var sp = 0.2 + r() * 0.6; var ph = r() * 6.28;
        k.dot(px + Math.sin(k.t * sp + ph) * 8, py + Math.cos(k.t * sp * 0.8 + ph) * 6, 1 + r() * 2, o.color || k.hl, (o.alpha == null ? 0.4 : o.alpha) * (0.4 + 0.6 * r()));
      }
    };
    return k;
  }

  function init(sec) {
    var draw = scenes[sec.getAttribute('data-story')];
    var canvas = sec.querySelector('.story__canvas');
    var beats = Array.prototype.slice.call(sec.querySelectorAll('.story__beat'));
    if (!draw || !canvas || !canvas.getContext || !beats.length) return;
    var ctx = canvas.getContext('2d');
    var k = makeKit(ctx); k.n = beats.length; k.palette();
    var stage = sec.querySelector('.story__stage');
    var dotsEl = sec.querySelector('.story__dots');
    var dots = beats.map(function () { var d = document.createElement('span'); if (dotsEl) dotsEl.appendChild(d); return d; });
    sec.classList.add('is-live');

    var cw = 0; var ch = 0; var dpr = 1;
    function resize() {
      var r = canvas.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      cw = r.width; ch = r.height; canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      k.fs = clamp(640 / Math.max(1, cw), 1, 1.3); // small labels stay legible on narrow stages
      render();
    }
    function target() {
      var vh = window.innerHeight; var sr = stage.getBoundingClientRect();
      var stacked = sr.bottom < vh * 0.7 && sr.width > sec.getBoundingClientRect().width * 0.8;
      var anchor = stacked ? sr.bottom + (vh - sr.bottom) * 0.4 : vh * 0.5;
      var c = beats.map(function (b) { var r = b.getBoundingClientRect(); return r.top + r.height / 2; });
      if (anchor <= c[0]) return 0;
      for (var i = 0; i < c.length - 1; i++) if (anchor < c[i + 1]) return i + (anchor - c[i]) / (c[i + 1] - c[i]);
      return c.length - 1;
    }
    var p = target(); var t = 0; var last = 0; var visible = false; var raf = 0; var active = -1;
    function render() {
      if (!cw) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      var s = Math.min(cw / W, ch / H);
      ctx.setTransform(s * dpr, 0, 0, s * dpr, (cw - W * s) / 2 * dpr, (ch - H * s) / 2 * dpr);
      k.p = p; k.t = t;
      try { draw(k, p, t); } catch (e) { /* a scene bug must never break the page */ }
    }
    function frame(now) {
      raf = 0;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
      var reduced = reduceMQ.matches;
      var tg = target();
      if (reduced) p = Math.round(tg); else { p += (tg - p) * (1 - Math.exp(-dt * 5)); t += dt; }
      var cur = Math.max(0, Math.min(beats.length - 1, Math.round(p)));
      if (cur !== active) {
        active = cur;
        beats.forEach(function (b, i) { b.classList.toggle('is-active', i === cur); });
        dots.forEach(function (d, i) { d.classList.toggle('is-on', i <= cur); });
      }
      render();
      if (visible && (!reduced || Math.abs(tg - p) > 0.001)) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } }
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; kick(); }, { rootMargin: '100px 0px' }).observe(sec);
    window.addEventListener('scroll', kick, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    new MutationObserver(function () { k.palette(); render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });
    resize();
  }

  function start() { Array.prototype.forEach.call(document.querySelectorAll('.story[data-story]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
