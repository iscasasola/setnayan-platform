/**
 * one-picked-place.test.ts — wedding sign-up's one picked area becomes the event's City or area (F-W2-02, walk 13 Nov).
 *
 * SABOTAGE: drop `std_film_venue_city: onePickedPlaceName(…)` from the wedding commit → the source test is RED; return
 * the key instead of the name → the first case is RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { onePickedPlaceName } from '@/lib/onboarding/one-picked-place';
import { isListedPlaceName } from '@/lib/listed-place';
import { stripComments } from '@/lib/strip-comments';

test('one pick → the listed place name the City or area field stores', () => {
  assert.equal(onePickedPlaceName(['tagaytay']), 'Tagaytay');
  assert.ok(isListedPlaceName(onePickedPlaceName(['tagaytay'])!), 'the stored name must pass the Maker’s own listed-place check');
});

test('two picks, none, or an unknown key → nothing is claimed', () => {
  assert.equal(onePickedPlaceName(['tagaytay', 'cebu']), null);
  assert.equal(onePickedPlaceName([]), null);
  assert.equal(onePickedPlaceName(null), null);
  assert.equal(onePickedPlaceName(['not-a-place']), null);
});

test('the wedding commit writes it', () => {
  const src = stripComments(readFileSync(join(import.meta.dirname, '..', '..', 'app/onboarding/wedding/actions.ts'), 'utf8'));
  assert.match(src, /std_film_venue_city:\s*onePickedPlaceName\(payload\.places\)/);
});
