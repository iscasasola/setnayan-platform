/**
 * the-veil-keeps-the-frame.test.ts — owner 2026-10-24, on his phone: *"why is the veil reveal lagging. and the petal
 * falling"*.
 *
 * MEASURED (live `/cale-ice`, Chromium, 390×844 · DPR 3 · CPU ×4): the veil's rAF loop already took ~14 ms of every
 * 16.7 ms frame with the veil just hanging there, the cloth step being the largest JS cost on the page; through the
 * lift the page dropped to 25 fps with a 315 ms frame at the moment the petals began to fall — a shader program
 * re-link (`GetProgramiv`), because the petals' `instanceColor` was created by the first `setColorAt`, mid-lift.
 *
 * What this file holds, so neither comes back:
 *
 *   1 · THE SAME VEIL. `lib/veil-cloth.ts` writes the positions and builds the normals itself. It is compared here,
 *       bit for bit, with three.js's own `setXYZ` + `computeVertexNormals` on a deformed veil grid. EQUAL, not
 *       close: the look may not move.
 *   2 · THE LOOP STAYS LEAN (source, comments stripped): no `computeVertexNormals`, no per-vertex `setXYZ` in
 *       `veil-reveal.tsx`; and the loop writes no inline style except the grab-zone's resize, which happens only on
 *       the frame its mode changes.
 *   3 · NO MID-LIFT RECOMPILE: the petals' `instanceColor` is made before the mesh joins the scene.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { stripComments } from '@/lib/strip-comments';
import { computeIndexedNormals, writePositions } from '@/lib/veil-cloth';

const here = dirname(fileURLToPath(import.meta.url));
const VEIL = stripComments(readFileSync(join(here, 'veil-reveal.tsx'), 'utf8'));

/* The veil's own grid (veil-reveal.tsx: cols 66 · rows 50). */
const cols = 66;
const rows = 50;
const N = cols * rows;
const pinW = 4.1;
const clothH = 3.6;
const dy = clothH / (rows - 1);

/** A seeded, deformed drape — folds, a lifted hem, jitter — so every face has its own normal. */
function drape() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const pz = new Float32Array(N);
  for (let iy = 0; iy < rows; iy++)
    for (let ix = 0; ix < cols; ix++) {
      const k = iy * cols + ix;
      const fx = ix / (cols - 1);
      px[k] = -pinW / 2 + fx * pinW + (rnd() - 0.5) * 0.03 * iy / rows;
      py[k] = 1.9 - iy * dy * (0.8 + 0.4 * rnd()) + Math.sin(fx * 9) * 0.05;
      pz[k] = 0.6 + 0.2 * Math.sin(fx * 6.2832 * 3) * (iy / rows) + (rnd() - 0.5) * 0.02;
    }
  return { px, py, pz };
}

test('1 · the normals are three.js computeVertexNormals, bit for bit, and positions are what setXYZ wrote', () => {
  const { px, py, pz } = drape();
  const zc = 3.7;
  pz[100] = 9; // one particle past the camera cap
  const ref = new THREE.PlaneGeometry(pinW, clothH, cols - 1, rows - 1);
  const refPos = ref.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < N; k++) refPos.setXYZ(k, px[k]!, py[k]!, Math.min(zc, pz[k]!));
  ref.computeVertexNormals();

  const mine = new THREE.PlaneGeometry(pinW, clothH, cols - 1, rows - 1);
  const pos = mine.attributes.position as THREE.BufferAttribute;
  const nrm = mine.attributes.normal as THREE.BufferAttribute;
  writePositions(pos.array as Float32Array, px, py, pz, N, zc);
  computeIndexedNormals(pos.array as Float32Array, mine.index!.array, nrm.array as Float32Array);

  assert.deepEqual(pos.array, refPos.array);
  assert.deepEqual(nrm.array, (ref.attributes.normal as THREE.BufferAttribute).array);
});

test('2 · the veil loop stays lean: no computeVertexNormals, no per-vertex setXYZ', () => {
  assert.doesNotMatch(VEIL, /computeVertexNormals\s*\(/, 'normals come from computeIndexedNormals (lib/veil-cloth.ts)');
  assert.doesNotMatch(VEIL, /posAttr\.setXYZ\s*\(/, 'positions go straight into the attribute array (writePositions)');
  assert.match(VEIL, /computeIndexedNormals\(posAttr\.array/);
  assert.match(VEIL, /writePositions\(posAttr\.array/);
});

test('2 · the veil loop writes no inline style per frame — only the grab-zone, on the frame its mode changes', () => {
  const start = VEIL.indexOf('const loop = (now: number) =>');
  assert.ok(start > 0, 'the loop is found');
  const end = VEIL.indexOf('wakeRef.current = () =>', start);
  assert.ok(end > start);
  let body = VEIL.slice(start, end);
  const gate = body.indexOf('if (wantTopBand !== grabTopBandRef.current');
  assert.ok(gate > 0, 'the grab-zone resize is gated on a change of mode');
  // Cut the gated block (balanced braces) out; nothing else in the loop may touch `.style`.
  const open = body.indexOf('{', gate);
  let depth = 0;
  let close = open;
  for (; close < body.length; close++) {
    if (body[close] === '{') depth++;
    else if (body[close] === '}' && --depth === 0) break;
  }
  body = body.slice(0, gate) + body.slice(close + 1);
  const writes = body.match(/\.style\.[a-zA-Z]+\s*=/g) ?? [];
  // The one remaining is the `keepsOpen` hit-zone going inert at the reveal — once, behind `!revealedRef.current`.
  assert.ok(writes.length <= 1, `per-frame style writes in the veil loop: ${writes.join(', ')}`);
  if (writes.length) assert.match(body, /if \(lift > 0\.985 && !revealedRef\.current\) \{[^}]*\.style\.pointerEvents = 'none'/);
});

test('3 · the petals carry their instance colour from the first frame — no shader re-link when they begin to fall', () => {
  const made = VEIL.search(/petals\.instanceColor\s*=\s*new THREE\.InstancedBufferAttribute\(/);
  const added = VEIL.indexOf('scene.add(petals)');
  assert.ok(made > 0, 'instanceColor is created up front');
  assert.ok(added > 0 && made < added, 'before the petals join the scene (so before the first render compiles their program)');
});
