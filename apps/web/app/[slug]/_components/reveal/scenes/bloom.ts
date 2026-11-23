/**
 * 🎭 PETALS and FIREWORKS — the two reveals the owner picked for the retired slots (23 Nov: *"petals"* ·
 * *"fireworks yes!"*). Drawing `src/round3.js`.
 *   · PETALS    — the cover lies under sampaguita and rose petals. A tap is a breath: they lift in a ring from the
 *                 finger, tumble and drift away (light things: they drift down, they do not drop).
 *   · FIREWORKS — the cover waits under a night sky. A tap sends one rocket up from the finger; it bursts, and
 *                 wherever the gold sparks fall the night melts away. Two more bursts follow, then the last of the dark
 *                 goes in glitter.
 */
import * as THREE from 'three';
import { canvas, clamp, ctx2d, easeOut, shadowPlane, solidLights, texOf, type Ctx, type Scene } from './kit';

function petalAlpha(): THREE.Texture {
  const k = canvas(64, 64);
  const x = ctx2d(k);
  x.fillStyle = '#000';
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#fff';
  x.beginPath();
  x.moveTo(32, 3);
  x.bezierCurveTo(62, 14, 56, 54, 32, 61);
  x.bezierCurveTo(8, 54, 2, 14, 32, 3);
  x.fill();
  return texOf(k);
}

type Petal = { x: number; y: number; z: number; rx: number; ry: number; rz: number; vx: number; vy: number; vz: number; wx: number; wy: number; wz: number; live: boolean; ph: number };

/** C · PETALS */
export const petals = (): Scene => {
  let c: Ctx;
  const N = 1500;
  let im: THREE.InstancedMesh;
  const P: Petal[] = [];
  const d = new THREE.Object3D();
  let tapW: [number, number] = [0, 0];
  const sync = () => {
    for (let i = 0; i < N; i++) {
      const q = P[i]!;
      d.position.set(q.x, q.y, q.z);
      d.rotation.set(q.rx, q.ry, q.rz);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  };
  return {
    legacyT: 6.4,
    init(cx) {
      c = cx;
      const R = c.rand;
      solidLights(c, { amb: 0.5, key: 0.58, back: 0.1, kx: -2, ky: 3.2 });
      shadowPlane(c, -0.02, 0.35);
      const geo = new THREE.PlaneGeometry(0.4, 0.5, 3, 3);
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        p.setZ(i, x * x * 1.6 + y * y * 0.5);
      }
      geo.computeVertexNormals();
      const mat = new THREE.MeshPhongMaterial({ alphaMap: petalAlpha(), alphaTest: 0.5, side: THREE.DoubleSide, shininess: 12 });
      im = new THREE.InstancedMesh(geo, mat, N);
      im.castShadow = true;
      im.frustumCulled = false;
      c.scene.add(im);
      const col = new THREE.Color();
      const pal = [0xfffdf6, 0xfff7ea, 0xfbe3df, 0xf6cfcf, 0xf0b9bf, 0xfff9f0];
      for (let i = 0; i < N; i++) {
        P.push({ x: (R() - 0.5) * (c.W + 0.5), y: (R() - 0.5) * (c.H + 0.5), z: 0.02 + (i / N) * 0.3, rx: (R() - 0.5) * 0.5, ry: (R() - 0.5) * 0.5, rz: R() * 6.283, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, live: false, ph: R() * 6.283 });
        col.setHex(pal[i % pal.length]!);
        im.setColorAt(i, col);
      }
      sync();
    },
    opened(_wx, _wy, x, y) {
      tapW = [x * c.HW, y * c.HH];
    },
    step(dt, t, tau) {
      if (tau < 0) return;
      const R = c.rand;
      const r = 1.15 * tau;
      for (const q of P) {
        if (!q.live) {
          const dx = q.x - tapW[0];
          const dy = q.y - tapW[1];
          const dd = Math.hypot(dx, dy) || 0.01;
          if (dd >= r) continue;
          q.live = true;
          const k = 0.3 + R() * 0.55;
          q.vx = (dx / dd) * k;
          q.vy = (dy / dd) * k + 0.45;
          q.vz = 0.7 + R() * 1.0;
          q.wx = (R() - 0.5) * 7;
          q.wy = (R() - 0.5) * 7;
          q.wz = (R() - 0.5) * 4;
        }
        q.vy -= 1.15 * dt;
        q.vz -= 0.5 * dt;
        const dr = Math.pow(0.3, dt);
        q.vx *= dr;
        q.vz *= dr;
        q.vy *= Math.pow(0.62, dt);
        q.vx += Math.sin(t * 1.4 + q.ph) * 1.3 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.z = Math.max(0.02, q.z + q.vz * dt);
        q.rx += q.wx * dt;
        q.ry += q.wy * dt;
        q.rz += q.wz * dt;
      }
      sync();
    },
  };
};

