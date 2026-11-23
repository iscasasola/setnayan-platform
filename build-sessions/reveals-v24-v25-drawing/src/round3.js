/* Round 3: the gift box rebuilt (real wrap, real ribbon, the paper unwraps), and three new reveals to choose two from:
   a capiz window, an abaniko (lace fan) and a bed of petals. Each runs on the veil's clock (core4.js). */
(function () {
  'use strict';
  var RV = window.RV, W = RV.W, H = RV.H, HW = RV.HW, HH = RV.HH;
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function mapUV(geo, fn) { var p = geo.attributes.position, uv = geo.attributes.uv; for (var i = 0; i < p.count; i++) { var r = fn(p.getX(i), p.getY(i)); uv.setXY(i, r[0], r[1]); } uv.needsUpdate = true; }

  /* ---------- 4 · Gift box: wrapped in paper, tied with a satin ribbon. The bow unties, the ribbon slides away,
        then the paper is opened from its seam, one side after the other. ---------- */
  function paperTex() {
    var c = cv(512, 888), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 512, 888);
    g.addColorStop(0, '#245244'); g.addColorStop(.5, '#1b4034'); g.addColorStop(1, '#22503f'); x.fillStyle = g; x.fillRect(0, 0, 512, 888);
    for (var j = 0; j < 30; j++) for (var i = 0; i < 17; i++) { var px = i * 32 + (j % 2) * 16, py = j * 32 + 10; x.fillStyle = 'rgba(214,176,92,.9)'; x.beginPath(); x.arc(px, py, 2.6, 0, 7); x.fill(); x.fillStyle = 'rgba(255,240,200,.7)'; x.beginPath(); x.arc(px - 1, py - 1, 1.1, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(120,96,60,.10)'; x.lineWidth = 1; for (i = 0; i < 9; i++) { x.beginPath(); x.moveTo(RV.rand() * 512, 0); x.lineTo(RV.rand() * 512, 888); x.stroke(); }
    var pt = new THREE.CanvasTexture(c); pt.encoding = THREE.sRGBEncoding;
    RV.logo(function (l) { for (var jj = 0; jj < 8; jj++) for (var ii = 0; ii < 5; ii++) { var lx = 64 + ii * 128 - (jj % 2) * 64, ly = 58 + jj * 112; x.fillStyle = '#1e4739'; x.beginPath(); x.arc(lx, ly, 30, 0, 7); x.fill(); RV.stamp(x, l, lx, ly, 54, '#d8b464', 0.95); } pt.needsUpdate = true; });   /* the event's logo, printed in gold as part of the paper's pattern */
    return pt;
  }
  function ribbonTex() {
    var c = cv(64, 64), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, '#b9aa8a'); g.addColorStop(.06, '#d9ccb0'); g.addColorStop(.4, '#efe7d4'); g.addColorStop(.55, '#f8f2e3'); g.addColorStop(.94, '#dccfb2'); g.addColorStop(1, '#b3a482'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(120,100,60,.05)'; for (var i = 0; i < 64; i += 2) x.fillRect(0, i, 64, 1);                    /* the faintest weave: satin, not grosgrain */
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(2.5, 0, 1.2, 64); x.fillRect(60.3, 0, 1.2, 64);                  /* the woven edge */
    var t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 12); t.encoding = THREE.sRGBEncoding; return t;
  }
  function tailTex() {
    var c = cv(64, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, '#b9aa8a'); g.addColorStop(.06, '#d9ccb0'); g.addColorStop(.4, '#efe7d4'); g.addColorStop(.55, '#f8f2e3'); g.addColorStop(.94, '#dccfb2'); g.addColorStop(1, '#b3a482'); x.fillStyle = g; x.fillRect(0, 0, 64, 256);
    x.fillStyle = 'rgba(120,100,60,.05)'; for (var i = 0; i < 256; i += 2) x.fillRect(0, i, 64, 1); var tt = new THREE.CanvasTexture(c); tt.encoding = THREE.sRGBEncoding; return tt;
  }
  function notchAlpha() { var c = cv(32, 256), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 32, 256); x.fillStyle = '#000'; x.beginPath(); x.moveTo(0, 0); x.lineTo(32, 0); x.lineTo(16, 30); x.fill(); return new THREE.CanvasTexture(c); }
  /* a bow with body: two loops that stand up off the box, a wrapped knot, and tails cut in a swallowtail */
  function Bow2(kx, ky, z, sc, mat, tailMat) {
    var strips = this.strips = [], self = this; this.k = [kx, ky, z]; this.mat = mat;
    function arc(sign) { var pts = [], n = 22, i; for (i = 0; i <= n; i++) { var a = i / n * Math.PI * 2, r = .47 * sc; pts.push([kx + sign * Math.sin(a / 2) * r * 1.5, ky + Math.sin(a) * r * .5 + Math.sin(a / 2) * .06 * sc, z + .03 + Math.sin(a / 2) * .17 * sc]); } return pts; }
    function tail(sign) { var pts = [], n = 18, i; for (i = 0; i <= n; i++) pts.push([kx + sign * i * .036 * sc, ky - i * .074 * sc, z + .03 + Math.sin(i * .5) * .012]); return pts; }
    function band(sign) { var pts = [], n = 12, i; for (i = 0; i <= n; i++) pts.push([kx + sign * i * (HW + .3) / n, ky, z]); return pts; }
    ['loopL', 'loopR', 'tailL', 'tailR', 'bandL', 'bandR'].forEach(function (name) {
      var sign = name.slice(-1) === 'L' ? -1 : 1, k0 = name[0], pts = k0 === 'l' ? arc(sign) : k0 === 't' ? tail(sign) : band(sign);
      var st = new RV.Strip(pts, k0 === 'b' ? .36 : k0 === 'l' ? .23 * sc : .22 * sc, k0 === 't' ? tailMat : mat); st.name = name; st.base = Float32Array.from(st.rest); st.hold(0, kx, ky, z + (k0 === 'l' ? .04 : 0));
      if (k0 === 'l') st.hold(st.n - 1, kx, ky, z + .04); if (k0 === 'b') st.hold(st.n - 1, kx + sign * (HW + .3), ky, z);
      st.stiff = k0 === 'l' ? .5 : k0 === 't' ? .06 : 0; st.tw = k0 === 'l' ? .1 : k0 === 't' ? .1 : .03; strips.push(st); self[name] = st;
    });
    var pearl = new THREE.MeshPhysicalMaterial({ color: 0xfff6ea, roughness: .16, metalness: 0, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.4 }), kn = this.knot = new THREE.Group();          /* a pearl brooch holds the knot */
    var big = new THREE.Mesh(new THREE.SphereGeometry(.075 * sc, 18, 14), pearl); big.position.z = .05 * sc; big.castShadow = true; kn.add(big);
    for (var pi = 0; pi < 11; pi++) { var pa = pi / 11 * 6.283, sm = new THREE.Mesh(new THREE.SphereGeometry(.034 * sc, 10, 8), pearl); sm.position.set(Math.cos(pa) * .115 * sc, Math.sin(pa) * .115 * sc, .02 * sc); kn.add(sm); }
    var puck = new THREE.Mesh(new THREE.CylinderGeometry(.13 * sc, .13 * sc, .05 * sc, 20), mat); puck.rotation.x = Math.PI / 2; kn.add(puck); kn.position.set(kx, ky, z + .09);
  }
  Bow2.prototype = Object.create(RV.Bow.prototype);
  // HELD 23 Nov 2026 (owner: "gift box still need improvement so remove it until we fix it").
  // Not on the page. Needs a realism pass before it returns: materials, the ribbon ends, the lid.
  RV.register('gift', {
    label: 'Gift box', T: 5.4, pbr: true,
    init: function () {
      var s = RV.scene, self = this; RV.pbrStage(s);
      var paper = new THREE.MeshStandardMaterial({ map: paperTex(), side: THREE.DoubleSide, roughness: .55, metalness: 0, envMapIntensity: .5 });
      /* two sheets of paper meeting at a seam down the middle; the left one laps over the right */
      this.sheets = [-1, 1].map(function (side) {
        var c = new RV.Cloth({ cols: 20, rows: 34, w: HW + .16, h: H + .3, slack: 1.012, x0: side < 0 ? -HW - .08 : -.08, y0: HH + .15, z0: side < 0 ? .06 : .03, phase: side, flipU: false, material: paper, damp: .9, bend: .85, iters: 8 });
        var uv = c.geo.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setX(i, side < 0 ? uv.getX(i) * .5 : .5 + uv.getX(i) * .5);
        c.outer = []; c.inner = []; for (var j = 0; j < c.rows; j += 2) { c.outer.push(c.pin(side < 0 ? 0 : c.cols - 1, j)); c.inner.push(c.pin(side < 0 ? c.cols - 1 : 0, j)); }
        c.side = side; c.at = side < 0 ? 2.25 : 2.75; s.add(c.mesh); return c;
      });
      var rt = ribbonTex(), satin = new THREE.MeshStandardMaterial({ map: rt, side: THREE.DoubleSide, roughness: .42, metalness: 0, envMapIntensity: .7 }), tailMat = new THREE.MeshStandardMaterial({ map: tailTex(), alphaMap: notchAlpha(), alphaTest: .5, side: THREE.DoubleSide, roughness: .42, metalness: 0, envMapIntensity: .7 });
      this.vert = [1, -1].map(function (sg) { var pts = []; for (var i = 0; i <= 14; i++) pts.push([0, .3 + sg * i * (HH + .3) / 14, .16]); var st = new RV.Strip(pts, .36, satin); st.tw = .03; st.hold(0, 0, .3, .16); st.hold(14, 0, .3 + sg * (HH + .3), .16); return st; });
      this.bow = new Bow2(0, .3, .17, 1.7, satin, tailMat); s.add(this.bow.knot);
      /* every length of it is drawn as a real band: width in space, a turn in the loops, a cup across */
      this.rms = this.vert.concat(this.bow.strips).map(function (st) { var nm = st.name || '', sgn = nm.slice(-1) === 'L' ? -1 : 1, rm = new RV.RibbonMesh(st, st.width, nm[0] === 't' ? tailMat : satin, { twist: nm[0] === 'l' ? function (q) { return Math.PI * q * sgn; } : nm[0] === 't' ? function (q) { return .45 * Math.sin(q * 2.6 + sgn) * q; } : function () { return 0; } }); s.add(rm.mesh); return rm; });
    },
    step: function (dt, t, tau) {
      var self = this, FREE = 1.75;
      this.bow.step(dt, t, tau < 0 ? -1 : tau * (0.95 / FREE));              /* the untie is given 1.75 of the reveal's 5.4 */
      this.vert.forEach(function (st, k) { if (tau > FREE && !st.freed) { st.freed = true; st.free(0); st.free(14); st.tw = .3; st.q[42] += k ? -.012 : .012; } st.step(dt, 0, st.freed ? -9 : 0, 0, st.freed ? t : null); });
      this.rms.forEach(function (rm) { rm.mesh.visible = rm.s.mesh.visible !== false; rm.update(t); });
      this.sheets.forEach(function (c) {
        var p = tau < 0 ? 0 : RV.clamp((tau - c.at) / 2.4, 0, 1);
        if (p > 0) {
          /* a hand takes the seam edge, lifts it, and folds the sheet back over its own side and away */
          c.inner.forEach(function (pin, k) { var lag = RV.ease(p * 1.25 - (k / c.inner.length) * .25); pin.x = pin.x0 + c.side * lag * (HW + 1.5) * 1.15; pin.z = pin.z0 + Math.sin(Math.PI * Math.min(1, lag)) * .95; });
          if (p > .55) c.outer.forEach(function (pin) { pin.x = pin.x0 + c.side * RV.ease((p - .55) / .45) * 1.9; });
        }
        c.step(dt, 0, 0, -1.2, null);
      });
    },
    done: function (tau) { return tau > 5.4; }
  });

  /* ---------- A · Capiz window: the two sliding shell panels of an old Filipino house. They unlatch, slide apart
        on their rail with real weight, and the light comes through. ---------- */
  function capizTex(seedShift) {
    var c = cv(384, 1332), x = c.getContext('2d'), cell = 64, i, j;
    x.fillStyle = '#3b2616'; x.fillRect(0, 0, c.width, c.height);
    for (j = 0; j * cell < c.height; j++) for (i = 0; i * cell < c.width; i++) {
      var px = i * cell + 4, py = j * cell + 4, s = cell - 8, h = Math.sin((i + seedShift) * 12.9898 + j * 78.233) * 43758.5453, r = h - Math.floor(h);
      var g = x.createRadialGradient(px + s * (.3 + r * .4), py + s * (.3 + r * .3), 2, px + s / 2, py + s / 2, s * .8);
      g.addColorStop(0, 'rgba(244,236,214,1)'); g.addColorStop(.55, r > .5 ? 'rgba(214,202,172,1)' : 'rgba(200,192,170,1)'); g.addColorStop(1, 'rgba(158,146,120,1)'); x.fillStyle = g; x.fillRect(px, py, s, s);
      x.strokeStyle = 'rgba(150,138,112,.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px + s * r, py); x.lineTo(px + s * (1 - r), py + s); x.stroke();
    }
    x.strokeStyle = '#2c1b0f'; x.lineWidth = 22; x.strokeRect(11, 11, c.width - 22, c.height - 22);
    return new THREE.CanvasTexture(c);
  }
  RV.register('capiz', {
    label: 'Capiz window', T: 4.4,
    init: function () {
      var s = RV.scene; RV.lights({ amb: .36, key: .5, back: 0, kx: -2.2, ky: 3 }); RV.shadowPlane(-.05, .4);
      var self = this; this.panels = [-1, 1].map(function (side, k) {
        var tex = capizTex(k * 7), m = new THREE.Mesh(new THREE.BoxGeometry(HW + .04, H + .1, .14), [0, 1, 2, 3, 4, 5].map(function (f) { return f === 4 ? new THREE.MeshPhongMaterial({ map: tex, emissive: 0xffe9b8, emissiveMap: tex, emissiveIntensity: .0, shininess: 40, specular: 0x6a6456 }) : new THREE.MeshPhongMaterial({ color: 0x2c1b0f }); }));
        m.position.set(side * (HW / 2 + .01), 0, .07 + (side > 0 ? .0 : .15)); m.castShadow = true; s.add(m); return { m: m, side: side, x0: m.position.x, x: 0, v: 0 };
      });
      var gc = cv(64, 64), gx = gc.getContext('2d'), gr = gx.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,244,214,1)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
      this.glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, H * 1.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); this.glow.position.z = .3; s.add(this.glow);
    },
    step: function (dt, t, tau) {
      var open = 0, self = this;
      this.panels.forEach(function (P) {
        var at = P.side < 0 ? .35 : .75, STOP = HW + .1;
        if (tau >= 0) {
          /* a heavy panel on a wooden rail: it sticks, gives, runs, and knocks softly against its stop */
          var push = tau > at && P.x < STOP - .25 ? 1.5 * RV.ease((tau - at) / .8) : 0, stop = P.x > STOP - .25 ? 16 * (STOP - P.x) : 0;
          P.v += (push + stop - (P.x > STOP - .25 ? 5 : .9) * P.v) * dt; P.x += P.v * dt;
          P.m.rotation.z = tau > at - .25 && tau < at + .2 ? Math.sin(t * 38) * .004 : 0;        /* the latch rattles as it lets go */
        }
        P.m.position.x = P.x0 + P.side * P.x; open += P.x / STOP / 2;
        P.m.material[4].emissiveIntensity = .08 + .3 * RV.clamp(open * 2, 0, 1);
      });
      this.glow.material.opacity = Math.sin(Math.PI * RV.clamp(open, 0, 1)) * .5; this.glow.scale.x = .15 + open * 1.2;
    },
    done: function (tau) { return tau > 4.4; }
  });

  /* ---------- B · Abaniko: a silk hand fan, spread across the whole cover. It folds shut leaf over leaf, the way a
        fan does in the hand, and its shadow sweeps the cover. ---------- */
  function fanTex() {
    var S = 1024, c = cv(S, S / 2), x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 2);
    g.addColorStop(0, '#e9dcc4'); g.addColorStop(.55, '#f6eedf'); g.addColorStop(.9, '#f3e7d0'); g.addColorStop(1, '#d8bf8a'); x.fillStyle = g; x.fillRect(0, 0, S, S / 2);
    x.strokeStyle = 'rgba(170,132,62,.9)'; x.lineWidth = 5; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 16, Math.PI, 0); x.stroke(); x.lineWidth = 1.5; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 30, Math.PI, 0); x.stroke();
    for (var k = 0; k < 26; k++) {                                   /* painted sampaguita sprays */
      var a = Math.PI + (k + .5) / 26 * Math.PI, rr = S * (.27 + .16 * ((k * 7) % 5) / 5), px = S / 2 + Math.cos(a) * rr, py = S / 2 + Math.sin(a) * rr;
      x.strokeStyle = 'rgba(96,120,78,.75)'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 14, py - 20, px + 30, py - 16); x.stroke();
      for (var p = 0; p < 6; p++) { var pa = p / 6 * 6.283; x.fillStyle = 'rgba(255,255,255,.96)'; x.beginPath(); x.ellipse(px + Math.cos(pa) * 7, py + Math.sin(pa) * 7, 6, 3.4, pa, 0, 7); x.fill(); }
      x.fillStyle = 'rgba(214,176,84,1)'; x.beginPath(); x.arc(px, py, 2.6, 0, 7); x.fill();
    }
    return new THREE.CanvasTexture(c);
  }
  RV.register('abaniko', {
    label: 'Abaniko', T: 4.6,
    init: function () {
      var s = RV.scene, N = 18, Rf = 6.5, tex = fanTex(), self = this; RV.lights({ amb: .38, key: .55, back: 0, kx: -2.6, ky: 3.4 }); RV.shadowPlane(-.04, .42);
      this.py = -HH - .55; this.N = N; this.leaves = [];
      var wood = new THREE.MeshPhongMaterial({ color: 0x5a3a22, shininess: 30 });
      for (var i = 0; i < N; i++) {
        var a0 = -(90 / N + 1.4) * Math.PI / 180, a1 = -a0, sh = new THREE.Shape(); sh.moveTo(Math.cos(a0) * .5, Math.sin(a0) * .5); sh.absarc(0, 0, Rf, a0, a1, false); sh.lineTo(Math.cos(a1) * .5, Math.sin(a1) * .5); sh.closePath();
        var geo = new THREE.ShapeGeometry(sh, 6), th = (i + .5) / N * Math.PI;
        mapUV(geo, (function (th) { return function (x, y) { var wx = x * Math.cos(th) - y * Math.sin(th), wy = x * Math.sin(th) + y * Math.cos(th); return [.5 + wx / (2 * Rf), wy / Rf]; }; })(th));
        var silk = new THREE.MeshPhongMaterial({ map: tex, color: i % 2 ? 0xffffff : 0xe9e2d6, side: THREE.DoubleSide, shininess: 18 });
        var m = new THREE.Mesh(geo, silk); m.castShadow = true;
        var rib = new THREE.Mesh(new THREE.BoxGeometry(Rf * .98, .035, .012), wood); rib.position.set(Rf * .49, 0, -.008);
        var g = new THREE.Group(); g.add(m, rib); g.position.set(0, this.py, .05 + i * .012); g.rotation.z = th; s.add(g); this.leaves.push({ g: g, th: th });
      }
      this.c = 0; this.v = 0;
    },
    step: function (dt, t, tau) {
      /* the hand closes it: every leaf turns toward the guard stick, each a little behind the one before */
      var target = tau < 0 ? 0 : RV.clamp((tau - .2) / 3.9, 0, 1), N = this.N;
      this.v += (26 * (target - this.c) - 7 * this.v) * dt; this.c += this.v * dt;
      for (var i = 0; i < N; i++) { var L = this.leaves[i], lag = RV.clamp(this.c * 1.18 - (i / N) * .18, 0, 1); L.g.rotation.z = L.th * (1 - lag) + (i * .004); }
    },
    done: function (tau) { return tau > 4.6; }
  });

  /* ---------- C · Petals: the cover lies under sampaguita and rose petals. A tap is a breath: they lift in a ring
        from the finger, tumble and fall away. ---------- */
  function petalAlpha(style) { var c = cv(64, 64), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.beginPath();
    if (style === 'sakura') { x.moveTo(32, 61); x.bezierCurveTo(4, 46, 4, 14, 22, 4); x.lineTo(32, 13); x.lineTo(42, 4); x.bezierCurveTo(60, 14, 60, 46, 32, 61); }          /* cherry blossom: a notch at the tip */
    else if (style === 'sampaguita') { x.moveTo(32, 2); x.bezierCurveTo(50, 18, 46, 50, 32, 62); x.bezierCurveTo(18, 50, 14, 18, 32, 2); }                       /* sampaguita: small, slim, pointed */
    else { x.moveTo(32, 3); x.bezierCurveTo(62, 14, 56, 54, 32, 61); x.bezierCurveTo(8, 54, 2, 14, 32, 3); }                                                    /* rose: broad and cupped */
    x.fill(); return new THREE.CanvasTexture(c); }
  var PETAL = { white: 0xfffdf6, ivory: 0xfff3dc, blush: 0xf6cfcf, rose: 0xe88fa2, red: 0xb5202f, peach: 0xf7c3a0, lilac: 0xc9b3e6, gold: 0xe6c36a };
  var PCH = [['white', 'White'], ['ivory', 'Ivory'], ['blush', 'Blush'], ['rose', 'Rose pink'], ['red', 'Red'], ['peach', 'Peach'], ['lilac', 'Lilac'], ['gold', 'Gold']];
  RV.options('petals', [
    { key: 'style', label: 'Petal', choices: [['rose', 'Rose'], ['sampaguita', 'Sampaguita'], ['sakura', 'Cherry blossom']] },
    { key: 'c1', label: 'Colour 1', choices: PCH },
    { key: 'c2', label: 'Colour 2', choices: [PCH[2]].concat(PCH.slice(0, 2), PCH.slice(3)) }]);
  RV.register('petals', {
    label: 'Petals', T: 6.4,
    init: function () {
      var s = RV.scene, N = this.N = { rose: 1500, sakura: 2400, sampaguita: 3400 }[RV.opt('petals', 'style')], i; RV.lights({ amb: .5, key: .58, back: .1, kx: -2, ky: 3.2 }); RV.shadowPlane(-.02, .35);
      var geo = new THREE.PlaneGeometry(.4, .5, 3, 3), p = geo.attributes.position; for (i = 0; i < p.count; i++) { var x = p.getX(i), y = p.getY(i); p.setZ(i, (x * x * 1.6 + y * y * .5)); } geo.computeVertexNormals();
      var st = RV.opt('petals', 'style'), mat = new THREE.MeshPhongMaterial({ alphaMap: petalAlpha(st), alphaTest: .5, side: THREE.DoubleSide, shininess: 12 }); this.sz = st === 'sampaguita' ? .62 : st === 'sakura' ? .8 : 1;
      var im = this.im = new THREE.InstancedMesh(geo, mat, N); im.castShadow = true; im.frustumCulled = false; s.add(im);
      this.P = []; var col = new THREE.Color(), ca = new THREE.Color(PETAL[RV.opt('petals', 'c1')]), cb = new THREE.Color(PETAL[RV.opt('petals', 'c2')]), mixes = [0, .12, .5, .88, 1, .3];   /* the two colours, and the shades between them */
      for (i = 0; i < N; i++) { this.P.push({ x: (RV.rand() - .5) * (W + .5), y: (RV.rand() - .5) * (H + .5), z: .02 + i / N * .3, rx: (RV.rand() - .5) * .5, ry: (RV.rand() - .5) * .5, rz: RV.rand() * 6.283, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, live: false, ph: RV.rand() * 6.283 }); col.copy(ca).lerp(cb, mixes[i % mixes.length]); im.setColorAt(i, col); }
      this.d = new THREE.Object3D(); this.tapW = [0, 0]; this.sync();
    },
    sync: function () { var d = this.d; for (var i = 0; i < this.N; i++) { var q = this.P[i]; d.position.set(q.x, q.y, q.z); d.rotation.set(q.rx, q.ry, q.rz); d.scale.setScalar(this.sz); d.updateMatrix(); this.im.setMatrixAt(i, d.matrix); } this.im.instanceMatrix.needsUpdate = true; },
    open: function (x, y) { this.tapW = [x * HW, y * HH]; },
    step: function (dt, t, tau) {
      if (tau < 0) return; var r = 1.15 * tau, tw = this.tapW;
      for (var i = 0; i < this.N; i++) { var q = this.P[i];
        if (!q.live) { var dx = q.x - tw[0], dy = q.y - tw[1], dd = Math.hypot(dx, dy) || .01; if (dd < r) { q.live = true; var k = .3 + RV.rand() * .55; q.vx = dx / dd * k; q.vy = dy / dd * k + .45; q.vz = .7 + RV.rand() * 1.0; q.wx = (RV.rand() - .5) * 7; q.wy = (RV.rand() - .5) * 7; q.wz = (RV.rand() - .5) * 4; } else continue; }
        q.vy -= 1.15 * dt; q.vz -= .5 * dt; var dr = Math.pow(.3, dt); q.vx *= dr; q.vz *= dr; q.vy *= Math.pow(.62, dt); q.vx += Math.sin(t * 1.4 + q.ph) * 1.3 * dt;   /* light things: they drift down, they do not drop */
        q.x += q.vx * dt; q.y += q.vy * dt; q.z = Math.max(.02, q.z + q.vz * dt); q.rx += q.wx * dt; q.ry += q.wy * dt; q.rz += q.wz * dt; }
      this.sync();
    },
    done: function (tau) { return tau > 6.4; }
  });

  /* ---------- D · Fireworks: the cover waits under a night sky. A tap sends one rocket up from the finger; it bursts,
        and wherever the gold sparks fall the night melts away. Two more bursts follow, then the last of the dark
        goes in glitter. (The owner's own idea, 23 Nov: "sparkles fireworks effect … so it feels more magical".) ---------- */
  var FW = { gold: [[1, .83, .5]], rose: [[1, .66, .6]], silver: [[.88, .93, 1]], multi: [[1, .83, .5], [1, .5, .68], [.55, .8, 1]] };
  RV.options('fireworks', [
    { key: 'color', label: 'Colours', choices: [['gold', 'Gold'], ['rose', 'Rose gold'], ['silver', 'Silver white'], ['multi', 'Gold, pink and blue']] },
    { key: 'burst', label: 'Burst', choices: [['peony', 'Round'], ['willow', 'Willow'], ['ring', 'Rings'], ['heart', 'Hearts']] }]);
  RV.register('fireworks', {
    label: 'Fireworks', T: 5.0,
    init: function () {
      var s = RV.scene, MW = 300, MH = 520, i;
      var n = cv(MW, MH), x = n.getContext('2d'), g = x.createLinearGradient(0, 0, 0, MH); g.addColorStop(0, '#0b0f2a'); g.addColorStop(.6, '#151a44'); g.addColorStop(1, '#2a1f4d'); x.fillStyle = g; x.fillRect(0, 0, MW, MH);
      for (i = 0; i < 170; i++) { x.fillStyle = 'rgba(255,255,255,' + (.25 + RV.rand() * .7) + ')'; x.beginPath(); x.arc(RV.rand() * MW, RV.rand() * MH, RV.rand() * 1.1 + .2, 0, 7); x.fill(); }
      var mask = this.mask = cv(MW, MH); this.mx = mask.getContext('2d'); this.mx.fillStyle = '#fff'; this.mx.fillRect(0, 0, MW, MH); this.maskTex = new THREE.CanvasTexture(mask);
      var sky = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(n), alphaMap: this.maskTex, transparent: true, depthWrite: false })); sky.position.z = .01; s.add(sky);
      var sc = cv(64, 64), sx = sc.getContext('2d'), sg = sx.createRadialGradient(32, 32, 0, 32, 32, 32); sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(.25, 'rgba(255,255,255,.75)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 64, 64);
      var N = this.N = 900; this.P = new Float32Array(N * 3); this.V = new Float32Array(N * 3); this.L = new Float32Array(N); this.C = new Float32Array(N * 3); this.G = new Float32Array(N); for (i = 0; i < N; i++) this.P[i * 3 + 2] = -50;
      this.pal = FW[RV.opt('fireworks', 'color')]; this.kind = RV.opt('fireworks', 'burst'); this.nb = 0;
      var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.P, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.C, 3));
      this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(sc), size: .24, transparent: true, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.pts.frustumCulled = false; s.add(this.pts);
      this.k = 0; this.fired = [false, false, false]; this.tapW = [0, 0]; this.MW = MW; this.MH = MH;
    },
    open: function (x, y) { this.tapW = [x * HW, y * HH]; },
    spark: function (cx, cy, vx, vy, life, g, c) { var i = this.k++ % this.N; this.P[i * 3] = cx; this.P[i * 3 + 1] = cy; this.P[i * 3 + 2] = .1; this.V[i * 3] = vx; this.V[i * 3 + 1] = vy; this.L[i] = life; this.G[i] = g; this.C[i * 3] = c[0]; this.C[i * 3 + 1] = c[1]; this.C[i * 3 + 2] = c[2]; },
    /* one shell. Round: sparks at every speed, a full ball. Willow: slow, long-lived, heavy, so they droop in strands.
       Rings: every spark at one speed, a second ring inside. Hearts: thrown along a heart's outline. */
    burst: function (cx, cy, n, sp, small) {
      var c = this.pal[this.nb++ % this.pal.length], kind = small ? 'peony' : this.kind, j, a, v;
      if (small) this.nb--;
      for (j = 0; j < n; j++) {
        a = RV.rand() * 6.283;
        if (kind === 'ring') { v = sp * (j % 3 ? .9 : .45) * (.97 + RV.rand() * .06); this.spark(cx, cy, Math.cos(a) * v, Math.sin(a) * v + .3, 1.9 + RV.rand() * .9, 1.2, c); }
        else if (kind === 'willow') { a = Math.floor(RV.rand() * 26) / 26 * 6.283; v = sp * .8 * (.35 + .65 * ((j % 5) + 1) / 5); this.spark(cx, cy, Math.cos(a) * v, Math.sin(a) * v + .7, 2.6 + RV.rand() * 1.4, 2.3, c); }
        else if (kind === 'heart') { var hx = 16 * Math.pow(Math.sin(a), 3), hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a), k = sp * .062 * (j % 4 ? 1 : .55) * (.96 + RV.rand() * .08); this.spark(cx, cy, hx * k, hy * k + .35, 2.0 + RV.rand() * 1.0, 1.0, c); }
        else { v = sp * (.35 + RV.rand() * .65); this.spark(cx, cy, Math.cos(a) * v, Math.sin(a) * v + .5, 1.9 + RV.rand() * 1.3, 1.5, c); }
      }
    },
    step: function (dt, t, tau) {
      if (tau < 0) return; var tw = this.tapW, mx = this.mx, MW = this.MW, MH = this.MH, i;
      var at = [[.9, tw[0], Math.min(HH - .9, tw[1] + .9)], [1.9, RV.clamp(-tw[0] * .7 - .5, -1, 1), .2], [2.8, RV.clamp(tw[0] * .5 + .6, -1, 1), -1.1]];
      if (tau < at[0][0]) { var u = tau / at[0][0], rx = tw[0], ry = -HH + (at[0][2] + HH) * RV.easeOut(u); this.spark(rx + (RV.rand() - .5) * .05, ry, (RV.rand() - .5) * .3, -.6, .5, 1.5, this.pal[0]); }   /* the rocket climbs, trailing sparks */
      for (i = 0; i < 3; i++) if (!this.fired[i] && tau >= at[i][0]) { this.fired[i] = true; this.burst(at[i][1], at[i][2], this.kind === 'peony' ? 150 : 230, 2.5); }
      mx.globalCompositeOperation = 'source-over';
      for (i = 0; i < this.N; i++) { if (this.L[i] <= 0) continue; var k = i * 3; this.L[i] -= dt; this.V[k + 1] -= this.G[i] * dt; var dr = Math.pow(this.G[i] > 2 ? .42 : .32, dt); this.V[k] *= dr; this.V[k + 1] *= dr; this.P[k] += this.V[k] * dt; this.P[k + 1] += this.V[k + 1] * dt;
        if (this.L[i] <= 0) { this.P[k + 2] = -50; continue; }
        var px = (this.P[k] / W + .5) * MW, py = (.5 - this.P[k + 1] / H) * MH, r = 15 + 8 * Math.sin(i), gr = mx.createRadialGradient(px, py, 0, px, py, r);    /* each spark wipes a little of the night as it passes */
        gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); mx.fillStyle = gr; mx.fillRect(px - r, py - r, r * 2, r * 2); }
      if (tau > 3.5) { var nn = Math.floor((tau - 3.5) * 60); mx.fillStyle = 'rgba(0,0,0,.6)'; for (i = 0; i < nn; i++) { var bx = RV.rand() * MW, by = RV.rand() * MH; mx.beginPath(); mx.arc(bx, by, 5 + RV.rand() * 16, 0, 7); mx.fill(); if (i % 9 === 0) this.burst((bx / MW - .5) * W, (.5 - by / MH) * H, 3, .5, true); } if (tau > 4.7) mx.fillRect(0, 0, MW, MH); }
      this.maskTex.needsUpdate = true; this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true; this.pts.material.size = .24 + .07 * Math.sin(t * 31);
    },
    done: function (tau) { return tau > 5.0; }
  });

  /* ---------- E · Banig: a handwoven sleeping mat laid over the cover. It comes apart the way it was made: the
        cross strips are drawn out left and right, one after another, then the long strips slip down and away. ---------- */
  function stripTex() {
    var c = cv(256, 32), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 32); g.addColorStop(0, '#a98e58'); g.addColorStop(.18, '#e2cc98'); g.addColorStop(.6, '#d6bd84'); g.addColorStop(1, '#9b804c'); x.fillStyle = g; x.fillRect(0, 0, 256, 32);
    x.strokeStyle = 'rgba(110,84,40,.22)'; x.lineWidth = 1; for (var k = 0; k < 9; k++) { x.beginPath(); x.moveTo(0, 3 + k * 3.2); x.lineTo(256, 3 + k * 3.2 + (k % 2 ? 1 : -1)); x.stroke(); }
    var t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
  }
  RV.register('banig', {
    label: 'Banig', T: 5.0,
    init: function () {
      var s = RV.scene, self = this, NH = 13, NV = 8, hh = (H + .1) / NH, vw = (W + .08) / NV, tex = stripTex(), dye = [0xffffff, 0xffffff, 0xc2557f, 0xffffff, 0x5f9a68, 0xffffff, 0x7a5aa6, 0xffffff];
      RV.lights({ amb: .5, key: .62, back: 0, kx: -2.4, ky: 3.2 }); RV.shadowPlane(-.03, .42);
      function mat(i) { return new THREE.MeshPhongMaterial({ map: tex, color: dye[i % dye.length], shininess: 14, specular: 0x4a3c20 }); }
      this.hs = []; this.vs = [];
      for (var j = 0; j < NH; j++) { var g = new THREE.Group(), m = mat(j * 3 + 1), y = HH + .05 - (j + .5) * hh;
        var under = new THREE.Mesh(new THREE.BoxGeometry(W + .3, hh * .96, .012), m); under.position.z = .02; under.castShadow = true; g.add(under);
        for (var i = 0; i < NV; i++) if ((i + j) % 2 === 0) { var p = new THREE.Mesh(new THREE.BoxGeometry(vw * 1.02, hh * .96, .012), m); p.position.set(-HW - .04 + (i + .5) * vw, 0, .062); p.castShadow = true; g.add(p); }
        g.position.y = y; s.add(g); this.hs.push({ g: g, dir: j % 2 ? 1 : -1, at: .25 + j * .2, x: 0, v: 0 }); }
      for (i = 0; i < NV; i++) { var v = new THREE.Mesh(new THREE.BoxGeometry(H + .3, vw * .96, .012), mat(i * 5 + 2)); v.rotation.z = Math.PI / 2; v.position.set(-HW - .04 + (i + .5) * vw, 0, .041); v.castShadow = true; s.add(v); this.vs.push({ m: v, at: 2.2 + i * .22, y: 0, v: 0 }); }
    },
    step: function (dt, t, tau) {
      if (tau < 0) return;
      this.hs.forEach(function (S) { if (tau > S.at) { S.v += (1.1 + S.x * 1.6 - .5 * S.v) * dt; S.x += S.v * dt; S.g.position.x = S.dir * S.x; S.g.rotation.z = S.dir * Math.min(.05, S.x * .012); } });   /* drawn out, slow at first, then freely */
      this.vs.forEach(function (S) { if (tau > S.at) { S.v += (2.2 - .3 * S.v) * dt; S.y += S.v * dt; S.m.position.y = -S.y; S.m.rotation.z = Math.PI / 2 + Math.sin(S.y * 1.4 + S.at) * .02; } });          /* then the long strips slip down */
    },
    done: function (tau) { return tau > 5.0; }
  });

  /* ---------- F · Wave: the cover is under smooth beach sand. A wave runs up from the foot of the screen and draws
        back, taking the sand with it. A second, bigger wave takes the rest. ---------- */
  RV.register('wave', {
    label: 'Wave', T: 5.2,
    init: function () {
      this.u = { uTau: { value: -1 }, uT: { value: 0 } };
      var fs = [
        'varying vec2 vUv; uniform float uTau, uT;',
        'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
        'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }',
        'float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= .5; } return s; }',
        'float w1(float t){ return -3.0 + 3.9 * sin(clamp(t / 2.3, 0., 1.) * 3.14159); }',
        'float w2(float t){ return -3.0 + 6.6 * sin(clamp((t - 2.0) / 3.0, 0., 1.) * 3.14159); }',
        'void main(){ vec2 q = (vUv - .5) * vec2(3., 5.2); float t = max(uTau, 0.);',
        '  float wob = (fbm(vec2(q.x * 1.4, uT * .35)) - .5) * .7 + (fbm(vec2(q.x * 5., uT * .8 + 3.)) - .5) * .16;',
        '  float front = max(w1(t), w2(t)) + wob;',                                                              /* where the water is now */
        '  float reach = max(w1(min(t, 1.15)), t > 2. ? w2(min(t, 3.5)) : -9.) + (fbm(vec2(q.x * 1.4, 2.)) - .5) * .7;',   /* the highest it has been */
        '  vec3 sand = vec3(.86, .78, .63) * (.9 + .16 * fbm(q * 3.)) + (hash(q * 240.) - .5) * .05; sand *= .96 + .04 * sin(q.y * 26. + fbm(q * 2.) * 9.);',
        '  float wet = smoothstep(.5, 0., q.y - reach); sand *= mix(1., .8, wet * step(reach, q.y));',
        '  vec3 col = sand; float a = 1.;',
        '  if (uTau >= 0. && q.y < reach) { col = vec3(.9, .96, .95); a = .16 * smoothstep(.9, 0., reach - q.y); }',   /* the sand is gone where the water has been: a thin wet shine only */
        '  if (uTau >= 0. && q.y < front) { float d = front - q.y; float foam = smoothstep(.34, 0., d) * (.55 + .45 * fbm(vec2(q.x * 7., q.y * 7. - uT * 1.5))); foam += .25 * smoothstep(.6, 1., fbm(q * 5. + vec2(0., uT * .6))) * smoothstep(1.6, 0., d);',
        '    vec3 water = mix(vec3(.45, .82, .8), vec3(.2, .62, .68), smoothstep(0., 2.2, d)); col = mix(water, vec3(1.), clamp(foam, 0., 1.)); a = clamp(.5 + .2 * smoothstep(0., 2., d) + foam * .5, 0., 1.); }',
        '  gl_FragColor = vec4(col * a, a); }'
      ].join('\n');
      var m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }', fragmentShader: fs, transparent: true, depthWrite: false, premultipliedAlpha: true }));
      m.position.z = .02; RV.scene.add(m);
    },
    step: function (dt, t, tau) { this.u.uTau.value = tau; this.u.uT.value = t; },
    done: function (tau) { return tau > 5.2; }
  });
})();
