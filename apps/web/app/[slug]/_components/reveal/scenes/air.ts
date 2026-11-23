/**
 * 🎭 THE REVEALS MADE OF AIR AND FOIL (drawing `src/fx.js`).
 *   · SMOKE   — dry-ice fog fills the screen; a tap is a puff of clean air that opens in rings from the finger (owner
 *               23 Nov: *"true smoke"* · *"like a ripple in water"*). A real fluid: a small grid of moving air solved
 *               every frame on the graphics chip (advect, swirl, pressure), so it curls, lifts and thins.
 *               It needs half-float render targets; a phone without them gets the same fog, opened by the same rings,
 *               drawn by one shader (`softFog`) — never a gate.
 *   · SCRATCH — gold foil carrying the event's logo and names; rubbed away by the finger, it opens only once 60 % is
 *               gone (owner: *"at least 60%"*), and what is left lets go in flakes.
 */
import * as THREE from 'three';
import { SCRATCH_OPENS_AT } from '@/lib/reveal-motion';
import { BUMP, canvas, ctx2d, solidLights, stamp, texOf, type Ctx, type Scene } from './kit';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const VS3 = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
const NOISE = [
  'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
  'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }',
  'float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= .5; } return s; }',
].join('\n');
const HEAD = 'varying vec2 vUv; uniform vec2 px; uniform float dt, uT, uTau, uR; uniform vec2 uTap; uniform vec4 uPush; uniform vec2 uWH;\n' + NOISE + '\n';

type U = Record<string, THREE.IUniform>;
type Pair = { a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget; swap: () => void };

/** Does this phone render into half-float targets? (WebGL2 needs EXT_color_buffer_half_float or _float.) */
function halfFloatTargets(r: THREE.WebGLRenderer): boolean {
  const gl = r.getContext();
  return !!(gl.getExtension('EXT_color_buffer_half_float') || gl.getExtension('EXT_color_buffer_float'));
}

