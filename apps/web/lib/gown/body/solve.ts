/**
 * 👗 gown/body/solve — typed centimetres in, a body that measures the same out (prototype v186 `solveG`, `bodyKg`,
 * `fitBuild`, `balanceKg`). Lengths are bones only; girths are morph → skin → tape → correct, until every tape is
 * within 0.08 cm. Then the build fills out or slims down until the body weighs her weight (or the estimate).
 *
 * Owner rules: the bust grows inside the breast's base, never the ribs (v165/v185); weight stays true while bust,
 * waist and hips are set (v185); BMI 10–62.
 */
import * as THREE from 'three';
import type { GownBodyKey, GownBodyVals } from '../../gown-config';
import { GOWN_ATHLETIC_KG, GOWN_LEG_SHARE, gownEstimateKg, gownEstimateShoulders, gownFatPercent, gownLimit, gownShapedVals } from '../body-rules';
import { computeBones, jointP, jointY } from './bones';
import { BODY_K, BODY_KG_CALIBRATION, BUILD_MAX, BUILD_MIN, BUST_POS, CUP_MAX_STEP, CUP_MIN, HEAD_SHARE, RIB_REST } from './constants';
import { bodyNormals, morph } from './shape';
import { clamp, type GownRig } from './rig';
import { skin } from './skin';
import { hullLen, measure, ringPoints } from './tape';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const given = (B: GownRig, k: GownBodyKey) => B.fine.given.includes(k);

/** The weight the build is fitted to: hers when she gave it, else the estimate (athletic: muscle weighs more). */
export function weightTarget(B: GownRig): number {
  return given(B, 'weight') ? B.vals.weight : gownEstimateKg(B.vals) * (B.fine.athletic ? GOWN_ATHLETIC_KG : 1);
}

/**
 * The body as built weighs: its volume × the density of a body with her fat share (Siri), less about 2.5 L of air in
 * the lungs, × the mannequin calibration (`BODY_KG_CALIBRATION`).
 */
export function bodyKg(B: GownRig): number {
  const ix = B.geo.index!.array, V = B.V;
  let s = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t]! * 3, b = ix[t + 1]! * 3, c = ix[t + 2]! * 3;
    s += V[a]! * (V[b + 1]! * V[c + 2]! - V[b + 2]! * V[c + 1]!) - V[a + 1]! * (V[b]! * V[c + 2]! - V[b + 2]! * V[c]!) + V[a + 2]! * (V[b]! * V[c + 1]! - V[b + 1]! * V[c]!);
  }
  return ((Math.max(0, (s / 6) * B.P.S ** 3 * 1000 - 2.5) * 495) / (gownFatPercent(B.vals, B.fine.athletic) + 450)) * BODY_KG_CALIBRATION;
}

