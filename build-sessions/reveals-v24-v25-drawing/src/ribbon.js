/* A satin ribbon tied in a bow across the seam of the gatefold, and the way it comes undone (the owner's reference):
   one tail is drawn, the bow COLLAPSES (its loops shrink and pass through the knot, the knot loosens), what is left is a
   single strand across the seam with a tail hanging; that strand is drawn out sideways and slides off with a flutter and
   a twist; only then do the panels part. The ribbon is a real band: it has width in space, turns over as it twists so
   its sheen travels, cups slightly across, sags under its weight, and throws a shadow. */
(function () {
  'use strict';
  var RV = window.RV, W = RV.W, H = RV.H, HW = RV.HW, HH = RV.HH;
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function satin(a, b, c) {
    var k = cv(64, 64), x = k.getContext('2d'), g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, a); g.addColorStop(.05, b); g.addColorStop(.5, c); g.addColorStop(.95, b); g.addColorStop(1, a); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(2, 0, 1, 64); x.fillRect(61, 0, 1, 64);
    for (var q = 0; q < 64; q += 2) { x.fillStyle = 'rgba(255,255,255,' + (.03 + .03 * Math.sin(q * .7)) + ')'; x.fillRect(0, q, 64, 1); }
    var t = new THREE.CanvasTexture(k); t.encoding = THREE.sRGBEncoding; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6); return t;
  }
  RV.satinTex = satin;
  function RibbonMesh(strip, width, mat, o) {
    o = o || {}; var n = strip.n, M = 4, i, j, idx = [], uv = new Float32Array(n * (M + 1) * 2);
    this.s = strip; this.w = width; this.M = M; this.camber = o.camber == null ? .009 : o.camber; this.twist = o.twist || function () { return 0; };
    this.pos = new Float32Array(n * (M + 1) * 3);
    for (i = 0; i < n; i++) for (j = 0; j <= M; j++) { uv[(i * (M + 1) + j) * 2] = j / M; uv[(i * (M + 1) + j) * 2 + 1] = i / (n - 1); if (i < n - 1 && j < M) { var a = i * (M + 1) + j; idx.push(a, a + 1, a + M + 1, a + 1, a + M + 2, a + M + 1); } }
    var g = this.geo = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.castShadow = true; this.mesh.frustumCulled = false; this.update(0);
  }
  RibbonMesh.prototype.update = function (t) {
    var p = this.s.p, n = this.s.n, M = this.M, v = this.pos, hw = this.w / 2, cb = this.camber, i, j;
    for (i = 0; i < n; i++) {
      var a = Math.max(0, i - 1) * 3, b = Math.min(n - 1, i + 1) * 3, tx = p[b] - p[a], ty = p[b + 1] - p[a + 1], tz = p[b + 2] - p[a + 2], tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1e-6; tx /= tl; ty /= tl; tz /= tl;
      var nx = -tx * tz, ny = -ty * tz, nz = 1 - tz * tz, nl = Math.sqrt(nx * nx + ny * ny + nz * nz); if (nl < 1e-3) { nx = 0; ny = 1; nz = 0; nl = 1; } nx /= nl; ny /= nl; nz /= nl;
      var bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx, ph = this.twist(i / (n - 1), t), c = Math.cos(ph), s = Math.sin(ph);
      var wx = bx * c + nx * s, wy = by * c + ny * s, wz = bz * c + nz * s, ux = nx * c - bx * s, uy = ny * c - by * s, uz = nz * c - bz * s, k = i * 3;
      for (j = 0; j <= M; j++) { var u = j / M * 2 - 1, q = (i * (M + 1) + j) * 3, cu = cb * (1 - u * u); v[q] = p[k] + wx * u * hw + ux * cu; v[q + 1] = p[k + 1] + wy * u * hw + uy * cu; v[q + 2] = p[k + 2] + wz * u * hw + uz * cu; }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
  };
  RV.RibbonMesh = RibbonMesh;

  RV.GateRibbon = function (scene, y, kx, z, cols) {
    cols = cols || ['#8a4a5e', '#bd7487', '#cf8c9c']; var self = this, mat = this.mat = new THREE.MeshStandardMaterial({ map: satin(cols[0], cols[1], cols[2]), side: THREE.DoubleSide, roughness: .24, metalness: .16, envMapIntensity: 1.9 });
    this.scene = scene; this.y = y; this.kx = kx; this.z = z; this.parts = {}; this.swapped = false; this.gone = false;
    function mk(name, pts, w, tw) { var st = new RV.Strip(pts, w, mat); st.base = Float32Array.from(st.rest); var rm = new RibbonMesh(st, w, mat, { twist: tw }); scene.add(rm.mesh); self.parts[name] = { st: st, rm: rm }; return st; }
    var i, pts, wd = .3;
    pts = []; for (i = 0; i <= 11; i++) pts.push([-HW - .3 + (kx + HW + .3) * i / 11, y, z]); var bl = mk('bandL', pts, wd); bl.hold(0, -HW - .3, y, z); bl.hold(11, kx, y, z);
    pts = []; for (i = 0; i <= 17; i++) pts.push([kx + (HW + .3 - kx) * i / 17, y, z]); var br = mk('bandR', pts, wd); br.hold(0, kx, y, z); br.hold(17, HW + .3, y, z);
    function arc(sg) { var o = [], n = 20; for (var k = 0; k <= n; k++) { var a = k / n * Math.PI * 2, r = .5; o.push([kx + sg * Math.sin(a / 2) * r * 1.45 , y + Math.sin(a) * r * .44 - Math.sin(a / 2) * .1, z + .03 + Math.sin(a / 2) * .16]); } return o; }
    ['L', 'R'].forEach(function (S2) { var sg = S2 === 'L' ? -1 : 1, lp = mk('loop' + S2, arc(sg), wd, function (s) { return Math.PI * s * sg; }); lp.hold(0, kx, y, z + .03); lp.hold(lp.n - 1, kx, y, z + .03); lp.stiff = .5;
      var tp = []; for (var k = 0; k <= 18; k++) tp.push([kx + sg * (k * .03 + .1 * Math.sin(k * .34)), y - k * .125, z + .02 + .03 * Math.sin(k * .5)]); var tl = mk('tail' + S2, tp, wd, function (s, t) { return .55 * Math.sin(s * 2.6 + sg) * s; }); tl.hold(0, kx, y, z + .02); tl.stiff = .009; tl.damp = .975; tl.fl = .1; });   /* no drawn wiggle: the tails move only as the breeze pushes them (see step) */
    this.knot = new THREE.Mesh(new THREE.SphereGeometry(.125, 18, 12), mat); this.knot.scale.set(1.25, 1, .7); this.knot.position.set(kx, y, z + .07); this.knot.castShadow = true; scene.add(this.knot);
  };
  RV.GateRibbon.prototype.step = function (dt, t, tau) {
    var P = this.parts, kx = this.kx, y = this.y, z = this.z, self = this, ease = RV.ease, name;
    if (this.gone) return;
    /* the same soft breeze as the gift box's ribbons: a force on the loose tails, in slow swells; still under reduced motion */
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches, gust = still ? 0 : .65 + .35 * Math.sin(t * 1.122); if (P.tailL && P.tailR) { P.tailL.st.fl = P.tailR.st.fl = 2.4 * gust; }
    if (!this.swapped) {
      if (tau >= 0) {
        var a = ease(tau / .9), b = ease((tau - .5) / .8), c = ease((tau - 1.2) / .7);
        P.loopL.st.scaleRest(P.loopL.st.base, 1 - .95 * a); P.loopL.st.shrink = 1 - .95 * a; P.loopR.st.scaleRest(P.loopR.st.base, 1 - .95 * b); P.loopR.st.shrink = 1 - .95 * b;
        P.loopL.rm.mesh.visible = a < .97; P.loopR.rm.mesh.visible = b < .97;                         /* each loop is drawn through the knot and is gone */
        var e = P.tailR.st.n - 1; P.tailR.st.scaleRest(P.tailR.st.base, 1 - .93 * c); if (a > 0 && c < .05) P.tailR.st.hold(e, kx + .62 + a * .12, y - 2.22 - a * .04, z + .08); else P.tailR.st.free(e);   /* the drawn tail; then it, too, slips back through */
        P.tailR.rm.mesh.visible = c < .97;
        this.knot.scale.set(1.25 * (1 - c * .98) + .001, (1 - c * .98) + .001, .7 * (1 - c * .98) + .001);
      }
      for (name in P) { var st = P[name].st, tail = name.indexOf('tail') === 0; st.step(dt, 0, tail ? -6 : name.indexOf('loop') === 0 ? -1.2 : 0, 0, tail ? t : null); P[name].rm.update(t); }
      if (tau >= 1.95) {
        /* one strand is left: the tail that hangs, and the band to the right. And the short piece to the left. */
        this.swapped = true; this.knot.visible = false; var tl = P.tailL.st, br = P.bandR.st, pts = [], i;
        for (i = tl.n - 1; i >= 1; i--) pts.push([tl.p[i * 3], tl.p[i * 3 + 1], tl.p[i * 3 + 2]]); for (i = 0; i < br.n; i++) pts.push([br.p[i * 3], br.p[i * 3 + 1], br.p[i * 3 + 2]]);
        var sr = new RV.Strip(pts, .3, this.mat); sr.damp = .99; this.sR = { st: sr, rm: new RibbonMesh(sr, .3, this.mat, { twist: function (s, tt) { return self.tw * Math.sin(s * 6.5 - self.u * 5) + self.u * 1.6 * (1 - s); } }) }; this.scene.add(this.sR.rm.mesh);
        ['tailL', 'tailR', 'bandR', 'loopL', 'loopR'].forEach(function (k) { P[k].rm.mesh.visible = false; });
        P.bandL.st.free(11); P.bandL.st.damp = .99; this.t0 = tau; this.tw = 0; this.u = 0;
      }
      return;
    }
    var u = this.u = tau - this.t0, sr = this.sR.st, e2 = sr.n - 1; this.tw = Math.min(1.25, u * 1.6);
    sr.hold(e2, HW + .3 + 4.6 * u * u + .9 * u, y - .55 * u * u, z + .12);                                  /* drawn out to the right, faster as it goes */
    sr.step(dt, 0, -2.6, 0, t); this.sR.rm.update(t);
    var bl = P.bandL.st; bl.hold(0, -HW - .3 - 3.6 * u * u - .4 * u, y - .3 * u * u, z); bl.step(dt, 0, -2.2, 0, t); P.bandL.rm.update(t);
    if (u > 2.2) { this.gone = true; this.sR.rm.mesh.visible = false; P.bandL.rm.mesh.visible = false; }
  };
})();
