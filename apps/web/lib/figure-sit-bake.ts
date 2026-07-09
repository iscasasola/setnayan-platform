/**
 * figure-sit-bake — the SINGLE SOURCE of the shared 3D figure's rig proportions
 * + the "bake the sit pose once" extraction that lets the seated crowd render as
 * a handful of InstancedMeshes instead of ~14 meshes PER occupant.
 *
 * WHY this file exists (and is pure — no React, no @react-three/fiber, only
 * `three` scene-graph math + `figure-rig`): the articulated `<Figure>`
 * (`app/_components/plan3d/kit/figure.tsx`) draws a seated guest as ~14 non-
 * instanced meshes hung off posed joint groups. Three surfaces mount one
 * `<Figure pose="sit">` per occupied seat with no cap/LOD/instancing — up to
 * 250 pax on the phone-first public walk ≈ 3.2k color-pass draws. The sit pose
 * is a CONSTANT (`sitPose()` — no id-variation, no time term), so every seated
 * figure shares the IDENTICAL baked joint transform. This module extracts each
 * body part's fixed local matrix ONCE; `InstancedSeatedCrowd` then draws the
 * whole seated crowd as one InstancedMesh per part (instance i's matrix =
 * seatRootMatrix × bakedLocal[part], tint via instanceColor).
 *
 * DRIFT-PROOFING (the whole point of pixel-identity): the rig proportions, the
 * per-mesh leaf offsets/scales, the joint-length denominators, and `applyPose`
 * all live HERE and are imported by BOTH `kit/figure.tsx`'s render JSX AND
 * `buildSitBakedLocals()` below. There is exactly one copy of every number that
 * places a body part, so the instanced crowd can never silently diverge from
 * the individual figure it replaces. `figure-sit-bake.test.ts` pins the baked
 * matrices AND proves seatRoot × bakedLocal reproduces the world position an
 * individual nested-group `<Figure>` would land each part at.
 */

import * as THREE from 'three';
import { sitPose, JOINTS, type Pose } from './figure-rig';

// ── Rig proportions (metres, adult at scale 1) ──────────────────────────────
// Moved here from kit/figure.tsx (which now imports them) so the render JSX and
// the baker share ONE definition. Semantics + values are unchanged: standing
// hip pivot at 0.80, the sitPose −0.30 m drop lands the hips at ≈0.50 on the
// 0.46 m chair seat.
export const PELVIS_Y = 0.8;
export const HIP_X = 0.062;
export const THIGH_LEN = 0.34;
export const SHIN_LEN = 0.44;
export const SHOULDER_X = 0.165;
export const SHOULDER_Y = 0.46;
export const UPPER_ARM_LEN = 0.22;
export const FOREARM_LEN = 0.2;
export const NECK_Y = 0.52;
export const HEAD_LIFT = 0.12;

// Native (unscaled) lengths of the shared limb capsules — the denominators the
// leaf scales use to stretch one buffer to thigh / shin / arm length. Kept in
// lockstep with the CapsuleGeometry definitions in kit/figure.tsx.
export const LEG_GEO_LEN = 0.36;
export const ARM_GEO_LEN = 0.224;

// ── Leaf mesh placements (pose-INDEPENDENT local offsets/scales) ────────────
// These are the fixed local transforms each body mesh carries relative to its
// parent joint group; they do NOT change with pose (only the joint groups
// rotate). Single-sourced here and consumed verbatim by the figure JSX.
export const HIP_BLOCK_Y = -0.045;
export const THIGH_SCALE_XZ = 1.28;
export const SHIN_SCALE_XZ = 1.08;
export const SHOE_POS_Y = -SHIN_LEN + 0.03;
export const SHOE_POS_Z = 0.04;
export const SHOE_SCALE_X = 1.4;
export const SHOE_SCALE_Y = 0.75;
export const SHOE_SCALE_Z = 1.4;
export const NECK_POS_Y = 0.545;
export const UPPER_ARM_SCALE_XZ = 1;
export const FOREARM_SCALE_XZ = 0.88;

// Derived limb scales (the Y stretch = target length ÷ native capsule length).
export const THIGH_SCALE_Y = THIGH_LEN / LEG_GEO_LEN;
export const SHIN_SCALE_Y = SHIN_LEN / LEG_GEO_LEN;
export const UPPER_ARM_SCALE_Y = UPPER_ARM_LEN / ARM_GEO_LEN;
export const FOREARM_SCALE_Y = FOREARM_LEN / ARM_GEO_LEN;

// ── Pose application (shared with the renderer) ─────────────────────────────

