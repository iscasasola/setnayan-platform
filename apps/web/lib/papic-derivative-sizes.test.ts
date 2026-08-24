/**
 * lib/papic-derivative-sizes.test.ts — the three derivative sizes are three
 * DIFFERENT answers, and the pipeline still produces all of them.
 *
 * `papic-derivatives.ts` imports `server-only` and `sharp`, so the unit runner
 * cannot import it — this reads the source, which is the same text the build
 * compiles.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The whole defect chain was one size being reused for a job it was not built
 * for: the wall served the 320px thumb into 383px tiles ("the photos are
 * pixelated"), then the 1280px display at 27× the bytes. Collapsing any two of
 * the three, or dropping the tile from either generator, silently restores one
 * of those two states — and both render perfectly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const SRC = stripComments(
  readFileSync(join(process.cwd(), 'lib', 'papic-derivatives.ts'), 'utf8'),
);

function constant(name: string): number {
  const m = new RegExp(`const ${name} = (\\d+);`).exec(SRC);
  assert.ok(m, `could not find ${name} in papic-derivatives.ts — update this guard`);
  return Number(m[1]);
}

test('three sizes, all distinct, in the right order', () => {
  const thumb = constant('THUMB_LONG_EDGE');
  const tile = constant('TILE_LONG_EDGE');
  const display = constant('DISPLAY_LONG_EDGE');
  assert.ok(
    thumb < tile && tile < display,
    `sizes must stay ordered thumb < tile < display, got ${thumb}/${tile}/${display}`,
  );
  assert.equal(new Set([thumb, tile, display]).size, 3, 'two sizes collapsed into one');
});

test('the tile is big enough for the largest tile the app renders', () => {
  // home lg:grid-cols-6 → 192 CSS px → 383 device px at 2×. object-cover on an
  // aspect-square scales a LANDSCAPE source by its HEIGHT (long-edge × 3/4), so
  // that is the number that has to clear 383 — the exact arithmetic the 320px
  // thumb failed.
  const usableHeight = constant('TILE_LONG_EDGE') * 0.75;
  assert.ok(
    usableHeight >= 383,
    `a ${constant('TILE_LONG_EDGE')}px tile gives ${usableHeight}px after a square ` +
      `crop, which UPSCALES into a 383px tile — the pixelation this size exists to end.`,
  );
});

test('1280 stays put — the owner ruled on it', () => {
  // Raising DISPLAY_LONG_EDGE to 1920 was declined: "no. let's stay with 720p"
  // (2026-08-07), a cost decision at ~₱7.1 → ~₱10.6/event/yr. Adding a smaller
  // tile must not become a back door to changing it.
  assert.equal(constant('DISPLAY_LONG_EDGE'), 1280);
});

test('EVERY generator actually produces a tile', () => {
  // A size nothing writes is a column nothing fills, and the reader then falls
  // back forever with no error anywhere.
  //
  // ⚠ RE-ANCHORED 2026-08-24, AND STRICTLY STRONGER — not relaxed. This pinned
  // the literal 3 ("the photo path, the clip path, and the backfill"), so adding
  // a FOURTH encoder that DOES produce a tile — `generateSafeDerivatives`, the
  // blurred web copies for public surfaces — failed a guard whose entire point
  // is that every encoder makes one. The count is now DERIVED from the number of
  // generators, so it still catches what the literal caught (an encoder dropping
  // its tile) AND what the literal never could: a NEW encoder shipping without
  // one, which a hard-coded 3 would have waved through forever.
  const generators = [...SRC.matchAll(/export async function generate[A-Za-z]*\(/g)].length;
  assert.ok(generators >= 3, `only ${generators} generators found — re-point this guard`);
  assert.equal(
    [...SRC.matchAll(/toAvif\([^)]*TILE_LONG_EDGE/g)].length,
    generators,
    `Expected TILE_LONG_EDGE in all ${generators} encoders. A generator that ` +
      'keeps the thumb produces the one visibly soft square in an otherwise ' +
      'sharp grid — and a new one that skips the tile leaves a column nothing fills.',
  );
  assert.match(SRC, /tile_r2_key: tileKey/, 'the photo/clip paths stopped persisting the ref');
});

test('the pre-migration retry strips the NEW key column too', () => {
  // The PGRST204 retry exists because code and migration land at different
  // times. If tile_r2_key stayed in the patch, the retry would fail on the same
  // error and the display/thumb refs the deploy CAN store would be lost with it
  // — the fallback silently useless for exactly the window it was built for.
  const m = /const \{([^}]*)\} =\s*patch;/.exec(SRC);
  assert.ok(m, 'could not find the PGRST204 destructure — update this guard');
  for (const field of ['tile_r2_key', 'tile_bytes']) {
    assert.match(m[1]!, new RegExp(`\\b${field}\\b`), `${field} is not stripped on retry`);
  }
});
