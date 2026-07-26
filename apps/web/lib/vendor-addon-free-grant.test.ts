import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVendorAddonGrant } from './vendor-addon-free-grant';

/**
 * The add-on free-grant decision — WHICH kind of ₱0 this is, and therefore
 * whether the vendor's one-time free first cycle gets burned.
 *
 * Every assertion here is a money claim that had ZERO coverage before:
 *   • a launch-window grant must NEVER consume the trial,
 *   • the launch window must NEVER turn a ₱0 trial back into a charge,
 *   • the one-time trial must STILL take the atomic claim,
 *   • a broken (NaN) price must take the PAID path, not the free one.
 */

const PAID = 1500;

// ── the launch window never burns the trial ─────────────────────────────────

test('launch window: free, repeatable, and does NOT consume the trial', () => {
  const g = resolveVendorAddonGrant({ basePricePhp: PAID, launchFree: true });
  assert.equal(g.pricePhp, 0);
  assert.equal(g.kind, 'launch_window');
  assert.equal(g.consumesTrial, false);
  assert.equal(g.repeatable, true);
});

test('launch window NEVER consumes the trial, whatever else is true', () => {
  for (const basePricePhp of [PAID, 0, 2000, -50, Number.NaN]) {
    for (const first5Free of [true, false, undefined]) {
      const g = resolveVendorAddonGrant({ basePricePhp, launchFree: true, first5Free });
      assert.equal(g.consumesTrial, false, `base=${basePricePhp} first5=${first5Free}`);
      assert.equal(g.pricePhp, 0, `base=${basePricePhp} first5=${first5Free}`);
      assert.equal(g.kind, 'launch_window', `base=${basePricePhp} first5=${first5Free}`);
    }
  }
});

test('launch window outranks the trial for the KIND, so the trial survives', () => {
  // trial still available (base already resolved to ₱0 by the add-on's resolver)
  const g = resolveVendorAddonGrant({ basePricePhp: 0, launchFree: true });
  assert.equal(g.kind, 'launch_window');
  assert.equal(g.consumesTrial, false);
});

test('launch window can only move the price DOWN — never up off a ₱0 trial', () => {
  const withWindow = resolveVendorAddonGrant({ basePricePhp: 0, launchFree: true });
  const withoutWindow = resolveVendorAddonGrant({ basePricePhp: 0, launchFree: false });
  assert.equal(withWindow.pricePhp, 0);
  assert.equal(withoutWindow.pricePhp, 0);
});

// ── the other two free kinds ────────────────────────────────────────────────

test('first-5 bookings: free, repeatable, does NOT consume the trial', () => {
  const g = resolveVendorAddonGrant({ basePricePhp: 0, launchFree: false, first5Free: true });
  assert.equal(g.pricePhp, 0);
  assert.equal(g.kind, 'first5_bookings');
  assert.equal(g.consumesTrial, false);
  assert.equal(g.repeatable, true);
});

test('one-time trial: free, NOT repeatable, and DOES consume the trial', () => {
  const g = resolveVendorAddonGrant({ basePricePhp: 0, launchFree: false, first5Free: false });
  assert.equal(g.pricePhp, 0);
  assert.equal(g.kind, 'first_cycle_trial');
  assert.equal(g.consumesTrial, true);
  assert.equal(g.repeatable, false);
});

test('exactly one kind is ever trial-consuming', () => {
  const cases = [
    { basePricePhp: 0, launchFree: true, first5Free: true },
    { basePricePhp: 0, launchFree: true, first5Free: false },
    { basePricePhp: 0, launchFree: false, first5Free: true },
    { basePricePhp: 0, launchFree: false, first5Free: false },
    { basePricePhp: PAID, launchFree: false, first5Free: false },
  ];
  const consuming = cases
    .map(resolveVendorAddonGrant)
    .filter((g) => g.consumesTrial)
    .map((g) => g.kind);
  assert.deepEqual(consuming, ['first_cycle_trial']);
});

test('consumesTrial and repeatable are always opposites on a free grant', () => {
  for (const launchFree of [true, false]) {
    for (const first5Free of [true, false]) {
      const g = resolveVendorAddonGrant({ basePricePhp: 0, launchFree, first5Free });
      assert.equal(g.pricePhp, 0);
      assert.equal(
        g.consumesTrial,
        !g.repeatable,
        `launchFree=${launchFree} first5Free=${first5Free}`,
      );
    }
  }
});

// ── the paid path ───────────────────────────────────────────────────────────

test('paid: window off → the base price passes through untouched', () => {
  const g = resolveVendorAddonGrant({ basePricePhp: PAID, launchFree: false });
  assert.equal(g.pricePhp, PAID);
  assert.equal(g.kind, 'paid');
  assert.equal(g.consumesTrial, false);
  assert.equal(g.repeatable, false);
});

test('FAILS CLOSED: a NaN price is PAID, never a free grant', () => {
  // Every caller branches on `if (pricePhp <= 0)`, and `NaN <= 0` is false — so
  // a broken catalog read must reach them as NaN and take the paid path. A
  // helper that coerced NaN to 0 here would give the add-on away for free AND
  // (before the launch window existed) burn the vendor's one-time trial.
  const g = resolveVendorAddonGrant({ basePricePhp: Number.NaN, launchFree: false });
  assert.equal(Number.isNaN(g.pricePhp), true);
  assert.equal(g.kind, 'paid');
  assert.equal(g.consumesTrial, false);
});

test('a negative price is treated as free (as `pricePhp <= 0` always did)', () => {
  const g = resolveVendorAddonGrant({ basePricePhp: -1, launchFree: false });
  assert.equal(g.pricePhp, 0);
  assert.equal(g.kind, 'first_cycle_trial');
  assert.equal(g.consumesTrial, true);
});
