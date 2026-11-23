/* The veil's cloth, as shipped: same grid rules, same strain-soft solver, same hem lift, same finger pinch.
   One class drives three reveals: the veil itself, the curtains (the same cloth in a heavier thread, parting sideways)
   and the fabric cover (the same cloth, opaque, let go and sliding off). */
(function () {
  'use strict';
  var RV = window.RV, R = RV.rules, ss = RV.ss, FZ = RV.FZ;
  function env(rf) { return 0.16 + 0.84 * Math.pow(rf, 1.5); }

  /* the tulle: a ground and crossed threads, drawn the way lib/veil-style.ts weaveOf() does */
  RV.weave = function (ground, threadAlpha, pitch, line, mark) {
    var S = 1024, c = document.createElement('canvas'); c.width = c.height = S; var a = c.getContext('2d');
    a.fillStyle = ground; a.fillRect(0, 0, S, S); a.strokeStyle = 'rgba(255,255,255,' + threadAlpha + ')'; a.lineWidth = line || 2;
    for (var d = -S; d < S * 2; d += pitch) { a.beginPath(); a.moveTo(d, 0); a.lineTo(d + S, S); a.stroke(); a.beginPath(); a.moveTo(d, S); a.lineTo(d + S, 0); a.stroke(); }
    var tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8;
    if (mark) RV.logo(function (l) { RV.stamp(a, l, S / 2, S / 2, S * mark[0], '#ffffff', mark[1]); if (mark[2]) [[0, 0], [S, 0], [0, S], [S, S]].forEach(function (q) { RV.stamp(a, l, q[0], q[1], S * mark[0], '#ffffff', mark[1]); }); tx.needsUpdate = true; });        /* the event's logo, woven in as a repeat (the shipped veil does this with its mark); mark[2] sets a second one between, for a small close pattern */
    return tx;
  };
  /* other cloths for the curtains, as one repeating tile each: what is white is thread, what is dark is air */
  RV.fabricTile = function (kind, mark) {
    if (kind === 'voile') return RV.weave('#d2d2d2', 0.5, 6, 2.2, mark);
    var S = 1024, c = document.createElement('canvas'); c.width = c.height = S; var a = c.getContext('2d'), i, j;
    if (kind === 'linen') {                                       /* a close, slubbed weave: nearly solid */
      a.fillStyle = '#e6e6e6'; a.fillRect(0, 0, S, S);
      for (i = 0; i < S; i += 8) { a.fillStyle = 'rgba(255,255,255,' + (0.25 + RV.rand() * 0.6) + ')'; a.fillRect(0, i, S, 4 + RV.rand() * 2); a.fillStyle = 'rgba(120,120,120,' + (0.1 + RV.rand() * 0.25) + ')'; a.fillRect(i + 5, 0, 2, S); }
      for (i = 0; i < 90; i++) { a.fillStyle = 'rgba(255,255,255,.8)'; a.fillRect(RV.rand() * S, RV.rand() * S, 30 + RV.rand() * 90, 3); }
    } else if (kind === 'lace') {                                  /* a net with flowers worked into it */
      a.fillStyle = '#585858'; a.fillRect(0, 0, S, S); a.strokeStyle = 'rgba(255,255,255,.5)'; a.lineWidth = 2;
      for (var dg = -S; dg < S * 2; dg += 16) { a.beginPath(); a.moveTo(dg, 0); a.lineTo(dg + S, S); a.stroke(); a.beginPath(); a.moveTo(dg, S); a.lineTo(dg + S, 0); a.stroke(); }
      a.fillStyle = '#ffffff'; a.strokeStyle = '#ffffff';
      for (j = 0; j < 4; j++) for (i = 0; i < 4; i++) { var fx = i * 256 + (j % 2) * 128 + 64, fy = j * 256 + 128, p;
        [[0, 0], [S, 0], [-S, 0]].forEach(function (o) { for (p = 0; p < 6; p++) { var an = p / 6 * 6.283; a.beginPath(); a.ellipse(fx + o[0] + Math.cos(an) * 40, fy + Math.sin(an) * 40, 30, 15, an, 0, 6.283); a.fill(); } a.beginPath(); a.arc(fx + o[0], fy, 16, 0, 6.283); a.fill();
          a.lineWidth = 5; a.beginPath(); a.arc(fx + o[0], fy, 96, 0, 6.283); a.stroke(); for (p = 0; p < 12; p++) { var a2 = p / 12 * 6.283; a.beginPath(); a.arc(fx + o[0] + Math.cos(a2) * 96, fy + Math.sin(a2) * 96, 8, 0, 6.283); a.fill(); } }); }
    } else {                                                       /* stripe: sheer gauze with close-woven bands */
      a.fillStyle = '#8c8c8c'; a.fillRect(0, 0, S, S); a.strokeStyle = 'rgba(255,255,255,.45)'; a.lineWidth = 2;
      for (i = 0; i < S; i += 7) { a.beginPath(); a.moveTo(0, i); a.lineTo(S, i); a.stroke(); a.beginPath(); a.moveTo(i, 0); a.lineTo(i, S); a.stroke(); }
      a.fillStyle = '#f4f4f4'; for (i = 0; i < 4; i++) { a.fillRect(i * 256 + 40, 0, 70, S); a.fillRect(i * 256 + 130, 0, 12, S); }
    }
    var tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8;
    if (mark) RV.logo(function (l) { RV.stamp(a, l, S / 2, S / 2, S * mark[0], kind === 'lace' ? '#ffffff' : '#fafafa', mark[1]); tx.needsUpdate = true; });
    return tx;
  };
  /* a worked bottom edge for the veil: lace scallops, an embroidered vine, or pearl beads. One strip along the hem */
  RV.hemTexture = function (kind) {
    var Wd = 2048, Hd = 512, c = document.createElement('canvas'); c.width = Wd; c.height = Hd; var a = c.getContext('2d'), i, p;
    a.fillStyle = '#000'; a.fillRect(0, 0, Wd, Hd); a.strokeStyle = '#fff'; a.fillStyle = '#fff'; a.lineCap = 'round';
    function dot(x, y, r) { a.beginPath(); a.arc(x, y, r, 0, 6.283); a.fill(); }
    if (kind === 'lace') {
      for (i = 0; i < 16; i++) { var cx = i * 128 + 64, cy = Hd - 14 - 60;
        a.lineWidth = 6; a.beginPath(); a.arc(cx, cy, 60, 0, Math.PI); a.stroke(); a.lineWidth = 3; a.beginPath(); a.arc(cx, cy, 45, 0, Math.PI); a.stroke(); a.beginPath(); a.arc(cx, cy, 28, 0, Math.PI); a.stroke();
        for (p = 0; p <= 8; p++) { var an = p / 8 * Math.PI; a.beginPath(); a.moveTo(cx + Math.cos(an) * 28, cy + Math.sin(an) * 28); a.lineTo(cx + Math.cos(an) * 45, cy + Math.sin(an) * 45); a.stroke(); dot(cx + Math.cos(an) * 53, cy + Math.sin(an) * 53, 3.4); }
        for (p = 0; p < 6; p++) { var a3 = p / 6 * 6.283; dot(cx + Math.cos(a3) * 11, cy - 26 + Math.sin(a3) * 11, 6.5); } dot(cx, cy - 26, 4); dot(cx + 64, cy + 2, 6);
      }
      a.lineWidth = 5; a.beginPath(); a.moveTo(0, Hd - 74 - 52); a.lineTo(Wd, Hd - 74 - 52); a.stroke(); a.lineWidth = 3; a.beginPath(); a.moveTo(0, Hd - 74 - 74); a.lineTo(Wd, Hd - 74 - 74); a.stroke();
      for (i = 0; i < Wd; i += 22) dot(i + 11, Hd - 74 - 63, 3.2);
      for (i = 0; i < Wd; i += 64) { a.lineWidth = 2.5; a.beginPath(); a.moveTo(i + 32, Hd - 180); a.lineTo(i + 44, Hd - 196); a.lineTo(i + 32, Hd - 212); a.lineTo(i + 20, Hd - 196); a.closePath(); a.stroke(); dot(i + 32, Hd - 196, 3); dot(i, Hd - 240, 2.4); }
    } else if (kind === 'vine') {
      a.lineWidth = 6; a.beginPath(); a.moveTo(0, Hd - 18); a.lineTo(Wd, Hd - 18); a.stroke(); a.lineWidth = 2.5; a.beginPath(); a.moveTo(0, Hd - 34); a.lineTo(Wd, Hd - 34); a.stroke();
      a.lineWidth = 5; a.beginPath(); for (i = 0; i <= Wd; i += 8) { var y = Hd - 100 + 30 * Math.sin(i / 256 * 6.283); if (i) a.lineTo(i, y); else a.moveTo(i, y); } a.stroke();
      for (i = 0; i < Wd; i += 64) { var yy = Hd - 100 + 30 * Math.sin(i / 256 * 6.283), up = (i / 64) % 2 ? 1 : -1, sl = Math.cos(i / 256 * 6.283) * 0.7; a.save(); a.translate(i, yy); a.rotate(sl + up * 0.9); a.beginPath(); a.ellipse(26, 0, 26, 10, 0, 0, 6.283); a.fill(); a.restore();
        if ((i / 64) % 4 === 1) { for (p = 0; p < 5; p++) { var a4 = p / 5 * 6.283; dot(i + 20 + Math.cos(a4) * 10, yy - 46 + Math.sin(a4) * 10, 6); } } }
      a.lineWidth = 2.5; a.beginPath(); a.moveTo(0, Hd - 166); a.lineTo(Wd, Hd - 166); a.stroke(); for (i = 0; i < Wd; i += 32) dot(i + 16, Hd - 180, 2.6);
    } else {                                                       /* pearls */
      for (i = 0; i < Wd; i += 26) { dot(i + 13, Hd - 20, 9); dot(i, Hd - 44, 5.5); }
      for (i = 0; i < Wd; i += 104) { dot(i + 52, Hd - 66, 6.5); dot(i + 52, Hd - 84, 5); dot(i + 52, Hd - 99, 3.6); dot(i + 39, Hd - 60, 4); dot(i + 65, Hd - 60, 4); }
      a.lineWidth = 2; a.beginPath(); a.moveTo(0, Hd - 32); a.lineTo(Wd, Hd - 32); a.stroke();
    }
    var tx = new THREE.CanvasTexture(c); tx.wrapS = THREE.RepeatWrapping; tx.repeat.set(1, 4); tx.anisotropy = 8; return tx;
  };
  /* the veil's material: matte cloth that turns whiter and more solid where it folds away from you */
  RV.clothMaterial = function (o) {
    var mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.color || '#f3ece1'), roughness: o.rough == null ? 0.82 : o.rough, metalness: 0, transparent: true, opacity: o.opacity == null ? 0.92 : o.opacity, side: THREE.DoubleSide, depthWrite: o.solid === true, map: o.map || null, alphaMap: o.alphaMap || null });
    var fr = o.fresnel == null ? 0.6 : o.fresnel, fa = o.fresnelA == null ? 0.45 : o.fresnelA;
    mat.onBeforeCompile = function (sh) {
      sh.vertexShader = 'varying vec3 vWP;varying vec3 vNN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;vNN=normalize(mat3(modelMatrix)*objectNormal);');
      sh.fragmentShader = 'varying vec3 vWP;varying vec3 vNN;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\nvec3 V=normalize(cameraPosition-vWP);float fr=pow(1.0-abs(dot(V,normalize(vNN))),1.8);gl_FragColor.rgb+=fr*' + fr.toFixed(3) + ';gl_FragColor.a=clamp(gl_FragColor.a+fr*' + fa.toFixed(3) + ',0.0,1.0);');
    };
    return mat;
  };

  function Drape(o) {
    var cols = this.cols = o.cols || 66, rows = this.rows = o.rows || 50, N = this.N = cols * rows, vh = RV.vh, vw = RV.vw, ix, iy, self = this;
    var c = this.cfg = { weight: R.WEIGHT, bounce: R.BOUNCE, float: R.FLOAT, trail: R.TRAIL, wind: R.WIND, full: R.FULL, folds: R.FOLDS, reach: R.REACH, valance: R.VALANCE, liftPk: R.LIFTPK, hold: R.HOLD, stretch: R.STRETCH };
    for (var k in (o.cfg || {})) c[k] = o.cfg[k];
    this.mode = o.mode || 'veil'; this.side = o.side || 0; this.twist = o.twist || 0; this.keep = !!o.keep; this.hang = 0;
    this.px = new Float32Array(N); this.py = new Float32Array(N); this.pz = new Float32Array(N); this.qx = new Float32Array(N); this.qy = new Float32Array(N); this.qz = new Float32Array(N);
    this.free = new Uint8Array(cols);                                   /* a top pin that has been let go (fabric only) */
    this.topPin = vh * 1.06; this.clothH = vh * (2.12 - c.reach / 47);
    var x0 = o.x0 == null ? -vw * 1.2 : o.x0, x1 = o.x1 == null ? vw * 1.2 : o.x1, pinW = this.pinW = x1 - x0, extra = 0.04 + (c.full / 100) * 0.4;
    this.dy = this.clothH / (rows - 1); this.pinX = new Float32Array(cols); this.pin0 = new Float32Array(cols); this.rowDx = new Float32Array(rows);
    for (ix = 0; ix < cols; ix++) this.pin0[ix] = this.pinX[ix] = x0 + ix / (cols - 1) * pinW;
    for (iy = 0; iy < rows; iy++) this.rowDx[iy] = (pinW * (1 + extra * env(iy / (rows - 1)))) / (cols - 1);
    /* constraints: along, down, and one diagonal, as buildGridConstraints() */
    var A = [], B = [], L = [];
    for (iy = 0; iy < rows; iy++) for (ix = 0; ix < cols; ix++) { var a = iy * cols + ix;
      if (ix < cols - 1) { A.push(a); B.push(a + 1); L.push(this.rowDx[iy]); }
      if (iy < rows - 1) { A.push(a); B.push(a + cols); L.push(this.dy); }
      if (ix < cols - 1 && iy < rows - 1) { A.push(a); B.push(a + cols + 1); L.push(Math.hypot(this.rowDx[iy], this.dy)); } }
    this.ca = new Int32Array(A); this.cb = new Int32Array(B); this.cr = new Float64Array(L);
    var geo = this.geo = new THREE.PlaneGeometry(pinW, this.clothH, cols - 1, rows - 1); this.pos = geo.attributes.position;
    if (o.flipU) { var uv = geo.attributes.uv; for (ix = 0; ix < uv.count; ix++) uv.setX(ix, 1 - uv.getX(ix)); }
    this.mesh = new THREE.Mesh(geo, o.material); this.mesh.frustumCulled = false; this.mesh.castShadow = !!o.shadow;
    if (o.material.alphaMap && o.tilePx) o.material.alphaMap.repeat.set((pinW / (2 * vw)) * RV.renderer.domElement.clientWidth / o.tilePx, (this.clothH / (2 * vh)) * RV.renderer.domElement.clientHeight / o.tilePx);
    this.grabs = {}; this.t = 0;
    /* seedPose(1.0): hanging straight, the folds already blooming toward the hem */
    for (iy = 0; iy < rows; iy++) for (ix = 0; ix < cols; ix++) { var q = iy * cols + ix, fx = ix / (cols - 1), rf = iy / (rows - 1);
      this.px[q] = this.pin0[ix]; this.py[q] = this.topPin - iy * this.dy; this.pz[q] = iy === 0 ? FZ : FZ + (c.full / 100) * 0.26 * env(rf) * Math.sin(fx * 6.2832 * c.folds * (pinW / (2.4 * vw)) + rf * self.twist);
      this.qx[q] = this.px[q]; this.qy[q] = this.py[q]; this.qz[q] = this.pz[q]; }
    this.settling = true; for (var s = 0; s < 120; s++) this.step(1 / 60, 0, false); this.settling = false; this.sync();
  }
  Drape.prototype.relax = function (maxS) {
    var px = this.px, py = this.py, pz = this.pz, ca = this.ca, cb = this.cb, cr = this.cr, cols = this.cols, fr = this.free, COMP = R.COMP, TENB = R.TENB;
    for (var c = 0, n = ca.length; c < n; c++) { var A = ca[c], B = cb[c], rest = cr[c], ex = px[B] - px[A], ey = py[B] - py[A], ez = pz[B] - pz[A], dd = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-4, diff = dd - rest, strain = diff / rest;
      var stiff = strain <= 0 ? COMP : TENB + (1 - TENB) * Math.min(1, strain / maxS), f = (diff / dd) * stiff * 0.5, ox = ex * f, oy = ey * f, oz = ez * f;
      if (A >= cols || fr[A]) { px[A] += ox; py[A] += oy; pz[A] += oz; } if (B >= cols || fr[B]) { px[B] -= ox; py[B] -= oy; pz[B] -= oz; } }
  };
  Drape.prototype.clampPass = function () {
    var px = this.px, py = this.py, pz = this.pz, ca = this.ca, cb = this.cb, cr = this.cr, cols = this.cols, fr = this.free;
    for (var c = 0, n = ca.length; c < n; c++) { var A = ca[c], B = cb[c], lim = cr[c] * R.CLAMP, ex = px[B] - px[A], ey = py[B] - py[A], ez = pz[B] - pz[A], dd = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-4;
      if (dd > lim) { var f = ((dd - lim) / dd) * 0.5, ox = ex * f, oy = ey * f, oz = ez * f; if (A >= cols || fr[A]) { px[A] += ox; py[A] += oy; pz[A] += oz; } if (B >= cols || fr[B]) { px[B] -= ox; py[B] -= oy; pz[B] -= oz; } } }
  };
  Drape.prototype.step = function (dt, lift, fth) {
    var c = this.cfg, cols = this.cols, rows = this.rows, N = this.N, px = this.px, py = this.py, pz = this.pz, qx = this.qx, qy = this.qy, qz = this.qz, vh = RV.vh, vw = RV.vw, k, ix, iy;
    this.t += dt; var t = this.t, le = ss(0, 0.7, lift), veil = this.mode === 'veil', slide = this.mode === 'slide';
    if (this.keep && lift > 0.02 && this.hang < 1) this.hang = Math.min(1, this.hang + 1 / 60);        /* the shipped drape: once lifted, the veil's weight comes back and it hangs */
    var drag = slide ? 0.955 : (this.keep && lift > 0.5) ? 0.9 : 0.952 + (c.bounce / 100) * 0.03 + (fth ? 0.012 : 0);
    var g = -(2.5 + (c.weight / 100) * 7) * (fth && veil && !this.keep ? 0.5 : 1) * (1 - (veil ? (c.float / 100) * 0.92 * le * (1 - this.hang) : 0));
    var wind = this.settling ? 0 : (c.wind / 100) * 5 * (slide && lift > 0.004 ? 0 : 1), gx = 0;
    /* the curtain: its rings slide along the rod. The inner ring leads; each ring stops against the next */
    if (this.mode === 'curtain') {
      var s = this.side, inner = s < 0 ? this.pin0[cols - 1] : this.pin0[0], outer = s < 0 ? this.pin0[0] : this.pin0[cols - 1], gap = 0.0105;
      var edge = inner + (outer - inner) * ss(0.0, 0.86, lift) + s * 0.9 * ss(0.8, 1, lift) * vw;
      for (ix = 0; ix < cols; ix++) { var n = s < 0 ? cols - 1 - ix : ix, lim = edge + s * n * gap; this.pinX[ix] = s < 0 ? Math.min(this.pin0[ix], lim) + s * 0.9 * ss(0.8, 1, lift) * vw * 0 : Math.max(this.pin0[ix], lim); }
    }
    if (slide && lift > 0.004) for (ix = 0; ix < cols; ix++) this.free[ix] = 1;                       /* nothing holds it: it lies on the table */
    if (slide) { g = 0; drag = 0.86; }                                                                /* no fall; the table's friction */
    for (k = 0; k < N; k++) {
      if (k < cols && !this.free[k]) { px[k] = this.pinX[k]; py[k] = this.topPin + 0.005 * Math.sin(t * 0.7 + k * 0.3); pz[k] = FZ + (this.mode === 'curtain' ? 0.03 * Math.sin(k * 1.9) * ss(0.1, 0.7, lift) : 0); qx[k] = px[k]; qy[k] = py[k]; qz[k] = pz[k]; continue; }
      ix = k % cols; iy = (k / cols) | 0; var rf = iy / (rows - 1), we = rf * rf * (0.35 + 0.65 * rf);
      var aw = wind * we * (Math.sin(t * 0.6 + iy * 0.24 + ix * 0.13) + 0.35 * Math.sin(t * 1.1 + ix * 0.3)), az = wind * 0.55 * we * Math.cos(t * 0.5 + ix * 0.12 + iy * 0.1);
      var nx = px[k] + (px[k] - qx[k]) * drag + (aw + gx) * dt * dt, ny = py[k] + (py[k] - qy[k]) * drag + g * dt * dt, nz = pz[k] + (pz[k] - qz[k]) * drag + az * dt * dt;
      qx[k] = px[k]; qy[k] = py[k]; qz[k] = pz[k]; px[k] = nx; py[k] = ny; pz[k] = nz;
    }
    /* the veil's lift: the hem is drawn up and back, the ends more than the middle; the cloth follows it */
    if (veil && lift > 0.015) {
      var pull0 = (0.05 + (c.trail / 100) * 0.32) * ss(0.02, 0.42, lift), hemUp = Math.max(0.2, this.clothH / vh - 4 * ((this.keep ? 15 : c.valance) / 100)), hy = this.topPin + vh * hemUp * ss(0.02, 1, lift), hz = FZ - 0.25;
      var tp = this.tapAt, tfx = tp ? (tp.x - this.pin0[0]) / this.pinW : -1;
      if (tp) {                                             /* owner, 23 Nov: "tap and it will unveil from that point pulling up the veil" */
        if (!this.lead) { var Rl = 0.2, lead = []; for (k = cols; k < N; k++) { var ddx = px[k] - tp.x, ddy = py[k] - tp.y, d2 = ddx * ddx + ddy * ddy; if (d2 < Rl * Rl) lead.push({ k: k, ox: ddx, oy: ddy, w: 1 - Math.sqrt(d2) / Rl }); } this.lead = lead; }
        var up = ss(0.0, 0.9, lift), ly = tp.y + (this.topPin + vh * (this.keep ? 0.02 : 0.5) - tp.y) * up, lx = tp.x * (1 - 0.35 * up), lz = FZ + 0.55 * Math.sin(Math.PI * Math.min(1, up * 1.15)) - 0.25 * up, lw = 0.22 * ss(0.0, 0.12, lift) * (this.keep ? 1 - ss(0.75, 1, lift) : 1);
        for (var li = 0; li < this.lead.length; li++) { var Lk = this.lead[li], kq = Lk.k, ww = lw * Lk.w; px[kq] += (lx + Lk.ox * (1 - 0.7 * up) - px[kq]) * ww; py[kq] += (ly + Lk.oy * (1 - 0.7 * up) - py[kq]) * ww; pz[kq] += (lz - pz[kq]) * ww; }
        pull0 *= ss(0.18, 0.6, lift);                       /* the hem waits, then follows the lifted point */
      }
      for (ix = 0; ix < cols; ix++) { var fx = ix / (cols - 1), endW = tp ? Math.exp(-Math.pow((fx - tfx) / 0.34, 2)) : Math.max(0, 1 - Math.min(fx, 1 - fx) / 0.3), w = pull0 * (0.3 + 0.7 * endW), vk = (rows - 1) * cols + ix;
        px[vk] += (this.pinX[ix] - px[vk]) * w * 0.4; py[vk] += (hy - py[vk]) * w; pz[vk] += (hz - pz[vk]) * w; }
    }
    if (slide && lift > 0.004) {
      var sp = this.tapAt || { x: 0, y: -vh * 0.55 };
      if (!this.lead) { var Rs = 0.26, ld = []; for (k = 0; k < N; k++) { var sx = px[k] - sp.x, sy = py[k] - sp.y, s2 = sx * sx + sy * sy; if (s2 < Rs * Rs) ld.push({ k: k, ox: sx, oy: sy, w: 1 - Math.sqrt(s2) / Rs }); } this.lead = ld; }
      var dn = ss(0.0, 1, lift), hx = sp.x * (1 - 0.6 * dn), hy2 = sp.y + (-vh * 3.4 - sp.y) * dn, hz2 = FZ + 0.22 * Math.sin(Math.PI * Math.min(1, dn * 3)), hw = 0.5 * ss(0.0, 0.06, lift);     /* the hand: it lifts a pinch of cloth and walks it down and off */
      for (var si = 0; si < this.lead.length; si++) { var Sk = this.lead[si], kz = Sk.k, wz = hw * Sk.w; px[kz] += (hx + Sk.ox * 0.25 - px[kz]) * wz; py[kz] += (hy2 + Sk.oy * 0.25 - py[kz]) * wz; pz[kz] += (hz2 - pz[kz]) * wz; }
    }
    var maxS = 0.004 + (c.stretch / 100) * 0.12, pz0 = FZ + (c.liftPk / 100) * 0.9, gl = Object.keys(this.grabs);
    for (var it = 0; it < R.RELAX; it++) {
      for (var gi = 0; gi < gl.length; gi++) { var gg = this.grabs[gl[gi]], cl = gg.cluster; for (var ci = 0; ci < cl.length; ci++) { var kk = cl[ci].k; if (kk < cols && !this.free[kk]) continue;
        px[kk] += (gg.cx + cl[ci].ox * 0.3 - px[kk]) * 0.4; py[kk] += (gg.cy + cl[ci].oy * 0.3 - py[kk]) * 0.4; pz[kk] += (pz0 - pz[kk]) * 0.32; } }
      this.relax(maxS);
    }
    for (var sit = 0; sit < R.CLAMPS; sit++) this.clampPass();
    if (slide && lift > 0.004) { for (iy = 1; iy < rows - 1; iy++) for (ix = 1; ix < cols - 1; ix++) { k = iy * cols + ix; var sm = 0.22;
        px[k] += ((px[k - 1] + px[k + 1] + px[k - cols] + px[k + cols]) * 0.25 - px[k]) * sm; py[k] += ((py[k - 1] + py[k + 1] + py[k - cols] + py[k + cols]) * 0.25 - py[k]) * sm; pz[k] += ((pz[k - 1] + pz[k + 1] + pz[k - cols] + pz[k + cols]) * 0.25 - pz[k]) * sm; } }
    if (slide && lift > 0.004) for (k = 0; k < N; k++) { if (pz[k] < FZ - 0.02) pz[k] = FZ - 0.02; if (pz[k] > FZ + 0.5) pz[k] = FZ + 0.5; }     /* it stays on the table */
    if (!this.settling) this.sync();
  };
  Drape.prototype.sync = function () {
    var p = this.pos.array, px = this.px, py = this.py, pz = this.pz, zc = RV.CAMZ - 0.7;
    for (var k = 0, o = 0; k < this.N; k++, o += 3) { p[o] = px[k]; p[o + 1] = py[k]; p[o + 2] = Math.min(zc, pz[k]); }
    this.pos.needsUpdate = true; this.geo.computeVertexNormals();
  };
  /* the pinch: the points under the finger gather to it and come forward (veil-reveal.tsx onDown) */
  Drape.prototype.grab = function (id, w) {
    var Rr = 0.018 + (this.cfg.hold / 100) * 0.1, R2 = Rr * Rr, cl = [], best = -1, bd = 1e9;
    for (var k = this.cols; k < this.N; k++) { var dx = this.px[k] - w.x, dy = this.py[k] - w.y, d2 = dx * dx + dy * dy; if (d2 < R2) cl.push({ k: k, ox: dx, oy: dy }); if (d2 < bd) { bd = d2; best = k; } }
    if (!cl.length) { if (bd > 0.25) return false; cl.push({ k: best, ox: 0, oy: 0 }); }
    this.grabs[id] = { cluster: cl, cx: w.x, cy: w.y }; return true;
  };
  Drape.prototype.drag = function (id, w) { var g = this.grabs[id]; if (g) { g.cx = w.x; g.cy = w.y; } };
  Drape.prototype.release = function (id) { delete this.grabs[id]; };
  RV.Drape = Drape;
  RV.pinchZ = function () { return FZ + (R.LIFTPK / 100) * 0.9; };

  function clothReveal(def) {
    return { label: def.label, dir: def.dir, dragZ: FZ + 0.63, srgb: def.srgb, stay: def.stay, push: def.push,
      init: function () { def.init.call(this); },
      grab: function (id, w) { this.drapes.forEach(function (d) { d.grab(id, w); }); },
      drag: function (id, w) { this.drapes.forEach(function (d) { d.drag(id, w); }); },
      release: function (id) { this.drapes.forEach(function (d) { d.release(id); }); },
      opened: function (wx, wy) { if (def.fromTap) this.drapes.forEach(function (d) { d.tapAt = { x: wx, y: wy }; }); },
      step: function (dt, t, lift, fth) { this.drapes.forEach(function (d) { d.step(dt, lift, fth); }); if (def.step) def.step.call(this, dt, t, lift); } };
  }

  /* 1 · THE VEIL — the shipped reveal. Ivory tulle, the locked weave (ground #242424, threads 5.5% every 12 px). */
  RV.options('veil', [
    { key: 'logo', label: 'Logo pattern', choices: [['small', 'Small'], ['tiny', 'Tiny'], ['large', 'Large'], ['none', 'None']] },
    { key: 'hem', label: 'Bottom edge', choices: [['plain', 'Plain'], ['lace', 'Lace scallops'], ['vine', 'Embroidered vine'], ['pearls', 'Pearl beads']] }]);
  RV.register('veil', clothReveal({ label: 'Veil', srgb: true, fromTap: true, stay: true, push: 0.07, init: function () {
    RV.lights(0.8);
    var lg = RV.opt('veil', 'logo'), mark = lg === 'none' ? null : lg === 'large' ? [0.42, 0.5] : lg === 'tiny' ? [0.14, 0.55, 1] : [0.2, 0.52, 1];   /* owner, 23 Nov: "veil logo patterns need to be small" */
    var mat = RV.clothMaterial({ color: '#f3ece1', alphaMap: RV.weave('#4e4e4e', 0.075, 12, 2, mark) });   /* the weave is the shipped pattern; its density is matched by eye to the live cale-ice capture */
    var d = new Drape({ material: mat, tilePx: 125, keep: true }); RV.scene.add(d.mesh); this.drapes = [d];
    var hem = RV.opt('veil', 'hem');
    if (hem !== 'plain') {                                         /* the worked edge rides the same cloth: it shares its every point */
      var hm = new THREE.MeshStandardMaterial({ color: new THREE.Color('#fffaf0'), alphaMap: RV.hemTexture(hem), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      var he = new THREE.Mesh(d.geo, hm); he.frustumCulled = false; he.renderOrder = 2; RV.scene.add(he);
    }
  } }));

  /* 2 · BEACH CURTAINS — the veil's cloth in a thicker thread, hung in two halves on a rod, parting sideways. */
  RV.options('curtains', [
    { key: 'fabric', label: 'Fabric', choices: [['voile', 'Sheer voile'], ['linen', 'Linen'], ['lace', 'Lace'], ['stripe', 'Striped gauze']] },
    { key: 'color', label: 'Colour', choices: [['ivory', 'Ivory'], ['white', 'White'], ['blush', 'Blush'], ['sand', 'Sand'], ['sage', 'Sage']] }]);
  RV.register('curtains', clothReveal({ label: 'Beach curtains', srgb: true, init: function () {
    RV.lights(0.42); RV.shadows(0.22);
    var self = this, vw = RV.vw; this.drapes = [];
    [-1, 1].forEach(function (side) {
      var fab = RV.opt('curtains', 'fabric'), col = { ivory: '#efe6d6', white: '#f7f4ee', blush: '#f0d6cf', sand: '#e0cdae', sage: '#d3dcc8' }[RV.opt('curtains', 'color')];
      var mat = RV.clothMaterial({ color: col, alphaMap: RV.fabricTile(fab, [fab === 'voile' ? 0.5 : 0.36, 0.75]), opacity: 1, fresnel: 0.2, fresnelA: 0.35 });
      var d = new Drape({ cols: 40, rows: 50, mode: 'curtain', side: side, x0: side < 0 ? -vw * 1.12 : -0.04, x1: side < 0 ? 0.04 : vw * 1.12, material: mat, tilePx: 96, shadow: true, flipU: side > 0,
        cfg: { weight: 52, wind: 34, full: 100, folds: 16, reach: 2 } });
      RV.scene.add(d.mesh); self.drapes.push(d);
    });
    var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, vw * 2.6, 12), new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.6 })); rod.rotation.z = Math.PI / 2; rod.position.set(0, RV.vh * 1.04, RV.FZ + 0.02); RV.scene.add(rod);
  } }));

  /* 5 · FABRIC — one twisted drape of satin, no ribbon. It is let go a ring at a time and slides off under its own
        weight, the way a cover comes off a car: slowly, the last corner trailing. */
  RV.options('fabric', [
    { key: 'design', label: 'Fabric', choices: [['satin', 'Plain satin'], ['jacquard', 'Damask jacquard'], ['mulberry', 'Raw mulberry silk'], ['chiffon', 'Chiffon'], ['velvet', 'Velvet'], ['linen', 'Linen'], ['organza', 'Organza'], ['tulle', 'Tulle'], ['lace', 'Lace']] },
    { key: 'color', label: 'Colour', choices: [['champagne', 'Champagne'], ['ivory', 'Ivory'], ['blush', 'Blush'], ['mulberry', 'Mulberry'], ['emerald', 'Emerald'], ['midnight', 'Midnight']] }]);
  RV.register('fabric', clothReveal({ label: 'Fabric', dir: [0, -1], fromTap: true, push: 0.14, init: function () {
    RV.lights(0.5); RV.shadows(0.3);
    var sc = document.createElement('canvas'); sc.width = 512; sc.height = 888; var sx = sc.getContext('2d'), stx = new THREE.CanvasTexture(sc), si = new Image(); sx.fillStyle = '#d8c49a'; sx.fillRect(0, 0, 512, 888);
    var des = RV.opt('fabric', 'design'), cn = RV.opt('fabric', 'color'), tint = { champagne: null, ivory: '#efe6d8', blush: '#e2aaa6', mulberry: '#74284c', emerald: '#1d6048', midnight: '#22335c' }[cn], dark = cn === 'mulberry' || cn === 'emerald' || cn === 'midnight';
    function finish() {
      var k;
      if (des === 'jacquard') { var di = new Image(); RV.hold(); di.onload = function () { sx.globalCompositeOperation = 'multiply'; sx.globalAlpha = 0.55; for (k = 0; k < 2; k++) sx.drawImage(di, 60, 60, di.width - 120, di.height - 120, 0, k * 444, 512, 444); sx.globalAlpha = 1; sx.globalCompositeOperation = 'source-over'; colour(); RV.unhold(); }; di.src = window.TEX.damaskR; }   /* a damask figure woven tone on tone */
      else { var X2 = sx, q, a2, b2;
        if (des === 'chiffon') { X2.fillStyle = 'rgba(252,246,232,.42)'; X2.fillRect(0, 0, 512, 888); for (k = 0; k < 3200; k++) { a2 = RV.rand() * 512; b2 = RV.rand() * 888; q = RV.rand() * 6.283; X2.strokeStyle = RV.rand() > .5 ? 'rgba(255,255,255,.12)' : 'rgba(110,84,44,.08)'; X2.lineWidth = .8; X2.beginPath(); X2.moveTo(a2, b2); X2.lineTo(a2 + Math.cos(q) * 9, b2 + Math.sin(q) * 9); X2.stroke(); } }
        if (des === 'velvet') { X2.fillStyle = 'rgba(40,26,8,.34)'; X2.fillRect(0, 0, 512, 888); for (k = 0; k < 150; k++) { a2 = RV.rand() * 512; b2 = RV.rand() * 888; q = 30 + RV.rand() * 90; var vg = X2.createRadialGradient(a2, b2, 0, a2, b2, q); vg.addColorStop(0, k % 2 ? 'rgba(255,236,196,.13)' : 'rgba(20,12,2,.16)'); vg.addColorStop(1, 'rgba(120,96,60,0)'); X2.fillStyle = vg; X2.fillRect(a2 - q, b2 - q, q * 2, q * 2); } }
        if (des === 'linen') { X2.fillStyle = 'rgba(216,196,154,.62)'; X2.fillRect(0, 0, 512, 888); for (k = 0; k < 296; k++) { X2.fillStyle = RV.rand() > .5 ? 'rgba(255,250,236,' + (.05 + RV.rand() * .16) + ')' : 'rgba(96,74,40,' + (.05 + RV.rand() * .16) + ')'; X2.fillRect(0, k * 3, 512, 1.4); } for (k = 0; k < 171; k++) { X2.fillStyle = RV.rand() > .5 ? 'rgba(255,250,236,' + (.05 + RV.rand() * .14) + ')' : 'rgba(96,74,40,' + (.05 + RV.rand() * .14) + ')'; X2.fillRect(k * 3, 0, 1.4, 888); } }
        if (des === 'organza') { X2.fillStyle = 'rgba(255,250,238,.3)'; X2.fillRect(0, 0, 512, 888); X2.fillStyle = 'rgba(255,255,255,.1)'; for (k = 0; k < 222; k++) X2.fillRect(0, k * 4, 512, 1); for (k = 0; k < 128; k++) X2.fillRect(k * 4, 0, 1, 888); }
        if (des === 'tulle') { X2.fillStyle = 'rgba(250,244,230,.5)'; X2.fillRect(0, 0, 512, 888); X2.lineWidth = 1; for (k = -100; k < 160; k++) { X2.strokeStyle = 'rgba(92,70,36,.3)'; X2.beginPath(); X2.moveTo(k * 9, 0); X2.lineTo(k * 9 + 512, 888); X2.stroke(); X2.beginPath(); X2.moveTo(k * 9, 0); X2.lineTo(k * 9 - 512, 888); X2.stroke(); X2.strokeStyle = 'rgba(255,255,255,.26)'; X2.beginPath(); X2.moveTo(k * 9 + 1.5, 0); X2.lineTo(k * 9 + 513.5, 888); X2.stroke(); } }
        if (des === 'lace') { X2.lineCap = 'round'; [[1.6, 2, 'rgba(84,62,30,.4)'], [0, 0, 'rgba(255,252,240,.8)']].forEach(function (o) { X2.save(); X2.translate(o[0], o[1]); X2.strokeStyle = o[2]; X2.fillStyle = o[2]; X2.lineWidth = 2.2; for (var r = 0; r < 9; r++) for (var c = 0; c < 6; c++) { var lx = c * 102 + (r % 2) * 51, ly = r * 111, pk; for (pk = 0; pk < 8; pk++) { var la = pk / 8 * 6.283; X2.beginPath(); X2.ellipse(lx + Math.cos(la) * 24, ly + Math.sin(la) * 24, 15, 8, la, 0, 7); X2.stroke(); } X2.beginPath(); X2.arc(lx, ly, 7, 0, 7); X2.stroke(); X2.beginPath(); X2.arc(lx, ly, 45, 0, 7); X2.stroke(); for (pk = 0; pk < 6; pk++) { X2.beginPath(); X2.arc(lx + 51 + Math.cos(pk) * 14, ly + 55 + Math.sin(pk * 2.1) * 14, 2.2, 0, 7); X2.fill(); } } X2.restore(); }); }
        if (des === 'mulberry') { for (k = 0; k < 700; k++) { var yy = RV.rand() * 888, xx = RV.rand() * 512, ln = 20 + RV.rand() * 160; sx.fillStyle = RV.rand() > 0.5 ? 'rgba(255,250,236,.16)' : 'rgba(90,70,40,.13)'; sx.fillRect(xx, yy, ln, 1 + RV.rand() * 1.6); } }   /* raw mulberry silk: slubs running across */
        colour(); }
    }
    function colour() {
      if (tint) { sx.globalCompositeOperation = 'color'; sx.fillStyle = tint; sx.fillRect(0, 0, 512, 888); if (dark) { sx.globalCompositeOperation = 'multiply'; sx.globalAlpha = 0.6; sx.fillRect(0, 0, 512, 888); sx.globalAlpha = 1; } sx.globalCompositeOperation = 'source-over'; }
      RV.logo(function (l) { RV.stamp(sx, l, 258, 446, 250, dark ? '#000000' : '#7a6238', 0.35); RV.stamp(sx, l, 256, 444, 250, dark ? '#f2dfb0' : '#fff6dc', 0.7); stx.needsUpdate = true; }); stx.needsUpdate = true;   /* the logo, embroidered large */
    }
    RV.hold(); si.onload = function () { sx.drawImage(si, 0, 0, 512, 888); finish(); RV.unhold(); }; si.src = window.TEX.satin;
    var FB = { mulberry: [0.72, 0.16], chiffon: [0.8, 0.12], velvet: [0.97, 0.55], linen: [0.9, 0.08], organza: [0.32, 0.55], tulle: [0.85, 0.14], lace: [0.6, 0.24] }[des] || [0.5, 0.3];
    var mat = RV.clothMaterial({ color: tint ? '#ffffff' : '#f1e4cf', map: stx, opacity: 1, rough: FB[0], fresnel: FB[1], fresnelA: 0, solid: true });
    var d = new Drape({ cols: 88, rows: 76, mode: 'slide', material: mat, twist: 5.5, shadow: true, cfg: { weight: 30, wind: 14, full: 100, folds: 7, reach: 0, bounce: 90 } });
    RV.scene.add(d.mesh); this.drapes = [d];
  } }));
})();
