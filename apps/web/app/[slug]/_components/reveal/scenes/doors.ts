/**
 * 🎭 CATHEDRAL DOORS (drawing `src/rigid.js` 'doors' + `src/aisle.js`; owner 23 Nov: *"Carved door needs to be more
 * realistic. doors are not thin"* · *"deep 3D push-in down the nave into the light, then the cover"*).
 * A stone front with the doorway cut through it, two carved leaves 0.22 thick on their outer hinges, a seam of light
 * while shut. A tap: each heavy leaf is pushed, drags on its hinge and meets its stop; light pours through; the
 * camera glides — ONE continuous move, never slowing — through the doorway and down an aisle of flower banks,
 * arches, chiffon and chandeliers to the light at the far end, which goes white, and the cover is there.
 * Known below the owner's reference clips and accepted for now (DECISION_LOG 23 Nov "REVEALS ACCEPTED FOR NOW AT
 * v10"): the flowers' cut edges, the plain floor without reflections, the side banks' scale.
 */
import * as THREE from 'three';
import { LEGACY_FOV, canvas, ctx2d, ease, point, solidLights, clamp, texOf, type ArtName, type Ctx, type Scene, BUMP } from './kit';

function mapUV(geo: THREE.BufferGeometry, fn: (x: number, y: number) => [number, number]): void {
  const p = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const r = fn(p.getX(i), p.getY(i));
    uv.setXY(i, r[0], r[1]);
  }
  uv.needsUpdate = true;
}

