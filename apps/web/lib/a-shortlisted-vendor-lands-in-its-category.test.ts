/**
 * A vendor saved to a shortlist lands in the category the couple was browsing.
 *
 * ── THE BUG (production, 2026-09-08) ───────────────────────────────────────
 * Owner: *"when i visited bench, the service cards is not there on the
 * shortlist since i pressed inquire."* The row HAD been created:
 *
 *     vendor_name: Saysay Live Band & Hosting (FIXTURE)
 *     category:    misc          ← the fallback
 *     status:      considering
 *
 * The bench's **Live Band** row looks for `live_band`, so a supplier the couple
 * had just inquired with was on their shortlist and invisible on the row that
 * would show them. The same fallback rendered "INQUIRING ABOUT: Miscellaneous"
 * on the thread header.
 *
 * 🔑 THE FUNCTION IT CALLED WARNS AGAINST THIS USE AND NAMES ITS REPLACEMENT.
 * `resolveVendorCategory`: *"LEAF-KEYED, AND IT COVERS 52 OF 246 LIVE LEAVES …
 * Do NOT reach for it to classify an arbitrary service — 194 live leaves land in
 * `misc` here. Use `vendorCategoryForLeaf` below."* And the owner had already
 * ruled on the symptom (2026-08-09): *"we do not like having categories under
 * misc."*
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { vendorCategoryForLeaf, resolveVendorCategory } from '@/lib/vendor-packages';

const HERE = dirname(fileURLToPath(import.meta.url));
const action = stripComments(
  readFileSync(resolve(HERE, '../app/(shell)/explore/actions.ts'), 'utf8'),
);

test('the tile ids production actually stores resolve to a real category', () => {
  // These are the values `vendor_profiles.services` holds — tile ids, per
  // lib/card-kind-labeller.ts. Every one of them used to land in `misc`.
  for (const [tile, expected] of [
    ['live_band', 'band_dj'],
    ['host_mc', 'host_emcee'],
    ['dj', 'band_dj'],
    ['choir', 'choir'],
    ['cake', 'cake_maker'],
    ['florist', 'florist'],
  ] as const) {
    assert.equal(
      vendorCategoryForLeaf(tile, tile),
      expected,
      `${tile} no longer resolves to a real category — a shop saved under it ` +
        'becomes invisible on its own bench row',
    );
  }
});

test('the shortlist save uses the resolver that covers every leaf', () => {
  assert.match(
    action,
    /vendorCategoryForLeaf\(s, s\)/,
    'coerceCategory went back to a leaf-only resolver; 194 of 246 live leaves ' +
      'land in misc there, and its own docblock says not to use it this way',
  );
  assert.ok(
    !/resolveVendorCategory\(/.test(action),
    'the save calls resolveVendorCategory again — the function that warns ' +
      'against exactly this use',
  );
});

test('a correctly-stored canonical leaf is unaffected', () => {
  // The leaf arm is tried first, so shops stored the right way keep their
  // precise category rather than being coarsened to a branch.
  assert.equal(vendorCategoryForLeaf('host_emcee', 'host_mc'), 'host_emcee');
  assert.equal(resolveVendorCategory('host_emcee'), 'host_emcee');
});

test('an unknown value still degrades to misc rather than guessing', () => {
  // Widening the resolver must not make it invent a category for a string
  // nobody has ever defined.
  assert.equal(vendorCategoryForLeaf('not_a_real_service', 'not_a_real_tile'), 'misc');
});
