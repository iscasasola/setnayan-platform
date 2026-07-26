/**
 * Booking-fee LOCK collection — END-TO-END DB verification (migrations replayed).
 * Covers 20270927120000_booking_fee_lock_collection: the free-5 courtesy, the
 * 5%-of-confirmed-total base, one-charge-per-(vendor×event) idempotency, and the
 * settle bridge. This is money code — the 5th-vs-6th boundary, the re-lock
 * no-double-charge, and settle-called-twice are all asserted against real SQL.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { bookingFeePhp } from '../../lib/booking-fee';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

/** A VERIFIED (marketplace-linked, claimed) vendor identity. */
async function newVendor(email: string): Promise<{ vendorProfileId: string; userId: string }> {
  // account_type 'customer' so the on_auth_user_created trigger doesn't
  // auto-create a competing vendor_profiles row (we insert the verified one).
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const userId = u.rows[0]!.id;
  // VERIFIED — only verified vendors reach the lock (the #3637
  // event_vendors_require_verified_before_lock trigger blocks the rest), so a
  // billable booking presupposes a verified identity.
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state)
     VALUES ($1, 'Fee Test Vendor', 'Manila', ARRAY['photography']::text[], 'verified')
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

async function newEvent(name: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    // Non-wedding event so the fixture needn't satisfy the wedding-field checks.
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  return r.rows[0]!.event_id;
}

/** A CONTRACTED event_vendors row linked to a verified vendor (the lock anchor). */
async function newContractedBooking(
  eventId: string,
  vendorProfileId: string | null,
  totalCostPhp: number | null,
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Fee Test Vendor', 'contracted', $2, $3)
     RETURNING vendor_id`,
    [eventId, totalCostPhp, vendorProfileId],
  );
  return r.rows[0]!.vendor_id;
}

type LockChargeResult = {
  skipped?: string;
  charge_id?: string;
  status?: string;
  amount_charged_centavos?: number;
  computed_fee_centavos?: number;
  booking_ordinal?: number;
  is_free?: boolean;
  reused?: boolean;
};

async function openLockCharge(eventVendorId: string): Promise<LockChargeResult> {
  const r = await db.query<{ result: LockChargeResult }>(
    `SELECT public.booking_fee_open_lock_charge($1) AS result`,
    [eventVendorId],
  );
  return r.rows[0]!.result;
}

/** Lock one fresh (event, booking) for a vendor and open its fee charge. */
async function lockAndCharge(
  vendorProfileId: string,
  totalCostPhp: number,
  label: string,
): Promise<LockChargeResult> {
  const eventId = await newEvent(label);
  const evId = await newContractedBooking(eventId, vendorProfileId, totalCostPhp);
  return openLockCharge(evId);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

test('schedule: booking_fee_centavos is the 5%/1% TAPER, ₱50 floor, NO cap', async () => {
  const q = async (c: number) => {
    const r = await db.query<{ f: number }>(`SELECT public.booking_fee_centavos($1)::int AS f`, [c]);
    return r.rows[0]!.f;
  };
  // Owner-locked 2026-07-25: 5% on the first ₱100,000, then 1% above.
  // The SQL is the authoritative mirror of lib/booking-fee.ts — these are the
  // same four worked examples the model states, in centavos.
  assert.equal(await q(0), 0); // ₱0 → no fee
  assert.equal(await q(50_000), 5_000); // ₱500 → 5% = ₱25 → floored ₱50 (5000c)
  assert.equal(await q(10_000_00), 50_000); // ₱10,000 → ₱500 (inside the band)
  assert.equal(await q(100_000_00), 500_000); // ₱100,000 → ₱5,000 (the band edge)
  assert.equal(await q(60_000_00), 300_000); // ₱60,000 → ₱3,000
  assert.equal(await q(300_000_00), 700_000); // ₱300,000 → ₱7,000
  assert.equal(await q(1_000_000_00), 1_400_000); // ₱1M → ₱14,000, uncapped
  assert.equal(await q(10_000_000_00), 10_400_000); // ₱10M → ₱104,000

  // The property that stops under-declaration paying: monotonic across the edge.
  assert.ok(
    (await q(100_000_01)) >= (await q(100_000_00)),
    'fee DECREASES just above the band edge — under-declaring would pay',
  );

  // And the SQL agrees with the TS to the centavo, so the two can never drift.
  for (const php of [500, 10_000, 60_000, 100_000, 300_000, 1_000_000, 10_000_000]) {
    assert.equal(
      await q(php * 100),
      Math.round(bookingFeePhp(php) * 100),
      `SQL and TS disagree at ₱${php}`,
    );
  }
});

test('free-5 then 5% at the 6th — the boundary + the base', async () => {
  const { vendorProfileId } = await newVendor('free5@fee.test');

  // Bookings 1..5 → FREE (waived_free5, no money).
  for (let i = 1; i <= 5; i++) {
    const res = await lockAndCharge(vendorProfileId, 100_000, `free5-${i}`);
    assert.equal(res.is_free, true, `booking ${i} is free`);
    assert.equal(res.status, 'waived_free5', `booking ${i} → waived_free5`);
    assert.equal(res.amount_charged_centavos, 0, `booking ${i} charges nothing`);
    assert.equal(res.booking_ordinal, i, `booking ${i} ordinal frozen`);
  }

  // Booking 6 → CHARGED 5% of the confirmed ₱100,000 = ₱5,000 (500000c), pending.
  const sixth = await lockAndCharge(vendorProfileId, 100_000, 'free5-6');
  assert.equal(sixth.is_free, false, '6th booking is not free');
  assert.equal(sixth.status, 'pending', '6th → pending (awaits QR payment)');
  assert.equal(sixth.booking_ordinal, 6);
  assert.equal(sixth.computed_fee_centavos, 500_000, 'fee = 5% of ₱100,000 (all inside the band)');
  assert.equal(sixth.amount_charged_centavos, 500_000);

  // Exactly ONE non-free charge row exists for this vendor.
  const chargeCount = await db.query<{ c: number }>(
    `SELECT count(*)::int c FROM public.booking_fee_charges
       WHERE vendor_profile_id = $1 AND status = 'pending'`,
    [vendorProfileId],
  );
  assert.equal(chargeCount.rows[0]!.c, 1, 'only the 6th booking has a pending charge');
});

test('idempotent re-lock: same (vendor,event) never double-charges', async () => {
  const { vendorProfileId } = await newVendor('relock@fee.test');
  // Push the vendor past free-5 with 5 throwaway bookings.
  for (let i = 1; i <= 5; i++) await lockAndCharge(vendorProfileId, 10_000, `relock-warm-${i}`);

  // A billable 6th booking.
  const eventId = await newEvent('relock-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 200_000);

  const first = await openLockCharge(evId);
  assert.equal(first.status, 'pending');
  assert.equal(first.reused, false, 'first open mints a charge');
  assert.equal(first.computed_fee_centavos, 600_000, '₱200,000 → ₱6,000 (5% of 100k + 1% of 100k)');

  // Re-lock the SAME event_vendor → same charge, no new row.
  const second = await openLockCharge(evId);
  assert.equal(second.reused, true, 're-lock reuses the live charge');
  assert.equal(second.charge_id, first.charge_id, 'same charge id');

  const rows = await db.query<{ c: number }>(
    `SELECT count(*)::int c FROM public.booking_fee_charges WHERE event_vendor_id = $1`,
    [evId],
  );
  assert.equal(rows.rows[0]!.c, 1, 'exactly one charge for the event_vendor across re-locks');
});

test('off-platform (no marketplace link) → never billed', async () => {
  const eventId = await newEvent('offplatform');
  const evId = await newContractedBooking(eventId, null, 500_000); // marketplace_vendor_id NULL
  const res = await openLockCharge(evId);
  assert.equal(res.skipped, 'not_verified_vendor');
  const rows = await db.query<{ c: number }>(
    `SELECT count(*)::int c FROM public.booking_fee_charges WHERE event_vendor_id = $1`,
    [evId],
  );
  assert.equal(rows.rows[0]!.c, 0, 'no charge for an off-platform vendor');
});

test('a non-contracted event_vendor is skipped', async () => {
  const { vendorProfileId } = await newVendor('considering@fee.test');
  const eventId = await newEvent('considering');
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'X', 'considering', 100000, $2) RETURNING vendor_id`,
    [eventId, vendorProfileId],
  );
  const res = await openLockCharge(r.rows[0]!.vendor_id);
  assert.equal(res.skipped, 'not_contracted');
});

