/* Setnayan reveals, round 3. ONE stage and ONE set of motion rules for every reveal: the shipped veil's.
   Sources on origin/main: apps/web/lib/veil-cloth.ts (solver) · app/[slug]/_components/reveal/veil-reveal.tsx (loop, lift, touch)
   · lib/reveal-config-pure.ts DEFAULT_VEIL_LOOK (the owner-locked numbers). Camera, lights and numbers are copied, not re-tuned. */
(function () {
  'use strict';
  var FOV = 45, CAMZ = 4.4, FZ = 0.6;
  var OLD = window.RV || {};
  var RV = window.RV = { reveals: {}, order: [], FZ: FZ, CAMZ: CAMZ };
  ['W', 'H', 'HW', 'HH', 'ease', 'easeIn', 'easeOut', 'noise', 'Cloth', 'Strip', 'reseed'].forEach(function (k) { RV[k] = OLD[k]; });
  var R = RV.rules = {
    FEATHER: 12.0,       /* a tap opens hands-free over 12 seconds (the page offers 9 · 12 · 16). The shipped veil is 5; the owner asked, 23 Nov, for "very slow dramatic" */
    PUSH: 0.36,          /* while it opens the camera travels slowly toward and past the reveal: 36% of the way in */
    LIFT_K: 0.05,        /* every frame the motion closes 5% of what is left: slow start, long soft landing */
    DONE: 0.985,         /* the cover is "revealed" only when the motion is 98.5% through */
    TAP_MS: 300, TAP_PX: 18, SWIPE_PX: 40, SWIPE_MS: 460,
    WEIGHT: 26, BOUNCE: 83, FLOAT: 100, TRAIL: 100, WIND: 48, FULL: 100, FOLDS: 16, REACH: 10, LIFTPK: 70, HOLD: 22, STRETCH: 15, VALANCE: 30,
    COMP: 0.16, TENB: 0.42, CLAMP: 1.012, RELAX: 6, CLAMPS: 4
  };
  /* EVERY REVEAL HAS ITS OWN LOOK (owner, 23 Nov: "they should all be customizable. and can pick from the different
     options, styles"). A reveal declares its options; the host picks; the reveal reads them when it is built. */
  RV.OPTIONS = {}; RV.opts = {};
  RV.options = function (name, list) { RV.OPTIONS[name] = list; var o = RV.opts[name] = RV.opts[name] || {}; list.forEach(function (it) { if (o[it.key] == null) o[it.key] = it.choices[0][0]; }); };
  RV.opt = function (name, key) { return RV.opts[name] ? RV.opts[name][key] : undefined; };
  var ss = RV.ss = function (a, b, x) { x = (x - a) / (b - a); return x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x); };
  RV.clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var seed = 7; RV.rand = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  var renderer, scene, camera, canvas, cur = null, curName = '', t = 0, raf = 0, pending = 0, onReady = [], texCache = {};
  var lift = 0, target = 0, auto = false, autoT = 0, locked = false, feather = 0, state = 'closed', grabs = {};

  RV.tex = function (name, repeat) {
    var key = name + (repeat ? 'r' : ''); if (texCache[key]) return texCache[key]; pending++;
    var tx = new THREE.TextureLoader().load(window.TEX[name], function () { pending--; flush(); }); tx.anisotropy = 4;
    if (repeat) tx.wrapS = tx.wrapT = THREE.RepeatWrapping; return (texCache[key] = tx);
  };
  function flush() { if (pending <= 0) { var q = onReady; onReady = []; q.forEach(function (f) { f(); }); } }
  RV.whenReady = function (f) { if (pending <= 0) f(); else onReady.push(f); };
  RV.hold = function () { pending++; }; RV.unhold = function () { pending--; flush(); };
  /* the event's own logo (here: the cale-ice monogram), as a white shape with alpha, ready to stamp into any texture */
  var LOGO = null, logoQ = [];
  RV.logo = function (cb) { if (LOGO) return cb(LOGO); logoQ.push(cb); if (logoQ.length > 1) return; RV.hold(); var im = new Image(); im.onload = function () { var k = document.createElement('canvas'); k.width = k.height = 256; var x = k.getContext('2d'); x.drawImage(im, 0, 0, 256, 256); var d = x.getImageData(0, 0, 256, 256), p = d.data; for (var i = 0; i < p.length; i += 4) { p[i + 3] = p[i]; p[i] = p[i + 1] = p[i + 2] = 255; } x.putImageData(d, 0, 0); LOGO = k; var q = logoQ; logoQ = []; q.forEach(function (f) { f(k); }); RV.unhold(); }; im.src = window.TEX.mono; };
  RV.stamp = function (ctx, logo, x, y, size, color, alpha) { var k = document.createElement('canvas'); k.width = k.height = 256; var kx = k.getContext('2d'); kx.fillStyle = color; kx.fillRect(0, 0, 256, 256); kx.globalCompositeOperation = 'destination-in'; kx.drawImage(logo, 0, 0); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.drawImage(k, x - size / 2, y - size / 2, size, size); ctx.globalAlpha = 1; };

  /* the veil's own three lights */
  RV.lights = function (k) {
    if (k && typeof k === 'object') { var o = k; scene.add(new THREE.AmbientLight(0xfff4e6, o.amb == null ? 0.62 : o.amb));
      var kl = new THREE.DirectionalLight(0xffffff, o.key == null ? 0.75 : o.key); kl.position.set(o.kx == null ? -2.2 : o.kx, o.ky == null ? 3.4 : o.ky, o.kz == null ? 6 : o.kz); kl.castShadow = true; kl.shadow.mapSize.set(1024, 1024);
      var sc = kl.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 4; sc.bottom = -4; sc.near = 1; sc.far = 20; kl.shadow.bias = -0.0015; kl.shadow.radius = 4; scene.add(kl);
      if (o.back !== 0) { var bl = new THREE.DirectionalLight(0xffe2b8, o.back || 0.35); bl.position.set(1.5, 1, -4); scene.add(bl); } return kl; }
    k = k == null ? 1 : k;
    scene.add(new THREE.HemisphereLight(0xfff6e8, 0x1c1610, 0.55 * k));
    var key = new THREE.SpotLight(0xfff3e0, 2.2 * k, 40, Math.PI / 5, 0.7, 1.0); key.position.set(2.8, 3.6, 4.4); scene.add(key); scene.add(key.target);
    var rim = new THREE.DirectionalLight(0xfff0d8, 0.5 * k); rim.position.set(-3, 0.4, 2.0); scene.add(rim);
    return key;
  };
  /* a light that throws real shadows, and a plane that shows only the shadows (the cover is HTML behind the canvas) */
  RV.shadows = function (opacity, z) {
    var l = new THREE.DirectionalLight(0xffffff, 0.001); l.position.set(-1.6, 2.6, 5); l.castShadow = true; l.shadow.mapSize.set(1024, 1024);
    var c = l.shadow.camera; c.left = -2.4; c.right = 2.4; c.top = 2.6; c.bottom = -2.6; c.near = 1; c.far = 14; l.shadow.bias = -0.002; l.shadow.radius = 5; scene.add(l);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: opacity == null ? 0.3 : opacity })); m.position.z = z == null ? FZ - 0.3 : z; m.receiveShadow = true; scene.add(m);
  };

  RV.shadowPlane = function (z, opacity) { var m = new THREE.Mesh(new THREE.PlaneGeometry(RV.W * 2, RV.H * 2), new THREE.ShadowMaterial({ opacity: opacity == null ? 0.32 : opacity })); m.position.z = z == null ? -0.02 : z; m.receiveShadow = true; scene.add(m); return m; };
  /* the solid reveals were written on a clock of their own. Here that clock is driven by the veil's lift, so each one
     starts slowly, takes its time and lands softly, exactly like the veil: tau = lift x its length. */
  function wrap(d) {
    var T = (d.T || 3.4) / 0.97;
    return { label: d.label, legacy: true, noTap: !!d.canOpen, fadeMs: d.fadeMs, pbr: d.pbr, ownCam: d.ownCam, exposure: d.exposure, render: d.render ? function (r, sc, c) { this.o.render(r, sc, c); } : null,
      init: function () { camera.fov = 30; camera.position.set(0, 0, RV.H / 2 / Math.tan(15 * Math.PI / 180)); camera.updateProjectionMatrix(); this.o = Object.create(d); this.o.init(RV); this.ptau = 0; this.lp = [0, 0]; },
      opened: function (wx, wy, nx, ny) { this.o.tap = [nx, ny]; if (this.o.open) this.o.open(nx, ny); },
      grab: function (id, w, nx, ny) { this.lp = [nx, ny]; if (this.o.pointer) this.o.pointer('down', nx, ny); },
      drag: function (id, w, nx, ny) { this.lp = [nx, ny]; if (this.o.pointer) this.o.pointer('move', nx, ny); },
      release: function () { if (this.o.pointer) this.o.pointer('up', this.lp[0], this.lp[1]); },
      demo: d.demo ? function () { this.o.demo(); } : null,
      step: function (dt, t, lift) { if (state === 'closed') { this.o.step(dt, t, -1); return; } var tau = lift * T, d2 = Math.max(0, tau - this.ptau); this.ptau = tau; this.o.step(d2, t, tau); },
      dispose: function () { if (this.o.dispose) this.o.dispose(); } };
  }
  RV.register = function (name, def) { if (def.done) def = wrap(def); RV.reveals[name] = def; if (RV.order.indexOf(name) < 0) RV.order.push(name); };
  RV.mount = function (cv) {
    canvas = cv; renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, premultipliedAlpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(cv.clientWidth, cv.clientHeight, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.localClippingEnabled = true;
    camera = new THREE.PerspectiveCamera(FOV, cv.clientWidth / cv.clientHeight, 0.1, 100); camera.position.set(0, 0, CAMZ);
    RV.renderer = renderer; RV.camera = camera; RV.vh = (CAMZ - FZ) * Math.tan(FOV * Math.PI / 360); RV.vw = RV.vh * (cv.clientWidth / cv.clientHeight);
  };
  RV.select = function (name) {
    cancelAnimationFrame(raf); seed = 7 + RV.order.indexOf(name) * 13; if (cur && cur.dispose) cur.dispose();
    scene = RV.scene = new THREE.Scene(); camera.position.set(0, 0, CAMZ); camera.rotation.set(0, 0, 0); camera.fov = FOV; camera.updateProjectionMatrix();
    cur = Object.create(RV.reveals[name]); curName = name; t = 0; lift = 0; target = 0; auto = false; locked = false; feather = 0; state = 'closed'; grabs = {};
    canvas.style.transitionDuration = '0ms'; canvas.style.opacity = 1; renderer.outputEncoding = (cur.srgb || cur.pbr) ? THREE.sRGBEncoding : THREE.LinearEncoding; renderer.toneMapping = cur.pbr ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; renderer.toneMappingExposure = cur.exposure || 1; cur.init(RV); cur._z0 = camera.position.z; canvas.style.transitionDuration = (cur.fadeMs || 700) + 'ms'; RV.onstate && RV.onstate('closed', name);
    if (!RV.manual) RV.whenReady(function () { raf = requestAnimationFrame(loop); });
  };
  function startAuto() { auto = true; autoT = 0; locked = true; }
  RV.setLift = function (v) { auto = false; target = v; locked = v > 0.3; };
  function opened(wx, wy, nx, ny) { if (state === 'closed') { state = 'opening'; cur.tapW = [wx, wy]; cur.opened && cur.opened(wx, wy, nx || 0, ny || 0); RV.onstate && RV.onstate('opening', curName); } }
  RV.tapOpen = function (nx, ny) {
    if (cur.noTap) return; if (!locked && target < 1) { nx = nx == null ? 0 : nx; ny = ny == null ? 0.1 : ny; var w = world(nx, ny, FZ); opened(w.x, w.y, nx, ny); startAuto(); }
  };
  RV.play = function () { if (state !== 'closed') return; if (cur.demo) cur.demo(); else RV.tapOpen(0, 0.1); };
  RV.open = function (nx, ny) { if (state !== 'closed') return; opened(0, 0, nx || 0, ny || 0); startAuto(); };   /* scratch calls this at 60% */
  var ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  function world(nx, ny, z) { ray.setFromCamera(new THREE.Vector2(nx, ny), camera); plane.constant = -z; ray.ray.intersectPlane(plane, hit); return { x: hit.x, y: hit.y }; }
  RV.world = world;
  /* touch, exactly as the veil reads it: a quick tap opens by itself; a quick swipe the way it opens throws it open;
     the other way closes it again; anything else is a hold, and letting go lets the thing fall back on its own */
  RV.down = function (id, nx, ny) { grabs[id] = { t0: t, x0: nx, y0: ny }; if (cur.grab) cur.grab(id, world(nx, ny, FZ), nx, ny); };
  RV.move = function (id, nx, ny) { if (grabs[id] && cur.drag) cur.drag(id, world(nx, ny, cur.dragZ == null ? FZ : cur.dragZ), nx, ny); };
  RV.up = function (id, nx, ny) {
    var g = grabs[id]; if (!g) return; delete grabs[id];
    var W = canvas.clientWidth / 2, H = canvas.clientHeight / 2, dx = (nx - g.x0) * W, dy = (ny - g.y0) * H, dur = (t - g.t0) * 1000, net = Math.hypot(dx, dy);
    var d = cur.dir || [0, 1], along = dx * d[0] + dy * d[1], across = Math.abs(dx * d[1] - dy * d[0]);
    if (cur.release) cur.release(id);
    if (cur.noTap) return;
    if (along > R.SWIPE_PX && dur < R.SWIPE_MS && along > across) { var w = world(nx, ny, FZ); opened(w.x, w.y, nx, ny); RV.setLift(1); return; }
    if (-along > R.SWIPE_PX && dur < R.SWIPE_MS && -along > across) { if (state !== 'open') RV.setLift(0); return; }
    if (dur < R.TAP_MS && net < R.TAP_PX) RV.tapOpen(nx, ny);
  };
  function tick() {
    var dt = 1 / 60; t += dt;
    if (auto) { autoT += dt / R.FEATHER; var p = Math.min(1, autoT); target = 0.55 * p + 0.45 * ss(0.05, 0.95, p);   /* steadier than the veil's own curve: the owner's references move at an even, unhurried pace from the first moment */ if (p > 0.3) feather = Math.round(R.FEATHER * 34); if (autoT >= 1) { auto = false; target = 1; } }
    if (feather > 0) feather--;
    lift += (target - lift) * R.LIFT_K;
    cur.step(dt, t, lift, feather > 0);
    if (!cur.ownCam) camera.position.z = cur._z0 * (1 - (cur.push == null ? R.PUSH : cur.push) * ss(0.02, 1, lift));     /* the slow push-in, the same for every reveal */
    if (RV.onlift) RV.onlift(lift, curName);
    if (lift > R.DONE && state !== 'open') { state = 'open'; if (!cur.stay) canvas.style.opacity = 0; RV.onstate && RV.onstate('open', curName); }   /* the veil stays: it hangs as a fold at the top */
  }
  function draw() { if (cur && cur.render) cur.render(renderer, scene, camera); else renderer.render(scene, camera); }
  function loop() { if (!RV.paused) { tick(); draw(); } raf = requestAnimationFrame(loop); }
  RV.setSpeed = function (sec) { R.FEATHER = sec; };
  RV.lift = function () { return lift; }; RV.state = function () { return state; }; RV.time = function () { return t; };
  /* stills: run the clock by hand. script = [[seconds, fn], ...] run in order */
  RV.seek = function (name, script) {
    RV.manual = true; RV.select(name);
    RV.whenReady(function () {
      script.forEach(function (s) { if (s[1]) s[1](); for (var i = 0; i < Math.round(s[0] * 60); i++) tick(); });
      canvas.style.transition = 'none'; draw(); document.title = 'ready';
    });
  };
  /* a strip of frames in one run: after the script, n frames, `every` ticks apart, are copied onto a sheet canvas */
  RV.seekFrames = function (name, script, n, every, sheet, cols) {
    RV.manual = true; RV.select(name);
    RV.whenReady(function () {
      script.forEach(function (s) { if (s[1]) s[1](); for (var i = 0; i < Math.round(s[0] * 60); i++) tick(); });
      var x = sheet.getContext('2d'), w = canvas.clientWidth, h = canvas.clientHeight; canvas.style.transition = 'none';
      for (var k = 0; k < n; k++) { for (var i = 0; i < every; i++) tick(); draw(); x.drawImage(canvas, (k % cols) * w, Math.floor(k / cols) * h, w, h); }
      document.title = 'ready';
    });
  };
})();
