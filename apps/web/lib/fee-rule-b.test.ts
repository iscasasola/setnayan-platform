/**
 * Fee rule B (owner 2026-10-10, answer 1 "B") and the owner's price check
 * (answer 2: "10% allowance +-. so if 100,000 that is between 90-110k") — the
 * app's half. The SQL half (`booking_fee_attribution_for`) is held to the same
 * answers by `tests/db/add-your-own-fee-rule.db.test.ts`, which imports
 * `FEE_RULE_B_CASES` from here so the two can only ever be asked the same thing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FEE_LEAK_PRICE_TOLERANCE_DEFAULT,
  manualAddFeeAttribution,
  priceWithinTolerance,
  type BookingFeeAttribution,
  type ManualAddFeeFacts,
} from './booking-fee-gate';
import { FEE_RULE_B_CASES } from './fee-rule-b-cases';

test('every rule-B case gives the answer the owner ruled', () => {
  assert.ok(FEE_RULE_B_CASES.length >= 8, 'the case table shrank');
  for (const c of FEE_RULE_B_CASES) {
    assert.equal(manualAddFeeAttribution(c.facts), c.expect, c.name);
  }
});

test('a sourced view only counts for a record tied to that shop', () => {
  const facts: ManualAddFeeFacts = { threadSources: [], recordTiedToShop: false, viewSourcesBeforeRecord: ['explore'] };
  assert.equal(manualAddFeeAttribution(facts), 'import');
  assert.equal(manualAddFeeAttribution({ ...facts, recordTiedToShop: true }), 'sourced');
});

test("the shop's own link (profile_direct) and the supplier's own website never make it sourced", () => {
  for (const s of ['profile_direct', 'website', 'host_manual', 'invite_claim', null]) {
    const got: BookingFeeAttribution = manualAddFeeAttribution({
      threadSources: [],
      recordTiedToShop: true,
      viewSourcesBeforeRecord: [s],
    });
    assert.equal(got, 'import', String(s));
  }
});

test("the owner's example: ₱100,000 → ₱90,000–₱110,000 is the same price, inclusive", () => {
  const t = FEE_LEAK_PRICE_TOLERANCE_DEFAULT;
  assert.equal(t, 0.1);
  assert.equal(priceWithinTolerance(90_000, 100_000, t), true);
  assert.equal(priceWithinTolerance(110_000, 100_000, t), true);
  assert.equal(priceWithinTolerance(100_000, 100_000, t), true);
  assert.equal(priceWithinTolerance(89_999, 100_000, t), false);
  assert.equal(priceWithinTolerance(110_001, 100_000, t), false);
  // The check document's own pair: ₱197,000 typed against a ₱198,000 quote.
  assert.equal(priceWithinTolerance(197_000, 198_000, t), true);
});

test('no price, a zero price or a broken tolerance is never a match', () => {
  assert.equal(priceWithinTolerance(null, 100_000, 0.1), false);
  assert.equal(priceWithinTolerance(100_000, null, 0.1), false);
  assert.equal(priceWithinTolerance(0, 0, 0.1), false);
  assert.equal(priceWithinTolerance(100_000, 100_000, Number.NaN), false);
  assert.equal(priceWithinTolerance(100_000, 100_000, -0.1), false);
});
