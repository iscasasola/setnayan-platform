/* What is beyond the cathedral doors: a hall to travel through, not a picture that grows.
   Finish pass, 23 Nov 2026 (after the owner's doors clip):
   · a polished marble floor that MIRRORS the hall (every piece has its true reflection under the floor, seen through it)
   · flowers at true scale: separate round arrangements along the aisle and tall pedestal arrangements behind them,
     each a cut-out photograph with a soft edge, each with the shadow it stands in
   · a wide hall with pilastered walls, so the arches are grand and far, and near things stream past
   Each piece sits at its own depth, so near things pass quickly and far things grow slowly as the camera glides in. */
(function () {
  'use strict';
  var RV = window.RV;
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function hash(i) { var h = Math.sin(i * 127.1 + 3.7) * 43758.5453; return h - Math.floor(h); }
  RV.Aisle = function (s, YB) {
    var L = 21, HWD = 3.3, CEIL = 5.9, i, self = this; this.L = L;
    s.fog = new THREE.Fog(0xe9d5b0, 7, 36);
    function basic(o) { return new THREE.MeshBasicMaterial(o); }
    var TINT = { white: 0xffffff, blush: 0xffd3dc, peach: 0xffd9bd, lilac: 0xe2d2ff }[RV.opt('doors', 'flowers')] || 0xffffff;   /* the flowers' colour is the host's choice */
    var up = new THREE.Group();                                      /* everything that stands in the hall; it is mirrored below */
    function piece(name, w, h, x, y, z, o) {
      o = o || {}; var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic({ map: RV.tex(name), color: o.tint ? TINT : 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: o.opacity == null ? 1 : o.opacity, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !o.add, alphaTest: o.add ? 0 : .02 }));
      m.position.set(x, y, z); if (o.flip) m.scale.x = -1; up.add(m); return m;
    }
    /* the walls: warm stone with pilasters and the glow of sconces, and a coffered dark above */
    var wc = cv(256, 512), wx = wc.getContext('2d'), wg = wx.createLinearGradient(0, 0, 0, 512); wg.addColorStop(0, '#6f5c44'); wg.addColorStop(.45, '#a8916f'); wg.addColorStop(1, '#bfa884'); wx.fillStyle = wg; wx.fillRect(0, 0, 256, 512);
    var pg2 = wx.createLinearGradient(96, 0, 160, 0); pg2.addColorStop(0, 'rgba(60,44,26,.35)'); pg2.addColorStop(.18, 'rgba(236,216,180,.55)'); pg2.addColorStop(.6, 'rgba(214,192,154,.45)'); pg2.addColorStop(1, 'rgba(60,44,26,.4)'); wx.fillStyle = pg2; wx.fillRect(96, 0, 64, 512);
    wx.fillStyle = 'rgba(60,44,26,.3)'; wx.fillRect(88, 96, 80, 10); wx.fillRect(88, 470, 80, 14);
    var sgw = wx.createRadialGradient(128, 250, 2, 128, 250, 120); sgw.addColorStop(0, 'rgba(255,232,178,.75)'); sgw.addColorStop(1, 'rgba(255,220,150,0)'); wx.fillStyle = sgw; wx.fillRect(0, 100, 256, 320);
    var wt = new THREE.CanvasTexture(wc); wt.wrapS = THREE.RepeatWrapping; wt.repeat.set(9, 1);
    [-1, 1].forEach(function (sd) { var wall = new THREE.Mesh(new THREE.PlaneGeometry(L + 4, CEIL), basic({ map: wt, side: THREE.DoubleSide })); wall.rotation.y = -sd * Math.PI / 2; wall.position.set(sd * HWD, YB + CEIL / 2, -L / 2 - .2); up.add(wall); });
    var ceil = new THREE.Mesh(new THREE.PlaneGeometry(HWD * 2, L + 4), basic({ color: 0x6a573f, side: THREE.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, YB + CEIL, -L / 2 - .2); up.add(ceil);
    var back = new THREE.Mesh(new THREE.PlaneGeometry(HWD * 2.1, HWD * 2.1 * 1280 / 720), basic({ map: RV.tex('hall'), side: THREE.DoubleSide })); back.position.set(0, YB + 3.4, -L - 2.4); up.add(back);
    /* chiffon swagged from the ceiling to both sides */
    for (i = 0; i < 6; i++) { [-1, 1].forEach(function (sd) { piece('drape', 3.9, 2.2, sd * 1.5, YB + CEIL - 1.05, -1.5 - i * 3.5, { opacity: .9, flip: sd > 0 }); }); }
    /* tall arrangements on gold stands, behind the aisle flowers */
    for (i = 0; i < 7; i++) { [-1, 1].forEach(function (sd) { var hh = 2.3 + .2 * hash(i * 2 + sd); piece('ped', hh * 253 / 560, hh, sd * (2.02 + .12 * hash(i + 9 * sd)), YB + hh / 2 - .02, -2.6 - i * 2.9, { flip: hash(i * 3 + sd) > .5, tint: true }); }); }
    /* two grand flower arches, far along */
    [-10.5, -18.5].forEach(function (z) { piece('arch', 5.5, 5.64, 0, YB + 2.77, z, { tint: true }); });
    /* the flowers that line the aisle: separate round arrangements, close enough to brush past */
    this.blobs = [];
    for (i = 0; i < 13; i++) { [-1, 1].forEach(function (sd) {
      var k = i * 2 + (sd > 0 ? 1 : 0), w = .98 + .22 * hash(k + 40), nm = hash(k + 7) > .5 ? 'cl1' : 'cl2', h = w * (nm === 'cl1' ? 341 : 347) / 420, x = sd * (1.08 + .1 * hash(k + 20)), z = -1.55 - i * 1.48 - .5 * hash(k + 60);
      piece(nm, w, h, x, YB + h / 2 - .035, z, { flip: hash(k + 80) > .5, tint: true }); self.blobs.push([x, z, w]);
    }); }
    /* pillar candles between the arrangements, on the aisle side: three to a group, each with its flame and its glow */
    var cc = cv(96, 160), cx2 = cc.getContext('2d'); [[18, 78, 22], [40, 46, 24], [66, 96, 20]].forEach(function (c) { var gb = cx2.createLinearGradient(c[0], 0, c[0] + c[2], 0); gb.addColorStop(0, '#cdbf9f'); gb.addColorStop(.35, '#fffaf0'); gb.addColorStop(1, '#b9a985'); cx2.fillStyle = gb; cx2.fillRect(c[0], c[1], c[2], 160 - c[1]); cx2.beginPath(); cx2.ellipse(c[0] + c[2] / 2, c[1], c[2] / 2, 4, 0, 0, 6.283); cx2.fillStyle = '#fff6e0'; cx2.fill();
      var gf = cx2.createRadialGradient(c[0] + c[2] / 2, c[1] - 12, 0, c[0] + c[2] / 2, c[1] - 12, 11); gf.addColorStop(0, 'rgba(255,255,240,1)'); gf.addColorStop(.5, 'rgba(255,214,120,.95)'); gf.addColorStop(1, 'rgba(255,170,60,0)'); cx2.fillStyle = gf; cx2.beginPath(); cx2.ellipse(c[0] + c[2] / 2, c[1] - 12, 6, 12, 0, 0, 6.283); cx2.fill(); });
    var ct2 = new THREE.CanvasTexture(cc), gl = cv(64, 64), glx = gl.getContext('2d'), glg = glx.createRadialGradient(32, 32, 0, 32, 32, 32); glg.addColorStop(0, 'rgba(255,236,190,.9)'); glg.addColorStop(.3, 'rgba(255,214,140,.35)'); glg.addColorStop(1, 'rgba(255,200,120,0)'); glx.fillStyle = glg; glx.fillRect(0, 0, 64, 64); var gt2 = new THREE.CanvasTexture(gl);
    for (i = 0; i < 12; i++) { [-1, 1].forEach(function (sd) { var z = -2.3 - i * 1.48, x = sd * (.74 + .05 * hash(i * 5 + sd));
      var c = new THREE.Mesh(new THREE.PlaneGeometry(.3, .5), basic({ map: ct2, transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: .02 })); c.position.set(x, YB + .25, z); if (sd > 0) c.scale.x = -1; up.add(c);
      var g = new THREE.Mesh(new THREE.PlaneGeometry(.8, .8), basic({ map: gt2, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false, opacity: .7 })); g.position.set(x, YB + .42, z + .01); up.add(g); }); }
    /* petals drifting down through the hall */
    var pc2 = cv(32, 32), px2 = pc2.getContext('2d'); px2.fillStyle = '#fff'; px2.beginPath(); px2.ellipse(16, 16, 9, 14, .5, 0, 6.283); px2.fill();
    var NP = this.NP = 150, Q = this.Q = new Float32Array(NP * 3); for (i = 0; i < NP; i++) { Q[i * 3] = (RV.rand() - .5) * 5; Q[i * 3 + 1] = YB + RV.rand() * 4.6; Q[i * 3 + 2] = -RV.rand() * (L + 1); }
    var qg = new THREE.BufferGeometry(); qg.setAttribute('position', new THREE.BufferAttribute(Q, 3));
    this.pet = new THREE.Points(qg, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(pc2), color: TINT, size: .085, transparent: true, depthWrite: false, alphaTest: .05, opacity: .95 })); this.pet.frustumCulled = false; up.add(this.pet);
    /* chandeliers at many depths */
    for (i = 0; i < 7; i++) { piece('chand', 1.25, 1.56, 0, YB + 4.25 + (i % 2) * .2, -2.8 - i * 3.0, { add: true, opacity: .8 }); if (i < 6 && i % 2 === 0) [-1, 1].forEach(function (sd) { piece('chand', .85, 1.06, sd * 1.9, YB + 4.1, -4.3 - i * 3.0, { add: true, opacity: .6 }); }); }
    /* motes of light floating toward the lens */
    var bc = cv(64, 64), bx = bc.getContext('2d'), bg = bx.createRadialGradient(32, 32, 0, 32, 32, 32); bg.addColorStop(0, 'rgba(255,250,235,1)'); bg.addColorStop(.4, 'rgba(255,235,190,.5)'); bg.addColorStop(1, 'rgba(255,220,160,0)'); bx.fillStyle = bg; bx.fillRect(0, 0, 64, 64);
    var N = this.N = 240, P = this.P = new Float32Array(N * 3); for (i = 0; i < N; i++) { P[i * 3] = (RV.rand() - .5) * 4.4; P[i * 3 + 1] = YB + .2 + RV.rand() * 3.8; P[i * 3 + 2] = -RV.rand() * (L + 1); }
    var pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    this.pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(bc), size: .09, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: .8 })); this.pts.frustumCulled = false; up.add(this.pts);
    up.traverse(function (o) { o.renderOrder = 4; }); s.add(up);
    /* the hall again, upside down under the floor: its reflection */
    var refl = up.clone(true); refl.scale.y = -1; refl.position.y = 2 * YB; refl.traverse(function (o) { o.renderOrder = 0; }); s.add(refl);
    /* the floor: pale marble in big slabs. It is laid OVER the mirrored hall and lets about two fifths of it through */
    var fc = cv(512, 1024), fx = fc.getContext('2d'); fx.fillStyle = '#d9cab0'; fx.fillRect(0, 0, 512, 1024);
    for (i = 0; i < 70; i++) { var gx0 = RV.rand() * 512, gy0 = RV.rand() * 1024, gr = 60 + RV.rand() * 160, g2 = fx.createRadialGradient(gx0, gy0, 2, gx0, gy0, gr), dk = RV.rand() > .5; g2.addColorStop(0, dk ? 'rgba(150,128,96,.10)' : 'rgba(255,253,246,.16)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); fx.fillStyle = g2; fx.fillRect(gx0 - gr, gy0 - gr, gr * 2, gr * 2); }
    for (i = 0; i < 16; i++) { var vx0 = RV.rand() * 512, vy0 = RV.rand() * 1024, va = RV.rand() * 6.283, st; fx.strokeStyle = 'rgba(132,112,84,' + (.1 + RV.rand() * .16) + ')'; fx.lineWidth = .6 + RV.rand() * 1.6; fx.beginPath(); fx.moveTo(vx0, vy0); for (st = 0; st < 26; st++) { va += (RV.rand() - .5) * .7; vx0 += Math.cos(va) * 16; vy0 += Math.sin(va) * 16; fx.lineTo(vx0, vy0); } fx.stroke(); }
    fx.strokeStyle = 'rgba(120,100,72,.16)'; fx.lineWidth = 1.5; for (i = 0; i <= 2; i++) { fx.beginPath(); fx.moveTo(i * 256, 0); fx.lineTo(i * 256, 1024); fx.stroke(); } for (i = 0; i <= 4; i++) { fx.beginPath(); fx.moveTo(0, i * 256); fx.lineTo(512, i * 256); fx.stroke(); }
    var ft = new THREE.CanvasTexture(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(2, 7); ft.anisotropy = 8;
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(HWD * 2, L + 4), basic({ map: ft, transparent: true, opacity: .66, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, YB, -L / 2 - .2); floor.renderOrder = 1; s.add(floor);
    /* the light of the far end and the chandeliers, lying down the middle of the polish */
    var sc = cv(64, 256), sx = sc.getContext('2d'), sg = sx.createLinearGradient(0, 0, 64, 0); sg.addColorStop(0, 'rgba(255,240,205,0)'); sg.addColorStop(.5, 'rgba(255,244,214,.9)'); sg.addColorStop(1, 'rgba(255,240,205,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 64, 256);
    var streak = new THREE.Mesh(new THREE.PlaneGeometry(1.5, L + 2), basic({ map: new THREE.CanvasTexture(sc), transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); streak.rotation.x = -Math.PI / 2; streak.position.set(0, YB + .004, -L / 2 - 1.2); streak.renderOrder = 2; s.add(streak);
    /* the shadow each arrangement stands in */
    var hc = cv(128, 64), hx = hc.getContext('2d'), hg = hx.createRadialGradient(64, 32, 2, 64, 32, 62); hg.addColorStop(0, 'rgba(52,38,20,.8)'); hg.addColorStop(.55, 'rgba(52,38,20,.38)'); hg.addColorStop(1, 'rgba(52,38,20,0)'); hx.save(); hx.scale(1, .5); hx.translate(0, 32); hx.fillStyle = hg; hx.fillRect(0, -32, 128, 128); hx.restore();
    var ht = new THREE.CanvasTexture(hc), hm = basic({ map: ht, transparent: true, depthWrite: false, opacity: .8 });
    this.blobs.forEach(function (b) { var m = new THREE.Mesh(new THREE.PlaneGeometry(b[2] * 1.7, b[2] * 1.0), hm); m.rotation.x = -Math.PI / 2; m.position.set(b[0] + (b[0] < 0 ? .1 : -.1), YB + .006, b[1] + .12); m.renderOrder = 3; s.add(m); });
    /* the light at the far end, and its flare through the doors */
    var rc = cv(256, 256), rx = rc.getContext('2d'), rg = rx.createRadialGradient(128, 128, 2, 128, 128, 128); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.12, 'rgba(255,244,210,.95)'); rg.addColorStop(.4, 'rgba(255,220,150,.3)'); rg.addColorStop(1, 'rgba(255,200,120,0)'); rx.fillStyle = rg; rx.fillRect(0, 0, 256, 256);
    rx.globalCompositeOperation = 'lighter'; for (i = 0; i < 14; i++) { var an = i / 14 * 6.283 + .2, len = 120 * (.55 + .45 * ((i * 7) % 5) / 4), lg = rx.createLinearGradient(128, 128, 128 + Math.cos(an) * len, 128 + Math.sin(an) * len); lg.addColorStop(0, 'rgba(255,246,220,.6)'); lg.addColorStop(1, 'rgba(255,230,170,0)'); rx.strokeStyle = lg; rx.lineWidth = i % 2 ? 2 : 4; rx.beginPath(); rx.moveTo(128, 128); rx.lineTo(128 + Math.cos(an) * len, 128 + Math.sin(an) * len); rx.stroke(); }
    var star = this.star = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), basic({ map: new THREE.CanvasTexture(rc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, opacity: 0 })); star.position.set(0, YB + 1.9, -1.2); star.renderOrder = 7; s.add(star);
    this.YB = YB;
  };
  RV.Aisle.prototype.step = function (dt, t, open, camZ) {
    var P = this.P, i; for (i = 0; i < this.N; i++) { P[i * 3 + 2] += dt * (.35 + (i % 5) * .08); P[i * 3] += Math.sin(t * .6 + i) * dt * .03; P[i * 3 + 1] += Math.cos(t * .5 + i * 1.7) * dt * .03; if (P[i * 3 + 2] > camZ - .3) P[i * 3 + 2] -= this.L + 1; }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.material.size = .09 + .02 * Math.sin(t * 2.3);
    var Q = this.Q; for (i = 0; i < this.NP; i++) { Q[i * 3 + 1] -= dt * (.1 + (i % 4) * .035); Q[i * 3] += Math.sin(t * .8 + i * 1.3) * dt * .09; if (Q[i * 3 + 1] < this.YB + .02) Q[i * 3 + 1] = this.YB + 4.6; if (Q[i * 3 + 2] > camZ - .4) Q[i * 3 + 2] -= this.L + 1; } this.pet.geometry.attributes.position.needsUpdate = true;
    /* the flare: a burst through the gap as the doors part; it then stays ahead of you, small and far */
    var inside = Math.max(0, Math.min(1, (1.5 - camZ) / 2.5)); this.star.material.opacity = Math.min(1, open * 2.2) * (.72 - .5 * inside) * (.9 + .1 * Math.sin(t * 3.1)); this.star.position.z = Math.min(-1.2, camZ - 10); this.star.scale.setScalar(.4 + open * .5); this.star.rotation.z = t * .05;
  };
})();
