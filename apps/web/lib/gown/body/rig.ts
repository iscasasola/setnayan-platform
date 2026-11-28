/**
 * 👗 gown/body/rig — one body prepared from the faceless mannequin: bone groups and weights, the torso centre line,
 * the zones each part of the shaping reads, all measured ONCE on the bind pose (prototype v186 `makeBody`,
 * `breastMask`). Women only. Plain three.js math: no DOM, no renderer, no material, no shadows — the stage (A4) dresses it.
 *
 * State is explicit: everything the prototype read from module globals (`FINE`, `gown.shape`) lives on the rig as
 * `fine` and `shape`, so the same code runs in a test, a worker or the stage.
 */
import * as THREE from 'three';
import { startingGownBody, type GownBodyKey, type GownBodyVals, type GownShapewear } from '../../gown-config';
import { BODY_K, BREAST, FAT } from './constants';

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const smoothstep = (x: number, lo: number, hi: number) => {
  if (x <= lo) return 0;
  if (x >= hi) return 1;
  const t = (x - lo) / (hi - lo);
  return t * t * (3 - 2 * t);
};

/** What the solver tunes (v186 `B.P`). */
export type GownBodyParams = {
  clv: number; nk: number; S: number; kleg: number; karm: number; ks: number; hs: number; f: number;
  sHip: number; gB: number; sUb: number; sTop: number; b: number; cR: number; bY: number; bA: number;
};

/** Her choices that shape the body (v186 `FINE` and `gown.shape`). */
export type GownBodyFine = { athletic: boolean; bustT: number; given: GownBodyKey[] };

export type GownRig = {
  mesh: THREE.SkinnedMesh;
  geo: THREE.BufferGeometry;
  posAttr: THREE.BufferAttribute;
  n: number;
  pos0: Float32Array;
  /** The body as built (bind pose, shaped) — the mesh draws this, skinned on the GPU. */
  cur: Float32Array;
  /** The body as posed (skinned on the CPU) — the tape, the floor and the dress read this. */
  V: Float32Array;
  SI: Uint16Array;
  SW: Float32Array;
  idx: ArrayLike<number>;
  bones: THREE.Bone[];
  nb: number;
  inv: THREE.Matrix4[];
  name: string[];
  parent: number[];
  restPos: THREE.Vector3[];
  restQuat: THREE.Quaternion[];
  rw: THREE.Matrix4[];
  rwq: THREE.Quaternion[];
  rwqInv: THREE.Quaternion[];
  rp: THREE.Vector3[];
  aw: Float32Array; lw: Float32Array; hw: Float32Array; bw: Float32Array;
  bMask: Float32Array; fatW: Float32Array;
  px: Float32Array; pz: Float32Array; bA: Float32Array; bL: Float32Array; bk: Float32Array; bf: Float32Array; inner: Float32Array; nonArm: Float32Array; aperp: Float32Array;
  /** Triangles the tape and the dress see (no arms, no head), and which of them belong to the breast. */
  tt: Uint32Array;
  ttB: Uint8Array;
  torsoV: number[]; breastV: number[]; headV: number[];
  /** The breast's front skin (weight over 0.3): its lowest point is the underbust fold the bodice follows. */
  foldV: Uint32Array;
  armV: { L: number[]; R: number[] };
  armS: { L: number[]; R: number[] };
  breastP: THREE.Vector3;
  zcAt: (y: number) => number;
  top: number; bot: number;
  own: THREE.Vector3[];
  over: (THREE.Matrix4 | null)[];
  mw: THREE.Matrix4[];
  bm: Float32Array;
  armR: number; headLen: number; handLen: number; cTop: number; cSole: number;
  ix: Record<string, number>;
  P: GownBodyParams;
  /** What the tape read on the last solve (cm). */
  got: { bust: number; waist: number; hips: number; underbust: number; neck?: number };
  vals: GownBodyVals;
  fine: GownBodyFine;
  shape: GownShapewear;
  /** The build the weight fit settled on (v169 `fFix`), the body's weight and its target. */
  fFix: number;
  kg: number;
  kgTarget: number;
  /** v185: the girth she just set while her weight is hers; the others give or take on the pause. */
  bal: GownBodyKey | null;
  /** Heels: the bend angle while posed (v186 `heelA`), and the forefoot bend measured once. */
  heelA: number;
  heelM: { w: Float32Array; ref: number[]; up: number[]; y: number[]; z: number[]; ids?: number[] } | null;
  heelDrawn: number;
  foldN: [number, number[]][] | null;
  /** Bumped on every solve, so a skirt ring measured on an older body is measured again. */
  ver: number;
  /** Knee and ankle heights standing (model units), measured at the end of each solve: the hem presets read them. */
  neutral: { knee: number; ankle: number };
};

