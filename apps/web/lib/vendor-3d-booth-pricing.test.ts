import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveVendor3dBoothPricePhp,
  isVendor3dBoothActive,
  nextVendor3dBoothExpiry,
  VENDOR_3D_BOOTH_FALLBACK_PHP,
  VENDOR_3D_BOOTH_PERIOD_DAYS,
} from './vendor-3d-booth-pricing';

// ── resolveVendor3dBoothPricePhp ────────────────────────────────────────────

test('3D booth: first cycle (trial unused) is ₱0 — the free intro', () => {
  assert.equal(resolveVendor3dBoothPricePhp({ trialUsed: false }), 0);
  // The renewal price is IGNORED on the free cycle.
  assert.equal(resolveVendor3dBoothPricePhp({ trialUsed: false, cyclePricePhp: 1500 }), 0);
});

test('3D booth: after the trial → ₱1,500 (catalog fallback when no price passed)', () => {
  assert.equal(
    resolveVendor3dBoothPricePhp({ trialUsed: true }),
    VENDOR_3D_BOOTH_FALLBACK_PHP,
  );
  assert.equal(resolveVendor3dBoothPricePhp({ trialUsed: true }), 1500);
});

test('3D booth: after the trial → uses the admin-managed catalog price when present', () => {
  assert.equal(resolveVendor3dBoothPricePhp({ trialUsed: true, cyclePricePhp: 1500 }), 1500);
  // An admin reprice flows straight through.
  assert.equal(resolveVendor3dBoothPricePhp({ trialUsed: true, cyclePricePhp: 1800 }), 1800);
});

test('3D booth: after the trial → invalid/zero catalog price falls back to ₱1,500', () => {
  assert.equal(resolveVendor3dBoothPricePhp({ trialUsed: true, cyclePricePhp: 0 }), 1500);
  assert.equal(resolveVendor3dBoothPricePhp({ trialUsed: true, cyclePricePhp: -5 }), 1500);
  assert.equal(resolveVendor3dBoothPricePhp({ trialUsed: true, cyclePricePhp: null }), 1500);
  assert.equal(
    resolveVendor3dBoothPricePhp({ trialUsed: true, cyclePricePhp: Number.NaN }),
    1500,
  );
});

// ── isVendor3dBoothActive ───────────────────────────────────────────────────

test('3D booth: entitlement is active only while now < expiry', () => {
  const now = Date.parse('2026-07-22T00:00:00Z');
  assert.equal(isVendor3dBoothActive('2026-08-01T00:00:00Z', now), true); // future
  assert.equal(isVendor3dBoothActive('2026-07-10T00:00:00Z', now), false); // past
  assert.equal(isVendor3dBoothActive(null, now), false); // never activated
  assert.equal(isVendor3dBoothActive(undefined, now), false);
  assert.equal(isVendor3dBoothActive('not-a-date', now), false);
});

// ── nextVendor3dBoothExpiry ─────────────────────────────────────────────────

test('3D booth: a fresh cycle from a never-activated vendor is now + 28 days', () => {
  const now = Date.parse('2026-07-22T00:00:00Z');
  const expiry = Date.parse(nextVendor3dBoothExpiry(null, now));
  assert.equal(expiry - now, VENDOR_3D_BOOTH_PERIOD_DAYS * 24 * 60 * 60 * 1000);
});

test('3D booth: early re-up stacks from the current (future) expiry, not now', () => {
  const now = Date.parse('2026-07-22T00:00:00Z');
  const future = '2026-08-01T00:00:00Z';
  const expiry = Date.parse(nextVendor3dBoothExpiry(future, now));
  assert.equal(
    expiry - Date.parse(future),
    VENDOR_3D_BOOTH_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  );
});

test('3D booth: a lapsed (past) expiry restarts the window from now', () => {
  const now = Date.parse('2026-07-22T00:00:00Z');
  const past = '2026-07-01T00:00:00Z';
  const expiry = Date.parse(nextVendor3dBoothExpiry(past, now));
  assert.equal(expiry - now, VENDOR_3D_BOOTH_PERIOD_DAYS * 24 * 60 * 60 * 1000);
});
