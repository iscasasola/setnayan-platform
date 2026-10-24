/**
 * lib/veil-cloth.ts — the veil's per-frame mesh update, straight on typed arrays.
 * (2026-10-25: and the cloth SOLVER — `relaxPass` · `clampPass` — see `the-veil-lifts-at-full-speed.test.ts`.)
 *
 * 🐢 WHY THIS FILE EXISTS (owner 2026-10-24, on his phone: *"why is the veil reveal lagging. and the petal falling"*).
 * Measured on live `/cale-ice` at 390 px · DPR 3 · CPU ×4 (a mid-range phone): the veil's `requestAnimationFrame`
 * loop already took ~14 ms of every 16.7 ms frame with the veil just hanging there, so anything else on the page cost
 * frames. After the cloth step itself, the next-largest piece of that loop was handing the cloth to the mesh: 3,300
 * `setXYZ` calls, then three.js's generic `computeVertexNormals` (six `Vector3` reads and three `setXYZ` writes per
 * triangle, ~6,500 triangles) — ~1.7 ms a frame at CPU ×4, every frame, forever. Same maths, done straight on the
 * attribute's own `Float32Array`s: ~0.3 ms.
 *
 * (The cloth solver itself was also tried on flat typed arrays — measured ~2 % per frame, so it was left alone.)
 *
 * 🔒 THE LOOK IS IDENTICAL, BIT FOR BIT. Both functions do the same arithmetic in the same order at the same precision
 * as the three.js code they replace (positions and normals stay float32, re-rounded exactly where three.js re-rounds
 * them). `app/[slug]/_components/reveal/the-veil-keeps-the-frame.test.ts` holds that against three.js's own
 * `setXYZ` + `computeVertexNormals` on a deformed veil grid — not "close", EQUAL.
 *
 * PURE: no three.js, no DOM, no React.
 */

/** The sim's particles into the mesh's position array (xyz interleaved), the depth capped at `zCap` — as `setXYZ` wrote them. */
export function writePositions(out: Float32Array, px: Float32Array, py: Float32Array, pz: Float32Array, n: number, zCap: number): void {
  for (let k = 0, o = 0; k < n; k++, o += 3) {
    out[o] = px[k]!;
    out[o + 1] = py[k]!;
    out[o + 2] = Math.min(zCap, pz[k]!);
  }
}

/**
 * Smooth vertex normals for an indexed triangle mesh — three.js's `BufferGeometry.computeVertexNormals` (indexed
 * branch) + `normalizeNormals`, step for step: each face's un-normalised `(C − B) × (A − B)` added to its three
 * corners, the running sum kept in float32 between additions (three re-reads it from the attribute each time), then
 * every normal scaled by `1 / (length || 1)`.
 */
export function computeIndexedNormals(pos: Float32Array, index: ArrayLike<number>, out: Float32Array): void {
  out.fill(0);
  for (let i = 0, il = index.length; i < il; i += 3) {
    const a = index[i]! * 3;
    const b = index[i + 1]! * 3;
    const c = index[i + 2]! * 3;
    const bx = pos[b]!;
    const by = pos[b + 1]!;
    const bz = pos[b + 2]!;
    const cbx = pos[c]! - bx;
    const cby = pos[c + 1]! - by;
    const cbz = pos[c + 2]! - bz;
    const abx = pos[a]! - bx;
    const aby = pos[a + 1]! - by;
    const abz = pos[a + 2]! - bz;
    const nx = cby * abz - cbz * aby;
    const ny = cbz * abx - cbx * abz;
    const nz = cbx * aby - cby * abx;
    out[a] = out[a]! + nx;
    out[a + 1] = out[a + 1]! + ny;
    out[a + 2] = out[a + 2]! + nz;
    out[b] = out[b]! + nx;
    out[b + 1] = out[b + 1]! + ny;
    out[b + 2] = out[b + 2]! + nz;
    out[c] = out[c]! + nx;
    out[c + 1] = out[c + 1]! + ny;
    out[c + 2] = out[c + 2]! + nz;
  }
  for (let o = 0, ol = out.length; o < ol; o += 3) {
    const x = out[o]!;
    const y = out[o + 1]!;
    const z = out[o + 2]!;
    const s = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
    out[o] = x * s;
    out[o + 1] = y * s;
    out[o + 2] = z * s;
  }
}