const ONE = new THREE.Vector3(1, 1, 1);

/** v186 `breastMask`: the shape a fuller cup adds, per vertex: [sideways, settling down, forward] × its height over the chest. */
function breastMask(n: number, pos0: Float32Array, breastV: number[], zcAt: (y: number) => number, aw: Float32Array, bw: Float32Array): Float32Array {
  const M = new Float32Array(n * 3);
  void bw;
  let zt = -1e9;
  for (const i of breastV) if (pos0[i * 3]! > 0 && pos0[i * 3 + 2]! > zt) zt = pos0[i * 3 + 2]!;
  let ax = 0, ay = 0, an = 0;
  for (const i of breastV) if (pos0[i * 3]! > 0 && pos0[i * 3 + 2]! > zt - 0.006) { ax += pos0[i * 3]!; ay += pos0[i * 3 + 1]!; an++; }
  ax /= an; ay /= an; ax += BREAST.cx; ay += BREAST.cy;
  for (let i = 0; i < n; i++) {
    const x = Math.abs(pos0[i * 3]!), y = pos0[i * 3 + 1]!, z = pos0[i * 3 + 2]!;
    if (z < zcAt(y) || aw[i]! > 0.2) continue;
    const dx = x < ax ? (x - ax) / Math.max(0.02, ax - BREAST.gap) : (x - ax) / BREAST.lat;
    const dy = y > ay ? (y - ay) / BREAST.up : (y - ay) / BREAST.dn;
    const r2 = dx * dx + dy * dy;
    if (r2 >= 1) continue;
    const r0 = Math.sqrt(r2), r = Math.max(0, r0 - BREAST.r0) / (1 - BREAST.r0);
    const hU = Math.pow(1 - r * r * (3 - 2 * r), BREAST.eUp), hD = 1 - Math.pow(r, BREAST.pDn);
    const low = r0 > 1e-6 ? smoothstep(-dy / r0, BREAST.a0, BREAST.a1) : 0.5;
    const h = (hU + (hD - hU) * low) * (1 - smoothstep(aw[i]!, 0.05, 0.2));
    const sg = pos0[i * 3]! < 0 ? -1 : 1;
    M[i * 3] = sg * h * (BREAST.out0 + BREAST.out * Math.max(0, dx));
    const sn = Math.sin(Math.PI * clamp(-dy, 0, 1));
    M[i * 3 + 1] = h + BREAST.sagLow * sn * sn * Math.max(0, 1 - dx * dx) * Math.min(1, 3 * h);
    M[i * 3 + 2] = h;
  }
  return M;
}

/** The mannequin's one skinned mesh, from a parsed glTF scene. Anything unskinned (a stray helper mesh) is dropped. */
export function skinnedMeshOf(scene: THREE.Object3D): THREE.SkinnedMesh {
  let mesh: THREE.SkinnedMesh | null = null;
  const junk: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && !mesh) mesh = o as THREE.SkinnedMesh;
    else if ((o as THREE.Mesh).isMesh) junk.push(o);
  });
  for (const o of junk) o.parent?.remove(o);
  if (!mesh) throw new Error('gown body: the mannequin has no skinned mesh');
  return mesh;
}

