/**
 * 👗 gown/motion/poses — her poses (prototype v206 `POSES`, `targetPose`, `blendPose`, `handOnHip`, and the arm
 * clearance in `present`). Women only. Plain three.js maths on the posed body; the stage owns the state and passes it in.
 *
 * A pose is a turn per joint, in plain model axes (x = her left, y = up, z = front), in degrees. A change of pose blends
 * from the last pose over 0.45 s. Her arms ease out a little at a time until hand and forearm clear her body and the
 * skirt (never through the cloth); the hand-on-hip pose reaches her left hand to the side of the skirt just under the
 * waist, the elbow out and back.
 */
import * as THREE from 'three';
import { computeBones, jointP } from '../body/bones';
import { BODY_K } from '../body/constants';
import { clamp, type GownRig } from '../body/rig';
import { heelDraw, skin } from '../body/skin';
import { reach, type GownEnvelope } from '../dress/table';

/** A joint turn in degrees: about her left, about up, about the front. */
export type GownJointTurn = readonly [number, number, number];
export type GownPoseTurns = Readonly<Record<string, GownJointTurn>>;

/** v206 `POSES`: the named poses. `dyn` is the walk or jump at this moment (set by the motion step). */
export const GOWN_POSES = {
  a: {},
  down: { 'upperarm01.L': [4, 0, -30], 'upperarm01.R': [4, 0, 30], 'lowerarm01.L': [-6, 0, 0], 'lowerarm01.R': [-6, 0, 0] },
  // Her left arm is placed by the hand-on-hip reach.
  hip: { 'upperarm01.R': [4, 0, 30], 'lowerarm01.R': [-6, 0, 0] },
  // Measuring a sleeve: the arm bent at the elbow, hand to the front of the waist.
  bent: { 'upperarm01.L': [4, 0, -30], 'upperarm01.R': [4, 0, 30], 'lowerarm01.L': [0, -80, 0], 'lowerarm01.R': [-6, 0, 0] },
  step: {
    'upperleg01.R': [-21, 0, 0], 'lowerleg01.R': [24, 0, 0], 'foot.R': [-3, 0, 0], 'upperleg01.L': [6, 0, 0], 'lowerleg01.L': [2, 0, 0], 'foot.L': [-8, 0, 0],
    'upperarm01.L': [-10, 0, -29], 'upperarm01.R': [12, 0, 29], 'lowerarm01.L': [-10, 0, 0], 'lowerarm01.R': [-4, 0, 0],
  },
  // Knee pop: the knee bends a little forward and in, heel up on the toe.
  pop: {
    'upperleg01.R': [-12, 0, -5], 'lowerleg01.R': [30, 0, 0], 'foot.R': [-34, 0, 0], 'upperleg01.L': [2, 0, -1], 'foot.L': [-3, 0, 0],
    'upperarm01.L': [4, 0, -30], 'upperarm01.R': [4, 0, 30], 'lowerarm01.L': [-12, 0, 0], 'lowerarm01.R': [-12, 0, 0],
  },
  // Mid-stride.
  walk: {
    'upperleg01.R': [-26, 0, 0], 'lowerleg01.R': [16, 0, 0], 'foot.R': [8, 0, 0], 'upperleg01.L': [14, 0, 0], 'lowerleg01.L': [22, 0, 0], 'foot.L': [-18, 0, 0],
    'upperarm01.L': [-14, 0, -29], 'upperarm01.R': [14, 0, 29], 'lowerarm01.L': [-8, 0, 0], 'lowerarm01.R': [-8, 0, 0],
  },
  // Seated on a bench, hands in the lap.
  sit: {
    'upperleg01.R': [-84, 0, 4], 'upperleg01.L': [-84, 0, -4], 'lowerleg01.R': [86, 0, 0], 'lowerleg01.L': [86, 0, 0], 'foot.R': [-4, 0, 0], 'foot.L': [-4, 0, 0],
    'upperarm01.L': [-6, 0, -36], 'upperarm01.R': [-6, 0, 36], 'lowerarm01.L': [-22, 0, 0], 'lowerarm01.R': [-22, 0, 0],
  },
  // Seated, right leg crossed over the left knee.
  cross: {
    'upperleg01.R': [-96, 0, -16], 'upperleg01.L': [-82, 0, -3], 'lowerleg01.R': [64, 0, 0], 'lowerleg01.L': [86, 0, 0], 'foot.R': [-30, 0, 0], 'foot.L': [-4, 0, 0],
    'upperarm01.L': [-6, 0, -36], 'upperarm01.R': [-6, 0, 36], 'lowerarm01.L': [-22, 0, 0], 'lowerarm01.R': [-22, 0, 0],
  },
  // On both knees, sitting up.
  kneel: {
    'upperleg01.R': [-6, 0, 3], 'upperleg01.L': [-6, 0, -3], 'lowerleg01.R': [96, 0, 0], 'lowerleg01.L': [96, 0, 0], 'foot.R': [40, 0, 0], 'foot.L': [40, 0, 0],
    'upperarm01.L': [-4, 0, -34], 'upperarm01.R': [-4, 0, 34], 'lowerarm01.L': [-16, 0, 0], 'lowerarm01.R': [-16, 0, 0],
  },
  dyn: {},
} as const satisfies Record<string, GownPoseTurns>;
export type GownPoseName = keyof typeof GOWN_POSES;
/** v206 `TOUR`: every pose, one after another (the seated poses wait for a proper lap drape). */
export const GOWN_POSE_TOUR: readonly GownPoseName[] = ['a', 'down', 'hip', 'step', 'pop', 'walk', 'kneel'];
/** Poses she stands in: the skirt is cut for her standing, and a seated skirt keeps that length. */
export const GOWN_STANDING_POSES: readonly GownPoseName[] = ['a', 'down', 'hip'];
/** v206 Stance: the poses she can pick, as the preview names them (the seated poses wait for a proper lap drape). */
export const GOWN_STANCES = [
  { id: 'a', label: 'Standing' },
  { id: 'down', label: 'Arms down' },
  { id: 'hip', label: 'Hand on hip' },
  { id: 'step', label: 'Step' },
  { id: 'pop', label: 'Knee pop' },
  { id: 'walk', label: 'Mid-stride' },
  { id: 'kneel', label: 'Kneel' },
] as const satisfies readonly { id: GownPoseName; label: string }[];
/** v206: a press held this long (ms) opens a preview button's own list instead of its tap. */
export const GOWN_HOLD_MS = 420;
/** How long a change of pose blends (s). */
export const GOWN_POSE_BLEND_S = 0.45;

