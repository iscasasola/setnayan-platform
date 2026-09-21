/**
 * THE PAID FEE HOLDS THE DATE — CTRL-B2 build 7.
 *
 * Owner 2026-09-18: a lock on the supplier's schedule happens *upon the vendor
 * paying their booking fee.* `vendor_calendar_blocks` was 0 rows in production
 * and the only automatic writer never fired — its trigger's happy path has
 * never once run, because every `deposit_paid` row in prod is a MANUAL supplier
 * with no `marketplace_vendor_id` and fails an earlier guard.
 *
 * Proved against a replayed schema, because availability is a property of the
 * database and no grep can see a trigger, a CHECK or an idempotency skip.
 *
 * 🔑 THE TESTS THAT MATTER ARE 4 AND 5 — BOTH ENDS. A new reason to CLOSE a
 * date is a defect on its own unless the release side learns it too: otherwise
 * releasing booking A reopens a day booking B has PAID to hold.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
before(async () => { replay = await createReplayedDb(); db = replay.db; });
after(async () => { await db?.close(); });

let seq = 0;
const uniq = () => `hold-${++seq}-${Date.now()}`;
const DATE = '2027-05-15';

async function newVendor(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`, [`${uniq()}@t.local`]);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'Hold Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id`, [u.rows[0]!.id]);
  return v.rows[0]!.vendor_profile_id;
}

/** A booked row at `contracted` — the state the two real prod bookings sit in. */
async function newBooking(vpid: string | null, date = DATE, status = 'contracted') {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A celebration','birthday',$1::date) RETURNING event_id`, [date]);
  const eventId = e.rows[0]!.event_id;
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id)
     VALUES ($1,'photographer','Hold Studio',$2::vendor_status,$3,$3) RETURNING vendor_id`,
    [eventId, status, vpid]);
  return { eventId, eventVendorId: ev.rows[0]!.vendor_id };
}

async function newCharge(vpid: string, eventId: string, eventVendorId: string, status: string) {
  const led = await db.query<{ ledger_id: string }>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id) VALUES ($1,$2)
     RETURNING ledger_id`, [eventId, vpid]);
  const c = await db.query<{ charge_id: string }>(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, event_vendor_id, source, status,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version)
     VALUES ($1,$2,$3,$4,'lock',$5,1675000,83750,83750,'2026-07-25') RETURNING charge_id`,
    [led.rows[0]!.ledger_id, eventId, vpid, eventVendorId, status]);
  return c.rows[0]!.charge_id;
}

const blocks = async (vpid: string, date = DATE) =>
  Number((await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.vendor_calendar_blocks
      WHERE vendor_profile_id = $1 AND block_source = 'setnayan_booking'
        AND (blocked_at AT TIME ZONE 'Asia/Manila')::date = $2::date`, [vpid, date])).rows[0]!.n);

test('a settled fee holds the date — on a booking still at `contracted`', async () => {
  const vpid = await newVendor();
  const b = await newBooking(vpid);
  const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, 'paid');
  assert.equal(await blocks(vpid), 0, 'nothing should be held before the fee settles');

  await db.query(`SELECT public.vendor_hold_date_on_fee_settled($1)`, [chargeId]);

  assert.equal(
    await blocks(vpid),
    1,
    'the supplier paid to hold this date and his calendar still said he was free',
  );
});

test('the first five bookings hold a date too — waived is settled', async () => {
  for (const status of ['waived_free5', 'waived_import']) {
    const vpid = await newVendor();
    const b = await newBooking(vpid);
    const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, status);
    await db.query(`SELECT public.vendor_hold_date_on_fee_settled($1)`, [chargeId]);
    assert.equal(
      await blocks(vpid),
      1,
      `${status} must hold the date — reading "settled" as paid alone leaves a supplier's FIRST FIVE bookings unprotected, which is when they are most exposed`,
    );
  }
});

test('an unsettled fee holds nothing, and says which status stopped it', async () => {
  const vpid = await newVendor();
  const b = await newBooking(vpid);
  const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, 'pending');
  const r = await db.query<{ j: string }>(
    `SELECT public.vendor_hold_date_on_fee_settled($1)::text AS j`, [chargeId]);
  assert.equal(await blocks(vpid), 0, 'an unpaid fee must not hold a date');
  assert.match(r.rows[0]!.j, /fee_unsettled/, 'the refusal must name its reason');
  assert.match(r.rows[0]!.j, /pending/, 'and the status that caused it');
});

test('🔑 releasing one booking does NOT reopen a date another has PAID to hold', async () => {
  const vpid = await newVendor();
  const a = await newBooking(vpid);
  const bb = await newBooking(vpid);
  const chargeA = await newCharge(vpid, a.eventId, a.eventVendorId, 'paid');
  const chargeB = await newCharge(vpid, bb.eventId, bb.eventVendorId, 'paid');
  await db.query(`SELECT public.vendor_hold_date_on_fee_settled($1)`, [chargeA]);
  await db.query(`SELECT public.vendor_hold_date_on_fee_settled($1)`, [chargeB]);
  assert.equal(await blocks(vpid), 1, 'one block covers the civil day, idempotently');

  // A is reversed and released. B still holds the day.
  await db.query(`UPDATE public.booking_fee_charges SET status='pending' WHERE charge_id=$1`, [chargeA]);
  await db.query(`SELECT public.vendor_release_date_on_fee_reversed($1)`, [chargeA]);

  assert.equal(
    await blocks(vpid),
    1,
    'a booking that has paid to hold this day was reopened by ANOTHER booking being released — the supplier is now double-bookable by the mechanism meant to protect him',
  );
});

test('🔑 …and when the LAST holder is released, the date really does reopen', async () => {
  const vpid = await newVendor();
  const b = await newBooking(vpid);
  const chargeId = await newCharge(vpid, b.eventId, b.eventVendorId, 'paid');
  await db.query(`SELECT public.vendor_hold_date_on_fee_settled($1)`, [chargeId]);
  assert.equal(await blocks(vpid), 1);

  await db.query(`UPDATE public.booking_fee_charges SET status='pending' WHERE charge_id=$1`, [chargeId]);
  await db.query(`SELECT public.vendor_release_date_on_fee_reversed($1)`, [chargeId]);

  assert.equal(
    await blocks(vpid),
    0,
    'a refunded supplier is left with a date nobody can book and he did not keep — a hold with no release is the mirror defect',
  );
});

test('a manual supplier has no calendar to hold — the same population the trigger skips', async () => {
  const vpid = await newVendor();
  const b = await newBooking(null); // marketplace_vendor_id IS NULL
  const led = await db.query<{ ledger_id: string }>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id) VALUES ($1,$2)
     RETURNING ledger_id`, [b.eventId, vpid]);
  const c = await db.query<{ charge_id: string }>(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, event_vendor_id, source, status,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version)
     VALUES ($1,$2,$3,$4,'lock','paid',100,100,100,'2026-07-25') RETURNING charge_id`,
    [led.rows[0]!.ledger_id, b.eventId, vpid, b.eventVendorId]);
  const r = await db.query<{ j: string }>(
    `SELECT public.vendor_hold_date_on_fee_settled($1)::text AS j`, [c.rows[0]!.charge_id]);
  assert.match(r.rows[0]!.j, /not_marketplace/, 'a manual supplier has no shop and no calendar — skipping is correct, and must say so');
  assert.equal(await blocks(vpid), 0);
});
