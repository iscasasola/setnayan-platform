/**
 * figure-sit-bake.test — the pixel-identity proof, in math form.
 *
 * The instanced seated crowd draws each body part at `seatRootMatrix ×
 * bakedLocal[part]`. For that to be indistinguishable from an individual
 * `<Figure pose="sit">`, `bakedLocal[part]` must equal the part's local matrix
 * under the figure's REAL joint hierarchy at the sit pose. This suite builds an
 * INDEPENDENT reference rig — the exact kit/figure.tsx nesting typed out with
 * literal proportions (NOT importing the baker's constants) — so if the baker's
 * tree or numbers ever drift from the figure, these assertions fail.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sitPose, type Pose } from './figure-rig';
import {
  buildSitBakedLocals,
  seatRootMatrix,
  seatedFigureMatrix,
  instanceColorFor,
  SIT_PART_KEYS,
  type SitPartKey,
} from './figure-sit-bake';

const EPS = 1e-9;

// ── Independent reference rig (mirrors kit/figure.tsx with LITERAL numbers) ──
// Deliberately duplicates the figure's structure/values so a mismatch means the
// baker diverged from the rendered figure. Only `sitPose()` is shared (it's the
// pose DATA, the thing every seated figure genuinely agrees on).

const R_PELVIS_Y = 0.8;
const R_HIP_X = 0.062;
const R_THIGH_LEN = 0.34;
const R_SHIN_LEN = 0.44;
const R_SHOULDER_X = 0.165;
const R_SHOULDER_Y = 0.46;
const R_UPPER_ARM_LEN = 0.22;
const R_FOREARM_LEN = 0.2;
const R_NECK_Y = 0.52;
const R_HEAD_LIFT = 0.12;
const R_LEG_GEO_LEN = 0.36;
const R_ARM_GEO_LEN = 0.224;

function refApplyPose(g: Record<string, THREE.Object3D | null>, p: Pose): void {
  if (g.pelvis) g.pelvis.position.set(0, R_PELVIS_Y + p.pelvisY, p.pelvisZ);
  if (g.torso) {
    g.torso.rotation.x = -p.torsoLean;
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

function m4(): THREE.Object3D {
  return new THREE.Object3D();
}

/** Build the reference figure under `root`, apply the sit pose, and return each
 *  body part's leaf node (so the caller can read matrixWorld). */
