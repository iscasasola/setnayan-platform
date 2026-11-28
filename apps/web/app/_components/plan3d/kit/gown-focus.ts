/**
 * 👗 The stage's close-ups (prototype v204 `focusOn`, `aimAt`, `stepFocus`): she turns to show the part, the camera
 * eases in to it, measured on her live body, and holds. A measurement step holds for the whole step. A design step holds
 * a moment, then eases out to her whole figure. Her fingers always win: a drag lets the close-up go at once.
 */
import * as THREE from 'three';
import { GOWN_FOCUS, GOWN_FOCUS_HOLD_S, GOWN_FOCUS_OUT_S, gownAimDir, gownAimDist, gownAimOf, gownFocusInS, type GownBodyMarks, type GownFocusKey } from '@/lib/gown/stage/focus';

/** What the designer asks for: look at `key`; a new `n` asks again; `stay` holds it until the next ask. */
export type GownFocusAsk = { key: GownFocusKey; n: number; stay: boolean };

export type GownFocusState = {
  on: boolean; ph: 'in' | 'hold' | 'out'; t: number; dur: number; key: GownFocusKey; stay: boolean;
  r0: number; r1: number; p0: THREE.Vector3; q0: THREE.Vector3; p2: THREE.Vector3; q2: THREE.Vector3;
  c: THREE.Vector3 | null; pts: THREE.Vector3[]; dir: THREE.Vector3; z: number; aimAt: number;
};
export const idleGownFocus = (): GownFocusState => ({
  on: false, ph: 'in', t: 0, dur: 0.45, key: 'm_full', stay: false, r0: 0, r1: 0,
  p0: new THREE.Vector3(), q0: new THREE.Vector3(), p2: new THREE.Vector3(), q2: new THREE.Vector3(), c: null, pts: [], dir: new THREE.Vector3(0, 0, 1), z: 1, aimAt: 0,
});

/** The stage's side of a close-up: her turn now, where she stands, the camera, the whole-body view. */
export type GownFocusStage = {
  rot: number;
  pivotPos: THREE.Vector3;
  scale: number;
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  /** The whole-body view (v186 `frame`): its distance and the point it looks at. */
  fitDist: number;
  fit: { p: THREE.Vector3; q: THREE.Vector3 };
  min: number; max: number;
  marks: () => GownBodyMarks;
};

const _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function aim(F: GownFocusState, st: GownFocusStage) {
  const a = gownAimOf(st.marks(), F.key);
  _m.compose(st.pivotPos, _q.setFromEuler(_e.set(0, F.r1, 0)), _s.setScalar(st.scale));
  const w = (p: readonly number[]) => new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(_m);
  F.c = w(a.c);
  F.pts = a.pts.map(w);
  F.dir = gownAimDir(F.p0.clone().sub(F.q0), a.pitch);
  F.aimAt = performance.now();
}

/** v204 `focusOn`: start a close-up from where the camera is. She turns so the part faces the view. */
export function gownStartFocus(F: GownFocusState, ask: GownFocusAsk, st: GownFocusStage) {
  const R = GOWN_FOCUS[ask.key][2], cam = st.camera.position, az = Math.atan2(cam.x - st.target.x, cam.z - st.target.z), TAU = Math.PI * 2;
  let r1 = az + R;
  r1 += Math.round((st.rot - r1) / TAU) * TAU;
  Object.assign(F, { on: true, ph: 'in', t: 0, dur: gownFocusInS(r1 - st.rot), key: ask.key, stay: ask.stay, r0: st.rot, r1, z: GOWN_FOCUS[ask.key][1] });
  F.p0.copy(cam);
  F.q0.copy(st.target);
  aim(F, st);
}

/** Let a held close-up go: it eases out to her whole figure. */
export function gownLetFocusGo(F: GownFocusState) {
  F.stay = false;
  if (F.on && F.ph === 'hold') F.t = Math.max(F.t, GOWN_FOCUS_HOLD_S);
}

/**
 * v204 `stepFocus`, one frame: returns her turn and where the camera stands and looks, or null when no close-up runs.
 * `stale` = her body changed (a slider, a pose): the part is measured again, at most every 120 ms.
 */
export function gownStepFocus(F: GownFocusState, st: GownFocusStage, dt: number, stale: boolean): { rot: number; pos: THREE.Vector3; tgt: THREE.Vector3 } | null {
  if (!F.on) return null;
  F.t += dt;
  const e = (x: number) => x * x * (3 - 2 * x);
  if (!F.c || (stale && performance.now() - F.aimAt > 120)) aim(F, st);
  const tgt = F.c!.clone();
  const pos = tgt.clone().addScaledVector(F.dir, gownAimDist(tgt, F.pts, F.dir, { fov: st.camera.fov, aspect: st.camera.aspect, up: st.camera.up, z: F.z, fitDist: st.fitDist, min: st.min, max: st.max }));
  if (F.ph === 'in') {
    const u = e(Math.min(1, F.t / F.dur));
    const out = { rot: F.r0 + (F.r1 - F.r0) * u, pos: F.p0.clone().lerp(pos, u), tgt: F.q0.clone().lerp(tgt, u) };
    if (F.t >= F.dur) { F.ph = 'hold'; F.t = 0; }
    return out;
  }
  if (F.ph === 'hold') {
    if (F.t >= GOWN_FOCUS_HOLD_S && !F.stay) { F.ph = 'out'; F.t = 0; F.p2.copy(st.fit.p); F.q2.copy(st.fit.q); }
    return { rot: F.r1, pos, tgt };
  }
  const u = e(Math.min(1, F.t / GOWN_FOCUS_OUT_S));
  if (F.t >= GOWN_FOCUS_OUT_S) F.on = false;
  return { rot: F.r1, pos: pos.lerp(F.p2, u), tgt: tgt.lerp(F.q2, u) };
}
