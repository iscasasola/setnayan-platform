import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  vendor3dPlanUnlockEligibility,
  applyVendor3dPlanUnlockDiscountCentavos,
  vendor3dPlanUnlockPriceCentavos,
  vendor3dPlanUnlockDiscountHonored,
  eventVendor3dPlanUnlockDiscountActive,
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

// ── vendor3dPlanUnlockDiscountHonored (charge-time re-validation · H1) ────────

test('charge-time: discount honored only when unlock + active booth + still booked', () => {
  assert.equal(
    vendor3dPlanUnlockDiscountHonored({
      hasUnlock: true,
      boothAddonActive: true,
      stillBooked: true,
    }),
    true,
  );
});

test('charge-time: a LAPSED booth kills the discount (money-integrity)', () => {
  assert.equal(
    vendor3dPlanUnlockDiscountHonored({
      hasUnlock: true,
      boothAddonActive: false,
      stillBooked: true,
    }),
    false,
  );
});

test('charge-time: an UN-BOOKED / cancelled vendor kills the discount', () => {
  assert.equal(
    vendor3dPlanUnlockDiscountHonored({
      hasUnlock: true,
      boothAddonActive: true,
      stillBooked: false,
    }),
    false,
  );
});

test('charge-time: no unlock record → no discount', () => {
  assert.equal(
    vendor3dPlanUnlockDiscountHonored({
      hasUnlock: false,
      boothAddonActive: true,
      stillBooked: true,
    }),
    false,
  );
});

// ── eventVendor3dPlanUnlockDiscountActive (DB re-validation · H1) ─────────────
//
// A per-table fake Supabase client: the unlock read resolves the attributing
// vendor, then vendor_profiles gives the booth window + event_vendors the booking.
// Each `.from(table)` returns a builder whose awaited terminal (maybeSingle)
// yields that table's canned { data }.
const FIXED_NOW = Date.parse('2026-07-22T00:00:00.000Z');
const ACTIVE_BOOTH = '2026-08-19T00:00:00.000Z'; // future → active
const LAPSED_BOOTH = '2026-07-01T00:00:00.000Z'; // past → lapsed

function fakeUnlockClient(opts: {
  unlock: { vendor_profile_id: string; unlocked_at: string | null } | null;
  boothExpiry: string | null;
  booked: boolean;
}): SupabaseClient {
  const byTable: Record<string, { data: unknown }> = {
    event_vendor_3d_plan_unlocks: { data: opts.unlock },
    vendor_profiles: { data: opts.boothExpiry == null ? null : { booth_addon_expires_at: opts.boothExpiry } },
    event_vendors: { data: opts.booked ? { vendor_id: 'ev-1' } : null },
  };
  return {
    from(table: string) {
      const result = byTable[table] ?? { data: null };
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        limit: () => builder,
        maybeSingle: () => Promise.resolve({ ...result, error: null }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

test('DB re-validation: honored when booth active + still booked', async () => {
  const client = fakeUnlockClient({
    unlock: { vendor_profile_id: 'v-1', unlocked_at: null },
    boothExpiry: ACTIVE_BOOTH,
    booked: true,
  });
  assert.equal(await eventVendor3dPlanUnlockDiscountActive(client, 'evt-1', FIXED_NOW), true);
});

test('DB re-validation: NOT honored when the attributing booth lapsed', async () => {
  const client = fakeUnlockClient({
    unlock: { vendor_profile_id: 'v-1', unlocked_at: null },
    boothExpiry: LAPSED_BOOTH,
    booked: true,
  });
  assert.equal(await eventVendor3dPlanUnlockDiscountActive(client, 'evt-1', FIXED_NOW), false);
});

test('DB re-validation: NOT honored when the vendor is no longer booked', async () => {
  const client = fakeUnlockClient({
    unlock: { vendor_profile_id: 'v-1', unlocked_at: null },
    boothExpiry: ACTIVE_BOOTH,
    booked: false,
  });
  assert.equal(await eventVendor3dPlanUnlockDiscountActive(client, 'evt-1', FIXED_NOW), false);
});

test('DB re-validation: NOT honored when no unlock record exists', async () => {
  const client = fakeUnlockClient({ unlock: null, boothExpiry: ACTIVE_BOOTH, booked: true });
  assert.equal(await eventVendor3dPlanUnlockDiscountActive(client, 'evt-1', FIXED_NOW), false);
});
