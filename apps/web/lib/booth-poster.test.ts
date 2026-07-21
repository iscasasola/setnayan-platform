/**
 * Unit suite for the booth poster's PURE rules (`lib/booth-poster.ts`).
 * Load-bearing invariants:
 *   • The 2:3 portrait rule accepts real-world exports (1000x1500, 1080x1620)
 *     and rejects a DIFFERENT SHAPE (square, 4:3, landscape, 1:2) — the render
 *     is one fixed plane mesh, so shape is the thing that must hold.
 *   • Error copy names the actual dimensions, so a vendor can fix the artwork
 *     rather than guess.
 *   • Every helper FAILS OPEN on unreadable input — FileUpload's `validateFile`
 *     contract is that a content validator must never brick the upload path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  POSTER_ASPECT_TOLERANCE,
  POSTER_MASTER_H,
  POSTER_MASTER_W,
  POSTER_MIN_W,
  posterAspectError,
  posterSizeError,
} from './booth-poster';

test('posterAspectError accepts the exact master size', () => {
  assert.equal(posterAspectError(POSTER_MASTER_W, POSTER_MASTER_H), null);
});

test('posterAspectError accepts common 2:3 exports at other resolutions', () => {
  assert.equal(posterAspectError(1000, 1500), null);
  assert.equal(posterAspectError(1080, 1620), null);
  assert.equal(posterAspectError(2048, 3072), null);
});

test('posterAspectError accepts drift inside the tolerance band', () => {
  const h = 1500;
  const w = Math.round(h * (2 / 3) * (1 + POSTER_ASPECT_TOLERANCE / 2));
  assert.equal(posterAspectError(w, h), null);
});

test('posterAspectError rejects landscape, square and 4:3', () => {
  assert.notEqual(posterAspectError(1536, 1024), null);
  assert.notEqual(posterAspectError(1024, 1024), null);
  assert.notEqual(posterAspectError(1024, 768), null);
});

test('posterAspectError rejects a too-tall portrait (1:2 pull-up banner)', () => {
  assert.notEqual(posterAspectError(1024, 2048), null);
});

test('posterAspectError names the actual dimensions so the vendor can fix it', () => {
  const msg = posterAspectError(1024, 1024);
  assert.ok(msg && msg.includes('1024x1024'), msg ?? '(null)');
});

test('posterAspectError fails OPEN on unreadable dimensions', () => {
  assert.equal(posterAspectError(0, 0), null);
  assert.equal(posterAspectError(Number.NaN, 1500), null);
  assert.equal(posterAspectError(-1, -1), null);
});

test('posterSizeError accepts the master size and larger', () => {
  assert.equal(posterSizeError(POSTER_MASTER_W, POSTER_MASTER_H), null);
  assert.equal(posterSizeError(2048, 3072), null);
});

test('posterSizeError accepts exactly the floor', () => {
  assert.equal(posterSizeError(POSTER_MIN_W, POSTER_MIN_W * 1.5), null);
});

test('posterSizeError rejects below the floor', () => {
  assert.notEqual(posterSizeError(POSTER_MIN_W - 1, (POSTER_MIN_W - 1) * 1.5), null);
});

test('posterSizeError fails open on unreadable width', () => {
  assert.equal(posterSizeError(0, 0), null);
  assert.equal(posterSizeError(Number.NaN, 1500), null);
});
