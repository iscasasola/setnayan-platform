/* The cloth family: one engine, three reveals. Curtains part sideways on their rings, the veil lifts (as live on
   cale-ice), the satin cover slides off once its ribbon is untied. */
(function () {
  'use strict';
  var RV = window.RV, W = RV.W, H = RV.H, HW = RV.HW, HH = RV.HH;

  function wind(strength) { return function (t) { return function (x, y, i) { var n = RV.noise(x * 1.1, y * .8, t * .9); return [n * strength * .25, 0, n * strength + Math.sin(t * 1.7 + y * 2) * strength * .4]; }; }; }

  /* ---------- 1 · Beach curtains: the veil's cloth, hung on rings, opening sideways ---------- */
  RV.register('curtains', {
    label: 'Beach curtains',
    init: function () {
      var s = RV.scene; RV.lights({ amb: .7, key: .6, back: .5, kx: -1.5 }); RV.shadowPlane(-.04, .28);
      this.panels = []; var self = this;
      [-1, 1].forEach(function (side) {
        var mat = new THREE.MeshPhongMaterial({ map: RV.tex('curtain'), side: THREE.DoubleSide, shininess: 4, transparent: true, opacity: .97 });
        var c = new RV.Cloth({ cols: 26, rows: 38, w: HW + .16, h: H + .5, slack: 1.42, x0: side < 0 ? -HW - .12 : -.04, y0: HH + .18, z0: .12, phase: side, flipU: side > 0, material: mat, damp: .982, zmin: .02 });
        c.rings = []; for (var i = 0; i < c.cols; i += 3) c.rings.push(c.pin(side < 0 ? i : c.cols - 1 - i, 0));  /* rings[0] = outer edge */
        if (!c.rings.some(function (r) { return r.i === (side < 0 ? c.cols - 1 : 0); })) c.rings.push(c.pin(side < 0 ? c.cols - 1 : 0, 0));
        c.side = side; s.add(c.mesh); self.panels.push(c);
      });
      var rod = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, W + .5, 10), new THREE.MeshPhongMaterial({ color: 0x8a6a4a, shininess: 8 })); rod.rotation.z = Math.PI / 2; rod.position.set(0, HH + .16, .1); s.add(rod);
      this.w = wind(1.3);
    },
    step: function (dt, t, tau) {
      var wf = this.w(t);
      this.panels.forEach(function (c) {
        var m = c.rings.length - 1;
        c.rings.forEach(function (r, k) {
          if (tau >= 0) {
            var gather = RV.ease((tau - (m - k) * .07) / 1.25), away = RV.easeIn((tau - 1.35) / 1.1);
            var bundle = c.side * (HW + .02 - k * .035);                     /* rings stacked at the outer edge */
            r.x = r.x0 + (bundle - r.x0) * gather + c.side * away * 1.6; r.z = r.z0 + Math.sin(k * 1.6) * .05 * gather;
          }
        });
        c.step(dt, 0, -9.5, 0, wf);
      });
    },
    done: function (tau) { return tau > 2.7; }
  });

  /* ---------- 2 · Veil: already live on cale-ice. Shown with the same engine: one tap, it lifts ---------- */
  RV.register('veil', {
    label: 'Veil',
    init: function () {
      RV.lights({ amb: .85, key: .45, back: .6 });
      var mat = new THREE.MeshPhongMaterial({ map: RV.tex('veil'), side: THREE.DoubleSide, shininess: 12, transparent: true, opacity: .9, depthWrite: false });
      var c = this.c = new RV.Cloth({ cols: 30, rows: 40, w: W + .5, h: H + .7, slack: 1.22, x0: -HW - .25, y0: HH + .25, z0: .1, material: mat, damp: .978, zmin: .02, shadow: false });
      this.pins = []; for (var i = 0; i < c.cols; i += 2) this.pins.push(c.pin(i, 0));
      RV.scene.add(c.mesh); this.w = wind(1.6);
    },
    step: function (dt, t, tau) {
      if (tau >= 0) { var lift = RV.easeIn(tau / 2.1); this.pins.forEach(function (p) { p.y = p.y0 + lift * (H + 2.2); p.x = p.x0 * (1 - .35 * RV.ease(tau / 1.6)); p.z = p.z0 + .5 * RV.ease(tau / 1.2); }); }
      this.c.step(dt, 0, tau >= 0 ? -6 : -8, tau >= 0 ? 1.2 : 0, this.w(t));
    },
    done: function (tau) { return tau > 2.6; }
  });

  /* ---------- the ribbon and its bow: loops slip through the knot as a tail is pulled, then it all lets go ---------- */
  function Bow(kx, ky, z, sc, color) {
    var mat = new THREE.MeshPhongMaterial({ color: color || 0xb88f55, side: THREE.DoubleSide, shininess: 48, specular: 0x6a5a3a });
    var strips = this.strips = [], self = this; this.k = [kx, ky, z]; this.mat = mat;
    function arc(sign) { var pts = [], n = 16, i; for (i = 0; i <= n; i++) { var a = i / n * Math.PI * 2, r = .4 * sc; pts.push([kx + sign * Math.sin(a / 2) * r * 1.5, ky + Math.sin(a) * r * .62 + Math.sin(a / 2) * .16 * sc, z + .04 + Math.sin(a / 2) * .16 * sc]); } return pts; }
    function tail(sign) { var pts = [], n = 13, i; for (i = 0; i <= n; i++) pts.push([kx + sign * i * .028 * sc, ky - i * .062 * sc, z + .03]); return pts; }
    function band(sign) { var pts = [], n = 12, i; for (i = 0; i <= n; i++) pts.push([kx + sign * i * (HW + .3) / n, ky + Math.sin(i * .6) * .01, z]); return pts; }
    ['loopL', 'loopR', 'tailL', 'tailR', 'bandL', 'bandR'].forEach(function (name) {
      var sign = name.slice(-1) === 'L' ? -1 : 1, pts = name[0] === 'l' ? arc(sign) : name[0] === 't' ? tail(sign) : band(sign);
      var st = new RV.Strip(pts, (name[0] === 'b' ? .2 : .16) * sc, mat); st.name = name; st.base = Float32Array.from(st.rest); st.hold(0, kx, ky, z + (name[0] === 'l' ? .04 : 0));
      if (name[0] === 'l') st.hold(st.n - 1, kx, ky, z + .04);
      if (name[0] === 'b') st.hold(st.n - 1, kx + sign * (HW + .3), ky, z);
      st.stiff = name[0] === 'l' ? .45 : name[0] === 't' ? .06 : 0; if (name[0] === 'b') st.tw = .06;
      strips.push(st); self[name] = st;
    });
    this.knot = new THREE.Mesh(new THREE.SphereGeometry(.085 * sc, 14, 10), mat); this.knot.scale.set(1.25, 1, .7); this.knot.position.set(kx, ky, z + .07); this.knot.castShadow = true;
  }
  Bow.prototype.addTo = function (scene) { this.strips.forEach(function (s) { scene.add(s.mesh); }); scene.add(this.knot); };
  Bow.prototype.step = function (dt, t, tau) {
    var k = this.k, self = this, free = tau > .95;
    if (tau >= 0 && !free) {
      /* a hand pulls the right tail down and out; the left loop slips through the knot and feeds it */
      var a = RV.ease(tau / .5), b = RV.ease((tau - .32) / .5);
      this.loopL.scaleRest(this.loopL.base, 1 - .94 * a); this.loopL.shrink = 1 - .94 * a; this.tailR.scaleRest(this.tailR.base, 1 + 1.5 * a); this.tailR.stiff = 0;
      this.loopR.scaleRest(this.loopR.base, 1 - .94 * b); this.loopR.shrink = 1 - .94 * b; this.tailL.scaleRest(this.tailL.base, 1 + 1.5 * b); if (tau > .32) this.tailL.stiff = 0;
      var e = this.tailR.n - 1; this.tailR.hold(e, k[0] + .25 + a * .75, k[1] - .78 - a * .95, k[2] + .1);
      if (tau > .32) { e = this.tailL.n - 1; this.tailL.hold(e, k[0] - .25 - b * .7, k[1] - .78 - b * .9, k[2] + .1); }
      this.knot.scale.setScalar(Math.max(.01, 1 - RV.ease((tau - .6) / .35)));
    }
    if (free && !this.freed) {
      this.freed = true; this.knot.visible = false; this.loopL.mesh.visible = this.loopR.mesh.visible = false;
      this.strips.forEach(function (s) { for (var key in s.pin) s.free(+key); s.damp = .992; s.stiff = 0; s.tw = .35;
        var sign = s.name.slice(-1) === 'L' ? -1 : 1; if (s.name[0] === 'b') for (var i = 0; i < s.n; i++) s.q[i * 3] -= sign * .02 * (i / s.n + .3); });
    }
    this.strips.forEach(function (s) { s.twist = t * (self.freed ? 2 : .4); s.step(dt, 0, self.freed ? -11 : -5, 0, self.freed ? t : null); });
  };
  RV.Bow = Bow;

  /* ---------- 5 · Fabric cover: tap the knot, the ribbon unties, the satin slides off under its own weight ---------- */
  RV.register('fabric', {
    label: 'Fabric and ribbon',
    init: function () {
      RV.lights({ amb: .5, key: .5, back: .15, kx: -2.6, ky: 2.4 }); RV.shadowPlane(-.04, .3);
      var mat = new THREE.MeshPhongMaterial({ map: RV.tex('satin'), side: THREE.DoubleSide, shininess: 26, specular: 0x3a3226 });
      var c = this.c = new RV.Cloth({ cols: 28, rows: 40, w: W + .5, h: H + .7, slack: 1.18, x0: -HW - .25, y0: HH + .3, z0: .1, material: mat, damp: .986, zmin: .02, bend: .3 });
      this.pins = []; for (var i = 0; i < c.cols; i += 3) this.pins.push(c.pin(i, 0)); this.pins.push(c.pin(c.cols - 1, 0));
      RV.scene.add(c.mesh);
      this.bow = new Bow(0, .35, .34, 1.5); this.bow.addTo(RV.scene); this.w = wind(.5);
    },
    step: function (dt, t, tau) {
      var c = this.c, self = this;
      if (tau >= 0) {
        /* the cover is let go from the right first, so it peels across and down like a real drape */
        this.pins.forEach(function (p, k) { if (p.on && tau > 1.0 + (self.pins.length - 1 - k) * .09) c.release(p); });
      }
      var slide = tau > 1.0 ? RV.ease((tau - 1.0) / .8) : 0;
      c.step(dt, -2.2 * slide, tau > 1.0 ? -13 : -8, 0, this.w(t));
      this.bow.step(dt, t, tau);
    },
    done: function (tau) { return tau > 3.4; }
  });
})();
