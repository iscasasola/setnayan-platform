/**
 * 👗 gown/body/skin — skin on the CPU (model space), so the tape, the floor and the dress all read the real posed body;
 * and the forefoot in heels (prototype v186 `skin`, `heelBend`, `heelDraw`).
 */
import { HEEL_BEND } from './constants';
import { bodyNormals } from './shape';
import { clamp, type GownRig } from './rig';

/** Which skin lies ahead of the ball of each foot (0…1 across the bend), and the hinge it turns about. */
export function heelBend(B: GownRig): NonNullable<GownRig['heelM']> {
  if (!B.heelM) {
    const w = new Float32Array(B.n), ref = [-1, -1], P0 = B.pos0, up = [0, 0];
    B.heelM = { w, ref, up, y: [0, 0], z: [0, 0] };
    (['L', 'R'] as const).forEach((sd, k) => {
      const ids: number[] = [], ws: number[] = [];
      let y0 = 1e9, z0 = 1e9, z1 = -1e9;
      for (let i = 0; i < B.n; i++) {
        let s = 0;
        for (let c = 0; c < 4; c++) {
          const nm = B.name[B.SI[i * 4 + c]!] || '';
          if (B.SW[i * 4 + c] && /^(foot|toe)/.test(nm) && nm.endsWith(sd)) s += B.SW[i * 4 + c]!;
        }
        if (s > 0.5) { ids.push(i); ws.push(s); y0 = Math.min(y0, P0[i * 3 + 1]!); z0 = Math.min(z0, P0[i * 3 + 2]!); z1 = Math.max(z1, P0[i * 3 + 2]!); }
      }
      const L = z1 - z0, zb = z0 + HEEL_BEND.ball * L, d = HEEL_BEND.soft * L;
      let best = 1e9;
      up[k] = HEEL_BEND.up * L;
      ids.forEach((i, q) => {
        const z = P0[i * 3 + 2]!, u = clamp((z - zb + d) / (2 * d), 0, 1);
        w[i] = u * u * (3 - 2 * u) * ws[q]!;
        const e = Math.abs(z - zb);
        // The hinge rides on a sole vertex at the ball line, so it follows her build.
        if (P0[i * 3 + 1]! - y0 < 0.03 * L && e < best) { best = e; ref[k] = i; }
      });
    });
  }
  const M = B.heelM, a = B.cur;
  for (let k = 0; k < 2; k++) if (M.ref[k]! >= 0) { M.y[k] = a[M.ref[k]! * 3 + 1]! + M.up[k]!; M.z[k] = a[M.ref[k]! * 3 + 2]!; }
  return M;
}

/** The same bend on the drawn mesh (skinned on the GPU from the body as built). */
export function heelDraw(B: GownRig): void {
  const hA = B.heelA || 0;
  if (hA === (B.heelDrawn || 0)) return;
  const M = heelBend(B), a = B.cur, P = B.posAttr.array as Float32Array;
  if (!M.ids) { M.ids = []; for (let i = 0; i < B.n; i++) if (M.w[i]) M.ids.push(i); }
  for (const i of M.ids) {
    const k = a[i * 3]! < 0 ? 1 : 0, t = hA * M.w[i]!, c = Math.cos(t), s = Math.sin(t), dy = a[i * 3 + 1]! - M.y[k]!, dz = a[i * 3 + 2]! - M.z[k]!;
    P[i * 3 + 1] = M.y[k]! + dy * c + dz * s;
    P[i * 3 + 2] = M.z[k]! - dy * s + dz * c;
  }
  B.heelDrawn = hA;
  B.posAttr.needsUpdate = true;
  bodyNormals(B);
}

/** Skin the body as built into `B.V` with the current bone matrices; `list` limits it to some vertices. */
export function skin(B: GownRig, list?: ArrayLike<number>): void {
  const a = B.cur, V = B.V, bm = B.bm, SI = B.SI, SW = B.SW, cnt = list ? list.length : B.n, hA = B.heelA || 0;
  const HM = hA ? heelBend(B) : null, HW = HM && HM.w;
  for (let q = 0; q < cnt; q++) {
    const i = list ? list[q]! : q;
    let x = a[i * 3]!, y = a[i * 3 + 1]!, z = a[i * 3 + 2]!, X = 0, Y = 0, Z = 0;
    if (HW && HW[i]) {
      // In heels the forefoot turns back level about the ball, so the toes stay flat while the heel rises.
      const k = x < 0 ? 1 : 0, t = hA * HW[i]!, c = Math.cos(t), s = Math.sin(t), dy = y - HM!.y[k]!, dz = z - HM!.z[k]!;
      y = HM!.y[k]! + dy * c + dz * s;
      z = HM!.z[k]! - dy * s + dz * c;
    }
    for (let c = 0; c < 4; c++) {
      const w = SW[i * 4 + c]!;
      if (!w) continue;
      const o = SI[i * 4 + c]! * 16;
      X += w * (bm[o]! * x + bm[o + 4]! * y + bm[o + 8]! * z + bm[o + 12]!);
      Y += w * (bm[o + 1]! * x + bm[o + 5]! * y + bm[o + 9]! * z + bm[o + 13]!);
      Z += w * (bm[o + 2]! * x + bm[o + 6]! * y + bm[o + 10]! * z + bm[o + 14]!);
    }
    V[i * 3] = X; V[i * 3 + 1] = Y; V[i * 3 + 2] = Z;
  }
}