/** The posable joint groups. `THREE.Object3D` (not `Group`) so the renderer's
 *  refs and the baker's plain nodes both satisfy it. */
export type JointGroups = {
  pelvis: THREE.Object3D | null;
  torso: THREE.Object3D | null;
  head: THREE.Object3D | null;
  lShoulder: THREE.Object3D | null;
  rShoulder: THREE.Object3D | null;
  lElbow: THREE.Object3D | null;
  rElbow: THREE.Object3D | null;
  lHip: THREE.Object3D | null;
  rHip: THREE.Object3D | null;
  lKnee: THREE.Object3D | null;
  rKnee: THREE.Object3D | null;
};

/**
 * Write a rig-space pose onto the joint groups. The rig convention is
 * "positive = swings forward"; three's +X rotation swings a hanging limb
 * BACKWARD, hence the negations (documented in figure-rig's header). This is
 * the ONE applier — kit/figure.tsx imports it, so the animated figure and the
 * baked crowd apply poses identically.
 *
 * torsoLean applies UN-negated (2026-07-09 run-cycle review fix): the
 * hanging-limb negation is wrong for an UP-pointing child — rotation.x = −lean
 * tips a (0,1,0) torso toward local −Z, i.e. BACKWARD. The head channels
 * always applied un-negated for exactly this reason (headPitch + = look down);
 * the torso now matches. Every authored torsoLean (sit's social forward lean,
 * the walk/run momentum pitch, staff-idle leans) was written believing
 * "+ = forward", so this restores their INTENT — the old negation had them
 * all silently rendering mirrored.
 */
export function applyPose(g: JointGroups, p: Pose): void {
  if (g.pelvis) g.pelvis.position.set(0, PELVIS_Y + p.pelvisY, p.pelvisZ);
  if (g.torso) {
    g.torso.rotation.x = p.torsoLean;
    g.torso.rotation.z = p.torsoSway;
  }
  if (g.head) {
    g.head.rotation.y = p.headYaw;
    g.head.rotation.x = p.headPitch;
  }
  if (g.lShoulder) g.lShoulder.rotation.x = -p.leftShoulder;
  if (g.rShoulder) g.rShoulder.rotation.x = -p.rightShoulder;
  if (g.lElbow) g.lElbow.rotation.x = -p.leftElbow;
  if (g.rElbow) g.rElbow.rotation.x = -p.rightElbow;
  if (g.lHip) g.lHip.rotation.x = -p.leftHip;
  if (g.rHip) g.rHip.rotation.x = -p.rightHip;
  if (g.lKnee) g.lKnee.rotation.x = -p.leftKnee;
  if (g.rKnee) g.rKnee.rotation.x = -p.rightKnee;
}

// ── Baked sit-pose extraction ───────────────────────────────────────────────

/** The 14 seated body parts, in a stable canonical order (the instanced crowd
 *  pairs each key with the matching geometry buffer from kit/figure.tsx). */
export const SIT_PART_KEYS = [
  'hip',
  'thighL',
  'thighR',
  'shinL',
  'shinR',
  'shoeL',
  'shoeR',
  'torso',
  'neck',
  'upperArmL',
  'upperArmR',
  'forearmL',
  'forearmR',
  'head',
] as const;

export type SitPartKey = (typeof SIT_PART_KEYS)[number];

/** A leaf mesh's fixed local transform relative to its parent joint group,
 *  expressed as a plain node so the baker can compose the world matrix. */
function leaf(
  parent: THREE.Object3D,
  pos: readonly [number, number, number],
  scale: readonly [number, number, number] = [1, 1, 1],
): THREE.Object3D {
  const o = new THREE.Object3D();
  o.position.set(pos[0], pos[1], pos[2]);
  o.scale.set(scale[0], scale[1], scale[2]);
  parent.add(o);
  return o;
}

/**
 * Build the seated rig ONCE and read each body part's local matrix relative to
 * the (identity) figure root under the sit pose. The joint hierarchy mirrors
 * kit/figure.tsx exactly — pelvis → (hip block, two legs, torso), torso →
 * (torso mesh, neck, two arms, head) — and every placement number comes from
 * the shared constants above, so the result is the leaf transforms an
 * individual `<Figure pose="sit">` freezes into its meshes.
 *
 * Returns one `THREE.Matrix4` per part (the root is left at the identity, so a
 * leaf's `matrixWorld` IS its transform relative to the figure root). Callers
 * clone/consume; the internal tree is discarded.
 */
