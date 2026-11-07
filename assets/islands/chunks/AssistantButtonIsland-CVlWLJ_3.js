import{A as xe,h as He,_ as pt}from"./compat.module-DdK5-UJK.js";import{u as Q,a as vt,o as xt}from"./env-C2-whvUy.js";import"../islands.js";const mt=t=>{try{const p=t.getExtension("WEBGL_debug_renderer_info");return/swiftshader|llvmpipe|softpipe|software/i.test(String(t.getParameter(p?p.UNMASKED_RENDERER_WEBGL:t.RENDERER)))}catch{return!1}},q=1100,lt=380,yt=10,Y=q/(2*lt),bt=5,J=4,rt=.55,Xe=q*.75,Ge=.42,Be={small:{h:36,px:16,fs:13,k:.82},medium:{h:44,px:22,fs:14,k:1},large:{h:52,px:26,fs:16,k:1.18},"extra-large":{h:60,px:30,fs:18,k:1.36}},C=(t,p,L)=>Math.min(L,Math.max(p,t)),ne=(t,p)=>Number.isFinite(Number(t))&&t!==null&&t!==""?Number(t):p,me=t=>{const p=C(t,0,1);return p*p*(3-2*p)},nt=t=>{const p=C(t,0,1);return p*p*p*(10+p*(6*p-15))},ct=t=>{const p=C(t,0,1);return 30*p*p*(1-p)*(1-p)},wt=t=>{const p=C(t,0,1);return 60*p*(1-p)*(1-2*p)},Pe=(t,p)=>Math.sin(t*1.31+p)*.5+Math.sin(t*2.73+p*1.7)*.3+Math.sin(t*5.19+p*2.3)*.2,kt=(t,p)=>Math.cos(t*1.31+p)*.655+Math.cos(t*2.73+p*1.7)*.819+Math.cos(t*5.19+p*2.3)*1.038,it=t=>{const p=String(t||"").replace("#",""),L=p.length===3?p.replace(/(.)/g,"$1$1"):p.padEnd(6,"0").slice(0,6),W=parseInt(L,16);return Number.isFinite(W)?[(W>>16&255)/255,(W>>8&255)/255,(W&255)/255]:[1,1,1]},Tt=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,ae=`#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
`,Ke=`
uniform vec4 uJetA[${J}];
uniform vec4 uJetB[${J}];
uniform float uJetBend[${J}];
float jetWeight(vec2 p, vec4 a, vec4 b, out float along) {
  vec2 rel = p - a.xy;
  along = dot(rel, a.zw);
  vec2 off = rel - a.zw * clamp(along, 0.0, b.z);
  return exp(-dot(off, off) / (b.y * b.y)) * smoothstep(-b.y, 0.0, along);
}
`,Oe=`
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`,Mt=`${ae}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uWorld;
uniform float uDt;
uniform float uKeep;
void main() {
  vec2 v = textureLod(uVelocity, vUv, 0.0).xy;
  if (!(abs(v.x) < 4000.0 && abs(v.y) < 4000.0)) v = vec2(0.0);
  vec4 c = textureLod(uSource, vUv - uDt * v / uWorld, 0.0) * uKeep;
  outColor = all(lessThan(abs(c), vec4(1e4))) ? c : vec4(0.0);
}`,gt=`${ae}
uniform sampler2D uVelocity;
uniform sampler2D uDye;
uniform vec2 uWorld;
uniform float uDt;
uniform float uBuoyancy;
uniform float uLift;
uniform float uDamping;
uniform float uSpread;
uniform float uSplash;
uniform float uFriction;
uniform float uWind;
uniform vec3 uKick;
uniform vec4 uCraft;
uniform vec4 uCraftMotion;
uniform vec2 uTurb;
uniform float uTime;
uniform float uObstacle;
${Ke}
${Oe}
vec2 curlNoise(vec2 p) {
  float e = 0.35;
  float a = noise(p + vec2(0.0, e));
  float b = noise(p - vec2(0.0, e));
  float c = noise(p + vec2(e, 0.0));
  float d = noise(p - vec2(e, 0.0));
  return vec2(a - b, d - c) / (2.0 * e);
}
void main() {
  vec2 p = vUv * uWorld;
  vec2 v = textureLod(uVelocity, vUv, 0.0).xy;
  vec2 d = textureLod(uDye, vUv, 1.0).xy;
  float smokeHere = smoothstep(0.02, 0.4, d.x + d.y);
  vec2 tq = p / uTurb.y;
  vec2 turb = curlNoise(tq + vec2(uTime * 0.21, -uTime * 0.37)) + 0.5 * curlNoise(tq * 2.3 + vec2(-uTime * 0.53, uTime * 0.29) + 7.0);
  v += turb * uTurb.x * smokeHere * uDt;
  v.y += (uBuoyancy * d.y + uLift * d.x) * uDt;
  v /= 1.0 + uDamping * uDt;
  v.x /= 1.0 + uFriction * exp(-p.y / 18.0) * uDt;
  v.x += (uWind - v.x) * (1.0 - exp(-0.35 * uDt)) * smoothstep(0.0, 60.0, p.y);
  for (int i = 0; i < ${J}; i++) {
    vec4 b = uJetB[i];
    if (b.w <= 0.0) continue;
    vec4 a = uJetA[i];
    vec2 rel = p - a.xy;
    float along = dot(rel, a.zw);
    float across = dot(rel, vec2(-a.w, a.z));
    float reach = a.w < -0.2 ? a.y / -a.w : max(b.z, 1.0);
    float bn = clamp(along / max(reach, 1.0), 0.0, 1.0);
    across -= uJetBend[i] * bn * bn;
    vec2 dir = normalize(a.zw + vec2(-a.w, a.z) * (2.0 * uJetBend[i] * bn / max(reach, 1.0)));
    float sN = clamp(along / max(b.z, 1.0), 0.0, 1.0);
    float R = b.y + uSpread * clamp(along, 0.0, b.z);
    float wr = exp(-across * across / (R * R));
    float wa = smoothstep(-b.y, 0.0, along) * (1.0 - smoothstep(0.55, 1.0, sN));
    float rate = mix(46.0, 7.0, sN);
    float w = (1.0 - exp(-uDt * rate)) * wr * wa * clamp(b.w * 3.0, 0.0, 1.0);
    float U = b.x * sqrt(b.y / R);
    v = mix(v, dir * U, w);
  }
  for (int i = 0; i < ${J}; i++) {
    vec4 b = uJetB[i];
    if (b.w <= 0.0) continue;
    vec4 a = uJetA[i];
    if (a.w > -0.2) continue;
    float reach = a.y / -a.w;
    float gx = a.x + a.z * reach - a.w * uJetBend[i];
    float near = exp(-reach / uKick.x);
    float sx = uKick.y + reach * 0.25;
    float kx = (p.x - gx) / (sx * 1.6);
    float ky = p.y / (uKick.z * 1.5);
    float k = exp(-kx * kx - ky * ky);
    float side = clamp((p.x - gx) / sx, -1.0, 1.0);
    v += uDt * uSplash * b.w * near * k * vec2(side * 0.7, 0.9);
  }
  vec2 q = p - uCraft.xy;
  float c = cos(uCraftMotion.z);
  float s = sin(uCraftMotion.z);
  vec2 lq = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
  vec2 e = abs(lq) - uCraft.zw + uCraft.w;
  float sd = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - uCraft.w;
  float inside = smoothstep(2.0, -2.0, sd) * uObstacle;
  vec2 cv = uCraftMotion.xy + uCraftMotion.w * vec2(-q.y, q.x);
  v = mix(v, cv, inside);
  float speed = length(v);
  if (!(speed < 1e5)) v = vec2(0.0);
  else if (speed > 2600.0) v *= 2600.0 / speed;
  outColor = vec4(v, 0.0, 1.0);
}`,Ct=`${ae}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main() {
  float L = textureLod(uVelocity, vUv - vec2(uTexel.x, 0.0), 0.0).y;
  float R = textureLod(uVelocity, vUv + vec2(uTexel.x, 0.0), 0.0).y;
  float B = textureLod(uVelocity, vUv - vec2(0.0, uTexel.y), 0.0).x;
  float T = textureLod(uVelocity, vUv + vec2(0.0, uTexel.y), 0.0).x;
  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,Et=`${ae}
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uStrength;
uniform float uDt;
void main() {
  float L = textureLod(uCurl, vUv - vec2(uTexel.x, 0.0), 0.0).x;
  float R = textureLod(uCurl, vUv + vec2(uTexel.x, 0.0), 0.0).x;
  float B = textureLod(uCurl, vUv - vec2(0.0, uTexel.y), 0.0).x;
  float T = textureLod(uCurl, vUv + vec2(0.0, uTexel.y), 0.0).x;
  float C = textureLod(uCurl, vUv, 0.0).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 1e-4;
  f *= uStrength * C;
  f.y *= -1.0;
  vec2 v = textureLod(uVelocity, vUv, 0.0).xy + f * uDt;
  if (!(abs(v.x) < 4000.0 && abs(v.y) < 4000.0)) v = vec2(0.0);
  outColor = vec4(v, 0.0, 1.0);
}`,Lt=`${ae}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main() {
  vec2 C = textureLod(uVelocity, vUv, 0.0).xy;
  float L = textureLod(uVelocity, vUv - vec2(uTexel.x, 0.0), 0.0).x;
  float R = textureLod(uVelocity, vUv + vec2(uTexel.x, 0.0), 0.0).x;
  float B = textureLod(uVelocity, vUv - vec2(0.0, uTexel.y), 0.0).y;
  float T = textureLod(uVelocity, vUv + vec2(0.0, uTexel.y), 0.0).y;
  if (vUv.y - uTexel.y < 0.0) B = -C.y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,ut=`
float pressureAt(sampler2D tex, vec2 uv, vec2 texel, float c, int side) {
  if (side == 0 && uv.x - texel.x < 0.0) return 0.0;
  if (side == 1 && uv.x + texel.x > 1.0) return 0.0;
  if (side == 2 && uv.y - texel.y < 0.0) return c;
  if (side == 3 && uv.y + texel.y > 1.0) return 0.0;
  vec2 o = side == 0 ? vec2(-texel.x, 0.0) : side == 1 ? vec2(texel.x, 0.0) : side == 2 ? vec2(0.0, -texel.y) : vec2(0.0, texel.y);
  return textureLod(tex, uv + o, 0.0).x;
}
`,Dt=`${ae}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
${ut}
void main() {
  float C = textureLod(uPressure, vUv, 0.0).x;
  float L = pressureAt(uPressure, vUv, uTexel, C, 0);
  float R = pressureAt(uPressure, vUv, uTexel, C, 1);
  float B = pressureAt(uPressure, vUv, uTexel, C, 2);
  float T = pressureAt(uPressure, vUv, uTexel, C, 3);
  float div = textureLod(uDivergence, vUv, 0.0).x;
  float pr = (L + R + B + T - div) * 0.25;
  outColor = vec4(abs(pr) < 1e6 ? pr : 0.0, 0.0, 0.0, 1.0);
}`,Rt=`${ae}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
${ut}
void main() {
  float C = textureLod(uPressure, vUv, 0.0).x;
  float L = pressureAt(uPressure, vUv, uTexel, C, 0);
  float R = pressureAt(uPressure, vUv, uTexel, C, 1);
  float B = pressureAt(uPressure, vUv, uTexel, C, 2);
  float T = pressureAt(uPressure, vUv, uTexel, C, 3);
  vec2 v = textureLod(uVelocity, vUv, 0.0).xy - 0.5 * vec2(R - L, T - B);
  if (vUv.y - uTexel.y < 0.0) v.y = max(v.y, 0.0);
  if (!(abs(v.x) < 4000.0 && abs(v.y) < 4000.0)) v = vec2(0.0);
  outColor = vec4(v, 0.0, 1.0);
}`,St=`${ae}
uniform sampler2D uSource;
uniform vec2 uStep;
void main() {
  vec2 c = textureLod(uSource, vUv, 0.0).xy * 0.2270270;
  c += textureLod(uSource, vUv + uStep * 1.3846154, 0.0).xy * 0.3162162;
  c += textureLod(uSource, vUv - uStep * 1.3846154, 0.0).xy * 0.3162162;
  c += textureLod(uSource, vUv + uStep * 3.2307692, 0.0).xy * 0.0702703;
  c += textureLod(uSource, vUv - uStep * 3.2307692, 0.0).xy * 0.0702703;
  outColor = vec4(c, 0.0, 1.0);
}`,Ut=`${ae}
uniform sampler2D uSource;
uniform float uScale;
void main() {
  outColor = textureLod(uSource, vUv, 0.0) * uScale;
}`,At=`${ae}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uWorld;
uniform float uDt;
uniform vec2 uKeep;
uniform vec4 uRate;
uniform vec4 uCol;
uniform vec3 uKick;
uniform float uDisperse;
uniform float uDispV;
uniform vec4 uCraft;
uniform vec4 uCraftMotion;
uniform vec2 uGap;
uniform float uJetX[${J}];
uniform float uJetN;
uniform float uFloor;
uniform float uTime;
${Ke}
${Oe}
void main() {
  vec2 v = textureLod(uVelocity, vUv, 0.0).xy;
  vec2 val = textureLod(uSource, vUv - uDt * v / uWorld, 0.0).xy * uKeep;
  val.x *= exp(-uDisperse * max(length(v) - uDispV, 0.0) * 0.01 * uDt);
  {
    vec2 q = vUv * uWorld - uCraft.xy;
    float c = cos(uCraftMotion.z);
    float sn = sin(uCraftMotion.z);
    vec2 lq = vec2(c * q.x + sn * q.y, -sn * q.x + c * q.y);
    float belly = uCraft.y - uCraft.w - 7.0;
    float depth = 0.68 * belly * smoothstep(40.0, 110.0, belly);
    float below = -lq.y - uCraft.w;
    float wy = smoothstep(-4.0, 6.0, below) * (1.0 - smoothstep(depth * 0.7, depth, below));
    float nearest = 1e4;
    float outer = 0.0;
    for (int k = 0; k < ${J}; k++) {
      if (float(k) >= uJetN) break;
      nearest = min(nearest, abs(lq.x - uJetX[k]));
      outer = max(outer, abs(uJetX[k]));
    }
    float wx = uGap.x > 1.0 ? smoothstep(uGap.x * 0.22, uGap.x * 0.4, nearest) * (1.0 - smoothstep(outer - uGap.x * 0.1, outer, abs(lq.x))) : 0.0;
    val.x *= exp(-uGap.y * wx * wy * uDt);
  }
  val.x = max(val.x - uFloor * uDt, 0.0);
  vec2 p = vUv * uWorld;
  for (int i = 0; i < ${J}; i++) {
    vec4 jb = uJetB[i];
    if (jb.w <= 0.0) continue;
    vec4 ja = uJetA[i];
    vec2 rel = p - ja.xy;
    float along = dot(rel, ja.zw);
    float across = dot(rel, vec2(-ja.w, ja.z));
    vec2 off = rel - ja.zw * clamp(along, 0.0, 6.0);
    float wn = exp(-dot(off, off) / (jb.y * jb.y)) * smoothstep(-jb.y, 0.0, along);
    float pulse = 0.6 + 0.8 * noise(vec2(uTime * 6.0 + float(i) * 13.1, along * 0.06 + float(i)));
    val.x += uRate.x * jb.w * wn * pulse * uDt;
    val.y += uRate.y * jb.w * wn * uDt;
    float reach = ja.w < -0.2 ? ja.y / -ja.w : 1e4;
    float sN = clamp(along / max(reach, 1.0), 0.0, 1.0);
    across -= uJetBend[i] * sN * sN;
    float R = uCol.y + uCol.x * clamp(along, 0.0, reach);
    float wc = exp(-across * across / (R * R)) * smoothstep(0.45, 0.8, sN) * (1.0 - step(reach + 2.0, along));
    float grain = 0.45 + 1.1 * noise(vec2(across * 0.12 + float(i) * 3.0, along * 0.05 - uTime * 9.0));
    val.x += uRate.w * jb.w * wc * grain * uDt;
    val.y += uRate.y * 0.25 * jb.w * wc * uDt;
    if (reach < 1e3) {
      float gx = ja.x + ja.z * reach - ja.w * uJetBend[i];
      float near = exp(-reach / uKick.x);
      float spread = uKick.y + reach * 0.25;
      float kx = (p.x - gx) / spread;
      float ky = p.y / uKick.z;
      float k = exp(-kx * kx - ky * ky);
      float g2 = 0.5 + noise(vec2(p.x * 0.08, uTime * 4.0 + float(i) * 9.0));
      val.x += uRate.z * jb.w * near * k * g2 * uDt;
      val.y += uRate.y * 0.4 * jb.w * near * k * uDt;
    }
  }
  if (!(val.x < 1e3 && val.y < 1e3 && val.x >= 0.0 && val.y >= 0.0)) val = vec2(0.0);
  outColor = vec4(val, 0.0, 1.0);
}`,_t=`${ae}
uniform sampler2D uDye;
uniform vec2 uWorld;
uniform vec2 uDyeSize;
uniform float uTime;
uniform float uLightTheme;
uniform vec3 uSmoke;
uniform vec3 uShade;
uniform vec3 uThrust;
uniform vec4 uLook;
uniform vec4 uLook2;
uniform vec4 uLook3;
uniform vec4 uCol;
uniform float uGamma;
uniform float uTone;
uniform vec3 uLight2;
uniform float uThreshold;
uniform float uScale;
uniform vec4 uCraft;
uniform vec4 uCraftMotion;
${Ke}
${Oe}
float dens(vec2 p, float lod) {
  return textureLod(uDye, p / uWorld, lod).x;
}
float hash1(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}
float fbm2(vec2 p) {
  return noise(p) * 0.65 + noise(p * 2.13 + 17.0) * 0.35;
}
float flowNoise(float q, float xn, float t, float id, float rate) {
  float c = t / 0.7;
  float f1 = fract(c);
  float f2 = fract(c + 0.5);
  float k1 = floor(c);
  float k2 = floor(c + 0.5);
  float n1 = fbm2(vec2(q - f1 * 0.7 * rate + hash1(k1 + id * 7.0) * 41.0, xn * 1.15 + id * 3.7));
  float n2 = fbm2(vec2(q - f2 * 0.7 * rate + hash1(k2 + id * 7.0 + 0.5) * 41.0, xn * 1.15 + id * 3.7 + 11.0));
  float w1 = 1.0 - abs(2.0 * f1 - 1.0);
  float w2 = 1.0 - w1;
  return 0.5 + (n1 * w1 + n2 * w2 - 0.5) / sqrt(w1 * w1 + w2 * w2);
}
float column(vec2 p, vec4 a, float str, float id, float t, float bend, out float xn, out float s) {
  vec2 rel = p - a.xy;
  s = dot(rel, a.zw);
  float x = dot(rel, vec2(-a.w, a.z));
  float S = a.w < -0.2 ? a.y / -a.w : 1e4;
  float bn = clamp(s / max(S, 1.0), 0.0, 1.0);
  x -= bend * bn * bn;
  xn = 0.0;
  if (s < -4.0 || s > S + 6.0) return 0.0;
  float sc = clamp(s, 0.0, S);
  float R = uCol.y + uCol.x * sc;
  float flare = smoothstep(S - 32.0 * uScale, S + 2.0, sc);
  R *= 1.0 + 1.3 * flare * flare;
  xn = x / R;
  if (abs(xn) > 3.2) return 0.0;
  float q = log(1.0 + 0.22 * sc / (9.0 * uScale)) / 0.22;
  float lam = 9.0 * uScale + 0.22 * sc;
  float U = uCol.w * sqrt(str) * sqrt(uCol.y / R);
  float n = flowNoise(q, xn, t, id, U / lam);
  float amp = 0.12 + 0.5 * smoothstep(4.0, 70.0, sc);
  float u = abs(xn) * (1.0 - amp * (n - 0.5) * 1.8);
  float prof = exp(-u * u * 1.7);
  float dil = pow(uCol.y / R, 0.5);
  float onset = smoothstep(2.0 * uScale, 16.0 * uScale, s);
  float tail = 1.0 - smoothstep(S - 2.0, S + 6.0, s);
  return uCol.z * str * prof * dil * onset * tail * (0.7 + 0.6 * n);
}
float shape(vec2 p, float lod) {
  return log(1.0 + 3.0 * dens(p, lod));
}
void main() {
  vec2 p = vUv * uWorld;
  float texel = uWorld.x / uDyeSize.x;
  float D = textureLod(uDye, vUv, uLook.w).x;
  float heat = textureLod(uDye, vUv, 0.5).y;

  float e = uLook3.x;
  float lodN = max(log2(e / texel), 0.0) + uLook3.y;
  vec2 g = vec2(shape(p + vec2(e, 0.0), lodN) - shape(p - vec2(e, 0.0), lodN), shape(p + vec2(0.0, e), lodN) - shape(p - vec2(0.0, e), lodN)) / (2.0 * e);
  float e2 = e * 3.0;
  float lodB = lodN + 1.6;
  vec2 g2 = vec2(shape(p + vec2(e2, 0.0), lodB) - shape(p - vec2(e2, 0.0), lodB), shape(p + vec2(0.0, e2), lodB) - shape(p - vec2(0.0, e2), lodB)) / (2.0 * e2);
  vec3 nS = normalize(vec3(-(g * uLook3.z + g2 * uLook3.w) * uLook.y, 1.0));

  float colD = 0.0;
  vec2 colN = vec2(0.0);
  float colHot = 0.0;
  float colNear = 0.0;
  for (int i = 0; i < ${J}; i++) {
    vec4 jb = uJetB[i];
    if (jb.w <= 0.0) continue;
    vec4 ja = uJetA[i];
    float xn;
    float sa;
    float cd = column(p, ja, min(jb.w, 1.6), float(i), uTime, uJetBend[i], xn, sa);
    colD += cd;
    colN += vec2(-ja.w, ja.z) * clamp(xn, -1.6, 1.6) * cd;
    colHot += cd * exp(-max(sa, 0.0) / 45.0);
    colNear += cd * exp(-max(sa, 0.0) / 16.0);
  }
  float Dt = D + colD;
  float alpha = 1.0 - exp(-uLook.x * pow(max(D - uThreshold, 0.0) + colD, uGamma));
  vec2 cn = colD > 1e-5 ? colN / colD : vec2(0.0);
  vec3 nC = normalize(vec3(cn * 0.85, sqrt(max(1.0 - dot(cn, cn) * 0.72, 0.08))));
  float wC = colD / max(Dt, 1e-5);
  vec3 n = normalize(mix(nS, nC, wC));
  vec3 L = normalize(vec3(-0.38, 0.6, 0.72));
  float diff = clamp((dot(n, L) + uLook2.z) / (1.0 + uLook2.z), 0.0, 1.0);

  vec2 ld = normalize(L.xy);
  float tau = 0.0;
  float dist = 2.0;
  float stepLen = 3.0;
  for (int i = 0; i < 9; i++) {
    float lod = max(log2(stepLen / texel), 0.0);
    tau += dens(p + ld * dist, lod) * stepLen;
    dist += stepLen;
    stepLen *= 1.4;
  }
  float sun = mix(exp(-uLook.z * tau), 1.0, wC * 0.6);
  float ao = mix(exp(-uLook2.w * dens(p, 4.5)), 1.0, wC);

  vec3 amb = vec3(0.84, 0.88, 1.0) * uLook2.x;
  vec3 key = vec3(1.0, 0.985, 0.96) * uLook2.y;
  vec3 lit = amb * ao + key * sun * diff;

  vec3 jl = vec3(0.0);
  vec3 core = vec3(0.0);
  for (int i = 0; i < ${J}; i++) {
    vec4 jb = uJetB[i];
    if (jb.w <= 0.0) continue;
    vec4 ja = uJetA[i];
    vec2 rel = p - ja.xy;
    float along = dot(rel, ja.zw);
    float across = dot(rel, vec2(-ja.w, ja.z));
    float str = min(jb.w, 1.6);
    float flick = 0.9 + 0.2 * noise(vec2(uTime * 38.0, float(i) * 5.0));
    float len = (8.0 + 12.0 * str) * flick * uScale;
    float sN = along / len;
    float wid = 3.2 * uScale * (0.9 - 0.5 * clamp(sN, 0.0, 1.0)) + 0.3;
    float radial = exp(-across * across / (wid * wid));
    float axial = smoothstep(-0.12, 0.04, sN) * pow(clamp(1.0 - sN, 0.0, 1.0), 1.5);
    float c = radial * axial * str;
    core += mix(uThrust, vec3(1.0), smoothstep(0.25, 0.9, c)) * c * 1.3;
    float d = length(rel - ja.zw * clamp(along, 0.0, len));
    core += uThrust * str * (0.22 * exp(-d / (5.0 * uScale)) + 0.06 * exp(-d / (18.0 * uScale)));
    jl += uThrust * str * uLight2.x * (exp(-d / (30.0 * uScale)) + 0.45 * exp(-d / (100.0 * uScale)));
  }

  vec3 jlNear = jl * 0.35 + uThrust * colNear / max(Dt, 1e-4) * 0.9;
  jl += uThrust * colHot / max(Dt, 1e-4) * 0.9;
  if (uLightTheme > 0.5) {
    float shade = dot(lit + jl * 0.8, vec3(0.3333)) * uLight2.z;
    vec3 ink = mix(uShade, uSmoke, smoothstep(0.15, 1.2, shade));
    alpha = 1.0 - pow(1.0 - alpha, 1.25);
    ink = mix(ink, uThrust, clamp(dot(jlNear, vec3(0.3333)) * 0.5, 0.0, 0.3));
    float ca = clamp(max(core.r, max(core.g, core.b)) * 0.85, 0.0, 1.0);
    vec3 coreInk = mix(uThrust, vec3(1.0), 0.35 * smoothstep(0.7, 1.0, ca));
    vec3 lc = ink * alpha * (1.0 - ca) + coreInk * ca;
    float la = alpha + ca * (1.0 - alpha);
    outColor = vec4(lc, la);
    return;
  }
  vec3 smoke = uSmoke * (lit + jl) * uLight2.z;
  smoke = mix(smoke / (1.0 + 0.35 * max(smoke - 0.8, 0.0)), 1.0 - exp(-smoke * 1.35), uTone);
  vec3 emit = mix(uThrust, vec3(1.0), 0.5) * heat * heat * uLight2.y;
  vec3 col = (smoke + emit) * alpha + core;
  float a = clamp(max(alpha, max(col.r, max(col.g, col.b))), 0.0, 1.0);
  col = min(col, vec3(a));
  col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0 * a;
  outColor = vec4(max(col, 0.0), a);
}`,Fe={colSpread:.1,colR:3.6,colD:1.25,colU:420,splash:400,friction:5,disperse:.6,dispV:60,gap:10,wind:8,turb:350,turbScale:34,jetLight:.3,threshold:.035,blur:3,emit:0,exposure:1.3,tone:1,gamma:.6,kickNear:45,kickW:18,kickH:14,vort:6,spread:.1,floor:.02,keepD:.3,keepIdle:.45,rateN:0,rateH:6,rateK:20,rateC:3,buoy:330,lift:22,damp:.55,radius:6,speed:380,reach:.9,forceMax:240,alphaK:4,relief:9,shadow:.026,alphaLod:0,ambient:.58,key:.82,wrap:.35,ao:.35,normalE:3,normalLod:-.8,fine:.35,broad:.9,iters:28};function jt({root:t,canvas:p,button:L,cursor:W,ramp:A,props:g}){const H=p.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,powerPreference:"default",failIfMajorPerformanceCaveat:!0}),ce=typeof window<"u"&&window.matchMedia?window.matchMedia("(prefers-reduced-motion: reduce)"):null,e={W:0,H:0,dpr:1,bw:0,bh:0,x:0,vx:0,y:-Y,vy:0,th:0,w:0,fvx:0,fvy:0,thrust:[0,0,0,0],delay:[0,0,0,0],phase:"rest",pt:0,clock:0,seed:Math.random()*100,wind:1,alt:160,climbT:1.6,y0:0,vrPrev:0,hold:2.4,xRef:0,landX:0,boost:!1,contact:!0,placed:!1,track:null,back:null,flip:null,rampKey:"",rampGeo:null,strip:null,u:0,v:0,target:{x:0,y:0},pointer:{in:!1,x:0,y:0,type:"mouse"},off:{x:0,y:0},attached:!1,hover:!1,armed:!0,carry:!1,pressed:!1,press:null,drag:null,suppress:!1,lastC:null,lastTh:0,quiet:7,running:!1,last:0,raf:0,simTime:0,activity:0};let z=null;if(H&&!mt(H)&&(H.getExtension("EXT_color_buffer_float")||H.getExtension("EXT_color_buffer_half_float")))try{z=Nt(H)}catch{z=null}const f=()=>!!(ce&&ce.matches),X=()=>(Be[g.current.size]||Be.medium).k,I=()=>bt*X(),Te=()=>C(Math.round(ne(g.current.jets,2)),1,J),Z=()=>{const o=Te();if(o===1)return[0];const a=e.bw*(o===2?.3:.34);return Array.from({length:o},(s,n)=>a*(2*n/(o-1)-1))},Me=()=>{const o=Z();return o.length>1?[o[0],o[o.length-1]]:[-.3*e.bw,.3*e.bw]},$=()=>e.thrust[0]+e.thrust[1]+e.thrust[2]+e.thrust[3],Re=()=>e.phase==="ignite"||e.phase==="climb"||e.phase==="hover"||e.phase==="descend"||e.phase==="drag",ge=()=>e.phase==="drive"||e.phase==="loop"||e.phase==="flip"||e.phase==="return",re=()=>[e.bw/2+4,Math.max(e.bw/2+4,e.W-e.bw/2-4)],ee=()=>!!g.current.ramp,y=()=>{const o=I()+e.bh/2,a=`${e.W}|${e.H}|${e.bw}|${o}`;if(e.rampKey===a&&e.rampGeo)return e.rampGeo;const s=Math.max(e.H*.24,I()+e.bh+40),n=1/s,u=s*.4,l=s*Math.PI/2-u,v=(R,S)=>{const F=[[u,0,n],[l,n,n],[u,n,0],[R,0,0],[u,0,n],[l,n,n],[u,n,0],[S,0,0]],_={ss:[0],xs:[0],ys:[0],ps:[0],ks:[0]};let V=0,G=0,K=0,le=0;return F.forEach(([ue,we,Ce])=>{const pe=Math.max(1,Math.round(ue/1.5)),fe=ue/pe;for(let ve=0;ve<pe;ve+=1){const Ee=we+(Ce-we)*((ve+.5)/pe),Le=K+Ee*fe/2;V+=Math.cos(Le)*fe,G+=Math.sin(Le)*fe,K+=Ee*fe,le+=fe,_.ss.push(le),_.xs.push(V),_.ys.push(G),_.ps.push(K),_.ks.push(we+(Ce-we)*((ve+1)/pe))}}),_},T=v(0,0),m=Math.max(0,e.H*.66-Math.max(...T.ys)),E=v(m,Math.max(48,e.W*.16)),k=C(s*.12,8,16),D=e.W-Math.max(18,e.W*.05)-k-Math.max(...E.xs),U=E.xs.map(R=>R+D),B=E.ss.length-1,x=E.ys.findIndex(R=>R>3),i=x<0?U[B]:U[x],M={...E,xs:U,r:s,T:k,x0:D,foot:i,S:E.ss[B],clear:Math.min(i,U[B])-12,ok:Math.max(...E.ys)+k<e.H-8};return e.rampKey=a,e.rampGeo=M,M},d=()=>{const[o,a]=re();if(!ee())return C(e.W/2,o,a);const s=y();return C(Math.min(s.foot*.5,s.x0-90,s.clear-e.bw/2-40),o,a)},r=()=>({x:e.x,y:I()+e.bh/2+e.y+Y}),h=()=>{const o=r(),a=Math.cos(e.th),s=Math.sin(e.th),n=g.current.thrusters?-(e.bh/2+I())+1:-(e.bh/2)+2;return Z().map(u=>({x:o.x+u*a-n*s,y:o.y+u*s+n*a,dx:s,dy:-a}))},b=()=>{const o=r();return{x:o.x,y:e.H-o.y}},P=(o,a,s,n,u,l,v)=>{const T=u[0]-l[0],m=v[0]-l[0],E=n[0]-u[0]+l[0]-v[0],k=u[1]-l[1],D=v[1]-l[1],U=n[1]-u[1]+l[1]-v[1],B=T*D-m*k||1e-6,x=(E*D-m*U)/B,i=(T*U-E*k)/B,M=u[0]-n[0]+x*u[0],R=v[0]-n[0]+i*v[0],S=u[1]-n[1]+x*u[1],F=v[1]-n[1]+i*v[1],_=n[0]-M*o/a,V=n[1]-S*o/a;return Math.abs(x)<1e-7&&Math.abs(i)<1e-7?`matrix(${[M/a,S/a,R/s,F/s,_,V].map(K=>K.toFixed(6)).join(",")})`:`matrix3d(${[M/a,S/a,0,x/a,R/s,F/s,0,i/s,0,0,1,0,_,V,0,1-x*o/a].map(K=>K.toFixed(6)).join(",")})`},j=()=>{e.strip&&(e.strip.wrap.remove(),e.strip.ink.remove(),e.strip=null,L.style.visibility="")},O=()=>{j();const o=e.track;if(!o)return;const a=o.geo,s=I()+e.bh/2,n=[0];for(let x=1;x<a.ss.length;x+=1){const i=(a.ks[x]+a.ks[x-1])/2;n.push(n[x-1]+(a.ss[x]-a.ss[x-1])*Math.max(1-i*s,.2))}const u=C(Math.round(e.bw/8),8,32),l=document.createElement("div");l.setAttribute("aria-hidden","true"),l.style.cssText="position:absolute;inset:0;z-index:1;pointer-events:none";const v=document.createElement("div");v.setAttribute("aria-hidden","true"),v.style.cssText="position:absolute;inset:0;z-index:2;pointer-events:none;will-change:transform";const T=Array.from(L.children),m=T[1],E=T.slice(2).map(x=>{const i=x.cloneNode(!0);return i.style.left="0px",i.style.top="0px",i.style.transformOrigin="0 0",l.appendChild(i),{el:i,x:x.offsetLeft,y:x.offsetTop+x.offsetHeight/2,k:1}}),k=[];for(let x=0;x<u;x+=1){const i=L.cloneNode(!0);i.removeAttribute("data-hover"),i.removeAttribute("data-pressed"),i.setAttribute("tabindex","-1"),i.setAttribute("inert",""),Array.from(i.children).slice(1).forEach(S=>{S.style.visibility="hidden"});const M=e.bw*x/u-(x?.75:2),R=e.bw*(x+1)/u+(x<u-1?.75:2);i.style.visibility="visible",i.style.transformOrigin="0 0",i.style.clipPath=`polygon(${M}px -2px, ${R}px -2px, ${R}px ${e.bh+2}px, ${M}px ${e.bh+2}px)`,l.appendChild(i),k.push(i)}const D=[],U=m&&m.textContent||"",B=document.createElement("canvas").getContext("2d");if(m&&B&&U.trim()&&!m.children.length){const x=getComputedStyle(m),i=`${x.fontStyle} ${x.fontWeight} ${x.fontSize} ${x.fontFamily}`;B.font=i;const M=Array.from(U),R=_=>B.measureText(M.slice(0,_).join("")).width,S=R(M.length)||1,F=m.offsetTop+m.offsetHeight/2;M.forEach((_,V)=>{const G=document.createElement("span");G.textContent=_,G.style.cssText=`position:absolute;left:0;top:0;white-space:pre;line-height:1;transform-origin:0 0;font:${i};color:${x.color}`,v.appendChild(G),D.push({el:G,x:m.offsetLeft+(R(V)+R(V+1))/2*(m.offsetWidth/S),y:F,k:.5})})}else if(m){const x=m.cloneNode(!0);x.style.position="absolute",x.style.left="0px",x.style.top="0px",x.style.transformOrigin="0 0",v.appendChild(x),D.push({el:x,x:m.offsetLeft+m.offsetWidth/2,y:m.offsetTop+m.offsetHeight/2,k:0})}t.appendChild(l),t.appendChild(v),L.style.visibility="hidden",e.strip={wrap:l,ink:v,parts:k,n:u,sn:n,pods:E,items:D}},he=()=>{const o=e.strip,a=e.track;if(!o||!a)return;const s=a.geo,n=s.ss[s.ss.length-1],u=o.sn[o.sn.length-1],l=(i,M,R)=>{let S=0,F=i.length-1;for(;F-S>1;){const _=S+F>>1;i[_]<=R?S=_:F=_}return M[S]+(M[F]-M[S])*((R-i[S])/(i[F]-i[S]))},v=i=>i<=0?i:i>=n?u+i-n:l(s.ss,o.sn,i),T=i=>i<=0?i:i>=u?n+i-u:l(o.sn,s.ss,i),m=v(e.u),E=I(),k=(i,M)=>{const[R,S,F]=Ae(s,T(m+i-e.bw/2)),_=E+e.bh-M;return[R-Math.sin(F)*_,e.H-S-Math.cos(F)*_,F]},D=(i,M,R,S)=>{i.style.transform=`translate(${M.toFixed(2)}px, ${R.toFixed(2)}px) rotate(${(-S).toFixed(4)}rad) translate(-50%, -50%)`},U=e.bw/o.n,B=[],x=[];for(let i=0;i<=o.n;i+=1)B.push(k(i*U,0)),x.push(k(i*U,e.bh));o.parts.forEach((i,M)=>{i.style.transform=P(M*U,U,e.bh,B[M],B[M+1],x[M+1],x[M])}),o.pods.forEach(i=>{const[M,R,S]=k(i.x,i.y);D(i.el,M,R,S)}),o.items.forEach(i=>{const[M,R,S]=k(i.x,i.y),[F,_,V]=k(e.bw/2,i.y),G=i.x-e.bw/2,K=F+Math.cos(V)*G,le=_-Math.sin(V)*G;D(i.el,K+(M-K)*i.k,le+(R-le)*i.k,V+(S-V)*i.k)})},ie=()=>{e.strip&&he();const o=r(),a=o.x-e.bw/2,s=e.H-o.y-e.bh/2;L.style.transform=`translate3d(${a.toFixed(2)}px, ${s.toFixed(2)}px, 0) rotate(${(-e.th).toFixed(5)}rad)`,t.style.setProperty("--fly-thrust",C($()*.9,0,1.2).toFixed(3))},Se=()=>{if(!A)return;const o=y(),a=A.querySelectorAll("path"),s=a[0],n=a[1],u=v=>v.toFixed(1),l=v=>{const T=[];for(let E=0;E<o.ss.length;E+=2){const k=o.ps[E];T.push(`${u(o.xs[E]+Math.sin(k)*v)} ${u(e.H-o.ys[E]+Math.cos(k)*v)}`)}const m=o.ps[o.ss.length-1];return T.push(`${u(o.xs[o.ss.length-1]+Math.sin(m)*v)} ${u(e.H-o.ys[o.ss.length-1]+Math.cos(m)*v)}`),`M ${T.join(" L ")}`};A.setAttribute("viewBox",`0 0 ${u(e.W)} ${u(e.H)}`),A.style.visibility=o.ok?"":"hidden",s&&(s.setAttribute("d",l(o.T/2)),s.setAttribute("stroke-width",u(o.T))),n&&n.setAttribute("d",l(.75))},ze=o=>{const a=new Float32Array(J*4),s=new Float32Array(J*4),n=[0,0,0,0],u=o.length,l=Fe,v=X();return o.forEach((T,m)=>{const E=C(e.thrust[m]*u,0,2),k=T.dy<-.2?T.y/-T.dy:l.forceMax;a.set([T.x,T.y,T.dx,T.dy],m*4),s.set([l.speed*Math.sqrt(E),l.radius*v,Math.min(l.forceMax,k*l.reach),E>.004?E:0],m*4);const D=e.fvx*-T.dy+e.fvy*T.dx;n[m]=C(-D*.22,-.55*k,.55*k)}),{a,b:s,bend:n}},ye=o=>{if(!z)return;const a=g.current,s=h(),n=ze(s),u=r(),l=Z(),v=X(),T=[u.x,u.y,e.bw/2,e.bh/2],m=[e.vx,e.vy,e.th,e.w],E=(1-me((Math.abs(e.fvx)-40)/100))*(1-me((Math.abs(e.th)-.1)/.2))*(ge()?0:1);o>0&&(e.simTime+=o,z.step(o,{jets:n,craft:T,motion:m,calm:E,scale:v,activity:e.activity,jetX:[0,1,2,3].map(D=>D<l.length?l[D]:0),jetN:l.length,spacing:l.length>1?l[1]-l[0]:0,wind:e.wind*Fe.wind,time:e.simTime,smoke:C(ne(a.smoke,1),0,3),turbulence:C(ne(a.turbulence,1),0,3)}));const k=it(a.smokeColor);z.render(p.width,p.height,{jets:n,craft:T,motion:m,scale:v,activity:e.activity,time:e.simTime,light:a.theme==="light",smokeColor:k,shadeColor:k.map((D,U)=>D*.74+[0,.012,.045][U]),thrustColor:it(a.thrustColor)})},be=()=>{const o=t.getBoundingClientRect(),a=e.W;if(e.W=Math.max(1,o.width),e.H=Math.max(1,o.height),e.bw=L.offsetWidth,e.bh=L.offsetHeight,e.placed?a>0&&a!==e.W&&(e.x*=e.W/a):(e.x=d(),e.placed=!0),!ge()){const[u,l]=re();e.x=C(e.x,u,l)}e.dpr=Math.min(window.devicePixelRatio||1,2);const s=Math.round(e.W*e.dpr),n=Math.round(e.H*e.dpr);(p.width!==s||p.height!==n)&&(p.width=s,p.height=n),z&&z.resize(e.W,e.H),Se(),t.dataset.ready="",ie(),e.running||ye(0)},Ue=(o,a,s=0)=>{const n=b(),u=e.th,l=o-n.x,v=a-n.y,T=l*Math.cos(u)-v*Math.sin(u),m=l*Math.sin(u)+v*Math.cos(u);return Math.abs(T)<=e.bw/2+2+s&&m>=-e.bh/2-2-s&&m<=e.bh/2+I()+s},se=()=>{e.pt=0,e.armed=!1,e.seed=Math.random()*100,e.wind=Math.random()<.5?-1-Math.random():1+Math.random(),e.vrPrev=0,e.quiet=0,e.boost=!1},de=()=>{if(e.phase!=="rest"||f())return!1;const o=g.current;se(),e.phase="ignite",e.delay=e.delay.map(()=>Math.random()*.07);const a=e.H-e.bh-I()-30-Y;return e.alt=C(e.y+ne(o.altitude,170),e.y+24,Math.max(e.y+24,a)),e.climbT=1.15+(e.alt-e.y)/420,e.hold=Math.max(0,ne(o.hoverTime,2.4)),e.xRef=e.x,We(),!0},Ae=(o,a)=>{if(a<=0)return[o.x0+a,0,0,0];let s=0,n=o.ss.length-1;if(a>=o.ss[n]){const l=o.ps[n];return[o.xs[n]+Math.cos(l)*(a-o.ss[n]),o.ys[n]+Math.sin(l)*(a-o.ss[n]),l,0]}for(;n-s>1;){const l=s+n>>1;o.ss[l]<=a?s=l:n=l}const u=(a-o.ss[s])/(o.ss[n]-o.ss[s]);return[o.xs,o.ys,o.ps,o.ks].map(l=>l[s]+(l[n]-l[s])*u)},te=(o,a)=>{const[s,n,u,l]=Ae(o.geo,a);return{x:s-Math.sin(u)*o.base,cy:n+Math.cos(u)*o.base,th:u,bend:l*o.base}},_e=()=>{if(e.phase!=="rest"||f()||!ee())return!1;const o=y(),a=o.x0-e.x;if(a<60||!o.ok)return de();se();const s=I()+e.bh/2,n=Math.max(...o.ys)-2*s,u=Math.sqrt(2*Xe*n+2.2*Xe*(o.r-s));return e.track={geo:o,base:s,v0:u,acc:u*u/(2*a)},e.phase="drive",e.u=-a,e.v=0,e.thrust=[0,0,0,0],O(),We(),!0},Ye=o=>{const[a,s]=re();let n=e.x+o;ee()&&(n=Math.min(n,y().clear-e.bw/2)),e.landX=C(n,a,s)},ft=o=>{const a=g.current,s=C(ne(a.wobble,1),0,3);if(e.pt+=o,e.clock+=o,e.phase==="return"){const c=e.back,w=Math.min(e.pt/c.time,1);e.x=c.from+(c.to-c.from)*nt(w),e.vx=(c.to-c.from)*ct(w)/c.time,e.y=-Y,e.vy=0,e.th=0,e.w=0,w>=1&&(e.phase="rest",e.pt=0,e.vx=0);return}if(e.phase==="drive"||e.phase==="loop"){const c=e.track,w=te(c,e.u);e.phase==="drive"?e.v=Math.min(c.v0,e.v+c.acc*o):e.v=Math.sqrt(Math.max(c.v0*c.v0-2*Xe*(w.cy-c.base),.2*c.v0*c.v0)),e.u+=e.v*o/Math.max(1-w.bend,.25),e.phase==="drive"&&e.u>=0&&(e.phase="loop");const N=te(c,e.u);e.vx=(N.x-w.x)/o,e.vy=(N.cy-w.cy)/o,e.w=(N.th-w.th)/o,e.x=N.x,e.y=N.cy-I()-e.bh/2-Y,e.th=N.th,e.thrust=e.thrust.map(oe=>oe*Math.exp(-o/.1)),e.phase==="loop"&&e.u>=c.geo.S&&(j(),e.phase="flip",e.pt=0,e.flip={th:e.th,w:e.w});return}const n=(e.bw*e.bw+e.bh*e.bh)/12,u=Math.max(Math.cos(e.th),.5);let l=0,v=!1,T=e.xRef,m=3,E=3.6,k=null;if(e.phase==="flip"){const c=Math.min(e.pt/Ge,1),w=e.flip,N=Math.PI*2;k={th:(2*c*c*c-3*c*c+1)*w.th+(c*c*c-2*c*c+c)*Ge*w.w+(3*c*c-2*c*c*c)*N,w:(6*c*c-6*c)*(w.th-N)/Ge+(3*c*c-4*c+1)*w.w},l=2.4*me((Math.cos(k.th)-.8)/.15);const oe=e.y+Y<e.bh*.6;(c>=1||oe)&&(k=null,e.th-=Math.PI*2*Math.round(e.th/(Math.PI*2)),e.phase="descend",e.pt=0,e.boost=!0,e.vrPrev=e.vy,Ye(e.vx*Math.abs(e.vx)/700))}if(e.phase==="ignite"&&(l=.9*me(e.pt/.5),e.pt>=.5&&(e.phase="climb",e.pt=0,e.y0=e.y)),e.phase==="climb"){const c=e.pt/e.climbT,w=e.alt-e.y0,N=e.y0+w*nt(c),oe=w*ct(c)/e.climbT,ke=w*wt(c)/(e.climbT*e.climbT);l=(q+ke+30*(N-e.y)+8*(oe-e.vy))/(q*u),v=!0,c>=1&&(e.phase="hover",e.pt=0)}else if(e.phase==="hover"){const c=e.clock*.8,w=e.alt+3.5*s*Pe(c,e.seed),N=3.5*s*.8*kt(c,e.seed);l=(q+30*(w-e.y)+8*(N-e.vy))/(q*u),v=!0,e.pt>=e.hold&&(e.phase="descend",e.pt=0,e.vrPrev=0,Ye(0))}else if(e.phase==="drag"){const c=e.target.y-I()-e.bh/2-Y;l=(q+34*(c-e.y)-10*e.vy)/(q*u),v=!0}else if(e.phase==="descend"){T=e.landX,m=e.boost?5:4,E=e.boost?4.6:4.2;const c=170,w=32,N=e.boost?me((Math.abs(e.landX-e.x)-20)/40):me((Math.abs(e.landX-e.x)-3)/23),oe=Math.max(e.y+Y,0),ke=(w+(c-w)*(1-Math.exp(-oe/52)))*(1-(e.boost?.45:.88)*N),Je=e.boost?c*3:c*me(e.pt/.9)+1,De=-Math.min(ke,Je),$e=C((De-e.vrPrev)/Math.max(o,1e-4),-600,600);e.vrPrev=De,l=(q+$e+(e.boost?9:7)*(De-e.vy))/(q*u),v=!0,e.contact&&e.pt>.3&&(e.phase="landed",e.pt=0,e.boost=!1)}else if(e.phase==="landed"&&(l=0,e.pt>.6&&$()<.03)){const c=ee()&&e.track?d():e.x;e.phase=Math.abs(c-e.x)>6?"return":"rest",e.pt=0,e.thrust=[0,0,0,0],e.vy=0,e.w=0,e.vx=0,e.track=null,e.back={from:e.x,to:c,time:C(Math.abs(c-e.x)/200,.7,1.8)}}l=Number.isFinite(l)?C(l,0,e.boost||e.phase==="flip"?2.6:1.9):1;const D=Z(),U=D.length,B=D.reduce((c,w)=>c+w*w,0),x=e.phase==="drag"?C(100*(e.target.x-e.x)-17*e.vx,-2400,2400):0;let i=0;if(v){const c=.8*s*Pe(e.clock*1.7,e.seed+3),w=e.phase==="drag"?x*.75:m*(T-e.x)-E*e.vx,N=e.boost?.45:.32,oe=C(-Math.atan2(w,q),-N,N);i=-81*(e.th-oe)-14*e.w-c}const M=(e.boost||e.phase==="flip"?2.6:2.4)/U,R=(c,w)=>c+(w-c)*(1-Math.exp(-o/(w>c?.08:.17))),S=B>1?i*n/(q*B):0,F=Math.abs(S)*Math.max(0,...D.map(Math.abs)),_=Math.min(l/U,Math.max(M-F,M*.5));let V=0;for(let c=0;c<J;c+=1){let w=0;c<U&&(w=C(_+S*D[c],0,M),e.phase==="ignite"&&e.pt<e.delay[c]&&(w=0)),e.thrust[c]=R(e.thrust[c],w),c<U&&(V+=e.thrust[c]*D[c])}const G=$()*q;let K=e.phase==="drag"?x:-G*Math.sin(e.th)-.8*e.vx,le=G*Math.cos(e.th)-q-.3*e.vy,ue=e.phase==="flip"?0:V*q/n-1.2*e.w;v&&(e.phase!=="drag"&&(K+=12*s*Pe(e.clock*.7,e.seed+7)),ue+=.9*s*Pe(e.clock*2.3,e.seed+11),B<1&&(ue+=i),Math.abs(e.th)>.35&&(ue-=(e.th-Math.sign(e.th)*.35)*160));const we=r(),Ce=Math.cos(e.th),pe=Math.sin(e.th),fe=-(e.bh/2+I());let ve=!1;e.phase!=="flip"&&Me().forEach(c=>{const w=c*Ce-fe*pe,N=c*pe+fe*Ce,oe=we.y+N,ke=Y-oe;if(ke>0){ve=!0;const Je=e.vy+e.w*w,De=e.vx-e.w*N,$e=Math.max(0,lt*ke-yt*Je),st=-10*De;le+=$e,K+=st,ue+=(w*$e-N*st)/n}}),e.contact=ve,e.vx=C(e.vx+K*o,-1500,1500),e.vy=C(e.vy+le*o,-1500,1500),e.w=C(e.w+ue*o,-14,14),e.x+=e.vx*o,e.y+=e.vy*o,e.th+=e.w*o,k&&(e.th=k.th,e.w=k.w),e.phase!=="flip"&&Math.abs(e.th)>rt&&(e.th=Math.sign(e.th)*rt,e.w*e.th>0&&(e.w=0));const[Ee,Le]=re();(e.x<Ee||e.x>Le)&&(e.x=C(e.x,Ee,Le),e.vx=0),e.y+Y<-40&&(e.y=-Y,e.vy=0),Number.isFinite(e.y+e.x+e.th+e.vy+e.vx+e.w+$())||(Object.assign(e,{x:e.W/2,vx:0,y:-Y,vy:0,th:0,w:0,thrust:[0,0,0,0],phase:"rest"}),e.drag=null)},Ie=o=>{const a=g.current,s=e.pointer,n=b();if(e.attached&&!e.drag&&e.lastC){const m=s.x+e.off.x,E=s.y+e.off.y,k=-(e.th-e.lastTh),D=m-e.lastC.x,U=E-e.lastC.y,B=n.x+D*Math.cos(k)-U*Math.sin(k),x=n.y+D*Math.sin(k)+U*Math.cos(k);e.off.x+=B-m,e.off.y+=x-E}e.lastC=n,e.lastTh=e.th;const u=s.x+e.off.x,l=s.y+e.off.y,v=s.in&&Ue(u,l,e.attached||e.drag?10:0);if(v!==e.hover&&(e.hover=v,v?L.dataset.hover="":delete L.dataset.hover),!v&&!e.drag&&(e.attached=!1,e.phase==="rest"&&(e.armed=!0)),v&&e.armed&&e.phase==="rest"&&s.type==="mouse"&&a.trigger!=="click"&&!ee()&&de()&&(e.attached=!!a.carryCursor),e.phase==="rest"&&Math.abs(e.off.x)+Math.abs(e.off.y)<12){const m=Math.exp(-o*6);e.off.x*=m,e.off.y*=m}Math.abs(e.off.x)+Math.abs(e.off.y)<.3&&(!e.attached||e.phase==="rest")&&(e.off.x=0,e.off.y=0,e.phase==="rest"&&(e.attached=!1));const T=!!a.carryCursor&&s.in&&s.type==="mouse"&&(e.attached||!!e.drag||e.off.x!==0||e.off.y!==0);T!==e.carry&&(e.carry=T,T?t.dataset.carry="":delete t.dataset.carry),T&&W&&(W.style.transform=`translate3d(${(u-1.8).toFixed(2)}px, ${(l-1.75).toFixed(2)}px, 0)`)},Qe=o=>{e.raf=0;const a=e.last?C((o-e.last)/1e3,0,1/30):1/60;if(e.last=o,a>0){if(e.phase!=="rest")for(let v=0;v<6;v+=1)ft(a/6);const s=1-Math.exp(-a/.12);e.fvx+=(e.vx-e.fvx)*s,e.fvy+=(e.vy-e.fvy)*s,Ie(a),ie(),ye(a);const n=$();e.quiet=n>.01||e.phase!=="rest"?0:e.quiet+a;const u=n>.05?1:0;e.activity+=(u-e.activity)*(1-Math.exp(-a/(u?.25:1.6)))}e.phase!=="rest"||e.quiet<7||e.carry?e.raf=requestAnimationFrame(Qe):(e.running=!1,e.last=0,z&&z.clear(),ye(0))},We=()=>{e.raf||(e.running=!0,e.raf=requestAnimationFrame(Qe))},Ze=o=>{const a=t.getBoundingClientRect();return{x:o.clientX-a.left,y:o.clientY-a.top}},Ve=()=>{const o=e.pointer,a=o.type==="mouse";return{x:o.x+(a?e.off.x:0),y:o.y+(a?e.off.y:0)}},et=()=>{if(!e.drag)return;const o=Ve(),[a,s]=re(),n=I()+e.bh/2;e.target.x=C(o.x-e.drag.gx,a,s),e.target.y=C(e.H-(o.y-e.drag.gy),n,Math.max(n,e.H-e.bh/2-6))},ht=o=>{const a=Ve(),s=b();e.drag={gx:a.x-s.x,gy:a.y-s.y},e.phase="drag",e.pt=0,e.attached=!1,e.pressed=!1,e.suppress=!0,e.boost=!1,delete L.dataset.pressed,t.dataset.dragging="";try{t.setPointerCapture(o.pointerId)}catch{}et()},dt=o=>{e.drag=null,e.press=null,delete t.dataset.dragging;try{t.releasePointerCapture(o.pointerId)}catch{}e.phase="hover",e.pt=0,e.alt=e.y;const[a,s]=re();e.xRef=C(e.x+e.vx*.3,a,s),e.hold=Math.min(Math.max(0,ne(g.current.hoverTime,2.4)),.9)},je=o=>{const a=Ze(o),s=e.pointer;if(s.in&&!e.attached&&!e.drag&&(e.off.x||e.off.y)){const n=Math.exp(-Math.hypot(a.x-s.x,a.y-s.y)/110);e.off.x*=n,e.off.y*=n}s.x=a.x,s.y=a.y,s.in=!0,s.type=o.pointerType||"mouse",e.press&&!e.drag&&Re()&&Math.hypot(a.x-e.press.x,a.y-e.press.y)>4&&ht(o),e.drag&&et(),Ie(0),(e.carry||e.phase!=="rest")&&We()},tt=()=>{e.drag||(e.pointer.in=!1,e.attached=!1,e.off.x=0,e.off.y=0,Ie(0))},ot=o=>{const a=Ze(o),s=e.pointer;s.x=a.x,s.y=a.y,s.in=!0,s.type=o.pointerType||"mouse",e.suppress=!1;const n=Ve();Ue(n.x,n.y,e.attached?10:0)&&(s.type!=="mouse"&&e.phase==="rest"&&g.current.trigger!=="click"&&!ee()&&de(),e.press={x:a.x,y:a.y},e.carry&&s.type==="mouse"&&(e.pressed=!0,L.dataset.pressed=""))},Ne=o=>{if(e.drag){dt(o);return}e.press=null,e.pressed&&(e.pressed=!1,delete L.dataset.pressed,e.carry&&e.hover&&(e.phase==="rest"&&ee()?_e():g.current.trigger==="click"&&de()&&(e.attached=!!g.current.carryCursor),g.current.onClick&&g.current.onClick(o)))},at=o=>{if(e.suppress){e.suppress=!1,o.stopPropagation(),o.preventDefault();return}if(e.phase==="rest"){if(ee()){_e();return}de()&&e.pointer.type==="mouse"&&e.pointer.in&&e.hover&&(e.attached=!!g.current.carryCursor)}};t.addEventListener("pointermove",je),t.addEventListener("pointerenter",je),t.addEventListener("pointerleave",tt),t.addEventListener("pointerdown",ot),t.addEventListener("pointerup",Ne),t.addEventListener("pointercancel",Ne),L.addEventListener("click",at);const qe=new ResizeObserver(be);return qe.observe(t),qe.observe(L),be(),{refresh:be,rehome(){be(),e.phase==="rest"&&(e.x=d(),ie(),e.running||ye(0))},destroy(){qe.disconnect(),j(),e.raf&&cancelAnimationFrame(e.raf),t.removeEventListener("pointermove",je),t.removeEventListener("pointerenter",je),t.removeEventListener("pointerleave",tt),t.removeEventListener("pointerdown",ot),t.removeEventListener("pointerup",Ne),t.removeEventListener("pointercancel",Ne),L.removeEventListener("click",at),z&&z.dispose()}}}function Nt(t){const p=(y,d)=>{const r=t.createShader(y);if(t.shaderSource(r,d),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS)){const h=t.getShaderInfoLog(r);throw t.deleteShader(r),new Error(h)}return r},L=p(t.VERTEX_SHADER,Tt),W=[],A=y=>{const d=p(t.FRAGMENT_SHADER,y),r=t.createProgram();if(t.attachShader(r,L),t.attachShader(r,d),t.linkProgram(r),!t.getProgramParameter(r,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(r));t.deleteShader(d);const h={},b=t.getProgramParameter(r,t.ACTIVE_UNIFORMS);for(let j=0;j<b;j+=1){const O=t.getActiveUniform(r,j);h[O.name.replace(/\[0\]$/,"")]=t.getUniformLocation(r,O.name)}const P={p:r,u:h};return W.push(P),P},g={advect:A(Mt),force:A(gt),curl:A(Ct),vorticity:A(Et),divergence:A(Lt),pressure:A(Dt),gradient:A(Rt),scale:A(Ut),blur:A(St),dye:A(At),render:A(_t)},H=t.createVertexArray(),ce=[],e=(y,d,r,h)=>{const b=t.createTexture();t.bindTexture(t.TEXTURE_2D,b);const P=h?Math.floor(Math.log2(Math.max(y,d)))+1:1;t.texStorage2D(t.TEXTURE_2D,P,r,y,d),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,h?t.LINEAR_MIPMAP_LINEAR:t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);const j=t.createFramebuffer();t.bindFramebuffer(t.FRAMEBUFFER,j),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,b,0),t.viewport(0,0,y,d),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT);const O={tex:b,fbo:j,w:y,h:d,mips:h};return ce.push(O),O},z=(y,d,r,h)=>{const b={read:e(y,d,r,h),write:e(y,d,r,h)};return b.swap=()=>{const P=b.read;b.read=b.write,b.write=P},b};let f=null,X=[1,1];const I=()=>{ce.forEach(y=>{t.deleteTexture(y.tex),t.deleteFramebuffer(y.fbo)}),ce.length=0},Te=(y,d)=>{const r=Math.max(2,y/520,d/300),h=Math.max(16,Math.round(y/r)),b=Math.max(16,Math.round(d/r)),P=Math.max(16,Math.round(y/(r/2))),j=Math.max(16,Math.round(d/(r/2)));X=[y,d],!(f&&f.vw===h&&f.vh===b&&f.dw===P&&f.dh===j)&&(I(),f={vw:h,vh:b,dw:P,dh:j,velocity:z(h,b,t.RG16F,!1),pressure:z(h,b,t.R16F,!1),divergence:e(h,b,t.R16F,!1),curl:e(h,b,t.R16F,!1),dye:z(P,j,t.RG16F,!1),soft:e(P,j,t.RG16F,!0),temp:e(P,j,t.RG16F,!1)})};let Z=0;const Me=(y,d)=>{t.useProgram(y.p),Z=0,Object.entries(d).forEach(([r,h])=>{const b=y.u[r];b!=null&&(typeof h=="number"?t.uniform1f(b,h):h.f1?t.uniform1fv(b,h.f1):h.tex?(t.activeTexture(t.TEXTURE0+Z),t.bindTexture(t.TEXTURE_2D,h.tex),t.uniform1i(b,Z),Z+=1):h.length===2?t.uniform2fv(b,h):h.length===3?t.uniform3fv(b,h):t.uniform4fv(b,h))})},$=(y,d,r)=>{Me(y,d),r&&(t.bindFramebuffer(t.FRAMEBUFFER,r.fbo),t.viewport(0,0,r.w,r.h)),t.bindVertexArray(H),t.drawArrays(t.TRIANGLES,0,3)};return{step:(y,d)=>{if(!f)return;const r=Fe;t.disable(t.BLEND);const h=[1/f.vw,1/f.vh];$(g.advect,{uVelocity:f.velocity.read,uSource:f.velocity.read,uWorld:X,uDt:y,uKeep:1},f.velocity.write),f.velocity.swap(),$(g.force,{uVelocity:f.velocity.read,uDye:f.soft,uWorld:X,uDt:y,uBuoyancy:r.buoy,uLift:r.lift,uDamping:r.damp,uSpread:r.spread,uSplash:r.splash,uFriction:r.friction,uWind:d.wind,uTurb:[r.turb*(.35+.65*d.activity),r.turbScale],uTime:d.time,uObstacle:d.calm,uKick:[r.kickNear*d.scale,r.kickW*d.scale,r.kickH*d.scale],uCraft:d.craft,uCraftMotion:d.motion,uJetA:d.jets.a,uJetB:d.jets.b,uJetBend:{f1:d.jets.bend}},f.velocity.write),f.velocity.swap(),$(g.curl,{uVelocity:f.velocity.read,uTexel:h},f.curl),$(g.vorticity,{uVelocity:f.velocity.read,uCurl:f.curl,uTexel:h,uStrength:r.vort*d.turbulence*(.4+.6*d.activity),uDt:y},f.velocity.write),f.velocity.swap(),$(g.divergence,{uVelocity:f.velocity.read,uTexel:h},f.divergence),$(g.scale,{uSource:f.pressure.read,uScale:.8},f.pressure.write),f.pressure.swap();for(let P=0;P<r.iters;P+=1)$(g.pressure,{uPressure:f.pressure.read,uDivergence:f.divergence,uTexel:h},f.pressure.write),f.pressure.swap();$(g.gradient,{uPressure:f.pressure.read,uVelocity:f.velocity.read,uTexel:h},f.velocity.write),f.velocity.swap(),$(g.dye,{uVelocity:f.velocity.read,uSource:f.dye.read,uWorld:X,uDt:y,uKeep:[Math.exp(-(r.keepD+r.keepIdle*(1-d.activity))*y),Math.exp(-1.6*y)],uRate:[r.rateN*d.smoke,r.rateH,r.rateK*d.smoke,r.rateC*d.smoke],uSpread:r.spread,uCol:[r.colSpread,r.colR*d.scale,r.colD,r.colU],uKick:[r.kickNear*d.scale,r.kickW*d.scale,r.kickH*d.scale],uDisperse:r.disperse,uDispV:r.dispV,uCraft:d.craft,uCraftMotion:d.motion,uGap:[d.spacing,r.gap*d.calm],uJetX:{f1:d.jetX},uJetN:d.jetN,uFloor:r.floor,uTime:d.time,uJetA:d.jets.a,uJetB:d.jets.b,uJetBend:{f1:d.jets.bend}},f.dye.write),f.dye.swap();const b=r.blur/2;$(g.blur,{uSource:f.dye.read,uStep:[b/f.dw,0]},f.temp),$(g.blur,{uSource:f.temp,uStep:[0,b/f.dh]},f.soft),t.bindTexture(t.TEXTURE_2D,f.soft.tex),t.generateMipmap(t.TEXTURE_2D)},render:(y,d,r)=>{if(!f)return;const h=Fe;t.bindFramebuffer(t.FRAMEBUFFER,null),t.viewport(0,0,y,d),t.disable(t.BLEND),$(g.render,{uDye:f.soft,uWorld:X,uDyeSize:[f.dw,f.dh],uTime:r.time,uLightTheme:r.light?1:0,uSmoke:r.smokeColor,uShade:r.shadeColor,uThrust:r.thrustColor,uLook:[h.alphaK*(.6+.4*r.activity),h.relief,h.shadow,h.alphaLod],uLook2:[h.ambient,h.key,h.wrap,h.ao],uLook3:[h.normalE,h.normalLod,h.fine,h.broad],uCol:[h.colSpread,h.colR*r.scale,h.colD,h.colU],uScale:r.scale,uGamma:h.gamma,uTone:h.tone,uLight2:[h.jetLight,h.emit,h.exposure],uThreshold:h.threshold*(.3+.7*r.activity),uCraft:r.craft,uCraftMotion:r.motion,uJetA:r.jets.a,uJetB:r.jets.b,uJetBend:{f1:r.jets.bend}})},resize:Te,clear:()=>{f&&([f.velocity.read,f.velocity.write,f.pressure.read,f.pressure.write,f.dye.read,f.dye.write,f.soft,f.temp].forEach(y=>{t.bindFramebuffer(t.FRAMEBUFFER,y.fbo),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT)}),t.bindTexture(t.TEXTURE_2D,f.soft.tex),t.generateMipmap(t.TEXTURE_2D))},dispose:()=>{I(),W.forEach(y=>t.deleteProgram(y.p)),t.deleteShader(L),t.deleteVertexArray(H)}}}function $t({children:t="Take off",onClick:p,theme:L="dark",size:W="medium",radius:A,altitude:g=170,hoverTime:H=2.4,jets:ce=2,thrusters:e=!0,trigger:z="hover",carryCursor:f=!0,ramp:X=!1,rampColor:I,smoke:Te=1,turbulence:Z=1,wobble:Me=1,thrustColor:$,smokeColor:Re,buttonColor:ge,textColor:re,className:ee="",style:y}){const d=xe(null),r=xe(null),h=xe(null),b=xe(null),P=xe(null),j=xe(null),O=xe({}),he=L==="light",ie=Be[W]||Be.medium,Se=$||(he?"#4f8cff":"#8ec5ff"),ze=Re||(he?"#e9ebf0":"#eef1f6"),ye=ge||(he?"#18181b":"#27272a"),be=re||(he?"#fafafa":"#f5f5f5"),Ue=I||(he?"#ececf0":"#25222b"),se=C(Math.round(ne(ce,2)),1,J),de=se===1?0:se===2?.3:.34,Ae=e?Array.from({length:se},(te,_e)=>se===1?50:50+de*100*(2*_e/(se-1)-1)):[];return O.current={size:W,altitude:g,hoverTime:H,jets:se,thrusters:!!e,trigger:z,carryCursor:f,ramp:!!X,smoke:Te,turbulence:Z,wobble:Me,thrustColor:Se,smokeColor:ze,theme:L,onClick:p},He(()=>{const te=jt({root:d.current,canvas:r.current,button:h.current,cursor:b.current,ramp:P.current,props:O});return j.current=te,()=>{j.current=null,te.destroy()}},[]),He(()=>{j.current&&j.current.refresh()},[W,se,e,A]),He(()=>{j.current&&j.current.rehome()},[X]),Q("div",{ref:d,className:`flying-button ${ee}`.trim(),"data-theme":L,"data-trigger":X?"click":z,style:{"--fly-bg":ye,"--fly-ink":be,"--fly-glow":Se,"--fly-ramp":Ue,"--fly-h":`${ie.h}px`,"--fly-px":`${ie.px}px`,"--fly-fs":`${ie.fs}px`,"--fly-scale":ie.k,...A!=null?{"--fly-radius":`${ne(A,0)}px`}:{},...y},children:[Q("svg",{ref:P,className:"flying-button__ramp",style:X?void 0:{display:"none"},"aria-hidden":"true",children:[Q("path",{className:"flying-button__ramp-body"}),Q("path",{className:"flying-button__ramp-edge"})]}),Q("canvas",{ref:r,className:"flying-button__smoke","aria-hidden":"true"}),Q("button",{ref:h,type:"button",className:"flying-button__craft",onClick:te=>O.current.onClick&&O.current.onClick(te),children:[Q("span",{className:"flying-button__face","aria-hidden":"true"}),Q("span",{className:"flying-button__label",children:t}),Ae.map(te=>Q("span",{className:"flying-button__pod",style:{left:`${te}%`},"aria-hidden":"true"},te))]}),Q("svg",{ref:b,className:"flying-button__cursor",viewBox:"0 0 24 34","aria-hidden":"true",children:Q("path",{d:"M2.2 2.1v24.6l6.1-5.9 4.1 9.6 4.4-1.9-4.1-9.4h8.6z",fill:"#0a0a0c",stroke:"#fff",strokeWidth:"1.9",strokeLinejoin:"round"})})]})}function zt({host:t}){const p=vt(),L=t.getAttribute("data-label")||"Ask my AI assistant";return pt(()=>{const W=()=>{const H=t.querySelector(".flying-button__craft");H&&H.offsetWidth&&(t.style.width=H.offsetWidth+"px")};W();const A=new ResizeObserver(W),g=t.querySelector(".flying-button__craft");return g&&A.observe(g),()=>A.disconnect()},[t]),Q($t,{onClick:()=>xt(),theme:p.dark?"dark":"light",size:"large",buttonColor:p.actionBg,textColor:p.actionInk,thrustColor:p.hl,carryCursor:!1,altitude:110,children:L})}export{zt as default};
