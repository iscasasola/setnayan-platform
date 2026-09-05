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

test('5% is ₱20 per credit — the same rate the ₱500/25 pack implies', () => {
  assert.equal(VENDOR_PAPIC_PHP_PER_CREDIT, 20);
  assert.equal(500 / VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS, VENDOR_PAPIC_PHP_PER_CREDIT);
  assert.equal(vendorPortfolioCreditsForFee(2000), 100);
  assert.equal(vendorPortfolioCreditsForFee(2500), 125, '₱50k package → ₱2,500 fee');
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

test('the pack is offered beside a grant UNDER 25, not at 25', () => {
  assert.equal(offerPack(0), true);
  assert.equal(offerPack(1), true, 'the crumbs come with the loaf beside them');
  assert.equal(offerPack(24), true);
  assert.equal(offerPack(25), false, 'a pack’s worth already in hand');
  assert.equal(offerPack(1000), false);
  assert.equal(offerPack(Number.NaN), true, 'an unreadable grant is treated as none');
});

test('the pack SKU is a lowercase vendor_* code, like every vendor SKU', () => {
  assert.match(VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE, /^vendor_[a-z0-9_]+$/);
  assert.equal(VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS, 25);
});
