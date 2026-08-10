import assert from 'node:assert/strict';
import { test } from 'node:test';

import { VENDOR_PROFILE_PII_SCRUB } from './coverage';

/**
 * A closed shop keeps its trading name. Owner ruling 2026-08-10.
 *
 * *"their old shop's name will never be deleted (unless manual delete by
 * admin)."* — put to the owner a second time with the privacy cost spelled out,
 * and reaffirmed with a single word.
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────
 * Removing `business_name` from the scrub broke **nothing**. Not one test in
 * either erasure suite noticed — and a control proves that is specific to this
 * column rather than the suites being decorative: removing `contact_email` from
 * the same object turns one red immediately. The generic check looks for
 * columns nulled to NULL, and `business_name` is NOT NULL so it was scrubbed to
 * an empty string, which slipped past the shape the check looks for.
 *
 * 🔑 SO THE OLD BEHAVIOUR WAS UNPINNED AND THE NEW ONE WOULD BE TOO. A future
 * session tidying the scrub list could put the line back and every suite would
 * stay green, quietly reversing a decision the owner made in writing. A ruling
 * that only lives in a comment is a ruling with a half-life.
 */

test('the shop name survives erasure — owner-locked', () => {
  assert.ok(
    !('business_name' in VENDOR_PROFILE_PII_SCRUB),
    'business_name is being scrubbed again — owner ruled 2026-08-10 that a closed ' +
      "shop's name is never deleted except by an admin. Reversing that is an owner " +
      'and DPO decision, not a tidy-up.',
  );
});

test('the PERSON behind the shop is still erased — this is a narrow exception', () => {
  // 🔴 The cost of the ruling, held to its stated boundary. A sole-proprietor
  // shop is often named after its owner, and the argument that makes keeping
  // the trading name defensible is that it is a public COMMERCIAL identity. That
  // argument covers the shop's name and nothing else — so every field that is
  // plainly about the person must still go, or the exception has quietly grown
  // into a general one.
  for (const column of [
    'business_owner_name',
    'business_owner_position',
    'contact_email',
    'contact_phone',
    'hq_address',
    'hq_latitude',
    'hq_longitude',
    'logo_url',
  ]) {
    assert.ok(
      column in VENDOR_PROFILE_PII_SCRUB,
      `${column} stopped being erased — the shop-name exception has widened past what was ruled`,
    );
  }
});

test('the ADDRESS is still released — kept for a year, not forever', () => {
  // Keeping the slug on the row would reserve the word permanently, which is
  // the opposite of "available again after 1 year". It is nulled here and held
  // in slug_change_log with a one-year expiry that releases itself.
  assert.ok('business_slug' in VENDOR_PROFILE_PII_SCRUB);
  assert.equal(
    (VENDOR_PROFILE_PII_SCRUB as Record<string, unknown>).business_slug,
    null,
    'the address must leave the profile row, or it is reserved forever',
  );
});

test('the exception is exactly one column wide', () => {
  // Guards the shape of the ruling rather than any single field: if a second
  // name-ish column ever leaves the scrub, someone has to come back here and
  // say so out loud.
  const kept = ['business_name'];
  const nameish = ['business_name', 'business_owner_name', 'registered_business_name'];
  const missing = nameish.filter((c) => !(c in VENDOR_PROFILE_PII_SCRUB));
  assert.deepEqual(
    missing,
    kept,
    'more than the shop name is now surviving erasure — that was not what was ruled',
  );
});
