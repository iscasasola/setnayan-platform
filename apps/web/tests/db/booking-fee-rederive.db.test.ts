/**
 * Booking-fee RE-DERIVE on a post-lock price change — END-TO-END DB verification
 * (migrations replayed). Covers 20270930120000_booking_fee_rederive_on_amendment:
 * the AFTER-UPDATE trigger on event_vendors.total_cost_php re-derives the 5% fee
 * to the NEW agreed total, honestly by settlement state.
 *
 * This is LIVE money code — the adversarial cases (double-charge on repeated
 * updates, rewriting a SETTLED charge, free-5 drift, the ₱50 floor, flag-off
 * no-op) are all asserted against real SQL, driven through actual UPDATEs so the
 * trigger wiring itself is exercised.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

const SVC_PREFIX = 'vendor_booking_fee__';

async function newVendor(email: string): Promise<{ vendorProfileId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const userId = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state)
     VALUES ($1, 'Rederive Test Vendor', 'Manila', ARRAY['photography']::text[], 'verified')
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

async function newEvent(name: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  return r.rows[0]!.event_id;
}

async function newContractedBooking(
  eventId: string,
  vendorProfileId: string | null,
  totalCostPhp: number | null,
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Rederive Test Vendor', 'contracted', $2, $3)
     RETURNING vendor_id`,
    [eventId, totalCostPhp, vendorProfileId],
  );
  // Since 20271009140000 the fee charges ONLY Setnayan-sourced clients, and
  // "no thread" correctly reads as a client the vendor brought (free). An
  // amendment fixture is about re-pricing a BILLABLE booking, so say so.
  if (vendorProfileId) {
    await db.query(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
       VALUES ($1, $2, 'explore')`,
      [eventId, vendorProfileId],
    );
  }
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
};

async function openLockCharge(eventVendorId: string): Promise<LockChargeResult> {
  const r = await db.query<{ result: LockChargeResult }>(
    `SELECT public.booking_fee_open_lock_charge($1) AS result`,
    [eventVendorId],
  );
  return r.rows[0]!.result;
}

/** Push a vendor past the free-5 courtesy with 5 throwaway bookings. */
async function warmPastFree5(vendorProfileId: string, label: string): Promise<void> {
  for (let i = 1; i <= 5; i++) {
    const eventId = await newEvent(`${label}-warm-${i}`);
    const evId = await newContractedBooking(eventId, vendorProfileId, 10_000);
    await openLockCharge(evId);
  }
}

/** Change the couple-confirmed total (drives the re-derive trigger). */
async function setTotal(eventVendorId: string, totalPhp: number): Promise<void> {
  await db.query(`UPDATE public.event_vendors SET total_cost_php = $1 WHERE vendor_id = $2`, [
    totalPhp,
    eventVendorId,
  ]);
}

async function charges(eventVendorId: string): Promise<
  Array<{ kind: string; status: string; amount: number; fee: number; credit: number | null }>
> {
  const r = await db.query<{
    kind: string;
    status: string;
    amount_charged_centavos: number;
    computed_fee_centavos: number;
    credit_centavos: number | null;
  }>(
    `SELECT kind, status, amount_charged_centavos, computed_fee_centavos, credit_centavos
       FROM public.booking_fee_charges WHERE event_vendor_id = $1 ORDER BY created_at`,
    [eventVendorId],
  );
  return r.rows.map((x) => ({
    kind: x.kind,
    status: x.status,
    amount: Number(x.amount_charged_centavos),
    fee: Number(x.computed_fee_centavos),
    credit: x.credit_centavos === null ? null : Number(x.credit_centavos),
  }));
}

async function ledgerPaid(vendorProfileId: string, eventId: string): Promise<number> {
  const r = await db.query<{ p: number }>(
    `SELECT COALESCE(fee_paid_total_centavos,0)::int p FROM public.booking_fee_ledger
       WHERE vendor_profile_id = $1 AND event_id = $2`,
    [vendorProfileId, eventId],
  );
  return r.rows[0]?.p ?? 0;
}

