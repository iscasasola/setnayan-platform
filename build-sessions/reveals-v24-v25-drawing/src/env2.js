/* The envelope, in the owner's two styles, built to read as a photograph and not as flat artwork:
   real materials (paper that takes light across its relief, gold foil and wax that mirror a room), soft shadows cast
   by one flap on the next, flaps that bend as paper does while they turn, film tone, and a slow push-in.
   CLASSIC — an ornate scalloped front flap, gold edge, gold seal.  GATEFOLD — two embossed panels that open like doors. */
(function () {
  'use strict';
  var RV = window.RV, W = RV.W, H = RV.H, HW = RV.HW, HH = RV.HH;
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function Hinge(k, c) { this.a = 0; this.v = 0; this.k = k; this.c = c; this.target = 0; }
  Hinge.prototype.step = function (dt) { this.v += (this.k * (this.target - this.a) - this.c * this.v) * dt; this.a += this.v * dt; return this.a; };
  function Body(o) { this.o = o; this.v = new THREE.Vector3(); this.w = new THREE.Vector3(); this.live = false; }
  Body.prototype.kick = function (vx, vy, vz, wx, wy, wz) { this.v.set(vx, vy, vz); this.w.set(wx, wy, wz); this.live = true; };
  Body.prototype.step = function (dt) { if (!this.live) return; this.v.y -= 10.5 * dt; this.o.position.addScaledVector(this.v, dt); this.o.rotation.x += this.w.x * dt; this.o.rotation.y += this.w.y * dt; this.o.rotation.z += this.w.z * dt; };
  function img(name, cb) { var im = new Image(); RV.hold(); im.onload = function () { cb(im); RV.unhold(); }; im.src = window.TEX[name]; }

  /* a room for the gold and the wax to mirror: a soft box overhead, a warm window, a dim floor */
  var ENV = null;
  function room() {
    if (ENV) return ENV; var c = cv(256, 128), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#e9e2d6'); g.addColorStop(.45, '#8f8475'); g.addColorStop(1, '#2c261f'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#ffffff'; x.fillRect(28, 8, 74, 26); x.fillStyle = '#ffe9c2'; x.fillRect(150, 30, 26, 44); x.fillStyle = '#fff6e6'; x.fillRect(206, 14, 34, 12);
    var t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
    var pm = new THREE.PMREMGenerator(RV.renderer); ENV = pm.fromEquirectangular(t).texture; pm.dispose(); return ENV;
  }
  /* a normal map made from a painted canvas: its light-and-dark becomes real relief, and its cut edge a bevel */
  function normalsOf(src, strength) {
    var w = 256, h = Math.round(256 * src.height / src.width), c = cv(w, h), x = c.getContext('2d'); x.drawImage(src, 0, 0, w, h);
    var d = x.getImageData(0, 0, w, h), p = d.data, hgt = new Float32Array(w * h), i, j;
    for (i = 0; i < w * h; i++) hgt[i] = (p[i * 4] * .3 + p[i * 4 + 1] * .59 + p[i * 4 + 2] * .11) / 255 * (p[i * 4 + 3] / 255);
    for (j = 0; j < h; j++) for (i = 0; i < w; i++) { var l = hgt[j * w + Math.max(0, i - 1)], r = hgt[j * w + Math.min(w - 1, i + 1)], u = hgt[Math.max(0, j - 1) * w + i], dn = hgt[Math.min(h - 1, j + 1) * w + i];
      var nx = (l - r) * strength, ny = (dn - u) * strength, nl = Math.sqrt(nx * nx + ny * ny + 1), o = (j * w + i) * 4; p[o] = (nx / nl * .5 + .5) * 255; p[o + 1] = (ny / nl * .5 + .5) * 255; p[o + 2] = (1 / nl * .5 + .5) * 255; p[o + 3] = 255; }
    x.putImageData(d, 0, 0); return new THREE.CanvasTexture(c);
  }
  /* A FLAP: a sheet that is cut to a shape, lit across its relief, and bends as it turns.
     o: w, h (its box), hinge 'top'|'bottom'|'left'|'right', x, y, z (box centre), shape(ctx,cw,ch) path, paint(ctx,cw,ch), foil(ctx,cw,ch) */
  function Flap(scene, o) {
    var cw = 512, ch = Math.round(512 * o.h / o.w), col = cv(cw, ch), cx = col.getContext('2d'), msk = cv(cw, ch), mx = msk.getContext('2d'), mr = cv(cw, ch), rx = mr.getContext('2d');
    mx.fillStyle = '#000'; mx.fillRect(0, 0, cw, ch); mx.fillStyle = '#fff'; o.shape(mx, cw, ch); mx.fill();
    cx.save(); o.shape(cx, cw, ch); cx.clip(); o.paint(cx, cw, ch); cx.restore();
    rx.fillStyle = 'rgb(0,214,0)'; rx.fillRect(0, 0, cw, ch); if (o.foil) { rx.strokeStyle = 'rgb(0,70,255)'; rx.fillStyle = 'rgb(0,70,255)'; o.foil(rx, cw, ch); cx.strokeStyle = o.foilColor || '#c9a24e'; cx.fillStyle = o.foilColor || '#c9a24e'; o.foil(cx, cw, ch); }
    var map = new THREE.CanvasTexture(col); map.encoding = THREE.sRGBEncoding; map.anisotropy = 4; var mask = new THREE.CanvasTexture(msk);
    var nx = o.nx || 20, ny = o.ny || 26, geo = this.geo = new THREE.PlaneGeometry(o.w, o.h, nx, ny), self = this;
    var front = new THREE.MeshStandardMaterial({ map: map, alphaMap: mask, alphaTest: .5, normalMap: normalsOf(col, o.relief || 5), normalScale: new THREE.Vector2(1, 1), roughnessMap: new THREE.CanvasTexture(mr), metalnessMap: null, roughness: 1, metalness: 0, envMapIntensity: .55 });
    front.metalnessMap = front.roughnessMap; front.metalness = 1;
    var back = new THREE.MeshStandardMaterial({ color: o.liner || 0xe7dcc6, alphaMap: mask, alphaTest: .5, roughness: .9, side: THREE.BackSide, envMapIntensity: .3 });
    var dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: mask, alphaTest: .5, side: THREE.DoubleSide });
    this.g = new THREE.Group(); [front, back].forEach(function (m) { var me = new THREE.Mesh(geo, m); me.castShadow = true; me.receiveShadow = true; me.customDepthMaterial = dm; me.frustumCulled = false; self.g.add(me); });
    this.g.position.set(o.x, o.y, o.z); scene.add(this.g);
    this.o = o; this.L = (o.hinge === 'top' || o.hinge === 'bottom') ? o.h : o.w; this.base = Float32Array.from(geo.attributes.position.array); this.h = o.spring; this.at = o.at; this.pa = 0;
  }
  Flap.prototype.set = function (a, curl) {
    /* every row of the sheet turns a little less than the row before it: the free edge trails, as paper does */
    var o = this.o, p = this.geo.attributes.position, b = this.base, L = this.L, N = 24, cy = [0], cz = [0], i;
    for (i = 1; i <= N; i++) { var s = (i - .5) / N, th = a - curl * s * s; cy.push(cy[i - 1] + L / N * Math.cos(th)); cz.push(cz[i - 1] + L / N * Math.sin(th)); }
    for (i = 0; i < p.count; i++) { var x = b[i * 3], y = b[i * 3 + 1], d = o.hinge === 'top' ? o.h / 2 - y : o.hinge === 'bottom' ? y + o.h / 2 : o.hinge === 'left' ? x + o.w / 2 : o.w / 2 - x, f = Math.max(0, Math.min(1, d / L)) * N, k = Math.min(N - 1, Math.floor(f)), u = f - k, py = cy[k] + (cy[k + 1] - cy[k]) * u, pz = cz[k] + (cz[k + 1] - cz[k]) * u;
      if (o.hinge === 'top') p.setXYZ(i, x, o.h / 2 - py, pz); else if (o.hinge === 'bottom') p.setXYZ(i, x, -o.h / 2 + py, pz); else if (o.hinge === 'left') p.setXYZ(i, -o.w / 2 + py, y, pz); else p.setXYZ(i, o.w / 2 - py, y, pz); }
    p.needsUpdate = true; this.geo.computeVertexNormals(); this.tip = { d: cy[N], z: cz[N], th: a - curl };
  };
  Flap.prototype.step = function (dt, tau) {
    if (tau >= this.at) this.h.target = 3.0; else if (tau >= 0 && tau > this.at - .25) this.h.target = -.03;
    var a = this.h.step(dt), w = dt > 0 ? (a - this.pa) / dt : 0; this.pa = a; this.set(a, Math.max(-.5, Math.min(.9, w * .16 + Math.sin(a) * .12)));
  };
  function sealBump(leaf) {
    var c = cv(256, 256), x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
    var g = x.createRadialGradient(128, 128, 20, 128, 128, 126); g.addColorStop(0, '#9a9a9a'); g.addColorStop(.72, '#8a8a8a'); g.addColorStop(.86, '#c8c8c8'); g.addColorStop(1, '#5a5a5a'); x.fillStyle = g; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill();
    x.strokeStyle = '#e8e8e8'; x.lineWidth = 5; x.beginPath(); x.arc(128, 128, 86, 0, 7); x.stroke(); x.strokeStyle = '#3c3c3c'; x.lineWidth = 3; x.beginPath(); x.arc(128, 128, 78, 0, 7); x.stroke();
    var tex = new THREE.CanvasTexture(c);
    img('mono', function (m) { x.globalCompositeOperation = 'lighten'; x.drawImage(m, 58, 58, 140, 140); x.globalCompositeOperation = 'source-over'; tex.needsUpdate = true; });   /* the couple's own monogram, pressed into the wax */
    return tex;
  }
  /* a wax seal in two halves. It does not shatter: it stays on the paper it was pressed on, and goes where that paper goes */
  function makeSeal(scene, color, rough, leaf, R, vertical, metal) {
    var wax = new THREE.MeshPhysicalMaterial({ color: color, metalness: metal == null ? .82 : metal, roughness: rough, clearcoat: .55, clearcoatRoughness: .25, bumpMap: sealBump(leaf), bumpScale: .045, side: THREE.DoubleSide, envMapIntensity: 1.1 }), halves = [], i;
    [0, 1].forEach(function (hf) {
      var prof = [new THREE.Vector2(0, .085)]; for (i = 0; i <= 8; i++) { var a = i / 8 * Math.PI / 2; prof.push(new THREE.Vector2(R * .8 + Math.sin(a) * R * .16, Math.cos(a) * .085)); } prof.push(new THREE.Vector2(R, 0));
      var geo = new THREE.LatheGeometry(prof, 36, hf * Math.PI - (vertical ? 0 : Math.PI / 2), Math.PI), p = geo.attributes.position, uv = geo.attributes.uv;
      for (i = 0; i < p.count; i++) { var x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), an = Math.atan2(z, x), wob = r > R * .66 ? 1 + .06 * Math.sin(an * 5 + 1) + .035 * Math.sin(an * 11) : 1; p.setX(i, x * wob); p.setZ(i, z * wob); uv.setXY(i, x * wob / (R * 2.05) + .5, .5 - z * wob / (R * 2.05)); }
      geo.computeVertexNormals(); geo.rotateX(Math.PI / 2);
      var mesh = new THREE.Mesh(geo, wax); mesh.castShadow = true; var g = new THREE.Group(); g.add(mesh); scene.add(g); halves.push(g);
    });
    return halves;
  }
  /* what is inside the envelope: its lining, and a warm light that pours out as the flaps part, swells to fill the
     screen, and then clears to the card (the owner's reference: light before the card) */
  function Inside(scene, cy) {
    var c = cv(128, 222), x = c.getContext('2d'), g = x.createRadialGradient(64, 111, 6, 64, 111, 130); g.addColorStop(0, '#e6cf9c'); g.addColorStop(.5, '#c9ac6e'); g.addColorStop(1, '#8f7440'); x.fillStyle = g; x.fillRect(0, 0, 128, 222);
    var lt = new THREE.CanvasTexture(c); lt.encoding = THREE.sRGBEncoding;
    this.inner = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.04, H * 1.04), new THREE.MeshBasicMaterial({ map: lt, transparent: true })); this.inner.position.z = -.05; this.inner.visible = false; scene.add(this.inner);
    var gc = cv(128, 128), gx = gc.getContext('2d'), gg = gx.createRadialGradient(64, 64, 2, 64, 64, 64); gg.addColorStop(0, 'rgba(255,246,214,1)'); gg.addColorStop(.35, 'rgba(255,214,140,.7)'); gg.addColorStop(1, 'rgba(255,190,90,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, W * 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); this.glow.position.set(0, cy, -.03); scene.add(this.glow);
    this.rays = []; for (var i = 0; i < 0; i++) { var a = i / 9 * 6.283 + .3, rg = new THREE.BufferGeometry(), w = .16; rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, cy, -.02, 0, cy, -.02, Math.cos(a - w) * 4.2, cy + Math.sin(a - w) * 4.2, 1.6, Math.cos(a + w) * 4.2, cy + Math.sin(a + w) * 4.2, 1.6]), 3)); rg.setIndex([0, 2, 3]);
      var ray = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffe2a4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide })); ray.renderOrder = 6; scene.add(ray); this.rays.push(ray); }
    this.lamp = new THREE.PointLight(0xffd9a0, 0, 7); this.lamp.position.set(0, cy, .5); scene.add(this.lamp);
    this.bloom = new THREE.Mesh(new THREE.PlaneGeometry(20, 30), new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false })); this.bloom.renderOrder = 10; scene.add(this.bloom);
  }
  Inside.prototype.step = function (t, open, x) {
    var ss = RV.ss, o = Math.max(0, Math.min(1, open));
    this.glow.material.opacity = Math.min(.55, o * .9) * (1 - ss(.55, .95, x)); this.glow.scale.setScalar(.5 + o * 1.6); this.lamp.intensity = 1.3 * o * (1 - ss(.55, .95, x));
    this.rays.forEach(function (r, i) { r.material.opacity = o * (.13 + .06 * Math.sin(t * 1.1 + i * 2.1)); });
    this.bloom.position.set(RV.camera.position.x, RV.camera.position.y, RV.camera.position.z - 1.2); this.bloom.material.opacity = 0;
    this.inner.material.opacity = 1 - ss(.76, .84, x);
  };
  function stage(scene) {
    scene.environment = room(); scene.add(new THREE.AmbientLight(0xfff1dc, .28));
    var k = new THREE.DirectionalLight(0xfff4e2, 1.25); k.position.set(-2.6, 3.8, 5.2); k.castShadow = true; k.shadow.mapSize.set(2048, 2048); var c = k.shadow.camera; c.left = -3; c.right = 3; c.top = 4; c.bottom = -4; c.near = 1; c.far = 20; k.shadow.bias = -.0012; k.shadow.normalBias = .02; k.shadow.radius = 6; scene.add(k);
    var f = new THREE.DirectionalLight(0xdfe6ff, .22); f.position.set(3, -1, 4); scene.add(f); RV.shadowPlane(-.03, .5);
  }
  RV.pbrStage = stage; RV.room = room;

  /* what a host may choose for an envelope (owner, 23 Nov: "envelopes must have different designs and can color change also") */
  var PAPER = { ivory: null, blush: '#f3cfc9', sage: '#cbd9c2', dusty: '#bfcde2', burgundy: '#7c2334', navy: '#2a3a66' };
  var PCH = [['ivory', 'Ivory'], ['blush', 'Blush'], ['sage', 'Sage'], ['dusty', 'Dusty blue'], ['burgundy', 'Burgundy'], ['navy', 'Navy']];
  var SEAL = { gold: [0xb98a2c, .3, .82, '#c9a24e'], rose: [0xc48a76, .3, .82, '#d7a08f'], silver: [0xb4b8c0, .28, .85, '#c7cad1'], burgundy: [new THREE.Color(0x6d1622).convertSRGBToLinear(), .36, .12, '#c9a24e'], sage: [new THREE.Color(0x7f9475).convertSRGBToLinear(), .4, .1, '#c9a24e'] };   /* colour, roughness, how metallic, the foil that goes with it */
  var SCH = [['gold', 'Gold'], ['rose', 'Rose gold'], ['silver', 'Silver'], ['burgundy', 'Burgundy wax'], ['sage', 'Sage wax']];
  var GRIB = { blush: ['#8a4a5e', '#bd7487', '#cf8c9c'], ivory: ['#b3a78c', '#e4dac3', '#faf4e6'], sage: ['#5b6f52', '#99ad8d', '#c1d0b6'], dusty: ['#51648a', '#8ea3c8', '#b7c7e2'], burgundy: ['#3d0e19', '#782132', '#9a3243'], gold: ['#73531a', '#bf963a', '#e6c463'] };
  function tint(x, cw, ch, name) { var c = PAPER[name]; if (!c) return; x.globalCompositeOperation = 'multiply'; x.fillStyle = c; x.fillRect(0, 0, cw, ch); x.globalCompositeOperation = 'source-over'; }
  RV.options('envelope', [
    { key: 'flap', label: 'Flap shape', choices: [['scallop', 'Scalloped'], ['deepv', 'Deep V'], ['euro', 'Pointed Euro'], ['round', 'Rounded'], ['square', 'Square'], ['double', 'Double scallop'], ['deckle', 'Deckle edge']] },
    { key: 'design', label: 'Flap design', choices: [['damask', 'Damask'], ['lily', 'Lilies'], ['plain', 'Plain with gold edge']] },
    { key: 'color', label: 'Paper colour', choices: PCH },
    { key: 'seal', label: 'Seal', choices: SCH }]);
  RV.options('gatefold', [
    { key: 'closure', label: 'Closed with', choices: [['seal', 'Wax seal'], ['ribbon', 'Ribbon and bow']] },
    { key: 'design', label: 'Panel design', choices: [['lily', 'Sculpted lilies'], ['damask', 'Damask'], ['plain', 'Plain with border'], ['deco', 'Art deco'], ['botanical', 'Botanical line'], ['lace', 'Lace'], ['geo', 'Geometric'], ['monogram', 'Monogram field'], ['pressed', 'Pressed florals']] },
    { key: 'color', label: 'Paper colour', choices: PCH },
    { key: 'ribbon', label: 'Ribbon', choices: [['blush', 'Blush'], ['ivory', 'Ivory'], ['sage', 'Sage'], ['dusty', 'Dusty blue'], ['burgundy', 'Burgundy'], ['gold', 'Gold']] },
    { key: 'seal', label: 'Seal', choices: SCH }]);

  /* ---------- 3a · Envelope, classic ---------- */
  RV.register('envelope', {
    label: 'Envelope · classic', T: 6.6, pbr: true, exposure: 1.05,
    init: function () {
      var s = RV.scene, self = this, TY = HH - H * .56, YS = HH - H * .27; stage(s); this.flaps = [];
      var des = RV.opt('envelope', 'design'), pc = RV.opt('envelope', 'color'), sl = SEAL[RV.opt('envelope', 'seal')], fc = sl[3], deep = pc === 'burgundy' || pc === 'navy', lin = PAPER[pc] ? new THREE.Color(PAPER[pc]).convertSRGBToLinear().multiplyScalar(.9) : 0xe7dcc6;
      img('paperR', function (paper) { img(des === 'lily' ? 'callaR' : 'damaskR', function (dam) {
        function plain(x, cw, ch) { x.drawImage(paper, 130, 130, 330, 300, 0, 0, cw, ch); x.fillStyle = 'rgba(255,250,240,.18)'; x.fillRect(0, 0, cw, ch); tint(x, cw, ch, pc); }
        var hb = TY + HH;                                            /* bottom flap: from the foot up to the seal */
        self.flaps.push(new Flap(s, { w: W, h: hb, hinge: 'bottom', x: 0, y: -HH + hb / 2, z: 0, at: 4.4, spring: new Hinge(4.6, 3.3), relief: 3, foilColor: fc, liner: lin,
          shape: function (x, cw, ch) { x.beginPath(); x.moveTo(0, ch); x.lineTo(cw, ch); x.lineTo(cw / 2, 0); x.closePath(); }, paint: function (x, cw, ch) { plain(x, cw, ch);
            x.fillStyle = deep ? '#e6c98a' : '#a8843a'; x.textAlign = 'center'; x.font = '500 ' + Math.round(cw * .075) + 'px Georgia, serif'; x.fillText('Tap to open', cw / 2, ch * .5); },
          foil: function (x, cw, ch) { x.lineWidth = 3; x.beginPath(); x.moveTo(4, ch - 2); x.lineTo(cw / 2, 5); x.lineTo(cw - 4, ch - 2); x.stroke(); x.lineWidth = 2; var y = ch * .6; x.beginPath(); x.moveTo(cw * .3, y); x.lineTo(cw * .455, y); x.moveTo(cw * .545, y); x.lineTo(cw * .7, y); x.stroke(); x.beginPath(); x.moveTo(cw / 2, y - 14); x.lineTo(cw / 2 + 13, y); x.lineTo(cw / 2, y + 14); x.lineTo(cw / 2 - 13, y); x.closePath(); x.stroke(); } }));
        [-1, 1].forEach(function (side) {                             /* the side flaps, meeting under the seal */
          self.flaps.push(new Flap(s, { w: HW, h: H, hinge: side < 0 ? 'left' : 'right', x: side * HW / 2, y: 0, z: side < 0 ? .014 : .028, at: side < 0 ? 3.0 : 3.7, spring: new Hinge(4.6, 3.3), relief: 3, foilColor: fc, liner: lin,
            shape: function (x, cw, ch) { var ty = (HH - TY) / H * ch; x.beginPath(); if (side < 0) { x.moveTo(0, 0); x.lineTo(cw, ty); x.lineTo(0, ch); } else { x.moveTo(cw, 0); x.lineTo(0, ty); x.lineTo(cw, ch); } x.closePath(); }, paint: plain,
            foil: function (x, cw, ch) { var ty = (HH - TY) / H * ch; x.lineWidth = 2; x.beginPath(); if (side < 0) { x.moveTo(2, 2); x.lineTo(cw - 3, ty); x.lineTo(2, ch - 2); } else { x.moveTo(cw - 2, 2); x.lineTo(3, ty); x.lineTo(cw - 2, ch - 2); } x.stroke(); } }));
        });
        var ht = HH - TY;                                           /* the front flap: scalloped, embossed, edged in gold */
        function scallop(x, cw, ch, inset, nn, bg) { var y0 = (HH - YS) / ht * ch, n = nn || 3, i, ax, ay, bx, by; bg = bg || .075; x.beginPath(); x.moveTo(inset, 0); x.lineTo(inset, y0 - inset);
          for (i = 1; i <= n; i++) { ax = inset + (cw / 2 - inset) * (i - 1) / n; ay = y0 + (ch - y0) * (i - 1) / n - inset; bx = inset + (cw / 2 - inset) * i / n; by = y0 + (ch - y0) * i / n - inset; x.quadraticCurveTo((ax + bx) / 2 - cw * .035, (ay + by) / 2 + ch * bg, bx, by); }
          for (i = n; i >= 1; i--) { ax = cw - (inset + (cw / 2 - inset) * i / n); ay = y0 + (ch - y0) * i / n - inset; bx = cw - (inset + (cw / 2 - inset) * (i - 1) / n); by = y0 + (ch - y0) * (i - 1) / n - inset; x.quadraticCurveTo((ax + bx) / 2 + cw * .035, (ay + by) / 2 + ch * bg, bx, by); }
          x.lineTo(cw - inset, 0); x.closePath(); }
        /* the flap's outline, by shape. The flap is BL times the width of the screen, so its shoulders and upright sides
           are never in view: only the lower edge crosses the screen, and the envelope reads as larger than the screen. */
        var BL = 1.34, fk = RV.opt('envelope', 'flap');
        function hsh(i, j) { var h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); }
        function outline(x, cw, ch, inset) {
          var y0 = (HH - YS) / ht * ch, m = cw / 2, b = ch - inset, i;
          if (fk === 'scallop') return scallop(x, cw, ch, inset, 3, .075); if (fk === 'double') return scallop(x, cw, ch, inset, 2, .13);
          x.beginPath(); x.moveTo(inset, 0);
          if (fk === 'deepv') { x.lineTo(inset, y0 * .25); x.lineTo(m, b); x.lineTo(cw - inset, y0 * .25); }
          else if (fk === 'euro') { x.lineTo(inset, y0 * .55); x.quadraticCurveTo(cw * .34, ch * .8, m, b); x.quadraticCurveTo(cw * .66, ch * .8, cw - inset, y0 * .55); }
          else if (fk === 'round') { var cy2 = y0 * .8 + (b - y0 * .8) / .75; x.lineTo(inset, y0 * .8); x.bezierCurveTo(cw * .16, cy2, cw * .84, cy2, cw - inset, y0 * .8); }
          else if (fk === 'square') { var rr = ch * .05; x.lineTo(inset, b - rr); x.quadraticCurveTo(inset, b, inset + rr, b); x.lineTo(cw - inset - rr, b); x.quadraticCurveTo(cw - inset, b, cw - inset, b - rr); }
          else { var n2 = 54, ys = y0 * .6; x.lineTo(inset, ys); for (i = 1; i <= n2; i++) { var u = i / n2; x.lineTo(inset + (m - inset) * u, ys + (b - ys) * Math.pow(u, 1.12) + (i < n2 ? (hsh(i, 3) - .5) * ch * .024 : 0)); } for (i = n2 - 1; i >= 0; i--) { var u2 = i / n2; x.lineTo(cw - inset - (m - inset) * u2, ys + (b - ys) * Math.pow(u2, 1.12) + (i ? (hsh(i, 7) - .5) * ch * .024 : 0)); } }
          x.lineTo(cw - inset, 0); x.closePath();
        }
        self.flaps.push(new Flap(s, { w: W * BL, h: ht, hinge: 'top', x: 0, y: HH - ht / 2, z: .045, at: .9, spring: new Hinge(2.6, 2.6), relief: des === 'plain' ? 3 : 7, nx: 24, ny: 30, foilColor: fc, liner: lin,
          shape: function (x, cw, ch) { outline(x, cw, ch, 0); }, paint: function (x, cw, ch) { plain(x, cw, ch); if (des === 'plain') return; var ax0 = cw * (.5 - .46 / BL), aw = cw * .92 / BL; x.globalCompositeOperation = 'multiply'; if (des === 'lily') x.drawImage(dam, dam.width * .1, dam.height * .08, dam.width * .8, dam.height * .5, ax0, ch * .02, aw, ch * .9); else x.drawImage(dam, 40, 76, 480, 500, ax0, ch * .02, aw, ch * .9); x.globalCompositeOperation = 'source-over'; },
          foil: function (x, cw, ch) { x.lineWidth = 5; outline(x, cw, ch, 5); x.stroke(); x.lineWidth = 1.6; outline(x, cw, ch, 15); x.stroke(); } }));
        self.flaps.forEach(function (f) { f.set(0, 0); });
      }); });
      this.seal = makeSeal(s, sl[0], sl[1], false, .5, false, sl[2]); this.TY = TY; this.inside = new Inside(s, TY);
    },
    step: function (dt, t, tau) {
      var top = null; this.flaps.forEach(function (f) { f.step(dt, tau); if (f.o.hinge === 'top') top = f; });
      if (top && top.tip) { var tp = top.tip, y = HH - tp.d + .03 * Math.cos(tp.th), z = .045 + tp.z + .07; this.seal.forEach(function (h) { h.position.set(0, y, z); h.rotation.x = -tp.th; }); }   /* the seal stays on the flap's point and rises with it */
      else this.seal.forEach(function (h) { h.position.set(0, HH - H * .56 + .03, .115); });
      this.inside.step(t, top ? top.h.a / 2.2 : 0, tau < 0 ? 0 : tau / 6.6);
    },
    done: function (tau) { return tau > 6.6; }
  });

  /* Panel designs drawn in code. Each is drawn across BOTH panels (FW = the whole envelope), then pressed into the paper:
     a shadow below and to the right, a highlight above and to the left, so the relief map reads it as embossed. */
  function hs2(i, j) { var h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); }
  function press(x, fn) { x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; [[3, 3.4, 'rgba(62,44,20,.72)'], [-2.2, -2.6, 'rgba(255,255,255,.95)'], [0, 0, 'rgba(150,120,74,.7)']].forEach(function (o) { x.save(); x.translate(o[0], o[1]); x.strokeStyle = o[2]; x.fillStyle = o[2]; fn(x); x.restore(); }); x.restore(); }
  function leaf(x, px, py, an, L) { x.save(); x.translate(px, py); x.rotate(an); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(L * .5, -L * .28, L, 0); x.quadraticCurveTo(L * .5, L * .28, 0, 0); x.moveTo(0, 0); x.lineTo(L * .9, 0); x.stroke(); x.restore(); }
  function bloom(x, px, py, R, rot, np) { var k; x.save(); x.translate(px, py); x.rotate(rot); for (k = 0; k < np; k++) { x.rotate(6.283 / np); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(R * .5, -R * .25, R * .95, -R * .3, R, 0); x.bezierCurveTo(R * .95, R * .3, R * .5, R * .25, 0, 0); x.stroke(); } x.beginPath(); x.arc(0, 0, R * .16, 0, 7); x.fill(); x.restore(); }
  var PROC = {
    deco: function (x, FW, FH) { var cx = FW / 2, cy = FH * .42, i, k; x.lineWidth = 4;
      for (i = 0; i < 32; i++) { var a = i / 32 * 6.283, r0 = FW * (i % 2 ? .3 : .22); x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(cx + Math.cos(a) * FH, cy + Math.sin(a) * FH); x.stroke(); }
      [.13, .17, .22].forEach(function (r) { x.beginPath(); x.arc(cx, cy, FW * r, 0, 7); x.stroke(); }); x.lineWidth = 6;
      [[0, 0, 1, 1], [FW, 0, -1, 1], [0, FH, 1, -1], [FW, FH, -1, -1]].forEach(function (c) { for (k = 1; k <= 3; k++) { var d = 40 + k * 34; x.beginPath(); x.moveTo(c[0] + c[2] * d, c[1] + c[3] * (d + 150)); x.lineTo(c[0] + c[2] * d, c[1] + c[3] * d); x.lineTo(c[0] + c[2] * (d + 150), c[1] + c[3] * d); x.stroke(); } }); },
    geo: function (x, FW, FH) { var sp = FW / 5, i, o; x.lineWidth = 3; for (i = -14; i < 14; i++) for (o = 0; o < 2; o++) { x.beginPath(); x.moveTo(i * sp + o * 9, 0); x.lineTo(i * sp + o * 9 + FH * .58, FH); x.stroke(); x.beginPath(); x.moveTo(i * sp - o * 9, 0); x.lineTo(i * sp - o * 9 - FH * .58, FH); x.stroke(); } },
    botanical: function (x, FW, FH) { x.lineWidth = 3.5; [-1, 1].forEach(function (sg) { [[.05, .34, .3, .04, 1], [.12, .2, .42, .46, .62]].forEach(function (st, si) {
        var p0 = [FW / 2 + sg * FW * st[0], FH], p1 = [FW / 2 + sg * FW * st[1], FH * .72], p2 = [FW / 2 + sg * FW * st[2] * .5, FH * (st[3] + .3)], p3 = [FW / 2 + sg * FW * st[2], FH * st[3]], t, n = 13;
        x.beginPath(); x.moveTo(p0[0], p0[1]); x.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]); x.stroke();
        for (t = 1; t <= n; t++) { var u = t / (n + .5), v = 1 - u, bx = v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], by = v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1], tx = 3 * v * v * (p1[0] - p0[0]) + 6 * v * u * (p2[0] - p1[0]) + 3 * u * u * (p3[0] - p2[0]), ty = 3 * v * v * (p1[1] - p0[1]) + 6 * v * u * (p2[1] - p1[1]) + 3 * u * u * (p3[1] - p2[1]);
          leaf(x, bx, by, Math.atan2(ty, tx) + (t % 2 ? 1 : -1) * .85, FW * .15 * st[4] * (1.05 - u * .5)); } }); }); },
    lace: function (x, FW, FH) { var R = FW / 16, i, k, cx = FW / 2, cy = FH * .42; x.lineWidth = 3;
      for (i = 0; i * R * 2 < FH + R; i++) [0, FW].forEach(function (ex) { x.beginPath(); x.arc(ex, i * R * 2, R * 1.9, 0, 7); x.stroke(); x.beginPath(); x.arc(ex, i * R * 2, R * 1.1, 0, 7); x.stroke(); });
      for (i = 0; i * R * 2 < FW + R; i++) [0, FH].forEach(function (ey) { x.beginPath(); x.arc(i * R * 2, ey, R * 1.9, 0, 7); x.stroke(); });
      [[.34, 18], [.24, 14], [.14, 10]].forEach(function (rg) { for (k = 0; k < rg[1]; k++) { var a = k / rg[1] * 6.283; x.save(); x.translate(cx + Math.cos(a) * FW * rg[0], cy + Math.sin(a) * FW * rg[0]); x.rotate(a); x.beginPath(); x.ellipse(0, 0, FW * .05, FW * .028, 0, 0, 7); x.stroke(); x.restore(); } x.beginPath(); x.arc(cx, cy, FW * (rg[0] - .055), 0, 7); x.stroke(); });
      for (i = 0; i < 46; i++) for (k = 0; k < 70; k++) { var px = (i + (k % 2) * .5) * 24, py = k * 26; if (Math.hypot(px - cx, py - cy) > FW * .41 && px > R * 2.4 && px < FW - R * 2.4 && py > R * 2.4 && py < FH - R * 2.4) { x.beginPath(); x.arc(px, py, 2.4, 0, 7); x.fill(); } } },
    pressed: function (x, FW, FH) { var i; x.lineWidth = 2.8; for (i = 0; i < 30; i++) bloom(x, hs2(i, 1) * FW, hs2(i, 2) * FH, FW * (.045 + hs2(i, 3) * .06), hs2(i, 4) * 6.283, 5 + Math.floor(hs2(i, 5) * 3));
      for (i = 0; i < 22; i++) { var px = hs2(i, 11) * FW, py = hs2(i, 12) * FH, an = hs2(i, 13) * 6.283, L = FW * .12, k; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(an) * L, py + Math.sin(an) * L); x.stroke(); for (k = 1; k <= 3; k++) { var qx = px + Math.cos(an) * L * k / 3.4, qy = py + Math.sin(an) * L * k / 3.4; leaf(x, qx, qy, an + .8, L * .34); leaf(x, qx, qy, an - .8, L * .34); } } },
    monogram: function (x, FW, FH, logo) { var st = FW / 3.2, r, c; for (r = -1; r * st * .9 < FH + st; r++) for (c = -1; c < 5; c++) { var px = c * st + (r % 2 ? st / 2 : 0) + st * .3, py = r * st * .9 + st * .4, sz = st * .5; RV.stamp(x, logo, px + 2.5, py + 3, sz, '#46341a', .5); RV.stamp(x, logo, px - 2, py - 2.4, sz, '#ffffff', .9); RV.stamp(x, logo, px, py, sz, '#b3935a', .6); }
      press(x, function (x2) { for (r = -1; r * st * .9 < FH + st; r++) for (c = -1; c < 5; c++) { x2.beginPath(); x2.arc(c * st + (r % 2 ? 0 : st / 2) + st * .3, r * st * .9 + st * .4, 4, 0, 7); x2.fill(); } }); }
  };

  /* ---------- 3b · Envelope, gatefold ---------- */
  RV.register('gatefold', {
    label: 'Envelope · gatefold', T: 7.4, pbr: true, exposure: 1.0,
    init: function () {
      var s = RV.scene, self = this; stage(s); this.flaps = [];
      var tied = this.tied = RV.opt('gatefold', 'closure') === 'ribbon';
      var des = RV.opt('gatefold', 'design'), pc = RV.opt('gatefold', 'color'), sl = SEAL[RV.opt('gatefold', 'seal')], lin = PAPER[pc] ? new THREE.Color(PAPER[pc]).convertSRGBToLinear().multiplyScalar(.9) : 0xe9dfca;
      img(des === 'lily' ? 'callaR' : des === 'damask' ? 'damaskR' : 'paperR', function (calla) { RV.logo(function (logoIm) {
        [-1, 1].forEach(function (side) {
          self.flaps.push(new Flap(s, { w: HW, h: H, hinge: side < 0 ? 'left' : 'right', x: side * HW / 2, y: 0, z: .01, at: (tied ? 3.5 : 1.0) + (side < 0 ? 0 : .35), spring: new Hinge(.95, 2.3), relief: des === 'plain' ? 3 : 9, nx: 18, ny: 30, liner: lin,
            shape: function (x, cw, ch) { x.beginPath(); x.rect(0, 0, cw, ch); }, paint: function (x, cw, ch) { if (PROC[des]) { x.drawImage(calla, 130, 130, 330, 300, 0, 0, cw, ch); x.save(); if (side > 0) x.translate(-cw, 0); if (des === 'monogram') PROC[des](x, cw * 2, ch, logoIm); else press(x, function (x2) { PROC[des](x2, cw * 2, ch); }); x.restore(); } else if (des === 'plain') x.drawImage(calla, 130, 130, 330, 300, 0, 0, cw, ch); else if (des === 'damask') x.drawImage(calla, side < 0 ? calla.width * .1 : calla.width * .5, calla.height * .1, calla.width * .4, calla.height * .8, 0, 0, cw, ch); else x.drawImage(calla, side < 0 ? 0 : calla.width / 2, 0, calla.width / 2, calla.height, 0, 0, cw, ch); tint(x, cw, ch, pc);
              x.strokeStyle = 'rgba(96,80,54,.38)'; x.lineWidth = 3; var a = side < 0 ? 26 : 12, b = side < 0 ? cw - 12 : cw - 26; x.strokeRect(a, 26, b - a, ch - 52); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 2; x.strokeRect(a + 3, 29, b - a, ch - 52);
              var gr = x.createLinearGradient(side < 0 ? cw - 26 : 0, 0, side < 0 ? cw : 26, 0); gr.addColorStop(side < 0 ? 0 : 1, 'rgba(60,44,20,0)'); gr.addColorStop(side < 0 ? 1 : 0, 'rgba(60,44,20,.28)'); x.fillStyle = gr; x.fillRect(side < 0 ? cw - 26 : 0, 0, 26, ch); } }));
        });
        self.flaps.forEach(function (f) { f.set(0, 0); });
      }); });
      /* the bow is tied on the seam, and a gold wax seal with the monogram is pressed over its knot (owner, 23 Nov:
         "envelope gate fold needs to be a wax seal as well"). It is in two halves, one on each panel. */
      this.rib = tied ? new RV.GateRibbon(s, .3, 0, .1, GRIB[RV.opt('gatefold', 'ribbon')]) : null; this.seal = tied ? [] : makeSeal(s, sl[0], sl[1], false, .4, false, sl[2]);   /* ONE whole seal: it is never cut in two (owner, 23 Nov) */ this.inside = new Inside(s, -.12);
    },
    step: function (dt, t, tau) {
      if (this.rib) this.rib.step(dt, t, tau); this.flaps.forEach(function (f) { f.step(dt, tau); });       /* the bow comes undone and the ribbon leaves BEFORE the panels move */
      /* the seal: it rests on the ribbon, settles onto the paper when the ribbon has gone, and when the panels part it
         breaks cleanly down the seam, each half staying on its own panel */
      /* the tap breaks the seal first: a clean crack down the seam, the halves a hair apart. Sealed with wax alone, that is
         the whole closure, and the panels then part slowly; tied, the broken seal lets the ribbon go. */
      var fl = this.flaps, off = this.tied ? .135 - .115 * (tau < 0 ? 0 : RV.ease((tau - 2.7) / .7)) : .02, ck = tau < 0 ? 0 : RV.ease(tau / .45);
      /* the seal stays whole. It is fixed to the left panel, half of it reaching over the seam, and goes with that panel */
      this.seal.forEach(function (h) { var tp = fl[0] && fl[0].tip; if (tp) { h.position.set(-(HW - tp.d) - Math.sin(tp.th) * off, .3, .01 + tp.z + Math.cos(tp.th) * off); h.rotation.set(0, -tp.th, 0); } else h.position.set(0, .3, .01 + off); });
      var a0 = this.flaps[0] ? this.flaps[0].h.a : 0; this.inside.step(t, a0 / 2.2, tau < 0 ? 0 : tau / 7.4);
    },
    done: function (tau) { return tau > 7.4; }
  });
})();