/** Her pose as the stage holds it (the prototype keeps these on the body). */
export type GownPoseState = {
  pose: GownPoseName;
  /** 0…1 through the blend from the last pose. */
  t: number;
  lastQ: (THREE.Quaternion | null)[];
  poseQ: (THREE.Quaternion | null)[];
  /** Extra lift of each upper arm (degrees) so a hand never sinks into her hip or skirt. */
  extra: { L: number; R: number };
  /** The hand-on-hip reach, per joint. */
  ik: Record<number, THREE.Quaternion> | null;
  /** The walk or jump at this moment (pose `dyn`). */
  dyn: GownPoseTurns;
  /** The foot's tilt onto the ball for her heels (radians). */
  heelT: number;
  /** Where she stands, and where she stood (the skirt keeps its standing length when she sits or kneels). */
  floorY: number;
  floorStand: number | null;
};

export function emptyGownPose(B: GownRig): GownPoseState {
  return { pose: 'a', t: 1, lastQ: new Array(B.nb).fill(null), poseQ: new Array(B.nb).fill(null), extra: { L: 0, R: 0 }, ik: null, dyn: {}, heelT: 0, floorY: 0, floorStand: null };
}

const D = Math.PI / 180, IDQ = new THREE.Quaternion(), _e = new THREE.Euler();
const boneOf = (B: GownRig, s: string) => B.ix[s] ?? B.name.findIndex((x) => x.replace(/\W/g, '') === s.replace(/\W/g, ''));