/** What is beyond the doors: a real space to travel through, each piece at its own depth. */
class Aisle {
  L = 18;
  N = 260;
  P: Float32Array;
  pts: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  star: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  constructor(c: Ctx, YB: number, art: Record<'bank' | 'arch' | 'drape' | 'chand' | 'hall', HTMLImageElement>) {
    const s = c.scene;
    const L = this.L;
    s.fog = new THREE.Fog(0xf6e6c8, 3.5, 24);
    const basic = (o: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial(o);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, L + 1), new THREE.MeshPhongMaterial({ color: 0xcdbb98, shininess: 90, specular: 0xfff2d6 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, YB, -L / 2 - 0.95);
    s.add(floor);
    const sc = canvas(64, 256);
    const sx = ctx2d(sc);
    const sg = sx.createLinearGradient(0, 0, 64, 0);
    sg.addColorStop(0, 'rgba(255,240,205,0)');
    sg.addColorStop(0.5, 'rgba(255,244,214,.9)');
    sg.addColorStop(1, 'rgba(255,240,205,0)');
    sx.fillStyle = sg;
    sx.fillRect(0, 0, 64, 256);
    /* the lights, mirrored in the polished floor */
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(1.1, L + 2), basic({ map: texOf(sc), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    streak.rotation.x = -Math.PI / 2;
    streak.position.set(0, YB + 0.006, -L / 2 - 1.2);
    s.add(streak);
    for (const sd of [-1, 1]) {
      /* 🖥 the side walls start at the doorway (the drawing's ran 1.5 in front of it — off a phone's screen, but two
         brown slabs beside the doors on a wide one) */
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(L + 1.15, 4.6), basic({ color: 0x8f7a5e }));
      wall.rotation.y = (-sd * Math.PI) / 2;
      wall.position.set(sd * 1.8, YB + 2.3, -0.35 - (L + 1.15) / 2);
      s.add(wall);
      /* two rows of flowers along each side */
      for (const r of [
        [0.76, 0.66, 7, 0],
        [0.6, 0.42, 9, 0.37],
      ] as const) {
        const t = texOf(art.bank);
        t.wrapS = THREE.RepeatWrapping;
        t.repeat.set(r[2], 1);
        t.offset.x = r[3];
        const b = new THREE.Mesh(new THREE.PlaneGeometry(L, r[1]), basic({ map: t, alphaTest: 0.32, side: THREE.DoubleSide }));
        b.rotation.y = (sd * Math.PI) / 2;
        b.position.set(sd * r[0], YB + r[1] / 2 - 0.02, -L / 2 - 0.4);
        s.add(b);
      }
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(3.6, L + 1.15), basic({ color: 0x7a664c }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, YB + 4.5, -0.35 - (L + 1.15) / 2);
    s.add(ceil);
    const at = texOf(art.arch);
    const dt = texOf(art.drape);
    const ct = texOf(art.chand);
    for (let i = 0; i < 5; i++) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(2.56, 2.62), basic({ map: at, alphaTest: 0.3 }));
      a.position.set(0, YB + 1.3, -2.8 - i * 3.3);
      s.add(a);
      const d = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.97), basic({ map: dt, transparent: true, opacity: 0.92, depthWrite: false }));
      d.position.set(0, YB + 3.45, -1.3 - i * 3.3);
      s.add(d);
    }
    for (let i = 0; i < 6; i++) {
      const ch = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.25), basic({ map: ct, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.95 }));
      ch.position.set(((i % 3) - 1) * 0.5, YB + 2.9 + (i % 2) * 0.22, -1.9 - i * 2.9);
      s.add(ch);
    }
    const hall = new THREE.Mesh(new THREE.PlaneGeometry(4.6, (4.6 * 1820) / 1024), basic({ map: texOf(art.hall) }));
    hall.position.set(0, 0.7, -L - 2.2);
    s.add(hall);
    /* the light at the far end, and its flare through the doors */
    const rc = canvas(256, 256);
    const rx = ctx2d(rc);
    const rg = rx.createRadialGradient(128, 128, 2, 128, 128, 128);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.12, 'rgba(255,244,210,.95)');
    rg.addColorStop(0.4, 'rgba(255,220,150,.3)');
    rg.addColorStop(1, 'rgba(255,200,120,0)');
    rx.fillStyle = rg;
    rx.fillRect(0, 0, 256, 256);
    rx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const an = (i / 14) * 6.283 + 0.2;
      const len = 120 * (0.55 + (0.45 * ((i * 7) % 5)) / 4);
      const lg = rx.createLinearGradient(128, 128, 128 + Math.cos(an) * len, 128 + Math.sin(an) * len);
      lg.addColorStop(0, 'rgba(255,246,220,.6)');
      lg.addColorStop(1, 'rgba(255,230,170,0)');
      rx.strokeStyle = lg;
      rx.lineWidth = i % 2 ? 2 : 4;
      rx.beginPath();
      rx.moveTo(128, 128);
      rx.lineTo(128 + Math.cos(an) * len, 128 + Math.sin(an) * len);
      rx.stroke();
    }
    this.star = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), basic({ map: texOf(rc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, opacity: 0 }));
    this.star.position.set(0, YB + 1.75, -1.2);
    this.star.renderOrder = 7;
    s.add(this.star);
    /* motes of light floating toward the lens */
    const bc = canvas(64, 64);
    const bx = ctx2d(bc);
    const bg = bx.createRadialGradient(32, 32, 0, 32, 32, 32);
    bg.addColorStop(0, 'rgba(255,250,235,1)');
    bg.addColorStop(0.4, 'rgba(255,235,190,.5)');
    bg.addColorStop(1, 'rgba(255,220,160,0)');
    bx.fillStyle = bg;
    bx.fillRect(0, 0, 64, 64);
    const P = (this.P = new Float32Array(this.N * 3));
    for (let i = 0; i < this.N; i++) {
      P[i * 3] = (c.rand() - 0.5) * 2.6;
      P[i * 3 + 1] = YB + 0.2 + c.rand() * 3.4;
      P[i * 3 + 2] = -c.rand() * (L + 1);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    this.pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: texOf(bc), size: 0.1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.85 }));
    this.pts.frustumCulled = false;
    s.add(this.pts);
  }
  step(dt: number, t: number, open: number, camZ: number): void {
    const P = this.P;
    for (let i = 0; i < this.N; i++) {
      P[i * 3 + 2] = P[i * 3 + 2]! + dt * (0.35 + (i % 5) * 0.08);
      P[i * 3] = P[i * 3]! + Math.sin(t * 0.6 + i) * dt * 0.03;
      P[i * 3 + 1] = P[i * 3 + 1]! + Math.cos(t * 0.5 + i * 1.7) * dt * 0.03;
      if (P[i * 3 + 2]! > camZ - 0.3) P[i * 3 + 2] = P[i * 3 + 2]! - (this.L + 1);
    }
    (this.pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.pts.material.size = 0.1 + 0.025 * Math.sin(t * 2.3);
    /* the flare: a burst through the gap as the doors part; it then stays ahead of you, growing */
    const inside = Math.max(0, Math.min(1, (1.5 - camZ) / 2.5));
    this.star.material.opacity = Math.min(1, open * 2.2) * (0.9 - 0.62 * inside) * (0.9 + 0.1 * Math.sin(t * 3.1));
    this.star.position.z = Math.min(-1.2, camZ - 9);
    this.star.scale.setScalar(0.45 + open * 0.75);
    this.star.rotation.z = t * 0.05;
  }
}