export function buildSitBakedLocals(): Record<SitPartKey, THREE.Matrix4> {
  const root = new THREE.Group(); // identity root — leaf world == figure-root-local
  const pelvis = new THREE.Group();
  root.add(pelvis);

  const groups: JointGroups = {
    pelvis,
    torso: null,
    head: null,
    lShoulder: null,
    rShoulder: null,
    lElbow: null,
    rElbow: null,
    lHip: null,
    rHip: null,
    lKnee: null,
    rKnee: null,
  };

  // ── Legs: pelvis → hip block + (hip → thigh, knee → shin + shoe) ──
  const hip = leaf(pelvis, [0, HIP_BLOCK_Y, 0]);
  const legLeaves: Record<'thighL' | 'thighR' | 'shinL' | 'shinR' | 'shoeL' | 'shoeR', THREE.Object3D> =
    {} as never;
  for (const side of [-1, 1] as const) {
    const hipJ = new THREE.Group();
    hipJ.position.set(side * HIP_X, 0, 0);
    pelvis.add(hipJ);
    groups[side < 0 ? 'lHip' : 'rHip'] = hipJ;

    legLeaves[side < 0 ? 'thighL' : 'thighR'] = leaf(
      hipJ,
      [0, -THIGH_LEN / 2, 0],
      [THIGH_SCALE_XZ, THIGH_SCALE_Y, THIGH_SCALE_XZ],
    );

    const kneeJ = new THREE.Group();
    kneeJ.position.set(0, -THIGH_LEN, 0);
    hipJ.add(kneeJ);
    groups[side < 0 ? 'lKnee' : 'rKnee'] = kneeJ;

    legLeaves[side < 0 ? 'shinL' : 'shinR'] = leaf(
      kneeJ,
      [0, -SHIN_LEN / 2, 0],
      [SHIN_SCALE_XZ, SHIN_SCALE_Y, SHIN_SCALE_XZ],
    );
    legLeaves[side < 0 ? 'shoeL' : 'shoeR'] = leaf(
      kneeJ,
      [0, SHOE_POS_Y, SHOE_POS_Z],
      [SHOE_SCALE_X, SHOE_SCALE_Y, SHOE_SCALE_Z],
    );
  }

  // ── Torso + arms + head (child of pelvis) ──
  const torso = new THREE.Group();
  pelvis.add(torso);
  groups.torso = torso;

  const torsoMesh = leaf(torso, [0, 0, 0]);
  const neck = leaf(torso, [0, NECK_POS_Y, 0]);

  const armLeaves: Record<'upperArmL' | 'upperArmR' | 'forearmL' | 'forearmR', THREE.Object3D> =
    {} as never;
  for (const side of [-1, 1] as const) {
    const shoulderJ = new THREE.Group();
    shoulderJ.position.set(side * SHOULDER_X, SHOULDER_Y, 0);
    torso.add(shoulderJ);
    groups[side < 0 ? 'lShoulder' : 'rShoulder'] = shoulderJ;

    armLeaves[side < 0 ? 'upperArmL' : 'upperArmR'] = leaf(
      shoulderJ,
      [0, -UPPER_ARM_LEN / 2, 0],
      [UPPER_ARM_SCALE_XZ, UPPER_ARM_SCALE_Y, UPPER_ARM_SCALE_XZ],
    );

    const elbowJ = new THREE.Group();
    elbowJ.position.set(0, -UPPER_ARM_LEN, 0);
    shoulderJ.add(elbowJ);
    groups[side < 0 ? 'lElbow' : 'rElbow'] = elbowJ;

    armLeaves[side < 0 ? 'forearmL' : 'forearmR'] = leaf(
      elbowJ,
      [0, -FOREARM_LEN / 2, 0],
      [FOREARM_SCALE_XZ, FOREARM_SCALE_Y, FOREARM_SCALE_XZ],
    );
  }

  // Head: head joint → inner lift group → head mesh (matches figure.tsx's
  // nested `position={[0,HEAD_LIFT,0]}` wrapper).
  const headJ = new THREE.Group();
  headJ.position.set(0, NECK_Y, 0);
  torso.add(headJ);
  groups.head = headJ;
  const headInner = new THREE.Group();
  headInner.position.set(0, HEAD_LIFT, 0);
  headJ.add(headInner);
  const headMesh = leaf(headInner, [0, 0, 0]);

  // Freeze the constant sit pose and read every part's world (= root-local)
  // matrix in one traversal.
  applyPose(groups, sitPose());
  root.updateWorldMatrix(true, true);

  return {
    hip: hip.matrixWorld.clone(),
    thighL: legLeaves.thighL.matrixWorld.clone(),
    thighR: legLeaves.thighR.matrixWorld.clone(),
    shinL: legLeaves.shinL.matrixWorld.clone(),
    shinR: legLeaves.shinR.matrixWorld.clone(),
    shoeL: legLeaves.shoeL.matrixWorld.clone(),
    shoeR: legLeaves.shoeR.matrixWorld.clone(),
    torso: torsoMesh.matrixWorld.clone(),
    neck: neck.matrixWorld.clone(),
    upperArmL: armLeaves.upperArmL.matrixWorld.clone(),
    upperArmR: armLeaves.upperArmR.matrixWorld.clone(),
    forearmL: armLeaves.forearmL.matrixWorld.clone(),
    forearmR: armLeaves.forearmR.matrixWorld.clone(),
    head: headMesh.matrixWorld.clone(),
  };
}