/** v206 `targetPose`: the named pose as joint turns, plus any arm lift, the hand-on-hip reach and her heels. */
export function gownTargetPose(B: GownRig, S: GownPoseState, heelCm: number): (THREE.Quaternion | null)[] {
  const Z: GownPoseTurns = S.pose === 'dyn' ? S.dyn : GOWN_POSES[S.pose], out: (THREE.Quaternion | null)[] = new Array(B.nb).fill(null);
  for (const s in Z) { const z = Z[s]!; out[boneOf(B, s)] = new THREE.Quaternion().setFromEuler(_e.set(z[0] * D, z[1] * D, z[2] * D, 'XYZ')); }
  // Extra lift so a hand never sinks into hip or skirt.
  for (const sd of ['L', 'R'] as const) if (S.extra[sd]) {
    const i = B.ix[`upperarm01.${sd}`]!, q = new THREE.Quaternion().setFromEuler(_e.set(0, 0, (sd === 'L' ? 1 : -1) * S.extra[sd] * D));
    out[i] = out[i] ? q.multiply(out[i]!) : q;
  }
  if (S.ik) for (const i in S.ik) out[+i] = S.ik[+i]!;
  // Elevation: on her toes whenever a height is chosen (the foot bends at the ball; the toes lie flat on the floor).
  if (heelCm > 0) {
    const a = Math.asin(Math.min(0.85, heelCm / 15)), qf = new THREE.Quaternion().setFromEuler(_e.set(a, 0, 0));
    for (const sd of ['L', 'R']) { const i = boneOf(B, `foot.${sd}`); out[i] = out[i] ? qf.clone().multiply(out[i]!) : qf.clone(); }
    S.heelT = a;
  } else S.heelT = 0;
  return out;
}

/** v206 `blendPose`: from the last pose toward the target, by t. */
export function gownBlendPose(B: GownRig, S: GownPoseState, Tq: (THREE.Quaternion | null)[], t: number): void {
  for (let i = 0; i < B.nb; i++) { const a = S.lastQ[i], z = Tq[i]; S.poseQ[i] = !a && !z ? null : (a ? a.clone() : new THREE.Quaternion()).slerp(z || IDQ, t); }
}

/**
 * v206 `handOnHip`: a two-bone reach. The wrist goes to the side of the dress (or body) just under the waist, the elbow
 * out and back, the hand lies along the hip. `off` eases it further out.
 */
export function gownHandOnHip(B: GownRig, T: GownEnvelope, off: number): Record<number, THREE.Quaternion> {
  const ix = B.ix, S = jointP(B, 'upperarm01.L', new THREE.Vector3()), sh = B.rp[ix['upperarm01.L']!]!, el = B.rp[ix['lowerarm01.L']!]!, wr = B.rp[ix['wrist.L']!]!, fg = B.rp[boneOf(B, 'finger3-1.L')]!;
  const u0 = el.clone().sub(sh), f0 = wr.clone().sub(el), h0 = fg.clone().sub(wr).normalize(), Lu = u0.length() * B.P.karm, Lf = f0.length() * B.P.karm;
  u0.normalize(); f0.normalize();
  const a = (74 * Math.PI) / 180, yT = BODY_K.yWaist - 0.075, cz = B.zcAt(Math.max(yT, T.yF)), r = reach(T, Math.sin(a), yT, cz + Math.cos(a)).env + 0.02 + off;
  const d = new THREE.Vector3(r * Math.sin(a), yT, cz + r * Math.cos(a)).sub(S), Dd = clamp(d.length(), Math.abs(Lu - Lf) + 0.01, (Lu + Lf) * 0.985);
  d.normalize();
  const al = (Lu * Lu - Lf * Lf + Dd * Dd) / (2 * Dd), h = Math.sqrt(Math.max(0, Lu * Lu - al * al)), pole = new THREE.Vector3(0.75, 0.05, -0.66);
  pole.addScaledVector(d, -pole.dot(d)).normalize();
  const ue = d.clone().multiplyScalar(al).addScaledVector(pole, h), fe = d.clone().multiplyScalar(Dd).sub(ue).normalize();
  ue.normalize();
  const Qu = new THREE.Quaternion().setFromUnitVectors(u0, ue), Qf = new THREE.Quaternion().setFromUnitVectors(f0.applyQuaternion(Qu), fe), acc = Qf.clone().multiply(Qu);
  const want = new THREE.Vector3(-Math.cos(a) * 0.55 + Math.sin(a) * 0.12, -0.8, Math.sin(a) * 0.55 + Math.cos(a) * 0.12).normalize(), Qh = new THREE.Quaternion().setFromUnitVectors(h0.applyQuaternion(acc), want);
  return { [ix['upperarm01.L']!]: Qu, [ix['lowerarm01.L']!]: Qu.clone().invert().multiply(Qf).multiply(Qu), [ix['wrist.L']!]: acc.clone().invert().multiply(Qh).multiply(acc) };
}

