/* The reveals made of air and fire. Smoke and flame here are a real fluid: a small grid of moving air solved every
   frame on the graphics chip (advect, swirl, pressure), so the smoke curls, lifts and thins the way smoke does and
   answers the finger. Scratch is a real mask you rub away; it opens only once 60% is gone. */
(function () {
  'use strict';
  var RV = window.RV, W = RV.W, H = RV.H, HW = RV.HW, HH = RV.HH;

  var VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  var VS3 = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
  var NOISE = [
    'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }',
    'float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= .5; } return s; }',
    'float burnD(vec2 q, vec2 tq){ return length(q - tq) + (fbm(q * 1.7 + 3.) - .47) * .9 + (fbm(q * 7.) - .47) * .16; }'
  ].join('\n');
  var HEAD = 'varying vec2 vUv; uniform vec2 px; uniform float dt, uT, uTau, uR; uniform vec2 uTap; uniform vec4 uPush;\n' + NOISE + '\n';

  /* ---------------- the fluid ---------------- */
  function Fluid(o) {
    var r = this.r = RV.renderer, nx = o.nx || 96, ny = o.ny || 166, ds = o.dye || 2, self = this;
    function rt(w, h) { return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false }); }
    function pair(w, h) { return { a: rt(w, h), b: rt(w, h), swap: function () { var t = this.a; this.a = this.b; this.b = t; } }; }
    this.v = pair(nx, ny); this.d = pair(nx * ds, ny * ds); this.p = pair(nx, ny); this.div = rt(nx, ny); this.curl = rt(nx, ny);
    this.all = [this.v.a, this.v.b, this.d.a, this.d.b, this.p.a, this.p.b, this.div, this.curl];
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.scene = new THREE.Scene(); this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.scene.add(this.quad);
    var U = this.U = { px: { value: new THREE.Vector2(1 / nx, 1 / ny) }, dt: { value: 1 / 60 }, uT: { value: 0 }, uTau: { value: -1 }, uR: { value: -1 }, uTap: { value: new THREE.Vector2(0, 0) }, uPush: { value: new THREE.Vector4(.5, .5, 0, 0) } };
    function mat(frag, extra) { var u = {}; for (var k in U) u[k] = U[k]; for (k in extra) u[k] = extra[k]; return new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: HEAD + frag, depthTest: false, depthWrite: false }); }
    this.mAdv = mat('uniform sampler2D uV, uQ; uniform vec4 diss; uniform float uOut; void main(){ vec2 c = vUv - dt * texture2D(uV, vUv).xy * px; vec4 r = diss * texture2D(uQ, c); if (uOut > .5 && (c.x < 0. || c.x > 1. || c.y < 0. || c.y > 1.)) r = vec4(0.); gl_FragColor = r; }', { uV: { value: null }, uQ: { value: null }, diss: { value: new THREE.Vector4(1, 1, 1, 1) }, uOut: { value: 0 } });
    this.mCurl = mat('uniform sampler2D uV; void main(){ float L = texture2D(uV, vUv - vec2(px.x, 0.)).y, R = texture2D(uV, vUv + vec2(px.x, 0.)).y, B = texture2D(uV, vUv - vec2(0., px.y)).x, T = texture2D(uV, vUv + vec2(0., px.y)).x; gl_FragColor = vec4(R - L - T + B, 0., 0., 1.); }', { uV: { value: null } });
    this.mForce = mat('uniform sampler2D uV, uC, uD; uniform float uConf;\nvoid main(){ vec2 v = texture2D(uV, vUv).xy;' +
      ' float L = texture2D(uC, vUv - vec2(px.x, 0.)).x, R = texture2D(uC, vUv + vec2(px.x, 0.)).x, B = texture2D(uC, vUv - vec2(0., px.y)).x, T = texture2D(uC, vUv + vec2(0., px.y)).x, C = texture2D(uC, vUv).x;' +
      ' vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 1e-4; f *= uConf * C; f.y *= -1.; v += f * dt;' +
      ' vec4 d = texture2D(uD, vUv); vec2 q = (vUv - .5) * vec2(3., 5.2); vec2 tq = uTap;' +
      ' vec2 pq = (uPush.xy - .5) * vec2(3., 5.2); v += uPush.zw * exp(-dot(q - pq, q - pq) / .1);\n' + o.force + '\n gl_FragColor = vec4(v, 0., 1.); }', { uV: { value: null }, uC: { value: null }, uD: { value: null }, uConf: { value: o.conf == null ? 18 : o.conf } });
    this.mDiv = mat('uniform sampler2D uV; void main(){ float L = texture2D(uV, vUv - vec2(px.x, 0.)).x, R = texture2D(uV, vUv + vec2(px.x, 0.)).x, B = texture2D(uV, vUv - vec2(0., px.y)).y, T = texture2D(uV, vUv + vec2(0., px.y)).y; vec2 q = (vUv - .5) * vec2(3., 5.2); vec2 tq = uTap; float S = 0.;\n' + (o.div || '') + '\n gl_FragColor = vec4(.5 * (R - L + T - B) - S, 0., 0., 1.); }', { uV: { value: null } });
    this.mPres = mat('uniform sampler2D uP, uDv; float P(vec2 u){ return (u.x < 0. || u.x > 1. || u.y < 0. || u.y > 1.) ? 0. : texture2D(uP, u).x; } void main(){ float L = P(vUv - vec2(px.x, 0.)), R = P(vUv + vec2(px.x, 0.)), B = P(vUv - vec2(0., px.y)), T = P(vUv + vec2(0., px.y)); gl_FragColor = vec4((L + R + B + T - texture2D(uDv, vUv).x) * .25, 0., 0., 1.); }', { uP: { value: null }, uDv: { value: null } });
    this.mGrad = mat('uniform sampler2D uP, uV; void main(){ float L = texture2D(uP, vUv - vec2(px.x, 0.)).x, R = texture2D(uP, vUv + vec2(px.x, 0.)).x, B = texture2D(uP, vUv - vec2(0., px.y)).x, T = texture2D(uP, vUv + vec2(0., px.y)).x; vec2 v = texture2D(uV, vUv).xy - .5 * vec2(R - L, T - B); gl_FragColor = vec4(v, 0., 1.); }', { uP: { value: null }, uV: { value: null } });
    this.mSrc = mat('uniform sampler2D uD; uniform vec2 tx;\nvoid main(){ vec4 d = texture2D(uD, vUv); vec2 q = (vUv - .5) * vec2(3., 5.2); vec2 tq = uTap;\n' + o.source + '\n gl_FragColor = d; }', { uD: { value: null }, tx: { value: new THREE.Vector2(1 / (nx * ds), 1 / (ny * ds)) } });
    this.vdiss = o.vdiss == null ? .995 : o.vdiss; this.ddiss = o.ddiss || [1, 1, 1, 1]; this.iters = o.iters || 14;
    r.setClearColor(0x000000, 0); this.all.forEach(function (t) { r.setRenderTarget(t); r.clear(); }); r.setRenderTarget(null);
  }
  Fluid.prototype.pass = function (m, target) { this.quad.material = m; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); };
  Fluid.prototype.source = function () { this.mSrc.uniforms.uD.value = this.d.a.texture; this.pass(this.mSrc, this.d.b); this.d.swap(); this.r.setRenderTarget(null); };
  Fluid.prototype.step = function (t, tau) {
    var v = this.v, d = this.d, p = this.p, u; this.U.uT.value = t; this.U.uTau.value = tau;
    u = this.mAdv.uniforms; u.uV.value = v.a.texture; u.uQ.value = v.a.texture; u.uOut.value = 0; u.diss.value.set(this.vdiss, this.vdiss, 1, 1); this.pass(this.mAdv, v.b); v.swap();
    this.mCurl.uniforms.uV.value = v.a.texture; this.pass(this.mCurl, this.curl);
    u = this.mForce.uniforms; u.uV.value = v.a.texture; u.uC.value = this.curl.texture; u.uD.value = d.a.texture; this.pass(this.mForce, v.b); v.swap();
    this.mDiv.uniforms.uV.value = v.a.texture; this.pass(this.mDiv, this.div);
    u = this.mPres.uniforms; u.uDv.value = this.div.texture; for (var i = 0; i < this.iters; i++) { u.uP.value = p.a.texture; this.pass(this.mPres, p.b); p.swap(); }
    u = this.mGrad.uniforms; u.uP.value = p.a.texture; u.uV.value = v.a.texture; this.pass(this.mGrad, v.b); v.swap();
    u = this.mAdv.uniforms; u.uV.value = v.a.texture; u.uQ.value = d.a.texture; u.uOut.value = this.out ? 1 : 0; u.diss.value.fromArray(this.ddiss); this.pass(this.mAdv, d.b); d.swap();
    this.source(); this.U.uPush.value.z *= .6; this.U.uPush.value.w *= .6;
  };
  Fluid.prototype.push = function (x, y, dx, dy) { this.U.uPush.value.set(x * .5 + .5, y * .5 + .5, dx, dy); };
  Fluid.prototype.dispose = function () { this.all.forEach(function (t) { t.dispose(); }); };
  function drag(self, kind, x, y) {                              /* a finger moving through the air pushes it */
    if (kind === 'move' && self.last) self.fluid.push(x, y, (x - self.last[0]) * 2600, (y - self.last[1]) * 4500);
    self.last = kind === 'up' ? null : [x, y];
  }

  /* ---------- 7 · Smoke: it fills the screen; a tap is a puff of clean air; it is pushed aside, curls, lifts and thins ---------- */
  var PUFF = ' float l2 = dot(q - tq, q - tq); float ll = sqrt(l2); float r1 = 1.75 * uTau; float r2 = 1.75 * (uTau - .75); S = uTau < 0. ? 0. : 3.4 * exp(-(ll - r1) * (ll - r1) / .05) + (r2 > 0. ? 2. * exp(-(ll - r2) * (ll - r2) / .05) : 0.) + 2. * exp(-l2 / .05) * (1. - smoothstep(.2, .9, uTau));';
  RV.options('smoke', [{ key: 'tint', label: 'Smoke colour', choices: [['white', 'White'], ['blush', 'Blush'], ['gold', 'Gold'], ['twilight', 'Twilight']] }]);
  RV.register('smoke', {
    label: 'Smoke', T: 3.4,
    init: function () {
      var f = this.fluid = new Fluid({
        conf: 16, vdiss: .99, ddiss: [1, 1, 1, 1], iters: 24, div: PUFF,
        force: [
          ' float calm = uTau < 0. ? 1. : 1.;',
          ' v += dt * 6. * calm * vec2(sin(q.y * 1.7 + uT * .22) + .6 * sin(q.y * 3.3 - uT * .17 + q.x * 1.3), .5 * cos(q.x * 2.1 - uT * .2) + .3 * cos(q.x * 3.9 + uT * .13 + q.y * 1.1) - .35);',
          ' if (uTau >= 0.) { v += dt * 14. * (vec2(vn(q * 2.4 + uT * .3), vn(q * 2.4 - uT * .3 + 9.)) - .5) * d.r; }'
        ].join('\n'),
        source: [
          ' float n = fbm(q * 1.1 + vec2(0., uT * .04)), n2 = fbm(q * 3.4 + vec2(uT * .05, 4.));',
          ' if (uTau < 0.) { d.r += (1. - d.r) * .08; d.b += (n - d.b) * .02; d.a += (n2 - d.a) * .03; }',
          ' else { float S = 0.;' + PUFF + ' d.r *= exp(-S * dt * 1.1);',
          '  float nb = (texture2D(uD, vUv + vec2(tx.x * 2.5, 0.)).r + texture2D(uD, vUv - vec2(tx.x * 2.5, 0.)).r + texture2D(uD, vUv + vec2(0., tx.y * 2.5)).r + texture2D(uD, vUv - vec2(0., tx.y * 2.5)).r) * .25; d.r = mix(d.r, nb, .5);',
          '  d.r *= 1. - dt * .5 * smoothstep(r1, r1 - .9, ll); d.r *= mix(1., .985, smoothstep(2.6, 3.3, uTau)); }'
        ].join('\n')
      });
      for (var i = 0; i < 90; i++) f.source();
      var SM = { white: [[.6, .63, .68], [1, .995, .98], [.86, .87, .9]], blush: [[.74, .54, .58], [1, .93, .93], [.94, .8, .83]], gold: [[.68, .55, .32], [1, .95, .8], [.92, .83, .62]], twilight: [[.36, .38, .6], [.86, .88, 1], [.64, .66, .86]] }[RV.opt('smoke', 'tint')];   /* shadow, light, haze */
      this.mat = new THREE.ShaderMaterial({
        uniforms: { uD: { value: null }, tx: { value: new THREE.Vector2(1 / 192, 1 / 332) }, cS: { value: new THREE.Vector3().fromArray(SM[0]) }, cL: { value: new THREE.Vector3().fromArray(SM[1]) }, cH: { value: new THREE.Vector3().fromArray(SM[2]) } }, vertexShader: VS3, transparent: true, depthWrite: false, premultipliedAlpha: true,
        fragmentShader: 'varying vec2 vUv; uniform sampler2D uD; uniform vec2 tx; uniform vec3 cS; uniform vec3 cL; uniform vec3 cH;\nfloat hh(vec2 u){ vec4 d = texture2D(uD, u); return d.b * .7 + d.a * .3; }\n' +
          'void main(){ vec4 d = texture2D(uD, vUv); float body = d.b * .68 + d.a * .32;' +
          ' float hx = hh(vUv + vec2(tx.x * 3., 0.)) - hh(vUv - vec2(tx.x * 3., 0.)), hy = hh(vUv + vec2(0., tx.y * 3.)) - hh(vUv - vec2(0., tx.y * 3.));' +
          ' float lit = smoothstep(.16, .8, body) + (hx * .5 - hy * .8) * 1.3;' +                                  /* thick billows catch the light, the folds between them fall grey */
          ' vec3 col = mix(cS, cL, clamp(lit, 0., 1.)); col = mix(col, cH, .4 * (1. - smoothstep(0., .6, d.r)));' +
          ' float a = smoothstep(.03, .92, d.r * (.42 + 1.3 * body)); gl_FragColor = vec4(col * a, a); }'
      });
      var m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.mat); m.position.z = .02; RV.scene.add(m);
      var lc = document.createElement('canvas'); lc.width = lc.height = 256; var lx = lc.getContext('2d'), ltx = new THREE.CanvasTexture(lc), self = this;        /* the logo, hanging in the fog */
      this.mark = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: ltx, transparent: true, opacity: .0, depthWrite: false })); this.mark.position.set(0, .35, .04); RV.scene.add(this.mark);
      RV.logo(function (l) { lx.shadowColor = 'rgba(120,130,150,.9)'; lx.shadowBlur = 14; RV.stamp(lx, l, 128, 128, 200, '#ffffff', .95); ltx.needsUpdate = true; });
    },
    open: function (x, y) { this.fluid.U.uTap.value.set(x * HW, y * HH); },
    pointer: function (kind, x, y) { drag(this, kind, x, y); },
    step: function (dt, t, tau) { this.fluid.out = tau > .6; this.fluid.step(t, tau); this.mat.uniforms.uD.value = this.fluid.d.a.texture; this.mark.material.opacity = tau < 0 ? .62 + .08 * Math.sin(t * .8) : Math.max(0, .62 - tau * .45); this.mark.scale.setScalar(1 + Math.max(0, tau) * .08); },
    done: function (tau) { return tau > 3.4; },
    dispose: function () { this.fluid.dispose(); }
  });

  /* ---------- 8 · Paper burn: the fire starts under the finger and eats outward; real flame, real smoke ---------- */
  RV.register('burn', {
    label: 'Paper burn',
    init: function () {
      var self = this, s = RV.scene; this.R = -1;
      var f = this.fluid = new Fluid({
        conf: 30, vdiss: .985, ddiss: [.988, .9, 1, 1],
        force: [
          ' v.y += dt * (330. * d.g + 26. * d.r);',
          ' v.x += dt * 70. * d.g * (sin(q.y * 6. + uT * 5.) + sin(q.y * 11. - uT * 7.3 + q.x * 4.));'
        ].join('\n'),
        source: [
          ' float e = uR - burnD(q, tq); float band = smoothstep(-.03, .02, e) * (1. - smoothstep(.06, .16, e));',
          ' float fl = .45 + .55 * fbm(q * 8. + vec2(0., -uT * 3.5)); if (uR > 0.) { d.g += band * fl * .36; d.r += band * .085; }'
        ].join('\n')
      });
      this.paper = new THREE.ShaderMaterial({
        uniforms: { map: { value: RV.tex('parch') }, uTap: f.U.uTap, uR: f.U.uR, uT: f.U.uT }, vertexShader: VS3, transparent: true, depthWrite: false,
        fragmentShader: 'varying vec2 vUv; uniform sampler2D map; uniform vec2 uTap; uniform float uR, uT;\n' + NOISE + '\n' +
          'void main(){ vec2 q = (vUv - .5) * vec2(3., 5.2); float e = uR - burnD(q, uTap); vec3 c = texture2D(map, vUv).rgb;' +
          ' float heat = smoothstep(-.55, 0., e); c = mix(c, c * vec3(.42, .27, .15), heat * .9);' +                       /* the paper browns ahead of the fire */
          ' float ch = smoothstep(-.04, .04, e); c = mix(c, vec3(.035, .028, .022), ch);' +                               /* then chars */
          ' float em = smoothstep(-.01, .035, e) * (1. - smoothstep(.06, .15, e)); c += vec3(1., .36, .05) * em * (.6 + .4 * vn(q * 34. + uT * 7.)) * 1.7;' + /* and glows at the edge */
          ' float a = 1. - smoothstep(.09, .16, e + (vn(q * 42.) - .5) * .06); gl_FragColor = vec4(c, a); }'
      });
      var pm = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.paper); pm.position.z = 0; s.add(pm);
      this.fire = new THREE.ShaderMaterial({
        uniforms: { uD: { value: null } }, vertexShader: VS3, transparent: true, depthWrite: false, premultipliedAlpha: true,
        fragmentShader: 'varying vec2 vUv; uniform sampler2D uD;\nvoid main(){ vec4 d = texture2D(uD, vUv); float T = d.g;' +
          ' vec3 flame = vec3(.9, .2, .03) * smoothstep(.04, .3, T) + vec3(1., .55, .08) * smoothstep(.22, .7, T) + vec3(1., .85, .45) * smoothstep(.6, 1.3, T) + vec3(.6) * smoothstep(1.2, 2.2, T);' +
          ' float aS = smoothstep(.03, .8, d.r) * .72; float fa = clamp(T * 1.5, 0., 1.);' +
          ' gl_FragColor = vec4(vec3(.3, .285, .275) * aS * (1. - fa) + flame, clamp(aS * (1. - fa) + fa * .8, 0., 1.)); }'
      });
      var fm = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.fire); fm.position.z = .03; s.add(fm);
      /* sparks thrown up from the burning edge */
      this.N = 46; this.sp = new Float32Array(this.N * 3); this.sv = new Float32Array(this.N * 3); this.life = new Float32Array(this.N);
      for (var i = 0; i < this.N; i++) this.sp[i * 3 + 2] = -50;
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.sp, 3));
      this.sparks = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffb040, size: .035, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.sparks.frustumCulled = false; s.add(this.sparks);
      this.tapW = [0, 0]; this.end = 9; f.out = true;
    },
    open: function (x, y) {
      var tx = x * HW, ty = y * HH, far = 0; this.tapW = [tx, ty]; this.fluid.U.uTap.value.set(tx, ty);
      [[-HW, -HH], [HW, -HH], [HW, HH], [-HW, HH]].forEach(function (c) { far = Math.max(far, Math.hypot(c[0] - tx, c[1] - ty)); }); this.far = far + .75;
    },
    pointer: function (kind, x, y) { drag(this, kind, x, y); },
    radius: function (tau) { return .22 + .42 * tau + .5 * tau * tau; },
    step: function (dt, t, tau) {
      var R = tau < 0 ? -1 : this.radius(tau); this.fluid.U.uR.value = R; if (tau >= 0 && R > this.far && this.end > 8) this.end = tau;
      this.fluid.step(t, tau); this.fire.uniforms.uD.value = this.fluid.d.a.texture;
      for (var i = 0; i < this.N; i++) {
        var k = i * 3;
        if (this.life[i] <= 0) { if (tau >= 0 && R < this.far && RV.rand() < .12) { var a = RV.rand() * 6.283, rr = R - .05; this.sp[k] = this.tapW[0] + Math.cos(a) * rr; this.sp[k + 1] = this.tapW[1] + Math.sin(a) * rr; this.sp[k + 2] = .06; this.sv[k] = (RV.rand() - .5) * 1.2; this.sv[k + 1] = 1 + RV.rand() * 2.2; this.life[i] = .5 + RV.rand() * .7; } else this.sp[k + 2] = -50; continue; }
        this.life[i] -= dt; this.sv[k] += (RV.rand() - .5) * 9 * dt; this.sv[k + 1] += 1.4 * dt; this.sp[k] += this.sv[k] * dt; this.sp[k + 1] += this.sv[k + 1] * dt;
      }
      this.sparks.geometry.attributes.position.needsUpdate = true;
    },
    done: function (tau) { return tau > this.end + 1.0; },
    dispose: function () { this.fluid.dispose(); }
  });

  /* ---------- 6 · Scratch: rub the gold away. Nothing opens until 60% of it is gone ---------- */
  var MW = 300, MH = 520;
  RV.options('scratch', [{ key: 'foil', label: 'Foil colour', choices: [['gold', 'Gold'], ['silver', 'Silver'], ['rose', 'Rose gold'], ['emerald', 'Emerald'], ['midnight', 'Midnight']] }]);
  RV.register('scratch', {
    label: 'Scratch', T: 1.9,
    init: function () {
      var s = RV.scene, self = this; RV.lights({ amb: .5, key: .34, back: 0, kx: -2, ky: 3, kz: 5 });
      var fo = RV.opt('scratch', 'foil'), FT = { gold: null, silver: '#c4c8cf', rose: '#dba392', emerald: '#2c8a66', midnight: '#30417a' }[fo], fdark = fo === 'emerald' || fo === 'midnight', ink = fdark ? '255,240,206' : '60,40,10', inkHi = fdark ? '0,0,0' : '255,240,200';
      var face = document.createElement('canvas'); face.width = MW * 2; face.height = MH * 2; var fx = face.getContext('2d'), faceTex = new THREE.CanvasTexture(face);
      function paint(img) {
        if (img) fx.drawImage(img, 0, 0, face.width, face.height); else { fx.fillStyle = '#c9a45a'; fx.fillRect(0, 0, face.width, face.height); }
        if (FT) { fx.globalCompositeOperation = 'color'; fx.fillStyle = FT; fx.fillRect(0, 0, face.width, face.height); if (fdark) { fx.globalCompositeOperation = 'multiply'; fx.globalAlpha = .5; fx.fillRect(0, 0, face.width, face.height); fx.globalAlpha = 1; } fx.globalCompositeOperation = 'source-over'; }
        fx.strokeStyle = 'rgba(' + ink + ',.42)'; fx.lineWidth = 2; fx.strokeRect(34, 34, face.width - 68, face.height - 68); fx.strokeRect(42, 42, face.width - 84, face.height - 84);
        fx.fillStyle = 'rgba(' + ink + ',.66)'; fx.textAlign = 'center'; fx.font = 'italic 54px Georgia, serif'; fx.fillText('Scratch to open', face.width / 2, face.height / 2 - 6);
        fx.font = '600 22px Georgia, serif'; fx.fillText('I N D A L E C I O   &   C L A I R E', face.width / 2, face.height / 2 + 44); faceTex.needsUpdate = true;
        RV.logo(function (l) { RV.stamp(fx, l, face.width / 2 + 2, face.height / 2 - 208, 230, 'rgba(' + inkHi + ',1)', .35); RV.stamp(fx, l, face.width / 2, face.height / 2 - 210, 230, 'rgba(' + ink + ',1)', .66); faceTex.needsUpdate = true; });   /* the logo, stamped into the foil */
      }
      paint(null); var img = new Image(); RV.hold(); img.onload = function () { paint(img); RV.unhold(); }; img.src = window.TEX.foil;
      var mask = this.mask = document.createElement('canvas'); mask.width = MW; mask.height = MH; var mx = this.mx = mask.getContext('2d'); mx.fillStyle = '#fff'; mx.fillRect(0, 0, MW, MH);
      this.maskTex = new THREE.CanvasTexture(mask);
      var small = this.small = document.createElement('canvas'); small.width = 30; small.height = 52; this.sx = small.getContext('2d');
      var mat = new THREE.MeshPhongMaterial({ map: faceTex, color: FT ? 0xf4f4f4 : 0xe6c47c, alphaMap: this.maskTex, alphaTest: .5, shininess: 60, specular: 0x6a5630, bumpMap: faceTex, bumpScale: .012 });
      var m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat); m.position.z = .02; s.add(m);
      this.sweep = new THREE.PointLight(0xfff0c8, .4, 7); s.add(this.sweep);
      /* the curls of foil that come off under the coin, and fall */
      var fm = new THREE.MeshPhongMaterial({ color: FT ? new THREE.Color(FT) : new THREE.Color(0xd6b060), side: THREE.DoubleSide, shininess: 70, specular: 0xfff0c0 }); this.flakes = [];
      for (var i = 0; i < 90; i++) { var q = new THREE.Mesh(new THREE.PlaneGeometry(.05 + RV.rand() * .07, .025 + RV.rand() * .04), fm); q.visible = false; s.add(q); var b = { o: q, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0 }; this.flakes.push(b); }
      this.fi = 0; this.pct = 0; this.last = null; this.auto = -1;
    },
    flake: function (wx, wy, vx, vy) {
      var b = this.flakes[this.fi++ % this.flakes.length]; b.o.visible = true; b.o.position.set(wx, wy, .08 + RV.rand() * .2); b.v.set(vx + (RV.rand() - .5) * 1.6, vy + RV.rand() * 1.4, RV.rand() * 1.2); b.w.set(RV.rand() * 14, RV.rand() * 14, RV.rand() * 10); b.life = 1.6;
    },
    rub: function (x0, y0, x1, y1) {                           /* mask pixels; a rough coin edge, not a clean brush */
      var mx = this.mx, n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6)), i; mx.fillStyle = '#000';
      for (i = 0; i <= n; i++) { var k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k; for (var j = 0; j < 5; j++) { var a = RV.rand() * 6.283, d = RV.rand() * 13; mx.beginPath(); mx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 9 + RV.rand() * 7, 0, 7); mx.fill(); } }
      this.maskTex.needsUpdate = true;
      if (RV.rand() < .8) this.flake((x1 / MW - .5) * W, (.5 - y1 / MH) * H, (x1 - x0) * .05, -(y1 - y0) * .05);
      this.sx.drawImage(this.mask, 0, 0, 30, 52); var d8 = this.sx.getImageData(0, 0, 30, 52).data, c = 0; for (i = 0; i < d8.length; i += 4) if (d8[i] < 128) c++;
      this.pct = c / (30 * 52); RV.onprogress && RV.onprogress(this.pct);
      if (this.pct >= .6) RV.open(0, 0);
    },
    canOpen: function () { return this.pct >= .6; },
    pointer: function (kind, x, y) {
      if (RV.state() !== 'closed') return; this.auto = -1; var px = (x * .5 + .5) * MW, py = (.5 - y * .5) * MH;
      if (kind === 'down') { this.last = [px, py]; this.rub(px, py, px, py); } else if (kind === 'move' && this.last) { this.rub(this.last[0], this.last[1], px, py); this.last = [px, py]; } else if (kind === 'up') this.last = null;
    },
    demo: function () { this.auto = 0; this.last = null; },      /* a hand scratching, for the walkthrough */
    step: function (dt, t, tau) {
      var self = this, i;
      if (this.auto >= 0 && tau < 0) {
        for (i = 0; i < 2; i++) { this.auto += dt / 2 / 3.4; var u = this.auto, px = (.5 + .44 * Math.sin(u * Math.PI * 11) + .02 * Math.sin(u * 90)) * MW, py = (.05 + .9 * u) * MH; if (this.last) this.rub(this.last[0], this.last[1], px, py); this.last = [px, py]; if (RV.state() !== 'closed') break; }
      }
      if (tau >= 0 && tau < 1.0) {                               /* past 60%: what is left lets go in flakes */
        var mx = this.mx, n = 30 + Math.floor(tau * tau * 520); mx.fillStyle = '#000';
        for (i = 0; i < n; i++) { var x = RV.rand() * MW, y = RV.rand() * MH, r = 2 + (3 + tau * 7) * RV.rand(); mx.beginPath(); mx.arc(x, y, r, 0, 7); mx.arc(x + r * 1.1, y + r * .5, r * .7, 0, 7); mx.fill(); if (i < 3) this.flake((x / MW - .5) * W, (.5 - y / MH) * H, 0, 0); }
        if (tau > .92) mx.fillRect(0, 0, MW, MH); this.maskTex.needsUpdate = true;
      }
      this.flakes.forEach(function (b) { if (b.life <= 0) return; b.life -= dt; b.v.y -= 9.5 * dt; b.v.x += Math.sin(t * 9 + b.o.id) * 2.2 * dt; b.o.position.addScaledVector(b.v, dt); b.o.rotation.x += b.w.x * dt; b.o.rotation.y += b.w.y * dt; b.o.rotation.z += b.w.z * dt; if (b.life <= 0) b.o.visible = false; });
      this.sweep.position.set(Math.sin(t * .7) * 1.6, Math.cos(t * .5) * 2.2, 1.5);
    },
    done: function (tau) { return tau > 1.9; }
  });
})();
