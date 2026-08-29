/**
 * THE PRICE LIST CLUSTERS BY WHAT A THING IS, NOT BY WHAT IT COSTS.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLUSTER_ORDER,
  clusterForRetail,
  clusterForVendor,
  isCreditLadderRung,
  summariseLadder,
} from './pricing-clusters';

/** The nine real customer products in production, 2026-08-29. */
const REAL_PRODUCTS: [string, string][] = [
  ['CUSTOM_QR_GUEST', 'The celebration page'],
  ['ANIMATED_MONOGRAM', 'Film and music'],
  ['PATIKTOK_COMPILER', 'Film and music'],
  ['SEATING_3D', 'The celebration page'],
  ['SETNAYAN_AI', 'Setnayan AI'],
  ['PAPIC_ADDON_THANK_YOU', 'Papic'],
  ['PAKANTA', 'Film and music'],
  ['LIVE_STUDIO', 'Film and music'],
  ['COUPLE_WEBSITE_PRO', 'The celebration page'],
];

test('every real product lands on a shelf, and on the one a person would look under', () => {
  for (const [code, expected] of REAL_PRODUCTS) {
    assert.equal(clusterForRetail(code), expected, `${code} shelved wrongly`);
  }
});

test('every shelf a product can reach is in the render order', () => {
  /*
    🔑 A CLUSTER MISSING FROM THE ORDER RENDERS NOTHING. The list maps over
    CLUSTER_ORDER, so a shelf the classifier can return but the order omits makes
    those rows silently disappear — the price is still on sale and simply is not
    on the screen. That is the worst outcome this file can produce.
  */
  const reachable = new Set<string>([
    ...REAL_PRODUCTS.map(([c]) => clusterForRetail(c)),
    clusterForRetail('PAPIC_GUEST_1K'),
    clusterForRetail('SOMETHING_NOBODY_HAS_ADDED_YET'),
    clusterForVendor('subscription_monthly'),
    clusterForVendor('subscription_annual'),
    clusterForVendor('vendor_addon_recurring'),
    clusterForVendor('vendor_addon_metered'),
    clusterForVendor(null),
    'Bundles',
  ]);
  for (const c of reachable) {
    assert.ok(
      (CLUSTER_ORDER as readonly string[]).includes(c),
      `"${c}" can be produced but is never rendered`,
    );
  }
});

test('an unknown product still gets a shelf — it never vanishes', () => {
  assert.equal(clusterForRetail('A_BRAND_NEW_THING'), 'Planning tools');
  assert.ok((CLUSTER_ORDER as readonly string[]).includes('Planning tools'));
});

test('vendor plans and vendor add-ons are separated', () => {
  assert.equal(clusterForVendor('subscription_monthly'), 'Vendor plans');
  assert.equal(clusterForVendor('subscription_annual'), 'Vendor plans');
  assert.equal(clusterForVendor('vendor_addon_recurring'), 'Vendor add-ons');
  assert.equal(clusterForVendor('vendor_addon_metered'), 'Vendor add-ons');
  assert.equal(clusterForVendor('branch'), 'Vendor add-ons');
});

test('the ladder is exactly the credit rungs — not everything named Papic', () => {
  /*
    ⚠ THE BOUNDARY THAT MATTERS. Collapsing too widely would fold a product with
    its own price and its own card into a summary line nobody opens. The Thank
    You add-on and the camera rows are NOT rungs.
  */
  for (const rung of ['PAPIC_GUEST', 'PAPIC_GUEST_100', 'PAPIC_GUEST_50K', 'papic_guest_1k']) {
    assert.equal(isCreditLadderRung(rung), true, `${rung} is a rung`);
  }
  for (const notRung of [
    'PAPIC_ADDON_THANK_YOU',
    'PAPIC_CAMERA_FREE',
    'PAPIC_UNLOCK',
    'PAPIC_GUESTBOOK',
    'SETNAYAN_AI',
  ]) {
    assert.equal(isCreditLadderRung(notRung), false, `${notRung} must keep its own row`);
  }
});

test('the ladder summary spans lowest to highest', () => {
  const s = summariseLadder([{ pricePhp: 70 }, { pricePhp: 15000 }, { pricePhp: 1680 }]);
  assert.ok(s);
  assert.equal(s!.rungs, 3);
  assert.equal(s!.lowestPhp, 70);
  assert.equal(s!.highestPhp, 15000);
});

test('an empty ladder summarises to NOTHING, never to Infinity', () => {
  /*
    🚨 `Math.min()` of an empty list is Infinity and `Math.max()` is -Infinity,
    and `String(Infinity)` is a perfectly valid string — so nothing throws and
    the screen prints "₱Infinity – ₱-Infinity". That exact shape once reached the
    public on /vendors.
  */
  assert.equal(summariseLadder([]), null);
  assert.equal(summariseLadder([{ pricePhp: Number.NaN }]), null);
});

test('a rung with an unreadable price does not poison the span', () => {
  const s = summariseLadder([{ pricePhp: 70 }, { pricePhp: Number.NaN }, { pricePhp: 500 }]);
  assert.ok(s);
  assert.equal(s!.rungs, 2, 'the unreadable one is not counted');
  assert.equal(s!.lowestPhp, 70);
  assert.equal(s!.highestPhp, 500);
});
