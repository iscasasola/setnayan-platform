import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP,
  VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS,
  isPhotoChallengeSubscriptionActive,
  nextPhotoChallengeExpiry,
  photoChallengeEventReady,
  photoChallengePurchaseEligibility,
  PHOTO_CHALLENGE_MIN_TIER,
  resolveVendorPhotoChallengePricePhp,
  PHOTO_CHALLENGE_DENY_MESSAGE,
} from './vendor-photo-challenge';

/**
 * Papic Challenges — owner 2026-08-28: "unlimited us 2500 for 4 weeks."
 * ₱2,500 / 28 days, unlimited, replacing the ₱400-per-event sponsorship.
 */

// ── price ───────────────────────────────────────────────────────────────────

test('the catalog price wins; the fallback is the owner’s number', () => {
  assert.equal(resolveVendorPhotoChallengePricePhp(2500), 2500);
  assert.equal(resolveVendorPhotoChallengePricePhp(3000), 3000, 'an admin edit wins');
  assert.equal(VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP, 2500);
});

test('an unreadable catalog falls back to 2,500 — never to the retired ₱400', () => {
  // A fallback that lags the owner's price is how an unreadable catalog quietly
  // sells a 28-day subscription for the old per-event fee.
  for (const bad of [null, undefined, 0, -1, Number.NaN]) {
    assert.equal(
      resolveVendorPhotoChallengePricePhp(bad as number | null),
      2500,
      `a ${String(bad)} catalog price must fall back to the owner's figure`,
    );
  }
});

test('one cycle is 28 days — "4 weeks", the platform cadence', () => {
  assert.equal(VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS, 28);
});

// ── the window ──────────────────────────────────────────────────────────────

