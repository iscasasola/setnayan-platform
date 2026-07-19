/**
 * Vendor tier CALLS capability (Node built-in test runner via tsx —
 * `pnpm test:unit`).
 *
 * Locks the 2026-07-13 owner decision ("a service for the paid"): in-thread
 * voice/video calling is unlocked for any PAID plan (Solo+), NOT for Free or
 * the legacy Verified tier. The gate that reads this (resolveThreadCallsEnabled)
 * is flag-dark, but the capability matrix itself must always be correct.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canUseCalls,
  TIER_CAPS,
  VENDOR_TIERS,
  type VendorTier,
} from './vendor-tier-caps';

const PAID_TIERS: VendorTier[] = ['solo', 'pro', 'enterprise', 'custom'];
const UNPAID_TIERS: VendorTier[] = ['free', 'verified'];

test('calls: paid tiers (Solo+) can use calls', () => {
  for (const tier of PAID_TIERS) {
    assert.equal(canUseCalls(tier), true, `${tier} should allow calls`);
    assert.equal(TIER_CAPS[tier].calls, true, `${tier}.calls cap should be true`);
  }
});

test('calls: Free and legacy Verified cannot use calls', () => {
  for (const tier of UNPAID_TIERS) {
    assert.equal(canUseCalls(tier), false, `${tier} should NOT allow calls`);
    assert.equal(TIER_CAPS[tier].calls, false, `${tier}.calls cap should be false`);
  }
});

test('calls: unknown / null / undefined tier defaults to no calls (free)', () => {
  assert.equal(canUseCalls(null), false);
  assert.equal(canUseCalls(undefined), false);
  assert.equal(canUseCalls('gibberish'), false);
});

test('calls: every tier in the matrix declares the calls cap (completeness)', () => {
  for (const tier of VENDOR_TIERS) {
    assert.equal(
      typeof TIER_CAPS[tier].calls,
      'boolean',
      `${tier} must declare a boolean calls cap`,
    );
  }
});