/** D · FIREWORKS */
export const fireworks = (): Scene => {
  let c: Ctx;
  const MW = 300;
  const MH = 520;
  const N = 520;
  let mx: CanvasRenderingContext2D;
  let maskTex: THREE.Texture;
  let pts: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  const P = new Float32Array(N * 3);
  const V = new Float32Array(N * 3);
  const Lf = new Float32Array(N);
  let k = 0;
  const fired = [false, false, false];
  let tapW: [number, number] = [0, 0];
  const burst = (cx: number, cy: number, n: number, sp: number) => {
    const R = c.rand;
    for (let j = 0; j < n; j++) {
      const i = k++ % N;
      const a = R() * 6.283;
      const v = sp * (0.35 + R() * 0.65);
      P[i * 3] = cx;
      P[i * 3 + 1] = cy;
      P[i * 3 + 2] = 0.1;
      V[i * 3] = Math.cos(a) * v;
      V[i * 3 + 1] = Math.sin(a) * v + 0.5;
      Lf[i] = 1.9 + R() * 1.3;
    }
  };
  return {
    legacyT: 5.0,
    init(cx) {
      c = cx;
      const R = c.rand;
      const n = canvas(MW, MH);
      const x = ctx2d(n);
      const g = x.createLinearGradient(0, 0, 0, MH);
      g.addColorStop(0, '#0b0f2a');
      g.addColorStop(0.6, '#151a44');
      g.addColorStop(1, '#2a1f4d');
      x.fillStyle = g;
      x.fillRect(0, 0, MW, MH);
      for (let i = 0; i < 170; i++) {
        x.fillStyle = `rgba(255,255,255,${0.25 + R() * 0.7})`;
        x.beginPath();
        x.arc(R() * MW, R() * MH, R() * 1.1 + 0.2, 0, 7);
        x.fill();
      }
      const mask = canvas(MW, MH);
      mx = ctx2d(mask);
      mx.fillStyle = '#fff';
      mx.fillRect(0, 0, MW, MH);
      maskTex = texOf(mask);
      const sky = new THREE.Mesh(new THREE.PlaneGeometry(c.W, c.H), new THREE.MeshBasicMaterial({ map: texOf(n), alphaMap: maskTex, transparent: true, depthWrite: false }));
      sky.position.z = 0.01;
      c.scene.add(sky);
      const sc = canvas(64, 64);
      const sx = ctx2d(sc);
      const sg = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
      sg.addColorStop(0, 'rgba(255,255,255,1)');
      sg.addColorStop(0.25, 'rgba(255,226,150,.9)');
      sg.addColorStop(1, 'rgba(255,190,80,0)');
      sx.fillStyle = sg;
      sx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < N; i++) P[i * 3 + 2] = -50;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
      pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: texOf(sc), size: 0.24, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      pts.frustumCulled = false;
      c.scene.add(pts);
    },
    opened(_wx, _wy, x, y) {
      tapW = [x * c.HW, y * c.HH];
    },
    step(dt, t, tau) {
      if (tau < 0) return;
      const { W, H, HH } = c;
      const R = c.rand;
      const tw = tapW;
      const at: Array<[number, number, number]> = [
        [0.9, tw[0], Math.min(HH - 0.9, tw[1] + 0.9)],
        [1.9, clamp(-tw[0] * 0.7 - 0.5, -1, 1), 0.2],
        [2.8, clamp(tw[0] * 0.5 + 0.6, -1, 1), -1.1],
      ];
      if (tau < at[0]![0]) {
        /* the rocket climbs, trailing sparks */
        const u = tau / at[0]![0];
        const ry = -HH + (at[0]![2] + HH) * easeOut(u);
        const q = k++ % N;
        P[q * 3] = tw[0] + (R() - 0.5) * 0.05;
        P[q * 3 + 1] = ry;
        P[q * 3 + 2] = 0.1;
        V[q * 3] = (R() - 0.5) * 0.3;
        V[q * 3 + 1] = -0.6;
        Lf[q] = 0.5;
      }
      for (let i = 0; i < 3; i++)
        if (!fired[i] && tau >= at[i]![0]) {
          fired[i] = true;
          burst(at[i]![1], at[i]![2], 150, 2.5);
        }
      mx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < N; i++) {
        if (Lf[i]! <= 0) continue;
        const j = i * 3;
        Lf[i] = Lf[i]! - dt;
        V[j + 1] = V[j + 1]! - 1.5 * dt;
        const dr = Math.pow(0.32, dt);
        V[j] = V[j]! * dr;
        V[j + 1] = V[j + 1]! * dr;
        P[j] = P[j]! + V[j]! * dt;
        P[j + 1] = P[j + 1]! + V[j + 1]! * dt;
        if (Lf[i]! <= 0) {
          P[j + 2] = -50;
          continue;
        }
        /* each spark wipes a little of the night as it passes */
        const px = (P[j]! / W + 0.5) * MW;
        const py = (0.5 - P[j + 1]! / H) * MH;
        const r = 15 + 8 * Math.sin(i);
        const gr = mx.createRadialGradient(px, py, 0, px, py, r);
        gr.addColorStop(0, 'rgba(0,0,0,.5)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        mx.fillStyle = gr;
        mx.fillRect(px - r, py - r, r * 2, r * 2);
      }
      if (tau > 3.5) {
        const nn = Math.floor((tau - 3.5) * 60);
        mx.fillStyle = 'rgba(0,0,0,.6)';
        for (let i = 0; i < nn; i++) {
          const bx = R() * MW;
          const by = R() * MH;
          mx.beginPath();
          mx.arc(bx, by, 5 + R() * 16, 0, 7);
          mx.fill();
          if (i % 9 === 0) burst((bx / MW - 0.5) * W, (0.5 - by / MH) * H, 3, 0.5);
        }
        if (tau > 4.7) mx.fillRect(0, 0, MW, MH);
      }
      maskTex.needsUpdate = true;
      (pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      pts.material.size = 0.24 + 0.07 * Math.sin(t * 31);
    },
  };
};
