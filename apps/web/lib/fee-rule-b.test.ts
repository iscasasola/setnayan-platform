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
  bookingFeeAttributionFromFacts,
  priceWithinTolerance,
  type BookingAttributionFacts,
} from './booking-fee-gate';
import { FEE_RULE_B_CASES } from './fee-rule-b-cases';

test('every rule-B case gives the answer the owner ruled', () => {
  assert.ok(FEE_RULE_B_CASES.length >= 14, 'the case table shrank');
  for (const c of FEE_RULE_B_CASES) {
    assert.equal(bookingFeeAttributionFromFacts(c.facts), c.expect, c.name);
  }
});

// 🎟 Owner 2026-11-16 (DECISION_LOG d4899cd5 point 4) reversed "a row the supplier brought is never sourced": an
// earlier Setnayan contact makes it a Setnayan booking. Whether an import with nothing earlier is FREE is decided in SQL
// (one year / first import on the event — tests/db/imported-clients-free-one-year-or-first-import.db.test.ts).
test('a row the supplier brought is sourced when Setnayan showed the couple the shop first (save or view)', () => {
  for (const rowSource of ['vendor_invite', 'vendor_locked_qr', 'reuse_accept']) {
    const base: BookingAttributionFacts = {
      threadSources: [],
      rowSource,
      rowIsManualRecord: false,
      recordTiedToShop: true,
      savesBefore: [],
      viewSourcesBefore: [],
    };
    assert.equal(bookingFeeAttributionFromFacts({ ...base, savesBefore: ['host_marketplace_search'] }), 'sourced', `${rowSource} after a save`);
    assert.equal(bookingFeeAttributionFromFacts({ ...base, viewSourcesBefore: ['search'] }), 'sourced', `${rowSource} after a view`);
    // A view through the supplier's own link is not Setnayan showing them anything.
    assert.equal(bookingFeeAttributionFromFacts({ ...base, viewSourcesBefore: ['profile_direct'] }), 'import', `${rowSource} own link`);
    assert.equal(bookingFeeAttributionFromFacts(base), 'import', `${rowSource} with nothing from Setnayan first`);
  }
});

test('a chat started from Setnayan is sourced on any row — the rule every booking always had', () => {
  const facts: BookingAttributionFacts = {
    threadSources: ['explore'],
    rowSource: 'vendor_invite',
    rowIsManualRecord: false,
    recordTiedToShop: true,
    savesBefore: [],
    viewSourcesBefore: [],
  };
  assert.equal(bookingFeeAttributionFromFacts(facts), 'sourced');
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

test("the supplier's bill says WHY a booking the couple typed in carries a fee — and only when it does", async () => {
  const { feeIntroducedLine } = await import('./booking-fee-disclosure');
  assert.equal(feeIntroducedLine({ introducedOn: '2026-09-20' }), 'Setnayan introduced this couple to you on Sep 20, 2026.');
  assert.equal(feeIntroducedLine({ introducedOn: null }), null);
  assert.equal(feeIntroducedLine({}), null);
  assert.equal(feeIntroducedLine({ introducedOn: 'soon' }), null);
});

test("only a view from a Setnayan surface counts — never one through the supplier's own link (owner 2026-10-12)", () => {
  const facts = (viewSourcesBefore: ReadonlyArray<string | null>): BookingAttributionFacts => ({
    threadSources: [],
    rowSource: 'host_manual',
    rowIsManualRecord: true,
    recordTiedToShop: true,
    savesBefore: [],
    viewSourcesBefore,
  });
  for (const own of ['profile_direct', 'website', 'invite_claim', null]) {
    assert.equal(bookingFeeAttributionFromFacts(facts([own])), 'import', String(own));
  }
  for (const setnayan of ['explore', 'search', 'shortlist', 'favorites', 'editorial', 'auto_build']) {
    assert.equal(bookingFeeAttributionFromFacts(facts([setnayan])), 'sourced', setnayan);
  }
});
