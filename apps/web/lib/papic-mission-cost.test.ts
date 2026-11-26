/**
 * GUARD — the challenge board states what it commits a guest to spend, and the
 * figure is DERIVED.
 *
 * The board lives in Set up; the shared pool lives in Cameras. So a couple could
 * put twenty challenges in front of every guest — hundreds of shots out of one
 * shared pot — on a screen with no number anywhere on it.
 *
 * 🔑 A HAND-TYPED 8 IS HOW A SCREEN AND A TILL COME TO DISAGREE. Every figure
 * here derives from `papicCaptureCost`, the same function the capture path
 * charges with. This guard fails if anyone re-types one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  papicMissionCost,
  papicCaptureCost,
  PAPIC_POINTS_PER_SNIPPET,
  PAPIC_POINTS_PER_PHOTO,
} from './papic-cameras';

const HERE = dirname(fileURLToPath(import.meta.url));
const BOARD = readFileSync(
  resolve(HERE, '..', 'app/dashboard/[eventId]/studio/papic/couple-challenges-manager.tsx'),
  'utf8',
);
const codeOnly = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('a photo costs what a photo costs, a video what a clip costs', () => {
  assert.equal(papicMissionCost('photo'), papicCaptureCost('photo'));
  assert.equal(papicMissionCost('clip'), papicCaptureCost('clip'));
  // A video greeting is recorded on camera — it is a clip's worth, not a
  // photo's. It used to arrive as its own kind, 'pabati'; that SKU was retired
  // on 2026-08-21 and its library row now says 'clip', so the greeting is
  // priced by the line above rather than by a third case.
  assert.notEqual(papicCaptureCost('clip'), papicCaptureCost('photo'));
});

test('a mission with no kind recorded costs a photo, never nothing', () => {
  // Returning 0 would let a whole board read as free.
  for (const missing of [null, undefined]) {
    assert.equal(papicMissionCost(missing), PAPIC_POINTS_PER_PHOTO);
    assert.ok(papicMissionCost(missing) > 0);
  }
});

test('🚨 the figures are DERIVED from the capture cost, not re-typed', () => {
  // If someone changes what a clip costs, this test moves with it — that is the
  // point. It asserts the relationship, not the number.
  assert.equal(papicMissionCost('clip'), PAPIC_POINTS_PER_SNIPPET);
  assert.equal(papicMissionCost('photo'), PAPIC_POINTS_PER_PHOTO);
});

test('🚨 the card prints no shot cost and no pool balance — those lived on the retired board (L6, R6)', () => {
  // The cost line and the pool balance were drawn only by the standalone /papic/challenges board, retired at
  // launch. The card must not bring back a hand-typed cost, nor read the pool to print nothing.
  const code = codeOnly(BOARD);
  assert.doesNotMatch(code, /fetchEventPoolStatus\(/, 'the card reads the pool and never shows it');
  assert.ok(
    !new RegExp(`>\\s*${PAPIC_POINTS_PER_SNIPPET}\\s*<`).test(code),
    'a clip cost is hard-coded into the card copy — derive it',
  );
});
