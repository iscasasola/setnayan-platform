/**
 * The owner's 2026-09-05 rule, one assertion per sentence he said.
 *
 * ⚠ These are ARITHMETIC tests. Whether the running product actually CALLS this
 * function is a different question and is asked by
 * `the-fee-reaches-the-allowance.test.ts` — a pure function tested in isolation
 * passes whether or not anybody uses it, which is exactly how its predecessor
 * sat unused for a month.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VENDOR_PAPIC_FEE_CREDITS_CAP,
  VENDOR_PAPIC_PHP_PER_CREDIT,
  VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS,
  VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE,
  offerPack,
  vendorPortfolioCreditsForFee,
} from './vendor-papic-credits';

test('owner: "if they paid 1000 pesos for the booking fee, they get 50 papic credits"', () => {
  assert.equal(vendorPortfolioCreditsForFee(1000), 50);
});

test('the REBATE is 5% — ₱20 of booking fee per credit', () => {
  assert.equal(VENDOR_PAPIC_PHP_PER_CREDIT, 20);
  assert.equal(vendorPortfolioCreditsForFee(2000), 100);
  assert.equal(vendorPortfolioCreditsForFee(2500), 125, '₱50k package → ₱2,500 fee');
});

test('the PURCHASE is deliberately cheaper per credit than the rebate implies', () => {
  // These two USED to imply the same ₱20/credit, and the coincidence read like
  // a design. It was not. A rebate on money already paid and a pack somebody
  // has to choose to buy are different things, and on 2026-09-06 the pack was
  // re-priced so it is worth buying: ₱500 ÷ 100 = ₱5/credit.
  const packPhpPerCredit = 500 / VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS;
  assert.equal(packPhpPerCredit, 5);
  assert.ok(
    packPhpPerCredit < VENDOR_PAPIC_PHP_PER_CREDIT,
    'the pack must never cost MORE per credit than the fee rebate implies — that was the ' +
      'state that made ₱500 buy three ten-second clips and go unsold',
  );
  // Still a real premium over what a couple pays (₱0.70/credit in
  // platform_retail_catalog_v2) — vendors monetize their events, couples do not.
  assert.ok(packPhpPerCredit > 0.7, 'a supplier still pays more per credit than a couple');
});

test('the crumbs still land: ₱20 → 1 credit, and a fee just under it earns 0', () => {
  assert.equal(vendorPortfolioCreditsForFee(20), 1);
  assert.equal(vendorPortfolioCreditsForFee(19), 0);
  assert.equal(vendorPortfolioCreditsForFee(39.99), 1, 'floor, never round');
});

test('NO floor: ₱0 earns nothing — the vendor buys the pack', () => {
  assert.equal(vendorPortfolioCreditsForFee(0), 0);
});

test('owner: "minimum of 1000" is the MAXIMUM from a booking fee (confirmed 2026-09-05)', () => {
  assert.equal(VENDOR_PAPIC_FEE_CREDITS_CAP, 1000);
  assert.equal(vendorPortfolioCreditsForFee(20_000), 1000, 'exactly at the cap');
  assert.equal(vendorPortfolioCreditsForFee(19_999), 999, 'one peso short of it');
  assert.equal(vendorPortfolioCreditsForFee(30_000), 1000, 'capped — a ₱600k booking mints no windfall');
  assert.equal(vendorPortfolioCreditsForFee(2_000_000), 1000);
});

test('a fee nobody could read grants nothing — null is a failed read, never ₱0', () => {
  assert.equal(vendorPortfolioCreditsForFee(null), 0);
  assert.equal(vendorPortfolioCreditsForFee(undefined), 0);
  assert.equal(vendorPortfolioCreditsForFee(Number.NaN), 0);
  assert.equal(vendorPortfolioCreditsForFee(-500), 0, 'nonsense earns nothing, never a windfall');
  assert.equal(vendorPortfolioCreditsForFee(Number.POSITIVE_INFINITY), 0);
});

test('no floating-point residue can round a whole credit away', () => {
  // 0.05 is not representable; dividing by 20 keeps every multiple of ₱20 exact.
  for (let fee = 0; fee <= 20_000; fee += 20) {
    assert.equal(vendorPortfolioCreditsForFee(fee), Math.min(1000, fee / 20), `₱${fee}`);
  }
});

test('the pack is offered beside a grant UNDER a pack’s worth, not at it', () => {
  // Written against the CONSTANT, not the literal, so the 2026-09-06 re-price
  // (25 → 100) could not leave this test asserting a boundary the code had
  // already moved past.
  const pack = VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS;
  assert.equal(offerPack(0), true);
  assert.equal(offerPack(1), true, 'the crumbs come with the loaf beside them');
  assert.equal(offerPack(pack - 1), true);
  assert.equal(offerPack(pack), false, 'a pack’s worth already in hand');
  assert.equal(offerPack(1000), false);
  assert.equal(offerPack(Number.NaN), true, 'an unreadable grant is treated as none');
});

test('the pack SKU is a lowercase vendor_* code, like every vendor SKU', () => {
  assert.match(VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE, /^vendor_[a-z0-9_]+$/);
  assert.equal(VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS, 100, 'owner 2026-09-06, raised from 25');
});
