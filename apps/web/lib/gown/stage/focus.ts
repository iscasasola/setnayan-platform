/**
 * 👗 gown/stage/focus — where each close-up looks (prototype v204 `FOCUS`, `AIM_OF`, `bodyMarks`, `AIMS`, `aimDist`).
 * Each close-up is measured on her LIVE body every time: her bust point, her waist, her feet in these heels, in this
 * pose. It is never a fixed share of her height. Women only. Pure geometry in her model units; the stage turns the aim
 * into a camera move.
 *
 * `FOCUS` keeps how close (z, a share of the whole-body distance) and her turn (R, radians: she turns so that side
 * faces the view). Each aim gives a centre and the points that must stay in view.
 */
import * as THREE from 'three';
import { BODY_K } from '../body/constants';
import { clamp, type GownRig } from '../body/rig';
import { jointP, jointY } from '../body/bones';
import { apexOf } from '../body/tape';

/** [fallback height share, z (share of the whole-body distance), R (her turn)]. v204 values. */
export const GOWN_FOCUS = {
  gown: [0.48, 0.95, 0], m_full: [0.5, 1.05, 0], m_bust: [0.7, 0.42, 0], m_waist: [0.6, 0.42, 0], m_hips: [0.51, 0.48, 0], m_sh: [0.8, 0.45, 0],
  m_ub: [0.66, 0.4, 0], m_arm: [0.6, 0.5, -0.75], m_leg: [0.3, 0.66, 0], heels: [0.05, 0.36, 0.5],
  neck: [0.78, 0.44, 0], collar: [0.87, 0.34, 0], sleeve: [0.76, 0.5, 0], sleeveFab: [0.76, 0.5, 0], pieces: [0.58, 0.72, 0], back: [0.76, 0.5, Math.PI], closure: [0.7, 0.52, Math.PI],
  blusher: [0.86, 0.45, 0.6], bow: [0.66, 0.6, Math.PI], train: [0.3, 1.45, 2.6], veil: [0.32, 1.45, 2.6], hems: [0.2, 0.62, 0], shape: [0.62, 0.7, 0], boning: [0.72, 0.52, 0],
  fabric: [0.62, 0.66, 0], lace: [0.6, 0.66, 0], laceAt: [0.6, 0.66, 0], bead: [0.65, 0.75, 0], beadAt: [0.65, 0.75, 0], cut: [0.56, 0.62, 0], slit: [0.35, 0.7, 0],
  trim: [0.5, 1, 0], petti: [0.33, 0.9, 0], pleat: [0.4, 0.85, 0], tex: [0.62, 0.72, 0], darts: [0.66, 0.6, 0], drape: [0.65, 0.72, 0], bustle: [0.33, 0.9, Math.PI], skirtLayers: [0.33, 0.9, 0],
  cape: [0.55, 1, -2.4], capeFab: [0.55, 1, -0.8], capeLen: [0.5, 1, -2.4], capeEdge: [0.55, 1, -2.4], capeFasten: [0.7, 0.6, Math.PI], capeCol: [0.55, 1, -0.8],
} as const satisfies Record<string, readonly [number, number, number]>;
export type GownFocusKey = keyof typeof GOWN_FOCUS;

/** v204 `AIM_OF`: which part of her each key looks at. */
export const GOWN_AIM_OF: Record<GownFocusKey, GownAimName> = {
  gown: 'outfit', m_full: 'whole', m_bust: 'bust', m_waist: 'waist', m_hips: 'hips', m_sh: 'sh', m_ub: 'ub', m_arm: 'arm', m_leg: 'leg', heels: 'feet',
  bow: 'waistline', neck: 'neck', collar: 'collar', sleeve: 'sleeve', sleeveFab: 'sleeve', pieces: 'waistline', back: 'back', closure: 'closure', blusher: 'blusher', train: 'low', veil: 'low', hems: 'hem',
  shape: 'bodice', boning: 'bodice', cut: 'bodice', fabric: 'upper', lace: 'upper', laceAt: 'upper', bead: 'upper', beadAt: 'upper', tex: 'upper', darts: 'upper', drape: 'upper', slit: 'slit',
  trim: 'outfit', petti: 'skirt', pleat: 'skirt', skirtLayers: 'skirt', bustle: 'low',
  cape: 'cape', capeFab: 'cape', capeLen: 'cape', capeEdge: 'cape', capeCol: 'cape', capeFasten: 'nape',
};
export type GownAimName =
  | 'whole' | 'outfit' | 'low' | 'cape' | 'bust' | 'ub' | 'waist' | 'hips' | 'sh' | 'arm' | 'leg' | 'feet' | 'neck' | 'collar' | 'sleeve' | 'back' | 'closure'
  | 'waistline' | 'bodice' | 'upper' | 'slit' | 'hem' | 'skirt' | 'nape' | 'blusher';

