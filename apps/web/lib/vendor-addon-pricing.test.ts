import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveVendorAiAddonPricePhp,
  isVendorAiAddonActive,
  nextVendorAiAddonExpiry,
  VENDOR_AI_ADDON_FALLBACK_PHP,
  VENDOR_AI_ADDON_PERIOD_DAYS,
} from './vendor-addon-pricing';

// ── resolveVendorAiAddonPricePhp ────────────────────────────────────────────

test('first cycle (trial unused) is ₱0 — the free intro', () => {
  assert.equal(resolveVendorAiAddonPricePhp({ trialUsed: false }), 0);
  // The renewal price is IGNORED on the free cycle.
  assert.equal(resolveVendorAiAddonPricePhp({ trialUsed: false, cyclePricePhp: 1500 }), 0);
});

test('after the trial → ₱1,500 (catalog fallback when no price passed)', () => {
  assert.equal(
    resolveVendorAiAddonPricePhp({ trialUsed: true }),
    VENDOR_AI_ADDON_FALLBACK_PHP,
  );
  assert.equal(resolveVendorAiAddonPricePhp({ trialUsed: true }), 1500);
});

test('after the trial → uses the admin-managed catalog price when present', () => {
  assert.equal(resolveVendorAiAddonPricePhp({ trialUsed: true, cyclePricePhp: 1500 }), 1500);
  // An admin reprice flows straight through.
  assert.equal(resolveVendorAiAddonPricePhp({ trialUsed: true, cyclePricePhp: 1800 }), 1800);
});

test('after the trial → invalid/zero catalog price falls back to ₱1,500', () => {
  assert.equal(resolveVendorAiAddonPricePhp({ trialUsed: true, cyclePricePhp: 0 }), 1500);
  assert.equal(resolveVendorAiAddonPricePhp({ trialUsed: true, cyclePricePhp: -5 }), 1500);
  assert.equal(resolveVendorAiAddonPricePhp({ trialUsed: true, cyclePricePhp: null }), 1500);
  assert.equal(
    resolveVendorAiAddonPricePhp({ trialUsed: true, cyclePricePhp: Number.NaN }),
    1500,
  );
});

// ── isVendorAiAddonActive ───────────────────────────────────────────────────

test('entitlement is active only while now < expiry', () => {
  const now = Date.parse('2026-07-22T00:00:00Z');
  assert.equal(isVendorAiAddonActive('2026-08-01T00:00:00Z', now), true); // future
  assert.equal(isVendorAiAddonActive('2026-07-10T00:00:00Z', now), false); // past
  assert.equal(isVendorAiAddonActive(null, now), false); // never activated
  assert.equal(isVendorAiAddonActive(undefined, now), false);
  assert.equal(isVendorAiAddonActive('not-a-date', now), false);
});

// ── nextVendorAiAddonExpiry ─────────────────────────────────────────────────

test('a fresh cycle from a never-activated vendor is now + 28 days', () => {
  const now = Date.parse('2026-07-22T00:00:00Z');
  const expiry = Date.parse(nextVendorAiAddonExpiry(null, now));
  assert.equal(expiry - now, VENDOR_AI_ADDON_PERIOD_DAYS * 24 * 60 * 60 * 1000);
});

test('early re-up stacks from the current (future) expiry, not now', () => {
  const now = Date.parse('2026-07-22T00:00:00Z');
  const future = '2026-08-01T00:00:00Z';
  const expiry = Date.parse(nextVendorAiAddonExpiry(future, now));
  assert.equal(
    expiry - Date.parse(future),
    VENDOR_AI_ADDON_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  );
});

test('a lapsed (past) expiry restarts the window from now', () => {
  const now = Date.parse('2026-07-22T00:00:00Z');
  const past = '2026-07-01T00:00:00Z';
  const expiry = Date.parse(nextVendorAiAddonExpiry(past, now));
  assert.equal(expiry - now, VENDOR_AI_ADDON_PERIOD_DAYS * 24 * 60 * 60 * 1000);
});

// ── 2026-07-25 tiered band, INJECTED as the cycle price ─────────────────────
// The band must reach this resolver as its INPUT, never replace its OUTPUT.
// resolveVendorAiAddonPricePhp short-circuits to ₱0 on the free first cycle
// BEFORE reading cyclePricePhp; overwriting the result afterwards would bill the
// trial. These pin that the injection shape is the safe one.

test('band injection preserves the free FIRST cycle on every band', () => {
  for (const band of [2000, 1500]) {
    assert.equal(
      resolveVendorAiAddonPricePhp({ trialUsed: false, cyclePricePhp: band }),
      0,
      `band ${band}`,
    );
  }
});

test('band injection sets the RENEWAL price', () => {
  assert.equal(resolveVendorAiAddonPricePhp({ trialUsed: true, cyclePricePhp: 2000 }), 2000);
  assert.equal(resolveVendorAiAddonPricePhp({ trialUsed: true, cyclePricePhp: 1500 }), 1500);
});

test('flag OFF: a null/absent catalog price still falls back to ₱1,500', () => {
  // The flag-off path passes the catalog value through untouched, so the
  // pre-existing fallback must be unchanged.
  assert.equal(
    resolveVendorAiAddonPricePhp({ trialUsed: true, cyclePricePhp: null }),
    VENDOR_AI_ADDON_FALLBACK_PHP,
  );
});