// ── Seat placement helpers ──────────────────────────────────────────────────

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3(1, 1, 1);
const _yAxis = new THREE.Vector3(0, 1, 0);

/**
 * The world matrix of a seated figure's ROOT — a floor point + a Y-rotation
 * (the only degrees of freedom a placed figure has). Instance matrices are then
 * `seatRootMatrix(...) × bakedLocal[part]`. `out` lets callers avoid allocating
 * in a layout loop.
 */
export function seatRootMatrix(
  x: number,
  z: number,
  faceY: number,
  out?: THREE.Matrix4,
): THREE.Matrix4 {
  const m = out ?? new THREE.Matrix4();
  _pos.set(x, 0, z);
  _quat.setFromAxisAngle(_yAxis, faceY);
  _scl.set(1, 1, 1);
  return m.compose(_pos, _quat, _scl);
}

// Scratch for the nested-group seat composition (module-scope; rendering +
// layout writes are single-threaded).
/** The hex validation the mannequin material uses (kit/outfits.ts) — anything
 *  that isn't a 6-digit hex falls back to white, so instanceColor multiplies to
 *  the same colour the individual figure's cached material would show. */
export const MANNEQUIN_TINT_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * The per-instance colour for a figure tint. Mirrors `mannequinMaterial`:
 * a valid 6-digit hex tint → that colour; null / invalid → white. Since the
 * instanced material's base is white and `instanceColor` multiplies over it,
 * white ≡ the untinted mannequin and a hex ≡ the tinted one — pixel-identical.
 */
export function instanceColorFor(tint: string | null | undefined, out?: THREE.Color): THREE.Color {
  const hex = tint && MANNEQUIN_TINT_RE.test(tint) ? tint : '#ffffff';
  return out ? out.set(hex) : new THREE.Color(hex);
}

const _table = new THREE.Matrix4();
const _seat = new THREE.Matrix4();
const _nudge = new THREE.Matrix4();
const _tmpQ = new THREE.Quaternion();
const _tmpP = new THREE.Vector3();
const _tmpS = new THREE.Vector3(1, 1, 1);

/**
 * Compose the figure-root world matrix for the shared "SeatedAvatar
 * convention" used by the couple lab + the public walk: a table group
 * (`home`, table yaw) → a per-seat group (`seat` local xz, seat yaw) → the
 * table-ward nudge (`[0,0,nudgeZ]` + a π flip so the rig's local +Z faces the
 * table). This is the EXACT nesting those surfaces mount `<Figure>` under, so
 * the instanced crowd lands each figure where the individual one did.
 */
export function seatedFigureMatrix(
  args: {
    homeX: number;
    homeZ: number;
    tableFaceY: number;
    seatX: number;
    seatZ: number;
    seatFaceY: number;
    nudgeZ?: number;
    flip?: boolean;
  },
  out?: THREE.Matrix4,
): THREE.Matrix4 {
  const { homeX, homeZ, tableFaceY, seatX, seatZ, seatFaceY, nudgeZ = -0.04, flip = true } = args;
  _tmpP.set(homeX, 0, homeZ);
  _tmpQ.setFromAxisAngle(_yAxis, tableFaceY);
  _table.compose(_tmpP, _tmpQ, _tmpS);
  _tmpP.set(seatX, 0, seatZ);
  _tmpQ.setFromAxisAngle(_yAxis, seatFaceY);
  _seat.compose(_tmpP, _tmpQ, _tmpS);
  _tmpP.set(0, 0, nudgeZ);
  _tmpQ.setFromAxisAngle(_yAxis, flip ? Math.PI : 0);
  _nudge.compose(_tmpP, _tmpQ, _tmpS);
  const m = out ?? new THREE.Matrix4();
  return m.multiplyMatrices(_table, _seat).multiply(_nudge);
}
