import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VENDOR_LAUNCH_FREE_SKUS,
  VENDOR_LAUNCH_FREE_WINDOW_END_LABEL,
  isVendorLaunchFreeCoveredSku,
  isVendorLaunchFreeNow,
  vendorLaunchFreePricePhp,
} from './vendor-launch-free-window-coverage';
import { VENDOR_LAUNCH_FREE_WINDOW_END_MS } from './vendor-launch-free-window';

/**
 * The launch free window's COVERAGE layer — which vendor SKUs go ₱0 until
 * 2026-11-30, behind NEXT_PUBLIC_VENDOR_LAUNCH_FREE_WINDOW.
 *
 * The load-bearing property is FLAG-OFF BYTE-IDENTITY: with `enabled:false`,
 * every SKU at every instant must resolve exactly as it does today (never free,
 * price untouched). Every test below loops the whole coverage set + a
 * representative set of non-covered SKUs so a future addition can't slip through
 * unasserted.
 */

const IN_WINDOW = Date.parse('2026-08-01T00:00:00+08:00');
const AFTER_WINDOW = Date.parse('2026-12-01T00:00:01+08:00');

/** SKUs that must NEVER be launch-free (metered spend / stored value / fees). */
const NOT_COVERED = [
  'vendor_deep_search',
  'deep_search_about_you',
  'deep_search_market',
  'vendor_token_pack_10',
  'vendor_booking_fee',
  '',
  'papic_seats', // a COUPLE sku — vendor window must not touch it
];

// ── the coverage set itself ─────────────────────────────────────────────────

test('coverage set: exactly the four owner-selected vendor SKUs', () => {
  assert.deepEqual([...VENDOR_LAUNCH_FREE_SKUS], [
    'vendor_subscription',
    'vendor_ai_addon',
    'vendor_3d_booth',
    'papic_challenge',
  ]);
});

test('coverage set: membership predicate agrees with the list', () => {
  for (const sku of VENDOR_LAUNCH_FREE_SKUS) {
    assert.equal(isVendorLaunchFreeCoveredSku(sku), true, sku);
  }
  for (const sku of NOT_COVERED) {
    assert.equal(isVendorLaunchFreeCoveredSku(sku), false, sku);
  }
});

test('coverage set: Deep Search is deliberately NOT covered (metered cash cost)', () => {
  assert.equal(isVendorLaunchFreeCoveredSku('vendor_deep_search'), false);
  assert.equal(
    isVendorLaunchFreeNow({
      sku: 'vendor_deep_search',
      enabled: true,
      nowMs: IN_WINDOW,
    }),
    false,
  );
});

// ── FLAG OFF = byte-identical to today (the whole matrix) ───────────────────

test('flag OFF: no SKU is ever free, at any instant', () => {
  const instants = [
    IN_WINDOW,
    AFTER_WINDOW,
    VENDOR_LAUNCH_FREE_WINDOW_END_MS,
    VENDOR_LAUNCH_FREE_WINDOW_END_MS + 1,
    Number.NaN,
  ];
  for (const sku of [...VENDOR_LAUNCH_FREE_SKUS, ...NOT_COVERED]) {
    for (const nowMs of instants) {
      assert.equal(
        isVendorLaunchFreeNow({ sku, enabled: false, nowMs }),
        false,
        `${sku} @ ${nowMs}`,
      );
    }
  }
});

test('flag OFF: every price passes through unchanged', () => {
  for (const sku of [...VENDOR_LAUNCH_FREE_SKUS, ...NOT_COVERED]) {
    for (const nowMs of [IN_WINDOW, AFTER_WINDOW]) {
      assert.equal(
        vendorLaunchFreePricePhp(2500, { sku, enabled: false, nowMs }),
        2500,
        `${sku} @ ${nowMs}`,
      );
    }
  }
});

// ── FLAG ON ─────────────────────────────────────────────────────────────────

test('flag ON, inside the window: every covered SKU is free', () => {
  for (const sku of VENDOR_LAUNCH_FREE_SKUS) {
    assert.equal(isVendorLaunchFreeNow({ sku, enabled: true, nowMs: IN_WINDOW }), true, sku);
    assert.equal(vendorLaunchFreePricePhp(2500, { sku, enabled: true, nowMs: IN_WINDOW }), 0, sku);
  }
});

test('flag ON, inside the window: a NON-covered SKU still charges', () => {
  for (const sku of NOT_COVERED) {
    assert.equal(isVendorLaunchFreeNow({ sku, enabled: true, nowMs: IN_WINDOW }), false, sku);
    assert.equal(
      vendorLaunchFreePricePhp(1000, { sku, enabled: true, nowMs: IN_WINDOW }),
      1000,
      sku,
    );
  }
});

test('flag ON, after the window: every covered SKU charges the base price again', () => {
  for (const sku of VENDOR_LAUNCH_FREE_SKUS) {
    assert.equal(isVendorLaunchFreeNow({ sku, enabled: true, nowMs: AFTER_WINDOW }), false, sku);
    assert.equal(
      vendorLaunchFreePricePhp(2500, { sku, enabled: true, nowMs: AFTER_WINDOW }),
      2500,
      sku,
    );
  }
});

test('flag ON: the window end instant is inclusive, one ms later is not', () => {
  for (const sku of VENDOR_LAUNCH_FREE_SKUS) {
    assert.equal(
      isVendorLaunchFreeNow({ sku, enabled: true, nowMs: VENDOR_LAUNCH_FREE_WINDOW_END_MS }),
      true,
      sku,
    );
    assert.equal(
      isVendorLaunchFreeNow({ sku, enabled: true, nowMs: VENDOR_LAUNCH_FREE_WINDOW_END_MS + 1 }),
      false,
      sku,
    );
  }
});

// ── fail-closed ─────────────────────────────────────────────────────────────

test('fail closed: a broken clock CHARGES rather than giving away', () => {
  for (const sku of VENDOR_LAUNCH_FREE_SKUS) {
    assert.equal(isVendorLaunchFreeNow({ sku, enabled: true, nowMs: Number.NaN }), false, sku);
    assert.equal(
      vendorLaunchFreePricePhp(2500, { sku, enabled: true, nowMs: Number.NaN }),
      2500,
      sku,
    );
  }
});

test('price: a non-finite / negative base never yields a negative charge', () => {
  const on = { sku: 'vendor_ai_addon', enabled: true, nowMs: AFTER_WINDOW };
  assert.equal(vendorLaunchFreePricePhp(Number.NaN, on), 0);
  assert.equal(vendorLaunchFreePricePhp(-100, on), 0);
  const off = { sku: 'vendor_ai_addon', enabled: false, nowMs: AFTER_WINDOW };
  assert.equal(vendorLaunchFreePricePhp(Number.NaN, off), 0);
  assert.equal(vendorLaunchFreePricePhp(-100, off), 0);
});

// ── copy ────────────────────────────────────────────────────────────────────

test('copy label matches the window end date the predicate enforces', () => {
  // The label is vendor-facing copy; it must name the same day the window closes.
  const end = new Date(VENDOR_LAUNCH_FREE_WINDOW_END_MS);
  // 2026-11-30 23:59:59 +08:00 — assert on the Manila calendar day, not UTC.
  const manila = new Date(end.getTime() + 8 * 60 * 60 * 1000);
  assert.equal(manila.getUTCFullYear(), 2026);
  assert.equal(manila.getUTCMonth(), 10); // November
  assert.equal(manila.getUTCDate(), 30);
  assert.equal(VENDOR_LAUNCH_FREE_WINDOW_END_LABEL, '30 Nov 2026');
});
