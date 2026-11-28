/**
 * 👗 gown/body/estimate — starting numbers for the gown's own measurements, measured on the solved mannequin (cm,
 * to the half). Her tape replaces them; each stays tagged "estimate" until it does (prototype v186 `estMeas`).
 *
 * This step ports the estimates that read the body alone. Given her envelope (A8), nape to waist and front length run a
 * tape down the body surface as v186 does. Hollow to hem and waist to hem read the gown's hem and land with the quote.
 *
 * Waist to hip: the prototype's hip-line version sits inside a code comment, so it always uses its fall-back (natural
 * waist to the hip joint + 3 cm), and so does this port. KNOWN OPEN ITEM (coordinator, 27 Nov): the estimate runs long,
 * about +3 cm (23.5 cm at 155 cm, where a real woman measures about 19–20 cm). The hip line measured worse (26 cm), so
 * the fall-back stays. It is only a faded estimate: her tape, and the designer's, replace it.
 */
import * as THREE from 'three';
import type { GownMeasureKey } from '../../gown-config';
import { jointP, jointY } from './bones';
import { BODY_K } from './constants';
import type { GownRig } from './rig';
import { RING_N, TAU } from './constants';
import { clamp } from './rig';
import { lerpRow, type GownEnvelope } from '../dress/table';
import { apexOf, hullLen, ringPoints } from './tape';

export type GownBodyEstimates = Partial<Record<GownMeasureKey, number>>;

const half = (x: number) => Math.round(x * 2) / 2;

export function estimateGownMeasures(B: GownRig, T?: GownEnvelope): GownBodyEstimates {
  const o: GownBodyEstimates = {};
  const S = B.P.S * 100, k = BODY_K, v = B.vals, yN = jointY(B, 'neck01'), yW = k.yWaist;
  const J = (s: string) => jointP(B, s, new THREE.Vector3());
  let floor = 1e9;
  for (let i = 1; i < B.n * 3; i += 3) if (B.V[i]! < floor) floor = B.V[i]!;
  if (T && T.n) {
    // A tape laid down the body surface, in one column of her envelope (v186 `surf`).
    const DY = 0.01, surf = (q: number, y0: number, y1: number) => {
      let L = 0, prev: THREE.Vector3 | null = null;
      for (let i = 0; i <= 24; i++) {
        const y = y0 + ((y1 - y0) * i) / 24, yy = clamp(y, T.y0, T.y0 + (T.n - 2) * DY), r = lerpRow(T, T.H, yy, q), ph = (q * TAU) / RING_N, zc = B.zcAt(Math.max(y, T.yF));
        const p = new THREE.Vector3(r * Math.sin(ph), y, zc + r * Math.cos(ph));
        if (prev) L += p.distanceTo(prev);
        prev = p;
      }
      return L * S;
    };
    // The nape bone and the shoulder-neck point sit about 3.5 cm above the neck joint.
    o.napeWaist = surf(RING_N / 2, yN + 0.035, yW);
    o.frontLen = surf(Math.round(RING_N * 0.06), yN + 0.035, yW) * 1.04;
  }
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
