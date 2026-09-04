/**
 * A PHOTO WALL IS ONE BACKDROP WITH THINGS ON IT.
 *
 * `photo_wall` is multi-select, and its own catalogue comment says the photo op
 * is "usually two things at once" — a balloon garland over a step-and-repeat.
 * The room drew the primary and dropped the rest.
 *
 * ⚠ THIS ZONE NEEDED A DIFFERENT RULE FROM THE WALLS, AND THAT IS THE POINT.
 * Side-wall treatments all hang on a wall, so they stack: each extra hangs
 * further into the room. A photo wall cannot stack, because it is ONE physical
 * panel — it cannot be both a greenery wall and a lit neon panel, since those
 * are the same surface described two ways.
 *
 * So: the PANEL takes the primary's material, and every chosen style's
 * DECORATION draws on top of it. A garland over a step-and-repeat is two
 * things. A greenery wall over a neon panel is one thing chosen twice, and the
 * primary wins.
 *
 * ⚠ THE PRIMARY DOES NOT MOVE — panel material AND decoration depth.
 * `selAll(...)[0] === sel(...)`, and `lift()` returns 0 at index 0. A board
 * that chose one style renders exactly as it did before.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { sel, selAll, type ReceptionDesign } from './reception-scene';
import { ROOM_DRAWN_ATTRIBUTES } from '@/app/_components/plan3d/venue-decor';

const DECOR = join(import.meta.dirname, '..', 'app', '_components', 'plan3d', 'venue-decor.tsx');
const src = () => stripComments(readFileSync(DECOR, 'utf8'));

/* ── one panel ────────────────────────────────────────────────────────────── */

test('the panel follows the PRIMARY, not the last pick', () => {
  const s = src();
  // `style` is the panel's material source and must be selAll[0].
  assert.match(
    s,
    /const style = styles\[0\] \?\? 'none';/,
    'the shared panel takes the primary style — a photo wall is one surface, and ' +
      'letting a later pick repaint it would silently change the backdrop the ' +
      'couple has been looking at.',
  );
});

test('the primary is what sel() already returned', () => {
  const two = { photo_wall: { style: ['neon_backdrop', 'balloon_garland'] } } as ReceptionDesign;
  assert.equal(selAll(two, 'photo_wall', 'style')[0], sel(two, 'photo_wall', 'style'));
});

test('the primary layer lifts by nothing', () => {
  assert.match(
    src(),
    /return i > 0 \? i \* PHOTO_LAYER_STEP_M : 0;/,
    'lift() must be 0 at index 0 — otherwise every existing photo wall floats ' +
      'off its own panel in every room already built.',
  );
});

/* ── many decorations ─────────────────────────────────────────────────────── */

test('every chosen style contributes its decoration', () => {
  const s = src();
  for (const id of ['step_repeat', 'balloon_garland', 'neon_backdrop']) {
    assert.match(
      s,
      new RegExp(`styles\\.includes\\('${id}'\\)`),
      `${id}'s decoration must be gated on membership, not on being the primary`,
    );
  }
  // ⚠ NOT a blanket ban on `style === …`. The PANEL still switches on the
  // primary, and must: one surface, primary wins. An earlier version of this
  // assertion banned the pattern outright and went red against the correct
  // implementation — the panel's own rule looked like the bug it was hunting.
  assert.match(
    s,
    /style === 'neon_backdrop'/,
    "the panel's material must still follow the primary — that IS the one-surface rule",
  );
});

test('greenery only tints the blossoms when it is the ONLY floral surface', () => {
  // Both chosen is a floral wall ON greenery. Green blossoms would read as the
  // flowers having been swapped out for leaves.
  assert.match(
    src(),
    /styles\.includes\('greenery_wall'\) && !styles\.includes\('floral_wall'\)/,
    'the leaf tint must stand down when a floral wall is also chosen',
  );
});

test('the zone is READ with selAll — the hole a sabotage found', () => {
  // Every other assertion in this file passes against `[sel(design, …)]`: a
  // one-element array still satisfies the panel rule, the membership gates, the
  // lift and the registry, while only the primary ever draws. The reader itself
  // has to be pinned, or the guard verifies the shape of a fix that is not
  // there.
  const s = src();
  assert.match(s, /selAll\(design, 'photo_wall', 'style'\)/, 'photo_wall must be read with selAll');
  assert.doesNotMatch(
    s,
    /sel\(design, 'photo_wall', 'style'\)/,
    'a leftover sel() for this zone means the primary-only bug is still live',
  );
});

test('"none" is an empty wall, never a layer', () => {
  const s = src();
  assert.match(s, /filter\(\(v\) => v !== 'none'\)/, "'none' means there is no photo wall");
  assert.match(s, /photoWallStyles\.length > 0/, 'an empty list renders nothing at all');
});

/* ── and the legend stops calling it primary-only ─────────────────────────── */

test('photo_wall has left the primary-only disclosure list', () => {
  assert.ok(
    !ROOM_DRAWN_ATTRIBUTES.map(([p]) => p).includes('photo_wall'),
    'the zone draws every pick now — listing it would make the legend describe a ' +
      'limitation that no longer exists.',
  );
});
