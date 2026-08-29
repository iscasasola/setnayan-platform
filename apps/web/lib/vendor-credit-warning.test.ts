/**
 * A SHOP IS WARNED BEFORE ITS CREDIT GOES — the window, the key and the words.
 *
 * 🔑 WHY THESE ASSERT THE UPPER BOUND AS HARD AS THE LOWER ONE: the whole
 * feature is the word BEFORE. A rule that fired on an already-lapsed term would
 * send "about to expire" about money that is already gone, which is worse than
 * silence — it is a false statement about somebody's balance.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CREDIT_WARNING_WINDOW_DAYS,
  creditWarningCopy,
  creditWarningKey,
  shouldWarnAboutCredit,
} from './vendor-credit-warning';

const NOW = Date.parse('2026-08-29T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function shop(overrides: Partial<Parameters<typeof shouldWarnAboutCredit>[0]> = {}) {
  return {
    vendorProfileId: 'd266c234-3aca-46c3-b1c8-6a5c78e3f310',
    ownerUserId: 'user-1',
    businessName: 'Banawe Studios',
    creditPhp: 2500,
    tierExpiresAt: new Date(NOW + 3 * DAY).toISOString(),
    ...overrides,
  };
}

test('a shop inside the window, carrying credit, is warned', () => {
  assert.equal(shouldWarnAboutCredit(shop(), NOW), true);
});

test('a term that has ALREADY passed is never warned', () => {
  // The money is gone at that shop's next visit no matter what we send, so
  // "about to expire" would be false. This is the bound that makes the feature
  // honest, and it is the one an off-by-one would silently remove.
  const lapsed = shop({ tierExpiresAt: new Date(NOW - 1 * DAY).toISOString() });
  assert.equal(shouldWarnAboutCredit(lapsed, NOW), false);
});

test('a term further out than the window is left alone until it gets close', () => {
  const far = shop({
    tierExpiresAt: new Date(NOW + (CREDIT_WARNING_WINDOW_DAYS + 1) * DAY).toISOString(),
  });
  assert.equal(shouldWarnAboutCredit(far, NOW), false);

  const justInside = shop({
    tierExpiresAt: new Date(NOW + CREDIT_WARNING_WINDOW_DAYS * DAY - 1000).toISOString(),
  });
  assert.equal(shouldWarnAboutCredit(justInside, NOW), true, 'the edge of the window is inside it');
});

test('a shop with no credit is not interrupted', () => {
  assert.equal(shouldWarnAboutCredit(shop({ creditPhp: 0 }), NOW), false);
});

test('a shop with no expiry date is not warned', () => {
  assert.equal(shouldWarnAboutCredit(shop({ tierExpiresAt: null }), NOW), false);
});

test('a malformed date says nothing rather than warning about now', () => {
  /*
    ⚠ THIS PINS THE OUTCOME, NOT THE LINE — said plainly because the first
    version of this test claimed otherwise and could not fail.

    `Date.parse` returns NaN, and EVERY comparison with NaN is false, so the
    window arithmetic alone already refuses these. Deleting the explicit
    `Number.isFinite` guard in the source does NOT change any result here — a
    mutation run proved it, staying green with the guard gutted.

    The explicit guard stays because it states the intent for whoever edits the
    comparison next; this test stays because the OUTCOME is what matters to a
    shop. Neither is pretending to be the other.
  */
  for (const bad of ['not a date', '', '   ', 'null', '2026-13-45T00:00:00Z']) {
    assert.equal(
      shouldWarnAboutCredit(shop({ tierExpiresAt: bad }), NOW),
      false,
      `a malformed expiry (${JSON.stringify(bad)}) must never produce a warning`,
    );
  }
});

test('a shop with no owner account has nobody to tell', () => {
  assert.equal(shouldWarnAboutCredit(shop({ ownerUserId: null }), NOW), false);
});

test('the key carries the TERM, so a renewed shop is warned again next time', () => {
  const first = creditWarningKey('shop-1', '2026-09-01T00:00:00.000Z');
  const second = creditWarningKey('shop-1', '2026-10-01T00:00:00.000Z');

  assert.notEqual(
    first,
    second,
    'a per-shop key would warn a shop once in its life and stay silent on every later term',
  );
  assert.equal(
    creditWarningKey('shop-1', '2026-09-01T00:00:00.000Z'),
    first,
    'the same term must produce the same key, or the sweep re-sends on every run',
  );
});

test('the words name the amount and the date, because "some credit soon" cannot be acted on', () => {
  const { title, body } = creditWarningCopy({
    creditPhp: 2500,
    tierExpiresAt: '2026-09-01T04:00:00.000Z',
  });

  assert.match(title, /₱2,500/, 'the amount must be in the title');
  assert.match(title, /September 1, 2026/, 'the date must be in the title');
  assert.match(body, /renew before then/i, 'it must say what to do about it');
});

test('the date is rendered in Manila time, not the server clock', () => {
  // 2026-09-01T20:00Z is already 2 September in Manila. A server-clock render
  // prints the day before for a shop reading its own deadline — the date-is-not-
  // an-instant trap, pointed at a deadline somebody has to act on.
  const { title } = creditWarningCopy({
    creditPhp: 100,
    tierExpiresAt: '2026-09-01T20:00:00.000Z',
  });
  assert.match(title, /September 2, 2026/, 'the venue clock decides the day, not UTC');
});