function buildReferenceRig(root: THREE.Object3D): Record<SitPartKey, THREE.Object3D> {
  const pelvis = new THREE.Group();
  pelvis.position.set(0, R_PELVIS_Y, 0);
  root.add(pelvis);

  const parts = {} as Record<SitPartKey, THREE.Object3D>;
  const groups: Record<string, THREE.Object3D | null> = {
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

  // Hip block
  const hip = m4();
  hip.position.set(0, -0.045, 0);
  pelvis.add(hip);
  parts.hip = hip;

  // Legs
  for (const side of [-1, 1] as const) {
    const hipJ = new THREE.Group();
    hipJ.position.set(side * R_HIP_X, 0, 0);
    pelvis.add(hipJ);
    groups[side < 0 ? 'lHip' : 'rHip'] = hipJ;

    const thigh = m4();
    thigh.position.set(0, -R_THIGH_LEN / 2, 0);
    thigh.scale.set(1.28, R_THIGH_LEN / R_LEG_GEO_LEN, 1.28);
    hipJ.add(thigh);
    parts[side < 0 ? 'thighL' : 'thighR'] = thigh;

    const kneeJ = new THREE.Group();
    kneeJ.position.set(0, -R_THIGH_LEN, 0);
    hipJ.add(kneeJ);
    groups[side < 0 ? 'lKnee' : 'rKnee'] = kneeJ;

    const shin = m4();
    shin.position.set(0, -R_SHIN_LEN / 2, 0);
    shin.scale.set(1.08, R_SHIN_LEN / R_LEG_GEO_LEN, 1.08);
    kneeJ.add(shin);
    parts[side < 0 ? 'shinL' : 'shinR'] = shin;

    const shoe = m4();
    shoe.position.set(0, -R_SHIN_LEN + 0.03, 0.04);
    shoe.scale.set(1.4, 0.75, 1.4);
    kneeJ.add(shoe);
    parts[side < 0 ? 'shoeL' : 'shoeR'] = shoe;
  }

  // Torso + arms + head
  const torso = new THREE.Group();
  pelvis.add(torso);
  groups.torso = torso;

  const torsoMesh = m4();
  torso.add(torsoMesh);
  parts.torso = torsoMesh;

  const neck = m4();
  neck.position.set(0, 0.545, 0);
  torso.add(neck);
  parts.neck = neck;

  for (const side of [-1, 1] as const) {
    const shoulderJ = new THREE.Group();
    shoulderJ.position.set(side * R_SHOULDER_X, R_SHOULDER_Y, 0);
    torso.add(shoulderJ);
    groups[side < 0 ? 'lShoulder' : 'rShoulder'] = shoulderJ;

    const upper = m4();
    upper.position.set(0, -R_UPPER_ARM_LEN / 2, 0);
    upper.scale.set(1, R_UPPER_ARM_LEN / R_ARM_GEO_LEN, 1);
    shoulderJ.add(upper);
    parts[side < 0 ? 'upperArmL' : 'upperArmR'] = upper;

    const elbowJ = new THREE.Group();
    elbowJ.position.set(0, -R_UPPER_ARM_LEN, 0);
    shoulderJ.add(elbowJ);
    groups[side < 0 ? 'lElbow' : 'rElbow'] = elbowJ;

    const fore = m4();
    fore.position.set(0, -R_FOREARM_LEN / 2, 0);
    fore.scale.set(0.88, R_FOREARM_LEN / R_ARM_GEO_LEN, 0.88);
    elbowJ.add(fore);
    parts[side < 0 ? 'forearmL' : 'forearmR'] = fore;
  }

  const headJ = new THREE.Group();
  headJ.position.set(0, R_NECK_Y, 0);
  torso.add(headJ);
  groups.head = headJ;
  const headInner = new THREE.Group();
  headInner.position.set(0, R_HEAD_LIFT, 0);
  headJ.add(headInner);
  const headMesh = m4();
  headInner.add(headMesh);
  parts.head = headMesh;

  refApplyPose(groups, sitPose());
  root.updateWorldMatrix(true, true);
  return parts;
}

function matricesClose(a: THREE.Matrix4, b: THREE.Matrix4, eps = EPS): boolean {
  for (let i = 0; i < 16; i++) {
    if (Math.abs(a.elements[i]! - b.elements[i]!) > eps) return false;
  }
  return true;
}

test('SIT_PART_KEYS covers exactly the 14 seated body meshes', () => {
  assert.equal(SIT_PART_KEYS.length, 14);
  assert.equal(new Set(SIT_PART_KEYS).size, 14); // no dupes
});

test('buildSitBakedLocals is deterministic (same matrices every call)', () => {
  const a = buildSitBakedLocals();
  const b = buildSitBakedLocals();
  for (const k of SIT_PART_KEYS) {
    assert.ok(matricesClose(a[k], b[k]), `part ${k} differs between builds`);
  }
});

test('baked locals equal the reference rig at the identity root (pixel-identity core)', () => {
  const baked = buildSitBakedLocals();
  const root = new THREE.Group(); // identity
  const ref = buildReferenceRig(root);
  for (const k of SIT_PART_KEYS) {
    // ref leaf world under an identity root IS its figure-root-local matrix.
    assert.ok(
      matricesClose(baked[k], ref[k].matrixWorld),
      `baked ${k} diverged from the figure's real sit-pose local matrix`,
    );
  }
});

test('seatRootMatrix × baked reproduces an individual figure placed at that seat', () => {
  const baked = buildSitBakedLocals();
  // A few representative seat placements (position + heading).
  const seats: Array<[number, number, number]> = [
    [0, 0, 0],
    [3.5, -2.1, Math.PI / 3],
    [-4.2, 1.7, -2.4],
    [1.0, 6.3, Math.PI],
  ];
  for (const [x, z, faceY] of seats) {
    // Reference: mount the whole rig under a root placed at the seat.
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), faceY);
    const ref = buildReferenceRig(root);
    const seatRoot = seatRootMatrix(x, z, faceY);
    for (const k of SIT_PART_KEYS) {
      const instanced = seatRoot.clone().multiply(baked[k]);
      assert.ok(
        matricesClose(instanced, ref[k].matrixWorld, 1e-8),
        `instanced ${k} != individual at seat (${x},${z},${faceY})`,
      );
    }
  }
});

