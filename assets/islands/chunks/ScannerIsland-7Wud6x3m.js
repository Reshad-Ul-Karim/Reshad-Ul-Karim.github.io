import{A as N,h as re}from"./compat.module-DdK5-UJK.js";import{u as B,a as Te,b as De}from"./env-C2-whvUy.js";import{m as ae}from"../islands.js";const Ne=o=>{try{const i=o.getExtension("WEBGL_debug_renderer_info");return/swiftshader|llvmpipe|softpipe|software/i.test(String(o.getParameter(i?i.UNMASKED_RENDERER_WEBGL:o.RENDERER)))}catch{return!1}},M=6,ke=2,We={vertical:0,horizontal:1,diagonal:2},Oe=`#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,Ge=`#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uWave;
uniform float uSweep;
uniform float uSweepWidth;
uniform float uTrail;
uniform float uScale;
uniform float uFrequency;
uniform float uRipple;
uniform float uDensity;
uniform float uLineWidth;
uniform float uGlow;
uniform float uDirection;
uniform float uSpread;
uniform float uBrightness;
uniform float uVignette;
uniform float uOpacity;
uniform float uScanline;
uniform float uRatio;
uniform float uGrain;
uniform float uTime;
uniform vec2 uMouse;
uniform float uPresence;
uniform float uMouseRadius;
uniform float uMouseStrength;
uniform float uAttract;
uniform vec3 uPings[${M}];
uniform float uIntro;
uniform float uLightMode;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float signal(vec2 p, float t) {
  float w = sin(p.x * 1.3 + t * 0.7);
  w += sin(p.y * 1.7 - t * 0.52) * 0.8;
  w += sin((p.x + p.y) * 0.9 + t * 0.91) * 0.6;
  w += sin((p.x - p.y) * 1.53 - t * 0.63) * 0.42;
  return w * 0.35;
}