/** What the stage knows of the gown on her (model units); without a gown the body's own marks stand in. */
export type GownDressMarks = {
  /** The neckline's height at the centre front and at the centre back. */
  top0: number; topB: number;
  /** The hem's height, its radius, and where the bodice meets the skirt at the front. */
  yHem: number; hemR: number; yWaistline: number;
  /** The gown, train, veil and cape as one box ([min, max]); a cape's own box. */
  box: [THREE.Vector3, THREE.Vector3] | null;
  capeBox: [THREE.Vector3, THREE.Vector3] | null;
};

/** Her landmarks as she stands now (v204 `bodyMarks`): a few hundred vertices and the joints. */
export type GownBodyMarks = ReturnType<typeof gownBodyMarks>;
const waistRings = new WeakMap<GownRig, { w: number[]; h: number[] }>();
export function gownBodyMarks(B: GownRig, lo: number, dress: Partial<GownDressMarks> | null) {
  const V = B.V, k = BODY_K, cm = 0.01 / B.P.S, J = (s: string) => jointP(B, s, new THREE.Vector3()), zc = (y: number) => B.zcAt(y);
  let ix = waistRings.get(B);
  if (!ix) {
    // The waist and hip rings, picked once on the body as built.
    const band = (y0: number) => B.torsoV.filter((i) => Math.abs(B.pos0[i * 3 + 1]! - y0) < 0.01);
    ix = { w: band(k.yWaist), h: band(k.yHip) };
    waistRings.set(B, ix);
  }
  const ring = (ids: number[], y0: number) => {
    let y = 0, x = 0;
    for (const i of ids) { y += V[i * 3 + 1]!; x = Math.max(x, Math.abs(V[i * 3]!)); }
    return ids.length ? { y: y / ids.length, x } : { y: y0, x: 0.15 };
  };
  const w = ring(ix.w, k.yWaist), h = ring(ix.h, k.yHip);
  let top = -1e9, hi = -1e9, xr = 0, zr = 0;
  for (const i of B.headV) if (V[i * 3 + 1]! > top) top = V[i * 3 + 1]!;
  // Her whole height and half-width as the stage frames her (v204 B.h, B.w): the gown's hem counts with a little room.
  const zmid = zc(k.yHip);
  for (let i = 0; i < B.n; i++) { hi = Math.max(hi, V[i * 3 + 1]!); xr = Math.max(xr, Math.abs(V[i * 3]!)); zr = Math.max(zr, Math.abs(V[i * 3 + 2]! - zmid)); }
  const wide = Math.max(xr, zr, dress?.hemR ? dress.hemR * 1.22 : 0);
  const aL = B.breastV.length ? apexOf(B, 1) : null, aR = B.breastV.length ? apexOf(B, -1) : null;
  const ap = aL && aR ? aL.clone().add(aR).multiplyScalar(0.5) : new THREE.Vector3(0, k.yCh, zc(k.yCh));
  // The fold under the breast: the underbust line, wherever the bust sits.
  let yF = 1e9;
  for (const i of B.foldV) yF = Math.min(yF, V[i * 3 + 1]!);
  if (!(yF < ap.y - cm)) yF = ap.y - 6 * cm;
  const yN = jointY(B, 'neck01');
  return {
    V, cm, lo, top, hi, wide, zc, J, ap, aL, aR, yF, yW: w.y, wx: w.x, yH: h.y, hx: h.x, yN,
    shL: J('upperarm01.L'), shR: J('upperarm01.R'), hipL: J('upperleg01.L'), hipR: J('upperleg01.R'), knee: J('lowerleg01.L'), ftL: J('foot.L'), ftR: J('foot.R'),
    handLen: B.handLen,
    top0: dress?.top0 ?? ap.y + 5 * cm, topB: dress?.topB ?? yN,
    yHem: dress?.yHem != null ? Math.max(dress.yHem, lo) : lo, hemR: dress?.hemR || 0.25, yWaistline: dress?.yWaistline ?? w.y,
    box: dress?.box ?? null, capeBox: dress?.capeBox ?? null,
  };
}

