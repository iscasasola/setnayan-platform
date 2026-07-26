import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VENDOR_LAUNCH_FREE_SKUS,
  VENDOR_LAUNCH_FREE_EXCLUDED_SKUS,
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
 * Two load-bearing properties:
 *   1. FLAG-OFF BYTE-IDENTITY — with `enabled:false`, every SKU at every instant
 *      resolves exactly as it does today (never free, price untouched).
 *   2. SUBSCRIPTIONS ARE OUT — `vendor_subscription` must never be covered. It
 *      was in the first cut, and the only way to honour it was to disable the
 *      plan buy button, which made every paid tier (and therefore the two
 *      tier-gated add-ons this window DOES cover) unobtainable, and stranded
 *      lapsed paid vendors with no way to renew. See the module header.
 */

const IN_WINDOW = Date.parse('2026-08-01T00:00:00+08:00');
const AFTER_WINDOW = Date.parse('2026-12-01T00:00:01+08:00');

/** SKUs that must NEVER be launch-free (plans / metered spend / stored value). */
const NOT_COVERED = [
  ...VENDOR_LAUNCH_FREE_EXCLUDED_SKUS,
  'deep_search_about_you',
  'deep_search_market',
  'vendor_token_pack_10',
  'pro_vendor_monthly',
  'solo_vendor_annual',
  'enterprise_vendor_monthly',
  '',
  'papic_seats', // a COUPLE sku — the vendor window must not touch it
];

// ── the coverage set itself ─────────────────────────────────────────────────

test('coverage set: exactly the three covered vendor ADD-ONS — no subscriptions', () => {
  assert.deepEqual([...VENDOR_LAUNCH_FREE_SKUS], [
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

test('DESCOPE LOCK: vendor_subscription is never free, flag on, inside the window', () => {
  // Re-adding it to VENDOR_LAUNCH_FREE_SKUS re-opens the closed loop this branch
  // exists to close. `create_vendor_subscription` reads price_php from a catalog
  // with a `price_php > 0` CHECK and has no ₱0 branch, so "free plans" can only
  // be faked by taking the buy path away.
  assert.equal(isVendorLaunchFreeCoveredSku('vendor_subscription'), false);
  assert.equal(
    isVendorLaunchFreeNow({ sku: 'vendor_subscription', enabled: true, nowMs: IN_WINDOW }),
    false,
  );
  assert.equal(
    vendorLaunchFreePricePhp(2499, {
      sku: 'vendor_subscription',
      enabled: true,
      nowMs: IN_WINDOW,
    }),
    2499,
  );
});

test('coverage set: Deep Search is deliberately NOT covered (metered cash cost)', () => {
  assert.equal(isVendorLaunchFreeCoveredSku('vendor_deep_search'), false);
  assert.equal(
    isVendorLaunchFreeNow({ sku: 'vendor_deep_search', enabled: true, nowMs: IN_WINDOW }),
    false,
  );
});

test('the covered set and the excluded set are disjoint', () => {
  for (const sku of VENDOR_LAUNCH_FREE_SKUS) {
    assert.equal(
      VENDOR_LAUNCH_FREE_EXCLUDED_SKUS.includes(sku),
      false,
      `${sku} is in BOTH lists`,
    );
  }
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

test('NOT-FREE branch is a pure pass-through — it never INVENTS a ₱0', () => {
  // Regression lock. The first cut sanitised the pass-through as
  // `Number.isFinite(base) && base > 0 ? base : 0`, so a NaN/negative resolved
  // price came back as 0 and every caller's `if (pricePhp <= 0)` took the FREE
  // activation branch — on `main` that same NaN takes the PAID branch, because
  // `NaN <= 0` is false. A helper that decided NOT to zero a price must hand
  // back exactly what it was given.
  for (const enabled of [true, false]) {
    for (const sku of ['vendor_ai_addon', 'vendor_subscription']) {
      const input = { sku, enabled, nowMs: AFTER_WINDOW };
      assert.equal(
        Number.isNaN(vendorLaunchFreePricePhp(Number.NaN, input)),
        true,
        `NaN must survive (${sku}, enabled=${enabled})`,
      );
      assert.equal(vendorLaunchFreePricePhp(-100, input), -100, `${sku} enabled=${enabled}`);
      assert.equal(vendorLaunchFreePricePhp(0, input), 0, `${sku} enabled=${enabled}`);
      assert.equal(vendorLaunchFreePricePhp(1500, input), 1500, `${sku} enabled=${enabled}`);
    }
  }
  // And a NaN inside the window on a covered SKU is still zeroed (the window
  // genuinely decided; there is nothing to charge).
  assert.equal(
    vendorLaunchFreePricePhp(Number.NaN, {
      sku: 'vendor_ai_addon',
      enabled: true,
      nowMs: IN_WINDOW,
    }),
    0,
  );
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