/** Pose her (blend, bones, heels) and skin her; `list` skins only those vertices. */
function poseOnce(B: GownRig, S: GownPoseState, heelCm: number, list?: ArrayLike<number>) {
  gownBlendPose(B, S, gownTargetPose(B, S, heelCm), S.t);
  computeBones(B, S.poseQ, S.heelT);
  skin(B, list);
}

/**
 * The first half of v206 `present`: no arm lift, no reach; pose her, skin her, draw her heels, and find where she stands
 * (and, standing, where she stood). The stage then builds her envelope and the gown on this body, and calls
 * `gownClearArms`.
 */
export function gownPoseBody(B: GownRig, S: GownPoseState, heelCm: number): void {
  S.extra.L = S.extra.R = 0;
  S.ik = null;
  poseOnce(B, S, heelCm);
  heelDraw(B);
  let lo = 1e9;
  for (let i = 1; i < B.n * 3; i += 3) if (B.V[i]! < lo) lo = B.V[i]!;
  S.floorY = lo;
  if (S.floorStand === null || GOWN_STANDING_POSES.includes(S.pose)) S.floorStand = lo;
}

/**
 * The second half of v206 `present`, on the gown just built: the hand-on-hip reach, then each arm eased out (2.5° a step,
 * up to 16 steps) until no more than two of its vertices are inside her body or the cloth (within 4 mm). Returns whether
 * an arm moved: then the stage wraps the bodice once more (a moved arm shifts the underarm a touch).
 */
export function gownClearArms(B: GownRig, S: GownPoseState, T: GownEnvelope, heelCm: number): boolean {
  let ikOff = 0;
  if (S.pose === 'hip') { S.ik = gownHandOnHip(B, T, 0); poseOnce(B, S, heelCm, B.armV.L); }
  for (const sd of ['L', 'R'] as const) for (let it = 0; it < 16; it++) {
    let hit = 0;
    for (const i of B.armV[sd]) { const e = reach(T, B.V[i * 3]!, B.V[i * 3 + 1]!, B.V[i * 3 + 2]!); if (e.r < e.env + 0.004) { hit++; if (hit > 2) break; } }
    if (hit <= 2) break;
    if (sd === 'L' && S.ik) S.ik = gownHandOnHip(B, T, (ikOff += 0.006));
    else S.extra[sd] += 2.5;
    poseOnce(B, S, heelCm, B.armV[sd]);
  }
  skin(B);
  if (S.t >= 1) S.lastQ = S.poseQ.map((q) => q && q.clone());
  return !!(S.ik || S.extra.L || S.extra.R);
}

/** A change of pose: it blends from where she is (instantly when motion is reduced). */
export function gownSetPose(S: GownPoseState, pose: GownPoseName, reduce = false): void {
  S.pose = pose;
  S.t = reduce ? 1 : 0;
}