class Fluid {
  v: Pair;
  d: Pair;
  p: Pair;
  div: THREE.WebGLRenderTarget;
  curl: THREE.WebGLRenderTarget;
  all: THREE.WebGLRenderTarget[];
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene = new THREE.Scene();
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  U: U;
  mAdv: THREE.ShaderMaterial;
  mCurl: THREE.ShaderMaterial;
  mForce: THREE.ShaderMaterial;
  mDiv: THREE.ShaderMaterial;
  mPres: THREE.ShaderMaterial;
  mGrad: THREE.ShaderMaterial;
  mSrc: THREE.ShaderMaterial;
  vdiss: number;
  ddiss: number[];
  iters: number;
  out = false;
  constructor(
    private r: THREE.WebGLRenderer,
    o: { nx?: number; ny?: number; dye?: number; conf?: number; vdiss?: number; ddiss?: number[]; iters?: number; force: string; div?: string; source: string; wh: [number, number] },
  ) {
    const nx = o.nx ?? 96;
    const ny = o.ny ?? 166;
    const ds = o.dye ?? 2;
    const rt = (w: number, h: number) =>
      new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false });
    const pair = (w: number, h: number): Pair => {
      const P: Pair = {
        a: rt(w, h),
        b: rt(w, h),
        swap() {
          const t = P.a;
          P.a = P.b;
          P.b = t;
        },
      };
      return P;
    };
    this.v = pair(nx, ny);
    this.d = pair(nx * ds, ny * ds);
    this.p = pair(nx, ny);
    this.div = rt(nx, ny);
    this.curl = rt(nx, ny);
    this.all = [this.v.a, this.v.b, this.d.a, this.d.b, this.p.a, this.p.b, this.div, this.curl];
    this.scene.add(this.quad);
    const U = (this.U = {
      px: { value: new THREE.Vector2(1 / nx, 1 / ny) },
      dt: { value: 1 / 60 },
      uT: { value: 0 },
      uTau: { value: -1 },
      uR: { value: -1 },
      uTap: { value: new THREE.Vector2(0, 0) },
      uPush: { value: new THREE.Vector4(0.5, 0.5, 0, 0) },
      uWH: { value: new THREE.Vector2(...o.wh) },
    });
    const mat = (frag: string, extra: U) => new THREE.ShaderMaterial({ uniforms: { ...U, ...extra }, vertexShader: VS, fragmentShader: HEAD + frag, depthTest: false, depthWrite: false });
    this.mAdv = mat('uniform sampler2D uV, uQ; uniform vec4 diss; uniform float uOut; void main(){ vec2 c = vUv - dt * texture2D(uV, vUv).xy * px; vec4 r = diss * texture2D(uQ, c); if (uOut > .5 && (c.x < 0. || c.x > 1. || c.y < 0. || c.y > 1.)) r = vec4(0.); gl_FragColor = r; }', {
      uV: { value: null },
      uQ: { value: null },
      diss: { value: new THREE.Vector4(1, 1, 1, 1) },
      uOut: { value: 0 },
    });
    this.mCurl = mat('uniform sampler2D uV; void main(){ float L = texture2D(uV, vUv - vec2(px.x, 0.)).y, R = texture2D(uV, vUv + vec2(px.x, 0.)).y, B = texture2D(uV, vUv - vec2(0., px.y)).x, T = texture2D(uV, vUv + vec2(0., px.y)).x; gl_FragColor = vec4(R - L - T + B, 0., 0., 1.); }', { uV: { value: null } });
    this.mForce = mat(
      'uniform sampler2D uV, uC, uD; uniform float uConf;\nvoid main(){ vec2 v = texture2D(uV, vUv).xy;' +
        ' float L = texture2D(uC, vUv - vec2(px.x, 0.)).x, R = texture2D(uC, vUv + vec2(px.x, 0.)).x, B = texture2D(uC, vUv - vec2(0., px.y)).x, T = texture2D(uC, vUv + vec2(0., px.y)).x, C = texture2D(uC, vUv).x;' +
        ' vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 1e-4; f *= uConf * C; f.y *= -1.; v += f * dt;' +
        ' vec4 d = texture2D(uD, vUv); vec2 q = (vUv - .5) * uWH; vec2 tq = uTap;' +
        ' vec2 pq = (uPush.xy - .5) * uWH; v += uPush.zw * exp(-dot(q - pq, q - pq) / .1);\n' +
        o.force +
        '\n gl_FragColor = vec4(v, 0., 1.); }',
      { uV: { value: null }, uC: { value: null }, uD: { value: null }, uConf: { value: o.conf ?? 18 } },
    );
    this.mDiv = mat(
      'uniform sampler2D uV; void main(){ float L = texture2D(uV, vUv - vec2(px.x, 0.)).x, R = texture2D(uV, vUv + vec2(px.x, 0.)).x, B = texture2D(uV, vUv - vec2(0., px.y)).y, T = texture2D(uV, vUv + vec2(0., px.y)).y; vec2 q = (vUv - .5) * uWH; vec2 tq = uTap; float S = 0.;\n' +
        (o.div ?? '') +
        '\n gl_FragColor = vec4(.5 * (R - L + T - B) - S, 0., 0., 1.); }',
      { uV: { value: null } },
    );
    this.mPres = mat('uniform sampler2D uP, uDv; float P(vec2 u){ return (u.x < 0. || u.x > 1. || u.y < 0. || u.y > 1.) ? 0. : texture2D(uP, u).x; } void main(){ float L = P(vUv - vec2(px.x, 0.)), R = P(vUv + vec2(px.x, 0.)), B = P(vUv - vec2(0., px.y)), T = P(vUv + vec2(0., px.y)); gl_FragColor = vec4((L + R + B + T - texture2D(uDv, vUv).x) * .25, 0., 0., 1.); }', {
      uP: { value: null },
      uDv: { value: null },
    });
    this.mGrad = mat('uniform sampler2D uP, uV; void main(){ float L = texture2D(uP, vUv - vec2(px.x, 0.)).x, R = texture2D(uP, vUv + vec2(px.x, 0.)).x, B = texture2D(uP, vUv - vec2(0., px.y)).x, T = texture2D(uP, vUv + vec2(0., px.y)).x; vec2 v = texture2D(uV, vUv).xy - .5 * vec2(R - L, T - B); gl_FragColor = vec4(v, 0., 1.); }', {
      uP: { value: null },
      uV: { value: null },
    });
    this.mSrc = mat('uniform sampler2D uD; uniform vec2 tx;\nvoid main(){ vec4 d = texture2D(uD, vUv); vec2 q = (vUv - .5) * uWH; vec2 tq = uTap;\n' + o.source + '\n gl_FragColor = d; }', {
      uD: { value: null },
      tx: { value: new THREE.Vector2(1 / (nx * ds), 1 / (ny * ds)) },
    });
    this.vdiss = o.vdiss ?? 0.995;
    this.ddiss = o.ddiss ?? [1, 1, 1, 1];
    this.iters = o.iters ?? 14;
    const prev = r.getRenderTarget();
    for (const t of this.all) {
      r.setRenderTarget(t);
      r.setClearColor(0x000000, 0);
      r.clear();
    }
    r.setRenderTarget(prev);
  }
  pass(m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget): void {
    this.quad.material = m;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }
  source(): void {
    this.mSrc.uniforms.uD!.value = this.d.a.texture;
    this.pass(this.mSrc, this.d.b);
    this.d.swap();
    this.r.setRenderTarget(null);
  }
  step(t: number, tau: number): void {
    const { v, d, p } = this;
    this.U.uT!.value = t;
    this.U.uTau!.value = tau;
    let u = this.mAdv.uniforms;
    u.uV!.value = v.a.texture;
    u.uQ!.value = v.a.texture;
    u.uOut!.value = 0;
    (u.diss!.value as THREE.Vector4).set(this.vdiss, this.vdiss, 1, 1);
    this.pass(this.mAdv, v.b);
    v.swap();
    this.mCurl.uniforms.uV!.value = v.a.texture;
    this.pass(this.mCurl, this.curl);
    u = this.mForce.uniforms;
    u.uV!.value = v.a.texture;
    u.uC!.value = this.curl.texture;
    u.uD!.value = d.a.texture;
    this.pass(this.mForce, v.b);
    v.swap();
    this.mDiv.uniforms.uV!.value = v.a.texture;
    this.pass(this.mDiv, this.div);
    u = this.mPres.uniforms;
    u.uDv!.value = this.div.texture;
    for (let i = 0; i < this.iters; i++) {
      u.uP!.value = p.a.texture;
      this.pass(this.mPres, p.b);
      p.swap();
    }
    u = this.mGrad.uniforms;
    u.uP!.value = p.a.texture;
    u.uV!.value = v.a.texture;
    this.pass(this.mGrad, v.b);
    v.swap();
    u = this.mAdv.uniforms;
    u.uV!.value = v.a.texture;
    u.uQ!.value = d.a.texture;
    u.uOut!.value = this.out ? 1 : 0;
    (u.diss!.value as THREE.Vector4).fromArray(this.ddiss);
    this.pass(this.mAdv, d.b);
    d.swap();
    this.source();
    const push = this.U.uPush!.value as THREE.Vector4;
    push.z *= 0.6;
    push.w *= 0.6;
  }
  push(x: number, y: number, dx: number, dy: number): void {
    (this.U.uPush!.value as THREE.Vector4).set(x * 0.5 + 0.5, y * 0.5 + 0.5, dx, dy);
  }
  dispose(): void {
    for (const t of this.all) t.dispose();
    for (const m of [this.mAdv, this.mCurl, this.mForce, this.mDiv, this.mPres, this.mGrad, this.mSrc]) m.dispose();
    this.quad.geometry.dispose();
  }
}

