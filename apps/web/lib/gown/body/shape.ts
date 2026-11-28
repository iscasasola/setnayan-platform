/**
 * 👗 gown/body/shape — girths: one smooth scale profile up the body, applied to the bind-pose vertices, plus the soft
 * fullness and a fuller cup (prototype v186 `morph`, `bodyNormals`).
 */
import { BODY_K, BREAST, FAT, HIP_TO_WAIST_DY, HIP_TO_WAIST_SHARE, PROFILE_DY, PROFILE_N, SEAT_BASE, SEAT_MAX, THIGH_GAP } from './constants';
import { clamp, smoothstep, type GownRig } from './rig';

const PROF = new Float32Array(PROFILE_N), BELLY = new Float32Array(PROFILE_N), BUTT = new Float32Array(PROFILE_N);

export function morph(B: GownRig): void {
  const P = B.P, k = BODY_K, f = P.f, ank = B.rp[B.ix['foot.L']!]!.y, knee = B.rp[B.ix['lowerleg01.L']!]!.y;
  const hipJy = B.rp[B.ix['upperleg01.L']!]!.y;
  const ys = [0.03, ank + 0.12, knee + 0.08, (hipJy + knee) / 2 - 0.02, hipJy - 0.12, k.yHip, k.yHip + HIP_TO_WAIST_DY, k.belly[1] + 0.02, k.yUb, k.yCh, k.yChestTop, k.yTop, k.yNeck];
  // v169: waist-to-hip ratio decides how much goes to the belly.
  const apple = smoothstep(B.vals.waist / Math.max(1, B.vals.hips), 0.76, 0.95);
  const fz0 = !B.fine.athletic ? clamp((f - FAT.from) / (1.65 - FAT.from), 0, 1.6) : 0;
  const pinch = 1 - FAT.waistIn * fz0 * apple;
  const waistVal = 0.5 * (P.sHip + P.sUb) * (P.gB < 0 ? 1 + P.gB : 1 + 0.15 * P.gB) * pinch;
  const vs = [
    1 + (f - 1) * 0.5, f, f, f + 0.55 * (P.sHip - f), P.sHip, P.sHip,
    waistVal + HIP_TO_WAIST_SHARE * (P.sHip - waistVal), // v188: the hip curves into the waist
    waistVal, P.sUb,
    P.sUb * P.cR, P.sUb * P.cR, P.sTop, P.nk || 1 + (f - 1) * 0.45, // v176: the neck is fitted to her weight
  ];
  for (let j = 0; j < PROFILE_N; j++) {
    const y = j * PROFILE_DY;
    let v = vs[vs.length - 1]!;
    if (y <= ys[0]!) v = vs[0]!;
    else {
      for (let i = 1; i < ys.length; i++) {
        if (y < ys[i]!) {
          // One continuous curve through the control heights (no flat spots, no bands).
          const h = ys[i]! - ys[i - 1]!, t = (y - ys[i - 1]!) / h;
          const m0 = i > 1 ? (vs[i]! - vs[i - 2]!) / (ys[i]! - ys[i - 2]!) : 0;
          const m1 = i < ys.length - 1 ? (vs[i + 1]! - vs[i - 1]!) / (ys[i + 1]! - ys[i - 1]!) : 0;
          const t2 = t * t, t3 = t2 * t;
          v = (2 * t3 - 3 * t2 + 1) * vs[i - 1]! + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * vs[i]! + (t3 - t2) * h * m1;
          break;
        }
      }
    }
    PROF[j] = v - 1;
    // v169: one broad dome, pubic line to under the bust; the underside curves back in above the thighs.
    const [b0, b1, b2] = k.belly;
    BELLY[j] = y <= b0 || y >= b2 ? 0 : 0.5 * (1 + Math.cos(Math.PI * (y < b1 ? (b1 - y) / (b1 - b0) : (y - b1) / (b2 - b1))));
    if (y < b1) BELLY[j] = BELLY[j]! * BELLY[j]!;
  }
  const gB = Math.max(0, P.gB), hB = clamp(SEAT_BASE + 0.35 * (P.sHip - 1), 0, SEAT_MAX), hF = -0.45 * clamp(P.sHip - 1, 0, 1), yS = k.yHip + 0.02;
  for (let j = 0; j < PROFILE_N; j++) {
    const y = j * PROFILE_DY, d = y > yS ? (y - yS) / 0.26 : (yS - y) / 0.16;
    BUTT[j] = d >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * d)); // seat fullness at the back
  }
  const gM = Math.max(0, P.b - 1), BM = B.bMask, FW = B.fatW;
  const fz = !B.fine.athletic ? clamp((f - FAT.from) / (1.65 - FAT.from), 0, 1.6) : 0, lowK = 0.5 + apple;
  const a = B.cur, p0 = B.pos0, fa = f - 1;
  const last = PROFILE_N - 2;
  for (let i = 0; i < B.n; i++) {
    const x = p0[i * 3]!, y = p0[i * 3 + 1]!, z = p0[i * 3 + 2]!;
    const fy = clamp(y / PROFILE_DY, 0, last), j = fy | 0, u = fy - j;
    const s = (PROF[j]! + (PROF[j + 1]! - PROF[j]!) * u + gB * (BELLY[j]! + (BELLY[j + 1]! - BELLY[j]!) * u) * B.bA[i]! + (BUTT[j]! + (BUTT[j + 1]! - BUTT[j]!) * u) * (hB * B.bk[i]! + hF * B.bf[i]!)) * B.nonArm[i]!;
    let nx = x + s * (x - B.px[i]!) + fa * B.aperp[i * 3]!;
    const inr = B.inner[i]!;
    if (inr) {
      // Inner thighs come together softly, never through each other.
      const sg = x < 0 ? -1 : 1, v = sg * nx;
      if (v < THIGH_GAP) nx += inr * (sg * THIGH_GAP * Math.exp((v - THIGH_GAP) / THIGH_GAP) - nx);
    }
    a[i * 3] = nx;
    a[i * 3 + 1] = y + fa * B.aperp[i * 3 + 1]!;
    a[i * 3 + 2] = z + s * (z - B.pz[i]!) + fa * B.aperp[i * 3 + 2]!;
    if (fz > 0) {
      const w0 = FW[i * 4]!, w1 = FW[i * 4 + 1]!, w2 = FW[i * 4 + 2]!, w3 = FW[i * 4 + 3]!;
      if (w0 || w1 || w2 || w3) {
        const dx = a[i * 3]! - B.px[i]!, dz2 = a[i * 3 + 2]! - B.pz[i]!, l = Math.hypot(dx, dz2) || 1;
        const out = fz * (FAT.back * w0 + FAT.ax * w1 + FAT.flank * w2 + FAT.low * lowK * w3);
        a[i * 3]! += (dx / l) * out; a[i * 3 + 2]! += (dz2 / l) * out; a[i * 3 + 1]! -= fz * FAT.lowDrop * lowK * w3;
      }
    }
    if (gM && BM[i * 3 + 2]) {
      // v186: a fuller cup comes forward as a teardrop and settles lower the fuller it is.
      const k2 = gM * BREAST.amp;
      a[i * 3]! += BM[i * 3]! * k2;
      a[i * 3 + 1]! -= BM[i * 3 + 1]! * gM * BREAST.sag * (1 + BREAST.sag2 * gM);
      a[i * 3 + 2]! += BM[i * 3 + 2]! * k2;
    }
  }
}

