/**
 * the-veil-lifts-at-full-speed.test.ts — owner 2026-10-25 (after #6870): the LIFT still lagged.
 *
 * MEASURED (isolated veil, no page, Playwright WebKit — the engine of every iPhone browser): the cloth step took
 * ~2.5 ms a frame while the veil hung closed and ~25 ms a frame the moment it lifted — relaxation 2 → 18 ms, the
 * strain clamp 0.5 → 6.5 ms, for the SAME arithmetic. Chromium (V8) stayed flat. So on an iPhone the whole lift and
 * the falling petals ran at ~30 fps, with or without the page behind the veil (the page's styles, its `:has()`
 * rules, its CSS animations and the cover video were each switched off in turn on the live page: none of them moved
 * it). The solver lived inline in the sim's giant closure, iterating ~9,700 small `number[]` constraint arrays; once
 * the lift changed which branches ran, WebKit's JIT never recovered.
 *
 * The solver now lives in `lib/veil-cloth.ts` as two small monomorphic functions over flat typed arrays
 * (`relaxPass` · `clampPass`). WebKit, lifted: ~2.6–2.9 ms a step.
 *
 * 🔒 THE CLOTH IS IDENTICAL, BIT FOR BIT — held below against the old solver, kept VERBATIM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { buildGridConstraints, clampPass, relaxPass } from '@/lib/veil-cloth';

const here = dirname(fileURLToPath(import.meta.url));
const VEIL = stripComments(readFileSync(join(here, 'veil-reveal.tsx'), 'utf8'));

const cols = 66;
const rows = 50;
const N = cols * rows;
const pinW = 4.1;
const clothH = 3.6;
const dy = clothH / (rows - 1);
const rowDx = new Float32Array(rows);
for (let iy = 0; iy < rows; iy++) rowDx[iy] = (pinW * (1 + 0.2 * (0.16 + 0.84 * Math.pow(iy / (rows - 1), 1.5)))) / (cols - 1);

/** A seeded, deformed drape — folds, a lifted hem, a twist — so every branch (compress · stretch · clamp) runs. */
function drape() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const pz = new Float32Array(N);
  for (let iy = 0; iy < rows; iy++)
    for (let ix = 0; ix < cols; ix++) {
      const k = iy * cols + ix;
      const fx = ix / (cols - 1);
      px[k] = -pinW / 2 + fx * pinW + ((rnd() - 0.5) * 0.03 * iy) / rows;
      py[k] = 1.9 - iy * dy * (0.8 + 0.4 * rnd()) + Math.sin(fx * 9) * 0.05;
      pz[k] = 0.6 + 0.2 * Math.sin(fx * 6.2832 * 3) * (iy / rows) + (rnd() - 0.5) * 0.02;
    }
  return { px, py, pz };
}