/* the puff of clean air: a ring that travels out from the tap, a second behind it, and the hole under the finger */
const PUFF =
  ' float l2 = dot(q - tq, q - tq); float ll = sqrt(l2); float r1 = 1.75 * uTau; float r2 = 1.75 * (uTau - .75); S = uTau < 0. ? 0. : 3.4 * exp(-(ll - r1) * (ll - r1) / .05) + (r2 > 0. ? 2. * exp(-(ll - r2) * (ll - r2) / .05) : 0.) + 2. * exp(-l2 / .05) * (1. - smoothstep(.2, .9, uTau));';

/** 7 · SMOKE */
export const smoke = (): Scene => {
  let c: Ctx;
  let fluid: Fluid | null = null;
  let mat: THREE.ShaderMaterial;
  let mark: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  let last: [number, number] | null = null;
  const tap = new THREE.Vector2(0, 0);
  const soft = { uTau: { value: -1 }, uT: { value: 0 }, uTap: { value: tap }, uWH: { value: new THREE.Vector2(3, 5.2) } };
  const pointer = (kind: 'down' | 'move' | 'up', x: number, y: number) => {
    /* a finger moving through the air pushes it */
    if (kind === 'move' && last && fluid) fluid.push(x, y, (x - last[0]) * 2600, (y - last[1]) * 4500);
    last = kind === 'up' ? null : [x, y];
  };
  return {
    legacyT: 3.4,
    init(cx) {
      c = cx;
      const wh: [number, number] = [c.W, c.H];
      soft.uWH.value.set(c.W, c.H);
      if (halfFloatTargets(c.renderer)) {
        const f = (fluid = new Fluid(c.renderer, {
          conf: 16,
          vdiss: 0.99,
          ddiss: [1, 1, 1, 1],
          iters: 24,
          div: PUFF,
          wh,
          force: [
            ' v += dt * 6. * vec2(sin(q.y * 1.7 + uT * .22) + .6 * sin(q.y * 3.3 - uT * .17 + q.x * 1.3), .5 * cos(q.x * 2.1 - uT * .2) + .3 * cos(q.x * 3.9 + uT * .13 + q.y * 1.1) - .35);',
            ' if (uTau >= 0.) { v += dt * 14. * (vec2(vn(q * 2.4 + uT * .3), vn(q * 2.4 - uT * .3 + 9.)) - .5) * d.r; }',
          ].join('\n'),
          source: [
            ' float n = fbm(q * 1.1 + vec2(0., uT * .04)), n2 = fbm(q * 3.4 + vec2(uT * .05, 4.));',
            ' if (uTau < 0.) { d.r += (1. - d.r) * .08; d.b += (n - d.b) * .02; d.a += (n2 - d.a) * .03; }',
            ' else { float S = 0.;' + PUFF + ' d.r *= exp(-S * dt * 1.1);',
            '  float nb = (texture2D(uD, vUv + vec2(tx.x * 2.5, 0.)).r + texture2D(uD, vUv - vec2(tx.x * 2.5, 0.)).r + texture2D(uD, vUv + vec2(0., tx.y * 2.5)).r + texture2D(uD, vUv - vec2(0., tx.y * 2.5)).r) * .25; d.r = mix(d.r, nb, .5);',
            '  d.r *= 1. - dt * .5 * smoothstep(r1, r1 - .9, ll); d.r *= mix(1., .985, smoothstep(2.6, 3.3, uTau)); }',
          ].join('\n'),
        }));
        for (let i = 0; i < 90; i++) f.source();
        mat = new THREE.ShaderMaterial({
          uniforms: { uD: { value: null }, tx: { value: new THREE.Vector2(1 / 192, 1 / 332) } },
          vertexShader: VS3,
          transparent: true,
          depthWrite: false,
          premultipliedAlpha: true,
          fragmentShader:
            'varying vec2 vUv; uniform sampler2D uD; uniform vec2 tx;\nfloat hh(vec2 u){ vec4 d = texture2D(uD, u); return d.b * .7 + d.a * .3; }\n' +
            'void main(){ vec4 d = texture2D(uD, vUv); float body = d.b * .68 + d.a * .32;' +
            ' float hx = hh(vUv + vec2(tx.x * 3., 0.)) - hh(vUv - vec2(tx.x * 3., 0.)), hy = hh(vUv + vec2(0., tx.y * 3.)) - hh(vUv - vec2(0., tx.y * 3.));' +
            ' float lit = smoothstep(.16, .8, body) + (hx * .5 - hy * .8) * 1.3;' +
            ' vec3 col = mix(vec3(.6, .63, .68), vec3(1., .995, .98), clamp(lit, 0., 1.)); col = mix(col, vec3(.86, .87, .9), .4 * (1. - smoothstep(0., .6, d.r)));' +
            ' float a = smoothstep(.03, .92, d.r * (.42 + 1.3 * body)); gl_FragColor = vec4(col * a, a); }',
        });
      } else {
        /* ♿ no half-float targets: the same fog and the same rings, one shader, no fluid */
        mat = softFog(soft);
      }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(c.W, c.H), mat);
      m.position.z = 0.02;
      c.scene.add(m);
      /* the logo, hanging in the fog */
      const lc = canvas(256, 256);
      const lx = ctx2d(lc);
      lx.shadowColor = 'rgba(120,130,150,.9)';
      lx.shadowBlur = 14;
      stamp(lx, c.logo, 128, 128, 200, '#ffffff', 0.95);
      mark = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: texOf(lc), transparent: true, opacity: 0, depthWrite: false }));
      mark.position.set(0, 0.35, 0.04);
      c.scene.add(mark);
    },
    opened(_wx, _wy, x, y) {
      tap.set(x * c.HW, y * c.HH);
      if (fluid) (fluid.U.uTap!.value as THREE.Vector2).set(x * c.HW, y * c.HH);
    },
    grab: (_id, _w, x, y) => pointer('down', x, y),
    drag: (_id, _w, x, y) => pointer('move', x, y),
    release: (_id, x, y) => pointer('up', x, y),
    step(_dt, t, tau) {
      if (fluid) {
        fluid.out = tau > 0.6;
        fluid.step(t, tau);
        mat.uniforms.uD!.value = fluid.d.a.texture;
      } else {
        soft.uTau.value = tau;
        soft.uT.value = t;
      }
      mark.material.opacity = tau < 0 ? 0.62 + 0.08 * Math.sin(t * 0.8) : Math.max(0, 0.62 - tau * 0.45);
      mark.scale.setScalar(1 + Math.max(0, tau) * 0.08);
    },
    dispose() {
      fluid?.dispose();
    },
  };
};

