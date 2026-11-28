/**
 * 👗 gown/body/bones — lengths by scaling along each bone, poses by rotating real joints (prototype v186 `computeBones`).
 * A scaled bone moves its child's joint but does not pass the stretch on, so a bent elbow stays round.
 */
import * as THREE from 'three';
import type { GownRig } from './rig';

const ONE = new THREE.Vector3(1, 1, 1);
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m4 = new THREE.Matrix4(), _q3m = new THREE.Matrix4();
const _t = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** A pose: per bone, its rotation in the bone's own rest frame (null = rest). */
export type GownPose = (THREE.Quaternion | null)[] | null;

export function computeBones(B: GownRig, pose: GownPose, heelAngle = 0): void {
  const P = B.P, ix = B.ix;
  B.heelA = pose ? heelAngle : 0; // v186: heels are part of the pose (never while the body is being fitted)
  for (const v of B.own) v.set(1, 1, 1);
  for (const sd of ['L', 'R']) {
    for (const s of ['upperleg01', 'upperleg02', 'lowerleg01', 'lowerleg02']) B.own[ix[`${s}.${sd}`]!]!.y = P.kleg;
    for (const s of ['upperarm01', 'upperarm02', 'lowerarm01', 'lowerarm02']) B.own[ix[`${s}.${sd}`]!]!.y = P.karm;
    for (const s of ['clavicle', 'shoulder01']) B.own[ix[`${s}.${sd}`]!]!.y = P.ks;
  }
  B.own[ix.head!]!.setScalar(P.hs);
  if (ix.jaw! >= 0) B.own[ix.jaw!]!.setScalar(P.hs);
  // Breast mass: scale and move the two breast bones. v165: bigger than average grows inside the breast's base (morph).
  {
    const g = Math.min(0, P.b - 1), bp = B.breastP, sU = P.sUb, zc = B.zcAt(bp.y);
    for (const sd of ['L', 'R']) {
      const i = ix[`breast.${sd}`]!, sg = sd === 'L' ? 1 : -1, par = B.parent[i]!;
      const X = sg * bp.x * sU, Y = bp.y, Z = zc + (bp.z - zc) * sU;
      _m.makeTranslation(X + sg * 0.008 * g, Y - 0.03 * g + (P.bY || 0), Z).multiply(_m2.makeScale(1 + 0.75 * g, 1 + 0.8 * g, 1 + g)).multiply(_m2.makeTranslation(-X, -Y, -Z));
      if (P.bA) {
        // Higher or lower bust: tilt about the upper attachment.
        const pY = Y + 0.045, pZ = zc + (Z - zc) * 0.2;
        _m2.makeTranslation(0, pY, pZ).multiply(_q3m.makeRotationX(P.bA)).multiply(_m4.makeTranslation(0, -pY, -pZ));
        _m.premultiply(_m2);
      }
      B.over[i] = (B.over[i] || new THREE.Matrix4()).copy(B.rw[par]!).invert().multiply(_m).multiply(B.rw[i]!);
    }
  }
  for (let i = 0; i < B.nb; i++) {
    const p = B.parent[i]!, sp = p >= 0 ? B.own[p]! : ONE, m = B.bones[i]!.matrix;
    const over = B.over[i];
    if (over) m.copy(over);
    else {
      _t.copy(B.restPos[i]!).multiply(sp);
      _q.copy(B.restQuat[i]!);
      const pq = pose && pose[i];
      if (pq) { _q2.copy(B.rwqInv[i]!).multiply(pq).multiply(B.rwq[i]!); _q.multiply(_q2); }
      if (P.clv && (i === ix['clavicle.L'] || i === ix['clavicle.R'])) {
        // v177: the collarbones lift a little at the shoulder tip.
        _q3.setFromAxisAngle(Z_AXIS, (i === ix['clavicle.L'] ? 1 : -1) * P.clv);
        _q2.copy(B.rwqInv[i]!).multiply(_q3).multiply(B.rwq[i]!);
        _q.multiply(_q2);
      }
      m.compose(_t, _q, B.own[i]!);
      if (sp.x !== 1 || sp.y !== 1 || sp.z !== 1) m.premultiply(_m.makeScale(1 / sp.x, 1 / sp.y, 1 / sp.z));
    }
    if (p >= 0) B.mw[i]!.multiplyMatrices(B.mw[p]!, m);
    else B.mw[i]!.copy(m);
    _m2.multiplyMatrices(B.mw[i]!, B.inv[i]!).toArray(B.bm, i * 16);
  }
}

export const jointY = (B: GownRig, s: string) => B.mw[B.ix[s]!]!.elements[13]!;
export const jointP = (B: GownRig, s: string, o: THREE.Vector3) => o.setFromMatrixPosition(B.mw[B.ix[s]!]!);
