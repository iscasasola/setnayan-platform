import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VENDOR_LAUNCH_FREE_WINDOW_END_MS,
  isVendorLaunchFreeWindowActive,
  vendorLaunchAdjustedPricePhp,
} from './vendor-launch-free-window';

const BEFORE = Date.parse('2026-08-01T00:00:00+08:00');
const AFTER = Date.parse('2026-12-01T00:00:01+08:00');

// ── isVendorLaunchFreeWindowActive ──────────────────────────────────────────

test('window: active before the end, inactive after', () => {
  assert.equal(isVendorLaunchFreeWindowActive(BEFORE), true);
  assert.equal(isVendorLaunchFreeWindowActive(AFTER), false);
});

test('window: the end instant itself is still active (inclusive)', () => {
  assert.equal(isVendorLaunchFreeWindowActive(VENDOR_LAUNCH_FREE_WINDOW_END_MS), true);
  assert.equal(isVendorLaunchFreeWindowActive(VENDOR_LAUNCH_FREE_WINDOW_END_MS + 1), false);
});

test('window: a non-finite now is treated as inactive (fail-safe: charge, not free)', () => {
  assert.equal(isVendorLaunchFreeWindowActive(Number.NaN), false);
});

// ── vendorLaunchAdjustedPricePhp ────────────────────────────────────────────

test('price: covered feature is ₱0 during the window', () => {
  assert.equal(vendorLaunchAdjustedPricePhp(2000, BEFORE), 0);
  assert.equal(vendorLaunchAdjustedPricePhp(500, BEFORE), 0);
});

test('price: covered feature charges the base price after the window', () => {
  assert.equal(vendorLaunchAdjustedPricePhp(2000, AFTER), 2000);
  assert.equal(vendorLaunchAdjustedPricePhp(500, AFTER), 500);
});

test('price: a non-finite / negative base coerces to 0 (never negative)', () => {
  assert.equal(vendorLaunchAdjustedPricePhp(Number.NaN, AFTER), 0);
  assert.equal(vendorLaunchAdjustedPricePhp(-100, AFTER), 0);
});