const T0 = Date.parse('2027-03-01T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

test('a window is live until it is not', () => {
  assert.equal(isPhotoChallengeSubscriptionActive(null, T0), false);
  assert.equal(isPhotoChallengeSubscriptionActive(undefined, T0), false);
  assert.equal(isPhotoChallengeSubscriptionActive('not-a-date', T0), false);
  assert.equal(
    isPhotoChallengeSubscriptionActive(new Date(T0 + 1).toISOString(), T0),
    true,
  );
  assert.equal(
    isPhotoChallengeSubscriptionActive(new Date(T0 - 1).toISOString(), T0),
    false,
    'lapse is evaluated at read time — nothing sweeps it, and nothing needs to',
  );
});

test('a first purchase buys 28 days from now', () => {
  assert.equal(nextPhotoChallengeExpiry(null, T0), new Date(T0 + 28 * DAY).toISOString());
});

test('renewing EARLY keeps the time already paid for', () => {
  const live = new Date(T0 + 10 * DAY).toISOString();
  assert.equal(
    nextPhotoChallengeExpiry(live, T0),
    new Date(T0 + 38 * DAY).toISOString(),
    'a shop that renews with 10 days left gets 38, not 28',
  );
});

test('renewing after a LAPSE starts from today, not from the dead expiry', () => {
  const lapsed = new Date(T0 - 40 * DAY).toISOString();
  assert.equal(
    nextPhotoChallengeExpiry(lapsed, T0),
    new Date(T0 + 28 * DAY).toISOString(),
    'stacking onto a past expiry would sell a window that is already over',
  );
});

// ── can this shop BUY it? ───────────────────────────────────────────────────

const BUY_OK = {
  tier: 'pro',
  verification: 'verified',
  subscriptionActive: false,
} as const;

test('a verified paid shop may turn it on', () => {
  assert.deepEqual(photoChallengePurchaseEligibility(BUY_OK), { ok: true });
  assert.equal(
    photoChallengePurchaseEligibility({ ...BUY_OK, tier: 'enterprise' }).ok,
    true,
  );
  assert.equal(photoChallengePurchaseEligibility({ ...BUY_OK, tier: 'custom' }).ok, true);
});

test('THE PAID PLANS BUY IT, THE FREE ONES DO NOT — owner 2026-08-29', () => {
  // ⚠ THIS ASSERTION WAS REWRITTEN, NOT WEAKENED. It read "below Pro is refused —
  // unless the 2026-07-25 tiered model is on", which is the shape the owner
  // struck: one switch decided both the PRICE BAND and WHO MAY BUY, so flipping
  // it on (he did, the same day) admitted free shops, and flipping it off
  // refused Solo. He wants Solo in and free out — a combination the old shape
  // could not express at any setting.
  //
  // Verbatim: *"they can only but if they are solo,pro,enterprise,custom. but
  // not when they are free"*.
  for (const tier of ['solo', 'pro', 'enterprise', 'custom']) {
    assert.equal(
      photoChallengePurchaseEligibility({ ...BUY_OK, tier }).ok,
      true,
      `${tier} is a paid plan and must be admitted`,
    );
  }
  for (const tier of ['free', 'verified']) {
    assert.deepEqual(
      photoChallengePurchaseEligibility({ ...BUY_OK, tier }),
      { ok: false, reason: 'tier_too_low' },
      // `verified` is the LEGACY FREE tier — a real business on the ₱0 plan. The
      // owner named neither it nor `free` explicitly on the refusing side; he
      // said "not when they are free", and both of these are free.
      `${tier} costs nothing and must be refused`,
    );
  }
});

test('THE FLOOR IS UNCONDITIONAL — no price switch can lift it', () => {
  // The whole point of the rewrite. `photoChallengePurchaseEligibility` no
  // longer HAS a lever that admits a free shop; if one is reintroduced, this
  // stops compiling or stops passing.
  const keys = Object.keys(BUY_OK);
  assert.ok(
    !keys.includes('allTiersAllowed'),
    'the purchase gate must not take an all-tiers lever again',
  );
  assert.equal(PHOTO_CHALLENGE_MIN_TIER, 'solo');
  assert.equal(photoChallengePurchaseEligibility({ ...BUY_OK, tier: 'free' }).ok, false);
});

test('VERIFIED-THE-STATE is still required on every paid plan', () => {
  // Not to be confused with `verified`-the-TIER refused above: this is
  // verification_state, and it gates every plan including Custom.
  for (const tier of ['solo', 'pro', 'enterprise', 'custom']) {
    assert.deepEqual(
      photoChallengePurchaseEligibility({ ...BUY_OK, tier, verification: 'pending' }),
      { ok: false, reason: 'unverified' },
    );
  }
  assert.deepEqual(
    photoChallengePurchaseEligibility({ ...BUY_OK, verification: null }),
    { ok: false, reason: 'unverified' },
  );
});

test('the tier is checked BEFORE verification, so a free shop is told the true reason', () => {
  // A free unverified shop hears "you need a paid plan", not "get verified" —
  // getting verified would not admit them, and sending somebody to do work that
  // cannot help is worse than saying no.
  assert.deepEqual(
    photoChallengePurchaseEligibility({
      ...BUY_OK,
      tier: 'free',
      verification: 'pending',
    }),
    { ok: false, reason: 'tier_too_low' },
  );
});

test('a shop with a live window is not sold a second one', () => {
  assert.deepEqual(
    photoChallengePurchaseEligibility({ ...BUY_OK, subscriptionActive: true }),
    { ok: false, reason: 'already_subscribed' },
  );
});

test('BUYING ASKS NOTHING ABOUT AN EVENT — the whole point of the repricing', () => {
  // Under ₱400-per-event this same decision took `booked` and `papicActive`,
  // because the thing being bought WAS one celebration. A shop subscription
  // gated on a booking is a purchase hidden behind a booking.
  const keys = Object.keys(BUY_OK);
  assert.ok(!keys.includes('booked'), 'the purchase gate must not ask about a booking');
  assert.ok(!keys.includes('papicActive'), 'nor about one celebration’s Papic');
  assert.equal(photoChallengePurchaseEligibility(BUY_OK).ok, true);
});

// ── can this shop RUN one HERE? ─────────────────────────────────────────────

const RUN_OK = { booked: true, papicActive: true, entitled: true } as const;

test('booked + Papic on + entitled ⇒ the composer opens', () => {
  assert.deepEqual(photoChallengeEventReady(RUN_OK), { ok: true });
});

test('the reason names the thing that is actually in the way, in order', () => {
  assert.deepEqual(photoChallengeEventReady({ ...RUN_OK, booked: false }), {
    ok: false,
    reason: 'not_booked',
  });
  assert.deepEqual(photoChallengeEventReady({ ...RUN_OK, papicActive: false }), {
    ok: false,
    reason: 'papic_inactive',
  });
  assert.deepEqual(photoChallengeEventReady({ ...RUN_OK, entitled: false }), {
    ok: false,
    reason: 'not_subscribed',
  });
});

test('NOT BOOKED outranks NOT SUBSCRIBED — never sell a fix that fixes nothing', () => {
  // Paying does not make you booked, so a shop told "subscribe" for a
  // celebration they are not booked on has been sold something inert.
  assert.deepEqual(
    photoChallengeEventReady({ booked: false, papicActive: false, entitled: false }),
    { ok: false, reason: 'not_booked' },
  );
});

test('"already subscribed" INVERTS between the two questions', () => {
  // The exact reason these are two functions: the same fact denies a purchase
  // and permits a challenge. A single combined gate had to pick one.
  assert.equal(
    photoChallengePurchaseEligibility({ ...BUY_OK, subscriptionActive: true }).ok,
    false,
  );
  assert.equal(photoChallengeEventReady({ ...RUN_OK, entitled: true }).ok, true);
});

// ── copy ────────────────────────────────────────────────────────────────────

test('every deny reason has copy, and none of it quotes a price', () => {
  const reasons = [
    'tier_too_low',
    'unverified',
    'already_subscribed',
    'not_booked',
    'papic_inactive',
    'not_subscribed',
  ] as const;
  for (const r of reasons) {
    const msg = PHOTO_CHALLENGE_DENY_MESSAGE[r];
    assert.ok(msg && msg.length > 10, `${r} needs a real sentence`);
    assert.ok(
      !/₱|\bP\d/.test(msg),
      `${r} must not carry a price — prices come from the catalog, never from copy: "${msg}"`,
    );
  }
  assert.equal(Object.keys(PHOTO_CHALLENGE_DENY_MESSAGE).length, reasons.length);
});

test('the not-subscribed sentence promises EVERY celebration, not this one', () => {
  assert.match(
    PHOTO_CHALLENGE_DENY_MESSAGE.not_subscribed,
    /every other celebration/,
    'the whole product change is "unlimited"; the sentence has to say so',
  );
});
