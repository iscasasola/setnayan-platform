/**
 * venue-archetype-coverage.test.ts — every venue a host can choose must have a
 * look of its OWN.
 *
 * THE DEFECT THIS EXISTS FOR (owner: "build it", 2026-08-06). `venue_setting`
 * offered eight choices and the 3D plan drew six archetypes, mapping only four.
 * `destination`, `heritage` and `civil_registrar` all fell through `default:`
 * and were drawn as a hotel ballroom — a couple marrying at the registrar's
 * office was shown a grand hall. Meanwhile `chapel` and `rooftop` were fully
 * drawn and NO host could ever select them.
 *
 * 🪤 NOTHING FAILED. Every one of those settings rendered a perfectly good room,
 * just the wrong one, and a fall-through in a `switch` with a `default:` is
 * invisible to the typechecker. That is the whole reason this file reads the
 * mapping rather than trusting types.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { VENUE_SETTINGS } from './venue-settings';
import { archetypeFor } from '@/app/_components/plan3d/venue-decor';

test('every venue a host can choose maps to a deliberate archetype', () => {
  // `banquet_hall` is the only setting allowed to resolve to the fall-back
  // archetype, because that IS its archetype. Anything else resolving there is
  // a setting nobody drew.
  for (const setting of VENUE_SETTINGS) {
    const got = archetypeFor(setting);
    if (setting === 'banquet_hall') {
      assert.equal(got, 'banquet_hall');
      continue;
    }
    assert.notEqual(
      got,
      'banquet_hall',
      `'${setting}' still falls through to the ballroom. A couple choosing it is ` +
        `shown a room that is not theirs — and nothing errors, so nobody finds out.`,
    );
  }
});

test('an unknown value still lands somewhere real', () => {
  // Fail SOFT for anything unrecognised: a guest must always get a room they can
  // walk, never a blank scene.
  assert.equal(archetypeFor('something_nobody_added_yet'), 'banquet_hall');
  assert.equal(archetypeFor(null), 'banquet_hall');
  assert.equal(archetypeFor(undefined), 'banquet_hall');
});

test('the settings that were wrong now resolve to their own look', () => {
  assert.equal(archetypeFor('restaurant'), 'restaurant');
  assert.equal(archetypeFor('heritage'), 'heritage');
  assert.equal(archetypeFor('civil_registrar'), 'civic');
  // ⚠ A JUDGEMENT CALL, pinned here so reversing it is deliberate rather than
  // accidental: "destination" means away-from-home, not a room shape, and the
  // corpus called it genuinely ambiguous. In the Philippines a destination
  // resort is overwhelmingly beachfront, so sand reads truer than a ballroom.
  assert.equal(archetypeFor('destination'), 'beach');
});

test('the two built-but-unreachable looks are still reachable in code', () => {
  // chapel and rooftop have always been drawn. Making them SELECTABLE is a
  // database change that ships separately; this only pins that the mapping
  // survives until then, so the follow-up is one migration and not a redraw.
  assert.equal(archetypeFor('chapel'), 'chapel');
  assert.equal(archetypeFor('rooftop'), 'rooftop');
});