/** The fog without a fluid: billows from noise, opened by the same two rings from the tap. */
function softFog(u: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: VS3,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    fragmentShader:
      'varying vec2 vUv; uniform float uTau, uT; uniform vec2 uTap, uWH;\n' +
      NOISE +
      '\nvoid main(){ vec2 q = (vUv - .5) * uWH; float body = fbm(q * 1.1 + vec2(0., uT * .04)) * .68 + fbm(q * 3.4 + vec2(uT * .05, 4.)) * .32;' +
      ' float ll = length(q - uTap) + (fbm(q * 2.2 + uT * .1) - .5) * .5; float r1 = 1.75 * max(uTau, 0.);' +
      ' float open = uTau < 0. ? 0. : smoothstep(r1 + .2, r1 - .9, ll); float fade = uTau < 0. ? 0. : smoothstep(2.6, 3.4, uTau);' +
      ' float dens = (1. - open) * (1. - fade);' +
      ' vec3 col = mix(vec3(.6, .63, .68), vec3(1., .995, .98), smoothstep(.16, .8, body));' +
      ' float a = smoothstep(.03, .92, dens * (.42 + 1.3 * body)); gl_FragColor = vec4(col * a, a); }',
  });
}

/** 6 · SCRATCH — rub the gold away. Nothing opens until 60 % of it is gone. */
export const scratch = (): Scene => {
  const MW = 300;
  const MH = 520;
  let c: Ctx;
  let mask: HTMLCanvasElement;
  let mx: CanvasRenderingContext2D;
  let maskTex: THREE.Texture;
  let sx: CanvasRenderingContext2D;
  let sweep: THREE.PointLight;
  const flakes: Array<{ o: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; life: number }> = [];
  let fi = 0;
  let pct = 0;
  let last: [number, number] | null = null;
  let auto = -1;
  const flake = (wx: number, wy: number, vx: number, vy: number) => {
    const b = flakes[fi++ % flakes.length]!;
    const R = c.rand;
    b.o.visible = true;
    b.o.position.set(wx, wy, 0.08 + R() * 0.2);
    b.v.set(vx + (R() - 0.5) * 1.6, vy + R() * 1.4, R() * 1.2);
    b.w.set(R() * 14, R() * 14, R() * 10);
    b.life = 1.6;
  };
  /* mask pixels; a rough coin edge, not a clean brush */
  const rub = (x0: number, y0: number, x1: number, y1: number) => {
    const R = c.rand;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
    mx.fillStyle = '#000';
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const x = x0 + (x1 - x0) * k;
      const y = y0 + (y1 - y0) * k;
      for (let j = 0; j < 5; j++) {
        const a = R() * 6.283;
        const d = R() * 13;
        mx.beginPath();
        mx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 9 + R() * 7, 0, 7);
        mx.fill();
      }
    }
    maskTex.needsUpdate = true;
    if (R() < 0.8) flake((x1 / MW - 0.5) * c.W, (0.5 - y1 / MH) * c.H, (x1 - x0) * 0.05, -(y1 - y0) * 0.05);
    sx.drawImage(mask, 0, 0, 30, 52);
    const d8 = sx.getImageData(0, 0, 30, 52).data;
    let n0 = 0;
    for (let i = 0; i < d8.length; i += 4) if (d8[i]! < 128) n0++;
    pct = n0 / (30 * 52);
    c.progress(pct);
    if (pct >= SCRATCH_OPENS_AT) c.open(0, 0);
  };
  const pointer = (kind: 'down' | 'move' | 'up', x: number, y: number) => {
    if (c.state() !== 'closed') return;
    auto = -1;
    const px = (x * 0.5 + 0.5) * MW;
    const py = (0.5 - y * 0.5) * MH;
    if (kind === 'down') {
      last = [px, py];
      rub(px, py, px, py);
    } else if (kind === 'move' && last) {
      rub(last[0], last[1], px, py);
      last = [px, py];
    } else if (kind === 'up') last = null;
  };
  return {
    legacyT: 1.9,
    noTap: true,
    async init(cx) {
      c = cx;
      solidLights(c, { amb: 0.5, key: 0.34, back: 0, kx: -2, ky: 3, kz: 5 });
      const face = canvas(MW * 2, MH * 2);
      const fx = ctx2d(face);
      const foil = await c.art('foil');
      fx.drawImage(foil, 0, 0, face.width, face.height);
      fx.strokeStyle = 'rgba(70,48,14,.42)';
      fx.lineWidth = 2;
      fx.strokeRect(34, 34, face.width - 68, face.height - 68);
      fx.strokeRect(42, 42, face.width - 84, face.height - 84);
      fx.fillStyle = 'rgba(60,40,10,.62)';
      fx.textAlign = 'center';
      fx.font = 'italic 54px Georgia, serif';
      fx.fillText('Scratch to open', face.width / 2, face.height / 2 - 6);
      fx.font = '600 22px Georgia, serif';
      fx.fillText(c.names.toUpperCase().split('').join(' '), face.width / 2, face.height / 2 + 44, face.width - 120);
      /* the logo, stamped into the foil */
      stamp(fx, c.logo, face.width / 2 + 2, face.height / 2 - 208, 230, 'rgba(255,240,200,1)', 0.35);
      stamp(fx, c.logo, face.width / 2, face.height / 2 - 210, 230, 'rgba(60,40,10,1)', 0.62);
      const faceTex = texOf(face);
      mask = canvas(MW, MH);
      mx = ctx2d(mask);
      mx.fillStyle = '#fff';
      mx.fillRect(0, 0, MW, MH);
      maskTex = texOf(mask);
      const small = canvas(30, 52);
      sx = small.getContext('2d', { willReadFrequently: true })!;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(c.W, c.H),
        new THREE.MeshPhongMaterial({ map: faceTex, color: 0xe6c47c, alphaMap: maskTex, alphaTest: 0.5, shininess: 60, specular: 0x6a5630, bumpMap: faceTex, bumpScale: 0.012 * BUMP }),
      );
      m.position.z = 0.02;
      c.scene.add(m);
      sweep = new THREE.PointLight(0xfff0c8, 0.4 * Math.PI, 7, 0);
      c.scene.add(sweep);
      /* the curls of foil that come off under the coin, and fall */
      const fm = new THREE.MeshPhongMaterial({ color: 0xd6b060, side: THREE.DoubleSide, shininess: 70, specular: 0xfff0c0 });
      for (let i = 0; i < 90; i++) {
        const q = new THREE.Mesh(new THREE.PlaneGeometry(0.05 + c.rand() * 0.07, 0.025 + c.rand() * 0.04), fm);
        q.visible = false;
        c.scene.add(q);
        flakes.push({ o: q, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0 });
      }
    },
    grab: (_id, _w, x, y) => pointer('down', x, y),
    drag: (_id, _w, x, y) => pointer('move', x, y),
    release: (_id, x, y) => pointer('up', x, y),
    /* a hand scratching, for a hands-free preview */
    demo() {
      auto = 0;
      last = null;
    },
    step(dt, t, tau) {
      if (auto >= 0 && tau < 0) {
        for (let i = 0; i < 2; i++) {
          auto += dt / 2 / 3.4;
          const u = auto;
          const px = (0.5 + 0.44 * Math.sin(u * Math.PI * 11) + 0.02 * Math.sin(u * 90)) * MW;
          const py = (0.05 + 0.9 * u) * MH;
          if (last) rub(last[0], last[1], px, py);
          last = [px, py];
          if (c.state() !== 'closed') break;
        }
      }
      if (tau >= 0 && tau < 1.0) {
        /* past 60 %: what is left lets go in flakes */
        const n = 30 + Math.floor(tau * tau * 520);
        mx.fillStyle = '#000';
        for (let i = 0; i < n; i++) {
          const x = c.rand() * MW;
          const y = c.rand() * MH;
          const r = 2 + (3 + tau * 7) * c.rand();
          mx.beginPath();
          mx.arc(x, y, r, 0, 7);
          mx.arc(x + r * 1.1, y + r * 0.5, r * 0.7, 0, 7);
          mx.fill();
          if (i < 3) flake((x / MW - 0.5) * c.W, (0.5 - y / MH) * c.H, 0, 0);
        }
        if (tau > 0.92) mx.fillRect(0, 0, MW, MH);
        maskTex.needsUpdate = true;
      }
      for (const b of flakes) {
        if (b.life <= 0) continue;
        b.life -= dt;
        b.v.y -= 9.5 * dt;
        b.v.x += Math.sin(t * 9 + b.o.id) * 2.2 * dt;
        b.o.position.addScaledVector(b.v, dt);
        b.o.rotation.x += b.w.x * dt;
        b.o.rotation.y += b.w.y * dt;
        b.o.rotation.z += b.w.z * dt;
        if (b.life <= 0) b.o.visible = false;
      }
      sweep.position.set(Math.sin(t * 0.7) * 1.6, Math.cos(t * 0.5) * 2.2, 1.5);
    },
  };
};
