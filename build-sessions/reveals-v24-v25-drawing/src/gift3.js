/* Gift box, rebuilt as a real object on a table (23 Nov 2026, after the owner held the flat one back).
   A wrapped base and a wrapped lid: paper with fibre, gold-foil monograms, folded ends and mitred corners, no tape.
   A satin ribbon crosses it and is tied in a bow. The bow collapses, the two lengths are drawn off over the edges,
   the lid unseats, lifts with weight and is carried away, light comes up from inside, and the camera swings over the
   box and down onto the card, which is the Event Hub cover. Runs on the veil's clock (core4.js): tau = lift x T. */
(function () {
  'use strict';
  var RV = window.RV, W = RV.W, H = RV.H;
  if (RV.GUST == null) RV.GUST = 0;
  var PP = {};   /* the post pass's target and quad: one set, shared by every time the reveal is started */
  var TILE = 0.86, R15 = Math.tan(15 * Math.PI / 180);
  var CH = 2.9, CW = CH * W / H, CZ = 0.2;                         /* the card inside: the cover, at the screen's own shape */
  var IX = CW / 2 + 0.13, IY = CH / 2 + 0.13, TH = 0.05, BX = IX + TH, BY = IY + TH, BZ = 1.0;   /* base */
  var LX = BX + 0.035, LY = BY + 0.035, ZT = BZ + 0.035, SK = 0.36;                          /* lid: half sizes, top, skirt */
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function seen(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }                 /* colours are written as seen; the renderer works in linear light */
  function hash(i, j) { var h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); }

  /* a normal map from a height canvas (its light and dark become relief) */
  function normals(src, k) {
    var w = src.width, h = src.height, x = src.getContext('2d'), d = x.getImageData(0, 0, w, h), p = d.data, g = new Float32Array(w * h), i, j;
    for (i = 0; i < w * h; i++) g[i] = p[i * 4] / 255;
    var c = cv(w, h), cx = c.getContext('2d'), o = cx.createImageData(w, h), q = o.data;
    for (j = 0; j < h; j++) for (i = 0; i < w; i++) { var l = g[j * w + (i + w - 1) % w], r = g[j * w + (i + 1) % w], u = g[((j + h - 1) % h) * w + i], dn = g[((j + 1) % h) * w + i], nx = (l - r) * k, ny = (dn - u) * k, nl = Math.sqrt(nx * nx + ny * ny + 1), a = (j * w + i) * 4; q[a] = (nx / nl * .5 + .5) * 255; q[a + 1] = (ny / nl * .5 + .5) * 255; q[a + 2] = (1 / nl * .5 + .5) * 255; q[a + 3] = 255; }
    cx.putImageData(o, 0, 0); var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  /* the wrapping paper: deep green stock with fibre in it, the event's monogram printed in gold foil in a half-drop */
  var WRAP = { emerald: '#1d4739', ivory: '#ece2cc', blush: '#e9c2bd', navy: '#1b2a52', burgundy: '#681d2c', kraft: '#ad8756' };
  var RIB = { champagne: ['#8d7446', '#c9b07c', '#e9d6aa'], ivory: ['#b3a78c', '#e4dac3', '#faf4e6'], blush: ['#a3626c', '#d99ea5', '#f0c5c7'], burgundy: ['#2a0810', '#5a1624', '#782433'], gold: ['#73531a', '#bf963a', '#e6c463'], sage: ['#5b6f52', '#99ad8d', '#c1d0b6'] };
  var FOLD = 0x5d9c86;
  RV.options('gift', [
    { key: 'wrap', label: 'Wrap colour', choices: [['emerald', 'Emerald'], ['ivory', 'Ivory'], ['blush', 'Blush'], ['navy', 'Navy'], ['burgundy', 'Burgundy'], ['kraft', 'Kraft']] },
    { key: 'pattern', label: 'Wrap print', choices: [['monogram', 'Your monogram'], ['dots', 'Gold dots'], ['stripes', 'Gold stripes'], ['plain', 'Plain']] },
    { key: 'ribbon', label: 'Ribbon', choices: [['champagne', 'Champagne'], ['ivory', 'Ivory'], ['blush', 'Blush'], ['burgundy', 'Burgundy'], ['gold', 'Gold'], ['sage', 'Sage']] },
    { key: 'bow', label: 'Bow', choices: [['classic', 'Classic bow'], ['double', 'Double bow']] },
    { key: 'floor', label: 'Floor', choices: [['evening', 'Evening linen'], ['wood', 'Warm wood'], ['marble', 'Marble'], ['linen', 'Ivory linen'], ['stone', 'Stone'], ['sand', 'Sand'], ['clouds', 'Cotton clouds'], ['cotton', 'Egyptian cotton'], ['clouds_ivory', 'Ivory clouds']] },
    { key: 'around', label: 'Around the box', choices: [['flowers', 'Flowers'], ['petals', 'Rose petals'], ['pearls', 'Pearls'], ['diamonds', 'Diamonds'], ['confetti', 'Confetti'], ['balloons', 'Balloons'], ['stars', 'Gold stars'], ['none', 'Nothing']] },
    { key: 'lining', label: 'Lining', choices: [['lame', 'Gold lamé'], ['ivory', 'Ivory satin'], ['blush', 'Blush silk'], ['navy', 'Navy velvet'], ['sage', 'Sage linen'], ['card', 'Plain card']] }]);
  function paperMaterial() {
    var S = 512, col = cv(S, S), x = col.getContext('2d'), mr = cv(S, S), m = mr.getContext('2d'), hg = cv(S, S), h = hg.getContext('2d'), i;
    var pat = RV.opt('gift', 'pattern'); x.fillStyle = WRAP[RV.opt('gift', 'wrap')]; x.fillRect(0, 0, S, S); m.fillStyle = 'rgb(0,168,0)'; m.fillRect(0, 0, S, S); h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
    for (i = 0; i < 5200; i++) { var px = RV.rand() * S, py = RV.rand() * S, len = 3 + RV.rand() * 9, an = RV.rand() * 6.283, li = RV.rand() > .5; x.strokeStyle = li ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)'; x.lineWidth = .7; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(an) * len, py + Math.sin(an) * len); x.stroke(); h.strokeStyle = li ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)'; h.lineWidth = .8; h.beginPath(); h.moveTo(px, py); h.lineTo(px + Math.cos(an) * len, py + Math.sin(an) * len); h.stroke(); }
    var map = new THREE.CanvasTexture(col), rm = new THREE.CanvasTexture(mr), nm = normals(hg, 2.2);
    [map, rm].forEach(function (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }); nm.anisotropy = 8; map.encoding = THREE.sRGBEncoding;
    var mat = new THREE.MeshStandardMaterial({ map: map, roughnessMap: rm, metalnessMap: rm, normalMap: nm, normalScale: new THREE.Vector2(.7, .7), roughness: 1, metalness: 1, envMapIntensity: .4, side: THREE.DoubleSide });
    RV.logo(function (logo) {
      var inks = ['#d9b566', 'rgb(0,74,255)', '#b4b4b4'];
      if (pat === 'monogram') [[128, 128], [384, 384]].forEach(function (c) { RV.stamp(x, logo, c[0], c[1], 150, '#d9b566', 1); RV.stamp(m, logo, c[0], c[1], 150, 'rgb(0,74,255)', 1); RV.stamp(h, logo, c[0], c[1], 150, '#b4b4b4', 1); });
      if (pat === 'stripes') [x, m, h].forEach(function (k, n) { k.fillStyle = inks[n]; for (var sx = 0; sx < S; sx += 128) { k.fillRect(sx + 20, 0, 12, S); k.fillRect(sx + 44, 0, 3, S); } });
      if (pat === 'monogram' || pat === 'dots') (pat === 'dots' ? [[128, 128], [384, 384]] : []).concat([[384, 128], [128, 384], [0, 0], [256, 256], [0, 256], [256, 0]]).forEach(function (c) { [[0, 0], [S, 0], [0, S], [S, S]].forEach(function (o) { [x, m, h].forEach(function (k, n) { k.fillStyle = n === 0 ? '#d9b566' : n === 1 ? 'rgb(0,74,255)' : '#b4b4b4'; k.beginPath(); k.arc(c[0] + o[0], c[1] + o[1], pat === 'dots' ? 7 : c[0] % 256 === 0 ? 3.2 : 5, 0, 7); k.fill(); }); }); });
      map.needsUpdate = rm.needsUpdate = true; var n2 = normals(hg, 2.2); nm.image = n2.image; nm.needsUpdate = true;
    });
    return mat;
  }
  function satinMaterial() {
    var rc = RIB[RV.opt('gift', 'ribbon')], t = RV.satinTex(rc[0], rc[1], rc[2]); t.repeat.set(1, 9);
    var hc = cv(128, 128), hx = hc.getContext('2d'), i; hx.fillStyle = '#808080'; hx.fillRect(0, 0, 128, 128);
    for (i = 0; i < 128; i++) { hx.fillStyle = 'rgba(' + (RV.rand() > .5 ? '255,255,255,' : '0,0,0,') + (.05 + RV.rand() * .2) + ')'; hx.fillRect(i, 0, 1, 128); }
    for (i = 0; i < 128; i += 2) { hx.fillStyle = 'rgba(0,0,0,.06)'; hx.fillRect(0, i, 128, 1); }
    var nm = normals(hc, 1.3); nm.repeat.set(1, 9);
    return new THREE.MeshStandardMaterial({ map: t, normalMap: nm, normalScale: new THREE.Vector2(.55, .2), side: THREE.DoubleSide, roughness: .27, metalness: RV.opt('gift', 'ribbon') === 'gold' ? .55 : .18, envMapIntensity: 1.45 });
  }
  /* a flat piece of paper, its print at the same scale on every face */
  function sheet(w, h, sx, sy, ou, ov, turn) {
    var g = new THREE.PlaneGeometry(w, h, sx || 1, sy || 1), p = g.attributes.position, uv = g.attributes.uv, i;
    for (i = 0; i < p.count; i++) { var a = p.getX(i) / TILE + (ou || 0), b = p.getY(i) / TILE + (ov || 0); uv.setXY(i, turn ? b : a, turn ? -a : b); } return g;
  }
  function aim(g, dir) { if (dir === 'y-') g.rotateX(Math.PI / 2); else if (dir === 'y+') { g.rotateX(-Math.PI / 2); } else if (dir === 'x+') g.rotateY(Math.PI / 2); else if (dir === 'x-') g.rotateY(-Math.PI / 2); else if (dir === 'z-') g.rotateX(Math.PI); return g; }
  function put(parent, geo, mat, x, y, z, cast) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast !== false; m.receiveShadow = true; parent.add(m); return m; }
  /* a folded flap of paper lying on a face: its own piece of the print (so the pattern breaks at the fold, as it does),
     a hair proud of the face, with the thin shadow its edge throws */
  function flap(parent, pts, dir, x, y, z, paper, shade, lift, ou) {
    var sh = new THREE.Shape(); pts.forEach(function (p, i) { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); }); sh.closePath();
    var lp = pts.concat([pts[0]]).map(function (q) { return new THREE.Vector3(q[0], q[1], 0); }), lg = aim(new THREE.BufferGeometry().setFromPoints(lp), dir), ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: FOLD, transparent: true, opacity: .55 })), nn = dir === 'y-' ? [0, -1, 0] : [-1, 0, 0]; ln.position.set(x + nn[0] * (lift + .002), y + nn[1] * (lift + .002), z); ln.renderOrder = 3; parent.add(ln);
    [0, 1].forEach(function (k) {
      var g = new THREE.ShapeGeometry(sh), p = g.attributes.position, uv = g.attributes.uv, i; for (i = 0; i < p.count; i++) uv.setXY(i, p.getY(i) / TILE + ou, -p.getX(i) / TILE + ou * 1.7);
      if (!k) g.translate(.009, -.011, 0); aim(g, dir);
      var m = new THREE.Mesh(g, k ? paper : shade), n = dir === 'y-' ? [0, -1, 0] : [-1, 0, 0], d = k ? lift : lift * .5; m.position.set(x + n[0] * d, y + n[1] * d, z); m.receiveShadow = !!k; m.renderOrder = k ? 2 : 1; parent.add(m);
    });
  }

  /* A BAND of ribbon: a chain with weight that lies on whatever is under it (the lid, the box's sides, the table),
     drawn as a strip with real width. Its facing is carried along its length, so it turns the corner of the box as
     ribbon does: flat on the top, flat down the side. */
  function Band(pts, width, mat, o) {
    o = o || {}; var n = this.n = pts.length, M = this.M = o.M || 4, SB = this.SB = o.sub || 3, rows = this.rows = (n - 1) * SB + 1, i, j, idx = [], uv = new Float32Array(rows * (M + 1) * 2);
    this.p = new Float32Array(n * 3); this.q = new Float32Array(n * 3); this.inv = new Float32Array(n); this.rest = new Float32Array(n - 1); this.pin = {}; this.w = width;
    this.nrm = (o.n0 || [0, 0, 1]).slice(); this.twist = o.twist || null; this.camber = o.camber == null ? .008 : o.camber; this.damp = o.damp || .972; this.col = o.col || null; this.fz = o.fz || null; this.r = o.r || .016; this.fl = 0; this.stiff = 0; this.shrink = 1;
    for (i = 0; i < n; i++) { for (j = 0; j < 3; j++) this.p[i * 3 + j] = this.q[i * 3 + j] = pts[i][j]; this.inv[i] = 1; }
    for (i = 0; i < n - 1; i++) this.rest[i] = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2]);
    this.base = Float32Array.from(this.rest); this.shape = Float32Array.from(this.p); this.pos = new Float32Array(rows * (M + 1) * 3); this.fr = new Float32Array(n * 6);
    for (i = 0; i < rows; i++) for (j = 0; j <= M; j++) { uv[(i * (M + 1) + j) * 2] = j / M; uv[(i * (M + 1) + j) * 2 + 1] = i / (rows - 1); if (i < rows - 1 && j < M) { var a = i * (M + 1) + j; idx.push(a, a + 1, a + M + 1, a + 1, a + M + 2, a + M + 1); } }
    var g = this.geo = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false; this.update(0);
  }
  Band.prototype.hold = function (i, x, y, z) { this.inv[i] = 0; this.pin[i] = [x, y, z]; };
  Band.prototype.free = function (i) { this.inv[i] = 1; delete this.pin[i]; };
  Band.prototype.scaleRest = function (s) { for (var i = 0; i < this.n - 1; i++) this.rest[i] = this.base[i] * s; };
  Band.prototype.step = function (dt, g, t) {
    var p = this.p, q = this.q, n = this.n, i, k, dt2 = dt * dt, d = this.damp, r = this.r, c = this.col, it, key;
    for (i = 0; i < n; i++) { if (!this.inv[i]) continue; k = i * 3; var vx = (p[k] - q[k]) * d, vy = (p[k + 1] - q[k + 1]) * d, vz = (p[k + 2] - q[k + 2]) * d; q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2];
      var f = this.fl ? RV.noise(p[k] * 2, p[k + 1] * 2 + i, t * 2) * this.fl : 0, wx = 0, wy = 0, wz = 0;
      if (this.wind && RV.GUST) { var pr = this.wtip ? Math.pow(i / (n - 1), 1.6) : Math.sin(Math.PI * i / (n - 1)), g1 = RV.noise(p[k] * .8 + 3, p[k + 1] * .8, t * .75), g2 = RV.noise(p[k + 1] * 1.1 + 7, p[k] * .7, t * .6), wv = this.wind * pr * RV.GUST; wx = (.35 + g1) * wv * 2.6; wy = g2 * wv * 1.5; wz = Math.max(0, .25 + g1 * g2) * wv * (this.wlift || 0); }   /* the breeze: a force on the loose cloth, never a drawn wiggle */
      p[k] += vx + (f + wx) * dt2; p[k + 1] += vy + (f * .6 + wy) * dt2; p[k + 2] += vz + (g + wz) * dt2; }
    if (this.stiff) { var sh = this.shape, sk = this.shrink; for (i = 0; i < n; i++) { if (!this.inv[i]) continue; k = i * 3; for (var cc = 0; cc < 3; cc++) p[k + cc] += (sh[cc] + (sh[k + cc] - sh[cc]) * sk - p[k + cc]) * this.stiff; } }
    for (it = 0; it < 10; it++) {
      for (key in this.pin) { k = key * 3; p[k] = this.pin[key][0]; p[k + 1] = this.pin[key][1]; p[k + 2] = this.pin[key][2]; }
      for (i = 0; i < n - 1; i++) { var a = i * 3, b = a + 3, dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, wa = this.inv[i], wb = this.inv[i + 1], ws = wa + wb; if (!ws) continue;
        var e = (len - this.rest[i]) / len / ws; p[a] += dx * e * wa; p[a + 1] += dy * e * wa; p[a + 2] += dz * e * wa; p[b] -= dx * e * wb; p[b + 1] -= dy * e * wb; p[b + 2] -= dz * e * wb; }
      for (i = 0; i < n; i++) { if (!this.inv[i]) continue; k = i * 3; var hitc = false;
        if (c) for (var ci = 0; ci < c.length; ci++) { var B = c[ci], ax = Math.abs(p[k]) - B.x - r, ay = Math.abs(p[k + 1]) - B.y - r, az = p[k + 2] - B.z - r, ab = B.z0 == null ? -9 : B.z0 - r - p[k + 2]; if (ax < 0 && ay < 0 && az < 0 && ab < 0) { hitc = true; var mx2 = Math.max(ax, ay, az, ab); if (mx2 === az) p[k + 2] = B.z + r; else if (mx2 === ab) p[k + 2] = B.z0 - r; else if (mx2 === ax) p[k] = (p[k] < 0 ? -1 : 1) * (B.x + r); else p[k + 1] = (p[k + 1] < 0 ? -1 : 1) * (B.y + r); } }
        var fz = this.fz ? this.fz(p[k], p[k + 1]) : 0; if (p[k + 2] < fz + r) { p[k + 2] = fz + r; hitc = true; }
        if (hitc && it === 9) { q[k] += (p[k] - q[k]) * .22; q[k + 1] += (p[k + 1] - q[k + 1]) * .22; q[k + 2] = p[k + 2]; } }   /* it drags a little on what it lies on */
    }
  };
  /* The strip is drawn finer than it is simulated (SB rows per link), and every drawn vertex is kept OUT of the box and
     off the floor: the box is solid, so no edge of the ribbon can ever cut into a face or pass under it. */
  Band.prototype.update = function (t) {
    var p = this.p, n = this.n, M = this.M, SB = this.SB, v = this.pos, F = this.fr, hw = this.w / 2, cb = this.camber, c = this.col, i, j, N = this.nrm, nx = N[0], ny = N[1], nz = N[2], E = .014;
    for (i = 0; i < n; i++) {
      var a = Math.max(0, i - 1) * 3, b = Math.min(n - 1, i + 1) * 3, tx = p[b] - p[a], ty = p[b + 1] - p[a + 1], tz = p[b + 2] - p[a + 2], tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1e-6; tx /= tl; ty /= tl; tz /= tl;
      var d = nx * tx + ny * ty + nz * tz, mx = nx - tx * d, my = ny - ty * d, mz = nz - tz * d, ml = Math.sqrt(mx * mx + my * my + mz * mz);
      if (ml > 1e-4) { nx = mx / ml; ny = my / ml; nz = mz / ml; }
      if (i === 0) { N[0] = nx; N[1] = ny; N[2] = nz; }
      var bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx, ph = this.twist ? this.twist(i / (n - 1), t) : 0, cs = Math.cos(ph), sn = Math.sin(ph), f = i * 6;
      F[f] = bx * cs + nx * sn; F[f + 1] = by * cs + ny * sn; F[f + 2] = bz * cs + nz * sn; F[f + 3] = nx * cs - bx * sn; F[f + 4] = ny * cs - by * sn; F[f + 5] = nz * cs - bz * sn;
    }
    for (var rw = 0; rw < this.rows; rw++) {
      var i0 = Math.min(n - 2, Math.floor(rw / SB)), fq = rw / SB - i0, k0 = i0 * 3, k1 = k0 + 3, f0 = i0 * 6, f1 = f0 + 6, g = 1 - fq;
      var px = p[k0] * g + p[k1] * fq, py = p[k0 + 1] * g + p[k1 + 1] * fq, pz = p[k0 + 2] * g + p[k1 + 2] * fq;
      var wx = F[f0] * g + F[f1] * fq, wy = F[f0 + 1] * g + F[f1 + 1] * fq, wz = F[f0 + 2] * g + F[f1 + 2] * fq, wl = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1; wx /= wl; wy /= wl; wz /= wl;
      var ux = F[f0 + 3] * g + F[f1 + 3] * fq, uy = F[f0 + 4] * g + F[f1 + 4] * fq, uz = F[f0 + 5] * g + F[f1 + 5] * fq;
      for (j = 0; j <= M; j++) {
        var u = j / M * 2 - 1, o = (rw * (M + 1) + j) * 3, cu = cb * (1 - u * u), X = px + wx * u * hw + ux * cu, Y = py + wy * u * hw + uy * cu, Z = pz + wz * u * hw + uz * cu;
        if (c) { for (var ci = 0; ci < c.length; ci++) { var B = c[ci], ax = Math.abs(X) - B.x - E, ay = Math.abs(Y) - B.y - E, az = Z - B.z - E, ab = B.z0 == null ? -9 : B.z0 - E - Z; if (ax < 0 && ay < 0 && az < 0 && ab < 0) { var mx2 = Math.max(ax, ay, az, ab); if (mx2 === az) Z = B.z + E; else if (mx2 === ab) Z = B.z0 - E; else if (mx2 === ax) X = (X < 0 ? -1 : 1) * (B.x + E); else Y = (Y < 0 ? -1 : 1) * (B.y + E); } } var fz2 = this.fz ? this.fz(X, Y) : 0; if (Z < fz2 + .006) Z = fz2 + .006; }
        v[o] = X; v[o + 1] = Y; v[o + 2] = Z;
      }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
  };
  function path(corners, ds) { var out = [], i, j; for (i = 0; i < corners.length - 1; i++) { var a = corners[i], b = corners[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), m = Math.max(1, Math.round(l / ds)); for (j = i ? 1 : 0; j <= m; j++) out.push([a[0] + (b[0] - a[0]) * j / m, a[1] + (b[1] - a[1]) * j / m, a[2] + (b[2] - a[2]) * j / m]); } return out; }

  RV.register('gift', {
    label: 'Gift box', T: 9.0, pbr: true, ownCam: true, fadeMs: 900, exposure: 1.02,
    init: function () {
      var s = RV.scene, self = this, i;
      s.environment = RV.room(); s.add(new THREE.AmbientLight(0xfff1dc, .07));
      var key = this.key = new THREE.SpotLight(0xffe9cc, 3.9, 40, .285, 1, 1); key.position.set(-4.4, -3.6, 9.0); key.target.position.set(-.45, .5, .4); s.add(key.target); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 3; key.shadow.camera.far = 20; key.shadow.bias = -.0009; key.shadow.normalBias = .02; key.shadow.radius = 7; s.add(key);
      var fill = new THREE.DirectionalLight(0xcfd9ff, .13); fill.position.set(4, 1.5, 3); s.add(fill);
      var rimL = new THREE.DirectionalLight(0xffd2a0, .6); rimL.position.set(1.5, 6, 1.6); s.add(rimL);
      this.spk = new THREE.PointLight(0xfff0d8, .55, 9, 1.6); this.spk.position.set(2.4, -1.4, 3.2); s.add(this.spk);   /* a small light that travels slowly: pearls, satin and foil take a moving sheen from it */
      this.spill = new THREE.PointLight(0xffc98a, 0, 7, 1.6); this.spill.position.set(0, -.2, BZ + .8); s.add(this.spill);   /* the glow from inside, falling on the lid, the rims and the ground once the box is open */
      this.sway = []; this.glints = null; this.gscene = null; this.RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      /* the floor the box stands on: the couple's choice. Every one is drawn here in code (no photographs), and every one
         sits under the same single pool of light. */
      var fk = RV.opt('gift', 'floor'), lc = cv(512, 512), lx = lc.getContext('2d'), lh = cv(512, 512), lhx = lh.getContext('2d'), FL = { rep: 30, ns: .3, rough: .93, env: .06 }, j2, HF = null;
      lhx.fillStyle = '#808080'; lhx.fillRect(0, 0, 512, 512);
      function weave(base, dark, light, kd, kl) { lx.fillStyle = base; lx.fillRect(0, 0, 512, 512); for (i = 0; i < 128; i++) { var la = .03 + RV.rand() * .09, lb = .03 + RV.rand() * .09, ld = RV.rand() > .5; lx.fillStyle = ld ? 'rgba(' + dark + ',' + la * kd + ')' : 'rgba(' + light + ',' + la * kl + ')'; lx.fillRect(0, i * 4, 512, 2); lx.fillStyle = RV.rand() > .5 ? 'rgba(' + dark + ',' + lb * kd + ')' : 'rgba(' + light + ',' + lb * kl + ')'; lx.fillRect(i * 4, 0, 2, 512); lhx.fillStyle = 'rgba(255,255,255,' + (la * 2.2) + ')'; lhx.fillRect(0, i * 4, 512, 2); lhx.fillStyle = 'rgba(0,0,0,' + (lb * 2.2) + ')'; lhx.fillRect(i * 4 + 2, 0, 2, 512); } }
      function speck(nn, dark, light, a) { for (i = 0; i < nn; i++) { var sx = RV.rand() * 512, sy = RV.rand() * 512, li = RV.rand() > .5; lx.fillStyle = 'rgba(' + (li ? light : dark) + ',' + (a * (.4 + RV.rand() * .6)) + ')'; lx.fillRect(sx, sy, 1.3, 1.3); lhx.fillStyle = li ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.25)'; lhx.fillRect(sx, sy, 1.3, 1.3); } }
      if (fk === 'linen') { weave('#e6dcc8', '120,96,60', '255,252,244', 1, 1); FL = { rep: 30, ns: .3, rough: .93, env: .1 }; }
      else if (fk === 'wood') {
        for (i = 0; i < 4; i++) { var tone = [[108, 66, 38], [96, 58, 33], [116, 72, 42], [101, 62, 36]][i]; lx.fillStyle = 'rgb(' + tone.join(',') + ')'; lx.fillRect(i * 128, 0, 128, 512);
          for (j2 = 0; j2 < 70; j2++) { var gx0 = i * 128 + 3 + RV.rand() * 122, ga = .05 + RV.rand() * .16, dk = RV.rand() > .35, wob = 1 + RV.rand() * 3, phs = RV.rand() * 6.28, yy; lx.strokeStyle = dk ? 'rgba(40,20,8,' + ga + ')' : 'rgba(214,160,104,' + ga * .7 + ')'; lx.lineWidth = .6 + RV.rand() * 1.4; lx.beginPath(); lhx.strokeStyle = dk ? 'rgba(0,0,0,' + ga + ')' : 'rgba(255,255,255,' + ga * .6 + ')'; lhx.lineWidth = lx.lineWidth; lhx.beginPath();
            for (yy = 0; yy <= 512; yy += 16) { var gxx = Math.min(i * 128 + 126, Math.max(i * 128 + 2, gx0 + Math.sin(yy / 512 * 6.283 * 2 + phs) * wob)); if (yy) { lx.lineTo(gxx, yy); lhx.lineTo(gxx, yy); } else { lx.moveTo(gxx, yy); lhx.moveTo(gxx, yy); } } lx.stroke(); lhx.stroke(); }
          lx.fillStyle = 'rgba(24,12,4,.75)'; lx.fillRect(i * 128, 0, 1.6, 512); lhx.fillStyle = '#000'; lhx.fillRect(i * 128, 0, 2.5, 512); }
        FL = { rep: 12, ns: .55, rough: .5, env: .32 };
      } else if (fk === 'marble') {
        lx.fillStyle = '#dedad1'; lx.fillRect(0, 0, 512, 512);
        for (i = 0; i < 26; i++) { var bx0 = RV.rand() * 512, by0 = RV.rand() * 512, br = 60 + RV.rand() * 120; [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]].forEach(function (o2) { var rg = lx.createRadialGradient(bx0 + o2[0], by0 + o2[1], 0, bx0 + o2[0], by0 + o2[1], br); rg.addColorStop(0, i % 2 ? 'rgba(255,255,255,.3)' : 'rgba(120,114,108,.3)'); rg.addColorStop(1, 'rgba(200,196,188,0)'); lx.fillStyle = rg; lx.fillRect(0, 0, 512, 512); }); }
        lx.filter = 'blur(1.2px)';
        for (i = 0; i < 22; i++) { var vx0 = RV.rand() * 512, vy0 = RV.rand() * 512, van = RV.rand() * 6.283, vpts = [[vx0, vy0]], gold = i % 5 === 0; for (j2 = 0; j2 < 26; j2++) { van += (RV.rand() - .5) * .9; vx0 += Math.cos(van) * 24; vy0 += Math.sin(van) * 24; vpts.push([vx0, vy0]); }
          [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]].forEach(function (o2) { lx.strokeStyle = gold ? 'rgba(168,128,62,.8)' : 'rgba(70,68,70,' + (.4 + RV.rand() * .4) + ')'; lx.lineWidth = .8 + RV.rand() * 3.4; lx.beginPath(); vpts.forEach(function (q2, n2) { if (n2) lx.lineTo(q2[0] + o2[0], q2[1] + o2[1]); else lx.moveTo(q2[0] + o2[0], q2[1] + o2[1]); }); lx.stroke(); }); }
        lx.filter = 'none'; FL = { rep: 7, ns: .05, rough: .2, env: .6 };
      } else if (fk === 'stone') { lx.fillStyle = '#6f6b66'; lx.fillRect(0, 0, 512, 512); for (i = 0; i < 40; i++) { var qx = RV.rand() * 512, qy = RV.rand() * 512, qr = 30 + RV.rand() * 90, qg = lx.createRadialGradient(qx, qy, 0, qx, qy, qr); qg.addColorStop(0, i % 2 ? 'rgba(170,165,156,.3)' : 'rgba(92,88,84,.26)'); qg.addColorStop(1, 'rgba(130,126,120,0)'); lx.fillStyle = qg; lx.fillRect(qx - qr, qy - qr, qr * 2, qr * 2); } speck(9000, '50,48,46', '214,210,202', .5); FL = { rep: 7, ns: .5, rough: .8, env: .14 }; }
      else if (fk === 'sand') {
        var sd = lx.createImageData(512, 512), hd = lhx.createImageData(512, 512), sx2, sy2;
        for (sy2 = 0; sy2 < 512; sy2++) for (sx2 = 0; sx2 < 512; sx2++) { var rp = Math.sin((sy2 / 64 + .22 * Math.sin(sx2 / 512 * 6.283) + .08 * Math.sin(sx2 / 512 * 6.283 * 3 + 1)) * 6.283), gr = (hash(sx2, sy2) - .5), a4 = (sy2 * 512 + sx2) * 4, sh2 = 1 + rp * .13 + gr * .1; sd.data[a4] = 218 * sh2; sd.data[a4 + 1] = 196 * sh2; sd.data[a4 + 2] = 160 * sh2; sd.data[a4 + 3] = 255; var hv = 128 + rp * 110 + gr * 30; hd.data[a4] = hd.data[a4 + 1] = hd.data[a4 + 2] = hv; hd.data[a4 + 3] = 255; }
        lx.putImageData(sd, 0, 0); lhx.putImageData(hd, 0, 0); FL = { rep: 6, ns: 1.6, rough: 1, env: .04 };
      } else if (fk === 'clouds' || fk === 'clouds_ivory') {   /* cotton in soft billows: the box sits in it as if on clouds, sunk a little */
        lx.fillStyle = fk === 'clouds' ? '#d9d7d2' : '#d8cab2'; lx.fillRect(0, 0, 512, 512);
        for (i = 0; i < 90; i++) { var wx0 = RV.rand() * 512, wy0 = RV.rand() * 512, wr = 26 + RV.rand() * 80, wg = lx.createRadialGradient(wx0, wy0, 0, wx0, wy0, wr); wg.addColorStop(0, i % 2 ? 'rgba(255,255,255,.3)' : 'rgba(120,116,110,.16)'); wg.addColorStop(1, 'rgba(240,238,232,0)'); lx.fillStyle = wg; lx.fillRect(wx0 - wr, wy0 - wr, wr * 2, wr * 2); var hg2 = lhx.createRadialGradient(wx0, wy0, 0, wx0, wy0, wr); hg2.addColorStop(0, i % 2 ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.2)'); hg2.addColorStop(1, 'rgba(128,128,128,0)'); lhx.fillStyle = hg2; lhx.fillRect(wx0 - wr, wy0 - wr, wr * 2, wr * 2); }
        speck(7000, '170,162,150', '255,255,255', .3); FL = { rep: 7, ns: .8, rough: 1, env: .05 };
        HF = function (x, y) { var d = Math.hypot(Math.max(0, Math.abs(x) - BX), Math.max(0, Math.abs(y) - BY)); if (d <= 0) return 0; var e1 = Math.min(1, d / .14), e2 = Math.min(1, Math.max(0, (d - .08) / 1.1)); e1 = e1 * e1 * (3 - 2 * e1); e2 = e2 * e2 * (3 - 2 * e2);
          return .06 * e1 + e2 * (.4 * Math.abs(Math.sin(x * 1.7 + Math.sin(y * 1.3))) * Math.abs(Math.sin(y * 1.5 + Math.sin(x * 1.1) + 1)) + .13 * Math.abs(Math.sin(x * 3.9 + y * 1.3)) * Math.abs(Math.sin(y * 4.3 - x * 1.1)) + .03); };
      } else if (fk === 'cotton') {   /* Egyptian cotton: a fine, smooth weave with a soft sheen, lying in gentle folds */
        weave('#d6cfc0', '120,104,76', '255,255,250', .5, .7); FL = { rep: 64, ns: .22, rough: .56, env: .26 };
        HF = function (x, y) { var d = Math.hypot(Math.max(0, Math.abs(x) - BX), Math.max(0, Math.abs(y) - BY)); if (d <= 0) return 0; var e = Math.min(1, d / .6); e = e * e * (3 - 2 * e);
          return .014 * Math.min(1, d / .1) + e * (.15 * Math.pow(.5 + .5 * Math.sin(x * 1.15 + y * .6 + .9 * Math.sin(y * .7)), 3) + .09 * Math.pow(.5 + .5 * Math.sin(y * 1.4 - x * .8 + 1.3 * Math.sin(x * .5) + 2), 4)); };
      } else weave('#3b332b', '10,6,2', '255,236,206', 2, .6);
      var lin = new THREE.CanvasTexture(lc), linN = normals(lh, 1.6); lin.wrapS = lin.wrapT = THREE.RepeatWrapping; lin.anisotropy = 8; linN.anisotropy = 8; lin.repeat.set(FL.rep, FL.rep); linN.repeat.set(FL.rep, FL.rep); lin.encoding = THREE.sRGBEncoding;
      var table = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshStandardMaterial({ map: lin, normalMap: linN, normalScale: new THREE.Vector2(FL.ns, FL.ns), roughness: FL.rough, metalness: 0, envMapIntensity: FL.env })); table.receiveShadow = true; s.add(table);
      this.HF = HF;
      if (HF) {   /* a floor with a shape: its own mesh, darkened where it meets the box (the contact shadow is in the cloth itself) */
        table.position.z = -.04; var cg = new THREE.PlaneGeometry(13, 17, 156, 204), cp = cg.attributes.position, cc2 = new Float32Array(cp.count * 3), uvc = cg.attributes.uv;
        for (i = 0; i < cp.count; i++) { var hx = cp.getX(i), hy = cp.getY(i), hd = Math.hypot(Math.max(0, Math.abs(hx) - BX), Math.max(0, Math.abs(hy) - BY)), hz = HF(hx, hy), ao = (1 - .55 * Math.exp(-hd / .28)) * (.66 + .34 * Math.min(1, hz / (fk === 'cotton' ? .16 : .34))); cp.setZ(i, hz); cc2[i * 3] = cc2[i * 3 + 1] = cc2[i * 3 + 2] = ao; uvc.setXY(i, hx / 44 + .5, hy / 44 + .5); }
        cg.setAttribute('color', new THREE.BufferAttribute(cc2, 3)); cg.computeVertexNormals(); var cm = table.material.clone(); cm.vertexColors = true; var cloth = new THREE.Mesh(cg, cm); cloth.receiveShadow = true; s.add(cloth);
      }
      /* the box's shadow on the ground: soft, close under it and thrown away from the light */
      var sc = cv(256, 256), sx3 = sc.getContext('2d'); sx3.filter = 'blur(20px)'; sx3.fillStyle = 'rgba(0,0,0,.9)'; sx3.fillRect(52, 52, 152, 152); sx3.filter = 'none';
      var shd = new THREE.Mesh(new THREE.PlaneGeometry(LX * 2 * 256 / 152 * 1.12, LY * 2 * 256 / 152 * 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, opacity: .86, depthWrite: false })); shd.position.set(.3, .34, .003); shd.renderOrder = 1; s.add(shd);
      /* ambient occlusion: the tight dark line where the box meets the ground */
      var ac = cv(256, 256), ax3 = ac.getContext('2d'); ax3.filter = 'blur(7px)'; ax3.fillStyle = 'rgba(0,0,0,1)'; ax3.fillRect(40, 40, 176, 176); ax3.filter = 'none';
      var aom = new THREE.Mesh(new THREE.PlaneGeometry(LX * 2 * 256 / 176 * 1.03, LY * 2 * 256 / 176 * 1.02), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ac), transparent: true, opacity: .7, depthWrite: false })); aom.position.set(.02, .02, .0035); aom.renderOrder = 1; s.add(aom);
      if (HF) { shd.visible = false; aom.visible = false; }
      /* around the box: an arrangement, the couple's choice. Four lanes are kept clear, where the ribbon opens out. */
      var ak = RV.opt('gift', 'around'), dm = new THREE.Object3D(); dm.rotation.order = 'ZXY';
      function okAt(x, y, m) { return !(Math.abs(x) < LX + m && Math.abs(y) < LY + m) && !((Math.abs(y) < .38 && Math.abs(x) > LX) || (Math.abs(x) < .38 && Math.abs(y) > LY)); }
      function scatter(nn, m, fn) { var out = [], g2 = 0; while (out.length < nn && g2++ < nn * 40) { var near = RV.rand() < .72, x = (RV.rand() - .5) * (near ? 5.4 : 9.5), y = (RV.rand() - .5) * (near ? 7.6 : 13); if (okAt(x, y, m)) out.push(fn(x, y, out.length)); } return out; }
      function many(geo, mat, list, cast, kind) { if (!list.length) return; var im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach(function (o, n3) { if (!o._h) { o.z = (o.z || 0) + (HF ? HF(o.x, o.y) : 0); o._h = 1; if (o.ph == null) o.ph = RV.rand() * 6.283; } dm.position.set(o.x, o.y, o.z); dm.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); dm.scale.set(o.sx || o.s || 1, o.sy || o.s || 1, o.sz || o.s || 1); dm.updateMatrix(); im.setMatrixAt(n3, dm.matrix); if (o.c) im.setColorAt(n3, o.c); }); im.castShadow = cast !== false; im.receiveShadow = true; im.frustumCulled = false; s.add(im); if (kind) self.sway.push({ im: im, list: list, kind: kind }); return im; }
      this.dm = dm;
      /* glints: small four-point stars that come and go, one after another, as the light travels across */
      function starTex() { var c2 = cv(64, 64), x2 = c2.getContext('2d'), g3 = x2.createRadialGradient(32, 32, 0, 32, 32, 30); x2.fillStyle = '#000'; x2.fillRect(0, 0, 64, 64); g3.addColorStop(0, 'rgba(255,255,255,1)'); g3.addColorStop(.12, 'rgba(255,255,255,.55)'); g3.addColorStop(.4, 'rgba(255,255,255,.08)'); g3.addColorStop(1, 'rgba(255,255,255,0)'); x2.fillStyle = g3; x2.fillRect(0, 0, 64, 64); x2.globalCompositeOperation = 'lighter'; [[30, 1.6, 0], [1.6, 30, 0], [15, 1, .785], [1, 15, .785]].forEach(function (r4) { x2.save(); x2.translate(32, 32); x2.rotate(r4[2]); var lg = x2.createRadialGradient(0, 0, 0, 0, 0, Math.max(r4[0], r4[1])); lg.addColorStop(0, 'rgba(255,255,255,.95)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); x2.fillStyle = lg; x2.fillRect(-r4[0], -r4[1], r4[0] * 2, r4[1] * 2); x2.restore(); }); return new THREE.CanvasTexture(c2); }
      function glints(list, tint, frac, size) { var L2 = list.filter(function (o, n3) { return hash(n3, 9) < frac && !(Math.abs(o.x) < LX + .3 && o.y > LY - .1 && o.y < LY + 1.0); }),   /* none behind the box, where the box hides the stone itself */ gp = new Float32Array(L2.length * 3), gc2 = new Float32Array(L2.length * 3); L2.forEach(function (o, n3) { gp[n3 * 3] = o.x; gp[n3 * 3 + 1] = o.y; gp[n3 * 3 + 2] = (o.z || 0) + (o.s || .05) * 1.7 + .06; }); var gg2 = new THREE.BufferGeometry(); gg2.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg2.setAttribute('color', new THREE.BufferAttribute(gc2, 3)); var pts = new THREE.Points(gg2, new THREE.PointsMaterial({ map: starTex(), size: size, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); pts.frustumCulled = false; self.gscene = new THREE.Scene(); self.gscene.add(pts); self.glints = { list: L2, col: gg2.attributes.color, tint: tint }; }   /* the glints are drawn after the depth-of-field pass, so they stay crisp */
      function rim(u, d) { var a = LX + d, b = LY + d, q = (u % 1) * 4 * (a + b); if (q < 2 * a) return [-a + q, -b]; q -= 2 * a; if (q < 2 * b) return [a, -b + q]; q -= 2 * b; if (q < 2 * a) return [a - q, b]; q -= 2 * a; return [-a, b - q]; }
      function pick(arr) { return arr[Math.floor(RV.rand() * arr.length)]; }
      var psh = new THREE.Shape(); psh.moveTo(0, 0); psh.bezierCurveTo(.5, .12, .56, .72, .06, 1); psh.quadraticCurveTo(0, .94, -.06, 1); psh.bezierCurveTo(-.56, .72, -.5, .12, 0, 0);
      var pgeo = new THREE.ShapeGeometry(psh, 8), soft = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .66, side: THREE.DoubleSide, envMapIntensity: .22 }), ball = new THREE.SphereGeometry(1, 16, 12);
      var ROSE = ['#ecc3c4', '#e3a9b0', '#f3dcd6', '#d98f9c', '#f6ebe4'].map(seen);
      function petals(nn) { many(pgeo, soft, scatter(nn, .14, function (x, y, n3) { return { x: x, y: y, z: .005 + n3 * .00004, rz: RV.rand() * 6.283, rx: (RV.rand() - .5) * .14, s: .2 + RV.rand() * .2, c: pick(ROSE), dr: n3 % 9 === 4 && okAt(x + .4, y, .42) && okAt(x - .4, y, .42) && okAt(x, y + .35, .42) && okAt(x, y - .35, .42) }; }), false, 'petal'); }
      if (ak === 'petals') petals(420);
      if (ak === 'flowers') {
        var PAL = [['#f1c9cc', '#d98f9c'], ['#f7efe6', '#e9d3bd'], ['#f3d2bd', '#e2a585'], ['#e8b7c4', '#c9748c'], ['#fbf6ee', '#efdcc8']], pl = [], lv = [], ct = [], fi;
        for (fi = 0; fi < 22; fi++) { var fp = rim((fi + .15 + RV.rand() * .5) / 22, .42 + RV.rand() * .62), R = .3 + RV.rand() * .2, pal = PAL[fi % 5], ca = new THREE.Color(pal[0]).convertSRGBToLinear(), cb = new THREE.Color(pal[1]).convertSRGBToLinear(); if (!okAt(fp[0], fp[1], .2)) continue;
          [[9, 1, .3], [7, .76, .66], [5, .52, 1.0], [3, .3, 1.32]].forEach(function (rg, ri) { for (var j3 = 0; j3 < rg[0]; j3++) { var an = j3 / rg[0] * 6.283 + ri * .7 + fi; pl.push({ x: fp[0], y: fp[1], z: .012 + ri * .035 * R, rz: an - 1.5708, rx: rg[2] + (RV.rand() - .5) * .12, s: R * rg[1], c: ca.clone().lerp(cb, ri / 3.4), ph: fi * 1.7, rg: ri }); } });
          ct.push({ x: fp[0], y: fp[1], z: .1 * R, s: .1 * R, c: seen('#d9b46a') });
          for (var l3 = 0; l3 < 3; l3++) { var la2 = RV.rand() * 6.283; lv.push({ x: fp[0] + Math.cos(la2) * R * .5, y: fp[1] + Math.sin(la2) * R * .5, z: .006, rz: la2 - 1.5708, rx: .1, sx: R * .5, sy: R * 1.25, sz: 1, c: seen(l3 % 2 ? '#5d7a52' : '#46603f'), ph: fi * 1.7 + 1 }); } }
        many(pgeo, soft, lv, false, 'leaf'); many(pgeo, soft, pl, true, 'bloom'); many(ball, soft, ct, false); petals(70);
      }
      var pearl = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .2, metalness: .06, envMapIntensity: 1.25 }), PC = seen('#f4ecdf');
      if (ak === 'pearls') {
        var prs = []; [[.3, .055, 3, 0], [.62, .045, 5, 1.3], [.98, .06, 4, 2.6]].forEach(function (st) { var per = 4 * (LX + LY + 2 * st[0]), np = Math.floor(per / (st[1] * 2.04)), k3; for (k3 = 0; k3 < np; k3++) { var u3 = k3 / np, q3 = rim(u3, st[0] + .08 * Math.sin(u3 * 6.283 * st[2] + st[3])); if (okAt(q3[0], q3[1], st[1] + .04)) prs.push({ x: q3[0], y: q3[1], z: st[1], s: st[1], c: PC }); } });
        many(ball, pearl, prs.concat(scatter(70, .2, function (x, y) { var rr = .03 + RV.rand() * .04; return { x: x, y: y, z: rr, s: rr, c: PC }; })));
        many(ball, new THREE.MeshStandardMaterial({ color: seen('#c9a24e'), roughness: .25, metalness: 1, envMapIntensity: 1.4 }), scatter(30, .2, function (x, y) { return { x: x, y: y, z: .03, s: .03 }; }));
      }
      if (ak === 'diamonds') {
        var pav = new THREE.ConeGeometry(1, 1.1, 8); pav.rotateX(-Math.PI / 2); pav.translate(0, 0, .55); var crn = new THREE.CylinderGeometry(.6, 1, .38, 8); crn.rotateX(Math.PI / 2); crn.translate(0, 0, 1.29);
        var gem = new THREE.MeshStandardMaterial({ color: seen('#dfe9f6'), roughness: .03, metalness: 1, flatShading: true, envMapIntensity: 2.6 }), gl = scatter(190, .2, function (x, y) { var gs = .05 + RV.rand() * RV.rand() * .13; return { x: x, y: y, z: gs * .25, s: gs, rx: (RV.rand() - .5) * 1.5, ry: (RV.rand() - .5) * 1.5, rz: RV.rand() * 6.283 }; });
        many(pav, gem, gl); many(crn, gem, gl);
        glints(gl, [1, 1, 1.05], .42, 1.15);
      }
      if (ak === 'confetti' || ak === 'stars') {
        var CF = (ak === 'stars' ? ['#d9b04a', '#e9cd7a', '#c9c9cf', '#b8892f'] : ['#e8b84a', '#e86a5c', '#3aa6a0', '#f2a7b8', '#f5efe2', '#6b8fd6']).map(seen), ssh = new THREE.Shape(), k4;
        for (k4 = 0; k4 < 10; k4++) { var ra = k4 % 2 ? .42 : 1, aa2 = k4 / 10 * 6.283 + 1.5708; if (k4) ssh.lineTo(Math.cos(aa2) * ra, Math.sin(aa2) * ra); else ssh.moveTo(Math.cos(aa2) * ra, Math.sin(aa2) * ra); }
        var foil = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: ak === 'stars' ? .28 : .5, metalness: ak === 'stars' ? 1 : .15, side: THREE.DoubleSide, envMapIntensity: ak === 'stars' ? 1.5 : .4 });
        function bit(x, y, n3) { return { x: x, y: y, z: .006 + n3 * .00003, rz: RV.rand() * 6.283, rx: (RV.rand() - .5) * .3, ry: (RV.rand() - .5) * .3, s: .05 + RV.rand() * .07, c: pick(CF) }; }
        if (ak === 'stars') { var stl = scatter(300, .15, function (x, y, n3) { var o = bit(x, y, n3); o.s *= 1.5; return o; }); many(new THREE.ShapeGeometry(ssh), foil, stl, false); glints(stl, [1, .86, .56], .45, .95); }
        else { many(new THREE.CircleGeometry(1, 12), foil, scatter(330, .15, bit), false); many(new THREE.PlaneGeometry(2.2, .8), foil, scatter(240, .15, bit), false); }
      }
      if (ak === 'balloons') {
        var BC = ['#f2b6c1', '#f5e9d6', '#d9b04a', '#a9c7e8', '#f2b6c1', '#d9b04a', '#f5e9d6', '#a9c7e8'].map(seen), bl = [];
        [[1, 1, .5, .45], [-1, 1, .52, .5], [1, -1, .55, .5], [-1, -1, .5, .45], [1, .3, .62, .1], [-1, -.3, .62, .1], [.55, 1, .2, .62], [-.55, -1, .2, .62]].forEach(function (b2, n3) { var br2 = .46 + (n3 % 3) * .07; bl.push({ x: b2[0] * (LX + b2[2]) , y: (b2[1] > .9 || b2[1] < -.9 ? b2[1] * (LY + b2[3]) : b2[1] * LY * 2.2), z: br2 * 1.08, sx: br2, sy: br2, sz: br2 * 1.12, c: BC[n3] }); });
        many(new THREE.SphereGeometry(1, 30, 22), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .16, metalness: .12, envMapIntensity: 1.1 }), bl.filter(function (o) { return okAt(o.x, o.y, o.sx); }));
        many(new THREE.CircleGeometry(1, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5, side: THREE.DoubleSide }), scatter(160, .15, function (x, y, n3) { return { x: x, y: y, z: .006, rz: RV.rand() * 6.283, s: .05 + RV.rand() * .05, c: pick(BC) }; }), false);
      }
      var wc = new THREE.Color(WRAP[RV.opt('gift', 'wrap')]); FOLD = wc.clone().lerp(new THREE.Color(0xffffff), .32).getHex();
      var paper = this.paper = paperMaterial(), cream = new THREE.MeshStandardMaterial({ color: wc.clone().convertSRGBToLinear().multiplyScalar(.86), roughness: .88, side: THREE.DoubleSide, envMapIntensity: .15 }), rim = new THREE.MeshStandardMaterial({ color: wc.clone().convertSRGBToLinear(), roughness: .85, envMapIntensity: .2 }), shade = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false }), edge = new THREE.MeshStandardMaterial({ color: wc.clone().convertSRGBToLinear(), roughness: .4, envMapIntensity: .9 });

      /* ---- the base: four wrapped walls, a cream inside, tissue, and the card ---- */
      var base = new THREE.Group(); s.add(base);
      put(base, aim(sheet(BX * 2, BZ, 1, 1, .21, .4), 'y-'), paper, 0, -BY, BZ / 2); put(base, aim(sheet(BX * 2, BZ, 1, 1, .6, .1), 'y+'), paper, 0, BY, BZ / 2);
      put(base, aim(sheet(BZ, BY * 2, 1, 1, .37, .15, true), 'x-'), paper, -BX, 0, BZ / 2); put(base, aim(sheet(BZ, BY * 2, 1, 1, .8, .55, true), 'x+'), paper, BX, 0, BZ / 2);
      put(base, aim(new THREE.PlaneGeometry(IX * 2, BZ), 'y+'), cream, 0, -IY, BZ / 2, false); put(base, aim(new THREE.PlaneGeometry(IX * 2, BZ), 'y-'), cream, 0, IY, BZ / 2, false);
      put(base, aim(new THREE.PlaneGeometry(BZ, IY * 2), 'x+'), cream, -IX, 0, BZ / 2, false); put(base, aim(new THREE.PlaneGeometry(BZ, IY * 2), 'x-'), cream, IX, 0, BZ / 2, false);
      [[0, -(IY + BY) / 2, BX * 2, TH], [0, (IY + BY) / 2, BX * 2, TH], [-(IX + BX) / 2, 0, TH, IY * 2], [(IX + BX) / 2, 0, TH, IY * 2]].forEach(function (r) { put(base, new THREE.PlaneGeometry(r[2], r[3]), rim, r[0], r[1], BZ, false); });
      /* the classic end of a wrapped box, on the wall that faces us: the top flap folded down, the bottom flap folded up over it */
      var d45 = BZ - .47;
      flap(base, [[-BX, BZ], [BX, BZ], [BX - d45, .47], [-BX + d45, .47]], 'y-', 0, -BY, 0, paper, shade, .004, .31);
      flap(base, [[-BX, 0], [BX, 0], [BX - .53, .53], [-BX + .53, .53]], 'y-', 0, -BY, 0, paper, shade, .008, .67);
      /* tissue, banked up the walls around the card */
      var th = cv(256, 256), tx = th.getContext('2d'); tx.fillStyle = '#808080'; tx.fillRect(0, 0, 256, 256);
      for (i = 0; i < 260; i++) { var ax = RV.rand() * 256, ay = RV.rand() * 256, al = 20 + RV.rand() * 70, aa = RV.rand() * 6.283; tx.strokeStyle = RV.rand() > .5 ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.16)'; tx.lineWidth = 1 + RV.rand() * 2.5; tx.beginPath(); tx.moveTo(ax, ay); tx.lineTo(ax + Math.cos(aa) * al, ay + Math.sin(aa) * al); tx.stroke(); }
      /* the lining: the cloth the card lies in, and the same cloth up the inside walls. The couple's choice. */
      var LN = { lame: ['#c9a968', .46, .55, .8, 1.2, 1], ivory: ['#efe6d2', .3, .1, .9, .5, .55], blush: ['#d9959d', .34, .08, .8, .55, .6], navy: ['#1c2a4e', .96, 0, .1, .3, .4], sage: ['#7f9672', .9, 0, .14, .9, .45], card: ['#efe7d6', .9, 0, .12, .05, 0] }[RV.opt('gift', 'lining')];
      var tissue = new THREE.MeshStandardMaterial({ color: seen(LN[0]), roughness: LN[1], metalness: LN[2], normalMap: normals(th, 3.6), normalScale: new THREE.Vector2(LN[4], LN[4]), side: THREE.DoubleSide, envMapIntensity: LN[3] });
      var wallM = tissue.clone(); wallM.color = seen(LN[0]).multiplyScalar(.82); wallM.normalScale = new THREE.Vector2(LN[4] * .5, LN[4] * .5); base.children.forEach(function (m) { if (m.material === cream) m.material = wallM; });
      var bed = new THREE.PlaneGeometry(IX * 2, IY * 2, 30, 46), bp = bed.attributes.position;
      for (i = 0; i < bp.count; i++) { var ex = Math.max(0, Math.abs(bp.getX(i)) - CW / 2 - .035) / (IX - CW / 2 - .035), ey = Math.max(0, Math.abs(bp.getY(i)) - CH / 2 - .035) / (IY - CH / 2 - .035), eg = Math.min(1, Math.max(ex, ey)); bp.setZ(i, CZ - .04 + eg * .3 * Math.min(1, LN[5] * 2.5) + LN[5] * eg * (Math.sin(bp.getX(i) * 23 + bp.getY(i) * 7) * Math.cos(bp.getY(i) * 19 - bp.getX(i) * 5) * .035 + (hash(bp.getX(i) * 9, bp.getY(i) * 9) - .5) * .03)); }
      bed.computeVertexNormals(); put(base, bed, tissue, 0, 0, 0, false);
      var cover = new THREE.TextureLoader().load(window.TEX[(window.RV_META && window.RV_META.gift && window.RV_META.gift.cover) || 'coverCale'], function () { RV.unhold(); }); RV.hold(); cover.encoding = THREE.sRGBEncoding; cover.anisotropy = 8;
      this.card = put(base, new THREE.PlaneGeometry(CW, CH), new THREE.MeshBasicMaterial({ map: cover, toneMapped: false }), 0, 0, CZ, false); this.card.receiveShadow = false;

      /* ---- the lid: wrapped on its own, so it lifts clean. A slightly uneven top (paper is never dead flat), mitred corners ---- */
      var hinge = this.lid = new THREE.Group(); hinge.position.set(0, LY, ZT); s.add(hinge); var lid = new THREE.Group(); lid.position.set(0, -LY, 0); hinge.add(lid);
      var top = sheet(LX * 2, LY * 2, 14, 22, 0, 0), tp = top.attributes.position; for (i = 0; i < tp.count; i++) { var fx = Math.abs(tp.getX(i)) / LX, fy = Math.abs(tp.getY(i)) / LY; tp.setZ(i, (fx > .99 || fy > .99) ? 0 : .007 * Math.sin(tp.getX(i) * 2.3 + 1) * Math.cos(tp.getY(i) * 1.7) + .004 * Math.sin(tp.getX(i) * 5.1 + tp.getY(i) * 3.3)); } top.computeVertexNormals();
      put(lid, top, paper, 0, 0, 0);
      put(lid, aim(sheet(LX * 2, SK, 1, 1, .13, .72), 'y-'), paper, 0, -LY, -SK / 2); put(lid, aim(sheet(LX * 2, SK, 1, 1, .5, .3), 'y+'), paper, 0, LY, -SK / 2);
      put(lid, aim(sheet(SK, LY * 2, 1, 1, .44, .9, true), 'x-'), paper, -LX, 0, -SK / 2); put(lid, aim(sheet(SK, LY * 2, 1, 1, .7, .2, true), 'x+'), paper, LX, 0, -SK / 2);
      put(lid, aim(new THREE.PlaneGeometry(LX * 2 - .02, LY * 2 - .02), 'z-'), cream, 0, 0, -.012, false);
      flap(lid, [[-LX, 0], [-LX, -SK], [-LX + SK, -SK]], 'y-', 0, -LY, 0, paper, shade, .005, .23); flap(lid, [[LX, 0], [LX, -SK], [LX - SK, -SK]], 'y-', 0, -LY, 0, paper, shade, .005, .57);
      flap(lid, [[0, -LY], [-SK, -LY], [-SK, -LY + SK]], 'x-', -LX, 0, 0, paper, shade, .005, .41); flap(lid, [[0, LY], [-SK, LY], [-SK, LY - SK]], 'x-', -LX, 0, 0, paper, shade, .005, .83);
      /* the folded edges catch the light */
      [[0, -LY, 0, LX * 2, 'x'], [0, LY, 0, LX * 2, 'x'], [-LX, 0, 0, LY * 2, 'y'], [LX, 0, 0, LY * 2, 'y'], [-LX, -LY, -SK / 2, SK, 'z'], [LX, -LY, -SK / 2, SK, 'z'], [-LX, LY, -SK / 2, SK, 'z']].forEach(function (e) {
        var g = new THREE.CylinderGeometry(.007, .007, e[3], 8, 1); if (e[4] === 'x') g.rotateZ(Math.PI / 2); else if (e[4] === 'z') g.rotateX(Math.PI / 2); put(lid, g, edge, e[0], e[1], e[2] - .006, false); });
      [[-BX, -BY], [BX, -BY], [-BX, BY]].forEach(function (c) { var g = new THREE.CylinderGeometry(.006, .006, BZ, 8, 1); g.rotateX(Math.PI / 2); put(base, g, edge, c[0], c[1], BZ / 2, false); });

      /* ---- the ribbon: four arms from the knot, each lying on the lid, over the edge, round the lid's skirt and down the
         base to the ground, tight to the box all the way. On opening the knot lets go and each arm opens outward and comes
         to rest on the ground, like a flower opening (owner, 23 Nov). Nothing is dragged across the box. */
      var satin = this.satin = satinMaterial(), col = this.col = [{ x: LX, y: LY, z: ZT, z0: ZT - SK }, { x: BX, y: BY, z: BZ }], r = .02, ds = .085, KZ = ZT + r;
      var na = cv(32, 256), nx2 = na.getContext('2d'); nx2.fillStyle = '#fff'; nx2.fillRect(0, 0, 32, 256); nx2.fillStyle = '#000'; nx2.beginPath(); nx2.moveTo(0, 0); nx2.lineTo(32, 0); nx2.lineTo(16, 20); nx2.fill();
      var rc2 = RIB[RV.opt('gift', 'ribbon')], tailMat = satin.clone(); tailMat.map = RV.satinTex(rc2[0], rc2[1], rc2[2]); tailMat.map.repeat.set(1, 1); tailMat.alphaMap = new THREE.CanvasTexture(na); tailMat.alphaTest = .5;
      this.arms = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(function (d, k) {
        var ex = d[0], ey = d[1], hx = ex ? LX : LY, bx = ex ? BX : BY, zz = KZ + (ey ? .006 : 0);
        function P(o, z) { return [ex * o, ey * o, z]; }
        var b = new Band(path([P(bx + r, r), P(bx + r, ZT - SK - .04), P(hx + r, ZT - SK + .02), P(hx + r, zz), P(0, zz)], ds), .3, satin, { n0: [ex, ey, 0], col: col, r: r, damp: .96, fz: HF }), e = b.n - 1, L = 0, i2;
        for (i2 = 0; i2 < e; i2++) L += b.base[i2];
        b.hold(0, ex * (bx + r), ey * (bx + r), r); b.hold(e, 0, 0, zz); b.e = e; b.L = L; b.d = d; b.a = bx + r; b.zz = zz; b.t0 = 1.8 + k * .12; s.add(b.mesh); return b;
      });
      /* the bow: two loops with body, a knot, two tails that lie on the lid and spill over its edge */
      /* [direction in degrees, size]. A double bow has a second, smaller pair lying under the first */
      this.loops = (RV.opt('gift', 'bow') === 'double' ? [[20, 1], [160, 1], [-22, .8], [202, .8]] : [[9, 1], [171, 1]]).map(function (L2) {
        var th = L2[0] * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th), pts = [], n = 40, k, Lp = .9 * L2[1], hp = .42 * L2[1];
        for (k = 0; k <= n; k++) { var a = k / n * Math.PI * 2, al = Lp * Math.pow((1 - Math.cos(a)) / 2, .8), ac = .05 * L2[1] * Math.sin(a), up = Math.max(0, Math.sin(a)); pts.push([ux * al - uy * ac, uy * al + ux * ac + .03, KZ + .05 + Math.pow(up, .7) * .78 * hp + (1 - Math.cos(a)) / 2 * .08]); }
        var bd = new Band(pts, .32, satin, { n0: [0, 0, 1], camber: .036, damp: .9, M: 8, sub: 1 }); bd.hold(0, 0, .05, KZ + .06); bd.hold(n, 0, .05, KZ + .06); bd.stiff = .014; bd.wind = 1.2; bd.wlift = 2; s.add(bd.mesh); return bd;
      });
      this.tails = [-1, 1].map(function (sg) {
        var pts = path([[0, 0, KZ + .03], [sg * .34, -.5, KZ + .03], [sg * .78, -.95, KZ + .03], [sg * .95, -1.32, KZ + .03]], ds);
        var b = new Band(pts, .28, tailMat, { n0: [0, 0, 1], col: col, damp: .95, camber: .016, M: 6, twist: function (q) { return .35 * Math.sin(q * 3.1 + sg) * q; } }); b.hold(0, 0, 0, KZ + .03); s.add(b.mesh); return b;
      });
      this.knot = new THREE.Mesh(new THREE.SphereGeometry(.125, 28, 18), satin); this.knot.scale.set(1.2, 1, .75); this.knot.position.set(0, 0, KZ + .08); this.knot.castShadow = true; s.add(this.knot);
      for (i = 0; i < 80; i++) this.tails.forEach(function (b) { b.step(1 / 60, -7, 0); });
      this.tails.forEach(function (b) { b.shape.set(b.p); b.stiff = .006; b.wind = .9; b.wtip = true; b.wlift = 6; });   /* the tails keep their lie, loosely, and the breeze plays with their ends */
      this.tails.forEach(function (b) { b.update(0); });

      /* ---- the light inside ---- */
      var gc = cv(128, 128), gx = gc.getContext('2d'), gg = gx.createRadialGradient(64, 64, 2, 64, 64, 64); gg.addColorStop(0, 'rgba(255,248,232,1)'); gg.addColorStop(.4, 'rgba(255,238,206,.55)'); gg.addColorStop(1, 'rgba(255,226,180,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
      var gt = new THREE.CanvasTexture(gc);
      this.glow = new THREE.Mesh(new THREE.PlaneGeometry(BX * 3.4, BY * 3.0), new THREE.MeshBasicMaterial({ map: gt, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); this.glow.position.set(0, 0, BZ - .03); this.glow.renderOrder = 5; s.add(this.glow);
      var hc = cv(128, 222), hx = hc.getContext('2d'); hx.fillStyle = '#000'; hx.fillRect(0, 0, 128, 222); hx.filter = 'blur(9px)'; hx.fillStyle = '#fff'; hx.fillRect(22, 22, 84, 178); hx.filter = 'none';
      this.halo = new THREE.Mesh(new THREE.PlaneGeometry(CW * 128 / 84, CH * 222 / 178), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), color: 0xffe9c6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); this.halo.position.set(0, 0, CZ - .004); this.halo.renderOrder = 3; s.add(this.halo); this.card.renderOrder = 4;
      this.lamp = new THREE.PointLight(0xffd29a, 0, 9, 1.4); this.lamp.position.set(0, .2, .82); s.add(this.lamp);
      var n = 90, dp = new Float32Array(n * 3); this.mv = []; for (i = 0; i < n; i++) { dp[i * 3] = (RV.rand() - .5) * IX * 1.8; dp[i * 3 + 1] = (RV.rand() - .5) * IY * 1.8; dp[i * 3 + 2] = .3 + RV.rand() * 2.4; this.mv.push(.05 + RV.rand() * .12); }
      var dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); this.motes = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff0cc, size: .028, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); s.add(this.motes);
      /* the lens: darker toward the corners, as a photograph is */
      var vc = cv(128, 128), vx = vc.getContext('2d'), vg = vx.createRadialGradient(64, 64, 26, 64, 64, 92); vg.addColorStop(0, 'rgba(10,6,2,0)'); vg.addColorStop(1, 'rgba(10,6,2,.78)'); vx.fillStyle = vg; vx.fillRect(0, 0, 128, 128);
      this.vig = new THREE.Mesh(new THREE.PlaneGeometry(2 * R15 * RV.camera.aspect, 2 * R15), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(vc), transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); this.vig.renderOrder = 20; s.add(this.vig);
      this.stage = 0; this.step(0, 0, -1);
    },
    step: function (dt, t, tau) {
      var self = this, ease = RV.ease, cl = RV.clamp, on = tau >= 0, KZ = ZT + .016, cam = RV.camera;
      /* 1 · the bow comes undone: a tail is drawn, each loop shrinks through the knot, the knot loosens, the tails follow */
      var a = on ? ease(tau / .9) : 0, b = on ? ease((tau - .5) / .8) : 0, c = on ? ease((tau - 1.15) / .75) : 0;
      this.loops.forEach(function (L, k) { var sh = 1 - .95 * (k % 2 ? b : a); L.scaleRest(sh); L.shrink = sh; L.mesh.visible = sh > .08; if (L.mesh.visible) { L.step(dt, -1.2, t); L.update(t); } });
      this.tails.forEach(function (T, k) {
        var e = T.n - 1, cc = k ? c : ease((tau - 1.3) / .7); if (!on) cc = 0;
        if (k && a > 0 && c < .04) T.hold(e, .95 + a * .22, -1.32 - a * .3, ZT + .05 + a * .12); else T.free(e);
        T.scaleRest(1 - .94 * cc); T.shrink = 1 - .94 * cc; if (cc > .02) T.stiff = .2; T.mesh.visible = cc < .97; if (T.mesh.visible) { T.step(dt, -7, t); T.update(t); }
      });
      var ks = 1 - .98 * (on ? ease((tau - 1.25) / .7) : 0); this.knot.scale.set(1.2 * ks + .001, ks + .001, .75 * ks + .001); this.knot.visible = ks > .04;
      /* 2 · the knot lets go and the four arms open outward, each one swinging over its edge of the box and settling on the
         ground, like petals opening. The end is carried on an arc about the arm's foot, never through the box. */
      this.arms.forEach(function (B) {
        var e = on ? ease((tau - B.t0) / 1.55) : 0, ph0 = Math.atan2(B.zz - .02, -B.a), d0 = Math.hypot(B.a, B.zz - .02), ph = ph0 * (1 - e), rho = d0 + (B.L * .965 - d0) * e * e * (3 - 2 * e), o = B.a + rho * Math.cos(ph), z = Math.max((self.HF ? self.HF(B.d[0] * o, B.d[1] * o) : 0) + .02, .02 + rho * Math.sin(ph));
        if (!B.landed) { B.hold(B.e, B.d[0] * o, B.d[1] * o, z); B.fl = e > 0 && e < 1 ? .5 : 0; if (e >= 1) { B.landed = true; B.free(B.e); B.fl = 0; B.shape.set(B.p); B.stiff = .004; B.wind = .8; B.wtip = true; B.wlift = 10; } }   /* once down, the arm is loose: its free end lifts and ripples in the breeze, and settles back */
        B.step(dt, -9, t); B.update(t);
      });
      /* 3 · the lid: it unseats, then lifts with its weight, tips, and is carried away behind the box */
      var u1 = on ? ease((tau - 3.7) / .55) : 0, u2 = on ? cl((tau - 4.05) / 3.2, 0, 1) : 0, w = u2 * u2 * (3 - 2 * u2), w2 = w * w;
      var sway = Math.exp(-Math.max(0, tau - 7.25) * 2.2) * Math.sin(Math.max(0, tau - 7.25) * 7) * .035 * (u2 >= 1 ? 1 : 0);
      this.lid.position.set(0, LY + .6 * w, ZT + .05 * u1 + .12 * w);
      this.lid.rotation.set(-(.05 * u1 + 1.96 * Math.pow(w, 1.05)) + sway, 0, .01 * u1 * (1 - w));
      /* 4 · the light inside comes up as the lid leaves */
      var L = on ? ease((tau - 3.85) / 1.7) : 0, end = on ? ease((tau - 5.6) / 3.3) : 0, last = on ? ease((tau - 7.8) / 1.1) : 0;
      this.glow.material.opacity = L * .46 * (1 - RV.clamp(end * 2.2, 0, 1)); this.glow.scale.setScalar(.75 + .5 * L); this.lamp.intensity = L * 2.4 * (1 - .6 * last); this.spill.intensity = L * 1.25 * (1 - last); this.dof = 1 - end; this.tnow = t; this.key.intensity = 3.9 * (1 - .45 * L); this.halo.material.opacity = L * .6 * (1 - last);
      this.motes.material.opacity = L * .8 * (1 - last); var mp = this.motes.geometry.attributes.position; for (var i = 0; i < mp.count; i++) { var z = mp.getZ(i) + dt * this.mv[i] * 1.4; if (z > 3) z = .3; mp.setZ(i, z); mp.setX(i, mp.getX(i) + Math.sin(t * .7 + i) * dt * .02); } mp.needsUpdate = true;
      /* the camera: a slow creep in from the first moment; then it swings up over the box and comes down onto the card */
      /* the breeze. Its swells keep to the loop of the motion standard (1.4 s) and its multiples. Reduced motion: still. */
      var G = RV.GUST = this.RM ? 0 : .65 + .35 * Math.sin(t * 1.122), dm = this.dm;
      if (G) this.sway.forEach(function (S) { var Ls = S.list, im = S.im, n = Ls.length, k2, o, a, b;
        for (k2 = 0; k2 < n; k2++) { o = Ls[k2]; a = Math.sin(t * 2.244 + o.ph); b = Math.sin(t * 1.496 + o.ph * 1.7);
          if (S.kind === 'petal') { if (o.dr) { dm.position.set(o.x + .17 * Math.sin(t * .748 + o.ph), o.y + .1 * Math.sin(t * 1.122 + o.ph * 2.1), o.z + .06 + .045 * a); dm.rotation.set((o.rx || 0) + .5 + .45 * a, .5 * b, o.rz + .6 * Math.sin(t * .748 + o.ph)); } else { dm.position.set(o.x, o.y, o.z); dm.rotation.set((o.rx || 0) + G * .26 * (.5 + .5 * a), G * .12 * b, o.rz + .03 * b); } }
          else if (S.kind === 'bloom') { dm.position.set(o.x, o.y, o.z); dm.rotation.set(o.rx + G * .075 * Math.sin(t * 2.244 + o.ph + o.rg * .55) * (1 + o.rg * .25), 0, o.rz + G * .03 * b); }
          else { dm.position.set(o.x, o.y, o.z); dm.rotation.set((o.rx || 0) + G * .16 * (.5 + .5 * a), 0, o.rz + G * .05 * b); }
          dm.scale.set(o.sx || o.s || 1, o.sy || o.s || 1, o.sz || o.s || 1); dm.updateMatrix(); im.setMatrixAt(k2, dm.matrix); }
        im.instanceMatrix.needsUpdate = true; });
      if (this.glints) { var gl2 = this.glints, ca2 = gl2.col.array, rm = this.RM; gl2.list.forEach(function (o, n3) { var u = (t / 5.6 - o.x * .13 - o.y * .08 + hash(n3, 4) * .5) % 1; if (u < 0) u += 1; var pz = rm ? (n3 % 3 ? 0 : .45) : (u < .05 ? u / .05 : u < .17 ? 1 - (u - .05) / .12 : 0); pz = pz * pz * (3 - 2 * pz); ca2[n3 * 3] = pz * gl2.tint[0]; ca2[n3 * 3 + 1] = pz * gl2.tint[1]; ca2[n3 * 3 + 2] = pz * gl2.tint[2]; }); gl2.col.needsUpdate = true; }
      if (!this.RM) this.spk.position.set(2.6 * Math.sin(t * 1.122), -1.8 + 1.4 * Math.cos(t * 1.122), 3.2);
      var creep = on ? cl(tau / 5.0, 0, 1) : 0, th = .63 * (1 - end), ph = .21 * (1 - end), dist = (9.7 - .9 * creep) * (1 - end) + (CH / 2 / R15) * end;
      var tx = 0, ty = -.12 * (1 - end), tz = .5 * (1 - end) + CZ * end, fl = on ? (1 - last) : 0;
      cam.up.set(0, 1, 0); cam.position.set(tx - Math.sin(th) * Math.sin(ph) * dist + .02 * Math.sin(t * .6) * fl, ty - Math.sin(th) * Math.cos(ph) * dist + .015 * Math.sin(t * .83) * fl, tz + Math.cos(th) * dist); cam.lookAt(tx, ty, tz);
      this.vig.quaternion.copy(cam.quaternion); this.vig.position.copy(cam.position).add(new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)); this.vig.material.opacity = 1 - last;
    },
    render: function (r, sc, c) {
      var sz = r.getDrawingBufferSize(new THREE.Vector2());
      if (!PP.rt || PP.rt.width !== sz.x || PP.rt.height !== sz.y) {
        if (PP.rt) PP.rt.dispose();
        var ro = { stencilBuffer: true }; PP.rt = r.capabilities.isWebGL2 ? new THREE.WebGLMultisampleRenderTarget(sz.x, sz.y, ro) : new THREE.WebGLRenderTarget(sz.x, sz.y, ro); if (PP.rt.samples != null) PP.rt.samples = 4;
        PP.rt.texture.encoding = THREE.sRGBEncoding; PP.rt.texture.minFilter = PP.rt.texture.magFilter = THREE.LinearFilter; PP.rt.texture.generateMipmaps = false;
        if (!PP.pq) { PP.pq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: { tx: { value: null }, px: { value: new THREE.Vector2() }, k: { value: 1 }, tm: { value: 0 } }, depthTest: false, depthWrite: false,
          vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
          fragmentShader: 'precision highp float; uniform sampler2D tx; uniform vec2 px; uniform float k, tm; varying vec2 v;\n' +
            'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\n' +
            'void main(){ vec2 q = abs(v - vec2(.5, .53)) - vec2(.36, .39); float d = length(max(q, 0.)); float rad = k * 4.6 * smoothstep(.0, .22, d);\n' +   /* sharp on the box, softer toward the edges of the ground */
            ' vec3 c = texture2D(tx, v).rgb; if (rad > .25) { c *= .2; for (int i = 0; i < 12; i++) { float a = float(i) * 2.39996, rr = sqrt((float(i) + .5) / 12.) * rad; c += texture2D(tx, v + vec2(cos(a), sin(a)) * rr * px).rgb * (.8 / 12.); } }\n' +
            ' c = mix(c, c * c * (3. - 2. * c), .1); c += (h(v * 913. + tm) - .5) * .022; gl_FragColor = vec4(c, 1.); }' }));
          PP.ps = new THREE.Scene(); PP.ps.add(PP.pq); PP.pc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); }
      }
      var u = PP.pq.material.uniforms; u.tx.value = PP.rt.texture; u.px.value.set(1 / sz.x, 1 / sz.y).multiplyScalar(r.getPixelRatio()); u.k.value = this.dof == null ? 1 : this.dof; u.tm.value = this.RM ? 0 : (this.tnow || 0) % 7;
      r.setRenderTarget(PP.rt); r.clear(); r.render(sc, c); r.setRenderTarget(null); r.render(PP.ps, PP.pc);
      if (this.gscene && (this.dof == null || this.dof > .5)) { var ac4 = r.autoClear; r.autoClear = false; r.render(this.gscene, c); r.autoClear = ac4; }
    },
    done: function (tau) { return tau > 9.0; }
  });
})();