/** A part to look at: its centre, the points that must stay in view, a pitch (from above) and her turn when the part says. */
export type GownAim = { c: [number, number, number]; pts: [number, number, number][]; pitch?: number; R?: number };
type P3 = [number, number, number];
const v3 = (v: THREE.Vector3): P3 => [v.x, v.y, v.z];
const boxPts = (b: [THREE.Vector3, THREE.Vector3]): P3[] => {
  const out: P3[] = [];
  for (const x of [b[0].x, b[1].x]) for (const y of [b[0].y, b[1].y]) for (const z of [b[0].z, b[1].z]) out.push([x, y, z]);
  return out;
};

/** v204 `AIMS`, in her model units. */
export const GOWN_AIMS: Record<GownAimName, (m: GownBodyMarks) => GownAim> = {
  // Head to toe, arms and hem.
  whole: (m) => { const y = (m.lo + m.hi) / 2, z = m.zc(m.yH); return { c: [0, y, z], pts: [[0, m.lo, z], [0, m.hi, z], [m.wide, y, z], [-m.wide, y, z]] }; },
  // The gown, a train or veil on the floor, a cape: all of it.
  outfit: (m) => {
    const a = GOWN_AIMS.whole(m);
    if (!m.box) return a;
    const [mn, mx] = m.box, y0 = Math.min(m.lo, mn.y), y1 = Math.max(m.hi, mx.y);
    return { c: [0, (y0 + y1) / 2, (Math.min(mn.z, a.c[2]) + Math.max(mx.z, a.c[2])) / 2], pts: [...a.pts, ...boxPts(m.box)] };
  },
  // The train and veil: low and wide, all of it on the floor behind her.
  low: (m) => {
    const a = GOWN_AIMS.outfit(m);
    if (!m.box) return a;
    const y0 = Math.min(m.lo, m.box[0].y), y1 = Math.max(m.hi, m.box[1].y);
    return { ...a, c: [a.c[0], y0 + (y1 - y0) * 0.45, a.c[2]] };
  },
  cape: (m) => {
    if (!m.capeBox) return GOWN_AIMS.outfit(m);
    const c = m.capeBox[0].clone().add(m.capeBox[1]).multiplyScalar(0.5);
    return { c: v3(c), pts: boxPts(m.capeBox) };
  },
  // The bust point, the whole bust round it.
  bust: (m) => { const a = m.ap, hw = (m.aL ? Math.abs(m.aL.x) : 0.08) + 5 * m.cm, up = a.y + Math.max(a.y - m.yF, 7 * m.cm) + 3 * m.cm; return { c: [0, a.y, a.z], pts: [[hw, a.y, a.z], [-hw, a.y, a.z], [0, m.yF - 4 * m.cm, a.z], [0, up, a.z]] }; },
  // Just under the bust.
  ub: (m) => { const y = m.yF, z = m.zc(y), hw = (m.aL ? Math.abs(m.aL.x) : 0.08) + 6 * m.cm; return { c: [0, y, z], pts: [[hw, y, z], [-hw, y, z], [0, m.ap.y + 3 * m.cm, z], [0, y - 9 * m.cm, z]] }; },
  // Her natural waist.
  waist: (m) => { const y = m.yW, z = m.zc(y), x = m.wx + 4 * m.cm; return { c: [0, y, z], pts: [[x, y, z], [-x, y, z], [0, y + 11 * m.cm, z], [0, y - 11 * m.cm, z]] }; },
  // The fullest hip.
  hips: (m) => { const y = m.yH, z = m.zc(y), x = m.hx + 4 * m.cm; return { c: [0, y, z], pts: [[x, y, z], [-x, y, z], [0, y + 12 * m.cm, z], [0, y - 12 * m.cm, z]] }; },
  // The shoulder line, tip to tip.
  sh: (m) => { const y = (m.shL.y + m.shR.y) / 2, z = m.zc(y); return { c: [0, y, z], pts: [[m.shL.x + 6 * m.cm, m.shL.y, m.shL.z], [m.shR.x - 6 * m.cm, m.shR.y, m.shR.z], [0, m.yN + 7 * m.cm, z], [0, y - 13 * m.cm, z]] }; },
  // Her left arm (turned to the view), shoulder to fingertips.
  arm: (m) => {
    const s = m.shL, e = m.J('lowerarm01.L'), w = m.J('wrist.L'), f = w.clone().add(w.clone().sub(e).normalize().multiplyScalar(m.handLen + 2 * m.cm)), p = 4 * m.cm;
    return { c: v3(s.clone().add(f).multiplyScalar(0.5)), pts: [[s.x + p, s.y + p, s.z], [e.x + p, e.y, e.z], v3(w), [f.x + p, f.y - p, f.z], [s.x - p, s.y, s.z]] };
  },
  // Hip joint to the floor.
  leg: (m) => { const y = (m.hipL.y + m.hipR.y) / 2, z = m.zc(y), lo = m.lo, c = 5 * m.cm; return { c: [0, (y + lo) / 2, z], pts: [[m.hipL.x + c, y + c, z], [m.hipR.x - c, y + c, z], [m.ftL.x + c, lo - c / 2, m.ftL.z + 3 * c], [m.ftR.x - c, lo - c / 2, m.ftR.z + 3 * c]] }; },
  // The feet and shoes as she stands in them; the floor in the lower part of the view.
  feet: (m) => {
    const V = m.V, yC = m.lo + 13 * m.cm;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < V.length; i += 3) if (V[i + 1]! < yC) { x0 = Math.min(x0, V[i]!); x1 = Math.max(x1, V[i]!); z0 = Math.min(z0, V[i + 2]!); z1 = Math.max(z1, V[i + 2]!); }
    if (x0 > x1) { x0 = m.ftR.x - 0.06; x1 = m.ftL.x + 0.06; z0 = m.ftL.z - 0.06; z1 = m.ftL.z + 0.14; }
    const p = 3 * m.cm, pts: P3[] = [];
    for (const x of [x0 - p, x1 + p]) for (const z of [z0 - p, z1 + p]) pts.push([x, m.lo - p / 2, z], [x, yC + p, z]);
    return { c: [(x0 + x1) / 2, m.lo + (yC - m.lo) * 0.62, (z0 + z1) / 2], pts, pitch: 0.12 };
  },
  neck: (m) => { const y = m.top0, z = m.zc(y); return { c: [0, y - 2 * m.cm, z], pts: [[0, y + 8 * m.cm, z], [0, Math.min(y, m.ap.y) - 7 * m.cm, z], v3(m.shL), v3(m.shR)] }; },
  collar: (m) => { const z = m.zc(m.yN); return { c: [0, m.yN - 2 * m.cm, z], pts: [[0, m.yN + 9 * m.cm, z], [0, m.top0 - 5 * m.cm, z], v3(m.shL), v3(m.shR)] }; },
  // The shoulder and upper arm.
  sleeve: (m) => {
    const eL = m.J('lowerarm01.L'), eR = m.J('lowerarm01.R'), ys = (m.shL.y + m.shR.y) / 2, y = (ys + (eL.y + eR.y) / 2) / 2, z = m.zc(ys), p = 5 * m.cm;
    return { c: [0, y, z], pts: [[m.shL.x + p, ys + p, m.shL.z], [m.shR.x - p, ys + p, m.shR.z], [eL.x + p, eL.y - p, eL.z], [eR.x - p, eR.y - p, eR.z]] };
  },
  // The back opening, nape to its lowest point.
  back: (m) => { const yB = clamp(m.topB, m.yW, m.yN), y = (m.yN + yB) / 2, z = m.zc(y); return { c: [0, y, z], pts: [[0, m.yN + 6 * m.cm, z], [0, yB - 7 * m.cm, z], v3(m.shL), v3(m.shR)] }; },
  closure: (m) => { const y1 = Math.min(m.topB, m.yN), y0 = m.yW - 10 * m.cm, y = (y1 + y0) / 2, z = m.zc(y); return { c: [0, y, z], pts: [[0, y1 + 4 * m.cm, z], [0, y0 - 4 * m.cm, z], [m.wx + 3 * m.cm, m.yW, z], [-m.wx - 3 * m.cm, m.yW, z]] }; },
  // Where the bodice meets the skirt.
  waistline: (m) => { const y = m.yWaistline, z = m.zc(y); return { c: [0, y, z], pts: [[0, y + 14 * m.cm, z], [0, y - 14 * m.cm, z], [m.wx + 4 * m.cm, m.yW, z], [-m.wx - 4 * m.cm, m.yW, z]] }; },
  // Neckline to waist.
  bodice: (m) => { const y = (m.top0 + m.yW) / 2, z = m.zc(y), hw = (m.aL ? Math.abs(m.aL.x) : 0.08) + 7 * m.cm; return { c: [0, y, z], pts: [[0, m.top0 + 4 * m.cm, z], [0, m.yW - 6 * m.cm, z], [hw, m.ap.y, z], [-hw, m.ap.y, z]] }; },
  // The bodice and upper skirt.
  upper: (m) => { const yl = m.yH - 8 * m.cm, y = (m.top0 + yl) / 2, z = m.zc(y); return { c: [0, y, z], pts: [[0, m.top0 + 4 * m.cm, z], [0, yl - 4 * m.cm, z], [m.hx + 5 * m.cm, m.yH, z], [-m.hx - 5 * m.cm, m.yH, z]] }; },
  // Thigh to knee, where a slit opens.
  slit: (m) => { const yk = m.knee.y, yh = (m.hipL.y + m.hipR.y) / 2, y = yk + 0.4 * (yh - yk), z = m.zc(y); return { c: [0, y, z], pts: [[0, yk - 12 * m.cm, z], [0, yh + 5 * m.cm, z], [m.hx + 4 * m.cm, y, z], [-m.hx - 4 * m.cm, y, z]] }; },
  // The hem, with the floor under it.
  hem: (m) => { const yh = m.yHem, z = m.zc(m.yH), r = Math.min(m.hemR, 0.6), y = Math.max(yh + 4 * m.cm, m.lo + 10 * m.cm); return { c: [0, y, z], pts: [[0, m.lo - 2 * m.cm, z + r], [0, yh + 24 * m.cm, z], [r, yh, z], [-r, yh, z]], pitch: 0.1 }; },
  // Waist to hem.
  skirt: (m) => { const yh = m.yHem, y = (m.yW + yh) / 2, z = m.zc(m.yH), r = Math.min(m.hemR, 0.8); return { c: [0, y, z], pts: [[0, m.yW + 6 * m.cm, z], [0, yh - 3 * m.cm, z], [r, yh, z], [-r, yh, z]] }; },
  // A cape's fastening at the back of the neck.
  nape: (m) => { const z = m.zc(m.yN); return { c: [0, m.yN - 3 * m.cm, z], pts: [v3(m.shL), v3(m.shR), [0, m.yN + 7 * m.cm, z], [0, m.shL.y - 13 * m.cm, z]] }; },
  // The head and the veil's front.
  blusher: (m) => { const z = m.zc(m.ap.y); return { c: [0, (m.top + m.ap.y) / 2, z], pts: [[0, m.top + 4 * m.cm, z], [0, m.ap.y - 5 * m.cm, z], v3(m.shL), v3(m.shR)] }; },
};