/**
 * v186: smooth shading everywhere, but the fold under a fuller breast stays a fold: the skin just below it is shaded by
 * the ribs alone, so the underside of the breast does not smear a dark band down the ribcage.
 */
export function bodyNormals(B: GownRig): void {
  B.geo.computeVertexNormals();
  const gM = Math.max(0, B.P.b - 1);
  if (!gM) return;
  if (!B.foldN) {
    const M = B.bMask, idx = B.idx, p0 = B.pos0, own = new Map<number, number[]>(), edge = new Map<number, [number, number]>();
    for (let t = 0; t < idx.length; t += 3) {
      const tv = [idx[t]!, idx[t + 1]!, idx[t + 2]!], mv = tv.filter((v) => M[v * 3 + 2]);
      for (const v of tv) {
        if (M[v * 3 + 2]) continue;
        if (mv.length) {
          let e = edge.get(v);
          if (!e) edge.set(v, (e = [0, 0]));
          for (const m of mv) { e[0] += p0[m * 3 + 1]! - p0[v * 3 + 1]!; e[1]++; }
        } else {
          let l = own.get(v);
          if (!l) own.set(v, (l = []));
          l.push(t);
        }
      }
    }
    B.foldN = [...edge].filter(([v, e]) => own.has(v) && e[0] / e[1] > 0.004).map(([v]) => [v, own.get(v)!]);
  }
  const P = B.posAttr.array as Float32Array, N = B.geo.attributes.normal!.array as Float32Array, idx = B.idx, k = smoothstep(gM, 0, 0.3);
  for (const [v, ts] of B.foldN) {
    let nx = 0, ny = 0, nz = 0;
    for (const t of ts) {
      const a = idx[t]! * 3, b = idx[t + 1]! * 3, c = idx[t + 2]! * 3;
      const ux = P[b]! - P[a]!, uy = P[b + 1]! - P[a + 1]!, uz = P[b + 2]! - P[a + 2]!, vx = P[c]! - P[a]!, vy = P[c + 1]! - P[a + 1]!, vz = P[c + 2]! - P[a + 2]!;
      nx += uy * vz - uz * vy; ny += uz * vx - ux * vz; nz += ux * vy - uy * vx;
    }
    const l = Math.hypot(nx, ny, nz);
    if (!l) continue;
    nx = N[v * 3]! + (nx / l - N[v * 3]!) * k; ny = N[v * 3 + 1]! + (ny / l - N[v * 3 + 1]!) * k; nz = N[v * 3 + 2]! + (nz / l - N[v * 3 + 2]!) * k;
    const l2 = Math.hypot(nx, ny, nz) || 1;
    N[v * 3] = nx / l2; N[v * 3 + 1] = ny / l2; N[v * 3 + 2] = nz / l2;
  }
  B.geo.attributes.normal!.needsUpdate = true;
}
