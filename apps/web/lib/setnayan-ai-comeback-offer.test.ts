/**
 * THE 24H COMEBACK OFFER — window boundaries, ownership exclusion, and that
 * its price math agrees with `signupPriceFor` (the one rounding rule every
 * discount in this app uses).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMEBACK_OFFER_DISCOUNT_PCT,
  COMEBACK_OFFER_WINDOW_HOURS,
  comebackPriceCentavos,
  comebackPricePhp,
  isComebackOfferEligible,
  resolveComebackWindow,
} from './setnayan-ai-comeback-offer';
import { signupPriceFor } from './onboarding-family-discount';

const HOUR_MS = 60 * 60 * 1000;

test('the window is active right up to the 24h boundary and lapsed after', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const justBefore = new Date(createdAt.getTime() + COMEBACK_OFFER_WINDOW_HOURS * HOUR_MS - 1);
  const atBoundary = new Date(createdAt.getTime() + COMEBACK_OFFER_WINDOW_HOURS * HOUR_MS);
  const justAfter = new Date(createdAt.getTime() + COMEBACK_OFFER_WINDOW_HOURS * HOUR_MS + 1);

  assert.equal(resolveComebackWindow(createdAt, justBefore)?.active, true);
  // AT the boundary the window has fully elapsed — `active` compares with `<`,
  // not `<=`, so the offer does not linger one extra tick past 24h exactly.
  assert.equal(resolveComebackWindow(createdAt, atBoundary)?.active, false);
  assert.equal(resolveComebackWindow(createdAt, justAfter)?.active, false);
});

test('missing or unparseable created_at is null, never "eligible forever"', () => {
  assert.equal(resolveComebackWindow(null), null);
  assert.equal(resolveComebackWindow(undefined), null);
  assert.equal(resolveComebackWindow('not-a-date'), null);
});

test('an event that already owns Setnayan AI is never eligible, window or not', () => {
  const now = new Date('2026-01-01T01:00:00.000Z');
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(
    isComebackOfferEligible({ setnayan_ai_active: true, created_at: createdAt }, now),
    false,
  );
});

test('eligible only while unowned AND inside the window', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const inWindow = new Date(createdAt.getTime() + 1 * HOUR_MS);
  const outsideWindow = new Date(createdAt.getTime() + 25 * HOUR_MS);

  assert.equal(
    isComebackOfferEligible({ setnayan_ai_active: false, created_at: createdAt }, inWindow),
    true,
  );
  assert.equal(
    isComebackOfferEligible({ setnayan_ai_active: null, created_at: createdAt }, inWindow),
    true,
  );
  assert.equal(
    isComebackOfferEligible({ setnayan_ai_active: false, created_at: createdAt }, outsideWindow),
    false,
  );
  assert.equal(isComebackOfferEligible(null), false);
});

test('the comeback price is exactly signupPriceFor at the comeback percentage', () => {
  for (const regular of [1499, 899, 499, 99, 2499]) {
    assert.equal(
      comebackPricePhp(regular),
      signupPriceFor(regular, COMEBACK_OFFER_DISCOUNT_PCT),
      `₱${regular} at ${COMEBACK_OFFER_DISCOUNT_PCT}% must match the shared rounding rule`,
    );
  }
});

test('comebackPriceCentavos is the peso price ×100, never independently rounded', () => {
  const regularCentavos = 149_900; // ₱1,499.00
  const centavos = comebackPriceCentavos(regularCentavos);
  const php = comebackPricePhp(1499);
  assert.equal(centavos, Math.round(php! * 100));
});

test('comebackPriceCentavos refuses a negative or non-finite input', () => {
  assert.equal(comebackPriceCentavos(-1), null);
  assert.equal(comebackPriceCentavos(Number.NaN), null);
});