/** v186 `makeBody` (women): prepare the rig once. Mutates the mesh's skin weights (the breast reads as one soft mass). */
export function makeGownRig(mesh: THREE.SkinnedMesh): GownRig {
  const k = BODY_K;
  mesh.frustumCulled = false;
  const geo = mesh.geometry;
  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const n = posAttr.count;
  const pos0 = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos0[i * 3] = posAttr.getX(i); pos0[i * 3 + 1] = posAttr.getY(i); pos0[i * 3 + 2] = posAttr.getZ(i); }
  const cur = new Float32Array(pos0);
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  const si = geo.attributes.skinIndex as THREE.BufferAttribute, sw = geo.attributes.skinWeight as THREE.BufferAttribute;
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) { SI[i * 4 + c] = si.getComponent(i, c); SW[i * 4 + c] = sw.getComponent(i, c); }
  const idx = geo.index!.array;
  const bones = mesh.skeleton.bones, nb = bones.length, inv = mesh.skeleton.boneInverses;
  const name = bones.map((b) => b.name.replace(/_/g, '.'));
  const id: Record<string, number> = {};
  name.forEach((s, i) => (id[s] = i));
  const find = (s: string) => id[s] ?? id[s.replace('.', '')] ?? name.findIndex((x) => x.replace(/\W/g, '') === s.replace(/\W/g, ''));
  const parent = bones.map((b) => bones.indexOf(b.parent as THREE.Bone));
  const restPos = bones.map((b) => b.position.clone()), restQuat = bones.map((b) => b.quaternion.clone());
  const rw: THREE.Matrix4[] = [], rwq: THREE.Quaternion[] = [], rwqInv: THREE.Quaternion[] = [], rp: THREE.Vector3[] = [];
  for (let i = 0; i < nb; i++) {
    const m = new THREE.Matrix4().compose(restPos[i]!, restQuat[i]!, ONE);
    if (parent[i]! >= 0) m.premultiply(rw[parent[i]!]!);
    rw.push(m);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    rwq.push(q); rwqInv.push(q.clone().invert()); rp.push(new THREE.Vector3().setFromMatrixPosition(m));
    bones[i]!.matrixAutoUpdate = false;
  }
  const grp = (re: RegExp) => name.map((s) => re.test(s));
  const gArm = grp(/^(upperarm|lowerarm|wrist|finger|metacarpal)/), gHand = grp(/^(wrist|finger|metacarpal)/), gFore = grp(/^(upperarm02|lowerarm|wrist|finger|metacarpal)/);
  const gLeg = grp(/^(upperleg|lowerleg|foot|toe)/), gHead = grp(/^(head|jaw)/), gBreast = grp(/^breast/);
  // Each breast moves as one soft mass: flatten the peak of its bone weight so it scales round, not to a point.
  let mx = 0;
  for (let i = 0; i < n * 4; i++) if (gBreast[SI[i]!] && SW[i]! > mx) mx = SW[i]!;
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) {
    const w = SW[i * 4 + c]!;
    if (!w || !gBreast[SI[i * 4 + c]!]) continue;
    const w2 = 0.92 * (1 - Math.pow(1 - w / mx, 2.2)), r = (1 - w2) / (1 - w);
    for (let d = 0; d < 4; d++) SW[i * 4 + d]! *= r;
    SW[i * 4 + c] = w2;
  }
  for (let i = 0; i < n; i++) sw.setXYZW(i, SW[i * 4]!, SW[i * 4 + 1]!, SW[i * 4 + 2]!, SW[i * 4 + 3]!);
  sw.needsUpdate = true;
  const aw = new Float32Array(n), lw = new Float32Array(n), hw = new Float32Array(n), handw = new Float32Array(n), forew = new Float32Array(n), bw = new Float32Array(n);
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) {
    const b = SI[i * 4 + c]!, w = SW[i * 4 + c]!;
    if (!w) continue;
    if (gArm[b]) aw[i]! += w; if (gHand[b]) handw[i]! += w; if (gFore[b]) forew[i]! += w; if (gLeg[b]) lw[i]! += w; if (gHead[b]) hw[i]! += w; if (gBreast[b]) bw[i]! += w;
  }
  let top = -1e9, bot = 1e9;
  for (let i = 0; i < n; i++) { const y = pos0[i * 3 + 1]!; if (y > top) top = y; if (y < bot) bot = y; }
  // Torso centre line z(y): the middle of each slice, smoothed.
  const ZB = 0.02, nz = Math.ceil(top / ZB) + 2, zlo = new Float32Array(nz).fill(1e9), zhi = new Float32Array(nz).fill(-1e9), zc = new Float32Array(nz);
  for (let i = 0; i < n; i++) {
    if (aw[i]! > 0.3 || hw[i]! > 0.5 || lw[i]! > 0.6) continue;
    const j = Math.max(0, Math.floor(pos0[i * 3 + 1]! / ZB)), z = pos0[i * 3 + 2]!;
    if (z < zlo[j]!) zlo[j] = z; if (z > zhi[j]!) zhi[j] = z;
  }
  let last = 0.03;
  for (let j = nz - 1; j >= 0; j--) { if (zhi[j]! > zlo[j]!) last = (zlo[j]! + zhi[j]!) / 2; zc[j] = last; }
  const jh = Math.floor((k.yHip - 0.03) / ZB);
  for (let j = 0; j < jh; j++) zc[j] = zc[jh]!;
  for (let p = 0; p < 3; p++) { const c = Float32Array.from(zc); for (let j = 1; j < nz - 1; j++) zc[j] = (c[j - 1]! + 2 * c[j]! + c[j + 1]!) / 4; }
  const zcAt = (y: number) => { const f = clamp(y / ZB - 0.5, 0, nz - 1.001), j = Math.floor(f); return zc[j]! + (zc[j + 1]! - zc[j]!) * (f - j); };
  // Leg and arm centre lines (left side; mirrored for the right).
  const J = (s: string) => rp[find(s)]!;
  const hipJ = J('upperleg01.L'), kneeJ = J('lowerleg01.L'), ankJ = J('foot.L'), shJ = J('upperarm01.L'), elJ = J('lowerarm01.L'), wrJ = J('wrist.L');
  const legAx = (y: number, o: { x: number; z: number }) => {
    let a = hipJ, b = kneeJ;
    if (y < kneeJ.y) { a = kneeJ; b = ankJ; }
    const t = clamp((y - a.y) / (b.y - a.y), 0, 1);
    o.x = a.x + (b.x - a.x) * t; o.z = a.z + (b.z - a.z) * t;
  };
  const uHat = elJ.clone().sub(shJ).normalize(), fHat = wrJ.clone().sub(elJ).normalize(), bis = uHat.clone().add(fHat).normalize();
  const bA = new Float32Array(n), bL = new Float32Array(n), bk = new Float32Array(n), bf = new Float32Array(n), inner = new Float32Array(n), px = new Float32Array(n), pz = new Float32Array(n), nonArm = new Float32Array(n), aperp = new Float32Array(n * 3);
  const o = { x: 0, z: 0 }, p = new THREE.Vector3(), c = new THREE.Vector3(), best = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const x = pos0[i * 3]!, y = pos0[i * 3 + 1]!, z = pos0[i * 3 + 2]!, sg = x < 0 ? -1 : 1;
    legAx(y, o);
    // The inner thigh grows about its own leg; the outer line stays one long curve from hip to knee.
    const aIn = 1 - smoothstep(y, hipJ.y - 0.17, hipJ.y - 0.02), aOut = 1 - smoothstep(y, kneeJ.y + 0.12, hipJ.y - 0.03);
    const a = lw[i]! * (aIn + (aOut - aIn) * smoothstep(Math.abs(x) - o.x, -0.03, 0.03));
    px[i] = sg * o.x * a; pz[i] = zcAt(y) * (1 - a) + o.z * a; nonArm[i] = Math.max(0, 1 - aw[i]! - hw[i]!);
    const cf = (z - pz[i]!) / (Math.hypot(x - px[i]!, z - pz[i]!) || 1);
    // Belly: the front leads, the sides follow at about half, the back barely moves.
    bL[i] = 1 - 0.8 * lw[i]!; bk[i] = smoothstep(-cf, 0.1, 0.9); bf[i] = smoothstep(cf, 0.2, 0.9);
    inner[i] = Math.abs(x) > 0.004 && y < hipJ.y ? smoothstep(lw[i]!, 0.3, 0.7) : 0;
    bA[i] = (0.12 + 0.88 * Math.pow((1 + cf) / 2, 1.5)) * bL[i]!;
    if (aw[i]! > 0.001) {
      // Outward from the arm's own centre line, blended across the elbow so no ring shows.
      p.set(Math.abs(x), y, z);
      c.copy(p).sub(shJ); c.addScaledVector(uHat, -c.dot(uHat));
      best.copy(p).sub(elJ); const along = best.dot(bis); best.addScaledVector(fHat, -best.dot(fHat));
      c.lerp(best, smoothstep(along, -0.06, 0.06));
      const f = aw[i]! - 0.55 * handw[i]!;
      aperp[i * 3] = sg * c.x * f; aperp[i * 3 + 1] = c.y * f; aperp[i * 3 + 2] = c.z * f;
    }
  }
  const tt: number[] = [], ttB: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t]!, b = idx[t + 1]!, c2 = idx[t + 2]!;
    if (aw[a]! < 0.5 && aw[b]! < 0.5 && aw[c2]! < 0.5 && hw[a]! < 0.5 && hw[b]! < 0.5 && hw[c2]! < 0.5) {
      tt.push(a, b, c2); ttB.push(Math.max(bw[a]!, bw[b]!, bw[c2]!) > 0.1 ? 1 : 0);
    }
  }
  const armV = { L: [] as number[], R: [] as number[] }, armS = { L: [] as number[], R: [] as number[] }, torsoV: number[] = [], breastV: number[] = [], headV: number[] = [];
  for (let i = 0; i < n; i++) {
    const side = pos0[i * 3]! > 0 ? 'L' : 'R';
    if (forew[i]! > 0.6) armV[side].push(i);
    if (aw[i]! > 0.3 && handw[i]! < 0.5) armS[side].push(i);
    if (aw[i]! < 0.5 && hw[i]! < 0.5) torsoV.push(i);
    if (hw[i]! > 0.6) headV.push(i);
    if (bw[i]! > 0.05) breastV.push(i);
  }
  let bx = 0, by = 0, bsum = 0, bzmin = 1e9;
  for (const i of breastV) { const w = bw[i]!; bx += Math.abs(pos0[i * 3]!) * w; by += pos0[i * 3 + 1]! * w; bsum += w; if (pos0[i * 3 + 2]! < bzmin) bzmin = pos0[i * 3 + 2]!; }
  const breastP = new THREE.Vector3((bx / bsum) * 0.8, by / bsum + 0.01, bzmin + 0.012);
  // v168: soft fullness where a fuller body carries it.
  const fatW = new Float32Array(n * 4);
  {
    const bump = (y: number, c0: number, hu: number, hd: number) => { const d = y > c0 ? (y - c0) / hu : (c0 - y) / hd; return d >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * d)); };
    for (let i = 0; i < n; i++) {
      const x = pos0[i * 3]!, y = pos0[i * 3 + 1]!, z = pos0[i * 3 + 2]!, zc0 = zcAt(y), r = Math.hypot(x, z - zc0) || 1, cf = (z - zc0) / r;
      const na = Math.max(0, 1 - aw[i]! - hw[i]! - lw[i]!) * (1 - bw[i]!);
      if (na <= 0) continue;
      fatW[i * 4] = na * bump(y, FAT.yBack, 0.13, 0.16) * smoothstep(-cf, -0.6, 0.4);
      fatW[i * 4 + 1] = na * bump(y, FAT.yAx, 0.06, 0.08) * smoothstep(cf, -0.2, 0.25) * (1 - smoothstep(cf, 0.5, 0.9));
      fatW[i * 4 + 2] = na * bump(y, k.yWaist - 0.04, 0.12, 0.1) * (1 - smoothstep(cf, -0.1, 0.7));
      fatW[i * 4 + 3] = na * bump(y, FAT.yLow, 0.1, 0.07) * smoothstep(cf, 0.2, 0.85);
    }
  }
  const bMask = breastMask(n, pos0, breastV, zcAt, aw, bw);
  let chinY = 1e9, handLen = 0;
  for (let i = 0; i < n; i++) {
    if (hw[i]! > 0.85 && pos0[i * 3 + 1]! < chinY) chinY = pos0[i * 3 + 1]!;
    if (handw[i]! > 0.5 && pos0[i * 3]! > 0) handLen = Math.max(handLen, Math.hypot(pos0[i * 3]! - wrJ.x, pos0[i * 3 + 1]! - wrJ.y, pos0[i * 3 + 2]! - wrJ.z));
  }
  const ix: Record<string, number> = {};
  for (const s of ['upperleg01', 'upperleg02', 'lowerleg01', 'lowerleg02', 'foot', 'clavicle', 'shoulder01', 'upperarm01', 'upperarm02', 'lowerarm01', 'lowerarm02', 'wrist', 'breast']) {
    for (const sd of ['L', 'R']) ix[`${s}.${sd}`] = find(`${s}.${sd}`);
  }
  for (const s of ['head', 'jaw', 'spine01', 'spine02', 'spine03', 'spine04', 'spine05', 'neck01']) ix[s] = find(s);
  const start = startingGownBody();
  return {
    mesh, geo, posAttr, n, pos0, cur, V: new Float32Array(n * 3), SI, SW, idx, bones, nb, inv, name, parent, restPos, restQuat, rw, rwq, rwqInv, rp,
    aw, lw, hw, bw, bMask, fatW, px, pz, bA, bL, bk, bf, inner, nonArm, aperp,
    tt: Uint32Array.from(tt), ttB: Uint8Array.from(ttB), torsoV, breastV, headV,
    foldV: Uint32Array.from(breastV.filter((i) => bw[i]! > 0.3 && pos0[i * 3 + 2]! > zcAt(pos0[i * 3 + 1]!))), armV, armS, breastP, zcAt, top, bot,
    own: bones.map(() => new THREE.Vector3(1, 1, 1)), over: new Array(nb).fill(null), mw: bones.map(() => new THREE.Matrix4()), bm: new Float32Array(nb * 16),
    armR: 0.3, headLen: top - chinY, handLen, cTop: top - rp[find('head')]!.y, cSole: Math.min(rp[find('foot.L')]!.y, rp[find('foot.R')]!.y) - bot,
    ix,
    P: { clv: (2 * Math.PI) / 180, nk: 0, S: 1, kleg: 1, karm: 1, ks: 1, hs: 1, f: 1.2, sHip: 1.2, gB: 0, sUb: 1.2, sTop: 1.1, b: 1, cR: 1, bY: 0, bA: 0 },
    got: { bust: 0, waist: 0, hips: 0, underbust: 0 },
    vals: { ...start.vals },
    fine: { athletic: false, bustT: 0, given: [] },
    shape: 'none',
    fFix: 0, kg: 0, kgTarget: 0, bal: null,
    heelA: 0, heelM: null, heelDrawn: 0, foldN: null, ver: 0, neutral: { knee: 0, ankle: 0 },
  };
}