/** The cloth's distance constraints, flat: constraint `c` joins particles `a[c]` and `b[c]` at rest length `rest[c]`. */
export type ClothConstraints = {
  a: Int32Array;
  b: Int32Array;
  /** Doubles, as the old `number[][]` held them — a float32 rest length would move the cloth. */
  rest: Float64Array;
  n: number;
};

/**
 * The veil's grid constraints, in the SAME order the old builder pushed them: per row, per column — the horizontal
 * edge (rest `rowDx[iy]`), the vertical edge (rest `dy`), then the shear diagonal (rest `hypot(rowDx[iy], dy)`).
 * Order matters: Gauss–Seidel relaxation is order-dependent, so the same order is the same cloth.
 */
export function buildGridConstraints(cols: number, rows: number, rowDx: ArrayLike<number>, dy: number): ClothConstraints {
  const max = rows * (cols - 1) + (rows - 1) * cols + (rows - 1) * (cols - 1);
  const a = new Int32Array(max);
  const b = new Int32Array(max);
  const rest = new Float64Array(max);
  let n = 0;
  for (let iy = 0; iy < rows; iy++)
    for (let ix = 0; ix < cols; ix++) {
      const k = iy * cols + ix;
      if (ix < cols - 1) {
        a[n] = k;
        b[n] = k + 1;
        rest[n++] = rowDx[iy]!;
      }
      if (iy < rows - 1) {
        a[n] = k;
        b[n] = k + cols;
        rest[n++] = dy;
      }
      if (ix < cols - 1 && iy < rows - 1) {
        a[n] = k;
        b[n] = k + cols + 1;
        rest[n++] = Math.hypot(rowDx[iy]!, dy);
      }
    }
  return { a, b, rest, n };
}

/**
 * One relaxation pass: every constraint pulled toward its rest length, soft in compression (`comp`) and stiffening
 * to 1 as its strain nears `maxS`. Particles below `pinned` (the crown row) never move.
 */
export function relaxPass(
  px: Float32Array,
  py: Float32Array,
  pz: Float32Array,
  C: ClothConstraints,
  pinned: number,
  maxS: number,
  comp: number,
  tenb: number,
): void {
  const ca = C.a;
  const cb = C.b;
  const cr = C.rest;
  for (let c = 0, n = C.n; c < n; c++) {
    const A = ca[c]!;
    const B = cb[c]!;
    const rest = cr[c]!;
    const ex = px[B]! - px[A]!;
    const ey = py[B]! - py[A]!;
    const ez = pz[B]! - pz[A]!;
    const dd = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-4;
    const diff = dd - rest;
    const strain = diff / rest;
    const stiff = strain <= 0 ? comp : tenb + (1 - tenb) * Math.min(1, strain / maxS);
    const f = (diff / dd) * stiff * 0.5;
    const ox = ex * f;
    const oy = ey * f;
    const oz = ez * f;
    if (A >= pinned) {
      px[A] = px[A]! + ox;
      py[A] = py[A]! + oy;
      pz[A] = pz[A]! + oz;
    }
    if (B >= pinned) {
      px[B] = px[B]! - ox;
      py[B] = py[B]! - oy;
      pz[B] = pz[B]! - oz;
    }
  }
}

/** One pass of the hard strain clamp (the "no rubber" rule): no edge longer than `rest · cl`. */
export function clampPass(px: Float32Array, py: Float32Array, pz: Float32Array, C: ClothConstraints, pinned: number, cl: number): void {
  const ca = C.a;
  const cb = C.b;
  const cr = C.rest;
  for (let c = 0, n = C.n; c < n; c++) {
    const A = ca[c]!;
    const B = cb[c]!;
    const lim = cr[c]! * cl;
    const ex = px[B]! - px[A]!;
    const ey = py[B]! - py[A]!;
    const ez = pz[B]! - pz[A]!;
    const dd = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-4;
    if (dd > lim) {
      const f = ((dd - lim) / dd) * 0.5;
      const ox = ex * f;
      const oy = ey * f;
      const oz = ez * f;
      if (A >= pinned) {
        px[A] = px[A]! + ox;
        py[A] = py[A]! + oy;
        pz[A] = pz[A]! + oz;
      }
      if (B >= pinned) {
        px[B] = px[B]! - ox;
        py[B] = py[B]! - oy;
        pz[B] = pz[B]! - oz;
      }
    }
  }
}