/* ── The code it replaced, VERBATIM from veil-reveal.tsx before 2026-10-25 (constraint build · relax · clamp). ── */
function oldConstraints(): number[][] {
  const idx = (ix: number, iy: number) => iy * cols + ix;
  const cons: number[][] = [];
  for (let iy3 = 0; iy3 < rows; iy3++)
    for (let ix3 = 0; ix3 < cols; ix3++) {
      if (ix3 < cols - 1) cons.push([idx(ix3, iy3), idx(ix3 + 1, iy3), rowDx[iy3]!]);
      if (iy3 < rows - 1) cons.push([idx(ix3, iy3), idx(ix3, iy3 + 1), dy]);
      if (ix3 < cols - 1 && iy3 < rows - 1) cons.push([idx(ix3, iy3), idx(ix3 + 1, iy3 + 1), Math.hypot(rowDx[iy3]!, dy)]);
    }
  return cons;
}
function oldSolve(px: Float32Array, py: Float32Array, pz: Float32Array, cons: number[][], maxS: number) {
  const COMP = 0.16;
  const TENB = 0.42;
  for (let it = 0; it < 6; it++) {
    for (let c = 0; c < cons.length; c++) {
      const A = cons[c]![0]!;
      const B = cons[c]![1]!;
      const rest = cons[c]![2]!;
      const ex = px[B]! - px[A]!;
      const ey = py[B]! - py[A]!;
      const ez = pz[B]! - pz[A]!;
      const dd = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-4;
      const diff = dd - rest;
      const strain = diff / rest;
      const stiff = strain <= 0 ? COMP : TENB + (1 - TENB) * Math.min(1, strain / maxS);
      const f = (diff / dd) * stiff * 0.5;
      const ox = ex * f;
      const oy = ey * f;
      const oz = ez * f;
      if (A >= cols) {
        px[A] = px[A]! + ox;
        py[A] = py[A]! + oy;
        pz[A] = pz[A]! + oz;
      }
      if (B >= cols) {
        px[B] = px[B]! - ox;
        py[B] = py[B]! - oy;
        pz[B] = pz[B]! - oz;
      }
    }
  }
  const CL = 1.012;
  for (let sit = 0; sit < 4; sit++) {
    for (let c2 = 0; c2 < cons.length; c2++) {
      const A2 = cons[c2]![0]!;
      const B2 = cons[c2]![1]!;
      const lim = cons[c2]![2]! * CL;
      const ex2 = px[B2]! - px[A2]!;
      const ey2 = py[B2]! - py[A2]!;
      const ez2 = pz[B2]! - pz[A2]!;
      const dd2 = Math.sqrt(ex2 * ex2 + ey2 * ey2 + ez2 * ez2) || 1e-4;
      if (dd2 > lim) {
        const f2 = ((dd2 - lim) / dd2) * 0.5;
        const ox2 = ex2 * f2;
        const oy2 = ey2 * f2;
        const oz2 = ez2 * f2;
        if (A2 >= cols) {
          px[A2] = px[A2]! + ox2;
          py[A2] = py[A2]! + oy2;
          pz[A2] = pz[A2]! + oz2;
        }
        if (B2 >= cols) {
          px[B2] = px[B2]! - ox2;
          py[B2] = py[B2]! - oy2;
          pz[B2] = pz[B2]! - oz2;
        }
      }
    }
  }
}

test('the typed solver moves the cloth EXACTLY as the old inline one did (30 frames, 3 stiffnesses, every particle, bit for bit)', () => {
  const a = drape();
  const b = drape();
  const old = oldConstraints();
  const C = buildGridConstraints(cols, rows, rowDx, dy);
  assert.equal(C.n, old.length, 'the same number of constraints');
  for (let c = 0; c < old.length; c++) {
    assert.equal(C.a[c], old[c]![0]);
    assert.equal(C.b[c], old[c]![1]);
    assert.equal(C.rest[c], old[c]![2], 'rest lengths stay doubles, in the same order');
  }
  for (const maxS of [0.004, 0.06, 0.124]) {
    for (let frame = 0; frame < 10; frame++) {
      oldSolve(a.px, a.py, a.pz, old, maxS);
      for (let it = 0; it < 6; it++) relaxPass(b.px, b.py, b.pz, C, cols, maxS, 0.16, 0.42);
      for (let sit = 0; sit < 4; sit++) clampPass(b.px, b.py, b.pz, C, cols, 1.012);
    }
  }
  assert.deepEqual(b.px, a.px);
  assert.deepEqual(b.py, a.py);
  assert.deepEqual(b.pz, a.pz);
});

test('the veil solves its cloth through relaxPass / clampPass — no inline array-of-arrays solver comes back', () => {
  assert.doesNotMatch(VEIL, /number\[\]\[\]/, 'constraints are ClothConstraints (typed arrays)');
  assert.doesNotMatch(VEIL, /cons\.push\s*\(/);
  assert.doesNotMatch(VEIL, /cons\[c2?\]/, 'no inline constraint loop over the old arrays');
  assert.match(VEIL, /buildGridConstraints\(cols, rows, rowDx, dy\)/);
  assert.match(VEIL, /relaxPass\(px, py, pz, cons, cols, maxS, COMP, TENB\)/);
  assert.match(VEIL, /clampPass\(px, py, pz, cons, cols, CL\)/);
});
