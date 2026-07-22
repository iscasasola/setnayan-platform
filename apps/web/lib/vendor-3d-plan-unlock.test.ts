import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vendor3dPlanUnlockEligibility,
  applyVendor3dPlanUnlockDiscountCentavos,
  vendor3dPlanUnlockPriceCentavos,
  VENDOR_3D_PLAN_UNLOCK_PRICE_PHP,
  VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY,
  VENDOR_3D_PLAN_UNLOCK_DENY_MESSAGE,
} from './vendor-3d-plan-unlock';

// The standard SEATING_3D catalog price is ₱2,999 (migration 20270712300000).
const STANDARD_CENTAVOS = 2999 * 100;
const DISCOUNT_CENTAVOS = VENDOR_3D_PLAN_UNLOCK_PRICE_PHP * 100; // ₱1,000

// ── vendor3dPlanUnlockEligibility (the three gates) ──────────────────────────

test('3d unlock: eligible when add-on active + booked + not-yet-unlocked', () => {
  assert.deepEqual(
    vendor3dPlanUnlockEligibility({
      boothAddonActive: true,
      booked: true,
      alreadyUnlocked: false,
    }),
    { ok: true },
  );
});

test('3d unlock: REJECTED without an active 3D Booth add-on', () => {
  // Rejected even when booked — the add-on is the required entitlement.
  assert.deepEqual(
    vendor3dPlanUnlockEligibility({
      boothAddonActive: false,
      booked: true,
      alreadyUnlocked: false,
    }),
    { ok: false, reason: 'no_addon' },
  );
});

test('3d unlock: REJECTED when the vendor is not booked on the event', () => {
  assert.deepEqual(
    vendor3dPlanUnlockEligibility({
      boothAddonActive: true,
      booked: false,
      alreadyUnlocked: false,
    }),
    { ok: false, reason: 'not_booked' },
  );
});

test('3d unlock: no-op reason when already unlocked (idempotent per event)', () => {
  assert.deepEqual(
    vendor3dPlanUnlockEligibility({
      boothAddonActive: true,
      booked: true,
      alreadyUnlocked: true,
    }),
    { ok: false, reason: 'already_unlocked' },
  );
});

test('3d unlock: gate order is add-on → booked → already-unlocked', () => {
  // No add-on wins over every other failing condition.
  assert.equal(
    vendor3dPlanUnlockEligibility({
      boothAddonActive: false,
      booked: false,
      alreadyUnlocked: true,
    }).ok,
    false,
  );
  assert.equal(
    (
      vendor3dPlanUnlockEligibility({
        boothAddonActive: false,
        booked: false,
        alreadyUnlocked: true,
      }) as { reason: string }
    ).reason,
    'no_addon',
  );
  // Add-on present but not booked → not_booked wins over already_unlocked.
  assert.equal(
    (
      vendor3dPlanUnlockEligibility({
        boothAddonActive: true,
        booked: false,
        alreadyUnlocked: true,
      }) as { reason: string }
    ).reason,
    'not_booked',
  );
});

test('3d unlock: every deny reason has human copy', () => {
  for (const reason of ['no_addon', 'not_booked', 'already_unlocked'] as const) {
    assert.equal(typeof VENDOR_3D_PLAN_UNLOCK_DENY_MESSAGE[reason], 'string');
    assert.ok(VENDOR_3D_PLAN_UNLOCK_DENY_MESSAGE[reason].length > 0);
  }
});

// ── applyVendor3dPlanUnlockDiscountCentavos (server-authoritative price) ──────

test('couple price = ₱1,000 for SEATING_3D when the event is vendor-unlocked', () => {
  assert.equal(
    applyVendor3dPlanUnlockDiscountCentavos('SEATING_3D', STANDARD_CENTAVOS, true),
    DISCOUNT_CENTAVOS,
  );
  assert.equal(
    applyVendor3dPlanUnlockDiscountCentavos('SEATING_3D', STANDARD_CENTAVOS, true),
    100000, // ₱1,000 in centavos
  );
});

test('couple price = ₱2,999 (standard) for SEATING_3D when NOT unlocked', () => {
  assert.equal(
    applyVendor3dPlanUnlockDiscountCentavos('SEATING_3D', STANDARD_CENTAVOS, false),
    STANDARD_CENTAVOS,
  );
});

test('discount only touches SEATING_3D — other SKUs pass through even if unlocked', () => {
  const paxSku = 334900; // e.g. a PAPIC_GUEST resolve
  assert.equal(
    applyVendor3dPlanUnlockDiscountCentavos('PAPIC_GUEST', paxSku, true),
    paxSku,
  );
  assert.equal(
    applyVendor3dPlanUnlockDiscountCentavos('ANIMATED_MONOGRAM', 99900, true),
    99900,
  );
});

test('discount only ever LOWERS — a standard already below ₱1,000 is untouched', () => {
  const cheap = 50000; // ₱500 (hypothetical) — the discount must not raise it
  assert.equal(
    applyVendor3dPlanUnlockDiscountCentavos('SEATING_3D', cheap, true),
    cheap,
  );
});

test('discount honours an explicit (admin-tunable) discount amount', () => {
  // If the owner later tunes the discount, the selector uses the passed value.
  assert.equal(
    applyVendor3dPlanUnlockDiscountCentavos('SEATING_3D', STANDARD_CENTAVOS, true, 1200),
    120000,
  );
});

test('constants: service key + centavos helper are coherent', () => {
  assert.equal(VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY, 'SEATING_3D');
  assert.equal(vendor3dPlanUnlockPriceCentavos(), DISCOUNT_CENTAVOS);
  assert.equal(vendor3dPlanUnlockPriceCentavos(), 100000);
});
