/* =========================================================================
   bg-field.js: a lightweight 3D background behind every page.
   Raw WebGL2, one full-screen fragment shader, no library. Three lit glass
   orbs at different depths drift with scroll (parallax) and loop down the
   page, tinted by the current accent and theme. Rendered at half resolution
   and only when scroll, size or theme changes: no frames at idle. It does not
   follow the pointer: every redraw changes what sits behind each glass
   element, and re-blurring all of them on every mouse move kept the GPU busy.
   Reduced motion keeps it still.
   ========================================================================= */
(function () {
  'use strict';
  var doc = document; var root = doc.documentElement;
  if (window.matchMedia('(forced-colors: active)').matches) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var canvas = doc.createElement('canvas');
  canvas.className = 'bg-field'; canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return;

  var VS = '#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  var FS = [
    '#version 300 es', 'precision highp float;',
    'uniform vec2 uRes; uniform float uScroll; uniform vec2 uPtr; uniform vec3 uBase; uniform vec3 uA; uniform vec3 uB;',
    'out vec4 o;',
    'vec3 orb(vec2 p, vec2 c, float r, vec3 col){',
    // glassy orb: dim interior, bright fresnel rim, small specular; edge is anti-aliased
    '  vec2 d = (p - c) / r; float l = dot(d, d);',
    '  float edge = fwidth(l) * 1.5 + 0.004;',
    '  float inside = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, l);',
    '  vec3 glow = col * exp(-max(l - 1.0, 0.0) * 1.6) * 0.10;',
    '  float z = sqrt(max(1.0 - l, 0.0)); vec3 n = normalize(vec3(d, z + 1e-4));',
    '  vec3 L = normalize(vec3(-0.5, 0.65, 0.6));',
    '  float diff = max(dot(n, L), 0.0);',
    '  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);',
    '  float fres = pow(1.0 - z, 3.0);',
    '  vec3 body = col * (0.04 + 0.14 * diff) + vec3(1.0) * spec * 0.22 + col * fres * 0.75;',
    '  return mix(glow, body, inside);',
    '}',
    'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;',
    '  vec2 p = vec2((uv.x - 0.5) * asp, uv.y - 0.5);',
    '  vec3 col = uBase * (0.92 + 0.16 * uv.y);',
    '  float s = uScroll;',
    // three depths: near (fast), mid, far (slow); y loops so orbs keep appearing down the page
    '  vec2 c1 = vec2(-0.62 * asp * 0.55 + uPtr.x * 0.05, mod(0.25 + s * 0.42 + 1.2, 2.4) - 1.2 + uPtr.y * 0.03);',
    '  vec2 c2 = vec2( 0.70 * asp * 0.55 + uPtr.x * 0.03, mod(-0.35 + s * 0.26 + 1.2, 2.4) - 1.2 + uPtr.y * 0.02);',
    '  vec2 c3 = vec2( 0.05 + uPtr.x * 0.015, mod(0.62 + s * 0.14 + 1.2, 2.4) - 1.2);',
    '  col += orb(p, c1, 0.30, uA) * 0.55;',
    '  col += orb(p, c2, 0.22, mix(uA, uB, 0.25)) * 0.40;',
    '  col += orb(p, c3, 0.42, mix(uA, uB, 0.4)) * 0.28;',
    '  col += (h(gl_FragCoord.xy) - 0.5) * 0.012;', // fine grain against banding
    '  o = vec4(col, 1.0);',
    '}'
  ].join('\n');

  // Any status query blocks until the driver has compiled and linked, so with
  // KHR_parallel_shader_compile the program is polled once per frame instead.
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  var parallel = gl.getExtension('KHR_parallel_shader_compile');
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  var U = {};
  function whenLinked(cb) {
    if (parallel && !gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) { requestAnimationFrame(function () { whenLinked(cb); }); return; }
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uScroll', 'uPtr', 'uBase', 'uA', 'uB'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    cb();
  }

  var probe = doc.createElement('span'); probe.style.display = 'none';
  function rgb(cssVar, fallback) {
    probe.style.color = 'var(' + cssVar + ', ' + fallback + ')';
    var m = getComputedStyle(probe).color.match(/[\d.]+/g) || [0, 0, 0];
    return [m[0] / 255, m[1] / 255, m[2] / 255].map(function (v) { return Math.pow(v, 2.2); });
  }
  var colors = {};
  function readColors() { colors.base = rgb('--page', '#0d0e10'); colors.a = rgb('--hl', '#8cf0d3'); colors.b = rgb('--decor', '#d8b98b'); }

  var W = 1; var H = 1; var ptr = { x: 0, y: 0 }; var raf = 0;
  function resize() {
    var k = Math.min(0.7, (window.devicePixelRatio || 1) * 0.5); // ~0.5-0.7x: soft content, upscaled smoothly
    W = Math.max(2, Math.round(window.innerWidth * k)); H = Math.max(2, Math.round(window.innerHeight * k));
    canvas.width = W; canvas.height = H; request();
  }
  function request() { if (!raf) raf = requestAnimationFrame(draw); }
  function draw() {
    raf = 0;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U.uRes, W, H);
    gl.uniform1f(U.uScroll, reduce.matches ? 0 : window.scrollY / Math.max(1, window.innerHeight));
    gl.uniform2f(U.uPtr, reduce.matches ? 0 : ptr.x, reduce.matches ? 0 : ptr.y);
    // shader works in linear light; convert back roughly to sRGB in the output via gamma
    gl.uniform3fv(U.uBase, colors.base.map(function (v) { return Math.pow(v, 1 / 2.2); }));
    gl.uniform3fv(U.uA, colors.a.map(function (v) { return Math.pow(v, 1 / 2.2); }));
    gl.uniform3fv(U.uB, colors.b.map(function (v) { return Math.pow(v, 1 / 2.2); }));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add('is-on');
  }

  function start() {
    doc.body.insertBefore(canvas, doc.body.firstChild);
    doc.body.appendChild(probe);
    readColors(); resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', function () { if (!reduce.matches) request(); }, { passive: true });
    new MutationObserver(function () { readColors(); request(); }).observe(root, { attributes: true, attributeFilter: ['data-accent', 'data-theme'] });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); canvas.classList.remove('is-on'); });
    canvas.addEventListener('webglcontextrestored', function () { canvas.remove(); });
  }
  function boot() { whenLinked(start); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