float smoother(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

vec2 axes(vec2 p) {
  if (uDirection < 0.5) return vec2(p.y, p.x);
  if (uDirection < 1.5) return vec2(p.x, -p.y);
  return vec2((p.x + p.y) * 0.70710678, (p.x - p.y) * 0.70710678);
}

float coverage(float lc, float width) {
  float fw = max(fwidth(lc), 1e-5);
  float dist = abs(fract(lc + 0.5) - 0.5) / fw;
  float crowd = smoothstep(0.2, 0.55, fw);
  float cover = clamp(width * 0.5 + 0.5 - dist, 0.0, 1.0) * min(width, 1.0);
  return mix(cover, min(width * fw, 1.0), crowd);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;
  vec2 p = uv / max(uScale, 0.001);
  vec2 ax = axes(p);

  float sig = signal(p * uFrequency, uWave);
  float coord = ax.x + sig * uRipple;

  vec2 mp = uMouse / max(uScale, 0.001);
  vec2 md = p - mp;
  float radius = max(uMouseRadius / max(uScale, 0.001), 0.01);
  float lens = exp(-dot(md, md) / (radius * radius)) * uPresence;
  float mouseAxis = axes(mp).x + signal(mp * uFrequency, uWave) * uRipple;
  coord -= (coord - mouseAxis) * lens * uMouseStrength * mix(0.55, -0.9, uAttract);

  float pingLight = 0.0;
  for (int i = 0; i < ${M}; i++) {
    vec3 ping = uPings[i];
    if (ping.z < 0.0) continue;
    float d = length(uv - ping.xy);
    float age = ping.z;
    float r = age * 1.1;
    float w = 0.12 + age * 0.1;
    float band = exp(-((d - r) * (d - r)) / (w * w));
    float fade = exp(-age * 0.9) * smoothstep(0.0, 0.12, age);
    coord += band * fade * 0.018 / max(uScale, 0.001);
    pingLight += band * fade;
  }

  float u = fract(uSweep - coord / max(uSweepWidth, 0.05));
  float tail = mix(11.0, 1.8, clamp(uTrail, 0.0, 1.0));
  float lead = smoothstep(0.84, 1.0, u);
  lead *= lead;
  float sweep = max(exp(-u * tail), lead);
  float head = max(exp(-u * 26.0), lead * lead * lead);

  float introFront = mix(-1.6, 1.6, smoother(uIntro)) / max(uScale, 0.001);
  float reveal = 1.0 - smoothstep(introFront - 0.05, introFront + 0.3, coord);
  float introHead = exp(-abs(coord - introFront) * 14.0) * (1.0 - uIntro) * step(0.0001, 1.0 - uIntro);
  reveal = mix(reveal, 1.0, step(0.9999, uIntro));

  float lit = clamp(sweep * 0.86 + lens * uMouseStrength * 0.7 + pingLight * 0.9 + introHead, 0.0, 1.6);
  float hot = clamp(head + introHead + pingLight * 0.35, 0.0, 1.0);

  float lc = coord * uDensity;
  float width = uLineWidth * (1.0 + lit * 1.4 + hot * 0.9);
  float thread = 0.62 + 0.38 * hash(vec2(floor(lc + 0.5), 3.7));
  float split = uSpread * (0.5 + lit * 1.3) * max(fwidth(lc), 1e-5);
  float cg = coverage(lc, width);
  float cr = coverage(lc + split, width);
  float cb = coverage(lc - split, width);

  float fw = max(fwidth(lc), 1e-5);
  float dist = abs(fract(lc + 0.5) - 0.5) / fw;
  float crowd = smoothstep(0.2, 0.55, fw);
  float halo = exp(-dist / (3.0 + uGlow * 9.0)) * (1.0 - crowd) * uGlow * lit * 1.15;

  float base = 0.11 * reveal;
  float level = (base + lit * (1.0 - base)) * thread * uBrightness;

  vec3 tone = mix(uColor1, uColor2, smoothstep(0.05, 0.75, lit));
  tone = mix(tone, uColor3, hot);
  vec3 haloTone = mix(uColor1, uColor2, 0.65);

  float vx = smoother((1.0 - abs(uv.x / (uResolution.x / uResolution.y))) / 0.6);
  float vy = smoother((1.0 - abs(uv.y)) / 0.6);
  float vignette = mix(1.0, vx * vy, uVignette);

  vec3 cover3 = vec3(cr, cg, cb);
  float alphaLine = max(max(cr, cg), cb) * level;
  vec3 colLine = tone * cover3 * level;

  float grain = (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * uGrain;
  float scan = 1.0 - uScanline * 0.55 * (0.5 + 0.5 * cos(gl_FragCoord.y * 6.2831853 / (3.0 * uRatio)));

  if (uLightMode > 0.5) {
    float ink = clamp(alphaLine * vignette * scan, 0.0, 1.0);
    float wash = clamp(halo * 0.28 * vignette, 0.0, 1.0);
    float alpha = clamp(ink + wash * (1.0 - ink) + grain * 0.5 * ink, 0.0, 1.0) * uOpacity;
    vec3 col = (tone * ink + haloTone * wash * (1.0 - ink)) / max(ink + wash * (1.0 - ink), 1e-4);
    fragColor = vec4(col * alpha, alpha);
    return;
  }

  vec3 col = (colLine + haloTone * halo) * vignette * scan;
  float alpha = clamp(max(alphaLine, halo) * vignette * scan + grain * max(alphaLine, 0.04), 0.0, 1.0);
  col = clamp(col + grain * 0.6 * alpha, 0.0, 1.0);
  col = min(col, vec3(alpha));
  fragColor = vec4(col * uOpacity, alpha * uOpacity);
}`,S=(o,i,u)=>Math.min(u,Math.max(i,o)),le=(o,i,u)=>{const r=o.createShader(i);return r?(o.shaderSource(r,u),o.compileShader(r),o.getShaderParameter(r,o.COMPILE_STATUS)?r:(o.deleteShader(r),null)):null},Ve=o=>{const i=le(o,o.VERTEX_SHADER,Oe),u=le(o,o.FRAGMENT_SHADER,Ge),r=o.createProgram();if(!i||!u||!r)return null;if(o.attachShader(r,i),o.attachShader(r,u),o.linkProgram(r),o.deleteShader(i),o.deleteShader(u),!o.getProgramParameter(r,o.LINK_STATUS))return o.deleteProgram(r),null;const R={},k=o.getProgramParameter(r,o.ACTIVE_UNIFORMS);for(let E=0;E<k;E++){const F=o.getActiveUniform(r,E);F&&(R[F.name.replace(/\[0\]$/,"")]=o.getUniformLocation(r,F.name))}return{program:r,uniforms:R}},V=o=>{let i=String(o||"#ffffff").replace("#","").trim();(i.length===3||i.length===4)&&(i=i.slice(0,3).split("").map(r=>r+r).join(""));const u=parseInt(i.slice(0,6),16);return Number.isNaN(u)?[1,1,1]:[(u>>16&255)/255,(u>>8&255)/255,(u&255)/255]},Be=({color1:o="#5227FF",color2:i="#FF9FFC",color3:u="#FFFFFF",speed:r=.5,sweepSpeed:R=.25,sweepWidth:k=1.6,trail:E=.5,reverse:F=!1,scale:ue=1.5,frequency:ce=2,ripple:se=.22,bandDensity:fe=11,lineWidth:me=1.2,glow:de=.6,scanDirection:he="vertical",colorSpread:pe=.7,brightness:ve=1,vignette:ge=.3,scanline:xe=!0,scanlineIntensity:we=.5,grain:ye=!0,grainIntensity:Se=.04,opacity:Me=1,mouseInteraction:Re=!0,mouseRadius:Ee=.5,mouseStrength:Fe=.7,mouseMode:be="repel",clickEffect:Le="ping",intro:Ce=!0,lightMode:Ie=!1,dpr:Ae,className:Pe="",style:_e})=>{const U=N(null),q=N(null),W=N(null),z={color1:o,color2:i,color3:u,speed:r,sweepSpeed:F?-R:R,sweepWidth:Math.max(.05,k),trail:S(E,0,1),scale:Math.max(.05,ue),frequency:ce,ripple:se,bandDensity:Math.max(.5,fe),lineWidth:Math.max(.2,me),glow:Math.max(0,de),direction:We[he]??0,colorSpread:S(pe,0,1),brightness:Math.max(0,ve),vignette:S(ge,0,1),scanline:xe?S(we,0,1):0,grain:ye?Math.max(0,Se):0,opacity:S(Me,0,1),mouseInteraction:Re,mouseRadius:Math.max(.05,Ee),mouseStrength:Math.max(0,Fe),attract:be==="attract",clickEffect:Le,intro:Ce,lightMode:Ie,dpr:Ae},v=N(z);return v.current=z,re(()=>{const w=U.current,h=q.current,e=h?.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,failIfMajorPerformanceCaveat:!0});if(!w||!h||!e||Ne(e))return;const I=Ve(e);if(!I)return;const n=I.uniforms,H=e.createVertexArray(),A=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??!1,c={width:1,height:1,ratio:1},p={x:0,y:0,inside:!1},f={x:0,y:0,ready:!1},d=new Float32Array(M*3);for(let t=0;t<M;t++)d[t*3+2]=-1;let b=0,P=0,X=0,$=-.39,j=0,L=v.current.intro&&!A?0:1,C=0,_=0,T=!0,D=0;const O=(t,a)=>[(t*2-c.width)/c.height,(c.height-a*2)/c.height],K=()=>{const t=v.current;e.viewport(0,0,h.width,h.height),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(I.program),e.uniform2f(n.uResolution,h.width,h.height),e.uniform1f(n.uWave,X),e.uniform1f(n.uSweep,$),e.uniform1f(n.uSweepWidth,t.sweepWidth),e.uniform1f(n.uTrail,t.trail),e.uniform1f(n.uScale,t.scale),e.uniform1f(n.uFrequency,t.frequency),e.uniform1f(n.uRipple,t.ripple),e.uniform1f(n.uDensity,t.bandDensity),e.uniform1f(n.uLineWidth,t.lineWidth*c.ratio),e.uniform1f(n.uGlow,t.glow),e.uniform1f(n.uDirection,t.direction),e.uniform1f(n.uSpread,t.colorSpread),e.uniform1f(n.uBrightness,t.brightness),e.uniform1f(n.uVignette,t.vignette),e.uniform1f(n.uOpacity,t.opacity),e.uniform1f(n.uScanline,t.scanline),e.uniform1f(n.uRatio,c.ratio),e.uniform1f(n.uGrain,t.grain),e.uniform1f(n.uTime,j),e.uniform2f(n.uMouse,f.x,f.y),e.uniform1f(n.uPresence,t.mouseInteraction?P:0),e.uniform1f(n.uMouseRadius,t.mouseRadius),e.uniform1f(n.uMouseStrength,t.mouseStrength),e.uniform1f(n.uAttract,t.attract?1:0),e.uniform3fv(n.uPings,d),e.uniform1f(n.uIntro,L),e.uniform1f(n.uLightMode,t.lightMode?1:0),e.uniform3fv(n.uColor1,V(t.color1)),e.uniform3fv(n.uColor2,V(t.color2)),e.uniform3fv(n.uColor3,V(t.color3)),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.bindVertexArray(H),e.drawArrays(e.TRIANGLES,0,3)};let Y=v.current.dpr;const G=()=>{const t=v.current;Y=t.dpr,c.width=Math.max(1,w.clientWidth),c.height=Math.max(1,w.clientHeight),c.ratio=Math.min(t.dpr||window.devicePixelRatio||1,2),h.width=Math.max(1,Math.round(c.width*c.ratio)),h.height=Math.max(1,Math.round(c.height*c.ratio)),K(),g()},J=t=>{if(C=0,!T||document.hidden)return;const a=v.current;a.dpr!==Y&&G();const l=_?S((t-_)/1e3,0,1/20):1/60;_=t,j+=l,A||(X+=l*a.speed,$+=l*a.sweepSpeed),L<1&&(L=Math.min(1,L+l/ke));const s=O(p.x,p.y),x=1-Math.exp(-l/.09);f.x+=(s[0]-f.x)*x,f.y+=(s[1]-f.y)*x,P+=((p.inside&&a.mouseInteraction?1:0)-P)*(1-Math.exp(-l/.3));let y=!A&&(a.speed!==0||a.sweepSpeed!==0)||L<1||P>.001;for(let m=0;m<M;m++)d[m*3+2]<0||(d[m*3+2]+=l,d[m*3+2]>4?d[m*3+2]=-1:y=!0);K(),D=y?0:D+l,D<.5&&(C=requestAnimationFrame(J))};function g(){D=0,!C&&T&&!document.hidden&&(_=0,C=requestAnimationFrame(J))}const Q=t=>{const a=w.getBoundingClientRect(),l=t.clientX-a.left,s=t.clientY-a.top;return{x:l,y:s,inside:l>=0&&s>=0&&l<=a.width&&s<=a.height}},Z=t=>{const{x:a,y:l,inside:s}=Q(t),x=p.inside;if(p.inside=s,s&&(p.x=a,p.y=l,!x||!f.ready)){const[y,m]=O(a,l);f.x=y,f.y=m,f.ready=!0}(s||x)&&g()},ee=t=>{if(v.current.clickEffect!=="ping"||A)return;const{x:l,y:s,inside:x}=Q(t);if(!x)return;const[y,m]=O(l,s);d[b*3]=y,d[b*3+1]=m,d[b*3+2]=0,b=(b+1)%M,g()},te=()=>{p.inside=!1,g()},oe=()=>g(),ne=new ResizeObserver(G);ne.observe(w);const ie=new IntersectionObserver(t=>{T=t.some(a=>a.isIntersecting),T&&g()});return ie.observe(w),window.addEventListener("pointermove",Z,{passive:!0}),window.addEventListener("pointerdown",ee,{passive:!0}),document.documentElement.addEventListener("pointerleave",te),document.addEventListener("visibilitychange",oe),G(),W.current=g,()=>{cancelAnimationFrame(C),W.current=null,ne.disconnect(),ie.disconnect(),window.removeEventListener("pointermove",Z),window.removeEventListener("pointerdown",ee),document.documentElement.removeEventListener("pointerleave",te),document.removeEventListener("visibilitychange",oe),e.deleteVertexArray(H),e.deleteProgram(I.program),e.getExtension("WEBGL_lose_context")?.loseContext()}},[]),re(()=>{W.current?.()}),B("div",{ref:U,className:`scanner-container ${Pe}`.trim(),style:_e,children:B("canvas",{ref:q,className:"scanner-canvas","aria-hidden":"true"})})};function He(){const o=Te(),i=De();return B(Be,{color1:o.hl,color2:o.mid,color3:"#FFFFFF",speed:i?0:.4,sweepSpeed:i?0:.2,opacity:.75,brightness:.9,glow:.5,vignette:.45,grainIntensity:.03,mouseInteraction:ae.fine(),clickEffect:"ping",intro:!i,dpr:ae.lite()?.75:1})}export{He as default};