/** 7 · CATHEDRAL DOORS */
export const cathedralDoors = (): Scene => {
  let c: Ctx;
  const leaves: Array<{ g: THREE.Group; side: number; a: number; v: number; at: number }> = [];
  let glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  let bright: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  let seam: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  let aisle: Aisle;
  let dust: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  let inner: THREE.PointLight;
  const rays: Array<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>> = [];
  const T = 5.0;
  return {
    legacyT: T,
    fadeMs: 1400,
    ownCam: true,
    async init(cx) {
      c = cx;
      const { scene: s, H, HW, HH } = c;
      const names: ArtName[] = ['doors', 'bank', 'arch', 'drape', 'chand', 'hall'];
      const [doors, bank, arch, drape, chand, hall] = await Promise.all(names.map((n) => c.art(n)));
      const tex = texOf(doors!);
      /* 📱 the carving is drawn for a phone cover 3 wide: wider screens repeat its stone outward, never stretch it */
      tex.wrapS = THREE.MirroredRepeatWrapping;
      solidLights(c, { amb: 0.5, key: 0.8, back: 0, kx: -2.5, ky: 3.5, kz: 5.5 });
      const X = 0.77;
      const YB = -1.52;
      const YS = 0.49;
      const uvw = (x: number, y: number): [number, number] => {
        const py = (0.5 - y / H) * 520;
        return [x / 3 + 0.5, 1 - (py + 6.5) / 533];
      };
      /* the stone front, with the doorway cut out of it and real depth in the opening */
      const wall = new THREE.Shape();
      wall.moveTo(-HW, -HH);
      wall.lineTo(HW, -HH);
      wall.lineTo(HW, HH);
      wall.lineTo(-HW, HH);
      wall.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-X, YB);
      hole.lineTo(-X, YS);
      hole.absarc(0, YS, X, Math.PI, 0, true);
      hole.lineTo(X, YB);
      hole.closePath();
      wall.holes.push(hole);
      const wg = new THREE.ExtrudeGeometry(wall, { depth: 0.34, bevelEnabled: false, curveSegments: 24 });
      wg.translate(0, 0, -0.34);
      mapUV(wg, uvw);
      const facadeMats = [new THREE.MeshPhongMaterial({ map: tex, bumpMap: tex, bumpScale: 0.02 * BUMP, shininess: 3, fog: false }), new THREE.MeshPhongMaterial({ color: 0x8f7a5c, shininess: 2, fog: false })];
      const facade = new THREE.Mesh(wg, facadeMats);
      facade.castShadow = true;
      facade.receiveShadow = true;
      s.add(facade);
      /* two leaves, each 0.22 thick, hung on their outer edge and set back in the opening */
      for (const side of [-1, 1]) {
        const sh = new THREE.Shape();
        sh.moveTo(0, YB);
        if (side < 0) {
          sh.lineTo(X, YB);
          sh.lineTo(X, YS + X);
          sh.absarc(X, YS, X, Math.PI / 2, Math.PI, false);
          sh.closePath();
        } else {
          sh.lineTo(0, YS);
          sh.absarc(-X, YS, X, 0, Math.PI / 2, false);
          sh.lineTo(-X, YB);
          sh.closePath();
        }
        const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2, curveSegments: 16 });
        mapUV(geo, (x, y) => uvw(x + side * X, y));
        const m = new THREE.Mesh(geo, [
          new THREE.MeshPhongMaterial({ map: tex, bumpMap: tex, bumpScale: 0.045 * BUMP, shininess: 14, specular: 0x33261a, fog: false }),
          new THREE.MeshPhongMaterial({ color: 0x5a3a22, shininess: 16, specular: 0x33261a, fog: false }),
        ]);
        m.castShadow = true;
        m.receiveShadow = true;
        const g = new THREE.Group();
        g.position.set(side * X, 0, -0.33);
        g.add(m);
        s.add(g);
        leaves.push({ g, side, a: 0, v: 0, at: side < 0 ? 0 : 0.08 });
      }
      /* what is inside: warm light that grows as the doors part, and shafts of it reaching out */
      const gc = canvas(64, 128);
      const gx = ctx2d(gc);
      const gr = gx.createRadialGradient(32, 80, 2, 32, 70, 70);
      gr.addColorStop(0, 'rgba(255,246,214,1)');
      gr.addColorStop(0.5, 'rgba(255,214,140,.75)');
      gr.addColorStop(1, 'rgba(255,190,90,0)');
      gx.fillStyle = gr;
      gx.fillRect(0, 0, 64, 128);
      glow = new THREE.Mesh(new THREE.PlaneGeometry(X * 2.6, 3.6), new THREE.MeshBasicMaterial({ map: texOf(gc), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(0, -0.35, -0.5);
      s.add(glow);
      bright = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0xfff7e2, transparent: true, opacity: 0, fog: false, depthTest: false }));
      bright.renderOrder = 9;
      s.add(bright);
      aisle = new Aisle(c, YB, { bank: bank!, arch: arch!, drape: drape!, chand: chand!, hall: hall! });
      /* shut, with a thin seam of light */
      seam = new THREE.Mesh(new THREE.PlaneGeometry(0.035, YS + X - YB), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      seam.position.set(0, (YS + X + YB) / 2, -0.16);
      s.add(seam);
      for (let i = 0; i < 6; i++) {
        const rg = new THREE.BufferGeometry();
        const x0 = (i / 5 - 0.5) * X * 1.5;
        rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x0 - 0.05, 0.8, -0.25, x0 + 0.05, 0.8, -0.25, x0 * 3.2 - 0.5, -3.4, 2.6, x0 * 3.2 + 0.5, -3.4, 2.6]), 3));
        rg.setIndex([0, 2, 1, 1, 2, 3]);
        const ray = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffe4a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        s.add(ray);
        rays.push(ray);
      }
      const n = 70;
      const dp = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        dp[i * 3] = (c.rand() - 0.5) * 1.6;
        dp[i * 3 + 1] = -1.4 + c.rand() * 2.4;
        dp[i * 3 + 2] = -0.2 + c.rand() * 1.6;
      }
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff0c8, size: 0.022, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.add(dust);
      inner = point(0xffd9a0, 0, 6);
      inner.position.set(0, -0.2, -0.9);
      s.add(inner);
    },
    step(dt, t, tau) {
      const STOP = 1.78;
      let open = 0;
      for (const L of leaves) {
        if (tau >= L.at) {
          /* a heavy door: the push builds slowly, the hinge drags, and it meets its stop with a small rebound */
          const push = L.a < STOP - 0.32 ? 4.4 * ease((tau - L.at) / 0.4) : 0;
          const stop = L.a > STOP - 0.32 ? 20 * (STOP - L.a) : 0;
          L.v += (push + stop - (L.a > STOP - 0.32 ? 4.6 : 1.3) * L.v) * dt;
          L.a += L.v * dt;
        }
        L.g.rotation.y = -L.side * L.a;
        open += L.a / STOP / 2;
      }
      const lit = clamp(open * 1.25, 0, 1);
      glow.material.opacity = lit * 0.55;
      inner.intensity = lit * 1.6 * Math.PI;
      dust.material.opacity = lit * 0.8;
      rays.forEach((r, i) => {
        r.material.opacity = lit * (0.1 + 0.05 * Math.sin(t * 1.3 + i * 2));
      });
      const dp = dust.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < dp.count; i++) {
        dp.setY(i, dp.getY(i) + dt * 0.05 * (1 + (i % 3)));
        dp.setX(i, dp.getX(i) + Math.sin(t + i) * dt * 0.02);
      }
      dp.needsUpdate = true;
      const z0 = c.H / 2 / Math.tan((LEGACY_FOV / 2) * (Math.PI / 180));
      const cam = c.camera;
      const w = tau < 0 ? 0 : clamp(tau / T, 0, 1);
      /* ONE continuous forward glide, from the tap to the white: it never slows and never stops. A little float, as a
         hand-held gimbal has. */
      const p = 0.12 * w * w + 0.88 * w;
      cam.position.set(tau < 0 ? 0 : 0.045 * Math.sin(t * 0.8), (tau < 0 ? 0 : -0.36 * Math.min(1, w * 2.6)) + (tau < 0 ? 0 : 0.025 * Math.sin(t * 1.15)), z0 + (-13.6 - z0) * p);
      cam.rotation.z = tau < 0 ? 0 : 0.005 * Math.sin(t * 0.7);
      cam.fov = LEGACY_FOV + 16 * ease(w / 0.45);
      cam.updateProjectionMatrix();
      aisle.step(dt, t, open, cam.position.z);
      seam.material.opacity = Math.max(0, 0.85 - open * 9);
      /* the doorway's own glow is left behind as you pass through */
      const out = clamp((cam.position.z - 0.4) / 2.4, 0, 1);
      glow.material.opacity *= out;
      dust.material.opacity *= out;
      inner.intensity *= out;
      for (const ry of rays) ry.material.opacity *= out;
      bright.position.set(cam.position.x, cam.position.y, cam.position.z - 1.2);
      bright.material.opacity = clamp((tau - 4.0) / 0.85, 0, 1);
    },
  };
};
