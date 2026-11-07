import{A as k,d as st,h as Xe}from"./compat.module-DdK5-UJK.js";import{u as le,a as ut}from"./env-C2-whvUy.js";import{m as ct}from"../islands.js";const lt=f=>{try{const h=f.getExtension("WEBGL_debug_renderer_info");return/swiftshader|llvmpipe|softpipe|software/i.test(String(f.getParameter(h?h.UNMASKED_RENDERER_WEBGL:f.RENDERER)))}catch{return!1}},se={low:{sim:64,dye:512,iterations:10},medium:{sim:96,dye:1024,iterations:16},high:{sim:128,dye:1440,iterations:20}},Ne=256,ft=4,ue=.3,mt=.7,dt="splash-cursor",vt="splash-cursor__canvas",ht=`#version 300 es
precision highp float;
in vec2 aPosition;
uniform vec2 texelSize;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`,xt=`#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
`,pt={copy:`uniform sampler2D uTexture;
void main() {
  outColor = texture(uTexture, vUv);
}`,clear:`uniform sampler2D uTexture;
uniform float value;
void main() {
  outColor = value * texture(uTexture, vUv);
}`,splat:`uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 pointA;
uniform vec2 pointB;
uniform float radius;
void main() {
  vec2 scale = vec2(aspectRatio, 1.0);
  vec2 pa = (vUv - pointA) * scale;
  vec2 ba = (pointB - pointA) * scale;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
  vec2 d = pa - ba * h;
  vec3 base = texture(uTarget, vUv).xyz;
  outColor = vec4(base + exp(-dot(d, d) / radius) * color, 1.0);
}`,burst:`uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec2 point;
uniform float radius;
uniform float strength;
uniform float seed;
void main() {
  vec2 d = (vUv - point) * vec2(aspectRatio, 1.0);
  float distance = length(d);
  vec2 direction = d / max(distance, 0.00001);
  float angle = atan(d.y, d.x);
  float petals = 0.78 + 0.22 * sin(angle * 5.0 + seed) * sin(angle * 3.0 - seed * 1.7);
  vec2 twist = vec2(-direction.y, direction.x) * 0.3 * sin(angle * 4.0 + seed * 2.3);
  float falloff = exp(-dot(d, d) / radius) * distance / sqrt(radius);
  outColor = vec4(texture(uTarget, vUv).xy + (direction * petals + twist) * falloff * strength, 0.0, 1.0);
}`,crown:`uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec2 point;
uniform float radius;
uniform vec3 colorA;
uniform vec3 colorB;
uniform float seed;
void main() {
  vec2 d = (vUv - point) * vec2(aspectRatio, 1.0);
  vec3 ink = exp(-dot(d, d) / (radius * 0.45)) * colorA;
  for (int i = 0; i < 7; i++) {
    float index = float(i);
    float angle = seed + index * 0.8975979 + sin(seed * 3.0 + index * 1.9) * 0.35;
    float reach = sqrt(radius) * (0.75 + 0.45 * fract(sin(seed * 7.1 + index * 3.7) * 43.7));
    float drop = radius * (0.08 + 0.12 * fract(sin(seed * 2.9 + index * 5.3) * 31.9));
    vec2 q = d - vec2(cos(angle), sin(angle)) * reach;
    ink += exp(-dot(q, q) / drop) * mix(colorA, colorB, fract(index * 0.37 + 0.2));
  }
  outColor = vec4(texture(uTarget, vUv).xyz + ink, 1.0);
}`,advection:`uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;
void main() {
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
  outColor = texture(uSource, coord) / (1.0 + dissipation * dt);
}`,divergence:`uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x;
  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;
  if (vB.y < 0.0) B = -C.y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,curl:`uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,vorticity:`uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
void main() {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy + force * dt;
  outColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}`,pressure:`uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  outColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`,gradient:`uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  outColor = vec4(velocity, 0.0, 1.0);
}`,prefilter:`uniform sampler2D uTexture;
uniform vec3 curve;
uniform float threshold;
void main() {
  vec3 c = texture(uTexture, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - curve.x, 0.0, curve.y);
  rq = curve.z * rq * rq;
  c *= max(rq, br - threshold) / max(br, 0.0001);
  outColor = vec4(c, 0.0);
}`,blur:`uniform sampler2D uTexture;
uniform float intensity;
void main() {
  vec4 sum = texture(uTexture, vL) + texture(uTexture, vR) + texture(uTexture, vT) + texture(uTexture, vB);
  outColor = sum * 0.25 * intensity;
}`,display:`uniform sampler2D uTexture;
uniform sampler2D uBloom;
uniform vec2 texelSize;
uniform float shading;
uniform float bloom;
uniform float light;
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
void main() {
  vec3 c = texture(uTexture, vUv).rgb;
  if (shading > 0.0) {
    float dx = length(texture(uTexture, vR).rgb) - length(texture(uTexture, vL).rgb);
    float dy = length(texture(uTexture, vT).rgb) - length(texture(uTexture, vB).rgb);
    vec3 n = normalize(vec3(dx, dy, length(texelSize)));
    c *= mix(1.0, clamp(n.z + 0.7, 0.7, 1.0), shading);
  }
  if (bloom > 0.0) {
    c += max(texture(uBloom, vUv).rgb, 0.0) * bloom;
  }
  c = max(c, 0.0);
  float peak = max(c.r, max(c.g, c.b));
  float grain = (hash(gl_FragCoord.xy) - 0.5) / 255.0 * smoothstep(0.0, 0.03, peak);
  if (light > 0.5) {
    vec3 transmit = exp(-2.4 * c);
    float low = min(transmit.r, min(transmit.g, transmit.b));
    float alpha = clamp(1.0 - low + grain, 0.0, 1.0);
    outColor = vec4(min(transmit - low, vec3(alpha)), alpha);
  } else {
    c = max(c + grain, 0.0);
    float alpha = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
    outColor = vec4(min(c, vec3(alpha)), alpha);
  }
}`},ce=(f,h,m)=>Math.min(m,Math.max(h,f)),gt=f=>{let h=String(f).replace("#","").trim();h.length===3&&(h=[...h].map(A=>A+A).join(""));const m=parseInt(h.slice(0,6),16);return Number.isNaN(m)?[1,1,1]:[(m>>16&255)/255,(m>>8&255)/255,(m&255)/255]},Et=(f,h,m)=>{const A=Math.floor(f*6),N=f*6-A,w=m*(1-h),C=m*(1-N*h),P=m*(1-(1-N)*h),L=(A%6+6)%6;return L===0?[m,P,w]:L===1?[C,m,w]:L===2?[w,m,P]:L===3?[w,C,m]:L===4?[P,w,m]:[m,w,C]};function Tt({colors:f=["#4f8cff","#2dd4bf","#ffd166"],rainbow:h=!0,colorSpeed:m=1,intensity:A=1,size:N=1,force:w=1,swirl:C=3,trail:P=1,momentum:L=1,shading:ze=1,glow:Oe=0,quality:fe="high",clickSplash:Ie=!0,intro:Ve=!0,contained:z=!1,theme:qe="dark",zIndex:ke=50,className:Ye="",style:He}){const me=k(null),de=k(null),[Ge,We]=st(0),ve={palette:(Array.isArray(f)&&f.length?f:["#ffffff"]).map(gt),rainbow:h,colorSpeed:Math.max(0,m),intensity:Math.max(0,A),size:Math.max(.05,N),force:Math.max(0,w),swirl:Math.max(0,C),trail:Math.max(.05,P),momentum:Math.max(.05,L),shading:ce(ze,0,1),glow:ce(Oe,0,1),quality:se[fe]?fe:"high",clickSplash:Ie,contained:z,light:qe==="light"},g=k(ve);g.current=ve;const je=k(Ve);return Xe(()=>{const c=me.current?.parentElement;if(!z||!c||getComputedStyle(c).position!=="static")return;const e=c.style.position;return c.style.position="relative",()=>{c.style.position=e}},[z]),Xe(()=>{const c=de.current;if(!c)return;const e=c.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1,failIfMajorPerformanceCaveat:!0});if(!e||lt(e))return;e.getExtension("EXT_color_buffer_float"),e.getExtension("EXT_color_buffer_half_float");const Y=(t,r)=>{const i=e.createTexture();e.bindTexture(e.TEXTURE_2D,i),e.texImage2D(e.TEXTURE_2D,0,t,4,4,0,r,e.HALF_FLOAT,null);const o=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,o),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,i,0);const n=e.checkFramebufferStatus(e.FRAMEBUFFER)===e.FRAMEBUFFER_COMPLETE;return e.bindFramebuffer(e.FRAMEBUFFER,null),e.deleteFramebuffer(o),e.deleteTexture(i),n},B={internal:e.RGBA16F,format:e.RGBA};if(!Y(B.internal,B.format))return;const H=Y(e.RG16F,e.RG)?{internal:e.RG16F,format:e.RG}:B,U=Y(e.R16F,e.RED)?{internal:e.R16F,format:e.RED}:H,he=(t,r)=>{const i=e.createShader(t);return e.shaderSource(i,r),e.compileShader(i),i},xe=he(e.VERTEX_SHADER,ht),G={};let pe=!1;Object.entries(pt).forEach(([t,r])=>{const i=he(e.FRAGMENT_SHADER,xt+r),o=e.createProgram();e.attachShader(o,xe),e.attachShader(o,i),e.bindAttribLocation(o,0,"aPosition"),e.linkProgram(o),e.deleteShader(i),e.getProgramParameter(o,e.LINK_STATUS)||(pe=!0);const n={},u=e.getProgramParameter(o,e.ACTIVE_UNIFORMS);for(let a=0;a<u;a++){const l=e.getActiveUniform(o,a);l&&(n[l.name]=e.getUniformLocation(o,l.name))}G[t]={program:o,uniforms:n}}),e.deleteShader(xe);const ge=e.createBuffer(),Ee=e.createVertexArray();e.bindVertexArray(Ee),e.bindBuffer(e.ARRAY_BUFFER,ge),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0);const O=new Set;let W=!1,j=!1;const Te=()=>{e.isContextLost()||(O.forEach(t=>{e.deleteFramebuffer(t.fbo),e.deleteTexture(t.texture)}),O.clear(),Object.values(G).forEach(t=>e.deleteProgram(t.program)),e.deleteBuffer(ge),e.deleteVertexArray(Ee))};if(pe){Te();return}const p=t=>{const r=G[t];return e.useProgram(r.program),r.uniforms},d=t=>{t?(e.viewport(0,0,t.width,t.height),e.bindFramebuffer(e.FRAMEBUFFER,t.fbo)):(e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight),e.bindFramebuffer(e.FRAMEBUFFER,null)),e.drawArrays(e.TRIANGLE_STRIP,0,4)},F=(t,r,i,o)=>{e.activeTexture(e.TEXTURE0);const n=e.createTexture();e.bindTexture(e.TEXTURE_2D,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,i.internal,t,r,0,i.format,e.HALF_FLOAT,null);const u=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,u),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,n,0),e.viewport(0,0,t,r),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT);const a={texture:n,fbo:u,width:t,height:r,texelX:1/t,texelY:1/r,attach:l=>(e.activeTexture(e.TEXTURE0+l),e.bindTexture(e.TEXTURE_2D,n),l)};return O.add(a),a},$=t=>{t&&(e.deleteFramebuffer(t.fbo),e.deleteTexture(t.texture),O.delete(t))},I=(t,r,i,o)=>{e.bindTexture(e.TEXTURE_2D,t.texture),e.texImage2D(e.TEXTURE_2D,0,o.internal,r,i,0,o.format,e.HALF_FLOAT,null),t.width=r,t.height=i,t.texelX=1/r,t.texelY=1/i},K=(t,r,i,o)=>{const n={read:F(t,r,i,o),write:F(t,r,i,o),width:t,height:r,texelX:1/t,texelY:1/r,swap:()=>{const u=n.read;n.read=n.write,n.write=u}};return n},Q=(t,r,i,o,n,u)=>{if(u){const a=F(r,i,o,n),l=p("copy");e.uniform1i(l.uTexture,t.read.attach(0)),d(a),$(t.read),t.read=a}else I(t.read,r,i,o);I(t.write,r,i,o),t.width=r,t.height=i,t.texelX=1/r,t.texelY=1/i},V=t=>{const r=e.drawingBufferWidth,i=e.drawingBufferHeight,o=Math.max(r,i)/Math.max(1,Math.min(r,i)),n=Math.round(t),u=Math.round(t*o);return r>i?{width:u,height:n}:{width:n,height:u}},Re=()=>{const t=Math.min(window.devicePixelRatio||1,2),r=Math.max(1,Math.floor(c.clientWidth*t)),i=Math.max(1,Math.floor(c.clientHeight*t));c.width===r&&c.height===i||(c.width=r,c.height=i)},ye=()=>{const t=se[g.current.quality],r=Math.min(e.drawingBufferWidth,e.drawingBufferHeight);return{sim:V(t.sim),ink:V(Math.max(t.sim,Math.min(t.dye,r)))}};Re();const T=ye(),x=K(T.ink.width,T.ink.height,B,e.LINEAR),s=K(T.sim.width,T.sim.height,H,e.LINEAR),b=K(T.sim.width,T.sim.height,U,e.NEAREST),J=F(T.sim.width,T.sim.height,U,e.NEAREST),Z=F(T.sim.width,T.sim.height,U,e.NEAREST);let y=null,M=[];const $e=()=>{$(y),M.forEach($),y=null,M=[]},Ke=()=>{if(y)return y;const t=V(Ne),r=F(t.width,t.height,B,e.LINEAR);for(let i=0;i<ft;i++){const o=t.width>>i+1,n=t.height>>i+1;if(o<2||n<2)break;M.push(F(o,n,B,e.LINEAR))}return y=r,r},we=()=>{Re();const t=ye();(x.width!==t.ink.width||x.height!==t.ink.height)&&Q(x,t.ink.width,t.ink.height,B,e.LINEAR,!0),(s.width!==t.sim.width||s.height!==t.sim.height)&&(Q(s,t.sim.width,t.sim.height,H,e.LINEAR,!0),Q(b,t.sim.width,t.sim.height,U,e.NEAREST,!1),I(J,t.sim.width,t.sim.height,U),I(Z,t.sim.width,t.sim.height,U));const r=V(Ne);y&&(y.width!==r.width||y.height!==r.height)&&$e()},ee=t=>{const r=c.width/c.height;return .2*g.current.size*t/100*(r>1?r:1)},Qe=(t,r,i,o,n,u,a,l)=>{const v=p("splat");e.uniform1i(v.uTarget,s.read.attach(0)),e.uniform1f(v.aspectRatio,c.width/c.height),e.uniform2f(v.pointA,t,r),e.uniform2f(v.pointB,i,o),e.uniform3f(v.color,n,u,0),e.uniform1f(v.radius,l),d(s.write),s.swap(),e.uniform1i(v.uTarget,x.read.attach(0)),e.uniform3f(v.color,a[0],a[1],a[2]),d(x.write),x.swap()},te=(t,r)=>{const i=g.current,o=((t+r/1e3*i.colorSpeed*.6)%1+1)%1;if(i.rainbow)return Et(o,1,1);const n=i.palette;if(n.length===1)return n[0];const u=o*n.length,a=n[Math.floor(u)%n.length],l=n[(Math.floor(u)+1)%n.length],v=u-Math.floor(u),R=v*v*(3-2*v);return[a[0]+(l[0]-a[0])*R,a[1]+(l[1]-a[1])*R,a[2]+(l[2]-a[2])*R]},re=(t,r)=>t.map(i=>(g.current.light?1-i:i)*r),be=(t,r,i)=>{const o=g.current,n=c.width/c.height,u=Math.hypot((t.x-t.px)*n,t.y-t.py);if(u>.35){t.px=t.x,t.py=t.y;return}let a=t.x-t.px,l=t.y-t.py;n<1?a*=n:l/=n;const v=ee(1),R=1+u/(1.77*Math.sqrt(v)),_=6e3*o.force/Math.sqrt(R),nt=.15*o.intensity*Math.min(r*60,1)/Math.sqrt(R),at=re(te(t.offset,i),nt);Qe(t.px,t.py,t.x,t.y,a*_,l*_,at,v),t.px=t.x,t.py=t.y},Je=(t,r,i)=>{const o=g.current,n=Math.random()*Math.PI*2,u=c.width/c.height;let a=p("burst");e.uniform1i(a.uTarget,s.read.attach(0)),e.uniform1f(a.aspectRatio,u),e.uniform2f(a.point,t,r),e.uniform1f(a.radius,ee(3)),e.uniform1f(a.strength,1100*o.force),e.uniform1f(a.seed,n),d(s.write),s.swap();const l=Math.random(),v=1.6*o.intensity,R=re(te(l,i),v),_=re(te(l+.3,i),v);a=p("crown"),e.uniform1i(a.uTarget,x.read.attach(0)),e.uniform1f(a.aspectRatio,u),e.uniform2f(a.point,t,r),e.uniform1f(a.radius,ee(1.6)),e.uniform3f(a.colorA,R[0],R[1],R[2]),e.uniform3f(a.colorB,_[0],_[1],_[2]),e.uniform1f(a.seed,n),d(x.write),x.swap()},Ze=t=>{const r=g.current,i=se[r.quality].iterations;e.disable(e.BLEND);let o=p("curl");e.uniform2f(o.texelSize,s.texelX,s.texelY),e.uniform1i(o.uVelocity,s.read.attach(0)),d(Z),o=p("vorticity"),e.uniform2f(o.texelSize,s.texelX,s.texelY),e.uniform1i(o.uVelocity,s.read.attach(0)),e.uniform1i(o.uCurl,Z.attach(1)),e.uniform1f(o.curl,r.swirl),e.uniform1f(o.dt,t),d(s.write),s.swap(),o=p("divergence"),e.uniform2f(o.texelSize,s.texelX,s.texelY),e.uniform1i(o.uVelocity,s.read.attach(0)),d(J),o=p("clear"),e.uniform1i(o.uTexture,b.read.attach(0)),e.uniform1f(o.value,.1),d(b.write),b.swap(),o=p("pressure"),e.uniform2f(o.texelSize,s.texelX,s.texelY),e.uniform1i(o.uDivergence,J.attach(0));for(let n=0;n<i;n++)e.uniform1i(o.uPressure,b.read.attach(1)),d(b.write),b.swap();o=p("gradient"),e.uniform2f(o.texelSize,s.texelX,s.texelY),e.uniform1i(o.uPressure,b.read.attach(0)),e.uniform1i(o.uVelocity,s.read.attach(1)),d(s.write),s.swap(),o=p("advection"),e.uniform2f(o.texelSize,s.texelX,s.texelY),e.uniform1i(o.uVelocity,s.read.attach(0)),e.uniform1i(o.uSource,s.read.attach(0)),e.uniform1f(o.dt,t),e.uniform1f(o.dissipation,2/r.momentum),d(s.write),s.swap(),e.uniform1i(o.uVelocity,s.read.attach(0)),e.uniform1i(o.uSource,x.read.attach(1)),e.uniform1f(o.dissipation,3.5/r.trail),d(x.write),x.swap()},et=t=>{const r=Ke();if(!M.length)return;e.disable(e.BLEND);let i=p("prefilter");const o=ue*mt+1e-4;e.uniform3f(i.curve,ue-o,o*2,.25/o),e.uniform1f(i.threshold,ue),e.uniform1i(i.uTexture,x.read.attach(0)),d(r),i=p("blur"),e.uniform1f(i.intensity,1);let n=r;M.forEach(u=>{e.uniform2f(i.texelSize,n.texelX,n.texelY),e.uniform1i(i.uTexture,n.attach(0)),d(u),n=u}),e.blendFunc(e.ONE,e.ONE),e.enable(e.BLEND);for(let u=M.length-2;u>=0;u--){const a=M[u];e.uniform2f(i.texelSize,n.texelX,n.texelY),e.uniform1i(i.uTexture,n.attach(0)),d(a),n=a}e.disable(e.BLEND),e.uniform1f(i.intensity,t),e.uniform2f(i.texelSize,n.texelX,n.texelY),e.uniform1i(i.uTexture,n.attach(0)),d(r)},tt=()=>{const t=g.current;t.glow>0&&et(2*t.glow),e.disable(e.BLEND);const r=p("display");e.uniform2f(r.texelSize,1/e.drawingBufferWidth,1/e.drawingBufferHeight),e.uniform1i(r.uTexture,x.read.attach(0)),e.uniform1i(r.uBloom,(y??x.read).attach(1)),e.uniform1f(r.shading,t.shading),e.uniform1f(r.bloom,t.glow>0?1:0),e.uniform1f(r.light,t.light?1:0),d(null)},rt=()=>{e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT)},S=new Map,Ae=[],ot=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??!1,E={x:0,y:0,px:0,py:0,ready:!1,moved:!1,offset:Math.random()};let X=je.current&&!ot?performance.now()+150:-1,D=0,oe=0,ie=performance.now();const it=t=>{if(X<0)return;const r=(t-X)/1100;if(r<0)return;const i=Math.min(r,1),o=i*i*(3-2*i),n=.2+.6*o,u=.5+.12*Math.sin(o*Math.PI*2);E.ready?(E.x=n,E.y=u,E.moved=!0):(E.x=E.px=n,E.y=E.py=u,E.ready=!0),i>=1&&(X=-1),ie=t},Le=t=>{if(D=0,W||j)return;const r=g.current,i=ce((t-oe)/1e3,0,1/60);oe=t,we(),it(t),E.moved&&(E.moved=!1,be(E,i,t)),S.forEach(n=>{n.moved&&(n.moved=!1,be(n,i,t))}),Ae.splice(0).forEach(n=>Je(n.x,n.y,t)),Ze(i),tt();const o=(2.2*r.trail+.4)*1e3;X>=0||t-ie<o?D=requestAnimationFrame(Le):rt()},ne=()=>{ie=performance.now(),!(D||W||j)&&(oe=performance.now(),D=requestAnimationFrame(Le))},Be=(t,r)=>{const i=c.getBoundingClientRect();if(!i.width||!i.height)return null;const o=(t-i.left)/i.width,n=1-(r-i.top)/i.height;return g.current.contained&&(o<0||o>1||n<0||n>1)?null:{x:o,y:n}},ae=(t,r,i)=>{const o=Be(r,i);let n=S.get(t);if(!o){n&&(n.ready=!1);return}if(n||(n={x:0,y:0,px:0,py:0,ready:!1,moved:!1,offset:Math.random()},S.set(t,n)),!n.ready){n.x=n.px=o.x,n.y=n.py=o.y,n.ready=!0;return}n.x=o.x,n.y=o.y,n.moved=!0,ne()},Fe=(t,r)=>{if(!g.current.clickSplash)return;const i=Be(t,r);i&&(Ae.push(i),ne())},Me=t=>{t.pointerType!=="touch"&&ae(`p${t.pointerId}`,t.clientX,t.clientY)},De=t=>{t.pointerType!=="touch"&&Fe(t.clientX,t.clientY)},Ue=t=>{Array.from(t.changedTouches).forEach(r=>{S.delete(`t${r.identifier}`),ae(`t${r.identifier}`,r.clientX,r.clientY),Fe(r.clientX,r.clientY)})},Se=t=>{Array.from(t.changedTouches).forEach(r=>ae(`t${r.identifier}`,r.clientX,r.clientY))},q=t=>{Array.from(t.changedTouches).forEach(r=>S.delete(`t${r.identifier}`))},_e=()=>{S.forEach(t=>{t.ready=!1})},Ce=t=>{t.preventDefault(),j=!0,cancelAnimationFrame(D),D=0},Pe=()=>We(t=>t+1);return window.addEventListener("pointermove",Me,{passive:!0}),window.addEventListener("pointerdown",De,{passive:!0}),window.addEventListener("touchstart",Ue,{passive:!0}),window.addEventListener("touchmove",Se,{passive:!0}),window.addEventListener("touchend",q,{passive:!0}),window.addEventListener("touchcancel",q,{passive:!0}),document.documentElement.addEventListener("pointerleave",_e),c.addEventListener("webglcontextlost",Ce),c.addEventListener("webglcontextrestored",Pe),we(),X>=0&&ne(),()=>{W=!0,cancelAnimationFrame(D),window.removeEventListener("pointermove",Me),window.removeEventListener("pointerdown",De),window.removeEventListener("touchstart",Ue),window.removeEventListener("touchmove",Se),window.removeEventListener("touchend",q),window.removeEventListener("touchcancel",q),document.documentElement.removeEventListener("pointerleave",_e),c.removeEventListener("webglcontextlost",Ce),c.removeEventListener("webglcontextrestored",Pe),Te()}},[Ge]),le("div",{ref:me,className:[dt,Ye].filter(Boolean).join(" "),style:{zIndex:ke,...He},"data-contained":z?"":void 0,"aria-hidden":"true",children:le("canvas",{ref:de,className:vt})})}function bt(){const f=ut();return le(Tt,{colors:[f.hl,f.mid,f.decor],rainbow:!1,intensity:.85,quality:ct.fine()?"medium":"low",intro:!1,theme:f.dark?"dark":"light",zIndex:55})}export{bt as default};