/** Mint the vendor QR order the TS collectBookingFeeAtLock would (for order-sync tests). */
async function seedOrder(
  eventId: string,
  vendorProfileId: string,
  payerUserId: string,
  chargeId: string,
  amountPhp: number,
): Promise<string> {
  const r = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, vendor_profile_id, service_key, description,
        requested_total_php, status, reference_code)
     -- Rate-agnostic on purpose: nothing here asserts the description, and the
     -- real one is DERIVED from BOOKING_FEE (bookingFeeScheduleSummary). The old
     -- '(5%)' literal was the wrong claim above ₱100,000 — no copy of it lives
     -- in the repo any more.
     VALUES ($1,$2,$3,$4,'Setnayan booking fee',$5,'submitted',$6)
     RETURNING order_id`,
    [eventId, payerUserId, vendorProfileId, `${SVC_PREFIX}${chargeId}`, amountPhp, `SN${chargeId.slice(0, 8)}`],
  );
  const orderId = r.rows[0]!.order_id;
  await db.query(
    `INSERT INTO public.payments (order_id, user_id, amount_php, channel, paid_at)
     VALUES ($1,$2,$3,'manual',CURRENT_DATE)`,
    [orderId, payerUserId, amountPhp],
  );
  return orderId;
}

async function orderFor(chargeId: string): Promise<{ status: string; total: number } | null> {
  const r = await db.query<{ status: string; requested_total_php: string }>(
    `SELECT status, requested_total_php FROM public.orders WHERE service_key = $1 LIMIT 1`,
    [`${SVC_PREFIX}${chargeId}`],
  );
  if (r.rows.length === 0) return null;
  return { status: r.rows[0]!.status, total: Number(r.rows[0]!.requested_total_php) };
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

test('PENDING fee raised → charge + its QR order updated to the new 5%', async () => {
  const { vendorProfileId, userId } = await newVendor('pend-raise@fee.test');
  await warmPastFree5(vendorProfileId, 'pend-raise');
  const eventId = await newEvent('pend-raise-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 100_000);
  const charge = await openLockCharge(evId);
  assert.equal(charge.status, 'pending');
  assert.equal(charge.amount_charged_centavos, 500_000); // 5% of ₱100k
  // Seed the vendor order the TS lock path would mint, so we test order-SYNC.
  await seedOrder(eventId, vendorProfileId, userId, charge.charge_id!, 5_000);

  await setTotal(evId, 200_000); // amendment raises the agreed total

  const c = await charges(evId);
  assert.equal(c.length, 1, 'still one charge — updated in place, not stacked');
  assert.equal(c[0]!.status, 'pending');
  assert.equal(c[0]!.amount, 600_000, 'charge → taper on ₱200k = ₱6k (5% of 100k + 1% of 100k)');
  const ord = await orderFor(charge.charge_id!);
  assert.equal(ord?.status, 'submitted');
  assert.equal(ord?.total, 6_000, 'QR order synced to the tapered ₱6k');
});

test('PENDING fee lowered (still positive) → charge lowered', async () => {
  const { vendorProfileId } = await newVendor('pend-lower@fee.test');
  await warmPastFree5(vendorProfileId, 'pend-lower');
  const eventId = await newEvent('pend-lower-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 200_000);
  await openLockCharge(evId);

  await setTotal(evId, 60_000); // lowered but still well above the ₱1k floor

  const c = await charges(evId);
  assert.equal(c[0]!.amount, 300_000, '5% of ₱60k = ₱3k');
});

test('PENDING amended to ₱0 → charge cleared, QR order cancelled', async () => {
  const { vendorProfileId, userId } = await newVendor('pend-zero@fee.test');
  await warmPastFree5(vendorProfileId, 'pend-zero');
  const eventId = await newEvent('pend-zero-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 100_000);
  const charge = await openLockCharge(evId);
  await seedOrder(eventId, vendorProfileId, userId, charge.charge_id!, 5_000);

  await setTotal(evId, 0); // barter / no consideration

  const c = await charges(evId);
  assert.equal(c[0]!.amount, 0, 'nothing to collect');
  assert.equal(c[0]!.status, 'paid', '₱0 → cleared (RPC ₱0 convention)');
  const ord = await orderFor(charge.charge_id!);
  assert.equal(ord?.status, 'cancelled', 'order cancelled, not left open');
});

test('PAID fee raised → supplementary delta charge + delta order, primary UNTOUCHED', async () => {
  const { vendorProfileId, userId } = await newVendor('paid-raise@fee.test');
  await warmPastFree5(vendorProfileId, 'paid-raise');
  const eventId = await newEvent('paid-raise-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 100_000);
  const charge = await openLockCharge(evId);
  // Settle the primary (admin approved the vendor's ₱5k payment).
  await db.query(`SELECT public.booking_fee_settle_charge($1,'manual','ORD-P')`, [charge.charge_id!]);
  assert.equal(await ledgerPaid(vendorProfileId, eventId), 500_000);

  await setTotal(evId, 200_000); // amendment raises to ₱200k → fee ₱6k (tapered)

  const c = await charges(evId);
  const primary = c.find((x) => x.kind === 'primary')!;
  const delta = c.find((x) => x.kind === 'amendment_delta')!;
  assert.equal(primary.status, 'paid', 'settled primary never rewritten');
  assert.equal(primary.amount, 500_000, 'primary stays at the ₱5k already paid');
  assert.ok(delta, 'a supplementary delta was opened');
  assert.equal(delta.status, 'pending');
  assert.equal(delta.amount, 100_000, 'delta = ₱6k new − ₱5k paid = ₱1k');
  // The delta mints its OWN vendor order.
  const deltaChargeId = (
    await db.query<{ charge_id: string }>(
      `SELECT charge_id FROM public.booking_fee_charges WHERE event_vendor_id=$1 AND kind='amendment_delta'`,
      [evId],
    )
  ).rows[0]!.charge_id;
  const ord = await orderFor(deltaChargeId);
  assert.equal(ord?.total, 1_000, 'delta order for ₱1k (₱6k due − ₱5k paid)');
  assert.equal(await ledgerPaid(vendorProfileId, eventId), 500_000, 'ledger unchanged until delta settles');

  // Settle the delta → ledger rolls to the full ₱10k.
  await db.query(`SELECT public.booking_fee_settle_charge($1,'manual','ORD-D')`, [deltaChargeId]);
  assert.equal(await ledgerPaid(vendorProfileId, eventId), 600_000, 'now ₱6k total collected');
  assert.ok(userId);
});

test('PAID fee lowered → audit credit recorded, NO refund, primary + ledger UNTOUCHED', async () => {
  const { vendorProfileId } = await newVendor('paid-lower@fee.test');
  await warmPastFree5(vendorProfileId, 'paid-lower');
  const eventId = await newEvent('paid-lower-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 200_000);
  const charge = await openLockCharge(evId);
  await db.query(`SELECT public.booking_fee_settle_charge($1,'manual','ORD-P')`, [charge.charge_id!]);
  assert.equal(await ledgerPaid(vendorProfileId, eventId), 600_000); // ₱6k paid (tapered)

  await setTotal(evId, 100_000); // amendment DROPS to ₱100k → fee would be ₱5k

  const c = await charges(evId);
  const primary = c.find((x) => x.kind === 'primary')!;
  const credit = c.find((x) => x.kind === 'amendment_credit')!;
  assert.equal(primary.amount, 600_000, 'settled primary untouched');
  assert.ok(credit, 'a credit note was recorded');
  assert.equal(credit.credit, 100_000, 'overpaid ₱1k recorded (₱6k paid − ₱5k now due)');
  assert.equal(credit.amount, 0, 'credit moves no money');
  // No refund order exists for the credit row.
  const creditChargeId = (
    await db.query<{ charge_id: string }>(
      `SELECT charge_id FROM public.booking_fee_charges WHERE event_vendor_id=$1 AND kind='amendment_credit'`,
      [evId],
    )
  ).rows[0]!.charge_id;
  assert.equal(await orderFor(creditChargeId), null, 'no order / no refund for a credit');
  assert.equal(await ledgerPaid(vendorProfileId, eventId), 600_000, 'ledger unchanged — no clawback');
});

test('FREE-5 booking stays free at ANY amended total', async () => {
  const { vendorProfileId } = await newVendor('free-stays@fee.test');
  const eventId = await newEvent('free-stays-1');
  const evId = await newContractedBooking(eventId, vendorProfileId, 100_000);
  const charge = await openLockCharge(evId);
  assert.equal(charge.is_free, true);
  assert.equal(charge.status, 'waived_free5');

  await setTotal(evId, 5_000_000); // amend way up

  const c = await charges(evId);
  assert.equal(c.length, 1, 'no new charge');
  assert.equal(c[0]!.status, 'waived_free5', 'still free');
  assert.equal(c[0]!.amount, 0, 'still ₱0 — free-5 courtesy never billed');
});

test('flag-off / no charge at lock → amendment is a pure no-op', async () => {
  // No lock charge was ever opened (models the fee flag being OFF at lock).
  const { vendorProfileId } = await newVendor('noflag@fee.test');
  const eventId = await newEvent('noflag');
  const evId = await newContractedBooking(eventId, vendorProfileId, 100_000);

  await setTotal(evId, 300_000);

  const c = await charges(evId);
  assert.equal(c.length, 0, 'no charge minted by an amendment — first fee is lock-only');
  const orders = await db.query<{ n: number }>(
    `SELECT count(*)::int n FROM public.orders WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(orders.rows[0]!.n, 0, 'no order minted');
});