/** v204 `aimOf`: the aim for a key on her live body (the whole outfit when the key has none of its own). */
export function gownAimOf(m: GownBodyMarks, key: GownFocusKey): GownAim {
  return GOWN_AIMS[GOWN_AIM_OF[key] ?? 'outfit'](m);
}

/**
 * v204 `aimDist`: as close as the step asks (z × the whole-body distance), but never so close that a point of the part
 * leaves about 84 % of the view, on any screen shape. Every vector is in world units; `dir` points from the part to the camera.
 */
export function gownAimDist(
  c: THREE.Vector3, pts: readonly THREE.Vector3[], dir: THREE.Vector3,
  view: { fov: number; aspect: number; up: THREE.Vector3; z: number; fitDist: number; min: number; max: number },
): number {
  const tv = Math.tan(THREE.MathUtils.degToRad(view.fov) / 2), th = tv * view.aspect, M = 0.84;
  const rt = new THREE.Vector3().crossVectors(view.up, dir).normalize(), up = new THREE.Vector3().crossVectors(dir, rt), v = new THREE.Vector3();
  let d = view.z * view.fitDist;
  for (const p of pts) {
    v.subVectors(p, c);
    const u = v.dot(dir);
    d = Math.max(d, Math.abs(v.dot(rt)) / (M * th) + u, Math.abs(v.dot(up)) / (M * tv) + u);
  }
  return clamp(d, view.min * 1.001, view.max * 0.999);
}

/** v204: the view level with the part (a touch from above for the feet), from the direction the camera now looks. */
export function gownAimDir(camToTarget: THREE.Vector3, pitch?: number): THREE.Vector3 {
  const d = camToTarget.clone(), hz0 = Math.hypot(d.x, d.z);
  if (hz0 < 1e-4) d.set(0, 0, 1);
  const el = pitch ?? clamp(Math.atan2(d.y, Math.max(hz0, 1e-4)), -0.05, 0.25), h = Math.hypot(d.x, d.z) || 1;
  return new THREE.Vector3((d.x / h) * Math.cos(el), Math.sin(el), (d.z / h) * Math.cos(el));
}

/** How long the move in takes (s): longer when she has further to turn (v204 `focusOn`). */
export const gownFocusInS = (turn: number) => 0.45 + 0.4 * Math.min(1, Math.abs(turn) / Math.PI);
/** v204: a close-up holds this long (s) after the last touch, then eases out to the whole outfit over GOWN_FOCUS_OUT_S. */
export const GOWN_FOCUS_HOLD_S = 1.5;
export const GOWN_FOCUS_OUT_S = 0.6;
