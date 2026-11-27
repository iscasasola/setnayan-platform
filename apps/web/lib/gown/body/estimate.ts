/**
 * 👗 gown/body/estimate — starting numbers for the gown's own measurements, measured on the solved mannequin (cm,
 * to the half). Her tape replaces them; each stays tagged "estimate" until it does (prototype v186 `estMeas`).
 *
 * This step ports the estimates that read the body alone. The ones that run a tape down the dress's body table
 * (nape to waist, front length, hollow to hem, waist to hem) need the dress layer and land with it in step A5.
 *
 * Kept as v186 behaves: its hip-line "waist to hip" sits inside a code comment, so v186 always uses its fall-back
 * (natural waist to the hip joint + 3 cm). That fall-back is what is ported here; changing it is a separate decision.
 */
import * as THREE from 'three';
import type { GownMeasureKey } from '../../gown-config';
import { jointP, jointY } from './bones';
import { BODY_K } from './constants';
import type { GownRig } from './rig';
import { apexOf, hullLen, ringPoints } from './tape';

export type GownBodyEstimates = Partial<Record<GownMeasureKey, number>>;

const half = (x: number) => Math.round(x * 2) / 2;

export function estimateGownMeasures(B: GownRig): GownBodyEstimates {
  const o: GownBodyEstimates = {};
  const S = B.P.S * 100, k = BODY_K, v = B.vals, yN = jointY(B, 'neck01'), yW = k.yWaist;
  const J = (s: string) => jointP(B, s, new THREE.Vector3());
  let floor = 1e9;
  for (let i = 1; i < B.n * 3; i += 3) if (B.V[i]! < floor) floor = B.V[i]!;
  const a = apexOf(B, 1), b = apexOf(B, -1);
  if (a && b) {
    o.apexApex = a.distanceTo(b) * S;
    o.shoulderApex = new THREE.Vector3(0.055, yN, B.zcAt(yN)).distanceTo(a) * S * 1.04;
  }
  o.neck = hullLen(ringPoints(B, yN + 0.01, 1)[0]!) * S * 1.04;
  const sh = J('upperarm01.L'), el = J('lowerarm01.L'), wr = J('wrist.L');
  o.upperArm = v.bust * 0.31;
  o.armhole = o.upperArm * 1.45;
  o.elbow = o.upperArm * 0.86;
  o.wrist = (15 * (v.height || 160)) / 165;
  o.armBent = (sh.distanceTo(el) + el.distanceTo(wr)) * S * 1.04;
  o.thigh = v.hips * 0.58;
  o.knee = v.hips * 0.38;
  o.waistFloor = (yW - floor) * S;
  o.waistHip = (yW - jointY(B, 'upperleg01.L') + 0.03) * S;
  {
    // v179: the block measurements (the tape runs over the armpit folds to the arm creases). Across back and chest from
    // her shoulder width, by the ratios in Aldrich's size chart (bust 88: 34.4 and 32.4 cm).
    const yJ = jointY(B, 'upperarm01.L'), yUa = yJ - 0.075, nape = yN + 0.035, shM = (v.shoulders || 36) / S, V = B.V;
    o.acrossBack = 0.95 * (v.shoulders || 36);
    o.acrossChest = 0.89 * (v.shoulders || 36) + 0.06 * ((v.bust || 88) - 88);
    o.sideLen = (yUa - yW) * S;
    // The crest of the shoulder, below the nape: never up the neck.
    const top = (x0: number) => {
      let t = -1e9;
      for (let i = 0; i < B.n; i++) {
        if (B.hw[i]! > 0.2) continue;
        const x = V[i * 3]!, y = V[i * 3 + 1]!;
        if (x <= 0 || Math.abs(x - x0) > 0.005 || Math.abs(V[i * 3 + 2]! - B.zcAt(y)) > 0.06 || y > nape) continue;
        if (y > t) t = y;
      }
      return t;
    };
    const xn = o.neck / 1.04 / (2 * Math.PI) / S, xa = shM / 2, yn = top(xn + 0.005), ya = top(xa - 0.01);
    // A straight line, neck point to shoulder tip (as the block draws it).
    o.shoulderLen = Math.hypot(xa - xn, yn > -1e8 && ya > -1e8 ? yn - ya : 0) * S;
  }
  for (const key of Object.keys(o) as GownMeasureKey[]) o[key] = Number.isFinite(o[key]) ? half(o[key]!) : 0;
  return o;
}