test('settle bridge: settling a pending charge → paid + ledger rolled; second settle no-ops', async () => {
  const { vendorProfileId } = await newVendor('settle@fee.test');
  for (let i = 1; i <= 5; i++) await lockAndCharge(vendorProfileId, 10_000, `settle-warm-${i}`);
  const eventId = await newEvent('settle-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 100_000);
  const charge = await openLockCharge(evId);
  assert.equal(charge.status, 'pending');
  const chargeId = charge.charge_id!;

  // The bridge (sku-activation hook) calls booking_fee_settle_charge on approval.
  const s1 = await db.query<{ result: { settled: boolean; status: string } }>(
    `SELECT public.booking_fee_settle_charge($1, 'manual', 'ORDER-1') AS result`,
    [chargeId],
  );
  assert.equal(s1.rows[0]!.result.settled, true, 'first settle succeeds');

  const paid = await db.query<{ status: string }>(
    `SELECT status FROM public.booking_fee_charges WHERE charge_id = $1`,
    [chargeId],
  );
  assert.equal(paid.rows[0]!.status, 'paid', 'charge flips to paid');

  const ledger = await db.query<{ fee_paid_total_centavos: number }>(
    `SELECT fee_paid_total_centavos::int FROM public.booking_fee_ledger
       WHERE vendor_profile_id = $1 AND event_id = $2`,
    [vendorProfileId, eventId],
  );
  assert.equal(ledger.rows[0]!.fee_paid_total_centavos, 500_000, 'paid amount rolled into ledger');

  // Idempotent: settling again is a no-op (no double roll-in).
  const s2 = await db.query<{ result: { settled: boolean } }>(
    `SELECT public.booking_fee_settle_charge($1, 'manual', 'ORDER-1') AS result`,
    [chargeId],
  );
  assert.equal(s2.rows[0]!.result.settled, false, 'second settle no-ops');
  const ledger2 = await db.query<{ fee_paid_total_centavos: number }>(
    `SELECT fee_paid_total_centavos::int FROM public.booking_fee_ledger
       WHERE vendor_profile_id = $1 AND event_id = $2`,
    [vendorProfileId, eventId],
  );
  assert.equal(ledger2.rows[0]!.fee_paid_total_centavos, 500_000, 'no double roll-in');
});