/** v186 `solveG`: fit the bones to her lengths and the girths to her tape. Mutates the rig; returns what the tape read (cm). */
export function solveBody(B: GownRig): GownRig['got'] {
  B.ver++;
  const P = B.P, v: GownBodyVals = gownShapedVals(B.vals, B.shape), k = BODY_K, H = v.height / 100;
  {
    // v171: the bust position anywhere between the three.
    const t = clamp(B.fine.bustT || 0, -1, 1), e = t < 0 ? BUST_POS.high : BUST_POS.low, u = Math.abs(t);
    P.bY = e[0] * u; P.bA = e[1] * u;
  }
  // v167/v189: until she gives them, shoulders follow her height and her ribcage (the one estimate, in body-rules).
  if (!given(B, 'shoulders')) B.vals.shoulders = gownEstimateShoulders(B.vals, B.fine.athletic);
  // v169: her build comes from the weight fit; the first guess from her measurements.
  P.f = B.fFix ? B.fFix : clamp(Math.sqrt(gownEstimateKg(B.vals) / (H * H) / k.bmiRef), BUILD_MIN, BUILD_MAX);
  for (let it = 0; it < 8; it++) {
    // Lengths: bones only. Every length is a share of height, so height scales the whole figure together.
    computeBones(B, null);
    const sole = Math.min(jointY(B, 'foot.L'), jointY(B, 'foot.R')) - B.cSole, hipY = jointY(B, 'upperleg01.L'), footY = jointY(B, 'foot.L');
    P.S = H / (jointY(B, 'head') + B.cTop * P.hs - sole);
    P.hs = clamp((H * HEAD_SHARE) / (P.S * B.headLen), 0.75, 1.25);
    P.kleg = clamp((P.kleg * ((v.leg * GOWN_LEG_SHARE * H) / P.S - B.cSole)) / (hipY - footY), 0.55, 1.3);
    jointP(B, 'upperarm01.L', _a); jointP(B, 'lowerarm01.L', _b); jointP(B, 'wrist.L', _c);
    P.karm = clamp((P.karm * ((v.arm * B.armR * H) / P.S)) / (_a.distanceTo(_b) + _b.distanceTo(_c)), 0.6, 1.7);
    const xc = B.rp[B.ix['clavicle.L']!]!.x, half = (v.shoulders / 100 / P.S - k.acro) / 2;
    P.ks = clamp((P.ks * (half - xc)) / (_a.x - xc), 0.5, 1.6); // v167: room for narrow shoulders (21 % of height)
  }
  let pb: number | null = null, pm = 0, stuck = false;
  P.cR = RIB_REST;
  for (let it = 0; it < 20; it++) {
    // Girths: morph, skin, measure, correct.
    P.sTop = 0.5 * (P.sUb * P.cR + 1 + (P.f - 1) * 0.35);
    computeBones(B, null); morph(B); skin(B);
    const m = measure(B), c = P.S * 100;
    const eH = v.hips - m.hips * c, eW = v.waist - m.waist * c, eB = v.bust - m.bust * c, eU = v.underbust - m.underbust * c;
    B.got = { bust: m.bust * c, waist: m.waist * c, hips: m.hips * c, underbust: m.underbust * c };
    // v176: mid-neck girth from her weight (about 26 + 0.33 × BMI).
    let eN = 0;
    {
      const yNk = jointY(B, 'neck01') + 0.026, nG = hullLen(ringPoints(B, yNk, 1)[0]!) * c, nT = 26 + (0.33 * weightTarget(B)) / (H * H);
      if (nG > 0) { eN = nT - nG; P.nk = clamp(((P.nk || 1 + (P.f - 1) * 0.45) * nT) / nG, 0.7, 1.8); }
      B.got.neck = nG;
    }
    if (Math.max(Math.abs(eH), Math.abs(eW), Math.abs(eB), Math.abs(eU), Math.abs(eN) / 4) < 0.08) break;
    P.sHip = clamp((P.sHip * v.hips) / (m.hips * c), 0.75, 2.8);
    P.gB = clamp(P.gB + (v.waist / (m.waist * c) - 1) / 0.7, -0.32, 3);
    const uOk = Math.abs(eU) < 0.3;
    P.sUb = clamp((P.sUb * v.underbust) / (m.underbust * c), 0.6, 2.8);
    let slope = 17;
    if (pb !== null && Math.abs(P.b - pb) > 1e-3 && uOk) { const s = (m.bust * c - pm) / (P.b - pb); if (s > 3) slope = s; }
    // v165: only when the breasts alone cannot reach the tape does the upper ribcage give — and only to ease in.
    if (stuck) P.cR = clamp((P.cR * v.bust) / (m.bust * c), 0.7, RIB_REST);
    else {
      pb = P.b; pm = m.bust * c;
      const nb2 = P.b + clamp(eB / slope, -0.5, 0.5);
      P.b = clamp(nb2, CUP_MIN, CUP_MAX_STEP);
      if (nb2 !== P.b && uOk) stuck = true;
    }
  }
  (B.posAttr.array as Float32Array).set(B.cur);
  B.posAttr.needsUpdate = true;
  bodyNormals(B);
  B.heelDrawn = 0;
  B.neutral = { knee: jointY(B, 'lowerleg01.L'), ankle: jointY(B, 'foot.L') };
  return B.got;
}

