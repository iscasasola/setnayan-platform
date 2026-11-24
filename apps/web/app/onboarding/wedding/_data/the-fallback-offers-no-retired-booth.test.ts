/**
 * THE FALLBACK OFFERS NO RETIRED PRODUCT. When the sign-up read of onboarding_refinement_options fails
 * (lib/onboarding-refinements.ts → getOnboardingRefinements), sign-up shows the static REFINEMENTS_DATA instead.
 * The DB read already hides retired rows (status = 'active'), so the fallback has to as well. Otherwise a failed
 * read brings back the retired Video booth (photo_booth / 'Patiktok'). Sources: owner 2026-11-20 ("Retire
 * Patiktok and Music Maker", lib/retired-products.ts) and DECISION_LOG 2026-11-23 "Seven open calls settled",
 * item 7.
 *
 * Run (from apps/web): npx tsx --test app/onboarding/wedding/_data/the-fallback-offers-no-retired-booth.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REFINEMENTS_DATA, REFINEMENTS_BY_KEY } from './refinements';
import { RETIRED_ADD_ON_KEYS, RETIRED_PRODUCT_NAMES } from '@/lib/retired-products';

const retiredWords = new Set<string>([
  ...[...RETIRED_ADD_ON_KEYS].map((k) => k.toLowerCase()),
  ...RETIRED_PRODUCT_NAMES.map((n) => n.toLowerCase()),
]);

test('no fallback option is a retired product, by key or by label', () => {
  const hits: string[] = [];
  for (const leaf of REFINEMENTS_DATA) {
    for (const o of leaf.options) {
      if (retiredWords.has(o.key.toLowerCase()) || retiredWords.has(o.label.toLowerCase())) {
        hits.push(`${leaf.key}/${o.key} ("${o.label}")`);
      }
    }
  }
  assert.deepEqual(hits, [], `the fallback still offers a retired product: ${hits.join(', ')}`);
});

test('the photo booth fallback has no Video booth', () => {
  const booth = REFINEMENTS_BY_KEY['photo_booth'];
  assert.ok(booth, 'the photo_booth leaf is gone from the fallback');
  assert.ok(booth.options.length > 0, 'the photo_booth leaf lost every option');
  assert.equal(booth.options.find((o) => o.key === 'Patiktok'), undefined, 'the Video booth (key Patiktok) is back');
  assert.equal(booth.options.find((o) => o.label === 'Video booth'), undefined, 'a "Video booth" option is back');
});