test('seatedFigureMatrix matches the nested table→seat→nudge groups', () => {
  const baked = buildSitBakedLocals();
  const homeX = 2.0;
  const homeZ = -3.0;
  const tableFaceY = -0.5; // e.g. -rotationDeg in radians
  const seatX = 0.9;
  const seatZ = 0.4;
  const seatFaceY = 1.1;

  // Reference: the exact JSX nesting — table group → seat group → nudge (−0.04,
  // π flip) → figure root — built as real THREE groups.
  const table = new THREE.Group();
  table.position.set(homeX, 0, homeZ);
  table.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tableFaceY);
  const seat = new THREE.Group();
  seat.position.set(seatX, 0, seatZ);
  seat.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), seatFaceY);
  table.add(seat);
  const nudge = new THREE.Group();
  nudge.position.set(0, 0, -0.04);
  nudge.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  seat.add(nudge);
  const figRoot = new THREE.Group();
  nudge.add(figRoot);
  const ref = buildReferenceRig(figRoot);

  const rootMatrix = seatedFigureMatrix({ homeX, homeZ, tableFaceY, seatX, seatZ, seatFaceY });
  for (const k of SIT_PART_KEYS) {
    const instanced = rootMatrix.clone().multiply(baked[k]);
    assert.ok(
      matricesClose(instanced, ref[k].matrixWorld, 1e-8),
      `instanced ${k} != nested-group individual`,
    );
  }
});

test('table-local seatedFigureMatrix under an animated table group == the full world matrix', () => {
  // The couple lab mounts <InstancedSeatedCrowd> INSIDE each table's animated
  // <group> and feeds TABLE-LOCAL matrices (seatedFigureMatrix with an identity
  // table: homeX/homeZ 0, tableFaceY 0). The parent group carries the table's
  // home position + rotation (and a transient drag-pop scale). This proves that
  // parentGroupMatrix × tableLocalMatrix reproduces the full-world
  // seatedFigureMatrix(home, tableFaceY, seat) the public walk uses — so a lab
  // instance lands exactly where the individual <SeatedAvatar> (same nesting)
  // did, at rest AND while the group is scaled mid-drag.
  const homeX = 2.0;
  const homeZ = -3.0;
  const tableFaceY = -0.5;
  const seatX = 0.9;
  const seatZ = 0.4;
  const seatFaceY = 1.1;

  const tableLocal = seatedFigureMatrix({ homeX: 0, homeZ: 0, tableFaceY: 0, seatX, seatZ, seatFaceY });
  const full = seatedFigureMatrix({ homeX, homeZ, tableFaceY, seatX, seatZ, seatFaceY });

  for (const scale of [1, 1.06]) {
    // The parent <group ref> world matrix: home position, table yaw, uniform
    // scale (rest = 1, drag pop = 1.06 — scale hits both paths identically).
    const parent = new THREE.Matrix4().compose(
      new THREE.Vector3(homeX, 0, homeZ),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), tableFaceY),
      new THREE.Vector3(scale, scale, scale),
    );
    const composed = parent.clone().multiply(tableLocal);
    // At scale 1 the composed world equals the full matrix exactly; the scaled
    // case must equal the full matrix likewise scaled about the table origin.
    const expected =
      scale === 1
        ? full.clone()
        : parent.clone().multiply(new THREE.Matrix4().compose(
            new THREE.Vector3(-homeX, 0, -homeZ),
            new THREE.Quaternion(),
            new THREE.Vector3(1, 1, 1),
          )).multiply(full).clone();
    // Simpler invariant at rest (the load-bearing one for the settle handoff):
    if (scale === 1) {
      assert.ok(matricesClose(composed, expected, 1e-8), 'table-local × parent != full world matrix at rest');
    } else {
      // Under a uniform parent scale, both the batch and an individual figure are
      // children of the SAME group, so they scale identically — assert the batch
      // instance matches an individual figure mounted under that same scaled group.
      const g = new THREE.Group();
      g.position.set(homeX, 0, homeZ);
      g.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tableFaceY);
      g.scale.setScalar(scale);
      const seat = new THREE.Group();
      seat.position.set(seatX, 0, seatZ);
      seat.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), seatFaceY);
      g.add(seat);
      const nudge = new THREE.Group();
      nudge.position.set(0, 0, -0.04);
      nudge.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
      seat.add(nudge);
      const figRoot = new THREE.Group();
      nudge.add(figRoot);
      g.updateWorldMatrix(true, true);
      assert.ok(
        matricesClose(composed, figRoot.matrixWorld, 1e-8),
        'table-local instance != individual figure under the same scaled table group',
      );
    }
  }
});

test('instanceColorFor mirrors the mannequin tint rule (tint → colour, else white)', () => {
  const white = new THREE.Color('#ffffff');
  // Neutral strangers (null / empty / bad hex) → white.
  for (const bad of [null, undefined, '', 'red', '#fff', '#12g456']) {
    assert.deepEqual(instanceColorFor(bad as string | null).toArray(), white.toArray(), `${bad} should be white`);
  }
  // Valid tint → exactly that colour (what setColorAt writes per instance).
  const tint = '#c0a062';
  assert.deepEqual(instanceColorFor(tint).toArray(), new THREE.Color(tint).toArray());
});
