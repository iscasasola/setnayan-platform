/**
 * Guard for the vendor public-visibility boundary.
 *
 * 🔒 OWNER RULING 2026-07-27 — "we only show shops that are ready", then
 * "demote. remove coming soon entirely."
 *
 * WHY THIS IS A TEST AND NOT JUST A COMMENT. Until that ruling,
 * `PUBLIC_SURFACE_VISIBILITIES` contained `coming_soon`, and the RLS policy
 * `vendor_profiles_public_read` mirrored it — so an unapproved vendor's row was
 * readable by anyone holding the publishable anon key. Confirmed against
 * production that day: a plain GET returned the shop's business name, contact
 * email and phone number while it sat `coming_soon` / `unverified`.
 *
 * `/explore` did filter `verification_state = 'verified'` in the app query, which
 * is exactly why the exposure went unnoticed — the UI looked correct while the
 * boundary underneath it was open. Widening this array again re-opens that hole,
 * so it is pinned here rather than left to review.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSIGNABLE_VISIBILITIES,
  DEFAULT_PRIVATE_VISIBILITY,
  PUBLIC_SURFACE_VISIBILITIES,
  VENDOR_PUBLIC_VISIBILITIES,
  isBookable,
  isPubliclyVisible,
  parseVisibility,
} from './vendor-visibility';

test('only `verified` is publicly visible — nothing else may be added', () => {
  assert.deepEqual(
    [...PUBLIC_SURFACE_VISIBILITIES],
    ['verified'],
    'Adding a value here is a PRIVACY change: it exposes unapproved vendor rows ' +
      '(name, contact email, phone) to anyone with the anon key. It must be ' +
      'accompanied by a matching change to the vendor_profiles_public_read RLS ' +
      'policy and an owner decision — the 2026-07-27 ruling says ready shops only.',
  );
});

test('`coming_soon` is not public, not bookable, and not assignable', () => {
  assert.equal(isPubliclyVisible('coming_soon'), false);
  assert.equal(isBookable('coming_soon'), false);
  assert.ok(
    !ASSIGNABLE_VISIBILITIES.includes('coming_soon'),
    'the admin console must not be able to recreate the retired state',
  );
});

test('every non-verified state is private', () => {
  for (const v of VENDOR_PUBLIC_VISIBILITIES) {
    if (v === 'verified') continue;
    assert.equal(isPubliclyVisible(v), false, `${v} must not be publicly visible`);
    assert.equal(isBookable(v), false, `${v} must not be bookable`);
  }
  assert.equal(isPubliclyVisible('verified'), true);
  assert.equal(isBookable('verified'), true);
});

test('listed and bookable are the same thing now', () => {
  // The gap between them existed only to serve `coming_soon` (listed, not
  // bookable). With that retired, any divergence is a bug.
  for (const v of VENDOR_PUBLIC_VISIBILITIES) {
    assert.equal(
      isPubliclyVisible(v),
      isBookable(v),
      `${v}: a shop is either ready (listed AND bookable) or private`,
    );
  }
});

test('parseVisibility FAILS CLOSED on junk, null and unknown values', () => {
  // The old fallback was `coming_soon`, which was publicly readable — so a
  // null/legacy/garbled column silently produced a PUBLIC vendor.
  for (const bad of [null, undefined, '', 'COMING_SOON', 'published', 42, {}, []]) {
    const parsed = parseVisibility(bad);
    assert.equal(parsed, DEFAULT_PRIVATE_VISIBILITY, `parseVisibility(${JSON.stringify(bad)})`);
    assert.equal(
      isPubliclyVisible(parsed),
      false,
      'an unrecognised visibility must never resolve to an exposed one',
    );
  }
});

test('valid values still round-trip', () => {
  for (const v of VENDOR_PUBLIC_VISIBILITIES) {
    assert.equal(parseVisibility(v), v);
  }
});

test('the private resting state is itself private', () => {
  assert.equal(isPubliclyVisible(DEFAULT_PRIVATE_VISIBILITY), false);
  assert.ok(ASSIGNABLE_VISIBILITIES.includes(DEFAULT_PRIVATE_VISIBILITY));
});
