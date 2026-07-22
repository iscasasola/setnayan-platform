import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveVendorPhotoChallengePricePhp,
  photoChallengeEligibility,
  VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP,
  type PhotoChallengeEligibilityInput,
} from './vendor-photo-challenge';

// ── resolveVendorPhotoChallengePricePhp ─────────────────────────────────────

test('price: the admin-managed catalog value flows straight through', () => {
  assert.equal(resolveVendorPhotoChallengePricePhp(400), 400);
  // An admin reprice flows through unchanged.
  assert.equal(resolveVendorPhotoChallengePricePhp(500), 500);
});

test('price: missing/invalid catalog value falls back to ₱400', () => {
  assert.equal(resolveVendorPhotoChallengePricePhp(), VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP);
  assert.equal(resolveVendorPhotoChallengePricePhp(400), VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP);
  assert.equal(resolveVendorPhotoChallengePricePhp(0), 400);
  assert.equal(resolveVendorPhotoChallengePricePhp(-5), 400);
  assert.equal(resolveVendorPhotoChallengePricePhp(null), 400);
  assert.equal(resolveVendorPhotoChallengePricePhp(Number.NaN), 400);
});

// ── photoChallengeEligibility ───────────────────────────────────────────────

// The happy path: a booked, verified Pro vendor on a Papic-active event that
// they haven't sponsored yet.
const OK: PhotoChallengeEligibilityInput = {
  tier: 'pro',
  verification: 'verified',
  booked: true,
  papicActive: true,
  alreadySponsored: false,
};

test('eligible: booked verified Pro on a Papic-active event → ok', () => {
  assert.deepEqual(photoChallengeEligibility(OK), { ok: true });
});

test('eligible: Enterprise and Custom pass; Solo/Verified/Free do not', () => {
  assert.equal(photoChallengeEligibility({ ...OK, tier: 'enterprise' }).ok, true);
  assert.equal(photoChallengeEligibility({ ...OK, tier: 'custom' }).ok, true);
  for (const tier of ['solo', 'verified', 'free', null, undefined, 'garbage']) {
    assert.deepEqual(
      photoChallengeEligibility({ ...OK, tier }),
      { ok: false, reason: 'tier_too_low' },
      `tier ${String(tier)} must be denied`,
    );
  }
});

test('denied: paid tier but unverified', () => {
  assert.deepEqual(photoChallengeEligibility({ ...OK, verification: 'pending' }), {
    ok: false,
    reason: 'unverified',
  });
  assert.deepEqual(photoChallengeEligibility({ ...OK, verification: null }), {
    ok: false,
    reason: 'unverified',
  });
});

test('denied: not booked on the event', () => {
  assert.deepEqual(photoChallengeEligibility({ ...OK, booked: false }), {
    ok: false,
    reason: 'not_booked',
  });
});

test('denied: Papic not active on the event (the Papic gate)', () => {
  assert.deepEqual(photoChallengeEligibility({ ...OK, papicActive: false }), {
    ok: false,
    reason: 'papic_inactive',
  });
});

test('denied: already sponsored for this event (one per vendor per event)', () => {
  assert.deepEqual(photoChallengeEligibility({ ...OK, alreadySponsored: true }), {
    ok: false,
    reason: 'already_sponsored',
  });
});

test('gate order matches the action: tier → verification → booked → papic → sponsored', () => {
  // Every gate failing at once surfaces the FIRST reason (tier), so the UI copy
  // always matches what a submit would reject with.
  assert.deepEqual(
    photoChallengeEligibility({
      tier: 'free',
      verification: null,
      booked: false,
      papicActive: false,
      alreadySponsored: true,
    }),
    { ok: false, reason: 'tier_too_low' },
  );
  // Pro but everything else failing → verification is the next gate.
  assert.deepEqual(
    photoChallengeEligibility({
      tier: 'pro',
      verification: null,
      booked: false,
      papicActive: false,
      alreadySponsored: true,
    }),
    { ok: false, reason: 'unverified' },
  );
});
