/* The solid reveals: things with weight. Four paper flaps on hinges under a wax seal, thick carved doors,
   a marble slab that breaks along its gold veins, a gift box. Every motion is a force acting on mass:
   springs, torque, gravity, never a keyframed slide. */
(function () {
  'use strict';
  var RV = window.RV, W = RV.W, H = RV.H, HW = RV.HW, HH = RV.HH;

  function mapUV(geo, fn) { var p = geo.attributes.position, uv = geo.attributes.uv; for (var i = 0; i < p.count; i++) { var r = fn(p.getX(i), p.getY(i)); uv.setXY(i, r[0], r[1]); } uv.needsUpdate = true; }
  /* a damped torsion spring: angle chases its target with inertia, overshoots a little, settles */
  function Hinge(k, c) { this.a = 0; this.v = 0; this.k = k; this.c = c; this.target = 0; }
  Hinge.prototype.step = function (dt) { this.v += (this.k * (this.target - this.a) - this.c * this.v) * dt; this.a += this.v * dt; return this.a; };
  /* a free body under gravity */
  function Body(obj) { this.o = obj; this.v = new THREE.Vector3(); this.w = new THREE.Vector3(); this.live = false; }
  Body.prototype.kick = function (vx, vy, vz, wx, wy, wz) { this.v.set(vx, vy, vz); this.w.set(wx, wy, wz); this.live = true; };
  Body.prototype.step = function (dt, g) { if (!this.live) return; this.v.y += (g == null ? -9.8 : g) * dt; this.o.position.addScaledVector(this.v, dt); this.o.rotation.x += this.w.x * dt; this.o.rotation.y += this.w.y * dt; this.o.rotation.z += this.w.z * dt; };

  /* ---------- 3 · Envelope: four flaps, a 3D wax seal ---------- */
  function sealTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d');
    x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
    var g = x.createRadialGradient(128, 128, 20, 128, 128, 126); g.addColorStop(0, '#9a9a9a'); g.addColorStop(.72, '#8a8a8a'); g.addColorStop(.86, '#c8c8c8'); g.addColorStop(1, '#5a5a5a'); x.fillStyle = g; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill();
    x.strokeStyle = '#e8e8e8'; x.lineWidth = 5; x.beginPath(); x.arc(128, 128, 84, 0, 7); x.stroke();
    x.strokeStyle = '#3c3c3c'; x.lineWidth = 3; x.beginPath(); x.arc(128, 128, 76, 0, 7); x.stroke();
    x.fillStyle = '#f2f2f2'; x.font = 'italic 600 104px Georgia,serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('S', 128, 134);
    for (var i = 0; i < 12; i++) { var a = i / 12 * 6.283; x.beginPath(); x.arc(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100, 4, 0, 7); x.fillStyle = '#dcdcdc'; x.fill(); }
    return new THREE.CanvasTexture(c);
  }
  function linerTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d'); x.fillStyle = '#3d3023'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#d9b870';
    [[16, 16], [48, 48], [48, 16], [16, 48]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 2.4, 0, 7); x.fill(); });
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); return t;
  }
  RV.register('envelope', {
    label: 'Envelope and wax seal', T: 6.2,
    init: function () {
      var s = RV.scene, self = this; RV.lights({ amb: .52, key: .78, back: .12, kx: -2.4, ky: 3.6, kz: 5 }); RV.shadowPlane(-.03, .38);
      var paper = RV.tex('paper'), C = [0, 0], TT = [0, HH - H * 2 / 3];
      var liner = new THREE.MeshPhongMaterial({ map: linerTexture(), side: THREE.BackSide, shininess: 6 });
      var edgeMat = new THREE.MeshPhongMaterial({ color: 0xe9e2d2 });
      var ec = document.createElement('canvas'); ec.width = 4; ec.height = 32; var ex = ec.getContext('2d'), eg = ex.createLinearGradient(0, 0, 0, 32); eg.addColorStop(0, 'rgba(70,50,30,0)'); eg.addColorStop(.5, 'rgba(70,50,30,.34)'); eg.addColorStop(1, 'rgba(70,50,30,0)'); ex.fillStyle = eg; ex.fillRect(0, 0, 4, 32);
      var edgeShade = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ec), transparent: true, depthWrite: false });
      this.flaps = [];
      /* each flap: hinge point, the two hinge corners and the tip, the axis it turns on, and when it starts */
      var defs = [
        { name: 'bottom', pts: [[-HW, -HH], [HW, -HH], C], piv: [0, -HH], axis: 'x', sign: 1, z: 0, at: 4.0 },
        { name: 'left', pts: [[-HW, HH], [-HW, -HH], C], piv: [-HW, 0], axis: 'y', sign: -1, z: .014, at: 2.7 },
        { name: 'right', pts: [[HW, -HH], [HW, HH], C], piv: [HW, 0], axis: 'y', sign: 1, z: .028, at: 3.3 },
        { name: 'top', pts: [[HW, HH], [-HW, HH], TT], piv: [0, HH], axis: 'x', sign: -1, z: .042, at: .7 }
      ];
      defs.forEach(function (d) {
        var sh = new THREE.Shape(); d.pts.forEach(function (p, i) { var x = p[0] - d.piv[0], y = p[1] - d.piv[1]; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }); sh.closePath();
        var geo = new THREE.ExtrudeGeometry(sh, { depth: .014, bevelEnabled: false });
        mapUV(geo, function (x, y) { return [(x + d.piv[0]) / W + .5, (y + d.piv[1]) / H + .5]; });
        var shade = d.name === 'top' ? 0xffffff : d.name === 'bottom' ? 0xf1ece2 : 0xf7f3ea;
        var m = new THREE.Mesh(geo, [new THREE.MeshPhongMaterial({ map: paper, color: shade, shininess: 5 }), edgeMat]); m.castShadow = true; m.receiveShadow = true;
        var back = new THREE.Mesh(new THREE.ShapeGeometry(sh), liner); back.position.z = -.001;
        var g = new THREE.Group(); g.position.set(d.piv[0], d.piv[1], d.z); g.add(m, back); s.add(g);
        /* a soft line of shade along the two free edges, so the closed flaps read as layered paper */
        [[d.pts[0], d.pts[2]], [d.pts[1], d.pts[2]]].forEach(function (e) {
          var ax = e[0][0] - d.piv[0], ay = e[0][1] - d.piv[1], bx = e[1][0] - d.piv[0], by = e[1][1] - d.piv[1], len = Math.hypot(bx - ax, by - ay);
          var q = new THREE.Mesh(new THREE.PlaneGeometry(len, .11), edgeShade); q.position.set((ax + bx) / 2, (ay + by) / 2, -.004); q.rotation.z = Math.atan2(by - ay, bx - ax); g.add(q);
        });
        self.flaps.push({ g: g, d: d, h: d.name === 'top' ? new Hinge(3.6, 2.9) : new Hinge(5.2, 3.3) });
      });
      /* the seal: a poured disc of wax with an uneven rim and a stamped face, in two halves that can part */
      var bump = sealTexture(), wax = new THREE.MeshPhongMaterial({ color: 0x9a3320, shininess: 90, specular: 0xffc9a8, bumpMap: bump, bumpScale: .035, side: THREE.DoubleSide });
      var cutMat = new THREE.MeshPhongMaterial({ color: 0x7a2616, shininess: 20, side: THREE.DoubleSide }); this.halves = [];
      [0, 1].forEach(function (hf) {
        var prof = [], i; for (i = 0; i <= 8; i++) { var a = i / 8 * Math.PI / 2; prof.push(new THREE.Vector2(.36 + Math.sin(a) * .07, Math.cos(a) * .075)); } prof.unshift(new THREE.Vector2(0, .075)); prof.push(new THREE.Vector2(.45, 0));
        var geo = new THREE.LatheGeometry(prof, 28, hf * Math.PI - Math.PI / 2, Math.PI), p = geo.attributes.position, uv = geo.attributes.uv;
        for (i = 0; i < p.count; i++) { var x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), an = Math.atan2(z, x), wob = r > .3 ? 1 + .07 * Math.sin(an * 5 + 1) + .04 * Math.sin(an * 11) : 1; p.setX(i, x * wob); p.setZ(i, z * wob); uv.setXY(i, x * wob / .92 + .5, .5 - z * wob / .92); }
        geo.computeVertexNormals(); geo.rotateX(Math.PI / 2);
        var mesh = new THREE.Mesh(geo, wax); mesh.castShadow = true;
        var cs = new THREE.Shape(); cs.moveTo(-.45, 0); for (i = prof.length - 2; i >= 0; i--) cs.lineTo(-prof[i].x, prof[i].y); for (i = 1; i < prof.length; i++) cs.lineTo(prof[i].x, prof[i].y); cs.closePath();
        var cg = new THREE.ShapeGeometry(cs); cg.rotateX(Math.PI / 2); var cut = new THREE.Mesh(cg, cutMat); cut.visible = false;
        var g = new THREE.Group(); g.add(mesh, cut); g.position.set(TT[0], TT[1], .06); s.add(g);
        var b = new Body(g); b.cut = cut; self.halves.push(b);
      });
      this.crumbs = []; for (var i = 0; i < 14; i++) { var cm = new THREE.Mesh(new THREE.TetrahedronGeometry(.018 + RV.rand() * .022), wax); cm.position.set(TT[0], TT[1], .1); cm.visible = false; s.add(cm); this.crumbs.push(new Body(cm)); }
      this.C = C;
    },
    open: function () {
      /* the seal snaps: both halves are thrown apart and fall, turning, with wax crumbs */
      this.halves[0].kick(1.5, 1.1, 1.6, 3, 2, -7); this.halves[1].kick(-1.3, .8, 2.0, 2, -3, 6);
      this.halves.forEach(function (b) { b.cut.visible = true; });
      this.crumbs.forEach(function (b) { b.o.visible = true; b.kick((RV.rand() - .5) * 3.2, RV.rand() * 2.4, 1 + RV.rand() * 2.5, RV.rand() * 12, RV.rand() * 12, RV.rand() * 12); });
    },
    step: function (dt, t, tau) {
      this.halves.forEach(function (b) { b.step(dt, -10.5); }); this.crumbs.forEach(function (b) { b.step(dt, -10.5); });
      this.flaps.forEach(function (f) {
        if (tau >= f.d.at) f.h.target = 2.95;                         /* swings toward you, then past the edge */
        else if (tau >= 0 && tau > f.d.at - .16) f.h.target = -.05;   /* a breath inward before it lets go */
        var a = f.h.step(dt) * f.d.sign; if (f.d.axis === 'x') f.g.rotation.x = a; else f.g.rotation.y = a;
      });
    },
    done: function (tau) { return tau > 6.2; }
  });

  /* ---------- 10 · Cathedral doors: thick carved leaves, real weight, light from inside ---------- */
  RV.options('doors', [
    { key: 'door', label: 'Doors', choices: [['wood', 'Carved wood'], ['midnight', 'Midnight blue'], ['white', 'Gold leaf']] },
    { key: 'flowers', label: 'Flowers', choices: [['white', 'White'], ['blush', 'Blush'], ['peach', 'Peach'], ['lilac', 'Lilac']] }]);
  RV.register('doors', {
    label: 'Cathedral doors', T: 5.0, fadeMs: 1400, ownCam: true,
    init: function () {
      var s = RV.scene, self = this, style = RV.opt('doors', 'door'), tex;
      RV.lights({ amb: .5, key: .8, back: 0, kx: -2.5, ky: 3.5, kz: 5.5 });
      var X = .77, YB = -1.52, YS = .49;                                 /* half width, sill, where the arch springs */
      if (style === 'wood') tex = RV.tex('doors');
      else {                                                             /* the same carved doors, refinished: the leaves are repainted, the stone is left alone */
        var dc = document.createElement('canvas'); dc.width = dc.height = 2; tex = new THREE.CanvasTexture(dc); tex.anisotropy = 4; var di = new Image(); RV.hold();
        di.onload = function () {
          var w = dc.width = di.width, h = dc.height = di.height, dx = dc.getContext('2d'); dx.drawImage(di, 0, 0); var im = dx.getImageData(0, 0, w, h), p = im.data, i, j;
          function mx(a, b, k) { return a + (b - a) * k; } function st(e0, e1, v) { v = (v - e0) / (e1 - e0); v = v < 0 ? 0 : v > 1 ? 1 : v; return v * v * (3 - 2 * v); }
          for (j = 0; j < h; j++) for (i = 0; i < w; i++) { var x = (i / w - .5) * W, y = (.5 - (j / h * 533 - 6.5) / 520) * H; if (Math.abs(x) > X || y < YB || (y > YS && Math.hypot(x, y - YS) > X)) continue;
            var o = (j * w + i) * 4, l = (p[o] * .3 + p[o + 1] * .59 + p[o + 2] * .11) / 255, g, c;
            if (style === 'midnight') { g = st(.42, .78, l); c = [mx(mx(10, 44, l * 1.6), 228, g), mx(mx(16, 58, l * 1.6), 188, g), mx(mx(40, 112, l * 1.6), 104, g)]; }      /* deep blue, the carving picked out in gold */
            else { g = st(.06, .4, l); c = [mx(150, 250, g), mx(118, 245, g), mx(64, 234, g)]; var hi = st(.7, .95, l); c = [mx(c[0], 236, hi * .5), mx(c[1], 200, hi * .5), mx(c[2], 120, hi * .5)]; }   /* ivory, gold in the hollows and on the high points */
            p[o] = c[0]; p[o + 1] = c[1]; p[o + 2] = c[2]; }
          dx.putImageData(im, 0, 0); tex.needsUpdate = true; RV.unhold();
        };
        di.src = window.TEX.doors;
      }
      function uvw(x, y) { var py = (0.5 - y / H) * 520; return [x / W + .5, 1 - (py + 6.5) / 533]; }
      /* the stone front, with the doorway cut out of it and real depth in the opening */
      var wall = new THREE.Shape(); wall.moveTo(-HW, -HH); wall.lineTo(HW, -HH); wall.lineTo(HW, HH); wall.lineTo(-HW, HH); wall.closePath();
      var hole = new THREE.Path(); hole.moveTo(-X, YB); hole.lineTo(-X, YS); hole.absarc(0, YS, X, Math.PI, 0, true); hole.lineTo(X, YB); hole.closePath(); wall.holes.push(hole);
      var wg = new THREE.ExtrudeGeometry(wall, { depth: .34, bevelEnabled: false, curveSegments: 24 }); wg.translate(0, 0, -.34); mapUV(wg, uvw);
      var facade = this.facade = new THREE.Mesh(wg, [new THREE.MeshPhongMaterial({ map: tex, bumpMap: tex, bumpScale: .02, shininess: 3 }), new THREE.MeshPhongMaterial({ color: 0x8f7a5c, shininess: 2 })]);
      facade.castShadow = true; facade.receiveShadow = true; s.add(facade);
      /* two leaves, each 0.15 thick, hung on their outer edge and set back in the opening */
      this.leaves = [];
      [-1, 1].forEach(function (side) {
        var sh = new THREE.Shape(); sh.moveTo(0, YB);
        if (side < 0) { sh.lineTo(X, YB); sh.lineTo(X, YS + X); sh.absarc(X, YS, X, Math.PI / 2, Math.PI, false); sh.closePath(); }
        else { sh.lineTo(0, YS); sh.absarc(-X, YS, X, 0, Math.PI / 2, false); sh.lineTo(-X, YB); sh.closePath(); }
        var geo = new THREE.ExtrudeGeometry(sh, { depth: .22, bevelEnabled: true, bevelThickness: .014, bevelSize: .014, bevelSegments: 2, curveSegments: 16 });
        mapUV(geo, function (x, y) { return uvw(x + side * X, y); });
        var m = new THREE.Mesh(geo, [new THREE.MeshPhongMaterial({ map: tex, bumpMap: tex, bumpScale: .045, shininess: 14, specular: 0x33261a }), new THREE.MeshPhongMaterial({ color: style === 'midnight' ? 0x10183a : style === 'white' ? 0xd9cfba : 0x5a3a22, shininess: 16, specular: 0x33261a })]);
        m.castShadow = true; m.receiveShadow = true;
        var g = new THREE.Group(); g.position.set(side * X, 0, -.33); g.add(m); s.add(g);
        self.leaves.push({ g: g, side: side, a: 0, v: 0, at: side < 0 ? 0 : .08 });
      });
      /* what is inside: warm light that grows as the doors part, and shafts of it reaching out */
      var gc = document.createElement('canvas'); gc.width = 64; gc.height = 128; var gx = gc.getContext('2d'), gr = gx.createRadialGradient(32, 80, 2, 32, 70, 70); gr.addColorStop(0, 'rgba(255,246,214,1)'); gr.addColorStop(.5, 'rgba(255,214,140,.75)'); gr.addColorStop(1, 'rgba(255,190,90,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 64, 128);
      var glow = this.glow = new THREE.Mesh(new THREE.PlaneGeometry(X * 2.6, 3.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.set(0, -.35, -.5); s.add(glow);
      this.bright = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0xfff7e2, transparent: true, opacity: 0, fog: false, depthTest: false })); this.bright.renderOrder = 9; s.add(this.bright);
      this.aisle = new RV.Aisle(s, YB); facade.material.forEach(function (m) { m.fog = false; }); this.leaves.forEach(function (L) { L.g.children[0].material.forEach(function (m) { m.fog = false; }); });
      this.seam = new THREE.Mesh(new THREE.PlaneGeometry(.035, YS + X - YB), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); this.seam.position.set(0, (YS + X + YB) / 2, -.16); s.add(this.seam);   /* shut, with a thin seam of light */
      this.rays = [];
      for (var i = 0; i < 6; i++) { var rg = new THREE.BufferGeometry(), x0 = (i / 5 - .5) * X * 1.5; rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x0 - .05, .8, -.25, x0 + .05, .8, -.25, x0 * 3.2 - .5, -3.4, 2.6, x0 * 3.2 + .5, -3.4, 2.6]), 3)); rg.setIndex([0, 2, 1, 1, 2, 3]);
        var ray = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffe4a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); s.add(ray); this.rays.push(ray); }
      var n = 70, dp = new Float32Array(n * 3); for (i = 0; i < n; i++) { dp[i * 3] = (RV.rand() - .5) * 1.6; dp[i * 3 + 1] = -1.4 + RV.rand() * 2.4; dp[i * 3 + 2] = -.2 + RV.rand() * 1.6; }
      var dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff0c8, size: .022, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); s.add(this.dust);
      this.inner = new THREE.PointLight(0xffd9a0, 0, 6); this.inner.position.set(0, -.2, -.9); s.add(this.inner);
    },
    step: function (dt, t, tau) {
      var open = 0, STOP = 1.78;
      this.leaves.forEach(function (L) {
        if (tau >= L.at) {
          /* a heavy door: the push builds slowly, the hinge drags, and it meets its stop with a small rebound */
          var push = L.a < STOP - .32 ? 4.4 * RV.ease((tau - L.at) / .4) : 0, stop = L.a > STOP - .32 ? 20 * (STOP - L.a) : 0;
          L.v += (push + stop - (L.a > STOP - .32 ? 4.6 : 1.3) * L.v) * dt; L.a += L.v * dt;
        }
        L.g.rotation.y = -L.side * L.a; open += L.a / STOP / 2;
      });
      var lit = RV.clamp(open * 1.25, 0, 1);
      this.glow.material.opacity = lit * .55; this.inner.intensity = lit * 1.6; this.dust.material.opacity = lit * .8;
      this.rays.forEach(function (r, i) { r.material.opacity = lit * (.1 + .05 * Math.sin(t * 1.3 + i * 2)); });
      var dp = this.dust.geometry.attributes.position; for (var i = 0; i < dp.count; i++) { dp.setY(i, dp.getY(i) + dt * .05 * (1 + (i % 3))); dp.setX(i, dp.getX(i) + Math.sin(t + i) * dt * .02); } dp.needsUpdate = true;
      var z0 = H / 2 / Math.tan(15 * Math.PI / 180), cam = RV.camera, w = tau < 0 ? 0 : RV.clamp(tau / 5.0, 0, 1);
      /* ONE continuous forward glide, from the tap to the white: it never slows and never stops. The door frame passes
         the edges of the screen a third of the way through; after that it is the aisle streaming by. A little float, as
         a hand-held gimbal has. */
      var p = 0.12 * w * w + 0.88 * w;
      cam.position.set(tau < 0 ? 0 : .045 * Math.sin(t * .8), (tau < 0 ? 0 : -.36 * Math.min(1, w * 2.6)) + (tau < 0 ? 0 : .025 * Math.sin(t * 1.15)), z0 + (-13.6 - z0) * p); cam.rotation.z = tau < 0 ? 0 : .005 * Math.sin(t * .7);
      cam.fov = 30 + 16 * RV.ease(w / .45); cam.updateProjectionMatrix();
      this.aisle.step(dt, t, open, cam.position.z); this.seam.material.opacity = Math.max(0, .85 - open * 9);
      var out = RV.clamp((cam.position.z - 0.4) / 2.4, 0, 1); this.glow.material.opacity *= out; this.dust.material.opacity *= out; this.inner.intensity *= out; this.rays.forEach(function (ry) { ry.material.opacity *= out; });   /* the doorway's own glow is left behind as you pass through */
      this.bright.position.set(cam.position.x, cam.position.y, cam.position.z - 1.2); this.bright.material.opacity = RV.clamp((tau - 4.0) / 0.85, 0, 1);
    },
    done: function (tau) { return tau > 5.0; }
  });

  /* ---------- 9 · Golden marble: the gold veins carry the charge, and the slab breaks along them ---------- */
  function clip(poly, nx, ny, d) { var out = [], i, n = poly.length; for (i = 0; i < n; i++) { var a = poly[i], b = poly[(i + 1) % n], da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d; if (da <= 0) out.push(a); if ((da < 0) !== (db < 0) && da !== db) { var k = da / (da - db); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } } return out; }
  function veinPts(a, b) {                                        /* one wavering line per edge, the same from either side */
    var flip = a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]), p = flip ? b : a, q = flip ? a : b, pts = [], n = 6, len = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = -(q[1] - p[1]) / (len || 1), ny = (q[0] - p[0]) / (len || 1);
    var onEdge = (Math.abs(p[0]) > HW - .001 && Math.abs(q[0]) > HW - .001 && p[0] === q[0]) || (Math.abs(p[1]) > HH - .001 && Math.abs(q[1]) > HH - .001 && p[1] === q[1]);
    for (var i = 0; i <= n; i++) { var k = i / n, h = Math.sin(p[0] * 12.9898 + p[1] * 78.233 + q[0] * 37.719 + i * 4.1) * 43758.5453, off = onEdge || i === 0 || i === n ? 0 : ((h - Math.floor(h)) - .5) * .09 * Math.min(1, len); pts.push([p[0] + (q[0] - p[0]) * k + nx * off, p[1] + (q[1] - p[1]) * k + ny * off]); }
    return flip ? pts.reverse() : pts;
  }
  RV.register('marble', {
    label: 'Golden marble',
    init: function () {
      var s = RV.scene, self = this; RV.lights({ amb: .62, key: .5, back: .1, kx: -3.4, ky: 4.4, kz: 4 }); RV.shadowPlane(-.03, .4);
      var seeds = [], i, j; for (j = 0; j < 4; j++) for (i = 0; i < 2 + (j % 2); i++) seeds.push([(-.5 + (i + .5) / (2 + (j % 2))) * W + (RV.rand() - .5) * .5, (-.5 + (j + .5) / 4) * H + (RV.rand() - .5) * .55]);
      var cells = seeds.map(function (c, ci) { var poly = [[-HW, -HH], [HW, -HH], [HW, HH], [-HW, HH]]; seeds.forEach(function (o, oi) { if (oi === ci) return; var nx = o[0] - c[0], ny = o[1] - c[1], l = Math.hypot(nx, ny); nx /= l; ny /= l; poly = clip(poly, nx, ny, ((c[0] + o[0]) / 2) * nx + ((c[1] + o[1]) / 2) * ny); }); return poly; });
      /* the slab's face: the marble photo with our own gold veins drawn exactly on the lines it will break along */
      var CW = 600, CH = 1040, face = document.createElement('canvas'); face.width = CW; face.height = CH; var fx = face.getContext('2d'); fx.fillStyle = '#0e0d0b'; fx.fillRect(0, 0, CW, CH);
      var glowC = this.glowC = document.createElement('canvas'); glowC.width = CW / 2; glowC.height = CH / 2; this.gx = glowC.getContext('2d'); this.gx.fillStyle = '#000'; this.gx.fillRect(0, 0, CW / 2, CH / 2);
      var faceTex = new THREE.CanvasTexture(face), glowTex = this.glowTex = new THREE.CanvasTexture(glowC);
      function px(p) { return [(p[0] / W + .5) * CW, (.5 - p[1] / H) * CH]; }
      var veins = this.veins = [];
      cells.forEach(function (poly) { for (var e = 0; e < poly.length; e++) { var a = poly[e], b = poly[(e + 1) % poly.length]; if ((Math.abs(a[0]) > HW - .001 && a[0] === b[0]) || (Math.abs(a[1]) > HH - .001 && a[1] === b[1])) continue; if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) continue; veins.push(veinPts(a, b)); } });
      function drawVeins() {
        fx.lineCap = 'round'; fx.lineJoin = 'round';
        [[7, 'rgba(120,84,30,.55)'], [3.4, '#c9a45a'], [1.3, '#f6e3ac']].forEach(function (st) { fx.lineWidth = st[0]; fx.strokeStyle = st[1]; veins.forEach(function (v) { fx.beginPath(); v.forEach(function (p, k) { var q = px(p); if (k) fx.lineTo(q[0], q[1]); else fx.moveTo(q[0], q[1]); }); fx.stroke(); }); });
        faceTex.needsUpdate = true;
      }
      var img = new Image(); RV.hold(); img.onload = function () { fx.drawImage(img, 0, 0, CW, CH); fx.fillStyle = 'rgba(8,7,6,.35)'; fx.fillRect(0, 0, CW, CH); drawVeins(); RV.unhold(); }; img.src = window.TEX.marble; drawVeins();
      var top = new THREE.MeshPhongMaterial({ map: faceTex, emissive: 0xffd98a, emissiveMap: glowTex, emissiveIntensity: 1.5, shininess: 46, specular: 0x2e2a20 });
      var side = new THREE.MeshPhongMaterial({ color: 0x15130f, emissive: 0xc9a45a, emissiveIntensity: 0, shininess: 30 }); this.side = side;
      this.shards = cells.map(function (poly, ci) {
        var ring = []; for (var e = 0; e < poly.length; e++) { var pts = veinPts(poly[e], poly[(e + 1) % poly.length]); pts.pop(); ring = ring.concat(pts); }
        var cx = 0, cy = 0; ring.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= ring.length; cy /= ring.length;
        var sh = new THREE.Shape(); ring.forEach(function (p, k) { if (k) sh.lineTo(p[0] - cx, p[1] - cy); else sh.moveTo(p[0] - cx, p[1] - cy); }); sh.closePath();
        var geo = new THREE.ExtrudeGeometry(sh, { depth: .16, bevelEnabled: false }); geo.translate(0, 0, -.16);
        mapUV(geo, function (x, y) { return [(x + cx) / W + .5, (y + cy) / H + .5]; });
        var m = new THREE.Mesh(geo, [top, side]); m.position.set(cx, cy, .16); m.castShadow = true; s.add(m);
        var b = new Body(m); b.c = [cx, cy]; return b;
      });
      this.spark = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xfff1c0, size: .05, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.sp = new Float32Array(90 * 3); this.spark.geometry.setAttribute('position', new THREE.BufferAttribute(this.sp, 3)); s.add(this.spark);
      this.flash = new THREE.PointLight(0xffe2a0, 0, 8); this.flash.position.set(0, 0, 2.2); s.add(this.flash);
    },
    open: function (x, y) { this.tapW = [x * HW, y * HH]; },
    step: function (dt, t, tau) {
      var self = this, CW = this.glowC.width, CH = this.glowC.height, g = this.gx;
      if (tau >= 0 && tau < 1.5) {
        /* the charge runs out from the tap along the veins; only the part it has reached is lit */
        var front = RV.easeOut(tau / 1.05) * 6.4, tap = this.tapW, k = 0;
        g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, CW, CH); g.lineCap = 'round'; g.shadowColor = '#ffd98a'; g.shadowBlur = 10;
        this.veins.forEach(function (v) { for (var i = 0; i < v.length - 1; i++) { var a = v[i], b = v[i + 1], d = Math.hypot((a[0] + b[0]) / 2 - tap[0], (a[1] + b[1]) / 2 - tap[1]); if (d > front) continue;
          var hot = d > front - .9, fl = .55 + .45 * Math.sin(t * 60 + d * 9 + i);
          g.strokeStyle = hot ? 'rgba(255,255,255,' + fl + ')' : 'rgba(255,214,130,' + (.45 + .2 * fl) + ')'; g.lineWidth = hot ? 3.2 : 2;
          g.beginPath(); g.moveTo((a[0] / W + .5) * CW, (.5 - a[1] / H) * CH); g.lineTo((b[0] / W + .5) * CW, (.5 - b[1] / H) * CH); g.stroke();
          if (hot && k < 90 && ((i * 7 + (t * 60 | 0)) % 3 === 0)) { self.sp[k * 3] = a[0] + (RV.rand() - .5) * .12; self.sp[k * 3 + 1] = a[1] + (RV.rand() - .5) * .12; self.sp[k * 3 + 2] = .2 + RV.rand() * .25; k++; } } });
        g.shadowBlur = 0; for (; k < 90; k++) self.sp[k * 3 + 2] = -50; this.spark.geometry.attributes.position.needsUpdate = true; this.glowTex.needsUpdate = true;
        this.flash.intensity = .15 + RV.ease(tau / 1.1) * .55 + (tau > 1.05 ? 1.4 * (1 - (tau - 1.05) / .45) : 0); this.side.emissiveIntensity = RV.ease(tau / 1.1) * .9;
      } else if (tau >= 1.5) { this.flash.intensity = Math.max(0, this.flash.intensity - dt * 4); this.spark.visible = false; }
      if (tau >= 1.12) this.shards.forEach(function (b) {
        /* it gives way along the veins: pieces nearest the tap go first, pushed out and toward you, then they fall */
        var dx = b.c[0] - self.tapW[0], dy = b.c[1] - self.tapW[1], d = Math.hypot(dx, dy) || .01;
        if (!b.live && tau >= 1.12 + d * .11) b.kick(dx / d * (1.1 + RV.rand()), dy / d * .8 + 1.4 + RV.rand(), 1.2 + RV.rand() * 2.2, (RV.rand() - .5) * 5, (RV.rand() - .5) * 5, (RV.rand() - .5) * 3);
        b.step(dt, -12);
      });
    },
    done: function (tau) { return tau > 3.3; }
  });

  /* ---------- 4 · Gift box: untie the bow, the ribbon falls away, the lid lifts off, the tissue parts ---------- */
  RV.register('gift', {
    label: 'Gift box',
    init: function () {
      var s = RV.scene; RV.lights({ amb: .58, key: .7, back: .1, kx: -2.4, ky: 3.2 }); RV.shadowPlane(-.5, .42);
      var linen = RV.tex('linen', true); linen.wrapS = linen.wrapT = THREE.ClampToEdgeWrapping;
      var face = new THREE.MeshPhongMaterial({ map: linen, shininess: 4 }), rim = new THREE.MeshPhongMaterial({ map: linen, color: 0xd8cebb, shininess: 4 }), under = new THREE.MeshPhongMaterial({ color: 0xb9ad98, shininess: 2 });
      var lid = this.lid = new THREE.Mesh(new THREE.BoxGeometry(W + .12, H + .12, .34), [rim, rim, rim, rim, face, under]);
      lid.position.z = -.05; lid.castShadow = true; s.add(lid); this.body = new Body(lid);
      /* a pressed border on the lid, so it reads as a box top and not a flat sheet */
      var bc = document.createElement('canvas'); bc.width = 150; bc.height = 260; var bx = bc.getContext('2d');
      bx.strokeStyle = 'rgba(90,70,45,.3)'; bx.lineWidth = 2; bx.strokeRect(11, 11, 128, 238); bx.strokeStyle = 'rgba(255,255,255,.55)'; bx.lineWidth = 1; bx.strokeRect(12.5, 12.5, 128, 238);
      var border = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, depthWrite: false })); border.position.z = .172; lid.add(border);
      var satin = new THREE.MeshPhongMaterial({ color: 0xc9a66b, side: THREE.DoubleSide, shininess: 50, specular: 0x6a5a3a });
      this.vert = [1, -1].map(function (sg) { var pts = []; for (var i = 0; i <= 12; i++) pts.push([0, .3 + sg * i * (HH + .3) / 12, .15]); var st = new RV.Strip(pts, .3, satin); st.tw = .06; st.hold(0, 0, .3, .15); st.hold(12, 0, .3 + sg * (HH + .3), .15); s.add(st.mesh); return st; });
      this.bow = new RV.Bow(0, .3, .16, 1.7, 0xc9a66b); this.bow.addTo(s);
      this.tissue = [-1, 1].map(function (side) {
        var mat = new THREE.MeshPhongMaterial({ color: 0xfffdf8, side: THREE.DoubleSide, shininess: 10, transparent: true, opacity: .95 });
        var c = new RV.Cloth({ cols: 18, rows: 30, w: HW + .25, h: H + .3, slack: 1.22, x0: side < 0 ? -HW - .1 : -.15, y0: HH + .15, z0: -.34, phase: side, material: mat, damp: .97 });
        c.edge = []; for (var j = 0; j < c.rows; j += 3) c.edge.push(c.pin(side < 0 ? 0 : c.cols - 1, j)); c.side = side; c.mesh.visible = false; s.add(c.mesh); return c;
      });
    },
    step: function (dt, t, tau) {
      var self = this, LIFT = 1.5, PART = 2.2; this.bow.step(dt, t, tau);
      this.vert.forEach(function (st, k) { if (tau > .95 && !st.freed) { st.freed = true; st.free(0); st.free(12); st.tw = .35; st.q[36] += k ? -.02 : .02; } st.step(dt, 0, st.freed ? -16 : 0, 0, st.freed ? t : null); });
      if (tau > LIFT) {
        /* two hands lift it: straight up toward you first, tipping a little, then away over the top */
        var b = this.body, u = tau - LIFT; b.live = true;
        b.v.z += (u < .34 ? 9 : -1.5 * b.v.z) * dt; b.v.y += (u < .26 ? 0 : 17) * dt; b.w.x += ((u < .5 ? -.75 : -.2) - b.w.x) * 4 * dt; b.w.z += (.1 - b.w.z) * 3 * dt; b.step(dt, 0);
        this.tissue.forEach(function (c) { c.mesh.visible = true; });
      }
      this.tissue.forEach(function (c) {
        if (tau > PART) { var pull = RV.easeIn((tau - PART) / 1.0); c.edge.forEach(function (p) { p.x = p.x0 + c.side * pull * (HW + .8); p.z = p.z0 + .3 * pull; }); }
        c.step(dt, 0, 0, tau > PART ? 1.4 : 0, function (x, y) { var n = RV.noise(x, y, t); return [0, 0, n * 1.1]; });
      });
    },
    done: function (tau) { return tau > 3.5; }
  });
})();
