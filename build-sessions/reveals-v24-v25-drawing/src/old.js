/* Setnayan reveals, live prototype: the stage, the clock, and the two physics pieces every cloth reveal shares
   (a verlet cloth and a verlet ribbon). three.js r128. World units: the phone cover is W x H, centred on 0,0, at z = 0. */
(function () {
  'use strict';
  var W = 3, H = 5.2, HW = W / 2, HH = H / 2, CAMZ = HH / Math.tan(15 * Math.PI / 180);
  var RV = window.RV = { W: W, H: H, HW: HW, HH: HH, reveals: {}, order: [] };
  var renderer, scene, camera, canvas, cur = null, curName = '', t = 0, tOpen = -1, state = 'closed', raf = 0, pending = 0, onReady = [];
  var texCache = {};

  RV.ease = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  RV.easeIn = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * x; };
  RV.easeOut = function (x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); };
  RV.clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var seed = 7; RV.rand = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; RV.reseed = function (s) { seed = s; };
  RV.noise = function (x, y, tt) { return Math.sin(x * 1.7 + tt * 1.3) * Math.cos(y * 1.3 - tt * .9) + .5 * Math.sin(x * 3.1 - tt * 2.1 + y * 2.3); };

  RV.tex = function (name, repeat) {
    var key = name + (repeat ? 'r' : '');
    if (texCache[key]) return texCache[key];
    pending++;
    var tx = new THREE.TextureLoader().load(window.TEX[name], function () { pending--; flush(); });
    tx.anisotropy = 4; if (repeat) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; }
    return (texCache[key] = tx);
  };
  function flush() { if (pending <= 0) { var q = onReady; onReady = []; q.forEach(function (f) { f(); }); } }
  RV.whenReady = function (f) { if (pending <= 0) f(); else onReady.push(f); };
  RV.hold = function () { pending++; }; RV.unhold = function () { pending--; flush(); };

  RV.lights = function (o) {
    o = o || {};
    scene.add(new THREE.AmbientLight(o.ambient || 0xfff4e6, o.amb == null ? .62 : o.amb));
    var key = new THREE.DirectionalLight(o.keyColor || 0xffffff, o.key == null ? .75 : o.key);
    key.position.set(o.kx == null ? -2.2 : o.kx, o.ky == null ? 3.4 : o.ky, o.kz == null ? 6 : o.kz); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); var c = key.shadow.camera; c.left = -3; c.right = 3; c.top = 4; c.bottom = -4; c.near = 1; c.far = 20; key.shadow.bias = -.0015; key.shadow.radius = 4;
    scene.add(key);
    if (o.back !== 0) { var b = new THREE.DirectionalLight(o.backColor || 0xffe2b8, o.back || .35); b.position.set(1.5, 1, -4); scene.add(b); }
    return key;
  };
  /* a plane that shows ONLY the shadows falling on it: real shadows over the HTML cover behind the canvas */
  RV.shadowPlane = function (z, opacity) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, H * 2), new THREE.ShadowMaterial({ opacity: opacity == null ? .32 : opacity }));
    m.position.z = z == null ? -.02 : z; m.receiveShadow = true; scene.add(m); return m;
  };

  /* ---------------- verlet cloth ---------------- */
  RV.Cloth = function (o) {
    var cols = o.cols, rows = o.rows, n = cols * rows, i, j, k;
    var p = this.p = new Float32Array(n * 3), q = this.q = new Float32Array(n * 3), inv = this.inv = new Float32Array(n);
    this.cols = cols; this.rows = rows; this.n = n; this.damp = o.damp == null ? .985 : o.damp; this.iters = o.iters || 6; this.zmin = o.zmin == null ? -1e9 : o.zmin;
    var slack = o.slack || 1, dxr = o.w * slack / (cols - 1), dxh = o.w / (cols - 1), dy = o.h / (rows - 1), dz = Math.sqrt(Math.max(0, dxr * dxr - dxh * dxh));
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      k = (j * cols + i) * 3;
      p[k] = o.x0 + i * dxh; p[k + 1] = o.y0 - j * dy; p[k + 2] = (o.z0 || 0) + dz * .5 * Math.sin(i * Math.PI / 2 + (o.phase || 0)) * (0.6 + 0.4 * Math.cos(j * .21));
      q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2]; inv[j * cols + i] = 1;
    }
    var A = [], B = [], R = [], S = [];
    function link(a, b, rest, stiff) { A.push(a); B.push(b); R.push(rest); S.push(stiff); }
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      var a = j * cols + i;
      if (i < cols - 1) link(a, a + 1, dxr, 1);
      if (j < rows - 1) link(a, a + cols, dy, 1);
      if (i < cols - 1 && j < rows - 1) { link(a, a + cols + 1, Math.hypot(dxr, dy), .6); link(a + 1, a + cols, Math.hypot(dxr, dy), .6); }
      if (i < cols - 2) link(a, a + 2, dxr * 2, o.bend == null ? .18 : o.bend);
      if (j < rows - 2) link(a, a + cols * 2, dy * 2, o.bend == null ? .18 : o.bend);
    }
    this.A = new Int32Array(A); this.B = new Int32Array(B); this.R = new Float32Array(R); this.S = new Float32Array(S);
    this.pins = [];
    var geo = this.geo = new THREE.BufferGeometry(), uv = new Float32Array(n * 2), idx = [];
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) { var u = i / (cols - 1); uv[(j * cols + i) * 2] = o.flipU ? 1 - u : u; uv[(j * cols + i) * 2 + 1] = 1 - j / (rows - 1); }
    for (j = 0; j < rows - 1; j++) for (i = 0; i < cols - 1; i++) { a = j * cols + i; idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1); }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, o.material); this.mesh.castShadow = o.shadow !== false; this.mesh.frustumCulled = false;
  };
  RV.Cloth.prototype.pin = function (i, j) { var k = j * this.cols + i; this.inv[k] = 0; var pin = { k: k, x: this.p[k * 3], y: this.p[k * 3 + 1], z: this.p[k * 3 + 2], x0: this.p[k * 3], y0: this.p[k * 3 + 1], z0: this.p[k * 3 + 2], i: i, j: j, on: true }; this.pins.push(pin); return pin; };
  RV.Cloth.prototype.release = function (pin) { pin.on = false; this.inv[pin.k] = 1; };
  RV.Cloth.prototype.step = function (dt, gx, gy, gz, wind) {
    var p = this.p, q = this.q, inv = this.inv, n = this.n, d = this.damp, k, i, vx, vy, vz, dt2 = dt * dt;
    for (i = 0; i < n; i++) {
      if (!inv[i]) continue; k = i * 3;
      vx = (p[k] - q[k]) * d; vy = (p[k + 1] - q[k + 1]) * d; vz = (p[k + 2] - q[k + 2]) * d;
      q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2];
      var w = wind ? wind(p[k], p[k + 1], i) : null;
      p[k] += vx + (gx + (w ? w[0] : 0)) * dt2; p[k + 1] += vy + (gy + (w ? w[1] : 0)) * dt2; p[k + 2] += vz + (gz + (w ? w[2] : 0)) * dt2;
    }
    var A = this.A, B = this.B, R = this.R, S = this.S, m = A.length, it, a, b, dx, dy, dz, len, f, wa, wb, ws;
    for (it = 0; it < this.iters; it++) {
      for (i = 0; i < this.pins.length; i++) { var pn = this.pins[i]; if (pn.on) { k = pn.k * 3; p[k] = pn.x; p[k + 1] = pn.y; p[k + 2] = pn.z; } }
      for (i = 0; i < m; i++) {
        a = A[i]; b = B[i]; wa = inv[a]; wb = inv[b]; ws = wa + wb; if (!ws) continue;
        var ka = a * 3, kb = b * 3; dx = p[kb] - p[ka]; dy = p[kb + 1] - p[ka + 1]; dz = p[kb + 2] - p[ka + 2];
        len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6; f = (len - R[i]) / len * S[i] / ws;
        p[ka] += dx * f * wa; p[ka + 1] += dy * f * wa; p[ka + 2] += dz * f * wa; p[kb] -= dx * f * wb; p[kb + 1] -= dy * f * wb; p[kb + 2] -= dz * f * wb;
      }
    }
    if (this.zmin > -1e8) for (i = 0; i < n; i++) if (p[i * 3 + 2] < this.zmin) p[i * 3 + 2] = this.zmin;
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
  };

  /* ---------------- verlet ribbon: a chain drawn as a flat satin strip ---------------- */
  RV.Strip = function (pts, width, material) {
    var n = this.n = pts.length, i; this.p = new Float32Array(n * 3); this.q = new Float32Array(n * 3); this.inv = new Float32Array(n); this.rest = new Float32Array(n - 1); this.width = width; this.pin = {};
    for (i = 0; i < n; i++) { this.p[i * 3] = this.q[i * 3] = pts[i][0]; this.p[i * 3 + 1] = this.q[i * 3 + 1] = pts[i][1]; this.p[i * 3 + 2] = this.q[i * 3 + 2] = pts[i][2] || 0; this.inv[i] = 1; }
    for (i = 0; i < n - 1; i++) this.rest[i] = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], (pts[i + 1][2] || 0) - (pts[i][2] || 0));
    var geo = this.geo = new THREE.BufferGeometry(); this.v = new Float32Array(n * 6); var uv = new Float32Array(n * 4), idx = [];
    for (i = 0; i < n; i++) { uv[i * 4] = 0; uv[i * 4 + 1] = i / (n - 1); uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i / (n - 1); if (i < n - 1) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    geo.setAttribute('position', new THREE.BufferAttribute(this.v, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, material); this.mesh.castShadow = true; this.mesh.frustumCulled = false; this.twist = 0; this.tw = .35; this.damp = .985;
    this.shape = Float32Array.from(this.p); this.stiff = 0; this.shrink = 1; this.anchor = [pts[0][0], pts[0][1], pts[0][2] || 0];
    this.sync();
  };
  RV.Strip.prototype.hold = function (i, x, y, z) { this.inv[i] = 0; this.pin[i] = [x, y, z || 0]; };
  RV.Strip.prototype.free = function (i) { this.inv[i] = 1; delete this.pin[i]; };
  RV.Strip.prototype.step = function (dt, gx, gy, gz, tt) {
    var p = this.p, q = this.q, n = this.n, i, k, dt2 = dt * dt, d = this.damp;
    for (i = 0; i < n; i++) { if (!this.inv[i]) continue; k = i * 3; var vx = (p[k] - q[k]) * d, vy = (p[k + 1] - q[k + 1]) * d, vz = (p[k + 2] - q[k + 2]) * d; q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2];
      var fl = tt == null ? 0 : RV.noise(p[k] * 2, p[k + 1] * 2 + i, tt * 2) * 1.2 * (this.fl == null ? 1 : this.fl);
      p[k] += vx + (gx + fl) * dt2; p[k + 1] += vy + gy * dt2; p[k + 2] += vz + (gz + fl * .6) * dt2; }
    if (this.stiff > 0) { var sh = this.shape, an = this.anchor, sk = this.shrink, st = this.stiff; for (i = 0; i < n; i++) { if (!this.inv[i]) continue; k = i * 3; for (var c = 0; c < 3; c++) { var target = an[c] + (sh[k + c] - an[c]) * sk; p[k + c] += (target - p[k + c]) * st; } } }
    for (var it = 0; it < 8; it++) {
      for (var key in this.pin) { k = key * 3; p[k] = this.pin[key][0]; p[k + 1] = this.pin[key][1]; p[k + 2] = this.pin[key][2]; }
      for (i = 0; i < n - 1; i++) { var a = i * 3, b = a + 3, dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, wa = this.inv[i], wb = this.inv[i + 1], ws = wa + wb; if (!ws) continue;
        var f = (len - this.rest[i]) / len / ws; p[a] += dx * f * wa; p[a + 1] += dy * f * wa; p[a + 2] += dz * f * wa; p[b] -= dx * f * wb; p[b + 1] -= dy * f * wb; p[b + 2] -= dz * f * wb; }
    }
    this.sync();
  };
  RV.Strip.prototype.sync = function () {
    var p = this.p, v = this.v, n = this.n, hw = this.width / 2, i;
    for (i = 0; i < n; i++) {
      var a = Math.max(0, i - 1) * 3, b = Math.min(n - 1, i + 1) * 3, tx = p[b] - p[a], ty = p[b + 1] - p[a + 1], l = Math.hypot(tx, ty) || 1e-6, nx = -ty / l, ny = tx / l, tw = Math.sin(i * .9 + this.twist) * hw * this.tw, k = i * 3;
      v[i * 6] = p[k] + nx * hw; v[i * 6 + 1] = p[k + 1] + ny * hw; v[i * 6 + 2] = p[k + 2] + tw;
      v[i * 6 + 3] = p[k] - nx * hw; v[i * 6 + 4] = p[k + 1] - ny * hw; v[i * 6 + 5] = p[k + 2] - tw;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
  };
  /* total rest length helpers: a loop slips through the knot as its length moves into the tail that is pulled */
  RV.Strip.prototype.scaleRest = function (base, s) { for (var i = 0; i < this.n - 1; i++) this.rest[i] = base[i] * s; };

  /* ---------------- the stage ---------------- */
  RV.register = function (name, def) { RV.reveals[name] = def; RV.order.push(name); };
  RV.mount = function (cv) {
    canvas = cv;
    renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, premultipliedAlpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(cv.clientWidth, cv.clientHeight, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.localClippingEnabled = true;
    camera = new THREE.PerspectiveCamera(30, cv.clientWidth / cv.clientHeight, .1, 60); camera.position.set(0, 0, CAMZ);
    RV.renderer = renderer; RV.camera = camera;
  };
  RV.select = function (name) {
    cancelAnimationFrame(raf); RV.reseed(7 + RV.order.indexOf(name));
    if (cur && cur.dispose) cur.dispose();
    scene = RV.scene = new THREE.Scene(); camera.position.set(0, 0, CAMZ); camera.rotation.set(0, 0, 0); camera.fov = 30; camera.updateProjectionMatrix();
    cur = Object.create(RV.reveals[name]); curName = name; t = 0; tOpen = -1; state = 'closed'; canvas.style.opacity = 1;
    cur.init(RV); RV.onstate && RV.onstate('closed', name);
    if (!RV.manual) RV.whenReady(function () { raf = requestAnimationFrame(loop); });
  };
  RV.open = function (x, y) { if (state !== 'closed') return; if (cur.canOpen && !cur.canOpen()) return; state = 'opening'; tOpen = t; cur.tap = [x == null ? 0 : x, y == null ? 0 : y]; cur.open && cur.open(cur.tap[0], cur.tap[1]); RV.onstate && RV.onstate('opening', curName); };
  RV.pointer = function (kind, x, y) { if (cur && cur.pointer) cur.pointer(kind, x, y); };
  RV.demo = function () { if (state !== 'closed') return; if (cur.demo) cur.demo(); else RV.open(0, .08); };
  function tick() {
    var dt = 1 / 60; t += dt; cur.step(dt, t, state === 'closed' ? -1 : t - tOpen);
    if (state === 'opening' && cur.done(t - tOpen)) { state = 'open'; canvas.style.opacity = 0; RV.onstate && RV.onstate('open', curName); }
  }
  function loop() { if (!RV.paused) { tick(); renderer.render(scene, camera); } raf = requestAnimationFrame(loop); }
  /* for still frames: run the clock by hand to a moment after the tap */
  RV.seek = function (name, sec, tapAt) {
    RV.manual = true; RV.select(name);
    RV.whenReady(function () {
      var warm = Math.round((tapAt == null ? .8 : tapAt) * 60), i; if (cur.demo && tapAt != null) cur.demo(); for (i = 0; i < warm; i++) tick();
      if (sec >= 0) { RV.open(0, 0); for (i = 0; i < Math.round(sec * 60); i++) tick(); }
      canvas.style.transition = 'none'; renderer.render(scene, camera); document.title = 'ready';
    });
  };
  RV.state = function () { return state; };
})();