test('off-platform (no marketplace link) → never billed on amendment', async () => {
  const eventId = await newEvent('offplat');
  const evId = await newContractedBooking(eventId, null, 100_000); // marketplace_vendor_id NULL
  await openLockCharge(evId); // skips: not_verified_vendor

  await setTotal(evId, 500_000);

  const c = await charges(evId);
  assert.equal(c.length, 0, 'off-platform booking never accrues a fee');
});

test('idempotent: re-updating to the SAME total never double-charges', async () => {
  // (a) pending path
  const { vendorProfileId } = await newVendor('idem@fee.test');
  await warmPastFree5(vendorProfileId, 'idem');
  const eventId = await newEvent('idem-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 100_000);
  await openLockCharge(evId);
  await setTotal(evId, 200_000);
  await setTotal(evId, 200_000); // same total again
  await db.query(`UPDATE public.event_vendors SET total_cost_php = 200000, updated_at = NOW() WHERE vendor_id=$1`, [evId]);
  let c = await charges(evId);
  assert.equal(c.length, 1, 'still exactly one charge across repeated identical updates');
  assert.equal(c[0]!.amount, 600_000);

  // (b) paid path — repeated identical raise keeps ONE delta
  const eventId2 = await newEvent('idem-paid');
  const evId2 = await newContractedBooking(eventId2, vendorProfileId, 100_000);
  const ch2 = await openLockCharge(evId2);
  await db.query(`SELECT public.booking_fee_settle_charge($1,'manual','X')`, [ch2.charge_id!]);
  await setTotal(evId2, 300_000);
  await setTotal(evId2, 300_000); // same again
  c = await charges(evId2);
  const deltas = c.filter((x) => x.kind === 'amendment_delta');
  assert.equal(deltas.length, 1, 'exactly one delta despite repeated identical updates');
  assert.equal(deltas[0]!.amount, 200_000, 'taper on ₱300k (₱7k) − ₱5k paid = ₱2k'); // 7000 - 5000
});

test('₱50 floor holds after an amendment down to a tiny total', async () => {
  const { vendorProfileId } = await newVendor('floor@fee.test');
  await warmPastFree5(vendorProfileId, 'floor');
  const eventId = await newEvent('floor-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 100_000);
  await openLockCharge(evId);

  await setTotal(evId, 500); // ₱500 → 5% = ₱25 → floored to ₱50

  const c = await charges(evId);
  assert.equal(c[0]!.amount, 5_000, 'floored at ₱50 (5000c), not ₱25');
});

test('paid → raise (delta) → then drop back to exactly paid → delta cancelled, no credit owed', async () => {
  const { vendorProfileId } = await newVendor('roundtrip@fee.test');
  await warmPastFree5(vendorProfileId, 'roundtrip');
  const eventId = await newEvent('roundtrip-6');
  const evId = await newContractedBooking(eventId, vendorProfileId, 100_000);
  const charge = await openLockCharge(evId);
  await db.query(`SELECT public.booking_fee_settle_charge($1,'manual','P')`, [charge.charge_id!]);

  await setTotal(evId, 200_000); // opens a ₱5k delta
  let c = await charges(evId);
  assert.ok(c.some((x) => x.kind === 'amendment_delta' && x.status === 'pending'));

  await setTotal(evId, 100_000); // back to the originally-paid total exactly
  c = await charges(evId);
  const liveDelta = c.find((x) => x.kind === 'amendment_delta' && x.status === 'pending');
  assert.equal(liveDelta, undefined, 'pending delta cancelled when the raise is reversed');
  const credit = c.find((x) => x.kind === 'amendment_credit');
  assert.ok(!credit || credit.credit === 0, 'no credit owed — new fee equals what was paid');
});