/**
 * v185: her weight is set before bust, waist and hips; when she sets one (`B.bal`), the ones she has not set give or
 * take so her weight stays true. Returns the girths that moved, or null.
 */
export function balanceWeight(B: GownRig): GownBodyKey[] | null {
  const s = B.bal;
  B.bal = null;
  if (!s || !given(B, 'weight') || !(B.fFix > 0)) return null;
  const v = B.vals, free = (['bust', 'waist', 'hips'] as const).filter((k) => k !== s && !given(B, k));
  if (!free.length) return null;
  const target = v.weight, base = Object.fromEntries(free.map((k) => [k, v[k]])) as Record<(typeof free)[number], number>;
  const set = (r: number) => {
    for (const k of free) { const [a, b] = gownLimit(v, k); v[k] = clamp(Math.round(base[k] * r * 10) / 10, a, b); }
    solveBody(B);
    return bodyKg(B);
  };
  let r = 1, W = set(1), slope = Math.max(5, W);
  for (let it = 0; it < 5 && Math.abs(target - W) > 0.3; it++) {
    const r2 = clamp(r + (target - W) / slope, 0.7, 1.4);
    if (Math.abs(r2 - r) < 1e-3) break;
    const W2 = set(r2);
    if (Math.abs(W2 - W) > 1e-3) slope = Math.max(5, (W2 - W) / (r2 - r));
    r = r2; W = W2;
  }
  const ch = free.filter((k) => Math.abs(v[k] - base[k]) >= 0.5);
  return ch.length ? ch : null;
}

/**
 * v169 `fitBuild`: arms, legs, neck and the soft areas fill out or slim down until the body weighs her weight (or the
 * estimate); the tape stays exact. Until she gives her weight it reads the body's. Returns whether the body changed
 * and which girths the weight balance moved (for the "her weight stays" note).
 */
export function fitWeight(B: GownRig): { moved: boolean; balanced: GownBodyKey[] | null } {
  const balanced = balanceWeight(B);
  const target = weightTarget(B);
  let f = B.P.f, W = bodyKg(B), slope = Math.max(5, (0.9 * W) / f), moved = !!balanced;
  for (let it = 0; it < 6 && Math.abs(target - W) > 0.5; it++) {
    const f2 = clamp(f + (target - W) / slope, BUILD_MIN, BUILD_MAX);
    if (Math.abs(f2 - f) < 1e-3) break;
    B.fFix = f2;
    solveBody(B);
    const W2 = bodyKg(B);
    if (Math.abs(W2 - W) > 1e-3) slope = Math.max(5, (W2 - W) / (f2 - f));
    f = f2; W = W2; moved = true;
  }
  B.kg = Math.round(W * 10) / 10;
  B.kgTarget = target;
  if (!given(B, 'weight')) B.vals.weight = Math.round(W);
  return { moved, balanced };
}

/**
 * Once, when the body is first built (v186 load): the natural arm — fingertip to fingertip equals her height at the
 * default shoulders. Every later arm length is a share of this.
 */
export function calibrateArm(B: GownRig): void {
  solveBody(B);
  const H = B.vals.height / 100, sx = jointP(B, 'upperarm01.L', _a).x;
  B.armR = (H - B.P.S * 2 * (sx + B.handLen)) / (2 * H);
}

/** Solve and fit the weight in one go (the prototype's `solve(B, true)`): what a test, a send and a re-fit call. */
export function solveGownBody(B: GownRig): GownRig['got'] {
  solveBody(B);
  fitWeight(B);
  return B.got;
}
