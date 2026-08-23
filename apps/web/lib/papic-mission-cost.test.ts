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
  PAPIC_POINTS_PER_CLIP,
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
  assert.equal(papicMissionCost('clip'), PAPIC_POINTS_PER_CLIP);
  assert.equal(papicMissionCost('photo'), PAPIC_POINTS_PER_PHOTO);
});

test('🚨 the board renders the cost, and never hard-codes it', () => {
  const code = codeOnly(BOARD);
  assert.match(code, /papicMissionCost\(/, 'the board must derive each mission cost');
  assert.match(code, /boardCostPerGuest/, 'and total them for the guest');
  // The literal cost must not appear as a number in the board's own copy.
  const rendered = code.slice(code.indexOf('return ('));
  assert.ok(
    !new RegExp(`>\\s*${PAPIC_POINTS_PER_CLIP}\\s*<`).test(rendered),
    'the clip cost is hard-coded into the copy — derive it',
  );
});

test('🚨 a failed pool read says nothing, rather than a confident zero', () => {
  // `fetchEventPoolStatus` degrades to "absent" on ANY error. Printing 0 there
  // tells a couple they are out of shots at the worst possible moment.
  const code = codeOnly(BOARD);
  assert.match(
    code,
    /poolRemaining\s*=\s*pool\.applies\s*\?\s*pool\.remainingPoints\s*:\s*null/,
    'the balance must be null when the pool does not apply or the read failed',
  );
  assert.match(
    code,
    /poolRemaining\s*!==\s*null\s*\?/,
    'and the copy must branch on that null instead of printing it',
  );
});

test('the cost line stays quiet on an empty board', () => {
  // A board with nothing live costs nothing; a banner saying "0 shots" is noise,
  // and noise is how a real warning gets skimmed past.
  assert.match(codeOnly(BOARD), /boardCostPerGuest\s*>\s*0\s*\?/);
});
